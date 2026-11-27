// Adds round 12's languages to src/i18n/<category>.json from the languages agents' data
// (round-12/lang-<group>.json, { i18n: { name: entry } }). The sweep draws into categories that
// already exist, so each file starts from its text on `main` (never rewritten) and gets the round's
// icons still in the category's file appended, in the file's order: a name dropped later simply
// isn't appended, and the script can run again at any time.
// Run it after a group's critic and after any main-session drop.
// Usage (from the repository root): node round-12/write-i18n.mjs <category>… | --all
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve('.');
const R = join(ROOT, 'round-12');
const approved = JSON.parse(readFileSync(join(R, 'approved.json'), 'utf8'));
const args = process.argv.slice(2);
const cats = args.includes('--all') ? Object.keys(approved) : args;
if (!cats.length) throw new Error('usage: node round-12/write-i18n.mjs <category>… | --all');

// Every languages file the agents returned, merged by name
const lang = {};
for (const f of readdirSync(R).filter((f) => /^lang-.+\.json$/.test(f))) Object.assign(lang, JSON.parse(readFileSync(join(R, f), 'utf8')).i18n);

const LANGS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ar'];
const q = (s) => JSON.stringify(s);
const entry = (n, { label, keywords }) => {
  for (const l of LANGS) if (!label?.[l]) throw new Error(`${n}: no ${l} label`);
  return `  ${q(n)}: {\n    "label": { ${LANGS.map((l) => `${q(l)}: ${q(label[l])}`).join(', ')} },\n    "keywords": {\n      "es": [${keywords.es.map(q).join(', ')}],\n      "en": [${keywords.en.map(q).join(', ')}]\n    }\n  }`;
};

for (const cat of cats) {
  const round = new Set((approved[cat] ?? []).map((x) => x.name));
  const base = execFileSync('git', ['show', `main:src/i18n/${cat}.json`], { cwd: ROOT, encoding: 'utf8' });
  const before = JSON.parse(base);
  const { default: d } = await import(pathToFileURL(join(ROOT, 'src/icons', `${cat}.mjs`)).href);
  const added = Object.keys(d.icons).filter((n) => round.has(n) && !before[n]);
  const missing = added.filter((n) => !lang[n]);
  if (missing.length) throw new Error(`${cat}: no languages for ${missing.join(', ')}`);
  const head = base.replace(/\n\}\s*$/, '');
  writeFileSync(join(ROOT, 'src/i18n', `${cat}.json`), added.length ? `${head},\n${added.map((n) => entry(n, lang[n])).join(',\n')}\n}\n` : base);
  console.log(`${cat}: ${added.length} of the round's ${round.size} added (${Object.keys(before).length + added.length} in all)`);
}
