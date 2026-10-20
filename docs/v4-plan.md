# Plan · Sistema Grupo IP v4

> Ejecuta la [spec](v4-spec.md). Orden de skills pedido por Roberts: **ingenieria-pro → disenio-web-pro →
> seguridad-web**. Cada tarea termina con su prueba en verde; nada se da por hecho sin salida real.

## Fase A · Ingeniería (`ingenieria-pro`)

| # | Tarea | Prueba |
|---|---|---|
| A1 | `grupo/reglas.py`: relevos y alias de vendedor, usados por `build_dashboard.py` y `pipeline/clean.py` | `tests/test_reglas.py` |
| A2 | `grupo/paquete.py`: payload v2 columnar + gzip; `app/motor.js` lo abre | `tests/test_paquete.py` + `tests/motor.test.mjs` (ida y vuelta Python → JS) |
| A3 | `app/motor.js`: filtros, selección, agregados, distintos, mes parcial, proyección | `tests/motor.test.mjs` |
| A4 | `grupo/changelog.py` + `changelog.json` con la historia desde el 2026-07-07 | `tests/test_changelog.py` |
| A5 | `grupo/reunion.py`: paquete de reunión sin datos sensibles | `tests/test_reunion.py` |
| A6 | Builds v4 de IP y Caleb sobre `app/` + `tools/verificar.py` | build real + verificación de los 5 PIN |
| A7 | Paridad v3 → v4 de todas las cifras de control | `tools/paridad.py` + `tests/paridad.test.mjs` |

## Fase B · Diseño (`disenio-web-pro`)

| # | Tarea | Prueba |
|---|---|---|
| B1 | Dirección visual y tokens del grupo (`app/core.css`), escrita en `METODO.md` | revisión de contraste |
| B2 | Armazón común: cabecera, menú-ruta, filtros, KPIs, tarjetas, kit de gráficos y tablas | navegador 390/1280 |
| B3 | Módulo IP: Inicio guiado + todas las secciones portadas | paridad visual + 0 errores |
| B4 | Módulo Caleb: Inicio guiado + secciones | ídem |
| B5 | Modo reunión (presentación) | PIN de reunión: nada sensible en pantalla ni en el paquete |
| B6 | Novedades (changelog) | entradas visibles y filtrables |
| B7 | Motion y adaptación (móvil, portátil, escritorio, proyector) | capturas en 4 anchos |

## Fase C · Seguridad (`seguridad-web`)

| # | Tarea | Prueba |
|---|---|---|
| C1 | Secretos fuera de git, escape de todo texto que viene del Excel, CSP con hashes, SRI del CDN | `git ls-files`, revisión del HTML generado |
| C2 | Informe de riesgo residual (PIN de 6 dígitos frente a fuerza bruta fuera de línea) | nota en `METODO.md` |

## Fase D · Cierre

| # | Tarea |
|---|---|
| D1 | `METODO.md` + `CLAUDE.md`; `CONTEXTO_*.md` al día; fuera documentos y código muertos |
| D2 | Entrada 4.0.0 en Novedades, build final (re-mirar Drive por el `Data_IP` del 15-10), verificación, push |
