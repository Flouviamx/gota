<!--
  Gota · Svelte component on an icon's data (dist/IconBase.svelte). It imports no icon set: a
  bundle carries only the icons passed to it (@flouvia/gota/icons) or rendered by name (Icon.svelte).
    <IconBase icon={BellIcon} />
    <IconBase icon={BellIcon} variant="fill" weight="light" effect="auto" play="hover" />
    <IconBase icon={BellIcon} weight="auto" />   stroke that matches the surrounding text
    <IconBase icon={open ? CloseIcon : MenuIcon} transition="auto" />
    <IconBase icon={HeartIcon} variant={liked ? 'fill' : 'outline'} transition="auto" />   the fill rises like a liquid
-->
<script>
  import { afterUpdate, onMount } from 'svelte';
  import { autoWeight, effectOf, pick, render, WEIGHTS } from './core.js';
  import { changeOf, playTransition } from './morph.js';
  import { css } from './motion-css.js';

  export let icon;
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
    if (!(effect || showing) || document.querySelector('style[data-gota="motion"]')) return;
    const style = document.createElement('style');
    style.dataset.gota = 'motion';
    style.textContent = css;
    document.head.appendChild(style);
  });

  $: r = pick(icon, { enclosure, slash });
  $: shown = r.icon;
  $: k = SCALES[scale] ?? 1;
  $: dim = size ?? `${k}em`;
  $: stroke = weight === 'auto' ? autoWeight(textWeight) : (WEIGHTS[weight] ?? weight);
  // A value is drawn live: the markup stays and --gota-value (on the <svg>) moves it
  $: showing = value !== undefined && value !== null;
  $: options = { style: variant, weight: stroke, enclosure: r.enclosure, value: showing ? 'live' : undefined, rtl, id };
  $: inner = render(shown, { ...options, slash: r.slash, animate: effect });

  // transition: when the icon, its slash or its style changes, once the new drawing is in the DOM
  let before = null;
  afterUpdate(() => {
    const now = { name: shown.name, slash: r.slash, style: variant, icon: shown };
    if (before && transition && el && (before.icon !== shown || before.slash !== r.slash || before.style !== variant)) {
      const change = changeOf({ [before.name]: before.icon, [shown.name]: shown }, before, now, options, transition);
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
  aria-hidden={$$restProps['aria-label'] ? undefined : 'true'}
  class={[effect ? 'gota' : null, showing ? 'gota-v' : null].filter(Boolean).join(' ') || undefined}
  data-effect={effect ? effectOf(shown, effect) : undefined}
  data-play={effect ? play : undefined}
  data-rtl={shown.mirror ? 'mirror' : undefined}
  style={[size === undefined ? `vertical-align:${-0.125 * k}em;flex:none` : '', showing ? `--gota-value:${Math.max(0, Math.min(1, Number(value)))}` : ''].filter(Boolean).join(';') || undefined}
  {...$$restProps}>{@html inner}</svg>
