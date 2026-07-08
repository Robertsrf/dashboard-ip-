"""Lee el Excel 'Lista de Clientes en Riesgo/Recuperados' (varias hojas) y lo
convierte a estructura JSON para mostrarlo en el sitio (pestaña dedicada)."""
import pandas as pd

def _fmt(v):
    if isinstance(v, float):
        if v != v:  # NaN
            return ""
        return f"{v:,.0f}" if abs(v - round(v)) < 1e-9 else f"{v:,.2f}"
    return str(v).strip()

def load(path):
    xls = pd.ExcelFile(path, engine="openpyxl")
    order = []; sheets = {}
    for sh in xls.sheet_names:
        if "ÍNDICE" in sh.upper() or "INDICE" in sh.upper():
            continue
        raw = pd.read_excel(xls, sheet_name=sh, header=None)
        if raw.empty:
            continue
        title = _fmt(raw.iloc[0, 0])
        # fila de encabezados = primera con '#','Cliente' o 'Vendedor'
        hidx = None
        for i in range(min(4, len(raw))):
            vals = [_fmt(x) for x in raw.iloc[i].tolist()]
            if "#" in vals or "Cliente" in vals or "Vendedor" in vals or "Sector / Zona" in vals:
                hidx = i; break
        if hidx is None:
            hidx = 1
        headers = [_fmt(x).replace("\n", " ") for x in raw.iloc[hidx].tolist()]
        keep = [j for j in range(len(headers)) if headers[j] and headers[j].lower() != "nan"]
        headers = [headers[j] for j in keep]
        rows = []
        for _, r in raw.iloc[hidx + 1:].iterrows():
            vals = [_fmt(r.iloc[j]) if j < len(r) else "" for j in keep]
            if any(x for x in vals):
                rows.append(vals)
        # nombre corto de pestaña (sin conteo largo)
        sheets[sh] = {"title": title, "headers": headers, "rows": rows, "count": len(rows)}
        order.append(sh)
    return {"order": order, "sheets": sheets}
