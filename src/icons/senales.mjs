// Señalética (public signs): the pictograms of wayfinding and public places: restrooms, stairs,
// escalators and elevators, doors, information and help, waiting and meeting, lockers and
// cloakrooms, charging points, smoking areas, the prohibitions as actions, and the
// signs themselves. Drawn with the engine (engine/geometry.mjs) and the rules in DESIGN.md:
// - every figure is personas' whole figure (lugares' walking figure: the head of r 1.9 standing 2.35
//   clear of the shoulders, one stroke for the torso and one per limb), front view or in profile,
//   neutral; the restroom is two of them, never told apart by a skirt;
// - the prohibitions are drawn as the action only: the engine's enclosure and slash make the "no"
//   sign, so none of them draws its own circle or bar and their slash stays on;
// - doors are lugares' door, stairs hogar's, the toilet hogar's, the kiosk restaurante's, the map, the
//   flame, the flower and the signpost lugares', the stroller bebes' construction, the hands gestos'
//   and comercio's, the face emociones';
// - up and down use the engine's arrow badges; a piece in front of another (a card on its lanyard,
//   a hand over a button) is a custom badge and the engine clears what it covers; a piece behind a
//   figure (a handrail, a railing's bar) stops 3 from it, center to center.
// Dropped from the approved list: pickpocket (at 24 px the hand either hid in the bag or turned to a
// blob beside it; neither read as a theft).
import { arc, badge, circ, dot, f, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import emociones from './emociones.mjs';
import gestos from './gestos.mjs';
import hogar from './hogar.mjs';
import lugares from './lugares.mjs';
import restaurante from './restaurante.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const rad = (d) => (d * Math.PI) / 180;
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Moves a path. */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** The same, for a list of paths. */
const placeAll = (ds, s, o, to = o) => ds.map((d) => place(d, s, o, to));

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all): lugares' roundline. */
function rl(pts, radius = 0.6) {
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
/** A map pin: a circle of radius r at c and the tangents from it down to a tip at `tipY`, the tip
 *  rounded (lugares' pin, drawn small: a sharp tip changes its inner outline from weight to weight). */
function pinShape(c, r, tipY, rho = 0.75) {
  const a = (Math.acos(r / (tipY - c[1])) * 180) / Math.PI;
  const [T1, T2] = [polar(...c, r, 90 - a), polar(...c, r, 90 + a)];
  return `${arc(...c, r, 90 - a, 90 + a - 360).d}${rl([T2, [c[0], tipY], T1], [0, rho, 0]).replace(/^M[^L]*/, '')}Z`;
}
/** A drop with its tip up: lugares' droplet, the circle of radius r at c and its tip r√2 above. */
const drop = ([cx, cy], r) => `M${pt(polar(cx, cy, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${pt(polar(cx, cy, r, 225))}L${pt([cx, cy - r * Math.SQRT2])}Z`;
/** A straight arrow from a to b with arms of `arm` at 45°. */
const arrow = (a, b, arm = 3) => [line(a, b), head(b, sub(b, a), arm)];
/** The area a piece clears: closed shapes whole, open strokes one segment at a time (personas'). */
const knockOf = (closed, polylines = []) => [...closed, ...polylines.flatMap((pts) => pts.slice(1).map((p, i) => line(pts[i], p)))].join('');
/** A custom badge: the piece in front, the area it clears and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

// ── Keeping clear ─────────────────────────────────────────────────────────────────────────────
// A straight piece that runs behind a figure (a handrail, a dashed floor line) stops 3 from it,
// center to center: the set's knockout, measured against the figure's joints and its head.
const segDist = (p, a, b) => {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
  return len(sub(p, add2(a, mul(ab, t))));
};
/** Distance from p to an obstacle: { poly: [points] } or { c, r } (a circle's outline). */
const obstDist = (p, o) => (o.poly ? Math.min(...o.poly.slice(1).map((q, i) => segDist(p, o.poly[i], q))) : Math.abs(len(sub(p, o.c)) - o.r));
/** The runs of the segment a→b that stand `gap` clear of every obstacle (runs under `min` are dropped). */
function clear(a, b, obstacles, gap = 3, min = 2.2) {
  const n = Math.ceil(len(sub(b, a)) / 0.02);
  const runs = [];
  let start = null;
  let last = null;
  for (let i = 0; i <= n; i++) {
    const p = add2(a, mul(sub(b, a), i / n));
    const ok = obstacles.every((o) => obstDist(p, o) >= gap);
    if (ok && !start) start = p;
    if (ok) last = p;
    if ((!ok || i === n) && start) {
      if (len(sub(last, start)) >= min) runs.push(line(start, last));
      start = null;
    }
  }
  return runs;
}

// ── The whole figure (personas') ──────────────────────────────────────────────────────────────
// personas' construction, unchanged: the head a circle of r 1.9 standing 2.35 clear of the
// shoulders, the torso one stroke from the shoulders to the hips, each limb one stroke rounded at
// its joints; adults with a torso of 5.5 and legs of 7, children with a larger head.
const HR = 1.9;
const GAP = 2.35;
const headAt = (S, deg = 0, hr = HR) => add2(S, mul([Math.sin(rad(deg)), -Math.cos(rad(deg))], hr + GAP));
function figure({ H, hr = HR, S, P, legs, arms }) {
  const sharp = (pts, at) => rl(pts, pts.map((p) => (p === at || (p[0] === at[0] && p[1] === at[1]) ? 0 : 0.6)));
  return [circ(...H, hr), line(S, P), ...legs.map((l) => sharp(l, P)), ...arms.map((a) => sharp(a, S))];
}
/** The figure's own geometry, to keep other pieces clear of it. */
const obstaclesOf = ({ H, hr = HR, S, P, legs, arms }, { withArms = true } = {}) => [
  { c: H, r: hr },
  { poly: [S, P] },
  ...legs.map((l) => ({ poly: l })),
  ...(withArms ? arms.map((a) => ({ poly: a })) : []),
];
/** The parts of a figure. */
const figParts = (nLegs, nArms, at = 0) => ({
  head: [at],
  body: [at + 1],
  legs: Array.from({ length: nLegs }, (_, i) => at + 2 + i),
  arms: Array.from({ length: nArms }, (_, i) => at + 2 + nLegs + i),
});
/** The adult standing from the front at scale k (personas' adultFront at k 1). */
function adultFront(cx, foot = 21.25, { k = 1, arms, stance = 2.25 } = {}) {
  const P = [cx, foot - 7 * k];
  const S = [cx, P[1] - 5.5 * k];
  const hang = (m) => [[cx + m * Math.max(3.25 * k, 3.05), S[1] + 5.65 * k], [cx + m * 2.5 * k, S[1] + 1.65 * k], S];
  return {
    H: headAt(S, 0, HR * k),
    hr: HR * k,
    S,
    P,
    legs: [[[cx - stance * k, foot], P, [cx + stance * k, foot]]],
    arms: arms ? arms(S, hang) : [[...hang(-1), ...hang(1).reverse().slice(1)]],
  };
}
/** personas' child from the front at scale k. */
function childFront(cx, foot = 21.25, k = 1) {
  const hr = 2.4 * k;
  const P = [cx, foot - 5.5 * k];
  const S = [cx, P[1] - 4 * k];
  const hang = (m) => [[cx + m * Math.max(3 * k, 3.05), S[1] + 3.6 * k], [cx + m * 2 * k, S[1] + 1.4 * k], S];
  return { H: headAt(S, 0, hr), hr, S, P, legs: [[[cx - 1.75 * k, foot], P, [cx + 1.75 * k, foot]]], arms: [[...hang(-1), ...hang(1).reverse().slice(1)]] };
}
/** personas' figure standing in profile, facing right. */
function sideStand(cx, foot = 21.25, k = 1) {
  const P = [cx, foot - 7 * k];
  const S = [cx, P[1] - 5.5 * k];
  return { H: headAt(S, 4, HR * k), hr: HR * k, S, P, legs: [[[cx - 1.75 * k, foot], P, [cx + 2 * k, foot]]], arms: [[S, [cx + 2.75 * k, S[1] + 2.5 * k], [cx + Math.max(3.25 * k, 3.05), S[1] + 5.25 * k]]] };
}
/** personas' walking figure (lugares' stride) at scale k, moved by dx, its feet on `foot`. */
function walkPose(k = 1, dx = 0, foot = 21.25) {
  const at = (p) => [12 + dx + (p[0] - 12) * k, foot + (p[1] - 21.25) * k];
  const S = at([12.6, 8.5]);
  const P = at([11, 14]);
  const H = add2(S, mul(unit(sub([13.25, 4.5], [12.6, 8.5])), HR * k + GAP));
  return { at, H, hr: HR * k, S, P, legs: [[P, at([8.5, 17.25]), at([7.25, 21.25])], [P, at([13.75, 16.5]), at([14.5, 21.25])]] };
}
/** Applies `map` to every joint of a figure (a shear onto a slope, a turn). */
const mapFig = (g, map) => ({ ...g, H: map(g.H), S: map(g.S), P: map(g.P), legs: g.legs.map((l) => l.map(map)), arms: g.arms.map((a) => a.map(map)) });

const icons = {};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Restrooms ─────────────────────────────────────────────────────────────────────────────────
// Restrooms for everyone: two of personas' standing figures, alike, with the bar between them; their
// hands stand 3 clear of it
{
  const d = [...figure(adultFront(5.75)), ...figure(adultFront(18.25)), vl(12, 5.75, 18.25)];
  add('restroom', ['baños', 'sanitarios', 'baño para todos', 'aseos', 'restroom', 'toilets', 'all-gender restroom', 'washroom'], d);
  FILL.restroom = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7, 8] };
  PARTS.restroom = { first: [0, 1, 2, 3], second: [4, 5, 6, 7], bar: [8] };
}
// Family restroom: the bar, an adult and a child beside it, apart
{
  const d = [vl(2.5, 2.75, 21.25), ...figure(adultFront(8.75)), ...figure(childFront(18, 21.25, 0.9))];
  add('restroom-family', ['baño familiar', 'baño con niños', 'sanitario familiar', 'family restroom', 'family toilet', 'parent and child'], d);
  FILL['restroom-family'] = { solid: [1, 5], wire: [0, 2, 3, 4, 6, 7, 8] };
  PARTS['restroom-family'] = { bar: [0], adult: [1, 2, 3, 4], child: [5, 6, 7, 8] };
}
// Urinal, from the front (in profile it read as a letter D): the tall bowl with its flat top, the
// opening inside it and the flush pipe rising from the top
{
  const bowl = 'M6.25 6.5H17.75V12.5C17.75 17.25 15.25 20.75 12 20.75S6.25 17.25 6.25 12.5Z';
  const opening = 'M9.25 10.5A1 1 0 0 1 10.25 9.5H13.75A1 1 0 0 1 14.75 10.5V12.75C14.75 15 13.6 16.75 12 16.75S9.25 15 9.25 12.75Z';
  add('urinal', ['mingitorio', 'urinario', 'sanitario', 'baño de hombres', 'urinal', 'restroom fixture', 'facilities'], [bowl, opening, vl(12, 2.75, 6.5)]);
  FILL.urinal = { solid: [0], cut: [1], wire: [2] };
  PARTS.urinal = { bowl: [0, 1], pipe: [2] };
}
// Toilet stall: the door raised off the floor between the partitions' edges, the occupancy
// indicator near its top; occupied, the engine's lock
{
  const door = sq(6.5, 3.5, 11, 14.25, 1.75, BR);
  const d = [door, dot(14, 7.25), vl(3.5, 3.5, 21.25), vl(20.5, 3.5, 21.25), hl(21.25, 3.5, 20.5)];
  add('toilet-stall', ['cubículo', 'retrete', 'baño disponible', 'compartimento', 'toilet stall', 'cubicle', 'restroom stall'], d);
  add('toilet-stall-lock', ['ocupado', 'baño ocupado', 'cubículo cerrado', 'lavabo del avión', 'occupied', 'stall occupied', 'lavatory occupied'], d, { badge: badge('lock') });
  for (const name of ['toilet-stall', 'toilet-stall-lock']) {
    FILL[name] = { solid: [0], cut: [1], wire: [2, 3, 4] };
    PARTS[name] = { door: [0], indicator: [1], partitions: [2, 3], floor: [4] };
  }
}
/** A shoe's print, toe up: the wide ball, the arch drawn in and the round heel (center 12, 9.25). */
const PRINT = 'M8.75 6A3.25 3.25 0 0 1 15.25 6C15.25 8.25 14 9.25 14 10.75C14 11.75 14.25 12.25 14.25 13.5A2.25 2.25 0 0 1 9.75 13.5C9.75 12.25 10 11.75 10 10.75C10 9.25 8.75 8.25 8.75 6Z';
/** A shoe sole from above: the toe a circle of r1 at the top, the heel one of r2 `h` lower, joined by tangents. */
function sole([cx, top], h = 8, r1 = 1.75, r2 = 1.3) {
  const c1 = [cx, top + r1];
  const c2 = [cx, top + h - r2];
  const a = (Math.asin((r1 - r2) / (h - r1 - r2)) * 180) / Math.PI;
  const [R1, R2, L2, L1] = [polar(...c1, r1, a), polar(...c2, r2, a), polar(...c2, r2, 180 - a), polar(...c1, r1, 180 - a)];
  return `M${pt(R1)}L${pt(R2)}A${f(r2)} ${f(r2)} 0 0 1 ${pt(L2)}L${pt(L1)}A${f(r1)} ${f(r1)} 0 1 1 ${pt(R1)}Z`;
}
// Squat toilet, from above: the long pan with its raised hood across the front, and a shoe print on
// each side where the feet go (the stand-here prints at 70 %: ribs on the footrests read as a pair of
// batteries, plain soles as flip-flops)
{
  const pan = sq(9.5, 3.25, 5, 17.5, 2.5);
  const hood = 'M9.5 8.5C10.75 9.85 13.25 9.85 14.5 8.5';
  const foot = (cx) => place(PRINT, 0.7, [12, 9.25], [cx, 12.5]);
  add('toilet-squat', ['inodoro turco', 'letrina', 'baño de piso', 'sanitario de cuclillas', 'squat toilet', 'squatting toilet', 'asian toilet'], [pan, hood, foot(4.35), foot(19.65)]);
  FILL['toilet-squat'] = { solid: [0, 2, 3], cut: [1] };
  PARTS['toilet-squat'] = { pan: [0], hood: [1], footrests: [2, 3] };
  // 16 px: the footrests as plain capsules on the pixel grid
  {
    const rests = [sq(3, 9, 3, 7.5, 1.5), sq(18, 9, 3, 7.5, 1.5)];
    icons['toilet-squat'].small = { d: [pan, hood, ...rests], fill: { solid: [pan, ...rests], cut: [hood] } };
  }
}
// Portable toilet: the tall booth (as wide as it was tall, it read as a house) under its domed roof,
// which barely overhangs it (its ends stand 1 tall; its middle stays open at bold), the vent pipe on
// the roof, and the door 3 inside the booth's sides, its handle 3 clear of its edges
{
  const roof = 'M5.25 7.5V6.5Q12 2.5 18.75 6.5V7.5Z';
  // The roof's height at x (its control point sits midway, so x runs evenly along the curve)
  const roofY = (x) => {
    const t = (x - 5.25) / 13.5;
    return (1 - t) ** 2 * 6.5 + 2 * t * (1 - t) * 2.5 + t ** 2 * 6.5;
  };
  const body = rl([[6, 7.5], [6, 21.25], [18, 21.25], [18, 7.5]], 0);
  const door = rl([[9, 21.25], [9, 10.5], [15, 10.5], [15, 21.25]], [0, 1, 1, 0]);
  add('portable-toilet', ['baño portátil', 'sanitario portátil', 'caseta', 'festival', 'portable toilet', 'porta potty', 'portaloo'], [roof, body, door, vl(12, 14.5, 17.5), vl(15.5, roofY(15.5), 2.25)]);
  FILL['portable-toilet'] = { solid: [0, shut(body)], cut: [2, 3], wire: [4] };
  PARTS['portable-toilet'] = { roof: [0, 4], booth: [1], door: [2, 3] };
}
// Washing hands: comercio's palm up (its cuff and hand, at 90 %) under the tap's stream, a drop at
// each side of it
{
  const palm = placeAll([comercio.icons.donation.d[1], comercio.icons.donation.d[2]], 0.9, [2.75, 21]);
  const tap = roundpoly([[2.75, 3.25], [11.75, 3.25], [14.25, 5.75], [14.25, 7.75], [11.25, 7.75], [11.25, 6.25], [2.75, 6.25]], [0, 1.5, 1.5, 0.6, 0.6, 0.5, 0]);
  const d = [...palm, tap, vl(12.75, 7.75, 13.25), drop([8.5, 10.75], 1.25), drop([17, 10.5], 1.25)];
  add('hand-washing', ['lavarse las manos', 'lavado de manos', 'higiene', 'lavamanos', 'hand washing', 'wash your hands', 'hygiene'], d);
  FILL['hand-washing'] = { solid: [0, shut(d[1]), 2, 4, 5], wire: [3] };
  PARTS['hand-washing'] = { cuff: [0], hand: [1], tap: [2], stream: [3], drops: [4, 5] };
  // 16 px: without the drops, which ran into the tap and the stream
  icons['hand-washing'].small = { d: d.slice(0, 4), fill: { solid: [d[0], shut(d[1]), d[2]], wire: [d[3]] } };
}
// Paper into the toilet: hogar's toilet at 80 % on the floor, a torn sheet falling over it and a
// short arrow down beside it; with the slash, don't flush the paper
{
  const toilet = placeAll(hogar.icons.toilet.d, 0.8, [3.25, 20.75], [2.75, 21.25]);
  const sheet = rl([[10.75, 9.75], [10.75, 3.25], [15, 3.25], [15, 9.75], [14, 9], [12.9, 9.75], [11.8, 9], [10.75, 9.75]], [0, 0.75, 0.75, 0, 0, 0, 0, 0]);
  const d = [...toilet, shut(sheet), ...arrow([20, 3.75], [20, 11.5], 2.5)];
  add('toilet-paper-flush', ['papel al inodoro', 'no tirar papel', 'papel higiénico', 'desagüe', 'flush paper', 'do not flush paper', 'toilet paper'], d);
  FILL['toilet-paper-flush'] = { solid: [shut(d[0]), 1, 3], cut: hogar.icons.toilet.fill.cut.map((c) => place(c, 0.8, [3.25, 20.75], [2.75, 21.25])), wire: [4, 5] };
  PARTS['toilet-paper-flush'] = { toilet: [0, 1, 2], paper: [3], arrow: [4, 5] };
}
// Flush: the same toilet with the push button on its cistern and the swirl of the flush over the
// bowl (a fingertip on the button, at this size, read as a fork)
{
  const toilet = placeAll(hogar.icons.toilet.d, 0.8, [3.25, 20.75], [2.75, 21.25]);
  const button = 'M3.75 7.25A1.5 1.5 0 0 1 6.75 7.25';
  const a = arc(14.75, 7.75, 3.5, 300, 600);
  const d = [...toilet, button, a.d, head(a.end, a.tangent, 2.6)];
  add('toilet-flush', ['jalar la cadena', 'descargar', 'botón de descarga', 'inodoro', 'flush', 'flush the toilet', 'flush button'], d);
  FILL['toilet-flush'] = { solid: [shut(d[0]), 1, shut(button)], cut: hogar.icons.toilet.fill.cut.map((c) => place(c, 0.8, [3.25, 20.75], [2.75, 21.25])), wire: [4, 5] };
  PARTS['toilet-flush'] = { toilet: [0, 1, 2], button: [3], swirl: [4, 5] };
}

// ── Escalators, walkways, ramps and stairs ────────────────────────────────────────────────────
// Escalator: the treads rising to the right from the flat landing at its foot (no riser under it: a
// stroke from the landing down to the floor read as a post) up to the landing at its head (clear of
// the badges' corner), the handrail parallel above them, and a figure from the front on the lower
// landing, a hand on the rail. Up and down take the engine's arrows on the same escalator (mirrored
// to descend, its lower treads and the figure stood under the badge; a figure from the front rides
// either way).
{
  const steps = rl([[3.25, 17.5], [8, 17.5], [8, 14], [10.75, 14], [10.75, 10.5], [13.5, 10.5], [13.5, 7], [21.25, 7]], 0.5);
  const railY = (x) => 18.98 - 1.27 * x;
  const hand = [9.25, railY(9.25)];
  const g = adultFront(6.2, 17.5, { k: 0.8, arms: (S, hang) => [hang(-1), [S, hand]] });
  const rail = rl([hand, [12.2, railY(12.2)], [21.25, railY(12.2)]], [0, 1.5, 0]);
  const d = [steps, rail, ...figure(g)];
  add('escalator', ['escalera eléctrica', 'escalera mecánica', 'subir de piso', 'centro comercial', 'escalator', 'moving stairs', 'mall'], d);
  add('escalator-up', ['escalera eléctrica de subida', 'subir', 'piso de arriba', 'sentido de la escalera', 'escalator up', 'going up', 'upstairs'], d, { badge: badge('arrow-up') });
  add('escalator-down', ['escalera eléctrica de bajada', 'bajar', 'piso de abajo', 'sentido de la escalera', 'escalator down', 'going down', 'downstairs'], d, { badge: badge('arrow-down') });
  for (const name of ['escalator', 'escalator-up', 'escalator-down']) {
    FILL[name] = { solid: [2], wire: [0, 1, 3, 4, 5, 6] };
    PARTS[name] = { steps: [0], rail: [1], head: [2], body: [3], legs: [4], arms: [5, 6] };
  }
}
// Moving walkway: a figure in profile standing on the long belt, a hand on the handrail that runs
// behind it (rising to the belt at its ends, the rail read as a bumper car), and a short arrow ahead
{
  const g = sideStand(9.25, 18, 0.8);
  const y = 11.75;
  const hand = [12.75, y];
  g.arms = [[g.S, [11.5, 9.75], hand]];
  const runs = clear([3.25, y], [20.75, y], obstaclesOf(g, { withArms: false }), 3, 0);
  const xs = runs.map((r) => r.match(/-?[\d.]+/g).map(Number));
  const xL = xs[0][2];
  const belt = sq(2.25, 18, 19.5, 3.25, 1.625);
  const d = [belt, ...figure(g), hl(y, 2.75, xL), hl(y, hand[0], 21.25), ...arrow([14.25, 6.25], [20.25, 6.25], 2.5)];
  add('moving-walkway', ['banda transportadora', 'pasillo rodante', 'andén móvil', 'aeropuerto', 'moving walkway', 'travelator', 'people mover'], d);
  FILL['moving-walkway'] = { solid: [0, 1], wire: [2, 3, 4, 5, 6], lines: [7, 8] };
  PARTS['moving-walkway'] = { belt: [0], head: [1], body: [2], legs: [3], arms: [4], rail: [5, 6], arrow: [7, 8] };
}
// Ramp: the wedge of a ramp rising from the floor, the walking figure going up its incline (the joints
// sheared onto the slope, so both feet stand on it)
{
  const top = 12.75;
  const m = (21.25 - top) / (21.25 - 2.75);
  const g = walkPose(0.75, -0.75);
  g.arms = [[g.at([7.5, 10.5]), g.at([9, 10]), g.S, g.at([14.75, 11.5]), g.at([17.25, 12.25])]];
  const sheared = mapFig(g, ([x, yy]) => [x, yy - m * (x - 2.75)]);
  const d = [roundpoly([[2.75, 21.25], [21.25, 21.25], [21.25, top]], [0.5, 0.5, 0.75]), ...figure(sheared)];
  add('ramp', ['rampa', 'acceso sin escalones', 'pendiente', 'carriolas y maletas', 'ramp', 'step-free access', 'incline'], d);
  FILL.ramp = { solid: [0, 1], wire: [2, 3, 4, 5] };
  PARTS.ramp = { ramp: [0], head: [1], body: [2], legs: [3, 4], arms: [5] };
}
// Stairs up and down: hogar's stairs at 85 % from the top left, clear of the engine's arrows (mirrored
// to descend, its lower steps stood under the badge; stairs that rise one way go down the other)
{
  // The rail and its low post run on to x 3.5, so the post stands 3 clear of the first riser
  const [steps, , , top] = hogar.icons.stairs.d;
  const d = placeAll([steps, line([3.5, 13.58], [19.75, 2.75]), vl(3.5, 13.58, 21), top], 0.85, [2.75, 2.75]);
  add('stairs-up', ['subir escaleras', 'escaleras arriba', 'piso superior', 'señalización', 'stairs up', 'upstairs', 'floor above'], d, { badge: badge('arrow-up') });
  add('stairs-down', ['bajar escaleras', 'escaleras abajo', 'piso inferior', 'señalización', 'stairs down', 'downstairs', 'floor below'], d, { badge: badge('arrow-down') });
  for (const name of ['stairs-up', 'stairs-down']) {
    FILL[name] = { solid: [shut(d[0])], wire: [1, 2, 3] };
    PARTS[name] = { steps: [0], rail: [1, 2, 3] };
  }
}

// ── Elevators ─────────────────────────────────────────────────────────────────────────────────
// Call buttons: the tall plate with up over down
{
  const tri = [[12, 6.25], [15.25, 10.25], [8.75, 10.25]];
  const upT = roundpoly(tri, [0.9, 0.8, 0.8]);
  const downT = flipPath(upT, 'y');
  add('elevator-buttons', ['botones del elevador', 'llamar elevador', 'subir o bajar', 'vestíbulo', 'elevator buttons', 'call elevator', 'lift call'], [sq(5.75, 2.75, 12.5, 18.5, 3.5, BR), upT, downT]);
  FILL['elevator-buttons'] = { solid: [0], cut: [1, 2] };
  PARTS['elevator-buttons'] = { plate: [0], up: [1], down: [2] };
}
// Door open and door close: the panel's two triangles pointing away from the seam, or toward it
{
  const out = roundpoly([[15, 7.5], [21.5, 12], [15, 16.5]], [0.8, 1, 0.8]);
  const inn = roundpoly([[2.5, 7.5], [9, 12], [2.5, 16.5]], [0.8, 1, 0.8]);
  const seam = vl(12, 4.75, 19.25);
  add('elevator-door-open', ['abrir puertas', 'mantener abierto', 'botón del elevador', 'puertas', 'door open', 'open doors', 'hold doors'], [flipPath(out), seam, out]);
  add('elevator-door-close', ['cerrar puertas', 'botón del elevador', 'puertas', 'elevador', 'door close', 'close doors', 'elevator panel'], [inn, seam, flipPath(inn)]);
  for (const name of ['elevator-door-open', 'elevator-door-close']) {
    FILL[name] = { solid: [0, 2], wire: [1] };
    PARTS[name] = { left: [0], seam: [1], right: [2] };
  }
}

// ── Doors ─────────────────────────────────────────────────────────────────────────────────────
// Revolving door, in plan (from the front it read as a barrel; four bare wings between the walls
// read as a letter x in brackets): the drum's two curved glass walls with the ways in and out
// between them, and the four wings caught mid-turn on their central post, two of them pointing out
// through the openings; their tips stand 2.9 inside the walls
{
  const wing = (a) => line(polar(12, 12, 2, a), polar(12, 12, 6.1, a));
  add('door-revolving', ['puerta giratoria', 'entrada del hotel', 'acceso', 'vestíbulo', 'revolving door', 'rotating door', 'entrance'], [arc(12, 12, 9, 120, 240).d, arc(12, 12, 9, -60, 60).d, circ(12, 12, 2), ...[15, 105, 195, 285].map(wing)]);
  icons['door-revolving'].fill = false;
  PARTS['door-revolving'] = { drum: [0, 1], post: [2], wings: [3, 4, 5, 6] };
}
// Push and pull: lugares' door moved right; push, the arrow points into it from the left past its
// edge; pull, it points out of it to the left, under a bar handle. The arrow passes in front of the
// door's edge and the engine clears the edge around it.
{
  const leaf = rl([[8.75, 21.25], [8.75, 2.75], [20.75, 2.75], [20.75, 21.25]], [0, 2.5, 2.5, 0]);
  const floor = hl(21.25, 7.25, 22.25);
  const arrowBadge = (a, b) => {
    const d = arrow(a, b, 3);
    const h = head(b, sub(b, a), 3).match(/-?[\d.]+/g).map(Number);
    return own(d, knockOf([], [[a, b], [[h[0], h[1]], b, [h[4], h[5]]]]));
  };
  add('door-push', ['empujar', 'empuje', 'abre hacia adentro', 'puerta', 'push door', 'push', 'door sign'], [leaf, floor, dot(17, 12.5)], { badge: arrowBadge([2.5, 12.5], [13.25, 12.5]) });
  add('door-pull', ['jalar', 'jale', 'tirar', 'abre hacia afuera', 'pull door', 'pull', 'door sign'], [leaf, floor, vl(11.75, 7.25, 13.25)], { badge: arrowBadge([16.25, 16.5], [2.5, 16.5]) });
  FILL['door-push'] = { solid: [shut(leaf)], cut: [2], wire: [1] };
  FILL['door-pull'] = { solid: [shut(leaf)], cut: [2], wire: [1] };
  PARTS['door-push'] = { door: [0], floor: [1], knob: [2] };
  PARTS['door-pull'] = { door: [0], floor: [1], handle: [2] };
}
// Staff only: lugares' door (its knob would sit under the lanyard's clearance) and an ID card on its
// lanyard in front of it at the bottom right
{
  const { d: door } = lugares.icons.door;
  const card = sq(14.25, 13.25, 7, 8, 1.75, BR);
  const slot = hl(16.25, 16.75, 18.75);
  // A short lanyard, so the door's edge keeps a clear run above its clearance
  const lanyard = [[15.75, 10], [17.75, 13.25], [19.75, 10]];
  add('staff-only', ['solo personal autorizado', 'acceso restringido', 'personal', 'área de empleados', 'staff only', 'authorized personnel', 'employees only'], [door[0], door[1]], {
    badge: own([card, slot, line(...lanyard)], knockOf([card], [lanyard]), { solid: [card], cut: [slot], wire: [line(...lanyard)] }),
  });
  FILL['staff-only'] = { solid: [shut(door[0])], wire: [1] };
  PARTS['staff-only'] = { door: [0], floor: [1] };
}
// Press the button: a wall button seen from the side, its dome on the plate, and gestos' hand pointing
// at it, the fingertip pressing the dome (a tapping hand over a wall plate hid the button; a hand
// pointing down onto a dome on a base read as a rubber stamp)
{
  const hand = place(gestos.icons['hand-point-left'].d[0], 0.85, [2.75, 11.5], [9.1, 12]);
  const dome = arc(6, 12, 3.5, -90, 90).d;
  add('press-button', ['presionar botón', 'pulsador', 'abrir puerta', 'botón de ayuda', 'press button', 'push button', 'door opener'], [sq(2.75, 4.75, 3.25, 14.5, 1.25, BR), dome], { badge: own([hand], hand, { solid: [hand] }) });
  FILL['press-button'] = { solid: [0, shut(dome)] };
  PARTS['press-button'] = { plate: [0], button: [1] };
}

// ── Information and help ──────────────────────────────────────────────────────────────────────
// The wayfinding pylon: a slim totem on its foot, its top corners rounded (a half-circle top on a
// plinth read as a gravestone). The information point and the wayfinding totem share it.
const PYLON = `${rl([[6.75, 19.75], [6.75, 2.75], [17.25, 2.75], [17.25, 19.75], [19, 19.75], [19, 21.25], [5, 21.25], [5, 19.75], [6.75, 19.75]], [0, 2.5, 2.5, 0, 0.5, 0.5, 0.5, 0.5, 0])}Z`;
// Information point: the pylon with a large i on its face, a dot over a stem
{
  add('info-point', ['punto de información', 'informes', 'módulo de información', 'atención', 'information point', 'info desk', 'information'], [PYLON, dot(12, 6.75), vl(12, 10.5, 16.5)]);
  FILL['info-point'] = { solid: [0], cut: [1, 2] };
  PARTS['info-point'] = { totem: [0], mark: [1, 2] };
}
// Help point: the call box on its post: a panel with a speaker grille of two lines and the round
// call button, on a pole and its foot (a panel alone is comunicacion's wall intercom)
{
  add('help-point', ['punto de ayuda', 'intercomunicador', 'llamar al personal', 'auxilio', 'help point', 'intercom', 'call for help'], [
    sq(7.25, 2.75, 9.5, 15, 3, BR),
    hl(5.75, 10.25, 13.75),
    hl(8.75, 10.25, 13.75),
    circ(12, 13.25, 1.5),
    vl(12, 17.75, 21.25),
    hl(21.25, 9, 15),
  ]);
  FILL['help-point'] = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
  PARTS['help-point'] = { panel: [0], grille: [1, 2], button: [3], post: [4, 5] };
}
// Service window: a booth with the counter shelf running across it and out past each side, and a
// person's head and shoulders behind the counter (a window over a counter read as a laptop)
{
  const booth = sq(4.75, 2.75, 14.5, 18.5, 3, BR);
  const counter = hl(14.5, 2.75, 21.25);
  const shoulders = arc(12, 14.5, 3.25, 180, 360).d;
  add('service-window', ['ventanilla', 'taquilla', 'atención al público', 'caja', 'service window', 'ticket office', 'counter'], [booth, circ(12, 7, 1.75), shoulders, counter]);
  FILL['service-window'] = { solid: [0], cut: [1, 2], lines: [3] };
  PARTS['service-window'] = { booth: [0], person: [1, 2], counter: [3] };
}

// ── Waiting and meeting ───────────────────────────────────────────────────────────────────────
// Waiting area: three backs on one seat bar, front view, on two legs
{
  const w = (18.5 - 6) / 3;
  const backs = [0, 1, 2].map((i) => {
    const x = 2.75 + i * (w + 3);
    return rl([[x, 13], [x, 5], [x + w, 5], [x + w, 13]], [0, 1.5, 1.5, 0]);
  });
  add('waiting-area', ['sala de espera', 'área de espera', 'asientos', 'recepción', 'waiting area', 'waiting room', 'seating'], [...backs, sq(2.25, 13, 19.5, 3, 1.5), vl(6, 16, 21.25), vl(18, 16, 21.25)]);
  FILL['waiting-area'] = { solid: [shut(backs[0]), shut(backs[1]), shut(backs[2]), 3], wire: [4, 5] };
  PARTS['waiting-area'] = { seats: [0, 1, 2, 3], legs: [4, 5] };
}
// Wait behind the line: a figure in profile waiting before the dashed line on the floor, seen edge on
// (a dash or two beside a figure from the front read as an underscore)
{
  const g = sideStand(6);
  const dashes = [3, 8.4, 13.8, 19.2].map((y) => vl(13.25, y, y + 2));
  add('wait-here', ['espere aquí', 'espere detrás de la línea', 'fila', 'turno', 'wait here', 'wait behind the line', 'queue'], [...figure(g), ...dashes]);
  FILL['wait-here'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7] };
  PARTS['wait-here'] = { head: [0], body: [1], legs: [2], arms: [3], line: [4, 5, 6, 7] };
}
// Stand here: a pair of shoe prints, toes turned out a little, on a round floor decal (simple soles in
// a flat ellipse read as a pig's snout)
{
  const ring = circ(12, 12, 9);
  const print = (cx, deg) => place(turnPath(PRINT, deg, [12, 9.25]), 0.66, [12, 9.25], [cx, 12]);
  add('stand-here', ['párese aquí', 'marca en el piso', 'distancia', 'lugar en la fila', 'stand here', 'floor marker', 'spacing decal'], [ring, print(8.6, -8), print(15.4, 8)]);
  FILL['stand-here'] = { solid: [0], cut: [1, 2] };
  PARTS['stand-here'] = { decal: [0], prints: [1, 2] };
}
// Meeting point: two figures in profile facing each other under a map pin (a dot on the floor between
// them read as a ball they kick)
{
  const left = figure(sideStand(4.75));
  const right = left.map((p) => flipPath(p));
  const pin = pinShape([12, 4.75], 2.25, 9.5);
  add('meeting-point', ['punto de encuentro', 'reunirse', 'lugar de reunión', 'grupo', 'meeting point', 'meet here', 'meeting place'], [...left, ...right, pin]);
  FILL['meeting-point'] = { solid: [0, 4, 8], wire: [1, 2, 3, 5, 6, 7] };
  PARTS['meeting-point'] = { first: [0, 1, 2, 3], second: [4, 5, 6, 7], pin: [8] };
}

// ── Lost and found, luggage, cloakroom and lockers ────────────────────────────────────────────
// Lost and found: an open box with its flaps folded out, a folded umbrella standing in it (its
// furled canopy wide enough to keep its inside open at bold) with its crook up, and the engine's
// question
{
  const box = sq(3.25, 12.5, 9.5, 8.75, 2, { square: ['tl', 'tr', 'br'] });
  const flaps = [line([3.25, 12.5], [2, 10]), line([12.75, 12.5], [14, 10])];
  const canopy = 'M5.75 12.5L7.25 8.25H8.75L10.25 12.5';
  const crook = `M8 8.25V5.25${arc(9.75, 5.25, 1.75, 180, 360).d.replace(/^M[^A]*/, '')}V6.25`;
  add('lost-and-found', ['objetos perdidos', 'artículos extraviados', 'reclamar objeto', 'perdí algo', 'lost and found', 'lost property', 'found items'], [box, ...flaps, canopy, crook], { badge: badge('question') });
  FILL['lost-and-found'] = { solid: [0, shut(canopy)], wire: [1, 2, 4] };
  PARTS['lost-and-found'] = { box: [0, 1, 2], umbrella: [3, 4] };
}
// Left luggage: a suitcase with its handle and a key lying above the handle
{
  const body = sq(3.25, 13.25, 17.5, 8, 2.5, BR);
  const handle = rl([[9.5, 13.25], [9.5, 10.25], [14.5, 10.25], [14.5, 13.25]], [0, 1.25, 1.25, 0]);
  add('left-luggage', ['guarda equipaje', 'consigna', 'paquetería', 'casillero de maletas', 'left luggage', 'baggage storage', 'luggage lockers'], [
    body,
    handle,
    vl(8.25, 16.25, 18.25),
    vl(15.75, 16.25, 18.25),
    circ(5.75, 5, 2.25),
    hl(5, 8, 19.25),
    vl(16, 5, 7.25),
    vl(19.25, 5, 7.5),
  ]);
  FILL['left-luggage'] = { solid: [0, 4], cut: [2, 3], wire: [1, 5, 6, 7] };
  PARTS['left-luggage'] = { suitcase: [0, 1, 2, 3], key: [4, 5, 6, 7] };
}
// Coat check: a coat hanger, its tag hanging from the bar on a short string
{
  const hook = `M12 7.25V5${arc(13.75, 5, 1.75, 180, 340).d.replace(/^M[^A]*/, '')}`;
  const hanger = roundpoly([[12, 7.25], [21.25, 13.25], [2.75, 13.25]], [0.6, 1, 1]);
  const tag = sq(8.75, 15.5, 6.5, 5.75, 1.5, BR);
  add('coat-check', ['guardarropa', 'paragüero', 'ficha de guardarropa', 'abrigos', 'coat check', 'cloakroom', 'coat room'], [hanger, hook, vl(12, 13.25, 15.5), tag]);
  FILL['coat-check'] = { solid: [3], wire: [0, 1, 2] };
  PARTS['coat-check'] = { hanger: [0, 1], tag: [2, 3] };
}
// Locker key: the coiled band of a pool's locker key, its end running into the key
{
  const c = [8.5, 8.5];
  const pts = [];
  for (let t = 0; t <= 1.0001; t += 1 / 120) pts.push(polar(...c, 5.75 - 3 * t, 45 + 360 * t));
  const coil = `M${pts.map(pt).join('L')}`;
  const bow = circ(13.75, 13.75, 1.75);
  add('locker-key', ['llave del casillero', 'pulsera con llave', 'alberca', 'vestidor', 'locker key', 'wristband key', 'gym locker'], [coil, bow, line([15, 15], [20.75, 20.75]), line([18.5, 18.5], [16.75, 20.25]), line([20.75, 20.75], [19, 22.25])]);
  FILL['locker-key'] = { solid: [1], wire: [0, 2, 3, 4] };
  PARTS['locker-key'] = { band: [0], key: [1, 2, 3, 4] };
  // 16 px: the band a plain ring (its coil ran together)
  {
    const [, ...key] = icons['locker-key'].d;
    const band = circ(8.25, 8.25, 4.5);
    icons['locker-key'].small = { d: [band, ...key], fill: { solid: [key[0]], wire: [band, ...key.slice(1)] } };
  }
}

// ── Charging and power ────────────────────────────────────────────────────────────────────────
// Charging station: the column, three cables leaving its side and sagging out to their plugs
{
  const col = sq(2.75, 2.75, 6, 18.5, 2, BR);
  const ys = [6, 11.75, 17.5];
  const cables = ys.map((y) => `M8.75 ${y}C11 ${y + 1.75} 13.5 ${y + 1.75} 15.5 ${y}`);
  const plugs = ys.map((y) => sq(15.5, y - 1.375, 4, 2.75, 0.75));
  const pins = ys.map((y) => hl(y, 19.5, 21.5));
  add('charging-station', ['estación de carga', 'cargar celular', 'cargadores', 'aeropuerto', 'charging station', 'phone charging', 'charging point'], [col, ...cables, ...plugs, ...pins]);
  FILL['charging-station'] = { solid: [0, 4, 5, 6], wire: [1, 2, 3, 7, 8, 9] };
  PARTS['charging-station'] = { column: [0], cables: [1, 2, 3], plugs: [4, 5, 6, 7, 8, 9] };
}
// Power bank station: the slim cabinet with its slots and, sliding out of the middle one, a power bank
// drawn as dispositivos' battery: its body and the terminal 3 clear of its end (a plain bar read as a
// card going into a reader)
{
  const bank = sq(8.25, 9.5, 10, 5, 1.5, BR);
  const terminal = vl(21.25, 10.75, 13.25);
  add('power-bank-station', ['renta de baterías', 'batería portátil', 'estación de baterías', 'cargador', 'power bank station', 'power bank rental', 'battery rental'], [sq(2.75, 2.75, 12.5, 18.5, 3, BR), hl(5.75, 5.75, 12.25), hl(18.25, 5.75, 12.25)], {
    badge: own([bank, terminal], knockOf([bank], [[[21.25, 10.75], [21.25, 13.25]]]), { solid: [bank], wire: [terminal] }),
  });
  FILL['power-bank-station'] = { solid: [0], cut: [1, 2] };
  PARTS['power-bank-station'] = { cabinet: [0], slots: [1, 2] };
}
// Outlet with USB: dispositivos' outlet plate, two slots above and two ports below
{
  const plate = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
  add('outlet-usb', ['contacto con usb', 'enchufe', 'puertos usb', 'cargar', 'outlet usb', 'usb outlet', 'power socket'], [plate, vl(9, 6.75, 9.75), vl(15, 6.75, 9.75), sq(6.25, 13.25, 4.25, 3.25, 0.75), sq(13.5, 13.25, 4.25, 3.25, 0.75)]);
  FILL['outlet-usb'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['outlet-usb'] = { plate: [0], slots: [1, 2], ports: [3, 4] };
}

// ── Smoking ───────────────────────────────────────────────────────────────────────────────────
// Ashtray: the shallow dish in profile, a cigarette resting across its rim (the rim cleared under it),
// one wisp of smoke rising from its lit end
{
  const dish = roundpoly([[2.75, 15.25], [21.25, 15.25], [19, 20.75], [5, 20.75]], [0.75, 0.75, 1.25, 1.25]);
  const cig = roundpoly([[8.75, 12.25], [21.25, 10.25], [21.73, 13.21], [9.23, 15.21]], 0.6);
  const wisp = 'M8.25 9.25C7.05 8.33 7.05 7.42 8.25 6.5C9.45 5.58 9.45 4.67 8.25 3.75';
  add('ashtray', ['cenicero', 'zona de fumar', 'fumadores', 'cigarro', 'ashtray', 'smoking area', 'smoking zone'], [dish, wisp], { badge: own([cig, line([18.25, 10.65], [18.73, 13.61])], cig, { solid: [cig], cut: [line([18.25, 10.65], [18.73, 13.61])] }) });
  FILL.ashtray = { solid: [0], lines: [1] };
  PARTS.ashtray = { dish: [0], smoke: [1] };
}

// Litter bin: the round bin on its post, its dome over the hood's rim and the opening at the front
{
  const bin = 'M6.5 9.25A5.5 5.5 0 0 1 17.5 9.25V15.5A2.5 2.5 0 0 1 15 18H9A2.5 2.5 0 0 1 6.5 15.5Z';
  add('litter-bin', ['papelera', 'bote de basura', 'cesto', 'basura en la calle', 'litter bin', 'trash can', 'waste bin'], [bin, hl(9.25, 6.5, 17.5), sq(9.5, 12.25, 5, 2.5, 1.25), vl(12, 18, 21.25), hl(21.25, 9, 15)]);
  FILL['litter-bin'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS['litter-bin'] = { bin: [0, 1, 2], post: [3, 4] };
}

// ── Figures and what they must not do ─────────────────────────────────────────────────────────
// Stroller access: the walking figure pushing bebes' stroller ahead of it by its handle; the stroller
// drawn again with bebes' construction at this size (scaled down, its basket ran into its wheels):
// the round basket, its hood over the front, the handle rising back to the hand and two wheels free
// below it
{
  const g = walkPose(0.88, -5.25);
  const grip = [11, 9.75];
  g.arms = [[g.at([8.25, 11.25]), g.at([9, 10]), g.S, g.at([14.25, 11.75]), grip]];
  const basket = 'M13.5 11.25H21.25A3.875 3.875 0 0 1 13.5 11.25Z';
  const hood = 'M21.25 11.25A3.875 3.875 0 0 0 17.375 7.375V11.25Z';
  const d = [...figure(g), basket, hood, line([13.5, 11.25], grip), circ(14.25, 19.75, 1.5), circ(20, 20, 1.25)];
  add('figure-stroller', ['acceso con carriola', 'carriola', 'ruta para carriolas', 'familias', 'stroller access', 'stroller friendly', 'pram access'], d);
  FILL['figure-stroller'] = { solid: [0, 5, 6, 8, 9], cut: [line([21.25, 11.25], [17.375, 11.25], [17.375, 7.375])], wire: [1, 2, 3, 4, 7] };
  PARTS['figure-stroller'] = { head: [0], body: [1], legs: [2, 3], arms: [4], stroller: [5, 6, 7, 8, 9] };
}
// Climbing over a railing: the figure in profile steps up onto the top bar, one foot on it and its
// hands on it ahead; the bar stops 3 from the leg it stands on
{
  const y = 14.5;
  const P = [9, 12.25];
  const S = add2(P, mul(unit([2.5, -4.9]), 5.5));
  const g = { H: headAt(S, 30), S, P, legs: [[[7.5, 21.25], P, [12.75, 11.75], [13.75, y]]], arms: [[S, [15.75, 9.5], [17.5, y]]] };
  const bars = clear([2.75, y], [21.25, y], [{ poly: [[7.5, 21.25], P] }]);
  const d = [...figure(g), ...bars, ...[4, 12, 16, 20].map((x) => vl(x, y, 21.25))];
  add('figure-climbing', ['trepar', 'escalar la reja', 'no trepar', 'barandal', 'climbing', 'do not climb', 'climb over railing'], d);
  FILL['figure-climbing'] = { solid: [0], wire: d.map((_, i) => i).slice(1) };
  PARTS['figure-climbing'] = { ...figParts(1, 1), railing: d.map((_, i) => i).slice(4) };
}
// Leaning: personas' figure in profile at 90 %, facing left, its body held straight and tilted back
// 20° until the back of its head rests on the door line (the head touches it), the feet out in front
// a stride apart (a narrower crotch filled in unevenly from weight to weight) and the arm hanging
// forward (personas' standing arm, turned with the body). The door line stands clear of the
// shoulders, so nothing passes behind the figure, and runs well past the head (at full size the
// stub above the head merged into it at bold).
{
  const k = 0.9;
  const tilt = [Math.sin(rad(20)), -Math.cos(rad(20))];
  const F = [9.25, 21.25];
  const P = add2(F, mul(tilt, 7 * k));
  const S = add2(P, mul(tilt, 5.5 * k));
  const H = add2(S, mul(tilt, HR * k + GAP));
  const W = H[0] + HR * k;
  const arm = [[-2.75 * k, 2.5 * k], [-3.25 * k, 5.25 * k]].map((p) => add2(S, rot(p, [0, 0], 20)));
  const g = { H, hr: HR * k, S, P, legs: [[[F[0] - 2.25, 21.25], P, [F[0] + 1.75, 21.25]]], arms: [[S, ...arm]] };
  const d = [...figure(g), vl(W, 2.75, 21.25)];
  add('figure-leaning', ['recargarse', 'no recargarse', 'puerta del tren', 'apoyarse', 'leaning', 'do not lean', 'lean on door'], d);
  FILL['figure-leaning'] = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS['figure-leaning'] = { ...figParts(1, 1), door: [4] };
}
// Litter: a figure in profile dropping a scrap into the bin at its side; with the slash, no littering
{
  const g = sideStand(6.5);
  g.arms = [[g.S, [10.25, 10.25], [13.75, 9.25]]];
  const bin = roundpoly([[14.75, 15], [21.25, 15], [20.5, 21.25], [15.5, 21.25]], [0.5, 0.5, 1, 1]);
  add('figure-litter', ['tirar basura en su lugar', 'deposite la basura', 'no tirar basura', 'limpieza', 'put litter in the bin', 'no littering', 'keep clean'], [...figure(g), bin, dot(17, 11.75)]);
  FILL['figure-litter'] = { solid: [0, 4, 5], wire: [1, 2, 3] };
  PARTS['figure-litter'] = { ...figParts(1, 1), bin: [4], scrap: [5] };
}
// Diving: personas' figure flying headfirst down toward the water, its legs a short step apart and
// its arms raised past its head, personas' arms-raised (one arm bent down from the shoulder, or the
// arms in line with the torso, read as a stick and a ball). It dives down to the left, across the
// slash's diagonal: diving down to the right, the slash ran along the whole figure and wiped it out.
{
  const k = 0.8;
  // Drawn upright about the shoulders, turned 135° to dive down to the right, then mirrored
  // The arms at full size, so the forearms stand 2.85 clear of the smaller head
  const raised = (m) => [[m * 5.15, -6.45], [m * 4.01, -1.07]];
  const up = { H: [0, -(HR * k + GAP)], P: [0, 5.5 * k], arms: [...raised(-1), [0, 0], ...raised(1).reverse()] };
  const T = (p) => add2([11.25, 9.5], rot(p, [0, 0], 135));
  const P = T(up.P);
  const g = { H: T(up.H), hr: HR * k, S: T([0, 0]), P, legs: [[T([-1.5, 11.5 * k]), P, T([1.5, 11.5 * k])]], arms: [up.arms.map(T)] };
  const waves = `M2.75 21.25${[0, 1, 2, 3].map(() => 'q1.15 -1.1 2.31 0t2.31 0').join('')}`;
  add('figure-diving', ['clavado', 'zambullirse', 'no clavados', 'alberca', 'diving', 'no diving', 'dive'], [...figure(g), waves].map((d) => flipPath(d)));
  FILL['figure-diving'] = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS['figure-diving'] = { ...figParts(1, 1), water: [4] };
}

// Feeding birds: comercio's open palm up at the top left (at 80 %: smaller, its cuff closed up), three
// seeds falling from its fingers, and a pigeon on the ground facing them; with the slash, don't feed
// the birds
{
  const palm = [comercio.icons.donation.d[1], comercio.icons.donation.d[2]].map((d) => place(d, 0.8, [2.75, 13.25], [2.75, 2.75]));
  const bird = (d) => flipPath(place(d, 0.92, [12, 21.25]));
  const pigeon = bird('M11 13.6L12.2 12.85A1.75 1.75 0 0 1 15.4 12.45C15.6 13.6 16.4 14.4 17.75 14.75L21.25 15.5L20.25 17C19 18.75 17.5 19.25 16 19.25C13.75 19.25 12.5 17.75 12.5 16L12.25 14.25Z');
  const legs = [line([14.5, 19.1], [14.5, 21.5]), line([17.75, 19], [17.75, 21.5])].map(bird);
  add('feeding-birds', ['alimentar aves', 'dar de comer a las palomas', 'no alimentar a las aves', 'parque', 'feeding birds', 'do not feed the birds', 'pigeons'], [...palm, dot(17.75, 8.5), dot(19.5, 12.5), dot(16.75, 16), pigeon, ...legs]);
  FILL['feeding-birds'] = { solid: [0, shut(palm[1]), 2, 3, 4, 5], wire: [6, 7] };
  PARTS['feeding-birds'] = { hand: [0, 1], seeds: [2, 3, 4], pigeon: [5, 6, 7] };
}
// On the grass: a shoe's sole print, wide at the toe and narrow at the arch (at 90 %), over the lawn's
// edge, a row of pointed blades, taller and shorter in turn (single slanted blades read as rain, tufts
// of three as arrows down); with the slash, keep off the grass
{
  const print = place(turnPath(PRINT, 14, [12, 9.25]), 0.9, [12.38, 2.85], [12, 3]);
  const tips = [17, 18.5, 17, 18.5, 17];
  const grass = line(...tips.flatMap((y, i) => [[2.75 + 3.7 * i, 21.25], [4.6 + 3.7 * i, y]]), [21.25, 21.25]);
  add('lawn-footprint', ['pisar el pasto', 'no pisar el césped', 'jardín', 'pasto', 'lawn footprint', 'keep off the grass', 'stepping on grass'], [print, grass]);
  FILL['lawn-footprint'] = { solid: [0], wire: [1] };
  PARTS['lawn-footprint'] = { sole: [0], grass: [1] };
}
// Picking flowers: gestos' fist turned on its side holding a flower, lugares' (its petals at 62 %),
// whose stem it hides (its shortest seam left out: at this size it ended next to the thumb); with the slash, don't pick the flowers (a pinching hand at this size read as
// tweezers, a smaller fist as a jar)
{
  const petals = place(lugares.icons.flower.d[0], 0.62, [12, 8.75], [14.25, 6]);
  const fist = gestos.icons['hand-fist'].d.slice(0, 4).map((d) => place(turnPath(d, 90, [12, 10.75]), 0.78, [12, 10.75], [13, 16.75]));
  add('picking-flowers', ['cortar flores', 'no cortar las flores', 'jardín', 'parque', 'picking flowers', 'do not pick flowers', 'flower bed'], [petals, ...fist]);
  FILL['picking-flowers'] = { solid: [0, 1], cut: [2, 3, 4] };
  PARTS['picking-flowers'] = { flower: [0], hand: [1, 2, 3, 4] };
}
// Touching: comunicacion's raised hand turned to the right, its fingers flat against a surface (the
// outline and the seams stop on it); with the slash, do not touch. Contact arcs beyond the surface
// could not stand clear of it.
{
  const Xs = 18.25;
  const toRight = (d) => place(turnPath(d, 90, [13.25, 4.75]), 1, [13.25, 4.75], [Xs, 13]);
  const hand = 'M7.25 13.51V4.75H19.25V14.5C19.25 18.1 16.65 20.75 13.5 20.75C10.65 20.75 9.29 20.35 8.39 19.25L3.89 14.25A1.5 1.5 0 0 1 6.11 12.25Z';
  const outline = toRight('M19.25 4.75V14.5C19.25 18.1 16.65 20.75 13.5 20.75C10.65 20.75 9.29 20.35 8.39 19.25L3.89 14.25A1.5 1.5 0 0 1 6.11 12.25L7.25 13.51V4.75');
  const seams = [10.25, 13.25, 16.25].map((x) => toRight(line([x, 4.75], [x, 11.25])));
  add('hand-touch', ['tocar', 'no tocar', 'museo', 'vitrina', 'hand touch', 'do not touch', 'touch surface'], [outline, ...seams, vl(Xs, 2.75, 21.25)]);
  FILL['hand-touch'] = { solid: [shut(toRight(hand))], cut: [1, 2, 3], wire: [4] };
  PARTS['hand-touch'] = { hand: [0, 1, 2, 3], surface: [4] };
}
// Shoes off: a pair of shoes from above, toes to the edge of the raised step they were taken off at,
// the opening of each a curve across its back
{
  const shoe = (cx) => [sole([cx, 7.75], 13.5, 3, 2.25), `M${cx - 2.6} 15.25C${cx - 1.25} 13.75 ${cx + 1.25} 13.75 ${cx + 2.6} 15.25`];
  add('shoes-off', ['quitarse los zapatos', 'descalzo', 'sin zapatos', 'entrada', 'shoes off', 'remove your shoes', 'no shoes'], [hl(4.75, 2.75, 21.25), ...shoe(7.75), ...shoe(16.25)]);
  FILL['shoes-off'] = { solid: [1, 3], cut: [2, 4], wire: [0] };
  PARTS['shoes-off'] = { step: [0], shoes: [1, 2, 3, 4] };
}
// Motorcycle helmet: a full-face helmet in profile, its visor opening and its chin bar below it
{
  const shell = 'M5.5 18.75C3.75 15.5 3.25 11.75 4.5 8.5C5.75 5.25 8.75 3.25 12.5 3.25C17.25 3.25 20.75 6.75 20.75 11.25V15.75C20.75 17.75 19.25 19.25 17.25 19.25H7.5C6.65 19.25 5.9 19.1 5.5 18.75Z';
  const visor = 'M20.75 9.25H13.75A1.75 1.75 0 0 0 12 11V12A1.75 1.75 0 0 0 13.75 13.75H20.75';
  add('motorcycle-helmet', ['casco de moto', 'casco', 'motociclista', 'retirar el casco', 'motorcycle helmet', 'helmet', 'remove helmet'], [shell, visor]);
  FILL['motorcycle-helmet'] = { solid: [0], cut: [1] };
  PARTS['motorcycle-helmet'] = { shell: [0], visor: [1] };
}

// ── Signs and wayfinding ──────────────────────────────────────────────────────────────────────
// Building directory: the tall board, a row per floor or tenant, each an arrow pointing on (rows of
// different lengths, so their heads don't stack)
{
  const rows = [
    [7.5, 16.25],
    [12, 13.5],
    [16.5, 16.25],
  ].flatMap(([y, x]) => arrow([7.75, y], [x, y], 2.25));
  add('directory-board', ['directorio', 'tablero de pisos', 'listado de oficinas', 'edificio', 'directory board', 'building directory', 'floor directory'], [sq(4.25, 2.75, 15.5, 18.5, 3, BR), ...rows]);
  FILL['directory-board'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['directory-board'] = { board: [0], rows: [1, 2, 3, 4, 5, 6] };
  // 16 px: two rows
  {
    const board = icons['directory-board'].d[0];
    const two = [8.25, 15.75].flatMap((y) => arrow([8.25, y], [15.75, y], 2.25));
    icons['directory-board'].small = { d: [board, ...two], fill: { solid: [board], cut: two } };
  }
}
// You are here: lugares' map at 95 % on its stand, the ringed dot of where you stand on it (the map's
// folds left out: they would run through the ring); the ring as wide as the map's edges allow, so
// the dot keeps its paper inside it at bold
{
  const map = place(lugares.icons.map.d[0], 0.95, [12, 12], [12, 9.5]);
  add('you-are-here', ['usted está aquí', 'mapa del lugar', 'ubicación', 'plano', 'you are here', 'venue map', 'site map'], [map, circ(12, 9.5, 3.25), dot(12, 9.5), vl(12, 16.03, 21.25), hl(21.25, 8.5, 15.5)]);
  FILL['you-are-here'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS['you-are-here'] = { map: [0], marker: [1, 2], stand: [3, 4] };
  // 16 px: the marker a ring alone (its dot ran into it)
  {
    const [m, , , post, base] = icons['you-are-here'].d;
    icons['you-are-here'].small = { d: [m, circ(12, 9.5, 2.25), post, base], fill: { solid: [m], cut: [circ(12, 9.5, 2.25)], wire: [post, base] } };
  }
}
// Wayfinding kiosk: restaurante's order kiosk, its screen taller and a map pin on it
{
  const k = restaurante.icons['order-kiosk'].d;
  const pin = 'M14.12 10.12A3 3 0 1 0 9.88 10.12L12 12.25Z';
  add('map-kiosk', ['kiosco interactivo', 'mapa táctil', 'pantalla de rutas', 'directorio digital', 'map kiosk', 'wayfinding kiosk', 'interactive map'], [k[0], hl(15.25, 6, 18), pin, k[3], k[4]]);
  FILL['map-kiosk'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS['map-kiosk'] = { body: [0, 1], pin: [2], stand: [3, 4] };
}
// Floor marking: a floor in perspective and a thick arrow lying on it, pointing on
{
  const floor = roundpoly([[6.75, 6.75], [17.25, 6.75], [21.25, 20.25], [2.75, 20.25]], 0.75);
  const arrowD = roundpoly([[12, 9.75], [15.75, 13.5], [13.5, 13.5], [13.75, 17.25], [10.25, 17.25], [10.5, 13.5], [8.25, 13.5]], [0.6, 0.5, 0.3, 0.4, 0.4, 0.3, 0.5]);
  add('floor-arrow', ['señal en el piso', 'flecha en el suelo', 'ruta marcada', 'circulación', 'floor arrow', 'floor marking', 'floor guide'], [floor, arrowD]);
  FILL['floor-arrow'] = { solid: [0], cut: [1] };
  PARTS['floor-arrow'] = { floor: [0], arrow: [1] };
  // 16 px: the arrow as a line and its head
  {
    const thin = arrow([12, 17.25], [12, 10.5], 2.5);
    icons['floor-arrow'].small = { d: [floor, ...thin], fill: { solid: [floor], cut: thin } };
  }
}
// Overhead sign: a wide panel hung from the ceiling by two rods, an arrow in it
{
  add('sign-hanging', ['señal colgante', 'letrero aéreo', 'señalización', 'terminal', 'hanging sign', 'overhead sign', 'ceiling sign'], [hl(3, 2.75, 21.25), vl(7, 3, 8), vl(17, 3, 8), sq(2.75, 8, 18.5, 10, 2.5, BR), ...arrow([7.25, 13], [16.75, 13], 2.75)]);
  FILL['sign-hanging'] = { solid: [3], cut: [4, 5], wire: [0, 1, 2] };
  PARTS['sign-hanging'] = { ceiling: [0], rods: [1, 2], panel: [3], arrow: [4, 5] };
}
// Wayfinding totem: the pylon, three rows of arrows pointing on, back and on
{
  const rows = [
    arrow([9.75, 6.75], [14.25, 6.75], 1.5),
    arrow([14.25, 11], [9.75, 11], 1.5),
    arrow([9.75, 15.25], [14.25, 15.25], 1.5),
  ].flat();
  add('sign-totem', ['tótem', 'señal de piso', 'pilón de señalización', 'directorio exterior', 'sign totem', 'wayfinding pylon', 'monolith sign'], [PYLON, ...rows]);
  FILL['sign-totem'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['sign-totem'] = { pylon: [0], rows: [1, 2, 3, 4, 5, 6] };
}
// Wayfinding: the walking figure beside lugares' signpost (its signs at 70 %, the post between them
// kept long enough to read)
{
  const [x, s] = [17, 0.7];
  const sign = (d, cy, y) => place(d, s, [12, cy], [x, y]);
  const [top, bottom] = [sign(lugares.icons.signpost.d[0], 7.5, 8.5), sign(lugares.icons.signpost.d[1], 15.5, 14.65)];
  const post = [vl(x, 4.55, 6.58), vl(x, 10.43, 12.73), vl(x, 16.58, 21.25)];
  const w = walkPose(0.78, -6.5);
  const d = [...figure({ ...w, arms: [[w.at([8.25, 11.25]), w.at([9, 10]), w.S, w.at([14.75, 11.5]), w.at([16.25, 12.5])]] }), top, bottom, ...post];
  add('wayfinding', ['señalización', 'orientación', 'cómo llegar', 'seguir las señales', 'wayfinding', 'follow the signs', 'directions'], d);
  FILL.wayfinding = { solid: [0, 5, 6], wire: [1, 2, 3, 4, 7, 8, 9] };
  PARTS.wayfinding = { head: [0], body: [1], legs: [2, 3], arms: [4], signpost: [5, 6, 7, 8, 9] };
}
// Tactile paving: a paving tile in perspective with its four raised guidance bars running along it
{
  const tile = roundpoly([[4.5, 4.75], [19.5, 4.75], [21.75, 19.25], [2.25, 19.25]], 0.75);
  const bars = [0, 1, 2, 3].map((i) => line([7.5 + 3 * i, 7.75], [5.75 + (12.5 / 3) * i, 16.25]));
  add('tactile-paving', ['piso podotáctil', 'guía táctil', 'baldosa guía', 'accesibilidad', 'tactile paving', 'guidance strip', 'tactile tiles'], [tile, ...bars]);
  FILL['tactile-paving'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['tactile-paving'] = { tile: [0], bars: [1, 2, 3, 4] };
  // 16 px: three bars
  {
    const three = [0, 1, 2].map((i) => line([8.25 + 3.75 * i, 7.75], [6.75 + 5.25 * i, 16.25]));
    icons['tactile-paving'].small = { d: [tile, ...three], fill: { solid: [tile], cut: three } };
  }
}
// Tactile map: the panel, a raised route across it and a column of braille dots beside the route
{
  add('tactile-map', ['mapa táctil', 'mapa en braille', 'plano en relieve', 'accesibilidad', 'tactile map', 'braille map', 'raised map'], [
    sq(2.75, 3.25, 18.5, 17.5, 3, BR),
    rl([[6, 17.75], [6, 12], [10.75, 12], [10.75, 6.25], [13.75, 6.25]], 1.25),
    dot(17.5, 7),
    dot(17.5, 11.5),
    dot(17.5, 16),
  ]);
  FILL['tactile-map'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['tactile-map'] = { panel: [0], route: [1], braille: [2, 3, 4] };
}

// ── Fill, parts, variants, mirroring and motion ──────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : i));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// With a badge the enclosures stop reading at 58 % and the slash would cut through it (personas)
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };
// A slash says nothing on the panel symbols and the signs that only point the way; the prohibitions
// (the figures' actions, the grass, the flowers, the helmet, the paper) keep it
for (const name of ['elevator-door-open', 'elevator-door-close', 'directory-board', 'sign-hanging', 'sign-totem', 'floor-arrow', 'you-are-here', 'map-kiosk', 'wayfinding'])
  icons[name].variants = { ...icons[name].variants, slash: false };
// The floor decal is already a circle
icons['stand-here'].variants = { circle: false };

// Directional: whatever moves or faces one way (the figures in profile and the walkers, the arrows,
// the escalators and stairs as hogar's stairs) flips in right-to-left languages; front views, the
// symmetrical signs and the objects keep their side
for (const name of [
  'escalator', 'escalator-up', 'escalator-down', 'moving-walkway', 'ramp', 'stairs-up', 'stairs-down', 'door-push', 'door-pull',
  'figure-stroller', 'figure-climbing', 'figure-leaning', 'figure-litter', 'figure-diving', 'feeding-birds', 'directory-board',
  'sign-hanging', 'sign-totem', 'wayfinding', 'wait-here',
])
  icons[name].mirror = true;

// Motion: the riders and walkers move along their way, the arrows slide, the flush and the revolving
// door turn, the hanging things swing, the smoke rises, the marker beats
const FIGURE = ['head', 'body', 'legs', 'arms'];
icons.escalator.motion = { effect: 'slide', parts: FIGURE, vector: [1.2, -1.5] };
icons['escalator-up'].motion = { effect: 'slide', parts: ['badge'], vector: [0, -1.5] };
icons['escalator-down'].motion = { effect: 'slide', parts: ['badge'], vector: [0, 1.5] };
icons['stairs-up'].motion = { effect: 'slide', parts: ['badge'], vector: [0, -1.5] };
icons['stairs-down'].motion = { effect: 'slide', parts: ['badge'], vector: [0, 1.5] };
icons['moving-walkway'].motion = { effect: 'slide', parts: [...FIGURE, 'arrow'], vector: [1.5, 0] };
icons.ramp.motion = { effect: 'slide', parts: FIGURE, vector: [1.5, -0.7] };
icons['toilet-paper-flush'].motion = { effect: 'slide', parts: ['paper', 'arrow'], vector: [0, 1.5] };
icons['toilet-flush'].motion = { effect: 'spin', parts: ['swirl'], origin: [14.75, 7.75] };
icons['hand-washing'].motion = { effect: 'slide', parts: ['stream', 'drops'], vector: [0, 1] };
icons['door-revolving'].motion = { effect: 'spin', parts: ['post', 'wings'], origin: [12, 12] };
icons['door-push'].motion = { effect: 'slide', parts: ['badge'], vector: [1.5, 0] };
icons['door-pull'].motion = { effect: 'slide', parts: ['badge'], vector: [-1.5, 0] };
icons['press-button'].motion = { effect: 'slide', parts: ['badge'], vector: [1.25, 0] };
icons['wait-here'].motion = { effect: 'slide', parts: FIGURE, vector: [1, 0] };
icons['lost-and-found'].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };
icons['coat-check'].motion = { effect: 'ring', origin: [12, 3.25] };
icons['locker-key'].motion = { effect: 'ring', parts: ['key'], origin: [13.75, 13.75] };
icons['power-bank-station'].motion = { effect: 'slide', parts: ['badge'], vector: [1.5, 0] };
icons.ashtray.motion = { effect: 'float', parts: ['smoke'], vector: [0, -1] };
icons['figure-stroller'].motion = { effect: 'slide', vector: [1.5, 0] };
icons['figure-climbing'].motion = { effect: 'bounce', parts: FIGURE, vector: [0, -1.25] };
icons['figure-litter'].motion = { effect: 'slide', parts: ['scrap'], vector: [0, 1.5] };
icons['figure-diving'].motion = { effect: 'slide', parts: FIGURE, vector: [-1.25, 0.8] };
icons['feeding-birds'].motion = { effect: 'slide', parts: ['seeds'], vector: [0.5, 1.5] };
icons['hand-touch'].motion = { effect: 'slide', parts: ['hand'], vector: [0.75, 0] };
icons['sign-hanging'].motion = { effect: 'ring', origin: [12, 3] };
icons['floor-arrow'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1] };
icons['you-are-here'].motion = { effect: 'beat', parts: ['marker'], origin: [12, 9.5] };
icons['map-kiosk'].motion = { effect: 'bounce', parts: ['pin'], vector: [0, -1.5] };
icons.wayfinding.motion = { effect: 'slide', parts: FIGURE, vector: [1.5, 0] };

export default { category: 'senales', label: 'Señalética', icons };
