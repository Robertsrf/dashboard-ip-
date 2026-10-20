/* Distribuidora y Suministros IP: secciones del dashboard sobre el nucleo.
   Las cifras siguen las reglas de CONTEXTO_CLAUDE.md: venta = SUMANETO, mes
   parcial escalado a cierre antes de comparar, cobranza por camada con sus dos
   tasas, y el universo del dashboard INCLUYE AMERICO y REVIPLAS (I3).       */
(function (G) {
  'use strict';
  const GIP = G.GIP, F = GIP.F, esc = GIP.esc, KIT = GIP.kit, T = GIP.tiempo;
  const PAL = ['#24205b', '#ff4f20', '#17a39a', '#b7800f', '#5b6aa0', '#c2417a', '#3a8fc1', '#7c9a2b'];
  const SERIE = '#24205b', ENFASIS = '#ff4f20', PARCIAL = '#B9BEDA', POS = '#15803D', NEG = '#B42318';
  const vnorm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---- Datos comunes ------------------------------------------------------- */
  function mensual(c) {
    const g = c.agrupar('mes', { sumas: ['neto', 'cant', 'dev'], distintos: ['doc', 'cli', 'prod'] }), n = c.dims.mes.length;
    const a = k => Array.from({ length: n }, (_, i) => g[k][i] || 0);
    return { neto: a('neto'), cant: a('cant'), dev: a('dev'), doc: a('doc'), cli: a('cli'), prod: a('prod') };
  }
  /* Ultimo mes con venta en la seleccion; si es el mes del corte y va a medias,
     se escala a cierre (frac) antes de compararlo con el anterior.           */
  function ultimoMes(c, mo) {
    let L = mo.neto.length - 1;
    while (L > 0 && !mo.neto[L]) L--;
    const pi = T.mesParcial(mo.neto, c.P.dateMax), parcial = pi.partial && L === pi.idx;
    return { L, prev: L - 1, parcial, frac: parcial ? pi.frac : 1, dia: pi.day, dim: pi.dim,
      nombre: F.mes(c.dims.histMonthNums[L] - 1), nombrePrev: L > 0 ? F.mes(c.dims.histMonthNums[L - 1] - 1) : '' };
  }
  const variacion = (cur, prev) => prev ? (cur - prev) / Math.abs(prev) * 100 : null;
  function proy(c, mo) { return T.proyeccion(mo.neto, c.dims.histMonthNums, c.P.dateMax); }
  function conFiltros(c) { return Object.keys(GIP.S.f).some(k => GIP.S.f[k].size) || c.rango[0] > 0 || c.rango[1] < c.P.dayCount - 1; }

  /* ---- Segmentadores ------------------------------------------------------- */
  const segmentadores = P => [
    { k: 'mes', col: 'mes', label: 'Mes', nombres: P.dims.mesLabels },
    { k: 'grupo', col: 'grupo', label: 'Grupo', nombres: P.dims.grupo },
    { k: 'vend', col: 'vend', label: 'Vendedor', nombres: P.dims.vend },
    { k: 'estado', col: 'estado', label: 'Estado', nombres: P.dims.estado },
    { k: 'sector', col: 'sector', label: 'Zona', nombres: P.dims.sector },
    { k: 'marca', col: 'marca', label: 'Marca', nombres: P.dims.marca },
    { k: 'familia', col: 'familia', label: 'Familia', nombres: P.dims.familia },
    { k: 'cli', col: 'cli', label: 'Cliente', nombres: P.dims.cli },
    { k: 'prod', col: 'prod', label: 'Producto', nombres: P.dims.prod },
  ];

  /* ---- Indicadores ---------------------------------------------------------- */
  function kpis(c) {
    const mo = mensual(c), u = ultimoMes(c, mo), t = c.total({ sumas: ['neto', 'cant', 'dev'], distintos: ['doc', 'cli', 'prod'] });
    const pj = proy(c, mo), proyAno = pj.proj.reduce((a, b) => a + b, 0);
    const ref = u.parcial ? u.nombre + ' a cierre vs ' + u.nombrePrev : u.nombre + ' vs ' + u.nombrePrev;
    const d = (serie, escalar) => u.L < 1 ? null : { v: variacion(serie[u.L] / (escalar ? u.frac : 1), serie[u.prev]), ref };
    const tk = mo.neto.map((v, i) => mo.doc[i] ? v / mo.doc[i] : 0), dv = mo.cant.map((q, i) => q ? mo.dev[i] / q * 100 : 0);
    return [
      { id: 'neto', lab: 'Venta neta', val: F.dinero(t.neto), sub: F.entero(t.doc) + ' facturas', delta: d(mo.neto, true), serie: mo.neto, sensible: true,
        tip: 'Ventas menos devoluciones de todo lo filtrado. La flecha compara el último mes con el anterior; si el mes va a medias, se estima a cierre.' },
      { id: 'proy', lab: 'Proyección del año', val: F.dinero(proyAno), sub: 'cierre estimado a diciembre', sensible: true,
        tip: 'Meses reales más los que faltan según la tendencia lineal. Si el último mes está incompleto, primero se estima a cierre.' },
      { id: 'tk', lab: 'Ticket promedio', val: F.dinero(t.doc ? t.neto / t.doc : 0), sub: 'venta por factura', delta: d(tk), serie: tk,
        tip: 'Venta neta dividida entre facturas: lo que deja en promedio cada factura.' },
      { id: 'cli', lab: 'Clientes', val: F.entero(t.cli), sub: 'compraron en la selección', delta: d(mo.cli, true), serie: mo.cli,
        tip: 'Clientes distintos que compraron en la selección.' },
      { id: 'fac', lab: 'Facturas', val: F.entero(t.doc), sub: F.entero(t.filas) + ' líneas', delta: d(mo.doc, true), serie: mo.doc,
        tip: 'Facturas distintas en la selección.' },
      { id: 'uni', lab: 'Unidades', val: F.entero(t.cant), sub: 'vendidas', delta: d(mo.cant, true), serie: mo.cant,
        tip: 'Unidades vendidas en la selección, antes de devoluciones.' },
      { id: 'sku', lab: 'Productos vendidos', val: F.entero(t.prod), sub: 'SKU distintos', delta: d(mo.prod, true), serie: mo.prod,
        tip: 'Productos (SKU) distintos con al menos una línea en la selección.' },
      { id: 'dev', lab: 'Devolución', val: F.pct(t.cant ? t.dev / t.cant * 100 : 0), sub: 'de las unidades',
        delta: u.L < 1 ? null : { v: dv[u.L] - dv[u.prev], pp: true, inverso: true, ref: u.nombre + ' vs ' + u.nombrePrev }, serie: dv,
        tip: 'Unidades devueltas entre unidades vendidas. Mientras más baja, mejor.' },
    ];
  }

  /* ---- Inicio: titular, que lo explica, que atender ------------------------ */
  function titular(c) {
    const mo = mensual(c), u = ultimoMes(c, mo), pj = proy(c, mo), total = mo.neto.reduce((a, b) => a + b, 0);
    if (!total) return '<p class="lede">No hay ventas en esta selección.</p>';
    const pre = conFiltros(c) ? 'Con los filtros elegidos, ' : '', Mes = cap(u.nombre);
    const flecha = v => v == null ? '' : ' (<span class="' + (v >= 0 ? 'sube' : 'baja') + '">' + (v >= 0 ? '▲ ' : '▼ ') + F.delta(v) + '</span> frente a ' + u.nombrePrev + ')';
    if (c.reunion) {
      const vc = variacion(mo.cli[u.L] / u.frac, mo.cli[u.prev]), tk = mo.doc[u.L] ? mo.neto[u.L] / mo.doc[u.L] : 0;
      return '<p class="lede">' + (pre ? pre + 'e' : 'E') + 'n ' + u.nombre + (u.parcial ? ', que va por el día ' + u.dia + ',' : '') + ' compraron <strong>'
        + F.entero(mo.cli[u.L]) + ' clientes</strong>' + flecha(u.parcial ? null : vc) + ' y se emitieron <strong>' + F.entero(mo.doc[u.L])
        + ' facturas</strong>, con un ticket promedio de <strong>' + F.dinero(tk) + '</strong>.</p>'
        + '<p class="lede-sub">Vista de reunión: no muestra totales ni proyecciones de la empresa.</p>';
    }
    const cur = mo.neto[u.L], v = variacion(cur / u.frac, mo.neto[u.prev]), ano = pj.proj.reduce((a, b) => a + b, 0);
    const frase1 = u.parcial
      ? Mes + ' va en <strong>' + F.dinero(cur) + '</strong> con ' + u.dia + ' de ' + u.dim + ' días; a este ritmo cerraría en <strong>' + F.dinero(cur / u.frac) + '</strong>' + flecha(v) + '.'
      : Mes + ' cerró en <strong>' + F.dinero(cur) + '</strong>' + flecha(v) + '.';
    const frase2 = ' El año suma <strong>' + F.corto(total).replace(' M', ' millones').replace(' K', ' mil') + '</strong> y la tendencia apunta a <strong>'
      + F.corto(ano).replace(' M', ' millones').replace(' K', ' mil') + '</strong> en diciembre.';
    const nc = mo.cli[u.L], dc = u.L > 0 ? nc - mo.cli[u.prev] : 0;
    return '<p class="lede">' + (pre ? pre + frase1.charAt(0).toLowerCase() + frase1.slice(1) : frase1) + frase2 + '</p>'
      + '<p class="lede-sub">' + F.entero(nc) + ' clientes compraron en ' + u.nombre + (u.L > 0 && !u.parcial ? ', ' + F.entero(Math.abs(dc)) + (dc >= 0 ? ' más' : ' menos') + ' que en ' + u.nombrePrev : '')
      + '. Abajo, qué movió el mes y qué conviene atender.</p>';
  }

  /* Los que mas suben y mas bajan frente al mes anterior, por dimension */
  function motores(c) {
    const mo = mensual(c), u = ultimoMes(c, mo);
    if (u.L < 1) return null;
    const dims = [['vend', 'Vendedores', c.dims.vend], ['marca', 'Marcas', c.dims.marca], ['estado', 'Estados', c.dims.estado]];
    return dims.map(([col, titulo, nombres]) => {
      const x = c.M.cruzar(c.sel, col, 'mes', 'neto'), out = [];
      for (let a = 0; a < x.nA; a++) {
        const cur = x.v[a * x.nB + u.L] / u.frac, prev = x.v[a * x.nB + u.prev];
        if (Math.abs(cur) + Math.abs(prev) > 1) out.push({ nombre: nombres[a], d: cur - prev, cur, prev });
      }
      out.sort((p, q) => q.d - p.d);
      return { col, titulo, sube: out.filter(o => o.d > 0).slice(0, 3), baja: out.filter(o => o.d < 0).slice(-3).reverse() };
    });
  }
  function htmlMotores(c, host) {
    const m = motores(c), mo = mensual(c), u = ultimoMes(c, mo);
    if (!m) { host.innerHTML = '<p class="vacio">Hace falta más de un mes en la selección para comparar.</p>'; return; }
    const li = o => '<li><span>' + esc(o.nombre) + '</span><span class="' + (o.d >= 0 ? 'sube' : 'baja') + '">' + (o.d >= 0 ? '+' : '−') + F.corto(Math.abs(o.d)) + '</span></li>';
    host.innerHTML = '<div class="motores">' + m.map(d => '<div class="motor"><h4>' + d.titulo + ' que más suben</h4><ul>'
      + (d.sube.length ? d.sube.map(li).join('') : '<li><span>Ninguno</span><span></span></li>') + '</ul>'
      + '<h4 style="margin-top:10px">' + d.titulo + ' que más bajan</h4><ul>'
      + (d.baja.length ? d.baja.map(li).join('') : '<li><span>Ninguno</span><span></span></li>') + '</ul></div>').join('') + '</div>'
      + '<p class="notas">' + cap(u.nombre) + (u.parcial ? ' estimado a cierre' : '') + ' contra ' + u.nombrePrev + ', en dólares de venta neta.</p>';
  }

  /* Que atender: cada alerta dice que pasa, cuanto pesa y lleva a su seccion */
  function alertas(c) {
    const it = [], mo = mensual(c), u = ultimoMes(c, mo);
    const ina = inactivos(c);
    if (ina.length) {
      const val = ina.slice(0, 20).reduce((a, x) => a + x.tot, 0);
      it.push({ s: 'r', t: F.entero(ina.length) + ' clientes llevan más de 45 días sin comprar',
        m: 'Los 20 de más valor compraron ' + F.dinero(val) + ' en el año. El de más valor: ' + ina[0].nombre.replace(/\.+$/, '') + '.', ir: 'cli' });
    }
    if (u.L >= 1) {
      const x = c.M.cruzar(c.sel, 'vend', 'mes', 'neto'), caen = [];
      for (let a = 0; a < x.nA; a++) {
        const cur = x.v[a * x.nB + u.L] / u.frac, prev = x.v[a * x.nB + u.prev], v = variacion(cur, prev);
        if (prev >= 5000 && v != null && v <= -25) caen.push({ n: c.dims.vend[a], v });
      }
      caen.sort((p, q) => p.v - q.v);
      if (caen.length) it.push({ s: 'a', t: caen.length + (caen.length === 1 ? ' vendedor cae' : ' vendedores caen') + ' más de un 25 % frente a ' + u.nombrePrev,
        m: caen.slice(0, 4).map(o => o.n + ' ' + F.delta(o.v, 0)).join(', ') + (u.parcial ? '. ' + cap(u.nombre) + ' estimado a cierre.' : '.'), ir: 'vend' });
    }
    const rl = c.P.riskList, hoja = rl && rl.order.find(h => /riesgo/i.test(h) && rl.sheets[h].count);
    if (hoja) it.push({ s: 'a', t: F.entero(rl.sheets[hoja].count) + ' clientes en riesgo en la lista del corte',
      m: 'Sin compras en los últimos dos meses.' + (u.parcial ? ' Con el mes a medias la lista se lee inflada.' : ''), ir: 'riesgo' });
    const COB = c.P.Pcob;
    if (COB) {
      let pend = 0, n = 0; COB.rows.forEach(r => { if (r[5] !== COB.anulIdx && r[8] > 0.005) { pend += r[8]; n++; } });
      if (pend > 0) it.push({ s: 'b', t: F.dinero(pend) + ' pendientes de cobro en ' + F.entero(n) + ' facturas',
        m: 'La camada más joven (' + COB.camadaMax + ') sigue madurando: su pendiente es normal.', ir: 'cob' });
    }
    if (u.parcial) it.push({ s: 'b', t: cap(u.nombre) + ' va a medias: ' + u.dia + ' de ' + u.dim + ' días',
      m: 'Las comparaciones del mes usan la venta estimada a cierre. Las caídas y el riesgo pueden verse exagerados.', ir: 'tend' });
    return it;
  }
  const SEV = { r: ['Urgente', 'etq-r', 'sev-r'], a: ['Revisar', 'etq-a', 'sev-a'], b: ['Seguimiento', 'etq-n', 'sev-b'] };
  function htmlAlertas(c, host) {
    const it = alertas(c).filter(a => !(c.reunion && (a.ir === 'tend')));
    host.innerHTML = it.length ? '<div class="lista">' + it.map(a => '<div class="fila"><span class="marca-sev ' + SEV[a.s][2] + '" aria-hidden="true"></span>'
      + '<p><span class="etq ' + SEV[a.s][1] + '">' + SEV[a.s][0] + '</span> ' + esc(a.t) + '<small>' + esc(a.m) + '</small></p>'
      + '<button class="btn btn-sec" type="button" data-ir="' + a.ir + '">Ver detalle</button></div>').join('') + '</div>'
      : '<p class="vacio">Nada urgente en esta selección.</p>';
  }

  /* ---- Tendencia ------------------------------------------------------------ */
  function grafTendencia(c, ch, completo) {
    const mo = mensual(c), pj = proy(c, mo), etq = c.dims.fullLabels;
    if (!mo.neto.some(Boolean)) { KIT.vacio(ch); return; }
    const marca = pj.xs[pj.xs.length - 1];
    ch.setOption({ grid: KIT.rejilla({ bottom: 36 }), legend: KIT.leyenda({ data: ['Real', 'Proyección'] }),
      tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, valueFormatter: v => v == null ? '–' : F.dinero(v) }),
      xAxis: KIT.ejeCat(etq), yAxis: KIT.ejeVal(),
      series: [
        completo
          ? { name: 'Real', type: 'line', data: pj.yFull, smooth: true, symbol: 'circle', symbolSize: 7, lineStyle: { color: SERIE, width: 3 }, itemStyle: { color: SERIE },
            areaStyle: { color: 'rgba(36,32,91,.08)' } }
          : { name: 'Real', type: 'bar', data: pj.yFull, barMaxWidth: 30, itemStyle: { borderRadius: [4, 4, 0, 0], color: p => pj.partial && p.dataIndex === pj.partialCal ? PARCIAL : SERIE } },
        { name: 'Proyección', type: 'line', data: pj.projOnly, smooth: true, symbol: 'emptyCircle', symbolSize: 7, lineStyle: { type: 'dashed', color: ENFASIS, width: 2.5 },
          itemStyle: { color: ENFASIS }, markArea: completo ? { itemStyle: { color: 'rgba(255,79,32,.06)' }, data: [[{ xAxis: etq[marca] }, { xAxis: etq[11] }]] } : undefined },
      ] }, true);
  }
  function tablaProyeccion(c, host) {
    const mo = mensual(c), pj = proy(c, mo), real = pj.yFull.reduce((a, b) => a + (b || 0), 0), ano = pj.proj.reduce((a, b) => a + b, 0);
    host.innerHTML = '<div class="envoltura"><table><thead><tr><th>Mes</th><th class="num">Real</th><th class="num">Proyectado</th></tr></thead><tbody>'
      + c.dims.fullLabels.map((lb, m) => { const r = pj.yFull[m], parcial = pj.partial && m === pj.partialCal;
        return '<tr><td>' + esc(lb) + '</td><td class="num">' + (r != null ? F.dinero(r) + (parcial ? ' <span class="etq etq-a">parcial</span>' : '') : '–')
          + '</td><td class="num">' + (parcial ? F.dinero(pj.proj[m]) : r != null ? '<span class="etq etq-n">real</span>' : F.dinero(pj.proj[m])) + '</td></tr>'; }).join('')
      + '</tbody><tfoot><tr><td>Cierre estimado ' + esc(c.P.year) + '</td><td class="num">' + F.dinero(real) + '</td><td class="num">' + F.dinero(ano) + '</td></tr></tfoot></table></div>';
  }
  function grafMoM(c, ch) {
    const mo = mensual(c), u = ultimoMes(c, mo), eff = mo.neto.map((v, i) => i === u.L ? v / u.frac : v);
    const mom = eff.map((v, i) => i === 0 || !eff[i - 1] ? 0 : +((v - eff[i - 1]) / eff[i - 1] * 100).toFixed(1));
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ valueFormatter: v => F.delta(v) }), xAxis: KIT.ejeCat(c.dims.mesLabels),
      yAxis: KIT.ejeVal(v => v + ' %'), series: [{ type: 'bar', barMaxWidth: 34, data: mom, itemStyle: { borderRadius: [4, 4, 0, 0], color: p => p.value >= 0 ? POS : NEG },
        label: { show: !c.mob, position: 'top', fontSize: KIT.fs(10), color: '#4A5270', formatter: p => F.delta(p.value, 0) } }] }, true);
  }
  function grafAcumulado(c, ch) {
    const mo = mensual(c); let acc = 0; const cum = mo.neto.map(v => Math.round(acc += v));
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, valueFormatter: F.dinero }), xAxis: KIT.ejeCat(c.dims.mesLabels),
      yAxis: KIT.ejeVal(), series: [{ type: 'line', data: cum, smooth: true, symbol: 'circle', lineStyle: { color: SERIE, width: 3 }, itemStyle: { color: SERIE },
        areaStyle: { color: 'rgba(36,32,91,.08)' } }] }, true);
  }
  function grafUnidades(c, ch) {
    const mo = mensual(c), tk = mo.neto.map((v, i) => mo.doc[i] ? Math.round(v / mo.doc[i]) : 0);
    ch.setOption({ grid: KIT.rejilla({ bottom: 36 }), legend: KIT.leyenda({ data: ['Unidades', 'Ticket promedio'] }), tooltip: KIT.tooltip(),
      xAxis: KIT.ejeCat(c.dims.mesLabels),
      yAxis: [KIT.ejeVal(v => F.entero(v)), KIT.ejeVal(F.corto, { position: 'right', splitLine: { show: false } })],
      series: [{ name: 'Unidades', type: 'bar', data: mo.cant.map(Math.round), barMaxWidth: 30, itemStyle: { color: '#17a39a', borderRadius: [4, 4, 0, 0] } },
        { name: 'Ticket promedio', type: 'line', yAxisIndex: 1, data: tk, smooth: true, lineStyle: { color: ENFASIS, width: 3 }, itemStyle: { color: ENFASIS } }] }, true);
  }
  function grafCalendario(c, ch, host) {
    const d = c.M.porDia(c.sel, 'neto', c.P.dayCount);
    KIT.calendario(ch, d);
    let top = -1, mx = -Infinity, dias = 0, suma = 0;
    d.forEach((v, i) => { if (v > mx) { mx = v; top = i; } if (v > 0) { dias++; suma += v; } });
    const notas = document.getElementById('cal-notas') || (() => { const p = document.createElement('p'); p.id = 'cal-notas'; p.className = 'notas'; host.after(p); return p; })();
    notas.innerHTML = '<span><b>Mejor día:</b> ' + (top >= 0 ? F.fecha(c.offAFecha(top)) + ', ' + F.dinero(mx) : '–') + '</span><span><b>Días con venta:</b> ' + dias
      + '</span><span><b>Promedio por día con venta:</b> ' + F.dinero(dias ? suma / dias : 0) + '</span>';
  }

  /* ---- Rankings, trayectorias y tablas por dimension ------------------------- */
  function ranking(c, ch, col, nombres, o) {
    const r = c.ranking(col, nombres, 'neto', { sumas: ['neto'], distintos: ['doc'] }), tot = r.reduce((a, x) => a + x.v, 0) || 1;
    KIT.barrasH(ch, r.map(x => [x.nombre, x.v, x]), Object.assign({ tip: p => F.dinero(p[1]) + ', ' + F.pct(p[1] / tot * 100) + ' de la selección<br>'
      + F.entero(p[2].g.doc[p[2].i]) + ' facturas', clic: p => GIP.alternar(col, p[0]) }, o || {}));
  }
  function trayectorias(c, ch, col, nombres, n) {
    const g = c.agrupar(col, { sumas: ['neto'] }), x = c.M.cruzar(c.sel, col, 'mes', 'neto'), top = [];
    for (let a = 0; a < g.neto.length; a++) if (g.filas[a]) top.push(a);
    top.sort((p, q) => g.neto[q] - g.neto[p]);
    const series = top.slice(0, n || 6).map(a => ({ name: nombres[a], data: Array.from(x.fila(a)).slice(0, c.dims.mes.length).map(Math.round) }));
    KIT.lineasPorMes(ch, c.dims.mesLabels, series);
  }
  function tablaEntidad(c, host, col, nombres, etiqueta, clicK) {
    const g = c.agrupar(col, { sumas: ['neto', 'cant'], distintos: ['doc', 'cli', 'prod'] }), tot = Array.from(g.neto).reduce((a, b) => a + b, 0) || 1, filas = [];
    for (let i = 0; i < g.filas.length; i++) if (g.filas[i]) filas.push({ nombre: nombres[i], neto: g.neto[i], part: g.neto[i] / tot * 100, fac: g.doc[i],
      tk: g.doc[i] ? g.neto[i] / g.doc[i] : 0, cli: g.cli[i], sku: g.prod[i], uni: g.cant[i] });
    KIT.tabla(host, { cols: [{ k: 'nombre', l: etiqueta, cls: 'nm' }, { k: 'neto', l: 'Venta neta', n: 1, f: F.dinero }, { k: 'part', l: 'Participación', n: 1, f: v => F.pct(v) },
      { k: 'fac', l: 'Facturas', n: 1, f: F.entero }, { k: 'tk', l: 'Ticket', n: 1, f: F.dinero }, { k: 'cli', l: 'Clientes', n: 1, f: F.entero },
      { k: 'sku', l: 'Productos', n: 1, f: F.entero }, { k: 'uni', l: 'Unidades', n: 1, f: F.entero }],
    filas, orden: ['neto', -1], buscarTexto: 'Buscar ' + etiqueta.toLowerCase(), clic: clicK ? r => GIP.alternar(clicK, r.nombre) : null });
  }

  /* ---- Vendedores ---------------------------------------------------------- */
  function grafVariacionVend(c, ch) {
    const mo = mensual(c), u = ultimoMes(c, mo);
    if (u.L < 1) { KIT.vacio(ch, 'Hace falta más de un mes en la selección'); return; }
    const x = c.M.cruzar(c.sel, 'vend', 'mes', 'neto'), p = [];
    for (let a = 0; a < x.nA; a++) {
      const cur = x.v[a * x.nB + u.L] / u.frac, prev = x.v[a * x.nB + u.prev], v = variacion(cur, prev);
      if (prev >= 5000 && v != null) p.push([c.dims.vend[a], +v.toFixed(1), { cur, prev }]);
    }
    p.sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p, { izq: 120, izqMob: 92, fmt: v => F.delta(v), axf: v => F.pct(v, 0), label: q => F.delta(q[1], 0), colorFn: q => q[1] >= 0 ? POS : NEG,
      tip: q => F.delta(q[1]) + '<br>' + cap(u.nombre) + (u.parcial ? ' (a cierre)' : '') + ': ' + F.dinero(q[2].cur) + '<br>' + cap(u.nombrePrev) + ': ' + F.dinero(q[2].prev),
      clic: q => GIP.alternar('vend', q[0]), vacio: 'Ningún vendedor con venta en los dos meses' });
  }

  /* ---- Clientes ------------------------------------------------------------ */
  /* Sin compras hace mas de 45 dias, respetando los segmentadores pero no el
     rango de fechas: la inactividad se mide contra la fecha del corte.       */
  function inactivos(c) {
    const S0 = GIP.S, f = {};
    for (const k in S0.f) if (S0.f[k].size) f[k] = S0.f[k];     // en IP la clave del segmentador es su columna
    const sel = c.M.seleccion({ f, rango: null }), ult = c.M.ultimoDia(sel, 'cli'), g = c.M.agrupar(sel, 'cli', { sumas: ['neto'] });
    const hoy = c.P.dayCount - 1, out = [];
    for (let i = 0; i < ult.length; i++) if (ult[i] >= 0 && hoy - ult[i] > 45) out.push({ i, nombre: c.dims.cli[i], tot: g.neto[i], ult: ult[i], dias: hoy - ult[i] });
    return out.sort((a, b) => b.tot - a.tot);
  }
  function tablaInactivos(c, host) {
    const it = inactivos(c);
    KIT.tabla(host, { cols: [{ k: 'nombre', l: 'Cliente', cls: 'nm' }, { k: 'tot', l: 'Compró en el año', n: 1, f: F.dinero },
      { k: 'fecha', l: 'Última compra', n: 1, f: v => F.fecha(v) }, { k: 'dias', l: 'Días sin comprar', n: 1, f: v => '<span class="etq ' + (v > 90 ? 'etq-r' : 'etq-a') + '">' + v + ' días</span>' }],
    filas: it.map(x => ({ nombre: x.nombre, tot: x.tot, fecha: c.offAFecha(x.ult), dias: x.dias })), orden: ['tot', -1], buscarTexto: 'Buscar cliente',
    vacio: 'Todos los clientes de la selección compraron en los últimos 45 días.' });
  }
  function grafPareto(c, ch) {
    const g = c.agrupar('cli', { sumas: ['neto'] }), vs = Array.from(g.neto).filter(v => v > 0).sort((a, b) => b - a), tot = vs.reduce((a, b) => a + b, 0);
    if (!vs.length) { KIT.vacio(ch); return; }
    let acc = 0, n80 = 0; const cum = vs.map((v, i) => { acc += v; const p = acc / tot * 100; if (p <= 80) n80 = i + 1; return p; });
    const paso = Math.max(1, Math.ceil(vs.length / 150)), pts = [];
    for (let i = 0; i < vs.length; i += paso) pts.push([i + 1, +cum[i].toFixed(1)]);
    pts.push([vs.length, 100]);
    ch.setOption({ grid: KIT.rejilla({ bottom: 40 }), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, formatter: ps => 'Los primeros ' + F.entero(ps[0].value[0]) + ' clientes<br>hacen el ' + F.pct(ps[0].value[1]) + ' de la venta' }),
      xAxis: { type: 'value', min: 0, max: vs.length, name: 'clientes, del que más compra al que menos', nameLocation: 'middle', nameGap: 26,
        nameTextStyle: { fontSize: KIT.fs(10), color: '#4A5270' }, axisLabel: { fontSize: KIT.fs(10), color: '#4A5270', formatter: v => F.entero(v) }, splitLine: { show: false } },
      yAxis: KIT.ejeVal(v => v + ' %', { max: 100 }),
      series: [{ type: 'line', data: pts, symbol: 'none', smooth: true, lineStyle: { color: SERIE, width: 2.5 }, areaStyle: { color: 'rgba(36,32,91,.08)' },
        markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#6B7390' }, label: { fontSize: KIT.fs(10), color: '#4A5270', position: 'insideEndBottom',
          formatter: F.entero(n80 + 1) + ' de ' + F.entero(vs.length) + ' clientes hacen el 80 %' }, data: [{ yAxis: 80 }] } }] }, true);
  }

  /* ---- Productos y marcas ------------------------------------------------------ */
  function grafGruposMes(c, ch) {
    const g = c.agrupar('grupo', { sumas: ['neto'] }), x = c.M.cruzar(c.sel, 'grupo', 'mes', 'neto'), idx = [];
    for (let a = 0; a < g.filas.length; a++) if (g.filas[a] && Math.abs(g.neto[a]) > 1) idx.push(a);
    idx.sort((p, q) => g.neto[q] - g.neto[p]);
    if (!idx.length) { KIT.vacio(ch); return; }
    ch.setOption({ grid: KIT.rejilla({ bottom: 40 }), legend: KIT.leyenda(), tooltip: KIT.tooltip({ valueFormatter: F.dinero }), color: PAL,
      xAxis: KIT.ejeCat(c.dims.mesLabels), yAxis: KIT.ejeVal(),
      series: idx.map(a => ({ name: c.dims.grupo[a], type: 'bar', stack: 'g', barMaxWidth: 38, data: Array.from(x.fila(a)).map(Math.round) })) }, true);
  }
  function anilloGrupo(c, ch) {
    const r = c.ranking('grupo', c.dims.grupo, 'neto').filter(x => x.v > 0.5);
    KIT.anillo(ch, r.map(x => ({ name: x.nombre, value: Math.round(x.v) })), { clic: n => GIP.alternar('grupo', n) });
  }
  function grafProductos(c, ch) {
    const met = (GIP.S.tablas.prodMet || 'neto'), g = c.agrupar('prod', { sumas: ['neto', 'cant'] }), p = [];
    for (let i = 0; i < g.filas.length; i++) if (g.filas[i] && g[met][i] > 0) p.push([c.dims.prod[i], g[met][i], { neto: g.neto[i], cant: g.cant[i] }]);
    p.sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p.slice(0, 500), { izq: 240, izqMob: 120, trunc: 34, color: met === 'neto' ? SERIE : '#17a39a',
      fmt: met === 'neto' ? F.dinero : v => F.entero(v) + ' unidades', axf: met === 'neto' ? F.corto : v => F.entero(v),
      tip: q => F.dinero(q[2].neto) + '<br>' + F.entero(q[2].cant) + ' unidades', clic: q => GIP.alternar('prod', q[0]) });
  }
  const DIM_TABLA = { marca: ['marca', 'Marca'], familia: ['familia', 'Familia'], prod: ['prod', 'Producto'], grupo: ['grupo', 'Grupo'], sector: ['sector', 'Zona'], estado: ['estado', 'Estado'] };
  function tablaConSelector(c, host, clave, opciones, def) {
    const v = GIP.S.tablas[clave] || def, [col, lab] = DIM_TABLA[v];
    host.innerHTML = '<div class="tabla-acc">' + '<div class="selector" role="group" aria-label="Agrupar la tabla por">' + opciones.map(o => '<button type="button" data-accion="'
      + clave + '" data-v="' + o + '" aria-pressed="' + (o === v) + '">' + DIM_TABLA[o][1] + '</button>').join('') + '</div></div><div id="' + clave + '-t"></div>';
    tablaEntidad(c, document.getElementById(clave + '-t'), col, c.dims[col], lab, col);
  }

  /* ---- Zonas ---------------------------------------------------------------- */
  let mapaListo = false;
  function grafMapa(c, ch) {
    const geo = GIP.S.extra.geo;
    if (!geo || !geo.features || !geo.features.length) { KIT.vacio(ch, 'Mapa no disponible'); return; }
    if (!mapaListo) { echarts.registerMap('VE', geo); mapaListo = true; }
    const nombreGeo = {}; geo.features.forEach(f => { nombreGeo[vnorm(f.properties.name)] = f.properties.name; });
    const g = c.agrupar('estado', { sumas: ['neto'] }), datos = [];
    for (let i = 0; i < g.filas.length; i++) if (g.filas[i]) datos.push({ name: nombreGeo[vnorm(c.dims.estado[i])] || c.dims.estado[i], value: Math.round(g.neto[i]), i });
    const mx = Math.max(1, ...datos.map(d => d.value)), vista = encuadre(geo, new Set(datos.map(d => d.name)));
    ch.setOption({ tooltip: { trigger: 'item', confine: true, formatter: p => '<b>' + esc(p.name) + '</b><br>' + (p.value ? F.dinero(p.value) : 'sin ventas') },
      visualMap: { left: 8, bottom: 12, min: 0, max: mx, text: [F.corto(mx), '$0'], calculable: false, itemWidth: 10, itemHeight: 90,
        inRange: { color: ['#EEF0F6', '#9AA0C4', '#5b6aa0', SERIE] }, textStyle: { fontSize: KIT.fs(10), color: '#4A5270' } },
      series: [{ type: 'map', map: 'VE', roam: true, nameProperty: 'name', data: datos, scaleLimit: { min: 1, max: 12 }, center: vista.centro, zoom: vista.zoom,
        label: { show: true, fontSize: KIT.fs(9), color: '#24205b', textBorderColor: '#fff', textBorderWidth: 2.5, formatter: p => p.value && !isNaN(p.value) ? p.name + '\n' + F.corto(p.value) : '' },
        itemStyle: { borderColor: '#fff', borderWidth: 1, areaColor: '#F5F6FA' }, emphasis: { label: { show: true }, itemStyle: { areaColor: '#FFB59E' } } }] }, true);
    ch.off('click');
    ch.on('click', p => { const d = datos.find(x => x.name === p.name); if (d) GIP.alternar('estado', d.i); });
  }

  /* Centro y zoom que encuadran los estados con venta (hoy, todos al occidente):
     sin esto el pais entero deja los estados con datos diminutos.            */
  function encuadre(geo, nombres) {
    const caja = (fs) => { let a = 180, b = -180, c = 90, d = -90;
      const rec = x => { if (typeof x[0] === 'number') { a = Math.min(a, x[0]); b = Math.max(b, x[0]); c = Math.min(c, x[1]); d = Math.max(d, x[1]); } else x.forEach(rec); };
      fs.forEach(f => rec(f.geometry.coordinates)); return [a, b, c, d]; };
    const todo = caja(geo.features), sel = geo.features.filter(f => nombres.has(f.properties.name));
    if (!sel.length) return { centro: undefined, zoom: 1 };
    const [a, b, c, d] = caja(sel);
    const z = Math.min((todo[1] - todo[0]) / (b - a || 1), (todo[3] - todo[2]) / (d - c || 1)) * 0.85;
    return { centro: [(a + b) / 2, (c + d) / 2], zoom: Math.max(1, Math.min(6, z)) };
  }

  /* ---- Riesgo y recuperados (Excel de Drive) ------------------------------------ */
  function htmlRiesgo(c, host) {
    const RL = c.P.riskList, st = GIP.S.tablas.rl || (GIP.S.tablas.rl = { hoja: RL.order[0] });
    if (!RL.sheets[st.hoja]) st.hoja = RL.order[0];
    const hoja = RL.sheets[st.hoja], foco = focoVendedor(c);
    let h = '<div class="tabla-acc"><div class="selector" role="group" aria-label="Hoja de la lista">' + RL.order.map(n => '<button type="button" data-accion="rlHoja" data-v="'
      + esc(n) + '" aria-pressed="' + (n === st.hoja) + '">' + esc(n.replace(/^[^\wÁÉÍÓÚÑáéíóúñ]+/, '')) + '</button>').join('') + '</div>'
      + (descargable(c, 'list') ? '<button class="btn btn-sec" type="button" data-accion="bajar" data-v="list">Descargar el Excel</button>' : '') + '</div>';
    if (hoja.blocks) {
      host.innerHTML = h + '<div class="doc"><p><b>' + esc(hoja.title) + '</b></p>' + (hoja.sub ? '<p>' + esc(hoja.sub) + '</p>' : '') + hoja.blocks.map(bloque).join('') + '</div>';
      return;
    }
    const iv = hoja.headers.findIndex(x => /vendedor/i.test(x));
    const filas = hoja.rows.filter(r => !foco || iv < 0 || vnorm(r[iv]) === vnorm(foco)).map(r => Object.fromEntries(hoja.headers.map((k, i) => ['c' + i, r[i]])));
    host.innerHTML = h + '<p class="pista">' + esc(hoja.title) + (foco && iv >= 0 ? '. Solo los de ' + esc(foco) + '.' : '') + '</p><div id="rl-t"></div>';
    KIT.tabla(document.getElementById('rl-t'), { cols: hoja.headers.map((k, i) => ({ k: 'c' + i, l: k, n: /^[\s$\d.,%-]+$/.test(String(hoja.rows[0] && hoja.rows[0][i] || '')) ? 1 : 0 })),
      filas, orden: ['c0', 1], buscarTexto: 'Buscar cliente, vendedor o zona' });
  }
  function bloque(b) {
    if (b.k === 'head') return '<h4>' + esc(b.t) + '</h4>';
    if (b.k === 'text') return '<p>' + esc(b.t) + '</p>';
    if (b.k === 'kpis') return '<div class="kpis-doc">' + b.rows[0].map((l, i) => '<div><span>' + esc(l) + '</span><b>' + esc(b.rows[1][i] || '') + '</b></div>').join('') + '</div>';
    if (b.k === 'pairs') return '<table><tbody>' + b.rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td class="num">' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>';
    return '<table><thead><tr>' + b.rows[0].map(x => '<th>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>'
      + b.rows.slice(1).map(r => '<tr>' + r.map(x => '<td>' + esc(x) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }
  function focoVendedor(c) { const f = GIP.S.f.vend; return f && f.size === 1 ? c.dims.vend[[...f][0]] : null; }
  const descargable = (c, k) => !c.reunion && ((c.P.driveLinks || {})[k] || c.P[k === 'list' ? 'listDocx' : 'execDocx']);
  function bajar(k, c) {
    const link = (c.P.driveLinks || {})[k];
    if (link) { window.open(link, '_blank', 'noopener'); return; }
    const b = c.P[k === 'list' ? 'listDocx' : 'execDocx']; if (!b) return;
    const bin = atob(b), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([arr]));
    a.download = k === 'list' ? 'Lista_Clientes_Riesgo_Recuperados.xlsx' : 'Informe_Ejecutivo_IP.docx'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---- Cobranza ------------------------------------------------------------------
     Universo propio (la cartera de las 3 analistas) y eje propio (la camada, mes
     de despacho): sus filtros son camada y analista, no los segmentadores de
     ventas. ANULADA nunca entra al universo cobrable. El Diferencial no es deuda.
     Dos tasas: % cobrado = Cobrado / Facturado neto (maduracion) y % efectividad
     = Cobrado / (Cobrado + Diferencial) (la columna "% Cobro" del Excel).        */
  const RC = { CAM: 0, VEND: 1, GRUPO: 2, PRECIO: 3, ANA: 4, EST: 5, FACT: 6, COB: 7, PEND: 8, DIF: 9, ANUL: 10 };
  const cobEstado = () => GIP.S.tablas.cob || (GIP.S.tablas.cob = { cam: new Set(), ana: new Set() });
  function cobFilas(c) {
    if (c._cob) return c._cob;
    const COB = c.P.Pcob, f = cobEstado(), foco = c.reunion ? focoVendedor(c) : null;
    const vi = foco ? COB.dims.vend.findIndex(v => vnorm(v) === vnorm(foco)) : -1;
    return (c._cob = COB.rows.filter(r => (!f.cam.size || f.cam.has(r[RC.CAM])) && (!f.ana.size || f.ana.has(r[RC.ANA])) && (!foco || r[RC.VEND] === vi)));
  }
  function cobSuma(c, rows, key) {
    const m = new Map(), anul = c.P.Pcob.anulIdx;
    rows.forEach(r => { let o = m.get(r[key]); if (!o) { o = { fact: 0, cob: 0, pend: 0, dif: 0, anul: 0, fac: 0 }; m.set(r[key], o); }
      o.fac++; o.anul += r[RC.ANUL]; if (r[RC.EST] === anul) return; o.fact += r[RC.FACT]; o.cob += r[RC.COB]; o.pend += r[RC.PEND]; o.dif += r[RC.DIF]; });
    return m;
  }
  function cobEje(c) {
    const COB = c.P.Pcob, f = cobEstado(), orden = COB.camadaOrder.filter(l => !f.cam.size || f.cam.has(COB.dims.camada.indexOf(l)));
    const por = cobSuma(c, cobFilas(c), RC.CAM), vacio = { fact: 0, cob: 0, pend: 0, dif: 0, anul: 0, fac: 0 };
    const at = l => por.get(COB.dims.camada.indexOf(l)) || vacio;
    return { orden, at, etq: orden.map(l => l === COB.camadaMax ? l + ' (en maduración)' : l), ult: COB.camadaMax };
  }
  function htmlCobCab(c, host) {
    const COB = c.P.Pcob, f = cobEstado(), e = cobEje(c), rows = cobFilas(c);
    const chips = (lab, acc, pares, set) => '<div class="tabla-acc"><span class="pista" style="margin:0">' + lab + '</span><div class="atajos">'
      + '<button type="button" data-accion="' + acc + '" data-v="-1" aria-pressed="' + !set.size + '">Todas</button>'
      + pares.map(p => '<button type="button" data-accion="' + acc + '" data-v="' + p[1] + '" aria-pressed="' + set.has(p[1]) + '">' + esc(p[0]) + '</button>').join('') + '</div></div>';
    const T0 = [...cobSuma(c, rows, RC.EST).values()].reduce((a, o) => { for (const k in a) a[k] += o[k]; return a; }, { fact: 0, cob: 0, pend: 0, dif: 0, anul: 0, fac: 0 });
    const cerradas = e.orden.filter(l => l !== e.ult);
    const dv = f2 => { if (cerradas.length < 2) return null; const a = e.at(cerradas[cerradas.length - 2]), b = e.at(cerradas[cerradas.length - 1]);
      const va = f2 === 'pct' ? (a.fact ? a.cob / a.fact * 100 : 0) : a[f2], vb = f2 === 'pct' ? (b.fact ? b.cob / b.fact * 100 : 0) : b[f2];
      return { v: f2 === 'pct' ? vb - va : variacion(vb, va), pp: f2 === 'pct', inverso: f2 === 'pend', ref: cerradas[cerradas.length - 1] + ' vs ' + cerradas[cerradas.length - 2] }; };
    const efT = (T0.cob + T0.dif) ? T0.cob / (T0.cob + T0.dif) * 100 : 0;
    const k = [
      ['Cobrado (caja real)', F.dinero(T0.cob), F.entero(T0.fac) + ' facturas en ' + e.orden.length + ' camadas', dv('cob'),
        'Dinero que de verdad entró. La flecha compara las dos últimas camadas ya cerradas, nunca la que sigue madurando.'],
      ['% cobrado de lo despachado', F.pct(T0.fact ? T0.cob / T0.fact * 100 : 0), 'efectividad ' + F.pct(efT), dv('pct'),
        'Cobrado entre facturado neto. Baja mientras la camada madura. La efectividad (cobrado entre cobrado más diferencial) es el «% Cobro» del Excel.'],
      ['Pendiente real', F.dinero(T0.pend), 'anuladas aparte: ' + F.dinero(T0.anul), dv('pend'),
        'Facturas sin cancelar. No incluye anuladas, que no son deuda, ni el diferencial, que ya se cobró a otro precio.']];
    host.innerHTML = chips('Camada', 'cobCam', COB.camadaOrder.map(l => [l, COB.dims.camada.indexOf(l)]), f.cam)
      + chips('Analista', 'cobAna', COB.dims.analista.map((l, i) => [l, i]), f.ana)
      + '<div class="kpis" style="margin:12px 0 0;--kpi-cols:' + k.length + '">' + k.map((x, i) => '<div class="kpi' + (i === 0 ? ' primero' : '') + '"><div class="kpi-lab">' + esc(x[0])
        + ' <button class="info" type="button" data-tip="' + esc(x[4]) + '" aria-label="' + esc(x[4]) + '">' + GIP.ICO.info + '</button></div><div class="kpi-val">' + x[1]
        + '</div><div class="kpi-sub">' + esc(x[2]) + '</div>' + (x[3] ? '<div class="kpi-delta">' + GIP.delta(x[3]) + '</div>' : '') + '</div>').join('') + '</div>'
      + (descargable(c, 'cob') ? '<p style="margin-top:12px"><button class="btn btn-sec" type="button" data-accion="bajar" data-v="cob">Descargar el Excel de conciliación</button></p>' : '');
  }
  function grafCobDescomp(c, ch) {
    const e = cobEje(c), s = f => e.orden.map(l => Math.round(e.at(l)[f]));
    ch.setOption({ grid: KIT.rejilla({ bottom: 40 }), legend: KIT.leyenda({ data: ['Cobrado', 'Diferencial', 'Pendiente'] }),
      tooltip: KIT.tooltip({ formatter: ps => { const o = e.at(e.orden[ps[0].dataIndex]); return '<b>' + esc(e.etq[ps[0].dataIndex]) + '</b><br>'
        + ps.map(p => p.marker + p.seriesName + ': ' + F.dinero(p.value)).join('<br>') + '<br>Facturado neto: <b>' + F.dinero(o.fact) + '</b><br>Anuladas, aparte: ' + F.dinero(o.anul); } }),
      xAxis: KIT.ejeCat(e.etq, { axisLabel: { interval: 0, fontSize: KIT.fs(c.mob ? 9 : 11), color: '#4A5270' } }), yAxis: KIT.ejeVal(),
      series: [{ name: 'Cobrado', type: 'bar', stack: 'x', data: s('cob'), itemStyle: { color: POS }, barMaxWidth: 56 },
        { name: 'Diferencial', type: 'bar', stack: 'x', data: s('dif'), itemStyle: { color: '#3a8fc1' } },
        { name: 'Pendiente', type: 'bar', stack: 'x', data: s('pend'), itemStyle: { color: '#c08a12' },
          label: { show: !c.mob, position: 'top', fontSize: KIT.fs(10), color: SERIE, fontWeight: 600, formatter: p => F.corto(e.at(e.orden[p.dataIndex]).fact) } }] }, true);
  }
  function grafCobPct(c, ch) {
    const e = cobEje(c);
    const pc = e.orden.map(l => { const o = e.at(l); return o.fact ? +(o.cob / o.fact * 100).toFixed(1) : 0; });
    const pe = e.orden.map(l => { const o = e.at(l), b = o.cob + o.dif; return b ? +(o.cob / b * 100).toFixed(1) : 0; });
    ch.setOption({ grid: KIT.rejilla({ bottom: 44, top: 30 }), legend: KIT.leyenda({ data: ['% cobrado de la camada', '% efectividad'] }),
      tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, valueFormatter: v => F.pct(v) }),
      xAxis: KIT.ejeCat(e.orden.map(l => l.slice(0, 3)), { axisLabel: { interval: 0, fontSize: KIT.fs(c.mob ? 9 : 11), color: '#4A5270' } }), yAxis: KIT.ejeVal(v => v + ' %', { max: 100 }),
      series: [{ name: '% cobrado de la camada', type: 'line', data: pc, smooth: true, symbolSize: 9, lineStyle: { color: POS, width: 3 },
        itemStyle: { color: p => e.orden[p.dataIndex] === e.ult ? '#A7E0BB' : POS }, areaStyle: { color: 'rgba(21,128,61,.08)' },
        label: { show: true, position: 'top', fontSize: KIT.fs(10), color: SERIE, formatter: p => F.pct(p.value) } },
      { name: '% efectividad', type: 'line', data: pe, smooth: true, symbolSize: 7, lineStyle: { color: SERIE, width: 2, type: 'dashed' }, itemStyle: { color: SERIE } }] }, true);
  }
  function cobRanking(c, ch, key, nombres, campo, color) {
    const p = [...cobSuma(c, cobFilas(c), key).entries()].map(([i, o]) => [nombres[i], o[campo], o]).filter(x => x[1] > 0.5).sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p, { color, izq: 130, izqMob: 92, ventana: 10, tip: q => F.dinero(q[1]) + '<br>' + F.entero(q[2].fac) + ' facturas' });
  }
  function grafCobPrecio(c, ch) {
    const pl = c.P.Pcob.precioCob || [], tot = pl.reduce((a, o) => a + o.cob, 0);
    KIT.barrasH(ch, pl.map(o => [o.cat, o.cob, o]), { color: POS, izq: 150, izqMob: 100,
      tip: q => F.dinero(q[1]) + '<br>' + F.pct(tot ? q[1] / tot * 100 : 0) + ' de la caja, ' + F.entero(q[2].fac) + ' facturas cerradas' });
  }
  function tablaCob(c, host) {
    const e = cobEje(c), rows = cobFilas(c);
    const T0 = [...cobSuma(c, rows, RC.EST).values()].reduce((a, o) => { for (const k in a) a[k] += o[k]; return a; }, { fact: 0, cob: 0, pend: 0, dif: 0, anul: 0, fac: 0 });
    const pc = o => F.pct(o.fact ? o.cob / o.fact * 100 : 0), pe = o => F.pct((o.cob + o.dif) ? o.cob / (o.cob + o.dif) * 100 : 0);
    const fila = (lab, o, tag) => '<' + tag + '><td>' + esc(lab) + '</td>' + [F.dinero(o.fact), F.dinero(o.cob), F.dinero(o.dif), F.dinero(o.pend), pc(o), pe(o), F.dinero(o.anul), F.entero(o.fac)]
      .map(v => '<td class="num">' + v + '</td>').join('') + '</' + tag + '>';
    const ejeFac = e.orden.reduce((a, l) => a + e.at(l).fac, 0), ejeAnul = e.orden.reduce((a, l) => a + e.at(l).anul, 0);
    host.innerHTML = '<div class="envoltura"><table><thead><tr><th>Camada (mes de despacho)</th><th class="num">Facturado neto</th><th class="num">Cobrado</th><th class="num">Diferencial</th>'
      + '<th class="num">Pendiente</th><th class="num">% cobrado</th><th class="num">% efectividad</th><th class="num">Anuladas</th><th class="num">Facturas</th></tr></thead><tbody>'
      + e.orden.map((l, i) => fila(e.etq[i], e.at(l), 'tr')).join('') + '</tbody><tfoot>' + fila('Total', T0, 'tr') + '</tfoot></table></div>'
      + (T0.fac > ejeFac ? '<p class="notas">El total incluye ' + F.entero(T0.fac - ejeFac) + ' factura(s) anulada(s) por ' + F.dinero(T0.anul - ejeAnul)
        + ' sin fecha de despacho: no pertenecen a ninguna camada. La hoja POR CAMADA del Excel hace lo mismo.</p>' : '');
  }
  function grafComisiones(c, ch) {
    const com = c.P.Pcob.comisiones || [], bs = (c.P.Pcob.comMoneda || '') === 'Bs';
    KIT.barrasH(ch, com.map(o => [o.vend, o.com, o]), { color: ENFASIS, izq: 120, izqMob: 88, ventana: 10, fmt: bs ? F.bs : v => coma2(v) + ' $-equiv.', axf: bs ? F.bsCorto : F.corto,
      tip: q => 'Comisión: <b>' + (bs ? F.bs(q[1]) : coma2(q[1]) + ' $-equiv.') + '</b>' + (q[2].fac ? '<br>' + F.entero(q[2].fac) + ' facturas' : '') });
  }
  const coma2 = v => v.toFixed(2).replace('.', ',');
  function grafCobertura(c, ch) {
    const cov = (c.P.Pcob.cobertura || []).filter(x => !x.total);
    KIT.anillo(ch, cov.map(x => ({ name: x.cat, value: Math.round(x.monto) })), { colores: [POS, SERIE, '#c08a12', NEG, '#5b6aa0'] });
  }
  /* Cafe La Protectora: maestro propio, fuera del MAESTRO regular desde el corte 8
     (flag cafeDentro). No responde a los filtros de camada ni analista.      */
  const cafe = c => c.P.Pcob && c.P.Pcob.cafe && c.P.Pcob.cafe.mes && c.P.Pcob.cafe.mes.length ? c.P.Pcob.cafe : null;
  function htmlCafe(c, host) {
    const C = cafe(c), T0 = C.tot, pc = T0.neto ? T0.cob / T0.neto * 100 : 0;
    const k = [['Facturado neto del café', F.dinero(T0.neto), F.entero(T0.fac) + ' facturas'],
      ['Cobrado del café', F.dinero(T0.cob), F.pct(pc) + ' del neto, ' + F.entero(T0.facCerr) + ' facturas cerradas'],
      ['Pendiente del café', F.dinero(T0.pend), F.entero(T0.facPend) + ' facturas; anuladas aparte: ' + F.dinero(T0.anul)]];
    if (C.com && C.com.length) k.push(['Comisiones del café', F.bs(T0.comVend + T0.comSuper), 'vendedor ' + F.bs(T0.comVend) + ', supervisor ' + F.bs(T0.comSuper)]);
    host.innerHTML = '<p class="pista">' + (c.P.Pcob.cafeDentro
      ? 'Estas cifras ya están dentro de los totales de arriba (grupo CAFÉ): esta parte es el detalle.'
      : 'Desde el corte 8 el café no vive dentro de la conciliación regular: los totales de arriba no lo incluyen y estas cifras van aparte.') + '</p>'
      + '<div class="kpis" style="margin:8px 0 0;--kpi-cols:' + k.length + '">' + k.map((x, i) => '<div class="kpi' + (i === 0 ? ' primero' : '') + '"><div class="kpi-lab">' + esc(x[0]) + '</div><div class="kpi-val">' + x[1]
        + '</div><div class="kpi-sub">' + esc(x[2]) + '</div></div>').join('') + '</div>';
  }
  function grafCafMes(c, ch) {
    const M = cafe(c).mes, ult = M[M.length - 1].k, lab = M.map(o => cap(o.k.toLowerCase()) + (o.k === ult ? ' (en maduración)' : ''));
    const s = (n, f, col) => ({ name: n, type: 'bar', barMaxWidth: 44, data: M.map(o => Math.round(o[f])), itemStyle: { color: col, borderRadius: [4, 4, 0, 0] } });
    ch.setOption({ grid: KIT.rejilla({ bottom: 40 }), legend: KIT.leyenda(), xAxis: KIT.ejeCat(lab), yAxis: KIT.ejeVal(),
      tooltip: KIT.tooltip({ formatter: ps => { const o = M[ps[0].dataIndex]; return '<b>' + esc(lab[ps[0].dataIndex]) + '</b><br>' + ps.map(p => p.marker + p.seriesName + ': ' + F.dinero(p.value)).join('<br>')
        + '<br>Diferencial: ' + F.dinero(o.dif) + '<br>Anuladas, aparte: ' + F.dinero(o.anul) + ', ' + F.entero(o.fac) + ' facturas'; } }),
      series: [s('Facturado neto', 'fact', SERIE), s('Cobrado', 'cob', POS), s('Pendiente', 'pend', '#c08a12')] }, true);
  }
  function grafCafEstado(c, ch) {
    const T0 = cafe(c).tot;
    KIT.anillo(ch, [{ name: 'Cerrado (ya cobrado)', value: Math.round(T0.montoCerr) }, { name: 'Pendiente', value: Math.round(T0.pend) },
      { name: 'Anulado (fuera de lo cobrable)', value: Math.round(T0.anul) }], { colores: [POS, '#c08a12', NEG] });
  }
  function grafCafVend(c, ch) {
    const v = (cafe(c).vend || []).filter(o => o.cob > 0.5);
    KIT.barrasH(ch, v.map(o => [o.k, o.cob, o]), { color: POS, izq: 120, izqMob: 92, ventana: 10, tip: q => 'Cobrado: ' + F.dinero(q[1]) + '<br>Pendiente: ' + F.dinero(q[2].pend) + '<br>' + F.entero(q[2].fac) + ' facturas' });
  }
  function grafCafCom(c, ch) {
    const cm = cafe(c).com;
    ch.setOption({ grid: KIT.rejilla({ bottom: 40, left: 8 }), legend: KIT.leyenda({ data: ['Vendedor', 'Supervisor'] }), tooltip: KIT.tooltip({ valueFormatter: F.bs }),
      xAxis: KIT.ejeVal(F.bsCorto), yAxis: KIT.ejeCat(cm.map(o => o.vend), { inverse: true }),
      series: [{ name: 'Vendedor', type: 'bar', data: cm.map(o => Math.round(o.vbs)), itemStyle: { color: ENFASIS } },
        { name: 'Supervisor', type: 'bar', data: cm.map(o => Math.round(o.sbs)), itemStyle: { color: '#17a39a' } }] }, true);
  }

  /* ---- Comparar periodos (respeta los segmentadores) --------------------------- */
  function comparar(c) {
    const st = GIP.S.tablas.comp || (GIP.S.tablas.comp = (() => {
      const [ma, mb] = GIP.rangoMes(c.P.dayCount - 1), [pa, pb] = ma > 0 ? GIP.rangoMes(ma - 1) : [0, 0];
      return { A: [pa, pb], B: [ma, mb] }; })());
    const f = {}; for (const k in GIP.S.f) if (GIP.S.f[k].size) f[k] = GIP.S.f[k];
    const tot = r => c.M.total(c.M.seleccion({ f, rango: r }), { sumas: ['neto', 'cant'], distintos: ['doc', 'cli', 'prod'] });
    return { st, A: tot(st.A), B: tot(st.B) };
  }
  function htmlComparar(c, host) {
    const { st, A, B } = comparar(c), fd = o => c.offAFecha(o);
    const m = [['Venta neta', 'neto', F.dinero], ['Facturas', 'doc', F.entero], ['Clientes', 'cli', F.entero], ['Ticket promedio', 'tk', F.dinero], ['Unidades', 'cant', F.entero], ['Productos', 'prod', F.entero]];
    A.tk = A.doc ? A.neto / A.doc : 0; B.tk = B.doc ? B.neto / B.doc : 0;
    host.innerHTML = '<div class="tabla-acc"><label class="pista" style="margin:0">Período A <input type="date" id="cA0" value="' + fd(st.A[0]) + '"> a <input type="date" id="cA1" value="' + fd(st.A[1]) + '"></label>'
      + '<label class="pista" style="margin:0">Período B <input type="date" id="cB0" value="' + fd(st.B[0]) + '"> a <input type="date" id="cB1" value="' + fd(st.B[1]) + '"></label>'
      + '<button class="btn btn-pri" type="button" data-accion="comparar">Comparar</button></div>'
      + '<div class="envoltura"><table><thead><tr><th>Indicador</th><th class="num">A</th><th class="num">B</th><th class="num">B frente a A</th></tr></thead><tbody>'
      + m.map(x => { const v = variacion(B[x[1]], A[x[1]]); return '<tr><td>' + x[0] + '</td><td class="num">' + x[2](A[x[1]]) + '</td><td class="num">' + x[2](B[x[1]])
        + '</td><td class="num">' + GIP.delta({ v }) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      + '<p class="notas">Respeta los segmentadores elegidos arriba; las fechas se eligen aquí.</p>';
    host.querySelectorAll('input[type=date]').forEach(i => { i.min = c.P.dayZero; i.max = c.offAFecha(c.P.dayCount - 1); });
  }
  function grafComparar(c, ch) {
    const { A, B } = comparar(c);
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ valueFormatter: F.dinero }), xAxis: KIT.ejeCat(['Período A', 'Período B']), yAxis: KIT.ejeVal(),
      series: [{ type: 'bar', barMaxWidth: 90, data: [{ value: Math.round(A.neto), itemStyle: { color: '#9AA0C4' } }, { value: Math.round(B.neto), itemStyle: { color: SERIE } }],
        label: { show: true, position: 'top', formatter: p => F.dinero(p.value), fontSize: KIT.fs(11), color: SERIE } }] }, true);
  }

  /* ---- Informe del corte ------------------------------------------------------- */
  function htmlInforme(c, host) {
    const ex = c.P.exec || { html: '' };
    host.innerHTML = (descargable(c, 'exec') ? '<p style="margin-bottom:12px"><button class="btn btn-pri" type="button" data-accion="bajar" data-v="exec">Descargar el informe (Word)</button></p>' : '')
      + '<div class="doc">' + (ex.html || '<p class="vacio">El corte no trae informe.</p>') + '</div>'
      + '<p class="notas">' + (ex.fuente === 'word' ? 'Resumen del Word cargado en Drive.' : 'Resumen generado por el sistema: no había Word en Drive.')
      + ' El informe excluye el café AMÉRICO y a REVIPLAS; el dashboard los incluye, por eso los totales no coinciden.</p>';
  }

  /* ---- Registro --------------------------------------------------------------- */
  const g = (id, titulo, pista, tip, render, o) => Object.assign({ id, tipo: 'g', titulo, pista, tip, render }, o || {});
  const h = (id, titulo, pista, tip, render, o) => Object.assign({ id, tipo: 'html', titulo, pista, tip, render }, o || {});
  const lectRanking = (c, col, nombres, que) => {
    const r = c.ranking(col, nombres, 'neto'), tot = r.reduce((a, x) => a + x.v, 0);
    if (!r.length || !tot) return 'No hay ventas en esta selección.';
    const top3 = r.slice(0, 3).reduce((a, x) => a + x.v, 0);
    return '<b>' + esc(r[0].nombre) + '</b> lleva el ' + F.pct(r[0].v / tot * 100) + ' de la venta. De ' + F.entero(r.length) + ' ' + que
      + ' con venta en la selección, los tres primeros hacen el ' + F.pct(top3 / tot * 100) + '.';
  };

  GIP.registrar({
    tema: { serie: SERIE, enfasis: ENFASIS, paleta: PAL, calor: ['#FFE6DC', '#FF9C78', '#FF4F20', '#24205B'], tinta: '#24205b', tinta2: '#4A5270' },
    segmentadores, kpis, reunionFoco: 'vend',
    pasos: [{ t: 'Cómo vamos', secciones: ['inicio', 'tend'] }, { t: 'Qué lo mueve', secciones: ['vend', 'cli', 'prod', 'zona'] },
      { t: 'Qué atender', secciones: ['riesgo', 'cob'] }, { t: 'Herramientas', secciones: ['comp', 'informe', 'novedades'] }],
    agendaReunion: ['inicio', 'vend', 'cli', 'riesgo', 'prod', 'zona', 'cob'],
    acciones: {
      prodMet: v => { GIP.S.tablas.prodMet = v; },
      tProd: v => { GIP.S.tablas.tProd = v; }, tZona: v => { GIP.S.tablas.tZona = v; },
      rlHoja: v => { GIP.S.tablas.rl.hoja = v; },
      cobCam: v => { const s = cobEstado().cam; +v < 0 ? s.clear() : (s.has(+v) ? s.delete(+v) : s.add(+v)); },
      cobAna: v => { const s = cobEstado().ana; +v < 0 ? s.clear() : (s.has(+v) ? s.delete(+v) : s.add(+v)); },
      bajar: (v, c) => bajar(v, c),
      comparar: (v, c) => { const o = id => c.fechaAOff(document.getElementById(id).value), st = GIP.S.tablas.comp;
        const r = (a, b) => [Math.max(0, Math.min(a, b)), Math.min(c.P.dayCount - 1, Math.max(a, b))];
        if (![o('cA0'), o('cA1'), o('cB0'), o('cB1')].some(isNaN)) { st.A = r(o('cA0'), o('cA1')); st.B = r(o('cB0'), o('cB1')); } },
    },
    secciones: {
      inicio: { nav: 'Inicio', titular, kpis: true, reunion: true, bandas: [
        { tarjetas: [g('c-trend', 'Venta mensual y hacia dónde va', 'Barras: lo real; la barra clara es el mes a medias. Línea: la proyección hasta diciembre.',
          'Venta neta real por mes y proyección lineal hasta diciembre. El mes a medias se estima a cierre antes de proyectar.', (c, el, ch) => grafTendencia(c, ch, false), { sensible: true })] },
        { tarjetas: [h('motores', 'Qué lo explica', 'Quién empujó y quién frenó el último mes.', 'Diferencia en dólares entre el último mes (estimado a cierre si va a medias) y el anterior.', htmlMotores)] },
        { tarjetas: [h('alertas', 'Qué atender', 'Calculado sobre la selección. Cada alerta lleva a su sección.', null, htmlAlertas)] }] },
      tend: { nav: 'Tendencia', pregunta: '¿Hacia dónde va la venta del año?', reunion: false,
        lectura: c => { const mo = mensual(c), pj = proy(c, mo), real = mo.neto.reduce((a, b) => a + b, 0), ano = pj.proj.reduce((a, b) => a + b, 0);
          return 'Llevamos <b>' + F.dinero(real) + '</b>. Con la tendencia de los meses cerrados el año cerraría en <b>' + F.dinero(ano) + '</b>' + (pj.partial ? ', con el mes en curso estimado a cierre.' : '.'); },
        bandas: [
          { tarjetas: [g('c-proj', 'Proyección de la venta neta', 'Zona sombreada: meses estimados.', 'Regresión lineal sobre los meses reales; el mes a medias se escala a cierre.', (c, el, ch) => grafTendencia(c, ch, true), { alto: 'lg' })] },
          { cols: '2', tarjetas: [
            g('c-mom', 'Crecimiento frente al mes anterior', 'Variación de la venta neta de cada mes.', 'Cuánto sube o baja cada mes frente al anterior. El mes a medias va estimado a cierre.', (c, el, ch) => grafMoM(c, ch), { alto: 'sm' }),
            g('c-cum', 'Venta acumulada', 'Suma mes a mes del período.', 'Venta neta acumulada a lo largo del año.', (c, el, ch) => grafAcumulado(c, ch), { alto: 'sm' })] },
          { cols: '2', tarjetas: [
            h('t-proj', 'Detalle por mes', 'Real, proyectado y cierre estimado del año.', null, tablaProyeccion),
            g('c-units', 'Unidades y ticket promedio', 'Barras: unidades. Línea: ticket.', 'Unidades vendidas por mes y venta promedio por factura.', (c, el, ch) => grafUnidades(c, ch))] },
          { tarjetas: [g('c-cal', 'Venta por día', 'Cada celda es un día; el color es la venta neta.', 'Calendario de venta neta diaria. Respeta los filtros.', (c, el, ch) => grafCalendario(c, ch, el), { alto: 'xs' })] }] },
      vend: { nav: 'Vendedores', pregunta: '¿Quién empuja la venta y quién se queda atrás?', reunion: true,
        lectura: c => lectRanking(c, 'vend', c.dims.vend, 'vendedores'),
        bandas: [
          { cols: '2', tarjetas: [
            g('c-vendrank', 'Ranking de vendedores', 'Venta neta. Clic en una barra para filtrar.', 'Venta neta de cada vendedor en la selección. Clic para filtrar por ese vendedor.', (c, el, ch) => ranking(c, ch, 'vend', c.dims.vend, { izq: 120, izqMob: 92 }), { alto: 'lg' }),
            g('c-vendvar', 'Cambio frente al mes anterior', c => { const u = ultimoMes(c, mensual(c)); return u.L < 1 ? '' : cap(u.nombre) + (u.parcial ? ' estimado a cierre' : '') + ' contra ' + u.nombrePrev + '.'; },
              'Variación de la venta de cada vendedor entre el último mes y el anterior. Solo vendedores con al menos $5.000 el mes anterior: con bases chicas el porcentaje engaña.', (c, el, ch) => grafVariacionVend(c, ch), { alto: 'lg' })] },
          { tarjetas: [g('c-vendcmp', 'Trayectoria de los seis que más venden', 'Venta neta mes a mes.', 'Venta neta mensual de los 6 vendedores con más venta en la selección.', (c, el, ch) => trayectorias(c, ch, 'vend', c.dims.vend), { alto: 'lg' })] },
          { tarjetas: [h('t-vend', 'Tabla de vendedores', 'Clic en un nombre para filtrar.', null, (c, el) => tablaEntidad(c, el, 'vend', c.dims.vend, 'Vendedor', 'vend'))] }] },
      cli: { nav: 'Clientes', pregunta: '¿Quién compra y a quién hay que llamar?', reunion: true,
        lectura: c => { const r = c.ranking('cli', c.dims.cli, 'neto'), tot = r.reduce((a, x) => a + x.v, 0); let acc = 0, n = 0; for (const x of r) { acc += x.v; n++; if (acc >= tot * .8) break; }
          return r.length ? '<b>' + F.entero(n) + ' de ' + F.entero(r.length) + ' clientes</b> hacen el 80 % de la venta. ' + F.entero(inactivos(c).length) + ' llevan más de 45 días sin comprar.' : 'No hay ventas en esta selección.'; },
        bandas: [
          { tarjetas: [h('t-inact', 'Clientes sin comprar hace más de 45 días', 'Ordenados por lo que compraron en el año. Respeta los segmentadores, no las fechas.', 'Posible fuga: compraron antes y no han vuelto en 45 días, contados hasta la fecha del corte.', tablaInactivos)] },
          { cols: '2', tarjetas: [
            g('c-cli', 'Clientes que más compran', 'Desliza para ver más. Clic para filtrar.', 'Clientes ordenados por venta neta.', (c, el, ch) => ranking(c, ch, 'cli', c.dims.cli, { izq: 220, izqMob: 120, trunc: 30 }), { alto: 'lg' }),
            g('c-pareto', 'Concentración de clientes', 'Qué parte de la venta hacen los primeros clientes.', 'Curva acumulada: del cliente que más compra al que menos.', (c, el, ch) => grafPareto(c, ch), { alto: 'lg' })] },
          { tarjetas: [g('c-clicmp', 'Trayectoria de los seis clientes principales', 'Venta neta mes a mes.', 'Venta neta mensual de los 6 clientes con más compras en la selección.', (c, el, ch) => trayectorias(c, ch, 'cli', c.dims.cli), { alto: 'lg' })] },
          { tarjetas: [h('t-cli', 'Tabla de clientes', 'Clic en un nombre para filtrar.', null, (c, el) => tablaEntidad(c, el, 'cli', c.dims.cli, 'Cliente', 'cli'))] }] },
      prod: { nav: 'Productos y marcas', pregunta: '¿Qué se vende y qué marcas mueven el negocio?', reunion: true,
        lectura: c => lectRanking(c, 'marca', c.dims.marca, 'marcas'),
        bandas: [
          { cols: '21', tarjetas: [
            g('c-grupomes', 'Grupos mes a mes', 'Venta neta apilada por grupo.', 'Venta neta de cada grupo de producto, mes a mes.', (c, el, ch) => grafGruposMes(c, ch), { alto: 'lg' }),
            g('c-grupo', 'Peso de cada grupo', 'Clic en una porción para filtrar.', 'Parte de la venta neta de cada grupo de producto.', (c, el, ch) => anilloGrupo(c, ch), { alto: 'lg' })] },
          { cols: '2', tarjetas: [
            g('c-marca', 'Marcas', 'Venta neta. Clic para filtrar.', 'Marcas ordenadas por venta neta.', (c, el, ch) => ranking(c, ch, 'marca', c.dims.marca, { izq: 150, izqMob: 100 }), { alto: 'lg' }),
            g('c-prod', 'Productos', c => { const m = GIP.S.tablas.prodMet || 'neto';
              return '<span class="selector" role="group" aria-label="Ordenar productos por"><button type="button" data-accion="prodMet" data-v="neto" aria-pressed="' + (m === 'neto') + '">Por venta</button>'
                + '<button type="button" data-accion="prodMet" data-v="cant" aria-pressed="' + (m === 'cant') + '">Por unidades</button></span>'; },
              'Productos ordenados por venta neta o por unidades. Clic para filtrar.', (c, el, ch) => grafProductos(c, ch), { alto: 'lg' })] },
          { tarjetas: [g('c-marcacmp', 'Trayectoria de las seis marcas líderes', 'Venta neta mes a mes.', 'Venta neta mensual de las 6 marcas con más venta.', (c, el, ch) => trayectorias(c, ch, 'marca', c.dims.marca), { alto: 'lg' })] },
          { tarjetas: [h('t-prod', 'Tabla de productos y marcas', 'Elige cómo agrupar. Clic en un nombre para filtrar.', null, (c, el) => tablaConSelector(c, el, 'tProd', ['marca', 'familia', 'prod', 'grupo'], 'marca'))] }] },
      zona: { nav: 'Zonas', pregunta: '¿Dónde se vende?', reunion: true,
        lectura: c => lectRanking(c, 'estado', c.dims.estado, 'estados'),
        bandas: [
          { cols: '2', tarjetas: [
            g('c-mapa', 'Mapa por estado', 'Clic en un estado para filtrar. Rueda o pellizco para acercar.', 'Venta neta por estado. Clic para filtrar por ese estado.', (c, el, ch) => grafMapa(c, ch), { alto: 'xl' }),
            g('c-secrank', 'Ranking de zonas', 'Ciudad o sector. Clic para filtrar.', 'Zonas (ciudad, estado) ordenadas por venta neta.', (c, el, ch) => ranking(c, ch, 'sector', c.dims.sector, { izq: 200, izqMob: 120, trunc: 30 }), { alto: 'xl' })] },
          { tarjetas: [g('c-seccmp', 'Trayectoria de las seis zonas líderes', 'Venta neta mes a mes.', 'Venta neta mensual de las 6 zonas con más venta.', (c, el, ch) => trayectorias(c, ch, 'sector', c.dims.sector), { alto: 'lg' })] },
          { tarjetas: [h('t-zona', 'Tabla de zonas', 'Elige cómo agrupar. Clic en un nombre para filtrar.', null, (c, el) => tablaConSelector(c, el, 'tZona', ['sector', 'estado'], 'sector'))] }] },
      riesgo: { nav: 'Riesgo y recuperados', pregunta: '¿Qué clientes se están yendo y cuáles volvieron?', reunion: true, cuando: P => !!P.riskList,
        lectura: c => { const RL = c.P.riskList, n = re => { const k = RL.order.find(x => re.test(x)); return k ? RL.sheets[k].count : 0; };
          return 'Lista armada a mano para el corte ' + c.P.corte + ': <b>' + F.entero(n(/riesgo \(/i) || n(/en riesgo/i)) + ' clientes en riesgo</b> y <b>' + F.entero(n(/recuperados/i)) + ' recuperados</b> en el último mes.'; },
        bandas: [{ tarjetas: [h('rl', 'Lista de clientes en riesgo y recuperados', 'Elige la hoja y usa el buscador. En reunión, el enfoque en un vendedor filtra la lista.', null, htmlRiesgo)] }] },
      cob: { nav: 'Cobranza', pregunta: '¿Cuánto de lo despachado ya entró a caja?', reunion: true, cuando: P => !!P.Pcob,
        lectura: c => 'La <b>camada</b> es el mes de despacho de la factura, no el del cobro: se sigue cobrando durante meses. El <b>diferencial</b> no es deuda: es lo cobrado a otro precio o forma de pago.',
        bandas: [
          { tarjetas: [h('cob-cab', 'Conciliación de las 3 analistas', 'Filtra por camada y por analista. Las anuladas quedan fuera.', null, htmlCobCab)] },
          { tarjetas: [g('c-cob-descomp', 'Descomposición del facturado por camada', 'Cobrado + diferencial + pendiente = facturado neto.', 'Cada camada en sus tres partes. Suman exactamente el facturado neto.', (c, el, ch) => grafCobDescomp(c, ch), { alto: 'lg' })] },
          { cols: '2', tarjetas: [
            g('c-cob-pct', 'Las dos tasas de cobro', 'Verde: cuánto de la camada ya entró. Azul punteado: efectividad de lo ya cerrado.', 'La verde baja en la camada joven y sube con los meses: es normal. La azul es el «% Cobro» del Excel.', (c, el, ch) => grafCobPct(c, ch)),
            g('c-cob-vend', 'Cobrado por vendedor', 'Caja entrada en la selección.', 'Dinero cobrado por vendedor, según camada y analista elegidas.', (c, el, ch) => cobRanking(c, ch, RC.VEND, c.P.Pcob.dims.vend, 'cob', POS))] },
          { cols: '2', tarjetas: [
            g('c-cob-pend', 'Pendiente por vendedor', 'Cartera viva por cobrar, sin anuladas.', 'Facturas sin cancelar por vendedor. No incluye anuladas ni diferencial.', (c, el, ch) => cobRanking(c, ch, RC.VEND, c.P.Pcob.dims.vend, 'pend', '#c08a12')),
            g('c-cob-grupo', 'Cobrado por grupo', 'REPOSTERÍA incluye desechables y confitería.', 'Cobrado por grupo de producto.', (c, el, ch) => cobRanking(c, ch, RC.GRUPO, c.P.Pcob.dims.grupo, 'cob', '#17a39a'))] },
          { tarjetas: [g('c-cob-precio', 'Cobrado por lista de precio', 'Solo facturas cerradas y sin café. No responde a los filtros.', 'La caja que entró por cada precio de lista.', (c, el, ch) => grafCobPrecio(c, ch), { cuando: c => (c.P.Pcob.precioCob || []).length > 0 })] },
          { tarjetas: [h('t-cob', 'Detalle por camada', '% cobrado = cobrado ÷ facturado neto. % efectividad = cobrado ÷ (cobrado + diferencial).', null, tablaCob)] },
          { cols: '2', tarjetas: [
            g('c-cob-comis', 'Comisión por vendedor', c => (c.P.Pcob.comMoneda === 'Bs' ? 'En bolívares, la moneda en que se paga.' : 'En $-equivalente.') + ' No responde a los filtros.',
              'Comisión de la línea regular: 5 % repostería en Precio 1 y 2, 3 % el resto. El café se comisiona aparte, por bulto.', (c, el, ch) => grafComisiones(c, ch), { cuando: c => (c.P.Pcob.comisiones || []).length > 0 }),
            g('c-cob-cobertura', 'Cobertura sobre la facturación del sistema', 'Cuánto de lo facturado pasa por las 3 analistas. No responde a los filtros.', 'Reparto de la facturación total entre la cartera de las analistas y lo que va fuera.',
              (c, el, ch) => grafCobertura(c, ch), { cuando: c => (c.P.Pcob.cobertura || []).filter(x => !x.total).length > 0, sensible: true })] },
          { tarjetas: [h('caf', 'Café La Protectora', 'Lo consolida Jesiely desde julio. No responde a los filtros de camada ni analista.', null, htmlCafe, { cuando: c => !!cafe(c) })] },
          { cols: '2', tarjetas: [
            g('c-caf-mes', 'Café: cobrado frente a facturado', 'La camada más joven sigue madurando.', 'Café mes a mes. El facturado es neto: las anuladas van aparte.', (c, el, ch) => grafCafMes(c, ch), { cuando: c => !!cafe(c) }),
            g('c-caf-estado', 'Café: estado de las facturas', 'Cerradas, pendientes y anuladas.', 'Reparto del facturado del café por estado.', (c, el, ch) => grafCafEstado(c, ch), { cuando: c => !!cafe(c) })] },
          { cols: '2', tarjetas: [
            g('c-caf-vend', 'Café: cobrado por vendedor', 'Caja entrada en café.', 'Cobrado del café por vendedor.', (c, el, ch) => grafCafVend(c, ch), { cuando: c => !!cafe(c) }),
            g('c-caf-com', 'Café: comisión vendedor y supervisor', 'Por bulto, en bolívares.', 'Vendedor $0,50 por bulto en Precio 1 y 2 y $0,40 en el resto; supervisor $0,20. Se paga en bolívares.', (c, el, ch) => grafCafCom(c, ch), { cuando: c => !!(cafe(c) && cafe(c).com && cafe(c).com.length) })] }] },
      comp: { nav: 'Comparar períodos', pregunta: '¿Cómo le fue a un período frente a otro?', reunion: false,
        lectura: () => 'Elige dos rangos de fechas. Por defecto, el mes del corte contra el anterior.',
        bandas: [{ cols: '21', tarjetas: [h('comp', 'Indicadores de A y B', 'Respeta los segmentadores.', null, htmlComparar),
          g('c-cmp', 'Venta neta de A y B', 'Mismos filtros, distinto período.', 'Venta neta de cada período.', (c, el, ch) => grafComparar(c, ch))] }] },
      informe: { nav: 'Informe del corte', pregunta: '¿Qué dice el informe de este corte?', reunion: false,
        lectura: c => 'Informe ejecutivo del corte ' + c.P.corte + '.',
        bandas: [{ tarjetas: [h('exec', 'Informe ejecutivo', 'Resumen del documento. El completo se descarga en Word.', null, htmlInforme)] }] },
      novedades: GIP.seccionNovedades,
    },
  });
})(window);
