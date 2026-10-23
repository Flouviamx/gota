// Typefaces drawn with Gota's engine. A typeface's folder holds its source, glyphs.mjs: a function that
// receives the engine's primitives (arc, circ, drop, line, dot) and returns the typeface (family,
// metrics in canvas units, glyphs as stroke axes with their width and side bearings, marks, and the
// accented letters composed from them), and its LICENSE. This writes, in that folder:
//   fonts/<Family>[wght].ttf · .woff2          variable, weight 300–700 (Gota's 0.9 to 2.1 stroke)
//   fonts/<Family>-{Light,Regular,Bold}.ttf · .woff2   static, at the masters (300 · 400 · 700)
//   fonts/<family>.css · specimen.png         the @font-face rules, and a specimen set in the fonts
//   words/<word>-{light,regular,bold}.svg      the typeface's `words` (a logo's name), as outlines, and
//     .json with each letter apart: { ch, d, box } (canvas units, the baseline at y = 0)
// Each glyph is an icon to the engine: its strokes on the 24 canvas, outlined at the three weights
// as compatible masters (scripts/masters.mjs, each checked against the drawing); a glyph without
// compatible masters keeps its regular outline across the variable font (reported). The names table
// carries the folder's terms (copyright, trademark, license), and the embedding is restricted.
// Usage: node scripts/type.mjs <folder> [--no-specimen]   (needs npm ci: Skia; the specimen, Chrome)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { arc, circ, dot, drop, line } from '../engine/geometry.mjs';
import { transform } from '../engine/variants.mjs';
import { openChrome, sleep } from './chrome.mjs';
import { clockwise, parse, sameShape } from './contours.mjs';
import { masters } from './masters.mjs';
import { outline } from './outline.mjs';
import { font, woff2 } from './sfnt.mjs';

const dir = process.argv[2] && resolve(process.argv[2]);
const specimen = !process.argv.includes('--no-specimen');
if (!dir) throw new Error('Which typeface? node scripts/type.mjs <folder with glyphs.mjs>');
const start = performance.now();
const { default: make } = await import(pathToFileURL(join(dir, 'glyphs.mjs')).href);
const T = make({ arc, circ, dot, drop, line });
const UPM = 2000;
const U = UPM / T.metrics.em;
// Where a glyph's origin (its leftmost axis, on the baseline) sits on the 24 canvas: room for the
// accents of capitals above and for descenders below, at the boldest weight
const [OX, OY] = [4, 19];
const STROKES = [0.9, 1.5, 2.1];
const WEIGHTS = [300, 400, 700];

// ── Glyphs: the drawn ones, then the accented ones composed from a base and a mark ──
const byChar = new Map(T.glyphs.map((g) => [g.char, g]));
const composed = T.composites.map((c) => {
  const base = byChar.get(c.base);
  if (!base) throw new Error(`${c.name}: no base ${c.base}`);
  const dy = c.cap && c.mark !== 'cedilla' ? T.capMarkShift : 0;
  return { ...base, char: c.char, name: c.name, d: [...base.d, ...T.marks[c.mark].map((d) => transform(d, 1, base.w / 2, dy))] };
});
const all = [...T.glyphs, ...composed];
const names = new Set();
for (const g of all) {
  if (names.has(g.name)) throw new Error(`Two glyphs named ${g.name}`);
  names.add(g.name);
}

const toFont = (g) => (contours) => contours.map((c) => c.map((p) => ({ x: Math.round((p.x - OX + g.l) * U), y: Math.round((OY - p.y) * U), on: p.on })));
const fixed = [];
const outlined = all.map((g) => {
  const advance = Math.round((g.l + g.w + g.r) * U);
  if (!g.d.length) return { ...g, advance, sets: [[], [], []] };
  const icon = { name: g.name, d: g.d.map((d) => transform(d, 1, OX, OY)) };
  try {
    const m = masters(icon, { style: 'outline' }, STROKES);
    const sets = clockwise(m.ds.map((d) => toFont(g)(parse(d))));
    if (!sets.every((s) => sameShape(s, sets[1]))) throw new Error('masters differ in shape');
    return { ...g, advance, sets, overlap: m.mode.startsWith('overlap') };
  } catch {
    fixed.push(g.name);
    return { ...g, advance, sets: clockwise(STROKES.map((weight) => toFont(g)(parse(outline(icon, { style: 'outline', weight }))))), overlap: true, fixed: true };
  }
});

// ── Fonts ──
const OUT = join(dir, 'fonts');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const file = T.family.replace(/\s+/g, '');
const m = T.metrics;
const metrics = Object.fromEntries(Object.entries({ ascender: m.ascender, descender: m.descender, lineGap: m.lineGap, xHeight: m.xHeight, capHeight: m.capHeight, winAscent: m.winAscent, winDescent: m.winDescent }).map(([k, v]) => [k, Math.round(v * U)]));
const license = readFileSync(join(dir, 'LICENSE'), 'utf8');
const meta = { copyright: T.copyright, trademark: T.trademark, manufacturer: T.manufacturer, designer: T.designer, url: T.url, license: T.licenseShort ?? license.trim(), licenseUrl: T.licenseUrl };
// Basic Latin, Latin-1 Supplement, Latin Extended-A, General Punctuation · Currency Symbols, Mathematical Operators
const ranges = [(1 << 0) | (1 << 1) | (1 << 2) | (1 << 31), (1 << 1) | (1 << 6), 0, 0];
const notdef = { name: '.notdef', advance: Math.round(8 * U), contours: [] };
const cmap = new Map(outlined.map((g, i) => [g.char.codePointAt(0), 1 + i]));
const common = { family: T.family, unitsPerEm: UPM, version: T.version, cmap, names: meta, metrics, ranges, fsType: 0x0002 };
const glyphAt = (g, k, deltas) => ({ name: g.name, advance: g.advance, contours: g.sets[k], overlap: g.overlap, deltas });
const write = (name, sfnt) => {
  writeFileSync(join(OUT, `${name}.ttf`), sfnt);
  writeFileSync(join(OUT, `${name}.woff2`), woff2(sfnt));
};
const axis = { tag: 'wght', min: 300, default: 400, max: 700, regions: [-1, 1], instances: ['Light', 'Regular', 'Medium', 'SemiBold', 'Bold'].map((name, i) => ({ name, value: 300 + 100 * i })) };
const variable = outlined.map((g) =>
  glyphAt(g, 1, g.fixed || !g.sets[1].length ? null : [0, 2].map((k) => g.sets[k].flatMap((c, ci) => c.map((p, pi) => [p.x - g.sets[1][ci][pi].x, p.y - g.sets[1][ci][pi].y])))),
);
write(`${file}[wght]`, font({ ...common, glyphs: [notdef, ...variable], axis }));
['Light', 'Regular', 'Bold'].forEach((style, k) => write(`${file}-${style}`, font({ ...common, style, weightClass: WEIGHTS[k], glyphs: [notdef, ...outlined.map((g) => glyphAt(g, k))] })));
const css = `/* ${T.family}: ${T.copyright} Not licensed: ${T.licenseUrl} */
@font-face { font-family: '${T.family}'; src: url('${file}[wght].woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: swap; }
`;
writeFileSync(join(OUT, `${T.family.toLowerCase().replace(/\s+/g, '-')}.css`), css);

// ── Words as outlines (for logos): each glyph's outline at that weight, set with its advance ──
rmSync(join(dir, 'words'), { recursive: true, force: true });
if (T.words?.length) {
  mkdirSync(join(dir, 'words'), { recursive: true });
  const byGlyph = new Map(outlined.map((g) => [g.char, g]));
  const svgPath = (contours, dx) =>
    contours
      .map((c) => {
        const k = c.findIndex((p) => p.on);
        const pts = [...c.slice(k), ...c.slice(0, k), c[k]];
        const at = (p) => `${(p.x + dx) / U} ${-p.y / U}`.replace(/(\.\d{3})\d+/g, '$1');
        let d = `M${at(pts[0])}`;
        for (let i = 1; i < pts.length; i++) {
          const p = pts[i];
          if (p.on) d += `L${at(p)}`;
          else {
            const q = pts[i + 1];
            const end = q.on ? q : { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, on: true };
            d += `Q${at(p)} ${at(end)}`;
            if (q.on) i++;
          }
        }
        return `${d}Z`;
      })
      .join('');
  for (const word of T.words)
    ['light', 'regular', 'bold'].forEach((weight, k) => {
      let x = 0;
      const parts = [];
      const letters = [];
      for (const ch of word) {
        const gl = byGlyph.get(ch);
        if (!gl) throw new Error(`${word}: no glyph ${ch}`);
        const d = svgPath(gl.sets[k], x);
        const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
        const lx = n.filter((_, i) => i % 2 === 0);
        const ly = n.filter((_, i) => i % 2 === 1);
        parts.push(d);
        letters.push({ ch, d, box: [Math.min(...lx), Math.min(...ly), Math.max(...lx), Math.max(...ly)] });
        x += gl.advance;
      }
      writeFileSync(join(dir, 'words', `${word.toLowerCase()}-${weight}.json`), `${JSON.stringify({ word, weight, letters })}\n`);
      const ink = parts.join('').match(/-?\d+(\.\d+)?/g).map(Number);
      const xs = ink.filter((_, i) => i % 2 === 0);
      const ys = ink.filter((_, i) => i % 2 === 1);
      const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map((v) => Math.round(v * 1000) / 1000);
      // The ink's box, the baseline at y = 0 (units of the canvas: x-height 10)
      writeFileSync(join(dir, 'words', `${word.toLowerCase()}-${weight}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" fill="currentColor"><path fill-rule="nonzero" d="${parts.join('')}"/></svg>\n`);
    });
}

// ── Specimen: set in the fonts just written, by Chrome ──
const sample = (text, weight, size) => `<p style="font-weight:${weight};font-size:${size}px">${text}</p>`;
const chars = outlined.map((g) => g.char).join('');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Specimen'; src: url('fonts/${file}[wght].woff2') format('woff2'); font-weight: 300 700; }
body{margin:0;padding:64px 72px;width:1800px;background:#161617;color:#f5f5f7;font-family:'Specimen'}
p{margin:0 0 18px;line-height:1.15;word-break:break-all}.l{display:flex;gap:56px;align-items:baseline}.k{font:13px "Helvetica Neue";color:#86868b;margin:42px 0 12px}
</style>
<div class="l">${sample('Flouvia', 400, 200)}${sample('Gota', 400, 200)}</div>
<div class="k">Light 300 · Regular 400 · 550 · Bold 700</div>
${[300, 400, 550, 700].map((w) => sample('Diseñamos y construimos software a la medida.', w, 56)).join('')}
<div class="k">Every glyph, Regular</div>${sample(chars.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'), 400, 54)}
<div class="k">Text</div>${sample('Flouvia es un estudio de diseño e ingeniería: sitios web, tiendas Shopify Plus, portales B2B, apps y plataformas propias. ¿Qué construimos juntos? «Un sistema», no una pieza suelta — 2026, 100% a la medida.', 400, 30)}`;
if (specimen) {
  writeFileSync(join(dir, '_specimen.html'), html);
  const browser = await openChrome();
  try {
    await browser.send('Page.enable');
    writeFileSync(join(dir, 'specimen.png'), await browser.shoot(join(dir, '_specimen.html'), 1944));
    await sleep(100);
  } finally {
    await browser.close();
    rmSync(join(dir, '_specimen.html'), { force: true });
  }
}
console.log(
  `✓ ${T.family}: ${outlined.length} glyphs (${T.glyphs.length} drawn, ${composed.length} composed)${fixed.length ? `; regular at every weight: ${fixed.join(', ')}` : ''}; variable and Light, Regular, Bold, TTF and WOFF2, in ${((performance.now() - start) / 1000).toFixed(0)} s → ${OUT}/ and specimen.png`,
);
