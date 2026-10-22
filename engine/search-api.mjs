// Gota · search, ready to use (dist/search.js): searchIcons('cobrar') with the index of the whole
// set (names, labels in ten languages, keywords and tags) built on first use.
import { buildIndex, fold, search } from './search-core.js';
import { entries } from './search-data.js';

let index;
/** Search by meaning, in English or Spanish. Options: { limit, category }. */
export function searchIcons(query, options) {
  index ??= buildIndex(entries.icons, entries.i18n);
  return search(index, query, options);
}
export { buildIndex, fold, search };
