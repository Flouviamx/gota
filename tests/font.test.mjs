// The OpenType writer (scripts/sfnt.mjs), read back with its own independent reader: a tiny font
// with a varying glyph, a fixed one and a ligature. The full fonts are checked by scripts/font.mjs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { font, readGlyphs, woff2 } from '../scripts/sfnt.mjs';

const square = (s) => [[{ x: 100, y: 100, on: true }, { x: 100 + s, y: 100, on: true }, { x: 100 + s, y: 100 + s, on: false }, { x: 100, y: 100 + s, on: true }]];
const glyphs = [
  { name: '.notdef', advance: 1000, contours: [] },
  { name: 'a', advance: 0, contours: [] },
  { name: 'b', advance: 0, contours: [] },
  // Varies: the deltas of the light and bold ends, one per point
  { name: 'box', advance: 1000, contours: square(500), deltas: [square(500)[0].map(() => [-3, 2]), square(500)[0].map((_, i) => [300 * i - 200, -150])] },
  { name: 'dot', advance: 1000, contours: square(40) },
];
const cmap = new Map([
  [0x61, 1],
  [0x62, 2],
  [0xf0000, 3],
  [0xf0001, 4],
]);
const axis = { tag: 'wght', min: 100, default: 400, max: 700, regions: [-1, 1], instances: [{ name: 'Thin', value: 100 }, { name: 'Regular', value: 400 }, { name: 'Bold', value: 700 }] };

test('fonts: what is written reads back the same, deltas included (bytes and words, zero runs)', () => {
  const sfnt = font({ family: 'Probe', unitsPerEm: 1000, glyphs, cmap, ligatures: [{ components: [1, 2], glyph: 3 }], axis });
  const back = readGlyphs(sfnt);
  assert.equal(back.length, glyphs.length);
  assert.deepEqual(back[3].contours, glyphs[3].contours);
  assert.deepEqual(back[3].deltas, glyphs[3].deltas);
  assert.deepEqual(back[4].contours, glyphs[4].contours);
  assert.equal(back[4].deltas, null);
  // Tables an icon font needs, and a checksum adjustment that makes the whole file sum to the magic number
  const tags = Array.from({ length: sfnt.readUInt16BE(4) }, (_, i) => sfnt.toString('latin1', 12 + 16 * i, 16 + 16 * i));
  for (const t of ['GSUB', 'OS/2', 'STAT', 'cmap', 'fvar', 'glyf', 'gvar', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post']) assert.ok(tags.includes(t), t);
  let sum = 0;
  for (let i = 0; i < sfnt.length; i += 4) sum = (sum + sfnt.readUInt32BE(i)) >>> 0;
  assert.equal(sum, 0xb1b0afba);
});

test('fonts: WOFF2 keeps the table directory and the sizes of the sfnt it wraps', () => {
  const sfnt = font({ family: 'Probe', unitsPerEm: 1000, glyphs, cmap });
  const w = woff2(sfnt);
  assert.equal(w.toString('latin1', 0, 4), 'wOF2');
  assert.equal(w.readUInt32BE(8), w.length);
  assert.equal(w.readUInt16BE(12), sfnt.readUInt16BE(4));
  assert.equal(w.readUInt32BE(16), sfnt.length);
  assert.equal(w.length % 4, 0);
});
