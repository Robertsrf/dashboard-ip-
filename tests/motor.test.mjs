// Pruebas del motor del navegador (app/motor.js) con el runner de Node: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, TextDecoder, Blob, Response, DecompressionStream, Uint8Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(join(RAIZ, 'app', 'motor.js'), 'utf8'), ctx);
const { abrir, Motor, tiempo } = ctx.GIP;
// los objetos creados dentro de vm tienen otro prototipo: se comparan como datos
const plano = x => JSON.parse(JSON.stringify(x));

// Paquete real hecho por grupo/paquete.py: la ida y vuelta Python -> JS es la que importa
function paquetePython(meta, cols) {
  const dir = mkdtempSync(join(tmpdir(), 'gip-'));
  const out = join(dir, 'p.bin');
  const py = `import json,sys\nfrom grupo import paquete\nm,c=json.loads(sys.argv[1]),json.loads(sys.argv[2])\n` +
    `c={k:(tuple(v) if isinstance(v,list) and len(v)==2 and isinstance(v[0],list) else v) for k,v in c.items()}\n` +
    `open(sys.argv[3],'wb').write(paquete.empaquetar(m,c))`;
  execFileSync('python', ['-c', py, JSON.stringify(meta), JSON.stringify(cols), out], { cwd: RAIZ });
  return new Uint8Array(readFileSync(out));
}

// 8 filas: dia, vend, cli, doc, neto (centavos)
const FILAS = {
  dia:  [0, 0, 1, 2, 2, 3, 4, 4],
  vend: [0, 1, 0, 2, 2, 1, 0, 1],
  cli:  [0, 1, 0, 3, 4, 1, 0, 2],
  doc:  [0, 1, 2, 3, 3, 4, 5, 6],
  neto: [[10, 20.5, 5, 1.25, 3, -2, 7, 100], 100],
};

test('abre el paquete de Python con las escalas', async () => {
  const t = await abrir(paquetePython({ dims: { vend: ['A', 'B', 'C'] } }, FILAS));
  assert.equal(t.n, 8);
  assert.deepEqual(plano(t.meta.dims.vend), ['A', 'B', 'C']);
  assert.deepEqual([...t.cols.neto], [1000, 2050, 500, 125, 300, -200, 700, 10000]);
  assert.equal(t.escala.neto, 100);
});

test('seleccion con filtros por columna y rango de dias', async () => {
  const m = new Motor(await abrir(paquetePython({}, FILAS)));
  assert.equal(m.seleccion().length, 8);
  m.filtrar('vend', new Set([0, 1]));
  assert.deepEqual([...m.seleccion()], [0, 1, 2, 5, 6, 7]);
  m.rangoDias(1, 3);
  assert.deepEqual([...m.seleccion()], [2, 5]);
  m.limpiar();
  assert.equal(m.seleccion().length, 8);
});

test('total y agrupar: sumas exactas y distintos', async () => {
  const m = new Motor(await abrir(paquetePython({}, FILAS)));
  const tot = m.total(m.seleccion(), { sumas: ['neto'], distintos: ['doc', 'cli'] });
  assert.equal(tot.neto, 144.75);
  assert.equal(tot.doc, 7);
  assert.equal(tot.cli, 5);
  assert.equal(tot.filas, 8);
  const g = m.agrupar(m.seleccion(), 'vend', { sumas: ['neto'], distintos: ['doc', 'cli'] });
  assert.deepEqual([...g.neto], [22, 118.5, 4.25]);
  assert.deepEqual([...g.doc], [3, 3, 1]);   // vend 2 tiene el doc 3 dos veces
  assert.deepEqual([...g.cli], [1, 2, 2]);
  assert.deepEqual([...g.filas], [3, 3, 2]);
});

test('porDia y ultimoDia', async () => {
  const m = new Motor(await abrir(paquetePython({}, FILAS)));
  assert.deepEqual([...m.porDia(m.seleccion(), 'neto', 5)], [30.5, 5, 4.25, -2, 107]);
  assert.deepEqual([...m.ultimoDia(m.seleccion(), 'cli')], [4, 3, 4, 2, 2]);
});

// ---- Paridad con la v3 (template.html, projLine/partialInfo/effNeto) --------------
function projLineV3(neto, histMonthNums, dateMax) {
  const dm = dateMax.split('-'); const y = +dm[0], mm = +dm[1], day = +dm[2];
  const dim = new Date(y, mm, 0).getDate(); const idx = neto.length - 1;
  const pi = { partial: day < dim && neto[idx] > 0, frac: day / dim, idx };
  const eff = neto.slice(); if (pi.partial && pi.frac > 0) eff[pi.idx] = neto[pi.idx] / pi.frac;
  const idxData = histMonthNums.map(m => m - 1); const yFull = Array(12).fill(null);
  neto.forEach((v, i) => yFull[idxData[i]] = v);
  const xs = idxData, ys = eff, nn = xs.length; let lr = { slope: 0, intercept: ys[nn - 1] || 0 };
  if (nn >= 2) {
    const sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0), sxx = xs.reduce((a, b) => a + b * b, 0),
      sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
    const dd = nn * sxx - sx * sx; const sl = dd ? (nn * sxy - sx * sy) / dd : 0; lr = { slope: sl, intercept: (sy - sl * sx) / nn };
  }
  const partialCal = pi.partial ? idxData[pi.idx] : -1; const lastFullEst = pi.partial ? eff[pi.idx] : null;
  const proj = yFull.map((v, m) => v != null ? v : Math.max(0, lr.slope * m + lr.intercept));
  if (partialCal >= 0) proj[partialCal] = Math.max(lastFullEst, yFull[partialCal] || 0);
  const projOnly = yFull.map((v, m) => v != null ? null : proj[m]);
  const lastReal = idxData[idxData.length - 1]; if (lastReal >= 0) projOnly[lastReal] = proj[lastReal];
  return { yFull, proj, projOnly, partial: pi.partial, partialCal, eff };
}

for (const [nombre, dateMax] of [['mes completo', '2026-09-30'], ['mes parcial', '2026-10-15']]) {
  test('proyeccion identica a la v3 · ' + nombre, () => {
    const neto = [620282, 952419, 1091181, 843932, 1110243, 811207, 432523, 570868, 583853];
    const hist = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (nombre === 'mes parcial') { neto.push(236473); hist.push(10); }
    const v3 = projLineV3(neto, hist, dateMax);
    const v4 = plano(tiempo.proyeccion(neto, hist, dateMax));
    assert.deepEqual(v4.yFull, v3.yFull);
    assert.deepEqual(v4.proj, v3.proj);
    assert.deepEqual(v4.projOnly, v3.projOnly);
    assert.equal(v4.partial, v3.partial);
    assert.equal(v4.partialCal, v3.partialCal);
    assert.deepEqual(v4.eff, v3.eff);
  });
}

test('cruzar: suma por pares de codigos (p. ej. vendedor x mes)', async () => {
  const m = new Motor(await abrir(paquetePython({}, FILAS)));
  const x = m.cruzar(m.seleccion(), 'vend', 'dia', 'neto');
  assert.equal(x.nB, 5);
  // vend 1: dia 0 = 20.5, dia 3 = -2, dia 4 = 100
  assert.deepEqual([...x.v.subarray(5, 10)], [20.5, 0, 0, -2, 100]);
  assert.deepEqual([...x.v.subarray(0, 5)], [10, 5, 0, 0, 7]);
});
