// Birds, insects, and reptiles. Everything is computed with the engine (engine/geometry.mjs) and the
// rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a square bottom-right corner
// on containers. The animals are silhouettes built as belts around pulleys (`belt`: tangents
// between circles, so every outline is made of lines and true arcs, the way the set builds its
// shapes), with their details as strokes and cuts.
// - The birds share one songbird (`songbird`): its head, beak, belly and upturned tail. bird-*
//   are that bird; the others keep its head and eye where their kind allows. Birds in profile face
//   right and stand on one perch or ground line (y 20.75, as lugares' and agricultura's ground).
// - Insects seen from the top share one axis (x 12, the head up) and, where they show legs, the
//   same six; in profile they stand on the ground line. None takes the shape of desarrollo's bug
//   (a flat-topped body, a center line, legs straight out).
// - The dinosaurs are profiles on the ground line at one scale.
// The category adopts comida's egg (egg-hatching is its shell), lugares' map pin (map-pin-bird, as
// mascotas' map-pin-paw) and lugares' flower (pollination). Badges are the engine's; a piece in
// front of another (a body before its wings, a perch before a tail) is a custom badge, and the
// engine clears what it covers.
// So that every weight from 0.9 to 2.1 keeps one structure: a line inside an animal starts on its
// outline (`nearest`) and a leg on its belly (`belly`); an eye is placed by `eye`, which keeps a
// dot's clearance from the outline or throws; tips are sharp (a pulley of 0 to 0.45) and lobes broad,
// so no small hole opens at light and closes at regular; legs that leave a body together share a
// root.
import { arc, badge, circ, dot, f, flipPath, halfChord, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import comida from './comida.mjs';
import lugares from './lugares.mjs';

const L = lugares.icons;

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const angOf = (c, p) => deg(Math.atan2(p[1] - c[1], p[0] - c[0]));
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

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

/** Ellipse with semi-axes rx, ry (four cubics), as lugares'. */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}

/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** A path scaled by `s` around `o` and moved so that `o` lands on `at`. */
const xf = (d, s, o, at = o) => transform(d, s, at[0] - o[0] * s, at[1] - o[1] * s);
/** The same for a point. */
const xp = (p, s, o, at = o) => [at[0] + (p[0] - o[0]) * s, at[1] + (p[1] - o[1]) * s];

/**
 * A belt around pulleys: the outline that runs along the tangents between consecutive circles
 * [x, y, ρ] and wraps each one, clockwise on screen (the inside on its right). ρ > 0 wraps a convex
 * turn, ρ < 0 a concave one (its center outside the shape), ρ 0 is a sharp point. Every animal's
 * silhouette is one: lines and true arcs, smooth wherever a pulley has a radius. `closed` false
 * draws an open run from the first point to the last (both ρ 0).
 */
function belt(ps, closed = true) {
  const n = ps.length;
  const tan = (A, B) => {
    const D = [B[0] - A[0], B[1] - A[1]];
    const d = len(D);
    const c = (A[2] - B[2]) / d;
    if (Math.abs(c) > 1) throw new Error(`belt: no tangent between ${A} and ${B}`);
    const phi = Math.atan2(D[1], D[0]);
    for (const s of [1, -1]) {
      const a = phi + s * Math.acos(c);
      const nn = [Math.cos(a), Math.sin(a)];
      const TA = [A[0] + A[2] * nn[0], A[1] + A[2] * nn[1]];
      const TB = [B[0] + B[2] * nn[0], B[1] + B[2] * nn[1]];
      const u = unit(sub(TB, TA));
      if (u[1] * nn[0] - u[0] * nn[1] > 0.99) return [TA, TB];
    }
    throw new Error('belt: tangent');
  };
  const segs = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) segs.push(tan(ps[i], ps[(i + 1) % n]));
  const wrap = (P, from, to) => {
    if (!P[2] || len(sub(from, to)) < 0.005) return '';
    const r = Math.abs(P[2]);
    const sweep = P[2] > 0 ? 1 : 0;
    const a0 = angOf(P, from);
    const a1 = angOf(P, to);
    const span = sweep ? (((a1 - a0) % 360) + 360) % 360 : (((a0 - a1) % 360) + 360) % 360;
    // A concave turn of more than a half circle is a loop drawn by a misplaced pulley
    if (!sweep && span > 180) throw new Error(`belt: a concave pulley at ${P} loops (${span.toFixed(0)}°)`);
    // So is a convex one wrapped nearly all the way round (the next pulley's tangent lies behind)
    if (sweep && span > 300) throw new Error(`belt: a convex pulley at ${P} loops (${span.toFixed(0)}°)`);
    return `A${f(r)} ${f(r)} 0 ${span > 180 ? 1 : 0} ${sweep} ${pt(to)}`;
  };
  let s = `M${pt(segs[0][0])}L${pt(segs[0][1])}`;
  for (let i = 1; i < segs.length; i++) s += `${wrap(ps[i], segs[i - 1][1], segs[i][0])}L${pt(segs[i][1])}`;
  if (closed) s += `${wrap(ps[0], segs[n - 1][1], segs[0][0])}Z`;
  return s;
}
/** The point at `t` (0–1) along the straight run from pulley `i` to the next one of a belt. */
function beltEdge(ps, i, t) {
  const A = ps[i];
  const B = ps[(i + 1) % ps.length];
  const D = [B[0] - A[0], B[1] - A[1]];
  const phi = Math.atan2(D[1], D[0]);
  for (const s of [1, -1]) {
    const a = phi + s * Math.acos((A[2] - B[2]) / len(D));
    const nn = [Math.cos(a), Math.sin(a)];
    const TA = [A[0] + A[2] * nn[0], A[1] + A[2] * nn[1]];
    const TB = [B[0] + B[2] * nn[0], B[1] + B[2] * nn[1]];
    const u = unit(sub(TB, TA));
    if (u[1] * nn[0] - u[0] * nn[1] > 0.99) return lerp(TA, TB, t);
  }
}
/** The point at `a` degrees on a pulley (to start a leg or a line on an outline). */
const on = (P, a) => polar(P[0], P[1], Math.abs(P[2]), a);

/** A belt flattened to points (its runs and arcs sampled), to find where a line crosses it. */
function beltPoly(ps) {
  const pts = [];
  const d = belt(ps);
  const re = /([MLA])([^MLAZ]*)/g;
  let cur = null;
  for (const [, c, args] of d.matchAll(re)) {
    const v = args.trim().split(/[\s,]+/).map(Number);
    if (c === 'M' || c === 'L') {
      const q = [v[0], v[1]];
      if (cur && c === 'L') for (let t = 0.1; t < 1; t += 0.1) pts.push(lerp(cur, q, t));
      pts.push(q);
      cur = q;
    } else {
      const [r, , , large, sweep, x, y] = v;
      const q = [x, y];
      // The arc's center from its endpoints, radius and flags
      const m = lerp(cur, q, 0.5);
      const h = Math.sqrt(Math.max(0, r * r - (len(sub(q, cur)) / 2) ** 2));
      const u = unit(sub(q, cur));
      const side = large === sweep ? -1 : 1;
      const C = add2(m, mul([-u[1], u[0]], h * side));
      let a0 = Math.atan2(cur[1] - C[1], cur[0] - C[0]);
      let a1 = Math.atan2(y - C[1], x - C[0]);
      if (sweep && a1 < a0) a1 += 2 * Math.PI;
      if (!sweep && a1 > a0) a1 -= 2 * Math.PI;
      for (let t = 1; t <= 24; t++) pts.push(polar(...C, r, deg(a0 + ((a1 - a0) * t) / 24)));
      cur = q;
    }
  }
  return pts;
}
/** Where the horizontal line y crosses a closed outline of points: its leftmost and rightmost x. */
function across(pts, y) {
  const xs = [];
  for (let i = 0; i < pts.length; i++) {
    const [A, B] = [pts[i], pts[(i + 1) % pts.length]];
    if ((A[1] - y) * (B[1] - y) <= 0 && A[1] !== B[1]) xs.push(A[0] + ((y - A[1]) * (B[0] - A[0])) / (B[1] - A[1]));
  }
  return [Math.min(...xs), Math.max(...xs)];
}
/** A chord across a belt at y, from edge to edge (a stripe or a band that reaches the outline). */
const chord = (ps, y) => {
  const [x0, x1] = across(beltPoly(ps), y);
  return hl(y, x0, x1);
};
/** The nearest point to p on an outline of points (a belt's, or any closed path's samples; `closed`
 *  false for an open polyline). */
function nearest(pts, p, closed = true) {
  let best = pts[0];
  let bd = Infinity;
  for (let i = 0; i < (closed ? pts.length : pts.length - 1); i++) {
    const [A, B] = [pts[i], pts[(i + 1) % pts.length]];
    const v = sub(B, A);
    const L2 = v[0] ** 2 + v[1] ** 2 || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * v[0] + (p[1] - A[1]) * v[1]) / L2));
    const q = add2(A, mul(v, t));
    const dd = len(sub(q, p));
    if (dd < bd) [bd, best] = [dd, q];
  }
  return best;
}
/** Where the vertical line x crosses an outline of points: its top and bottom y. */
function downAt(pts, x) {
  const ys = [];
  for (let i = 0; i < pts.length; i++) {
    const [A, B] = [pts[i], pts[(i + 1) % pts.length]];
    if ((A[0] - x) * (B[0] - x) <= 0 && A[0] !== B[0]) ys.push(A[1] + ((x - A[0]) * (B[1] - A[1])) / (B[0] - A[0]));
  }
  return [Math.min(...ys), Math.max(...ys)];
}
/** The belly under x: the point a leg leaves the outline from. */
const belly = (pts, x) => [x, downAt(pts, x)[1]];
/**
 * An eye near p inside an outline: placed where, within 0.75 of p, it stands farthest from the
 * outline; the set's dot where it keeps the clearance a dot needs at 2.1 (2.85 from the outline's
 * center line), the dense one (r 0.3) where a small head leaves only 2.45. Closer than that it would
 * merge with the outline at bold: the drawing is wrong, so it throws. `search` false keeps it at p
 * (a pair of eyes, which must keep their own distance).
 */
function eye(pts, p, avoid = [], search = true) {
  // `avoid`: open polylines inside the outline (a brow, a mouth) the eye keeps the same clearance from
  const clear = (q) => Math.min(len(sub(nearest(pts, q), q)), ...avoid.map((a) => len(sub(nearest(a, q, false), q))));
  let [q, c] = [p, -1];
  const span = search ? 0.75 : 0;
  for (let dx = -span; dx <= span; dx += 0.25)
    for (let dy = -span; dy <= span; dy += 0.25) {
      const r = [p[0] + dx, p[1] + dy];
      const cr = clear(r) - Math.hypot(dx, dy) * 0.05;
      if (cr > c) [q, c] = [r, cr];
    }
  // A line's end must stand clear of the dot's own edge, so the lines ask the dot's radius more
  const co = len(sub(nearest(pts, q), q));
  const ca = Math.min(99, ...avoid.map((a) => len(sub(nearest(a, q, false), q))));
  if (co >= 2.85 && ca >= 3.55) return dot(...q);
  if (co >= 2.45 && ca >= 3.15) return dot(...q, 0.3);
  c = Math.min(co, ca);
  throw new Error(`eye at ${p} is ${c.toFixed(2)} from its outline`);
}
/** A lens: two arcs from a to b, each bulging `h` off the chord. */
function lens(a, b, h) {
  const c = len(sub(b, a));
  const r = (c * c) / 4 / (2 * h) + h / 2;
  return `M${pt(a)}A${f(r)} ${f(r)} 0 0 1 ${pt(b)}A${f(r)} ${f(r)} 0 0 1 ${pt(a)}Z`;
}
/** A leg: a polyline from the body through its knee to the foot, its knee softly rounded. */
const leg = (...pts) => roundline(pts, pts.map((_, i) => (i && i < pts.length - 1 ? 0.5 : 0)));
/** The same points mirrored across the axis (x 12). */
const mirror = (pts) => pts.map(([x, y]) => [24 - x, y]);

/** Catmull-Rom through the points, as cubics (closed or open). */
function smooth(pts, closed = false, k = 1) {
  const n = pts.length;
  const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let s = `M${pt(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    s += `C${pt(add2(p1, mul(sub(p2, p0), k / 6)))} ${pt(sub(p2, mul(sub(p3, p1), k / 6)))} ${pt(p2)}`;
  }
  return closed ? `${s}Z` : s;
}

/**
 * A band along a curve (its centerline as points), `w` either side: the two offsets as smooth
 * curves, joined by a half circle at the end and a point (or a half circle, `cap0`) at the start.
 * Returns { d, left, right, tangent, normal } so legs and cuts can be hung off its edges.
 */
function band(C, w, cap0 = false) {
  const N = C.length - 1;
  const tangent = (i) => unit(sub(C[Math.min(N, i + 1)], C[Math.max(0, i - 1)]));
  const normal = (i) => [tangent(i)[1], -tangent(i)[0]];
  const left = C.map((q, i) => add2(q, mul(normal(i), w)));
  const right = C.map((q, i) => add2(q, mul(normal(i), -w)));
  const R = f(w);
  const back = smooth([...right].reverse()).replace(/^M[^C]*/, '');
  const d = cap0
    ? `${smooth(left)}A${R} ${R} 0 0 1 ${pt(right[N])}${back}A${R} ${R} 0 0 1 ${pt(left[0])}Z`
    : `M${pt(C[0])}L${pt(left[1])}${smooth(left.slice(1)).replace(/^M[^C]*/, '')}A${R} ${R} 0 0 1 ${pt(right[N])}${smooth([...right.slice(1)].reverse()).replace(/^M[^C]*/, '')}Z`;
  return { d, left, right, tangent, normal };
}

/** Sound: two arcs like the speaker's waves, around `c` (as mascotas' bark). */
const sound = (c, r1, r2, a = 40) => [arc(...c, r1, -a, a).d, arc(...c, r2, -a, a).d];

// ── Ground, perch and water ───────────────────────────────────────────────────────────────────
const GROUND = 20.75;
const ground = (x0 = 2.75, x1 = 21.25) => hl(GROUND, x0, x1);
/** A wave line of `n` half waves from x0 to x1 at y, `amp` high (the water a bird floats on). */
function wave(y, x0, x1, n = 4, amp = 0.8) {
  const w = (x1 - x0) / n;
  let s = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) s += `C${pt([x0 + i * w + w / 3, y + (i % 2 ? amp : -amp)])} ${pt([x0 + i * w + (2 * w) / 3, y + (i % 2 ? amp : -amp)])} ${pt([x0 + (i + 1) * w, y])}`;
  return s;
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs collected as the icons are drawn (by index of `d`, or a stroke of its own). */
const FILL = {};

// ── The songbird ──────────────────────────────────────────────────────────────────────────────
// Facing right: a round head with a short pointed beak, the chin tucked under it, a round belly and
// the tail tipped up behind, the back dipping between tail and head. Its eye, its one wing line and
// its legs hang off the same pulleys. `songbird(opts)` returns its pieces at 1; `at`/`s` place it.
const SB = {
  tailTop: [2.75, 8.6, 0.6],
  back: [8.75, 6.75, -2.75],
  head: [15.25, 7.5, 3.5],
  beak: [21, 8.75, 0.3],
  chin: [18.75, 10.6, -0.7],
  body: [11.75, 12.75, 5],
  tailLow: [2.75, 10.95, 0.6],
};
/** The songbird's pulleys moved down by `dy` (in flight it drops, its legs gone). */
const sbAt = (dy = 0) => Object.fromEntries(Object.entries(SB).map(([k, q]) => [k, [q[0], q[1] + dy, q[2]]]));
function songbird({ open = false, back = null, dy = 0, s = 1, o = [12, GROUND], at = o } = {}) {
  const P = sbAt(dy);
  const beak = open ? [[20.9, 7.65 + dy, 0.3], [19.6, 8.95 + dy, 0], [20.65, 10.1 + dy, 0.3]] : [P.beak];
  const top = back ?? [P.back];
  // Smaller, the pulleys scale (centers and radii), so the dots keep the set's sizes
  const S = (q) => [...xp(q, s, o, at), q[2] * s];
  const X = (p) => xp(p, s, o, at);
  const ps = [P.tailTop, ...top, P.head, ...beak, P.chin, P.body, P.tailLow].map(S);
  const poly = beltPoly(ps);
  // The wing: one line from the shoulder on the back, sweeping back and down into the belly
  const w0 = nearest(poly, X([11, 8.5 + dy]));
  const [c1, c2, e] = [[10, 11 + dy], [10.5, 12.75 + dy], [12.5, 13.5 + dy]].map(X);
  const wing = `M${pt(w0)}C${pt(c1)} ${pt(c2)} ${pt(e)}`;
  const ground = X([0, GROUND])[1];
  // The legs stay 3 apart at any size, so the paper between them and the perch holds at bold
  const mid = X([12, 0])[0];
  const legs = [mid - 1.5, mid + 1.5].map((x) => line(belly(poly, x), [x, ground]));
  const perch = line(X([5.25, GROUND]), X([19.75, GROUND]));
  return { outline: belt(ps), eye: eye(poly, X([P.head[0] + 0.25, P.head[1]])), wing, legs, perch, poly };
}

/** The songbird in flight (bird-flying, carrier-pigeon): lowered, no legs, one broad wing raised
 *  and swept back over it, one outline with the body (its tip round enough that the paper inside it
 *  never pinches off at 2.1). */
const FLYING = (() => {
  const P = sbAt(3);
  return [P.tailTop, [7.6, 9.6, -0.6], [3.25, 3.75, 1.1], [9.5, 4.5, 2.25], [12.25, 7.5, 0], P.head, P.beak, P.chin, P.body, P.tailLow];
})();

{
  const b = songbird();
  add('bird', ['pájaro', 'ave', 'naturaleza', 'bird', 'songbird', 'wildlife'], [b.outline, b.wing, b.eye, ...b.legs, b.perch]);
  FILL.bird = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
}

{
  // In flight: the same bird, lower and without its legs, its broad wing raised and swept back over
  // it, all one silhouette: the back dips between the tail and the wing, the wing's leading edge
  // arches down into the nape. Two plain blades in a V over the back read as a crown, a tulip or a
  // pair of horns; primaries spread at the tip, as rabbit's ears or as fingers that closed at 2.1
  const P = sbAt(3);
  add('bird-flying', ['pájaro volando', 'vuelo', 'libertad', 'bird flying', 'flight', 'freedom'], [belt(FLYING), eye(beltPoly(FLYING), [P.head[0] + 0.25, P.head[1]])]);
  FILL['bird-flying'] = { solid: [0], cut: [1] };
}
/** A gliding gull, as everyone draws it far off: a shallow m, two wing arcs meeting at the body. */
const glide = ([x, y], w) => {
  const r = w * 0.58;
  return `M${pt([x - w, y])}A${f(r)} ${f(r)} 0 0 1 ${pt([x, y + 0.25])}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w, y])}`;
};
{
  // A flock: three gliding birds, each a shallow m (two wing arcs meeting at the body), in a V
  // that rises to the right
  add('bird-flock', ['bandada', 'migración', 'aves', 'flock', 'migration', 'birds'], [glide([16.75, 6.25], 4.5), glide([7, 10], 3.75), glide([13.25, 16.75], 3.75)]);
  FILL['bird-flock'] = false;
}
{
  // Song: the bird smaller and to the left, its beak open, two sound arcs ahead of it
  const [s0, o, to] = [0.72, [12, GROUND], [8.9, GROUND]];
  const b = songbird({ open: true, s: s0, o, at: to });
  const at = xp([19.6, 8.95], s0, o, to);
  add('birdsong', ['canto de pájaro', 'trino', 'sonidos de la naturaleza', 'birdsong', 'bird call', 'chirp'], [b.outline, b.wing, b.eye, ...b.legs, b.perch, ...sound(add2(at, [0.75, 0]), 3.6, 6.6, 22)]);
  FILL.birdsong = { solid: [0], cut: [1, 2], wire: [3, 4, 5], lines: [6, 7] };
}
{
  // A sighting: the bird up and left, the engine's plus at the bottom right (no perch: the badge
  // would cut it beside a leg)
  const b = songbird({ s: 0.72, o: [12, 12], at: [9.75, 9.75] });
  add('bird-plus', ['registrar avistamiento', 'nueva especie', 'lista de aves', 'log sighting', 'add species', 'life list'], [b.outline, b.wing, b.eye, ...b.legs], { badge: badge('plus') });
  FILL['bird-plus'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
}
{
  // lugares' pin with a bird in its head (as mascotas' map-pin-paw puts a paw there). The songbird's
  // silhouette, shrunk to the head's 8 of room, lost its beak and its round head and read as a check
  // mark in the pin; the flock's gliding bird says bird at that size
  const r = 2.05;
  const gull = `M${pt([8, 11])}A${f(r)} ${f(r)} 0 0 1 ${pt([12, 11.5])}A${f(r)} ${f(r)} 0 0 1 ${pt([16, 11])}`;
  add('map-pin-bird', ['avistamiento', 'sitio de observación', 'anidación', 'bird sighting', 'birding hotspot', 'nesting site'], [L['map-pin'].d[0], gull]);
  FILL['map-pin-bird'] = { solid: [0], cut: [1] };
}
{
  // Tracks: two three-toed prints (a hind toe, the middle toe and two side toes from one heel),
  // stepping up a diagonal
  const print = (H, tilt) => {
    const P = (dx, dy) => add2(H, rot([dx, dy], [0, 0], tilt));
    return [line(P(0, 2), P(0, -4.75)), line(P(-3, -2.75), P(0, 0), P(3, -2.75))];
  };
  add('bird-tracks', ['huellas de ave', 'rastro', 'senderismo', 'bird tracks', 'footprints', 'trail signs'], [...print([7.5, 17], -12), ...print([15.75, 8.5], 12)]);
  FILL['bird-tracks'] = false;
}
{
  // Nest box: lugares' house, small, on a post; a round entrance hole and the perch peg under it
  const roof = roundline([[3.75, 10], [12, 3.25], [20.25, 10]], [0, 1.25, 0]);
  const yAt = (x) => 3.25 + (Math.abs(x - 12) * 6.75) / 8.25;
  const box = roundline([[6.5, yAt(6.5)], [6.5, 17.25], [17.5, 17.25], [17.5, yAt(17.5)]], [0, 2.25, 0, 0]);
  add('birdhouse', ['casita para pájaros', 'nido', 'jardín', 'birdhouse', 'nest box', 'garden'], [roof, box, circ(12, 9.75, 1.75), hl(14.35, 10.75, 13.25), vl(12, 17.25, 21.25)]);
  FILL.birdhouse = { solid: [shut(`${box}`)], wire: [0, 4], cut: [2, 3] };
}
{
  // Feeder: a seed tube under the birdhouse's roof, hanging from its hook, the seed inside; a perch
  // runs through its port, and the tube stands in a shallow tray that catches the seed
  const roof = roundline([[5, 8.75], [12, 3.25], [19, 8.75]], [0, 1, 0]);
  const yAt = (x) => 3.25 + (Math.abs(x - 12) * 5.5) / 7;
  const tray = sq(4.75, 17.25, 14.5, 3.25, 1.5);
  const tube = [vl(8, yAt(8), 17.25), vl(16, yAt(16), 17.25)];
  const seeds = [dot(12, 8.75, 0.3), dot(10.6, 11.25, 0.3), dot(13.4, 11.25, 0.3)];
  add('bird-feeder', ['comedero', 'alimentar aves', 'jardín', 'bird feeder', 'backyard birding', 'seed'], [vl(12, 1.75, 3.75), roof, ...tube, tray, ...seeds, hl(14, 5.5, 18.5)]);
  FILL['bird-feeder'] = { solid: [`M${pt([8, yAt(8)])}L12 3.25L${pt([16, yAt(16)])}V17.25H8Z`, 4], wire: [0, 1], cut: [5, 6, 7, 8] };
}
{
  // Birdbath: a wide shallow basin with its water line, on a slender pedestal and foot
  const B = [[3, 8.75, 0.25], [21, 8.75, 0.25], [16.75, 10.25, 3.75], [7.25, 10.25, 3.75]];
  const basin = belt(B);
  const bottom = belly(beltPoly(B), 10.75)[1];
  const stand = roundline([[10.75, bottom], [10.75, 17.75], [7.25, 20.75], [16.75, 20.75], [13.25, 17.75], [13.25, bottom]], [0, 1.5, 0.5, 0.5, 1.5, 0]);
  add('birdbath', ['bebedero de aves', 'fuente de jardín', 'jardín', 'birdbath', 'garden', 'bird water'], [basin, chord(B, 11.25), stand]);
  FILL.birdbath = { solid: [0, shut(stand)], cut: [1] };
}
{
  // Nest: a woven bowl, two twigs crossing in its weave, and three eggs sitting in it, the middle
  // one higher and in front of the other two. The bowl and the middle egg sit in front (a custom
  // badge): the engine clears the side eggs behind them. Its rim stops at the bowl: run out past
  // it, it was a sombrero's brim
  const R = 12.75;
  const cup = `M3.5 ${f(R)}C3.5 17.75 7.25 20.75 12 20.75S20.5 17.75 20.5 ${f(R)}Z`;
  const weave = ['M4.75 15.25C9 16 13.5 17.5 16.75 19.6', 'M19.25 15.25C15 16 10.5 17.5 7.25 19.6'];
  const mid = `M${pt([9.6, R])}A2.4 4.5 0 0 1 ${pt([14.4, R])}`;
  const side = (x) => ell([x, R - 0.5], 2.25, 3);
  add('nest', ['nido', 'anidar', 'hogar', 'nest', 'nesting', 'eggs'], [side(6.25), side(17.75)], {
    badge: { d: [cup, ...weave, mid], knock: `${cup}${mid}Z`, fill: { solid: [cup, `${mid}Z`], cut: weave } },
  });
  FILL.nest = { solid: [0, 1] };
}
{
  // Hatching: comida's egg (its shell's measurements), broken along a zigzag; the chick's head and
  // beak rise out of the lower shell, which sits in front (a custom badge)
  const [C, w, top, bottom] = [[12, 14], 6.75, 11.25, 7.25];
  const y = 12.5;
  const xs = Math.sqrt(1 - ((C[1] - y) / top) ** 2) * w;
  const n = 6;
  const zig = Array.from({ length: n + 1 }, (_, i) => [C[0] + xs - (2 * xs * i) / n, y + (i % 2 ? 1.25 : 0)]);
  const shell = `M${pt([C[0] - xs, y])}A${f(w)} ${f(top)} 0 0 0 ${pt([C[0] - w, C[1]])}A${f(w)} ${f(bottom)} 0 0 0 ${pt([C[0] + w, C[1]])}A${f(w)} ${f(top)} 0 0 0 ${pt(zig[0])}${zig.slice(1).map((p) => `L${pt(p)}`).join('')}Z`;
  const H = [[12, 9.25, 4], [17.75, 8.75, 0]];
  const head = belt(H);
  add('egg-hatching', ['eclosión', 'nuevo', 'lanzamiento', 'beta', 'hatching', 'new', 'onboarding'], [head, eye(beltPoly(H), [12.25, 7.75], [], false)], { badge: { d: [shell], knock: shell, fill: { solid: [shell] } } });
  FILL['egg-hatching'] = { solid: [0], cut: [1] };
}
{
  // Feather: a vane with a round tip and a notch in each edge, the shaft down its middle and the
  // bare quill below; drawn upright and tilted 40°
  const vane = 'M10.85 16.25C9.75 14.9 9.1 13.4 8.9 11.85L10.75 12.1L8.95 10.65C9.05 9.25 9.3 7.95 9.75 6.75C10.4 5.4 11.25 4.2 12 3.25C13.6 4.5 15.1 6.75 15.4 9.5L13.4 10.6L15.25 11C14.9 13.1 14.1 14.9 13.15 16.25Z';
  const T = (d) => turnPath(d, 40, [12, 12]);
  add('feather', ['pluma', 'ligero', 'suave', 'feather', 'lightweight', 'soft'], [T(vane), T(vl(12, 6.25, 16.25)), T(vl(12, 16.25, 21))]);
  FILL.feather = { solid: [0], cut: [1], wire: [2] };
}
{
  // Chick: a round body under a small head with a tiny beak, a wing and two stick feet; no comb
  const C = [[14.75, 7.5, 3.25], [19.75, 8, 0.3], [17.85, 9.6, -0.6], [11.25, 13.25, 5.25]];
  const poly = beltPoly(C);
  const foot = (x) => roundline([belly(poly, x), [x, GROUND], [x + 2, GROUND]], [0, 0.6, 0]);
  const w0 = nearest(poly, [6, 12.5]);
  add('chick', ['pollito', 'principiante', 'primavera', 'chick', 'beginner', 'newcomer'], [belt(C), eye(poly, [15.25, 7.5]), `M${pt(w0)}C7.5 14.75 9.25 15.5 11.25 15.25`, foot(9), foot(14)]);
  FILL.chick = { solid: [0], cut: [1, 2], wire: [3, 4] };
}
/** A bird's foot on the ground: a leg from the belly of `poly` at x and a toe forward. */
const footAt = (poly, x, toe = 2) => roundline([belly(poly, x), [x, GROUND], [x + toe, GROUND]], [0, 0.6, 0]);
{
  // Hen: a plump body, a short upturned tail, a small comb on the head and the wattle under the beak
  const H = [[3.25, 4.25, 0], [8, 7.25, -1.5], [13.75, 3.75, 0.45], [15.15, 3.6, -0.3], [16.6, 3.35, 0.45], [15.75, 6.5, 3], [20, 7.5, 0], [17.85, 8.75, -0.4], [17.9, 10.4, 0.45], [17.3, 11.8, -0.5], [11, 12.75, 5.75]];
  const poly = beltPoly(H);
  const w0 = nearest(poly, [6.5, 11]);
  add('hen', ['gallina', 'granja', 'huevos', 'hen', 'chicken', 'farm'], [belt(H), eye(poly, [15.75, 6.75]), `M${pt(w0)}C7.25 13.75 9.25 14.75 11.75 14.25`, footAt(poly, 9), footAt(poly, 14)]);
  FILL.hen = { solid: [0], cut: [1, 2], wire: [3, 4] };
}
{
  // Turkey, from the front, as everyone draws it: its tail fanned up behind it in a half disk of
  // five broad feathers, the plump body before it (a custom badge, so the engine clears the fan it
  // covers) with the small head on top and the snood hanging over the breast, and two feet. In
  // profile, its fan around the body read as a cabbage, a shrimp on its back or a gauge
  const C = [12, 14];
  const [n, a0, a1] = [6, 160, 380];
  const Rc = 7.75;
  const at = (k) => a0 + ((a1 - a0) * k) / n;
  const cusp = (k) => polar(...C, Rc, at(k));
  const ch = 2 * Rc * Math.sin(rad((a1 - a0) / n / 2));
  const sag = 1.25;
  const rr = (ch * ch) / 4 / (2 * sag) + sag / 2;
  const F = `M${pt(C)}L${pt(cusp(0))}${range(0, n).map((k) => `A${f(rr)} ${f(rr)} 0 0 1 ${pt(cusp(k + 1))}`).join('')}Z`;
  // A ray runs in from each notch between two feathers (the engine clears it under the body)
  const rays = [1, 2, 4, 5].map((k) => line(C, cusp(k)));
  const T = [[12, 8.25, 2], [14.1, 11.25, -0.6], [12, 15.75, 3.25], [9.9, 11.25, -0.6]];
  const turkey = belt(T);
  const tp = beltPoly(T);
  const feet = [10.5, 13.5].map((x) => line(belly(tp, x), [x, GROUND]));
  add('turkey', ['pavo', 'acción de gracias', 'granja', 'turkey', 'thanksgiving', 'poultry'], [F, ...rays], {
    badge: { d: [turkey, ...feet], knock: `${turkey}`, fill: { solid: [turkey], wire: feet } },
  });
  FILL.turkey = { solid: [0], cut: [1, 2, 3, 4] };
}
/** The water a bird floats on. */
const WATER = wave(20.25, 2.75, 21.25, 4, 0.6);
{
  // Duck: a mallard floating on the water: a flat round bill, and the drake's curl turned up at
  // the tip of its tail (a hook of its outline)
  const P = [[2.5, 11.75, 0.4], [3.75, 8.25, 0.5], [5.4, 10.25, -0.5], [9, 5.75, -3], [15, 7, 3], [20.75, 9.6, 0.9], [17.75, 10.6, -0.5], [15.5, 14, 3], [7, 14.75, 2.25]];
  const poly = beltPoly(P);
  const w0 = nearest(poly, [8, 12.5]);
  add('duck', ['pato', 'estanque', 'parque', 'duck', 'mallard', 'pond'], [belt(P), eye(poly, [15.25, 7]), `M${pt(w0)}C9.5 13.25 11 13.5 12.75 13`, WATER]);
  FILL.duck = { solid: [0], cut: [1, 2], wire: [3] };
}
{
  // Goose: standing, its long neck straight up, the knob at the base of its bill
  const G = [[2.75, 11.5, 0.5], [13.25, 8.75, -1.6], [16.25, 4.75, 2.75], [17.85, 2.5, 0.6], [21, 5.25, 0.35], [18.1, 6.75, -0.4], [15.25, 14, 3], [9.5, 13, 4.5]];
  const poly = beltPoly(G);
  add('goose', ['ganso', 'granja', 'graznido', 'goose', 'farm', 'honk'], [belt(G), eye(poly, [16.25, 4.75]), footAt(poly, 7.5), footAt(poly, 12.5)]);
  FILL.goose = { solid: [0], cut: [1], wire: [2, 3] };
}
{
  // Swan: floating, one wing raised in an arch, the neck an S of two bends rising from the breast
  const [C1, R1, C2, R2, w] = [[15.25, 10.5], 2.6, [18.5, 6], 2.5, 1.1];
  const S = [[2.75, 9.25, 0.4], [8.25, 10.75, 4], [13.4, 12, -0.5], [...C1, -(R1 - w)], [...C2, R2 + w], [19.25, 3.4, 1.4], [21.25, 6.5, 0.3], [19.6, 5.4, -0.2], [...C2, -(R2 - w)], [...C1, R1 + w], [17.25, 15, 2.25], [6.5, 15.25, 2.25]];
  const w0 = nearest(beltPoly(S), [4.5, 11.5]);
  add('swan', ['cisne', 'elegancia', 'lago', 'swan', 'lake', 'grace'], [belt(S), `M${pt(w0)}C7.25 11.75 9.5 12 11.5 13.5`, WATER]);
  FILL.swan = { solid: [0], cut: [1], wire: [2] };
}
{
  // Eagle: the head and neck in profile, no shield and no wings: the crown, the heavy brow over the
  // eye, the deep hooked beak, the feathers ragged at the base of the neck
  const E = [[4.75, 21.25, 0.3], [5, 13.75, -3], [11.75, 8.75, 5.25], [15.75, 4.6, 0.6], [18.25, 8, 2.5], [19.5, 13.25, 0.3], [17.6, 11.4, -0.5], [15.5, 11.5, 0], [15.25, 14, -1.4], [14.75, 21.25, 0.3], [12.25, 19.75, 0], [9.75, 21.25, 0.3], [7.25, 19.75, 0]];
  const poly = beltPoly(E);
  const brow = [nearest(poly, [15.6, 5.6]), [13, 6.25]];
  add('eagle', ['águila', 'visión', 'enfoque', 'eagle', 'bird of prey', 'focus'], [belt(E), line(...brow), eye(poly, [13.5, 9.25], [brow])]);
  FILL.eagle = { solid: [0], cut: [1, 2] };
}
{
  // Owl, from the front: a round body with its two ear tufts, two big round eyes and the beak
  // hanging between them
  const body = belt([[5, 3, 0.4], [12, -0.75, -6.5], [19, 3, 0.4], [15.5, 15.75, 4.75], [8.5, 15.75, 4.75]]);
  const beak = line(polar(9.5, 10, 2.5, 45), [12, 13.75], polar(14.5, 10, 2.5, 135));
  add('owl', ['búho', 'modo noche', 'sabiduría', 'owl', 'night mode', 'wisdom'], [body, circ(9.5, 10, 2.5), circ(14.5, 10, 2.5), beak]);
  FILL.owl = { solid: [0], cut: [1, 2, 3] };
}
{
  // Parrot: perched, its stout hooked beak curling down (as big as its head, it was an elephant's
  // trunk), the long tail hanging below the perch, which
  // passes in front of it (a custom badge, so the engine clears the tail behind it)
  const Pr = [[8, 21.5, 0], [9.5, 9, 2.75], [13, 5, 2.4], [16.4, 5.6, 1], [17.25, 8.4, 0], [15.6, 7.9, -0.4], [12.75, 10.75, 3], [11.4, 17.25, -1.1]];
  const poly = beltPoly(Pr);
  const perch = hl(15.75, 4, 20);
  const w0 = nearest(poly, [7.5, 8.5]);
  add('parrot', ['loro', 'perico', 'repetir', 'parrot', 'repeat', 'tropical'], [belt(Pr), eye(poly, [13.25, 5]), `M${pt(w0)}C9 9.5 9.25 12 10.5 13.25`], { badge: { d: [perch], knock: `${perch}Z` } });
  FILL.parrot = { solid: [0], cut: [1, 2] };
}
{
  // Penguin, from the front: a tall body, the belly an oval inside it, two eyes, the flippers held
  // out and two feet
  const Pg = [[12, 6.75, 4.5], [16.25, 11.25, -0.75], [20.25, 15.25, 0.6], [17, 13.75, -0.75], [14.75, 18.75, 2], [9.25, 18.75, 2], [7, 13.75, -0.75], [3.75, 15.25, 0.6], [7.75, 11.25, -0.75]];
  const poly = beltPoly(Pg);
  add('penguin', ['pingüino', 'frío', 'polar', 'penguin', 'cold', 'winter'], [belt(Pg), ell([12, 14.5], 3.25, 4), eye(poly, [10.2, 6.75], [], false), eye(poly, [13.8, 6.75], [], false), hl(GROUND, 8.5, 10.5), hl(GROUND, 13.5, 15.5)]);
  FILL.penguin = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
}
{
  // Flamingo: on one long leg, the other bent up, the neck an S and the bill sharply bent
  const body = belt([[3.25, 10, 0], [8.5, 9.5, 3], [11.5, 10, 2.25], [9.5, 11.5, 1.5]]);
  const head = belt([[14.75, 4, 1.6], [18.25, 4.75, 0.5], [18.25, 7.75, 0], [16.9, 5.6, -0.35]]);
  add('flamingo', ['flamenco', 'tropical', 'verano', 'flamingo', 'summer', 'wetlands'], [body, head, 'M13.5 9C15.75 7.75 15.75 6.75 13.75 5.75C12 4.75 12.75 3 14.25 2.6', vl(9.5, 13, GROUND), roundline([[7.75, 12.6], [13.5, 15.5], [9.5, 18.75]], [0, 0.6, 0])]);
  FILL.flamingo = { solid: [0, 1], wire: [2, 3, 4] };
}
{
  // Hummingbird: hovering, its body tilted up, the needle bill, one wing raised and one lowered
  // behind it
  const Hb = [[6.25, 20.25, 0.4], [9.25, 14.75, -0.6], [2.75, 12.5, 0.35], [9.75, 11.25, -0.6], [5.25, 3, 0.35], [12, 9.25, -0.6], [14.75, 7.5, 2.5], [13.75, 12.25, 2.5]];
  const poly = beltPoly(Hb);
  add('hummingbird', ['colibrí', 'rapidez', 'néctar', 'hummingbird', 'hovering', 'nectar'], [belt(Hb), line(nearest(poly, [17.25, 6.5]), [21.5, 4.25]), eye(poly, [14.75, 7.75])]);
  FILL.hummingbird = { solid: [0], wire: [1], cut: [2] };
}
// The pigeon: a puffed chest under a small head, a short bill, the tail level behind
const PIGEON = [[2.75, 13, 0.4], [9.75, 11.5, 4], [12.5, 7, -1], [16, 6, 2.5], [19.75, 7.5, 0.3], [17.85, 8.4, -0.4], [14.5, 12.25, 4.25], [10.5, 14.25, 3.5]];
{
  const poly = beltPoly(PIGEON);
  const w0 = nearest(poly, [7, 9.5]);
  add('pigeon', ['paloma', 'ciudad', 'plaza', 'pigeon', 'city bird', 'park'], [belt(PIGEON), eye(poly, [16, 6]), `M${pt(w0)}C8.75 11.75 10.5 12.5 12.75 12.25`, line(belly(poly, 10.25), [9, GROUND]), line(belly(poly, 12.75), [14.5, GROUND])]);
  FILL.pigeon = { solid: [0], cut: [1, 2], wire: [3, 4] };
}
{
  // Carrier pigeon: bird-flying's silhouette, smaller and up to the left, an envelope held in its
  // bill (in front of it: a custom badge, so the engine clears the bill and chest it covers). A
  // rolled letter beside the bill read as a padlock
  const s = 0.78;
  const [o, at] = [[12, 12], [10.5, 10.5]];
  // Smaller, the wing's tip keeps the radius that holds its paper at 2.1
  const FLY = FLYING.map((q) => [...xp(q, s, o, at), q[2] >= 1.1 ? Math.max(q[2] * s, 1.1) : q[2] * s]);
  const env = sq(13.75, 13, 8, 6.25, 2, BR);
  const flap = line([14.75, 14.25], [17.75, 16.5], [20.75, 14.25]);
  add('carrier-pigeon', ['paloma mensajera', 'enviar mensaje', 'correo', 'carrier pigeon', 'send message', 'mail'], [belt(FLY)], { badge: { d: [env, flap], knock: env, fill: { solid: [env], cut: [flap] } } });
  FILL['carrier-pigeon'] = { solid: [0] };
}
{
  // Crow: heavy, perched, its bill thick and straight, the wings reaching the tip of its tail
  const Cr = [[3.5, 17.5, 0], [10.5, 11.5, 4.75], [15, 6.75, 3], [21.25, 8.6, 0], [17.6, 10.1, -0.4], [12.5, 14, 3.75], [10, 16, 2.5]];
  const poly = beltPoly(Cr);
  const w0 = nearest(poly, [11.5, 6.75]);
  add('crow', ['cuervo', 'halloween', 'presagio', 'crow', 'raven', 'omen'], [belt(Cr), eye(poly, [15, 6.75]), `M${pt(w0)}C10.75 9.75 8.75 12.5 6.5 15.25`, line(belly(poly, 11), [11, GROUND]), line(belly(poly, 13.75), [13.75, GROUND]), ground(3, 21)]);
  FILL.crow = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
}
{
  // Toucan: perched, its banana bill as long as its body, the line between its two halves
  const Tc = [[6.25, 20.35, 0.4], [6.5, 12, 2.5], [8.75, 6.75, 3.5], [15.5, 9.5, 3.5], [21.5, 12, 0.4], [15.75, 12, -1.5], [11.5, 10.9, -0.4], [10.75, 14.25, 3]];
  const poly = beltPoly(Tc);
  add('toucan', ['tucán', 'tropical', 'selva', 'toucan', 'jungle', 'rainforest'], [belt(Tc), eye(poly, [8.5, 6.25]), `M${pt(nearest(poly, [12.25, 8.75]))}C15.5 9.25 18.75 10.5 ${pt(nearest(poly, [21, 12]))}`, line(belly(poly, 9.75), [9.75, GROUND]), ground(4, 15)]);
  FILL.toucan = { solid: [0], cut: [1, 2], wire: [3, 4] };
}
{
  // Ostrich: a round feathered body on two long bare legs, a long thin neck up to a small head
  const B = [[2.75, 10.5, 0.5], [4.25, 8, -0.4], [8.75, 9.25, 4], [12.5, 11, 1.5], [9.5, 13, 0.4], [7.5, 12.75, -0.4], [5.75, 13.25, 0.4]];
  const H = [[16.75, 3.75, 1.5], [20.5, 4.75, 0]];
  const [bp, hp] = [beltPoly(B), beltPoly(H)];
  const n0 = nearest(bp, [12.25, 7.5]);
  const n1 = nearest(hp, [16, 5.25]);
  add('ostrich', ['avestruz', 'ave grande', 'corredor', 'ostrich', 'big bird', 'fast runner'], [belt(B), belt(H), `M${pt(n0)}C14 7 15.75 6.5 ${pt(n1)}`, roundline([nearest(bp, [8, 13.25]), [8.5, 17], [6.5, GROUND]], [0, 0.8, 0]), roundline([nearest(bp, [10.75, 12.75]), [12.25, 16.5], [10.5, GROUND]], [0, 0.8, 0])]);
  FILL.ostrich = { solid: [0, 1], wire: [2, 3, 4] };
}
{
  // Pelican, standing: a heavy body, the neck curving up to its head, the long straight bill and the
  // deep pouch hanging under it (the line between bill and pouch), two short legs. Its pouch as the
  // bottom of one lump with the body read as no bird
  const Pe = [[2.75, 15.75, 0], [9.25, 14.25, 3.75], [10.1, 9, -1.25], [13.75, 6.25, 2.6], [21.75, 9, 0.25], [17.25, 11.5, 1.4], [14.4, 11.9, -0.5], [12, 16, 3.25]];
  const poly = beltPoly(Pe);
  add('pelican', ['pelícano', 'costa', 'puerto', 'pelican', 'coast', 'harbor'], [belt(Pe), eye(poly, [13.75, 6]), line(nearest(poly, [16, 7.75]), nearest(poly, [21, 9.1])), footAt(poly, 8.25), footAt(poly, 13.25)]);
  FILL.pelican = { solid: [0], cut: [1, 2], wire: [3, 4] };
}
{
  // Woodpecker: upright against a trunk, its crest behind, its beak at the bark and its stiff tail
  // braced on it
  const W = [[9.75, 3.25, 0.35], [13, 6.5, 3], [19.35, 7.75, 0], [16.25, 9.1, -0.5], [14.5, 12.75, 2.75], [19.35, 20.75, 0], [14.25, 17, -0.6], [11.25, 12.5, 3.25], [10.4, 8.1, -0.6]];
  const poly = beltPoly(W);
  add('woodpecker', ['pájaro carpintero', 'picotear', 'persistencia', 'woodpecker', 'pecking', 'persistence'], [belt(W), vl(19.5, 2.5, 21.5), eye(poly, [13.25, 6.25])]);
  FILL.woodpecker = { solid: [0], wire: [1], cut: [2] };
}
{
  // Puffin: stout and upright, its big triangular bill and the band across it (a second band left
  // the bill's tip too small to keep its paper at bold)
  const Pf = [[6, 19, 0], [10.5, 14.75, 4.75], [10.75, 8, 3.25], [13.75, 4.75, 0.5], [20.75, 8.75, 0], [13.75, 11, 0.5], [10.5, 14.75, 4.75]];
  const poly = beltPoly(Pf);
  const band = (x) => line([x, downAt(poly, x)[0]], [x, downAt(poly, x)[1]]);
  add('puffin', ['frailecillo', 'ave marina', 'acantilado', 'puffin', 'seabird', 'cliff'], [belt(Pf), eye(poly, [10.75, 8]), band(16.5), footAt(poly, 10.25)]);
  FILL.puffin = { solid: [0], cut: [1, 2], wire: [3] };
}
{
  // Swallow in flight, in profile: sleek and pointed, its long wing raised back over it and the long
  // forked tail, all one silhouette. From below, its round head, its wings and its fork read as a
  // person with raised arms (and as a claw or an up arrow, turned)
  // Its streamers keep a broad root (no concave pulley eats into it), so the paper inside each one
  // only retreats toward its tip as the stroke grows
  const S = [[2.25, 9.25, 0], [9.25, 10.25, 0], [5.25, 2.25, 0], [12.75, 7, 0], [16, 9.5, 2.5], [21.25, 10.5, 0], [17.75, 12, 0], [13, 13, 2.4], [3, 17.75, 0], [7.5, 14, 0]].map(([x, y, r]) => [x, y + 2, r]);
  add('swallow', ['golondrina', 'primavera', 'regreso', 'swallow', 'spring', 'return'], [belt(S), eye(beltPoly(S), [16.25, 11.5])]);
  FILL.swallow = { solid: [0], cut: [1] };
}
{
  // Kiwi: a round body with no tail and no wings, its long thin bill curving down to the ground
  // and sturdy legs
  const K = [[10.5, 12.25, 6.25], [15.75, 9, 2.75], [18.4, 11.25, -0.6]];
  const poly = beltPoly(K);
  const b0 = nearest(poly, [18.25, 10]);
  add('kiwi-bird', ['kiwi', 'ave no voladora', 'nueva zelanda', 'kiwi bird', 'flightless bird', 'new zealand'], [belt(K), eye(poly, [15.5, 8.75]), `M${pt(b0)}C19.4 12.4 20.4 14.75 21 17.75`, roundline([belly(poly, 9), [9, GROUND], [7, GROUND]], [0, 0.6, 0]), roundline([belly(poly, 12.75), [12.75, GROUND], [14.75, GROUND]], [0, 0.6, 0])]);
  FILL['kiwi-bird'] = { solid: [0], cut: [1], wire: [2, 3, 4] };
}
{
  // Dodo: a plump body, a big hooked bill, a tiny wing and a curly tuft for a tail
  const D = [[4.75, 11.75, 0.5], [12.75, 7.25, -1], [16.75, 6.25, 2.75], [19.6, 7, 1.75], [21, 10.5, 0.3], [19.6, 9.5, -0.4], [18, 9.75, 0], [17, 11.25, -0.8], [10.75, 13.25, 5.5]];
  const poly = beltPoly(D);
  const t0 = nearest(poly, [4.5, 10.75]);
  add('dodo', ['dodo', 'extinto', 'obsoleto', 'dodo', 'extinct', 'deprecated'], [belt(D), eye(poly, [16.75, 6.25]), 'M9.5 12.75C10.5 14 12 14.25 13 13.5', `M${pt(t0)}C3.5 9.5 3.25 7.25 4.75 6.75C6 6.4 6.5 8 5.5 8.5`, line(belly(poly, 9.25), [9.25, GROUND]), line(belly(poly, 12.75), [12.75, GROUND])]);
  FILL.dodo = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
}

// ── Insects ───────────────────────────────────────────────────────────────────────────────────
// Seen from the top they share the axis x 12, the head up; in profile they face right and stand
// on the ground line. Their heads, thoraxes and abdomens are beads that touch (tangent circles and
// teardrops), so each joint is one point and nothing overlaps.
/** The bee, from the top: an oval body with three stripes under its head, two round wings behind
 *  it (the body sits in front, a custom badge) and two antennae. `g` places it. */
function bee(g = (d) => d) {
  const B = [[12, 9, 2.25], [12, 16.25, 3.75], [12, 9, 2.25]];
  const body = ell([12, 13.75], 3.75, 6);
  const head = circ(12, 6, 1.75);
  const stripes = [11.25, 14.25, 17.25].map((y) => {
    const w = 3.75 * Math.sqrt(1 - ((y - 13.75) / 6) ** 2);
    return hl(y, 12 - w, 12 + w);
  });
  const wings = [circ(6.75, 9.25, 3), circ(17.25, 9.25, 3)];
  const antennae = [`M${pt(on([12, 6, 1.75], -125))}Q10.25 3 9 2.75`, `M${pt(on([12, 6, 1.75], -55))}Q13.75 3 15 2.75`];
  void B;
  return { body: g(body), head: g(head), stripes: stripes.map(g), wings: wings.map(g), antennae: antennae.map(g) };
}
{
  const b = bee();
  add('bee', ['abeja', 'miel', 'polinización', 'bee', 'honey', 'busy'], b.wings, {
    badge: { d: [b.body, b.head, ...b.stripes, ...b.antennae], knock: `${b.body}${b.head}`, fill: { solid: [b.body, b.head], cut: b.stripes, wire: b.antennae } },
  });
  FILL.bee = { solid: [0, 1] };
}
{
  // Pollination: lugares' flower, open (its five petals and its center), and a small bee flying in
  // to it, apart: the bee's own top view (its striped body and head before two round wings, a custom
  // badge), shrunk and turned toward the flower. Upright, its two raised wings read as a mouse's ears
  const fl = (d) => xf(d, 0.72, [12, 8.75], [8.5, 15.75]);
  const c = [16.75, 7.25];
  const T = (d) => turnPath(d, -40, c);
  const body = T(ell(c, 2.4, 3.75));
  const head = T(circ(c[0], c[1] - 3.75 - 1.35, 1.35));
  const st = [-1.4, 1.4].map((dy) => {
    const w = 2.4 * Math.sqrt(1 - (dy / 3.75) ** 2);
    return T(hl(c[1] + dy, c[0] - w, c[0] + w));
  });
  const wings = [-1, 1].map((k) => T(circ(c[0] + k * 3.5, c[1] - 1.1, 2)));
  FILL.pollination = { solid: [0, 2, 3], cut: [1] };
  add('pollination', ['polinización', 'polinizadores', 'jardín', 'pollination', 'pollinators', 'garden'], [fl(L.flower.d[0]), dot(...xp([12, 8.75], 0.72, [12, 8.75], [8.5, 15.75])), ...wings], {
    badge: { d: [body, head, ...st], knock: `${body}${head}`, fill: { solid: [body, head], cut: st } },
  });
}
{
  // Wasp, from the side and in flight: a small head, a slim thorax, the pinched waist where it
  // touches the abdomen, pointed and striped back to its stinger, a narrow wing, the antenna and the
  // long legs it flies with dangling (tilted at 45° with no legs, the striped cone and its wing read
  // as a carrot and its leaves)
  const abd = [[2, 14.5, 0], [9, 11.75, 2.75]];
  // The beads touch: the thorax (two pulleys) against the abdomen, the head against the thorax
  const t1 = [...add2(abd[1], mul(unit([1, -0.25]), 2.75 + 1.6)), 1.6];
  const t2 = [...add2(t1, [2.1, -0.5]), 1.6];
  const thorax = [t1, t2];
  const head = [...add2(t2, mul(unit([1, -0.45]), 1.6 + 1.5)), 1.5];
  // Two stripes 3 apart: one across the round end, one where the cone still leaves its tip paper
  const ax = unit(sub(abd[0], abd[1]));
  const nx = [ax[1], -ax[0]];
  const st = [0, 3].map((x) => {
    const c = add2(abd[1], mul(ax, x));
    const d = len(sub(abd[0], abd[1]));
    const xt = abd[1][2] ** 2 / d;
    const hw = x <= xt ? Math.sqrt(abd[1][2] ** 2 - x * x) : ((d - x) / (d - xt)) * Math.sqrt(abd[1][2] ** 2 - xt * xt);
    return line(add2(c, mul(nx, hw)), add2(c, mul(nx, -hw)));
  });
  const tp = beltPoly(thorax);
  // The legs share a root under the thorax, clear of the waist, and hang back as it flies
  const root = on(t2, 105);
  const legs = [leg(root, [13, 15], [11.75, 17.5]), leg(root, [16.5, 14.75], [16.25, 17.5])];
  add('wasp', ['avispa', 'aguijón', 'plaga', 'wasp', 'hornet', 'sting'], [belt(abd), belt(thorax), circ(...head), ...st, lens(nearest(tp, [14.25, 7.5]), [7.25, 2.5], 1.25), `M${pt(on(head, -80))}C${pt(add2(head, [0.5, -3.25]))} ${pt(add2(head, [1.25, -4.25]))} ${pt(add2(head, [2.25, -4.75]))}`, ...legs]);
  FILL.wasp = { solid: [0, 1, 2, 5], cut: [3, 4], wire: [6, 7, 8] };
}
{
  // Wasp nest: a paper nest hanging from a slanting branch, narrow where it holds on and round
  // below, banded in layers, its opening at the bottom (a gap in the paper). Round under a level
  // bar, it was a paper lantern
  const [C, R, T, r] = [[12, 13.5], 6.25, [12, 5.25], 1.25];
  const d = len(sub(C, T));
  const ta = deg(Math.acos((R - r) / d));
  const P = (c, rr, a) => polar(...c, rr, a);
  const gap = 14;
  const nest = `M${pt(P(C, R, 90 + gap))}A${R} ${R} 0 0 1 ${pt(P(C, R, 270 - ta))}L${pt(P(T, r, 270 - ta))}A${r} ${r} 0 0 1 ${pt(P(T, r, 270 + ta))}L${pt(P(C, R, 270 + ta))}A${R} ${R} 0 0 1 ${pt(P(C, R, 90 - gap))}`;
  const band = (y) => {
    const w = Math.sqrt(R * R - (y - C[1]) ** 2);
    return `M${pt([C[0] - w, y])}Q12 ${f(y + 1.5)} ${pt([C[0] + w, y])}`;
  };
  add('wasp-nest', ['avispero', 'nido de avispas', 'plaga', 'wasp nest', 'hornet nest', 'pest removal'], [line([3, 6.5], [21, 2.5]), nest, band(11.25), band(15.25)]);
  FILL['wasp-nest'] = { solid: [shut(nest)], wire: [0], cut: [2, 3] };
}
{
  // Butterfly, from the top: on each side a large wing above and a small one below, the two sides
  // one outline meeting down the middle, where the body is a line; the antennae end in clubs
  const R = [[18.75, 6.5, 2.75], [19.75, 11.25, 1.25], [17.75, 12.5, -0.3], [16.25, 16.25, 2.5]];
  const Lw = R.map(([x, y, r]) => [24 - x, y, r]).reverse();
  const top = [12, 8.75, -0.3];
  const bottom = [12, 17.25, -0.3];
  const wings = belt([top, ...R, bottom, ...Lw]);
  const poly = beltPoly([top, ...R, bottom, ...Lw]);
  const [t0, b0] = [nearest(poly, [12, 8]), nearest(poly, [12, 18])];
  // The antennae leave the wings' top edges either side of the body, so they never close a wedge
  const [a0, a1] = [nearest(poly, [10.75, 7.25]), nearest(poly, [13.25, 7.25])];
  add('butterfly', ['mariposa', 'transformación', 'primavera', 'butterfly', 'transformation', 'spring'], [wings, line(t0, b0), `M${pt(a0)}Q10.25 5 9.75 3`, `M${pt(a1)}Q13.75 5 14.25 3`, dot(9.75, 3, 0.3), dot(14.25, 3, 0.3)]);
  FILL.butterfly = { solid: [0, 4, 5], cut: [1], wire: [2, 3] };
}
{
  // Moth, from the top, its wings spread: pointed forewings and small round hindwings in one
  // outline, the stout body before them (a custom badge) and the feathered antennae, each a leaf
  // (the butterfly's are thin and clubbed). Folded into one triangle with comb antennae, it read as
  // a tent or a coat hanger
  const W = [[12, 7.25, 0], [21.25, 6.5, 0.6], [19.75, 12.25, 0.6], [17.4, 12.9, 0], [15.5, 16.5, 2.25], [12, 18.6, 0], [8.5, 16.5, 2.25], [6.6, 12.9, 0], [4.25, 12.25, 0.6], [2.75, 6.5, 0.6]];
  const head = [12, 5.75, 1.25];
  const body = [circ(head[0], head[1], head[2]), ell([12, 12.5], 1.5, 5.5)];
  const ant = `M${pt(on(head, -120))}Q9.75 2.75 7.25 2.5`;
  add('moth', ['polilla', 'noche', 'luz', 'moth', 'night', 'clothes moth'], [belt(W)], { badge: { d: [...body, ant, flipPath(ant)], knock: body.join(''), fill: { solid: body, wire: [ant, flipPath(ant)] } } });
  FILL.moth = { solid: [0] };
}
{
  // Ant, from the top, on the insects' axis: the round head with its two elbowed antennae, the slim
  // thorax and the big abdomen in a column, apart at their waists, and three bent legs a side from
  // the thorax. From the side, its three beads read as scissors or as glasses
  // The beads touch (head, thorax, abdomen), and the legs leave one root on each side of the thorax
  const head = [12, 5.75, 2];
  const th = [12, 10.25, 1.75, 2.5];
  const gaster = [12, 16.5, 3.1, 3.75];
  const root = [13.75, 10.25];
  const legsR = [leg(root, [16.75, 7.75], [18.25, 5]), leg(root, [17.75, 10.75], [20.25, 9.25]), leg(root, [17.25, 13.5], [18.25, 18])];
  const ant = roundline([on(head, -115), [9.75, 2], [7.25, 2.5]], [0, 0.6, 0]);
  add('ant', ['hormiga', 'trabajo en equipo', 'colonia', 'ant', 'teamwork', 'colony'], [circ(head[0], head[1], head[2]), ell([th[0], th[1]], th[2], th[3]), ell([gaster[0], gaster[1]], gaster[2], gaster[3]), ...legsR, ...legsR.map((d) => flipPath(d)), ant, flipPath(ant)]);
  FILL.ant = { solid: [0, 1, 2], wire: range(3, 11) };
}
{
  // Ladybug, from the top: a round dome split down the middle, two dots on each half, and its head a
  // cap peeking out before the dome (the dome in front: a custom badge); no legs (with them it would
  // be desarrollo's bug). A small ring for a head on top made a Christmas ornament on its hook
  const dome = circ(12, 13.75, 7.25);
  const split = vl(12, 6.5, 21);
  const spots = [dot(8.5, 11.25), dot(15.5, 11.25), dot(8.75, 16.5), dot(15.25, 16.5)];
  add('ladybug', ['catarina', 'mariquita', 'suerte', 'ladybug', 'luck', 'garden'], [ell([12, 6.5], 3.75, 2.75)], {
    badge: { d: [dome, split, ...spots], knock: dome, fill: { solid: [dome], cut: [split, ...spots] } },
  });
  FILL.ladybug = { solid: [0] };
}
{
  // Beetle, from the side: a high domed shell raised on three long jointed legs, each bent at a
  // knee, the line of its neck shield, the small head tucked under the front with its elbowed
  // antenna. On three straight legs, its head out in front, it read as a turtle
  const shell = 'M4.25 13.25A6.75 7 0 0 1 17.75 13.25Z';
  const head = [19.35, 12, 1.6];
  const legs = [leg([15.75, 13.25], [18.5, 16.5], [17.25, GROUND]), leg([11, 13.25], [12.75, 16.75], [11.5, GROUND]), leg([6.25, 13.25], [3.75, 16.5], [4.5, GROUND])];
  add('beetle', ['escarabajo', 'insecto', 'colección', 'beetle', 'insect', 'entomology'], [shell, circ(head[0], head[1], head[2]), 'M13 6.75C14.1 8.75 14.6 11 14.35 13.25', ...legs, roundline([on(head, -55), [20.75, 10], [21.75, 8]], [0, 0.6, 0])]);
  FILL.beetle = { solid: [0, 1], cut: [2], wire: [3, 4, 5, 6] };
}
{
  // Stag beetle, from the top: the split wing cases, the shield and head, and the long antlered
  // mandibles reaching ahead; no legs (with them it would be desarrollo's bug)
  const jaw = `M${pt(polar(12, 6, 1.75, 195))}C7.25 5.25 6 3.75 8.5 2.25`;
  add('stag-beetle', ['ciervo volante', 'escarabajo', 'fuerza', 'stag beetle', 'beetle', 'insect collection'], [ell([12, 16], 4.75, 5), ell([12, 9.5], 3.25, 1.75), circ(12, 6, 1.75), vl(12, 11.25, 21), jaw, flipPath(jaw)]);
  FILL['stag-beetle'] = { solid: [0, 1, 2], cut: [3], wire: [4, 5] };
}
{
  // Dragonfly, from the top: the wide head of its two eyes, a long thorax and the thin abdomen down
  // the axis, in front (a custom badge) of four long narrow wings held straight out from under the
  // thorax. Rooted on one point and fanned, they made the petals of a flower on its stem
  const head = belt([[10.75, 3.75, 1.6], [13.25, 3.75, 1.6]]);
  const th = belt([[12, 6.9, 1.55], [12, 10.25, 1.55]]);
  const abd = vl(12, 11.8, 21.25);
  const wings = [lens([12.75, 6.75], [21.5, 4.75], 1.35), lens([12.75, 10.75], [21, 14], 1.35)];
  add('dragonfly', ['libélula', 'agilidad', 'estanque', 'dragonfly', 'agility', 'pond'], [...wings, ...wings.map((d) => flipPath(d))], {
    badge: { d: [head, th, abd], knock: `${head}${th}`, fill: { solid: [head, th], wire: [abd] } },
  });
  FILL.dragonfly = { solid: [0, 1, 2, 3] };
}
/** The mosquito, from the side: the needle proboscis, the humped thorax, a thin abdomen, a narrow
 *  wing and two long legs from one root, spread wide and bent at the knees (straight down they
 *  stood it like a tent or a hang glider, three spread like tentacles, and a leg along the
 *  abdomen merged with it). */
function mosquito(s = 1, at = [12, 12]) {
  const X = (p) => xp(p, s, [12, 12], at);
  const P = (p, r) => [...X(p), r];
  // One outline for the thin abdomen, the humped thorax and the head (tangent beads closed narrow
  // wedges where the legs leave), the legs from its belly
  const body = [P([3.25, 13.75], 0), P([12.75, 9.75], 2.25 * s), P([16.5, 10.25], Math.max(1.5 * s, 1.35)), P([9.25, 11.5], 1.5 * s)];
  const poly = beltPoly(body);
  const G = X([0, GROUND])[1];
  const root = belly(poly, X([12.75, 0])[0]);
  return [
    belt(body),
    line(nearest(poly, X([17.75, 10.75])), X([21.5, 13.75])),
    lens(nearest(poly, X([11.75, 7.5])), X([4.5, 6.25]), 1.4),
    leg(root, X([16, 15.5]), [X([18.5, 0])[0], G]),
    leg(root, X([10.25, 15.75]), [X([9.25, 0])[0], G]),
  ];
}
{
  add('mosquito', ['mosquito', 'zancudo', 'picadura', 'mosquito', 'bite', 'repellent'], mosquito());
  FILL.mosquito = { solid: [0, 2], wire: [1, 3, 4] };
  add('mosquito-alert', ['alerta de mosquitos', 'dengue', 'brote', 'mosquito alert', 'outbreak', 'dengue alert'], mosquito(0.8, [10.5, 10.25]), { badge: badge('alert') });
  FILL['mosquito-alert'] = FILL.mosquito;
}
{
  // Housefly, from the top: the head all eyes (two big ones joined), the stout thorax and the
  // abdomen (tangent beads), and two long clear wings swept back past the abdomen in a V behind them
  // (the body sits in front, a custom badge). Small wings at its sides made a snowman with ears
  const head = belt([[10.4, 5, 1.9], [13.6, 5, 1.9]]);
  const th = [12, 5 + 1.9 + 2.6, 2.6];
  const ab = [12, th[1] + 2.6 + 3.75];
  const body = [head, circ(th[0], th[1], th[2]), ell(ab, 2.75, 3.75)];
  const wing = lens(on(th, -20), [20.75, 19.25], 2.1);
  add('housefly', ['mosca', 'higiene', 'plaga', 'housefly', 'fly', 'hygiene'], [wing, flipPath(wing)], { badge: { d: body, knock: body.join(''), fill: { solid: body } } });
  FILL.housefly = { solid: [0, 1] };
}
{
  // Caterpillar, from the side: a row of round segments arching along, its round head with an eye
  // and two antennae, a short leg under each segment
  const rs = [1.6, 1.8, 1.8, 1.75];
  const angs = [-10, 0, 10];
  const cs = [[4, 16.5, rs[0]]];
  for (let i = 1; i < rs.length; i++) {
    const p = cs[i - 1];
    cs.push([...add2(p, mul([Math.cos(rad(angs[i - 1])), Math.sin(rad(angs[i - 1]))], p[2] + rs[i])), rs[i]]);
  }
  const last = cs[cs.length - 1];
  // A head of 2.85: smaller, its eye ran into its outline at 2.1
  const head = [...add2(last, mul(unit([0.75, -1]), last[2] + 2.85)), 2.85];
  const legs = cs.map((c) => vl(c[0], c[1] + c[2], GROUND));
  add('caterpillar', ['oruga', 'crecimiento', 'progreso lento', 'caterpillar', 'growth', 'early stage'], [...cs.map((c) => circ(c[0], c[1], c[2])), circ(head[0], head[1], head[2]), dot(head[0], head[1], 0.35), line(on(head, -115), [head[0] - 1.75, head[1] - 5]), line(on(head, -65), [head[0] + 1.75, head[1] - 5]), ...legs]);
  FILL.caterpillar = { solid: range(0, 5), cut: [5], wire: range(6, 12) };
}
{
  // Chrysalis: a pod, plump above and pointed below, hanging from a twig by a short thread, the
  // case of its folded wing curving down its side and two rings at its tail. Banded across like the
  // wasp nest, the two were one lantern
  const pod = [[12, 6.75, 1.25], [12, 12.75, 4], [12, 20.75, 0], [12, 12.75, 4]];
  const poly = beltPoly(pod);
  const wingCase = `M${pt(nearest(poly, [8, 10.25]))}C10.5 12.5 12.75 14.25 ${pt(nearest(poly, [15.5, 16.25]))}`;
  add('chrysalis', ['crisálida', 'capullo', 'próximamente', 'chrysalis', 'cocoon', 'coming soon'], [hl(3, 6.5, 17.5), vl(12, 3, 5.5), belt(pod), wingCase, chord(pod, 18)]);
  FILL.chrysalis = { solid: [2], wire: [0, 1], cut: [3, 4] };
}
{
  // Firefly: a small beetle in flight, its wing raised, its tail a lantern lit by three short rays
  // (lugares' sun's: they start 3 from the lantern)
  const body = [[16.75, 9.25, 2.25], [12.5, 12.25, 2.25]];
  const head = [...add2([16.75, 9.25], mul(unit([1, -0.7]), 2.25 + 1.4)), 1.4];
  const lamp = [...add2([12.5, 12.25], mul(unit([-1, 0.7]), 2.25 + 1.6)), 1.6];
  const rays = [115, 160, 205].map((a) => line(polar(lamp[0], lamp[1], 4.6, a), polar(lamp[0], lamp[1], 6.75, a)));
  add('firefly', ['luciérnaga', 'brillo', 'noche', 'firefly', 'glow', 'night'], [belt(body), circ(head[0], head[1], head[2]), circ(lamp[0], lamp[1], lamp[2]), ...rays, lens(on(body[0], -125), [11.5, 3.25], 1.4), line(on(head, -40), [21.75, 3.5])]);
  FILL.firefly = { solid: [0, 1, 2, 6], lines: [3, 4, 5], wire: [7] };
}
{
  // Praying mantis, from the side: the big triangular head on its long upright neck, the folded
  // forelegs raised before it, the long leaf of its abdomen trailing back and two walking legs (an
  // antenna off the head's back corner made it a bird's long beak)
  const head = roundpoly([[13.25, 3.5], [19.75, 3.75], [16.25, 8.25]], [0.75, 0.75, 0.75]);
  const waist = [11, 14.5];
  const abd = lens(waist, [2.5, 17.5], 2.1);
  add('mantis', ['mantis', 'paciencia', 'quietud', 'praying mantis', 'patience', 'focus'], [head, line([15.6, 7.4], waist), abd, roundline([[13.75, 10.25], [19, 9.5], [17.75, 14.25]], [0, 0.6, 0]), leg(waist, [14.25, 17.25], [15.75, GROUND]), leg(waist, [8.75, 17.75], [9.25, GROUND])]);
  FILL.mantis = { solid: [0, 2], wire: [1, 3, 4, 5] };
}
{
  // Bed bug, from the top: a broad flat body, rounder than it is long, its rings curving across its
  // middle, a small head with two antennae and six short legs, each leaving the body square to its
  // edge and bending back. A long oval with straight bands and its legs straight out was desarrollo's
  // bug
  const c = [12, 14.25];
  const [rx, ry] = [6.75, 5.75];
  const E = (a) => [c[0] + rx * Math.cos(rad(a)), c[1] + ry * Math.sin(rad(a))];
  const N = (a) => unit([Math.cos(rad(a)) / rx, Math.sin(rad(a)) / ry]);
  const head = [12, 7.25, 1.25];
  // The rings stop well inside the edge, so they never crowd a leg's root
  const X = (y) => rx * Math.sqrt(1 - ((y - c[1]) / ry) ** 2) - 3.75;
  const rings = [12.75, 16.25].map((y) => `M${pt([c[0] - X(y), y])}Q${pt([c[0], y + 1.5])} ${pt([c[0] + X(y), y])}`);
  const legsR = [-45, 0, 45].map((a) => {
    const [p, n] = [E(a), N(a)];
    const knee = add2(p, mul(n, 2));
    return leg(p, knee, add2(knee, mul(rot(n, [0, 0], 65), 1.75)));
  });
  const ant = line(on(head, -120), [9.25, 3.75]);
  add('bedbug', ['chinche', 'hotel', 'plaga', 'bed bug', 'bedbug', 'infestation'], [ell(c, rx, ry), circ(head[0], head[1], head[2]), ...rings, ant, flipPath(ant), ...legsR, ...legsR.map((d) => flipPath(d))]);
  FILL.bedbug = { solid: [0, 1], cut: [2, 3], wire: range(4, 12) };
}
{
  // Tick, from the top: one big oval body, the small pointed head before it with its mouthparts,
  // and eight short bent legs on its front half, the first pair reaching forward (named deer-tick:
  // a tick alone is a check mark). Straight legs bunched round its top read as a pinecone's scales
  const c = [12, 14.25];
  const [rx, ry] = [5, 6.25];
  const E = (a) => [c[0] + rx * Math.cos(rad(a)), c[1] + ry * Math.sin(rad(a))];
  const head = belt([[12, 3.75, 0], [12, 6.25, 1.75]]);
  const legsR = [[-64, [16.5, 6], [16.75, 3.5]], [-30, [19, 9.75], [20.75, 8]], [2, [19.75, 14.25], [21.25, 16.25]], [36, [18.5, 19], [18.25, 21.25]]].map(([a, k, ft]) => leg(E(a), k, ft));
  add('deer-tick', ['garrapata', 'lyme', 'antipulgas', 'tick', 'deer tick', 'lyme disease'], [ell(c, rx, ry), head, ...legsR, ...legsR.map((d) => flipPath(d))]);
  FILL['deer-tick'] = { solid: [0, 1], wire: range(2, 10) };
}
/** The spider, from the top: a round abdomen, the head before it and four bent legs a side. */
function spiderTop() {
  const ceph = [12, 8.5, 2.5];
  // The back two legs leave the abdomen: rooted by the waist, they closed a wedge there at bold
  const abd = [12, 15, 4];
  const legsR = [
    leg(on(ceph, -60), [16.25, 3.75], [17.5, 2.25]),
    leg(on(ceph, -20), [18.5, 6.25], [21, 5.75]),
    leg(on(abd, -30), [19.25, 11.25], [21.25, 12.5]),
    leg(on(abd, 10), [19.5, 16.5], [20.5, 20.25]),
  ];
  return [circ(12, 15, 4), circ(ceph[0], ceph[1], ceph[2]), ...legsR, ...legsR.map((d) => flipPath(d))];
}
{
  add('spider', ['araña', 'arácnido', 'halloween', 'spider', 'crawler', 'arachnid'], spiderTop());
  FILL.spider = { solid: [0, 1], wire: range(2, 10) };
}
{
  // Spider web: six spokes from the center, joined by two rings of straight segments (eight spokes
  // took 30% of the canvas in ink, and an inner ring closer than 4.5 closes its cells at bold)
  const spokes = [0, 1, 2].map((i) => line(polar(12, 12, 8, i * 60), polar(12, 12, 8, 180 + i * 60)));
  const ring = (r) => `${line(...Array.from({ length: 6 }, (_, i) => polar(12, 12, r, i * 60)))}Z`;
  add('spider-web', ['telaraña', 'trampa', 'abandonado', 'spider web', 'cobweb', 'halloween'], [...spokes, ring(4.5), ring(8)]);
  FILL['spider-web'] = false;
}
{
  // Spider hanging, from the front: its body on a single thread from the top edge, four legs a side
  // arching out and down
  const body = [12, 13.75, 3.25];
  const legsR = [-45, -15, 15, 45].map((a) => leg(on(body, a < 0 ? -30 : 30), polar(body[0], body[1], 5.25, a - 16), polar(body[0], body[1], 8.5, a + 12)));
  add('spider-hanging', ['araña colgando', 'colgar', 'halloween', 'hanging spider', 'dangling', 'drop down'], [vl(12, 2, 10.5), circ(body[0], body[1], body[2]), ...legsR, ...legsR.map((d) => flipPath(d))]);
  FILL['spider-hanging'] = { solid: [1], wire: [0, ...range(2, 10)] };
}

{
  // Centipede: a wavy body (a band along a curve), short legs in pairs swept back along it and two
  // antennae at its head
  const C = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    return [3.75 + t * 15, 12 + 2.25 * Math.sin(t * Math.PI * 1.5 + 0.5)];
  });
  const b = band(C, 1.5, true);
  const at = [12, 22, 32];
  const legs = at.flatMap((i) => [line(b.left[i], add2(b.left[i], add2(mul(b.normal(i), 2), mul(b.tangent(i), -0.75)))), line(b.right[i], add2(b.right[i], add2(mul(b.normal(i), -2), mul(b.tangent(i), -0.75))))]);
  const end = C[40];
  const ant = [line(add2(end, mul(b.normal(40), 1.2)), add2(end, [0.5, -3.75])), line(add2(end, mul(b.normal(40), -1.2)), add2(end, [3.25, -0.25]))];
  add('centipede', ['ciempiés', 'milpiés', 'plaga', 'centipede', 'millipede', 'many legs'], [b.d, ...legs, ...ant]);
  FILL.centipede = { solid: [0], wire: range(1, 9) };
}
{
  // Snail, from the side: the spiral shell on its soft body (in front of it, a custom badge), the
  // two eye stalks
  const body = [[3.75, 19.5, 1.25], [17.5, 14.75, 2], [20.25, 19.75, 1.1]];
  const head = [17.5, 14.75, 2];
  const S = [9, 12.5];
  // The spiral leaves the shell steeply for its middle (a tangent start closed a sliver of paper at
  // bold) and curls once there, its turns 3 apart
  const spiral = smooth([polar(...S, 5.75, 300), ...Array.from({ length: 15 }, (_, i) => {
    const t = i / 14;
    return polar(...S, 2.8 - t * 2.4, 345 + t * 300);
  })]);
  const shell = circ(...S, 5.75);
  add('snail', ['caracol', 'lento', 'jardín', 'snail', 'slow', 'garden'], [belt(body), line(on(head, -65), [17.5, 8]), line(on(head, -65), [21.25, 9.5])], {
    badge: { d: [shell, spiral], knock: shell, fill: { solid: [shell], cut: [spiral] } },
  });
  FILL.snail = { solid: [0], wire: [1, 2] };
}
{
  // Butterfly net: a hoop, a deep bag of net hanging below it, crossed by its mesh, and the long
  // handle (the hoop and the handle in front: a custom badge)
  const C = [14.5, 6];
  const hoop = turnPath(ell(C, 5.5, 2.25), -15, C);
  const N = [[9.2, 7.45, 0], [19.8, 4.55, 0], [17.25, 17.25, 2.5]];
  const poly = beltPoly(N);
  const handle = line([9.5, 7.75], [3, 21]);
  const mesh = [line(nearest(poly, [11, 9]), nearest(poly, [18.75, 17])), line(nearest(poly, [19.25, 7.5]), nearest(poly, [15, 17.5]))];
  add('butterfly-net', ['red de mariposas', 'atrapar insectos', 'colección', 'butterfly net', 'bug net', 'nature play'], [belt(N), ...mesh], {
    badge: { d: [hoop, handle], knock: `${hoop}${handle}Z`, fill: { solid: [hoop], wire: [handle] } },
  });
  FILL['butterfly-net'] = { solid: [0], cut: [1, 2] };
}
{
  // Insect hotel: lugares' house, its square bottom-right corner, filled with a grid of tube
  // openings
  const roof = roundline([[2.75, 10.25], [12, 3.25], [21.25, 10.25]], [0, 1.25, 0]);
  const yAt = (x) => 3.25 + (Math.abs(x - 12) * 7) / 9.25;
  const box = roundline([[5.25, yAt(5.25)], [5.25, 20.75], [18.75, 20.75], [18.75, yAt(18.75)]], [0, 2.5, 0, 0]);
  const tubes = [12.75, 16.75].flatMap((y) => [8.25, 12, 15.75].map((x) => dot(x, y)));
  add('insect-hotel', ['hotel de insectos', 'biodiversidad', 'jardín', 'insect hotel', 'bug hotel', 'pollinators'], [roof, box, dot(12, 8.25), ...tubes]);
  FILL['insect-hotel'] = { solid: [shut(box)], wire: [0], cut: [2, ...range(3, 9)] };
}
// ── Reptiles ──────────────────────────────────────────────────────────────────────────────────
/** The snake: a band in an S of two bends (offset pulleys, as the swan's neck), a pointed tail at
 *  the bottom, the head raised at the top with its forked tongue. */
function snake(s = 1, at = [12, 12]) {
  const X = (p) => xp(p, s, [12, 12], at);
  // Smaller, the band keeps a width that holds its paper at bold, and the tongue its length
  const [R, w] = [3.5 * s, Math.max(1.5 * s, 1.4)];
  const [C1, C2] = [X([12, 16.25]), X([12, 8.75])];
  const head = [...X([15.75, 4.5]), Math.max(2 * s, 1.75)];
  const body = belt([[...X([3.75, 20.25]), 0], [...C1, -(R - w)], [...C2, R + w], head, [...C2, -(R - w)], [...C1, R + w]]);
  const root = on(head, 0);
  const fork = add2(root, [2.25, 0]);
  return [body, line(root, fork), line(add2(fork, [1.25, -1.25]), fork, add2(fork, [1.25, 1.25]))];
}
{
  add('snake', ['serpiente', 'víbora', 'reptil', 'snake', 'serpent', 'reptile'], snake());
  FILL.snake = { solid: [0], wire: [1, 2] };
  // With the badge the snake turns to face left, so the badge takes the straight run of its tail
  add('snake-alert', ['víbora reportada', 'peligro en el sendero', 'serpiente venenosa', 'snake alert', 'venomous snake', 'trail hazard'], snake().map((d) => flipPath(d)), { badge: badge('alert') });
  FILL['snake-alert'] = FILL.snake;
}
{
  // Cobra: upright, its hood spread wide with two eyes, the neck going down into its body, which
  // turns on the ground and runs out to the tail (one outline). A coil in front of it read as a
  // paper clip under a ghost; a round hood under a small head, as a genie's smoke
  const [C1, R, w] = [[15, 16.75], 3, 1.4];
  const H = [[21.25, 20, 0], [...C1, R + w], [9.6, 14.75, -1], [7.25, 9.5, 2.75], [12, 4, 1.9], [16.75, 9.5, 2.75], [14.4, 14.75, -1], [...C1, -(R - w)]];
  const poly = beltPoly(H);
  add('cobra', ['cobra', 'veneno', 'peligro', 'cobra', 'venom', 'danger'], [belt(H), eye(poly, [10.4, 7.5], [], false), eye(poly, [13.6, 7.5], [], false)]);
  FILL.cobra = { solid: [0], cut: [1, 2] };
}
/** A rock's top: a gentle rise across the bottom of the canvas (the lizard basks on it). */
const ROCK = 'M2.25 21.25Q12 17.25 21.75 21.25';
const rockY = (x) => {
  const t = (x - 2.25) / 19.5;
  return (1 - t) ** 2 * 21.25 + 2 * (1 - t) * t * 17.25 + t * t * 21.25;
};
{
  // Lizard, from the side, on a rock: a long low body, four short legs and a tapering tail
  const body = belt([[2.25, 17, 0], [11.5, 14, 1.75], [14.75, 11.25, -0.9], [17.25, 12.5, 1.75], [21, 13.75, 0.5], [17.75, 14.75, -0.5], [14, 16.25, 1.25], [9.5, 16.1, 1.25]]);
  const poly = beltPoly([[2.25, 17, 0], [11.5, 14, 1.75], [14.75, 11.25, -0.9], [17.25, 12.5, 1.75], [21, 13.75, 0.5], [17.75, 14.75, -0.5], [14, 16.25, 1.25], [9.5, 16.1, 1.25]]);
  const legs = [[15, 17], [13.5, 11.5], [9.75, 11.25], [8.25, 6]].map(([x, fx], i) => leg(belly(poly, x), [(x + fx) / 2 + (i % 2 ? -0.75 : 0.75), 17.9], [fx, rockY(fx)]));
  add('lizard', ['lagartija', 'reptil', 'desierto', 'lizard', 'reptile', 'basking'], [body, ...legs, ROCK]);
  FILL.lizard = { solid: [0], wire: [1, 2, 3, 4, 5] };
}
{
  // Gecko, from the top: sprawled bent legs, each ending in a round toe pad, and the curving tail
  const body = [[12, 5.25, 2], [12, 11.5, 2.5]];
  const B = [12, 11.5, 2.5];
  const H = [12, 5.25, 2];
  const legsR = [leg(on(B, -50), [17.25, 7.75], [18.25, 5.5]), leg(on(B, 40), [17, 15.25], [18.5, 17.5])];
  add('gecko', ['geco', 'trepar', 'agarre', 'gecko', 'climbing', 'grip'], [belt(body), 'M12 14C12 17 11.25 19.25 9.25 21', ...legsR, ...legsR.map((d) => flipPath(d)), dot(18.25, 5.5), dot(18.5, 17.5), dot(5.75, 5.5), dot(5.5, 17.5)]);
  void H;
  FILL.gecko = { solid: [0, 6, 7, 8, 9], wire: [1, 2, 3, 4, 5] };
}
{
  // Chameleon, on a twig: the high casque of its head, its eye, the arched back, two legs gripping
  // a short twig and the tail rolled into a spiral behind it. A low head and a hooked tail read as a
  // hamster; a flat belly on a long twig, as a shoe on the floor
  const B = [[6.75, 12.5, 0], [11.5, 10.75, 4], [16.5, 4.5, 0.4], [21.25, 10.75, 0.45], [18.25, 11.75, -0.5], [14, 13.25, 1.75]];
  const poly = beltPoly(B);
  const S = [5.25, 16.25];
  const r0 = len(sub([6.75, 12.5], S));
  const a0 = angOf(S, [6.75, 12.5]);
  const tail = smooth(Array.from({ length: 19 }, (_, i) => polar(...S, r0 - (2.85 * i) / 18, a0 - (360 * i) / 18)));
  const Y = 18;
  const legs = [[10.25, -0.5], [15.5, 0.75]].map(([x, k]) => leg(belly(poly, x), [x + k, Y - 1.25], [x + k * 0.5, Y]));
  add('chameleon', ['camaleón', 'camuflaje', 'adaptación', 'chameleon', 'camouflage', 'adapt'], [belt(B), eye(poly, [17.25, 9]), tail, ...legs, hl(Y, 9.75, 18.75)]);
  FILL.chameleon = { solid: [0], cut: [1], wire: [2, 3, 4, 5] };
}
{
  // Turtle, from the side: a high domed shell with its plate lines, the head out in front and two
  // stubby legs splayed under it as it walks. Tall straight legs under the dome made a pavilion
  const [S, a, b] = [[11, 16.75], 7.25, 7.75];
  const shell = `M${pt([S[0] - a, S[1]])}A${f(a)} ${f(b)} 0 0 1 ${pt([S[0] + a, S[1]])}Z`;
  const E = (k, rx, ry) => [S[0] + rx * Math.cos(rad(k)), S[1] + ry * Math.sin(rad(k))];
  const plates = [`M${pt([S[0] - 3.75, S[1]])}A3.75 4.25 0 0 1 ${pt([S[0] + 3.75, S[1]])}`, ...[-135, -45].map((k) => line(E(k, 3.75, 4.25), E(k, a, b)))];
  const head = belt([[18, 16.75, 0.75], [19.75, 14.5, 1.75]]);
  add('turtle', ['tortuga', 'lento', 'paciencia', 'turtle', 'tortoise', 'slow'], [shell, ...plates, head, line([6.75, S[1]], [5.5, GROUND]), line([15.25, S[1]], [16.5, GROUND])]);
  FILL.turtle = { solid: [0, 4], cut: [1, 2, 3], wire: [5, 6] };
}
{
  // Crocodile, from the side: long flat jaws, a ridge of scutes along the back, a long tail and
  // short legs (a row of teeth closed the jaw's paper at bold)
  const scutes = [[5.5, 13.6, 0.25], [6.6, 13.85, 0], [7.9, 12.9, 0.25], [9, 13.25, 0], [10.4, 12.4, 0.25], [11.5, 12.8, 0]];
  const Cr = [[2.25, 15.75, 0], ...scutes, [15, 11.5, 0.9], [21.5, 13.25, 0.6], [21, 14.9, 0.5], [15.5, 15.75, 0], [10, 16, 1.25]];
  const poly = beltPoly(Cr);
  add('crocodile', ['cocodrilo', 'caimán', 'pantano', 'crocodile', 'alligator', 'swamp'], [belt(Cr), leg(belly(poly, 14), [15.5, 18.75], [14.75, GROUND]), leg(belly(poly, 7.75), [6.5, 18.5], [7.25, GROUND])]);
  FILL.crocodile = { solid: [0], wire: [1, 2] };
}
// ── Dinosaurs ─────────────────────────────────────────────────────────────────────────────────
// Profiles facing right, on the ground line at one scale: their backs and bellies around y 10–17
// and their legs down to the ground (the T. rex's thick, the others' pillars as strokes).
{
  // T. rex: a big head with its jaw, tiny arms, the thick thigh and its two legs, a long balancing
  // tail
  const chest = [15, 12.5, 1.75];
  const thigh = [11, 14.75, 2.5];
  const Tr = [[2.25, 12.5, 0.3], [10, 11.25, 3.25], [13.5, 7.25, -1], [15.25, 3.75, 1.25], [20.25, 4, 1.25], [21, 6.25, 0.75], [17.75, 7.75, 0], [20.25, 8.75, 0.75], [16.75, 10.75, -0.6], chest, thigh, [7, 14.5, -0.6]];
  const poly = beltPoly(Tr);
  add('dinosaur', ['dinosaurio', 'sin conexión', 'prehistoria', 'dinosaur', 't-rex', 'offline'], [belt(Tr), eye(poly, [16.5, 5.25]), leg(on(chest, 15), [17.75, 13.25], [18.25, 14.75]), leg(on(thigh, 70), [12.75, 18.75], [13.5, GROUND]), leg(on(thigh, 120), [9.25, 18.75], [8.5, GROUND]), ground(2.75, 21.25)]);
  FILL.dinosaur = { solid: [0], cut: [1], wire: [2, 3, 4, 5] };
}
{
  // Brachiosaurus: four pillar legs under a heavy body, the long neck rising to a small head (too
  // small for an eye), a tail
  const Br = [[2.25, 15.5, 0], [9, 13.25, 3.5], [13.5, 9.75, -1.25], [17.75, 3.75, 1.5], [20.75, 4.5, 0.5], [18.75, 6.1, -0.4], [16.75, 10.5, -1.5], [14.25, 14.5, 2.25], [9.5, 16, 2]];
  const poly = beltPoly(Br);
  add('brachiosaurus', ['braquiosaurio', 'cuello largo', 'gigante', 'brachiosaurus', 'long neck', 'gentle giant'], [belt(Br), ...[6, 9, 12.75, 15.75].map((x) => line(belly(poly, x), [x, GROUND])), ground(2.75, 21.25)]);
  FILL.brachiosaurus = { solid: [0], wire: [1, 2, 3, 4, 5] };
}
{
  // Triceratops: a low heavy body on four pillar legs and, before it (a custom badge, so the
  // engine clears the body behind), the big head: the round frill raised like a shield, the long
  // brow horn pointing forward over the beak (too small a face for an eye; a nose horn's notch
  // closed at bold).
  // A frill drawn as a line inside one hump read as a blob, a snail or an acorn
  const Bd = [[2.25, 15.5, 0], [8.25, 14, 2.75], [12.75, 15.25, 1.5], [8.25, 16.75, 1]];
  const bp = beltPoly(Bd);
  const H = [[13.25, 8, 3.25], [17.4, 7.5, -0.45], [21.75, 5, 0], [18.9, 9.75, -0.5], [21.5, 12.25, 0.5], [16.5, 13.25, 1.4], [12.25, 12.25, 1.4]];
  const hp = beltPoly(H);
  const head = belt(H);
  const edge = `M${pt(nearest(hp, [15.25, 5.25]))}C16.75 8.25 16.5 11 ${pt(nearest(hp, [15.5, 13.5]))}`;
  add('triceratops', ['triceratops', 'cuernos', 'defensa', 'triceratops', 'horned dinosaur', 'defense'], [belt(Bd), ...[5.5, 8.25, 11.25].map((x) => line(belly(bp, x), [x, GROUND])), ground(2.75, 21.25)], {
    badge: { d: [head, edge], knock: head, fill: { solid: [head], cut: [edge] } },
  });
  FILL.triceratops = { solid: [0], wire: [1, 2, 3, 4] };
}
{
  // Stegosaurus: an arched back with its row of rounded plates, a small low head and the two spikes
  // at the end of its tail (all of them its outline)
  const plates = [[8, 10.5, 0], [9.25, 12.5, -0.3], [11.25, 7.75, 0], [13.25, 11.25, -0.3], [15.25, 8.75, 0], [16.75, 11.75, -0.3]];
  const St = [[2.75, 14.75, 0], [2.75, 11.25, 0], [4.1, 13.4, -0.3], [5.25, 10.75, 0], [6.5, 13.25, -0.3], ...plates, [18.25, 13.25, -0.5], [20, 14.75, 1.4], [21.25, 15.75, 0.5], [18, 16.75, 1], [11, 16.5, 1.5]];
  const poly = beltPoly(St);
  add('stegosaurus', ['estegosaurio', 'placas', 'dinosaurio', 'stegosaurus', 'plated dinosaur', 'kids'], [belt(St), ...[8, 11, 14.5, 17.5].map((x) => line(belly(poly, x), [x, GROUND])), ground(2.75, 21.25)]);
  FILL.stegosaurus = { solid: [0], wire: [1, 2, 3, 4, 5] };
}
{
  // T. rex skull, from the side: the cranium and snout, the eye socket, the row of teeth and the
  // lower jaw
  const teeth = [[19.5, 12.25, 0], [18.5, 13.25, 0], [17.5, 12.25, 0], [16.5, 13.25, 0], [15.5, 12.25, 0], [14.5, 13.25, 0], [13.5, 12.25, 0], [12.5, 13.25, 0], [11.5, 12.25, 0]];
  const skull = belt([[6.5, 9.5, 3.5], [11.5, 6, 0.75], [19.75, 8.75, 1.5], [21, 11.25, 0.5], ...teeth, [7.75, 13, 0.4]]);
  const jaw = belt([[7.75, 17.5, 1.25], [20, 16.75, 0.45], [15.5, 19.75, 1.25]]);
  add('dinosaur-skull', ['cráneo de dinosaurio', 'fósil', 'museo', 'dinosaur skull', 'fossil', 'natural history'], [skull, jaw, circ(7.5, 9.5, 1.5)]);
  FILL['dinosaur-skull'] = { solid: [0, 1], cut: [2] };
}
{
  // Dinosaur track: one large three-toed print, its long toes spread wide from deep notches and
  // tapering to points, on a small round heel. With a broad heel under short toes it read as a
  // crown; tilted, as a hand; on a narrow V heel, as an arrow
  const T = [[12, 2.75, 0.75], [14.75, 11.25, -1.1], [20.5, 7, 0.75], [12, 17, 3.75], [3.5, 7, 0.75], [9.25, 11.25, -1.1]];
  add('dinosaur-footprint', ['huella de dinosaurio', 'fósil', 'paso gigante', 'dinosaur footprint', 'fossil track', 'giant step'], [belt(T)]);
  FILL['dinosaur-footprint'] = { solid: [0] };
}
// ── Amphibians ────────────────────────────────────────────────────────────────────────────────
{
  // Frog, sitting, from the front: two eye bumps on top, the wide mouth, its legs folded at its sides
  const Fr = [[8, 6.5, 2.75], [12, 3.75, -1.5], [16, 6.5, 2.75], [17, 11.75, 3.5], [15.25, 16, 3], [8.75, 16, 3], [7, 11.75, 3.5]];
  const poly = beltPoly(Fr);
  const legR = roundline([[18.1, 16.4], [20.5, 18.5], [17.75, GROUND], [15, GROUND]], [0, 0.75, 0.5, 0]);
  add('frog', ['rana', 'sapo', 'estanque', 'frog', 'toad', 'pond'], [belt(Fr), eye(poly, [8, 6.5]), eye(poly, [16, 6.5]), 'M8.25 12.25C10.5 14 13.5 14 15.75 12.25', legR, flipPath(legR)]);
  FILL.frog = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
}
{
  // Axolotl, from the front: a smiling head and, on each side only, three gill fronds curling out
  // and up from its sides. Straight rays all round its top made a sun with a face; leaves, a flower
  const c = [12, 13.75];
  const [rx, ry] = [6.75, 5.25];
  const E = (a) => [c[0] + rx * Math.cos(rad(a)), c[1] + ry * Math.sin(rad(a))];
  const fronds = [[-178, 182, 3.25], [-153, -158, 3.75], [-128, -132, 3.75]].map(([a, dir, l]) => {
    const p = E(a);
    return `M${pt(p)}Q${pt(add2(p, polar(0, 0, l * 0.55, dir - 25)))} ${pt(add2(p, polar(0, 0, l, dir)))}`;
  });
  add('axolotl', ['ajolote', 'regeneración', 'mascota', 'axolotl', 'regeneration', 'mascot'], [ell(c, rx, ry), dot(8.75, 13), dot(15.25, 13), 'M10.75 16C11.5 16.75 12.5 16.75 13.25 16', ...fronds, ...fronds.map((d) => flipPath(d))]);
  FILL.axolotl = { solid: [0], cut: [1, 2, 3], wire: [4, 5, 6, 7, 8, 9] };
}

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d` (or a stroke of its own): `solid` is filled (closed shapes only; `close` shuts
// the open outlines along their chord), `cut` is knocked out at stroke width, `lines` stays a line
// with a clearance of paper, `wire` stays a line attached to it. `false`: open lines only.
for (const [name, spec] of Object.entries(FILL)) {
  if (icons[name].fill !== undefined) continue;
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  const solid = pick(spec.solid);
  icons[name].fill = { solid: spec.close ? solid.map(shut) : solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}


// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
const r = (a, b) => range(a, b + 1);
const BIRD = { body: [0], wing: [1], eye: [2], legs: [3, 4], perch: [5] };
const BUG6 = { body: [0], proboscis: [1], wing: [2], legs: [3, 4] };
const PARTS = {
  bird: BIRD,
  'bird-flying': { body: [0], eye: [1] },
  'bird-flock': { birds: [0, 1, 2] },
  birdsong: { ...BIRD, wave: [6, 7] },
  'bird-plus': { body: [0], wing: [1], eye: [2], legs: [3, 4] },
  'map-pin-bird': { pin: [0], bird: [1] },
  'bird-tracks': { back: [0, 1], front: [2, 3] },
  birdhouse: { roof: [0], box: [1], hole: [2], peg: [3], post: [4] },
  'bird-feeder': { hook: [0], roof: [1], tube: [2, 3], tray: [4], seed: [5, 6, 7], perch: [8] },
  birdbath: { basin: [0], water: [1], stand: [2] },
  nest: { eggs: [0, 1] },
  'egg-hatching': { head: [0], eye: [1] },
  feather: { vane: [0], shaft: [1], quill: [2] },
  chick: { body: [0], eye: [1], wing: [2], feet: [3, 4] },
  hen: { body: [0], eye: [1], wing: [2], feet: [3, 4] },
  turkey: { tail: r(0, 4) },
  duck: { body: [0], eye: [1], wing: [2], water: [3] },
  goose: { body: [0], eye: [1], feet: [2, 3] },
  swan: { body: [0], wing: [1], water: [2] },
  eagle: { head: [0], brow: [1], eye: [2] },
  owl: { body: [0], eyes: [1, 2], beak: [3] },
  parrot: { body: [0], eye: [1], wing: [2] },
  penguin: { body: [0], belly: [1], eyes: [2, 3], feet: [4, 5] },
  flamingo: { body: [0], head: [1], neck: [2], legs: [3, 4] },
  hummingbird: { body: [0], bill: [1], eye: [2] },
  pigeon: { body: [0], eye: [1], wing: [2], legs: [3, 4] },
  'carrier-pigeon': { body: [0] },
  crow: { body: [0], eye: [1], wing: [2], legs: [3, 4], perch: [5] },
  toucan: { body: [0], eye: [1], bill: [2], leg: [3], perch: [4] },
  ostrich: { body: [0], head: [1], neck: [2], legs: [3, 4] },
  pelican: { body: [0], eye: [1], bill: [2], legs: [3, 4] },
  woodpecker: { bird: [0], trunk: [1], eye: [2] },
  puffin: { body: [0], eye: [1], band: [2], foot: [3] },
  swallow: { body: [0], eye: [1] },
  'kiwi-bird': { body: [0], eye: [1], bill: [2], legs: [3, 4] },
  dodo: { body: [0], eye: [1], wing: [2], tail: [3], legs: [4, 5] },
  bee: { wings: [0, 1] },
  pollination: { flower: [0, 1], wings: [2, 3] },
  wasp: { abdomen: [0], thorax: [1], head: [2], stripes: [3, 4], wing: [5], antenna: [6], legs: [7, 8] },
  'wasp-nest': { twig: [0], nest: [1], bands: [2, 3] },
  butterfly: { wings: [0], body: [1], antennae: r(2, 5) },
  moth: { wings: [0] },
  ant: { head: [0], thorax: [1], abdomen: [2], legs: r(3, 8), antennae: [9, 10] },
  ladybug: { head: [0] },
  beetle: { shell: [0], head: [1], shield: [2], legs: [3, 4, 5], antenna: [6] },
  'stag-beetle': { body: [0], shield: [1], head: [2], split: [3], jaws: [4, 5] },
  dragonfly: { wings: r(0, 3) },
  mosquito: BUG6,
  'mosquito-alert': BUG6,
  housefly: { wings: [0, 1] },
  caterpillar: { body: r(0, 3), head: [4], eye: [5], antennae: [6, 7], legs: r(8, 11) },
  chrysalis: { twig: [0], thread: [1], pod: [2], wing: [3], band: [4] },
  firefly: { body: [0], head: [1], lantern: [2], glow: [3, 4, 5], wing: [6], antenna: [7] },
  mantis: { head: [0], neck: [1], abdomen: [2], forelegs: [3], legs: [4, 5] },
  bedbug: { body: [0], head: [1], rings: [2, 3], antennae: [4, 5], legs: r(6, 11) },
  'deer-tick': { body: [0], head: [1], legs: r(2, 9) },
  spider: { abdomen: [0], head: [1], legs: r(2, 9) },
  'spider-web': { spokes: r(0, 2), rings: [3, 4] },
  'spider-hanging': { thread: [0], body: [1], legs: r(2, 9) },
  centipede: { body: [0], legs: r(1, 6), antennae: [7, 8] },
  snail: { body: [0], stalks: [1, 2] },
  'butterfly-net': { net: [0], mesh: [1, 2] },
  'insect-hotel': { roof: [0], box: [1], vent: [2], tubes: r(3, 8) },
  snake: { body: [0], tongue: [1, 2] },
  'snake-alert': { body: [0], tongue: [1, 2] },
  cobra: { hood: [0], eyes: [1, 2] },
  lizard: { body: [0], legs: r(1, 4), rock: [5] },
  gecko: { body: [0], tail: [1], legs: r(2, 5), toes: r(6, 9) },
  chameleon: { body: [0], eye: [1], tail: [2], legs: [3, 4], twig: [5] },
  turtle: { shell: [0], plates: [1, 2, 3], head: [4], legs: [5, 6] },
  crocodile: { body: [0], legs: [1, 2] },
  dinosaur: { body: [0], eye: [1], arm: [2], legs: [3, 4], ground: [5] },
  brachiosaurus: { body: [0], legs: r(1, 4), ground: [5] },
  triceratops: { body: [0], legs: r(1, 3), ground: [4] },
  stegosaurus: { body: [0], legs: r(1, 4), ground: [5] },
  'dinosaur-skull': { skull: [0], jaw: [1], socket: [2] },
  'dinosaur-footprint': { print: [0] },
  frog: { body: [0], eyes: [1, 2], mouth: [3], legs: [4, 5] },
  axolotl: { head: [0], eyes: [1, 2], mouth: [3], gills: r(4, 9) },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
// What flies floats or slides along its flight, what walks slides along the ground, what hangs
// swings from its hook or thread, birds on a perch rock from their feet, wings and glows beat,
// alerts wiggle as the engine's do elsewhere.
const MOTION = {
  bird: { effect: 'wiggle', parts: ['body', 'wing', 'eye', 'legs'], origin: [12, GROUND] },
  'bird-flying': { effect: 'float', vector: [1.5, -1.5] },
  'bird-flock': { effect: 'slide', vector: [1.5, -1.5] },
  birdsong: { effect: 'beat', parts: ['wave'], origin: [15.12, 12.25] },
  'map-pin-bird': { effect: 'bounce', vector: [0, -2] },
  'bird-tracks': { effect: 'slide', vector: [1.5, -1.5] },
  'bird-feeder': { effect: 'ring', origin: [12, 1.75] },
  'egg-hatching': { effect: 'wiggle', origin: [12, 21.25] },
  feather: { effect: 'float', vector: [1, -1.5] },
  chick: { effect: 'bounce', vector: [0, -2] },
  hen: { effect: 'wiggle', origin: [11.5, GROUND] },
  duck: { effect: 'float', parts: ['body', 'eye', 'wing'], vector: [1.5, 0] },
  goose: { effect: 'wiggle', origin: [10, GROUND] },
  swan: { effect: 'float', parts: ['body', 'wing'], vector: [1.5, 0] },
  owl: { effect: 'wiggle', origin: [12, 20.5] },
  parrot: { effect: 'wiggle', origin: [12, 15.75] },
  penguin: { effect: 'wiggle', origin: [12, GROUND] },
  hummingbird: { effect: 'float', vector: [0, -1.5] },
  pigeon: { effect: 'slide', vector: [1.5, 0] },
  'carrier-pigeon': { effect: 'slide', vector: [2, -1] },
  ostrich: { effect: 'slide', vector: [1.5, 0] },
  woodpecker: { effect: 'wiggle', parts: ['bird', 'eye'], origin: [19.35, 20.75] },
  swallow: { effect: 'slide', vector: [2, -0.5] },
  dodo: { effect: 'wiggle', origin: [11, GROUND] },
  bee: { effect: 'float', vector: [1.5, -1] },
  pollination: { effect: 'float', parts: ['wings', 'badge'], vector: [1, -1] },
  wasp: { effect: 'float', vector: [1.5, -1] },
  'wasp-nest': { effect: 'ring', origin: [12, 4.5] },
  butterfly: { effect: 'beat', parts: ['wings'], origin: [12, 12] },
  moth: { effect: 'beat', parts: ['wings'], origin: [12, 12] },
  ant: { effect: 'slide', vector: [0, -1.5] },
  ladybug: { effect: 'bounce', vector: [0, -1.5] },
  beetle: { effect: 'slide', vector: [1.5, 0] },
  dragonfly: { effect: 'float', vector: [1.5, -1] },
  mosquito: { effect: 'float', vector: [1, -1] },
  'mosquito-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  housefly: { effect: 'float', vector: [1.5, -1.5] },
  caterpillar: { effect: 'slide', vector: [1.5, 0] },
  chrysalis: { effect: 'ring', origin: [12, 3] },
  firefly: { effect: 'beat', parts: ['lantern', 'glow'], origin: [9.35, 14.46] },
  'spider-hanging': { effect: 'ring', origin: [12, 2] },
  centipede: { effect: 'slide', vector: [1.5, 0] },
  snail: { effect: 'slide', vector: [1, 0] },
  'butterfly-net': { effect: 'wiggle', origin: [3, 21] },
  snake: { effect: 'wiggle', origin: [3.75, 20.25] },
  'snake-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  cobra: { effect: 'wiggle', origin: [12, 18.5] },
  lizard: { effect: 'slide', parts: ['body', 'legs'], vector: [1.5, 0] },
  gecko: { effect: 'wiggle', origin: [12, 12] },
  turtle: { effect: 'slide', vector: [1, 0] },
  dinosaur: { effect: 'wiggle', parts: ['body', 'eye', 'arm', 'legs'], origin: [11, GROUND] },
  frog: { effect: 'bounce', vector: [0, -2.5] },
  axolotl: { effect: 'wiggle', origin: [12, 18.5] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Mirror (DESIGN.md › Mirroring) ────────────────────────────────────────────────────────────
// The song reads like the speaker's waves (as mascotas' bark); the animals keep the side they face.
icons.birdsong.mirror = true;

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these are the ones that still turned to mush.
// Their own pieces run through pixel centers (0.75 + 1.5k); the base they keep is snapped here.
const px = (x, y) => circ(x, y, 0.1);
{
  // The bird in the pin was a blot: lugares' pixel pin with the flock's gull, two pixel arcs
  const pin = L['map-pin-minus'].small.d[0];
  const gull = 'M9.75 11.25A1.5 1.5 0 0 1 12.75 11.25A1.5 1.5 0 0 1 15.75 11.25';
  icons['map-pin-bird'].small = { d: [pin, gull], fill: { solid: [pin], cut: [gull] } };
}
{
  // The flock's arcs snapped flat into dashes: two gulls large enough to keep their m, wings on
  // pixel diagonals peaking at the wrists
  const gull = (kx, ky) => line(...[[0, 2], [2, 0], [4, 2], [6, 0], [8, 2]].map(([i, j]) => [0.75 + 1.5 * (kx + i), 0.75 + 1.5 * (ky + j)]));
  icons['bird-flock'].small = { d: [gull(6, 3), gull(1, 9)] };
}
{
  // The tilted prints snapped into crosses: upright, three long toes on the pixel grid (the side
  // ones on its diagonals) and a short hind toe
  const P = (k) => 0.75 + 1.5 * k;
  const print = (cx, cy) => [line([cx, cy + 1.5], [cx, cy - 4.5]), line([cx - 4.5, cy - 4.5], [cx, cy], [cx + 4.5, cy - 4.5])];
  icons['bird-tracks'].small = { d: [...print(P(4), P(13)), ...print(P(11), P(6))] };
}
{
  // The turkey's five scallops snapped into crumbs: its fan a plain half ring of pixels with two
  // rays on pixel diagonals, the pear of its body before it
  const C = [12, 14.25];
  const fan = `M3.75 14.25A8.25 8.25 0 0 1 20.25 14.25`;
  const rays = [225, 315].map((a) => line(polar(...C, 2.12, a), polar(...C, 8.49, a)));
  const T = [[12, 9.75, 1.5], [12, 15.75, 3]];
  const body = belt(T);
  icons.turkey.small = { d: [fan, ...rays], fill: { solid: [`${fan}Z`], cut: rays }, badge: { d: [body], knock: body, fill: { solid: [body] } } };
}
{
  // The web's flats snapped into stripes: its rim and three spokes, the middle spoke and the
  // corners on pixel centers, no inner ring
  const v = [[5.25, 12.75], [9.75, 6.75], [15.75, 6.75], [20.25, 12.75], [15.75, 18.75], [9.75, 18.75]];
  icons['spider-web'].small = { d: [0, 1, 2].map((i) => line(v[i], v[i + 3])).concat(`${line(...v)}Z`) };
}
{
  // The hotel's six openings ran into two bars: four, two pixels apart, and no vent
  const h = icons['insect-hotel'];
  const sn = snapper([h.d[0], h.d[1]]);
  const tubes = [12.75, 17.25].flatMap((y) => [9.75, 14.25].map((x) => px(x, y)));
  h.small = { d: [sn(h.d[0]), sn(h.d[1]), ...tubes], fill: { solid: [sn(h.fill.solid[0])], wire: [sn(h.d[0])], cut: tubes } };
}
{
  // The snail's spiral was a smudge: a shell of 8 pixels and a curl of a turn and a half
  const s = icons.snail;
  const shell = circ(9.75, 12.75, 6);
  const curl = 'M9.75 12.75A1.5 1.5 0 0 1 12.75 12.75A3 3 0 0 1 6.75 12.75';
  s.small = { d: [...s.d], fill: s.fill, badge: { d: [shell, curl], knock: shell, fill: { solid: [shell], cut: [curl] } } };
}

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
// The web is round already.
icons['spider-web'].variants = { circle: false };

export default { category: 'aves-insectos', label: 'Aves, insectos y reptiles', icons };
