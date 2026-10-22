# MÉTODO · Sistema Grupo IP v4

> Instrucciones de trabajo del sistema. **Se leen antes de tocar cualquier cosa.** Las reglas de datos de
> cada empresa están en `CONTEXTO_CLAUDE.md` (IP) y `CONTEXTO_CALEB.md` (Caleb); las visuales, en
> `DESIGN.md`; el diseño de la v4, en `docs/v4-spec.md` y `docs/v4-plan.md`. Si algo aquí contradice a
> esos documentos en datos, mandan ellos; en proceso, manda este.

## 1. Qué es

Un dashboard de ventas por empresa (IP en `index.html`, Tiendas Caleb en `caleb.html`, Reviplas preparado),
detrás de una puerta común, publicado en GitHub Pages. Cada página lleva sus datos **cifrados** y se abre con
un PIN. Hay un PIN aparte de **reunión** que abre otro paquete, sin totales ni márgenes.

```
Drive (Excel/Word) ──> build_dashboard.py / build_caleb.py
                          │  grupo/reglas.py      relevos y alias de vendedor
                          │  cobranza.py, risklist.py, wordrep.py, reports.py, caleb_clean.py
                          │  grupo/paquete.py     columnas binarias + gzip (paquete v2)
                          │  grupo/reunion.py     paquete de reunión por lista blanca
                          │  secure.py            AES-256-GCM, una clave maestra por paquete, PBKDF2 por PIN
                          │  grupo/changelog.py   Novedades: verifica y agrega el corte
                          └─ grupo/pagina.py      app/shell.html + core.css + motor.js + core.js + <empresa>.js
                                                   + puerta + paquetes + CSP con hashes ──> index.html / caleb.html
Navegador: PIN → WebCrypto → DecompressionStream → GIP.Motor (TypedArrays) → secciones → ECharts
```

| Pieza | Hace | No hace |
|---|---|---|
| `app/motor.js` | Abre el paquete, filtra en una pasada, agrega, cruza, mes parcial y proyección | DOM |
| `app/core.js` | Puerta, filtros, menú-ruta, tarjetas, kit de gráficos y tablas, KPIs, ayuda, descarga HD, reunión, Novedades | Cifras de negocio |
| `app/ip.js`, `app/caleb.js` | Declaran segmentadores, KPIs, titular, alertas y secciones con sus tarjetas | Maquetar a mano |
| `index.html`, `caleb.html` | Artefactos. **Nunca se editan a mano.** | |

## 2. Corte nuevo (lo de siempre)

«Ya subí los archivos a Drive, haz lo de siempre» = esta corrida completa, hasta el push.

1. **Respaldo** del repo en `../dashboard-ip-_backups/prod_<AAAAMMDD-HHMM>/`.
2. **Drive**, carpeta «Informes IP» (su ID está en la memoria local de Claude, no en el repo): el Excel de ventas
   `Data_IP_Actualizada_*`, el Word `Informe_Ejecutivo_*`, el Excel `Lista_Clientes_Riesgo_*` y la
   conciliación `Conciliacion_Facturado_vs_Cobrado_*`. Si falta alguno, se dice y se publica lo que haya
   (el Excel de ventas es el único obligatorio para mover las ventas). Los archivos están también en
   `C:\Users\RJ\Downloads`.
3. **Validar** cada archivo: firma `504b0304`, `xl/` o `word/` dentro. Copiarlos a la carpeta de
   trabajo (fuera del repo) y luego al repo como `data_ip.xlsx`, `exec.docx`, `risk_list.xlsx`,
   `cobranza.xlsx` (todos ignorados por git).
4. **Fecha real** (invariante I1): `FECHADOC.max()`, nunca el nombre del archivo.
5. **Conciliación**: correr `python cobranza.py cobranza.xlsx` y comparar con el corte anterior. El
   formato cambia casi cada corte; `cobranza.py` lee por nombre de encabezado y revienta si la identidad no
   cuadra. Hoja nueva o quitada → adaptarla ahí, nunca en el front.
6. **Vendedores**: si el negocio avisa de un relevo de código, se agrega a `VEND_RELEVO` en
   `grupo/reglas.py` (con su prueba en `tests/test_reglas.py`). Hoy: #10 Leonardo→Héctor, #20 Edixon→Jorge.
7. **Build** (número de corte con `CORTE=<n>` si no es el anterior + 1):
   ```
   CORTE=<n> EXEC_ID=<id> LIST_ID=<id> COB_ID=<id> EXEC_DOCX=./exec.docx RISK_LIST_XLSX=./risk_list.xlsx \
   COB_XLSX=./cobranza.xlsx python build_dashboard.py ./data_ip.xlsx "<huella>" ./index.html
   ```
   Huella: `<dataId>|<modifiedTime>|<bytes>~E:<execId>~L:<listId>~C:<cobId>|<modifiedTime>|<bytes>`. Va
   completa dentro del paquete cifrado; en claro (`DATA_VERSION`) solo su hash. El build agrega el corte en
   Novedades, sin cifras.
8. **Verificar**: `python tools/verificar.py index.html data_ip.xlsx` (5 PIN, paquete de reunión limpio,
   sintaxis, totales Excel = numpy = motor JS) y, con el servidor local levantado,
   `python tools/navegador.py http://127.0.0.1:8765/index.html` (todas las secciones pintadas, 0 errores).
9. **Cotejar** con el corte anterior de `history.json`: caída de venta > 25 % o menos filas ⇒ avisar.
10. **Publicar**: `python publish.py "Corte N (dd-mm)"` (sube `index.html`, `reunion.html`, `caleb.html` y `changelog.json`).
    `history.json` y `history_caleb.json` **no se suben**: traen cifras en claro; viven en local y en los respaldos.

Caleb: mismo esquema con `python build_caleb.py <reporte.xlsx> "<huella>" caleb.html`; solo se toca si hay
reporte nuevo en su subcarpeta de Drive. Su certificación (`caleb_clean.py`) aborta si algo no cuadra.

## 3. Cambio de código

1. Ubícalo: **dato** (reglas de cálculo → `grupo/`, `cobranza.py`, `reports.py`, `caleb_clean.py`),
   **interfaz** (`app/`), **proceso** (este documento).
2. **Prueba primero** cuando es lógica: `tests/` (`python -m unittest discover -s tests` y
   `node --test tests/*.test.mjs`). La paridad con la v3 del mes parcial y la proyección está en
   `tests/motor.test.mjs`: si cambia, es un cambio de cálculo y se dice en Novedades.
3. Interfaz: se declara en el módulo de la empresa (`secciones`, `bandas`, `tarjetas`), el núcleo arma el
   DOM. Toda tarjeta: título, pista, ayuda, `sensible: true` si muestra totales, costos o márgenes. Todo texto
   que viene de los datos pasa por `esc()`.
4. **Novedades** (obligatorio, el build lo exige):
   ```
   python -m grupo.changelog nueva <nuevo|mejora|arreglo|seguridad|version> "Título" "detalle 1" "detalle 2" --empresas ip,caleb
   python -m grupo.changelog sellar      # si sigues retocando el mismo cambio
   ```
   La huella del código (`app/`, `grupo/`, builds y parsers) debe coincidir con la de la última entrada o
   el build no publica. Los cortes los agrega el build. Versión: `version` sube el mayor, `nuevo`/`mejora`/
   `seguridad` el menor, `arreglo` el parche.
5. Reconstruir **las dos** empresas si se tocó `app/core.*`, `app/motor.js` o `grupo/`.
6. Verificar (paso 8 del corte) en 1440 y 390 px y con el PIN de reunión.

## 4. Modo reunión

- PIN propio en `secrets.json → reunion.pin` (no se imprime nunca). Abre el paquete de `grupo/reunion.py`:
  **lista blanca**; una clave nueva no entra hasta decidir que es segura. Fuera: costos y márgenes (Caleb),
  Word ejecutivo, historial, enlaces de Drive, cobertura de cobranza.
- En pantalla no se pintan la venta total, la proyección del año, la tendencia de la empresa ni lo marcado
  `sensible`. Con PIN normal, el botón «Modo reunión» ensaya lo mismo.
- Límite honesto: si se muestran ventas por vendedor en dólares, su suma es el total. El paquete quita lo
  que se puede quitar; el total se oculta en pantalla.
- Presentación: agenda en el menú, ← → o el presentador (PageUp/PageDown), «Enfocar en» un vendedor
  (filtra también la lista de riesgo y la cobranza), pantalla completa.

### 4.1 La presentación «Reunión de vendedores 2026» (`reunion.html`)

- Cuarta opción de la puerta. La genera `build_dashboard.py` junto a `index.html` (`presentacion()`), con el
  **paquete de reunión** de IP cifrado para los 4 PIN y el de reunión: aunque entre el administrador, ahí
  no viaja nada sensible. Armazón propio (`app/shell_reunion.html`, `app/reunion.css`, `app/reunion.js`).
- Láminas por pasos (→, Av Pág, clic en «Siguiente»): apertura, confianza, estadísticas (año, ritmo,
  equipo, mes contra mes, trimestre contra trimestre, vendedor por vendedor, zonas, clientes, grupos,
  cobranza), Cobranzas y Flota con su botón, compromisos y cierre.
- Nunca pinta un total de la empresa en dólares: participaciones, variaciones, conteos y la venta de cada
  vendedor. Las comparaciones usan **meses cerrados** (si el corte cae a mitad de mes, ese mes no entra).
- Los enlaces van dentro del paquete cifrado: `REUNION_COBRANZAS_URL` y `REUNION_FLOTA_URL` al construir
  (por defecto, los de `build_dashboard.py`).
- Verificación: `tools/verificar.py reunion.html data_ip.xlsx` y `tools/navegador.py <url>/reunion.html
  --rol reunion` (recorre las láminas y cada paso).

## 5. Seguridad

- Nunca en git: `secrets.json`, `*.xlsx`, `*.docx`. Antes de cada push, `git status`.
- CSP en `<meta>` con hash de cada script en línea (`grupo/pagina.py`); ECharts se sirve desde el propio
  sitio; anti-enmarcado en `core.js` (GitHub Pages no deja poner cabeceras).
- ECharts 5.5.1 está en el rango de CVE-2026-45249, que solo afecta a la serie `lines` sin `formatter`
  propio: el sistema no la usa. Si algún día se usa, subir a ECharts ≥ 6.1.0.
- **El repo y la página son públicos.** Nada con cifras de negocio va en claro al repo: ni `history*.json`
  (ignorados desde la v4), ni Novedades (sin cifras), ni IDs de Drive (los documentos usan `<id>`).
  Deuda conocida: `CONTEXTO_*.md` todavía traen cifras de cortes y el historial de git conserva lo que se
  publicó antes; la salida limpia es separar el código (repo privado) de lo publicado (repo público solo con
  las páginas cifradas, `assets/` y `vendor/`).
- **Drive** (2026-10-20): la carpeta «Informes IP» y sus archivos estaban como «cualquiera con el enlace
  puede editar», con IDs visibles en la página publicada. Ver la decisión tomada con Roberts en Novedades.
- **Riesgo residual del PIN:** la página es pública y un PIN de 6 dígitos se puede probar por fuerza
  bruta fuera de línea en minutos. Mitigación preparada: el sistema ya acepta claves de 6 a 64 caracteres;
  pasar a claves largas es cambiar `secrets.json` (y `inputmode` en `app/puerta.html`), sin tocar código.

## 6. Sumar una empresa (Reviplas)

1. `build_reviplas.py` sobre el modelo de `build_caleb.py`: certificar el Excel, `paquete(meta, cols)`,
   `REUNION.REGLAS["reviplas"]` (lista blanca propia), `PAG.construir(cfg, ...)`.
2. `app/reviplas.js` sobre el modelo de `app/caleb.js` y su fila de tokens en `core.css` y `DESIGN.md`.
3. En `app/puerta.html`, habilitar su botón (`data-co="reviplas" data-href="reviplas.html"`).
4. `CONTEXTO_REVIPLAS.md` con sus columnas, trampas e invariantes; entrada `nuevo` en Novedades.

## 7. Cómo se trabaja con Roberts

- Español, mensajes cortos; preguntar solo lo que es decisión suya y en una sola tanda.
- Cambios grandes: las tres skills de su marketplace en orden: **ingenieria-pro → disenio-web-pro →
  seguridad-web**, y todo lo decidido queda escrito aquí, en `DESIGN.md` o en `docs/`.
