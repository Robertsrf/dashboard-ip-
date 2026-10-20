// Totales de control calculados con el motor del navegador (app/motor.js) sobre
// un paquete gzip ya descifrado. Lo llama tools/verificar.py: node tools/paridad.mjs <paquete.gz>
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = { console, TextDecoder, Blob, Response, DecompressionStream, Uint8Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(join(raiz, 'app', 'motor.js'), 'utf8'), ctx);
const t = await ctx.GIP.abrir(new Uint8Array(readFileSync(process.argv[2])));
const m = new ctx.GIP.Motor(t);
const o = m.total(m.seleccion(), { sumas: ['neto'], distintos: ['doc', 'cli', 'prod'] });
console.log(JSON.stringify({ filas: o.filas, neto: Math.round(o.neto * 100) / 100, doc: o.doc, cli: o.cli, prod: o.prod }));
