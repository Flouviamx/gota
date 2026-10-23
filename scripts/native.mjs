// Native formats, from outlines checked against their drawing (scripts/outline.mjs): formats that
// can't hold strokes or masks get each icon as filled shapes. Run after scripts/build.mjs.
//   node scripts/native.mjs android   → dist/android/<weight>/<outline|fill>/gota_<name>[_circle|_square|_slash].xml
//   node scripts/native.mjs xcode     → dist/xcode/Gota.xcassets/<name>[.fill].symbolset (macOS, with Xcode)
// Android vector drawables: one path, nonzero, tinted by the theme (?attr/colorControlNormal), and
// mirrored for right-to-left layouts where the icon is directional (autoMirrored).
// Xcode custom symbols: a variable template per icon and style (its three masters as Ultralight,
// Regular and Black; Xcode draws every other weight and scale between them), compiled by actool and
// drawn by AppKit at every master to check it.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transform, WEIGHTS } from '../engine/variants.mjs';
import { loadAll } from './load.mjs';
import { masters } from './masters.mjs';
import { outline } from './outline.mjs';

const targets = process.argv.slice(2);
if (!targets.length) throw new Error('Which format? node scripts/native.mjs android | xcode');
const { categories } = await loadAll();
const icons = Object.assign({}, ...categories.map((c) => c.icons));
const NAMES = new Set(Object.keys(icons));

// The same matrix as dist/svg: the hand-drawn variant wins, and an icon can turn a variant off
const FORMS = [
  ['', {}],
  ['-circle', { enclosure: 'circle' }],
  ['-square', { enclosure: 'square' }],
  ['-slash', { slash: true }],
];
const drawn = (name, { enclosure, slash }) => (enclosure ? NAMES.has(`${name}-${enclosure}`) : slash && (NAMES.has(`${name}-slash`) || NAMES.has(`${name}-off`)));
function* matrix() {
  for (const [name, icon] of Object.entries(icons))
    for (const [w, weight] of Object.entries(WEIGHTS))
      for (const style of ['outline', 'fill'])
        for (const [suffix, opts] of FORMS) {
          const off = (opts.enclosure && icon.variants?.[opts.enclosure] === false) || (opts.slash && icon.variants?.slash === false);
          if (off || (suffix && drawn(name, opts))) continue;
          yield { name, icon, w, style, suffix, options: { ...opts, style, weight } };
        }
}

if (targets.includes('android')) {
  rmSync('dist/android', { recursive: true, force: true });
  for (const w of Object.keys(WEIGHTS)) for (const st of ['outline', 'fill']) mkdirSync(`dist/android/${w}/${st}`, { recursive: true });
  // Android resource names: lowercase letters, digits and underscores
  const resource = (name) => `gota_${name.replace(/-/g, '_')}`;
  let files = 0;
  const start = performance.now();
  for (const { name, icon, w, style, suffix, options } of matrix()) {
    const d = outline({ name, ...icon }, options);
    writeFileSync(
      `dist/android/${w}/${style}/${resource(name + suffix)}.xml`,
      `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24" android:tint="?attr/colorControlNormal"${icon.mirror ? ' android:autoMirrored="true"' : ''}>\n  <path android:fillColor="@android:color/white" android:pathData="${d}"/>\n</vector>\n`,
    );
    files++;
  }
  console.log(`✓ android: ${files} vector drawables, every outline checked, in ${((performance.now() - start) / 1000).toFixed(0)} s → dist/android/`);
}

if (targets.includes('xcode')) {
  const OUT = 'dist/xcode/Gota.xcassets';
  rmSync('dist/xcode', { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const start = performance.now();
  // The 24 canvas typeset at 100 pt: 24 → 100, centered on the cap height (70.459 at Small), the
  // margins at its edges, so every symbol is as wide as the icon's canvas
  const K = 100 / 24;
  const CAP = 70.459;
  const r = (v) => Math.round(v * 1000) / 1000;
  const X = (x) => r(x * K);
  const Y = (y) => r((y - 12) * K - CAP / 2);
  /** Absolute path data in template space, quadratics as the cubics they are. */
  const toTemplate = (d) => {
    let out = '';
    let [x, y] = [0, 0];
    for (const [, c, a] of transform(d, 1, 0, 0).matchAll(/([MLHVQCZ])([^MLHVQCZ]*)/g)) {
      const n = (a.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []).map(Number);
      if (c === 'M' || c === 'L') [x, y] = n;
      else if (c === 'H') x = n[0];
      else if (c === 'V') y = n[0];
      if (c === 'M') out += `M${X(x)} ${Y(y)}`;
      else if (c === 'L' || c === 'H' || c === 'V') out += `L${X(x)} ${Y(y)}`;
      else if (c === 'Q') {
        const [qx, qy, ex, ey] = n;
        out += `C${X(x + (2 / 3) * (qx - x))} ${Y(y + (2 / 3) * (qy - y))} ${X(ex + (2 / 3) * (qx - ex))} ${Y(ey + (2 / 3) * (qy - ey))} ${X(ex)} ${Y(ey)}`;
        [x, y] = [ex, ey];
      } else if (c === 'C') {
        out += `C${X(n[0])} ${Y(n[1])} ${X(n[2])} ${Y(n[3])} ${X(n[4])} ${Y(n[5])}`;
        [x, y] = [n[4], n[5]];
      } else if (c === 'Z') out += 'Z';
    }
    return out;
  };
  const SLOTS = [
    ['Ultralight-S', 559.711],
    ['Regular-S', 1449.71],
    ['Black-S', 2339.71],
  ];
  const line = (id, x1, x2, y1, y2, color = '#27AAE1') => `  <line id="${id}" style="fill:none;stroke:${color};opacity:1;stroke-width:0.5;" x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}"/>`;
  const template = (name, ds) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="3300" height="2200">
 <!--Gota: ${name}-->
 <g id="Notes">
  <rect height="2200" id="artboard" style="fill:white;opacity:1" width="3300" x="0" y="0"/>
  <text style="stroke:none;fill:black;font-family:sans-serif;font-size:13;" transform="matrix(1 0 0 1 263 1953)">Gota · ${name} · MIT · gota.flouvia.com</text>
  <text id="template-version" style="stroke:none;fill:black;font-family:sans-serif;font-size:13;" transform="matrix(1 0 0 1 2952 1933)">Template v.4.0</text>
 </g>
 <g id="Guides">
${[
  ['S', 696, 625.541],
  ['M', 1126, 1055.54],
  ['L', 1556, 1485.54],
]
  .flatMap(([s, b, c]) => [line(`Baseline-${s}`, 263, 3036, b, b), line(`Capline-${s}`, 263, 3036, c, c)])
  .join('\n')}
${SLOTS.flatMap(([id, x]) => [line(`left-margin-${id}`, x, x, 600.785, 720.121, '#00AEEF'), line(`right-margin-${id}`, r(x + 100), r(x + 100), 600.785, 720.121, '#00AEEF')]).join('\n')}
 </g>
 <g id="Symbols">
${SLOTS.map(([id, x], k) => `  <g id="${id}" transform="matrix(1 0 0 1 ${x} 696)">\n   <path d="${toTemplate(ds[k])}"/>\n  </g>`).join('\n')}
 </g>
</svg>
`;
  const fixed = [];
  const symbols = [];
  for (const [name, icon] of Object.entries(icons))
    for (const style of icon.fill ? ['outline', 'fill'] : ['outline']) {
      const symbol = style === 'fill' ? `${name}.fill` : name;
      let ds;
      try {
        ds = masters({ name, ...icon }, { style }).ds;
      } catch {
        // No compatible masters: the regular drawing at every weight
        fixed.push(symbol);
        const d = outline({ name, ...icon }, { style, weight: 1.5 });
        ds = [d, d, d];
      }
      const dir = join(OUT, `${symbol}.symbolset`);
      mkdirSync(dir);
      writeFileSync(join(dir, `${symbol}.svg`), template(symbol, ds));
      writeFileSync(join(dir, 'Contents.json'), `${JSON.stringify({ info: { author: 'xcode', version: 1 }, symbols: [{ filename: `${symbol}.svg`, idiom: 'universal' }] }, null, 2)}\n`);
      symbols.push({ symbol, vary: !fixed.includes(symbol) });
    }
  writeFileSync(join(OUT, 'Contents.json'), `${JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)}\n`);
  // ── Check: actool compiles every template, and AppKit draws every symbol at its three masters ──
  const tmp = mkdtempSync(join(tmpdir(), 'gota-xcode-'));
  const bundle = join(tmp, 'Gota.bundle');
  mkdirSync(join(bundle, 'Contents', 'Resources'), { recursive: true });
  const log = execFileSync('xcrun', ['actool', OUT, '--compile', join(bundle, 'Contents', 'Resources'), '--platform', 'macosx', '--minimum-deployment-target', '13.0', '--output-format', 'human-readable-text', '--notices', '--warnings', '--errors', '--output-partial-info-plist', join(tmp, 'info.plist')], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const problems = log.split('\n').filter((l) => /error|warning|notice/i.test(l));
  writeFileSync(join(bundle, 'Contents', 'Info.plist'), '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.flouvia.gota.check</string><key>CFBundlePackageType</key><string>BNDL</string></dict></plist>\n');
  writeFileSync(join(tmp, 'symbols.txt'), symbols.map((s) => `${s.symbol} ${s.vary ? 1 : 0}`).join('\n'));
  writeFileSync(
    join(tmp, 'check.swift'),
    `import AppKit
// Every symbol loads and has ink, and (if it varies) its drawing changes from Ultralight to Black (a
// fill may hold as much ink at Black: its edge cuts widen with it)
let bundle = Bundle(path: CommandLine.arguments[1])!
let list = try! String(contentsOfFile: CommandLine.arguments[2], encoding: .utf8).split(separator: "\\n")
func alpha(_ name: String, _ w: NSFont.Weight) -> [Double]? {
  guard let base = NSImage(symbolName: name, bundle: bundle, variableValue: 0),
        let img = base.withSymbolConfiguration(NSImage.SymbolConfiguration(pointSize: 48, weight: w, scale: .medium)) else { return nil }
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 96, pixelsHigh: 96, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  img.draw(in: NSRect(x: 8, y: 8, width: img.size.width, height: img.size.height))
  NSGraphicsContext.restoreGraphicsState()
  var out = [Double]()
  for y in 0..<96 { for x in 0..<96 { out.append(Double(rep.colorAt(x: x, y: y)?.alphaComponent ?? 0)) } }
  return out
}
for line in list {
  let parts = line.split(separator: " ")
  let name = String(parts[0])
  guard let light = alpha(name, .ultraLight), let regular = alpha(name, .regular), let black = alpha(name, .black) else { print("\\(name): doesn't load"); continue }
  if regular.reduce(0, +) < 1 { print("\\(name): no ink") }
  let changed = zip(light, black).filter { abs($0 - $1) > 0.38 }.count
  if parts[1] == "1" && changed < 30 { print("\\(name): its weight doesn't change (\\(changed) pixels)") }
}
`,
  );
  execFileSync('swiftc', ['-O', join(tmp, 'check.swift'), '-o', join(tmp, 'check')]);
  problems.push(...execFileSync(join(tmp, 'check'), [bundle, join(tmp, 'symbols.txt')], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean));
  const car = readFileSync(join(bundle, 'Contents', 'Resources', 'Assets.car')).length;
  rmSync(tmp, { recursive: true, force: true });
  if (problems.length) {
    console.log(`✗ xcode: ${problems.length} problems:\n  ${problems.slice(0, 40).join('\n  ')}`);
    process.exitCode = 1;
  } else
    console.log(`✓ xcode: ${symbols.length} symbols (${symbols.length - fixed.length} varying with the weight${fixed.length ? `; regular at every weight: ${fixed.join(', ')}` : ''}), compiled by actool with no warning (Assets.car ${(car / 1048576).toFixed(1)} MB) and drawn by AppKit at Ultralight, Regular and Black, in ${((performance.now() - start) / 1000).toFixed(0)} s → ${OUT}/`);
}
