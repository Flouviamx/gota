// A round's proposed names, checked against the whole set and against each other before anything
// is drawn (docs/taxonomy.md › How a round uses it). It reads { category: [{ name, meaning }] } and
// prints the conflicts a judge settles:
// - invalid: not English kebab-case, or a category not in src/taxonomy.json,
// - taken: the name already exists (and where),
// - twice: two categories of the round propose it,
// - same words: an existing or proposed name with the same words in another order,
// - contains: an existing name made of a subset of its words (gauge ⊂ chart-gauge), or the reverse,
//   other than its family's base (calendar → calendar-week),
// - search: the set's search, given the name, finds an icon that matches every word.
// Usage: node scripts/names.mjs <proposals.json> [--json]
import { readFileSync } from 'node:fs';
import { buildIndex, fold, search } from '../engine/search.mjs';
import { loadAll } from './load.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/names.mjs <proposals.json> [--json]');
  process.exit(1);
}
const proposals = JSON.parse(readFileSync(file, 'utf8'));
const { categories, taxonomy } = await loadAll();
const icons = {};
const i18n = {};
for (const c of categories) {
  for (const [name, icon] of Object.entries(c.icons)) icons[name] = { category: c.category, tags: icon.tags };
  Object.assign(i18n, c.i18n ?? {});
}
const index = buildIndex(icons, i18n);
const entries = new Map(index.map((e) => [e.name, e]));
const planned = new Set(taxonomy.categories.map((c) => c.id));
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A name's words, folded and singular, as a sorted key
const words = (name) => fold(name.replace(/-/g, ' ')).split(' ').map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
const key = (name) => [...new Set(words(name))].sort().join(' ');

const existing = new Map();
for (const name of Object.keys(icons)) existing.set(key(name), [...(existing.get(key(name)) ?? []), name]);
const proposedBy = new Map();
for (const [cat, list] of Object.entries(proposals)) for (const p of list) proposedBy.set(p.name, [...(proposedBy.get(p.name) ?? []), cat]);
const byKey = new Map();
for (const [cat, list] of Object.entries(proposals)) for (const p of list) byKey.set(key(p.name), [...(byKey.get(key(p.name)) ?? []), `${cat}/${p.name}`]);

const report = {};
let total = 0;
for (const [cat, list] of Object.entries(proposals)) {
  const out = [];
  if (!planned.has(cat)) out.push({ name: '*', conflict: 'invalid', detail: `${cat} is not in src/taxonomy.json` });
  for (const p of list) {
    const add = (conflict, detail) => out.push({ name: p.name, conflict, detail });
    if (!NAME.test(p.name ?? '')) {
      add('invalid', 'not English kebab-case');
      continue;
    }
    if (icons[p.name]) add('taken', `exists in ${icons[p.name].category}`);
    if (proposedBy.get(p.name).length > 1) add('twice', `also proposed by ${proposedBy.get(p.name).filter((c) => c !== cat).join(', ')}`);
    const k = key(p.name);
    for (const other of existing.get(k) ?? []) if (other !== p.name) add('same words', `${other} (${icons[other].category})`);
    for (const other of byKey.get(k) ?? []) if (other !== `${cat}/${p.name}` && !other.endsWith(`/${p.name}`)) add('same words', `${other} (proposed)`);
    const mine = new Set(k.split(' '));
    for (const [ek, names] of existing) {
      const theirs = ek.split(' ');
      if (ek === k) continue;
      const subset = theirs.every((w) => mine.has(w));
      const superset = [...mine].every((w) => theirs.includes(w));
      if ((subset && theirs.length >= 1 && mine.size > theirs.length) || (superset && mine.size >= 1 && theirs.length > mine.size && mine.size >= 2))
        // A family's base before its variants (calendar → calendar-week) is not a conflict
        for (const n of names) if (n !== p.name && !p.name.startsWith(`${n}-`)) add('contains', `${n} (${icons[n].category})`);
    }
    // The search's best hits that hold every word of the name as a whole word somewhere (name,
    // labels, keywords, or tags)
    const asked = words(p.name);
    const hits = search(index, p.name.replace(/-/g, ' '), { limit: 3 }).filter((r) => r.name !== p.name && asked.every((w) => Object.values(entries.get(r.name).fields).some((f) => f.includes(w))));
    for (const r of hits) if (!out.some((o) => o.name === p.name && o.detail.startsWith(`${r.name} `))) add('search', `${r.name} (${icons[r.name].category})`);
  }
  report[cat] = out;
  total += out.length;
}

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 1));
else {
  for (const [cat, out] of Object.entries(report)) {
    console.log(`\n## ${cat}: ${proposals[cat].length} proposed, ${new Set(out.map((o) => o.name)).size} with conflicts`);
    for (const o of out) console.log(`  ${o.name.padEnd(28)} ${o.conflict.padEnd(11)} ${o.detail}`);
  }
  console.log(`\n${total} conflicts in ${Object.keys(proposals).length} categories`);
}
