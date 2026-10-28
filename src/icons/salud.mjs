// Salud y medicina (health and medicine): medicines and how they're taken, tests and records,
// care and its places, equipment, injuries and mobility, dentistry, eye care and menstrual health.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md. A few
// pieces carry the whole family: the capsule at 45° rising to the right (one band across its
// middle), the outlined Greek cross (one builder, a few sizes), the syringe at 45° (drawn level
// with its needle to the left, then turned), the molar and the rapid test's cassette. Containers
// that the set already draws (the document, the calendar, the card, the receipt, the bubble, the
// pin, the house, the laptop, the canopy) are their own files' paths, never redrawn, and every
// badge is the engine's.
import { arc, badge, circ, dot, f, flipPath, halfChord, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

const L = lugares.icons;

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };
const BC = [17.25, 17.25];
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
/** Moves a path by (dx, dy). */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales a path by `s` around `c`, then moves it by (dx, dy). */
const scale = (d, s, c = [12, 12], dx = 0, dy = 0) => transform(d, s, c[0] * (1 - s) + dx, c[1] * (1 - s) + dy);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as hogar's. */
function roundline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${pt(V)}`;
      continue;
    }
    const u = unit(sub(A, V));
    const v = unit(sub(B, V));
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const t = r / Math.tan(th / 2);
    const S = add2(V, mul(u, t));
    const E = add2(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Capsule (stadium) between the centers of its two round ends, `a` and `b`, of radius `r`. */
function stadium(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1], u[0]];
  const [a1, b1, b2, a2] = [add2(a, mul(n, r)), add2(b, mul(n, r)), add2(b, mul(n, -r)), add2(a, mul(n, -r))];
  const R1 = halfChord(b1, b2);
  const R2 = halfChord(a2, a1);
  return `M${pt(a1)}L${pt(b1)}A${R1} ${R1} 0 0 0 ${pt(b2)}L${pt(a2)}A${R2} ${R2} 0 0 0 ${pt(a1)}Z`;
}

/** Ellipse with semi-axes rx, ry (four cubics). */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}

/** Lens: two arcs of radius R between A and B (lugares' leaf). */
const lens = (A, B, R) => `M${pt(A)}A${f(R)} ${f(R)} 0 0 1 ${pt(B)}A${f(R)} ${f(R)} 0 0 1 ${pt(A)}Z`;

/** Water drop, its point up (lugares' droplet): the circle (c, r) and the point √2·r above it. */
function droplet([cx, cy], r) {
  const a = polar(cx, cy, r, -45);
  const b = polar(cx, cy, r, -135);
  return `M${pt(a)}A${f(r)} ${f(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
}

/**
 * The medical cross: a Greek cross, outlined, its arms `2a` wide reaching `h` from the center,
 * the outer corners rounded and the inner ones eased. One builder for every size in the family.
 */
function cross([cx, cy], h, a, ro = Math.min(1.25, a * 0.6), ri = 0.5) {
  const P = [[cx - a, cy - h], [cx + a, cy - h], [cx + a, cy - a], [cx + h, cy - a], [cx + h, cy + a], [cx + a, cy + a], [cx + a, cy + h], [cx - a, cy + h], [cx - a, cy + a], [cx - h, cy + a], [cx - h, cy - a], [cx - a, cy - a]];
  return roundpoly(P, [ro, ro, ri, ro, ro, ri, ro, ro, ri, ro, ro, ri]);
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};

// ── Pills ─────────────────────────────────────────────────────────────────────────────────────
// The capsule lies at 45°, rising to the right, with one band across its middle and nothing else.
// Beside a badge it is smaller and moves up and to the left, so the badge's clearance never bites it.
/** The pill between the centers of its ends: { body, band, d }. */
function pill(a, b, r) {
  const body = stadium(a, b, r);
  const m = lerp(a, b, 0.5);
  const u = unit(sub(b, a));
  const n = [-u[1], u[0]];
  const band = line(add2(m, mul(n, r)), add2(m, mul(n, -r)));
  return { body, band, d: [body, band] };
}
const PILL = pill([7.25, 16.75], [16.75, 7.25], 3.5);
const PILL_S = pill([5, 14], [14, 5], 3);
add('pill', ['pastilla', 'cápsula', 'medicamento', 'farmacia', 'pill', 'capsule', 'medication'], PILL.d);
const PILL_BADGES = {
  'pill-clock': ['clock', ['toma pendiente', 'recordatorio de medicamento', 'hora de la dosis', 'medication reminder', 'dose due', 'pill reminder']],
  'pill-check': ['check', ['dosis tomada', 'toma registrada', 'adherencia', 'dose taken', 'medication logged', 'adherence']],
  'pill-plus': ['plus', ['agregar medicamento', 'nuevo tratamiento', 'agregar pastilla', 'add medication', 'add pill', 'new prescription']],
  'pill-alert': ['alert', ['interacción', 'efecto secundario', 'advertencia de medicamento', 'drug interaction', 'side effect', 'medication warning']],
  'pill-search': ['search', ['buscar medicamento', 'identificar pastilla', 'vademécum', 'drug lookup', 'pill identifier', 'search medicine']],
  'pill-x': ['x', ['dosis olvidada', 'toma omitida', 'sin tomar', 'missed dose', 'skipped dose', 'not taken']],
};
for (const [name, [kind, tags]] of Object.entries(PILL_BADGES)) add(name, tags, PILL_S.d, { badge: badge(kind) });
for (const name of ['pill', ...Object.keys(PILL_BADGES)]) {
  FILL[name] = { solid: [0], cut: [1] };
  PARTS[name] = { body: [0], band: [1] };
}

// Round tablet, three-quarter view: its top an ellipse, its edge a band below it (two sides and the
// bottom arc), and the score line across the top, slanted with the perspective, so it never reads
// as a minus in a circle
{
  const [cx, ty, rx, ry, t] = [12, 10.25, 8.75, 4.5, 3];
  const outline = `M${pt([cx - rx, ty])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([cx + rx, ty])}V${f(ty + t)}A${f(rx)} ${f(ry)} 0 0 1 ${pt([cx - rx, ty + t])}Z`;
  const rim = `M${pt([cx - rx, ty])}A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx + rx, ty])}`;
  const th = (-28 * Math.PI) / 180;
  const score = line([cx - rx * Math.cos(th), ty - ry * Math.sin(th)], [cx + rx * Math.cos(th), ty + ry * Math.sin(th)]);
  add('pill-round', ['tableta', 'comprimido', 'pastilla redonda', 'dosis', 'tablet', 'round pill', 'dose'], [outline, rim, score]);
  FILL['pill-round'] = { solid: [0], cut: [1, 2] };
  PARTS['pill-round'] = { body: [0], edge: [1], score: [2] };
}

// Pill bottle: a squat body under a wide ridged cap a third of its height, a label band across the
// body (two lines); no neck. The body's sides run up to the cap's lower edge, 2 inside its ends (at 1.5
// the notch between them held no clean structure across the weights under the sync badge)
const BOTTLE = (() => {
  const cap = sq(4.5, 2.75, 15, 6, 1.5);
  const ridges = [9.5, 14.5].map((x) => vl(x, 2.75, 8.75));
  const body = sq(6.5, 8.75, 11, 12.5, 3, { square: ['tl', 'tr', 'br'] }).replace(/Z$/, '');
  const label = [hl(12.5, 6.5, 17.5), hl(17.25, 6.5, 17.5)];
  return { cap, ridges, body, label, d: [body, ...label, cap, ...ridges] };
})();
add('pill-bottle', ['frasco de pastillas', 'receta surtida', 'medicamento', 'farmacia', 'pill bottle', 'prescription bottle', 'medication'], BOTTLE.d);
add('pill-bottle-sync', ['resurtir receta', 'renovar medicamento', 'pedido recurrente', 'refill prescription', 'prescription refill', 'repeat order'], BOTTLE.d, { badge: badge('sync') });
for (const name of ['pill-bottle', 'pill-bottle-sync']) {
  FILL[name] = { solid: [`${BOTTLE.body}Z`, 3], cut: [1, 2, 4, 5, hl(8.75, 6.5, 17.5)] };
  PARTS[name] = { body: [0], label: [1, 2], cap: [3, 4, 5] };
}

// Blister pack: a flat sheet (the signature corner) with two columns of two capsule bubbles
{
  const sheet = sq(5.25, 3.25, 13.5, 17.5, 3.25, BR);
  const [w, h, m, g] = [2.75, 4.5, 2.7, 2.9];
  const my = (17.5 - 2 * h - g) / 2;
  const bubbles = [];
  for (const row of [0, 1]) for (const col of [0, 1]) bubbles.push(sq(5.25 + m + col * (w + g), 3.25 + my + row * (h + g), w, h, w / 2, { smoothing: 0 }));
  add('blister-pack', ['blíster', 'tira de pastillas', 'tratamiento', 'anticonceptivos', 'blister pack', 'pill strip', 'course of treatment'], [sheet, ...bubbles]);
  FILL['blister-pack'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['blister-pack'] = { sheet: [0], bubbles: [1, 2, 3, 4] };
}

// Pill organizer: a long low box split into four compartments and the family's capsule, small, above
// it (a lid flipped up over the last compartment read as the tallest bar of a chart; a pill inside a
// compartment merged with its walls at bold)
{
  const box = sq(2.5, 12.25, 19, 8, 2.5, BR);
  const dividers = [7.25, 12, 16.75].map((x) => vl(x, 12.25, 20.25));
  const cap = pill([10.4, 7.6], [13.6, 4.4], 1.65);
  add('pill-organizer', ['pastillero', 'organizador semanal', 'dosis por día', 'horario de medicamentos', 'pill organizer', 'pill box', 'medication schedule'], [box, ...dividers, ...cap.d]);
  FILL['pill-organizer'] = { solid: [0, 4], cut: [1, 2, 3, 5] };
  PARTS['pill-organizer'] = { box: [0], dividers: [1, 2, 3], pill: [4, 5] };
}

// Liquid medicine: a bottle with shoulders and a short neck, the liquid's level across it, and a
// dosing cup turned upside down over its cap
{
  const cup = roundpoly([[9.25, 2.75], [14.75, 2.75], [16, 8.25], [8, 8.25]], [1, 1, 0.6, 0.6]);
  const body = roundline([[9.75, 8.25], [9.75, 9.75], [5.75, 12.25], [5.75, 21.25], [18.25, 21.25], [18.25, 12.25], [14.25, 9.75], [14.25, 8.25]], [0, 1, 2, 3, 0, 2, 1, 0]);
  add('medicine-bottle', ['jarabe', 'medicina líquida', 'dosis infantil', 'frasco', 'syrup', 'liquid medicine', 'cough medicine'], [body, hl(15.25, 5.75, 18.25), cup]);
  FILL['medicine-bottle'] = { solid: [`${body}Z`, 2], cut: [1, hl(8.25, 9.75, 14.25)] };
  PARTS['medicine-bottle'] = { body: [0], liquid: [1], cup: [2] };
}

// Dosing cup: small and tapered, three graduation ticks up its left side; no handle, no spout
{
  const [x0, x1, y0, y1, inset] = [5.5, 18.5, 4.75, 20.25, 2.25];
  const cup = roundpoly([[x0, y0], [x1, y0], [x1 - inset, y1], [x0 + inset, y1]], [0.75, 0.75, 2.25, 2.25]);
  const wall = (y) => x0 + ((y - y0) / (y1 - y0)) * inset;
  const ticks = [[9, 3.75], [12.5, 2.5], [16, 3.75]].map(([y, l]) => hl(y, wall(y), wall(y) + l));
  add('dosing-cup', ['vasito dosificador', 'dosis', 'medida', 'mililitros', 'dosing cup', 'measured dose', 'dose'], [cup, ...ticks]);
  FILL['dosing-cup'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['dosing-cup'] = { cup: [0], ticks: [1, 2, 3] };
}

// Ointment tube: drawn upright with its crimped flat end up, its body narrowing to a shoulder and the
// tapered nozzle cap below; then laid at 45°, the cap down to the left
{
  const T = (d) => turnPath(d, 45);
  const crimp = sq(6.5, 3, 11, 2.25, 0.8);
  const body = roundline([[6.5, 5.25], [8.25, 14.25], [10.25, 15.75], [13.75, 15.75], [15.75, 14.25], [17.5, 5.25]], [0, 1.75, 0.6, 0.6, 1.75, 0]);
  const cap = roundpoly([[10, 15.75], [14, 15.75], [13.25, 21], [10.75, 21]], [0.4, 0.4, 1.1, 1.1]);
  add('ointment-tube', ['pomada', 'crema', 'ungüento', 'tópico', 'ointment', 'cream', 'topical'], [body, crimp, cap].map(T));
  FILL['ointment-tube'] = { solid: [T(`${body}Z`), 1, 2], cut: [T(hl(5.25, 6.5, 17.5)), T(hl(15.75, 10.25, 13.75))] };
  PARTS['ointment-tube'] = { body: [0], crimp: [1], cap: [2] };
}

// Medicine box: an upright carton (the signature corner) with its top tuck flap open, leaning back,
// and a capsule across its face
{
  const carton = sq(4.75, 8, 14.5, 13.25, 2.75, { square: ['tl', 'tr', 'br'] });
  const flap = roundline([[4.75, 8], [6.75, 3.25], [21.25, 3.25], [19.25, 8]], [0, 0.75, 0.75, 0]);
  const cap = pill([9.6, 17.15], [14.4, 12.35], 1.9);
  add('medicine-box', ['caja de medicina', 'medicamento', 'sin receta', 'farmacia', 'medicine box', 'over the counter', 'packaged medicine'], [carton, flap, ...cap.d]);
  FILL['medicine-box'] = { solid: [0, `${flap}Z`], cut: [2, 3, hl(8, 4.75, 19.25)] };
  PARTS['medicine-box'] = { carton: [0], flap: [1], pill: [2, 3] };
}

// Herbal medicine: lugares' leaf (its lens, its midrib and its stem) and the family's capsule beside
// it, both rising to the right, 3 apart at their closest (with the leaf growing out of the capsule's end, at any angle
// from 0° to 45° off its axis, the two read as a paintbrush; two leaves made a carrot)
{
  const cap = pill([12.5, 17.75], [18, 12.25], 2.75);
  const [A, B] = [[4, 14.25], [14.25, 4]];
  add('herbal-medicine', ['medicina natural', 'herbolaria', 'suplemento', 'remedio natural', 'herbal medicine', 'natural remedy', 'supplement'], [...cap.d, lens(A, B, 11), line([3.25, 15], lerp(A, B, 0.62))]);
  FILL['herbal-medicine'] = { solid: [0, 2], cut: [1, line(lerp(A, B, 0.15), lerp(A, B, 0.62))], wire: [line([3.25, 15], A)] };
  PARTS['herbal-medicine'] = { pill: [0, 1], leaf: [2, 3] };
  // At 16 px the midrib clogs the narrow leaf: the leaf keeps only its stem
  const d16 = [...cap.d, lens(A, B, 11), line([3.25, 15], A)];
  icons['herbal-medicine'].small = { d: d16, fill: { solid: [d16[0], d16[2]], cut: [d16[1]], wire: [d16[3]] } };
}

// Vial: a small upright bottle, a crimped stopper cap wider than its neck, the liquid's line across
// its body
const VIAL = (() => {
  const cap = sq(8, 2.75, 8, 3.75, 1.25);
  const body = roundline([[10, 6.5], [10, 8.5], [7, 8.5], [7, 21.25], [17, 21.25], [17, 8.5], [14, 8.5], [14, 6.5]], [0, 0.75, 1.75, 2.5, 0, 1.75, 0.75, 0]);
  return { cap, body, liquid: hl(14, 7, 17), d: [body, hl(14, 7, 17), cap] };
})();
add('vial', ['vial', 'ampolleta', 'medicamento inyectable', 'frasco ámpula', 'vial', 'injectable', 'medicine vial'], VIAL.d);
FILL.vial = { solid: [`${VIAL.body}Z`, 2], cut: [1, hl(6.5, 10, 14)] };
PARTS.vial = { body: [0], liquid: [1], cap: [2] };

// ── The syringe ───────────────────────────────────────────────────────────────────────────────
// Drawn level from its needle's tip (at the origin) to the right: the barrel's nose tapers to the
// needle, the ticks hang from its top edge, the flange closes its back and the plunger's rod ends in
// the thumb rest. Then turned and set by its tip, so every syringe in the family shares its
// proportions: rising to the right with the needle down to the left, smaller beside a badge.
function syringeH({ needle = 5.25, nose = 2.75, barrel = 9.25, ticks = [3, 6], hw = 2.75, flange = 5, rod = 4.5, thumb = 2.25, tick = 2.5 } = {}) {
  const b0 = needle + nose;
  const F = b0 + barrel;
  return [
    roundline([[F, -hw], [b0, -hw], [needle, 0], [b0, hw], [F, hw]], [0, 0.9, 0.5, 0.9, 0]),
    ...ticks.map((t) => vl(b0 + t, -hw, -hw + tick)),
    vl(F, -flange, flange),
    hl(0, F, F + rod),
    vl(F + rod, -thumb, thumb),
    hl(0, 0, needle),
  ];
}
/** Sets a level drawing (its anchor at the origin) at `tip`, turned `deg` degrees and scaled `k`. */
const place = (parts, deg, tip, k = 1) => parts.map((p) => move(turnPath(transform(p, k, 0, 0), deg, [0, 0]), tip[0], tip[1]));
const SYR = place(syringeH(), -45, [3.66, 21.34]);
const SYR_S = place(syringeH({ needle: 4.5, nose: 2.4, barrel: 8.6, ticks: [2.9, 5.75], hw: 2.4, flange: 4.3, rod: 3.9, thumb: 1.95, tick: 2.15 }), -45, [2.4, 18.6]);
add('syringe', ['jeringa', 'inyección', 'vacuna', 'aplicar', 'syringe', 'injection', 'shot'], SYR);
add('syringe-check', ['vacunado', 'dosis aplicada', 'esquema completo', 'vaccinated', 'dose given', 'immunized'], SYR_S, { badge: badge('check') });
add('syringe-clock', ['próxima dosis', 'refuerzo', 'calendario de vacunación', 'next dose', 'booster due', 'vaccination schedule'], SYR_S, { badge: badge('clock') });
for (const name of ['syringe', 'syringe-check', 'syringe-clock']) {
  FILL[name] = { solid: [shut(icons[name].d[0])], cut: [1, 2], wire: [3, 4, 5, 6] };
  PARTS[name] = { barrel: [0, 1, 2], plunger: [3, 4, 5], needle: [6] };
}

// Vaccine: a squat vial upright at the lower right and a compact syringe coming down at 45° from
// the upper left, its needle in the vial's stopper
{
  // The ticks hang from the upper edge: the level drawing is mirrored before it turns
  const syr = place(syringeH({ needle: 2.5, nose: 2, barrel: 7, ticks: [3.5], hw: 2.25, flange: 4, rod: 3, thumb: 1.75, tick: 2 }).map((p) => flipPath(p, 'y', 0)), -135, [15.75, 13.75]);
  const cap = sq(12.75, 13.75, 6, 2.5, 0.9);
  const body = roundline([[13.5, 16.25], [12, 17.35], [12, 21.25], [19.5, 21.25], [19.5, 17.35], [18, 16.25]], [0, 0.9, 1.75, 0, 0.9, 0]);
  add('vaccine', ['vacuna', 'vacunación', 'inmunización', 'centro de vacunación', 'vaccine', 'vaccination', 'immunization'], [body, cap, ...syr]);
  FILL.vaccine = { solid: [`${body}Z`, 1, shut(syr[0])], cut: [3, hl(16.25, 13.5, 18)], wire: [4, 5, 6, 7] };
  PARTS.vaccine = { vial: [0, 1], syringe: [2, 3, 4, 5, 6, 7] };
}

// Vaccination record: lugares' passport (the booklet, its signature corner) with a syringe drawn large
// down its cover, upright (at 45° it couldn't keep its clearance from the cover's edges)
{
  const syr = place(syringeH({ needle: 2.25, nose: 1.75, barrel: 5.75, ticks: [2.875], hw: 2, flange: 3.25, rod: 3, thumb: 1.6, tick: 2 }), -90, [12, 18.4]);
  add('vaccination-record', ['cartilla de vacunación', 'certificado de vacunas', 'historial de vacunas', 'vaccination record', 'vaccine certificate', 'immunization record'], [L.passport.d[0], ...syr]);
  FILL['vaccination-record'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['vaccination-record'] = { booklet: [0], syringe: [1, 2, 3, 4, 5, 6] };
}

// Insulin pen: drawn level from its capped end, a slim body with the cap's seam, the dose window
// (a slot) and the dose dial a little wider at its back end; then laid at 45°, the cap down to the left
{
  const hw = 2.95;
  const Lb = 16.5;
  const body = `M${pt([Lb, -hw])}L${pt([hw, -hw])}A${halfChord([hw, -hw], [hw, hw])} ${halfChord([hw, -hw], [hw, hw])} 0 0 0 ${pt([hw, hw])}L${pt([Lb, hw])}`;
  const dial = sq(Lb, -hw - 1.25, 4.5, 2 * (hw + 1.25), 1.25);
  const pen = place([body, vl(6.5, -hw, hw), hl(0, 10, 13.5), dial], -45, [4.58, 19.42]);
  add('insulin-pen', ['pluma de insulina', 'insulina', 'autoinyección', 'diabetes', 'insulin pen', 'pen injector', 'insulin'], pen);
  FILL['insulin-pen'] = { solid: [shut(pen[0]), 3], cut: [1, 2, place([vl(Lb, -hw, hw)], -45, [4.58, 19.42])[0]] };
  PARTS['insulin-pen'] = { body: [0], cap: [1], window: [2], dial: [3] };
}

// Glucose meter: a handheld meter (a device: the signature corner) with its screen, a test strip in
// its top and a drop of blood falling beside the strip's end (sitting on it, the drop read as a flame)
{
  const meter = sq(4.75, 10.25, 14.5, 11, 3, BR);
  const screen = sq(7.75, 13.25, 8.5, 4.75, 1.25);
  const strip = roundline([[8.5, 10.25], [8.5, 5], [11.5, 5], [11.5, 10.25]], [0, 0.6, 0.6, 0]);
  const blood = droplet([16.25, 5.5], 2);
  add('glucose-meter', ['glucómetro', 'glucosa', 'azúcar en sangre', 'diabetes', 'glucose meter', 'blood sugar', 'glucometer'], [meter, screen, strip, blood]);
  FILL['glucose-meter'] = { solid: [0, `${strip}Z`, 3], cut: [1] };
  PARTS['glucose-meter'] = { meter: [0], screen: [1], strip: [2], drop: [3] };
}

// Inhaler: the L-shaped boot with the canister standing in its top, the mouthpiece to the left and
// three dots of mist leaving it
{
  const boot = roundpoly([[12.5, 10], [19.75, 10], [19.75, 20.5], [8.25, 20.5], [8.25, 14], [12.5, 14]], [1, 1, 2.25, 1.25, 1.25, 1]);
  const can = roundline([[13.75, 10], [13.75, 3.25], [18.5, 3.25], [18.5, 10]], [0, 1.5, 1.5, 0]);
  const mist = [dot(5, 13.25), dot(3.25, 17.25), dot(5, 21.25)].map((d) => move(d, 0, -0.5));
  add('inhaler', ['inhalador', 'asma', 'medicamento respiratorio', 'broncodilatador', 'inhaler', 'asthma', 'puffer'], [boot, can, ...mist]);
  FILL.inhaler = { solid: [0, `${can}Z`, 2, 3, 4] };
  PARTS.inhaler = { boot: [0], canister: [1], mist: [2, 3, 4] };
}

// Nasal spray: a small bottle (the signature corner), its collar, the tall tapered nozzle and a fan
// of three spray dots above the tip
{
  const bottle = sq(6.5, 15, 11, 6.25, 2.25, BR);
  const collar = sq(8.25, 12.75, 7.5, 2.25, 0.6);
  const nozzle = roundline([[10, 12.75], [11.15, 8.25], [12.85, 8.25], [14, 12.75]], [0, 0.75, 0.75, 0]);
  const spray = [-140, -90, -40].map((a) => dot(...polar(12, 8.25, 4.5, a)));
  add('nasal-spray', ['spray nasal', 'descongestionante', 'alergia', 'atomizador', 'nasal spray', 'decongestant', 'allergy spray'], [bottle, collar, nozzle, ...spray]);
  FILL['nasal-spray'] = { solid: [0, 1, `${nozzle}Z`, 3, 4, 5], cut: [hl(15, 8.25, 15.75), hl(12.75, 10, 14)] };
  PARTS['nasal-spray'] = { bottle: [0, 1], nozzle: [2], spray: [3, 4, 5] };
}

// Eye drops: a squeeze bottle turned upside down, its shoulders narrowing to a pointed tip, and one
// drop falling from it (tilted, its soft body read as a balloon)
{
  const body = sq(7.75, 2.75, 8.5, 7.5, 2.25, { square: ['bl', 'br'] });
  const tip = roundline([[7.75, 10.25], [12, 15.5], [16.25, 10.25]], [0, 0.75, 0]);
  const drp = droplet([12, 19.6], 1.6);
  add('eye-drops', ['gotas para los ojos', 'lágrimas artificiales', 'colirio', 'oftálmico', 'eye drops', 'artificial tears', 'eye medication'], [body, tip, drp]);
  FILL['eye-drops'] = { solid: [0, `${tip}Z`, 2], cut: [hl(10.25, 7.75, 16.25)] };
  PARTS['eye-drops'] = { bottle: [0, 1], drop: [2] };
}

// Tissue box: a low box (the signature corner) with a tissue puffing up out of its top, one fold
// turning over at its peak
{
  const box = sq(2.75, 11.5, 18.5, 9.75, 2.75, BR);
  const tissue = 'M7.75 11.5C7.75 8 9.75 5.25 13.25 3.25C13.75 5 15.25 6 17.25 6.25C16.25 8 16.25 10 16.75 11.5';
  add('tissue-box', ['pañuelos', 'kleenex', 'resfriado', 'gripe', 'tissue box', 'tissues', 'cold and flu'], [box, tissue]);
  FILL['tissue-box'] = { solid: [0, `${tissue}Z`], cut: [hl(11.5, 7.75, 16.75)] };
  PARTS['tissue-box'] = { box: [0], tissue: [1] };
}

// Hot water bottle: a flat rounded rubber bag with wide shoulders, a short neck and its stopper,
// three ribs across its body
{
  const stopper = sq(9, 2.75, 6, 2.75, 0.9);
  const bag = roundline([[10, 5.5], [10, 7.75], [5, 10.25], [5, 21.25], [19, 21.25], [19, 10.25], [14, 7.75], [14, 5.5]], [0, 1.25, 2.25, 3.25, 3.25, 2.25, 1.25, 0]);
  const ribs = [12.25, 15.25, 18.25].map((y) => hl(y, 8.25, 15.75));
  add('hot-water-bottle', ['bolsa de agua caliente', 'calor', 'cólicos', 'alivio', 'hot water bottle', 'heat pack', 'cramps'], [bag, stopper, ...ribs]);
  FILL['hot-water-bottle'] = { solid: [`${bag}Z`, 1], cut: [2, 3, 4, hl(5.5, 10, 14)] };
  PARTS['hot-water-bottle'] = { bag: [0], stopper: [1], ribs: [2, 3, 4] };
}

// Ice pack: a round puffy bag gathered under a wide screw cap (its thread one line across it), two
// folds where it gathers
{
  const cap = sq(6.25, 2.75, 11.5, 4.5, 1.25);
  const ridges = [hl(5, 6.25, 17.75)];
  const [c, r] = [[12, 13.75], 7.5];
  const dx = Math.sqrt(r * r - (c[1] - 7.25) ** 2);
  const bag = `M${pt([c[0] - dx, 7.25])}A${f(r)} ${f(r)} 0 1 0 ${pt([c[0] + dx, 7.25])}`;
  const folds = [line([9.75, 7.25], [10.5, 10]), line([14.25, 7.25], [13.5, 10])];
  add('ice-pack', ['bolsa de hielo', 'compresa fría', 'esguince', 'inflamación', 'ice pack', 'cold pack', 'swelling'], [bag, cap, ...ridges, ...folds]);
  FILL['ice-pack'] = { solid: [`${bag}Z`, 1], cut: [2, 3, 4, hl(7.25, c[0] - dx, c[0] + dx)] };
  PARTS['ice-pack'] = { bag: [0, 3, 4], cap: [1, 2] };
}

// ── Documents ─────────────────────────────────────────────────────────────────────────────────
// The core document (its signature corner), never redrawn. Beside a badge the drawing inside moves
// up and to the left, as comercio's invoice-plus moves its sign.
const N = nucleo.icons;
const DOC = N.document.d[0];

// Prescription: a tear-off pad sheet, its binding strip across the top, a capsule drawn large in its body
const PAD = [DOC, hl(6.75, 4.75, 19.25)];
add('prescription', ['receta médica', 'receta electrónica', 'prescripción', 'farmacia', 'prescription', 'e-prescription', 'rx'], [...PAD, ...pill([9.6, 16.65], [14.4, 11.85], 2).d]);
// Beside a badge the pill moves up and to the left as large as the badge's clearance allows; the
// binding strip gives way to it (with both, the pill left beside the badge was a crumb)
const RX_S = pill([9.6, 11.4], [13.4, 7.6], 1.75).d;
add('prescription-check', ['receta surtida', 'lista para recoger', 'receta lista', 'prescription filled', 'ready for pickup', 'prescription ready'], [DOC, ...RX_S], { badge: badge('check') });
add('prescription-clock', ['receta en proceso', 'surtiendo receta', 'en aprobación', 'prescription pending', 'being filled', 'awaiting approval'], [DOC, ...RX_S], { badge: badge('clock') });
FILL.prescription = { solid: [0], cut: [1, 2, 3] };
PARTS.prescription = { sheet: [0], binding: [1], pill: [2, 3] };
for (const name of ['prescription-check', 'prescription-clock']) {
  FILL[name] = { solid: [0], cut: [1, 2] };
  PARTS[name] = { sheet: [0], pill: [1, 2] };
}

// Medical record: the document with an outlined cross in its upper half and two lines below
add('medical-record', ['expediente médico', 'historia clínica', 'registro de salud', 'medical record', 'health record', 'patient file'], [DOC, cross([12, 8.75], 3.25, 1.5), hl(15, 8.75, 15.25), hl(18.25, 8.75, 12.5)]);
const MR_S = [DOC, cross([10.6, 8.6], 2.85, 1.45), hl(14.75, 8, 13), hl(18, 8, 10.25)];
add('medical-record-lock', ['información protegida', 'expediente privado', 'confidencial', 'protected health information', 'private record', 'confidential'], MR_S, { badge: badge('lock') });
add('medical-record-plus', ['agregar expediente', 'subir documentos', 'nuevo registro', 'add health record', 'upload records', 'new record'], MR_S, { badge: badge('plus') });
for (const name of ['medical-record', 'medical-record-lock', 'medical-record-plus']) {
  FILL[name] = { solid: [0], cut: [1, 2, 3] };
  PARTS[name] = { body: [0], cross: [1], lines: [2, 3] };
}

// Lab results: the document with a test tube standing in its body, its lip and its liquid, beside two lines
const tube = (x, y0, y1, w = 3, lip = 0.25) => {
  const r = w / 2;
  const R = halfChord([x, y1 - r], [x + w, y1 - r]);
  return { tube: `M${pt([x, y0])}V${f(y1 - r)}A${R} ${R} 0 0 0 ${pt([x + w, y1 - r])}V${f(y0)}`, lip: hl(y0, x - lip, x + w + lip) };
};
{
  const t = tube(8, 6.5, 17.75);
  add('lab-results', ['resultados de laboratorio', 'análisis', 'estudios', 'laboratorio', 'lab results', 'blood work', 'test report'], [DOC, t.tube, t.lip, hl(12.75, 8, 11), hl(9.5, 14, 16.25), hl(13, 14, 16.25)]);
  const s = tube(8, 6, 15.75);
  const LR_S = [DOC, s.tube, s.lip, hl(11.5, 8, 11), hl(9, 14, 16.25)];
  add('lab-results-clock', ['resultados pendientes', 'muestra enviada', 'en proceso', 'results pending', 'sample sent', 'awaiting results'], LR_S, { badge: badge('clock') });
  add('lab-results-alert', ['resultado anormal', 'valor fuera de rango', 'revisar resultado', 'abnormal result', 'flagged result', 'out of range'], LR_S, { badge: badge('alert') });
  FILL['lab-results'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['lab-results'] = { body: [0], tube: [1, 2, 3], lines: [4, 5] };
  for (const name of ['lab-results-clock', 'lab-results-alert']) {
    FILL[name] = { solid: [0], cut: [1, 2, 3, 4] };
    PARTS[name] = { body: [0], tube: [1, 2, 3], lines: [4] };
  }
}

// Medical appointment: the core calendar with an outlined cross centered in its grid
add('calendar-medical', ['cita médica', 'consulta', 'agendar doctor', 'clínica', 'medical appointment', 'doctor appointment', 'book a visit'], [...N.calendar.d.slice(0, 4), cross([12, 15.4], 3, 1.35)]);
FILL['calendar-medical'] = { solid: [0], lines: [1, 2], cut: [3, 4] };
PARTS['calendar-medical'] = { body: [0], rings: [1, 2], header: [3], cross: [4] };

// ── The cross in the set's containers ─────────────────────────────────────────────────────────
// Each base is the one the set already draws (its own file's path, never redrawn) with the outlined
// cross in place of its detail: the person, the coin, the dot, the door and window, the screen.
const CM = comercio.icons;
const CANOPY = CM.insurance.d[0];
{
  const card = comunicacion.icons['id-card'];
  add('id-card-medical', ['credencial médica', 'tarjeta de paciente', 'información médica de emergencia', 'medical id', 'patient card', 'health card'], [card.d[0], cross([8.5, 12], 3.25, 1.5), card.d[3], card.d[4]]);
  FILL['id-card-medical'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['id-card-medical'] = { card: [0], cross: [1], lines: [2, 3] };
}
add('insurance-health', ['seguro médico', 'gastos médicos', 'cobertura de salud', 'health insurance', 'medical coverage', 'health benefits'], [CANOPY, cross([12, 17.25], 4, 1.7)]);
FILL['insurance-health'] = { solid: [0, 1] };
PARTS['insurance-health'] = { canopy: [0], cross: [1] };

// ── The molar ─────────────────────────────────────────────────────────────────────────────────
// One drawing for the whole family: a crown with two soft bumps on top and a dip between them, its
// flanks running into two roots that taper to round tips, a notch between them. Built from its left
// half and mirrored, on the portrait keyline.
const TOOTH_HALF = [
  ['M', [12, 4.9]],
  ['C', [10.6, 3.5], [9.05, 2.75], [7.65, 2.75]],
  ['C', [5.6, 2.75], [4.75, 4.85], [4.75, 7.6]],
  ['C', [4.75, 10.6], [5.65, 12.6], [6.3, 14.75]],
  ['C', [6.85, 16.6], [7.1, 21.25], [8.65, 21.25]],
  ['C', [9.85, 21.25], [10.1, 18.35], [10.55, 16.55]],
  ['C', [10.75, 15.65], [11.25, 15.25], [12, 15.25]],
];
function toothPath(c = [12, 12], k = 1) {
  const P = (p) => pt([c[0] + (p[0] - 12) * k, c[1] + (p[1] - 12) * k]);
  const M = (p) => [24 - p[0], p[1]];
  let d = `M${P(TOOTH_HALF[0][1])}`;
  for (const [, ...ps] of TOOTH_HALF.slice(1)) d += `C${ps.map(P).join(' ')}`;
  // back up the right half, from the notch to the dip
  const right = TOOTH_HALF.slice(1).reverse();
  for (let i = 0; i < right.length; i++) {
    const [, c1, c2] = right[i];
    const end = i + 1 < right.length ? right[i + 1][3] : TOOTH_HALF[0][1];
    d += `C${[c2, c1, end].map(M).map(P).join(' ')}`;
  }
  return `${d}Z`;
}
const TOOTH = toothPath();
add('insurance-dental', ['seguro dental', 'cobertura dental', 'prestaciones', 'dental insurance', 'dental coverage', 'dental plan'], [CANOPY, toothPath([12, 17.25], 0.44)]);
FILL['insurance-dental'] = { solid: [0, 1] };
PARTS['insurance-dental'] = { canopy: [0], tooth: [1] };
{
  const lens = [circ(8, 17.25, 3), circ(16, 17.25, 3)];
  const bridge = `M${pt(polar(8, 17.25, 3, -25))}A2 2 0 0 1 ${pt(polar(16, 17.25, 3, 205))}`;
  add('insurance-vision', ['seguro de la vista', 'cobertura visual', 'lentes', 'vision insurance', 'eye care coverage', 'vision plan'], [CANOPY, ...lens, bridge]);
  FILL['insurance-vision'] = { solid: [0, 1, 2], wire: [3] };
  PARTS['insurance-vision'] = { canopy: [0], glasses: [1, 2, 3] };
}
add('receipt-medical', ['factura médica', 'cobro hospitalario', 'copago', 'reembolso', 'medical bill', 'healthcare billing', 'copay'], [CM.receipt.d[0], cross([12, 11.25], 4, 1.7)]);
FILL['receipt-medical'] = { solid: [0], cut: [1] };
PARTS['receipt-medical'] = { receipt: [0], cross: [1] };
{
  const lap = dispositivos.icons.laptop;
  add('telemedicine', ['telemedicina', 'consulta en línea', 'videoconsulta', 'telesalud', 'telemedicine', 'virtual visit', 'telehealth'], [lap.d[0], lap.d[1], cross([12, 10], 2.75, 1.25)]);
  FILL.telemedicine = { solid: [0], lines: [1], cut: [2] };
  PARTS.telemedicine = { screen: [0], base: [1], cross: [2] };
}
add('message-medical', ['chat con el médico', 'mensaje a enfermería', 'consulta por chat', 'doctor chat', 'nurse message', 'ask a pharmacist'], [N.comment.d[0], cross([12, 11.75], 4, 1.75)]);
FILL['message-medical'] = { solid: [0], cut: [1] };
PARTS['message-medical'] = { bubble: [0], cross: [1] };
add('phone-medical', ['línea de enfermería', 'teléfono médico', 'emergencias', 'nurse line', 'medical hotline', 'call a doctor'], [N.phone.d[0], cross([17.25, 6.75], 3.5, 1.5)]);
FILL['phone-medical'] = { solid: [0, 1] };
PARTS['phone-medical'] = { handset: [0], cross: [1] };
add('map-pin-medical', ['atención cercana', 'hospital cercano', 'farmacia cercana', 'find care', 'nearby clinic', 'hospital map'], [L['map-pin'].d[0], cross([12, 10.25], 3.5, 1.5)]);
FILL['map-pin-medical'] = { solid: [0], cut: [1] };
PARTS['map-pin-medical'] = { pin: [0], cross: [1] };
add('house-medical', ['atención a domicilio', 'visita médica', 'cuidado en casa', 'home care', 'home visit', 'home health'], [L.house.d[0], L.house.d[1], cross([12, 14.75], 3.25, 1.4)]);
FILL['house-medical'] = { solid: L.house.fill.solid, cut: [2] };
PARTS['house-medical'] = { roof: [0], walls: [1], cross: [2] };

// ── Hearts ────────────────────────────────────────────────────────────────────────────────────
// sistema's heart-pulse heart, for the whole family
const HP = sistema.icons['heart-pulse'];
const HEART = HP.d[0];
add('healthcare', ['salud', 'atención médica', 'prestaciones de salud', 'sección de salud', 'healthcare', 'health', 'health benefits'], [HEART, cross([12, 12.5], 3.25, 1.4)]);
FILL.healthcare = { solid: [0], cut: [1] };
PARTS.healthcare = { heart: [0], cross: [1] };
add('blood-donation', ['donar sangre', 'donación', 'banco de sangre', 'donante', 'blood donation', 'donate blood', 'blood drive'], [HEART, droplet([12, 13.25], 2.25)]);
FILL['blood-donation'] = { solid: [0], cut: [1] };
PARTS['blood-donation'] = { heart: [0], drop: [1] };
// Beside the badge the heart is smaller and moves up and to the left, so the badge takes only its point
// (its pulse without the short flats at its ends, which came within 2.4 of the smaller heart)
add('heart-pulse-alert', ['arritmia', 'ritmo anormal', 'alerta cardiaca', 'abnormal heart rhythm', 'heart rate alert', 'arrhythmia'], [HP.d[0], line([9.25, 12], [10.75, 9.75], [13.25, 14.25], [14.75, 12])].map((d) => scale(d, 0.82, [3.25, 3.75])), { badge: badge('alert') });
FILL['heart-pulse-alert'] = { solid: [0], cut: [1] };
PARTS['heart-pulse-alert'] = { heart: [0], pulse: [1] };

// ── Infusion and blood ────────────────────────────────────────────────────────────────────────
// IV drip: the bag hangs from the hook of a pole, its drip chamber below and the line running down
{
  const pole = roundline([[10.5, 5.75], [10.5, 3.25], [17.75, 3.25], [17.75, 21.25]], [0, 1, 1.25, 0]);
  const bag = sq(6.25, 5.75, 8.5, 8, 2.25);
  const chamber = sq(9, 16, 3, 3.25, 0.9);
  add('iv-drip', ['suero', 'goteo intravenoso', 'infusión', 'hospitalización', 'iv drip', 'infusion', 'iv bag'], [pole, bag, vl(10.5, 13.75, 16), chamber, vl(10.5, 19.25, 21.25)]);
  FILL['iv-drip'] = { solid: [1, 3], wire: [0, 2, 4] };
  PARTS['iv-drip'] = { pole: [0], bag: [1], line: [2, 3, 4] };
}
// Blood bag: a flat bag (a container: the signature corner) with a drop of blood on its face and the
// tube leaving its bottom; no pole
{
  const bag = sq(5.25, 2.75, 13.5, 14.25, 3, BR);
  const tubeD = 'M12 17V18.25C12 20.1 13.15 21.25 15 21.25H17.75';
  add('blood-bag', ['bolsa de sangre', 'transfusión', 'banco de sangre', 'hemoderivados', 'blood bag', 'transfusion', 'blood bank'], [bag, droplet([12, 10.75], 2.5), tubeD]);
  FILL['blood-bag'] = { solid: [0], cut: [1], wire: [2] };
  PARTS['blood-bag'] = { bag: [0], drop: [1], tube: [2] };
}
// Blood test: a capped sample tube upright, its blood's level inside, and a drop of blood beside its
// top (right above the cap, the drop was a candle's flame)
{
  const cap = sq(5, 6.75, 6.5, 3, 1);
  const R = halfChord([5.75, 18.75], [10.75, 18.75]);
  const t = `M5.75 9.75V18.75A${R} ${R} 0 0 0 10.75 18.75V9.75`;
  add('blood-test', ['análisis de sangre', 'toma de muestra', 'tubo de ensayo', 'laboratorio', 'blood test', 'blood draw', 'blood work'], [t, hl(14.75, 5.75, 10.75), cap, droplet([17, 8], 2.4)]);
  FILL['blood-test'] = { solid: [`${t}Z`, 2, 3], cut: [1, hl(9.75, 5.75, 10.75)] };
  PARTS['blood-test'] = { tube: [0, 1], cap: [2], drop: [3] };
}

// ── Measuring ─────────────────────────────────────────────────────────────────────────────────
// Thermometer: drawn level from its probe's tip, a thin probe into the body's tapered nose, the body
// with its display (a slot) and its button (a dot) at the round back end; then laid at 45°, the
// probe down to the left
{
  const body = roundpoly([[7.25, -1.25], [10, -3.25], [21, -3.25], [21, 3.25], [10, 3.25], [7.25, 1.25]], [0.6, 1.25, 3.25, 3.25, 1.25, 0.6]);
  const th = place([body, hl(0, 10.75, 14.25), dot(18.25, 0), hl(0, 0, 7.25)], -45, [4.1, 19.9]);
  add('medical-thermometer', ['termómetro', 'temperatura corporal', 'fiebre', 'termómetro digital', 'thermometer', 'body temperature', 'fever'], th);
  FILL['medical-thermometer'] = { solid: [0], cut: [1, 2], wire: [3] };
  PARTS['medical-thermometer'] = { body: [0], display: [1], button: [2], probe: [3] };
}
// Blood pressure: the sphygmomanometer's dial and needle, its tube running down to the squeeze bulb (a
// home monitor's box with a cuff seen from its end read as a stack of coins beside a toaster)
{
  const c = [9.25, 9.25];
  const bulb = turnPath(droplet([18.25, 18], 2.75), -90, [18.25, 18]);
  const tube = `M9.25 15.25C9.25 17 10.5 18 12.25 18H${f(18.25 - 2.75 * Math.SQRT2)}`;
  add('blood-pressure', ['presión arterial', 'baumanómetro', 'tensión', 'hipertensión', 'blood pressure', 'bp monitor', 'hypertension'], [circ(...c, 6), line(c, polar(...c, 3.1, -50)), tube, bulb]);
  FILL['blood-pressure'] = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS['blood-pressure'] = { dial: [0], needle: [1], tube: [2], bulb: [3] };
}
// Patient monitor: a screen (the signature corner) on a short arm, an ECG trace across it and two
// small readouts below the trace (dense dots: full dots merged with the trace at bold)
{
  const screen = sq(2.75, 2.75, 18.5, 14, 3, BR);
  const trace = line([5.75, 8.75], [8.5, 8.75], [10, 6], [11.75, 11.75], [13.25, 8.75], [17.5, 8.75]);
  add('patient-monitor', ['monitor de signos vitales', 'cuidados intensivos', 'electrocardiograma', 'patient monitor', 'vital signs', 'ecg'], [screen, trace, dot(14.75, 12.75, 0.3), dot(17.75, 12.75, 0.3), vl(12, 16.75, 21.25), hl(21.25, 8, 16)]);
  FILL['patient-monitor'] = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
  PARTS['patient-monitor'] = { screen: [0], trace: [1], readouts: [2, 3], stand: [4, 5] };
}

// ── Exams and imaging ─────────────────────────────────────────────────────────────────────────
// Otoscope: a long handle with a grip band, a small round head on top and the speculum's long cone
// leaving the head at 45° toward the upper right (level, it read as a hair dryer)
{
  const [c, r] = [[9.75, 9.5], 3];
  const y = c[1] + Math.sqrt(r * r - 1.75 * 1.75);
  const handle = roundline([[8, y], [8, 21.25], [11.5, 21.25], [11.5, y]], [0, 1.75, 1.75, 0]);
  const cone = turnPath(roundline([[c[0] + 2.4, c[1] - 1.8], [c[0] + 10.25, c[1] - 0.8], [c[0] + 10.25, c[1] + 0.8], [c[0] + 2.4, c[1] + 1.8]], [0, 0.6, 0.6, 0]), -45, c);
  add('otoscope', ['otoscopio', 'revisión de oído', 'otorrino', 'chequeo', 'otoscope', 'ear exam', 'ent'], [circ(...c, r), handle, cone, hl(16.25, 8, 11.5)]);
  FILL.otoscope = { solid: [0, `${handle}Z`, `${cone}Z`], cut: [3] };
  PARTS.otoscope = { head: [0], handle: [1, 3], tip: [2] };
}
// X-ray: a landscape film (the signature corner) holding the spine and two pairs of ribs
{
  const ribs = [9, 13.25].flatMap((y) => [`M12 ${f(y)}C9.75 ${f(y)} 7.5 ${f(y + 0.5)} 6.5 ${f(y + 2.5)}`, `M12 ${f(y)}C14.25 ${f(y)} 16.5 ${f(y + 0.5)} 17.5 ${f(y + 2.5)}`]);
  add('x-ray', ['rayos x', 'radiografía', 'radiología', 'imagenología', 'x-ray', 'radiology', 'imaging'], [sq(2.5, 5, 19, 14, 3.5, BR), vl(12, 8, 16), ...ribs]);
  FILL['x-ray'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['x-ray'] = { film: [0], spine: [1], ribs: [2, 3, 4, 5] };
}
// Scanner: the thick ring of the gantry, its bore, and the table sliding into the bore in front of it
// (a piece on top: the engine clears the ring behind it), its leg to the floor
{
  const [c, R, r] = [[14, 10.75], 7.25, 3.5];
  const table = sq(2.5, 12.25, 15.5, 2.75, 1.25);
  add('medical-scanner', ['tomografía', 'resonancia magnética', 'escáner', 'radiología', 'ct scan', 'mri', 'scanner'], [circ(...c, R), circ(...c, r), vl(4.75, 15, 21.25), hl(21.25, 2.75, 6.75)], { badge: { d: [table], knock: table, fill: { solid: [table] } } });
  FILL['medical-scanner'] = { solid: [0], cut: [1], wire: [2, 3] };
  PARTS['medical-scanner'] = { gantry: [0, 1], stand: [2, 3] };
}
// Ultrasound: the transducer held at 45°, a narrow handle widening into the head, and three arcs
// leaving its convex face toward the lower right (level, it read as a megaphone)
{
  const probe = roundpoly([[0, -1.6], [4.5, -1.6], [7, -3.75], [9.25, -3.75], [9.25, 3.75], [7, 3.75], [4.5, 1.6], [0, 1.6]], [1.5, 0.75, 0.75, 1, 1, 0.75, 0.75, 1.5]);
  const T = (d) => move(turnPath(d, 45, [0, 0]), 3.25, 3.25);
  const waves = [5.5, 8.5, 11.5].map((r) => T(arc(7.5, 0, r, -28, 28).d));
  add('ultrasound', ['ecografía', 'ultrasonido', 'transductor', 'imagenología', 'ultrasound', 'sonography', 'probe'], [T(probe), ...waves]);
  FILL.ultrasound = { solid: [0], lines: [1, 2, 3] };
  PARTS.ultrasound = { probe: [0], wave: [1, 2, 3] };
  icons.ultrasound.levels = [[1], [2], [3]];
}
// Swab test: the tube's cap held above it, the swab's stick going down from the cap into the open
// tube, its cotton tip near the bottom
{
  const t = tube(8, 9.5, 21.25, 8);
  add('swab-test', ['hisopado', 'prueba pcr', 'muestra nasal', 'exudado', 'swab test', 'pcr test', 'nasal swab'], [t.tube, sq(8, 2.75, 8, 3, 1), vl(12, 5.75, 15.75), stadium([12, 15.75], [12, 18], 1.1)]);
  FILL['swab-test'] = { solid: [1, 3], wire: [2], lines: [0] };
  PARTS['swab-test'] = { tube: [0], cap: [1], swab: [2, 3] };
}
// Rapid test: a flat cassette (the signature corner, as a card) with its result window, its sample
// well (a dot) and the drop of sample falling toward the well. The window holds no line, the control
// line (negative) or both (positive). (Without the drop, the window with its lines and the well at
// its end read as dispositivos' battery-half and battery-low.)
{
  const cassette = sq(2.5, 10, 19, 9.75, 2.75, BR);
  const win = sq(5.25, 13, 9, 3.75, 1.25);
  const well = dot(17.9, 14.875);
  const drp = droplet([17.9, 5], 2);
  const lines = [vl(8.25, 13, 16.75), vl(11.25, 13, 16.75)];
  const rt = [['rapid-test', ['prueba rápida', 'prueba de antígeno', 'autoprueba', 'rapid test', 'antigen test', 'test kit'], []],
    ['rapid-test-positive', ['prueba positiva', 'resultado positivo', 'dos líneas', 'positive test', 'positive result', 'two lines'], lines],
    ['rapid-test-negative', ['prueba negativa', 'resultado negativo', 'una línea', 'negative test', 'negative result', 'one line'], [lines[0]]]];
  for (const [name, tags, ls] of rt) {
    add(name, tags, [cassette, win, well, drp, ...ls]);
    FILL[name] = { solid: [0, 3], cut: [1, 2, ...ls.map((_, i) => 4 + i)] };
    PARTS[name] = { cassette: [0], window: [1], well: [2], drop: [3], ...(ls.length && { result: ls.map((_, i) => 4 + i) }) };
  }
}
// Antibody: the Y, and a short stroke parallel to each arm on its outer side
{
  const [A, E1, E2] = [[12, 11.25], [6, 5.25], [18, 5.25]];
  const light = (E) => {
    const u = unit(sub(E, A));
    const n = E[0] < 12 ? [u[1], -u[0]] : [-u[1], u[0]];
    return line(add2(lerp(A, E, 0.4), mul(n, 3)), add2(E, mul(n, 3)));
  };
  add('antibody', ['anticuerpo', 'inmunidad', 'inmunología', 'prueba de anticuerpos', 'antibody', 'immunity', 'immunology'], [line(E1, A, E2), vl(12, 11.25, 20.25), light(E1), light(E2)]);
  FILL.antibody = false;
  PARTS.antibody = { heavy: [0, 1], light: [2, 3] };
}

// ── Beds and equipment ────────────────────────────────────────────────────────────────────────
// The family's wheels: a circle of r 1.75 under a short leg
const wheel = (x, y = 19.5) => [vl(x, y - 4.75, y - 1.75), circ(x, y, 1.75)];
// Hospital bed, from the side: the mattress on its base with the back section raised, the side rail
// standing on it, two legs on wheels
{
  const bed = roundpoly([[3.25, 6.75], [8, 11.5], [20.75, 11.5], [20.75, 14.75], [3.25, 14.75]], [1, 0.75, 1, 1, 1]);
  const rail = roundline([[11.75, 11.5], [11.75, 8.25], [18.25, 8.25], [18.25, 11.5]], [0, 0.75, 0.75, 0]);
  add('hospital-bed', ['cama de hospital', 'hospitalización', 'camas disponibles', 'internamiento', 'hospital bed', 'inpatient', 'bed availability'], [bed, rail, ...wheel(6.25), ...wheel(17.75)]);
  FILL['hospital-bed'] = { solid: [0, 3, 5], wire: [1, 2, 4] };
  PARTS['hospital-bed'] = { bed: [0], rail: [1], wheels: [2, 3, 4, 5] };
}
// Stretcher: a flat padded top with the pillow's bump at its head, on crossed folding legs with wheels
{
  const top = sq(2.75, 9.25, 18.5, 3.25, 1.5);
  const pillow = 'M4.25 9.25C4.25 6.75 8.25 6.75 8.25 9.25';
  add('stretcher', ['camilla', 'traslado de paciente', 'emergencia', 'paramédicos', 'stretcher', 'gurney', 'patient transport'], [top, pillow, line([6.25, 12.5], [17.75, 17.75]), line([17.75, 12.5], [6.25, 17.75]), circ(6.25, 19.5, 1.75), circ(17.75, 19.5, 1.75)]);
  FILL.stretcher = { solid: [0, `${pillow}Z`, 4, 5], wire: [2, 3] };
  PARTS.stretcher = { top: [0, 1], legs: [2, 3], wheels: [4, 5] };
}
// Exam table: a padded top on its legs (four, two seen from the side), its head end raised and the
// paper roll under the head
{
  const pad = roundpoly([[2.75, 7.5], [5.25, 6], [8.75, 10.25], [21.25, 10.25], [21.25, 13.25], [7.25, 13.25]], [0.75, 0.75, 0.75, 1.25, 1.25, 0.75]);
  add('exam-table', ['mesa de exploración', 'consultorio', 'revisión médica', 'chequeo', 'exam table', 'examination table', 'checkup'], [pad, vl(9.75, 13.25, 21.25), vl(19, 13.25, 21.25), circ(4.5, 12.75, 1.75)]);
  FILL['exam-table'] = { solid: [0, 3], wire: [1, 2] };
  PARTS['exam-table'] = { pad: [0], legs: [1, 2], roll: [3] };
}
// Oxygen tank: a cylinder with a domed top, the valve on it, the regulator's gauge (its needle
// touching the dial) piped from the valve, and the hose hanging from the gauge (a bare round gauge
// beside the valve read as a perfume atomizer's bulb)
{
  const tank = 'M4.75 11.5A4.5 4.5 0 0 1 13.75 11.5V19.25C13.75 20.35 12.85 21.25 11.75 21.25H6.75C5.65 21.25 4.75 20.35 4.75 19.25Z';
  const domeY = (x) => 11.5 - Math.sqrt(4.5 * 4.5 - (x - 9.25) ** 2);
  const valve = roundline([[8, domeY(8)], [8, 4.25], [10.5, 4.25], [10.5, domeY(10.5)]], [0, 0.6, 0.6, 0]);
  const g = [18, 5.75];
  const hose = 'M18 8.75V15.5C18 17.25 19 18.25 20.75 18.25';
  add('oxygen-tank', ['tanque de oxígeno', 'oxigenoterapia', 'cilindro', 'gases medicinales', 'oxygen tank', 'oxygen therapy', 'cylinder'], [tank, valve, hl(5.75, 10.5, 15), circ(...g, 3), line(g, polar(...g, 3, -40)), hose]);
  // Filled, the needle stops short of the dial's edge (cut to it, it would break the ring at regular)
  FILL['oxygen-tank'] = { solid: [0, shut(valve), 3], cut: [line(g, polar(...g, 1.9, -40))], wire: [2, 5] };
  PARTS['oxygen-tank'] = { tank: [0], valve: [1, 2], gauge: [3], needle: [4], hose: [5] };
}
// Oxygen mask, from the front: the cup a rounded triangle over the nose and mouth with its valve (a
// dot), the strap running out to both sides behind it and the tube hanging from its base (from the
// side, the cup read as a letter)
{
  const mask = roundpoly([[12, 2.75], [19, 16], [5, 16]], [3, 3.5, 3.5]);
  add('oxygen-mask', ['mascarilla de oxígeno', 'anestesia', 'respirador', 'oxígeno', 'oxygen mask', 'anesthesia mask', 'oxygen'], [mask, dot(12, 11.5), hl(10.5, 2.75, 8.3), hl(10.5, 15.7, 21.25), 'M12 16V18.25C12 20.1 13.15 21.25 15 21.25H17.25']);
  FILL['oxygen-mask'] = { solid: [0], cut: [1], wire: [2, 3, 4] };
  PARTS['oxygen-mask'] = { mask: [0, 1], strap: [2, 3], tube: [4] };
}

// ── Surgery and wounds ────────────────────────────────────────────────────────────────────────
// Scalpel: drawn level from its blade's tip, a short curved blade on a slim handle; then laid at 45°,
// the blade down to the left
{
  const blade = 'M9.25 -1.25H1.75C3 1.5 5.75 2.75 9.25 2.75Z';
  const handle = sq(9.25, -1.25, 13, 2.5, 1.25, { square: ['tl', 'bl'] });
  const sc = place([blade, handle], -45, [3.5, 20.5]);
  add('scalpel', ['bisturí', 'cirugía', 'operación', 'procedimiento', 'scalpel', 'surgery', 'operation'], sc);
  FILL.scalpel = { solid: [0, 1], cut: [place([vl(9.25, -1.25, 1.25)], -45, [3.5, 20.5])[0]] };
  PARTS.scalpel = { blade: [0], handle: [1] };
}
// Stitches: a curved incision crossed square by four short stitches, as a scar is drawn (slanted,
// they read as tally marks)
{
  const P = [[3.25, 15.5], [8.75, 10.5], [14.75, 9], [20.75, 9.25]];
  const at = (t) => [0, 1].map((i) => (1 - t) ** 3 * P[0][i] + 3 * (1 - t) ** 2 * t * P[1][i] + 3 * (1 - t) * t * t * P[2][i] + t ** 3 * P[3][i]);
  const tan = (t) => unit(sub(at(t + 0.001), at(t - 0.001)));
  const stitch = (t) => {
    const c = at(t);
    const u = tan(t);
    const v = [-u[1], u[0]];
    return line(add2(c, mul(v, -2.75)), add2(c, mul(v, 2.75)));
  };
  add('stitches', ['puntos de sutura', 'sutura', 'herida cerrada', 'retirar puntos', 'stitches', 'sutures', 'wound care'], [`M${pt(P[0])}C${pt(P[1])} ${pt(P[2])} ${pt(P[3])}`, ...[0.16, 0.38, 0.6, 0.82].map(stitch)]);
  FILL.stitches = false;
  PARTS.stitches = { incision: [0], stitches: [1, 2, 3, 4] };
}
// Bandage roll: the roll from its end (its core showing), the strip unrolling along the floor and the
// small clip holding its loose end
{
  const roll = circ(9.25, 9.75, 6.25);
  const strip = roundline([[9.25, 16], [9.25, 16], [18.25, 16], [18.25, 19.75], [5.75, 19.75]], [0, 0, 0, 0, 0]);
  add('bandage-roll', ['venda', 'gasa', 'vendaje', 'primeros auxilios', 'bandage roll', 'gauze', 'elastic bandage'], [roll, circ(9.25, 9.75, 2.25), `M9.25 16H17`, sq(17, 14.5, 4, 6.75, 1)]);
  FILL['bandage-roll'] = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS['bandage-roll'] = { roll: [0, 1], strip: [2], clip: [3] };
}
// ── Dentistry ─────────────────────────────────────────────────────────────────────────────────
add('tooth', ['diente', 'muela', 'dentista', 'clínica dental', 'tooth', 'dentist', 'dental care'], [TOOTH]);
FILL.tooth = { solid: [0] };
// Cavity: a hole in the top of the crown (a dot: ink in the outline, paper in the fill)
add('tooth-cavity', ['caries', 'cavidad', 'empaste necesario', 'tooth decay', 'cavity', 'decay'], [TOOTH, dot(14.75, 7.25)]);
FILL['tooth-cavity'] = { solid: [0], cut: [1] };
// Filling: an outlined patch set into the top of the crown
add('tooth-filling', ['resina', 'empaste', 'curación dental', 'filling', 'dental filling', 'restoration'], [TOOTH, sq(9.25, 7.75, 5.5, 3, 1.5)]);
FILL['tooth-filling'] = { solid: [0], cut: [1] };
// Broken: a jagged crack running down from the crown's dip
add('tooth-broken', ['diente roto', 'fractura dental', 'diente astillado', 'broken tooth', 'chipped tooth', 'cracked tooth'], [TOOTH, line([12, 4.9], [10.75, 7.5], [13.1, 9.5], [11.75, 12])]);
FILL['tooth-broken'] = { solid: [0], cut: [1] };
for (const name of ['tooth-cavity', 'tooth-filling', 'tooth-broken']) PARTS[name] = { tooth: [0], mark: [1] };
// Toothache: the molar smaller and to the left, three short strokes of pain radiating from its side
{
  const t = toothPath([9, 12.25], 0.76);
  const pain = [-30, 0, 30].map((a) => line(polar(9, 11.75, 9.5, a), polar(9, 11.75, 12.25, a)));
  add('toothache', ['dolor de muelas', 'dolor dental', 'urgencia dental', 'toothache', 'tooth pain', 'dental emergency'], [t, ...pain]);
  FILL.toothache = { solid: [0], lines: [1, 2, 3] };
  PARTS.toothache = { tooth: [0], pain: [1, 2, 3] };
}
// Implant: the crown (the molar's top, cut flat) floating above a tapered post, its threads slanted
// across it (three lines turned it into a ladder; the post's tip is the third)
{
  const crown = 'M12 4.9C10.6 3.5 9.05 2.75 7.65 2.75C5.6 2.75 4.75 4.85 4.75 7.6C4.75 9.25 5.2 10.4 5.85 11.5H18.15C18.8 10.4 19.25 9.25 19.25 7.6C19.25 4.85 18.4 2.75 16.35 2.75C14.95 2.75 13.4 3.5 12 4.9Z';
  const post = roundpoly([[9.25, 14.25], [14.75, 14.25], [13.25, 21.25], [10.75, 21.25]], [0.75, 0.75, 1, 1]);
  add('tooth-implant', ['implante dental', 'tornillo dental', 'prótesis', 'dental implant', 'implant', 'tooth replacement'], [crown, post, ...[[17.25, 16.25], [20.25, 19.25]].map(([yl, yr]) => line([9.25 + ((yl - 14.25) * 1.5) / 7, yl], [14.75 - ((yr - 14.25) * 1.5) / 7, yr]))]);
  FILL['tooth-implant'] = { solid: [0, 1], cut: [2, 3] };
  PARTS['tooth-implant'] = { crown: [0], post: [1, 2, 3] };
}
/** A four-point sparkle (ia's), centered at c with arms of length r. */
const sparkle = ([cx, cy], r) => {
  const k = r * 0.11;
  return `M${pt([cx, cy - r])}C${pt([cx + k, cy - k])} ${pt([cx + k, cy - k])} ${pt([cx + r, cy])}C${pt([cx + k, cy + k])} ${pt([cx + k, cy + k])} ${pt([cx, cy + r])}C${pt([cx - k, cy + k])} ${pt([cx - k, cy + k])} ${pt([cx - r, cy])}C${pt([cx - k, cy - k])} ${pt([cx - k, cy - k])} ${pt([cx, cy - r])}Z`;
};
add('tooth-whitening', ['blanqueamiento dental', 'estética dental', 'sonrisa', 'teeth whitening', 'cosmetic dentistry', 'white teeth'], [toothPath([9.75, 13.75], 0.78), sparkle([18.5, 5], 3)]);
FILL['tooth-whitening'] = { solid: [0, 1] };
PARTS['tooth-whitening'] = { tooth: [0], sparkle: [1] };
// Braces: the family's molar with the bracket (a small square, its hole 2 wide at regular) on its
// crown and the wire running out to both sides of the tooth (two plain teeth with dots read as two
// pills, or a pause sign)
{
  const bracket = sq(10.25, 8.25, 3.5, 3.5, 0.9);
  add('dental-braces', ['brackets', 'frenos', 'ortodoncia', 'braces', 'orthodontics', 'dental braces'], [TOOTH, hl(10, 2.25, 10.25), bracket, hl(10, 13.75, 21.75)]);
  FILL['dental-braces'] = { solid: [0], lines: [1, 2, 3] };
  PARTS['dental-braces'] = { tooth: [0], wire: [1, 3], bracket: [2] };
}
// Dentures, from the front: the gums around a closed bite, two rows of three teeth (a gum's dome over
// one row of teeth read as a jellyfish, or a mushroom; four teeth to a row were too dense)
{
  const gums = sq(3.25, 5.5, 17.5, 13, 4.5);
  const bite = sq(6.25, 8.5, 11.5, 7, 2);
  const gaps = [10.1, 13.9].map((x) => vl(x, 8.5, 15.5));
  add('dentures', ['dentadura', 'placa dental', 'prótesis dental', 'dentures', 'false teeth', 'denture'], [gums, bite, hl(12, 6.25, 17.75), ...gaps]);
  FILL.dentures = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS.dentures = { gums: [0], teeth: [1, 2, 3, 4] };
  // At 16 px: the same three teeth to a row, on pixel centers, a pixel apart
  const gums16 = sq(2.25, 3.75, 19.5, 15, 4.5);
  const bite16 = sq(5.25, 6.75, 13.5, 9, 1.5);
  const marks16 = [hl(11.25, 5.25, 18.75), vl(9.75, 6.75, 15.75), vl(14.25, 6.75, 15.75)];
  icons.dentures.small = { d: [gums16, bite16, ...marks16], fill: { solid: [gums16], cut: [bite16, ...marks16] } };
}
// Dental chair, from the side: the reclined chair (back, seat and leg rest) on its pedestal, the lamp
// on its arm over the headrest
{
  const chair = roundline([[3.5, 6.75], [8.25, 13.5], [16, 13.5], [20.5, 18]], [0, 1.25, 1.25, 0]);
  const lamp = 'M9.25 6.25A2.75 2.75 0 0 1 14.75 6.25Z';
  add('dental-chair', ['sillón dental', 'consultorio dental', 'dentista', 'visita al dentista', 'dental chair', 'dentist office', 'dentist visit'], [chair, vl(12, 13.5, 21.25), hl(21.25, 8.25, 15.75), lamp, roundline([[12, 3.5], [12, 2.75], [20.75, 2.75], [20.75, 9.75]], [0, 0, 1.25, 0])]);
  FILL['dental-chair'] = { solid: [3], wire: [0, 1, 2, 4] };
  PARTS['dental-chair'] = { chair: [0, 1, 2], lamp: [3, 4] };
}
// Dental tools: the mirror and the explorer crossed, the mirror's round head up to the right and the
// explorer's hook up to the left
{
  const mirror = circ(17.75, 6.25, 2.75);
  const mStick = line([4.25, 19.75], polar(17.75, 6.25, 2.75, 135));
  const probe = 'M19.75 19.75L7.25 7.25C5.5 5.5 5.25 3.75 6.75 3.25';
  add('dental-tools', ['instrumental dental', 'espejo dental', 'explorador', 'limpieza dental', 'dental tools', 'dental mirror', 'checkup'], [mirror, mStick, probe]);
  FILL['dental-tools'] = { solid: [0], wire: [1, 2] };
  PARTS['dental-tools'] = { mirror: [0, 1], explorer: [2] };
}

// ── Eye care ──────────────────────────────────────────────────────────────────────────────────
// Eye chart: a portrait board (the signature corner) with rows that shrink from top to bottom
add('eye-chart', ['cartilla de visión', 'examen de la vista', 'optometría', 'agudeza visual', 'eye chart', 'vision test', 'optometry'], [sq(4.75, 2.75, 14.5, 18.5, 3.5, BR), hl(7, 8.25, 15.75), hl(10.5, 9.25, 14.75), hl(14, 10.25, 13.75), hl(17.5, 11, 13)]);
FILL['eye-chart'] = { solid: [0], cut: [1, 2, 3, 4] };
PARTS['eye-chart'] = { board: [0], rows: [1, 2, 3, 4] };
// Contact lens, three-quarter view: the thin rim (an ellipse), the shallow dome above it and a
// highlight on the dome
{
  const [c, rx, ry] = [[12, 16], 8, 2.25];
  const dome = `M${pt([c[0] - rx, c[1]])}C${pt([c[0] - rx, 3.5])} ${pt([c[0] + rx, 3.5])} ${pt([c[0] + rx, c[1]])}`;
  const rim = ell(c, rx, ry);
  const back = `M${pt([c[0] - rx, c[1]])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([c[0] + rx, c[1]])}`;
  add('contact-lens', ['lentes de contacto', 'pupilentes', 'óptica', 'cuidado de los ojos', 'contact lens', 'contacts', 'eye care'], [dome, rim, 'M8.5 11.1C9 10.25 9.9 9.75 11 9.6']);
  FILL['contact-lens'] = { solid: [`${dome}Z`, 1], cut: [2, back] };
  PARTS['contact-lens'] = { dome: [0], rim: [1], highlight: [2] };
}

// ── Menstrual and sexual health ───────────────────────────────────────────────────────────────
// Cycle: a ring of small dots for the days (dense dots, as the calendar's) with a drop at its top
{
  const days = [];
  for (let i = 1; i < 12; i++) days.push(dot(...polar(12, 12.5, 8.25, -90 + i * 30), 0.3));
  add('menstrual-cycle', ['ciclo menstrual', 'periodo', 'seguimiento del ciclo', 'menstruación', 'menstrual cycle', 'period tracking', 'cycle'], [droplet([12, 4.6], 1.6), ...days]);
  FILL['menstrual-cycle'] = { solid: [0, ...days.map((_, i) => i + 1)] };
  PARTS['menstrual-cycle'] = { drop: [0], days: days.map((_, i) => i + 1) };
}
// Menstrual cup: a bell-shaped cup and its short stem ending in a grip (a dot). No line across its
// rim: with one, the cup read as a glass with a drink in it
{
  const cup = 'M5.25 3.25H18.75C18.75 6 18.5 8 17.75 10.25C16.75 13.5 14.75 15.75 12 15.75S7.25 13.5 6.25 10.25C5.5 8 5.25 6 5.25 3.25Z';
  add('menstrual-cup', ['copa menstrual', 'salud menstrual', 'periodo', 'menstrual cup', 'menstrual health', 'period'], [cup, vl(12, 15.75, 19.25), dot(12, 20.25)]);
  FILL['menstrual-cup'] = { solid: [0, 2], wire: [1] };
  PARTS['menstrual-cup'] = { cup: [0], stem: [1, 2] };
}
// Sanitary pad: a long pad, its ends round, with a small tapered wing on each side of its middle and
// its core inside (wings as long as the pad's ends turned it into a plus sign, the set's cross)
{
  const pad = roundpoly([[7.25, 2.75], [16.75, 2.75], [16.75, 9], [20.25, 10.5], [20.25, 13.5], [16.75, 15], [16.75, 21.25], [7.25, 21.25], [7.25, 15], [3.75, 13.5], [3.75, 10.5], [7.25, 9]], [4.75, 4.75, 0.6, 1, 1, 0.6, 4.75, 4.75, 0.6, 1, 1, 0.6]);
  add('sanitary-pad', ['toalla femenina', 'toalla sanitaria', 'productos menstruales', 'sanitary pad', 'menstrual pad', 'period products'], [pad, stadium([12, 7.5], [12, 16.5], 1.75)]);
  FILL['sanitary-pad'] = { solid: [0], cut: [1] };
  PARTS['sanitary-pad'] = { pad: [0], core: [1] };
}
// Tampon: a slim upright cylinder, its top round and its base nearly flat, and the string trailing
// from the base (wider, with a band across it, it read as a computer mouse on its cable)
{
  const body = roundpoly([[9.25, 2.75], [14.75, 2.75], [14.75, 15.5], [9.25, 15.5]], [2.75, 2.75, 1.25, 1.25]);
  const string = 'M12 15.5V17.25C12 18.5 10.75 18.75 10.75 20C10.75 20.85 11.4 21.25 12.25 21.25';
  add('tampon', ['tampón', 'productos menstruales', 'higiene femenina', 'tampon', 'period products', 'menstrual products'], [body, string]);
  FILL.tampon = { solid: [0], wire: [1] };
  PARTS.tampon = { body: [0], string: [1] };
}
// Condom: a square wrapper with crimped (zigzag) edges and a ring embossed in its center
{
  const [a, b, n, amp] = [3.25, 20.75, 6, 1];
  const pts = [];
  const step = (b - a) / n;
  for (let i = 0; i < n; i++) pts.push([a + i * step, a], [a + (i + 0.5) * step, a + amp]);
  for (let i = 0; i < n; i++) pts.push([b, a + i * step], [b - amp, a + (i + 0.5) * step]);
  for (let i = 0; i < n; i++) pts.push([b - i * step, b], [b - (i + 0.5) * step, b - amp]);
  for (let i = 0; i < n; i++) pts.push([a, b - i * step], [a + amp, b - (i + 0.5) * step]);
  const wrapper = roundpoly(pts, 0.3);
  add('condom', ['condón', 'preservativo', 'salud sexual', 'anticonceptivo', 'condom', 'sexual health', 'contraception'], [wrapper, circ(12, 12, 4.5), circ(12, 12, 1.5)]);
  FILL.condom = { solid: [0], cut: [1, 2] };
  PARTS.condom = { wrapper: [0], ring: [1, 2] };
}
// Awareness ribbon: one ribbon looped at the top, its legs crossing below the loop and splaying down
// into two tails. The leg that rises to the right passes in front (a piece on top: the engine clears
// the other leg behind it)
{
  const front = 'M6.75 20.75L14.6 10.25C16.6 7.5 15.75 3.25 12 3.25';
  const back = 'M12 3.25C8.25 3.25 7.4 7.5 9.4 10.25L17.25 20.75';
  const C = [12, 13.73];
  const u = unit([7.85, -10.5]);
  add('awareness-ribbon', ['listón rosa', 'concientización', 'lucha contra el cáncer', 'causa', 'awareness ribbon', 'cancer awareness', 'pink ribbon'], [back], { badge: { d: [front], knock: line(add2(C, mul(u, -2.5)), add2(C, mul(u, 2.5))) } });
  FILL['awareness-ribbon'] = false;
  PARTS['awareness-ribbon'] = { ribbon: [0] };
}

// ── Bags and boxes ────────────────────────────────────────────────────────────────────────────
// Doctor's bag: its frame across the top (the clasp bar), the handle above it and the body widening
// below (a bag: the signature corner), an outlined cross on its front
{
  const bar = sq(5, 6.75, 14, 2.5, 1.25);
  const body = roundline([[6, 9.25], [3.75, 21.25], [20.25, 21.25], [18, 9.25]], [0, 1.75, 0, 0]);
  add('medical-bag', ['maletín médico', 'visita a domicilio', 'servicios médicos', 'médico', 'medical bag', 'doctor bag', 'house call'], [body, bar, 'M9.5 6.75V5.5A2.5 2.5 0 0 1 14.5 5.5V6.75', cross([12, 15.25], 3, 1.35)]);
  FILL['medical-bag'] = { solid: [`${body}Z`, 1], wire: [2], cut: [3, hl(9.25, 6, 18)] };
  PARTS['medical-bag'] = { body: [0, 1], handle: [2], cross: [3] };
}
// Medical supplies: a shipping box from the front, its flaps closed (the lid's band and the seam
// between the flaps) and an outlined cross on its side
add('medical-supplies', ['insumos médicos', 'material de curación', 'inventario', 'pedido de insumos', 'medical supplies', 'hospital inventory', 'supply order'], [sq(3.25, 5.75, 17.5, 15.5, 2.75, BR), hl(9.5, 3.25, 20.75), vl(12, 5.75, 9.5), cross([12, 15.5], 3, 1.35)]);
FILL['medical-supplies'] = { solid: [0], cut: [1, 2, 3] };
PARTS['medical-supplies'] = { box: [0, 1, 2], cross: [3] };
// Medical alert: a round pendant with a large button, on its cord, sending its signal out to both
// sides (without the signal, a ring on a V-shaped cord read as a medal, or the sign of Taurus)
{
  const c = [12, 14.75];
  const waves = [arc(...c, 8, -35, 35).d, arc(...c, 8, 145, 215).d];
  add('medical-alert-pendant', ['botón de pánico', 'alerta médica', 'teleasistencia', 'adultos mayores', 'medical alert', 'panic button', 'emergency pendant'], [circ(...c, 5), circ(...c, 2.25), line([7.75, 2.75], [12, 9.75], [16.25, 2.75]), ...waves]);
  FILL['medical-alert-pendant'] = { solid: [0], cut: [1], wire: [2], lines: [3, 4] };
  PARTS['medical-alert-pendant'] = { pendant: [0], button: [1], cord: [2], wave: [3, 4] };
  // At 16 px: the pendant on pixel centers, its button a dot (a second ring clogged it), the signal a
  // pixel of paper away
  const c16 = [12, 15];
  const d16 = [circ(...c16, 5.25), dot(...c16), line([6.75, 3.75], [12, 9.75], [17.25, 3.75]), arc(...c16, 8.25, -30, 30).d, arc(...c16, 8.25, 150, 210).d];
  icons['medical-alert-pendant'].small = { d: d16, fill: { solid: [d16[0]], cut: [d16[1]], wire: [d16[2]], lines: [d16[3], d16[4]] } };
}

// ── Injuries and mobility ─────────────────────────────────────────────────────────────────────
// Fracture: a bone drawn level and laid at 45°, broken in two halves whose jagged ends run parallel
// across the gap (each half its shaft and its double knob)
{
  const [w, r, k, g] = [1.6, 2.3, 1.95, 3.75];
  const zig = [[0.6, -w], [-0.6, -0.55], [0.6, 0.55], [-0.6, w]];
  const half = (xk, side) => {
    // side -1: the knobs on the left and the break to the right; side 1: the other way
    const xs = xk - side * Math.sqrt(r * r - (k - w) ** 2);
    const xn = xk + side * Math.sqrt(r * r - k * k);
    const sw = side < 0 ? 0 : 1;
    const bx = 12 + (side * g) / 2;
    const brk = zig.map(([dx, dy]) => [bx + dx, 12 + dy]);
    return `M${pt(brk[0])}L${pt([xs, 12 - w])}A${f(r)} ${f(r)} 0 1 ${sw} ${pt([xn, 12])}A${f(r)} ${f(r)} 0 1 ${sw} ${pt([xs, 12 + w])}L${brk.slice().reverse().map(pt).join('L')}Z`;
  };
  const T = (d) => turnPath(d, -45);
  add('bone-fracture', ['fractura', 'hueso roto', 'ortopedia', 'lesión', 'bone fracture', 'broken bone', 'orthopedics'], [T(half(5, -1)), T(half(19, 1))]);
  FILL['bone-fracture'] = { solid: [0, 1] };
  PARTS['bone-fracture'] = { lower: [0], upper: [1] };
}
// Crutch: the underarm pad on top, the forked frame below it joining into one shaft, the hand grip
// across the fork and the rubber foot
{
  const pad = sq(7, 2.75, 10, 2.75, 1.375);
  const fork = roundline([[8.5, 5.5], [8.5, 13], [12, 16.25], [15.5, 13], [15.5, 5.5]], [0, 1.5, 0.75, 1.5, 0]);
  add('crutch', ['muleta', 'lesión', 'movilidad', 'recuperación', 'crutch', 'crutches', 'injury'], [pad, fork, hl(10.25, 8.5, 15.5), vl(12, 16.25, 18.5), sq(10.5, 18.5, 3, 2.75, 1)]);
  FILL.crutch = { solid: [0, 4], wire: [1, 2, 3] };
  PARTS.crutch = { pad: [0], frame: [1, 2, 3], foot: [4] };
}
// Walker, three-quarter view: two U-shaped sides (the far one higher and to the right) joined by the
// front bar, which passes in front of the near side's back leg (a piece on top: the engine clears it)
{
  const near = roundline([[3.25, 21.25], [3.25, 7.75], [10.75, 7.75], [10.75, 21.25]], [0, 1.75, 1.75, 0]);
  const far = roundline([[14, 18], [14, 4.5], [21, 4.5], [21, 18]], [0, 1.75, 1.75, 0]);
  const bar = line([3.25, 12.75], [14, 9.5]);
  const at = (x) => [x, 12.75 - ((x - 3.25) * 3.25) / 10.75];
  add('walker', ['andadera', 'andador', 'movilidad', 'adultos mayores', 'walker', 'walking frame', 'mobility aid'], [near, far], { badge: { d: [bar], knock: line(at(9.25), at(12.25)) } });
  FILL.walker = false;
  PARTS.walker = { near: [0], far: [1] };
}
// Walking cane: the rounded crook handle, the shaft and its rubber tip
add('walking-cane', ['bastón', 'apoyo para caminar', 'movilidad', 'adultos mayores', 'walking cane', 'cane', 'walking stick'], ['M7.25 10V7.5A3.75 3.75 0 0 1 14.75 7.5V18.5', sq(13.25, 18.5, 3, 2.75, 1)]);
FILL['walking-cane'] = { solid: [1], wire: [0] };
PARTS['walking-cane'] = { cane: [0], tip: [1] };
// Arm sling: a person from the waist up (the core person's head and shoulders, larger) with the
// triangular sling across the chest, cradling the forearm, and its strap rising from the sling's
// corner up to the shoulder (the sling is a piece on top: the engine clears the body behind it;
// without the body, a bent arm in a sling read as a boot)
{
  const head = circ(12, 5.75, 3.25);
  const body = 'M3.25 21.25V17.75C3.25 13.75 7 11.5 12 11.5S20.75 13.75 20.75 17.75V21.25';
  const sling = roundpoly([[6.5, 15.75], [17.5, 15.75], [12, 21.25]], [1, 1, 1.25]);
  // The shoulder line at x: the body's right cubic, solved for its y
  const shoulder = (x) => {
    const P = [[12, 11.5], [17, 11.5], [20.75, 13.75], [20.75, 17.75]];
    let [lo, hi] = [0, 1];
    for (let i = 0; i < 40; i++) {
      const t = (lo + hi) / 2;
      const bx = (1 - t) ** 3 * P[0][0] + 3 * (1 - t) ** 2 * t * P[1][0] + 3 * (1 - t) * t * t * P[2][0] + t ** 3 * P[3][0];
      if (bx < x) lo = t;
      else hi = t;
    }
    const t = lo;
    return (1 - t) ** 3 * P[0][1] + 3 * (1 - t) ** 2 * t * P[1][1] + 3 * (1 - t) * t * t * P[2][1] + t ** 3 * P[3][1];
  };
  const strap = line([17.5, 15.75], [15, shoulder(15)]);
  add('arm-sling', ['cabestrillo', 'brazo roto', 'lesión de brazo', 'recuperación', 'arm sling', 'arm injury', 'sling'], [head, body, strap], { badge: { d: [sling], knock: sling, fill: { solid: [sling] } } });
  FILL['arm-sling'] = { solid: [0, `${body}Z`], cut: [2] };
  PARTS['arm-sling'] = { head: [0], body: [1], strap: [2] };
}
// Leg cast, from the side: the lower leg and foot in one thick cast (an L), its bands across the
// shin, and the toes showing at its front
{
  const cast = roundpoly([[7.25, 2.75], [14.25, 2.75], [14.25, 13.5], [18, 14.5], [18, 20.5], [7.25, 20.5]], [1.25, 1.25, 1.5, 1.5, 1.25, 2.25]);
  const toes = 'M18 15.25A1.25 1.25 0 0 1 18 17.75A1.25 1.25 0 0 1 18 20.25';
  add('leg-cast', ['yeso', 'pierna rota', 'férula', 'ortopedia', 'leg cast', 'broken leg', 'cast'], [cast, hl(6.75, 7.25, 14.25), hl(10.25, 7.25, 14.25), toes]);
  FILL['leg-cast'] = { solid: [0, `${toes}Z`], cut: [1, 2] };
  PARTS['leg-cast'] = { cast: [0, 1, 2], toes: [3] };
}

// ── Places and vehicles ───────────────────────────────────────────────────────────────────────
// Ambulance, from the side: comercio's truck proportions with a high box, an outlined cross on its
// side, the light on its roof (a dot: a half disc's hole closed at bold) and the cab in front
{
  const box = sq(2.5, 4.75, 12.25, 10.5, 2.5, { square: ['br'] });
  const cab = roundline([[14.75, 8.5], [17.25, 8.5], [21.5, 12.25], [21.5, 15.25], [14.75, 15.25]], [0, 1.25, 1.5, 0, 0]);
  add('ambulance', ['ambulancia', 'emergencias', 'urgencias', 'traslado', 'ambulance', 'emergency', 'paramedics'], [box, cab, dot(8.5, 3.6, 1), cross([8.63, 10], 2.75, 1.25), circ(7, 19.75, 1.75), circ(17.75, 19.75, 1.75)]);
  FILL.ambulance = { solid: [0, `${cab}Z`, 2, 4, 5], cut: [3, vl(14.75, 8.5, 15.25)] };
  PARTS.ambulance = { body: [0, 1], light: [2], cross: [3], wheels: [4, 5] };
}
// Pharmacy: a small shop front (the signature corner) with its door, and the cross sign projecting
// from its upper corner on a bracket
{
  const shop = sq(2.75, 7.25, 10.25, 14, 2.25, BR);
  add('pharmacy', ['farmacia', 'botica', 'droguería', 'localizador', 'pharmacy', 'drugstore', 'chemist'], [shop, roundline([[5.75, 21.25], [5.75, 15.25], [10, 15.25], [10, 21.25]], [0, 1, 1, 0]), hl(10.5, 13, 15.5), cross([18.5, 10.5], 3, 1.35)]);
  FILL.pharmacy = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS.pharmacy = { shop: [0, 1], bracket: [2], sign: [3] };
}
// Clinic: a low building whose flat roof is one line a little wider than its walls, an outlined cross
// over its door
{
  const body = roundline([[3.5, 6.5], [3.5, 21.25], [20.5, 21.25], [20.5, 6.5]], [0, 2, 0, 0]);
  add('clinic', ['clínica', 'consultorio', 'urgencias', 'centro de salud', 'clinic', 'doctor office', 'urgent care'], [body, hl(6.5, 2.25, 21.75), cross([12, 11.75], 2.75, 1.25), roundline([[10.25, 21.25], [10.25, 17.5], [13.75, 17.5], [13.75, 21.25]], [0, 1, 1, 0])]);
  FILL.clinic = { solid: [`${body}Z`], cut: [2, 3], wire: [1] };
  PARTS.clinic = { building: [0, 1, 3], cross: [2] };
}

// ── Hygiene and allergies ─────────────────────────────────────────────────────────────────────
// Face mask: a pleated rectangle with rounded corners, an ear loop on each side
{
  const mask = sq(6, 6.5, 12, 11, 3);
  const loop = 'M6 8.5C3.75 8.5 2.75 9.75 2.75 12S3.75 15.5 6 15.5';
  add('medical-mask', ['cubrebocas', 'mascarilla', 'tapabocas', 'control de infecciones', 'face mask', 'medical mask', 'masks required'], [mask, hl(10, 6, 18), hl(13.75, 6, 18), loop, flipPath(loop)]);
  FILL['medical-mask'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS['medical-mask'] = { mask: [0, 1, 2], loops: [3, 4] };
}
// Hand sanitizer: a pump bottle (the signature corner), its stem up to the head and the nozzle bent
// down, a drop on its label
{
  const bottle = sq(5.5, 10.5, 12, 10.75, 3, BR);
  const head = roundline([[9.5, 3.75], [17.5, 3.75], [17.5, 6.25]], [0, 1.5, 0]);
  add('hand-sanitizer', ['gel antibacterial', 'desinfectante de manos', 'higiene', 'hand sanitizer', 'sanitizer', 'hygiene station'], [bottle, sq(8.75, 8.25, 5.5, 2.25, 0.6), vl(11.5, 3.75, 8.25), head, droplet([11.5, 16.25], 2)]);
  FILL['hand-sanitizer'] = { solid: [0, 1], cut: [4, hl(10.5, 8.75, 14.25)], wire: [2, 3] };
  PARTS['hand-sanitizer'] = { bottle: [0, 1], pump: [2, 3], drop: [4] };
}
// Allergy: lugares' flower head, smaller, on a short stem, releasing a trail of pollen dots up and to
// the right
{
  const fl = L.flower;
  const T = (d) => scale(d, 0.78, [12, 8.75], -3.5, 1.75);
  const pollen = [dot(15.75, 7.75), dot(18.75, 4.75), dot(19.75, 9.5)];
  add('allergy', ['alergia', 'polen', 'alergia estacional', 'rinitis', 'allergy', 'pollen', 'hay fever'], [T(fl.d[0]), T(fl.d[1]), line(T('M12 13.65L12 13.65').match(/M([\d.]+ [\d.]+)/)[1].split(' ').map(Number), [8.5, 21.25]), ...pollen]);
  FILL.allergy = { solid: [0, 3, 4, 5], cut: [1], wire: [2] };
  PARTS.allergy = { flower: [0, 1], stem: [2], pollen: [3, 4, 5] };
}

// The medical symbol: the outlined Greek cross at the size of the circle keyline
add('medical-cross', ['cruz médica', 'salud', 'servicios médicos', 'clínica', 'medical cross', 'health', 'medical'], [cross([12, 12], 9, 3, 2, 0.75)]);
FILL['medical-cross'] = { solid: [0] };

// ── Fill, parts, motion, mirror and variants, in blocks ───────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (!spec) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// A badge moves on its own: the clock turns its hands, the sync arrows turn, an alert rocks
for (const name of ['pill-clock', 'syringe-clock', 'pill-bottle-sync', 'prescription-clock', 'lab-results-clock']) icons[name].motion = { effect: 'spin', parts: ['badge'], origin: BC };
for (const name of ['pill-alert', 'lab-results-alert', 'heart-pulse-alert']) icons[name].motion = { effect: 'wiggle', parts: ['badge'], origin: BC };
icons.pill.motion = { effect: 'wiggle', origin: [12, 12] };
icons.syringe.motion = { effect: 'slide', vector: [-1.25, 1.25] };

export default { category: 'salud', label: 'Salud y medicina', icons };
