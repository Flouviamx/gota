// Pruebas del motor: si una de estas falla, falla en los 10,000 íconos a la vez.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circ, drop, f, head, roundpoly, sq } from '../engine/geometry.mjs';
import { render, snap, svgFile, transform } from '../engine/variants.mjs';

const nums = (d) => (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);

test('f redondea a dos decimales sin ceros de sobra', () => {
  assert.equal(f(1.005), '1');
  assert.equal(f(-0.001), '0');
  assert.equal(f(12.5), '12.5');
  assert.equal(f(3), '3');
});

test('sq: la esquina recta de la firma no lleva curva', () => {
  const firma = sq(2.5, 5, 19, 14, 4, { square: ['br'] });
  assert.match(firma, /L21\.5 19L/, 'la esquina inferior derecha es un vértice');
  assert.equal((sq(2.5, 5, 19, 14, 4).match(/a/g) ?? []).length, 4, 'cuatro esquinas continuas');
  assert.equal((firma.match(/a/g) ?? []).length, 3);
});

test('drop y circ cierran el trazo', () => {
  assert.ok(drop(12, 12, 8).endsWith('Z'));
  assert.ok(circ(12, 12, 9).endsWith('Z'));
  assert.ok(roundpoly([[12, 3], [21, 20], [3, 20]], 2).endsWith('Z'));
});

test('head: brazos de largo dado a 45°', () => {
  const [ax, ay, tx, ty] = nums(head([20, 12], [1, 0], 6));
  assert.ok(Math.abs(Math.hypot(tx - ax, ty - ay) - 6) < 0.02);
});

test('transform escala y mueve; los arcos escalan su radio', () => {
  assert.equal(transform('M0 0L10 10', 0.5, 6, 6), 'M6 6L11 11');
  assert.equal(transform('M2 2a4 4 0 0 1 8 0', 0.5, 0, 0), 'M1 1A2 2 0 0 1 5 1');
  assert.equal(transform('M1 1h2v2z', 1, 0, 0), 'M1 1H3V3Z');
});

test('snap lleva lo horizontal y lo vertical al centro del pixel a 16 px', () => {
  assert.equal(snap('M3 9.75h18'), 'M3 9.75H21');
  assert.equal(snap('M8 2.9v3.6'), 'M8.25 2.9V6.5');
  // los centros de pixel a 16 px caen en 0.75 + 1.5k del lienzo de 24
  for (const v of nums(snap('M3 4H21V20H3Z'))) assert.equal(((v - 0.75) / 1.5) % 1, 0);
});

const bell = { d: ['M6 16V10a6 6 0 0 1 12 0v6Z', 'M10 20a2 2 0 0 0 4 0'], parts: { body: [0], clapper: [1] }, fill: { solid: ['M6 16V10a6 6 0 0 1 12 0v6Z'], lines: ['M10 20a2 2 0 0 0 4 0'] } };
const wifi = { d: ['M12 18h.01', 'M8 14a5 5 0 0 1 8 0', 'M5 11a9 9 0 0 1 14 0'], levels: [[0], [1], [2]], mirror: true };

test('render: un solo tono, trazo redondo y sin opacidades', () => {
  const out = render(bell, { id: 't' });
  assert.match(out, /stroke-linecap="round"/);
  assert.match(out, /stroke-linejoin="round"/);
  assert.doesNotMatch(out, /opacity/);
});

test('render: piezas y niveles como data-*, nunca id en los trazos', () => {
  const out = render(bell, { id: 't' });
  assert.match(out, /data-part="body"/);
  assert.match(out, /data-part="clapper"/);
  assert.doesNotMatch(out, /<path[^>]* id=/);
  assert.match(render(wifi, { id: 'w' }), /data-level="3"/);
});

test('render: los niveles se apagan con value', () => {
  assert.equal((render(wifi, { id: 'w', value: 1 / 3 }).match(/<path/g) ?? []).length, 1);
  assert.equal((render(wifi, { id: 'w', value: 1 }).match(/<path/g) ?? []).length, 3);
});

test('render: espejo solo si el ícono es direccional', () => {
  assert.match(render(wifi, { id: 'w', rtl: true }), /matrix\(-1 0 0 1 24 0\)/);
  assert.doesNotMatch(render(bell, { id: 'b', rtl: true }), /matrix/);
  assert.match(svgFile('', wifi), /data-rtl="mirror"/);
  assert.doesNotMatch(svgFile('', bell), /data-rtl/);
});

test('render: relleno con máscara propia por id y líneas con aire', () => {
  const out = render(bell, { style: 'fill', id: 'x' });
  assert.match(out, /<mask id="x-f"/);
  assert.match(out, /stroke-width="4.5"/, 'aire de 1.5 a cada lado de las líneas');
});

test('render: el grosor es continuo', () => {
  assert.match(render(bell, { id: 'g', weight: 0.75 }), /stroke-width="0.75"/);
  assert.match(render(bell, { id: 'g', weight: 2.6 }), /stroke-width="2.6"/);
});
