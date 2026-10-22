# History

> A log of what was done, how, and why. Newest first. Decisions and their reasons are in [Decisions](./decisions.md).

[← Index](./README.md)

## 22 Oct 2026 — Phase 2: transitions, components, search, and MCP
- **Transitions (2.2), rebuilt after reviewing them frame by frame.** The first engine grew strokes from a point (stray dots), folded menu lines into a ">", and pointed at icons that don't exist (`mic`, `check-check`). Now ([engine](./engine.md#transitions-enginemorphmjs)):
  - every frame is drawn by `render` (`frames`), masks and cutouts included;
  - badge pairs are found on their own and the badge draws in (slashes, second checks) or zooms in as a sharp miniature (`badge.zoom` in `render`), its cutout with it;
  - `render({ slash: 0–1 })` draws the automatic slash part of the way, so toggling `slash` animates on any icon;
  - strokes correspond segment by segment (same structure) or by length, lines turn, and what's left over is erased along its length;
  - `PAIRS`: 20 morphs and 7 turns; 10 pairs were tried and rejected ([decision 41](./decisions.md#phase-2-22-oct-2026));
  - `scripts/transitions-sheet.mjs` draws nine frames of each of the 58 transitions (part of `sheets.mjs`).
- **Components (2.5):** Vue 3 (`dist/vue.js`), Svelte (`dist/Icon.svelte`), and Astro (`dist/Icon.astro`, server-rendered) with the React API; `weight="auto"` (2.4) and `transition` in React, Vue, and Svelte, played by `playTransition` without touching the nodes the framework manages. Tested in Chrome with React 18, Vue 3.5, and Svelte 4 (bundled in a temporary folder outside the repo): morph, badge, automatic slash, and swap, with no errors.
- **Search by meaning (2.7):** `engine/search.mjs` and `@flouvia/gota/search` (`searchIcons`): names, labels in 10 languages, keywords, and tags, accent- and plural-insensitive, keeping the ñ.
- **Local MCP server (2.7):** `mcp/server.mjs` (`gota-mcp`), dependency-free: `search_icons`, `get_icon`, `list_categories`.
- **Package:** exports `./vue`, `./svelte`, `./astro`, `./morph`, and `./search`, with types for `morph` and `search`; `mcp/` and `README.es.md` ship in the package.
- **Tests:** 31 passing (21 engine, 10 features in `tests/features.test.mjs`).

## 22 Oct 2026 — Phase 1.6 closes, phase 2 begins, and the repo moves to English
- **1.6 fixes complete in all 10 categories:** the relaunched pass finished commerce, data, devices, places, navigation, and system (commit `b55f2d6`):
  - no open fills left anywhere in the set (closed, `lines`, or `wire`);
  - 16 px badges from the engine, with no local copies;
  - `small` only where it's needed;
  - QA at zero warnings across the 1,033 icons.
- **Sheets regenerated** with the new `scripts/sheets.mjs` (`npm run sheets`): it clears `previews/`, renders every category's drawing and variants sheets, and writes `previews/index.html` to browse them all.
- **Phase 2 begins with 2.1 (animations)**, in the same commit:
  - `render(icon, { animate })` groups the moving pieces with their pivot and displacement, and gives each visible stroke `pathLength="1"` and its drawing order;
  - `engine/motion.css`: ring, wiggle, spin, beat, slide, float, bounce, draw, levels, and replace, played on hover, once, or in a loop (`data-play`), and still under reduced motion;
  - React: `<Icon effect play transition>` (`transition="replace"` brings the new icon in with an entrance animation), injecting the motion stylesheet once, and only if some icon animates;
  - without React: `toSvg(name, { animate, play })`, which adds `motionAttrs()` to the `<svg>`.
- **Package reorganized:** the API and the component are now sources in `engine/index.mjs` and `engine/react.mjs` (the build copies them to `dist/index.js` and `dist/react.js`); the icon data goes into the generated `dist/data.js`; `motion.css` is exported (`@flouvia/gota/motion.css`).
- **The repo moves to English** ([decision 40](./decisions.md#repository-language-22-oct-2026)): docs, comments, scripts, and commit messages; `README.md` in English and `README.es.md` in Spanish; icon labels and search keywords stay multilingual. The rule lives in [`CLAUDE.md`](../CLAUDE.md#non-negotiable-rules). The QA warnings were renamed too: `área` → `area`, `denso` → `dense`, `silueta` → `silhouette`, `doble` → `double`, `suelto` → `loose`, `abierto` → `open`, `roza` → `near`.

## 22 Oct 2026 — Round 2 and phase 1.6
- **Round 2** (workflow `wf_72d40526-58d`: 20 agents, 0 errors, ~3 h 40 min, ~6.6 M tokens).
  - **Coverage:** ~400 concepts reviewed and +40 common ones (minus, sync, browser, ©, ®, ™, coffee, door, recycling…). Rejected, with a reason: ballot box, motorcycle, and ungroup.
  - **Design:** 834 icons with fill, 191 with a 16 px drawing, 142 with mirroring, 17 with levels, 366 with motion, and 700 with named parts; badges and pointers moved to the engine.
  - **Languages:** all 1,033 in 10 languages, plus the labels shared across categories.
  - QA at 0 warnings under the rules of the time. Commit `293849c`.
- **Engine bugs the agents found** (commit `e24342b`):
  - the package **didn't include the badges**;
  - the enclosed fill left them out;
  - at 16 px the ring badges clumped together, arrowheads drifted away from their shafts, and dots came out gray;
  - open strokes inside `solid` filled as wedges (the lock's shackle became a dome);
  - the drawing sheet didn't show badges, and the motion frame didn't move the badge.

  They were fixed with:
  - a complete export, and enclosed fill with badges;
  - the `wire` type;
  - `badge(kind, { size })` with the pixel version the categories designed, now in the engine, lock included;
  - `snapper` (one snap per icon) and dots to a pixel corner;
  - removing dots by actual distance;
  - a redrawn star, the drawing sheet using the render, and the `open` rule in QA.
  - 21 tests.
- **Per-category fixes:** the first pass (`wf_8337a449-604`) finished files, communication, and editing (commit `308464a`).
  - The other six didn't edit anything. The owner's last message was a question ("what are phases 2, 3, and 4?") and, out of caution, they understood that nobody had asked for changes.
  - **Lesson:** every agent assignment quotes the owner's explicit authorization. It was relaunched with his "keep going" (`wf_4ddb4532-a93`).

## 21 Oct 2026 — Gota is born

### In `flouvia-web` (where the set came from)
- The owner asks to remove the Lucide-style icons. First version: 50 icons generated with a Python script outside the repo (a 24 grid, a 1.5 stroke, the square-corner signature, and bubbles with the drop).
- On seeing it, he asks for "Apple level, genuinely designed drawings". Second version, redrawn from scratch:
  - continuous corners (a squircle with 0.6 smoothing, Figma's algorithm) instead of circular arcs;
  - fixed keylines;
  - metaphors built from geometry: pencil, paperclip, plane, phone, and key.
- He asks for "nothing translucent": the duotone is removed from the capability icons.
- The set is integrated into `src/components/icons.ts` (camelCase names), with `Icon.astro` for the site and `portal/Icon.tsx` for the portal and Ops. Commit `8c6892b` in `flouvia-web`.

### The `flouvia-icons` repo (future `gota`)
- **The owner's decisions:** its own repo, MIT license, and parallel agents.
- **Engine:** ported to JavaScript (`engine/geometry.mjs`), with `sq`, `circ`, `dot`, `drop`, `arc`, `head`, `roundpoly`, `line`, and `rot`.
- **Repo foundations:**
  - `DESIGN.md` with keylines, corners, signature, detail, names, and process;
  - `scripts/load.mjs` (loads and validates without failing because of one broken file) and `scripts/build.mjs`;
  - `scripts/sheet.mjs`: a sheet with keylines, sizes, pill, and light background;
  - the core set of 50 in `src/icons/nucleo.mjs`, in kebab-case.
- Commit `f9102e9`.
- **Drawing round 1:** 9 categories with an illustrator and a critic (see [Production](./production.md#round-1--base-drawing-21-oct-2026)). By around 20:50 the set already had ~1,000 icons and the critics were still reviewing. Workflow `wf_0024a5b2-d6e`.
- **SF Symbols-style variants** (`engine/variants.mjs`):
  - fill with masks (`solid`, `cut`, `lines` with 1.5 of clearance);
  - weights 1 / 1.5 / 2, and continuous;
  - circle, square with the signature, and slash with clearance;
  - the build generates the full matrix in `dist/svg/`, `react.js` (with `scale` and `1em`), and `icons.css`;
  - `scripts/chrome.mjs` and `scripts/variants-sheet.mjs`.
  - The core set gets its fills as an example.
- **Name:** Gota (`@flouvia/gota`). README, `DESIGN.md`, and package updated.
- **What gets committed:** `svg/` and `dist/` leave git; only the source goes into the repo.
- **The owner sets the goal:** a v1 of 10,000 icons, nothing published before then, and the site at `gota.flouvia.com`.
- **Extended format** so nothing has to be redone (everything from the first 1,000):
  - `small` and `snap` (pixel snapping at 16 px);
  - `mirror`, `levels`, `motion`, `parts` (names → `data-part`), and `data-level`;
  - `data-rtl="mirror"` on the `<svg>`;
  - `fill: false` for line-only icons;
  - languages in `src/i18n/` (10 languages and search keywords).
  - Validation in `load.mjs`, and the core set updated as an example.
- **The variants sheet now shows:** 16 px rasterized at 1x, mirror, levels at half, and the extreme frame of the motion.
- **Automated QA** (`scripts/qa.mjs`): area, density, fill silhouette, and near-duplicates, with tuned thresholds. It found `cloud-sun` outside the area, ~20 icons too dense, a forgotten test icon (`zz-bell-plus-top`), and near-identical pairs. They get fixed in round 2.
- **Engine tests:** `tests/engine.test.mjs`, 12 tests passing (`npm test`).
- **The owner's external analyses:** evaluated one by one ([decisions 22–37](./decisions.md)). Adopted: named parts, `data-*` metadata, icons with a live value, and `weight="auto"`; facts about competitors were corrected, and the "smart SVG" and color changes were rejected.
- **Documentation:** `CLAUDE.md` as the router and `docs/` by domain (this file, decisions, roadmap, format, engine, build, production, quality).
- **Details the owner pointed out.** The navigation pointer, the heart with a pulse, and the bubble with a lock revealed an underlying problem: hand-drawn pieces and hand cuts. It was solved in the system, not icon by icon:
  - `cursor()` in the engine: a nearly sharp tip, because a large radius at 45° made it blunt and tall;
  - standard `badge()` badges with an automatic 1.5 knockout;
  - dots a badge touches are removed entirely;
  - QA adds `loose` (fragments) and `near` (near-misses);
  - `snap` was fixed: it took a circle's closing segment as a line and distorted circles at 16 px;
  - 15 tests passing.
- **The core set reached zero QA warnings:** the clearance of the alert signs, the head at the back in the clients icon, the route that now touches its circles, the ticket's perforation (two dashes), the code brackets, the bell's clapper, the globe with just an equator, and the table with columns starting at the header.
- **Navigation:** `cursor`, `cursor-click` (sparkles with clearance), and `drag-drop` (the pointer as a badge) moved to the engine. The site's set in `flouvia-web` will get these changes when it consumes Gota.
- **Round 1 closed** (workflow `wf_0024a5b2-d6e`: 18 agents, 0 errors, 1 h 47 min, ~6.1 M subagent tokens): 993 icons.
  - The critics redesigned confusing metaphors (the paint bucket, the lasso, the quote) and removed concepts repeated across categories, with their replacements.
  - They brought every icon closer to the core set and got ahead with fills, mirroring, and motion in navigation.
  - They flagged clashes between automatic and drawn variants. It was solved with a rule: **the hand-drawn one wins** (`arrow-right-circle`, `bell-off`…), in the build, in `toSvg`, and in React (`resolveIcon`).
  - The QA density moved to a fixed 28 % threshold.
  - Pending for round 2: 268 warnings (most of them in commerce), fill in almost every category, languages, and labels shared across categories (reply, org chart, unlink).
