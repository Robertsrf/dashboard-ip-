# CONTEXTO — Dashboard IP (Distribuidora y Suministros IP)

> Documento único de contexto para cargar en un **Proyecto de Claude**.
> Contiene: qué es el sistema, cómo está construido, cómo son los datos, cómo se despliega,
> cómo se edita sin romperlo, y las trampas conocidas.
> Verificado contra el código y los datos reales el **2026-09-06**, sobre el **8.º corte** (`dateMax` 2026-08-31).
> **No contiene PINs, tokens ni credenciales.**

---

## 1. Resumen en 10 líneas

- Es un **dashboard de inteligencia de ventas** para *Distribuidora y Suministros IP* (distribuidora de víveres, desechables y repostería en el occidente de Venezuela).
- Es **una sola página estática** (`index.html`, ~6,1 MB) que se genera con Python desde un Excel de ventas.
- Los datos van **cifrados dentro del HTML** (AES-256-GCM). Se abren con un **PIN de 6 dígitos** por usuario; el descifrado ocurre en el navegador con WebCrypto.
- Los gráficos son **ECharts 5.5.1** (desde CDN, con respaldo local en `vendor/echarts.min.js` si el CDN no responde). No hay backend, ni base de datos, ni API.
- Se publica en **GitHub Pages** → https://robertsrf.github.io/dashboard-ip-/ (repo `Robertsrf/dashboard-ip-`, rama `main`).
- Se actualiza **a petición**, no en automático: se suben los archivos a Google Drive y se pide la corrida en el chat (§10.2). Las tareas programadas de Cowork se retiraron el 2026-08-09.
- El HTML/CSS/JS vive en **`template.html`**, un único archivo que `build_dashboard.py` lee al arrancar. *(Antes estaba duplicado dentro del `.py` y había que editar dos sitios; eso se eliminó — ver §14.)*
- Los datos son **cortes quincenales acumulativos**: el último mes casi siempre está incompleto, y el sistema lo compensa explícitamente.
- Autor: **Ing. Roberts Flores**.
- Documentación previa en el repo: `SYSTEM.md` (referencia técnica), `COWORK_ACTUALIZACION.md` (**la tarea automática, ya retirada** — referencia histórica), `README.md` (mínimo). Este documento los engloba.

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

| Archivo | Tamaño aprox. | Rol | ¿En git? |
|---|---|---|---|
| `build_dashboard.py` | 6 KB | **Generador**. `main()` (líneas 21–131) lee el Excel y arma el payload; al final lee `template.html` en la variable `TEMPLATE`. | Sí |
| `template.html` | 82 KB | **Toda la UI**: HTML + CSS + JS del dashboard, con los 4 placeholders. **Único sitio donde se edita la interfaz.** | Sí |
| `index.html` | 4,8 MB | **Artefacto desplegado**. HTML + JS + `const ENC = {...}` con los datos cifrados. Generado, nunca editado a mano. | Sí |
| `vendor/echarts.min.js` | 1.0 MB | Respaldo local de ECharts **5.5.1**. Solo se carga si `window.echarts` no existe tras el `<script>` del CDN. | Sí |
| `pipeline/` | 30 KB | Pipeline de informes: `clean.py`, `analysis.py`, `rep_helpers.js`, `build_report.js`. **Herramienta paralela**: no la importa nadie en producción. | Sí (los intermedios `.json`/`.doc` no) |
| `reports.py` | 31 KB | Genera los informes **Ejecutivo** y de **Riesgo/Recuperados** en HTML (resumen + versión completa). | Sí |
| `secure.py` | 1 KB | Cifrado del payload: PBKDF2-SHA256 + AES-256-GCM, una clave envuelta por PIN. | Sí |
| `risklist.py` | 1.8 KB | Convierte el Excel "Lista de Clientes en Riesgo/Recuperados" (multi-hoja) a JSON. | Sí |
| `cobranza.py` | 16 KB | Convierte el Excel de **conciliación Facturado vs. Cobrado** en el payload `Pcob` de la pestaña 💵 Cobranza. Detecta encabezados por nombre y **aborta el build si la identidad `Facturado = Cobrado + Diferencial + Pendiente` no cuadra**. | Sí |
| `wordrep.py` | 3.4 KB | Extrae el resumen HTML + base64 de los Word de informe (requiere `python-docx`). Recorre el documento **en orden real** (párrafos y tablas intercalados): desde el 8.º corte el informe pone sus hallazgos en tablas, y `d.paragraphs` no las ve. | Sí |
| `publish.py` | 1.4 KB | `git add index.html history.json` + commit `Auto-update <fecha>` + `push origin main`. | Sí |
| `history.json` | 1 KB | Histórico de cortes publicados: **una entrada por corte**, identificado por `dateMax`. | Sí |
| `ve_states.geojson` | 34 KB | 25 estados de Venezuela simplificados, para el mapa choropleth. Se embebe en el HTML. | Sí |
| `Logo.svg` | 160 KB | Logo, se embebe inline en el HTML (placeholder `__LOGO_SVG__`). | Sí |
| `netlify.toml` | 104 B | **Residual**. Netlify ya no se usa (créditos agotados). Se conserva por si se retoma. | Sí |
| `package.json` | 48 B | Solo `{"name":"dashboard-ip","private":true}`. Sin dependencias. No hay build de Node. | Sí |
| `.nojekyll` | 0 B | Evita que GitHub Pages procese el sitio con Jekyll. **No borrar.** | Sí |
| `data_ip.xlsx` | 5.0 MB | Excel fuente de ventas (viene de Drive). | **No** (.gitignore) |
| `risk_list.xlsx` | 79 KB | Excel de lista de riesgo (viene de Drive). | **No** |
| `exec.docx` | 57 KB | Word del informe ejecutivo del corte vigente (viene de Drive). | **No** |
| `cobranza.xlsx` | 1.9 MB | Excel de conciliación de cobranza, 13 hojas (viene de Drive). **Insumo opcional**: si falta, la pestaña se oculta y el resto funciona igual. | **No** |
| `secrets.json` | 334 B | PINs, nombres, roles de los 4 usuarios. | **No — NUNCA subir** |
| `SYSTEM.md`, `COWORK_ACTUALIZACION.md`, `README.md` | — | Documentación. | Sí |

`.gitignore` protege: `secrets.json`, `data_ip.xlsx`, `*.xlsx`, `*.docx`, `patch.py`, `site/`, `*.log`,
los intermedios del pipeline (`pipeline/*.json`, `pipeline/*.doc`, `pipeline/*.pkl`) y `__pycache__/`.
`.gitattributes` marca `vendor/echarts.min.js` como `-text` para que `core.autocrlf` no le reescriba
los finales de línea.

---

## 3. Arquitectura y flujo de datos

```
Google Drive "Informes IP"                    (parentId 1K1FPQkJBgwqjzSoVxEX6AbZFVzhQzscE)
  ├─ Data_IP_Actualizada*.xlsx   (obligatorio)  ─┐
  ├─ *Ejecutivo*.docx            (opcional)      │
  └─ *Lista*Riesgo*.xlsx         (opcional)      │
                                                 v
                              build_dashboard.py  main()
                                 │
                                 ├─ pandas: limpia + codifica dimensiones a índices enteros
                                 ├─ arma payload P {version, fechas, dims, rows}
                                 ├─ reports.build()  ──> exec/risk HTML + actualiza history.json
                                 ├─ wordrep/risklist ──> resúmenes, base64, tabla de riesgo
                                 ├─ secure.encrypt() ──> ENC {iv, ct, users[...]}
                                 └─ TEMPLATE (leído de template.html)
                                       .replace(__VERSION__, __ENC_JSON__, __VE_GEO__, __LOGO_SVG__)
                                                 v
                                          index.html (4,8 MB)
                                                 v
                                  publish.py → git push → GitHub Pages (~1 min)
                                                 v
                       Navegador: PIN → PBKDF2 → AES-GCM → P → new App() → ECharts
```

**No hay servidor.** Todo el cómputo (filtros, KPIs, regresiones, agregaciones) ocurre en el navegador sobre el array `P.rows` en memoria (**72 259 filas** en el corte 8).

### Los 4 placeholders del TEMPLATE
`__VERSION__` · `__ENC_JSON__` · `__VE_GEO__` · `__LOGO_SVG__`. Si añades uno nuevo, hay que sustituirlo en `main()` (líneas ~124–127).

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

### 4.2 Cifras del corte actual (8.º corte, `dateMax` 2026-08-31)

- **72 259 filas** · **21 664 facturas** · **1 566 clientes** por nombre (1 554 por código, ver I6) · **1 990 SKU** (1 964 con `SUMACANT > 0`, ver I2) · **111 marcas** · **20 vendedores** · **39 sectores**
- **Rango:** 2026-01-09 → 2026-08-31 (235 días, `dayCount`)
- **Venta neta total:** **$6 432 655,30** (informe, sin AMERICO/REVIPLAST: **$3 485 916,93**)
- **% de devolución global:** 13,47 % de las unidades
- **Sin mes parcial.** El corte cierra el 31 de agosto, así que agosto está **completo**: `partialInfo()`
  no marca nada como parcial y **el riesgo NO está inflado** (I4). Por eso el riesgo baja de 581 a 493:
  es la corrección del corte anterior —que sí iba a mitad de mes—, no una mejora de la cartera.

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
| 2026-08 | 570 868 | 2 747 | 762 | ← rebote tras julio, mes completo

Por grupo: VIVERES 2,76 M · DESECHABLES 1,89 M · REPOSTERIA 1,67 M · CONDIMENTOS 83 K · CONFITERIA 37 K *(+ el grupo basura `"6"`, $335)*.
Por estado: TRUJILLO 3,35 M · MERIDA 1,60 M · ZULIA 1,37 M · PORTUGUESA 79 K · TACHIRA 28 K.
Top vendedores: Televenta 1,36 M · David 790 K · José 716 K · Santiago 686 K · Jesús 659 K · Yuraima 578 K.
Top marcas: **AMERICO 2,51 M** · MARPLAST (N) 538 K · MAXIPLAST (N) 395 K · MASTER TOP (N) 361 K · MULTIPLAST(N) 194 K · INDELMA (N) 176 K.

**Frente al 7.º corte** (`dateMax` 2026-08-15): +5 757 filas, +$319 014 de neto en el dashboard (+5,2 %),
+27 clientes. Como los cortes son acumulativos (I7), la diferencia **es** lo vendido entre el 16 y el 31 de agosto.

> **AMERICO lleva dos cortes sin moverse** ($2,51 M en el 7.º y en el 8.º): todo el crecimiento del
> período viene de la línea regular. Conviene decirlo cuando alguien lea el total del dashboard como
> crecimiento general.

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

Tras el login, `P` es el payload descifrado:

```js
P = {
  version, generated,          // "2026-08-09 15:26"
  dateMin, dateMax,            // "2026-01-09", "2026-07-31"
  year,                        // "2026"
  dayZero, dayCount,           // "2026-01-09", 235
  dims: { mes, mesLabels, fullLabels, histMonthNums,
          grupo, vendedor, sector, marca, cliente, producto },
  rows: [ [ ... 12 enteros/floats ... ], ... ]   // 72 259 filas
}
```

Cada fila es un array plano; los índices están en la constante `R`:

```js
const R = {MES:0, GRUPO:1, VEND:2, SECTOR:3, MARCA:4, CLI:5,
           PROD:6, DOC:7, CANT:8, DEV:9, NETO:10, DAY:11};
```

- Las dimensiones se **codifican a índices enteros** (`encode()` en `main()`), con los valores ordenados alfabéticamente en `P.dims.*`. Esto es lo que reduce 5 MB de Excel a un payload manejable.
- `MES` es un índice **cronológico** (los meses van ordenados) → permite rangos `[a,b]`.
- `DAY` = días transcurridos desde `P.dayZero`. Es la base del filtro de fechas, del calendario heatmap y de la pestaña Comparar.
- El payload completo (`combined`) que se cifra es:
  `{P, exec, risk, execFull, riskFull, execDocx, riskDocx, riskList, listDocx, driveLinks}`.

> **Limitación estructural:** no se pueden añadir campos al payload sin **regenerar** `index.html` (los datos van cifrados). Por eso cosas como la detección de mes parcial se calculan **en el navegador** a partir de `P.dateMax`, no en Python.

---

## 6. La aplicación front-end

Todo vive en la clase `App` (una sola instancia global, `window.APP`), dentro del último `<script>`.

### 6.1 Segmentadores (filtros)

Estado: `this.f = {mes, grupo, vend, sector, marca, cli}` — cada uno un `Set` de índices.
Rango de fechas: `this.dayRange = [a, b]` en offsets de día.

- **Semántica:** `Set` vacío = "todos". `filtered()` combina todos los filtros **y** el rango de días con AND.
- `DIMS` (en `initMeta()`) define cada segmentador: `{field, names, label}`. `buildFilters()` los dibuja.
- **Chips colapsados** (`syncFilterUI()`): 1 seleccionado → nombre; varios → `"N seleccionadas"`; la ✕ limpia ese filtro.
- Las casillas de cada menú se sincronizan **solo al abrirlo** (rendimiento: 1 566 clientes en el corte 8).
- **Barra de fechas** (`buildDayBar()` sobre `#timebar`): inputs `Desde`/`Hasta` + atajos *Último día · 7 días · Este mes · Todo*. Si no hay `P.dayZero`, la barra se oculta y no se filtra por día.
- Botón **"Limpiar todo"** → `APP.reset()`.

### 6.2 KPIs (8, definidos en `buildKPIs()`)

| id | Etiqueta | Cálculo |
|---|---|---|
| `neto` | Venta neta (hero) | Σ `SUMANETO` |
| `fac` | Facturas | `DOCUMENTO` distintos |
| `tk` | Ticket promedio | neto ÷ facturas |
| `cli` | Clientes únicos | `NOMBRECLI` distintos |
| `sku` | SKU únicos | `PRODUCTO` distintos |
| `uni` | Unidades | Σ `CANTIDAD` |
| `dev` | % Devolución | Σ dev ÷ Σ cant × 100 |
| `proy` | Proyección año | Σ de `projLine()` (reales + proyectados a diciembre) |

Cada KPI tiene: valor, **sparkline** (serie mensual), **delta ▲/▼** (último mes vs. anterior) y un botón **(i)** con explicación (`tip`). Para KPIs de volumen, si el último mes es parcial el delta se calcula sobre el mes **escalado a cierre** y se marca `(proy.)`.

### 6.3 Secciones (panel lateral izquierdo)

La navegación es un **panel lateral colapsable** (`<aside id="sidenav">`), agrupado en cuatro bloques:
**Resumen** · **Análisis** (tend, vend, marca, sector, cli, prod) · **Comparar** · **Informes** (exec, rlist).
El botón **☰ Ocultar menú** vive en la **primera fila dentro del propio panel** (`#navtoggle`); al colapsar,
aparece un botón flotante **☰** (`#navopen`, fijo arriba a la izquierda) para volver a abrirlo. Ambos llaman a
`toggleNav()`, que alterna `body.nav-collapsed` y recuerda el estado en `localStorage` (`ipNavCollapsed`). Bajo 640 px el panel es un **cajón superpuesto** cerrado por defecto (`body.nav-open`),
con scrim, que se cierra al elegir sección o con `Escape`.

> **La trampa:** ECharts **no** se reajusta solo al cambiar el ancho de su contenedor. `toggleNav()` llama
> a `resizeCharts()` a los **260 ms** (algo más que la transición de 220 ms). Y `.content` lleva
> `min-width:0`, sin lo cual la columna flex no puede encogerse y los gráficos se desbordan.

| tab | Título | Contenido principal |
|---|---|---|
| `resumen` | Resumen ejecutivo | Calendario heatmap `c-cal`, tendencia+proyección `c-trend`, participación por grupo `c-grupo`, top 10 vendedores `c-vend10`, top 10 marcas `c-marca10`, crecimiento intermensual `c-mom`, acumulado `c-cum` |
| `tend` | Tendencia y proyección | `c-proj`, tabla `t-proj`, unidades y ticket `c-units` |
| `vend` | Vendedores | `c-vendrank`, `c-vendcmp` (top 6), tabla `t-vend` |
| `marca` | Marcas y grupos | `c-marca-bars`, `c-marcacmp`, `c-grupomes`, tabla `t-marca` |
| `sector` | 🗺️ Sectores / Zonas | `c-secrank`, `c-secestado` (pie), **`c-secmap`** (mapa choropleth), `c-seccmp`, tabla `t-sector` |
| `cli` | Clientes | `c-cli`, Pareto `c-pareto`, `c-clicmp`, **clientes inactivos** `inact-box`, tabla `t-cli` |
| `prod` | Productos / SKU | `c-prodneto`, `c-produ`, `c-prodcmp`, tabla `t-prod` |
| `comp` | ⚖️ Comparar | Dos rangos de fecha A vs B → tabla de 6 indicadores con Δ + `c-cmp` |
| `exec` | 📄 Informe ejecutivo | **En la práctica, siempre el resumen del Word de Drive**: si hay `EXEC_DOCX`, sustituye al HTML de `reports.py`. `execFull` (el informe completo generado) viaja en el payload pero **nadie lo renderiza** — `printFull()` y `downloadDoc()` están definidos y nunca se llaman. Lo que se ve es el resumen + el botón de descarga del Word real. |
| `rlist` | 🔴 Clientes en riesgo y recuperados | Tabla navegable del Excel de Drive + descarga. **Oculta si no hay `riskList`.** |

> **Eliminada:** la pestaña `risk` ("Riesgo y recuperados", resumen del Word de Seguimiento de Clientes).
> El seguimiento de cartera se fusionó en el mismo Excel de `rlist`. `reports.py` **sigue generando**
> `risk`/`riskFull` y el payload sigue trayéndolos: solo dejaron de renderizarse, así que revertir es
> devolver el `<button>` y el `<div class="panel" data-panel="risk">` a `template.html`.

### 6.4 Piezas técnicas del front que conviene conocer

- **`hbz(id, pairs, opt)`** — todas las barras horizontales. Muestra una **ventana fija** (desktop 10–14, **móvil 8**) con **slider vertical** (`dataZoom` con `zoomLock:true`) para recorrer el resto, y `filterMode:'filter'` para que **el eje X se reescale a las barras visibles** (si no, un valor enorme aplasta a los demás).
- **`isMob()`** = `innerWidth <= 640`. Ajusta ventana, márgenes, truncado de etiquetas y fuentes. Al cruzar el breakpoint se re-renderiza la pestaña.
- **`injectDownloads()`** — añade un botón **⬇** al `h3` de cada tarjeta que tenga un `.chart` con id. Exporta PNG **HD**: calcula `pixelRatio` para que el lado largo quede ≥ 2048 px y el corto ≥ 1280 px (umbral para que WhatsApp ofrezca el toggle "HD"), y compone con canvas el **título + subtítulo + línea naranja** sobre la imagen. Archivo `<Titulo>_HD.png`.
- **`injectInfo()`** — inyecta el botón (i) con el texto de `TIPS[chartId]` en cada gráfico. **Si añades un gráfico, añade su entrada en `TIPS`.**
- **`calHeatmap(d)`** — calendario tipo GitHub por día, respeta los filtros, con escala de color numérica visible.
- **Mapa de estados** (`tSector`): `echarts.registerMap('VE', VE_GEO)` una sola vez (`this._veReg`). El estado sale de `sector.split(',')[1]`, normalizado con `vnorm()` (mayúsculas, sin acentos, trim). Clic → `filterByState()` selecciona todos los sectores de ese estado. Tiene roam (zoom/pan) y etiqueta de monto sobre cada estado con datos.
- **`printReport(sel, title)` / `printFull` / `downloadDoc`** — imprimir a PDF y bajar los informes como `.doc` usando `PRINT_CSS`.
- **Paleta:** `PAL` (12 colores). Marca: `--brand:#ff4f20` (naranja) y `--navy:#24205b`. Positivo `#16a34a`, negativo `#e0472c`. Fuente **Inter** (Google Fonts).
- **Dependencias externas (CDN):** `echarts@5.5.1` de jsDelivr y Google Fonts. ECharts **sí tiene respaldo local**: si tras el `<script>` del CDN no existe `window.echarts`, un `document.write` carga `vendor/echarts.min.js` (ruta relativa, por eso `index.html` debe seguir en la raíz del repo). **Google Fonts no tiene respaldo**: sin internet la tipografía cae a `system-ui`, pero los gráficos dibujan igual.

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

Dos informes, cada uno con **resumen** (visible en la pestaña) e **informe completo** (descargable como Word/PDF desde el navegador).

**Metodología clave — ventana reciente = últimos 2 meses:**

- **Cliente en riesgo:** compró en algún mes **anterior a los últimos 2** y **no compró en los últimos 2 meses**.
  → `risk = [c for c in clientes if (meses[c] & prior_all) and not (meses[c] & recent2)]`
- **Cliente recuperado:** compró en el **último mes**, **no** compró en los **2 meses previos a ese**, y **sí** compró antes.
- `risk_val` = valor histórico acumulado de los clientes en riesgo. `recov_val` = compra del último mes de los recuperados.
- Se calculan además: riesgo por vendedor (`rv`), riesgo por sector (`rs`), **Top 20 en riesgo** con última compra (`risk20`), top 10 recuperaciones.
- Perfil de vendedor (`_perfil`): *Alto ticket / mayorista* (ticket > 1,8× mediana) · *Amplitud / venta cruzada* (>120 clientes) · *En desarrollo* (<$15 K) · *Equilibrado*.

**Estructura del informe ejecutivo completo:** 1 resumen + cortes + hallazgos · 2 panorama financiero · 3 evolución temporal + proyección anual · 4 productos/marcas/SKU · 5 clientes · 6 vendedores · 7 geográfico · 8 alertas · 9 insights BI · 10 recomendaciones con responsable y prioridad.

**Recordatorio:** los informes se generan sobre `df_rep`, que **excluye AMERICO y REVIPLAST**. El dashboard no.

### `history.json`
Una entrada **por corte**, con: `version, dateMax, total, best_month, best_val, clientes, riesgo, recuperados, top10_share, ticket`. El corte se identifica por **`dateMax`**: si regeneras el mismo corte con otra versión, `reports.py` **reemplaza** la entrada en vez de añadir una nueva (antes solo comparaba `version`, y por eso se acumularon 7 entradas del corte 2026-06-30). Hoy tiene **3 entradas**: 2026-06-30, 2026-07-15 y 2026-07-31. La vigente (corte 6) es:
total **2 964 385,29** · mejor mes 2026-05 ($553 580,92) · **1 333 clientes** · **428 en riesgo** ·
**38 recuperados** · ticket **193,14** · top10 **34,3 %**.

**Numeración de cortes.** Los primeros informes se hicieron **a mano, antes de que existiera el sistema**, así que no están en `history.json`. Por eso `corte = len(hist) + CORTE_OFFSET`, con `CORTE_OFFSET = 3` en `reports.py` (pisable con la variable de entorno del mismo nombre). **La numeración es la de los archivos de Drive.**

| Entrada de `history.json` | Nº de corte | Archivo en Drive |
|---|---|---|
| `2026-06-30` | Corte 4 | `Informe_Ejecutivo_4toCorte_CierreSemestre_Junio2026…` |
| `2026-07-15` | Corte 5 | `Informe_Ejecutivo_5toCorte_Julio2026…` |
| `2026-07-31` | **Corte 6** (vigente) | `Informe_Ejecutivo_6toCorte_Julio2026…` (`exec.docx`, 57 034 bytes) |
| *(próximo)* | Corte 7 | — |

Si algún día se recuperan los cortes 1–3 y se cargan en `history.json`, hay que **bajar el offset en la misma cantidad**.

### `risk_list.xlsx` (Drive, opcional)
El del corte 6 trae **8 hojas**: `Índice y Seguimiento`, `🔴 En Riesgo` (~428), `🟢 Recuperados Julio`,
`🟢 Recuperados Junio`, `🟢 Recuperados Mayo`, `📊 Riesgo x Vendedor`, `📊 Riesgo x Sector` y **`Leyenda`** (nueva).
`risklist.py` **solo salta las hojas cuyo nombre contiene "ÍNDICE"/"INDICE"**, detecta la fila de encabezados
buscando `#`/`Cliente`/`Vendedor`/`Sector / Zona` en las primeras 4 filas, y devuelve
`{order, sheets:{nombre:{title, headers, rows, count}}}`.

> ⚠️ Consecuencia: **`Leyenda` se renderiza como una pestaña más** en la sección 🔴 Clientes en riesgo.
> Si molesta, la corrección es una línea en `risklist.py` (ampliar el filtro de hojas a saltar), no tocar el front.
> Los nombres de hoja ya no traen el conteo entre paréntesis, así que **no se puede deducir el número de
> clientes del título**: se lee de `count`.

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

**Dónde vive el café es lo más peligroso de leer mal.** El flag `cafeDentro` del payload lo resuelve: si el
MAESTRO trae `Grupo=CAFE`, los totales de la pestaña **ya incluyen** el café y la sección es solo el detalle;
si no lo trae, el café **se suma aparte**. El front cambia el texto de la tarjeta según ese flag (`cobAdapt()`).
Leerlo al revés cuenta el café dos veces, o lo pierde.

**Verificaciones que hace `cobranza.py` y que abortan el build:** la identidad camada a camada, el facturado
neto del MAESTRO contra la hoja `RESUMEN`, y —cuando el diferencial del café hay que deducirlo— que no salga
ningún diferencial negativo y que el total cuadre con el `RESUMEN`. Si el libro se contradice, revienta aquí.

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
2. **Listar Drive** (carpeta "Informes IP", `parentId 1K1FPQkJBgwqjzSoVxEX6AbZFVzhQzscE`) y quedarse
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
   que el JS de `template.html` coincida con el del `index.html` y que pase `node --check`.
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
EXEC_ID=1JVSn9AfT1ypdDpD_bewCu4WLqzFHN5xx LIST_ID=1vqFh1hCurO-rmhugOMGHY5BuctUUgj8j \
COB_ID=11BMPjFFgud7DTn-oEx5hlUHZiG044tSs \
EXEC_DOCX=./exec.docx RISK_LIST_XLSX=./risk_list.xlsx COB_XLSX=./cobranza.xlsx \
SECRETS_PATH=./secrets.json \
python build_dashboard.py ./data_ip.xlsx \
  "1-U7zh9wXpg93Ox2fDBu09R9PYOAtjilh|2026-09-04T03:02:06Z|6050608~E:1JVSn9AfT1ypdDpD_bewCu4WLqzFHN5xx~L:1vqFh1hCurO-rmhugOMGHY5BuctUUgj8j~C:11BMPjFFgud7DTn-oEx5hlUHZiG044tSs|2026-09-06T13:03:39Z|783418" \
  ./index.html
```

`RISK_DOCX` / `RISK_ID` ya no se usan: la pestaña de Seguimiento se eliminó.

Regenerar **el mismo corte** (mismo `dateMax`) ya no duplica nada: `reports.py` **reemplaza** la
entrada de `history.json` en vez de añadirla, aunque cambie la cadena de versión.
Validar después: descifrar con un PIN real y comprobar los 4 logins, `dayCount`, `riskList` y `driveLinks`.

**Variables de entorno que lee `build_dashboard.py`:**
`SECRETS_PATH` (default: `secrets.json` junto al script) · `RISK_LIST_XLSX` · `EXEC_DOCX` · `RISK_DOCX` · **`COB_XLSX`** · `EXEC_ID` · `RISK_ID` · `LIST_ID` · **`COB_ID`** (los IDs generan links `https://drive.google.com/uc?export=download&id=<id>`).

### 10.4 Respaldos
Cada vez que se sube un cambio se guarda una copia completa en:
```
C:\Users\RJ\Desktop\Sitios web  pruebas\dashboard-ip-_backups\prod_<FECHA-HORA>\
```
(fuera del repo, para no inflar git). Si algo se rompe, restaurar del backup más reciente.

---

## 11. ⚠️ Cómo editar sin romper nada

Esta es la parte donde más fácil se rompe el sistema. Leer completo antes de tocar código.

1. **La UI se edita SOLO en `template.html`.** Ya no hay duplicación: `build_dashboard.py` lee ese archivo al arrancar. **Nunca edites `index.html` a mano** — es un artefacto generado y cualquier cambio se pierde en la siguiente regeneración.
2. **Para ver el cambio en producción hay que regenerar**, lo que exige `secrets.json` + el Excel. Si no los tienes a mano, puedes previsualizar abriendo `template.html` en el navegador (los gráficos no dibujarán porque no hay datos, pero el layout y el CSS sí se ven).
3. **Finales de línea:** `template.html` se lee con `newline` por defecto (universal), así que da igual si git lo deja en LF o en CRLF — el `index.html` sale idéntico en ambos casos. No "arregles" eso poniendo `newline=""`: con `core.autocrlf=true` produciría `\r\r\n`.
4. **Un cambio a la vez, en rama, con respaldo.** El respaldo va a `dashboard-ip-_backups\prod_<FECHA-HORA>\`.
5. **Validar siempre antes de subir:**
   - JS: extraer el último `<script>` de `template.html` y correr `node --check`.
   - Python: `python -m py_compile build_dashboard.py reports.py`.
   - **Regresión de salida:** genera un `index.html` antes y después del cambio y compáralos enmascarando el bloque `const ENC = {…}` (es aleatorio por diseño: `secure.encrypt` usa `os.urandom` para IV, salt y clave maestra, así que **dos builds nunca son byte a byte iguales**) y el marcador `DATA_VERSION`. Todo lo demás debe coincidir.
6. **Al añadir un gráfico nuevo:** darle un `id` que empiece por `c-`, meterlo dentro de una `.card` con su `h3` y `.hint`, y **añadir su texto a `TIPS`** (si no, no tendrá botón (i); el botón ⬇ de descarga se inyecta solo).
7. **Al añadir una dimensión/filtro nuevo:** hay que tocar `R`, `encode()` en `main()`, `payload.dims`, `DIMS` en `initMeta()`, `filtered()`, el HTML de la `.bar`, y **regenerar** (los datos van cifrados, no basta con editar el HTML).
8. No borrar `.nojekyll` ni `Logo.svg` ni `ve_states.geojson`: los tres son necesarios para generar/servir.
9. `ve_states.geojson` se puede regenerar con `scratchpad/simplify_geo.py` a partir de geoBoundaries VEN ADM1.

---

## 12. Estado actual y deuda técnica conocida

**Funcionando:**
- 10 secciones en panel lateral colapsable, 8 KPIs, ~25 gráficos, mapa choropleth interactivo, calendario heatmap, comparador de períodos, clientes inactivos (>45 días), descarga HD de gráficos, informe ejecutivo con descarga Word/PDF, lista de riesgo y recuperados desde Drive.
- Responsive con breakpoint en 640 px (panel lateral off-canvas en móvil).
- **Una sola fuente de UI** (`template.html`); `index.html` es puro artefacto.
- Pipeline de informes versionado en `pipeline/`, con las cifras verificadas contra `reports.py`.

**Deuda / limitaciones conocidas:**
- **Roles decorativos** — todos ven todo. Segmentar por rol exige payloads separados y cifrados por rol; es un proyecto, no un ajuste de UI.
- **Google Fonts sigue viniendo de CDN**: sin internet la tipografía cae al `system-ui` del sistema (los gráficos ya no dependen del CDN gracias a `vendor/echarts.min.js`).
- **`index.html` de 6,1 MB** en cada commit: el repo crece rápido (un blob nuevo completo por corte). Opciones sin decidir: Git LFS o publicar el artefacto fuera de git.
- **Datos sucios sin limpiar en el dashboard** (`VENDEDOR` "23"/"2", `GRUPO` "6") aparecen como opciones reales en los filtros. El **pipeline de informes** sí los excluye (`pipeline/clean.py`), pero el dashboard no.
- **Sin tests.** La validación es manual (`node --check`, `py_compile`, comparación de salida, revisión visual).
- `netlify.toml` y la carpeta `netlify/functions` son residuales.
- **`history.json` tiene 5 cortes registrados** (`2026-06-30`, `2026-07-15`, `2026-07-31`, `2026-08-15`, `2026-08-31`); los cortes 1–3 se hicieron a mano antes del sistema y no están. Se compensa con `CORTE_OFFSET = 3` en `reports.py`, pero **la tabla "Evolución entre cortes" solo puede comparar los cortes que sí están en el histórico** (hoy, cinco).
- **«Recuperados» significa dos cosas distintas y ambas se publican.** `reports.py` exige compra **anterior** a los dos meses dormidos (8.º corte: **71**); el Excel que arma Roberts a mano cuenta todo el que compró en el mes sin haber comprado en los dos anteriores, **incluidos los clientes nuevos** (8.º corte: **130**). Los 59 de diferencia son clientes cuya primera compra del año fue agosto. Los dos números conviven en el dashboard —el 71 en el informe generado, el 130 en la pestaña de la lista de Drive— y **no se han unificado**: cambiar el criterio de `reports.py` rompería la serie de `history.json` (54 · 17 · 38 · 33 · 71).
- **La hoja `Leyenda` del Excel de riesgo se cuela como pestaña** en la sección de riesgo (§8).
- **El sufijo `(N)` de las marcas no está normalizado** (§4.3.8): `FULLCREAM` se cuenta dos veces.

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
| **`TEMPLATE`** | La variable de `build_dashboard.py` con toda la app; **se lee de `template.html`**, ya no está incrustada en el `.py`. |

---

## 14. Historial de cambios del sistema

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

**Estado del repositorio:** rama `main`. Lo publicado en GitHub Pages corresponde al **corte 8**
(`DATA_VERSION` en la línea 2 de `index.html`, `dateMax` 2026-08-31). Los archivos de trabajo
(`data_ip.xlsx`, `risk_list.xlsx`, `exec.docx`, `cobranza.xlsx`, `secrets.json`) están en la carpeta
pero **fuera de git**, así que se puede regenerar el mismo corte sin bajar nada de Drive.

**Ojo con el corte 9:** el Excel de conciliación cambió de formato entre el 7.º y el 8.º corte, y no hay
razón para pensar que se estabilizó. `cobranza.py` acepta los dos formatos por nombre de encabezado, pero un
tercero volverá a romperlo. El primer paso al recibir un corte nuevo de cobranza es **volcar los encabezados
de todas las hojas** y compararlos con la tabla de §8 bis antes de correr el build.

**Antes de aceptar una instrucción nueva, ubícala en una de estas tres categorías** — cada una tiene un
camino distinto y confundirlas es la forma más rápida de romper algo:

| Tipo de tarea | Qué se toca | Qué NO se toca | Validación mínima |
|---|---|---|---|
| **A · Corte nuevo** (Excel nuevo de Drive) | `data_ip.xlsx`, `exec.docx`, `risk_list.xlsx`, `index.html`, `history.json` | Nada de código | Los 9 pasos de §10.2, con I1 (`FECHADOC.max()`) y el cotejo del §10.2-8 |
| **B · Cambio de interfaz o de cálculo** | `template.html` (UI) · `reports.py` / `pipeline/` (informes) · `build_dashboard.py` (payload) | **`index.html` jamás a mano** | `node --check` del último `<script>`, `py_compile`, y regeneración comparando salida enmascarando `ENC` y `DATA_VERSION` (§11.5) |
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
esperada es un cambio en `template.html` (o en el `.py` que corresponda) **más** una regeneración validada;
si es de tipo A, la salida es un `index.html` nuevo y una entrada nueva en `history.json`. En ambos casos,
respaldo previo en `dashboard-ip-_backups\prod_<FECHA-HORA>\` (§10.4).

> **Espacio reservado.** Las instrucciones nuevas pueden anexarse debajo de esta línea como §15.1, §15.2…
> sin tocar el resto del documento.

---

*Elaborado a partir del código y los datos reales del repositorio. Autor del sistema: Ing. Roberts Flores.*
*Última verificación contra código y datos: **2026-08-20** (corte 6).*
