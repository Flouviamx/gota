# Gota

**English** · [Español](./README.es.md)

The icons of [Flouvia](https://flouvia.com), drawn by hand, with continuous corners, a single
1.5 stroke, and a signature of their own — containers have a square bottom-right corner, like
the drop in Flouvia's logomark, and speech bubbles are the drop itself.

## Usage

Standalone SVGs in `svg/` (24 × 24, `stroke="currentColor"`), or from the package:

```js
import { toSvg } from '@flouvia/gota';
toSvg('mail', { variant: 'fill', weight: 'bold', enclosure: 'circle', slash: true });

import { Icon } from '@flouvia/gota/react';
<Icon name="mail" />                              // 1em, sitting on the line like a letter
<Icon name="bell" variant="fill" weight="light" scale="large" />
<Icon name="microphone" slash enclosure="circle" size={20} />
```

- **Weights:** `light`, `regular`, `bold`. **Styles:** `outline` and `fill`.
- **Shapes:** plain, `enclosure: 'circle' | 'square'`, and `slash`.
- **Next to text:** by default it measures `1em` and drops `-0.125em`, like a letter; `scale`
  (`small`, `medium`, `large`) adjusts it. Without React: `@flouvia/gota/icons.css` and the `.fi` class.
- **Text weight:** `weight="auto"` matches the stroke to the weight of the surrounding text.
- **Motion:** `effect="auto"` plays the icon's own gesture (`play`: `hover`, `once`, `loop`);
  `transition="auto"` animates a change of `name` or `slash`: a badge or a slash draws itself
  in, menu ↔ close and other curated pairs morph, the rest swap in. Still under reduced motion.
- **Vue, Svelte, Astro:** `@flouvia/gota/vue` (`GotaIcon`), `/svelte`, and `/astro`, with the same props.
- **Search by meaning:** `searchIcons('cobrar')` from `@flouvia/gota/search` (Spanish and English).
- **For AI agents:** an MCP server, `gota-mcp`, to find icons and insert their code.
- Standalone SVGs: `svg/` (regular) and `svg/fill/`; the full matrix in `dist/svg/<weight>/<style>/`.

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
