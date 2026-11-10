// Arte y manualidades (art and crafts): painting and its supplies, drawing and coloring, painterly
// marks and styles, sculpture and pottery, fiber crafts, paper crafts, and galleries.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5
// stroke, keylines, continuous corners and the square bottom-right corner on containers.
// What the set already drew is reused, never redrawn: edicion's brush (the brushes and the brush
// cup), its pencil (the colored pencils) and its scissors (the cut line); nucleo's document is the
// sheet under the coloring page and the stencil, and its person is the artist. The yarn
// family shares one ball, the frames one border. Whatever passes behind another piece is cut with
// `behind` (1.5 of paper, never trimmed by hand); badges are the engine's.
import { arc, circ, dot, f, flipPath, halfChord, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import edicion from './edicion.mjs';
import nucleo from './nucleo.mjs';

const E = edicion.icons;
const N = nucleo.icons;

// ── Vectors ───────────────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const unit = (v) => mul(v, 1 / Math.hypot(v[0], v[1]));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
const BR = { square: ['br'] };
/** Container with the signature corner (a square bottom-right corner). */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const Z = (d) => (/[zZ]\s*$/.test(d) ? d : `${d}Z`);
/** A frame along an axis: at(u, v) is u along the axis (at `deg` degrees from O) and v across it. */
const frame = (O, deg) => {
  const u = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const n = [-u[1], u[0]];
  return (s, t = 0) => [O[0] + s * u[0] + t * n[0], O[1] + s * u[1] + t * n[1]];
};

// ── Paths as segments (herramientas' construction): parse, clip, behind, xf ────────────────────
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
function segAt(s, t) {
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
  if (s.t === 'L') return { t: 'L', a: segAt(s, t0), b: segAt(s, t1) };
  if (s.t === 'A') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}
const segLen = (s) => {
  let [n, a] = [0, segAt(s, 0)];
  for (let k = 1; k <= 32; k++) {
    const b = segAt(s, k / 32);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
};
function segD(s) {
  if (s.t === 'L') return `L${P(s.b)}`;
  if (s.t === 'C') return `C${P(s.p[1])} ${P(s.p[2])} ${P(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(segSub(s, 0, 0.5)) + segD(segSub(s, 0.5, 1));
  // A half circle keeps exactly half its chord as written for its radius (DESIGN.md › Circles are exact)
  const R = Math.abs(Math.abs(s.da) - Math.PI) < 1e-6 ? halfChord(segAt(s, 0), segAt(s, 1)) : f(s.r);
  return `A${R} ${R} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${P(segAt(s, 1))}`;
}
function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = segAt(sp.segs[0], 0);
    o += `M${P(last)}`;
    for (const s of sp.segs) {
      if (!near(segAt(s, 0), last)) o += `M${P(segAt(s, 0))}`;
      o += segD(s);
      last = segAt(s, 1);
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
      const NS = 96;
      let prev = keep(segAt(s, 0));
      let start = prev ? 0 : null;
      for (let k = 1; k <= NS; k++) {
        const now = keep(segAt(s, k / NS));
        if (now === prev) continue;
        let [lo, hi] = [(k - 1) / NS, k / NS];
        for (let j = 0; j < 30; j++) {
          const m = (lo + hi) / 2;
          if (keep(segAt(s, m)) === prev) lo = m;
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
      return Array.from({ length: n + 1 }, (_, k) => segAt(s, k / n));
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
 * The part of `d` that shows behind `fronts`: whatever lies inside a closed front, or closer than
 * `gap` (center to center) to any front's stroke, is dropped, and so is any piece left shorter than
 * `min`. 3 center to center is the set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3, min = 2) {
  const closed = fronts.filter((x) => /[zZ]\s*$/.test(x)).flatMap(samples);
  const pts = fronts.flatMap(samples).flat();
  const keep = (p) => !closed.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep, min);
}
/** Similarity transform: scale `s` and turn `deg` about `o`, then move `o` to `to` (flip mirrors x first). */
function xf(d, { s = 1, deg = 0, o = [12, 12], to = o, flip = false } = {}) {
  const m = (p) => {
    let v = [(p[0] - o[0]) * s, (p[1] - o[1]) * s];
    if (flip) v[0] = -v[0];
    v = rot(v, [0, 0], deg);
    return [v[0] + to[0], v[1] + to[1]];
  };
  return ser(
    parse(d).map((sp) => ({
      closed: sp.closed,
      segs: sp.segs.map((g) => {
        if (g.t === 'L') return { t: 'L', a: m(g.a), b: m(g.b) };
        if (g.t === 'C') return { t: 'C', p: g.p.map(m) };
        const c = m(g.c);
        const a = m(segAt(g, 0));
        return { t: 'A', c, r: g.r * s, a0: Math.atan2(a[1] - c[1], a[0] - c[0]), da: g.da * (flip ? -1 : 1) };
      }),
    })),
  );
}

// ── Shapes ────────────────────────────────────────────────────────────────────────────────────
/** Open polyline with rounded corners (one radius per vertex, or one for all; 0 = sharp). */
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
    const u = unit(sub2(A, V));
    const w = unit(sub2(B, V));
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1])));
    const t = r / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(add2(V, mul(u, t)))}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(add2(V, mul(w, t)))}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** A capsule (a pill) between two points, `r` its half-width. */
function capsule(a, b, r) {
  const u = unit(sub2(b, a));
  const n = [-u[1] * r, u[0] * r];
  const R = halfChord(add2(b, n), sub2(b, n));
  return `M${P(add2(a, n))}L${P(add2(b, n))}A${R} ${R} 0 0 0 ${P(sub2(b, n))}L${P(sub2(a, n))}A${R} ${R} 0 0 0 ${P(add2(a, n))}Z`;
}
/**
 * Ellipse of semi-axes rx, ry at (cx, cy) turned `deg` degrees, as four cubics (so it can be
 * clipped and moved like any other path: the segment tools here only know circular arcs).
 */
function ell(cx, cy, rx, ry, deg = 0) {
  const k = 0.5523;
  const m = (x, y) => add2(rot([x, y], [0, 0], deg), [cx, cy]);
  const q = [
    [m(rx, 0), m(rx, ry * k), m(rx * k, ry), m(0, ry)],
    [m(0, ry), m(-rx * k, ry), m(-rx, ry * k), m(-rx, 0)],
    [m(-rx, 0), m(-rx, -ry * k), m(-rx * k, -ry), m(0, -ry)],
    [m(0, -ry), m(rx * k, -ry), m(rx, -ry * k), m(rx, 0)],
  ];
  return `M${P(q[0][0])}${q.map(([, a, b, c]) => `C${P(a)} ${P(b)} ${P(c)}`).join('')}Z`;
}
/** Smooth curve through points (Catmull-Rom as cubics), closed or open. */
function smooth(pts, closed = false, k = 1 / 6) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let s = `M${P(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    s += `C${P(add2(p1, mul(sub2(p2, p0), k)))} ${P(sub2(p2, mul(sub2(p3, p1), k)))} ${P(p2)}`;
  }
  return closed ? `${s}Z` : s;
}
/** Dashes of length `dash` with `gap` between them along an open path (from its start). */
function dashes(d, dash, gap) {
  const segs = parse(d)[0].segs;
  const pts = segs.flatMap((s) => Array.from({ length: 41 }, (_, k) => segAt(s, k / 40)));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum.at(-1);
  const out = [];
  for (let s0 = 0; s0 + dash <= total + 0.01; s0 += dash + gap) {
    const run = pts.filter((_, i) => cum[i] >= s0 - 1e-6 && cum[i] <= s0 + dash + 1e-6);
    out.push(line(...run.filter((p, i) => i === 0 || i === run.length - 1 || i % 4 === 0)));
  }
  return out;
}
/** Five-pointed star around (cx, cy): outer radius R, inner r, its points softened. */
const starPts = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? r : R, -90 + i * 36));

// ── Icons and their blocks ────────────────────────────────────────────────────────────────────
const icons = {};
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Painting ──────────────────────────────────────────────────────────────────────────────────
// Easel: the two front legs meet above the canvas and splay below its ledge to the floor; the
// back leg stands between them, shorter (it is behind)
{
  const top = 6.75;
  const ledgeY = 14.75;
  const apex = [12, 2.25];
  const foot = (x) => [x, 21.25];
  const legAt = (fx, y) => lerp(apex, foot(fx), (y - apex[1]) / (21.25 - apex[1]));
  const canvas = rline([[6.25, ledgeY], [6.25, top], [17.75, top], [17.75, ledgeY]], [0, 2, 2, 0]);
  add('easel', ['caballete', 'pintura', 'taller de arte', 'clases de pintura', 'easel', 'painting', 'art studio'], [
    canvas,
    hl(ledgeY, 4.25, 19.75),
    line(legAt(4.75, top), apex, legAt(19.25, top)),
    line(legAt(4.75, ledgeY), foot(4.75)),
    line(legAt(19.25, ledgeY), foot(19.25)),
    vl(12, ledgeY, 19.5),
  ]);
  FILL.easel = { solid: [Z(canvas)], wire: [1, 2, 3, 4, 5] };
  PARTS.easel = { canvas: [0], ledge: [1], stand: [2, 3, 4, 5] };
}
// Paint tube: crimped flat at the back, widening from the shoulder to the crimp, cap off, and a
// curl of paint leaving the nozzle
{
  const at = frame([7.65, 15.8], -45);
  const tube = roundpoly(
    [at(0, -1.1), at(1.5, -1.1), at(3.5, -2.4), at(12.5, -3.1), at(15, -3.1), at(15, 3.1), at(12.5, 3.1), at(3.5, 2.4), at(1.5, 1.1), at(0, 1.1)],
    [0.35, 0.5, 1.5, 0, 0.6, 0.6, 0, 1.5, 0.5, 0.35],
  );
  const crimp = line(at(12.5, -3.1), at(12.5, 3.1));
  const curl = smooth([at(0, 0), at(-1.6, 0.1), at(-3.1, 1.3), at(-2.9, 3.2), at(-1.3, 3.9)]);
  add('paint-tube', ['tubo de pintura', 'óleo', 'acrílico', 'pinturas', 'paint tube', 'oil paint', 'acrylic'], [tube, crimp, curl]);
  FILL['paint-tube'] = { solid: [0], cut: [1], wire: [2] };
  PARTS['paint-tube'] = { tube: [0, 1], paint: [2] };
  icons['paint-tube'].mirror = true;
}
// Palette knife: the teardrop blade at the bottom left, the neck cranked once, the short handle
{
  const at = frame([3.75, 20.25], -45);
  const c = 7;
  const r = 2.75;
  const phi = Math.asin(r / c);
  const tl = Math.sqrt(c * c - r * r);
  const t1 = at(tl * Math.cos(phi), -tl * Math.sin(phi));
  const t2 = at(tl * Math.cos(phi), tl * Math.sin(phi));
  const blade = `M${P(at(0, 0))}L${P(t1)}A${f(r)} ${f(r)} 0 1 1 ${P(t2)}Z`;
  const neck = rline([at(c + r, 0), at(11.25, 0), at(13.25, -2), at(14.75, -2)], [0, 0.75, 0.75, 0]);
  const handle = capsule(at(16.25, -2), at(21.5, -2), 1.5);
  add('palette-knife', ['espátula', 'cuchillo de paleta', 'empaste', 'mezclar colores', 'palette knife', 'impasto', 'painting knife'], [blade, neck, handle]);
  FILL['palette-knife'] = { solid: [0, 2], wire: [1] };
  PARTS['palette-knife'] = { blade: [0], neck: [1], handle: [2] };
  MOTION['palette-knife'] = { effect: 'wiggle', origin: at(0, 0) };
  icons['palette-knife'].mirror = true;
}
// Brushes: edicion's brush three times, fanned from one point below; the middle one is edicion's
// pointed brush, the left one flat, the right one a fan (smaller, each head drawn in one outline). The
// side brushes pass behind the middle one.
const BRUSH = (() => {
  // edicion's frame for its brush: the tip at u 0, the bristles to u 9, the ferrule to 12.5, the
  // handle to 22
  const at = frame([3.5, 20.5], -45);
  const c = (...q) => q.map((p) => P(at(...p))).join(' ');
  const [pointed, ferrule, handle] = E.brush.d;
  // the flat and fan brushes in one outline each, bristles and ferrule together
  const flat = roundpoly([at(12.5, -2.25), at(1.25, -2.25), at(1.25, 2.25), at(12.5, 2.25)], [0.9, 1, 1, 0.9]);
  const fan = `M${c([12.5, -1.35])}A0.9 0.9 0 0 0 ${c([11.6, -2.25])}L${c([9, -2.25])}L${c([2.25, -3.25])}A4.6 4.6 0 0 0 ${c([2.25, 3.25])}L${c([9, 2.25])}L${c([11.6, 2.25])}A0.9 0.9 0 0 0 ${c([12.5, 1.35])}Z`;
  return { at, pointed, flat, fan, ferrule, handle };
})();
{
  // The handles point at one pivot below the canvas; the middle brush (its handle's end at the
  // bottom) stands in front, the side ones end where they would meet its handle and pass behind it
  const pivot = [12, 29];
  const end = BRUSH.at(22);
  // edicion's brush points from its handle (top right) to its tip (bottom left): 135°
  const place = (d, ang, s, r0) => xf(d, { s, deg: ang - 135, o: end, to: add2(pivot, mul([Math.cos((ang * Math.PI) / 180), Math.sin((ang * Math.PI) / 180)], r0)) });
  const fronts = [BRUSH.pointed, BRUSH.ferrule, BRUSH.handle].map((d) => place(d, -90, 0.82, 7.75));
  const side = (head, ang) => [head, BRUSH.handle].map((d) => behind(place(d, ang, 0.62, 12), [Z(fronts[0]), Z(fronts[1]), fronts[2]]));
  const left = side(BRUSH.flat, -109);
  const right = side(BRUSH.fan, -71);
  add('brushes', ['pinceles', 'juego de pinceles', 'biblioteca de pinceles', 'pinceles de artista', 'brushes', 'brush set', 'brush library'], [...fronts, ...left, ...right]);
  FILL.brushes = { solid: [0, Z(fronts[1])], lines: [3, 4, 5, 6], wire: [2] };
  PARTS.brushes = { brush: [0, 1, 2], left: [3, 4], right: [5, 6] };
}
// Brush cup: a glass of rinse water, open at the top, and edicion's brush soaking in it bristles
// down, its handle leaning out over the rim; the water line passes behind the brush. (Bristles up,
// two brushes read as a potted plant.)
{
  const jar = rline([[3.25, 9.5], [3.25, 21.25], [20.75, 21.25], [20.75, 9.5]], [0, 3.5, 0, 0]);
  // edicion's brush points from its tip (bottom left) to its handle at -45°: turned to -74°; the
  // jar is as wide as the square keyline so the water line keeps 4 on each side of the bristles
  const [head, ferrule, handle] = [BRUSH.pointed, BRUSH.ferrule, BRUSH.handle].map((d) => xf(d, { s: 0.75, deg: -29, o: BRUSH.at(0), to: [11, 18.25] }));
  const water = behind(hl(16.25, 3.25, 20.75), [head, Z(ferrule), handle]);
  add('brush-cup', ['vaso de agua', 'lavar pinceles', 'acuarela', 'taller', 'brush cup', 'rinse water', 'clean brush'], [jar, head, ferrule, handle, water]);
  FILL['brush-cup'] = { solid: [1, Z(ferrule)], wire: [0, 3, 4] };
  PARTS['brush-cup'] = { jar: [0, 4], brush: [1, 2, 3] };
}
// Spray paint: an aerosol can tilted toward the wall (its seam below the top, the valve and the
// actuator on it, the nozzle facing right) and the mist it sprays, three drops fanning out. (The
// painted line it left read as a written m or a y.)
{
  const can = (d) => xf(d, { deg: 15, o: [0, 5], to: [7.5, 14.75] });
  const body = can(sq(-3.25, -1.5, 6.5, 12, 1.75));
  const seam = can(hl(1.5, -3.25, 3.25));
  const actuator = can(rline([[-1.25, -1.5], [-1.25, -4], [1.75, -4], [1.75, -1.5]], [0, 0.6, 0.6, 0]));
  const mist = [dot(15, 6.75), dot(19.25, 4.25), dot(19, 9.5)];
  add('spray-paint', ['pintura en aerosol', 'grafiti', 'arte urbano', 'spray', 'spray paint', 'graffiti', 'street art'], [body, seam, actuator, ...mist]);
  FILL['spray-paint'] = { solid: [0, 3, 4, 5], cut: [1], wire: [2] };
  PARTS['spray-paint'] = { can: [0, 1, 2], mist: [3, 4, 5] };
  icons['spray-paint'].mirror = true;
}
// Sketchbook: landscape and bound along its short side, as sketchbooks are, by spiral loops that
// cross its left edge; mountains and a sun sketched on the cover. (Bound along the top, it read as
// a calendar; with a wavy line in that room, as a line chart, and with one round hill, as a face.)
{
  const cover = box(5, 5, 16.25, 14, 3);
  const rings = [8.5, 12, 15.5].map((y) => hl(y, 2.75, 7.25));
  const hill = rline([[10.25, 15.5], [13.5, 11.75], [15.5, 14], [16.75, 12.75], [18.25, 14.25]], [0, 0.75, 0.5, 0.5, 0]);
  add('sketchbook', ['cuaderno de bocetos', 'libreta', 'bocetos', 'dibujo', 'sketchbook', 'sketches', 'drawing pad'], [cover, ...rings, hill, dot(16.75, 8.75)]);
  FILL.sketchbook = { solid: [0], wire: [1, 2, 3], cut: [4, 5] };
  PARTS.sketchbook = { cover: [0], spiral: [1, 2, 3], drawing: [4, 5] };
}
// Crayon: on the diagonal, the wax cone cut flat at the tip, the paper wrapper a step wider than
// the wax and marked by its two bands, the back end flat
{
  const at = frame([5.1, 18.9], -45);
  const body = roundpoly(
    [at(0, -1.1), at(3, -2.25), at(5.5, -2.25), at(5.5, -2.75), at(19, -2.75), at(19, 2.75), at(5.5, 2.75), at(5.5, 2.25), at(3, 2.25), at(0, 1.1)],
    [0.4, 0.8, 0, 0.3, 0.75, 0.75, 0.3, 0, 0.8, 0.4],
  );
  add('crayon', ['crayón', 'cera', 'colorear', 'dibujo infantil', 'crayon', 'wax crayon', 'coloring'], [body, line(at(8.75, -2.75), at(8.75, 2.75)), line(at(15.75, -2.75), at(15.75, 2.75))]);
  FILL.crayon = { solid: [0], cut: [1, 2] };
  PARTS.crayon = { crayon: [0], wrapper: [1, 2] };
  MOTION.crayon = { effect: 'wiggle', origin: at(0, 0) };
  icons.crayon.mirror = true;
}
// Crayon box: three crayons standing out of the open box at different heights, each with its
// flat-cut cone
{
  const crayon = (x0, top) => {
    const w = 3.25;
    return rline([[x0, 12.25], [x0, top], [x0 + 0.95, top - 2.25], [x0 + w - 0.95, top - 2.25], [x0 + w, top], [x0 + w, 12.25]], [0, 0.4, 0.3, 0.3, 0.4, 0]);
  };
  const crayons = [crayon(4.25, 7.75), crayon(10.375, 5.25), crayon(16.5, 9)];
  const front = box(2.5, 12.25, 19, 9, 1);
  add('crayon-box', ['caja de crayones', 'crayones', 'útiles escolares', 'colorear', 'crayon box', 'crayons', 'school supplies'], [front, ...crayons]);
  FILL['crayon-box'] = { solid: [0, ...crayons.map(Z)] };
  PARTS['crayon-box'] = { box: [0], crayons: [1, 2, 3] };
}
// Colored pencils: edicion's pencil three times, fanned toward a point below the canvas; the side
// pencils pass behind the middle one. The middle one keeps its cone's line (without it the three
// read as crystals); on the side ones, smaller, the tip's triangle closed up at weight 2.1.
{
  const [outline, cone] = E['pencil-sparkle'].d;
  const tip = [4.1, 19.9];
  const pivot = [12, 27];
  const place = (d, ang, s, r0) => {
    const u = [Math.cos((ang * Math.PI) / 180), Math.sin((ang * Math.PI) / 180)];
    return xf(d, { s, deg: ang + 225, o: tip, to: add2(pivot, mul(u, r0 + 20.5 * s)) });
  };
  const [mid, midCone] = [outline, cone].map((d) => place(d, -90, 0.88, 6.7));
  const side = (ang) => behind(place(outline, ang, 0.8, 9), [mid]);
  add('colored-pencils', ['lápices de colores', 'colores', 'ilustración', 'colorear', 'colored pencils', 'pencil set', 'coloring'], [mid, midCone, side(-110), side(-70)]);
  FILL['colored-pencils'] = { solid: [0], cut: [1], lines: [2, 3] };
  PARTS['colored-pencils'] = { pencil: [0, 1], left: [2], right: [3] };
}
// Coloring page: nucleo's document holding a tulip's outline on its stem, and a crayon coloring it in,
// on top at the bottom right (a custom badge: the engine clears the page under it). The crayon lies
// over the page's corner so the engine clears all of it: around a corner left outside, a sliver of
// the page remained. (Hatching half the tulip left slivers in its notches that closed at 2.1.)
{
  const doc = N.document.d[0];
  const cup = roundpoly([[7.5, 6], [9.5, 8.25], [11.5, 5.5], [13.5, 8.25], [15.5, 6], [15.5, 9.75], [11.5, 13.75], [7.5, 9.75]], [0, 0, 0, 0, 0, 2.5, 3, 2.5]);
  const low = Math.max(...samples(cup)[0].map((q) => q[1]));
  const stem = vl(11.5, low, 18.25);
  const at = frame([15.25, 15.25], 45);
  const body = roundpoly([at(0, -0.8), at(2.25, -1.75), at(8, -1.75), at(8, 1.75), at(2.25, 1.75), at(0, 0.8)], [0.3, 0.6, 0.6, 0.6, 0.6, 0.3]);
  const band = line(at(5.25, -1.75), at(5.25, 1.75));
  add('coloring-page', ['página para colorear', 'colorear', 'libro para colorear', 'dibujo', 'coloring page', 'coloring book', 'coloring'], [doc, cup, stem], {
    badge: { d: [body, band], knock: body, fill: { solid: [body], cut: [band] } },
  });
  FILL['coloring-page'] = { solid: [0], cut: [1, 2] };
  PARTS['coloring-page'] = { page: [0], drawing: [1, 2] };
}
// Paint drips: paint across the top whose wavy lower edge runs down in three drips of different
// lengths, each ending round
{
  const drips =
    'M3.25 14V5.5A2.25 2.25 0 0 1 5.5 3.25H18.5A2.25 2.25 0 0 1 20.75 5.5V7C20.75 8.6 18.25 8 18.25 9.5V12A1.5 1.5 0 0 1 15.25 12V9.75C15.25 8.6 12.25 8.6 12.25 10V18A1.5 1.5 0 0 1 9.25 18V10C9.25 8.6 6.25 8.6 6.25 10V14A1.5 1.5 0 0 1 3.25 14Z';
  add('paint-drips', ['goteo de pintura', 'pintura fresca', 'chorreado', 'efecto goteo', 'paint drips', 'dripping paint', 'wet paint'], [drips]);
  FILL['paint-drips'] = { solid: [0] };
  PARTS['paint-drips'] = { paint: [0] };
  MOTION['paint-drips'] = { effect: 'bounce', vector: [0, 1.5] };
}
// Paint splatter: an irregular splat, its arms of different lengths spread unevenly and ending
// round (pointed and evenly spread, they read as a star or a sparkle), and two drops flung clear of it
{
  const c = [11.5, 12.25];
  // each arm: its angle and its reach; between two arms, the body's radius
  const arms = [[-100, 9], [-52, 6.25], [-10, 9], [38, 5.75], [80, 8.75], [130, 6.5], [175, 9]];
  const body = [4.25, 4, 4.5, 4, 4.25, 4.5, 4.25];
  const pts = arms.flatMap(([a, r], i) => {
    const next = arms[(i + 1) % arms.length][0] + (i === arms.length - 1 ? 360 : 0);
    return [polar(...c, r, a), polar(...c, body[i], (a + next) / 2)];
  });
  const splat = roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.6 : 1)));
  add('paint-splatter', ['salpicadura', 'mancha de pintura', 'tinta', 'pintura de acción', 'paint splatter', 'splash', 'splat'], [splat, dot(4, 4.5), dot(19.25, 19.5)]);
  FILL['paint-splatter'] = { solid: [0, 1, 2] };
}
// Pixel art: a heart drawn only with the pixel grid's horizontal and vertical steps
{
  const u = 2.5;
  const g = (x, y) => [3.25 + x * u, 4.5 + y * u];
  const cells = [[1, 0], [3, 0], [3, 1], [4, 1], [4, 0], [6, 0], [6, 1], [7, 1], [7, 3], [6, 3], [6, 4], [5, 4], [5, 5], [4, 5], [4, 6], [3, 6], [3, 5], [2, 5], [2, 4], [1, 4], [1, 3], [0, 3], [0, 1], [1, 1]];
  const heart = roundpoly(cells.map(([x, y]) => g(x, y)), 0.25);
  add('pixel-art', ['pixel art', 'arte en píxeles', 'retro', 'sprite', '8 bits', 'pixel heart', 'pixel brush'], [heart]);
  FILL['pixel-art'] = { solid: [0] };
}
// Stencil: nucleo's document with a star cut out of it; two bridges of the sheet cross the star
// level with its arms, breaking the lower edge of each side arm, so it reads as one bar across.
// (Bridges in two valleys broke its silhouette into a scribble.)
{
  const doc = N.document.d[0];
  const pts = starPts(12, 12.6, 5.6, 2.45);
  const star = roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.3 : 0.45)));
  const gaps = [lerp(pts[2], pts[3], 0.5), lerp(pts[7], pts[8], 0.5)];
  const cut = clip(star, (p) => gaps.every((g) => Math.hypot(p[0] - g[0], p[1] - g[1]) > 1.8), 2);
  add('stencil', ['plantilla', 'esténcil', 'estarcido', 'molde', 'stencil', 'template', 'stenciling'], [doc, cut]);
  FILL.stencil = { solid: [0], cut: [1] };
  PARTS.stencil = { sheet: [0], cutout: [1] };
}

// Mosaic: a rounded square laid with five irregular tiles, an even 1.5 of grout between them
{
  // The tiles share their edges; each one is pulled in 1.5 from every shared edge (half the
  // grout's 3, center to center) and keeps the square's own edges and corners
  const lo = 4;
  const hi = 20;
  // the joint across the square, slightly slanted
  const A = (x) => 10.25 + ((x - lo) / (hi - lo)) * 3;
  const tiles = [
    [[lo, lo], [11, lo], [12.75, A(12.75)], [lo, A(lo)]],
    [[11, lo], [hi, lo], [hi, A(hi)], [12.75, A(12.75)]],
    [[lo, A(lo)], [10.25, A(10.25)], [7.75, hi], [lo, hi]],
    [[10.25, A(10.25)], [14.25, A(14.25)], [16.25, hi], [7.75, hi]],
    [[14.25, A(14.25)], [hi, A(hi)], [hi, hi], [16.25, hi]],
  ];
  const onEdge = (a, b) => (a[0] === b[0] && (a[0] === lo || a[0] === hi)) || (a[1] === b[1] && (a[1] === lo || a[1] === hi));
  const corner = (p) => (p[0] === lo || p[0] === hi) && (p[1] === lo || p[1] === hi);
  const inset = (poly) => {
    const n = poly.length;
    // each edge as a point and a direction, moved in along its inward normal (the tiles run clockwise)
    const lines = poly.map((a, i) => {
      const b = poly[(i + 1) % n];
      const d = unit(sub2(b, a));
      const o = onEdge(a, b) ? 0 : 1.5;
      return { p: add2(a, mul([-d[1], d[0]], o)), d };
    });
    return lines.map((L, i) => {
      const M = lines[(i - 1 + n) % n];
      const den = M.d[0] * L.d[1] - M.d[1] * L.d[0];
      const t = ((L.p[0] - M.p[0]) * L.d[1] - (L.p[1] - M.p[1]) * L.d[0]) / den;
      return add2(M.p, mul(M.d, t));
    });
  };
  const d = tiles.map((poly) => roundpoly(inset(poly), poly.map((p) => (corner(p) ? 3 : 0.5))));
  add('mosaic', ['mosaico', 'teselas', 'azulejos', 'filtro mosaico', 'mosaic', 'tiles', 'tessellation'], d);
  FILL.mosaic = { solid: [0, 1, 2, 3, 4] };
  icons.mosaic.variants = { square: false };
}
// Calligraphy: a dip pen on its long holder, its nib finishing a ribbon swash (thin at both ends,
// wide in the middle), drawn as the swash's outline
{
  const at = frame([14.25, 16.75], -63);
  const nib = roundpoly([at(0, 0), at(3, -1.6), at(5, -1.4), at(5, 1.4), at(3, 1.6)], [0.2, 0.6, 0, 0, 0.6]);
  const R = halfChord(at(14, -1.4), at(14, 1.4));
  const holder = `M${P(at(5, -1.4))}L${P(at(14, -1.4))}A${R} ${R} 0 0 1 ${P(at(14, 1.4))}L${P(at(5, 1.4))}`;
  // The swash: a centerline wave from the left to the nib's tip, its half-width a sine
  const L = [3, 18.75];
  const T = at(0, 0);
  const mid = (t) => {
    const u = 1 - t;
    const c1 = [6.25, 12.5];
    const c2 = [10.5, 21.5];
    return [0, 1].map((k) => u * u * u * L[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * T[k]);
  };
  const nrm = (t) => {
    const a = mid(Math.max(0, t - 0.001));
    const b = mid(Math.min(1, t + 0.001));
    const d = unit(sub2(b, a));
    return [-d[1], d[0]];
  };
  const ts = Array.from({ length: 11 }, (_, i) => i / 10);
  const w = (t) => 1.9 * Math.sin(Math.PI * t) ** 0.8;
  const upper = ts.map((t) => add2(mid(t), mul(nrm(t), -w(t))));
  const lower = ts.map((t) => add2(mid(t), mul(nrm(t), w(t)))).reverse();
  const swash = `${smooth(upper)}${smooth(lower).replace(/^M[^C]*/, '')}Z`;
  add('calligraphy', ['caligrafía', 'lettering', 'plumilla', 'entintado', 'calligraphy', 'hand lettering', 'dip pen'], [swash, nib, holder]);
  FILL.calligraphy = { solid: [0, 1, Z(holder)] };
  PARTS.calligraphy = { swash: [0], pen: [1, 2] };
  MOTION.calligraphy = { effect: 'wiggle', parts: ['pen'], origin: T };
  icons.calligraphy.mirror = true;
}
// Ink bottle: a short bottle, its body as tall as it is wide below sloping shoulders, a wide neck
// with its lip, the ink inside to a level, and one drop falling above it, off to the side (lugares'
// droplet; centered over the neck it read as a candle's flame). Squat and wide, it read as a pot.
{
  const bottle = roundpoly([[9, 10.75], [9, 7.75], [15, 7.75], [15, 10.75], [18.75, 13.25], [18.75, 21.25], [5.25, 21.25], [5.25, 13.25]], [0, 0.75, 0.75, 0.75, 2, 0, 3, 2]);
  const lip = hl(10.75, 9, 15);
  const level = hl(16, 5.25, 18.75);
  const drop = xf('M17.13 8.37A7.25 7.25 0 1 1 6.87 8.37L12 3.25Z', { s: 0.27, o: [12, 13.5], to: [19, 4.75] });
  add('ink-bottle', ['tintero', 'tinta', 'entintado', 'recarga de tinta', 'ink bottle', 'ink', 'inking'], [bottle, lip, level, drop]);
  FILL['ink-bottle'] = { solid: [0, 3], cut: [1, 2] };
  PARTS['ink-bottle'] = { bottle: [0, 1, 2], drop: [3] };
  MOTION['ink-bottle'] = { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] };
}

// ── Sculpture and pottery ───────────────────────────────────────────────────────────────────────
// Bust: the head, neck and shoulders in one piece of stone, the shoulders sloping down from the
// neck to a point, the chest cut off underneath in an arch that rises in to a short stem, on a
// square plinth. (Level shoulders over a rounded cut read as a rubber stamp or a chess pawn.)
{
  const hy = 6;
  const hr = 3.5;
  const nw = 2;
  const ny = hy + Math.sqrt(hr * hr - nw * nw);
  const right = `M13.75 18.5V17C14.75 15.9 17 15.5 19.4 15.75C19.6 15.75 19.75 15.5 19.7 15.25C19.1 12.75 16.9 11.4 ${f(12 + nw)} 11.1V${f(ny)}`;
  const bust = `${right}A${f(hr)} ${f(hr)} 0 1 0 ${f(12 - nw)} ${f(ny)}V11.1C7.1 11.4 4.9 12.75 4.3 15.25C4.25 15.5 4.4 15.75 4.6 15.75C7 15.5 9.25 15.9 10.25 17V18.5`;
  const plinth = sq(8.25, 18.5, 7.5, 2.75, 0.9);
  add('bust', ['busto', 'escultura', 'arte clásico', 'museo', 'bust', 'sculpture', 'statue'], [bust, plinth]);
  FILL.bust = { solid: [Z(bust), 1] };
  PARTS.bust = { bust: [0], plinth: [1] };
}
// Pottery wheel: the wheel head as an ellipse on its short column and base, a pot rising from its
// center with two throwing lines around it; the wheel's far edge passes behind the pot
{
  const pot = roundpoly([[8.75, 14.25], [7.75, 10.75], [9.25, 7], [8.5, 4.5], [15.5, 4.5], [14.75, 7], [16.25, 10.75], [15.25, 14.25]], [0.75, 3.5, 2, 0.6, 0.6, 2, 3.5, 0.75]);
  const wheel = behind(ell(12, 14.25, 8.5, 3.25), [pot]);
  const ring = (y, sag) => {
    const xs = [...samples(pot)[0]].filter((p) => Math.abs(p[1] - y) < 0.06).map((p) => p[0]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    return `M${f(x0)} ${f(y)}Q12 ${f(y + sag)} ${f(x1)} ${f(y)}`;
  };
  add('pottery-wheel', ['torno de alfarero', 'cerámica', 'alfarería', 'clases de cerámica', 'pottery wheel', 'ceramics', 'throwing'], [
    wheel,
    pot,
    ring(8.5, 1.25),
    ring(11.25, 1.5),
    hl(21.25, 6.75, 17.25),
    vl(12, 17.5, 21.25),
  ]);
  FILL['pottery-wheel'] = { solid: [ell(12, 14.25, 8.5, 3.25), 1], cut: [2, 3], wire: [4, 5] };
  PARTS['pottery-wheel'] = { wheel: [0, 4, 5], pot: [1, 2, 3] };
  MOTION['pottery-wheel'] = { effect: 'wiggle', origin: [12, 21.25] };
}
// Vase: a flared lip, a narrow neck and a full round body on a small foot, no handles
{
  const right = 'C14.25 4 13.6 5 13.6 6.5C13.6 8.75 18.75 9.5 18.75 14C18.75 17.25 15.5 19 14.25 19.6L15.25 21.25';
  const vase = `M8.75 3.25H15.25${right}H8.75${flipPath(`M15.25 21.25L14.25 19.6C15.5 19 18.75 17.25 18.75 14C18.75 9.5 13.6 8.75 13.6 6.5C13.6 5 14.25 4 15.25 3.25`).replace(/^M[^LC]*/, '')}Z`;
  add('vase', ['jarrón', 'florero', 'cerámica', 'decoración', 'vase', 'pottery', 'ceramics'], [vase]);
  FILL.vase = { solid: [0] };
}
// Amphora: a lip over a narrow neck, two loop handles from under the lip down to the broad
// shoulders, and a body tapering to a small foot
{
  const body = 'M9.5 3.25H14.5V4.75H13.5V8.75C17 9.25 17.75 11 17.75 12.5C17.75 15.25 14.75 17.5 13.25 19.25L14 21.25H10L10.75 19.25C9.25 17.5 6.25 15.25 6.25 12.5C6.25 11 7 9.25 10.5 8.75V4.75H9.5Z';
  const handle = rline([[13.5, 5.75], [17.75, 5.75], [17.75, 10.6]], [0, 1.75, 0]);
  add('amphora', ['ánfora', 'antigüedades', 'arqueología', 'museo', 'amphora', 'antiquity', 'ancient art'], [body, handle, flipPath(handle)]);
  FILL.amphora = { solid: [0], wire: [1, 2] };
  PARTS.amphora = { body: [0], handles: [1, 2] };
}

// ── Fiber crafts ────────────────────────────────────────────────────────────────────────────────
// The yarn family's ball: a circle wrapped with three strands, arcs around a center beyond its top
// right, each one ending on the ball's outline
function yarnBall(c, r) {
  const k = 1.55 * r;
  const Q = add2(c, [k, -k]);
  const D = Math.hypot(k, k);
  const strands = [-0.55, 0, 0.55].map((o) => {
    const rho = D + o * r;
    // where the strand's circle crosses the ball's
    const a = (rho * rho - r * r + D * D) / (2 * D);
    const h = Math.sqrt(rho * rho - a * a);
    const u = unit(sub2(c, Q));
    const m = add2(Q, mul(u, a));
    const p1 = add2(m, mul([-u[1], u[0]], h));
    const p2 = add2(m, mul([u[1], -u[0]], h));
    const ang = (p) => (Math.atan2(p[1] - Q[1], p[0] - Q[0]) * 180) / Math.PI;
    let [a1, a2] = [ang(p1), ang(p2)];
    if (a2 < a1) [a1, a2] = [a2, a1];
    if (a2 - a1 > 180) [a1, a2] = [a2, a1 + 360];
    return arc(...Q, rho, a1, a2).d;
  });
  return [circ(...c, r), ...strands];
}
// Yarn: the ball and its loose end trailing out at the bottom
{
  const c = [11, 10.75];
  const r = 7.75;
  const start = polar(...c, r, 62);
  const tail = smooth([start, [15.75, 20.25], [18.75, 20.75], [21, 18.75]]);
  add('yarn', ['estambre', 'lana', 'ovillo', 'tejido', 'yarn', 'wool', 'yarn ball'], [...yarnBall(c, r), tail]);
  FILL.yarn = { solid: [0], cut: [1, 2, 3], wire: [4] };
  PARTS.yarn = { ball: [0, 1, 2, 3], end: [4] };
}
// Yarn knitting: the ball with two straight knitting needles crossed through it, their knobs at the top
{
  const c = [12, 13.25];
  const r = 6.25;
  const ball = yarnBall(c, r);
  const needle = (knob, tip) => behind(line(knob, tip), [ball[0]]);
  const a = needle([4.5, 3.75], [19.75, 21.75]);
  const b = needle([19.5, 3.75], [4.25, 21.75]);
  add('yarn-knitting', ['tejer', 'tejido de punto', 'agujas de tejer', 'patrones de tejido', 'knitting', 'knitting needles', 'knit'], [...ball, a, b, dot(4.5, 3.75), dot(19.5, 3.75)]);
  FILL['yarn-knitting'] = { solid: [0, 6, 7], cut: [1, 2, 3], wire: [4, 5] };
  PARTS['yarn-knitting'] = { ball: [0, 1, 2, 3], needles: [4, 5, 6, 7] };
}
// Yarn crochet: the ball with one crochet hook through it, its handle out at the top right and its
// hooked tip out at the bottom left
{
  const c = [12.75, 12.75];
  const r = 5.5;
  const ball = yarnBall(c, r);
  const u = unit([-8.5, 10.25]);
  const at = (t) => add2(c, mul(u, t));
  const handle = capsule(at(-9.75), at(-12.5), 1.25);
  const tip = at(11);
  const n = [-u[1], u[0]];
  const hook = `${behind(line(c, tip), [ball[0]])}A1.1 1.1 0 0 1 ${P(add2(tip, mul(n, 2.2)))}`;
  add('yarn-crochet', ['ganchillo', 'crochet', 'tejer', 'patrones de crochet', 'crochet', 'crochet hook', 'amigurumi'], [...ball, handle, hook]);
  FILL['yarn-crochet'] = { solid: [0, 4], cut: [1, 2, 3], wire: [5] };
  PARTS['yarn-crochet'] = { ball: [0, 1, 2, 3], hook: [4, 5] };
}
// Spinning wheel: in profile, the great wheel (its spokes) on its upright at the low end of a slanted
// table on legs, and the bobbin on its post at the high end. (A bar touching the wheel there read as
// part of a table.)
const SPIN = [15.25, 8.5];
{
  const wr = 5.5;
  const tableY = (x) => 14.5 + ((x - 2.75) * 4) / 18.5;
  const spokes = [0, 60, 120].map((a) => line(polar(...SPIN, wr, a), polar(...SPIN, wr, a + 180))).join('');
  add('spinning-wheel', ['rueca', 'hilar', 'hilado a mano', 'fibras', 'spinning wheel', 'spinning', 'handspun yarn'], [
    circ(...SPIN, wr),
    spokes,
    line([2.75, tableY(2.75)], [21.25, tableY(21.25)]),
    vl(SPIN[0], SPIN[1] + wr, tableY(SPIN[0])),
    line([5, tableY(5)], [4, 21.25]),
    line([18.5, tableY(18.5)], [19.5, 21.25]),
    capsule([3.6, 9.25], [5.15, 9.25], 1.25),
    vl(4.375, 10.5, tableY(4.375)),
  ]);
  FILL['spinning-wheel'] = { solid: [0, 6], cut: [1], wire: [2, 3, 4, 5, 7] };
  PARTS['spinning-wheel'] = { wheel: [0, 1], frame: [2, 3, 4, 5, 6, 7] };
  MOTION['spinning-wheel'] = { effect: 'spin', parts: ['wheel'], origin: SPIN };
}

// ── Paper crafts ────────────────────────────────────────────────────────────────────────────────
// Origami crane: flat triangular facets in profile (the neck rising to the bent head, the wing
// pointing up, the tail), the body's top fold across them and the wing's crease
{
  const pts = [[2.75, 8.75], [4.25, 5.25], [9.5, 13.5], [14.25, 3], [15.75, 13.5], [21.25, 6.75], [17.25, 13.5], [11.75, 18], [6.25, 13.5], [4.85, 7.6]];
  const crane = roundpoly(pts, [0.35, 0.4, 0.3, 0.4, 0.3, 0.4, 0.4, 0.6, 0.4, 0.3]);
  add('origami', ['origami', 'grulla de papel', 'papiroflexia', 'manualidades de papel', 'origami crane', 'paper folding', 'paper crane'], [crane, hl(13.5, 6.25, 17.25), line([14.25, 3], [12.25, 13.5])]);
  FILL.origami = { solid: [0], cut: [1, line(lerp([14.25, 3], [12.25, 13.5], 0.2), [12.25, 13.5])] };
}
// Paper boat: the tall triangular sail in the middle of the trapezoid hull, the hull's top fold and
// the sail's center fold
{
  const boat = roundpoly([[2.75, 13.5], [7.25, 13.5], [12, 3.25], [16.75, 13.5], [21.25, 13.5], [17.25, 19.75], [6.75, 19.75]], [0.6, 0, 0.6, 0, 0.6, 1, 1]);
  add('paper-boat', ['barco de papel', 'barquito', 'papiroflexia', 'manualidades', 'paper boat', 'origami boat', 'paper craft'], [boat, hl(13.5, 7.25, 16.75), vl(12, 3.25, 13.5)]);
  FILL['paper-boat'] = { solid: [0], cut: [1, vl(12, 5.5, 13.5)] };
  PARTS['paper-boat'] = { boat: [0], folds: [1, 2] };
  MOTION['paper-boat'] = { effect: 'float', vector: [0, -1.5] };
}
// Scissors cut line: edicion's scissors (its rings and blades), smaller and turned to cut toward the
// right, at the start of a dashed line that curves away from the blades. At this size the blades
// simply cross, as ciencia's gene-editing draws them (a knockout would leave pieces under 2)
{
  const [eyeL, eyeR, bladeA, b1, b2] = E.scissors.d;
  const place = (d) => xf(d, { s: 0.62, deg: 90, o: [12, 12], to: [7.5, 8.75] });
  const startB = b1.match(/^M([\d.]+) ([\d.]+)/).slice(1).map(Number);
  const endB = b2.match(/L([\d.]+) ([\d.]+)$/).slice(1).map(Number);
  const A = place(bladeA);
  const B = place(line(startB, endB));
  const cut = dashes('M14.75 8.75C18.5 8.75 19.75 11.5 19.75 14.5V21', 2.5, 3);
  add('scissors-cut-line', ['cortar aquí', 'línea de corte', 'recortable', 'cupón', 'cut here', 'cut line', 'cutout'], [place(eyeL), place(eyeR), A, B, ...cut]);
  FILL['scissors-cut-line'] = { solid: [0, 1], wire: [2, 3], lines: cut.map((_, i) => i + 4) };
  PARTS['scissors-cut-line'] = { scissors: [0, 1, 2, 3], line: cut.map((_, i) => i + 4) };
  MOTION['scissors-cut-line'] = { effect: 'slide', parts: ['scissors'], vector: [1.5, 0] };
  icons['scissors-cut-line'].mirror = true;
}
// Glue stick: the twist base, wider than the tube standing on it, the glue rising from the tube with
// a round top, and the cap set aside. (A tube with only a half circle on top read as a padlock.)
{
  const base = box(4, 17.5, 9, 3.75, 1.5);
  const tube = rline([[5.25, 17.5], [5.25, 11.5], [11.75, 11.5], [11.75, 17.5]]);
  const glue = 'M6.25 11.5V7.5C6.25 5.75 10.75 5.75 10.75 7.5V11.5';
  const cap = box(16, 11.5, 4.75, 9.75, 1.75);
  add('glue-stick', ['barra adhesiva', 'pegamento en barra', 'útiles escolares', 'collage', 'glue stick', 'glue', 'school supplies'], [base, tube, glue, cap, hl(14.5, 16, 20.75)]);
  FILL['glue-stick'] = { solid: [0, Z(tube), Z(glue), 3], cut: [4] };
  PARTS['glue-stick'] = { tube: [0, 1], glue: [2], cap: [3, 4] };
}
// Washi tape: the roll (herramientas' duct tape's, a ring around a wide core) and a strip pulled
// out from under it, its pattern a dash along it, its end torn in a zigzag. (With a small hub,
// the roll read as a rotary cutter.)
{
  const c = [7.25, 10.25];
  const R = 5.25;
  const ang = (15 * Math.PI) / 180;
  const d = [Math.cos(ang), Math.sin(ang)];
  const nOut = [-d[1], d[0]];
  const w = 5.75;
  const len = 14;
  // the strip's lower edge leaves the roll tangentially at T; at(u, v) is u along it and v across
  const T = add2(c, mul(nOut, R));
  const at = (u, v) => add2(add2(T, mul(d, u)), mul(nOut, -v));
  // its upper edge starts where it leaves the roll
  const T2 = at(0, w);
  const proj = (T2[0] - c[0]) * d[0] + (T2[1] - c[1]) * d[1];
  const perp2 = (T2[0] - c[0]) ** 2 + (T2[1] - c[1]) ** 2 - proj * proj;
  const top0 = add2(T2, mul(d, -proj + Math.sqrt(R * R - perp2)));
  const torn = [at(len + 0.5, w), at(len - 1, w * 0.7), at(len + 0.75, w * 0.45), at(len - 0.75, w * 0.2), at(len, 0)];
  const strip = rline([top0, ...torn, T], [0, 0.3, 0.3, 0.3, 0.3, 0.3, 0]);
  // the pattern along the strip's middle: a dash 3 clear of the roll (3.3 along the strip, as the
  // roll curves toward it) and of the torn end
  const mid = at(0, w / 2);
  const pm = sub2(mid, c);
  const pj = pm[0] * d[0] + pm[1] * d[1];
  const out = -pj + Math.sqrt(R * R - (pm[0] ** 2 + pm[1] ** 2 - pj * pj));
  const pattern = [line(at(out + 3.3, w / 2), at(len - 4, w / 2))];
  add('washi-tape', ['cinta washi', 'cinta decorativa', 'scrapbooking', 'bullet journal', 'washi tape', 'decorative tape', 'journaling'], [circ(...c, R), circ(...c, 2.25), strip, ...pattern]);
  FILL['washi-tape'] = { solid: [0, Z(strip)], cut: [1, ...pattern.map((_, i) => i + 3)] };
  PARTS['washi-tape'] = { roll: [0, 1], strip: [2, ...pattern.map((_, i) => i + 3)] };
}
// Craft knife: a slim pen-like handle, the ridged collar, and the small angled blade at its tip
{
  const at = frame([4.5, 19.75], -45);
  const blade = roundpoly([at(0, -2), at(6.25, -2), at(6.25, 2)], 0);
  const collar = roundpoly([at(6.25, -2), at(15.25, -2), at(15.25, 2), at(6.25, 2)], [0, 0.6, 0.6, 0]);
  const R = halfChord(at(20.75, -1.4), at(20.75, 1.4));
  const handle = `M${P(at(15.25, -1.4))}L${P(at(20.75, -1.4))}A${R} ${R} 0 0 1 ${P(at(20.75, 1.4))}L${P(at(15.25, 1.4))}`;
  add('craft-knife', ['cúter de precisión', 'bisturí', 'maquetas', 'corte preciso', 'craft knife', 'precision knife', 'hobby knife'], [blade, collar, line(at(9.25, -2), at(9.25, 2)), line(at(12.25, -2), at(12.25, 2)), handle]);
  FILL['craft-knife'] = { solid: [0, 1, Z(handle)], cut: [2, 3] };
  PARTS['craft-knife'] = { blade: [0], collar: [1, 2, 3], handle: [4] };
  MOTION['craft-knife'] = { effect: 'wiggle', origin: at(0, -1.1) };
  icons['craft-knife'].mirror = true;
}
// Cut paper banner (papel picado): a string sagging between two points, two paper flags hanging
// from it, each with a scalloped bottom and two holes cut out
{
  const y = (x) => {
    const t = (x - 2.75) / 18.5;
    return 3.75 + 11 * t * (1 - t);
  };
  const bottom = 15.25;
  const flag = (x0, x1) => {
    const r = (x1 - x0) / 6;
    const sc = [1, 2, 3].map((k) => `A${f(r)} ${f(r)} 0 0 0 ${f(x0 + 2 * r * k)} ${f(bottom)}`).join('');
    return `M${f(x0)} ${f(y(x0))}V${f(bottom)}${sc}V${f(y(x1))}`;
  };
  const flags = [flag(4, 10.5), flag(13.5, 20)];
  const holes = [7.25, 16.75].flatMap((x) => [dot(x, 8.75, 0.5), dot(x, 12.25, 0.5)]);
  add('cut-paper-banner', ['papel picado', 'banderines', 'fiesta', 'decoración festiva', 'papel picado', 'bunting', 'festive banner'], ['M2.75 3.75Q12 9.25 21.25 3.75', ...flags, ...holes]);
  FILL['cut-paper-banner'] = { solid: flags.map(Z), wire: [0], cut: [3, 4, 5, 6] };
  PARTS['cut-paper-banner'] = { string: [0], flags: [1, 2, 3, 4, 5, 6] };
  MOTION['cut-paper-banner'] = { effect: 'ring', origin: [12, 8.25] };
}
// Beads: three beads strung on a thread that curls loose at one end, and a fourth bead beside them
// showing its hole
{
  const beads = [[5.75, 6.75], [10.5, 11.5], [15.25, 16.25]];
  const r = 2.25;
  const thread = smooth([[2.75, 3.25], ...beads, [19, 19.75], [21.25, 18.25], [20.5, 15.75]]);
  const shown = clip(thread, (p) => beads.every((b) => Math.hypot(p[0] - b[0], p[1] - b[1]) > r), 2);
  const loose = [17.25, 6.75];
  add('beads', ['cuentas', 'abalorios', 'bisutería', 'hacer pulseras', 'beads', 'beading', 'jewelry making'], [...beads.map((b) => circ(...b, r)), shown, circ(...loose, 3), dot(...loose, 0.4)]);
  FILL.beads = { solid: [0, 1, 2, 4], wire: [3], cut: [5] };
  PARTS.beads = { strung: [0, 1, 2, 3], bead: [4, 5] };
}

// ── Galleries ───────────────────────────────────────────────────────────────────────────────────
// The frames share hogar's wall-art border: the frame with the signature corner and, where it fits,
// its mat 3 inside it
const FRAME = (x, y, w, h, mat = true) => [sq(x, y, w, h, 1.5, BR), ...(mat && w >= 9 && h >= 9 ? [sq(x + 3, y + 3, w - 6, h - 6, 0.75, BR)] : [])];
// Exhibition: a framed work on the wall above a museum's rope barrier, two stanchions with their
// ball tops and feet and the rope sagging between them. (Lit by a spotlight from the corner, it read
// as a stapler or a till.)
{
  const frame = FRAME(6, 3.25, 12, 9);
  const post = (x) => `M${f(x - 1.5)} 21.25H${f(x + 1.5)}M${f(x)} 21.25V15.25`;
  add('exhibition', ['exposición', 'muestra', 'obra destacada', 'en exhibición', 'exhibition', 'art show', 'featured artwork'], [
    ...frame,
    post(3.75),
    post(20.25),
    dot(3.75, 15.25),
    dot(20.25, 15.25),
    'M3.75 16.25C7.5 19.25 16.5 19.25 20.25 16.25',
  ]);
  FILL.exhibition = { solid: [0, 4, 5], cut: [1], wire: [2, 3, 6] };
  PARTS.exhibition = { frame: [0, 1], barrier: [2, 3, 4, 5, 6] };
}
// Gallery wall: three bare frames hung together from a picture rail, a large one and two small ones
// beside it, each at its own height (mats crowded the wall past the ink limit; lined up with each
// other, bare frames read as a layout's panels)
{
  const large = FRAME(3.25, 7.25, 9.5, 12.25, false);
  const small = [...FRAME(15.75, 6, 5, 6), ...FRAME(15.75, 15, 5, 5.75)];
  add('gallery-wall', ['galería', 'colección de arte', 'portafolio', 'cuadros', 'gallery wall', 'art collection', 'portfolio'], [hl(2.75, 3.25, 20.75), vl(8, 2.75, 7.25), vl(18.25, 2.75, 6), ...large, ...small]);
  FILL['gallery-wall'] = { solid: [3, 4, 5], wire: [0, 1, 2] };
  PARTS['gallery-wall'] = { rail: [0, 1, 2], frames: [3, 4, 5] };
  icons['gallery-wall'].variants = { square: false };
}
// Ornate frame: a wide border notched in at each corner with a flourish, the empty center notched to
// match
{
  const notched = (x0, y0, x1, y1, r) =>
    `M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 0 ${f(x1 - r)} ${f(y1)}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 0 ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 0 ${f(x0 + r)} ${f(y0)}Z`;
  add('ornate-frame', ['marco ornamental', 'marco clásico', 'bellas artes', 'enmarcar', 'ornate frame', 'classic frame', 'fine art'], [notched(3.25, 3.25, 20.75, 20.75, 3), notched(7.75, 7.75, 16.25, 16.25, 1.5)]);
  // filled, the border is solid around the open center (the inner outline run the other way round)
  const back = (x0, y0, x1, y1, r) =>
    `M${f(x0 + r)} ${f(y0)}A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y0 + r)}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y1)}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y1 - r)}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y0)}Z`;
  FILL['ornate-frame'] = { solid: [`${notched(3.25, 3.25, 20.75, 20.75, 3)}${back(7.75, 7.75, 16.25, 16.25, 1.5)}`], wire: [1] };
  icons['ornate-frame'].variants = { square: false };
}

// ── People and studios ─────────────────────────────────────────────────────────────────────────
// Artist: nucleo's person at 85 % as personas wears its hats (the head lower, its arc ending on the
// hat's lower edge), a beret tilted on the head with its little stalk on top
{
  const s = 0.85;
  const up = 1.95 * (1 - s);
  const place = (d, dy) => transform(d, s, 12 - 12 * s, 20.6 - 20.6 * s + dy);
  const body = place(N.person.d[1], 0);
  const hc = [12, 20.6 + (7.45 - 20.6) * s - up];
  const hr = 3.7 * s;
  const yb = 7.5;
  const a = (Math.asin((yb - hc[1]) / hr) * 180) / Math.PI;
  const head = arc(...hc, hr, a, 180 - a).d;
  const x0 = hc[0] - hr * Math.cos((a * Math.PI) / 180);
  const x1 = hc[0] + hr * Math.cos((a * Math.PI) / 180);
  const beret = `M${f(x0 - 1)} ${f(yb)}C${f(x0 - 1.75)} ${f(yb - 3)} ${f(x1 + 1)} ${f(yb - 4.75)} ${f(x1 + 3.25)} ${f(yb - 1.75)}C${f(x1 + 3.6)} ${f(yb - 0.75)} ${f(x1 + 2.5)} ${f(yb)} ${f(x1 + 1.25)} ${f(yb)}Z`;
  const crown = samples(beret)[0].reduce((m, q) => (Math.abs(q[0] - 11.75) < Math.abs(m[0] - 11.75) && q[1] < 6 ? q : m), [0, 99]);
  add('artist', ['artista', 'pintor', 'creador', 'perfil de artista', 'artist', 'creator', 'painter'], [head, body, beret, line(crown, [crown[0] - 0.4, crown[1] - 2.1])]);
  FILL.artist = { solid: [Z(head), 1, 2], wire: [3] };
  PARTS.artist = { head: [0], body: [1], hat: [2, 3] };
}
// Tattoo machine: a pen-style rotary machine on the diagonal, its needle at the tip, the ridged grip,
// the slim body and the cord curling from its back
{
  const at = frame([4.5, 19.5], -45);
  const grip = roundpoly([at(2.25, -0.75), at(4, -2), at(9.25, -2), at(9.25, 2), at(4, 2), at(2.25, 0.75)], [0.3, 0.6, 0, 0, 0.6, 0.3]);
  const R = halfChord(at(15, -2.5), at(15, 2.5));
  const body = `M${P(at(9.25, -2.5))}L${P(at(15, -2.5))}A${R} ${R} 0 0 1 ${P(at(15, 2.5))}L${P(at(9.25, 2.5))}Z`;
  const back = at(17.5, 0);
  const cord = smooth([back, add2(back, [2, 0.5]), [20.5, 10.75], [19.25, 14], [21, 16.75]]);
  add('tattoo-machine', ['máquina de tatuar', 'tatuaje', 'estudio de tatuajes', 'tatuador', 'tattoo machine', 'tattoo', 'tattoo artist'], [
    line(at(0, 0), at(2.25, 0)),
    grip,
    line(at(5.5, -2), at(5.5, 2)),
    body,
    line(at(12.25, -2.5), at(12.25, 2.5)),
    cord,
  ]);
  FILL['tattoo-machine'] = { solid: [1, 3], cut: [2, 4], wire: [0, 5] };
  PARTS['tattoo-machine'] = { needle: [0], machine: [1, 2, 3, 4], cord: [5] };
  MOTION['tattoo-machine'] = { effect: 'wiggle', origin: at(0, 0) };
  icons['tattoo-machine'].mirror = true;
}
// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// Where the engine's snap left a smudge, the icon keeps fewer pieces at 16 px, snapped to the pixel
// grid as the engine snaps any drawing: the yarn ball keeps two strands (one when a tool crosses it),
// the mosaic four tiles, the pottery wheel one throwing line, the spinning wheel its hub without the
// spokes, the washi tape its roll and strip without the pattern; the pixel heart is redrawn on the
// pixel grid itself.
{
  /** A 16 px drawing from some of the icon's own strokes (indices into d, or paths), snapped. */
  const small = (name, keep, fill) => {
    const icon = icons[name];
    const get = (i) => (typeof i === 'number' ? icon.d[i] : i);
    const d = keep.map(get);
    const sn = snapper([...d, ...Object.values(fill || {}).flat().map(get)]);
    icon.small = { d: d.map(sn) };
    if (fill) icon.small.fill = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map((i) => sn(get(i)))]));
  };
  small('yarn', [0, 1, 3, 4], { solid: [0], cut: [1, 3], wire: [4] });
  small('yarn-knitting', [0, 2, 4, 5, 6, 7], { solid: [0, 6, 7], cut: [2], wire: [4, 5] });
  small('yarn-crochet', [0, 2, 4, 5], { solid: [0, 4], cut: [2], wire: [5] });
  small('pottery-wheel', [0, 1, 3, 4, 5], { solid: [ell(12, 14.25, 8.5, 3.25), 1], cut: [3], wire: [4, 5] });
  small('washi-tape', [0, 1, 2], { solid: [0, Z(icons['washi-tape'].d[2])], cut: [1] });
  small('spinning-wheel', [0, dot(...SPIN), 2, 3, 4, 5, 6, 7], { solid: [0, 6], cut: [dot(...SPIN)], wire: [2, 3, 4, 5, 7] });
  // The pixel heart on the 16 px grid: five pixels wide in cells of two (pixel centers at 0.75 + 1.5k)
  {
    const g = (x, y) => [5.25 + x * 3, 5.25 + y * 3];
    const cells = [[1, 0], [2, 0], [2, 1], [3, 1], [3, 0], [4, 0], [4, 1], [5, 1], [5, 3], [4, 3], [4, 4], [3, 4], [3, 5], [2, 5], [2, 4], [1, 4], [1, 3], [0, 3], [0, 1], [1, 1]];
    const heart = roundpoly(cells.map(([x, y]) => g(x, y)), 0.2);
    icons['pixel-art'].small = { d: [heart], fill: { solid: [heart] } };
  }
  // The mosaic in four tiles, a pixel of grout between them
  {
    const t = [sq(3.75, 3.75, 6, 6.75, 2.25, { square: ['tr', 'br', 'bl'] }), sq(12.75, 3.75, 7.5, 6.75, 2.25, { square: ['tl', 'br', 'bl'] }), sq(3.75, 13.5, 7.5, 6.75, 2.25, { square: ['tl', 'tr', 'br'] }), sq(14.25, 13.5, 6, 6.75, 2.25, { square: ['tl', 'tr', 'bl'] })];
    icons.mosaic.small = { d: t, fill: { solid: t } };
  }
}

// ── Fill, parts, motion, variants ─────────────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;
// A piece on top (the coloring page's crayon) already fills the corner an enclosure or a slash would
// take
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };

export default { category: 'arte', label: 'Arte y manualidades', icons };
