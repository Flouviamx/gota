// Gota · Vue 3 components (dist/vue.js): <Icon> by name, with the whole set, and <IconBase> on an
// icon's data (see ./vue-base.js). One component per icon, carrying only its own data, is in
// @flouvia/gota/vue/icons (<BellIcon />).
//   <Icon name="bell" />                               1em, sitting on the text line like a letter
//   <Icon name="bell" variant="fill" weight="light" effect="auto" play="hover" />
//   <Icon name="bell" weight="auto" />                 stroke that matches the surrounding text
//   <Icon name="wifi" :value="0.5" />
//   <Icon :name="open ? 'close' : 'menu'" transition="auto" />   morphs, draws the badge, turns or swaps in
import { defineComponent, h } from 'vue';
import { iconData } from './index.js';
import { IconBase, iconProps } from './vue-base.js';

export { IconBase };

export const Icon = defineComponent({
  name: 'Icon',
  props: { name: { type: String, required: true }, ...iconProps },
  setup(props) {
    return () => {
      const { name, ...rest } = props;
      return h(IconBase, { ...rest, icon: iconData(name) });
    };
  },
});
export default Icon;
