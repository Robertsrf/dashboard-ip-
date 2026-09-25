---
version: 1
slug: "template-caleb-html"
primary_target: "template_caleb.html"
related_targets: ["puerta.html"]
---

# Tiendas Caleb · dashboard de ventas (+ puerta del Grupo IP)

Scope: `template_caleb.html` (dashboard de Caleb, generado a `caleb.html`) y `puerta.html` (puerta de empresa
compartida con `template.html` de IP). Visitor mode: **Operate**.

Audiencia y tarea: los 4 gerentes del Grupo IP, en el teléfono y en escritorio, quieren saber en menos de un
minuto cómo va Caleb frente al mes anterior, qué lo mueve y qué atender (agotados, margen por vendedor,
salidas a $0, clientes que se enfrían). Datos reales del Excel del ERP, certificados por `caleb_clean.py`.

Constraints: HTML estático cifrado (AES-GCM + PIN), ECharts 5.5.1, sin backend, NORMAS_SISTEMA.md vigente
(pirámide invertida, 8 KPIs, 2 gráficos por banda, hints ≤ 20 palabras, tooltips ≤ 40).

## Direction contract

THESIS: Caleb es el hermano del dashboard de IP: la misma gramática de panel ejecutivo en todo el grupo, para
que un gerente cambie de empresa sin reaprender nada. Rechaza el look propio por empresa y el tablero genérico
de plantilla: la identidad vive en el azul y el rojo de Caleb aplicados con disciplina de roles.

OWN-WORLD: tarjetas blancas con borde de 1 px sobre gris #F3F5F8, tinta #0F1B33, azul Caleb #0F4F9C para
datos, acciones, selección y foco; rojo Caleb #D7191F solo para alertas y negativos; verde #15803D para
mejoras. IBM Plex Sans en todo. Radio 12 px, sombra neutra tenue. Menú lateral agrupado, barra de filtros
pegajosa con segmentadores desplegables y chips, barra de fechas con comparador.

STORY: el gerente elige la empresa en la puerta, entra con su PIN, ve cómo va Caleb (venta, ritmo diario,
margen) contra el mes anterior, entiende por qué (grupos, semanas, vendedores, productos) y sale con una
lista de qué atender hoy.

FIRST VIEWPORT: cabecera con logo de Caleb, período y "Cambiar de empresa"; barra de 7 segmentadores + Limpiar;
barra de fechas con atajos y el selector "Comparar con"; 8 indicadores en rejilla 4×2 (Venta neta en azul
sólido); debajo, Venta neta por semana (2/3) y Venta por grupo (1/3). Interacción firma: el selector
"Comparar con" reescribe el delta de los 8 indicadores, y cualquier barra filtra al hacer clic.

FORM: canon (el estándar de la categoría, elegido por el usuario el 2026-09-25), puesto 4 de la ronda;
seed 239a955d.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
