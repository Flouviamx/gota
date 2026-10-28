// Belleza y cuidado personal (beauty and personal care): makeup and its tools, nails, fragrance and
// skincare, haircare and its tools, barbering and the salon, oral care, the bath, and the studio.
// Everything is computed with the engine (engine/geometry.mjs) on the rules in DESIGN.md: a 1.5
// stroke, keylines, continuous corners, and the square bottom-right corner on containers (bottles,
// jars, tins, cans, the palette, the sachet); sticks, tubes, tools and organic shapes stay round.
//
// One piece per family, reused by its members: the lipstick (lipstick, cosmetics, makeup-bag), the
// polish brush (manicure, pedicure), the cream tube (cream-tube, sunscreen), the rolled towel, the
// salon chair, the toothbrush and the tint bowl carry their badges on the same drawing. Pens and
// brushes lean at 45° with their working end at the bottom left, as the set's pencil. A piece that
// passes behind another stops 3 center to center from it (behind(), as bebidas, cocina and rrhh
// draw it): nothing is trimmed by hand. Badges are the engine's.
import { badge, circ, dot, f, halfChord, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
const SQ = { square: ['br'] };
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** A frame: local points (x across, y along an axis whose "up" is -y) turned `deg` and moved to `origin`. */
const frame = (origin, deg) => (p) => add(origin, rot(p, [0, 0], deg));

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let o = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = rr[i];
    if (!r) {
      o += `L${P(V)}`;
      continue;
    }
    const u = minus(A, V);
    const w = minus(B, V);
    const [lu, lw] = [Math.hypot(...u), Math.hypot(...w)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    const t = r / Math.tan(th / 2);
    const S = add(V, mul(u, t / lu));
    const E = add(V, mul(w, t / lw));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** Smooth open curve through points (Catmull-Rom as cubics). */
function smooth(pts, k = 1 / 6) {
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    o += `C${P([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${P([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${P(p2)}`;
  }
  return o;
}
/** Smooth closed curve through points (Catmull-Rom as cubics). */
function blob(pts, k = 1 / 6) {
  const n = pts.length;
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    o += `C${P([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${P([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${P(p2)}`;
  }
  return `${o}Z`;
}
/** Ellipse with semi-axes rx, ry turned `tilt` degrees, as four cubics. */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const Q = (x, y) => add(c, rot([x, y], [0, 0], tilt));
  return `M${P(Q(rx, 0))}C${P(Q(rx, k * ry))} ${P(Q(k * rx, ry))} ${P(Q(0, ry))}C${P(Q(-k * rx, ry))} ${P(Q(-rx, k * ry))} ${P(Q(-rx, 0))}C${P(Q(-rx, -k * ry))} ${P(Q(-k * rx, -ry))} ${P(Q(0, -ry))}C${P(Q(k * rx, -ry))} ${P(Q(rx, -k * ry))} ${P(Q(rx, 0))}Z`;
}
/** Capsule (stadium) between the centers of its two round ends, `a` and `b`, of radius r. */
function rod(a, b, r) {
  const d = minus(b, a);
  const l = Math.hypot(...d);
  const n = [(-d[1] / l) * r, (d[0] / l) * r];
  const [a0, b0, b1, a1] = [add(a, n), add(b, n), minus(b, n), minus(a, n)];
  const R = halfChord(b0, b1);
  return `M${P(a0)}L${P(b0)}A${R} ${R} 0 0 0 ${P(b1)}L${P(a1)}A${R} ${R} 0 0 0 ${P(a0)}Z`;
}
/**
 * The mirror image (across x = 12) of an open path of cubics, walked back from its end to its start:
 * the other half of a symmetric shape whose first half runs from the axis out and back to it.
 */
function mirrorBack(d) {
  const segs = parse(d)[0].segs;
  const X = ([x, y]) => [24 - x, y];
  return segs
    .slice()
    .reverse()
    .map((s) => `C${P(X(s.p[2]))} ${P(X(s.p[1]))} ${P(X(s.p[0]))}`)
    .join('');
}
/**
 * A band of width 2r along the smooth curve through `pts`, its ends round: a thick ribbon drawn as
 * its outline (the paste out of a tube, a curved tooth).
 */
function band(pts, r, { flat = false } = {}) {
  const ring = samples(smooth(pts))[0];
  const L = [];
  for (let s = 0, i = 0; i < ring.length; i++) {
    if (i) s += Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
    if (i === 0 || i === ring.length - 1 || s >= 1.25) {
      L.push(i);
      s = 0;
    }
  }
  const at = L.map((i) => {
    const [a, b] = [ring[Math.max(0, i - 1)], ring[Math.min(ring.length - 1, i + 1)]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l];
    return [add(ring[i], mul(n, r)), minus(ring[i], mul(n, r))];
  });
  const left = at.map((p) => p[0]);
  const right = at.map((p) => p[1]).reverse();
  return `${smooth(left)}A${f(r)} ${f(r)} 0 0 0 ${P(right[0])}${smooth(right).replace(/^M[^C]*/, '')}${flat ? '' : `A${f(r)} ${f(r)} 0 0 0 ${P(left[0])}`}Z`;
}
/** Capsule (stadium) by its box: its short ends are half circles. */
const capsule2 = (x, y, w, h) => (w >= h ? rod([x + h / 2, y + h / 2], [x + w - h / 2, y + h / 2], h / 2) : rod([x + w / 2, y + w / 2], [x + w / 2, y + h - w / 2], w / 2));
/** Rectangle with plain rounded corners (small pieces: bands, collars, caps). */
const rrect = (x, y, w, h, r) => roundpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
/** lugares' water drop: the logomark's drop with its square corner pointing up. */
const waterDrop = ([cx, cy], r) => `M${P(polar(cx, cy, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${P(polar(cx, cy, r, -135))}L${P([cx, cy - r * Math.SQRT2])}Z`;
/** ia's sparkle: four points with concave sides. */
function sparkle(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const Q = (x, y) => P([cx + x * R, cy + y * R]);
  return `M${Q(0, -1)}C${Q(a, -b)} ${Q(b, -a)} ${Q(1, 0)}C${Q(b, a)} ${Q(a, b)} ${Q(0, 1)}C${Q(-a, b)} ${Q(-b, a)} ${Q(-1, 0)}C${Q(-b, -a)} ${Q(-a, -b)} ${Q(0, -1)}Z`;
}

// ── Paths as segments (bebidas' and rrhh's): behind() keeps what shows of a stroke ────────────
function arcSeg(p0, p1, r, large, sweep) {
  const x1 = (p0[0] - p1[0]) / 2;
  const y1 = (p0[1] - p1[1]) / 2;
  const lam = (x1 * x1 + y1 * y1) / (r * r);
  if (lam > 1) r *= Math.sqrt(lam);
  const num = r * r * r * r - r * r * y1 * y1 - r * r * x1 * x1;
  const den = r * r * y1 * y1 + r * r * x1 * x1;
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const c = [k * y1 + (p0[0] + p1[0]) / 2, -k * x1 + (p0[1] + p1[1]) / 2];
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let da = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  if (sweep && da < 0) da += 2 * Math.PI;
  if (!sweep && da > 0) da -= 2 * Math.PI;
  if (Math.abs(da) < 1e-9 && large) da = sweep ? 2 * Math.PI : -2 * Math.PI;
  return { t: 'A', c, r, a0, da };
}
function parse(d) {
  const tk = transform(d, 1, 0, 0).match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const subs = [];
  let [sp, i, cmd, x, y, sx, sy, lc] = [null, 0, '', 0, 0, 0, 0, null];
  const n = () => Number.parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    if (C === 'Z') {
      if (sp) {
        if (!near([x, y], [sx, sy], 1e-6)) sp.segs.push({ t: 'L', a: [x, y], b: [sx, sy] });
        sp.closed = true;
      }
      [x, y, lc, sp] = [sx, sy, null, null];
      continue;
    }
    if (C === 'M') {
      x = ox + n();
      y = oy + n();
      [sx, sy] = [x, y];
      sp = { segs: [], closed: false };
      subs.push(sp);
      cmd = rel ? 'l' : 'L';
      lc = null;
      continue;
    }
    if (!sp) {
      sp = { segs: [], closed: false };
      subs.push(sp);
      [sx, sy] = [x, y];
    }
    const a = [x, y];
    if (C === 'L' || C === 'H' || C === 'V') {
      if (C === 'L') {
        x = ox + n();
        y = oy + n();
      } else if (C === 'H') x = ox + n();
      else y = oy + n();
      sp.segs.push({ t: 'L', a, b: [x, y] });
      lc = null;
    } else if (C === 'C' || C === 'S') {
      const p1 = C === 'C' ? [ox + n(), oy + n()] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
      const p2 = [ox + n(), oy + n()];
      const p3 = [ox + n(), oy + n()];
      sp.segs.push({ t: 'C', p: [a, p1, p2, p3] });
      lc = p2;
      [x, y] = p3;
    } else if (C === 'A') {
      const r = n();
      n();
      n();
      const large = n();
      const sweep = n();
      const b = [ox + n(), oy + n()];
      sp.segs.push(arcSeg(a, b, r, large, sweep));
      [x, y] = b;
      lc = null;
    }
  }
  return subs;
}
function segPt(s, t) {
  if (s.t === 'L') return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
  if (s.t === 'A') {
    const g = s.a0 + s.da * t;
    return [s.c[0] + s.r * Math.cos(g), s.c[1] + s.r * Math.sin(g)];
  }
  const [p0, p1, p2, p3] = s.p;
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0], w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1]];
}
function splitC(p, t) {
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [a, b, c] = [L(p[0], p[1]), L(p[1], p[2]), L(p[2], p[3])];
  const [d, e] = [L(a, b), L(b, c)];
  const m = L(d, e);
  return [
    [p[0], a, d, m],
    [m, e, c, p[3]],
  ];
}
function segSub(s, t0, t1) {
  if (s.t === 'L') return { t: 'L', a: segPt(s, t0), b: segPt(s, t1) };
  if (s.t === 'A') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}
const segLen = (s) => {
  let [n, a] = [0, segPt(s, 0)];
  for (let k = 1; k <= 32; k++) {
    const b = segPt(s, k / 32);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
};
function segD(s) {
  if (s.t === 'L') return `L${P(s.b)}`;
  if (s.t === 'C') return `C${P(s.p[1])} ${P(s.p[2])} ${P(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(segSub(s, 0, 0.5)) + segD(segSub(s, 0.5, 1));
  return `A${f(s.r)} ${f(s.r)} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${P(segPt(s, 1))}`;
}
function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = segPt(sp.segs[0], 0);
    o += `M${P(last)}`;
    for (const s of sp.segs) {
      if (!near(segPt(s, 0), last)) o += `M${P(segPt(s, 0))}`;
      o += segD(s);
      last = segPt(s, 1);
    }
    if (sp.closed) o += 'Z';
  }
  return o;
}
/** Keeps only the parts of `d` where keep(p) holds; pieces shorter than `min` are dropped. */
function clip(d, keep, min = 0.3) {
  const out = [];
  for (const sp of parse(d)) {
    const pieces = [];
    sp.segs.forEach((s, i) => {
      const N = 96;
      let prev = keep(segPt(s, 0));
      let start = prev ? 0 : null;
      for (let k = 1; k <= N; k++) {
        const now = keep(segPt(s, k / N));
        if (now === prev) continue;
        let [lo, hi] = [(k - 1) / N, k / N];
        for (let j = 0; j < 30; j++) {
          const m = (lo + hi) / 2;
          if (keep(segPt(s, m)) === prev) lo = m;
          else hi = m;
        }
        if (prev) pieces.push({ i, t0: start, t1: lo });
        else start = hi;
        prev = now;
      }
      if (prev) pieces.push({ i, t0: start, t1: 1 });
    });
    if (pieces.length === sp.segs.length && pieces.every((p) => p.t0 === 0 && p.t1 === 1)) {
      out.push(sp);
      continue;
    }
    const chains = [];
    for (const pc of pieces) {
      const last = chains.at(-1)?.at(-1);
      if (last && last.t1 === 1 && pc.t0 === 0 && pc.i === last.i + 1) chains.at(-1).push(pc);
      else chains.push([pc]);
    }
    if (sp.closed && chains.length > 1) {
      const a = chains[0][0];
      const z = chains.at(-1).at(-1);
      if (a.i === 0 && a.t0 === 0 && z.i === sp.segs.length - 1 && z.t1 === 1) chains[0] = [...chains.pop(), ...chains[0]];
    }
    for (const ch of chains) {
      const segs = ch.map((pc) => segSub(sp.segs[pc.i], pc.t0, pc.t1));
      if (segs.reduce((n, s) => n + segLen(s), 0) >= min) out.push({ segs, closed: false });
    }
  }
  return ser(out);
}
/** Points along a path, every ~0.1 (to measure distances and test insides). */
const samples = (d) =>
  parse(d).map((sp) =>
    sp.segs.flatMap((s) => {
      const n = Math.max(2, Math.ceil(segLen(s) / 0.1));
      return Array.from({ length: n + 1 }, (_, k) => segPt(s, k / n));
    }),
  );
const inPoly = (ring, [px, py]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
/**
 * The part of `d` that shows behind the closed shapes `fronts`: whatever lies inside them or
 * closer than `gap` (center to center) to their outline is dropped, and so is any piece left
 * shorter than `min`. 3 center to center is the set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3, min = 2) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep, min)
    .split(/(?=M)/)
    .filter(Boolean);
}
/**
 * The fill of a shape drawn behind others (bebidas'): the piece behind() left of `back` closed along
 * the front shapes' outlines pushed out by `gap` (the knockout's own edge), so the filled body keeps
 * the same 1.5 of paper from the front ones that its outline does.
 */
function hug(piece, front, back, gap = 3) {
  const rings = [front].flat().map((d) => samples(d)[0]);
  const all = rings.flat();
  const backRing = samples(back)[0];
  const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const edge = rings
    .flatMap((ring) => {
      const n = ring.length - 1;
      const area = ring.slice(0, n).reduce((s, p, i) => s + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0);
      const out = area > 0 ? 1 : -1;
      return ring.slice(0, n).map((p, i) => {
        const [a, b] = [ring[(i - 1 + n) % n], ring[(i + 1) % n]];
        const [tx, ty] = [b[0] - a[0], b[1] - a[1]];
        const l = Math.hypot(tx, ty) || 1;
        return [p[0] + (out * gap * ty) / l, p[1] - (out * gap * tx) / l];
      });
    })
    .filter((q) => all.every((r) => dist(q, r) >= gap - 0.02) && inPoly(backRing, q));
  const segs = parse(piece)[0].segs;
  const [A, B] = [segPt(segs[0], 0), segPt(segs.at(-1), 1)];
  const left = new Set(edge.map((_, i) => i));
  const closest = (p) => [...left].reduce((k, i) => (k < 0 || dist(edge[i], p) < dist(edge[k], p) ? i : k), -1);
  const path = [];
  let cur = B;
  while (left.size) {
    const k = closest(cur);
    if (dist(edge[k], cur) > 0.6 || dist(cur, A) < 0.3) break;
    path.push(edge[k]);
    left.delete(k);
    cur = edge[k];
  }
  const keep = path.filter((_, i) => i % 6 === 0 || i === path.length - 1);
  return `${piece}${keep.map((q) => `L${P(q)}`).join('')}Z`;
}
/** The part of `d` inside the closed shape `shape` (a hatch across it, from edge to edge). */
const inside = (d, shape) => {
  const ring = samples(shape)[0];
  return clip(d, (p) => inPoly(ring, p), 0.3);
};
/** Where the outline `d` crosses the height y: its leftmost (side -1) or rightmost (side 1) x. */
function wallX(d, y, side) {
  const xs = [];
  for (const ring of samples(d))
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = [ring[i - 1], ring[i]];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
  return side < 0 ? Math.min(...xs) : Math.max(...xs);
}
/** A level across the outline `d` at height y, from wall to wall. */
const across = (d, y) => hl(wallX(d, y, -1), wallX(d, y, 1), y);

const icons = {};
const tag = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** The badges' center (DESIGN.md › Badges): pivots for the badge motions. */
const BC = [17.25, 17.25];

// ── Makeup ────────────────────────────────────────────────────────────────────────────────────
// Lipstick: the case, the narrower collar and the bullet rising from it, cut on a slant. Drawn at
// (12, 21.25) and placed smaller where it stands beside something else (cosmetics, the makeup bag).
const LIPSTICK = [
  sq(7.25, 13, 9.5, 8.25, 2.25),
  rline([[8.75, 13], [8.75, 9.75], [15.25, 9.75], [15.25, 13]], [0, 0.75, 0.75, 0]),
  rline([[10, 9.75], [10, 6.5], [14, 2.75], [14, 9.75]], [0, 1, 1.25, 0]),
];
tag('lipstick', ['labial', 'lápiz labial', 'maquillaje', 'tono', 'lipstick', 'lip color', 'makeup'], LIPSTICK);

// Lip balm: the lips, their cupid's bow and the line between them, and the stick at 60° about to touch
// them, its low dome toward the upper lip. The stick alone with its cap beside it read as a padlock
// and a D; the lips say what it is for.
const LIP_BALM = (() => {
  const upper = 'M2.75 17.5C4.25 15.25 5.5 14.25 6.75 14.25C7.75 14.25 8.25 15 8.75 15C9.25 15 9.75 14.25 10.75 14.25C12 14.25 13.25 15.25 14.75 17.5';
  const lower = 'M14.75 17.5C13 20 11 21.25 8.75 21.25C6.5 21.25 4.5 20 2.75 17.5';
  const F = frame([15, 11.5], 30);
  const stick = roundpoly([F([-2.5, -2.25]), F([2.5, -2.25]), F([2.5, -9]), F([-2.5, -9])], [0.6, 0.6, 2.25, 2.25]);
  const dome = rline([F([-1.6, -2.25]), F([-1.6, 0]), F([1.6, 0]), F([1.6, -2.25])], [0, 1.4, 1.4, 0]);
  return { d: [upper, lower, hl(2.75, 14.75, 17.5), stick, dome], lips: `${upper}${lower.replace(/^M[^C]*/, '')}Z` };
})();
tag('lip-balm', ['bálsamo labial', 'protector labial', 'labios resecos', 'cuidado de labios', 'lip balm', 'chapstick', 'lip care'], LIP_BALM.d);

// Mascara: the slim tube standing at the left with its neck, the wand drawn out leaning beside it:
// the grip (the tube's cap), the rod and the brush, a row of bristles across the rod.
const MASCARA = (() => {
  const F = frame([13.75, 21.25], 18);
  const grip = roundpoly([F([-2, -7.5]), F([2, -7.5]), F([2, 0]), F([-2, 0])], 1);
  const rodD = line(F([0, -7.5]), F([0, -18]));
  const bristles = [-11.75, -14.75, -17.75].map((y) => line(F([-1.75, y]), F([1.75, y])));
  return [sq(2.75, 8.75, 5.5, 12.5, 2), rline([[4, 8.75], [4, 6], [7, 6], [7, 8.75]], [0, 0.6, 0.6, 0]), grip, rodD, ...bristles];
})();
tag('mascara', ['rímel', 'máscara de pestañas', 'pestañas', 'maquillaje de ojos', 'mascara', 'lashes', 'eye makeup'], MASCARA);

// Eyeliner: a fine-tipped liner pen at 45°, its tip finishing the winged flick it has just drawn (a
// stroke that thickens from the inner corner and tapers to the pen's tip).
const EYELINER = (() => {
  const F = frame([10.75, 13.75], 45);
  const pen = roundpoly([F([0, 0]), F([1.75, -4]), F([1.75, -13]), F([-1.75, -13]), F([-1.75, -4])], [0.35, 0.6, 1.2, 1.2, 0.6]);
  const band = line(F([-1.75, -7.5]), F([1.75, -7.5]));
  const T = F([0, 0]);
  const top = smooth([T, [8.5, 16.25], [5.25, 17.75], [2.75, 18.25]]);
  const bottom = smooth([[2.75, 18.25], [6.25, 19.75], [9.5, 18.5], T]);
  const flick = `${top}${bottom.replace(/^M[^C]*/, '')}Z`;
  return [pen, band, flick];
})();
tag('eyeliner', ['delineador', 'kohl', 'ojo de gato', 'maquillaje de ojos', 'eyeliner', 'winged liner', 'cat eye'], EYELINER);

// Brow pencil: a dual-ended pencil at 45°, the sharpened lead at the bottom left and the spoolie at
// the other end: a rod with three slanted bristles, the twist of a spiral brush (square across, they
// read as a syringe's plunger).
const BROW_PENCIL = (() => {
  const F = frame([4.5, 19.5], 45);
  const body = roundpoly([F([0, 0]), F([1.75, -4.25]), F([1.75, -11]), F([-1.75, -11]), F([-1.75, -4.25])], [0.35, 0.5, 0.6, 0.6, 0.5]);
  const wood = line(F([-1.75, -4.25]), F([1.75, -4.25]));
  const spoolie = line(F([0, -11]), F([0, -21.5]));
  const bristles = [-14.75, -17.85, -20.95].map((y) => line(F([-1.9, y + 0.7]), F([1.9, y - 0.7])));
  return [body, wood, spoolie, ...bristles];
})();
tag('brow-pencil', ['lápiz de cejas', 'cejas', 'microblading', 'perfilar cejas', 'brow pencil', 'eyebrow pencil', 'brow products'], BROW_PENCIL);

// Eyebrow: one arched brow, thick at its inner end and tapering to a point at the tail, hair strokes
// across it from the inner end to the arch.
const BROW = 'M3.25 12.75C6.5 9.75 10.75 6.75 14.5 6.75C17.25 6.75 19.5 8.5 21.25 11.25C19 10 16.75 9.75 14.5 10.25C11 11 7.25 13.75 4.75 16.75C3.75 17.25 2.75 16.75 2.75 15.5C2.75 14.5 2.75 13.5 3.25 12.75Z';
tag('eyebrow', ['ceja', 'diseño de cejas', 'laminado', 'depilación con hilo', 'eyebrow', 'brow shaping', 'brow tint'], [
  BROW,
  ...[[[4.5, 17.75], [6.25, 10.25]], [[7.75, 15.25], [9.5, 7.75]], [[11, 12.75], [12.75, 5.75]], [[14.5, 11.5], [16, 5.25]]].map(([a, b]) => inside(line(a, b), BROW)),
]);

// Eyeshadow palette: a landscape compact holding six round pans of color in two rows, solid (as rings
// their holes closed to a speck at the heavy weights).
tag('eyeshadow-palette', ['paleta de sombras', 'sombras', 'maquillaje de ojos', 'colores', 'eyeshadow palette', 'eyeshadow', 'shades'], [
  sq(2.5, 5, 19, 14, 3.5, SQ),
  ...[9.15, 14.85].flatMap((y) => [6.65, 12, 17.35].map((x) => dot(x, y))),
]);

// Liquid foundation: a squat square glass bottle, a short neck under its cylindrical cap and the
// liquid level at half height (a cap straight on the square body read as a padlock).
const FOUNDATION = sq(5.5, 10.25, 13, 11, 3.5, SQ);
tag('foundation', ['base de maquillaje', 'base líquida', 'tono de piel', 'cobertura', 'foundation', 'liquid foundation', 'complexion'], [
  FOUNDATION,
  rline([[9.75, 10.25], [9.75, 8.5], [8.5, 8.5], [8.5, 3.5], [15.5, 3.5], [15.5, 8.5], [14.25, 8.5], [14.25, 10.25]], [0, 0.4, 0.4, 1, 1, 0.4, 0.4, 0]),
  across(FOUNDATION, 15.75),
]);

// Pressed powder compact, open: the lid behind at the upper left with a mirror glint, the base in front
// holding its round pan (the lid passes behind the base; with the base as a flat ellipse under an
// upright lid it read as a toilet).
const COMPACT = (() => {
  const base = circ(14.5, 14.5, 6.25);
  const pan = circ(14.5, 14.5, 3.25);
  const [lid] = behind(circ(8.5, 8.5, 5.5), [base]);
  return { lid, base, pan, glint: line([6.52, 8.22], [8.22, 6.52]) };
})();
tag('powder-compact', ['polvo compacto', 'polvera', 'retoque', 'bronceador', 'powder compact', 'pressed powder', 'touch-up'], [COMPACT.lid, COMPACT.glint, COMPACT.base, COMPACT.pan]);

// Makeup brush: a long tapered handle, the ferrule and a full, rounded dome of bristles at 45°.
const BRUSH = (() => {
  const F = frame([5.25, 18.75], 45);
  const R = halfChord(F([-3.25, -3.25]), F([3.25, -3.25]));
  const bristles = `M${P(F([-2.25, -7]))}L${P(F([-3.25, -3.25]))}A${R} ${R} 0 0 0 ${P(F([3.25, -3.25]))}L${P(F([2.25, -7]))}`;
  const ferrule = roundpoly([F([-2.25, -7]), F([2.25, -7]), F([2.25, -10.25]), F([-2.25, -10.25])], 0.5);
  const E = halfChord(F([-1.3, -19]), F([1.3, -19]));
  const handle = `M${P(F([-1.75, -10.25]))}L${P(F([-1.3, -19]))}A${E} ${E} 0 0 1 ${P(F([1.3, -19]))}L${P(F([1.75, -10.25]))}`;
  return Object.assign([bristles, ferrule, handle], { seams: [line(F([-4, -7]), F([4, -7])), line(F([-4, -10.25]), F([4, -10.25]))] });
})();
tag('makeup-brush', ['brocha de maquillaje', 'pincel', 'maquillista', 'herramientas', 'makeup brush', 'brushes', 'artistry'], [...BRUSH]);

// Blush: a round pan of powder from above, a fat blush brush with an angled tip resting across its
// right side (the pan passes behind the brush).
const BLUSH = (() => {
  const F = frame([13, 18], 30);
  const bristles = rline([F([-2, -6]), F([-3.1, -2.75]), F([-2.6, -0.6]), F([2.6, 0.9]), F([3.1, -1.75]), F([2, -6])], [0, 1.25, 0.9, 0.9, 1.25, 0]);
  const ferrule = roundpoly([F([-2, -6]), F([2, -6]), F([2, -8.5]), F([-2, -8.5])], 0.5);
  const E = halfChord(F([-1.2, -15]), F([1.2, -15]));
  const handle = `M${P(F([-1.6, -8.5]))}L${P(F([-1.2, -15]))}A${E} ${E} 0 0 1 ${P(F([1.2, -15]))}L${P(F([1.6, -8.5]))}`;
  const brushShapes = [shut(bristles), ferrule, shut(handle)];
  const pan = behind(circ(9.25, 12.25, 7), brushShapes);
  const powder = behind(circ(9.25, 12.25, 4), brushShapes);
  return { pan, powder, brush: [bristles, ferrule, handle] };
})();
tag('blush', ['rubor', 'colorete', 'bronceador', 'contorno', 'blush', 'cheek color', 'bronzer'], [...BLUSH.pan, ...BLUSH.powder, ...BLUSH.brush]);

// Makeup sponge: a teardrop tilted on its round end with the tip up, its base cut flat where it
// dabbed. The outline is the hull of a large and a small circle, cut by a chord.
const SPONGE = (() => {
  const [R, D, r, cut] = [6.5, 9.25, 1.75, 4.75];
  const ny = -(R - r) / D;
  const nx = Math.sqrt(1 - ny * ny);
  const F = frame([10.9, 14.8], 20);
  const cx = Math.sqrt(R * R - cut * cut);
  const [bl, br, sl, sr] = [F([-nx * R, ny * R]), F([nx * R, ny * R]), F([-nx * r, -D + ny * r]), F([nx * r, -D + ny * r])];
  return `M${P(sl)}L${P(bl)}A${R} ${R} 0 0 0 ${P(F([-cx, cut]))}L${P(F([cx, cut]))}A${R} ${R} 0 0 0 ${P(br)}L${P(sr)}A${r} ${r} 0 0 0 ${P(sl)}Z`;
})();
tag('makeup-sponge', ['esponja de maquillaje', 'difuminar', 'aplicar base', 'beauty blender', 'makeup sponge', 'blender', 'blending'], [SPONGE]);

// Eyelash curler: the arched clamp frame on top over its curved pad, its two arms crossing like
// scissors down to the finger loops.
tag('eyelash-curler', ['rizador de pestañas', 'enchinador', 'pestañas', 'herramientas', 'eyelash curler', 'lash curler', 'lashes'], [
  'M4.5 10A7.5 6 0 0 1 19.5 10',
  'M9 9.25A3 2.5 0 0 1 15 9.25',
  line([4.5, 10], [15.75, 18.25]),
  line([19.5, 10], [8.25, 18.25]),
  circ(17.16, 19.28, 1.75),
  circ(6.84, 19.28, 1.75),
]);

// False eyelashes: a shallow curved strip with five lashes fanning up from it, longer toward the
// outer end.
const LASHES = (() => {
  const C = [12, 0];
  const R = 16;
  const at = (x) => [x, C[1] + Math.sqrt(R * R - (x - C[0]) ** 2)];
  const strip = `M${P(at(3.25))}A${R} ${R} 0 0 0 ${P(at(20.75))}`;
  const lashes = [[5.25, -18, 3.75], [8.5, -6, 4.5], [11.75, 6, 5.25], [15, 18, 6], [18.25, 30, 6.5]].map(([x, deg, l]) => {
    const p = at(x);
    return line(p, add(p, [Math.sin((deg * Math.PI) / 180) * l, -Math.cos((deg * Math.PI) / 180) * l]));
  });
  return [strip, ...lashes].map((d) => transform(d, 1, 0, -2.25));
})();
tag('false-eyelashes', ['pestañas postizas', 'extensiones de pestañas', 'lash lifting', 'pestañas', 'false eyelashes', 'lash extensions', 'lashes'], LASHES);

// Cosmetics: a lipstick and a slim bottle standing side by side, the lipstick in front (the bottle
// passes behind it).
const COSMETICS = (() => {
  const lip = LIPSTICK.map((d) => place(d, 0.75, [12, 21.25], [8.5, 21.25]));
  const front = [lip[0], shut(lip[1]), shut(lip[2])];
  const bottle = sq(10.75, 8.25, 9.25, 13, 2.75, SQ);
  const cap = rline([[13, 8.25], [13, 3.25], [17.75, 3.25], [17.75, 8.25]], [0, 1, 1, 0]);
  const [piece] = behind(bottle, front);
  return { d: [piece, ...behind(cap, front), ...lip], fill: hug(piece, front, bottle) };
})();
tag('cosmetics', ['cosméticos', 'productos de belleza', 'departamento de belleza', 'maquillaje', 'cosmetics', 'beauty products', 'beauty'], COSMETICS.d);

// Makeup mirror: a round mirror held at its sides in a ring-shaped yoke, on a stem and a round foot,
// a glint on the glass.
tag('makeup-mirror', ['espejo de tocador', 'espejo de aumento', 'espejo de maquillaje', 'tocador', 'makeup mirror', 'vanity mirror', 'magnifying mirror'], [
  circ(12, 7.75, 5),
  line([10, 8.25], [12, 6.25]),
  'M20 7.75A8 8 0 0 1 4 7.75',
  hl(4, 7, 7.75),
  hl(17, 20, 7.75),
  vl(12, 15.75, 18.25),
  'M7.5 21.25A4.5 3 0 0 1 16.5 21.25Z',
]);

// Hand mirror: an upright oval of glass with a glint on a long straight handle, a collar band across
// its neck (a wide collar under the oval read as a light bulb).
{
  const glass = ell([12, 8.25], 5.25, 5.5);
  const y = 8.25 + 5.5 * Math.sqrt(1 - (1.5 / 5.25) ** 2);
  tag('hand-mirror', ['espejo de mano', 'espejo', 'arreglarse', 'salón', 'hand mirror', 'mirror', 'beauty'], [
    glass,
    line([10, 9.25], [12.25, 7]),
    `M10.5 ${f(y)}V19.75A1.5 1.5 0 0 0 13.5 19.75V${f(y)}`,
    hl(10.5, 13.5, 16.75),
  ]);
}

// ── Nails ─────────────────────────────────────────────────────────────────────────────────────
// Nail polish: a small rounded bottle under a tall cylindrical cap nearly as tall as it.
tag('nail-polish', ['esmalte', 'barniz de uñas', 'manicura', 'colores de uñas', 'nail polish', 'nail color', 'manicure'], [
  sq(5.25, 12, 13.5, 9.25, 3.5),
  rline([[9.25, 12], [9.25, 2.75], [14.75, 2.75], [14.75, 12]], [0, 1.25, 1.25, 0]),
]);

// Nail file: a long rounded board at 45°, split across into a fine half and a coarse one with grit.
{
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  const at = (s) => add([12, 12], mul(u, s));
  tag('nail-file', ['lima de uñas', 'limar', 'dar forma', 'cuidado de uñas', 'nail file', 'emery board', 'nail care'], [
    rod([6, 18], [18, 6], 3.25),
    line(add([12, 12], mul(n, -3.25)), add([12, 12], mul(n, 3.25))),
    ...[3, 6, 9].map((s) => dot(...at(s), 0.3)),
  ]);
}

// Nail clipper from the side: the two arms closing into the jaws at the left, the bite between them,
// and the lever over them on its pin, its end turned up for the thumb (a fat lever over a flat body
// read as a stapler).
const CLIPPER = (() => {
  const body = 'M2.75 16.5C5.25 14.5 7.25 13.5 10 13.5H19A3 3 0 0 1 19 19.5H10C7.25 19.5 5.25 18.5 2.75 16.5Z';
  const pin = 8.25;
  const y = Math.min(...samples(body)[0].filter(([x, yy]) => Math.abs(x - pin) < 0.06 && yy < 16.5).map(([, yy]) => yy));
  return [body, hl(2.75, 11, 16.5), 'M7.25 10.5L18.25 8.25C19.5 8 20.5 7.25 21.25 6', vl(pin, Number(f(y)), 10.3)];
})();
tag('nail-clipper', ['cortaúñas', 'cortar uñas', 'arreglo personal', 'aseo', 'nail clipper', 'nail trimmer', 'grooming'], CLIPPER);

// The polish brush: the cap as its handle and the bristles at its tip, a piece built at its tip
// (origin) pointing along `deg`. Shared by manicure and pedicure.
function polishBrush(tip, deg, k = 1) {
  const F = frame(tip, deg);
  const S = (x, y) => F([x * k, y * k]);
  const bristles = roundpoly([S(0, 0), S(1.3, -2.25), S(1.3, -3.5), S(-1.3, -3.5), S(-1.3, -2.25)], [0.45, 0.4, 0, 0, 0.4]);
  const cap = roundpoly([S(-2, -3.5), S(2, -3.5), S(2, -11), S(-2, -11)], [0.5, 0.5, 1.25, 1.25]);
  return [bristles, cap];
}

// Manicure: a raised fingertip with its nail, the polish brush coming down to the nail from the
// upper right (the finger passes behind the brush).
const MANICURE = (() => {
  const finger = 'M4.25 21.25V13A5 5 0 0 1 14.25 13V21.25';
  const nail = sq(7.25, 11, 4, 5.5, 2);
  const brush = polishBrush(polar(9.25, 13, 2, -45), 50);
  return [...behind(finger, brush), nail, ...brush];
})();
tag('manicure', ['manicura', 'uñas', 'salón de uñas', 'reservar cita', 'manicure', 'nails', 'nail salon'], MANICURE);

// Pedicure: a foot in profile with the toes to the right, the polish brush touching its big toe from
// above (a nail marked on the toe was a sliver that closed up at heavier weights).
const PEDICURE = (() => {
  const foot = smooth([[6.25, 3.25], [6.75, 10], [5.5, 14.75], [3.5, 18.5], [5.25, 21.25], [12, 21.25], [19.25, 21.25], [21.25, 19.5], [19.75, 17.25], [15.5, 16], [12.25, 13.75], [11, 10.5], [11, 3.25]]);
  const top = samples(foot)[0].filter(([x, y]) => y < 18.5 && x > 15);
  const on = top.reduce((a, b) => (Math.abs(b[0] - 19) < Math.abs(a[0] - 19) ? b : a));
  const brush = polishBrush([on[0], on[1] + 0.35], -10);
  return [foot, ...brush];
})();
tag('pedicure', ['pedicura', 'uñas de los pies', 'cuidado de pies', 'salón de uñas', 'pedicure', 'toenails', 'foot care'], PEDICURE);

// Gel nail lamp: a low arched dome with the wide opening for the hand at the front, three rays of
// light inside it.
tag('nail-lamp', ['lámpara uv', 'lámpara de uñas', 'uñas de gel', 'secado', 'nail lamp', 'uv lamp', 'gel nails'], [
  sq(2.5, 5, 19, 14.5, 6, { square: ['bl', 'br'] }),
  rline([[5.5, 19.5], [5.5, 10.75], [18.5, 10.75], [18.5, 19.5]], [0, 2.5, 2.5, 0]),
  line([9, 13.75], [8.5, 16.5]),
  vl(12, 13.75, 16.5),
  line([15, 13.75], [15.5, 16.5]),
]);

// ── Fragrance and skincare ────────────────────────────────────────────────────────────────────
// Perfume: a square bottle, its short neck and the round atomizer cap, three mist dots spraying from
// the cap to the side (limpieza's spray mist).
tag('perfume', ['perfume', 'colonia', 'fragancia', 'aroma', 'perfume', 'cologne', 'fragrance'], [
  sq(3.75, 10.75, 13.5, 10.5, 3.5, SQ),
  rline([[8.75, 10.75], [8.75, 8.25], [12.25, 8.25], [12.25, 10.75]], 0),
  circ(10.5, 5.5, 2.75),
  dot(16.25, 5.5),
  dot(19.25, 3.5),
  dot(19.25, 7.5),
]);

// Cream jar: a wide, low jar under a shallow lid, the narrower band of its neck between them.
tag('cream-jar', ['crema', 'tarro de crema', 'hidratante', 'cuidado de la piel', 'cream jar', 'moisturizer', 'skincare'], [
  rrect(3.25, 4.75, 17.5, 4.25, [1.75, 1.75, 0.6, 0.6]),
  rline([[4.75, 9], [4.75, 12], [3.25, 12], [3.25, 20], [20.75, 20], [20.75, 12], [19.25, 12], [19.25, 9]], [0, 0.5, 0.5, 3.5, 0, 0.5, 0.5, 0]),
]);

// The cream tube standing on its cap: the crimped top with its seal across, the body narrowing to
// the shoulder, and the round cap under it. Shared by cream-tube and sunscreen.
function creamTube(cx, w) {
  const [x0, x1] = [cx - w / 2, cx + w / 2];
  const body = roundpoly([[x0, 2.75], [x1, 2.75], [x1, 5.75], [cx + 2.5, 15.75], [cx - 2.5, 15.75], [x0, 5.75]], [0.75, 0.75, 0.5, 1, 1, 0.5]);
  return [body, across(body, 5.75), rrect(cx - 3.25, 15.75, 6.5, 5.5, [0.6, 0.6, 1.25, 1.25])];
}
tag('cream-tube', ['tubo de crema', 'limpiador', 'crema de manos', 'loción', 'cream tube', 'cleanser', 'lotion'], creamTube(12, 11));

// Serum: a small square bottle whose cap is a dropper bulb over its collar, one drop beside it.
tag('serum', ['sérum', 'aceite facial', 'gotero', 'activos', 'serum', 'face oil', 'dropper'], [
  sq(3.75, 11.25, 11, 10, 3, SQ),
  rline([[6, 11.25], [6, 8.25], [12.5, 8.25], [12.5, 11.25]], [0, 0.6, 0.6, 0]),
  'M7.5 8.25V5A1.75 1.75 0 0 1 11 5V8.25',
  waterDrop([18.5, 8.75], 2.25),
]);

// Sunscreen: the cream tube, narrower, with a small sun rising behind its upper left (the sun passes
// behind the tube), clear of the badge's corner. The same drawing carries the clock badge.
const SUNSCREEN = (() => {
  const tube = creamTube(15.25, 9.5);
  const front = [tube[0], tube[2]];
  const S = [8.5, 8.5];
  const sun = [circ(...S, 1.75), ...Array.from({ length: 8 }, (_, i) => line(polar(...S, 4.75, 22.5 + i * 45), polar(...S, 6.75, 22.5 + i * 45)))];
  return [...tube, ...sun.flatMap((d) => behind(d, front))];
})();
tag('sunscreen', ['protector solar', 'bloqueador', 'fps', 'rayos uv', 'sunscreen', 'spf', 'sun protection'], SUNSCREEN);
tag('sunscreen-clock', ['reaplicar protector', 'recordatorio solar', 'cada dos horas', 'protección solar', 'reapply sunscreen', 'sunscreen reminder'], SUNSCREEN, { badge: badge('clock') });

// The face: an egg, wider at the brow than at the chin (sheet-mask, face-retouch).
const FACE = 'M3.75 11A8.25 7.75 0 0 1 20.25 11C20.25 16.25 16.5 20.75 12 20.75C7.5 20.75 3.75 16.25 3.75 11Z';
/** An almond eye hole of width w and height h centered at c. */
function almond([cx, cy], w, h) {
  const R = (w * w) / 4 / (2 * (h / 2)) / 1 + h / 4;
  return `M${P([cx - w / 2, cy])}A${f(R)} ${f(R)} 0 0 1 ${P([cx + w / 2, cy])}A${f(R)} ${f(R)} 0 0 1 ${P([cx - w / 2, cy])}Z`;
}
// Sheet mask: the face-shaped sheet from the front, two almond eye holes and the mouth's slit.
tag('sheet-mask', ['mascarilla de tela', 'facial', 'tratamiento', 'hidratación', 'sheet mask', 'facial', 'face mask'], [
  FACE,
  almond([8.5, 11], 4, 2.6),
  almond([15.5, 11], 4, 2.6),
  hl(10.25, 13.75, 16.5),
]);

// Facial roller, leaning: the large roller in its fork at the top, the long handle, and the small
// roller across its other end (upright, with a fork at each end, it read as a toy robot).
{
  const F = frame([7.25, 20], 30);
  tag('face-roller', ['rodillo facial', 'rodillo de jade', 'masaje facial', 'desinflamar', 'face roller', 'jade roller', 'facial massage'], [
    rod(F([-3, -15.5]), F([3, -15.5]), 2.25),
    rline([F([-5.25, -15.5]), F([-7, -15.5]), F([-7, -10.4]), F([7, -10.4]), F([7, -15.5]), F([5.25, -15.5])], [0, 0.75, 2, 2, 0.75, 0]),
    line(F([0, -10.4]), F([0, -3])),
    rod(F([-1.75, -1.5]), F([1.75, -1.5]), 1.5),
  ]);
}

// Cotton pad: a soft flat disc seen at an angle, its thickness below and the quilted stitches as dots
// on its face (from the front, a ring inside a circle read as a drain).
tag('cotton-pad', ['disco de algodón', 'algodón', 'desmaquillar', 'tónico', 'cotton pad', 'makeup remover', 'toner'], [
  ell([12, 10.25], 9, 5.5),
  'M3 10.25V13.25A9 5.5 0 0 0 21 13.25V10.25',
  ...[[12, 10.25], [15, 10.25], [9, 10.25], [13.5, 7.65], [10.5, 7.65], [13.5, 12.85], [10.5, 12.85]].map(([x, y]) => dot(x, y, 0.3)),
]);

// Retouch: a plain face with no features, a large sparkle at its upper right: a piece on top, the engine
// clears the face around it.
{
  const spark = sparkle(17.5, 6.5, 4.5);
  const face = place(FACE, 0.85, [12, 12], [10.25, 13.25]);
  tag('face-retouch', ['retoque', 'piel radiante', 'filtro de belleza', 'resultados', 'face retouch', 'glowing skin', 'beauty filter'], [face], {
    fill: { solid: [face] },
    badge: { d: [spark], knock: spark, fill: { solid: [spark] } },
  });
}

// Sample sachet: a small packet with crimped zigzag top and bottom edges, the seal band under each
// and a tear notch in its left side (without the bands it read as a postage stamp).
{
  const top = Array.from({ length: 10 }, (_, i) => [5.25 + 1.5 * i, i % 2 ? 2.75 : 4.25]);
  const bottom = Array.from({ length: 10 }, (_, i) => [18.75 - 1.5 * i, i % 2 ? 21.25 : 19.75]);
  const pack = roundpoly([...top, [18.75, 4.25], ...bottom, [5.25, 19.75], [5.25, 11], [7, 10], [5.25, 9]], 0.3);
  tag('sachet', ['sobre', 'muestra gratis', 'monodosis', 'tamaño de viaje', 'sachet', 'sample', 'single use'], [pack, across(pack, 7.25), across(pack, 16.75)]);
}

// ── Haircare ──────────────────────────────────────────────────────────────────────────────────
// Comb: a straight comb lying flat, its spine and a row of teeth, the right half shorter.
tag('comb', ['peine', 'peinar', 'cabello', 'arreglo personal', 'comb', 'haircare', 'styling'], [
  rrect(2.75, 6, 18.5, 4, 1.75),
  ...[4.75, 7.75, 10.75].map((x) => vl(x, 10, 18)),
  ...[13.75, 16.75, 19.75].map((x) => vl(x, 10, 14.75)),
]);

// Hairbrush: a paddle brush, its squarish head with rows of bristles on a long handle.
tag('hairbrush', ['cepillo de pelo', 'cepillar', 'cabello', 'peinado', 'hairbrush', 'paddle brush', 'brushing'], [
  sq(6.25, 2.75, 11.5, 11, 4.5),
  'M10.5 13.75V19.75A1.5 1.5 0 0 0 13.5 19.75V13.75',
  ...[5.25, 8.25, 11.25].flatMap((y) => [10.5, 13.5].map((x) => dot(x, y, 0.3))),
]);

// Hair pick: a rounded handle over a bar with four long, widely spaced tines.
tag('hair-pick', ['peineta afro', 'trinche', 'cabello rizado', 'afro', 'hair pick', 'afro pick', 'curly hair'], [
  rline([[8.5, 9.5], [8.5, 2.75], [15.5, 2.75], [15.5, 9.5]], [0, 3, 3, 0]),
  rrect(3.25, 9.5, 17.5, 3.25, 1.25),
  ...[6, 10, 14, 18].map((x) => vl(x, 12.75, 21.25)),
]);

// Hair dryer in profile: the round back body with its vent, the barrel pointing right, the handle
// dropping below and three lines of air leaving the nozzle.
tag('hair-dryer', ['secadora de pelo', 'secador', 'peinado', 'amenidad', 'hair dryer', 'blow dryer', 'blow-dry'], [
  'M12.31 6.25H15.25A1 1 0 0 1 16.25 7.25V11.25A1 1 0 0 1 15.25 12.25H12.31A5.25 5.25 0 1 1 12.31 6.25Z',
  circ(8, 9.25, 2),
  rline([[6, 14.1], [5.25, 21.25], [9.25, 21.25], [10, 14.1]], [0, 1.25, 1.25, 0]),
  hl(19.25, 21.5, 6.25),
  hl(19.25, 21.5, 9.25),
  hl(19.25, 21.5, 12.25),
]);

// Hair straightener: two long flat arms hinged at the bottom, opened in a narrow V, and the cord
// leaving the hinge (the arms pass behind it). Marked across, the plates made each arm an A.
const STRAIGHTENER = (() => {
  const hinge = circ(12, 17.25, 2);
  const arm = (deg, x) => {
    const F = frame([x, 17.25], deg);
    return { F, d: roundpoly([F([-2.25, 0]), F([2.25, 0]), F([2.25, -14.25]), F([-2.25, -14.25])], [1, 1, 1.75, 1.75]) };
  };
  const [l, r] = [arm(-11, 9.25), arm(11, 14.75)];
  const cord = smooth([[12, 19.25], [12.75, 20.75], [16, 21.25]]);
  const [a, b] = [behind(l.d, [hinge], 3.2)[0], behind(r.d, [hinge], 3.2)[0]];
  return Object.assign([a, b, hinge, cord], { arms: [hug(a, hinge, l.d, 3.2), hug(b, hinge, r.d, 3.2)] });
})();
tag('hair-straightener', ['plancha de pelo', 'alaciadora', 'alaciar', 'peinado', 'hair straightener', 'flat iron', 'straightening'], [...STRAIGHTENER]);

// Curling iron at 45°: the handle with the cord at the bottom left, the barrel toward the upper right
// and the clamp lifted along it, its lever by the handle.
const CURLING = (() => {
  const F = frame([6.25, 17.75], 45);
  const handle = roundpoly([F([-2.25, 0]), F([2.25, 0]), F([2.25, -7]), F([-2.25, -7])], [1.5, 1.5, 0.6, 0.6]);
  const R = halfChord(F([-1.75, -16.75]), F([1.75, -16.75]));
  const barrel = `M${P(F([-1.75, -7]))}L${P(F([-1.75, -16.75]))}A${R} ${R} 0 0 1 ${P(F([1.75, -16.75]))}L${P(F([1.75, -7]))}`;
  const clamp = rline([F([-4.6, -15.25]), F([-4.6, -9]), F([-6.5, -7])], [0, 1, 0]);
  const cord = smooth([F([0, 0]), [4.5, 19.75], [4, 21.25]]);
  return [handle, barrel, clamp, cord];
})();
tag('curling-iron', ['tenaza', 'rizador de pelo', 'ondas', 'rizos', 'curling iron', 'curling wand', 'curls'], CURLING);

// Bobby pin: a long, narrow U at 45°, one leg straight and the other wavy.
const BOBBY = (() => {
  const F = frame([17.5, 6.5], 45);
  const h = 1.875;
  const R = halfChord(F([-h, 0]), F([h, 0]));
  const wave = [[h, 0], [h, 1.75], ...[3.5, 6, 8.5, 11, 13.5].map((y, i) => [h + (i % 2 ? 0.75 : -0.75), y]), [h, 15.75]].map(F);
  return `M${P(F([-h, 17]))}L${P(F([-h, 0]))}A${R} ${R} 0 0 1 ${P(F([h, 0]))}${smooth(wave).replace(/^M[^C]*/, '')}`;
})();
tag('bobby-pin', ['pasador', 'horquilla', 'invisible', 'accesorio', 'bobby pin', 'hair pin', 'hair accessory'], [BOBBY]);

// Scrunchie: a ring with a ruffled, scalloped outer edge around a smooth hole.
{
  const n = 12;
  const pts = Array.from({ length: n }, (_, i) => polar(12, 12, 7.75, -90 + (i * 360) / n));
  const ruffle = `M${P(pts[0])}${pts.map((_, i) => `A2.3 2.3 0 0 1 ${P(pts[(i + 1) % n])}`).join('')}Z`;
  tag('scrunchie', ['dona para el pelo', 'liga', 'coleta', 'accesorio', 'scrunchie', 'hair tie', 'ponytail'], [ruffle, circ(12, 12, 4.25)]);
}

// Hair dye: the tint bowl in front, a flat tint brush standing in it with its pointed tail handle
// rising on a diagonal (the brush passes behind the bowl). The same drawing carries the clock badge.
const HAIR_DYE = (() => {
  const bowl = 'M3.5 16H20.5C20.5 19 16.75 21.25 12 21.25C7.25 21.25 3.5 19 3.5 16Z';
  const F = frame([8.75, 15.5], 30);
  const bristles = roundpoly([F([-3.25, 0]), F([3.25, 0]), F([3.25, -6]), F([-3.25, -6])], [0.4, 0.4, 0.5, 0.5]);
  const tail = line(F([0, -9]), F([0, -15.5]));
  const ferruleD = roundpoly([F([-2.25, -6]), F([2.25, -6]), F([2.25, -9]), F([-2.25, -9])], 0.5);
  const [piece] = behind(bristles, [bowl]);
  return Object.assign([bowl, piece, ...[ferruleD, tail].flatMap((d) => behind(d, [bowl]))], { bristles: hug(piece, bowl, bristles) });
})();
tag('hair-dye', ['tinte', 'color de pelo', 'coloración', 'luces', 'hair dye', 'hair color', 'highlights'], [...HAIR_DYE]);
tag('hair-dye-clock', ['tiempo de exposición', 'temporizador de tinte', 'tratamiento', 'color', 'processing time', 'dye timer'], [...HAIR_DYE], { badge: badge('clock') });

// Shampoo: a bottle standing upside down, its shoulder narrowing onto the wide flip-top cap, a label
// on it.
tag('shampoo', ['champú', 'acondicionador', 'cuidado del cabello', 'amenidad', 'shampoo', 'conditioner', 'haircare'], [
  roundpoly([[6, 2.75], [18, 2.75], [18, 12.5], [15, 16.25], [9, 16.25], [6, 12.5]], [4.5, 4.5, 2.5, 1, 1, 2.5]),
  rrect(9, 5.5, 6, 4.75, 1),
  rrect(7.5, 16.25, 9, 5, [0.5, 0.5, 1.75, 1.75]),
]);

// Braid: interlocking chevrons down a column that narrows to a small band and a tuft.
{
  const braid = smooth([[8, 2.75], [7.75, 8], [9.25, 14.25], [10.75, 15.75]]) + smooth([[13.25, 15.75], [14.75, 14.25], [16.25, 8], [16, 2.75]]).replace(/^M/, 'L') + 'Z';
  const chevrons = [5.25, 8.5, 11.75].map((y) => inside(rline([[6, y - 1.75], [12, y + 1.75], [18, y - 1.75]], [0, 0.6, 0]), braid));
  tag('hair-braid', ['trenza', 'trenzas', 'peinado protector', 'trenzado', 'hair braid', 'braids', 'braiding'], [
    braid,
    ...chevrons,
    rrect(10, 15.75, 4, 2.25, 0.6),
    line([11, 18], [9.75, 21.25]),
    line([13, 18], [14.25, 21.25]),
  ]);
}

// Hair extensions: the weft band across the top, long strands hanging from it, wavy at their ends.
{
  const strand = (x) => smooth([[x, 6.25], [x, 12.5], [x + 0.6, 15], [x - 0.6, 17.5], [x + 0.3, 20.25]]);
  tag('hair-extensions', ['extensiones', 'cortina de pelo', 'postizo', 'clip-in', 'hair extensions', 'weave', 'wefts'], [
    capsule2(2.75, 3, 18.5, 3.25),
    ...[5.75, 10, 14.25, 18.5].map((x) => strand(x - 0.25)),
  ]);
}

// Shower cap: a soft dome over its gathered, ruffled band.
{
  const n = 6;
  const xs = Array.from({ length: n + 1 }, (_, i) => 3.25 + (17.5 * i) / n);
  const band = `M3.25 14.25H20.75V16.75${xs.slice(0, -1).reverse().map((x) => `A1.55 1.55 0 0 1 ${f(x)} 16.75`).join('')}Z`;
  tag('shower-cap', ['gorro de baño', 'gorra de ducha', 'proteger el pelo', 'amenidad', 'shower cap', 'bath cap', 'bonnet'], [
    'M4.25 14.25C4.25 8.25 7.5 4.25 12 4.25C16.5 4.25 19.75 8.25 19.75 14.25',
    band,
  ]);
}

// Wig on its head form: the hair from the crown with a side-swept fringe, falling past the chin on both
// sides and flicking out at its ends, the face of the form inside it closed by its chin, the neck and
// the base (a plain band of hair around the face read as a horseshoe magnet).
tag('wig', ['peluca', 'postizo', 'prueba de peluca', 'caída del cabello', 'wig', 'hairpiece', 'hair loss'], [
  'M12 2.75C16.75 2.75 19.75 6 19.75 11V15.75C19.75 17 20.5 18 21.25 18.5C19.5 19.5 17.75 19 16.75 18V11.5C16.75 9.75 16 8.5 14.75 7.75C12.5 9.25 10 9.75 7.25 9.75V18C6.25 19 4.5 19.5 2.75 18.5C3.5 18 4.25 17 4.25 15.75V11C4.25 6 7.25 2.75 12 2.75Z',
  'M7.25 12.5C7.25 15.25 9.25 16.75 12 16.75C14.75 16.75 16.75 15.25 16.75 12.5',
  vl(12, 16.75, 21.25),
  hl(8.5, 15.5, 21.25),
]);

// ── Shaving and barbering ─────────────────────────────────────────────────────────────────────
// Razor: a cartridge razor head up, its two blades across the head, on a long, slightly curved
// handle.
tag('razor', ['rastrillo', 'rasuradora', 'afeitar', 'suscripción', 'razor', 'shaving', 'cartridge razor'], [
  rrect(4.75, 2.75, 14.5, 8.75, 2),
  hl(4.75, 19.25, 5.65),
  hl(4.75, 19.25, 8.6),
  'M10.5 11.5C10.25 14.5 10.75 17 10.75 19.75A1.5 1.5 0 0 0 13.75 19.75C13.75 17 13.75 14.5 13.5 11.5',
]);

// Straight razor, nearly open on a diagonal: the slim handle rising from the lower left to the pivot,
// the blade bent up from it, its back swelling and its toe square (half open, lying flat, it read as a
// slipper). The handle passes behind the blade.
const STRAIGHT_RAZOR = (() => {
  const pivot = [9.75, 13.75];
  const B = frame(pivot, 60);
  const blade = roundpoly([B([-0.75, 0.75]), B([-2.75, -5.5]), B([-2, -11.75]), B([2, -11.75]), B([2, -0.5]), B([0.75, 0.75])], [0.5, 2.5, 1, 0.75, 0.6, 0.5]);
  const handle = rod([3.75, 19.75], pivot, 1.5);
  const [piece] = behind(handle, [blade]);
  return Object.assign([piece, blade], { handle: hug(piece, blade, handle) });
})();
tag('straight-razor', ['navaja de barbero', 'navaja', 'afeitado clásico', 'barbería', 'straight razor', 'cut-throat razor', 'hot shave'], [...STRAIGHT_RAZOR]);

// Electric shaver: the head's two foil humps over the seam, the body narrowing at its waist under it
// and rounded at the foot, the power button (a wide head on a cup-shaped body read as a bin).
tag('electric-shaver', ['rasuradora eléctrica', 'afeitadora', 'afeitar', 'aseo', 'electric shaver', 'shaver', 'grooming'], [
  'M5.25 9.25V6.25A3.25 3.25 0 0 1 11.75 6.25H12.25A3.25 3.25 0 0 1 18.75 6.25V9.25',
  'M5.25 9.25H18.75V10.75C18.75 12.25 17.5 13 17.5 14.75V18A3.25 3.25 0 0 1 14.25 21.25H9.75A3.25 3.25 0 0 1 6.5 18V14.75C6.5 13 5.25 12.25 5.25 10.75Z',
  dot(12, 16),
]);

// Hair clipper: a chunky body under the wide flat blade edged with teeth, its switch, and the cord.
tag('hair-clipper', ['máquina de cortar pelo', 'cortadora', 'degradado', 'barbería', 'hair clipper', 'clippers', 'fade'], [
  rrect(4.5, 4.75, 15, 3.5, 1),
  ...[6, 9, 12, 15, 18].map((x) => vl(x, 2.75, 4.75)),
  'M6.5 8.25V15A4 4 0 0 0 10.5 19H13.5A4 4 0 0 0 17.5 15V8.25',
  vl(12, 11.25, 14.75),
  smooth([[12, 19], [12.75, 20.75], [15.5, 21.25]]),
]);

// Shaving brush: the knot of bristles fanning out of the waisted knob handle to a wide dome, two
// strands rising in it (a round dome over the knob read as a mushroom).
tag('shaving-brush', ['brocha de afeitar', 'espuma', 'afeitado clásico', 'barbería', 'shaving brush', 'wet shave', 'lather'], [
  'M9 12.75L6.5 7.25C6.5 4.5 9 2.75 12 2.75C15 2.75 17.5 4.5 17.5 7.25L15 12.75',
  vl(10.5, 8.5, 12.75),
  vl(13.5, 8.5, 12.75),
  'M9 12.75H15C15 14.75 17.25 15.75 17.25 18.25C17.25 20 16 21.25 14.5 21.25H9.5C8 21.25 6.75 20 6.75 18.25C6.75 15.75 9 14.75 9 12.75Z',
]);

// Shaving cream: an aerosol can under its domed shoulder, the nozzle and a cloud of foam on it, three
// bubbles heaped together.
const FOAM = (() => {
  const [L, T, R] = [[9, 6.5, 2.25], [12, 5, 2.5], [15, 6.5, 2.25]];
  const meet = ([x1, y1, r1], [x2, y2, r2]) => {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(r1 * r1 - a * a);
    const [mx, my] = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
    const p = [mx + (h * (y2 - y1)) / d, my - (h * (x2 - x1)) / d];
    const q = [mx - (h * (y2 - y1)) / d, my + (h * (x2 - x1)) / d];
    return p[1] < q[1] ? p : q;
  };
  const dx = Math.sqrt(2.25 ** 2 - 1.75 ** 2);
  return `M${P([15 + dx, 8.25])}H${f(9 - dx)}A2.25 2.25 0 0 1 ${P(meet(L, T))}A2.5 2.5 0 0 1 ${P(meet(T, R))}A2.25 2.25 0 0 1 ${P([15 + dx, 8.25])}Z`;
})();
tag('shaving-cream', ['espuma de afeitar', 'crema de afeitar', 'afeitado', 'barbería', 'shaving cream', 'shaving foam', 'lather'], [
  sq(6.75, 13.5, 10.5, 7.75, 2, SQ),
  'M6.75 13.5A5.25 2.75 0 0 1 17.25 13.5Z',
  rrect(10, 8.25, 4, 2.5, 0.6),
  FOAM,
]);

// Pomade: a wide, shallow tin seen from above, a swipe through its product, its lid standing behind
// it (the lid passes behind the tin). The tin's face is deep enough for the swipe to keep its paper.
const POMADE = (() => {
  const top = ell([10.75, 12.75], 8, 4.25);
  const side = 'M2.75 12.75V16.75A8 4.25 0 0 0 18.75 16.75V12.75';
  const lid = ell([15.25, 8.25], 6, 4, -25);
  return [...behind(lid, [top, `${side}Z`]), top, side, smooth([[7.25, 13.25], [9.5, 12], [12, 13.5], [14.25, 12.25]])];
})();
tag('pomade', ['pomada', 'cera para el pelo', 'fijador', 'barbería', 'pomade', 'hair wax', 'styling'], POMADE);

// Barber pole: an upright cylinder between its rounded caps, three spiral stripes across it.
const POLE = rrect(8.75, 6, 6.5, 12, 0);
{
  const body = POLE;
  tag('barber-pole', ['poste de barbería', 'barbería', 'corte de caballero', 'barbero', 'barber pole', 'barbershop', 'barber'], [
    'M7.75 6A4.25 3.25 0 0 1 16.25 6Z',
    vl(8.75, 6, 18),
    vl(15.25, 6, 18),
    'M7.75 18H16.25V19.75A1.5 1.5 0 0 1 14.75 21.25H9.25A1.5 1.5 0 0 1 7.75 19.75Z',
    ...[9.5, 13.5, 17.5].map((y) => inside(line([7, y + 1.21], [17, y - 5.71]), body)),
  ]);
}

// Salon chair in profile: the back and the seat in one cushion, the armrest's pad over the seat (held
// from the back: on a post down to the seat it closed a window under the badge at bold), the
// hydraulic column and its round base. The same drawing carries the clock and check badges.
const SALON_CHAIR = [
  roundpoly([[4.75, 3], [9.25, 3], [9.25, 12], [19.25, 12], [19.25, 16], [4.75, 16]], [2, 2, 0.75, 1.75, 1.75, 2]),
  hl(9.25, 15.75, 8.75),
  vl(12, 16, 18.5),
  'M7 21.25A5 2.75 0 0 1 17 21.25',
];
tag('salon-chair', ['silla de salón', 'sillón de barbero', 'estación', 'renta de silla', 'salon chair', 'styling chair', 'barber chair'], SALON_CHAIR);
tag('salon-chair-clock', ['tiempo de espera', 'hora de la cita', 'turno', 'próximo lugar', 'wait time', 'appointment time', 'walk-in'], SALON_CHAIR, { badge: badge('clock') });
tag('salon-chair-check', ['cita confirmada', 'silla reservada', 'estación disponible', 'reservado', 'chair booked', 'appointment confirmed'], SALON_CHAIR, { badge: badge('check') });

// Shampoo bowl: the basin with the neck rest dipping in its front rim, on its pedestal, and the hand
// sprayer on its hose from the back of the basin.
tag('shampoo-bowl', ['lavacabezas', 'lavado de pelo', 'tarja de salón', 'lavabo', 'shampoo bowl', 'backwash', 'hair washing'], [
  'M3.25 11.5H9.5A2.5 2.5 0 0 0 14.5 11.5H20.75C20.75 15.25 16.75 17.5 12 17.5C7.25 17.5 3.25 15.25 3.25 11.5Z',
  vl(12, 17.5, 21.25),
  hl(8, 16, 21.25),
  smooth([[11.91, 7.01], [17, 6.5], [19.25, 11.5]]),
  rod([5, 4.5], [10.5, 6.5], 1.5),
]);

// Beard: a full beard from ear to ear, the mustache across its top and the mouth's gap between them,
// no other features.
tag('beard', ['barba', 'arreglo de barba', 'vello facial', 'avatar', 'beard', 'beard trim', 'facial hair'], [
  'M4.5 3.75V10.75C4.5 16.75 7.75 21.25 12 21.25C16.25 21.25 19.5 16.75 19.5 10.75V3.75H16.5V10.75C16.5 14.25 14.5 16.5 12 16.5C9.5 16.5 7.5 14.25 7.5 10.75V3.75Z',
  'M7.5 11.25C8.75 9.5 10.75 8.75 12 9.75C13.25 8.75 15.25 9.5 16.5 11.25C14.75 12.75 13.25 12.25 12 12.25C10.75 12.25 9.25 12.75 7.5 11.25Z',
]);

// Mustache: a handlebar, two symmetric swoops meeting at the center, their tips curling up.
{
  const half = 'M12 9.75C14 8.75 16.25 10.25 17.75 11.25C19.25 12.25 20.5 11.5 20.25 9.25C21.75 11 21.5 14.5 17.75 14.75C15 15 13.5 13 12 13';
  tag('mustache', ['bigote', 'manubrio', 'barbería', 'vello facial', 'mustache', 'moustache', 'handlebar'], [
    `${half}${mirrorBack(half)}Z`,
  ]);
}

// ── Oral care ─────────────────────────────────────────────────────────────────────────────────
// Toothbrush: the long handle at 45°, the head at its upper end and the block of bristles standing
// up from it. The same drawing carries the clock badge.
const TOOTHBRUSH = (() => {
  const F = frame([6, 19.25], 45);
  const handle = rod(F([0, 0]), F([0, -17]), 1.5);
  const bristles = rline([F([-1.5, -12]), F([-5, -12]), F([-5, -17.5]), F([-1.5, -17.5])], [0, 0.6, 0.6, 0]);
  return [handle, bristles];
})();
tag('toothbrush', ['cepillo de dientes', 'cepillarse', 'higiene bucal', 'hábito', 'toothbrush', 'brushing teeth', 'oral care'], TOOTHBRUSH);
tag('toothbrush-clock', ['temporizador de cepillado', 'dos minutos', 'recordatorio', 'higiene bucal', 'brushing timer', 'two minutes'], TOOTHBRUSH, { badge: badge('clock') });

// Electric toothbrush: the toothbrush's own head and bristles at 45° on a slim neck, over a thick
// handle with the slot of its button (upright, with a round head or bristles to the side, it read as a
// bottle or a trigger sprayer).
const E_TOOTHBRUSH = (() => {
  const F = frame([6.5, 18.5], 45);
  const handle = roundpoly([F([-3, 0]), F([3, 0]), F([3, -9]), F([-3, -9])], [2.75, 2.75, 1.25, 1.25]);
  const neck = `M${P(F([-1.5, -9]))}L${P(F([-1.5, -15.75]))}A1.5 1.5 0 0 1 ${P(F([1.5, -15.75]))}L${P(F([1.5, -9]))}`;
  const bristles = rline([F([-1.5, -11.25]), F([-5, -11.25]), F([-5, -16.75]), F([-1.5, -16.75])], [0, 0.6, 0.6, 0]);
  return [handle, neck, bristles, line(F([0, -3]), F([0, -6]))];
})();
tag('electric-toothbrush', ['cepillo eléctrico', 'cepillo de dientes eléctrico', 'cabezal', 'higiene bucal', 'electric toothbrush', 'power toothbrush', 'brush head'], E_TOOTHBRUSH);

// Toothpaste: a tube lying low with its cap off, a thick ribbon of paste leaving its mouth and
// curling up.
{
  const F = frame([4.25, 15.5], 70);
  const tube = roundpoly([F([-4.5, 0]), F([4.5, 0]), F([4.5, -2.75]), F([2.25, -10.5]), F([-2.25, -10.5]), F([-4.5, -2.75])], [0.75, 0.75, 0.5, 1, 1, 0.5]);
  const neck = rline([F([-1.5, -10.5]), F([-1.5, -12.25]), F([1.5, -12.25]), F([1.5, -10.5])], [0, 0.4, 0.4, 0]);
  const paste = band([F([0, -12.25]), F([0, -13.75]), [17.75, 5.75], [20, 4.25], [20.25, 7]], 1.5, { flat: true });
  tag('toothpaste', ['pasta de dientes', 'dentífrico', 'higiene dental', 'artículos de viaje', 'toothpaste', 'dental hygiene', 'toiletries'], [
    tube,
    line(F([-4.5, -2.75]), F([4.5, -2.75])),
    neck,
    paste,
  ]);
}

// Dental floss: two small molars and the strand down between them, pulled taut up to the right (its dispenser read as a saucepan, a teapot or a computer mouse; tall plain teeth read as
// two capsules).
{
  const TOOTH = 'M12 4.9C10.6 3.5 9.05 2.75 7.65 2.75C5.6 2.75 4.75 4.85 4.75 7.6C4.75 10.6 5.65 12.6 6.3 14.75C6.85 16.6 7.1 21.25 8.65 21.25C9.85 21.25 10.1 18.35 10.55 16.55C10.75 15.65 11.25 15.25 12 15.25C12.75 15.25 13.25 15.65 13.45 16.55C13.9 18.35 14.15 21.25 15.35 21.25C16.9 21.25 17.15 16.6 17.7 14.75C18.35 12.6 19.25 10.6 19.25 7.6C19.25 4.85 18.4 2.75 16.35 2.75C14.95 2.75 13.4 3.5 12 4.9Z';
  tag('dental-floss', ['hilo dental', 'usar hilo dental', 'higiene bucal', 'encías', 'dental floss', 'flossing', 'oral care'], [
    place(TOOTH, 0.44, [12, 21.25], [5.95, 21.25]),
    place(TOOTH, 0.44, [12, 21.25], [18.05, 21.25]),
    rline([[12, 17.75], [12, 7.25], [21.25, 3]], [0, 1, 0]),
  ]);
}

// Mouthwash: a tall bottle, its measuring-cup cap lifted off to the side above it and one drop
// falling between them.
tag('mouthwash', ['enjuague bucal', 'aliento fresco', 'higiene bucal', 'antiséptico', 'mouthwash', 'oral rinse', 'fresh breath'], [
  roundpoly([[6.25, 7.75], [10.25, 7.75], [10.25, 9.5], [13.25, 12], [13.25, 21.25], [3.25, 21.25], [3.25, 12], [6.25, 9.5]], [0.4, 0.4, 1.5, 1.5, 0, 2.5, 1.5, 1.5]),
  turnPath(roundpoly([[14.75, 2.75], [20.75, 2.75], [20, 7], [15.5, 7]], [0.6, 0.6, 1, 1]), 20, [17.75, 4.75]),
  waterDrop([17.5, 14], 1.5),
]);

// ── Bath ──────────────────────────────────────────────────────────────────────────────────────
// Bar soap: a rounded bar with its thickness below the top face, three bubbles rising from it.
{
  const bar = sq(3.25, 11, 17.5, 9.5, 3.25);
  tag('soap-bar', ['jabón', 'pastilla de jabón', 'lavarse las manos', 'baño', 'soap bar', 'bar soap', 'handwashing'], [
    bar,
    across(bar, 17.5),
    circ(7, 6.25, 1.75),
    circ(12.25, 3.75, 1.25),
    circ(16.75, 6.5, 1.25),
  ]);
}

// Pump bottle: a rounded bottle, the pump's stem and head with the spout pointing to the side, and one
// drop under the spout.
tag('soap-dispenser', ['dispensador de jabón', 'jabón líquido', 'crema', 'gel de baño', 'soap dispenser', 'pump bottle', 'hand soap'], [
  sq(4, 10.5, 10, 10.75, 3.5),
  vl(9, 6.25, 10.5),
  rrect(6.25, 2.75, 5.5, 3.5, 0.75),
  rline([[11.75, 4.5], [18.5, 4.5], [18.5, 6.25]], [0, 0.75, 0]),
  waterDrop([18.5, 11.75], 1.75),
]);

// Deodorant: a twist-up stick, the oval dome of product rising from the rim of its tall body with a
// shoulder each side, the dial's band at its base.
tag('deodorant', ['desodorante', 'antitranspirante', 'cuidado personal', 'barra', 'deodorant', 'antiperspirant', 'personal care'], [
  'M8.75 8.25A3.25 3.25 0 0 1 15.25 8.25',
  rrect(7.5, 8.25, 9, 13, [0.75, 0.75, 2.5, 2.5]),
  hl(7.5, 16.5, 18.25),
]);

// Loofah: a ruffled mesh ball gathered across its middle, hanging from a short cord loop (folds drawn
// as two small arcs read as a face).
{
  const n = 11;
  const ball = blob(Array.from({ length: n * 2 }, (_, i) => polar(12, 14, i % 2 ? 7 : 6.2, -90 + (i * 180) / n)), 1 / 6);
  tag('loofah', ['esponja de baño', 'estropajo', 'regadera', 'gel de baño', 'loofah', 'bath pouf', 'shower sponge'], [
    ball,
    smooth([[5.75, 14.5], [8.75, 12.75], [12, 14.5], [15.25, 12.75], [18.25, 14.5]]),
    smooth([[10.75, 7.85], [10, 4.75], [12, 2.75], [14, 4.75], [13.25, 7.85]]),
  ]);
}

// Rolled towel: a towel rolled into a cylinder lying at an angle, its end in front with the curl of
// the layers inside it (a spiral running in from the edge merged with it).
const ROLLED_TOWEL = (() => {
  const C = [8, 12.5];
  const R = 5.25;
  const end = circ(...C, R);
  const curl = `M${P(polar(...C, 2.25, -90))}A2.25 2.25 0 1 1 ${P(polar(...C, 2.25, 180))}`;
  const body = `M${P([C[0], C[1] - R])}H18A2.5 ${f(R)} 0 0 1 18 ${f(C[1] + R)}H${f(C[0])}`;
  const T = (d) => turnPath(d, -15, [12, 12.5]);
  return Object.assign([body, end, curl].map(T), { rim: T(`M${P([C[0], C[1] - R])}A${f(R)} ${f(R)} 0 0 1 ${P([C[0], C[1] + R])}`) });
})();
tag('rolled-towel', ['toalla enrollada', 'toallas', 'spa', 'amenidades', 'rolled towel', 'towel', 'towel service'], [...ROLLED_TOWEL]);

// Hot towel: the rolled towel, lower, with two wisps of steam rising from it (bebidas' wisps).
{
  const wisp = (x, yb, k = 1) =>
    `M${f(x)} ${f(yb)}C${f(x - 0.8)} ${f(yb - 0.75 * k)} ${f(x - 0.8)} ${f(yb - 1.5 * k)} ${f(x)} ${f(yb - 2.15 * k)}S${f(x + 0.8)} ${f(yb - 3.5 * k)} ${f(x)} ${f(yb - 4.25 * k)}`;
  tag('hot-towel', ['toalla caliente', 'afeitado con toalla', 'facial', 'barbería', 'hot towel', 'hot towel shave', 'steam'], [
    ...ROLLED_TOWEL.map((d) => transform(d, 1, 0, 3)),
    wisp(11, 7, 0.85),
    wisp(15, 6.25, 0.85),
  ]);
}

// Cotton swab: a thin stick at 45° with an oval cotton tip at each end.
{
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const [a, b] = [[5.75, 18.25], [18.25, 5.75]];
  tag('cotton-swab', ['hisopo', 'cotonete', 'bastoncillo', 'retoque', 'cotton swab', 'q-tip', 'cotton bud'], [
    ell(a, 3.25, 2.25, -45),
    ell(b, 3.25, 2.25, -45),
    line(add(a, mul(u, 3.25)), add(b, mul(u, -3.25))),
  ]);
}

// Tweezers, leaning: two arms joined at the top, spreading apart and bending in a little at their
// slanted tips (upright and straight they read as a letter A).
{
  const F = frame([12, 12], 20);
  const pts = [[-1.5, -9.75], [1.5, -9.75], [4.4, 5.5], [3, 9.75], [1.6, 9.25], [1.6, 5.5], [0, -4.25], [-1.6, 5.5], [-1.6, 9.25], [-3, 9.75], [-4.4, 5.5]];
  tag('tweezers', ['pinzas', 'depilar', 'cejas', 'astillas', 'tweezers', 'plucking', 'brow shaping'], [
    roundpoly(pts.map(F), [1.4, 1.4, 1.25, 0.4, 0.4, 1, 0.6, 1, 0.4, 0.4, 1.25]),
  ]);
}

// Makeup bag: a soft pouch wider at the bottom, its zipper along the top with the pull hanging, a
// lipstick and a brush's handle peeking out above it (both pass behind the pouch).
{
  const pouch = roundpoly([[5, 10.5], [19, 10.5], [21.25, 21.25], [2.75, 21.25]], [1.5, 1.5, 2.5, 2.5]);
  const lip = LIPSTICK.map((d) => place(d, 0.6, [12, 21.25], [8.75, 13.5]));
  const items = [lip[0], shut(lip[1]), shut(lip[2]), rod([14.25, 9], [17.25, 3.25], 1.25)];
  tag('makeup-bag', ['cosmetiquera', 'neceser', 'estuche de maquillaje', 'kit de belleza', 'makeup bag', 'cosmetic pouch', 'beauty kit'], [
    pouch,
    across(pouch, 13.75),
    vl(16.25, 13.75, 16.75),
    ...items.flatMap((d) => behind(d, [pouch])),
  ]);
}

// Toiletries: three small bottles of different heights side by side, a pump, a flip cap and a screw
// cap.
tag('toiletries', ['artículos de tocador', 'amenidades', 'tamaño de viaje', 'baño', 'toiletries', 'amenities', 'travel size'], [
  sq(2.75, 11.25, 4.25, 10, 1.5, SQ),
  vl(4.875, 8, 11.25),
  hl(3.25, 6.5, 8),
  sq(9.875, 8.25, 4.25, 13, 1.5, SQ),
  rline([[10.5, 8.25], [10.5, 4.75], [13.5, 3.25], [13.5, 8.25]], [0, 0.6, 0.6, 0]),
  sq(16.95, 14, 4.25, 7.25, 1.5, SQ),
  rrect(17.45, 11, 3.25, 3, 0.5),
]);

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index in each icon's `d`: `solid` is filled (closed shapes only; `z(i)` closes an open stroke
// along an edge that is already ink), `cut` is knocked out at stroke width, `lines` stay lines with
// a clearance of paper and `wire` stay lines attached. A seam between two solids that share an edge
// is cut through the silhouette, so they stay apart. A piece behind another is filled up to the
// knockout's own edge (hug(), as bebidas), so it keeps its paper from the front one.
const z = (i) => ({ z: i });
const across2 = (y) => hl(1.75, 22.25, y);
const TUBE_FILL = { solid: [0, 2], cut: [1, across2(15.75)] };
const SUN_FILL = { solid: [0, 2], cut: [1, hl(9.5, 22.25, 15.75)], lines: [3, 4, 5, 6, 7] };
const CHAIR_FILL = { solid: [0, z(3)], wire: [1, 2] };
const BRUSH_TEETH_FILL = { solid: [0, z(1)] };
const DYE_FILL = { solid: [0, HAIR_DYE.bristles, 2], wire: [3] };
const FILL = {
  lipstick: { solid: [0, z(1), z(2)] },
  'lip-balm': { solid: [LIP_BALM.lips, 3, z(4)], cut: [2] },
  mascara: { solid: [0, z(1), 2], wire: [3, 4, 5, 6] },
  eyeliner: { solid: [0, 2], cut: [1] },
  'brow-pencil': { solid: [0], cut: [1], wire: [2, 3, 4, 5] },
  eyebrow: { solid: [0], cut: [1, 2, 3, 4] },
  'eyeshadow-palette': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  foundation: { solid: [0, z(1)], cut: [2, across2(10.25)] },
  'powder-compact': { solid: [2], cut: [3], lines: [0, 1] },
  'makeup-brush': { solid: [z(0), 1, z(2)], cut: BRUSH.seams },
  blush: { solid: [z(2), 3, z(4)], lines: [0, 1] },
  'makeup-sponge': { solid: [0] },
  'eyelash-curler': { solid: [z(0)], cut: [1], wire: [2, 3, 4, 5] },
  cosmetics: { solid: [COSMETICS.fill, 2, z(3), z(4)], lines: [1] },
  'makeup-mirror': { solid: [0, 6], cut: [1], wire: [2, 3, 4, 5] },
  'hand-mirror': { solid: [0, z(2)], cut: [1, 3] },
  'nail-polish': { solid: [0, z(1)], cut: [across2(12)] },
  'nail-file': { solid: [0], cut: [1, 2, 3, 4] },
  'nail-clipper': { solid: [0], wire: [2, 3] },
  manicure: { solid: [2, 3, 4], lines: [0, 1] },
  pedicure: { solid: [z(0), 1, 2] },
  'nail-lamp': { solid: [0], cut: [1, 2, 3, 4] },
  perfume: { solid: [0, z(1), 2, 3, 4, 5] },
  'cream-jar': { solid: [0, z(1)], cut: [across2(9)] },
  'cream-tube': TUBE_FILL,
  serum: { solid: [0, z(1), z(2), 3], cut: [across2(8.25)] },
  sunscreen: SUN_FILL,
  'sunscreen-clock': SUN_FILL,
  'sheet-mask': { solid: [0], cut: [1, 2, 3] },
  'face-roller': { solid: [0, 3], wire: [1, 2] },
  'cotton-pad': { solid: [0, z(1)], cut: ['M3 10.25A9 5.5 0 0 0 21 10.25', 2, 3, 4, 5, 6, 7, 8] },
  sachet: { solid: [0], cut: [1, 2] },
  comb: { solid: [0], wire: [1, 2, 3, 4, 5, 6] },
  hairbrush: { solid: [0, z(1)], cut: [2, 3, 4, 5, 6, 7] },
  'hair-pick': { solid: [z(0), 1], wire: [2, 3, 4, 5] },
  'hair-dryer': { solid: [0, z(2)], cut: [1], lines: [3, 4, 5] },
  'hair-straightener': { solid: [...STRAIGHTENER.arms, 2], wire: [3] },
  'curling-iron': { solid: [0, z(1)], lines: [2], wire: [3] },
  scrunchie: { solid: [{ join: [0, 1] }] },
  'hair-dye': DYE_FILL,
  'hair-dye-clock': DYE_FILL,
  shampoo: { solid: [0, 2], cut: [1, across2(16.25)] },
  'hair-braid': { solid: [0, 4], cut: [1, 2, 3], wire: [5, 6] },
  'hair-extensions': { solid: [0], wire: [1, 2, 3, 4] },
  'shower-cap': { solid: [z(0), 1], cut: [across2(14.25)] },
  wig: { solid: [0], wire: [1, 2, 3] },
  razor: { solid: [0, z(3)], cut: [1, 2] },
  'straight-razor': { solid: [STRAIGHT_RAZOR.handle, 1] },
  'electric-shaver': { solid: [z(0), 1], cut: [2, across2(9.25)] },
  'hair-clipper': { solid: [0, z(6)], cut: [7], wire: [1, 2, 3, 4, 5, 8] },
  'shaving-brush': { solid: [z(0), 3], cut: [1, 2, across2(12.75)] },
  'shaving-cream': { solid: [0, 1, 2, 3], cut: [across2(13.5), across2(8.25)] },
  pomade: { solid: [1, z(2)], cut: [3, 'M2.75 12.75A8 4.25 0 0 0 18.75 12.75'], lines: [0] },
  'barber-pole': { solid: [0, POLE, 3], cut: [4, 5, 6, across2(6), across2(18)] },
  'salon-chair': CHAIR_FILL,
  'salon-chair-clock': CHAIR_FILL,
  'salon-chair-check': CHAIR_FILL,
  'shampoo-bowl': { solid: [0, 4], wire: [1, 2, 3] },
  beard: { solid: [0, 1] },
  mustache: { solid: [0] },
  toothbrush: BRUSH_TEETH_FILL,
  'toothbrush-clock': BRUSH_TEETH_FILL,
  'electric-toothbrush': { solid: [0, z(1), z(2)], cut: [3] },
  toothpaste: { solid: [0, z(2), 3], cut: [1] },
  'dental-floss': { solid: [0, 1], lines: [2] },
  mouthwash: { solid: [0, 1, 2] },
  'soap-bar': { solid: [0, 2, 3, 4], cut: [1] },
  'soap-dispenser': { solid: [0, 2, 4], wire: [1, 3] },
  deodorant: { solid: [z(0), 1], cut: [2, across2(8.25)] },
  loofah: { solid: [0], cut: [1], wire: [2] },
  'rolled-towel': { solid: [z(0), 1], cut: [ROLLED_TOWEL.rim, 2] },
  'hot-towel': { solid: [z(0), 1], cut: [transform(ROLLED_TOWEL.rim, 1, 0, 3), 2], lines: [3, 4] },
  'cotton-swab': { solid: [0, 1], wire: [2] },
  tweezers: { solid: [0] },
  'makeup-bag': { solid: [0, 4], cut: [1, 2], lines: [3, 5] },
  toiletries: { solid: [0, 3, z(4), 5, 6], wire: [1, 2] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : typeof i === 'object' ? (i.join ? i.join.map((k) => d[k]).join('') : shut(d[i.z])) : d[i]));
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, pick(v)]));
}
// Lines only: their filled version is the outline itself
for (const name of ['false-eyelashes', 'bobby-pin']) icons[name].fill = false;

// ── Parts (DESIGN.md › Named parts) ───────────────────────────────────────────────────────────
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const PARTS = {
  lipstick: { case: [0, 1], bullet: [2] },
  'lip-balm': { lips: [0, 1, 2], stick: [3, 4] },
  mascara: { tube: [0, 1], wand: range(2, 6) },
  eyeliner: { pen: [0, 1], stroke: [2] },
  'brow-pencil': { pencil: [0, 1], spoolie: range(2, 5) },
  eyebrow: { brow: [0], hairs: range(1, 4) },
  'eyeshadow-palette': { palette: [0], pans: range(1, 6) },
  foundation: { bottle: [0], cap: [1], level: [2] },
  'powder-compact': { lid: [0, 1], base: [2], pan: [3] },
  'makeup-brush': { bristles: [0], handle: [1, 2] },
  blush: { pan: [0, 1], brush: [2, 3, 4] },
  'makeup-sponge': { sponge: [0] },
  'eyelash-curler': { clamp: [0, 1], handles: range(2, 5) },
  'false-eyelashes': { strip: [0], lashes: range(1, 5) },
  cosmetics: { bottle: [0, 1], lipstick: [2, 3, 4] },
  'makeup-mirror': { glass: [0, 1], stand: range(2, 6) },
  'hand-mirror': { glass: [0, 1], handle: [2, 3] },
  'nail-polish': { bottle: [0], cap: [1] },
  'nail-file': { board: [0, 1], grit: [2, 3, 4] },
  'nail-clipper': { body: [0, 1], lever: [2, 3] },
  manicure: { finger: [0, 1, 2], brush: [3, 4] },
  pedicure: { foot: [0], brush: [1, 2] },
  'nail-lamp': { lamp: [0, 1], light: [2, 3, 4] },
  perfume: { bottle: [0, 1, 2], mist: [3, 4, 5] },
  'cream-jar': { lid: [0], jar: [1] },
  'cream-tube': { tube: [0, 1], cap: [2] },
  serum: { bottle: [0, 1, 2], drop: [3] },
  sunscreen: { tube: [0, 1, 2], sun: range(3, 7) },
  'sunscreen-clock': { tube: [0, 1, 2], sun: range(3, 7) },
  'sheet-mask': { mask: [0], holes: [1, 2, 3] },
  'face-roller': { roller: [0, 3], frame: [1, 2] },
  'cotton-pad': { pad: [0, 1], stitches: range(2, 8) },
  'face-retouch': { face: [0] },
  sachet: { packet: [0], seals: [1, 2] },
  comb: { spine: [0], teeth: range(1, 6) },
  hairbrush: { head: [0], handle: [1], bristles: range(2, 7) },
  'hair-pick': { handle: [0, 1], tines: range(2, 5) },
  'hair-dryer': { dryer: [0, 1, 2], air: [3, 4, 5] },
  'hair-straightener': { arms: [0, 1], hinge: [2], cord: [3] },
  'curling-iron': { iron: [0, 1], clamp: [2], cord: [3] },
  'bobby-pin': { pin: [0] },
  scrunchie: { ruffle: [0], hole: [1] },
  'hair-dye': { bowl: [0], brush: [1, 2, 3] },
  'hair-dye-clock': { bowl: [0], brush: [1, 2, 3] },
  shampoo: { bottle: [0, 1], cap: [2] },
  'hair-braid': { braid: [0, 1, 2, 3], band: [4], tuft: [5, 6] },
  'hair-extensions': { weft: [0], strands: range(1, 4) },
  'shower-cap': { cap: [0], band: [1] },
  wig: { hair: [0], form: [1, 2, 3] },
  razor: { head: [0, 1, 2], handle: [3] },
  'straight-razor': { handle: [0], blade: [1] },
  'electric-shaver': { head: [0], body: [1, 2] },
  'hair-clipper': { blade: range(0, 5), body: [6, 7], cord: [8] },
  'shaving-brush': { bristles: [0, 1, 2], handle: [3] },
  'shaving-cream': { can: [0, 1, 2], foam: [3] },
  pomade: { lid: [0], tin: [1, 2, 3] },
  'barber-pole': { pole: [0, 1, 2, 3], stripes: [4, 5, 6] },
  'salon-chair': { seat: [0, 1], base: [2, 3] },
  'salon-chair-clock': { seat: [0, 1], base: [2, 3] },
  'salon-chair-check': { seat: [0, 1], base: [2, 3] },
  'shampoo-bowl': { basin: [0, 1, 2], sprayer: [3, 4] },
  beard: { beard: [0], mustache: [1] },
  mustache: { mustache: [0] },
  toothbrush: { handle: [0], bristles: [1] },
  'toothbrush-clock': { handle: [0], bristles: [1] },
  'electric-toothbrush': { handle: [0, 3], head: [1, 2] },
  toothpaste: { tube: [0, 1, 2], paste: [3] },
  'dental-floss': { teeth: [0, 1], floss: [2] },
  mouthwash: { bottle: [0], cap: [1], drop: [2] },
  'soap-bar': { bar: [0, 1], bubbles: [2, 3, 4] },
  'soap-dispenser': { bottle: [0], pump: [1, 2, 3], drop: [4] },
  deodorant: { stick: [0], body: [1, 2] },
  loofah: { pouf: [0, 1], cord: [2] },
  'rolled-towel': { towel: [0, 1, 2] },
  'hot-towel': { towel: [0, 1, 2], steam: [3, 4] },
  'cotton-swab': { tips: [0, 1], stick: [2] },
  tweezers: { tweezers: [0] },
  'makeup-bag': { bag: [0, 1, 2], items: [3, 4, 5] },
  toiletries: { pump: [0, 1, 2], flip: [3, 4], screw: [5, 6] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
const MOTION = {
  lipstick: { effect: 'slide', parts: ['bullet'], vector: [0, -1.5] },
  'lip-balm': { effect: 'slide', parts: ['stick'], vector: [-0.75, 1.3] },
  mascara: { effect: 'wiggle', parts: ['wand'], origin: [13.75, 21.25] },
  eyeliner: { effect: 'wiggle', origin: [10.75, 13.75] },
  'brow-pencil': { effect: 'wiggle', origin: [4.5, 19.5] },
  'makeup-brush': { effect: 'wiggle', origin: [19.5, 4.5] },
  blush: { effect: 'wiggle', parts: ['brush'], origin: [21, 4] },
  'makeup-sponge': { effect: 'bounce', vector: [0, -1.5] },
  'eyelash-curler': { effect: 'bounce', parts: ['clamp'], vector: [0, 1] },
  'false-eyelashes': { effect: 'wiggle', parts: ['lashes'], origin: [12, 15] },
  'makeup-mirror': { effect: 'wiggle', parts: ['glass'], origin: [12, 7.75] },
  'hand-mirror': { effect: 'wiggle', origin: [12, 21.25] },
  'nail-file': { effect: 'slide', vector: [1.5, -1.5] },
  'nail-clipper': { effect: 'bounce', parts: ['lever'], vector: [0, 1] },
  manicure: { effect: 'wiggle', parts: ['brush'], origin: [10.66, 11.59] },
  pedicure: { effect: 'wiggle', parts: ['brush'], origin: [18.75, 14.75] },
  'nail-lamp': { effect: 'beat', parts: ['light'], origin: [12, 15] },
  perfume: { effect: 'slide', parts: ['mist'], vector: [1.5, 0] },
  serum: { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  sunscreen: { effect: 'beat', parts: ['sun'], origin: [8.5, 8.5] },
  'sunscreen-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'face-roller': { effect: 'slide', vector: [1.5, 0] },
  'face-retouch': { effect: 'beat', parts: ['badge'], origin: [17.5, 6.5] },
  comb: { effect: 'slide', vector: [1.5, 0] },
  hairbrush: { effect: 'wiggle', origin: [12, 21.25] },
  'hair-dryer': { effect: 'slide', parts: ['air'], vector: [1.5, 0] },
  'curling-iron': { effect: 'wiggle', parts: ['clamp'], origin: [6.6, 8.2] },
  'hair-dye': { effect: 'wiggle', parts: ['brush'], origin: [8.75, 15.5] },
  'hair-dye-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'hair-extensions': { effect: 'wiggle', parts: ['strands'], origin: [12, 4.5] },
  razor: { effect: 'slide', vector: [0, 1.5] },
  'electric-shaver': { effect: 'wiggle', origin: [12, 21.25] },
  'hair-clipper': { effect: 'wiggle', origin: [12, 19] },
  'shaving-brush': { effect: 'wiggle', origin: [12, 21.25] },
  'shaving-cream': { effect: 'float', parts: ['foam'], vector: [0, -1.5] },
  'barber-pole': { effect: 'slide', parts: ['stripes'], vector: [0, -1.5] },
  'salon-chair': { effect: 'bounce', parts: ['seat'], vector: [0, -1.5] },
  'salon-chair-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'salon-chair-check': { effect: 'beat', parts: ['badge'], origin: BC },
  toothbrush: { effect: 'slide', vector: [1.5, -1.5] },
  'toothbrush-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'electric-toothbrush': { effect: 'wiggle', origin: [6.5, 18.5] },
  mouthwash: { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'soap-bar': { effect: 'float', parts: ['bubbles'], vector: [0, -1.5] },
  'soap-dispenser': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  deodorant: { effect: 'slide', parts: ['stick'], vector: [0, -1.5] },
  loofah: { effect: 'ring', origin: [12, 2.75] },
  'hot-towel': { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Mirroring (DESIGN.md › Mirroring): the writing tools, as the set's pencils ───────────────
for (const name of ['eyeliner', 'brow-pencil']) icons[name].mirror = true;

// ── 16 px (DESIGN.md › 16 px): on the pixel grid (pixel centers at 0.75 + 1.5k), fewer pieces ──
// The cotton pad: its face, its thickness and two stitches as 2-pixel dots (r 1 on the corner the four
// pixels share)
{
  const face = ell([12, 9], 8.25, 3.75);
  const side = 'M3.75 9V12A8.25 3.75 0 0 0 20.25 12V9';
  const stitches = [9, 15].map((x) => dot(x, 9, 1));
  icons['cotton-pad'].small = { d: [face, side, ...stitches], fill: { solid: [face, `${side}Z`], cut: ['M3.75 9A8.25 3.75 0 0 0 20.25 9', ...stitches] } };
}
// The pomade: the tin's face and side, one swipe across it, the lid behind
{
  const top = ell([12, 12], 8.25, 3.75);
  const side = 'M3.75 12V15A8.25 3.75 0 0 0 20.25 15V12';
  const [lid] = behind(ell([15.75, 7.5], 5.25, 3.75), [top, `${side}Z`]);
  icons.pomade.small = { d: [lid, top, side, hl(9, 15, 12)], fill: { solid: [top, `${side}Z`], cut: ['M3.75 12A8.25 3.75 0 0 0 20.25 12', hl(9, 15, 12)], lines: [lid] } };
}

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge: the filled enclosure doesn't draw it, at 58 % it stops reading and the slash would
// cut through it
offV(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });

export default { category: 'belleza', label: 'Belleza y cuidado personal', icons };
