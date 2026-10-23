# Production with agents

> **Scope:** how icons are drawn in rounds of parallel agents, what each agent receives, and how the work is reviewed. Each round's scripts live in the Claude Code session that launched it; what's essential to repeat them is kept here.

[← Index](./README.md)

## What a round looks like
- The main session launches it with the workflows tool: one **pipeline** per category (each category moves forward on its own, without waiting for the others).
- On an 8-core Mac, **6 agents run at a time**; the rest wait their turn.
- Observed pace: ~1,000 icons (9 categories × ~105, with a critic) in about 3 hours.
- Agents work only in this repo, edit **only** their own file (`src/icons/<category>.mjs` or `src/i18n/<category>.json`), and don't commit or install anything. The main session reviews, runs QA, and commits.
- Their cwd is usually another repo (`flouvia-web`): they're told explicitly to work in `~/Desktop/flouvia-icons` and that the startup steps of that other repo don't apply.
- **Authorization:** agents read the owner's last message to know what was asked; if it's a question, they refuse to edit. Every assignment quotes the owner's explicit authorization (their message), and a round is launched right after they ask for it.
- **Temporary files:** each agent uses its own folder (`mktemp -d`); never a shared one (in round 2 one agent overwrote another's prototype).

## What every drawing agent receives
1. Read `DESIGN.md`, `engine/geometry.mjs`, and `src/icons/nucleo.mjs` in full, and look at the core set's sheets: the core is the benchmark.
2. Apple level, original metaphors, nothing copied from other libraries, nothing translucent.
3. The file format and the list of names already in use.
4. Its category with an **explicit scope**, and the list of the other categories (so it doesn't step on them).
5. A process in batches of ~20: draw → `build.mjs --check` → `sheet.mjs` → **open every PNG with Read** → fix. Before returning, `qa.mjs <category>` and `weights-sheet.mjs <category>`: the structure holds from 0.9 to 2.1 ([`DESIGN.md`](../DESIGN.md#every-weight-one-structure)).
6. Return a structured result: category, count, names, and notes.

## Round 1 — base drawing (21 Oct 2026)
A pipeline per category: **illustrator → independent critic**. The critic doesn't trust the illustrator: it opens every page, redesigns the weak icons (rather than touching them up), watches the signature, keylines, knockouts, spacing, and legibility at 18 px, and leaves ≥ 100 good ones.
| Category (`id`) | Scope |
|---|---|
| Navigation (`navegacion`) | Arrows in 8 directions and variants, chevrons, carets, expand, sort, undo, menus, panels, views, filter, cursor |
| Editing and text (`edicion`) | Copy, paste, delete, text formatting, alignment, lists, image, brushes, zoom, bookmarks, share, download |
| Communication and people (`comunicacion`) | Bubbles (`drop()`), mail, calls, video, microphone, notifications, people, contacts, reactions |
| Files and cloud (`archivos`) | Files by type and state, folders, cloud, drives, attachments, clipboard, books, versions |
| Commerce and finance (`comercio`) | Cart, bag, store, receipt, invoice, price, coupon, wallet, cards, money, bank, shipping, inventory |
| Data and development (`datos`) | Charts, trends, dashboards, code, git, APIs, servers, networks, AI, deployment, monitoring |
| Devices and media (`dispositivos`) | Phone, laptop, peripherals, battery, connectivity, playback controls, audio, video, photo |
| Time, places, and nature (`lugares`) | Calendar, clocks, maps, buildings, transportation, weather, nature |
| System, security, and status (`sistema`) | Locks, shields, biometrics, settings, power, session, info/help/alert, statuses, awards, tools |
The core set (`nucleo`, 50) was drawn by the main session and is the reference.

## Round 2 — completing the first ~1,000 (22 Oct 2026)
1. **Coverage** (1 agent, first and alone): a list of common UI/web/business concepts, checked against the names and tags of the whole set, and drawing whatever is missing in its proper category.
2. For each of the 10 categories, in parallel:
   - **Design:** moves every badge to the engine's `badge` (no hand cuts) and every pointer to `cursor()`; `fill` (or `false`), `variants` to turn off, `mirror`, `levels`, `parts` (required with motion, levels, or a badge; `level`/`progress` on quantity icons), `motion`, `small` wherever 16 px doesn't read, drawing order in `d`; leaves its category's `qa.mjs` at **zero warnings** (`area`, `dense`, `silhouette`, `double`, `loose`, `near`). It doesn't rename, add, or remove icons.
   - **Languages:** `src/i18n/<category>.json` with the 10 labels and ≥ 6 search keywords in es and en, chosen by meaning and use. It doesn't touch the `.mjs` files.
3. The main session runs the full `qa.mjs`, fixes, presents a sample to the owner, and commits.

## Rounds 3 onward — scaling to 10,000
Each round draws the categories the [taxonomy](./taxonomy.md) gives it, about 1,000 icons:
1. **Names** for the whole round first: an agent per category, deduplication in code, and one judge ([how](./taxonomy.md#how-a-round-uses-it)). What comes out is the list each illustrator draws.
2. **A pipeline per category: illustrator → critic.** The illustrator delivers **everything at once** (outline, fill, 16 px, parts, motion, levels, mirroring, and `src/i18n/<category>.json`), starting a new file from its taxonomy entry (`category` is its `id`, `label` its Spanish label). The critic, independent as in round 1, opens every sheet, redesigns what's weak, and leaves the category at zero QA warnings.
3. **The main session** runs the full QA, looks at the sheets, presents a sample to the owner, commits, and redeploys `gota.flouvia.com` so the MCP server serves the new icons.

About 31 agents per round (10 for names, 1 judge, 10 illustrators, 10 critics), 6 at a time.
