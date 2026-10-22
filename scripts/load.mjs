// Carga las categorías de src/icons/*.mjs y valida el set. Lo usan build.mjs y sheet.mjs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = new URL('../src/icons/', import.meta.url).pathname;
const I18N = new URL('../src/i18n/', import.meta.url).pathname;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PATH = /^M[-0-9.,\sMmLlHhVvCcSsQqTtAaZz]+$/;
/** Efectos con datos propios; los genéricos (draw, bounce, replace) no necesitan nada. */
export const MOTION = ['ring', 'wiggle', 'spin', 'beat', 'slide', 'float', 'bounce'];
/** Idiomas de las etiquetas de accesibilidad (src/i18n/<categoría>.json). */
export const LANGS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ar'];

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
      const check = (list, what) => {
        if (!Array.isArray(list) || !list.length) return errors.push(`${where}: ${what} vacío`);
        for (const d of list) if (typeof d !== 'string' || !PATH.test(d.trim())) errors.push(`${where}: trazo inválido en ${what} «${String(d).slice(0, 40)}»`);
      };
      check(icon.d, 'd');
      if (icon.fill !== undefined && icon.fill !== false) {
        // Relleno: `solid` (se rellena), `cut` (se cala), `lines` (encima, con aire); ver DESIGN.md
        check(icon.fill?.solid, 'fill.solid');
        if (icon.fill?.cut !== undefined) check(icon.fill.cut, 'fill.cut');
        if (icon.fill?.lines !== undefined) check(icon.fill.lines, 'fill.lines');
        if (icon.fill?.wire !== undefined) check(icon.fill.wire, 'fill.wire');
      }
      if (icon.mirror !== undefined && icon.mirror !== true) errors.push(`${where}: mirror solo admite true`);
      if (icon.levels !== undefined) {
        const n = icon.d?.length ?? 0;
        if (!Array.isArray(icon.levels) || icon.levels.length < 2 || icon.levels.some((l) => !Array.isArray(l) || !l.length || l.some((i) => !Number.isInteger(i) || i < 0 || i >= n)))
          errors.push(`${where}: levels es una lista de ≥2 niveles, cada uno con índices válidos de d`);
      }
      if (icon.motion !== undefined) {
        const m = icon.motion;
        if (!MOTION.includes(m?.effect)) errors.push(`${where}: motion.effect debe ser uno de ${MOTION.join(', ')}`);
        if (m?.parts !== undefined && (!Array.isArray(m.parts) || m.parts.some((i) => (Number.isInteger(i) ? i < 0 || i >= icon.d.length : !icon.parts?.[i] && !(i === 'badge' && icon.badge)))))
          errors.push(`${where}: motion.parts son nombres de parts o índices de d`);
        for (const k of ['origin', 'vector']) if (m?.[k] !== undefined && (!Array.isArray(m[k]) || m[k].length !== 2)) errors.push(`${where}: motion.${k} es [x, y]`);
      }
      if (icon.parts !== undefined) {
        // Piezas con nombre (kebab-case en inglés): body, clapper, badge, hand…
        const ok = icon.parts && typeof icon.parts === 'object' && Object.entries(icon.parts).every(([k, ix]) => NAME.test(k) && Array.isArray(ix) && ix.length && ix.every((i) => Number.isInteger(i) && i >= 0 && i < icon.d.length));
        if (!ok) errors.push(`${where}: parts es { nombre: [índices de d] }`);
      }
      if (icon.badge !== undefined) {
        // Insignia: badge('plus') del motor o una propia { d, knock, fill? }
        check(icon.badge?.d, 'badge.d');
        if (typeof icon.badge?.knock !== 'string' || !PATH.test(icon.badge.knock.trim())) errors.push(`${where}: badge.knock es el área que se despeja (un trazo cerrado)`);
        if (icon.badge?.fill !== undefined) check(icon.badge.fill?.solid, 'badge.fill.solid');
      }
      if (icon.small !== undefined) {
        check(icon.small?.d, 'small.d');
        if (icon.small?.fill !== undefined) check(icon.small.fill?.solid, 'small.fill.solid');
      }
      if (icon.variants !== undefined)
        for (const k of Object.keys(icon.variants))
          if (!['circle', 'square', 'slash'].includes(k) || icon.variants[k] !== false) errors.push(`${where}: variants solo admite circle/square/slash: false`);
    }
  }
  // Idiomas: src/i18n/<categoría>.json → { nombre: { label: { es, en, … }, keywords: { es: [], en: [] } } }
  for (const cat of categories) {
    if (only && cat.category !== only) continue;
    const file = join(I18N, `${cat.category}.json`);
    if (!existsSync(file)) continue;
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`i18n/${cat.category}.json: JSON inválido — ${e.message}`);
      continue;
    }
    cat.i18n = data;
    for (const name of Object.keys(cat.icons)) {
      const t = data[name];
      const where = `i18n/${cat.category}/${name}`;
      if (!t) {
        errors.push(`${where}: falta`);
        continue;
      }
      const missing = LANGS.filter((l) => typeof t.label?.[l] !== 'string' || !t.label[l].trim());
      if (missing.length) errors.push(`${where}: faltan etiquetas en ${missing.join(', ')}`);
      for (const l of ['es', 'en']) if (!Array.isArray(t.keywords?.[l]) || t.keywords[l].length < 6) errors.push(`${where}: keywords.${l} lleva al menos 6`);
    }
    for (const name of Object.keys(data)) if (!cat.icons[name]) errors.push(`i18n/${cat.category}/${name}: no existe en src/icons`);
  }
  return { categories, errors };
}
