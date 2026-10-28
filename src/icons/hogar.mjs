// Home and furniture: sofas and seats, beds and bedding, tables, storage, lamps, decor, rooms,
// windows and doors, the house's parts and the bathroom. Everything is computed with the engine
// (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and
// a square bottom-right corner on containers (cabinets, chests, frames, windows). One view per kind:
// sofas and armchairs from the front, chairs in profile, beds from the foot (lugares' `bed`, in
// profile, is the bed of the badges and the rooms). Doors are lugares' `door`, the room is
// bienes-raices' `room`; badges are the engine's.
import { arc, badge, circ, dot, f, flipPath, halfChord, head, line, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import bienesRaices from './bienes-raices.mjs';
import lugares from './lugares.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as lugares'. */
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

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    const R = halfChord([x, y + r], [x + w, y + r]);
    return `M${pt([x, y + r])}A${R} ${R} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${R} ${R} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  const R = halfChord([x + r, y], [x + r, y + h]);
  return `M${pt([x + r, y])}H${f(x + w - r)}A${R} ${R} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${R} ${R} 0 0 1 ${pt([x + r, y])}Z`;
}

/** Ellipse with semi-axes rx, ry (four cubics), as lugares'. */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}
/** A point on that ellipse at `deg` degrees (0 = right, 90 = down). */
const onEll = ([cx, cy], rx, ry, deg) => [cx + rx * Math.cos((deg * Math.PI) / 180), cy + ry * Math.sin((deg * Math.PI) / 180)];
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs collected as the icons are drawn (by index of `d`; `close` shuts the solid ones). */
const FILL = {};

// ── Sofas and armchairs (from the front) ──────────────────────────────────────────────────────
// One construction: the body is a single closed shape, two rolled arms and the seat's front between
// them; the back rises behind, its legs landing on the arms' crowns; the seat is split into its
// cushions, and two short feet stand under the body. Filled, the whole sofa is solid and the arms'
// inner edges with the seat line are knocked out.
function couch({ x0 = 2.75, x1 = 21.25, armW = 3.5, armTop = 10.75, seat = 14, base = 18.25, back = 5.75, seats = 3, feet = 20.5, backR = 2.5, arch = false } = {}) {
  const [ia, ib] = [x0 + armW, x1 - armW];
  const ra = armW / 2 - 0.05;
  const [xa, xb] = [x0 + armW / 2, x1 - armW / 2];
  const body = roundpoly(
    [[x0, base], [x0, armTop], [ia, armTop], [ia, seat], [ib, seat], [ib, armTop], [x1, armTop], [x1, base]],
    [1.5, ra, ra, 0.6, 0.6, ra, ra, 1.5],
  );
  let backD;
  if (arch) {
    const R = halfChord([xa, armTop - 0.5], [xb, armTop - 0.5]);
    backD = `M${pt([xa, armTop])}V${f(armTop - 0.5)}A${R} ${R} 0 0 1 ${pt([xb, armTop - 0.5])}V${f(armTop)}`;
  } else backD = roundline([[xa, armTop], [xa, back], [xb, back], [xb, armTop]], [0, backR, backR, 0]);
  const dividers = Array.from({ length: seats - 1 }, (_, i) => {
    const x = ia + ((ib - ia) * (i + 1)) / seats;
    return vl(x, seat, base);
  });
  const fx = x0 + 2.5;
  const feetD = [vl(fx, base, feet), vl(x1 - (fx - x0), base, feet)];
  // Fill: the back's region down to the seat, the body, and the arms' inner contour knocked out
  const backFill = arch
    ? `M${pt([xa, seat])}V${f(armTop - 0.5)}A${halfChord([xa, armTop - 0.5], [xb, armTop - 0.5])} ${halfChord([xa, armTop - 0.5], [xb, armTop - 0.5])} 0 0 1 ${pt([xb, armTop - 0.5])}V${f(seat)}Z`
    : roundpoly([[xa, seat], [xa, back], [xb, back], [xb, seat]], [0, backR, backR, 0]);
  const inner = roundline([[xa, armTop], [ia, armTop], [ia, seat], [ib, seat], [ib, armTop], [xb, armTop]], [0, ra, 0.6, 0.6, ra, 0]);
  return { body, back: backD, dividers, feet: feetD, d: [body, backD, ...dividers, ...feetD], fill: { solid: [body, backFill], cut: [inner, ...dividers], wire: feetD }, ia, ib, xa, xb };
}
const SOFA = couch();
add('sofa', ['sofá', 'sillón', 'sala', 'tres plazas', 'sofa', 'couch'], SOFA.d, { fill: SOFA.fill });
const LOVESEAT = couch({ x0: 4, x1: 20, back: 4.75, armTop: 10.25, seat: 13.75, base: 18.25, seats: 2, feet: 20.75 });
add('loveseat', ['sofá de dos plazas', 'love seat', 'sofá pequeño', 'dos plazas', 'loveseat', 'two-seater'], LOVESEAT.d, { fill: LOVESEAT.fill });
const ARMCHAIR = couch({ x0: 4.25, x1: 19.75, armW: 4, armTop: 11.25, seat: 14.25, base: 18.25, seats: 1, feet: 20.5, arch: true });
add('armchair', ['sillón', 'butaca', 'sillón individual', 'armchair', 'accent chair', 'club chair'], ARMCHAIR.d, { fill: ARMCHAIR.fill });

// Sectional: the sofa's left arm and back; its right end steps forward into a chaise: the seat line
// turns toward the viewer and runs into the chaise's top edge, whose front stands lower than the
// sofa's.
{
  const [armTop, seat, base, cBase] = [9.75, 13, 17, 20.5];
  const ra = 1.7;
  const body = roundpoly(
    [[2.75, base], [2.75, armTop], [6.25, armTop], [6.25, seat], [21.25, seat], [21.25, cBase], [14.25, cBase], [14.25, base]],
    [1.5, ra, ra, 0.6, 0, 1.5, 1.25, 0.6],
  );
  const back = roundline([[4.5, armTop], [4.5, 4.75], [21.25, 4.75], [21.25, seat]], [0, 2.5, 2.5, 0]);
  const turnLine = roundline([[11.25, seat], [14.25, base], [21.25, base]], [0, 0.6, 0]);
  const d = [body, back, turnLine, vl(5.25, base, 19.5)];
  const backFill = roundpoly([[4.5, seat], [4.5, 4.75], [21.25, 4.75], [21.25, seat]], [0, 2.5, 2.5, 0]);
  const inner = roundline([[4.5, armTop], [6.25, armTop], [6.25, seat], [11.25, seat]], [0, ra, 0.6, 0]);
  add('sofa-sectional', ['sofá esquinero', 'sala en L', 'seccional', 'chaise longue', 'sectional', 'corner sofa'], d, {
    fill: { solid: [body, backFill], cut: [`${inner}L${pt([21.5, seat])}`, turnLine], wire: [d[3]] },
  });
}
// Sofa bed: the loveseat's back and arms behind the mattress pulled out in front of its seat, wider
// than the sofa, with the duvet's fold of the beds; the engine clears the sofa around it.
{
  const mattress = sq(2.5, 14.25, 19, 6, 2);
  const fold = hl(17.25, 2.5, 21.5);
  add('sofa-bed', ['sofá cama', 'cama plegable', 'futón', 'invitados', 'sofa bed', 'sleeper sofa'], [LOVESEAT.body, LOVESEAT.back], {
    badge: { d: [mattress, fold], knock: mattress, fill: { solid: [mattress], cut: [fold] } },
    fill: { solid: [LOVESEAT.body, LOVESEAT.fill.solid[1]], cut: [LOVESEAT.fill.cut[0]] },
  });
}

// ── Chairs (in profile, the seat seen from a little above) ────────────────────────────────────
// The chair faces right: its back a narrow frame with the top rail, standing on the back of the
// seat; the seat a slab whose top shows; two straight legs.
const CHAIR = (() => {
  const seat = roundpoly([[6.25, 12.75], [15.75, 12.75], [17.75, 15.25], [8.25, 15.25]], [0.6, 0.6, 0.6, 0.6]);
  const back = roundline([[6.25, 12.75], [6.25, 3.25], [10.25, 3.25], [10.25, 12.75]], [0, 1.25, 1.25, 0]);
  const rail = hl(6.5, 6.25, 10.25);
  const legs = [vl(8.75, 15.25, 21), vl(16.25, 15.25, 21)];
  return { seat, back, rail, legs, d: [back, rail, seat, ...legs] };
})();
add('chair', ['silla', 'comedor', 'asiento', 'silla de madera', 'chair', 'dining chair'], CHAIR.d);
// Rocking chair: the chair's back and seat; its two legs stand on one long rocker.
{
  const rocker = arc(12, -6.5, 27.5, 110, 70).d;
  add('rocking-chair', ['mecedora', 'silla mecedora', 'porche', 'rocking chair', 'rocker'], [CHAIR.back, CHAIR.rail, CHAIR.seat, vl(8.75, 15.25, 20.75), vl(16.25, 15.25, 20.5), rocker]);
}
// Folding chair: the legs cross as an X under a slim seat; the back rises from the rear leg.
{
  const seat = capsule(6.75, 11.75, 11, 2.25);
  add('folding-chair', ['silla plegable', 'eventos', 'plegable', 'renta de sillas', 'folding chair', 'event chair'], [
    seat,
    roundline([[16.25, 21], [8.25, 12.9], [6.5, 3.25]], [0, 0.5, 0]),
    line([7.75, 21], [16, 12.9]),
  ]);
}
// Deck chair: the long back frame leaning back to its foot, the short front frame rising from the rear
// foot to the seat's front, and the canvas sagging between the top of the back and that front (two
// frames of one length crossed as an X, read as a pair of scissors).
add('deck-chair', ['silla de playa', 'tumbona', 'camastro', 'terraza', 'deck chair', 'beach chair'], [
  line([5.75, 3.25], [15.5, 21]),
  line([5.25, 21], [15, 12.25]),
  'M5.75 3.25C6.75 10.25 10.25 14 15 12.25',
]);

// ── Stools, benches and footrests ─────────────────────────────────────────────────────────────
// Stool: the round seat seen from a little above, three splayed legs and the ring that joins them.
{
  const c = [12, 6.75];
  const [rx, ry] = [6.25, 2.5];
  const seat = ell(c, rx, ry);
  const L = onEll(c, rx, ry, 150);
  const R = onEll(c, rx, ry, 30);
  const xAt = (P, Q, y) => P[0] + ((Q[0] - P[0]) * (y - P[1])) / (Q[1] - P[1]);
  add('stool', ['taburete', 'banco alto', 'banquito', 'barra', 'stool', 'bar stool'], [seat, line(L, [5.5, 21]), line(R, [18.5, 21]), vl(12, c[1] + ry, 20.25), hl(15.5, xAt(L, [5.5, 21], 15.5), xAt(R, [18.5, 21], 15.5))]);
}
// Bench: a long plank on two splayed pairs of legs and a low stretcher.
add('bench', ['banca', 'banco', 'recibidor', 'jardín', 'bench', 'entryway bench'], [
  capsule(2.5, 11, 19, 3),
  line([5, 14], [3.75, 20.25]),
  line([8, 14], [9.25, 20.25]),
  line([16, 14], [14.75, 20.25]),
  line([19, 14], [20.25, 20.25]),
  hl(17.25, 8.65, 15.35),
]);
// Ottoman: the padded cushion, rounder and wider than the base it sits on, and the base on short legs
// (a row of tufting dots in a box read as "more").
add('ottoman', ['otomana', 'reposapiés', 'puff', 'banqueta', 'ottoman', 'footstool'], [
  capsule(3.25, 6.5, 17.5, 5),
  roundline([[4.75, 11.5], [4.75, 16.75], [19.25, 16.75], [19.25, 11.5]], [0, 1.5, 1.5, 0]),
  vl(7.25, 16.75, 20.25),
  vl(16.75, 16.75, 20.25),
]);
// Pouf: a squat round seat sitting on the floor, the stitched seam around its middle.
add('pouf', ['puf', 'asiento bajo', 'reposapiés', 'cojín de piso', 'pouf', 'floor cushion'], [
  `M7 7.75H17A3.75 3.75 0 0 1 20.75 11.5V17A3 3 0 0 1 17.75 20H6.25A3 3 0 0 1 3.25 17V11.5A3.75 3.75 0 0 1 7 7.75Z`,
  `M3.25 13.5C6 15.25 9 16 12 16S18 15.25 20.75 13.5`,
]);
// Bean bag: a slouched sack, taller at the back, its dent where you sit, on the floor.
add('bean-bag', ['puf', 'sillón puf', 'pera', 'asiento suave', 'bean bag', 'beanbag chair'], [
  `M4 19.25C2.5 17.5 2.75 13.75 4.75 10.25C6.75 6.5 9.75 4.5 12 5.25C14.25 6 13.25 9.75 14.5 11.25C15.75 12.75 19.75 12 20.75 14.75C21.5 17 20.75 18.75 19.5 19.25Z`,
  `M8 11.5C8.75 12.5 9.5 13 10.75 13`,
]);
// Recliner: in profile, facing right: the back tilted far back, the seat and arm block, and the
// footrest flipped up in front on its linkage.
add('recliner', ['reclinable', 'sillón reclinable', 'descanso', 'confort', 'recliner', 'lounge chair'], [
  roundpoly([[2.75, 5.5], [5.75, 4.25], [9.5, 12.5], [6.25, 13.75]], 1.4),
  sq(6, 12.5, 10, 5.75, 2),
  roundpoly([[17.75, 12], [21.25, 9.75], [21.25, 12.75], [18.75, 14.5]], 1),
  line([16, 16.25], [19.75, 13.8]),
  vl(8.5, 18.25, 20.75),
  vl(13.75, 18.25, 20.75),
]);

// ── Beds ──────────────────────────────────────────────────────────────────────────────────────
// lugares' `bed` (in profile: the headboard, the mattress, the frame and the pillow floating 1.5
// clear of it) is the bed of the badges, the rooms and the bunks. Seen from the foot, a bed keeps its
// parts: the headboard with its posts down to the floor (they are its legs), the pillows (lugares'
// capsule) floating 3 above the mattress, and the mattress's top with the duvet's fold across it.
const BED = lugares.icons.bed.d;
function footBed({ x0 = 3.5, x1 = 20.5, pillows = [[6.5, 10.5], [13.5, 17.5]], top = 4.25, r = 2.5 } = {}) {
  const frame = roundline([[x0, 21.25], [x0, top], [x1, top], [x1, 21.25]], [0, r, r, 0]);
  const ps = pillows.map(([a, b]) => capsule(a, 7.25, b - a, 2.75));
  const mattress = [hl(13, x0, x1), hl(16, x0, x1)];
  return { frame, pillows: ps, mattress, d: [frame, ...ps, ...mattress] };
}
const DOUBLE = footBed();
add('double-bed', ['cama matrimonial', 'cama doble', 'dos personas', 'habitación doble', 'double bed', 'queen bed'], DOUBLE.d);
const SINGLE = footBed({ x0: 6.75, x1: 17.25, pillows: [[9.75, 14.25]] });
add('single-bed', ['cama individual', 'una persona', 'habitación sencilla', 'dormitorio', 'single bed', 'twin bed'], SINGLE.d);
// Twin beds: two narrow beds under one wide headboard, as hotels set them: each its pillow and its
// own mattress, the gap between them running down to the floor.
add('twin-beds', ['camas gemelas', 'dos camas', 'habitación twin', 'hotel', 'twin beds', 'twin room'], [
  DOUBLE.frame,
  ...DOUBLE.pillows,
  roundline([[3.5, 13], [10.5, 13], [10.5, 21.25]], [0, 1.25, 0]),
  roundline([[20.5, 13], [13.5, 13], [13.5, 21.25]], [0, 1.25, 0]),
]);

// Bunk bed: two decks stacked on shared posts (the headboard and the foot), each lugares' bed: its
// pillow floating over its mattress; the ladder leans on the foot to reach the top bunk.
add('bunk-bed', ['litera', 'camas literas', 'hostal', 'cuarto de niños', 'bunk bed', 'bunks'], [
  vl(3.25, 2.75, 21.25),
  vl(16.75, 2.75, 21.25),
  capsule(6.25, 3.75, 5, 2.75),
  hl(9.5, 3.25, 16.75),
  capsule(6.25, 12.5, 5, 2.75),
  hl(18.25, 3.25, 16.75),
  line([16.75, 9.5], [20.75, 21.25]),
]);
// Loft bed: one deck high on tall posts with its pillow, the ladder at its foot and a small desk under
// it.
add('loft-bed', ['cama alta', 'cama tipo loft', 'litera con escritorio', 'estudiante', 'loft bed', 'high sleeper'], [
  vl(3.25, 2.75, 21.25),
  vl(16.75, 2.75, 21.25),
  capsule(6.25, 3.75, 5, 2.75),
  hl(9.5, 3.25, 16.75),
  hl(12.5, 3.25, 16.75),
  line([16.75, 9.5], [20.75, 21.25]),
  hl(15.75, 3.25, 12.25),
  vl(10.5, 15.75, 21.25),
]);
// Canopy bed: the bed from the foot between its four tall posts joined by the top rail, the curtains
// tied back at the top corners (a swag dipping over the two pillows read as a frowning face).
{
  const drape = 'M3.5 2.75H8C8 5.5 6.5 7.5 3.5 8.75';
  add('canopy-bed', ['cama con dosel', 'dosel', 'lujo', 'suite', 'canopy bed', 'four-poster bed'], [
    roundline([[3.5, 21.25], [3.5, 2.75], [20.5, 2.75], [20.5, 21.25]], [0, 0.75, 0.75, 0]),
    drape,
    flipPath(drape),
    capsule(6.5, 11.75, 4, 2.5),
    capsule(13.5, 11.75, 4, 2.5),
    hl(17.25, 3.5, 20.5),
  ]);
}
// Wall bed: in profile, the tall cabinet on the wall and the bed hinged down out of it onto its foot;
// the arc of its fold rises back toward the cabinet.
{
  const hinge = [8.75, 15.25];
  const a = arc(...hinge, 11.75, -16, -74);
  add('wall-bed', ['cama abatible', 'cama murphy', 'estudio', 'espacio pequeño', 'wall bed', 'murphy bed'], [
    sq(3.25, 2.75, 5.5, 18.5, 1.5, BR),
    sq(8.75, 15.25, 12, 3.5, 1.25, BR),
    vl(19, 18.75, 21.25),
    a.d,
    head(a.end, a.tangent, 3.4),
  ]);
}
// Nightstand: a small box on short legs, the drawer on top with its handle and the open shelf below.
add('nightstand', ['buró', 'mesa de noche', 'mesita', 'recámara', 'nightstand', 'bedside table'], [
  sq(4.75, 4.25, 14.5, 14.25, 2.5, BR),
  hl(10.25, 4.75, 19.25),
  hl(7.25, 10.5, 13.5),
  vl(7.25, 18.5, 20.75),
  vl(16.75, 18.5, 20.75),
]);
// The set's bed (lugares') with the engine's badges.
add('bed-plus', ['agregar cama', 'cama extra', 'camas', 'huéspedes', 'add bed', 'extra bed'], BED, { badge: badge('plus') });
add('bed-check', ['cama lista', 'habitación lista', 'limpieza', 'ama de llaves', 'bed made', 'room ready'], BED, { badge: badge('check') });

// ── Bedding ───────────────────────────────────────────────────────────────────────────────────
// Mattress: a thick slab seen from a little above, its top and the side band running round it, a row
// of tufting dots on top.
{
  const top = roundpoly([[6.25, 7], [21.25, 7], [17.75, 13], [2.75, 13]], [1.5, 0.3, 0.3, 0.3]);
  add('mattress', ['colchón', 'colchones', 'firmeza', 'descanso', 'mattress', 'mattress store'], [
    top,
    roundline([[2.75, 13], [2.75, 17], [17.75, 17], [21.25, 11], [21.25, 7]], [0, 1.25, 1.25, 0.6, 0]),
    vl(17.75, 13, 17),
    dot(8.25, 10, 0.3),
    dot(12, 10, 0.3),
    dot(15.75, 10, 0.3),
  ]);
}
// Air mattress: a flat slab puffed into lengthwise ribs (their ends bulge), the valve on one corner.
add('air-mattress', ['colchón inflable', 'inflable', 'cama de invitados', 'acampar', 'air mattress', 'air bed'], [
  'M5.25 6.75H18.75A2 2 0 0 1 18.75 10.75A2 2 0 0 1 18.75 14.75A2 2 0 0 1 18.75 18.75H5.25A2 2 0 0 1 5.25 14.75A2 2 0 0 1 5.25 10.75A2 2 0 0 1 5.25 6.75Z',
  hl(10.75, 5.25, 18.75),
  hl(14.75, 5.25, 18.75),
  roundline([[15.25, 6.75], [15.25, 4], [17.75, 4], [17.75, 6.75]], [0, 0.75, 0.75, 0]),
]);
// Pillow: a plump rectangle with pinched corners, its long sides bowed out.
add('pillow', ['almohada', 'almohadas', 'ropa de cama', 'dormir', 'pillow', 'bed pillow'], [
  `M2.75 6C5.5 7.5 7.5 4 12 4S18.5 7.5 21.25 6C19.75 9 19.75 15 21.25 18C18.5 16.5 16.5 20 12 20S5.5 16.5 2.75 18C4.25 15 4.25 9 2.75 6Z`,
]);
// Cushion: a square throw cushion, four pointed corners, its sides bowed in, the button at its center.
add('cushion', ['cojín', 'almohadón', 'decoración', 'sala', 'cushion', 'throw pillow'], [
  `M4.25 4.25Q12 6.25 19.75 4.25Q17.75 12 19.75 19.75Q12 17.75 4.25 19.75Q6.25 12 4.25 4.25Z`,
  dot(12, 12),
]);
// Duvet: a bedspread on the landscape keyline stitched into three by two puffs: its seams cross it and
// each puff bulges its edge out between the seams' ends (two seams crossing at the middle of a square
// read as a window's panes).
{
  const [x0, x1, y0, y1, c, k] = [2.75, 21.25, 5.25, 18.75, 2, 0.7];
  const xs = [x0 + (x1 - x0) / 3, x0 + ((x1 - x0) * 2) / 3];
  const ym = (y0 + y1) / 2;
  // Each side runs corner → seams → corner, every stretch a shallow bulge; the corners round off
  const bulge = (pts, out) => pts.slice(1).map((q, i) => `Q${pt(add2(lerp(pts[i], q, 0.5), mul(out, 2 * k)))} ${pt(q)}`).join('');
  const corner = (to) => `A${c} ${c} 0 0 1 ${pt(to)}`;
  const across = [x0 + c, ...xs, x1 - c];
  const down = [y0 + c, ym, y1 - c];
  const quilt = [
    `M${pt([x0 + c, y0])}`,
    bulge(across.map((x) => [x, y0]), [0, -1]),
    corner([x1, y0 + c]),
    bulge(down.map((y) => [x1, y]), [1, 0]),
    corner([x1 - c, y1]),
    bulge([...across].reverse().map((x) => [x, y1]), [0, 1]),
    corner([x0, y1 - c]),
    bulge([...down].reverse().map((y) => [x0, y]), [-1, 0]),
    corner([x0 + c, y0]),
    'Z',
  ].join('');
  add('duvet', ['edredón', 'cobertor', 'ropa de cama', 'colcha', 'duvet', 'comforter'], [quilt, ...xs.map((x) => vl(x, y0, y1)), hl(ym, x0, x1)]);
}

// ── Tables (from the front) ───────────────────────────────────────────────────────────────────
// Dining table: a long top on two legs with a low stretcher, at sitting height.
const DINING = [capsule(2.5, 7.75, 19, 3), vl(5.75, 10.75, 21), vl(18.25, 10.75, 21), hl(17, 5.75, 18.25)];
add('dining-table', ['mesa de comedor', 'comedor', 'mesa', 'muebles de comedor', 'dining table', 'table'], DINING);
// Coffee table: a wide low top on short legs with a lower shelf, standing on the floor.
add('coffee-table', ['mesa de centro', 'mesa baja', 'sala', 'mesa de café', 'coffee table', 'living room table'], [
  sq(2.75, 10.25, 18.5, 3, 1),
  vl(5, 13.25, 21),
  vl(19, 13.25, 21),
  hl(16, 5, 19),
  hl(21, 2.75, 21.25),
]);
// Side table: a round top seen as an ellipse on one pedestal over a tripod foot.
{
  const c = [12, 6.25];
  add('side-table', ['mesa auxiliar', 'mesita', 'mesa redonda', 'pedestal', 'side table', 'end table'], [
    ell(c, 7, 2.5),
    vl(12, c[1] + 2.5, 21),
    line([12, 17], [7.25, 21]),
    line([12, 17], [16.75, 21]),
  ]);
}
// Folding table: a thin top on legs that cross as an X.
add('folding-table', ['mesa plegable', 'eventos', 'plegable', 'renta de mesas', 'folding table', 'event table'], [
  capsule(2.5, 7.25, 19, 2.75),
  line([6, 10], [17.25, 21]),
  line([18, 10], [6.75, 21]),
]);
// Dressing table: the table with its drawer and the oval mirror standing on its top, a glint on it.
add('dressing-table', ['tocador', 'peinador', 'vanidad', 'recámara', 'dressing table', 'vanity'], [
  ell([12, 6.5], 5, 4.25),
  line([10.9, 7.6], [12.6, 5.9]),
  vl(12, 10.75, 12.75),
  sq(3.25, 12.75, 17.5, 5.75, 1.5, BR),
  hl(15.625, 10.5, 13.5),
  vl(5.5, 18.5, 21),
  vl(18.5, 18.5, 21),
]);

// ── Storage (cabinets keep the square bottom-right corner of containers) ──────────────────────
// TV stand: a low wide cabinet with two doors and their knobs, the flat screen standing on it.
add('tv-stand', ['mueble de tv', 'centro de entretenimiento', 'credenza', 'sala', 'tv stand', 'media console'], [
  sq(4.75, 3.25, 14.5, 8.25, 2, BR),
  vl(12, 11.5, 14.25),
  sq(3.75, 14.25, 16.5, 6.75, 1.75, BR),
  vl(12, 14.25, 21),
  dot(9, 17.625),
  dot(15, 17.625),
]);
// Wardrobe: a tall cabinet under its cornice, two doors meeting at the middle with their handles,
// short feet.
add('wardrobe', ['ropero', 'clóset', 'armario', 'guardarropa', 'wardrobe', 'closet'], [
  hl(3.25, 3.75, 20.25),
  roundline([[5.25, 3.25], [5.25, 19.25], [18.75, 19.25], [18.75, 3.25]], [0, 1.5, 0, 0]),
  vl(12, 3.25, 19.25),
  dot(9, 11.25),
  dot(15, 11.25),
  vl(7, 19.25, 21.25),
  vl(17, 19.25, 21.25),
]);
// Dresser: a chest of three drawers, each with its handle; its sides run on as short legs.
add('dresser', ['cómoda', 'cajonera', 'chifonier', 'recámara', 'dresser', 'chest of drawers'], [
  roundline([[4.25, 21.5], [4.25, 2.5], [19.75, 2.5], [19.75, 21.5]], [0, 2, 2, 0]),
  hl(8.25, 4.25, 19.75),
  hl(14, 4.25, 19.75),
  hl(19.75, 4.25, 19.75),
  hl(5.375, 10.75, 13.25),
  hl(11.125, 10.75, 13.25),
  hl(16.875, 10.75, 13.25),
]);
// Sideboard: a long low cabinet on tapered legs, two doors and their knobs.
add('sideboard', ['aparador', 'trinchador', 'bufetera', 'buffet', 'sideboard', 'credenza'], [
  sq(2.75, 6.75, 18.5, 10, 2, BR),
  vl(12, 6.75, 16.75),
  dot(9, 11.75),
  dot(15, 11.75),
  line([5.25, 16.75], [4.25, 20.75]),
  line([18.75, 16.75], [19.75, 20.75]),
]);
// Display cabinet: the wardrobe's body under its cornice with one glass front, its two shelves seen
// inside and a plate leaning on the top one.
add('display-cabinet', ['vitrina', 'trinchador de vidrio', 'vajilla', 'exhibidor', 'display cabinet', 'china cabinet'], [
  hl(3.25, 3.75, 20.25),
  roundline([[5.25, 3.25], [5.25, 19.25], [18.75, 19.25], [18.75, 3.25]], [0, 1.5, 0, 0]),
  hl(10, 5.25, 18.75),
  hl(15, 5.25, 18.75),
  circ(12, 8.25, 1.75),
  vl(7, 19.25, 21.25),
  vl(17, 19.25, 21.25),
]);
// Wall shelf: a plank on two triangular brackets, a book and a small pot standing on it.
add('shelf', ['repisa', 'entrepaño', 'estante de pared', 'decoración', 'shelf', 'floating shelf'], [
  capsule(2.75, 12.75, 18.5, 2.5),
  roundpoly([[5.25, 15.25], [9.25, 15.25], [5.25, 19.25]], [0.4, 0.75, 0.75]),
  roundpoly([[14.75, 15.25], [18.75, 15.25], [18.75, 19.25]], [0.75, 0.4, 0.75]),
  sq(5, 5.25, 3.5, 7.5, 1),
  roundpoly([[13.25, 8.5], [19.25, 8.5], [18.25, 12.75], [14.25, 12.75]], [0.6, 0.6, 0.6, 0.6]),
  `M16.25 8.5C16.25 6 17.25 4.75 19.5 4.25C19.5 6.5 18.75 7.75 16.25 8.5`,
]);
// Shelving unit: a tall open frame of two by three cubes on short feet.
add('shelving-unit', ['estantería', 'librero', 'cubos', 'organizador', 'shelving unit', 'bookcase'], [
  sq(5.25, 2.75, 13.5, 16.25, 1.5, BR),
  vl(12, 2.75, 19),
  hl(8.17, 5.25, 18.75),
  hl(13.58, 5.25, 18.75),
  vl(7.25, 19, 21.25),
  vl(16.75, 19, 21.25),
]);
// Shoe rack: two shelves between the side frames, a shoe in profile on each.
{
  // Each shoe stands on its shelf (the shelf is its sole): the heel's collar, the instep and the toe
  const shoe = (x, y) => roundline([[x, y], [x, y - 4.25], [x + 3, y - 4.25], [x + 4.25, y - 2.5], [x + 7.75, y - 1.75], [x + 9.5, y]], [0, 0.75, 0.75, 1.25, 1.75, 0]);
  add('shoe-rack', ['zapatera', 'organizador de zapatos', 'recibidor', 'calzado', 'shoe rack', 'shoe storage'], [
    vl(3.25, 3.25, 21.25),
    vl(20.75, 3.25, 21.25),
    hl(11.25, 3.25, 20.75),
    hl(19.25, 3.25, 20.75),
    shoe(6.25, 11.25),
    shoe(8.25, 19.25),
  ]);
}
// Coat rack: a pole on a tripod foot, curved hooks branching at the top, a hat on one of them.
add('coat-rack', ['perchero', 'perchero de pie', 'recibidor', 'abrigos', 'coat rack', 'hat stand'], [
  vl(12, 3.25, 21),
  line([12, 17.5], [7.75, 21]),
  line([12, 17.5], [16.25, 21]),
  `M12 7.25C9.75 7.25 7.5 6.5 6.75 4.25`,
  `M12 7.25C14.25 7.25 16.5 6.5 17.25 4.25`,
  `M16.25 13.25A2.25 2.25 0 0 1 20.75 13.25`,
  hl(13.25, 15.25, 21.75),
]);
// Coat hooks: a rail on the wall with three hooks, a bag hanging from one.
{
  add('coat-hooks', ['ganchos', 'perchero de pared', 'recibidor', 'colgador', 'coat hooks', 'wall hooks'], [
    capsule(2.75, 4.25, 18.5, 2.5),
    `M4.5 6.75V9.5A1.5 1.5 0 0 0 7.5 9.5`,
    `M10.5 6.75V9.5A1.5 1.5 0 0 0 13.5 9.5`,
    `M16.5 6.75V9.5A1.5 1.5 0 0 0 19.5 9.5`,
    roundline([[17.25, 13.75], [19.5, 9.5], [21.75, 13.75]], [0, 0.75, 0]),
    roundpoly([[15.75, 13.75], [21.25, 13.75], [21.75, 20.75], [15.25, 20.75]], [1, 1, 1.25, 1.25]),
  ]);
}
// Umbrella stand: a round bin with its rim, two umbrella handles curling out of the top.
add('umbrella-stand', ['paragüero', 'portaparaguas', 'recibidor', 'paraguas', 'umbrella stand', 'umbrella holder'], [
  roundline([[6.25, 11.25], [6.75, 21], [17.25, 21], [17.75, 11.25]], [0, 1.5, 1.5, 0]),
  hl(11.25, 5.25, 18.75),
  `M10 11.25V5.75A2.25 2.25 0 0 0 5.5 5.75V6.5`,
  `M14.25 11.25V4.75A2.25 2.25 0 0 1 18.75 4.75V5.5`,
]);
// Storage chest: a trunk with its domed lid, the latch on the front and a handle on each side.
add('storage-chest', ['baúl', 'arcón', 'cofre', 'juguetero', 'storage chest', 'trunk'], [
  `M4.5 11.25V9.25C4.5 7 7.5 5.25 12 5.25S19.5 7 19.5 9.25V11.25`,
  roundpoly([[4.5, 11.25], [19.5, 11.25], [19.5, 20.75], [4.5, 20.75]], [0, 0, 0, 1.75]),
  roundline([[10.75, 11.25], [10.75, 14.25], [13.25, 14.25], [13.25, 11.25]], [0, 0.75, 0.75, 0]),
  roundline([[4.5, 13.75], [2.25, 13.75], [2.25, 16.75], [4.5, 16.75]], [0, 0.75, 0.75, 0]),
  roundline([[19.5, 13.75], [21.75, 13.75], [21.75, 16.75], [19.5, 16.75]], [0, 0.75, 0.75, 0]),
]);

// ── Lamps: one lamp ───────────────────────────────────────────────────────────────────────────
// The table lamp's shade (a trapezoid, narrow at the top) is the shade of every standing lamp; the
// dome is the shade of the hanging ones. Rays of light are short strokes 3 clear of the lamp.
const shade = (cx, top, s = 1) =>
  roundpoly([[cx - 4 * s, top], [cx + 4 * s, top], [cx + 6.75 * s, top + 7.75 * s], [cx - 6.75 * s, top + 7.75 * s]], [1.25 * s, 1.25 * s, 1 * s, 1 * s]);
/** A dome shade: a half disc of radius r over its rim at rimY. */
const dome = (cx, rimY, r) => {
  const R = halfChord([cx - r, rimY], [cx + r, rimY]);
  return `M${pt([cx - r, rimY])}A${R} ${R} 0 0 1 ${pt([cx + r, rimY])}Z`;
};
/** A teardrop flame: its tip at (cx, tip), its round bottom resting at `bottom`. */
function flameDropAt(cx, tip, bottom) {
  const r = Math.min(1.85, (bottom - tip) / 3);
  const cy = bottom - r;
  return `M${pt([cx, tip])}C${pt([cx + 0.6, tip + 1.6])} ${pt([cx + r, cy - 1.4])} ${pt([cx + r, cy])}A${r} ${r} 0 0 1 ${pt([cx - r, cy])}C${pt([cx - r, cy - 1.4])} ${pt([cx - 0.6, tip + 1.6])} ${pt([cx, tip])}Z`;
}
// The table lamp: the shade on its stem over the round base; lit, short rays fan out from under the
// rim, clear of the stem and the base.
const LAMP = [shade(12, 3.25), vl(12, 11, 17.75), capsule(8.5, 17.75, 7, 3)];
add('lamp', ['lámpara', 'lámpara de mesa', 'iluminación', 'buró', 'lamp', 'table lamp'], LAMP);
add('lamp-on', ['lámpara encendida', 'luz encendida', 'encender', 'iluminación', 'lamp on', 'light on'], [
  ...LAMP,
  line([4.25, 13.75], [2.75, 15.5]),
  line([19.75, 13.75], [21.25, 15.5]),
  line([8.25, 14], [7, 15.75]),
  line([15.75, 14], [17, 15.75]),
]);
// Floor lamp: the same shade, smaller, on a long pole over its flat base. Arc lamp: a weighted base,
// the pole arching over to the dome hanging from it. Pendant: the dome on its cord from the ceiling,
// the bulb's curve under its rim. Ceiling light: a shallow dome flush with the ceiling, its rays below.
add('lamp-floor', ['lámpara de pie', 'lámpara de piso', 'sala', 'iluminación', 'floor lamp', 'standing lamp'], [
  shade(12, 2.75, 0.75),
  vl(12, 2.75 + 7.75 * 0.75, 18.75),
  capsule(8, 18.75, 8, 2.75),
]);
add('lamp-arc', ['lámpara de arco', 'lámpara de pie', 'lectura', 'sala', 'arc lamp', 'reading lamp'], [
  dome(6.25, 21, 3.5),
  `M6.25 17.5V9.75A5.75 5.75 0 0 1 17.75 9.75V10.5`,
  dome(17.75, 14, 3.5),
]);
add('lamp-pendant', ['lámpara colgante', 'colgante', 'comedor', 'cocina', 'pendant lamp', 'pendant light'], [
  hl(2.75, 6.25, 17.75),
  vl(12, 2.75, 8.75),
  dome(12, 15, 6.25),
  `M9.75 15A2.25 2.25 0 0 0 14.25 15`,
]);
add('lamp-ceiling', ['plafón', 'lámpara de techo', 'luz de techo', 'iluminación', 'ceiling light', 'flush mount'], [
  hl(5.25, 2.75, 21.25),
  `M4.75 5.25A8.57 8.57 0 0 0 19.25 5.25`,
  vl(12, 12.75, 16.25),
  line([7.25, 12], [5.5, 14.75]),
  line([16.75, 12], [18.5, 14.75]),
]);
// Wall sconce: the plate on the wall, the arm reaching out and up, and the lamp's shade turned over,
// open to the ceiling.
add('lamp-wall', ['aplique', 'lámpara de pared', 'arbotante', 'porche', 'wall light', 'sconce'], [
  sq(3.25, 8.75, 3, 9.5, 1),
  roundline([[6.25, 15.75], [13.75, 15.75], [13.75, 10.7]], [0, 1.25, 0]),
  flipPath(shade(13.75, 4.5, 0.8), 'y', 7.6),
]);
// Chandelier: a hanging stem branching into curved arms, a flame standing on each arm, the finial
// under them. Downlight: the can recessed in the ceiling, its cone of light below.
add('chandelier', ['candelabro', 'araña', 'candil', 'comedor', 'chandelier', 'pendant'], [
  vl(12, 2.75, 15),
  `M4.75 11C4.75 13.75 7.5 15 12 15S19.25 13.75 19.25 11`,
  flameDropAt(4.75, 4.75, 11),
  flameDropAt(19.25, 4.75, 11),
  dot(12, 15.75),
]);
add('downlight', ['foco empotrado', 'spot', 'luz empotrada', 'plano de iluminación', 'downlight', 'recessed light'], [
  hl(4.75, 2.75, 21.25),
  roundline([[8.75, 4.75], [9.25, 7.75], [14.75, 7.75], [15.25, 4.75]], [0, 0.75, 0.75, 0]),
  line([9, 10.75], [5.75, 18.75]),
  vl(12, 10.75, 19.5),
  line([15, 10.75], [18.25, 18.75]),
]);
// Track light: the rail under the ceiling and three spots on it, each turned its own way.
{
  // Each spot hangs from the rail by its pivot and turns on it
  const spot = (x, deg) => {
    const p = (q) => rot(q, [x, 6.25], deg);
    return roundpoly([p([x - 1.4, 6.25]), p([x + 1.4, 6.25]), p([x + 2, 12.5]), p([x - 2, 12.5])], [0.5, 0.5, 0.9, 0.9]);
  };
  add('track-light', ['riel de luz', 'spots', 'iluminación de riel', 'focos', 'track light', 'track lighting'], [
    capsule(3.25, 3.75, 17.5, 2.5),
    spot(6.5, 20),
    spot(12, 0),
    spot(17.5, -20),
  ]);
}
// Candle: a pillar candle, its wick and the teardrop flame.
add('candle', ['vela', 'velas', 'ambiente', 'aromas', 'candle', 'candlelight'], [
  sq(7.75, 11.5, 8.5, 9.5, 1.5),
  vl(12, 8.75, 11.5),
  flameDropAt(12, 2.5, 8.75),
]);
// String lights: a wire sagging in two swags, a pear-shaped bulb hanging from the bottom of each.
add('string-lights', ['luces colgantes', 'serie de luces', 'guirnalda', 'patio', 'string lights', 'fairy lights'], [
  `M2.75 4.25Q7.375 11.75 12 4.25Q16.625 11.75 21.25 4.25`,
  flameDropAt(7.375, 8, 14.25),
  flameDropAt(16.625, 8, 14.25),
]);
// Garden lamp: a small lantern with its peaked cap on a slim post set in the ground.
add('garden-lamp', ['farol', 'lámpara de jardín', 'luz exterior', 'sendero', 'garden lamp', 'lamp post'], [
  roundpoly([[12, 2.75], [16.5, 6.75], [7.5, 6.75]], [0.75, 0.75, 0.75]),
  sq(8.5, 6.75, 7, 7.5, 1.25, BR),
  dot(12, 10.5),
  vl(12, 14.25, 21),
  hl(21, 7.5, 16.5),
]);

// ── Decor ─────────────────────────────────────────────────────────────────────────────────────
// Mirror: a tall oval of glass on the portrait keyline, two glints across it (hung from a nail by a
// strap it read as a stopwatch: the glass is the whole icon).
add('mirror', ['espejo', 'espejo de pared', 'decoración', 'baño', 'mirror', 'wall mirror'], [
  ell([12, 12], 7.25, 9.25),
  line([8.25, 13.25], [13.25, 8.25]),
  line([10.25, 16.25], [14.75, 11.75]),
]);
// Floor mirror: a tall arch-topped mirror leaning on the wall, standing on the floor, one glint.
{
  const o = [4.5, 21.25];
  const T = (p) => rot(p, [o[0] + 7.5, o[1]], 9);
  const [w, h] = [7.5, 17.5];
  const R = w / 2;
  const P = [T([o[0], o[1]]), T([o[0], o[1] - h + R]), T([o[0] + w, o[1] - h + R]), T([o[0] + w, o[1]])];
  const C = halfChord(P[1], P[2]);
  add('floor-mirror', ['espejo de piso', 'espejo de cuerpo completo', 'vestidor', 'recámara', 'floor mirror', 'full-length mirror'], [
    roundline([[20.75, 2.75], [20.75, 21.25], [2.75, 21.25]], 0),
    `M${pt(P[0])}L${pt(P[1])}A${C} ${C} 0 0 1 ${pt(P[2])}L${pt(P[3])}Z`,
    line(T([o[0] + 3, o[1] - 7.25]), T([o[0] + 4.5, o[1] - 10])),
  ]);
}
// Wall art: a framed picture with its mat, hung from a nail by a wire.
add('wall-art', ['cuadro', 'arte', 'decoración', 'pared', 'wall art', 'framed art'], [
  sq(3.25, 9, 17.5, 12, 1.5, BR),
  sq(6.25, 12, 11.5, 6, 0.75, BR),
  line([7.25, 9], [12, 4.25], [16.75, 9]),
  dot(12, 3.25),
]);
// Picture frame: a photo frame on a table, turned three-quarters, its mat inside and its easel leg
// behind it.
add('picture-frame', ['portarretratos', 'marco de fotos', 'foto', 'regalo', 'picture frame', 'photo frame'], [
  roundpoly([[4.25, 3.25], [15.25, 5.25], [15.25, 18.75], [4.25, 20.75]], [1.25, 1, 0, 1.25]),
  roundpoly([[7.25, 7], [12.25, 7.9], [12.25, 16.1], [7.25, 17]], [0.5, 0.5, 0.5, 0.5]),
  line([15.25, 12.5], [20.25, 20.75]),
]);
// Rug: a rectangle with its inner border, the fringe on its two short ends.
add('rug', ['tapete', 'alfombra', 'decoración', 'sala', 'rug', 'carpet'], [
  sq(6.25, 4.25, 11.5, 15.5, 1),
  sq(9.25, 7.25, 5.5, 9.5, 0.5),
  ...[7.5, 10.5, 13.5, 16.5].map((x) => vl(x, 1.75, 4.25)),
  ...[7.5, 10.5, 13.5, 16.5].map((x) => vl(x, 19.75, 22.25)),
]);
// Doormat: a low mat with diagonal bristle ribs, on the floor at the foot of the door frame (the
// mat lies in front and the engine clears the frame behind it).
{
  const mat = sq(3.25, 16.75, 17.5, 4.5, 1.75);
  const ribs = [7.25, 10.75, 14.25, 17.75].map((x) => line([x - 1, 21.25], [x + 1, 16.75]));
  add('doormat', ['tapete de entrada', 'felpudo', 'bienvenida', 'entrada', 'doormat', 'welcome mat'], [roundline([[6, 21.25], [6, 2.75], [18, 2.75], [18, 21.25]], [0, 2.5, 2.5, 0])], {
    badge: { d: [mat, ...ribs], knock: mat, fill: { solid: [mat], cut: ribs } },
  });
}
// Curtains: the rod across the top, two drapes tied back to the sides, the window open between.
{
  const drape = `M3.25 4.25H9.75C9.75 9 7.75 11.25 5.25 12.75C7.75 14.25 9 17.25 9 20.75H3.25Z`;
  add('curtains', ['cortinas', 'cortinas abiertas', 'ventana', 'decoración', 'curtains', 'drapes'], [
    hl(4.25, 2.75, 21.25),
    drape,
    flipPath(drape),
    hl(12.75, 3.25, 5.25),
    hl(12.75, 18.75, 20.75),
  ]);
}
// Curtains closed: the rod and the two drapes hanging straight to meet at the middle, their folds.
add('curtains-closed', ['cortinas cerradas', 'blackout', 'privacidad', 'oscurecer', 'curtains closed', 'blackout curtains'], [
  hl(4.25, 2.75, 21.25),
  `M3.25 4.25H20.75V19.75Q18.5 21.25 16.25 20.25Q14.25 19.25 12 20.25Q9.75 21.25 7.75 20.25Q5.5 19.25 3.25 20.25Z`,
  vl(12, 4.25, 20.25),
  vl(7.5, 7.25, 17),
  vl(16.5, 7.25, 17),
]);
// Room divider: three tall panels hinged in a zigzag on small feet, each panel arched at its top (with
// straight tops the zigzag was the folded map).
{
  const xs = [3.25, 9, 15, 20.75];
  const tops = [4.75, 3.25, 4.75, 3.25];
  const bots = [17.25, 18.75, 17.25, 18.75];
  let screen = `M${pt([xs[0], bots[0]])}L${pt([xs[0], tops[0]])}`;
  for (let i = 0; i < 3; i++) screen += `Q${pt([(xs[i] + xs[i + 1]) / 2, (tops[i] + tops[i + 1]) / 2 - 2.75])} ${pt([xs[i + 1], tops[i + 1]])}`;
  screen += `L${pt([xs[3], bots[3]])}${[2, 1, 0].map((i) => `L${pt([xs[i], bots[i]])}`).join('')}Z`;
  add('room-divider', ['biombo', 'divisor de ambientes', 'mampara', 'privacidad', 'room divider', 'folding screen'], [
    screen,
    vl(9, 3.25, 18.75),
    vl(15, 4.75, 17.25),
    vl(9, 18.75, 21),
    vl(20.75, 18.75, 21),
    vl(3.25, 17.25, 19.5),
  ]);
}
// Wallpaper roll: the roll seen at its end (its turns around the core) with the sheet unrolled flat
// out of it, two pattern stripes across the sheet.
add('wallpaper-roll', ['papel tapiz', 'tapiz', 'revestimiento', 'remodelación', 'wallpaper', 'wallpaper roll'], [
  `M7.75 15.5A4.75 4.75 0 1 1 12.5 10.75V20.75H3.75A1 1 0 0 1 2.75 19.75`,
  circ(7.75, 10.75, 1.75),
  roundline([[12.5, 3.25], [21.25, 3.25], [21.25, 20.75], [12.5, 20.75]], [0, 1.25, 0, 0]),
  line([12.5, 9.25], [21.25, 6.25]),
  line([12.5, 15.75], [21.25, 12.75]),
]);

// ── Rooms: a room by the furniture that names it ──────────────────────────────────────────────
// Living room: the sofa (two seats, wide enough to show them) with a floor lamp standing at its right
// end, its shade clear above the sofa's back.
const LIVING = couch({ x0: 2.75, x1: 16.25, armW: 3, armTop: 12, seat: 15, base: 18.75, back: 8.75, seats: 2, feet: 21 });
add('living-room', ['sala', 'estancia', 'living', 'cuarto de estar', 'living room', 'lounge'], [...LIVING.d, shade(19.5, 3.25, 0.38), vl(19.5, 3.25 + 7.75 * 0.38, 20.75), hl(20.75, 17.75, 21.25)]);
// A bed in profile with lugares' construction (headboard, mattress rounding down into the foot, frame
// and the pillow 3 above the mattress), at any size.
function sideBed({ x0, x1, head, top, frame, floor = 20.25, pillow }) {
  return [
    vl(x0, head, floor),
    roundline([[x0, top], [x1 - 2, top], [x1, top + 2], [x1, floor]], [0, 1.75, 1.75, 0]),
    hl(frame, x0, x1),
    ...(pillow ? [capsule(pillow[0], top - 3 - pillow[2], pillow[1], pillow[2])] : []),
  ];
}
// Bedroom: the bed in profile with the nightstand at its head and the lamp on it, its shade 3 clear of
// the headboard.
const BEDROOM = { x0: 10, x1: 21.25, head: 7.75, top: 13.25, frame: 17, floor: 20.75, pillow: [13, 4.5, 2.5] };
add('bedroom', ['recámara', 'dormitorio', 'habitación', 'cuarto', 'bedroom', 'room'], [
  ...sideBed(BEDROOM),
  sq(2.75, 14.5, 4, 6.25, 1, BR),
  shade(4.75, 8.25, 0.35),
  vl(4.75, 8.25 + 7.75 * 0.35, 14.5),
]);
// Bathroom: the toilet in profile (its tank over the bowl) beside the washbasin on its pedestal with
// the faucet over it (an oval mirror over the basin made the pair two little figures).
add('bathroom', ['baño', 'medio baño', 'sanitario', 'aseo', 'bathroom', 'restroom'], [
  roundline([[2.75, 11.75], [2.75, 6.25], [6.25, 6.25], [6.25, 11.75]], [0, 1, 1, 0]),
  'M2.75 11.75H10.5C10.5 14 9.5 15.25 7.75 15.5L8.25 20.75H4.25L4.75 15.25C3.5 14.75 2.75 13.5 2.75 11.75Z',
  'M13.5 11.75H21.25C21.25 14.25 19.5 15.75 17.375 15.75S13.5 14.25 13.5 11.75Z',
  roundline([[15.75, 15.25], [15.9, 20.75], [18.85, 20.75], [19, 15.25]], [0, 0.5, 0.5, 0]),
  'M17.375 11.75V8.75A1.375 1.375 0 0 1 20.125 8.75',
]);
// Dining room: the table from the front between two chairs in profile facing it, their backs rising
// above its top (with a pendant lamp over it the set read as a temple at 18 px).
{
  const chairL = [vl(3.25, 6.75, 21), hl(14.25, 3.25, 6.75), vl(6.75, 14.25, 21)];
  add('dining-room', ['comedor', 'sala comedor', 'mesa', 'cenar', 'dining room', 'dining area'], [
    capsule(6.25, 8.5, 11.5, 2.5),
    vl(10, 11, 21),
    vl(14, 11, 21),
    ...chairL,
    ...chairL.map((d) => flipPath(d)),
  ]);
}
// Guest room: the bed in profile with a suitcase standing at its foot.
add('guest-room', ['cuarto de huéspedes', 'recámara de visitas', 'invitados', 'hospedaje', 'guest room', 'spare room'], [
  ...sideBed({ x0: 2.75, x1: 13.75, head: 7.25, top: 12, frame: 16, floor: 20.75, pillow: [5.75, 4.5, 2.5] }),
  sq(16.75, 12.75, 4.5, 8, 1.25, BR),
  roundline([[17.75, 12.75], [17.75, 10.25], [20.25, 10.25], [20.25, 12.75]], [0, 0.6, 0.6, 0]),
]);
// Entryway: the front door with the coat rack beside it and the mat at its foot.
add('entryway', ['recibidor', 'entrada', 'vestíbulo', 'hall', 'entryway', 'foyer'], [
  roundline([[3.25, 18.75], [3.25, 2.75], [12.75, 2.75], [12.75, 18.75]], [0, 2, 2, 0]),
  dot(10, 11),
  capsule(2.25, 18.75, 11, 2.5),
  vl(18.5, 4.75, 21),
  `M18.5 7.75C17.25 7.75 16.25 7 16 5.5`,
  `M18.5 7.75C19.75 7.75 20.75 7 21 5.5`,
  line([18.5, 18], [16.5, 21]),
  line([18.5, 18], [20.5, 21]),
]);
// Home theater: the wide screen on the wall, the back of a sofa in front of it, its two cushions
// rising between the arms.
add('home-theater', ['cine en casa', 'sala de tv', 'sala multimedia', 'entretenimiento', 'home theater', 'media room'], [
  sq(2.75, 2.75, 18.5, 8.5, 2, BR),
  `M4.25 21.25V19A1.5 1.5 0 0 1 5.75 17.5H7.25V16.75A2.375 2.375 0 0 1 12 16.75A2.375 2.375 0 0 1 16.75 16.75V17.5H18.25A1.5 1.5 0 0 1 19.75 19V21.25Z`,
]);
// Walk-in closet: a doorway you walk into, the clothes rail across it and a hanger on the rail (the
// rail between two walls drawn in perspective read as scaffolding, two hangers there as bells).
add('walk-in-closet', ['vestidor', 'clóset vestidor', 'guardarropa', 'ropa', 'walk-in closet', 'dressing room'], [
  roundline([[3.5, 21.25], [3.5, 2.75], [20.5, 2.75], [20.5, 21.25]], [0, 2.5, 2.5, 0]),
  hl(7.25, 3.5, 20.5),
  vl(12, 7.25, 9.5),
  roundpoly([[12, 9.5], [16.5, 13.75], [7.5, 13.75]], [0.5, 0.75, 0.75]),
]);
// Garage: the house's gable over a wide door of horizontal slats.
{
  const roofAt = (x) => 3.5 + Math.abs(x - 12) * (7.75 / 9.25);
  const roof = roundline([[2.75, roofAt(2.75)], [12, 3.5], [21.25, roofAt(21.25)]], [0, 1.25, 0]);
  const walls = roundline([[5.25, roofAt(5.25)], [5.25, 20.75], [18.75, 20.75], [18.75, roofAt(18.75)]], [0, 2.5, 0, 0]);
  const door = roundline([[8.25, 20.75], [8.25, 12], [15.75, 12], [15.75, 20.75]], [0, 1, 1, 0]);
  add('garage', ['cochera', 'garaje', 'estacionamiento', 'portón', 'garage', 'garage door'], [roof, walls, door, hl(15, 8.25, 15.75), hl(18, 8.25, 15.75)]);
  // Open: the door rolled up into one panel under the lintel; filled, the opening below it is paper
  add('garage-open', ['cochera abierta', 'portón abierto', 'abrir cochera', 'acceso', 'garage open', 'open garage door'], [roof, walls, door, hl(15, 8.25, 15.75)]);
  const opened = `M${pt([5.25, roofAt(5.25)])}V18.25A2.5 2.5 0 0 0 7.75 20.75H8.25V15H15.75V20.75H18.75V${f(roofAt(18.75))}Z`;
  icons['garage-open'].fill = {
    solid: [shut(roof), opened],
    cut: [roundline([[8.25, 15], [8.25, 12], [15.75, 12], [15.75, 15]], [0, 1, 1, 0])],
    wire: [hl(20.75, 8.25, 15.75)],
  };
  const roofAt2 = (x) => 5.25 + Math.abs(x - 12) * (6.25 / 9.75);
  const roof2 = roundline([[2.25, roofAt2(2.25)], [12, 5.25], [21.75, roofAt2(21.75)]], [0, 1.25, 0]);
  const walls2 = roundline([[3.75, roofAt2(3.75)], [3.75, 20.75], [20.25, 20.75], [20.25, roofAt2(20.25)]], [0, 2.25, 0, 0]);
  const door2 = (x0) => roundline([[x0, 20.75], [x0, 13], [x0 + 4, 13], [x0 + 4, 20.75]], [0, 0.75, 0.75, 0]);
  add('garage-double', ['cochera doble', 'garaje para dos autos', 'dos cajones', 'estacionamiento', 'two-car garage', 'double garage'], [
    roof2,
    walls2,
    door2(6.5),
    door2(13.5),
    hl(16, 6.5, 10.5),
    hl(16, 13.5, 17.5),
  ]);
}
// Add a room: bienes-raices' `room` (the plan with the door's swing) with the engine's plus.
add('room-plus', ['agregar habitación', 'nuevo cuarto', 'ambientes', 'casa inteligente', 'add room', 'new room'], bienesRaices.icons.room.d, { badge: badge('plus') });

// ── Windows (the frame stands on its sill; a frame on its own keeps the containers' square corner) ─
const SILL = hl(18.25, 3, 21);
const FRAME = roundline([[4.75, 18.25], [4.75, 3.25], [19.25, 3.25], [19.25, 18.25]], [0, 2.5, 2.5, 0]);
add('windowpane', ['ventana', 'luz natural', 'cristal', 'instalación de ventanas', 'window', 'windowpane'], [FRAME, SILL, vl(12, 3.25, 18.25), hl(10.75, 4.75, 19.25)]);
// Casement: one sash swung outward on its hinges, its free edge nearer and taller.
add('casement-window', ['ventana abatible', 'ventana abierta', 'ventilación', 'abatible', 'casement window', 'open window'], [
  roundline([[3.25, 18.25], [3.25, 3.25], [14.75, 3.25], [14.75, 18.25]], [0, 2.25, 2.25, 0]),
  hl(18.25, 1.75, 16.25),
  vl(9, 3.25, 18.25),
  roundpoly([[14.75, 3.25], [20.75, 1.75], [20.75, 19.75], [14.75, 18.25]], [0.75, 0.75, 0.75, 0.75]),
]);
// Sliding window: a wide frame with two sashes, one slid partly over the other.
add('sliding-window', ['ventana corrediza', 'corrediza', 'tipos de ventana', 'deslizar', 'sliding window', 'slider window'], [
  sq(2.75, 4.25, 18.5, 14, 2.5, BR),
  hl(21.25, 2.25, 21.75),
  vl(10.5, 4.75, 18.25),
  vl(13.5, 4.75, 18.25),
]);
// Skylight: the house's gable roof with a framed glass panel raised on one slope, its mullion across
// it, the light falling through in two slanted rays (a thin panel flush with the slope read as a pen).
{
  const apex = [9.5, 4.5];
  const B = [21.75, 16.75];
  const u = unit(sub(B, apex));
  const n = [-u[1], u[0]];
  const at = (t, o = 0) => add2(add2(apex, mul(u, t)), mul(n, o));
  const [t0, t1] = [3.5, 11.5];
  // The light falls 3 clear of the slope, straight down and a little inward
  const ray = (t) => line(at(t, 3), add2(at(t, 3), [-1.75, 5.5]));
  add('skylight', ['tragaluz', 'domo', 'luz natural', 'techo', 'skylight', 'roof window'], [
    roundline([[2.25, 11.75], apex, B], [0, 1.25, 0]),
    roundpoly([at(t0), at(t0, -3.25), at(t1, -3.25), at(t1)], [0.6, 0.75, 0.75, 0.6]),
    line(at((t0 + t1) / 2), at((t0 + t1) / 2, -3.25)),
    ray(t0 + 2),
    ray(t1 - 2),
  ]);
}
// Shutters: the window between its two shutters swung open toward us, two louvers across each.
add('shutters', ['contraventanas', 'persianas exteriores', 'postigos', 'tormenta', 'shutters', 'window shutters'], [
  sq(8.5, 5, 7, 14, 1.25, BR),
  roundline([[8.5, 7], [3.75, 5.25], [3.75, 18.75], [8.5, 17]], [0, 0.6, 0.6, 0]),
  roundline([[15.5, 7], [20.25, 5.25], [20.25, 18.75], [15.5, 17]], [0, 0.6, 0.6, 0]),
  ...[10.25, 13.75].flatMap((y) => [line([3.75, y - 0.6], [8.5, y]), line([20.25, y - 0.6], [15.5, y])]),
]);
// Broken window: the windowpane with a jagged crack running across two panes.
add('broken-window', ['ventana rota', 'vidrio roto', 'daños', 'robo', 'broken window', 'cracked glass'], [
  FRAME,
  SILL,
  vl(12, 3.25, 18.25),
  hl(10.75, 4.75, 19.25),
  line([4.75, 7.5], [7.75, 9], [7, 12.75], [10, 13.75], [9.75, 18.25]),
]);

// ── Doors (lugares' door: the leaf with its rounded top on the floor, the knob) ───────────────
add('door-double', ['puerta doble', 'puertas francesas', 'entrada principal', 'acceso', 'double door', 'french doors'], [
  roundline([[3.5, 21.25], [3.5, 2.75], [20.5, 2.75], [20.5, 21.25]], [0, 2.5, 2.5, 0]),
  hl(21.25, 1.75, 22.25),
  vl(12, 2.75, 21.25),
  dot(9, 12.5),
  dot(15, 12.5),
]);
// Sliding glass door: two glass panels, the moving one slid partly in front of the other, its pull
// bar; the engine clears the panel behind.
{
  const front = sq(9.75, 2.75, 11.5, 18.5, 1.5, BR);
  add('door-sliding', ['puerta corrediza', 'cancel de vidrio', 'puerta de patio', 'terraza', 'sliding door', 'patio door'], [sq(2.75, 2.75, 11.5, 18.5, 1.5, BR), hl(21.25, 1.75, 22.25)], {
    badge: { d: [front, vl(12.75, 9.5, 14.5)], knock: front, fill: { solid: [front], cut: [vl(12.75, 9.5, 14.5)] } },
  });
}
// Barn door: the door with its X brace hanging by two rollers from the rail above the opening.
{
  const [x0, y0, x1, y1, r] = [5.5, 6.25, 18.5, 20.75, 1.5];
  const k = r * (1 - Math.SQRT1_2);
  add('barn-door', ['puerta de granero', 'puerta corrediza', 'rústico', 'interiorismo', 'barn door', 'sliding barn door'], [
    hl(3.25, 3.25, 20.75),
    dot(8.75, 4.75),
    dot(15.25, 4.75),
    roundpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], r),
    line([x0 + k, y0 + k], [x1 - k, y1 - k]),
    line([x1 - k, y0 + k], [x0 + k, y1 - k]),
  ]);
}
// Door handle: a tall backplate, the lever reaching out from its rose and the keyhole below; the
// rose and the lever pass in front of the plate.
{
  // The rose and the lever are one outline (drawn apart, the lever's end left a sliver of a hole
  // inside the rose that closed at bold); the rose is wide enough to clear the plate's sides
  const front = ['M14.17 8.25H19.75A1.25 1.25 0 0 1 19.75 10.75H14.17A2.5 2.5 0 1 1 14.17 8.25Z'];
  add('door-handle', ['manija', 'jaladera', 'herraje', 'cerradura', 'door handle', 'lever handle'], [capsule(8.75, 2.75, 6.5, 18.5), dot(12, 16), vl(12, 16, 18.25)], {
    badge: { d: front, knock: front.join(''), fill: { solid: front } },
  });
}
// Doorknob: in profile on the door's face: the rose against the door, the neck and the round knob (an
// oval rose beside a round knob, seen three-quarters, read as a pair of glasses or a key).
const KNOB = { c: [15.25, 12], r: 5.5, neck: [10.5, 13.5] };
{
  const meet = (y) => KNOB.c[0] - Math.sqrt(KNOB.r ** 2 - (y - KNOB.c[1]) ** 2);
  add('doorknob', ['perilla', 'chapa', 'pomo', 'herraje', 'doorknob', 'door knob'], [
    vl(3.25, 2.75, 21.25),
    'M3.25 7.5H4.25A2 2 0 0 1 6.25 9.5V14.5A2 2 0 0 1 4.25 16.5H3.25',
    ...KNOB.neck.map((y) => hl(y, 6.25, meet(y))),
    circ(...KNOB.c, KNOB.r),
  ]);
}

// ── The house ─────────────────────────────────────────────────────────────────────────────────
// Stairs: four steps rising to the right, the handrail on its posts above them.
add('stairs', ['escaleras', 'escalera', 'pisos', 'escalones', 'stairs', 'staircase'], [
  roundline([[2.75, 21], [7.25, 21], [7.25, 17], [11.75, 17], [11.75, 13], [16.25, 13], [16.25, 9], [21.25, 9]], 0.5),
  line([4.75, 12.75], [19.75, 2.75]),
  vl(5.75, 12.1, 21),
  vl(18.25, 3.75, 9),
]);
// Fireplace: the mantel shelf over the arched firebox and its flame, on the hearth.
add('fireplace', ['chimenea', 'hogar', 'acogedor', 'leña', 'fireplace', 'hearth'], [
  hl(5.25, 2.75, 21.25),
  roundline([[4.75, 5.25], [4.75, 20.75], [19.25, 20.75], [19.25, 5.25]], [0, 0, 0, 0]),
  `M8 20.75V14.5A4 4 0 0 1 16 14.5V20.75`,
  flameDropAt(12, 13.75, 20.75),
]);
// Wood stove: a box stove on short legs, the flame behind its glass, the flue rising from its top.
add('wood-stove', ['estufa de leña', 'calentador de leña', 'cabaña', 'calefacción', 'wood stove', 'wood burner'], [
  vl(12, 2.75, 7.75),
  sq(4.25, 7.75, 15.5, 11.25, 2),
  flameDropAt(12, 10.75, 16),
  vl(6.5, 19, 21.25),
  vl(17.5, 19, 21.25),
]);
// Fire pit: a wide shallow bowl on a short stand, the flames rising from it.
add('fire-pit', ['fogatero', 'brasero', 'fogata', 'patio', 'fire pit', 'firepit'], [
  `M2.75 13H21.25C21.25 16.25 17.25 18.25 12 18.25S2.75 16.25 2.75 13Z`,
  line([8.5, 17.9], [7.25, 21]),
  line([15.5, 17.9], [16.75, 21]),
  flameDropAt(12, 2.75, 10),
  flameDropAt(6.75, 6.25, 10),
  flameDropAt(17.25, 6.25, 10),
]);
// Firewood: three log ends stacked in a pyramid, each with its growth ring.
{
  const r = 3.75;
  const C = [[8.4, 16.75], [15.6, 16.75], [12, 16.75 - 3.6 * Math.sqrt(3)]];
  add('firewood', ['leña', 'troncos', 'chimenea', 'madera', 'firewood', 'logs'], [...C.map((c) => circ(...c, r)), ...C.map((c) => dot(...c))]);
}
// Roof: the gable roof is the subject, laid in courses of tiles with staggered joints and overhanging
// the top of the walls, which stay a plain outline under it. On its own a roof read as a tent, a caret,
// a pyramid or a tiled floor.
{
  const [apex, eave] = [[12, 2.75], 13.25];
  const half = (y) => ((y - apex[1]) * 9.75) / (eave - apex[1]);
  const course = (y) => hl(y, 12 - half(y), 12 + half(y));
  add('roof', ['techo', 'tejado', 'impermeabilización', 'inspección', 'roof', 'roofing'], [
    roundpoly([apex, [21.75, eave], [2.25, eave]], [1, 0.6, 0.6]),
    course(7.5),
    course(10.5),
    vl(12, 7.5, 10.5),
    vl(8.75, 10.5, eave),
    vl(15.25, 10.5, eave),
    roundline([[5.25, eave], [5.25, 20.75], [18.75, 20.75], [18.75, eave]], [0, 1.5, 1.5, 0]),
  ]);
}
// Roof leak: the gable roof with its eaves, a crack under its peak and the drop falling from it.
add('roof-leak', ['gotera', 'filtración', 'techo dañado', 'reparación', 'roof leak', 'leak'], [
  roundline([[2.25, 13.25], [12, 3.75], [21.75, 13.25]], [0, 1.25, 0]),
  line([12, 4.3], [10.75, 7.75], [13, 9.25], [12, 11.25]),
  flameDropAt(12, 14.25, 20.5),
]);
// Rain gutter: the roof's slope ending over the gutter's open channel hung from its edge, the downspout
// leaving the channel's bottom and a drop falling from its mouth (the wall and a bent downspout made a
// tangle at 18 px).
{
  const y = (x) => 3.25 + (x - 2.75) * 0.42;
  add('rain-gutter', ['canaleta', 'bajante', 'desagüe pluvial', 'limpieza de canaletas', 'rain gutter', 'downspout'], [
    line([2.75, y(2.75)], [17.25, y(17.25)]),
    roundline([[14.5, y(14.5)], [14.5, 13], [20.75, 13], [20.75, 9.25]], [0, 1.25, 1.25, 0]),
    vl(17.5, 13, 15.25),
    flameDropAt(17.5, 18.25, 22),
  ]);
}
// Fence: pointed pickets joined by two rails running between them.
{
  const picket = (x) => roundpoly([[x - 1.75, 20], [x - 1.75, 8.25], [x, 5.75], [x + 1.75, 8.25], [x + 1.75, 20]], [0.5, 0.5, 0.75, 0.5, 0.5]);
  const xs = [5.25, 12, 18.75];
  add('fence', ['cerca', 'reja de madera', 'valla', 'patio', 'fence', 'picket fence'], [
    ...xs.map(picket),
    ...[11, 16.25].flatMap((y) => [0, 1].map((i) => hl(y, xs[i] + 1.75, xs[i + 1] - 1.75))),
  ]);
}
// Garden gate: a small picket gate with an arched top between its two posts, the latch on its edge.
add('garden-gate', ['puerta de jardín', 'reja', 'portón pequeño', 'entrada', 'garden gate', 'gate'], [
  vl(3.25, 4.25, 21.25),
  vl(20.75, 4.25, 21.25),
  `M6.25 20.75V10.75Q12 5.25 17.75 10.75V20.75Z`,
  vl(10, 8.75, 20.75),
  vl(14, 8.75, 20.75),
  dot(17.75, 14.5),
]);
// Driveway gate: two leaves of vertical bars meeting at the middle between two square pillars.
const PILLARS = [sq(2.75, 7.25, 3, 14, 0.75, BR), sq(18.25, 7.25, 3, 14, 0.75, BR)];
add('driveway-gate', ['portón', 'reja eléctrica', 'acceso vehicular', 'motor de portón', 'driveway gate', 'gate'], [
  ...PILLARS,
  hl(9.5, 5.75, 18.25),
  vl(12, 9.5, 19.75),
  vl(8.875, 9.5, 19.75),
  vl(15.125, 9.5, 19.75),
]);
// Open: the pillars with both leaves swung inward, the way clear between them.
add('driveway-gate-open', ['portón abierto', 'acceso permitido', 'abrir portón', 'entrada libre', 'driveway gate open', 'gate open'], [
  ...PILLARS,
  roundline([[5.75, 9.5], [9.25, 10.75], [9.25, 17.25], [5.75, 18.5]], [0, 0.5, 0.5, 0]),
  roundline([[18.25, 9.5], [14.75, 10.75], [14.75, 17.25], [18.25, 18.5]], [0, 0.5, 0.5, 0]),
]);
// Porch: a small gable roof on two columns over two steps that lead to the door.
{
  const roofAt = (x) => 3.5 + Math.abs(x - 12) * (7.75 / 9.25);
  add('porch', ['porche', 'pórtico', 'entrada', 'fachada', 'porch', 'front porch'], [
    roundline([[2.75, roofAt(2.75)], [12, 3.5], [21.25, roofAt(21.25)]], [0, 1.25, 0]),
    vl(5.25, roofAt(5.25), 16.25),
    vl(18.75, roofAt(18.75), 16.25),
    roundline([[9.75, 16.25], [9.75, 10.75], [14.25, 10.75], [14.25, 16.25]], [0, 1.25, 1.25, 0]),
    roundline([[2.75, 21.25], [2.75, 18.75], [4.25, 18.75], [4.25, 16.25], [19.75, 16.25], [19.75, 18.75], [21.25, 18.75], [21.25, 21.25]], [0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0]),
  ]);
}
// Shed: a small gable building, its braced plank door and a small window beside it.
{
  const roofAt = (x) => 5 + Math.abs(x - 12) * (7.75 / 9.25);
  add('shed', ['caseta', 'bodega de jardín', 'cobertizo', 'almacenaje exterior', 'shed', 'garden shed'], [
    roundline([[2.5, roofAt(2.5)], [12, 5], [21.5, roofAt(21.5)]], [0, 1.25, 0]),
    roundline([[3.75, roofAt(3.75)], [3.75, 20.75], [20.25, 20.75], [20.25, roofAt(20.25)]], [0, 2, 0, 0]),
    roundline([[6.75, 20.75], [6.75, 13], [11, 13], [11, 20.75]], [0, 0.75, 0.75, 0]),
    line([6.75, 20.25], [11, 13.5]),
    sq(14, 13, 3.25, 3.25, 0.75, BR),
  ]);
}
// Gazebo: a pointed roof with its finial on four posts, a low rail between them.
add('gazebo', ['kiosco', 'glorieta', 'pérgola techada', 'jardín', 'gazebo', 'garden pavilion'], [
  roundpoly([[12, 4.75], [21.5, 10.25], [2.5, 10.25]], [0.75, 0.75, 0.75]),
  vl(12, 2.25, 4.75),
  vl(5.25, 10.25, 21),
  vl(9.75, 10.25, 21),
  vl(14.25, 10.25, 21),
  vl(18.75, 10.25, 21),
  hl(16.25, 5.25, 18.75),
]);
// Pergola: posts carrying two beams, a row of slats crossing them, in perspective.
add('pergola', ['pérgola', 'sombra', 'patio', 'terraza', 'pergola', 'arbor'], [
  vl(5.25, 10.25, 21),
  vl(15.75, 10.25, 21),
  vl(19.25, 7.25, 17.75),
  hl(10.25, 2.75, 16.25),
  hl(7.25, 7.75, 21.25),
  ...[6.5, 10.25, 14].map((x) => line([x - 1.75, 13.25], [x + 3.25, 4.25])),
]);
// Hot tub: a round tub from the side, the water's wave inside it and steam curling above.
add('hot-tub', ['jacuzzi', 'tina de hidromasaje', 'spa', 'amenidad', 'hot tub', 'whirlpool'], [
  `M3.25 11.75H20.75V16.75C20.75 19.25 19 20.75 16.5 20.75H7.5C5 20.75 3.25 19.25 3.25 16.75Z`,
  `M3.25 15Q5.44 13.5 7.63 15T12 15T16.38 15T20.75 15`,
  `M9 8.75C7.75 7.5 10.25 6 9 4.25`,
  `M15 8.75C13.75 7.5 16.25 6 15 4.25`,
]);

// ── Bathroom ──────────────────────────────────────────────────────────────────────────────────
// Bathtub: in profile, the rolled rim over the tub on two clawed feet, the faucet at one end.
add('bathtub', ['tina', 'bañera', 'baño', 'amenidad', 'bathtub', 'bath'], [
  capsule(2.5, 8.5, 19, 2.75),
  `M4.25 11.25C4.25 15.75 6.5 17.5 9.75 17.5H14.25C17.5 17.5 19.75 15.75 19.75 11.25`,
  roundline([[7.5, 17.25], [6.75, 20.5], [5, 20.5]], [0, 0.75, 0]),
  roundline([[16.5, 17.25], [17.25, 20.5], [19, 20.5]], [0, 0.75, 0]),
  roundline([[5.25, 8.5], [5.25, 4.25], [9, 4.25], [9, 5.5]], [0, 1.5, 1.5, 0]),
]);
// Shower: the pipe arching over into the shower head, the water falling at an angle.
add('shower', ['regadera', 'ducha', 'baño', 'amenidad', 'shower', 'shower head'], [
  `M4.75 21V7.25A4.25 4.25 0 0 1 13.25 7.25V8.25`,
  roundpoly([[11.5, 8.25], [15, 8.25], [17.5, 11.5], [9, 11.5]], [0.6, 0.6, 0.75, 0.75]),
  line([9.75, 14.5], [11, 19.5]),
  line([13.25, 14.5], [14.5, 19.5]),
  line([16.75, 14.5], [18, 19.5]),
]);
// Toilet: in profile, the tank over the bowl on its pedestal, the seat line across the bowl.
const TOILET = [
  roundline([[3.25, 12.25], [3.25, 3.25], [9.5, 3.25], [9.5, 12.25]], [0, 1.25, 1.25, 0]),
  `M3.25 12.25H20.75C20.75 15.75 18.25 17.5 15 17.75L15.75 20.75H8.25L8.75 17.5C5.25 16.75 3.25 15 3.25 12.25Z`,
  hl(15, 4.4, 19.6),
];
add('toilet', ['inodoro', 'sanitario', 'baño', 'medio baño', 'toilet', 'restroom'], TOILET);
// Bidet: a low bowl on its pedestal with the small faucet arching over its back.
add('bidet', ['bidé', 'baño', 'sanitario', 'aseo', 'bidet', 'bathroom fixture'], [
  `M3.25 13.25H20.75C20.75 16.5 18.25 18 15 18.25L15.75 20.75H8.25L8.75 18C5.5 17.25 3.25 16 3.25 13.25Z`,
  roundline([[6.25, 13.25], [6.25, 8.5], [10.25, 8.5], [10.25, 10.25]], [0, 1.75, 1.75, 0]),
]);
// Washbasin: the basin bowl on its pedestal, the faucet's spout over it.
add('washbasin', ['lavabo', 'lavamanos', 'baño', 'grifo', 'washbasin', 'bathroom sink'], [
  `M3.25 9.5H20.75C20.75 13 16.75 15 12 15S3.25 13 3.25 9.5Z`,
  roundline([[9.75, 14.75], [10.25, 21], [13.75, 21], [14.25, 14.75]], [0, 0.6, 0.6, 0]),
  roundline([[12, 9.5], [12, 4.75], [16.25, 4.75], [16.25, 6.5]], [0, 1.75, 1.75, 0]),
]);
// Toilet paper: the roll turned three-quarters, its core showing at the end and the sheet hanging
// down with a perforation.
add('toilet-paper', ['papel higiénico', 'papel de baño', 'rollo', 'amenidades', 'toilet paper', 'toilet roll'], [
  capsule(3.25, 3.25, 17.5, 8.25),
  ell([7.375, 7.375], 1.25, 1.25),
  roundline([[11.5, 11.5], [11.5, 20.75], [20.75, 20.75], [20.75, 7.375]], [0, 1, 0, 0]),
  hl(16.25, 14.5, 17.75),
]);
// Towel rack: a wall bar on its two brackets, a folded towel hanging over it.
add('towel-rack', ['toallero', 'barra para toallas', 'baño', 'accesorios de baño', 'towel rack', 'towel bar'], [
  sq(2.5, 4.25, 3, 5, 1),
  sq(18.5, 4.25, 3, 5, 1),
  hl(6.75, 5.5, 8),
  hl(6.75, 16, 18.5),
  sq(8, 3.75, 8, 17, 1.5),
  hl(16, 8, 16),
]);
// Medicine cabinet: the wall cabinet with its shelf, its mirror door swung half open, two glints on
// the glass.
add('medicine-cabinet', ['botiquín', 'gabinete de baño', 'espejo con gabinete', 'baño', 'medicine cabinet', 'bathroom cabinet'], [
  sq(3.25, 3.25, 8.5, 17.5, 1.5, BR),
  hl(12, 3.25, 11.75),
  roundpoly([[11.75, 3.25], [20.25, 2.25], [20.25, 21.75], [11.75, 20.75]], [0.75, 0.75, 0.75, 0.75]),
  line([14.75, 11], [17.25, 8.5]),
  line([14.75, 15.25], [17.25, 12.75]),
]);

// ── Floors and furniture services ─────────────────────────────────────────────────────────────
// Flooring: wooden planks, their joints staggered, filling a floor seen in perspective.
{
  const k = 4.25 / 14;
  const joint = (x, y0, y1) => line([x, y0], [x - (y1 - y0) * k, y1]);
  add('flooring', ['piso de madera', 'duela', 'instalación de pisos', 'remodelación', 'flooring', 'hardwood floor'], [
    roundpoly([[7, 5], [21.25, 5], [17, 19], [2.75, 19]], 1),
    hl(9.67, 7 - 4.67 * k, 21.25 - 4.67 * k),
    hl(14.33, 7 - 9.33 * k, 21.25 - 9.33 * k),
    joint(14.5, 5, 9.67),
    joint(10.75, 9.67, 14.33),
    joint(17.75, 9.67, 14.33),
    joint(12.75, 14.33, 19),
  ]);
}
// Tile floor: a floor in perspective ruled into three by three tiles.
{
  const L = (y) => 7 - ((y - 5) * 4.25) / 14;
  const R = (y) => 17 + ((y - 5) * 4.25) / 14;
  add('tile-floor', ['piso de loseta', 'azulejo', 'mosaico', 'baño', 'tile floor', 'tiles'], [
    roundpoly([[7, 5], [17, 5], [21.25, 19], [2.75, 19]], 1),
    line([10.33, 5], [8.92, 19]),
    line([13.67, 5], [15.08, 19]),
    hl(8.75, L(8.75), R(8.75)),
    hl(13.25, L(13.25), R(13.25)),
  ]);
}
// Flat-pack: a flat box standing upright, its thin side and top showing, the L-shaped hex key standing
// beside it.
add('flat-pack', ['mueble para armar', 'armado de muebles', 'llave allen', 'caja plana', 'flat-pack', 'furniture assembly'], [
  roundpoly([[3.25, 21.25], [3.25, 5.25], [6.25, 3.25], [15.75, 3.25], [15.75, 19.25], [12.75, 21.25]], [1.25, 0.4, 0.75, 0.75, 0.4, 0]),
  line([3.25, 5.25], [12.75, 5.25], [15.75, 3.25]),
  vl(12.75, 5.25, 21.25),
  roundline([[18.75, 9.5], [18.75, 21], [21.5, 21]], [0, 1, 0]),
]);
// View in room: the armchair inside the corner brackets of a scan frame, standing on the floor.
{
  const A = couch({ x0: 7.25, x1: 16.75, armW: 2.75, armTop: 10.5, seat: 12.75, base: 15.5, seats: 1, feet: 17.75, arch: true });
  add('view-in-room', ['ver en tu espacio', 'realidad aumentada', 'ar', 'probar mueble', 'view in room', 'augmented reality'], [
    roundline([[3.25, 7.25], [3.25, 3.25], [7.25, 3.25]], [0, 1.5, 0]),
    roundline([[16.75, 3.25], [20.75, 3.25], [20.75, 7.25]], [0, 1.5, 0]),
    roundline([[20.75, 16.75], [20.75, 20.75], [16.75, 20.75]], [0, 1.5, 0]),
    roundline([[7.25, 20.75], [3.25, 20.75], [3.25, 16.75]], [0, 1.5, 0]),
    A.body,
    A.back,
    ...A.feet,
    hl(17.75, 6.25, 17.75),
  ]);
  icons['view-in-room'].fill = { solid: A.fill.solid, cut: A.fill.cut, wire: [...icons['view-in-room'].d.slice(0, 4), ...A.feet, icons['view-in-room'].d[8]] };
}
// Water damage: lugares' house with the water's wave across its lower part and a drop above it.
add('water-damage', ['daño por agua', 'inundación', 'fuga', 'siniestro', 'water damage', 'flood'], [
  lugares.icons.house.d[0],
  lugares.icons.house.d[1],
  `M5.25 16.75Q6.94 15.25 8.63 16.75T12 16.75T15.38 16.75T18.75 16.75`,
  flameDropAt(12, 8.25, 12.75),
]);

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d`: `solid` is filled (closed shapes only; `close` shuts the open outlines along their
// chord, which lands on a floor, a seat, a seam or a slope), `cut` is knocked out at stroke width,
// `lines` stays a line with a clearance of paper, `wire` stays a line attached to the fill. Where two
// filled pieces share an edge (a frame on its sill, a lid on its chest, a shutter on its hinge), a
// cut along that edge keeps them apart. Icons whose fill needs shapes of their own (a headboard
// down to the duvet's fold, a firebox open around its flame) are given them here.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
Object.assign(FILL, {
  'folding-chair': { solid: [0], wire: [1, 2] },
  stool: { solid: [0], wire: [1, 2, 3, 4] },
  bench: { solid: [0], wire: [1, 2, 3, 4, 5] },
  pouf: { solid: [0], cut: [1] },
  'bean-bag': { solid: [0], cut: [1] },
  recliner: { solid: [0, 1, 2], wire: [3, 4, 5] },
  'wall-bed': { solid: [0, 1], wire: [2], lines: [3, 4] },
  nightstand: { solid: [0], cut: [1, 2], wire: [3, 4] },
  'air-mattress': { solid: [0, 3], cut: [1, 2], close: true },
  pillow: { solid: [0] },
  cushion: { solid: [0], cut: [1] },
  duvet: { solid: [0], cut: [1, 2, 3] },
  'dining-table': { solid: [0], wire: [1, 2, 3] },
  'coffee-table': { solid: [0], wire: [1, 2, 3, 4] },
  'side-table': { solid: [0], wire: [1, 2, 3] },
  'folding-table': { solid: [0], wire: [1, 2] },
  'dressing-table': { solid: [0, 3], cut: [1, 4], wire: [2, 5, 6] },
  'tv-stand': { solid: [0, 2], cut: [3, 4, 5], wire: [1] },
  sideboard: { solid: [0], cut: [1, 2, 3], wire: [4, 5] },
  shelf: { solid: [0, 1, 2, 3, 4, 5], close: true },
  'shelving-unit': { solid: [0], cut: [1, 2, 3], wire: [4, 5] },
  'shoe-rack': { solid: [4, 5], wire: [0, 1, 2, 3], close: true },
  'coat-hooks': { solid: [0, 5], wire: [1, 2, 3, 4] },
  lamp: { solid: [0, 2], wire: [1] },
  'lamp-on': { solid: [0, 2], wire: [1], lines: [3, 4, 5, 6] },
  'lamp-floor': { solid: [0, 2], wire: [1] },
  'lamp-arc': { solid: [0, 2], wire: [1] },
  'lamp-pendant': { solid: [2], wire: [0, 1, 3] },
  'lamp-ceiling': { solid: [1], wire: [0], lines: [2, 3, 4], close: true },
  'lamp-wall': { solid: [0, 2], wire: [1] },
  chandelier: { solid: [2, 3, 4], wire: [0, 1] },
  downlight: { solid: [1], wire: [0], lines: [2, 3, 4], close: true },
  'track-light': { solid: [0, 1, 2, 3] },
  candle: { solid: [0, 2], wire: [1] },
  'string-lights': { solid: [1, 2], wire: [0] },
  'garden-lamp': { solid: [0, 1], cut: [2], wire: [3, 4] },
  mirror: { solid: [0], cut: [1, 2] },
  'floor-mirror': { solid: [1], cut: [2], wire: [0] },
  'wall-art': { solid: [0, 3], cut: [1], wire: [2] },
  'picture-frame': { solid: [0], cut: [1], wire: [2] },
  rug: { solid: [0], cut: [1], wire: range(2, 10) },
  doormat: { solid: [0], close: true },
  curtains: { solid: [1, 2], cut: [3, 4], wire: [0] },
  'curtains-closed': { solid: [1], cut: [2, 3, 4], wire: [0] },
  'room-divider': { solid: [0], cut: [1, 2], wire: [3, 4, 5] },
  'home-theater': { solid: [0, 1] },
  'door-double': { solid: [0], cut: [2, 3, 4], wire: [1], close: true },
  'door-sliding': { solid: [0], wire: [1] },
  'barn-door': { solid: [1, 2, 3], cut: [4, 5], wire: [0] },
  'door-handle': { solid: [0], cut: [1, 2] },
  'wood-stove': { solid: [1], cut: [2], wire: [0, 3, 4] },
  'fire-pit': { solid: [0, 3, 4, 5], wire: [1, 2] },
  firewood: { solid: [0, 1, 2], cut: [3, 4, 5] },
  'roof-leak': { solid: [2], wire: [0, 1] },
  'rain-gutter': { solid: [1, 3], wire: [0, 2], close: true },
  fence: { solid: [0, 1, 2], wire: range(3, 7) },
  'garden-gate': { solid: [2, 5], cut: [3, 4], wire: [0, 1] },
  shed: { solid: [0, 1], cut: [2, 3, 4], close: true },
  gazebo: { solid: [0], wire: range(1, 7) },
  'hot-tub': { solid: [0], cut: [1], lines: [2, 3] },
  shower: { solid: [1], wire: [0], lines: [2, 3, 4] },
  bidet: { solid: [0], wire: [1] },
  washbasin: { solid: [0, 1], wire: [2], close: true },
  'towel-rack': { solid: [0, 1, 4], cut: [5], wire: [2, 3] },
  flooring: { solid: [0], cut: range(1, 7) },
  'tile-floor': { solid: [0], cut: range(1, 5) },
  'water-damage': { solid: [0, 1], cut: [2, 3], close: true },
  bedroom: { solid: [4, 5], wire: [0, 1, 2, 6] },
  'dining-room': { solid: [0], wire: range(1, 9) },
  'guest-room': { solid: [4], wire: [0, 1, 2, 5] },
});
for (const name of ['chair', 'rocking-chair']) FILL[name] = { solid: [0, 2], cut: [1], wire: range(3, icons[name].d.length), close: true };
for (const name of ['garage', 'garage-double']) FILL[name] = { solid: [0, 1], cut: range(2, icons[name].d.length), close: true };
for (const [name, spec] of Object.entries(FILL)) {
  if (!spec || icons[name].fill) continue;
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  const solid = pick(spec.solid);
  icons[name].fill = { solid: spec.close ? solid.map(shut) : solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}
// The chair's back closes along the seat; in the bedroom and the guest room the bed is filled as
// lugares fills it (the mattress solid, the pillow floating; headboard, edge and frame attached).
const sideMattress = ({ x0, x1, top, frame }) => roundpoly([[x0, top], [x1 - 2, top], [x1, top + 2], [x1, frame], [x0, frame]], [0, 1.75, 1.75, 0, 0]);
icons.bedroom.fill.solid.push(sideMattress(BEDROOM), icons.bedroom.d[3]);
icons['guest-room'].fill.solid.push(sideMattress({ x0: 2.75, x1: 13.75, top: 12, frame: 16 }), icons['guest-room'].d[3]);
// The set's bed under a badge, filled as lugares fills it
for (const name of ['bed-plus', 'bed-check']) icons[name].fill = { solid: lugares.icons.bed.fill.solid, wire: [BED[0], BED[2]] };
// Lines only: the deck chair's frames and canvas, the pergola's posts and slats, the room's plan
for (const name of ['deck-chair', 'pergola', 'room-plus']) icons[name].fill = false;
// Beds from the foot: the headboard down to the duvet's fold is solid, the pillows are knocked out as
// rings and the mattress's top runs through it; below the fold the posts stand as legs. The twin
// beds' headboard is solid down to their mattresses, which stay lines.
{
  const footFill = (x0, x1, pillows) => ({
    solid: [roundpoly([[x0, 16], [x0, 4.25], [x1, 4.25], [x1, 16]], [0, 2.5, 2.5, 0])],
    cut: [...pillows, hl(13, x0 - 1, x1 + 1)],
    wire: [vl(x0, 16, 21.25), vl(x1, 16, 21.25)],
  });
  icons['double-bed'].fill = footFill(3.5, 20.5, DOUBLE.pillows);
  icons['single-bed'].fill = footFill(6.75, 17.25, SINGLE.pillows);
  const t = icons['twin-beds'].d;
  icons['twin-beds'].fill = {
    solid: [roundpoly([[3.5, 13], [3.5, 4.25], [20.5, 4.25], [20.5, 13]], [0, 2.5, 2.5, 0])],
    cut: [...DOUBLE.pillows],
    wire: [t[3], t[4], vl(3.5, 13, 21.25), vl(20.5, 13, 21.25)],
  };
  // The canopy: the curtains (closed along their posts), the pillows and the bed under its top solid
  const c = icons['canopy-bed'].d;
  icons['canopy-bed'].fill = { solid: [shut(c[1]), shut(c[2]), c[3], c[4], roundpoly([[3.5, 17.25], [20.5, 17.25], [20.5, 21.25], [3.5, 21.25]], 0)], wire: [c[0]] };
  // Bunks: the pillows solid over their decks; the loft's deck solid between the posts
  const b = icons['bunk-bed'].d;
  icons['bunk-bed'].fill = { solid: [b[2], b[4]], wire: [b[0], b[1], b[3], b[5], b[6]] };
  const l = icons['loft-bed'].d;
  icons['loft-bed'].fill = { solid: [l[2], roundpoly([[3.25, 9.5], [16.75, 9.5], [16.75, 12.5], [3.25, 12.5]], 0)], wire: [l[0], l[1], l[5], l[6], l[7]] };
}
// Mattress: its top and its side band solid; the edges between them knocked out through the sides
{
  const d = icons.mattress.d;
  icons.mattress.fill = { solid: [d[0], shut(d[1])], cut: [line([1.75, 13], [17.75, 13], [22.25, 5.29]), d[2], d[3], d[4], d[5]] };
}
// Cabinets whose body is open at the cornice close along it; the doors' seam and the shelves cut
// through from the cornice to the feet; cornice and feet attached.
{
  const w = icons.wardrobe.d;
  icons.wardrobe.fill = { solid: [shut(w[1])], cut: [vl(12, 4.75, 20.5), w[3], w[4]], wire: [w[0], w[5], w[6]] };
  const c = icons['display-cabinet'].d;
  icons['display-cabinet'].fill = { solid: [shut(c[1])], cut: [c[2], c[3], c[4]], wire: [c[0], c[5], c[6]] };
  const r = icons.dresser.d;
  icons.dresser.fill = {
    solid: [roundpoly([[4.25, 19.75], [4.25, 2.5], [19.75, 2.5], [19.75, 19.75]], [0, 2, 2, 0])],
    cut: [r[1], r[2], r[4], r[5], r[6]],
    wire: [vl(4.25, 19.75, 21.5), vl(19.75, 19.75, 21.5)],
  };
}
// Coat rack: the hat's crown closes along its brim; the rest are lines. Umbrella stand: the bin closes
// along its rim. Storage chest: the lid closes on the chest, the seam between them knocked out.
{
  const r = icons['coat-rack'].d;
  icons['coat-rack'].fill = { solid: [shut(r[5])], wire: [r[0], r[1], r[2], r[3], r[4], r[6]] };
  const u = icons['umbrella-stand'].d;
  icons['umbrella-stand'].fill = { solid: [shut(u[0])], wire: [u[1], u[2], u[3]] };
  const c = icons['storage-chest'].d;
  icons['storage-chest'].fill = { solid: [shut(c[0]), c[1]], cut: [hl(11.25, 3.5, 20.5), c[2]], wire: [c[3], c[4]] };
}
// Ottoman: the cushion and the base solid, the seam between them knocked out. Bathroom: the tank
// apart from the bowl as the toilet's, the basin on its pedestal, the faucet attached. Walk-in closet:
// the doorway solid, the rail and the hanger knocked out of it (a solid hanger read as a lamp).
{
  const o = icons.ottoman.d;
  icons.ottoman.fill = { solid: [o[0], shut(o[1])], cut: [hl(11.5, 1.75, 22.25)], wire: [o[2], o[3]] };
  const b = icons.bathroom.d;
  icons.bathroom.fill = { solid: [shut(b[0]), b[1], b[2], shut(b[3])], cut: [hl(11.75, 1.75, 6.5)], wire: [b[4]] };
  const w = icons['walk-in-closet'].d;
  icons['walk-in-closet'].fill = { solid: [shut(w[0])], cut: [w[1], w[2], w[3]] };
}
// Roof: the roof solid, its courses and joints knocked out; the lowest joints stop inside the eave so
// the eave runs whole; the walls stay their outline under it.
{
  const r = icons.roof.d;
  icons.roof.fill = { solid: [r[0]], cut: [r[1], r[2], r[3], vl(8.75, 10.5, 12.25), vl(15.25, 10.5, 12.25)], wire: [r[6]] };
}
// Wallpaper roll: the roll's end and the sheet solid, the core and the stripes knocked out
{
  const d = icons['wallpaper-roll'].d;
  icons['wallpaper-roll'].fill = { solid: [circ(7.75, 10.75, 4.75), shut(d[2])], cut: [d[1], d[3], d[4]], wire: [d[0]] };
}
// Rooms: the sofa as the sofa fills; the entryway's door and mat apart; the lamp's shade solid
{
  const L = icons['living-room'].d;
  icons['living-room'].fill = { solid: [...LIVING.fill.solid, L[5]], cut: LIVING.fill.cut, wire: [...LIVING.fill.wire, L[6], L[7]] };
  const e = icons.entryway.d;
  icons.entryway.fill = { solid: [shut(e[0]), e[2]], cut: [e[1], hl(18.75, 1.25, 14.75)], wire: e.slice(3) };
}
// Windows: the frame closes along its sill, which stays a line under it; the mullions cut it into
// panes.
{
  const w = icons.windowpane.d;
  icons.windowpane.fill = { solid: [shut(w[0])], cut: [w[2], w[3]], wire: [w[1]] };
  const b = icons['broken-window'].d;
  icons['broken-window'].fill = { solid: [shut(b[0])], cut: [b[2], b[3], b[4]], wire: [b[1]] };
  const c = icons['casement-window'].d;
  icons['casement-window'].fill = { solid: [shut(c[0]), c[3]], cut: [c[2], vl(14.75, 1.75, 19.75)], wire: [c[1]] };
  const s2 = icons['sliding-window'].d;
  icons['sliding-window'].fill = { solid: [s2[0]], cut: [s2[2], s2[3]], wire: [s2[1]] };
  const sh = icons.shutters.d;
  icons.shutters.fill = { solid: [sh[0], shut(sh[1]), shut(sh[2])], cut: [vl(8.5, 3, 21), vl(15.5, 3, 21), ...sh.slice(3)] };
  const k = icons.skylight.d;
  icons.skylight.fill = { solid: [k[1]], cut: [k[2]], wire: [k[0]], lines: [k[3], k[4]] };
}
// Hardware and the house: the doorknob's rose, neck and knob as one; the porch's door on its step;
// the fireplace's firebox left open around its flame
{
  const k = icons.doorknob.d;
  icons.doorknob.fill = { solid: [shut(k[1]), roundpoly([[6.25, KNOB.neck[0]], [KNOB.c[0], KNOB.neck[0]], [KNOB.c[0], KNOB.neck[1]], [6.25, KNOB.neck[1]]], 0), k[4]], wire: [k[0]] };
  const st = icons.stairs.d;
  icons.stairs.fill = { solid: [shut(st[0])], wire: [st[1], st[2], st[3]] };
  const f2 = icons.fireplace.d;
  icons.fireplace.fill = { solid: [`M4.75 5.25V20.75H8V14.5A4 4 0 0 1 16 14.5V20.75H19.25V5.25Z`, f2[3]], wire: [f2[0]] };
  const po = icons.porch.d;
  icons.porch.fill = { solid: [shut(po[0]), shut(po[3]), shut(po[4])], cut: [hl(16.25, 9, 15)], wire: [po[1], po[2]] };
  const dg = icons['driveway-gate'].d;
  icons['driveway-gate'].fill = { solid: [dg[0], dg[1]], wire: [dg[2], dg[3], dg[4], dg[5]] };
  const go = icons['driveway-gate-open'].d;
  icons['driveway-gate-open'].fill = { solid: [go[0], go[1], shut(go[2]), shut(go[3])], cut: [vl(5.75, 8, 20), vl(18.25, 8, 20)] };
}
// The bathroom: the tub's body closes on its rim and the toilet's tank on its bowl, each apart from
// it by a cut along their seam; the roll and its sheet apart; the cabinet and its open door apart.
{
  const t = icons.bathtub.d;
  icons.bathtub.fill = { solid: [t[0], shut(t[1])], cut: [hl(11.25, 3.25, 20.75)], wire: [t[2], t[3], t[4]] };
  const o = icons.toilet.d;
  icons.toilet.fill = { solid: [shut(o[0]), o[1]], cut: [hl(12.25, 2.25, 9.75), hl(15, 2.25, 21.75)] };
  const p = icons['toilet-paper'].d;
  icons['toilet-paper'].fill = { solid: [p[0], shut(p[2])], cut: [p[1], p[3], hl(11.5, 10.5, 17)] };
  const m = icons['medicine-cabinet'].d;
  icons['medicine-cabinet'].fill = { solid: [m[0], m[2]], cut: [m[1], m[3], m[4], vl(11.75, 1.75, 22.25)] };
  const fp = icons['flat-pack'].d;
  icons['flat-pack'].fill = { solid: [fp[0]], cut: [line([2.25, 5.25], [12.75, 5.25], [16.75, 2.58]), vl(12.75, 5.25, 22.25)], wire: [fp[3]] };
}

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// Drawings of their own where the snap left a smudge, on pixel centers (at 16 px a pixel is 1.5
// of the canvas, its centers at 0.75 + 1.5k): the pillows become two-pixel bars with a pixel of
// paper around them, the spots of the track hang straight, the bulbs hang on a zigzag wire.
const PX = (k) => 0.75 + 1.5 * k;
const bar = (c0, c1, row) => roundpoly([[PX(c0), PX(row)], [PX(c1), PX(row)], [PX(c1), PX(row + 1)], [PX(c0), PX(row + 1)]], 0.3);
{
  const bed16 = (c0, c1, pillows) => {
    const frame = roundline([[PX(c0), PX(14)], [PX(c0), PX(2)], [PX(c1), PX(2)], [PX(c1), PX(14)]], [0, 1.5, 1.5, 0]);
    const ps = pillows.map(([a, b]) => bar(a, b, 5));
    const lines = [hl(PX(8), PX(c0), PX(c1)), hl(PX(10), PX(c0), PX(c1))];
    return {
      d: [frame, ...ps, ...lines],
      fill: {
        solid: [roundpoly([[PX(c0), PX(10)], [PX(c0), PX(2)], [PX(c1), PX(2)], [PX(c1), PX(10)]], [0, 1.5, 1.5, 0])],
        cut: [...ps, hl(PX(8), PX(c0) - 1, PX(c1) + 1)],
        wire: [vl(PX(c0), PX(10), PX(14)), vl(PX(c1), PX(10), PX(14))],
      },
    };
  };
  icons['double-bed'].small = bed16(2, 13, [[4, 6], [9, 11]]);
  icons['single-bed'].small = bed16(4, 11, [[6, 9]]);
  const frame = roundline([[PX(2), PX(14)], [PX(2), PX(2)], [PX(13), PX(2)], [PX(13), PX(14)]], [0, 1.5, 1.5, 0]);
  const ps = [bar(4, 6, 5), bar(9, 11, 5)];
  const halves = [roundline([[PX(2), PX(8)], [PX(6), PX(8)], [PX(6), PX(14)]], [0, 1, 0]), roundline([[PX(13), PX(8)], [PX(9), PX(8)], [PX(9), PX(14)]], [0, 1, 0])];
  icons['twin-beds'].small = {
    d: [frame, ...ps, ...halves],
    fill: { solid: [roundpoly([[PX(2), PX(8)], [PX(2), PX(2)], [PX(13), PX(2)], [PX(13), PX(8)]], [0, 1.5, 1.5, 0])], cut: ps, wire: [...halves, vl(PX(2), PX(8), PX(14)), vl(PX(13), PX(8), PX(14))] },
  };
  // Bunks: each deck its pillow bar over its mattress; the ladder on the foot
  const posts = [vl(PX(2), PX(1), PX(14)), vl(PX(11), PX(1), PX(14))];
  const ladder = line([PX(11), PX(5)], [PX(14), PX(14)]);
  const up = bar(4, 6, 2);
  const low = bar(4, 6, 8);
  icons['bunk-bed'].small = {
    d: [...posts, up, hl(PX(5), PX(2), PX(11)), low, hl(PX(11), PX(2), PX(11)), ladder],
    fill: { solid: [up, low], wire: [...posts, hl(PX(5), PX(2), PX(11)), hl(PX(11), PX(2), PX(11)), ladder] },
  };
  const deck = [hl(PX(5), PX(2), PX(11)), hl(PX(7), PX(2), PX(11))];
  const desk = [hl(PX(10), PX(2), PX(7)), vl(PX(6), PX(10), PX(14))];
  icons['loft-bed'].small = {
    d: [...posts, up, ...deck, ladder, ...desk],
    fill: { solid: [up, roundpoly([[PX(2), PX(5)], [PX(11), PX(5)], [PX(11), PX(7)], [PX(2), PX(7)]], 0)], wire: [...posts, ladder, ...desk] },
  };
}
{
  // Track light: the rail and three straight spots, two pixels apart
  const rail = capsule(PX(2), PX(2), PX(13) - PX(2), 1.5);
  const spot = (c) => roundpoly([[PX(c), PX(4)], [PX(c + 1), PX(4)], [PX(c + 1), PX(7)], [PX(c), PX(7)]], 0.4);
  const spots = [spot(3), spot(7), spot(10)];
  icons['track-light'].small = { d: [rail, ...spots], fill: { solid: [rail, ...spots] } };
  // String lights: the wire as two pixel swags, a bulb hanging from each valley on its socket
  const wire = line([PX(1), PX(2)], [PX(4), PX(5)], [PX(7), PX(2)], [PX(10), PX(5)], [PX(13), PX(2)]);
  const bulbs = [4, 10].flatMap((c) => [vl(PX(c), PX(5), PX(7)), roundpoly([[PX(c - 1), PX(7)], [PX(c + 1), PX(7)], [PX(c + 1), PX(9)], [PX(c - 1), PX(9)]], 0.75)]);
  icons['string-lights'].small = { d: [wire, ...bulbs], fill: { solid: [bulbs[1], bulbs[3]], wire: [wire, bulbs[0], bulbs[2]] } };
  // Pillow: straight sides with a pixel ear at each corner
  const pillow = roundpoly(
    [[PX(1), PX(2)], [PX(3), PX(3)], [PX(12), PX(3)], [PX(14), PX(2)], [PX(13), PX(4)], [PX(13), PX(11)], [PX(14), PX(13)], [PX(12), PX(12)], [PX(3), PX(12)], [PX(1), PX(13)], [PX(2), PX(11)], [PX(2), PX(4)]],
    [0.3, 0.6, 0.6, 0.3, 0.6, 0.6, 0.3, 0.6, 0.6, 0.3, 0.6, 0.6],
  );
  icons.pillow.small = { d: [pillow], fill: { solid: [pillow] } };
}

// ── Named parts ───────────────────────────────────────────────────────────────────────────────
// Every icon with a badge or a motion of its own, and those whose pieces have a meaning of their own
const BED_PARTS = { headboard: [0], mattress: [1], frame: [2], pillow: [3] };
const PARTS = {
  sofa: { body: [0], back: [1], cushions: [2, 3], feet: [4, 5] },
  loveseat: { body: [0], back: [1], cushions: [2], feet: [3, 4] },
  armchair: { body: [0], back: [1], feet: [2, 3] },
  'sofa-bed': { body: [0], back: [1] },
  'rocking-chair': { back: [0, 1], seat: [2], legs: [3, 4], rocker: [5] },
  recliner: { back: [0], seat: [1], footrest: [2, 3], legs: [4, 5] },
  'bed-plus': BED_PARTS,
  'bed-check': BED_PARTS,
  'wall-bed': { cabinet: [0], bed: [1, 2], arrow: [3, 4] },
  'lamp-on': { shade: [0], stem: [1], base: [2], rays: [3, 4, 5, 6] },
  'lamp-pendant': { ceiling: [0], cord: [1], shade: [2], bulb: [3] },
  chandelier: { stem: [0], arms: [1], flames: [2, 3], finial: [4] },
  'string-lights': { wire: [0], bulbs: [1, 2] },
  candle: { candle: [0], wick: [1], flame: [2] },
  mirror: { glass: [0], glints: [1, 2] },
  'wall-art': { frame: [0, 1], wire: [2], nail: [3] },
  'coat-hooks': { rail: [0], hooks: [1, 2, 3], bag: [4, 5] },
  doormat: { door: [0] },
  'garage-open': { roof: [0], walls: [1], door: [2, 3] },
  'room-plus': { walls: [0], door: [1], swing: [2] },
  'casement-window': { frame: [0, 2], sill: [1], sash: [3] },
  'door-sliding': { panel: [0], floor: [1] },
  'barn-door': { rail: [0], rollers: [1, 2], door: [3, 4, 5] },
  'door-handle': { plate: [0], keyhole: [1, 2] },
  fireplace: { mantel: [0], body: [1, 2], flame: [3] },
  'wood-stove': { flue: [0], stove: [1], flame: [2], legs: [3, 4] },
  'fire-pit': { bowl: [0], legs: [1, 2], flames: [3, 4, 5] },
  'roof-leak': { roof: [0], crack: [1], drop: [2] },
  'rain-gutter': { roof: [0], gutter: [1], downspout: [2], drop: [3] },
  'hot-tub': { tub: [0], water: [1], steam: [2, 3] },
  shower: { pipe: [0], head: [1], water: [2, 3, 4] },
  'water-damage': { roof: [0], walls: [1], water: [2], drop: [3] },
  'view-in-room': { frame: [0, 1, 2, 3], chair: [4, 5, 6, 7], floor: [8] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
const MOTION = {
  // The rocker rocks on the floor; the footrest lifts on its linkage
  'rocking-chair': { effect: 'wiggle', origin: [12, 21] },
  recliner: { effect: 'wiggle', parts: ['footrest'], origin: [16, 16.25] },
  // The wall bed folds back up toward its cabinet on its hinge
  'wall-bed': { effect: 'wiggle', parts: ['bed'], origin: [8.75, 16.75] },
  'sofa-bed': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
  // Light: the rays pulse; hanging lights swing from the ceiling; flames flicker on their base
  'lamp-on': { effect: 'beat', parts: ['rays'], origin: [12, 12] },
  'lamp-pendant': { effect: 'ring', parts: ['cord', 'shade', 'bulb'], origin: [12, 2.75] },
  chandelier: { effect: 'ring', origin: [12, 2.75] },
  'string-lights': { effect: 'ring', parts: ['bulbs'], origin: [12, 8] },
  candle: { effect: 'wiggle', parts: ['flame'], origin: [12, 8.75] },
  fireplace: { effect: 'wiggle', parts: ['flame'], origin: [12, 20.75] },
  'wood-stove': { effect: 'wiggle', parts: ['flame'], origin: [12, 16] },
  'fire-pit': { effect: 'wiggle', parts: ['flames'], origin: [12, 10] },
  // Hung from a nail, they swing
  'wall-art': { effect: 'ring', parts: ['frame', 'wire'], origin: [12, 3.25] },
  'coat-hooks': { effect: 'ring', parts: ['bag'], origin: [16.5, 9.25] },
  // Doors and windows move as they open
  'door-sliding': { effect: 'slide', parts: ['badge'], vector: [-2, 0] },
  'barn-door': { effect: 'slide', parts: ['rollers', 'door'], vector: [-1.5, 0] },
  'casement-window': { effect: 'wiggle', parts: ['sash'], origin: [14.75, 11] },
  'door-handle': { effect: 'wiggle', parts: ['badge'], origin: [12, 9.5] },
  // Water falls; smoke and steam rise; the flood's wave moves
  'roof-leak': { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
  'rain-gutter': { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
  shower: { effect: 'slide', parts: ['water'], vector: [0.4, 1.5] },
  'hot-tub': { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  'water-damage': { effect: 'float', parts: ['water'], vector: [1.5, 0] },
  'view-in-room': { effect: 'bounce', parts: ['chair'], vector: [0, -1.5] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Mirroring (right to left) ─────────────────────────────────────────────────────────────────
// Furniture and fixtures are objects with a fixed side; only the stairs read as rising, like a chart.
icons.stairs.mirror = true;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// The scan frame already encloses the armchair
icons['view-in-room'].variants = { circle: false, square: false };

export default { category: 'hogar', label: 'Hogar y muebles', icons };
