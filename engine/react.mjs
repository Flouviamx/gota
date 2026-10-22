// Gota · React components (dist/react.js): <Icon> by name, with the whole set, and <IconBase> on an
// icon's data (see ./react-base.js). One component per icon, carrying only its own data, is in
// @flouvia/gota/react/icons (<BellIcon />).
//   <Icon name="bell" />                                    1em, sitting on the text line like a letter
//   <Icon name="bell" variant="fill" weight="light" />      filled, weight by name or number
//   <Icon name="bell" weight="auto" />                      stroke that matches the surrounding text
//   <Icon name="microphone" enclosure="circle" slash />     enclosed and slashed
//   <Icon name="bell" effect="auto" play="hover" />         its own gesture on hover
//   <Icon name={open ? 'close' : 'menu'} transition="auto" />  morphs, turns or swaps in, as fits
//   <Icon name="bell" slash={muted} transition="auto" />    the slash (or the drawn bell-off) draws itself in
//   <Icon name="wifi" value={0.5} />                        levels at half
import { createElement } from 'react';
import { iconData } from './index.js';
import { IconBase } from './react-base.js';

export { IconBase };

export function Icon({ name, ...props }) {
  return createElement(IconBase, { ...props, icon: iconData(name) });
}
