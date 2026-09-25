---
name: Tiendas Caleb · Inteligencia de Ventas
description: Panel ejecutivo de ventas de Tiendas Caleb, hermano del de IP, detrás de la puerta neutral del Grupo IP.
colors:
  caleb-blue: "#0F4F9C"
  caleb-blue-soft: "#E8EFF9"
  caleb-blue-line: "#C9D8EE"
  caleb-blue-pale: "#A9C0E3"
  ink-navy: "#0F1B33"
  slate-muted: "#5E6A7E"
  panel-white: "#FFFFFF"
  page-gray: "#F3F5F8"
  hairline: "#E2E6EC"
  row-rule: "#F0F2F6"
  neutral-chip: "#EDF0F4"
  neutral-chip-ink: "#475569"
  caleb-red: "#D7191F"
  caleb-red-ink: "#B3141C"
  caleb-red-soft: "#FDECEC"
  gain-green: "#15803D"
  gain-green-soft: "#E3F4E8"
  review-amber: "#9A5B00"
  review-amber-soft: "#FFF3DC"
  series-ochre: "#B7800F"
  series-cyan: "#0891B2"
  series-violet: "#7C3AED"
  series-rose: "#C2417A"
  series-slate: "#5B6B7F"
  chart-grid: "#EEF1F5"
  chart-axis: "#CBD2DC"
  door-ground: "#EEF0F4"
  door-ink: "#15181E"
  door-muted: "#5E6573"
  door-line: "#D9DCE2"
typography:
  headline:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "-0.2px"
  kpi-value:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.4px"
    fontFeature: "tnum"
  title:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "-0.1px"
  body:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
  control:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  label:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
  table-head:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.4px"
  door-headline:
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.01em"
rounded:
  field: "8px"
  control: "10px"
  card: "12px"
  door-tile: "14px"
  welcome: "18px"
  door-card: "20px"
  pill: "20px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  card-gap: "14px"
  lg: "16px"
  column-gap: "22px"
  page: "26px"
components:
  button-primary:
    backgroundColor: "{colors.caleb-blue}"
    textColor: "{colors.panel-white}"
    typography: "{typography.control}"
    rounded: "9px"
    padding: "8px 15px"
  button-clear:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.panel-white}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  filter-trigger:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  filter-chip:
    backgroundColor: "{colors.caleb-blue-soft}"
    textColor: "{colors.caleb-blue}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  date-pill:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.caleb-blue}"
    rounded: "14px"
    padding: "3px 10px"
  date-pill-on:
    backgroundColor: "{colors.caleb-blue}"
    textColor: "{colors.panel-white}"
    rounded: "14px"
    padding: "3px 10px"
  kpi-card:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.card}"
    padding: "14px 16px 12px"
  kpi-card-hero:
    backgroundColor: "{colors.caleb-blue}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.card}"
    padding: "14px 16px 12px"
  card:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.card}"
    padding: "14px 16px"
  nav-tab:
    textColor: "{colors.slate-muted}"
    typography: "{typography.control}"
    padding: "9px 12px"
  nav-tab-active:
    backgroundColor: "{colors.caleb-blue-soft}"
    textColor: "{colors.caleb-blue}"
    padding: "9px 12px"
  severity-urgente:
    backgroundColor: "{colors.caleb-red-soft}"
    textColor: "{colors.caleb-red-ink}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  severity-revisar:
    backgroundColor: "{colors.review-amber-soft}"
    textColor: "{colors.review-amber}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  severity-seguimiento:
    backgroundColor: "{colors.caleb-blue-soft}"
    textColor: "{colors.caleb-blue}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  tooltip:
    backgroundColor: "{colors.ink-navy}"
    textColor: "{colors.panel-white}"
    rounded: "9px"
    padding: "9px 11px"
  door-company-tile:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.door-ink}"
    rounded: "{rounded.door-tile}"
    padding: "16px 12px 14px"
  door-pin-input:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.door-ink}"
    rounded: "{rounded.card}"
    padding: "12px"
---

# Design System: Tiendas Caleb · Inteligencia de Ventas

Este documento describe el sistema tal como quedó construido en `template_caleb.html` (generado a
`caleb.html`) y en `puerta.html`, la puerta de empresa del Grupo IP. Las reglas de estructura, motion, copy
y móvil viven en `NORMAS_SISTEMA.md` y siguen mandando; aquí se remite a ellas en lugar de copiarlas. El
dashboard de IP (`template.html`, naranja `#ff4f20` y azul marino `#24205b`) es el hermano cuya gramática
comparte Caleb; no es el sujeto de este documento.

## Overview

**Creative North Star: "El Panel Ejecutivo del Grupo"**

Una sola gramática de panel para todas las empresas del Grupo IP: menú lateral agrupado, barra de filtros
pegajosa, barra de fechas con comparador, ocho indicadores en rejilla 4×2 y tarjetas blancas con una idea
cada una. Un gerente que pasa de IP a Caleb no reaprende nada; lo único que cambia es el color de la
empresa. La identidad de Caleb no está en un layout propio sino en su azul y su rojo aplicados con
disciplina de roles.

La densidad es de herramienta de trabajo: tarjetas de 1 px de borde sobre un gris de página frío, tinta
azul marino casi negra, números tabulares grandes y una sola familia tipográfica. La calma es deliberada:
el color se reserva para lo que significa algo (dato, acción, alerta, mejora), de modo que un rojo en
pantalla siempre es una alerta de verdad. Se lee sobre todo en el teléfono, con sol, así que el contraste
y los objetivos táctiles son parte del mundo y no un ajuste posterior.

La puerta del grupo es neutral a propósito: gris, sin colores de ninguna empresa salvo el acento del botón
Entrar y del foco, que toma el color de la empresa elegida.

**Key Characteristics:**
- Gramática compartida con IP; color por empresa, estructura común.
- Roles de color estrictos: azul para datos y acciones, rojo solo para alertas y negativos, verde solo para mejoras.
- Tarjetas blancas planas con filete de 1 px y sombra de reposo apenas perceptible.
- IBM Plex Sans en todo, con numerales tabulares en cada cifra.
- El período en curso se dibuja rayado: incompleto también sin color.
- Iconos dibujados en SVG de un trazo; nunca glifos de texto ni emoji.

## Colors

Una paleta fría y contenida: gris de página, tarjetas blancas, tinta azul marino y dos colores de marca
con roles que no se cruzan.

### Primary
- **Azul Caleb** (`--brand`, `caleb-blue`): datos, acciones, selección y foco. Es la serie principal de
  todos los gráficos, el fondo del KPI héroe (Venta neta), el botón primario, el atajo de fecha activo, el
  contador de filtros, el indicador de la pestaña activa y el anillo de foco. Pasa AA como texto sobre
  blanco, así que `--brand-ink` usa el mismo valor.
- **Azul Caleb suave** (`--brand-soft`, `caleb-blue-soft`): fondo de chips de filtro, pestaña activa,
  etiquetas azules y el hover de botones fantasma.
- **Filete azul** (`--brand-line`, `caleb-blue-line`): borde de chips, atajos de fecha y botones
  "Ver detalle"; también el color de `::selection`.
- **Azul pálido** (`C.blueSoft`, `caleb-blue-pale`): relleno de la barra del período en curso, siempre
  con el rayado encima.

### Secondary
- **Rojo Caleb** (`--red`, `caleb-red`): solo alertas y negativos en gráficos (barras de devoluciones,
  vendedores con margen muy por debajo de la tienda).
- **Rojo tinta** (`--red-ink`, `caleb-red-ink`) sobre **rojo suave** (`--red-soft`): texto de delta
  negativo, severidad Urgente, error del PIN en la puerta.

### Tertiary
- **Verde mejora** (`--pos`, `gain-green`) sobre **verde suave** (`--pos-soft`): solo el delta positivo y
  la etiqueta de mejora. Nunca una categoría.
- **Ámbar revisar** (`--amber`, `review-amber`) sobre **ámbar suave** (`--amber-soft`): severidad Revisar.
- **Series de categoría** (`GCOL`, `TCOL`, `PAL`): azul Caleb, ocre (`series-ochre`), cian
  (`series-cyan`), violeta (`series-violet`), rosa (`series-rose`) y pizarra (`series-slate`). Paleta
  validada con el validador de dataviz (`--pairs all`). Grupos: Construcción azul, Acero ocre, Jardín
  cian, Pinturas violeta.

### Neutral
- **Tinta azul marino** (`--ink` / `--navy`, `ink-navy`): texto, valores de KPI, títulos, botón
  "Limpiar todo", fondo del globo de ayuda.
- **Pizarra apagada** (`--muted`, `slate-muted`): etiquetas, hints, ejes, pestañas en reposo.
- **Gris de página** (`--panel2`, `page-gray`): fondo del cuerpo y hover de filas y opciones.
- **Blanco panel** (`--panel`): tarjetas, KPIs, menú, cabecera, barras.
- **Filete** (`--line`, `hairline`): todo borde de 1 px; **filete de fila** (`row-rule`) entre filas.
- **Gris de chip neutro** (`neutral-chip` con texto `neutral-chip-ink`): delta plano, contador sin
  filtros, etiqueta neutra.
- **Rejilla y eje de gráfico** (`chart-grid`, `chart-axis`).
- **Puerta**: suelo `door-ground`, tinta `door-ink`, apagado `door-muted`, filete `door-line`; el acento
  llega por `--door-accent` (azul Caleb en Caleb, el color de IP en IP).

### Named Rules
**La Regla de los Roles.** Azul es dato, acción, selección y foco. Rojo es alerta o negativo, nada más.
Verde es mejora, nada más. Ninguna categoría de datos usa verde ni rojo.

**La Regla del Color que Sigue a la Entidad.** Un grupo, tipo de cliente o vendedor conserva su color en
todos los gráficos, con o sin filtros; el color nunca sigue al puesto en el ranking.

**La Regla del Rayado.** El período incompleto (semana o mes en curso) se pinta en azul pálido con el
rayado `HATCH`; se entiende como incompleto también en gris o impreso.

**La Regla de la Puerta Neutral.** La puerta del grupo no lleva colores de ninguna empresa en su suelo ni
en sus tarjetas; solo el botón Entrar, el enlace de volver y el foco toman `--door-accent`.

## Typography

**Display Font:** IBM Plex Sans (con `system-ui, sans-serif`)
**Body Font:** IBM Plex Sans (con `system-ui, sans-serif`)

**Character:** Una sola familia sobria y técnica, con numerales tabulares de fábrica y diacríticos del
español limpios. La jerarquía sale del tamaño y del peso, no de cambiar de letra.

### Hierarchy
- **Headline** (700, 19 px, tracking −0,2 px): "Inteligencia de ventas" en la cabecera; 18 px en compacta.
- **Valor de KPI** (700, 26 px, interlínea 1,15, tabular): la cifra de cada indicador; 20 px en compacta.
- **Title** (700, 15 px): título de tarjeta (`h3`); 14 px en compacta.
- **Body** (400, 13,5 px, interlínea 1,45): texto de alertas y franja "Qué atender"; 13 px en tablas.
- **Control** (600, 13 px): botones, segmentadores, pestañas (13,5 px en el menú).
- **Label** (600, 12 px): etiqueta de KPI, chips, meta de cabecera; los hints van en 12 px 400 `--muted`.
- **Cabecera de tabla** (700, 11 px, mayúsculas, tracking 0,4 px) y **grupo del menú** (700, 11 px,
  mayúsculas, tracking 0,8 px): rótulos estructurales de tabla y navegación.
- **Puerta** (700, 21 px, −0,01em, `text-wrap: balance`): la pregunta de cada paso.

### Named Rules
**La Regla del Número Primero.** En un KPI o tarjeta la cifra es el elemento más grande, y toda cifra
lleva `font-variant-numeric: tabular-nums`.

**La Regla de la Familia Única.** IBM Plex Sans de 400 a 700 en todo, gráficos incluidos (`CHART_BASE`).
No se declara 800.

## Layout

Página de ancho máximo 1500 px con margen de 26 px (12 px en compacta). Arriba, apilados: cabecera blanca
(logo, título, fecha de datos, "Cambiar de empresa"), barra de filtros pegajosa con siete segmentadores y
"Limpiar todo", barra de fechas con atajos y "Comparar con", y la fila de chips activos. Debajo, menú
lateral pegajoso de 226 px a la izquierda (separado 22 px) y el contenido a la derecha.

El contenido abre con los ocho KPIs en rejilla 4×2 (12 px de separación) y sigue en bandas de tarjetas a
14 px: `g3` (2/3 + 1/3) para trayectoria + composición, `g2` (mitades) para pares, y bandas de una sola
tarjeta para tablas, alertas y calendario. Nunca más de dos gráficos por banda (NORMAS §1).

Tres clases de ventana (NORMAS §3): **expandida** (> 1050 px) rejilla completa; **media** (≤ 1050 px) las
bandas colapsan a una columna y los KPIs a 2×4; **compacta** (≤ 640 px) el menú pasa a cajón modal con
scrim, los filtros a una sola fila deslizable, las chispas de KPI se ocultan y los gráficos bajan de alto.
El orden del DOM es el orden en el teléfono.

El ritmo usa 4 · 8 · 12 · 14 · 16 · 22 · 26 px; la escala objetivo de NORMAS es de 4 px y los valores
fuera de ella se migran al tocar cada bloque.

## Elevation & Depth

Híbrido contenido: las superficies en reposo son planas, con filete de 1 px y una sombra neutra casi
invisible; las superficies que flotan pierden el borde y ganan sombra. Las sombras son siempre negras
translúcidas, nunca teñidas.

### Shadow Vocabulary
- **Reposo** (`--shadow`: `0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.035)`): tarjetas, KPIs, menú lateral, franja de alertas.
- **Desplegable** (`0 12px 32px rgba(0,0,0,.16)`): panel del segmentador.
- **Globo de ayuda** (`0 8px 20px rgba(0,0,0,.22)`): `.tipfloat`.
- **Bienvenida** (`0 24px 70px rgba(0,0,0,.24)`): tarjeta de saludo tras el PIN.
- **Puerta** (`0 18px 48px rgba(0,0,0,.12), 0 2px 6px rgba(0,0,0,.05)`): tarjeta de cada paso.

### Named Rules
**La Regla de Borde o Sombra.** En reposo, filete de 1 px + `--shadow`; flotando, sombra sin borde. Nunca
una sombra de color.

## Shapes

Esquinas suavemente redondeadas y escalonadas por tamaño: campos a 8 px, controles a 9–10 px, tarjetas y
KPIs a 12 px, tarjetas de empresa de la puerta a 14 px, bienvenida a 18 px y tarjeta de la puerta a 20 px.
Chips, etiquetas, severidades y deltas son píldoras (20 px). Las barras de los gráficos redondean solo el
extremo libre (3–4 px). La pestaña activa del menú redondea solo el lado derecho (0 9 9 0) porque su lado
izquierdo es el indicador.

**La Regla del Filete Fino.** Todo borde es de 1 px en `--line` o del tinte de su fondo. La única
excepción es el indicador de 3 px en azul Caleb de la pestaña activa, que es navegación, no decoración.

## Components

### Buttons
Sobrios y de un solo nivel de énfasis por zona.
- **Shape:** esquinas suaves (9 px el primario, 10 px el de limpiar).
- **Primary:** azul Caleb con texto blanco, 700, 8 × 15 px.
- **Limpiar todo:** azul marino sólido con texto blanco, alineado al final de la barra de filtros.
- **Fantasma "Ver detalle" / "Ver qué atender":** texto azul, filete `--brand-line`, fondo azul suave al pasar.
- **Enlace "Cambiar de empresa":** texto azul subrayado (offset 3 px).
- **Hover / Focus / Press:** hover solo con `hover:hover`; foco `2px solid --brand` con offset 2 px;
  pulsación `scale(.97)` en 120 ms con `--ease-out`, anulada con `prefers-reduced-motion`. En
  `pointer:coarse` todo botón mide al menos 44 px.

### Chips
- **Chip de filtro activo:** píldora azul suave, texto azul 600, filete azul; la dimensión en negrita
  marino y una × para quitarlo.
- **Atajos de fecha:** píldora blanca con filete azul; la activa es azul sólido con texto blanco.
- **Contador del segmentador:** píldora azul con número blanco; gris neutro cuando no hay selección.

### Cards / Containers
- **Corner Style:** 12 px (`--radius`).
- **Background:** blanco sobre el gris de página.
- **Shadow Strategy:** reposo (ver Elevation & Depth).
- **Border:** 1 px `--line`.
- **Internal Padding:** 14 × 16 px (12 px en compacta). Título `h3` + hint de una línea (≤ 20 palabras)
  + gráfico o tabla. Una idea por tarjeta, sin tarjetas dentro de tarjetas.

### Inputs / Fields
- **Style:** campos de fecha, selector "Comparar con" y buscadores con filete de 1 px, radio 8 px, fondo blanco.
- **Segmentador:** botón blanco con filete; al pasar, borde azul y halo suave de 3 px; abre un panel
  flotante de 290 px con buscador, "Todos / Ninguno" y casillas con `accent-color` azul. En compacta el
  panel se fija de lado a lado.
- **PIN (puerta):** campo centrado de 22 px 700 con tracking de 8 px, borde de 2 px `door-line` que pasa
  a `--door-accent` con el foco; el error va debajo en rojo tinta con `role="alert"`.

### Navigation
- **Menú lateral:** tarjeta blanca pegajosa bajo la barra de filtros, con botón "Ocultar menú" arriba y
  rótulos de grupo (General, Análisis, Comparar) en 11 px mayúsculas.
- **Pestañas:** 13,5 px 600 en `--muted`; hover gris de página; la activa en azul sobre azul suave con el
  indicador izquierdo de 3 px.
- **Compacta:** cajón de 270 px que entra desde la izquierda en 220 ms sobre un scrim azul marino al 42 %;
  el botón de hamburguesa (SVG de tres trazos) vive dentro de la barra de filtros.

### Indicador KPI (firma)
Etiqueta 12 px con botón (i) → valor 26 px → línea secundaria → píldora de delta con signo, flecha SVG y
cifra (verde mejora, rojo baja, gris plano) + la etiqueta de la comparación → chispa de 78 × 34 px en la
esquina inferior derecha. Ocho por vista, en 4×2. Solo "Venta neta" es héroe: azul sólido, texto blanco al
86 %, delta en píldora blanca translúcida. El selector "Comparar con" reescribe los ocho deltas.

### Franja y lista "Qué atender" (firma)
La franja `#alert-strip` en la primera pantalla del Resumen cuenta las alertas por severidad, muestra la
primera y lleva a la lista. Cada fila de la lista: chip de severidad con texto (**Urgente** rojo,
**Revisar** ámbar, **Seguimiento** azul), la frase con el dato y su contexto en 12 px, y el botón "Ver
detalle" que salta a la sección. El estado va siempre en palabra y en color, nunca solo en color.

### Globo de ayuda (firma)
Un único `.tipfloat` flotante y acotado a la pantalla (máx. `100vw − 24px`), fondo azul marino, texto
blanco 12 px, radio 9 px; aparece con opacidad + 2 px en 140 ms. Lo abre el icono (i) dibujado
(`ICO_INFO`) por hover real o por foco. Texto ≤ 40 palabras.

### Gráficos
ECharts con `CHART_BASE`: Plex, primera pintura 260 ms y actualización 180 ms `cubicOut`, sin animación
con movimiento reducido. Ejes y rejilla finos (`chart-grid`, `chart-axis`), sin marcas de eje, etiquetas
en `--muted`, barras con el extremo libre redondeado y ancho máximo acotado. `aria.decal` activado.
Cualquier barra o porción filtra al hacer clic.

### Puerta del Grupo IP
Dos pasos sobre suelo gris neutro: paso 1, tres tarjetas de empresa (logo + nombre, "Último acceso" en
píldora gris, Reviplas deshabilitada con "Próximamente"); paso 2, logo de la empresa, nombre, PIN y
botón Entrar a ancho completo en `--door-accent`. Una línea de paso ("Grupo IP · Paso 1 de 2") orienta
en el flujo.

## Do's and Don'ts

### Do:
- **Do** sacar todo color de los tokens de `:root` y de las constantes `C`, `GCOL`, `TCOL`, `PAL`.
- **Do** usar azul Caleb para datos, acciones, selección y foco; rojo solo para alertas y negativos; verde solo para mejoras.
- **Do** mantener el color de cada entidad (grupo, tipo de cliente, vendedor) igual en todos los gráficos.
- **Do** dibujar el período en curso en azul pálido con el rayado `HATCH`.
- **Do** acompañar cada delta de signo, flecha SVG y cifra, y cada severidad de su palabra.
- **Do** usar 1 px de borde + `--shadow` en reposo y sombra sin borde en lo que flota.
- **Do** llevar toda cifra en numerales tabulares y hacerla el elemento más grande de su bloque.
- **Do** dar 44 px de objetivo táctil en `pointer:coarse` y respetar `prefers-reduced-motion` (NORMAS §3–§4).
- **Do** usar iconos SVG de un solo trazo con `currentColor`.

### Don't:
- **Don't** usar verde ni rojo como color de una categoría de datos.
- **Don't** introducir un hex suelto en el CSS o en una opción de ECharts.
- **Don't** poner bordes de más de 1 px con color de marca; la única excepción es el indicador de 3 px de la pestaña activa.
- **Don't** teñir de azul las sombras de las superficies flotantes.
- **Don't** poner kickers ni eyebrows sobre un título; el `h2`/`h3` se sostiene solo (NORMAS §2).
- **Don't** usar glifos de texto ni emoji como iconos.
- **Don't** dar a una empresa un layout propio: la gramática del panel es la misma en todo el grupo.
- **Don't** poner colores de empresa en el suelo o las tarjetas de la puerta.
- **Don't** declarar peso 800 ni otra familia tipográfica.
