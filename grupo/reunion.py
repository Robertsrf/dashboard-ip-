"""Paquete del modo reunion: lo que se proyecta delante de los vendedores.

Se arma por LISTA BLANCA: una clave o columna nueva del paquete normal no entra
aqui hasta que alguien decida que es segura. Fuera, siempre:
  * costos y margenes (Caleb),
  * el Word ejecutivo y el historial (traen la venta total de la empresa),
  * la cobertura de cobranza (reparte la facturacion TOTAL del sistema),
  * los enlaces de descarga de Drive.
El total de la empresa en $ y la proyeccion del ano tampoco se pintan (lo
decide el front con meta.modo), pero ojo: si se muestran ventas por vendedor,
su suma es el total. Lo que este paquete garantiza es que lo que no debe verse
y SE PUEDE quitar, no viaja.
"""

_META_COMUN = {"empresa", "version", "generated", "dateMin", "dateMax", "year", "dayZero",
               "dayCount", "dims", "changelog", "corte"}

REGLAS = {
    "ip": {"meta": _META_COMUN | {"riskList", "Pcob", "controles"},
           "cols": None},      # IP no tiene costos: pasan todas las columnas de venta
    "caleb": {"meta": _META_COMUN,
              "cols": {"dia", "hora", "doc", "prod", "vend", "cli", "mes", "grupo", "marca",
                       "tipo", "serie", "cant", "dev", "q", "neto", "bruto", "devm"}},
}


def limpiar(empresa, meta, columnas):
    reglas = REGLAS[empresa]
    m = {k: v for k, v in meta.items() if k in reglas["meta"]}
    if "Pcob" in m and m["Pcob"]:
        m["Pcob"] = dict(m["Pcob"], cobertura=[])
    m["modo"] = "reunion"
    permitidas = reglas["cols"]
    c = {k: v for k, v in columnas.items() if permitidas is None or k in permitidas}
    return m, c
