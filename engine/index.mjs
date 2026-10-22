// Gota · API del paquete (dist/index.js). Los datos de cada ícono vienen de ./data.js (generado por
// scripts/build.mjs); el dibujo de cualquier variante sale del motor (./variants.js).
import { categories, icons } from './data.js';
import { effectOf, motionAttrs, render, svgFile, WEIGHTS } from './variants.js';

export { categories, effectOf, icons, motionAttrs, render, WEIGHTS };

/** Si la variante existe dibujada a mano (arrow-right-circle, bell-off…), esa gana a la automática. */
export function resolveIcon(name, { enclosure = null, slash = false } = {}) {
  if (enclosure && icons[`${name}-${enclosure}`]) return { name: `${name}-${enclosure}`, enclosure: null, slash };
  if (slash && (icons[`${name}-slash`] || icons[`${name}-off`])) return { name: icons[`${name}-slash`] ? `${name}-slash` : `${name}-off`, enclosure, slash: false };
  return { name, enclosure, slash };
}

/**
 * El SVG completo de un ícono:
 * toSvg('bell', { variant: 'fill', weight: 'bold', enclosure: 'circle', slash: true, size: 16 })
 * toSvg('bell', { animate: 'auto', play: 'hover' })   // con engine/motion.css (./motion.css)
 */
export function toSvg(name, { variant = 'outline', weight = 'regular', enclosure = null, slash = false, size, rtl = false, value, animate = null, play = 'hover', id = name } = {}) {
  const r = resolveIcon(name, { enclosure, slash });
  const icon = icons[r.name];
  const inner = render(icon, { style: variant, weight: WEIGHTS[weight] ?? weight, enclosure: r.enclosure, slash: r.slash, size, rtl, value, animate, id });
  return svgFile(inner, icon, animate ? motionAttrs(icon, animate, play) : '');
}
