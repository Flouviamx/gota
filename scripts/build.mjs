// Validates the set and generates svg/ (regular, outline and fill), the full variant matrix in
// dist/svg/, dist/icons.json, the package in dist/ (API, core, one module per icon, components,
// transitions, search, sprites, types) and dist/icons.css.
// Usage: node scripts/build.mjs            → validates everything and writes
//        node scripts/build.mjs --check X   → only validates category X (writes nothing)
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadAll, takes } from './load.mjs';

const only = process.argv.includes('--check') ? process.argv[process.argv.indexOf('--check') + 1] : undefined;
const { categories, errors, migrate } = await loadAll({ only });
if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
const count = categories.reduce((n, c) => n + (only && c.category !== only ? 0 : Object.keys(c.icons).length), 0);
if (only) {
  console.log(`✓ ${only}: ${count} valid icons`);
  process.exit(0);
}

// ── Outputs ──
// svg/<name>.svg and svg/fill/<name>.svg: regular weight, outline and fill, for quick viewing.
// dist/svg/<weight>/<outline|fill>/<name>[-circle|-square|-slash].svg: the full matrix (npm).
const { render, svgFile, WEIGHTS } = await import('../engine/variants.mjs');
const FORMS = [
  ['', {}],
  ['-circle', { enclosure: 'circle' }],
  ['-square', { enclosure: 'square' }],
  ['-slash', { slash: true }],
];
rmSync('svg', { recursive: true, force: true });
// dist/ is rewritten, except what other scripts write there and this build doesn't touch: the fonts
// (font.mjs) and the native formats (native.mjs: android, xcode, the Figma plugin) stay until their
// own script runs again
const KEEP = new Set(['fonts', 'android', 'xcode', 'figma']);
mkdirSync('dist', { recursive: true });
for (const entry of readdirSync('dist')) if (!KEEP.has(entry)) rmSync(`dist/${entry}`, { recursive: true, force: true });
mkdirSync('svg/fill', { recursive: true });
for (const w of Object.keys(WEIGHTS)) for (const st of ['outline', 'fill']) mkdirSync(`dist/svg/${w}/${st}`, { recursive: true });

// Design data of each icon that ships in the package, besides d
const DATA = ['fill', 'mark', 'badge', 'small', 'variants', 'mirror', 'levels', 'value', 'motion', 'parts'];
// Names across the whole set, to know whether a variant already exists as a hand-drawn icon
const NAMES = new Set(categories.flatMap((c) => Object.keys(c.icons)));
const drawn = (name, { enclosure, slash }) => (enclosure ? NAMES.has(`${name}-${enclosure}`) : slash && (NAMES.has(`${name}-slash`) || NAMES.has(`${name}-off`)));
const all = {};
let files = 0;
for (const cat of categories)
  for (const [name, icon] of Object.entries(cat.icons)) {
    // All of the icon's data ships in the package (fill: false too: "lines only" is data)
    all[name] = { category: cat.category, tags: icon.tags, d: icon.d, ...Object.fromEntries(DATA.filter((k) => icon[k] !== undefined).map((k) => [k, icon[k]])) };
    writeFileSync(`svg/${name}.svg`, svgFile(render(icon, { id: name }), icon));
    writeFileSync(`svg/fill/${name}.svg`, svgFile(render(icon, { style: 'fill', id: name }), icon));
    for (const [w, weight] of Object.entries(WEIGHTS))
      for (const st of ['outline', 'fill'])
        for (const [suffix, opts] of FORMS) {
          const off = (opts.enclosure && icon.variants?.[opts.enclosure] === false) || (opts.slash && icon.variants?.slash === false);
          // The hand-drawn version wins: the automatic one with the same name is not generated
          if (off || (suffix && drawn(name, opts))) continue;
          writeFileSync(`dist/svg/${w}/${st}/${name}${suffix}.svg`, svgFile(render(icon, { ...opts, style: st, weight, id: `${name}${suffix}` }), icon));
          files++;
        }
  }
const names = Object.keys(all).sort();
const data = Object.fromEntries(names.map((n) => [n, all[n]]));
const cats = categories.map((c) => ({ id: c.category, label: c.label, icons: Object.keys(c.icons) }));
writeFileSync('dist/icons.json', `${JSON.stringify(data)}\n`);

// The package: the data (data.js, generated), the engine and the API (sources copied from engine/)
copyFileSync('engine/geometry.mjs', 'dist/geometry.js');
writeFileSync('dist/variants.js', readFileSync('engine/variants.mjs', 'utf8').replace("'./geometry.mjs'", "'./geometry.js'"));
copyFileSync('engine/core.mjs', 'dist/core.js');
copyFileSync('engine/index.mjs', 'dist/index.js');
copyFileSync('engine/react-base.mjs', 'dist/react-base.js');
copyFileSync('engine/react.mjs', 'dist/react.js');
copyFileSync('engine/vue-base.mjs', 'dist/vue-base.js');
copyFileSync('engine/vue.mjs', 'dist/vue.js');
copyFileSync('engine/IconBase.svelte', 'dist/IconBase.svelte');
copyFileSync('engine/Icon.svelte', 'dist/Icon.svelte');
copyFileSync('engine/Icon.astro', 'dist/Icon.astro');
writeFileSync('dist/morph.js', readFileSync('engine/morph.mjs', 'utf8').replace("'./variants.mjs'", "'./variants.js'"));
writeFileSync(
  'dist/morph.d.ts',
  `import type { IconData, IconName, IconVariant, render } from './index';
type RenderOptions = Parameters<typeof render>[1];
export type Transition = { morph: true; pairs?: [number, number][]; origin?: 'start' | 'middle' } | { rotate: number } | { replace: true } | { liquid: 'rise' | 'drain' };
export type Change = { way: Transition; frame: ((t: number) => string) | null };
export declare const PAIRS: Record<string, { morph?: true; pairs?: [number, number][]; origin?: 'start' | 'middle'; rotate?: number }>;
export declare function toCubics(d: string): { closed: boolean; segs: number[][] }[];
export declare function morpher(from: IconData, to: IconData, options?: { pairs?: [number, number][]; origin?: 'start' | 'middle' }): (t: number) => string[];
export declare function frames(from: IconData, to: IconData, way?: Transition, options?: RenderOptions): (t: number) => string;
export declare function transitionOf(from: IconName, to: IconName, icons?: Record<string, IconData>, options?: { variant?: IconVariant }): Transition;
export declare function liquid(icon: IconData, rise: boolean, options?: RenderOptions): (t: number) => string;
export declare function changeOf(icons: Record<string, IconData>, before: { name: IconName; slash?: boolean; style?: IconVariant }, after: { name: IconName; slash?: boolean; style?: IconVariant }, options?: RenderOptions, transition?: 'auto' | 'morph' | 'replace'): Change | null;
export declare function playTransition(svg: SVGSVGElement, change: Change, duration?: number): void;
`,
);
writeFileSync(
  'dist/search.d.ts',
  `import type { IconName } from './index';
export interface SearchResult { name: IconName; category: string; label: Record<string, string>; score: number }
export interface SearchOptions { limit?: number; category?: string }
export declare function fold(text: string): string;
export declare function buildIndex(icons: Record<string, { category: string; tags?: string[] }>, i18n?: Record<string, { label?: Record<string, string>; keywords?: { es?: string[]; en?: string[] } }>): unknown[];
export declare function search(index: unknown[], query: string, options?: SearchOptions): SearchResult[];
export declare function searchIcons(query: string, options?: SearchOptions): SearchResult[];
`,
);
copyFileSync('engine/search.mjs', 'dist/search-core.js');
copyFileSync('engine/search-api.mjs', 'dist/search.js');
// Search data: names, categories and tags plus the i18n labels and keywords of every icon
const i18n = Object.assign({}, ...categories.map((c) => c.i18n ?? {}));
const searchData = { icons: Object.fromEntries(names.map((n) => [n, { category: all[n].category, tags: all[n].tags }])), i18n };
writeFileSync('dist/search-data.js', `// Generated by scripts/build.mjs: do not edit.\nexport const entries = ${JSON.stringify(searchData)};\n`);
// Migration (@flouvia/gota/migrate): the maps, checked by load.mjs, and the SF Symbols targets that
// can't take an enclosure or the slash a name's suffixes may ask for
const off = Object.fromEntries(
  [...new Set(Object.values(migrate.sfSymbols))].map((n) => [n, ['circle', 'square', 'slash'].filter((k) => !takes(all, n, k))]).filter(([, l]) => l.length),
);
writeFileSync('dist/migrate-data.js', `// Generated by scripts/build.mjs: do not edit.\nexport const maps = ${JSON.stringify(migrate)};\nexport const off = ${JSON.stringify(off)};\n`);
copyFileSync('engine/migrate.mjs', 'dist/migrate.js');
writeFileSync(
  'dist/migrate.d.ts',
  `import type { IconEnclosure, IconName, IconVariant } from './index';
/** A Gota icon and the props that make it the other set's icon. */
export type Equivalent = { name: IconName; variant?: IconVariant; enclosure?: IconEnclosure; slash?: true };
type Entry = IconName | { name: IconName; enclosure?: IconEnclosure; slash?: true };
export declare const maps: { lucide: Record<string, Entry>; heroicons: Record<string, Entry>; sfSymbols: Record<string, IconName> };
export declare function fromLucide(name: string): Equivalent | null;
export declare function fromHeroicons(name: string, options?: { style?: 'outline' | 'solid' }): Equivalent | null;
export declare function fromSFSymbol(name: string): Equivalent | null;
`,
);
copyFileSync('engine/motion.css', 'dist/motion.css');
writeFileSync('dist/motion-css.js', `// Generated by scripts/build.mjs: engine/motion.css as text, for injection.\nexport const css = ${JSON.stringify(readFileSync('engine/motion.css', 'utf8'))};\n`);
const lean = Object.fromEntries(names.map((n) => [n, { d: all[n].d, ...Object.fromEntries(DATA.filter((k) => all[n][k] !== undefined).map((k) => [k, all[n][k]])) }]));
writeFileSync('dist/data.js', `// Generated by scripts/build.mjs: do not edit.\nexport const icons = ${JSON.stringify(lean)};\nexport const categories = ${JSON.stringify(cats)};\n`);
const types = `export type IconName =\n${names.map((n) => `  | '${n}'`).join('\n')};\nexport type IconWeight = 'light' | 'regular' | 'bold';\nexport type IconVariant = 'outline' | 'fill';\nexport type IconEnclosure = 'circle' | 'square';\nexport type IconEffect = 'auto' | 'draw' | 'levels' | 'ring' | 'wiggle' | 'spin' | 'beat' | 'slide' | 'float' | 'bounce';\nexport type IconPlay = 'hover' | 'once' | 'loop';\nexport interface IconData { name?: string; drawn?: Partial<Record<IconEnclosure | 'slash', IconData>>; d: string[]; fill?: false | { solid: string[]; cut?: string[]; lines?: string[]; wire?: string[] }; badge?: { kind?: string; d: string[]; knock: string; fill?: object }; small?: object; variants?: Partial<Record<IconEnclosure | 'slash', false>>; mirror?: true; levels?: number[][]; value?: { draw?: string[]; turn?: { parts: string[]; origin: [number, number]; from: number; to: number; at: number } }; motion?: { effect: string; parts?: (number | string)[]; origin?: [number, number]; vector?: [number, number] }; parts?: Record<string, number[]> }\nexport interface IconOptions { variant?: IconVariant; weight?: IconWeight | number; enclosure?: IconEnclosure | null; slash?: boolean; size?: number; rtl?: boolean; value?: number | 'live'; animate?: IconEffect | null; play?: IconPlay; id?: string }\nexport declare const icons: Record<IconName, IconData>;\nexport declare const categories: { id: string; label: string; icons: IconName[] }[];\nexport declare const WEIGHTS: Record<IconWeight, number>;\nexport declare function render(icon: IconData, options?: Omit<IconOptions, 'variant' | 'weight' | 'play' | 'slash'> & { style?: IconVariant; weight?: number; slash?: boolean | number }): string;\nexport declare function toSvg(name: IconName, options?: IconOptions): string;\nexport declare function svg(icon: IconData, options?: IconOptions): string;\nexport declare function iconData(name: IconName): IconData;\nexport declare function pick(icon: IconData, options?: { enclosure?: IconEnclosure | null; slash?: boolean }): { icon: IconData; enclosure: IconEnclosure | null; slash: boolean };\nexport declare function sprite(icons: IconData[], options?: { variant?: IconVariant; weight?: IconWeight | number; prefix?: string }): string;\nexport declare function autoWeight(fontWeight: number | string): number;\nexport declare function svgFile(inner: string, icon?: IconData, extra?: string): string;\nexport declare function resolveIcon(name: IconName, options?: { enclosure?: IconEnclosure | null; slash?: boolean }): { name: IconName; enclosure: IconEnclosure | null; slash: boolean };\nexport declare function effectOf(icon: IconData, effect?: IconEffect): IconEffect;\nexport declare function motionAttrs(icon: IconData, effect?: IconEffect, play?: IconPlay): string;\n`;
writeFileSync('dist/index.d.ts', types);
writeFileSync(
  'dist/react.d.ts',
  `import type { ReactElement, SVGProps } from 'react';\nimport type { IconData, IconEffect, IconEnclosure, IconName, IconPlay, IconVariant, IconWeight } from './index';\nexport type IconProps = { variant?: IconVariant; weight?: IconWeight | 'auto' | number; enclosure?: IconEnclosure | null; slash?: boolean; scale?: 'small' | 'medium' | 'large'; size?: number | string; value?: number; rtl?: boolean; effect?: IconEffect | null; play?: IconPlay | boolean; transition?: 'auto' | 'morph' | 'replace' | null } & Omit<SVGProps<SVGSVGElement>, 'name'>;\nexport declare function IconBase(props: IconProps & { icon: IconData }): ReactElement;\nexport declare function Icon(props: IconProps & { name: IconName }): ReactElement;\n`,
);
writeFileSync('dist/core.d.ts', `export type * from './index';\nexport { autoWeight, effectOf, motionAttrs, pick, render, sprite, svg, svgFile, WEIGHTS } from './index';\n`);

// One module per icon (@flouvia/gota/icons/<name>): its data, its name and its hand-drawn variants
// linked, so a bundle carries only the icons it imports. Barrels name each one <Name>Icon (BellIcon,
// MapIcon): never a bare word that would shadow a global like Map, Image or File.
const exportName = (n) => `${n.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('')}Icon`;
const HEADER = '// Generated by scripts/build.mjs: do not edit.\n';
mkdirSync('dist/icons');
for (const n of names) {
  const slash = NAMES.has(`${n}-slash`) ? `${n}-slash` : NAMES.has(`${n}-off`) ? `${n}-off` : null;
  const links = [
    ['circle', NAMES.has(`${n}-circle`) && `${n}-circle`],
    ['square', NAMES.has(`${n}-square`) && `${n}-square`],
    ['slash', slash],
  ].filter(([, v]) => v);
  const body = JSON.stringify({ name: n, ...lean[n] });
  const data = links.length ? `${body.slice(0, -1)},"drawn":{${links.map(([k]) => k).join(',')}}}` : body;
  writeFileSync(`dist/icons/${n}.js`, `${HEADER}${links.map(([k, v]) => `import ${k} from './${v}.js';\n`).join('')}export default ${data};\n`);
}
const imports = (dir) => names.map((n, i) => `import i${i} from '${dir}${n}.js';`).join('\n');
writeFileSync('dist/icons/index.js', `${HEADER}${names.map((n) => `export { default as ${exportName(n)} } from './${n}.js';`).join('\n')}\n`);
writeFileSync('dist/icons/index.d.ts', `import type { IconData } from '../index';\n${names.map((n) => `export declare const ${exportName(n)}: IconData;`).join('\n')}\n`);
writeFileSync('dist/icons/_icon.d.ts', `import type { IconData } from '../index';\ndeclare const icon: IconData;\nexport default icon;\n`);
writeFileSync(
  'dist/react-icons.js',
  `${HEADER}// One React component per icon, each carrying only its own data.\nimport { createElement } from 'react';\nimport { IconBase } from './react-base.js';\n${imports('./icons/')}\n${names.map((n, i) => `export function ${exportName(n)}(props) {\n  return createElement(IconBase, { ...props, icon: i${i} });\n}`).join('\n')}\n`,
);
writeFileSync('dist/react-icons.d.ts', `import type { ReactElement } from 'react';\nimport type { IconProps } from './react';\n${names.map((n) => `export declare function ${exportName(n)}(props: IconProps): ReactElement;`).join('\n')}\n`);
writeFileSync(
  'dist/vue-icons.js',
  `${HEADER}// One Vue component per icon, each carrying only its own data.\nimport { defineComponent, h } from 'vue';\nimport { IconBase, iconProps } from './vue-base.js';\n${imports('./icons/')}\nconst make = (icon, name) => defineComponent({ name, props: iconProps, setup: (props) => () => h(IconBase, { ...props, icon }) });\n${names.map((n, i) => `export const ${exportName(n)} = /* @__PURE__ */ make(i${i}, '${exportName(n)}');`).join('\n')}\n`,
);

// Sprites: every icon as a <symbol id="gota-<name>">, outline and fill, at the regular weight
const { sprite } = await import('../dist/core.js');
const set = names.map((n) => ({ name: n, ...lean[n] }));
writeFileSync('dist/sprite.svg', sprite(set));
writeFileSync('dist/sprite-fill.svg', sprite(set, { variant: 'fill' }));
writeFileSync(
  'dist/icons.css',
  `/* Icons inline with the text: 1em and sitting on the line like a letter (Gota, by Flouvia). */\n.fi { display: inline-block; width: 1em; height: 1em; vertical-align: -0.125em; flex: none; }\n.fi-sm { width: 0.85em; height: 0.85em; vertical-align: -0.1em; }\n.fi-lg { width: 1.25em; height: 1.25em; vertical-align: -0.16em; }\n`,
);
const fills = names.filter((n) => all[n].fill).length;
console.log(`✓ ${names.length} icons (${fills} with fill) in ${categories.length} categories → svg/, svg/fill/ and ${files} files in dist/svg/`);
