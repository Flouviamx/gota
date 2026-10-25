// Typefaces drawn with Gota's engine. A typeface's folder holds its source, glyphs.mjs, and its
// LICENSE. The source is a function that receives the engine's primitives (arc, circ, drop, line,
// dot) and the stroke it's drawn for (`stroke`: 0.9 at Light, 1.5 at Regular, 2.1 at Bold, or any
// weight between them), and returns the typeface: family, metrics in canvas units, glyphs as stroke
// axes with their width and side bearings (each weight may draw a glyph its own way: wider, spaced
// apart differently), marks and the accented letters composed from them, alternates (glyphs named
// `<base>.<feature>` without a character, such as `hyphen.case` or `one.tnum`), kerning, the pen and
// the words to write as outlines (docs/build.md, Typefaces). A glyph's `d` holds strokes, and solids
// (`{ solid: d }`: a closed shape filled as it is, its ink, without the stroke: a dot, which the
// pen can't draw as a stroke that small). This writes, in that folder:
//   fonts/<Family>[wght].ttf · .woff2          variable, weight 300–700 (Gota's 0.9 to 2.1 stroke)
//   fonts/<Family>-{Light,Regular,Bold}.ttf · .woff2   static, at the masters (300 · 400 · 700)
//   fonts/<family>.css · specimen.png · proof.png   the @font-face rules, a specimen set in the fonts,
//     and the proof: spacing and kerning at each weight, the features, and sizes from 120 to 12 px
//   words/<word>-{light,regular,bold}.svg      the typeface's `words` (a logo's name), kerned, as
//     outlines, and .json: { word, weight, advance, letters: [{ ch, x, d, box }] } (canvas units,
//     the baseline at y = 0, the word's origin at x = 0)
// Each glyph is an icon to the engine: its strokes on the 24 canvas, outlined at the three weights
// as compatible masters (scripts/masters.mjs, each checked against its weight's drawing, and so are
// the weights halfway between them); a glyph without compatible masters fails the build. The pen,
// `pen: { contrast }`, makes horizontals thinner than verticals by that ratio, as an elliptical
// nib would: the strokes are outlined narrowed by `contrast` at a stroke that much thinner, and
// widened back. Vertical metrics, the embedding flag (restricted, fsType 2), and the names table
// (copyright, trademark, manufacturer, license and its URL) come from the source.
// Usage: node scripts/type.mjs <folder> [--no-specimen] [--subset <text> --out <dir>]
//   --subset: only the glyphs of that text's characters (accented letters composed as usual), their
//   alternates and the kerning between them, as fonts only, written to --out
// (needs npm ci: Skia; the specimen and proof, Chrome)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { arc, circ, dot, drop, line } from '../engine/geometry.mjs';
import { toCubics } from '../engine/morph.mjs';
import { transform } from '../engine/variants.mjs';
import { openChrome, sleep } from './chrome.mjs';
import { clockwise, parse, sameShape } from './contours.mjs';
import { masters } from './masters.mjs';
import { font, woff2 } from './sfnt.mjs';

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const dir = args[0] && !args[0].startsWith('--') ? resolve(args[0]) : null;
const subset = option('--subset');
const out = option('--out') && resolve(option('--out'));
const specimen = !args.includes('--no-specimen') && !subset;
if (!dir) throw new Error('Which typeface? node scripts/type.mjs <folder with glyphs.mjs>');
if (subset && !out) throw new Error('--subset writes its fonts to --out <dir>');
const start = performance.now();
const { default: make } = await import(pathToFileURL(join(dir, 'glyphs.mjs')).href);
// The source drawn for a stroke; the masters' checks ask for the weights between them too
const drawings = new Map();
const source = (stroke) => {
  const key = stroke.toFixed(4);
  if (!drawings.has(key)) drawings.set(key, make({ arc, circ, dot, drop, line, stroke }));
  return drawings.get(key);
};
const STROKES = [0.9, 1.5, 2.1];
const WEIGHTS = [300, 400, 700];
const REG = 1;
const T = source(STROKES[REG]);
const UPM = 2000;
const U = UPM / T.metrics.em;
const PEN = T.pen?.contrast ?? 1;
// Where a glyph's origin (its leftmost axis, on the baseline) sits on the 24 canvas: room for the
// accents of capitals above and for descenders below, at the boldest weight
const [OX, OY] = [4, 19];

// ── Glyphs: the drawn ones (alternates among them), then the accented ones composed from a base and a mark ──
function glyphsOf(face) {
  const byKey = new Map();
  for (const g of face.glyphs) {
    byKey.set(g.name, g);
    if (g.char) byKey.set(g.char, g);
  }
  const composed = face.composites.map((c) => {
    const base = byKey.get(c.base);
    if (!base) throw new Error(`${c.name}: no base ${c.base}`);
    const dy = c.cap && c.mark !== 'cedilla' ? face.capMarkShift : 0;
    const place = (d) => transform(d, 1, base.w / 2, dy);
    return { ...base, char: c.char, name: c.name, base: base.name, d: [...base.d, ...face.marks[c.mark].map((d) => (d.solid ? { solid: place(d.solid) } : place(d)))] };
  });
  return [...face.glyphs, ...composed];
}
// Every glyph by name, drawn for a stroke
const faces = new Map();
const glyphsAt = (stroke) => {
  const key = stroke.toFixed(4);
  if (!faces.has(key)) faces.set(key, new Map(glyphsOf(source(stroke)).map((g) => [g.name, g])));
  return faces.get(key);
};
const perWeight = STROKES.map(glyphsAt);
let all = glyphsOf(T);
for (const [k, set] of perWeight.entries())
  if (set.size !== all.length || all.some((g) => !set.has(g.name))) throw new Error(`The glyphs drawn at ${STROKES[k]} aren't the ones drawn at ${STROKES[REG]}`);
const names = new Set();
for (const g of all) {
  if (names.has(g.name)) throw new Error(`Two glyphs named ${g.name}`);
  names.add(g.name);
}
// Alternates: `<base>.<feature>`, reached through that feature
const alternateOf = (g) => !g.char && g.name.includes('.') && { base: g.name.slice(0, g.name.indexOf('.')), tag: g.name.slice(g.name.lastIndexOf('.') + 1) };
if (subset) {
  const chars = new Set([...subset]);
  const kept = new Set(all.filter((g) => g.char && chars.has(g.char)).map((g) => g.name));
  all = all.filter((g) => kept.has(g.name) || (alternateOf(g) && kept.has(alternateOf(g).base)));
}

// ── Outlines: each glyph's masters, narrowed by the pen on the canvas and widened back in font units ──
const r3 = (v) => Math.round(v * 1000) / 1000;
const onCanvas = (d) =>
  toCubics(d)
    .map(({ closed, segs }) => {
      const P = (x, y) => `${r3(OX + x * PEN)} ${r3(OY + y)}`;
      const head = `M${P(segs[0][0], segs[0][1])}`;
      return head + segs.map((s) => `C${P(s[2], s[3])} ${P(s[4], s[5])} ${P(s[6], s[7])}`).join('') + (closed ? 'Z' : '');
    })
    .join('');
const toFont = (g) => (contours) => contours.map((c) => c.map((p) => ({ x: Math.round(((p.x - OX) / PEN + g.l) * U), y: Math.round((OY - p.y) * U), on: p.on })));
const stalled = [];
const outlined = all.map((g) => {
  const at = STROKES.map((_, k) => perWeight[k].get(g.name));
  const advances = at.map((m) => Math.round((m.l + m.w + m.r) * U));
  if (!g.d.length) return { ...g, at, advances, sets: [[], [], []] };
  // The glyph drawn for a stroke, on the canvas (the masters ask for the pen's thinner stroke); its
  // solids filled as they are, as the engine draws a brand mark's (`mark`), its strokes on top
  const icon = (w) => {
    const d = glyphsAt(w / PEN).get(g.name).d;
    const strokes = d.filter((p) => !p.solid).map(onCanvas);
    const solids = d.filter((p) => p.solid).map((p) => onCanvas(p.solid));
    return solids.length ? { name: g.name, mark: true, d: [...strokes, ...solids], fill: { solid: solids, wire: strokes } } : { name: g.name, d: strokes };
  };
  try {
    const m = masters(icon, { style: g.d.some((p) => p.solid) ? 'fill' : 'outline' }, STROKES.map((s) => s * PEN));
    const sets = clockwise(m.ds.map((d, k) => toFont(at[k])(parse(d))));
    if (!sets.every((s) => sameShape(s, sets[REG]))) throw new Error('masters differ in shape');
    return { ...g, at, advances, sets, overlap: m.mode.startsWith('overlap') };
  } catch (error) {
    stalled.push(`${g.name}: ${error.message.slice(0, 300)}`);
    return { ...g, at, advances, sets: [], stalled: true };
  }
});
if (stalled.length) throw new Error(`No compatible masters (every glyph must change weight):\n${stalled.join('\n')}`);
const gid = new Map(outlined.map((g, i) => [g.name, 1 + i]));

// ── Kerning: groups and pairs, at each weight (exceptions, glyph against glyph or group, win over group pairs) ──
function kerningAt(face) {
  const K = face.kerning ?? { groups: {}, pairs: [] };
  const byKey = new Map();
  for (const g of outlined) {
    byKey.set(g.name, g.name);
    if (g.char) byKey.set(g.char, g.name);
  }
  const members = (key) => {
    if (key.startsWith('@') && !K.groups[key.slice(1)]) throw new Error(`kerning: no group ${key}`);
    return (key.startsWith('@') ? K.groups[key.slice(1)] : [key]).map((k) => byKey.get(k)).filter(Boolean);
  };
  // Each side's classes: the groups used on it, accented letters joining their base's group
  const sides = [0, 1].map((side) => {
    const used = [...new Set(K.pairs.map((p) => p[side]).filter((k) => k.startsWith('@')))];
    const classOf = new Map();
    used.forEach((key, i) => {
      for (const n of members(key)) {
        if (classOf.has(n)) throw new Error(`kerning: ${n} is in ${used[classOf.get(n)]} and ${key} on the same side`);
        classOf.set(n, i);
      }
    });
    for (const g of outlined) if (g.base && !classOf.has(g.name) && classOf.has(g.base)) classOf.set(g.name, classOf.get(g.base));
    return { used, classOf };
  });
  const matrix = new Map();
  const exceptions = new Map();
  const explicit = new Set();
  for (const [a, b, value] of K.pairs) {
    const v = Math.round(value * U);
    if (a.startsWith('@') && b.startsWith('@')) matrix.set(`${sides[0].used.indexOf(a)},${sides[1].used.indexOf(b)}`, v);
    else
      for (const x of members(a))
        for (const y of members(b)) {
          // A glyph against a glyph wins over a glyph against a group
          const key = `${x},${y}`;
          const exact = !a.startsWith('@') && !b.startsWith('@');
          if (explicit.has(key) && !exact) continue;
          if (exact) explicit.add(key);
          exceptions.set(key, v);
        }
  }
  return { sides, matrix, exceptions };
}
const kerns = STROKES.map((s) => kerningAt(source(s)));
const kern = kerns[REG];
for (const [k, other] of kerns.entries())
  if (other.matrix.size !== kern.matrix.size || other.exceptions.size !== kern.exceptions.size) throw new Error(`The kerning at ${STROKES[k]} has other pairs than at ${STROKES[REG]}`);
/** The kerning between two glyphs at master k, in font units. */
const kernBetween = (a, b, k) => {
  const K = kerns[k];
  if (K.exceptions.has(`${a},${b}`)) return K.exceptions.get(`${a},${b}`);
  const [i, j] = [K.sides[0].classOf.get(a), K.sides[1].classOf.get(b)];
  return i === undefined || j === undefined ? 0 : (K.matrix.get(`${i},${j}`) ?? 0);
};
/** The kerning for sfnt.mjs at master k, or the variable font's (Regular's values, with the others as deltas). */
function kerningFor(k) {
  const valueAt = (get) => {
    const values = STROKES.map((_, q) => get(kerns[q]) ?? 0);
    const value = k === null ? values[REG] : values[k];
    return { value, deltas: k === null ? [values[0] - values[REG], values[2] - values[REG]] : null };
  };
  const pairs = [...kern.exceptions.keys()].map((key) => {
    const [a, b] = key.split(',');
    return { first: gid.get(a), second: gid.get(b), ...valueAt((K) => K.exceptions.get(key)) };
  });
  // Classes with their members, the empty ones (a subset can leave a group without glyphs) dropped
  const classesOf = (side) => kern.sides[side].used.map((_, i) => outlined.filter((g) => kern.sides[side].classOf.get(g.name) === i).map((g) => gid.get(g.name)));
  const [first, second] = [classesOf(0), classesOf(1)];
  const keep = [first, second].map((list) => list.map((c, i) => (c.length ? i : -1)).filter((i) => i >= 0));
  const values = [...kern.matrix.keys()]
    .map((key) => {
      const [i, j] = key.split(',').map(Number);
      return { first: keep[0].indexOf(i), second: keep[1].indexOf(j), ...valueAt((K) => K.matrix.get(key)) };
    })
    .filter((v) => v.first >= 0 && v.second >= 0 && (v.value || v.deltas?.some(Boolean)));
  return { pairs, classes: { first: keep[0].map((i) => first[i]), second: keep[1].map((i) => second[i]), values } };
}

// ── Features: each alternate replaces its base through its tag ──
const substitutions = [];
for (const g of outlined) {
  const alt = alternateOf(g);
  if (!alt || !gid.has(alt.base)) continue;
  let feature = substitutions.find((s) => s.tag === alt.tag);
  if (!feature) substitutions.push((feature = { tag: alt.tag, map: new Map() }));
  feature.map.set(gid.get(alt.base), gid.get(g.name));
}

// ── Fonts ──
const OUT = out ?? join(dir, 'fonts');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const file = T.family.replace(/\s+/g, '');
const m = T.metrics;
const metrics = Object.fromEntries(Object.entries({ ascender: m.ascender, descender: m.descender, lineGap: m.lineGap, xHeight: m.xHeight, capHeight: m.capHeight, winAscent: m.winAscent, winDescent: m.winDescent }).map(([k, v]) => [k, Math.round(v * U)]));
const license = readFileSync(join(dir, 'LICENSE'), 'utf8');
const meta = { copyright: T.copyright, trademark: T.trademark, manufacturer: T.manufacturer, designer: T.designer, url: T.url, license: T.licenseShort ?? license.trim(), licenseUrl: T.licenseUrl };
const notdef = { name: '.notdef', advance: Math.round(8 * U), contours: [] };
const cmap = new Map(outlined.filter((g) => g.char).map((g) => [g.char.codePointAt(0), gid.get(g.name)]));
// OS/2's Unicode ranges: the blocks the characters come from
const BLOCKS = [
  [0, 0x0000, 0x007f],
  [1, 0x0080, 0x00ff],
  [2, 0x0100, 0x017f],
  [3, 0x0180, 0x024f],
  [5, 0x02b0, 0x02ff],
  [31, 0x2000, 0x206f],
  [32, 0x2070, 0x209f],
  [33, 0x20a0, 0x20cf],
  [35, 0x2100, 0x214f],
  [36, 0x2150, 0x218f],
  [37, 0x2190, 0x21ff],
  [38, 0x2200, 0x22ff],
];
const ranges = [0, 0, 0, 0];
for (const code of cmap.keys()) for (const [bit, a, b] of BLOCKS) if (code >= a && code <= b) ranges[bit >> 5] |= 1 << (bit & 31);
const common = { family: T.family, unitsPerEm: UPM, version: T.version, cmap, names: meta, metrics, ranges, fsType: 0x0002, substitutions };
const write = (name, sfnt) => {
  writeFileSync(join(OUT, `${name}.ttf`), sfnt);
  writeFileSync(join(OUT, `${name}.woff2`), woff2(sfnt));
};
const axis = { tag: 'wght', min: 300, default: 400, max: 700, regions: [-1, 1], instances: ['Light', 'Regular', 'Medium', 'SemiBold', 'Bold'].map((name, i) => ({ name, value: 300 + 100 * i })) };
const variable = outlined.map((g) => ({
  name: g.name,
  advance: g.advances[REG],
  contours: g.sets[REG],
  overlap: g.overlap,
  deltas: g.sets[REG].length ? [0, 2].map((k) => g.sets[k].flatMap((c, ci) => c.map((p, pi) => [p.x - g.sets[REG][ci][pi].x, p.y - g.sets[REG][ci][pi].y]))) : null,
  advanceDeltas: [0, 2].map((k) => g.advances[k] - g.advances[REG]),
}));
write(`${file}[wght]`, font({ ...common, glyphs: [notdef, ...variable], axis, kerning: kerningFor(null) }));
['Light', 'Regular', 'Bold'].forEach((style, k) =>
  write(`${file}-${style}`, font({ ...common, style, weightClass: WEIGHTS[k], kerning: kerningFor(k), glyphs: [notdef, ...outlined.map((g) => ({ name: g.name, advance: g.advances[k], contours: g.sets[k], overlap: g.overlap }))] })),
);
const css = `/* ${T.family}: ${T.copyright} Not licensed: ${T.licenseUrl} */
@font-face { font-family: '${T.family}'; src: url('${file}[wght].woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: swap; }
`;
if (!subset) writeFileSync(join(OUT, `${T.family.toLowerCase().replace(/\s+/g, '-')}.css`), css);

// ── Words as outlines (for logos): each glyph's outline at that weight, set with its advance and kerning ──
if (!subset) {
  rmSync(join(dir, 'words'), { recursive: true, force: true });
  if (T.words?.length) {
    mkdirSync(join(dir, 'words'), { recursive: true });
    const byChar = new Map(outlined.filter((g) => g.char).map((g) => [g.char, g]));
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
        let prev = null;
        for (const ch of word) {
          const gl = byChar.get(ch);
          if (!gl) throw new Error(`${word}: no glyph ${ch}`);
          if (prev) x += kernBetween(prev.name, gl.name, k);
          const d = svgPath(gl.sets[k], x);
          const n = d.match(/-?\d+(\.\d+)?/g).map(Number);
          const lx = n.filter((_, i) => i % 2 === 0);
          const ly = n.filter((_, i) => i % 2 === 1);
          parts.push(d);
          letters.push({ ch, x: r3(x / U), d, box: [Math.min(...lx), Math.min(...ly), Math.max(...lx), Math.max(...ly)] });
          x += gl.advances[k];
          prev = gl;
        }
        writeFileSync(join(dir, 'words', `${word.toLowerCase()}-${weight}.json`), `${JSON.stringify({ word, weight, advance: r3(x / U), letters })}\n`);
        const ink = parts.join('').match(/-?\d+(\.\d+)?/g).map(Number);
        const xs = ink.filter((_, i) => i % 2 === 0);
        const ys = ink.filter((_, i) => i % 2 === 1);
        const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map((v) => Math.round(v * 1000) / 1000);
        // The ink's box, the baseline at y = 0 (units of the canvas: x-height 10)
        writeFileSync(join(dir, 'words', `${word.toLowerCase()}-${weight}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}" fill="currentColor"><path fill-rule="nonzero" d="${parts.join('')}"/></svg>\n`);
      });
  }
}

// ── Specimen and proof: set in the fonts just written, by Chrome ──
const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const page = (body) => `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Specimen'; src: url('fonts/${file}[wght].woff2') format('woff2'); font-weight: 300 700; }
body{margin:0;padding:64px 72px;width:1800px;background:#161617;color:#f5f5f7;font-family:'Specimen'}
p{margin:0 0 18px;line-height:1.15;word-break:break-all}.l{display:flex;gap:56px;align-items:baseline}.k{font:13px "Helvetica Neue";color:#86868b;margin:42px 0 12px}
.row{display:grid;grid-template-columns:90px 1fr;align-items:baseline;gap:24px}.row>span{font:13px "Helvetica Neue";color:#86868b}
.row p{word-break:normal}.size p{white-space:nowrap;overflow:hidden}
.off{font-kerning:none}.case{font-feature-settings:'case'}.tnum{font-feature-settings:'tnum'}
</style>${body}`;
const sample = (text, weight, size, cls = '') => `<p class="${cls}" style="font-weight:${weight};font-size:${size}px">${esc(text)}</p>`;
const chars = outlined.filter((g) => g.char).map((g) => g.char).join('');
const S = T.samples ?? { display: ['Hamburgefonstiv'], line: 'The quick brown fox jumps over the lazy dog.', text: 'Typefaces drawn with the engine: the same strokes, round ends and weights as the icons.' };
const specimenHtml = page(`<div class="l">${S.display.map((w) => sample(w, 400, 200)).join('')}</div>
<div class="k">Light 300 · Regular 400 · 550 · Bold 700</div>
${[300, 400, 550, 700].map((w) => sample(S.line, w, 56)).join('')}
<div class="k">Every glyph, Regular</div>${sample(chars, 400, 54)}
<div class="k">Text</div>${sample(S.text, 400, 30)}`);
// The proof: what a type designer checks at every weight
const controls = (letters, a, b) => [...letters].map((ch) => `${a}${a}${ch}${a}${b}${ch}${b}${b}`).join(' ');
const lower = [...'abcdefghijklmnopqrstuvwxyz'].filter((ch) => cmap.has(ch.codePointAt(0))).join('');
const upper = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].filter((ch) => cmap.has(ch.codePointAt(0))).join('');
const pairs = T.proof?.pairs ?? [];
const row = (label, html) => `<div class="row"><span>${label}</span>${html}</div>`;
const proofHtml = page(`${[300, 400, 700]
  .map(
    (w) => `<div class="k">${w}: spacing</div>
${row('n o', sample(controls(lower, 'n', 'o'), w, 40))}
${row('H O', sample(controls(upper, 'H', 'O'), w, 40))}
${row('figures', sample(controls('0123456789', '0', '1'), w, 40))}
${pairs.length ? `<div class="k">${w}: kerning, off and on</div>${row('off', sample(pairs.join(' '), w, 48, 'off'))}${row('on', sample(pairs.join(' '), w, 48))}` : ''}`,
  )
  .join('')}
${substitutions.length ? `<div class="k">Features, off and on</div>${substitutions.map((s) => row(s.tag, `<div>${sample(T.proof?.features?.[s.tag] ?? '', 400, 48)}${sample(T.proof?.features?.[s.tag] ?? '', 400, 48, s.tag)}</div>`)).join('')}` : ''}
<div class="k">Sizes</div><div class="size">${[120, 72, 48, 32, 24, 18, 14, 12].map((px) => row(`${px} px`, sample(S.line, 400, px))).join('')}</div>`);
if (specimen) {
  const browser = await openChrome();
  try {
    await browser.send('Page.enable');
    for (const [name, html] of [
      ['specimen', specimenHtml],
      ['proof', proofHtml],
    ]) {
      writeFileSync(join(dir, `_${name}.html`), html);
      writeFileSync(join(dir, `${name}.png`), await browser.shoot(join(dir, `_${name}.html`), 1944));
      await sleep(100);
      rmSync(join(dir, `_${name}.html`), { force: true });
    }
  } finally {
    await browser.close();
  }
}
const composedCount = outlined.filter((g) => g.base).length;
console.log(
  `✓ ${T.family}: ${outlined.length} glyphs (${outlined.length - composedCount} drawn, ${composedCount} composed${substitutions.length ? `; ${substitutions.map((s) => `${s.tag} ${s.map.size}`).join(', ')}` : ''}; kerning ${kern.exceptions.size} pairs and ${kern.matrix.size} class pairs); variable and Light, Regular, Bold, TTF and WOFF2, in ${((performance.now() - start) / 1000).toFixed(0)} s → ${OUT}/${specimen ? ' and specimen.png, proof.png' : ''}`,
);
