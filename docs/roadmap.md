# Roadmap

> Status as of 22 Oct 2026. When a subphase moves forward, mark it here and log it in [History](./history.md).

[← Index](./README.md)

**The v1 goal: 10,000 icons. Nothing is published before then.** Each round of ~1,000 takes about 3 hours of agents.

## Phase 0 · Foundations ✅
- [x] Geometry engine: continuous corners, keylines, the drop (`engine/geometry.mjs`).
- [x] Drawing rules (`DESIGN.md`), build, review sheets.
- [x] Core set of 50 icons (`src/icons/nucleo.mjs`), the set's benchmark.

## Phase 1 · The first ~1,000, complete (in progress)
- [x] 1.1 Base drawing and critique per category — round 1 closed: 993 icons (9 categories + the core set), 18 agents, 1 h 47 min; 268 QA warnings left for round 2.
- [x] 1.2 Extended format: fill, 16 px (`small` and pixel snapping), mirroring, levels, named parts, motion, 10 languages, `data-*` metadata, variants sheet, automated QA, and engine tests.
- [x] 1.3 Coverage audit: ~400 concepts reviewed, +40 common icons → 1,033.
- [x] 1.4 Per-icon design: fill, 16 px, variants, mirroring, levels, parts (`level`/`progress` on quantity icons), motion, and engine badges (9 agents).
- [x] 1.5 Languages: all 1,033 with labels in 10 languages and search keywords by meaning (10 agents).
- [x] 1.6 Full QA and fixes — engine fixed (badges in the package, enclosed fill, `wire`, 16 px badges, shared snapping, the `open` rule); fixes in all 10 categories: QA at zero warnings across the 1,033 icons (commit `b55f2d6`).
- [ ] 1.7 Owner's review of a sample, and course corrections.

## Phase 2 · Outputs, tested on those 1,000 (in progress)
It comes before scaling: a format change is cheap with 1,000 icons and very expensive with 10,000.
- [x] 2.1 Web animations: draw, bounce, replace (generic) and the icons' own effects (`ring`, `wiggle`, `spin`, `beat`, `slide`, `float`, `bounce`), levels with a value: engine (`render(icon, { animate })`), CSS (`engine/motion.css`), React, Vue, and Svelte (`effect`, `play`), checked frame by frame ([engine](./engine.md#motion)).
- [ ] 2.2 Transitions between icons, done differently ([decision 41](./decisions.md#phase-2-22-oct-2026)): every frame drawn by the engine; badge pairs found on their own (bell ↔ bell-off, file ↔ file-check: 30 in the set today) and the automatic slash on any icon; 20 curated morphs and 7 turns that passed the frame-by-frame sheet (`scripts/transitions-sheet.mjs`); the rest swap in. React, Vue, and Svelte play them (`transition`). **Left:** outline ↔ fill (the fill could rise like liquid, on brand), and more pairs as phase 3 adds icons.
- [ ] 2.3 ~30 icons with a live value (`--gota-value` with `@property`): download, loading, battery, volume, timer, thermometer. One color.
- [ ] 2.4 Continuous weight in the packages and `weight="auto"` (matches the text's weight): done in React, Vue, and Svelte (`autoWeight`). **Left:** a variable `.woff2` icon font with a weight axis (outlines compatible across masters), which needs strokes turned into outlines ([decision 46](./decisions.md#phase-2-22-oct-2026)).
- [ ] 2.5 React, Vue, Svelte, and Astro packages with per-icon imports; SVG sprite; Android Vector Drawables; Xcode custom symbols (Ultralight/Regular/Black × 3 sizes, used with `Image("name")`). Done: the four components, tested in a real browser; one module per icon (`@flouvia/gota/icons`, `BellIcon`) and one component per icon in React and Vue, tree-shaken down to the icons a page uses; the sprites (`sprite.svg`, `sprite-fill.svg`, and `sprite()`). **Left:** Android and Xcode (they need outlines, like the font).
- [ ] 2.6 Figma: a library or plugin with the variants as properties.
- [ ] 2.7 Search by meaning (es/en) and a remote MCP server at `gota.flouvia.com/mcp`. Done: search (`@flouvia/gota/search`) and the local MCP server (`mcp/server.mjs`, `gota-mcp`). **Left:** the remote server, which needs the owner's OK.
- [ ] 2.8 Migration map from Lucide, Heroicons, and SF Symbols, with a codemod.

## Phase 3 · Scaling to 10,000
- [ ] 3.1 Taxonomy for the remaining ~9,000 by domain (health, education, food, sports, tools, science, industry, home, animals, AI, transportation…), without repeating concepts.
- [ ] 3.2 Curated modifiers in the engine: badges with knockouts (+, −, ✓, ×, clock, lock, alert, star), directions, and levels.
- [ ] 3.3 Nine rounds of ~1,000: each agent delivers everything at once, with a critic, QA, and a sample for the owner.

## Phase 4 · Launching v1 (10,000)
- [ ] 4.1 A site to browse, search, and copy (SVG, JSX, Figma) at `gota.flouvia.com`.
- [ ] 4.2 GitHub with the source only; a GitHub Action that publishes the ZIP for each version; npm `@flouvia/gota`.
- [ ] 4.3 Zero QA warnings, the owner's full review, documentation, and announcement.
- [ ] 4.4 Commercial README in English, plus `README.es.md` in Spanish for Latin America (today's README files are a short placeholder).

## After v1
- "Gota on demand": a missing icon is drawn with the engine, passes QA and review, and joins the library in minutes.
- `flouvia-web` drops its own set (`src/components/icons.ts`) and consumes `@flouvia/gota`.
