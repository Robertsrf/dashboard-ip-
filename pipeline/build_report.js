/* build_report.js - arma el Word del corte a partir del JSON de analysis.py.
 *
 *   node pipeline/build_report.js [analysis.json] [salida.doc]
 *
 * Mejora A1: herramienta paralela. No la lee build_dashboard.py, no entra en
 * el index.html y no la sirve GitHub Pages.
 */
const fs = require('fs');
const path = require('path');
const H = require('./rep_helpers.js');

const MES = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function mesLargo(ym) {
  const [y, m] = ym.split('-');
  return MES[parseInt(m, 10)] + ' ' + y;
}

function build(d) {
  const t = d.totales, per = d.periodo, s = d.serie_mensual;
  const out = [];

  out.push(H.cover(
    'DISTRIBUIDORA Y SUMINISTROS IP',
    'Panorama de Ventas - Informe Ejecutivo',
    [
      'Periodo de datos: ' + per.fecha_min + ' al ' + per.fecha_max +
        (per.mes_parcial ? '  (el ultimo mes esta INCOMPLETO: ' + per.dia_max_mes_ultimo + ' de ' + per.dias_del_mes + ' dias)' : ''),
      'Archivo de origen: ' + d.fuente.archivo + '  ·  el periodo sale de FECHADOC, no del nombre del archivo',
      'Autor del sistema: Ing. Roberts Flores',
      '<span class="conf">CONFIDENCIAL - uso interno</span>',
    ]));

  out.push(H.kpis([
    ['Ingresos acumulados', H.money(t.neto)],
    ['Facturas', H.num(t.facturas)],
    ['Clientes unicos', H.num(t.clientes)],
    ['Ticket promedio', H.money(t.ticket_promedio)],
    ['SKU vendidos', H.num(t.sku)],
  ]));

  if (per.mes_parcial) {
    out.push(H.box('MES EN CURSO INCOMPLETO',
      'Los datos llegan al dia <b>' + per.dia_max_mes_ultimo + '</b> de ' + mesLargo(per.mes_ultimo) +
      ' (de ' + per.dias_del_mes + '). No compares ese mes contra meses cerrados sin anualizarlo, y ' +
      'recuerda que el universo de riesgo sale inflado.', 'w'));
  }

  // 1. Evolucion mensual
  out.push(H.h2('1. Evolucion mensual'));
  out.push(H.p('La serie cubre <b>' + s.length + ' meses</b>. La venta es <b>SUMANETO</b>; ' +
    'las devoluciones (CNTDEVUELT: ' + H.num(t.devoluciones_unidades) + ' unidades) no se cuentan como venta.'));
  out.push(H.table(
    ['Mes', 'Venta neta', 'Facturas', 'Clientes', 'Ticket'],
    s.map((m) => [mesLargo(m.mes), H.money(m.neto), H.num(m.facturas), H.num(m.clientes), H.money(m.ticket)]),
    [1, 2, 3, 4]));

  const mejor = s.reduce((a, b) => (b.neto > a.neto ? b : a), s[0]);
  out.push(H.p('El mejor mes del periodo es <b>' + mesLargo(mejor.mes) + '</b> con ' + H.money(mejor.neto) + '.'));

  // 2. Proyeccion
  const pr = d.proyeccion;
  out.push(H.h2('2. Proyeccion de cierre'));
  out.push(H.p('Regresion lineal sobre la serie mensual. Pendiente: <b>' + H.money(pr.pendiente_mensual) +
    '</b> por mes. ' + pr.nota));
  if (pr.meses_proyectados.length) {
    out.push(H.table(['Mes', 'Proyectado'],
      pr.meses_proyectados.map((m) => [mesLargo(m.mes), H.money(m.proyectado)]), [1]));
  }
  out.push(H.box('CIERRE ESTIMADO DEL ANO', H.money(pr.cierre_estimado_ano) +
    ' si se mantiene la tendencia actual.', 'i'));

  // 3. Concentracion
  const c = d.concentracion;
  out.push(H.h2('3. Concentracion de cartera'));
  out.push(H.p('Los <b>10 mayores clientes</b> concentran el <b>' + H.pct(c.top10_share) + '</b> de la venta ' +
    '(top 20: ' + H.pct(c.top20_share) + '). Bastan <b>' + c.clientes_para_80pct + '</b> clientes de ' +
    H.num(c.clientes_totales) + ' para llegar al 80% del ingreso.'));
  out.push(H.h3('3.1 Top 20 clientes'));
  out.push(H.table(['#', 'Cliente', 'Acumulado'],
    c.top20_clientes.map((x, i) => [i + 1, x.cliente, H.money(x.neto)]), [0, 2]));

  // 4. Vendedores
  const v = d.vendedores;
  out.push(H.h2('4. Desempeno de vendedores'));
  out.push(H.p('Equipo de <b>' + v.activos + ' vendedores</b>. Se excluyen los registros espurios (' +
    v.excluidos.join(', ') + '), que no son vendedores reales.'));
  out.push(H.table(['#', 'Vendedor', 'Ventas', '% total', 'Clientes', 'Facturas', 'SKU', 'Ticket'],
    v.ranking.map((r, i) => [i + 1, r.vendedor, H.money(r.neto), H.pct(r.share),
      H.num(r.clientes), H.num(r.facturas), H.num(r.sku), H.money(r.ticket)]),
    [0, 2, 3, 4, 5, 6, 7]));

  // 5. Marcas
  const mk = d.marcas;
  out.push(H.h2('5. Marcas'));
  out.push(H.p('<b>' + mk.marcas_distintas + ' marcas</b> tras normalizar el sufijo " (N)" ' +
    '(sin normalizar salian ' + mk.marcas_distintas_sin_limpiar + ', partiendo marcas en dos).'));
  out.push(H.table(['#', 'Marca', 'Venta neta'],
    mk.top20.map((x, i) => [i + 1, x.marca, H.money(x.neto)]), [0, 2]));

  // 6. Sectores
  out.push(H.h2('6. Sectores y zonas'));
  out.push(H.table(['#', 'Sector', 'Venta neta', 'Clientes'],
    d.sectores.slice(0, 20).map((x, i) => [i + 1, x.sector, H.money(x.neto), H.num(x.clientes)]),
    [0, 2, 3]));

  // 7. Dimensiones antes sin usar (A4)
  const dd = d.dimensiones_dormidas || {};
  out.push(H.h2('7. Analisis fino de producto y cartera'));
  if (dd.referencia) {
    out.push(H.h3('7.1 Por REFERENCIA (sub-familia, mas fino que marca)'));
    out.push(H.p('Hay <b>' + dd.referencia.distintas + ' referencias</b> distintas.'));
    out.push(H.table(['#', 'Referencia', 'Venta neta', 'SKU'],
      dd.referencia.top20.map((x, i) => [i + 1, x.referencia, H.money(x.neto), H.num(x.sku)]),
      [0, 2, 3]));
  }
  if (dd.subgrupo) {
    out.push(H.h3('7.2 Por SUBGRUPO'));
    out.push(H.table(['#', 'Subgrupo', 'Venta neta'],
      dd.subgrupo.top20.map((x, i) => [i + 1, x.subgrupo, H.money(x.neto)]), [0, 2]));
  }
  if (dd.codcliente) {
    const cc = dd.codcliente;
    out.push(H.h3('7.3 Clientes duplicados por variantes de nombre'));
    out.push(H.p('Contando por nombre salen <b>' + H.num(cc.clientes_por_nombre) + '</b> clientes; por ' +
      'CODCLIENTE, <b>' + H.num(cc.clientes_por_codigo) + '</b>. La diferencia de <b>' + cc.diferencia +
      '</b> son ' + cc.codigos_con_varios_nombres + ' codigos con el nombre escrito de varias formas, ' +
      'que hoy se cuentan como clientes distintos. ' + cc.nota));
    if (cc.ejemplos.length) {
      out.push(H.table(['Codigo', 'Variantes del nombre'],
        cc.ejemplos.map((e) => [e.codcliente, e.variantes.join('  |  ')])));
    }
  }

  // 8. Riesgo
  const r = d.riesgo;
  out.push(H.h2('8. Clientes en riesgo y recuperados'));
  if (r.mes_parcial) out.push(H.box('LEER CON CUIDADO', r.advertencia, 'w'));
  out.push(H.kpis([
    ['En riesgo', H.num(r.en_riesgo)],
    ['Valor en riesgo', H.money(r.valor_en_riesgo)],
    ['Recuperados', H.num(r.recuperados)],
    ['Valor recuperado', H.money(r.valor_recuperado)],
  ]));
  out.push(H.p('Clientes que compraron antes pero NO en los ultimos 2 meses. ' +
    'El detalle completo se entrega en el Excel de "Clientes en riesgo y recuperados".'));
  out.push(H.h3('8.1 Top 20 en riesgo por valor historico'));
  out.push(H.table(['#', 'Cliente', 'Historico', 'Vendedor', 'Ultima compra'],
    r.top20_en_riesgo.map((x, i) => [i + 1, x.cliente, H.money(x.historico), x.vendedor, x.ultima_compra]),
    [0, 2]));

  // 9. Controles
  out.push(H.h2('9. Controles de la data'));
  out.push(H.p('El dashboard incluye AMERICO y REVIPLAST; este informe los excluye. Por eso los totales ' +
    'de uno y otro no cuadran, y no es un error.'));
  const ca = d.controles_data_completa, ci = d.controles_universo_informe;
  out.push(H.table(['Control', 'Data completa (dashboard)', 'Universo del informe'], [
    ['Filas', H.num(ca.filas), H.num(ci.filas)],
    ['Venta neta', H.money(ca.neto_total), H.money(ci.neto_total)],
    ['Facturas', H.num(ca.facturas), H.num(ci.facturas)],
    ['Clientes (por nombre)', H.num(ca.clientes_por_nombre), H.num(ci.clientes_por_nombre)],
    ['Clientes (por codigo)', H.num(ca.clientes_por_codigo), H.num(ci.clientes_por_codigo)],
    ['Marcas', H.num(ca.marcas), H.num(ci.marcas)],
    ['Rango de fechas', ca.fecha_min + ' a ' + ca.fecha_max, ci.fecha_min + ' a ' + ci.fecha_max],
  ], [1, 2]));

  return H.doc('Panorama de Ventas - Distribuidora y Suministros IP', out.join('\n'));
}

const here = __dirname;
const inFile = process.argv[2] || path.join(here, 'analysis.json');
const outFile = process.argv[3] || path.join(here, 'Informe_Ejecutivo_IP.doc');
if (!fs.existsSync(inFile)) {
  console.error('No existe ' + inFile + '. Corre antes:  python pipeline/analysis.py <excel>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(inFile, 'utf8'));
fs.writeFileSync(outFile, build(data), 'utf8');
console.log('OK -> ' + outFile + '  (' + (fs.statSync(outFile).size / 1024).toFixed(1) + ' KB)');
console.log('  Periodo: ' + data.periodo.fecha_min + ' -> ' + data.periodo.fecha_max +
  (data.periodo.mes_parcial ? '  [MES PARCIAL]' : ''));
