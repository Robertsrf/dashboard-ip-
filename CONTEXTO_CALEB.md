# CONTEXTO — Dashboard Tiendas Caleb

> Todo lo que se sabe del Excel de ventas de **Tiendas Caleb** y cómo se procesa. Es el equivalente de
> `CONTEXTO_CLAUDE.md` (IP) para Caleb. **Léelo completo antes de procesar un archivo nuevo**, y sigue la
> §6 (certificación) antes de publicar nada.
> Verificado contra el archivo real el **2026-09-25**, sobre el **corte 1** (`FECHADOC` 2026-07-06 → 2026-09-07).
> No contiene PINs ni credenciales.

---

## 1. Resumen en 8 líneas

- Tiendas Caleb es una **ferretería y venta de materiales de construcción al detal**, una sola tienda
  (un almacén, una agencia), lema "Todo para construir, renovar y mejorar". Es parte del **Grupo IP**, junto
  con Distribuidora y Suministros IP y Reviplas.
- El insumo es **un solo Excel** que exporta el ERP: reporte "Artículos Vendidos O Entregados", una fila por
  línea de factura, **40 columnas**. Viene de Drive, carpeta `Informes IP / Tiendas caleb`.
- El archivo se llama `.XLS` pero **es un `.xlsx`** (firma ZIP `504b0304`). Se valida por firma, no por nombre.
- **Trae costo unitario**, así que Caleb tiene margen, cosa que IP no tiene.
- **El archivo llega dañado de forma predecible**: comillas de pulgadas que corren columnas y acentos en otra
  codificación. `caleb_clean.py` lo repara y lo certifica (§3 y §6).
- **La venta neta NO es la columna `SUMANETO`**: en este ERP esa columna no descuenta devoluciones (§4, C1).
- Los datos arrancan el **6 de julio de 2026** con la factura N.º 1. El dashboard usa los mismos cuatro
  usuarios y PINs que IP.
- Los datos de cada corte son **acumulativos** (se asume igual que en IP): el archivo nuevo trae todo desde el
  6 de julio. Comparar cortes, jamás sumarlos. *Confirmar en el corte 2* (§8).

---

## 2. Las 40 columnas

La fila 0 es el título del reporte; los encabezados están en la **fila 1** (`header=1`).

| Columna | Qué es | ¿Se usa? | Notas |
|---|---|---|---|
| `AGENCIA` | Sucursal | No | Siempre 1 |
| `TIPODOC` | Tipo de documento | No | Siempre `FAC` |
| `DOCUMENTO` | N.º de factura | **Sí** | Dos series: numérica (`1`…`2414`) y con asterisco (`*0000001`…) — ver C5 |
| `CODIGO` | Código del producto | **Sí** | Clave de producto (1 372 códigos). Mezcla texto y números: tratar como texto |
| `CODHIJO` | — | No | Siempre vacío |
| `PID` | Id único de la línea | Control | Único por fila; sirve para detectar duplicados |
| `NOMBRE` | Descripción del producto | **Sí** | Aquí vive la comilla de pulgadas que rompe filas (§3.1) |
| `GRUPO` | Grupo (número) | **Sí** | 1–4, sin nombre en el archivo: ver §5 |
| `SUBGRUPO` | Subgrupo | No | 73 % vacío |
| `CANTIDAD` | Unidades facturadas | **Sí** | |
| `CNTDEVUELT` | Unidades devueltas | **Sí** | Devoluciones reales (C2) |
| `PRECIOUNIT` | Precio de lista | Sí | Antes de descuento |
| `COSTOUNIT` | Costo unitario | **Sí** | Base del margen |
| `DSCTOUNIT`, `DSCTOPRC` | Descuento por unidad y % | Sí | Solo 68 líneas con descuento ($238 en total) |
| `PRECIOFIN` | Precio final cobrado | **Sí** | = precio − descuento. **Es el precio que vale** |
| `MONTONETO` | `CANTIDAD × PRECIOFIN` | Sí | Venta **bruta** de la línea |
| `MONTOTOTAL` | = `MONTONETO` | No | Idéntica en el 100 % |
| `IMPUESTO1` | Monto de IVA | No | Siempre 0: los montos van **sin IVA** |
| `TIMPUEPRC` | % de IVA (0 o 16) | Informativo | 89 % de las líneas con 0 |
| `COMISION` | — | Control | Siempre 0. **Si trae una fecha, la fila está corrida** (§3.1) |
| `FECHADOC` | Fecha de la factura | **Sí** | Fuente de verdad del período (C3) |
| `AGRUPADO` | — | No | Siempre 2 |
| `UNIDAD` | Unidad de medida | Sí | 84 valores. `1/4` llega convertido en la **fecha 2026-04-01** por Excel: mostrarlo como `1/4` |
| `CODCLIENTE` | RIF / cédula | **Sí** | Clave de cliente, normalizada (§5) |
| `NOMBRECLI` | Nombre del cliente | Sí | Solo para mostrar; no es clave |
| `EMISION` | Fecha de emisión | No | = `FECHADOC` en el 100 % |
| `ESTATUSDOC` | Estado del documento | Informativo | 0/1/2; el 97 % es 2. Significado sin confirmar (§8) |
| `ALMACEN` | Almacén | No | Siempre 1 |
| `VENDEDOR` | Código de vendedor | **Sí** | V0–V5, CAJERO2. Sin nombres (§5) |
| `SECTOR` | Zona | No | Solo 1 o vacío: no sirve para análisis geográfico |
| `ESTACION` | Caja / estación | Informativo | 4 = caja principal (98 %) |
| `FECHAYHORA` | Fecha y hora exacta | **Sí** | Base del mapa día × hora |
| `NOMPRO` | Descripción (otra copia) | No | Puede traer una segunda comilla (§3.1) |
| `REFERENCIA` | — | No | 99,9 % vacío |
| `MARCA` | Marca / proveedor | **Sí** | 26 valores. `HR.CA` y `MS` son el 82 % (parecen códigos de proveedor) |
| `EXISTENCIA` | Existencia **actual** del producto | **Sí** | Foto al momento de exportar, igual en todas las filas del producto |
| `CNTGRP` | — | No | Siempre 0 |
| `SUMACANT` | `CANTIDAD − CNTDEVUELT` | **Sí** | Unidades netas |
| `SUMANETO` | = `MONTONETO` | **No como venta** | No descuenta devoluciones (C1) |

---

## 3. Reparaciones (las hace `caleb_clean.py`)

### 3.1 Filas corridas por la comilla de pulgadas

**Qué pasa.** El ERP exporta un texto separado por `;` sin escapar las comillas. Cuando el nombre del
producto trae la marca de pulgadas (`LIMA MEDIA CAÑA 8"`), la comilla abre un campo entrecomillado que se
traga la columna siguiente. El resultado en Excel es:

- `NOMBRE` = `LIMA MEDIA CAÐA 8";01"` → el `01` es el **GRUPO**, pegado al nombre.
- **Todo lo que sigue queda corrido una columna a la izquierda**: `COMISION` trae la fecha, `FECHADOC` trae
  un 2, `CODCLIENTE` trae el nombre del cliente, `ALMACEN` trae el vendedor…

**Cómo se detecta.** `COMISION` es una fecha (en una fila sana siempre es 0).

**Cómo se repara.** Se separa el grupo del nombre y se inserta en `GRUPO`, y el resto de la fila se corre
una columna a la derecha. Si además `NOMPRO` contiene `";`, la comilla se repitió en esa columna (caso de los
`CLAVOS PARA CONCRETO 2.5"`), y la cola se corre **una columna más**: `NOMPRO`, `REFERENCIA` y `MARCA` salen
de partir ese texto por `";`.

**Corte 1:** 92 filas reparadas (90 corridas una columna, 2 corridas dos). Sin la reparación, esas líneas
pierden su fecha, su cliente y su venta (`SUMANETO` vacío), y descuadran la venta bruta.

### 3.2 Acentos en CP850

El texto llega en latin-1 leído como CP850. Cada glifo es una letra española:

| Llega | Es | Ejemplo |
|---|---|---|
| `Ð` | Ñ | `CAÐA` → CAÑA |
| `╔` | É | `JOS╔` → JOSÉ |
| `┴` | Á | `PL┴STICO` → PLÁSTICO |
| `═` | Í | `MAR═A` → MARÍA |
| `Ë` | Ó | `RONDËN` → RONDÓN |
| `┌` | Ú | `JES┌S` → JESÚS |
| `░` | ° | `90░` → 90° |
| `┤` | ´ | `D┤COLOR` → D´COLOR |

`¿`, `` ` `` y `?` sueltos en algunos nombres (`RODILLO 9¿`, `N? 12`) son **errores de tipeo del origen**:
se dejan como vienen. Si aparece un glifo nuevo de caja (`╗`, `┬`…), la verificación 8 lo marca: añadirlo a
la tabla `CP850` del script tras confirmar la letra con dos ejemplos.

### 3.3 Códigos de cliente

Un mismo cliente aparece como `V31173211` y `31173211`, o como `G-20001865-8` y `G200018658`. Se normaliza:
**se quitan guiones y puntos, y un código solo numérico es una cédula** (`V` delante). Corte 1: 1 247
códigos crudos → **1 244 clientes**.

---

## 4. Invariantes de cálculo (no cambian entre cortes)

**C1 · Venta neta = `SUMACANT × PRECIOFIN`. Nunca `SUMANETO`.**
En este ERP `SUMANETO` es igual a `MONTONETO` (la venta bruta) y **no descuenta lo devuelto**: una factura de
120 láminas devueltas completas trae `SUMACANT = 0` y `SUMANETO = 690`. Usar `SUMANETO` inflaría la venta
un 9,9 % en el corte 1. La definición elegida coincide con la de IP (venta neta de devoluciones).

| Concepto | Fórmula | Corte 1 |
|---|---|---|
| Venta bruta | Σ `MONTONETO` | $188 668,54 |
| Devoluciones | Σ `CNTDEVUELT × PRECIOFIN` | $16 957,61 (9,0 %) |
| **Venta neta** | Σ `SUMACANT × PRECIOFIN` | **$171 710,84** |
| Venta que entra al margen | venta neta de líneas con `PRECIOFIN > 0` y `COSTOUNIT > 0` | $171 689,50 |
| Costo de lo vendido | Σ `SUMACANT × COSTOUNIT` de esas mismas líneas | $126 300,81 |
| **Margen bruto** | (venta − costo de lo vendido) ÷ venta | **$45 388,69 (26,44 %)** |

**Cómo se calcula el margen bruto, y por qué así** (revisado el 2026-09-25 a pedido de Roberts). La
definición contable es *(venta neta − costo de la mercancía vendida) ÷ venta neta*: la venta neta ya
descuenta devoluciones y descuentos, y el costo es solo el de lo que efectivamente se vendió (lo devuelto
vuelve al inventario). Se verificó en el archivo que esto es aplicable tal cual:
- `PRECIOFIN = PRECIOUNIT − DSCTOUNIT` en el 100 % de las líneas: el descuento ya está en el precio.
- `MONTOTOTAL = MONTONETO` en el 100 % y el mismo producto se vende al mismo precio en líneas con IVA 16 y
  sin IVA: **los montos no traen IVA**, no hay impuesto que quitar.
- `COSTOUNIT` cambia de fecha a fecha en 168 productos: es el **costo del momento de la venta**, el correcto
  para el costo de ventas (no la foto del costo de hoy).
- El margen es **ponderado** (Σ margen ÷ Σ venta), nunca el promedio de márgenes por línea.
- Mediana del margen por línea 35,8 %; percentiles 5–95: 20 %–54 %. Solo 7 líneas ($32) quedan fuera de
  −10 %…70 %: 3 bajo costo (reales, se quedan) y 4 con costo nulo o casi nulo (ver C10).

Hasta el 2026-09-25 el dashboard metía el costo de las salidas a $0 en el costo de ventas y daba 24,35 %:
2,09 puntos de menos. Con la regla correcta el margen es estable por mes (julio 26,04 % · agosto 26,65 % ·
septiembre 26,46 %) y **Pinturas pasa de −18,2 % a 32,7 %**, porque casi todas sus salidas a $0 caían ahí.

Bruto − devoluciones difiere del neto en céntimos ($0,09) por el redondeo que el ERP aplica a `MONTONETO`.

**C2 · `CNTDEVUELT` son devoluciones reales.** En 418 de 423 líneas se devolvió la línea entera, casi siempre
la factura completa: es como se anula una factura fiscal en Venezuela (con nota de crédito). Corte 1: **231
facturas anuladas completas**, 148 de ellas de V4.

**C3 · El período lo dice `FECHADOC.max()`, nunca el nombre del archivo** (igual que el I1 de IP).

**C4 · Las salidas a precio $0 NO son venta ni costo de ventas: van aparte.** Líneas con `PRECIOFIN = 0`: la
mercancía sale sin cobro (autoconsumo, retiro del dueño, obsequio). Contablemente eso no es una venta, así que
su costo **no entra en el margen bruto**; se registra como gasto o como retiro del socio, y en Venezuela el
Reglamento de la Ley de ISLR (art. 177) exige llevar los retiros y el autoconsumo aparte de las ventas. El
dashboard las controla en su propia tarjeta y tabla. Corte 1: 253 líneas con precio $0, de las cuales **241
sacaron mercancía** (las otras 12 se devolvieron o no tenían costo): **$3 591,29 a costo**; el 89 % a un mismo
cliente y el 81 % registradas por V4. Las 4 líneas con precio > 0 por debajo del costo **sí** son ventas y
entran al margen (3 sacaron mercancía: $10,61 de pérdida).

**C5 · La serie `*` es de facturas fiscales y cuenta como venta normal** (confirmado por Roberts el
2026-09-24). Aparece el 14-ago-2026 en la caja 4, todas sus líneas con IVA 16 %, y 158 de sus 161 facturas
están anuladas completas: por eso aporta solo $373 netos. Sus devoluciones ($6 006) **sí** entran en el % de
devolución. El dashboard permite filtrar por serie.

**C6 · Facturas = documentos con venta neta > 0.** Una factura anulada completa no es una venta. Corte 1:
2 575 documentos, **2 216 con venta**. Ticket promedio = neto ÷ facturas con venta = **$77,49**.

**C7 · SKU vendidos = códigos con `SUMACANT > 0`** (como el I2 de IP). Corte 1: 1 294 de 1 372.

**C8 · Días de inventario = `EXISTENCIA` ÷ (unidades netas vendidas ÷ días con venta de la tienda en el período).**
`EXISTENCIA` es la foto del día de la exportación, no del fin de cada mes: no se puede reconstruir la
existencia histórica. "Agotado que se vende" = producto con venta en el período y `EXISTENCIA ≤ 0`.
Corte 1: 295 productos, que suman $20 322 de venta. El cemento gris (N.º 1) tenía 419 sacos y vende 39 por
día de venta: unos 11 días.

**C10 · Una venta sin costo registrado no entra al margen.** `PRECIOFIN > 0` con `COSTOUNIT = 0` daría 100 %
de margen falso. Corte 1: 3 líneas del 24-jul, $21,34 (tirro amarillo y machete COVO, V4). Cuentan en la venta
neta pero no en el cálculo del margen, y la tabla de Rentabilidad las muestra. Si en un corte pasan del 1 % de
la venta, es un problema de costos cargados en el ERP: avisar.

**C9 · Comparaciones entre meses por venta diaria.** Julio tiene 23 días de venta (arranca el 6), agosto 26 y
el último mes casi siempre está a medias. Comparar totales mensuales engaña; se compara `neto ÷ días con
venta`. La tienda cierra los domingos. Corte 1: julio $2 296/día, agosto $3 578/día (+55,8 %), septiembre
(6 días) $4 309/día (+20,4 % sobre agosto).

---

## 5. Dimensiones

| Dimensión | Origen | Valores (corte 1) |
|---|---|---|
| Grupo | `GRUPO` + nombres deducidos de los productos, **confirmados por Roberts** | 1 Construcción y acabados (50,2 %) · 2 Acero y techos (48,9 %) · 4 Pinturas (0,9 %) · 3 Jardín (0,04 %) |
| Vendedor | `VENDEDOR` | V1 $54,3 K · V2 $40,0 K · V4 $28,3 K · V3 $26,3 K · V5 $15,1 K · CAJERO2 $5,4 K · V0 $2,4 K. **Solo códigos** hasta que lleguen los nombres |
| Tipo de cliente | 1.ª letra del código normalizado | V/E Persona 86,5 % · J Empresa 9,2 % · G Gobierno 3,0 % · C Consumidor final 1,4 % (`C1` = "NO CONTRIBUYENTE") |
| Marca | `MARCA`, en mayúsculas | 25 valores tras unificar `imporcenter`/`IMPORCENTER`; 126 líneas sin marca → "(Sin marca)". `DIVRACA` (3 líneas) y `DISP` (1) parecen errores de tipeo de `DIVARCA` y `DISPONIBLE`: **no se fusionan** sin confirmarlo |
| Serie | 1.er carácter de `DOCUMENTO` | Numérica · Serie `*` |
| Hora | `FECHAYHORA` | Abierto de 7 a 19 h; picos a las 11 h y de 14 a 16 h |

Qué contiene cada grupo, para reconocerlo si el ERP cambia la numeración:
- **1 Construcción y acabados:** cemento, PVC, tanques, pego, porcelanato y cerámica, cable eléctrico.
- **2 Acero y techos:** cabillas, cerchas, losacero, láminas de techo y zinc, tubos estructurales.
- **3 Jardín:** césped artificial, tijeras, rastrillos, mangueras.
- **4 Pinturas:** caucho, fondos antióxido, esmaltes (Floripaint, El Pro, Reinco).

---

## 6. Certificación de un archivo nuevo (obligatoria)

Cuando Roberts suba un archivo nuevo a `Informes IP / Tiendas caleb`:

1. **Listar la carpeta de Drive** (id `1dkRKn4y-74QM8i0Q8n79IgdX8HAn2ih8`) y tomar el reporte más reciente.
   Bajarlo **por ID con curl**, no de `Downloads`:
   `curl -sL "https://drive.google.com/uc?export=download&id=<ID>" -o caleb.xlsx`. Comparar tamaño con Drive.
2. **Correr `python caleb_clean.py caleb.xlsx`.** Valida firma y columnas, repara, y corre 8 verificaciones:
   fechas válidas, `SUMACANT = CANTIDAD − CNTDEVUELT`, `MONTONETO = CANTIDAD × PRECIOFIN`,
   `SUMANETO = MONTONETO`, grupo en 1–4, devuelto ≤ facturado y sin glifos CP850 pendientes.
   **Si una falla, sale con código 1 y no se publica**: entender la fila antes de tocar el script.
3. **Cotejar contra el corte anterior** (tabla de §7):
   - `desde` debe seguir siendo 2026-07-06 si el archivo es acumulativo. Si cambia, el archivo trae solo lo
     nuevo: **no publicar**, preguntar.
   - Filas, neto y facturas no pueden bajar. Si bajan, avisar antes de publicar.
   - El neto de los meses cerrados no debería moverse más de un 2 %. Si se mueve, alguien tocó facturas
     viejas (una anulación tardía, por ejemplo): decirlo en el informe.
4. **Revisar lo nuevo**: vendedores, grupos, marcas o series que no estaban. Un vendedor nuevo entra con su
   código; un grupo 5 **detiene** el proceso (la verificación 6 falla) hasta ponerle nombre.
5. Recién entonces: build (§9), verificar descifrando con un PIN real, y publicar.

---

## 7. Cifras de control por corte

| Corte | `hasta` | Filas | Neto | Margen bruto | Facturas | Clientes | Devol. | Salidas $0 (costo) |
|---|---|---|---|---|---|---|---|---|
| 1 | 2026-09-07 | 4 726 | 171 710,84 | 26,44 % ($45 388,69) | 2 216 | 1 244 | 9,0 % | 3 591,29 |

Venta neta por mes (corte 1): julio 52 819 (23 días) · agosto 93 039 (26 días) · septiembre 25 853 (6 días).

---

## 8. Abierto

- **Nombres de los vendedores** (V0–V5, CAJERO2): se muestran por código hasta que Roberts los pase.
- **`ESTATUSDOC` 0/1/2**: no se sabe qué significa. El 0 y el 1 se concentran en gobierno y empresas
  (38 de 77 líneas con estado 0 son de gobierno), así que podría ser crédito pendiente o abonado. No se usa.
- **¿Los cortes son acumulativos?** Se asume que sí, como en IP; el corte 2 lo confirma (paso 6.3).
- **Qué es `HR.CA` y `MS`** en `MARCA` (el 82 % de la venta): parecen proveedores, no marcas.
- **Nombres repetidos**: si dos códigos de producto o de cliente comparten nombre, el build les añade el código
  (`CABILLA ESTRIADA 12MM… · 2351-026`), porque los filtros y los clics del front buscan por nombre.

---

## 9. El dashboard: cómo se construye

Estilo elegido el 2026-09-25: **D · Panel ejecutivo**, hermano del dashboard de IP (misma gramática; colores de
Caleb: azul `#0F4F9C` para datos y acciones, rojo `#D7191F` solo para alertas). Contrato de diseño en
`.impeccable/surfaces/template-caleb-html.md`; reglas generales en `NORMAS_SISTEMA.md`.

### 9.1 Archivos

| Archivo | Rol | ¿En git? |
|---|---|---|
| `caleb_clean.py` | Lee, repara y certifica el Excel (§3, §6). `build_caleb.py` lo llama primero | Sí |
| `build_caleb.py` | Arma el paquete, lo cifra con `secrets.json` (los mismos PINs de IP) y genera `caleb.html` | Sí |
| `template_caleb.html` | **Toda la UI de Caleb**. Único sitio donde se edita | Sí |
| `puerta.html` | Puerta del Grupo IP (elegir empresa → PIN). La comparten IP y Caleb | Sí |
| `assets/logo-caleb.png`, `assets/logo-ip.png` | Logos livianos (720 px y 360 px) que usan la puerta y la cabecera | Sí |
| `caleb.html` | Artefacto publicado. **Nunca se edita a mano** | Sí |
| `history_caleb.json` | Cifras de control, una entrada por corte (clave `hasta`) | Sí |
| `caleb_data.xlsx` | El Excel del corte, bajado de Drive | **No** (`*.xlsx`) |

### 9.2 Comando

```bash
python build_caleb.py caleb_data.xlsx "<fileId>|<modifiedTime>|<size>" caleb.html
```

Corte 1: `"10n7q7dFteMAE2y4PJQpwSgYRZCDBwOn4|2026-09-25T03:30:42Z|955142"`. El build imprime la certificación
de `caleb_clean.py` y **sale con error si alguna verificación falla o si queda un marcador sin reemplazar**.
`publish.py` ya sube `caleb.html` y `history_caleb.json` junto con los archivos de IP.

### 9.3 El paquete (`P`, cifrado dentro de `caleb.html`)

Cada fila es `[día, hora, factura, producto, vendedor, cliente, cantidad, devuelto, preciofin, costounit,
descuento]`. Grupo y marca **viven en el producto** (`prodGrupo`, `prodMarca`: ningún código cambia de grupo ni
de marca), el tipo en el cliente (`cliTipo`) y la serie en la factura (`docSerie`). La existencia va por
producto (`prodEx`). El mes sale de `dayMes[día]`. El front calcula neto, bruto, devuelto, costo y salidas a
$0 con las fórmulas de §4.

### 9.4 Lo que hace el front

- **8 indicadores:** venta neta · venta por día de venta (con cierre proyectado del mes en curso: lo vendido
  en el mes + ritmo × días de lunes a sábado que faltan) · margen bruto (C1, C4, C10; las salidas a $0 se
  informan aparte) · ticket ·
  facturas (y anuladas) · clientes (y nuevos) · devoluciones · agotados que se venden.
- **Comparador «Comparar con»**, en la barra de fechas: el mes anterior por día (por defecto) · el período
  anterior del mismo largo · el mismo tramo del mes pasado · sin comparar. Los flujos se comparan **por día
  de venta** (C9); margen y devolución, en **puntos**; el ticket, en %. Sin datos para comparar lo dice en
  la tarjeta en lugar de mostrar un número.
- **7 segmentadores:** meses, grupo, vendedor, tipo de cliente, marca, cliente y producto (estos dos con
  buscador: pintan 200 opciones y el buscador llega al resto). Casi todas las barras filtran al hacer clic.
- **8 secciones:** Resumen (con «Qué atender»), Ventas en el tiempo, Rentabilidad, Productos e inventario,
  Vendedores, Clientes (con «Clientes que dejaron de venir»: 2+ facturas y sin volver en 15/21/30 días),
  Devoluciones y anulaciones, Comparar períodos.
- **«Qué atender»** se arma solo con reglas fijas, sobre la selección: agotados que se venden · productos de
  los 10 más vendidos con menos de 15 días de inventario · vendedores con ≥ 3 % de la venta y margen 8 puntos
  bajo el de la tienda · salidas a $0 · devolución ≥ 5 % · clientes frecuentes sin volver en 21 días.

### 9.5 Verificación antes de publicar

`node --check` del último `<script>` de `template_caleb.html`, build limpio, entrar con un PIN real y recorrer
las 8 secciones en escritorio (1440 px) y teléfono (390 px) sin errores de consola ni desplazamiento lateral,
y `impeccable detect --json template_caleb.html puerta.html` sin hallazgos. Los indicadores con todo el
período deben dar las cifras de §7.
