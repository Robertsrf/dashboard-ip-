"""Lee el Excel de conciliacion 'Facturado vs Cobrado' y devuelve el payload
`Pcob` que consume la pestana de Cobranza del dashboard.

Invariantes (no se recalculan aqui: la conciliacion ya aplico las reglas
confirmadas por Palomares el 2026-08-20; este modulo SOLO transporta):
  * ANULADA nunca entra al universo cobrable (queda aparte, en `anul`).
  * Identidad: Facturado neto = Cobrado + Diferencial + Pendiente.
  * El Diferencial NO es deuda ni perdida (es cobrar a otro precio/forma de pago).
  * Las comisiones solo se suman/comparan por la columna $-equivalente.
Los encabezados se detectan POR NOMBRE (normalizado), nunca por posicion:
el formato cambia entre cortes.
"""
import re
import unicodedata
import pandas as pd

ESTADO_ANULADA = "ANULADA"


def _norm(s):
    """minusculas, sin acentos, sin puntuacion: para casar encabezados."""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return "".join(c for c in s if c.isalnum())


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    return 0.0 if f != f else round(f, 2)


def _txt(v):
    s = "" if v is None else str(v).strip()
    return "" if s.lower() == "nan" else s


def _header_row(raw, wanted, limit=8):
    """Primera fila (de las `limit` primeras) que contenga TODOS los nombres
    de `wanted` ya normalizados. Devuelve (indice, {norm_nombre: col})."""
    want = [_norm(w) for w in wanted]
    for i in range(min(limit, len(raw))):
        cells = {_norm(v): j for j, v in enumerate(raw.iloc[i].tolist()) if _txt(v)}
        if all(w in cells for w in want):
            return i, cells
    return None, {}


def _sheet(xls, name):
    return pd.read_excel(xls, sheet_name=name, header=None)


def _agg_sheet(xls, name):
    """Hojas 'POR ...': Categoria + Facturado neto/Cobrado/Pendiente/Diferencial/
    % Cobro/Anuladas/Facturas. Se descarta la fila TOTAL (se recalcula)."""
    raw = _sheet(xls, name)
    hi, cells = _header_row(raw, ["Categoria", "Cobrado ($)", "Facturas"])
    if hi is None:
        return []
    c = lambda k: cells.get(_norm(k))
    cols = {"cat": c("Categoria"), "fact": c("Facturado neto ($)"), "cob": c("Cobrado ($)"),
            "pend": c("Pendiente ($)"), "dif": c("Diferencial ($)"),
            "anul": c("Anuladas ($)"), "fac": c("Facturas")}
    out = []
    for _, r in raw.iloc[hi + 1:].iterrows():
        cat = _txt(r.iloc[cols["cat"]]) if cols["cat"] is not None else ""
        if not cat or cat.upper().startswith("TOTAL"):
            continue
        out.append({"cat": cat,
                    "fact": _num(r.iloc[cols["fact"]]), "cob": _num(r.iloc[cols["cob"]]),
                    "pend": _num(r.iloc[cols["pend"]]), "dif": _num(r.iloc[cols["dif"]]),
                    "anul": _num(r.iloc[cols["anul"]]),
                    "fac": int(_num(r.iloc[cols["fac"]]))})
    return out


def _cobertura(xls):
    raw = _sheet(xls, "COBERTURA")
    hi, cells = _header_row(raw, ["Categoria", "Documentos", "% del sistema"], limit=10)
    if hi is None:
        return []
    ic, idoc = cells[_norm("Categoria")], cells[_norm("Documentos")]
    ipct = cells[_norm("% del sistema")]
    imon = cells.get(_norm("Facturado ($)"), idoc + 1)

    def pct(v):
        """La hoja guarda la fraccion (0,426) con formato de %; se escala sin
        redondear antes (redondear a 2 decimales la fraccion mataba el dato)."""
        try:
            f = float(v)
        except (TypeError, ValueError):
            return 0.0
        if f != f:
            return 0.0
        return round(f * 100 if abs(f) <= 1.0000001 else f, 2)

    out = []
    for _, r in raw.iloc[hi + 1:].iterrows():
        cat = _txt(r.iloc[ic])
        if not cat:
            break                      # la tabla termina en la primera fila vacia
        row = {"cat": cat, "docs": int(_num(r.iloc[idoc])),
               "monto": _num(r.iloc[imon]), "pct": pct(r.iloc[ipct])}
        if cat.upper().startswith("TOTAL"):
            row["total"] = True
            out.append(row)
            break
        out.append(row)
    return out


def _comisiones(xls):
    raw = _sheet(xls, "COMISIONES x VENDEDOR")
    hi, cells = _header_row(raw, ["Vendedor", "Comision total ($-equiv.)"], limit=10)
    if hi is None:
        return []
    g = lambda k: cells.get(_norm(k))
    out = []
    for _, r in raw.iloc[hi + 1:].iterrows():
        v = _txt(r.iloc[g("Vendedor")])
        if not v or v.upper().startswith("TOTAL"):
            continue
        out.append({"vend": v.upper(),
                    "base3": _num(r.iloc[g("Base 3% (Bs)")]),
                    "base5": _num(r.iloc[g("Base 5% (Bs)")]),
                    "porcion": _num(r.iloc[g("Porcion $ (divisa)")]),
                    "azhar": _num(r.iloc[g("Azucar/Harina (Bs)")]),
                    "com": _num(r.iloc[g("Comision total ($-equiv.)")]),
                    "fac": int(_num(r.iloc[g("Facturas")]))})
    out.sort(key=lambda x: -x["com"])
    return out


def build(path):
    xls = pd.ExcelFile(path, engine="openpyxl")

    # --- MAESTRO: filas crudas (permiten filtrar en el navegador) -------------
    raw = _sheet(xls, "MAESTRO")
    hi, cells = _header_row(raw, ["Camada (despacho)", "Estado", "Facturado ($)"])
    if hi is None:
        raise ValueError("MAESTRO: no se encontro la fila de encabezados")
    m = pd.read_excel(xls, sheet_name="MAESTRO", header=hi)
    cols = {_norm(c): c for c in m.columns}
    col = lambda k: cols[_norm(k)]

    def dim(key, empty="(Sin dato)"):
        s = m[col(key)].map(_txt).replace("", empty)
        vals = sorted(s.unique().tolist())
        idx = {v: i for i, v in enumerate(vals)}
        return vals, s.map(idx).astype(int).tolist()

    camada_v, camada_i = dim("Camada (despacho)", "(Sin camada)")
    vend_v, vend_i = dim("Vendedor")
    grupo_v, grupo_i = dim("Grupo")
    precio_v, precio_i = dim("Precio (norm)")
    anal_v, anal_i = dim("Analista")
    est_v, est_i = dim("Estado")

    def col_num(k):
        return pd.to_numeric(m[col(k)], errors="coerce").fillna(0.0).round(2).tolist()

    fact, cob = col_num("Facturado ($)"), col_num("Cobrado ($)")
    pend, dif = col_num("Pendiente ($)"), col_num("Diferencial ($)")
    anul = col_num("Anulado ($)")

    rows = [[camada_i[k], vend_i[k], grupo_i[k], precio_i[k], anal_i[k], est_i[k],
             fact[k], cob[k], pend[k], dif[k], anul[k]] for k in range(len(m))]

    # --- verificacion de la identidad, camada a camada -----------------------
    ianul = est_v.index(ESTADO_ANULADA) if ESTADO_ANULADA in est_v else -1
    checks = []
    for ci, cname in enumerate(camada_v):
        f = c = p = dd = 0.0
        for r in rows:
            if r[0] != ci or r[5] == ianul:
                continue
            f += r[6]; c += r[7]; p += r[8]; dd += r[9]
        checks.append({"camada": cname, "fact": round(f, 2),
                       "suma": round(c + p + dd, 2), "delta": round(f - c - p - dd, 2)})
    bad = [c for c in checks if abs(c["delta"]) > 0.05]
    if bad:
        raise ValueError(f"Identidad rota (Facturado != Cobrado+Dif+Pendiente): {bad}")

    # camadaMin/Max solo sobre etiquetas YYYY-MM reales: las anuladas sin fecha
    # de despacho caen en "(Sin camada)" (la hoja POR CAMADA tampoco las reparte).
    camadas = sorted(c for c in camada_v if re.fullmatch(r"\d{4}-\d{2}", c))
    return {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "camadaMin": camadas[0] if camadas else "", "camadaMax": camadas[-1] if camadas else "",
        "camadaOrder": camadas,
        "dims": {"camada": camada_v, "vend": vend_v, "grupo": grupo_v,
                 "precio": precio_v, "analista": anal_v, "estado": est_v},
        "anulIdx": ianul,
        "camadaAgg": _agg_sheet(xls, "POR CAMADA"),
        "vendAgg": _agg_sheet(xls, "POR VENDEDOR"),
        "grupoAgg": _agg_sheet(xls, "POR GRUPO"),
        "analistaAgg": _agg_sheet(xls, "POR ANALISTA"),
        "precioAgg": _agg_sheet(xls, "POR PRECIO LISTA"),
        "cobertura": _cobertura(xls),
        "comisiones": _comisiones(xls),
        "rows": rows,
        "checks": checks,
    }


if __name__ == "__main__":
    import sys, json
    P = build(sys.argv[1] if len(sys.argv) > 1 else "cobranza.xlsx")
    print(json.dumps({k: (v if k not in ("rows",) else f"<{len(v)} filas>")
                      for k, v in P.items()}, ensure_ascii=False, indent=1)[:4000])
