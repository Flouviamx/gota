// Engine tests: if one of these fails, it fails across all 10,000 icons at once.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badge, circ, cursor, drop, f, head, roundpoly, sq } from '../engine/geometry.mjs';
import { render, snap, snapper, svgFile, transform } from '../engine/variants.mjs';

const nums = (d) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

test('f rounds to two decimals without trailing zeros', () => {
  assert.equal(f(1.005), '1');
  assert.equal(f(-0.001), '0');
  assert.equal(f(12.5), '12.5');
  assert.equal(f(3), '3');
});

test('sq: the square signature corner has no curve', () => {
  const firma = sq(2.5, 5, 19, 14, 4, { square: ['br'] });
  assert.match(firma, /L21\.5 19L/, 'the bottom-right corner is a vertex');
  assert.equal((sq(2.5, 5, 19, 14, 4).match(/a/g) ?? []).length, 4, 'four continuous corners');
  assert.equal((firma.match(/a/g) ?? []).length, 3);
});

test('drop and circ close the path', () => {
  assert.ok(drop(12, 12, 8).endsWith('Z'));
  assert.ok(circ(12, 12, 9).endsWith('Z'));
  assert.ok(roundpoly([[12, 3], [21, 20], [3, 20]], 2).endsWith('Z'));
});

test('head: arms of the given length at 45°', () => {
  const [ax, ay, tx, ty] = nums(head([20, 12], [1, 0], 6));
  assert.ok(Math.abs(Math.hypot(tx - ax, ty - ay) - 6) < 0.02);
});

test('transform scales and translates; arcs scale their radius', () => {
  assert.equal(transform('M0 0L10 10', 0.5, 6, 6), 'M6 6L11 11');
  assert.equal(transform('M2 2a4 4 0 0 1 8 0', 0.5, 0, 0), 'M1 1A2 2 0 0 1 5 1');
  assert.equal(transform('M1 1h2v2z', 1, 0, 0), 'M1 1H3V3Z');
});

test('snap moves horizontal and vertical segments to pixel centers at 16 px', () => {
  assert.equal(snap('M3 9.75h18'), 'M3 9.75H21');
  assert.equal(snap('M8 2.9v3.6'), 'M8.25 2.9V6.5');
  // at 16 px, pixel centers fall on 0.75 + 1.5k of the 24 canvas
  for (const v of nums(snap('M3 4H21V20H3Z'))) assert.equal(((v - 0.75) / 1.5) % 1, 0);
});

const bell = { d: ['M6 16V10a6 6 0 0 1 12 0v6Z', 'M10 20a2 2 0 0 0 4 0'], parts: { body: [0], clapper: [1] }, fill: { solid: ['M6 16V10a6 6 0 0 1 12 0v6Z'], lines: ['M10 20a2 2 0 0 0 4 0'] } };
const wifi = { d: ['M12 18h.01', 'M8 14a5 5 0 0 1 8 0', 'M5 11a9 9 0 0 1 14 0'], levels: [[0], [1], [2]], mirror: true };

test('snap does not distort circles (the zero-length closing segment does not count)', () => {
  const c = circ(18.75, 5.25, 2);
  assert.equal(snap(c), transform(c, 1, 0, 0));
});

test('badges: clear the base with exact clearance and are drawn on top', () => {
  const ic = { d: ['M3 3h12v12H3Z', circ(14, 14, 0.7)], badge: badge('plus') };
  const out = render(ic, { id: 'k' });
  assert.match(out, /<mask id="k-k"/);
  assert.match(out, /stroke-width="4.5"/, 'stroke + 3 = 1.5 of clearance on each side');
  assert.match(out, /data-part="badge"/);
  assert.doesNotMatch(out, /A0.7 0.7/, 'a dot touching the badge is removed whole');
  assert.match(render(ic, { id: 'k', style: 'fill' }), /<mask id="k-b"/, 'filled: the sign is knocked out');
});

test('cursor: a single closed path inside the canvas', () => {
  const d = cursor([6.1, 3.3], 1);
  assert.ok(d.endsWith('Z'));
  for (const v of nums(d)) assert.ok(v >= 0 && v <= 24);
});

test('render: a single tone, round strokes and no opacity', () => {
  const out = render(bell, { id: 't' });
  assert.match(out, /stroke-linecap="round"/);
  assert.match(out, /stroke-linejoin="round"/);
  assert.doesNotMatch(out, /opacity/);
});

test('render: parts and levels as data-*, never an id on paths', () => {
  const out = render(bell, { id: 't' });
  assert.match(out, /data-part="body"/);
  assert.match(out, /data-part="clapper"/);
  assert.doesNotMatch(out, /<path[^>]* id=/);
  assert.match(render(wifi, { id: 'w' }), /data-level="3"/);
});

test('render: levels turn off with value', () => {
  assert.equal((render(wifi, { id: 'w', value: 1 / 3 }).match(/<path/g) ?? []).length, 1);
  assert.equal((render(wifi, { id: 'w', value: 1 }).match(/<path/g) ?? []).length, 3);
});

test('render: mirrors only directional icons', () => {
  assert.match(render(wifi, { id: 'w', rtl: true }), /matrix\(-1 0 0 1 24 0\)/);
  assert.doesNotMatch(render(bell, { id: 'b', rtl: true }), /matrix/);
  assert.match(svgFile('', wifi), /data-rtl="mirror"/);
  assert.doesNotMatch(svgFile('', bell), /data-rtl/);
});

test('render: fill with its own mask per id and lines with clearance', () => {
  const out = render(bell, { style: 'fill', id: 'x' });
  assert.match(out, /<mask id="x-f"/);
  assert.match(out, /stroke-width="4.5"/, '1.5 of clearance on each side of the lines');
});

test('render: the weight is continuous', () => {
  assert.match(render(bell, { id: 'g', weight: 0.75 }), /stroke-width="0.75"/);
  assert.match(render(bell, { id: 'g', weight: 2.6 }), /stroke-width="2.6"/);
});

test('snapper: an arrowhead moves with its shaft (shared snapping)', () => {
  const stem = 'M12 4V20';
  const head = 'M6 10 12 4 18 10';
  const sn = snapper([stem, head]);
  const sx = nums(sn(stem))[0];
  assert.equal(nums(sn(head))[2], sx, 'the tip stays in line with the shaft');
});

test('snapper: dots move to a pixel corner with r 1', () => {
  const d = snapper([circ(10.6, 7.1, 0.7)])(circ(10.6, 7.1, 0.7));
  assert.match(d, /A1 1 0 1 0/);
  for (const v of nums(d).filter((_, i) => i === 1)) assert.equal(v % 1.5, 0);
});

test('badges at 16 px: no ring and on the pixel grid', () => {
  const big = render({ d: ['M3 3h12v12H3Z'], badge: badge('plus') }, { id: 'a' });
  const small = render({ d: ['M3 3h12v12H3Z'], badge: badge('plus') }, { id: 'b', size: 16 });
  assert.match(big, /A4.25 4.25 0 1 0/, 'at 24 px it keeps its ring');
  assert.doesNotMatch(small.split('data-part="badge"')[1], /A4.25 4.25/, 'at 16 px only the sign remains');
});

test('enclosed and filled: the badge is knocked out of the container', () => {
  const out = render({ d: ['M3 3h12v12H3Z'], fill: { solid: ['M3 3h12v12H3Z'] }, badge: badge('check') }, { id: 'e', style: 'fill', enclosure: 'circle' });
  assert.match(out, /<mask id="e-e"[^]*<g mask="url\(#e-k\)">/, 'the base is not knocked out inside the badge cutout');
});

test('fill: wire goes on top as a line, unfilled and without clearance', () => {
  const out = render({ d: ['M5 10h14v10H5Z', 'M8 10V7a4 4 0 0 1 8 0v3'], fill: { solid: ['M5 10h14v10H5Z'], wire: ['M8 10V7a4 4 0 0 1 8 0v3'] } }, { id: 'w', style: 'fill' });
  assert.match(out, /fill="none"[^>]*><path d="M8 10V7/);
  assert.doesNotMatch(out, /stroke-width="4.5"/);
});

test('a dot far from a diagonal badge is kept', () => {
  const slashBadge = { d: ['M14 22 22 14'], knock: 'M14 22 22 14' };
  const out = render({ d: ['M3 3h8v8H3Z', circ(5, 18, 0.7)], badge: slashBadge }, { id: 'd' });
  assert.match(out, /A0.7 0.7/);
});
