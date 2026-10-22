// Gota · search by meaning. Each icon is indexed by its name, its accessibility labels in ten
// languages, its search keywords (Spanish and English: what it is and what it's used for) and its
// tags. Queries are accent- and case-insensitive, plurals count as singulars and empty words are
// ignored: "cobrar" finds wallet, invoice and terminal; "pagar con tarjeta" finds the cards.

/** Lowercase, strip accents and punctuation. The ñ stays: «campaña» is not «campana». */
export const fold = (s) =>
  String(s)
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Words that carry no meaning in a query (Spanish and English)
const STOP = new Set('a al ante con de del el en la las los para por un una unos unas y o the an of to for with and or in on my mi mis tu'.split(' '));
/** One form per word: plurals count as singulars («notificaciones» = «notificación»). */
const stem = (w) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const terms = (text) => text.split(' ').filter((w) => w && !STOP.has(w)).map(stem);

/**
 * Build the index from the icon data and the i18n entries:
 * buildIndex({ name: { category, tags } }, { name: { label: {…}, keywords: { es, en } } })
 */
export function buildIndex(icons, i18n = {}) {
  return Object.entries(icons).map(([name, icon]) => {
    const t = i18n[name] ?? {};
    return {
      name,
      category: icon.category,
      label: t.label ?? {},
      exact: fold(name.replace(/-/g, ' ')),
      fields: {
        name: terms(fold(name.replace(/-/g, ' '))),
        label: terms(fold(Object.values(t.label ?? {}).join(' '))),
        keyword: terms(fold([...(t.keywords?.es ?? []), ...(t.keywords?.en ?? [])].join(' '))),
        tag: terms(fold((icon.tags ?? []).join(' '))),
      },
    };
  });
}

// How much a match is worth in each field; a whole word is worth twice a prefix
const WEIGHT = { name: 10, label: 7, keyword: 5, tag: 3 };

/**
 * Search the index. Icons that match every query word come first, by score; if none matches them
 * all ("descargar pdf"), the ones that match the most words.
 */
export function search(index, query, { limit = 24, category } = {}) {
  const words = terms(fold(query));
  if (!words.length) return [];
  const results = [];
  for (const entry of index) {
    if (category && entry.category !== category) continue;
    let score = 0;
    let matched = 0;
    for (const w of words) {
      let best = 0;
      for (const [field, tokens] of Object.entries(entry.fields)) {
        if (tokens.includes(w)) best = Math.max(best, WEIGHT[field] * 2);
        else if (tokens.some((t) => t.startsWith(w))) best = Math.max(best, WEIGHT[field]);
        else if (w.length > 3 && tokens.some((t) => t.includes(w))) best = Math.max(best, WEIGHT[field] / 2);
      }
      if (best) matched++;
      score += best;
    }
    if (!matched) continue;
    // A name that is exactly the query wins; shorter names win ties (the base before its variants)
    if (entry.exact === fold(query)) score += 50;
    results.push({ name: entry.name, category: entry.category, label: entry.label, matched, score: score - entry.name.length * 0.01 });
  }
  const full = results.filter((r) => r.matched === words.length);
  const pool = full.length ? full : results;
  return pool.sort((a, b) => b.matched - a.matched || b.score - a.score).slice(0, limit).map(({ matched: _, ...r }) => r);
}
