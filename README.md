# Dashboard IP - Ventas

Dashboard interactivo autogenerado a partir del Excel en Google Drive
(carpeta "Informes IP"). Desplegado en Netlify con auto-deploy desde este repo.

- `index.html`  -> dashboard desplegado (contiene marcador `DATA_VERSION`).
- `build_dashboard.py` -> generador: `python3 build_dashboard.py <xlsx> <version> index.html`
- Actualizacion automatica cada 3 dias vía tarea programada de Cowork.
