// Gota · other icon sets' names in Gota (dist/migrate.js): Lucide, Heroicons, and SF Symbols, each
// to { name, variant?, enclosure?, slash? } (the props of Gota's components), or null where Gota has
// no icon that shows the same thing. The maps are data (src/migrate/), checked by the build; the
// codemod (migrate/) and the MCP server read them through these functions.
//   fromLucide('circle-check')                      → { name: 'check', enclosure: 'circle' }
//   fromLucide('BellOff')                           → { name: 'bell-off' }   (component names too)
//   fromHeroicons('BellIcon', { style: 'solid' })   → { name: 'bell', variant: 'fill' }
//   fromSFSymbol('bell.slash.fill')                 → { name: 'bell', variant: 'fill', slash: true }
import { maps, off } from './migrate-data.js';

export { maps };

const pascal = (kebab) =>
  kebab
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
const indexes = {};
// A name as the set writes it (bell-off), or as its components export it (BellOff, BellOffIcon,
// LucideBellOff): each set's names by component name are indexed once
function lookup(set, name) {
  const map = maps[set];
  const key = String(name);
  if (Object.hasOwn(map, key)) return map[key];
  indexes[set] ??= new Map(Object.keys(map).map((k) => [pascal(k), k]));
  const found = indexes[set].get(key.replace(/^Lucide(?=[A-Z0-9])/, '').replace(/Icon$/, ''));
  return found === undefined ? undefined : map[found];
}
const equivalent = (value) => (typeof value === 'string' ? { name: value } : { ...value });

/** A Lucide icon (`circle-check`, or its component `CircleCheck`) in Gota, or null. */
export function fromLucide(name) {
  const value = lookup('lucide', name);
  return value === undefined ? null : equivalent(value);
}

/** A Heroicons icon (`check-circle` or `CheckCircleIcon`) in Gota; its solid style is Gota's fill. */
export function fromHeroicons(name, { style = 'outline' } = {}) {
  const value = lookup('heroicons', name);
  if (value === undefined) return null;
  return { ...equivalent(value), ...(style === 'solid' && { variant: 'fill' }) };
}

// SF Symbols writes its variants as suffixes: .fill (Gota's fill), .circle and .square (enclosures),
// .slash; a localized glyph (.ar, .ja, .zh.traditional…) is the same symbol
const MODIFIERS = new Set(['fill', 'circle', 'square', 'slash']);
const LOCALES = new Set(['ar', 'he', 'hi', 'ja', 'ko', 'th', 'zh', 'traditional', 'rtl', 'bn', 'gu', 'kn', 'ml', 'mni', 'mr', 'or', 'pa', 'sat', 'si', 'ta', 'te', 'my', 'km', 'el', 'ru', 'sr', 'uk', 'en', 'ug', 'ur', 'fa', 'ps', 'sd', 'ks', 'iu', 'ne', 'kk', 'ky', 'tg', 'tk', 'uz', 'az', 'be', 'bg', 'mk', 'mn', 'ss']);

/**
 * An SF Symbols name (`bell.slash.circle.fill`) in Gota: its concept through the map, its suffixes as
 * Gota's variants. A name the map holds whole wins (`info.circle` → info, whose circle is part of
 * its drawing). Null when there is no equivalent, or when that icon can't take the enclosure or
 * slash the name asks for.
 */
export function fromSFSymbol(name) {
  const segs = String(name).split('.');
  while (segs.length > 1 && LOCALES.has(segs.at(-1))) segs.pop();
  // .fill is a style wherever it sits (bag.fill.badge.plus is the filled bag with a plus)
  const fill = segs.includes('fill');
  const whole = (segs.at(-1) === 'fill' ? segs.slice(0, -1) : segs).join('.');
  if (Object.hasOwn(maps.sfSymbols, whole)) return { name: maps.sfSymbols[whole], ...(fill && { variant: 'fill' }) };
  const mods = new Set();
  while (segs.length > 1 && MODIFIERS.has(segs.at(-1))) mods.add(segs.pop());
  const concept = segs.join('.');
  if (!Object.hasOwn(maps.sfSymbols, concept)) return null;
  const target = maps.sfSymbols[concept];
  const enclosure = mods.has('circle') ? 'circle' : mods.has('square') ? 'square' : null;
  const slash = mods.has('slash');
  if ((enclosure && off[target]?.includes(enclosure)) || (slash && off[target]?.includes('slash'))) return null;
  return { name: target, ...(fill && { variant: 'fill' }), ...(enclosure && { enclosure }), ...(slash && { slash: true }) };
}
