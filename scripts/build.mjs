// Valida el set y genera svg/*.svg, dist/icons.json, dist/index.js (+ .d.ts) y dist/react.js.
// Uso: node scripts/build.mjs            → valida todo y escribe
//      node scripts/build.mjs --check X   → solo valida la categoría X (no escribe nada)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

const svg = (d) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${d.map((p) => `<path d="${p}"/>`).join('')}</svg>\n`;
rmSync('svg', { recursive: true, force: true });
mkdirSync('svg');
mkdirSync('dist', { recursive: true });
const all = {};
for (const cat of categories)
  for (const [name, icon] of Object.entries(cat.icons)) {
    all[name] = { category: cat.category, tags: icon.tags, d: icon.d };
    writeFileSync(`svg/${name}.svg`, svg(icon.d));
  }
const names = Object.keys(all).sort();
const sorted = Object.fromEntries(names.map((n) => [n, all[n]]));
const cats = categories.map((c) => ({ id: c.category, label: c.label, icons: Object.keys(c.icons) }));
writeFileSync('dist/icons.json', `${JSON.stringify(sorted)}\n`);
writeFileSync('dist/index.js', `// Generado por scripts/build.mjs: no editar.\nexport const icons = ${JSON.stringify(Object.fromEntries(names.map((n) => [n, all[n].d])))};\nexport const categories = ${JSON.stringify(cats)};\n`);
writeFileSync(
  'dist/index.d.ts',
  `export type IconName =\n${names.map((n) => `  | '${n}'`).join('\n')};\nexport declare const icons: Record<IconName, string[]>;\nexport declare const categories: { id: string; label: string; icons: IconName[] }[];\n`,
);
writeFileSync(
  'dist/react.js',
  `// Generado por scripts/build.mjs: no editar.\nimport { createElement } from 'react';\nimport { icons } from './index.js';\n\nexport function Icon({ name, size = 24, strokeWidth = 1.5, ...props }) {\n  return createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': props['aria-label'] ? undefined : true, ...props }, icons[name].map((d) => createElement('path', { key: d, d })));\n}\n`,
);
writeFileSync(
  'dist/react.d.ts',
  `import type { SVGProps } from 'react';\nimport type { IconName } from './index';\nexport declare function Icon(props: { name: IconName; size?: number | string; strokeWidth?: number } & SVGProps<SVGSVGElement>): JSX.Element;\n`,
);
console.log(`✓ ${names.length} íconos en ${categories.length} categorías → svg/, dist/`);
