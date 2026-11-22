// The owner's sample of a round: every new icon by category (its Spanish label and its name, at 18,
// 24, or 32 px), and what the main session dropped after the critics, with the reason for each.
// Run it after the full build (it reads svg/ and dist/icons.json), then publish the page as a
// private artifact for the owner. Each icon is a CSS mask: it takes the theme's color, and badge
// masks with the same ids in two inline SVGs can't collide.
// Usage (from the repository root): node round-11/sample/build.mjs <out.html> [theme in Spanish]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [out, theme = 'naturaleza'] = process.argv.slice(2);
if (!out) throw new Error('usage: node round-11/sample/build.mjs <out.html> [theme]');
const ROOT = resolve('.');
const R = join(ROOT, 'round-11');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const approved = read(join(R, 'approved.json'));
const drops = existsSync(join(R, 'main-drops.json')) ? read(join(R, 'main-drops.json')) : {};
const taxonomy = read(join(ROOT, 'src/taxonomy.json'));
const icons = read(join(ROOT, 'dist/icons.json'));
const setTotal = Array.isArray(icons) ? icons.length : Object.keys(icons).length;
// Categories not drawn yet (no icons or languages file) are left out, so a partial sample works too
const CATS = Object.keys(approved).filter((c) => existsSync(join(ROOT, 'src/icons', `${c}.mjs`)) && existsSync(join(ROOT, 'src/i18n', `${c}.json`)));
const skipped = Object.keys(approved).filter((c) => !CATS.includes(c));
if (skipped.length) console.log(`left out (not drawn yet): ${skipped.join(', ')}`);
const entry = (c) => taxonomy.categories.find((x) => x.id === c);
const report = (kind, c) => (existsSync(join(R, 'reports', `${kind}-${c}.json`)) ? read(join(R, 'reports', `${kind}-${c}.json`)) : null);

let total = 0;
const sections = CATS.map((c) => {
  const i18n = read(join(ROOT, 'src/i18n', `${c}.json`));
  const names = Object.keys(i18n);
  total += names.length;
  const adopts = entry(c).adopts ?? [];
  const gone = [...new Set([report('draw', c), report('critic', c)].flatMap((r) => r?.dropped ?? []).map((d) => d.name))];
  const tiles = names
    .map((n) => {
      const svg = readFileSync(join(ROOT, 'svg', `${n}.svg`), 'utf8');
      const uri = `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}")`;
      return `<li class="tile" title="${esc(n)}"><span class="ico" style="--i:${esc(uri)}"></span><span class="es">${esc(i18n[n].label.es)}</span><code>${esc(n)}</code></li>`;
    })
    .join('');
  const meta = `<span class="num">${names.length}</span> íconos nuevos${adopts.length ? ` · Adopta ${adopts.map((a) => `<code>${esc(a)}</code>`).join(', ')}.` : ''}`;
  const lost = gone.length ? `<p class="gone">Los quitaron su ilustrador y su crítico: ${gone.map((g) => `<code>${esc(g)}</code>`).join(', ')}.</p>` : '';
  return `<section class="cat" id="${c}"><header class="cat-head"><h2>${esc(entry(c).label.es)}</h2><p class="meta">${meta}</p></header><ul class="grid">${tiles}</ul>${lost}</section>`;
}).join('');

const dropped = CATS.flatMap((c) => drops[c] ?? []);
const html = readFileSync(join(R, 'sample', 'template.html'), 'utf8')
  .replace(/__ROUND__/g, String(taxonomy.categories.find((x) => x.id === CATS[0]).round))
  .replace('__THEME__', esc(theme))
  .replace(/__TOTAL__/g, total.toLocaleString('en-US'))
  .replace('__CATS__', String(CATS.length))
  .replace('__SET__', setTotal.toLocaleString('en-US'))
  .replace('__APPROVED__', String(CATS.reduce((n, c) => n + approved[c].length, 0)))
  .replace('__NAV__', CATS.map((c) => `<a href="#${c}">${esc(entry(c).label.es)}</a>`).join(''))
  .replace('__DROPCOUNT__', String(dropped.length))
  .replace('__DROPS__', dropped.map((d) => `<li><code>${esc(d.name)}</code><span>${esc(d.reason)}</span></li>`).join(''))
  .replace('__SECTIONS__', sections);
writeFileSync(out, html);
console.log(`${out}: ${total} icons in ${CATS.length} categories, ${dropped.length} drops, ${Math.round(html.length / 1024)} KB`);
