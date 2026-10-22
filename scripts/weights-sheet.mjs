// Weights sheet for a category: previews/<category>-weights-<n>.png. Per icon, outline and fill at
// the ends of Gota's range and at regular (0.9 · 1.5 · 2.1), large, with the number of contours
// each weight's outline has: the same number at the three weights is the structure holding (QA's
// `weights`). By default only the icons QA flags; --all shows every icon of the category.
// Usage: node scripts/weights-sheet.mjs <category> [--all]   (needs npm ci: canvaskit-wasm)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../engine/variants.mjs';
import { openChrome } from './chrome.mjs';
import { loadAll } from './load.mjs';
import { masters } from './masters.mjs';
import { outline } from './outline.mjs';

const target = process.argv[2];
if (!target) throw new Error('Which category? node scripts/weights-sheet.mjs <category> [--all]');
const every = process.argv.includes('--all');
const { categories } = await loadAll({ only: target });
const cat = categories.find((c) => c.category === target);
if (!cat) throw new Error(`No category "${target}"`);

const W = [0.9, 1.5, 2.1];
const contours = (name, icon, o, w) => outline({ name, ...icon }, { ...o, weight: w }, { modes: ['joined', 'sequential', 'reverse', 'nudged'] }).split(/(?=m)/).length;
const holds = (name, icon, o) => {
  try {
    masters({ name, ...icon }, o);
    return true;
  } catch {
    return false;
  }
};
const rows = [];
for (const [name, icon] of Object.entries(cat.icons))
  for (const style of icon.fill ? ['outline', 'fill'] : ['outline']) {
    const o = { style };
    const ok = holds(name, icon, o);
    if (ok && !every) continue;
    rows.push({ name, icon, o, ok, counts: W.map((w) => contours(name, icon, o, w)) });
  }

let n = 0;
const row = ({ name, icon, o, ok, counts }) =>
  `<div class="row"><span class="n">${name}<br><em>${o.style}</em><br><b class="${ok ? 'ok' : 'no'}">${counts.join(' / ')}</b></span>${W.map((w) => `<svg width="120" height="120" viewBox="0 0 24 24" color="#111">${render(icon, { ...o, weight: w, id: `w${n++}` })}</svg>`).join('')}</div>`;
const page = (items) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#fff;color:#111;font:12px "Helvetica Neue",Helvetica,Arial;padding:8px 12px;display:flex;flex-wrap:wrap;gap:0 16px}
.h{width:100%;color:#888;padding:4px 0 8px}
.row{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #eee}
.n{width:120px;line-height:1.4}em{color:#888;font-style:normal}.ok{color:#2a8a3a;font-weight:500}.no{color:#c0392b;font-weight:500}
</style><div class="h">${target} · 0.9 · 1.5 · 2.1 · contours per weight (red: the structure changes)</div>${items.map(row).join('')}`;

mkdirSync('previews', { recursive: true });
for (const f of readdirSync('previews')) if (f.startsWith(`${target}-weights-`)) rmSync(join('previews', f));
if (!rows.length) {
  console.log(`✓ ${target}: every icon holds its structure from 0.9 to 2.1`);
  process.exit(0);
}
const browser = await openChrome();
const PER = 24;
const out = [];
for (let p = 0; p * PER < rows.length; p++) {
  const file = join(process.cwd(), 'previews', `_${target}-w${p + 1}-${process.pid}.html`);
  writeFileSync(file, page(rows.slice(p * PER, (p + 1) * PER)));
  const png = join('previews', `${target}-weights-${p + 1}.png`);
  writeFileSync(png, await browser.shoot(file, 1240));
  rmSync(file);
  out.push(png);
}
await browser.close();
console.log(`✓ ${rows.length} ${every ? 'variants' : 'variants whose structure changes'} → ${out.join(', ')}`);
