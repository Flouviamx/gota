<!--
  Gota · Svelte component by name (dist/Icon.svelte), with the whole set. Same API as the React one;
  to carry only the icons a page uses, pass their data to IconBase.svelte (@flouvia/gota/svelte/base).
    <Icon name="bell" />
    <Icon name="bell" variant="fill" weight="light" effect="auto" play="hover" />
    <Icon name="bell" weight="auto" />   stroke that matches the surrounding text
    <Icon name={open ? 'close' : 'menu'} transition="auto" />
-->
<script>
  import IconBase from './IconBase.svelte';
  import { iconData } from './index.js';

  export let name;
</script>

<IconBase icon={iconData(name)} {...$$restProps} />
