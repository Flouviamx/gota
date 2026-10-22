// Generado por scripts/build.mjs: no editar.
import { createElement } from 'react';
import { icons } from './index.js';

export function Icon({ name, size = 24, strokeWidth = 1.5, ...props }) {
  return createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': props['aria-label'] ? undefined : true, ...props }, icons[name].map((d) => createElement('path', { key: d, d })));
}
