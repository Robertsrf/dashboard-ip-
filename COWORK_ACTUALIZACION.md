# Tarea de actualización del Dashboard IP — instrucciones para Claude Cowork

> Pega este documento a Claude Cowork como la **nueva tarea programada**. Reemplaza a la tarea anterior.

## Contexto (cambió el hosting)
El Dashboard IP **ya NO se despliega en Netlify** (se agotaron los créditos). Ahora vive en **GitHub Pages**:

- Sitio: **https://robertsrf.github.io/dashboard-ip-/**
- Repo: **`https://github.com/Robertsrf/dashboard-ip-`** (rama `main`)
- **Publicar = hacer `git push`** del `index.html` regenerado. GitHub Pages publica solo en ~1 min.

## ✅ Acción ÚNICA la primera vez
1. **Eliminar / borrar la tarea programada ANTERIOR** (la que descargaba de Drive y **desplegaba en Netlify**). No debe seguir ejecutándose.
2. Asegurar credenciales de **push a GitHub** en el entorno de la tarea: un **token/PAT de GitHub** con permiso de escritura al repo `Robertsrf/dashboard-ip-` (antes se usaba el token de Netlify; ahora se necesita el de GitHub). Configúralo, por ejemplo, en la URL del remoto o con `git credential`.

## 🔁 Qué hace la tarea nueva (cada 3 días, igual que antes)

1. **Clonar o actualizar el repo** en la carpeta de trabajo:
   ```bash
   git clone https://github.com/Robertsrf/dashboard-ip-.git    # si no existe
   cd dashboard-ip-
   git pull                                                     # si ya existe
   ```
2. **Dependencias** (si faltan): `pip install pandas openpyxl cryptography python-docx`
3. **`secrets.json`** debe estar en la carpeta (usuarios y PINs). NO se sube (está en `.gitignore`). Si no está, colócalo.
4. **Descargar de Google Drive** (carpeta "Informes IP", parentId `1K1FPQkJBgwqjzSoVxEX6AbZFVzhQzscE`) los archivos del **corte más reciente** y anotar sus IDs de Drive:
   - Excel de datos `Data_IP_Actualizada_...xlsx` → guardar como **`data_ip.xlsx`**  (ID = `<D>`)
   - Lista de riesgo `Lista_Clientes_Riesgo_y_Recuperados_...xlsx` → guardar como **`risk_list.xlsx`**  (ID = `<L>`)
   - Informe Ejecutivo `.docx`  (ID = `<E>`)   ·   Seguimiento Clientes `.docx`  (ID = `<R>`)
   - (Los `.docx` son opcionales: si los descargas y pasas `EXEC_DOCX`/`RISK_DOCX`, se incrustan como descarga; si no, los informes se generan igual desde los datos.)
5. **Construir la cadena de versión** (mismo formato que usa el sitio):
   ```
   <D>|<modifiedTime ISO del Excel>|<size en bytes>~E:<E>~R:<R>~L:<L>
   ```
6. **Regenerar** el dashboard (desde la carpeta del repo):
   ```bash
   EXEC_ID=<E> RISK_ID=<R> LIST_ID=<L> \
   RISK_LIST_XLSX=./risk_list.xlsx \
   SECRETS_PATH=./secrets.json \
   python build_dashboard.py ./data_ip.xlsx "<VERSION>" ./index.html
   # opcional, si bajaste los Word: añade EXEC_DOCX=./exec.docx RISK_DOCX=./risk.docx
   ```
7. **Publicar en GitHub Pages**:
   ```bash
   python publish.py        # hace: git add index.html history.json + commit + push
   ```

## Notas importantes
- **NO subir** `secrets.json`, `data_ip.xlsx`, `risk_list.xlsx`, ni `.docx` (ya están ignorados en `.gitignore`).
- **Usar la MISMA versión** para el mismo corte evita duplicar la entrada en `history.json` (el generador solo agrega un corte si la versión cambia). Un corte nuevo tendrá otra versión (nuevo ID/fecha/tamaño de Excel) → se agrega correctamente.
- El código (`build_dashboard.py`) **ya incluye** todas las funciones actuales: datos por día, filtro por fecha con calendario, mapa de calor, comparar períodos, clientes inactivos, descargar gráfico como imagen y KPIs con explicación. **No hay que programar nada nuevo, solo regenerar y publicar.**
- Detalle técnico completo del sistema y de la regeneración manual: ver **`SYSTEM.md`** en el repo (sección 8 y 8b).
- Verificación rápida tras publicar: abrir el sitio, entrar con un PIN y confirmar que carga el corte nuevo (fecha "Corte al ..." actualizada).
