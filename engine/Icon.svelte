<!--
  Gota · Svelte component (dist/Icon.svelte). Same API as the React one:
    <Icon name="bell" />
    <Icon name="bell" variant="fill" weight="light" effect="auto" play="hover" />
    <Icon name="bell" weight="auto" />   stroke that matches the surrounding text
    <Icon name={open ? 'close' : 'menu'} transition="auto" />
-->
<script>
  import { afterUpdate, onMount } from 'svelte';
  import { autoWeight, effectOf, icons, render, resolveIcon, WEIGHTS } from './index.js';
  import { changeOf, playTransition } from './morph.js';
  import { css } from './motion-css.js';

  export let name;
  export let variant = 'outline';
  export let weight = 'regular';
  export let enclosure = null;
  export let slash = false;
  export let scale = 'medium';
  export let size = undefined;
  export let value = undefined;
  export let rtl = false;
  export let effect = null;
  export let play = 'hover';
  export let transition = null;

  const SCALES = { small: 0.85, medium: 1, large: 1.25 };
  let el;
  const id = `fi${Math.random().toString(36).slice(2, 10)}`;

  // weight="auto": read the weight of the text the icon sits in
  let textWeight = 400;
  onMount(() => {
    if (weight === 'auto' && el?.parentElement) textWeight = Number(getComputedStyle(el.parentElement).fontWeight) || 400;
    if (!effect || document.querySelector('style[data-gota="motion"]')) return;
    const style = document.createElement('style');
    style.dataset.gota = 'motion';
    style.textContent = css;
    document.head.appendChild(style);
  });

  $: r = resolveIcon(name, { enclosure, slash });
  $: icon = icons[r.name];
  $: k = SCALES[scale] ?? 1;
  $: dim = size ?? `${k}em`;
  $: stroke = weight === 'auto' ? autoWeight(textWeight) : (WEIGHTS[weight] ?? weight);
  $: options = { style: variant, weight: stroke, enclosure: r.enclosure, value, rtl, id };
  $: inner = render(icon, { ...options, slash: r.slash, animate: effect });

  // transition: when the icon (or its slash) changes, once the new drawing is in the DOM
  let before = null;
  afterUpdate(() => {
    const now = { name: r.name, slash: r.slash };
    if (before && transition && el) {
      const change = changeOf(icons, before, now, options, transition);
      if (change) playTransition(el, change);
    }
    before = now;
  });
</script>

<svg
  bind:this={el}
  xmlns="http://www.w3.org/2000/svg"
  width={dim}
  height={dim}
  viewBox="0 0 24 24"
  aria-hidden="true"
  class={effect ? 'gota' : undefined}
  data-effect={effect ? effectOf(icon, effect) : undefined}
  data-play={effect ? play : undefined}
  data-rtl={icon.mirror ? 'mirror' : undefined}
  style={size === undefined ? `vertical-align:${-0.125 * k}em;flex:none` : undefined}
  {...$$restProps}>{@html inner}</svg>
