"""Lee el Excel de conciliacion 'Facturado vs Cobrado' y devuelve el payload
`Pcob` que consume la pestana de Cobranza del dashboard.

Invariantes (no se recalculan aqui: la conciliacion ya aplico las reglas
confirmadas por Palomares el 2026-08-20; este modulo SOLO transporta):
  * ANULADA nunca entra al universo cobrable (queda aparte, en `anul`).
  * Identidad: Facturado neto = Cobrado + Diferencial + Pendiente.
  * El Diferencial NO es deuda ni perdida (es cobrar a otro precio/forma de pago).
  * AMERICO (el cafe viejo) NO tiene cuadros de cobranza: no se concilia y no
    aparece en el modulo. Vive solo en COBERTURA, como marca fuera de cartera.
  * Cafe (La Protectora) existe desde JULIO. DONDE vive cambia entre cortes:
      - corte 7: dentro de MAESTRO con Grupo=CAFE -> los totales YA lo incluian.
      - corte 8: en su propio maestro, FUERA de MAESTRO -> los totales de la
        linea regular NO lo incluyen y el cafe se suma aparte.
    El flag `cafeDentro` dice cual de los dos es, y el front cambia el texto:
    leerlo al reves cuenta el cafe dos veces (o lo pierde).
Los encabezados se detectan POR NOMBRE (normalizado), nunca por posicion: el
formato cambia entre cortes. `_norm` borra acentos, espacios y puntuacion, asi
que 'Facturado neto ($)' y 'Facturado Neto' casan solos; los cambios de nombre
de verdad ('Camada (despacho)' -> 'Camada') van como alternativas explicitas.
"""
import re
import unicodedata
import pandas as pd

ESTADO_ANULADA = "ANULADA"
GRUPO_CAFE = "CAFE"
# orden real de los meses: las hojas traen el nombre, no el numero
_MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO",
          "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"]
# nombre de la columna de categoria en cada hoja 'POR ...': hasta el corte 7
# todas se llamaban 'Categoria'; desde el 8 cada una usa el de su dimension.
_AGG_CAT = {"POR CAMADA": "Camada", "POR VENDEDOR": "Vendedor",
            "POR GRUPO": "Grupo", "POR ANALISTA": "Analista",
            "POR PRECIO LISTA": "Precio Lista"}


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
    """Primera fila (de las `limit` primeras) que contenga TODOS los nombres de
    `wanted` ya normalizados. Cada elemento puede ser un nombre o una tupla de
    alternativas, para los encabezados que cambiaron de nombre entre cortes.
    Devuelve (indice, {norm_nombre: col})."""
    want = [tuple(_norm(x) for x in (w if isinstance(w, tuple) else (w,)))
            for w in wanted]
    for i in range(min(limit, len(raw))):
        cells = {_norm(v): j for j, v in enumerate(raw.iloc[i].tolist()) if _txt(v)}
        if all(any(a in cells for a in alts) for alts in want):
            return i, cells
    return None, {}


def _at(cells, *names):
    """Indice de la primera de `names` que exista en la fila de encabezados."""
    for n in names:
        j = cells.get(_norm(n))
        if j is not None:
            return j
    return None


def _find_sheet(xls, name):
    """Nombre real de la hoja casando por nombre normalizado (CAFE/CAFE)."""
    t = _norm(name)
    for s in xls.sheet_names:
        if _norm(s) == t:
            return s
    return None


def _sheet(xls, name):
    return pd.read_excel(xls, sheet_name=name, header=None)


def _agg_sheet(xls, name, cat=None):
    """Hojas 'POR ...': categoria + Facturado neto/Cobrado/Pendiente/Diferencial/
    Anuladas/Facturas. La columna de categoria se llama como su dimension (corte
    8) o 'Categoria' (cortes viejos). Las columnas que el corte ya no publica
    (Facturas, Anuladas, Diferencial) quedan en 0: el front las saca del MAESTRO,
    no de aqui. Se descarta la fila TOTAL (se recalcula)."""
    sh = _find_sheet(xls, name)
    if sh is None:
        return []
    cat = cat or _AGG_CAT.get(name.upper(), "Categoria")
    raw = _sheet(xls, sh)
    hi, cells = _header_row(raw, [(cat, "Categoria"), "Cobrado"])
    if hi is None:
        return []
    icat = _at(cells, cat, "Categoria")
    cols = {"fact": _at(cells, "Facturado neto", "Facturado"),
            "cob": _at(cells, "Cobrado"), "pend": _at(cells, "Pendiente"),
            "dif": _at(cells, "Diferencial"),
            "anul": _at(cells, "Anuladas", "Anulado", "Anulada"),
            "fac": _at(cells, "Facturas")}
    out = []
    for _, r in raw.iloc[hi + 1:].iterrows():
        c = _txt(r.iloc[icat])
        if not c or c.upper().startswith("TOTAL"):
            continue
        o = {"cat": c}
        for k, j in cols.items():
            o[k] = _num(r.iloc[j]) if j is not None else 0.0
        o["fac"] = int(o["fac"])
        out.append(o)
    return out


def _cobertura(xls):
    """Hoja COBERTURA: reparto del facturado del SISTEMA (fuente Data_IP), no de
    la cobranza. El corte 8 dejo de publicar 'Documentos' y anadio 'Nota': el
    conteo queda en 0 y el front muestra la nota en su lugar."""
    raw = _sheet(xls, "COBERTURA")
    hi, cells = _header_row(raw, ["Categoria", "% del sistema"], limit=10)
    if hi is None:
        return []
    ic = _at(cells, "Categoria")
    ipct = _at(cells, "% del sistema")
    idoc = _at(cells, "Documentos")
    imon = _at(cells, "Facturado")
    inota = _at(cells, "Nota")
    if imon is None:
        imon = (idoc + 1) if idoc is not None else ic + 1

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
        row = {"cat": cat,
               "docs": int(_num(r.iloc[idoc])) if idoc is not None else 0,
               "monto": _num(r.iloc[imon]), "pct": pct(r.iloc[ipct]),
               "nota": _txt(r.iloc[inota]) if inota is not None else ""}
        if cat.upper().startswith("TOTAL"):
            row["total"] = True
            out.append(row)
            break
        out.append(row)
    return out


def _comisiones(xls):
    """Hoja COMISIONES x VENDEDOR. Cambio de moneda entre cortes:
      - corte 7: 'Comision total ($-equiv.)' + el desglose de bases.
      - corte 8: solo 'Comision (Bs)', nativa en bolivares y sin desglose.
    Devuelve (filas, moneda); `moneda` es la etiqueta que pinta el front, para
    que el eje nunca diga dolares sobre una cifra en bolivares."""
    sh = _find_sheet(xls, "COMISIONES x VENDEDOR")
    if sh is None:
        return [], ""
    raw = _sheet(xls, sh)
    hi, cells = _header_row(
        raw, ["Vendedor", ("Comision total ($-equiv.)", "Comision (Bs)")], limit=10)
    if hi is None:
        return [], ""
    icom = _at(cells, "Comision total ($-equiv.)")
    moneda = "$-equiv." if icom is not None else "Bs"
    if icom is None:
        icom = _at(cells, "Comision (Bs)")
    # el desglose solo existe mientras la comision se publico en $-equivalente
    extra = {"base3": _at(cells, "Base 3% (Bs)"), "base5": _at(cells, "Base 5% (Bs)"),
             "porcion": _at(cells, "Porcion $ (divisa)"),
             # desde el corte del cafe la columna se llamo "Azucar/Harina/Cafe (Bs)"
             "azhar": _at(cells, "Azucar/Harina/Cafe (Bs)", "Azucar/Harina (Bs)"),
             "fac": _at(cells, "Facturas")}
    ivend = _at(cells, "Vendedor")
    out = []
    for _, r in raw.iloc[hi + 1:].iterrows():
        v = _txt(r.iloc[ivend])
        if not v or v.upper().startswith("TOTAL"):
            continue
        o = {"vend": v.upper(), "com": _num(r.iloc[icom])}
        for k, j in extra.items():
            o[k] = _num(r.iloc[j]) if j is not None else 0.0
        o["fac"] = int(o["fac"])
        out.append(o)
    out.sort(key=lambda x: -x["com"])
    return out, moneda


def _comis_detalle(xls):
    """Hoja COMISIONES DETALLE (corte 8): base 5% / base 3% y comision en Bs por
    analista y camada. Es lo unico que queda del desglose de bases desde que
    COMISIONES x VENDEDOR se redujo a una sola columna."""
    sh = _find_sheet(xls, "COMISIONES DETALLE")
    if sh is None:
        return []
    raw = _sheet(xls, sh)
    hi, cells = _header_row(raw, ["Analista", "Camada", "Comision (Bs)"], limit=10)
    if hi is None:
        return []
    ia, ic = _at(cells, "Analista"), _at(cells, "Camada")
    i5, i3 = _at(cells, "Base 5% (Bs)"), _at(cells, "Base 3% (Bs)")
    icom = _at(cells, "Comision (Bs)")
    out = []
    for _, r in raw.iloc[hi + 1:].iterrows():
        a, c = _txt(r.iloc[ia]), _txt(r.iloc[ic])
        if not a or a.upper().startswith("TOTAL") or not c:
            continue
        out.append({"anal": a, "camada": c,
                    "base5": _num(r.iloc[i5]) if i5 is not None else 0.0,
                    "base3": _num(r.iloc[i3]) if i3 is not None else 0.0,
                    "com": _num(r.iloc[icom])})
    return out


def _resumen(xls):
    """Hoja RESUMEN (corte 8): pares etiqueta -> valor de la descomposicion.
    Se usa para cotejar contra lo que sale del MAESTRO; si el Excel se
    contradice a si mismo, mejor enterarse aqui que en el dashboard."""
    sh = _find_sheet(xls, "RESUMEN")
    if sh is None:
        return {}
    raw = _sheet(xls, sh)
    out = {}
    for _, r in raw.iterrows():
        vals = [v for v in r.tolist() if _txt(v)]
        if len(vals) < 2:
            continue
        k, v = _norm(vals[0]), vals[-1]
        try:
            f = float(v)
        except (TypeError, ValueError):
            continue
        if f == f and k not in out:      # la 1.a aparicion manda: la linea
            out[k] = round(f, 2)         # regular va antes que la del cafe
    return out


def _cafe(xls, resumen):
    """Modulo de cafe (La Protectora): hojas MAESTRO CAFE + COMISIONES CAFE.

    Existe solo desde JULIO (antes no habia cuadros de cafe en cobranza) y lo
    consolida Jesiely aunque los vendedores sean de las 3 carteras. AMERICO --el
    cafe viejo-- no entra: no tiene cuadros, no se concilia.

    El corte 8 recorto la hoja: ya no trae Diferencial (se deduce de la
    identidad), ni Cantidad (bultos), ni 'En Sistema', y COMISIONES CAFE quedo
    como texto sin tabla. Los campos que el corte no publica van en None y el
    front oculta esa pieza en vez de pintar ceros.

    Devuelve None si el corte todavia no trae las hojas: la seccion se oculta
    sola en el front y el resto del modulo sigue funcionando igual.
    """
    sh = _find_sheet(xls, "MAESTRO CAFE")
    if sh is None:
        return None
    raw = _sheet(xls, sh)
    # el mes se llamo 'Mes' en el corte 7 y 'Camada' en el 8
    hi, _ = _header_row(raw, [("Mes", "Camada"), "Vendedor", "Estado", "Facturado"])
    if hi is None:
        raise ValueError("MAESTRO CAFE: no se encontro la fila de encabezados")
    m = pd.read_excel(xls, sheet_name=sh, header=hi)
    cols = {_norm(c): c for c in m.columns}

    def col(*names):
        for n in names:
            c = cols.get(_norm(n))
            if c is not None:
                return c
        return None

    def txt(c, empty=""):
        return (m[c].map(_txt).replace("", empty) if c is not None
                else pd.Series([empty] * len(m)))

    def num(c):
        return (pd.to_numeric(m[c], errors="coerce").fillna(0.0) if c is not None
                else pd.Series([0.0] * len(m)))

    mes = txt(col("Mes", "Camada"), "(Sin mes)").str.upper()
    vend = txt(col("Vendedor"), "(Sin vendedor)").str.upper()
    est = txt(col("Estado"), "(Sin estado)").str.upper()
    c_sis, c_cant, c_dif = col("En Sistema"), col("Cantidad"), col("Diferencial")
    fact, cob = num(col("Facturado")), num(col("Cobrado"))
    pend = num(col("Pendiente"))
    cant = num(c_cant)
    viva = est != ESTADO_ANULADA          # universo cobrable (sin anuladas)

    if c_dif is not None:
        dif = num(c_dif)
        # identidad, igual que en el maestro general: si no cierra, revienta aqui
        d = round(float((fact[viva] - cob[viva] - pend[viva] - dif[viva]).sum()), 2)
        if abs(d) > 0.05:
            raise ValueError(f"CAFE: identidad rota por {d} (Facturado != Cobrado+Dif+Pendiente)")
    else:
        # sin columna de Diferencial se deduce de la identidad. La comprobacion
        # deja de ser tautologica cotejando: (a) ningun diferencial negativo
        # --seria cobrar mas de lo facturado-- y (b) el total contra RESUMEN.
        dif = (fact - cob - pend).where(viva, 0.0)
        neg = round(float(dif.min()), 2)
        if neg < -0.05:
            raise ValueError(f"CAFE: diferencial negativo ({neg}): la identidad no cierra")
        # RESUMEN nombra distinto los dos diferenciales: el de la linea regular
        # es "Diferencial (no es deuda)" y el del cafe, a secas, "Diferencial".
        esp = resumen.get("diferencial")
        tot = round(float(dif[viva].sum()), 2)
        if esp is not None and abs(tot - esp) > 0.05:
            raise ValueError(f"CAFE: diferencial deducido {tot} != RESUMEN {esp}")

    def agg(keys, order):
        out = []
        for k in order:
            sel = keys == k
            sel_v = sel & viva
            o = {"k": k,
                 "fact": round(float(fact[sel_v].sum()), 2),
                 "cob": round(float(cob[sel_v].sum()), 2),
                 "pend": round(float(pend[sel_v].sum()), 2),
                 "dif": round(float(dif[sel_v].sum()), 2),
                 "anul": round(float(fact[sel & ~viva].sum()), 2),
                 "fac": int(sel.sum())}
            o["bultos"] = round(float(cant[sel_v].sum()), 2) if c_cant is not None else None
            out.append(o)
        return out

    # meses en orden de calendario, no alfabetico (AGOSTO iria antes que JULIO)
    meses = sorted(set(mes), key=lambda x: _MESES.index(x) if x in _MESES else 99)
    vends = sorted(set(vend))

    porMes = agg(mes, meses)
    porVend = sorted(agg(vend, vends), key=lambda o: -o["cob"])

    # --- comisiones del cafe: por bulto, nativas en Bs -----------------------
    # El corte 8 dejo la hoja como texto explicativo, sin tabla: la lista queda
    # vacia y el front oculta el grafico en vez de pintarlo en blanco.
    com = []
    shc = _find_sheet(xls, "COMISIONES CAFE")
    if shc is not None:
        rawc = _sheet(xls, shc)
        ci, cells = _header_row(rawc, ["Vendedor", "Comision Vendedor (Bs)"], limit=10)
        if ci is not None:
            c = pd.read_excel(xls, sheet_name=shc, header=ci)
            cc = {_norm(x): x for x in c.columns}
            gc = lambda k: cc.get(_norm(k))
            cv = c[gc("Vendedor")].map(_txt).str.upper()
            keep = (cv != "") & (~cv.str.startswith("TOTAL"))   # la hoja cierra con TOTAL
            cn = lambda k: (pd.to_numeric(c[gc(k)], errors="coerce").fillna(0.0)
                            if gc(k) is not None else pd.Series([0.0] * len(c)))
            vbs, sbs = cn("Comision Vendedor (Bs)"), cn("Comision Supervisor (Bs)")
            veq, seq = cn("Com. Vendedor ($-eq)"), cn("Com. Supervisor ($-eq)")
            bul = cn("Cantidad")
            for v in sorted(set(cv[keep])):
                sel = keep & (cv == v)
                com.append({"vend": v,
                            "vbs": round(float(vbs[sel].sum()), 2),
                            "sbs": round(float(sbs[sel].sum()), 2),
                            "veq": round(float(veq[sel].sum()), 2),
                            "seq": round(float(seq[sel].sum()), 2),
                            "bultos": round(float(bul[sel].sum()), 2),
                            "fac": int(sel.sum())})
            com.sort(key=lambda o: -o["vbs"])

    cerr = est == "CERRADA"
    sis = txt(c_sis).str.upper()
    tot = {"fact": round(float(fact.sum()), 2),
           "neto": round(float(fact[viva].sum()), 2),
           "cob": round(float(cob[viva].sum()), 2),
           "pend": round(float(pend[viva].sum()), 2),
           "dif": round(float(dif[viva].sum()), 2),
           "anul": round(float(fact[~viva].sum()), 2),
           "bultos": round(float(cant[viva].sum()), 2) if c_cant is not None else None,
           "fac": int(len(m)),
           "facCerr": int(cerr.sum()),
           "facPend": int(((~cerr) & viva).sum()),
           "facAnul": int((~viva).sum()),
           "montoCerr": round(float(fact[cerr].sum()), 2),
           "enSistema": int((sis.str.startswith("S")).sum()) if c_sis is not None else None,
           "comVend": round(sum(x["vbs"] for x in com), 2),
           "comSuper": round(sum(x["sbs"] for x in com), 2),
           "comVendEq": round(sum(x["veq"] for x in com), 2),
           "comSuperEq": round(sum(x["seq"] for x in com), 2)}
    tot["noEnSistema"] = (tot["fac"] - tot["enSistema"]) if c_sis is not None else None
    return {"desde": meses[0] if meses else "", "hasta": meses[-1] if meses else "",
            "tot": tot, "mes": porMes, "vend": porVend, "com": com}


def build(path):
    xls = pd.ExcelFile(path, engine="openpyxl")
    resumen = _resumen(xls)

    # --- MAESTRO: filas crudas (permiten filtrar en el navegador) -------------
    raw = _sheet(xls, "MAESTRO")
    hi, cells = _header_row(
        raw, [("Camada (despacho)", "Camada"), "Estado", "Facturado"])
    if hi is None:
        raise ValueError("MAESTRO: no se encontro la fila de encabezados")
    m = pd.read_excel(xls, sheet_name="MAESTRO", header=hi)
    cols = {_norm(c): c for c in m.columns}

    def col(*names):
        for n in names:
            c = cols.get(_norm(n))
            if c is not None:
                return c
        raise ValueError(f"MAESTRO: falta la columna {names[0]}")

    c_cam = col("Camada (despacho)", "Camada")
    c_prc = col("Precio (norm)", "Precio")
    c_grp, c_est = col("Grupo"), col("Estado")

    def dim(c, empty="(Sin dato)"):
        s = m[c].map(_txt).replace("", empty)
        vals = sorted(s.unique().tolist())
        idx = {v: i for i, v in enumerate(vals)}
        return vals, s.map(idx).astype(int).tolist()

    camada_v, camada_i = dim(c_cam, "(Sin camada)")
    vend_v, vend_i = dim(col("Vendedor"))
    grupo_v, grupo_i = dim(c_grp)
    precio_v, precio_i = dim(c_prc, "(Sin precio)")
    anal_v, anal_i = dim(col("Analista"))
    est_v, est_i = dim(c_est)

    def col_num(*names):
        return pd.to_numeric(m[col(*names)], errors="coerce").fillna(0.0).round(2).tolist()

    fact, cob = col_num("Facturado"), col_num("Cobrado")
    pend, dif = col_num("Pendiente"), col_num("Diferencial")
    anul = col_num("Anulado", "Anulada")

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

    # el MAESTRO contra la hoja RESUMEN: dos lecturas del mismo Excel que tienen
    # que dar lo mismo. Si no, el libro se contradice y no se publica.
    neto = round(sum(c["fact"] for c in checks), 2)
    esp = resumen.get("facturadoneto")
    if esp is not None and abs(neto - esp) > 0.05:
        raise ValueError(f"MAESTRO: facturado neto {neto} != RESUMEN {esp}")

    # --- Donde vive el cafe ---------------------------------------------------
    # Corte 7: dentro de MAESTRO (Grupo=CAFE) -> los totales ya lo incluyen.
    # Corte 8: en su propio maestro -> los totales de arriba NO lo incluyen.
    cafe_dentro = any(_norm(g) == _norm(GRUPO_CAFE) for g in grupo_v)

    # --- Cobrado por lista de precio (lo pidio Palomares) --------------------
    # Caja realmente entrada por precio: solo facturas CERRADAS. Mientras el cafe
    # vivio dentro de MAESTRO se excluia a proposito para no contarlo dos veces
    # (tiene su propia seccion); desde el corte 8 ya no esta aqui y el filtro no
    # quita nada. La hoja POR PRECIO LISTA si lo incluia -> los totales difieren
    # en exactamente el cobrado del cafe.
    prc = pd.DataFrame({
        "precio": m[c_prc].map(_txt).str.upper().replace("", "(Sin precio)"),
        "grupo": m[c_grp].map(_txt).str.upper(),
        "estado": m[c_est].map(_txt).str.upper(),
        "cob": pd.to_numeric(m[col("Cobrado")], errors="coerce").fillna(0.0)})
    prc = prc[(prc["grupo"] != GRUPO_CAFE) & (prc["estado"] == "CERRADA")]
    gp = prc.groupby("precio")["cob"].agg(["sum", "size"])
    precio_cob = sorted(({"cat": k, "cob": round(float(r["sum"]), 2), "fac": int(r["size"])}
                         for k, r in gp.iterrows() if r["sum"] > 0.005),
                        key=lambda o: -o["cob"])

    # Orden de camadas. Hasta el corte 7 las etiquetas eran YYYY-MM; desde el 8
    # son nombres de mes, que hay que ordenar por calendario y no alfabeticamente
    # (AGOSTO iria antes que MARZO). Las anuladas sin fecha de despacho caen en
    # "(Sin camada)" y quedan fuera del eje (la hoja POR CAMADA hace lo mismo).
    camadas = sorted(c for c in camada_v if re.fullmatch(r"\d{4}-\d{2}", c))
    if not camadas:
        camadas = sorted((c for c in camada_v if _norm(c).upper() in _MESES),
                         key=lambda c: _MESES.index(_norm(c).upper()))
    comis, com_moneda = _comisiones(xls)
    return {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M"),
        "camadaMin": camadas[0] if camadas else "", "camadaMax": camadas[-1] if camadas else "",
        "camadaOrder": camadas,
        "dims": {"camada": camada_v, "vend": vend_v, "grupo": grupo_v,
                 "precio": precio_v, "analista": anal_v, "estado": est_v},
        "anulIdx": ianul,
        "cafeDentro": cafe_dentro,
        "camadaAgg": _agg_sheet(xls, "POR CAMADA"),
        "vendAgg": _agg_sheet(xls, "POR VENDEDOR"),
        "grupoAgg": _agg_sheet(xls, "POR GRUPO"),
        "analistaAgg": _agg_sheet(xls, "POR ANALISTA"),
        "precioAgg": _agg_sheet(xls, "POR PRECIO LISTA"),
        "cobertura": _cobertura(xls),
        "comisiones": comis,
        "comMoneda": com_moneda,
        "comisDet": _comis_detalle(xls),
        "precioCob": precio_cob,
        "cafe": _cafe(xls, resumen),
        "rows": rows,
        "checks": checks,
    }


if __name__ == "__main__":
    import sys, json
    P = build(sys.argv[1] if len(sys.argv) > 1 else "cobranza.xlsx")
    print(json.dumps({k: (v if k not in ("rows",) else f"<{len(v)} filas>")
                      for k, v in P.items()}, ensure_ascii=False, indent=1)[:4000])
