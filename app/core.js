/* Nucleo del Sistema Grupo IP v4 (navegador). Lo comparten todas las empresas:
   desbloqueo, filtros, menu de ruta, tarjetas, kit de graficos y tablas,
   indicadores, ayuda, descarga HD, modo reunion y Novedades. Cada empresa solo
   declara sus secciones con GIP.registrar({...}) (app/ip.js, app/caleb.js).
   Reglas: DESIGN.md (visual) y METODO.md (proceso). */
(function (G) {
  'use strict';
  const GIP = G.GIP;
  /* Anti-enmarcado: nadie debe poder incrustar la pagina en otra web y pedir
     el PIN encima (GitHub Pages no permite la cabecera X-Frame-Options).    */
  if (G.top !== G.self) { document.documentElement.innerHTML = ''; try { G.top.location = G.location.href; } catch (e) { /* bloqueado: queda en blanco */ } return; }
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const leerJSON = id => { const el = document.getElementById(id); return el ? JSON.parse(el.textContent) : null; };
  const CFG = leerJSON('cfg'), EXTRA = leerJSON('extra') || {};
  const MOVIMIENTO_REDUCIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Formatos (miles con punto, decimales con coma) ---------------------- */
  const grp = n => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const coma = (v, d) => Math.abs(v).toFixed(d).replace('.', ',');
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const F = {
    dinero: v => (v < 0 ? '−$' : '$') + grp(v),
    dinero2: v => (v < 0 ? '−$' : '$') + grp(Math.trunc(Math.abs(v))) + ',' + coma(Math.abs(v) % 1, 2).slice(2),
    corto: v => { const a = Math.abs(v), s = v < 0 ? '−$' : '$';
      return a >= 1e6 ? s + coma(a / 1e6, a >= 1e7 ? 1 : 2) + ' M' : a >= 1e3 ? s + coma(a / 1e3, a >= 1e4 ? 0 : 1) + ' K' : s + Math.round(a); },
    entero: v => (v < 0 ? '−' : '') + grp(v),
    pct: (v, d = 1) => (v < 0 ? '−' : '') + coma(v, d) + ' %',
    delta: (v, d = 1) => (v >= 0 ? '+' : '−') + coma(v, d) + ' %',
    pp: (v, d = 1) => (v >= 0 ? '+' : '−') + coma(v, d) + ' pp',
    bs: v => grp(v) + ' Bs',
    bsCorto: v => { const a = Math.abs(v); return (a >= 1e6 ? coma(a / 1e6, 1) + ' M' : a >= 1e3 ? Math.round(a / 1e3) + ' K' : Math.round(a)) + ' Bs'; },
    fecha: s => { const p = s.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; },
    fechaLarga: s => { const p = s.split('-'); return (+p[2]) + ' de ' + MESES[+p[1] - 1] + ' de ' + p[0]; },
    fechaCorta: s => { const p = s.split('-'); return (+p[2]) + ' ' + MESC[+p[1] - 1]; },
    mes: i => MESES[i], mesCorto: i => MESC[i],
  };

  /* ---- Iconos de un solo trazo ---------------------------------------------- */
  const svg = d => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const ICO = {
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.6v.2"/>'),
    bajar: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    cerrar: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    pantalla: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  };

  /* ---- Estado ------------------------------------------------------------- */
  const S = { cfg: CFG, extra: EXTRA, P: null, M: null, mod: null, modo: 'normal', usuario: null,
    f: {}, rango: null, preset: 'todo', seccion: null, charts: new Map(), tablas: {}, cache: {}, k: 1 };
  GIP.S = S; GIP.F = F; GIP.esc = esc; GIP.ICO = ICO;
  GIP.registrar = mod => { S.mod = mod; };

  /* ---- Desbloqueo: el PIN abre el paquete normal o el de reunion ----------- */
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function probar(enc, pin) {
    if (!enc) return null;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
    for (const u of enc.users) {
      try {
        const uk = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(u.salt), iterations: enc.iter, hash: 'SHA-256' },
          base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
        const mk = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(u.ivu) }, uk, b64(u.wrapped));
        const k = await crypto.subtle.importKey('raw', mk, { name: 'AES-GCM' }, false, ['decrypt']);
        const datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, k, b64(enc.ct));
        return { usuario: u, gz: new Uint8Array(datos) };
      } catch (e) { /* este PIN no es de este usuario: se prueba el siguiente */ }
    }
    return null;
  }
  let ocupado = false;
  async function entrar(pin) {
    const err = $('#gerr');
    if (ocupado) return;
    /* hoy son PIN de 6 digitos; acepta claves mas largas para poder endurecerlas
       solo cambiando secrets.json (METODO.md, seguridad)                      */
    if (!/^\S{6,64}$/.test(pin)) { err.textContent = 'Escribe tu PIN completo.'; return; }
    ocupado = true; err.textContent = 'Verificando…';
    let r = null;
    try { r = await probar(leerJSON('enc'), pin); if (r) r.modo = 'normal';
      else { r = await probar(leerJSON('enc-r'), pin); if (r) r.modo = 'reunion'; } }
    catch (e) { console.error(e); }
    ocupado = false;
    if (!r) { err.textContent = 'PIN incorrecto. Vuelve a intentarlo.'; const p = $('#pin'); p.value = ''; p.focus(); return; }
    err.textContent = 'Abriendo los datos…';
    try { await arrancar(r); }
    catch (e) { console.error(e); err.textContent = 'No se pudieron abrir los datos: ' + e.message; }
  }

  async function arrancar(r) {
    const tabla = await GIP.abrir(r.gz);
    S.P = tabla.meta; S.M = new GIP.Motor(tabla); S.usuario = r.usuario; S.modo = r.modo;
    S.rango = [0, S.P.dayCount - 1];
    $('#gate').style.display = 'none';
    document.body.classList.remove('bloqueado');
    $('#app').hidden = false;
    if (S.mod.iniciar) S.mod.iniciar(S);
    /* una pieza con armazon propio (la presentacion de la reunion) arranca sola */
    if (S.mod.propio) { S.mod.propio(S); return; }
    construir();
    const h = location.hash.slice(1);
    ir(secciones().some(s => s.id === h) ? h : primera(), true);
    saludar();
  }

  function saludar() {
    const hr = new Date().getHours(), sal = hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
    const u = S.usuario, d = document.createElement('div');
    d.className = 'saludo'; d.setAttribute('role', 'status');
    d.textContent = S.modo === 'reunion' ? 'Modo reunión: sin totales ni márgenes de la empresa' : sal + ', ' + u.greet;
    document.body.appendChild(d); setTimeout(() => d.remove(), 3200);
    $('#hola').textContent = S.modo === 'reunion' ? '' : 'Hola, ' + u.greet;
  }

  /* ---- Contexto que reciben las secciones ----------------------------------- */
  function contexto() {
    const sel = S.M.seleccion(), mob = innerWidth <= 680, reunion = S.modo !== 'normal';
    const c = { S, P: S.P, M: S.M, dims: S.P.dims, sel, mob, reunion, k: S.k, F, esc, kit: KIT, rango: S.rango,
      agrupar(col, o) { const key = col + '|' + JSON.stringify(o || {}); return S.cache[key] || (S.cache[key] = S.M.agrupar(sel, col, o)); },
      total(o) { const key = '*|' + JSON.stringify(o || {}); return S.cache[key] || (S.cache[key] = S.M.total(sel, o)); },
      /* [{i, nombre, v, g}] ordenado de mayor a menor por `campo` */
      ranking(col, nombres, campo, o) {
        const g = c.agrupar(col, o || { sumas: [campo] }), out = [];
        for (let i = 0; i < g.filas.length; i++) if (g.filas[i]) out.push({ i, nombre: nombres[i], v: g[campo][i], g });
        return out.sort((a, b) => b.v - a.v);
      },
      activo: k => !!(S.f[k] && S.f[k].size),
      alternar, ir, filtrarA: (k, codigos) => { S.f[k] = new Set(codigos); aplicarFiltros(); },
      offAFecha, fechaAOff };
    return c;
  }
  GIP.contexto = contexto;

  const offAFecha = off => { const d = new Date(S.P.dayZero + 'T00:00:00'); d.setDate(d.getDate() + off);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fechaAOff = s => Math.round((new Date(s + 'T00:00:00') - new Date(S.P.dayZero + 'T00:00:00')) / 864e5);

  /* ---- Construccion de la interfaz ---------------------------------------- */
  function construir() {
    const P = S.P;
    $('#cab-nombre').textContent = CFG.nombre;
    $('#cab-corte').textContent = 'Corte ' + P.corte + ', con datos al ' + F.fechaLarga(P.dateMax);
    $('#pie').textContent = 'Datos del ' + F.fechaLarga(P.dateMin) + ' al ' + F.fechaLarga(P.dateMax) + '. Sistema Grupo IP, versión '
      + version() + ', por el Ing. Roberts Flores.';
    construirFechas(); construirSegmentadores(); construirNav(); construirReunion();
    $('#b-menu').onclick = () => alternarNav();
    $('#velo').onclick = () => { alternarNav(false); alternarFiltros(false); };
    $('#b-limpiar').onclick = limpiar;
    $('#b-filtros').onclick = () => alternarFiltros();
    $('#b-listo').onclick = () => alternarFiltros(false);
    addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.seccion) ir(h); });
    /* Botones de los modulos sin manejadores sueltos: data-ir lleva a otra
       seccion; data-accion llama a mod.acciones[nombre](valor) y repinta.   */
    $('#main').addEventListener('click', e => {
      const a = e.target.closest('[data-ir],[data-accion]'); if (!a) return;
      if (a.dataset.ir) { e.preventDefault(); ir(a.dataset.ir); return; }
      const fn = S.mod.acciones && S.mod.acciones[a.dataset.accion];
      if (fn) { fn(a.dataset.v, contexto()); GIP.repintar(); }
    });
    addEventListener('keydown', teclas);
    let ancho = innerWidth <= 680;
    addEventListener('resize', () => { const m = innerWidth <= 680; if (m !== ancho) { ancho = m; repintar(); } });
    new ResizeObserver(() => document.documentElement.style.setProperty('--barra-h', $('#barra').offsetHeight + 'px')).observe($('#barra'));
  }
  const version = () => { const v = (S.P.changelog || { entradas: [] }).entradas.find(e => e.tipo !== 'corte'); return v ? v.v : '4'; };

  function alternarNav(abrir) {
    if (innerWidth > 680) { document.body.classList.toggle('sin-nav', abrir === undefined ? undefined : !abrir); repintarGraficos(); return; }
    const on = document.body.classList.toggle('nav-abierta', abrir);
    $('#velo').hidden = !on; $('#b-menu').setAttribute('aria-expanded', on);
  }
  function alternarFiltros(abrir) {
    const on = document.body.classList.toggle('filtros-abiertos', abrir);
    $('#b-filtros').setAttribute('aria-expanded', on);
    if (!on) cerrarPops();
  }

  /* ---- Fechas ------------------------------------------------------------- */
  function construirFechas() {
    const n = S.P.dayCount, host = $('#fechas'), mn = S.P.dayZero, mx = offAFecha(n - 1);
    host.innerHTML = '<label>Desde <input type="date" id="f-desde" min="' + mn + '" max="' + mx + '"></label>'
      + '<label>Hasta <input type="date" id="f-hasta" min="' + mn + '" max="' + mx + '"></label>'
      + '<div class="atajos" role="group" aria-label="Atajos de fechas">'
      + [['todo', 'Todo'], ['mes', 'Este mes'], ['mesant', 'Mes pasado'], ['sem', '7 días'], ['dia', 'Último día']]
        .map(a => '<button type="button" data-p="' + a[0] + '">' + a[1] + '</button>').join('') + '</div>';
    const aplicar = () => {
      let a = fechaAOff($('#f-desde').value), b = fechaAOff($('#f-hasta').value);
      if (isNaN(a)) a = 0; if (isNaN(b)) b = n - 1; if (a > b) [a, b] = [b, a];
      S.rango = [Math.max(0, a), Math.min(n - 1, b)]; S.preset = null; aplicarFiltros();
    };
    $('#f-desde').onchange = aplicar; $('#f-hasta').onchange = aplicar;
    $$('.atajos button', host).forEach(b => b.onclick = () => atajo(b.dataset.p));
    if (S.mod.barraExtra) S.mod.barraExtra(host, contexto);
    pintarFechas();
  }
  function rangoMes(offs) {
    const d = offAFecha(offs), primero = fechaAOff(d.slice(0, 8) + '01');
    const sig = new Date(d.slice(0, 8) + '01T00:00:00'); sig.setMonth(sig.getMonth() + 1);
    return [Math.max(0, primero), Math.min(S.P.dayCount - 1, Math.round((sig - new Date(S.P.dayZero + 'T00:00:00')) / 864e5) - 1)];
  }
  function atajo(p) {
    const n = S.P.dayCount; let r = [0, n - 1];
    if (p === 'mes') r = rangoMes(n - 1);
    else if (p === 'mesant') { const [a] = rangoMes(n - 1); r = a > 0 ? rangoMes(a - 1) : r; }
    else if (p === 'sem') r = [Math.max(0, n - 7), n - 1];
    else if (p === 'dia') r = [n - 1, n - 1];
    S.rango = r; S.preset = p; aplicarFiltros();
  }
  GIP.atajo = atajo; GIP.rangoMes = rangoMes;
  function pintarFechas() {
    $('#f-desde').value = offAFecha(S.rango[0]); $('#f-hasta').value = offAFecha(S.rango[1]);
    $$('#fechas .atajos button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === S.preset));
  }

  /* ---- Segmentadores ------------------------------------------------------- */
  let SEGS = [];
  function construirSegmentadores() {
    SEGS = S.mod.segmentadores(S.P);
    const host = $('#segs');
    host.innerHTML = SEGS.map(s => '<div class="seg" data-k="' + s.k + '"><button class="btn btn-sec" type="button" aria-haspopup="listbox" aria-expanded="false">'
      + esc(s.label) + ' <span class="n" hidden></span></button></div>').join('');
    SEGS.forEach(s => { $('.seg[data-k="' + s.k + '"] > button', host).onclick = e => { e.stopPropagation(); abrirPop(s); }; });
    document.addEventListener('click', e => { if (!e.target.closest('.pop')) cerrarPops(); });
  }
  function cerrarPops() { $$('.pop').forEach(p => p.remove()); $$('.seg > button').forEach(b => b.setAttribute('aria-expanded', 'false')); }
  function abrirPop(s) {
    const host = $('.seg[data-k="' + s.k + '"]'), yaAbierto = $('.pop', host);
    cerrarPops(); if (yaAbierto) return;
    const pop = document.createElement('div'); pop.className = 'pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', s.label);
    pop.innerHTML = '<div class="pop-cab"><span>' + esc(s.label) + '</span><button class="btn btn-txt" type="button" data-cerrar>Listo</button></div>'
      + '<input type="search" placeholder="Buscar ' + esc(s.label.toLowerCase()) + '" aria-label="Buscar en ' + esc(s.label) + '">'
      + '<div class="pop-acc"><button class="btn-txt" type="button" data-a="todos">Marcar los visibles</button><button class="btn-txt" type="button" data-a="ninguno">Ninguno</button></div>'
      + '<div class="pop-lista" role="listbox" aria-multiselectable="true"></div>';
    host.appendChild(pop); $('button', host).setAttribute('aria-expanded', 'true');
    pop.onclick = e => e.stopPropagation();
    const q = $('input', pop), lista = $('.pop-lista', pop), set = () => S.f[s.k] || (S.f[s.k] = new Set());
    let visibles = [];
    const pintar = () => {
      const t = q.value.trim().toLowerCase(), out = [], extra = s.buscarEn;
      visibles = []; let n = 0;
      for (let i = 0; i < s.nombres.length; i++) {
        const nm = String(s.nombres[i]);
        if (t && !nm.toLowerCase().includes(t) && !(extra && String(extra[i]).toLowerCase().includes(t))) continue;
        n++; if (out.length >= 200) continue;
        visibles.push(i);
        out.push('<label><input type="checkbox" value="' + i + '"' + (set().has(i) ? ' checked' : '') + '><span>' + esc(nm) + '</span></label>');
      }
      lista.innerHTML = out.join('') + (n > 200 ? '<p class="pop-mas">' + F.entero(n - 200) + ' más: escribe para buscar</p>' : '')
        + (n ? '' : '<p class="pop-mas">Nada coincide con «' + esc(q.value) + '».</p>');
    };
    q.oninput = pintar;
    lista.onchange = e => { const v = +e.target.value; e.target.checked ? set().add(v) : set().delete(v); aplicarFiltros(); };
    $$('.pop-acc button', pop).forEach(b => b.onclick = () => {
      if (b.dataset.a === 'todos') visibles.forEach(i => set().add(i)); else set().clear();
      pintar(); aplicarFiltros(); });
    $('[data-cerrar]', pop).onclick = cerrarPops;
    pintar(); if (innerWidth > 680) q.focus();
  }
  function alternar(k, nombre) {
    const s = SEGS.find(x => x.k === k); if (!s) return;
    const i = typeof nombre === 'number' ? nombre : s.nombres.indexOf(nombre); if (i < 0) return;
    const set = S.f[k] || (S.f[k] = new Set()); set.has(i) ? set.delete(i) : set.add(i);
    aplicarFiltros();
  }
  GIP.alternar = alternar;
  function limpiar() { S.f = {}; S.rango = [0, S.P.dayCount - 1]; S.preset = 'todo'; aplicarFiltros(); }
  function aplicarFiltros() {
    S.M.limpiar();
    for (const s of SEGS) { const set = S.f[s.k]; if (set && set.size) S.M.filtrar(s.col, set); }
    const n = S.P.dayCount;
    if (S.rango[0] > 0 || S.rango[1] < n - 1) S.M.rangoDias(S.rango[0], S.rango[1]);
    S.cache = {}; pintarFechas(); pintarActivos(); programarRepintado();
  }
  GIP.aplicarFiltros = aplicarFiltros;
  function pintarActivos() {
    const host = $('#activos'), out = []; let n = 0;
    const [a, b] = S.rango;
    if (a > 0 || b < S.P.dayCount - 1) { n++; out.push(ficha('Fechas', F.fecha(offAFecha(a)) + ' a ' + F.fecha(offAFecha(b)), 'fechas')); }
    for (const s of SEGS) {
      const set = S.f[s.k]; if (!set || !set.size) continue; n++;
      out.push(ficha(s.label, set.size === 1 ? s.nombres[[...set][0]] : set.size + ' elegidos', s.k));
      const b2 = $('.seg[data-k="' + s.k + '"] .n'); if (b2) { b2.hidden = false; b2.textContent = set.size; }
    }
    SEGS.forEach(s => { if (!S.f[s.k] || !S.f[s.k].size) { const b2 = $('.seg[data-k="' + s.k + '"] .n'); if (b2) b2.hidden = true; } });
    host.innerHTML = out.join('');
    $$('button[data-quitar]', host).forEach(bt => bt.onclick = () => {
      const k = bt.dataset.quitar; if (k === 'fechas') { S.rango = [0, S.P.dayCount - 1]; S.preset = 'todo'; } else S.f[k].clear();
      aplicarFiltros(); });
    $('#n-filtros').textContent = n ? '(' + n + ')' : '';
  }
  const ficha = (lab, txt, k) => '<span class="ficha"><span><b>' + esc(lab) + ':</b> ' + esc(txt) + '</span><button type="button" data-quitar="'
    + k + '" aria-label="Quitar filtro de ' + esc(lab) + '">' + ICO.cerrar + '</button></span>';

  /* ---- Navegacion: la ruta de lectura ------------------------------------- */
  function secciones() {
    const todas = S.mod.secciones, r = S.modo !== 'normal';
    const ids = r ? S.mod.agendaReunion : S.mod.pasos.flatMap(p => p.secciones);
    return ids.map(id => Object.assign({ id }, todas[id])).filter(s => s && (!r || s.reunion) && (!s.cuando || s.cuando(S.P)));
  }
  const primera = () => secciones()[0].id;
  function construirNav() {
    const nav = $('#nav'), vis = new Set(secciones().map(s => s.id));
    if (S.modo !== 'normal') {
      nav.innerHTML = '<div class="nav-paso"><p><b>R</b>Agenda de la reunión</p>' + secciones().map(s =>
        '<a href="#' + s.id + '">' + esc(s.nav) + '</a>').join('') + '</div>';
    } else {
      nav.innerHTML = S.mod.pasos.map((p, i) => {
        const items = p.secciones.filter(id => vis.has(id));
        return items.length ? '<div class="nav-paso"><p><b>' + (i + 1) + '</b>' + esc(p.t) + '</p>'
          + items.map(id => '<a href="#' + id + '">' + esc(S.mod.secciones[id].nav) + '</a>').join('') + '</div>' : '';
      }).join('');
    }
    $$('a', nav).forEach(a => a.addEventListener('click', () => alternarNav(false)));
  }
  function ir(id, reemplazar) {
    const lista = secciones();
    const sec = lista.find(s => s.id === id) || lista[0];
    S.seccion = sec.id;
    if (location.hash.slice(1) !== sec.id) (reemplazar ? history.replaceState(null, '', '#' + sec.id) : location.hash = sec.id);
    $$('#nav a').forEach(a => { if (a.getAttribute('href') === '#' + sec.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    montar(sec, lista);
    pintarFranja();
  }
  GIP.ir = ir;

  /* ---- Secciones y tarjetas -------------------------------------------------
     Una seccion = {nav, pregunta, lectura(ctx), bandas:[{cols, tarjetas:[...]}]}.
     Una tarjeta = {id, tipo: 'g'|'html', titulo, pista, tip, alto, sensible,
     cuando(ctx), render(ctx, cuerpo, grafico)}. El nucleo arma el DOM (titulo,
     ayuda, descarga) para que todas las tarjetas se lean igual.             */
  function montar(sec, lista) {
    for (const c of S.charts.values()) c.dispose();
    S.charts.clear();
    const main = $('#main'), reunion = S.modo !== 'normal';
    let h = '<section aria-labelledby="h-' + sec.id + '">';
    h += sec.titular ? '<div class="titular" id="titular"></div>'
      : '<div class="sec-cab"><h2 id="h-' + sec.id + '">' + esc(sec.pregunta) + '</h2><p class="lectura" id="lectura"></p></div>';
    if (sec.kpis) h += '<div class="kpis" id="kpis" role="list"></div>';
    for (const b of sec.bandas || []) {
      const ts = b.tarjetas.filter(t => !(reunion && t.sensible));
      if (!ts.length) continue;
      h += '<div class="banda' + (b.cols && ts.length > 1 ? ' b' + b.cols : '') + '">' + ts.map(tarjetaHTML).join('') + '</div>';
    }
    const i = lista.findIndex(s => s.id === sec.id), sig = lista[i + 1];
    if (sig) h += '<div class="siguiente"><a href="#' + sig.id + '"><small>Siguiente</small><span>' + esc(sig.nav) + '</span></a></div>';
    main.innerHTML = h + '</section>';
    $$('[data-bajar]', main).forEach(b => b.onclick = () => descargar(b.dataset.bajar));
    if (!montar.primera) main.focus({ preventScroll: true });
    montar.primera = false;
    scrollTo({ top: 0 });
    pintarSeccion();
  }
  montar.primera = true;
  const ALTOS = { xs: 'g-xs', sm: 'g-sm', md: '', lg: 'g-lg', xl: 'g-xl' };
  function tarjetaHTML(t) {
    const acc = (t.tip ? '<button class="info" type="button" data-tip="' + esc(t.tip) + '" aria-label="Qué muestra: ' + esc(t.tip) + '">' + ICO.info + '</button>' : '')
      + (t.tipo === 'g' ? '<button class="icono-btn" type="button" data-bajar="' + t.id + '" aria-label="Descargar imagen HD de ' + esc(t.titulo) + '">' + ICO.bajar + '</button>' : '');
    return '<article class="panel" id="p-' + t.id + '"><div class="panel-cab"><h3>' + esc(t.titulo) + '</h3><div class="acc">' + acc + '</div></div>'
      + '<p class="pista" id="pi-' + t.id + '">' + (typeof t.pista === 'string' ? esc(t.pista) : '') + '</p>'
      + (t.tipo === 'g' ? '<div class="grafico ' + (ALTOS[t.alto || 'md']) + '" id="' + t.id + '" role="img" aria-label="' + esc(t.titulo) + '"></div>'
        : '<div id="' + t.id + '"></div>') + '</article>';
  }
  function tarjetas(sec) { return (sec.bandas || []).flatMap(b => b.tarjetas); }

  let pendiente = 0;
  function programarRepintado() { if (!pendiente) pendiente = requestAnimationFrame(() => { pendiente = 0; pintarSeccion(); }); }
  function repintar() { const s = secciones().find(x => x.id === S.seccion); if (s) montar(s, secciones()); }
  function pintarSeccion() {
    const sec = secciones().find(s => s.id === S.seccion); if (!sec) return;
    S.k = S.modo !== 'normal' ? 1.25 : 1;
    const c = contexto();
    if (sec.titular) seguro(() => { $('#titular').innerHTML = '<h2 class="sr" id="h-' + sec.id + '">' + esc(sec.nav) + '</h2>' + sec.titular(c); }, $('#titular'));
    else if (sec.lectura) seguro(() => { $('#lectura').innerHTML = sec.lectura(c) || ''; }, $('#lectura'));
    if (sec.kpis) seguro(() => pintarKPIs(S.mod.kpis(c)), $('#kpis'));
    for (const t of tarjetas(sec)) {
      const panel = document.getElementById('p-' + t.id); if (!panel) continue;
      seguro(() => {
        const visible = !t.cuando || t.cuando(c);
        panel.hidden = !visible; if (!visible) return;
        if (typeof t.pista === 'function') $('#pi-' + t.id).innerHTML = t.pista(c) || '';
        const cuerpo = document.getElementById(t.id);
        t.render(c, cuerpo, t.tipo === 'g' ? grafico(t.id) : null);
      }, document.getElementById(t.id));
    }
  }
  GIP.repintar = () => { S.cache = {}; pintarSeccion(); };
  /* nada falla en silencio: una tarjeta rota lo dice y las demas siguen */
  function seguro(fn, host) {
    try { fn(); } catch (e) { console.error(e); if (host) { const ch = S.charts.get(host.id); if (ch) { ch.dispose(); S.charts.delete(host.id); }
      host.innerHTML = '<p class="error">No se pudo dibujar esta pieza: ' + esc(e.message) + '</p>'; } }
  }

  /* ---- Graficos ---------------------------------------------------------- */
  const ANIM = MOVIMIENTO_REDUCIDO ? { animation: false }
    : { animationDuration: 260, animationDurationUpdate: 180, animationEasing: 'cubicOut', animationEasingUpdate: 'cubicOut' };
  const ro = new ResizeObserver(entradas => { for (const e of entradas) { const c = S.charts.get(e.target.id); if (c) c.resize(); } });
  function grafico(id) {
    let c = S.charts.get(id);
    if (!c) {
      const el = document.getElementById(id);
      c = echarts.init(el, null, { renderer: 'canvas' });
      const orig = c.setOption;
      c.setOption = (o, ...r) => orig.call(c, Object.assign({}, ANIM,
        { textStyle: { fontFamily: "'IBM Plex Sans',system-ui,sans-serif", color: tema().tinta2 } }, o), ...r);
      S.charts.set(id, c); ro.observe(el);
    }
    return c;
  }
  function repintarGraficos() { setTimeout(() => { for (const c of S.charts.values()) c.resize(); }, 240); }
  const tema = () => Object.assign({ tinta: '#1A1F36', tinta2: '#4A5270', linea: '#EDF0F5', eje: '#C9CFDC' }, S.mod.tema);
  const fs = n => Math.round(n * S.k);

  /* Kit: piezas de grafico con la misma gramatica en todas las empresas */
  const KIT = {
    fs, tema,
    vacio(ch, msg) { ch.setOption({ graphic: { type: 'text', left: 'center', top: 'middle',
      style: { text: msg || 'No hay datos para esta selección', fill: tema().tinta2, fontSize: fs(13) } } }, true); },
    ejeCat(data, o) { return Object.assign({ type: 'category', data, axisTick: { show: false }, axisLine: { lineStyle: { color: tema().eje } },
      axisLabel: { fontSize: fs(innerWidth <= 680 ? 10 : 11), color: tema().tinta2, hideOverlap: true } }, o || {}); },
    ejeVal(fmt, o) { return Object.assign({ type: 'value', axisLabel: { formatter: fmt || F.corto, fontSize: fs(10), color: tema().tinta2 },
      splitLine: { lineStyle: { color: tema().linea } } }, o || {}); },
    rejilla(o) { return Object.assign({ top: 28, bottom: 28, left: 8, right: 16, containLabel: true }, o || {}); },
    tooltip(o) { return Object.assign({ trigger: 'axis', confine: true, axisPointer: { type: 'shadow' }, textStyle: { fontSize: fs(12) } }, o || {}); },
    leyenda(o) { return Object.assign({ type: 'scroll', bottom: 0, itemWidth: 12, itemHeight: 10, textStyle: { fontSize: fs(11), color: tema().tinta } }, o || {}); },
    /* Barras horizontales para rankings: ventana fija + deslizador para el
       resto, y el eje se reescala a las barras visibles (filterMode).
       pares: [nombre, valor, extra]                                          */
    barrasH(ch, pares, o) {
      o = o || {};
      if (!pares.length) { KIT.vacio(ch, o.vacio); return; }
      const mob = innerWidth <= 680, trunc = o.trunc || (mob ? 16 : 28), por = new Map(pares.map(p => [p[0], p]));
      const izq = mob ? (o.izqMob || 104) : (o.izq || 180);
      const win = o.ventana || (mob ? 8 : 12), zoom = pares.length > win, fin = zoom ? Math.min(100, win / pares.length * 100) : 100;
      const fmt = o.fmt || F.dinero, axf = o.axf || F.corto, corta = s => s.length > trunc ? s.slice(0, trunc - 1) + '…' : s;
      ch.setOption({
        grid: { top: 6, bottom: mob ? 22 : 26, left: izq, right: (zoom ? 30 : 6) + (mob ? 52 : 64), containLabel: false },
        tooltip: KIT.tooltip({ formatter: ps => { const p = por.get(ps[0].name); return p ? '<b>' + esc(p[0]) + '</b><br>' + (o.tip ? o.tip(p) : fmt(p[1])) : ''; } }),
        xAxis: { type: 'value', splitNumber: mob ? 3 : 4, axisLabel: { formatter: axf, fontSize: fs(10), color: tema().tinta2, hideOverlap: true }, splitLine: { lineStyle: { color: tema().linea } } },
        yAxis: { type: 'category', data: pares.map(p => p[0]), inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: tema().eje } },
          /* el ancho fijo recorta con puntos suspensivos: un nombre largo nunca se sale por la izquierda */
          axisLabel: { fontSize: fs(mob ? 10 : 11), formatter: corta, color: tema().tinta, width: izq - 12, overflow: 'truncate', ellipsis: '…' } },
        dataZoom: zoom ? [{ type: 'slider', yAxisIndex: 0, right: 6, width: mob ? 16 : 12, start: 0, end: fin, brushSelect: false, handleSize: '80%',
          filterMode: 'filter', zoomLock: true, showDetail: false }] : [],
        series: [{ type: 'bar', barMaxWidth: mob ? 16 : 20,
          data: pares.map(p => ({ value: +(+p[1]).toFixed(2), itemStyle: o.colorFn ? { color: o.colorFn(p) } : undefined })),
          itemStyle: { color: o.color || tema().serie, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', fontSize: fs(mob ? 9 : 10), color: tema().tinta2, formatter: q => { const p = por.get(q.name); return p ? (o.label ? o.label(p) : axf(p[1])) : ''; } } }],
      }, true);
      ch.off('click');
      if (o.clic) ch.on('click', q => { if (q.componentType === 'series' && por.has(q.name)) o.clic(por.get(q.name)); });
    },
    anillo(ch, items, o) {
      o = o || {};
      if (!items.length) { KIT.vacio(ch); return; }
      const tot = items.reduce((a, x) => a + x.value, 0) || 1;
      /* con pocas porciones la leyenda va en columna, completa; con muchas, desplazable */
      const pocas = items.length <= 6;
      ch.setOption({ tooltip: { trigger: 'item', confine: true, formatter: p => '<b>' + esc(p.name) + '</b><br>' + (o.fmt || F.dinero)(p.value) + ', ' + F.pct(p.percent) },
        legend: KIT.leyenda(Object.assign({ formatter: n => { const x = items.find(z => z.name === n); const v = x ? x.value / tot * 100 : 0; return n + '  ' + (v > 0 && v < 0.1 ? '<0,1 %' : F.pct(v)); } },
          pocas ? { type: 'plain', orient: 'vertical', left: 'center', bottom: 0, itemGap: 6 } : {})),
        color: o.colores || tema().paleta,
        series: [{ type: 'pie', radius: pocas ? ['38%', '62%'] : ['46%', '72%'], center: ['50%', pocas ? (34 - items.length) + '%' : '42%'], itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: { show: false }, data: items }] }, true);
      ch.off('click'); if (o.clic) ch.on('click', p => o.clic(p.name));
    },
    /* Trayectoria de los N lideres de una dimension, mes a mes */
    lineasPorMes(ch, etiquetas, series, o) {
      o = o || {};
      if (!series.length) { KIT.vacio(ch); return; }
      const pal = tema().paleta, estilos = ['solid', 'solid', 'dashed', 'dashed', 'dotted', 'dotted'];
      ch.setOption({ grid: KIT.rejilla({ bottom: 40 }), legend: KIT.leyenda(), tooltip: KIT.tooltip({ axisPointer: { type: 'line' }, valueFormatter: o.fmt || F.dinero }),
        xAxis: KIT.ejeCat(etiquetas), yAxis: KIT.ejeVal(o.axf),
        series: series.map((s, k) => ({ name: s.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: s.data,
          lineStyle: { width: 2.5, color: pal[k % pal.length], type: estilos[k % estilos.length] }, itemStyle: { color: pal[k % pal.length] } })) }, true);
    },
    calendario(ch, diario, o) {
      const n = diario.length, datos = [];
      let mx = 1;
      for (let i = 0; i < n; i++) if (Math.abs(diario[i]) > 0.5) { datos.push([offAFecha(i), Math.round(diario[i])]); mx = Math.max(mx, diario[i]); }
      const mob = innerWidth <= 680;
      ch.setOption({ tooltip: { confine: true, formatter: p => F.fecha(p.value[0]) + ': ' + F.dinero(p.value[1]) },
        visualMap: { min: 0, max: mx, show: !mob, orient: 'vertical', right: 4, top: 'middle', itemWidth: 10, itemHeight: 80, calculable: false,
          text: [F.corto(mx), '$0'], textStyle: { fontSize: fs(9), color: tema().tinta2 }, inRange: { color: tema().calor } },
        calendar: { top: 22, left: 30, right: mob ? 10 : 64, bottom: 6, cellSize: ['auto', mob ? 11 : 14], range: [S.P.dayZero, offAFecha(n - 1)],
          itemStyle: { borderColor: '#fff', borderWidth: 2, color: '#F1F3F7' }, yearLabel: { show: false }, splitLine: { show: false },
          dayLabel: { firstDay: 1, nameMap: ['D', 'L', 'M', 'M', 'J', 'V', 'S'], fontSize: fs(9), color: tema().tinta2 },
          monthLabel: { nameMap: MESC, fontSize: fs(10), color: tema().tinta } },
        series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: datos }] }, true);
      return datos.length;
    },
    /* Tabla ordenable con buscador y carga por tramos de 100 filas */
    tabla(host, o) {
      const st = S.tablas[host.id] || (S.tablas[host.id] = { k: o.orden ? o.orden[0] : o.cols[1].k, dir: o.orden ? o.orden[1] : -1, q: '', n: 100 });
      if (!o.cols.some(c => c.k === st.k)) { st.k = o.cols[1].k; st.dir = -1; }
      const dibujar = () => {
        const t = st.q.trim().toLowerCase();
        let filas = t ? o.filas.filter(r => o.cols.some(c => typeof r[c.k] === 'string' && r[c.k].toLowerCase().includes(t))) : o.filas.slice();
        filas.sort((a, b) => st.dir * comparar(a[st.k], b[st.k]));
        const vis = filas.slice(0, st.n);
        host.innerHTML = (o.buscar === false ? '' : '<div class="tabla-acc"><input type="search" value="' + esc(st.q) + '" placeholder="' + esc(o.buscarTexto || 'Buscar') + '" aria-label="Buscar en la tabla">'
          + '<span class="cuenta">' + F.entero(filas.length) + (filas.length === 1 ? ' fila' : ' filas') + '</span>' + (o.extra || '') + '</div>')
          + '<div class="envoltura"><table><thead><tr>' + o.cols.map(c => '<th class="' + (c.n ? 'num' : '') + '" data-k="' + c.k + '" aria-sort="'
            + (st.k === c.k ? (st.dir < 0 ? 'descending' : 'ascending') : 'none') + '" tabindex="0">' + esc(c.l) + (st.k === c.k ? (st.dir < 0 ? ' ▾' : ' ▴') : '') + '</th>').join('')
          + '</tr></thead><tbody>' + (vis.length ? vis.map((r, i) => '<tr' + (o.clic ? ' class="clic" data-i="' + i + '"' : '') + '>' + o.cols.map(c =>
            '<td class="' + (c.n ? 'num ' : '') + (c.cls || '') + '">' + (c.f ? c.f(r[c.k], r) : esc(r[c.k])) + '</td>').join('') + '</tr>').join('')
            : '<tr><td colspan="' + o.cols.length + '"><p class="vacio">' + esc(o.vacio || 'No hay filas para esta selección.') + '</p></td></tr>')
          + '</tbody>' + (o.pie || '') + '</table></div>'
          + (filas.length > st.n ? '<button class="btn btn-sec mas" type="button">Mostrar ' + F.entero(Math.min(100, filas.length - st.n)) + ' más de ' + F.entero(filas.length - st.n) + '</button>' : '');
        const q = $('input[type=search]', host);
        if (q) q.oninput = () => { st.q = q.value; st.n = 100; const pos = q.selectionStart; dibujar(); const q2 = $('input[type=search]', host); q2.focus(); q2.setSelectionRange(pos, pos); };
        $$('th', host).forEach(th => { const fn = () => { const k = th.dataset.k; st.dir = st.k === k ? -st.dir : -1; st.k = k; dibujar(); };
          th.onclick = fn; th.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; });
        const mas = $('.mas', host); if (mas) mas.onclick = () => { st.n += 100; dibujar(); };
        if (o.clic) $$('tr.clic', host).forEach(tr => tr.onclick = () => o.clic(vis[+tr.dataset.i]));
      };
      dibujar();
    },
    selector(host, opciones, actual, alCambiar) {
      host.innerHTML = '<div class="selector" role="group">' + opciones.map(o => '<button type="button" data-v="' + esc(o[0]) + '" aria-pressed="' + (o[0] === actual) + '">'
        + esc(o[1]) + '</button>').join('') + '</div>';
      $$('button', host).forEach(b => b.onclick = () => alCambiar(b.dataset.v));
    },
  };
  GIP.kit = KIT;
  GIP.grafico = grafico;
  GIP.soltarGraficos = () => { for (const c of S.charts.values()) c.dispose(); S.charts.clear(); };

  /* Orden de tabla: numeros como numeros aunque vengan como texto del Excel
     ("12,941.77", "$62,751"); lo vacio ("—") al final; el texto, en espanol. */
  const valorOrden = v => { if (typeof v === 'number') return v; if (v == null || v === '' || v === '—') return null;
    const t = String(v).replace(/[$,\s%]/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : String(v); };
  function comparar(a, b) {
    const x = valorOrden(a), y = valorOrden(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1; if (typeof y === 'number') return 1;
    return x.localeCompare(y, 'es');
  }

  /* ---- Indicadores: una banda; en reunion se ocultan los sensibles ---------- */
  function pintarKPIs(lista) {
    const host = $('#kpis'), r = S.modo !== 'normal';
    const vis = lista.filter(k => !(r && k.sensible));
    host.style.setProperty('--kpi-cols', vis.length <= 4 ? vis.length : Math.ceil(vis.length / 2));   // filas completas, sin huecos
    host.innerHTML = vis.map((k, i) => '<div class="kpi' + (i === 0 ? ' primero' : '') + '" role="listitem">'
      + '<div class="kpi-lab">' + esc(k.lab) + (k.tip ? ' <button class="info" type="button" data-tip="' + esc(k.tip) + '" aria-label="Qué es: ' + esc(k.tip) + '">' + ICO.info + '</button>' : '') + '</div>'
      + '<div class="kpi-val">' + esc(k.val) + '</div><div class="kpi-sub">' + (k.sub || '') + '</div>'
      + (k.delta ? '<div class="kpi-delta">' + delta(k.delta) + '</div>' : '') + (k.serie && k.serie.length > 1 ? chispa(k.serie) : '') + '</div>').join('');
  }
  /* ▲/▼ siempre con signo y cifra: nunca solo color */
  function delta(d) {
    if (d.v == null || !isFinite(d.v)) return d.nota ? '<span>' + esc(d.nota) + '</span>' : '';
    const bueno = d.inverso ? d.v < 0 : d.v > 0, plano = Math.abs(d.v) < 0.05;
    return '<b class="' + (plano ? '' : bueno ? 'sube' : 'baja') + '">' + (d.v >= 0 ? '▲ ' : '▼ ') + (d.pp ? F.pp(d.v) : F.delta(d.v)) + '</b><span>' + esc(d.ref || '') + '</span>';
  }
  GIP.delta = delta;
  function chispa(serie) {
    const v = serie.map(Number), mn = Math.min(...v), mx = Math.max(...v), rng = mx - mn || 1, n = v.length;
    const pts = v.map((y, i) => (i / (n - 1) * 64).toFixed(1) + ',' + (22 - (y - mn) / rng * 20).toFixed(1));
    return '<svg class="spark" viewBox="0 0 64 24" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="' + tema().serie
      + '" stroke-width="1.6" stroke-linejoin="round"/><circle cx="64" cy="' + pts[n - 1].split(',')[1] + '" r="2.2" fill="' + tema().enfasis + '"/></svg>';
  }

  /* ---- Globo de ayuda (raton, teclado y toque) ----------------------------- */
  /* Delegado en el documento: vale tambien para las piezas que se dibujan
     despues (indicadores, tablas, tarjetas de los modulos).                 */
  const TIP = $('#tip');
  const infoDe = e => e.target.closest && e.target.closest('.info');
  document.addEventListener('mouseover', e => { const i = infoDe(e); if (i) verTip(i); });
  document.addEventListener('mouseout', e => { if (infoDe(e)) ocultarTip(); });
  document.addEventListener('focusin', e => { const i = infoDe(e); if (i) verTip(i); });
  document.addEventListener('focusout', e => { if (infoDe(e)) ocultarTip(); });
  document.addEventListener('click', e => { const i = infoDe(e); if (i) { e.stopPropagation(); verTip(i); } else ocultarTip(); }, true);
  function verTip(el) {
    TIP.textContent = el.dataset.tip; const w = Math.min(280, innerWidth - 24); TIP.style.width = w + 'px';
    const r = el.getBoundingClientRect(); TIP.style.left = Math.min(Math.max(12, r.left - 10), innerWidth - w - 12) + 'px';
    TIP.style.top = (r.bottom + 8) + 'px'; TIP.classList.add('on');
    const h = TIP.offsetHeight; if (r.bottom + 8 + h > innerHeight - 8) TIP.style.top = Math.max(8, r.top - h - 8) + 'px';
  }
  function ocultarTip() { TIP.classList.remove('on'); }
  addEventListener('scroll', ocultarTip, { passive: true });

  /* ---- Descarga HD: lado largo >= 2048 px para que WhatsApp ofrezca HD ----- */
  function descargar(id) {
    const c = S.charts.get(id), panel = document.getElementById('p-' + id); if (!c || !panel) return;
    const titulo = $('h3', panel).textContent.trim(), sub = ($('.pista', panel).textContent || '').trim();
    const w = c.getWidth() || 700, h = c.getHeight() || 360, cab = sub ? 66 : 44;
    const pr = Math.min(8, Math.max(2, Math.ceil(2048 / Math.max(w, h + cab)), Math.ceil(1280 / Math.min(w, h + cab))));
    const img = new Image();
    img.onload = () => {
      const s = pr, pad = Math.round(20 * s), cabH = Math.round(cab * s), cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height + cabH;
      const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.textBaseline = 'top';
      x.fillStyle = tema().tinta; x.font = '600 ' + Math.round(15 * s) + 'px "IBM Plex Sans",Arial,sans-serif'; x.fillText(titulo + ' · ' + CFG.nombre, pad, Math.round(16 * s));
      if (sub) { x.fillStyle = tema().tinta2; x.font = '400 ' + Math.round(10 * s) + 'px "IBM Plex Sans",Arial,sans-serif'; x.fillText(sub, pad, Math.round(37 * s)); }
      x.fillStyle = tema().enfasis; x.fillRect(pad, cabH - Math.round(6 * s), cv.width - 2 * pad, Math.max(2, Math.round(1.5 * s)));
      x.drawImage(img, 0, cabH);
      const a = document.createElement('a'); a.href = cv.toDataURL('image/png');
      a.download = (titulo || 'grafico').replace(/[^\wáéíóúñÁÉÍÓÚÑ]+/g, '_').slice(0, 40) + '_' + CFG.clave + '_HD.png';
      document.body.appendChild(a); a.click(); a.remove();
    };
    img.src = c.getDataURL({ type: 'png', pixelRatio: pr, backgroundColor: '#fff' });
  }

  /* ---- Modo reunion -------------------------------------------------------- */
  function construirReunion() {
    const b = $('#b-reunion');
    if (S.modo === 'normal') {
      b.hidden = false;
      b.onclick = () => { S.modo = 'ensayo'; entrarReunion(); };
    } else entrarReunion();
  }
  function entrarReunion() {
    document.documentElement.classList.add('reunion'); document.body.classList.add('reunion');
    $('#b-reunion').hidden = true; construirNav(); ir(primera());
  }
  function salirReunion() {
    S.modo = 'normal'; document.documentElement.classList.remove('reunion'); document.body.classList.remove('reunion');
    if (S.f[S.mod.reunionFoco]) S.f[S.mod.reunionFoco].clear();
    $('#b-reunion').hidden = false; $('#franja-reunion').innerHTML = ''; construirNav(); aplicarFiltros(); ir('inicio');
  }
  function pintarFranja() {
    const host = $('#franja-reunion');
    if (S.modo === 'normal') { host.innerHTML = ''; return; }
    const lista = secciones(), i = lista.findIndex(s => s.id === S.seccion), foco = S.mod.reunionFoco;
    const nombres = foco ? (SEGS.find(s => s.k === foco) || {}).nombres || [] : [];
    const actual = S.f[foco] && S.f[foco].size === 1 ? [...S.f[foco]][0] : -1;
    host.innerHTML = '<p>Reunión de ventas, datos al ' + F.fechaLarga(S.P.dateMax) + ' · ' + (i + 1) + ' de ' + lista.length + '</p>'
      + (foco ? '<label class="sr" for="r-foco">Enfocar en</label><select id="r-foco"><option value="-1">Todo el equipo</option>'
        + nombres.map((n, k) => '<option value="' + k + '"' + (k === actual ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>' : '')
      + '<button class="btn btn-sec" type="button" id="r-ant"' + (i <= 0 ? ' disabled' : '') + '>Anterior</button>'
      + '<button class="btn btn-sec" type="button" id="r-sig"' + (i >= lista.length - 1 ? ' disabled' : '') + '>Siguiente</button>'
      + '<button class="btn btn-sec" type="button" id="r-pant">' + ICO.pantalla + 'Pantalla completa</button>'
      + (S.modo === 'ensayo' ? '<button class="btn btn-sec" type="button" id="r-salir">Salir del modo reunión</button>' : '');
    $('#r-ant').onclick = () => paso(-1); $('#r-sig').onclick = () => paso(1);
    $('#r-pant').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {});
    const sel = $('#r-foco'); if (sel) sel.onchange = () => { const v = +sel.value; S.f[foco] = new Set(v >= 0 ? [v] : []); aplicarFiltros(); };
    const sal = $('#r-salir'); if (sal) sal.onclick = salirReunion;
  }
  function paso(d) { const l = secciones(), i = l.findIndex(s => s.id === S.seccion), j = i + d; if (j >= 0 && j < l.length) ir(l[j].id); }
  /* Los presentadores inalambricos mandan PageUp/PageDown */
  function teclas(e) {
    if (e.key === 'Escape') { cerrarPops(); alternarNav(false); alternarFiltros(false); ocultarTip(); return; }
    if (S.modo === 'normal' || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); paso(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); paso(-1); }
  }

  /* ---- Novedades: la historia del sistema, igual en todas las empresas ---- */
  const TIPOS = { version: ['Versión', 'etq-p'], nuevo: ['Nuevo', 'etq-p'], mejora: ['Mejora', 'etq-n'], arreglo: ['Arreglo', 'etq-a'],
    seguridad: ['Seguridad', 'etq-n'], corte: ['Corte de datos', 'etq-n'] };
  const FILTROS_NOV = [['todo', 'Todo'], ['cambios', 'Versiones y mejoras'], ['arreglo', 'Arreglos'], ['corte', 'Cortes de datos']];
  GIP.seccionNovedades = {
    nav: 'Novedades', pregunta: '¿Qué ha cambiado en el sistema?', reunion: true,
    lectura: c => {
      const e = entradasNov(), cod = e.filter(x => x.tipo !== 'corte'), cortes = e.filter(x => x.tipo === 'corte');
      const primera = e.length ? e[e.length - 1].fecha : c.P.dateMin;
      return 'Desde el ' + F.fechaLarga(primera) + ' van <b>' + cod.length + ' cambios</b> al sistema y <b>' + cortes.length + ' cortes de datos</b>. '
        + 'Versión vigente: <b>' + esc(version()) + '</b>.';
    },
    bandas: [{ tarjetas: [{ id: 'novedades', tipo: 'html', titulo: 'Historial de versiones', pista: 'Lo más reciente arriba. Cada cambio del sistema suma una entrada.',
      render: (c, host) => {
        const f = S.tablas.novedades || (S.tablas.novedades = { f: 'todo' });
        const lista = entradasNov().filter(e => f.f === 'todo' || (f.f === 'cambios' ? !['arreglo', 'corte'].includes(e.tipo) : e.tipo === f.f));
        let mes = '', h = '<div id="nov-filtro"></div><ol class="linea-tiempo">';
        for (const e of lista) {
          const m = e.fecha.slice(0, 7);
          if (m !== mes) { mes = m; h += '<li class="lt-mes">' + F.mes(+m.slice(5) - 1).replace(/^./, x => x.toUpperCase()) + ' de ' + m.slice(0, 4) + '</li>'; }
          const t = TIPOS[e.tipo] || ['', 'etq-n'];
          h += '<li class="lt"><div class="lt-v"><b>' + esc(e.tipo === 'corte' ? 'Corte ' + e.corte : 'v' + e.v) + '</b>' + F.fechaCorta(e.fecha) + '</div><div>'
            + '<h4><span class="etq ' + t[1] + '">' + t[0] + '</span>' + esc(e.titulo) + '</h4>'
            + ((e.detalle || []).length ? '<ul>' + e.detalle.map(d => '<li>' + esc(d) + '</li>').join('') + '</ul>' : '') + '</div></li>';
        }
        host.innerHTML = h + '</ol>';
        KIT.selector($('#nov-filtro', host), FILTROS_NOV, f.f, v => { f.f = v; GIP.repintar(); });
      } }] }],
  };
  function entradasNov() {
    const e = ((S.P.changelog || {}).entradas || []);
    return e.filter(x => (x.empresas || []).some(k => k === 'grupo' || k === CFG.clave));
  }

  /* ---- Puerta: el boton Entrar ------------------------------------------- */
  document.getElementById('enter').onclick = () => entrar(document.getElementById('pin').value.trim());
  document.getElementById('pin').addEventListener('keydown', e => { if (e.key === 'Enter') entrar(e.target.value.trim()); });
})(window);
