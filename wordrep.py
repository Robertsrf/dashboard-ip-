"""Lee un informe Word subido a Drive: extrae un resumen (HTML) y devuelve el
archivo en base64 para incrustarlo cifrado y permitir su descarga tras login."""
import re, base64, html as _html
def extract(path):
    import docx
    d = docx.Document(path)
    paras = [p.text.strip() for p in d.paragraphs if p.text.strip()]
    summ = []; started = False
    for t in paras:
        up = t.upper()
        if not started:
            if "RESUMEN" in up: started = True
            continue
        if re.match(r'^\d+\.\s', t) or re.match(r'^\d+\.\d', t):
            if summ: break
            continue
        summ.append(t)
        if sum(len(x) for x in summ) > 1500: break
    if not summ:
        summ = [p for p in paras if len(p) > 40][:5]
    body = "".join(f"<p>{_html.escape(x)}</p>" for x in summ)
    b64 = base64.b64encode(open(path, "rb").read()).decode()
    return body, b64
