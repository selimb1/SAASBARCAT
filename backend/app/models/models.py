import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, DateTime, Date, Numeric, Float, Boolean, Text, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Estudio(Base):
    __tablename__ = "estudios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    cuit: Mapped[Optional[str]] = mapped_column(String(20))
    email_contacto: Mapped[Optional[str]] = mapped_column(String(255))
    plan: Mapped[str] = mapped_column(String(50), default="starter")
    limite_comprobantes_mes: Mapped[int] = mapped_column(Integer, default=300)
    comprobantes_usados_mes: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    usuarios: Mapped[list["Usuario"]] = relationship("Usuario", back_populates="estudio")
    clientes: Mapped[list["ClienteEstudio"]] = relationship("ClienteEstudio", back_populates="estudio")
    lotes: Mapped[list["Lote"]] = relationship("Lote", back_populates="estudio")


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    estudio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("estudios.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(String(50), default="contador")  # admin, contador, readonly
    totp_secret: Mapped[Optional[str]] = mapped_column(String(255))
    totp_habilitado: Mapped[bool] = mapped_column(Boolean, default=False)
    google_sub: Mapped[Optional[str]] = mapped_column(String(255))
    microsoft_sub: Mapped[Optional[str]] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    estudio: Mapped["Estudio"] = relationship("Estudio", back_populates="usuarios")


class ClienteEstudio(Base):
    __tablename__ = "clientes_estudio"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    estudio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("estudios.id"), nullable=False)
    razon_social: Mapped[str] = mapped_column(String(255), nullable=False)
    cuit: Mapped[Optional[str]] = mapped_column(String(20), index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    estudio: Mapped["Estudio"] = relationship("Estudio", back_populates="clientes")
    lotes: Mapped[list["Lote"]] = relationship("Lote", back_populates="cliente")


class Lote(Base):
    __tablename__ = "lotes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    estudio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("estudios.id"), nullable=False)
    cliente_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clientes_estudio.id"))
    usuario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    nombre: Mapped[Optional[str]] = mapped_column(String(255))
    estado: Mapped[str] = mapped_column(String(50), default="pendiente")
    # pendiente, procesando, completado, completado_con_errores, error
    total_archivos: Mapped[int] = mapped_column(Integer, default=0)
    procesados: Mapped[int] = mapped_column(Integer, default=0)
    errores: Mapped[int] = mapped_column(Integer, default=0)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    estudio: Mapped["Estudio"] = relationship("Estudio", back_populates="lotes")
    cliente: Mapped[Optional["ClienteEstudio"]] = relationship("ClienteEstudio", back_populates="lotes")
    comprobantes: Mapped[list["Comprobante"]] = relationship("Comprobante", back_populates="lote")
    exportaciones: Mapped[list["Exportacion"]] = relationship("Exportacion", back_populates="lote")


class Comprobante(Base):
    __tablename__ = "comprobantes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lotes.id"), nullable=False)
    estudio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("estudios.id"), nullable=False)

    # Identificación
    tipo_comprobante: Mapped[Optional[str]] = mapped_column(String(50))
    codigo_afip: Mapped[Optional[str]] = mapped_column(String(5))
    punto_venta: Mapped[Optional[str]] = mapped_column(String(5))
    numero_comprobante: Mapped[Optional[str]] = mapped_column(String(20))
    letra: Mapped[Optional[str]] = mapped_column(String(1))

    # Fechas
    fecha_emision: Mapped[Optional[date]] = mapped_column(Date)
    fecha_vencimiento_pago: Mapped[Optional[date]] = mapped_column(Date)

    # Emisor
    cuit_emisor: Mapped[Optional[str]] = mapped_column(String(20))
    razon_social_emisor: Mapped[Optional[str]] = mapped_column(String(255))
    condicion_iva_emisor: Mapped[Optional[str]] = mapped_column(String(50))

    # Receptor
    cuit_receptor: Mapped[Optional[str]] = mapped_column(String(20))
    razon_social_receptor: Mapped[Optional[str]] = mapped_column(String(255))

    # Importes
    moneda: Mapped[str] = mapped_column(String(10), default="ARS")
    tipo_cambio: Mapped[Optional[float]] = mapped_column(Float)
    importe_neto_gravado: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    importe_exento: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    importe_no_gravado: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    iva_21: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    iva_105: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    iva_27: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    importe_percepciones: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    percepciones_detalle: Mapped[Optional[dict]] = mapped_column(JSON)
    importe_retenciones: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    retenciones_detalle: Mapped[Optional[dict]] = mapped_column(JSON)
    importe_total: Mapped[float] = mapped_column(Numeric(15, 2), default=0)

    # AFIP
    cae: Mapped[Optional[str]] = mapped_column(String(20))
    cae_vencimiento: Mapped[Optional[date]] = mapped_column(Date)
    condicion_venta: Mapped[Optional[str]] = mapped_column(String(50))
    concepto_descripcion: Mapped[Optional[str]] = mapped_column(Text)

    # IA metadata
    confianza_global: Mapped[Optional[float]] = mapped_column(Float)
    confianza_por_campo: Mapped[Optional[dict]] = mapped_column(JSON)
    alertas_validacion: Mapped[Optional[list]] = mapped_column(JSON)
    modelo_utilizado: Mapped[Optional[str]] = mapped_column(String(100))

    # Estado
    estado_revision: Mapped[str] = mapped_column(String(50), default="pendiente")
    # pendiente, aprobado, rechazado, error_extraccion
    imagen_original_url: Mapped[Optional[str]] = mapped_column(Text)
    imagen_procesada_url: Mapped[Optional[str]] = mapped_column(Text)
    nombre_archivo_original: Mapped[Optional[str]] = mapped_column(String(255))
    error_mensaje: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lote: Mapped["Lote"] = relationship("Lote", back_populates="comprobantes")


class Exportacion(Base):
    __tablename__ = "exportaciones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lotes.id"), nullable=False)
    estudio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("estudios.id"), nullable=False)
    software_destino: Mapped[str] = mapped_column(String(50))  # tango, holistor, bejerman, csv_generico, rg3685
    formato: Mapped[str] = mapped_column(String(20))  # xlsx, txt, csv
    archivo_url: Mapped[Optional[str]] = mapped_column(Text)
    total_registros: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lote: Mapped["Lote"] = relationship("Lote", back_populates="exportaciones")
