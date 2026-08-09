"""Limpieza unica de la data de ventas (mejora A2).

Este modulo lo usa SOLO el pipeline de informes (pipeline/analysis.py).
NO lo importa build_dashboard.py: el dashboard hace su propia normalizacion y
sus totales incluyen a proposito AMERICO y REVIPLAST. Ver los invariantes en
CONTEXTO_CLAUDE.md.

Uso:
    from clean import clean_df, VENDEDORES_ESPURIOS, filtrar_informe
"""
import pandas as pd

# Vendedores que aparecen en la data pero no son vendedores reales: se excluyen
# del analisis de desempeno del equipo (no de los totales de venta).
VENDEDORES_ESPURIOS = ["2", "23", "Leonardo"]

# Valores de GRUPO que son basura de captura.
GRUPOS_ESPURIOS = ["6"]

# En los INFORMES (no en el dashboard) se excluyen estos dos.
MARCAS_EXCLUIDAS_INFORME = ["AMERICO"]
CLIENTES_EXCLUIDOS_INFORME = ["REVIPLAST"]

TEXTO = ["VENDEDOR", "MARCA", "NOMBRECLI", "GRUPO", "SUBGRUPO", "SECTOR",
         "PRODUCTO", "REFERENCIA", "CODCLIENTE", "DOCUMENTO"]
NUMERICAS = ["CANTIDAD", "CNTDEVUELT", "PRECIOUNIT", "SUMACANT", "SUMANETO"]


def clean_df(df):
    """Normaliza el DataFrame crudo del Excel del corte.

    - Descarta filas sin DOCUMENTO o sin FECHADOC valida.
    - Quita espacios sobrantes en las columnas de texto ("Jesus " -> "Jesus").
    - Crea MARCA_LIMPIA quitando el sufijo " (N)" que parte marcas en dos
      (por ese sufijo Sucream casi se contabiliza como cero).
    - Fuerza a numero las columnas de importe/cantidad.
    - Anade MES ("YYYY-MM") para las series mensuales.

    No elimina vendedores espurios ni marcas excluidas: eso se decide en cada
    analisis con filtrar_informe() / VENDEDORES_ESPURIOS, para que los totales
    de control sigan siendo auditables.
    """
    df = df.copy()
    df = df.dropna(subset=["DOCUMENTO"])
    df["FECHADOC"] = pd.to_datetime(df["FECHADOC"], errors="coerce")
    df = df.dropna(subset=["FECHADOC"])

    for col in TEXTO:
        if col in df.columns:
            df[col] = df[col].fillna("(Sin dato)").astype(str).str.strip()

    for col in NUMERICAS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    df["MARCA_LIMPIA"] = (df["MARCA"].astype(str)
                          .str.replace(r"\s*\(N\)$", "", regex=True).str.strip()
                          .replace({"nan": "(Sin marca)", "": "(Sin marca)"}))
    df["MES"] = df["FECHADOC"].dt.strftime("%Y-%m")
    return df


def vendedores_reales(df):
    """Vista sin los vendedores espurios (para ranking y desempeno)."""
    return df[~df["VENDEDOR"].isin(VENDEDORES_ESPURIOS)]


def filtrar_informe(df):
    """Universo de los INFORMES: sin AMERICO y sin REVIPLAST.

    El dashboard SI los incluye. Por eso los totales del informe y los del
    dashboard no cuadran, y no es un bug.
    """
    mk = df["MARCA"].astype(str).str.upper()
    cl = df["NOMBRECLI"].astype(str).str.upper()
    fuera = mk.isin([m.upper() for m in MARCAS_EXCLUIDAS_INFORME])
    for c in CLIENTES_EXCLUIDOS_INFORME:
        fuera = fuera | cl.str.contains(c.upper(), na=False)
    return df[~fuera]


def controles(df):
    """Totales de control para verificar que la limpieza no se comio nada."""
    return {
        "filas": int(len(df)),
        "neto_total": round(float(df["SUMANETO"].sum()), 2),
        "facturas": int(df["DOCUMENTO"].nunique()),
        "clientes_por_nombre": int(df["NOMBRECLI"].nunique()),
        "clientes_por_codigo": int(df["CODCLIENTE"].nunique()) if "CODCLIENTE" in df.columns else None,
        "fecha_min": df["FECHADOC"].min().strftime("%Y-%m-%d"),
        "fecha_max": df["FECHADOC"].max().strftime("%Y-%m-%d"),
        "marcas": int(df["MARCA_LIMPIA"].nunique()),
        "vendedores_reales": int(vendedores_reales(df)["VENDEDOR"].nunique()),
    }


if __name__ == "__main__":
    import sys, json
    d = clean_df(pd.read_excel(sys.argv[1], engine="openpyxl"))
    print(json.dumps(controles(d), ensure_ascii=False, indent=2))
    print("\nInforme (sin AMERICO/REVIPLAST):")
    print(json.dumps(controles(filtrar_informe(d)), ensure_ascii=False, indent=2))
