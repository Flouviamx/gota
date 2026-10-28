// Fruits and vegetables: fruit, citrus, berries, stone and tropical fruit, roots, onions and garlic,
// stalks and leafy greens, cruciferous vegetables, squash, peppers and tomatoes, legumes, nuts and
// seeds, herbs, mushrooms, grains and the produce aisle. Everything is computed with
// engine/geometry.mjs on the rules in DESIGN.md: a 1.5 stroke and the keylines. Produce is organic,
// so the signature corner only appears on its one container (the crate). Each fruit is
// a recognizable silhouette with one inner mark at most (a leaf, a stem, a seam), and its cut
// versions are built on the whole fruit.
import { arc, badge, circ, dot, f, flipPath, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const deg = (r) => (r * 180) / Math.PI;
const angOf = (c, p) => deg(Math.atan2(p[1] - c[1], p[0] - c[0]));
/** An open stroke closed for `fill.solid` (solid only takes closed shapes). */
const shut = (d) => `${d}Z`;
/** A path moved by (dx, dy), in absolute coordinates. */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** A path drawn in its own frame, turned `a` degrees about the origin and set down at `at`. */
const place = (d, a, at) => move(turnPath(d, a, [0, 0]), at[0], at[1]);
/** Several strokes written as one path. */
const many = (...ds) => ds.join('');

/** Cubic path: a start point and [c1, c2, end] segments. */
const curve = (start, segs, close = false) => `M${pt(start)}${segs.map(([a, b, c]) => `C${pt(a)} ${pt(b)} ${pt(c)}`).join('')}${close ? 'Z' : ''}`;
/** A point on a cubic segment. */
const bez = (p0, [c1, c2, p1], t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p1[k]);
};
/** The part of a cubic segment from `t` to its end, as a path (a cut that stops short of a tip). */
const from = (p0, [c1, c2, p1], t) => {
  const [a, b, c] = [lerp(p0, c1, t), lerp(c1, c2, t), lerp(c2, p1, t)];
  const [d, e] = [lerp(a, b, t), lerp(b, c, t)];
  return curve(lerp(d, e, t), [[e, c, p1]]);
};
/**
 * A symmetric closed outline about x = ax: the right half as cubic segments from the top point on
 * the axis down to the bottom point on the axis; the left half is its mirror (fruit, bulbs, nuts).
 */
function sym(top, segs, ax = 12) {
  const m = (p) => [2 * ax - p[0], p[1]];
  const ends = [top, ...segs.map((s) => s[2])];
  const back = segs.map(([c1, c2], i) => [m(c2), m(c1), m(ends[i])]).reverse();
  return `${curve(top, segs)}${back.map(([a, b, c]) => `C${pt(a)} ${pt(b)} ${pt(c)}`).join('')}Z`;
}
/** Ellipse with semi-axes rx, ry turned `tilt` degrees, as four cubics. */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const P = (x, y) => add(c, rotate([x, y], tilt));
  return `M${pt(P(rx, 0))}C${pt(P(rx, k * ry))} ${pt(P(k * rx, ry))} ${pt(P(0, ry))}C${pt(P(-k * rx, ry))} ${pt(P(-rx, k * ry))} ${pt(P(-rx, 0))}C${pt(P(-rx, -k * ry))} ${pt(P(-k * rx, -ry))} ${pt(P(0, -ry))}C${pt(P(k * rx, -ry))} ${pt(P(rx, -k * ry))} ${pt(P(rx, 0))}Z`;
}
/** A point on an ellipse (c, rx, ry, tilt) at parameter t degrees. */
const onEll = (c, rx, ry, tilt, t) => add(c, rotate([rx * Math.cos((t * Math.PI) / 180), ry * Math.sin((t * Math.PI) / 180)], tilt));
/** Is p inside the ellipse (c, rx, ry, tilt)? */
const inEll = (p, c, rx, ry, tilt) => {
  const [x, y] = rotate(sub(p, c), -tilt);
  return (x / rx) ** 2 + (y / ry) ** 2 < 1;
};
/**
 * What of an ellipse stays visible outside another one in front of it: one elliptical arc whose
 * ends lie on the front ellipse (a pad budding from a pad).
 */
function ellOutside([c, rx, ry, tilt], ...fronts) {
  const out = (t) => fronts.every((fr) => !inEll(onEll(c, rx, ry, tilt, t), ...fr));
  // The first sample where it comes out from behind the front ones, then as far as it stays out
  const start = Array.from({ length: 1440 }, (_, i) => i / 4).find((t) => out(t) && !out(t - 0.25));
  if (start === undefined) throw new Error('ellOutside: the ellipses do not overlap');
  let end = start;
  for (let i = 0; i < 1440 && out(end + 0.25); i++) end += 0.25;
  const [a, b] = [onEll(c, rx, ry, tilt, start - 0.125), onEll(c, rx, ry, tilt, end + 0.125)];
  return `M${pt(a)}A${f(rx)} ${f(ry)} ${f(tilt)} ${end - start > 180 ? 1 : 0} 1 ${pt(b)}`;
}
function rotate([x, y], a) {
  const r = (a * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
}
/** A leaf: a lens from its base A to its tip B, `w` wide at the middle (two arcs). */
function leaf(A, B, w) {
  const c = len(sub(B, A));
  const s = w / 2;
  const R = f((s * s + (c * c) / 4) / (2 * s));
  return `M${pt(A)}A${R} ${R} 0 0 1 ${pt(B)}A${R} ${R} 0 0 1 ${pt(A)}Z`;
}
/** Open arc between two angles (clockwise when a1 > a0). */
const arcd = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d;
/** The intersections of two circles [x, y, r]. */
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
/**
 * A cluster of round fruit touching each other (grapes, berries), listed front to back: each circle
 * keeps what the ones in front leave visible, and its arcs end on them (as a stack of coins closes
 * along the coin above it).
 */
function cluster(cs) {
  return cs.flatMap(([x, y, r], i) => {
    const front = cs.slice(0, i).filter(([u, v, s]) => Math.hypot(u - x, v - y) < r + s);
    if (!front.length) return [circ(x, y, r)];
    const cuts = front.flatMap((c) => meet([x, y, r], c).map((p) => (angOf([x, y], p) + 360) % 360)).sort((a, b) => a - b);
    const seen = (a) => {
      const p = polar(x, y, r, a);
      return front.every(([u, v, s]) => Math.hypot(p[0] - u, p[1] - v) > s);
    };
    const spans = cuts.map((a, k) => [a, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + 360]).filter(([a, b]) => seen((a + b) / 2));
    return spans.map(([a, b]) => arcd(x, y, r, a, b));
  });
}

/**
 * Leaves and grains that overlap, listed front to back: each lens (A, B, w) keeps the parts of its
 * two arcs that the lenses in front of it leave visible, and those arcs end on them.
 */
function lenses(list) {
  const geo = list.map(([A, B, w]) => {
    const c = len(sub(B, A));
    const s = w / 2;
    const R = (s * s + (c * c) / 4) / (2 * s);
    const M = lerp(A, B, 0.5);
    const u = mul(sub(B, A), 1 / c);
    const n = [u[1], -u[0]];
    // The arc bulging toward +n lies on the circle whose center is on the -n side, and vice versa
    return { A, B, R, C1: sub(M, mul(n, R - s)), C2: add(M, mul(n, R - s)) };
  });
  const inside = (g, p) => len(sub(p, g.C1)) < g.R - 1e-6 && len(sub(p, g.C2)) < g.R - 1e-6;
  return geo.map((g, i) => {
    const fronts = geo.slice(0, i);
    const arcs = [
      [g.C1, g.A, g.B],
      [g.C2, g.B, g.A],
    ];
    if (!fronts.length) return `M${pt(g.A)}A${f(g.R)} ${f(g.R)} 0 0 1 ${pt(g.B)}A${f(g.R)} ${f(g.R)} 0 0 1 ${pt(g.A)}Z`;
    const out = [];
    for (const [C, P, Q] of arcs) {
      const a0 = angOf(C, P);
      let a1 = angOf(C, Q);
      while (a1 < a0) a1 += 360;
      const cuts = [a0, a1];
      for (const fg of fronts)
        for (const D of [fg.C1, fg.C2])
          if (len(sub(C, D)) < 2 * g.R)
            for (const p of meet([...C, g.R], [...D, fg.R])) {
              let a = angOf(C, p);
              while (a < a0) a += 360;
              if (a > a0 && a < a1) cuts.push(a);
            }
      cuts.sort((x, y) => x - y);
      for (let k = 0; k < cuts.length - 1; k++) {
        const m = polar(...C, g.R, (cuts[k] + cuts[k + 1]) / 2);
        if (cuts[k + 1] - cuts[k] > 0.5 && !fronts.some((fg) => inside(fg, m))) out.push(`M${pt(polar(...C, g.R, cuts[k]))}A${f(g.R)} ${f(g.R)} 0 0 1 ${pt(polar(...C, g.R, cuts[k + 1]))}`);
      }
    }
    return out.join('');
  });
}
/** A smooth closed curve through the points (Catmull-Rom as cubics): potatoes, roots, rhizomes. */
function blob(pts, k = 1) {
  const n = pts.length;
  const P = (i) => pts[(i + n) % n];
  const segs = pts.map((_, i) => {
    const [a, b, c, d] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    return [add(b, mul(sub(c, a), k / 6)), sub(c, mul(sub(d, b), k / 6)), c];
  });
  return curve(pts[0], segs, true);
}
/**
 * The outline where a distance field `sdf(x, y)` crosses zero (marching squares on a 0.05 grid over
 * the canvas), as points about every `step` around it: the union of overlapping shapes as one curve.
 */
function contour(sdf, step = 0.7) {
  const h = 0.05;
  const n = Math.round(24 / h);
  const v = Array.from({ length: n + 1 }, (_, j) => Array.from({ length: n + 1 }, (_, i) => sdf(i * h, j * h)));
  const inside = (i, j) => v[j][i] < 0;
  // A crossed cell edge, named by its two grid points (lower one first) so both cells share it
  const pts = new Map();
  const edge = (i0, j0, i1, j1) => {
    if (j1 < j0 || (j1 === j0 && i1 < i0)) [i0, j0, i1, j1] = [i1, j1, i0, j0];
    const k = `${i0},${j0},${i1},${j1}`;
    if (!pts.has(k)) {
      const [a, b] = [v[j0][i0], v[j1][i1]];
      const t = a / (a - b);
      pts.set(k, [(i0 + (i1 - i0) * t) * h, (j0 + (j1 - j0) * t) * h]);
    }
    return k;
  };
  // Around each cell clockwise (corners tl, tr, br, bl; edges top, right, bottom, left), the edge where
  // the inside begins leads to the next crossed edge, where it ends
  const next = new Map();
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const cs = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const c = cs.map(([x, y]) => inside(x, y));
      const e = [0, 1, 2, 3].map((k) => (c[k] !== c[(k + 1) % 4] ? edge(...cs[k], ...cs[(k + 1) % 4]) : null));
      for (let k = 0; k < 4; k++) {
        if (!e[k] || !c[(k + 1) % 4]) continue;
        next.set(e[k], e[[1, 2, 3].map((d) => (k + d) % 4).find((m) => e[m])]);
      }
    }
  const start = [...next.keys()].reduce((best, k) => (pts.get(k)[0] < pts.get(best)[0] ? k : best));
  const ring = [pts.get(start)];
  for (let k = next.get(start); k && k !== start; k = next.get(k)) ring.push(pts.get(k));
  const out = [ring[0]];
  for (const p of ring) if (len(sub(p, out[out.length - 1])) >= step) out.push(p);
  return out;
}
/** Open polyline with rounded interior corners (one radius per vertex, or one for all). */
function rline(pts, r = 0) {
  const rr = Array.isArray(r) ? r : pts.map(() => r);
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const u = mul(sub(A, V), 1 / len(sub(A, V)));
    const v = mul(sub(B, V), 1 / len(sub(B, V)));
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    if (!rr[i] || th > Math.PI - 1e-6) {
      d += `L${pt(V)}`;
      continue;
    }
    const t = rr[i] / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${pt(add(V, mul(u, t)))}A${f(rr[i])} ${f(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${pt(add(V, mul(v, t)))}`;
  }
  return `${d}L${pt(pts[pts.length - 1])}`;
}
/** A tuft of three short roots fanning down from a point. */
const roots = (p, spread = 1.9, drop = 2.1) => many(line(p, add(p, [-spread, drop - 0.3])), line(p, add(p, [0, drop])), line(p, add(p, [spread, drop - 0.3])));

// ── Seams for the fill ────────────────────────────────────────────────────────────────────────
// Fruit that overlaps (grapes, berries, a bunch of bananas) fills as one mass unless the edge of
// each piece in front is knocked out where it lies over the ones behind it. The seams below are
// measured on the shapes themselves: a seam that reaches the silhouette runs on past it, so it cuts
// through at every weight instead of closing up at the heavy ones.
/** The points along a path, about every `step`: one list per subpath (M L H V C Q A Z, absolute or relative). */
function sample(d, step = 0.05) {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const out = [];
  let cur = null;
  let [p, start, cmd, i] = [[0, 0], [0, 0], '', 0];
  const num = () => Number(tok[i++]);
  const run = (fn, L) => {
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) cur.push(fn(k / n));
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd !== cmd.toUpperCase();
    const at = (x, y) => (rel ? [p[0] + x, p[1] + y] : [x, y]);
    const a = p;
    switch (cmd.toUpperCase()) {
      case 'Z':
        run((t) => lerp(a, start, t), len(sub(start, a)));
        p = start;
        break;
      case 'M':
        p = start = at(num(), num());
        cur = [p];
        out.push(cur);
        cmd = rel ? 'l' : 'L';
        break;
      case 'L': {
        const q = at(num(), num());
        run((t) => lerp(a, q, t), len(sub(q, a)));
        p = q;
        break;
      }
      case 'H':
      case 'V': {
        const v = num();
        const q = cmd.toUpperCase() === 'H' ? [rel ? a[0] + v : v, a[1]] : [a[0], rel ? a[1] + v : v];
        run((t) => lerp(a, q, t), len(sub(q, a)));
        p = q;
        break;
      }
      case 'C': {
        const [c1, c2, q] = [at(num(), num()), at(num(), num()), at(num(), num())];
        run((t) => bez(a, [c1, c2, q], t), len(sub(c1, a)) + len(sub(c2, c1)) + len(sub(q, c2)));
        p = q;
        break;
      }
      case 'Q': {
        const [c, q] = [at(num(), num()), at(num(), num())];
        run((t) => lerp(lerp(a, c, t), lerp(c, q, t), t), len(sub(c, a)) + len(sub(q, c)));
        p = q;
        break;
      }
      case 'A': {
        let [rx, ry] = [num(), num()];
        const phi = (num() * Math.PI) / 180;
        const [fa, fs] = [num(), num()];
        const q = at(num(), num());
        // Endpoint to center (SVG 1.1, F.6.5)
        const [cp, sp] = [Math.cos(phi), Math.sin(phi)];
        const [dx, dy] = [(a[0] - q[0]) / 2, (a[1] - q[1]) / 2];
        const [x1, y1] = [cp * dx + sp * dy, -sp * dx + cp * dy];
        const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
        if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
        const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1) / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
        const [ux, uy] = [(k * rx * y1) / ry, (-k * ry * x1) / rx];
        const c = [cp * ux - sp * uy + (a[0] + q[0]) / 2, sp * ux + cp * uy + (a[1] + q[1]) / 2];
        const angle = (u, v) => Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]);
        const t1 = angle([1, 0], [(x1 - ux) / rx, (y1 - uy) / ry]);
        let dt = angle([(x1 - ux) / rx, (y1 - uy) / ry], [(-x1 - ux) / rx, (-y1 - uy) / ry]);
        if (!fs && dt > 0) dt -= 2 * Math.PI;
        else if (fs && dt < 0) dt += 2 * Math.PI;
        run((t) => {
          const [x, y] = [rx * Math.cos(t1 + dt * t), ry * Math.sin(t1 + dt * t)];
          return [cp * x - sp * y + c[0], sp * x + cp * y + c[1]];
        }, Math.abs(dt) * Math.max(rx, ry));
        p = q;
        break;
      }
      default:
        throw new Error(`sample: unsupported command ${cmd}`);
    }
  }
  return out;
}
/** Is p inside the polygon (even-odd)? */
function inPoly(P, [x, y]) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [P[i], P[j]];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/** A smooth open curve through the points (Catmull-Rom as cubics). */
function spline(pts) {
  if (pts.length < 3) return line(...pts);
  const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const segs = pts.slice(1).map((_, i) => {
    const [a, b, c, d] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    return [add(b, mul(sub(c, a), 1 / 6)), sub(c, mul(sub(d, b), 1 / 6)), c];
  });
  return curve(pts[0], segs);
}
/**
 * The seams of shapes that overlap, listed front to back (closed paths): each shape's edge where it
 * lies over the shapes behind it. An end that meets the silhouette runs `over` past it, outward.
 */
function seams(shapes, over = 2.4) {
  const polys = shapes.map((d) => sample(d)[0]);
  const mid = polys.map((P) => mul(P.reduce((s, q) => add(s, q), [0, 0]), 1 / P.length));
  const out = [];
  polys.forEach((P, i) => {
    const owner = (q) => polys.findIndex((B, j) => j > i && inPoly(B, q));
    const hidden = (q) => polys.some((F, j) => j < i && inPoly(F, q));
    const n = P.length;
    const flag = P.map((q) => owner(q) >= 0 && !hidden(q));
    const k0 = flag.indexOf(false);
    if (k0 < 0) return;
    let runPts = [];
    const close = () => {
      if (runPts.length < 4) return (runPts = []);
      const ends = [
        [runPts[0], runPts[1]],
        [runPts[runPts.length - 1], runPts[runPts.length - 2]],
      ].map(([e, prev]) => {
        // On the silhouette when, just past the end, the edge is in no other shape
        const past = add(e, mul(sub(e, prev), 6));
        if (polys.some((B, j) => j !== i && inPoly(B, past)) || hidden(past)) return null;
        const j = owner(prev);
        const dir = add(mul(sub(e, mid[i]), 1 / len(sub(e, mid[i]))), mul(sub(e, mid[j]), 1 / len(sub(e, mid[j]))));
        return add(e, mul(dir, over / len(dir)));
      });
      // A point about every 0.9 along the run (the samples lie 0.05 apart)
      const pts = runPts.filter((_, k) => k % 18 === 0 || k === runPts.length - 1);
      const body = spline(pts);
      out.push(`${ends[0] ? `M${pt(ends[0])}L${pt(pts[0])}${body.slice(body.search(/[CL]/))}` : body}${ends[1] ? `L${pt(ends[1])}` : ''}`);
      runPts = [];
    };
    for (let s = 1; s <= n; s++) {
      const k = (k0 + s) % n;
      if (flag[k]) runPts.push(P[k]);
      else close();
    }
    close();
  });
  return out;
}

/** A teardrop: the circle (c, r) drawn out to a point at `tip`. */
function tear(tip, c, r) {
  const th = angOf(c, tip);
  const al = deg(Math.acos(r / len(sub(tip, c))));
  return `M${pt(tip)}L${pt(polar(...c, r, th + al))}A${f(r)} ${f(r)} 0 1 1 ${pt(polar(...c, r, th - al))}Z`;
}
/** A stroke and its way back over itself: a knock that clears only along a line (a custom badge). */
const retrace = (start, segs) => {
  const ends = [start, ...segs.map((s) => s[2])];
  return `${curve(start, segs)}${segs
    .map(([c1, c2], i) => [c2, c1, ends[i]])
    .reverse()
    .map(([a, b, c]) => `C${pt(a)} ${pt(b)} ${pt(c)}`)
    .join('')}`;
};
/** The runs of a path where `keep` holds, each ending where it stops holding (a smooth curve through its samples). */
function runs(d, keep) {
  return many(
    ...sample(d).flatMap((S) => {
      const flag = S.map(keep);
      if (flag.every(Boolean)) return [d];
      // A closed path starts where it comes out from behind, so its run isn't split at its start
      const closed = len(sub(S[0], S[S.length - 1])) < 0.01;
      const k0 = closed ? flag.findIndex((v, k) => v && !flag[(k - 1 + S.length) % S.length]) : 0;
      const seq = closed ? [...S.slice(k0), ...S.slice(0, k0)] : S;
      const out = [];
      let cur = [];
      for (const q of seq) {
        if (keep(q)) cur.push(q);
        else if (cur.length) {
          out.push(cur);
          cur = [];
        }
      }
      if (cur.length) out.push(cur);
      return out.filter((r) => r.length > 8).map((r) => spline(r.filter((_, k) => k % 18 === 0 || k === r.length - 1)));
    }),
  );
}
/** What of a path stays visible outside the closed shapes in front of it, ending on them (a berry under its cap). */
function visible(d, ...fronts) {
  const polys = fronts.map((x) => sample(x)[0]);
  return runs(d, (q) => !polys.some((P) => inPoly(P, q)));
}
/** What of a path lies inside a closed shape, ending on its edge (the net of a bag). */
function inside(d, shape) {
  const P = sample(shape)[0];
  return runs(d, (q) => inPoly(P, q));
}
/**
 * What of a path stays at least `gap` from every outline given (center to center): a cut that
 * meets the silhouette at a tip (a lens's point, a seed's ridge) stops short of it, clearly, so it
 * never leaves a sliver of the tip behind.
 */
function clear(d, gap, ...outlines) {
  const pts = outlines.flatMap((o) => sample(o).flat());
  return runs(d, (q) => pts.every((p) => len(sub(p, q)) >= gap));
}
/**
 * Leaves that grow from one point as a single outline (a persimmon's calyx): each lens [A, B, w]
 * reaches back past the point `k`, so their union is star-shaped around it and traced as one curve.
 */
function rosette(petals, k) {
  const discs = petals.map(([A, B, w]) => {
    const c = len(sub(B, A));
    const s = w / 2;
    const R = (s * s + (c * c) / 4) / (2 * s);
    const M = lerp(A, B, 0.5);
    const u = mul(sub(B, A), 1 / c);
    const n = [u[1], -u[0]];
    return [[sub(M, mul(n, R - s)), R], [add(M, mul(n, R - s)), R]];
  });
  const pts = [];
  for (let a = 0; a < 360; a += 2) {
    const u = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
    // How far the ray from k runs inside each lens (the nearer of its two circles' exits)
    const reach = discs.map((lens) =>
      Math.min(
        ...lens.map(([C, R]) => {
          const v = sub(k, C);
          const b = u[0] * v[0] + u[1] * v[1];
          return -b + Math.sqrt(Math.max(0, b * b - (v[0] * v[0] + v[1] * v[1] - R * R)));
        }),
      ),
    );
    pts.push(add(k, mul(u, Math.max(...reach))));
  }
  return blob(pts);
}
/** What of a circle stays visible outside the closed shapes in front of it: its longest arc. */
function arcOutside([cx, cy, r], ...fronts) {
  const polys = fronts.map((d) => sample(d)[0]);
  const out = (a) => !polys.some((P) => inPoly(P, polar(cx, cy, r, a)));
  const start = Array.from({ length: 1440 }, (_, i) => i / 4).find((a) => out(a) && !out(a - 0.25));
  if (start === undefined) return circ(cx, cy, r);
  let end = start;
  while (end - start < 360 && out(end + 0.25)) end += 0.25;
  return arcd(cx, cy, r, start - 0.1, end + 0.1);
}

// ── Apples and pears ──────────────────────────────────────────────────────────────────────────
// The apple: two shoulders around the stem's dip, its widest point low and a soft dip underneath;
// the stem rises from the dip and the leaf grows from its top, clear of the right shoulder.
const APPLE = sym([12, 9.4], [
  [[13.2, 8.35], [14.45, 7.9], [16, 7.9]],
  [[18.4, 7.9], [19.75, 10.25], [19.75, 14]],
  [[19.75, 18.1], [17.9, 21.25], [15.9, 21.25]],
  [[14.3, 21.25], [13.3, 20.7], [12, 20.7]],
]);
const APPLE_STEM = 'M12 9.4C12 7.6 12.2 5.9 12.9 4.5';
const APPLE_LEAF = leaf([12.9, 4.5], [17.75, 2.75], 2.75);
const APPLE_D = [APPLE, APPLE_STEM, APPLE_LEAF];
const APPLE_FILL = { solid: [APPLE, APPLE_LEAF], wire: [APPLE_STEM] };
const APPLE_PARTS = { fruit: [0], stem: [1], leaf: [2] };

const icons = {
  apple: { tags: ['manzana', 'fruta', 'colación', 'apple', 'fruit', 'snack'], d: APPLE_D, fill: APPLE_FILL, parts: APPLE_PARTS },
  'apple-plus': { tags: ['agregar fruta', 'añadir manzana', 'registrar porción', 'add fruit', 'log fruit', 'apple'], d: APPLE_D, fill: APPLE_FILL, parts: APPLE_PARTS, badge: badge('plus') },
};
{
  // Cut in half: the leaf is gone and the stem runs on into the core, a narrow lens down the middle
  const stem = 'M12 10.75V9.4C12 7.9 12.2 6.6 12.75 5.25';
  const core = leaf([12, 10.75], [12, 18.1], 4.6);
  icons['apple-half'] = {
    tags: ['manzana partida', 'media manzana', 'fruta cortada', 'apple half', 'cut fruit', 'apple core'],
    d: [APPLE, stem, core],
    fill: { solid: [APPLE], wire: [stem], cut: [core] },
    parts: { fruit: [0], stem: [1], core: [2] },
  };
}
{
  // Eaten: the core's hourglass between the caps of the fruit, the stem on top
  const core = sym([12, 6.6], [
    [[13.6, 5.1], [16.9, 4.9], [18, 7.4]],
    [[16.2, 8.7], [14.6, 10.9], [14.6, 13.6]],
    [[14.6, 16.3], [16.2, 18.4], [18, 19.4]],
    [[17.7, 21], [14.9, 21.25], [12, 21.25]],
  ]);
  const stem = 'M12 6.6C12 5.2 12.2 3.9 12.8 2.75';
  icons['apple-core'] = {
    tags: ['corazón de manzana', 'restos', 'desperdicio', 'composta', 'apple core', 'food waste', 'compost'],
    d: [core, stem],
    fill: { solid: [core], wire: [stem] },
    parts: { core: [0], stem: [1] },
  };
}
{
  // A worm waving out of a hole in the apple's side and past its edge, in front of it (a custom
  // badge): the hole a dot, the worm a wave
  const hole = dot(15.4, 14.6);
  const segs = [
    [[16.9, 13.1], [17.6, 11.4], [19.1, 11.4]],
    [[20.4, 11.4], [20.4, 13.4], [21.6, 13.4]],
  ];
  const worm = curve([15.4, 14.6], segs);
  icons['apple-worm'] = {
    tags: ['manzana con gusano', 'fruta dañada', 'plaga', 'reportar producto', 'apple worm', 'spoiled', 'pest'],
    d: APPLE_D,
    fill: APPLE_FILL,
    parts: APPLE_PARTS,
    badge: { d: [hole, worm], knock: `${circ(15.4, 14.6, 1.6)}${retrace([15.4, 14.6], segs)}`, fill: { solid: [hole], wire: [worm] } },
  };
}
{
  // The pear: a narrow top swelling into a round bottom, the stem and a leaf off its middle
  const pear = sym([12, 6.5], [
    [[13.55, 6.5], [14.65, 7.75], [14.75, 9.6]],
    [[14.85, 11.6], [18.75, 12.4], [18.75, 16]],
    [[18.75, 19.1], [15.75, 21.25], [12, 21.25]],
  ]);
  const seg = [[12, 5.1], [12.25, 3.8], [12.9, 2.75]];
  const stem = curve([12, 6.5], [seg]);
  const base = bez([12, 6.5], seg, 0.45);
  const lf = leaf(base, [17, 3.1], 2.6);
  icons.pear = {
    tags: ['pera', 'fruta', 'pear', 'fruit'],
    d: [pear, stem, lf],
    fill: { solid: [pear, lf], wire: [stem] },
    parts: { fruit: [0], stem: [1], leaf: [2] },
  };
}

// ── Bananas ───────────────────────────────────────────────────────────────────────────────────
// One banana in its own frame: two arcs (the outer one deep, the inner one shallow) between a blunt
// tip on the left and a short stem on the right; set down at a slant. Its ridge runs along the
// middle, a constant 3 from the outer edge, and ends on the inner one.
const BAN = (() => {
  const O = [0, -1.06, 9.06];
  const I = [0, -19.25, 21.25];
  const yo = (x) => O[1] + Math.sqrt(O[2] ** 2 - x * x);
  const yi = (x) => I[1] + Math.sqrt(I[2] ** 2 - x * x);
  const [x0, x1] = [-8.6, 8.1];
  const tipO = [x0, yo(x0)];
  const tipI = [x0 + 0.2, yi(x0 + 0.2)];
  const endO = [x1, yo(x1)];
  const endI = [x1 - 0.5, yi(x1 - 0.5)];
  const dir = [0.62, -0.79];
  const stemO = add(endO, mul(dir, 2.6));
  const stemI = add(endI, mul(dir, 2.6));
  const body = `M${pt(tipI)}L${pt(tipO)}A${f(O[2])} ${f(O[2])} 0 0 0 ${pt(endO)}L${pt(stemO)}L${pt(stemI)}L${pt(endI)}A${f(I[2])} ${f(I[2])} 0 0 1 ${pt(tipI)}Z`;
  const [a, b] = meet([O[0], O[1], O[2] - 3], I).sort((p, q) => p[0] - q[0]);
  const ridge = `M${pt(a)}A${f(O[2] - 3)} ${f(O[2] - 3)} 0 0 0 ${pt(b)}`;
  return { body, ridge, geo: { O, I, tipO, tipI, endO, endI, stemO, stemI } };
})();
{
  const at = [11.6, 12.6];
  const body = place(transform(BAN.body, 1.04, 0, 0), -38, at);
  const ridge = place(transform(BAN.ridge, 1.04, 0, 0), -38, at);
  icons.banana = {
    tags: ['plátano', 'banana', 'fruta', 'potasio', 'banana', 'fruit', 'energy snack'],
    d: [body, ridge],
    fill: { solid: [body], cut: [ridge] },
    parts: { fruit: [0], ridge: [1] },
  };
}
{
  // Peeled: the fruit, curving to its blunt tip, stands out of its peel, whose three flaps hang open
  // around it: one to each side and the one in front; the whole at a slant
  const fruit = 'M9.6 12C9.4 8.9 10.2 6.1 12.1 3.9C12.6 3.3 13.6 3.5 13.65 4.25C13.5 6.9 13.85 9.6 14.4 12';
  const peel = sym([12, 12.75], [
    [[12.9, 12.75], [13.75, 12.4], [14.4, 12]],
    [[16.9, 12.3], [18.9, 14.6], [19.6, 18.1]],
    [[18, 17], [16.6, 16.4], [15.4, 16.4]],
    [[15.1, 18.1], [14.1, 19.6], [13.1, 20.1]],
    [[13.1, 20.6], [12.9, 21.25], [12.9, 21.25]],
    [[12.6, 21.25], [12.3, 21.25], [12, 21.25]],
  ]);
  const flap = 'M10.1 12.45V15.6A1.9 1.9 0 0 0 13.9 15.6V12.45';
  const t = (d) => turnPath(d, -12, [12, 13]);
  const d = [peel, fruit, flap].map(t);
  icons['banana-peeled'] = {
    tags: ['plátano pelado', 'banana pelada', 'listo para comer', 'peeled banana', 'snack time', 'ready to eat'],
    d,
    fill: { solid: [d[0], shut(d[1])], cut: [...seams([d[0], shut(d[1])]), d[2]] },
    parts: { peel: [0, 2], fruit: [1] },
  };
}
{
  // A bunch: three bananas stacked, each closing along the inner edge of the one in front of it
  const { O, I, tipO, tipI, endO, endI, stemO, stemI } = BAN.geo;
  const v = [-0.9, -3.4];
  const back = (k) => {
    const o = [O[0] + v[0] * k, O[1] + v[1] * k, O[2]];
    const front = [I[0] + v[0] * (k - 1), I[1] + v[1] * (k - 1), I[2]];
    const [pl, pr] = meet(o, front).sort((p, q) => p[0] - q[0]);
    const m = (p) => add(p, mul(v, k));
    const R = f(O[2]);
    const Ri = f(I[2]);
    return `M${pt(pl)}A${R} ${R} 0 0 1 ${pt(m(tipO))}L${pt(m(tipI))}A${Ri} ${Ri} 0 0 0 ${pt(m(endI))}L${pt(m(stemI))}L${pt(m(stemO))}L${pt(m(endO))}A${R} ${R} 0 0 1 ${pt(pr)}`;
  };
  const at = [12.6, 15.1];
  const k = 0.84;
  const put = (d) => place(transform(d, k, 0, 0), -24, at);
  const d = [put(BAN.body), put(back(1)), put(back(2))];
  // Filled, the bananas behind stay lines (as a group's people do), clear of the one in front
  icons['banana-bunch'] = {
    tags: ['racimo de plátanos', 'bananas', 'plátano macho', 'banana bunch', 'plantains', 'tropical'],
    d,
    fill: { solid: [d[0]], lines: [d[1], d[2]] },
    parts: { front: [0], back: [1, 2] },
  };
}

// ── Citrus ────────────────────────────────────────────────────────────────────────────────────
/**
 * A citrus body in its own frame, centered on the origin: an oval rx × ry whose ends may carry a
 * nib (`nr` to the right, `nl` to the left), the lemon's and the lime's.
 */
function citrusBody(rx, ry, nr = 0, nl = 0) {
  const half = (n) => {
    // From the top to the right end, then down to the bottom
    if (!n) return [[[0.5523 * rx, -ry], [rx, -0.5523 * ry], [rx, 0]], [[rx, 0.5523 * ry], [0.5523 * rx, ry], [0, ry]]];
    const h = 0.26 * ry;
    return [
      [[0.57 * rx, -ry], [0.89 * rx, -0.625 * ry], [rx, -h]],
      [[rx + 0.15 * n, -h / 2], [rx + 0.55 * n, -0.07 * ry], [rx + n, 0]],
      [[rx + 0.55 * n, 0.07 * ry], [rx + 0.15 * n, h / 2], [rx, h]],
      [[0.89 * rx, 0.625 * ry], [0.57 * rx, ry], [0, ry]],
    ];
  };
  const right = half(nr);
  const left = half(nl).map((s) => s.map(([x, y]) => [-x, -y]));
  return curve([0, -ry], [...right, ...left], true);
}
// The orange: a full circle, the stem's nub and a leaf turned up off it, clear of the fruit; the
// navel shows as a dot low on its face.
{
  const body = circ(12, 14.25, 7);
  const stem = line([12, 7.25], [12, 4.1]);
  const lf = leaf([12, 4.1], [16.75, 2.5], 2.6);
  const navel = dot(14.6, 16.85);
  icons.orange = {
    tags: ['naranja', 'cítrico', 'vitamina c', 'jugo', 'orange', 'citrus', 'vitamin c'],
    d: [body, stem, lf, navel],
    fill: { solid: [body, lf], wire: [stem], cut: [navel] },
    parts: { fruit: [0, 3], stem: [1], leaf: [2] },
  };
}
{
  // Tangerine, half peeled: the peel opens below in three petals, the two at the sides curling out;
  // above it the bare fruit, its segments meeting at the top
  const peel = sym([12, 13.1], [
    [[12.8, 13.1], [14.1, 14.3], [15.75, 15.6]],
    [[16.6, 14.1], [18.4, 12.9], [20.75, 12.6]],
    [[21, 17.6], [17.4, 21.1], [12, 21.1]],
  ]);
  const whole = circ(12, 12.75, 7.1);
  const fruit = arcOutside([12, 12.75, 7.1], peel);
  const segments = many(curve([12, 5.65], [[[9.6, 7.6], [8.6, 11.4], [8.25, 15.6]]]), curve([12, 5.65], [[[14.4, 7.6], [15.4, 11.4], [15.75, 15.6]]]));
  icons.tangerine = {
    tags: ['mandarina', 'clementina', 'cítrico', 'lonchera', 'tangerine', 'mandarin', 'clementine'],
    d: [peel, fruit, segments],
    fill: { solid: [peel, whole], cut: [...seams([peel, whole], 0), segments] },
    parts: { peel: [0], fruit: [1, 2] },
  };
}
{
  // Lemon: an oval on its side with a nib at each end
  const body = place(citrusBody(7, 5.6, 2.4, 2.4), -28, [12, 12]);
  icons.lemon = { tags: ['limón amarillo', 'cítrico', 'ácido', 'lemon', 'citrus', 'sour'], d: [body], fill: { solid: [body] } };
}
{
  // Lime: rounder, a nib at its blossom end and a leaf at its stem end
  const c = [11.25, 13.25];
  const body = place(citrusBody(6.9, 6.6, 2, 0), 35, c);
  const S = add(c, rotate([-6.9, 0], 35));
  const lf = leaf(S, [8.25, 2.75], 2.6);
  icons.lime = {
    tags: ['limón', 'lima', 'cítrico', 'tacos', 'lime', 'citrus'],
    d: [body, lf],
    fill: { solid: [body, lf] },
    parts: { fruit: [0], leaf: [1] },
  };
}
{
  // Citrus wheel, a slice lying at a slant: the rind as a ring and the segments as spokes from the
  // middle
  const c = [12, 12];
  const rind = ell(c, 9, 6.5);
  const flesh = ell(c, 6.1, 4.1);
  const spokes = many(...[0, 60, 120].map((a) => line(onEll(c, 6.1, 4.1, 0, a - 90), onEll(c, 6.1, 4.1, 0, a + 90))));
  icons.citrus = {
    tags: ['rodaja de cítrico', 'cítricos', 'fresco', 'vitamina c', 'citrus', 'slice', 'garnish'],
    d: [rind, flesh, spokes],
    fill: { solid: [rind], cut: [flesh, spokes] },
    parts: { rind: [0], flesh: [1, 2] },
    // At 16 px the flesh's ring and the spokes run together: the rind and longer spokes only
    small: (() => {
      const long = many(...[0, 60, 120].map((a) => line(onEll(c, 6.4, 4.4, 0, a - 90), onEll(c, 6.4, 4.4, 0, a + 90))));
      return { d: [rind, long], fill: { solid: [rind], cut: [long] } };
    })(),
  };
}
{
  // A quarter wedge: the rind as two arcs below, two segment lines meeting at the point
  const P = [12, 6.5];
  const R = 12.25;
  const wedge = `M${pt(P)}L${pt(polar(...P, R, 45))}A${R} ${R} 0 0 1 ${pt(polar(...P, R, 135))}Z`;
  const inner = arcd(...P, R - 3, 45, 135);
  const segs = many(line(P, polar(...P, R - 3, 75)), line(P, polar(...P, R - 3, 105)));
  icons['citrus-wedge'] = {
    tags: ['gajo', 'cuña de limón', 'exprimir', 'citrus wedge', 'lime wedge', 'garnish'],
    d: [wedge, inner, segs],
    // Filled, the segments stop short of the point
    fill: { solid: [wedge], cut: [inner, clear(segs, 2.4, wedge)] },
    parts: { rind: [0, 1], segments: [2] },
  };
}

// ── Grapes and berries ────────────────────────────────────────────────────────────────────────
{
  // Grapes: six in an inverted triangle, the lower ones in front; a short stem and a leaf turned
  // up off it, clear of the grapes
  const r = 2.75;
  const s = 4.6;
  const h = s * Math.sin(Math.PI / 3);
  const y0 = 10.5;
  const cs = [
    [12, y0 + 2 * h, r],
    [12 - s / 2, y0 + h, r],
    [12 + s / 2, y0 + h, r],
    [12, y0, r],
    [12 - s, y0, r],
    [12 + s, y0, r],
  ];
  const berries = cluster(cs);
  const shapes = cs.map(([x, y]) => circ(x, y, r));
  const stem = 'M12 7.75C12 6.4 12.2 5.4 12.75 4.5';
  const lf = leaf([12.75, 4.5], [17, 2.4], 2.4);
  icons.grapes = {
    tags: ['uvas', 'racimo', 'viñedo', 'vino', 'pasas', 'grapes', 'vineyard', 'raisins'],
    d: [...berries, stem, lf],
    fill: { solid: [...shapes, lf], cut: seams(shapes), wire: [stem] },
    parts: { grapes: berries.map((_, i) => i), stem: [berries.length], leaf: [berries.length + 1] },
  };
}
{
  // Strawberry: a berry with round shoulders tapering to a soft tip, its leafy cap lying over the top
  // with the sepals reaching past its sides (the berry's edge ends on it), the stem rising from it;
  // three seeds mark the face
  const berry = sym([12, 8.9], [
    [[13.6, 7.9], [16.2, 7.3], [17.9, 8.2]],
    [[19.6, 9.1], [19.6, 12.1], [18.6, 14.5]],
    [[17.3, 17.6], [14.3, 21.25], [12, 21.25]],
  ]);
  const cap = roundpoly([[12, 6.6], [16.1, 7.1], [20.25, 11], [14.75, 10.1], [12, 12.75], [9.25, 10.1], [3.75, 11], [7.9, 7.1]], [1.2, 1.4, 0.7, 0.8, 0.7, 0.8, 0.7, 1.4]);
  const body = visible(berry, cap);
  const stem = line([12, 6.6], [12.75, 2.75]);
  const seeds = [dot(9.1, 15.6), dot(14.9, 15.6), dot(12, 18.25)];
  icons.strawberry = {
    tags: ['fresa', 'frutos rojos', 'verano', 'sabor fresa', 'strawberry', 'berries', 'summer fruit'],
    d: [body, cap, stem, ...seeds],
    fill: { solid: [berry, cap], cut: [...seams([cap, berry]), ...seeds], wire: [stem] },
    parts: { fruit: [0, 3, 4, 5], cap: [1], stem: [2] },
  };
}
{
  // Blueberries: three in a loose pile, the front one marked with its crown
  const F = [9.5, 14.75, 5.5];
  const cs = [F, [17.25, 15.25, 4], [14.5, 7.4, 4.25]];
  const berries = cluster(cs);
  const shapes = cs.map(([x, y, r]) => circ(x, y, r));
  const crown = many(...[0, 72, 144, 216, 288].map((a) => line([F[0], F[1]], polar(F[0], F[1], 1.75, a - 90))));
  icons.blueberries = {
    tags: ['arándanos', 'moras azules', 'antioxidantes', 'superalimento', 'blueberries', 'berries', 'superfood'],
    d: [...berries, crown],
    fill: { solid: shapes, cut: [...seams(shapes), crown] },
    parts: { berries: berries.map((_, i) => i), crown: [berries.length] },
  };
}
{
  // Raspberry: a dome whose edge is its drupelets, three more inside as seeds, a short stem with two
  // leaves turned up off the top
  const c = [12, 14.6];
  const n = 9;
  const ring = Array.from({ length: n }, (_, i) => {
    const a = -90 + (360 / n) * i;
    const p = [c[0] + 5.9 * Math.cos((a * Math.PI) / 180), c[1] + 5.3 * Math.sin((a * Math.PI) / 180)];
    return [...p, 2.35];
  });
  const outline = (() => {
    const X = ring.map((P, i) => meet(P, ring[(i + 1) % n]).sort((p, q) => len(sub(q, c)) - len(sub(p, c)))[0]);
    let d = `M${pt(X[n - 1])}`;
    ring.forEach((P, i) => {
      d += `A${f(P[2])} ${f(P[2])} 0 0 1 ${pt(X[i])}`;
    });
    return `${d}Z`;
  })();
  const seeds = [dot(12, 12.6), dot(9.75, 16.5), dot(14.25, 16.5)];
  const top = [12, c[1] - 5.3 - 2.35];
  const stem = line(top, [12, 4.25]);
  const leaves = [leaf([12, 4.25], [7.6, 2.6], 2.4), leaf([16.4, 2.6], [12, 4.25], 2.4)];
  icons.raspberry = {
    tags: ['frambuesa', 'zarzamora', 'frutos rojos', 'raspberry', 'blackberry', 'berries'],
    d: [outline, ...seeds, stem, ...leaves],
    fill: { solid: [outline, ...leaves], cut: seeds, wire: [stem] },
    parts: { fruit: [0, 1, 2, 3], stem: [4], leaves: [5, 6] },
  };
}
{
  // Cherries: two on long stems that meet at the top, a leaf off the joint
  const J = [13.75, 3.75];
  const a = [6.75, 16.75, 3.6];
  const b = [17, 17.5, 3.6];
  const s1 = curve([a[0], a[1] - a[2]], [[[7.5, 9], [10.5, 5.5], J]]);
  const s2 = curve([b[0], b[1] - b[2]], [[[16.6, 9.5], [15, 6], J]]);
  const lf = leaf(J, [19.75, 4.5], 2.6);
  icons.cherry = {
    tags: ['cerezas', 'cereza', 'fruta', 'postre', 'cherry', 'cherries', 'topping'],
    d: [circ(...a), circ(...b), s1, s2, lf],
    fill: { solid: [circ(...a), circ(...b), lf], wire: [s1, s2] },
    parts: { cherries: [0, 1], stems: [2, 3], leaf: [4] },
  };
}

// ── Stone fruit ───────────────────────────────────────────────────────────────────────────────
{
  // Peach: round, its cleft running down from the stem, a leaf off the stem like the apple's
  const body = sym([12, 8.9], [
    [[13.2, 7.9], [14.6, 7.6], [16, 7.6]],
    [[18.5, 7.6], [20, 10], [20, 13.5]],
    [[20, 18], [16.4, 21.25], [12, 21.25]],
  ]);
  const stem = 'M12 8.9C12 7.4 12.2 6 12.75 4.6';
  const lf = leaf([12.75, 4.6], [17.6, 2.75], 2.6);
  const cleft = 'M12 8.9C9.7 10.7 9 13.7 9.7 16.7';
  icons.peach = {
    tags: ['durazno', 'melocotón', 'chabacano', 'nectarina', 'peach', 'apricot', 'nectarine'],
    d: [body, stem, lf, cleft],
    fill: { solid: [body, lf], wire: [stem], cut: [cleft] },
    parts: { fruit: [0, 3], stem: [1], leaf: [2] },
  };
}
{
  // Plum: an upright oval with its seam, hanging by a short stem from a bare twig that slants across
  // above it
  const body = ell([12, 14.4], 6.4, 6.9, -12);
  const top = add([12, 14.4], rotate([0, -6.9], -12));
  const seam = curve(top, [[[14.6, 9.4], [15.6, 13.6], [14.6, 17.9]]]);
  const seg = [[8.4, 3.1], [13.6, 4.4], [18.6, 6.6]];
  const twig = curve([4.75, 2.9], [seg]);
  const stem = line([top[0] - 0.4, yAtX([4.75, 2.9], seg, top[0] - 0.4)], top);
  icons.plum = {
    tags: ['ciruela', 'ciruela pasa', 'fruta de hueso', 'plum', 'prune', 'stone fruit'],
    d: [body, seam, twig, stem],
    fill: { solid: [body], cut: [seam], wire: [twig, stem] },
    parts: { fruit: [0, 1], twig: [2, 3] },
  };
}
{
  // Mango: its paisley, a full round shoulder tapering to a blunt beak that curls to one side, the
  // stem rising from the shoulder and one long leaf off it
  const body = blob([[13.2, 6.4], [18.2, 7.8], [20.4, 12.4], [19.2, 17.2], [15, 20.6], [9.6, 21.25], [6.4, 20.6], [7.2, 17.8], [6.6, 13.4], [8.8, 8.4]]);
  const tip = [11.8, 3.9];
  const stem = curve([13.2, 6.4], [[lerp([13.2, 6.4], tip, 0.35), lerp([13.2, 6.4], tip, 0.7), tip]]);
  const lf = leaf(tip, [5.6, 3.2], 2.8);
  icons.mango = {
    tags: ['mango', 'fruta tropical', 'licuado', 'sabor mango', 'mango', 'tropical fruit', 'smoothie'],
    d: [body, stem, lf],
    fill: { solid: [body, lf], wire: [stem] },
    parts: { fruit: [0], stem: [1], leaf: [2] },
  };
}
{
  // Olives: two ovals hanging from a sprig, two narrow leaves rising from it
  const J = [12, 6.6];
  const o1 = [6.9, 14.75];
  const o2 = [17.1, 14.75];
  const t1 = add(o1, rotate([0, -4.6], 14));
  const t2 = add(o2, rotate([0, -4.6], -14));
  const olives = [ell(o1, 3.3, 4.6, 14), ell(o2, 3.3, 4.6, -14)];
  const stems = many(line(J, t1), line(J, t2));
  const leaves = [leaf(J, [6.25, 2.9], 2.8), leaf([17.75, 2.9], J, 2.8)];
  icons.olive = {
    tags: ['aceitunas', 'oliva', 'mediterráneo', 'pizza', 'olives', 'olive', 'mediterranean'],
    d: [...olives, stems, ...leaves],
    fill: { solid: [...olives, ...leaves], wire: [stems] },
    parts: { olives: [0, 1], sprig: [2], leaves: [3, 4] },
  };
}

// ── Tropical fruit ────────────────────────────────────────────────────────────────────────────
// The avocado, halved: a pear-shaped outline with the round pit near the bottom, at a slant so
// the pit stays clear of a badge.
const AVO = (() => {
  const shell = sym([12, 2.9], [
    [[14.1, 2.9], [15.2, 4.9], [15.7, 7.6]],
    [[16.1, 9.9], [19, 11.6], [19, 15]],
    [[19, 18.6], [16, 21.25], [12, 21.25]],
  ]);
  const t = (d) => turnPath(transform(d, 0.94, 0.72, 0.6), 24, [12, 12]);
  return [t(shell), t(circ(12, 15.1, 3.25))];
})();
icons.avocado = {
  tags: ['aguacate', 'palta', 'guacamole', 'grasas saludables', 'avocado', 'healthy fats', 'toast'],
  d: AVO,
  fill: { solid: [AVO[0]], cut: [AVO[1]] },
  parts: { fruit: [0], pit: [1] },
};
icons['avocado-clock'] = {
  tags: ['madurar', 'maduración', 'listo en días', 'ripening', 'ripen', 'avocado'],
  d: AVO,
  fill: { solid: [AVO[0]], cut: [AVO[1]] },
  parts: { fruit: [0], pit: [1] },
  badge: badge('clock'),
};
{
  // Pineapple: an oval with a diamond lattice (two chords each way) and a crown of three leaves
  const c = [12, 14.75];
  const [rx, ry] = [5.75, 6.5];
  const body = ell(c, rx, ry);
  // A 45° chord through (x0, c[1]) with slope s, ending on the oval
  const chord = (x0, s) => {
    const pts = [];
    for (const sign of [-1, 1]) {
      // Solve ((x - cx)/rx)^2 + ((s (x - x0))/ry)^2 = 1
      const A = 1 / rx ** 2 + 1 / ry ** 2;
      const B = (-2 * c[0]) / rx ** 2 + (-2 * x0) / ry ** 2;
      const C = c[0] ** 2 / rx ** 2 + x0 ** 2 / ry ** 2 - 1;
      const x = (-B + sign * Math.sqrt(B * B - 4 * A * C)) / (2 * A);
      pts.push([x, c[1] + s * (x - x0)]);
    }
    return line(...pts);
  };
  const lattice = many(chord(9.75, 1), chord(14.25, 1), chord(9.75, -1), chord(14.25, -1));
  const T = [12, c[1] - ry];
  const crown = [leaf(T, [12, 2.75], 2.4), leaf(T, [7.1, 4.4], 2.3), leaf([16.9, 4.4], T, 2.3)];
  icons.pineapple = {
    tags: ['piña', 'ananá', 'fruta tropical', 'piña colada', 'pineapple', 'tropical fruit'],
    d: [body, lattice, ...crown],
    fill: { solid: [body, ...crown], cut: [lattice] },
    parts: { fruit: [0, 1], crown: [2, 3, 4] },
  };
}
{
  // Papaya, cut lengthwise: a long egg at a slant, narrower at its stem end, its seed cavity a long
  // lens with three seeds in a row (filled, the cavity is cut and the seeds stay ink in it)
  const [L, W0, W1] = [10.4, 4.2, 6.4];
  const shell = sym([0, -L], [
    [[W0 * 0.75, -L], [W0, -L + W0 * 0.8], [(W0 + W1) / 2 + 0.2, -L * 0.25]],
    [[W1, L * 0.2], [W1, L * 0.62], [W1 * 0.8, L * 0.82]],
    [[W1 * 0.55, L], [W1 * 0.3, L], [0, L]],
  ], 0);
  const at = [12, 12];
  const a = 42;
  const P = (p) => add(at, rotate(p, a));
  const seeds = [-1.7, 1.2, 4.1].map((y) => dot(...P([0, y]), 0.3));
  const d = [place(shell, a, at), place(leaf([0, -4.8], [0, 7.2], 6.6), a, at), ...seeds];
  icons.papaya = {
    tags: ['papaya', 'fruta bomba', 'lechosa', 'desayuno', 'papaya', 'tropical fruit', 'breakfast'],
    d,
    fill: { solid: [d[0]], cut: d.slice(1) },
    parts: { fruit: [0], seeds: [1, 2, 3, 4] },
  };
}
{
  // Coconut, halved: the shell from the side with one of its ridges, its opening as an ellipse and
  // the flesh as a ring in it
  const c = [12, 9.1];
  const rim = ell(c, 8.75, 4.25);
  const flesh = ell(c, 5.75, 1.25);
  const shell = `M${pt([c[0] - 8.75, c[1]])}A8.75 11.25 0 0 0 ${pt([c[0] + 8.75, c[1]])}`;
  const front = onEll(c, 8.75, 4.25, 0, 62);
  const ridge = curve(front, [[[15.6, 15.6], [14.6, 18.6], [12.75, 20.3]]]);
  icons.coconut = {
    tags: ['coco', 'leche de coco', 'aceite de coco', 'tropical', 'coconut', 'coconut milk', 'plant-based'],
    d: [shell, rim, flesh, ridge],
    fill: { solid: [shut(shell), rim], cut: [flesh, ridge] },
    parts: { shell: [0, 3], flesh: [1, 2] },
  };
}
{
  // Kiwi slice: an oval, a ring of small seeds (a dense group) around its pale center, clear of the
  // skin and of each other at every weight
  const c = [12, 12];
  const seeds = Array.from({ length: 8 }, (_, i) => {
    const a = ((i * 45 + 22.5) * Math.PI) / 180;
    return dot(c[0] + 5.6 * Math.cos(a), c[1] + 4.2 * Math.sin(a), 0.3);
  });
  const outer = ell(c, 9, 7.25);
  const core = ell(c, 2.4, 1.4);
  icons.kiwi = {
    tags: ['kiwi', 'rodaja', 'vitamina c', 'kiwi', 'kiwifruit', 'vitamin c'],
    d: [outer, core, ...seeds],
    fill: { solid: [outer], cut: [core, ...seeds] },
    parts: { fruit: [0], core: [1], seeds: seeds.map((_, i) => i + 2) },
  };
}
{
  // Pomegranate: a squat round that rises into its crown, a short neck flaring into three teeth; fruit
  // and crown are one silhouette, one stroke (a ring would carry its stone apart, on top)
  const [c, rx, ry] = [[12, 14.05], 7.9, 7.2];
  const onBody = (B, T) => {
    // Where the crown's side, from its base B toward its tooth T, comes out of the fruit
    let [lo, hi] = [0, 1];
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      const q = lerp(B, T, m);
      if (((q[0] - c[0]) / rx) ** 2 + ((q[1] - c[1]) / ry) ** 2 < 1) lo = m;
      else hi = m;
    }
    return lerp(B, T, lo);
  };
  const teeth = [[8.4, 3.2], [10.7, 4.9], [12, 2.75], [13.3, 4.9], [15.6, 3.2]];
  const [L, R] = [onBody([10.2, 8.6], teeth[0]), onBody([13.8, 8.6], teeth[4])];
  const crown = rline([L, ...teeth, R], [0, 0.3, 0.45, 0.3, 0.45, 0.3, 0]);
  const fruit = `${crown}A${f(rx)} ${f(ry)} 0 1 1 ${pt(L)}Z`;
  icons.pomegranate = {
    tags: ['granada', 'antioxidantes', 'temporada', 'pomegranate', 'antioxidants', 'seasonal'],
    d: [fruit],
    fill: { solid: [fruit] },
  };
}
{
  // Fig, halved: a teardrop with a short neck, its curled stem, the seeded flesh as an inner teardrop
  const outer = sym([12, 4.6], [
    [[13.1, 5.7], [14.2, 7.2], [15.7, 8.5]],
    [[18.2, 10.7], [19.4, 13], [19.4, 15.1]],
    [[19.4, 18.6], [16.1, 21.25], [12, 21.25]],
  ]);
  const inner = sym([12, 9.3], [
    [[13.2, 10.8], [16.2, 12.2], [16.2, 14.9]],
    [[16.2, 16.9], [14.3, 18.25], [12, 18.25]],
  ]);
  const stem = 'M12 4.6C12 3.5 12.5 2.7 13.6 2.25';
  const t = (d) => turnPath(d, 16, [12, 12.5]);
  const d = [t(outer), t(inner), t(stem)];
  icons.fig = {
    tags: ['higo', 'breva', 'tabla de quesos', 'fig', 'figs', 'cheese board'],
    d,
    fill: { solid: [d[0]], cut: [d[1]], wire: [d[2]] },
    parts: { fruit: [0, 1], stem: [2] },
  };
}
{
  // Passion fruit, halved: a thick rind and the pulp's seeds
  const seeds = [dot(12, 12, 0.3), ...[-90, -18, 54, 126, 198].map((a) => dot(...polar(12, 12, 3.1, a), 0.3))];
  icons['passion-fruit'] = {
    tags: ['maracuyá', 'fruta de la pasión', 'parchita', 'passion fruit', 'tropical fruit', 'juice'],
    d: [circ(12, 12, 9), circ(12, 12, 6), ...seeds],
    fill: { solid: [circ(12, 12, 9)], cut: [circ(12, 12, 6), ...seeds] },
    parts: { rind: [0], pulp: [1, ...seeds.map((_, i) => i + 2)] },
  };
}
{
  // Lychee: a round whose rough skin shows in its edge, small points all around; a short stem and
  // a leaf
  const c = [12, 14.05];
  const n = 14;
  const pts = Array.from({ length: 2 * n }, (_, i) => polar(...c, i % 2 ? 6.6 : 7.5, -90 + (180 / n) * i));
  const skin = roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.5 : 0.6)));
  const stem = line([12, 6.55], [12.6, 3.9]);
  const lf = leaf([12.6, 3.9], [17.4, 2.7], 2.8);
  icons.lychee = {
    tags: ['lichi', 'litchi', 'rambután', 'postre asiático', 'lychee', 'rambutan', 'tropical fruit'],
    d: [skin, stem, lf],
    fill: { solid: [skin, lf], wire: [stem] },
    parts: { fruit: [0], stem: [1], leaf: [2] },
  };
}
{
  // Persimmon: a squat round under its large calyx, four broad sepals spread over its top as one
  // flat flower (the fruit's edge ends on it), and a stub of stem
  const body = ell([12, 14.75], 8.75, 6.25);
  const k = [12, 8.9];
  const sepal = (B, w) => [sub(k, mul(sub(B, k), 1.4 / len(sub(B, k)))), B, w];
  const calyx = rosette([sepal([12, 12.6], 3.6), sepal([4.6, 9.7], 3.9), sepal([19.4, 9.7], 3.9), sepal([12, 5.9], 3.2)], k);
  const stem = line([12, 6.25], [12, 3.75]);
  icons.persimmon = {
    tags: ['caqui', 'persimo', 'kaki', 'otoño', 'persimmon', 'kaki', 'autumn'],
    d: [visible(body, calyx), calyx, stem],
    fill: { solid: [body, calyx], cut: seams([calyx, body]), wire: [stem] },
    parts: { fruit: [0], calyx: [1], stem: [2] },
  };
}

// ── Melons ────────────────────────────────────────────────────────────────────────────────────
{
  // Watermelon: a half-disc slice, the rind as a band along the curve and three seeds
  const c = [12, 7];
  const slice = `M2 ${f(c[1])}H22A10 10 0 0 1 2 ${f(c[1])}Z`;
  const rind = arcd(...c, 7.15, 0, 180);
  const seeds = [dot(9.4, 9.8, 0.3), dot(14.6, 9.8, 0.3), dot(12, 11.25, 0.3)];
  icons.watermelon = {
    tags: ['sandía', 'patilla', 'verano', 'hidratación', 'watermelon', 'summer', 'hydration'],
    d: [slice, rind, ...seeds],
    fill: { solid: [slice], cut: [rind, ...seeds] },
    parts: { slice: [0], rind: [1], seeds: [2, 3, 4] },
  };
}
{
  // Melon: a crescent slice standing like a boat, the rind as a line along its curve and its seeds in a
  // row along the middle of the flesh (the watermelon's slice is a half disc)
  const I = [12, 0.444, 11.06];
  const slice = `M2.75 6.5A9.92 9.92 0 1 0 21.25 6.5A${f(I[2])} ${f(I[2])} 0 0 1 2.75 6.5Z`;
  const [r0, r1] = meet([12, 10.08, 6.92], I).sort((p, q) => p[0] - q[0]);
  const rind = `M${pt(r0)}A6.92 6.92 0 1 0 ${pt(r1)}`;
  const seeds = [[8.9, 13.66], [12, 14.25], [15.1, 13.66]].map((p) => dot(...p, 0.3));
  icons.melon = {
    tags: ['melón', 'cantalupo', 'chino', 'melon', 'cantaloupe', 'honeydew'],
    d: [slice, rind, ...seeds],
    fill: { solid: [slice], cut: [rind, ...seeds] },
    parts: { slice: [0], rind: [1], seeds: [2, 3, 4] },
  };
}

// ── Roots ─────────────────────────────────────────────────────────────────────────────────────
// The carrot in its own frame: the crown end at the origin (rounded), the root tapering along +x to
// its tip; two short slanted rings near the crown, and its top: three leaves fanning back from the
// crown as one frond, behind the root. It lies on the diagonal, its tip at the bottom left.
const CARROT = (() => {
  const body = roundpoly([[-1.5, -3.5], [13.75, 0], [-1.5, 3.5]], [2.5, 0.8, 2.5]);
  const edge = (x, s) => [x, s * 3.5 * (1 - (x + 1.5) / 15.25)];
  const e1 = edge(1, -1);
  const e2 = edge(4.25, 1);
  const rings = many(line(e1, add(e1, [1.45, 1.4])), line(e2, add(e2, [1.45, -1.4])));
  const k = [-0.4, 0];
  const frond = rosette(
    [
      [[0.6, 0], [-7.5, 0], 2.8],
      [[0.4, 0.5], [-6.3, -3.9], 2.7],
      [[0.4, -0.5], [-6.3, 3.9], 2.7],
    ],
    k,
  );
  return { body, rings, frond };
})();
{
  const put = (d) => place(d, 135, [14.1, 10]);
  const [body, rings, frond] = [put(CARROT.body), put(CARROT.rings), put(CARROT.frond)];
  const top = visible(frond, body);
  icons.carrot = {
    tags: ['zanahoria', 'verduras', 'hortalizas', 'raíces', 'carrot', 'vegetables', 'root vegetable'],
    d: [body, rings, top],
    fill: { solid: [body, frond], cut: [rings, ...seams([body, frond])] },
    parts: { root: [0, 1], top: [2] },
  };
  // Forked: the same carrot splitting into two legs below its middle
  const legs = put(roundpoly([[-1.5, -3.5], [5.5, -2.3], [13.4, -3], [7.6, 0], [12.4, 3.6], [5.5, 2.3], [-1.5, 3.5]], [2.5, 1.5, 0.7, 0.6, 0.7, 1.5, 2.5]));
  const top2 = visible(frond, legs);
  icons['carrot-forked'] = {
    tags: ['zanahoria chueca', 'fruta fea', 'rescate de alimentos', 'wonky carrot', 'ugly produce', 'food rescue'],
    d: [legs, top2],
    fill: { solid: [legs, frond], cut: seams([legs, frond]) },
    parts: { root: [0], top: [1] },
  };
}
{
  // Potato: a lumpy oval at a slant with three eyes scattered along it
  const body = place(blob([[-8.6, 0.6], [-6.6, -3.9], [-1.4, -5.1], [4.6, -4.9], [8.6, -2.4], [8.9, 2.1], [4.9, 4.9], [-1.6, 5.1], [-6.6, 4.1]]), -16, [12, 12.4]);
  const eyes = [dot(...add([12, 12.4], rotate([-4.4, 0.9], -16))), dot(...add([12, 12.4], rotate([0.4, -1.6], -16))), dot(...add([12, 12.4], rotate([4.6, 1.2], -16)))];
  icons.potato = {
    tags: ['papa', 'patata', 'tubérculo', 'papas fritas', 'potato', 'root vegetable', 'starch'],
    d: [body, ...eyes],
    fill: { solid: [body], cut: eyes },
    parts: { tuber: [0], eyes: [1, 2, 3] },
  };
}
{
  // Sweet potato: a plump, lumpy spindle at a slant, tapering at both ends into a thin root; two
  // creases across its skin, set apart along it (side by side at its middle they read as a face)
  const local = blob([[0, 0], [2.6, -3.2], [6.6, -4.8], [10.8, -4.5], [14.2, -2.6], [16.4, 0.2], [13.6, 3.2], [8.8, 4.4], [3.9, 3.3]], 1);
  const tips = many(line([0, 0], [-2, 0.5]), line([16.4, 0.2], [18.2, -0.6]));
  const crease = (x, m) => curve([x, m - 1.3], [[[x + 0.55, m - 0.5], [x + 0.55, m + 0.5], [x, m + 1.3]]]);
  const put = (d) => place(d, -24, [3.5, 15.7]);
  const d = [put(local), put(many(crease(5.9, -0.3), crease(10.9, -0.1))), put(tips)];
  icons['sweet-potato'] = {
    tags: ['camote', 'batata', 'boniato', 'sweet potato', 'yam', 'root vegetable'],
    d,
    fill: { solid: [d[0]], cut: [d[1]], wire: [d[2]] },
    parts: { tuber: [0, 1], roots: [2] },
  };
}
{
  // Cassava: a long club with two bark rings, its cut end an ellipse with the center dot
  const face = ell([0, 0], 3, 4.25);
  const body = curve([0, -4.25], [[[7, -4.25], [16.5, -2.6], [16.5, 0]], [[16.5, 2.6], [7, 4.25], [0, 4.25]]]);
  const ring = (x, bow) => {
    const hw = (t) => 4.25 - (t / 16.5) ** 2 * 3.1;
    return `M${pt([x, -hw(x) + 0.15])}Q${pt([x + bow, 0])} ${pt([x, hw(x) - 0.15])}`;
  };
  const at = [16.4, 8.2];
  const put = (d) => place(d, 140, at);
  const d = [put(body), put(face), put(many(ring(5.5, 1.4), ring(9.75, 1.2))), dot(...at)];
  // Filled, the face comes apart from the root: the half of its edge that lies on the root is cut
  // and runs on out through the silhouette at both ends (the face and the root meet there tangent,
  // so a cut that only reached the edge would leave them joined by a sliver)
  const rim = put('M0 -5.85V-4.25A3 4.25 0 0 1 0 4.25V5.85');
  icons.cassava = {
    tags: ['yuca', 'mandioca', 'tubérculo', 'cassava', 'manioc', 'yuca'],
    d,
    fill: { solid: [shut(d[0]), d[1]], cut: [rim, d[2], d[3]] },
    parts: { root: [0, 2], face: [1, 3] },
  };
}
{
  // Beet, halved: a round root ending in a tail, its rings inside and two leaves on top
  const body = sym([12, 7.6], [
    [[15.9, 7.6], [18.9, 10.2], [18.9, 13.5]],
    [[18.9, 17.1], [15.1, 19.6], [12, 21.6]],
  ]);
  const ring = circ(12, 13.85, 3.25);
  const lfs = [leaf([7.1, 2.75], [12, 7.6], 2.6), leaf([12, 7.6], [16.9, 2.75], 2.6)];
  icons.beet = {
    tags: ['betabel', 'remolacha', 'betarraga', 'jugo de betabel', 'beet', 'beetroot'],
    d: [body, ring, dot(12, 13.85), ...lfs],
    fill: { solid: [body, ...lfs], cut: [ring, dot(12, 13.85)] },
    parts: { root: [0, 1, 2], leaves: [3, 4] },
  };
}
{
  // Radish: a small round bulb with its thin tail and two leaves on top
  const bulb = circ(12, 13.4, 5.6);
  const tail = line([12, 19], [12, 21.5]);
  const lfs = [leaf([6.3, 2.9], [12, 7.8], 3), leaf([12, 7.8], [17.7, 2.9], 3)];
  icons.radish = {
    tags: ['rábano', 'rabanito', 'daikon', 'ensalada', 'radish', 'daikon', 'garnish'],
    d: [bulb, tail, ...lfs],
    fill: { solid: [bulb, ...lfs], wire: [tail] },
    parts: { root: [0, 1], leaves: [2, 3] },
  };
}
{
  // Turnip: a bulb wide at the top, the band where its color changes, a taproot and three leaves
  const bulb = sym([12, 8.1], [
    [[15.6, 8.1], [18.9, 8.6], [18.9, 11.6]],
    [[18.9, 15.6], [14.9, 18.6], [12, 19.1]],
  ]);
  const band = 'M5.25 12.25Q12 14.75 18.75 12.25';
  const tail = line([12, 19.1], [12, 21.5]);
  const lfs = [leaf([7.1, 3.1], [12, 8.1], 2.4), leaf([12, 8.1], [12, 2.5], 2.4), leaf([12, 8.1], [16.9, 3.1], 2.4)];
  icons.turnip = {
    tags: ['nabo', 'colinabo', 'raíz', 'turnip', 'rutabaga', 'root vegetable'],
    d: [bulb, band, tail, ...lfs],
    fill: { solid: [bulb, ...lfs], cut: [band], wire: [tail] },
    parts: { root: [0, 1, 2], leaves: [3, 4, 5] },
  };
}
{
  // Ginger: a knobby rhizome lying on its side, plump pieces grown from one another at angles and of
  // different lengths, traced as one outline (the union of the pieces, its crotches rounded); the two
  // longest are ringed across near where they grow
  const arms = [
    [[5, 16.6], [11.6, 16.3], 3.1],
    [[10.6, 14.6], [15.6, 7.8], 2.3],
    [[12.4, 16.2], [19, 13.8], 2.2],
    [[6.6, 14.8], [5.6, 10.6], 1.9],
  ];
  const sdf = (x, y) => Math.min(...arms.map(([A, B, r]) => {
    const ab = sub(B, A);
    const t = Math.max(0, Math.min(1, ((x - A[0]) * ab[0] + (y - A[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
    return len(sub([x, y], add(A, mul(ab, t)))) - r;
  }));
  const body = blob(contour(sdf, 0.7));
  // A ring across a piece at `t` along it, from edge to edge; filled, it stops 1.5 short of them
  const ring = ([A, B, r], t, short = 0) => {
    const u = mul(sub(B, A), 1 / len(sub(B, A)));
    const c = lerp(A, B, t);
    const k = r - short;
    return line(add(c, [u[1] * k, -u[0] * k]), sub(c, [u[1] * k, -u[0] * k]));
  };
  const rings = many(ring(arms[1], 0.62), ring(arms[2], 0.62));
  const cuts = many(ring(arms[1], 0.62, 1.5), ring(arms[2], 0.62, 1.5));
  icons.ginger = {
    tags: ['jengibre', 'cúrcuma', 'raíz', 'té de jengibre', 'ginger', 'turmeric', 'root'],
    d: [body, rings],
    fill: { solid: [body], cut: [cuts] },
    parts: { root: [0], rings: [1] },
  };
}

// ── Onions and garlic ─────────────────────────────────────────────────────────────────────────
{
  // Onion: a round bulb rising to a point, its layers as a lens inside and a tuft of roots
  const bulb = sym([12, 2.9], [
    [[12.5, 4.6], [12.9, 6.1], [14, 7.1]],
    [[16.9, 8.6], [19.2, 10.6], [19.2, 13.6]],
    [[19.2, 17], [16, 19.25], [12, 19.25]],
  ]);
  const layers = leaf([12, 2.9], [12, 19.25], 7);
  const tuft = roots([12, 19.25], 2, 2.2);
  // Filled, the layers stop short of the tip and the root, which would otherwise be cut off
  icons.onion = {
    tags: ['cebolla', 'verdura', 'aromáticos', 'sofrito', 'onion', 'aromatics'],
    d: [bulb, layers, tuft],
    fill: { solid: [bulb], cut: [clear(layers, 2.4, bulb)], wire: [tuft] },
    parts: { bulb: [0, 1], roots: [2] },
  };
}
{
  // A slice of onion: two rings and the lens of its heart
  const r = [ell([12, 12], 9, 8.3, -10), ell([12, 12], 6, 5.3, -10), leaf(add([12, 12], rotate([-2.6, 0], -10)), add([12, 12], rotate([2.6, 0], -10)), 2.6)];
  icons['onion-slice'] = {
    tags: ['aro de cebolla', 'rodaja de cebolla', 'topping', 'onion ring', 'sliced onion', 'burger topping'],
    d: r,
    fill: { solid: [r[0]], cut: [r[1], r[2]] },
    parts: { rings: [0, 1], heart: [2] },
  };
}
{
  // Spring onions: two of them side by side, each a tall white bulb with its roots tapering into
  // its leaves, one straight up and one bending out
  const one = (x, out) => {
    const bulb = tear([x, 12.4], [x, 17.9], 2.2);
    const leaves = many(line([x, 12.4], [x - out * 0.6, 2.75]), curve([x, 12.4], [[[x + out * 1.6, 9.6], [x + out * 3.6, 6.6], [x + out * 6.1, 4.6]]]));
    return [bulb, leaves, roots([x, 20.1], 1.5, 1.6)];
  };
  const a = one(8.4, -1);
  const b = one(15.6, 1);
  icons['spring-onion'] = {
    tags: ['cebollín', 'cebolla de cambray', 'cebolleta', 'spring onion', 'scallion', 'green onion'],
    d: [a[0], b[0], a[1], b[1], a[2], b[2]],
    fill: { solid: [a[0], b[0]], wire: [a[1], b[1], a[2], b[2]] },
    parts: { bulbs: [0, 1], leaves: [2, 3], roots: [4, 5] },
  };
}
{
  // Leek: one long thick stalk on the diagonal, white toward its roots, opening at the other end into
  // a V of two broad leaves
  const body = roundpoly([[0, -2.75], [10, -2.75], [19.25, -5.6], [12.6, 0], [18.4, 4.9], [10, 2.75], [0, 2.75]], [1.6, 2.4, 1, 0.8, 1, 2.4, 1.6]);
  const band = line([6.5, -2.75], [6.5, 2.75]);
  const tuft = many(line([0, 0], [-1.6, -1.3]), line([0, 0], [-2, 0]), line([0, 0], [-1.6, 1.3]));
  const put = (d) => place(d, -42, [5.6, 18.1]);
  const d = [put(body), put(band), put(tuft)];
  icons.leek = {
    tags: ['poro', 'puerro', 'sopas', 'leek', 'soup', 'vegetable'],
    d,
    fill: { solid: [d[0]], cut: [d[1]], wire: [d[2]] },
    parts: { stalk: [0, 1], roots: [2] },
  };
}
{
  // Garlic: wider than the onion and set apart from it by its neck, the dry stalk cut flat on top,
  // and by its base, three cloves bulging under it; the middle clove is marked by two lines that rise
  // from the notches of the base and stop below the neck (the onion's layers run tip to root)
  const bulb = sym([12, 2.75], [
    [[12.65, 2.75], [13.15, 2.85], [13.15, 3.5]],
    [[13.15, 5.3], [13.4, 6.5], [15, 7.6]],
    [[18, 9.5], [20.1, 11.4], [20.1, 14.3]],
    [[20.1, 17.5], [18.3, 19.6], [16.5, 19.6]],
    [[15.7, 19.6], [15.2, 19.3], [14.85, 18.8]],
    [[14.35, 19.6], [13.35, 20.15], [12, 20.15]],
  ]);
  const seg = [[15.5, 11.2], [16.1, 15.6], [14.85, 18.8]];
  const line1 = curve([13.5, 9.6], [seg]);
  const cloves = many(line1, flipPath(line1));
  const tuft = roots([12, 20.15], 1.7, 1.8);
  // Filled, the lines run on through the notches (the base's lobes come apart) and stop short of
  // the neck
  const through = `${line1}L${pt(add(seg[2], [-0.25, 1.6]))}`;
  icons.garlic = {
    tags: ['ajo', 'cabeza de ajo', 'aromáticos', 'sabor', 'garlic', 'garlic bulb', 'aromatics'],
    d: [bulb, cloves, tuft],
    fill: { solid: [bulb], cut: [many(through, flipPath(through))], wire: [tuft] },
    parts: { bulb: [0, 1], roots: [2] },
  };
}
{
  // A garlic clove: a teardrop with one flat side curving to its tip, the ridge along its back
  const clove = 'M11.6 3.1C15.9 6.6 18.9 12.6 16.9 18.2C16.4 19.7 15.1 20.75 13.1 20.75H9.4C7.9 20.75 7 19.8 7.2 18.2C7.7 13.4 9.2 7.9 11.6 3.1Z';
  const ridge = 'M11.6 3.1C13.9 7.1 14.6 12.6 13.7 17.6';
  icons['garlic-clove'] = {
    tags: ['diente de ajo', 'ajo picado', 'receta', 'garlic clove', 'minced garlic', 'recipe'],
    d: [clove, ridge],
    // Filled, the ridge stops short of the tip, which would otherwise be cut off
    fill: { solid: [clove], cut: [clear(ridge, 2.4, clove)] },
    parts: { clove: [0, 1] },
  };
}

// ── Stalks ────────────────────────────────────────────────────────────────────────────────────
{
  // Celery: one stalk on the diagonal, its rib running up from its cut foot, and three pointed leaves
  // fanning out from its top, each on its own (they end on the stalk); filled, it is its silhouette
  const L = 13.2;
  const stalk = roundpoly([[0, -2.6], [L, -2.4], [L, 2.4], [0, 2.6]], [1.56, 0.6, 0.6, 1.56]);
  const E = [L - 0.5, 0];
  const side = (s) => {
    const A = add(E, [0, 1.3 * s]);
    return leaf(A, add(A, polar(0, 0, 5.6, 60 * s)), 2.6);
  };
  const put = (d) => place(d, -45, [4.4, 19.6]);
  const S = put(stalk);
  const lfs = [leaf(E, add(E, [7, 0]), 3), side(-1), side(1)].map(put);
  const rib = put(line([0, 0], [L - 3, 0]));
  icons.celery = {
    tags: ['apio', 'verdura', 'alérgeno', 'crudités', 'celery', 'allergen', 'vegetable'],
    d: [S, ...lfs.map((x) => visible(x, S)), rib],
    fill: { solid: [S, ...lfs], cut: [rib] },
    parts: { stalk: [0, 4], leaves: [1, 2, 3] },
  };
}
{
  // Asparagus: three spears in a bundle on the diagonal, their budded tips staggered, a band tied
  // across them (the spears end on it)
  const spear = (y, a, L) => {
    const dir = rotate([1, 0], a);
    const tip = add([0, y], mul(dir, L));
    const c = sub(tip, mul(dir, 3.3));
    return [tear(tip, c, 1.35), line([0, y], sub(c, mul(dir, 1.35)))];
  };
  const sp = [spear(0, 0, 19.5), spear(-3.3, -6, 16.6), spear(3.3, 6, 16.6)];
  const put = (d) => place(d, -45, [4.75, 19.25]);
  const band = put(sq(2.9, -6, 3, 12, 1.5));
  const tips = sp.map((x) => put(x[0]));
  const spears = sp.map((x) => visible(put(x[1]), band));
  icons.asparagus = {
    tags: ['espárragos', 'primavera', 'guarnición', 'asparagus', 'spring vegetable', 'side dish'],
    d: [band, ...tips, ...spears],
    fill: { solid: [band, ...tips], wire: spears },
    parts: { band: [0], tips: [1, 2, 3], spears: [4, 5, 6] },
  };
}
{
  // Artichoke: an egg of pointed bracts on a short stem, each row in front of the one above it
  const bract = (x, y, r, h) => tear([x, y - r - h], [x, y], r);
  const rows = [bract(12, 16, 3.3, 2.2), bract(7.9, 14.4, 3, 2.1), bract(16.1, 14.4, 3, 2.1), bract(9.6, 9.6, 2.9, 2.2), bract(14.4, 9.6, 2.9, 2.2), bract(12, 6.6, 2.4, 2.2)];
  const d = rows.map((b, i) => (i ? visible(b, ...rows.slice(0, i)) : b));
  const stem = line([12, 19.3], [12, 21.5]);
  icons.artichoke = {
    tags: ['alcachofa', 'alcaucil', 'mediterráneo', 'artichoke', 'mediterranean', 'vegetable'],
    d: [...d, stem],
    fill: { solid: rows, cut: seams(rows, 0), wire: [stem] },
    parts: { bracts: d.map((_, i) => i), stem: [d.length] },
  };
}
{
  // Bamboo shoot: a tall cone cut flat at the base, its sheaths wrapping it from alternate sides, each
  // edge sweeping up to the far side (a zigzag of leaves, never a hat's parallel stripes)
  const cone = 'M7 21.1C6.6 15.6 8.9 7.8 12 2.75C15.1 7.8 17.4 15.6 17 21.1Z';
  const sheaths = many(inside('M5.4 18.6C9.4 17.6 13.9 15.6 18.4 12.2', cone), inside('M18.2 10.9C14.8 10.5 10.8 8.9 7.4 5.4', cone));
  icons['bamboo-shoot'] = {
    tags: ['brote de bambú', 'bambú', 'cocina asiática', 'bamboo shoot', 'bamboo', 'asian cooking'],
    d: [cone, sheaths],
    fill: { solid: [cone], cut: [sheaths] },
    parts: { shoot: [0], sheaths: [1] },
  };
}
{
  // Nopal: a tall oval pad with its spines, a smaller pad budding from its top (closing on it)
  const pad = [[10.6, 14.4], 5.1, 7.6, 12];
  const bud = ellOutside([[15.4, 6.4], 2.6, 3.6, 35], pad);
  const spines = [dot(10.4, 10.6), dot(11.4, 14.9), dot(9.4, 18.4)];
  const padD = ell(...pad);
  icons.nopal = {
    tags: ['nopal', 'nopales', 'cactus comestible', 'cocina mexicana', 'nopal', 'cactus pad'],
    d: [padD, bud, ...spines],
    fill: { solid: [padD, shut(bud)], cut: spines },
    parts: { pad: [0, 2, 3, 4], bud: [1] },
  };
}

// ── Leafy greens ──────────────────────────────────────────────────────────────────────────────
/**
 * A spoon-shaped leaf in its own frame: its base at the origin, `L` long up the -y axis and `w` wide
 * near the top, which is round (lettuce, bok choy).
 */
const spoon = (L, w) => sym([0, -L], [
  [[0.3 * w, -L], [w / 2, -0.88 * L], [w / 2, -0.68 * L]],
  [[w / 2, -0.42 * L], [0.18 * w, -0.2 * L], [0, 0]],
], 0);
{
  // Lettuce: a tall open head, leaves fanning from the base; the middle one in front (the others
  // end on it) with its rib
  const base = [12, 21.25];
  const front = place(spoon(18.4, 8.6), 0, base);
  const sides = [place(spoon(14.2, 7), -27, base), place(spoon(14.2, 7), 27, base)];
  const rib = line([12, 21.25], [12, 9.4]);
  icons.lettuce = {
    tags: ['lechuga', 'hojas verdes', 'ensalada', 'romana', 'lettuce', 'salad', 'romaine'],
    d: [front, ...sides.map((x) => visible(x, front)), rib],
    fill: { solid: [front, ...sides], cut: [...seams([front, ...sides]), rib] },
    parts: { head: [0, 1, 2], rib: [3] },
  };
}
{
  // Cabbage: a round, smooth, tight head with the edge of a leaf wrapped over its top (as each
  // brussels sprout's), cradled by two outer leaves in front of it (a custom badge) whose veins
  // show; the cauliflower's dome is bumpy and its leaves plain
  const c = [12, 10.6];
  const head = circ(...c, 7.1);
  const [p, q] = [polar(...c, 7.1, 195), polar(...c, 7.1, 300)];
  const m = lerp(p, q, 0.5);
  const wrap = `M${pt(p)}Q${pt(lerp(m, c, 0.5))} ${pt(q)}`;
  const tips = [[2.9, 10.2], [21.1, 10.2]];
  const base = [12, 21];
  const lfs = [leaf(base, tips[0], 6.2), leaf(tips[1], base, 6.2)];
  const veins = tips.map((t) => line(base, lerp(base, t, 0.62)));
  icons.cabbage = {
    tags: ['repollo', 'col', 'crucífera', 'ensalada de col', 'cabbage', 'coleslaw', 'cruciferous'],
    d: [head, wrap],
    fill: { solid: [head], cut: [wrap] },
    parts: { head: [0, 1] },
    badge: { d: [...lfs, ...veins], knock: many(...lfs), fill: { solid: lfs, cut: veins } },
  };
}
/**
 * A stalk ending in a broad leaf, in its own frame: its foot at the origin, rising up the -y axis
 * `L` long; the stalk `a` half-wide at its foot narrowing to `b` where the leaf begins (at `s`), the
 * leaf `W` half-wide and round at its tip (bok choy).
 */
const paddle = (L, W, s, b, a) => sym([0, -L], [
  [[W * 0.62, -L], [W, -L + W * 0.75], [W, -L + W * 1.6]],
  [[W, -s - 2.2], [b, -s - 1.2], [b, -s]],
  [[b, -s * 0.5], [a, -2.4], [a, -1.2]],
  [[a, -0.45], [a * 0.6, 0], [0, 0]],
], 0);
{
  // Bok choy: a vase of three stalks gathered at one foot, each opening into a broad round leaf; the
  // middle one in front, the side ones leaning out behind it (their feet hidden in its foot)
  const front = place(paddle(18.5, 3.4, 9.4, 1.8, 2.6), 0, [12, 21.25]);
  const sides = [place(paddle(16.2, 3.1, 8.6, 1.55, 1.7), -17, [11.7, 20.4]), place(paddle(16.2, 3.1, 8.6, 1.55, 1.7), 17, [12.3, 20.4])];
  icons['bok-choy'] = {
    tags: ['bok choy', 'pak choi', 'col china', 'verduras asiáticas', 'bok choy', 'pak choi', 'asian greens'],
    d: [front, ...sides.map((x) => visible(x, front))],
    fill: { solid: [front, ...sides], cut: seams([front, ...sides]) },
    parts: { head: [0, 1, 2] },
  };
}
{
  // Kale: one long leaf with a ruffled edge, its midrib running into the stem
  const A = [0, 0];
  const L = 15;
  const W = 4.6;
  const side = (s) => {
    const n = 5;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [t * L, s * W * Math.sin(Math.PI * t) ** 0.8];
    });
    let d = '';
    for (let i = 0; i < n; i++) d += `A1.9 1.9 0 0 ${s > 0 ? 0 : 1} ${pt(pts[i + 1])}`;
    return { pts, d };
  };
  const up = side(-1);
  const lo = side(1);
  const back = [...lo.pts].reverse();
  let loD = '';
  for (let i = 0; i < back.length - 1; i++) loD += `A1.9 1.9 0 0 1 ${pt(back[i + 1])}`;
  const local = `M${pt(A)}${up.d}${loD}Z`;
  const put = (d) => place(d, -45, [7.4, 17.6]);
  icons.kale = {
    tags: ['kale', 'col rizada', 'acelga', 'superalimento', 'kale', 'chard', 'superfood'],
    d: [put(local), put(line([-3.4, 0], [10.6, 0]))],
    fill: { solid: [put(local)], cut: [put(line([0, 0], [10.6, 0]))], wire: [put(line([-3.4, 0], [0, 0]))] },
    parts: { leaf: [0], rib: [1] },
  };
}
{
  // Spinach: three smooth spoon-shaped leaves on long stems, gathered at the bottom
  const G = [12, 21.4];
  const one = (a, d, rx, ry) => {
    const c = add(G, rotate([0, -(d + ry)], a));
    return [ell(c, rx, ry, a), line(G, add(G, rotate([0, -d], a)))];
  };
  const m = one(0, 6.9, 2.55, 4.1);
  const l = one(-47, 4.4, 2.45, 3.6);
  const r = one(47, 4.4, 2.45, 3.6);
  const stems = many(m[1], l[1], r[1]);
  icons.spinach = {
    tags: ['espinaca', 'espinacas', 'hojas verdes', 'hierro', 'spinach', 'leafy greens', 'iron'],
    d: [m[0], l[0], r[0], stems],
    fill: { solid: [m[0], l[0], r[0]], wire: [stems] },
    parts: { leaves: [0, 1, 2], stems: [3] },
  };
}

// ── Cruciferous ───────────────────────────────────────────────────────────────────────────────
/** The outline of circles [x, y, r] ordered clockwise around c, each crossing the next (a crown). */
function crown(cs, c) {
  const n = cs.length;
  const X = cs.map((P, i) => meet(P, cs[(i + 1) % n]).sort((p, q) => len(sub(q, c)) - len(sub(p, c)))[0]);
  let d = `M${pt(X[n - 1])}`;
  cs.forEach((P, i) => {
    const a0 = angOf(P, X[(i - 1 + n) % n]);
    const a1 = angOf(P, X[i]);
    const span = (((a1 - a0) % 360) + 360) % 360;
    d += `A${f(P[2])} ${f(P[2])} 0 ${span > 180 ? 1 : 0} 1 ${pt(X[i])}`;
  });
  return `${d}Z`;
}
{
  // Broccoli: a cloud of florets on a thick stem that flares under it
  const floret = crown([[7.1, 10.9, 3.3], [9.9, 6.6, 3.7], [14.4, 6.6, 3.7], [17, 10.9, 3.3], [12, 12.1, 3.6]], [12, 9.6]);
  const stem = 'M10.1 15.15C10.6 16.6 10.75 18.6 10.6 21.25H13.4C13.25 18.6 13.4 16.6 13.9 15.15';
  icons.broccoli = {
    tags: ['brócoli', 'verdura verde', 'crucífera', 'broccoli', 'greens', 'cruciferous'],
    d: [floret, stem],
    fill: { solid: [floret, shut(stem)] },
    parts: { floret: [0], stem: [1] },
  };
}
{
  // Cauliflower: a wide bumpy dome cradled by a leaf on each side (in front, a custom badge)
  const dome = crown([[6.3, 13.6, 3.1], [7.9, 9.1, 3.2], [12, 6.6, 3.6], [16.1, 9.1, 3.2], [17.7, 13.6, 3.1], [12, 13.4, 5]], [12, 11]);
  const lfs = [leaf([12, 20.6], [3.1, 10.4], 4.6), leaf([20.9, 10.4], [12, 20.6], 4.6)];
  icons.cauliflower = {
    tags: ['coliflor', 'crucífera', 'bajo en carbohidratos', 'cauliflower', 'low-carb', 'cruciferous'],
    d: [dome],
    fill: { solid: [dome] },
    parts: { head: [0] },
    badge: { d: lfs, knock: many(...lfs), fill: { solid: lfs } },
  };
}
{
  // Brussels sprouts: three small round heads in a pile, each with the edge of its outer leaf
  const cs = [[8.4, 15.6, 4.4], [15.6, 15.6, 4.4], [12, 9.36, 4.4]];
  const heads = cluster(cs);
  const shapes = cs.map(([x, y, r]) => circ(x, y, r));
  const leafLine = ([x, y, r], a0, a1) => {
    const [p, q] = [polar(x, y, r, a0), polar(x, y, r, a1)];
    const m = lerp(p, q, 0.5);
    return `M${pt(p)}Q${pt(add(m, mul(sub([x, y], m), 0.55)))} ${pt(q)}`;
  };
  const lines = many(leafLine(cs[0], 110, 200), leafLine(cs[1], -30, 70), leafLine(cs[2], 205, 300));
  icons['brussels-sprouts'] = {
    tags: ['coles de bruselas', 'crucífera', 'guarnición', 'brussels sprouts', 'sprouts', 'side dish'],
    d: [...heads, lines],
    fill: { solid: shapes, cut: [...seams(shapes), lines] },
    parts: { heads: heads.map((_, i) => i), leaves: [heads.length] },
  };
}

// ── Squash and gourds ─────────────────────────────────────────────────────────────────────────
/** The y on a cubic segment where it passes x (by bisection; the segment must be monotonic in x). */
function yAtX(p0, seg, x) {
  let [lo, hi] = [0, 1];
  const inc = seg[2][0] > p0[0];
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (bez(p0, seg, m)[0] < x === inc) lo = m;
    else hi = m;
  }
  return bez(p0, seg, lo)[1];
}
{
  // Pumpkin: a wide round with three ribs and a thick short stem
  const T = [12, 7.6];
  const s1 = [[13.6, 6.1], [21, 5.9], [21, 13.6]];
  const body = sym(T, [s1, [[21, 19.4], [17, 20.75], [12, 20.75]]]);
  const ribs = leaf(T, [12, 20.75], 8.4);
  const yR = yAtX(T, s1, 13.2);
  const stem = `M10.8 ${f(yR)}C10.8 5.4 11.1 4 12.1 2.9L13.6 3.9C13.1 4.6 13.2 5.6 13.2 ${f(yR)}`;
  icons.pumpkin = {
    tags: ['calabaza', 'zapallo', 'otoño', 'halloween', 'pumpkin', 'autumn', 'pumpkin spice'],
    d: [body, ribs, stem],
    fill: { solid: [body, shut(stem)], cut: [ribs] },
    parts: { body: [0, 1], stem: [2] },
  };
}
{
  // Butternut squash: lying on the diagonal, its round bulb at the low end and its long neck rising
  // to the stem
  const local = curve([11.4, -2.6], [
    [[13.4, -2.6], [14.4, -1.6], [14.4, 0]],
    [[14.4, 1.6], [13.4, 2.6], [11.4, 2.6]],
    [[8.4, 2.6], [6.6, 2.4], [4.4, 3.6]],
    [[2.6, 4.7], [1.2, 4.8], [-0.2, 4.8]],
    [[-3.2, 4.8], [-5, 2.8], [-5, 0]],
    [[-5, -2.8], [-3.2, -4.8], [-0.2, -4.8]],
    [[1.2, -4.8], [2.6, -4.7], [4.4, -3.6]],
    [[6.6, -2.4], [8.4, -2.6], [11.4, -2.6]],
  ], true);
  const put = (d) => place(d, -40, [7.4, 15.4]);
  const d = [put(local), put(line([14.4, 0], [16.75, 0]))];
  icons['butternut-squash'] = {
    tags: ['calabaza de castilla', 'calabaza moscada', 'zapallo', 'butternut squash', 'winter squash', 'squash'],
    d,
    fill: { solid: [d[0]], wire: [d[1]] },
    parts: { body: [0], stem: [1] },
  };
}
{
  // Zucchini: a long straight body at a slant, its flared stem cap and one lengthwise stripe
  const body = 'M13.6 -3C13.6 -3 3 -3 3 -3A3 3 0 0 0 3 3H13.6Z';
  const cap = roundpoly([[13.6, -3.6], [16.2, -1.2], [16.2, 1.2], [13.6, 3.6]], [0.6, 0.5, 0.5, 0.6]);
  const stem = line([16.2, 0], [18.3, 0]);
  const stripe = line([4.4, 0], [10.6, 0]);
  const put = (d) => place(d, -40, [3.2, 17.9]);
  const d = [put(body), put(cap), put(stem), put(stripe)];
  icons.zucchini = {
    tags: ['calabacita', 'calabacín', 'zucchini', 'courgette', 'summer squash'],
    d,
    fill: { solid: [d[0], d[1]], wire: [d[2]], cut: [d[3]] },
    parts: { body: [0, 3], cap: [1, 2] },
  };
}
{
  // Cucumber: a long rounded body with its bumps, and a round slice in front of its end showing the
  // seeds (the body ends on it)
  const at = [4.9, 15.9];
  const capsule = place('M0 -2.9H11.6A2.9 2.9 0 0 1 11.6 2.9H0A2.9 2.9 0 0 1 0 -2.9Z', -45, at);
  const bumps = [dot(...add(at, rotate([3.2, 0], -45))), dot(...add(at, rotate([7.8, 0], -45)))];
  const slice = circ(16.25, 16.25, 4.75);
  const core = circ(16.25, 16.25, 1.6);
  icons.cucumber = {
    tags: ['pepino', 'ensalada', 'encurtidos', 'fresco', 'cucumber', 'pickles', 'fresh'],
    d: [visible(capsule, slice), ...bumps, slice, core],
    fill: { solid: [capsule, slice], cut: [...seams([slice, capsule]), ...bumps, core] },
    parts: { body: [0, 1, 2], slice: [3, 4] },
  };
}

// ── Nightshades ───────────────────────────────────────────────────────────────────────────────
{
  // Eggplant: a curved teardrop body at a slant under its calyx, three sepals drooping over its top
  // as one cap (the body ends on it), and the stem
  const body = sym([12, 6.2], [
    [[14.2, 6.2], [15.8, 7.6], [16.3, 9.6]],
    [[16.9, 12.4], [18.9, 13.6], [18.9, 16.6]],
    [[18.9, 19.6], [15.9, 21.25], [12, 21.25]],
  ]);
  const k = [12, 6.8];
  const sepal = (B, w) => [sub(k, mul(sub(B, k), 1.4 / len(sub(B, k)))), B, w];
  const cap = rosette([sepal([7.4, 10.2], 3.4), sepal([12, 12.1], 3.4), sepal([16.6, 10.2], 3.4), sepal([12, 4.6], 3.6)], k);
  const stem = line([12, 4.6], [12.6, 2.2]);
  const t = (d) => turnPath(d, 28, [12, 12]);
  const [B, C] = [t(body), t(cap)];
  icons.eggplant = {
    tags: ['berenjena', 'verdura', 'eggplant', 'aubergine', 'vegetable'],
    d: [visible(B, C), C, t(stem)],
    fill: { solid: [B, C], cut: seams([C, B]), wire: [t(stem)] },
    parts: { body: [0], cap: [1], stem: [2] },
  };
}
{
  // Bell pepper: blocky, three lobes at the bottom (two seams rising from them) and its stem curving
  // over the top
  const T = [12, 7.6];
  const s1 = [[13.4, 6.4], [15.4, 6.1], [17, 6.4]];
  const body = sym(T, [
    s1,
    [[18.9, 6.8], [19.6, 9.1], [19.4, 12.6]],
    [[19.2, 16.6], [18.9, 20.75], [16.9, 20.75]],
    [[15.9, 20.75], [15.1, 20.1], [14.5, 19.4]],
    [[13.9, 20.4], [13, 21], [12, 21]],
  ]);
  const lobes = many('M14.5 19.4C14.9 17.4 14.9 15.4 14.5 13.6', 'M9.5 19.4C9.1 17.4 9.1 15.4 9.5 13.6');
  const stem = 'M12 7.6C12 5.6 12.5 4 14.6 3.25';
  icons['bell-pepper'] = {
    tags: ['pimiento', 'morrón', 'chile morrón', 'bell pepper', 'capsicum', 'sweet pepper'],
    d: [body, lobes, stem],
    fill: { solid: [body], cut: [lobes], wire: [stem] },
    parts: { body: [0, 1], stem: [2] },
  };
}
{
  // Chili pepper: a slim pod curving to a pointed tip, its cap and a bent stem
  const pod = 'M0 -2.4C6.6 -2.4 12.6 -0.2 16.4 6.4C11.4 3.4 6 2.4 0 2.4Z';
  const cap = roundpoly([[-2.4, -2.9], [0, -2.9], [0, 2.9], [-2.4, 2.9]], [1.1, 0.4, 0.4, 1.1]);
  const stem = rline([[-2.4, 0], [-4.4, 0], [-5.4, -2.3]], [0, 1.2, 0]);
  const put = (d) => place(d, 38, [8.6, 6.9]);
  const d = [put(pod), put(cap), put(stem)];
  icons['chili-pepper'] = {
    tags: ['chile', 'jalapeño', 'picante', 'chili pepper', 'hot pepper', 'spicy'],
    d,
    fill: { solid: [d[0], d[1]], wire: [d[2]] },
    parts: { pod: [0], cap: [1], stem: [2] },
  };
}
{
  // Tomato: a slightly squat round under its small star of a calyx, five narrow sepals lying flat on
  // top (the fruit's edge ends on them), and the stem
  const body = ell([12, 13.9], 8.75, 7.25);
  const k = [12, 7.6];
  const sepal = (a, r, w) => {
    const B = add(k, [r * Math.cos((a * Math.PI) / 180), 0.55 * r * Math.sin((a * Math.PI) / 180)]);
    return [sub(k, mul(sub(B, k), 1.2 / len(sub(B, k)))), B, w];
  };
  const calyx = rosette([sepal(-162, 5.4, 2.6), sepal(-18, 5.4, 2.6), sepal(126, 5, 2.6), sepal(54, 5, 2.6), sepal(-90, 3.8, 2.4)], k);
  const stem = line([12, 5.5], [12.6, 2.75]);
  icons.tomato = {
    tags: ['jitomate', 'tomate', 'salsas', 'ensalada', 'tomato', 'sauce', 'salad'],
    d: [visible(body, calyx), calyx, stem],
    fill: { solid: [body, calyx], cut: seams([calyx, body]), wire: [stem] },
    parts: { fruit: [0], calyx: [1], stem: [2] },
  };
}

// ── Corn, pods and legumes ────────────────────────────────────────────────────────────────────
{
  // Corn on the cob, at a slant: the cob with its kernel grid and two husk leaves peeled down to the
  // sides (in front, a custom badge)
  const t = (d) => turnPath(d, 30, [12, 12.6]);
  const cob = t('M8.75 18V6A3.25 3.25 0 0 1 15.25 6V18');
  const grid = t(many(line([12, 2.75], [12, 13.25]), line([8.75, 6.75], [15.25, 6.75]), line([8.75, 10], [15.25, 10]), line([8.75, 13.25], [15.25, 13.25])));
  const husks = [leaf([12, 21.3], [4.4, 11.6], 4), leaf([19.6, 11.6], [12, 21.3], 4)].map(t);
  icons.corn = {
    tags: ['elote', 'maíz', 'mazorca', 'corn', 'maize', 'corn on the cob'],
    d: [cob, grid],
    fill: { solid: [shut(cob)], cut: [grid] },
    parts: { cob: [0], kernels: [1] },
    badge: { d: husks, knock: many(...husks), fill: { solid: husks } },
  };
}
{
  // Okra: a pod tapering like a bullet to its tip, its ridge running down from the cap, the conical
  // cap and the stem
  const pod = 'M0 -3.6C5 -3.6 9.5 -3 14.6 0C9.5 3 5 3.6 0 3.6Z';
  const cap = roundpoly([[0, -3.6], [-2.6, -1], [-2.6, 1], [0, 3.6]], [0.4, 0.6, 0.6, 0.4]);
  const put = (d) => place(d, 135, [16.6, 7.4]);
  const d = [put(pod), put(line([0, 0], [7, 0])), put(cap), put(line([-2.6, 0], [-5, 0]))];
  icons.okra = {
    tags: ['okra', 'quimbombó', 'gombo', 'okra', 'gumbo', 'curry'],
    d,
    fill: { solid: [d[0], d[2]], cut: [d[1], put(line([0, -3.6], [0, 3.6]))], wire: [d[3]] },
    parts: { pod: [0, 1], cap: [2, 3] },
  };
}
{
  // Peas: an open pod in a gentle curve, three peas showing above its near wall (each closes on the
  // wall and on the pea in front of it)
  const O = [0, -3.75, 9.75];
  const I = [0, -26.25, 27.75];
  const pod = `M-9 0A${f(O[2])} ${f(O[2])} 0 0 0 9 0A${f(I[2])} ${f(I[2])} 0 0 1 -9 0Z`;
  const yI = (x) => I[1] + Math.sqrt(I[2] ** 2 - x * x);
  const ps = [[0, yI(0) - 0.6, 2.55], [-4.6, yI(-4.6) - 0.6, 2.55], [4.6, yI(4.6) - 0.6, 2.55]];
  const peas = ps.map(([x, y, r], i) => {
    const front = ps.slice(0, i).filter(([u, v, s]) => Math.hypot(u - x, v - y) < r + s);
    const occl = [I, ...front];
    const cuts = occl.flatMap((c) => meet([x, y, r], c).map((p) => (angOf([x, y], p) + 360) % 360)).sort((a, b) => a - b);
    const seen = (a) => {
      const p = polar(x, y, r, a);
      return Math.hypot(p[0] - I[0], p[1] - I[1]) < I[2] && front.every(([u, v, s]) => Math.hypot(p[0] - u, p[1] - v) > s);
    };
    const spans = cuts.map((a, k) => [a, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + 360]).filter(([a, b]) => seen((a + b) / 2));
    return many(...spans.map(([a, b]) => arcd(x, y, r, a, b)));
  });
  const put = (d) => place(d, -18, [12, 12.6]);
  const d = [put(pod), ...peas.map(put)];
  const shapes = [put(pod), ...ps.map(([x, y, r]) => put(circ(x, y, r)))];
  icons.peas = {
    tags: ['chícharos', 'guisantes', 'arvejas', 'vaina', 'peas', 'pea pod', 'legumes'],
    d,
    fill: { solid: shapes, cut: seams(shapes) },
    parts: { pod: [0], peas: [1, 2, 3] },
  };
}
{
  // Green beans: three slender pods side by side on the diagonal, each as wide all along as it is, its
  // tail pointed and its stem at the top; the gap between them is wider than a pod, so they read as
  // three pods and not as a hatch, and the outer two are shorter, in the round of the live area
  const pod = (L, s, hw) => {
    const N = 22;
    const P = (t) => [t * L - L / 2, s * 4 * t * (1 - t)];
    const W = (t) => (t < 0.08 ? hw * Math.sqrt(t / 0.08) : t > 0.76 ? hw * ((1 - t) / 0.24) ** 0.85 : hw);
    const right = [];
    const left = [];
    for (let i = 1; i < N; i++) {
      const c = P(i / N);
      right.push([c[0], c[1] + W(i / N)]);
      left.push([c[0], c[1] - W(i / N)]);
    }
    return blob([P(0), ...right, P(1), ...left.reverse()], 1);
  };
  // Each pod in its own frame (stem end at -L/2), set `off` across the row and `along` it
  const one = (L, off, along) => {
    const at = (d) => place(move(d, along, off), 135, [12, 12]);
    return [at(pod(L, 0.7, 1.3)), at(line([-L / 2, 0], [-L / 2 - 1.75, 0.5]))];
  };
  const ps = [one(15.6, 0, 0.2), one(11.4, -6.9, 0.6), one(11.4, 6.9, 0.6)];
  const stems = many(...ps.map((x) => x[1]));
  icons['green-beans'] = {
    tags: ['ejotes', 'judías verdes', 'vainitas', 'green beans', 'string beans', 'vegetable'],
    d: [...ps.map((x) => x[0]), stems],
    fill: { solid: ps.map((x) => x[0]), wire: [stems] },
    parts: { pods: [0, 1, 2], stems: [3] },
  };
}
{
  // A bean: one kidney bean at a slant, the hilum a short line along its inner curve
  const local = 'M-7.6 -0.6C-7.6 -4.6 -3.6 -5.6 0.4 -5.4C4.6 -5.2 7.9 -3 7.9 0.8C7.9 4.4 5.1 5.9 2.4 5.6C0.6 5.4 0.1 3.4 -1.4 3.4C-2.9 3.4 -3.6 5.2 -5.4 5C-7 4.8 -7.6 2.9 -7.6 -0.6Z';
  const hilum = 'M-3.2 0.2Q-1.4 -0.6 0.4 0.2';
  const put = (d) => place(d, -22, [12, 12]);
  icons.bean = {
    tags: ['frijol', 'frijoles', 'legumbre', 'proteína vegetal', 'bean', 'legume', 'plant protein'],
    d: [put(local), put(hilum)],
    fill: { solid: [put(local)], cut: [put(hilum)] },
    parts: { bean: [0, 1] },
  };
}
{
  // Soybeans: a closed pod curving a little, three round bulges in a row, and the hook of its stem
  const cs = [[0, 0, 3.5], [5.4, -0.4, 3.6], [10.8, 0, 3.5]];
  const up = cs.slice(0, -1).map((P, i) => meet(P, cs[i + 1]).sort((p, q) => p[1] - q[1]));
  const [U, L] = [up.map((x) => x[0]), up.map((x) => x[1])];
  const A = (r, large, to) => `A${f(r)} ${f(r)} 0 ${large} 1 ${pt(to)}`;
  const pod = `M${pt(L[0])}${A(3.5, 1, U[0])}${A(3.6, 0, U[1])}${A(3.5, 1, L[1])}${A(3.6, 0, L[0])}Z`;
  const stem = 'M14.3 0C15.4 -0.3 16 -1.2 15.8 -2.3';
  const put = (d) => place(d, -32, [5.75, 15.75]);
  const d = [put(pod), put(stem)];
  icons.soybean = {
    tags: ['soya', 'soja', 'edamame', 'alérgeno', 'soybean', 'edamame', 'allergen'],
    d,
    fill: { solid: [d[0]], wire: [d[1]] },
    parts: { pod: [0], stem: [1] },
  };
}
{
  // Chickpea: a round with a small beak on top and the crease running down from it
  const body = place(citrusBody(7.2, 7.3, 2.6, 0), -78, [12.2, 13.6]);
  const beak = add([12.2, 13.6], rotate([7.2, -1.9], -78));
  const crease = `M${pt(beak)}C${pt(add(beak, [-1.9, 1.5]))} ${pt([9.5, 10.1])} ${pt([9.9, 13.4])}`;
  icons.chickpea = {
    tags: ['garbanzo', 'garbanzos', 'hummus', 'legumbre', 'chickpea', 'garbanzo', 'legumes'],
    d: [body, crease],
    fill: { solid: [body], cut: [crease] },
    parts: { pea: [0, 1] },
  };
}
{
  // Lentils: three flat discs seen at an angle in a loose heap, each closing on the one in front
  const F = [[10.4, 16.1], 4.9, 2.7, -6];
  const M = [[13.6, 11.6], 4.8, 2.6, 8];
  const B = [[10.2, 6.9], 4.6, 2.5, -4];
  const d = [ell(...F), ellOutside(M, F), ellOutside(B, M)];
  // Filled, each disc stays apart from the one behind it: its edge over it is cut
  const discs = [F, M, B].map((e) => ell(...e));
  icons.lentils = {
    tags: ['lentejas', 'legumbres', 'sopa', 'proteína vegetal', 'lentils', 'pulses', 'plant protein'],
    d,
    fill: { solid: discs, cut: seams(discs) },
    parts: { lentils: [0, 1, 2] },
  };
}

// ── Nuts and seeds ────────────────────────────────────────────────────────────────────────────
{
  // Peanut: a figure-eight shell at a slant, a line of its netting curving across each lobe
  const shell = sym([12, 2.75], [
    [[15.3, 2.75], [16.6, 5.4], [16.4, 7.6]],
    [[16.2, 9.4], [14.9, 10.6], [14.9, 12]],
    [[14.9, 13.4], [17, 14.6], [17, 17.1]],
    [[17, 19.6], [14.9, 21.25], [12, 21.25]],
  ]);
  const net = many('M10.6 6.6Q12 7.6 13.4 6.6', 'M10.4 16.8Q12 17.9 13.6 16.8');
  const t = (d) => turnPath(d, 36, [12, 12]);
  icons.peanut = {
    tags: ['cacahuate', 'maní', 'cacahuete', 'alérgeno', 'peanut', 'peanut butter', 'allergen'],
    d: [t(shell), t(net)],
    fill: { solid: [t(shell)], cut: [t(net)] },
    parts: { shell: [0, 1] },
  };
}
{
  // Almond: a pointed teardrop at a slant, two lines along it from the tip
  const nut = sym([12, 2.75], [
    [[14.4, 4.6], [17.9, 9.1], [17.9, 14.1]],
    [[17.9, 18.6], [15.4, 21.25], [12, 21.25]],
  ]);
  const lines = many('M12 2.75C10.4 6.9 9.9 11.6 10.4 16.6', 'M12 2.75C13.6 6.9 14.1 11.6 13.6 16.6');
  const t = (d) => turnPath(d, 24, [12, 12]);
  icons.almond = {
    tags: ['almendra', 'nueces', 'leche de almendra', 'almond', 'nuts'],
    d: [t(nut), t(lines)],
    // Filled, the lines stop short of the tip
    fill: { solid: [t(nut)], cut: [clear(t(lines), 2.4, t(nut))] },
  };
}
{
  // Walnut: a round shell with its center seam and one wrinkle on each half
  const shell = ell([12, 12], 9, 8.4);
  const seam = line([12, 3.6], [12, 20.4]);
  const wr = many('M8.4 8.2C6.9 9.6 9.2 11.2 7.9 12.6C6.7 13.9 8.6 14.9 7.6 15.8', 'M15.6 8.2C17.1 9.6 14.8 11.2 16.1 12.6C17.3 13.9 15.4 14.9 16.4 15.8');
  icons.walnut = {
    tags: ['nuez', 'nuez de castilla', 'frutos secos', 'walnut', 'tree nuts', 'nuts'],
    d: [shell, seam, wr],
    fill: { solid: [shell], cut: [seam, wr] },
    parts: { shell: [0, 1], wrinkles: [2] },
  };
}
{
  // Hazelnut: a round nut with a small point on top and the flat pale band at its base
  const nut = sym([12, 3.1], [
    [[13, 4.6], [14.4, 4.9], [16, 5.6]],
    [[18.9, 7.1], [20.1, 10.6], [19.6, 14.1]],
    [[19.3, 16.9], [18.6, 19.25], [16.6, 20.25]],
    [[15.4, 20.85], [13.9, 20.9], [12, 20.9]],
  ]);
  const band = 'M4.55 15.4Q12 17.6 19.45 15.4';
  icons.hazelnut = {
    tags: ['avellana', 'crema de avellana', 'frutos secos', 'hazelnut', 'filbert'],
    d: [nut, band],
    fill: { solid: [nut], cut: [band] },
  };
}
{
  // Cashew: a plump kidney curling like a comma, one end round and the other tapered
  const nut = blob([[8.4, 3.6], [12.4, 3.4], [14.6, 5.4], [13.4, 8.1], [10.6, 9.6], [9.9, 12.6], [11.6, 15.4], [15.4, 16.1], [17.6, 15.6], [18.6, 17.1], [16.6, 20.4], [11.6, 20.9], [6.6, 18.6], [4.4, 13.4], [4.9, 7.4]], 1);
  const d = turnPath(nut, -40, [11.6, 12.2]);
  icons.cashew = {
    tags: ['nuez de la india', 'anacardo', 'marañón', 'cashew', 'nuts', 'cashew milk'],
    d: [d],
    fill: { solid: [d] },
    parts: { nut: [0] },
  };
}
{
  // Chestnut: the nut, broad and coming to a small point, sitting in the open burr, a bowl of spines
  const burr = 'M5.1 13.4H18.9A6.9 6.9 0 0 1 5.1 13.4Z';
  const spikes = many(...[15, 40, 65, 90, 115, 140, 165].map((a) => line(polar(12, 13.4, 6.9, a), polar(12, 13.4, 8.4, a))));
  const nut = 'M6.4 13.4C6.4 9.6 8.4 7.1 10.9 6L12 4.6L13.1 6C15.6 7.1 17.6 9.6 17.6 13.4';
  const tip = line([12, 4.6], [12, 2.4]);
  icons.chestnut = {
    tags: ['castaña', 'castañas asadas', 'otoño', 'chestnut', 'roasted chestnuts', 'autumn'],
    d: [burr, spikes, nut, tip],
    fill: { solid: [burr, shut(nut)], wire: [spikes, tip], cut: seams([shut(nut), burr]) },
    parts: { burr: [0, 1], nut: [2, 3] },
  };
}
{
  // Sunflower seed: a narrow pointed teardrop, cut blunt at its base, with two stripes
  const seed = sym([12, 2.75], [
    [[13.9, 4.9], [16.9, 9.6], [16.9, 15.1]],
    [[16.9, 18.9], [15.4, 21.25], [12, 21.25]],
  ]);
  const stripes = many(line([10.5, 11.4], [10.5, 16.9]), line([13.5, 11.4], [13.5, 16.9]));
  const t = (d) => turnPath(d, -20, [12, 12]);
  icons['sunflower-seed'] = {
    tags: ['semilla de girasol', 'pipas', 'semillas', 'sunflower seed', 'seeds', 'snack'],
    d: [t(seed), t(stripes)],
    fill: { solid: [t(seed)], cut: [t(stripes)] },
    parts: { seed: [0, 1] },
  };
}
{
  // Sesame: three small teardrop seeds in a loose triangle
  const seed = 'M0 -3.4C1.6 -1.9 2.1 -0.4 2.1 0.9C2.1 2.4 1.2 3.4 0 3.4C-1.2 3.4 -2.1 2.4 -2.1 0.9C-2.1 -0.4 -1.6 -1.9 0 -3.4Z';
  const d = [place(seed, -24, [7.6, 15.6]), place(seed, 20, [16.4, 15.9]), place(seed, 4, [12.1, 7.1])];
  icons.sesame = {
    tags: ['ajonjolí', 'sésamo', 'semillas', 'alérgeno', 'sesame', 'seeds'],
    d,
    fill: { solid: d },
  };
}

// ── Herbs ─────────────────────────────────────────────────────────────────────────────────────
{
  // Fresh herbs: a bunch of three sprigs of different leaves (a pointed one, a three-lobed one and a
  // round one), their stems gathered and tied with a twine across them, the cut ends showing below it
  const band = line([8.5, 16.15], [15.5, 16.15]);
  const stems = many(line([10.35, 16.15], [6.3, 10.3]), line([12, 16.15], [12, 9.1]), line([13.65, 16.15], [17.53, 12.97]), line([10.35, 16.15], [9.15, 21.25]), line([12, 16.15], [12, 21.25]), line([13.65, 16.15], [14.85, 21.25]));
  const c = [12, 6.3];
  const trefoil = crown([[...polar(...c, 1.55, -90), 1.6], [...polar(...c, 1.55, 30), 1.6], [...polar(...c, 1.55, 150), 1.6]], c);
  const lfs = [leaf([6.3, 10.3], [2.75, 4.9], 3.3), trefoil, circ(19.3, 11.35, 2.4)];
  icons.herbs = {
    tags: ['hierbas', 'hierbas frescas', 'manojo', 'aromáticas', 'herbs', 'fresh herbs', 'aromatics'],
    d: [band, stems, ...lfs],
    fill: { solid: lfs, wire: [band, stems] },
    parts: { band: [0], stems: [1], leaves: [2, 3, 4] },
  };
}
{
  // Basil: a short stem topped by three broad cupped leaves, one up and two to the sides, each with
  // its midrib
  const c = [12, 13.4];
  const tips = [[12, 2.75], [3, 9.9], [21, 9.9]];
  const lfs = tips.map((t) => leaf(c, t, 6.2));
  const ribs = many(...tips.map((t) => line(c, lerp(c, t, 0.62))));
  const stem = line(c, [12, 21.4]);
  icons.basil = {
    tags: ['albahaca', 'pesto', 'cocina italiana', 'basil', 'pesto', 'italian cooking'],
    d: [...lfs, ribs, stem],
    fill: { solid: lfs, cut: [ribs], wire: [stem] },
    parts: { leaves: [0, 1, 2, 3], stem: [4] },
  };
}
{
  // Mint: a stem with two pairs of pointed leaves, the broad lower pair veined, and a bud at the top
  const stem = line([12, 21.4], [12, 6.6]);
  const low = [leaf([12, 17.6], [4.4, 15.4], 5), leaf([19.6, 15.4], [12, 17.6], 5)];
  const high = [leaf([12, 11.2], [6.6, 8.4], 4), leaf([17.4, 8.4], [12, 11.2], 4)];
  const veins = many(line([12, 17.6], lerp([12, 17.6], [4.4, 15.4], 0.62)), line([12, 17.6], lerp([12, 17.6], [19.6, 15.4], 0.62)));
  const bud = leaf([12, 6.6], [12, 2.6], 2.8);
  icons.mint = {
    tags: ['menta', 'hierbabuena', 'mojito', 'fresco', 'mint', 'mojito', 'fresh breath'],
    d: [stem, ...low, ...high, bud, veins],
    fill: { solid: [...low, ...high, bud], cut: [veins], wire: [stem] },
    parts: { stem: [0], leaves: [1, 2, 3, 4, 5, 6] },
  };
}
{
  // Rosemary: a straight stem at a slant with short needles along both sides
  const L = 17;
  const needles = [];
  for (let k = 0; k < 4; k++) {
    const x = 4.2 + k * 3.3;
    needles.push(line([x, 0], add([x, 0], rotate([2.7, 0], -60))), line([x + 1.65, 0], add([x + 1.65, 0], rotate([2.7, 0], 60))));
  }
  const put = (d) => place(d, -45, [5.4, 18.6]);
  icons.rosemary = {
    tags: ['romero', 'hierba', 'asados', 'rosemary', 'herb', 'roasting'],
    d: [put(line([0, 0], [L, 0])), put(many(...needles))],
    fill: false,
    parts: { stem: [0], needles: [1] },
  };
}
{
  // Parsley: three thin stems, each ending in a curly cluster of leaves
  const clump = (c) => crown([[c[0] - 1.5, c[1] + 0.5, 1.55], [c[0] - 0.4, c[1] - 1.5, 1.65], [c[0] + 1.5, c[1] - 0.6, 1.5], [c[0] + 0.9, c[1] + 1.2, 1.4]], c);
  const tops = [[5.9, 11.2], [12, 5.4], [18.1, 11.2]];
  const clumps = tops.map(clump);
  const G = [12, 21.4];
  icons.parsley = {
    tags: ['perejil', 'hierba', 'guarnición', 'parsley', 'garnish', 'herb'],
    d: [...clumps, many(...tops.map((t) => visible(line(G, t), clump(t))))],
    fill: { solid: clumps, wire: [many(...tops.map((t) => line(G, t)))] },
    parts: { leaves: [0, 1, 2], stems: [3] },
  };
}
{
  // Cilantro: one thin stem with three flat, round, lobed leaves on it, two on short stalks
  const fan = (c, a) => {
    const cs = [-50, 0, 50].map((da) => [...polar(...c, 1.6, a + da), 1.75]);
    return crown([...cs, [...polar(...c, 1.1, a + 180), 1.3]], c);
  };
  const lfs = [fan([7.4, 13.1], 200), fan([16.4, 5.2], -60), fan([18, 13.6], -20)];
  const stem = curve([11.4, 21.4], [[[11.6, 16.4], [12.6, 11.4], polar(16.4, 5.2, 2.4, 120)]]);
  const stalks = many(line([11.85, 15.9], polar(7.4, 13.1, 2.4, 20)), line([13.1, 10.6], polar(18, 13.6, 2.4, 160)));
  icons.cilantro = {
    tags: ['cilantro', 'culantro', 'coriandro', 'cocina mexicana', 'cilantro', 'coriander'],
    d: [...lfs, stem, stalks],
    fill: { solid: lfs, wire: [stem, stalks] },
    parts: { leaves: [0, 1, 2], stems: [3, 4] },
  };
}
{
  // Chives: a bundle of straight thin blades, one stem carrying a round blossom
  const blades = many(line([9, 21.25], [7, 3.6]), line([12, 21.4], [11.6, 2.75]));
  const stem = 'M15 21.25C15.4 16.4 16.1 12.4 17 9.4';
  const bloom = crown([0, 1, 2, 3, 4, 5].map((i) => [...polar(17.6, 6.4, 1.75, -90 + i * 60), 1.25]), [17.6, 6.4]);
  icons.chives = {
    tags: ['cebollín', 'ciboulette', 'cebolleta', 'hierba', 'chives', 'garnish'],
    d: [blades, stem, bloom],
    fill: { solid: [bloom], wire: [blades, stem] },
    parts: { blades: [0, 1], blossom: [2] },
  };
}
{
  // Bay leaves: two narrow pointed leaves crossed at their stems, each with its midrib
  const one = (base, tip, stemEnd) => [leaf(base, tip, 4.6), line(base, lerp(base, tip, 0.72)), line(base, stemEnd)];
  const a = one([10.2, 15.2], [3.4, 3.4], [14.2, 20.6]);
  const b = one([13.8, 15.2], [20.6, 3.4], [9.8, 20.6]);
  icons['bay-leaf'] = {
    tags: ['laurel', 'hojas de laurel', 'guisos', 'bay leaf', 'laurel', 'stew'],
    d: [a[0], b[0], many(a[1], a[2]), many(b[1], b[2])],
    fill: { solid: [a[0], b[0]], cut: [a[1], b[1]], wire: [a[2], b[2]] },
    parts: { leaves: [0, 1], ribs: [2, 3] },
  };
}

// ── Mushrooms ─────────────────────────────────────────────────────────────────────────────────
{
  // Mushroom: a rounded dome cap over a thick short stem
  const cap = 'M3 12.6C3 7.1 7 3.25 12 3.25C17 3.25 21 7.1 21 12.6C21 13.6 20.4 14 19.4 14H4.6C3.6 14 3 13.6 3 12.6Z';
  const stem = 'M9.1 14C9.1 16.9 8.9 18.9 9.6 20.2C10.1 21.1 13.9 21.1 14.4 20.2C15.1 18.9 14.9 16.9 14.9 14';
  icons.mushroom = {
    tags: ['champiñón', 'hongo', 'seta', 'mushroom', 'button mushroom', 'cremini'],
    d: [cap, stem],
    fill: { solid: [cap, shut(stem)] },
    parts: { cap: [0], stem: [1] },
  };
}
{
  // Shiitake: a wide, flat cap tipped toward us, its brim showing the band of its underside, on a
  // short stem set off center
  const cap = 'M2.75 12.6C3.6 8.9 7.6 6.4 12.6 6.4C17.4 6.4 21.25 8.1 21.25 10.4C21.25 11.4 20.6 12.1 19.6 12.6C16.9 14.4 13.4 15.4 9.9 15.4C6.6 15.4 4 14.4 2.75 12.6Z';
  const brim = 'M2.75 12.6C6.4 12.9 13.6 12.4 19.6 12.6';
  const stem = 'M10.6 15.4C10.6 17.9 10.2 19.8 9.6 21.25H14.4C13.9 19.8 13.6 17.9 13.6 15.05';
  icons.shiitake = {
    tags: ['shiitake', 'portobello', 'hongo', 'umami', 'shiitake', 'portobello', 'asian mushrooms'],
    d: [cap, brim, stem],
    fill: { solid: [cap, shut(stem)], cut: [brim] },
    parts: { cap: [0, 1], stem: [2] },
  };
}

// ── Grains ────────────────────────────────────────────────────────────────────────────────────
/**
 * An ear of grain: pairs of grains set up the stem, angled out and up, each lower pair in front of
 * the one above it (their outlines end on it). Returns the grains (front to back) as they are seen
 * and as closed shapes, the pairs and the base of the lowest pair.
 */
function ear(n, gl, gw, step, angle, top) {
  const rows = [];
  for (let k = 0; k < n; k++) {
    const base = [12, top + 4.4 + k * step];
    rows.push([[base, add(base, rotate([0, -gl], -angle)), gw], [base, add(base, rotate([0, -gl], angle)), gw]]);
  }
  const shapes = rows
    .slice()
    .reverse()
    .flat()
    .map((x) => leaf(...x));
  const seen = shapes.map((x, i) => (i ? visible(x, ...shapes.slice(0, i)) : x));
  return { shapes, seen, rows, lowest: [12, top + 4.4 + (n - 1) * step] };
}
{
  // Wheat: one cut ear, plump grains paired up its stem, no awns
  const e = ear(3, 5.4, 3.2, 4.6, 46, 2.75);
  const stem = line(e.lowest, [12, 21.4]);
  icons.wheat = {
    tags: ['trigo', 'cereales', 'pan', 'harina', 'gluten', 'wheat', 'grain', 'flour'],
    d: [...e.seen, stem],
    fill: { solid: e.shapes, cut: seams(e.shapes), wire: [stem] },
    parts: { ear: e.seen.map((_, i) => i), stem: [e.seen.length] },
  };
}
{
  // Barley: an upright ear, its long awns rising from the top grains
  const e = ear(3, 4.8, 3, 4.2, 40, 4.6);
  const awns = many(...e.rows[0].map(([A, B]) => line(B, add(B, rotate([0, -3.4], Math.sign(B[0] - A[0]) * 14)))));
  const stem = line(e.lowest, [12, 21.4]);
  icons.barley = {
    tags: ['cebada', 'malta', 'cerveza', 'barley', 'malt', 'brewing'],
    d: [...e.seen, awns, stem],
    fill: { solid: e.shapes, cut: seams(e.shapes), wire: [awns, stem] },
    parts: { ear: e.seen.map((_, i) => i), awns: [e.seen.length], stem: [e.seen.length + 1] },
  };
}
{
  // Oats: a stem arching over at the top, its spikelets dangling from long thin branches, in a
  // cascade under the arch
  const stem = 'M7.7 21.25C7.6 14.6 8.6 8.6 10.8 5.3C12.3 3.1 15.2 2.6 17.4 3.6';
  const hang = (at, top, end) => [line(at, top), leaf(top, end, 2.8)];
  const s = [hang([17.4, 3.6], [19.6, 5.6], [19.9, 10]), hang([10.25, 6.2], [15.8, 9.8], [16.1, 14.4]), hang([8.55, 11.6], [12.2, 15.6], [12.5, 20.2])];
  const branches = many(...s.map((x) => x[0]));
  icons.oats = {
    tags: ['avena', 'granola', 'fibra', 'cereal', 'oats', 'oatmeal', 'fiber'],
    d: [stem, ...s.map((x) => x[1]), branches],
    fill: { solid: s.map((x) => x[1]), wire: [stem, branches] },
    parts: { stem: [0, 4], spikelets: [1, 2, 3] },
  };
}
{
  // Whole grains: three plump kernels in a row fanning a little, the middle one in front, each with
  // the crease at its top
  const K = (c, rx, ry, t) => ({ c, rx, ry, t, d: ell(c, rx, ry, t) });
  const ks = [K([12, 12.6], 3.1, 5.1, 0), K([6.4, 13.9], 2.9, 4.8, -22), K([17.6, 13.9], 2.9, 4.8, 22)];
  const shapes = ks.map((k) => k.d);
  const creases = ks.map((k) => line(onEll(k.c, k.rx, k.ry, k.t, -90), add(k.c, rotate([0, -0.4], k.t))));
  icons.grains = {
    tags: ['granos', 'cereales integrales', 'arroz', 'quinoa', 'fibra', 'whole grains', 'rice', 'cereals'],
    d: [...shapes.map((x, i) => (i ? visible(x, ...shapes.slice(0, i)) : x)), many(...creases)],
    fill: { solid: shapes, cut: [...seams(shapes), ...creases] },
    parts: { kernels: [0, 1, 2], creases: [3] },
  };
}
{
  // Sugarcane: two jointed stalks side by side at a slant, a node ring at each joint, their ends cut
  // square, and one long leaf
  const stalk = (y) => [sq(0, y - 1.7, 16, 3.4, 0.9), many(...[5.3, 10.7].map((x) => line([x, y - 1.7], [x, y + 1.7])))];
  const [a, b] = [stalk(-3.2), stalk(3.2)];
  const lf = leaf([9.6, -4.9], [14.6, -9.4], 2.8);
  const put = (d) => place(d, -48, [5.4, 18.9]);
  const d = [put(a[0]), put(b[0]), put(a[1]), put(b[1]), put(lf)];
  icons.sugarcane = {
    tags: ['caña de azúcar', 'caña', 'jugo de caña', 'azúcar', 'sugarcane', 'raw sugar'],
    d,
    fill: { solid: [d[0], d[1], d[4]], cut: [d[2], d[3]] },
    parts: { stalks: [0, 1, 2, 3], leaf: [4] },
  };
}
{
  // Cacao: a ridged pod at a slant, pointed at its tip, two grooves along it and its short stem
  const pod = citrusBody(8.6, 5.4, 2.2, 0);
  const grooves = many('M-8.6 0C-5 -2.6 4 -2.6 8.6 -0.4', 'M-8.6 0C-5 2.6 4 2.6 8.6 0.4');
  const stem = line([-8.6, 0], [-10.6, 0]);
  const put = (d) => place(d, 52, [12.2, 12.4]);
  const d = [put(pod), put(grooves), put(stem)];
  icons.cacao = {
    tags: ['cacao', 'mazorca de cacao', 'chocolate', 'cocoa', 'cacao pod', 'bean to bar'],
    d,
    fill: { solid: [d[0]], cut: [d[1]], wire: [d[2]] },
    parts: { pod: [0, 1], stem: [2] },
  };
}

// ── The produce aisle ─────────────────────────────────────────────────────────────────────────
{
  // Produce: an apple and a carrot crossed, the carrot standing in front of the apple's right side
  // (a custom badge) so the apple keeps its stem and leaf; its top ends on its root, as on the carrot
  const apple = APPLE_D.map((d) => transform(flipPath(d), 0.82, 0.16, 3.1));
  const put = (d) => place(transform(d, 0.75, 0, 0), 122, [16.4, 9.1]);
  const [root, frond] = [put(CARROT.body), put(CARROT.frond)];
  icons.produce = {
    tags: ['frutas y verduras', 'sección de frutas', 'productos frescos', 'produce', 'fresh produce', 'five a day'],
    d: apple,
    fill: { solid: [apple[0], apple[2]], wire: [apple[1]] },
    parts: APPLE_PARTS,
    badge: { d: [root, visible(frond, root)], knock: many(root, frond), fill: { solid: [root, frond], cut: seams([root, frond]) } },
  };
}
// The produce crate: seen from the front, a slat across it and its square bottom-right corner (a
// container); two round fruits rise over its rim, the one in front with its stem and a leaf.
const CRATE = (() => {
  const box = sq(3.25, 12.25, 17.5, 9, 2.75, { square: ['br'] });
  const slat = line([3.25, 16.75], [20.75, 16.75]);
  const A = circ(8.4, 11.2, 3.4);
  const B = circ(14.6, 10.6, 3.6);
  const fruitB = visible(B, box);
  const fruitA = visible(A, box, B);
  const stem = line([14.6, 7], [15, 4.75]);
  const lf = leaf([15, 4.75], [19, 3.25], 2.6);
  return { d: [box, slat, fruitA, fruitB, stem, lf], shapes: [box, B, A] };
})();
// Filled, the slat runs on past the crate's sides: it parts the face cleanly at every weight
const CRATE_FILL = { solid: [...CRATE.shapes, CRATE.d[5]], cut: [line([1.25, 16.75], [22.75, 16.75]), ...seams(CRATE.shapes, 0)], wire: [CRATE.d[4]] };
const CRATE_PARTS = { crate: [0, 1], fruit: [2, 3, 4, 5] };
icons['produce-crate'] = {
  tags: ['caja de verduras', 'canasta', 'entrega de frutas', 'verdulería', 'produce box', 'veggie box', 'greengrocer'],
  d: CRATE.d,
  fill: CRATE_FILL,
  parts: CRATE_PARTS,
};
icons['produce-crate-sync'] = {
  tags: ['suscripción de verduras', 'caja semanal', 'entrega recurrente', 'produce subscription', 'weekly box', 'recurring delivery'],
  d: CRATE.d,
  fill: CRATE_FILL,
  parts: CRATE_PARTS,
  badge: badge('sync'),
};
icons['produce-crate-edit'] = {
  tags: ['personalizar caja', 'elegir verduras', 'editar pedido', 'customize box', 'edit order', 'choose produce'],
  d: CRATE.d,
  fill: CRATE_FILL,
  parts: CRATE_PARTS,
  badge: badge('edit'),
};
{
  // A mesh produce bag: a sack gathered at its neck by a tie and flaring above it, its diamond net
  // (two diagonals each way) on the body below the tie; a sack, not a fruit's oval under a crown
  const bag = 'M10.4 8.6C6.6 10.4 3.75 13.4 3.75 16.6C3.75 19.6 5.6 21.25 8.6 21.25H15.4C18.4 21.25 20.25 19.6 20.25 16.6C20.25 13.4 17.4 10.4 13.6 8.6C14.6 7.6 15.6 5.9 15.75 4.25L13.9 5.15L12 4.25L10.1 5.15L8.25 4.25C8.4 5.9 9.4 7.6 10.4 8.6Z';
  const body = 'M10.4 8.6C6.6 10.4 3.75 13.4 3.75 16.6C3.75 19.6 5.6 21.25 8.6 21.25H15.4C18.4 21.25 20.25 19.6 20.25 16.6C20.25 13.4 17.4 10.4 13.6 8.6Z';
  const tie = line([8.9, 8.6], [15.1, 8.6]);
  const net = many(...[
    line([1, 9.4], [15.6, 24]),
    line([6.4, 6.4], [21.4, 21.4]),
    line([23, 9.4], [8.4, 24]),
    line([17.6, 6.4], [2.6, 21.4]),
  ].map((x) => clear(inside(x, body), 2.4, tie)));
  icons['produce-bag'] = {
    tags: ['bolsa de malla', 'red', 'por bolsa', 'bolsa reutilizable', 'mesh bag', 'produce bag', 'reusable bag'],
    d: [bag, net, tie],
    fill: { solid: [bag], cut: [net, tie] },
    parts: { bag: [0, 1], tie: [2] },
  };
}
{
  // A fruit bowl: a shallow bowl in front, an apple and a banana rising above its rim (they end on
  // it)
  const bowl = 'M2.75 13.6H21.25C21.25 18.1 17.4 21.25 12 21.25C6.6 21.25 2.75 18.1 2.75 13.6Z';
  const apple = circ(9.1, 10.9, 4.1);
  const banana = 'M14.4 13.6C17.1 12.4 18.9 9.6 19.1 5.9L20.9 5.1C21.75 9.4 20.6 12.4 18.6 14.6Z';
  const stem = line([9.1, 6.8], [9.6, 4.6]);
  icons['fruit-bowl'] = {
    tags: ['frutero', 'tazón de fruta', 'fruta en casa', 'fruit bowl', 'healthy snacks', 'fruit'],
    d: [bowl, visible(apple, bowl), visible(banana, bowl), stem],
    fill: { solid: [bowl, apple, banana], cut: seams([bowl, apple, banana]), wire: [stem] },
    parts: { bowl: [0], fruit: [1, 2, 3] },
  };
}

export default { category: 'frutas-verduras', label: 'Frutas y verduras', icons };
