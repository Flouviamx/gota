# History

> A log of what was done, how, and why. Newest first. Decisions and their reasons are in [Decisions](./decisions.md).

[← Index](./README.md)

## 23 Oct 2026 — Typefaces drawn with the engine
- **`node scripts/type.mjs <folder>`** ([build](./build.md#typefaces-node-scriptstypemjs-folder), [decision 77](./decisions.md#outputs-23-oct-2026)): a typeface's glyphs, written as icons are (stroke axes on the grid), become variable and static fonts, words as outlines, and a specimen set in the fonts. The owner asked for Flouvia's own typeface built like the icons; it lives in the private `flouvia-web/brand/flouvia-sans/` (162 glyphs: lowercase, capitals, figures, punctuation, accents for Spanish, Portuguese, and French), all rights reserved. Its first draft wrote the o as a drop and read "Gata"; the o stayed round and the drop's corner went to bowls that close against a stem.
- Along the way: `scripts/contours.mjs` (path data to TrueType contours, shared with the icon fonts), and `font()` takes vertical metrics, Unicode ranges, the embedding flag, and the trademark and manufacturer names.
- Tests: 57.

## 23 Oct 2026 — Migration from Lucide, Heroicons, and SF Symbols (2.8 closes)
- **The maps** (`src/migrate/`, [build](./build.md#migration-srcmigrate-flouviagotamigrate-gota-migrate), [decision 75](./decisions.md#outputs-23-oct-2026)): Lucide 973 of its 1,903 icons (1,157 entries with its old names), Heroicons 285 of 324, SF Symbols 708 concepts and whole names that cover 1,814 of its 8,091 names. Made with the owner's OK to download `lucide-static` and `heroicons` from npm (names only; nothing of theirs is committed) and SF Symbols' own list on this Mac.
- **How:** six agents judged every name by meaning, comparing drawings; Claude checked the pairs on review sheets (the original beside Gota's; SF Symbols drawn by AppKit). The sheets caught SF Symbols' diagonal arrows mapped backwards, `book` (an open book), `message` (a plain bubble), and `restart`; SF names whose circle is part of Gota's drawing (`info.circle`, the currency signs) became whole-name entries, and a `.fill` in the middle of a name (`bag.fill.badge.plus`) is the fill style.
- **`@flouvia/gota/migrate`**, the **`gota-migrate`** codemod (React, Vue, Astro, Swift; a dry run unless `--write`), and **`find_equivalent`** in the MCP server.
- **The build keeps** `dist/fonts`, `android`, `xcode`, and `figma` ([decision 76](./decisions.md#outputs-23-oct-2026)): a rebuild had taken away the Figma plugin while the owner was importing it.
- Tests: 56.

## 23 Oct 2026 — Outline ↔ fill: the liquid (2.2 closes)
- **`liquid(icon, rise, options)`** ([engine](./engine.md#transitions-enginemorphmjs), [decision 74](./decisions.md#outputs-23-oct-2026)): the fill rises through the outline like a liquid, or drains out of it, its surface a wave that settles flat. Each frame is the outline and the fill `render` already draws, split by the surface: one color, every cutout exact. React, Vue, and Svelte play it when `variant` changes (`transition="auto"`), in 560 ms.
- **Tuned on the sheet:** the first version eased out and started below the ink, so it filled in the first half and sat still in the second; the level now runs exactly across the ink with a sine ease. Played in Chrome: the layer leaves at the end, nothing stays hidden.
- Tests: 51.

## 23 Oct 2026 — Figma library builder (2.6)
- **`node scripts/native.mjs figma`** ([build](./build.md#native-formats-node-scriptsnativemjs-format), [decision 73](./decisions.md#outputs-23-oct-2026)): a development plugin that builds Gota's library in the open Figma file: a page per category, a component set per icon with Style (Outline, Fill) × Weight (Light, Regular, Bold), 6,198 variants, each a 24 × 24 component with the icon's checked outline. Descriptions carry the labels and keywords in English and Spanish for Figma's search. A second run updates in place, so instances in other files keep working through every round.
- `absolute()` in `scripts/outline.mjs` writes the compact outlines as the absolute `M L Q C Z` Figma takes; every one of the 6,198 is checked again as written.
- **Left:** the owner imports the plugin in Figma's desktop app and runs it (Claude can't sign in to Figma); publishing the file as a team library is the owner's step.
- **The cover** (`dist/figma/cover.png`), at the owner's request: on Flouvia's graphite, the set as a field whose weight grows left to right, fading around a clearing with only "Gota" and Flouvia's official logo (the owner's call, over a drop in blue and an app icon); written with the plugin, so it follows the set as it grows.
- Tests: 50.

## 23 Oct 2026 — The remote MCP server (2.7 closes)
- **`https://gota.flouvia.com/mcp`** ([build](./build.md#mcp-server-mcp-apimcpmjs), [decision 71](./decisions.md#outputs-23-oct-2026)), with the owner's OK: MCP's Streamable HTTP, stateless, as a Vercel function (project `gota`, team `flouvia`). The tools and the JSON-RPC dispatch moved to `mcp/handler.mjs`, shared by stdio and HTTP; along the way, version negotiation (a version it speaks comes back, any other gets the newest), batches, read-only annotations, `instructions` for agents, a cap of 50 results, and an unknown tool as a JSON-RPC error.
- **Checked** in a test with every case (versions, notifications, batches, tool errors, protocol errors, 405, 413, 415, CORS) and on a deployed preview before production.
- **The host** ([decision 72](./decisions.md#outputs-23-oct-2026)): the owner put Gota's page at `gota.flouvia.com`, built in `flouvia-web`. The host stays in this project, which serves `/mcp` and will take the page from `flouvia.com/gota` by proxy once it is live; until then `/` and `/en` go to `flouvia.com`, like every other path. A first arrangement (the host in `flouvia-web`, proxying `/mcp` to an origin at `mcp.gota.flouvia.com`) was dropped within the hour: `flouvia-web`'s own home would have answered `/`.
- Tests: 46.

## 23 Oct 2026 — The owner's review (1.7, phase 1 closes)
- **Approved as drawn:** a local review page put the 53 icons redrawn while the weights were unified (102 variants) before and after, side by side, each with the reason for its change, next to the scale of weights at Light, Regular, and Bold. The owner reviewed it and approved everything, with no course corrections.

## 23 Oct 2026 — One scale of weights
- **Light, Regular, Bold are 0.9, 1.5, 2.1 at font weights 300, 400, 700** ([decision 70](./decisions.md#weights-22-oct-2026)): the owner left the naming to Claude. The components' named weights (light 1, bold 2 until now), the variable font's axis (100 to 700 until now), the static fonts (`gota-light` instead of `gota-thin`), and `autoWeight` all sit on one scale, and every named weight is a master, exact in every format.
- Tests: 45.

## 23 Oct 2026 — Live values (2.3)
- **`render(icon, { value })`** ([engine](./engine.md#variants-enginevariantsmjs), [decision 69](./decisions.md#weights-22-oct-2026)): a number draws the value; `'live'` follows `--gota-value`. React, Vue, and Svelte set the property from their `value` prop, so a new value animates; Astro draws the number.
- **26 icons:** the 20 with levels, the timer (its ring is the time left, its hand points where it ends), the loader, the gauge's needle, the stopwatch's hand, the compass needle, and the navigation arrow. Static and live compared side by side at 0, ¼, ½, ¾, and 1: the same drawing (a level at exactly its threshold differed until the live step rounded a half up, as the number does).
- **Left for drawings of their own:** a progress bar (its pill would stretch) and liquids (flask, coffee, hourglass don't draw a surface apart from the glass).
- Tests: 45.

## 22 Oct 2026 — Xcode symbols (2.5 closes)
- **`node scripts/native.mjs xcode`** ([build](./build.md#native-formats-node-scriptsnativemjs-format)): 1,865 variable templates (outline and fill), 1,853 varying with the weight; `actool` compiles them with no warning and AppKit draws each at Ultralight, Regular, and Black. A sample sheet at Apple's six weights shows clean interpolation, the signature corner kept.
- **How it was found:** no template ships with Xcode or the system, so the probe started from Apple's template layout (Notes, Guides with baselines, caplines, and per-master margins, Symbols with the three masters) and was taken as right only once `actool` compiled it and AppKit drew the bell at six weights next to SF Symbols' own ([decision 68](./decisions.md#weights-22-oct-2026)).
- **The package stays light:** Android's drawables (41 MB) and the Xcode catalog (31 MB) were about to ship in the npm package; they go in the release ZIP instead.

## 22 Oct 2026 — Icon fonts (2.4)
- **`scripts/font.mjs`** and **`scripts/sfnt.mjs`** ([build](./build.md#icon-fonts-node-scriptsfontmjs)): a variable font per style (a weight axis from 100 to 700, as `weight="auto"`), static fonts at the masters, WOFF2 and TTF, `gota.css`, and a codepoint and a ligature per icon ([decisions 65–67](./decisions.md#weights-22-oct-2026)). No dependency: the OpenType writer and its reader are under 600 lines.
- **How it was checked:** the first check drew each glyph in Chrome against its SVG and failed every icon by half a pixel: Chrome snaps text to the pixel and thickens it on macOS. Now the bytes written are read back by an independent reader and compared with the drawing by Skia at five weights, and Chrome only has to take every font, form every ligature, and move every varying glyph along the axis. A round-trip test covers the writer.
- **Masters, lighter:** a station every 2.4 and pieces within 0.02, and points on a straight run dropped: the variable font went from 852 to 581 KB, and 15 more variants interpolate cleanly (QA: 27 → 12 warnings, all interpolations).
- **coupon:** its notches started inside its corners, so the outline ran back over them (a sliver at light weights); they now start where the corners end, and the % sits in the middle of the body.
- 1,027 of 1,033 icons vary with the weight in each style; the other 6 keep their regular drawing. Tests: 44.

## 22 Oct 2026 — Every icon holds its structure from 0.9 to 2.1
- **The drawing round** (four agents in parallel, one group of categories each, every result reviewed on its weights sheet): 44 structural warnings fixed in the drawing. What the owner should look at:
  - `radar`: the inner ring is now a hub (r 2.75), so the echo fits between the rings at bold;
  - `cloud-bolt`: the half-size core bolt couldn't keep its inside open; it is now the zigzag the set uses for small bolts (storm, charger, battery);
  - `video-call-off`: its slash runs 0.53 below the canvas diagonal, so its clearance misses the lens's joint at every weight;
  - `rocket`'s window is a dot; `key-plus`'s hole is a dot, as in the core key;
  - the 16 folders with a badge sit 0.5 higher (the fold cleared the padlock);
  - one sync badge for folder-sync, cloud-sync, and database-sync: the arrows at full size, turned 6°, with the clearance around their heads.
- **Fixed on the way:** `clip()` drew a cloud's hidden pieces again (cloud-off's arc crossed the slash at every weight); the core `edit` pencil's end was a flattened half circle.
- **Half circles are exact** ([decision 62](./decisions.md#weights-22-oct-2026)): at any weight but the masters' three, every dot was a stadium.
- **A cut's ends are found:** the edge test sampled a long side at its quarter points only, so a cut ending partway along it was taken as interior (traffic-cone, magnet, the radar's sweep). Points are now at most 0.25 apart.
- **Lines that stand apart don't bite the fill** ([decision 63](./decisions.md#weights-22-oct-2026)): the sun, the sunrise, rain, snow, and every fill with a stroke 3 from it kept a 0.3 bite at bold.
- **Masters:** four ways to make points correspond, the first that passes ([decision 64](./decisions.md#weights-22-oct-2026)); a failed check says where. A change that capped following's stations broke two icons and was undone.
- **Workarounds dropped:** cuts that agents had run past an outline (stacked bars, flask, test tube, compose's band, person-circle's shoulders) went back to the drawing once the engine found their ends.
- QA: 87 → 27 warnings, all interpolations (masters work); no structural warning left, and cash-register is under the density line. 1,838 of 1,865 variants have compatible masters (98.6 %). Regular, compared pixel by pixel against the previous commit: only the drawings above change, plus paperclip's and the pencils' half circles. Tests: 42.

## 22 Oct 2026 — The core holds every weight; a fill's lines keep paper
- **`scripts/weights-sheet.mjs <cat>`:** each variant QA's `weights` flags, at 0.9, 1.5, and 2.1, with its contours per weight (`--all` for the whole category). It is how the defects below were read.
- **The person** (and every `person-*` that reuses it): head and shoulders 2.45 apart center to center, so they stay apart up to 2.1; the drawing looks the same.
- **A fill's `lines` keep a clearance of paper** ([decision 60](./decisions.md#weights-22-oct-2026)): the halo grew with the ink and met the cuts beside it at bold (the calendar's rings closed its header off, the briefcase's band met its clasp). A line and its clearance now take 4.5 at every weight, as at regular.
- **A cut that starts at the silhouette comes to it:** the edge test sampled every point of a cut but its first, so a line drawn from the edge inward (the briefcase's left band) was taken as interior and behaved unlike its mirror.
- **The clearance around a badge and the slash is paper too** ([decision 61](./decisions.md#weights-22-oct-2026)): one rule for every clearance (`paperOf` in the engine), and dots near a badge are measured against it. The folders, cards, parcels, and clocks with a badge hold their structure.
- **Tried again and undone:** every cut as paper, moving the tips of those that come to the silhouette (`meet`): it had already failed (decision 55) and failed again where a cut runs along the edge.
- **The badges' alert and info signs, redrawn:** the point (a disc of r + paper/2) touched the stem at regular and merged with it at light. Now a smaller point stands 1 apart at regular (0.7 at light, 1.3 at bold).
- **One badge pencil:** Archivos' pencil drew a line across its tip, closing a triangle too small to stay open at bold; it now has Comunicación's band near the end. A cut that comes to a badge's edge (that band) follows the ink less a hair, like the base's.
- **Details clear of a badge:** the clock's pivot (11.5, 11.5) and the invoices' dollar sign move up and left, with the visual center of what the badge leaves; they touched its clearance at regular.
- **`weights-sheet.mjs`** also takes icon names (`<icon>…`, and `--slash`).
- QA's `weights`: 156 → 105 warnings with the engine alone (the core's three among them; the core set is at zero), then 86 with the drawings above: 44 structural for the drawing round (base strokes that peek out of a clearance at bold, the `*-sync` arrows meeting their base at 2.1…) and 42 interpolations for the masters. QA's density message shows two decimals (cash register: 28.04 %, over the 28 % line, not a rounding error). Tests: 42.

## 22 Oct 2026 — Every weight, one structure; compatible masters
- **Compatible masters** (`scripts/masters.mjs`): each icon's outline at 0.9, 1.5, and 2.1 with the same structure point for point, for the variable font and Xcode's variable template ([build](./build.md#compatible-masters-scriptsmastersmjs)). The first method (corners and fractions of length) bent round caps when interpolating; following the regular master by nearest point fixed them. 1,634 of 1,865 variants (87.6 %) pass, masters and interpolations checked.
- **Weight defects it found, fixed in the engine** ([decisions 53–57](./decisions.md#weights-22-oct-2026)): badge signs that filled their ring at bold; fills whose cuts grew with the ink (bold read lighter); dots that opened into rings at light weights; cut dots that left an island of ink; the notification dot as a ring. Regular is unchanged, compared pixel by pixel against the previous engine, except for 12 dots whose pinhole closed.
- **Tried and undone:** cuts that run clean through the silhouette notched the gem, the money bag, and the box at regular; moving only the cuts' tips failed where a cut runs along the edge. A cut that comes to the silhouette now follows the ink's width (less 0.1) and keeps its relation to the edge at every weight; interior cuts stay paper.
- **Dots are discs** (r + w/2, filled, unstroked; [decision 59](./decisions.md#weights-22-oct-2026)): Chrome drew every dot hollow, and the small ones too small; the outlines had a ring inside each dot (the calendar went from 18 contours to 8).
- **Dots inside enclosures** are measured at their own size (a shrunk ring is not a dot); filling dots also closes the pinhole Skia and Chrome left in dots stroked wider than themselves. Regular, compared pixel by pixel against the engine before these changes: only those pinholes and the status badges differ.
- **Range 0.9–2.1:** past 2.1 a badge's ring has no room for its sign; `autoWeight` stops at 2.1 (font weight 700).
- **Solid status badges** ([decision 58](./decisions.md#weights-22-oct-2026)): the owner chose them from a side-by-side sheet. The engine's badges and custom ones on the standard circle (65 icons) are a solid disc with the sign cut out in every style; QA's density leaves the badge out.
- **QA's `weights`** reports the icons whose structure changes between 0.9 and 2.1: 229 warnings (outline and fill), the next round of drawing fixes. Tests: 41.

## 22 Oct 2026 — Android vector drawables; what Xcode needs
- **`scripts/native.mjs android`:** 20,088 vector drawables (the same matrix as `dist/svg`), each from a checked outline: theme tint, nonzero, `autoMirrored` on the 434 directional icons. Compact path data (relative to rounded points) cuts the size by 40 %: 41 MB, 19 MB zipped.
- **The check kept finding edge cases, and the method absorbed them:** a union that Skia returns empty (`form`, square, bold) and the same inside a mask. The fallback mode now lays pieces together with no union anywhere and builds each mask as one difference (render()'s masks are always a white box with black on top).
- **Xcode, probed before building:** a symbol with different shapes per slot, compiled with `actool` and rendered with AppKit at six weights and three scales, showed that missing slots fall back to Regular-M unscaled. A full static symbol needs 27 outlines (about 1.2 GB for 10,000 icons), so the next step is compatible masters for a variable template (and the variable font).
- Tests: 37.

## 22 Oct 2026 — Outlines checked against their drawing (the base for fonts, Android, and Xcode)
- **`scripts/outline.mjs`:** every icon, in any variant, as filled shapes, by evaluating `render`'s own SVG with Skia ([build](./build.md#outlines-scriptsoutlinemjs), [decision 51](./decisions.md#phase-2-22-oct-2026)). `canvaskit-wasm@0.41.1` joins as the only dev dependency (owner's OK).
- **How it got there:** the first results filled holes (contours wound for even-odd), lost a ring (a tick starting where a circle closes), and lost the chip's holes (a line ending on a frame's stroke). Each was fixed in the method, not per icon: contours rewound by depth, pieces joined all at once with fallbacks, and every outline compared to a Skia raster of the SVG.
- **A real defect found:** `sq` let a corner bigger than its side make the side run backwards; now each corner fits its sides as in Figma ([decision 52](./decisions.md#phase-2-22-oct-2026)). 25 icons change imperceptibly; QA at 0 warnings.
- **Result:** 9,573 outlines (1,033 icons × 10 variants) in 46 s, all matching. Tests: 37 (one for `sq`, three for outlines).

## 22 Oct 2026 — Phase 2.5: one module per icon, per-icon components, and sprites
- **`engine/core.mjs`** (`@flouvia/gota/core`): the API without icon data (`svg`, `pick`, `sprite`, `render`, `autoWeight`…); `@flouvia/gota` is the core plus the set by name, with `iconData(name)`.
- **One module per icon** (`@flouvia/gota/icons`, `BellIcon`; deep imports `@flouvia/gota/icons/bell`): its data, name, and hand-drawn variants linked, so "the drawn variant wins" holds without the set ([decisions 48–49](./decisions.md#phase-2-22-oct-2026)).
- **Components split** into `IconBase` (data) and `Icon` (by name) in React, Vue, and Svelte; Astro takes either. Generated components per icon for React and Vue (`/react/icons`, `/vue/icons`). Vue's component is now `Icon`, like the others.
- **Checked:** every module equals `iconData`; `toSvg` gives the same 9,297 SVGs as the previous commit; esbuild bundles one icon in 16 KB and two React components in 33 KB, against 939 KB for `Icon` by name; React 18, Vue 3.5, and Svelte 4 in Chrome give the same drawing and transitions through data and through names, with no errors.
- **Sprites** (`sprite.svg`, `sprite-fill.svg`): an external `<use>` in Chrome draws them like the inline SVG, masks included.
- The owner approved Skia as a dev dependency for outlines ([decision 50](./decisions.md#phase-2-22-oct-2026)). Tests: 33.

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
