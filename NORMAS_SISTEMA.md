# NORMAS DEL SISTEMA — Dashboard IP

> Conjunto único de reglas de **estructura, visualización, móvil, motion, copy y código** para el dashboard
> de Distribuidora y Suministros IP. Generado el **2026-09-13** a partir de una pasada completa con nueve
> skills (`impeccable`, `find-animation-opportunities`, `animate`, `mobile-app-ui-design`,
> `mobile-android-design`, `clean-code`, `copy-editing`, `last30days`, `find-skills`) sobre el código real
> y sobre lo que la comunidad de diseño de dashboards defiende hoy.
>
> **Precedencia.** Estas normas sustituyen a las reglas de diseño y de código anteriores (§6, §11 de
> `CONTEXTO_CLAUDE.md`). **No** sustituyen los siete invariantes metodológicos (I1–I7) ni el procedimiento
> de corte (§10.2): esos hablan de los datos, no del diseño, y siguen vigentes.

---

## 0. Las cinco reglas que resumen todo

1. **Pirámide invertida en cada sección**: trayectoria y composición arriba, rankings en medio, detalle fino
   (días, tablas) al final. El orden del DOM es el orden en móvil.
2. **Topes de carga cognitiva**: 6–8 KPIs, 2–4 gráficos por banda, nunca más de 12 métricas visibles sin
   scroll, un vocabulario de 4 tipos de gráfico.
3. **Menos movimiento, no más**: 260 / 180 / 120 ms, un solo curve, `prefers-reduced-motion` siempre.
4. **Un hint es una idea (≤ 20 palabras); un tooltip, ≤ 40**. La metodología va al informe, no flotando
   sobre un gráfico.
5. **Nada falla en silencio**: ni un `except: pass`, ni un gráfico vacío sin mensaje, ni un botón sin estado.

---

## 1. Estructura y orden de los gráficos

**Investigación (`last30days`, sept-2026):** el consenso vigente es la *pirámide invertida* — tarjetas KPI
arriba a todo lo ancho, gráficos de tendencia y drivers en el medio, tablas y drill-down abajo — con topes
numéricos repetidos casi literalmente entre fuentes: 4–6 KPI que respondan las preguntas principales, 2–4
gráficos de apoyo, y pasado de 12 métricas visibles "se le está pidiendo al ejecutivo que analice en vez de
absorber". La métrica más crítica va arriba a la izquierda: la gente **mira** los dashboards, no los lee.

### 1.1 Plantilla canónica de sección

Toda sección de análisis sigue este orden. Romperlo exige una razón escrita en un comentario HTML.

| Banda | Qué va | Ejemplo |
|---|---|---|
| 1 · Trayectoria / composición | El gráfico que responde "cómo vamos" y el que responde "de qué está hecho" | Venta mensual + proyección · Participación por grupo |
| 2 · Ritmo | Variación y acumulado | Crecimiento intermensual · Ventas acumuladas |
| 3 · Ranking | Quién concentra (barras horizontales) | Top 10 vendedores · Top 10 marcas |
| 4 · Alerta accionable | Lo que el gerente **hace** con la sección, si existe | Clientes inactivos (posible fuga) |
| 5 · Comparación mensual | Trayectoria de los 6 líderes | Comparación mensual de marcas |
| 6 · Detalle | Tabla con buscador; calendario por día | Tabla de marcas · Calendario de ventas |

**Regla de la primera pantalla:** lo que se ve sin hacer scroll en un portátil (≈ 900 px de alto) tiene que
bastar para tomar la decisión de esa sección. Un gráfico de detalle (celdas por día, tabla) **nunca** ocupa
la primera pantalla.

### 1.2 Orden aplicado el 2026-09-13

| Sección | Antes | Ahora | Por qué |
|---|---|---|---|
| Resumen ejecutivo | Calendario por día **primero**, a todo lo ancho | Tendencia + grupo → ritmo → rankings → **calendario al final** | El calendario es detalle de nivel día; abría la sección más importante con la vista más fina |
| Marcas y grupos | Tabla al lado de "Grupos por mes" (dos tiers mezclados) | Ranking + grupos → comparación mensual → tabla | Igual que las otras cinco secciones de análisis: el patrón repetido se reconoce |
| Clientes | Inactivos **después** de la comparación mensual | Ranking + Pareto → **inactivos** → comparación → tabla | La lista de a quién llamar es lo accionable; va antes que la curva |
| Cobranza | Cobertura (no responde a filtros) en la 2.ª banda, entre gráficos filtrables; comisiones en la 4.ª | Identidad → tasas + cobrado → pendiente + grupo → precio → tabla → **comisiones + cobertura juntas al final** | Las dos tarjetas que ignoran los filtros iban salteadas; agrupadas, el aviso "no responde a los filtros" se lee una vez |
| KPIs globales | Proyección de año en la posición 8 | **Posición 2**, tras la venta neta | Es el número hacia delante que piden los gerentes; resultado → hacia dónde va → calidad → volumen → salud |

Secciones que ya cumplían y no se tocaron: Tendencia, Vendedores, Sectores, Productos, Comparar.

### 1.3 Topes de carga cognitiva

- **KPIs globales: 8** (`neto, proy, tk, cli, fac, uni, sku, dev`). Añadir uno obliga a quitar otro.
- **Gráficos por banda: 1 o 2** (`.grid` o `.grid.g2`); `.g3` (2fr/1fr) sólo para trayectoria + composición.
- **Métricas visibles por sección sin scroll: ≤ 12** (KPIs + series etiquetadas).
- **Vocabulario de gráficos: 4 tipos** — barras (vertical para el tiempo, horizontal para rankings), línea
  (trayectoria, proyección, %), pastel de anillo (composición, ≤ 6 porciones) y mapa/heatmap (sólo Sectores
  y Calendario). Un tipo nuevo exige justificar qué no puede hacer uno de los cuatro.
- **La misma cifra no se pinta dos veces en la misma sección.** Deuda reconocida: en Sectores, "Ventas por
  estado" (pastel) y el mapa muestran exactamente los mismos números; conviene fundir el pastel en el mapa.

---

## 2. Jerarquía visual y layout

- **Tokens, no valores sueltos.** Todo color sale de `:root` (`--brand`, `--brand-ink`, `--navy`, `--muted`,
  `--pos`, `--neg`, `--amber`, `--accent2`). Un hex nuevo en el CSS o en una opción de ECharts es una infracción.
- **Dos naranjas con roles distintos.** `--brand: #ff4f20` es el naranja vivo para **trazos, bordes y series de
  gráfico**; `--brand-ink: #c93608` es el naranja para **texto y para fondos que llevan texto** (botones,
  chips, pestaña activa). El vivo da 3,3:1 con blanco y 3,0:1 sobre `#fff2ee`: no pasa WCAG AA para texto
  de 13 px. El oscuro da 5,2:1 y 4,8:1. `--muted` se oscureció de `#6b7392` a `#5f6788` por la misma razón
  (4,3:1 → 5,1:1 sobre el fondo de página).
- **Contraste**: texto ≥ 4,5:1, texto grande (≥ 18 px, o 14 px en negrita) ≥ 3:1. Se comprueba con el
  detector de Impeccable, no a ojo.
- **Texto funcional ≥ 11 px; cuerpo ≥ 12 px.** Etiquetas de grupo del menú y meta de cabecera subieron a
  11 y 12 px.
- **Esquema de encabezados sin saltos**: `h1` (cabecera) → `h2` por sección (visualmente oculto con
  `.sr-only`; los lectores de pantalla navegan por él) → `h3` por tarjeta.
- **Escala de espaciado de 4 px**: 4 · 8 · 12 · 16 · 20 · 24 · 32. Los `9px`, `11px`, `14px`, `18px` que hay
  hoy se migran al tocar cada bloque (no en una pasada masiva).
- **Escala tipográfica objetivo: 6 tamaños y 3 pesos.** Hoy hay 20 tamaños entre 10 y 38 px. Roles:
  `label 11/12` (700, mayúsculas, tracking .4) · `body 13` (500) · `title 14/15.5` (800) · `value 27` (800,
  tracking −.5) · `display 38` (sólo la puerta de acceso). Migrar por bloque, igual que el espaciado.
- **Valor > etiqueta.** En KPIs y tarjetas, el número siempre es el elemento más grande del bloque.
- **Grupos por proximidad antes que por cajas.** Una tarjeta contiene una sola idea; nada de tarjetas dentro
  de tarjetas.
- **Superficies del navegador pertenecen al diseño**: foco de teclado en `--brand`, selección en `#ffd9cd`,
  numerales tabulares en tablas (`font-variant-numeric: tabular-nums`).
- **Kicker / eyebrow sobre un título: prohibido.** El `h2` se sostiene solo. (Se quitó "RESUMEN · INFORME
  CARGADO" y "CORTE N · CONFIDENCIAL".)
- **Iconos: o un sistema dibujado en un trazo, o ninguno.** Emoji como icono, fuera. (Se quitaron del menú
  lateral y de los títulos de tarjeta. Los nombres de hoja del Excel de riesgo que traen emoji son dato del
  usuario y se respetan.)
- **Deuda reconocida, decisión pendiente**: el borde izquierdo de 4 px en `--brand` sobre KPIs, botones del
  menú activos y títulos del informe es identidad del incumbente pero un "default de categoría" según el
  suelo de calidad; los *sparklines* en las tarjetas KPI, lo mismo. Se mantienen hasta decidir un
  reemplazo, no se extienden a bloques nuevos.

---

## 3. Móvil y adaptación

Tres clases de ventana (Material 3), nombradas en vez de breakpoints sueltos:

| Clase | Ancho | Qué cambia |
|---|---|---|
| **Compacta** | ≤ 640 px | Menú como cajón modal con scrim; KPIs a 2 columnas; todo lo demás a 1 columna; gráficos 300 / 360 / 250 px |
| **Media** | 641–1050 px | Menú fijo; `.g2` y `.g3` colapsan a 1 columna (con el menú de 234 px no caben dos gráficos legibles) |
| **Expandida** | > 1050 px | Rejilla completa |

Reglas:

- **Objetivos táctiles: 44 px mínimo** (M3 pide 48) en pantallas sin puntero fino: `@media (pointer:coarse)`
  fija `min-height:44px` en botones y chips y amplía el área de la (i) y de la × de los chips sin cambiar su
  tamaño visible.
- **El orden del DOM es el orden en móvil.** Por eso §1 manda: en el teléfono no hay "al lado", sólo "debajo".
- **Tablas**: siempre dentro de `.tblwrap` con scroll horizontal propio; el cuerpo de la página nunca
  desplaza en horizontal. Cabecera pegajosa.
- **Gráficos en compacta**: etiquetas de eje a 9–10 px con `hideOverlap`, ventana de 8 barras con
  `dataZoom` deslizable, leyendas abajo y con scroll (`type:'scroll'`), tooltips `confine:true`. La
  responsividad de ECharts **no es automática**: cada gráfico nuevo se prueba en 375 px de ancho.
- **Cajón lateral**: se cierra al elegir sección y con el scrim; el botón de abrir siempre visible salvo con
  el cajón abierto. Lo primario en la pantalla es leer, no navegar: no se añade barra inferior.
- **Escena de uso real**: gerentes mirando el teléfono en la calle, con sol. Contraste de texto ≥ 4.5:1 y
  nada de información sólo por color (el ▲/▼ va siempre con signo y cifra).

---

## 4. Motion

**Diagnóstico (`find-animation-opportunities`):** el dashboard tenía *más* movimiento del que necesita, no
menos. ECharts trae 1 000 ms por defecto y los re-aplica en cada `setOption` — en cada cambio de filtro las
barras "bailaban" un segundo mientras el usuario intentaba leerlas. Los botones no confirmaban el clic.

Presupuesto (aplicado el 2026-09-13):

| Momento | Propósito | Valor |
|---|---|---|
| Gráfico: primera pintura | Evitar el salto brusco | `animationDuration: 260`, `cubicOut` |
| Gráfico: actualización por filtro | Evitar el salto brusco | `animationDurationUpdate: 180`, `cubicOut` |
| Pulsación de botón / chip / pestaña | Feedback | `transform: scale(.97)`, 120 ms, `--ease-out` |
| Entrada de sección (`.panel.active`) | Evitar el salto brusco | `@starting-style` opacidad 0 → 1 + 4 px, 140 ms; **sin** animación de salida |
| Tooltip (i) | Evitar el salto brusco | opacidad + 2 px, 140 ms; sólo `hover:hover` o foco |
| Cajón lateral | Consistencia espacial | 220 ms (ya existía) |
| Bienvenida tras el PIN | Delight (único momento "rare") | 350 ms pop + 600 ms fade (ya existía) |

Reglas:

- **Un curve:** `--ease-out: cubic-bezier(.23,1,.32,1)`. Tres duraciones: `--t-press 120`, `--t-enter 140`,
  `--t-tip 140`. Nada de UI pasa de 300 ms.
- **Sólo `transform` y `opacity`** (y `translate`). Nunca `width/height/top/left/margin`.
- **`prefers-reduced-motion: reduce`** = menos y más suave, no cero: se quita el desplazamiento y la
  escala, se conserva la opacidad; ECharts pasa a `animation:false`.
- **Lo que se lee no se mueve por estilo**: ni tween de cifras en KPIs, ni stagger de tarjetas al abrir
  sección, ni dibujo progresivo de líneas.
- **Presupuesto único**: la animación de ECharts vive en `App.chart()` (envuelve `setOption`); un gráfico
  que necesite otra cosa la declara en su propia opción, no se toca el envoltorio.

---

## 5. Copy de interfaz

Audiencia: cuatro gerentes de una distribuidora venezolana, no técnicos, leyendo en el teléfono.

- **Registro: tú imperativo**, siempre ("Desliza para ver más", "Clic para filtrar"). Nunca "usted".
- **Hint (`.hint`) = una idea, ≤ 20 palabras.** Si hace falta explicar metodología, va al tooltip (i) o al
  informe, no encadenada con "·". (Se recortaron los tres hints de cobranza de 39–58 palabras.)
- **Tooltip (i) ≤ 40 palabras.** Qué mide y cómo leer el delta. Deuda: `c-cob-pct` (82 palabras) y
  `c-cob-comis` (67) siguen largos; recortar al próximo corte.
- **Títulos de tarjeta: nombre del dato, sin paréntesis de parámetros.** "Comparación mensual de marcas",
  no "…(top 6)"; el 6 va en el hint.
- **Sin abreviaturas en etiquetas visibles**: "efectividad", no "efectiv."; "proyección", no "proy." (deuda:
  `proy.` sigue en ejes; migrar).
- **Jerga de negocio se define una vez y se usa igual**: *camada* (mes de despacho), *diferencial* (cobrar a
  otro precio o forma de pago; no es deuda), *efectividad* (cobrado ÷ cobrado + diferencial).
- **UTF-8 literal en el HTML.** Nada de `&eacute;`, `&middot;`, `&#9749;`: el archivo es UTF-8 y el resto ya
  iba en literal.
- **Los controles nombran su acción**: "Descargar informe (Word)", no "Descargar". Los errores nombran el
  problema y la salida: "PIN incorrecto. Vuelve a intentarlo".
- **Números en español**: separador de miles con punto o espacio fino, decimales con coma, `$` delante.

---

## 6. Código

### 6.1 Python (`build_dashboard.py`, `cobranza.py`, `risklist.py`, `wordrep.py`, `reports.py`)

- **Nunca `except: pass`.** Un insumo opcional puede faltar sin romper el build, pero avisa por `stderr`
  (`_warn`). Así fue como `python-docx` faltó semanas sin que nadie lo viera.
- **Funciones ≤ 40 líneas, una responsabilidad.** Deuda medida: `build_dashboard.main` 116 ·
  `reports.render_exec_full` 160 · `reports.metrics` 88 (devuelve un dict de ~40 claves) ·
  `cobranza._cafe` 146 · `cobranza.build` 121. Se parten al tocarlas, no en una pasada masiva.
- **Nombres que se buscan**: en bucles de dinero, `facturado, cobrado, pendiente, diferencial`, no
  `f, c, p, dd`.
- **Líneas ≤ 110 caracteres** en código nuevo (`reports.py` tiene 69 líneas por encima de 120).
- **Encabezados de Excel por nombre normalizado, nunca por posición**, con alternativas explícitas para los
  que cambien de nombre (el formato del Excel de conciliación cambió entero entre el corte 7 y el 8).
- **Verificaciones que abortan el build son deseables**: identidad camada a camada, MAESTRO contra
  RESUMEN, diferencial deducido contra RESUMEN. Un Excel que se contradice no se publica.
- **Comentarios en español sin acentos en el `.py`** (convención del repo), explicando el *porqué*, nunca
  el *qué*.

### 6.2 JavaScript (`template.html`)

- **La UI se edita sólo en `template.html`**; `index.html` es un artefacto y nunca se toca a mano.
- **Métodos ≤ 60 líneas.** Deuda: `tCob` 146, `cafe` 94. Se extraen constructores de opciones por gráfico
  (`optDescomp()`, `optPct()`…) al tocarlos.
- **Cada gráfico se construye en un solo sitio** y obtiene su instancia por `this.chart(id)`; nunca
  `echarts.init` suelto.
- **Textos que dependen del corte van en una función** (`cobAdapt()`), no en el HTML: si el Excel cambia de
  moneda o de universo, cambia el texto sin tocar la plantilla.
- **Líneas ≤ 140 caracteres** en código nuevo (hay 69 líneas por encima de 160).
- **Sin globales nuevas**: hoy hay 13 funciones y 20 variables de nivel superior; lo nuevo entra como
  método de `App` o como `const` dentro del bloque que lo usa.
- **Todo lo interactivo tiene los estados**: default, hover (`hover:hover`), focus-visible, active, y
  disabled cuando aplique. Un botón sin `:active` es un botón a medias.

### 6.3 Validación mínima antes de subir

```
python -m py_compile build_dashboard.py cobranza.py risklist.py wordrep.py reports.py
node --check <ultimo <script> de template.html>
# tras el build:
descifrar index.html con un PIN real → 4 logins, filas, dateMax, dayCount, riskList, driveLinks, Pcob
JS de template.html == JS de index.html (enmascarando ENC y VE_GEO)
impeccable detect --json template.html   (una vez, al final del lote)
```

---

## 7. Proceso: cuándo usar cada skill

| Situación | Skill | Qué produce |
|---|---|---|
| Cambio de layout, nueva sección, jerarquía dudosa | `impeccable layout` / `critique` | Tesis espacial + detector mecánico |
| "Esto se siente lento / brusco" | `find-animation-opportunities` → `animate` | Lista corta con valores exactos; luego el código |
| Algo se ve mal en el teléfono | `impeccable adapt` + §3 de este documento | Clases de ventana, targets, tablas |
| Texto de un hint, tooltip o título | `copy-editing` (Sweep 1 claridad + Sweep 5 especificidad) | ≤ 20 / ≤ 40 palabras |
| Función que creció | `clean-code` | Partición por responsabilidad, nombres, sin silencios |
| "¿Qué hace la gente ahora?" | `last30days <tema>` | Evidencia fechada, no opinión |
| "¿Hay una skill para X?" | `find-skills` | Sólo se instala con 1K+ instalaciones **y** repo de 100+ estrellas (los dos candidatos de ECharts fallaron el segundo filtro: 3 y 27 estrellas) |

**Modo de trabajo:** construir el lote completo, inspeccionar una vez (escritorio y móvil juntos), corregir
todo lo que salga en un solo lote, confirmar con una segunda ronda como máximo, y parar. Nada de bucles de
pulido abiertos.

---

## 8. Deuda reconocida (no aplicada hoy, por orden de valor)

1. **Pastel "Ventas por estado" duplica el mapa** en Sectores → fundir (quitar el pastel o convertirlo en la
   leyenda del mapa).
2. **Tooltips de cobranza de 60–80 palabras** → recortar a 40 con la metodología en el informe.
3. **Escala tipográfica y de espaciado** (20 tamaños → 6; espaciados fuera de rejilla) → migrar por bloque.
4. **`build_dashboard.main`** → partir en `cargar_datos / armar_payload / armar_informes / adjuntos /
   renderizar`.
5. **Borde izquierdo de 4 px y sparklines en KPIs** → decidir si son identidad o default heredado.
6. **`execFull` / `riskFull`** viajan cifrados en cada `index.html` y nadie los renderiza (`printFull` y
   `downloadDoc` nunca se llaman) → o botón, o fuera del payload.
7. **Iconos**: si algún día hacen falta, un set SVG de un trazo (Lucide), no emoji ni glifos.
8. **Lo que el detector de Impeccable sigue marcando y se acepta a sabiendas** (6 hallazgos): borde
   lateral de 4 px en `--brand` (identidad), tipografía Inter (cambiarla es un rediseño), borde de 1 px +
   sombra en tarjetas y en la bienvenida, sombra del tooltip. Se revisan si se decide un rediseño; no se
   parchean uno a uno.
