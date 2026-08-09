# CONTEXTO — Dashboard IP (Distribuidora y Suministros IP)

> Documento único de contexto para cargar en un **Proyecto de Claude**.
> Contiene: qué es el sistema, cómo está construido, cómo son los datos, cómo se despliega,
> cómo se edita sin romperlo, y las trampas conocidas.
> Verificado contra el código y los datos reales el **2026-08-08**.
> **No contiene PINs, tokens ni credenciales.**

---

## 1. Resumen en 10 líneas

- Es un **dashboard de inteligencia de ventas** para *Distribuidora y Suministros IP* (distribuidora de víveres, desechables y repostería en el occidente de Venezuela).
- Es **una sola página estática** (`index.html`, ~4.5 MB) que se genera con Python desde un Excel de ventas.
- Los datos van **cifrados dentro del HTML** (AES-256-GCM). Se abren con un **PIN de 6 dígitos** por usuario; el descifrado ocurre en el navegador con WebCrypto.
- Los gráficos son **ECharts 5.5.1** (desde CDN, con respaldo local en `vendor/echarts.min.js` si el CDN no responde). No hay backend, ni base de datos, ni API.
- Se publica en **GitHub Pages** → https://robertsrf.github.io/dashboard-ip-/ (repo `Robertsrf/dashboard-ip-`, rama `main`).
- Se actualiza **cada 3 días** con una tarea automática (Claude Cowork) que lee Google Drive, regenera y hace `git push`.
- El HTML/CSS/JS vive en **`template.html`**, un único archivo que `build_dashboard.py` lee al arrancar. *(Antes estaba duplicado dentro del `.py` y había que editar dos sitios; eso se eliminó — ver §14.)*
- Los datos son **cortes quincenales acumulativos**: el último mes casi siempre está incompleto, y el sistema lo compensa explícitamente.
- Autor: **Ing. Roberts Flores**.
- Documentación previa en el repo: `SYSTEM.md` (referencia técnica), `COWORK_ACTUALIZACION.md` (la tarea automática), `README.md` (mínimo). Este documento los engloba.

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
Sobre el 5.º corte: **1 757** con filtro frente a 1 782 sin él.

**I3 · Los informes excluyen AMÉRICO y REVIPLAST; el dashboard los incluye.**
Por eso el total del dashboard (**$5,65 M**) nunca cuadra con el del informe ejecutivo (**$2,80 M**).
**No es un bug** — es la diferencia de universo. Si alguien reporta el descuadre, esta es la respuesta.

**I4 · Con el mes en curso incompleto, el universo de "riesgo" está inflado.**
El riesgo se define como "sin comprar en los últimos 2 meses"; si uno de esos dos meses va a medias,
entran clientes que sencillamente aún no han comprado. **Nunca leer el riesgo con un mes a medias**
sin decirlo explícitamente en el informe.

**I5 · Las devoluciones no son venta.** `CNTDEVUELT` es un contador de unidades devueltas.
La venta es y solo es **`SUMANETO`**. No restar ni sumar `CNTDEVUELT` a los ingresos.

**I6 · `CODCLIENTE` es la clave fiable de cliente, no `NOMBRECLI`.**
Por nombre salen **1 491** clientes; por código, **1 480**. La diferencia son variantes de escritura del
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
| `template.html` | 78 KB | **Toda la UI**: HTML + CSS + JS del dashboard, con los 4 placeholders. **Único sitio donde se edita la interfaz.** | Sí |
| `index.html` | 4.5 MB | **Artefacto desplegado**. HTML + JS + `const ENC = {...}` con los datos cifrados. Generado, nunca editado a mano. | Sí |
| `vendor/echarts.min.js` | 1.0 MB | Respaldo local de ECharts **5.5.1**. Solo se carga si `window.echarts` no existe tras el `<script>` del CDN. | Sí |
| `pipeline/` | 30 KB | Pipeline de informes: `clean.py`, `analysis.py`, `rep_helpers.js`, `build_report.js`. **Herramienta paralela**: no la importa nadie en producción. | Sí (los intermedios `.json`/`.doc` no) |
| `reports.py` | 30 KB | Genera los informes **Ejecutivo** y de **Riesgo/Recuperados** en HTML (resumen + versión completa). | Sí |
| `secure.py` | 1 KB | Cifrado del payload: PBKDF2-SHA256 + AES-256-GCM, una clave envuelta por PIN. | Sí |
| `risklist.py` | 1.8 KB | Convierte el Excel "Lista de Clientes en Riesgo/Recuperados" (multi-hoja) a JSON. | Sí |
| `wordrep.py` | 0.9 KB | Extrae resumen HTML + base64 de los Word de informe (requiere `python-docx`). | Sí |
| `publish.py` | 1.4 KB | `git add index.html history.json` + commit `Auto-update <fecha>` + `push origin main`. | Sí |
| `history.json` | 1 KB | Histórico de cortes publicados: **una entrada por corte**, identificado por `dateMax`. | Sí |
| `ve_states.geojson` | 34 KB | 25 estados de Venezuela simplificados, para el mapa choropleth. Se embebe en el HTML. | Sí |
| `Logo.svg` | 160 KB | Logo, se embebe inline en el HTML (placeholder `__LOGO_SVG__`). | Sí |
| `netlify.toml` | 104 B | **Residual**. Netlify ya no se usa (créditos agotados). Se conserva por si se retoma. | Sí |
| `package.json` | 48 B | Solo `{"name":"dashboard-ip","private":true}`. Sin dependencias. No hay build de Node. | Sí |
| `.nojekyll` | 0 B | Evita que GitHub Pages procese el sitio con Jekyll. **No borrar.** | Sí |
| `data_ip.xlsx` | 5.0 MB | Excel fuente de ventas (viene de Drive). | **No** (.gitignore) |
| `risk_list.xlsx` | 91 KB | Excel de lista de riesgo (viene de Drive). | **No** |
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
  ├─ *Seguimiento/Riesgo*.docx   (opcional)      │
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
                                          index.html (4.5 MB)
                                                 v
                                  publish.py → git push → GitHub Pages (~1 min)
                                                 v
                       Navegador: PIN → PBKDF2 → AES-GCM → P → new App() → ECharts
```

**No hay servidor.** Todo el cómputo (filtros, KPIs, regresiones, agregaciones) ocurre en el navegador sobre el array `P.rows` en memoria (~58.7 K filas).

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
| `SUBGRUPO` | float | Código numérico de subgrupo. **8 800 nulos. El dashboard NO lo usa.** |
| `CANTIDAD` | float | Unidades vendidas. |
| `CNTDEVUELT` | float | Unidades devueltas. |
| `PRECIOUNIT` | float | Precio unitario (USD). |
| `FECHADOC` | fecha | Fecha del documento. Filas sin fecha se **descartan**. |
| `CODCLIENTE` | texto | Código de cliente (1 480 únicos). **No se usa en el dashboard.** |
| `NOMBRECLI` | texto | Nombre del cliente (1 491 únicos → hay clientes con mismo código y distinto nombre). |
| `VENDEDOR` | texto | 21 valores. |
| `SECTOR` | texto | `CIUDAD,ESTADO,VE` — 39 valores. |
| `REFERENCIA` | texto | Sub-familia de producto (260 valores). **127 nulos. No se usa.** |
| `MARCA` | texto | 105 valores. 127 nulos. |
| `SUMACANT` | float | = `CANTIDAD − CNTDEVUELT` (verificado: coincide en el 100 % de las filas). |
| `SUMANETO` | float | = `SUMACANT × PRECIOUNIT` (verificado 100 %). **Es LA métrica de venta neta.** |

### 4.2 Cifras del corte actual (5.º corte, `dateMax` 2026-07-15)

- **58 762 filas** · **17 953 facturas** · **1 491 clientes** · **1 823 SKU** · **105 marcas** · **21 vendedores** · **39 sectores**
- **Rango:** 2026-01-09 → 2026-07-15 (188 días, `dayCount`)
- **Venta neta total:** **$5 654 878,14**
- **% de devolución global:** 12,54 % de las unidades

Venta neta por mes:

| Mes | Neto | Facturas | Clientes |
|---|---|---|---|
| 2026-01 | 620 282 | 1 652 | 673 |
| 2026-02 | 952 419 | 2 655 | 910 |
| 2026-03 | 1 091 181 | 3 319 | 989 |
| 2026-04 | 843 932 | 2 594 | 889 |
| 2026-05 | 1 110 243 | 3 453 | 984 |
| 2026-06 | 811 207 | 3 027 | 901 |
| **2026-07** | **225 614** | 1 253 | 445 | ← **mes parcial (solo 15 días)** |

Por grupo: VIVERES 2,67 M · DESECHABLES 1,51 M · REPOSTERIA 1,37 M · CONDIMENTOS 70 K · CONFITERIA 27 K.
Por estado: TRUJILLO 3,01 M · MERIDA 1,38 M · ZULIA 1,17 M · PORTUGUESA 64 K · TACHIRA 24 K.
Top vendedores: Televenta 1,14 M · David 679 K · Santiago 616 K · Jesús 597 K · José 589 K · Yuraima 578 K.
Top marcas: **AMERICO 2,51 M** · MARPLAST 437 K · MAXIPLAST 315 K · MASTER TOP 286 K · MULTIPLAST 154 K.

### 4.3 ⚠️ Peculiaridades y suciedad de datos (importantes)

1. **AMERICO + REVIPLAST = 50,5 % del neto ($2,86 M en 8 107 filas).** El **dashboard los incluye**; los **informes automáticos los EXCLUYEN** (`build_dashboard.py` filtra `MARCA == "AMERICO"` o `NOMBRECLI` que contenga `REVIPLAST` antes de llamar a `reports.build`). **Por eso el total del dashboard ($5,65 M) NUNCA cuadra con el total del informe ejecutivo ($2,80 M).** No es un bug.
2. **Valores basura en dimensiones:** `VENDEDOR` tiene `"23"` (23 filas) y `"2"` (1 fila); `GRUPO` tiene `"6"` (56 filas, $335). Aparecen tal cual como opciones en los segmentadores. Nadie los ha limpiado.
3. **Espacios sobrantes** en algunos valores (`"Jesús "`, `"Laura "`, `"Santiago "`). `build_dashboard.py` hace `.str.strip()`, así que en el dashboard aparecen unificados; en un análisis crudo del Excel hay que hacer strip.
4. **Acentos:** los datos están correctos en UTF-8 (José, Jesús, Rosángela, Ángel, CAÑO ZANCUDO). Si ves `Jes�s` es **la consola de Windows** (cp1252), no los datos. En Windows usar `PYTHONIOENCODING=utf-8`.
5. **`MARCA` nula (127 filas)** → `fillna("(Sin dato)")` la convierte en `"(Sin dato)"`, **no** en `"(Sin marca)"` (el `.replace` a `"(Sin marca)"` solo actúa sobre literales `"nan"` y `""`, que ya no existen tras el fillna). Detalle menor pero explica por qué nunca ves `(Sin marca)`.
6. **Un sector tiene espacio tras la coma:** `"EL CHIVO, ZULIA,VE"`. Funciona igual porque `vnorm()` hace trim al extraer el estado.
7. **`CODCLIENTE` (1 480) ≠ `NOMBRECLI` (1 491)**: hay nombres duplicados/variantes. Todos los KPIs de "clientes únicos" cuentan por **nombre**, no por código.
8. **Los cortes son acumulativos**: cada Excel nuevo trae TODO el año, no solo lo nuevo. Comparar cortes = comparar totales, no sumarlos.

---

## 5. Modelo de datos en el navegador

Tras el login, `P` es el payload descifrado:

```js
P = {
  version, generated,          // "2026-07-21 23:59"
  dateMin, dateMax,            // "2026-01-09", "2026-07-15"
  year,                        // "2026"
  dayZero, dayCount,           // "2026-01-09", 188
  dims: { mes, mesLabels, fullLabels, histMonthNums,
          grupo, vendedor, sector, marca, cliente, producto },
  rows: [ [ ... 12 enteros/floats ... ], ... ]   // 58 762 filas
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
- Las casillas de cada menú se sincronizan **solo al abrirlo** (rendimiento con 1 491 clientes).
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
El botón **☰** de la barra superior alterna `body.nav-collapsed` y el estado se recuerda en `localStorage`
(`ipNavCollapsed`). Bajo 640 px el panel es un **cajón superpuesto** cerrado por defecto (`body.nav-open`),
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
| `exec` | 📄 Informe ejecutivo | HTML generado por `reports.py` (o resumen del Word de Drive) |
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
- **Dependencias externas (CDN):** `echarts@5.5.1` de jsDelivr y Google Fonts. **Si el CDN cae, el dashboard no dibuja.** No hay fallback local.

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
Una entrada **por corte**, con: `version, dateMax, total, best_month, best_val, clientes, riesgo, recuperados, top10_share, ticket`. El corte se identifica por **`dateMax`**: si regeneras el mismo corte con otra versión, `reports.py` **reemplaza** la entrada en vez de añadir una nueva (antes solo comparaba `version`, y por eso se acumularon 7 entradas del corte 2026-06-30). Hoy tiene **2 entradas**: 2026-06-30 y 2026-07-15 (total 2 799 090,11 · 1 309 clientes · 484 en riesgo · 17 recuperados · ticket 193,95 · top10 34,7 %).

**Numeración de cortes.** Los primeros informes se hicieron **a mano, antes de que existiera el sistema**, así que no están en `history.json`. Por eso `corte = len(hist) + CORTE_OFFSET`, con `CORTE_OFFSET = 4` en `reports.py` (pisable con la variable de entorno del mismo nombre).

| Entrada de `history.json` | Nº de corte en el informe |
|---|---|
| `2026-06-30` | Corte 5 |
| `2026-07-15` | Corte 6 |
| *(próximo: `2026-07-30`)* | **Corte 7** |

Si algún día se recuperan los cortes 1–4 y se cargan en `history.json`, hay que **bajar el offset en la misma cantidad**.

### `risk_list.xlsx` (Drive, opcional)
7 hojas: `Índice`, `🔴 En Riesgo (478)`, `🟢 Recuperados Julio (18)`, `🟢 Recuperados Junio (48)`, `🟢 Recuperados Mayo (139)`, `📊 Riesgo x Vendedor`, `📊 Riesgo x Sector`. `risklist.py` salta la hoja "Índice", detecta la fila de encabezados buscando `#`/`Cliente`/`Vendedor`/`Sector / Zona` en las primeras 4 filas, y devuelve `{order, sheets:{nombre:{title, headers, rows, count}}}`.

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

### 10.2 Tarea automática (Claude Cowork, cada 3 días)
Descrita a fondo en `COWORK_ACTUALIZACION.md`. Resumen:

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

### 10.3 Regeneración manual (en la PC del autor)
Necesita `secrets.json` + `data_ip.xlsx` + `risk_list.xlsx` en la carpeta del repo (los tres están gitignored).

```bash
EXEC_ID=<execId> RISK_ID=<riskId> LIST_ID=<listId> \
RISK_LIST_XLSX=./risk_list.xlsx SECRETS_PATH=./secrets.json \
python build_dashboard.py ./data_ip.xlsx "<VERSION>" ./index.html
# opcional: EXEC_DOCX=./exec.docx RISK_DOCX=./risk.docx
```

Usar **la MISMA versión** que ya está publicada evita que `reports.py` duplique el corte en `history.json`.
Validar después: descifrar con un PIN real y comprobar los 4 logins, `dayCount`, `riskList` y `driveLinks`.

**Variables de entorno que lee `build_dashboard.py`:**
`SECRETS_PATH` (default: `secrets.json` junto al script) · `RISK_LIST_XLSX` · `EXEC_DOCX` · `RISK_DOCX` · `EXEC_ID` · `RISK_ID` · `LIST_ID` (los tres IDs generan links `https://drive.google.com/uc?export=download&id=<id>`).

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
- **`index.html` de 4,5 MB** en cada commit: el repo crece rápido (un blob nuevo completo por corte). Opciones sin decidir: Git LFS o publicar el artefacto fuera de git.
- **Datos sucios sin limpiar en el dashboard** (`VENDEDOR` "23"/"2", `GRUPO` "6") aparecen como opciones reales en los filtros. El **pipeline de informes** sí los excluye (`pipeline/clean.py`), pero el dashboard no.
- **Sin tests.** La validación es manual (`node --check`, `py_compile`, comparación de salida, revisión visual).
- `netlify.toml` y la carpeta `netlify/functions` son residuales.
- **`history.json` solo tiene 2 cortes registrados** (`2026-06-30` y `2026-07-15`); los cortes 1–4 se hicieron a mano antes del sistema y no están. Se compensa con `CORTE_OFFSET = 4` en `reports.py`, pero **la tabla "Evolución entre cortes" solo puede comparar los cortes que sí están en el histórico** (hoy, dos).

---

## 13. Glosario rápido

| Término | Significado en este sistema |
|---|---|
| **Corte** | Una publicación/actualización del dashboard con un Excel nuevo. Van 5 cortes reales. |
| **Neto / venta neta** | `SUMANETO` = (cantidad − devoluciones) × precio unitario, en USD. |
| **Factura** | Un `DOCUMENTO` distinto. |
| **Mes parcial** | El último mes del rango, incompleto porque el corte es quincenal. |
| **Cliente en riesgo** | Compró antes, pero no en los últimos 2 meses. |
| **Cliente recuperado** | Volvió a comprar en el último mes tras 2 meses dormido. |
| **Cliente inactivo** | Card del dashboard: sin compras hace >45 días (criterio distinto al de "riesgo" de los informes). |
| **Sector / Zona** | Ciudad en formato `CIUDAD,ESTADO,VE`. |
| **DATA_VERSION** | Huella de versión en la línea 2 de `index.html`; decide si hay que reconstruir. |
| **`P`** | El objeto de datos descifrado en el navegador. |
| **`ENC`** | El bloque cifrado embebido en el HTML. |
| **`TEMPLATE`** | El string con toda la app dentro de `build_dashboard.py`. |

---

## 14. Historial de cambios del sistema

- **2026-08-09** — Ejecución del documento *MEJORAS_SISTEMA_IP*: **B1** el `TEMPLATE` sale a `template.html` (fin de la duplicación); **B4** las secciones pasan a un **panel lateral colapsable** agrupado en cuatro bloques, con `resize()` de ECharts tras el toggle; **B3** respaldo local de ECharts en `vendor/`; **B2** `history.json` queda con una entrada por corte y `reports.py` deja de acumular duplicados; **A1/A2/A4** pipeline de informes versionado en `pipeline/` (`clean.py`, `analysis.py`, `rep_helpers.js`, `build_report.js`) con `REFERENCIA`, `SUBGRUPO` y `CODCLIENTE`; **A3** sección de **invariantes metodológicos** al inicio de este documento. Además se **elimina la pestaña "Riesgo y recuperados"**: el seguimiento de clientes se fusionó en el Excel de la lista de riesgo.
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

*Elaborado a partir del código y los datos reales del repositorio. Autor del sistema: Ing. Roberts Flores.*
