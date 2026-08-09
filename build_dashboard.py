#!/usr/bin/env python3
"""
Generador del dashboard IP (v3 - marca, ECharts, analitico).
Uso: python3 build_dashboard.py <ruta_xlsx> <version_str> <salida_html>
"""
import sys, json, html, os
import pandas as pd
import reports as REPORTS
import secure as SECURE
import wordrep as WORDREP
import risklist as RLIST


def _wrap_summary(title, body, full_id, fname):
    return ('<div class="rep"><div class="rephead"><div><div class="repkick">RESUMEN · INFORME CARGADO</div>'
            f'<h2>{title}</h2><div class="repsub">Resumen tomado del Word cargado en Drive · descarga el documento completo</div></div>'
            f'<div class="repbtns"><button class="pdfbtn" onclick="downloadReport(\'{full_id.replace("-full","")}\',\'{fname}\')">⬓ Descargar informe (Word)</button></div></div>'
            f'{body}<div class="repnote">📄 Resumen del informe cargado en Drive. Usa <b>Descargar informe (Word)</b> para el documento completo.</div></div>')


def main():
    xlsx, version, out = sys.argv[1], sys.argv[2], sys.argv[3]
    df = pd.read_excel(xlsx, engine="openpyxl")

    for c in ["GRUPO", "VENDEDOR", "SECTOR", "MARCA", "NOMBRECLI", "DOCUMENTO", "PRODUCTO"]:
        df[c] = df[c].fillna("(Sin dato)").astype(str).str.strip()
    df["MARCA"] = df["MARCA"].replace({"nan": "(Sin marca)", "": "(Sin marca)"})
    for c in ["CANTIDAD", "CNTDEVUELT", "SUMANETO"]:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)
    df["FECHADOC"] = pd.to_datetime(df["FECHADOC"], errors="coerce")
    df = df.dropna(subset=["FECHADOC"])
    df["MES"] = df["FECHADOC"].dt.strftime("%Y-%m")

    def encode(col):
        vals = sorted(df[col].unique().tolist())
        idx = {v: i for i, v in enumerate(vals)}
        return vals, df[col].map(idx).astype(int).tolist()

    mes_vals, mes_i = encode("MES")
    grupo_vals, grupo_i = encode("GRUPO")
    vend_vals, vend_i = encode("VENDEDOR")
    sector_vals, sector_i = encode("SECTOR")
    marca_vals, marca_i = encode("MARCA")
    cli_vals, cli_i = encode("NOMBRECLI")
    prod_vals, prod_i = encode("PRODUCTO")
    doc_vals, doc_i = encode("DOCUMENTO")

    cant = df["CANTIDAD"].round(2).tolist()
    dev = df["CNTDEVUELT"].round(2).tolist()
    neto = df["SUMANETO"].round(2).tolist()
    _daymin = df["FECHADOC"].dt.normalize().min()
    dayoff = ((df["FECHADOC"].dt.normalize() - _daymin).dt.days).astype(int).tolist()

    rows = [[mes_i[k], grupo_i[k], vend_i[k], sector_i[k], marca_i[k],
             cli_i[k], prod_i[k], doc_i[k], cant[k], dev[k], neto[k], dayoff[k]]
            for k in range(len(df))]

    meses_es = {"01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May",
                "06": "Jun", "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct",
                "11": "Nov", "12": "Dic"}
    mes_labels = [f"{meses_es.get(m.split('-')[1], m)} {m.split('-')[0][2:]}" for m in mes_vals]
    year = mes_vals[-1].split("-")[0]
    full_labels = [f"{meses_es[f'{mm:02d}']} {year[2:]}" for mm in range(1, 13)]
    hist_month_nums = [int(m.split("-")[1]) for m in mes_vals]

    payload = {
        "version": version,
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "dateMin": df["FECHADOC"].min().strftime("%Y-%m-%d"),
        "dateMax": df["FECHADOC"].max().strftime("%Y-%m-%d"),
        "year": year,
        "dayZero": _daymin.strftime("%Y-%m-%d"), "dayCount": (int(max(dayoff))+1) if dayoff else 0,
        "dims": {
            "mes": mes_vals, "mesLabels": mes_labels, "fullLabels": full_labels,
            "histMonthNums": hist_month_nums,
            "grupo": grupo_vals, "vendedor": vend_vals, "sector": sector_vals,
            "marca": marca_vals, "cliente": cli_vals, "producto": prod_vals,
        },
        "rows": rows,
    }
    data_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    # Informes (Ejecutivo + Clientes riesgo/recuperados) con historico de cortes
    hist_path = os.path.join(os.path.dirname(os.path.abspath(out)) or ".", "history.json")
    # Informes: excluir marca AMERICO y cliente REVIPLAST (solo informes, no dashboard)
    _mk = df["MARCA"].astype(str).str.upper(); _cl = df["NOMBRECLI"].astype(str).str.upper()
    df_rep = df[~((_mk == "AMERICO") | (_cl.str.contains("REVIPLAST")))].copy()
    try:
        rep = REPORTS.build(df_rep, hist_path, version)
        exec_html, risk_html, exec_full, risk_full = rep["exec"], rep["risk"], rep["execFull"], rep["riskFull"]
    except Exception as e:
        exec_html = risk_html = exec_full = risk_full = f'<div class="rep"><p>No se pudo generar el informe: {html.escape(str(e))}</p></div>'
    # Word cargados en Drive (opcional): resumen desde el Word + descarga del archivo real
    exec_b64 = risk_b64 = ""
    ep = os.environ.get("EXEC_DOCX"); rp = os.environ.get("RISK_DOCX")
    try:
        if ep and os.path.exists(ep):
            wbody, exec_b64 = WORDREP.extract(ep); exec_html = _wrap_summary("Informe Ejecutivo", wbody, "exec-full", "Informe_Ejecutivo_IP.docx")
        if rp and os.path.exists(rp):
            wbody, risk_b64 = WORDREP.extract(rp); risk_html = _wrap_summary("Seguimiento de Clientes", wbody, "risk-full", "Seguimiento_Clientes_IP.docx")
    except Exception:
        pass
    # Lista de clientes en riesgo (Excel de Drive, opcional)
    rlp = os.environ.get("RISK_LIST_XLSX"); risk_list = None; list_b64 = ""
    try:
        if rlp and os.path.exists(rlp):
            risk_list = RLIST.load(rlp)
            import base64 as _b64x
            list_b64 = _b64x.b64encode(open(rlp, "rb").read()).decode()
    except Exception:
        risk_list = None
    def _dl(envk):
        i = os.environ.get(envk, "")
        return f"https://drive.google.com/uc?export=download&id={i}" if i else ""
    drive_links = {"exec": _dl("EXEC_ID"), "risk": _dl("RISK_ID"), "list": _dl("LIST_ID")}
    combined = json.dumps({"P": payload, "exec": exec_html, "risk": risk_html, "execFull": exec_full, "riskFull": risk_full, "execDocx": exec_b64, "riskDocx": risk_b64, "riskList": risk_list, "listDocx": list_b64, "driveLinks": drive_links}, ensure_ascii=False, separators=(",", ":"))
    sec_path = os.environ.get("SECRETS_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "secrets.json"))
    enc = SECURE.encrypt(combined, json.load(open(sec_path, encoding="utf-8")))
    enc_json = json.dumps(enc, ensure_ascii=False, separators=(",", ":"))
    logo_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Logo.svg")
    logo_svg = open(logo_path, encoding="utf-8").read() if os.path.exists(logo_path) else '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#24205b" stroke-width="5"/><text x="50" y="66" font-size="46" font-weight="700" fill="#ff4f20" text-anchor="middle" font-family="Georgia,serif">IP</text></svg>'
    ve_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ve_states.geojson")
    ve_geo = open(ve_path, encoding="utf-8").read() if os.path.exists(ve_path) else '{"type":"FeatureCollection","features":[]}'
    out_html = (TEMPLATE.replace("__VERSION__", html.escape(version))
                        .replace("__ENC_JSON__", enc_json)
                        .replace("__VE_GEO__", ve_geo)
                        .replace("__LOGO_SVG__", logo_svg))
    with open(out, "w", encoding="utf-8") as f:
        f.write(out_html)
    print(f"OK -> {out} ({len(out_html)/1e6:.2f} MB, {len(rows)} filas)")


TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "template.html")
# Se lee con newline por defecto (universal): convierte CRLF y LF a salto simple,
# exactamente igual que hacia el literal de codigo. Asi el index.html sale identico
# aunque git reescriba los finales de linea del archivo (core.autocrlf=true).
with open(TEMPLATE_PATH, encoding="utf-8") as _f:
    TEMPLATE = _f.read()


if __name__ == "__main__":
    main()
