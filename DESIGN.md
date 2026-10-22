# Gota — design rules

A set that is genuinely drawn, not a variation on another library. Every icon is built with the
engine (`engine/geometry.mjs`) on top of these rules; if a rule gets in the way of a drawing, the
rule wins and the drawing is rethought. The 50 icons in `src/icons/nucleo.mjs` are the benchmark:
everything new must feel like it came from the same hand.

## Canvas and stroke
- **24 × 24** canvas. A live area of 20 (2–22): the *path* never leaves 1.75–22.25 (the review
  sheet flags it).
- **1.5 stroke**, centered, with **round** `stroke-linecap` and `stroke-linejoin`. One color: no
  fills, no opacity, no duotone, no gradients. Everything is a `path` with a `stroke`.
- Coordinates with at most two decimals; prefer quarter values (x.25, x.5, x.75).

## Keylines (so everything carries the same weight)
| Base shape | Path size |
|---|---|
| Circle | r 9 (center 12, 12) |
| Square | 17.5 × 17.5 (3.25–20.75) |
| Landscape | 19 × 14 (2.5–21.5 × 5–19) |
| Portrait | 14.5 × 18.5 (4.75–19.25 × 2.75–21.25) |
A triangular or pointed shape may reach 2.4–21.6 to compensate optically.

## Corners
- **Continuous**: `sq()` (a squircle with 0.6 smoothing), never a rectangle with circular arcs.
  Radius 4 on large containers (≥ 14 per side), 3–3.5 on medium ones, 2–2.25 on pieces of 7–8.
- Polygons (triangles, thick arrows, hexagons): `roundpoly()` with radii of 0.8–2.6.
- **The Flouvia signature:** containers (envelope, card, calendar, document, folder, briefcase,
  tray, lock, project box, windows, device screens) have a **square bottom-right** corner:
  `sq(..., { square: ['br'] })`, like the drop in the logomark. Speech bubbles are the drop
  itself: `drop()`. It does not apply to shapes that aren't containers (circles, arrows, people,
  organic objects).

## Detail
- **Dots**: `dot(x, y)` (r 0.7 → they read as ~2.9). In dense groups (the days of a calendar),
  r 0.3. Every dot in an icon is the same size.
- **Spacing**: two parallel strokes sit no closer than 3 center to center (1.5 of clearance).
  When one shape passes behind another, it is cut leaving a 1.5 gap (a knockout), never
  overlapped.
- **Arrows**: arms of 6 at 45° on straight arrows; 3.4 on arc arrows (`head()`, with the tangent
  from `arc()`).
- **Badges** (plus, minus, check, x, alert, info, clock, arrows, star, lock, notification dot):
  **always the engine's**, `badge: badge('plus')`, in the `badge` field (not in `d`). The engine
  clears the base with an exact 1.5 clearance and removes any dots it touches entirely. **Never
  trim the base by hand**: hand cuts leave round tips in arbitrary places, and fragments. A custom
  piece on top of another (the pointer over a frame) works the same way: `badge: { d, knock, fill }`.
  A **status badge** (any of the engine's, or a custom one on the same circle, r 4.25 at 17.25) is a
  **solid disc with its sign cut out, in every style**, as Apple's badges are: it reads at every
  weight and at 24 px. A custom piece that isn't a status (a lens, a second card) keeps the
  icon's style. At 16 px the standard badges switch on their own to their pixel version (no
  disc, a larger sign): don't copy `badge16` into the categories.
- **Pointer:** always the engine's `cursor(tip, scale)`; never a hand-drawn one.
- **No fragments or near-misses:** no open stroke shorter than 2; a stroke that ends next to
  another either touches it or leaves 1.5 of clearance (3 center to center). QA flags them
  (`loose`, `near`).
- Few pieces: it has to read at 18 px. If it needs more than ~6 strokes, simplify.
- No text or drawn letters unless the letter is the concept (e.g. `a-letter`).

## Fill
Every icon that has a body carries its filled version in `fill`, made from **its own strokes**
(the silhouette is never redrawn: fill and outline must match to the pixel):
- `solid`: the shapes that get filled (they also keep their stroke, so the silhouette is identical).
- `cut`: the details that sit inside the fill and are **knocked out** at stroke width (a
  document's lines, the envelope flap, the clock hands, a badge's sign).
- `lines`: open strokes that stay lines and are separated from the fill by **1.5 of clearance**
  (the calendar rings, the briefcase handle, the person at the back of a group).
- `wire`: open strokes that stay lines, **attached** to the fill with no clearance (the lock's
  shackle, the pushpin's needle, a route line, the bars of a set of sliders).
- `solid` takes **only closed shapes** (ending in `Z`): an open stroke would fill as a wedge. If
  what gets filled is an open stroke from the outline (the crescent of a clapper, the body of a
  cylinder), pass it closed: `${stroke}Z`. QA flags it as `open`.
- Badges on an object (plus, check, x, clock in the corner): the badge's circle goes in `solid`
  and its sign in `cut`.
- Icons made only of open lines (arrows, chevrons, check, plus, x, waves) take
  **`fill: false`**: their filled version is the same outline.
- Full examples: the `FILL` block at the end of `src/icons/nucleo.mjs`.

## Automatic variants
Without redrawing anything, the build derives from each icon: the **light (1)**, **regular
(1.5)**, and **bold (2)** weights; the **circle** (r 9, the drawing at 58 %), **square** (with
the drop's corner, at 60 %), and **slash** versions (with 1.5 of clearance on each side of the
slash); and their combinations with the fill. Turn them off with
`variants: { circle: false, square: false, slash: false }`:
- `circle`/`square: false` when the icon already comes enclosed (`*-circle`, `*-square`, a
  clock, a globe) or when it stops reading at 58 %.
- `slash: false` on standalone lines (arrows, chevrons, check, x, plus, dots) and when a
  hand-drawn `-off` version already exists.
Review them with `node scripts/variants-sheet.mjs <category>`.

## Every weight, one structure
Gota's weights run continuously from **0.9 to 2.1** (the variable font and Xcode symbols interpolate
between masters at 0.9, 1.5, and 2.1; `weight="auto"` maps text weights 100–700 onto that range).
An icon must keep **the same structure at every weight**: the same pieces, the same holes, nothing
that merges or splits as the stroke widens. The engine takes care of what it can:
- **Badges:** a status badge is a solid disc, so its sign (cut out, paper) never clogs a ring.
- **Fill:** what is cut out is paper, and paper thins as the ink grows (1.75 at light, 1.5 at
  regular, 1.25 at bold).
- **Cuts that reach the silhouette** (a stripe, a separator, a meridian) keep the relation to the
  edge they have at regular: they follow the ink's width instead of thinning.
- **Dots** are solid discs at every weight, in ink and in cuts.

What the drawing must take care of:
- **Pieces either cross or stand apart:** two strokes that don't cross keep at least the 2.85
  center to center that QA's `near` asks for, so they don't merge at 2.1 (the gap shrinks by 0.6).
- **A cut either goes through or stops short, clearly:** a cut that ends on an edge another piece
  shares (a clipboard's clip on its board) separates at some weights and not at others; end it
  well past the edge, or ≥ 0.6 inside it.
- **Small holes between crossing strokes** (an atom's orbits, a gear's teeth) close up at heavy
  weights: give them room, or let them be ink at every weight.
`node scripts/qa.mjs` reports the icons whose structure changes with the weight (`weights`).

## 16 px
At 16 px the 1.5 stroke measures 1 px, and the build **snaps** every drawing **to the pixel grid**
(straight segments land on pixel centers). If an icon still doesn't read (too much detail, pieces
that run together), it gets its own simplified drawing in `small: { d, fill }`, with the same
rules and **fewer pieces**: drop secondary details, merge what clumps together, and leave at
least 1.5 (1 px) of clearance. Check the "16 px (1x)" column of the variants sheet: it's what a
standard display shows, pixel by pixel.

## Mirroring (right to left)
`mirror: true` on anything with a reading direction: side arrows and chevrons, forward or back,
reply, send, undo or redo, indented lists, speakers, pencils, charts that grow. **Not** flipped:
clocks and anything that turns clockwise, check, signs and numbers, logos, symmetrical objects,
or anything that depicts a physical object with a fixed side.

## Levels
Icons that express a quantity (wifi, signal, battery, volume, intensity) mark their levels:
`levels: [[indices in d of the first], [of the second], …]`, from least to most. Given a value
from 0 to 1, the levels it reaches light up (wifi at half = half of its arcs).

## Motion
Every icon can **draw itself**, **bounce**, and be **replaced** by another with no extra data.
Icons with a gesture of their own declare it in `motion`:
| `effect` | What it does | Examples | Data |
|---|---|---|---|
| `ring` | swings from a pivot, like something ringing | bell, phone | `origin` (where it hangs) |
| `wiggle` | rocks slightly | alert, key, pencil | `origin` |
| `spin` | rotates | refresh, loading, gear, clock hands | `origin`, `parts` |
| `beat` | pulses (grows and settles back) | heart, lightning bolt | `origin` |
| `slide` | moves in its own direction | arrows, send, log out | `vector` |
| `float` | floats | cloud, balloon | `vector` |
| `bounce` | hops to one side | pin, download | `vector` |
`parts` are the pieces that move, by name or by index in `d` (otherwise, the whole icon); `origin`
is the pivot on the 24 canvas; `vector` is the displacement. The order of `d` is the **drawing
order** (from the main shape to the details): that's how it animates when it draws itself. The
sheet shows the extreme frame of the motion to check the pieces and the pivot.

## Named parts
Anything that animates, changes state, or is a badge gets a name in `parts: { name: [indices in
d] }`, in English kebab-case and from the set's shared vocabulary: `body`, `badge`, `mark` (the
sign of a badge or alert), `clapper`, `hands`, `needle`, `lid`, `handle`, `shackle`, `screen`,
`wave`, `arrow`, `level`… Required on every icon with `motion`, `levels`, or a badge; on the
rest, whenever there are pieces with a meaning of their own. In the generated SVG each stroke
carries its `data-part` (and `data-level` if it's a level), and the `<svg>` of directional icons
carries `data-rtl="mirror"`. Never `id`: ids collide when there are several icons on a page.

## Languages and search
Each category has `src/i18n/<category>.json`:
`{ "name": { "label": { "es", "en", "pt", "fr", "de", "it", "ja", "zh", "ko", "ar" },
"keywords": { "es": [≥6], "en": [≥6] } } }`.
- `label`: the accessibility label, short and natural in each language ("Campana", "Bell"…),
  capitalized where the language does so.
- `keywords`: synonyms and **uses**, to search by meaning: what the icon is and what it's used
  for ("cobrar" / "charge" finds wallet, invoice, and terminal). Don't repeat the name or pad
  the list.

## Names and tags
- Names in **English kebab-case**, object first and variant after: `file-plus`,
  `arrow-up-right`, `bell-off`, `cloud-download`. Unique across the whole set.
- `tags`: at least three words, in Spanish and English, for search.

## Process
1. Draw in batches of ~20 in `src/icons/<category>.mjs` with the engine's functions.
2. `node scripts/build.mjs --check <category>` (names, tags, strokes).
3. `node scripts/sheet.mjs <category>` and **look at every page** in `previews/`: weight,
   alignment with the keylines, legibility at 18 px, on dark and on light.
4. `node scripts/variants-sheet.mjs <category>`: fill, weights, circle, square, slash, true
   16 px, mirror, levels, and motion.
5. `node scripts/qa.mjs <category>`: outside the area, too dense, fill that changes the
   silhouette, and near-duplicates against the whole set.
6. Fix and repeat until every icon looks like it came from the same hand as the core set.
