#!/usr/bin/env python3
"""Generador del dashboard de Distribuidora y Suministros IP (Sistema Grupo IP v4).

Uso:  python build_dashboard.py <data_ip.xlsx> "<version>" <index.html>

Entorno: SECRETS_PATH, EXEC_DOCX, RISK_LIST_XLSX, COB_XLSX (insumos opcionales),
EXEC_ID, LIST_ID, COB_ID (enlaces de Drive), CORTE (numero si no es el anterior + 1).
Procedimiento completo de un corte: CONTEXTO_CLAUDE.md §10.2. Reglas: METODO.md.
"""
import base64
import json
import os
import sys

import pandas as pd

import cobranza as COB
import reports as REPORTS
import risklist as RLIST
import secure as SECURE
import wordrep as WORDREP
from grupo import changelog as CL
from grupo import pagina as PAG
from grupo import paquete as PAQ
from grupo import reglas as REGLAS
from grupo import reunion as REUNION

AQUI = os.path.dirname(os.path.abspath(__file__))
MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
TEXTO = ["GRUPO", "VENDEDOR", "SECTOR", "MARCA", "NOMBRECLI", "DOCUMENTO", "PRODUCTO", "REFERENCIA"]
# (clave en el paquete, columna del Excel): cada una es un segmentador o un conteo
DIMENSIONES = [("mes", "MES"), ("grupo", "GRUPO"), ("vend", "VENDEDOR"), ("sector", "SECTOR"),
               ("estado", "ESTADO"), ("marca", "MARCA"), ("familia", "REFERENCIA"),
               ("cli", "NOMBRECLI"), ("prod", "PRODUCTO"), ("doc", "DOCUMENTO")]


def _warn(msg):
    """Los insumos opcionales pueden faltar sin romper el build, pero nunca en silencio."""
    print(f"   AVISO: {msg}", file=sys.stderr)


def _estado(sector):
    partes = sector.split(",")
    return (partes[1] if len(partes) > 1 else partes[0]).strip().upper() or "(Sin dato)"


def cargar(xlsx):
    df = pd.read_excel(xlsx, engine="openpyxl")
    for c in TEXTO:
        df[c] = df[c].fillna("(Sin dato)").astype(str).str.strip()
    df["MARCA"] = df["MARCA"].replace({"nan": "(Sin marca)", "": "(Sin marca)"})
    for c in ["CANTIDAD", "CNTDEVUELT", "SUMANETO"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
    df["FECHADOC"] = pd.to_datetime(df["FECHADOC"], errors="coerce")
    df = df.dropna(subset=["FECHADOC"]).reset_index(drop=True)
    df = REGLAS.vendedores(df)
    df["MES"] = df["FECHADOC"].dt.strftime("%Y-%m")
    df["ESTADO"] = df["SECTOR"].map(_estado)
    return df


def ventas(df):
    """Dimensiones (nombres ordenados) y columnas del paquete. Cada dimension se
    codifica a indices enteros: es lo que vuelve manejable el paquete."""
    dims, cols = {}, {}
    for clave, col in DIMENSIONES:
        vals = sorted(df[col].unique().tolist())
        idx = {v: i for i, v in enumerate(vals)}
        cols[clave] = df[col].map(idx).to_numpy()
        dims[clave] = vals if clave != "doc" else len(vals)   # los numeros de factura no se muestran
    dia0 = df["FECHADOC"].dt.normalize().min()
    cols["dia"] = (df["FECHADOC"].dt.normalize() - dia0).dt.days.to_numpy()
    cols["cant"] = (df["CANTIDAD"].round(3).to_numpy(), 1000)
    cols["dev"] = (df["CNTDEVUELT"].round(3).to_numpy(), 1000)
    cols["neto"] = (df["SUMANETO"].round(2).to_numpy(), 100)
    meses = dims["mes"]
    year = meses[-1][:4]
    dims["mesLabels"] = [f"{MESES[int(m[5:]) - 1]} {m[2:4]}" for m in meses]
    dims["fullLabels"] = [f"{MESES[i]} {year[2:]}" for i in range(12)]
    dims["histMonthNums"] = [int(m[5:]) for m in meses]
    fechas = {"dateMin": df["FECHADOC"].min().strftime("%Y-%m-%d"),
              "dateMax": df["FECHADOC"].max().strftime("%Y-%m-%d"), "year": year,
              "dayZero": dia0.strftime("%Y-%m-%d"), "dayCount": int(cols["dia"].max()) + 1}
    return dims, cols, fechas


def informes(df, version):
    """history.json (reports.py) y el resumen del informe ejecutivo. Los informes
    excluyen AMERICO y REVIPLAST (invariante I3); el dashboard no."""
    mk, cl = df["MARCA"].str.upper(), df["NOMBRECLI"].str.upper()
    df_rep = df[~((mk == "AMERICO") | cl.str.contains("REVIPLAST"))].copy()
    rep = REPORTS.build(df_rep, os.path.join(AQUI, "history.json"), version)
    # sin Word, el resumen que arma reports.py
    ejecutivo = {"fuente": "sistema", "html": rep["exec"]}
    ep, docx = os.environ.get("EXEC_DOCX"), ""
    if ep and os.path.exists(ep):
        try:
            cuerpo, docx = WORDREP.extract(ep)
            ejecutivo = {"fuente": "word", "html": cuerpo}
        except Exception as e:      # el Word es opcional, pero el fallo se ve
            _warn(f"Word no procesado ({ep}): {e!r}")
    with open(os.path.join(AQUI, "history.json"), encoding="utf-8") as f:
        return ejecutivo, docx, json.load(f)


def adjuntos():
    """Lista de riesgo, conciliacion de cobranza y enlaces de Drive (opcionales)."""
    out = {"riskList": None, "listDocx": "", "Pcob": None}
    rlp = os.environ.get("RISK_LIST_XLSX")
    if rlp and os.path.exists(rlp):
        try:
            out["riskList"] = RLIST.load(rlp)
            with open(rlp, "rb") as f:
                out["listDocx"] = base64.b64encode(f.read()).decode()
        except Exception as e:
            _warn(f"Lista de riesgo no procesada ({rlp}): {e!r}")
    cbp = os.environ.get("COB_XLSX")
    if cbp and os.path.exists(cbp):
        out["Pcob"] = COB.build(cbp)       # si la identidad no cuadra, revienta aqui a proposito
        print(f"   cobranza: {len(out['Pcob']['rows'])} facturas, camadas "
              f"{out['Pcob']['camadaMin']}..{out['Pcob']['camadaMax']}")

    def enlace(k):
        i = os.environ.get(k, "")
        return f"https://drive.google.com/uc?export=download&id={i}" if i else ""
    out["driveLinks"] = {"exec": enlace("EXEC_ID"), "list": enlace("LIST_ID"), "cob": enlace("COB_ID")}
    return out


CFG = {"clave": "ip", "nombre": "Distribuidora y Suministros IP", "modulo": "ip.js",
       "titulo": "Distribuidora y Suministros IP · Inteligencia de Ventas", "acento": "#c93608",
       "logo_html": '<img src="assets/logo-ip.png" alt="" width="48" height="48">',
       "puerta_logo": '<img src="assets/logo-ip.png" alt="Distribuidora y Suministros IP">'}


def main():
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    xlsx, version, salida = sys.argv[1:4]
    cl_path = os.path.join(AQUI, "changelog.json")
    CL.verificar(cl_path, AQUI)                 # codigo nuevo sin entrada en Novedades: no se publica
    df = cargar(xlsx)
    dims, cols, fechas = ventas(df)
    ejecutivo, docx, hist = informes(df, version)
    corte = hist[-1]["corte"]
    CL.corte(cl_path, "ip", corte, fechas["dateMax"],
             ["Ventas hasta el " + "-".join(reversed(fechas["dateMax"].split("-"))) + "."])   # sin cifras: el repo es publico
    meta = dict(fechas, empresa="ip", version=version, corte=corte, dims=dims,
                generated=pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
                exec=ejecutivo, execDocx=docx, changelog=CL.cargar(cl_path), **adjuntos())
    # con enlace de Drive la descarga va al archivo exacto: la copia embebida
    # solo pesaria (~180 KB); se queda como respaldo cuando no hay enlace
    for clave, copia in (("exec", "execDocx"), ("list", "listDocx")):
        if meta["driveLinks"][clave]:
            meta[copia] = ""

    with open(os.environ.get("SECRETS_PATH", os.path.join(AQUI, "secrets.json")), encoding="utf-8") as f:
        secretos = json.load(f)
    iters = int(secretos.get("iterations", 200000))
    enc = SECURE.encrypt_bytes(PAQ.empaquetar(meta, cols), secretos["users"], iters)
    reunion = SECURE.reunion_users(secretos)
    enc_r = (SECURE.encrypt_bytes(PAQ.empaquetar(*REUNION.limpiar("ip", meta, cols)), reunion, iters)
             if reunion else None)

    with open(os.path.join(AQUI, "ve_states.geojson"), encoding="utf-8") as f:
        geo = json.load(f)
    with open(os.path.join(AQUI, "app", "favicons.json"), encoding="utf-8") as f:
        cfg = dict(CFG, favicon=json.load(f)["ip"])
    html = PAG.construir(cfg, enc, enc_r, version, extra={"geo": geo})
    PAG.escribir(salida, html)
    print(f"OK -> {salida} ({len(html) / 1e6:.2f} MB, {len(df)} filas, corte {corte}"
          f"{', con paquete de reunion' if enc_r else ''})")


if __name__ == "__main__":
    main()
