# Gota

**English** · [Español](./README.es.md)

The icons of [Flouvia](https://flouvia.com), drawn by hand, with continuous corners, a single
1.5 stroke, and a signature of their own — containers have a square bottom-right corner, like
the drop in Flouvia's logomark, and speech bubbles are the drop itself.

## Usage

Import the icons a page uses: each one carries only its own data.

```js
import { BellIcon, MailIcon } from '@flouvia/gota/react/icons';    // or /vue/icons
<MailIcon />                                       // 1em, sitting on the line like a letter
<BellIcon variant="fill" weight="light" scale="large" />
<BellIcon slash />                                 // the hand-drawn bell-off

import { IconBase } from '@flouvia/gota/react';     // one component, any icon: it can animate the change
import { CloseIcon, MenuIcon } from '@flouvia/gota/icons';
<IconBase icon={open ? CloseIcon : MenuIcon} transition="auto" />

import { svg } from '@flouvia/gota/core';           // without a framework
svg(MailIcon, { variant: 'fill', weight: 'bold', enclosure: 'circle' });
```

By name, with the whole set (prototypes, names that arrive at runtime): `<Icon name="mail" />` from
`@flouvia/gota/react`, or `toSvg('mail')` from `@flouvia/gota`.

- **Weights:** `light`, `regular`, `bold` (strokes 0.9, 1.5, 2.1: font weights 300, 400, 700), or any number in between. **Styles:** `outline` and `fill`.
- **Shapes:** plain, `enclosure: 'circle' | 'square'`, and `slash`.
- **Next to text:** by default it measures `1em` and drops `-0.125em`, like a letter; `scale`
  (`small`, `medium`, `large`) adjusts it. Without React: `@flouvia/gota/icons.css` and the `.fi` class.
- **Text weight:** `weight="auto"` matches the stroke to the weight of the surrounding text.
- **Values:** `value={0.6}` on wifi, signal, battery, volume, a timer, a gauge, a compass…: levels light up, a ring is drawn that far, a needle turns, and a new value animates.
- **Motion:** `effect="auto"` plays the icon's own gesture (`play`: `hover`, `once`, `loop`);
  `transition="auto"` animates a change of `name`, `slash` or `variant`: a badge or a slash draws
  itself in, menu ↔ close and other curated pairs morph, outline ↔ fill fills like a liquid, the
  rest swap in. Still under reduced motion.
- **Vue, Svelte, Astro:** `@flouvia/gota/vue` (and `/vue/icons`), `/svelte` (and `/svelte/base`), and `/astro`, with the same props.
- **Sprite:** `@flouvia/gota/sprite.svg` (and `sprite-fill.svg`), `<svg><use href="sprite.svg#gota-bell"/></svg>`; `sprite()` builds one with only your icons.
- **Search by meaning:** `searchIcons('cobrar')` from `@flouvia/gota/search` (Spanish and English).
- **For AI agents:** an MCP server to find icons and insert their code, remote at `https://gota.flouvia.com/mcp` or local with `gota-mcp`.
- **Standalone SVGs:** `svg/` (regular) and `svg/fill/`; the full matrix in `dist/svg/<weight>/<style>/`.
- **Native:** Android vector drawables and an Xcode asset catalog of custom symbols (`Image("bell")`, every weight and scale) come in the release ZIP.
- **Figma:** a library with every icon as a component, Style (Outline, Fill) × Weight (Light, Regular, Bold), searchable by meaning.
- **Icon font:** `@flouvia/gota/font.css`, then `<i class="gota">bell</i>` (the name is a ligature) or the icon's codepoint (`fonts/codepoints.json`); `.gota-fill` for the filled style. Variable: the stroke follows `font-weight`, from 300 (light) to 700 (bold), as `weight="auto"` does.

## Development

```bash
node scripts/build.mjs                 # validates everything and generates svg/ and dist/
node scripts/build.mjs --check <cat>   # validates one category
node scripts/sheet.mjs <cat|all>       # review sheet in previews/
node scripts/variants-sheet.mjs <cat>  # variants sheet (fill, weights, true 16 px…)
node scripts/transitions-sheet.mjs     # frames of every transition
node scripts/sheets.mjs                # every sheet, plus previews/index.html
node scripts/qa.mjs [cat]              # automated quality control
npm test                               # engine and feature tests
```

Each category lives in `src/icons/<category>.mjs` and is drawn with `engine/geometry.mjs`.
The design rules are in [DESIGN.md](./DESIGN.md); the project guide, in
[CLAUDE.md](./CLAUDE.md) and [docs/](./docs/README.md).

## License

[MIT](./LICENSE) © 2026 Flouvia
