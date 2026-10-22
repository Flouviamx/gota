// Native formats, from outlines checked against their drawing (scripts/outline.mjs): formats that
// can't hold strokes or masks get each icon as filled shapes. Run after scripts/build.mjs.
//   node scripts/native.mjs android   → dist/android/<weight>/<outline|fill>/gota_<name>[_circle|_square|_slash].xml
// Android vector drawables: one path, nonzero, tinted by the theme (?attr/colorControlNormal), and
// mirrored for right-to-left layouts where the icon is directional (autoMirrored).
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { WEIGHTS } from '../engine/variants.mjs';
import { loadAll } from './load.mjs';
import { outline } from './outline.mjs';

const targets = process.argv.slice(2);
if (!targets.length) throw new Error('Which format? node scripts/native.mjs android');
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
