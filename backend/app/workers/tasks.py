"""
Celery tasks para procesamiento asíncrono de lotes de comprobantes.
"""
import asyncio
import logging
import os
import tempfile
from uuid import UUID
from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal

settings = get_settings()
logger = logging.getLogger(__name__)

celery_app = Celery(
    "contabilizar",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Argentina/Buenos_Aires",
    enable_utc=True,
    task_soft_time_limit=300,  # 5 min por tarea
    task_time_limit=360,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def procesar_lote(self, lote_id: str, archivos: list[dict]):
    """
    Tarea principal: procesa todos los archivos de un lote.
    archivos: [{"s3_key": "...", "filename": "...", "comprobante_id": "..."}]
    """
    return run_async(_procesar_lote_async(lote_id, archivos))


async def _procesar_lote_async(lote_id: str, archivos: list[dict]):
    from app.services.pipeline_ia import process_file
    import boto3
    from app.models.models import Lote, Comprobante
    from sqlalchemy import select
    from datetime import datetime, date

    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )

    async with AsyncSessionLocal() as db:
        try:
            # Actualizar estado del lote
            result = await db.execute(select(Lote).where(Lote.id == UUID(lote_id)))
            lote = result.scalar_one_or_none()
            if not lote:
                logger.error(f"Lote {lote_id} no encontrado")
                return

            lote.estado = "procesando"
            await db.commit()

            procesados = 0
            errores = 0

            for archivo in archivos:
                comp_id = archivo.get("comprobante_id")
                s3_key = archivo.get("s3_key")
                filename = archivo.get("filename", "archivo.jpg")

                try:
                    # Descargar archivo de S3 a tmp o leer local
                    if settings.AWS_ACCESS_KEY_ID == "test":
                        import shutil
                        tmp_path_src = os.path.join("uploads", s3_key)
                        with tempfile.NamedTemporaryFile(suffix=f"_{filename}", delete=False) as tmp:
                            with open(tmp_path_src, "rb") as src:
                                shutil.copyfileobj(src, tmp)
                            tmp_path = tmp.name
                    else:
                        with tempfile.NamedTemporaryFile(
                            suffix=f"_{filename}", delete=False
                        ) as tmp:
                            s3.download_fileobj(settings.S3_BUCKET_NAME, s3_key, tmp)
                            tmp_path = tmp.name

                    # Extraer datos con IA
                    data = await process_file(tmp_path, filename)

                    # Guardar en DB
                    result = await db.execute(
                        select(Comprobante).where(Comprobante.id == UUID(comp_id))
                    )
                    comp = result.scalar_one_or_none()
                    if comp:
                        _populate_comprobante(comp, data)
                        comp.estado_revision = "pendiente"

                    procesados += 1

                except Exception as e:
                    logger.error(f"Error procesando {filename}: {e}")
                    result = await db.execute(
                        select(Comprobante).where(Comprobante.id == UUID(comp_id))
                    )
                    comp = result.scalar_one_or_none()
                    if comp:
                        comp.estado_revision = "error_extraccion"
                        comp.error_mensaje = str(e)
                    errores += 1

                finally:
                    # Limpiar tmp
                    try:
                        os.unlink(tmp_path)
                    except Exception:
                        pass

                # Actualizar progreso del lote
                lote.procesados = procesados
                lote.errores = errores
                await db.commit()

            # Finalizar lote
            lote.estado = "completado" if errores == 0 else "completado_con_errores"
            lote.completed_at = datetime.utcnow()
            await db.commit()

        except Exception as e:
            logger.error(f"Error fatal en lote {lote_id}: {e}")
            if lote:
                lote.estado = "error"
                await db.commit()
            raise


def _populate_comprobante(comp, data: dict):
    """Mapea los datos extraídos por IA a los campos del modelo."""
    from datetime import datetime

    def parse_date(s):
        if not s:
            return None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except Exception:
                pass
        return None

    def safe_float(v):
        try:
            return float(v) if v is not None else 0.0
        except Exception:
            return 0.0

    comp.tipo_comprobante = data.get("tipo_comprobante")
    comp.codigo_afip = data.get("codigo_afip")
    comp.punto_venta = data.get("punto_venta")
    comp.numero_comprobante = data.get("numero_comprobante")
    comp.fecha_emision = parse_date(data.get("fecha_emision"))
    comp.fecha_vencimiento_pago = parse_date(data.get("fecha_vencimiento_pago"))
    comp.cuit_emisor = data.get("cuit_emisor")
    comp.razon_social_emisor = data.get("razon_social_emisor")
    comp.condicion_iva_emisor = data.get("condicion_iva_emisor")
    comp.cuit_receptor = data.get("cuit_receptor")
    comp.razon_social_receptor = data.get("razon_social_receptor")
    comp.moneda = data.get("moneda") or "ARS"
    comp.tipo_cambio = safe_float(data.get("tipo_cambio")) or None
    comp.importe_neto_gravado = safe_float(data.get("importe_neto_gravado"))
    comp.importe_exento = safe_float(data.get("importe_exento"))
    comp.importe_no_gravado = safe_float(data.get("importe_no_gravado"))
    comp.iva_21 = safe_float(data.get("iva_21"))
    comp.iva_105 = safe_float(data.get("iva_105"))
    comp.iva_27 = safe_float(data.get("iva_27"))
    comp.importe_percepciones = safe_float(data.get("importe_percepciones"))
    comp.percepciones_detalle = data.get("percepciones_detalle")
    comp.importe_retenciones = safe_float(data.get("importe_retenciones"))
    comp.retenciones_detalle = data.get("retenciones_detalle")
    comp.importe_total = safe_float(data.get("importe_total"))
    comp.cae = data.get("cae")
    comp.cae_vencimiento = parse_date(data.get("cae_vencimiento"))
    comp.condicion_venta = data.get("condicion_venta")
    comp.concepto_descripcion = data.get("concepto_descripcion")

    meta = data.get("metadata_extraccion", {})
    comp.confianza_global = safe_float(meta.get("confianza_global"))
    comp.confianza_por_campo = meta.get("confianza_por_campo")
    comp.alertas_validacion = meta.get("alertas", [])
    comp.modelo_utilizado = meta.get("modelo_utilizado", settings.GEMINI_MODEL)
