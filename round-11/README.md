# Round 11 — Nature (in progress)

The `round-11` branch carries the round while it's drawn, so any machine can pick it up. `main` only gets what is ready to be served (a push to `main` deploys `gota.flouvia.com`): when the round closes, this folder is deleted and the branch merges into `main`. The process is [Production with agents](../docs/production.md); after it comes the sweep, and then v1 ([decision 87](../docs/decisions.md#v1-20-nov-2026)).

## Status (22 Nov 2026)
| Category | Approved | In its file | Step |
|---|---|---|---|
| `animales` | 92 | 76 | Done: illustrator, critic, the main session's review (6 dropped), languages |
| `aves-insectos` | 88 | 79 | Done (2 dropped by the main session) |
| `mar` | 61 | 52, and `fish` adopted | Done (4 dropped by the main session) |
| `plantas` | 107 | 86, and 7 adopted | Done: critic (23 redesigned, 17 dropped), the main session's review (4 dropped), languages |
| `clima` | 76 | 40, and 26 adopted | Half drawn: its illustrator continues from the file, then its critic |
| `medio-ambiente` | 68 | — | Not started: illustrator, languages, and critic |

Names: 730 proposed by six agents, 492 approved by the main session. The finished categories are at zero QA warnings and validate with their languages; `plantas` and `clima` carry the languages of the icons drawn so far.

## Files
- `approved.json`: the approved names, `{ category: [{ name, meaning, drawing }] }`.
- `draw-args.json`: the drawing workflow's arguments (round, slots, each category's neighbors and note). Before launching, add `authorization` (the owner's words that asked for the run, quoted) and `todo`.
- `draw.template.js`: the drawing workflow, with the exact prompt each illustrator, critic, and languages agent receives. Replace `__APPROVED__` with the contents of `approved.json` and `__REPORTS__` with `{}`; the agents' checkout is `args.root`.
- `lang-plantas.json`, `lang-clima.json`: the languages agents' data, written to `src/i18n/` with `write-i18n.mjs` once each critic is done. The languages agent of `medio-ambiente` hasn't run: its data comes back from the workflow (save it here as `lang-medio-ambiente.json` before writing it).
- `reports/`: the illustrators' and critics' reports of the finished categories (counts, redesigns, drops), for the history entry and the sample. Add each new report as it comes back.
- `main-drops.json`: what the main session dropped after the critics, with the reason for each in Spanish (the owner reads them in the sample).
- `write-i18n.mjs`, `drop-blocks.mjs`: the helpers for languages and for drops.
- `sample/`: the owner's sample (`build.mjs` and its `template.html`): every new icon by category and the main session's drops with their reasons. After the full build, `node round-11/sample/build.mjs <out.html>`, published as a private artifact for the owner.

## Running it on another machine
- `npm ci` (Node 22 or later), and Chrome installed: every agent draws its sheets and runs QA in its own headless Chrome (`CHROME` for a path other than the usual one).
- The drawing runs with Claude Code's Workflow tool, which needs the owner's explicit request (for example «lanza el dibujo» or «usa un workflow»). Quote the owner's words in `authorization`, and pass `root` with this checkout's absolute path (forward slashes on Windows).
- The main session does what the agents don't: it writes the languages, looks at every category's sheet against [DESIGN.md](../DESIGN.md) › "What failed before" and drops what doesn't read at 24 px, and closes the round. Nothing is committed to `main` until the round closes.

## Resume
Launch the workflow with `slots: 2` and only what is left:
```json
{ "plantas": ["critic"], "clima": ["draw", "critic"], "medio-ambiente": ["draw", "lang", "critic"] }
```
The illustrator of `clima` continues from its file; the critic of `plantas` runs without the illustrator's report (it was cut) and judges the file as it is. Relaunch with `todo`, not with a resume of an earlier run: a resume can rerun critics that had finished. Watch the disk: every agent runs its own Chrome, and a full disk stops them all; under 4 GB free, stop the run and relaunch what's left later.

## Close
As round 10 did ([What round 10 added](../docs/production.md)):
1. Each category: languages with `write-i18n.mjs`, `build.mjs --check`, its sheet looked at by the main session, what still doesn't read dropped with `drop-blocks.mjs` and added to `main-drops.json`.
2. In a clean worktree holding only the round's files: the full build, the full QA, the tests, and the fonts (`src/codepoints.json` gets the new codepoints).
3. The owner's sample (`sample/build.mjs`), then the docs: `history.md`, `roadmap.md`, and a `DESIGN.md` lesson if the round taught one.
4. Delete `round-11/`, merge into `main`, push, and run `npm run gota:sync` in `flouvia-web` for the explorer.
