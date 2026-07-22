# Dashboard IP — Tarea automática (versión GitHub Pages)

> **Para Claude Cowork.** Este documento **reemplaza** la tarea anterior `actualizar-dashboard-ip`.
> **Lo único que cambia respecto a la tarea vieja es el destino de publicación: antes Netlify, ahora GitHub Pages.**
> El resto del proceso (huella de versión, detección de cambios, verificación de datos, reglas de seguridad y publicación por `git push`) **se mantiene idéntico**. De hecho, la publicación siempre fue un `git push` a `main`; ahora quien redespliega en ese push es **GitHub Pages** en vez de Netlify.

---

## 0. Acción ÚNICA de transición (hacer una sola vez)

1. **Eliminar la tarea programada anterior** (la documentada como "publica y Netlify redespliega"). Esta tarea la sustituye.
2. Asegurar en el entorno **credenciales de push a GitHub** con permiso de escritura al repo `Robertsrf/dashboard-ip-` (token/PAT). Antes bastaba el acceso al repo para que Netlify tomara el push; sigue siendo el mismo `git push`, solo confirma que las credenciales de GitHub estén vigentes.
3. (Opcional, recomendado) Desconectar el auto-deploy de **Netlify** del repo para que no queden builds fallidos: Netlify está **pausado por créditos** y ya no es el hosting. No es obligatorio; un push igual publica en Pages.

---

## 1. Objetivo

Mantener publicado, de forma automática, un **dashboard de ventas cifrado** de Distribuidora y Suministros IP.

En cada corrida la tarea:

1. Revisa la carpeta de Google Drive **"Informes IP"**.
2. Detecta si cambiaron los archivos fuente (Excel de ventas, Words de informe, Excel de lista de riesgo).
3. Si cambiaron: **verifica** los datos, **reconstruye** el dashboard cifrado y lo **publica**.
4. Si no cambiaron: termina sin hacer nada ("Sin cambios").

La publicación es indirecta: se hace **push a GitHub** y **GitHub Pages redespliega solo** el sitio (~1 min).
Sitio: **https://robertsrf.github.io/dashboard-ip-/**

---

## 2. Piezas involucradas

| Pieza | Rol |
|-------|-----|
| Carpeta Drive "Informes IP" (parentId `1K1FPQkJBgwqjzSoVxEX6AbZFVzhQzscE`) | Fuente de los archivos (Excel de datos, Words, Lista de riesgo) |
| Repositorio GitHub `Robertsrf/dashboard-ip-` (rama `main`) | Código del generador + `index.html` publicado |
| **GitHub Pages** | Hosting; redespliega automáticamente en cada push a `main` (Settings → Pages → Deploy from branch `main` / `/root`, ya configurado; hay un `.nojekyll`) |
| `build_dashboard.py` | Script principal que arma el dashboard (**ya incluye** datos por día, filtro por fecha/calendario, mapa de calor, comparar períodos, clientes inactivos, descargar gráfico e info en KPIs) |
| `reports.py`, `wordrep.py`, `risklist.py`, `secure.py` | Módulos de apoyo (informes, lectura de Word, lista de riesgo, cifrado) |
| `publish.py` | Atajo de publicación: `git add index.html history.json` + commit + push |
| `history.json` | Histórico de cortes (para comparar entre versiones) |
| `secrets.json` | PINs y roles de acceso (**nunca se sube al repo**) |

> Dependencias del entorno: `pandas`, `openpyxl`, `cryptography` (y `python-docx` si se leen Words). Instalar si faltan.

---

## 3. Archivos fuente en Drive

En cada corrida se identifican por **fecha de creación más reciente**:

| Tipo | Patrón de nombre | Obligatorio |
|------|------------------|-------------|
| Excel de datos | empieza por `Data_IP_Actualizada` (.xlsx) | **Sí** |
| Word Ejecutivo | `.docx` con "Ejecutivo" | No (opcional) |
| Word Seguimiento | `.docx` con "Seguimiento" / "Clientes" / "Riesgo" / "Recuperados" | No (opcional) |
| Excel Lista de riesgo | `.xlsx` con "Lista" y ("Riesgo" o "Clientes") | No (opcional) |

Con estos se construye una **huella de versión** (`VERSION`) que combina el ID, la fecha de modificación y el tamaño del Excel de datos, más los IDs de los otros tres archivos:

```
<dataFileId>|<modifiedTime ISO>|<size en bytes>~E:<execId>~R:<riskId>~L:<listId>
```

Esa huella es la que permite saber si algo cambió.

---

## 4. Flujo paso a paso

### Paso 1 — Listar y calcular la versión
Se lista la carpeta de Drive y, por fecha de creación más reciente, se toma el Excel de datos y (si existen) el Word Ejecutivo, el Word Seguimiento y el Excel Lista. Con eso se arma la huella `VERSION`.

### Paso 2 — Comparar con lo publicado
Se clona/actualiza el repo y se lee la versión embebida en la primera línea de `index.html`:

```
<!-- DATA_VERSION: <VERSION> -->
```

- **Si la versión publicada es igual a la nueva** → termina: *"Sin cambios"*.
- **Si es distinta** → continúa con la reconstrucción.

### Paso 3 — Descargar y decodificar
Se descargan los archivos desde Drive y se decodifican al disco de trabajo, guardándolos con los nombres que espera el build:
- Excel de datos → **`data_ip.xlsx`**
- Lista de riesgo → **`risk_list.xlsx`**
- Words (si aplican) → `exec.docx`, `risk.docx`

### Paso 4 — Verificación de datos (antes de publicar)
Con la data se calculan cuatro cifras de control:

- **Nº de filas**
- **Neto total** (suma de `SUMANETO`)
- **Nº de clientes únicos** (`NOMBRECLI`)
- **Rango de fechas** (`FECHADOC` mínimo–máximo)

Y se comparan contra el corte anterior guardado en `history.json`.

**Reglas de decisión:**

| Condición | Acción |
|-----------|--------|
| Filas = 0, o Neto ≤ 0, o faltan columnas clave (`SUMANETO`, `FECHADOC`, `NOMBRECLI`) | **No publica.** Informa "Datos inválidos, no se desplegó" |
| El neto cae **más de 25%** o bajan las filas vs. el corte anterior | **Sí publica**, pero con una **ADVERTENCIA visible** (puede ser correcto, pero hay que revisarlo) |
| Todo en orden | Publica normal |

### Paso 5 — Construir el dashboard
Se escribe `secrets.json` (o se usa el que ya esté en la carpeta) y se ejecuta `build_dashboard.py`, pasándole el Excel de datos, la `VERSION` y **solo** las variables cuyos archivos/IDs existan:

```bash
EXEC_ID=<E> RISK_ID=<R> LIST_ID=<L> \
RISK_LIST_XLSX=./risk_list.xlsx \
SECRETS_PATH=./secrets.json \
python build_dashboard.py ./data_ip.xlsx "<VERSION>" ./index.html
# opcional, si se bajaron los Word: añadir  EXEC_DOCX=./exec.docx RISK_DOCX=./risk.docx
```

El script:
- Genera los informes ejecutivo y de seguimiento.
- Incrusta (si están disponibles) los Word y la Lista de riesgo, además de enlaces de descarga directa desde Drive.
- **Cifra** todo el contenido y lo inserta en `index.html`.
- Actualiza `history.json` con el nuevo corte (solo si la `VERSION` cambió; no duplica).

> El dashboard incluye **toda** la data (incluidos AMERICO/REVIPLAST). Los informes automáticos, en cambio, **excluyen** esos clientes.

### Paso 6 — Publicar (a GitHub Pages)
Se **borran los archivos sensibles** del disco de trabajo (`data_ip.xlsx`, `secrets.json`, `exec.docx`, `risk.docx`, `risk_list.xlsx`) y se verifica con `git status` que **solo** queden para subir `index.html` e `history.json`. Luego:

```bash
python publish.py     # git add index.html history.json + commit + push a main
# (equivale a: git add index.html history.json && git commit -m "Auto-update <fecha>" && git push origin main)
```

**GitHub Pages redespliega solo** en ~1 min. *(El `.gitignore` ya protege `secrets.json`, `*.xlsx` y `*.docx`, pero la verificación con `git status` sigue siendo obligatoria.)*

### Paso 7 — Reporte final
Se entrega un resumen con: las cuatro cifras verificadas, la comparación con el corte anterior, qué archivos se usaron, la URL publicada y cualquier advertencia.

---

## 5. Reglas de seguridad (invariantes)

- **Nunca** se suben al repo: `secrets.json`, `data_ip.xlsx`, `risk_list.xlsx`, `exec.docx`, `risk.docx`.
- Antes de cada push se valida con `git status` que solo se suban `index.html` e `history.json`.
- **No se exponen** el token de GitHub ni los PINs/códigos de acceso en ningún reporte ni conversación.
- El `secrets.json` se usa solo en el disco de trabajo y no se sube (está en `.gitignore` y además se elimina antes del push).
- Si algo falla, se informa y **no se hace push parcial**.

---

## 6. Manejo de errores y casos límite

- **Sin cambios** en Drive → termina de inmediato, sin tocar el repo.
- **Datos inválidos** (0 filas, neto ≤ 0, columnas faltantes) → no publica; reporta el detalle.
- **Caída fuerte** de neto/filas → publica con advertencia para revisión manual.
- **Word no disponibles a disco** → el dashboard igual se genera: los informes se producen desde la propia data y los Word quedan accesibles por enlace de descarga de Drive (el build no falla por esto).
- **Fallo en cualquier paso crítico** → se detiene sin publicar a medias.

---

## 7. Ejemplo real (corrida del 2026-07-21)

- **Cambio detectado:** el 5.º corte (Julio 2026) reemplazó al 4.º corte publicado.
- **Cifras verificadas (data completa):** 58,762 filas · neto 5,654,878.15 · 1,491 clientes únicos · fechas 2026-01-09 → 2026-07-15.
- **Validación:** filas > 0, neto > 0, sin columnas faltantes → válido. Sin advertencia (el neto subió respecto al corte anterior).
- **Snapshot del informe (excluye AMERICO/REVIPLAST):** total 2,799,090.11 · clientes 1,309 · en riesgo 484 · recuperados 17 · ticket 193.95 · top10 34.7% · mejor mes 2026-05.
- **Publicación:** push a `main` → **GitHub Pages** publica en ~1 min. `git status` confirmó solo `index.html` e `history.json`.

---

## 8. Diferencias respecto a la tarea anterior (resumen)

| Antes | Ahora |
|-------|-------|
| Hosting: **Netlify** (redeploy en push) | Hosting: **GitHub Pages** (redeploy en el mismo push) |
| Doc decía "Netlify redespliega solo" | "GitHub Pages redespliega solo" |
| Función serverless `log` (registro de ingresos) | **Eliminada** (Pages es estático; el login sigue igual) |
| — | Publicación puede usar `publish.py` (mismo `git push`) |

Todo lo demás — detección por `DATA_VERSION`, verificación de las 4 cifras, reglas de decisión, seguridad, manejo de errores — **es idéntico**.

*Documento de referencia del proceso. No contiene tokens ni credenciales.*
