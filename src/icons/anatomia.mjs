// Cuerpo y anatomía (body and anatomy): the body and its regions for symptom pickers, the joints,
// the skeleton and the muscles, the head's senses (ear, nose, mouth, teeth, eye), hair and skin,
// the organs, and the cells. Everything is computed with the engine (engine/geometry.mjs) and the
// rules in DESIGN.md. Organs and body parts are clear medical silhouettes, never gore. A few bases
// carry the families: the body seen from the front (one outline for the front, the back and its
// badges), the head in profile (with and without the brain), the skin's surface block (one block for
// every skin type), the hair's parting (one parting for every hair type) and the muscle's spindle.
// Every badge is the engine's; the thyroid's gland and the oil drop on the skin are pieces on top, which
// the engine clears the same way.
import { arc, badge, circ, dot, f, flipPath, halfChord, line, polar, rot, roundpoly } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Mirrors a list of points across x = 12 and walks it backwards (the left half of a symmetric outline). */
const mirrorPts = (pts) => [...pts].reverse().map(([x, y, ...rest]) => [24 - x, y, ...rest]);
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

/**
 * The cubic segments of a smooth curve through `pts` (Catmull-Rom, as Béziers), without its M. A
 * point's third value scales its tangent: 0 makes it a corner, 1 (the default) a smooth point.
 */
function splineSegs(pts, closed = false) {
  const n = pts.length;
  const P = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const k = (i) => {
    const p = P(i);
    return p.length > 2 ? p[2] : 1;
  };
  let s = '';
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    const t1 = mul(sub(p2, p0), k(i) / 6);
    const t2 = mul(sub(p3, p1), k(i + 1) / 6);
    s += `C${pt(add2(p1, t1))} ${pt(sub(p2, t2))} ${pt(p2)}`;
  }
  return s;
}
/** A smooth curve through `pts` (closed when `closed`). */
const spline = (pts, closed = false) => `M${pt(pts[0])}${splineSegs(pts, closed)}${closed ? 'Z' : ''}`;

/** Ellipse with semi-axes rx, ry (four cubics), as hogar's. */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}
/** Turns a path of absolute M, L and C commands (what ell, spline and line write) `deg` degrees around the origin and moves it to `c`. */
function turnAt(d, deg, c) {
  const a = (deg * Math.PI) / 180;
  const [co, si] = [Math.cos(a), Math.sin(a)];
  return d.replace(/(-?\d*\.?\d+)\s+(-?\d*\.?\d+)/g, (_, x, y) => {
    const [X, Y] = [Number(x), Number(y)];
    return `${f(c[0] + X * co - Y * si)} ${f(c[1] + X * si + Y * co)}`;
  });
}
/**
 * Where a path of absolute M, L and C commands crosses the vertical x (or, with `horizontal`, the
 * horizontal y): the crossing nearest `hint`. Pieces that must end on an outline end exactly on it.
 */
function onPath(d, at, hint, horizontal = false) {
  const nums = (str) => str.match(/-?\d*\.?\d+/g).map(Number);
  const segs = d.match(/[MLCZ][^MLCZ]*/g);
  const pts = [];
  let cur = [0, 0];
  let start = [0, 0];
  for (const sg of segs) {
    const c = sg[0];
    const v = c === 'Z' ? [] : nums(sg.slice(1));
    if (c === 'M') [cur, start] = [[v[0], v[1]], [v[0], v[1]]];
    else if (c === 'L' || c === 'Z') {
      const to = c === 'Z' ? start : [v[0], v[1]];
      for (let i = 1; i <= 20; i++) pts.push(lerp(cur, to, i / 20));
      cur = to;
    } else if (c === 'C') {
      const [a, b, e] = [[v[0], v[1]], [v[2], v[3]], [v[4], v[5]]];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const u = 1 - t;
        pts.push([u ** 3 * cur[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t ** 3 * e[0], u ** 3 * cur[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t ** 3 * e[1]]);
      }
      cur = e;
    }
  }
  const k = horizontal ? 1 : 0;
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const [p, q] = [pts[i - 1], pts[i]];
    if ((p[k] - at) * (q[k] - at) > 0 || p[k] === q[k]) continue;
    const pnt = lerp(p, q, (at - p[k]) / (q[k] - p[k]));
    if (!best || len(sub(pnt, hint)) < len(sub(best, hint))) best = pnt;
  }
  return best;
}
/** An ellipse turned `deg` degrees around its center. */
const tilted = (c, rx, ry, deg) => turnAt(ell([0, 0], rx, ry), deg, c);

/**
 * A tube around a centerline: `c` its points, `w` its half-width (one, or one per point). Its ends
 * are 'round' (a half circle), 'flat' or 'open' (left open, for a bone or a limb cropped by the
 * canvas: the outline is then an open U). Returns the path.
 */
function tube(c, w, { start = 'round', end = 'round', onto } = {}) {
  const n = c.length;
  const W = Array.isArray(w) ? w : c.map(() => w);
  const nrm = c.map((_, i) => {
    const t = unit(sub(c[Math.min(n - 1, i + 1)], c[Math.max(0, i - 1)]));
    return [-t[1], t[0]];
  });
  const L = c.map((p, i) => add2(p, mul(nrm[i], W[i])));
  const R = c.map((p, i) => sub(p, mul(nrm[i], W[i])));
  // An open start that grows out of an outline: its two walls start exactly on it
  if (onto && start === 'open') {
    L[0] = onPath(onto, L[0][0], L[0]);
    R[0] = onPath(onto, R[0][0], R[0]);
  }
  const Rb = [...R].reverse();
  // A half circle from a to b around the end at `i`, bulging out along the tube (its sweep from the
  // turn a → tip → b)
  const cap = (a, b, kind, i, dir) => {
    if (kind === 'flat') return `L${pt(b)}`;
    const t = unit(mul(sub(c[i], c[i - dir]), 1));
    const tip = add2(c[i], mul(t, W[i]));
    const turnSign = (tip[0] - a[0]) * (b[1] - tip[1]) - (tip[1] - a[1]) * (b[0] - tip[0]);
    const r = halfChord(a, b);
    return `A${r} ${r} 0 0 ${turnSign > 0 ? 1 : 0} ${pt(b)}`;
  };
  const capEnd = (kind) => cap(L[n - 1], R[n - 1], kind, n - 1, 1);
  const capStart = (kind) => cap(R[0], L[0], kind, 0, -1);
  if (start === 'open' && end === 'open') return `M${pt(L[0])}${splineSegs(L)}M${pt(R[0])}${splineSegs(R)}`;
  if (start === 'open') return `M${pt(L[0])}${splineSegs(L)}${capEnd(end)}${splineSegs(Rb)}`;
  if (end === 'open') return `M${pt(R[n - 1])}${splineSegs(Rb)}${capStart(start)}${splineSegs(L)}`;
  return `M${pt(L[0])}${splineSegs(L)}${capEnd(end)}${splineSegs(Rb)}${capStart(start)}Z`;
}

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

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};

// ── The body, from the front ──────────────────────────────────────────────────────────────────
// The core person's head (a circle 2.45 above the shoulders) on a body outline in the anatomical
// position: the arms held away from the sides (a V of paper from the armpit to the hand), the legs
// apart. One closed outline, its right half drawn and mirrored; its corners are roundpoly's.
const BODY_R = [
  [[16.5, 9], 2.25], // shoulder
  [[21, 14.6], 1.2], // hand, outer edge
  [[18.3, 16.3], 1.2], // hand, inner edge
  [[15, 11.9], 0], // armpit
  [[14.9, 14.25], 1.6], // hip
  [[16.9, 21.75], 0], // foot, outer edge
  [[14.15, 21.75], 0], // foot, inner edge
];
const CROTCH = [[12, 15.75], 0];
function bodyOutline(T = (p) => p, k = 1) {
  const all = [...BODY_R, CROTCH, ...[...BODY_R].reverse().map(([p, r]) => [[24 - p[0], p[1]], r])];
  // Scaled down, a round corner keeps a radius of at least 1.15: under half the bold stroke its
  // inside would fold over
  return roundpoly(all.map(([p]) => T(p)), all.map(([, r]) => (r ? Math.max(1.15, r * k) : 0)));
}
const HEAD = circ(12, 4.4, 2.15);
const BODY = bodyOutline();
const NAVEL = dot(12, 12.6, 0.5);
add('body', ['cuerpo', 'cuerpo humano', 'mapa corporal', 'silueta', 'body', 'human body', 'body map'], [HEAD, BODY, NAVEL]);
FILL.body = { solid: [0, 1], cut: [2] };
PARTS.body = { head: [0], body: [1], navel: [2] };

// From behind: the same outline and, in place of the navel, the line of the lower spine running down
// into the seat. (Shoulder blades left under 1.5 of paper to the spine and the armpits in a trunk this
// narrow, and a spine hanging from the collar read as a tie: the line rising from the seat tells the
// back from the front.)
{
  const spine = line([12, 12.25], [12, 15.75]);
  add('body-back', ['espalda', 'cuerpo de espaldas', 'vista posterior', 'mapa corporal', 'body back', 'back view', 'posterior'], [HEAD, BODY, spine]);
  FILL['body-back'] = { solid: [0, 1], cut: [2] };
  PARTS['body-back'] = { head: [0], body: [1], spine: [2] };
}

// With a badge: the body a little smaller and to the left, placed so the badge's clearance crosses its
// right arm and leg cleanly at every weight instead of grazing a corner (the navel, under the
// clearance, goes)
const BODY_S = (() => {
  const k = 0.92;
  const T = (p) => [p[0] * k + 12 * (1 - k) - 1, p[1] * k + 2.25 * (1 - k)];
  return [scale(HEAD, k, [12, 2.25], -1), bodyOutline(T, k)];
})();
add('body-search', ['buscar síntoma', 'verificador de síntomas', 'qué me duele', 'symptom checker', 'find symptom', 'body search'], BODY_S, { badge: badge('search') });
add('body-alert', ['reportar síntoma', 'lesión', 'dolor', 'zona afectada', 'report symptom', 'injury', 'pain'], BODY_S, { badge: badge('alert') });
for (const name of ['body-search', 'body-alert']) {
  FILL[name] = { solid: [0, 1] };
  PARTS[name] = { head: [0], body: [1] };
}

// Height: the body, a little smaller and to the left (its trunk then too narrow for the navel), and
// beside it a dimension line with a tick at the top of the head and one at the feet
{
  const [k, dx] = [0.88, -2.025];
  const T = (p) => [p[0] * k + 12 * (1 - k) + dx, p[1] * k + 21.75 * (1 - k)];
  const head = scale(HEAD, k, [12, 21.75], dx);
  const body = bodyOutline(T, k);
  const top = T([12, 2.25])[1];
  const bar = line([20.75, top], [20.75, 21.75]);
  const ticks = [line([19.75, top], [21.75, top]), line([19.75, 21.75], [21.75, 21.75])];
  add('body-height', ['estatura', 'altura', 'talla', 'medir', 'height', 'stature', 'measure'], [head, body, bar, ...ticks]);
  FILL['body-height'] = { solid: [0, 1], lines: [2, 3, 4] };
  PARTS['body-height'] = { head: [0], body: [1], measure: [2, 3, 4] };
}

// ── The head in profile ───────────────────────────────────────────────────────────────────────
// Facing right: the back of the skull, the forehead, the brow, the nose, the lips and the chin, and
// the neck dropping below. One open stroke from the front of the neck around to its back.
const HEAD_SIDE = spline([
  [15, 21.75, 0], [15, 19.25], [16.5, 17.85], [18.6, 17.3], [19.1, 15.6], [18.6, 14.6], [19.3, 13.75, 0.6], [18.85, 12.9, 0.4],
  [20.4, 12.1, 0.6], [18.55, 9.5], [18.75, 7.75, 0.6], [17.75, 4.6], [13.25, 2.35], [7.5, 3.5], [4.1, 8.25], [4.75, 13], [7, 16.25], [8.5, 18.75],
  [8.5, 21.75, 0],
]);
add('head-side', ['cabeza', 'perfil', 'dolor de cabeza', 'neurología', 'head', 'profile', 'headache'], [HEAD_SIDE]);
FILL['head-side'] = { solid: [shut(HEAD_SIDE)] };

// With the brain: the set's brain, a row of lobes (arcs between cusps) around the back, the top and
// the front over a flatter underside, and one furrow dropping from the top; 3 clear of the skull all
// round. (A smooth bean with a notch and a fold read as an @; without the furrow the lobes read as a
// cloud, a daydream.)
{
  const T = ([x, y]) => [11.5 + (x - 11.5) * 0.8 - 0.3, 8.6 + (y - 8.6) * 0.8 + 0.9];
  const cusps = [[8.25, 11.6], [7.1, 8.75], [8.9, 6], [12, 5.25], [15, 6.1], [15.75, 9.25], [14.75, 11.75], [11.5, 11.6]].map(T);
  const bulge = [1.1, 1.2, 1.25, 1.25, 1.2, 1.05, 0.5, 0.45].map((b) => b * 0.8);
  let brain = `M${pt(cusps[0])}`;
  cusps.forEach((p, i) => {
    const q = cusps[(i + 1) % cusps.length];
    const c = len(sub(q, p));
    const r = (c * c) / 4 / (2 * bulge[i]) + bulge[i] / 2;
    brain += `A${f(r)} ${f(r)} 0 0 1 ${pt(q)}`;
  });
  brain += 'Z';
  const fold = spline([T([12, 5.25]).concat(0), T([11.4, 7.25]), T([12.4, 9])]);
  add('head-side-brain', ['mente', 'cognición', 'memoria', 'neurología', 'mind', 'cognition', 'memory'], [HEAD_SIDE, brain, fold]);
  FILL['head-side-brain'] = { solid: [shut(HEAD_SIDE)], cut: [1, 2] };
  PARTS['head-side-brain'] = { head: [0], brain: [1, 2] };
}

// ── Body regions ──────────────────────────────────────────────────────────────────────────────
// Abdomen: the sides from under the ribs to the hips (in at the waist, out at the hips), the lower
// margin of the ribs as two arcs that rise to meet at the middle, and the navel
{
  const half = [[5.5, 2.25, 0], [6.4, 8.25], [5.6, 13.5], [3.75, 21.75, 0]];
  const sides = [spline(half), spline(mirrorPts(half))];
  const ribs = spline([[5.9, 5.75, 0], [9.25, 5.1], [12, 2.85, 0], [14.75, 5.1], [18.1, 5.75, 0]]);
  add('abdomen', ['abdomen', 'vientre', 'dolor abdominal', 'estómago', 'abdomen', 'belly', 'stomach ache'], [...sides, ribs, dot(12, 13.5)]);
  FILL.abdomen = false;
}

// Lower back: the back of the trunk from the waist to the hips, the lowest three vertebrae stacked in
// the middle, and the line of the hips below them
{
  const half = [[6.25, 2.25, 0], [6.75, 7.5], [4.25, 14], [3.5, 21.75, 0]];
  const sides = [spline(half), spline(mirrorPts(half))];
  const vert = (y) => roundpoly([[9.75, y], [14.25, y], [14.25, y + 2.6], [9.75, y + 2.6]], 1.1);
  const hp = onPath(sides[0], 15.5, [4, 15.5], true);
  const hips = spline([hp.concat(0), [8, 18.25], [12, 19.25], [16, 18.25], [24 - hp[0], 15.5, 0]]);
  add('lower-back', ['espalda baja', 'zona lumbar', 'lumbago', 'dolor de espalda', 'lower back', 'lumbar', 'back pain'], [...sides, vert(2.75), vert(8.2), vert(13.65), hips]);
  FILL['lower-back'] = { solid: [2, 3, 4], lines: [0, 1, 5] };
  PARTS['lower-back'] = { trunk: [0, 1, 5], vertebrae: [2, 3, 4] };
}

// Leg, in profile facing right: from the hip, the thigh runs forward to the knee and the shin back to
// the ankle, the calf round behind it, the foot pointing right
const LEG = spline([
  [6.75, 2.25, 0], [7.4, 7], [10.4, 11.75], [9.25, 15], [10.25, 18.25], [9.4, 20.6], [10.4, 21.75, 0], [18.75, 21.75, 0], [19.5, 20.6],
  [16.25, 19.4], [13.4, 17.6], [13.4, 14.5], [16.1, 11], [14.75, 6.5], [13.5, 2.25, 0],
]);
add('leg', ['pierna', 'dolor de pierna', 'hinchazón', 'extremidad', 'leg', 'leg pain', 'swelling'], [LEG]);
FILL.leg = { solid: [shut(LEG)] };

// Foot, in profile facing right: the ankle cropped at the top, the round heel, the sole with its arch
// and the toes, the big toe's bump on top
const FOOT = spline([
  [6.75, 2.25, 0], [7, 9.25], [4.9, 13.25], [4.4, 17], [6.25, 19.6], [10.25, 19.1], [15, 19.6], [20.1, 19.4], [21.35, 17.6], [20.1, 15.75],
  [17.75, 16.1], [14.25, 14.6], [11.9, 10.25], [11.6, 2.25, 0],
]);
add('foot', ['pie', 'podología', 'dolor de pie', 'cuidado de pies', 'foot', 'podiatry', 'foot pain'], [FOOT]);
FILL.foot = { solid: [shut(FOOT)] };

// Sole, from below: the outline with its inner arch, the big toe a round pad and the other four smaller
{
  const sole = spline([[13, 21.4], [9.9, 19.6], [10.1, 16], [8.5, 12.25], [9.4, 9.1], [13.25, 8.4], [16.75, 10.1], [16.9, 13.75], [16.25, 17.75], [15.9, 20.25]], true);
  const big = ell([8.4, 4.25], 1.6, 1.9);
  const toes = [dot(12.6, 3.4, 0.3), dot(15.6, 4.15, 0.3), dot(18.1, 5.9, 0.3), dot(19.75, 8.4, 0.3)];
  add('foot-sole', ['planta del pie', 'plantilla', 'reflexología', 'pisada', 'sole', 'foot sole', 'insole'], [sole, big, ...toes]);
  FILL['foot-sole'] = { solid: [0, 1, 2, 3, 4, 5] };
  PARTS['foot-sole'] = { sole: [0], toes: [1, 2, 3, 4, 5] };
}

// ── Joints ────────────────────────────────────────────────────────────────────────────────────
// Knee, from the side facing right: the femur's rounded end over the flat top of the tibia, a gap of
// cartilage between them, and the kneecap in front
{
  const femur = spline([[8, 2.25, 0], [8, 6], [6.5, 8.5], [8.25, 10.5], [10.75, 9.75], [12.75, 10.5], [14.5, 8.5], [13, 6], [13, 2.25, 0]]);
  const tibia = spline([[8.25, 21.75, 0], [8.25, 17.5], [6.25, 15.25, 0.6], [6.75, 13.5, 0], [14.75, 13.5, 0], [15.25, 15.25, 0.6], [13, 17.5], [13, 21.75, 0]]);
  const patella = ell([18.9, 9.75], 1.75, 2.6);
  add('knee', ['rodilla', 'dolor de rodilla', 'ligamentos', 'fisioterapia', 'knee', 'knee pain', 'ligament'], [femur, tibia, patella]);
  FILL.knee = { solid: [shut(femur), shut(tibia), 2] };
  PARTS.knee = { femur: [0], tibia: [1], kneecap: [2] };
}

// Elbow, from the side, bent at a right angle: the humerus coming down from the top to its round end,
// seated in the hook of the ulna, which cups it from below (a gap of cartilage between them), rises
// behind it into the point of the elbow and runs off to the right as the forearm. (The radius, a third
// shaft along the ulna, stacked four parallel lines into a bundle of pipes: two bones, as in the knee.)
{
  const [K, kr] = [[10.25, 8.75], 2.1];
  const humerus = tube([[K[0], 2.25], [K[0], 5.25], K], [1.45, 1.45, kr], { start: 'open' });
  const Ri = kr + 3;
  // The notch from the coronoid in front, under the end and up behind it to the olecranon's tip, which
  // stops 3 short of the humerus; the tip a half circle, the back of the bone thickening down into
  // the point of the elbow
  const [cor, tipIn, tipOut] = [polar(...K, Ri, 30), polar(...K, Ri, 207), polar(...K, Ri + 2.3, 207)];
  const capR = halfChord(tipIn, tipOut);
  const ulna = `M21.75 12.1${splineSegs([[21.75, 12.1, 0], [16.5, 11.9], cor.concat(0)])}A${f(Ri)} ${f(Ri)} 0 0 1 ${pt(tipIn)}A${capR} ${capR} 0 0 0 ${pt(tipOut)}${splineSegs([tipOut.concat(0), [2.75, 9.25], [3, 13.25], [5, 16.6], [9, 17.75], [15.5, 17.4], [21.75, 16.9, 0]])}`;
  add('elbow', ['codo', 'codo de tenista', 'dolor de codo', 'fisioterapia', 'elbow', 'tennis elbow', 'elbow pain'], [humerus, ulna]);
  FILL.elbow = { solid: [shut(humerus), shut(ulna)] };
  PARTS.elbow = { humerus: [0], ulna: [1] };
}

// ── The skeleton ──────────────────────────────────────────────────────────────────────────────
// The whole skeleton, from the front, reduced to its parts: the skull, the spine, the shoulders and
// arms in one stroke on each side, two pairs of ribs, the pelvis and the legs
{
  const skull = circ(12, 3.9, 1.65);
  const spine = line([12, 8], [12, 17.2]);
  const arm = (k) => roundline([[12, 8], [12 - k * 6, 8], [12 - k * 6.75, 15]], [0, 1.5, 0]);
  const rib = (k, y) => spline([[12, y, 0], [12 - k * 2.1, y], [12 - k * 3, y + 0.3, 0]]);
  const pelvis = roundpoly([[8.25, 17.2], [15.75, 17.2], [13.9, 19.75], [10.1, 19.75]], [1.2, 1.2, 0, 0]);
  const legs = [line([10.1, 19.75], [9.5, 21.75]), line([13.9, 19.75], [14.5, 21.75])];
  add('skeleton', ['esqueleto', 'huesos', 'ortopedia', 'anatomía', 'skeleton', 'bones', 'orthopedics'], [skull, spine, arm(1), arm(-1), rib(1, 10.85), rib(-1, 10.85), rib(1, 14.05), rib(-1, 14.05), pelvis, ...legs]);
  FILL.skeleton = false;
}

// Skull, from the front: the cranium's dome narrowing at the cheekbones to the jaw, two eye sockets,
// the nose's opening, and the teeth on the jaw: the bite line across and the gaps between them
{
  const out = spline(
    [[12, 2.6], [17.6, 4.4], [20.4, 9.6], [19.25, 13.6], [16.75, 15], [16.6, 19.4], [14.75, 21.25], [9.25, 21.25], [7.4, 19.4], [7.25, 15], [4.75, 13.6], [3.6, 9.6], [6.4, 4.4]],
    true,
  );
  const eyes = [ell([8.6, 9.75], 2, 1.85), ell([15.4, 9.75], 2, 1.85)];
  const nose = roundline([[10.75, 16.1], [12, 14.45], [13.25, 16.1]], [0, 0.5, 0]);
  const teeth = `M7.38 19H16.62M10.4 19V21.25M13.6 19V21.25`;
  add('skull', ['calavera', 'cráneo', 'huesos', 'peligro', 'skull', 'cranium', 'head injury'], [out, ...eyes, nose, teeth]);
  // The gaps between the teeth cut on through the jaw's edge, so the teeth part the same at every weight
  FILL.skull = { solid: [0], cut: [1, 2, 3, `M7.38 19H16.62M10.4 19V22.6M13.6 19V22.6`] };
  PARTS.skull = { skull: [0], eyes: [1, 2], nose: [3], teeth: [4] };
}

// Spine, in profile: the column's S-curve (the neck and the small of the back hollow, the upper back
// round) as five vertebral bodies stacked down it, each a short block tilted a little with the curve
// and wider than the one above, from the neck to the lower back. Each block is closed so tight it is
// ink at every weight, as a dot is (the 16 px drawing's blocks at 24). (One outline waisted between the
// vertebrae read as a caterpillar.)
{
  const C = (t) => [12 + 1.9 * Math.sin(2 * Math.PI * (t - 0.12)), 2.25 + 19.5 * t];
  const blocks = [];
  for (let i = 0; i < 5; i++) {
    const y = 3.4 + (17.2 * i) / 4;
    const t = (y - 2.25) / 19.5;
    const c = C(t);
    const u = unit(sub(C(t + 0.001), C(t - 0.001)));
    const ang = ((Math.atan2(u[1], u[0]) * 180) / Math.PI - 90) * 0.35;
    const [w, h] = [3.9 + 0.5 * i, 0.75];
    blocks.push(roundpoly([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map((p) => add2(c, rot(p, [0, 0], ang))), 0.37));
  }
  add('spine', ['columna', 'columna vertebral', 'vértebras', 'postura', 'spine', 'backbone', 'vertebrae'], blocks);
  FILL.spine = { solid: [0, 1, 2, 3, 4] };
  PARTS.spine = { vertebrae: [0, 1, 2, 3, 4] };
}

// Ribcage, from the front: the sternum down the middle, three ribs on each side curving out and
// down from it, and the collarbones above
{
  const sternum = line([12, 5.75], [12, 15.75]);
  const rib = (k, y, w) => spline([[12, y, 0], [12 - k * (w * 0.6), y + 0.1], [12 - k * w, y + 1.9, 0]]);
  const collar = (k) => spline([[12 - k * 2.25, 3.4, 0], [12 - k * 5.5, 3], [12 - k * 8.5, 3.9, 0]]);
  add('ribcage', ['costillas', 'caja torácica', 'tórax', 'radiografía', 'ribcage', 'ribs', 'chest x-ray'], [sternum, rib(1, 7.3, 7.6), rib(-1, 7.3, 7.6), rib(1, 11.05, 8.1), rib(-1, 11.05, 8.1), rib(1, 14.8, 7.4), rib(-1, 14.8, 7.4), collar(1), collar(-1)]);
  FILL.ribcage = false;
}

// Pelvis, from the front: the two hip bones as wings around the sacrum, the joints between them a
// line of paper; each wing fans out from its crest, its socket bitten into its outer side, and narrows
// below to the pubic bone, the opening of the pelvis between them
{
  const sacrum = roundpoly([[10.1, 4.6], [13.9, 4.6], [12, 11]], [0.9, 0.9, 1]);
  const wing = spline(
    [[7.6, 5.4], [5.75, 3.4], [3.4, 3.3], [2.25, 6.1], [3.4, 9.4], [5.4, 11.4, 0.4], [4.9, 13.6, 0.4], [6.1, 16.9], [8.6, 18.6], [10.9, 17.9, 0.5], [10.4, 15.75, 0.5], [8.4, 13.75], [7.5, 10.6], [7.6, 7.75]],
    true,
  );
  add('pelvis', ['pelvis', 'cadera', 'suelo pélvico', 'ortopedia', 'pelvis', 'hips', 'pelvic floor'], [wing, flipPath(wing), sacrum]);
  FILL.pelvis = { solid: [0, 1, 2] };
  PARTS.pelvis = { hips: [0, 1], sacrum: [2] };
}

// ── Muscles ───────────────────────────────────────────────────────────────────────────────────
// The muscle's spindle, on the diagonal: the belly swelling from one tendon and narrowing into the
// other, its tapers concave, the three fibers running from tendon to tendon through it (the middle
// one is the tendons' line)
const M_P0 = [2.75, 21.25];
const M_P1 = [21.25, 2.75];
const M_LEN = len(sub(M_P1, M_P0));
const M_U = unit(sub(M_P1, M_P0));
const M_N = [-M_U[1], M_U[0]];
const M_A = 3.25; // tendon length at each end
const M_H = 5.1; // the belly's half-width
/** A point at `u` along the muscle's axis, `k` of its half-width to one side. */
const mAt = (u, k) => {
  const s = Math.min(1, Math.max(0, (u - M_A) / (M_LEN - 2 * M_A)));
  const h = M_H * Math.sin(Math.PI * s) ** 1.5;
  return add2(add2(M_P0, mul(M_U, u)), mul(M_N, k * h));
};
const mLine = (k, u0 = M_A, u1 = M_LEN - M_A, steps = 10) => {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(mAt(u0 + ((u1 - u0) * i) / steps, k));
  pts[0] = pts[0].slice(0, 2).concat(0);
  pts[steps] = pts[steps].slice(0, 2).concat(0);
  return pts;
};
{
  const top = mLine(1);
  const belly = `M${pt(top[0])}${splineSegs(top)}${splineSegs(mLine(-1).reverse())}Z`;
  const fibers = [spline(mLine(0.5)), spline(mLine(-0.5))];
  add('muscle', ['músculo', 'masa muscular', 'fibras', 'fisioterapia', 'muscle', 'muscle mass', 'muscle fiber'], [belly, ...fibers, line(M_P0, M_P1)]);
  FILL.muscle = { solid: [0], cut: [1, 2], wire: [line(M_P0, mAt(M_A, 0)), line(mAt(M_LEN - M_A, 0), M_P1)] };
  PARTS.muscle = { belly: [0], fibers: [1, 2, 3] };
}

// Strain: the same spindle torn across its middle, the two halves pulled apart along a zigzag, the
// tendons' line running into each half up to the tear
{
  const mid = M_LEN / 2;
  const K = [1, 1 / 3, -1 / 3, -1];
  const tear = (shift) => K.map((k, i) => mAt(mid + shift + (i % 2 ? -0.8 : 0.8), k));
  const half = (dir) => {
    const t = tear(dir * 1.9);
    const u0 = dir < 0 ? M_A : M_LEN - M_A;
    const top = mLine(1, u0, mid + dir * 1.9 + 0.8, 6);
    const bottom = mLine(-1, mid + dir * 1.9 + 0.8, u0, 6);
    top[top.length - 1] = t[0].concat(0);
    bottom[0] = t[3].concat(0);
    return { outline: `M${pt(top[0])}${splineSegs(top)}L${pt(t[1])}L${pt(t[2])}L${pt(t[3])}${splineSegs(bottom)}Z`, t, u0 };
  };
  const [a, b] = [half(-1), half(1)];
  const mid0 = (h) => lerp(h.t[1], h.t[2], 0.5);
  add('muscle-strain', ['desgarro', 'distensión muscular', 'lesión deportiva', 'tirón', 'muscle strain', 'pulled muscle', 'muscle tear'], [
    a.outline, b.outline, line(M_P0, mid0(a)), line(mid0(b), M_P1),
  ]);
  FILL['muscle-strain'] = { solid: [0, 1], cut: [line(mAt(M_A, 0), mid0(a)), line(mid0(b), mAt(M_LEN - M_A, 0))], wire: [line(M_P0, mAt(M_A, 0)), line(mAt(M_LEN - M_A, 0), M_P1)] };
  PARTS['muscle-strain'] = { belly: [0, 1], fibers: [2, 3] };
}

// Abs: the trunk's sides and, between them, the six segments of the abdominal wall, two by three on
// either side of the middle line (the paper between the columns)
{
  const half = [[4.75, 2.25, 0], [4.25, 11], [5.6, 21.75, 0]];
  const sides = [spline(half), spline(mirrorPts(half))];
  const seg = (x, y) => roundpoly([[x, y], [x + 3.4, y], [x + 3.4, y + 2.9], [x, y + 2.9]], 1.1);
  const segs = [];
  for (const y of [5, 10.75, 16.5]) segs.push(seg(7.2, y), seg(13.4, y));
  add('abs', ['abdominales', 'six pack', 'core', 'composición corporal', 'abs', 'six pack', 'core'], [...sides, ...segs]);
  FILL.abs = { solid: [2, 3, 4, 5, 6, 7], lines: [0, 1] };
  PARTS.abs = { trunk: [0, 1], abs: [2, 3, 4, 5, 6, 7] };
}

// ── The head's senses ─────────────────────────────────────────────────────────────────────────
// Ear, from the side, facing right: the rim's C open toward the face, the lobe below it, and the
// inner fold
const EAR = [
  spline([[15.4, 7.6, 0], [15.4, 4.1], [12.25, 2.4], [8.1, 3.75], [6.25, 8.5], [7, 13.25], [9.6, 16.4], [10.1, 19.5], [12.5, 21.4], [14.75, 20.25], [15.1, 17.6, 0]]),
  spline([[13, 13.75, 0], [10.6, 11.6], [9.75, 8.75], [11, 6.4], [12.4, 7.35, 0]]),
];
add('ear', ['oreja', 'oído', 'audición', 'otorrino', 'ear', 'hearing', 'ENT'], EAR);
FILL.ear = false;

// Hearing: the ear moved to the left, two sound arcs coming toward it from the right
{
  const ear = EAR.map((d) => move(d, -3.6, 0));
  const waves = [arc(25.5, 11.75, 7.4, 152, 208).d, arc(25.5, 11.75, 4.5, 144, 216).d];
  add('ear-sound', ['audición', 'prueba auditiva', 'escuchar', 'sonido', 'hearing', 'hearing test', 'listen'], [...ear, ...waves]);
  FILL['ear-sound'] = false;
  PARTS['ear-sound'] = { ear: [0, 1], near: [3], far: [2] };
}

// Nose, from the front: the bridge as two lines descending to the tip, the nostril wings curling out
// on each side and in under the tip
const NOSE_HALF = [[9.9, 2.25, 0], [9.6, 9.5], [7.25, 13.25], [6.75, 16.6], [8.6, 18.1], [10.4, 17, 0]];
const NOSE = [spline(NOSE_HALF), spline(mirrorPts(NOSE_HALF)), spline([[10.4, 17, 0], [10.9, 18.9], [12, 19.6], [13.1, 18.9], [13.6, 17, 0]])];
add('nose', ['nariz', 'olfato', 'congestión nasal', 'otorrino', 'nose', 'smell', 'nasal'], NOSE);
FILL.nose = false;

// Smell: the nose to the left, three wavy scent lines rising beside it
{
  const nose = NOSE.map((d) => move(d, -4, 0));
  const wave = (x, y0, y1) => spline([[x, y1, 0], [x + 0.65, y1 - (y1 - y0) / 3], [x - 0.65, y1 - (2 * (y1 - y0)) / 3], [x, y0, 0]]);
  add('nose-scent', ['olfato', 'aroma', 'oler', 'pérdida del olfato', 'smell', 'scent', 'aroma'], [...nose, wave(14.6, 3.4, 9.75), wave(17.9, 3.4, 9.75), wave(21.2, 3.4, 9.75)]);
  FILL['nose-scent'] = false;
  PARTS['nose-scent'] = { nose: [0, 1, 2], scent: [3, 4, 5] };
}

// Mouth, closed: the upper lip's bow with its dip, the lower lip's curve, and the line between them
const LIPS = spline([[2.6, 12.25, 0], [6.25, 8.4], [9.25, 7.4], [12, 8.6, 0.6], [14.75, 7.4], [17.75, 8.4], [21.4, 12.25, 0], [17.5, 16], [12, 17.4], [6.5, 16]], true);
add('mouth', ['boca', 'labios', 'salud bucal', 'habla', 'mouth', 'lips', 'oral health'], [LIPS, spline([[2.6, 12.25, 0], [7.5, 12.6], [12, 12.1], [16.5, 12.6], [21.4, 12.25, 0]])]);
FILL.mouth = { solid: [0], cut: [1] };
PARTS.mouth = { lips: [0], line: [1] };

// Mouth, open: the lips around an oval opening, the edge of the upper teeth across its top and the
// tongue's curve in its bottom
{
  const lips = spline([[2.4, 12.25, 0.5], [5.5, 7.25], [12, 5.6], [18.5, 7.25], [21.6, 12.25, 0.5], [18, 17.6], [12, 19.1], [6, 17.6]], true);
  const open = ell([12, 12.4], 6.6, 3.9);
  const tx = 6.6 * Math.sqrt(1 - (1.65 / 3.9) ** 2);
  const teeth = line([12 - tx, 10.75], [12 + tx, 10.75]);
  const tongue = spline([[8.25, 15.35, 0], [12, 13.6], [15.75, 15.35, 0]]);
  add('mouth-open', ['boca abierta', 'examen oral', 'tragar', 'lengua', 'open mouth', 'oral exam', 'swallow'], [lips, open, teeth, tongue]);
  FILL['mouth-open'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['mouth-open'] = { lips: [0], mouth: [1, 2, 3] };
}

// Tongue: sticking out under the line of the mouth, a U with a groove down its middle (a tongue alone,
// its root flat, read as the letter U)
{
  const mouth = spline([[2.75, 5.25, 0], [7.25, 7.1], [12, 7.6], [16.75, 7.1], [21.25, 5.25, 0]]);
  const tongue = spline([[7, 7.25, 0], [6.75, 13.5], [8.25, 18.75], [12, 21.25], [15.75, 18.75], [17.25, 13.5], [17, 7.25, 0]]);
  add('tongue', ['lengua', 'gusto', 'salud bucal', 'sabor', 'tongue', 'taste', 'oral health'], [mouth, tongue, line([12, 7.6], [12, 14.25])]);
  FILL.tongue = { solid: [`${tongue}Z`], cut: [2], wire: [0] };
  PARTS.tongue = { mouth: [0], tongue: [1, 2] };
}

// Teeth, from the front: the rows meeting at the bite line, each tooth arched where the gum meets
// it, the upper incisors the largest
{
  const bite = line([3.25, 12], [20.75, 12]);
  const upper = `M3.25 12${splineSegs([[3.25, 12, 0], [3.75, 7.75], [6, 6.6], [7.9, 7.5, 0]])}${splineSegs([[7.9, 7.5, 0], [9.75, 4.9], [12, 6.4, 0]])}${splineSegs([[12, 6.4, 0], [14.25, 4.9], [16.1, 7.5, 0]])}${splineSegs([[16.1, 7.5, 0], [18, 6.6], [20.25, 7.75], [20.75, 12, 0]])}`;
  const lower = `M4.5 12${splineSegs([[4.5, 12, 0], [5.4, 16], [7.4, 16.75], [8.75, 15.9, 0]])}${splineSegs([[8.75, 15.9, 0], [10.4, 17.75], [12, 16.6, 0]])}${splineSegs([[12, 16.6, 0], [13.6, 17.75], [15.25, 15.9, 0]])}${splineSegs([[15.25, 15.9, 0], [16.6, 16.75], [18.6, 16], [19.5, 12, 0]])}`;
  const gaps = `M7.9 7.5V12M12 6.4V12M16.1 7.5V12M8.75 15.9V12M12 16.6V12M15.25 15.9V12`;
  add('teeth', ['dientes', 'sonrisa', 'mordida', 'cuidado dental', 'teeth', 'smile', 'bite'], [upper, lower, bite, gaps]);
  FILL.teeth = false;
}

// Dental arch, from above: the horseshoe of the teeth as a band, the gaps between the teeth across it,
// the molars at the back the widest
{
  const Pt = (t) => {
    const a = Math.PI * (t - 0.5);
    return [12 + 7.75 * Math.sin(a), 20 - 16 * Math.max(0, Math.cos(a)) ** 0.85];
  };
  const Nn = (t) => {
    const u = unit(sub(Pt(t + 0.001), Pt(t - 0.001)));
    return [-u[1], u[0]];
  };
  const hw = (t) => 1.75 + 0.45 * Math.abs(2 * t - 1) ** 2;
  const J = [0, 0.15, 0.285, 0.4, 0.5, 0.6, 0.715, 0.85, 1];
  const outer = [];
  const inner = [];
  for (let i = 0; i < J.length; i++) {
    const t = J[i];
    const w = hw(t) - (i > 0 && i < J.length - 1 ? 0.35 : 0);
    outer.push(add2(Pt(t), mul(Nn(t), -w)));
    inner.push(add2(Pt(t), mul(Nn(t), w)));
    if (i < J.length - 1) {
      const m = (J[i] + J[i + 1]) / 2;
      outer.push(add2(Pt(m), mul(Nn(m), -hw(m) - 0.25)));
      inner.push(add2(Pt(m), mul(Nn(m), hw(m) + 0.15)));
    }
  }
  const n = outer.length - 1;
  const band = `M${pt(outer[0])}${splineSegs(outer)}L${pt(inner[n])}${splineSegs([...inner].reverse())}Z`;
  const gaps = J.slice(1, -1).map((_, k) => line(outer[2 * (k + 1)], inner[2 * (k + 1)]));
  add('dental-arch', ['arcada dental', 'odontograma', 'ortodoncia', 'piezas dentales', 'dental arch', 'tooth chart', 'orthodontics'], [band, ...gaps]);
  const through = J.slice(1, -1).map((_, k) => {
    const [a, b] = [outer[2 * (k + 1)], inner[2 * (k + 1)]];
    const u = unit(sub(b, a));
    return line(sub(a, mul(u, 1.6)), add2(b, mul(u, 1.6)));
  });
  FILL['dental-arch'] = { solid: [0], cut: through };
  PARTS['dental-arch'] = { arch: [0], teeth: gaps.map((_, i) => i + 1) };
}

// Eyeball, from the side facing right: the sphere with the cornea bulging in front, the lens behind
// the cornea, and the optic nerve trailing out of the back
{
  const [c, r] = [[11.75, 12], 6.4];
  const [a0, a1] = [polar(...c, r, -32), polar(...c, r, 32)];
  const globe = `M${pt(a1)}A${f(r)} ${f(r)} 0 1 1 ${pt(a0)}${splineSegs([a0, [19.9, 12], a1].map((p, i) => (i === 1 ? p : p.concat(0.6))))}Z`;
  const lens = ell([14.4, 12], 1.15, 2.65);
  const nerve = `M${pt(polar(...c, r, 192))}L2.25 10.5M${pt(polar(...c, r, 168))}L2.25 13.5`;
  add('eyeball', ['ojo', 'globo ocular', 'oftalmología', 'examen de la vista', 'eyeball', 'eye anatomy', 'ophthalmology'], [globe, lens, nerve]);
  FILL.eyeball = { solid: [0], cut: [1], wire: [2] };
  PARTS.eyeball = { eye: [0, 1], nerve: [2] };
}

// Eyelashes: an open almond eye with its iris and five long lashes curving up from the upper lid
{
  const lids = spline([[2.75, 15.25, 0], [7, 10.6], [12, 9.4], [17, 10.6], [21.25, 15.25, 0], [17, 19.1], [12, 20.25], [7, 19.1]], true);
  const iris = circ(12, 14.85, 2.55);
  const lash = (x, y, dx, dy) => spline([[x, y, 0], [x + dx * 0.35, y - dy * 0.7], [x + dx, y - dy, 0]]);
  const lashes = [lash(5.4, 12.6, -2.4, 3.25), lash(8.4, 10.6, -1.3, 4.1), lash(12, 9.4, 0, 4.4), lash(15.6, 10.6, 1.3, 4.1), lash(18.6, 12.6, 2.4, 3.25)];
  add('eyelashes', ['pestañas', 'extensiones de pestañas', 'lifting de pestañas', 'rímel', 'eyelashes', 'lash extensions', 'mascara'], [lids, iris, ...lashes]);
  FILL.eyelashes = { solid: [0], cut: [1], wire: [2, 3, 4, 5, 6] };
  PARTS.eyelashes = { eye: [0, 1], lashes: [2, 3, 4, 5, 6] };
}

// Brain, in profile facing right: the cerebrum, longer than it is tall, its temporal lobe rounding
// under its front, with two of its fissures (the lateral, rising from its underside toward the back,
// and the central, dropping from its top); the cerebellum tucked under its back and the brainstem,
// short, going down in front of it
{
  const cerebrum = spline(
    [[6.75, 14.4], [3.25, 12.25], [2.5, 8.6], [4.6, 5.1], [8.75, 3.25], [13.75, 3], [18.25, 4.25], [21.1, 7.75], [20.9, 11.75], [18.25, 14.25], [14.75, 14.6], [12.6, 13.4, 0.5], [9.75, 14.75]],
    true,
  );
  const folds = [spline([[12.6, 13.4, 0], [11.4, 11.1], [8.25, 10]]), spline([[13.75, 3, 0], [14.6, 5.4], [13.6, 8.25]])];
  const cerebellum = spline([[3.75, 18.4], [5.6, 17.1], [9, 17.6], [9.5, 19.4], [7, 20.6]], true);
  const stem = tube([[14.6, 14.6], [14.25, 17.75], [13.25, 20.25]], 1.25, { start: 'open', onto: cerebrum });
  add('brain-side', ['cerebro', 'neurología', 'derrame cerebral', 'conmoción', 'brain', 'neurology', 'stroke'], [cerebrum, ...folds, cerebellum, stem]);
  FILL['brain-side'] = { solid: [0, 3, shut(stem)], cut: [1, 2] };
  PARTS['brain-side'] = { cerebrum: [0, 1, 2], cerebellum: [3], stem: [4] };
}

// ── Hair: one parting ─────────────────────────────────────────────────────────────────────────
// Hair from behind: its outline over the crown and falling to the shoulders, the parting down from
// the crown and two strands inside. Every type keeps the parting and the places of the edges and the
// strands; only their shape changes: straight, wavy, curly (loose loops), coily (tight zigzags).
const HAIR_TOP = [[4.6, 11.25], [5.75, 5.25], [12, 2.25], [18.25, 5.25], [19.4, 11.25]];
const PARTING = line([12, 2.25], [12, 6.6]);
/** A falling edge or strand from a to b, its shape per kind. */
function strand(a, b, kind, sign = 1) {
  if (kind === 'straight') return line(a, b);
  const u = unit(sub(b, a));
  const nn = [-u[1], u[0]];
  const L = len(sub(b, a));
  const at = (s2, o) => add2(add2(a, mul(u, s2)), mul(nn, o * sign));
  if (kind === 'zig') {
    const n = 5;
    const pts = [a];
    const step = L / (2 * n);
    for (let i = 1; i < 2 * n; i++) pts.push(at(step * i, i % 2 ? 0.75 : -0.75));
    pts.push(b);
    return line(...pts);
  }
  const n = kind === 'wave' ? 2 : 3;
  const amp = kind === 'wave' ? 0.8 : 1.05;
  const pts = [a.concat(0)];
  const step = L / (2 * n);
  for (let i = 1; i < 2 * n; i++) pts.push(at(step * i, i % 2 ? amp : -amp));
  pts.push(b.concat(0));
  return spline(pts);
}
function hairOf(kind) {
  const left = strand([4.6, 11.25], [5.25, 21.25], kind, -1);
  const right = strand([19.4, 11.25], [18.75, 21.25], kind, 1);
  const top = spline(HAIR_TOP);
  const strands = [strand([8.4, 6.75], [9.25, 21.25], kind, -1), strand([15.6, 6.75], [14.75, 21.25], kind, 1)];
  return [top, left, right, PARTING, ...strands];
}
add('hair', ['cabello', 'pelo', 'cabello lacio', 'cuidado del cabello', 'hair', 'straight hair', 'haircare'], hairOf('straight'));
add('hair-wavy', ['cabello ondulado', 'ondas', 'tipo de cabello', 'salón', 'wavy hair', 'hair type', 'waves'], hairOf('wave'));
add('hair-curly', ['cabello rizado', 'rizos', 'tipo de cabello', 'salón', 'curly hair', 'curls', 'hair type'], hairOf('curl'));
add('hair-coily', ['cabello afro', 'rizos apretados', 'tipo de cabello', 'coily hair', 'coils', 'hair type', 'kinky hair'], hairOf('zig'));
for (const name of ['hair', 'hair-wavy', 'hair-curly', 'hair-coily']) {
  FILL[name] = false;
  PARTS[name] = { hair: [0, 1, 2], parting: [3], strands: [4, 5] };
}

// Hair loss: the same outline, bare at the crown (no parting), a strand left down each side and one
// loose hair falling in the bare middle, a single bend. (A zigzag there read as a crack in the scalp.)
{
  const top = spline(HAIR_TOP);
  const left = line([4.6, 11.25], [5.25, 21.25]);
  const right = line([19.4, 11.25], [18.75, 21.25]);
  const sides = [line([8.1, 13.75], [8.75, 21.25]), line([15.9, 13.75], [15.25, 21.25])];
  const falling = spline([[10.6, 8.75, 0], [12.6, 10.25], [12.6, 13.6, 0]]);
  add('hair-loss', ['caída del cabello', 'calvicie', 'alopecia', 'trasplante capilar', 'hair loss', 'baldness', 'alopecia'], [top, left, right, ...sides, falling]);
  FILL['hair-loss'] = false;
  PARTS['hair-loss'] = { hair: [0, 1, 2, 3, 4], falling: [5] };
}

// ── Skin: one surface block ───────────────────────────────────────────────────────────────────
// Skin in cross-section: a slab cut from it, whose top is the skin's surface (a gentle wave) with the
// two layers below it following that wave. Every condition is drawn on that surface, in the space
// above the slab.
const SKIN_Y = 11; // the surface's mean height
const SKIN_BOTTOM = 20.75;
const wavy = (y, a = 0.5) => [[2.75, y], [7.5, y - a], [12, y + a * 0.3], [16.5, y - a], [21.25, y]];
const SKIN_LAYERS = [spline(wavy(14.35, 0.45)), spline(wavy(17.6, 0.4))];
function skinBlock(surface = wavy(SKIN_Y, 0.55)) {
  const first = surface[0];
  const last = surface[surface.length - 1];
  return `M${pt(first)}${splineSegs(surface)}${roundline([last, [21.25, SKIN_BOTTOM], [2.75, SKIN_BOTTOM], first], [0, 1.25, 1.25, 0]).replace(/^M[^L]*/, '')}Z`;
}
const SKIN = skinBlock();
add('skin', ['piel', 'dermatología', 'cuidado de la piel', 'capas de la piel', 'skin', 'dermatology', 'skincare'], [SKIN, ...SKIN_LAYERS]);
FILL.skin = { solid: [0], cut: [1, 2] };
PARTS.skin = { surface: [0], layers: [1, 2] };
add('skin-search', ['revisión de piel', 'autoexamen', 'revisar lunar', 'dermatoscopio', 'skin check', 'mole check', 'skin screening'], [SKIN, ...SKIN_LAYERS], { badge: badge('search') });
FILL['skin-search'] = { solid: [0], cut: [1, 2] };
PARTS['skin-search'] = { surface: [0], layers: [1, 2] };

// Mole: one raised, irregular spot on the surface
{
  const surface = [[2.75, SKIN_Y], [5.75, SKIN_Y - 0.4], [8.25, SKIN_Y - 0.1, 0.6], [9.75, 8.1], [11.6, 7.4], [13.4, 7.75], [15, 8.6], [15.75, SKIN_Y - 0.1, 0.6], [18.25, SKIN_Y - 0.4], [21.25, SKIN_Y]];
  add('skin-mole', ['lunar', 'mancha en la piel', 'revisión de lunares', 'cáncer de piel', 'mole', 'skin spot', 'skin cancer'], [skinBlock(surface), ...SKIN_LAYERS]);
  FILL['skin-mole'] = { solid: [0], cut: [1, 2] };
  PARTS['skin-mole'] = { surface: [0], layers: [1, 2] };
}

// Rash: a cluster of small bumps on the surface
{
  const surface = [[2.75, SKIN_Y], [4.5, SKIN_Y - 0.3], [5.75, SKIN_Y, 0]];
  for (const x of [5.75, 8.25, 10.75, 13.25, 15.75]) surface.push([x + 1.25, SKIN_Y - 1.45], [x + 2.5, SKIN_Y, 0]);
  surface.push([19.5, SKIN_Y - 0.3], [21.25, SKIN_Y]);
  add('skin-rash', ['sarpullido', 'erupción', 'alergia', 'eccema', 'rash', 'eczema', 'irritation'], [skinBlock(surface), ...SKIN_LAYERS]);
  FILL['skin-rash'] = { solid: [0], cut: [1, 2] };
  PARTS['skin-rash'] = { surface: [0], layers: [1, 2] };
}

// Acne: three raised bumps along the surface, the middle one the largest, a small spot at the heart of
// each. (Two equal bumps with a spot each read as a pair of eyes, a frog's face; three of them read as
// spots.)
{
  const bump = (x, r) => [[x - r, SKIN_Y, 0], ...[150, 120, 90, 60, 30].map((a) => polar(x, SKIN_Y, r, -a)), [x + r, SKIN_Y, 0]];
  const surface = [[2.75, SKIN_Y], ...bump(5.95, 2.9), ...bump(12.05, 3.2), ...bump(18.15, 2.9), [21.25, SKIN_Y]];
  const spots = [5.95, 12.05, 18.15].map((x) => dot(x, SKIN_Y, 0.3));
  add('skin-acne', ['acné', 'granos', 'espinillas', 'brote', 'acne', 'pimples', 'breakout'], [skinBlock(surface), ...SKIN_LAYERS, ...spots]);
  FILL['skin-acne'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['skin-acne'] = { surface: [0], layers: [1, 2], spots: [3, 4, 5] };
}

// Dry: the flat surface broken by three cracks, each a notch running on down into the skin
{
  const surface = [[2.75, SKIN_Y], [4.75, SKIN_Y - 0.2]];
  for (const x of [7.25, 12, 16.75]) surface.push([x - 0.9, SKIN_Y - 0.1, 0], [x, SKIN_Y + 0.75, 0], [x + 0.9, SKIN_Y - 0.1, 0]);
  surface.push([19.25, SKIN_Y - 0.2], [21.25, SKIN_Y]);
  const cracks = [7.25, 12, 16.75].map((x, i) => {
    const end = onPath(SKIN_LAYERS[0], x + (i === 1 ? 0.5 : -0.5), [x, 14.35]);
    return line([x, SKIN_Y + 0.75], end);
  });
  add('skin-dry', ['piel seca', 'resequedad', 'eccema', 'grietas', 'dry skin', 'cracked skin', 'eczema'], [skinBlock(surface), ...SKIN_LAYERS, ...cracks]);
  FILL['skin-dry'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['skin-dry'] = { surface: [0], layers: [1, 2], cracks: [3, 4, 5] };
}

// Oily: one drop, the set's droplet, landing on the surface to one side: a piece on top, so the engine
// parts the surface around it. (Drops standing on the middle of the block read as candle flames on a
// cake.)
{
  const r = 3;
  const c = [8.25, 10.35 - r];
  const oil = `M${pt(polar(...c, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${pt(polar(...c, r, -135))}L${pt([c[0], c[1] - r * Math.SQRT2])}Z`;
  add('skin-oily', ['piel grasa', 'brillo', 'sebo', 'tipo de piel', 'oily skin', 'shine', 'sebum'], [SKIN, ...SKIN_LAYERS], { badge: { d: [oil], knock: oil, fill: { solid: [oil] } } });
  FILL['skin-oily'] = { solid: [0], cut: [1, 2] };
  PARTS['skin-oily'] = { surface: [0], layers: [1, 2] };
}

// Wrinkles: the surface folded into three shallow creases
{
  const surface = [[2.75, SKIN_Y - 0.6], [4.25, SKIN_Y - 0.75]];
  for (const x of [7, 12, 17]) surface.push([x - 1.1, SKIN_Y - 0.9, 0.6], [x, SKIN_Y + 1.4], [x + 1.1, SKIN_Y - 0.9, 0.6]);
  surface.push([19.75, SKIN_Y - 0.75], [21.25, SKIN_Y - 0.6]);
  add('skin-wrinkles', ['arrugas', 'envejecimiento', 'antiedad', 'líneas de expresión', 'wrinkles', 'aging skin', 'anti-aging'], [skinBlock(surface), ...SKIN_LAYERS]);
  FILL['skin-wrinkles'] = { solid: [0], cut: [1, 2] };
  PARTS['skin-wrinkles'] = { surface: [0], layers: [1, 2] };
}

// ── Organs ────────────────────────────────────────────────────────────────────────────────────
// Heart, the organ, from the front: its body leaning to the left (the apex low on the right), the
// aorta rising from its top and arching over to the right, the vena cava up on the left, and the
// coronary groove across it
{
  const body = spline([[6.6, 11.1], [9.75, 9.6], [12.9, 10.4], [16.75, 9.25], [19.6, 11.75], [19.4, 16.25], [16.25, 20.1], [12.9, 21.6], [9.25, 19.9], [5.75, 16.25], [4.75, 12.9]], true);
  const aorta = tube([[12.6, 10.3], [12.25, 7], [13.6, 4.25], [16.6, 4.1], [18.25, 5.9]], 1.35, { start: 'open', onto: body });
  const cava = tube([[7.4, 10.45], [7.25, 2.25]], 1.3, { start: 'open', end: 'open', onto: body });
  const gTop = onPath(body, 15.4, [15.4, 9.6]);
  const groove = spline([gTop.concat(0), [14.4, 13.4], [12.4, 18.25], [12.9, 21.6, 0]]);
  const grooveThrough = spline([add2(gTop, [0.25, -1.4]).concat(0), gTop, [14.4, 13.4], [12.4, 18.25], [12.9, 21.6], [13.1, 22.9, 0]]);
  add('anatomical-heart', ['corazón', 'cardiología', 'órgano', 'salud cardiaca', 'heart', 'cardiology', 'heart organ'], [body, aorta, cava, groove]);
  FILL['anatomical-heart'] = { solid: [0, shut(aorta)], cut: [grooveThrough], wire: [2] };
  PARTS['anatomical-heart'] = { heart: [0, 3], vessels: [1, 2] };
}

// Lungs: two lungs on either side of the trachea, which forks into the bronchi at their inner edges;
// a fissure across each splits it into its lobes
{
  const half = [[9.1, 6.6], [7.1, 3.6], [4.75, 5.1], [3.1, 11], [2.75, 17], [4.4, 20.25], [9.1, 19.4], [9.25, 14.75], [9.1, 11.25]];
  const lungL = spline(half, true);
  const lungR = spline(mirrorPts(half), true);
  const trachea = line([12, 2.25], [12, 8.75]);
  const bronchi = line([9.1, 11.25], [12, 8.75], [14.9, 11.25]);
  const fissures = [spline([[3, 12.6, 0], [6, 13.4], [9.2, 16.75, 0]]), spline([[21, 12.6, 0], [18, 13.4], [14.8, 16.75, 0]])];
  add('lungs', ['pulmones', 'respiración', 'neumología', 'salud respiratoria', 'lungs', 'breathing', 'respiratory'], [lungL, lungR, trachea, bronchi, ...fissures]);
  FILL.lungs = { solid: [0, 1], wire: [2, 3], cut: [4, 5] };
  PARTS.lungs = { lungs: [0, 1, 4, 5], airway: [2, 3] };
}

// Kidneys: two beans facing each other, their notches inward, a short ureter dropping from each notch
{
  const half = [[9.25, 11.5, 0.5], [10.25, 15.4], [8.25, 18.9], [5, 18.9], [3, 15], [2.9, 8.6], [5, 4.6], [8.4, 4.6], [10.25, 7.6]];
  const kidL = spline(half, true);
  const kidR = spline(mirrorPts(half), true);
  const ureterL = spline([[9.25, 11.5, 0], [10.6, 12.6], [10.5, 21.75, 0]]);
  const ureterR = spline([[14.75, 11.5, 0], [13.4, 12.6], [13.5, 21.75, 0]]);
  add('kidneys', ['riñones', 'nefrología', 'diálisis', 'salud renal', 'kidneys', 'kidney health', 'dialysis'], [kidL, kidR, ureterL, ureterR]);
  FILL.kidneys = { solid: [0, 1], wire: [2, 3] };
  PARTS.kidneys = { kidneys: [0, 1], ureters: [2, 3] };
}

// Liver, from the front: a wedge, its large right lobe round on the left of the drawing, tapering to a
// point on the other side, the ligament between its lobes
{
  const liver = spline([[2.6, 10.6], [5.25, 5.6], [11.25, 4.25], [17.25, 5.25], [21.4, 7.4, 0.5], [18.25, 11.4], [12.25, 15.75], [7.75, 19.4], [4.25, 18.4]], true);
  const ligament = spline([[13.4, 4.35, 0], [12.9, 7.75], [11.6, 11.75]]);
  add('liver', ['hígado', 'hepatología', 'salud hepática', 'órgano', 'liver', 'hepatology', 'liver health'], [liver, ligament]);
  FILL.liver = { solid: [0], cut: [1] };
  PARTS.liver = { liver: [0, 1] };
}

// Stomach: a J-shaped pouch, the esophagus entering at its top and the duodenum leaving to the right
{
  const stomach = spline([
    [10.75, 2.25, 0], [10.6, 5.25], [7.25, 5.6], [4.25, 8.75], [4.25, 14.25], [7.25, 18.9], [12.4, 20.25], [16.9, 18.1], [19, 16.6], [21.75, 16.9, 0],
  ]) + spline([[21.75, 13.75, 0], [18.6, 13.25], [15.4, 14.4], [13, 13.25], [13.6, 8.25], [13.75, 2.25, 0]]).replace(/^M/, 'L');
  add('stomach', ['estómago', 'digestión', 'gastroenterología', 'dolor de estómago', 'stomach', 'digestion', 'gastric'], [stomach]);
  FILL.stomach = { solid: [`${stomach}Z`] };
}

// Intestines: the large intestine as a frame around the coils of the small intestine, its outer wall
// bulging in pouches
{
  const bulge = (a, b, n, out) => {
    // n pouches from a to b, each a shallow arc bulging `out` (a unit normal)
    let d = '';
    for (let i = 0; i < n; i++) {
      const p0 = lerp(a, b, i / n);
      const p1 = lerp(a, b, (i + 1) / n);
      const m = add2(lerp(p0, p1, 0.5), mul(out, 0.7));
      d += `Q${pt(m)} ${pt(p1)}`;
    }
    return d;
  };
  const outer = `M4 21.75L4 ${f(16.75)}${bulge([4, 16.75], [4, 7.5], 2, [-1, 0])}Q4 4 7.5 4${bulge([7.5, 4], [16.5, 4], 2, [0, -1])}Q20 4 20 7.5${bulge([20, 7.5], [20, 16.75], 2, [1, 0])}Q20 18.75 17.9 20.4L16.25 21.75`;
  const inner = roundline([[7, 21.75], [7, 7], [17, 7], [17, 17], [13.6, 19.5]], [0, 1.5, 1.5, 1.5, 0]);
  const coil = roundline([[9.85, 9.85], [14.15, 9.85], [14.15, 12.85], [9.85, 12.85], [9.85, 15.85], [12.6, 15.85]], [0, 1.45, 1.45, 1.45, 1.45, 0]);
  add('intestines', ['intestinos', 'salud intestinal', 'digestión', 'colon', 'intestines', 'gut health', 'bowel'], [outer, inner, coil]);
  FILL.intestines = { solid: [`${outer}L${inner.replace(/^M/, '').split('L').reverse().join('L')}Z`], wire: [2] };
  PARTS.intestines = { colon: [0, 1], 'small-intestine': [2] };
}

// Bladder: a round pouch narrowing below into the urethra, the two ureters coming down into its top
const POUCH = [[6.4, 17.25], [4.4, 12.25], [6.75, 7.75], [12, 6.6], [17.25, 7.75], [19.6, 12.25], [17.6, 17.25]];
const BLADDER = spline([[11, 21.75, 0], [11, 19.4], ...POUCH, [13, 19.4], [13, 21.75, 0]]);
const URETERS = [spline([[6.4, 2.25, 0], [7.1, 4.75], [8.25, 7.1, 0]]), spline([[17.6, 2.25, 0], [16.9, 4.75], [15.75, 7.1, 0]])];
add('bladder', ['vejiga', 'urología', 'salud urinaria', 'infección urinaria', 'bladder', 'urology', 'urinary'], [BLADDER, ...URETERS]);
FILL.bladder = { solid: [`${BLADDER}Z`], wire: [1, 2] };
PARTS.bladder = { bladder: [0], ureters: [1, 2] };

// Pancreas: an elongated organ lying sideways, its tail tapering to the left and its head curled
// down on the right, the duct running along it
{
  const pancreas = spline([[2.75, 8.6], [6.75, 6.4], [12, 7.1], [17, 6.6], [20.6, 9.25], [21.1, 13.75], [19.25, 17.9], [15.75, 17.6], [15.6, 14.25, 0.6], [12, 13.4], [7.25, 12.6], [3.4, 11.25]], true);
  const duct = spline([[7.75, 9.6, 0], [12, 10.25], [16.4, 9.75], [18, 12.25, 0]]);
  add('pancreas', ['páncreas', 'diabetes', 'insulina', 'endocrinología', 'pancreas', 'diabetes', 'insulin'], [pancreas, duct]);
  FILL.pancreas = { solid: [0], cut: [1] };
  PARTS.pancreas = { pancreas: [0, 1] };
}

// Thyroid: the trachea's tube with its rings, and over its front the butterfly of the gland, its two
// lobes flanking it and the isthmus crossing it (a piece on top: the engine clears the trachea under it)
{
  const walls = [line([10.25, 2.25], [10.25, 21.75]), line([13.75, 2.25], [13.75, 21.75])];
  const rings = [3.75, 6.6, 9.45, 20.25].map((y) => line([10.25, y], [13.75, y]));
  const half = [[12, 12.75], [8.25, 12.4], [7.4, 8.4], [5, 7.1], [3, 10], [3.1, 16.75], [5.4, 19.9], [8.25, 18.4], [12, 16.1]];
  const gland = `M12 12.75${splineSegs(half)}${splineSegs(mirrorPts(half))}Z`;
  add('thyroid', ['tiroides', 'hormonas', 'endocrinología', 'glándula', 'thyroid', 'hormones', 'endocrinology'], [...walls, ...rings], { badge: { d: [gland], knock: gland, fill: { solid: [gland] } } });
  FILL.thyroid = false;
  PARTS.thyroid = { trachea: [0, 1, 2, 3, 4] };
}

// Uterus: the pear-shaped womb narrowing to the cervix below, and the two fallopian tubes curling
// out from its top corners to the ovaries
{
  const womb = spline([[12, 20.6], [10.4, 20.4], [10.25, 17.75], [8, 14.4], [7.6, 9.6], [9.25, 7.75], [12, 8.25], [14.75, 7.75], [16.4, 9.6], [16, 14.4], [13.75, 17.75], [13.6, 20.4]], true);
  const tube = (k) => {
    const s0 = onPath(womb, 12 - k * 3.4, [12 - k * 3.4, 8]);
    return spline([s0.concat(0), [12 - k * 5.4, 5.25], [12 - k * 7.75, 5.4], [12 - k * 8.4, 9.3, 0]]);
  };
  const ovary = (k) => ell([12 - k * 8.4, 10.9], 1.75, 1.6);
  add('uterus', ['útero', 'ginecología', 'fertilidad', 'salud menstrual', 'uterus', 'womb', 'gynecology'], [womb, tube(1), tube(-1), ovary(1), ovary(-1)]);
  FILL.uterus = { solid: [0, 3, 4], wire: [1, 2] };
  PARTS.uterus = { uterus: [0], tubes: [1, 2], ovaries: [3, 4] };
}

// ── Cells ─────────────────────────────────────────────────────────────────────────────────────
// Red blood cell: a disc tilted in space, its dimple a smaller ellipse in the middle
add('red-blood-cell', ['glóbulo rojo', 'eritrocito', 'anemia', 'hematología', 'red blood cell', 'erythrocyte', 'anemia'], [tilted([12, 12], 9, 6.1, -24), tilted([12, 12], 4.1, 2.1, -24)]);
FILL['red-blood-cell'] = { solid: [0], cut: [1] };
PARTS['red-blood-cell'] = { cell: [0], dimple: [1] };

// White blood cell: a round cell with a nucleus of three lobes
{
  // Three round lobes (two above, one below) joined by narrow waists
  const lobe = (c, a0, a1) => [a0, (a0 + a1) / 2, a1].map((a) => polar(...c, 2.3, a));
  const nucleus = spline([...lobe([8.9, 9.6], 120, 300), [12, 9.9, 0.6], ...lobe([15.1, 9.6], 240, 420), [13.6, 13.1, 0.6], ...lobe([12, 15.4], 0, 180), [10.4, 13.1, 0.6]], true);
  add('white-blood-cell', ['glóbulo blanco', 'leucocito', 'inmunidad', 'infección', 'white blood cell', 'leukocyte', 'immunity'], [circ(12, 12, 9), nucleus]);
  FILL['white-blood-cell'] = { solid: [0], cut: [1] };
  PARTS['white-blood-cell'] = { cell: [0], nucleus: [1] };
}

// Cancer cell: a lumpy, irregular cell with two nuclei of different sizes
{
  const lumps = [];
  const R = [8.75, 7.4, 8.4, 6.9, 8.9, 7.6, 8.1, 7.1, 9, 7.25, 8.5, 7.5];
  for (let i = 0; i < 12; i++) lumps.push(polar(12, 12, R[i], -90 + i * 30 + (i % 3 ? 5 : -4)));
  add('cancer-cell', ['célula cancerosa', 'tumor', 'oncología', 'cáncer', 'cancer cell', 'tumor', 'oncology'], [spline(lumps, true), circ(9.6, 10.25, 2.6), circ(14.75, 14.6, 1.75)]);
  FILL['cancer-cell'] = { solid: [0], cut: [1, 2] };
  PARTS['cancer-cell'] = { cell: [0], nuclei: [1, 2] };
}

// Neuron: a star-shaped cell body, dendrites branching from its points, and a long axon from the last
// point ending in a split terminal
{
  const c = [8.75, 8.75];
  const tips = [-100, -28, 45, 125, 185].map((a) => polar(...c, 3.1, a));
  const waists = [-64, 8.5, 85, 155, 222].map((a) => polar(...c, 1.65, a));
  const body = spline(tips.flatMap((t, i) => [t.concat(0), waists[i]]), true);
  const out = (i, l) => {
    const u = unit(sub(tips[i], c));
    return add2(tips[i], mul(u, l));
  };
  const fork = (i, l, spread) => {
    const end = out(i, l);
    const u = unit(sub(tips[i], c));
    const side = rot(u, [0, 0], spread);
    return line(tips[i], end, add2(end, mul(side, 2.1)));
  };
  const dendrites = [fork(0, 2.1, 50), fork(1, 2.2, -55), line(tips[3], out(3, 2.75)), fork(4, 2.2, -50)];
  const axon = spline([tips[2].concat(0), [13.25, 14.25], [16.25, 16.25], [18.4, 18.4, 0]]);
  const terminal = [line([18.4, 18.4], [21.25, 17.6]), line([18.4, 18.4], [19.25, 21.25])];
  add('neuron', ['neurona', 'sistema nervioso', 'neurociencia', 'célula nerviosa', 'neuron', 'nerve cell', 'neuroscience'], [body, ...dendrites, axon, ...terminal]);
  FILL.neuron = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7] };
  PARTS.neuron = { body: [0], dendrites: [1, 2, 3, 4], axon: [5, 6, 7] };
}

// Sperm: an oval head and a long wavy tail trailing from it
{
  const head = tilted([7, 7], 3.4, 2.4, 45);
  const tail = spline([[9.4, 9.4, 0], [12.6, 11.4], [12.9, 14.6], [16.4, 15.4], [17.75, 18.6], [21.25, 21.25, 0]]);
  add('sperm', ['espermatozoide', 'fertilidad', 'salud reproductiva', 'esperma', 'sperm', 'fertility', 'sperm cell'], [head, tail]);
  FILL.sperm = { solid: [0], wire: [1] };
  PARTS.sperm = { head: [0], tail: [1] };
}

// Ovum: a large circle in its ring (the zona), and a small nucleus inside
add('ovum', ['óvulo', 'ovulación', 'fertilización in vitro', 'fertilidad', 'egg cell', 'ovum', 'IVF'], [circ(12, 12, 9), circ(12, 12, 6.1), circ(10.4, 10.9, 1.6)]);
FILL.ovum = { solid: [0], cut: [1, 2] };
PARTS.ovum = { zona: [0], cell: [1], nucleus: [2] };

// Embryo: the circle of the zona holding four round cells packed together, the walls between them a
// cross
{
  const [d, r] = [2.1, 2.85];
  const h = Math.sqrt(r * r - d * d);
  const notch = [[12, 12 - d - h], [12 + d + h, 12], [12, 12 + d + h], [12 - d - h, 12]];
  let cells = `M${pt(notch[3])}`;
  for (let i = 0; i < 4; i++) cells += `A${f(r)} ${f(r)} 0 1 1 ${pt(notch[i])}`;
  cells += 'Z';
  const walls = [line(notch[0], notch[2]), line(notch[3], notch[1])];
  add('embryo', ['embrión', 'fertilización in vitro', 'calidad embrionaria', 'embarazo', 'embryo', 'IVF', 'early pregnancy'], [circ(12, 12, 9), cells, ...walls]);
  FILL.embryo = { solid: [0], cut: [1, 2, 3] };
  PARTS.embryo = { zona: [0], cells: [1, 2, 3] };
}

// Blood vessel: a tube with two walls rising from the bottom and splitting into two branches
{
  const L = [[10.4, 21.75, 0], [10.4, 15.25], [8.25, 11.25], [4.25, 6.75], [3, 2.25, 0]];
  const R = L.map(([x, y, ...k]) => [24 - x, y, ...k]);
  const C = [[6.25, 2.25, 0], [7.25, 5.75], [10.5, 9.4], [12, 12.25, 0], [13.5, 9.4], [16.75, 5.75], [17.75, 2.25, 0]];
  const [outerL, outerR, crotch] = [spline(L), spline(R), spline(C)];
  const vessel = `${outerL}L${pt(C[0])}${splineSegs(C)}L${pt(R[R.length - 1])}${splineSegs([...R].reverse())}Z`;
  add('blood-vessel', ['vaso sanguíneo', 'circulación', 'arteria', 'vena', 'blood vessel', 'artery', 'vein'], [outerL, outerR, crotch]);
  FILL['blood-vessel'] = { solid: [vessel] };
  PARTS['blood-vessel'] = { vessel: [0, 1, 2] };
}

// ── Fill and parts, in blocks ─────────────────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const { d } = icons[name];
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : i));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Mirror ────────────────────────────────────────────────────────────────────────────────────
// Directional: everything seen from the side faces one way and flips in right-to-left languages (the
// head, the leg and the foot in profile, the joints seen from the side, the ear, the eye, the brain,
// the smell rising, the spine's curve, the swimming sperm); the
// front views and the organs, whose sides are the body's own, stay as they are
for (const name of [
  'head-side', 'head-side-brain', 'leg', 'foot', 'knee', 'elbow', 'ear', 'ear-sound', 'nose-scent', 'eyeball', 'brain-side',
  'spine', 'sperm',
])
  icons[name].mirror = true;

// ── Levels ────────────────────────────────────────────────────────────────────────────────────
// Hearing: the sound arcs light up from the ear outward, as the core waves do
icons['ear-sound'].levels = [[3], [2]];

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// Each one's own gesture: the heart beats and the lungs breathe, the mind pulses,
// the smell floats up, the strand of hair falls, the sperm swims ahead, the forearm and the shin
// swing from their joints, the tongue waggles
icons['anatomical-heart'].motion = { effect: 'beat', origin: [12.4, 15.25] };
icons.lungs.motion = { effect: 'beat', parts: ['lungs'], origin: [12, 12.5] };
icons['head-side-brain'].motion = { effect: 'beat', parts: ['brain'], origin: [11.2, 9.5] };
icons['nose-scent'].motion = { effect: 'float', parts: ['scent'], vector: [0, -1.5] };
icons['hair-loss'].motion = { effect: 'slide', parts: ['falling'], vector: [0.4, 1.75] };
icons.sperm.motion = { effect: 'slide', vector: [-1.5, -1.5] };
icons.elbow.motion = { effect: 'wiggle', parts: ['ulna'], origin: [10.25, 8.75] };
icons.knee.motion = { effect: 'wiggle', parts: ['tibia'], origin: [10.6, 11.75] };
icons.tongue.motion = { effect: 'wiggle', parts: ['tongue'], origin: [12, 7.6] };

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// Already round: the white blood cell, the egg and the embryo come in their own circle
for (const name of ['white-blood-cell', 'ovum', 'embryo']) icons[name].variants = { circle: false };
// The sperm and the neuron lie along the slash's own diagonal: a slash would only erase them
for (const name of ['sperm', 'neuron']) icons[name].variants = { slash: false };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these still turned to mush. Their own drawings
// run through pixel centers (0.75 + 1.5k) and keep a pixel of paper between pieces: at 16 px an arm or
// a leg has no room for a hollow, so the body's limbs become single strokes off its outlined trunk;
// the skeleton, the spine, the muscle and the hair keep fewer, wider-spaced strokes.
const PX = (k) => 0.75 + 1.5 * k;
const small = (name, d, fill) => {
  icons[name].small = { d, ...(fill && { fill }) };
};
{
  // The body: the head's ring, the trunk from the shoulders to the hips, single strokes for the limbs
  const head = circ(12, 4.5, 2.25);
  const trunk = roundpoly([[PX(5), PX(6)], [PX(10), PX(6)], [PX(10), PX(10)], [PX(5), PX(10)]], [1.1, 1.1, 0.6, 0.6]);
  const limbs = [line([PX(5), PX(7)], [PX(3), PX(10)]), line([PX(10), PX(7)], [PX(12), PX(10)]), line([PX(6), PX(10)], [PX(5), PX(14)]), line([PX(9), PX(10)], [PX(10), PX(14)])];
  const d = [head, trunk, ...limbs];
  for (const name of ['body', 'body-back']) small(name, d, { solid: [head, trunk], wire: limbs });
  // With a badge, a pixel to the left; with the height, two, the dimension line on pixel centers
  const shifted = (k) => d.map((p) => move(p, -1.5 * k, 0));
  for (const name of ['body-search', 'body-alert']) {
    small(name, shifted(1), { solid: shifted(1).slice(0, 2), wire: shifted(1).slice(2) });
    icons[name].small.badge = badge(icons[name].badge.kind, { size: 16 });
  }
  const h = shifted(2);
  const measure = [line([PX(13), PX(1)], [PX(13), PX(14)]), line([PX(12), PX(1)], [PX(14), PX(1)]), line([PX(12), PX(14)], [PX(14), PX(14)])];
  small('body-height', [...h, ...measure], { solid: h.slice(0, 2), wire: h.slice(2), lines: measure });
}
{
  // The skeleton: the skull, the spine, the shoulders and arms, one pair of ribs, the pelvis and legs
  const skull = circ(PX(8), PX(2), 1.5);
  const spine = line([PX(8), PX(4)], [PX(8), PX(10)]);
  const arms = [line([PX(5), PX(9)], [PX(5), PX(5)], [PX(11), PX(5)], [PX(11), PX(9)])];
  const ribs = line([PX(6), PX(7)], [PX(10), PX(7)]);
  const pelvis = line([PX(6), PX(10)], [PX(10), PX(10)]);
  const legs = [line([PX(6), PX(10)], [PX(6), PX(14)]), line([PX(10), PX(10)], [PX(10), PX(14)])];
  small('skeleton', [skull, spine, ...arms, ribs, pelvis, ...legs], false);
}
{
  // The spine: five vertebrae down an S, each two pixels tall and a pixel of paper from the next
  const v = [[7, 1, 2], [8, 4, 3], [8, 7, 3], [7, 10, 3], [6, 13, 4]].map(([i, j, w]) => roundpoly([[PX(i), PX(j)], [PX(i + w - 1), PX(j)], [PX(i + w - 1), PX(j + 1)], [PX(i), PX(j + 1)]], 0.5));
  small('spine', v, { solid: v });
}
{
  // The muscle: the spindle and the tendons' line through it, its side fibers dropped
  const belly = spline([[PX(2.5), PX(12.5), 0], [PX(3.5), PX(7)], [PX(7), PX(3.5)], [PX(12.5), PX(2.5), 0], [PX(11.5), PX(8)], [PX(8), PX(11.5)]], true);
  const axis = line([PX(0), PX(15)], [PX(15), PX(0)]);
  small('muscle', [belly, axis], { solid: [belly], wire: [axis] });
}
{
  // Hair: the crown, the two falling edges and the parting; the type is in the edges' shape
  const top = `M${PX(3)} ${PX(7)}C${PX(3)} ${PX(2)} ${PX(5)} ${PX(1)} 12 ${PX(1)}C${PX(10)} ${PX(1)} ${PX(12)} ${PX(2)} ${PX(12)} ${PX(7)}`;
  const parting = line([PX(7), PX(1)], [PX(7), PX(4)]);
  const edge = (x, kind, dir) => {
    if (kind === 'straight') return line([x, PX(7)], [x, PX(14)]);
    const pts = [];
    if (kind === 'zig') for (let j = 7; j <= 14; j += 1) pts.push([x + ([0, 1, 0, -1][(j - 7) % 4] * dir * 1.5), PX(j)]);
    else for (let j = 7; j <= 14; j++) pts.push([x + (j % 4 === 1 ? dir * 1.5 : j % 4 === 3 ? -dir * 1.5 : 0), PX(j)]);
    return kind === 'zig' ? line(...pts) : spline(pts);
  };
  const inner = (kind) => edge(PX(7), kind, 1);
  for (const [name, kind] of [['hair', 'straight'], ['hair-wavy', 'wave'], ['hair-curly', 'wave'], ['hair-coily', 'zig']])
    small(name, [top, edge(PX(3), kind, -1), edge(PX(12), kind, 1), parting, inner(kind)], false);
  small('hair-loss', [top, line([PX(3), PX(7)], [PX(3), PX(14)]), line([PX(12), PX(7)], [PX(12), PX(14)]), line([PX(7), PX(5)], [PX(7), PX(8)])], false);
}
{
  // The dental arch: the horseshoe as one band, its teeth parted by four gaps
  const outer = `M${PX(2)} ${PX(14)}V${PX(7)}C${PX(2)} ${PX(3)} ${PX(4)} ${PX(1)} 12 ${PX(1)}C${PX(11)} ${PX(1)} ${PX(13)} ${PX(3)} ${PX(13)} ${PX(7)}V${PX(14)}`;
  const inner = `M${PX(5)} ${PX(14)}V${PX(8)}C${PX(5)} ${PX(5.5)} ${PX(6)} ${PX(4)} 12 ${PX(4)}C${PX(9)} ${PX(4)} ${PX(10)} ${PX(5.5)} ${PX(10)} ${PX(8)}V${PX(14)}`;
  const ends = [line([PX(2), PX(14)], [PX(5), PX(14)]), line([PX(10), PX(14)], [PX(13), PX(14)])];
  const gaps = [line([PX(2), PX(10)], [PX(5), PX(10)]), line([PX(10), PX(10)], [PX(13), PX(10)])];
  small('dental-arch', [outer, inner, ...ends, ...gaps], false);
}
{
  // The open mouth: the lips' outline, the opening and the edge of the teeth
  const lips = roundpoly([[PX(1), PX(7)], [PX(4), PX(3)], [PX(11), PX(3)], [PX(14), PX(7)], [PX(11), PX(12)], [PX(4), PX(12)]], 1.2);
  const open = roundpoly([[PX(4), PX(6)], [PX(11), PX(6)], [PX(11), PX(9)], [PX(4), PX(9)]], 1.2);
  small('mouth-open', [lips, open], { solid: [lips], cut: [open] });
}
{
  // Teeth: the bite line and the gaps, the rows' outline around them
  const out = roundpoly([[PX(1), PX(4)], [PX(14), PX(4)], [PX(14), PX(11)], [PX(1), PX(11)]], 2.2);
  const lines = [line([PX(1), PX(7)], [PX(14), PX(7)]), line([PX(5), PX(4)], [PX(5), PX(11)]), line([PX(10), PX(4)], [PX(10), PX(11)])];
  small('teeth', [out, ...lines], false);
}
{
  // The head with the brain: the profile as the engine snaps it, the brain a plain rounded lobe
  const brain = roundpoly([[PX(4), PX(3)], [PX(9), PX(3)], [PX(9), PX(6)], [PX(4), PX(6)]], 1.6);
  small('head-side-brain', [HEAD_SIDE, brain], { solid: [shut(HEAD_SIDE)], cut: [brain] });
}
{
  // The brain in profile: the cerebrum a broad lobe with its fissure, the cerebellum and the stem
  const cerebrum = roundpoly([[PX(1), PX(2)], [PX(14), PX(2)], [PX(14), PX(9)], [PX(1), PX(9)]], 3.4);
  const fold = line([PX(8), PX(9)], [PX(6), PX(6)]);
  const cerebellum = roundpoly([[PX(2), PX(11)], [PX(6), PX(11)], [PX(6), PX(13)], [PX(2), PX(13)]], 1.4);
  const stem = line([PX(9), PX(9)], [PX(9), PX(14)]);
  small('brain-side', [cerebrum, fold, cerebellum, stem], { solid: [cerebrum, cerebellum], cut: [fold], wire: [stem] });
}
{
  // The intestines: the frame of the large one, the small one coiled once inside it
  const frame = roundline([[PX(2), PX(14)], [PX(2), PX(2)], [PX(13), PX(2)], [PX(13), PX(12)], [PX(11), PX(14)]], [0, 1.6, 1.6, 1.2, 0]);
  const coil = roundline([[PX(5), PX(5)], [PX(10), PX(5)], [PX(10), PX(8)], [PX(5), PX(8)], [PX(5), PX(11)], [PX(9), PX(11)]], [0, 1.2, 1.2, 1.2, 1.2, 0]);
  small('intestines', [frame, coil], false);
}
{
  // The egg: its ring and a smaller cell inside it, no nucleus
  small('ovum', [circ(12, 12, 8.25), circ(12, 12, 5.25)], { solid: [circ(12, 12, 8.25)], cut: [circ(12, 12, 5.25)] });
}
const P = (i, j) => [PX(i), PX(j)];
{
  // The elbow: the humerus coming down to its round end, and the ulna's hook around it, a pixel of paper
  // between them, running off to the right as the forearm
  const humerus = `M${pt(P(6, 1))}V${f(PX(6))}A1.5 1.5 0 0 0 ${pt(P(8, 6))}V${f(PX(1))}`;
  const ulna = roundline([P(14, 9), P(4, 9), P(4, 3)], [0, 1.5, 0]) + `A1.5 1.5 0 0 0 ${pt(P(2, 3))}` + roundline([P(2, 3), P(2, 12), P(14, 12)], [0, 2.25, 0]).replace(/^M[^L]*/, '');
  small('elbow', [humerus, ulna], { solid: [`${humerus}Z`, `${ulna}Z`] });
}

export default { category: 'anatomia', label: 'Cuerpo y anatomía', icons };
