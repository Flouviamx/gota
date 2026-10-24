// Formas y geometría (shapes and geometry): 2D primitives, 3D solids, dashed and dotted shapes,
// line styles and weights, angles, symmetry, patterns and grids, and measures. A shape here is the
// subject: drawn empty and at full size on its keyline. Everything is computed with
// engine/geometry.mjs; see DESIGN.md.
import { arc, circ, dot, f, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────
const xy = ([x, y]) => `${f(x)} ${f(y)}`;
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => {
  const n = len(v);
  return [v[0] / n, v[1] / n];
};
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
const rad = (deg) => (deg * Math.PI) / 180;

/** Vertices of a regular polygon of `n` sides and circumradius R, the first at `start` degrees. */
const regular = (n, R, start = -90, c = [12, 12]) => Array.from({ length: n }, (_, k) => polar(c[0], c[1], R, start + (k * 360) / n));

/**
 * The middle of a roundpoly() corner: where a line that ends on that corner touches the path (the
 * vertex itself lies outside the rounded outline).
 */
function cornerMid(pts, i, r) {
  const n = pts.length;
  const V = pts[i];
  const u = unit(sub(pts[(i - 1 + n) % n], V));
  const v = unit(sub(pts[(i + 1) % n], V));
  const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
  const bis = unit(add(u, v));
  return add(V, bis, r / Math.sin(th / 2) - r);
}

/** A full ellipse, as two half arcs. */
const ell = (cx, cy, rx, ry) => `M${xy([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 0 0 ${xy([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 0 0 ${xy([cx - rx, cy])}Z`;
/** Point of an ellipse at `deg` degrees of its parameter (0 = right, 90 = down). */
const ellAt = (cx, cy, rx, ry, deg) => [cx + rx * Math.cos(rad(deg)), cy + ry * Math.sin(rad(deg))];
/** Arc of an ellipse from a0 to a1 degrees of its parameter (clockwise on screen if a1 > a0). */
const ellArc = (cx, cy, rx, ry, a0, a1) =>
  `M${xy(ellAt(cx, cy, rx, ry, a0))}A${f(rx)} ${f(ry)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${xy(ellAt(cx, cy, rx, ry, a1))}`;
/** A circle traced clockwise: subtracted from a counterclockwise circ() it leaves a hole. */
const circCW = (cx, cy, r) => `M${xy([cx - r, cy])}A${f(r)} ${f(r)} 0 1 1 ${xy([cx + r, cy])}A${f(r)} ${f(r)} 0 1 1 ${xy([cx - r, cy])}Z`;

/** A closed curve through the points (Catmull-Rom as cubic Béziers), the same as sistema's. */
function smoothClosed(pts, k = 1 / 6) {
  const n = pts.length;
  const at = (i) => pts[(i + n) % n];
  let o = `M${xy(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    o += `C${xy([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${xy([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${xy(p2)}`;
  }
  return `${o}Z`;
}
/** The set's scalloped seal (sistema/verified): a circle of radius R with n waves of amplitude amp. */
function scallop(cx, cy, R, amp, n) {
  const m = n * 4;
  return smoothClosed(Array.from({ length: m }, (_, k) => polar(cx, cy, R + amp * Math.cos((2 * Math.PI * n * k) / m), -90 + (k * 360) / m)));
}

// ── Measuring and dashing a path ──
// A path as measurable pieces (lines, cubics and arcs, in absolute coordinates), so any outline in
// this file can be dashed from its own geometry: a dashed shape is the shape, broken.
function pieces(d) {
  const out = [];
  let p = [0, 0];
  let start = p;
  for (const [, c, args] of transform(d, 1, 0, 0).matchAll(/([MLHVCAZ])([^MLHVCAZ]*)/g)) {
    const a = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (c === 'M') {
      p = start = [a[0], a[1]];
      continue;
    }
    let seg;
    if (c === 'C') seg = cubicPiece(p, [a[0], a[1]], [a[2], a[3]], [a[4], a[5]]);
    else if (c === 'A') seg = arcPiece(p, a);
    else seg = linePiece(p, c === 'H' ? [a[0], p[1]] : c === 'V' ? [p[0], a[0]] : c === 'Z' ? start : [a[0], a[1]]);
    if (seg.len > 1e-6) out.push(seg);
    p = seg.end;
  }
  let s = 0;
  for (const q of out) {
    q.s = s;
    s += q.len;
  }
  out.total = s;
  return out;
}
function linePiece(a, b) {
  return { len: len(sub(b, a)), end: b, at: (t) => lerp(a, b, t), t: (s, L) => s / L, cmd: (t0, t1) => `L${xy(lerp(a, b, t1))}` };
}
function cubicPiece(P0, P1, P2, P3) {
  const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * P0[k] + 3 * t * (1 - t) ** 2 * P1[k] + 3 * t * t * (1 - t) * P2[k] + t ** 3 * P3[k]);
  const N = 200;
  const acc = [0];
  for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + len(sub(at(i / N), at((i - 1) / N))));
  const split = (P, t) => {
    const m = (a, b) => lerp(a, b, t);
    const [a, b, c] = [m(P[0], P[1]), m(P[1], P[2]), m(P[2], P[3])];
    const [d, e] = [m(a, b), m(b, c)];
    const g = m(d, e);
    return [
      [P[0], a, d, g],
      [g, e, c, P[3]],
    ];
  };
  return {
    len: acc[N],
    end: P3,
    at,
    t: (s) => {
      let i = 1;
      while (i < N && acc[i] < s) i++;
      return (i - 1 + (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / N;
    },
    cmd: (t0, t1) => {
      const left = split([P0, P1, P2, P3], t1)[0];
      const q = t1 > 0 ? split(left, t0 / t1)[1] : left;
      return `C${xy(q[1])} ${xy(q[2])} ${xy(q[3])}`;
    },
  };
}
function arcPiece(from, [rx0, ry0, , large, sweep, x2, y2]) {
  // SVG's endpoint parametrization to its center (F.6.5), for unrotated arcs
  const [x1, y1] = from;
  const [hx, hy] = [(x1 - x2) / 2, (y1 - y2) / 2];
  let [rx, ry] = [rx0, ry0];
  const lam = (hx * hx) / (rx * rx) + (hy * hy) / (ry * ry);
  if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
  const num = rx * rx * ry * ry - rx * rx * hy * hy - ry * ry * hx * hx;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * hy * hy + ry * ry * hx * hx)));
  const [cx, cy] = [co * ((rx * hy) / ry) + (x1 + x2) / 2, co * (-(ry * hx) / rx) + (y1 + y2) / 2];
  const t1 = Math.atan2((y1 - cy) / ry, (x1 - cx) / rx);
  let dt = Math.atan2((y2 - cy) / ry, (x2 - cx) / rx) - t1;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  const at = (t) => [cx + rx * Math.cos(t1 + t * dt), cy + ry * Math.sin(t1 + t * dt)];
  const N = 120;
  const acc = [0];
  for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + len(sub(at(i / N), at((i - 1) / N))));
  return {
    len: acc[N],
    end: [x2, y2],
    at,
    t: (s) => {
      let i = 1;
      while (i < N && acc[i] < s) i++;
      return (i - 1 + (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / N;
    },
    cmd: (ta, tb) => `A${f(rx0)} ${f(ry0)} 0 ${Math.abs((tb - ta) * dt) > Math.PI ? 1 : 0} ${sweep} ${xy(at(tb))}`,
  };
}
/** The point at arc length `s` along a path. */
function pointAt(d, s) {
  const ps = pieces(d);
  const q = ps.find((p) => s <= p.s + p.len + 1e-9) ?? ps.at(-1);
  return q.at(q.t(Math.max(0, s - q.s), q.len));
}
/** The stretch of a path between arc lengths s0 and s1 (wrapping around a closed one). */
function stretch(d, s0, s1, ps = pieces(d)) {
  const T = ps.total;
  if (s0 < 0) [s0, s1] = [s0 + T, s1 + T];
  if (s0 >= T) [s0, s1] = [s0 - T, s1 - T];
  const runs = s1 > T + 1e-9 ? [[s0, T], [0, s1 - T]] : [[s0, s1]];
  let out = '';
  for (const [a, b] of runs)
    for (const q of ps) {
      const lo = Math.max(a, q.s);
      const hi = Math.min(b, q.s + q.len);
      if (hi <= lo + 1e-6) continue;
      const [ta, tb] = [q.t(lo - q.s, q.len), q.t(hi - q.s, q.len)];
      if (!out) out = `M${xy(q.at(ta))}`;
      out += q.cmd(ta, tb);
    }
  return out;
}
/** The arc length along a path of the point nearest to `pt`. */
function lengthAt(d, pt) {
  let best = [Infinity, 0];
  for (const q of pieces(d)) {
    let s = q.s;
    let prev = q.at(0);
    for (let i = 0; i <= 600; i++) {
      const cur = q.at(i / 600);
      s += len(sub(cur, prev));
      prev = cur;
      const e = len(sub(cur, pt));
      if (e < best[0]) best = [e, s];
    }
  }
  return best[1];
}
/** The dashes of a closed path: everything but the gaps, each gap [center, width] in arc length. */
function dashes(d, gaps) {
  const ps = pieces(d);
  const T = ps.total;
  const g = gaps.map(([c, w]) => [(((c - w / 2) % T) + T) % T, w]).sort((a, b) => a[0] - b[0]);
  return g.map(([s, w], i) => {
    const next = g[(i + 1) % g.length];
    const from = s + w;
    const to = next[0] + (i === g.length - 1 ? T : 0);
    return stretch(d, from, to, ps);
  });
}
/** `n` dashes along an open path, `gap` apart, from end to end (dashes touch both ends). */
function run(d, n, gap) {
  const ps = pieces(d);
  const dash = (ps.total - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => stretch(d, i * (dash + gap), i * (dash + gap) + dash, ps));
}
/** The middle `L` of a path: the one dash that stands for a hidden back edge (capsule-3d's band). */
function middle(d, L) {
  const ps = pieces(d);
  return stretch(d, (ps.total - L) / 2, (ps.total + L) / 2, ps);
}

/** Uniform fit: scales and moves a set of points so the rounded outline's box fills `box` (centered). */
function fit(build, pts, box, { stretchXY = false } = {}) {
  let P = pts;
  for (let it = 0; it < 6; it++) {
    const [x0, y0, x1, y1] = bbox(build(P));
    const [w, h] = [x1 - x0, y1 - y0];
    const [tw, th] = [box[2] - box[0], box[3] - box[1]];
    const k = stretchXY ? [tw / w, th / h] : Array(2).fill(Math.min(tw / w, th / h));
    const c = [(x0 + x1) / 2, (y0 + y1) / 2];
    const tc = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    // The rounding doesn't scale, so the vertices scale a little more than the box asks
    P = P.map(([x, y]) => [tc[0] + (x - c[0]) * k[0], tc[1] + (y - c[1]) * k[1]]);
  }
  return P;
}
/** Box of a path (sampled). */
function bbox(d) {
  let [x0, y0, x1, y1] = [99, 99, -99, -99];
  for (const q of pieces(d))
    for (let i = 0; i <= 60; i++) {
      const [x, y] = q.at(i / 60);
      [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    }
  return [x0, y0, x1, y1];
}

/**
 * Circular sector of radius R around O from a0 to a1 degrees (clockwise), its two corners on the
 * arc rounded with radius `rho` and, when it isn't a half disc, its corner at O with radius `rc`.
 * The semicircle, the quarter circle and the protractor.
 */
function sector(O, R, a0, a1, rho, rc = 0) {
  const dl = (Math.asin(rho / (R - rho)) * 180) / Math.PI;
  const onRay = (a) => polar(O[0], O[1], (R - rho) * Math.cos(rad(dl)), a);
  const [L0, C0, C1, L1] = [onRay(a0), polar(O[0], O[1], R, a0 + dl), polar(O[0], O[1], R, a1 - dl), onRay(a1)];
  const big = a1 - a0 - 2 * dl > 180 ? 1 : 0;
  let d = `M${xy(L0)}A${f(rho)} ${f(rho)} 0 0 1 ${xy(C0)}A${f(R)} ${f(R)} 0 ${big} 1 ${xy(C1)}A${f(rho)} ${f(rho)} 0 0 1 ${xy(L1)}`;
  if (a1 - a0 < 179.9) {
    const t = rc / Math.tan(rad(a1 - a0) / 2);
    d += `L${xy(polar(O[0], O[1], t, a1))}A${f(rc)} ${f(rc)} 0 0 1 ${xy(polar(O[0], O[1], t, a0))}`;
  }
  return `${d}Z`;
}

// ── 2D primitives ─────────────────────────────────────────────────────────────────────────
// Polygons share one corner radius (2), sit on the circle keyline by area and are centered by
// their box; the pointed ones reach the 2.4–21.6 keyline.
const R_POLY = 2;
const poly = (pts, r = R_POLY) => roundpoly(pts, r);
const TRIANGLE_PTS = fit((P) => poly(P, 2.2), regular(3, 10), [2.4, 3.4, 21.6, 20.6]);
const TRIANGLE = poly(TRIANGLE_PTS, 2.2);
const centered = (n, R, start) => {
  const P = regular(n, R, start);
  const [x0, y0, x1, y1] = bbox(poly(P));
  return P.map(([x, y]) => [x + 12 - (x0 + x1) / 2, y + 12 - (y0 + y1) / 2]);
};
const PENTAGON = poly(centered(5, 10, -90));
const HEX_PTS = centered(6, 9.75, -90);
const HEXAGON = poly(HEX_PTS);
const HEPTAGON = poly(centered(7, 9.6, -90));
const OCTAGON = poly(centered(8, 9.47, -67.5));
// The rectangle is a shape, not a container: continuous corners on all four (no signature)
const RECT = sq(2.5, 5, 19, 14, 3.75);
// Right triangle: the legs on the left and bottom keylines, the hypotenuse from top left to bottom
// right and the right-angle mark in the corner. The acute vertices reach past the canvas so their
// rounded tips land on the keyline.
const RIGHT_TRIANGLE = roundpoly([[3.25, 1.25], [3.25, 20.75], [22.75, 20.75]], [1.25, 2.25, 1.25]);
const RIGHT_MARK = line([3.25, 15.75], [8.25, 15.75], [8.25, 20.75]);
const RHOMBUS = roundpoly(fit((P) => roundpoly(P, [1.6, 2, 1.6, 2]), [[12, 2], [19.5, 12], [12, 22], [4.5, 12]], [4.5, 2.4, 19.5, 21.6], { stretchXY: true }), [1.6, 2, 1.6, 2]);
const PARA_R = [2, 1.6, 2, 1.6];
const PARALLELOGRAM = roundpoly(fit((P) => roundpoly(P, PARA_R), [[7, 5], [21.5, 5], [17, 19], [2.5, 19]], [2.5, 5, 21.5, 19], { stretchXY: true }), PARA_R);
const TRAP_R = [2, 2, 1.6, 1.6];
const TRAPEZOID = roundpoly(fit((P) => roundpoly(P, TRAP_R), [[7.5, 5], [16.5, 5], [21.5, 19], [2.5, 19]], [2.4, 5, 21.6, 19], { stretchXY: true }), TRAP_R);
// Six straight sides, the right one pushed in
const POLYGON = roundpoly(fit((P) => roundpoly(P, 1.6), [[3.5, 9.5], [11.5, 3], [20.5, 6.5], [15.25, 12.75], [19.5, 20.5], [5.5, 20.25]], [3, 3, 21, 21]), 1.6);
const ELLIPSE = ell(12, 12, 9.5, 6.5);
const SEMICIRCLE = sector([12, 16.75], 9.5, 180, 360, 1.5);
const QUARTER = sector([3.25, 20.75], 17.5, 270, 360, 1.5, 2.25);

// Arc: 120° of a circle and its center dot, a dash along each radius toward the arc's ends. The
// dashes stop 1.5 of paper short of the arc, which stays open: radii that ran into its ends closed
// it into a fan (and an umbrella at 16 px).
const ARC_O = [12, 17.25];
const ARC_R = 10.75;
const ARC = arc(ARC_O[0], ARC_O[1], ARC_R, 210, 330).d;
const radiusDash = (deg, gap = 3) => line(polar(...ARC_O, 3.7, deg), polar(...ARC_O, ARC_R - gap, deg));

// Capsule (stadium): two exact half circles
const CAPSULE = 'M7.75 6.75H16.25A5.25 5.25 0 0 1 16.25 17.25H7.75A5.25 5.25 0 0 1 7.75 6.75Z';

// Blob: soft lobes and no corners
const BLOB = smoothClosed([
  [11.5, 3.25],
  [17.25, 4.75],
  [20.5, 10],
  [18.5, 15.25],
  [19.75, 19.5],
  [13.5, 20.75],
  [7.5, 18.5],
  [3.25, 14.5],
  [4.25, 8.25],
  [7.25, 5.75],
]);

// Archimedean spiral: two and a half turns from the center out, 3.4 between turns, as one cubic
// per eighth of a turn (Hermite, from the curve's own tangents); centered by its box.
function spiral(turns = 2.5, pitch = 3.4, start = 0) {
  const b = pitch / (2 * Math.PI);
  const step = Math.PI / 4;
  const n = Math.round((turns * 2 * Math.PI) / step);
  const P = (th) => [b * th * Math.cos(th + start), b * th * Math.sin(th + start)];
  const D = (th) => [b * Math.cos(th + start) - b * th * Math.sin(th + start), b * Math.sin(th + start) + b * th * Math.cos(th + start)];
  const raw = [`M${xy(P(0))}`];
  for (let i = 0; i < n; i++) {
    const [a, c] = [i * step, (i + 1) * step];
    raw.push(`C${xy(add(P(a), D(a), step / 3))} ${xy(add(P(c), D(c), -step / 3))} ${xy(P(c))}`);
  }
  const d = raw.join('');
  const [x0, y0, x1, y1] = bbox(d);
  return transform(d, 1, 12 - (x0 + x1) / 2, 12 - (y0 + y1) / 2);
}
const SPIRAL = spiral(2.5, 3.4, rad(-90));

// Four-pointed star with straight sides: long vertical points, shorter horizontal ones
const STAR4_R = [0.6, 1, 0.6, 1, 0.6, 1, 0.6, 1];
const STAR4 = roundpoly(
  fit((P) => roundpoly(P, STAR4_R), [[12, 2], [14.4, 9.6], [19.75, 12], [14.4, 14.4], [12, 22], [9.6, 14.4], [4.25, 12], [9.6, 9.6]], [4.25, 2.4, 19.75, 21.6], { stretchXY: true }),
  STAR4_R,
);
// Starburst: sharp points around a round body, one zigzag outline. Ten points running deep (inner
// corners at 5.75) so at 18 px it reads as a burst, never as the seal's twelve soft scallops; at
// 16 px eight points, the most the pixel grid keeps apart.
const burstPts = (n, inner) => Array.from({ length: 2 * n }, (_, k) => polar(12, 12, k % 2 ? inner : 9.75, -90 + (k * 180) / n));
const BURST_PTS = burstPts(10, 5.75);
const BURST_R = BURST_PTS.map((_, k) => (k % 2 ? 0.5 : 0.3));
const BURST = roundpoly(fit((P) => roundpoly(P, BURST_R), BURST_PTS, [2.4, 2.4, 21.6, 21.6]), BURST_R);
const SEAL = scallop(12, 12, 8.35, 0.7, 12);

// ── Dashed and dotted shapes ──
// The same outlines, broken. Gaps of 3 (1.5 of paper between round caps); the corners stay whole.
const GAP = 3;
const sidesOf = (pts) => pts.map((p, i) => lerp(p, pts[(i + 1) % pts.length], 0.5));
// Triangle: a dash on each corner and one in the middle of each side, all the same length
function triangleDashed() {
  const T = pieces(TRIANGLE).total;
  const period = T / 3;
  const dash = period / 2 - GAP;
  const gaps = sidesOf(TRIANGLE_PTS).flatMap((m) => {
    const s = lengthAt(TRIANGLE, m);
    return [
      [s - dash / 2 - GAP / 2, GAP],
      [s + dash / 2 + GAP / 2, GAP],
    ];
  });
  return dashes(TRIANGLE, gaps);
}
// Hexagon: a dash on each corner; the gaps fall in the middle of each side
const hexagonDashed = () => dashes(HEXAGON, sidesOf(HEX_PTS).map((m) => [lengthAt(HEXAGON, m), GAP]));
// Rectangle: the selection frame's rhythm (edicion/selection): the corners whole, one gap on each
// short side, a dash of 3 in the middle of each long side
function rectangleDashed() {
  const s = (p) => lengthAt(RECT, p);
  const mid = [s([12, 5]), s([21.5, 12]), s([12, 19]), s([2.5, 12])];
  const gaps = [mid[1], mid[3]].map((m) => [m, GAP]);
  for (const m of [mid[0], mid[2]]) gaps.push([m - 1.5 - GAP / 2, GAP], [m + 1.5 + GAP / 2, GAP]);
  return dashes(RECT, gaps);
}

// ── 3D solids ─────────────────────────────────────────────────────────────────────────────
// Solids of revolution are seen slightly from above, their ellipses at the database's ratio (ry ≈
// 0.36 rx); boxes and prisms use datos/cube's oblique view (depth at 45° up and to the right).
// Hidden edges are dashed with the same gap; where a hidden edge passes behind a visible one it
// leaves 1.5 of paper on each side.
const CYL_TOP = ell(12, 5.6, 7.25, 2.6);
const CYL_BODY = 'M4.75 5.6V18.4A7.25 2.6 0 0 0 19.25 18.4V5.6';
const CYL_RIM = 'M4.75 5.6A7.25 2.6 0 0 0 19.25 5.6';

const SPHERE = circ(12, 12, 9);
const EQUATOR = ellArc(12, 12, 9, 3, 180, 0);
// The back half of the equator is one dash in the middle, as capsule-3d's band: toward its ends it
// runs along the circle and merges with it, and two dashes above the front half drew a face.
const EQUATOR_BACK = middle(ellArc(12, 12, 9, 3, 180, 360), 5);

const DOME = 'M3 15A9 9 0 0 1 21 15';
const DOME_BASE = ell(12, 15, 9, 3);
const DOME_RIM = ellArc(12, 15, 9, 3, 180, 360);

// Cone: the sides are tangent to the base (from the apex, not to its widest points)
function cone(apex, c, rx, ry) {
  const h = c[1] - apex[1];
  const a = (Math.asin(-(ry * ry) / h / ry) * 180) / Math.PI;
  const [r, l] = [ellAt(c[0], c[1], rx, ry, a), ellAt(c[0], c[1], rx, ry, 180 - a)];
  return {
    body: `M${xy(apex)}L${xy(r)}A${f(rx)} ${f(ry)} 0 1 1 ${xy(l)}Z`,
    back: ellArc(c[0], c[1], rx, ry, 180 - a, 360 + a),
  };
}
const CONE = cone([12, 3.25], [12, 17.75], 8, 2.85);
const CONE_BACK = middle(CONE.back, 4.5);

// Pyramid (square base, deep in the view): the apex, two faces and the front edge between them
const PYR_R = [1.25, 1.5, 1.5, 1.5];
const PYR_PTS = fit((P) => roundpoly(P, PYR_R), [[12, 2.5], [21, 14.5], [10.5, 21.25], [3, 15.25]], [3.25, 2.6, 20.75, 21]);
const PYRAMID = [roundpoly(PYR_PTS, PYR_R), line(cornerMid(PYR_PTS, 0, PYR_R[0]), cornerMid(PYR_PTS, 2, PYR_R[2]))];
// Tetrahedron seen from above: the base (the set's triangle) and the apex inside it, a little above
// its center, with its three edges out to the corners. Three faces meeting at a point: the side
// view of a pyramid, with its single front edge, read the same as the pyramid's at 18 px.
const TET_APEX = [12, 12.75];
const TETRAHEDRON = [TRIANGLE, ...[0, 1, 2].map((i) => line(TET_APEX, cornerMid(TRIANGLE_PTS, i, 2.2)))];

// Triangular prism lying on a side: the front triangle (equilateral, a point up) and its edges
// running back along the view's depth. A short depth keeps the triangle the subject: a long one
// drew a slanted bar that read as an eraser.
const PRISM_R = [1.25, 1, 1.25, 1.25, 1.25];
const PRISM_PTS = (() => {
  const [t, k] = [13, 4];
  const apex = [t / 2, -t * Math.sin(rad(60))];
  return fit((P) => roundpoly(P, PRISM_R), [[0, 0], apex, add(apex, [k, -k]), [t + k, -k], [t, 0]], [3.25, 3.25, 20.75, 20.75]);
})();
const PRISM = [roundpoly(PRISM_PTS, PRISM_R), line(cornerMid(PRISM_PTS, 1, PRISM_R[1]), cornerMid(PRISM_PTS, 4, PRISM_R[4]))];

// Hexagonal prism standing, a flat side to the front: the top face a flattened hexagon and two
// vertical edges that split the front into three faces (a corner to the front drew a cube)
function hexPrism(R = 8.75, k = 0.4, H = 11.5) {
  const top = 12 - H / 2;
  const at = (deg, dy = 0) => [12 + R * Math.cos(rad(deg)), top + R * k * Math.sin(rad(deg)) + dy];
  // Clockwise from the left corner: the top's back edges, the right side, the bottom's front edges
  const pts = [at(180), at(240), at(300), at(0), at(0, H), at(60, H), at(120, H), at(180, H)];
  const r = 1.25;
  return [
    roundpoly(pts, r),
    line(cornerMid(pts, 0, r), at(120), at(60), cornerMid(pts, 3, r)),
    line(at(120), cornerMid(pts, 6, r)),
    line(at(60), cornerMid(pts, 5, r)),
  ];
}
const PRISM_HEX = hexPrism();

// Cuboid: datos/cube drawn long
const CUBOID = cuboid(2.5, 9.5, 16.5, 19, 5);

// Octahedron: a tall diamond, the belt bending at the front vertex and the front edge through it
const OCT_R = [1.25, 1.5, 1.25, 1.5];
const OCT_PTS = fit((P) => roundpoly(P, OCT_R), [[12, 2], [20.5, 11.25], [12, 22], [3.5, 11.25]], [3.5, 2.4, 20.5, 21.6], { stretchXY: true });
const OCT_FRONT = [12, 14];
const OCTAHEDRON = [
  roundpoly(OCT_PTS, OCT_R),
  line(cornerMid(OCT_PTS, 3, OCT_R[3]), OCT_FRONT, cornerMid(OCT_PTS, 1, OCT_R[1])),
  line(cornerMid(OCT_PTS, 0, OCT_R[0]), cornerMid(OCT_PTS, 2, OCT_R[2])),
];

// Icosahedron: the hexagon's silhouette, the front face and its three edges out to the outline
const ICO_TRI = regular(3, 5.25, -90);
const ICOSAHEDRON = [HEXAGON, `${line(...ICO_TRI)}Z`, ...[0, 2, 4].map((j, i) => line(ICO_TRI[i], cornerMid(HEX_PTS, j, R_POLY)))];

// Torus: the outer ellipse, the near rim of the hole (a smile) and the far one (a frown) resting on it
const TORUS_OUT = ell(12, 12, 9.5, 6.25);
const TORUS_SMILE = ellArc(12, 10.75, 5, 3, 180, 0);
const TORUS_FROWN = 'M8.25 12.73A3.75 2.1 0 0 1 15.75 12.73';
const TORUS_HOLE = 'M8.25 12.73A3.75 2.1 0 0 1 15.75 12.73A5 3 0 0 1 8.25 12.73Z';

// Transparent cube: the cube with its three hidden edges dashed. They meet at the hidden corner in
// one piece (its depth arm stops 2.85 from the front face's edges), then the two back edges each
// run a dash before passing behind a visible edge with 1.5 of paper on each side. The depth is
// shallower than datos/cube's (4 of 17.5): at its 5.25 the hidden edges had no room for a dash and
// read as a stray mark.
const CUBE_S = 13.5;
const CUBE_K = 4;
const CUBE = cuboid(3.25, 20.75 - CUBE_S, 3.25 + CUBE_S, 20.75, CUBE_K);
const CUBE_HIDDEN = (() => {
  const H = [3.25 + CUBE_K, 20.75 - CUBE_K];
  const c = CUBE_S - CUBE_K; // where the back edges pass behind the front face
  const [up, right] = [(t) => [H[0], H[1] - t], (t) => [H[0] + t, H[1]]];
  const arm = 1.5;
  const depth = (CUBE_K - 2.86) * Math.SQRT2;
  const corner = `${line(up(arm), H, right(arm))}${line(H, add(H, [-Math.SQRT1_2, Math.SQRT1_2], depth))}`;
  return [corner, line(up(arm + GAP), up(c - GAP)), line(right(arm + GAP), right(c - GAP))];
})();

// 3D capsule: a vertical pill and its band, the back of the band a single dash
const PILL = 'M6.75 8A5.25 5.25 0 0 1 17.25 8V16A5.25 5.25 0 0 1 6.75 16Z';
const PILL_BAND = ellArc(12, 12, 5.25, 1.85, 180, 0);
const PILL_BACK = (() => {
  const a = (Math.acos((9.7 - 12) / 5.25) * 180) / Math.PI;
  return ellArc(12, 12, 5.25, 1.85, 360 - a, 360 - (180 - a));
})();

// Wedge (a ramp): the right-triangle profile in front, its slope running down to the right at 45°,
// extruded back. The slope stays square to the view's depth, so the top face keeps its width at
// every weight (a slope near 45° the other way would draw it edge-on).
const WEDGE_R = [1.75, 1.25, 1.25, 1.25, 1.25];
const WEDGE_PTS = fit((P) => roundpoly(P, WEDGE_R), [[3.25, 20.75], [3.25, 8], [7.75, 3.5], [20.75, 16.5], [16.25, 21]], [3.25, 3.25, 20.75, 20.75]);
const WEDGE = [roundpoly(WEDGE_PTS, WEDGE_R), line(cornerMid(WEDGE_PTS, 1, WEDGE_R[1]), cornerMid(WEDGE_PTS, 4, WEDGE_R[4]))];

// A set of solids, laid out as edicion/shapes: the cone on top, the sphere and the cube below
const SET_CONE = cone([12, 2.5], [12, 8.5], 4.25, 1.5).body;
const SET_SPHERE = [circ(6.1, 16.9, 3.6), ellArc(6.1, 16.9, 3.6, 1.15, 180, 0)];
const SET_CUBE = cuboid(12.75, 15.75, 17.75, 20.75, 3, 0.9);

// ── Lines and connectors ──────────────────────────────────────────────────────────────────
/** Open polyline with circular corners of radius r (the connectors' turns). */
function bend(pts, r) {
  let d = `M${xy(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const [u, v] = [unit(sub(A, V)), unit(sub(B, V))];
    const t = r / Math.tan(Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${xy(add(V, u, t))}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${xy(add(V, v, t))}`;
  }
  return `${d}L${xy(pts.at(-1))}`;
}
/** A function y(x) drawn as one cubic per step (Hermite, from its own slope). */
function graph(y, x0, x1, n) {
  const h = (x1 - x0) / n;
  const dy = (x) => (y(x + 1e-4) - y(x - 1e-4)) / 2e-4;
  let d = `M${xy([x0, y(x0)])}`;
  for (let i = 0; i < n; i++) {
    const [a, b] = [x0 + i * h, x0 + (i + 1) * h];
    d += `C${xy([a + h / 3, y(a) + (dy(a) * h) / 3])} ${xy([b - h / 3, y(b) - (dy(b) * h) / 3])} ${xy([b, y(b)])}`;
  }
  return d;
}
// Endpoints: hollow nodes of r 2.35, as nucleo/roadmap's; the line runs from edge to edge
const NODE_R = 2.35;
const END_A = [5.25, 18.75];
const END_B = [18.75, 5.25];
const NODES = [circ(...END_A, NODE_R), circ(...END_B, NODE_R)];
// The line styles all span 3–21 on the middle line
const [LX0, LX1] = [3, 21];
const DOTTED = (y) => Array.from({ length: 6 }, (_, i) => dot(LX0 + i * 3.6, y, 0.3));
const DASHED = (y) => run(hl(LX0, LX1, y), 4, GAP);

// ── Angles ──
const ANGLE_V = [3.25, 18.25];
// The obtuse angle: two rays of 10.25 at 135° from a vertex low in the middle, and a small arc
// (at angle's proportion, not a wide lid over the vertex)
const OBTUSE_V = [10.5, 15.75];
// Protractor: the half disc, its inner window (a half circle on the baseline) and a scale of five
// ticks hanging from the arc. A notch and three ticks drew a gauge.
const PROTRACTOR_O = [12, 16.75];

// Parallel lines: two diagonals 6 apart, each with the chevron that marks parallels
function parallels() {
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  return [-3, 3].flatMap((o) => {
    const c = add([12, 12], n, o);
    const tip = add(c, u, 0.75);
    const back = add(tip, u, -1.5);
    return [line(add(c, u, -8.5), add(c, u, 8.5)), line(add(back, n, 1.5), tip, add(back, n, -1.5))];
  });
}

// ── Symmetry ──
// The figure is an inkblot: two lobes on each side, mirrored across the axis. A house-like pentagon
// with the axis inside read as a house with a "!" (home alert). The axis is dashed as edicion/flip's
// (three dashes of 3.5, 3.5 apart); the outer two cross the figure's ends by 1.75 each way.
const AXIS_DASHES = [[3.25, 6.75], [10.25, 13.75], [17.25, 20.75]];
const INKBLOT = (() => {
  const right = [[12, 5], [14.5, 4.25], [18.25, 3.5], [20.75, 6.5], [19.75, 10], [16.75, 12], [20, 14.75], [19.5, 18.75], [15.5, 19.5], [12, 19]];
  return smoothClosed([...right, ...right.slice(1, -1).reverse().map(([x, y]) => [24 - x, y])]);
})();
const AXIS_V = AXIS_DASHES.map(([a, b]) => vl(12, a, b));
// Quatrefoil: four lobes of r 3.25, 3.75 from the center (their tips 7 out, where the outer dashes
// cross them), deep enough between them to read as a four-leaf figure, not a round target
function quatrefoil(R = 3.25, o = 3.75) {
  const c = [12, 12];
  const centers = [-90, 0, 90, 180].map((a) => polar(...c, o, a));
  const half = Math.hypot(o, o) / 2;
  const h = Math.sqrt(R * R - half * half);
  // Outer cusp between lobes k and k+1 (on the diagonal between them)
  const cusp = (k) => {
    const [a, b] = [centers[k], centers[(k + 1) % 4]];
    const m = lerp(a, b, 0.5);
    return add(m, unit(sub(m, c)), h);
  };
  let d = `M${xy(cusp(3))}`;
  for (let k = 0; k < 4; k++) d += `A${f(R)} ${f(R)} 0 1 1 ${xy(cusp(k))}`;
  return `${d}Z`;
}


// ── Grids and patterns ────────────────────────────────────────────────────────────────────
/**
 * The stretch of the line through `a` (direction toward `b`) that lies inside the closed path
 * `d` around `a`: a pattern's line ends exactly on its outline, corners included.
 */
function clip(d, a, b) {
  const u = unit(sub(b, a));
  const poly = pieces(d).flatMap((q) => Array.from({ length: 241 }, (_, i) => q.at(i / 240)));
  const ts = [];
  for (let i = 0; i < poly.length - 1; i++) {
    const [p, q] = [poly[i], poly[i + 1]];
    const e = sub(q, p);
    const den = u[0] * e[1] - u[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = sub(p, a);
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const k = (w[0] * u[1] - w[1] * u[0]) / den;
    if (k >= 0 && k <= 1) ts.push(t);
  }
  const lo = Math.max(...ts.filter((t) => t < 0));
  const hi = Math.min(...ts.filter((t) => t > 0));
  return line(add(a, u, lo), add(a, u, hi));
}
// The square swatch: continuous corners on all four (a pattern, not a container), a little inside
// the square keyline (4.25–19.75) so a pattern's lines stay under the set's density
const TILE = sq(4.25, 4.25, 15.5, 15.5, 3);
const across = (y) => clip(TILE, [12, y], [20, y]);
const down = (x) => clip(TILE, [x, 12], [x, 20]);
const diag = (c) => clip(TILE, [c / 2, c / 2], [c / 2 + 1, c / 2 - 1]);
const antiDiag = (c) => clip(TILE, [12 + c / 2, 12 - c / 2], [13 + c / 2, 13 - c / 2]);

// Grid: three by three cells (the rule of thirds)
const GRID_AT = [4.25 + 15.5 / 3, 19.75 - 15.5 / 3];
// Perspective grid: a floor seen from above, its lines running to a far vanishing point and its
// rows closing up toward the far edge
const FLOOR_PTS = [[7, 4.75], [17, 4.75], [21.5, 19.25], [2.5, 19.25]];
const FLOOR = roundpoly(FLOOR_PTS, 1.25);
const floorX = (x0, y) => {
  // A line from the near edge toward the vanishing point, at height y
  const [vx, vy] = [12, 4.75 - (13.5 * 5) / 4.5];
  return x0 + ((vx - x0) * (19.25 - y)) / (19.25 - vy);
};
// Honeycomb: three pointy-top hexagons sharing edges, one outline and the three inner edges
function honeycomb(R = 5.25) {
  const w = R * Math.sqrt(3);
  const A = [12 - w / 2, 12 + 0.75 * R];
  const B = [12 + w / 2, A[1]];
  const C = [12, A[1] - 1.5 * R];
  const v = (c, deg) => polar(...c, R, deg);
  const pts = [v(C, -90), v(C, -30), v(B, -90), v(B, -30), v(B, 30), v(B, 90), v(A, 30), v(A, 90), v(A, 150), v(A, 210), v(A, -90), v(C, 210)];
  // Rounded on the outer corners; the inner ones, where two cells meet, stay sharp
  const r = pts.map((_, i) => ([2, 6, 10].includes(i) ? 0 : 1.25));
  const J = v(A, -30);
  const ends = [v(A, 30), v(A, -90), v(B, -90)];
  return { outline: roundpoly(pts, r), edges: ends.map((e) => line(J, e)), through: ends.map((e) => line(J, add(e, unit(sub(e, J)), 2))) };
}
const HONEY = honeycomb();
// Checkerboard: two by two, the top-left and bottom-right cells hatched
// Two lines 2.5 to either side of each hatched cell's diagonal (x + y = 16.25 and 31.75)
const CHECK_HATCH = (() => {
  const k = 2.5 * Math.SQRT2;
  const [tl, br] = [16.25, 31.75];
  return [diag(tl - k), line([tl + k - 12, 12], [12, tl + k - 12]), line([12, br - k - 12], [br - k - 12, 12]), diag(br + k)];
})();
// Golden ratio: a golden rectangle split into its square and the next one, and the spiral through
// them. The spiral keeps the classic centers but runs 3 inside the frame (r − 3), so it never rides
// along an edge: it rises from the bottom edge and ends on the second divider.
const GOLD = { x: 2.5, y: 6.125, w: 19, h: 11.75 };
const GOLD_SPIRAL = `${arc(14.25, 17.875, 8.75, 180, 270).d}${arc(14.25, 13.375, 4.25, 270, 360).d.replace(/^M[^A]*/, '')}`;

// ── Measures ──
// Dimension lines: end ticks of 2.2 across them, 4 from what they measure (1.5 of paper and more)
const TICK = 1.1;
/** A dimension line from a to b with a tick across each end: [line, tick, tick]. */
function dimension(a, b) {
  const u = unit(sub(b, a));
  const n = [-u[1] * TICK, u[0] * TICK];
  return [line(a, b), line(add(a, n, -1), add(a, n)), line(add(b, n, -1), add(b, n))];
}
/**
 * The diameter's double arrow, tip to tip across the circle at radius r: narrow heads (30°) so their
 * arms stand 2.85 clear of the circle they touch.
 */
function diameterArrow(r) {
  const [a, b] = [polar(12, 12, r, 135), polar(12, 12, r, -45)];
  return [line(a, b), head(b, sub(b, a), 4, 30), head(a, sub(a, b), 4, 30)];
}
// Circumference: a circle and the dimension arc that runs around its upper right
const CIRC_C = [9.5, 14.5];
// Perimeter: a square and the dashed track around it, 4.5 out, ending in an arrowhead
function perimeter() {
  const track = sq(3.5, 3.5, 17, 17, 4.25);
  const s0 = lengthAt(track, [12, 3.5]);
  const T = pieces(track).total;
  // Clockwise from just right of the top's middle all the way round to just left of it
  const open = stretch(track, s0 + 1.75, s0 + T - 1.75);
  const tip = pointAt(track, (s0 + T - 1.75) % T);
  return [sq(8, 8, 8, 8, 2), ...run(open, 9, GAP), head(tip, [1, 0], 2.5, 40)];
}
// Diagonal: the dimension runs along the screen's diagonal, its ticks clear of the edges
const DIAG = (() => {
  const at = (t) => [2.5 + 19 * t, 19 - 14 * t];
  return dimension(at(0.27), at(0.73));
})();
// Width (turned for the height): `dimensions` with one dimension line, its square and its line
// above (under a landscape box the line drew a laptop; beside a portrait one, "IO")
const WIDTH = [sq(5.875, 8.5, 12.25, 12.25, 2.5), ...dimension([5.875, 4.5], [18.125, 4.5])];
/**
 * A cuboid in datos/cube's oblique view: front face (x0, y0)–(x1, y1), depth k. The inner edges end
 * on the rounded corners, not on their vertices (a vertex lies outside the outline: the cap poked
 * out of a square corner).
 */
function cuboid(x0, y0, x1, y1, k, r = 1.25) {
  const pts = [[x0, y0], [x0 + k, y0 - k], [x1 + k, y0 - k], [x1 + k, y1 - k], [x1, y1], [x0, y1]];
  return [roundpoly(pts, r), line(cornerMid(pts, 0, r), [x1, y0], cornerMid(pts, 2, r)), line([x1, y0], cornerMid(pts, 4, r))];
}
/** The point `d` from `p` toward `deg` degrees. */
const toward = (p, deg, d) => add(p, [Math.cos(rad(deg)) * d, Math.sin(rad(deg)) * d]);

const icons = {
  // ── 2D primitives ──
  triangle: { tags: ['triángulo', 'forma', 'geometría', 'triangle', 'shape'], d: [TRIANGLE] },
  'right-triangle': { tags: ['triángulo rectángulo', 'ángulo recto', 'pendiente', 'right triangle', 'geometry'], d: [RIGHT_TRIANGLE, RIGHT_MARK] },
  pentagon: { tags: ['pentágono', 'polígono', 'forma', 'pentagon', 'polygon'], d: [PENTAGON] },
  hexagon: { tags: ['hexágono', 'polígono', 'celda', 'hexagon', 'polygon'], d: [HEXAGON] },
  heptagon: { tags: ['heptágono', 'polígono', 'siete lados', 'heptagon', 'polygon'], d: [HEPTAGON] },
  octagon: { tags: ['octágono', 'polígono', 'alto', 'octagon', 'polygon'], d: [OCTAGON] },
  rectangle: { tags: ['rectángulo', 'forma', 'marco', 'rectangle', 'shape'], d: [RECT] },
  rhombus: { tags: ['rombo', 'diamante', 'decisión', 'rhombus', 'diamond'], d: [RHOMBUS] },
  parallelogram: { tags: ['paralelogramo', 'entrada y salida', 'diagrama de flujo', 'parallelogram', 'shape'], d: [PARALLELOGRAM] },
  trapezoid: { tags: ['trapecio', 'forma', 'geometría', 'trapezoid', 'shape'], d: [TRAPEZOID] },
  polygon: { tags: ['polígono', 'forma libre', 'región', 'polygon', 'freeform'], d: [POLYGON] },
  ellipse: { tags: ['elipse', 'óvalo', 'forma', 'ellipse', 'oval'], d: [ELLIPSE] },
  semicircle: { tags: ['semicírculo', 'medio círculo', 'cúpula', 'semicircle', 'half circle'], d: [SEMICIRCLE] },
  'quarter-circle': { tags: ['cuarto de círculo', 'sector', 'cuña', 'quarter circle', 'sector'], d: [QUARTER] },
  arc: {
    tags: ['arco', 'segmento de arco', 'geometría', 'arc', 'arc segment'],
    d: [ARC, dot(...ARC_O), radiusDash(210), radiusDash(330)],
  },
  capsule: { tags: ['cápsula', 'píldora', 'botón', 'capsule', 'pill'], d: [CAPSULE] },
  annulus: { tags: ['anillo', 'aro', 'dona', 'annulus', 'ring'], d: [circ(12, 12, 9), circ(12, 12, 5.5)] },
  blob: { tags: ['forma orgánica', 'mancha', 'forma libre', 'blob', 'organic shape'], d: [BLOB] },
  spiral: { tags: ['espiral', 'remolino', 'crecimiento', 'spiral', 'swirl'], d: [SPIRAL] },
  'star-four': { tags: ['estrella de cuatro puntas', 'destello', 'brillo', 'four-pointed star', 'highlight'], d: [STAR4] },
  starburst: { tags: ['explosión', 'estallido', 'oferta', 'starburst', 'burst'], d: [BURST] },
  seal: { tags: ['sello', 'roseta', 'insignia', 'seal', 'sticker'], d: [SEAL] },

  // ── Dashed and dotted shapes ──
  'circle-dotted': {
    tags: ['círculo punteado', 'pendiente', 'opcional', 'dotted circle', 'placeholder'],
    d: Array.from({ length: 12 }, (_, k) => dot(...polar(12, 12, 8.6, -90 + k * 30))),
  },
  'triangle-dashed': { tags: ['triángulo discontinuo', 'borrador', 'oculto', 'dashed triangle', 'placeholder'], d: triangleDashed() },
  'hexagon-dashed': { tags: ['hexágono discontinuo', 'espacio vacío', 'celda libre', 'dashed hexagon', 'empty slot'], d: hexagonDashed() },
  'rectangle-dashed': { tags: ['rectángulo discontinuo', 'espacio vacío', 'zona para soltar', 'dashed rectangle', 'drop zone'], d: rectangleDashed() },

  // ── 3D solids ──
  cylinder: { tags: ['cilindro', 'sólido', '3d', 'cylinder', 'solid'], d: [CYL_TOP, CYL_BODY] },
  sphere: { tags: ['esfera', 'bola', '3d', 'sphere', 'ball'], d: [SPHERE, EQUATOR, EQUATOR_BACK] },
  hemisphere: { tags: ['semiesfera', 'cúpula', '3d', 'hemisphere', 'dome'], d: [DOME, DOME_BASE] },
  cone: { tags: ['cono', 'sólido', '3d', 'cone', 'solid'], d: [CONE.body, CONE_BACK] },
  pyramid: { tags: ['pirámide', 'sólido', '3d', 'pyramid', 'solid'], d: PYRAMID },
  tetrahedron: { tags: ['tetraedro', 'poliedro', '3d', 'tetrahedron', 'polyhedron'], d: TETRAHEDRON },
  prism: { tags: ['prisma', 'prisma triangular', '3d', 'prism', 'triangular prism'], d: PRISM },
  'prism-hexagonal': { tags: ['prisma hexagonal', 'columna', 'cristal', 'hexagonal prism', 'column'], d: PRISM_HEX },
  cuboid: { tags: ['prisma rectangular', 'caja', '3d', 'cuboid', 'rectangular box'], d: CUBOID },
  octahedron: { tags: ['octaedro', 'poliedro', 'cristal', 'octahedron', 'polyhedron'], d: OCTAHEDRON },
  icosahedron: { tags: ['icosaedro', 'poliedro', 'malla 3d', 'icosahedron', 'low poly'], d: ICOSAHEDRON },
  torus: { tags: ['toro', 'dona', '3d', 'torus', 'donut'], d: [TORUS_OUT, TORUS_SMILE, TORUS_FROWN] },
  'cube-transparent': { tags: ['cubo transparente', 'malla', 'aristas ocultas', 'wireframe', 'x-ray'], d: [...CUBE, ...CUBE_HIDDEN] },
  'capsule-3d': { tags: ['cápsula 3d', 'sólido', 'primitiva 3d', '3d capsule', 'solid'], d: [PILL, PILL_BAND, PILL_BACK] },
  wedge: { tags: ['cuña', 'rampa', '3d', 'wedge', 'ramp'], d: WEDGE },
  'shapes-3d': { tags: ['formas 3d', 'sólidos', 'objeto 3d', '3d shapes', 'primitives'], d: [SET_CONE, ...SET_SPHERE, ...SET_CUBE] },

  // ── Lines and connectors ──
  'line-segment': {
    tags: ['segmento', 'línea', 'herramienta de línea', 'line segment', 'line tool'],
    d: [...NODES, line(polar(...END_A, NODE_R, -45), polar(...END_B, NODE_R, 135))],
  },
  'line-curved': {
    tags: ['conector curvo', 'línea curva', 'diagrama', 'curved connector', 'curved line'],
    d: [...NODES, `M${xy([END_A[0] + NODE_R, END_A[1]])}C13.25 18.75 10.75 5.25 ${xy([END_B[0] - NODE_R, END_B[1]])}`],
  },
  'line-elbow': {
    tags: ['conector en codo', 'conector ortogonal', 'diagrama', 'elbow connector', 'orthogonal'],
    d: [...NODES, bend([[END_A[0] + NODE_R, END_A[1]], [12, END_A[1]], [12, END_B[1]], [END_B[0] - NODE_R, END_B[1]]], 1.75)],
  },
  polyline: {
    tags: ['polilínea', 'segmentos', 'puntos', 'polyline', 'multi-point'],
    d: (() => {
      const P = [[4.5, 18.5], [9.25, 7.5], [14.75, 16.5], [19.5, 5.5]];
      const r = 1.75;
      const links = P.slice(1).map((b, i) => {
        const a = P[i];
        const u = unit(sub(b, a));
        return line(add(a, u, r), add(b, u, -r));
      });
      return [...P.map((p) => circ(...p, r)), ...links];
    })(),
  },
  'line-dashed': { tags: ['línea discontinua', 'guiones', 'estilo de línea', 'dashed line', 'line style'], d: DASHED(12) },
  'line-dotted': { tags: ['línea punteada', 'puntos', 'estilo de línea', 'dotted line', 'line style'], d: DOTTED(12) },
  'line-dash-dot': { tags: ['línea de trazo y punto', 'eje', 'dibujo técnico', 'dash-dot line', 'center line'], d: [hl(LX0, 8.75, 12), dot(12, 12, 0.3), hl(15.25, LX1, 12)] },
  'line-wavy': { tags: ['línea ondulada', 'onda', 'subrayado ondulado', 'wavy line', 'wave'], d: [graph((x) => 12 - 2.25 * Math.sin(((x - LX0) * 2 * Math.PI) / 6), LX0, LX1, 12)] },
  'line-zigzag': {
    tags: ['zigzag', 'línea quebrada', 'borde dentado', 'zigzag line', 'jagged'],
    d: [line(...Array.from({ length: 9 }, (_, i) => [LX0 + (i * (LX1 - LX0)) / 8, i % 2 ? 9.75 : 14.25]))],
  },
  'line-weight': {
    tags: ['grosor de línea', 'trazo', 'espesor', 'line weight', 'stroke width'],
    d: [hl(LX0, LX1, 4.25), 'M4.5 8.25H19.5A1.5 1.5 0 0 1 19.5 11.25H4.5A1.5 1.5 0 0 1 4.5 8.25Z', 'M5.75 14.25H18.25A2.75 2.75 0 0 1 18.25 19.75H5.75A2.75 2.75 0 0 1 5.75 14.25Z'],
  },
  'line-styles': { tags: ['estilos de línea', 'continua', 'discontinua', 'line styles', 'dashed'], d: [hl(LX0, LX1, 6), ...DASHED(12), ...DOTTED(18)] },

  // ── Angles ──
  angle: {
    tags: ['ángulo', 'grados', 'rotación', 'angle', 'degrees'],
    d: [line([20.75, ANGLE_V[1]], ANGLE_V, polar(...ANGLE_V, 17.5, -45)), arc(...ANGLE_V, 7.5, -45, 0).d],
  },
  'right-angle': {
    tags: ['ángulo recto', '90 grados', 'escuadra', 'right angle', '90 degrees'],
    d: [line([3.75, 3.75], [3.75, 20.25], [20.25, 20.25]), line([3.75, 15.25], [8.75, 15.25], [8.75, 20.25])],
  },
  'obtuse-angle': {
    tags: ['ángulo obtuso', 'ángulo abierto', 'geometría', 'obtuse angle', 'wide angle'],
    d: [line([20.75, OBTUSE_V[1]], OBTUSE_V, polar(...OBTUSE_V, 10.25, 225)), arc(...OBTUSE_V, 4.25, 225, 360).d],
  },
  protractor: {
    tags: ['transportador', 'medir ángulos', 'geometría', 'protractor', 'angle tool'],
    d: [sector(PROTRACTOR_O, 9.5, 180, 360, 1.5), arc(...PROTRACTOR_O, 4.25, 180, 360).d, ...[210, 240, 270, 300, 330].map((a) => line(polar(...PROTRACTOR_O, 9.5, a), polar(...PROTRACTOR_O, 7.25, a)))],
  },
  'lines-parallel': { tags: ['líneas paralelas', 'paralelo', 'restricción', 'parallel lines', 'parallel'], d: parallels() },
  'lines-perpendicular': {
    tags: ['líneas perpendiculares', 'perpendicular', 'restricción', 'perpendicular lines', 'constraint'],
    d: [hl(3.25, 20.75, 19.75), vl(12, 4.25, 19.75), line([12, 15.25], [16.5, 15.25], [16.5, 19.75])],
  },
  tangent: {
    tags: ['tangente', 'curva', 'restricción', 'tangent', 'touching'],
    d: (() => {
      const c = [9.75, 14.25];
      const P = polar(...c, 6, -45);
      const u = [Math.SQRT1_2, Math.SQRT1_2];
      return [circ(...c, 6), line(add(P, u, -9), add(P, u, 9))];
    })(),
  },

  // ── Symmetry ──
  symmetry: { tags: ['simetría', 'eje de simetría', 'espejo', 'symmetry', 'mirror axis'], d: [INKBLOT, ...AXIS_V] },
  'symmetry-quadrant': {
    tags: ['simetría en cuatro', 'cuadrantes', 'espejo', 'four-way symmetry', 'quadrant'],
    d: [quatrefoil(), ...AXIS_DASHES.map(([a, b]) => vl(12, a, b)), ...AXIS_DASHES.map(([a, b]) => hl(a, b, 12))],
  },

  // ── Grids and patterns ──
  grid: { tags: ['cuadrícula', 'rejilla', 'papel cuadriculado', 'grid', 'show grid'], d: [TILE, ...GRID_AT.map(down), ...GRID_AT.map(across)] },
  'grid-dots': {
    tags: ['cuadrícula de puntos', 'papel punteado', 'puntos de ajuste', 'dot grid', 'snap points'],
    d: [0, 1, 2, 3, 4].flatMap((j) => [0, 1, 2, 3, 4].map((i) => dot(3.25 + i * 4.375, 3.25 + j * 4.375, 0.3))),
  },
  'grid-isometric': {
    tags: ['cuadrícula isométrica', 'triángulos', 'dibujo isométrico', 'isometric grid', 'triangle grid'],
    d: [HEXAGON, ...[0, 1, 2].map((i) => line(cornerMid(HEX_PTS, i, R_POLY), cornerMid(HEX_PTS, i + 3, R_POLY)))],
  },
  'grid-perspective': {
    tags: ['cuadrícula en perspectiva', 'punto de fuga', 'plano 3d', 'perspective grid', 'vanishing point'],
    d: [
      FLOOR,
      ...[2.5 + 19 / 3, 21.5 - 19 / 3].map((x) => line([x, 19.25], [floorX(x, 4.75), 4.75])),
      ...[13.25, 8.5].map((y) => clip(FLOOR, [12, y], [20, y])),
    ],
  },
  // Two rings and the two axes crossing at the pole (radii that stopped short of it drew a crosshair;
  // a third ring passes the set's density)
  'grid-polar': {
    tags: ['cuadrícula polar', 'coordenadas polares', 'radial', 'polar grid', 'radial grid'],
    d: [circ(12, 12, 9), circ(12, 12, 4), hl(3, 21, 12), vl(12, 3, 21)],
  },
  honeycomb: { tags: ['panal', 'hexágonos', 'mosaico', 'honeycomb', 'hex grid'], d: [HONEY.outline, ...HONEY.edges] },
  checkerboard: { tags: ['tablero', 'cuadros', 'transparencia', 'checkerboard', 'checkered'], d: [TILE, down(12), across(12), ...CHECK_HATCH] },
  stripes: { tags: ['rayas', 'franjas', 'textura', 'stripes', 'hatch'], d: [TILE, ...[17.5, 24, 30.5].map(diag)] },
  crosshatch: { tags: ['tramado cruzado', 'rejilla', 'malla', 'crosshatch', 'lattice'], d: [TILE, diag(19.5), diag(28.5), antiDiag(-4.5), antiDiag(4.5)] },
  'golden-ratio': {
    tags: ['proporción áurea', 'espiral áurea', 'composición', 'golden ratio', 'golden spiral'],
    d: [sq(GOLD.x, GOLD.y, GOLD.w, GOLD.h, 2), vl(14.25, GOLD.y, GOLD.y + GOLD.h), hl(14.25, GOLD.x + GOLD.w, 13.375), GOLD_SPIRAL],
  },

  // ── Measures ──
  diameter: { tags: ['diámetro', 'ancho', 'medida', 'diameter', 'width'], d: [circ(12, 12, 9), ...diameterArrow(9)] },
  radius: { tags: ['radio', 'medida', 'círculo', 'radius', 'measure'], d: [circ(12, 12, 9), line([12, 12], polar(12, 12, 9, -45)), dot(12, 12)] },
  circumference: {
    tags: ['circunferencia', 'contorno', 'medida', 'circumference', 'girth'],
    d: [circ(...CIRC_C, 6.5), arc(...CIRC_C, 10.5, -90, 0).d, ...[-90, 0].map((a) => line(polar(...CIRC_C, 9.35, a), polar(...CIRC_C, 11.65, a)))],
  },
  area: {
    tags: ['área', 'superficie', 'metros cuadrados', 'area', 'floor area'],
    d: (() => {
      const L = roundpoly([[3.25, 3.25], [11, 3.25], [11, 12.5], [20.75, 12.5], [20.75, 20.75], [3.25, 20.75]], [2, 2, 1.5, 2, 2, 2]);
      const ref = [[6, 14], [11, 17], [17, 19]];
      return [L, ...[20, 28, 36].map((c, i) => clip(L, ref[i], [ref[i][0] + 1, ref[i][1] - 1]))];
    })(),
  },
  perimeter: { tags: ['perímetro', 'contorno', 'borde', 'perimeter', 'boundary'], d: perimeter() },
  dimensions: {
    tags: ['dimensiones', 'ancho y alto', 'tamaño', 'dimensions', 'size'],
    d: [sq(8.5, 8.5, 12.25, 12.25, 2.5), ...dimension([8.5, 4.5], [20.75, 4.5]), ...dimension([4.5, 20.75], [4.5, 8.5])],
  },
  'dimensions-3d': {
    tags: ['dimensiones 3d', 'volumen', 'tamaño del paquete', '3d dimensions', 'volume'],
    d: (() => {
      const [x0, y0, x1, y1, k] = [5.4, 9.4, 13.15, 17.1, 4];
      const o = 4;
      return [
        ...cuboid(x0, y0, x1, y1, k),
        ...dimension([x0, y1 + o], [x1, y1 + o]),
        ...dimension([x1 + k + o, y1 - k], [x1 + k + o, y0 - k]),
        ...dimension(toward([x0, y0], 225, o), toward([x0 + k, y0 - k], 225, o)),
      ];
    })(),
  },
  'dimension-width': { tags: ['ancho', 'anchura', 'medida', 'width', 'dimension'], d: WIDTH },
  'dimension-height': { tags: ['alto', 'altura', 'medida', 'height', 'dimension'], d: WIDTH.map((d) => turnPath(d, -90)) },
  'dimension-depth': {
    tags: ['profundidad', 'fondo', 'medida', 'depth', 'dimension'],
    d: (() => {
      // The depth along the top's receding edge, out to the upper left as in dimensions-3d (along the
      // bottom right it drew a box with a pencil)
      const [x0, y0, x1, y1, k] = [6.5, 11.25, 15.75, 20.75, 5];
      return [...cuboid(x0, y0, x1, y1, k), ...dimension(toward([x0, y0], 225, 4), toward([x0 + k, y0 - k], 225, 4))];
    })(),
  },
  'dimension-diagonal': { tags: ['diagonal', 'tamaño de pantalla', 'pulgadas', 'diagonal size', 'screen size'], d: [RECT, ...DIAG] },
};

// ── Fill (DESIGN.md › Fill) ──
// By index into each icon's d: `solid` is filled (closed shapes only), `cut` is knocked out (a cut
// that reaches the silhouette keeps its relation to the edge at every weight), `lines` sits on top
// with a clearance of paper and `wire` sits on top, flush.
const FILL = {
  triangle: { solid: [0] },
  'right-triangle': { solid: [0], cut: [1] },
  pentagon: { solid: [0] },
  hexagon: { solid: [0] },
  heptagon: { solid: [0] },
  octagon: { solid: [0] },
  rectangle: { solid: [0] },
  rhombus: { solid: [0] },
  parallelogram: { solid: [0] },
  trapezoid: { solid: [0] },
  polygon: { solid: [0] },
  ellipse: { solid: [0] },
  semicircle: { solid: [0] },
  'quarter-circle': { solid: [0] },
  capsule: { solid: [0] },
  blob: { solid: [0] },
  'star-four': { solid: [0] },
  starburst: { solid: [0] },
  seal: { solid: [0] },
  cone: { solid: [0] },
  pyramid: { solid: [0], cut: [1] },
  tetrahedron: { solid: [0], cut: [1, 2, 3] },
  prism: { solid: [0], cut: [1] },
  'prism-hexagonal': { solid: [0], cut: [1, 2, 3] },
  cuboid: { solid: [0], cut: [1, 2] },
  octahedron: { solid: [0], cut: [1, 2] },
  icosahedron: { solid: [0], cut: [1, 2, 3, 4] },
  'cube-transparent': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'capsule-3d': { solid: [0], cut: [1] },
  sphere: { solid: [0], cut: [1] },
  wedge: { solid: [0], cut: [1] },
  'shapes-3d': { solid: [0, 1, 3], cut: [2, 4, 5] },
  'line-segment': { solid: [0, 1], wire: [2] },
  'line-curved': { solid: [0, 1], wire: [2] },
  'line-elbow': { solid: [0, 1], wire: [2] },
  polyline: { solid: [0, 1, 2, 3], wire: [4, 5, 6] },
  'line-weight': { solid: [1, 2], wire: [0] },
  protractor: { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  tangent: { solid: [0], wire: [1] },
  symmetry: { solid: [0], lines: [1, 2, 3] },
  'symmetry-quadrant': { solid: [0], lines: [1, 2, 3, 4, 5, 6] },
  grid: { solid: [0], cut: [1, 2, 3, 4] },
  'grid-isometric': { solid: [0], cut: [1, 2, 3] },
  'grid-perspective': { solid: [0], cut: [1, 2, 3, 4] },
  'grid-polar': { solid: [0], cut: [1, 2, 3] },
  honeycomb: { solid: [0], cut: [1, 2, 3] },
  stripes: { solid: [0], cut: [1, 2, 3] },
  crosshatch: { solid: [0], cut: [1, 2, 3, 4] },
  'golden-ratio': { solid: [0], cut: [1, 2, 3] },
  radius: { solid: [0], cut: [1, 2] },
  circumference: { solid: [0], wire: [1, 2, 3] },
  area: { solid: [0], cut: [1, 2, 3] },
  perimeter: { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  dimensions: { solid: [0], wire: [1, 2, 3, 4, 5, 6] },
  'dimensions-3d': { solid: [0], cut: [1, 2], wire: [3, 4, 5, 6, 7, 8, 9, 10, 11] },
  'dimension-width': { solid: [0], wire: [1, 2, 3] },
  'dimension-height': { solid: [0], wire: [1, 2, 3] },
  'dimension-depth': { solid: [0], cut: [1, 2], wire: [3, 4, 5] },
  'dimension-diagonal': { solid: [0], cut: [1, 2, 3] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, ix]) => [k, pick(ix)]));
}
// Closed for the fill: the bodies drawn open in the outline, and the shapes with a hole
// Filled, the double arrow stops well inside the edge: tips that ran to it would cut a notch at some
// weights and not at others
icons.diameter.fill = { solid: [icons.diameter.d[0]], cut: diameterArrow(6.6) };
icons.annulus.fill = { solid: [`${circ(12, 12, 9)}${circCW(12, 12, 5.5)}`] };
icons.cylinder.fill = { solid: [`${CYL_BODY}Z`, CYL_TOP], cut: [CYL_RIM] };
icons.hemisphere.fill = { solid: [`${DOME}Z`, DOME_BASE], cut: [DOME_RIM] };
// Filled, the torus is a disc with the hole cut through it: the near rim's ends, cut too, drew whiskers
icons.torus.fill = { solid: [`${TORUS_OUT}${TORUS_HOLE}`] };
// Checkerboard: the hatched cells fill; the frame and the cross stay lines
{
  const s = (pt) => lengthAt(TILE, pt);
  const cell = (a, b) => `${stretch(TILE, s(a), s(b))}L12 12Z`;
  icons.checkerboard.fill = { solid: [cell([4.25, 12], [12, 4.25]), cell([19.75, 12], [12, 19.75])], wire: icons.checkerboard.d.slice(0, 3) };
}
// Open lines, dots and placeholders only: their filled version is the outline itself
for (const name of ['arc', 'spiral', 'circle-dotted', 'triangle-dashed', 'hexagon-dashed', 'rectangle-dashed', 'line-dashed', 'line-dotted', 'line-dash-dot', 'line-wavy', 'line-zigzag', 'line-styles', 'angle', 'right-angle', 'obtuse-angle', 'lines-parallel', 'lines-perpendicular', 'grid-dots'])
  icons[name].fill = false;

// ── Named parts, motion and levels ──
const PARTS = {
  'right-triangle': { shape: [0], mark: [1] },
  arc: { arc: [0], center: [1], radius: [2, 3] },
  annulus: { outer: [0], inner: [1] },
  spiral: { spiral: [0] },
  'star-four': { star: [0] },
  starburst: { burst: [0] },
  seal: { seal: [0] },
  cylinder: { lid: [0], body: [1] },
  sphere: { body: [0], equator: [1, 2] },
  hemisphere: { dome: [0], base: [1] },
  cone: { body: [0], hidden: [1] },
  'cube-transparent': { body: [0], edge: [1, 2], hidden: [3, 4, 5] },
  'capsule-3d': { body: [0], band: [1, 2] },
  torus: { body: [0], hole: [1, 2] },
  'shapes-3d': { cone: [0], sphere: [1, 2], cube: [3, 4, 5] },
  'line-segment': { node: [0, 1], line: [2] },
  'line-curved': { node: [0, 1], line: [2] },
  'line-elbow': { node: [0, 1], line: [2] },
  polyline: { node: [0, 1, 2, 3], line: [4, 5, 6] },
  'line-weight': { level: [0, 1, 2] },
  'line-styles': { solid: [0], dashed: [1, 2, 3, 4], dotted: [5, 6, 7, 8, 9, 10] },
  angle: { rays: [0], arc: [1] },
  'obtuse-angle': { rays: [0], arc: [1] },
  'right-angle': { rays: [0], mark: [1] },
  protractor: { body: [0], window: [1], ticks: [2, 3, 4, 5, 6] },
  'lines-perpendicular': { base: [0], line: [1], mark: [2] },
  tangent: { circle: [0], line: [1] },
  symmetry: { shape: [0], axis: [1, 2, 3] },
  'symmetry-quadrant': { shape: [0], axis: [1, 2, 3, 4, 5, 6] },
  'grid-polar': { rings: [0, 1], axes: [2, 3] },
  'golden-ratio': { frame: [0], dividers: [1, 2], spiral: [3] },
  diameter: { circle: [0], diameter: [1, 2, 3] },
  radius: { circle: [0], radius: [1, 2] },
  circumference: { circle: [0], dimension: [1, 2, 3] },
  perimeter: { shape: [0], track: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  dimensions: { shape: [0], width: [1, 2, 3], height: [4, 5, 6] },
  'dimensions-3d': { shape: [0, 1, 2], width: [3, 4, 5], height: [6, 7, 8], depth: [9, 10, 11] },
  'dimension-width': { shape: [0], dimension: [1, 2, 3] },
  'dimension-height': { shape: [0], dimension: [1, 2, 3] },
  'dimension-depth': { shape: [0, 1, 2], dimension: [3, 4, 5] },
  'dimension-diagonal': { shape: [0], dimension: [1, 2, 3] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
icons.spiral.motion = { effect: 'spin', origin: [12, 12] };
icons.seal.motion = { effect: 'spin', origin: [12, 12] };
icons.starburst.motion = { effect: 'beat', origin: [12, 12] };
icons['star-four'].motion = { effect: 'beat', origin: [12, 12] };
icons.blob.motion = { effect: 'float', vector: [0, -1.5] };
icons.radius.motion = { effect: 'spin', parts: ['radius'], origin: [12, 12] };
icons.diameter.motion = { effect: 'spin', parts: ['diameter'], origin: [12, 12] };
// Line weight: the three weights light up from the thinnest
icons['line-weight'].levels = [[0], [1], [2]];

// ── 16 px (DESIGN.md › 16 px) ──
// Fewer pieces where the snap leaves a smudge: hidden edges and back halves go, dots stand two
// pixels apart (6 of the canvas, on pixel corners) and curves loosen.
const small = (d, fill) => ({ d, ...(fill !== undefined && { fill }) });
icons.spiral.small = small([spiral(1.75, 4.5, rad(-90))]);
{
  const P = burstPts(8, 5.5);
  const r = P.map((_, k) => (k % 2 ? 0.5 : 0.3));
  const burst = roundpoly(fit((Q) => roundpoly(Q, r), P, [2.4, 2.4, 21.6, 21.6]), r);
  icons.starburst.small = small([burst], { solid: [burst] });
}
icons.sphere.small = small([SPHERE, EQUATOR], { solid: [SPHERE], cut: [EQUATOR] });
icons.cone.small = small([CONE.body], { solid: [CONE.body] });
icons['capsule-3d'].small = small([PILL, PILL_BAND], { solid: [PILL], cut: [PILL_BAND] });
// The dome and its base's near rim, one closed shape: the full base's two rims smeared at 16 px
{
  const dome = `${DOME}A9 3 0 0 1 3 15Z`;
  icons.hemisphere.small = small([dome], { solid: [dome] });
}
// The outline and the hole alone: the near rim's ends ran into the hole at 16 px
icons.torus.small = small([TORUS_OUT, TORUS_HOLE], { solid: [`${TORUS_OUT}${TORUS_HOLE}`] });
// The hidden corner as one L with longer arms: its dashes and short arms were a one-pixel smudge
{
  const H = [3.25 + CUBE_K, 20.75 - CUBE_K];
  const corner = line([H[0], H[1] - 3], H, [H[0] + 3, H[1]]);
  icons['cube-transparent'].small = small([...CUBE, corner], { solid: [CUBE[0]], cut: [CUBE[1], CUBE[2], corner] });
}
// The radii stop 3 pixels short of the arc, which otherwise closes into a fan
icons.arc.small = small([ARC, dot(...ARC_O), radiusDash(210, 4.5), radiusDash(330, 4.5)]);
// Three ticks and the window: five ticks ran together
{
  const d = [sector(PROTRACTOR_O, 9.5, 180, 360, 1.5), arc(...PROTRACTOR_O, 4.5, 180, 360).d, ...[225, 270, 315].map((a) => line(polar(...PROTRACTOR_O, 9.5, a), polar(...PROTRACTOR_O, 7.5, a)))];
  icons.protractor.small = small(d, { solid: [d[0]], cut: d.slice(1) });
}
{
  const dots = (y) => [3, 9, 15, 21].map((x) => dot(x, y, 0.3));
  icons['line-dotted'].small = small(dots(12));
  icons['line-styles'].small = small([hl(LX0, LX1, 6), ...DASHED(12), ...dots(18)]);
  icons['grid-dots'].small = small([3, 9, 15, 21].flatMap((y) => dots(y)));
}
icons['line-wavy'].small = small([graph((x) => 12 - 2.5 * Math.sin(((x - LX0) * 2 * Math.PI) / 9), LX0, LX1, 8)]);
icons['dimensions-3d'].small = (() => {
  const d = icons['dimensions-3d'].d.slice(0, 9);
  return small(d, { solid: [d[0]], cut: [d[1], d[2]], wire: d.slice(3) });
})();

// ── Variants (DESIGN.md › Automatic variants) ──
const off = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Round already, on the circle keyline: they aren't enclosed in a circle again
off(['annulus', 'circle-dotted', 'sphere', 'grid-polar', 'seal', 'starburst', 'radius', 'diameter'], { circle: false });
// Square swatches: they aren't enclosed in a square again
off(['grid', 'checkerboard', 'stripes', 'crosshatch'], { square: false });
// Line styles and dots on their own: a slash through them says nothing
off(['line-dashed', 'line-dotted', 'line-dash-dot', 'line-wavy', 'line-zigzag', 'line-styles', 'line-weight', 'circle-dotted', 'grid-dots'], { slash: false });
// Angles, constraints and connectors are lines too: a slash along or across them draws another
// figure (the right angle became a right triangle, the tangent got a parallel)
off(['angle', 'right-angle', 'obtuse-angle', 'lines-parallel', 'lines-perpendicular', 'tangent', 'line-segment', 'line-curved', 'line-elbow', 'polyline'], { slash: false });

export default { category: 'formas', label: 'Formas y geometría', icons };
