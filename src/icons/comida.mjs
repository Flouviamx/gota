// Food: bread and bakery, eggs, cheese and dairy, meat, poultry and seafood, dishes and fast food,
// bowls, sweets and ice cream, the pantry, condiments and groceries. Everything is computed with
// the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on containers (cups, tubs, jars, cartons, bags, boxes;
// not on bowls, bottles or cans, which are round). Dishes and foods are generic, never a brand's
// product. One base per family: the loaf's dome for bread, one egg, one cheese hole, one liner for
// muffins and cupcakes, one cone for ice cream, one bowl for every dish served in a bowl, one burger
// for the burger, the meal and the scan, and one paper bag for the groceries; lugares' fish is the
// fish of the plate, and comercio's scan corners frame the scan. Badges are the engine's.
import { badge, circ, dot, f, halfChord, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import cocina from './cocina.mjs';
import comercio from './comercio.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** The left-hand normal of a direction on screen (y down): outside, when a shape is drawn clockwise. */
const left = (v) => [v[1], -v[0]];
const BR = { square: ['br'] };
/** The badges' center (DESIGN.md › Badges): pivots for the badge motions. */
const BC = [17.25, 17.25];
const ang = (c, p) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;

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

const K = 0.5523;
/** Ellipse with semi-axes rx, ry (four cubics, clockwise from its right end). */
function ell([cx, cy], rx, ry) {
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, K * ry)} ${P(K * rx, ry)} ${P(0, ry)}C${P(-K * rx, ry)} ${P(-rx, K * ry)} ${P(-rx, 0)}C${P(-rx, -K * ry)} ${P(-K * rx, -ry)} ${P(0, -ry)}C${P(K * rx, -ry)} ${P(rx, -K * ry)} ${P(rx, 0)}Z`;
}
/** A circle drawn the other way round: a hole in a solid (the fill is nonzero). */
const circRev = (cx, cy, r) => circ(cx, cy, r).replace(/ 0 1 0 /g, ' 0 1 1 ');
/** An ellipse drawn counterclockwise: a hole in a solid ellipse. */
function ellRev([cx, cy], rx, ry) {
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, -K * ry)} ${P(K * rx, -ry)} ${P(0, -ry)}C${P(-K * rx, -ry)} ${P(-rx, -K * ry)} ${P(-rx, 0)}C${P(-rx, K * ry)} ${P(-K * rx, ry)} ${P(0, ry)}C${P(K * rx, ry)} ${P(rx, K * ry)} ${P(rx, 0)}Z`;
}
/** The lower half of an ellipse, left to right (the front edge of a disc or a rim). */
function ellLow([cx, cy], rx, ry) {
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(-rx, 0)}C${P(-rx, K * ry)} ${P(-K * rx, ry)} ${P(0, ry)}C${P(K * rx, ry)} ${P(rx, K * ry)} ${P(rx, 0)}`;
}
/** The upper half of an ellipse, left to right (a dome). */
function ellUp([cx, cy], rx, ry) {
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(-rx, 0)}C${P(-rx, -K * ry)} ${P(-K * rx, -ry)} ${P(0, -ry)}C${P(K * rx, -ry)} ${P(rx, -K * ry)} ${P(rx, 0)}`;
}
/** A point on an ellipse at parameter `deg` (0 = right, 90 = down). */
const onEll = ([cx, cy], rx, ry, deg) => [cx + rx * Math.cos((deg * Math.PI) / 180), cy + ry * Math.sin((deg * Math.PI) / 180)];

/** A round hole in a solid outline: the circle drawn against the outline's own direction (nonzero fill). */
function pierce(outer, cx, cy, r) {
  const pts = trace(outer, 0.1);
  const area = pts.reduce((a, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
  // Positive is clockwise on screen; circ() runs counterclockwise
  return `${outer}${area > 0 ? circ(cx, cy, r) : circRev(cx, cy, r)}`;
}
/** An oval hole in a solid outline, drawn against the outline's own direction. */
function pierceEll(outer, c, rx, ry) {
  const pts = trace(outer, 0.1);
  const area = pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0);
  return `${outer}${area > 0 ? ellRev(c, rx, ry) : ell(c, rx, ry)}`;
}
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
/** A straight line from a to b stopped `k` short of each end (a fill's cut that stops short). */
const short = (a, b, k = 1.1) => {
  const u = unit(sub(b, a));
  return line(add2(a, mul(u, k)), add2(b, mul(u, -k)));
};
/** The front of an ellipse from parameter a0 down to a1 (degrees, 90 = its lowest point), as an arc. */
const ellFront = ([cx, cy], rx, ry, a0, a1) => `M${pt(onEll([cx, cy], rx, ry, a0))}A${f(rx)} ${f(ry)} 0 0 0 ${pt(onEll([cx, cy], rx, ry, a1))}`;
/** The front edge of a stack's ellipse stopped short of its sides by `k` (a fill's cut). */
const frontShort = (c, rx, ry, k = 1.1) => {
  const a = (Math.acos(1 - k / rx) * 180) / Math.PI;
  return ellFront(c, rx, ry, 180 - a, a);
};
/** A path continued: drops the leading move of `d`, to chain it after another path's end. */
const tail = (d) => d.replace(/^M[^A-Za-z]*/, '');

/** A path scaled by `s` around `o` and moved by (dx, dy). */
const xf = (d, s, o = [12, 12], dx = 0, dy = 0) => transform(d, s, o[0] * (1 - s) + dx, o[1] * (1 - s) + dy);
/** The strokes `d` with xf applied to every one. */
const xfs = (ds, s, o, dx, dy) => ds.map((d) => xf(d, s, o, dx, dy));

/** A path turned `deg` degrees about `c` and moved by (dx, dy). */
const turnAbout = (d, deg, c, [dx, dy] = [0, 0]) => transform(turnPath(d, deg, c), 1, dx, dy);

/**
 * Points along a path, about `step` apart (absolute after the engine's transform): to put the end
 * of one stroke exactly on another's curve.
 */
function trace(d, step = 0.05) {
  const pts = [];
  const re = /([MLHVCSQAZ])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/gi;
  const toks = [...transform(d, 1, 0, 0).matchAll(re)].map((m) => m[1] ?? Number(m[2]));
  let [x, y, sx, sy, cmd, pc] = [0, 0, 0, 0, '', null];
  const n = (l) => Math.max(2, Math.ceil(l / step));
  const seg = (to) => {
    const k = n(len(sub(to, [x, y])));
    for (let i = 1; i <= k; i++) pts.push(lerp([x, y], to, i / k));
    [x, y] = to;
  };
  const bez = (c1, c2, e) => {
    const k = n(len(sub(c1, [x, y])) + len(sub(c2, c1)) + len(sub(e, c2)));
    for (let i = 1; i <= k; i++) pts.push(cubicAt([x, y], c1, c2, e, i / k));
    pc = c2;
    [x, y] = e;
  };
  for (let i = 0; i < toks.length; ) {
    if (typeof toks[i] === 'string') cmd = toks[i++].toUpperCase();
    const g = (k) => toks.slice(i, (i += k));
    if (cmd === 'M') {
      [x, y] = [sx, sy] = g(2);
      pts.push([x, y]);
      cmd = 'L';
    } else if (cmd === 'Z') seg([sx, sy]);
    else if (cmd === 'L') seg(g(2));
    else if (cmd === 'H') seg([g(1)[0], y]);
    else if (cmd === 'V') seg([x, g(1)[0]]);
    else if (cmd === 'C') {
      const a = g(6);
      bez(a.slice(0, 2), a.slice(2, 4), a.slice(4));
    } else if (cmd === 'S') {
      const a = g(4);
      bez(pc ? sub(mul([x, y], 2), pc) : [x, y], a.slice(0, 2), a.slice(2));
    } else if (cmd === 'Q') {
      const a = g(4);
      const q = a.slice(0, 2);
      bez(lerp([x, y], q, 2 / 3), lerp(a.slice(2), q, 2 / 3), a.slice(2));
    } else if (cmd === 'A') {
      const [rx0, ry0, , large, sweep, ex, ey] = g(7);
      const [mx, my] = [(x - ex) / 2, (y - ey) / 2];
      let [rx, ry] = [rx0, ry0];
      const lam = (mx * mx) / (rx * rx) + (my * my) / (ry * ry);
      if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
      const num = Math.max(0, rx * rx * ry * ry - rx * rx * my * my - ry * ry * mx * mx);
      const k = (large === sweep ? -1 : 1) * Math.sqrt(num / (rx * rx * my * my + ry * ry * mx * mx));
      const [cx, cy] = [(k * rx * my) / ry + (x + ex) / 2, (-k * ry * mx) / rx + (y + ey) / 2];
      const a0 = Math.atan2((y - cy) / ry, (x - cx) / rx);
      let da = Math.atan2((ey - cy) / ry, (ex - cx) / rx) - a0;
      if (sweep && da < 0) da += 2 * Math.PI;
      if (!sweep && da > 0) da -= 2 * Math.PI;
      const m = n(Math.abs(da) * Math.max(rx, ry));
      for (let j = 1; j <= m; j++) pts.push([cx + rx * Math.cos(a0 + (da * j) / m), cy + ry * Math.sin(a0 + (da * j) / m)]);
      [x, y] = [ex, ey];
    }
    if (cmd !== 'C' && cmd !== 'S') pc = null;
  }
  return pts;
}
/** Where the ray from p along `dir` first meets a traced outline (beyond `from` along it). */
function hit(samples, p, dir, from = 0.01) {
  const u = unit(dir);
  let best = null;
  for (let i = 0; i < samples.length - 1; i++) {
    const [a, b] = [samples[i], samples[i + 1]];
    const e = sub(b, a);
    const den = u[0] * e[1] - u[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = sub(a, p);
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const s = (w[0] * u[1] - w[1] * u[0]) / den;
    if (t > from && s >= 0 && s <= 1 && (!best || t < best[0])) best = [t, add2(p, mul(u, t))];
  }
  return best?.[1];
}

/** Is p inside a closed traced outline (even-odd)? */
function inside(ring, [px, py]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/**
 * A stroke that passes behind other pieces: only its runs that stay `gap` (center to center) clear
 * of them and outside their areas, each at least 2 long, as smooth paths. Nothing is trimmed by
 * hand: the pieces in front decide where it stops.
 */
function behind(d, fronts, gap = 3) {
  const pts = trace(d, 0.05);
  const fs = fronts.map((fd) => ({ s: trace(fd, 0.1), closed: /Z\s*$/i.test(fd) }));
  const seen = pts.map((p) => fs.every(({ s, closed }) => !(closed && inside(s, p)) && s.every((q) => len(sub(p, q)) >= gap)));
  const runs = [];
  let cur = [];
  pts.forEach((p, i) => {
    if (seen[i]) cur.push(p);
    else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  });
  if (cur.length) runs.push(cur);
  const length = (r) => r.slice(1).reduce((a, p, i) => a + len(sub(p, r[i])), 0);
  return runs.filter((r) => length(r) >= 2).map((r) => {
    const k = Math.max(2, Math.round(length(r) / 0.75));
    return smooth(Array.from({ length: k + 1 }, (_, i) => r[Math.round((i * (r.length - 1)) / k)]));
  });
}

/** The stretch of a path between two points on it (nearest samples), as a smooth path from a to b. */
function between(d, a, b) {
  const pts = trace(d, 0.05);
  const near = (p) => pts.reduce((k, q, i) => (len(sub(q, p)) < len(sub(pts[k], p)) ? i : k), 0);
  const [i, j] = [near(a), near(b)];
  const run = i <= j ? pts.slice(i, j + 1) : pts.slice(j, i + 1).reverse();
  const k = Math.max(2, Math.round(run.length / 12));
  return smooth(Array.from({ length: k + 1 }, (_, n) => run[Math.round((n * (run.length - 1)) / k)]));
}

/** A local frame at `o` turned `deg` degrees: (u, v) → canvas, u along the axis and v across it. */
const frame = (o, deg) => {
  const a = (deg * Math.PI) / 180;
  const U = [Math.cos(a), Math.sin(a)];
  const V = [-Math.sin(a), Math.cos(a)];
  return (u, v) => [o[0] + u * U[0] + v * V[0], o[1] + u * U[1] + v * V[1]];
};

/** Arc from a to b with sagitta s: s > 0 bulges to the left of a → b (outward on a clockwise shape). */
function arcS(a, b, s) {
  const c = len(sub(b, a));
  const r = (c * c) / 4 / Math.abs(s) / 2 + Math.abs(s) / 2;
  return `A${f(r)} ${f(r)} 0 ${Math.abs(s) > c / 2 ? 1 : 0} ${s > 0 ? 1 : 0} ${pt(b)}`;
}
/** A closed shape through `pts` whose sides are arcs of sagitta `s` (one per side, or one for all). */
const scallop = (pts, s) => `M${pt(pts[0])}${pts.map((p, i) => arcS(p, pts[(i + 1) % pts.length], Array.isArray(s) ? s[i] : s)).join('')}Z`;

/** A smooth curve through `pts` (Catmull-Rom as cubics); `closed` joins the last point to the first. */
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
/** A point on a cubic segment at t. */
const cubicAt = (p0, c1, c2, p1, t) => {
  const m = 1 - t;
  return [0, 1].map((i) => m * m * m * p0[i] + 3 * m * m * t * c1[i] + 3 * m * t * t * c2[i] + t * t * t * p1[i]);
};

/**
 * A wave from a to b of `n` half waves, `amp` high (each half wave a cubic whose peak is `amp`),
 * starting toward the left of a → b (`phase` -1: toward the right).
 */
function wave(a, b, amp, n, phase = 1) {
  const nv = left(unit(sub(b, a)));
  let s = `M${pt(a)}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1] = [lerp(a, b, i / n), lerp(a, b, (i + 1) / n)];
    const h = mul(nv, ((phase * (i % 2 ? -1 : 1) * amp * 4) / 3));
    s += `C${pt(add2(lerp(p0, p1, 1 / 3), h))} ${pt(add2(lerp(p0, p1, 2 / 3), h))} ${pt(p1)}`;
  }
  return s;
}

/** Intersections of two circles [x, y, r]: the one on the left of A → B first. */
function meet([x1, y1, r1], [x2, y2, r2]) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  return [
    [m[0] + (h * (y2 - y1)) / d, m[1] - (h * (x2 - x1)) / d],
    [m[0] - (h * (y2 - y1)) / d, m[1] + (h * (x2 - x1)) / d],
  ];
}
/** An open chain of circles: the outer arcs from `a` (on the first circle) to `b` (on the last). */
function chain(cs, a, b) {
  const X = cs.slice(0, -1).map((A, i) => meet(A, cs[i + 1])[0]);
  const stops = [a, ...X, b];
  let s = `M${pt(a)}`;
  cs.forEach((C, i) => {
    const span = (((ang(C, stops[i + 1]) - ang(C, stops[i])) % 360) + 360) % 360;
    s += `A${f(C[2])} ${f(C[2])} 0 ${span > 180 ? 1 : 0} 1 ${pt(stops[i + 1])}`;
  });
  return s;
}

/** A polygon (clockwise) moved `d` inward: every side parallel, at `d` from its original. */
function inset(pts, d) {
  const n = pts.length;
  return pts.map((V, i) => {
    const [A, B] = [pts[(i - 1 + n) % n], pts[(i + 1) % n]];
    const [e1, e2] = [unit(sub(V, A)), unit(sub(B, V))];
    const [n1, n2] = [[-e1[1], e1[0]], [-e2[1], e2[0]]];
    return add2(V, mul(add2(n1, n2), d / (1 + n1[0] * n2[0] + n1[1] * n2[1])));
  });
}

/** Where the vertical x = c crosses a path's outline, top first (sampled finely in Chrome-free JS). */
function crossX(samples, c) {
  const out = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const [p, q] = [samples[i], samples[i + 1]];
    if ((p[0] - c) * (q[0] - c) <= 0 && p[0] !== q[0]) out.push([c, p[1] + ((q[1] - p[1]) * (c - p[0])) / (q[0] - p[0])]);
  }
  return out.sort((a, b) => a[1] - b[1]);
}
/** Where the horizontal y = c crosses a sampled outline, left first. */
function crossY(samples, c) {
  return crossX(samples.map(([x, y]) => [y, x]), c)
    .map(([y, x]) => [x, y])
    .sort((a, b) => a[0] - b[0]);
}
/** Samples along a chain of arcs of sagitta s through closed points (the scallop's outline). */
function scallopSamples(pts, s, step = 0.02) {
  const out = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const c = len(sub(b, a));
    const si = Array.isArray(s) ? s[i] : s;
    const r = (c * c) / 4 / Math.abs(si) / 2 + Math.abs(si) / 2;
    const m = lerp(a, b, 0.5);
    const nv = left(unit(sub(b, a)));
    const ctr = add2(m, mul(nv, (si > 0 ? -1 : 1) * (r - Math.abs(si))));
    const [a0, a1] = [ang(ctr, a), ang(ctr, b)];
    let span = a1 - a0;
    if (si > 0) span = ((span % 360) + 360) % 360;
    else span = -((((-span) % 360) + 360) % 360);
    for (let t = 0; t < 1; t += step) out.push(polar(...ctr, r, a0 + span * t));
  });
  out.push(out[0]);
  return out;
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Pieces a drawing keeps for the fill block at the end (a whole outline behind a part, a hole). */
const KEEP = {};

// ── Bread and bakery ──────────────────────────────────────────────────────────────────────────
// The loaf: a dome over a flat base with rounded bottom corners, three parallel scores across its
// crown, in a row.
const LOAF = `M5 19.25H19A2.25 2.25 0 0 0 21.25 17V14.5C21.25 9.6 17.1 6.25 12 6.25S2.75 9.6 2.75 14.5V17A2.25 2.25 0 0 0 5 19.25Z`;
{
  const score = (x) => line([x - 1, 14.65], [x + 1, 11.85]);
  add('bread', ['pan', 'hogaza', 'panadería', 'bread', 'loaf', 'bakery'], [LOAF, score(7.75), score(12), score(16.25)]);
}

// Slice of bread: a square base under a crust of two lobes (the shoulders) with a soft dip between
// them, and the crumb's edge 3 inside the crust, the same shape inset.
{
  const P = [[2.75, 3.25], [12, 4.5], [21.25, 3.25], [21.25, 12], [18.75, 13.25], [18.75, 21.25], [5.25, 21.25], [5.25, 13.25], [2.75, 12]];
  const crust = roundpoly(P, [4.5, 7, 4.5, 1.5, 0.75, 2, 2, 0.75, 1.5]);
  const crumb = roundpoly(inset(P, 3), [1.5, 10, 1.5, 0.4, 3.75, 0.5, 0.5, 3.75, 0.4]);
  add('bread-slice', ['rebanada de pan', 'pan de caja', 'tostada', 'bread slice', 'toast', 'sandwich bread'], [crust, crumb]);
}

// Baguette: a long capsule on the diagonal and three scores almost along its length, staggered.
{
  const L = frame([12, 12], -45);
  const [u0, u1, w] = [-8.1, 8.1, 3.5];
  const R = halfChord(L(u1, -w), L(u1, w));
  const body = `M${pt(L(u0, -w))}L${pt(L(u1, -w))}A${R} ${R} 0 0 1 ${pt(L(u1, w))}L${pt(L(u0, w))}A${R} ${R} 0 0 1 ${pt(L(u0, -w))}Z`;
  const score = (u) => line(L(u - 1.6, 0.5), L(u + 1.6, -0.5));
  add('baguette', ['baguette', 'pan francés', 'barra de pan', 'baguette', 'french bread', 'bakery'], [body, score(-6.25), score(0), score(6.25)]);
}

// Croissant: a crescent of five segments that swell toward the middle, the separators between them
// and the two tips curling in, toward the crescent's center.
{
  const C = [12, 20];
  const R = 9.1;
  const at = (r, a) => polar(C[0], C[1], r, a);
  const B = [222, 249, 291, 318];
  const T = [2.55, 3.6, 3.6, 2.55];
  const O = B.map((a, i) => at(R + T[i], a));
  const I = B.map((a, i) => at(R - T[i], a));
  const tipL = at(R - 1.2, 199);
  const tipR = at(R - 1.2, 341);
  const outline = `M${pt(tipL)}${arcS(tipL, O[0], 0.6)}${arcS(O[0], O[1], 0.85)}${arcS(O[1], O[2], 1.15)}${arcS(O[2], O[3], 0.85)}${arcS(O[3], tipR, 0.6)}${arcS(tipR, I[3], 0.35)}${arcS(I[3], I[2], 0.3)}${arcS(I[2], I[1], 0.4)}${arcS(I[1], I[0], 0.3)}${arcS(I[0], tipL, 0.35)}Z`;
  add('croissant', ['cuernito', 'croissant', 'pan dulce', 'desayuno', 'croissant', 'pastry', 'breakfast'], [outline, ...O.map((o, i) => line(o, I[i]))]);
}

// Pretzel: one rope. Its belly hangs wide and round at the bottom; the rope rises from the belly's
// left, twists with the other end in the middle, loops over the round right lobe and down around the
// belly, up over the left lobe, and crosses back through the twist to end pressed on the belly's
// right. No salt: two grains in the lower hole read as a face.
{
  const X = [12, 11.5];
  const P = [[15.5, 4.25], [20.25, 4.75], [21.25, 10.5], [18.75, 17.5], [12, 20.25], [5.25, 17.5], [2.75, 10.5], [3.75, 4.75], [8.5, 4.25]];
  // The ends land on the belly: points of its own curves (Catmull-Rom from Rd to BR and BL to Ld)
  const seg = (p0, p1, p2, p3, t) => cubicAt(p1, add2(p1, mul(sub(p2, p0), 1 / 6)), sub(p2, mul(sub(p3, p1), 1 / 6)), p2, t);
  const EL = seg(P[4], P[5], P[6], P[7], 0.3);
  const ER = seg(P[1], P[2], P[3], P[4], 0.7);
  add('pretzel', ['pretzel', 'bretzel', 'botana', 'pretzel', 'snack', 'bakery'], [smooth([EL, X, ...P, X, ER])]);
}

// Bagel: the ring in three-quarter view, its hole set back on the top, the line of its rounded
// side, and a seed on the top at each side, along the ring.
{
  add('bagel', ['bagel', 'rosca', 'pan', 'desayuno', 'bagel', 'breakfast'], [
    ell([12, 11.75], 9.25, 7.25),
    ell([12, 10.25], 2.75, 1.6),
    `M2.83 13.25C4.5 15.7 8 17 12 17S19.5 15.7 21.17 13.25`,
    line([6.4, 9.75], [6, 11.75]),
    line([17.65, 10.25], [18, 12.3]),
  ]);
}

// Concha: its sugar top is a scallop shell, three ribs bowing out from the middle of its base to a
// scalloped edge; under it, a band of bread with rounded bottom corners.
{
  const c = [12, 14.25];
  const [rx, ry] = [8.75, 9];
  const stops = [180, 225, 270, 315, 360].map((a) => onEll(c, rx, ry, a));
  const shell = stops.slice(1).map((p, i) => arcS(stops[i], p, 1.35)).join('');
  const body = `M${pt(stops[0])}${shell}V16.75A2.5 2.5 0 0 1 18.25 19.25H5.75A2.5 2.5 0 0 1 3.25 16.75Z`;
  const rib = (p, s) => `M${pt(c)}${arcS(c, p, s)}`;
  add('concha', ['concha', 'pan dulce', 'panadería mexicana', 'concha', 'mexican sweet bread', 'pan dulce'], [
    body,
    line([3.25, 14.25], [20.75, 14.25]),
    rib(stops[1], 1.1),
    line(c, stops[2]),
    rib(stops[3], -1.1),
  ]);
}

// Churro: a slim stick in a gentle bow, the groove along its middle, both ends cut as the star of
// its nozzle (two points, the groove landing in the notch between them).
{
  const L = frame([12, 12], -45);
  const [U, w] = [8.6, 3];
  const bow = (u) => 1.2 * (1 - (u / U) ** 2);
  const at = (u, v) => L(u, v + bow(u));
  const run = (v, a, b) => Array.from({ length: 9 }, (_, i) => at(a + ((b - a) * i) / 8, v));
  const end = (s) => [[U + 0.55, -1.5], [U - 0.5, 0], [U + 0.55, 1.5]].map(([u, v]) => at(s * u, s * v));
  const body = `${smooth(run(-w, -U, U))}L${end(1).map(pt).join('L')}L${pt(at(U, w))}${tail(smooth(run(w, U, -U)))}L${end(-1).map(pt).join('L')}Z`;
  add('churro', ['churro', 'postre', 'antojito', 'churro', 'fried dough', 'dessert'], [body, smooth(run(0, -U + 0.5, U - 0.5))]);
}

// Cinnamon roll: the rim, and inside it the dough coiling out from the middle, a turn and a half.
{
  const [r0, r1, turns] = [1.75, 6.1, 1.5];
  const pts = Array.from({ length: turns * 16 + 1 }, (_, i) => {
    const t = i / (turns * 16);
    return polar(12, 12, r0 + (r1 - r0) * t, 180 + 360 * turns * t);
  });
  add('cinnamon-roll', ['rol de canela', 'pan de canela', 'repostería', 'cinnamon roll', 'cinnamon bun', 'pastry'], [circ(12, 12, 9), smooth(pts)]);
}

// Flatbread: thin rounds stacked in three-quarter view, the top one blistered in three spots; their
// edges barely round, thinner than the pancakes'.
{
  const [c, rx, ry] = [[12, 8.5], 9.25, 4.25];
  const ys = [8.5, 11.5, 14.5];
  const sides = (x, from, to, s) => from.map((y, i) => arcS([x, y], [x, to[i]], s)).join('');
  const outline = `M${pt([c[0] - rx, c[1]])}${tail(ellUp(c, rx, ry))}${sides(c[0] + rx, ys.slice(0, 2), ys.slice(1), 0.5)}${reverseLow([12, 14.5], rx, ry)}${sides(c[0] - rx, [14.5, 11.5], [11.5, 8.5], 0.5)}Z`;
  add('flatbread', ['tortillas', 'pan plano', 'naan', 'pita', 'flatbread', 'tortilla', 'naan'], [
    outline,
    ellLow(c, rx, ry),
    ellLow([12, 11.5], rx, ry),
    dot(7.5, 8.75),
    dot(11.75, 7.5),
    dot(16, 9),
  ]);
}

// Donut: the ring from above with its hole, and four sprinkles scattered on it.
{
  const sprinkle = (a, tilt) => {
    const p = polar(12, 12, 6.125, a);
    const t = [-Math.sin(((a + tilt) * Math.PI) / 180), Math.cos(((a + tilt) * Math.PI) / 180)];
    return line(add2(p, mul(t, -1.05)), add2(p, mul(t, 1.05)));
  };
  add('donut', ['dona', 'rosquilla', 'postre', 'cafetería', 'donut', 'doughnut', 'dessert'], [circ(12, 12, 9.25), circ(12, 12, 3), sprinkle(140, 8), sprinkle(250, -8), sprinkle(320, 8), sprinkle(35, -8)]);
}

// Pancakes: two discs stacked in three-quarter view, their sides rounded, and a pat of butter on
// top.
{
  const [c, rx, ry] = [[12, 8.5], 8.75, 3.75];
  const ys = [8.5, 11.75, 15];
  const sides = (x, from, to, s) => from.map((y, i) => arcS([x, y], [x, to[i]], s)).join('');
  const outline = `M${pt([c[0] - rx, c[1]])}${tail(ellUp(c, rx, ry))}${sides(c[0] + rx, ys.slice(0, 2), ys.slice(1), 0.7)}${reverseLow([12, 15], rx, ry)}${sides(c[0] - rx, [15, 11.75], [11.75, 8.5], 0.7)}Z`;
  const pat = roundpoly([[9.5, 8.5], [12, 7.15], [14.5, 8.5], [12, 9.85]], 0.6);
  add('pancakes', ['hot cakes', 'panqueques', 'desayuno', 'pancakes', 'hotcakes', 'brunch'], [outline, ellLow(c, rx, ry), ellLow([12, 11.75], rx, ry), pat]);
}
/** The lower half of an ellipse from right to left, as a continuation (to close a stack's outline). */
function reverseLow([cx, cy], rx, ry) {
  const P = (x, y) => pt([cx + x, cy + y]);
  return `C${P(rx, K * ry)} ${P(K * rx, ry)} ${P(0, ry)}C${P(-K * rx, ry)} ${P(-rx, K * ry)} ${P(-rx, 0)}`;
}

// Waffle: a round waffle with a scalloped rim, and inside it the grid of two lines each way.
{
  const n = 12;
  const valleys = Array.from({ length: n }, (_, i) => polar(12, 12, 8.6, -90 + 15 + (i * 360) / n));
  const g = 5.45;
  add('waffle', ['wafle', 'gofre', 'desayuno', 'waffle', 'stroopwafel', 'breakfast'], [
    scallop(valleys, 0.75),
    line([9.25, 12 - g], [9.25, 12 + g]),
    line([14.75, 12 - g], [14.75, 12 + g]),
    line([12 - g, 9.25], [12 + g, 9.25]),
    line([12 - g, 14.75], [12 + g, 14.75]),
  ]);
}

// Muffins and cupcakes stand in one pleated liner: a cup wider at the top, three ribs, the
// signature corner.
const LINER = {
  cup: roundline([[4.75, 14], [6.25, 21.25], [17.75, 21.25], [19.25, 14]], [0, 1.75, 0, 0]),
  ribs: [[8.5, 9.25], [12, 12], [15.5, 14.75]].map(([a, b]) => line([a, 14], [b, 21.25])),
};
// Muffin: a wide dome spilling over the liner's rim, two berries in it.
{
  const top = `M3 12.5C3 7.1 7 3.5 12 3.5S21 7.1 21 12.5A1.5 1.5 0 0 1 19.5 14H4.5A1.5 1.5 0 0 1 3 12.5Z`;
  add('muffin', ['magdalena', 'mantecada', 'panqué', 'muffin', 'cupcake', 'bakery'], [top, LINER.cup, ...LINER.ribs, dot(9, 9.75), dot(12.75, 7)]);
}
// Cupcake: frosting in three tiers stepping in, a cherry on top.
{
  const cherry = circ(12, 3.5, 1.6);
  const dx = Math.sqrt(1.6 ** 2 - 1.25 ** 2);
  const frost = roundline(
    [[12 - dx, 4.75], [8.25, 4.75], [8.25, 7.75], [5.75, 7.75], [5.75, 10.75], [3.25, 10.75], [3.25, 14], [20.75, 14], [20.75, 10.75], [18.25, 10.75], [18.25, 7.75], [15.75, 7.75], [15.75, 4.75], [12 + dx, 4.75]],
    [0, 1.5, 0.5, 1.5, 0.5, 1.5, 1.5, 1.5, 1.5, 0.5, 1.5, 0.5, 1.5, 0],
  );
  add('cupcake', ['cupcake', 'pastelito', 'panquecito', 'cupcake', 'fairy cake', 'dessert'], [frost, cherry, LINER.cup, ...LINER.ribs]);
}

// Macaron: two smooth domed shells, each standing on its ruffled foot (a row of small scallops),
// and the filling between them, set in from the shells.
{
  const ruff = (y, dir) => {
    const pts = Array.from({ length: 7 }, (_, i) => [20.25 - (i * 16.5) / 6, y]);
    return pts.slice(1).map((p, i) => arcS(pts[i], p, dir * 0.5)).join('');
  };
  const upper = `M3.75 10.25C3 6.6 7.2 4.25 12 4.25S21 6.6 20.25 10.25${ruff(10.25, 1)}Z`;
  const lower = `M3.75 13.75C3 17.4 7.2 19.75 12 19.75S21 17.4 20.25 13.75${ruff(13.75, -1)}Z`;
  add('macaron', ['macaron', 'macarrón', 'repostería francesa', 'macaron', 'patisserie', 'dessert'], [
    upper,
    lower,
    `M5.5 10.85A1.6 1.6 0 0 0 5.5 13.15`,
    `M18.5 10.85A1.6 1.6 0 0 1 18.5 13.15`,
  ]);
}

// Pie: in three-quarter view, a fluted rim, a lattice of two strips each way and the dish's side.
{
  const [c, rx, ry] = [[12, 9.5], 8.75, 4.5];
  const n = 16;
  const valleys = Array.from({ length: n }, (_, i) => onEll(c, rx - 0.5, ry - 0.4, -90 + 11.25 + (i * 360) / n));
  const S = scallopSamples(valleys, 0.5);
  const v = (x) => line(crossX(S, x)[0], crossX(S, x).at(-1));
  const h = (y) => line(crossY(S, y)[0], crossY(S, y).at(-1));
  const dish = `M4.35 11.75L6 16.75C7.25 18.75 9.5 19.75 12 19.75S16.75 18.75 18 16.75L19.65 11.75`;
  add('pie', ['pay', 'tarta', 'pastel de frutas', 'pie', 'apple pie', 'bakery'], [scallop(valleys, 0.5), v(9.25), v(14.75), h(8.1), h(11.1), dish]);
}

// Tart: a shallow shell in three-quarter view, its low straight side fluted, berries on its open
// top.
{
  const [c, rx, ry] = [[12, 10.25], 9.25, 5];
  const outline = `M2.75 10.25${tail(ellUp(c, rx, ry))}V13.75${reverseLow([12, 13.75], rx, ry)}Z`;
  const flutes = [7.5, 10.5, 13.5, 16.5].map((x) => {
    const dy = ry * Math.sqrt(1 - ((x - 12) / rx) ** 2);
    return line([x, 10.25 + dy], [x, 13.75 + dy]);
  });
  add('tart', ['tarta', 'tartaleta', 'pay de frutas', 'tart', 'fruit tart', 'quiche'], [outline, ellLow(c, rx, ry), ...flutes, dot(8.25, 9.5), dot(12.25, 11.25), dot(15.25, 8.25)]);
}

// Slice of cake: a wedge in three-quarter view, its tip to the left; the frosted top, a layer of
// cream along its side, and a cherry sitting on the back edge of the top (the top is too thin to
// hold one inside it): the outline rounds its top half, its lower half lies on the frosting.
{
  const [tip, BL, BR, BRb, TIPb] = [[2.75, 12.25], [15, 5.5], [21.25, 9], [21.25, 17.5], [2.75, 20.75]];
  const u = unit(sub(BR, BL));
  const cc = lerp(BL, BR, 0.45);
  const r = 1.75;
  const [P1, P2] = [add2(cc, mul(u, -r)), add2(cc, mul(u, r))];
  const R = halfChord(P1, P2);
  const wedge = `${roundline([P2, BR, BRb, TIPb, tip, BL, P1], [0, 1, 1.25, 1, 0.75, 1, 0])}A${R} ${R} 0 0 1 ${pt(P2)}Z`;
  const cherry = `M${pt(P1)}A${R} ${R} 0 0 0 ${pt(P2)}`;
  add('cake-slice', ['rebanada de pastel', 'pastel', 'postre', 'cake slice', 'piece of cake', 'dessert'], [wedge, line(tip, BR), line([2.75, 16.5], [21.25, 13.25]), cherry]);
}

// Flan: a truncated cone standing on the plate, the caramel running from its top in two drips.
{
  const cone = roundline([[4.75, 19.5], [7.75, 6.75], [16.25, 6.75], [19.25, 19.5]], [0, 1.75, 1.75, 0]);
  const caramel = `M6.95 10.25H8.25C9 10.25 9.25 10.75 9.25 11.5V12.75A1.25 1.25 0 0 0 11.75 12.75V11.25C11.75 10.6 12.1 10.25 12.75 10.25H13.5C14.1 10.25 14.5 10.6 14.5 11.25V14A1.25 1.25 0 0 0 17 14V10.25`;
  add('flan', ['flan', 'pudín', 'postre', 'flan', 'custard', 'creme caramel'], [cone, caramel, line([2.75, 19.5], [21.25, 19.5])]);
}

// Gingerbread: the figure in one outline (round head, arms out, legs apart), icing zigzags at the
// wrists and two buttons.
{
  const [hc, hr] = [[12, 5.5], 3.25];
  const nx = 1.6;
  const ny = hc[1] + Math.sqrt(hr * hr - nx * nx);
  const half = [[12 + nx, ny], [15, 9.75], [21.25, 9.75], [21.25, 13.5], [15.75, 13.5], [18.75, 21.25], [14.5, 21.25], [12, 17.5]];
  const rr = [0, 0.75, 1.85, 1.85, 0.75, 1.85, 1.85, 1.25];
  const mirror = (p) => [24 - p[0], p[1]];
  const pts = [...half, ...half.slice(0, -1).reverse().map(mirror)];
  const radii = [...rr, ...rr.slice(0, -1).reverse()];
  const R = f(hr);
  const body = `${roundline(pts, radii)}A${R} ${R} 0 1 1 ${pt(half[0])}Z`;
  const zig = (x, s) => line([x, 9.75], [x + s, 11], [x, 12.25], [x + s, 13.5]);
  add('gingerbread', ['galleta de jengibre', 'hombre de jengibre', 'navidad', 'gingerbread', 'gingerbread man', 'cookie'], [body, zig(17.25, 1), zig(6.75, -1), dot(12, 11.25), dot(12, 15)]);
}

// ── Eggs ──────────────────────────────────────────────────────────────────────────────────────
// One egg for the family: two half ellipses on one width, the top one taller (the narrow end).
const egg = ([cx, cy], w, top, bottom) => `M${pt([cx - w, cy])}A${f(w)} ${f(top)} 0 0 1 ${pt([cx + w, cy])}A${f(w)} ${f(bottom)} 0 0 1 ${pt([cx - w, cy])}Z`;
const EGG = egg([12, 14], 6.75, 11.25, 7.25);
add('egg', ['huevo', 'huevos', 'desayuno', 'proteína', 'egg', 'eggs', 'breakfast'], [EGG]);

// Fried egg, from above: a soft, uneven pool of white and the yolk set off its middle.
{
  const R = [8.5, 9.25, 7.9, 9.1, 8.1, 9.25, 7.75];
  const white = smooth(R.map((r, i) => polar(12, 12, r, -80 + (i * 360) / R.length)), true);
  add('egg-fried', ['huevo frito', 'huevo estrellado', 'desayuno', 'fried egg', 'sunny side up', 'brunch'], [white, circ(10.75, 11.25, 3.5)]);
}

// Cracked egg: the egg cut by a zigzag; its top lifted and tipped back about the crack's left end.
{
  const [c, w, top, bottom] = [[12.25, 15.5], 5.5, 9, 5.5];
  const yc = 13.25;
  const xAt = (y) => w * Math.sqrt(1 - ((c[1] - y) / top) ** 2);
  const L = [c[0] - xAt(yc), yc];
  const R = [c[0] + xAt(yc), yc];
  const halves = (zig) => {
    const crack = zig.slice(1).map(pt).join('L');
    const base = `M${pt(L)}L${crack}A${f(w)} ${f(top)} 0 0 1 ${pt([c[0] + w, c[1]])}A${f(w)} ${f(bottom)} 0 0 1 ${pt([c[0] - w, c[1]])}A${f(w)} ${f(top)} 0 0 1 ${pt(L)}Z`;
    const cap = `M${pt(L)}A${f(w)} ${f(top)} 0 0 1 ${pt(R)}L${zig.slice(0, -1).reverse().map(pt).join('L')}Z`;
    // The cap turns -22° about the crack's left end and rises
    return [base, turnAbout(cap, -22, L, [-0.25, -2.6])];
  };
  add('egg-cracked', ['huevo roto', 'cascar huevo', 'hornear', 'empezar a cocinar', 'cracked egg', 'baking', 'hatch'], halves([L, [8.5, 14.3], [10.4, 12.25], [12.3, 14.3], [14.2, 12.25], [16.1, 14.3], R]));
  // At 16 px, three teeth instead of five
  KEEP['egg-cracked'] = halves([L, [9.25, 14.75], [12.25, 11.75], [15.25, 14.75], R]);
}

// Boiled egg, halved lengthwise and seen front on: the egg and the round yolk in its wide part.
add('egg-boiled', ['huevo cocido', 'huevo duro', 'ensalada', 'proteína', 'boiled egg', 'hard-boiled egg', 'protein'], [EGG, circ(12, 14.5, 3.75)]);

// Egg carton: the tray's front with the signature corner and three eggs standing in a row in it
// (one stroke, the eggs meeting on its rim).
add('egg-carton', ['cartón de huevos', 'huevos', 'lácteos', 'súper', 'egg carton', 'eggs', 'dairy aisle'], [
  roundpoly([[3.25, 12], [20.75, 12], [19.25, 20.5], [4.75, 20.5]], [0.5, 0.5, 0, 1.75]),
  `M4.25 12${[4.25, 9.25, 14.25].map((x) => `A2.5 5.25 0 0 1 ${pt([x + 5, 12])}`).join('')}`,
]);

// ── Cheese and dairy ──────────────────────────────────────────────────────────────────────────
// Cheese wedge: its thin end to the left, the top face and the tall front face; one hole in the
// face and two bitten into its edges.
{
  const [tip, BL, BR, BRb, TIPb] = [[2.75, 11.25], [15, 4.5], [21.25, 8.25], [21.25, 18], [2.75, 20.75]];
  const bite = (a, b, t, r) => {
    const u = unit(sub(b, a));
    const c = lerp(a, b, t);
    return [add2(c, mul(u, -r)), add2(c, mul(u, r))];
  };
  const [B1, B2] = bite(BRb, TIPb, 0.72, 1.6);
  const [R1, R2] = bite(BR, BRb, 0.52, 1.6);
  const wedge = `${roundline([B2, TIPb, tip, BL, BR, R1], [0, 1, 0.75, 1, 1, 0])}${arcS(R1, R2, -1.6)}${tail(roundline([R2, BRb, B1], [0, 1.25, 0]))}${arcS(B1, B2, -1.6)}Z`;
  add('cheese', ['queso', 'lácteos', 'salchichonería', 'cheese', 'cheese wedge', 'dairy'], [wedge, line(tip, BR), circ(11.75, 14.75, 2)]);
}

// Cheese wheel: a drum in three-quarter view with a wedge cut from its front: the top with the
// notch, the drum's sides, and the notch's two walls meeting at the center.
{
  const [c, rx, ry, h] = [[12, 8.25], 9.25, 4.5, 7];
  const [a0, a1] = [28, 80];
  const A = onEll(c, rx, ry, a0);
  const B = onEll(c, rx, ry, a1);
  const down = (p) => [p[0], p[1] + h];
  const top = `M${pt(B)}A${f(rx)} ${f(ry)} 0 1 1 ${pt(A)}L${pt(c)}Z`;
  const leftSide = `M${pt([c[0] - rx, c[1]])}V${f(c[1] + h)}A${f(rx)} ${f(ry)} 0 0 0 ${pt(down(B))}V${f(B[1])}`;
  const rightSide = `M${pt(A)}V${f(A[1] + h)}A${f(rx)} ${f(ry)} 0 0 0 ${pt([c[0] + rx, c[1] + h])}V${f(c[1])}`;
  KEEP['cheese-wheel'] = {
    whole: `M${pt([c[0] - rx, c[1]])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([c[0] + rx, c[1]])}V${f(c[1] + h)}A${f(rx)} ${f(ry)} 0 0 1 ${pt(down(A))}L${pt(down(c))}L${pt(down(B))}A${f(rx)} ${f(ry)} 0 0 1 ${pt([c[0] - rx, c[1] + h])}Z`,
    // One cut along the top's front and the notch's rim (the notch's walls stay one solid)
    edges: [`M${pt(onEll(c, rx, ry, 150))}A${f(rx)} ${f(ry)} 0 0 0 ${pt(B)}L${pt(c)}L${pt(lerp(A, c, 1.4 / len(sub(A, c))))}`],
  };
  add('cheese-wheel', ['rueda de queso', 'quesería', 'salchichonería', 'cheese wheel', 'cheesemonger', 'deli'], [
    top,
    leftSide,
    rightSide,
    line(down(B), down(c), down(A)),
    line(c, down(c)),
  ]);
}

// Slice of cheese: a square slice with the wedge's holes, one bitten into its top edge, one into its
// right edge and two through it; each 3 clear of the others and of the edges.
{
  const [T1, T2, R1, R2] = [[10.25, 3.25], [13.75, 3.25], [20.75, 12.25], [20.75, 15.75]];
  const slice = `${roundline([T2, [20.75, 3.25], R1], [0, 3, 0])}${arcS(R1, R2, -1.75)}${tail(roundline([R2, [20.75, 20.75], [3.25, 20.75], [3.25, 3.25], T1], [0, 3, 3, 3, 0]))}${arcS(T1, T2, -1.75)}Z`;
  add('cheese-slice', ['rebanada de queso', 'queso amarillo', 'sándwich', 'cheese slice', 'sliced cheese', 'burger'], [slice, circ(8.75, 9.5, 2.25), circ(13.25, 15.75, 1.75)]);
}

// Butter: a block in three-quarter view sitting on a shallow oval dish; the dish's back runs behind
// the block and shows only beside it.
{
  const block = roundpoly([[7, 16.25], [7, 10.75], [9.5, 8.75], [17, 8.75], [17, 14.25], [14.5, 16.25]], [0.75, 0.6, 0.75, 0.75, 0.6, 0.75]);
  const edges = roundline([[7, 10.75], [14.5, 10.75], [17, 8.75]], [0, 0.5, 0]);
  const [c, rx, ry] = [[12, 15], 9.25, 4.5];
  add('butter', ['mantequilla', 'margarina', 'lácteos', 'hornear', 'butter', 'margarine', 'spread'], [
    ellLow(c, rx, ry),
    ...behind(ellUp(c, rx, ry), [block]),
    block,
    edges,
    line([14.5, 10.75], [14.5, 16.25]),
  ]);
}

// Yogurt: a short tub tapering to its base (the signature corner), the band of its rim, and its
// foil lid peeled back from the right, standing up behind it.
{
  const tub = roundpoly([[4.75, 11.25], [19.25, 11.25], [17.75, 21.25], [6.25, 21.25]], [0.75, 0.75, 0, 1.75]);
  const Lf = frame([19.25, 11.25], -140);
  const foil = roundpoly([Lf(0.75, -0.5), Lf(9.75, -0.5), Lf(9.75, 2), Lf(0.75, 2)], [0.5, 1, 1, 0.5]);
  add('yogurt', ['yogur', 'yogurt', 'lácteos', 'colación', 'yogurt', 'yoghurt', 'dairy'], [tub, line([5.2, 14.25], [18.8, 14.25]), ...behind(foil, [tub])]);
}

// ── Meat and poultry ──────────────────────────────────────────────────────────────────────────
// Steak: a slab wider than it is tall, the band of fat along its left, and the round of its bone.
{
  const slab = smooth([[2.75, 12], [4.5, 7], [10, 5], [16, 5], [20.5, 7.75], [21.25, 12.75], [17.75, 17.5], [11.25, 19.25], [5, 17.5]], true);
  const S = trace(slab);
  const a = hit(S, [8, 8], [-0.25, -1]);
  const b = hit(S, [8, 16], [0.4, 1]);
  const fat = `M${pt(a)}C${pt(add2(a, [-2.75, 2.75]))} ${pt(add2(b, [-3.25, -3]))} ${pt(b)}`;
  add('steak', ['carne', 'bistec', 'corte', 'parrilla', 'steak', 'beef', 'grill'], [slab, fat, circ(15.25, 10.75, 2.25)]);
}

/**
 * A bone's end in a local frame L: its shaft (half-width w) from u0 out to two knuckles, circles of
 * radius r at (u1, ±s); an open path from (u0, -w) round the knuckles to (u0, w).
 */
function boneEnd(L, u0, u1, w, s, r) {
  const ua = u1 - Math.sqrt(r * r - (s - w) ** 2);
  const X = [u1 + Math.sqrt(r * r - s * s), 0];
  const a0 = ang([u1, -s], [ua, -w]);
  const a1 = ang([u1, -s], X) + 360;
  const R = f(r);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${pt(L(u0, -w))}L${pt(L(ua, -w))}A${R} ${R} 0 ${large} 1 ${pt(L(...X))}A${R} ${R} 0 ${large} 1 ${pt(L(ua, w))}L${pt(L(u0, w))}`;
}
/** An ellipse in a local frame L (center (cu, cv), semi-axes ru along u and rv along v). */
function ellL(L, [cu, cv], ru, rv) {
  const P = (x, y) => pt(L(cu + x, cv + y));
  return `M${P(ru, 0)}C${P(ru, K * rv)} ${P(K * ru, rv)} ${P(0, rv)}C${P(-K * ru, rv)} ${P(-ru, K * rv)} ${P(-ru, 0)}C${P(-ru, -K * rv)} ${P(-K * ru, -rv)} ${P(0, -rv)}C${P(K * ru, -rv)} ${P(ru, -K * rv)} ${P(ru, 0)}Z`;
}
/** A cubic in a local frame L, from the current point: three (u, v) points. */
const cL = (L, a, b, c) => `C${pt(L(...a))} ${pt(L(...b))} ${pt(L(...c))}`;

// Ham: a leg on the diagonal, its wide end cut flat to show a round face with the bone in it, the
// narrow end running out to the bone's knuckles.
{
  const L = frame([7.25, 16.75], -45);
  const face = ellL(L, [0, 0], 3.6, 5.25);
  const body = `M${pt(L(0, -5.25))}${cL(L, [3, -6.75], [8, -3.75], [10.75, -1.75])}L${pt(L(10.75, 1.75))}${cL(L, [8, 3.75], [3, 6.75], [0, 5.25])}`;
  KEEP.ham = { seam: `M${pt(L(0.6, -5.2))}A3.6 5.25 -45 0 1 ${pt(L(0.6, 5.2))}` };
  add('ham', ['jamón', 'pierna', 'cerdo', 'salchichonería', 'ham', 'gammon', 'roast'], [body, face, dot(...L(0, 0)), boneEnd(L, 10.75, 13.9, 1.15, 1.4, 1.45)]);
}

// Drumstick: a round of meat tapering along the diagonal to the bone, which ends in two knuckles.
{
  const L = frame([8.5, 8.5], 45);
  const r = 6;
  const P1 = [8.75, -1.6];
  const t = (P, side) => {
    const d = len(P);
    const a = Math.atan2(P[1], P[0]) + side * Math.acos(r / d);
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const T1 = t(P1, -1);
  const T2 = t([8.75, 1.6], 1);
  const meat = `M${pt(L(...P1))}L${pt(L(...T1))}A${f(r)} ${f(r)} 0 1 0 ${pt(L(...T2))}L${pt(L(8.75, 1.6))}Z`;
  add('drumstick', ['pierna de pollo', 'muslo', 'pollo frito', 'aves', 'drumstick', 'chicken leg', 'poultry'], [meat, boneEnd(L, 8.75, 12.25, 1.15, 1.4, 1.45)]);
}

// Bacon: a strip on the diagonal with waving edges, and two waving bands of fat along it.
{
  const L = frame([12, 12], -40);
  const run = (v) => {
    const pts = Array.from({ length: 17 }, (_, i) => {
      const u = -9.25 + (18.5 * i) / 16;
      return L(u, v + 1.1 * Math.sin((u / 9.25) * Math.PI * 2));
    });
    return pts;
  };
  const shortRun = (v) => smooth(run(v).slice(1, -1));
  KEEP.bacon = [shortRun(-1.43), shortRun(1.43)];
  const top = run(-4.3);
  const bot = run(4.3).reverse();
  const strip = `${smooth(top)}L${pt(bot[0])}${tail(smooth(bot))}Z`;
  KEEP.bacon.strip = strip;
  KEEP.bacon.mid = shortRun(0);
  add('bacon', ['tocino', 'tocineta', 'desayuno', 'cerdo', 'bacon', 'breakfast', 'pork'], [strip, smooth(run(-1.43)), smooth(run(1.43))]);
}

// Sausages: two plump links on one gentle curve along the diagonal, their facing ends tied by the
// casing's twist.
{
  const [C, R, w, span] = [[21.5, 21.5], 15.5, 2.75, 21];
  const link = (a0, a1) => {
    const [o0, o1, i1, i0] = [polar(...C, R + w, a0), polar(...C, R + w, a1), polar(...C, R - w, a1), polar(...C, R - w, a0)];
    const W = halfChord(o1, i1);
    const sw = a1 > a0 ? 1 : 0;
    return `M${pt(o0)}A${f(R + w)} ${f(R + w)} 0 0 ${sw} ${pt(o1)}A${W} ${W} 0 0 ${sw} ${pt(i1)}A${f(R - w)} ${f(R - w)} 0 0 ${1 - sw} ${pt(i0)}A${W} ${W} 0 0 ${sw} ${pt(o0)}Z`;
  };
  // The facing ends stop with room for the twist, 2.25 between their tips
  const mid = 225;
  const d = ((1.125 + w) / R) * (180 / Math.PI);
  const tip = (a, dir) => add2(polar(...C, R, a), mul([Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180)], dir * w));
  add('sausage', ['salchicha', 'chorizo', 'embutido', 'parrilla', 'sausage', 'sausages', 'chorizo'], [link(mid - d - span, mid - d), link(mid + d, mid + d + span), line(tip(mid - d, -1), tip(mid + d, 1))]);
}

// Salami: a log on the diagonal cut at a slant, and a round slice standing beside it, two specks of
// fat across it.
{
  const L = frame([9.5, 7.5], -35);
  const [u0, u1, w] = [-4.5, 2, 3.5];
  const R = halfChord(L(u0, -w), L(u0, w));
  const log = `M${pt(L(u1, -w))}L${pt(L(u0, -w))}A${R} ${R} 0 0 0 ${pt(L(u0, w))}L${pt(L(u1, w))}`;
  add('salami', ['salami', 'embutido', 'carnes frías', 'charcutería', 'salami', 'cold cuts', 'charcuterie'], [log, ellL(L, [u1, 0], 2.1, w), circ(16.25, 16.25, 5), dot(14.5, 15, 0.3), dot(17.75, 14.25, 0.3), dot(16.75, 18, 0.3), dot(14.25, 17.75, 0.3)]);
}

// Ribs: a rack seen at a slant, its slab a rounded parallelogram, the rounded tips of three bones
// standing out of its lower edge along the slant and the lines between the ribs running up it.
{
  const k = 3.5 / 10.5;
  const slab = roundpoly([[6.25, 4.75], [21.25, 4.75], [17.75, 15.25], [2.75, 15.25]], [2.5, 1.5, 2.5, 1.5]);
  const tip = (x) => `M${f(x - 1.25)} 15.25L${f(x - 1.25 - k * 3.25)} 18.5A1.25 1.25 0 0 0 ${f(x + 1.25 - k * 3.25)} 18.5L${f(x + 1.25)} 15.25`;
  add('ribs', ['costillas', 'barbacoa', 'asado', 'ahumado', 'ribs', 'barbecue', 'smokehouse'], [slab, tip(6.75), tip(11.75), tip(16.75), line([9.25 + k * 10.5, 4.75], [9.25, 15.25]), line([14.25 + k * 10.5, 4.75], [14.25, 15.25])]);
}

// Chop: a cutlet rounded on one side and narrowing to the other, the band of fat along its top and
// the frenched bone running straight out of its narrow end.
{
  const L = frame([9.75, 13.5], -35);
  const meat = smooth([[-7, 0.5], [-5, -4.75], [1, -5.75], [6.25, -2.75], [7.25, 1.5], [2.5, 5], [-3.75, 5.5]].map((p) => L(...p)), true);
  const S = trace(meat);
  const ends = [-1.15, 1.15].map((v) => hit(S, L(4, v), sub(L(5, v), L(4, v))));
  const R = halfChord(L(12.5, -1.15), L(12.5, 1.15));
  const bone = `M${pt(ends[0])}L${pt(L(12.5, -1.15))}A${R} ${R} 0 0 1 ${pt(L(12.5, 1.15))}L${pt(ends[1])}`;
  const a = hit(S, L(-3.5, -1), sub(L(-4.5, 0), L(-3.5, -1)));
  const b = hit(S, L(3.25, -1.5), sub(L(3.75, -2.5), L(3.25, -1.5)));
  const fat = `M${pt(a)}C${pt(L(-4, -3))} ${pt(L(1, -3.4))} ${pt(b)}`;
  add('pork-chop', ['chuleta', 'chuleta de cerdo', 'costilla de cordero', 'pork chop', 'lamb chop', 'cutlet'], [meat, fat, bone]);
}

// Roast chicken, from the side: the plump body on the platter and the drumstick raised at its tail
// end, a round of meat and a bone with its knuckles; the body's outline runs behind it.
{
  const body = `M2.75 19.25C2.75 12.75 6.75 8.75 11.75 8.75C16.75 8.75 20.25 12.5 21 19.25`;
  const L = frame([14.5, 13.75], -52);
  const r = 2.9;
  const P = [4.5, 1.05];
  const a = Math.atan2(-P[1], P[0]) - Math.acos(r / len(P));
  const b = Math.atan2(P[1], P[0]) + Math.acos(r / len(P));
  const meat = `M${pt(L(P[0], -P[1]))}L${pt(L(r * Math.cos(a), r * Math.sin(a)))}A${f(r)} ${f(r)} 0 1 0 ${pt(L(r * Math.cos(b), r * Math.sin(b)))}L${pt(L(...P))}Z`;
  const bone = boneEnd(L, P[0], 7.6, 1.15, 1.4, 1.45);
  KEEP['roast-chicken'] = { body: `${body}Z` };
  add('roast-chicken', ['pollo rostizado', 'pavo', 'cena', 'navidad', 'roast chicken', 'turkey', 'rotisserie'], [...behind(body, [meat, bone]), line([2.75, 19.25], [21.25, 19.25]), meat, bone]);
}

// Skewer: a stick on the diagonal threaded with three chunks, square, round, square; the stick
// shows only between them.
{
  const L = frame([12, 12], -45);
  const hs = 2.6;
  const sqL = (u) => roundpoly([L(u - hs, -hs), L(u + hs, -hs), L(u + hs, hs), L(u - hs, hs)], 1);
  const cr = 2.75;
  const g = 7.6;
  add('skewer', ['brocheta', 'kebab', 'pincho', 'satay', 'skewer', 'kebab', 'yakitori'], [
    sqL(-g),
    circ(...L(0, 0), cr),
    sqL(g),
    line(L(-12.6, 0), L(-g - hs, 0)),
    line(L(-g + hs, 0), L(-cr, 0)),
    line(L(cr, 0), L(g - hs, 0)),
    line(L(g + hs, 0), L(12.6, 0)),
  ]);
}

// Shawarma: the spit, the rod running through a cone of meat stacked in layers that bulge and
// narrow downward, one layer every 3.25.
{
  const ys = [5.25, 8.5, 11.75, 15, 18];
  const half = [9.25, 8.25, 6.75, 5.25, 3.5];
  const R = ys.map((y, i) => [12 + half[i], y]);
  const Lt = ys.map((y, i) => [12 - half[i], y]).reverse();
  const cone = `M${pt(Lt.at(-1))}L${pt(R[0])}${R.slice(1).map((p, i) => arcS(R[i], p, 0.6)).join('')}L${pt(Lt[0])}${Lt.slice(1).map((p, i) => arcS(Lt[i], p, 0.6)).join('')}Z`;
  add('shawarma', ['trompo', 'al pastor', 'shawarma', 'doner', 'shawarma', 'gyro', 'doner kebab'], [
    cone,
    ...[1, 2, 3].map((i) => line([12 - half[i], ys[i]], [12 + half[i], ys[i]])),
    line([12, 2.75], [12, 5.25]),
    line([12, 18], [12, 21.25]),
  ]);
}

// ── Seafood ───────────────────────────────────────────────────────────────────────────────────
// Fish dish: lugares' fish lying on an oval platter, whose back rim runs behind it.
{
  const fish = lugares.icons.fish.d;
  const [body, tail] = xfs(fish.slice(0, 2), 0.8, [12.25, 12], -0.5, -1);
  // The eye keeps the set's dot, set in from the scaled head so it stays clear of it at every weight
  const eye = dot(7.95, 9.8);
  const [c, rx, ry] = [[12, 16.5], 9.25, 3.75];
  add('fish-plate', ['pescado', 'platillo de pescado', 'mariscos', 'fish dish', 'fish of the day', 'seafood'], [
    ellLow(c, rx, ry),
    ...behind(ellUp(c, rx, ry), [body, tail]),
    body,
    tail,
    eye,
  ]);
  KEEP['fish-plate'] = { plate: ell(c, rx, ry) };
}

// Fish fillet: a fillet on the diagonal, rounded at its thick end and tapering to the tail, three
// curved bands of fat across it.
{
  const L = frame([11.75, 12.5], -35);
  const S0 = [[-9.25, 0], [-7.75, -4], [-3, -5.5], [3, -4.25], [8.75, -1.6], [10, 0], [8.75, 1.6], [3, 4], [-3, 5.25], [-7.75, 4]];
  const fillet = smooth(S0.map((p) => L(...p)), true);
  const S = trace(fillet);
  const band = (u) => {
    const a = hit(S, L(u, 0), sub(L(u, -1), L(u, 0)));
    const b = hit(S, L(u, 0), sub(L(u, 1), L(u, 0)));
    return `M${pt(a)}Q${pt(L(u + 2.25, 0))} ${pt(b)}`;
  };
  add('fish-fillet', ['filete de pescado', 'salmón', 'pescadería', 'fish fillet', 'salmon', 'fish counter'], [fillet, band(-5), band(-1), band(3)]);
}

// Shrimp: the body curled in a C, thick at the head and narrowing to the tail, the segment lines
// across its back and a fan tail opening from its end.
{
  const c = [12.75, 11.25];
  const w = (a) => 3 - (1.4 * (-45 - a)) / 210;
  const as = Array.from({ length: 15 }, (_, i) => -45 - (i * 210) / 14);
  const O = as.map((a) => polar(...c, 6 + w(a), a));
  const I = as.map((a) => polar(...c, 6 - w(a), a));
  const head = halfChord(O[0], I[0]);
  const body = `M${pt(I[0])}A${head} ${head} 0 0 0 ${pt(O[0])}${tail(smooth(O))}L${pt(I.at(-1))}${tail(smooth(I.slice().reverse()))}Z`;
  const [E0, E1] = [O.at(-1), I.at(-1)];
  const fan = roundline([E0, add2(E0, [3.25, 2.25]), add2(lerp(E0, E1, 0.5), [3.25, 0.4]), add2(E1, [3.75, -0.6]), E1], [0, 0.8, 0.5, 0.8, 0]);
  const segs = [-100, -140, -180, -220].map((a) => line(polar(...c, 6 - w(a), a), polar(...c, 6 + w(a), a)));
  add('shrimp', ['camarón', 'gamba', 'mariscos', 'shrimp', 'prawn', 'seafood'], [body, fan, ...segs]);
}

// Sushi: two maki rolls of one size in three-quarter view, each the rice's top with the filling at
// its center and the nori wrapped round its side; the back roll runs behind the front one.
{
  const maki = (c, rx, ry, h) => ({
    top: ell(c, rx, ry),
    side: `M${pt([c[0] - rx, c[1]])}V${f(c[1] + h)}${tail(ellLow([c[0], c[1] + h], rx, ry))}V${f(c[1])}`,
    shape: `M${pt([c[0] - rx, c[1]])}${tail(ellUp(c, rx, ry))}V${f(c[1] + h)}${reverseLow([c[0], c[1] + h], rx, ry)}Z`,
    filling: dot(...c),
  });
  const front = maki([15.75, 13], 5.25, 3.6, 4);
  const back = maki([8.25, 7.75], 5.25, 3.6, 4);
  add('sushi', ['sushi', 'maki', 'comida japonesa', 'sushi', 'maki', 'sushi bar'], [
    front.top,
    front.side,
    front.filling,
    ...behind(back.top, [front.shape]),
    ...behind(back.side, [front.shape]),
    back.filling,
  ]);
  KEEP.sushi = { front: front.shape };
}

// Nigiri: a slab of fish lying over a block of rice and overhanging it, three stripes slanting
// across the fish.
{
  const fish = sq(2.75, 6, 18.5, 6.5, 3.25);
  const rice = sq(4.25, 9.5, 15.5, 9, 3);
  const F = trace(fish);
  const ends = (x) => [hit(F, [x, 9.25], [0.5, -1]), hit(F, [x, 9.25], [-0.5, 1])];
  const stripe = (x) => line(...ends(x));
  add('nigiri', ['nigiri', 'sashimi', 'sushi', 'nigiri', 'sushi', 'sashimi'], [fish, ...behind(rice, [fish]), stripe(8.5), stripe(12), stripe(15.5)]);
  // Filled, the stripes stop short of the fish's lower edge, which stays a cut above the rice
  KEEP.nigiri = { rice, stripes: [8.5, 12, 15.5].map((x) => { const [a, b] = ends(x); return line(a, add2(b, mul(unit(sub(a, b)), 2.4))); }) };
}

// Onigiri: a rice ball, a rounded triangle, with its band of nori wrapping the base.
add('onigiri', ['onigiri', 'bola de arroz', 'comida japonesa', 'onigiri', 'rice ball', 'japanese snack'], [
  roundpoly([[12, 3], [21.25, 19.75], [2.75, 19.75]], [3.25, 3, 3]),
  roundline([[9, 19.75], [9, 14], [15, 14], [15, 19.75]], [0, 0.75, 0.75, 0]),
]);

// ── Fast food and dishes ──────────────────────────────────────────────────────────────────────
// The burger, one for the family: the domed top bun with three sesame seeds, the lettuce waving
// under it, the line under the patty, and the bottom bun with rounded corners. `burger(s, o, dx, dy)`
// scales it for the meal and the scan.
const BURGER = (() => {
  const shape = `M3.5 11C3.5 6.5 7.25 3.5 12 3.5S20.5 6.5 20.5 11V17A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17Z`;
  return {
    shape,
    d: [shape, wave([3.5, 11], [20.5, 11], 0.55, 6), line([3.5, 15.25], [20.5, 15.25]), dot(8.25, 7.25), dot(12, 6.25), dot(15.75, 7.25)],
  };
})();
add('burger', ['hamburguesa', 'comida rápida', 'burger', 'hamburger', 'cheeseburger', 'fast food'], BURGER.d);

// Pizza: the whole pie from above (the keyline's circle) with one slice already taken, the crust's
// edge running round inside its rim and three slices of pepperoni between the crust and the cut
// sides, 75° apart.
const PIZZA = (() => {
  const c = [12, 12];
  const [a0, a1] = [-30, 270];
  const P = (r, a) => polar(...c, r, a);
  const pie = `M${pt(c)}L${pt(P(9, a0))}A9 9 0 1 1 ${pt(P(9, a1))}Z`;
  const crust = `M${pt(P(6, a0))}A6 6 0 1 1 ${pt(P(6, a1))}`;
  return [pie, crust, ...[45, 120, 195].map((a) => dot(...P(3, a)))];
})();
add('pizza', ['pizza', 'pizzería', 'comida italiana', 'pizza', 'pizzeria', 'italian food'], PIZZA);

// Slice of pizza: a long triangle point down under the band of its crust, two slices of pepperoni.
{
  const slice = roundline([[4.75, 7.25], [12, 21.25], [19.25, 7.25]], [0, 1.5, 0]);
  const crust = capsule(2.75, 3.25, 18.5, 4);
  add('pizza-slice', ['rebanada de pizza', 'pizza', 'comida rápida', 'pizza slice', 'slice', 'fast food'], [slice, crust, dot(10, 10.5), dot(12.75, 13.5)]);
}

// Hot dog: the open bun on the diagonal and the sausage lying in it, longer than the bun, with a
// zigzag of mustard; the sausage clears the bun the way a badge does.
{
  const L = frame([12, 12], -30);
  const cap = (u0, u1, w) => {
    const R = halfChord(L(u1, -w), L(u1, w));
    return `M${pt(L(u0, -w))}L${pt(L(u1, -w))}A${R} ${R} 0 0 1 ${pt(L(u1, w))}L${pt(L(u0, w))}A${R} ${R} 0 0 1 ${pt(L(u0, -w))}Z`;
  };
  const bun = cap(-4.25, 4.25, 5.25);
  const sausage = cap(-7.75, 7.75, 2.75);
  KEEP['hot-dog'] = { bun, sausage };
  const zig = line(...Array.from({ length: 9 }, (_, i) => L(-6 + i * 1.5, i % 2 ? 0.6 : -0.6)));
  add('hot-dog', ['hot dog', 'perro caliente', 'comida rápida', 'hot dog', 'frankfurter', 'stadium food'], [bun], {
    badge: { d: [sausage, zig], knock: sausage, fill: { solid: [sausage], cut: [zig] } },
  });
}

// Fries: a carton widening upward (the signature corner), its top dipping in a curve, and five
// sticks fanning out of it.
{
  const top = (x) => [x, 9.75 + 12 * ((x - 4.25) / 15.5) * (1 - (x - 4.25) / 15.5)];
  const carton = `M4.25 9.75Q12 15.75 19.75 9.75${tail(roundline([[19.75, 9.75], [17.75, 21.25], [6.25, 21.25], [4.25, 9.75]], [0, 0, 1.5, 0]))}Z`;
  const sticks = [[6, 4.5, 5.25], [9, 8.25, 3.5], [12, 12, 2.75], [15, 15.75, 3.5], [18, 19.5, 5.25]];
  add('fries', ['papas fritas', 'papas a la francesa', 'comida rápida', 'fries', 'french fries', 'chips'], [carton, ...sticks.map(([x, xt, yt]) => line(top(x), [xt, yt]))]);
}

// Taco, standing, from the side: the folded shell a half moon, the filling scalloped along its open
// edge.
{
  const y = 10.5;
  const xs = [21.25, 18.25, 14.08, 9.92, 5.75, 2.75];
  const lettuce = xs.slice(1).map((x, i) => arcS([xs[i], y], [x, y], i === 0 || i === 4 ? -1.35 : -1.6)).join('');
  const shell = `M2.75 ${f(y)}A9.25 9.25 0 0 0 21.25 ${f(y)}${lettuce}Z`;
  add('taco', ['taco', 'tacos', 'comida mexicana', 'taco', 'tacos', 'mexican food'], [shell, `M5.75 ${f(y)}A6.25 6.25 0 0 0 18.25 ${f(y)}`].map((d) => turnPath(d, -14, [12, 13])));
}

// Burrito: the wrapped roll on the diagonal, its open end showing the filling, and its lower half
// in paper torn across in a zigzag.
const BURRITO = { L: frame([12, 12], -45), w: 4.25, end: 5.5, ru: 3 };
{
  const { L, w, end: u1, ru } = BURRITO;
  const R = halfChord(L(-8, -w), L(-8, w));
  const roll = `M${pt(L(u1, -w))}L${pt(L(-8, -w))}A${R} ${R} 0 0 0 ${pt(L(-8, w))}L${pt(L(u1, w))}`;
  const face = ellL(L, [u1, 0], ru, w);
  const tear = line(...Array.from({ length: 7 }, (_, i) => L(-1.5 + (i % 2 ? 0.9 : -0.9), -w + (i * 2 * w) / 6)));
  add('burrito', ['burrito', 'comida mexicana', 'wrap', 'burrito', 'wrap', 'mexican food'], [roll, face, tear, dot(...L(u1, 0))]);
}

// Nachos: three chips standing in a small tray, the middle one tallest, behind the two leaning out
// in front of it.
{
  const tray = roundpoly([[3, 15.25], [21, 15.25], [19, 20.75], [5, 20.75]], [1, 1, 1.5, 1.5]);
  const chip = (base0, apex, base1) => roundline([base0, apex, base1], [0, 1.25, 0]);
  const left = chip([5, 15.25], [4, 7.25], [11, 15.25]);
  const right = chip([13, 15.25], [20, 7.25], [19, 15.25]);
  const mid = chip([8, 15.25], [12, 2.75], [16, 15.25]);
  add('nachos', ['nachos', 'totopos', 'botana', 'nachos', 'tortilla chips', 'sharing'], [tray, left, right, ...behind(mid, [`${left}Z`, `${right}Z`])]);
}

// Empanada: a half moon lying on its flat side, its curved edge crimped (scalloped) and the line of
// the fold just inside it.
{
  const c = [12, 18.25];
  const [rx, ry] = [9.25, 11];
  const n = 8;
  const stops = Array.from({ length: n + 1 }, (_, i) => onEll(c, rx, ry, 180 + (i * 180) / n));
  const edge = stops.slice(1).map((p, i) => arcS(stops[i], p, 0.75)).join('');
  const pastry = `M${pt(stops[0])}${edge}Z`;
  const fold = `M${pt([c[0] - rx + 3, c[1]])}${tail(ellUp(c, rx - 3, ry - 3))}`;
  add('empanada', ['empanada', 'pastelito', 'calzone', 'empanada', 'turnover', 'hand pie'], [pastry, fold]);
}

// Sandwich: a triangular half in three-quarter view, its tip to the right: the bread's top, and on
// its cut side the lettuce waving and the line of the filling.
{
  const [TIP, BR, BL, BLb, TIPb] = [[21, 12.5], [9.25, 5.5], [3, 9.25], [3, 18.25], [21, 21.5]];
  const wedge = roundpoly([TIP, TIPb, BLb, BL, BR], [0.75, 1, 1.25, 1, 1]);
  add('sandwich', ['sándwich', 'emparedado', 'almuerzo', 'sandwich', 'deli', 'lunch'], [wedge, line(BL, TIP), wave([3, 12.25], [21, 15.5], 0.5, 6), line([3, 15.25], [21, 18.5])]);
}

// Sub: a long roll on the diagonal, split along its length: the lettuce waving in the cut and the
// line of the filling under it, both running from end to end.
{
  const L = frame([12, 12], -45);
  const [u0, u1, w] = [-6.75, 6.75, 4.25];
  const R = halfChord(L(u1, -w), L(u1, w));
  const roll = `M${pt(L(u0, -w))}L${pt(L(u1, -w))}A${R} ${R} 0 0 1 ${pt(L(u1, w))}L${pt(L(u0, w))}A${R} ${R} 0 0 1 ${pt(L(u0, -w))}Z`;
  const S = trace(roll);
  const across = (v) => [hit(S, L(0, v), sub(L(-1, v), L(0, v))), hit(S, L(0, v), sub(L(1, v), L(0, v)))];
  add('sub-sandwich', ['torta', 'baguette', 'sándwich largo', 'sub', 'hoagie', 'banh mi'], [roll, wave(...across(-0.5), 0.55, 10), line(...across(2.5))]);
}

// Dumpling: a plump crescent pouch, its tips turned up, the pleats gathered along its top edge.
{
  const pouch = `M2.75 12.25C4.5 17.5 8 19.75 12 19.75S19.5 17.5 21.25 12.25C19.25 8.5 16 6.25 12 6.25S4.75 8.5 2.75 12.25Z`;
  const S = trace(pouch);
  const pleat = (x, to) => {
    const a = hit(S, [x, 12], [0, -1]);
    return line(a, to);
  };
  add('dumpling', ['gyoza', 'dumpling', 'empanadilla', 'dim sum', 'dumpling', 'gyoza', 'pierogi'], [pouch, pleat(7.25, [8.75, 11.25]), pleat(12, [12, 10]), pleat(16.75, [15.25, 11.25])]);
}

// Bao: a round, puffy bun in three-quarter view, its pleats twisting down from the knot on top.
{
  const bun = `M3 16C3 9.75 7 5.25 12 5.25S21 9.75 21 16C21 18.25 19.5 19.75 17.25 19.75H6.75C4.5 19.75 3 18.25 3 16Z`;
  const k = [12, 5.25];
  add('bao', ['bao', 'pan al vapor', 'baozi', 'dim sum', 'bao', 'steamed bun', 'baozi'], [
    bun,
    `M${pt(k)}C10.25 7.25 7.5 8.25 6.5 12.25`,
    `M${pt(k)}C12.75 8 10.75 10.75 11.75 14.25`,
    `M${pt(k)}C14.75 6.75 17.25 8.75 17.5 12.25`,
  ]);
}

// Fast-food meal: the burger in front, and behind it a drink cup with its lid and the straw rising
// from it.
{
  const s = 0.62;
  const burger = xfs(BURGER.d.slice(0, 3), s, [12, 12], -4.25, 2.75);
  const shape = burger[0];
  const cup = roundpoly([[10.75, 7.75], [20.75, 7.75], [19.5, 21.25], [12, 21.25]], [0.5, 0.5, 0, 1.5]);
  const lid = capsule(10, 5.5, 11.5, 2.25);
  const straw = roundline([[17, 5.5], [17, 3.75], [19.5, 2.25]], [0, 1, 0]);
  add('fast-food', ['comida rápida', 'combo', 'hamburguesa y refresco', 'fast food', 'combo meal', 'junk food'], [...behind(cup, [shape]), ...behind(lid, [shape]), straw, ...burger]);
}

// Popcorn: a striped bucket widening upward (the signature corner) and a cloud of popped kernels
// heaped over its rim.
{
  const bucket = roundpoly([[4.25, 10.5], [19.75, 10.5], [17.5, 21.25], [6.5, 21.25]], [0.5, 0.5, 0, 1.5]);
  const cs = [[7, 9.5, 2.75], [9.75, 6, 2.6], [14.25, 6, 2.6], [17, 9.5, 2.75]];
  const yHit = (C, side) => [C[0] + side * Math.sqrt(C[2] ** 2 - (10.5 - C[1]) ** 2), 10.5];
  const pop = chain(cs, yHit(cs[0], -1), yHit(cs[3], 1));
  add('popcorn', ['palomitas', 'cine', 'botana', 'popcorn', 'cinema', 'movie snack'], [bucket, pop, line([9.5, 10.5], [10.25, 21.25]), line([14.5, 10.5], [13.75, 21.25])]);
}

// ── Bowls and plates ──────────────────────────────────────────────────────────────────────────
// Every dish served in a bowl stands in cocina's bowl (`bowl`: the half-round body under its straight
// rim, on a short foot), and what is in it rises over the rim. Dishes on a plate lie on fish-plate's
// oval platter, whose back rim runs behind them.
const [BOWL, FOOT] = cocina.icons.bowl.d;
const RIM = 10.25;
const PLATE = { c: [12, 16.5], rx: 9.25, ry: 3.75 };
/** The platter's front edge, and its back edge where it shows beside the dish in front. */
const platter = (fronts) => [ellLow(PLATE.c, PLATE.rx, PLATE.ry), ...behind(ellUp(PLATE.c, PLATE.rx, PLATE.ry), fronts)];
/** cocina's wisp of steam, rising from y0 to y1 at x. */
const wisp = (x, y0, y1) => {
  const k = (y0 - y1) / 4;
  return `M${f(x)} ${f(y0)}C${f(x - 0.85)} ${f(y0 - k)} ${f(x - 0.85)} ${f(y0 - 2 * k)} ${f(x)} ${f(y0 - 2 * k)}S${f(x + 0.85)} ${f(y1 + k)} ${f(x)} ${f(y1)}`;
};
/** Where the lines p + s·d and q + t·e cross. */
const cross = (p, d, q, e) => {
  const den = d[0] * e[1] - d[1] * e[0];
  const s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return add2(p, mul(d, s));
};
/** A leaf: a lens from its base to its tip, `w` at its widest. */
const leaf = (B, T, w) => {
  const c = len(sub(T, B));
  const R = f((c * c) / 4 / w / 2 + w / 2);
  return `M${pt(B)}A${R} ${R} 0 0 1 ${pt(T)}A${R} ${R} 0 0 1 ${pt(B)}Z`;
};
/**
 * The outline of a union of circles [x, y, r]: the arcs of each circle that no other covers, chained
 * clockwise (a gummy bear).
 */
function union(cs) {
  const arcs = [];
  cs.forEach((C, i) => {
    const cuts = [];
    cs.forEach((D, j) => {
      const d = Math.hypot(D[0] - C[0], D[1] - C[1]);
      if (i !== j && d < C[2] + D[2] && d > Math.abs(C[2] - D[2])) for (const p of meet(C, D)) cuts.push(ang(C, p));
    });
    cuts.sort((a, b) => a - b);
    cuts.forEach((a0, k) => {
      let a1 = cuts[(k + 1) % cuts.length];
      if (a1 <= a0) a1 += 360;
      const m = polar(C[0], C[1], C[2], (a0 + a1) / 2);
      if (!cs.some((D, j) => j !== i && Math.hypot(m[0] - D[0], m[1] - D[1]) < D[2] - 1e-6)) arcs.push({ C, a0, a1, p0: polar(C[0], C[1], C[2], a0), p1: polar(C[0], C[1], C[2], a1) });
    });
  });
  let cur = arcs[0];
  let s = `M${pt(cur.p0)}`;
  const used = new Set([0]);
  for (;;) {
    s += `A${f(cur.C[2])} ${f(cur.C[2])} 0 ${cur.a1 - cur.a0 > 180 ? 1 : 0} 1 ${pt(cur.p1)}`;
    let best = 0;
    arcs.forEach((a, k) => {
      if (len(sub(a.p0, cur.p1)) < len(sub(arcs[best].p0, cur.p1))) best = k;
    });
    if (used.has(best)) break;
    used.add(best);
    cur = arcs[best];
  }
  return `${s}Z`;
}

// Soup: the bowl, a spoon's handle rising out of it and two wisps of steam.
add('soup', ['sopa', 'caldo', 'consomé', 'entrada', 'soup', 'broth', 'starter'], [BOWL, FOOT, line([14.75, RIM], [19.25, 2.75]), wisp(7, 7.25, 2.75), wisp(10.5, 7.25, 2.75)]);

// Salad: a lettuce leaf rising from the bowl, its edge frilled and its veins fanning from its base.
{
  const n = 7;
  const stops = Array.from({ length: n + 1 }, (_, i) => onEll([12, RIM], 8.25, 6.75, 180 + (i * 180) / n));
  const frill = `M${pt(stops[0])}${stops.slice(1).map((p, i) => arcS(stops[i], p, 0.8)).join('')}`;
  const B = [12, RIM];
  add('salad', ['ensalada', 'verduras', 'lechuga', 'comida saludable', 'salad', 'greens', 'healthy food'], [
    BOWL,
    FOOT,
    frill,
    line(B, [12, 6.75]),
    `M${pt(B)}Q9.25 9.25 8.75 7.5`,
    `M${pt(B)}Q14.75 9.25 15.25 7.5`,
  ]);
}

// Cereal: two rings floating on the milk at the rim, and the spoon's handle.
add('cereal', ['cereal', 'avena', 'granola', 'desayuno', 'cereal', 'oatmeal', 'breakfast'], [BOWL, FOOT, circ(6.5, RIM - 1.85, 1.85), circ(11.5, 5.25, 1.85), line([17.75, RIM], [21.25, 3.75])]);

// Rice: a heap of rice, its outline bumpy with grains. The bowl's and the curry's.
const riceHeap = (c, rx, ry, n) => {
  const stops = Array.from({ length: n + 1 }, (_, i) => onEll(c, rx, ry, 180 + (i * 180) / n));
  return `M${pt(stops[0])}${stops.slice(1).map((p, i) => arcS(stops[i], p, 0.5)).join('')}`;
};
// Rice bowl: the heap of rice domed over the rim, three grains on it.
add('rice-bowl', ['tazón de arroz', 'arroz', 'donburi', 'arroz frito', 'rice bowl', 'rice', 'donburi'], [BOWL, FOOT, riceHeap([12, RIM], 8.5, 6.75, 9), dot(8.5, 7.25), dot(12, 6.25), dot(15.5, 7.25)]);

// Noodles: a pair of chopsticks held together over the bowl, three wavy noodles hanging from them
// into it.
{
  const [A0, A1, B0, B1] = [[6.25, 4], [21.25, 2.5], [6.25, 7], [21.25, 5.5]];
  const onB = (x) => lerp(B0, B1, (x - B0[0]) / (B1[0] - B0[0]));
  const noodle = (x) => wave(onB(x), [x, RIM], 0.5, 2);
  add('noodles', ['fideos', 'ramen', 'sopa de fideos', 'pho', 'noodles', 'ramen', 'asian food'], [BOWL, FOOT, line(A0, A1), line(B0, B1), noodle(10.5), noodle(13.5), noodle(16.5)]);
}

// Instant noodles: a tall cup tapering to its base (the signature corner), the band under its rim,
// its lid peeled back from the right and a pair of chopsticks standing in it.
{
  const top = 11.25;
  add('instant-noodles', ['sopa instantánea', 'fideos instantáneos', 'comida rápida', 'instant noodles', 'cup noodles', 'quick meal'], [
    roundpoly([[4.75, top], [19.25, top], [17.5, 21.25], [6.5, 21.25]], [0.75, 0.75, 0, 1.75]),
    line([5.28, top + 3], [18.72, top + 3]),
    line([8.5, top], [5.5, 2.75]),
    line([11.5, top], [9.75, 2.75]),
    roundline([[17.25, top], [20.5, 5.5], [17, 4]], [0, 1, 0]),
  ]);
}
// Pasta: cocina's fork lying level, its tines to the left, lifting two strands of spaghetti that hang
// from it down into the shallow dish.
{
  const dish = roundline([[2.75, 17.5], [5, 20.25], [19, 20.25], [21.25, 17.5]], [0, 1.75, 1.75, 0]);
  const fork = [`M5.75 3H9.25A3 3 0 0 1 9.25 9H5.75`, line([5.75, 6], [21.25, 6])];
  const strand = (x) => wave([x, 6 + Math.sqrt(9 - Math.max(0, x - 9.25) ** 2)], [x, 20.25], 0.6, 5);
  add('pasta', ['pasta', 'espagueti', 'comida italiana', 'pasta', 'spaghetti', 'italian food'], [dish, ...fork, strand(7.75), strand(10.75)]);
}

// Lasagna: a square portion in three-quarter view, its layers waving across the cut face.
{
  const [x0, x1, y0, y1, dx] = [3.75, 15.75, 9.25, 20.5, 4.5];
  const xr = x1 + dx;
  const block = roundpoly([[x0, y0], [x0 + dx, y0 - dx], [xr, y0 - dx], [xr, y1 - dx], [x1, y1], [x0, y1]], [0.75, 1, 1, 1, 1, 1.5]);
  add('lasagna', ['lasaña', 'pasta al horno', 'comida italiana', 'lasagna', 'baked pasta', 'italian food'], [
    block,
    roundline([[x0, y0], [x1, y0], [xr, y0 - dx]], [0, 0.5, 0]),
    line([x1, y0], [x1, y1]),
    ...[12.75, 16.75].map((y) => wave([x0, y], [x1, y], 0.45, 4)),
  ]);
}

// Omelette, from above: folded in a half moon on its round plate.
{
  const L = frame([12, 13], -20);
  const R = 5.5;
  add('omelette', ['omelette', 'tortilla de huevo', 'huevos', 'brunch', 'omelette', 'omelet', 'eggs'], [circ(12, 12, 9.25), `M${pt(L(-R, 0))}A${R} ${R} 0 0 1 ${pt(L(R, 0))}Z`]);
}

// Curry: an oval plate seen from above it, a heap of rice on its left (the rice bowl's) and the
// sauce on its right, its wavy edge against the rice and a chunk in it.
{
  const [c, rx, ry] = [[12, 14.25], 9.25, 6.75];
  const rice = `${riceHeap([8.75, 14], 5.25, 6, 6)}C12 15.15 5.5 15.15 3.5 14Z`;
  add('curry', ['curry', 'arroz al curry', 'comida india', 'comida japonesa', 'curry', 'curry rice', 'indian food'], [
    ...behind(ell(c, rx, ry), [rice]),
    rice,
    wave([14, 14], [21.25, 14.25], 0.45, 4),
    dot(15.5, 17.5),
  ]);
}

// Bento: a lunch box from above, one large compartment of rice (three grains) and two small ones.
add('bento', ['bento', 'caja de comida', 'lonchera japonesa', 'bento', 'lunch box', 'meal prep'], [
  sq(2.5, 5, 19, 14, 3.5, BR),
  line([12.5, 5], [12.5, 19]),
  line([12.5, 12], [21.5, 12]),
  dot(5.75, 9.5),
  dot(9.25, 9.5),
  dot(7.5, 13.75),
]);

// ── Sweets and ice cream ──────────────────────────────────────────────────────────────────────
// Chocolate: a bar standing up, its wrapper torn off the top in a zigzag; the exposed bar shows its
// grid of four squares.
{
  const zig = Array.from({ length: 7 }, (_, i) => [4.75 + (i * 14.5) / 6, i % 2 ? 11.25 : 12.75]);
  const wrapper = `${roundline([...zig, [19.25, 21.25], [4.75, 21.25], zig[0]], [0, 0.3, 0.3, 0.3, 0.3, 0.3, 0, 0, 2.5, 0])}Z`;
  const W = trace(wrapper);
  const yL = hit(W, [6.5, 8], [0, 1]);
  const yR = hit(W, [17.5, 8], [0, 1]);
  add('chocolate', ['chocolate', 'tableta', 'dulces', 'cacao', 'chocolate', 'chocolate bar', 'sweets'], [
    wrapper,
    roundline([yL, [6.5, 2.75], [17.5, 2.75], yR], [0, 2, 2, 0]),
    line([12, 2.75], zig[3]),
    line([6.5, 7], [17.5, 7]),
  ]);
}

// Candy: a round sweet with its wrapper twisted into a bow at each side.
add('candy', ['dulce', 'caramelo', 'golosina', 'premio', 'candy', 'sweet', 'treat'], [
  circ(12, 12, 4.5),
  roundpoly([[7.5, 12], [2.75, 7.75], [2.75, 16.25]], [0, 1.25, 1.25]),
  roundpoly([[16.5, 12], [21.25, 16.25], [21.25, 7.75]], [0, 1.25, 1.25]),
]);

// Lollipop: a disc with a spiral on a straight stick.
{
  const pts = Array.from({ length: 17 }, (_, i) => polar(12, 9, 0.5 + (2.8 * i) / 16, 180 + (360 * i) / 16));
  add('lollipop', ['paleta', 'chupetín', 'dulce', 'niños', 'lollipop', 'candy', 'kids'], [circ(12, 9, 6.25), smooth(pts), line([12, 15.25], [12, 21.25])]);
}

// Candy cane: a thick stick hooked at the top, striped across.
{
  const [cx, cy, r, w] = [11, 8, 3.75, 2];
  const [xs, bot, hookEnd] = [cx + r, 19.25, 10.5];
  const R = halfChord([xs - w, bot], [xs + w, bot]);
  const cane = `M${pt([xs - w, bot])}V${f(cy)}A${f(r - w)} ${f(r - w)} 0 0 0 ${pt([cx - r + w, cy])}V${f(hookEnd)}A${R} ${R} 0 0 1 ${pt([cx - r - w, hookEnd])}V${f(cy)}A${f(r + w)} ${f(r + w)} 0 0 1 ${pt([xs + w, cy])}V${f(bot)}A${R} ${R} 0 0 1 ${pt([xs - w, bot])}Z`;
  const stripe = (y) => line([xs - w, y + 1.5], [xs + w, y - 1.5]);
  const radial = (a) => line(polar(cx, cy, r - w, a), polar(cx, cy, r + w, a));
  add('candy-cane', ['bastón de caramelo', 'dulce navideño', 'navidad', 'candy cane', 'christmas', 'sweets'], [cane, stripe(10.25), stripe(14), stripe(17.75), radial(-45), radial(-135)]);
}

// Gummy bear: one chunky outline from circles: the head and its ears, the body, arms and legs.
add('gummy-bear', ['gomita', 'ositos de goma', 'dulces', 'niños', 'gummy bear', 'gummies', 'candy'], [
  union([[12, 7.5, 4.25], [8.4, 4.1, 1.6], [15.6, 4.1, 1.6], [12, 14.5, 4.5], [7.25, 12.25, 2], [16.75, 12.25, 2], [8.9, 18.75, 2.5], [15.1, 18.75, 2.5]]),
]);

// The cone, one for the family: its tip at the bottom, its sides rising to whatever sits on it, and
// a crosshatch of one line parallel to each side, 3 inside it.
const CONE_TIP = [12, 21.25];
function cone(top) {
  const T = trace(top);
  const dir = (x) => sub([x, 12], CONE_TIP);
  const [PL, PR] = [6.25, 17.75].map((x) => hit(T, CONE_TIP, dir(x)));
  const hatch = (P, side) => {
    const u = unit(sub(CONE_TIP, P));
    const q = add2(P, mul([-u[1] * side, u[0] * side], 3));
    const other = side > 0 ? PL : PR;
    const end = cross(q, u, CONE_TIP, sub(other, CONE_TIP));
    return line(hit(T, add2(q, mul(u, 30)), mul(u, -1)), end);
  };
  const out = [roundline([PL, CONE_TIP, PR], [0, 1, 0]), hatch(PL, -1), hatch(PR, 1)];
  // Filled, the crosshatch stops short of the cone's sides, so the cone stays one piece
  out.cut = out.slice(1).map((d) => {
    const [a, b] = d.slice(1).split('L').map((q) => q.split(' ').map(Number));
    return line(a, add2(b, mul(unit(sub(a, b)), 2.4)));
  });
  return out;
}

// Ice cream: a round scoop on the cone, its bottom edge dripping in three scallops.
{
  const [a, b] = [[5.5, 12], [18.5, 12]];
  const drips = [b, [14.17, 12], [9.83, 12], a];
  const scoop = `M${pt(a)}A6.91 6.91 0 1 1 ${pt(b)}${drips.slice(1).map((p, i) => arcS(drips[i], p, 0.9)).join('')}Z`;
  const cn = cone(scoop);
  add('ice-cream', ['helado', 'cono', 'nieve', 'postre', 'ice cream', 'gelato', 'cone'], [scoop, ...cn]);
  KEEP['ice-cream'] = { hatch: cn.cut, seam: `M${pt(b)}${drips.slice(1).map((p, i) => arcS(drips[i], p, 0.9)).join('')}` };
}

// Soft serve: three tiers of a swirl stepping in up the cone, the top curling to a point.
{
  const [L0, L1, L2] = [[5.75, 12.25], [7, 9.25], [8.5, 6.25]];
  const [R0, R1, R2] = [[18.25, 12.25], [17, 9.25], [15.5, 6.25]];
  const swirl = `M${pt(L0)}${arcS(L0, L1, 1.1)}${arcS(L1, L2, 1.1)}C8.25 3.75 10.75 2.75 13.25 2.75C14.75 3.5 15.75 4.75 ${pt(R2)}${arcS(R2, R1, 1.1)}${arcS(R1, R0, 1.1)}Z`;
  add('soft-serve', ['helado suave', 'nieve de máquina', 'yogur helado', 'soft serve', 'frozen yogurt', 'ice cream'], [swirl, `M${pt(L1)}${arcS(L1, R1, -0.75)}`, `M${pt(L2)}${arcS(L2, R2, -0.75)}`, ...cone(swirl)]);
  KEEP['soft-serve'] = { swirl, tier: `M${pt(L1)}${arcS(L1, R1, -0.75)}`, cone: cone(swirl)[0] };
}

// Ice cream in a cup: two scoops side by side over the rim of a cup (the signature corner), the
// right one in front, and a spoon's handle standing out of it.
{
  const top = 13;
  const cup = roundpoly([[4.75, top], [19.25, top], [17.25, 21.25], [6.75, 21.25]], [0.75, 0.75, 0, 1.75]);
  const [cl, cr] = [[8.75, 10.25, 3.75], [15.25, 10.25, 3.75]];
  const dy = top - cl[1];
  const dx = Math.sqrt(cl[2] ** 2 - dy ** 2);
  const scoops = chain([cl, cr], [cl[0] - dx, top], [cr[0] + dx, top]);
  const X = meet(cl, cr)[0];
  const front = `M${pt(X)}A${f(cr[2])} ${f(cr[2])} 0 0 0 ${pt([cr[0] - dx, top])}`;
  const spoon = line([14.5, 10.25], [20.75, 2.75]);
  add('ice-cream-cup', ['copa de helado', 'helado', 'sundae', 'nieve', 'ice cream cup', 'sundae', 'gelato'], [cup, ...behind(spoon, [`${scoops}Z`]), scoops, front]);
}

// Ice pop: a bar with a round top, a bite taken from its top right corner, on its stick.
{
  const [cx, cy, r] = [12, 8.5, 5.75];
  const bite = [17.5, 4, 3];
  const [P1, P2] = meet([cx, cy, r], bite).sort((p, q) => ang([cx, cy], p) - ang([cx, cy], q));
  const bar = `M6.25 14.75V${f(cy)}A${f(r)} ${f(r)} 0 0 1 ${pt(P1)}A${f(bite[2])} ${f(bite[2])} 0 0 0 ${pt(P2)}A${f(r)} ${f(r)} 0 0 1 17.75 ${f(cy)}V14.75A1.5 1.5 0 0 1 16.25 16.25H7.75A1.5 1.5 0 0 1 6.25 14.75Z`;
  add('ice-pop', ['paleta helada', 'paleta de hielo', 'helado', 'postre', 'ice pop', 'popsicle', 'paleta'], [bar, `M10.5 16.25V19.75A1.5 1.5 0 0 0 13.5 19.75V16.25`]);
}

// ── Pantry and condiments ─────────────────────────────────────────────────────────────────────
// Flour: an open sack (the signature corner) under its rolled-down rim, the flour heaped in its
// mouth.
{
  const sack = roundline([[5.5, 12.5], [4.25, 21.25], [19.75, 21.25], [18.5, 12.5]], [0, 2.5, 0, 0]);
  const rim = sq(4.25, 9.25, 15.5, 3.25, 1.6);
  const heap = `M6.5 9.25C8.75 8.25 9.75 4.75 12 4.75S15.25 8.25 17.5 9.25`;
  add('flour', ['harina', 'costal de harina', 'hornear', 'despensa', 'flour', 'baking', 'pantry'], [sack, rim, heap]);
}

// Sugar: three cubes in isometric view, two side by side and one sitting in the notch between them;
// one outline and each cube's three visible edges meeting at its near corner.
{
  const s = 5.2;
  const c = s * Math.cos(Math.PI / 6);
  const T = (x, y) => [12 + x * c, 15.9 + y * s];
  const P = [T(0, -2.5), T(1, -2), T(1, -1), T(2, -0.5), T(2, 0.5), T(1, 1), T(0, 0.5), T(-1, 1), T(-2, 0.5), T(-2, -0.5), T(-1, -1), T(-1, -2)];
  add('sugar', ['azúcar', 'terrones de azúcar', 'endulzar', 'hornear', 'sugar', 'sugar cubes', 'sweetener'], [
    roundpoly(P, [0.9, 0, 0, 0, 0.9, 0, 0, 0, 0.9, 0, 0, 0]),
    line(T(-1, -2), T(0, -1.5), T(1, -2)),
    line(T(0, -1.5), T(0, 0.5)),
    line(T(-2, -0.5), T(-1, 0), T(0, -0.5)),
    line(T(-1, 0), T(-1, 1)),
    line(T(0, -0.5), T(1, 0), T(2, -0.5)),
    line(T(1, 0), T(1, 1)),
  ]);
}

// Salt shaker: a domed cap with three holes, on a body widening to its base (the signature corner).
add('salt-shaker', ['salero', 'sal', 'sazonar', 'sal y pimienta', 'salt shaker', 'salt', 'seasoning'], [
  roundline([[7.25, 12], [6, 21.25], [18, 21.25], [16.75, 12]], [0, 2, 0, 0]),
  `M6 12V9A6 6 0 0 1 18 9V12Z`,
  dot(12, 6.25),
  dot(9.25, 9),
  dot(14.75, 9),
]);

// Spice jar: a small bottle-jar (the signature corner), its shoulders narrowing to a short neck
// under a small cap, and the band of its label.
add('spice-jar', ['especiero', 'especias', 'condimentos', 'despensa', 'spice jar', 'spices', 'seasoning'], [
  'M9.75 8.5V9.25C7 9.5 5.75 10.5 5.75 12.25V18.75A2.5 2.5 0 0 0 8.25 21.25H18.25V12.25C18.25 10.5 17 9.5 14.25 9.25V8.5',
  sq(8.25, 3.25, 7.5, 5.25, 0.75),
  line([5.75, 13.75], [18.25, 13.75]),
  line([5.75, 17.75], [18.25, 17.75]),
]);

// Cooking oil: a bottle with a long neck (the signature corner) and its pouring spout, and a drop
// of oil, lugares' droplet, falling beside it.
{
  const bottle = roundpoly([[7, 6], [9.5, 6], [9.5, 9.25], [12.25, 12.25], [12.25, 21.25], [4.25, 21.25], [4.25, 12.25], [7, 9.25]], [0.4, 0.4, 1.5, 1.75, 0, 2.25, 1.75, 1.5]);
  const spout = roundline([[8.25, 6], [8.25, 4.5], [12.5, 2.75]], [0, 1, 0]);
  const drop = xf(lugares.icons.droplet.d[0], 0.36, [12, 13.49], 5.75, -1.5);
  add('cooking-oil', ['aceite', 'aceite de oliva', 'vinagre', 'aderezo', 'cooking oil', 'olive oil', 'vinegar'], [bottle, spout, drop]);
}

// Hot sauce: a slim bottle (the signature corner) on a long narrow neck under a pointed cap, and
// lugares' flame beside its mouth.
{
  const bottle = roundpoly([[7, 7.25], [9.5, 7.25], [9.5, 10], [11.75, 12.5], [11.75, 21.25], [4.75, 21.25], [4.75, 12.5], [7, 10]], [0, 0, 1.25, 1.5, 0, 2, 1.5, 1.25]);
  const cap = roundpoly([[6.5, 7.25], [10, 7.25], [8.25, 2.75]], [0.5, 0.5, 0.75]);
  // The chili: a pod tapering down to its curled tip, its stem rising from the top
  const pod = `M14.5 9.75C14.5 8.5 15.5 7.75 17.25 7.75S20.25 8.5 20.25 9.75C20.25 14.25 19 18.5 15.25 20.5C16.75 17 14.5 13.5 14.5 9.75Z`;
  const stem = `M17.25 7.75C17.25 5.75 17.75 4.5 19.25 3.75`;
  add('hot-sauce', ['salsa picante', 'salsa', 'chile', 'picante', 'hot sauce', 'chili sauce', 'spicy'], [bottle, cap, pod, stem]);
}

// Squeeze bottle: soft shoulders (the signature corner), the band of its cap and the cone of its
// nozzle.
add('ketchup', ['cátsup', 'mostaza', 'mayonesa', 'aderezo', 'ketchup', 'mustard', 'squeeze bottle'], [
  roundpoly([[9, 10], [15, 10], [17.75, 12.75], [17.75, 21.25], [6.25, 21.25], [6.25, 12.75]], [0.5, 0.5, 2.5, 0, 2.5, 2.5]),
  roundpoly([[9, 6.75], [15, 6.75], [15, 10], [9, 10]], [0.6, 0.6, 0, 0]),
  roundpoly([[10.25, 6.75], [13.75, 6.75], [12.75, 2.75], [11.25, 2.75]], [0, 0, 0.6, 0.6]),
]);

// Dip: a small ramekin, the dip heaped over its rim, and a chip dipped into the heap.
{
  const ramekin = roundpoly([[3.5, 15.25], [20.5, 15.25], [18.75, 20.75], [5.25, 20.75]], [0.75, 0.75, 1.5, 1.5]);
  const heap = `M6 15.25C6 12.75 8.6 11.5 12 11.5S18 12.75 18 15.25`;
  const chip = roundpoly([[10, 14.5], [17.75, 2.75], [19.5, 12.75]], [1, 1.25, 1]);
  add('dip', ['dip', 'salsa', 'guacamole', 'hummus', 'dip', 'salsa', 'guacamole'], [ramekin, heap, ...behind(chip, [`${heap}Z`, ramekin])]);
}

// Honey: a dipper on the diagonal, its spindle head grooved twice, the handle rising from it and a
// drop falling from the head.
{
  const L = frame([9.5, 10.75], -45);
  const head = ellL(L, [0, 0], 4.75, 3.25);
  const H = trace(head);
  const groove = (u) => line(hit(H, L(u, 0), sub(L(u, -1), L(u, 0))), hit(H, L(u, 0), sub(L(u, 1), L(u, 0))));
  const drop = xf(lugares.icons.droplet.d[0], 0.28, [12, 13.49], -5.25, 6.25);
  add('honey', ['miel', 'cucharón de miel', 'endulzar', 'untable', 'honey', 'honey dipper', 'sweetener'], [head, groove(-1.6), groove(1.6), line(L(4.75, 0), L(12, 0)), drop]);
}

// Jam: a jar (the signature corner) with a cloth over its lid, tied round by a string and hanging in
// scallops, and a blank label band.
{
  const top = `M6.75 8C6.75 5.25 9 3.5 12 3.5S17.25 5.25 17.25 8Z`;
  const n = 4;
  const xs = Array.from({ length: n + 1 }, (_, i) => 4.75 + (i * 14.5) / n);
  const skirt = `M6.75 8L4.75 11.25${xs.slice(1).map((x, i) => arcS([xs[i], 11.25], [x, 11.25], -0.9)).join('')}L17.25 8Z`;
  const S = trace(skirt);
  const a = hit(S, [5.5, 16], [0, -1]);
  const b = hit(S, [18.5, 16], [0, -1]);
  const jar = roundline([a, [5.5, 21.25], [18.5, 21.25], b], [0, 2.75, 0, 0]);
  add('jam', ['mermelada', 'conserva', 'confitura', 'desayuno', 'jam', 'preserves', 'marmalade'], [jar, skirt, top, sq(8.5, 14.75, 7, 3.75, 1)]);
  KEEP.jam = { seam: between(`M4.75 11.25${xs.slice(1).map((x, i) => arcS([xs[i], 11.25], [x, 11.25], -0.9)).join('')}`, a, b) };
}

// Pickles: a squat jar (the signature corner) under its screw lid, and two bumpy gherkins standing
// in it.
{
  // A gherkin in a frame: its ends round, each side three bumps
  const L = frame([12, 13.75], -45);
  const [u0, u1, w] = [-3, 3, 2.2];
  const us = [u0, (2 * u0 + u1) / 3, (u0 + 2 * u1) / 3, u1];
  const R = halfChord(L(u1, -w), L(u1, w));
  const side = (v, list, sg) => list.slice(1).map((u, i) => arcS(L(list[i], v), L(u, v), sg * 0.55)).join('');
  const pickle = `M${pt(L(u0, -w))}${side(-w, us, 1)}A${R} ${R} 0 0 1 ${pt(L(u1, w))}${side(w, us.slice().reverse(), 1)}A${R} ${R} 0 0 1 ${pt(L(u0, -w))}Z`;
  add('pickles', ['pepinillos', 'encurtidos', 'conservas', 'fermentados', 'pickles', 'gherkins', 'pickled'], [
    sq(4.75, 6.25, 14.5, 15, 3.5, BR),
    sq(6.25, 2.75, 11.5, 3.5, 1.25),
    pickle,
  ]);
}

// Canned food: a squat tin in three-quarter view, the pull ring on its lid and the label's band
// round its side.
const canned = ([cx, cy] = [12, 7.5], rx = 8, h = 9) => {
  const ry = 4;
  return [ell([cx, cy], rx, ry), `M${f(cx - rx)} ${f(cy)}V${f(cy + h)}${tail(ellLow([cx, cy + h], rx, ry))}V${f(cy)}`, ellLow([cx, cy + h / 2 - 0.25], rx, ry), circ(cx, cy, 1.5)];
};
add('canned-food', ['enlatados', 'lata de comida', 'conservas', 'despensa', 'canned food', 'tin can', 'pantry'], canned());

// Snack bag: a pillow pouch, its sides bulging, sealed at the top and the bottom with serrated
// edges.
{
  const teeth = (y, x0, x1, n, dir) => Array.from({ length: n * 2 + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / (n * 2), y + (i % 2 ? dir * 0.9 : 0)]);
  const top = teeth(3.5, 5.25, 18.75, 5, -1);
  const bottom = teeth(20.5, 18.75, 5.25, 5, 1);
  const pts = [...top, [18.75, 6.5], [19.75, 12], [18.75, 17.5], ...bottom, [5.25, 17.5], [4.25, 12], [5.25, 6.5]];
  const r = pts.map((p, i) => (i < 11 || (i > 13 && i < 25) ? 0.2 : i === 12 || i === 26 ? 6 : 0.5));
  add('snack-bag', ['papitas', 'bolsa de botana', 'frituras', 'snack', 'chips', 'crisps', 'snack bag'], [roundpoly(pts, r), line([5.25, 6.5], [18.75, 6.5]), line([5.25, 17.5], [18.75, 17.5])]);
}

// Granola bar: a bar on the diagonal, its wrapper crimped at one end and torn open at the other, two
// specks of oats on the bare end.
{
  const L = frame([12, 12], -38);
  const [u0, u1, w] = [-9.75, 9.75, 3.75];
  const crimp = Array.from({ length: 7 }, (_, i) => L(u1 + (i % 2 ? 0.75 : 0), -w + (i * 2 * w) / 6));
  const bar = `${roundline([L(u1, w), L(u0, w), L(u0, -w), L(u1, -w)], [0, 1.75, 1.75, 0])}${crimp.map((p) => `L${pt(p)}`).join('')}Z`;
  const tear = line(...Array.from({ length: 6 }, (_, i) => L(1.25 + (i % 2 ? 0.75 : -0.75), -w + (i * 2 * w) / 5)));
  add('granola-bar', ['barra de granola', 'barra de cereal', 'barra de proteína', 'colación', 'granola bar', 'protein bar', 'snack'], [bar, tear, line(L(7.25, -w), L(7.25, w)), ...[[-7.25, 1], [-4.5, -1.25], [-2.25, 1.25]].map(([u, v]) => dot(...L(u, v), 0.3))]);
}

// Groceries: a paper bag (the signature corner) with its rim folded down, a baguette and a leaf
// standing out of it.
const GROCERIES = (() => {
  const bag = roundpoly([[4.25, 12.5], [19.75, 12.5], [19.75, 21.25], [4.25, 21.25]], [1, 1, 0, 2.75]);
  // The baguette leans left out of the bag, the leaf right
  const Lb = frame([10, 14.5], -108);
  const Rb = halfChord(Lb(10.5, -1.75), Lb(10.5, 1.75));
  const loaf = `M${pt(Lb(0, -1.75))}L${pt(Lb(10.5, -1.75))}A${Rb} ${Rb} 0 0 1 ${pt(Lb(10.5, 1.75))}L${pt(Lb(0, 1.75))}Z`;
  const [B, T] = [[14, 9.75], [19.75, 2.75]];
  return [bag, line([4.25, 15.5], [19.75, 15.5]), ...behind(loaf, [bag]), leaf(B, T, 2.9)];
})();
add('groceries', ['súper', 'compras', 'despensa', 'bolsa de mandado', 'groceries', 'grocery shopping', 'supermarket'], GROCERIES);

// Nutrition facts: Núcleo's document with its title, the heavy rule under it and two rows, each a
// name and its value.
const NUTRITION = (() => {
  const [card] = nucleo.icons.document.d;
  const rule = sq(8.5, 9.25, 7.4, 0.9, 0.45);
  const row = (y) => [line([8.5, y], [10.75, y]), line([13.65, y], [15.9, y])];
  return [card, line([8.5, 6.25], [13, 6.25]), rule, ...row(13.25), ...row(16.5)];
})();
add('nutrition-label', ['información nutricional', 'tabla nutrimental', 'calorías', 'etiqueta', 'nutrition facts', 'nutrition label', 'calories'], NUTRITION);

// Food scan: comercio's viewfinder framing the burger.
{
  const frameD = comercio.icons['barcode-scan'].d.slice(0, 4);
  add('food-scan', ['escanear comida', 'contar calorías', 'reconocer platillo', 'food scan', 'calorie scan', 'meal recognition'], [...frameD, ...xfs(BURGER.d.slice(0, 3), 0.6, [12, 11.5], 0, 0.5)]);
}

// The badges are the engine's
add('groceries-plus', ['agregar a la lista', 'lista del súper', 'compras', 'add to groceries', 'grocery list', 'shopping list'], GROCERIES, { badge: badge('plus') });
add('groceries-check', ['compras hechas', 'súper listo', 'mandado entregado', 'groceries bought', 'list complete', 'groceries delivered'], GROCERIES, { badge: badge('check') });
add('groceries-minus', ['quitar de la lista', 'lista del súper', 'compras', 'remove from groceries', 'grocery list', 'shopping list'], GROCERIES, { badge: badge('minus') });
// With the heart the tin steps left, so its side stays clear of the badge's cutout
add('canned-food-heart', ['donar comida', 'banco de alimentos', 'colecta', 'food donation', 'food bank', 'food drive'], canned([10, 7], 7.25, 8), { badge: badge('heart') });
// With the magnifier the label keeps its title, a shorter rule and the first row's name, so every
// end it keeps stays well clear of the badge's cutout at every weight
add('nutrition-label-search', ['buscar ingredientes', 'consultar nutrientes', 'escáner de alimentos', 'nutrition lookup', 'ingredients', 'food scanner'], [...NUTRITION.slice(0, 2), sq(8.5, 9.25, 5.25, 0.9, 0.45), line([8.5, 13.25], [10.55, 13.25])], { badge: badge('search') });

// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// By index into each icon's `d`: `solid` is filled (closed shapes only), `cut` knocked out, `lines`
// on top with a clearance, `wire` on top and attached. Holes in a solid (a donut's, a bagel's) are
// their contour drawn the other way round. See DESIGN.md › Fill.
const FILL = {
  bread: { solid: [0], cut: [1, 2, 3] },
  'bread-slice': { solid: [0], cut: [1] },
  baguette: { solid: [0], cut: [1, 2, 3] },
  croissant: { solid: [0], cut: [1, 2, 3, 4] },
  concha: { solid: [0], cut: [1, 2, 3, 4] },
  churro: { solid: [0], cut: [1] },
  'cinnamon-roll': { solid: [0], cut: [1] },
  waffle: { solid: [0], cut: [1, 2, 3, 4] },
  macaron: { solid: [0, 1], wire: [2, 3] },
  tart: { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] },
  gingerbread: { solid: [0], cut: [1, 2, 3, 4] },
  egg: { solid: [0] },
  'egg-fried': { solid: [0], cut: [1] },
  'egg-cracked': { solid: [0, 1] },
  'egg-boiled': { solid: [0], cut: [1] },
  drumstick: { solid: [0], wire: [1] },
  sausage: { solid: [0, 1], wire: [2] },
  'pork-chop': { solid: [0], cut: [1], wire: [2] },
  skewer: { solid: [0, 1, 2], wire: [3, 4, 5, 6] },
  'fish-plate': { solid: [1, 2], cut: [3], lines: [0] },
  'fish-fillet': { solid: [0], cut: [1, 2, 3] },
  onigiri: { solid: [0], cut: [1] },
  burger: { solid: [0], cut: [1, 2, 3, 4, 5] },
  pizza: { solid: [0], cut: [1, 2, 3, 4] },
  'hot-dog': { solid: [0] },
  fries: { solid: [0], wire: [1, 2, 3, 4, 5] },
  taco: { solid: [0], cut: [1] },
  empanada: { solid: [0], cut: [1] },
  'sub-sandwich': { solid: [0], cut: [1, 2] },
  dumpling: { solid: [0], cut: [1, 2, 3] },
  bao: { solid: [0], cut: [1, 2, 3] },
  'fast-food': { solid: [3], cut: [4, 5], lines: [0, 1, 2] },
  'instant-noodles': { solid: [0], cut: [1], wire: [2, 3, 4] },
  omelette: { solid: [1], wire: [0] },
  lasagna: { solid: [0], cut: [1, 2, 3, 4] },
  bento: { solid: [0], cut: [1, 2, 3, 4, 5] },
  candy: { solid: [0, 1, 2] },
  lollipop: { solid: [0], cut: [1], wire: [2] },
  'candy-cane': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'gummy-bear': { solid: [0] },
  sugar: { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'cooking-oil': { solid: [0, 2], wire: [1] },
  honey: { solid: [0, 4], cut: [1, 2], wire: [3] },
  'snack-bag': { solid: [0], cut: [1, 2] },
  'granola-bar': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'nutrition-label': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'nutrition-label-search': { solid: [0], cut: [1, 2, 3] },
  'food-scan': { solid: [4], cut: [5, 6], lines: [0, 1, 2, 3] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
// Rings: the hole is the inner contour turned the other way, so it stays paper
{
  const { d } = icons.donut;
  icons.donut.fill = { solid: [pierce(d[0], 12, 12, 3)], cut: d.slice(2) };
}
{
  const { d } = icons.bagel;
  icons.bagel.fill = { solid: [`${d[0]}${ellRev([12, 10.25], 2.75, 1.6)}`], cut: d.slice(2) };
}
// The liner is closed along the rim it hangs from; the rim stays a cut, so the top and the cup part
{
  const rim = line([4.5, 14], [19.5, 14]);
  const { d } = icons.muffin;
  icons.muffin.fill = { solid: [d[0], shut(d[1])], cut: [rim, ...d.slice(2)] };
  const c = icons.cupcake.d;
  // The frosting closes inside the cherry; the cherry's lower arc parts it from the frosting
  const dx = Math.sqrt(1.6 ** 2 - 1.25 ** 2);
  const cherryLow = `M${pt([12 - dx, 4.75])}A1.6 1.6 0 0 0 ${pt([12 + dx, 4.75])}`;
  icons.cupcake.fill = { solid: [shut(c[0]), c[1], shut(c[2])], cut: [cherryLow, line([3.25, 14], [20.75, 14]), ...c.slice(3)] };
}
// The pie's top is solid with its lattice knocked out; the dish under it stays a line
icons.pie.fill = { solid: [icons.pie.d[0]], cut: icons.pie.d.slice(1, 5), wire: [icons.pie.d[5]] };
// The flan closes along the plate, which stays a line under it
icons.flan.fill = { solid: [shut(icons.flan.d[0])], cut: [icons.flan.d[1]], wire: [icons.flan.d[2]] };
// Stacks and layers: the separators that come to curved sides stop short of them in the fill, so
// the layers keep one structure at every weight
{
  const fb = icons.flatbread.d;
  icons.flatbread.fill = { solid: [fb[0]], cut: [frontShort([12, 8.5], 9.25, 4.25, 2.25), frontShort([12, 11.5], 9.25, 4.25, 2.25), ...fb.slice(3)] };
  const pc = icons.pancakes.d;
  icons.pancakes.fill = { solid: [pc[0]], cut: [frontShort([12, 8.5], 8.75, 3.75), frontShort([12, 11.75], 8.75, 3.75), pc[3]] };
  const cs = icons['cake-slice'].d;
  // The cherry's lower arc stops short of the back edge too
  const [BL, BR] = [[15, 5.5], [21.25, 9]];
  const cc = lerp(BL, BR, 0.45);
  const a = ang(cc, BR);
  const cherry = `M${pt(polar(...cc, 1.75, a + 155))}A1.75 1.75 0 0 0 ${pt(polar(...cc, 1.75, a + 25))}`;
  icons['cake-slice'].fill = { solid: [cs[0]], cut: [short([2.75, 12.25], [21.25, 9]), short([2.75, 16.5], [21.25, 13.25]), cherry] };
}
// Eggs and dairy: the carton's eggs part from the tray along its rim; holes stay paper
{
  const ec = icons['egg-carton'].d;
  icons['egg-carton'].fill = { solid: [ec[0], shut(ec[1])], cut: [line([5.6, 12], [18.4, 12])] };
  const ch = icons.cheese.d;
  icons.cheese.fill = { solid: [pierce(ch[0], 11.75, 14.75, 2)], cut: [short([2.75, 11.25], [21.25, 8.25])] };
  const cw = KEEP['cheese-wheel'];
  icons['cheese-wheel'].fill = { solid: [cw.whole], cut: cw.edges };
  const sl = icons['cheese-slice'].d;
  icons['cheese-slice'].fill = { solid: [pierce(pierce(sl[0], 8.75, 9.5, 2.25), 13.25, 15.75, 1.75)] };
  const bu = icons.butter.d;
  icons.butter.fill = { solid: [bu.at(-3)], cut: bu.slice(-2), wire: bu.slice(0, -3) };
  const yo = icons.yogurt.d;
  icons.yogurt.fill = { solid: [yo[0]], cut: [yo[1]], lines: yo.slice(2) };
}
// Meat: bones stay white, outlines on the solid; a drumstick on the roast is drawn over it with a
// clearance
{
  const st = icons.steak.d;
  icons.steak.fill = { solid: [pierce(st[0], 15.25, 10.75, 2.25)], cut: [st[1]] };
  const hm = icons.ham.d;
  icons.ham.fill = { solid: [shut(hm[0]), hm[1]], cut: [KEEP.ham.seam, hm[2]], wire: [hm[3]] };
  const bc = icons.bacon.d;
  icons.bacon.fill = { solid: [bc[0]], cut: KEEP.bacon };
  const sa = icons.salami.d;
  icons.salami.fill = { solid: [shut(sa[0]), sa[1], sa[2]], cut: sa.slice(3) };
  const ri = icons.ribs.d;
  icons.ribs.fill = { solid: [ri[0], ...ri.slice(1, 4).map(shut)], cut: [ri[4], ri[5]] };
  const rc = icons['roast-chicken'].d;
  icons['roast-chicken'].fill = { solid: [KEEP['roast-chicken'].body], lines: rc.slice(-2) };
  const sh = icons.shawarma.d;
  icons.shawarma.fill = { solid: [sh[0]], cut: sh.slice(1, 4), wire: sh.slice(4) };
}
// Seafood and dishes: what lies on top stays solid with its details cut out; the roll behind the
// sushi and the chips behind the nachos stay lines
{
  const sh = icons.shrimp.d;
  icons.shrimp.fill = { solid: [sh[0], shut(sh[1])], cut: sh.slice(2) };
  const su = icons.sushi.d;
  icons.sushi.fill = { solid: [KEEP.sushi.front], cut: [frontShort([15.75, 13], 5.25, 3.6), su[2]], lines: su.slice(3) };
  // The rice and the fish are one solid; the fish's lower edge stays a cut that stops short of the
  // rice's sides
  const ng = icons.nigiri.d;
  icons.nigiri.fill = { solid: [ng[0], KEEP.nigiri.rice], cut: [line([6.25, 12.5], [17.75, 12.5]), ...KEEP.nigiri.stripes] };
  const ps = icons['pizza-slice'].d;
  icons['pizza-slice'].fill = { solid: [shut(ps[0]), ps[1]], cut: [line([4.75, 7.25], [19.25, 7.25]), ps[2], ps[3]] };
  const bu = icons.burrito.d;
  const { L, w, end: u1, ru } = BURRITO;
  // The face's back half, inside the roll, parts the face from the body
  const inner = `M${pt(L(u1, -w))}C${pt(L(u1 - K * ru, -w))} ${pt(L(u1 - ru, -K * w))} ${pt(L(u1 - ru, 0))}C${pt(L(u1 - ru, K * w))} ${pt(L(u1 - K * ru, w))} ${pt(L(u1, w))}`;
  icons.burrito.fill = { solid: [shut(bu[0]), bu[1]], cut: [inner, bu[2], bu[3]] };
  const na = icons.nachos.d;
  icons.nachos.fill = { solid: [na[0], shut(na[1]), shut(na[2])], cut: [line([5, 15.25], [11, 15.25]), line([13, 15.25], [19, 15.25])], lines: na.slice(3) };
  const sw = icons.sandwich.d;
  icons.sandwich.fill = { solid: [sw[0]], cut: [short([3, 9.25], [21, 12.5]), sw[2], sw[3]] };
  const pc = icons.popcorn.d;
  icons.popcorn.fill = { solid: [pc[0], shut(pc[1])], cut: [line([4.44, 10.5], [19.56, 10.5]), pc[2], pc[3]] };
  const cu = icons.curry.d;
  icons.curry.fill = { solid: [ell([12, 14.25], 9.25, 6.75)], cut: cu.slice(-3) };
  const ch = icons.chocolate.d;
  const zig = Array.from({ length: 7 }, (_, i) => [4.75 + (i * 14.5) / 6, i % 2 ? 11.25 : 12.75]);
  icons.chocolate.fill = { solid: [ch[0], shut(ch[1])], cut: [line(...zig), ch[2], ch[3]] };
  icons.pasta.fill = { solid: [shut(icons.pasta.d[0])], wire: icons.pasta.d.slice(1) };
  const sj = icons['spice-jar'].d;
  icons['spice-jar'].fill = { solid: [shut(sj[0]), sj[1]], cut: [line([8.25, 8.5], [15.75, 8.5]), sj[2], sj[3]] };
}
// Bowls: the bowl and its foot are one solid; what rises over the rim closes along it and the rim
// stays a cut
{
  const base = [BOWL, shut(FOOT)];
  const so = icons.soup.d;
  icons.soup.fill = { solid: base, wire: [so[2]], lines: [so[3], so[4]] };
  const sa = icons.salad.d;
  icons.salad.fill = { solid: [...base, shut(sa[2])], cut: [line([3.75, RIM], [20.25, RIM]), sa[3], sa[4], sa[5]] };
  const ce = icons.cereal.d;
  icons.cereal.fill = { solid: base, wire: [ce[2], ce[3], ce[4]] };
  const rb = icons['rice-bowl'].d;
  icons['rice-bowl'].fill = { solid: [...base, shut(rb[2])], cut: [line([3.5, RIM], [20.5, RIM]), rb[3], rb[4], rb[5]] };
  const no = icons.noodles.d;
  icons.noodles.fill = { solid: base, lines: no.slice(2) };
}
// Sweets: the scoops and swirls close along the cone's rim, which stays a cut
{
  const ic = icons['ice-cream'].d;
  icons['ice-cream'].fill = { solid: [ic[0], shut(ic[1])], cut: [KEEP['ice-cream'].seam] };
  const ss = icons['soft-serve'].d;
  icons['soft-serve'].fill = { solid: [ss[0], shut(ss[3])], cut: [line([5.75, 12.25], [18.25, 12.25]), ss[1], ss[2], ss[4], ss[5]] };
  const cc = icons['ice-cream-cup'].d;
  icons['ice-cream-cup'].fill = { solid: [cc[0], shut(cc[2])], cut: [cc[3], line([4.75, 13], [19.25, 13])], lines: [cc[1]] };
  const ip = icons['ice-pop'].d;
  icons['ice-pop'].fill = { solid: [ip[0], shut(ip[1])], cut: [line([10.5, 16.25], [13.5, 16.25])] };
}
// Pantry: each lid, cap and heap is solid on its container, the seam between them cut
{
  const fl = icons.flour.d;
  icons.flour.fill = { solid: [shut(fl[0]), fl[1], shut(fl[2])], cut: [line([5.5, 12.5], [18.5, 12.5]), line([6.5, 9.25], [17.5, 9.25])] };
  const sl = icons['salt-shaker'].d;
  icons['salt-shaker'].fill = { solid: [shut(sl[0]), sl[1]], cut: [line([7.25, 12], [16.75, 12]), ...sl.slice(2)] };
  const hs = icons['hot-sauce'].d;
  icons['hot-sauce'].fill = { solid: [hs[0], hs[1], hs[2]], cut: [line([7, 7.25], [9.5, 7.25])], wire: [hs[3]] };
  const ke = icons.ketchup.d;
  icons.ketchup.fill = { solid: ke, cut: [line([9, 10], [15, 10]), line([10.25, 6.75], [13.75, 6.75])] };
  const di = icons.dip.d;
  icons.dip.fill = { solid: [di[0], shut(di[1]), shut(di[2])], cut: [line([6, 15.25], [18, 15.25])] };
  const ja = icons.jam.d;
  icons.jam.fill = { solid: [shut(ja[0]), ja[1], ja[2]], cut: [KEEP.jam.seam, line([6.75, 8], [17.25, 8]), ja[3]] };
  const pk = icons.pickles.d;
  icons.pickles.fill = { solid: [pk[0], pk[1]], cut: [line([6.25, 6.25], [17.75, 6.25]), pk[2]] };
  // The lid's rim runs from side to side; the label's band stops short of the sides, so the tin
  // stays one piece at every weight
  for (const [name, [cx, cy], rx, h] of [['canned-food', [12, 7.5], 8, 9], ['canned-food-heart', [10, 7], 7.25, 8]]) {
    const cf = icons[name].d;
    icons[name].fill = { solid: [cf[0], shut(cf[1])], cut: [ellLow([cx, cy], rx, 4), frontShort([cx, cy + h / 2 - 0.25], rx, 4, 2.4), cf[3]] };
  }
  for (const name of ['groceries', 'groceries-plus', 'groceries-check', 'groceries-minus']) {
    const gr = icons[name].d;
    icons[name].fill = { solid: [gr[0], shut(gr[2]), gr[3]], cut: [gr[1]] };
  }
}
// One rope: its filled version is the outline itself
icons.pretzel.fill = false;

// ── Parts, motion and variants ────────────────────────────────────────────────────────────────
// Named parts: what animates, what carries a badge, and the pieces with a meaning of their own
const PARTS = {
  'egg-cracked': { shell: [0], cap: [1] },
  'egg-carton': { tray: [0], eggs: [1] },
  flan: { body: [0], caramel: [1], plate: [2] },
  'cinnamon-roll': { bun: [0], swirl: [1] },
  'gummy-bear': { body: [0] },
  'hot-dog': { bun: [0] },
  soup: { bowl: [0, 1], spoon: [2], steam: [3, 4] },
  noodles: { bowl: [0, 1], chopsticks: [2, 3], noodles: [4, 5, 6] },
  pasta: { dish: [0], fork: [1, 2], strands: [3, 4] },
  popcorn: { bucket: [0, 2, 3], popcorn: [1] },
  lollipop: { candy: [0], swirl: [1], stick: [2] },
  'salt-shaker': { body: [0], cap: [1, 2, 3, 4] },
  'spice-jar': { jar: [0, 2, 3], cap: [1] },
  'cooking-oil': { bottle: [0, 1], drop: [2] },
  honey: { dipper: [0, 1, 2, 3], drop: [4] },
  dip: { ramekin: [0, 1], chip: [2] },
  groceries: { bag: [0, 1], items: [2, 3] },
  'groceries-plus': { bag: [0, 1], items: [2, 3] },
  'groceries-check': { bag: [0, 1], items: [2, 3] },
  'groceries-minus': { bag: [0, 1], items: [2, 3] },
  'canned-food': { can: [0, 1, 3], label: [2] },
  'canned-food-heart': { can: [0, 1, 3], label: [2] },
  'nutrition-label': { label: [0], lines: [1, 2, 3, 4, 5, 6] },
  'nutrition-label-search': { label: [0], lines: [1, 2, 3] },
  'food-scan': { frame: [0, 1, 2, 3], burger: [4, 5, 6] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
icons.yogurt.parts = { tub: [0, 1], lid: icons.yogurt.d.slice(2).map((_, i) => i + 2) };

// Motion: each icon's own gesture (draw, bounce and replace need no data)
icons['egg-cracked'].motion = { effect: 'bounce', parts: ['cap'], vector: [0, -1.5] };
icons.soup.motion = { effect: 'float', parts: ['steam'], vector: [0, -1.5] };
icons.flan.motion = { effect: 'wiggle', parts: ['body', 'caramel'], origin: [12, 19.5] };
icons['gummy-bear'].motion = { effect: 'wiggle', origin: [12, 21.25] };
icons['cinnamon-roll'].motion = { effect: 'spin', parts: ['swirl'], origin: [12, 12] };
icons.lollipop.motion = { effect: 'spin', parts: ['swirl'], origin: [12, 9] };
icons.popcorn.motion = { effect: 'bounce', parts: ['popcorn'], vector: [0, -1.5] };
icons['salt-shaker'].motion = { effect: 'wiggle', origin: [12, 21.25] };
icons['spice-jar'].motion = { effect: 'wiggle', origin: [12, 21.25] };
icons['cooking-oil'].motion = { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] };
icons.honey.motion = { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] };
icons.dip.motion = { effect: 'bounce', parts: ['chip'], vector: [0.5, -1.5] };
icons['canned-food-heart'].motion = { effect: 'beat', parts: ['badge'], origin: BC };

// Round already: they don't get enclosed in a circle again; the scan already has its frame
for (const name of ['pizza', 'donut', 'cinnamon-roll', 'waffle']) icons[name].variants = { circle: false };
icons['food-scan'].variants = { square: false };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these are the ones whose details still smudged.
// Each runs its straight strokes through pixel centers (0.75 + 1.5k), keeps 1 pixel between
// pieces and drops the secondary details; dots are 2 × 2 pixels, centered on pixel corners.
const SMALL = {};
// Bread: the loaf with two scores on the pixel diagonal
{
  const loaf = `M5.25 18.75H18.75A1.5 1.5 0 0 0 20.25 17.25V14.25C20.25 9.6 16.5 6.75 12 6.75S3.75 9.6 3.75 14.25V17.25A1.5 1.5 0 0 0 5.25 18.75Z`;
  const scores = [line([8.25, 14.25], [11.25, 11.25]), line([12.75, 14.25], [15.75, 11.25])];
  SMALL.bread = { d: [loaf, ...scores], fill: { solid: [loaf], cut: scores } };
}
// Baguette: the loaf on the pixel diagonal, its two scores along its middle
{
  const R = halfChord([15.75, 3.75], [20.25, 8.25]);
  const body = `M3.75 15.75L15.75 3.75A${R} ${R} 0 0 1 20.25 8.25L8.25 20.25A${R} ${R} 0 0 1 3.75 15.75Z`;
  const scores = [line([6.75, 17.25], [9.75, 14.25]), line([14.25, 9.75], [17.25, 6.75])];
  SMALL.baguette = { d: [body, ...scores], fill: { solid: [body], cut: scores } };
}
// Bagel: a short ring in three-quarter view, the hole on its top; no seeds
{
  const top = ellUp([12, 10.5], 9.75, 5.25);
  const outline = `${top}V13.5${reverseLow([12, 13.5], 9.75, 5.25)}Z`;
  const front = ellLow([12, 10.5], 9.75, 5.25);
  const hole = ell([12, 10.5], 3.75, 2.25);
  SMALL.bagel = { d: [outline, front, hole], fill: { solid: [pierceEll(outline, [12, 10.5], 3.75, 2.25)], cut: [frontShort([12, 10.5], 9.75, 5.25, 1.5)] } };
}
// Cinnamon roll: the bun and a spiral of one turn and a half, its loops 2 pixels apart
{
  const bun = circ(12, 12, 9.75);
  const spiral = 'M9.75 12A2.25 2.25 0 0 1 14.25 12A4.5 4.5 0 0 1 5.25 12A6.75 6.75 0 0 1 18.75 12';
  SMALL['cinnamon-roll'] = { d: [bun, spiral], fill: { solid: [bun], cut: [spiral] } };
}
// Flatbread and pancakes: two layers instead of three
{
  const sides = (x, from, to, k) => from.map((y, i) => arcS([x, y], [x, to[i]], k)).join('');
  const stack = (bulge) => `${ellUp([12, 9.75], 9.75, 4.5)}${bulge ? sides(21.75, [9.75], [14.25], bulge) : 'V14.25'}${reverseLow([12, 14.25], 9.75, 4.5)}${bulge ? sides(2.25, [14.25], [9.75], bulge) : 'Z'}${bulge ? 'Z' : ''}`;
  // Flatbread: three thin rounds, each 2 pixels thick
  const flat = `${ellUp([12, 9], 9.75, 3.75)}V15${reverseLow([12, 15], 9.75, 3.75)}Z`;
  const rounds = [ellLow([12, 9], 9.75, 3.75), ellLow([12, 12], 9.75, 3.75)];
  SMALL.flatbread = { d: [flat, ...rounds], fill: { solid: [flat], cut: [frontShort([12, 9], 9.75, 3.75, 2.25), frontShort([12, 12], 9.75, 3.75, 2.25)] } };
  const front = ellLow([12, 9.75], 9.75, 4.5);
  const puffy = stack(0.6);
  const pat = sq(9.75, 8.25, 4.5, 3, 0.75);
  SMALL.pancakes = { d: [puffy, front, pat], fill: { solid: [puffy], cut: [frontShort([12, 9.75], 9.75, 4.5, 1.5), pat] } };
}
// Donut: the ring and three sprinkles on the pixel diagonal
{
  const ring = circ(12, 12, 8.25);
  const hole = circ(12, 12, 2.25);
  const bits = [line([6.75, 12.75], [8.25, 14.25]), line([14.25, 6.75], [15.75, 8.25]), line([15.75, 15.75], [14.25, 17.25])];
  SMALL.donut = { d: [ring, hole, ...bits], fill: { solid: [pierce(ring, 12, 12, 2.25)], cut: bits } };
}
// Macaron: the two shells and the filling between them as one line
{
  const upper = `M3.75 9.75C3.75 7 7.5 5.25 12 5.25S20.25 7 20.25 9.75Z`;
  const lower = `M3.75 15.75H20.25C20.25 18.5 16.5 20.25 12 20.25S3.75 18.5 3.75 15.75Z`;
  const filling = line([5.25, 12.75], [18.75, 12.75]);
  SMALL.macaron = { d: [upper, lower, filling], fill: { solid: [upper, lower], wire: [filling] } };
}
// Tart: the shallow shell, two flutes and two berries
{
  const outline = `${ellUp([12, 9.75], 9.75, 4.5)}V12.75${reverseLow([12, 12.75], 9.75, 4.5)}Z`;
  const front = ellLow([12, 9.75], 9.75, 4.5);
  const flutes = [9.75, 14.25].map((x) => {
    const dy = 4.5 * Math.sqrt(1 - ((x - 12) / 9.75) ** 2);
    return line([x, 9.75 + dy], [x, 12.75 + dy]);
  });
  const berries = [dot(9, 10.5, 1), dot(12, 8.25, 1), dot(15, 10.5, 1)];
  SMALL.tart = { d: [outline, front, ...flutes, ...berries], fill: { solid: [outline], cut: [front, ...flutes, ...berries] } };
}
// Slice of cake: the wedge and its layer, no cherry
{
  const [tip, BL, BR, BRb, TIPb] = [[2.25, 12.75], [14.25, 5.25], [21.75, 9.75], [21.75, 17.25], [2.25, 20.25]];
  const wedge = roundpoly([BR, BRb, TIPb, tip, BL], [1, 1, 1, 0.75, 1]);
  const edge = line(tip, BR);
  const layer = line([2.25, 16.5], [21.75, 13.5]);
  SMALL['cake-slice'] = { d: [wedge, edge, layer], fill: { solid: [wedge], cut: [short(tip, BR), short([2.25, 16.5], [21.75, 13.5])] } };
}
// Cracked egg: three teeth on the crack
SMALL['egg-cracked'] = { d: KEEP['egg-cracked'], fill: { solid: KEEP['egg-cracked'] } };
// Bacon: one band of fat along the strip
SMALL.bacon = { d: [KEEP.bacon.strip, KEEP.bacon.mid], fill: { solid: [KEEP.bacon.strip], cut: [KEEP.bacon.mid] } };
// Ribs: the rack square to the grid on the pixel column 11.25, three bones running down through it
// and out of its lower edge
{
  const slab = sq(2.25, 5.25, 18, 9, 3);
  const xs = [6.75, 11.25, 15.75];
  const bones = xs.map((x) => line([x, 5.25], [x, 18.75]));
  SMALL.ribs = { d: [slab, ...bones], fill: { solid: [slab], cut: xs.map((x) => line([x, 5.25], [x, 14.25])), wire: xs.map((x) => line([x, 14.25], [x, 18.75])) } };
}
// Cheese wheel: the top with its notch, the drum's sides and the notch's back wall
{
  const cw = icons['cheese-wheel'].d;
  SMALL['cheese-wheel'] = { d: [cw[0], cw[1], cw[2], cw[4]], fill: icons['cheese-wheel'].fill };
}
// Hot dog: level, on the pixel rows, the bun and the sausage in front of it; no mustard
{
  const bun = capsule(3.75, 6.75, 16.5, 10.5);
  const sausage = capsule(2.25, 9.75, 19.5, 4.5);
  SMALL['hot-dog'] = { d: [bun], fill: { solid: [bun] }, badge: { d: [sausage], knock: sausage, fill: { solid: [sausage] } } };
}
// Taco: upright, the shell, its lettuce in four scallops and the filling's edge
{
  const xs = [21.75, 16.88, 12, 7.13, 2.25];
  const lettuce = xs.slice(1).map((x, i) => arcS([xs[i], 9], [x, 9], -1.5)).join('');
  const shell = `M2.25 9A9.75 9.75 0 0 0 21.75 9${lettuce}Z`;
  const inner = 'M6.75 9A5.25 5.25 0 0 0 17.25 9';
  SMALL.taco = { d: [shell, inner], fill: { solid: [shell], cut: [inner] } };
}
// Sandwich: the wedge, its top edge and the lettuce, no second line
{
  const [TIP, BR, BL, BLb, TIPb] = [[21.75, 12.75], [9.75, 5.25], [2.25, 9.75], [2.25, 18.75], [21.75, 20.25]];
  const wedge = roundpoly([TIP, TIPb, BLb, BL, BR], [0.75, 1, 1, 1, 1]);
  const lettuce = wave([2.25, 14.25], [21.75, 16.5], 0.75, 4);
  SMALL.sandwich = { d: [wedge, line(BL, TIP), lettuce], fill: { solid: [wedge], cut: [short(BL, TIP), lettuce] } };
}
// Fast food: a simpler burger (bun and patty line) in front of the cup and its bent straw
{
  const burger = `M2.25 15.75C2.25 12.5 4.5 11.25 7.5 11.25S12.75 12.5 12.75 15.75V18.75A1.5 1.5 0 0 1 11.25 20.25H3.75A1.5 1.5 0 0 1 2.25 18.75Z`;
  const patty = line([2.25, 17.25], [12.75, 17.25]);
  const cup = roundpoly([[9.75, 6.75], [20.25, 6.75], [18.75, 21.75], [11.25, 21.75]], [0.5, 0.5, 0, 1.25]);
  const straw = roundline([[15.75, 6.75], [15.75, 3.75], [18.75, 2.25]], [0, 1, 0]);
  SMALL['fast-food'] = { d: [...behind(cup, [burger]), straw, burger, patty], fill: { solid: [burger], cut: [patty], lines: [...behind(cup, [burger]), straw] } };
}
// Noodles: a bowl on the grid, the chopsticks square to it and two noodles hanging into it
{
  const bowl = 'M2.25 11.25H21.75A9.75 7.5 0 0 1 2.25 11.25Z';
  const foot = 'M8.25 17.25V21.75H15.75V17.25';
  const sticks = [line([5.25, 3.75], [21.75, 3.75]), line([5.25, 6.75], [21.75, 6.75])];
  const noodles = [9.75, 14.25].map((x) => wave([x, 6.75], [x, 11.25], 0.6, 2));
  SMALL.noodles = { d: [bowl, foot, ...sticks, ...noodles], fill: { solid: [bowl, shut(foot)], lines: [...sticks, ...noodles] } };
}
// Lasagna: the block on the grid and two layers
{
  const block = roundpoly([[3.75, 9.75], [8.25, 5.25], [20.25, 5.25], [20.25, 15.75], [15.75, 20.25], [3.75, 20.25]], [0.75, 1, 1, 1, 1, 1.5]);
  const edges = [roundline([[3.75, 9.75], [15.75, 9.75], [20.25, 5.25]], [0, 0.5, 0]), line([15.75, 9.75], [15.75, 20.25])];
  const layers = [12.75, 16.5].map((y) => wave([3.75, y], [15.75, y], 0.6, 4));
  SMALL.lasagna = { d: [block, ...edges, ...layers], fill: { solid: [block], cut: [...edges, ...layers] } };
}
// Curry: the plate, the heap of rice and one chunk in the sauce
{
  const plate = ell([12, 14.25], 9.75, 6);
  const rice = `${riceHeap([9, 14.25], 5.25, 6, 4)}Z`;
  const chunk = dot(16.5, 16.5, 1);
  SMALL.curry = { d: [...behind(plate, [rice]), rice, chunk], fill: { solid: [plate], cut: [rice, chunk] } };
}
// Candy cane: the cane on the pixel grid, two stripes on the pixel diagonal and one on the hook
{
  const cane = 'M12.75 18.75V9A2.25 2.25 0 0 0 8.25 9V11.25A2.25 2.25 0 0 1 3.75 11.25V9A6.75 6.75 0 0 1 17.25 9V18.75A2.25 2.25 0 0 1 12.75 18.75Z';
  const stripes = [line([12.75, 14.25], [17.25, 9.75]), line([12.75, 18.75], [17.25, 14.25]), line([5.25, 4.5], [8.25, 7.5])];
  SMALL['candy-cane'] = { d: [cane, ...stripes], fill: { solid: [cane], cut: stripes } };
}
// Soft serve: the swirl with one tier, on the cone without its crosshatch
{
  const ss = KEEP['soft-serve'];
  SMALL['soft-serve'] = { d: [ss.swirl, ss.tier, ss.cone], fill: { solid: [ss.swirl, shut(ss.cone)], cut: [line([5.75, 12.25], [18.25, 12.25]), ss.tier] } };
}
// Sugar: the three cubes at 2:1, the slope of the pixel grid
{
  const T = (x, y) => [12.75 + x * 3, 14.25 + y * 3];
  const P = [T(0, -2.5), T(1, -2), T(1, -1), T(2, -0.5), T(2, 0.5), T(1, 1), T(0, 0.5), T(-1, 1), T(-2, 0.5), T(-2, -0.5), T(-1, -1), T(-1, -2)];
  const out = roundpoly(P, [0.6, 0, 0, 0, 0.6, 0, 0, 0, 0.6, 0, 0, 0]);
  const inner = [line(T(-1, -2), T(0, -1.5), T(1, -2)), line(T(0, -1.5), T(0, 0.5)), line(T(-2, -0.5), T(-1, 0), T(0, -0.5)), line(T(-1, 0), T(-1, 1)), line(T(0, -0.5), T(1, 0), T(2, -0.5)), line(T(1, 0), T(1, 1))];
  SMALL.sugar = { d: [out, ...inner], fill: { solid: [out], cut: inner } };
}
// Honey: the dipper's head with one groove, the handle and the drop as one 2 × 2 pixel dot
{
  const hd = icons.honey.d;
  const drop = dot(4.5, 19.5, 1);
  SMALL.honey = { d: [hd[0], hd[2], hd[3], drop], fill: { solid: [hd[0], drop], cut: [hd[2]], wire: [hd[3]] } };
}
// Jam: the cloth a plain skirt tied at its neck, the jar and its label on the grid
{
  const cloth = roundpoly([[8.25, 3.75], [15.75, 3.75], [15.75, 6.75], [20.25, 11.25], [3.75, 11.25], [8.25, 6.75]], [1.25, 1.25, 0.5, 0.75, 0.75, 0.5]);
  const tie = line([8.25, 6.75], [15.75, 6.75]);
  const jar = roundline([[5.25, 11.25], [5.25, 21.75], [18.75, 21.75], [18.75, 11.25]], [0, 2.25, 0, 0]);
  const label = sq(8.25, 14.25, 7.5, 4.5, 1);
  SMALL.jam = { d: [jar, cloth, tie, label], fill: { solid: [shut(jar), cloth], cut: [line([5.25, 11.25], [18.75, 11.25]), tie, label] } };
}
// Snack bag: the pouch with its seals, the teeth at the pixel's pitch
{
  const teeth = (y, x0, x1, dir) => Array.from({ length: Math.round((x1 - x0) / 1.5) + 1 }, (_, i) => [x0 + i * 1.5, y + (i % 2 ? dir * 1.5 : 0)]);
  const top = teeth(3.75, 5.25, 18.75, -1);
  const bottom = teeth(20.25, 18.75, 5.25, 1);
  const pts = [...top, [18.75, 6.75], [20.25, 12], [18.75, 17.25], ...bottom, [5.25, 17.25], [3.75, 12], [5.25, 6.75]];
  const n = top.length;
  const r = pts.map((_, i) => (i === n + 1 || i === 2 * n + 4 ? 6 : i < n || (i > n + 2 && i < 2 * n + 3) ? 0.15 : 0.5));
  const pouch = roundpoly(pts, r);
  const seals = [line([5.25, 6.75], [18.75, 6.75]), line([5.25, 17.25], [18.75, 17.25])];
  SMALL['snack-bag'] = { d: [pouch, ...seals], fill: { solid: [pouch], cut: seals } };
}
// Granola bar: on the pixel diagonal, the band of its torn wrapper and one speck of oats
{
  const bar = roundpoly([[3.75, 15.75], [15.75, 3.75], [20.25, 8.25], [8.25, 20.25]], [1, 0.4, 0.4, 1]);
  const band = [line([11.25, 8.25], [15.75, 12.75]), line([14.25, 5.25], [18.75, 9.75])];
  const speck = dot(9, 15, 1);
  SMALL['granola-bar'] = { d: [bar, ...band, speck], fill: { solid: [bar], cut: [...band, speck] } };
}
// Groceries: the bag on the grid, the baguette standing in it and the leaf on the pixel diagonal
const SMALL_GROCERIES = (() => {
  const bag = sq(3.75, 12.75, 16.5, 9, 2.5, BR);
  const loaf = capsule(6, 3.75, 4.5, 12);
  const green = leaf([13.5, 12.75], [20.25, 6], 3);
  return { d: [bag, line([3.75, 15.75], [20.25, 15.75]), ...behind(loaf, [bag]), ...behind(green, [bag])] };
})();
SMALL.groceries = { d: SMALL_GROCERIES.d, fill: { solid: [SMALL_GROCERIES.d[0], ...SMALL_GROCERIES.d.slice(2).map(shut)], cut: [SMALL_GROCERIES.d[1]] } };
for (const kind of ['plus', 'check', 'minus']) SMALL[`groceries-${kind}`] = { ...SMALL.groceries, badge: badge(kind, { size: 16 }) };
// Food scan: the viewfinder's corners and a plainer burger, both on the pixel grid
{
  const corner = (pts) => roundline(pts, [0, 1.5, 0]);
  const frame16 = [corner([[2.25, 6.75], [2.25, 2.25], [6.75, 2.25]]), corner([[17.25, 2.25], [21.75, 2.25], [21.75, 6.75]]), corner([[21.75, 17.25], [21.75, 21.75], [17.25, 21.75]]), corner([[6.75, 21.75], [2.25, 21.75], [2.25, 17.25]])];
  const bun = 'M6.75 11.25C6.75 8.5 9 6.75 12 6.75S17.25 8.5 17.25 11.25V15.75A1.5 1.5 0 0 1 15.75 17.25H8.25A1.5 1.5 0 0 1 6.75 15.75Z';
  const patty = line([6.75, 12.75], [17.25, 12.75]);
  SMALL['food-scan'] = { d: [...frame16, bun, patty], fill: { solid: [bun], cut: [patty], lines: frame16 } };
}
// Pizza: the pie on the pixel grid with its top right quarter taken, the cut sides on a pixel
// column and row, three slices of pepperoni; no crust
{
  const pie = 'M11.25 12.75V3.75A9 9 0 1 0 20.25 12.75Z';
  const pepperoni = [[7.5, 9], [7.5, 16.5], [15, 16.5]].map(([x, y]) => dot(x, y, 1));
  SMALL.pizza = { d: [pie, ...pepperoni], fill: { solid: [pie], cut: pepperoni } };
}
// Sushi: one maki, its top an oval with the filling, its side down to the grid
{
  const top = ell([12, 9.75], 6.75, 3);
  const side = `M5.25 9.75V15.75${tail(ellLow([12, 15.75], 6.75, 3))}V9.75`;
  const filling = dot(12, 9.75, 1);
  SMALL.sushi = { d: [top, side, filling], fill: { solid: [top, shut(side)], cut: [ellLow([12, 9.75], 6.75, 3), filling] } };
}
// Slice of cheese: the square on the grid, one bite in its right edge and two holes
{
  const slice = `${roundline([[20.25, 9.75], [20.25, 3.75], [3.75, 3.75], [3.75, 20.25], [20.25, 20.25], [20.25, 12.75]], [0, 2.25, 2.25, 2.25, 2.25, 0])}A1.5 1.5 0 0 1 20.25 9.75Z`;
  const holes = [circ(9.75, 9.75, 3), circ(14.25, 15.75, 1.5)];
  SMALL['cheese-slice'] = { d: [slice, ...holes], fill: { solid: [pierce(pierce(slice, 9.75, 9.75, 3), 14.25, 15.75, 1.5)] } };
}
// Canned food: the squat tin on the grid, its lid a taller oval with the ring, one band
const smallCan = (cx, rx) => {
  const lid = ell([cx, 8.25], rx, 4.5);
  const side = `M${f(cx - rx)} 8.25V15.75${tail(ellLow([cx, 15.75], rx, 4.5))}V8.25`;
  const ring = circ(cx, 8.25, 1.5);
  return { d: [lid, side, ring], fill: { solid: [lid, shut(side)], cut: [ellLow([cx, 8.25], rx, 4.5), ring] } };
};
SMALL['canned-food'] = smallCan(11.25, 7.5);
SMALL['canned-food-heart'] = { ...smallCan(9.75, 6), badge: badge('heart', { size: 16 }) };
// Sub: the roll on the pixel diagonal, split along its length by one line
{
  const R = halfChord([15.75, 3.75], [20.25, 8.25]);
  const roll = `M3.75 15.75L15.75 3.75A${R} ${R} 0 0 1 20.25 8.25L8.25 20.25A${R} ${R} 0 0 1 3.75 15.75Z`;
  const cut = line([6.75, 17.25], [17.25, 6.75]);
  SMALL['sub-sandwich'] = { d: [roll, cut], fill: { solid: [roll], cut: [cut] } };
}
// Nigiri: the fish on the grid, two stripes on the pixel diagonal, the rice's sides and bottom under it
{
  const fish = sq(2.25, 5.25, 19.5, 6, 2.5);
  const st = [line([8.25, 9.75], [9.75, 6.75]), line([12.75, 9.75], [14.25, 6.75])];
  const rice = roundline([[3.75, 12.75], [3.75, 18.75], [20.25, 18.75], [20.25, 12.75]], [0, 2.25, 2.25, 0]);
  SMALL.nigiri = { d: [fish, rice, ...st], fill: { solid: [fish, shut(rice)], cut: st } };
}
// Pasta: the fork level on the pixel rows, two strands hanging from it into the dish
{
  const dish = roundline([[2.25, 17.25], [5.25, 20.25], [18.75, 20.25], [21.75, 17.25]], [0, 1.5, 1.5, 0]);
  const fork = ['M5.25 3.75H9.75A3 3 0 0 1 9.75 9.75H5.25', line([5.25, 6.75], [21.75, 6.75])];
  const strands = [line([8.25, 9.75], [8.25, 20.25]), line([11.25, 9.38], [11.25, 20.25])];
  SMALL.pasta = { d: [dish, ...fork, ...strands], fill: { solid: [shut(dish)], wire: [...fork, ...strands] } };
}
// Omelette: the half moon level on the grid, inside the plate
{
  const plate = circ(11.25, 12.75, 9);
  const half = 'M5.25 14.25A6 6 0 0 1 17.25 14.25Z';
  SMALL.omelette = { d: [plate, half], fill: { solid: [half], wire: [plate] } };
}
// Instant noodles: the cup on the grid, its band, the chopsticks standing straight and the lid
{
  const cup = roundpoly([[3.75, 11.25], [20.25, 11.25], [18.75, 21.75], [5.25, 21.75]], [0.5, 0.5, 0, 1.5]);
  const band = line([4.18, 14.25], [19.82, 14.25]);
  const sticks = [line([8.25, 11.25], [8.25, 2.25]), line([11.25, 11.25], [11.25, 2.25])];
  const lid = line([17.25, 11.25], [20.25, 5.25]);
  SMALL['instant-noodles'] = { d: [cup, band, ...sticks, lid], fill: { solid: [cup], cut: [band], wire: [...sticks, lid] } };
}
// Yogurt: the tub on the grid, its rim, the foil lid a line on the pixel diagonal
{
  const tub = roundpoly([[3.75, 11.25], [20.25, 11.25], [18.75, 21.75], [5.25, 21.75]], [0.5, 0.5, 0, 1.5]);
  const rim = line([4.18, 14.25], [19.82, 14.25]);
  const lid = line([18.75, 8.25], [12.75, 2.25]);
  SMALL.yogurt = { d: [tub, rim, lid], fill: { solid: [tub], cut: [rim], lines: [lid] } };
}
// Egg carton: three eggs on the grid standing in the tray
{
  const tray = roundpoly([[3.75, 12.75], [20.25, 12.75], [18.75, 20.25], [5.25, 20.25]], [0.5, 0.5, 0, 1.5]);
  const eggs = `M5.25 12.75${[5.25, 9.75, 14.25].map((x) => `A2.25 4.5 0 0 1 ${pt([x + 4.5, 12.75])}`).join('')}`;
  SMALL['egg-carton'] = { d: [tray, eggs], fill: { solid: [tray, shut(eggs)], cut: [line([6.75, 12.75], [17.25, 12.75])] } };
}
for (const [name, small] of Object.entries(SMALL)) icons[name].small = small;

export default { category: 'comida', label: 'Comida', icons };
