# Build, outputs, and publishing

> **Source of truth:** `scripts/build.mjs`, `package.json`, `.gitignore`.

[← Index](./README.md)

## What `node scripts/build.mjs` generates
| Output | Contents |
|---|---|
| `svg/<name>.svg` · `svg/fill/<name>.svg` | Regular, outline and fill |
| `dist/svg/<light\|regular\|bold>/<outline\|fill>/<name>[-circle\|-square\|-slash].svg` | The full matrix (≈ 24 files per icon, minus the ones `variants` turns off) |
| `dist/icons.json` | Per icon: category, tags, strokes, and all of its data (`fill` —including `false`—, `badge`, `small`, `variants`, `mirror`, `levels`, `motion`, `parts`) |
| `dist/data.js` | Generated: `icons` (strokes and design data) and `categories`, which the API reads |
| `dist/core.js` + `core.d.ts` | Copied from `engine/core.mjs`: the API without icon data, all of it on an icon's data: `svg(icon, options)`, `pick` (the hand-drawn variant wins, through the data's `drawn` links), `sprite(icons, options)`, `render`, `WEIGHTS`, `autoWeight`, `effectOf`, `motionAttrs`, `svgFile` |
| `dist/index.js` + `index.d.ts` | Copied from `engine/index.mjs`: the core plus the whole set by name: `icons`, `categories`, `iconData(name)` (the data with its name and `drawn` links, the same shape as a module of `icons/`), `resolveIcon`, and `toSvg(name, { variant, weight, enclosure, slash, size, rtl, value, animate, play })`; `IconName` is typed |
| `dist/icons/<name>.js` · `icons/index.js` + `index.d.ts` | One module per icon: its data, its `name`, and its hand-drawn variants imported as `drawn` (`bell.js` imports `bell-off.js`), so a bundle carries only the icons it uses. The barrel names each one `<Name>Icon` (`BellIcon`, `MapIcon`); `_icon.d.ts` types the deep imports (`@flouvia/gota/icons/bell`) |
| `dist/sprite.svg` · `dist/sprite-fill.svg` | Every icon as a `<symbol id="gota-<name>">` at the regular weight, outline and fill, with mask ids of their own; `sprite()` builds one with only the icons a site uses |
| `dist/geometry.js` · `dist/variants.js` | The engine, to draw any combination in the browser |
| `dist/react-base.js` · `dist/react.js` + `react.d.ts` | Copied from `engine/react-base.mjs` and `engine/react.mjs`: `<IconBase icon={BellIcon} variant weight enclosure slash scale size value rtl effect play transition />` on an icon's data, importing no set, and `<Icon name="bell" />` on top of it, with the whole set. By default it measures `1em` and drops `-0.125em`, like a letter; `scale` small 0.85 / medium 1 / large 1.25; masks with `useId`; `weight="auto"` reads the weight of the surrounding text (`autoWeight`: 100 → 0.9, 400 → 1.5, 700 and heavier → 2.1); `transition` (`auto`, `morph`, `replace`) plays a change of icon or `slash` ([transitions](./engine.md#transitions-enginemorphmjs)); injects the motion stylesheet only if some icon animates |
| `dist/react-icons.js` + `react-icons.d.ts` | Generated: one component per icon (`<BellIcon weight="bold" />`), each a wrapper of `IconBase` with its own data. A transition needs one component whose `icon` changes, so it plays on `IconBase` or `Icon` (and on `slash`) |
| `dist/vue-base.js` · `dist/vue.js` · `dist/vue-icons.js` | The same for Vue 3: `IconBase`, `Icon` by name, and one component per icon (generated) |
| `dist/IconBase.svelte` · `dist/Icon.svelte` | The same for Svelte: `IconBase` on data and `Icon` by name. No component per icon (it would take a `.svelte` file each): `<IconBase icon={BellIcon} />` |
| `dist/Icon.astro` | The same component for Astro, by `name` or by `icon` data, rendered on the server with no JavaScript: no `weight="auto"` or `transition`, and a page with `effect` imports `@flouvia/gota/motion.css` once |
| `dist/morph.js` + `morph.d.ts` | Copied from `engine/morph.mjs`: `transitionOf`, `frames`, `morpher`, `changeOf`, `playTransition`, `PAIRS`, `toCubics` |
| `dist/search.js` + `search.d.ts` · `dist/search-core.js` · `dist/search-data.js` | `searchIcons` (from `engine/search-api.mjs`), the search engine (copied from `engine/search.mjs`), and the generated index data: category, tags, labels, and keywords per icon |
| `dist/motion.css` · `dist/motion-css.js` | The animations from `engine/motion.css`, as a stylesheet and as text for the components to inject |
| `dist/icons.css` | `.fi`, `.fi-sm`, `.fi-lg` for icons next to text without React |
With `--check <category>` it only validates (agents use it while drawing).

**The hand-drawn variant wins:** if `<name>-circle`, `-square`, `-slash`, or `-off` exists as an icon of its own, the build doesn't generate the automatic one with that name, and every API draws the drawn one instead: each icon's data links it (`drawn`, in `icons/<name>.js` and `iconData`) and `pick` follows the link (`svg`, `toSvg`, and every component); `resolveIcon` does the same by name (the MCP server).

## Outlines (`scripts/outline.mjs`)
Android vector drawables, Xcode symbols, and icon fonts can't hold strokes or masks, so they get each icon as filled shapes: `outline(icon, options)` returns one `d` (nonzero) in the 24 canvas for any of `render`'s options. It needs the dev dependency `canvaskit-wasm` (Skia).
- **One source of truth:** it doesn't redraw the icon; it evaluates `render`'s own SVG with Skia's path operations. Every fill and stroke is a region (with its width, caps, and joins); later paint covers earlier paint; inside a mask white keeps and black clears; a group is painted on a layer of its own, cut by its mask, and moved by its transform.
- **Holes turn against their outline:** each contour is rewound by its depth (how many others contain it), so the result fills the same with the nonzero rule (fonts) and the even-odd rule.
- **Checked, every time:** Skia also rasterizes the SVG as a browser does (masks by luminance) and the outline at 96 px. Scattered edge pixels are antialiasing; a clump of six or more is a loss (a dot is ~28). On a mismatch it joins the pieces another way (all at once, in a chain, in reverse, laid over each other without a union, nudged by thousandths of a unit); if none matches, it throws, naming the icon. A wrong outline never ships. To diagnose one, `attempts(svg)` returns what each way gives and how far it is from the drawing.
- **Measured** (22 Oct 2026): the 1,033 icons in ten variants (outline, fill, slash, circle, filled square, weights 0.75 and 2.6, 16 px outline and fill, mirrored), 9,573 outlines in 46 s, all matching. The check found one real defect, in the engine: `sq` corners that didn't fit their side made it run backwards (25 icons, [decision 52](./decisions.md#phase-2-22-oct-2026)).

## Compatible masters (`scripts/masters.mjs`)
A variable font and an Xcode variable symbol interpolate between masters, so the masters must share their structure point for point. `masters(icon, options, [0.9, 1.5, 2.1])` returns each weight's outline with the same contours, segments, and commands:
- each weight's checked outline (with unions first; then with the pieces laid over each other); invisible slivers (under 0.02 of area) are left out;
- contours paired across weights by turn, nesting depth, center, box, and spread (second moments, which tell apart orbits that share a center);
- points made to correspond, trying four ways in turn and keeping the first whose result passes every check: **following the regular master** (stations along it, its sharp corners among them, carried to each master by nearest point, searching forward, so a round cap maps radially onto the wider or narrower cap); **anchored** (the corners every master shares as anchors, following in between, where following alone jumps between close branches near a cut's corners); **each contour its own way** (the first of those that traces that contour faithfully in every master); and **corners and fractions of length**;
- each piece drawn as a quadratic curve (TrueType's own), split in all masters at once wherever one of them strays more than 0.01;
- every master checked against its drawing, and the outline halfway between masters (interpolated) checked against the drawing at that weight, as strictly as the masters: a failed check says where (`where`, the box of the largest mismatch).

Measured on 22 Oct 2026: 1,838 of the 1,865 outline and fill variants (98.6 %) have compatible masters, and every icon keeps its structure from 0.9 to 2.1. The other 27 interpolate with a visible error where a cut or a join moves nonlinearly (a bump where a badge's clearance meets a curve, a flattened cap): masters work, not drawing. `describe` and `between` (by any of the four ways) are there to diagnose one.

## Native formats (`node scripts/native.mjs <format>`)
From the checked outlines, after `scripts/build.mjs`; it needs `npm ci` (Skia).
| Format | Output |
|---|---|
| `android` | `dist/android/<light\|regular\|bold>/<outline\|fill>/gota_<name>[_circle\|_square\|_slash].xml`: Android vector drawables, the same matrix as `dist/svg` (20,088 files for 1,033 icons). One path, nonzero, `android:tint="?attr/colorControlNormal"` with a white fill so the theme colors it, and `android:autoMirrored` on directional icons |

Path data is compact: absolute coordinates rounded to hundredths first (0.005 at most), then written relative to the previous rounded point so rounding never adds up along a contour; lowercase commands, implied repeats, h/v for straight lines. The check runs on the compact data, so what is checked is what ships. Android for 1,033 icons: 41 MB, 19 MB zipped (40 % less than plain Skia output).

**Not yet:** Xcode symbols and the icon fonts. Xcode doesn't interpolate a static template: every missing weight or scale falls back to Regular-M as drawn (checked by rendering a probe symbol with AppKit), so a full static symbol needs 27 outlines. The plan is a variable template, three masters with compatible outlines (the same structure point for point), which the variable font needs too ([roadmap](./roadmap.md)).

## What goes into the repository and what doesn't
- **Committed:** `src/` (the drawings and the languages), `engine/`, `mcp/`, `scripts/`, `tests/`, `docs/`, `CLAUDE.md`, `DESIGN.md`, `README.md`, `README.es.md`, `LICENSE`, `package.json`, `package-lock.json`.
- **Not committed** (`.gitignore`): `svg/`, `dist/`, `previews/`, `node_modules/`. Everything is regenerated.

## Publishing (once there are 10,000)
- **npm:** `@flouvia/gota` with `dist/`, `svg/`, `mcp/`, `LICENSE`, `README.md`, and `README.es.md` (`files` in `package.json`). Exports: `.`, `./core`, `./icons`, `./icons/*`, `./react`, `./react/icons`, `./vue`, `./vue/icons`, `./svelte`, `./svelte/base`, `./astro`, `./morph`, `./search`, `./sprite.svg`, `./sprite-fill.svg`, `./svg/*`, `./icons.json`, `./icons.css`, `./motion.css`. `sideEffects` lists only the stylesheets, so bundlers drop every module a page doesn't use. React, Vue, and Svelte are optional peer dependencies; the package itself has none. Binary: `gota-mcp`.
- **Bundle size** (esbuild, minified, measured 22 Oct 2026 with 1,033 icons): one icon from `icons` with `core`, 16 KB (the engine plus that icon and its drawn variant); one or two components from `react/icons` or `vue/icons`, 33 KB (transitions included); `Icon` by name, 939 KB, since it carries the whole set: for prototypes and names that arrive at runtime, never for a production page that knows its icons.
- **GitHub Releases:** a GitHub Action, when a version is tagged, runs the build and attaches a ZIP with the SVGs sorted by weight and style.
- Semantic versioning, a changelog, and aliases for renames ([decisions](./decisions.md)).
- Site: `gota.flouvia.com` ([roadmap](./roadmap.md)).

## MCP server (`mcp/server.mjs`)
Lets AI agents (Claude Code, Cursor, Claude Desktop…) find icons by meaning and insert the exact SVG or component code. No dependencies: JSON-RPC 2.0 over stdio, one message per line (`initialize`, `ping`, `tools/list`, `tools/call`).
| Tool | What it returns |
|---|---|
| `search_icons { query, limit?, category? }` | Names, labels, and categories, best first ([search](./engine.md#search-enginesearchmjs)) |
| `get_icon { name, format?, variant?, weight?, enclosure?, slash?, size?, animate?, play? }` | `format`: `svg` (default), `react` (the `<Icon>` line and its import), or `data`. An unknown name gets suggestions |
| `list_categories {}` | The categories and how many icons each has |

It reads `dist/`, so it runs after the build: `node mcp/server.mjs` in the repo, or `npx -p @flouvia/gota gota-mcp` once published. The remote server at `gota.flouvia.com/mcp` needs the owner's OK ([roadmap](./roadmap.md)).
