// Gota · the core without icon data (dist/core.js). Everything here works on an icon's data, so a
// bundle carries only the icons it imports from @flouvia/gota/icons; @flouvia/gota adds the whole
// set by name on top of it.
//   import { svg } from '@flouvia/gota/core';
//   import { BellIcon } from '@flouvia/gota/icons';
//   svg(BellIcon, { variant: 'fill', weight: 'bold', slash: true })
import { effectOf, motionAttrs, render, svgFile, WEIGHTS } from './variants.js';

export { effectOf, motionAttrs, render, svgFile, WEIGHTS };

/**
 * Stroke width that matches a font weight (100–900), like SF Symbols matching the text around it:
 * 400 → 1.5 (regular), 700 → 2.1, 300 → 1.3. Used by weight="auto" in the components.
 */
export const autoWeight = (fontWeight) => Math.min(2.6, Math.max(0.75, 1.5 + (Number(fontWeight || 400) - 400) * 0.002));

/**
 * The hand-drawn variant wins over the automatic one: an icon's data links the variants drawn by
 * hand (`drawn.circle`, `drawn.square`, `drawn.slash`), so bell with a slash is bell-off.
 */
export function pick(icon, { enclosure = null, slash = false } = {}) {
  if (enclosure && icon.drawn?.[enclosure]) return { icon: icon.drawn[enclosure], enclosure: null, slash };
  if (slash && icon.drawn?.slash) return { icon: icon.drawn.slash, enclosure, slash: false };
  return { icon, enclosure, slash };
}

/** The complete SVG of an icon from its data: svg(BellIcon, { variant: 'fill', slash: true, size: 16 }). */
export function svg(icon, { variant = 'outline', weight = 'regular', enclosure = null, slash = false, size, rtl = false, value, animate = null, play = 'hover', id } = {}) {
  const r = pick(icon, { enclosure, slash });
  const inner = render(r.icon, { style: variant, weight: WEIGHTS[weight] ?? weight, enclosure: r.enclosure, slash: r.slash, size, rtl, value, animate, id: id ?? r.icon.name ?? 'gota' });
  return svgFile(inner, r.icon, animate ? motionAttrs(r.icon, animate, play) : '');
}

/**
 * A sprite: one <symbol id="gota-<name>"> per icon, drawn with <svg><use href="sprite.svg#gota-bell"/></svg>.
 * Masks get ids of their own per symbol, so badges and fills keep their cutouts.
 */
export function sprite(list, { variant = 'outline', weight = 'regular', prefix = 'gota-' } = {}) {
  const symbols = list.map((icon) => `<symbol id="${prefix}${icon.name}" viewBox="0 0 24 24">${render(icon, { style: variant, weight: WEIGHTS[weight] ?? weight, id: `${prefix}${icon.name}` })}</symbol>`);
  return `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`;
}
