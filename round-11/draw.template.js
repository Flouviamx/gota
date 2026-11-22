export const meta = {
  name: 'gota-draw',
  description: 'Gota, a round\'s drawing: per category an illustrator then an independent critic, with a languages agent beside them',
  phases: [
    { title: 'Draw', detail: 'illustrator per category (everything at once but languages)' },
    { title: 'Languages', detail: 'labels in 10 languages and keywords, returned as data' },
    { title: 'Critic', detail: 'independent review, redesign, zero QA warnings' },
  ],
}

// The approved names per category, from the judge: { id: [{ name, meaning, drawing }] }
const APPROVED = __APPROVED__
// The illustrators' reports from an earlier run, for the critics of categories already drawn
const REPORTS = __REPORTS__

// args.categories: [{ id, growth?, neighbors, note? }]; args.todo (optional): { id: ['draw', 'lang', 'critic'] }
// to relaunch only what an interruption left undone
const CATS = args.categories.filter((c) => APPROVED[c.id] && (!args.todo || args.todo[c.id]))
const wants = (c, step) => !args.todo || args.todo[c.id].includes(step)

const ROOT = '/Users/andrevalleortega/Desktop/flouvia-icons'
const COMMON = `You are working on Gota, Flouvia's MIT icon library, in ${ROOT}. Your cwd may be another repository (flouvia-web): ignore its startup steps and instructions and work only in ${ROOT}, with absolute paths or \`cd ${ROOT}\` in each command. The owner authorized this round explicitly, in their own words: ${args.authorization}. This is round ${args.round} of nine toward 10,000 icons.
Rules: never commit, push, or install anything. Temporary files only in your own folder made with \`mktemp -d\`. Other agents are working at the same time on other categories in the same tree: never touch a file that isn't yours, and ignore errors that \`build.mjs --check\` reports for other categories. Never read or use anything from ~/Desktop/flouvia: Flouvia's private brand, including its typeface Flouvia Sans, must never reach Gota.`

const list = (names) => names.map((n) => `- ${n.name}: ${n.meaning} — ${n.drawing}`).join('\n')

const illustrator = (c) => `${COMMON}

Your job: draw category \`${c.id}\` for round ${args.round}: the ${APPROVED[c.id].length} approved icons at the end of this message, ${c.growth ? `added to the existing src/icons/${c.id}.mjs. Never change its existing icons; add yours following the file's structure.` : `in the new file src/icons/${c.id}.mjs. If it already exists (an earlier run was interrupted), continue from what is there: keep what is good, finish the rest.`} You edit only src/icons/${c.id}.mjs.

Read first, in full: DESIGN.md, docs/format.md, engine/geometry.mjs (the primitives; badge() with its kinds plus, minus, check, x, alert, info, question, clock, block, arrow-up/down/left/right, star, search, heart, sync, edit, gear, lock, dot; turn, turnPath, and flipPath for directions; gear; cursor), src/icons/nucleo.mjs (the reference: its structure and its drawings are the bar), and your entry in src/taxonomy.json. Then look at the core set: \`node scripts/sheet.mjs nucleo\` and open previews/nucleo-1.png and nucleo-2.png with Read. Look also at the sheets of ${c.neighbors.join(', ')} (\`node scripts/sheet.mjs <category>\`, open their pages) so your icons belong to the same family.
${c.growth ? '' : `
A new file ends with \`export default { category: '${c.id}', label: '<its Spanish label, exactly as in src/taxonomy.json>', icons };\` and imports from ../../engine/geometry.mjs (./nucleo.mjs when you reuse a core piece). Follow nucleo.mjs: the icons first, then fill, parts, motion, mirror, levels, and variants assigned in blocks at the end.`}
${c.note ? `\n${c.note}\n` : ''}
Every icon at once: the outline (\`d\`), \`tags\` (at least three words, Spanish and English), the fill (\`fill\`, or \`false\` for line-only icons), \`small\` wherever 16 px doesn't read after the engine snaps it, \`parts\` (required with motion, levels, or a badge), \`motion\` where the icon has a natural gesture, \`levels\` for quantity icons, \`mirror: true\` for directional ones, and \`variants\` to turn off an enclosure or a slash that says nothing. Languages are written by another agent: never create or edit src/i18n/ files, and ignore \`i18n/... missing\` errors.

The bar is Apple's: original metaphors built from geometry, nothing copied from another library, nothing translucent; the signature (square bottom-right corner on containers, the drop for bubbles), the keylines, knockouts with the engine's clearance (never trim by hand: badges with badge()), few strokes, legible at 18 px; directions drawn once and turned.

Work in batches of about 20: draw → \`node scripts/build.mjs --check ${c.id}\` (fix every error of your category) → \`node scripts/sheet.mjs ${c.id}\` → open EVERY page previews/${c.id}-<n>.png with Read and look at each icon → fix. Also \`node scripts/variants-sheet.mjs ${c.id}\` (fill, weights, enclosures, slash, 16 px, mirror; open its pages). Before returning: \`node scripts/qa.mjs ${c.id}\` at zero warnings for your icons (area, dense, silhouette, double, loose, open, near, weights) and \`node scripts/weights-sheet.mjs ${c.id}\` (the structure holds from 0.9 to 2.1).

You may drop an approved icon you can't make good (say why); never add or rename one.

APPROVED ICONS (name: meaning — drawing idea):
${list(APPROVED[c.id])}`

const languages = (c) => `${COMMON}

Your job: the languages of category \`${c.id}\`'s new icons in round ${args.round}. You edit NO file: you return the entries as data and the main session writes them to src/i18n/${c.id}.json.

Read DESIGN.md › "Languages and search" and two existing files for tone and format, src/i18n/archivos.json and src/i18n/comunicacion.json. For every icon below, an entry keyed by its name:
{ "label": { "es", "en", "pt", "fr", "de", "it", "ja", "zh", "ko", "ar" }, "keywords": { "es": [6–8], "en": [6–8] } }
- label: the accessibility label, short and natural in each language (what it shows or does), never a literal translation of the kebab name; capitalized where the language does so.
- keywords: synonyms and uses, what someone would type to find it, Mexican Spanish for es; don't repeat the label or pad the list.

ICONS (name: meaning):
${APPROVED[c.id].map((n) => `- ${n.name}: ${n.meaning}`).join('\n')}`

const critic = (c, draw) => `${COMMON}

You are the independent critic of category \`${c.id}\` in round ${args.round}. Its illustrator just finished src/icons/${c.id}.mjs${c.growth ? ' (its new icons are the ones in the list below; the rest were approved in earlier rounds: leave them alone)' : ''}. Don't trust its report. You edit only src/icons/${c.id}.mjs.

Read DESIGN.md, docs/format.md, engine/geometry.mjs, and src/icons/nucleo.mjs, and look at the core's sheet (\`node scripts/sheet.mjs nucleo\`, previews/nucleo-1.png and -2.png): that is the bar. Then open EVERY page of \`node scripts/sheet.mjs ${c.id}\` and \`node scripts/variants-sheet.mjs ${c.id}\` with Read and judge every new icon: does it say its meaning at a glance and differently from its neighbors and the rest of the set; the signature; keylines and optical size; knockouts and clearances; spacing; stroke count; legibility at 18 and 16 px; the fill; mirroring; the structure across weights. Redesign the weak ones (redraw, don't touch up). Drop what can't reach the bar and list it. Never rename or add an icon. Languages are another agent's: ignore \`i18n/... missing\` errors.
${c.note ? `\n${c.note}\n` : ''}
Leave \`node scripts/build.mjs --check ${c.id}\` clean for drawings and \`node scripts/qa.mjs ${c.id}\` at zero warnings for the new icons, and look at \`node scripts/weights-sheet.mjs ${c.id}\`.

The illustrator reported: ${draw ? JSON.stringify({ count: draw.count, dropped: draw.dropped, notes: draw.notes }) : 'nothing (its run was interrupted): finish what it left'}

APPROVED ICONS (name: meaning — drawing idea):
${list(APPROVED[c.id])}`

const DRAW_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    count: { type: 'number' },
    names: { type: 'array', items: { type: 'string' } },
    dropped: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] } },
    qaWarnings: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['category', 'count', 'names', 'dropped', 'qaWarnings'],
}
const LANG_SCHEMA = {
  type: 'object',
  properties: { category: { type: 'string' }, i18n: { type: 'object' } },
  required: ['category', 'i18n'],
}
const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string' },
    count: { type: 'number' },
    redesigned: { type: 'array', items: { type: 'string' } },
    dropped: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, reason: { type: 'string' } }, required: ['name', 'reason'] } },
    qaWarnings: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['category', 'count', 'redesigned', 'dropped', 'qaWarnings'],
}

// One category's whole run: illustrator and languages side by side, then its critic
const runCategory = (c) =>
  parallel([
    () => (wants(c, 'draw') ? agent(illustrator(c), { label: `draw:${c.id}`, phase: 'Draw', schema: DRAW_SCHEMA }) : null),
    () => (wants(c, 'lang') ? agent(languages(c), { label: `lang:${c.id}`, phase: 'Languages', schema: LANG_SCHEMA }) : null),
  ])
    .then(([draw, lang]) => ({ id: c.id, draw, lang }))
    .then((prev) => {
      // An illustrator that didn't finish leaves its category for a relaunch, not for the critic
      if (wants(c, 'draw') && !prev.draw) return { ...prev, critic: null }
      if (!wants(c, 'critic')) return prev
      return agent(critic(c, prev.draw ?? REPORTS[c.id]), { label: `critic:${c.id}`, phase: 'Critic', schema: CRITIC_SCHEMA }).then((critic) => ({ ...prev, critic }))
    })
// At most args.slots categories at work at once (each runs its own Chrome for the sheets and QA):
// on an 8 GB machine six at a time filled the memory and the swap filled the disk
const SLOTS = args.slots ?? CATS.length
const results = []
let next = 0
await Promise.all(
  Array.from({ length: Math.min(SLOTS, CATS.length) }, async () => {
    while (next < CATS.length) {
      const k = next++
      results[k] = await runCategory(CATS[k]).catch(() => null)
    }
  }),
)
const done = results.filter(Boolean)
log(done.map((r) => `${r.id}: draw ${r.draw ? r.draw.count : '—'}, lang ${r.lang ? Object.keys(r.lang.i18n).length : '—'}, critic ${r.critic ? r.critic.count : '—'}`).join(' · '))
return done
