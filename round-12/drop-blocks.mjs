// Drops icons from a category file after the main session's review: for each name, the top-level
// `{ … }` block holding its add()/put() call, with the comment lines right above it, plus any single
// line elsewhere keyed by its name (MOTION, PARTS maps). It refuses a block that holds more than one
// icon. Prints what it would cut; --write cuts it. Then run write-i18n.mjs for the category.
// Usage: node round-11/drop-blocks.mjs src/icons/<category>.mjs <name>… [--write]
import { readFileSync, writeFileSync } from 'node:fs';

const [file, ...rest] = process.argv.slice(2);
const write = rest.includes('--write');
const names = rest.filter((x) => x !== '--write');
const L = readFileSync(file, 'utf8').split('\n');
const cuts = [];
for (const n of names) {
  const call = new RegExp(`\\b(add|put)\\(['"]${n}['"]`);
  const at = L.findIndex((l) => call.test(l));
  if (at < 0) throw new Error(`${n}: no add() or put()`);
  let a = at;
  while (a > 0 && L[a] !== '{') a--;
  let b = at;
  while (b < L.length && L[b] !== '}') b++;
  if (L[a] !== '{' || L[b] !== '}') throw new Error(`${n}: not in a top-level block`);
  const calls = L.slice(a, b + 1).filter((l) => /\b(add|put)\(['"]/.test(l)).length;
  if (calls !== 1) throw new Error(`${n}: its block holds ${calls} icons`);
  while (a > 0 && L[a - 1].trimStart().startsWith('//')) a--;
  cuts.push([a, b, n]);
  const key = new RegExp(`^\\s*(['"]${n}['"]|${/^[a-z]+$/.test(n) ? n : '\\0'}):`);
  L.forEach((l, i) => {
    if ((i < a || i > b) && key.test(l)) cuts.push([i, i, `${n} (key)`]);
  });
  const named = L.findIndex((l, i) => (i < a || i > b) && l.includes(`'${n}'`) && !key.test(l));
  if (named >= 0) console.log(`  ! ${n} is still named at line ${named + 1}: ${L[named].trim().slice(0, 120)}`);
}
for (const [a, b, n] of cuts) console.log(`${n}: lines ${a + 1}-${b + 1}`);
if (write) {
  for (const [a, b] of cuts.sort((x, y) => y[0] - x[0])) L.splice(a, b - a + 1);
  writeFileSync(file, L.join('\n'));
  console.log('written');
}
