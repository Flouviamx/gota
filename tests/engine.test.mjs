// Pruebas del motor: si una de estas falla, falla en los 10,000 íconos a la vez.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badge, circ, cursor, drop, f, head, roundpoly, sq } from '../engine/geometry.mjs';
import { render, snap, snapper, svgFile, transform } from '../engine/variants.mjs';

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

test('snap no deforma círculos (el cierre de largo cero no cuenta)', () => {
  const c = circ(18.75, 5.25, 2);
  assert.equal(snap(c), transform(c, 1, 0, 0));
});

test('insignias: despejan la base con aire exacto y se dibujan encima', () => {
  const ic = { d: ['M3 3h12v12H3Z', circ(14, 14, 0.7)], badge: badge('plus') };
  const out = render(ic, { id: 'k' });
  assert.match(out, /<mask id="k-k"/);
  assert.match(out, /stroke-width="4.5"/, 'trazo + 3 = 1.5 de aire a cada lado');
  assert.match(out, /data-part="badge"/);
  assert.doesNotMatch(out, /A0.7 0.7/, 'el punto que toca la insignia sale entero');
  assert.match(render(ic, { id: 'k', style: 'fill' }), /<mask id="k-b"/, 'rellena: signo calado');
});

test('cursor: un solo trazo cerrado dentro del lienzo', () => {
  const d = cursor([6.1, 3.3], 1);
  assert.ok(d.endsWith('Z'));
  for (const v of nums(d)) assert.ok(v >= 0 && v <= 24);
});

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

test('snapper: la punta de una flecha se mueve con su asta (ajuste compartido)', () => {
  const stem = 'M12 4V20';
  const head = 'M6 10 12 4 18 10';
  const sn = snapper([stem, head]);
  const sx = nums(sn(stem))[0];
  assert.equal(nums(sn(head))[2], sx, 'la punta queda en la columna del asta');
});

test('snapper: los puntos van a una esquina de pixel con r 1', () => {
  const d = snapper([circ(10.6, 7.1, 0.7)])(circ(10.6, 7.1, 0.7));
  assert.match(d, /A1 1 0 1 0/);
  for (const v of nums(d).filter((_, i) => i === 1)) assert.equal(v % 1.5, 0);
});

test('insignias a 16 px: sin anillo y en la cuadrícula del pixel', () => {
  const big = render({ d: ['M3 3h12v12H3Z'], badge: badge('plus') }, { id: 'a' });
  const small = render({ d: ['M3 3h12v12H3Z'], badge: badge('plus') }, { id: 'b', size: 16 });
  assert.match(big, /A4.25 4.25 0 1 0/, 'a 24 px lleva su anillo');
  assert.doesNotMatch(small.split('data-part="badge"')[1], /A4.25 4.25/, 'a 16 px queda solo el signo');
});

test('encerrado y relleno: la insignia se cala en el contenedor', () => {
  const out = render({ d: ['M3 3h12v12H3Z'], fill: { solid: ['M3 3h12v12H3Z'] }, badge: badge('check') }, { id: 'e', style: 'fill', enclosure: 'circle' });
  assert.match(out, /<mask id="e-e"[^]*<g mask="url\(#e-k\)">/, 'la base no se cala dentro del recorte de la insignia');
});

test('relleno: wire va encima como línea, sin rellenar ni aire', () => {
  const out = render({ d: ['M5 10h14v10H5Z', 'M8 10V7a4 4 0 0 1 8 0v3'], fill: { solid: ['M5 10h14v10H5Z'], wire: ['M8 10V7a4 4 0 0 1 8 0v3'] } }, { id: 'w', style: 'fill' });
  assert.match(out, /fill="none"[^>]*><path d="M8 10V7/);
  assert.doesNotMatch(out, /stroke-width="4.5"/);
});

test('un punto lejos de una insignia diagonal se conserva', () => {
  const slashBadge = { d: ['M14 22 22 14'], knock: 'M14 22 22 14' };
  const out = render({ d: ['M3 3h8v8H3Z', circ(5, 18, 0.7)], badge: slashBadge }, { id: 'd' });
  assert.match(out, /A0.7 0.7/);
});
