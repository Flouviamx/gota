// Hoja de variantes de una categoría: previews/<categoría>-variantes-<n>.png. Por ícono, a 32 px
// y a 18 px: contorno, relleno, ligero, negrita, en círculo, en cuadrado, tachado y relleno en
// círculo; a 16 px de verdad (rasterizado a 1x y ampliado sin suavizar, como en una pantalla
// normal), contorno y relleno; y, si los tiene, el espejo (derecha a izquierda), los niveles a la
// mitad y el cuadro extremo de su movimiento. Marca lo que falta (relleno, idiomas).
// Uso: node scripts/variants-sheet.mjs <categoría|all>
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, WEIGHTS } from '../engine/variants.mjs';
import { openChrome } from './chrome.mjs';
import { loadAll } from './load.mjs';

const target = process.argv[2] ?? 'all';
const { categories, errors } = await loadAll({ only: target === 'all' ? undefined : target });
if (errors.length) console.warn(`(avisos de validación)\n${errors.map((e) => `  - ${e}`).join('\n')}`);
const list = categories.filter((c) => target === 'all' || c.category === target).flatMap((c) => Object.entries(c.icons));
if (!list.length) throw new Error(`Sin íconos para «${target}»`);

const FORMS = [
  ['contorno', {}],
  ['relleno', { style: 'fill' }],
  ['ligero', { weight: WEIGHTS.light }],
  ['negrita', { weight: WEIGHTS.bold }],
  ['círculo', { enclosure: 'circle' }],
  ['cuadrado', { enclosure: 'square' }],
  ['tachado', { slash: true }],
  ['rell. círculo', { style: 'fill', enclosure: 'circle' }],
];
// Columnas que solo aplican si el ícono tiene el dato
const EXTRA = [
  ['espejo', (i) => i.mirror, { rtl: true }],
  ['niveles ½', (i) => i.levels, { value: 0.5 }],
  ['movimiento', (i) => i.motion, { frame: true }],
];
let n = 0;
const svg = (icon, o, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24">${render(icon, { ...o, id: `v${n++}` })}</svg>`;
// 16 px reales: el SVG se rasteriza en un canvas de 16 × 16 y se amplía ×3 sin suavizar
const px = (icon, o) => `<canvas class="px" width="16" height="16" data-svg="${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" color="white">${render(icon, { ...o, size: 16, id: `p${n++}` })}</svg>`).toString('base64')}"></canvas>`;
const off = (icon, o) => (o.enclosure && icon.variants?.[o.enclosure] === false) || (o.slash && icon.variants?.slash === false);
const flags = (name, icon) => `${icon.fill === undefined ? ' <b>sin relleno</b>' : ''}${i18nOf(name) ? '' : ' <b>sin idiomas</b>'}${icon.small ? ' <em>16 propio</em>' : ''}`;
const row = ([name, icon]) =>
  `<div class="row"><span class="n">${name}${flags(name, icon)}${icon.motion ? `<br><em>${icon.motion.effect}</em>` : ''}</span>${FORMS.map(([, o]) => `<span class="c">${off(icon, o) ? '<i>—</i>' : `${svg(icon, o, 32)}${svg(icon, o, 18)}`}</span>`).join('')}<span class="c">${px(icon, {})}${px(icon, { style: 'fill' })}</span>${EXTRA.map(([, has, o]) => `<span class="c">${has(icon) ? svg(icon, o, 32) : '<i>—</i>'}</span>`).join('')}</div>`;
const head = `<div class="row h"><span class="n"></span>${FORMS.map(([t]) => `<span class="c">${t}</span>`).join('')}<span class="c">16 px (1x)</span>${EXTRA.map(([t]) => `<span class="c">${t}</span>`).join('')}</div>`;
const i18nOf = (name) => categories.some((c) => c.i18n?.[name]);
const page = (items) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#161617;color:#fff;font:12px "Helvetica Neue",Helvetica,Arial;padding:8px 12px}
.row{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #ffffff10}
.n{width:150px;color:#ffffffb0;font-size:11px;line-height:1.35}.n b{color:#ff9f0a;font-weight:500}.n em{color:#5aa2ff;font-style:normal}
.c{width:78px;display:flex;gap:7px;align-items:center;justify-content:center}.h .c{color:#ffffff70;font-size:10px;text-align:center}
.px{width:48px;height:48px;image-rendering:pixelated}.px+.px{margin-left:-2px}
i{color:#ffffff40;font-style:normal}
</style>${head}${items.map(row).join('')}
<script>document.querySelectorAll('.px').forEach((c) => { const img = new Image(); img.onload = () => c.getContext('2d').drawImage(img, 0, 0); img.src = 'data:image/svg+xml;base64,' + c.dataset.svg; });</script>`;

mkdirSync('previews', { recursive: true });
const browser = await openChrome();
const PER = 30;
const out = [];
for (let p = 0; p * PER < list.length; p++) {
  const file = join(process.cwd(), 'previews', `_${target}-v${p + 1}.html`);
  writeFileSync(file, page(list.slice(p * PER, (p + 1) * PER)));
  const png = join('previews', `${target}-variantes-${p + 1}.png`);
  writeFileSync(png, await browser.shoot(file, 1240));
  rmSync(file);
  out.push(png);
}
await browser.close();
const missing = list.filter(([, i]) => i.fill === undefined).map(([n]) => n);
console.log(`✓ ${list.length} íconos → ${out.join(', ')}`);
if (missing.length) console.log(`· sin relleno (${missing.length}): ${missing.join(', ')}`);
