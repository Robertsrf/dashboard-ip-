# DESIGN · Sistema de diseño del Grupo IP (v4)

> Una sola dirección visual para todas las empresas. Lo escribió `disenio-web-pro` (con `ui-ux-pro-max` y
> `frontend-design`) el 2026-10-20 y manda sobre cualquier sugerencia de otra skill. El código vive en
> `app/core.css`; aquí está el porqué. Cambiar una regla = cambiar este archivo **y** sumar una entrada en
> Novedades (ver `METODO.md`).

## 1. Dirección: «editorial de datos»

El dashboard se lee como la primera página de un periódico económico de la empresa: **un titular que dice
cómo vamos**, los números que lo sostienen, qué lo explica y qué hay que atender. Lienzo claro y neutro, un
color de marca usado solo para lo importante, y una sola pieza audaz por página.

- **Lo único audaz: el titular del corte.** Frase en IBM Plex Serif con las cifras dentro, no la típica
  «cifra gigante + etiqueta + degradado». Todo lo demás es callado y disciplinado.
- **La ruta de lectura es una secuencia real** (1 Cómo vamos → 2 Qué lo mueve → 3 Qué atender →
  4 Herramientas): por eso, y solo por eso, el menú va numerado.
- Prueba de los 5 segundos: con abrir Inicio, un gerente sabe si el mes va mejor o peor y por qué.

## 2. Tokens

| Token | IP | Caleb | Uso |
|---|---|---|---|
| `--lienzo` | `#F2F4F8` | `#F2F4F8` | fondo de página |
| `--papel` | `#FFFFFF` | `#FFFFFF` | paneles |
| `--tinta` | `#24205b` | `#0F1B33` | texto principal (marca) |
| `--tinta-2` | `#4A5270` | `#4A5270` | texto secundario (6,9:1 sobre el lienzo) |
| `--tinta-3` | `#6B7390` | `#6B7390` | metadatos (≥ 4,5:1 sobre blanco) |
| `--marca` | `#ff4f20` | `#0F4F9C` | trazos de énfasis, foco, indicador del menú |
| `--marca-tinta` | `#c93608` | `#0F4F9C` | texto y fondos con texto en color de marca |
| `--serie` | `#24205b` | `#0F4F9C` | serie principal de los gráficos |
| `--pos` / `--neg` | `#15803D` / `#B42318` | ídem | **solo** con ▲/▼ y cifra, nunca color solo |

Reviplas, cuando llegue, solo define su fila de tokens (`body[data-empresa="reviplas"]`).

## 3. Tipografía

- **IBM Plex Sans** (400/500/600/700) para todo dato e interfaz: numerales tabulares, diacríticos del
  español impecables.
- **IBM Plex Serif** (500/600/700) **solo** para el titular del corte y la pregunta de cada sección.
- Escala: 12 (metadatos) · 13 (interfaz) · 14 (cuerpo) · 15 (título de tarjeta) · 16–26 (pregunta de
  sección) · 22–30 (titular). En reunión todo crece ×1,125 desde `html.reunion`.
- Etiquetas en minúscula inicial. Nada en mayúsculas sostenidas, nada de «eyebrows» sobre los títulos.

## 4. Composición

- **Sección** = pregunta (Serif) + una línea de lectura automática + bandas en pirámide invertida
  (trayectoria y composición → rankings → alerta accionable → comparación → tabla) + «Siguiente».
- **Bandas**: 1 o 2 tarjetas; `21` (2/1) solo para trayectoria + composición. Ninguna tarjeta dentro de otra.
- **Indicadores**: **una sola banda** con rejilla de 1 px, no tarjetas sueltas. Columnas según cuántos
  haya (8 → 4+4, 6 → 3+3) para no dejar huecos. Valor > etiqueta; flecha con signo y cifra; mini-tendencia
  abajo a la derecha.
- **Borde o sombra, no ambos**: lo que reposa lleva borde de 1 px; lo que flota (menús, globo de ayuda,
  saludo) lleva sombra neutra y sin borde.
- **Anchos**: amplio > 1100 px · medio 681–1100 (bandas a una columna) · compacto ≤ 680 (menú en cajón,
  filtros en hoja a pantalla completa, KPIs a 2 columnas) · **proyector** (modo reunión).

## 5. Gráficos (kit `GIP.kit` en `core.js`)

- Vocabulario: barras horizontales para rankings (ventana fija + deslizador, eje reescalado a lo visible,
  nombres con ancho fijo y «…»), barras verticales para el tiempo, línea para trayectorias y tasas, anillo
  para composición con ≤ 6 porciones (leyenda en columna), mapa y calendario.
- El mes o la camada a medias va **claro o rayado** y rotulado; nunca se compara sin escalar a cierre.
- Trayectorias de varios: color **y** estilo de línea distintos (sólida, discontinua, punteada).
- Toda tarjeta de gráfico tiene título, pista (≤ 20 palabras), ayuda (i) (≤ 40 palabras) y descarga HD.

## 6. Movimiento

Una entrada de sección (160 ms, opacidad + 4 px), pulsación de botones (120 ms, escala .97), globo de
ayuda (140 ms) y gráficos (260 ms la primera vez, 180 ms al filtrar). Nada más. Con
`prefers-reduced-motion` no hay desplazamientos ni animación de gráficos.

## 7. Copy

Tú imperativo, frases cortas, números en español (`$7.016.508`, `15,6 %`). Los botones dicen lo que hacen
(«Descargar el Excel de conciliación»). Los errores dicen qué pasó y cómo salir («PIN incorrecto. Vuelve a
intentarlo»). La jerga del negocio se define donde aparece (camada, diferencial, efectividad).

## 8. La presentación de la reunión

Misma marca y tipografía, escala de proyector (títulos Serif de 3,4 rem, cifras de 5 rem). Aquí el
movimiento sí es parte del mensaje, pero siempre con propósito: cada pieza entra cuando el expositor la
nombra (pasos), las barras crecen en orden, las cifras cuentan hasta su valor y la ficha de cada vendedor
se transforma en la del siguiente. Transición de lámina 550 ms; con `prefers-reduced-motion`, nada se mueve.
Naranja solo para lo que el expositor señala (los tres primeros, el mejor mes); verde y rojo, con ▲/▼.

## 9. No se hace

Fondos crema, oscuro con un solo acento chillón, tarjetas idénticas con la misma sombra, degradados de
adorno, emoji como icono, mayúsculas sostenidas, flechas «→» pegadas a los botones, número gigante como
héroe, color como única señal, animaciones de entrada por tarjeta.
