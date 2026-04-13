"""
Pipeline de IA para extracción de comprobantes argentinos.
Etapas: Pre-procesado imagen → OCR → Gemini 2.5 Flash → Validación
"""
import base64
import json
import re
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime
import cv2
import numpy as np
from PIL import Image
import fitz  # PyMuPDF
import google.generativeai as genai
from app.core.config import get_settings
from app.core.security import validar_cuit

logger = logging.getLogger(__name__)
settings = get_settings()

# Configurar Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)


SYSTEM_PROMPT = """Eres un experto en documentos fiscales argentinos con profundo conocimiento de:
- Normativa AFIP: RG 1415, RG 3685, RG 4291 (FCE MiPyMEs)
- Tipos de comprobantes: A, B, C, M, E, FCE, ND, NC, Tickets, Recibos, Remitos
- Códigos AFIP: 01=Fac.A, 06=Fac.B, 11=Fac.C, 51=FCE-A, 81/82/83=Tique
- Alícuotas IVA válidas: 0%, 10.5%, 21%, 27%
- CUIT formato XX-XXXXXXXX-X con dígito verificador módulo 11
- CAE: exactamente 14 dígitos numéricos (al pie del comprobante)

Tu tarea: extraer información estructurada de comprobantes argentinos.
SIEMPRE devolvé JSON válido. Si un campo no es visible → null (nunca inventes datos).
Asigná score de confianza 0.0-1.0 por campo en metadata_extraccion.confianza_por_campo."""

USER_PROMPT_TEMPLATE = """Analiza este comprobante fiscal argentino y extraé todos los datos visibles.

INSTRUCCIONES:
1. tipo_comprobante: determina A/B/C/M/E/FCE_A/FCE_B/ND_A/ND_B/ND_C/NC_A/NC_B/NC_C/RECIBO/TICKET/REMITO
   - Sin CUIT receptor visible → probablemente B o TICKET
   - Con QR AFIP → electrónico
2. cuit_emisor: formato XX-XXXXXXXX-X. Si aparece sin guiones (20123456789) → formatealo
3. importe_total: debe ser ≥ neto + IVAs + percepciones. Tolerancia ±$1 para redondeos
4. cae: exactamente 14 dígitos, junto a texto "CAE" al pie del comprobante
5. Si hay múltiples alícuotas → completar iva_21 E iva_105 por separado

Devolvé SOLO el JSON, sin texto adicional:
{
  "tipo_comprobante": null,
  "codigo_afip": null,
  "punto_venta": null,
  "numero_comprobante": null,
  "fecha_emision": null,
  "fecha_vencimiento_pago": null,
  "cuit_emisor": null,
  "razon_social_emisor": null,
  "condicion_iva_emisor": null,
  "cuit_receptor": null,
  "razon_social_receptor": null,
  "moneda": "ARS",
  "tipo_cambio": null,
  "importe_neto_gravado": null,
  "importe_exento": null,
  "importe_no_gravado": null,
  "iva_21": null,
  "iva_105": null,
  "iva_27": null,
  "importe_percepciones": null,
  "percepciones_detalle": null,
  "importe_retenciones": null,
  "retenciones_detalle": null,
  "importe_total": null,
  "cae": null,
  "cae_vencimiento": null,
  "condicion_venta": null,
  "concepto_descripcion": null,
  "metadata_extraccion": {
    "confianza_global": 0.0,
    "confianza_por_campo": {},
    "requiere_revision_humana": true,
    "alertas": [],
    "imagen_calidad": "MEDIA"
  }
}"""


def preprocess_image(image_path: str) -> np.ndarray:
    """
    Pipeline de pre-procesamiento de imagen para mejorar OCR.
    Pasos: deskew → shadow removal → denoising → enhancement.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"No se pudo leer la imagen: {image_path}")

    # 1. Deskew (corrección de inclinación)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    coords = np.column_stack(np.where(gray < 200))
    if len(coords) > 100:
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        if abs(angle) > 0.5:
            (h, w) = img.shape[:2]
            center = (w // 2, h // 2)
            M = cv2.getRotationMatrix2D(center, angle, 1.0)
            img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC,
                                 borderMode=cv2.BORDER_REPLICATE)

    # 2. Shadow removal (eliminación de sombras)
    rgb_planes = cv2.split(img)
    result_planes = []
    for plane in rgb_planes:
        dilated = cv2.dilate(plane, np.ones((7, 7), np.uint8))
        bg = cv2.medianBlur(dilated, 21)
        diff = 255 - cv2.absdiff(plane, bg)
        norm = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
        result_planes.append(norm)
    img = cv2.merge(result_planes)

    # 3. Denoising
    img = cv2.fastNlMeansDenoisingColored(img, None, 10, 10, 7, 21)

    # 4. Sharpening
    kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
    img = cv2.filter2D(img, -1, kernel)

    return img


def extract_text_from_pdf(pdf_path: str) -> Optional[str]:
    """
    Intenta extraer texto nativo de un PDF (para PDFs electrónicos AFIP).
    Retorna None si el PDF es una imagen escaneada.
    """
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        if len(text.strip()) > 50:  # Tiene texto real
            return text
        return None
    except Exception:
        return None


def image_to_base64(image_path: str) -> str:
    """Convierte imagen a base64 para enviar a Gemini."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


async def extract_with_gemini(image_path: str, ocr_text: Optional[str] = None) -> dict:
    """
    Envía la imagen/texto a Gemini 2.5 Flash para extraer datos estructurados.
    """
    model = genai.GenerativeModel(settings.GEMINI_MODEL)

    # Preparar el prompt
    user_prompt = USER_PROMPT_TEMPLATE
    if ocr_text:
        user_prompt = f"TEXTO OCR PRE-EXTRAÍDO:\n{ocr_text[:3000]}\n\n" + user_prompt

    try:
        # Leer imagen
        ext = Path(image_path).suffix.lower()
        mime_type = "image/jpeg" if ext in (".jpg", ".jpeg") else "image/png" if ext == ".png" else "application/pdf"

        with open(image_path, "rb") as f:
            image_data = f.read()

        response = model.generate_content(
            [
                SYSTEM_PROMPT,
                user_prompt,
                {"mime_type": mime_type, "data": image_data},
            ],
            generation_config={
                "temperature": 0.1,
                "max_output_tokens": 2048,
            },
        )

        text = response.text.strip()

        # Limpiar markdown si viene con backticks
        if text.startswith("```"):
            text = re.sub(r"```(?:json)?\n?", "", text).strip().rstrip("```").strip()

        data = json.loads(text)
        return data

    except json.JSONDecodeError as e:
        logger.error(f"Error parseando JSON de Gemini: {e}")
        return _empty_result(f"Error parseando respuesta IA: {e}")
    except Exception as e:
        logger.error(f"Error llamando a Gemini: {e}")
        raise


def validate_extraction(data: dict) -> list[str]:
    """
    Valida los datos extraídos y retorna lista de alertas.
    """
    alertas = []

    # Validar suma de importes
    neto = float(data.get("importe_neto_gravado") or 0)
    iva21 = float(data.get("iva_21") or 0)
    iva105 = float(data.get("iva_105") or 0)
    iva27 = float(data.get("iva_27") or 0)
    exento = float(data.get("importe_exento") or 0)
    no_grav = float(data.get("importe_no_gravado") or 0)
    percs = float(data.get("importe_percepciones") or 0)
    retenc = float(data.get("importe_retenciones") or 0)
    total = float(data.get("importe_total") or 0)

    calculado = neto + iva21 + iva105 + iva27 + exento + no_grav + percs - retenc
    if total > 0 and abs(calculado - total) > 1.5:
        alertas.append(f"Diferencia en importes: calculado={calculado:.2f}, declarado={total:.2f}")

    # Validar CUITs
    for campo in ["cuit_emisor", "cuit_receptor"]:
        cuit = data.get(campo)
        if cuit and not validar_cuit(cuit):
            alertas.append(f"{campo} inválido: {cuit}")

    # Validar CAE
    cae = data.get("cae")
    if cae and (not str(cae).isdigit() or len(str(cae)) != 14):
        alertas.append(f"CAE inválido: debe tener exactamente 14 dígitos (obtenido: {cae})")

    # Validar fecha
    fecha_str = data.get("fecha_emision")
    if fecha_str:
        try:
            fecha = datetime.strptime(fecha_str, "%d/%m/%Y")
            if fecha.year < 2000 or fecha > datetime.now():
                alertas.append(f"Fecha sospechosa: {fecha_str}")
        except ValueError:
            alertas.append(f"Formato de fecha inválido: {fecha_str}")

    # Calcular confianza global
    campos_criticos = ["tipo_comprobante", "fecha_emision", "cuit_emisor", "importe_total"]
    campos_presentes = sum(1 for c in campos_criticos if data.get(c) is not None)
    confianza = campos_presentes / len(campos_criticos)

    meta = data.get("metadata_extraccion", {})
    meta["alertas"] = alertas
    meta["confianza_global"] = max(confianza, meta.get("confianza_global", 0))
    meta["requiere_revision_humana"] = len(alertas) > 0 or confianza < 0.75
    data["metadata_extraccion"] = meta

    return alertas


def _empty_result(error_msg: str) -> dict:
    return {
        "tipo_comprobante": None,
        "metadata_extraccion": {
            "confianza_global": 0.0,
            "requiere_revision_humana": True,
            "alertas": [error_msg],
            "imagen_calidad": "MUY_BAJA",
        },
    }


async def process_file(file_path: str, filename: str) -> dict:
    """
    Proceso completo: pre-procesado → OCR → Gemini → Validación.
    Retorna el diccionario de datos extraídos.
    """
    ext = Path(file_path).suffix.lower()
    processed_path = file_path

    # 1. Si es PDF, intentar extracción de texto nativo
    native_text = None
    if ext == ".pdf":
        native_text = extract_text_from_pdf(file_path)
        if native_text:
            logger.info(f"PDF nativo detectado para {filename}, usando texto directo")

    # 2. Pre-procesar imagen si no es PDF con texto nativo
    if not native_text and ext in (".jpg", ".jpeg", ".png", ".heic", ".webp"):
        try:
            processed = preprocess_image(file_path)
            processed_path = file_path.replace(ext, "_processed.jpg")
            cv2.imwrite(processed_path, processed)
        except Exception as e:
            logger.warning(f"Error en pre-procesado: {e}, usando imagen original")
            processed_path = file_path

    # 3. Llamar a Gemini
    data = await extract_with_gemini(
        image_path=processed_path if not native_text else file_path,
        ocr_text=native_text,
    )

    # 4. Validar datos extraídos
    validate_extraction(data)

    return data
