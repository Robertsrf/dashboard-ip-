/* Reunion de vendedores 2026: presentacion por pasos dentro del sistema.
   Usa el paquete de REUNION de IP (sin totales de la empresa, sin costos ni
   margenes, ver grupo/reunion.py) y nunca pinta un total en dolares: solo
   participaciones, variaciones, conteos y la venta de cada vendedor.
   Las comparaciones usan meses CERRADOS: si el corte cae a mitad de mes, ese
   mes no entra (se nombra como "va por la mitad"). */
(function (G) {
  'use strict';
  const GIP = G.GIP, F = GIP.F, esc = GIP.esc;
  const $ = s => document.querySelector(s);
  const SERIE = '#24205b', MARCA = '#ff4f20', MARCA_T = '#c93608', POS = '#15803D', NEG = '#B42318', GRIS = '#C9CFDC';
  const PAL = ['#24205b', '#ff4f20', '#17a39a', '#b7800f', '#5b6aa0', '#c2417a', '#3a8fc1', '#7c9a2b'];
  const REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOV = { animationDuration: 900, animationEasing: 'cubicOut', animationDurationUpdate: 650, animationEasingUpdate: 'cubicInOut' };
  const vnorm = s => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const fsz = n => Math.round(n * Math.min(1.7, Math.max(1, innerWidth / 1280)));
  const pctVar = (a, b) => b ? (a - b) / Math.abs(b) * 100 : null;
  const MIN_BASE = 5000;
  const dlt = v => F.delta(v, Math.abs(v) < 10 ? 1 : 0);   // con cambios chicos un decimal: nunca "−0 %"   // con bases chicas el porcentaje engana (mismo criterio que el dashboard)
  let D = null;

  /* ---- Datos: todo sale del paquete de reunion -------------------------- */
  function calcular(S) {
    const P = S.P, M = S.M, dims = P.dims, nM = dims.mes.length;
    const dm = P.dateMax.split('-'), finMes = new Date(+dm[0], +dm[1], 0).getDate();
    const ult = +dm[2] === finMes ? nM - 1 : nM - 2;            // ultimo mes cerrado
    const mesN = i => F.mes(dims.histMonthNums[i] - 1), mesC = i => dims.mesLabels[i];
    const cerr = Array.from({ length: ult + 1 }, (_, i) => i);
    const sel = M.seleccion({ f: { mes: new Set(cerr) }, rango: null });
    const gm = M.agrupar(sel, 'mes', { sumas: ['neto'], distintos: ['doc', 'cli'] });
    const porMes = cerr.map(i => ({ i, neto: gm.neto[i] || 0, doc: gm.doc[i] || 0, cli: gm.cli[i] || 0 }));
    const totAno = porMes.reduce((a, m) => a + m.neto, 0) || 1;
    const xv = M.cruzar(sel, 'vend', 'mes', 'neto'), gv = M.agrupar(sel, 'vend', { sumas: ['neto'], distintos: ['doc', 'cli'] });
    const gvu = M.agrupar(M.seleccion({ f: { mes: new Set([ult]) }, rango: null }), 'vend', { sumas: ['neto'], distintos: ['cli'] });
    const xcli = M.cruzar(sel, 'vend', 'cli', 'neto'), xest = M.cruzar(sel, 'vend', 'estado', 'neto'), xgru = M.cruzar(sel, 'vend', 'grupo', 'neto');
    const xpro = M.cruzar(sel, 'vend', 'prod', 'neto'), xcan = M.cruzar(sel, 'vend', 'prod', 'cant');
    const primero = new Int32Array(M.cardinal('vend')).fill(-1), ultimo = new Int32Array(M.cardinal('vend')).fill(-1);
    for (let k = 0; k < sel.length; k++) { const r = sel[k], v = M.cols.vend[r], d = M.cols.dia[r];
      if (primero[v] < 0 || d < primero[v]) primero[v] = d; if (d > ultimo[v]) ultimo[v] = d; }
    const tri = ult >= 5 ? { a: [ult - 5, ult - 4, ult - 3], b: [ult - 2, ult - 1, ult] } : null;
    const vendedores = [];
    for (let a = 0; a < gv.filas.length; a++) {
      const nombre = dims.vend[a];
      if (!gv.filas[a] || /^\d+$/.test(nombre) || gv.neto[a] < 1000) continue;   // "2", "23": errores de captura del ERP
      const serie = cerr.map(m => xv.v[a * xv.nB + m]);
      const prom = ms => ms.reduce((s, m) => s + serie[m], 0) / ms.length;
      const fila = (x, dimN) => { const out = []; for (let b = 0; b < x.nB; b++) { const v = x.v[a * x.nB + b]; if (v > 0) out.push([dimN[b], v]); }
        return out.sort((p, q) => q[1] - p[1]); };
      const top = fila(xcli, dims.cli), zonas = fila(xest, dims.estado), gru = fila(xgru, dims.grupo), pro = fila(xpro, dims.prod);
      const pk = pro.length ? dims.prod.indexOf(pro[0][0]) : -1, de = x => x / gv.neto[a] * 100;
      vendedores.push({ a, nombre, neto: gv.neto[a], part: gv.neto[a] / totAno * 100, serie,
        varMes: serie[ult - 1] >= MIN_BASE ? pctVar(serie[ult], serie[ult - 1]) : null,
        varTri: tri && prom(tri.a) >= MIN_BASE ? pctVar(prom(tri.b), prom(tri.a)) : null,
        mejor: serie.indexOf(Math.max(...serie)), clientes: gv.cli[a], clientesUlt: gvu.cli[a] || 0,
        ticket: gv.doc[a] ? gv.neto[a] / gv.doc[a] : 0, top: top.slice(0, 3).map(t => [t[0], t[1] / gv.neto[a] * 100]),
        zona: zonas.length ? [zonas[0][0], de(zonas[0][1])] : null, grupo: gru.length ? [gru[0][0], de(gru[0][1])] : null,
        prod: pk >= 0 ? [pro[0][0], xcan.v[a * xcan.nB + pk], de(pro[0][1])] : null,
        desde: primero[a], hasta: ultimo[a] });
    }
    vendedores.sort((p, q) => q.part - p.part);
    vendedores.forEach((v, k) => { v.puesto = k + 1; });

    const xe = M.cruzar(sel, 'estado', 'mes', 'neto'), ge = M.agrupar(sel, 'estado', { sumas: ['neto'] }), estados = [];
    for (let e = 0; e < ge.filas.length; e++) if (ge.filas[e] && ge.neto[e] > 0) {
      const u = xe.v[e * xe.nB + ult], p = xe.v[e * xe.nB + ult - 1];
      estados.push({ nombre: dims.estado[e], part: ge.neto[e] / totAno * 100, varMes: p >= MIN_BASE ? pctVar(u, p) : null });
    }
    estados.sort((p, q) => q.part - p.part);

    const gc = M.agrupar(sel, 'cli', { sumas: ['neto'] }), vs = Array.from(gc.neto).filter(v => v > 0).sort((p, q) => q - p);
    let acc = 0, n80 = 0; for (const v of vs) { acc += v; n80++; if (acc >= totAno * 0.8) break; }
    const todo = M.seleccion({ f: {}, rango: null }), uc = M.ultimoDia(todo, 'cli'), hoy = P.dayCount - 1;
    let inactivos = 0; for (let c = 0; c < uc.length; c++) if (uc[c] >= 0 && hoy - uc[c] > 45) inactivos++;

    const xg = M.cruzar(sel, 'grupo', 'mes', 'neto'), gg = M.agrupar(sel, 'grupo', { sumas: ['neto'] }), grupos = [];
    for (let g = 0; g < gg.filas.length; g++) if (gg.filas[g] && gg.neto[g] / totAno > 0.005)
      grupos.push({ nombre: dims.grupo[g], serie: cerr.map(m => { const t = porMes[m].neto; return t ? xg.v[g * xg.nB + m] / t * 100 : 0; }), part: gg.neto[g] / totAno * 100 });
    grupos.sort((p, q) => q.part - p.part);

    return { P, ult, mesN, mesC, cerr, porMes, vendedores, estados, n80, inactivos, grupos, tri,
      parcial: ult < nM - 1, mesCorte: mesN(nM - 1), diaCorte: +dm[2],
      lineas: M.n, facturas: M.total(todo, { distintos: ['doc'] }).doc, clientesAno: M.total(sel, { distintos: ['cli'] }).cli,
      riesgo: resumenRiesgo(P.riskList), cobro: cobranza(P.Pcob), cobCuadre: cuadreCobranza(P.Pcob), ctl: P.controles || {}, enlaces: P.enlaces || {} };
  }

  /* Los mismos conteos del build (grupo/control.py), rehechos AHORA por el
     motor de este navegador: el tercer camino del cuadre. */
  function recontar(M) {
    const t0 = performance.now(), o = M.total(M.seleccion({ f: {}, rango: null }), { distintos: ['doc', 'cli', 'prod'] });
    const a = M.cols.neto; let c = 0; for (let i = 0; i < a.length; i++) c += a[i];
    return { lineas: o.filas, facturas: o.doc, clientes: o.cli, productos: o.prod, centavos: Math.round(c * 100 / M.esc.neto), ms: performance.now() - t0 };
  }
  /* Huella SHA-256 del total en centavos, igual que grupo/control.huella */
  async function huella(centavos) {
    if (!(G.crypto && crypto.subtle)) return null;
    const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(centavos))));
    const h = Array.from(b.slice(0, 4), x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    return h.slice(0, 4) + ' ' + h.slice(4);
  }
  /* Facturado = cobrado + pendiente + diferencial, camada por camada, en vivo */
  function cuadreCobranza(COB) {
    if (!COB) return null;
    const por = new Map();
    for (const r of COB.rows) { if (r[5] === COB.anulIdx) continue; por.set(r[0], (por.get(r[0]) || 0) + r[6] - r[7] - r[8] - r[9]); }
    const d = Array.from(por.values(), Math.abs);
    return { camadas: d.length, cuadran: d.filter(x => x < 0.01).length, peor: d.length ? Math.max(...d) : 0 };
  }

  /* Lo que la lista de Drive dice de la base dormida y del riesgo */
  function resumenRiesgo(RL) {
    if (!RL) return null;
    const out = { riesgo: null, recuperada: null };
    const k = RL.order.find(h => /en riesgo/i.test(h)); if (k) out.riesgo = RL.sheets[k].count;
    for (const h of RL.order) for (const b of (RL.sheets[h].blocks || [])) {
      if (b.k !== 'kpis') continue;
      b.rows[0].forEach((l, i) => { if (/recuperad/i.test(l) && /\//.test(String(b.rows[1][i] || ''))) out.recuperada = { etiqueta: l, valor: String(b.rows[1][i]) }; });
    }
    return out;
  }
  /* % cobrado y efectividad por camada (sin montos) */
  function cobranza(COB) {
    if (!COB) return null;
    const por = new Map();
    for (const r of COB.rows) { if (r[5] === COB.anulIdx) continue; let o = por.get(r[0]); if (!o) { o = { f: 0, c: 0, d: 0 }; por.set(r[0], o); } o.f += r[6]; o.c += r[7]; o.d += r[9]; }
    return COB.camadaOrder.map(l => { const o = por.get(COB.dims.camada.indexOf(l)) || { f: 0, c: 0, d: 0 };
      return { camada: l, cobrado: o.f ? o.c / o.f * 100 : 0, efect: (o.c + o.d) ? o.c / (o.c + o.d) * 100 : 0, joven: l === COB.camadaMax }; });
  }

  /* ---- Graficos ------------------------------------------------------------ */
  const eje = (o) => Object.assign({ axisLabel: { fontSize: fsz(12), color: '#4A5270' }, splitLine: { lineStyle: { color: '#EDF0F5' } }, axisLine: { lineStyle: { color: GRIS } }, axisTick: { show: false } }, o);
  /* Todos los nombres, uno por barra: ECharts salta etiquetas si cree que no
     caben (interval auto); la letra se ajusta al alto de cada fila. */
  const nombres = (ch, n) => ({ interval: 0, fontSize: Math.max(10, Math.min(fsz(13), Math.floor((ch.getHeight() - 12) / Math.max(1, n) * .62))),
    color: '#24205b', width: fsz(150), overflow: 'truncate' });
  function barrasPct(id, filas, o) {
    const ch = GIP.grafico(id);
    ch.setOption(Object.assign({}, MOV, {
      grid: { left: 8, right: 70, top: 6, bottom: 6, containLabel: true },
      tooltip: { show: false },
      xAxis: eje({ type: 'value', axisLabel: { show: false }, splitLine: { show: false } }),
      yAxis: eje({ type: 'category', inverse: true, data: filas.map(f => f[0]), axisLabel: nombres(ch, filas.length) }),
      series: [{ type: 'bar', barMaxWidth: fsz(22), data: filas.map((f, k) => ({ value: +f[1].toFixed(2), itemStyle: { color: f[2] || SERIE, opacity: f[3] == null ? 1 : f[3] } })),
        itemStyle: { borderRadius: [0, 4, 4, 0] }, animationDelay: k => k * 70,
        label: { show: true, position: 'right', fontSize: fsz(13), fontWeight: 600, color: '#24205b', formatter: p => (o && o.etiqueta ? o.etiqueta(p.value) : F.pct(p.value)) } }],
    }), true);
    return ch;
  }
  function divergente(id, filas, resaltar) {
    // filas: [nombre, variacion %]. resaltar: 'todo' | 'suben' | 'bajan'
    const ch = GIP.grafico(id);
    const op = f => resaltar === 'suben' ? (f[1] >= 0 ? 1 : .18) : resaltar === 'bajan' ? (f[1] < 0 ? 1 : .18) : 1;
    ch.setOption(Object.assign({}, MOV, {
      grid: { left: 8, right: 60, top: 6, bottom: 6, containLabel: true }, tooltip: { show: false },
      xAxis: eje({ type: 'value', axisLabel: { formatter: v => v + ' %', fontSize: fsz(11), color: '#6B7390' } }),
      yAxis: eje({ type: 'category', inverse: true, data: filas.map(f => f[0]), axisLabel: nombres(ch, filas.length) }),
      series: [{ type: 'bar', barMaxWidth: fsz(20), animationDelay: k => k * 60,
        data: filas.map(f => ({ value: +f[1].toFixed(1), itemStyle: { color: f[1] >= 0 ? POS : NEG, opacity: op(f), borderRadius: f[1] >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        label: { show: true, position: 'right', fontSize: fsz(13), fontWeight: 600, formatter: p => F.delta(p.value, 0), color: '#24205b' } }],
    }));
    return ch;
  }

  /* ---- Laminas -------------------------------------------------------------
     {cap, nombre, clase, pasos, html(D), montar(el, D), paso(el, D, p)}       */
  const ICO_ABRIR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
  const LOGO = '<img src="assets/logo-ip.png" alt="" width="56" height="56">';
  const periodo = D => cap(D.mesN(0)) + ' a ' + D.mesN(D.ult);
  const notaParcial = D => D.parcial ? cap(D.mesCorte) + ' va por el día ' + D.diaCorte + ': se cierra a fin de mes y por eso no entra en las comparaciones.' : '';

  function laminas(D) {
    const L = [];
    L.push({ cap: 'Apertura', nombre: 'Portada', clase: 'portada', html: () =>
      '<h1 class="ln-titulo" data-ap>De la factura a la decisión</h1>'
      + '<p class="ln-sub" data-ap>Reunión de vendedores 2026 · Distribuidora y Suministros IP</p><div class="raya"></div>'
      + '<div class="firma" data-ap>' + LOGO + '<span><b>Ing. Roberts Flores</b>Análisis de datos</span></div>' });

    L.push({ cap: 'Apertura', nombre: 'Lo que cambió', pasos: 2, html: () =>
      '<h2 class="ln-titulo" data-ap>Lo que cambió este año</h2><div class="ln-cuerpo dos-col">'
      + '<div data-paso="0"><p class="col-tit">Antes</p><ul class="lista-ln tenue"><li>Un Excel distinto para cada pregunta</li><li>Cifras que no cuadraban entre sí</li>'
      + '<li>Semanas para saber cómo cerró un mes</li><li>Cobros que se discutían de memoria</li></ul></div>'
      + '<div data-paso="1"><p class="col-tit naranja">Ahora</p><ul class="lista-ln"><li>Un solo dato, sacado de la factura</li><li>Cuadra al centavo, o no se publica</li>'
      + '<li>Cada quincena, en el teléfono</li><li>Solo cuenta lo que confirmó el banco</li></ul></div></div>' });

    /* Cada control con su evidencia: cifras del build (grupo/control.py) o
       recalculadas aqui mismo. Si falta una, se dice, no se inventa. */
    const C = D.ctl, cu = C.cuadre, pa = C.pasado, pr = C.pruebas, cb = D.cobCuadre;
    const mesCh = m => F.mes(+m.slice(5) - 1).slice(0, 3);
    const novedades = c => (Array.isArray(c) ? c : (c && c.entradas) || []).length;
    const iguales = pa ? pa.meses.filter(m => m.igual).length : 0, cambian = pa ? pa.meses.filter(m => !m.igual) : [];
    const REMATE = k => '<p class="remate" data-paso="' + k + '">Y la prueba más fuerte: compruébenlo ustedes, con un cliente suyo.</p>';
    const ev = (num, txt) => '<div class="ev"><b>' + num + '</b><span>' + txt + '</span></div>';
    const ctl = [
      ['Origen único', 'Las líneas salen tal cual del sistema de facturación, del ' + esc(F.fechaCorta(D.P.dateMin)) + ' al ' + esc(F.fechaCorta(D.P.dateMax)) + '. Nadie las copia a mano.',
        ev('<span data-cuenta="' + D.lineas + '">0</span>', 'líneas de ' + F.entero(D.facturas) + ' facturas')],
      ['Cuadre a tres caminos', 'El Excel leído con Python, el archivo publicado releído byte a byte y este navegador cuentan por separado. Si no dan lo mismo, no se publica.',
        cu ? ev('3 de 3', 'caminos dan lo mismo: lo ven en la lámina siguiente') : ev('—', 'sin datos del cuadre en este corte')],
      ['El pasado no se toca', pa ? 'Los meses que el corte ' + pa.contra + ' ya tenía cerrados se cotejan con este, mes por mes: líneas, facturas y monto al centavo.'
        : 'Cada corte guarda su foto mes a mes para cotejarla con el siguiente.',
        pa ? ev(iguales + ' de ' + pa.meses.length, 'meses idénticos al corte ' + pa.contra) + '<div class="meses-ok">' + pa.meses.map(m => '<span class="' + (m.igual ? 'si' : 'no') + '">'
          + mesCh(m.mes) + (m.igual ? ' ✓' : ' ✗') + '</span>').join('') + '</div>' : ev('—', 'primera foto: se coteja desde el próximo corte')],
      ['La cobranza cuadra', 'En cada camada, facturado = cobrado + diferencial + pendiente. Recalculado ahora, en esta pantalla.',
        cb ? ev(cb.cuadran + ' de ' + cb.camadas, 'camadas cuadran · diferencia mayor $' + cb.peor.toFixed(2).replace('.', ',')) : ev('—', 'sin conciliación en este corte')],
      ['Probado antes de salir', 'Las pruebas automáticas corren en cada publicación: si una falla, el corte no sale. Cada cambio queda escrito en Novedades.',
        pr ? ev(String(pr.python + pr.navegador), 'pruebas pasaron · 0 fallas · ' + novedades(D.P.changelog) + ' entradas en Novedades') : ev('—', 'sin registro de pruebas')]];
    L.push({ cap: 'Apertura', nombre: 'Por qué creerle a los números', pasos: 5, html: () =>
      '<h2 class="ln-titulo una" data-ap>¿Por qué creerle a los números?</h2><div class="ln-cuerpo controles">'
      + ctl.map((c, k) => '<div class="control" data-paso="' + k + '"><span class="n">' + (k + 1) + '</span><div><h3>' + c[0] + '</h3><p>' + c[1] + '</p></div><div class="evid">' + c[2] + '</div></div>').join('')
      + '</div>' + (cambian.length ? '<p class="ln-nota" data-paso="2">Cambiaron: ' + cambian.map(m => esc(F.mes(+m.mes.slice(5) - 1)) + ' (' + (m.lineas >= 0 ? '+' : '') + m.lineas + ' líneas, '
        + (m.centavos >= 0 ? '+' : '−') + '$' + (Math.abs(m.centavos) / 100).toFixed(2).replace('.', ',') + ')').join(', ') + '. Notas de crédito o facturas cargadas tarde: se explican, no se esconden.</p>' : '')
      + (cu ? '' : REMATE(4)) });

    /* El cuadre, a la vista: columna por columna, la tercera calculada en vivo */
    if (cu) {
      const FIL = [['lineas', 'Líneas de factura'], ['facturas', 'Facturas'], ['clientes', 'Clientes'], ['productos', 'Productos'], ['venta', 'Venta total (su huella)']];
      const CAM = [['El Excel de origen', 'Python (pandas) lee el Excel tal como lo exporta el sistema de facturación.'],
        ['El archivo publicado', 'Python (numpy) abre el archivo cifrado que se sube a la web y lo relee byte a byte.'],
        ['Este navegador, ahora', 'El motor del tablero recorre todas las líneas en esta pantalla y vuelve a contar.']];
      const celda = (k, f, x) => '<div class="cd-v" data-paso="' + k + '"' + (k === 2 ? ' data-f="' + f + '"' : '') + '>' + x + '</div>';
      const num = (k, f) => f === 'venta' ? '<code>' + esc(cu[k][f]) + '</code>' : '<span data-cuenta="' + cu[k][f] + '">0</span>';
      L.push({ cap: 'Apertura', nombre: 'El cuadre a tres caminos', pasos: 3, html: () =>
        '<h2 class="ln-titulo una" data-ap>El mismo resultado por tres caminos</h2>'
        + '<div class="ln-cuerpo"><div class="cuadre" role="table" aria-label="Cuadre a tres caminos">'
        + '<div class="cd-h"></div>' + CAM.map((c, k) => '<div class="cd-h" data-paso="' + k + '"><span class="n">' + (k + 1) + '</span><b>' + c[0] + '</b><small>' + c[1] + '</small></div>').join('')
        + FIL.map(([f, l]) => '<div class="cd-l">' + l + '</div>' + celda(0, f, num('excel', f)) + celda(1, f, num('paquete', f)) + celda(2, f, '…')).join('')
        + '</div></div><p class="ln-nota" data-paso="2" id="cd-nota">La venta total no se proyecta en la reunión: se compara su huella SHA-256, que cambia por completo con un solo centavo.</p>' + REMATE(2),
        montar: (el, D) => {
          const r = recontar(GIP.S.M);
          huella(r.centavos).then(h => huella(r.centavos + 1).then(h1 => {
            el.querySelectorAll('.cd-v[data-f]').forEach(x => {
              const f = x.dataset.f, v = f === 'venta' ? h : r[f], ok = v != null && v === cu.excel[f] && v === cu.paquete[f];
              x.innerHTML = (f === 'venta' ? '<code>' + esc(v || 'sin cifrado en este navegador') + '</code>' : '<span data-cuenta="' + v + '">0</span>')
                + ' <i class="' + (ok ? 'ok' : 'mal') + '">' + (ok ? '✓ igual' : '✗ distinto') + '</i>';
            });
            const nota = el.querySelector('#cd-nota');
            if (nota && h1) nota.textContent = 'Recontado en ' + Math.max(1, Math.round(r.ms)) + ' ms sobre ' + F.entero(r.lineas) + ' líneas. La venta total no se proyecta: se compara su huella SHA-256. Con un solo centavo más, sería ' + h1 + '.';
            contar(el);
          }));
        } });
    }

    L.push({ cap: 'Estadísticas', nombre: 'El año en clientes y facturas', html: () => {
      const m = D.porMes.reduce((p, q) => q.cli > p.cli ? q : p);
      return '<h2 class="ln-titulo" data-ap>El año en clientes y facturas</h2><p class="ln-sub" data-ap>' + periodo(D) + '. ' + esc(notaParcial(D)) + '</p>'
        + '<div class="ln-cuerpo ln-2"><div class="ln-graf" id="g-anio" data-ap></div><div class="grandes" style="grid-template-columns:1fr;align-content:center">'
        + '<div class="grande acento" data-ap><div class="num" data-cuenta="' + D.clientesAno + '">0</div><p>clientes distintos compraron en el año</p></div>'
        + '<div class="grande" data-ap><div class="num" data-cuenta="' + m.cli + '">0</div><p>clientes en ' + esc(D.mesN(m.i)) + ', el mes con más clientes</p></div></div></div>'; },
      montar: (el, D) => {
        const ch = GIP.grafico('g-anio');
        ch.setOption(Object.assign({}, MOV, { grid: { left: 8, right: 8, top: 40, bottom: 8, containLabel: true },
          legend: { top: 0, left: 0, textStyle: { fontSize: fsz(13), color: '#24205b' } }, tooltip: { trigger: 'axis' },
          xAxis: eje({ type: 'category', data: D.cerr.map(D.mesC) }), yAxis: [eje({ type: 'value' }), eje({ type: 'value', splitLine: { show: false } })],
          series: [{ name: 'Clientes', type: 'bar', data: D.porMes.map(m => m.cli), barMaxWidth: fsz(36), itemStyle: { color: SERIE, borderRadius: [4, 4, 0, 0] }, animationDelay: k => k * 80,
            label: { show: true, position: 'top', fontSize: fsz(11), color: '#4A5270' } },
            { name: 'Facturas', type: 'line', yAxisIndex: 1, data: D.porMes.map(m => m.doc), smooth: true, symbolSize: 8, lineStyle: { width: 3, color: MARCA }, itemStyle: { color: MARCA } }] }), true); } });

    L.push({ cap: 'Estadísticas', nombre: 'La venta mes a mes', html: () =>
      '<h2 class="ln-titulo" data-ap>¿Cómo se movió la venta mes a mes?</h2><p class="ln-sub" data-ap>Variación de cada mes frente al anterior. Verde: creció; rojo: bajó. Sin montos: solo el ritmo.</p>'
      + '<div class="ln-cuerpo"><div class="ln-graf" id="g-ritmo" data-ap></div></div>',
      montar: (el, D) => {
        const v = D.porMes.map((m, k) => k === 0 || !D.porMes[k - 1].neto ? null : +pctVar(m.neto, D.porMes[k - 1].neto).toFixed(1));
        GIP.grafico('g-ritmo').setOption(Object.assign({}, MOV, { grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true }, tooltip: { show: false },
          xAxis: eje({ type: 'category', data: D.cerr.map(D.mesC) }), yAxis: eje({ type: 'value', axisLabel: { formatter: x => x + ' %', fontSize: fsz(11), color: '#6B7390' } }),
          series: [{ type: 'bar', barMaxWidth: fsz(46), animationDelay: k => k * 90, data: v.map(x => x == null ? null : { value: x, itemStyle: { color: x >= 0 ? POS : NEG, borderRadius: x >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } }),
            label: { show: true, position: 'top', fontSize: fsz(13), fontWeight: 600, color: '#24205b', formatter: p => p.value == null ? '' : F.delta(p.value, 0) } }] }), true); } });

    const top3 = D.vendedores.slice(0, 3).reduce((a, v) => a + v.part, 0);
    L.push({ cap: 'Estadísticas', nombre: 'El equipo', html: () =>
      '<h2 class="ln-titulo" data-ap>El equipo: quién lleva la venta</h2>'
      + '<p class="ln-sub" data-ap>Parte de la venta de ' + periodo(D).toLowerCase() + ' que hizo cada vendedor. Los tres primeros suman el <b>' + F.pct(top3) + '</b>.</p>'
      + '<div class="ln-cuerpo"><div class="ln-graf" id="g-equipo" data-ap></div></div>',
      montar: (el, D) => barrasPct('g-equipo', D.vendedores.map(v => [v.nombre, v.part, v.puesto <= 3 ? MARCA_T : SERIE])) });

    const crecen = D.vendedores.filter(v => v.varMes != null).map(v => [v.nombre, v.varMes]).sort((p, q) => q[1] - p[1]);
    const nSuben = crecen.filter(f => f[1] >= 0).length;
    L.push({ cap: 'Estadísticas', nombre: 'Crecimientos y caídas del mes', pasos: 3, html: () =>
      '<h2 class="ln-titulo" data-ap>' + cap(D.mesN(D.ult)) + ' frente a ' + D.mesN(D.ult - 1) + '</h2>'
      + '<p class="ln-sub" data-ap><span data-paso="0" class="visto">Cada vendedor contra sí mismo. </span><span data-paso="1"><b>' + nSuben + ' crecieron.</b> </span>'
      + '<span data-paso="2"><b>' + (crecen.length - nSuben) + ' bajaron:</b> ahí está la cartera por recuperar.</span></p>'
      + '<div class="ln-cuerpo"><div class="ln-graf" id="g-crecen" data-ap></div></div><p class="ln-nota">Solo vendedores con al menos $5.000 en ' + esc(D.mesN(D.ult - 1)) + ': con bases chicas el porcentaje engaña.</p>',
      montar: () => divergente('g-crecen', crecen, 'todo'),
      paso: (el, D, p) => divergente('g-crecen', crecen, p === 1 ? 'suben' : p === 2 ? 'bajan' : 'todo') });

    if (D.tri) {
      const tri = D.vendedores.filter(v => v.varTri != null).map(v => [v.nombre, v.varTri]).sort((p, q) => q[1] - p[1]);
      const lab = ms => cap(D.mesN(ms[0]).slice(0, 3)) + '–' + D.mesN(ms[2]).slice(0, 3);
      L.push({ cap: 'Estadísticas', nombre: 'Trimestre contra trimestre', html: () =>
        '<h2 class="ln-titulo" data-ap>' + lab(D.tri.b) + ' frente a ' + lab(D.tri.a).toLowerCase() + '</h2>'
        + '<p class="ln-sub" data-ap>Promedio mensual de cada vendedor en el último trimestre cerrado contra el anterior: lo que dura más que un buen mes.</p>'
        + '<div class="ln-cuerpo"><div class="ln-graf" id="g-tri" data-ap></div></div>',
        montar: () => divergente('g-tri', tri, 'todo') });
    }

    L.push({ cap: 'Estadísticas', nombre: 'Vendedor por vendedor', pasos: D.vendedores.length, html: () =>
      '<div class="ficha-v"><div class="fv-izq fv-mov" id="fv-izq"></div><div class="fv-der"><p class="ln-nota" id="fv-pie"></p><div class="ln-graf fv-graf" id="g-vend"></div>'
      + '<p class="col-tit fv-tit">Sus tres clientes principales</p><ul class="fv-lista fv-mov" id="fv-cli"></ul></div></div>',
      paso: (el, D, p) => fichaVendedor(D, D.vendedores[p]) });

    L.push({ cap: 'Estadísticas', nombre: 'Zonas', pasos: 2, html: () =>
      '<h2 class="ln-titulo" data-ap>¿Dónde se vende?</h2><div class="ln-cuerpo ln-2"><div class="ln-graf" id="g-mapa" data-ap></div>'
      + '<div data-paso="1"><p class="col-tit">Parte del año y cambio de ' + esc(D.mesN(D.ult)) + '</p><ul class="lista-ln">'
      + D.estados.map(e => '<li style="display:flex;justify-content:space-between;gap:16px"><span>' + esc(nombreEstado(e.nombre)) + '</span><span><b>' + F.pct(e.part)
        + '</b>' + (e.varMes == null ? '' : ' <span class="' + (e.varMes >= 0 ? 'sube' : 'baja') + '">' + (e.varMes >= 0 ? '▲ ' : '▼ ') + dlt(e.varMes) + '</span>') + '</span></li>').join('')
      + '</ul></div></div>',
      montar: (el, D) => mapa(D) });

    const rr = D.riesgo && D.riesgo.recuperada;
    L.push({ cap: 'Estadísticas', nombre: 'Clientes', pasos: 3, html: () =>
      '<h2 class="ln-titulo" data-ap>Clientes: dónde está la oportunidad</h2><div class="ln-cuerpo grandes">'
      + '<div class="grande" data-paso="0"><div class="num"><span data-cuenta="' + D.n80 + '">0</span> <small>de ' + F.entero(D.clientesAno) + '</small></div><p>clientes hacen el 80 % de la venta del año</p></div>'
      + '<div class="grande" data-paso="1"><div class="num" data-cuenta="' + D.inactivos + '">0</div><p>clientes llevan más de 45 días sin comprar: la lista de a quién llamar</p></div>'
      + (rr ? '<div class="grande acento" data-paso="2"><div class="num">' + esc(rr.valor.split('(')[0].trim()) + '</div><p>' + esc(rr.etiqueta) + ': los dormidos que volvieron a comprar'
        + (/\((\d+\s*%)\)/.test(rr.valor) ? ' (' + esc(rr.valor.match(/\((\d+\s*%)\)/)[1]) + ')' : '') + '</p></div>'
        : (D.riesgo && D.riesgo.riesgo ? '<div class="grande" data-paso="2"><div class="num" data-cuenta="' + D.riesgo.riesgo + '">0</div><p>clientes en la lista de riesgo del corte</p></div>' : ''))
      + '</div>' + (D.parcial ? '<p class="ln-nota">Con ' + esc(D.mesCorte) + ' a medias, la lista de riesgo sale inflada: muchos todavía pueden comprar este mes.</p>' : '') });

    if (D.grupos.length) L.push({ cap: 'Estadísticas', nombre: 'Qué se vende', html: () =>
      '<h2 class="ln-titulo" data-ap>¿Qué se vende?</h2><p class="ln-sub" data-ap>Parte de cada grupo en la venta de cada mes.</p>'
      + '<div class="ln-cuerpo"><div class="ln-graf" id="g-grupos" data-ap></div></div>',
      montar: (el, D) => GIP.grafico('g-grupos').setOption(Object.assign({}, MOV, { color: PAL, grid: { left: 8, right: 8, top: 40, bottom: 8, containLabel: true },
        legend: { top: 0, left: 0, textStyle: { fontSize: fsz(13), color: '#24205b' } }, tooltip: { trigger: 'axis', valueFormatter: v => F.pct(v) },
        xAxis: eje({ type: 'category', data: D.cerr.map(D.mesC) }), yAxis: eje({ type: 'value', max: 100, axisLabel: { formatter: v => v + ' %', fontSize: fsz(11), color: '#6B7390' } }),
        series: D.grupos.map((g, k) => ({ name: cap(g.nombre.toLowerCase()), type: 'bar', stack: 'g', barMaxWidth: fsz(52), animationDelay: i => i * 60 + k * 120,
          data: g.serie.map(v => +v.toFixed(1)) })) }), true) });

    if (D.cobro) L.push({ cap: 'Cobranza', nombre: 'Lo que se despacha, se cobra', html: () => {
      const maduras = D.cobro.filter(c => !c.joven).slice(0, -2), rango = maduras.length ? [Math.min(...maduras.map(c => c.cobrado)), Math.max(...maduras.map(c => c.cobrado))] : null;
      return '<h2 class="ln-titulo" data-ap>Lo que despachamos, se cobra</h2>'
        + '<p class="ln-sub" data-ap>' + (rango ? 'Las camadas maduras ya cobraron entre el <b>' + F.pct(rango[0], 0) + '</b> y el <b>' + F.pct(rango[1], 0) + '</b>. ' : '')
        + 'Las jóvenes se ven bajas porque todavía se están cobrando, y el diferencial no es deuda.</p><div class="ln-cuerpo"><div class="ln-graf" id="g-cobro" data-ap></div></div>'; },
      montar: (el, D) => GIP.grafico('g-cobro').setOption(Object.assign({}, MOV, { grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
        legend: { top: 0, left: 0, textStyle: { fontSize: fsz(13), color: '#24205b' } }, tooltip: { trigger: 'axis', valueFormatter: v => F.pct(v) },
        xAxis: eje({ type: 'category', data: D.cobro.map(c => c.camada + (c.joven ? ' (madurando)' : '')) }), yAxis: eje({ type: 'value', max: 100, axisLabel: { formatter: v => v + ' %', fontSize: fsz(11), color: '#6B7390' } }),
        series: [{ name: 'Cobrado de lo despachado', type: 'line', smooth: true, symbolSize: 10, data: D.cobro.map(c => +c.cobrado.toFixed(1)), lineStyle: { width: 4, color: POS }, itemStyle: { color: POS },
          areaStyle: { color: 'rgba(21,128,61,.08)' }, label: { show: true, position: 'top', fontSize: fsz(12), fontWeight: 600, color: '#24205b', formatter: p => F.pct(p.value, 0) } },
          { name: 'Efectividad de lo ya cerrado', type: 'line', smooth: true, symbolSize: 7, data: D.cobro.map(c => +c.efect.toFixed(1)), lineStyle: { width: 2, type: 'dashed', color: SERIE }, itemStyle: { color: SERIE } }] }), true) });

    L.push(sistema('Cobranza', 'Cobranzas', 'Cobranzas: cada abono, factura por factura', 'Para ustedes, desde el teléfono',
      ['Buscan la factura y reportan el abono en segundos.', 'El abono queda en tránsito hasta que el banco lo confirma: solo lo validado suma.',
        'Ven su cartera, sus pendientes y su comisión.', 'Cada movimiento queda registrado: quién, cuándo y qué cambió.'], D.enlaces.cobranzas, 'Abrir Cobranzas'));
    L.push(sistema('Flota', 'Flota IP', 'Flota IP: cuánto cuesta de verdad cada ruta', 'Lo que viene',
      ['El chofer marca salida, paradas y llegada desde el teléfono, aun sin señal.', 'Combustible y gastos de cada viaje, con la calidad del dato.',
        'Rendimiento y costo por kilómetro de cada camión.', 'Mantenimiento y vencimientos que avisan solos.'], D.enlaces.flota, 'Abrir Flota IP'));

    L.push({ cap: 'Cierre', nombre: 'Compromisos', pasos: 3, html: () =>
      '<h2 class="ln-titulo" data-ap>Compromisos de las próximas dos semanas</h2><ol class="compromisos ln-cuerpo" style="align-content:center">'
      + '<li data-paso="0">Llamar a mis tres clientes inactivos de mayor valor.</li><li data-paso="1">Revisar mi lista de riesgo con «Enfocar en» mi nombre.</li>'
      + '<li data-paso="2">Reportar mis abonos por Cobranzas.</li></ol>' });
    L.push({ cap: 'Cierre', nombre: 'Cierre', clase: 'cierre', html: () =>
      '<h2 class="ln-titulo" data-ap>Este sistema es de ustedes</h2><p class="ln-sub" data-ap>Si algo no les cuadra, lo revisamos juntos con la factura en la mano. Así se vuelve cada vez más confiable.</p>'
      + '<div class="firma" data-ap style="color:rgba(255,255,255,.8)"><span><b style="color:#fff">Ing. Roberts Flores</b>Análisis de datos · Grupo IP</span></div>' });
    return L;
  }

  function sistema(capitulo, nombre, titulo, estado, puntos, url, boton) {
    const ok = /^https?:\/\//.test(url || '');
    return { cap: capitulo, nombre, pasos: 1, html: () =>
      '<div class="sistema"><div><span class="estado-s" data-ap>' + esc(estado) + '</span><h2 class="ln-titulo" data-ap style="margin-top:2vh">' + esc(titulo) + '</h2>'
      + (ok ? '<a class="abrir" data-ap href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + ICO_ABRIR + esc(boton) + '</a><span class="url" data-ap>' + esc(url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</span>'
        : '<p class="ln-nota" data-ap>Falta la dirección: se configura al construir (METODO.md).</p>')
      + '</div><ul class="lista-ln">' + puntos.map(p => '<li data-ap>' + esc(p) + '</li>').join('') + '</ul></div>' };
  }

  /* Ficha de un vendedor: el grafico se transforma de uno a otro */
  function fichaVendedor(D, v) {
    const izq = document.getElementById('fv-izq'); if (!izq || !v) return;
    const kpi = (l, x) => '<div><span>' + l + '</span><b>' + x + '</b></div>';
    const vr = x => x == null ? '<span style="color:#6B7390">sin base</span>' : '<span class="' + (x >= 0 ? 'sube' : 'baja') + '">' + (x >= 0 ? '▲ ' : '▼ ') + dlt(x) + '</span>';
    const notas = [], mesDe = d => F.fechaCorta(GIP.contexto().offAFecha(d));
    const ini = GIP.contexto().offAFecha(v.desde), fin = GIP.contexto().offAFecha(v.hasta);
    if (ini.slice(0, 7) === D.P.dims.mes[D.ult]) notas.push('Se incorporó el ' + mesDe(v.desde) + '.');
    if (fin.slice(0, 7) < D.P.dims.mes[D.ult]) notas.push('Última venta el ' + mesDe(v.hasta) + '.');
    const perfil = (l, x, y) => '<div><dt>' + l + '</dt><dd><b>' + x + '</b><span>' + y + '</span></dd></div>';
    const html = '<p class="ln-nota">Vendedor ' + v.puesto + ' de ' + D.vendedores.length + ' · ' + periodo(D) + '</p><h2 class="fv-nombre">' + esc(v.nombre) + '</h2>'
      + '<p class="fv-puesto">Hizo el <b>' + F.pct(v.part) + '</b> de la venta del año' + (notas.length ? '. ' + esc(notas.join(' ')) : '') + '</p>'
      + '<div class="fv-kpis">' + kpi(cap(D.mesN(D.ult)) + ' frente a ' + D.mesN(D.ult - 1), vr(v.varMes)) + kpi('Trimestre frente al anterior', vr(v.varTri))
      + kpi('Clientes distintos atendidos', F.entero(v.clientes)) + kpi('Clientes en ' + D.mesN(D.ult), F.entero(v.clientesUlt)) + kpi('Ticket promedio', F.dinero(v.ticket))
      + kpi('Mejor mes', cap(D.mesN(v.mejor))) + '</div><dl class="fv-perfil">'
      + (v.zona ? perfil('Zona donde más vende', esc(nombreEstado(v.zona[0])), F.pct(v.zona[1]) + ' de su venta') : '')
      + (v.grupo ? perfil('Grupo más fuerte', esc(cap(v.grupo[0].toLowerCase())), F.pct(v.grupo[1]) + ' de su venta') : '')
      + (v.prod ? perfil('Producto que más vende', esc(v.prod[0]), F.entero(v.prod[1]) + ' unidades · ' + F.pct(v.prod[2]) + ' de su venta') : '') + '</dl>';
    const cli = v.top.map(t => '<li><span>' + esc(t[0]) + '</span><b>' + F.pct(t[1]) + '</b></li>').join('');
    const lista = document.getElementById('fv-cli');
    if (izq.innerHTML && !REDUCIDO) { izq.classList.add('cambia'); lista.classList.add('cambia');
      setTimeout(() => { izq.innerHTML = html; lista.innerHTML = cli; izq.classList.remove('cambia'); lista.classList.remove('cambia'); }, 220); }
    else { izq.innerHTML = html; lista.innerHTML = cli; }
    document.getElementById('fv-pie').textContent = 'Venta de ' + v.nombre + ' mes a mes; en naranja, su mejor mes.';
    const ch = GIP.grafico('g-vend');
    ch.setOption(Object.assign({}, MOV, { grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true }, tooltip: { show: false },
      xAxis: eje({ type: 'category', data: D.cerr.map(D.mesC) }), yAxis: eje({ type: 'value', axisLabel: { formatter: F.corto, fontSize: fsz(11), color: '#6B7390' } }),
      series: [{ type: 'bar', barMaxWidth: fsz(44), data: v.serie.map((x, k) => ({ value: Math.round(x), itemStyle: { color: k === v.mejor ? MARCA : SERIE, borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: 'top', fontSize: fsz(12), color: '#24205b', formatter: q => q.dataIndex === v.mejor || q.dataIndex === D.ult ? F.corto(q.value) : '' } }] }));
  }

  /* El estado con su nombre del mapa (con tildes): MERIDA -> Mérida */
  function nombreEstado(n) {
    const geo = GIP.S.extra.geo, f = geo && geo.features && geo.features.find(x => vnorm(x.properties.name) === vnorm(n));
    return f ? f.properties.name : cap(String(n).toLowerCase());
  }

  /* Mapa por estado, encuadrado en los estados con venta */
  let mapaListo = false;
  function mapa(D) {
    const geo = GIP.S.extra.geo; if (!geo || !geo.features) return;
    if (!mapaListo) { echarts.registerMap('VE', geo); mapaListo = true; }
    const nombre = {}; geo.features.forEach(f => { nombre[vnorm(f.properties.name)] = f.properties.name; });
    const datos = D.estados.map(e => ({ name: nombre[vnorm(e.nombre)] || e.nombre, value: +e.part.toFixed(1) }));
    let a = 180, b = -180, c = 90, d = -90;
    const rec = x => { if (typeof x[0] === 'number') { a = Math.min(a, x[0]); b = Math.max(b, x[0]); c = Math.min(c, x[1]); d = Math.max(d, x[1]); } else x.forEach(rec); };
    geo.features.filter(f => datos.some(x => x.name === f.properties.name)).forEach(f => rec(f.geometry.coordinates));
    GIP.grafico('g-mapa').setOption(Object.assign({}, MOV, { tooltip: { show: false },
      visualMap: { show: false, min: 0, max: Math.max(...datos.map(x => x.value), 1), inRange: { color: ['#E4E7F2', '#9AA0C4', '#5b6aa0', SERIE] } },
      series: [{ type: 'map', map: 'VE', roam: false, center: [(a + b) / 2, (c + d) / 2], zoom: Math.min(6, Math.max(1, Math.min(13.6 / (b - a || 1), 11.6 / (d - c || 1)) * .82)),
        data: datos, itemStyle: { borderColor: '#fff', borderWidth: 1.2, areaColor: '#F5F6FA' }, emphasis: { disabled: true },
        label: { show: true, fontSize: fsz(13), fontWeight: 600, color: '#24205b', textBorderColor: '#fff', textBorderWidth: 3,
          formatter: p => p.value && !isNaN(p.value) ? p.name + '\n' + F.pct(p.value) : '' } }] }), true);
  }

  /* ---- Motor de la presentacion ------------------------------------------ */
  let LAM = [], idx = 0, paso = 0;
  function montarLamina(i, p) {
    GIP.soltarGraficos();
    const L = LAM[i], host = document.getElementById('dk');
    host.innerHTML = '<section class="lamina ' + (L.clase || '') + '" aria-label="' + esc(L.nombre) + '">' + L.html(D) + '</section>';
    const el = host.firstChild;
    el.querySelectorAll('[data-ap]').forEach((x, k) => x.style.setProperty('--i', k));
    if (L.montar) L.montar(el, D);
    aplicar(el, L, p);
  }
  function aplicar(el, L, p) {
    el.querySelectorAll('[data-paso]').forEach(x => x.classList.toggle('visto', +x.dataset.paso <= p));
    if (L.paso) L.paso(el, D, p);
    contar(el);
    const total = LAM.length;
    document.getElementById('dk-capitulo').innerHTML = '<b>' + esc(L.cap) + '</b> · ' + esc(L.nombre) + (L.pasos > 1 ? ' · ' + (p + 1) + ' de ' + L.pasos : '');
    document.getElementById('dk-cuenta').textContent = (idx + 1) + ' de ' + total;
    document.getElementById('dk-barra').style.width = ((idx + (p + 1) / (L.pasos || 1)) / total * 100) + '%';
    document.getElementById('dk-ant').disabled = idx === 0 && p === 0;
    document.getElementById('dk-sig').disabled = idx === total - 1 && p >= (L.pasos || 1) - 1;
    history.replaceState(null, '', '#l' + (idx + 1));
  }
  /* cifras que cuentan hasta su valor cuando aparecen */
  function contar(el) {
    el.querySelectorAll('[data-cuenta]').forEach(x => {
      const paso = x.closest('[data-paso]');
      if (x.dataset.hecho || (paso && !paso.classList.contains('visto'))) return;
      x.dataset.hecho = '1';
      const fin = +x.dataset.cuenta;
      if (REDUCIDO) { x.textContent = F.entero(fin); return; }
      const t0 = performance.now(), dur = 1100;
      const tick = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); x.textContent = F.entero(fin * e); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }
  function siguiente() {
    const L = LAM[idx];
    if (paso < (L.pasos || 1) - 1) { paso++; aplicar(document.querySelector('.lamina'), L, paso); }
    else if (idx < LAM.length - 1) { idx++; paso = 0; montarLamina(idx, 0); }
  }
  function anterior() {
    const L = LAM[idx];
    if (paso > 0) { paso--; aplicar(document.querySelector('.lamina'), L, paso); }
    else if (idx > 0) { idx--; paso = (LAM[idx].pasos || 1) - 1; montarLamina(idx, paso); }
  }
  function ir(i) { idx = Math.max(0, Math.min(LAM.length - 1, i)); paso = 0; montarLamina(idx, 0); }

  function arrancar(S) {
    D = calcular(S);
    LAM = laminas(D);
    document.getElementById('dk-sig').onclick = siguiente;
    document.getElementById('dk-ant').onclick = anterior;
    document.getElementById('dk-pantalla').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
    addEventListener('keydown', e => {
      if (/input|select|textarea/i.test(e.target.tagName)) return;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key) && !(e.key === 'Enter' && e.target.closest('a,button'))) { e.preventDefault(); siguiente(); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); anterior(); }
      else if (e.key === 'f' || e.key === 'F') document.getElementById('dk-pantalla').click();
      else if (e.key === 'Home') ir(0); else if (e.key === 'End') ir(LAM.length - 1);
    });
    let ancho = innerWidth;
    addEventListener('resize', () => { if (Math.abs(innerWidth - ancho) > 80) { ancho = innerWidth; montarLamina(idx, paso); } });
    const m = /^#l(\d+)$/.exec(location.hash);
    ir(m ? +m[1] - 1 : 0);
    GIP.deck = { ir, siguiente, anterior, total: () => LAM.length, pasos: i => LAM[i].pasos || 1, actual: () => [idx, paso] };
  }

  GIP.registrar({ propio: arrancar, tema: { serie: SERIE, enfasis: MARCA, paleta: PAL, calor: ['#FFE6DC', '#FF9C78', '#FF4F20', '#24205B'], tinta: '#24205b', tinta2: '#4A5270' } });
})(window);
