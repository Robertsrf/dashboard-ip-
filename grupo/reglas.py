"""Reglas de datos de negocio que comparten el dashboard y el pipeline de informes.

Viven aqui, y no en cada build, para que el dashboard y los informes nunca
lean el mismo Excel de dos maneras.
"""
import pandas as pd

# Codigos de vendedor que cambiaron de titular. El Excel trae el NOMBRE con el
# que el ERP exporta el codigo, y ese nombre se queda pegado al titular viejo:
# desde que aparece el nuevo, todo lo del viejo es del nuevo (pedido de Roberts
# el 2026-10-19). `desde` = primera aparicion conocida del nuevo fuera de los
# datos de venta; si el nuevo ya sale en los datos antes, manda esa fecha.
VEND_RELEVO = [
    # (codigo, viejo, nuevo, desde)
    (10, "Leonardo", "Héctor", None),        # Héctor sale en las ventas desde el 18-05
    (20, "Edixon", "Jorge", "2026-09-24"),   # 1.a factura de Jorge: *0140591 (conciliacion corte 11)
]

# Grafias del mismo vendedor (la hoja LEYENDA de la conciliacion las unifica igual)
VEND_ALIAS = {"Hector": "Héctor", "Jose": "José", "Televenta3": "Televenta"}


def vendedores(df):
    """Aplica alias y relevos sobre VENDEDOR. Espera VENDEDOR sin espacios
    sobrantes y FECHADOC como fecha. Devuelve el mismo DataFrame."""
    df["VENDEDOR"] = df["VENDEDOR"].replace(VEND_ALIAS)
    for _codigo, viejo, nuevo, desde in VEND_RELEVO:
        inicio = df.loc[df["VENDEDOR"] == nuevo, "FECHADOC"].min()
        if desde is not None:
            fijo = pd.Timestamp(desde)
            inicio = fijo if pd.isna(inicio) else min(inicio, fijo)
        if pd.isna(inicio):
            continue
        df.loc[(df["VENDEDOR"] == viejo) & (df["FECHADOC"] >= inicio), "VENDEDOR"] = nuevo
    return df
