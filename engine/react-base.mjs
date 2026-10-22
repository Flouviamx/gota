// Gota · React component on an icon's data (dist/react-base.js). It imports no icon set: a bundle
// carries only the icons passed to it (@flouvia/gota/icons) or rendered by name (./react.js).
//   <IconBase icon={BellIcon} />                                1em, sitting on the text line like a letter
//   <IconBase icon={BellIcon} variant="fill" weight="light" />  filled, weight by name or number
//   <IconBase icon={BellIcon} weight="auto" />                  stroke that matches the surrounding text
//   <IconBase icon={MicrophoneIcon} enclosure="circle" slash /> enclosed and slashed (the drawn variant wins)
//   <IconBase icon={BellIcon} effect="auto" play="hover" />     its own gesture on hover
//   <IconBase icon={open ? CloseIcon : MenuIcon} transition="auto" />  morphs, turns or swaps in, as fits
//   <IconBase icon={WifiIcon} value={0.5} />                    levels at half
import { createElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { autoWeight, effectOf, pick, render, WEIGHTS } from './core.js';
import { changeOf, playTransition } from './morph.js';
import { css } from './motion-css.js';

// Scale relative to the text: the icon is 1em and sits on the line like a letter
const SCALES = { small: 0.85, medium: 1, large: 1.25 };
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// The motion stylesheet is injected only once, and only if some icon animates
let injected = false;
function injectMotion() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.dataset.gota = 'motion';
  style.textContent = css;
  document.head.appendChild(style);
}

export function IconBase({ icon: data, variant = 'outline', weight = 'regular', enclosure = null, slash = false, scale = 'medium', size, value, rtl = false, effect = null, play = 'hover', transition = null, className, style, ...props }) {
  const id = `fi${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ref = useRef(null);
  const r = pick(data, { enclosure, slash });
  const icon = r.icon;

  // weight="auto": read the weight of the text the icon sits in
  const [textWeight, setTextWeight] = useState(400);
  useIsoLayoutEffect(() => {
    if (weight !== 'auto' || !ref.current?.parentElement) return;
    setTextWeight(Number(getComputedStyle(ref.current.parentElement).fontWeight) || 400);
  }, [weight]);
  const stroke = weight === 'auto' ? autoWeight(textWeight) : (WEIGHTS[weight] ?? weight);

  useEffect(() => {
    if (effect) injectMotion();
  }, [effect]);
  const html = render(icon, { style: variant, weight: stroke, enclosure: r.enclosure, slash: r.slash, value, rtl, animate: effect, id });

  // transition: when the icon (or its slash) changes, morph, draw the badge, turn or swap in
  const last = useRef({ name: icon.name, slash: r.slash, icon });
  useIsoLayoutEffect(() => {
    const before = last.current;
    last.current = { name: icon.name, slash: r.slash, icon };
    if (!transition || !ref.current || (before.icon === icon && before.slash === r.slash)) return;
    const both = { [before.name]: before.icon, [icon.name]: icon };
    const change = changeOf(both, before, last.current, { style: variant, weight: stroke, enclosure: r.enclosure, rtl, value, id }, transition);
    if (change) playTransition(ref.current, change);
  }, [icon, r.slash]);

  const k = SCALES[scale] ?? 1;
  const dim = size ?? `${k}em`;
  const classes = [effect ? 'gota' : null, className].filter(Boolean).join(' ') || undefined;
  return createElement('svg', {
    ref,
    xmlns: 'http://www.w3.org/2000/svg',
    width: dim,
    height: dim,
    viewBox: '0 0 24 24',
    'aria-hidden': props['aria-label'] ? undefined : true,
    className: classes,
    'data-effect': effect ? effectOf(icon, effect) : undefined,
    'data-play': effect ? (play === true ? 'once' : play) : undefined,
    'data-rtl': icon.mirror ? 'mirror' : undefined,
    style: size === undefined ? { verticalAlign: `${-0.125 * k}em`, flex: 'none', transformOrigin: 'center', ...style } : { transformOrigin: 'center', ...style },
    dangerouslySetInnerHTML: { __html: html },
    ...props,
  });
}
