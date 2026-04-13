import uuid
import os
import tempfile
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import get_current_user_id
from app.models.models import Lote, Comprobante, Usuario, Estudio, Exportacion
from app.schemas.schemas import (
    LoteCreate, LoteOut, LoteStats,
    ComprobanteOut, ComprobanteUpdate,
    ExportRequest, ExportResponse,
    DashboardStats,
)
import boto3
import io

settings = get_settings()
logger = logging.getLogger(__name__)
router = APIRouter(tags=["Principal"])

# ── S3 helper ──────────────────────────────────────────────────────────────

def get_s3():
    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


async def get_current_usuario(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    result = await db.execute(select(Usuario).where(Usuario.id == uuid.UUID(user_id)))
    usuario = result.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


# ── Dashboard ──────────────────────────────────────────────────────────────

@router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    estudio_id = usuario.estudio_id

    # Estudio info
    result = await db.execute(select(Estudio).where(Estudio.id == estudio_id))
    estudio = result.scalar_one()

    today = datetime.utcnow().date()

    # Comprobantes hoy
    result = await db.execute(
        select(func.count(Comprobante.id)).where(
            Comprobante.estudio_id == estudio_id,
            func.date(Comprobante.created_at) == today,
        )
    )
    compr_hoy = result.scalar() or 0

    # Lotes activos
    result = await db.execute(
        select(func.count(Lote.id)).where(
            Lote.estudio_id == estudio_id,
            Lote.estado == "procesando",
        )
    )
    lotes_activos = result.scalar() or 0

    # Precisión promedio
    result = await db.execute(
        select(func.avg(Comprobante.confianza_global)).where(
            Comprobante.estudio_id == estudio_id,
            Comprobante.confianza_global.isnot(None),
        )
    )
    precision = float(result.scalar() or 0) * 100

    return DashboardStats(
        comprobantes_hoy=compr_hoy,
        comprobantes_mes=estudio.comprobantes_usados_mes,
        lotes_activos=lotes_activos,
        precision_promedio=round(precision, 1),
        tiempo_promedio_seg=2.3,
        limite_mes=estudio.limite_comprobantes_mes,
        usados_mes=estudio.comprobantes_usados_mes,
    )


# ── Lotes ──────────────────────────────────────────────────────────────────

@router.get("/lotes", response_model=list[LoteOut])
async def listar_lotes(
    skip: int = 0,
    limit: int = 20,
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lote)
        .where(Lote.estudio_id == usuario.estudio_id)
        .order_by(Lote.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/lotes", response_model=LoteOut, status_code=201)
async def crear_lote(
    data: LoteCreate,
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    lote = Lote(
        estudio_id=usuario.estudio_id,
        usuario_id=usuario.id,
        cliente_id=data.cliente_id,
        nombre=data.nombre,
        estado="pendiente",
    )
    db.add(lote)
    await db.flush()
    return lote


@router.post("/lotes/{lote_id}/upload", status_code=202)
async def upload_archivos(
    lote_id: uuid.UUID,
    archivos: list[UploadFile] = File(...),
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    """Sube archivos a S3 y encola el procesamiento con Celery."""
    result = await db.execute(
        select(Lote).where(Lote.id == lote_id, Lote.estudio_id == usuario.estudio_id)
    )
    lote = result.scalar_one_or_none()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    if len(archivos) > settings.MAX_FILES_PER_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"Máximo {settings.MAX_FILES_PER_BATCH} archivos por lote",
        )

    s3 = get_s3()
    archivos_para_celery = []

    for archivo in archivos:
        # Validar tipo
        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".pdf", ".heic", ".webp"):
            continue

        # Validar tamaño
        content = await archivo.read()
        if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            continue

        # Crear registro de comprobante
        comp = Comprobante(
            lote_id=lote_id,
            estudio_id=usuario.estudio_id,
            nombre_archivo_original=archivo.filename,
            estado_revision="pendiente",
        )
        db.add(comp)
        await db.flush()

        # Subir a S3 o Local
        s3_key = f"estudios/{usuario.estudio_id}/lotes/{lote_id}/{comp.id}{ext}"
        if settings.AWS_ACCESS_KEY_ID == "test":
            local_path = os.path.join("uploads", s3_key)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(content)
            url = f"http://localhost:8000/api/v1/uploads/{s3_key}"
        else:
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=s3_key,
                Body=content,
                ContentType=archivo.content_type or "application/octet-stream",
            )
            url = s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
                ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY,
            )
        
        comp.imagen_original_url = url

        archivos_para_celery.append({
            "s3_key": s3_key,
            "filename": archivo.filename,
            "comprobante_id": str(comp.id),
        })

    lote.total_archivos = len(archivos_para_celery)
    lote.estado = "procesando"
    await db.commit()

    # Encolar tarea Celery
    from app.workers.tasks import procesar_lote
    task = procesar_lote.delay(str(lote_id), archivos_para_celery)
    lote.celery_task_id = task.id
    await db.commit()

    return {"message": f"{len(archivos_para_celery)} archivos encolados", "lote_id": str(lote_id)}


@router.get("/lotes/{lote_id}/stats", response_model=LoteStats)
async def lote_stats(
    lote_id: uuid.UUID,
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lote).where(Lote.id == lote_id, Lote.estudio_id == usuario.estudio_id)
    )
    lote = result.scalar_one_or_none()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    result = await db.execute(
        select(func.count(Comprobante.id)).where(Comprobante.lote_id == lote_id)
    )
    total = result.scalar() or 0

    result = await db.execute(
        select(func.count(Comprobante.id)).where(
            Comprobante.lote_id == lote_id, Comprobante.estado_revision == "aprobado"
        )
    )
    aprobados = result.scalar() or 0

    result = await db.execute(
        select(func.count(Comprobante.id)).where(
            Comprobante.lote_id == lote_id,
            Comprobante.alertas_validacion != None,
        )
    )
    con_alertas = result.scalar() or 0

    return LoteStats(
        total=total,
        procesados=lote.procesados,
        aprobados=aprobados,
        con_alertas=con_alertas,
        errores=lote.errores,
    )


# ── Comprobantes ────────────────────────────────────────────────────────────

@router.get("/lotes/{lote_id}/comprobantes", response_model=list[ComprobanteOut])
async def listar_comprobantes(
    lote_id: uuid.UUID,
    estado: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    query = select(Comprobante).where(
        Comprobante.lote_id == lote_id,
        Comprobante.estudio_id == usuario.estudio_id,
    )
    if estado:
        query = query.where(Comprobante.estado_revision == estado)
    query = query.order_by(Comprobante.created_at).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/comprobantes/{comp_id}", response_model=ComprobanteOut)
async def actualizar_comprobante(
    comp_id: uuid.UUID,
    data: ComprobanteUpdate,
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comprobante).where(
            Comprobante.id == comp_id,
            Comprobante.estudio_id == usuario.estudio_id,
        )
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(comp, field, value)

    return comp


@router.post("/lotes/{lote_id}/aprobar-todos", status_code=200)
async def aprobar_todos(
    lote_id: uuid.UUID,
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comprobante).where(
            Comprobante.lote_id == lote_id,
            Comprobante.estudio_id == usuario.estudio_id,
            Comprobante.estado_revision == "pendiente",
        )
    )
    comps = result.scalars().all()
    for comp in comps:
        comp.estado_revision = "aprobado"
    return {"actualizados": len(comps)}


# ── Exportación ─────────────────────────────────────────────────────────────

@router.post("/lotes/{lote_id}/exportar")
async def exportar_lote(
    lote_id: uuid.UUID,
    data: ExportRequest,
    usuario: Usuario = Depends(get_current_usuario),
    db: AsyncSession = Depends(get_db),
):
    """Genera y descarga el archivo de exportación para el software elegido."""
    result = await db.execute(
        select(Comprobante).where(
            Comprobante.lote_id == lote_id,
            Comprobante.estudio_id == usuario.estudio_id,
            Comprobante.estado_revision.in_(data.incluir_estados),
        ).order_by(Comprobante.fecha_emision)
    )
    comprobantes = result.scalars().all()

    if not comprobantes:
        raise HTTPException(status_code=400, detail="No hay comprobantes con los estados seleccionados")

    software = data.software.lower()

    if software == "tango":
        from app.services.exporters.tango import generar_tango
        content = generar_tango(comprobantes)
        filename = f"contabilizAR_Tango_{lote_id}.txt"
        media_type = "text/plain"

    elif software == "holistor":
        from app.services.exporters.holistor import generar_holistor
        content = generar_holistor(
            comprobantes,
            cuenta_gasto_defecto=data.cuenta_gasto_defecto or "5.1.01.001",
            empresa_codigo=data.empresa_codigo or "001",
        )
        filename = f"contabilizAR_Holistor_{lote_id}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    elif software == "bejerman":
        from app.services.exporters.bejerman import generar_bejerman_comprobantes
        content = generar_bejerman_comprobantes(
            comprobantes,
            empresa_codigo=data.empresa_codigo or "001",
            ejercicio=data.ejercicio,
            periodo=data.periodo,
        )
        filename = f"contabilizAR_Bejerman_{lote_id}.csv"
        media_type = "text/csv"

    elif software == "bejerman_asientos":
        from app.services.exporters.bejerman import generar_bejerman_asientos
        content = generar_bejerman_asientos(
            comprobantes,
            empresa_codigo=data.empresa_codigo or "001",
            ejercicio=data.ejercicio,
            periodo=data.periodo,
            cuenta_gasto_defecto=data.cuenta_gasto_defecto or "51010100",
        )
        filename = f"contabilizAR_Bejerman_Asientos_{lote_id}.csv"
        media_type = "text/csv"

    elif software == "csv_generico":
        import csv
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow([
            "tipo_comprobante", "punto_venta", "numero_comprobante", "fecha_emision",
            "cuit_emisor", "razon_social_emisor", "importe_neto_gravado",
            "iva_21", "iva_105", "importe_exento", "importe_total",
            "cae", "condicion_venta", "moneda"
        ])
        for c in comprobantes:
            writer.writerow([
                c.tipo_comprobante, c.punto_venta, c.numero_comprobante,
                c.fecha_emision, c.cuit_emisor, c.razon_social_emisor,
                c.importe_neto_gravado, c.iva_21, c.iva_105,
                c.importe_exento, c.importe_total, c.cae,
                c.condicion_venta, c.moneda,
            ])
        content = output.getvalue().encode("utf-8-sig")
        filename = f"contabilizAR_CSV_{lote_id}.csv"
        media_type = "text/csv"

    else:
        raise HTTPException(status_code=400, detail=f"Software no soportado: {software}")

    # Registrar exportación
    exportacion = Exportacion(
        lote_id=lote_id,
        estudio_id=usuario.estudio_id,
        software_destino=software,
        formato=filename.split(".")[-1],
        total_registros=len(comprobantes),
    )
    db.add(exportacion)
    await db.commit()

    # Stream de descarga
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
