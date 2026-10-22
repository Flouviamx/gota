// Outlines (scripts/outline.mjs): icons as filled shapes for Android, Xcode and fonts. Each outline
// checks itself against its drawing (Skia raster, masks by luminance) and throws on a mismatch, so
// producing one is already the check. They need canvaskit-wasm (npm ci) and read dist/.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { iconData } from '../dist/index.js';
import { outline } from '../scripts/outline.mjs';

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
