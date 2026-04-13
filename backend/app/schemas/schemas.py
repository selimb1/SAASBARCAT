import uuid
from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, field_validator
import re


# ── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    nombre_estudio: str
    nombre_usuario: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    usuario: "UsuarioOut"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Usuarios ────────────────────────────────────────────────────────────────

class UsuarioOut(BaseModel):
    id: uuid.UUID
    estudio_id: uuid.UUID
    nombre: str
    email: str
    rol: str

    model_config = {"from_attributes": True}


# ── Clientes ────────────────────────────────────────────────────────────────

class ClienteCreate(BaseModel):
    razon_social: str
    cuit: Optional[str] = None
    email: Optional[str] = None


class ClienteOut(BaseModel):
    id: uuid.UUID
    razon_social: str
    cuit: Optional[str]
    email: Optional[str]

    model_config = {"from_attributes": True}


# ── Lotes ───────────────────────────────────────────────────────────────────

class LoteCreate(BaseModel):
    cliente_id: Optional[uuid.UUID] = None
    nombre: Optional[str] = None


class LoteOut(BaseModel):
    id: uuid.UUID
    nombre: Optional[str]
    estado: str
    total_archivos: int
    procesados: int
    errores: int
    created_at: datetime
    completed_at: Optional[datetime]
    cliente: Optional[ClienteOut]

    model_config = {"from_attributes": True}


class LoteStats(BaseModel):
    total: int
    procesados: int
    aprobados: int
    con_alertas: int
    errores: int


# ── Comprobantes ─────────────────────────────────────────────────────────────

class ComprobanteUpdate(BaseModel):
    tipo_comprobante: Optional[str] = None
    punto_venta: Optional[str] = None
    numero_comprobante: Optional[str] = None
    fecha_emision: Optional[date] = None
    fecha_vencimiento_pago: Optional[date] = None
    cuit_emisor: Optional[str] = None
    razon_social_emisor: Optional[str] = None
    condicion_iva_emisor: Optional[str] = None
    cuit_receptor: Optional[str] = None
    razon_social_receptor: Optional[str] = None
    moneda: Optional[str] = None
    tipo_cambio: Optional[float] = None
    importe_neto_gravado: Optional[float] = None
    importe_exento: Optional[float] = None
    importe_no_gravado: Optional[float] = None
    iva_21: Optional[float] = None
    iva_105: Optional[float] = None
    iva_27: Optional[float] = None
    importe_percepciones: Optional[float] = None
    importe_retenciones: Optional[float] = None
    importe_total: Optional[float] = None
    cae: Optional[str] = None
    condicion_venta: Optional[str] = None
    concepto_descripcion: Optional[str] = None
    estado_revision: Optional[str] = None


class ComprobanteOut(BaseModel):
    id: uuid.UUID
    lote_id: uuid.UUID
    tipo_comprobante: Optional[str]
    codigo_afip: Optional[str]
    punto_venta: Optional[str]
    numero_comprobante: Optional[str]
    letra: Optional[str]
    fecha_emision: Optional[date]
    fecha_vencimiento_pago: Optional[date]
    cuit_emisor: Optional[str]
    razon_social_emisor: Optional[str]
    condicion_iva_emisor: Optional[str]
    cuit_receptor: Optional[str]
    razon_social_receptor: Optional[str]
    moneda: str
    tipo_cambio: Optional[float]
    importe_neto_gravado: float
    importe_exento: float
    importe_no_gravado: float
    iva_21: float
    iva_105: float
    iva_27: float
    importe_percepciones: float
    percepciones_detalle: Optional[Any]
    importe_retenciones: float
    retenciones_detalle: Optional[Any]
    importe_total: float
    cae: Optional[str]
    cae_vencimiento: Optional[date]
    condicion_venta: Optional[str]
    concepto_descripcion: Optional[str]
    confianza_global: Optional[float]
    confianza_por_campo: Optional[dict]
    alertas_validacion: Optional[list]
    estado_revision: str
    imagen_original_url: Optional[str]
    nombre_archivo_original: Optional[str]
    error_mensaje: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Exportación ──────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    software: str  # tango, holistor, bejerman, csv_generico, rg3685
    incluir_estados: list[str] = ["aprobado", "pendiente"]
    # Opcionales para Holistor
    cuenta_gasto_defecto: Optional[str] = None
    empresa_codigo: Optional[str] = "001"
    ejercicio: Optional[str] = None
    periodo: Optional[str] = None


class ExportResponse(BaseModel):
    exportacion_id: uuid.UUID
    software: str
    total_registros: int
    archivo_url: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard ────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    comprobantes_hoy: int
    comprobantes_mes: int
    lotes_activos: int
    precision_promedio: float
    tiempo_promedio_seg: float
    limite_mes: int
    usados_mes: int
