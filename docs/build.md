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
| `dist/react-base.js` · `dist/react.js` + `react.d.ts` | Copied from `engine/react-base.mjs` and `engine/react.mjs`: `<IconBase icon={BellIcon} variant weight enclosure slash scale size value rtl effect play transition />` on an icon's data, importing no set, and `<Icon name="bell" />` on top of it, with the whole set. By default it measures `1em` and drops `-0.125em`, like a letter; `scale` small 0.85 / medium 1 / large 1.25; masks with `useId`; `weight="auto"` reads the weight of the surrounding text (`autoWeight`); `transition` (`auto`, `morph`, `replace`) plays a change of icon or `slash` ([transitions](./engine.md#transitions-enginemorphmjs)); injects the motion stylesheet only if some icon animates |
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

## What goes into the repository and what doesn't
- **Committed:** `src/` (the drawings and the languages), `engine/`, `mcp/`, `scripts/`, `tests/`, `docs/`, `CLAUDE.md`, `DESIGN.md`, `README.md`, `README.es.md`, `LICENSE`, `package.json`.
- **Not committed** (`.gitignore`): `svg/`, `dist/`, `previews/`. Everything is regenerated.

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
