// Writes src/i18n/<category>.json from a languages agent's data (round-11/lang-<category>.json), only
// for the icons in the category's file as it is now, in the file's order and the layout of the other
// i18n files. Run it after the category's critic and after any main-session drop.
// Usage (from the repository root): node round-11/write-i18n.mjs <category>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const cat = process.argv[2];
if (!cat) throw new Error('usage: node round-11/write-i18n.mjs <category>');
const ROOT = resolve('.');
const { default: d } = await import(pathToFileURL(join(ROOT, 'src/icons', `${cat}.mjs`)).href);
const lang = JSON.parse(readFileSync(join(ROOT, 'round-11', `lang-${cat}.json`), 'utf8')).i18n;
const names = Object.keys(d.icons);
const missing = names.filter((n) => !lang[n]);
if (missing.length) throw new Error(`${cat}: no languages for ${missing.join(', ')}`);
const LANGS = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ja', 'zh', 'ko', 'ar'];
const q = (s) => JSON.stringify(s);
const entry = (n) => {
  const { label, keywords } = lang[n];
  for (const l of LANGS) if (!label[l]) throw new Error(`${cat}/${n}: no ${l} label`);
  return `  ${q(n)}: {\n    "label": { ${LANGS.map((l) => `${q(l)}: ${q(label[l])}`).join(', ')} },\n    "keywords": {\n      "es": [${keywords.es.map(q).join(', ')}],\n      "en": [${keywords.en.map(q).join(', ')}]\n    }\n  }`;
};
writeFileSync(join(ROOT, 'src/i18n', `${cat}.json`), `{\n${names.map(entry).join(',\n')}\n}\n`);
console.log(`${cat}: ${names.length} entries; ${Object.keys(lang).length - names.length} approved names not in the file left out`);
