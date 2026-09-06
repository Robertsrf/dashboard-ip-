"""Lee un informe Word subido a Drive: extrae un resumen (HTML) y devuelve el
archivo en base64 para incrustarlo cifrado y permitir su descarga tras login.

El documento se recorre en **orden de documento** (parrafos y tablas
intercalados), no por `d.paragraphs`. Desde el 8.º corte el informe pone sus
hallazgos en TABLAS --30 de ellas-- y `d.paragraphs` no las ve: el resumen
quedaba en una frase suelta seguida de dos titulos de tabla sin nada debajo,
que es justamente lo que se mostraba en el panel del dashboard.

El resumen va desde el titulo que contiene "RESUMEN" hasta la siguiente seccion
numerada. Se renderiza con las clases del informe (`table.rt`, `.rbox`) para que
se vea igual que el informe generado.
"""
import re, base64, html as _html

# Tope del resumen renderizado. El 8.º corte usa ~2 600 caracteres; el margen
# es para que un informe con una tabla larga no infle el HTML cifrado.
_MAXLEN = 9000


def _limpio(s):
    """Texto de una celda en una sola linea, ya escapado."""
    return _html.escape(" ".join(x.strip() for x in str(s).split("\n") if x.strip()))


def _es_num(s):
    """Celda numerica (importe, %, delta): se alinea a la derecha."""
    return bool(s) and any(c.isdigit() for c in s) and not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}", s)


def _nota(txt):
    """Una tabla de una sola celda no es una tabla: es un recuadro de nota del
    informe («Diferencia respecto al 7.º corte», «Lectura del corte»...). La
    primera linea es el titulo; el resto, el cuerpo."""
    lineas = [x.strip() for x in str(txt).split("\n") if x.strip()]
    if not lineas:
        return ""
    cab = _html.escape(lineas[0])
    cuerpo = _html.escape(" ".join(lineas[1:]))
    return f'<div class="rbox rbox-i"><b>{cab}</b>' + (f"<br>{cuerpo}" if cuerpo else "") + "</div>"


def _tabla(t):
    filas = [[c.text for c in r.cells] for r in t.rows]
    if not filas:
        return ""
    if len(filas) == 1 and len(filas[0]) == 1:
        return _nota(filas[0][0])
    # Una tabla de una sola fila no tiene encabezado: es una tira de datos (la
    # de KPIs del 7.º corte). Con thead salia como cabecera y cuerpo vacio.
    cab = "".join(f"<th>{_limpio(c)}</th>" for c in filas[0]) if len(filas) > 1 else ""
    cuerpo = ""
    for f in (filas[1:] if len(filas) > 1 else filas):
        tds = ""
        for c in f:
            v = _limpio(c)
            tds += f'<td class="{"num" if _es_num(v) else ""}">{v}</td>'
        cuerpo += f"<tr>{tds}</tr>"
    thead = f"<thead><tr>{cab}</tr></thead>" if cab else ""
    return f'<table class="rt">{thead}<tbody>{cuerpo}</tbody></table>'


def _elementos(d):
    """Parrafos y tablas en el orden real del documento."""
    from docx.table import Table
    from docx.text.paragraph import Paragraph
    for ch in d.element.body.iterchildren():
        if ch.tag.endswith("}p"):
            yield "p", Paragraph(ch, d)
        elif ch.tag.endswith("}tbl"):
            yield "t", Table(ch, d)


def extract(path):
    import docx
    d = docx.Document(path)
    partes = []            # [(tipo, html, texto)]
    started = False
    for kind, obj in _elementos(d):
        if kind == "p":
            t = obj.text.strip()
            if not t:
                continue
            if not started:
                if "RESUMEN" in t.upper():
                    started = True
                continue
            # el resumen termina donde arranca la siguiente seccion numerada
            if re.match(r"^\d+\.\s", t) or re.match(r"^\d+\.\d", t):
                break
            partes.append(("p", f"<p>{_html.escape(t)}</p>", t))
        elif started:
            h = _tabla(obj)
            if h:
                partes.append(("t", h, ""))
        if sum(len(x[1]) for x in partes) > _MAXLEN:
            break
    # Un titulo de tabla al final queda huerfano: la tabla que rotula cayo fuera
    # del resumen. Se recorta. Los titulos con su tabla detras se quedan.
    _titulo = lambda t: len(t) < 90 and t[-1] not in ".!?:;"
    while partes and partes[-1][0] == "p" and _titulo(partes[-1][2]):
        partes.pop()
    if not partes:
        partes = [("p", f"<p>{_html.escape(p)}</p>", p)
                  for p in (x.text.strip() for x in d.paragraphs) if len(p) > 40][:5]
    body = "".join(x[1] for x in partes)
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    return body, b64
