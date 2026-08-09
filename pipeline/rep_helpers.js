/* rep_helpers.js - helper de estilos Word para los informes de IP (mejora A1).
 *
 * Sin dependencias: genera un .doc que Word abre nativamente (HTML con las
 * cabeceras de Office), que es exactamente la tecnica que ya usa el dashboard
 * en downloadDoc(). Asi el informe se ve igual en pantalla y en Word, y el
 * pipeline corre con `node` pelado, sin npm install.
 *
 * ATENCION: este archivo es una reconstruccion del helper para dejar el
 * pipeline completo y ejecutable. Si conservas tu rep_helpers.js original,
 * sustituye este por el tuyo: la interfaz que consume build_report.js es
 * { doc, cover, h2, h3, p, ul, kpis, table, box, money, num, pct }.
 */

const BRAND = '#ff4f20';
const NAVY = '#24205b';

const CSS = `
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',Calibri,system-ui,sans-serif}
body{padding:28px;color:${NAVY}}
.rcover{border:2px solid ${NAVY};border-radius:10px;padding:16px 18px;margin-bottom:18px;background:#f5f6fa}
.rkick{font-size:11px;font-weight:800;letter-spacing:1px;color:${BRAND}}
h1{font-size:21px;color:${NAVY};margin:6px 0}
.rmeta{font-size:12px;color:#6b7392;line-height:1.6}
h2{font-size:17px;color:${NAVY};margin:20px 0 9px;padding-bottom:5px;border-bottom:2px solid ${BRAND}}
h3{font-size:14px;color:${NAVY};margin:16px 0 7px;padding-left:9px;border-left:4px solid ${BRAND}}
p{font-size:12.5px;line-height:1.55;margin-bottom:8px;color:#333c52}
ul{margin:6px 0 8px 20px}
li{font-size:12.5px;line-height:1.5;color:#333c52;margin-bottom:4px}
.repkpis{margin-bottom:14px}
.rk{background:#f5f6fa;border-left:4px solid ${NAVY};padding:9px 13px;display:inline-block;margin:0 8px 8px 0;min-width:150px}
.rk span{display:block;font-size:10px;text-transform:uppercase;color:#6b7392;font-weight:700}
.rk b{font-size:17px;color:${NAVY}}
table.rt{width:100%;border-collapse:collapse;font-size:11.5px;margin:6px 0 10px}
table.rt th{background:${NAVY};color:#fff;text-align:left;padding:7px 9px;font-size:10.5px;text-transform:uppercase}
table.rt td{padding:6px 9px;border-bottom:1px solid #eef1f7}
table.rt tr:nth-child(even) td{background:#f8f9fc}
.num{text-align:right}
.rbox{padding:11px 14px;margin:11px 0;font-size:12.5px;line-height:1.55}
.rbox-i{background:#eef2fb;border-left:4px solid ${NAVY}}
.rbox-g{background:#eafaf1;border-left:4px solid #16a34a}
.rbox-w{background:#fff3ee;border-left:4px solid ${BRAND}}
.conf{color:#e0472c;font-weight:700}
`;

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const money = (v) => '$' + Number(v || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => Number(v || 0).toLocaleString('es-VE');
const pct = (v, d = 1) => Number(v || 0).toFixed(d) + '%';

/** Envuelve el cuerpo en un documento que Word abre como nativo. */
function doc(title, body) {
  return '﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->' +
    '<style>' + CSS + '</style></head><body>' + body + '</body></html>';
}

function cover(kicker, title, metaLines) {
  return '<div class="rcover"><div class="rkick">' + esc(kicker) + '</div><h1>' + esc(title) + '</h1>' +
    '<div class="rmeta">' + metaLines.map(esc).join('<br>') + '</div></div>';
}

const h2 = (t) => '<h2>' + esc(t) + '</h2>';
const h3 = (t) => '<h3>' + esc(t) + '</h3>';
/** El HTML en negrita se permite a proposito: los textos los arma build_report.js. */
const p = (t) => '<p>' + t + '</p>';
const ul = (items) => '<ul>' + items.map((i) => '<li>' + i + '</li>').join('') + '</ul>';

function kpis(pairs) {
  return '<div class="repkpis">' + pairs.map(([k, v]) =>
    '<div class="rk"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>').join('') + '</div>';
}

/** table(headers, rows, numCols) - numCols: indices (0-based) alineados a la derecha. */
function table(headers, rows, numCols = []) {
  const n = new Set(numCols);
  const th = headers.map((h, i) => '<th' + (n.has(i) ? ' class="num"' : '') + '>' + esc(h) + '</th>').join('');
  const tb = rows.map((r) => '<tr>' + r.map((c, i) =>
    '<td' + (n.has(i) ? ' class="num"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('');
  return '<table class="rt"><thead><tr>' + th + '</tr></thead><tbody>' + tb + '</tbody></table>';
}

/** box(titulo, texto, tipo) - tipo: 'i' informativo, 'g' bueno, 'w' alerta. */
const box = (title, text, kind = 'i') =>
  '<div class="rbox rbox-' + kind + '"><b>' + esc(title) + '</b><br>' + text + '</div>';

module.exports = { doc, cover, h2, h3, p, ul, kpis, table, box, money, num, pct, esc, CSS };
