// Carga las categorías de src/icons/*.mjs y valida el set. Lo usan build.mjs y sheet.mjs.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = new URL('../src/icons/', import.meta.url).pathname;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PATH = /^M[-0-9.,\sMmLlHhVvCcSsQqTtAaZz]+$/;

/** Categorías cargadas; un archivo que no carga se reporta en `errors` sin tumbar a los demás. */
export async function loadAll({ only } = {}) {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort();
  const categories = [];
  const errors = [];
  for (const file of files) {
    try {
      const mod = await import(`${pathToFileURL(join(DIR, file)).href}?t=${process.hrtime.bigint()}`);
      const cat = mod.default;
      if (!cat?.category || !cat.icons) throw new Error('debe exportar { category, label, icons }');
      categories.push({ file, ...cat });
    } catch (e) {
      if (!only || file === `${only}.mjs`) errors.push(`${file}: no carga — ${e.message}`);
    }
  }
  const seen = new Map();
  for (const cat of categories) {
    for (const [name, icon] of Object.entries(cat.icons)) {
      const where = `${cat.category}/${name}`;
      const mine = !only || cat.category === only;
      if (seen.has(name)) {
        if (mine || seen.get(name) === only) errors.push(`${where}: el nombre ya existe en ${seen.get(name)}`);
      } else seen.set(name, cat.category);
      if (!mine) continue;
      if (!NAME.test(name)) errors.push(`${where}: el nombre va en kebab-case en inglés`);
      if (!Array.isArray(icon.tags) || icon.tags.length < 2) errors.push(`${where}: lleva al menos 2 tags (español e inglés)`);
      if (!Array.isArray(icon.d) || !icon.d.length) errors.push(`${where}: sin trazos`);
      else for (const d of icon.d) if (typeof d !== 'string' || !PATH.test(d.trim())) errors.push(`${where}: trazo inválido «${String(d).slice(0, 40)}»`);
    }
  }
  return { categories, errors };
}
