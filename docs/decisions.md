# Decisions

> Every proposal, who it came from, and what was decided: **yes**, **differently** (it's done, but another way), **later**, or **no**, with the reason. Before proposing something, look for it here: a rejected idea is not reopened without a new reason.

[← Index](./README.md)

## Origin and scope
| # | Proposal | From | Decision | Reason |
|---|---|---|---|---|
| 1 | Drop the Lucide-style icons in `flouvia-web` | owner | **yes** | He wants something unique and premium, "Apple-like" |
| 2 | What to use: Flouvia's own set, Phosphor Light, or Solar Linear | Claude (3 options) | **yes: own set** | The most distinctive; SF Symbols can't be used on the web (its license covers Apple platforms only) |
| 3 | Where: the public site only, or site + portal + Ops | Claude | **site, portal, and Ops** (owner) | One language across all of Flouvia |
| 4 | "Apple level, well-made drawings, don't copy" after the first version | owner | **yes** | Everything was redrawn: continuous corners (squircle), keylines, knockouts, metaphors built from geometry |
| 5 | Nothing translucent | owner | **yes** | The duotone was removed; a set rule: one color in every variant |
| 6 | Publish a set of Flouvia SVG icons (the necessary ones first) | owner | **yes** | The origin of Gota |

## The library
| # | Proposal | From | Decision | Reason |
|---|---|---|---|---|
| 7 | Repo: a new one (`flouvia-icons`) or a folder inside `flouvia-web` | Claude | **new repo** (owner) | Don't mix thousands of icons the site doesn't use with production code |
| 8 | License: MIT, CC BY 4.0, or proprietary | Claude | **MIT** (owner) | Maximum adoption and visibility |
| 9 | Pace: batches per category with review, or everything at once with parallel agents | Claude | **parallel agents** (owner) | Speed; critics and QA take care of consistency |
| 10 | Name: Gota, Caudal, Trazo, or Flouvia Symbols | Claude | **Gota** (owner) | Its signature is the drop from the logomark (*gota* is Spanish for "drop"); short, distinctive, in Spanish |
| 11 | Versions 1.0 ≈ 1,000 → 2.0 ≈ 3,000 → 3.0 ≈ 6,000 → 4.0 = 10,000 | Claude | **no** | The owner decided: **v1 is 10,000, and nothing is published before then** |
| 12 | GitHub with only what's needed, no clutter | owner | **yes** | Source only; SVG/`dist`/sheets are generated and go to Releases (ZIP) and npm |
| 13 | Public site | owner | **yes, at `gota.flouvia.com`** | Its own project on Vercel; it comes in phase 4 |
| 14 | SF Symbols-style variants (fill, weights, circle/square/slash, fitting with text) with the first 1,000, the site later | owner | **yes** | So nothing has to be redone: the fill is drawn; the rest comes from the engine |

## Being number 1
| # | Proposal | From | Decision | Reason / where |
|---|---|---|---|---|
| 15 | Optical sizes (16 px snapped to the pixel grid or redrawn) | Claude | **yes, from the first 1,000** | `snap` + `small` ([engine](./engine.md)) |
| 16 | Continuous weight and a variable icon font | Claude | **yes** | Continuous SVG already; variable `.woff2` in phase 2 (the hardest part: compatible outlines) |
| 17 | Mirroring for Arabic and Hebrew | Claude | **yes** | `mirror` + `data-rtl="mirror"` |
| 18 | Native SF Symbols-style animation on the web | Claude | **yes** | Data already in place (`motion`, `parts`, drawing order); the runtime in phase 2 |
| 19 | Ecosystem: Figma, Xcode, Android, per-framework packages, MCP | Claude | **yes** | Phase 2, on the same engine |
| 20 | Search by meaning and multilingual accessibility | Claude | **yes** | `src/i18n/` with 10 languages and usage keywords (es/en) |
| 21 | Do all of the above from the first 1,000 | owner | **yes** | Split into per-icon data (round 2) and engine outputs (phase 2) |

## External analysis 1 (pasted by the owner)
| # | Proposal | Decision | Reason |
|---|---|---|---|
| 22 | Named layers and stroke order for animation | **yes, differently** | `parts` with names → `data-part` on each stroke; **never `id`** (ids collide with several icons on a page). The drawing order in `d` already existed. No boolean operations: the fill uses masks |
| 23 | Morphing: equalize the node count of every icon | **differently** | It would distort the drawings and isn't needed (GSAP MorphSVG morphs paths with different point counts). ~50 curated pairs with compatible structure + a generic "replace" (phase 2) |
| 24 | Metadata in the SVG: `data-rtl`, `data-level` | **yes** | Done in the build. Inactive levels are **hidden**, not made translucent |
| 25 | Table of "leaders without variable weight or optical size" | **corrected** | Material Symbols is already variable (weight, fill, optical size) and SF Symbols already animates; the real differentiator is the web and the quality of the set |
| 26 | Variable `.woff2` font with a `wght` axis | **yes** | Phase 2 |
| 27 | Xcode symbols usable with `Image(systemName:)` | **yes, corrected** | Custom symbols are used with `Image("name")`; `systemName` is only for Apple's own. Ultralight/Regular/Black × 3 size templates |
| 28 | MCP server as a distribution channel | **yes** | Remote, at `gota.flouvia.com/mcp`, es/en search, returns the exact SVG |

## "Pro pro pro" practices
| # | Proposal | From | Decision | Where |
|---|---|---|---|---|
| 29 | Automated engine tests | Claude | **yes, done** | `tests/engine.test.mjs` (12) |
| 30 | Zero QA warnings to publish | Claude | **yes** | [Quality › Gates](./quality.md#gates) |
| 31 | Migration map from Lucide/Heroicons/SF with a codemod | Claude | **yes** | Phase 2.8 |
| 32 | Semantic versioning, changelog, and rename aliases | Claude | **yes** | From the first release |

## External analysis 2 (pasted by the owner)
| # | Proposal | Decision | Reason |
|---|---|---|---|
| 33 | "Smart SVG": the icon rearranges itself to the container's aspect ratio | **no** | Icons live in square boxes; SVG has no conditionals (it would need JS). The useful part —changing the drawing with the size— already exists with 16 px |
| 34 | Stateful icons that take a live value | **yes, curated** | ~30 designed on purpose, `--gota-value` with `@property`, phase 2. In round 2, quantity icons mark their `level`/`progress` part |
| 35 | Weather that changes color with humidity or time of day | **no** | It breaks the one-color principle; it's an effect, not a utility |
| 36 | AI generator for missing icons using the set's geometry | **later** | "Gota on demand" after v1: engine + QA + review, in minutes. No promises of "milliseconds" or "infinite" without a filter |
| 37 | MCP that reads the code and adjusts weight and radii to the app | **partly** | Yes: `weight="auto"` matches the text's weight (like SF Symbols), handled in the component. No: radii that change per app (it breaks the identity) |

## Details (the owner points out specific defects)
| # | Observation | Decision | Where |
|---|---|---|---|
| 38 | "Look at the arrow": the pointer in `cursor-click` and `drag-drop` is crude | **yes, systemic** | `cursor()` in the engine, the set's only pointer; a nearly sharp tip, a well-proportioned tail |
| 39 | Heart with a pulse and bubble with a lock with ugly cuts and fragments | **yes, systemic** | Engine badges with automatic knockouts (`badge`), never hand cuts; QA `loose` and `near`; round 2 brings everything to zero warnings |

## Repository language (22 Oct 2026)
| # | Proposal | From | Decision | Reason |
|---|---|---|---|---|
| 40 | Move the repository to English: docs, comments, scripts, and commit messages | owner | **yes** | A public library: most of its users will read it in English. `README.es.md` in Spanish for Latin America; icon labels and search keywords stay multilingual (`src/i18n`, `tags`). The rule lives in [`CLAUDE.md`](../CLAUDE.md#non-negotiable-rules) |

## Phase 2 (22 Oct 2026)
| # | Proposal | From | Decision | Reason |
|---|---|---|---|---|
| 41 | ~50 morphs drawn by hand with compatible structure (roadmap 2.2) | plan | **differently** | The engine draws every frame through `render`, so masks and cutouts stay exact. Badge pairs (same base, different badge) animate on their own, like SF Symbols' Magic Replace: 30 in the set today and every one added later. Of the curated morphs, 20 passed the frame-by-frame sheet; 10 tried pairs (play ↔ pause, sun ↔ moon, heart ↔ star…) had no clean shape halfway and swap in, as Apple does with play ↔ pause |
| 42 | A stroke without a partner grows from (or shrinks to) a point | first morph engine | **no** | A zero-length stroke with round caps reads as a stray dot. It is erased or drawn along its own length, one after another |
| 43 | Interpolate straight lines by their points | first morph engine | **no** | A menu's lines folded into a ">" halfway. Lines turn by center, angle, and length; when they both move and turn, they move first |
| 44 | The transition player rewrites the `<svg>` the framework manages | first React version | **no** | It would fight React, Vue, and Svelte (Svelte's `{@html}` keeps its own nodes). The player hides the final drawing, draws in a layer of its own, and removes it |
| 45 | The MCP server on the official SDK | Claude | **no** | The package stays dependency-free: MCP over stdio is JSON-RPC, one message per line, in one file |
| 46 | Skia (`canvaskit-wasm`) as a dev dependency to turn strokes into outlines, for the variable icon font, Android Vector Drawables, and Xcode symbols | Claude | **yes** (decision 50) | Those formats can't hold a stroke with masks; Skia does exact stroke outlining and boolean operations. The published package would stay dependency-free |
| 47 | The swap transition fades (opacity) | Claude | **yes** | Only while it moves (320 ms), like Apple's replace; the drawings stay one color ([non-negotiable rules](../CLAUDE.md#non-negotiable-rules)) |
| 48 | Per-icon exports named like the icon (`Bell`, `Map`) | Claude | **no: `<Name>Icon`** | `Map`, `Image`, `File`, `Text`, `Document`, `Function`, and `Math` would shadow globals in the importing file. `BellIcon`, like Heroicons, can't clash with anything |
| 49 | One component that takes either `name` or `icon` | Claude | **no: two** | A component that can look up a name keeps the whole set in every bundle. `IconBase` takes data and imports no set; `Icon` adds the lookup by name on top, and per-icon components wrap `IconBase` (generated for React and Vue; Svelte would need a `.svelte` file per icon, so it passes data to `IconBase`) |
| 50 | Skia (`canvaskit-wasm`) as a dev dependency (decision 46) | Claude | **yes** (owner, 22 Oct 2026) | For the variable icon font, Android, and Xcode; the published package stays dependency-free |
| 51 | Outlines by redrawing each icon's rules (fill masks, badges, enclosures) with path operations | Claude | **no: evaluate `render`'s SVG** | A second copy of the drawing rules would drift from the first. The SVG is evaluated as an image model (regions, paint order, luminance masks), and every outline is checked against a raster of the same SVG: Skia's path operations go wrong silently where two shapes only touch, and here they never ship |
| 52 | Keep `sq`'s fixed 0.6 smoothing when the corner doesn't fit the side | engine | **no: the corner fits, as in Figma** | The outline check found sides that ran backwards (the card chip: a 5-high side with two 2.56 corners). The rule "r ≤ min(w, h) / 3.2" was documented but not enforced; now the smoothing gives way and then the radius. 25 icons change by a hair (smoothing 0.6 → ~0.56 in those corners), checked side by side; QA stays at zero |

## Weights (22 Oct 2026)
Found by checking every icon at 0.9, 1.5, and 2.1 for the variable outputs: the bold variant already shipping had badge signs that filled their ring, and fills that read lighter at bold than at regular.
| # | Proposal | From | Decision | Reason |
|---|---|---|---|---|
| 53 | A badge's sign keeps its size at every weight | engine | **no** (superseded by 58) | At bold the check and the plus filled the ring. First the sign shrank past regular so the air held; at 2.1 a plus still became a blob, which led to solid badges |
| 54 | Cuts as wide as the ink (`weight`) | engine | **no: paper thins as ink grows** | A bold fill read lighter than regular (thicker white cuts). Paper is 1.75 / 1.5 / 1.25 at light / regular / bold |
| 55 | Cuts that reach the silhouette go clean through it | Claude | **no: they keep their relation to it** | Clean cuts notched the gem's points, the money bag's neck, and the box's corners at regular. Moving only the cut's tips (`meet`) failed where a cut runs along the edge (a database's separators, the globe's meridian), so a cut that comes to the silhouette follows the ink's width less 0.1 and interior cuts stay paper (`edgeCut`) |
| 56 | Dots drawn as stroked circles | engine | **no: solid discs** | At light weights a dot opened into a ring and a cut dot left an island of ink; the notification dot showed a ring around a dot |
| 57 | Gota's weight range up to 2.5 (font weight 900) | Claude | **not yet: 0.9–2.1** | Past 2.1 a ring of r 4.25 had no room for a legible sign. With solid badges (58) that limit is gone; the range can grow once the drawings hold their structure at 2.5. Material Symbols' variable weight also ends at 700 |
| 58 | Outline badges as solid discs with the sign cut out, like Apple's `doc.badge.plus` | Claude | **yes** (owner, 22 Oct 2026, from a side-by-side sheet at 0.9 / 1.5 / 2.1 and 24 px) | Legible at every weight and at 24 px, where a ring with a sign clogs. Status badges only (the engine's and custom ones on the standard circle, 65 icons); a lens or a second card keeps the icon's style. QA's density is measured without the badge (a disc is not "too many parts") |
| 60 | A fill's `lines` keep 1.5 of clearance at every weight (a halo of weight + 3) | engine | **no: the clearance is paper** | The halo grew with the ink, so at bold it met the cuts beside it: the calendar's rings closed its header off, the briefcase's band met its clasp. As paper, a line and its clearance take 4.5 at every weight (as at regular); 23 fills keep their structure from 0.9 to 2.1 with no redrawing. Moving a cut's tips instead (`meet`, 55) was tried again and failed again on the database and the globe |
| 61 | A badge's and the slash's clearance stays 1.5 at every weight (weight + 3) | engine | **no: paper, as a fill's lines (60)** | The same halo grew with the ink and cut the base at bold: a folder's tab line, a card's stripe, and a clock's calendar split near their badge. 28 more variants hold their structure; the status badges and the slash look as at regular. What it costs: a base stroke that ends just inside the clearance at regular peeks out at bold (`cloud-sun`, `wheelchair`), a drawing fix |
| 62 | Circles written with the radius rounded on its own | engine | **no: a half circle gets exactly half its written chord** | A half circle whose radius came out a hair longer than half its rounded chord swung its center off the chord: at any weight but 0.9, 1.5, and 2.1 (`weight="auto"` included) every dot was a stadium, in Chrome, Skia, and Android alike, and the masters' in-between checks failed on it. `circ()`, a 180° `arc()`, and the engine's scaling and 16 px snapping write half circles exactly; arcs near 180° that aren't half circles (a cloud's lobes) stay as drawn: from rounded points they can't be told apart, and their error is about 0.04 |
| 63 | A fill's lines keep a clearance of paper even where they stand apart from the fill (60) | engine | **no: it stops at the fill's ink** | Strokes stand 3 apart, so at bold a ray's or a raindrop's clearance bit 0.3 into the sun's disc or the cloud's base (a gear's edge). A line that crosses, meets, or lies on the fill keeps its clearance; one apart from it (1.5 or more at regular) never cuts into it. Regular and light are unchanged |
| 64 | One way to make masters correspond for the whole icon, and a looser check for in-between weights | Claude | **no: four ways, the first that passes; the same check** | Following the regular master tangled one contour where a station landed across a narrow neck, and corners with fractions of length placed points unevenly along curves. Now: following, anchored at shared corners, each contour its own way, then corners, every result checked. A looser in-between check was tried and rejected: overlaid at large size, the mismatches it would have let through were real (a bump where a badge's clearance meets a curve, a flattened cap) |
| 65 | Masters with a station every 1.2 and pieces within 0.01 | Claude | **no: every 2.4, within 0.02, and points on a straight run dropped** | The fonts showed the cost: a bell in 132 pieces where 86 hold it. The same masters pass (and 15 more, whose interpolation the extra points had bent), the variable font is a third lighter, and 0.02 is 0.02 px at 24 px |
| 66 | An icon font with its codepoints in the BMP's Private Use Area, and names left to a CSS class per icon | Claude | **no: Supplementary PUA-A, stable, and ligatures** | The BMP's PUA holds 6,400 and Gota will have 10,000. `src/codepoints.json` keeps each icon's codepoint forever (a new icon takes the next one); the name typed as text is a ligature, so `<i class="gota">bell</i>` reads as what it shows, with no stylesheet of one class per icon. 4,800 units per em: at 2,400 one interpolated glyph tipped past the check on rounding alone |
| 67 | Static fonts at the named weights (light 1, bold 2) | Claude | **no: at the masters** (superseded by 70) | Each static font is then a master as it is, checked, and `font-weight: 700` draws the same in the static font as in the variable one |
| 68 | Xcode symbols with Gota's masters at Apple's three named ends | Claude | **yes: Ultralight 0.9, Regular 1.5, Black 2.1** | A variable template has exactly three masters and Xcode draws the six weights between them. Gota's range is narrower than SF Symbols' (its Ultralight looks like Apple's Light, its Black like Apple's Semibold): that is the design's range (57), not a mapping to stretch. Drawn next to SF Symbols' bell, Gota's sits at the same optical size |
| 69 | A live value that redraws the icon (render per value) | Claude | **no: one drawing moved by a CSS property** | `value: 'live'` writes the levels' thresholds, the strokes' dash and the turns as calc() on `--gota-value`, registered with @property: the components only set the property, so a new value animates through every one in between with no new markup. A number still draws the value into the SVG (portable to files and design tools). A level appears at v × levels = n − ½, as the number rounds |
| 70 | Named weights light 1 · bold 2, and a font axis from 100 (0.9) to 700 | owner's call, left to Claude | **no: one scale, Light 300 · Regular 400 · Bold 700 = 0.9 · 1.5 · 2.1** | The owner asked for the most professional naming. The named weights become the three masters, at the CSS weights that carry their names: `weight="light"`, `font-weight: 300` in the variable font, the `gota-light` static font, and Android's `light` folder all draw the same master, exact. `weight="auto"` follows the text on that scale (500 is 1.7); lighter text keeps 0.9 and heavier keeps 2.1. Xcode keeps Apple's names for the same three masters (Ultralight, Regular, Black) |
| 59 | Dots as stroked circles that "read as solid" (`dot()`, r 0.7 at stroke 1.5) | engine | **no: discs of radius r + w/2** | Measured in Chrome: a circle narrower than its stroke comes out hollow and too small (r 0.3 → 1.2 wide instead of 2.1; r 0.7 hollow), and in Skia's outlines it left a ring inside every dot. A disc is the designed shape in every renderer and format; bullets and calendar dots now show their designed size |

## Outputs (23 Oct 2026)
| # | Proposal | From | Decision | Reason |
|---|---|---|---|---|
| 71 | The remote MCP server at `gota.flouvia.com/mcp` before v1 | plan (decision 28) | **yes** (owner, 23 Oct 2026) | The one channel open before 10,000, so agents can use the set while it grows: read-only, and the package, the site, and GitHub still wait for v1. Streamable HTTP and stateless, on Vercel: every answer comes back in the POST's own response, so no session store or event stream is needed and any instance answers any request. Any origin may call it: nothing behind it is private and it takes no credentials, so the Origin check the spec asks of local servers (against DNS rebinding) would only lock out browser clients. The same `handler.mjs` as stdio, so both transports give the same answers |
| 72 | `gota.flouvia.com` served by `flouvia-web`, which would proxy `/mcp` to `gota` | the site's session, after the owner put Gota's page there (23 Oct 2026) | **no: the host stays in `gota`, which proxies the page** | The page is built in `flouvia-web` with the site's shell, but in Vercel a static file wins over a rewrite: `flouvia-web`'s own home would answer `gota.flouvia.com/` before any host rule. So `gota` keeps the host, serves `/mcp` itself, and takes the page (`/`, `/en`, and their assets) from `flouvia.com/gota` by external rewrite; every other path goes to `flouvia.com`. The phase 4 explorer lives here natively |

## Design and technical decisions (Claude, during construction)
- **Signature:** a square bottom-right corner on containers; bubbles with `drop()`.
- **Fill with masks**, not boolean operations: `solid`/`cut`/`lines`; `lines` get 1.5 of clearance (a calendar with separate rings, like SF Symbols).
- `fill: false` for line-only icons; slash turned off on standalone lines (slashing an arrow says nothing).
- Enclosures at 58 % (circle) and 60 % (square with the signature).
- 16 px: automatic pixel snapping; a custom drawing only where that isn't enough.
- Named weights on top of a continuous weight: light 1 / regular 1.5 / bold 2 at first, the three masters since decision 70.
- Languages in separate files (`src/i18n/`) so design and languages can work in parallel without colliding.
- Tuned QA thresholds (0.975 similarity and a family exemption; no "light" warning).
- The folder is renamed to `~/Desktop/gota` when no agents are working.
