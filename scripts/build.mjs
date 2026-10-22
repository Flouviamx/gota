// Valida el set y genera svg/ (regular, contorno y relleno), la matriz completa de variantes en
// dist/svg/, dist/icons.json, dist/index.js (+ .d.ts), dist/react.js y dist/icons.css.
// Uso: node scripts/build.mjs            → valida todo y escribe
//      node scripts/build.mjs --check X   → solo valida la categoría X (no escribe nada)
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { loadAll } from './load.mjs';

const only = process.argv.includes('--check') ? process.argv[process.argv.indexOf('--check') + 1] : undefined;
const { categories, errors } = await loadAll({ only });
if (errors.length) {
  console.error(`✗ ${errors.length} problema(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
const count = categories.reduce((n, c) => n + (only && c.category !== only ? 0 : Object.keys(c.icons).length), 0);
if (only) {
  console.log(`✓ ${only}: ${count} íconos válidos`);
  process.exit(0);
}

// ── Salidas ──
// svg/<nombre>.svg y svg/fill/<nombre>.svg: regular, para ver en GitHub (van al repo).
// dist/svg/<grosor>/<outline|fill>/<nombre>[-circle|-square|-slash].svg: la matriz completa (npm).
const { render, svgFile, WEIGHTS } = await import('../engine/variants.mjs');
const FORMS = [
  ['', {}],
  ['-circle', { enclosure: 'circle' }],
  ['-square', { enclosure: 'square' }],
  ['-slash', { slash: true }],
];
rmSync('svg', { recursive: true, force: true });
rmSync('dist', { recursive: true, force: true });
mkdirSync('svg/fill', { recursive: true });
for (const w of Object.keys(WEIGHTS)) for (const st of ['outline', 'fill']) mkdirSync(`dist/svg/${w}/${st}`, { recursive: true });

// Datos de diseño de cada ícono que viajan al paquete, además de d
const DATA = ['fill', 'badge', 'small', 'variants', 'mirror', 'levels', 'motion', 'parts'];
// Nombres de todo el set, para saber si una variante ya existe dibujada a mano
const NAMES = new Set(categories.flatMap((c) => Object.keys(c.icons)));
const drawn = (name, { enclosure, slash }) => (enclosure ? NAMES.has(`${name}-${enclosure}`) : slash && (NAMES.has(`${name}-slash`) || NAMES.has(`${name}-off`)));
const all = {};
let files = 0;
for (const cat of categories)
  for (const [name, icon] of Object.entries(cat.icons)) {
    // Todos los datos del ícono viajan al paquete (fill: false también: «solo líneas» es un dato)
    all[name] = { category: cat.category, tags: icon.tags, d: icon.d, ...Object.fromEntries(DATA.filter((k) => icon[k] !== undefined).map((k) => [k, icon[k]])) };
    writeFileSync(`svg/${name}.svg`, svgFile(render(icon, { id: name }), icon));
    writeFileSync(`svg/fill/${name}.svg`, svgFile(render(icon, { style: 'fill', id: name }), icon));
    for (const [w, weight] of Object.entries(WEIGHTS))
      for (const st of ['outline', 'fill'])
        for (const [suffix, opts] of FORMS) {
          const off = (opts.enclosure && icon.variants?.[opts.enclosure] === false) || (opts.slash && icon.variants?.slash === false);
          // La versión dibujada a mano gana: no se genera la automática con su mismo nombre
          if (off || (suffix && drawn(name, opts))) continue;
          writeFileSync(`dist/svg/${w}/${st}/${name}${suffix}.svg`, svgFile(render(icon, { ...opts, style: st, weight, id: `${name}${suffix}` }), icon));
          files++;
        }
  }
const names = Object.keys(all).sort();
const data = Object.fromEntries(names.map((n) => [n, all[n]]));
const cats = categories.map((c) => ({ id: c.category, label: c.label, icons: Object.keys(c.icons) }));
writeFileSync('dist/icons.json', `${JSON.stringify(data)}\n`);

// El motor de variantes viaja con el paquete para dibujar cualquier combinación en el navegador
copyFileSync('engine/geometry.mjs', 'dist/geometry.js');
writeFileSync('dist/variants.js', readFileSync('engine/variants.mjs', 'utf8').replace("'./geometry.mjs'", "'./geometry.js'"));
const lean = Object.fromEntries(names.map((n) => [n, { d: all[n].d, ...Object.fromEntries(DATA.filter((k) => all[n][k] !== undefined).map((k) => [k, all[n][k]])) }]));
writeFileSync(
  'dist/index.js',
  `// Generado por scripts/build.mjs: no editar.\nimport { render, svgFile, WEIGHTS } from './variants.js';\n\nexport const icons = ${JSON.stringify(lean)};\nexport const categories = ${JSON.stringify(cats)};\nexport { render, WEIGHTS };\n\n/** Si la variante existe dibujada a mano (arrow-right-circle, bell-off…), esa gana a la automática. */\nexport function resolveIcon(name, { enclosure = null, slash = false } = {}) {\n  if (enclosure && icons[\`\${name}-\${enclosure}\`]) return { name: \`\${name}-\${enclosure}\`, enclosure: null, slash };\n  if (slash && (icons[\`\${name}-slash\`] || icons[\`\${name}-off\`])) return { name: icons[\`\${name}-slash\`] ? \`\${name}-slash\` : \`\${name}-off\`, enclosure, slash: false };\n  return { name, enclosure, slash };\n}\n\n/** El SVG completo de un ícono: toSvg('mail', { variant: 'fill', weight: 'bold', enclosure: 'circle', slash: true }). */\nexport function toSvg(name, { variant = 'outline', weight = 'regular', enclosure = null, slash = false, id = name } = {}) {\n  const r = resolveIcon(name, { enclosure, slash });\n  return svgFile(render(icons[r.name], { style: variant, weight: WEIGHTS[weight] ?? weight, enclosure: r.enclosure, slash: r.slash, id }), icons[r.name]);\n}\n`,
);
const types = `export type IconName =\n${names.map((n) => `  | '${n}'`).join('\n')};\nexport type IconWeight = 'light' | 'regular' | 'bold';\nexport type IconVariant = 'outline' | 'fill';\nexport type IconEnclosure = 'circle' | 'square';\nexport interface IconData { d: string[]; fill?: { solid: string[]; cut?: string[]; lines?: string[] }; variants?: Partial<Record<IconEnclosure | 'slash', false>> }\nexport interface IconOptions { variant?: IconVariant; weight?: IconWeight | number; enclosure?: IconEnclosure | null; slash?: boolean; id?: string }\nexport declare const icons: Record<IconName, IconData>;\nexport declare const categories: { id: string; label: string; icons: IconName[] }[];\nexport declare const WEIGHTS: Record<IconWeight, number>;\nexport declare function render(icon: IconData, options?: { style?: IconVariant; weight?: number; enclosure?: IconEnclosure | null; slash?: boolean; id?: string }): string;\nexport declare function toSvg(name: IconName, options?: IconOptions): string;\nexport declare function resolveIcon(name: IconName, options?: { enclosure?: IconEnclosure | null; slash?: boolean }): { name: IconName; enclosure: IconEnclosure | null; slash: boolean };\n`;
writeFileSync('dist/index.d.ts', types);
writeFileSync(
  'dist/react.js',
  `// Generado por scripts/build.mjs: no editar.\nimport { createElement, useId } from 'react';\nimport { icons, render, resolveIcon, WEIGHTS } from './index.js';\n\n// Escala respecto al texto: el ícono mide 1em y se asienta en la línea como una letra\nconst SCALES = { small: 0.85, medium: 1, large: 1.25 };\n\nexport function Icon({ name, variant = 'outline', weight = 'regular', enclosure = null, slash = false, scale = 'medium', size, style, ...props }) {\n  const id = \`fi\${useId().replace(/[^a-zA-Z0-9]/g, '')}\`;\n  const k = SCALES[scale] ?? 1;\n  const dim = size ?? \`\${k}em\`;\n  return createElement('svg', {\n    xmlns: 'http://www.w3.org/2000/svg',\n    width: dim,\n    height: dim,\n    viewBox: '0 0 24 24',\n    'aria-hidden': props['aria-label'] ? undefined : true,\n    style: size === undefined ? { verticalAlign: \`\${-0.125 * k}em\`, flex: 'none', ...style } : style,\n    dangerouslySetInnerHTML: { __html: (({ name: n, enclosure: e, slash: s }) => render(icons[n], { style: variant, weight: WEIGHTS[weight] ?? weight, enclosure: e, slash: s, id }))(resolveIcon(name, { enclosure, slash })) },\n    ...props,\n  });\n}\n`,
);
writeFileSync(
  'dist/react.d.ts',
  `import type { SVGProps } from 'react';\nimport type { IconEnclosure, IconName, IconVariant, IconWeight } from './index';\nexport declare function Icon(props: { name: IconName; variant?: IconVariant; weight?: IconWeight | number; enclosure?: IconEnclosure | null; slash?: boolean; scale?: 'small' | 'medium' | 'large'; size?: number | string } & Omit<SVGProps<SVGSVGElement>, 'name'>): JSX.Element;\n`,
);
writeFileSync(
  'dist/icons.css',
  `/* Íconos en línea con el texto: miden 1em y se asientan como una letra (Gota, de Flouvia). */\n.fi { display: inline-block; width: 1em; height: 1em; vertical-align: -0.125em; flex: none; }\n.fi-sm { width: 0.85em; height: 0.85em; vertical-align: -0.1em; }\n.fi-lg { width: 1.25em; height: 1.25em; vertical-align: -0.16em; }\n`,
);
const fills = names.filter((n) => all[n].fill).length;
console.log(`✓ ${names.length} íconos (${fills} con relleno) en ${categories.length} categorías → svg/, svg/fill/ y ${files} archivos en dist/svg/`);
