# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Los mismos cuatro usuarios para todas las empresas del Grupo IP: Roberts Flores (admin, autor del
sistema), Ismael (jefe), Ing. Palomares (supervisor) y Yuniarlis (usuario). Son gerentes, no técnicos, y
leen el dashboard sobre todo en el teléfono, a menudo en la calle y con sol (evidencia:
`NORMAS_SISTEMA.md` §3 y §5). Su trabajo es saber cómo va cada empresa, qué la mueve y a quién o qué hay
que atender (clientes que se enfrían, productos que se agotan, vendedores que se desvían).

## Product Purpose

Inteligencia de ventas del Grupo IP, una empresa por dashboard, detrás de una sola puerta: primero se elige
la empresa y después se entra con el PIN. Hoy hay dos: **Distribuidora y Suministros IP** (víveres,
desechables y repostería al mayor; en producción desde julio de 2026) y **Tiendas Caleb** (ferretería y
materiales de construcción al detal, "Todo para construir, renovar y mejorar"; datos desde el 6-jul-2026).
**Reviplas** es la tercera empresa, todavía sin datos ni dashboard. El éxito es que un gerente, en menos
de un minuto y desde el teléfono, sepa si la empresa va mejor o peor y por qué.

## Positioning

Cada dashboard se construye sobre el Excel real que exporta el ERP de esa empresa, con sus propias trampas
de datos documentadas y verificadas en cada corte (`CONTEXTO_CLAUDE.md` para IP, `CONTEXTO_CALEB.md` para
Caleb). Los números cuadran contra la fuente y las anomalías se explican en lugar de esconderse.

## Operating Context

- Los datos se actualizan **a petición**: Roberts sube el Excel a Drive (carpeta "Informes IP" y sus
  subcarpetas por empresa) y pide la corrida en el chat. Cada corte trae todo el período, no solo lo nuevo.
- Se publica en GitHub Pages como HTML estático; los datos van cifrados dentro del HTML y se abren con un
  PIN de 6 dígitos por usuario.
- Caleb es una sola tienda (un almacén) con venta de mostrador: sobre todo personas naturales, algunas
  empresas y organismos públicos; cierra los domingos.

## Capabilities and Constraints

- Sin backend: todo el cálculo (filtros, KPIs, comparaciones) ocurre en el navegador sobre el paquete
  descifrado. Gráficos con ECharts (CDN + respaldo local en `vendor/`).
- La UI de IP vive en `template.html`; `index.html` es un artefacto generado y nunca se edita a mano.
- Los roles son cosméticos: **todos los usuarios ven todos los datos**, incluidos los costos y márgenes de
  Caleb (confirmado el 2026-09-24).
- Caleb: en la serie de facturas con asterisco, las facturas devueltas completas son **facturas fiscales
  anuladas con nota de crédito** y cuentan como devolución normal (confirmado el 2026-09-24).
- Caleb: los nombres de grupo se deducen de los productos (1 Construcción y acabados · 2 Acero y techos ·
  3 Jardín · 4 Pinturas; confirmados el 2026-09-24). Los vendedores se muestran por código (V0–V5,
  CAJERO2) hasta que lleguen los nombres. *Abierto.*

## Brand Commitments

- **IP**: naranja `#ff4f20` y azul marino `#24205b`, logo en `Logo.svg`.
- **Tiendas Caleb**: logo en `Tiendas caleb.png` (rojo, azul y blanco, casa con techo rojo, lema "Todo para
  construir, renovar y mejorar").
- **Reviplas**: sin activos todavía.
- **Estilo de los dashboards del grupo** (elegido por Roberts el 2026-09-25): el panel ejecutivo estándar,
  hermano del de IP. Cada empresa conserva sus colores, pero la gramática (menú lateral, barra de filtros,
  8 indicadores, tarjetas) es la misma en todas. La puerta de empresa es neutral.

## Evidence on Hand

- `data_ip.xlsx` (IP, corte 8) y el Excel de Caleb en Drive (`Tiendas caleb/REPORTE tiendas caleb.XLS`,
  4 726 líneas, 6-jul → 7-sep-2026).
- No hay nombres de vendedores de Caleb, ni metas de venta, ni presupuesto: no se inventan.

## Product Principles

1. El número tiene que cuadrar con la fuente; si no cuadra, se explica en pantalla.
2. Primero lo que decide (cómo vamos y por qué), después el detalle.
3. Cada empresa conserva su identidad; la puerta del grupo es neutral.
4. Nada falla en silencio: un archivo roto no se publica.

## Accessibility & Inclusion

Lectura en teléfono a pleno sol: texto con contraste ≥ 4,5:1, objetivos táctiles de 44 px, nunca
información solo por color (▲/▼ siempre con signo y cifra), `prefers-reduced-motion` respetado.
