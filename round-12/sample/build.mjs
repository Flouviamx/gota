// The owner's sample of round 12, the sweep: every new icon by category (its Spanish label and its
// name, at 18, 24, or 32 px), and what the main session dropped after the critics, with the reason
// for each. The sweep adds to categories that already exist, so a category shows only the round's
// names it draws. Run it after the full build (it reads svg/ and dist/icons.json), then publish the
// page as a private artifact for the owner. Each icon is a CSS mask: it takes the theme's color, and
// badge masks with the same ids in two inline SVGs can't collide.
// Usage (from the repository root): node round-12/sample/build.mjs <out.html> [theme in Spanish]
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [out, theme = 'el barrido'] = process.argv.slice(2);
if (!out) throw new Error('usage: node round-12/sample/build.mjs <out.html> [theme]');
const ROOT = resolve('.');
const R = join(ROOT, 'round-12');
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const approved = read(join(R, 'approved.json'));
const drops = existsSync(join(R, 'main-drops.json')) ? read(join(R, 'main-drops.json')) : {};
const taxonomy = read(join(ROOT, 'src/taxonomy.json'));
const icons = read(join(ROOT, 'dist/icons.json'));
const setTotal = Array.isArray(icons) ? icons.length : Object.keys(icons).length;
const entry = (c) => taxonomy.categories.find((x) => x.id === c);
// The illustrators' and critics' drops, from every report of the round (one per domain group)
const gone = new Set(
  readdirSync(join(R, 'reports'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => read(join(R, 'reports', f)).dropped ?? [])
    .map((d) => d.name),
);

let total = 0;
const CATS = Object.keys(approved).filter((c) => existsSync(join(ROOT, 'src/i18n', `${c}.json`)));
const sections = CATS.map((c) => {
  const i18n = read(join(ROOT, 'src/i18n', `${c}.json`));
  const names = approved[c].map((x) => x.name).filter((n) => i18n[n] && existsSync(join(ROOT, 'svg', `${n}.svg`)));
  if (!names.length) return '';
  total += names.length;
  const tiles = names
    .map((n) => {
      const svg = readFileSync(join(ROOT, 'svg', `${n}.svg`), 'utf8');
      const uri = `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29')}")`;
      return `<li class="tile" title="${esc(n)}"><span class="ico" style="--i:${esc(uri)}"></span><span class="es">${esc(i18n[n].label.es)}</span><code>${esc(n)}</code></li>`;
    })
    .join('');
  const lost = approved[c].map((x) => x.name).filter((n) => gone.has(n));
  const meta = `<span class="num">${names.length}</span> íconos nuevos`;
  const lostLine = lost.length ? `<p class="gone">Los quitaron su ilustrador y su crítico: ${lost.map((g) => `<code>${esc(g)}</code>`).join(', ')}.</p>` : '';
  return `<section class="cat" id="${c}"><header class="cat-head"><h2>${esc(entry(c).label.es)}</h2><p class="meta">${meta}</p></header><ul class="grid">${tiles}</ul>${lostLine}</section>`;
}).join('');
const shown = CATS.filter((c) => sections.includes(`id="${c}"`));

const dropped = Object.values(drops).flat();
const html = readFileSync(join(R, 'sample', 'template.html'), 'utf8')
  .replace(/__ROUND__/g, '12')
  .replace('__THEME__', esc(theme))
  .replace(/__TOTAL__/g, total.toLocaleString('en-US'))
  .replace('__CATS__', String(shown.length))
  .replace('__SET__', setTotal.toLocaleString('en-US'))
  .replace('__APPROVED__', String(Object.values(approved).flat().length))
  .replace('__NAV__', shown.map((c) => `<a href="#${c}">${esc(entry(c).label.es)}</a>`).join(''))
  .replace('__DROPCOUNT__', String(dropped.length))
  .replace('__DROPS__', dropped.map((d) => `<li><code>${esc(d.name)}</code><span>${esc(d.reason)}</span></li>`).join(''))
  .replace('__SECTIONS__', sections);
writeFileSync(out, html);
console.log(`${out}: ${total} icons in ${shown.length} categories, ${dropped.length} drops, ${Math.round(html.length / 1024)} KB`);
