// Gota's icon fonts, from outlines checked against their drawing (scripts/outline.mjs) and compatible
// masters (scripts/masters.mjs), written by scripts/sfnt.mjs. Run after scripts/build.mjs.
//   dist/fonts/gota.ttf · .woff2, gota-fill.ttf · .woff2   variable: a weight axis from 300 to 700, the
//     stroke from 0.9 to 2.1 as weight="auto" maps a text's weight (400 is regular)
//   dist/fonts/gota-{light,regular,bold}[-fill].ttf · .woff2   static, at the masters (300 · 400 · 700)
//   dist/fonts/gota.css (the @font-face rules and the .gota and .gota-fill classes) · codepoints.json
// Every icon has a stable codepoint in the Supplementary Private Use Area-A (src/codepoints.json:
// a new icon gets the next one, and a codepoint is never given to another icon) and a ligature: its
// name typed as text becomes the icon (<i class="gota">bell</i>). An icon without compatible masters
// keeps its regular drawing at every weight of the variable font (reported). Every glyph is then
// read back and compared with the drawing at 300, 350, 400, 550 and 700.
// Usage: node scripts/font.mjs   (needs npm ci: Skia)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { autoWeight } from '../dist/core.js';
import { render } from '../engine/variants.mjs';
import { openChrome } from './chrome.mjs';
import { clockwise, parse, sameShape } from './contours.mjs';
import { loadAll } from './load.mjs';
import { masters } from './masters.mjs';
import { matches, outline } from './outline.mjs';
import { font, readGlyphs, woff2 } from './sfnt.mjs';

const UPM = 4800; // 200 units per canvas unit: points within 0.0025, so rounding never tips an interpolated weight
const FIRST = 0xf0000;
const REGISTRY = 'src/codepoints.json';
const OUT = 'dist/fonts';
const STROKES = [0.9, 1.5, 2.1];
const FONT_WEIGHTS = [300, 400, 700];
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version.split('.').slice(0, 2).join('.').replace(/^(\d+)\.(\d)$/, '$1.$200');
const start = performance.now();

const { categories, errors } = await loadAll();
if (errors.length) throw new Error(`Fix the icons first:\n${errors.join('\n')}`);
const icons = Object.fromEntries(categories.flatMap((c) => Object.entries(c.icons)));

// ── Codepoints: stable ──
const registry = existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')) : {};
let next = Math.max(FIRST - 1, ...Object.values(registry).map((h) => Number.parseInt(h, 16))) + 1;
const added = [];
for (const name of Object.keys(icons).sort())
  if (!registry[name]) {
    registry[name] = next.toString(16);
    added.push(name);
    next++;
  }
const sorted = Object.entries(registry).sort((a, b) => Number.parseInt(a[1], 16) - Number.parseInt(b[1], 16));
writeFileSync(REGISTRY, `${JSON.stringify(Object.fromEntries(sorted), null, 1)}\n`);
const names = sorted.map(([n]) => n).filter((n) => icons[n]);
const code = (n) => Number.parseInt(registry[n], 16);

const U = UPM / 24;
const toFont = (contours) => contours.map((c) => c.map((p) => ({ x: Math.round(p.x * U), y: Math.round((24 - p.y) * U), on: p.on })));

// ── Glyphs per style ──
const chars = [...new Set(names.join(''))].sort();
const glyphsOf = (style) => {
  const fixed = [];
  const loose = [];
  const list = names.map((name) => {
    const icon = { name, ...icons[name] };
    const opts = { style: icon.fill || style === 'outline' ? style : 'outline' };
    try {
      const m = masters(icon, opts, STROKES);
      const sets = clockwise(m.ds.map((d) => toFont(parse(d))));
      if (!sets.every((s) => sameShape(s, sets[1]))) throw new Error('masters differ in shape');
      const overlap = m.mode.startsWith('overlap');
      return { name, sets, overlap };
    } catch {
      fixed.push(name);
      const sets = clockwise(
        STROKES.map((weight) => {
          try {
            return toFont(parse(outline(icon, { ...opts, weight })));
          } catch {
            loose.push(`${name}@${weight}`);
            return toFont(parse(outline(icon, { ...opts, weight }, { strict: false })));
          }
        }),
      );
      return { name, sets, overlap: true, fixed: true };
    }
  });
  return { list, fixed, loose };
};

const notdef = { name: '.notdef', advance: UPM, contours: [] };
const charGlyphs = chars.map((c) => ({ name: c, advance: 0, contours: [] }));
const cmap = new Map(chars.map((c, i) => [c.charCodeAt(0), 1 + i]));
names.forEach((n, i) => cmap.set(code(n), 1 + chars.length + i));
const ligatures = names.map((n, i) => ({ components: [...n].map((c) => 1 + chars.indexOf(c)), glyph: 1 + chars.length + i }));
const meta = { copyright: `© ${new Date().getFullYear()} Flouvia`, url: 'https://gota.flouvia.com', license: 'MIT License', licenseUrl: 'https://opensource.org/licenses/MIT' };
const axis = {
  tag: 'wght',
  min: 300,
  default: 400,
  max: 700,
  regions: [-1, 1],
  // Gota's named weights where CSS has them, its masters (Light 300 is 0.9, Bold 700 is 2.1)
  instances: [
    { name: 'Light', value: 300 },
    { name: 'Regular', value: 400 },
    { name: 'Medium', value: 500 },
    { name: 'SemiBold', value: 600 },
    { name: 'Bold', value: 700 },
  ],
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const report = [];
const files = {};
for (const [style, family, file] of [
  ['outline', 'Gota', 'gota'],
  ['fill', 'Gota Fill', 'gota-fill'],
]) {
  const { list, fixed, loose } = glyphsOf(style);
  const iconGlyph = (g, k, deltas) => ({ name: g.name, advance: UPM, contours: g.sets[k], overlap: g.overlap, deltas });
  // Variable: the regular master, and deltas to the light and bold ones
  const variable = list.map((g) =>
    iconGlyph(
      g,
      1,
      g.fixed
        ? null
        : [0, 2].map((k) => g.sets[k].flatMap((c, ci) => c.map((p, pi) => [p.x - g.sets[1][ci][pi].x, p.y - g.sets[1][ci][pi].y]))),
    ),
  );
  const write = (name, sfnt) => {
    writeFileSync(join(OUT, `${name}.ttf`), sfnt);
    writeFileSync(join(OUT, `${name}.woff2`), woff2(sfnt));
    files[name] = sfnt;
  };
  write(file, font({ family, unitsPerEm: UPM, version, glyphs: [notdef, ...charGlyphs, ...variable], cmap, ligatures, axis, names: meta }));
  // Static: each master as it is (the icons without compatible masters, at that weight's own outline)
  ['Light', 'Regular', 'Bold'].forEach((weightName, k) => {
    const glyphs = list.map((g) => iconGlyph(g, k));
    write(`${file}-${weightName.toLowerCase()}`, font({ family, style: weightName === 'Regular' ? 'Regular' : weightName, weightClass: FONT_WEIGHTS[k], unitsPerEm: UPM, version, glyphs: [notdef, ...charGlyphs, ...glyphs], cmap, ligatures, names: meta }));
  });
  report.push({ style, fixed, loose });
}

// ── CSS and codepoints ──
writeFileSync(
  join(OUT, 'gota.css'),
  `/* Gota icon fonts: <i class="gota">bell</i> (a ligature) or the icon's codepoint (codepoints.json).
   The weight follows font-weight, from 300 (light) to 700 (bold), as weight="auto" does. */
@font-face { font-family: 'Gota'; src: url('gota.woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: block; }
@font-face { font-family: 'Gota Fill'; src: url('gota-fill.woff2') format('woff2'); font-weight: 300 700; font-style: normal; font-display: block; }
.gota, .gota-fill { font-family: 'Gota'; font-style: normal; font-size: 24px; line-height: 1; letter-spacing: normal; text-transform: none; white-space: nowrap; word-wrap: normal; direction: ltr; display: inline-block; font-feature-settings: 'liga'; -webkit-font-smoothing: antialiased; }
.gota-fill { font-family: 'Gota Fill'; }
`,
);
writeFileSync(join(OUT, 'codepoints.json'), `${JSON.stringify(Object.fromEntries(names.map((n) => [n, registry[n]])), null, 1)}\n`);

// ── Check 1: what each file holds, read back, against the drawing ──
// The glyphs are decoded from the bytes written (not from what was meant to be written), the variable
// ones interpolated as a rasterizer does, and each compared with render() at that weight by Skia
// (the masters' own check). Chrome's text rasterizer can't be the judge: it snaps the baseline to the
// pixel and, on macOS, thickens text.
const r3 = (v) => Math.round(v * 1000) / 1000;
const toPath = (contours) =>
  contours
    .map((c) => {
      const at = (p) => `${r3(p.x / U)} ${r3(24 - p.y / U)}`;
      const k = c.findIndex((p) => p.on);
      const pts = [...c.slice(k), ...c.slice(0, k)];
      let d = `M${at(pts[0])}`;
      let off = null;
      for (let i = 1; i <= pts.length; i++) {
        const p = pts[i % pts.length];
        if (p.on) {
          d += off ? `Q${at(off)} ${at(p)}` : `L${at(p)}`;
          off = null;
        } else if (off) {
          // Between two off-curve points lies an on-curve one, halfway
          d += `Q${at(off)} ${at({ x: (off.x + p.x) / 2, y: (off.y + p.y) / 2 })}`;
          off = p;
        } else off = p;
      }
      return `${d}Z`;
    })
    .join('');
const failures = [];
const judge = (label, svg, d) => {
  const m = matches(svg, d);
  if (!m.ok) failures.push(`${label}: diff ${m.diff}, clump ${m.clump} at ${JSON.stringify(m.where)}`);
};
for (const { style, fixed } of report) {
  const file = style === 'fill' ? 'gota-fill' : 'gota';
  const variable = readGlyphs(files[file]);
  const statics = ['light', 'regular', 'bold'].map((w) => readGlyphs(files[`${file}-${w}`]));
  names.forEach((name, i) => {
    const gi = 1 + chars.length + i;
    const icon = { name, ...icons[name] };
    const opts = { style: icon.fill || style === 'outline' ? style : 'outline' };
    const svgAt = (stroke) => render(icon, { ...opts, weight: stroke, animate: null, id: 'c' });
    const g = variable[gi];
    for (const weight of fixed.includes(name) ? [400] : [300, 350, 400, 550, 700]) {
      const s = [weight < 400 ? (400 - weight) / (400 - axis.min) : 0, weight > 400 ? (weight - 400) / (axis.max - 400) : 0];
      let k = 0;
      const contours = g.contours.map((c) =>
        c.map((p) => {
          const [dx, dy] = (g.deltas ?? []).reduce((acc, set, r) => [acc[0] + s[r] * set[k][0], acc[1] + s[r] * set[k][1]], [0, 0]);
          k++;
          return { x: p.x + dx, y: p.y + dy, on: p.on };
        }),
      );
      judge(`${file} ${name} @${weight}`, svgAt(autoWeight(weight)), toPath(contours));
    }
    statics.forEach((glyphs, k) => judge(`${file}-${['light', 'regular', 'bold'][k]} ${name}`, svgAt(STROKES[k]), toPath(glyphs[gi].contours)));
  });
}

// ── Check 2: Chrome takes every font, every name is a ligature, the weight axis works ──
const browser = await openChrome();
const page = join(process.cwd(), OUT, `_check-${process.pid}.html`);
writeFileSync(
  page,
  `<!doctype html><meta charset="utf-8"><body><script>
const S = 96;
const ctx = (() => { const c = document.createElement('canvas'); c.width = S * 2; c.height = S; return c.getContext('2d', { willReadFrequently: true }); })();
window.add = async (family, b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  try { const f = new FontFace(family, bytes, { weight: '300 700' }); await f.load(); document.fonts.add(f); return 'ok'; } catch (e) { return String(e); }
};
const draw = (family, weight, text) => { ctx.clearRect(0, 0, S * 2, S); ctx.font = weight + ' ' + S + 'px "' + family + '"'; ctx.fillText(text, 0, S); const d = ctx.getImageData(0, 0, S, S).data; const a = new Uint8Array(S * S); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; return a; };
window.probe = (family, items) => items.flatMap((it) => {
  const out = [];
  ctx.font = '400 ' + S + 'px "' + family + '"';
  const lig = Math.round(ctx.measureText(it.name).width);
  if (lig !== S) out.push(it.name + ': its name is ' + lig + ' wide, not one em (no ligature)');
  const glyph = String.fromCodePoint(it.code);
  // A fill may hold as much ink at bold as at light (its edge cuts widen with it): what must change is the drawing
  const [light, bold] = [draw(family, 300, glyph), draw(family, 700, glyph)];
  let changed = 0;
  for (let i = 0; i < light.length; i++) changed += Math.abs(light[i] - bold[i]) > 96;
  if (!light.some((v) => v > 127)) out.push(it.name + ': no ink');
  if (it.vary && changed < 50) out.push(it.name + ': the weight axis does nothing (' + changed + ' pixels change)');
  return out;
});
</script>`,
);
await browser.send('Page.enable');
await browser.send('Page.navigate', { url: `file://${page}` });
await new Promise((r) => setTimeout(r, 800));
for (const name of Object.keys(files)) {
  const result = await browser.evaluate(`add('Check ${name}', '${woff2(files[name]).toString('base64')}')`);
  if (result !== 'ok') failures.push(`${name}.woff2: Chrome rejects it (${result})`);
}
for (const { style, fixed } of report) {
  const family = `Check ${style === 'fill' ? 'gota-fill' : 'gota'}`;
  const items = names.map((name) => ({ name, code: code(name), vary: !fixed.includes(name) }));
  for (let i = 0; i < items.length; i += 200) failures.push(...(await browser.evaluate(`probe(${JSON.stringify(family)}, ${JSON.stringify(items.slice(i, i + 200))})`)).map((f) => `${family}: ${f}`));
}
rmSync(page);
await browser.close();

const size = (n) => `${(readFileSync(join(OUT, n)).length / 1024).toFixed(0)} KB`;
for (const { style, fixed, loose } of report) {
  console.log(`${style}: ${names.length} icons, ${names.length - fixed.length} varying with the weight${fixed.length ? `; regular at every weight: ${fixed.join(', ')}` : ''}${loose.length ? `; outline not exact: ${loose.join(', ')}` : ''}`);
}
console.log(`files: gota.woff2 ${size('gota.woff2')}, gota-fill.woff2 ${size('gota-fill.woff2')}, gota-regular.woff2 ${size('gota-regular.woff2')}; codepoints ${added.length ? `+${added.length} new` : 'unchanged'}`);
if (failures.length) {
  console.log(`✗ ${failures.length} problems:`);
  for (const f of failures.slice(0, 40)) console.log(`  ${f}`);
  process.exitCode = 1;
} else console.log(`✓ every glyph, read back from the files, matches its drawing (variable at 300 · 350 · 400 · 550 · 700, static at its weight); Chrome takes every font; every name is a ligature (${((performance.now() - start) / 1000).toFixed(0)} s) → ${OUT}/`);
