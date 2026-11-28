# Round 12 — The sweep (in progress)

The `round-12` branch carries the round while it's drawn, so any machine can pick it up. `main` only gets what is ready to be served (a push to `main` deploys `gota.flouvia.com`): when the round closes, this folder is deleted and the branch merges into `main`. It is the last round before v1 ([decision 89](../docs/decisions.md#v1-20-nov-2026)): v1 ships with the set it leaves, about 8,050 icons.

Unlike rounds 3 to 11, the sweep draws into categories that already exist: 684 names in 74 categories, drawn by domain group, each new icon added to its category's file the way that file already does it. A category's existing icons are never touched.

## Where the names came from (26–27 Nov 2026)
- **First pass:** a names agent per domain, with each category's gap to its target plus 30 % and the names Lucide, Heroicons, and SF Symbols have and Gota lacks: about 690 proposed, 621 approved.
- **Second pass:** the 8,709 concepts Tabler, Phosphor, and Material Symbols name (names only, nothing of theirs committed), 4,918 of them not in Gota by name, plus a few badge states families lack: 63 approved.
- The main session's 62 drops at the names stage, each with its reason: `names-drops.json` (16 were names round 11 had dropped, and others rounds 8 to 10 had).

## Status (27 Nov 2026)
| Group | Categories | Names | Step |
|---|---|---|---|
| `interface` | controles, edicion, formas, navegacion, producto, simbolos, ventanas | 111 | Drawing: 57 of 111 drawn, languages in; cut by the usage limit |
| `work-tech-media` | archivos, calendario, ciberseguridad, comunicacion, datos, desarrollo, dispositivos, hardware, ia, oficina, redes, social | 63 | Drawing: 58 of 63 drawn, languages in; cut by the usage limit |
| `business` | bienes-raices, comercio, legal, logistica, marketing, negocios, rrhh, soporte | 69 | Drawing: 64 of 69 drawn, languages in; cut by the usage limit |
| `places-home` | aviacion, camping, comida, conduccion, electrodomesticos, frutas-verduras, hogar, limpieza, lugares, nautica, restaurante, senales, transito, vehiculos, viajes | 104 | Waiting (cut before it started) |
| `people` | anatomia, belleza, bienestar, emociones, fitness, gestos, personas, ropa, salud | 106 | Waiting (cut before it started) |
| `leisure` | arte, deportes, entretenimiento, fiestas, foto-video, juegos, lectura, musica | 80 | Waiting (cut before it started) |
| `science` | agricultura, ciencia, construccion, educacion, energia, espacio, herramientas, industria, seguridad-laboral | 93 | Waiting (cut before it started) |
| `nature` | animales, aves-insectos, clima, mar, medio-ambiente, plantas | 58 | Waiting (cut before it started) |

## Files
- `approved.json`: the approved names by category, `{ category: [{ name, meaning, drawing, closest, why, source }] }`.
- `names-drops.json`: what the main session dropped at the names stage, with the reason for each in Spanish.
- `draw-args.json`: the drawing workflow's arguments (round, slots, the eight domain groups and their categories). Before launching, add `authorization` (the owner's words that asked for the run, quoted), `root` (this checkout's absolute path, forward slashes), and `todo`.
- `draw.workflow.js`: the drawing workflow, with the exact prompt each illustrator, critic, and languages agent receives, run as a script by Claude Code's Workflow tool.
- `lang-<group>.json`: the languages agents' data (`{ group, i18n }`), saved here as each comes back.
- `write-i18n.mjs`: writes a category's languages: its `src/i18n/<category>.json` as on `main`, plus the round's icons still in its file. It never rewrites an older entry, so it can run again after any drop.
- `drop-blocks.mjs`: drops an icon from a file that draws with add()/put(); files that write `icons[...] =` are edited by hand.
- `reports/`: each group's illustrator and critic reports (`draw-<group>.json`, `critic-<group>.json`).
- `main-drops.json`: what the main session dropped after the critics, with the reason for each in Spanish (the owner reads them in the sample).
- `sample/`: the owner's sample (`build.mjs` and its `template.html`): only the round's new icons, by category, and the main session's drops. After the full build, `node round-12/sample/build.mjs <out.html>`, published as a private artifact for the owner.

## Running it on another machine
- `npm ci` (Node 22 or later), and Chrome installed: every agent draws its sheets and runs QA in its own headless Chrome (`CHROME` for a path other than the usual one).
- The drawing runs with Claude Code's Workflow tool, which needs the owner's explicit request. Quote the owner's words in `authorization`, and pass `root` with this checkout's absolute path.
- `node scripts/qa.mjs` takes several categories separated by commas: a group checks its categories in one pass, since every run measures the whole set.
- The main session does what the agents don't: it writes the languages, looks at every category's sheet against [DESIGN.md](../DESIGN.md) › "What failed before" and drops what doesn't read at 24 px, and closes the round.

## Resume
Relaunch with `todo` for only what is left (`{ "<group>": ["draw", "lang", "critic"] }`), never with a resume of an earlier run: a resume can rerun critics that had finished. An illustrator continues from the files as they are. Watch the disk: under 4 GB free, stop the run and relaunch what's left later.

## Close
1. Each group: languages with `write-i18n.mjs`, `build.mjs --check`, its sheets looked at by the main session, what still doesn't read dropped and added to `main-drops.json`.
2. In a clean worktree: the full build, the full QA (zero warnings for the round's icons), the tests, and the fonts (`src/codepoints.json` gets the new codepoints).
3. The owner's sample (`sample/build.mjs`), then the docs: `history.md`, `roadmap.md` (3.4 done), `taxonomy.md`, and a `DESIGN.md` lesson if the round taught one.
4. Delete `round-12/`, merge into `main`, push, and run `npm run gota:sync` in `flouvia-web` for the explorer.
