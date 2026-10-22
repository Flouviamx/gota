// Transitions sheet: previews/transitions-<n>.png. Nine frames of each transition, drawn by the
// engine (masks included): every curated morph and turn, every pair with the same base and a
// different badge (found on their own), and the automatic slash. A pair joins PAIRS only if every
// frame is clean. To try candidates before adding them: --try "eye>eye-closed play>pause".
// Usage: node scripts/transitions-sheet.mjs [--try "a>b c>d"]
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { frames, PAIRS, transitionOf } from '../engine/morph.mjs';
import { render } from '../engine/variants.mjs';
import { openChrome } from './chrome.mjs';
import { loadAll } from './load.mjs';

const { categories } = await loadAll();
const icons = Object.assign({}, ...categories.map((c) => c.icons));
const T = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1];
const tryArg = process.argv.indexOf('--try');
const tried = tryArg > 0 ? process.argv[tryArg + 1].split(/\s+/).filter(Boolean) : [];

// The rows: [from, to, way]
const rows = [];
if (tried.length) for (const k of tried) rows.push([...k.split('>'), { morph: true }]);
else {
  for (const k of Object.keys(PAIRS)) rows.push([...k.split('>'), null]);
  const base = new Map();
  const key = (icon) => [...icon.d].sort().join('|');
  for (const [name, icon] of Object.entries(icons)) if (!icon.badge) base.set(key(icon), name);
  for (const [name, icon] of Object.entries(icons)) if (icon.badge && base.has(key(icon))) rows.push([base.get(key(icon)), name, null]);
  rows.push(['bell', 'bell', 'slash']);
}
const missing = rows.filter(([a, b]) => !icons[a] || !icons[b]).map(([a, b]) => `${a}>${b}`);
if (missing.length) throw new Error(`Unknown icons in: ${missing.join(', ')}`);

let n = 0;
const cell = (html) => `<svg viewBox="0 0 24 24" width="56" height="56" fill="none" color="#111">${html}</svg>`;
const row = ([a, b, given]) => {
  const opts = { weight: 1.5, id: `t${++n}` };
  const way = given === 'slash' ? { slash: true } : (given ?? transitionOf(a, b, icons));
  const draw =
    given === 'slash'
      ? (t) => render(icons[a], { ...opts, slash: t })
      : way.morph
        ? frames(icons[a], icons[b], way, opts)
        : (t) => render(icons[t < 0.5 ? a : b], opts);
  const cells = T.map((t, i) => cell(draw(t).replace(/(id="|url\(#)t\d+-/g, `$1t${n}f${i}-`))).join('');
  const kind = way.slash ? 'slash' : way.rotate ? `turn ${way.rotate}°` : way.replace ? 'swap' : icons[a].badge || icons[b].badge ? 'badge' : 'morph';
  return `<div class="r"><span>${a} → ${b}<small>${kind}</small></span>${cells}</div>`;
};

mkdirSync('previews', { recursive: true });
for (const f of readdirSync('previews')) if (/^transitions-\d+\.png$/.test(f)) rmSync(join('previews', f));
const PER = 24;
const browser = await openChrome();
for (let p = 0; p * PER < rows.length; p++) {
  const file = join(process.cwd(), 'previews', `_transitions-${p + 1}-${process.pid}.html`);
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:24px;background:#fff;font:13px "Helvetica Neue",Helvetica,Arial}.r{display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid #eee}span{width:240px;display:flex;flex-direction:column;gap:2px}small{color:#888;font-size:11px}</style>${rows
      .slice(p * PER, (p + 1) * PER)
      .map(row)
      .join('')}`,
  );
  writeFileSync(join('previews', `transitions-${p + 1}.png`), await browser.shoot(file, 900));
  rmSync(file);
}
await browser.close();
console.log(`✓ ${rows.length} transitions → previews/transitions-*.png`);
