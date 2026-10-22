"""Arma la pagina de una empresa: armazon + estilos + motor + nucleo + modulo de
la empresa + puerta del grupo + paquetes cifrados, todo en un solo HTML.

El HTML es un solo archivo a proposito: GitHub Pages lo sirve tal cual, se
puede guardar y abrir sin conexion, y los datos van cifrados dentro.
Los datos y la configuracion viajan en <script type="application/json">: no se
ejecutan y no necesitan permiso extra en la CSP. Cada <script> ejecutable lleva
su hash sha256 en la CSP de la propia pagina (METODO.md, seguridad).
"""
import base64
import hashlib
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(RAIZ, "app")


def _leer(*partes):
    with open(os.path.join(*partes), encoding="utf-8") as f:
        return f.read()


def json_seguro(obj):
    """JSON que no puede cerrar un <script>: '<' va como \\u003c."""
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def _csp(html):
    """Hash de cada <script> en linea ejecutable (los JSON no cuentan)."""
    hashes = []
    for m in re.finditer(r"<script(?![^>]*type=\"application/json\")(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S):
        h = base64.b64encode(hashlib.sha256(m.group(1).encode("utf-8")).digest()).decode()
        hashes.append(f"'sha256-{h}'")
    # Solo lo que se usa: los scripts en linea por hash y ECharts desde el propio
    # sitio ('self'); estilos en linea (ECharts los pone) y las fuentes de Google.
    # frame-ancestors no vale dentro de <meta> y GitHub Pages no deja poner
    # cabeceras: el anti-enmarcado lo hace core.js al arrancar.
    return ("default-src 'none'; "
            f"script-src {' '.join(hashes)} 'self'; "
            "style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; "
            "img-src 'self' data: blob:; connect-src 'self' data: blob:; "
            "base-uri 'none'; form-action 'none'")


def puerta(clave, acento, logo_html, nombre):
    return (_leer(APP, "puerta.html").replace("__PUERTA_AQUI__", clave)
            .replace("__PUERTA_ACENTO__", acento).replace("__PUERTA_LOGO__", logo_html)
            .replace("__PUERTA_NOMBRE__", nombre))


def construir(cfg, enc, enc_r, version, extra=None):
    """cfg: {clave, nombre, titulo, acento, logo_html, puerta_logo, favicon, modulo,
    shell?, estilos?} (shell y estilos cambian solo en piezas con armazon propio). enc /
    enc_r: salidas de secure.encrypt_bytes (enc_r puede ser None). extra: datos
    publicos que el modulo necesita antes del PIN (p. ej. el mapa de Venezuela)."""
    html = _leer(APP, cfg.get("shell", "shell.html"))
    reemplazos = {
        "__TITULO__": cfg["titulo"], "__FAVICON__": cfg["favicon"], "__EMPRESA__": cfg["clave"],
        "__CSS__": "\n".join(_leer(APP, f) for f in cfg.get("estilos", ["core.css"])),
        "__PUERTA__": puerta(cfg["clave"], cfg["acento"], cfg["puerta_logo"], cfg["nombre"]),
        "__LOGO__": cfg["logo_html"],
        "__CFG__": json_seguro({k: v for k, v in cfg.items() if k in ("clave", "nombre", "titulo", "acento", "modulo")}),
        "__EXTRA__": json_seguro(extra or {}),
        "__ENC__": json_seguro(enc), "__ENC_R__": json_seguro(enc_r),
        "__JS_MOTOR__": _leer(APP, "motor.js"), "__JS_CORE__": _leer(APP, "core.js"),
        "__JS_EMPRESA__": _leer(APP, cfg["modulo"]),
        # la huella completa lleva IDs de Drive: en claro solo va su hash (la
        # huella entera viaja dentro del paquete cifrado, en meta.version)
        "__VERSION__": hashlib.sha256(version.encode("utf-8")).hexdigest()[:16],
    }
    for marca, valor in reemplazos.items():
        html = html.replace(marca, valor)
    restos = sorted(set(re.findall(r"__[A-Z][A-Z_]+__", html)) - {"__CSP__"})
    if restos:
        raise SystemExit(f"Quedaron marcadores sin reemplazar: {restos}")
    return html.replace("__CSP__", _csp(html))


def escribir(ruta, html):
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
