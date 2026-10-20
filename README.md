# Sistema Grupo IP · Inteligencia de ventas

Dashboards de **Distribuidora y Suministros IP** (`index.html`) y **Tiendas Caleb** (`caleb.html`), detrás de
una puerta común y con los datos cifrados por PIN. Publicado en GitHub Pages:
https://robertsrf.github.io/dashboard-ip-/

| Dónde | Qué |
|---|---|
| `CLAUDE.md` | Entrada rápida para quien trabaje en el repo |
| `METODO.md` | Proceso: corte, cambios, Novedades, modo reunión, seguridad |
| `DESIGN.md` | Sistema de diseño del grupo |
| `CONTEXTO_CLAUDE.md`, `CONTEXTO_CALEB.md` | Datos y reglas de cálculo de cada empresa |
| `app/` | Interfaz (núcleo común + un módulo por empresa) |
| `grupo/` | Paquete de datos, armado de páginas, reglas, reunión, Novedades |
| `build_dashboard.py`, `build_caleb.py` | Builds |
| `tests/`, `tools/` | Pruebas y verificación |

```
python -m unittest discover -s tests && node --test tests/*.test.mjs     # o: npm test
python tools/verificar.py index.html data_ip.xlsx
```

`pipeline/` es una herramienta paralela para armar el informe del corte (no entra en el dashboard):
`python pipeline/analysis.py <excel>` y `node pipeline/build_report.js`.

Autor: Ing. Roberts Flores.
