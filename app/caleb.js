/* Tiendas Caleb: secciones del dashboard sobre el nucleo. Reglas de calculo en
   CONTEXTO_CALEB.md: venta neta = (cantidad - devuelto) x precio final; margen
   solo sobre ventas con precio y costo registrado; las salidas a precio $0 van
   aparte; los flujos se comparan POR DIA DE VENTA (la tienda cierra domingo). */
(function (G) {
  'use strict';
  const GIP = G.GIP, F = GIP.F, esc = GIP.esc, KIT = GIP.kit;
  const C = { blue: '#0F4F9C', blueSoft: '#A9C0E3', red: '#D7191F', redInk: '#B3141C', green: '#15803D', amber: '#B7800F', slate: '#5B6B7F' };
  const GCOL = ['#0F4F9C', '#B7800F', '#0891B2', '#7C3AED'];            // Construccion, Acero, Jardin, Pinturas
  const TCOL = ['#0F4F9C', '#B7800F', '#7C3AED', '#0891B2', '#5B6B7F'];  // Persona, Empresa, Gobierno, Consumidor, Otro
  const PAL = ['#0F4F9C', '#B7800F', '#0891B2', '#7C3AED', '#C2417A', '#5B6B7F'];
  const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const HATCH = { symbol: 'rect', symbolSize: 1, rotation: Math.PI / 4, dashArrayX: [1, 0], dashArrayY: [2, 5], color: 'rgba(15,79,156,.45)' };
  const UNID = { PZA: 'piezas', UND: 'unidades', UNID: 'unidades', KG: 'kg', KL: 'kg', GL: 'galones', GAL: 'galones', M2: 'm²', MT2: 'm²', MTS: 'metros', MT: 'metros',
    ML: 'metros', CAJA: 'cajas', ROLLO: 'rollos', SACO: 'sacos', PAR: 'pares', '1/4': 'cuartos de galón' };
  const DIN = ['neto', 'bruto', 'devm', 'vm', 'cst', 'p0', 'sc'];
  let D = null;   // precalculos sobre TODO el periodo (no dependen de los filtros)

  /* ---- Precalculos y agregados ----------------------------------------------- */
  function iniciar(S) {
    const c = S.M.cols, n = S.M.n, P = S.P;
    const tiendaAbre = new Uint8Array(P.dayCount), primera = new Map(), ultimaProd = new Map(), totVend = new Map();
    for (let r = 0; r < n; r++) {
      const d = c.dia[r], cl = c.cli[r];
      tiendaAbre[d] = 1;
      const f = primera.get(cl); if (f == null || d < f) primera.set(cl, d);
      if (c.q[r] > 0) { const l = ultimaProd.get(c.prod[r]); if (l == null || d > l) ultimaProd.set(c.prod[r], d); }
      totVend.set(c.vend[r], (totVend.get(c.vend[r]) || 0) + c.neto[r]);
    }
    const vcol = {};
    [...totVend.entries()].sort((a, b) => b[1] - a[1]).forEach(([v], i) => { vcol[v] = i < 5 ? PAL[i] : C.slate; });
    D = { tiendaAbre, primera, ultimaProd, vcol, wOff: (new Date(P.dayZero + 'T00:00:00').getDay() + 6) % 7, cmp: 'mes', frio: 21 };
  }
  const dow = off => (off + D.wOff) % 7;
  const semana = off => Math.floor((off + D.wOff) / 7);
  const inicioSemana = w => w * 7 - D.wOff;
  function diasVenta(a, b) { let k = 0; for (let i = Math.max(0, a); i <= Math.min(D.tiendaAbre.length - 1, b); i++) k += D.tiendaAbre[i]; return k; }
  function rangoMesIdx(c, m) { let a = -1, b = -1; c.dims.dayMes.forEach((x, i) => { if (x === m) { if (a < 0) a = i; b = i; } }); return [a, b]; }
  const mesAbierto = c => { const d = c.P.dateMax.split('-'); return +d[2] < new Date(+d[0], +d[1], 0).getDate(); };
  const unidad = (c, p) => { const u = (c.dims.prodUnidad[p] || '').toUpperCase(); return UNID[u] || (u ? u.toLowerCase() : 'unidades'); };

  /* Filas de un rango con los segmentadores actuales (la clave de cada uno es su columna) */
  function filas(c, a, b) { const f = {}; for (const k in GIP.S.f) if (GIP.S.f[k].size) f[k] = GIP.S.f[k]; return c.M.seleccion({ f, rango: [a, b] }); }
  /* Agregado de un conjunto de filas: lo mismo que agg() de la v3 */
  function agg(c, idx) {
    const col = c.M.cols, e = c.M.esc.neto, o = { neto: 0, bruto: 0, devm: 0, vm: 0, cst: 0, p0: 0, sc: 0, cant: 0, q: 0, lineas: idx.length };
    const docs = new Map(), clis = new Set(), prods = new Set(), din = DIN.filter(k => col[k]);
    for (let i = 0; i < idx.length; i++) {
      const r = idx[i];
      for (const k of din) o[k] += col[k][r];
      o.cant += col.cant[r]; o.q += col.q[r];
      let d = docs.get(col.doc[r]); if (!d) { d = { n: 0, c: 0, v: 0 }; docs.set(col.doc[r], d); }
      d.n += col.neto[r]; d.c += col.cant[r]; d.v += col.dev[r];
      clis.add(col.cli[r]); prods.add(col.prod[r]);
    }
    for (const k of DIN) o[k] /= e;
    o.cant /= 1000; o.q /= 1000;
    let fac = 0, anul = 0; docs.forEach(d => { if (d.n / e > 0.005) fac++; if (d.c > 0 && d.v >= d.c - 1e-6) anul++; });
    Object.assign(o, { fac, anul, cli: clis.size, clis, prods, mg: o.vm - o.cst, tk: fac ? o.neto / fac : 0, devPct: o.bruto ? o.devm / o.bruto * 100 : 0 });
    o.mgPct = o.vm ? o.mg / o.vm * 100 : 0;
    return o;
  }
  function porGrupo(c, idx, col) {
    const g = c.M.cols[col], cubos = new Map();
    for (let i = 0; i < idx.length; i++) { const k = g[idx[i]]; let a = cubos.get(k); if (!a) { a = []; cubos.set(k, a); } a.push(idx[i]); }
    const out = new Map(); cubos.forEach((a, k) => out.set(k, agg(c, Uint32Array.from(a)))); return out;
  }
  function sumaPor(c, idx, col, val) {
    const g = c.M.cols[col], v = c.M.cols[val], e = c.M.esc[val], m = new Map();
    for (let i = 0; i < idx.length; i++) { const r = idx[i]; m.set(g[r], (m.get(g[r]) || 0) + v[r] / e); }
    return m;
  }
  const A = c => c._A || (c._A = valores(c, c.sel, c.rango[0], c.rango[1]));
  function valores(c, idx, a, b) {
    const o = agg(c, idx), sd = diasVenta(a, b);
    const nuevos = [...o.clis].filter(cl => { const f = D.primera.get(cl); return f >= a && f <= b; }).length;
    const pn = sumaPor(c, idx, 'prod', 'neto'), pq = sumaPor(c, idx, 'prod', 'q');
    let agot = 0, agotN = 0; pq.forEach((q, p) => { if (q > 0 && c.dims.prodEx[p] <= 0) { agot++; agotN += pn.get(p) || 0; } });
    return Object.assign(o, { sd, rate: sd ? o.neto / sd : 0, facD: sd ? o.fac / sd : 0, cliD: sd ? o.cli / sd : 0, nuevos, agot, agotN });
  }
  /* Semanas del rango, con la marca "en curso" si la ultima no cerro */
  function semanas(c, idx, val) {
    const [a, b] = c.rango, m = new Map(), col = c.M.cols, dia = col.dia;
    for (let i = 0; i < idx.length; i++) { const r = idx[i], w = semana(dia[r]); m.set(w, (m.get(w) || 0) + val(r)); }
    const ultW = semana(c.P.dayCount - 1), cierra = dow(c.P.dayCount - 1) >= 5, ws = [];
    for (let w = semana(a); w <= semana(b); w++) { const s = Math.max(a, inicioSemana(w)), e = Math.min(b, inicioSemana(w) + 6);
      ws.push({ w, v: m.get(w) || 0, lab: F.fechaCorta(c.offAFecha(inicioSemana(w))), s, e, sd: diasVenta(s, e), parcial: w === ultW && !cierra }); }
    return ws;
  }
  const netoFila = c => { const v = c.M.cols.neto, e = c.M.esc.neto; return r => v[r] / e; };
  function filasPorSemana(c) { const m = new Map(), dia = c.M.cols.dia; for (const r of c.sel) { const w = semana(dia[r]); let a = m.get(w); if (!a) { a = []; m.set(w, a); } a.push(r); } return m; }

  /* ---- Comparador de los indicadores ------------------------------------------ */
  function periodos(c) {
    const [a, b] = c.rango, m = D.cmp, MESL = i => F.mesCorto(i);
    if (m === 'none') return null;
    if (m === 'mes') { const mb = c.dims.dayMes[b]; if (mb === 0) return null; const [ma] = rangoMesIdx(c, mb), [pa, pb] = rangoMesIdx(c, mb - 1);
      return { cur: [Math.max(a, ma), b], prev: [pa, pb], lab: MESL(+c.dims.mes[mb].slice(5) - 1) + ' contra ' + MESL(+c.dims.mes[mb - 1].slice(5) - 1) + ', por día' }; }
    if (m === 'prev') { const L = b - a + 1; if (a - 1 < 0) return null; return { cur: [a, b], prev: [Math.max(0, a - L), a - 1], lab: 'contra los ' + L + ' días anteriores' }; }
    const corre = s => { const d = new Date(s + 'T00:00:00'), dd = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() - 1);
      d.setDate(Math.min(dd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d.toISOString().slice(0, 10); };
    const pa = c.fechaAOff(corre(c.offAFecha(a))), pb = c.fechaAOff(corre(c.offAFecha(b))); if (pb < 0) return null;
    return { cur: [a, b], prev: [Math.max(0, pa), pb], lab: 'contra el mismo tramo del mes pasado' };
  }
  function kpis(c) {
    const a0 = c.rango[0], b0 = c.rango[1], X = A(c), n = c.P.dayCount, lastM = c.dims.dayMes[n - 1], dm = c.P.dateMax.split('-');
    let proy = '';
    if (b0 === n - 1 && mesAbierto(c)) { const [ma] = rangoMesIdx(c, lastM), mr = valores(c, filas(c, Math.max(a0, ma), b0), Math.max(a0, ma), b0);
      if (mr.sd > 0 && a0 <= ma) { let resto = 0; const y = +dm[0], m0 = +dm[1] - 1, ult = new Date(y, m0 + 1, 0).getDate();
        for (let d = +dm[2] + 1; d <= ult; d++) if (new Date(y, m0, d).getDay() !== 0) resto++;
        proy = 'Cierre de ' + F.mes(+dm[1] - 1) + ' a este ritmo: <b>' + F.dinero(mr.neto + mr.neto / mr.sd * resto) + '</b>'; } }
    const pr = periodos(c); let P0 = null, P1 = null;
    if (pr) { P1 = valores(c, filas(c, pr.cur[0], pr.cur[1]), pr.cur[0], pr.cur[1]); P0 = valores(c, filas(c, pr.prev[0], pr.prev[1]), pr.prev[0], pr.prev[1]); }
    const rel = (x, y) => y ? (x - y) / Math.abs(y) * 100 : null;
    const d = (campo, tipo, inverso) => !P0 || !P1 || !P0.sd || !P1.sd ? { v: null, nota: pr ? '' : D.cmp === 'none' ? '' : 'sin período anterior para comparar' }
      : { v: tipo === 'pp' ? P1[campo] - P0[campo] : rel(P1[campo], P0[campo]), pp: tipo === 'pp', inverso, ref: pr.lab };
    const ws = [...filasPorSemana(c).entries()].sort((x, y) => x[0] - y[0]).map(([w, rs]) => { const o = agg(c, Uint32Array.from(rs));
      const sd = diasVenta(Math.max(a0, inicioSemana(w)), Math.min(b0, inicioSemana(w) + 6)); return { o, sd }; });
    const serie = f => ws.map(x => f(x));
    return [
      { id: 'neto', lab: 'Venta neta', val: F.dinero(X.neto), sub: X.sd + ' días de venta', delta: d('rate', 'r'), serie: serie(x => x.o.neto), sensible: true,
        tip: 'Venta menos devoluciones de todo lo filtrado. La flecha compara la venta por día de venta con el período de «Comparar con».' },
      { id: 'rate', lab: 'Venta por día de venta', val: F.dinero(X.rate), sub: proy || 'en ' + X.sd + ' días de venta', delta: d('rate', 'r'), serie: serie(x => x.sd ? x.o.neto / x.sd : 0), sensible: true,
        tip: 'Venta neta entre los días que abrió la tienda. Si el mes en curso está en el rango, abajo va su cierre a este ritmo.' },
      { id: 'mg', lab: 'Margen bruto', val: F.pct(X.mgPct), sub: F.dinero(X.mg) + ' de margen' + (X.p0 > 0.5 ? '; salidas a $0 aparte: ' + F.dinero(X.p0) : ''), delta: d('mgPct', 'pp'),
        serie: serie(x => x.o.mgPct), sensible: true,
        tip: '(Venta neta − costo de lo vendido) ÷ venta neta, sin IVA. Las salidas a precio $0 se controlan aparte; una venta sin costo registrado no entra.' },
      { id: 'tk', lab: 'Ticket promedio', val: F.dinero(X.tk), sub: F.entero(X.fac) + ' facturas con venta', delta: d('tk', 'r'), serie: serie(x => x.o.tk),
        tip: 'Venta neta entre las facturas con venta. Una factura anulada completa no cuenta.' },
      { id: 'fac', lab: 'Facturas', val: F.entero(X.fac), sub: X.anul ? F.entero(X.anul) + ' anuladas completas' : 'ninguna anulada', delta: d('facD', 'r'), serie: serie(x => x.o.fac),
        tip: 'Facturas con venta neta. La flecha compara facturas por día de venta.' },
      { id: 'cli', lab: 'Clientes', val: F.entero(X.cli), sub: c.rango[0] === 0 ? 'desde que abrió la tienda' : F.entero(X.nuevos) + ' nuevos', delta: d('cliD', 'r'), serie: serie(x => x.o.cli),
        tip: 'Clientes distintos que compraron. «Nuevos» son los que hicieron su primera compra en el rango.' },
      { id: 'dev', lab: 'Devoluciones', val: F.pct(X.devPct), sub: F.dinero(X.devm) + ' devueltos', delta: d('devPct', 'pp', true), serie: serie(x => x.o.devPct),
        tip: 'Dólares devueltos entre venta bruta, con las facturas anuladas completas. Mientras más bajo, mejor.' },
      { id: 'agot', lab: 'Agotados que se venden', val: F.entero(X.agot), sub: X.agot ? F.dinero(X.agotN) + ' vendidos en ellos' : 'ninguno',
        delta: { v: null, nota: 'existencia al ' + F.fecha(c.P.dateMax) },
        tip: 'Productos vendidos en el rango que hoy tienen existencia cero o negativa. La existencia es la del día de la exportación.' },
    ];
  }
  function barraExtra(host, contexto) {
    const l = document.createElement('label');
    l.innerHTML = 'Comparar con <select id="cmp-modo"><option value="mes">el mes anterior, por día</option><option value="prev">el período anterior</option>'
      + '<option value="mesant">el mismo tramo del mes pasado</option><option value="none">sin comparar</option></select>';
    host.appendChild(l);
    l.querySelector('select').onchange = e => { D.cmp = e.target.value; GIP.repintar(); };
    void contexto;
  }

  /* ---- Inicio --------------------------------------------------------------- */
  function titular(c) {
    const n = c.P.dayCount, lastM = c.dims.dayMes[n - 1], [ma] = rangoMesIdx(c, lastM), abierto = mesAbierto(c), mesN = F.mes(+c.dims.mes[lastM].slice(5) - 1);
    const cur = valores(c, filas(c, ma, n - 1), ma, n - 1), prevR = lastM > 0 ? rangoMesIdx(c, lastM - 1) : null;
    const prev = prevR ? valores(c, filas(c, prevR[0], prevR[1]), prevR[0], prevR[1]) : null;
    const v = prev && prev.rate ? (cur.rate - prev.rate) / prev.rate * 100 : null;
    const fl = (x, que) => x == null ? '' : ' (<span class="' + (x >= 0 ? 'sube' : 'baja') + '">' + (x >= 0 ? '▲ ' : '▼ ') + F.delta(x) + '</span> ' + que + ')';
    const prevN = lastM > 0 ? F.mes(+c.dims.mes[lastM - 1].slice(5) - 1) : '';
    if (!cur.lineas) return '<p class="lede">No hay ventas en el mes del corte con estos filtros.</p>';
    if (c.reunion) {
      const vc = prev && prev.cliD ? (cur.cliD - prev.cliD) / prev.cliD * 100 : null;
      return '<p class="lede">En ' + mesN + (abierto ? ', que va por el día ' + (+c.P.dateMax.slice(8)) + ',' : '') + ' compraron <strong>' + F.entero(cur.cli) + ' clientes</strong>'
        + fl(vc, 'por día frente a ' + prevN) + ' y se emitieron <strong>' + F.entero(cur.fac) + ' facturas</strong>, con un ticket de <strong>' + F.dinero(cur.tk) + '</strong>.</p>'
        + '<p class="lede-sub">Vista de reunión: no muestra totales, costos ni márgenes de la tienda.</p>';
    }
    return '<p class="lede">' + (abierto ? 'En ' + mesN + ' la tienda vende <strong>' + F.dinero(cur.rate) + ' por día de venta</strong>' + fl(v, 'frente a ' + prevN)
      + ' y lleva <strong>' + F.dinero(cur.neto) + '</strong> en ' + cur.sd + ' días.' : cap(mesN) + ' cerró en <strong>' + F.dinero(cur.neto) + '</strong>, a <strong>'
      + F.dinero(cur.rate) + ' por día de venta</strong>' + fl(v, 'frente a ' + prevN) + '.') + ' El margen bruto del mes es de <strong>' + F.pct(cur.mgPct) + '</strong>.</p>'
      + '<p class="lede-sub">' + F.entero(cur.cli) + ' clientes compraron en ' + mesN + ', ' + F.entero(cur.nuevos) + ' de ellos por primera vez. Abajo, qué conviene atender.</p>';
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function grafSemanas(c, ch) {
    const ws = semanas(c, c.sel, netoFila(c));
    ch.setOption({ grid: KIT.rejilla(), aria: { enabled: true, decal: { show: true } },
      tooltip: KIT.tooltip({ formatter: ps => { const x = ws[ps[0].dataIndex]; return '<b>Semana del ' + F.fechaCorta(c.offAFecha(x.s)) + ' al ' + F.fechaCorta(c.offAFecha(x.e)) + '</b><br>'
        + F.dinero(x.v) + ' en ' + x.sd + ' días de venta' + (x.parcial ? '<br><i>Semana en curso</i>' : ''); } }),
      xAxis: KIT.ejeCat(ws.map(x => x.lab)), yAxis: KIT.ejeVal(),
      series: [{ type: 'bar', barMaxWidth: 44, data: ws.map(x => ({ value: Math.round(x.v), itemStyle: { color: x.parcial ? C.blueSoft : C.blue, decal: x.parcial ? HATCH : { symbol: 'none' } } })),
        itemStyle: { borderRadius: [4, 4, 0, 0], decal: { symbol: 'none' } }, label: { show: !c.mob, position: 'top', fontSize: KIT.fs(10), color: '#4A5270', formatter: p => F.corto(p.value) } }] }, true);
  }
  function anilloGrupo(c, ch) {
    const g = sumaPor(c, c.sel, 'grupo', 'neto'), it = [...g.entries()].filter(e => e[1] > 0.5).map(([i, v]) => ({ name: c.dims.grupo[i], value: Math.round(v), itemStyle: { color: GCOL[i] } }));
    KIT.anillo(ch, it.sort((a, b) => b.value - a.value), { clic: n => GIP.alternar('grupo', n) });
  }
  function rankVend(c, ch) {
    const g = porGrupo(c, c.sel, 'vend'), p = [...g.entries()].map(([i, o]) => [c.dims.vend[i], o.neto, o]).sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p, { izq: 96, izqMob: 76, colorFn: q => D.vcol[c.dims.vend.indexOf(q[0])] || C.blue,
      tip: q => F.dinero(q[1]) + (c.reunion ? '' : '<br>Margen ' + F.pct(q[2].mgPct)) + '<br>' + F.entero(q[2].fac) + ' facturas, ticket ' + F.dinero(q[2].tk), clic: q => GIP.alternar('vend', q[0]) });
  }
  function rankProd(c, ch, campo, o) {
    const g = sumaPor(c, c.sel, 'prod', campo === 'q' ? 'q' : 'neto'), p = [...g.entries()].filter(e => e[1] > 0).map(([i, v]) => [c.dims.prod[i], v, i]).sort((a, b) => b[1] - a[1]).slice(0, 300);
    KIT.barrasH(ch, p, Object.assign({ izq: 230, izqMob: 120, trunc: 34, clic: q => GIP.alternar('prod', q[0]) }, campo === 'q'
      ? { fmt: v => F.entero(v) + ' ' , axf: v => F.entero(v), label: q => F.entero(q[1]), color: C.slate, tip: q => F.entero(q[1]) + ' ' + esc(unidad(c, q[2])) } : {}, o || {}));
  }

  /* Que atender (lo de la v3, mas el modo reunion) */
  function frios(c, dias) {
    const g = porGrupo(c, c.sel, 'cli'), n = c.P.dayCount - 1, col = c.M.cols, ult = new Map();
    for (const r of c.sel) if (col.neto[r] > 0) { const l = ult.get(col.cli[r]); if (l == null || col.dia[r] > l) ult.set(col.cli[r], col.dia[r]); }
    return [...g.entries()].filter(([cl, o]) => o.fac >= 2 && ult.has(cl) && n - ult.get(cl) > dias).map(([cl, o]) => ({ cl, o, ult: ult.get(cl) })).sort((a, b) => b.o.neto - a.o.neto);
  }
  function alertas(c) {
    const X = A(c), it = [], [a, b] = c.rango, sd = diasVenta(a, b);
    const pn = sumaPor(c, c.sel, 'prod', 'neto'), pq = sumaPor(c, c.sel, 'prod', 'q');
    if (X.agot) {
      const top = [...pq.entries()].filter(([p, q]) => q > 0 && c.dims.prodEx[p] <= 0).sort((x, y) => (pn.get(y[0]) || 0) - (pn.get(x[0]) || 0)).slice(0, 3).map(([p]) => c.dims.prod[p]);
      it.push({ s: 'r', t: F.entero(X.agot) + ' productos se venden y hoy están en existencia cero', m: F.dinero(X.agotN) + ' vendidos en ellos. Los que más venden: ' + top.join(', ') + '.', ir: 'inv' });
    }
    [...pn.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10).forEach(([p]) => { const q = pq.get(p) || 0, ex = c.dims.prodEx[p];
      if (q > 0 && ex > 0 && sd) { const dias = ex / (q / sd);
        if (dias < 15) it.push({ s: 'r', t: c.dims.prod[p] + ': quedan ' + F.entero(ex) + ' ' + unidad(c, p) + ', unos ' + Math.round(dias) + ' días',
          m: 'Está entre los 10 que más venden. Al ritmo del período se agota antes de dos semanas.', ir: 'inv' }); } });
    if (!c.reunion) {
      porGrupo(c, c.sel, 'vend').forEach((o, v) => { if (o.neto >= X.neto * 0.03 && o.mgPct < X.mgPct - 8)
        it.push({ s: 'a', t: c.dims.vend[v] + ' deja ' + F.pct(o.mgPct) + ' de margen; la tienda, ' + F.pct(X.mgPct), m: F.dinero(o.neto) + ' de venta. Vende más barato o productos de menor margen.', ir: 'vend' }); });
      if (X.p0 > 0.5) { const z = sumaPor(c, c.sel, 'cli', 'p0'), tc = [...z.entries()].filter(e => e[1] > 0).sort((x, y) => y[1] - x[1])[0];
        it.push({ s: 'a', t: F.dinero(X.p0) + ' en mercancía que salió a precio $0 (a costo)', m: 'No es venta: se controla aparte. El ' + F.pct(tc[1] / X.p0 * 100, 0) + ' fue a ' + c.dims.cli[tc[0]] + '.', ir: 'rent' }); }
    }
    if (X.devPct >= 5) { const gd = porGrupo(c, c.sel, 'vend'), tv = [...gd.entries()].sort((x, y) => y[1].anul - x[1].anul)[0];
      it.push({ s: 'a', t: F.pct(X.devPct) + ' de la venta bruta se devolvió (' + F.dinero(X.devm) + ')', m: F.entero(X.anul) + ' facturas anuladas completas' + (tv && tv[1].anul ? ', ' + F.entero(tv[1].anul) + ' de ' + c.dims.vend[tv[0]] : '') + '.', ir: 'dev' }); }
    const fr = frios(c, 21);
    if (fr.length) it.push({ s: 'b', t: F.entero(fr.length) + ' clientes frecuentes llevan más de 21 días sin comprar', m: 'Compraron ' + F.dinero(fr.reduce((s, x) => s + x.o.neto, 0)) + ' en el período. Conviene llamarlos.', ir: 'cli' });
    return it;
  }
  const SEV = { r: ['Urgente', 'etq-r', 'sev-r'], a: ['Revisar', 'etq-a', 'sev-a'], b: ['Seguimiento', 'etq-n', 'sev-b'] };
  function htmlAlertas(c, host) {
    const it = alertas(c);
    host.innerHTML = it.length ? '<div class="lista">' + it.map(a => '<div class="fila"><span class="marca-sev ' + SEV[a.s][2] + '" aria-hidden="true"></span>'
      + '<p><span class="etq ' + SEV[a.s][1] + '">' + SEV[a.s][0] + '</span> ' + esc(a.t) + '<small>' + esc(a.m) + '</small></p>'
      + '<button class="btn btn-sec" type="button" data-ir="' + a.ir + '">Ver detalle</button></div>').join('') + '</div>' : '<p class="vacio">Nada urgente en esta selección.</p>';
  }

  /* ---- Ventas en el tiempo ----------------------------------------------------- */
  function grafRitmo(c, ch) {
    const [a, b] = c.rango, nm = c.dims.mes.length, lastM = c.dims.dayMes[c.P.dayCount - 1], abierto = mesAbierto(c), mo = [], mes = c.M.cols.mes, nf = netoFila(c);
    const tot = new Float64Array(nm); for (const r of c.sel) tot[mes[r]] += nf(r);
    for (let m = 0; m < nm; m++) { const [ma, mb] = rangoMesIdx(c, m), s = Math.max(a, ma), e = Math.min(b, mb); if (s > e) continue;
      const sd = diasVenta(s, e); mo.push({ m, v: tot[m], sd, rate: sd ? tot[m] / sd : 0, parcial: m === lastM && abierto }); }
    ch.setOption({ grid: KIT.rejilla(), aria: { enabled: true, decal: { show: true } },
      tooltip: KIT.tooltip({ formatter: ps => { const x = mo[ps[0].dataIndex]; return '<b>' + esc(c.dims.mesLabels[x.m]) + '</b><br>' + F.dinero(x.rate) + ' por día de venta<br>' + F.dinero(x.v) + ' en ' + x.sd + ' días'; } }),
      xAxis: KIT.ejeCat(mo.map(x => c.dims.mesLabels[x.m] + (x.parcial ? ' (en curso)' : ''))), yAxis: KIT.ejeVal(),
      series: [{ type: 'bar', barMaxWidth: 64, data: mo.map(x => ({ value: Math.round(x.rate), itemStyle: { color: x.parcial ? C.blueSoft : C.blue, decal: x.parcial ? HATCH : { symbol: 'none' } } })),
        itemStyle: { borderRadius: [4, 4, 0, 0], decal: { symbol: 'none' } }, label: { show: true, position: 'top', fontSize: KIT.fs(11), fontWeight: 600, color: '#0F1B33', formatter: p => F.dinero(p.value) } }] }, true);
  }
  function diasDelRango(c) { const out = []; for (let i = c.rango[0]; i <= c.rango[1]; i++) if (D.tiendaAbre[i]) out.push(i); return out; }
  function grafAcum(c, ch) {
    const dia = c.M.porDia(c.sel, 'neto', c.P.dayCount), ds = diasDelRango(c); let acc = 0;
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, valueFormatter: F.dinero }), xAxis: KIT.ejeCat(ds.map(i => F.fechaCorta(c.offAFecha(i)))), yAxis: KIT.ejeVal(),
      series: [{ type: 'line', data: ds.map(i => Math.round(acc += dia[i])), smooth: true, symbol: 'none', lineStyle: { color: C.blue, width: 2.5 }, areaStyle: { color: 'rgba(15,79,156,.10)' } }] }, true);
  }
  function grafDia(c, ch) {
    const dia = c.M.porDia(c.sel, 'neto', c.P.dayCount), ds = diasDelRango(c), v = ds.map(i => dia[i]), lim = c.mob ? 30 : 70;
    const ma = v.map((_, k) => { const s = v.slice(Math.max(0, k - 5), k + 1); return s.length < 6 ? null : Math.round(s.reduce((x, y) => x + y, 0) / 6); });
    ch.setOption({ grid: KIT.rejilla({ top: 34, bottom: ds.length > lim ? 50 : 24 }), legend: KIT.leyenda({ top: 0, bottom: 'auto', data: ['Venta del día', 'Promedio de 6 días de venta'] }),
      tooltip: KIT.tooltip({ formatter: ps => { const i = ds[ps[0].dataIndex]; return '<b>' + DOW[dow(i)] + ' ' + F.fecha(c.offAFecha(i)) + '</b><br>' + ps.map(p => p.seriesName + ': ' + (p.value == null ? '–' : F.dinero(p.value))).join('<br>'); } }),
      xAxis: KIT.ejeCat(ds.map(i => F.fechaCorta(c.offAFecha(i)))), yAxis: KIT.ejeVal(),
      dataZoom: ds.length > lim ? [{ type: 'slider', xAxisIndex: 0, height: 14, bottom: 6, start: Math.max(0, 100 - lim / ds.length * 100), end: 100, brushSelect: false, showDetail: false }] : [],
      series: [{ name: 'Venta del día', type: 'bar', data: v.map(Math.round), itemStyle: { color: C.blue, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 18 },
        { name: 'Promedio de 6 días de venta', type: 'line', data: ma, smooth: true, symbol: 'none', lineStyle: { color: C.red, width: 2 } }] }, true);
  }
  function grafHora(c, ch) {
    const col = c.M.cols, celda = new Map(), horas = new Set();
    for (const r of c.sel) { const k = dow(col.dia[r]) + '|' + col.hora[r]; let s = celda.get(k); if (!s) { s = { docs: new Set(), v: 0 }; celda.set(k, s); }
      s.docs.add(col.doc[r]); s.v += col.neto[r] / c.M.esc.neto; horas.add(col.hora[r]); }
    const hs = [...horas].sort((x, y) => x - y), dws = [0, 1, 2, 3, 4, 5].concat([...celda.keys()].some(k => k[0] === '6') ? [6] : []);
    if (!hs.length) { KIT.vacio(ch); return; }
    let mx = 1; const hm = [];
    dws.forEach((w, yi) => hs.forEach((h, xi) => { const s = celda.get(w + '|' + h), n = s ? s.docs.size : 0; mx = Math.max(mx, n); hm.push([xi, yi, n, s ? s.v : 0]); }));
    ch.setOption({ grid: KIT.rejilla({ bottom: c.mob ? 54 : 48 }),
      tooltip: { confine: true, formatter: p => '<b>' + DOW[dws[p.value[1]]] + ', ' + hs[p.value[0]] + ':00</b><br>' + F.entero(p.value[2]) + ' facturas' + (c.reunion ? '' : ', ' + F.dinero(p.value[3])) },
      xAxis: { type: 'category', data: hs.map(h => h + 'h'), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { fontSize: KIT.fs(10), color: '#5E6A7E' } },
      yAxis: { type: 'category', data: dws.map(w => DOW[w]), inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { fontSize: KIT.fs(11), color: '#0F1B33' } },
      visualMap: { min: 0, max: mx, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: c.mob ? 120 : 180, calculable: false, text: [F.entero(mx) + ' facturas', '0'],
        textStyle: { fontSize: KIT.fs(10), color: '#5E6A7E' }, inRange: { color: ['#F4F6FA', '#C9D8EE', '#6F95CC', '#0F4F9C'] } },
      series: [{ type: 'heatmap', data: hm.map(v => ({ value: v, label: { color: v[2] >= mx * 0.35 ? '#fff' : '#0F1B33' } })), itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 3 },
        label: { show: !c.mob, fontSize: KIT.fs(9.5), formatter: p => p.value[2] || '' } }] }, true);
  }
  function grafDow(c, ch) {
    const tot = [0, 0, 0, 0, 0, 0, 0], cnt = [0, 0, 0, 0, 0, 0, 0], dia = c.M.cols.dia, nf = netoFila(c);
    for (const r of c.sel) tot[dow(dia[r])] += nf(r);
    for (let i = c.rango[0]; i <= c.rango[1]; i++) if (D.tiendaAbre[i]) cnt[dow(i)]++;
    const idx = [0, 1, 2, 3, 4, 5, 6].filter(i => cnt[i] > 0);
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ formatter: ps => { const i = idx[ps[0].dataIndex]; return '<b>' + DOW[i] + '</b><br>' + F.dinero(cnt[i] ? tot[i] / cnt[i] : 0) + ' en promedio<br>' + cnt[i] + ' días en el período'; } }),
      xAxis: KIT.ejeCat(idx.map(i => DOW[i])), yAxis: KIT.ejeVal(),
      series: [{ type: 'bar', barMaxWidth: 46, data: idx.map(i => Math.round(cnt[i] ? tot[i] / cnt[i] : 0)), itemStyle: { color: C.blue, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: KIT.fs(10), color: '#5E6A7E', formatter: p => F.corto(p.value) } }] }, true);
  }
  function tablaSemanas(c, host) {
    const ws = semanas(c, c.sel, () => 0), por = filasPorSemana(c);
    KIT.tabla(host, { buscar: false, cols: [{ k: 'sem', l: 'Semana', f: (v, r) => esc(r.lab) }, { k: 'sd', l: 'Días de venta', n: 1, f: F.entero }, { k: 'neto', l: 'Venta neta', n: 1, f: F.dinero },
      { k: 'rate', l: 'Venta por día', n: 1, f: F.dinero }, { k: 'fac', l: 'Facturas', n: 1, f: F.entero }, { k: 'tk', l: 'Ticket', n: 1, f: F.dinero },
      { k: 'mg', l: 'Margen', n: 1, f: v => F.pct(v) }, { k: 'dev', l: 'Devolución', n: 1, f: v => F.pct(v) }],
    filas: ws.map(x => { const o = agg(c, Uint32Array.from(por.get(x.w) || [])); return { sem: c.offAFecha(x.s), lab: F.fechaCorta(c.offAFecha(x.s)) + ' a ' + F.fechaCorta(c.offAFecha(x.e)) + (x.parcial ? ' (en curso)' : ''),
      sd: x.sd, neto: o.neto, rate: x.sd ? o.neto / x.sd : 0, fac: o.fac, tk: o.tk, mg: o.mgPct, dev: o.devPct }; }), orden: ['sem', 1] });
  }

  /* ---- Rentabilidad (fuera del modo reunion) ----------------------------------- */
  function grafMgGrupo(c, ch) {
    const g = porGrupo(c, c.sel, 'grupo'), p = [...g.entries()].filter(([, o]) => Math.abs(o.neto) > 0.5).map(([i, o]) => [c.dims.grupo[i], o.mg, o, i]).sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p, { izq: 170, izqMob: 112, colorFn: q => q[1] < 0 ? C.red : GCOL[q[3]], label: q => F.corto(q[1]) + ', ' + F.pct(q[2].mgPct),
      tip: q => 'Venta neta ' + F.dinero(q[2].neto) + '<br>Costo de lo vendido ' + F.dinero(q[2].cst) + '<br>Margen ' + F.dinero(q[1]) + ' (' + F.pct(q[2].mgPct) + ')', clic: q => GIP.alternar('grupo', q[0]) });
  }
  function grafMgSemana(c, ch) {
    const X = A(c), por = filasPorSemana(c), ws = semanas(c, c.sel, () => 0).map(x => ({ x, o: agg(c, Uint32Array.from(por.get(x.w) || [])) }));
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, formatter: ps => { const z = ws[ps[0].dataIndex]; return '<b>Semana del ' + F.fechaCorta(c.offAFecha(z.x.s)) + '</b><br>Margen ' + F.pct(z.o.mgPct) + '<br>' + F.dinero(z.o.mg) + ' sobre ' + F.dinero(z.o.neto); } }),
      xAxis: KIT.ejeCat(ws.map(z => z.x.lab)), yAxis: KIT.ejeVal(v => v + ' %', { scale: true }),
      series: [{ type: 'line', data: ws.map(z => +z.o.mgPct.toFixed(1)), symbol: 'circle', symbolSize: 7, lineStyle: { color: C.blue, width: 2.5 }, itemStyle: { color: C.blue },
        label: { show: !c.mob, position: 'top', fontSize: KIT.fs(10), color: '#5E6A7E', formatter: p => F.pct(p.value).replace(' %', '') },
        markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#5E6A7E' }, label: { formatter: 'Período ' + F.pct(X.mgPct), color: '#5E6A7E', fontSize: KIT.fs(10), position: 'insideStartBottom' }, data: [{ yAxis: +X.mgPct.toFixed(1) }] } }] }, true);
  }
  function grafMatriz(c, ch) {
    const X = A(c), g = porGrupo(c, c.sel, 'prod'), pts = [...g.entries()].filter(([, o]) => o.vm > 1).sort((a, b) => b[1].neto - a[1].neto).slice(0, 60);
    if (pts.length < 3) { KIT.vacio(ch, 'Hacen falta al menos 3 productos con venta'); return; }
    const vs = pts.map(([, o]) => o.neto).sort((a, b) => a - b), med = vs[Math.floor(vs.length / 2)];
    const series = [0, 1, 2, 3].map(gi => ({ name: c.dims.grupo[gi], type: 'scatter', symbolSize: c.mob ? 9 : 11, itemStyle: { color: GCOL[gi], opacity: .85, borderColor: '#fff', borderWidth: 1 },
      data: pts.filter(([p]) => c.dims.prodGrupo[p] === gi).map(([p, o]) => ({ value: [+o.neto.toFixed(2), +o.mgPct.toFixed(1)], name: c.dims.prod[p], o })),
      label: { show: !c.mob, position: 'right', fontSize: KIT.fs(9.5), color: '#0F1B33', formatter: q => q.data.o.neto >= vs[vs.length - 6] ? (q.name.length > 22 ? q.name.slice(0, 21) + '…' : q.name) : '' } })).filter(s => s.data.length);
    series[0].markLine = { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#5E6A7E' }, label: { fontSize: KIT.fs(10), color: '#5E6A7E' },
      data: [{ xAxis: +med.toFixed(0), label: { formatter: 'venta mediana', position: 'end' } }, { yAxis: +X.mgPct.toFixed(1), label: { formatter: 'margen ' + F.pct(X.mgPct), position: 'insideEndTop' } }] };
    ch.setOption({ grid: KIT.rejilla({ top: 40, bottom: c.mob ? 60 : 46, right: c.mob ? 16 : 60 }), legend: KIT.leyenda({ top: 0, bottom: 'auto', right: 0 }),
      tooltip: { trigger: 'item', confine: true, formatter: q => '<b>' + esc(q.name) + '</b><br>Venta ' + F.dinero(q.data.o.neto) + '<br>Margen ' + F.pct(q.data.o.mgPct) + ' (' + F.dinero(q.data.o.mg) + ')<br>' + F.entero(q.data.o.q) + ' unidades' },
      xAxis: { type: 'log', name: 'Venta neta (escala logarítmica)', nameLocation: 'middle', nameGap: 28, nameTextStyle: { fontSize: KIT.fs(11), color: '#5E6A7E' }, axisLabel: { formatter: F.corto, fontSize: KIT.fs(10), color: '#5E6A7E' }, splitLine: { lineStyle: { color: '#EEF1F5' } } },
      yAxis: { type: 'value', name: 'Margen %', nameTextStyle: { fontSize: KIT.fs(11), color: '#5E6A7E' }, axisLabel: { formatter: '{value} %', fontSize: KIT.fs(10), color: '#5E6A7E' }, splitLine: { lineStyle: { color: '#EEF1F5' } } },
      series }, true);
    ch.off('click'); ch.on('click', q => { if (q.componentType === 'series' && q.name) GIP.alternar('prod', q.name); });
  }
  function grafMgMarca(c, ch) {
    const g = porGrupo(c, c.sel, 'marca'), p = [...g.entries()].filter(([, o]) => Math.abs(o.neto) > 0.5).map(([i, o]) => [c.dims.marca[i], o.mg, o]).sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p, { izq: 130, izqMob: 92, label: q => F.corto(q[1]) + ', ' + F.pct(q[2].mgPct, 0), colorFn: q => q[1] < 0 ? C.red : C.blue,
      tip: q => 'Venta ' + F.dinero(q[2].neto) + '<br>Margen ' + F.dinero(q[1]) + ' (' + F.pct(q[2].mgPct) + ')', clic: q => GIP.alternar('marca', q[0]) });
  }
  function grafP0(c, ch) {
    const z = sumaPor(c, c.sel, 'cli', 'p0'), p = [...z.entries()].filter(e => e[1] > 0).map(([cl, v]) => [c.dims.cli[cl], v]).sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p, { izq: 190, izqMob: 104, color: C.red, vacio: 'Ninguna salida a precio $0 en esta selección', clic: q => GIP.alternar('cli', q[0]) });
  }
  function tablaP0(c, host) {
    const col = c.M.cols, e = c.M.esc.neto, lineas = [];
    let sinC = 0, sinCm = 0, p0 = 0, nP0 = 0, nBc = 0, perd = 0;
    for (const r of c.sel) {
      const q = col.q[r] / 1000, pr = col.precio[r] / e, co = col.costo[r] / e;
      if (col.sc[r] > 0) { sinC++; sinCm += col.sc[r] / e; }
      const base = { fecha: c.offAFecha(col.dia[r]), doc: c.dims.doc[col.doc[r]], prod: c.dims.prod[col.prod[r]], q, cli: c.dims.cli[col.cli[r]], vend: c.dims.vend[col.vend[r]] };
      if (col.p0[r] > 0) { nP0++; p0 += col.p0[r] / e; lineas.push(Object.assign(base, { c: col.p0[r] / e, t: 'Precio $0' })); }
      else if (pr > 0 && pr < co && q > 0) { nBc++; perd += q * (co - pr); lineas.push(Object.assign(base, { c: q * (co - pr), t: 'Bajo costo' })); }
    }
    host.innerHTML = '<p class="notas">' + (sinC ? '<span><b>' + F.entero(sinC) + '</b> ventas sin costo registrado (' + F.dinero2(sinCm) + '), fuera del margen</span>' : '')
      + '<span><b>' + F.entero(nP0) + '</b> líneas a precio $0 (' + F.dinero(p0) + ' a costo)</span><span><b>' + F.entero(nBc) + '</b> líneas bajo costo (' + F.dinero2(perd) + ' perdidos)</span></p><div id="t-p0-t"></div>';
    KIT.tabla(document.getElementById('t-p0-t'), { cols: [{ k: 'fecha', l: 'Fecha', f: v => F.fecha(v) }, { k: 'doc', l: 'Factura' }, { k: 'prod', l: 'Producto', cls: 'nm' },
      { k: 'q', l: 'Cantidad', n: 1, f: F.entero }, { k: 'c', l: 'Costo perdido', n: 1, f: F.dinero2 }, { k: 'cli', l: 'Cliente', cls: 'nm' }, { k: 'vend', l: 'Vendedor' },
      { k: 't', l: 'Tipo', f: v => '<span class="etq ' + (v === 'Precio $0' ? 'etq-r' : 'etq-a') + '">' + esc(v) + '</span>' }], filas: lineas, orden: ['fecha', -1], buscarTexto: 'Buscar producto, cliente o vendedor',
      vacio: 'Ninguna línea a precio $0 ni bajo costo en esta selección.' });
  }

  /* ---- Productos e inventario ------------------------------------------------- */
  function tablaAgotados(c, host) {
    const pn = sumaPor(c, c.sel, 'prod', 'neto'), pq = sumaPor(c, c.sel, 'prod', 'q'), ag = [];
    pq.forEach((q, p) => { if (q > 0 && c.dims.prodEx[p] <= 0) ag.push({ name: c.dims.prod[p], g: c.dims.grupo[c.dims.prodGrupo[p]], neto: pn.get(p) || 0, q, ex: c.dims.prodEx[p],
      last: D.ultimaProd.has(p) ? c.offAFecha(D.ultimaProd.get(p)) : '' }); });
    KIT.tabla(host, { cols: [{ k: 'name', l: 'Producto', cls: 'nm' }, { k: 'g', l: 'Grupo' }, { k: 'neto', l: 'Venta', n: 1, f: F.dinero }, { k: 'q', l: 'Unidades', n: 1, f: F.entero },
      { k: 'ex', l: 'Existencia', n: 1, f: F.entero }, { k: 'last', l: 'Última venta', n: 1, f: v => v ? F.fecha(v) : '–' }], filas: ag, orden: ['neto', -1], buscarTexto: 'Buscar producto',
      vacio: 'No hay agotados que se vendan en esta selección.' });
  }
  function grafCobertura(c, ch) {
    const sd = Math.max(1, diasVenta(c.rango[0], c.rango[1])), pn = sumaPor(c, c.sel, 'prod', 'neto'), pq = sumaPor(c, c.sel, 'prod', 'q');
    const top = [...pn.entries()].filter(([p]) => (pq.get(p) || 0) > 0).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([p]) => { const ex = c.dims.prodEx[p], q = pq.get(p), dias = ex <= 0 ? 0 : ex / (q / sd);
      return [c.dims.prod[p], Math.min(dias, 180), { ex, dias, q, u: unidad(c, p) }]; });
    KIT.barrasH(ch, top, { ventana: 15, axf: v => Math.round(v) + ' d', label: q => q[2].ex <= 0 ? 'sin existencia' : q[2].dias >= 180 ? '180+ días' : Math.round(q[2].dias) + ' días',
      colorFn: q => q[2].ex <= 0 || q[2].dias < 15 ? C.red : q[2].dias < 30 ? C.amber : C.blue,
      tip: q => 'Existencia: ' + F.entero(q[2].ex) + ' ' + esc(q[2].u) + '<br>Vende ' + (q[2].q / sd).toFixed(1).replace('.', ',') + ' por día de venta<br>' + (q[2].ex <= 0 ? 'Sin existencia' : 'Dura unos ' + Math.round(q[2].dias) + ' días'),
      clic: q => GIP.alternar('prod', q[0]) });
  }
  function abc(c) {
    const pn = sumaPor(c, c.sel, 'prod', 'neto'), vs = [...pn.entries()].filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]), tot = vs.reduce((s, e) => s + e[1], 0);
    let acc = 0, nA = 0, nB = 0; const clase = new Map(), cum = vs.map(([p, v], i) => { acc += v; const x = acc / tot * 100; if (x <= 80 || i === 0) nA = i + 1; if (x <= 95) nB = i + 1;
      clase.set(p, x <= 80 ? 'A' : x <= 95 ? 'B' : 'C'); return x; });
    return { vs, cum, nA, nB, clase };
  }
  function grafABC(c, ch) {
    const r = abc(c), n = r.vs.length, paso = Math.max(1, Math.ceil(n / 150)), pts = [];
    if (!n) { KIT.vacio(ch); return; }
    for (let i = 0; i < n; i += paso) pts.push([i + 1, +r.cum[i].toFixed(1)]);
    pts.push([n, 100]);
    ch.setOption({ grid: KIT.rejilla({ bottom: 40 }), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, formatter: ps => 'Los primeros ' + F.entero(ps[0].value[0]) + ' productos<br>hacen el ' + F.pct(ps[0].value[1]) + ' de la venta' }),
      xAxis: { type: 'value', min: 0, max: n, name: 'productos, del más vendido al menos', nameLocation: 'middle', nameGap: 26, nameTextStyle: { fontSize: KIT.fs(10), color: '#5E6A7E' },
        axisLabel: { fontSize: KIT.fs(10), color: '#5E6A7E', formatter: v => F.entero(v) }, splitLine: { show: false } }, yAxis: KIT.ejeVal(v => v + ' %', { max: 100 }),
      series: [{ type: 'line', data: pts, symbol: 'none', smooth: true, lineStyle: { color: C.blue, width: 2.5 }, areaStyle: { color: 'rgba(15,79,156,.08)' },
        markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#5E6A7E' }, label: { fontSize: KIT.fs(10), color: '#5E6A7E', position: 'insideStartTop' },
          data: [{ yAxis: 80, label: { formatter: '80 %, clase A' } }, { yAxis: 95, label: { formatter: '95 %, clase B' } }] } }] }, true);
  }
  function tablaProductos(c, host) {
    const sd = Math.max(1, diasVenta(c.rango[0], c.rango[1])), g = porGrupo(c, c.sel, 'prod'), cls = abc(c).clase, filasT = [];
    g.forEach((o, p) => { const ex = c.dims.prodEx[p], rate = o.q / sd;
      filasT.push({ cod: c.dims.prodCod[p], name: c.dims.prod[p], g: c.dims.grupo[c.dims.prodGrupo[p]], marca: c.dims.marca[c.dims.prodMarca[p]], q: o.q, neto: o.neto,
        mg: o.vm > 0 ? o.mgPct : null, ex, dias: rate > 0 ? Math.min(999, ex <= 0 ? 0 : ex / rate) : -1, abc: cls.get(p) || '' }); });
    const cols = [{ k: 'cod', l: 'Código' }, { k: 'name', l: 'Producto', cls: 'nm' }, { k: 'g', l: 'Grupo' }, { k: 'marca', l: 'Marca' }, { k: 'q', l: 'Unidades', n: 1, f: F.entero },
      { k: 'neto', l: 'Venta', n: 1, f: F.dinero }, { k: 'mg', l: 'Margen', n: 1, f: v => v == null ? '–' : F.pct(v) }, { k: 'ex', l: 'Existencia', n: 1, f: F.entero },
      { k: 'dias', l: 'Días de inventario', n: 1, f: v => v < 0 ? '–' : v >= 999 ? '999+' : F.entero(v) },
      { k: 'abc', l: 'Clase', f: v => v ? '<span class="etq ' + (v === 'A' ? 'etq-p' : v === 'B' ? 'etq-a' : 'etq-n') + '">' + v + '</span>' : '–' }];
    KIT.tabla(host, { cols: c.reunion ? cols.filter(x => x.k !== 'mg') : cols, filas: filasT, orden: ['neto', -1], buscarTexto: 'Buscar producto, código o marca' });
  }

  /* ---- Vendedores --------------------------------------------------------------- */
  function grafVendMg(c, ch) {
    const X = A(c), g = porGrupo(c, c.sel, 'vend'), mv = [...g.entries()].filter(([, o]) => o.neto > 0).map(([v, o]) => ({ name: c.dims.vend[v], o })).sort((a, b) => b.o.neto - a.o.neto);
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ formatter: ps => { const x = mv[ps[0].dataIndex]; return '<b>' + esc(x.name) + '</b><br>Margen ' + F.pct(x.o.mgPct) + ' (' + F.dinero(x.o.mg) + ')'; } }),
      xAxis: KIT.ejeCat(mv.map(x => x.name)), yAxis: KIT.ejeVal(v => v + ' %'),
      series: [{ type: 'bar', barMaxWidth: 40, data: mv.map(x => ({ value: +x.o.mgPct.toFixed(1), itemStyle: { color: x.o.mgPct < X.mgPct - 8 ? C.red : C.blue } })), itemStyle: { borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: KIT.fs(10), color: '#0F1B33', formatter: p => F.pct(p.value) },
        markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#5E6A7E' }, label: { formatter: 'Tienda ' + F.pct(X.mgPct), color: '#5E6A7E', fontSize: KIT.fs(10), position: 'insideEndTop' }, data: [{ yAxis: +X.mgPct.toFixed(1) }] } }] }, true);
  }
  function grafVendMes(c, ch) {
    const [a, b] = c.rango, ms = [], g = porGrupo(c, c.sel, 'vend'), top = [...g.entries()].sort((x, y) => y[1].neto - x[1].neto).slice(0, 5), lastM = c.dims.dayMes[c.P.dayCount - 1];
    for (let m = 0; m < c.dims.mes.length; m++) { const [ma, mb] = rangoMesIdx(c, m), s = Math.max(a, ma), e = Math.min(b, mb); if (s <= e) ms.push({ m, sd: diasVenta(s, e) }); }
    const x = c.M.cruzar(c.sel, 'vend', 'mes', 'neto');
    ch.setOption({ grid: KIT.rejilla({ top: 34 }), legend: KIT.leyenda({ top: 0, bottom: 'auto' }), tooltip: KIT.tooltip({ valueFormatter: v => F.dinero(v) + ' por día' }),
      xAxis: KIT.ejeCat(ms.map(z => c.dims.mesLabels[z.m] + (z.m === lastM && mesAbierto(c) ? ' (en curso)' : ''))), yAxis: KIT.ejeVal(),
      series: top.map(([v]) => ({ name: c.dims.vend[v], type: 'bar', barMaxWidth: 26, itemStyle: { color: D.vcol[v] || C.slate, borderRadius: [3, 3, 0, 0] },
        data: ms.map(z => Math.round(z.sd ? x.v[v * x.nB + z.m] / z.sd : 0)) })) }, true);
  }
  function tablaVend(c, host) {
    const X = A(c), g = porGrupo(c, c.sel, 'vend'), cols = [{ k: 'name', l: 'Vendedor' }, { k: 'fac', l: 'Facturas', n: 1, f: F.entero }, { k: 'neto', l: 'Venta neta', n: 1, f: F.dinero },
      { k: 'tk', l: 'Ticket', n: 1, f: F.dinero }, { k: 'mg', l: 'Margen $', n: 1, f: F.dinero, s: 1 }, { k: 'mgp', l: 'Margen %', n: 1, s: 1, f: v => '<span class="etq ' + (v < X.mgPct - 8 ? 'etq-r' : 'etq-n') + '">' + F.pct(v) + '</span>' },
      { k: 'dev', l: 'Devolución', n: 1, f: v => F.pct(v) }, { k: 'anul', l: 'Anuladas', n: 1, f: F.entero }, { k: 'p0', l: 'Salidas $0 (costo)', n: 1, f: F.dinero, s: 1 }, { k: 'cli', l: 'Clientes', n: 1, f: F.entero }];
    KIT.tabla(host, { buscar: false, cols: c.reunion ? cols.filter(x => !x.s) : cols, orden: ['neto', -1], clic: r => GIP.alternar('vend', r.name),
      filas: [...g.entries()].map(([v, o]) => ({ name: c.dims.vend[v], fac: o.fac, neto: o.neto, tk: o.tk, mg: o.mg, mgp: o.mgPct, dev: o.devPct, anul: o.anul, p0: o.p0, cli: o.cli })) });
  }

  /* ---- Clientes ------------------------------------------------------------------ */
  function anilloTipo(c, ch) {
    const g = sumaPor(c, c.sel, 'tipo', 'neto'), it = [...g.entries()].filter(e => e[1] > 0.5).map(([i, v]) => ({ name: c.dims.tipo[i], value: Math.round(v), itemStyle: { color: TCOL[i] } }));
    KIT.anillo(ch, it.sort((a, b) => b.value - a.value), { clic: n => GIP.alternar('tipo', n) });
  }
  function rankCli(c, ch) {
    const g = porGrupo(c, c.sel, 'cli'), p = [...g.entries()].filter(([, o]) => o.neto > 0).map(([cl, o]) => [c.dims.cli[cl], o.neto, o]).sort((a, b) => b[1] - a[1]).slice(0, 300);
    KIT.barrasH(ch, p, { izq: 200, izqMob: 116, trunc: 30, tip: q => F.dinero(q[1]) + '<br>' + F.entero(q[2].fac) + ' facturas' + (c.reunion ? '' : ', margen ' + F.pct(q[2].mgPct)), clic: q => GIP.alternar('cli', q[0]) });
  }
  function tablaFrios(c, host) {
    const fr = frios(c, D.frio), n = c.P.dayCount - 1;
    host.innerHTML = '<div class="tabla-acc"><span class="pista" style="margin:0">Sin venir desde hace más de</span><div class="selector" role="group">' + [15, 21, 30].map(d => '<button type="button" data-accion="frio" data-v="' + d
      + '" aria-pressed="' + (d === D.frio) + '">' + d + ' días</button>').join('') + '</div></div><div id="t-frio-t"></div>';
    KIT.tabla(document.getElementById('t-frio-t'), { cols: [{ k: 'name', l: 'Cliente', cls: 'nm' }, { k: 'tipo', l: 'Tipo' }, { k: 'fac', l: 'Facturas', n: 1, f: F.entero }, { k: 'neto', l: 'Compró', n: 1, f: F.dinero },
      { k: 'last', l: 'Última compra', n: 1, f: v => F.fecha(v) }, { k: 'dias', l: 'Días sin comprar', n: 1, f: v => '<span class="etq ' + (v > 30 ? 'etq-r' : 'etq-a') + '">' + v + ' días</span>' }],
    filas: fr.map(x => ({ name: c.dims.cli[x.cl], tipo: c.dims.tipo[c.dims.cliTipo[x.cl]], fac: x.o.fac, neto: x.o.neto, last: c.offAFecha(x.ult), dias: n - x.ult })), orden: ['neto', -1],
      buscarTexto: 'Buscar cliente', vacio: 'Ningún cliente frecuente lleva tanto tiempo sin comprar.' });
  }
  function grafNuevos(c, ch) {
    const ws = semanas(c, c.sel, () => 0), nv = ws.map(() => new Set()), rc = ws.map(() => new Set()), w0 = ws.length ? ws[0].w : 0, col = c.M.cols;
    for (const r of c.sel) { if (col.neto[r] <= 0) continue; const k = semana(col.dia[r]) - w0; if (k < 0 || k >= ws.length) continue;
      (semana(D.primera.get(col.cli[r])) === semana(col.dia[r]) ? nv : rc)[k].add(col.cli[r]); }
    ch.setOption({ grid: KIT.rejilla({ top: 34 }), legend: KIT.leyenda({ top: 0, bottom: 'auto' }), tooltip: KIT.tooltip(), xAxis: KIT.ejeCat(ws.map(x => x.lab)), yAxis: KIT.ejeVal(v => F.entero(v)),
      series: [{ name: 'Recurrentes', type: 'bar', stack: 'c', barMaxWidth: 40, data: rc.map(s => s.size), itemStyle: { color: C.blue } },
        { name: 'Nuevos', type: 'bar', stack: 'c', barMaxWidth: 40, data: nv.map(s => s.size), itemStyle: { color: C.blueSoft, borderRadius: [3, 3, 0, 0] } }] }, true);
  }
  function grafPareto(c, ch) {
    const g = sumaPor(c, c.sel, 'cli', 'neto'), vs = [...g.values()].filter(v => v > 0).sort((a, b) => b - a), tot = vs.reduce((s, v) => s + v, 0);
    if (!vs.length) { KIT.vacio(ch); return; }
    let acc = 0, n80 = 0; const cum = vs.map((v, i) => { acc += v; const p = acc / tot * 100; if (p <= 80) n80 = i + 1; return p; });
    const paso = Math.max(1, Math.ceil(vs.length / 150)), pts = []; for (let i = 0; i < vs.length; i += paso) pts.push([i + 1, +cum[i].toFixed(1)]); pts.push([vs.length, 100]);
    ch.setOption({ grid: KIT.rejilla({ bottom: 40 }), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, formatter: ps => 'Los primeros ' + F.entero(ps[0].value[0]) + ' clientes<br>hacen el ' + F.pct(ps[0].value[1]) + ' de la venta' }),
      xAxis: { type: 'value', min: 0, max: vs.length, name: 'clientes, del mayor al menor', nameLocation: 'middle', nameGap: 26, nameTextStyle: { fontSize: KIT.fs(10), color: '#5E6A7E' },
        axisLabel: { fontSize: KIT.fs(10), color: '#5E6A7E', formatter: v => F.entero(v) }, splitLine: { show: false } }, yAxis: KIT.ejeVal(v => v + ' %', { max: 100 }),
      series: [{ type: 'line', data: pts, symbol: 'none', smooth: true, lineStyle: { color: C.blue, width: 2.5 }, areaStyle: { color: 'rgba(15,79,156,.08)' },
        markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', color: '#5E6A7E' }, label: { fontSize: KIT.fs(10), color: '#5E6A7E', position: 'insideEndBottom',
          formatter: F.entero(n80 + 1) + ' de ' + F.entero(vs.length) + ' clientes hacen el 80 %' }, data: [{ yAxis: 80 }] } }] }, true);
  }
  function tablaClientes(c, host) {
    const g = porGrupo(c, c.sel, 'cli'), col = c.M.cols, pri = new Map(), ult = new Map();
    for (const r of c.sel) if (col.neto[r] > 0) { const cl = col.cli[r], d = col.dia[r]; if (!pri.has(cl) || d < pri.get(cl)) pri.set(cl, d); if (!ult.has(cl) || d > ult.get(cl)) ult.set(cl, d); }
    const cols = [{ k: 'name', l: 'Cliente', cls: 'nm' }, { k: 'cod', l: 'Código' }, { k: 'tipo', l: 'Tipo' }, { k: 'fac', l: 'Facturas', n: 1, f: F.entero }, { k: 'neto', l: 'Venta neta', n: 1, f: F.dinero },
      { k: 'tk', l: 'Ticket', n: 1, f: F.dinero }, { k: 'mg', l: 'Margen', n: 1, f: v => v == null ? '–' : F.pct(v), s: 1 }, { k: 'first', l: 'Primera compra', n: 1, f: v => v ? F.fecha(v) : '–' },
      { k: 'last', l: 'Última compra', n: 1, f: v => v ? F.fecha(v) : '–' }];
    KIT.tabla(host, { cols: c.reunion ? cols.filter(x => !x.s) : cols, orden: ['neto', -1], buscarTexto: 'Buscar cliente o código', clic: r => GIP.alternar('cli', r.name),
      filas: [...g.entries()].map(([cl, o]) => ({ name: c.dims.cli[cl], cod: c.dims.cliCod[cl], tipo: c.dims.tipo[c.dims.cliTipo[cl]], fac: o.fac, neto: o.neto, tk: o.tk, mg: o.vm > 0 ? o.mgPct : null,
        first: pri.has(cl) ? c.offAFecha(pri.get(cl)) : '', last: ult.has(cl) ? c.offAFecha(ult.get(cl)) : '' })) });
  }

  /* ---- Devoluciones y anulaciones ------------------------------------------------- */
  function grafDevSem(c, ch) {
    const por = filasPorSemana(c), ws = semanas(c, c.sel, () => 0).map(x => ({ x, o: agg(c, Uint32Array.from(por.get(x.w) || [])) }));
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, formatter: ps => { const z = ws[ps[0].dataIndex]; return '<b>Semana del ' + F.fechaCorta(c.offAFecha(z.x.s)) + '</b><br>'
        + F.pct(z.o.devPct) + ' de la venta bruta<br>' + F.dinero(z.o.devm) + ' devueltos, ' + F.entero(z.o.anul) + ' anuladas'; } }),
      xAxis: KIT.ejeCat(ws.map(z => z.x.lab)), yAxis: KIT.ejeVal(v => v + ' %'),
      series: [{ type: 'line', data: ws.map(z => +z.o.devPct.toFixed(1)), symbol: 'circle', symbolSize: 7, lineStyle: { color: C.red, width: 2.5 }, itemStyle: { color: C.red }, areaStyle: { color: 'rgba(215,25,31,.07)' },
        label: { show: !c.mob, position: 'top', fontSize: KIT.fs(10), color: '#5E6A7E', formatter: p => F.pct(p.value).replace(' %', '') } }] }, true);
  }
  function grafDevVend(c, ch) {
    const g = porGrupo(c, c.sel, 'vend'), p = [...g.entries()].filter(([, o]) => o.devm > 0.5).map(([v, o]) => [c.dims.vend[v], o.devm, o]).sort((a, b) => b[1] - a[1]);
    KIT.barrasH(ch, p, { izq: 96, izqMob: 76, color: C.red, label: q => F.corto(q[1]) + ', ' + F.entero(q[2].anul) + ' anul.',
      tip: q => F.dinero(q[1]) + ' devueltos (' + F.pct(q[2].devPct) + ' de su venta bruta)<br>' + F.entero(q[2].anul) + ' facturas anuladas completas', clic: q => GIP.alternar('vend', q[0]) });
  }
  function grafDevProd(c, ch) {
    const pd = sumaPor(c, c.sel, 'prod', 'devm'), p = [...pd.entries()].filter(e => e[1] > 0.5).map(([pr, v]) => [c.dims.prod[pr], v]).sort((a, b) => b[1] - a[1]).slice(0, 150);
    KIT.barrasH(ch, p, { izq: 230, izqMob: 120, trunc: 34, color: C.red, clic: q => GIP.alternar('prod', q[0]) });
  }
  function grafDevSerie(c, ch) {
    const g = porGrupo(c, c.sel, 'serie'), se = [0, 1].filter(s => g.has(s)).map(s => ({ s, o: g.get(s), name: s ? 'Serie * (fiscal)' : 'Serie numérica' }));
    ch.setOption({ grid: KIT.rejilla(), tooltip: KIT.tooltip({ formatter: ps => { const x = se[ps[0].dataIndex]; return '<b>' + x.name + '</b><br>' + F.dinero(x.o.devm) + ' devueltos de ' + F.dinero(x.o.bruto) + ' (' + F.pct(x.o.devPct) + ')<br>'
        + F.entero(x.o.anul) + ' facturas anuladas completas'; } }), xAxis: KIT.ejeCat(se.map(x => x.name)), yAxis: KIT.ejeVal(),
      series: [{ type: 'bar', barMaxWidth: 70, data: se.map(x => Math.round(x.o.devm)), itemStyle: { color: C.red, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: KIT.fs(11), color: '#0F1B33', formatter: p => F.dinero(p.value) + ', ' + F.pct(se[p.dataIndex].o.devPct, 0) } }] }, true);
  }
  function tablaAnuladas(c, host) {
    const col = c.M.cols, e = c.M.esc.neto, docs = new Map();
    for (const r of c.sel) { let o = docs.get(col.doc[r]); if (!o) { o = { c: 0, v: 0, m: 0, r }; docs.set(col.doc[r], o); } o.c += col.cant[r]; o.v += col.dev[r]; o.m += col.devm[r] / e; }
    const an = [...docs.entries()].filter(([, o]) => o.c > 0 && o.v >= o.c - 1e-6);
    KIT.tabla(host, { cols: [{ k: 'fecha', l: 'Fecha', f: v => F.fecha(v) }, { k: 'doc', l: 'Factura' }, { k: 'serie', l: 'Serie' }, { k: 'cli', l: 'Cliente', cls: 'nm' }, { k: 'vend', l: 'Vendedor' },
      { k: 'm', l: 'Monto', n: 1, f: F.dinero2 }], orden: ['fecha', -1], buscarTexto: 'Buscar factura, cliente o vendedor', vacio: 'Ninguna factura anulada completa en esta selección.',
      filas: an.map(([k, o]) => ({ fecha: c.offAFecha(col.dia[o.r]), doc: c.dims.doc[k], serie: c.dims.docSerie[k] ? '*' : 'Numérica', cli: c.dims.cli[col.cli[o.r]], vend: c.dims.vend[col.vend[o.r]], m: o.m })) });
  }

  /* ---- Comparar periodos (por dia de venta) --------------------------------------- */
  function comp(c) {
    const st = GIP.S.tablas.compC || (GIP.S.tablas.compC = (() => { const n = c.P.dayCount, lastM = c.dims.dayMes[n - 1];
      if (lastM > 0) { const [pa, pb] = rangoMesIdx(c, lastM - 1), [ca, cb] = rangoMesIdx(c, lastM); return { A: [pa, pb], B: [ca, cb] }; }
      return { A: [Math.max(0, n - 14), n - 8], B: [n - 7, n - 1] }; })());
    return { st, A: valores(c, filas(c, st.A[0], st.A[1]), st.A[0], st.A[1]), B: valores(c, filas(c, st.B[0], st.B[1]), st.B[0], st.B[1]) };
  }
  function htmlComp(c, host) {
    const { st, A: a, B: b } = comp(c), fd = o => c.offAFecha(o);
    const mt = [['Días de venta', 'sd', F.entero], ['Venta neta', 'neto', F.dinero], ['Venta por día de venta', 'rate', F.dinero, 'r'], ['Margen bruto', 'mgPct', v => F.pct(v), 'pp'],
      ['Ticket promedio', 'tk', F.dinero, 'r'], ['Facturas', 'fac', F.entero], ['Facturas por día', 'facD', v => v.toFixed(1).replace('.', ','), 'r'], ['Clientes', 'cli', F.entero],
      ['Clientes nuevos', 'nuevos', F.entero], ['Devoluciones', 'devPct', v => F.pct(v), 'pp', 1]];
    host.innerHTML = '<div class="tabla-acc"><label class="pista" style="margin:0">A <input type="date" id="cA0" value="' + fd(st.A[0]) + '"> a <input type="date" id="cA1" value="' + fd(st.A[1]) + '"></label>'
      + '<label class="pista" style="margin:0">B <input type="date" id="cB0" value="' + fd(st.B[0]) + '"> a <input type="date" id="cB1" value="' + fd(st.B[1]) + '"></label>'
      + '<button class="btn btn-pri" type="button" data-accion="comparar">Comparar</button></div>'
      + '<div class="envoltura"><table><thead><tr><th>Indicador</th><th class="num">A</th><th class="num">B</th><th class="num">B frente a A</th></tr></thead><tbody>'
      + mt.map(m => { const va = a[m[1]], vb = b[m[1]], d = m[3] ? GIP.delta({ v: m[3] === 'pp' ? vb - va : (va ? (vb - va) / Math.abs(va) * 100 : null), pp: m[3] === 'pp', inverso: !!m[4] }) : '';
        return '<tr><td>' + m[0] + '</td><td class="num">' + m[2](va) + '</td><td class="num">' + m[2](vb) + '</td><td class="num">' + d + '</td></tr>'; }).join('')
      + '</tbody></table></div><p class="notas">Los totales dependen de cuántos días abrió la tienda: la diferencia se mide en las filas por día y en los porcentajes. Respeta los segmentadores.</p>';
  }
  function grafCompCurva(c, ch) {
    const { st } = comp(c), curva = r => { const d = c.M.porDia(filas(c, r[0], r[1]), 'neto', c.P.dayCount); let acc = 0; const o = []; for (let i = r[0]; i <= r[1]; i++) if (D.tiendaAbre[i]) { acc += d[i]; o.push(Math.round(acc)); } return o; };
    const ca = curva(st.A), cb = curva(st.B), L = Math.max(ca.length, cb.length);
    ch.setOption({ grid: KIT.rejilla({ top: 34 }), legend: KIT.leyenda({ top: 0, bottom: 'auto' }), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, valueFormatter: v => v == null ? '–' : F.dinero(v) }),
      xAxis: KIT.ejeCat(Array.from({ length: L }, (_, i) => i + 1), { name: 'día de venta', nameLocation: 'middle', nameGap: 22 }), yAxis: KIT.ejeVal(),
      series: [{ name: 'A', type: 'line', data: ca, symbol: 'none', lineStyle: { color: C.slate, width: 2.5, type: 'dashed' }, itemStyle: { color: C.slate } },
        { name: 'B', type: 'line', data: cb, symbol: 'none', lineStyle: { color: C.blue, width: 2.5 }, itemStyle: { color: C.blue } }] }, true);
  }

  /* ---- Registro ----------------------------------------------------------------- */
  const g = (id, titulo, pista, tip, render, o) => Object.assign({ id, tipo: 'g', titulo, pista, tip, render }, o || {});
  const h = (id, titulo, pista, tip, render, o) => Object.assign({ id, tipo: 'html', titulo, pista, tip, render }, o || {});
  GIP.registrar({
    tema: { serie: C.blue, enfasis: C.red, paleta: PAL, calor: ['#E3ECF8', '#8FB0DC', '#0F4F9C', '#0A2F5E'], tinta: '#0F1B33', tinta2: '#5E6A7E' },
    iniciar, barraExtra, kpis, reunionFoco: 'vend',
    segmentadores: P => [
      { k: 'mes', col: 'mes', label: 'Mes', nombres: P.dims.mesLabels }, { k: 'grupo', col: 'grupo', label: 'Grupo', nombres: P.dims.grupo },
      { k: 'vend', col: 'vend', label: 'Vendedor', nombres: P.dims.vend }, { k: 'tipo', col: 'tipo', label: 'Tipo de cliente', nombres: P.dims.tipo },
      { k: 'marca', col: 'marca', label: 'Marca', nombres: P.dims.marca }, { k: 'cli', col: 'cli', label: 'Cliente', nombres: P.dims.cli, buscarEn: P.dims.cliCod },
      { k: 'prod', col: 'prod', label: 'Producto', nombres: P.dims.prod, buscarEn: P.dims.prodCod }],
    pasos: [{ t: 'Cómo vamos', secciones: ['inicio', 'tiempo'] }, { t: 'Qué lo mueve', secciones: ['inv', 'vend', 'cli', 'rent'] },
      { t: 'Qué atender', secciones: ['dev'] }, { t: 'Herramientas', secciones: ['comp', 'novedades'] }],
    agendaReunion: ['inicio', 'vend', 'cli', 'inv', 'dev'],
    acciones: {
      frio: v => { D.frio = +v; },
      comparar: (v, c) => { const o = id => c.fechaAOff(document.getElementById(id).value), st = GIP.S.tablas.compC;
        const r = (a, b) => [Math.max(0, Math.min(a, b)), Math.min(c.P.dayCount - 1, Math.max(a, b))];
        if (![o('cA0'), o('cA1'), o('cB0'), o('cB1')].some(isNaN)) { st.A = r(o('cA0'), o('cA1')); st.B = r(o('cB0'), o('cB1')); } },
    },
    secciones: {
      inicio: { nav: 'Inicio', titular, kpis: true, reunion: true, bandas: [
        { cols: '21', tarjetas: [
          g('c-sem', 'Venta por semana', 'De lunes a sábado. La barra rayada es la semana en curso.', 'Venta neta de cada semana. La rayada todavía no tiene todos sus días.', (c, el, ch) => grafSemanas(c, ch), { sensible: true }),
          g('c-grupo', 'Venta por grupo', 'Clic en una porción para filtrar.', 'Parte de la venta neta de cada grupo de productos.', (c, el, ch) => anilloGrupo(c, ch))] },
        { cols: '2', tarjetas: [
          g('c-vend10', 'Vendedores', 'Venta neta. Clic para filtrar.', 'Venta neta de cada vendedor en la selección.', (c, el, ch) => rankVend(c, ch)),
          g('c-prod10', 'Productos más vendidos', 'Desliza para ver más. Clic para filtrar.', 'Productos ordenados por venta neta.', (c, el, ch) => rankProd(c, ch, 'neto', { izq: 214, ventana: c.mob ? 8 : 10 }))] },
        { tarjetas: [h('alertas', 'Qué atender', 'Calculado sobre la selección. Cada alerta lleva a su sección.', null, htmlAlertas)] }] },
      tiempo: { nav: 'Ventas en el tiempo', pregunta: '¿Cómo se reparte la venta entre días, semanas y horas?', reunion: false,
        lectura: c => { const X = A(c); return 'En el rango elegido la tienda abrió <b>' + X.sd + ' días</b> y vendió <b>' + F.dinero(X.rate) + ' por día de venta</b>. Los meses se comparan por día de venta porque no tienen el mismo largo.'; },
        bandas: [
          { cols: '2', tarjetas: [
            g('c-ritmo', 'Venta por día de venta, cada mes', 'Compara meses de distinto largo. El mes en curso va rayado.', 'Venta neta entre los días que abrió la tienda en el mes.', (c, el, ch) => grafRitmo(c, ch), { alto: 'sm' }),
            g('c-cum', 'Venta acumulada', 'Suma día a día del período elegido.', 'Venta neta sumada día a día.', (c, el, ch) => grafAcum(c, ch), { alto: 'sm' })] },
          { tarjetas: [g('c-dia', 'Venta neta por día', 'Barras: cada día de venta. Línea: promedio de los últimos 6 días de venta.', 'La línea suaviza los picos para ver la tendencia.', (c, el, ch) => grafDia(c, ch))] },
          { cols: '2', tarjetas: [
            g('c-hora', 'Facturas por día y hora', 'Cuándo hay más movimiento en caja.', 'Facturas emitidas en cada combinación de día y hora. Sirve para planificar caja y despacho.', (c, el, ch) => grafHora(c, ch)),
            g('c-dow', 'Venta promedio por día de la semana', 'Total de cada día entre las veces que abrió.', 'Venta neta promedio de cada día de la semana en el período.', (c, el, ch) => grafDow(c, ch))] },
          { tarjetas: [h('t-sem', 'Semana a semana', 'Clic en un encabezado para ordenar.', null, tablaSemanas)] },
          { tarjetas: [g('c-cal', 'Calendario de ventas', 'Cada celda es un día. Los domingos la tienda cierra.', 'Venta neta de cada día.', (c, el, ch) => KIT.calendario(ch, c.M.porDia(c.sel, 'neto', c.P.dayCount)), { alto: 'xs' })] }] },
      inv: { nav: 'Productos e inventario', pregunta: '¿Qué se vende y qué se está agotando?', reunion: true,
        lectura: c => { const r = abc(c); return r.vs.length ? '<b>' + F.entero(r.nA) + ' productos</b> (' + F.pct(r.nA / r.vs.length * 100, 0) + ') hacen el 80 % de la venta. ' + F.entero(A(c).agot) + ' de los vendidos están hoy en existencia cero.' : 'No hay ventas en esta selección.'; },
        bandas: [
          { tarjetas: [h('t-agot', 'Agotados que se siguen vendiendo', 'Vendidos en el período y hoy sin existencia. Ordenados por venta.', null, tablaAgotados)] },
          { cols: '2', tarjetas: [
            g('c-prodneto', 'Productos por venta neta', 'Desliza para ver más. Clic para filtrar.', 'Productos ordenados por venta neta.', (c, el, ch) => rankProd(c, ch, 'neto'), { alto: 'lg' }),
            g('c-produ', 'Productos por unidades', 'Desliza para ver más. Clic para filtrar.', 'Productos ordenados por unidades netas vendidas.', (c, el, ch) => rankProd(c, ch, 'q'), { alto: 'lg' })] },
          { cols: '2', tarjetas: [
            g('c-cobinv', 'Días de inventario de los más vendidos', 'Existencia actual al ritmo de venta del período.', 'Rojo: menos de 15 días. Ámbar: menos de 30.', (c, el, ch) => grafCobertura(c, ch)),
            g('c-abc', 'Curva ABC de productos', 'Qué parte de la venta hacen pocos productos.', 'Clase A hasta el 80 % de la venta, B hasta el 95 %, C el resto.', (c, el, ch) => grafABC(c, ch))] },
          { tarjetas: [h('t-prod', 'Tabla de productos', 'Clic en un encabezado para ordenar.', null, tablaProductos)] }] },
      vend: { nav: 'Vendedores', pregunta: '¿Quién vende y cómo vende?', reunion: true,
        lectura: c => { const g0 = porGrupo(c, c.sel, 'vend'), r = [...g0.entries()].sort((a, b) => b[1].neto - a[1].neto), tot = r.reduce((s, x) => s + x[1].neto, 0);
          return r.length && tot ? '<b>' + esc(c.dims.vend[r[0][0]]) + '</b> hace el ' + F.pct(r[0][1].neto / tot * 100) + ' de la venta, con un ticket de ' + F.dinero(r[0][1].tk) + '.' : 'No hay ventas en esta selección.'; },
        bandas: [
          { cols: '2', tarjetas: [
            g('c-vendrank', 'Venta por vendedor', 'Clic en una barra para filtrar.', 'Venta neta de cada vendedor en la selección.', (c, el, ch) => rankVend(c, ch)),
            g('c-vendmg', 'Margen por vendedor', 'En rojo, 8 puntos o más bajo el promedio de la tienda.', 'Margen bruto % de cada vendedor. La línea es el margen de la tienda.', (c, el, ch) => grafVendMg(c, ch), { sensible: true })] },
          { tarjetas: [g('c-vendmes', 'Evolución mensual por vendedor', 'Venta por día de venta de los 5 que más venden.', 'El mes en curso lleva pocos días y todavía puede moverse.', (c, el, ch) => grafVendMes(c, ch))] },
          { tarjetas: [h('t-vend', 'Tabla de vendedores', 'Clic en una fila para filtrar.', null, tablaVend)] }] },
      cli: { nav: 'Clientes', pregunta: '¿Quién compra y quién dejó de venir?', reunion: true,
        lectura: c => { const X = A(c), fr = frios(c, D.frio); return '<b>' + F.entero(X.cli) + ' clientes</b> compraron en la selección; ' + F.entero(X.nuevos) + ' por primera vez. ' + F.entero(fr.length) + ' clientes frecuentes llevan más de ' + D.frio + ' días sin venir.'; },
        bandas: [
          { tarjetas: [h('t-frio', 'Clientes que dejaron de venir', 'Compraron dos veces o más y no vuelven.', null, tablaFrios)] },
          { cols: '2', tarjetas: [
            g('c-tipo', 'Venta por tipo de cliente', 'Según el RIF o la cédula. Clic para filtrar.', 'V persona, J empresa, G gobierno, C1 consumidor final.', (c, el, ch) => anilloTipo(c, ch)),
            g('c-cli10', 'Clientes con más compras', 'Desliza para ver más. Clic para filtrar.', 'Clientes ordenados por venta neta.', (c, el, ch) => rankCli(c, ch))] },
          { cols: '2', tarjetas: [
            g('c-nuevos', 'Clientes nuevos y recurrentes', 'Clientes distintos por semana.', 'Nuevos: su primera compra en la tienda. Recurrentes: ya habían comprado.', (c, el, ch) => grafNuevos(c, ch)),
            g('c-pareto', 'Concentración de clientes', 'Qué parte de la venta hacen los primeros clientes.', 'Curva acumulada del cliente que más compra al que menos.', (c, el, ch) => grafPareto(c, ch))] },
          { tarjetas: [h('t-cli', 'Tabla de clientes', 'Clic en una fila para filtrar.', null, tablaClientes)] }] },
      rent: { nav: 'Rentabilidad', pregunta: '¿Dónde se gana y dónde se pierde margen?', reunion: false,
        lectura: c => { const X = A(c); return 'Margen bruto de <b>' + F.pct(X.mgPct) + '</b>: ' + F.dinero(X.mg) + ' sobre ' + F.dinero(X.vm) + ' de venta con costo registrado.' + (X.p0 > 0.5 ? ' Aparte salieron ' + F.dinero(X.p0) + ' a precio $0.' : ''); },
        bandas: [
          { cols: '2', tarjetas: [
            g('c-mg-grupo', 'Margen por grupo', 'Dólares de margen. La etiqueta dice el % sobre la venta.', 'Venta neta menos costo de lo vendido, por grupo.', (c, el, ch) => grafMgGrupo(c, ch), { alto: 'sm' }),
            g('c-mg-sem', 'Margen bruto por semana', '% sobre la venta neta. La línea punteada es el promedio.', 'Margen bruto % semana a semana.', (c, el, ch) => grafMgSemana(c, ch), { alto: 'sm' })] },
          { tarjetas: [g('c-matriz', 'Matriz de productos: venta contra margen', 'Los 60 más vendidos. Clic en un punto para filtrar.', 'Más a la derecha vende más; más arriba deja más margen.', (c, el, ch) => grafMatriz(c, ch), { alto: 'lg' })] },
          { cols: '2', tarjetas: [
            g('c-mg-marca', 'Margen por marca', 'Dólares de margen. Desliza para ver más.', 'Margen bruto en dólares por marca.', (c, el, ch) => grafMgMarca(c, ch)),
            g('c-p0', 'Salidas a precio $0 por cliente', 'Mercancía entregada sin cobro; no entra en el margen.', 'Costo de lo que salió a precio $0: autoconsumo, retiro u obsequio.', (c, el, ch) => grafP0(c, ch))] },
          { tarjetas: [h('t-p0', 'Líneas a precio $0 y bajo costo', 'Cada línea con su factura, cliente y vendedor.', null, tablaP0)] }] },
      dev: { nav: 'Devoluciones y anulaciones', pregunta: '¿Cuánto se devuelve y quién anula?', reunion: true,
        lectura: c => { const X = A(c); return 'Se devolvió el <b>' + F.pct(X.devPct) + '</b> de la venta bruta, con <b>' + F.entero(X.anul) + ' facturas anuladas completas</b>. Una factura fiscal se anula devolviéndola entera.'; },
        bandas: [
          { cols: '2', tarjetas: [
            g('c-dev-sem', 'Devoluciones por semana', '% de la venta bruta, con las anuladas completas.', 'Dólares devueltos entre la venta bruta de cada semana.', (c, el, ch) => grafDevSem(c, ch), { alto: 'sm' }),
            g('c-dev-vend', 'Devuelto por vendedor', 'El detalle dice cuántas facturas anuló.', 'Dólares devueltos por vendedor en la selección.', (c, el, ch) => grafDevVend(c, ch), { alto: 'sm' })] },
          { cols: '2', tarjetas: [
            g('c-dev-prod', 'Productos más devueltos', 'Dólares devueltos. Desliza para ver más.', 'Productos con más dólares devueltos.', (c, el, ch) => grafDevProd(c, ch)),
            g('c-dev-serie', 'Devuelto por serie de factura', 'La serie * son facturas fiscales, desde el 14 de agosto.', 'Devuelto en cada serie y su % sobre la venta bruta de esa serie.', (c, el, ch) => grafDevSerie(c, ch))] },
          { tarjetas: [h('t-anul', 'Facturas anuladas completas', 'Toda la factura devuelta: así se anula una factura fiscal.', null, tablaAnuladas)] }] },
      comp: { nav: 'Comparar períodos', pregunta: '¿Cómo le fue a un período frente a otro?', reunion: false,
        lectura: () => 'Por defecto, el mes del corte contra el anterior, día de venta contra día de venta.',
        bandas: [{ tarjetas: [h('comp', 'Indicadores de A y B', 'Respeta los segmentadores.', null, htmlComp)] },
          { tarjetas: [g('c-cmp-curva', 'Ritmo acumulado', 'Venta acumulada por día de venta de cada período.', 'Si la línea de B va por encima, B lleva mejor ritmo.', (c, el, ch) => grafCompCurva(c, ch))] }] },
      novedades: GIP.seccionNovedades,
    },
  });
})(window);
