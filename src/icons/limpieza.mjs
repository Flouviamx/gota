// Cleaning and laundry: brooms, mops, buckets, sprays, sponges and brushes, gloves and cloths,
// detergents, trash bags, laundry baskets, clothespins and ironing, the garment care symbols,
// stains and pest control. Everything is computed with the engine (engine/geometry.mjs) and the
// rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a square bottom-right corner on
// containers. Families share one base: the broom, the laundry basket and the stain carry the
// engine's badges; the care symbols are one grid (the same tub, square, triangle and iron, the
// temperatures as dots 4.5 apart). The house is lugares' and the shirt comercio's; a piece on top of
// another (a leaf, a broom, a brush, a hand, a wipe, a bubble) is a custom badge and the engine
// clears what it covers. The leaning ones carry their own 16 px drawing (at the end).
import { arc, badge, circ, dot, f, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import lugares from './lugares.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const SQ = { square: ['br'] };

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
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
    const S = add(V, mul(u, t));
    const E = add(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** A frame: maps local points (x across, y along an axis pointing up as -y) to the canvas. */
const frame = (origin, deg) => (p) => add(origin, rot(p, [0, 0], deg));

/** Smooth closed curve through points (Catmull-Rom as cubics): blobs, stains, puddles. */
function smooth(P, tension = 1) {
  const n = P.length;
  let s = `M${pt(P[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [P[(i - 1 + n) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]];
    const c1 = add(p1, mul(sub(p2, p0), tension / 6));
    const c2 = sub(p2, mul(sub(p3, p1), tension / 6));
    s += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return `${s}Z`;
}
/** Smooth open curve through points. */
function smoothOpen(P, tension = 1) {
  const n = P.length;
  let s = `M${pt(P[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(n - 1, i + 2)]];
    const c1 = add(p1, mul(sub(p2, p0), tension / 6));
    const c2 = sub(p2, mul(sub(p3, p1), tension / 6));
    s += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return s;
}

// ── Badges and custom pieces in the badge's place ─────────────────────────────────────────────
// Center (17.25, 17.25), circle of r 4.25, as the engine's badges; `knock` is the area the engine
// clears with a clearance of paper.
const BC = [17.25, 17.25];
/** The ring drawn clockwise, for cleared areas (filled nonzero, as logistica's). */
const clockwise = ([cx, cy], r) => `M${pt([cx - r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx + r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx - r, cy])}Z`;
const RING_K = clockwise(BC, 4.25);
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/** The set's liquid drop (lugares' droplet): the logomark's drop with its square corner up. */
function droplet([cx, cy], r) {
  const a = polar(cx, cy, r, -45);
  const b = polar(cx, cy, r, -135);
  return `M${pt(a)}A${f(r)} ${f(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
}

// Lugares' leaf, small, at the badge's place (as logistica's parcel-leaf): a lens at 45° and its
// stalk toward the upper right.
const LEAF = (() => {
  const [A, B] = [
    [14.25, 20.25],
    [20.25, 14.25],
  ];
  const lens = `M${pt(A)}A5.12 5.12 0 0 1 ${pt(B)}A5.12 5.12 0 0 1 ${pt(A)}Z`;
  const stalk = line(B, [21.5, 13]);
  return own([lens, stalk], `${RING_K}${stalk}`, { solid: [lens], wire: [stalk] });
})();

// ── Brooms ────────────────────────────────────────────────────────────────────────────────────
// The broom leans at 45°, its handle to the upper right and its head at the lower left: the head
// flares from its neck to the bristles' edge, a band binds it 3.5 below the neck and two short
// bristle lines rise from the edge. A badge hides the head's upper right corner; every inner line
// ends well clear of the badge's cleared area, so the cut is the same at every weight.
const BROOM = (() => {
  const P = frame([6.3, 16.55], 45);
  const [hw, nw, nh, bandY] = [5.5, 2.5, 9.25, -5.75];
  const at = (y) => nw + ((hw - nw) * (nh + y)) / nh;
  const head = roundpoly([P([-hw, 0]), P([hw, 0]), P([nw, -nh]), P([-nw, -nh])], [1.4, 1.4, 0.9, 0.9]);
  const band = line(P([-at(bandY) - 0.5, bandY]), P([at(bandY) + 0.5, bandY]));
  const handle = line(P([0, -nh]), P([0, -19.25]));
  const bristles = [-1, 1].map((k) => line(P([k * 1.75, -2.75]), P([k * 2.1, 0])));
  return { d: [handle, head, band, ...bristles], P };
})();
const BROOM_FILL = { solid: [BROOM.d[1]], cut: [BROOM.d[2], BROOM.d[3], BROOM.d[4]], wire: [BROOM.d[0]] };
const BROOM_PARTS = { handle: [0], head: [1, 2, 3, 4] };

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {
  broom: { tags: ['escoba', 'barrer', 'limpiar', 'aseo', 'broom', 'sweep', 'clean up'], d: BROOM.d },
  'broom-check': { tags: ['limpieza terminada', 'cuarto limpio', 'visita completada', 'cleaning done', 'room cleaned'], d: BROOM.d, badge: badge('check') },
  'broom-clock': { tags: ['limpieza programada', 'limpieza pendiente', 'próxima visita', 'scheduled cleaning', 'turnover'], d: BROOM.d, badge: badge('clock') },
  'broom-alert': { tags: ['requiere limpieza', 'cuarto sucio', 'limpieza atrasada', 'needs cleaning', 'dirty room'], d: BROOM.d, badge: badge('alert') },
  'broom-plus': { tags: ['agendar limpieza', 'nueva limpieza', 'agregar tarea', 'book cleaning', 'add cleaning'], d: BROOM.d, badge: badge('plus') },
  'broom-sync': { tags: ['limpieza recurrente', 'limpieza semanal', 'plan de limpieza', 'recurring cleaning', 'weekly cleaning'], d: BROOM.d, badge: badge('sync') },
};

// Push broom: the handle comes down to the middle of a wide bar, and a row of short bristles hangs
// from the bar (a T, not a fan).
{
  const bar = capsule(2.75, 13, 18.5, 3.25);
  const handle = line([12, 13], [18.5, 2.75]);
  const ticks = [5.25, 8.75, 12.25, 15.75, 19.25].map((x) => line([x - 0.5, 16.25], [x - 0.5, 20.25]));
  icons['push-broom'] = { tags: ['cepillo de piso', 'barrer', 'limpieza comercial', 'conserje', 'push broom', 'floor sweeping'], d: [handle, bar, ...ticks] };
}

// Dustpan: a wide scoop seen from above, its mouth (the long edge) at the bottom and its short
// handle rising from the back; the hand brush lies across the mouth in front of it, a piece on top
// that the engine clears the scoop around.
{
  const pan = roundpoly([[2.75, 16.75], [6, 7.5], [15.5, 7.5], [18.75, 16.75]], [1.25, 2, 2, 1.25]);
  const back = line([5.15, 10.25], [16.35, 10.25]);
  const handle = roundline([[9.25, 7.5], [9.25, 2.75], [12.25, 2.75], [12.25, 7.5]], [0, 1.25, 1.25, 0]);
  const P = frame([15.25, 15.5], -35);
  const brushBack = roundpoly([P([-6.5, -1.5]), P([5.5, -1.5]), P([5.5, 1.5]), P([-6.5, 1.5])], 1.4);
  const bristles = [-4.5, -1.5, 1.5, 4.5].map((x) => line(P([x, 1.5]), P([x, 4.25])));
  const brush = [brushBack, ...bristles];
  icons.dustpan = {
    tags: ['recogedor', 'pala', 'barrer migas', 'recoger', 'dustpan', 'sweep up'],
    d: [pan, back, handle],
    badge: own(brush, `${brushBack}${bristles.join('')}`, { solid: [brushBack], wire: bristles }),
  };
}

// Mop: the handle comes down at 45° into a collar; the strands splay out of it in loose curves and
// lie on the floor line.
{
  const C = [9.75, 11.75];
  const handle = line(C, [20.25, 2.75]);
  const collar = roundpoly([[6.75, 11.75], [12.75, 11.75], [11.75, 14.5], [7.75, 14.5]], 0.8);
  const floor = line([2.75, 20.75], [17.25, 20.75]);
  const strand = (x0, x1, bend) => `M${pt([x0, 14.5])}C${pt([x0 + bend, 16.75])} ${pt([x1 - bend * 0.6, 18.25])} ${pt([x1, 20.75])}`;
  const strands = [strand(8, 3.5, -2.75), strand(9.25, 7.5, -1.25), strand(10.5, 11.75, 0.75), strand(11.75, 16, 2.75)];
  icons.mop = { tags: ['trapeador', 'fregona', 'trapear', 'limpiar el piso', 'mop', 'mopping'], d: [handle, collar, ...strands, floor] };
}

// Flat mop: the handle comes down at 45° to a small yoke on a long, thin pad lying on the floor.
{
  const pad = capsule(2.75, 17.5, 18.5, 3.25);
  const yoke = roundline([[9.75, 17.5], [9.75, 14.5], [14.25, 14.5], [14.25, 17.5]], [0, 1.25, 1.25, 0]);
  const handle = line([12, 14.5], [19.5, 2.75]);
  icons['mop-flat'] = { tags: ['mopa plana', 'trapeador de microfibra', 'pisos duros', 'flat mop', 'microfiber mop'], d: [handle, yoke, pad] };
}

// Mop bucket: the janitor's wide, low bucket (bucket's rolled rim and tapered body), the wringer's box
// standing on its rim at the left and the mop's long handle leaning out of it toward the upper right.
{
  const rim = capsule(2.75, 11, 16, 3);
  const body = roundline([[4, 14], [5.25, 21.25], [16.5, 21.25], [17.75, 14]], [0, 2, 2, 0]);
  const wringer = roundline([[4.75, 11], [4.75, 7.5], [10.25, 7.5], [10.25, 11]], [0, 1, 1, 0]);
  const handle = line([13.75, 11], [19.75, 2.75]);
  icons['mop-bucket'] = { tags: ['cubeta con exprimidor', 'carrito de limpieza', 'conserjería', 'mop bucket', 'janitorial'], d: [body, rim, wringer, handle] };
}

// Bucket: a tapered pail under a rolled rim, the wire bail arching over it from the rim's ends.
const BUCKET = (() => {
  const rim = capsule(3.75, 8.5, 16.5, 3);
  const body = roundline([[5.25, 11.5], [6.75, 20.75], [17.25, 20.75], [18.75, 11.5]], [0, 2.25, 2.25, 0]);
  const bail = `M5.25 8.5A6.75 5.75 0 0 1 18.75 8.5`;
  return [body, rim, bail];
})();
icons.bucket = { tags: ['cubeta', 'balde', 'cubo', 'agua', 'bucket', 'pail'], d: BUCKET };

// Spray bottle: the body, its neck, the trigger head with the nozzle pointing right, the trigger
// lever under the head and three mist dots fanning from the nozzle.
const SPRAY = (() => {
  const body = sq(3.75, 12, 9.75, 9.25, 2.75);
  const neck = line([6.25, 12], [6.25, 9], [11, 9], [11, 12]);
  const headP = roundpoly([[5.25, 9], [5.25, 5.25], [7.5, 3], [15, 3], [15, 6.25], [11.75, 6.25], [11.75, 9]], [0.6, 1.25, 1, 0.75, 0.75, 0.75, 0.6]);
  const lever = `M13.25 6.25Q13.75 8 14.5 9.5`;
  const mist = [dot(18.25, 3.25), dot(20.75, 6.5), dot(18.25, 9.75)];
  return { d: [body, neck, headP, lever, ...mist], body, neck, head: headP, lever, mist };
})();
icons['spray-bottle'] = { tags: ['atomizador', 'rociador', 'limpiador', 'producto de limpieza', 'spray bottle', 'cleaner'], d: SPRAY.d };
icons['spray-bottle-leaf'] = { tags: ['limpieza ecológica', 'productos verdes', 'no tóxico', 'eco cleaning', 'green cleaning'], d: SPRAY.d.slice(0, 4), badge: LEAF };

// Spray can: a cylinder whose shoulder is a dome, the actuator cap on top and a puff of mist dots.
{
  const body = roundline([[6.25, 11.75], [6.25, 21.25], [15.75, 21.25], [15.75, 11.75]], [0, 1.75, 1.75, 0]);
  const dome = `M6.25 11.75A4.75 3 0 0 1 15.75 11.75Z`;
  const cap = roundline([[9.25, 8.86], [9.25, 5.75], [12.75, 5.75], [12.75, 8.86]], [0, 0.9, 0.9, 0]);
  const mist = [dot(16.75, 3.5), dot(20.5, 5), dot(17.5, 7.75)];
  icons['spray-can'] = { tags: ['aerosol', 'insecticida', 'aromatizante', 'desinfectante', 'spray can', 'aerosol can'], d: [body, dome, cap, ...mist] };
}

// Pump sprayer: a capsule tank, the pump's T handle on top, and the hose running from its foot to
// the wand, which rises to the right and bends at its tip into the nozzle.
{
  const tank = capsule(3.25, 7.75, 9, 13.5);
  const pump = [line([7.75, 7.75], [7.75, 3.5]), line([5.25, 3.5], [10.25, 3.5])];
  const hose = `M12.25 18C15.5 18 16.5 17 16.5 14.5`;
  const wand = roundline([[16.5, 14.5], [16.5, 4.5], [20.25, 2.75]], [0, 1.5, 0]);
  const grip = capsule(15, 9, 3, 4.75);
  icons['pump-sprayer'] = { tags: ['fumigadora', 'aspersora', 'control de plagas', 'fumigación', 'pump sprayer', 'pest control'], d: [tank, ...pump, hose, wand, grip] };
}

// Sponge: a rounded block lying at a slight tilt, the scrubber layer along its top behind a wavy seam
// that runs from side to side, and three pores in the soft part (a ring and two dots).
{
  const P = frame([12, 12.25], -12);
  const body = roundpoly([P([-8, -6]), P([8, -6]), P([8, 6]), P([-8, 6])], 3);
  const seam = smoothOpen([-8, -5.33, -2.67, 0, 2.67, 5.33, 8].map((x, i) => P([x, -2.25 + (i % 2 ? 0.55 : -0.55) * (i && i < 6 ? 1 : 0)])));
  icons.sponge = { tags: ['esponja', 'tallar', 'lavar trastes', 'fregar', 'sponge', 'scrub'], d: [body, seam, circ(...P([-3.5, 2]), 1.5), dot(...P([1.75, 1])), dot(...P([4, 3.5]))] };
}

// Scrub brush: the back is a long rounded block with a grip arching over it (the finger groove is
// its hole), and a row of short bristles stands under it.
{
  const back = sq(2.75, 9.75, 18.5, 4.5, 2.25);
  const grip = roundline([[7.25, 9.75], [8.25, 5.25], [15.75, 5.25], [16.75, 9.75]], [0, 2, 2, 0]);
  const bristles = [4.75, 8.25, 11.75, 15.25, 18.75].map((x) => line([x + 0.25, 14.25], [x + 0.25, 18.25]));
  icons['scrub-brush'] = { tags: ['cepillo', 'tallar', 'azulejo', 'juntas', 'scrub brush', 'scrubbing'], d: [back, grip, ...bristles] };
}

// Feather duster: leaning to the right, a short handle and its collar, and the feathers fanning out
// of it to three round tips on one circle; two quills run up to the notches between the tips,
// starting where the fan has opened enough to keep them 3 apart.
{
  const P = frame([10.75, 16.5], 18);
  const O = [0, -1];
  const at = (deg, r) => polar(...O, r, deg - 90);
  const [L, C1, C2, R] = [-48, -16, 16, 48].map((a) => P(at(a, 10)));
  const lobe = `A2.9 2.9 0 0 1`;
  const fan = `M${pt(P([-2, -2.75]))}L${pt(L)}${lobe} ${pt(C1)}${lobe} ${pt(C2)}${lobe} ${pt(R)}L${pt(P([2, -2.75]))}Z`;
  const collar = roundpoly([P([-2, -2.75]), P([2, -2.75]), P([1.5, 0]), P([-1.5, 0])], [0.3, 0.3, 0.6, 0.6]);
  const handle = line(P([0, 0]), P([0, 4.5]));
  const quills = [-16, 16].map((a) => line(P(at(a, 5.75)), P(at(a, 10))));
  icons['feather-duster'] = { tags: ['plumero', 'sacudidor', 'quitar el polvo', 'sacudir', 'feather duster', 'dusting'], d: [fan, ...quills, collar, handle] };
}

// Squeegee: the blade's holder on its rubber edge and the handle rising from its middle, tilted, and
// two of the set's drops on the glass ahead of it.
{
  const C = [10.75, 15.5];
  const P = frame(C, -20);
  const holder = roundline([P([-6.75, 0]), P([-6.75, -3]), P([6.75, -3]), P([6.75, 0])], [0, 1, 1, 0]);
  const rubber = line(P([-7.75, 0]), P([7.75, 0]));
  const handle = line(P([0, -3]), P([0, -11]));
  icons.squeegee = { tags: ['jalador', 'limpiavidrios', 'limpiar ventanas', 'cristales', 'squeegee', 'window cleaning'], d: [rubber, holder, handle, droplet([14.5, 4.5], 1.6), droplet([20, 7.25], 1.6)] };
}

// Rubber glove: the four fingers side by side, 3.25 wide with round tips at staggered heights, told
// apart by three seams from the notches between their tips down to the palm (cocina's oven mitt is
// the hand without fingers); the thumb leans out to the left and a long cuff flares to a rolled band.
const GLOVE = (() => {
  const [h, xs, tops] = [1.625, [6.5, 9.75, 13, 16.25, 19.5], [3.75, 2.75, 3.25, 5]];
  const cy = tops.map((t) => t + h);
  const T = [4.6, 8.85];
  const u = unit([-0.6, -0.8]);
  const n = [-u[1], u[0]];
  const up = add(T, mul(n, h));
  const lo = sub(T, mul(n, h));
  const crotch = [xs[0], up[1] + ((xs[0] - up[0]) / -u[0]) * -u[1]];
  const wristL = add(lo, mul(u, -5.4));
  const fingers = [0, 1, 2, 3].flatMap((i) => [[xs[i], tops[i]], [xs[i + 1], tops[i]], ...(i < 3 ? [[xs[i + 1], Math.max(cy[i], cy[i + 1])]] : [])]);
  const pts = [[5.5, 21.25], wristL, add(lo, mul(u, h)), add(up, mul(u, h)), crotch, ...fingers, [19.5, 9.75], [17.75, 13.5], [19, 21.25]];
  const rr = [1, 0.75, h, h, 0.5, h, h, 0, h, h, 0, h, h, 0, h, h, 2, 0.75, 1];
  const glove = roundpoly(pts, rr);
  const seams = [1, 2, 3].map((i) => line([xs[i], Math.max(cy[i - 1], cy[i])], [xs[i], 9]));
  const cuffAt = (y, side) => (side < 0 ? lerp(wristL, [5.5, 21.25], (y - wristL[1]) / (21.25 - wristL[1]))[0] : lerp([17.75, 13.5], [19, 21.25], (y - 13.5) / 7.75)[0]);
  const band = line([cuffAt(18.5, -1), 18.5], [cuffAt(18.5, 1), 18.5]);
  return { glove, seams, band };
})();
icons['rubber-glove'] = { tags: ['guante de hule', 'guante de limpieza', 'lavar trastes', 'protección', 'rubber glove', 'cleaning glove'], d: [GLOVE.glove, ...GLOVE.seams, GLOVE.band] };

// Cleaning cloth: a square cloth with its lower left corner folded over and a stitched hem running
// along its top and right sides.
{
  const cloth = roundpoly([[3.25, 3.25], [20.75, 3.25], [20.75, 20.75], [11.75, 20.75], [3.25, 12.25]], [2.75, 2.75, 2.75, 0.6, 0.6]);
  const flap = roundpoly([[3.25, 12.25], [11.75, 20.75], [11.75, 12.25]], [0.6, 0.6, 1.5]);
  const [k, c] = [6.25, 17.75];
  const hem = [line([c - 1.15, k], [c, k], [c, k + 1.15]), line([11.35, k], [13.6, k]), line([6.1, k], [8.35, k]), line([c, 10.4], [c, 12.65]), line([c, 15.65], [c, 17.9])];
  icons['cleaning-cloth'] = { tags: ['paño', 'trapo', 'microfibra', 'limpiar superficies', 'cleaning cloth', 'microfiber cloth'], d: [cloth, flap, ...hem] };
}

// Paper towel: a standing roll seen a little from above (its top an ellipse) and its loose end
// unrolled sideways from its right side, the whole height of the roll, its free edge waving and a
// perforation across it.
{
  const [cx, rx, ry, top, bot] = [8, 4.75, 1.75, 5, 19.25];
  const rim = `M${pt([cx - rx, top])}A${rx} ${ry} 0 1 0 ${pt([cx + rx, top])}A${rx} ${ry} 0 1 0 ${pt([cx - rx, top])}Z`;
  const body = `M${pt([cx - rx, top])}V${f(bot)}A${rx} ${ry} 0 0 0 ${pt([cx + rx, bot])}V${f(top)}`;
  const sheet = `M${pt([cx + rx, 6.75])}L20.75 5.5C20 8 21.5 10.5 20.75 13C20 15.5 21.5 17.5 20.75 19.75L${pt([cx + rx, bot])}`;
  const perf = line([16.75, 6.13], [16.75, 19.5]);
  icons['paper-towel'] = { tags: ['toallas de papel', 'rollo de cocina', 'derrame', 'paper towel', 'kitchen roll'], d: [body, rim, sheet, perf] };
}

// Disinfecting wipes: a round canister seen a little from above (its lid a band under the top's
// ellipse, as the paper towel's roll) and one wipe pulled up through the slot in the middle, a sheet
// widening to a waving edge; the wipe is a piece on top, so the engine clears the top's far edge
// around it. Squat and frontal, with a capsule lid, it read as a jar or a gift with a bow.
{
  const top = 'M5.75 9A6.25 2.25 0 1 0 18.25 9A6.25 2.25 0 1 0 5.75 9Z';
  const body = 'M5.75 9V18.75A6.25 2.25 0 0 0 18.25 18.75V9';
  const lidEdge = 'M5.75 12.75A6.25 2.25 0 0 0 18.25 12.75';
  const wipe = 'M10.75 9.25L9.25 4C10.5 2.75 11.5 4.25 12.75 3.5C13.75 2.9 14.5 2.85 15.25 3.25L13.25 9.25Z';
  icons['disinfecting-wipes'] = {
    tags: ['toallitas desinfectantes', 'sanitizar', 'desinfectar superficies', 'disinfecting wipes', 'sanitizing'],
    d: [body, top, lidEdge],
    badge: own([wipe], wipe, { solid: [wipe] }),
  };
}

// Cleaning caddy: a low tote, its tall handle rising at the left and a spray bottle standing in it at
// the right (the spray bottle's head with its nozzle and trigger). A post with a grip, a capped bottle
// and a second head made seven small pieces that read as a lamp on a tray.
{
  const tote = roundpoly([[2.75, 14.5], [21.25, 14.5], [19.75, 21.25], [4.25, 21.25]], [0.9, 0.9, 2, 2]);
  // The handle's corners take 1.5 (at 2 its inner top shrank to a point and the weights stopped
  // interpolating); the nozzle is 3.25 tall, as the spray bottle's, and the trigger ends 2.85 clear
  // of the head, so the notch under the nozzle never closes at bold
  const handle = roundline([[5.25, 14.5], [5.25, 4.25], [10.25, 4.25], [10.25, 14.5]], [0, 1.5, 1.5, 0]);
  const neck = line([14.75, 14.5], [14.75, 12], [18, 12], [18, 14.5]);
  const head = roundpoly([[13.25, 12], [13.25, 8], [15, 6.25], [21, 6.25], [21, 9.5], [18.75, 9.5], [18.75, 12]], [0.5, 1, 0.75, 0.6, 0.6, 0.6, 0.5]);
  const lever = 'M19.75 9.5Q20.1 10.6 21.6 11.1';
  icons['cleaning-caddy'] = { tags: ['caddy de limpieza', 'kit de limpieza', 'insumos', 'productos', 'cleaning caddy', 'cleaning supplies'], d: [tote, handle, neck, head, lever] };
}

// Wet floor sign: the yellow A-frame seen from the front, tapering to a top half its foot's width,
// its handle a slot cut through the top, standing on two short feet, with the set's drop on its board.
{
  const board = roundpoly([[8.25, 2.75], [15.75, 2.75], [20.5, 21.25], [17.75, 21.25], [17.5, 19.75], [6.5, 19.75], [6.25, 21.25], [3.5, 21.25]], [2, 2, 0.6, 0.6, 0.5, 0.5, 0.6, 0.6]);
  const slot = line([10.5, 6], [13.5, 6]);
  icons['wet-floor-sign'] = { tags: ['piso mojado', 'precaución', 'resbaloso', 'letrero', 'wet floor', 'caution sign'], d: [board, slot, droplet([12, 13.75], 2.5)] };
}

// House cleaning: lugares' house with a broom crossing its lower right corner, a piece on top that
// the engine clears the house around.
const HOUSE = lugares.icons.house.d;
{
  const P = frame([15.6, 19.65], 45);
  const head = roundpoly([P([-2.5, 0]), P([2.5, 0]), P([1.25, -4.5]), P([-1.25, -4.5])], [0.75, 0.75, 0.5, 0.5]);
  const band = line(P([-2.2, -1.75]), P([2.2, -1.75]));
  const handle = line(P([0, -4.5]), P([0, -8.75]));
  // The head lies inside the badges' ring, so the house is cleared as under its badges (house-check)
  // plus the handle that reaches past the ring
  icons['house-cleaning'] = {
    tags: ['limpieza del hogar', 'servicio de limpieza', 'aseo', 'empleada doméstica', 'house cleaning', 'maid service'],
    d: HOUSE,
    badge: own([handle, head, band], `${RING_K}${handle}`, { solid: [head], cut: [band], wire: [handle] }),
  };
}

// Trash bag: a rounded sack gathered at the neck, the knot and its two ears on top, round loops
// leaning out (pointed ones read as a turnip's leaves).
const TRASH_BAG = (() => {
  const body = 'M10.5 9.75C6.25 11 4 13.5 4 16.75C4 19.75 6.5 21.25 12 21.25C17.5 21.25 20 19.75 20 16.75C20 13.5 17.75 11 13.5 9.75Z';
  const knot = capsule(9.75, 6.75, 4.5, 3);
  const ears = [
    roundpoly([[11.1, 6.75], [5.25, 5.75], [7, 2.75]], [0.35, 1.6, 1.6]),
    roundpoly([[12.9, 6.75], [18.75, 5.75], [17, 2.75]], [0.35, 1.6, 1.6]),
  ];
  return [body, knot, ...ears];
})();
icons['trash-bag'] = { tags: ['bolsa de basura', 'sacar la basura', 'recolección', 'trash bag', 'garbage bag'], d: TRASH_BAG };
icons['trash-bag-clock'] = { tags: ['día de recolección', 'horario de basura', 'camión de basura', 'trash pickup', 'garbage day'], d: TRASH_BAG, badge: badge('clock') };

// Dumpster seen from the side: the body's front slopes in toward its foot, the lid slopes down from
// the back, a lift pocket runs along the side and two wheels stand under it.
{
  const body = roundpoly([[2.75, 9.25], [21.25, 7], [19.25, 18.75], [4.75, 18.75]], [0.9, 0.9, 1.75, 1.75]);
  const lid = roundpoly([[2.75, 9.25], [3.25, 6.25], [20.75, 4], [21.25, 7]], [0.9, 0.75, 0.75, 0.9]);
  const pocket = sq(8.75, 12, 6.5, 3, 1.25);
  const wheels = [circ(7.75, 20.25, 1.5), circ(16.25, 20.25, 1.5)];
  icons.dumpster = { tags: ['contenedor', 'volteo', 'retiro de escombro', 'basura voluminosa', 'dumpster', 'junk removal'], d: [body, lid, pocket, ...wheels] };
}

// Dish rack: a low tray with three plates standing in its slots, face on and staggered: the front
// plate whole above the tray, the two behind it showing their left edges (each stopped 1.5 short of
// the one in front).
{
  const top = 15;
  const R = 5;
  const cs = [[7.25, 11.5], [11.5, 11], [15.75, 10.5]];
  const cut = (c) => (Math.asin((top - c[1]) / R) * 180) / Math.PI;
  const plates = cs.map((c, i) => {
    const a0 = 180 - cut(c);
    if (i === cs.length - 1) return arc(...c, R, a0, 360 + cut(c)).d;
    const next = cs[i + 1];
    let a1 = a0;
    while (a1 < a0 + 360 && len(sub(polar(...c, R, a1 + 1), next)) > R + 3) a1 += 1;
    return arc(...c, R, a0, a1).d;
  });
  const tray = roundpoly([[2.75, top], [21.25, top], [19.75, 20.75], [4.25, 20.75]], [0.9, 0.9, 1.75, 1.75]);
  icons['dish-rack'] = { tags: ['escurridor', 'escurreplatos', 'lavar platos', 'trastes', 'dish rack', 'drying rack'], d: [tray, ...plates] };
}

// Dish soap: a slim squeeze bottle with its push-pull cap, and two small bubbles beside it.
{
  const bottle = roundpoly([[4.25, 21.25], [4.25, 11.5], [6.25, 8.75], [10, 8.75], [12, 11.5], [12, 21.25]], [1.75, 1.5, 1, 1, 1.5, 1.75]);
  const cap = roundline([[6.5, 8.75], [6.5, 6], [9.75, 6], [9.75, 8.75]], [0, 0.75, 0.75, 0]);
  const tip = line([8.125, 6], [8.125, 3.25]);
  icons['dish-soap'] = { tags: ['jabón para trastes', 'lavaplatos', 'detergente líquido', 'dish soap', 'dishwashing liquid'], d: [bottle, cap, tip, circ(18, 8.25, 2.75), circ(17.25, 16.25, 1.75)] };
}

// Detergent: a wide jug, its handle built into the top right (a slot through it), the spout under a
// measuring cap at the top left.
const JUG = (() => {
  const body = roundpoly([[3.25, 21.25], [3.25, 10.25], [5.75, 7.5], [11.5, 7.5], [13, 3.25], [20.75, 3.25], [20.75, 21.25]], [2, 2.25, 1, 1, 1.5, 3, 2]);
  const slot = capsule(14.5, 6.25, 3.5, 3);
  const cap = roundline([[5.5, 7.5], [6, 4.5], [9.5, 4.5], [10, 7.5]], [0, 0.75, 0.75, 0]);
  return [body, slot, cap];
})();
icons.detergent = { tags: ['detergente', 'jabón líquido', 'lavar ropa', 'suavizante', 'detergent', 'laundry detergent'], d: JUG };
icons['detergent-alert'] = { tags: ['poco detergente', 'recargar', 'dosificación', 'low detergent', 'refill'], d: JUG, badge: badge('alert') };

// Washing powder: a box (the signature corner) with its top flap open and leaning back, the powder
// heaped in its mouth beside the flap and the scoop's handle standing out of the heap. Three grains
// in its place read as bubbles over a folder.
{
  const box = sq(4.25, 10.75, 15.5, 10.5, 2.5, SQ);
  const flap = roundline([[4.25, 10.75], [2.75, 5.25], [7.75, 5.25], [9.25, 10.75]], [0, 1, 1, 0]);
  const heap = 'M12.25 10.75C12.75 8.75 13.75 7.75 15.25 7.75C16.75 7.75 17.75 8.75 18.25 10.75';
  const scoop = line([16.9, 8.4], [20.5, 4.5]);
  icons['washing-powder'] = { tags: ['detergente en polvo', 'jabón en polvo', 'lavar ropa', 'washing powder', 'powder detergent'], d: [box, flap, heap, scoop] };
}

// Plunger: a rubber dome standing on the floor line, its straight handle rising from the top.
{
  const cup = 'M4.75 19.75C4.75 15 8 12.25 12 12.25C16 12.25 19.25 15 19.25 19.75';
  const floor = line([2.75, 19.75], [21.25, 19.75]);
  const handle = line([12, 12.25], [12, 2.75]);
  icons.plunger = { tags: ['destapador', 'chupón', 'destapar baño', 'plomería', 'plunger', 'unclog'], d: [cup, floor, handle] };
}

// ── Laundry ──────────────────────────────────────────────────────────────────────────────────
// Laundry basket: a wide tapered basket, its rim band, and the laundry heaped over the rim in three
// soft folds, their notches 3.5 above the rim (closer, the gap under them opens and closes with the
// weight); the lower right stays plain for the badges. Filled, basket and laundry are one silhouette:
// a cut along the rim or the band would leave a sliver between the badges' clearance and the wall.
const BASKET = (() => {
  const [x0, x1, rim, bot] = [2.75, 21.25, 10.25, 21];
  const wall = (y, side) => (side < 0 ? x0 + (2 * (y - rim)) / (bot - rim) : x1 - (2 * (y - rim)) / (bot - rim));
  const body = roundline([[x0, rim], [4.75, bot], [19.25, bot], [x1, rim]], [0, 2.25, 2.25, 0]);
  const top = line([x0, rim], [x1, rim]);
  const band = line([wall(13.25, -1), 13.25], [wall(13.25, 1), 13.25]);
  const heap = `M4.5 ${f(rim)}A3 3 0 0 1 8.75 ${f(rim - 3.5)}A3.25 3.25 0 0 1 15.25 ${f(rim - 3.5)}A3 3 0 0 1 19.5 ${f(rim)}`;
  return [body, top, band, heap];
})();
icons['laundry-basket'] = { tags: ['canasta de ropa', 'cesto', 'lavar ropa', 'lavandería', 'laundry basket', 'wash and fold'], d: BASKET };
icons['laundry-basket-check'] = { tags: ['ropa lista', 'pedido entregado', 'lavada y doblada', 'laundry done', 'order delivered'], d: BASKET, badge: badge('check') };
icons['laundry-basket-clock'] = { tags: ['recolección de ropa', 'lavandería en proceso', 'recoger ropa', 'laundry pickup', 'in progress'], d: BASKET, badge: badge('clock') };

// Laundry hamper: a tall tub with softly bowed sides under its lid and knob, woven in horizontal
// bands.
{
  const tub = 'M5.25 8.75H18.75C19 13.5 18.75 17.5 18 19.5C17.75 20.75 17 21.25 15.75 21.25H8.25C7 21.25 6.25 20.75 6 19.5C5.25 17.5 5 13.5 5.25 8.75Z';
  const lid = sq(4, 5, 16, 3.75, 1.75);
  const knob = roundline([[10.25, 5], [10.25, 2.75], [13.75, 2.75], [13.75, 5]], [0, 1, 1, 0]);
  const bands = [line([5.15, 12.75], [18.85, 12.75]), line([5.4, 16.75], [18.6, 16.75])];
  icons['laundry-hamper'] = { tags: ['cesto de ropa sucia', 'ropa sucia', 'canasto', 'hotel', 'laundry hamper', 'dirty clothes'], d: [tub, lid, knob, ...bands] };
}

// Clothespin: the two long jaws side by side, leaning, the coiled spring a small circle across them;
// the press end splits in a V where the jaws part and the gripping end narrows.
{
  const P = frame([12, 12.25], 35);
  const outline = roundpoly([P([-3.25, -9.75]), P([-1.1, -9.75]), P([0, -6.75]), P([1.1, -9.75]), P([3.25, -9.75]), P([2.25, 9.5]), P([-2.25, 9.5])], [1.4, 0.4, 0, 0.4, 1.4, 1.6, 1.6]);
  const spring = circ(...P([0, -1.75]), 2);
  const splitA = line(P([0, -6.75]), P([0, -3.75]));
  const splitB = line(P([0, 0.25]), P([0, 9.5]));
  icons.clothespin = { tags: ['pinza de ropa', 'broche', 'tender la ropa', 'secar al aire', 'clothespin', 'clothes peg'], d: [outline, splitA, splitB, spring] };
}

// Clothesline: a line sagging between two posts and a shirt hung over it by its shoulders, the line
// running across its collar.
{
  const posts = [line([2.75, 4.25], [2.75, 21.25]), line([21.25, 4.25], [21.25, 21.25])];
  const rope = 'M2.75 5.75Q12 9.75 21.25 5.75';
  const ropeY = (x) => {
    const t = (x - 2.75) / 18.5;
    return 5.75 + 8 * t * (1 - t);
  };
  const shirt = roundline([[9, ropeY(9)], [6, 10.25], [8.25, 12.25], [8.25, 18.75], [15.75, 18.75], [15.75, 12.25], [18, 10.25], [15, ropeY(15)]], [0, 0.75, 0.6, 1.25, 1.25, 0.6, 0.75, 0]);
  icons.clothesline = { tags: ['tendedero', 'secar al aire', 'tender la ropa', 'clothesline', 'line drying'], d: [...posts, rope, shirt] };
}

// Ironing board: a long board with a pointed nose standing on crossed legs.
{
  const board = 'M4.5 6.75H14.75C18.25 6.75 21.25 7.75 21.25 8.5C21.25 9.25 18.25 10.25 14.75 10.25H4.5A1.75 1.75 0 0 1 4.5 6.75Z';
  const legs = [line([7, 10.25], [16.5, 21]), line([16.5, 10.25], [7, 21])];
  icons['ironing-board'] = { tags: ['burro de planchar', 'tabla de planchar', 'planchado', 'ironing board', 'pressing'], d: [board, ...legs] };
}

// Lint roller: the sticky roll on top, the spiral cuts of its sheets slanting across it (what tells
// it from edicion's paint roller), and the handle straight down from its middle.
{
  const roll = sq(3.25, 3.25, 17.5, 7.5, 3);
  const cuts = [line([7.25, 10.75], [9.75, 3.25]), line([13.25, 10.75], [15.75, 3.25])];
  const neck = line([12, 10.75], [12, 13]);
  const grip = capsule(10.25, 13, 3.5, 8.25);
  icons['lint-roller'] = { tags: ['rodillo quitapelusa', 'pelusa', 'pelo de mascota', 'lint roller', 'pet hair'], d: [roll, ...cuts, neck, grip] };
}

// Folded shirt: the shirt folded into a rectangle seen from the front, the collar on top and the
// lines where the sleeves fold back.
{
  const body = sq(4.25, 4.75, 15.5, 16.25, 2.75);
  const collar = roundline([[9, 4.75], [12, 9], [15, 4.75]], [0, 0.6, 0]);
  const folds = [line([7.5, 8.5], [7.5, 21]), line([16.5, 8.5], [16.5, 21])];
  icons['shirt-folded'] = { tags: ['camisa doblada', 'lavado y doblado', 'ropa doblada', 'folded shirt', 'wash and fold'], d: [body, collar, ...folds] };
}

// Stained shirt: comercio's shirt with a splotch on its chest.
const SHIRT = comercio.icons.shirt.d[0];
/** A splotch: a smooth lobed outline through radii at even angles. */
const splotch = (C, R, start = 0) => smooth(R.map((r, i) => polar(...C, r, start + (i * 360) / R.length)), 1);
icons['shirt-stain'] = { tags: ['mancha en la ropa', 'quitar manchas', 'cuidado especial', 'stained shirt', 'stain treatment'], d: [SHIRT, splotch([12, 14.75], [2.9, 2.25, 2.7, 3.1, 2.15, 2.6, 2.1, 2.85, 2.35, 3.05, 2.2, 2.55], -8)] };

// Linens: three folded slabs stacked, each with its folded edge round at the left and a stripe band
// near it; staggered, so the stripes don't line up.
{
  const slab = (x0, x1, y0, y1) => {
    const r = (y1 - y0) / 2;
    return `M${pt([x0 + r, y0])}H${f(x1 - 1.25)}A1.25 1.25 0 0 1 ${pt([x1, y0 + 1.25])}V${f(y1 - 1.25)}A1.25 1.25 0 0 1 ${pt([x1 - 1.25, y1])}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x0 + r, y0])}Z`;
  };
  const rows = [
    [4.75, 19.25, 4.5, 9.25],
    [3.25, 20.75, 9.25, 14.25],
    [4, 20, 14.25, 19.25],
  ];
  const slabs = rows.map((r) => slab(...r));
  const stripes = rows.map(([x0, , y0, y1], i) => line([x0 + 4.5 + [1, 0, 2][i], y0], [x0 + 4.5 + [1, 0, 2][i], y1]));
  icons.linens = { tags: ['blancos', 'toallas', 'sábanas', 'cambio de ropa de cama', 'linens', 'fresh towels'], d: [...slabs, ...stripes] };
}

// Garment bag: the hanger's hook above a long bag whose shoulders slope like the hanger inside it, a
// zipper down its middle.
const GARMENT_BAG = (() => {
  const bag = roundpoly([[12, 6.25], [18.25, 9.75], [18.25, 21.25], [5.75, 21.25], [5.75, 9.75]], [1.25, 1.75, 2.25, 2.25, 1.75]);
  const hook = 'M12 6.25V4.25A1.5 1.5 0 0 1 15 4.25';
  const zipper = line([12, 9.75], [12, 18.25]);
  return [bag, hook, zipper];
})();
icons['garment-bag'] = { tags: ['funda de traje', 'tintorería', 'lavado en seco', 'guardar ropa', 'garment bag', 'dry cleaning'], d: GARMENT_BAG };
icons['garment-bag-check'] = { tags: ['tintorería lista', 'listo para recoger', 'ropa lista', 'dry cleaning ready', 'ready for pickup'], d: GARMENT_BAG, badge: badge('check') };

// ── Garment care symbols ─────────────────────────────────────────────────────────────────────
// One grid for the whole family, as on a care label: the same tub (washing), square (drying),
// triangle (bleach) and iron, drawn with the set's stroke. Temperatures are dots 4.5 apart (the ASTM
// and GINETEX dot code), in rows 4.5 apart, centered in the space each symbol leaves for them: 4.5 is
// three pixels at 16 px, so the dots snap to the pixel corners with a pixel between them (4 apart
// they ran together into a bar). They are a dense group (DESIGN.md › Detail), so they take the r 0.3
// dot: at r 0.7 the dryer's three dots and its drum made too dense a label.
const HEAT = 0.3;
/** Dots in rows: `rows` lists how many dots each row has; centered on `c`, 4.5 apart. */
const dotRows = (c, rows, step = 4.5) =>
  rows.flatMap((n, j) => Array.from({ length: n }, (_, i) => dot(c[0] + (i - (n - 1) / 2) * step, c[1] + (j - (rows.length - 1) / 2) * step, HEAT)));

/** The care tub: open walls tapering to a rounded bottom, the water's wave across them. */
function tub(k = 1, dx = 0, dy = 0) {
  const T = (p) => [p[0] * k + dx, p[1] * k + dy];
  const [top, bot, xl, xr, inset] = [5, 20.75, 2.75, 21.25, 1.5];
  const wallAt = (y, side) => (side < 0 ? xl + (inset * (y - top)) / (bot - top) : xr - (inset * (y - top)) / (bot - top));
  const wy = 8.25;
  const a = [wallAt(wy, -1), wy];
  const b = [wallAt(wy, 1), wy];
  const n = 4;
  const h = (b[0] - a[0]) / n;
  let wave = `M${pt(T(a))}Q${pt(T([a[0] + h / 2, wy + 1.8]))} ${pt(T([a[0] + h, wy]))}`;
  for (let i = 1; i < n; i++) wave += `T${pt(T([a[0] + h * (i + 1), wy]))}`;
  const walls = roundline([T([xl, top]), T([xl + inset, bot]), T([xr - inset, bot]), T([xr, top])], [0, 2 * k, 2 * k, 0]);
  // Filled: the water under the wave, closed along the walls; the walls' stubs above it stay lines
  const water = `${wave}L${pt(T([wallAt(wy, 1), wy]))}${roundline([T(b), T([xr - inset, bot]), T([xl + inset, bot]), T(a)], [0, 2 * k, 2 * k, 0]).replace(/^M[^L]*/, '')}Z`;
  const stubs = [line(T([xl, top]), T(a)), line(T([xr, top]), T(b))];
  return { d: [walls, wave], water, stubs, T };
}
const TUB = tub();
const TUB_FILL = (marks = []) => ({ solid: [TUB.water], wire: TUB.stubs, ...(marks.length && { cut: marks }) });
const WASH_DOTS = { 'wash-30': [1], 'wash-40': [2], 'wash-50': [3], 'wash-60': [2, 2], 'wash-70': [3, 2], 'wash-95': [3, 3] };
const WASH_TAGS = {
  'wash-30': ['lavar a 30 grados', 'agua fría', 'etiqueta de cuidado', 'wash 30', 'cold wash'],
  'wash-40': ['lavar a 40 grados', 'agua tibia', 'etiqueta de cuidado', 'wash 40', 'warm wash'],
  'wash-50': ['lavar a 50 grados', 'agua caliente', 'etiqueta de cuidado', 'wash 50', 'hot wash'],
  'wash-60': ['lavar a 60 grados', 'toallas', 'sábanas', 'wash 60', 'hot wash'],
  'wash-70': ['lavar a 70 grados', 'muy caliente', 'etiqueta de cuidado', 'wash 70', 'very hot wash'],
  'wash-95': ['lavar a 95 grados', 'hervir', 'ropa blanca', 'wash 95', 'boil wash'],
};
icons.wash = { tags: ['lavar a máquina', 'lavable', 'ciclo normal', 'etiqueta de cuidado', 'machine wash', 'washable'], d: TUB.d };
for (const [name, rows] of Object.entries(WASH_DOTS)) icons[name] = { tags: WASH_TAGS[name], d: [...TUB.d, ...dotRows([12, 14.85], rows)] };

// Hand wash: a hand (the glove's, without its cuff) dipping into the water from the upper right, a
// piece on top that the engine clears the tub around.
{
  const hand = roundpoly(
    [[8.5, 19.5], [8.5, 14], [3.75, 10.5], [5.75, 8.25], [8.5, 10.25], [8.5, 2.75], [15.5, 2.75], [15.5, 19.5]],
    [0.6, 1, 1.4, 1.4, 0.6, 3.5, 3.5, 0.6],
  );
  const k = 0.7;
  const deg = -150;
  const at = rot(mul([12, 2.75], k), [0, 0], deg);
  const H = transform(turnPath(transform(hand, k, 0, 0), deg, [0, 0]), 1, 10.25 - at[0], 16 - at[1]);
  icons['wash-by-hand'] = { tags: ['lavar a mano', 'solo a mano', 'prendas delicadas', 'hand wash', 'hand wash only'], d: TUB.d, badge: own([H], H, { solid: [H] }) };
}

// Gentle and delicate cycles: the tub at 80 %, raised, over one or two bars.
const TUB_S = tub(0.8, 2.4, -1.25);
const BARS = [line([4.75, 18.25], [19.25, 18.25]), line([4.75, 21.25], [19.25, 21.25])];
icons['wash-gentle'] = { tags: ['ciclo suave', 'planchado permanente', 'etiqueta de cuidado', 'gentle cycle', 'permanent press'], d: [...TUB_S.d, BARS[0]] };
icons['wash-delicate'] = { tags: ['ciclo delicado', 'lana', 'seda', 'muy suave', 'delicate cycle', 'wool'], d: [...TUB_S.d, ...BARS] };

// Rinse: the tub at 80 %, lowered, and three drops falling into it.
const TUB_R = tub(0.8, 2.4, 4.25);
icons['wash-rinse'] = { tags: ['enjuagar', 'enjuague', 'solo enjuague', 'programa', 'rinse', 'rinse cycle'], d: [...TUB_R.d, droplet([7.25, 4.75], 1.25), droplet([12, 3.75], 1.25), droplet([16.75, 4.75], 1.25)] };

// Wring: a twisted cloth, two curves crossing twice between its flared ends.
{
  const A = smoothOpen([[3, 7.75], [6, 9], [9, 12], [12, 13.75], [15, 12], [18, 9], [21, 7.75]]);
  const B = smoothOpen([[3, 16.25], [6, 15], [9, 12], [12, 10.25], [15, 12], [18, 15], [21, 16.25]]);
  icons.wring = { tags: ['exprimir', 'torcer', 'no exprimir', 'etiqueta de cuidado', 'wring', 'do not wring'], d: [A, B, line([3, 7.75], [3, 16.25]), line([21, 7.75], [21, 16.25])] };
}

// Bleach: the label's equal-sided triangle; non-chlorine bleach adds two oblique lines, parallel to
// its left side, from the base to the right side.
const TRIANGLE = roundpoly([[12, 4.35], [20.75, 19.5], [3.25, 19.5]], 1.75);
icons.bleach = { tags: ['blanqueador', 'cloro', 'se permite blanquear', 'etiqueta de cuidado', 'bleach', 'bleach allowed'], d: [TRIANGLE] };
{
  const u = [0.5, -Math.sqrt(3) / 2];
  const ob = (x) => {
    const t = (20.75 - x) / 1;
    return line([x, 19.5], add([x, 19.5], mul(u, t)));
  };
  icons['bleach-non-chlorine'] = { tags: ['blanqueador sin cloro', 'oxígeno activo', 'etiqueta de cuidado', 'non-chlorine bleach', 'oxygen bleach'], d: [TRIANGLE, ob(9.25), ob(13.25)] };
}

// Drying: the label's round-cornered square, on the square keyline. Tumble drying is a circle
// in it, its heat as dots; line, drip, flat and shade drying are marks in the square.
const SQUARE = sq(3.25, 3.25, 17.5, 17.5, 4.25);
const DRUM = circ(12, 12, 5.75);
const TRI = 4.5 / Math.sqrt(3);
const DRY_DOTS = { 'dry-tumble-low': dotRows([12, 12], [1]), 'dry-tumble-medium': dotRows([12, 12], [2]), 'dry-tumble-high': [dot(12, 12 - TRI, HEAT), dot(9.75, 12 + TRI / 2, HEAT), dot(14.25, 12 + TRI / 2, HEAT)] };
icons['dry-tumble'] = { tags: ['secadora', 'secar en secadora', 'etiqueta de cuidado', 'tumble dry', 'dryer'], d: [SQUARE, DRUM] };
icons['dry-tumble-low'] = { tags: ['secadora temperatura baja', 'calor bajo', 'etiqueta de cuidado', 'tumble dry low', 'low heat'], d: [SQUARE, DRUM, ...DRY_DOTS['dry-tumble-low']] };
icons['dry-tumble-medium'] = { tags: ['secadora temperatura media', 'calor medio', 'etiqueta de cuidado', 'tumble dry medium', 'medium heat'], d: [SQUARE, DRUM, ...DRY_DOTS['dry-tumble-medium']] };
icons['dry-tumble-high'] = { tags: ['secadora temperatura alta', 'calor alto', 'etiqueta de cuidado', 'tumble dry high', 'high heat'], d: [SQUARE, DRUM, ...DRY_DOTS['dry-tumble-high']] };
icons['dry-line'] = { tags: ['secar en tendedero', 'colgar', 'etiqueta de cuidado', 'line dry', 'hang dry'], d: [SQUARE, 'M4.5 4.5Q12 15.75 19.5 4.5'] };
icons['dry-drip'] = { tags: ['secar escurriendo', 'sin exprimir', 'etiqueta de cuidado', 'drip dry', 'hang wet'], d: [SQUARE, ...[8, 12, 16].map((x) => line([x, 3.25], [x, 13.25]))] };
icons['dry-flat'] = { tags: ['secar en plano', 'extender', 'etiqueta de cuidado', 'dry flat', 'lay flat'], d: [SQUARE, line([6.5, 12], [17.5, 12])] };
icons['dry-shade'] = { tags: ['secar a la sombra', 'sin sol', 'etiqueta de cuidado', 'dry in shade', 'shade dry'], d: [SQUARE, line([3.25, 10.75], [10.75, 3.25]), line([3.25, 15], [15, 3.25])] };

// Ironing: the label's iron, its nose to the left (as on care labels), the handle arching over its
// back; the temperature as dots on its body, the steam as lines under its soleplate.
function iron(dy = 0) {
  const T = (p) => [p[0], p[1] + dy];
  const [top, sole, back, nose, front] = [10.25, 18.25, 20.75, 2.75, 9.5];
  const body = `M${pt(T([front, top]))}H${f(back - 1.75)}A1.75 1.75 0 0 1 ${pt(T([back, top + 1.75]))}V${f(sole + dy - 1.25)}A1.25 1.25 0 0 1 ${pt(T([back - 1.25, sole]))}H${f(nose + 1)}A1 1 0 0 1 ${pt(T([nose + 0.2, sole - 1.15]))}C${pt(T([3.5, 13.75]))} ${pt(T([6, top]))} ${pt(T([front, top]))}Z`;
  const handle = roundline([T([11, top]), T([12.25, 6.25]), T([19.25, 6.25]), T([19.25, top])], [0, 1.5, 1.5, 0]);
  return [body, handle];
}
const IRON = iron();
const IRON_UP = iron(-4);
icons['iron-low'] = { tags: ['planchar a baja temperatura', 'sintéticos', 'etiqueta de cuidado', 'iron low', 'low heat'], d: [...IRON, ...dotRows([12.25, 14.25], [1])] };
icons['iron-medium'] = { tags: ['planchar a temperatura media', 'lana', 'seda', 'iron medium', 'medium heat'], d: [...IRON, ...dotRows([12.25, 14.25], [2])] };
icons['iron-high'] = { tags: ['planchar a alta temperatura', 'algodón', 'lino', 'iron high', 'high heat'], d: [...IRON, ...dotRows([12.25, 14.25], [3])] };
icons['iron-steam'] = { tags: ['planchar con vapor', 'vapor', 'etiqueta de cuidado', 'steam iron', 'steam allowed'], d: [...IRON_UP, ...[7.75, 11.75, 15.75].map((x) => line([x, 17.75], [x, 20.75]))] };
icons['iron-steam-off'] = { tags: ['sin vapor', 'no usar vapor', 'etiqueta de cuidado', 'no steam', 'steam off'], d: [...IRON_UP, line([9.75, 17.25], [14.25, 21.75]), line([14.25, 17.25], [9.75, 21.75])] };

// ── Pests ─────────────────────────────────────────────────────────────────────────────────────
// Fly swatter: a long handle ending in a square mesh paddle with a three-by-three grid, at 45°.
{
  const P = frame([12.75, 12.75], -45);
  const s2 = 4.75;
  const paddle = roundpoly([P([-s2, -9.5]), P([s2, -9.5]), P([s2, 0]), P([-s2, 0])], 1.5);
  const g = (2 * s2) / 3;
  const grid = [
    line(P([-s2 + g, -9.5]), P([-s2 + g, 0])),
    line(P([s2 - g, -9.5]), P([s2 - g, 0])),
    line(P([-s2, -9.5 + g]), P([s2, -9.5 + g])),
    line(P([-s2, -g]), P([s2, -g])),
  ];
  const handle = line(P([0, 0]), P([0, 12.25]));
  icons['fly-swatter'] = { tags: ['matamoscas', 'moscas', 'insectos', 'plagas', 'fly swatter', 'flies'], d: [paddle, ...grid, handle] };
}

// Cockroach from above: the flat oval body under its head shield, the wings' seam, two long antennae
// sweeping out and back, and three pairs of legs.
{
  const shield = 'M7.75 11C7.75 8.25 9.5 6.75 12 6.75C14.5 6.75 16.25 8.25 16.25 11Z';
  const body = 'M8 11C7.75 16.5 9.25 20.5 12 20.5C14.75 20.5 16.25 16.5 16 11';
  const seam = line([12, 11], [12, 17.25]);
  const antennae = ['M11 6.85C9.5 3.5 6.5 2.75 3.25 4.25', 'M13 6.85C14.5 3.5 17.5 2.75 20.75 4.25'];
  const legs = [
    line([7.75, 9.75], [4.75, 8.25]),
    line([16.25, 9.75], [19.25, 8.25]),
    line([7.95, 13.5], [3.75, 13.5]),
    line([16.05, 13.5], [20.25, 13.5]),
    line([8.6, 17.25], [5.25, 19.75]),
    line([15.4, 17.25], [18.75, 19.75]),
  ];
  icons.cockroach = { tags: ['cucaracha', 'plaga', 'fumigación', 'infestación', 'cockroach', 'pest control'], d: [body, shield, seam, ...antennae, ...legs] };
}

// Rat from the side, facing left: a low body tapering to a pointed snout, the round ear rising from
// its head in the same outline, its eye, and a long tail curling under it.
{
  const E = [9.5, 9.5];
  const [e1, e2] = [polar(...E, 2.25, 140), polar(...E, 2.25, 40)];
  const body = `M2.75 15.5C4.75 13.75 5.75 11.75 ${pt(e1)}A2.25 2.25 0 1 1 ${pt(e2)}C15.5 9.75 19.25 10.75 19.25 14.25C19.25 16.25 18.25 17.5 16.25 17.5H6.5C5 17.5 3.75 16.5 2.75 15.5Z`;
  const tail = smoothOpen([[19.1, 15.75], [21.25, 17.5], [20, 20.25], [15, 21], [11.25, 20.5]]);
  icons.rat = { tags: ['rata', 'roedor', 'control de roedores', 'plaga', 'rat', 'rodent'], d: [body, tail, dot(8.75, 14.25)] };
}

// Mosquito coil: the flat spiral seen from above, two turns 3.25 apart, its lit tip at the upper right
// and a wisp of smoke rising from it.
{
  const C = [11.25, 13];
  const [r0, step, a1, turns] = [2, 3.25, -40, 2];
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * turns * 360;
    pts.push(polar(...C, r0 + (step * t) / 360, a1 - turns * 360 + t));
  }
  const coil = smoothOpen(pts);
  const tip = pts[pts.length - 1];
  const w = add(tip, [1, -3]);
  const smoke = `M${pt(w)}C${pt(add(w, [1.5, -0.75]))} ${pt(add(w, [-0.75, -1.75]))} ${pt(add(w, [0.75, -2.5]))}`;
  icons['mosquito-coil'] = { tags: ['espiral antimosquitos', 'repelente', 'mosquitos', 'control de plagas', 'mosquito coil', 'mosquito repellent'], d: [coil, smoke] };
}

// ── Stains and dirt ───────────────────────────────────────────────────────────────────────────
// Stain: a splotch with an irregular lobed edge and two satellite droplets, clear of the badges'
// corner.
const STAIN = [splotch([11, 11.75], [6.6, 5.1, 6.2, 6.9, 5, 5.9, 4.9, 6.5, 5.4, 6.9, 5.2, 5.8], -8), dot(19.5, 4.75, 0.9), dot(4.25, 20.25, 0.9)];
icons.stain = { tags: ['mancha', 'manchas', 'suciedad', 'limpiar', 'stain', 'spot'], d: STAIN };
icons['stain-check'] = { tags: ['mancha quitada', 'mancha tratada', 'desmanchado', 'stain removed', 'spot cleaned'], d: STAIN, badge: badge('check') };

// Dust: a shelf under a fine scatter of dust, a clean path swiped through it on the diagonal. The
// specks sit 4.5 apart in staggered rows, so at 16 px they keep a pixel between them.
{
  const shelf = line([2.75, 19], [21.25, 19]);
  const rows = [[6.5, [4.5, 9, 18]], [11, [6.75, 15.75, 20.25]], [15.5, [4.5, 13.5, 18]]];
  const specks = rows.flatMap(([y, xs]) => xs.map((x) => dot(x, y, 0.3)));
  icons.dust = { tags: ['polvo', 'sacudir', 'superficie con polvo', 'alergia', 'dust', 'dusty'], d: [shelf, ...specks] };
}

// Spill: a cup lying on its side, its open mouth (an ellipse) to the right, and the puddle spreading
// out of it on the floor.
{
  const cup = roundline([[12.75, 6.25], [3.25, 8.5], [3.25, 14], [12.75, 16.25]], [0, 1.5, 1.5, 0]);
  const mouth = 'M12.75 6.25A1.75 5 0 0 1 12.75 16.25A1.75 5 0 0 1 12.75 6.25Z';
  // The puddle is a soft oval from the mouth (a tail curling under the cup read as a loop)
  const puddle = smooth([[12.75, 16.25], [16.75, 15.75], [20.75, 17.5], [20.25, 20.25], [15, 20.75], [10.25, 20.25], [9, 18.75]], 0.9);
  icons.spill = { tags: ['derrame', 'líquido derramado', 'accidente', 'limpiar', 'spill', 'spilled drink'], d: [cup, mouth, puddle] };
}

// Bubbles: three bubbles of different sizes, the middle one in front of the large one (the engine
// clears it 1.5 around), the small one apart; the two larger ones carry a highlight arc.
{
  const [big, med, sml] = [[9, 14.75, 5.25], [15, 8.25, 4.25], [19.25, 17.25, 2.25]];
  const medium = [circ(...med), arc(med[0], med[1], 1.25, 185, 285).d];
  icons.bubbles = {
    tags: ['burbujas', 'espuma', 'jabón', 'limpio', 'bubbles', 'foam'],
    d: [circ(...big), arc(big[0], big[1], 2.25, 195, 260).d, circ(...sml)],
    badge: own(medium, medium[0], { solid: [medium[0]], cut: [medium[1]] }),
  };
}

// Mold: the corner of a room, seen off center (its edge, and the ceiling and the floor running out
// from it), and round spots of different sizes gathered on the larger right wall (on one wall only:
// spread over both they read as a ladybird), each well clear of the room's lines. The ceiling corner
// alone read as a Y.
{
  const [C, F] = [[9, 6.75], [9, 17.75]];
  const room = [line(C, F), line(C, [2.75, 3.25]), line(C, [21.25, 3.25]), line(F, [2.75, 21.25]), line(F, [21.25, 21.25])];
  const spots = [circ(15, 12, 2), dot(19.5, 8), dot(20.75, 12.75), dot(18.5, 16.75)];
  icons.mold = { tags: ['moho', 'humedad', 'hongos', 'pared húmeda', 'mold', 'mildew'], d: [...room, ...spots] };
}

// ── Fill ─────────────────────────────────────────────────────────────────────────────────────
// By index in each icon's `d` (DESIGN.md › Fill): `solid` is filled (closed shapes only; `z(i)`
// closes an open stroke along an edge that is already ink), `cut` is knocked out at stroke width,
// `lines` stay lines with a clearance of paper and `wire` stay lines attached. A seam between two
// solids that share an edge is cut through the silhouette, so they stay apart.
const z = (i) => ({ z: i });
const BASKET_FILL = { solid: [z(0), z(3)] };
const FILL = {
  broom: BROOM_FILL,
  'broom-check': BROOM_FILL,
  'broom-clock': BROOM_FILL,
  'broom-alert': BROOM_FILL,
  'broom-plus': BROOM_FILL,
  'broom-sync': BROOM_FILL,
  'push-broom': { solid: [1], wire: [0, 2, 3, 4, 5, 6] },
  dustpan: { solid: [0], cut: [1], wire: [2] },
  mop: { solid: [1], wire: [0, 2, 3, 4, 5, 6] },
  'mop-flat': { solid: [2, z(1)], wire: [0] },
  'mop-bucket': { solid: [z(0), 1, z(2)], cut: [line([2, 14], [19.5, 14]), line([3.5, 11], [11.5, 11])], wire: [3] },
  bucket: { solid: [z(0), 1], wire: [2] },
  'spray-bottle': { solid: [0, 2, 4, 5, 6], wire: [1, 3] },
  'spray-bottle-leaf': { solid: [0, 2], wire: [1, 3] },
  'spray-can': { solid: [z(0), 1, z(2), 3, 4, 5], cut: [line([5.5, 11.75], [16.5, 11.75])] },
  'pump-sprayer': { solid: [0, 5], wire: [1, 2, 3, 4] },
  sponge: { solid: [0], cut: [1, 2, 3, 4] },
  'scrub-brush': { solid: [0], wire: [1, 2, 3, 4, 5, 6] },
  'feather-duster': { solid: [0, 3], cut: [1, 2], wire: [4] },
  squeegee: { solid: [z(1), 3, 4], wire: [0, 2] },
  'rubber-glove': { solid: [0], cut: [1, 2, 3, line([3.5, 18.5], [20.75, 18.5])] },
  'cleaning-cloth': { solid: [0], cut: [line([3.25, 12.25], [11.75, 12.25], [11.75, 20.75]), 2, 3, 4, 5] },
  'paper-towel': { solid: [z(0), 1, z(2)], cut: ['M3.25 5A4.75 1.75 0 0 0 12.75 5', line([16.75, 5], [16.75, 21.25])] },
  'disinfecting-wipes': { solid: [z(0), 1], cut: ['M5.75 9A6.25 2.25 0 0 0 18.25 9', 2] },
  'cleaning-caddy': { solid: [0, 3], wire: [1, 2, 4] },
  'wet-floor-sign': { solid: [0], cut: [1, 2] },
  'trash-bag': { solid: [0, 1, 2, 3] },
  'trash-bag-clock': { solid: [0, 1, 2, 3] },
  dumpster: { solid: [0, 1, 3, 4], cut: [2, line([2, 9.34], [22, 6.91])] },
  'dish-rack': { solid: [0, z(3)], cut: [line([2, 15], [22, 15])], wire: [1, 2] },
  'dish-soap': { solid: [0, z(1), 3, 4], wire: [2] },
  detergent: { solid: [0, z(2)], cut: [1] },
  'detergent-alert': { solid: [0, z(2)], cut: [1] },
  // The cut rides 0.05 above the box's top edge, so it takes that edge's whole stroke: no hairline
  // is left between the flap and the heap at any weight
  'washing-powder': { solid: [0, z(1), z(2)], cut: [line([2, 10.7], [22, 10.7])], wire: [3] },
  plunger: { solid: [z(0)], wire: [1, 2] },
  // Alone, the basket keeps its rim and band cut through the fill (as one blob it read as a cupcake);
  // under a badge they would leave slivers between the badge's clearance and the wall
  'laundry-basket': { solid: [z(0), z(3)], cut: [line([2, 10.2], [22, 10.2]), 2] },
  'laundry-basket-check': BASKET_FILL,
  'laundry-basket-clock': BASKET_FILL,
  'laundry-hamper': { solid: [0, 1, z(2)], cut: [3, 4, line([3, 8.75], [21, 8.75])] },
  clothespin: { solid: [0], cut: [1, 2, 3] },
  clothesline: { solid: [z(3)], wire: [0, 1, 2] },
  'ironing-board': { solid: [0], wire: [1, 2] },
  'lint-roller': { solid: [0, 4], cut: [line([6.92, 11.75], [10.08, 2.25]), line([12.92, 11.75], [16.08, 2.25])], wire: [3] },
  'shirt-folded': { solid: [0], cut: [roundline([[8.3, 3.77], [12, 9], [15.7, 3.77]], [0, 0.6, 0]), line([7.5, 8.5], [7.5, 22]), line([16.5, 8.5], [16.5, 22])] },
  'shirt-stain': { solid: [0], cut: [1] },
  linens: { solid: [0, 1, 2], cut: [3, 4, 5, line([2.5, 9.25], [21.5, 9.25]), line([2.5, 14.25], [21.5, 14.25])] },
  'garment-bag': { solid: [0], cut: [2], wire: [1] },
  'garment-bag-check': { solid: [0], cut: [2], wire: [1] },
  'bleach-non-chlorine': { solid: [0], cut: [1, 2] },
  bleach: { solid: [0] },
  'fly-swatter': { solid: [0], cut: [1, 2, 3, 4], wire: [5] },
  cockroach: { solid: [z(0), 1], cut: [2, line([7, 11], [17, 11])], wire: [3, 4, 5, 6, 7, 8, 9, 10] },
  rat: { solid: [0], cut: [2], wire: [1] },
  stain: { solid: [0, 1, 2] },
  'stain-check': { solid: [0, 1, 2] },
  spill: { solid: [z(0), 1, 2], cut: ['M12.75 6.25A1.75 5 0 0 0 12.75 16.25'] },
  bubbles: { solid: [0, 2], cut: [1] },
  mold: { solid: [5, 6, 7, 8], wire: [0, 1, 2, 3, 4] },
};
for (const name of ['dry-tumble', 'dry-tumble-low', 'dry-tumble-medium', 'dry-tumble-high', 'dry-line', 'dry-drip', 'dry-flat', 'dry-shade'])
  FILL[name] = { solid: [0], cut: icons[name].d.slice(1).map((_, i) => i + 1) };
for (const name of ['iron-low', 'iron-medium', 'iron-high'])
  FILL[name] = { solid: [0], wire: [1], ...(icons[name].d.length > 2 && { cut: icons[name].d.slice(2).map((_, i) => i + 2) }) };
FILL['iron-steam'] = { solid: [0], wire: [1, 2, 3, 4] };
FILL['iron-steam-off'] = { solid: [0], wire: [1, 2, 3] };
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : typeof i === 'object' ? shut(d[i.z]) : d[i]));
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, pick(v)]));
}
// The care tub: the water under the wave is solid, closed along the walls; the walls' stubs above
// it stay lines and the temperature dots are cut out
icons.wash.fill = TUB_FILL();
for (const name of Object.keys(WASH_DOTS)) icons[name].fill = TUB_FILL(icons[name].d.slice(2));
icons['wash-by-hand'].fill = TUB_FILL();
icons['wash-gentle'].fill = { solid: [TUB_S.water], wire: [...TUB_S.stubs, BARS[0]] };
icons['wash-delicate'].fill = { solid: [TUB_S.water], wire: [...TUB_S.stubs, ...BARS] };
icons['wash-rinse'].fill = { solid: [TUB_R.water, ...icons['wash-rinse'].d.slice(2)], wire: TUB_R.stubs };
// The wrung cloth: the two curves and its ends close into one twisted shape
{
  const [A] = icons.wring.d;
  const back = smoothOpen([[21, 16.25], [18, 15], [15, 12], [12, 10.25], [9, 12], [6, 15], [3, 16.25]]);
  icons.wring.fill = { solid: [`${A}L21 16.25${back.replace(/^M[^C]*/, '')}Z`] };
}
// Filled under the broom, as the house family fills its badged homes (bienes-raices): the clearance
// takes the door's right half, so the door is left solid and only the window is knocked out
icons['house-cleaning'].fill = { solid: lugares.icons.house.fill.solid, cut: [HOUSE[3]] };
// Lines and dots only: their filled version is the outline itself
for (const name of ['mosquito-coil', 'dust']) icons[name].fill = false;

// ── Parts ─────────────────────────────────────────────────────────────────────────────────────
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const PARTS = {
  broom: BROOM_PARTS,
  'broom-check': BROOM_PARTS,
  'broom-clock': BROOM_PARTS,
  'broom-alert': BROOM_PARTS,
  'broom-plus': BROOM_PARTS,
  'broom-sync': BROOM_PARTS,
  'push-broom': { handle: [0], head: [1], bristles: range(2, 6) },
  dustpan: { pan: [0, 1], handle: [2] },
  mop: { handle: [0], head: range(1, 5), floor: [6] },
  'mop-flat': { handle: [0], head: [1, 2] },
  'mop-bucket': { bucket: [0, 1], wringer: [2], handle: [3] },
  bucket: { body: [0, 1], handle: [2] },
  'spray-bottle': { bottle: [0, 1], head: [2, 3], mist: [4, 5, 6] },
  'spray-bottle-leaf': { bottle: [0, 1], head: [2, 3] },
  'spray-can': { can: [0, 1], cap: [2], mist: [3, 4, 5] },
  'pump-sprayer': { tank: [0], pump: [1, 2], hose: [3], wand: [4, 5] },
  sponge: { sponge: [0, 1], pores: [2, 3, 4] },
  'scrub-brush': { back: [0, 1], bristles: range(2, 6) },
  'feather-duster': { feathers: [0, 1, 2], handle: [3, 4] },
  squeegee: { blade: [0, 1], handle: [2], drops: [3, 4] },
  'rubber-glove': { glove: [0, 1, 2, 3], band: [4] },
  'cleaning-cloth': { cloth: [0, 1], hem: range(2, 5) },
  'paper-towel': { roll: [0, 1], sheet: [2, 3] },
  'disinfecting-wipes': { canister: [0, 1, 2] },
  'cleaning-caddy': { tote: [0], handle: [1], bottle: [2, 3, 4] },
  'wet-floor-sign': { sign: [0, 1], drop: [2] },
  'house-cleaning': { roof: [0], walls: [1], door: [2], window: [3] },
  'trash-bag': { bag: [0], knot: [1, 2, 3] },
  'trash-bag-clock': { bag: [0], knot: [1, 2, 3] },
  dumpster: { body: [0, 2], lid: [1], wheels: [3, 4] },
  'dish-rack': { tray: [0], plates: [1, 2, 3] },
  'dish-soap': { bottle: [0, 1, 2], bubbles: [3, 4] },
  detergent: { jug: [0, 1], cap: [2] },
  'detergent-alert': { jug: [0, 1], cap: [2] },
  'washing-powder': { box: [0], flap: [1], powder: [2], scoop: [3] },
  plunger: { cup: [0], handle: [2], floor: [1] },
  'laundry-basket': { basket: [0, 1, 2], laundry: [3] },
  'laundry-basket-check': { basket: [0, 1, 2], laundry: [3] },
  'laundry-basket-clock': { basket: [0, 1, 2], laundry: [3] },
  'laundry-hamper': { tub: [0, 3, 4], lid: [1, 2] },
  clothespin: { jaws: [0, 1, 2], spring: [3] },
  clothesline: { posts: [0, 1], line: [2], shirt: [3] },
  'ironing-board': { board: [0], legs: [1, 2] },
  'lint-roller': { roll: [0, 1, 2], handle: [3, 4] },
  'shirt-folded': { shirt: [0], collar: [1], folds: [2, 3] },
  'shirt-stain': { shirt: [0], stain: [1] },
  linens: { stack: [0, 1, 2], stripes: [3, 4, 5] },
  'garment-bag': { bag: [0, 2], hook: [1] },
  'garment-bag-check': { bag: [0, 2], hook: [1] },
  wash: { tub: [0], water: [1] },
  'wash-by-hand': { tub: [0], water: [1] },
  'wash-gentle': { tub: [0], water: [1], bars: [2] },
  'wash-delicate': { tub: [0], water: [1], bars: [2, 3] },
  'wash-rinse': { tub: [0], water: [1], drops: [2, 3, 4] },
  wring: { cloth: [0, 1], ends: [2, 3] },
  'bleach-non-chlorine': { triangle: [0], mark: [1, 2] },
  'dry-tumble': { square: [0], drum: [1] },
  'dry-line': { square: [0], mark: [1] },
  'dry-drip': { square: [0], mark: [1, 2, 3] },
  'dry-flat': { square: [0], mark: [1] },
  'dry-shade': { square: [0], mark: [1, 2] },
  'iron-steam': { iron: [0], handle: [1], steam: [2, 3, 4] },
  'iron-steam-off': { iron: [0], handle: [1], mark: [2, 3] },
  'fly-swatter': { paddle: range(0, 4), handle: [5] },
  cockroach: { body: [0, 1, 2], antennae: [3, 4], legs: range(5, 10) },
  rat: { body: [0, 2], tail: [1] },
  'mosquito-coil': { coil: [0], smoke: [1] },
  stain: { stain: [0], drops: [1, 2] },
  'stain-check': { stain: [0], drops: [1, 2] },
  dust: { shelf: [0], dust: range(1, icons.dust.d.length - 1) },
  spill: { cup: [0, 1], puddle: [2] },
  bubbles: { large: [0, 1], small: [2] },
  mold: { room: range(0, 4), spots: range(5, 8) },
};
for (const name of Object.keys(WASH_DOTS)) PARTS[name] = { tub: [0], water: [1], heat: range(2, icons[name].d.length - 1) };
for (const name of ['dry-tumble-low', 'dry-tumble-medium', 'dry-tumble-high']) PARTS[name] = { square: [0], drum: [1], heat: range(2, icons[name].d.length - 1) };
for (const name of ['iron-low', 'iron-medium', 'iron-high']) PARTS[name] = { iron: [0], handle: [1], heat: range(2, icons[name].d.length - 1) };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
const BROOM_TOP = BROOM.P([0, -19.25]);
const MOTION = {
  broom: { effect: 'wiggle', origin: BROOM_TOP },
  'broom-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'broom-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'broom-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'push-broom': { effect: 'slide', vector: [1.5, 0] },
  mop: { effect: 'wiggle', parts: ['handle', 'head'], origin: [20.25, 2.75] },
  'mop-flat': { effect: 'slide', vector: [1.5, 0] },
  bucket: { effect: 'ring', origin: [12, 2.75] },
  'spray-bottle': { effect: 'slide', parts: ['mist'], vector: [1.5, 0] },
  'spray-can': { effect: 'slide', parts: ['mist'], vector: [1, -1] },
  'pump-sprayer': { effect: 'bounce', parts: ['pump'], vector: [0, 1.5] },
  'scrub-brush': { effect: 'slide', vector: [1.5, 0] },
  'feather-duster': { effect: 'wiggle', origin: [7.5, 21.5] },
  squeegee: { effect: 'slide', parts: ['blade', 'handle'], vector: [1.5, 0.5] },
  'rubber-glove': { effect: 'wiggle', origin: [12, 21.25] },
  'disinfecting-wipes': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'wet-floor-sign': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'house-cleaning': { effect: 'wiggle', parts: ['badge'], origin: [20.5, 12] },
  'trash-bag': { effect: 'bounce', vector: [0, -1.5] },
  'trash-bag-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  dumpster: { effect: 'wiggle', parts: ['lid'], origin: [21.25, 5.5] },
  'dish-soap': { effect: 'float', parts: ['bubbles'], vector: [0, -1.5] },
  'detergent-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'washing-powder': { effect: 'wiggle', parts: ['flap'], origin: [6.75, 10.75] },
  plunger: { effect: 'bounce', parts: ['cup', 'handle'], vector: [0, -1.5] },
  'laundry-basket-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'laundry-hamper': { effect: 'bounce', parts: ['lid'], vector: [0, -1.5] },
  clothespin: { effect: 'wiggle', origin: [12, 12] },
  clothesline: { effect: 'ring', parts: ['shirt'], origin: [12, 7.75] },
  'lint-roller': { effect: 'slide', vector: [1.5, 0] },
  'shirt-stain': { effect: 'beat', parts: ['stain'], origin: [12, 14.75] },
  'garment-bag': { effect: 'ring', origin: [13.5, 2.75] },
  'wash-by-hand': { effect: 'bounce', parts: ['badge'], vector: [-1, 1.5] },
  'wash-rinse': { effect: 'bounce', parts: ['drops'], vector: [0, 1.5] },
  wring: { effect: 'wiggle', origin: [12, 12] },
  'iron-steam': { effect: 'bounce', parts: ['steam'], vector: [0, 1.5] },
  'fly-swatter': { effect: 'wiggle', origin: [20.5, 20.5] },
  cockroach: { effect: 'wiggle', origin: [12, 13.5] },
  rat: { effect: 'wiggle', parts: ['tail'], origin: [19.25, 14.5] },
  'mosquito-coil': { effect: 'float', parts: ['smoke'], vector: [0, -1.5] },
  'stain-check': { effect: 'beat', parts: ['badge'], origin: BC },
  dust: { effect: 'float', parts: ['dust'], vector: [0, -1] },
  bubbles: { effect: 'float', vector: [0, -1.5] },
};
for (const name of ['iron-low', 'iron-medium', 'iron-high']) MOTION[name] = { effect: 'slide', vector: [-1.5, 0] };
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── 16 px (DESIGN.md › 16 px) ────────────────────────────────────────────────────────────────
// Own drawings for the icons whose snapped version smudges: the leaning ones (their diagonals fall
// between pixels), the dustpan's brush, the wipes' canister and the tumble dryer's three dots. At
// 16 px a pixel is 1.5 of
// the canvas and pixel centers fall at 0.75 + 1.5k; g(column, row) is a pixel's center and the
// lines run from center to center, straight or at 45°. A 2 × 2 dot is a disc of r 0.75 on a pixel
// corner. The engine doesn't snap a `small` nor swap its badge: badged ones get badge(kind, 16).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
const rp = (pts, r) => roundpoly(pts.map(([c, rr]) => g(c, rr)), r);
{
  // The broom at 45°: the handle into the neck, the head flaring to the bristles' edge, its band
  const handle = pl([14, 1], [9, 6]);
  const head = rp([[8, 5], [10, 7], [7, 13], [2, 8]], [0.4, 0.4, 0.6, 0.6]);
  const band = pl([6, 6], [9, 9]);
  const small = { d: [handle, head, band], fill: { solid: [head], cut: [band], wire: [handle] } };
  icons.broom.small = small;
  for (const [name, kind] of [['broom-check', 'check'], ['broom-clock', 'clock'], ['broom-alert', 'alert'], ['broom-plus', 'plus'], ['broom-sync', 'sync']])
    icons[name].small = { ...small, badge: badge(kind, { size: 16 }) };
}
{
  // The dustpan without its brush: the scoop, its back and its handle
  const pan = rp([[1, 11], [4, 5], [11, 5], [14, 11]], [0.6, 1, 1, 0.6]);
  const back = pl([3, 7], [12, 7]);
  const handle = roundline([g(6, 5), g(6, 1), g(9, 1), g(9, 5)], [0, 0.75, 0.75, 0]);
  icons.dustpan.small = { d: [pan, back, handle], fill: { solid: [pan], cut: [back], wire: [handle] } };
}
{
  // The sponge level: the block, its seam a zigzag under the scrubber, and two pores
  const block = rp([[1, 3], [14, 3], [14, 12], [1, 12]], 1.5);
  const seam = pl([1, 6], [2, 7], [4, 5], [6, 7], [8, 5], [10, 7], [12, 5], [14, 7]);
  const dots = [circ(6, 15, 0.75), circ(13.5, 13.5, 0.75)];
  icons.sponge.small = { d: [block, seam, ...dots], fill: { solid: [block], cut: [seam, ...dots] } };
}
{
  // The wipes' canister face on (the top's ellipse and the lid's band smudge at this size): its lid a
  // band with round ends, the body under it and the wipe opening from the slot to a straight edge
  const lid = rp([[2, 6], [13, 6], [13, 8], [2, 8]], 1.4);
  const body = roundline([g(3, 8), g(3, 14), g(12, 14), g(12, 8)], [0, 1.5, 1.5, 0]);
  const wipe = pl([7, 6], [5, 4], [5, 1], [10, 1], [10, 4], [8, 6]);
  icons['disinfecting-wipes'].small = { d: [lid, body, wipe], fill: { solid: [lid, `${body}Z`], wire: [wipe] } };
}
{
  // The squeegee upright: the rubber edge, the holder on it, the handle and one drop
  const rubber = pl([2, 11], [12, 11]);
  const holder = roundline([g(3, 11), g(3, 8), g(11, 8), g(11, 11)], [0, 0.6, 0.6, 0]);
  const handle = pl([7, 8], [7, 2]);
  const drop = circ(18, 6, 0.75);
  icons.squeegee.small = { d: [rubber, holder, handle, drop], fill: { solid: [`${holder}Z`, drop], wire: [rubber, handle] } };
}
{
  // The clothespin upright: the jaws parting in a V at the top, the split down to the tip and the
  // spring's wire across them
  const outline = rp([[5, 1], [7, 1], [8, 3], [9, 1], [11, 1], [11, 14], [5, 14]], [0.6, 0.3, 0.3, 0.3, 0.6, 1, 1]);
  const split = pl([8, 3], [8, 14]);
  const spring = pl([4, 7], [12, 7]);
  icons.clothespin.small = { d: [outline, split, spring], fill: { solid: [outline], cut: [split], wire: [spring] } };
}
{
  // The lint roller: the roll and its two slanted cuts, the neck and the grip
  const roll = rp([[1, 1], [13, 1], [13, 6], [1, 6]], 1.5);
  const cuts = [pl([4, 6], [9, 1]), pl([8, 6], [13, 1])];
  const neck = pl([7, 6], [7, 8]);
  const grip = roundline([g(7, 8), g(6, 8), g(6, 14), g(8, 14), g(8, 8), g(7, 8)], [0, 0.75, 0.75, 0.75, 0.75, 0]);
  icons['lint-roller'].small = { d: [roll, ...cuts, neck, grip], fill: { solid: [roll, `${grip}Z`], cut: cuts, wire: [neck] } };
}
{
  // The mosquito coil as a square spiral two pixels apart, its smoke rising from the tip
  const coil = roundline([[8, 8], [8, 6], [6, 6], [6, 10], [10, 10], [10, 4], [4, 4], [4, 12], [12, 12], [12, 5]].map(([c, r]) => g(c, r)), 0.6);
  const smoke = pl([13, 3], [13, 1]);
  icons['mosquito-coil'].small = { d: [coil, smoke] };
}
{
  // The tumble dryers: the square a pixel wider than the snapped one, so the drum (an octagon on the
  // pixels) can hold the three dots of high heat a pixel apart from each other and from it
  const frame16 = rp([[1, 1], [14, 1], [14, 14], [1, 14]], 3);
  const drum16 = rp([[5, 3], [10, 3], [12, 5], [12, 10], [10, 12], [5, 12], [3, 10], [3, 5]], 1);
  const heat = {
    'dry-tumble': [],
    'dry-tumble-low': [circ(12, 12, 0.75)],
    'dry-tumble-medium': [circ(9, 12, 0.75), circ(15, 12, 0.75)],
    'dry-tumble-high': [circ(12, 9, 0.75), circ(9, 13.5, 0.75), circ(15, 13.5, 0.75)],
  };
  for (const [name, dots] of Object.entries(heat)) icons[name].small = { d: [frame16, drum16, ...dots], fill: { solid: [frame16], cut: [drum16, ...dots] } };
}

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// The care symbols aren't enclosed: the drying ones already come in the label's square, a circle
// is the label's own sign for dry cleaning, and at 58 % the temperature dots run together
const CARE = Object.keys(icons).filter((n) => /^(wash(-|$)|dry-|bleach|iron-|wring)/.test(n));
offV(CARE, { circle: false, square: false });
// With a badge or a piece on top: the filled enclosure doesn't draw it, at 58 % it stops reading and
// the slash would cut through it
offV(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });

export default { category: 'limpieza', label: 'Limpieza y lavandería', icons };
