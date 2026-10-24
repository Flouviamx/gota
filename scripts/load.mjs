// Loads the categories from src/icons/*.mjs and validates the set, its languages (src/i18n/), the
// migration maps (src/migrate/), and the taxonomy (src/taxonomy.json). Used by build.mjs and the
// sheet and QA scripts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIR = new URL('../src/icons/', import.meta.url).pathname;
const I18N = new URL('../src/i18n/', import.meta.url).pathname;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PATH = /^M[-0-9.,\sMmLlHhVvCcSsQqTtAaZz]+$/;
/** Effects with their own data; the generic ones (draw, bounce, replace) need nothing. */
export const MOTION = ['ring', 'wiggle', 'spin', 'beat', 'slide', 'float', 'bounce'];
/** Languages of the accessibility labels (src/i18n/<category>.json). */
export const LANGS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ar'];

/** Loaded categories; a file that fails to load is reported in `errors` without taking down the rest. */
export async function loadAll({ only } = {}) {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.mjs')).sort();
  const categories = [];
  const errors = [];
  for (const file of files) {
    try {
      const mod = await import(`${pathToFileURL(join(DIR, file)).href}?t=${process.hrtime.bigint()}`);
      const cat = mod.default;
      if (!cat?.category || !cat.icons) throw new Error('must export { category, label, icons }');
      categories.push({ file, ...cat });
    } catch (e) {
      if (!only || file === `${only}.mjs`) errors.push(`${file}: failed to load — ${e.message}`);
    }
  }
  const seen = new Map();
  for (const cat of categories) {
    for (const [name, icon] of Object.entries(cat.icons)) {
      const where = `${cat.category}/${name}`;
      const mine = !only || cat.category === only;
      if (seen.has(name)) {
        if (mine || seen.get(name) === only) errors.push(`${where}: the name already exists in ${seen.get(name)}`);
      } else seen.set(name, cat.category);
      if (!mine) continue;
      if (!NAME.test(name)) errors.push(`${where}: the name must be English kebab-case`);
      if (!Array.isArray(icon.tags) || icon.tags.length < 2) errors.push(`${where}: needs at least 2 tags (Spanish and English)`);
      const check = (list, what) => {
        if (!Array.isArray(list) || !list.length) return errors.push(`${where}: ${what} is empty`);
        for (const d of list) if (typeof d !== 'string' || !PATH.test(d.trim())) errors.push(`${where}: invalid path in ${what} "${String(d).slice(0, 40)}"`);
      };
      check(icon.d, 'd');
      if (icon.fill !== undefined && icon.fill !== false) {
        // Fill: `solid` (filled), `cut` (knocked out), `lines` (on top, with clearance); see DESIGN.md
        check(icon.fill?.solid, 'fill.solid');
        if (icon.fill?.cut !== undefined) check(icon.fill.cut, 'fill.cut');
        if (icon.fill?.lines !== undefined) check(icon.fill.lines, 'fill.lines');
        if (icon.fill?.wire !== undefined) check(icon.fill.wire, 'fill.wire');
      }
      if (icon.mirror !== undefined && icon.mirror !== true) errors.push(`${where}: mirror only accepts true`);
      if (icon.mark !== undefined && (icon.mark !== true || !icon.fill?.solid?.length)) errors.push(`${where}: mark is true and needs the mark's solid shapes in fill.solid`);
      if (icon.levels !== undefined) {
        const n = icon.d?.length ?? 0;
        if (!Array.isArray(icon.levels) || icon.levels.length < 2 || icon.levels.some((l) => !Array.isArray(l) || !l.length || l.some((i) => !Number.isInteger(i) || i < 0 || i >= n)))
          errors.push(`${where}: levels is a list of ≥2 levels, each with valid indices into d`);
      }
      if (icon.value !== undefined) {
        // A value: strokes drawn that far (`draw`, named parts) and parts turned to it (`turn`)
        const v = icon.value;
        const named = (list) => Array.isArray(list) && list.length > 0 && list.every((p) => icon.parts?.[p]);
        if (!v || typeof v !== 'object' || Object.keys(v).some((k) => !['draw', 'turn'].includes(k))) errors.push(`${where}: value is { draw?, turn? }`);
        if (v?.draw !== undefined && !named(v.draw)) errors.push(`${where}: value.draw names parts`);
        const t = v?.turn;
        if (t !== undefined && !(named(t.parts) && Array.isArray(t.origin) && t.origin.length === 2 && ['from', 'to', 'at'].every((k) => Number.isFinite(t[k])))) errors.push(`${where}: value.turn is { parts, origin: [x, y], from, to, at }`);
      }
      if (icon.motion !== undefined) {
        const m = icon.motion;
        if (!MOTION.includes(m?.effect)) errors.push(`${where}: motion.effect must be one of ${MOTION.join(', ')}`);
        if (m?.parts !== undefined && (!Array.isArray(m.parts) || m.parts.some((i) => (Number.isInteger(i) ? i < 0 || i >= icon.d.length : !icon.parts?.[i] && !(i === 'badge' && icon.badge)))))
          errors.push(`${where}: motion.parts are names from parts or indices into d`);
        for (const k of ['origin', 'vector']) if (m?.[k] !== undefined && (!Array.isArray(m[k]) || m[k].length !== 2)) errors.push(`${where}: motion.${k} is [x, y]`);
      }
      if (icon.parts !== undefined) {
        // Named parts (English kebab-case): body, clapper, badge, hand…
        const ok = icon.parts && typeof icon.parts === 'object' && Object.entries(icon.parts).every(([k, ix]) => NAME.test(k) && Array.isArray(ix) && ix.length && ix.every((i) => Number.isInteger(i) && i >= 0 && i < icon.d.length));
        if (!ok) errors.push(`${where}: parts is { name: [indices into d] }`);
      }
      if (icon.badge !== undefined) {
        // Badge: the engine's badge('plus') or a custom one { d, knock, fill? }
        check(icon.badge?.d, 'badge.d');
        if (typeof icon.badge?.knock !== 'string' || !PATH.test(icon.badge.knock.trim())) errors.push(`${where}: badge.knock is the area to clear (a closed path)`);
        if (icon.badge?.fill !== undefined) check(icon.badge.fill?.solid, 'badge.fill.solid');
      }
      if (icon.small !== undefined) {
        check(icon.small?.d, 'small.d');
        if (icon.small?.fill !== undefined) check(icon.small.fill?.solid, 'small.fill.solid');
      }
      if (icon.variants !== undefined)
        for (const k of Object.keys(icon.variants))
          if (!['circle', 'square', 'slash'].includes(k) || icon.variants[k] !== false) errors.push(`${where}: variants only accepts circle/square/slash: false`);
    }
  }
  // Languages: src/i18n/<category>.json → { name: { label: { es, en, … }, keywords: { es: [], en: [] } } }
  for (const cat of categories) {
    if (only && cat.category !== only) continue;
    const file = join(I18N, `${cat.category}.json`);
    if (!existsSync(file)) continue;
    let data;
    try {
      data = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      errors.push(`i18n/${cat.category}.json: invalid JSON — ${e.message}`);
      continue;
    }
    cat.i18n = data;
    for (const name of Object.keys(cat.icons)) {
      const t = data[name];
      const where = `i18n/${cat.category}/${name}`;
      if (!t) {
        errors.push(`${where}: missing`);
        continue;
      }
      const missing = LANGS.filter((l) => typeof t.label?.[l] !== 'string' || !t.label[l].trim());
      if (missing.length) errors.push(`${where}: missing labels in ${missing.join(', ')}`);
      for (const l of ['es', 'en']) if (!Array.isArray(t.keywords?.[l]) || t.keywords[l].length < 6) errors.push(`${where}: keywords.${l} needs at least 6`);
    }
    for (const name of Object.keys(data)) if (!cat.icons[name]) errors.push(`i18n/${cat.category}/${name}: does not exist in src/icons`);
  }
  // Migration maps: other sets' names → Gota (the whole set is needed to check them)
  const migrate = only ? null : loadMigrate(Object.assign({}, ...categories.map((c) => c.icons)), errors);
  const taxonomy = loadTaxonomy(categories, errors);
  adopt(categories, taxonomy);
  return { categories, errors, migrate, taxonomy };
}

/**
 * The taxonomy (src/taxonomy.json): the domains and every category, drawn or planned, with its
 * round, target, scope, and the icons it adopts. Every category file must be in it, under the same
 * Spanish label. See docs/taxonomy.md.
 */
export function loadTaxonomy(categories = [], errors = []) {
  let tax;
  try {
    tax = JSON.parse(readFileSync(new URL('../src/taxonomy.json', import.meta.url), 'utf8'));
  } catch (e) {
    errors.push(`taxonomy.json: ${e.message}`);
    return { domains: [], categories: [] };
  }
  const domains = new Set(tax.domains.map((d) => d.id));
  const byId = new Map();
  const adopted = new Map();
  const names = new Map(categories.flatMap((c) => Object.keys(c.icons).map((n) => [n, c.category])));
  for (const c of tax.categories) {
    const where = `taxonomy.json: ${c.id}`;
    if (byId.has(c.id)) errors.push(`${where}: repeated`);
    byId.set(c.id, c);
    if (!domains.has(c.domain)) errors.push(`${where}: unknown domain "${c.domain}"`);
    if (!Number.isInteger(c.round) || !Number.isInteger(c.target) || c.target < 0) errors.push(`${where}: round and target are whole numbers`);
    if (!c.label?.es || !c.label?.en || typeof c.scope !== 'string' || !c.scope) errors.push(`${where}: needs label.es, label.en, and a scope`);
    for (const n of c.adopts ?? []) {
      if (adopted.has(n)) errors.push(`${where}: ${n} is already adopted by ${adopted.get(n)}`);
      adopted.set(n, c.id);
      if (!names.has(n)) errors.push(`${where}: adopts ${n}, which is not an icon`);
      else if (names.get(n) === c.id) errors.push(`${where}: adopts ${n}, which is drawn in its own file`);
    }
  }
  for (const cat of categories) {
    const c = byId.get(cat.category);
    if (!c) errors.push(`${cat.file}: the category is not in src/taxonomy.json`);
    else if (c.label.es !== cat.label) errors.push(`${cat.file}: its label "${cat.label}" is "${c.label.es}" in src/taxonomy.json`);
  }
  return tax;
}

/**
 * A category adopts its icons once its file exists: they keep their source (and their languages'
 * file) where they were drawn, and are built, searched, and shown under the adopting category.
 */
export function adopt(categories, taxonomy) {
  const byId = new Map(categories.map((c) => [c.category, c]));
  for (const t of taxonomy.categories) {
    const to = byId.get(t.id);
    if (!to) continue;
    for (const name of t.adopts ?? []) {
      const from = categories.find((c) => c !== to && c.icons[name]);
      if (!from) continue;
      to.icons[name] = from.icons[name];
      delete from.icons[name];
      if (from.i18n?.[name]) {
        to.i18n = { ...to.i18n, [name]: from.i18n[name] };
        delete from.i18n[name];
      }
    }
  }
}

/** The migration maps' files (src/migrate/), by set. */
export const MIGRATE = { lucide: 'lucide.json', heroicons: 'heroicons.json', sfSymbols: 'sf-symbols.json' };

/** Can an icon take this enclosure or the slash: automatically, or as a hand-drawn icon of its own? */
export function takes(icons, name, variant) {
  if (variant === 'slash') return icons[name].variants?.slash !== false || Boolean(icons[`${name}-slash`] || icons[`${name}-off`]);
  return icons[name].variants?.[variant] !== false || Boolean(icons[`${name}-${variant}`]);
}

// Each entry: a Gota name, or { name, enclosure?, slash? } (Lucide and Heroicons only: SF Symbols
// writes its enclosures and slash as suffixes, applied when the name is read)
function loadMigrate(icons, errors) {
  const maps = {};
  for (const [set, file] of Object.entries(MIGRATE)) {
    const path = new URL(`../src/migrate/${file}`, import.meta.url).pathname;
    try {
      maps[set] = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push(`migrate/${file}: ${e.message}`);
      maps[set] = {};
      continue;
    }
    for (const [from, to] of Object.entries(maps[set])) {
      const where = `migrate/${file}: ${from}`;
      const t = typeof to === 'string' ? { name: to } : (to ?? {});
      if (typeof t.name !== 'string' || !icons[t.name]) {
        errors.push(`${where} → ${JSON.stringify(to)} is not an icon`);
        continue;
      }
      if (set === 'sfSymbols' && typeof to !== 'string') errors.push(`${where}: an SF Symbols concept maps to a name (its suffixes give the variants)`);
      const extra = Object.keys(t).filter((k) => !['name', 'enclosure', 'slash'].includes(k));
      if (extra.length) errors.push(`${where}: unknown ${extra.join(', ')}`);
      if (t.enclosure !== undefined && (!['circle', 'square'].includes(t.enclosure) || !takes(icons, t.name, t.enclosure))) errors.push(`${where}: ${t.name} takes no enclosure "${t.enclosure}"`);
      if (t.slash !== undefined && (t.slash !== true || !takes(icons, t.name, 'slash'))) errors.push(`${where}: ${t.name} takes no slash`);
    }
  }
  return maps;
}
