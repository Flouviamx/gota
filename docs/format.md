# Icon format

> **Source of truth:** `src/icons/<category>.mjs` (the drawing and design data) and `src/i18n/<category>.json` (languages). Validation lives in `scripts/load.mjs`; how each field is drawn, in [`DESIGN.md`](../DESIGN.md).

[← Index](./README.md)

## Category file
```js
import { arc, circ, dot, drop, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

const icons = {
  bell: {
    tags: ['campana', 'avisos', 'notifications'],          // basic search (es + en), ≥ 2
    d: [body, clapper],                                     // strokes in DRAWING ORDER
    fill: { solid: [body, clapper] },                       // or false if it's only lines
    parts: { body: [0], clapper: [1] },                     // named parts → data-part
    motion: { effect: 'ring', origin: [12, 3.25] },         // its own gesture
  },
};
export default { category: 'comunicacion', label: 'Comunicación y personas', icons };
```
Strokes are computed with the engine (local constants and functions are allowed). `nucleo.mjs` is the reference: it defines `icons`, and at the end assigns `fill`, `parts`, `motion`, `mirror`, `levels`, and `variants` in blocks.

## Fields
| Field | Type | Required | What it is |
|---|---|---|---|
| `tags` | `string[]` (≥ 2) | yes | Basic search words, in Spanish and English |
| `d` | `string[]` | yes | Strokes (the `d` of each `path`), in drawing order, on the 24 canvas |
| `fill` | `{ solid, cut?, lines?, wire? }` or `false` | yes | Filled version from the same strokes: `solid` closed shapes only, `cut` knocked out, `lines` on top with clearance, `wire` on top and attached; `false` = lines only |
| `small` | `{ d, fill? }` | only when needed | Its own drawing for ≤ 18 px |
| `variants` | `{ circle?, square?, slash?: false }` | no | Turns off automatic variants that make no sense |
| `mirror` | `true` | directional icons | Flips in right-to-left languages |
| `levels` | `number[][]` (≥ 2) | quantity icons | Indices into `d` per level, from least to most |
| `value` | `{ draw?: string[], turn?: { parts, origin, from, to, at } }` | icons that show a value with their own pieces | Strokes drawn that far, parts turned from `from` to `to` degrees (drawn at `at`); see DESIGN.md › Levels and values |
| `parts` | `{ name: number[] }` | with `motion`, `levels`, `value`, or a badge | Named parts (English kebab-case) |
| `mark` | `true` | only Flouvia's marks in `marcas` | A brand mark traced from its owner's file: `render` draws its `fill.solid` as is, solid and without the weight's stroke, in every style and weight (`d` keeps its contours) |
| `badge` | `badge('plus')` or `{ d, knock, fill? }` | every badge | What goes on top with an automatic knockout: `d` is drawn, `knock` is the area cleared with a clearance of paper (1.5 at regular); it renders as `data-part="badge"` |
| `motion` | `{ effect, parts?, origin?, vector? }` | if it has its own gesture | `effect` ∈ `ring`, `wiggle`, `spin`, `beat`, `slide`, `float`, `bounce`; `parts` by name, index, or `'badge'` |

## Languages (`src/i18n/<category>.json`)
```json
{ "bell": { "label": { "es": "Campana", "en": "Bell", "pt": "…", "fr": "…", "de": "…", "it": "…", "ja": "…", "zh": "…", "ko": "…", "ar": "…" },
            "keywords": { "es": ["≥ 6 synonyms and uses"], "en": ["≥ 6"] } } }
```
Languages: `es`, `en`, `pt`, `fr`, `de`, `it`, `ja`, `zh`, `ko`, `ar` (`LANGS` in `scripts/load.mjs`). Every icon in the category must have its entry, and there can be no orphan entries.

## Validation (`scripts/load.mjs`)
- Names in kebab-case, unique across the whole set (a clash is reported to both categories).
- Strokes that start with `M` and use only SVG path commands.
- `fill.solid`/`cut`/`lines`/`wire`, `small.d`: lists of valid strokes.
- `levels` and `parts`: valid indices into `d`; `motion.parts`: names from `parts`, indices, or `'badge'`.
- `badge`: a valid `d` and a `knock` (a closed stroke).
- `motion.effect` within `MOTION`; `origin`/`vector` are `[x, y]`.
- `variants`: only `circle`/`square`/`slash`, set to `false`.
- Languages: all 10 `label`s and ≥ 6 `keywords` in es and en.
A category file that fails to load is reported without taking down the others (useful with agents working in parallel).
