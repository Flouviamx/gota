# Roadmap

> Status as of 23 Oct 2026. When a subphase moves forward, mark it here and log it in [History](./history.md).

[← Index](./README.md)

**The v1 goal: 10,000 icons.** The source is public on GitHub since 23 Oct 2026, without promotion ([decision 78](./decisions.md#outputs-23-oct-2026)); npm, the release ZIP, and the announcement wait for v1. Each round of ~1,000 takes about 3 hours of agents.

## Phase 0 · Foundations ✅
- [x] Geometry engine: continuous corners, keylines, the drop (`engine/geometry.mjs`).
- [x] Drawing rules (`DESIGN.md`), build, review sheets.
- [x] Core set of 50 icons (`src/icons/nucleo.mjs`), the set's benchmark.

## Phase 1 · The first ~1,000, complete ✅
- [x] 1.1 Base drawing and critique per category — round 1 closed: 993 icons (9 categories + the core set), 18 agents, 1 h 47 min; 268 QA warnings left for round 2.
- [x] 1.2 Extended format: fill, 16 px (`small` and pixel snapping), mirroring, levels, named parts, motion, 10 languages, `data-*` metadata, variants sheet, automated QA, and engine tests.
- [x] 1.3 Coverage audit: ~400 concepts reviewed, +40 common icons → 1,033.
- [x] 1.4 Per-icon design: fill, 16 px, variants, mirroring, levels, parts (`level`/`progress` on quantity icons), motion, and engine badges (9 agents).
- [x] 1.5 Languages: all 1,033 with labels in 10 languages and search keywords by meaning (10 agents).
- [x] 1.6 Full QA and fixes — engine fixed (badges in the package, enclosed fill, `wire`, 16 px badges, shared snapping, the `open` rule); fixes in all 10 categories: QA at zero warnings across the 1,033 icons (commit `b55f2d6`).
- [x] 1.7 Owner's review of a sample, and course corrections — the 53 icons redrawn while the weights were unified (102 variants, before and after) and the scale of weights, approved by the owner on 23 Oct 2026.

## Phase 2 · Outputs, tested on those 1,000 ✅
It comes before scaling: a format change is cheap with 1,000 icons and very expensive with 10,000.
- [x] 2.1 Web animations: draw, bounce, replace (generic) and the icons' own effects (`ring`, `wiggle`, `spin`, `beat`, `slide`, `float`, `bounce`), levels with a value: engine (`render(icon, { animate })`), CSS (`engine/motion.css`), React, Vue, and Svelte (`effect`, `play`), checked frame by frame ([engine](./engine.md#motion)).
- [x] 2.2 Transitions between icons, done differently ([decision 41](./decisions.md#phase-2-22-oct-2026)): every frame drawn by the engine; badge pairs found on their own (bell ↔ bell-off, file ↔ file-check: 30 in the set today) and the automatic slash on any icon; 20 curated morphs and 7 turns that passed the frame-by-frame sheet (`scripts/transitions-sheet.mjs`); the rest swap in. React, Vue, and Svelte play them (`transition`). Outline ↔ fill: the fill rises like a liquid (`liquid`, [decision 74](./decisions.md#outputs-23-oct-2026)), played when a component's `variant` changes. More pairs come as phase 3 adds icons.
- [x] 2.3 Icons with a live value (`--gota-value` with `@property`), one color: the 20 with levels (wifi, signal, battery, volume, sun…), plus strokes drawn that far (timer, loader) and parts that turn (gauge, stopwatch, compass, navigation, the timer's hand). A progress bar and a liquid's level need drawings of their own first.
- [x] 2.4 Continuous weight in the packages and `weight="auto"` (matches the text's weight), in React, Vue, and Svelte (`autoWeight`), and the icon fonts (`scripts/font.mjs`): variable, a weight axis from 300 (light) to 700 (bold), outline and fill, plus static ones, with ligatures and stable codepoints; every glyph checked. Compatible masters for 99.4 % of the variants; the last 12 keep their regular drawing in the variable font (masters work).
- [x] 2.5 React, Vue, Svelte, and Astro packages with per-icon imports; SVG sprite; Android Vector Drawables; Xcode custom symbols (Ultralight/Regular/Black × 3 sizes, used with `Image("name")`). Done: the four components, tested in a real browser; one module per icon (`@flouvia/gota/icons`, `BellIcon`) and one component per icon in React and Vue, tree-shaken down to the icons a page uses; the sprites (`sprite.svg`, `sprite-fill.svg`, and `sprite()`). Android vector drawables too (`scripts/native.mjs android`, every outline checked), and Xcode custom symbols (`scripts/native.mjs xcode`): a variable template per icon and style, compiled by `actool` and drawn by AppKit.
- [x] 2.6 Figma: a library or plugin with the variants as properties: `node scripts/native.mjs figma`, a development plugin that builds the library in the open file (a component set per icon, Style × Weight, every outline checked) and updates it in place, with its cover ([build](./build.md#native-formats-node-scriptsnativemjs-format), [decision 73](./decisions.md#outputs-23-oct-2026)). The owner built the library in Figma on 23 Oct 2026; a team library needs a paid plan, and the Community file waits for v1.
- [x] 2.7 Search by meaning (es/en) and a remote MCP server at `gota.flouvia.com/mcp`: search (`@flouvia/gota/search`), the local MCP server (`mcp/server.mjs`, `gota-mcp`), and the remote one (`api/mcp.mjs`, Streamable HTTP on Vercel, with the owner's OK; [decision 71](./decisions.md#outputs-23-oct-2026)), both on the same tools (`mcp/handler.mjs`).
- [x] 2.8 Migration map from Lucide, Heroicons, and SF Symbols, with a codemod: the maps (`src/migrate/`: Lucide 973 of 1,903, Heroicons 285 of 324, SF Symbols 1,814 of 8,091 names), `@flouvia/gota/migrate`, the `gota-migrate` codemod (React, Vue, Astro, Swift), and `find_equivalent` in the MCP server ([build](./build.md#migration-srcmigrate-flouviagotamigrate-gota-migrate), [decision 75](./decisions.md#outputs-23-oct-2026)). The maps grow with the set.

## Phase 3 · Scaling to 10,000
- [x] 3.1 Taxonomy for the remaining ~9,000 by domain (health, education, food, sports, tools, science, industry, home, animals, AI, transportation…), without repeating concepts: 81 categories in 11 domains, nine rounds, and the names stage that keeps concepts from repeating ([taxonomy](./taxonomy.md), `src/taxonomy.json`, [decision 80](./decisions.md#phase-3-23-oct-2026)).
- [x] 3.2 Curated modifiers in the engine: badges with knockouts (+, −, ✓, ×, clock, lock, alert, star), directions, and levels. Those badges and levels (`levels`, `value`) were already there; 3.2 moved into the engine the badges four categories drew by hand (`question`, `block`, `arrow-left`, and the glyphs `search`, `heart`, `sync`, `edit`, `gear`, each with its 16 px version) and added the directions (`turn`, `turnPath`, `flipPath`) ([engine](./engine.md#geometry-enginegeometrymjs), [decision 79](./decisions.md#phase-3-23-oct-2026)).
- [ ] 3.3 Nine rounds of ~1,000: each agent delivers everything at once, with a critic, QA, and a sample for the owner. Round 3 ✅ (24 Oct 2026, 903 icons: 1,936 in all).

## Phase 4 · Launching v1 (10,000)
- [ ] 4.1 A site to browse, search, and copy (SVG, JSX, Figma) at `gota.flouvia.com`. Being built in `flouvia-web` by the site's session, at the owner's request (23 Oct 2026): the page, the explorer (`/icons`), a guide, a showcase, and the license, English at the root and Spanish under `/es`, served at `gota.flouvia.com` through this project ([decision 72](./decisions.md#outputs-23-oct-2026)). Not in production yet.
- [ ] 4.2 GitHub with the source only (public at `github.com/Flouviamx/gota` since 23 Oct 2026, unannounced); a GitHub Action that publishes the ZIP for each version; npm `@flouvia/gota`.
- [ ] 4.3 Zero QA warnings, the owner's full review, documentation, and announcement.
- [ ] 4.4 Commercial README in English, plus `README.es.md` in Spanish for Latin America (today's README files are a short placeholder).

## After v1
- "Gota on demand": a missing icon is drawn with the engine, passes QA and review, and joins the library in minutes.
- `flouvia-web` drops its own set (`src/components/icons.ts`) and consumes `@flouvia/gota`.
