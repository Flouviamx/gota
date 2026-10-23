#!/usr/bin/env node
// Gota · gota-migrate: moves a codebase from Lucide, Heroicons, or SF Symbols to Gota (the transforms
// are in ./transform.mjs, the maps in @flouvia/gota/migrate).
//   gota-migrate [paths…]           shows every change and note; writes nothing
//   gota-migrate --write [paths…]   writes the changes
// Paths default to the current folder. It reads .js, .jsx, .ts, .tsx, .mjs, .cjs, .mts, .cts, .vue,
// .astro, and .swift, and skips node_modules, .git, build outputs, Pods, and DerivedData.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { transformScript, transformSwift } from './transform.mjs';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('gota-migrate [--write] [paths…]\nMoves Lucide, Heroicons, and SF Symbols to Gota. Without --write it only shows what would change.');
  process.exit(0);
}
const write = args.includes('--write');
const roots = args.filter((a) => !a.startsWith('-'));
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.output', '.svelte-kit', '.astro', '.vercel', '.turbo', 'coverage', 'Pods', 'DerivedData', '.build']);
const SCRIPTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.astro']);

function* walk(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    yield path;
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory() && !SKIP.has(entry.name)) yield* walk(join(path, entry.name));
    else if (entry.isFile() && (SCRIPTS.has(extname(entry.name)) || extname(entry.name) === '.swift')) yield join(path, entry.name);
  }
}

let files = 0;
let edits = 0;
let notes = 0;
let swift = false;
for (const root of roots.length ? roots : ['.'])
  for (const file of walk(root)) {
    const ext = extname(file);
    const code = readFileSync(file, 'utf8');
    const isSwift = ext === '.swift';
    if (isSwift ? !/system(?:Name|Image|SymbolName):/.test(code) : !/lucide-|@heroicons\//.test(code)) continue;
    const result = isSwift ? transformSwift(code) : transformScript(code);
    if (!result.edits.length && !result.notes.length) continue;
    const name = relative(process.cwd(), file) || file;
    console.log(`\n${name}`);
    for (const e of result.edits) {
      console.log(`  ${e.line}:`);
      for (const l of e.before.split('\n')) console.log(`    - ${l}`);
      for (const l of e.after.split('\n')) console.log(`    + ${l}`);
    }
    for (const n of result.notes) console.log(`  note ${n}`);
    if (result.edits.length) {
      files++;
      edits += result.edits.length;
      swift ||= isSwift;
      if (write) writeFileSync(file, result.code);
    }
    notes += result.notes.length;
  }

console.log(`\n${write ? 'Changed' : 'Would change'} ${files} file(s), ${edits} edit(s); ${notes} note(s) to look at.`);
if (files && !write) console.log('Run again with --write to apply.');
if (files) console.log('Add @flouvia/gota to the project; once nothing imports the old set, remove it.');
if (swift) console.log('Swift: add Gota.xcassets (Gota\'s Xcode symbols) to the target.');
