#!/usr/bin/env python3
"""Verificacion de un artefacto antes de publicarlo (paso 7 de §10.2).

    python tools/verificar.py index.html [data_ip.xlsx]
    python tools/verificar.py caleb.html

Comprueba, y sale con 1 si algo falla:
  1. los 4 PIN abren el paquete y el de reunion abre SOLO el suyo (y al reves);
  2. el paquete de reunion no trae claves ni columnas prohibidas;
  3. no quedan marcadores ni scripts con error de sintaxis (node --check);
  4. totales: numpy sobre el paquete == motor JS (tools/paridad.mjs) y, si se
     pasa el Excel de IP, == pandas sobre el Excel (paridad con la v3).
No imprime ningun PIN.
"""
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

import numpy as np
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, RAIZ)
from grupo import paquete as PAQ  # noqa: E402

PROHIBIDO_META = {"exec", "execDocx", "history", "driveLinks", "listDocx"}
PROHIBIDO_COLS = {"costo", "precio", "vm", "cst", "p0", "sc"}
FALLOS = []


def check(ok, msg):
    print(("  ok  " if ok else "  MAL ") + msg)
    if not ok:
        FALLOS.append(msg)


def _json(html, id_):
    m = re.search(r'<script type="application/json" id="%s">(.*?)</script>' % id_, html, re.S)
    return json.loads(m.group(1)) if m else None


def abrir(enc, pin):
    """bytes del paquete (gzip) o None si el PIN no abre."""
    d = lambda s: base64.b64decode(s)
    for u in enc["users"]:
        uk = hashlib.pbkdf2_hmac("sha256", pin.encode(), d(u["salt"]), enc["iter"], 32)
        try:
            mk = AESGCM(uk).decrypt(d(u["ivu"]), d(u["wrapped"]), None)
        except Exception:
            continue
        return AESGCM(mk).decrypt(d(enc["iv"]), d(enc["ct"]), None)
    return None


def scripts(html):
    with tempfile.TemporaryDirectory() as tmp:
        for i, m in enumerate(re.finditer(r"<script(?![^>]*application/json)(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S)):
            p = os.path.join(tmp, f"s{i}.js")
            with open(p, "w", encoding="utf-8") as f:
                f.write(m.group(1))
            r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
            check(r.returncode == 0, f"script {i} sintaxis" + ("" if r.returncode == 0 else ": " + r.stderr[:300]))


def totales_numpy(cols, esc):
    return {"filas": int(len(cols["dia"])), "neto": round(int(cols["neto"].astype(np.int64).sum()) / esc["neto"], 2),
            "doc": int(len(np.unique(cols["doc"]))), "cli": int(len(np.unique(cols["cli"]))),
            "prod": int(len(np.unique(cols["prod"])))}


def totales_js(gz):
    with tempfile.NamedTemporaryFile(suffix=".gz", delete=False) as f:
        f.write(gz)
    try:
        r = subprocess.run(["node", os.path.join(RAIZ, "tools", "paridad.mjs"), f.name],
                           capture_output=True, text=True, check=True)
        return json.loads(r.stdout)
    finally:
        os.unlink(f.name)


def totales_excel_ip(xlsx):
    import build_dashboard as B
    df = B.cargar(xlsx)
    return {"filas": len(df), "neto": round(float(df["SUMANETO"].round(2).sum()), 2),
            "doc": int(df["DOCUMENTO"].nunique()), "cli": int(df["NOMBRECLI"].nunique()),
            "prod": int(df["PRODUCTO"].nunique())}


def main(ruta, xlsx=None):
    html = open(ruta, encoding="utf-8").read()
    print(f"{ruta}: {len(html) / 1e6:.2f} MB")
    with open(os.path.join(RAIZ, "secrets.json"), encoding="utf-8") as f:
        sec = json.load(f)
    enc, enc_r = _json(html, "enc"), _json(html, "enc-r")
    check(enc is not None, "paquete principal presente")
    gz = None
    for u in sec["users"]:
        b = abrir(enc, u["pin"])
        check(b is not None, f"PIN de {u['role']} abre el paquete")
        gz = gz or b
        if enc_r:
            check(abrir(enc_r, u["pin"]) is None, f"PIN de {u['role']} NO abre el de reunion")
    meta, cols = PAQ.abrir(gz)
    esc = {c["n"]: c["s"] for c in meta["cols"]}
    print(f"  {meta['empresa']}: {meta['filas']} filas, {meta['dateMin']} -> {meta['dateMax']}, corte {meta.get('corte')}")
    if sec.get("reunion"):
        check(enc_r is not None, "paquete de reunion presente")
        check(abrir(enc, sec["reunion"]["pin"]) is None, "PIN de reunion NO abre el paquete principal")
        gr = abrir(enc_r, sec["reunion"]["pin"])
        check(gr is not None, "PIN de reunion abre su paquete")
        mr, cr = PAQ.abrir(gr)
        check(mr.get("modo") == "reunion", "paquete de reunion marcado como tal")
        check(not (PROHIBIDO_META & set(mr)), f"reunion sin claves prohibidas {sorted(PROHIBIDO_META & set(mr))}")
        check(not (PROHIBIDO_COLS & set(cr)), f"reunion sin columnas prohibidas {sorted(PROHIBIDO_COLS & set(cr))}")
        check(not (mr.get("Pcob") or {}).get("cobertura"), "reunion sin cobertura de cobranza")
    check(not re.findall(r"__[A-Z][A-Z_]+__", html), "sin marcadores sin reemplazar")
    scripts(html)
    tn = totales_numpy(cols, esc)
    tj = totales_js(gz)
    check(all(abs(tn[k] - tj[k]) < 0.005 for k in tn), f"motor JS == numpy {tn}")
    if xlsx:
        te = totales_excel_ip(xlsx)
        check(all(abs(tn[k] - te[k]) < 0.005 for k in tn), f"paquete == Excel {te}")
    print("VERIFICACION " + ("OK" if not FALLOS else f"CON {len(FALLOS)} FALLOS"))
    return 1 if FALLOS else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    sys.exit(main(*sys.argv[1:3]))
