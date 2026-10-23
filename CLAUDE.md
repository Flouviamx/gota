# Gota — operating guide

`CLAUDE.md` is the repository's router: what Gota is, the non-negotiable rules, commands, structure, and which document to read before editing. The details live in [`docs/`](./docs/README.md) and in [`DESIGN.md`](./DESIGN.md) (the drawing rules); they are not copied anywhere else.

## What it is
Gota is Flouvia's icon library (`@flouvia/gota`, MIT license): drawn by hand with its own geometry engine, with continuous corners, a single-color 1.5 stroke, and a signature — containers have a square bottom-right corner, like the drop in Flouvia's logomark, and speech bubbles are the drop itself (*gota* is Spanish for "drop"). It was born on 21 Oct 2026 from the `flouvia-web` set ([history](./docs/history.md)).

**The v1 goal: 10,000 icons, and nothing is published before then** ([phased plan](./docs/roadmap.md)). The public site will live at `gota.flouvia.com`.

## Required first steps
1. `git status --short`: preserve other people's work (agents or parallel sessions may be editing `src/icons/`).
2. Read [`docs/README.md`](./docs/README.md) and open the documents its matrix calls for; to draw, always [`DESIGN.md`](./DESIGN.md) and the core set (`src/icons/nucleo.mjs` and its sheets).
3. Check the status in [`docs/roadmap.md`](./docs/roadmap.md) and the decisions already made in [`docs/decisions.md`](./docs/decisions.md) before proposing anything: a rejected idea is not reopened without a new reason.

When you finish: the work goes into local commits and gets an entry in [`docs/history.md`](./docs/history.md). There is no remote yet: creating the GitHub repo and publishing to npm require the owner's OK.

## Commands
```bash
node scripts/build.mjs                    # validates everything and generates svg/, svg/fill/ and dist/ (the full matrix)
node scripts/build.mjs --check <cat>      # validates one category (writes nothing)
node scripts/sheet.mjs <cat|all>          # drawing sheet: 96 px with keylines, 24, 18, pill and light background
node scripts/variants-sheet.mjs <cat|all> # variants sheet: fill, weights, circle, square, slash, true 16 px, mirror, levels, motion
node scripts/transitions-sheet.mjs        # nine frames of every transition (--try "a>b" for candidates)
node scripts/sheets.mjs                   # regenerates every sheet from scratch and writes previews/index.html
node scripts/qa.mjs [cat]                 # automated QA: area, density, fill silhouette, near-duplicates, weights
node scripts/weights-sheet.mjs <cat> [--all] | <icon>… [--slash] # 0.9 · 1.5 · 2.1, outline and fill, with each weight's contours (a category: what QA's weights flags)
npm test                                  # engine and feature tests (node:test; features read dist/)
node mcp/server.mjs                       # the MCP server over stdio (after the build)
node scripts/native.mjs android           # Android vector drawables from checked outlines (after the build; npm ci first)
node scripts/native.mjs xcode             # Xcode custom symbols: variable templates, compiled by actool and drawn by AppKit (macOS)
node scripts/font.mjs                     # icon fonts: variable and static, outline and fill, with ligatures, every glyph checked (after the build)
```
Node ≥ 22. The system's Chrome renders the sheets (`CHROME` for a different path). One dev dependency, `canvaskit-wasm` (Skia), turns icons into outlines for the native formats: `npm ci` before those and before `npm test`. The published package has no dependencies.

## Non-negotiable rules
- **Apple-level quality, genuinely designed:** nothing copied from Lucide, Feather, Heroicons, Tabler, Phosphor, or SF Symbols; every metaphor is built with the engine.
- **One color:** no opacity, duotone, gradients, or color changes in any variant.
- **The signature** (square bottom-right corner on containers, `drop()` for bubbles) and the keylines from [`DESIGN.md`](./DESIGN.md) on every icon.
- **Data, not files:** each icon is a definition in `src/icons/<category>.mjs`; every SVG, package, and sheet is generated. `svg/`, `dist/`, and `previews/` never go into the repo.
- **No clutter:** no test icons, temporary files, or one-off scripts in the repo.
- **Nothing is published before 10,000**, and publishing requires zero QA warnings and the owner's review.
- Icon names in English kebab-case.
- All repository text is in English (docs, comments, scripts, commit messages); icon labels and search keywords stay multilingual (src/i18n, tags). The owner is addressed in Spanish in conversation.

## Structure
```text
engine/geometry.mjs   Drawing primitives: sq (squircle), circ, dot, drop, arc, polar, head, roundpoly, line, rot, cursor, badge.
engine/variants.mjs   Variants without redrawing: render, snap (16 px), transform, enclosures, slash, mirror, levels, motion.
engine/core.mjs       The API without icon data (dist/core.js): svg, pick (the drawn variant wins), sprite, autoWeight.
engine/index.mjs      The package API (dist/index.js): the core plus the set by name (iconData, toSvg, resolveIcon).
engine/react-base.mjs IconBase on an icon's data: weight="auto", effect, play, transition. react.mjs: <Icon> by name.
engine/vue-base.mjs · vue.mjs · IconBase.svelte · Icon.svelte · Icon.astro   The same for Vue, Svelte, and Astro.
engine/motion.css     Animations: the effects, draw, levels, replace, and reduced motion.
engine/morph.mjs      Transitions between icons: frames drawn by render, badge pairs, curated PAIRS, the player.
engine/search.mjs     Search by meaning (search-api.mjs: searchIcons for dist/search.js).
mcp/server.mjs        MCP server for AI agents (stdio, no dependencies): search_icons, get_icon, list_categories.
src/icons/*.mjs       One category per file: { category, label, icons: { name: definition } }. Source of truth.
src/i18n/*.json       Labels in 10 languages and search keywords (es/en) for each category.
scripts/              load (loads and validates), build, sheet, variants-sheet, transitions-sheet, sheets, qa, outline (icons as checked filled shapes, Skia), masters (compatible masters across weights), native (Android…), chrome (headless Chrome).
tests/                Engine tests, phase 2 feature tests, and outline tests.
DESIGN.md             Drawing rules (read by every agent that draws).
```

## Documentation
| Topic | Document |
|---|---|
| Drawing rules, keylines, signature, fill, 16 px, mirroring, levels, motion, parts, languages | [`DESIGN.md`](./DESIGN.md) |
| An icon's data format and its validation | [`docs/format.md`](./docs/format.md) |
| Geometry and variants engine | [`docs/engine.md`](./docs/engine.md) |
| Build, outputs, package, and what gets committed | [`docs/build.md`](./docs/build.md) |
| Production with agents: rounds, categories, prompts, sheets | [`docs/production.md`](./docs/production.md) |
| Quality: automated QA, tests, and review gates | [`docs/quality.md`](./docs/quality.md) |
| Phases and subphases, status, and what's next | [`docs/roadmap.md`](./docs/roadmap.md) |
| Proposals and decisions (yes, no, differently, and why) | [`docs/decisions.md`](./docs/decisions.md) |
| Log: what was done, how, and when | [`docs/history.md`](./docs/history.md) |
