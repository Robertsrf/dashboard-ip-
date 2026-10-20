/* Motor de datos del Sistema Grupo IP (sin DOM).
   Abre el paquete v2 (grupo/paquete.py), filtra en una sola pasada sobre
   arreglos tipados y agrega por columna. Lo cargan las paginas en linea y
   tests/motor.test.mjs en Node. Las cifras de negocio (mes parcial,
   proyeccion) son copia exacta de la v3: la prueba de paridad lo vigila. */
(function (G) {
  'use strict';
  const TIPOS = { u8: Uint8Array, u16: Uint16Array, u32: Uint32Array, i32: Int32Array };

  /* buf: ArrayBuffer ya descomprimido. Las columnas son VISTAS sobre buf. */
  function leer(buf) {
    const u8 = new Uint8Array(buf);
    if (String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) !== 'GIP2') throw new Error('Paquete de datos no reconocido');
    const largo = new DataView(buf).getUint32(4, true);
    const meta = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + largo)));
    const cols = {}, escala = {};
    for (const c of meta.cols) { cols[c.n] = new TIPOS[c.t](buf, c.o, c.l); escala[c.n] = c.s; }
    return { meta, cols, escala, n: meta.filas };
  }

  async function abrir(gz) {
    const flujo = new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'));
    return leer(await new Response(flujo).arrayBuffer());
  }

  class Motor {
    constructor(tabla) {
      this.t = tabla; this.n = tabla.n; this.cols = tabla.cols; this.esc = tabla.escala;
      this.card = {}; this.f = {}; this.rango = null; this._sel = null;
    }
    /* Cardinal de una columna de codigos = maximo + 1 (los codigos son indices). */
    cardinal(col) {
      if (this.card[col] == null) {
        const a = this.cols[col]; let m = -1;
        for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
        this.card[col] = m + 1;
      }
      return this.card[col];
    }
    filtrar(col, set) { if (set && set.size) this.f[col] = set; else delete this.f[col]; this._sel = null; }
    rangoDias(a, b) { this.rango = a == null ? null : [a, b]; this._sel = null; }
    limpiar() { this.f = {}; this.rango = null; this._sel = null; }
    /* Indices de las filas que pasan los filtros (AND) y el rango de dias.
       `otro` = {f, rango} para comparar periodos sin tocar el estado.        */
    seleccion(otro) {
      if (!otro && this._sel) return this._sel;
      const f = otro ? otro.f || {} : this.f, r = otro ? otro.rango : this.rango;
      const pruebas = Object.keys(f).map(c => {
        const ok = new Uint8Array(Math.max(1, this.cardinal(c)));
        for (const v of f[c]) if (v >= 0 && v < ok.length) ok[v] = 1;
        return [this.cols[c], ok];
      });
      const dia = this.cols.dia, a = r ? r[0] : 0, b = r ? r[1] : 0, np = pruebas.length;
      const out = new Uint32Array(this.n); let k = 0;
      fila: for (let i = 0; i < this.n; i++) {
        if (r) { const d = dia[i]; if (d < a || d > b) continue; }
        for (let j = 0; j < np; j++) if (!pruebas[j][1][pruebas[j][0][i]]) continue fila;
        out[k++] = i;
      }
      const sel = out.subarray(0, k);
      if (!otro) this._sel = sel;
      return sel;
    }
    /* Totales de la seleccion: sumas (en unidades reales) y conteo de distintos. */
    total(idx, { sumas = [], distintos = [] } = {}) {
      const o = { filas: idx.length };
      for (const s of sumas) {
        const a = this.cols[s]; let t = 0;
        for (let i = 0; i < idx.length; i++) t += a[idx[i]];
        o[s] = t / this.esc[s];
      }
      for (const d of distintos) {
        const a = this.cols[d], visto = new Uint8Array(Math.max(1, this.cardinal(d))); let c = 0;
        for (let i = 0; i < idx.length; i++) { const v = a[idx[i]]; if (!visto[v]) { visto[v] = 1; c++; } }
        o[d] = c;
      }
      return o;
    }
    /* Agrupa por los codigos de `col`. Devuelve arreglos de largo cardinal(col):
       {filas, <suma>: Float64Array, <distinto>: Uint32Array}. Los distintos por
       grupo usan una clave combinada grupo*cardinal+valor (un valor puede caer
       en varios grupos: un cliente compra a varios vendedores).            */
    agrupar(idx, col, { sumas = [], distintos = [] } = {}) {
      const k = Math.max(1, this.cardinal(col)), g = this.cols[col], o = { filas: new Uint32Array(k) };
      for (let i = 0; i < idx.length; i++) o.filas[g[idx[i]]]++;
      for (const s of sumas) {
        const a = this.cols[s], t = new Float64Array(k), e = this.esc[s];
        for (let i = 0; i < idx.length; i++) t[g[idx[i]]] += a[idx[i]];
        for (let j = 0; j < k; j++) t[j] /= e;
        o[s] = t;
      }
      for (const d of distintos) {
        const a = this.cols[d], cd = Math.max(1, this.cardinal(d)), c = new Uint32Array(k), visto = new Set();
        for (let i = 0; i < idx.length; i++) {
          const r = idx[i], clave = g[r] * cd + a[r];
          if (!visto.has(clave)) { visto.add(clave); c[g[r]]++; }
        }
        o[d] = c;
      }
      return o;
    }
    /* Suma de `col` por dia (largo nDias). */
    porDia(idx, col, nDias) {
      const a = this.cols[col], dia = this.cols.dia, t = new Float64Array(nDias), e = this.esc[col];
      for (let i = 0; i < idx.length; i++) t[dia[idx[i]]] += a[idx[i]];
      for (let j = 0; j < nDias; j++) t[j] /= e;
      return t;
    }
    /* Ultimo dia con fila de cada codigo de `col` (-1 si no aparece). */
    ultimoDia(idx, col) {
      const g = this.cols[col], dia = this.cols.dia, u = new Int32Array(Math.max(1, this.cardinal(col))).fill(-1);
      for (let i = 0; i < idx.length; i++) { const r = idx[i]; if (dia[r] > u[g[r]]) u[g[r]] = dia[r]; }
      return u;
    }
    /* Suma de `colSuma` por pares (codigo de colA, codigo de colB), en un solo
       arreglo plano: v[a * nB + b]. Sirve para "los N lideres, mes a mes". */
    cruzar(idx, colA, colB, colSuma) {
      const A = this.cols[colA], B = this.cols[colB], V = this.cols[colSuma], e = this.esc[colSuma];
      const nA = Math.max(1, this.cardinal(colA)), nB = Math.max(1, this.cardinal(colB)), v = new Float64Array(nA * nB);
      for (let i = 0; i < idx.length; i++) { const r = idx[i]; v[A[r] * nB + B[r]] += V[r]; }
      for (let j = 0; j < v.length; j++) v[j] /= e;
      return { v, nA, nB, fila: a => v.subarray(a * nB, a * nB + nB) };
    }
    valor(col, fila) { return this.cols[col][fila] / this.esc[col]; }
  }

  /* ---- Tiempo: mes parcial y proyeccion (copia exacta de la v3) ------------
     El ultimo mes casi siempre es un corte quincenal: se escala a cierre antes
     de comparar y de ajustar la recta, que vive en el espacio de mes-calendario
     (histMonthNums - 1) para proyectar con continuidad hasta diciembre.      */
  function mesParcial(neto, dateMax) {
    const dm = (dateMax || '').split('-'), idx = neto.length - 1;
    if (dm.length < 3) return { partial: false, frac: 1, idx };
    const y = +dm[0], mm = +dm[1], day = +dm[2], dim = new Date(y, mm, 0).getDate();
    return { partial: day < dim && neto[idx] > 0, frac: day / dim, idx, day, dim };
  }
  function netoEfectivo(neto, pi) {
    const eff = neto.slice();
    if (pi.partial && pi.frac > 0) eff[pi.idx] = neto[pi.idx] / pi.frac;
    return eff;
  }
  function proyeccion(neto, histMonthNums, dateMax) {
    const pi = mesParcial(neto, dateMax), eff = netoEfectivo(neto, pi);
    const xs = histMonthNums.map(m => m - 1), yFull = Array(12).fill(null);
    neto.forEach((v, i) => { yFull[xs[i]] = v; });
    const nn = xs.length; let lr = { slope: 0, intercept: eff[nn - 1] || 0 };
    if (nn >= 2) {
      const sx = xs.reduce((a, b) => a + b, 0), sy = eff.reduce((a, b) => a + b, 0);
      const sxx = xs.reduce((a, b) => a + b * b, 0), sxy = xs.reduce((a, b, i) => a + b * eff[i], 0);
      const dd = nn * sxx - sx * sx, sl = dd ? (nn * sxy - sx * sy) / dd : 0;
      lr = { slope: sl, intercept: (sy - sl * sx) / nn };
    }
    const partialCal = pi.partial ? xs[pi.idx] : -1, lastFullEst = pi.partial ? eff[pi.idx] : null;
    const proj = yFull.map((v, m) => v != null ? v : Math.max(0, lr.slope * m + lr.intercept));
    if (partialCal >= 0) proj[partialCal] = Math.max(lastFullEst, yFull[partialCal] || 0);
    const projOnly = yFull.map((v, m) => v != null ? null : proj[m]);
    const lastReal = xs[xs.length - 1];
    if (lastReal >= 0) projOnly[lastReal] = proj[lastReal];
    return { yFull, proj, projOnly, lr, xs, partial: pi.partial, partialCal, lastFullEst, pi, eff };
  }

  G.GIP = Object.assign(G.GIP || {}, { leer, abrir, Motor, tiempo: { mesParcial, netoEfectivo, proyeccion } });
})(typeof globalThis !== 'undefined' ? globalThis : window);
