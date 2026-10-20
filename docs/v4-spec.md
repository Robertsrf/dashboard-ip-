# Spec · Sistema Grupo IP v4

> Fecha: 2026-10-19 · Autor del sistema: Ing. Roberts Flores · Redactada con `ingenieria-pro` (to-spec).
> Registro de diseño de la v4. Las reglas vivas que salen de aquí están en [`METODO.md`](../METODO.md).

## 1. Qué es

El sistema de inteligencia de ventas del Grupo IP: **una página estática cifrada por empresa** (IP, Tiendas
Caleb y, cuando haya datos, Reviplas) detrás de una puerta común. Se genera con Python a partir de los Excel y
Word que Roberts sube a Drive, se publica en GitHub Pages y se abre con un PIN de 6 dígitos.

La v4 rehace el sistema completo con cinco objetivos:

1. **Guía de lectura.** El usuario entra y sabe a dónde mirar: un titular del corte, qué lo explica y qué
   atender, en ese orden. Cada sección responde una pregunta y termina señalando la siguiente.
2. **Escala.** El paquete de datos pasa de filas JSON a **columnas binarias comprimidas**; el filtrado es una
   sola pasada sobre arreglos tipados. Debe aguantar 10× las filas actuales sin cambiar de diseño.
3. **Un solo sistema para todas las empresas.** Un núcleo común (diseño, motor de datos, filtros, gráficos,
   puerta, reunión, novedades) y un módulo por empresa. Sumar Reviplas = escribir su módulo y su build.
4. **Modo reunión** para proyectar ante los vendedores, con **PIN propio** y un **paquete aparte** sin
   totales ni proyección de la empresa en dólares y sin costos ni márgenes.
5. **Novedades (changelog)** con todas las versiones desde el 2026-07-07, visible en el sistema; cada cambio
   suma una entrada y el build **se niega a publicar** código nuevo sin ella.

## 2. Usuarios y escena

Los cuatro de siempre (Roberts, Ismael, Ing. Palomares, Yuniarlis), gerentes no técnicos, sobre todo en el
teléfono y con sol. Más una escena nueva: **sala de reunión con proyector**, Roberts o un supervisor delante
de los vendedores. Los PIN y roles no cambian; se añade el PIN de reunión (`secrets.json → reunion`).

## 3. Entradas y salidas

| Entrada | Empresa | Lo procesa |
|---|---|---|
| `data_ip.xlsx` (ventas), `exec.docx`, `risk_list.xlsx`, `cobranza.xlsx` | IP | `build_dashboard.py` + `cobranza.py`, `risklist.py`, `wordrep.py`, `reports.py` |
| `caleb_data.xlsx` | Caleb | `build_caleb.py` + `caleb_clean.py` |
| `secrets.json` (fuera de git) | todas | `secure.py` |
| `changelog.json` | todas | `grupo/changelog.py` |

| Salida | Qué es |
|---|---|
| `index.html` | IP (y la puerta) |
| `caleb.html` | Caleb |
| `history.json`, `history_caleb.json` | historial de cortes |

## 4. Reglas que NO cambian

Los invariantes I1–I7 de `CONTEXTO_CLAUDE.md`, las verificaciones que abortan el build en `cobranza.py` y
`caleb_clean.py`, el mes parcial (§7 del contexto), las dos tasas de cobro, la regla del café, el universo de
los informes (sin AMÉRICO ni REVIPLAS) y la certificación de Caleb. **La v4 cambia cómo se empaqueta y se
muestra el dato, nunca cómo se calcula.** Cada cifra de la v3 debe salir idéntica en la v4 (prueba de
paridad, §9).

## 5. Paquete de datos v2

```
payload = { meta (JSON) , columnas (binario) }
bytes   = u32 largo_meta | meta utf-8 | columnas contiguas (little-endian)
ENC     = AES-256-GCM( gzip(bytes) )        ← misma envoltura de clave por PIN (PBKDF2 200 000)
```

- Cada columna declara `{n: nombre, t: 'u8'|'u16'|'u32'|'i32', s: escala, o: offset, l: largo}`. Dinero en
  **centavos** (`i32`, escala 100) y cantidades en **milésimas** (`i32`, escala 1000): sumas exactas.
- El tipo entero se elige por el máximo de la columna (un `doc` con más de 65 535 facturas pasa solo a `u32`).
- El navegador descifra, descomprime con `DecompressionStream('gzip')` y crea **vistas** `TypedArray` sobre
  el mismo buffer (sin copiar).
- Todo lo que no es tabla (dims, informes, lista de riesgo, cobranza, enlaces) viaja en `meta`.

## 6. Motor (navegador)

- `Motor` puro, sin DOM: filtros por dimensión (`Uint8Array` de permitidos), rango de días, selección en una
  pasada → `Uint32Array` de índices; agregados por dimensión y por mes; distintos (facturas, clientes, SKU)
  con marcas por generación, sin `Set` por fila.
- Memoiza por estado de filtros. Sólo se recalcula y pinta **la sección visible**; las demás quedan marcadas
  como sucias y se pintan al abrirlas.
- Tablas grandes: buscador + orden + carga por tramos de 100 filas ("Mostrar más").

## 7. Interfaz

- **Inicio · Cómo vamos** en cada empresa: titular automático del corte → indicadores → qué lo explica
  (motores que más suben y más caen) → qué atender (alertas con botón a su sección) → tendencia.
- Cada sección: título con forma de pregunta, una línea de lectura automática, bandas en pirámide invertida
  (NORMAS) y, al pie, «Siguiente: …».
- Menú agrupado como ruta: **1 Cómo vamos · 2 Qué lo mueve · 3 Qué atender · 4 Herramientas**.
- Segmentadores: IP suma **Estado**, **Familia** (`REFERENCIA`) y **Producto**; Caleb mantiene los suyos.
  Barra de filtros fija; en móvil, hoja de filtros a pantalla completa. Clic en un gráfico = filtrar.
- Tres anchos (compacto ≤ 640, medio ≤ 1050, amplio) + **proyector** (modo reunión).

## 8. Modo reunión

- PIN propio en `secrets.json` (`"reunion": {"pin": "…"}`). Abre `ENC_R`, un paquete **distinto** con otra
  clave maestra.
- El paquete de reunión **no lleva**: costos ni márgenes (Caleb: sin `costo`, sin `vm/cst/p0/sc`), el Word
  ejecutivo (trae los totales de la empresa), `history` ni proyecciones. La interfaz no pinta en ningún
  sitio la venta total de la empresa, el acumulado del año, la proyección ni el crecimiento global en $.
- **Límite honesto:** si se muestran ventas por vendedor en dólares, su suma es el total. El paquete protege
  lo que se puede quitar (costos, márgenes, informes); el total se oculta en pantalla, no se borra de la
  aritmética.
- Con PIN normal hay un botón «Modo reunión» para ensayar la presentación con las mismas reglas.
- Presentación: pantalla completa, letra grande, ← → para pasar de diapositiva, enfoque en un vendedor.

## 9. Pruebas (criterios de aceptación)

1. `python -m unittest` verde: empaquetado (ida y vuelta exacta), relevos de vendedor, changelog (validación,
   sello, entrada de corte automática), paquete de reunión (no contiene claves prohibidas).
2. `node --test tests/` verde: motor (filtros, agregados, distintos, mes parcial, proyección) contra fixtures.
3. **Paridad v3 → v4** sobre el corte vigente: venta neta, facturas, clientes, SKU, unidades, % devolución,
   proyección del año, top 10 de vendedores/marcas/sectores y totales de cobranza idénticos al centavo.
4. Navegador (agent-browser): las dos empresas, los 4 PIN + el de reunión, todas las secciones con todos sus
   gráficos pintados, 0 errores de consola, en 390 / 1280 / 1920 px.
5. `index.html` de IP ≤ 2 MB (hoy 7,1 MB).

## 10. Fuera de alcance

Backend, base de datos, cuentas por vendedor (que cada vendedor vea sólo lo suyo exige paquetes por persona),
Reviplas con datos (sólo queda el hueco preparado), modo oscuro.
