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
| `dist/index.js` + `index.d.ts` | Copied from `engine/index.mjs`: `icons`, `categories`, `render`, `WEIGHTS`, `autoWeight`, `effectOf`, `motionAttrs`, `resolveIcon`, and `toSvg(name, { variant, weight, enclosure, slash, size, rtl, value, animate, play })`; `IconName` is typed |
| `dist/geometry.js` · `dist/variants.js` | The engine, to draw any combination in the browser |
| `dist/react.js` + `react.d.ts` | Copied from `engine/react.mjs`: `<Icon name variant weight enclosure slash scale size value rtl effect play transition />`. By default it measures `1em` and drops `-0.125em`, like a letter; `scale` small 0.85 / medium 1 / large 1.25; masks with `useId`; `weight="auto"` reads the weight of the surrounding text (`autoWeight`); `transition` (`auto`, `morph`, `replace`) plays a change of `name` or `slash` ([transitions](./engine.md#transitions-enginemorphmjs)); injects the motion stylesheet only if some icon animates |
| `dist/vue.js` · `dist/Icon.svelte` | The same component for Vue 3 (`GotaIcon`) and Svelte, with the same props, `weight="auto"` and `transition` included |
| `dist/Icon.astro` | The same component for Astro, rendered on the server with no JavaScript: no `weight="auto"` or `transition`, and a page with `effect` imports `@flouvia/gota/motion.css` once |
| `dist/morph.js` + `morph.d.ts` | Copied from `engine/morph.mjs`: `transitionOf`, `frames`, `morpher`, `changeOf`, `playTransition`, `PAIRS`, `toCubics` |
| `dist/search.js` + `search.d.ts` · `dist/search-core.js` · `dist/search-data.js` | `searchIcons` (from `engine/search-api.mjs`), the search engine (copied from `engine/search.mjs`), and the generated index data: category, tags, labels, and keywords per icon |
| `dist/motion.css` · `dist/motion-css.js` | The animations from `engine/motion.css`, as a stylesheet and as text for the components to inject |
| `dist/icons.css` | `.fi`, `.fi-sm`, `.fi-lg` for icons next to text without React |
With `--check <category>` it only validates (agents use it while drawing).

**The hand-drawn variant wins:** if `<name>-circle`, `-square`, `-slash`, or `-off` exists as an icon of its own, the build doesn't generate the automatic one with that name, and `toSvg` and `<Icon>` use the drawn one (`resolveIcon`).

## What goes into the repository and what doesn't
- **Committed:** `src/` (the drawings and the languages), `engine/`, `mcp/`, `scripts/`, `tests/`, `docs/`, `CLAUDE.md`, `DESIGN.md`, `README.md`, `README.es.md`, `LICENSE`, `package.json`.
- **Not committed** (`.gitignore`): `svg/`, `dist/`, `previews/`. Everything is regenerated.

## Publishing (once there are 10,000)
- **npm:** `@flouvia/gota` with `dist/`, `svg/`, `mcp/`, `LICENSE`, `README.md`, and `README.es.md` (`files` in `package.json`). Exports: `.`, `./react`, `./vue`, `./svelte`, `./astro`, `./morph`, `./search`, `./svg/*`, `./icons.json`, `./icons.css`, `./motion.css`. React, Vue, and Svelte are optional peer dependencies; the package itself has none. Binary: `gota-mcp`.
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
