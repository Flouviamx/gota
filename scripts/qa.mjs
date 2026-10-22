// Control de calidad automático de todo el set (o de una categoría), en Chrome:
// - fuera del área viva (path entre 1.75 y 22.25),
// - densidad: más de 28 % de tinta a 32 px (demasiadas piezas: simplificar); umbral fijo para que el
//   criterio no se mueva cuando el set crece,
// - casi duplicados: dos íconos que a 32 px se ven casi iguales (similitud ≥ 0.975), salvo los de
//   una misma familia (calendar y calendar-plus se parecen a propósito),
// - relleno que cambia la silueta (el relleno debe ocupar la misma caja que el contorno),
// - fragmentos: trazos abiertos de menos de 2 de largo que no son un punto,
// - casi toca: un trazo que termina a menos del aire mínimo de otro sin tocarlo (entre 0.35 y
//   2.85 de centro a centro: o toca, o deja 1.5 de aire entre bordes).
// Uso: node scripts/qa.mjs [categoría]
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../engine/variants.mjs';
import { openChrome, sleep } from './chrome.mjs';
import { loadAll } from './load.mjs';

const only = process.argv[2];
const { categories, errors } = await loadAll();
if (errors.length) console.warn(`(avisos de validación: ${errors.length}; corre build --check)`);
const all = categories.flatMap((c) => Object.entries(c.icons).map(([name, icon]) => ({ name, cat: c.category, icon })));
const b64 = (s) => Buffer.from(s).toString('base64');
const data = all.map(({ name, cat, icon }) => ({
  name,
  cat,
  d: icon.d,
  outline: b64(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" color="black">${render(icon, { id: 'a' })}</svg>`),
  fill: icon.fill ? b64(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" color="black">${render(icon, { style: 'fill', id: 'b' })}</svg>`) : null,
}));
const file = join(process.cwd(), 'previews', `_qa-${process.pid}.html`);
writeFileSync(file, `<!doctype html><svg id="probe" width="0" height="0"></svg><script>window.DATA = ${JSON.stringify(data)};</script>`);
const browser = await openChrome();
await browser.send('Page.enable');
await browser.send('Page.navigate', { url: `file://${file}` });
await sleep(500);
const result = await browser.evaluate(`(async () => {
  const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/svg+xml;base64,' + src; });
  const c = document.createElement('canvas'); c.width = c.height = 32; const ctx = c.getContext('2d', { willReadFrequently: true });
  const alpha = async (src) => { ctx.clearRect(0, 0, 32, 32); ctx.drawImage(await load(src), 0, 0); const px = ctx.getImageData(0, 0, 32, 32).data; const a = new Float32Array(1024); for (let i = 0; i < 1024; i++) a[i] = px[i * 4 + 3] / 255; return a; };
  const box = (a) => { let x0 = 32, y0 = 32, x1 = -1, y1 = -1; for (let i = 0; i < 1024; i++) if (a[i] > 0.2) { const x = i % 32, y = (i / 32) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
  const probe = document.getElementById('probe');
  const out = [];
  for (const it of window.DATA) {
    const a = await alpha(it.outline);
    let ink = 0; for (const v of a) ink += v;
    probe.innerHTML = it.d.map((d) => '<path d="' + d + '"/>').join('');
    let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    for (const p of probe.querySelectorAll('path')) { const b = p.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); }
    // Fragmentos y casi-toques entre los trazos del dibujo base
    const els = [...probe.querySelectorAll('path')];
    const info = els.map((p, i) => {
      const L = p.getTotalLength();
      const closed = /[zZ]\s*$/.test(it.d[i]);
      const pts = [];
      for (let t = 0; t <= L; t += 0.25) { const q = p.getPointAtLength(t); pts.push([q.x, q.y]); }
      const b = p.getBBox();
      const dot = closed && b.width < 2.2 && b.height < 2.2;
      return { L, closed, pts, dot, ends: closed ? [] : [p.getPointAtLength(0), p.getPointAtLength(L)] };
    });
    const fragments = info.map((x, i) => (!x.closed && !x.dot && x.L < 2 ? i : -1)).filter((i) => i >= 0);
    const near = [];
    // Dos trazos que se cruzan o se tocan en algún punto están unidos: sus extremos no rozan
    const touch = (x, y) => x.pts.some(([ax, ay]) => y.pts.some(([bx, by]) => Math.hypot(ax - bx, ay - by) < 0.35));
    info.forEach((x, i) => x.ends.forEach((e) => {
      let m = 99;
      info.forEach((y, j) => {
        if (j === i) return;
        let mj = 99;
        for (const [px, py] of y.pts) mj = Math.min(mj, Math.hypot(px - e.x, py - e.y));
        if (mj < m && !(mj > 0.35 && touch(x, y))) m = mj;
      });
      if (m > 0.35 && m < 2.85) near.push([i, Math.round(m * 100) / 100]);
    }));
    let silhouette = null;
    if (it.fill) { const f = await alpha(it.fill); const A = box(a), B = box(f); silhouette = Math.max(...A.map((v, i) => Math.abs(v - B[i]))); }
    out.push({ name: it.name, cat: it.cat, ink: ink / 1024, bbox: [x0, y0, x1, y1], silhouette, fragments, near, a: Array.from(a, (v) => Math.round(v * 100) / 100) });
  }
  return out;
})()`);
await browser.close();
rmSync(file);

const mine = (r) => !only || r.cat === only;
const issues = [];
// Área viva
for (const r of result.filter(mine)) {
  const [x0, y0, x1, y1] = r.bbox;
  if (x0 < 1.75 || y0 < 1.75 || x1 > 22.25 || y1 > 22.25) issues.push(`área   ${r.cat}/${r.name}: [${r.bbox.map((v) => v.toFixed(2)).join(', ')}]`);
}
// Densidad: umbral fijo (las líneas sueltas son ligeras por naturaleza: no hay aviso de ligero)
const DENSE = 0.28;
for (const r of result.filter(mine)) if (r.ink > DENSE) issues.push(`denso  ${r.cat}/${r.name}: tinta ${(r.ink * 100).toFixed(1)}% (máximo ${DENSE * 100}%); ¿sobran piezas?`);
// Fragmentos y casi-toques
for (const r of result.filter(mine)) {
  if (r.fragments.length) issues.push(`suelto ${r.cat}/${r.name}: trazo(s) ${r.fragments.join(', ')} de menos de 2 de largo`);
  for (const [i, m] of r.near) issues.push(`roza  ${r.cat}/${r.name}: el trazo ${i} termina a ${m} de otro (o toca o deja 1.5 de aire)`);
}
// Relleno que se sale de la silueta del contorno (más de 1 px a 32)
for (const r of result.filter(mine)) if (r.silhouette !== null && r.silhouette > 1) issues.push(`silueta ${r.cat}/${r.name}: el relleno cambia la caja ${r.silhouette} px`);
// Casi duplicados (coseno sobre la tinta a 32 px)
const norm = result.map((r) => Math.sqrt(r.a.reduce((s, v) => s + v * v, 0)) || 1);
for (let i = 0; i < result.length; i++)
  for (let j = i + 1; j < result.length; j++) {
    if (!mine(result[i]) && !mine(result[j])) continue;
    const [n1, n2] = [result[i].name, result[j].name];
    if (n1.startsWith(`${n2}-`) || n2.startsWith(`${n1}-`) || n1.split('-')[0] === n2.split('-')[0]) continue;
    let dot = 0;
    const A = result[i].a;
    const B = result[j].a;
    for (let k = 0; k < 1024; k++) dot += A[k] * B[k];
    const sim = dot / (norm[i] * norm[j]);
    if (sim >= 0.975) issues.push(`doble  ${result[i].cat}/${result[i].name} ≈ ${result[j].cat}/${result[j].name} (${sim.toFixed(3)})`);
  }
console.log(`QA ${only ?? 'todo el set'}: ${result.filter(mine).length} íconos revisados, ${issues.length} avisos`);
if (issues.length) console.log(issues.map((i) => `  - ${i}`).join('\n'));
