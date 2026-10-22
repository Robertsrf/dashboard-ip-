# CONTEXTO — Dashboard IP (Distribuidora y Suministros IP)

> Documento único de contexto para cargar en un **Proyecto de Claude**.
> Contiene: qué es el sistema, cómo está construido, cómo son los datos, cómo se despliega,
> cómo se edita sin romperlo, y las trampas conocidas.
> Verificado contra el código y los datos reales el **2026-10-20** (v4), sobre el **10.º corte** (`dateMax` 2026-09-30).
> **Proceso, arquitectura e interfaz desde la v4: `METODO.md` y `DESIGN.md`.** Este documento manda en los datos.
> **No contiene PINs, tokens ni credenciales.**

---

## 1. Resumen en 10 líneas

- Es un **dashboard de inteligencia de ventas** para *Distribuidora y Suministros IP* (distribuidora de víveres, desechables y repostería en el occidente de Venezuela).
- Es **una sola página estática** (`index.html`, ~6,8 MB) que se genera con Python desde un Excel de ventas.
- Los datos van **cifrados dentro del HTML** (AES-256-GCM). Se abren con un **PIN de 6 dígitos** por usuario; el descifrado ocurre en el navegador con WebCrypto.
- Los gráficos son **ECharts 5.5.1** (desde CDN, con respaldo local en `vendor/echarts.min.js` si el CDN no responde). No hay backend, ni base de datos, ni API.
- Se publica en **GitHub Pages** → https://robertsrf.github.io/dashboard-ip-/ (repo `Robertsrf/dashboard-ip-`, rama `main`).
- Se actualiza **a petición**, no en automático: se suben los archivos a Google Drive y se pide la corrida en el chat (§10.2). Las tareas programadas de Cowork se retiraron el 2026-08-09.
- Desde la v4 (2026-10-20) la interfaz vive en **`app/`** (núcleo común a todas las empresas + un módulo por empresa) y los datos viajan en un **paquete v2** de columnas binarias comprimidas (`grupo/paquete.py`): `index.html` bajó de 7,1 MB a 2,2 MB con dos paquetes (el normal y el de reunión).
- Los datos son **cortes quincenales acumulativos**: el último mes casi siempre está incompleto, y el sistema lo compensa explícitamente.
- Autor: **Ing. Roberts Flores**.
- Documentación: `CLAUDE.md` (entrada), `METODO.md` (proceso), `DESIGN.md` (interfaz), este documento (datos de IP), `CONTEXTO_CALEB.md` y `docs/v4-*.md`.

---

## ⚠️ INVARIANTES METODOLÓGICOS — leer antes de tocar una sola cifra

Reglas que **no cambian entre cortes**. Cada una nació de un error real o estuvo a punto de causarlo.
Si vas a producir un informe, verifica las siete antes de empezar.

**I1 · El nombre del archivo puede mentir. La fuente de verdad del período es `FECHADOC.max()`.**
Nunca deduzcas el corte del nombre del Excel. Ya pasó: un archivo llamado `..._1507` (que sugiere 15 jul)
contenía datos hasta el **31 de julio**; fiarse del nombre habría producido el informe equivocado.
`pipeline/analysis.py` imprime siempre el rango real de `FECHADOC` como primera línea, justamente para esto.

**I2 · SKU = `DISTINCTCOUNT(PRODUCTO)` con `SUMACANT > 0`.**
Sin ese filtro el conteo se infla con productos que aparecen en la data pero no se vendieron.
Sobre el 8.º corte: **1 964** con filtro frente a 1 990 sin él (en el 6.º fueron 1 852 vs. 1 876).

**I3 · Los informes excluyen AMÉRICO y REVIPLAST; el dashboard los incluye.**
Por eso el total del dashboard (**$6,43 M** en el corte 8) nunca cuadra con el del informe ejecutivo (**$3,49 M**).
**No es un bug** — es la diferencia de universo. Si alguien reporta el descuadre, esta es la respuesta.

**I4 · Con el mes en curso incompleto, el universo de "riesgo" está inflado.**
El riesgo se define como "sin comprar en los últimos 2 meses"; si uno de esos dos meses va a medias,
entran clientes que sencillamente aún no han comprado. **Nunca leer el riesgo con un mes a medias**
sin decirlo explícitamente en el informe.

**I5 · Las devoluciones no son venta.** `CNTDEVUELT` es un contador de unidades devueltas.
La venta es y solo es **`SUMANETO`**. No restar ni sumar `CNTDEVUELT` a los ingresos.

**I6 · `CODCLIENTE` es la clave fiable de cliente, no `NOMBRECLI`.**
Por nombre salen **1 566** clientes; por código, **1 554** (corte 8). La diferencia son variantes de escritura del
mismo cliente (p. ej. `COMERCIALIZADORA WENDYS, C.A` y `OMERCIALIZADORA WENDYS, C.A`, con la C perdida),
que hoy se cuentan dos veces. Los KPIs históricos cuentan por nombre: al cambiarlo, la serie se rompe.

**I7 · Los cortes son acumulativos.** Cada Excel trae **todo el año**, no solo lo nuevo.
Comparar cortes = comparar totales. **Jamás sumarlos.**

> Los invariantes I1, I2, I4, I5 y I6 están implementados y comentados en `pipeline/analysis.py`;
> la limpieza de I6 y de los vendedores espurios, en `pipeline/clean.py`.

---

## 2. Inventario de archivos del repo

| Archivo | Rol | ¿En git? |
|---|---|---|
| `app/` | **Toda la interfaz**: `shell.html` (armazón), `core.css`, `motor.js` (datos), `core.js` (núcleo), `ip.js`, `caleb.js` (módulos), `puerta.html`, `favicons.json` | Sí |
| `grupo/` | Núcleo Python: `paquete.py` (paquete v2), `pagina.py` (arma el HTML y la CSP), `reglas.py` (relevos de vendedor), `reunion.py` (paquete de reunión), `changelog.py` (Novedades) | Sí |
| `build_dashboard.py` | Build de IP: `cargar()` → `ventas()` → `informes()` → `adjuntos()` → paquetes → página | Sí |
| `build_caleb.py`, `caleb_clean.py` | Build y certificación de Caleb (`CONTEXTO_CALEB.md`) | Sí |
| `cobranza.py`, `risklist.py`, `wordrep.py` | Parsers de la conciliación, la lista de riesgo y el Word | Sí |
| `reports.py` | `history.json` y el resumen ejecutivo de respaldo (sin Word) | Sí |
| `secure.py` | AES-256-GCM + PBKDF2 por PIN; una clave maestra por paquete | Sí |
| `publish.py` | `git add` de los artefactos + commit + push | Sí |
| `changelog.json` | **Novedades**: todas las versiones desde el 2026-07-07 | Sí |
| `history.json`, `history_caleb.json` | Historial de cortes (uno por corte) | Sí |
| `tests/`, `tools/` | Pruebas (`unittest`, `node --test`) y verificación (`verificar.py`, `navegador.py`, `paridad.mjs`) | Sí |
| `vendor/echarts.min.js` | ECharts **5.5.1**, servido desde el propio sitio (sin CDN) | Sí |
| `ve_states.geojson`, `assets/` | Mapa de estados; logos (`assets/fuentes/` guarda los originales) | Sí |
| `pipeline/` | Herramienta paralela de informes; usa `grupo/reglas.py` | Sí |
| `index.html`, `caleb.html` | **Artefactos**. Nunca se editan a mano | Sí |
| `.nojekyll` | Evita que GitHub Pages procese el sitio con Jekyll. **No borrar** | Sí |
| `secrets.json` | PIN de los 4 usuarios y el de reunión | **Nunca** |
| `data_ip.xlsx`, `risk_list.xlsx`, `exec.docx`, `cobranza.xlsx`, `caleb_data.xlsx` | Insumos de Drive | **No** |

---

## 3. Arquitectura y flujo de datos

El diagrama y la tabla de responsabilidades están en **`METODO.md` §1**. Lo esencial: no hay servidor; el
navegador descifra el paquete, lo descomprime con `DecompressionStream` y el motor (`app/motor.js`) filtra en
una sola pasada sobre arreglos tipados (**83 239 filas** en el corte 10). Solo se pinta la sección visible.

---

## 4. Los datos

### 4.1 Excel fuente `data_ip.xlsx` — 16 columnas

| Columna | Tipo | Notas |
|---|---|---|
| `DOCUMENTO` | texto | Nº de factura. Formato `*0116727 `. **Es la unidad de "factura"** para KPIs. |
| `PRODUCTO` | texto | Descripción del SKU. |
| `GRUPO` | texto | Categoría mayor (6 valores). |
| `SUBGRUPO` | float | Código numérico de subgrupo. **9 106 nulos. El dashboard NO lo usa.** |
| `CANTIDAD` | float | Unidades vendidas. |
| `CNTDEVUELT` | float | Unidades devueltas. |
| `PRECIOUNIT` | float | Precio unitario (USD). |
| `FECHADOC` | fecha | Fecha del documento. Filas sin fecha se **descartan**. |
| `CODCLIENTE` | texto | Código de cliente (1 554 únicos). **No se usa en el dashboard.** |
| `NOMBRECLI` | texto | Nombre del cliente (1 566 únicos → hay clientes con mismo código y distinto nombre). |
| `VENDEDOR` | texto | 21 valores. |
| `SECTOR` | texto | `CIUDAD,ESTADO,VE` — 39 valores. |
| `REFERENCIA` | texto | Sub-familia de producto (263 valores). **136 nulos. No se usa.** |
| `MARCA` | texto | 106 valores. 136 nulos. Desde el corte 6, 29 de ellos traen el sufijo `(N)` — ver §4.3.8. |
| `SUMACANT` | float | = `CANTIDAD − CNTDEVUELT` (verificado: coincide en el 100 % de las filas). |
| `SUMANETO` | float | = `SUMACANT × PRECIOUNIT` (verificado 100 %). **Es LA métrica de venta neta.** |

### 4.2 Cifras de control del 10.º corte (`dateMax` 2026-09-30)

> El vigente es el **11.º** (`dateMax` 2026-10-15, octubre a medias). Desde la v4 las cifras de cada corte
> quedan en `history.json` (local, fuera del repo público), no en este documento.


> **No hubo corte 9 en el dashboard.** Roberts juntó las dos quincenas de septiembre en un solo corte, el
> 10.º. El Word sí trae un 9.º (15-sep) en su tabla de evolución, calculado a mano. Ver la numeración en §8.

- **83 239 filas** · **24 716 facturas** · **1 629 clientes** por nombre (1 616 por código, ver I6) · **2 166 SKU** (2 128 con `SUMACANT > 0`, ver I2) · **114 marcas** · **22 vendedores** · **39 sectores**
- **Rango:** 2026-01-09 → 2026-09-30 (265 días, `dayCount`)
- **Venta neta total:** **$7 016 508,20** (informe, sin AMERICO/REVIPLAST: **$4 040 832,16**)
- **% de devolución global:** 15,59 % de las unidades
- **Sin mes parcial.** El corte cierra el 30 de septiembre, último día del mes, así que septiembre está
  **completo**: `partialInfo()` no marca nada como parcial y **el riesgo NO está inflado** (I4).

Venta neta por mes:

| Mes | Neto | Facturas | Clientes |
|---|---|---|---|
| 2026-01 | 620 282 | 1 652 | 673 |
| 2026-02 | 952 419 | 2 655 | 910 |
| 2026-03 | 1 091 181 | 3 319 | 989 |
| 2026-04 | 843 932 | 2 594 | 889 |
| 2026-05 | **1 110 243** | 3 453 | 984 | ← mejor mes del año
| 2026-06 | 811 207 | 3 027 | 901 |
| 2026-07 | 432 523 | 2 217 | 649 | ← el más flojo del año
| 2026-08 | 570 868 | 2 747 | 762 | ← rebote tras julio
| 2026-09 | 583 853 | 3 052 | 773 | ← mes completo

Por grupo: VIVERES 2,87 M · DESECHABLES 2,14 M · REPOSTERIA 1,88 M · CONDIMENTOS 90 K · CONFITERIA 42 K *(+ el grupo basura `"6"`, $335)*.
Por estado: TRUJILLO 3,59 M · MERIDA 1,76 M · ZULIA 1,54 M · PORTUGUESA 99 K · TACHIRA 28 K.
Top vendedores: Televenta 1,46 M · David 868 K · José 855 K · Santiago 727 K · Jesús 703 K · Yuraima 578 K.
Top marcas: **AMERICO 2,51 M** · MARPLAST (N) 601 K · MAXIPLAST (N) 453 K · MASTER TOP (N) 392 K · MULTIPLAST(N) 221 K · INDELMA (N) 190 K.

**Frente al 8.º corte** (`dateMax` 2026-08-31): +10 980 filas, +$583 852,90 de neto en el dashboard (+9,1 %),
+63 clientes. Enero–agosto llegan **idénticos al centavo** al corte 8; como los cortes son acumulativos (I7),
la diferencia **es** septiembre entero.

> **AMERICO no se mueve desde julio** ($2,51 M en los cortes 7, 8 y 10; su última venta es de julio, $9 248):
> todo el crecimiento del período viene de la línea regular. Conviene decirlo cuando alguien lea el total
> del dashboard como crecimiento general.

### 4.3 ⚠️ Peculiaridades y suciedad de datos (importantes)

1. **AMERICO + REVIPLAST = 45,8 % del neto ($2,95 M en 8 915 filas).** El **dashboard los incluye**; los **informes automáticos los EXCLUYEN** (`build_dashboard.py` filtra `MARCA == "AMERICO"` o `NOMBRECLI` que contenga `REVIPLAST` antes de llamar a `reports.build`). **Por eso el total del dashboard ($6,43 M) NUNCA cuadra con el total del informe ejecutivo ($3,49 M).** No es un bug.
2. **Valores basura en dimensiones:** `VENDEDOR` tiene `"23"` (23 filas) y `"2"` (1 fila); `GRUPO` tiene `"6"` (56 filas, $335). Aparecen tal cual como opciones en los segmentadores. Nadie los ha limpiado.
3. **Espacios sobrantes** en algunos valores (`"Jesús "`, `"Laura "`, `"Santiago "`). `build_dashboard.py` hace `.str.strip()`, así que en el dashboard aparecen unificados; en un análisis crudo del Excel hay que hacer strip.
4. **Acentos:** los datos están correctos en UTF-8 (José, Jesús, Rosángela, Ángel, CAÑO ZANCUDO). Si ves `Jes�s` es **la consola de Windows** (cp1252), no los datos. En Windows usar `PYTHONIOENCODING=utf-8`.
5. **`MARCA` nula (136 filas)** → `fillna("(Sin dato)")` la convierte en `"(Sin dato)"`, **no** en `"(Sin marca)"` (el `.replace` a `"(Sin marca)"` solo actúa sobre literales `"nan"` y `""`, que ya no existen tras el fillna). Detalle menor pero explica por qué nunca ves `(Sin marca)`.
6. **Un sector tiene espacio tras la coma:** `"EL CHIVO, ZULIA,VE"`. Funciona igual porque `vnorm()` hace trim al extraer el estado.
7. **`CODCLIENTE` (1 554) ≠ `NOMBRECLI` (1 566)**: hay nombres duplicados/variantes. Todos los KPIs de "clientes únicos" cuentan por **nombre**, no por código. Los Word/Excel que arma Roberts a mano cuentan por **código** (el 8.º corte: 1 385 clientes activos en el universo de informes, frente a 1 392 por nombre) — de ahí las diferencias de una o dos unidades al cotejar.
8. **Marcas con sufijo `(N)` — nuevo en el corte 6.** 29 de las 106 marcas llegan como `MARPLAST (N)`,
   `MAXIPLAST (N)`, `MULTIPLAST(N)`… (con y sin espacio antes del paréntesis). Es un cambio del ERP de origen,
   no del sistema. **`FULLCREAM` aparece en las dos formas** (`FULLCREAM` y `FULLCREAM (N)`) y por tanto se
   cuenta **dos veces** en el segmentador de marca y en los rankings. Nadie normaliza el sufijo todavía;
   si se decide hacerlo, hay que decirlo en el informe porque **rompe la comparación con los cortes previos**.
9. **Los cortes son acumulativos**: cada Excel nuevo trae TODO el año, no solo lo nuevo. Comparar cortes = comparar totales, no sumarlos.

---

## 5. Modelo de datos en el navegador

Tras el PIN, `GIP.S.P` es el `meta` del paquete y `GIP.S.M` el motor sobre sus columnas.

```
meta = { empresa:'ip', version, generated, dateMin, dateMax, year, dayZero, dayCount, corte,
         dims:{ mes, mesLabels, fullLabels, histMonthNums, grupo, vend, sector, estado, marca, familia,
                cli, prod, doc:<cantidad> },
         exec:{fuente:'word'|'sistema', html}, execDocx, riskList, listDocx, driveLinks:{exec,list,cob},
         Pcob, changelog, cols:[{n,t,s,o,l}], filas }
columnas (una entrada por línea de factura):
  mes grupo vend sector estado marca familia cli prod doc dia   códigos enteros (u8/u16/u32)
  cant dev   milésimas (i32, escala 1000)     neto   centavos (i32, escala 100)
```

- Cada dimensión va **codificada a índices** con sus nombres ordenados en `dims`; `doc` solo cuenta.
- `estado` sale de `SECTOR` (`CIUDAD,ESTADO,VE`) y `familia` es `REFERENCIA`: los dos son segmentadores nuevos.
- Las sumas del navegador son exactas (enteros); el motor devuelve unidades reales.
- `execDocx` y `listDocx` (copias embebidas) van vacíos cuando hay enlace de Drive.

---

## 6. La aplicación front-end

Todo lo general (filtros, menú, tarjetas, kit de gráficos y tablas, ayuda, descarga HD, reunión, Novedades)
es del núcleo y está descrito en `METODO.md` y `DESIGN.md`. Aquí, lo propio de IP (`app/ip.js`).

**Segmentadores (9):** Mes · Grupo · Vendedor · Estado · Zona · Marca · Familia · Cliente · Producto, más
el rango de fechas con atajos. Clic en un gráfico = filtrar (el mapa filtra por estado).

**Indicadores (8):** venta neta y proyección del año (**sensibles**: no salen en reunión), ticket,
clientes, facturas, unidades, productos y % de devolución. La flecha compara el último mes con venta contra el
anterior; si es el mes del corte y va a medias, lo escala a cierre (§7).

**Ruta de secciones:**

| Paso | Sección | Lo principal |
|---|---|---|
| 1 Cómo vamos | Inicio | Titular automático del corte, indicadores, venta mensual + proyección, **qué lo explica** (vendedores, marcas y estados que más suben y bajan), **qué atender** (inactivos, vendedores que caen > 25 %, lista de riesgo, cobranza pendiente, mes a medias) |
| | Tendencia | Proyección, crecimiento mensual, acumulado, detalle por mes, unidades y ticket, calendario por día |
| 2 Qué lo mueve | Vendedores | Ranking, **cambio frente al mes anterior** (base ≥ $5.000), trayectoria de los 6 líderes, tabla |
| | Clientes | Inactivos > 45 días (respeta segmentadores, no fechas), ranking, Pareto, trayectoria, tabla |
| | Productos y marcas | Grupos mes a mes y su peso, marcas, productos (por venta o unidades), trayectoria, tabla por marca/familia/producto/grupo |
| | Zonas | Mapa por estado (se encuadra solo), ranking de zonas, trayectoria, tabla por zona/estado |
| 3 Qué atender | Riesgo y recuperados | El Excel de Drive hoja por hoja; en reunión, el enfoque en un vendedor filtra la lista |
| | Cobranza | §8 bis, con sus filtros propios de camada y analista |
| 4 Herramientas | Comparar períodos | A contra B respetando los segmentadores |
| | Informe del corte | Resumen del Word + descarga |
| | Novedades | Historial de versiones |

**Agenda de reunión:** Inicio (sin totales), Vendedores, Clientes, Riesgo, Productos y marcas, Zonas, Cobranza.

---

## 7. Mes parcial: la regla más importante del sistema

El usuario sube **cortes quincenales**, así que el último mes casi siempre está incompleto (p. ej. 15 de 31 días). Si se tratara como mes cerrado, todas las tendencias se verían falsamente en caída.

- **`partialInfo(mo)`** — detecta el mes parcial **en el navegador** comparando el día de `P.dateMax` con los días del mes. `frac = díasTranscurridos / díasDelMes`. El mes parcial es siempre el **último índice** de `P.dims.mes`.
- **`effNeto(mo)`** — serie mensual "efectiva": el mes parcial se **escala a cierre** (`neto / frac`).
- **`projLine(mo)`** — la regresión lineal se ajusta **en espacio de mes-calendario** (`idxData = histMonthNums − 1`, no `0..n`), sobre la serie efectiva. Así la recta pasa por los datos reales y proyecta con continuidad el cierre del mes parcial y los meses siguientes hasta diciembre.
- **Afecta a:** `c-trend`, `c-proj`, tabla `t-proj` (marca `parcial`), KPI *Proyección año*, `c-mom`, y el sufijo `(proy.)` de los deltas de volumen.
- En el gráfico el mes parcial se dibuja como **barra clara + punto de proyección**.

`reports.py` hace su propia versión en Python: `day_max`, `dim = monthrange(...)`, `daily = neto/day_max`, `proj_last = daily*dim`, `partial = day_max < dim-2`.

---

## 8. Informes (`reports.py`)

`reports.py` calcula las métricas del corte (`history.json`) y arma un **resumen ejecutivo de respaldo**, que solo se ve si el corte no trae Word. Los informes HTML completos se retiraron en la v4: el informe real es el Word que arma Roberts.

**Metodología clave — ventana reciente = últimos 2 meses:**

- **Cliente en riesgo:** compró en algún mes **anterior a los últimos 2** y **no compró en los últimos 2 meses**.
  → `risk = [c for c in clientes if (meses[c] & prior_all) and not (meses[c] & recent2)]`
- **Cliente recuperado:** compró en el **último mes**, **no** compró en los **2 meses previos a ese**, y **sí** compró antes.
- `risk_val` = valor histórico acumulado de los clientes en riesgo. `recov_val` = compra del último mes de los recuperados.
- Se calculan además: riesgo por vendedor (`rv`), riesgo por sector (`rs`), **Top 20 en riesgo** con última compra (`risk20`), top 10 recuperaciones.
- Perfil de vendedor (`_perfil`): *Alto ticket / mayorista* (ticket > 1,8× mediana) · *Amplitud / venta cruzada* (>120 clientes) · *En desarrollo* (<$15 K) · *Equilibrado*.


**Recordatorio:** los informes se generan sobre `df_rep`, que **excluye AMERICO y REVIPLAST**. El dashboard no.

### `history.json`
Una entrada **por corte**, con: `version, dateMax, total, best_month, best_val, clientes, riesgo, recuperados, top10_share, ticket`. El corte se identifica por **`dateMax`**: si regeneras el mismo corte con otra versión, `reports.py` **reemplaza** la entrada en vez de añadir una nueva (antes solo comparaba `version`, y por eso se acumularon 7 entradas del corte 2026-06-30). Hoy tiene **6 entradas** (cortes 4, 5, 6, 7, 8 y 10). La vigente (corte 10) es:
total **4 040 832,16** · mejor mes **2026-09** ($554 915,23, apenas por encima de mayo) · **1 464 clientes** ·
**512 en riesgo** · **64 recuperados** · ticket **192,37** · top10 **32,6 %**.
*(El Word del corte 10 llama a septiembre "el cuarto mejor mes": mide sin café ni REVIPLAS, otro universo.)*

**Numeración de cortes.** **La numeración es la de los archivos de Drive.** Desde el corte 10 cada entrada
de `history.json` guarda **su propio número** en el campo `corte`, porque la serie puede saltarse números:
el 10 juntó las dos quincenas de septiembre y **no hubo 9**, así que contar por posición lo habría llamado 9.
Un corte nuevo se numera como **el anterior + 1**; si Drive dice otro número (otra fusión de quincenas), se
pasa la variable de entorno **`CORTE=<n>`** al build. `CORTE_OFFSET = 3` (`reports.py`) ya solo numera
entradas sin el campo: los primeros informes se hicieron **a mano, antes del sistema**, y no están en el historial.

| Entrada de `history.json` | `corte` | Archivo en Drive |
|---|---|---|
| `2026-06-30` | 4 | `Informe_Ejecutivo_4toCorte_CierreSemestre_Junio2026…` |
| `2026-07-15` | 5 | `Informe_Ejecutivo_5toCorte_Julio2026…` |
| `2026-07-31` | 6 | `Informe_Ejecutivo_6toCorte_Julio2026…` |
| `2026-08-15` | 7 | — |
| `2026-08-31` | 8 | — |
| *(no existe)* | ~~9~~ | sólo en la tabla del Word del 10 (15-sep, hecho a mano) |
| `2026-09-30` | 10 | `Informe_Ejecutivo_10moCorte.docx` (`exec.docx`, 24 503 bytes) |
| `2026-10-15` | **11** (vigente) | `Informe_Ejecutivo_11voCorte_Octubre2026_Parcial…` (octubre a medias) |
| *(próximo)* | 12 | — |

### `risk_list.xlsx` (Drive, opcional)
El del corte 8 trae **9 hojas**: `Índice` (se salta), `📄 Seguimiento (Resumen)`, `🎯 Plan de Acción`,
`🔴 En Riesgo (492)`, `🟢 Recuperados Agosto (130)` / `Julio (91)` / `Junio (117)`,
`📊 Riesgo x Vendedor` y `📊 Riesgo x Sector`. `risklist.py` salta las hojas cuyo nombre contiene
"ÍNDICE"/"INDICE" y devuelve `{order, sheets:{nombre: …}}`.

**⚠️ Hay DOS formas de hoja y confundirlas deja la pestaña en blanco.**

| | Hojas **lista** | Hojas **narrativas** |
|---|---|---|
| Cuáles | En Riesgo, los 3 Recuperados, Riesgo x Vendedor/Sector | Seguimiento (Resumen), Plan de Acción |
| Forma | una sola tabla | KPIs + títulos + tablas pequeñas + párrafos |
| Se detectan por | el encabezado trae `#`/`Cliente`/`Vendedor`/`Sector / Zona` | **no** trae ninguno |
| Payload | `{title, headers, rows, count}` | `{title, sub, blocks:[…], count:0}` |
| En el front | tabla + buscador | `rlBlock()`, bloque a bloque, **sin** buscador |

Tipos de bloque: `head` (título de sección) · `text` (párrafo) · `kpis` (2 filas: etiquetas + valores,
se pintan con `.repkpis`/`.rk`) · `pairs` (dos columnas etiqueta/valor) · `table` (1.ª fila = encabezado).

**Las celdas de los bloques se compactan** (solo las no vacías, en orden). Eso arregla el desfase de las
celdas combinadas: en `🎯 Plan de Acción` el encabezado ocupa las columnas 0-4 y los datos las 0,1,3,4,5,
así que leerlas por posición corre cada valor una columna. Las hojas narrativas se pintan sin `.rtc`
(que fuerza `nowrap`) para que el texto largo pueda partir línea.

> Los nombres de hoja ya no traen el conteo entre paréntesis de forma fiable: se lee de `count`.

---

## 8 bis. Cobranza (`cobranza.py` + pestaña 💵)

Insumo: `Conciliacion_Facturado_vs_Cobrado_*.xlsx` de la misma carpeta de Drive (16 hojas en el 8.º corte;
el dashboard lee 9). Es **opcional**: sin `COB_XLSX` no se construye `Pcob`, la pestaña se queda oculta y no
pasa nada más. `Pcob` viaja **dentro del mismo bloque cifrado** que `P` — no hay segundo PIN ni segundo `ENC`.

### ⚠️ El Excel de conciliación cambia de formato entre cortes
No es estable, y ya rompió el build una vez. Por eso `cobranza.py` **detecta los encabezados por nombre
normalizado** (`_norm` borra acentos, espacios y puntuación) y acepta **alternativas explícitas** para los
que cambiaron de nombre de verdad. Lo que cambió del corte 7 al 8:

| | Corte 7 (Abr–Jul) | Corte 8 (Mar + May–Ago) |
|---|---|---|
| Fila de encabezados | 0 | **2** (dos filas de título encima) |
| Camada | `Camada (despacho)`, valores `2026-04` | **`Camada`, valores `Marzo`, `Mayo`…** |
| Columnas de dinero | `Facturado ($)`, `Anulado ($)` | `Facturado`, **`Anulada`**, + `Fact. Neto` |
| Precio | `Precio (norm)` | **`Precio`** |
| Categoría de las hojas `POR …` | `Categoria` | **el nombre de su dimensión** (`Analista`, `Grupo`…) |
| `Facturas` en las hojas `POR …` | sí | **no** (el front las cuenta del MAESTRO) |
| Comisión x vendedor | `Comisión total ($-equiv.)` + bases | **`Comisión (Bs)`, sin desglose** |
| Café | **dentro** de MAESTRO, `Grupo=CAFE` | **maestro propio, fuera** de MAESTRO |
| `MAESTRO CAFÉ` | `Mes`, `Cantidad`, `En Sistema`, `Diferencial` | solo `Camada`; el diferencial **se deduce** |
| `COMISIONES CAFÉ` | tabla | **texto sin tabla** |
| Hojas nuevas | — | `RESUMEN`, `COMPARADOR`, `COBERTURA OTROS` |

**Lo que cambió del corte 8 al 10** (`Conciliacion_Facturado_vs_Cobrado_Septiembre_MarJunSep.xlsx`, camadas
Mar + Jun–Sep, 15 hojas):

| | Corte 8 | Corte 10 |
|---|---|---|
| `COBERTURA OTROS` | existe | **desaparece** (el dashboard no la leía) |
| `RESUMEN`, diferencial regular | `Diferencial (no es deuda)` | **`Diferencial`** a secas |
| `RESUMEN`, bloque café | neto · cobrado · diferencial · pendiente | **sin diferencial** |
| `MAESTRO CAFÉ` | trae `Pendiente` | **sin `Pendiente`**: se reparte por `Estado` |
| `POR GRUPO` / `POR PRECIO LISTA` | `% del Cobrado` | **`% Cobrado`** |
| `COBERTURA` | `% del sistema`; La Protectora **dentro** de "En cobranza" | **`% sistema`**; café = **Américo + Protectora** en una porción propia |

Tres trampas que dejó ese cambio, ya resueltas en `cobranza.py`:
- **`% Cobrado` normaliza igual que `Cobrado`** (`_norm` borra el `%`) y le robaba la columna al dinero: el
  cobrado por grupo salía 0,97. `_header_row` ahora se queda con la **primera** columna de cada nombre.
- **El `RESUMEN` se lee por bloques** (`{"regular": …, "cafe": …}`, el título de bloque es una fila de una sola
  celda): con las etiquetas repetidas, leer "la primera aparición" comparaba el café contra el diferencial regular.
- **Sin `Pendiente`, la brecha de cada factura cae entera de un lado**: `CERRADA` ⇒ diferencial, abierta ⇒
  pendiente. Es la misma regla que cumple el MAESTRO regular (verificado: ninguna CERRADA tiene pendiente y
  ninguna PENDIENTE tiene diferencial), y con ella el pendiente del café cuadra al centavo con el `RESUMEN`.

El tooltip de la cobertura (`cobAdapt()`) detecta si alguna porción nombra a "Protectora" y cambia el texto.

**Dónde vive el café es lo más peligroso de leer mal.** El flag `cafeDentro` del payload lo resuelve: si el
MAESTRO trae `Grupo=CAFE`, los totales de la pestaña **ya incluyen** el café y la sección es solo el detalle;
si no lo trae, el café **se suma aparte**. El front cambia el texto de la tarjeta según ese flag (`cobAdapt()`).
Leerlo al revés cuenta el café dos veces, o lo pierde.

**Verificaciones que hace `cobranza.py` y que abortan el build:** la identidad camada a camada, el facturado
neto del MAESTRO contra el bloque regular del `RESUMEN`, que no salga ningún diferencial negativo en el café
cuando hay que deducirlo, y el maestro del café contra **su** bloque del `RESUMEN` cifra a cifra (neto,
cobrado, pendiente y diferencial, las que el corte publique). Si el libro se contradice, revienta aquí.

**Por qué no se compara mes contra mes.** Una factura despachada en abril se puede terminar de cobrar en
junio, así que el eje es la **camada** (mes de despacho) y cada camada **madura** con el tiempo. La camada
más joven (`camadaMax`) se dibuja en claro y rotulada *(en maduración)*; los deltas de los KPI comparan
**camadas ya cerradas**, nunca contra la inmadura. Es el equivalente en cobranza al `(proy.)` del mes parcial.

### ⚠️ Las DOS tasas de cobro — no confundirlas
La conciliación tiene una columna `% Cobro` que **no** es "cuánto se ha cobrado de la camada":

| Tasa | Fórmula | Qué dice | Corte 8 (Mar · May · Jun · Jul · **Ago**) |
|---|---|---|---|
| **% cobrado** (verde) | `Cobrado ÷ Facturado neto` | Cuánto de la camada ya entró en caja. **Es la curva de maduración.** | 93,5 · 94,0 · 92,0 · 78,2 · **23,2** |
| **% efectividad** (azul punteado) | `Cobrado ÷ (Cobrado + Diferencial)` | De lo **ya cerrado**, cuánto entró como dinero y cuánto se fue en diferencial. **Es la columna `% Cobro` del Excel.** | 95,6 · 96,1 · 95,2 · 95,3 · 96,3 |

La pestaña muestra **las dos**, nombradas: con una sola, o el dashboard contradice al Excel (23,2 % vs. 96,3 %)
o desaparece la maduración (la efectividad es plana). El **Diferencial no es deuda ni pérdida** — es haber
cobrado a otro precio o forma de pago — y así hay que rotularlo, o se lee como cartera perdida.

**El 23,2 % de agosto no es un problema de cobranza**: es la camada recién abierta. El global del corte
(75,0 %) baja frente al 86,9 % de la 1.ª conciliación **solo** porque agosto entra al mix con $259 789 aún
por cobrar; las camadas compartidas (May+Jun+Jul) de hecho **subieron** $52 182 respecto a la conciliación
anterior. La hoja `COMPARADOR` del Excel trae esa comparación camada a camada.

### Otras reglas que el dashboard muestra pero NO recalcula
- **ANULADA nunca entra al universo cobrable.** Va aparte, en su propia columna. En el 8.º corte son
  **1 281 facturas por $574 052** sobre un bruto de $2 116 408.
- **Puede haber anuladas sin fecha de despacho**, que por tanto no pertenecen a ninguna camada (5 facturas,
  $12 133, en el corte 7). La hoja `POR CAMADA` tampoco las reparte pero **sí las totaliza**: por eso el
  TOTAL de la tabla se calcula sobre todas las filas, no sumando el eje, y una nota al pie explica el hueco.
  **En el 8.º corte no hay ninguna** — todas traen camada — así que la nota al pie no aparece.
- **Comisiones:** 5 % repostería (incluye desechables y confitería) en Precio 1 y 2; 3 % el resto y víveres;
  azúcar $0,40 y harina $0,50 por unidad. **Desde el 8.º corte la hoja las publica en bolívares
  (`Comisión (Bs)`, total 21 869 875 Bs) y sin el desglose de bases**; hasta el 7.º iban en
  `Comisión total ($-equiv.)`. El payload trae `comMoneda` y el front cambia eje, etiquetas y tooltip con
  él (`opt.bs` de `hbz`): con el formateador de dólares, 5 109 377 Bs se leía «$5.1M».
  El desglose de bases sobrevive solo en la hoja `COMISIONES DETALLE` del Excel, por analista y camada;
  **no viaja en el payload** porque el dashboard no lo muestra (el tooltip de comisiones es por vendedor).
- **La comisión del café es aparte y por bulto** ($0,50/bulto en Precio 1 y 2, $0,40 el resto, $0,20 el
  supervisor). En el 8.º corte la hoja `COMISIONES CAFÉ` quedó como texto sin tabla: la tarjeta y el KPI
  correspondientes **se ocultan solos** en vez de pintar ceros.
- **Cobertura:** las 3 analistas cubren el **55,38 %** de la facturación del sistema en el período conciliado
  (Mar, May–Ago), $2 224 189 de $4 016 023. AMÉRICO (el café viejo, 34,06 %), REVIPLAS (9,40 %) y el residual
  de televenta/criterio (1,16 %) son categorías legítimas, no errores. La hoja dejó de publicar el conteo de
  documentos y ahora trae una **nota** por categoría: el tooltip muestra la nota en su lugar.

### Filtros
La pestaña tiene **filtros propios** (camada y analista, chips `.rlbtn`) que **no** son los segmentadores de
ventas: el universo es otro (solo la cartera de las 3 analistas) y el eje es la camada, no la fecha de factura.
Cobertura y comisiones vienen de sus hojas y **no responden a los filtros** (se avisa en su `.hint`).

---

## 9. Seguridad y acceso

**Esquema (`secure.py` + `unlock()` en el front):**

1. Se genera una **clave maestra** aleatoria de 32 bytes (`mk`).
2. El payload completo se cifra con **AES-256-GCM** usando `mk` → `{iv, ct}`.
3. Para **cada usuario**: salt aleatorio de 16 bytes → `PBKDF2-HMAC-SHA256(pin, salt, 200 000 iteraciones, 32 bytes)` = `uk` → se cifra `mk` con `uk` → `{salt, ivu, wrapped}`.
4. En el navegador, el PIN prueba contra **cada** usuario hasta que un descifrado tenga éxito. Al lograrlo se conocen `name`, `role` y `greet`.

**Usuarios actuales (4)** — roles, sin PINs:

| Nombre | Rol | Saludo |
|---|---|---|
| Roberts Flores | `admin` | Ing. Roberts |
| Ismael | `jefe` | Ismael |
| Ing. Palomares | `supervisor` | Ing. Palomares |
| Yuniarlis | `usuario` | Yuniarlis |

> **El rol hoy es puramente cosmético**: solo aparece en la pantalla de bienvenida. **Todos los usuarios ven exactamente los mismos datos** (comparten la misma clave maestra). Si alguna vez se pide "que el vendedor X solo vea lo suyo", eso requiere **payloads separados por rol**, no un cambio de UI.

**Invariantes de seguridad:**
- Nunca subir al repo: `secrets.json`, `data_ip.xlsx`, `risk_list.xlsx`, `exec.docx`, `risk.docx`.
- Antes de cada push, verificar con `git status` que solo cambian `index.html` e `history.json`.
- No exponer PINs ni el token de GitHub en reportes ni conversaciones.
- Todo el JS es público en `index.html`: la seguridad depende del **PIN y del cifrado**, no de ocultar el código.
- Si un PIN se filtra, hay que **regenerar** `index.html` (cambiar el PIN en `secrets.json` y reconstruir); el HTML viejo cacheado sigue abriéndose con el PIN viejo.

---

## 10. Despliegue y actualización

### 10.1 Publicar
```bash
python publish.py        # git add index.html history.json + commit + push origin main
```
GitHub Pages redespliega en **~1 min**. Configuración: Settings → Pages → *Deploy from a branch* → `main` / `/ (root)`. El `.nojekyll` evita el procesado Jekyll.
Netlify está **pausado por créditos** y ya no es el hosting. La función serverless `log` (registro de ingresos) **se eliminó** al migrar (Pages es estático): el login funciona igual, solo que no se registra quién entra.

### 10.2 Corte nuevo, a petición (procedimiento vigente desde 2026-08-09)

> **Ya no hay tarea automática.** Las dos tareas programadas de Claude Cowork se retiraron.
> El flujo actual es: **subes los archivos a Drive → lo pides en el chat → se hace la corrida.**
> Motivo: la tarea publicaba a ciegas cada 3 días y no detectaba archivos corruptos ni cambios
> de nombre. En agosto de 2026 subieron a Drive dos "archivos Office" que eran en realidad una
> página HTML de 470 081 bytes, y solo se detectó revisando a mano.

**Los 9 pasos de una corrida.** Cada uno con su verificación; si alguno falla, **no se publica**.

1. **Respaldo.** Copia completa del repo a `dashboard-ip-_backups\prod_<FECHA-HORA>\`.
2. **Listar Drive** (carpeta "Informes IP", `parentId <id>`) y quedarse
   con el Excel de datos, el Word Ejecutivo y el Excel de riesgo **más recientes**.
3. **Validar que cada archivo es lo que dice ser** — el paso que ahora es obligatorio:
   ```python
   open(f,'rb').read(4).hex() == '504b0304'      # ZIP/Office; si sale 3c21444f es <!DOCTYPE, o sea HTML
   zipfile.ZipFile(f).namelist()                  # 'xl/...' => Excel   ·   'word/...' => Word
   ```
   Dos archivos del mismo tamaño exacto = casi seguro el mismo archivo subido dos veces.
4. **Poner los archivos en el repo** como `data_ip.xlsx`, `risk_list.xlsx` y `exec.docx`.
   Los tres están gitignored. *(La descarga vía MCP de Drive devuelve base64 y un Excel de 5 MB no
   cabe en contexto: los archivos se toman del disco, normalmente de `Downloads`.)*
5. **Invariante I1 — comprobar la fecha real:**
   ```python
   pd.to_datetime(df['FECHADOC']).max()   # NUNCA fiarse del nombre del archivo
   ```
   Ya falló dos veces: `..._1507` traía datos hasta el 31-jul, y `..._30-07` también hasta el 31-jul.
6. **Armar la huella de versión** y ejecutar el build (comando completo en §10.3):
   `<dataFileId>|<modifiedTime ISO>|<size bytes>~E:<execId>~L:<listId>~C:<cobId>|<modifiedTime>|<size>`
   El tramo `~C:` es nuevo (corte 7): así, si **solo** cambia la conciliación de cobranza, el sistema igual detecta cambio.
   ⚠️ Si el Word o el Excel de Drive **no** están sanos, dejar su ID **vacío**: `downloadReport`
   prefiere `driveLinks` sobre el archivo embebido, así que un ID hacia un archivo roto da una
   descarga rota.
7. **Verificar el artefacto**: descifrar con un PIN real y comprobar los 4 logins, nº de filas,
   `dayCount`, `riskList`, `driveLinks`, que cada botón tenga panel, que no queden placeholders,
   que pase `node --check` (todo lo hace `tools/verificar.py`).
8. **Cotejar** el neto, las filas, los clientes y el rango de fechas contra el corte anterior de
   `history.json`. Caída de neto >25 % o menos filas que el corte anterior ⇒ **avisar, no publicar en silencio**.
9. **Publicar**: `git add index.html history.json` + commit + `git push origin main`.

**Referencia histórica de la tarea retirada** (`COWORK_ACTUALIZACION.md`), por si se vuelve a automatizar:

1. Lista la carpeta de Drive "Informes IP" y toma, por **fecha de creación más reciente**, el Excel de datos (`Data_IP_Actualizada*`) y los opcionales (Word Ejecutivo, Word Seguimiento, Excel Lista).
2. Arma la **huella de versión**:
   `<dataFileId>|<modifiedTime ISO>|<size bytes>~E:<execId>~R:<riskId>~L:<listId>`
3. La compara con la del `index.html` publicado (`<!-- DATA_VERSION: ... -->`, línea 2). **Si es igual → "Sin cambios", termina.**
4. Descarga y guarda como `data_ip.xlsx`, `risk_list.xlsx`, `exec.docx`, `risk.docx`.
5. **Verificación de 4 cifras de control**: nº de filas, neto total, clientes únicos, rango de fechas. Compara con `history.json`.

   | Condición | Acción |
   |---|---|
   | 0 filas, o neto ≤ 0, o faltan `SUMANETO`/`FECHADOC`/`NOMBRECLI` | **No publica.** Reporta "datos inválidos" |
   | El neto cae **>25 %** o bajan las filas vs. el corte anterior | **Publica con ADVERTENCIA visible** |
   | Todo en orden | Publica normal |

6. Ejecuta el build, borra los archivos sensibles, verifica `git status`, y publica.
7. Reporta: las 4 cifras, comparación con el corte anterior, archivos usados, URL y advertencias.

Requiere en el entorno: `pandas`, `openpyxl`, `cryptography` (y `python-docx` si hay Word), más **credenciales de push a GitHub** (PAT o SSH).

### 10.3 El comando del build
Necesita `secrets.json` + `data_ip.xlsx` + `risk_list.xlsx` + `exec.docx` en la carpeta del repo (todos gitignored).

```bash
EXEC_ID=<execId> LIST_ID=<listId> COB_ID=<cobId> \
EXEC_DOCX=./exec.docx RISK_LIST_XLSX=./risk_list.xlsx COB_XLSX=./cobranza.xlsx \
SECRETS_PATH=./secrets.json \
python build_dashboard.py ./data_ip.xlsx "<VERSION>" ./index.html
```

Ejemplo real de la corrida del 8.º corte (2026-09-06):

```bash
EXEC_ID=<id> LIST_ID=<id> \
COB_ID=<id> \
EXEC_DOCX=./exec.docx RISK_LIST_XLSX=./risk_list.xlsx COB_XLSX=./cobranza.xlsx \
SECRETS_PATH=./secrets.json \
python build_dashboard.py ./data_ip.xlsx \
  "<id>|2026-09-04T03:02:06Z|6050608~E:<id>~L:<id>~C:<id>|2026-09-06T13:03:39Z|783418" \
  ./index.html
```

Corrida del 10.º corte (2026-10-02). **`CORTE=10`** porque no hubo 9 (ver §8):

```bash
CORTE=10 EXEC_ID=<id> LIST_ID=<id> \
COB_ID=<id> \
EXEC_DOCX=./exec.docx RISK_LIST_XLSX=./risk_list.xlsx COB_XLSX=./cobranza.xlsx \
SECRETS_PATH=./secrets.json \
python build_dashboard.py ./data_ip.xlsx \
  "<id>|2026-10-03T02:28:47Z|6963167~E:<id>~L:<id>~C:<id>|2026-10-03T07:23:12Z|665652" \
  ./index.html
```

Los archivos de Drive se bajan sin pasar por el MCP (son de enlace público):
`curl -sL "https://drive.google.com/uc?export=download&id=<ID>" -o <archivo>`, y se compara el tamaño con Drive.


Regenerar **el mismo corte** (mismo `dateMax`) ya no duplica nada: `reports.py` **reemplaza** la
entrada de `history.json` en vez de añadirla, aunque cambie la cadena de versión.
Validar después: descifrar con un PIN real y comprobar los 4 logins, `dayCount`, `riskList` y `driveLinks`.

**Variables de entorno que lee `build_dashboard.py`:**
`SECRETS_PATH` (default: `secrets.json` junto al script) · `RISK_LIST_XLSX` · `EXEC_DOCX` · **`COB_XLSX`** · `EXEC_ID` · `LIST_ID` · **`COB_ID`** · **`CORTE`** (los IDs generan links `https://drive.google.com/uc?export=download&id=<id>`).

### 10.4 Respaldos
Cada vez que se sube un cambio se guarda una copia completa en:
```
C:\Users\RJ\Desktop\Sitios web  pruebas\dashboard-ip-_backups\prod_<FECHA-HORA>\
```
(fuera del repo, para no inflar git). Si algo se rompe, restaurar del backup más reciente.

---

## 11. ⚠️ Cómo editar sin romper nada

El procedimiento está en **`METODO.md` §3**. Las trampas propias de IP:

1. **Ninguna cifra se recalcula en el front si ya la calcula un parser.** La cobranza solo transporta lo
   que concilió el Excel (§8 bis); el informe es el Word.
2. **El mes parcial** (§7) se aplica en `GIP.tiempo` (`app/motor.js`) y está fijado por la prueba de
   paridad con la v3 (`tests/motor.test.mjs`). Cambiarlo es un cambio de cálculo y se dice en Novedades.
3. **Todo nombre que viene del Excel pasa por `esc()`**: clientes, productos y hojas los escribe gente.
4. Una tarjeta que muestre totales, costos o márgenes de la empresa lleva `sensible: true`.
5. Agregar una dimensión = columna en `DIMENSIONES` (`build_dashboard.py`) + segmentador en `ip.js`.

---

## 12. Estado actual y deuda técnica conocida

**Funcionando (v4, 2026-10-20):** 11 secciones en ruta de lectura, 9 segmentadores, 8 indicadores, ~30
gráficos, modo reunión con PIN propio, Novedades, paquete v2 (2,2 MB), pruebas automáticas y verificación
de navegador en 1440 y 390 px.

**Deuda / limitaciones conocidas:**
- **PIN de 6 dígitos frente a fuerza bruta fuera de línea** (la página es pública): ver `METODO.md` §5.
- **Roles decorativos**: los 4 usuarios ven lo mismo; el único paquete distinto es el de reunión.
- **Datos sucios visibles** en los segmentadores (`VENDEDOR` «2», `GRUPO` «6»); el pipeline de informes sí los excluye.
- **«Recuperados» significa dos cosas** (§8): 71 en `reports.py`, 130 en el Excel de Drive. Sin unificar.
- **El sufijo `(N)` de las marcas no está normalizado** (§4.3.8): `FULLCREAM` se cuenta dos veces.
- `index.html` sigue entrando completo en cada commit (≈2 MB por corte).

---

## 13. Glosario rápido

| Término | Significado en este sistema |
|---|---|
| **Corte** | Una publicación/actualización del dashboard con un Excel nuevo. Van **8 cortes** reales (5 en `history.json`). |
| **Neto / venta neta** | `SUMANETO` = (cantidad − devoluciones) × precio unitario, en USD. |
| **Factura** | Un `DOCUMENTO` distinto. |
| **Mes parcial** | El último mes del rango, incompleto porque el corte es quincenal. |
| **Cliente en riesgo** | Compró antes, pero no en los últimos 2 meses. |
| **Cliente recuperado** | Volvió a comprar en el último mes tras 2 meses dormido **y ya compraba antes**. El Excel de Drive usa un criterio más laxo que incluye clientes nuevos — ver §12. |
| **Cliente inactivo** | Card del dashboard: sin compras hace >45 días (criterio distinto al de "riesgo" de los informes). |
| **Sector / Zona** | Ciudad en formato `CIUDAD,ESTADO,VE`. |
| **DATA_VERSION** | Huella de versión en la línea 2 de `index.html`; decide si hay que reconstruir. |
| **`P`** | El objeto de datos descifrado en el navegador. |
| **`ENC`** | El bloque cifrado embebido en el HTML. |
| **Paquete v2** | El bloque de datos cifrado: meta JSON + columnas binarias + gzip (`grupo/paquete.py`). |

---

## 14. Historial de cambios del sistema

> Desde la v4 el historial vivo es **Novedades** (`changelog.json`, visible en el sistema). Esta lista
> conserva el detalle técnico de cada hito.

- **2026-10-20** — **Sistema Grupo IP v4** (ingenieria-pro → disenio-web-pro → seguridad-web). Núcleo común
  en `app/` y `grupo/`; paquete v2 en columnas (7,1 → 2,2 MB); motor con pruebas y paridad con la v3;
  ruta de lectura (titular, qué lo explica, qué atender); segmentadores Estado, Familia y Producto; modo
  reunión con PIN y paquete propios; Novedades con guardián en el build; CSP con hashes y ECharts local.
  Se retiraron `template*.html`, los informes HTML completos de `reports.py`, `netlify.toml`, `SYSTEM.md`,
  `COWORK_ACTUALIZACION.md`, `NORMAS_SISTEMA.md` y `PRODUCT.md` (su contenido vigente pasó a `METODO.md`
  y `DESIGN.md`).
- **2026-10-19** — Informes del **corte 11** (Word, lista de riesgo, conciliación de marzo a octubre) con las
  ventas aún al 30-09 (el Excel del 15-10 no estaba en Drive). **Relevos de vendedor**: #10 Leonardo→Héctor
  desde su primera aparición (18-05) y #20 Edixon→Jorge desde el 24-09 (`grupo/reglas.py`). La conciliación
  quitó `COBERTURA`, `POR GRUPO`, `POR PRECIO LISTA` y `COMISIONES CAFÉ`: `cobranza.py` las trata como opcionales.

- **2026-10-02** — **Corte 10** (`dateMax` 2026-09-30: 83 239 filas · $7 016 508,20 en el dashboard ·
  $4 040 832,16 en el informe · 1 629 clientes por nombre · 512 en riesgo · 64 recuperados). **No hay
  corte 9**: Roberts juntó las dos quincenas de septiembre. Por eso **cada entrada de `history.json` guarda
  ahora su número** (`corte`, rellenado 4–8 en las viejas) y el build acepta **`CORTE=<n>`**; antes el número
  salía de la posición y este corte se habría llamado 9 (§8). **El Excel de conciliación volvió a cambiar**
  (§8 bis): sin `Pendiente` en el café, `RESUMEN` con etiquetas repetidas entre bloques, `% Cobrado` que
  le robaba la columna al cobrado en `POR GRUPO`/`POR PRECIO LISTA`, y `COBERTURA` con `% sistema` y el café
  de La Protectora junto a Américo. `cobranza.py` lee los dos formatos (el payload del corte 8 sale idéntico
  al de antes del cambio) y el tooltip de la cobertura se adapta. Verificado en Chrome headless: 11 pestañas,
  todas las gráficas pintadas, 0 errores de consola.

- **2026-09-14** — **Los seis hallazgos restantes del detector de Impeccable, aplicados** (a petición de
  Roberts: mantener naranja y azul, hacer el resto): fuera todo borde de color de más de 1 px (cabecera,
  KPIs, títulos de informe, recuadros, tarjeta de café — el naranja y el azul quedan en botones, chips,
  foco, KPI héroe, slider y gráficos; sólo el indicador del menú conserva 3 px por ser navegación);
  borde-o-sombra: lo que flota (desplegables, tooltip, saludo, puerta, bienvenida) lleva sombra neutra
  sin borde, lo que reposa lleva borde con sombra tenue neutra; **Inter → IBM Plex Sans** (400–700; los
  `800` pasan a `700`). Detector: **0 hallazgos**. Y el bug del botón del menú: `#navopen` era `fixed` a
  96 px y tapaba el filtro "Meses" al cerrar el menú; ahora es el **primer elemento de la barra de
  filtros** (sticky), ocupa sitio real y sigue visible al hacer scroll, también en móvil.
- **2026-09-13** — **Pasada completa con nueve skills y nuevo `NORMAS_SISTEMA.md`** (impeccable,
  find-animation-opportunities, animate, mobile-app-ui-design, mobile-android-design, clean-code, copy-editing,
  last30days, find-skills). Lo aplicado: **pirámide invertida** en Resumen (el calendario por día pasa del
  primer lugar al último), Marcas (tabla al final, como el resto), Clientes (inactivos antes que la curva) y
  Cobranza (comisiones y cobertura, las dos que no responden a filtros, juntas al final); **Proyección de año**
  al 2.º KPI; **presupuesto de animación** de ECharts (260/180 ms, antes 1 000 ms por defecto en cada filtro),
  pulsación de botones, entrada de sección y `prefers-reduced-motion`; **objetivos táctiles de 44 px** en
  pantallas sin puntero fino; tokens `--brand-ink` y `--muted` más oscuro para pasar WCAG AA (el detector de
  Impeccable bajó de 19 a 6 hallazgos, los 6 restantes son identidad); `h2` accesible por sección; emoji
  fuera del menú y de los títulos; kicker "RESUMEN · INFORME CARGADO" fuera; hints de cobranza recortados y
  bloque de café a UTF-8; `build_dashboard.py` deja de silenciar errores (`_warn` a stderr). Sin cambios de
  datos: mismo corte 8, misma `DATA_VERSION`.
- **2026-09-06** — **Corte 8** (`dateMax` 2026-08-31: 72 259 filas · $6 432 655,30 en el dashboard ·
  $3 485 916,93 en el informe · 1 566 clientes por nombre · 493 en riesgo · 71 recuperados) **y adaptación
  de `cobranza.py` al nuevo formato del Excel de conciliación**, que cambió en las 16 hojas: encabezados en
  la fila 2, camadas por **nombre de mes** (`Marzo`, `Mayo`…) en vez de `2026-04`, columnas de dinero sin el
  sufijo `($)`, `Anulado`→`Anulada`, `Camada (despacho)`→`Camada`, `Precio (norm)`→`Precio`, la categoría de
  las hojas `POR …` con el nombre de su dimensión, y sin la columna `Facturas`. El parser ahora acepta
  **alternativas de nombre** y sigue leyendo los cortes viejos. Tres cambios de fondo, en **§8 bis**:
  **(1)** el **café salió del MAESTRO** y va en su propio maestro — el flag `cafeDentro` decide si los
  totales de la pestaña ya lo incluyen o no, y el front cambia el texto en consecuencia (`cobAdapt()`);
  **(2)** la **comisión pasó de `$-equivalente` a bolívares** sin desglose de bases — nuevo `comMoneda` y
  `opt.bs` en `hbz`, porque con el formateador de dólares 5 109 377 Bs se leía «$5.1M»;
  **(3)** `COMISIONES CAFÉ` quedó sin tabla y `COBERTURA` sin conteo de documentos — esas piezas **se ocultan
  solas** en vez de pintar ceros, y la cobertura muestra la **nota** de cada categoría. Se añaden dos
  verificaciones que abortan el build: MAESTRO contra la hoja `RESUMEN`, y el diferencial deducido del café
  contra el `RESUMEN`. Agosto cierra completo, así que **el riesgo deja de estar inflado** (I4) y baja de 581
  a 493: es la corrección del corte parcial anterior, no una mejora de la cartera.

- **2026-08-20 (b)** — **Corte 7** (`dateMax` 2026-08-15: 66 502 filas · $6 113 641,56 en el dashboard ·
  $3 207 977,95 en el informe · 1 539 clientes por nombre) **y nuevo módulo de COBRANZA**. Se añade
  `cobranza.py` y la pestaña **💵 Cobranza** (3 KPI, 7 gráficos, tabla por camada) alimentada por `Pcob`
  dentro del mismo bloque cifrado; nuevas env vars `COB_XLSX` / `COB_ID` y tramo `~C:` en la huella de
  versión. Ver **§8 bis**, en especial las **dos tasas de cobro**: la columna `% Cobro` del Excel es
  `Cobrado ÷ (Cobrado + Diferencial)`, **no** `Cobrado ÷ Facturado`. Agosto vuelve a ser **mes parcial**,
  así que el riesgo vuelve a estar inflado (I4): sube de 428 a 581 y **no debe leerse como deterioro**.

- **2026-08-20** — *(sin cambios de código; el repo sigue en `47e7158`)* Revisión completa de este documento contra el **corte 6** ya publicado: cifras de §4.2, §5 y los invariantes recalculadas sobre `data_ip.xlsx` (62 169 filas, `dateMax` 2026-07-31); se corrige la afirmación de que ECharts no tenía respaldo local (§6.4, sí lo tiene desde el 09-08); se documenta el **sufijo `(N)` en 29 marcas** y el doble conteo de `FULLCREAM` (§4.3.8), la hoja **`Leyenda`** que se cuela como pestaña de riesgo (§8), y el botón de ocultar el menú tal como quedó (§6.3). Nueva §15 como punto de partida para instrucciones nuevas.
- **2026-08-09 (c)** — **Se retiran las tareas automáticas de Cowork.** El corte pasa a ser **a petición** (§10.2, 9 pasos con validación obligatoria de que los archivos de Drive son Office de verdad). `COWORK_ACTUALIZACION.md` queda como referencia histórica.
- **2026-08-09 (b)** — **Corte 6** publicado con datos al **31-07-2026** (62 169 filas · $2 964 385,29 · 1 333 clientes · 428 en riesgo · 38 recuperados). El invariante I1 volvió a saltar: el archivo se llamaba `30-07` pero los datos llegaban al 31. Julio queda completo, así que el riesgo deja de estar inflado y baja de 484 a 428. Se instaló `python-docx`, que faltaba y hacía que el resumen del Word nunca se usara (el fallo lo silenciaba un `except`). El botón de ocultar el panel se movió a la primera fila **dentro** del panel, con `#navopen` flotante para poder reabrirlo. `CORTE_OFFSET = 3` alinea la numeración con los archivos de Drive.
- **2026-08-09 (a)** — Ejecución del documento *MEJORAS_SISTEMA_IP*: **B1** el `TEMPLATE` sale a `template.html` (fin de la duplicación); **B4** las secciones pasan a un **panel lateral colapsable** agrupado en cuatro bloques, con `resize()` de ECharts tras el toggle; **B3** respaldo local de ECharts en `vendor/`; **B2** `history.json` queda con una entrada por corte y `reports.py` deja de acumular duplicados; **A1/A2/A4** pipeline de informes versionado en `pipeline/` (`clean.py`, `analysis.py`, `rep_helpers.js`, `build_report.js`) con `REFERENCIA`, `SUBGRUPO` y `CODCLIENTE`; **A3** sección de **invariantes metodológicos** al inicio de este documento. Además se **elimina la pestaña "Riesgo y recuperados"**: el seguimiento de clientes se fusionó en el Excel de la lista de riesgo.
- **2026-07-21 (j)** — Leyendas con valores en gráficos "solo color": escala numérica en el mapa + etiqueta de monto sobre cada estado; escala de color numérica visible en el calendario.
- **2026-07-21 (i)** — Nueva sección **Sectores/Zonas** con ranking, ventas por estado, comparación mensual, tabla y **mapa choropleth interactivo** de Venezuela (`ve_states.geojson` embebido, clic filtra los sectores del estado).
- **2026-07-21 (h)** — Descarga de gráfico en **HD**: `pixelRatio` automático (lado largo ≥ 2048 px) para que WhatsApp ofrezca el toggle "HD".
- **2026-07-21 (g)** — La descarga de gráfico compone título + subtítulo sobre el PNG con canvas. Se crea `COWORK_ACTUALIZACION.md`.
- **2026-07-21 (f)** — Fix de la ventana de barras en `hbz` (mostraba ~25 en vez de ~10). Botón ⬇ en cada tarjeta. Pestaña **Comparar**. Card de **clientes inactivos**.
- **2026-07-21 (e)** — **Datos por día** (`DAY` + `dayZero`). Filtro por rango de fechas con calendario (reemplaza el slider mensual). Nueva tarjeta **calendario heatmap**.
- **2026-07-21 (d)** — Botón **(i)** en cada KPI explicando qué mide y qué significa el delta.
- **2026-07-21 (c)** — **Migración a GitHub Pages**: se elimina la función serverless `log` y la pestaña 🔒 Registro; nuevo `publish.py` y `.nojekyll`.
- **2026-07-21 (b)** — **Tendencia/proyección con mes parcial**. Gráficos de barras responsive con ventana + slider. Comparación mensual en Clientes y Productos.
- **2026-07-21 (a)** — Chips de filtro colapsados. Segmentador **Cliente**. Slider de rango de tiempo. Sincronización de casillas solo al abrir.

---

## 15. Punto de partida para trabajo nuevo (al 2026-09-06)

**Estado del repositorio:** rama `main`. Lo publicado en GitHub Pages corresponde al **corte 10**
(`DATA_VERSION` en la línea 2 de `index.html`, `dateMax` 2026-09-30). Los archivos de trabajo
(`data_ip.xlsx`, `risk_list.xlsx`, `exec.docx`, `cobranza.xlsx`, `secrets.json`) están en la carpeta
pero **fuera de git**, así que se puede regenerar el mismo corte sin bajar nada de Drive.

**Ojo con el corte 11:** el Excel de conciliación cambió de formato en el 8.º y otra vez en el 10.º, y no
hay razón para pensar que se estabilizó. `cobranza.py` acepta los tres formatos por nombre de encabezado,
pero un cuarto volverá a romperlo. El primer paso al recibir un corte nuevo de cobranza es **volcar los encabezados
de todas las hojas** y compararlos con la tabla de §8 bis antes de correr el build.

**Antes de aceptar una instrucción nueva, ubícala en una de estas tres categorías** — cada una tiene un
camino distinto y confundirlas es la forma más rápida de romper algo:

| Tipo de tarea | Qué se toca | Qué NO se toca | Validación mínima |
|---|---|---|---|
| **A · Corte nuevo** (Excel nuevo de Drive) | `data_ip.xlsx`, `exec.docx`, `risk_list.xlsx`, `index.html`, `history.json` | Nada de código | Los 9 pasos de §10.2, con I1 (`FECHADOC.max()`) y el cotejo del §10.2-8 |
| **B · Cambio de interfaz o de cálculo** | `app/` (UI) · `reports.py` / `pipeline/` (informes) · `build_dashboard.py` (payload) | **`index.html` jamás a mano** | `node --check` del último `<script>`, `py_compile`, y regeneración comparando salida enmascarando `ENC` y `DATA_VERSION` (§11.5) |
| **C · Análisis o informe puntual** (una pregunta sobre los datos) | Nada del repo: se lee `data_ip.xlsx` con pandas | Ni build ni push | Los **siete invariantes** de la cabecera, en especial I1, I2, I3 e I7 |

**Cinco cosas que casi siempre hay que recordarle a quien llega nuevo al sistema:**

1. El total del dashboard (**$6,43 M**) y el del informe (**$3,49 M**) **no cuadran a propósito** (I3).
2. El nombre del archivo de Drive **miente sobre el período**; la verdad es `FECHADOC.max()` (I1).
3. Los cortes **no se suman**, se comparan (I7).
4. Cualquier cambio visible en producción **exige regenerar `index.html`**: los datos van cifrados dentro.
5. Nada de `secrets.json`, `data_ip.xlsx`, `risk_list.xlsx` ni `*.docx` en un commit. Revisar `git status`
   antes de cada push: solo deben cambiar `index.html` e `history.json`.

**Si la instrucción nueva llega desde otro Claude (Desktop, Cowork, etc.):** pídele que diga explícitamente
**a qué categoría (A/B/C) pertenece** y **qué debe quedar publicado al final**. Si es de tipo B, la salida
esperada es un cambio en `app/` (o en el `.py` que corresponda) con su entrada en Novedades **más** una regeneración validada;
si es de tipo A, la salida es un `index.html` nuevo y una entrada nueva en `history.json`. En ambos casos,
respaldo previo en `dashboard-ip-_backups\prod_<FECHA-HORA>\` (§10.4).

> **Espacio reservado.** Las instrucciones nuevas pueden anexarse debajo de esta línea como §15.1, §15.2…
> sin tocar el resto del documento.

### 15.1 Multiempresa: la puerta del Grupo IP (2026-09-25)

El sitio ya no es solo IP. `index.html` abre con la **puerta del Grupo IP** («¿A qué empresa vas a entrar?»):
IP, **Tiendas Caleb**, Reviplas (deshabilitada, «Próximamente») y, desde el 2026-10-22, la presentación
**«Reunión de vendedores 2026»** (`reunion.html`, ver `METODO.md` §4.1). Si eliges IP, el PIN se pide en la misma
página; si eliges Caleb, se navega a `caleb.html#entrar`, que salta directo al PIN. «Cambiar de empresa»
(en la puerta y en la cabecera de cada dashboard) vuelve a la puerta. Los **cuatro usuarios y PINs son los
mismos** en todas las empresas: cada build cifra su paquete con el mismo `secrets.json`.

- La puerta vive en **`app/puerta.html`** y la inserta `grupo/pagina.py` en el armazón de cada empresa, con el
  logo, el nombre y el color de botón de cada empresa. Los ids `pin`, `enter` y `gerr` los usa `boot()`:
  no renombrarlos. Los logos de la puerta están en `assets/` (se sirven como archivos, no van embebidos).
- **IP no cambió por dentro**: la plantilla solo perdió su pantalla de PIN propia y ganó el enlace
  «Cambiar de empresa». Regenerado el 2026-09-25 sobre el mismo corte 8 (misma `DATA_VERSION`, mismo
  `history.json`); el diff enmascarando `ENC` son solo esas líneas.
- **Caleb tiene su propio contexto**: `CONTEXTO_CALEB.md` (datos, reparaciones, certificación y build).
- `publish.py` sube ahora `index.html`, `history.json`, `caleb.html` y `history_caleb.json`.
- Para sumar **Reviplas**: `METODO.md` §6.

---

*Elaborado a partir del código y los datos reales del repositorio. Autor del sistema: Ing. Roberts Flores.*
*Última verificación contra código y datos: **2026-10-20** (v4, corte 10 + informes del 11).*
