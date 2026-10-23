// Migration (@flouvia/gota/migrate and the gota-migrate codemod): the maps' lookups, and the
// transforms on real-looking files. They read dist/, so run `node scripts/build.mjs` first.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { icons } from '../dist/index.js';
import { fromHeroicons, fromLucide, fromSFSymbol, maps } from '../dist/migrate.js';
import { transformScript, transformSwift } from '../migrate/transform.mjs';

test('migrate: lookups by name or component name, every target an icon', () => {
  assert.deepEqual(fromLucide('x'), { name: 'close' });
  assert.deepEqual(fromLucide('CircleCheck'), { name: 'check-circle' }); // the drawn icon, not an automatic enclosure
  assert.deepEqual(fromLucide('LucideBugOff'), { name: 'bug', slash: true });
  assert.deepEqual(fromLucide('CircleChevronsLeftIcon'), { name: 'chevrons-left', enclosure: 'circle' });
  assert.deepEqual(fromLucide('home'), fromLucide('house')); // an old Lucide name, kept as an alias
  assert.equal(fromLucide('Layers2'), null);
  assert.equal(fromLucide('toString'), null);
  assert.deepEqual(fromHeroicons('XMarkIcon'), { name: 'close' });
  assert.deepEqual(fromHeroicons('bell', { style: 'solid' }), { name: 'bell', variant: 'fill' });
  for (const map of Object.values(maps)) for (const to of Object.values(map)) assert.ok(icons[typeof to === 'string' ? to : to.name], JSON.stringify(to));
});

test('migrate: SF Symbols suffixes become variants, and a variant the icon can\'t take means no equivalent', () => {
  const [concept, target] = Object.entries(maps.sfSymbols).find(([, t]) => t === 'bell') ?? [];
  assert.ok(concept, 'an SF Symbols concept maps to bell');
  assert.deepEqual(fromSFSymbol(concept), { name: 'bell' });
  assert.deepEqual(fromSFSymbol(`${concept}.slash.circle.fill`), { name: target, variant: 'fill', enclosure: 'circle', slash: true });
  assert.deepEqual(fromSFSymbol(`${concept}.fill.ar`), { name: target, variant: 'fill' }); // a localized glyph is the same symbol
  const noSlash = Object.entries(maps.sfSymbols).find(([, t]) => icons[t].variants?.slash === false && !icons[`${t}-off`] && !icons[`${t}-slash`]);
  if (noSlash) assert.equal(fromSFSymbol(`${noSlash[0]}.slash`), null);
  assert.equal(fromSFSymbol('no.such.symbol'), null);
});

test('codemod: Lucide in React — same local names, props on every tag, stroke widths as named weights', () => {
  const before = `import { Bell, CircleChevronsLeft as Back, BugOff, Layers2, type LucideIcon } from 'lucide-react';
import * as All from 'lucide-react';

export function Bar({ w }) {
  return (
    <nav>
      <Bell strokeWidth={1.5} className="h-4" />
      <Bell strokeWidth={2} />
      <Bell strokeWidth={w} />
      <Back size={20} absoluteStrokeWidth onClick={() => go(a > b)} />
      <BugOff strokeWidth="3"></BugOff>
      <Layers2 />
    </nav>
  );
}
const items = [Back];
`;
  const { code, edits, notes } = transformScript(before);
  assert.equal(
    code,
    `import { Layers2, type LucideIcon } from 'lucide-react';
import { BellIcon as Bell, ChevronsLeftIcon as Back, BugIcon as BugOff } from '@flouvia/gota/react/icons';
import * as All from 'lucide-react';

export function Bar({ w }) {
  return (
    <nav>
      <Bell weight="light" className="h-4" />
      <Bell />
      <Bell strokeWidth={w} />
      <Back enclosure="circle" size={20} onClick={() => go(a > b)} />
      <BugOff slash weight="bold"></BugOff>
      <Layers2 />
    </nav>
  );
}
const items = [Back];
`,
  );
  assert.equal(edits.length, 5);
  const said = notes.join('\n');
  assert.match(said, /Layers2 has no Gota equivalent yet/);
  assert.match(said, /Bell keeps strokeWidth=\{w\}/);
  assert.match(said, /absoluteStrokeWidth was removed/);
  assert.match(said, /Back is used as a value: give it enclosure="circle"/);
  assert.match(said, /lucide-react is imported in a way the codemod doesn't move/);
  assert.doesNotMatch(said, /BugOff is used as a value/); // its closing tag is a tag, not a value
});

test('codemod: Heroicons solid is Gota\'s fill; Vue takes kebab-case tags', () => {
  const hero = transformScript(`import { BellIcon, GifIcon } from "@heroicons/react/24/solid";\nconst a = <BellIcon className="h-6 w-6" />;\n`);
  assert.equal(hero.code, `import { GifIcon } from "@heroicons/react/24/solid";\nimport { BellIcon } from "@flouvia/gota/react/icons";\nconst a = <BellIcon variant="fill" className="h-6 w-6" />;\n`);
  assert.match(hero.notes.join('\n'), /GifIcon has no Gota equivalent yet/);
  const vue = transformScript(`<template>\n  <bell-off :stroke-width="3" />\n  <BugOff />\n</template>\n<script setup>\nimport { BellOff, BugOff } from 'lucide-vue-next';\n</script>\n`);
  assert.equal(vue.code, `<template>\n  <bell-off weight="bold" />\n  <BugOff slash />\n</template>\n<script setup>\nimport { BellOffIcon as BellOff, BugIcon as BugOff } from '@flouvia/gota/vue/icons';\n</script>\n`);
  // Nothing to do: another package, or no icons at all
  const other = `import { useState } from 'react';\n`;
  assert.equal(transformScript(other).code, other);
});

test('codemod: SF Symbols in Swift take Gota\'s Xcode symbols, the drawn variant and fill included', () => {
  const before = `VStack {
  Image(systemName: "bell.slash.fill")
  Image(systemName: "trash")
  Label("Inbox", systemImage: "tray")
  Image(systemName: "airpodspro")
  Button("Go", systemImage: "bell") { }
  Image(systemName: name)
}
let u = UIImage(systemName: "xmark.circle")
let n = NSImage(systemSymbolName: "gearshape", accessibilityDescription: "Settings")
`;
  const { code, edits, notes } = transformSwift(before);
  assert.equal(
    code,
    `VStack {
  Image("bell-off.fill")
  Image("trash")
  Label("Inbox", image: "inbox")
  Image(systemName: "airpodspro")
  Button("Go", systemImage: "bell") { }
  Image(systemName: name)
}
let u = UIImage(named: "close-circle")
let n = NSImage(named: "gear")
`,
  );
  assert.equal(edits.length, 5);
  const said = notes.join('\n');
  assert.match(said, /"airpodspro" stays an SF Symbol: no Gota equivalent yet/);
  assert.match(said, /systemImage: "bell" wasn't moved \(Gota: "bell"\)/);
  assert.match(said, /systemName: name wasn't moved: not a literal name/);
  assert.match(said, /accessibilityDescription was dropped/);
});
