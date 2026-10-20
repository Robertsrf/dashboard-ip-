"""Novedades del sistema (changelog.json): todas las versiones desde el 2026-07-07.

Regla (METODO.md): cada cambio de codigo suma una entrada. El build lo vigila:
`verificar()` compara la huella del codigo actual con la de la ultima entrada
que no es un corte y, si no coinciden, no publica. Los cortes de datos los
agrega el propio build con `corte()` y no cambian la version.

    python -m grupo.changelog nueva mejora "Titulo" "detalle 1" "detalle 2" --empresas ip,caleb
    python -m grupo.changelog sellar      # mismo cambio, codigo retocado
    python -m grupo.changelog verificar
"""
import datetime as dt
import hashlib
import json
import os
import re
import sys

TIPOS = {"version", "nuevo", "mejora", "arreglo", "seguridad", "corte"}
EMPRESAS = {"grupo", "ip", "caleb", "reviplas"}
# Lo que cuenta como "codigo del sistema": si cambia, hace falta entrada nueva
CODIGO = ["app", "grupo", "build_dashboard.py", "build_caleb.py", "cobranza.py", "risklist.py",
          "wordrep.py", "reports.py", "secure.py", "caleb_clean.py"]


class SinEntrada(Exception):
    """El codigo cambio y Novedades no tiene una entrada que lo cuente."""


def _archivos(raiz):
    for item in CODIGO:
        p = os.path.join(raiz, item)
        if os.path.isfile(p):
            yield item, p
        elif os.path.isdir(p):
            for base, dirs, nombres in os.walk(p):
                dirs[:] = sorted(d for d in dirs if d != "__pycache__")
                for n in sorted(nombres):
                    if n.endswith((".py", ".js", ".css", ".html")):
                        full = os.path.join(base, n)
                        yield os.path.relpath(full, raiz).replace(os.sep, "/"), full


def huella(raiz):
    """sha256 del codigo, con finales de linea normalizados (git en Windows
    convierte LF/CRLF y eso no es un cambio)."""
    h = hashlib.sha256()
    for nombre, ruta in sorted(_archivos(raiz)):
        h.update(nombre.encode())
        h.update(open(ruta, "rb").read().replace(b"\r\n", b"\n"))
    return h.hexdigest()[:16]


def validar(datos):
    for e in datos["entradas"]:
        if e.get("tipo") not in TIPOS:
            raise ValueError(f"tipo invalido: {e.get('tipo')!r} en {e.get('titulo')!r}")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", e.get("fecha", "")):
            raise ValueError(f"fecha invalida: {e.get('fecha')!r}")
        if not re.fullmatch(r"\d+\.\d+\.\d+", e.get("v", "")):
            raise ValueError(f"version invalida: {e.get('v')!r}")
        if not e.get("titulo") or not set(e.get("empresas", [])) <= EMPRESAS:
            raise ValueError(f"entrada incompleta: {e!r}")
    return datos


def cargar(ruta):
    with open(ruta, encoding="utf-8") as f:
        return validar(json.load(f))


def _guardar(ruta, datos):
    datos["entradas"].sort(key=lambda e: e["fecha"], reverse=True)   # estable: respeta el orden del dia
    validar(datos)
    with open(ruta, "w", encoding="utf-8", newline="\n") as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
        f.write("\n")


def _vigente(datos):
    return max((tuple(map(int, e["v"].split("."))) for e in datos["entradas"]), default=(0, 0, 0))


def _subir(v, tipo):
    mayor, menor, parche = v
    if tipo == "version":
        return f"{mayor + 1}.0.0"
    if tipo in ("nuevo", "mejora", "seguridad"):
        return f"{mayor}.{menor + 1}.0"
    return f"{mayor}.{menor}.{parche + 1}"


def nueva(ruta, raiz, tipo, titulo, detalle, empresas, fecha=None):
    if tipo == "corte":
        raise ValueError("los cortes los agrega el build con corte()")
    datos = cargar(ruta)
    entrada = {"v": _subir(_vigente(datos), tipo), "fecha": fecha or dt.date.today().isoformat(),
               "tipo": tipo, "empresas": list(empresas), "titulo": titulo, "detalle": list(detalle),
               "huella": huella(raiz)}
    datos["entradas"].insert(0, entrada)
    _guardar(ruta, datos)
    return entrada


def _ultima_de_codigo(datos):
    return next((e for e in datos["entradas"] if e["tipo"] != "corte"), None)


def sellar(ruta, raiz):
    datos = cargar(ruta)
    e = _ultima_de_codigo(datos)
    e["huella"] = huella(raiz)
    _guardar(ruta, datos)


def verificar(ruta, raiz):
    e = _ultima_de_codigo(cargar(ruta))
    actual = huella(raiz)
    if not e or e.get("huella") != actual:
        raise SinEntrada(
            "El codigo cambio y Novedades no lo cuenta. Agrega la entrada antes de publicar:\n"
            '  python -m grupo.changelog nueva <nuevo|mejora|arreglo|seguridad|version> "Titulo" "detalle" '
            "--empresas ip\n(o, si es el mismo cambio retocado: python -m grupo.changelog sellar)")
    return actual


def corte(ruta, empresa, numero, datos_al, detalle, fecha=None):
    """Entrada de corte de datos (la agrega el build). La clave es (empresa,
    numero): un corte puede traer informes nuevos con las mismas ventas que el
    anterior. Regenerar el mismo corte actualiza su texto sin moverlo de fecha
    ni de version. Sin cifras en dolares: la ve tambien el modo reunion."""
    datos = cargar(ruta)
    nombre = {"ip": "IP", "caleb": "Tiendas Caleb"}.get(empresa, empresa)
    d = datos_al.split("-")
    nuevo = {"datos_al": datos_al, "detalle": list(detalle),
             "titulo": f"Corte {numero} · {nombre} · datos al {d[2]}-{d[1]}-{d[0]}"}
    previa = next((e for e in datos["entradas"] if e["tipo"] == "corte"
                   and e.get("empresas") == [empresa] and e.get("corte") == numero), None)
    if previa:
        previa.update(nuevo)
    else:
        datos["entradas"].insert(0, dict(
            {"v": ".".join(map(str, _vigente(datos))), "fecha": fecha or dt.date.today().isoformat(),
             "tipo": "corte", "empresas": [empresa], "corte": numero}, **nuevo))
    _guardar(ruta, datos)


def _main(argv):
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ruta = os.path.join(raiz, "changelog.json")
    if not argv:
        raise SystemExit(__doc__)
    cmd, resto = argv[0], argv[1:]
    if cmd == "verificar":
        print("OK, huella", verificar(ruta, raiz))
    elif cmd == "sellar":
        sellar(ruta, raiz)
        print("Sellada la ultima entrada con", huella(raiz))
    elif cmd == "nueva":
        emp = ["grupo"]
        if "--empresas" in resto:
            i = resto.index("--empresas")
            emp = resto[i + 1].split(",")
            resto = resto[:i] + resto[i + 2:]
        e = nueva(ruta, raiz, resto[0], resto[1], resto[2:], emp)
        print(f"Entrada {e['v']} · {e['titulo']}")
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    _main(sys.argv[1:])
