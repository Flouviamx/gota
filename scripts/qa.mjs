// Automated quality control for the whole set (or one category), in Chrome:
// - area: outside the live area (path between 1.75 and 22.25),
// - dense: more than 28% ink at 32 px (too many parts: simplify), measured without the badge; a
//   fixed threshold so the criterion does not shift as the set grows,
// - double: near duplicates, two icons that look almost the same at 32 px (similarity ≥ 0.975),
//   except those in the same family (calendar and calendar-plus look alike on purpose),
// - silhouette: a fill that changes the silhouette (the fill must occupy the same box as the outline),
// - loose: fragments, open paths shorter than 2 that are not a dot,
// - open: an open path inside fill.solid (it would fill as a wedge): close it (Z), or move it to
//   lines/wire if it is a line,
// - near: a path that ends closer than the minimum clearance to another without touching it
//   (between 0.35 and 2.85 center to center: either touch, or leave 1.5 of clearance between edges),
// - weights: the structure changes between weights 0.9 and 2.1 (no compatible masters for the
//   variable font and Xcode symbols): pieces that merge or split, holes that open or close.
// Usage: node scripts/qa.mjs [category]   (weights needs npm ci: canvaskit-wasm)
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../engine/variants.mjs';
import { openChrome, sleep } from './chrome.mjs';
import { loadAll } from './load.mjs';

const only = process.argv[2];
const { categories, errors } = await loadAll();
if (errors.length) console.warn(`(validation warnings: ${errors.length}; run build --check)`);
const all = categories.flatMap((c) => Object.entries(c.icons).map(([name, icon]) => ({ name, cat: c.category, icon })));
const b64 = (s) => Buffer.from(s).toString('base64');
const data = all.map(({ name, cat, icon }) => ({
  name,
  cat,
  d: icon.d,
  box: [...icon.d, ...(icon.badge?.d ?? [])],
  open: [icon.fill, icon.small?.fill, icon.badge?.fill].filter((x) => x && typeof x === 'object').flatMap((x) => x.solid ?? []).filter((d) => !/[zZ]\s*$/.test(d)).length,
  outline: b64(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" color="black">${render(icon, { id: 'a' })}</svg>`),
  // Density is the drawing's: a status badge is a solid disc, ink that isn't "too many parts"
  bare: icon.badge ? b64(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" color="black">${render({ ...icon, badge: undefined }, { id: 'c' })}</svg>`) : null,
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
    let ink = 0; for (const v of it.bare ? await alpha(it.bare) : a) ink += v;
    probe.innerHTML = it.box.map((d) => '<path d="' + d + '"/>').join('');
    let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    for (const p of probe.querySelectorAll('path')) { const b = p.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); }
    // Fragments and near-touches between the base drawing's paths (not the badge: the engine sets its clearance)
    probe.innerHTML = it.d.map((d) => '<path d="' + d + '"/>').join('');
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
    // Two paths that cross or touch at some point are joined: their endpoints do not count as near
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
    out.push({ name: it.name, cat: it.cat, ink: ink / 1024, bbox: [x0, y0, x1, y1], silhouette, fragments, near, open: it.open, a: Array.from(a, (v) => Math.round(v * 100) / 100) });
  }
  return out;
})()`);
await browser.close();
rmSync(file);

const mine = (r) => !only || r.cat === only;
const issues = [];
// Live area
for (const r of result.filter(mine)) {
  const [x0, y0, x1, y1] = r.bbox;
  if (x0 < 1.75 || y0 < 1.75 || x1 > 22.25 || y1 > 22.25) issues.push(`area   ${r.cat}/${r.name}: [${r.bbox.map((v) => v.toFixed(2)).join(', ')}]`);
}
// Density: a fixed threshold (loose lines are light by nature: there is no "too light" warning)
const DENSE = 0.28;
for (const r of result.filter(mine)) if (r.ink > DENSE) issues.push(`dense  ${r.cat}/${r.name}: ink ${(r.ink * 100).toFixed(1)}% (max ${DENSE * 100}%); too many parts?`);
// Fragments, near-touches and open fills
for (const r of result.filter(mine)) {
  if (r.open) issues.push(`open   ${r.cat}/${r.name}: ${r.open} open path(s) in fill.solid (close it with Z or move it to lines/wire)`);
  if (r.fragments.length) issues.push(`loose  ${r.cat}/${r.name}: path(s) ${r.fragments.join(', ')} shorter than 2`);
  for (const [i, m] of r.near) issues.push(`near   ${r.cat}/${r.name}: path ${i} ends ${m} from another (either touch it or leave 1.5 of clearance)`);
}
// Fill that goes beyond the outline's silhouette (more than 1 px at 32)
for (const r of result.filter(mine)) if (r.silhouette !== null && r.silhouette > 1) issues.push(`silhouette ${r.cat}/${r.name}: the fill changes the box by ${r.silhouette} px`);
// Near duplicates (cosine similarity of the ink at 32 px)
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
    if (sim >= 0.975) issues.push(`double ${result[i].cat}/${result[i].name} ≈ ${result[j].cat}/${result[j].name} (${sim.toFixed(3)})`);
  }
// Weights: one structure from 0.9 to 2.1, so the variable font and Xcode symbols can interpolate
// (compatible masters, checked; it needs the dev dependency, npm ci)
const { masters } = await import('./masters.mjs');
for (const { name, cat, icon } of all.filter((it) => !only || it.cat === only))
  for (const style of icon.fill ? ['outline', 'fill'] : ['outline'])
    try {
      masters({ name, ...icon }, { style });
    } catch (error) {
      const why = error.message.match(/joined\/follow: ([^·]*)/)?.[1] ?? error.message;
      const kind = /contours differ/.test(why) ? 'pieces merge or split between weights' : /turn differently/.test(why) ? 'a hole opens or closes between weights' : 'no clean interpolation between weights';
      issues.push(`weights ${cat}/${name} (${style}): ${kind}`);
    }
console.log(`QA ${only ?? 'whole set'}: ${result.filter(mine).length} icons checked, ${issues.length} warnings`);
if (issues.length) console.log(issues.map((i) => `  - ${i}`).join('\n'));
