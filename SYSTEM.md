# SYSTEM.md — Dashboard IP (Distribuidora y Suministros IP)

> Documento de referencia rápida para entender y modificar este sistema sin tener que releer todo el código.
> **Mantener actualizado después de CADA cambio.** Última actualización: 2026-07-21.

---

## 1. Qué es

Dashboard de **Inteligencia de Ventas** para *Distribuidora y Suministros IP*. Es una sola página
(`index.html`) autocontenida, protegida por PIN, con gráficos ECharts, KPIs, tablas e informes.
Se genera con Python a partir de un Excel de ventas y se despliega en **Netlify**.

- **En producción:** GitHub (`Robertsrf/dashboard-ip-`, rama `main`) → **GitHub Pages** despliega solo con cada push. URL: https://robertsrf.github.io/dashboard-ip-/
- **Netlify quedó fuera** (créditos agotados, deploys pausados). Se conserva `netlify.toml` por si se retoma, pero el sitio vive en GitHub Pages.
- **Autor:** Ing. Roberts Flores.

## 2. Arquitectura / stack

| Pieza | Rol |
|-------|-----|
| `build_dashboard.py` | Script generador. Lee el Excel, codifica dimensiones, arma el payload, lo **encripta** y lo inyecta en `index.html`. **Contiene el `TEMPLATE` (todo el HTML/CSS/JS) como string.** |
| `index.html` | Artefacto final desplegado (~4.2 MB). Contiene el JS de la app + los datos **encriptados** en `const ENC = {...}`. |
| `reports.py` | Genera los informes Ejecutivo y de Riesgo/Recuperados (HTML). |
| `risklist.py` | Carga la lista de clientes en riesgo desde un Excel de Drive (opcional). |
| `wordrep.py` | Extrae resumen + base64 de documentos Word cargados en Drive (opcional). |
| `secure.py` | Cifrado del payload: PBKDF2 + AES-GCM por usuario (PIN de 6 dígitos). |
| `secrets.json` | **NO está en el repo** (gitignored). Define usuarios, salts, claves envueltas, roles. |
| `netlify/functions/` | Funciones serverless (p.ej. `log` = registro de ingresos). |
| `netlify.toml` | `publish = "."` (sirve la carpeta tal cual), functions en `netlify/functions`. |
| `history.json` | Histórico de cortes para los informes. |
| `Logo.svg` | Logo embebido. |

### Flujo de datos
```
Excel ventas ──> build_dashboard.py ──> encode dims + rows ──> combinar con informes
                                                            └─> secure.encrypt (PIN) ──> ENC
                                     TEMPLATE (HTML/CSS/JS) + ENC ──> index.html ──> Netlify
```

## 3. ⚠️ CÓMO EDITAR (importante)

- **`secrets.json` y el Excel NO están en esta carpeta** (están en la PC/Drive del autor). Por eso
  **no se puede regenerar `index.html` desde cero aquí.**
- Para cambios en vivo se edita **directamente el JS/CSS/HTML dentro de `index.html`** (es texto plano;
  los datos encriptados en `ENC` no se tocan) **y se replica el mismo cambio en el `TEMPLATE` de `build_dashboard.py`**
  para que no se pierda cuando el autor regenere el dashboard.
- **El JS/CSS/HTML está DUPLICADO** en `index.html` y en `build_dashboard.py` (TEMPLATE). **Mantener ambos en sync.**
- Ambos archivos usan **finales de línea CRLF**. Al editar por script, leer/escribir con `newline=""` y usar `\r\n`.
- **Validar antes de subir:**
  - JS: extraer el último `<script>` de `index.html` y `node --check`.
  - Python: `python -m py_compile build_dashboard.py`.
- Método recomendado para editar ambos a la vez: script Python con lista de `(old, new)` que verifica
  que cada sustitución ocurra **exactamente 1 vez** en cada archivo (evita ediciones parciales).

## 4. Modelo de datos en el front (dentro del JS)

Cada fila `P.rows[i]` es un array; los índices están en `R`:
```
R = {MES:0, GRUPO:1, VEND:2, SECTOR:3, MARCA:4, CLI:5, PROD:6, DOC:7, CANT:8, DEV:9, NETO:10}
```
`P.dims` contiene los nombres/labels por dimensión:
`mes, mesLabels, fullLabels, histMonthNums, grupo, vendedor, sector, marca, cliente, producto`.

- `MES` es un índice cronológico (los meses están ordenados), por eso el slider de tiempo usa rango `[a,b]`.
- Los KPIs, gráficos y tablas se recalculan sobre `this.filtered()` en cada `render()`.

## 5. Segmentadores (filtros) y cómo funcionan

Clase `App`. Estado de filtros: `this.f = {mes, grupo, vend, sector, marca, cli}` (cada uno un `Set` de índices).
Rango de tiempo: `this.timeRange = [a, b]` (índices de mes).

- **Semántica:** `Set` vacío = "todos" (sin filtrar). `filtered()` combina TODOS los filtros + el rango de tiempo (AND).
- `DIMS` (en `initMeta`) define cada segmentador: `{field, names, label}`. Los del menú se dibujan en `buildFilters()`.
- **Chips (colapsados):** en `syncFilterUI()`. 1 seleccionado → muestra el nombre; varios → `"N seleccionadas"`; el ✕ limpia todo ese filtro. Hay un chip aparte para el rango de tiempo.
- **Casillas:** se sincronizan **solo al abrir** cada menú (por rendimiento con muchos clientes), no en cada render.
- **Slider de tiempo:** `buildTimeSlider()` crea 2 `<input type=range>` superpuestos (doble manija) sobre `#timebar`.
  `paintTime()` pinta el relleno/etiqueta; `resetTime()` lo devuelve a "Todo el período".
- **Barra de filtros (HTML):** `<div class="bar">` con `<div class="ms" data-dim="...">` para cada uno,
  luego `<div class="timebar" id="timebar">` (slider) y `<div class="chips" id="chips">`.

### Segmentadores actuales
`Mes` · `Grupo` · `Vendedor` · `Sector` · `Marca` · `Cliente` · **Slider de rango de tiempo**.

## 5b. Proyección / tendencia con MES PARCIAL (importante)

El usuario sube **cortes quincenales**, así que el último mes suele estar incompleto (p.ej. 15 días).
Para que las tendencias no lo traten como mes cerrado:

- `partialInfo(mo)`: detecta mes parcial **en el navegador** usando `P.dateMax` (día del corte vs. días del mes). `frac = díasTranscurridos / díasDelMes`. El mes parcial es el último índice de `P.dims.mes`. (No se puede añadir campos al payload porque va encriptado.)
- `effNeto(mo)`: serie mensual "efectiva" donde el mes parcial se **escala a cierre** (`neto / frac`).
- `projLine(mo)`: la **regresión lineal se ajusta en espacio de mes-calendario** (`idxData`, no `0..n`) sobre la serie efectiva → la recta pasa por los datos reales y proyecta el cierre del mes parcial + los meses siguientes de forma continua. El mes parcial muestra barra clara + punto de proyección (cierre estimado).
- Afecta: `c-trend`, `c-proj`, tabla `t-proj` (marca `parcial`), KPI *Proyección año*, `c-mom` (usa serie efectiva), y el delta "(proy.)" de los KPIs de volumen.

## 6. Pestañas (tabs)

`resumen` (KPIs + tendencia/proyección + top vend/marca), `tend` (proyección lineal), `vend`, `marca`,
`cli`, `prod`, `exec` (informe ejecutivo), `risk` (riesgo/recuperados), `rlist` (lista Drive, oculta si no hay).
La pestaña `log` (registro de ingresos) se **eliminó** al pasar a GitHub Pages (era una función serverless de Netlify).

## 7. Seguridad / acceso

- Puerta de PIN de 6 dígitos (`#gate`). El PIN deriva una clave (PBKDF2) que desencripta `ENC` en el navegador (AES-GCM).
- Usuarios y roles viven en `secrets.json` (fuera del repo).
- Nota: todo el JS ya es público en `index.html`; la seguridad depende del PIN/cifrado, no de ocultar el código.

## 8. Despliegue (GitHub Pages)

1. `git add` + `commit` + `push` a `main` (o correr `python publish.py`).
2. **GitHub Pages** detecta el push y publica (~1 min). Config: Settings → Pages → Deploy from a branch → `main` / `/ (root)`. El `.nojekyll` evita el procesado Jekyll.
3. Verificar en https://robertsrf.github.io/dashboard-ip-/ con el PIN.
4. **Tarea automática (Cowork, cada 3 días):** genera `index.html` con `build_dashboard.py` y luego llama a **`python publish.py`** (git add/commit/push). Antes desplegaba a Netlify; ahora publica por git. El entorno de la tarea necesita credenciales de push a GitHub (token/PAT o SSH).
5. **Ya NO hay funciones serverless.** Se quitó la función `log` (registro de ingresos) porque GitHub Pages es solo estático. El login sigue igual; solo no se registra quién entra.

## 9. Respaldos

Cada vez que subimos un cambio se guarda una copia completa del sistema en:
```
C:\Users\RJ\Desktop\Sitios web  pruebas\dashboard-ip-_backups\prod_<FECHA-HORA>\
```
(fuera del repo para no inflar git). Si algo se rompe, restaurar desde el backup más reciente.

## Gráficos de barras (hbz) — responsive + eje que se reescala

`hbz()` dibuja las barras horizontales (top vendedores/marcas/clientes/productos). Reglas:
- Muestra una **ventana fija** de barras (desktop ~10-14, **móvil 8**) con un **slider vertical** a la derecha para recorrer el resto (`zoomLock:true` = tamaño fijo, solo se desplaza).
- `filterMode:'filter'` → al desplazarte, el **eje X se reescala a las barras visibles** (soluciona el problema de que un valor enorme aplaste a los pequeños).
- `isMob()` (ancho ≤640) ajusta ventana, márgenes, truncado de etiquetas y tamaños de fuente. Al cruzar el breakpoint se re-renderiza la pestaña.

## 10. Registro de cambios

- **2026-07-21 (a)** — (1) Chips de filtro colapsados a un solo chip con conteo. (2) Nuevo segmentador **Cliente**.
  (3) Nuevo **slider deslizable de rango de tiempo** (`#timebar`, se combina con el filtro Mes). (4) Casillas
  de los menús se sincronizan solo al abrir (rendimiento).
- **2026-07-21 (b)** — (1) **Tendencia/proyección con mes parcial** (ver §5b): escala el mes incompleto a cierre y corrige el desfase de la regresión. (2) **Gráficos de barras responsive** con ventana fija + slider vertical y eje X que se reescala a lo visible (móvil y escritorio). (3) Nuevos **gráficos de comparación mensual** en Clientes (`c-clicmp`) y Productos (`c-prodcmp`) — top 6 (Vendedores y Marcas ya los tenían).
- **2026-07-21 (c)** — Migración a **GitHub Pages**: (1) se eliminó la función serverless `log` y la pestaña 🔒 Registro (login sigue igual, ya no se registran accesos). (2) `package.json` sin dependencias Netlify. (3) Nuevo `publish.py` (git add/commit/push) y `.nojekyll`. (4) La tarea automática ahora publica por git en vez de Netlify.
