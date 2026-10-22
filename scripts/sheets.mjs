// Regenera todas las hojas de revisión desde cero: borra previews/, saca la hoja de dibujo y la
// de variantes de cada categoría y escribe previews/index.html para recorrerlas en el navegador.
// Uso: node scripts/sheets.mjs
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, writeFileSync } from 'node:fs';
import { loadAll } from './load.mjs';

const { categories } = await loadAll();
rmSync('previews', { recursive: true, force: true });
for (const c of categories) {
  for (const script of ['sheet.mjs', 'variants-sheet.mjs']) execFileSync(process.execPath, [`scripts/${script}`, c.category], { stdio: 'ignore' });
  console.log(`✓ ${c.category}`);
}
const files = readdirSync('previews').filter((f) => f.endsWith('.png'));
const page = (c) => {
  const draw = files.filter((f) => new RegExp(`^${c.category}-\\d+\\.png$`).test(f)).sort((a, b) => parseInt(a.split('-').pop(), 10) - parseInt(b.split('-').pop(), 10));
  const vars = files.filter((f) => f.startsWith(`${c.category}-variantes-`)).sort((a, b) => parseInt(a.split('-').pop(), 10) - parseInt(b.split('-').pop(), 10));
  return `<section id="${c.category}"><h2>${c.label} <small>${Object.keys(c.icons).length} íconos</small></h2>${[...draw, ...vars].map((f) => `<a href="${f}"><img src="${f}" loading="lazy" alt="${f}"></a>`).join('')}</section>`;
};
const total = categories.reduce((n, c) => n + Object.keys(c.icons).length, 0);
writeFileSync(
  'previews/index.html',
  `<!doctype html><meta charset="utf-8"><title>Gota · hojas de revisión</title><style>
body{margin:0;background:#161617;color:#fff;font:14px "Helvetica Neue",Helvetica,Arial}
header{position:sticky;top:0;background:#161617ee;padding:14px 20px;display:flex;gap:14px;flex-wrap:wrap;align-items:baseline;z-index:1}
header b{font-size:18px}header a{color:#ffffffb0;text-decoration:none}header a:hover{color:#fff}
section{padding:10px 20px 40px}h2{font-weight:500}small{color:#ffffff70;font-weight:400}
img{display:block;width:100%;max-width:1320px;margin:0 0 12px;border-radius:8px}
</style><header><b>Gota</b><span>${total} íconos</span>${categories.map((c) => `<a href="#${c.category}">${c.label}</a>`).join('')}</header>${categories.map(page).join('')}`,
);
console.log(`✓ ${files.length} hojas → previews/index.html`);
