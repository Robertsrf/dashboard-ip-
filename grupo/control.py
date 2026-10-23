"""Controles que respaldan la lamina «¿Por qué creerle a los números?».

Se calculan en el build y viajan en meta["controles"], tambien en el paquete de
reunion: solo conteos y huellas, nunca el total en $. Lo que no cuadra no se
publica: si el cuadre o las pruebas fallan, el build se detiene.

  cuadre  -> el mismo conteo por tres caminos independientes
  pasado  -> los meses que el corte anterior ya tenia cerrados, mes por mes
  pruebas -> las dos baterias de pruebas automaticas, corridas en este build
"""
import calendar
import glob
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np

from grupo import paquete as PAQ

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# La foto mes a mes de cada corte trae cifras: vive en local (gitignore history*.json)
FOTOS = os.path.join(RAIZ, "history_meses.json")


def huella(centavos):
    """SHA-256 del total en centavos, 8 caracteres. Se puede proyectar sin revelar
    la cifra, y un solo centavo distinto da otra huella. app/reunion.js la
    recalcula igual en el navegador."""
    h = hashlib.sha256(str(int(centavos)).encode()).hexdigest()[:8].upper()
    return h[:4] + " " + h[4:]


def _cuenta(lineas, facturas, clientes, productos, centavos):
    return {"lineas": int(lineas), "facturas": int(facturas), "clientes": int(clientes),
            "productos": int(productos), "venta": huella(centavos)}


def desde_excel(df):
    """Camino 1: el Excel tal como lo exporta el sistema de facturacion (pandas)."""
    return _cuenta(len(df), df["DOCUMENTO"].nunique(), df["NOMBRECLI"].nunique(),
                   df["PRODUCTO"].nunique(), round(df["SUMANETO"].round(2).sum() * 100))


def desde_paquete(gz):
    """Camino 2: el paquete ya armado, releido byte a byte con numpy."""
    _, c = PAQ.abrir(gz)
    return _cuenta(len(c["dia"]), len(np.unique(c["doc"])), len(np.unique(c["cli"])),
                   len(np.unique(c["prod"])), int(c["neto"].astype(np.int64).sum()))


def desde_motor(gz):
    """Camino 3: el motor del navegador (app/motor.js), corriendo en Node."""
    with tempfile.NamedTemporaryFile(suffix=".gz", delete=False) as f:
        f.write(gz)
    try:
        r = subprocess.run(["node", os.path.join(RAIZ, "tools", "paridad.mjs"), f.name],
                           capture_output=True, text=True, check=True)
    finally:
        os.unlink(f.name)
    t = json.loads(r.stdout)
    return _cuenta(t["filas"], t["doc"], t["cli"], t["prod"], round(t["neto"] * 100))


def cuadre(df, gz):
    caminos = {"excel": desde_excel(df), "paquete": desde_paquete(gz), "motor": desde_motor(gz)}
    if len({json.dumps(v, sort_keys=True) for v in caminos.values()}) != 1:
        raise SystemExit(f"Cuadre roto, no se publica: {caminos}")
    return caminos


def meses_de(gz):
    """{mes: [lineas, facturas, centavos]} de un paquete: la foto que coteja el
    corte siguiente."""
    meta, c = PAQ.abrir(gz)
    mes, doc, neto = c["mes"], c["doc"], c["neto"].astype(np.int64)
    out = {}
    for k, nombre in enumerate(meta["dims"]["mes"]):
        s = mes == k
        out[nombre] = [int(s.sum()), int(len(np.unique(doc[s]))), int(neto[s].sum())]
    return out


def _cerrado(mes, date_max):
    """El mes ya estaba cerrado en un corte que llega hasta date_max."""
    y, m, d = (int(x) for x in date_max.split("-"))
    return mes < date_max[:7] or (mes == date_max[:7] and d == calendar.monthrange(y, m)[1])


def pasado(gz, corte, date_max, ruta=FOTOS):
    """Guarda la foto de este corte y la coteja con la del corte anterior: los
    meses que ya estaban cerrados deben llegar identicos. Si cambian, se avisa y
    la lamina lo muestra tal cual (una nota de credito tardia es legitima)."""
    fotos = {}
    if os.path.exists(ruta):
        with open(ruta, encoding="utf-8") as f:
            fotos = json.load(f)
    actual = meses_de(gz)
    fotos[str(corte)] = {"dateMax": date_max, "meses": actual}
    with open(ruta, "w", encoding="utf-8") as f:
        json.dump(fotos, f, ensure_ascii=False, indent=1)
    previos = [int(k) for k in fotos if int(k) < int(corte)]
    if not previos:
        return None
    ant = fotos[str(max(previos))]
    filas = []
    for mes in sorted(m for m in ant["meses"] if _cerrado(m, ant["dateMax"])):
        a, b = ant["meses"][mes], actual.get(mes, [0, 0, 0])
        filas.append({"mes": mes, "igual": a == b, "lineas": b[0] - a[0],
                      "facturas": b[1] - a[1], "centavos": b[2] - a[2]})
    cambiados = [f["mes"] for f in filas if not f["igual"]]
    if cambiados:
        print(f"   AVISO: meses cerrados distintos al corte {max(previos)}: {cambiados}", file=sys.stderr)
    return {"contra": max(previos), "hasta": ant["dateMax"], "meses": filas}


def pruebas():
    """Las dos baterias (Python y el motor del navegador en Node). Si una falla,
    no se publica."""
    py = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "tests"],
                        cwd=RAIZ, capture_output=True, text=True)
    n_py = re.search(r"Ran (\d+) test", py.stderr)
    if py.returncode or not n_py:
        raise SystemExit("Pruebas de Python con fallas, no se publica:\n" + py.stderr[-3000:])
    js = subprocess.run(["node", "--test", "--test-reporter=tap", *sorted(glob.glob(os.path.join(RAIZ, "tests", "*.test.mjs")))],
                        cwd=RAIZ, capture_output=True, text=True)
    n_js, f_js = re.search(r"^# pass (\d+)", js.stdout, re.M), re.search(r"^# fail (\d+)", js.stdout, re.M)
    if js.returncode or not n_js or not f_js or int(f_js.group(1)):
        raise SystemExit("Pruebas del motor con fallas, no se publica:\n" + js.stdout[-3000:])
    return {"python": int(n_py.group(1)), "navegador": int(n_js.group(1))}


def armar(df, gz, corte, date_max):
    return {"cuadre": cuadre(df, gz), "pasado": pasado(gz, corte, date_max), "pruebas": pruebas()}
