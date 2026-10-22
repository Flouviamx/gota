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

## Design and technical decisions (Claude, during construction)
- **Signature:** a square bottom-right corner on containers; bubbles with `drop()`.
- **Fill with masks**, not boolean operations: `solid`/`cut`/`lines`; `lines` get 1.5 of clearance (a calendar with separate rings, like SF Symbols).
- `fill: false` for line-only icons; slash turned off on standalone lines (slashing an arrow says nothing).
- Enclosures at 58 % (circle) and 60 % (square with the signature).
- 16 px: automatic pixel snapping; a custom drawing only where that isn't enough.
- Named weights light 1 / regular 1.5 / bold 2, on top of a continuous weight.
- Languages in separate files (`src/i18n/`) so design and languages can work in parallel without colliding.
- Tuned QA thresholds (0.975 similarity and a family exemption; no "light" warning).
- The folder is renamed to `~/Desktop/gota` when no agents are working.
