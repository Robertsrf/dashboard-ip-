# Dashboard IP - Ventas

Dashboard interactivo autogenerado a partir del Excel en Google Drive
(carpeta "Informes IP"). Desplegado en **GitHub Pages** con auto-deploy desde este repo.

- `index.html`  -> dashboard desplegado (contiene marcador `DATA_VERSION`).
- `template.html` -> HTML/CSS/JS del dashboard. **Unica** fuente de la UI: editar aqui, nunca el `index.html`.
- `build_dashboard.py` -> generador: `python3 build_dashboard.py <xlsx> <version> index.html`
- `vendor/echarts.min.js` -> respaldo local de ECharts 5.5.1 (solo se usa si el CDN no responde).
- `publish.py` -> publica en GitHub (git add/commit/push) -> GitHub Pages despliega solo.
- Actualizacion automatica cada 3 dias vía tarea programada de Cowork
  (genera `index.html` y luego llama a `python publish.py`).

## Informes del corte (carpeta `pipeline/`)

Herramienta paralela: no la lee `build_dashboard.py` ni entra en el `index.html`.

```
python pipeline/analysis.py <excel>     # -> pipeline/analysis.json con TODO el analisis
node   pipeline/build_report.js         # -> pipeline/Informe_Ejecutivo_IP.doc
```

`pipeline/clean.py` centraliza la limpieza (vendedores espurios, sufijo `" (N)"` en marcas,
espacios sobrantes) y los totales de control. Los invariantes metodologicos que nunca cambian
estan en `CONTEXTO_CLAUDE.md`, seccion **Invariantes**.

URL: https://robertsrf.github.io/dashboard-ip-/
