"""
Exportador para Bejerman ERP.
Genera dos archivos CSV con punto y coma (;):
  - comprobantes.csv: módulo Comprobantes de Compra
  - asientos.csv: módulo Asientos Contables (opcional)
"""
import io
import csv
from datetime import date, datetime
from typing import Optional
from app.models.models import Comprobante

TIPO_MAP = {
    "A": ("FAC", "A"),
    "B": ("FAC", "B"),
    "C": ("FAC", "C"),
    "M": ("FAC", "M"),
    "E": ("FAC", "E"),
    "FCE_A": ("FCE", "A"),
    "FCE_B": ("FCE", "B"),
    "ND_A": ("ND", "A"),
    "ND_B": ("ND", "B"),
    "ND_C": ("ND", "C"),
    "NC_A": ("NC", "A"),
    "NC_B": ("NC", "B"),
    "NC_C": ("NC", "C"),
    "RECIBO": ("REC", "A"),
    "TICKET": ("TKT", ""),
    "REMITO": ("REM", "X"),
}

CONDICION_MAP = {
    "CONTADO": "CT",
    "CUENTA_CORRIENTE": "CC",
    "CREDITO": "CF",
    "OTRO": "CT",
}

MONEDA_MAP = {
    "ARS": "$",
    "USD": "U$S",
    "EUR": "EUR",
}


def _cuit_limpio(cuit: Optional[str]) -> str:
    if not cuit:
        return "00000000000"
    return cuit.replace("-", "")


def _fmt_fecha(d: Optional[date]) -> str:
    if not d:
        return ""
    return d.strftime("%d/%m/%Y")


def _v(valor) -> str:
    return f"{float(valor or 0):.2f}"


def _get_tipo_letra(comp: Comprobante) -> tuple[str, str]:
    tipo = comp.tipo_comprobante or ""
    return TIPO_MAP.get(tipo, ("FAC", "B"))


def generar_bejerman_comprobantes(
    comprobantes: list[Comprobante],
    empresa_codigo: str = "001",
    ejercicio: Optional[str] = None,
    periodo: Optional[str] = None,
) -> bytes:
    """
    Genera CSV de comprobantes de compra para Bejerman.
    """
    if not ejercicio:
        ejercicio = str(datetime.now().year)
    if not periodo:
        periodo = datetime.now().strftime("%m")

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    # Cabecera
    writer.writerow([
        "EMPRESA", "EJERCICIO", "PERIODO", "TIPO_COMP", "LETRA",
        "PTO_VTA", "NRO_COMP", "FECHA", "CUIT", "RAZON_SOCIAL",
        "NETO_GRAVADO", "IVA_21", "IVA_105", "IVA_27",
        "EXENTO", "NO_GRAVADO", "PERC_IVA", "PERC_IIBB",
        "RETENCIONES", "TOTAL", "CAE", "MONEDA", "COTIZACION",
        "CONDICION", "OBSERVACIONES"
    ])

    for comp in comprobantes:
        tipo, letra = _get_tipo_letra(comp)
        ptovta = (comp.punto_venta or "0001").zfill(4)
        nrocomp = (comp.numero_comprobante or "0").zfill(8)

        perc_iva = "0.00"
        perc_iibb = "0.00"
        if comp.percepciones_detalle:
            for p in comp.percepciones_detalle:
                if p.get("tipo") == "IVA":
                    perc_iva = f"{float(p.get('importe', 0)):.2f}"
                elif p.get("tipo") == "IIBB":
                    perc_iibb = f"{float(p.get('importe', 0)):.2f}"
        elif float(comp.importe_percepciones or 0) > 0:
            perc_iibb = _v(comp.importe_percepciones)

        writer.writerow([
            empresa_codigo,
            ejercicio,
            periodo,
            tipo,
            letra,
            ptovta,
            nrocomp,
            _fmt_fecha(comp.fecha_emision),
            _cuit_limpio(comp.cuit_emisor),
            (comp.razon_social_emisor or "")[:60],
            _v(comp.importe_neto_gravado),
            _v(comp.iva_21),
            _v(comp.iva_105),
            _v(comp.iva_27),
            _v(comp.importe_exento),
            _v(comp.importe_no_gravado),
            perc_iva,
            perc_iibb,
            _v(comp.importe_retenciones),
            _v(comp.importe_total),
            comp.cae or "",
            MONEDA_MAP.get(comp.moneda or "ARS", "$"),
            f"{float(comp.tipo_cambio or 1.0):.4f}",
            CONDICION_MAP.get(comp.condicion_venta or "CONTADO", "CT"),
            "",
        ])

    return output.getvalue().encode("utf-8-sig")  # BOM para Excel


def generar_bejerman_asientos(
    comprobantes: list[Comprobante],
    empresa_codigo: str = "001",
    ejercicio: Optional[str] = None,
    periodo: Optional[str] = None,
    cuenta_gasto_defecto: str = "51010100",
) -> bytes:
    """
    Genera CSV de asientos contables para Bejerman.
    """
    if not ejercicio:
        ejercicio = str(datetime.now().year)
    if not periodo:
        periodo = datetime.now().strftime("%m")

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    writer.writerow([
        "EMPRESA", "EJERCICIO", "PERIODO", "NRO_ASIENTO",
        "FECHA", "CUENTA", "DESCRIPCION", "DEBE", "HABER",
        "CC", "AUXILIAR", "COMPROBANTE"
    ])

    for idx, comp in enumerate(comprobantes, 1):
        nro_asiento = str(idx).zfill(6)
        tipo, letra = _get_tipo_letra(comp)
        ptovta = (comp.punto_venta or "0001").zfill(4)
        nrocomp = (comp.numero_comprobante or "0").zfill(8)
        ref_comp = f"{tipo}-{letra} {ptovta}-{nrocomp}".strip("- ")
        fecha = _fmt_fecha(comp.fecha_emision)
        cuit_aux = _cuit_limpio(comp.cuit_emisor)
        total = float(comp.importe_total or 0)

        # Débito: Gasto / Mercadería
        if float(comp.importe_neto_gravado or 0) > 0:
            writer.writerow([
                empresa_codigo, ejercicio, periodo, nro_asiento,
                fecha, cuenta_gasto_defecto,
                f"COMPRA {ref_comp}"[:50],
                f"{float(comp.importe_neto_gravado or 0):.2f}", "0.00",
                "", cuit_aux, ref_comp
            ])

        # Débito: IVA Crédito Fiscal 21%
        if float(comp.iva_21 or 0) > 0:
            writer.writerow([
                empresa_codigo, ejercicio, periodo, nro_asiento,
                fecha, "11050100",
                f"IVA CF 21% {ref_comp}"[:50],
                f"{float(comp.iva_21):.2f}", "0.00",
                "", "", ref_comp
            ])

        # Débito: IVA Crédito Fiscal 10.5%
        if float(comp.iva_105 or 0) > 0:
            writer.writerow([
                empresa_codigo, ejercicio, periodo, nro_asiento,
                fecha, "11050200",
                f"IVA CF 10.5% {ref_comp}"[:50],
                f"{float(comp.iva_105):.2f}", "0.00",
                "", "", ref_comp
            ])

        # Percepción IIBB (débito)
        if float(comp.importe_percepciones or 0) > 0:
            writer.writerow([
                empresa_codigo, ejercicio, periodo, nro_asiento,
                fecha, "11050300",
                f"PERC CF {ref_comp}"[:50],
                f"{float(comp.importe_percepciones):.2f}", "0.00",
                "", "", ref_comp
            ])

        # Haber: Proveedores a Pagar
        writer.writerow([
            empresa_codigo, ejercicio, periodo, nro_asiento,
            fecha, "21010100",
            f"PROV A PAGAR {ref_comp}"[:50],
            "0.00", f"{total:.2f}",
            "", cuit_aux, ref_comp
        ])

    return output.getvalue().encode("utf-8-sig")
