# Dashboard IP - Ventas

Dashboard interactivo autogenerado a partir del Excel en Google Drive
(carpeta "Informes IP"). Desplegado en **GitHub Pages** con auto-deploy desde este repo.

- `index.html`  -> dashboard desplegado (contiene marcador `DATA_VERSION`).
- `template.html` -> HTML/CSS/JS del dashboard. **Unica** fuente de la UI: editar aqui, nunca el `index.html`.
- `build_dashboard.py` -> generador: `python3 build_dashboard.py <xlsx> <version> index.html`
- `vendor/echarts.min.js` -> respaldo local de ECharts 5.5.1 (solo se usa si el CDN no responde).
- `publish.py` -> publica en GitHub (git add/commit/push) -> GitHub Pages despliega solo.

## Corte nuevo

**No hay actualizacion automatica.** El flujo es: subes los archivos a la carpeta de Drive
"Informes IP" y pides la corrida en el chat. El procedimiento completo (9 pasos, con la
validacion de que los archivos de Drive son Office de verdad y no una pagina HTML) esta en
`CONTEXTO_CLAUDE.md`, seccion **10.2**; el comando del build, en la **10.3**.

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
