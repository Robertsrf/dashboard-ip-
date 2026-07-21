# Dashboard IP - Ventas

Dashboard interactivo autogenerado a partir del Excel en Google Drive
(carpeta "Informes IP"). Desplegado en **GitHub Pages** con auto-deploy desde este repo.

- `index.html`  -> dashboard desplegado (contiene marcador `DATA_VERSION`).
- `build_dashboard.py` -> generador: `python3 build_dashboard.py <xlsx> <version> index.html`
- `publish.py` -> publica en GitHub (git add/commit/push) -> GitHub Pages despliega solo.
- Actualizacion automatica cada 3 dias vía tarea programada de Cowork
  (genera `index.html` y luego llama a `python publish.py`).

URL: https://robertsrf.github.io/dashboard-ip-/
