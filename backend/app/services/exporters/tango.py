"""
Exportador para Tango Gestión.
Genera archivo TXT delimitado por pipe (|) para importar al módulo
Comprobantes a Pagar / Compras de Tango Gestión.
"""
import io
from datetime import date
from typing import Optional
from app.models.models import Comprobante

TIPODOC_MAP = {
    "A": "FAC-A",
    "B": "FAC-B",
    "C": "FAC-C",
    "M": "FAC-M",
    "E": "FAC-E",
    "FCE_A": "FCE-A",
    "FCE_B": "FCE-B",
    "ND_A": "ND-A",
    "ND_B": "ND-B",
    "ND_C": "ND-C",
    "NC_A": "NC-A",
    "NC_B": "NC-B",
    "NC_C": "NC-C",
    "RECIBO": "REC",
    "TICKET": "TKT",
    "REMITO": "REM",
}

CONDVTA_MAP = {
    "CONTADO": "CT",
    "CUENTA_CORRIENTE": "CC",
    "CREDITO": "CF",
    "OTRO": "CT",
}

MONEDA_MAP = {
    "ARS": "$",
    "USD": "U$S",
    "EUR": "EUR",
    "BRL": "BRL",
    "UYU": "UYU",
}


def _fmt_cuit(cuit: Optional[str]) -> str:
    """Formatea CUIT quitando guiones."""
    if not cuit:
        return "00000000000"
    return cuit.replace("-", "")


def _fmt_fecha(d: Optional[date]) -> str:
    if not d:
        return ""
    return d.strftime("%Y%m%d")


def _fmt_num(valor: Optional[float]) -> str:
    if valor is None:
        return "0.00"
    return f"{float(valor):.2f}"


def _get_tipodoc(comp: Comprobante) -> str:
    tipo = comp.tipo_comprobante or ""
    # Si tiene letra separada
    if tipo in ("A", "B", "C", "M", "E"):
        return f"FAC-{tipo}"
    return TIPODOC_MAP.get(tipo, "FAC-B")


def generar_tango(comprobantes: list[Comprobante]) -> bytes:
    """
    Genera el contenido del archivo TXT para Tango Gestión.
    Formato: pipe-delimitado, una línea por comprobante.
    """
    output = io.StringIO()

    # Cabecera
    cabecera = (
        "TIPODOC|FECHA|CUIT|RAZSOC|PTOVTA|NROCOMP|"
        "NETO|ALIIVA1|MTOIVA1|ALIIVA2|MTOIVA2|"
        "EXENTO|NOGRAVADO|PERC_IVA|PERC_IIBB|"
        "TOTAL|CAE|CONDVTA|MONEDA|COTIZ"
    )
    output.write(cabecera + "\n")

    for comp in comprobantes:
        tipodoc = _get_tipodoc(comp)
        fecha = _fmt_fecha(comp.fecha_emision)
        cuit = _fmt_cuit(comp.cuit_emisor)
        razsoc = (comp.razon_social_emisor or "").replace("|", " ").replace("\n", " ")[:60]
        ptovta = (comp.punto_venta or "0001").zfill(4)
        nrocomp = (comp.numero_comprobante or "0").zfill(8)
        neto = _fmt_num(comp.importe_neto_gravado)
        iva21 = "21" if float(comp.iva_21 or 0) > 0 else "0"
        mtoiva1 = _fmt_num(comp.iva_21)
        iva105 = "10.5" if float(comp.iva_105 or 0) > 0 else "0"
        mtoiva2 = _fmt_num(comp.iva_105)
        exento = _fmt_num(comp.importe_exento)
        nograv = _fmt_num(comp.importe_no_gravado)

        # Percepciones: separar IVA e IIBB si hay detalle
        perc_iva = "0.00"
        perc_iibb = "0.00"
        if comp.percepciones_detalle:
            for p in comp.percepciones_detalle:
                if p.get("tipo") == "IVA":
                    perc_iva = _fmt_num(p.get("importe", 0))
                elif p.get("tipo") == "IIBB":
                    perc_iibb = _fmt_num(p.get("importe", 0))
        elif float(comp.importe_percepciones or 0) > 0:
            perc_iibb = _fmt_num(comp.importe_percepciones)

        total = _fmt_num(comp.importe_total)
        cae = comp.cae or ""
        condvta = CONDVTA_MAP.get(comp.condicion_venta or "CONTADO", "CT")
        moneda = MONEDA_MAP.get(comp.moneda or "ARS", "$")
        cotiz = _fmt_num(comp.tipo_cambio or 1.0)

        linea = (
            f"{tipodoc}|{fecha}|{cuit}|{razsoc}|{ptovta}|{nrocomp}|"
            f"{neto}|{iva21}|{mtoiva1}|{iva105}|{mtoiva2}|"
            f"{exento}|{nograv}|{perc_iva}|{perc_iibb}|"
            f"{total}|{cae}|{condvta}|{moneda}|{cotiz}"
        )
        output.write(linea + "\n")

    return output.getvalue().encode("latin-1", errors="replace")
