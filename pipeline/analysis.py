"""Analisis completo de un corte -> JSON (mejoras A1 y A4).

Recibe la ruta del Excel del corte y escupe UN JSON con todo el analisis:
periodo, totales, serie mensual, proyeccion, concentracion, cohortes,
vendedores, marcas, sectores, riesgo/recuperados y las dimensiones que hasta
ahora estaban dormidas (REFERENCIA, SUBGRUPO, CODCLIENTE).

    python pipeline/analysis.py <excel> [salida.json]

Es una herramienta PARALELA: no la lee build_dashboard.py, no entra en el
index.html y no la sirve GitHub Pages. Las definiciones de riesgo y
recuperados replican las de reports.py para que las cifras cuadren con el
dashboard.
"""
import sys, os, json, calendar
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from clean import clean_df, filtrar_informe, vendedores_reales, controles, VENDEDORES_ESPURIOS


def _f(x):
    return round(float(x), 2)


def _top(serie, n, key="nombre", val="neto"):
    return [{key: str(k), val: _f(v)} for k, v in serie.head(n).items()]


def periodo(df):
    """INVARIANTE: el periodo sale de FECHADOC, NUNCA del nombre del archivo."""
    dmin, dmax = df["FECHADOC"].min(), df["FECHADOC"].max()
    meses = sorted(df["MES"].unique().tolist())
    ultimo = meses[-1]
    yy, mm = int(ultimo.split("-")[0]), int(ultimo.split("-")[1])
    dias_mes = calendar.monthrange(yy, mm)[1]
    dia_max = int(df[df["MES"] == ultimo]["FECHADOC"].dt.day.max())
    return {
        "fecha_min": dmin.strftime("%Y-%m-%d"),
        "fecha_max": dmax.strftime("%Y-%m-%d"),
        "meses": meses,
        "mes_ultimo": ultimo,
        "dia_max_mes_ultimo": dia_max,
        "dias_del_mes": dias_mes,
        "mes_parcial": dia_max < dias_mes - 2,
    }


def serie_mensual(df):
    m = df.groupby("MES").agg(neto=("SUMANETO", "sum"), facturas=("DOCUMENTO", "nunique"),
                              clientes=("NOMBRECLI", "nunique"), unidades=("CANTIDAD", "sum"))
    m["ticket"] = m["neto"] / m["facturas"]
    return [{"mes": i, "neto": _f(r.neto), "facturas": int(r.facturas),
             "clientes": int(r.clientes), "unidades": _f(r.unidades),
             "ticket": _f(r.ticket)} for i, r in m.iterrows()]


def proyeccion(df, per):
    """Regresion lineal sobre la serie mensual, con el mes parcial anualizado."""
    m = df.groupby("MES")["SUMANETO"].sum()
    ys = [float(v) for v in m.values]
    if per["mes_parcial"] and per["dia_max_mes_ultimo"]:
        ys[-1] = ys[-1] / per["dia_max_mes_ultimo"] * per["dias_del_mes"]
    xs = list(range(len(ys)))
    n = len(xs)
    if n >= 2:
        sx, sy = sum(xs), sum(ys)
        sxx = sum(x * x for x in xs)
        sxy = sum(x * y for x, y in zip(xs, ys))
        den = n * sxx - sx * sx
        slope = (n * sxy - sx * sy) / den if den else 0.0
        inter = (sy - slope * sx) / n
    else:
        slope, inter = 0.0, (ys[-1] if ys else 0.0)
    mes_ini = int(per["mes_ultimo"].split("-")[1])
    faltan = 12 - mes_ini
    fut = [{"mes": f'{per["mes_ultimo"].split("-")[0]}-{mes_ini + k:02d}',
            "proyectado": _f(max(0.0, inter + slope * (n - 1 + k)))} for k in range(1, faltan + 1)]
    return {
        "pendiente_mensual": _f(slope),
        "mes_actual_anualizado": _f(ys[-1]) if ys else 0.0,
        "meses_proyectados": fut,
        "cierre_estimado_ano": _f(sum(float(v) for v in m.values) + sum(f["proyectado"] for f in fut)),
        "nota": "Con mes parcial el ultimo punto se anualiza por dias transcurridos.",
    }


def concentracion(df):
    cli = df.groupby("NOMBRECLI")["SUMANETO"].sum().sort_values(ascending=False)
    total = float(cli.sum())
    acum, pareto80 = 0.0, 0
    for v in cli.values:
        acum += float(v)
        pareto80 += 1
        if total and acum / total >= 0.80:
            break
    return {
        "top10_share": _f(cli.head(10).sum() / total * 100) if total else 0.0,
        "top20_share": _f(cli.head(20).sum() / total * 100) if total else 0.0,
        "clientes_para_80pct": pareto80,
        "clientes_totales": int(cli.shape[0]),
        "top20_clientes": _top(cli, 20, "cliente"),
    }


def cohortes(df):
    """Mes de primera compra de cada cliente y su aporte acumulado."""
    primera = df.groupby("NOMBRECLI")["MES"].min()
    neto = df.groupby("NOMBRECLI")["SUMANETO"].sum()
    out = {}
    for c, mes in primera.items():
        d = out.setdefault(mes, {"mes_alta": mes, "clientes": 0, "neto_acumulado": 0.0})
        d["clientes"] += 1
        d["neto_acumulado"] += float(neto[c])
    return [dict(v, neto_acumulado=_f(v["neto_acumulado"])) for v in sorted(out.values(), key=lambda x: x["mes_alta"])]


def bloque_vendedores(df):
    d = vendedores_reales(df)
    v = d.groupby("VENDEDOR").agg(neto=("SUMANETO", "sum"), facturas=("DOCUMENTO", "nunique"),
                                  clientes=("NOMBRECLI", "nunique"), sku=("PRODUCTO", "nunique"))
    v["ticket"] = v["neto"] / v["facturas"]
    v = v.sort_values("neto", ascending=False)
    total = float(v["neto"].sum())
    return {
        "excluidos": VENDEDORES_ESPURIOS,
        "activos": int(v.shape[0]),
        "ranking": [{"vendedor": str(i), "neto": _f(r.neto), "share": _f(r.neto / total * 100) if total else 0.0,
                     "facturas": int(r.facturas), "clientes": int(r.clientes),
                     "sku": int(r.sku), "ticket": _f(r.ticket)} for i, r in v.iterrows()],
    }


def bloque_marcas(df):
    """Usa MARCA_LIMPIA: sin quitar el sufijo ' (N)' una marca se parte en dos."""
    m = df.groupby("MARCA_LIMPIA")["SUMANETO"].sum().sort_values(ascending=False)
    cruda = df.groupby("MARCA")["SUMANETO"].sum()
    return {
        "marcas_distintas": int(m.shape[0]),
        "marcas_distintas_sin_limpiar": int(cruda.shape[0]),
        "top20": _top(m, 20, "marca"),
    }


def bloque_sectores(df):
    s = df.groupby("SECTOR").agg(neto=("SUMANETO", "sum"), clientes=("NOMBRECLI", "nunique"))
    s = s.sort_values("neto", ascending=False)
    return [{"sector": str(i), "neto": _f(r.neto), "clientes": int(r.clientes)} for i, r in s.iterrows()]


def bloque_riesgo(df, per):
    """Mismas definiciones que reports.py, para que las cifras cuadren."""
    meses = per["meses"]
    ultimo = meses[-1]
    recientes2 = set(meses[-2:])
    previos = set(meses[:-2])
    cli_meses = df.groupby("NOMBRECLI")["MES"].apply(set)
    cli_tot = df.groupby("NOMBRECLI")["SUMANETO"].sum().sort_values(ascending=False)
    ult_compra = df.groupby("NOMBRECLI")["FECHADOC"].max()
    vend_dom = (df.groupby(["NOMBRECLI", "VENDEDOR"])["SUMANETO"].sum().reset_index()
                .sort_values("SUMANETO", ascending=False).drop_duplicates("NOMBRECLI")
                .set_index("NOMBRECLI")["VENDEDOR"])
    riesgo = [c for c in cli_tot.index if (cli_meses[c] & previos) and not (cli_meses[c] & recientes2)]
    prev2 = set(meses[-3:-1]); antes = set(meses[:-3])
    recup = [c for c in cli_tot.index if (ultimo in cli_meses[c]) and not (cli_meses[c] & prev2) and (cli_meses[c] & antes)]
    val_ult = df[df["MES"] == ultimo].groupby("NOMBRECLI")["SUMANETO"].sum()
    return {
        "advertencia": ("Con el mes en curso incompleto el universo de riesgo sale INFLADO: "
                        "no leer estas cifras con un mes a medias."),
        "mes_parcial": per["mes_parcial"],
        "en_riesgo": len(riesgo),
        "valor_en_riesgo": _f(cli_tot[riesgo].sum()) if riesgo else 0.0,
        "recuperados": len(recup),
        "valor_recuperado": _f(val_ult[recup].sum()) if recup else 0.0,
        "top20_en_riesgo": [{"cliente": str(c), "historico": _f(cli_tot[c]),
                             "vendedor": str(vend_dom.get(c, "-")),
                             "ultima_compra": ult_compra[c].strftime("%Y-%m-%d")}
                            for c in sorted(riesgo, key=lambda c: -cli_tot[c])[:20]],
    }


def bloque_dimensiones_dormidas(df):
    """Mejora A4: REFERENCIA, SUBGRUPO y CODCLIENTE, que estaban sin usar."""
    out = {}
    if "REFERENCIA" in df.columns:
        r = df.groupby("REFERENCIA").agg(neto=("SUMANETO", "sum"), sku=("PRODUCTO", "nunique"))
        r = r.sort_values("neto", ascending=False)
        out["referencia"] = {
            "distintas": int(r.shape[0]),
            "top20": [{"referencia": str(i), "neto": _f(x.neto), "sku": int(x.sku)} for i, x in r.head(20).iterrows()],
        }
    if "SUBGRUPO" in df.columns:
        s = df.groupby("SUBGRUPO")["SUMANETO"].sum().sort_values(ascending=False)
        out["subgrupo"] = {"distintos": int(s.shape[0]), "top20": _top(s, 20, "subgrupo")}
    if "CODCLIENTE" in df.columns:
        por_cod = df["CODCLIENTE"].nunique()
        por_nom = df["NOMBRECLI"].nunique()
        # Un mismo codigo con varios nombres = el mismo cliente contado dos veces.
        nombres = df.groupby("CODCLIENTE")["NOMBRECLI"].nunique()
        dup = nombres[nombres > 1]
        detalle = []
        for cod in dup.index[:30]:
            vs = sorted(df[df["CODCLIENTE"] == cod]["NOMBRECLI"].unique().tolist())
            detalle.append({"codcliente": str(cod), "variantes": vs})
        out["codcliente"] = {
            "clientes_por_codigo": int(por_cod),
            "clientes_por_nombre": int(por_nom),
            "diferencia": int(por_nom - por_cod),
            "codigos_con_varios_nombres": int(dup.shape[0]),
            "ejemplos": detalle,
            "nota": ("La diferencia entre contar por nombre y por codigo son clientes con "
                     "variantes de nombre que hoy se cuentan doble. CODCLIENTE es la clave fiable."),
        }
    return out


def analizar(xlsx):
    crudo = clean_df(pd.read_excel(xlsx, engine="openpyxl"))
    df = filtrar_informe(crudo)          # universo de INFORMES
    per = periodo(df)
    total = float(df["SUMANETO"].sum())
    return {
        "fuente": {
            "archivo": os.path.basename(xlsx),
            "advertencia": ("El nombre del archivo puede mentir sobre el periodo. "
                            "La fuente de verdad es FECHADOC.max()."),
        },
        "controles_data_completa": controles(crudo),
        "controles_universo_informe": controles(df),
        "periodo": per,
        "totales": {
            "neto": _f(total),
            "facturas": int(df["DOCUMENTO"].nunique()),
            "clientes": int(df["NOMBRECLI"].nunique()),
            "unidades": _f(df["CANTIDAD"].sum()),
            "devoluciones_unidades": _f(df["CNTDEVUELT"].sum()),
            "ticket_promedio": _f(total / df["DOCUMENTO"].nunique()) if len(df) else 0.0,
            # INVARIANTE: SKU con SUMACANT > 0; sin el filtro el conteo se infla.
            "sku": int(df[df["SUMACANT"] > 0]["PRODUCTO"].nunique()),
            "sku_sin_filtro": int(df["PRODUCTO"].nunique()),
            "nota_devoluciones": "CNTDEVUELT no es venta. La venta es SUMANETO.",
        },
        "serie_mensual": serie_mensual(df),
        "proyeccion": proyeccion(df, per),
        "concentracion": concentracion(df),
        "cohortes": cohortes(df),
        "vendedores": bloque_vendedores(df),
        "marcas": bloque_marcas(df),
        "sectores": bloque_sectores(df),
        "riesgo": bloque_riesgo(df, per),
        "dimensiones_dormidas": bloque_dimensiones_dormidas(df),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    xlsx = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "analysis.json")
    data = analizar(xlsx)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    p = data["periodo"]
    print(f'OK -> {out}')
    print(f'  Periodo real (FECHADOC): {p["fecha_min"]} -> {p["fecha_max"]}'
          f'{"  [MES PARCIAL]" if p["mes_parcial"] else ""}')
    print(f'  Neto informe: {data["totales"]["neto"]:,.2f} | facturas {data["totales"]["facturas"]:,}'
          f' | clientes {data["totales"]["clientes"]:,} | SKU {data["totales"]["sku"]:,}')
    print(f'  En riesgo: {data["riesgo"]["en_riesgo"]} | recuperados: {data["riesgo"]["recuperados"]}')
