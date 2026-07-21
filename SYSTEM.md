# SYSTEM.md — Dashboard IP (Distribuidora y Suministros IP)

> Documento de referencia rápida para entender y modificar este sistema sin tener que releer todo el código.
> **Mantener actualizado después de CADA cambio.** Última actualización: 2026-07-21.

---

## 1. Qué es

Dashboard de **Inteligencia de Ventas** para *Distribuidora y Suministros IP*. Es una sola página
(`index.html`) autocontenida, protegida por PIN, con gráficos ECharts, KPIs, tablas e informes.
Se genera con Python a partir de un Excel de ventas y se despliega en **Netlify**.

- **En producción:** GitHub (`Robertsrf/dashboard-ip-`, rama `main`) → Netlify redespliega solo con cada push.
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

## 6. Pestañas (tabs)

`resumen` (KPIs + tendencia/proyección + top vend/marca), `tend` (proyección lineal), `vend`, `marca`,
`cli`, `prod`, `exec` (informe ejecutivo), `risk` (riesgo/recuperados), `rlist` (lista Drive, oculta si no hay),
`log` (registro de ingresos, solo admin).

## 7. Seguridad / acceso

- Puerta de PIN de 6 dígitos (`#gate`). El PIN deriva una clave (PBKDF2) que desencripta `ENC` en el navegador (AES-GCM).
- Usuarios y roles viven en `secrets.json` (fuera del repo). Rol `admin` ve la pestaña de Registro.
- El registro de ingresos usa la función Netlify `log`.
- Nota: todo el JS ya es público en `index.html`; la seguridad depende del PIN/cifrado, no de ocultar el código.

## 8. Despliegue

1. `git add` + `commit` + `push` a `main`.
2. Netlify detecta el push y redespliega (~1 min). `publish = "."`.
3. Verificar en la URL de producción con el PIN.

## 9. Respaldos

Cada vez que subimos un cambio se guarda una copia completa del sistema en:
```
C:\Users\RJ\Desktop\Sitios web  pruebas\dashboard-ip-_backups\prod_<FECHA-HORA>\
```
(fuera del repo para no inflar git). Si algo se rompe, restaurar desde el backup más reciente.

## 10. Registro de cambios

- **2026-07-21** — (1) Chips de filtro colapsados a un solo chip con conteo. (2) Nuevo segmentador **Cliente**.
  (3) Nuevo **slider deslizable de rango de tiempo** (`#timebar`, se combina con el filtro Mes). (4) Casillas
  de los menús se sincronizan solo al abrir (rendimiento). Cambios aplicados en `index.html` y `build_dashboard.py`.
