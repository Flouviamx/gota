// Gota · componente de React (dist/react.js).
//   <Icon name="bell" />                                    1em, asentado en la línea como una letra
//   <Icon name="bell" variant="fill" weight="light" />      relleno, grosor con nombre o número
//   <Icon name="mic" enclosure="circle" slash />            encerrado y tachado
//   <Icon name="bell" effect="auto" play="hover" />         su gesto propio al pasar el cursor
//   <Icon name={on ? 'pause' : 'play'} transition="replace" />  cambia con una entrada suave
//   <Icon name="wifi" value={0.5} />                        niveles a la mitad
import { createElement, useEffect, useId, useRef } from 'react';
import { effectOf, icons, render, resolveIcon, WEIGHTS } from './index.js';
import { css } from './motion-css.js';

// Escala respecto al texto: el ícono mide 1em y se asienta en la línea como una letra
const SCALES = { small: 0.85, medium: 1, large: 1.25 };

// La hoja de movimiento se inyecta una sola vez, solo si algún ícono anima
let injected = false;
function injectMotion() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.dataset.gota = 'motion';
  style.textContent = css;
  document.head.appendChild(style);
}

export function Icon({ name, variant = 'outline', weight = 'regular', enclosure = null, slash = false, scale = 'medium', size, value, rtl = false, effect = null, play = 'hover', transition = null, className, style, ...props }) {
  const id = `fi${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = resolveIcon(name, { enclosure, slash });
  const icon = icons[r.name];
  const animated = Boolean(effect) || transition === 'replace';
  useEffect(() => {
    if (animated) injectMotion();
  }, [animated]);
  // Reemplazar: al cambiar de ícono, el nuevo entra con la animación gota-in
  const last = useRef(name);
  const swapped = transition === 'replace' && last.current !== name;
  useEffect(() => {
    last.current = name;
  }, [name]);
  const k = SCALES[scale] ?? 1;
  const dim = size ?? `${k}em`;
  const classes = [effect ? 'gota' : null, swapped ? 'gota-in' : null, className].filter(Boolean).join(' ') || undefined;
  return createElement('svg', {
    key: transition === 'replace' ? name : undefined,
    xmlns: 'http://www.w3.org/2000/svg',
    width: dim,
    height: dim,
    viewBox: '0 0 24 24',
    'aria-hidden': props['aria-label'] ? undefined : true,
    className: classes,
    'data-effect': effect ? effectOf(icon, effect) : undefined,
    'data-play': effect ? (play === true ? 'once' : play) : undefined,
    'data-rtl': icon.mirror ? 'mirror' : undefined,
    style: size === undefined ? { verticalAlign: `${-0.125 * k}em`, flex: 'none', ...style } : style,
    dangerouslySetInnerHTML: { __html: render(icon, { style: variant, weight: WEIGHTS[weight] ?? weight, enclosure: r.enclosure, slash: r.slash, value, rtl, animate: effect, id }) },
    ...props,
  });
}
