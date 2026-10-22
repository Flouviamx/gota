// Gota · Vue 3 component (dist/vue.js). Same API as the React one:
//   <GotaIcon name="bell" />                               1em, sitting on the text line like a letter
//   <GotaIcon name="bell" variant="fill" weight="light" effect="auto" play="hover" />
//   <GotaIcon name="bell" weight="auto" />                 stroke that matches the surrounding text
//   <GotaIcon name="wifi" :value="0.5" />
//   <GotaIcon :name="open ? 'close' : 'menu'" transition="auto" />   morphs, draws the badge, turns or swaps in
import { computed, defineComponent, h, onMounted, ref, useId, watch } from 'vue';
import { autoWeight, effectOf, icons, render, resolveIcon, WEIGHTS } from './index.js';
import { changeOf, playTransition } from './morph.js';
import { css } from './motion-css.js';

const SCALES = { small: 0.85, medium: 1, large: 1.25 };
let injected = false;
function injectMotion() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.dataset.gota = 'motion';
  style.textContent = css;
  document.head.appendChild(style);
}

export const GotaIcon = defineComponent({
  name: 'GotaIcon',
  props: {
    name: { type: String, required: true },
    variant: { type: String, default: 'outline' },
    weight: { type: [String, Number], default: 'regular' },
    enclosure: { type: String, default: null },
    slash: { type: Boolean, default: false },
    scale: { type: String, default: 'medium' },
    size: { type: [String, Number], default: undefined },
    value: { type: Number, default: undefined },
    rtl: { type: Boolean, default: false },
    effect: { type: String, default: null },
    play: { type: String, default: 'hover' },
    transition: { type: String, default: null },
  },
  setup(props) {
    const id = `fi${(useId?.() ?? Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9]/g, '')}`;
    const el = ref(null);
    // weight="auto": read the weight of the text the icon sits in
    const textWeight = ref(400);
    onMounted(() => {
      if (props.effect) injectMotion();
      if (props.weight === 'auto' && el.value?.parentElement) textWeight.value = Number(getComputedStyle(el.value.parentElement).fontWeight) || 400;
    });
    const resolved = computed(() => resolveIcon(props.name, { enclosure: props.enclosure, slash: props.slash }));
    const stroke = () => (props.weight === 'auto' ? autoWeight(textWeight.value) : (WEIGHTS[props.weight] ?? props.weight));
    const options = () => ({ style: props.variant, weight: stroke(), enclosure: resolved.value.enclosure, value: props.value, rtl: props.rtl, id });
    // transition: when the icon (or its slash) changes, once the new drawing is in the DOM
    watch(
      () => [resolved.value.name, resolved.value.slash],
      ([name, slash], [prevName, prevSlash]) => {
        if (!props.transition || !el.value) return;
        const change = changeOf(icons, { name: prevName, slash: prevSlash }, { name, slash }, options(), props.transition);
        if (change) playTransition(el.value, change);
      },
      { flush: 'post' },
    );
    return () => {
      const r = resolved.value;
      const icon = icons[r.name];
      const k = SCALES[props.scale] ?? 1;
      const dim = props.size ?? `${k}em`;
      return h('svg', {
        ref: el,
        xmlns: 'http://www.w3.org/2000/svg',
        width: dim,
        height: dim,
        viewBox: '0 0 24 24',
        'aria-hidden': 'true',
        class: props.effect ? 'gota' : undefined,
        'data-effect': props.effect ? effectOf(icon, props.effect) : undefined,
        'data-play': props.effect ? props.play : undefined,
        'data-rtl': icon.mirror ? 'mirror' : undefined,
        style: props.size === undefined ? { verticalAlign: `${-0.125 * k}em`, flex: 'none' } : undefined,
        innerHTML: render(icon, { ...options(), slash: r.slash, animate: props.effect }),
      });
    };
  },
});
export default GotaIcon;
