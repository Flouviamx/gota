export const meta = {
  name: 'gota-draw-round-12',
  description: 'Gota round 12, the sweep: draw the approved names into the categories that already exist, with languages and an independent critic per domain group',
  phases: [
    { title: 'Draw', detail: 'illustrator per domain group, adding to its categories’ files' },
    { title: 'Languages', detail: 'labels in 10 languages and keywords, returned as data' },
    { title: 'Critic', detail: 'independent review of the round’s new icons, zero QA warnings' },
  ],
}

// args: { round, slots, authorization, root, groups: [{ id, domains, categories: [{ id, count }], count }], todo: { id: [steps] }, reports?, cut? }
const GROUPS = args.groups.filter((g) => args.todo[g.id])
const wants = (g, step) => args.todo[g.id].includes(step)

const ROOT = args.root
const PRE = `cd ${ROOT} && export TEMP=F:/gota-tmp TMP=F:/gota-tmp &&`
const COMMON = `You are working on Gota, Flouvia's MIT icon library, in ${ROOT}. Your cwd may be another repository (flouvia): ignore its startup steps and instructions (doctor, git pull, Linear) and work only in ${ROOT}. The owner authorized this round explicitly, in their own words: «${args.authorization}». This is round ${args.round}, the sweep: the last round before v1 (decision 89 in docs/decisions.md).
This machine is Windows; use the Bash tool (Git Bash). Start EVERY command with \`${PRE}\` so the scripts' Chrome profiles and temporary files go to drive F:. \`node scripts/qa.mjs\` measures the whole set every time (several minutes on this machine): give it all your categories at once, separated by commas, in the foreground with a long timeout. Open images with the Read tool by their full path, e.g. ${ROOT}/previews/<file>.png.
Rules: never commit, push, or install anything. Temporary files only in your own folder made with \`mktemp -d -p F:/gota-tmp\`. Other agents work at the same time on other categories in the same tree: never touch a file that isn't yours, and ignore errors that \`build.mjs --check\` reports for other categories. Never read or use anything from C:/Users/PC/Desktop/flouvia: Flouvia's private brand, including its typeface Flouvia Sans, must never reach Gota.
Unlike earlier rounds, the sweep draws into categories that already exist. A category's existing icons are not yours: never change, rename, move, or remove one.`

const list = (g) => g.categories.map((c) => `${c.id} (${c.count})`).join(', ')
const approvedRef = (g) => `The round's approved names are in ${ROOT}/round-12/approved.json, by category; yours are those of ${list(g)}: ${g.count} in all. Each has its name, its meaning (what it shows and when it's used), the nearest existing Gota icon ("closest"), why that one isn't the same ("why"), and where the name came from ("source"). Read your entries in full first.`
const cats = (g) => g.categories.map((c) => c.id).join(',')

const illustrator = (g) => `${COMMON}

Your job: draw the round's approved names for the domain group \`${g.id}\`: ${list(g)}. You edit only src/icons/<category>.mjs of those categories. If an earlier run was interrupted, some are already drawn: keep what is good, finish the rest.
${approvedRef(g)}

Read first, in full: DESIGN.md, docs/format.md, engine/geometry.mjs (the primitives; badge() with its kinds plus, minus, check, x, alert, info, question, clock, block, arrow-up/down/left/right, star, search, heart, sync, edit, gear, lock, dot; turn, turnPath, and flipPath for directions; gear; cursor), and src/icons/nucleo.mjs (the reference: its structure and its drawings are the bar). Then look at the core set (\`node scripts/sheet.mjs nucleo\`, previews/nucleo-1.png and nucleo-2.png) and at the sheet of EVERY category of yours (\`node scripts/sheet.mjs <category>\`, every page), so each new icon belongs to its category's family.

Add each new icon to its category's file the way that file already does it: its own helpers (add(), put(), or icons[...] = …), its own pieces and constants, its blocks for fill, parts, motion, mirror, levels, and variants. Most of the round's names extend a family the file already has (a badge state, a kind, a variant): build exactly on that family's base, so the new icon reads as its sibling. A badge state is always badge() on the family's base, never a hand-drawn mark.

Every icon at once: the outline (\`d\`), \`tags\` (at least three words, Spanish and English), the fill (\`fill\`, or \`false\` for line-only icons), \`small\` wherever 16 px doesn't read after the engine snaps it, \`parts\` (required with motion, levels, or a badge), \`motion\` where the icon has a natural gesture, \`levels\` for quantity icons, \`mirror: true\` for directional ones, and \`variants\` to turn off an enclosure or a slash that says nothing. Languages are written by another agent: never create or edit src/i18n/ files, and ignore \`i18n/... missing\` errors.

The bar is Apple's: original metaphors built from geometry, nothing copied from another library, nothing translucent; the signature (square bottom-right corner on containers, the drop for bubbles), the keylines, knockouts with the engine's clearance (never trim by hand: badges with badge()), few strokes, legible at 18 px; directions drawn once and turned. Check every icon against DESIGN.md › "What failed before".

Work category by category, in batches of about 20: draw → \`node scripts/build.mjs --check <category>\` (fix every error of the new icons) → \`node scripts/sheet.mjs <category>\` → open EVERY page and look at each new icon next to its siblings → fix. Also \`node scripts/variants-sheet.mjs <category>\` (fill, weights, enclosures, slash, 16 px, mirror). Before returning: \`node scripts/qa.mjs ${cats(g)}\` at zero warnings for the round's icons (area, dense, silhouette, double, loose, open, near, weights; a warning on an icon that existed before the round isn't yours: report it, don't touch it) and \`node scripts/weights-sheet.mjs <category>\` for each category.

You may drop an approved name you can't make good (say why); never add or rename one.`

const languages = (g) => `${COMMON}

Your job: the languages of the round's new icons for the domain group \`${g.id}\` (${list(g)}). You edit NO file: you return the entries as data and the main session writes them to src/i18n/<category>.json.
${approvedRef(g)} Write an entry for every one of them, using its name and meaning.

Read DESIGN.md › "Languages and search" and, for each of your categories, its src/i18n/<category>.json (tone, format, and the labels its family already uses, so a new sibling is named like the others). For every icon, an entry keyed by its name:
{ "label": { "es", "en", "pt", "fr", "de", "it", "ja", "zh", "ko", "ar" }, "keywords": { "es": [6–8], "en": [6–8] } }
- label: the accessibility label, short and natural in each language (what it shows or does), never a literal translation of the kebab name; capitalized where the language does so.
- keywords: synonyms and uses, what someone would type to find it, Mexican Spanish for es; don't repeat the label or pad the list.
- A label in any language can outrank an older icon's keyword in search (round 10: hopscotch's Italian «Campana» came before the bell for «campana»): don't give a new icon a bare label that is another, more common icon's name.`

const critic = (g, draw) => `${COMMON}

You are the independent critic of round ${args.round} for the domain group \`${g.id}\` (${list(g)}). The round's new icons in those categories' files are its illustrator's work; the icons that were there before aren't the round's and aren't yours. Don't trust any report. You edit only the round's icons in src/icons/<category>.mjs of those categories.
${approvedRef(g)}

Read DESIGN.md, docs/format.md, engine/geometry.mjs, and src/icons/nucleo.mjs, and look at the core's sheet (\`node scripts/sheet.mjs nucleo\`, previews/nucleo-1.png and -2.png): that is the bar. Then, for each category, open EVERY page of \`node scripts/sheet.mjs <category>\` and \`node scripts/variants-sheet.mjs <category>\` with Read and judge every new icon: does it say its meaning at a glance and differently from its siblings and the rest of the set; does it build on its family's base exactly; the signature; keylines and optical size; knockouts and clearances; spacing; stroke count; legibility at 18 and 16 px; the fill; mirroring; the structure across weights; and DESIGN.md › "What failed before". Redesign the weak ones (redraw, don't touch up). Drop what can't reach the bar and list it. Never rename or add an icon. Languages are another agent's: ignore \`i18n/... missing\` errors.

Leave \`node scripts/build.mjs --check <category>\` clean for the new icons' drawings and \`node scripts/qa.mjs ${cats(g)}\` at zero warnings for the round's icons (report, don't touch, a warning on an older icon), and look at \`node scripts/weights-sheet.mjs <category>\` for each category.

The illustrator reported: ${draw ? JSON.stringify({ count: draw.count, dropped: draw.dropped, notes: draw.notes }) : 'nothing (its run was cut before it reported): judge the files as they are now'}${args.cut?.[g.id] ? `\n\nAn earlier run was cut partway: ${args.cut[g.id]}` : ''}`

const DROPPED = { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] } }
const DRAW_SCHEMA = {
  type: 'object',
  properties: { group: { type: 'string' }, count: { type: 'number' }, names: { type: 'array', items: { type: 'string' } }, dropped: DROPPED, qaWarnings: { type: 'number' }, notes: { type: 'string' } },
  required: ['group', 'count', 'names', 'dropped', 'qaWarnings'],
}
const LANG_SCHEMA = { type: 'object', properties: { group: { type: 'string' }, i18n: { type: 'object' } }, required: ['group', 'i18n'] }
const CRITIC_SCHEMA = {
  type: 'object',
  properties: { group: { type: 'string' }, count: { type: 'number' }, redesigned: { type: 'array', items: { type: 'string' } }, dropped: DROPPED, qaWarnings: { type: 'number' }, notes: { type: 'string' } },
  required: ['group', 'count', 'redesigned', 'dropped', 'qaWarnings'],
}

// One group's whole run: illustrator and languages side by side, then its critic
const runGroup = (g) =>
  parallel([
    () => (wants(g, 'draw') ? agent(illustrator(g), { label: `draw:${g.id}`, phase: 'Draw', schema: DRAW_SCHEMA }) : null),
    () => (wants(g, 'lang') ? agent(languages(g), { label: `lang:${g.id}`, phase: 'Languages', schema: LANG_SCHEMA }) : null),
  ])
    .then(([draw, lang]) => ({ id: g.id, draw, lang }))
    .then((prev) => {
      // An illustrator that didn't finish leaves its group for a relaunch, not for the critic
      if (wants(g, 'draw') && !prev.draw) return { ...prev, critic: null }
      if (!wants(g, 'critic')) return prev
      return agent(critic(g, prev.draw ?? args.reports?.[g.id]), { label: `critic:${g.id}`, phase: 'Critic', schema: CRITIC_SCHEMA }).then((critic) => ({ ...prev, critic }))
    })
    .then((r) => {
      log(`${r.id}: draw ${r.draw ? r.draw.count : '—'}, lang ${r.lang ? Object.keys(r.lang.i18n).length : '—'}, critic ${r.critic ? r.critic.count : '—'}`)
      return r
    })

// At most args.slots groups at work at once (each runs its own Chrome for the sheets and QA)
const SLOTS = args.slots ?? GROUPS.length
const results = []
let next = 0
await Promise.all(
  Array.from({ length: Math.min(SLOTS, GROUPS.length) }, async () => {
    while (next < GROUPS.length) {
      const k = next++
      results[k] = await runGroup(GROUPS[k]).catch(() => null)
    }
  }),
)
return results.filter(Boolean)
