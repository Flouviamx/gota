# Quality

> **Source of truth:** `scripts/qa.mjs`, `scripts/sheet.mjs`, `scripts/variants-sheet.mjs`, `scripts/transitions-sheet.mjs`, `tests/engine.test.mjs`, `tests/features.test.mjs`, `tests/outline.test.mjs`, and the check inside `scripts/outline.mjs`.

[← Index](./README.md)

## Review sheets (look at them, don't assume)
- **`sheet.mjs`** — 40 icons per page, drawn with the package's own `render` (badge included): each one at 96 px with keylines (circle r 9, square 17.5, landscape 19 × 14, portrait 14.5 × 18.5, and the area of 20), at 24 and 18 px, in a 36 px dark pill, and on a light background. It flags anything that leaves 1.75–22.25.
- **`variants-sheet.mjs`** — 30 per page: outline, fill, light, bold, circle, square, slash, and fill in a circle (at 32 and 18 px); **true 16 px** (rasterized at 1x on a canvas and enlarged without smoothing, as on a standard display); and, when the icon has them, mirror, levels at half, and the extreme frame of its motion. It marks what's missing in orange (`no fill`, `no languages`) and the effect or a `custom 16 px` drawing in blue.
- **`transitions-sheet.mjs`** — nine frames of each transition, drawn by the engine: every curated morph and turn, every badge pair (found on its own), and the automatic slash. A pair joins `PAIRS` only if every frame is clean; `--try "a>b c>d"` draws candidates before adding them.
- **`sheets.mjs`** — regenerates every sheet from scratch: it clears `previews/`, renders each category's drawing and variants sheets and the transitions sheet, and writes `previews/index.html` to browse them all (`npm run sheets`).

## Automated QA (`qa.mjs`)
It renders the whole set in Chrome and warns about:
| Warning | Rule |
|---|---|
| `area` | A stroke leaves 1.75–22.25 (measured with `getBBox`) |
| `dense` | More than 28 % ink at 32 px, measured without the badge (a solid disc is not "too many pieces"): it probably has too many pieces. A fixed threshold (it used to be the set's 98th percentile, and it shifted as the set grew) |
| `silhouette` | The fill changes the drawing's box by more than 1 px at 32 px |
| `double` | Two near-identical icons at 32 px (cosine similarity ≥ 0.975), except those of the same family (same first name segment, or one a prefix of the other) |
| `loose` | An open stroke shorter than 2 that isn't a dot: a fragment |
| `open` | An open stroke inside `fill.solid` (or inside the fill of `small` or of the badge): it would fill as a wedge |
| `near` | A stroke ends between 0.35 and 2.85 from another (center to center) without touching it: either touch, or leave 1.5 of clearance. It doesn't count if those two strokes cross or touch somewhere else |
| `weights` | The structure changes between weights 0.9 and 2.1, outline or fill: pieces that merge or split, a hole that opens or closes, or no clean interpolation. Checked with compatible masters ([build](./build.md#compatible-masters-scriptsmastersmjs)); the fixes are in the drawing ([`DESIGN.md`](../DESIGN.md#every-weight-one-structure)). `node scripts/weights-sheet.mjs <cat>` shows each flagged variant at the three weights with its contours (`<icon>…` for given icons, `--slash` for their slashed variants) |
Standalone lines are light by nature: there is no "too light" warning. The thresholds were tuned on the core set and round 1 (at first, 0.93 similarity and a warning for light icons: too much noise).

## Tests (`npm test`)
**Engine** (`tests/engine.test.mjs`), twenty-six tests: rounding; continuous corners and the signature; closing of `drop`, `circ`, and `roundpoly`; arrowhead length; `transform` (scaling, arcs, absolutes); `snap` to pixel centers; one color and round strokes; `data-part`/`data-level` and never `id`; levels with `value`; mirroring only on directional icons and `data-rtl`; the fill mask and the clearance of `lines`; continuous weight; `snap` without distorting circles; badges (mask, clearance, a dot removed entirely, fill knocked out); `cursor` closed and inside the canvas; shared snapping (tip with shaft); dots to a pixel corner; 16 px badges without a ring; enclosed fill with a badge; `wire`; a dot far from a diagonal badge; `sq` corners that fit their sides (no side runs backwards); status badges as solid discs in outline (a lens stays drawn); paper that thins as ink grows; cuts that keep meeting the silhouette; solid dots and the one-disc notification dot.

**Phase 2 features** (`tests/features.test.mjs`, they read `dist/`), twelve tests: search by meaning in Spanish and English; the ñ, accents, plurals, and empty words; partial matches; a leftover stroke never shrinks to a point; menu lines meet before they cross; how each pair is resolved (turns, badge pairs in any style, curated morphs only in outline); frames drawn by the engine, ending on the icon itself; the slash drawn part of the way and toggled by a component; `autoWeight`; one module per icon (same data as by name, `<Name>Icon` names, the drawn variant linked, `svg` equal to `toSvg`); the sprite (one symbol per icon, unique mask ids); the MCP server end to end.

**Outlines** (`tests/outline.test.mjs`, they need `npm ci`), three tests: every kind of variant matches its drawing; holes survive where two pieces only touch (the card chip); a cut-out enclosure keeps the drawing as holes. Every outline the build makes is checked the same way ([build](./build.md#outlines-scriptsoutlinemjs)).

## Gates
- No agent finishes with `build.mjs --check` failing.
- Every round closes with a full `qa.mjs` run and the sample for the owner.
- **Publishing** requires zero QA warnings, passing tests, and the owner's review of the full sheet.
