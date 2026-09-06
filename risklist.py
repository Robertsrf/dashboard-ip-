"""Lee el Excel 'Lista de Clientes en Riesgo/Recuperados' (varias hojas) y lo
convierte a estructura JSON para mostrarlo en el sitio (pestaña dedicada).

Hay DOS formas de hoja y hay que distinguirlas, o la pestaña sale ilegible:

  * **Listas** (En Riesgo, Recuperados de cada mes, Riesgo x Vendedor/Sector):
    una sola tabla con encabezado reconocible ('#', 'Cliente', 'Vendedor',
    'Sector / Zona'). Se emiten como `{headers, rows}` y el buscador filtra.

  * **Narrativas** (Seguimiento (Resumen), Plan de Acción): NO son una tabla.
    El resumen mezcla una tira de KPIs, títulos de sección, tablas pequeñas y
    párrafos; el plan de acción es una tabla que empieza en la fila 2. Se
    emiten como `{blocks:[...]}` y el front las pinta bloque a bloque.
    Antes caían al `hidx = 1` de reserva, que tomaba el subtítulo como
    encabezado y dejaba toda la hoja reducida a una columna: se veían vacías.

Las celdas de los bloques se **compactan** (solo las no vacías, en orden). Eso
arregla el desfase de las celdas combinadas: en 'Plan de Acción' el encabezado
ocupa las columnas 0-4 y los datos las 0,1,3,4,5, así que leerlas por posición
desplaza cada valor una columna.
"""
import html as _html
import pandas as pd

def _fmt(v):
    if isinstance(v, float):
        if v != v:  # NaN
            return ""
        return f"{v:,.0f}" if abs(v - round(v)) < 1e-9 else f"{v:,.2f}"
    return str(v).strip()

def _celdas(fila):
    """Celdas no vacías de la fila, compactadas, en orden y ya escapadas."""
    out = []
    for x in fila:
        v = _fmt(x)
        if v and v.lower() != "nan":
            out.append(_html.escape(v))
    return out

def _bloques(raw, desde):
    """Convierte una hoja narrativa en bloques tipados. Una fila vacía separa
    bloques; una fila de una sola celda es un título o un párrafo; las filas de
    varias celdas se acumulan y al cerrarse se clasifican."""
    bloques, buf = [], []

    def cerrar():
        if not buf:
            return
        if all(len(r) == 2 for r in buf):
            bloques.append({"k": "pairs", "rows": list(buf)})
        elif len(buf) == 2 and len(buf[0]) >= 3 and len(buf[0]) == len(buf[1]):
            bloques.append({"k": "kpis", "rows": list(buf)})   # etiquetas + valores
        else:
            bloques.append({"k": "table", "rows": list(buf)})  # 1.a fila = encabezado
        buf.clear()

    for i in range(desde, len(raw)):
        c = _celdas(raw.iloc[i].tolist())
        if not c:
            cerrar()
        elif len(c) == 1:
            cerrar()
            t = c[0]
            # un párrafo es largo o cierra en punto; lo demás es un título
            bloques.append({"k": "text" if (len(t) > 120 or t.endswith(".")) else "head",
                            "t": t})
        else:
            buf.append(c)
    cerrar()
    return bloques

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
            # Hoja narrativa: no hay una tabla única que extraer.
            sub, desde = "", 1
            if len(raw) > 1:
                c1 = _celdas(raw.iloc[1].tolist())
                if len(c1) == 1:                 # la fila 1 es el subtítulo
                    sub, desde = c1[0], 2
            sheets[sh] = {"title": title, "sub": sub,
                          "blocks": _bloques(raw, desde), "count": 0}
            order.append(sh)
            continue
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
