// Outlines (scripts/outline.mjs): icons as filled shapes for Android, Xcode and fonts. Each outline
// checks itself against its drawing (Skia raster, masks by luminance) and throws on a mismatch, so
// producing one is already the check. They need canvaskit-wasm (npm ci) and read dist/.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { iconData, render } from '../dist/index.js';
import { absolute, matches, outline } from '../scripts/outline.mjs';

const contours = (d) => (d.match(/m/gi) ?? []).length;

test('outline: strokes, fill, badges, slash, enclosures and 16 px, each matching its drawing', () => {
  for (const [name, options] of [['bell', {}], ['bell-off', { style: 'fill' }], ['file-check', { style: 'fill' }], ['calendar', { style: 'fill' }], ['cart', { slash: true }], ['bell', { enclosure: 'circle', style: 'fill' }], ['wifi', { size: 16 }], ['arrow-right', { rtl: true }]])
    assert.match(outline(iconData(name), { weight: 1.5, ...options }), /^m[\d.-]+/);
});

test('outline: holes survive where two pieces only touch (the card chip keeps both)', () => {
  // card body (outer, hole), chip (outer, two holes split by its line), number line
  assert.equal(contours(outline(iconData('card-chip'), { weight: 1.5 })), 6);
});

test('outline: a cut-out enclosure keeps the drawing as holes', () => {
  assert.ok(contours(outline(iconData('bell'), { enclosure: 'circle', style: 'fill', weight: 1.5 })) > 1);
});

test('outline: as absolute M, L, Q, C, Z (Figma), the same point for point and the same drawing', () => {
  assert.equal(absolute('m1.5 2h3v-1.25l-.5.5q1 1 2 0c1 0 1 1 2 1zm3 3 1 1z'), 'M 1.5 2 L 4.5 2 L 4.5 0.75 L 4 1.25 Q 5 2.25 6 1.25 C 7 1.25 7 2.25 8 2.25 Z M 4.5 5 L 5.5 6 Z');
  for (const [name, options] of [['bell', { style: 'fill' }], ['card-chip', {}], ['cart', { slash: true }], ['message', { style: 'fill', weight: 2.1 }]]) {
    const opts = { weight: 1.5, ...options };
    const d = absolute(outline(iconData(name), opts));
    assert.doesNotMatch(d, /[^MLQCZ\d .-]/); // only M, L, Q, C, Z and numbers
    assert.ok(matches(render(iconData(name), { ...opts, animate: null, id: 'o' }), d).ok, name);
  }
});
