# Engine

> **Source of truth:** `engine/geometry.mjs`, `engine/variants.mjs`, `engine/morph.mjs`, and `engine/search.mjs`. Tests in `tests/engine.test.mjs` and `tests/features.test.mjs`.

[← Index](./README.md)

## Geometry (`engine/geometry.mjs`)
Everything works on the 24 canvas and returns a path's `d` with at most two decimals (`f`).
| Function | What it draws |
|---|---|
| `sq(x, y, w, h, r, { square, smoothing })` | A rectangle with **continuous corners** (Figma's corner smoothing algorithm, 0.6 smoothing). `square: ['br']` = the signature. Each corner fits its sides: along a side it takes at most half (all of it next to a square corner); when the smoothed corner doesn't fit, the smoothing gives way first and then the radius, as in Figma, so a side never runs backwards (r ≤ min(w, h) / 3.2 keeps the full smoothing) |
| `circ(cx, cy, r)` · `dot(x, y, r = 0.7)` | A circle; a dot that reads as solid with the 1.5 stroke |
| `drop(cx, cy, r)` | The drop from the logomark: a circle with a square bottom-right corner |
| `arc(cx, cy, r, a0, a1)` | An arc in degrees (clockwise if a1 > a0); returns `{ d, end, tangent }` |
| `head(tip, dir, len = 6, spread = 45)` | An arrowhead (6 on straight arrows, 3.4 on arcs) |
| `roundpoly(pts, radius)` | A polygon with rounded corners (one radius per corner, or a single one) |
| `polar`, `line`, `rot` | A point on a circle, a line through points, a point's rotation |
| `cursor(tip, s)` | The set's pointer: a nearly sharp tip, a vertical edge, a 45° diagonal, a well-proportioned tail (it keeps 0.8 of clearance inside when scaled down). Every pointer comes from here |
| `badge(kind, { size })` | Standard badges `{ kind, d, knock, fill }` (with `size` ≤ 18, their pixel version: no ring, a larger sign; the lock, on the pixel grid): in a circle at the bottom right (center 17.25, r 4.25) `plus`, `minus`, `check`, `x`, `alert`, `info`, `clock`, `arrow-up`, `arrow-down`, `arrow-right`, `star`; `lock` without a circle; `dot` (notification) at the top right |

## Variants (`engine/variants.mjs`)
`render(icon, options)` returns the contents of an `<svg viewBox="0 0 24 24">`; `svgFile(inner, icon)` wraps it (and adds `data-rtl="mirror"` if the icon is directional).
| Option | Effect |
|---|---|
| `style: 'outline' \| 'fill'` | The fill uses a mask: `solid` filled and stroked (same silhouette), `cut` knocked out at stroke width, `lines` on top with a clearance of paper (a stroke halo of weight + 2 × paper: 4.5 at every weight), `wire` on top with no clearance |
| `weight` | **Continuous** weight (the named ones: `WEIGHTS` = light 1, regular 1.5, bold 2) |
| `enclosure: 'circle' \| 'square'` | Enclosure: a circle of r 9 with the drawing at 58 %, or a square with the signature at 60 %. With `fill`, the container is solid and the drawing knocked out (the badge too; the base is not knocked out inside the badge's cutout) |
| `slash` | A slash from (3.6, 3.6) to (20.4, 20.4) with a clearance of paper on each side (a stroke mask of weight + 2 × paper: 4.5 at every weight). As a number 0–1, drawn that far from the top left, its cutout with it (transitions) |
| `size` | ≤ 18: uses `small` if it exists; otherwise, **pixel snapping** (`snap`) |
| `rtl` | Flips (`matrix(-1 0 0 1 24 0)`) only if `icon.mirror` |
| `value` (0–1) | With `levels`, hides the levels it doesn't reach |
| `frame` | Draws the extreme frame of the `motion` (review sheets) |
| `animate` | Prepares the SVG for `engine/motion.css`: the effect from `effectOf()` (`'auto'` = the icon's own gesture, otherwise its levels, otherwise a bounce); the moving pieces go in a `.gota-m` group with their pivot and displacement, and each visible stroke gets `pathLength="1"` and its drawing order. Not applied with an enclosure |
| `id` | Prefix for the masks; unique per SVG on the page |
Every stroke comes out with `data-part` (from `parts`) and `data-level` (from `levels`, starting at 1). Never `id` on the strokes.

### Badges
With `icon.badge`, the base (outline or fill) goes under a mask that clears the `knock`, filled and with a stroke of weight + 2 × paper (a clearance of paper on each side of the badge's edge: 1.5 at regular, 1.25 at bold); then the badge is drawn (`data-part="badge"`); in fill, its solid shape with its sign knocked out. The base's dots (circles with r < 1) that touch that area are removed entirely, measured by actual distance to the shape (not by its bounding box). At ≤ 18 px a standard badge (`kind`) switches to its pixel version; a custom one is snapped to the pixel grid. It works with enclosures, fill, slash, weights, and 16 px. A badge with `zoom: [scale, cx, cy]` (set by transitions) is scaled as a whole around that point: its strokes, its fill mask, and its cutout, and the dots it would remove are measured against the scaled cutout.

### Weights (rules that hold from 0.9 to 2.1)
The stroke is continuous, and these rules keep an icon's structure at every weight ([`DESIGN.md`](../DESIGN.md#every-weight-one-structure)):
- **Status badges are solid:** a standard badge, or a custom one on the standard circle (r 4.25 at 17.25), is drawn as in the fill style in every style: a solid disc (or the padlock's solid body) with its sign cut out as paper ([decision 58](./decisions.md#weights-22-oct-2026)). Any other badge (a lens, a second card, a sun behind a cloud) keeps the icon's style. At ≤ 18 px the standard badges are their pixel version, sign only.
- **Ink against paper:** what a fill, a status badge, or a filled enclosure cuts out (a fill's `cut`, a badge's sign, the drawing inside a filled enclosure) is drawn `paper = max(0.75, 1.5 + (1.5 − w) / 2)` wide: 1.75 at light, 1.5 at regular, 1.25 at bold. Paper thins as ink grows, like a letter's counters; before, a bold fill read lighter than a regular one.
- **Cuts at the silhouette keep their relation to it** (`edgeCut`): a fill cut that comes within 0.75 of a solid's outline anywhere (a stripe, a separator, a meridian) is drawn `w − 0.1` wide, following the ink instead of the paper, so what touches the edge at regular keeps a 0.05 rim at every weight and what runs past it still runs past. Interior cuts (dots, signs, details) are paper.
- **Dots are discs:** a circle of radius 1 or less (measured at the drawing's own size, before an enclosure shrinks it) is drawn as the disc its stroke covers, radius `r + w/2`, filled and unstroked, in ink and in cuts (`black`); the notification badge (`dot`) is one disc. Chrome (Skia) draws a circle narrower than its stroke wrong: hollow in the middle and too small (r 0.3 at stroke 1.5 measured 1.2 wide instead of 2.1, r 0.7 hollow), so the set's dots never looked as designed in a browser; and a stroke alone opens a dot into a ring at light weights.

### Pixel snapping (`snap`, `snapper`)
Snapping is **one per icon** (`snapper(strokes)`): the coordinates to move come from all of its strokes, and every stroke moves the same way, so an arrow's head stays with its shaft. Dots go to a pixel corner with r 1 (2 × 2 crisp pixels). At 16 px the 1.5 stroke measures 1 px, and pixel centers fall at 0.75 + 1.5k on the 24 canvas. `snap` converts the path to absolute (`transform` with no scaling), detects straight horizontal and vertical segments (0.06 tolerance; zero-length ones, like a circle's closing segment, don't count), and moves them to the nearest pixel center; each point moves with its endpoint, and a curve's control points move with the endpoint they touch, so continuous corners come along.

### `transform(d, s, tx, ty)`
A custom path parser (M L H V C S Q T A Z, absolute and relative, implicit L after M) that returns the path in absolute coordinates, scaled and translated; arcs scale their radius. Used by the enclosures and by `snap`.

### Motion
`motionTransform(motion)` gives the transformation for the extreme frame: `ring` 18°, `wiggle` 10°, `spin` 90° around `origin`; `beat` scales 1.18; `slide`/`float`/`bounce` move by `vector`. The animation reads the same data: `render(icon, { animate })` plus `motionAttrs(icon, effect, play)` on the `<svg>` (`class="gota"`, `data-effect`, `data-play`), and the keyframes in `engine/motion.css`:
- `effectOf(icon, 'auto')`: the icon's own gesture, otherwise its levels, otherwise a bounce;
- the moving pieces go in a `.gota-m` group with `transform-box: view-box`, their pivot (`transform-origin` in canvas units), and their offset (`--dx`, `--dy`);
- `draw` and `levels` use `pathLength="1"` with the drawing order (`--i`) and the level (`--l`);
- `data-play`: `hover` (and focus), `once`, or `loop`; under `prefers-reduced-motion` everything stays still.

## Transitions (`engine/morph.mjs`)
Every frame of a transition is drawn by `render`, so masks, fill, enclosures, weight, and 16 px apply to each one: no frame approximates the set's rules.
| Function | What it does |
|---|---|
| `transitionOf(from, to, icons, { variant })` | Picks the way. First a curated turn (`{ rotate }`); then two icons with the same base and a different badge (`{ morph: true }`, found on their own, in any style); then a curated morph from `PAIRS` (`{ morph, pairs?, origin? }`, outline only); anything else `{ replace: true }` |
| `frames(from, to, way, options)` | `t` (0–1, linear) ⇒ the inner SVG, with `render`'s options. With the same base, only the badge moves, for the whole time; a badge that changes leaves first and the new one arrives in the second half |
| `morpher(from, to, { pairs, origin })` | The base strokes alone: `t` ⇒ array of `d` |
| `changeOf(icons, before, after, options, transition)` | For components: `{ name, slash }` before and after ⇒ `{ way, frame }`, or `null`. Toggling the automatic slash draws it in, or erases it back to its corner |
| `playTransition(svg, change, duration = 420)` | Browser only: plays it on an `<svg>` that already shows the final drawing |
| `toCubics(d)` | A path as subpaths of cubic segments (lines, arcs, and quadratics included) |

**Badges.** A stroke badge (open strokes whose cutout is a stroke too, open or there and back: the slash of `bell-off`, the second check) is drawn along its length, and its cutout follows it as a there-and-back path, so it never fills an area. Any other badge zooms in from the center of its cutout with a slight overshoot (`badge.zoom`): it is born as a sharp miniature, never as a blob.

**Morphs.**
- Strokes pair by nearness (their ends, an open one read backwards if closer, and their centers), or by the curated `pairs` (indices into each icon's strokes; one stroke may pair twice).
- Two strokes with the same structure correspond segment by segment (closed ones turned the same way, from the segment where they twist least); otherwise each is cut where the other has a corner, by fraction of length.
- A straight line into another turns: center, angle (the shortest way), and length. When it both moves and turns, it moves first and turns after: a menu's lines meet in the middle, then cross.
- A stroke left over is erased along its length and a new one is drawn the same way (`origin: 'middle'`: from its middle), one after another; when both happen, what leaves goes first (0–55 %, then 45–100 %). Never shrunk to a point: a zero-length stroke with round caps reads as a stray dot.
- The frames are outlines (the fill data belongs to each icon's own strokes), so in `fill` a curated morph swaps in.

**Curated pairs (`PAIRS`).** Only pairs whose every frame is clean on `scripts/transitions-sheet.mjs`, in both directions:
- morphs: menu ↔ close, minus ↔ plus, lock ↔ lock-open, mail ↔ mail-open, toggle off ↔ on, volume off ↔ low ↔ high, wifi low ↔ medium ↔ full, flashlight ↔ on, expand ↔ collapse (vertical and horizontal), sidebar collapse ↔ expand, align left ↔ center ↔ right, sort ascending ↔ descending, text larger ↔ smaller;
- turns: plus ↔ close (45°), the four chevrons and the arrows (180°).

Tried and rejected, so they swap in (no clean shape halfway): play ↔ pause, sun ↔ moon, heart ↔ star, folder ↔ folder-open, eye ↔ eye-closed, maximize ↔ minimize, lightbulb ↔ on, signal levels, play-circle ↔ pause-circle, check ↔ check-double.

**Playing.** `playTransition` hides the final drawing the framework already put in the `<svg>`, draws the frames in a layer of its own (mask ids with a `t` suffix, so they don't clash with the hidden ones), and removes it at the end: the nodes a framework manages are never rewritten. A turn or a swap animates the `<svg>` itself (rotation, or scale 0.6 → 1 with a fade). A new change cancels the one in flight. Under reduced motion, the final drawing just stays.

## Search (`engine/search.mjs`)
`buildIndex(icons, i18n)` indexes each icon by its name, its labels in 10 languages, its keywords (es/en), and its tags. `search(index, query, { limit, category })` scores each query word by the best field it matches: name 10, label 7, keyword 5, tag 3; a whole word counts double, a prefix once, and a substring (words over 3 letters) half.
- `fold` lowercases and strips accents and punctuation but keeps the ñ (*campaña* is not *campana*).
- Empty words in Spanish and English are ignored, and plurals count as singulars (*notificaciones* = *notificación*).
- Icons that match every word come first; if none does ("descargar pdf"), the ones that match the most. A name that is exactly the query wins; shorter names win ties.

`engine/search-api.mjs` (`dist/search.js`) adds `searchIcons(query, options)`, which builds the index on first use from the generated `dist/search-data.js`.
