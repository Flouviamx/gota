// Celebraciones (celebrations): birthdays, weddings and anniversaries, New Year, and the seasonal
// festivities without religious symbols (winter holidays, Halloween and the Day of the Dead, spring,
// harvest). Everything is computed with the engine (engine/geometry.mjs) on the rules in DESIGN.md.
//
// The set's own pieces are the bases, never redrawn: the cake and the party popper are
// comunicacion's (adopted), the heart is edicion's, the envelope comunicacion's sealed letter
// (nucleo's mail from the back), the pine lugares' tree-pine, the pumpkin frutas-verduras', the
// skull anatomia's, the egg comida's, the champagne bottle bebidas' and the ring's gem ropa's; the
// egg basket's bowl is the punch bowl's. One balloon serves every
// balloon, one bloom every flower, one headband the tiara and the flower crown, and comercio's gift
// bow every bow. A piece that passes behind another stops 3 center to center from it (behind(), as
// bebidas and rrhh draw it), and a piece on top clears what lies under it through the engine (a
// custom badge): nothing is trimmed by hand. The turkey, the reindeer, the bat and the cobweb are
// the animal categories' (aves-insectos, animales), drawn there with their holiday tags.
import { arc, circ, dot, f, flipPath, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import anatomia from './anatomia.mjs';
import bebidas from './bebidas.mjs';
import comida from './comida.mjs';
import comunicacion from './comunicacion.mjs';
import edicion from './edicion.mjs';
import frutasVerduras from './frutas-verduras.mjs';
import lugares from './lugares.mjs';
import ropa from './ropa.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Moves `d` by (dx, dy). */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);

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
    const u = [A[0] - V[0], A[1] - V[1]];
    const w = [B[0] - V[0], B[1] - V[1]];
    const [lu, lw] = [Math.hypot(...u), Math.hypot(...w)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (w[0] / lw) * t, V[1] + (w[1] / lw) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** Smooth open curve through points (Catmull-Rom as cubics); `closed` joins the last to the first. */
function smooth(pts, k = 1 / 6, closed = false) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    o += `C${P([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${P([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${P(p2)}`;
  }
  return closed ? `${o}Z` : o;
}
/** Ellipse with semi-axes rx, ry turned `tilt` degrees, as four cubics. */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const Q = (x, y) => {
    const [a, b] = rot([x, y], [0, 0], tilt);
    return [c[0] + a, c[1] + b];
  };
  return `M${P(Q(rx, 0))}C${P(Q(rx, k * ry))} ${P(Q(k * rx, ry))} ${P(Q(0, ry))}C${P(Q(-k * rx, ry))} ${P(Q(-rx, k * ry))} ${P(Q(-rx, 0))}C${P(Q(-rx, -k * ry))} ${P(Q(-k * rx, -ry))} ${P(Q(0, -ry))}C${P(Q(k * rx, -ry))} ${P(Q(rx, -k * ry))} ${P(Q(rx, 0))}Z`;
}
/** A stadium (capsule) of radius r around the segment a → b. */
function stadium(a, b, r) {
  const u = unit(sub2(b, a));
  const n = [-u[1], u[0]];
  const [p1, p2, p3, p4] = [add2(a, mul(n, r)), add2(b, mul(n, r)), add2(b, mul(n, -r)), add2(a, mul(n, -r))];
  const R = halfChord(p2, p3);
  return `M${P(p1)}L${P(p2)}A${R} ${R} 0 0 0 ${P(p3)}L${P(p4)}A${R} ${R} 0 0 0 ${P(p1)}Z`;
}

// ── Paths as segments (rrhh's, as bebidas): behind() keeps what shows of a stroke behind closed shapes ──
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
function pt(s, t) {
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
function sub(s, t0, t1) {
  if (s.t === 'L') return { t: 'L', a: pt(s, t0), b: pt(s, t1) };
  if (s.t === 'A') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}
const segLen = (s) => {
  let [n, a] = [0, pt(s, 0)];
  for (let k = 1; k <= 32; k++) {
    const b = pt(s, k / 32);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
};
function segD(s) {
  if (s.t === 'L') return `L${P(s.b)}`;
  if (s.t === 'C') return `C${P(s.p[1])} ${P(s.p[2])} ${P(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(sub(s, 0, 0.5)) + segD(sub(s, 0.5, 1));
  return `A${f(s.r)} ${f(s.r)} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${P(pt(s, 1))}`;
}
function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = pt(sp.segs[0], 0);
    o += `M${P(last)}`;
    for (const s of sp.segs) {
      if (!near(pt(s, 0), last)) o += `M${P(pt(s, 0))}`;
      o += segD(s);
      last = pt(s, 1);
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
      let prev = keep(pt(s, 0));
      let start = prev ? 0 : null;
      for (let k = 1; k <= N; k++) {
        const now = keep(pt(s, k / N));
        if (now === prev) continue;
        let [lo, hi] = [(k - 1) / N, k / N];
        for (let j = 0; j < 30; j++) {
          const m = (lo + hi) / 2;
          if (keep(pt(s, m)) === prev) lo = m;
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
      const segs = ch.map((pc) => sub(sp.segs[pc.i], pc.t0, pc.t1));
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
      return Array.from({ length: n + 1 }, (_, k) => pt(s, k / n));
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
 * The part of `d` that shows behind the closed shapes `fronts` (and the open strokes `lines`):
 * whatever lies inside a front or closer than `gap` (center to center) to any of them is dropped,
 * and so is any piece left shorter than `min`. 3 center to center is the set's knockout: 1.5 of
 * paper between the strokes. Each piece that shows comes back as a stroke of its own.
 */
function behind(d, fronts, gap = 3, min = 2, lines = []) {
  const rings = fronts.flatMap(samples);
  const pts = [...rings.flat(), ...lines.flatMap(samples).flat()];
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep, min)
    .split(/(?=M)/)
    .filter(Boolean);
}
/** Where the line through p0 along `dir` crosses the outline `d`: the parameters t, in order. */
function crossings(d, p0, dir) {
  const ts = [];
  for (const ring of samples(d))
    for (let i = 1; i < ring.length; i++) {
      const [a, b] = [ring[i - 1], ring[i]];
      const e = sub2(b, a);
      const den = dir[0] * e[1] - dir[1] * e[0];
      if (Math.abs(den) < 1e-12) continue;
      const w = sub2(a, p0);
      const t = (w[0] * e[1] - w[1] * e[0]) / den;
      const s = (w[0] * dir[1] - w[1] * dir[0]) / den;
      if (s >= 0 && s <= 1) ts.push(t);
    }
  return ts.sort((x, y) => x - y);
}
/** The chord of the outline `d` along the line through p0 with direction `dir`, edge to edge. */
function chord(d, p0, dir) {
  const ts = crossings(d, p0, dir);
  return line(add2(p0, mul(dir, ts[0])), add2(p0, mul(dir, ts.at(-1))));
}
/** The bounding box of a path: [x0, y0, x1, y1]. */
function bbox(d) {
  const pts = samples(d).flat();
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
// edicion's heart: two lobes and the point, scaled about its center
const HEART = edicion.icons.heart.d[0];
const HB = bbox(HEART);
const HC = [(HB[0] + HB[2]) / 2, (HB[1] + HB[3]) / 2];
/** The set's heart scaled by s, its box centered at c. */
const heartAt = (c, s) => place(HEART, s, HC, c);
/** The set's heart scaled by s, its point at `tip`. */
const heartTip = (tip, s) => place(HEART, s, [12, 20.5], tip);

// One balloon for every balloon: an upright oval, rounder at the top, narrowing to its tip
// (12, 15); the knot is a small solid triangle under the tip and the string falls in a gentle S
const BALLOON = 'M12 15C14.5 14 18 11.5 18 8.5C18 4.9 15.3 2.5 12 2.5C8.7 2.5 6 4.9 6 8.5C6 11.5 9.5 14 12 15Z';
/** The balloon scaled by s with its top at (cx, top); its tip falls at (cx, top + 12.5 s). */
const balloonAt = (cx, top, s) => place(BALLOON, s, [12, 2.5], [cx, top]);
/** The knot under a tip: 1.5 wide and 1.2 tall, ink at every weight (no hole opens in it). */
const knot = ([x, y]) => `M${P([x, y])}L${P([x + 0.75, y + 1.2])}L${P([x - 0.75, y + 1.2])}Z`;
/** The string from under a knot (x, y) down to y1, a gentle S. */
const string = ([x, y], y1 = 21.75) => {
  const h = (y1 - y) / 4;
  return smooth([[x, y], [x + 0.85, y + h], [x, y + 2 * h], [x - 0.85, y + 3 * h], [x, y1]]);
};

// The bloom: lugares' flower, five round petals on a circle of radius R (semicircles between
// points 72° apart), the top petal centered; a center as small as these doesn't fit
function bloom(c, R) {
  const A = [-126, -54, 18, 90, 162].map((a) => polar(c[0], c[1], R, a));
  let o = `M${P(A[0])}`;
  for (let i = 0; i < 5; i++) {
    const [a, b] = [A[i], A[(i + 1) % 5]];
    const r = halfChord(a, b);
    o += `A${r} ${r} 0 0 1 ${P(b)}`;
  }
  return `${o}Z`;
}
// comercio's gift bow: each loop a lens of two arcs of r 2.75 between the knot and its tip
/** A bow loop from the knot k to the tip t (a lens; s scales its arcs with its length). */
const loop = (k, t, r = 2.75) => `M${P(k)}A${f(r)} ${f(r)} 0 0 1 ${P(t)}A${f(r)} ${f(r)} 0 0 1 ${P(k)}Z`;

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs (by index of `d`, or a path), named parts, motion and 16 px drawings. */
const FILL = {};
const PARTS = {};
const MOTION = {};

// ── Birthdays and parties ─────────────────────────────────────────────────────────────────────
// The balloon: its shine an arc 3 inside the round top
{
  const shine = arc(12, 8.5, 3, 200, 250).d;
  const k = knot([12, 15]);
  add('balloon', ['globo', 'cumpleaños', 'celebrar', 'fiesta', 'balloon', 'birthday', 'celebrate'], [BALLOON, shine, k, string([12, 16.2])]);
  FILL.balloon = { solid: [0, 2], cut: [1], wire: [3] };
  PARTS.balloon = { balloon: [0, 1], knot: [2], string: [3] };
  MOTION.balloon = { effect: 'float', vector: [0, -1.5] };
}
// A bunch: three balloons at 0.5, the middle one higher, the side ones lower and leaning out 15°
// about their tips, each 2.85 clear of the others; the three strings gather at one point and run on
// as the balloon's wavy string (strings meeting at the bottom drew a V that read as the bouquet's
// wrapper)
{
  const s = 0.5;
  const at = [[[12, 8.5], 0], [[6.75, 14.25], -15], [[17.25, 14.25], 15]];
  const g = [12, 17.25];
  const balloons = at.map(([[x, y], deg]) => turnPath(balloonAt(x, y - 12.5 * s, s), deg, [x, y]));
  const knots = at.map(([t, deg]) => turnPath(knot(t), deg, t));
  const strings = [...at.map(([t, deg]) => line(rot(add2(t, [0, 1.2]), t, deg), g)), string(g, 21.75)];
  add('balloon-bunch', ['globos', 'ramo de globos', 'decoración', 'fiesta', 'balloons', 'balloon bunch', 'party decor'], [...balloons, ...knots, ...strings]);
  FILL['balloon-bunch'] = { solid: [0, 1, 2, 3, 4, 5], wire: [6, 7, 8, 9] };
  PARTS['balloon-bunch'] = { balloons: [0, 1, 2], knots: [3, 4, 5], strings: [6, 7, 8, 9] };
  MOTION['balloon-bunch'] = { effect: 'float', vector: [0, -1.5] };
}
// The heart balloon: the set's heart at 0.7, the knot at its point
{
  const tip = [12, 15];
  const h = heartTip(tip, 0.7);
  add('heart-balloon', ['globo de corazón', 'san valentín', 'aniversario', 'amor', 'heart balloon', 'valentine', 'love'], [h, knot(tip), string([12, 16.2])]);
  FILL['heart-balloon'] = { solid: [0, 1], wire: [2] };
  PARTS['heart-balloon'] = { balloon: [0], knot: [1], string: [2] };
  MOTION['heart-balloon'] = { effect: 'float', vector: [0, -1.5] };
}
// The balloon dog: sausages (body, neck, snout, tail, legs) twisted end to end, each round end
// just touching the next as a twist does; the ear sits behind the head, cut where it passes
{
  const toward = (c, dir, dist) => add2(c, mul(unit(dir), dist));
  const B = [[7.5, 13.5], [13.5, 13.5], 1.75];
  const body = stadium(...B);
  const n0 = toward(B[1], [0.45, -0.89], 2.95);
  const n1 = add2(n0, [0.7, -3.5]);
  const neck = stadium(n0, n1, 1.5);
  const s0 = toward(n1, [0.95, -0.3], 2.6);
  const snout = stadium(s0, add2(s0, [2.4, 0.6]), 1.4);
  // The ear: a bubble touching both the neck's end and the snout's, 0.1 into each (three bubbles
  // that meet leave no hole between them)
  const [Ra, Rb] = [1.5 + 1.5 - 0.1, 1.5 + 1.4 - 0.1];
  const dd = len(sub2(s0, n1));
  const a = (dd * dd + Ra * Ra - Rb * Rb) / (2 * dd);
  const uu = unit(sub2(s0, n1));
  const e = add2(add2(n1, mul(uu, a)), mul([uu[1], -uu[0]], Math.sqrt(Ra * Ra - a * a)));
  const ear = circ(...e, 1.5);
  const t0 = toward(B[0], [-0.7, -0.71], 2.8);
  const tail = stadium(t0, add2(t0, [-1.4, -2.75]), 1.35);
  const legs = [stadium([13.25, 16.3], [13.6, 19.75], 1.35), stadium([7.75, 16.3], [7.4, 19.75], 1.35)];
  add('balloon-dog', ['perro de globo', 'globoflexia', 'fiesta infantil', 'balloon dog', 'balloon animal', 'kids party'], [body, neck, snout, ear, tail, ...legs]);
  FILL['balloon-dog'] = { solid: [0, 1, 2, 3, 4, 5, 6] };
}
// The party hat: a tall cone (a triangle, its tip rounded) with a pom-pom sitting on the tip and
// two stripes rising to the right across it, edge to edge
{
  const [A, L, Rt] = [[12, 5.75], [5.75, 20.25], [18.25, 20.25]];
  const cone = roundpoly([A, Rt, L], [0.6, 1.25, 1.25]);
  const top = bbox(cone)[1];
  const pom = circ(12, top - 1.6, 1.75);
  const dir = unit([1, -0.42]);
  const stripes = [chord(cone, [12, 11.75], dir), chord(cone, [12, 16.25], dir)];
  add('party-hat', ['gorro de fiesta', 'cumpleaños', 'evento', 'cono', 'party hat', 'birthday', 'party'], [cone, pom, ...stripes]);
  FILL['party-hat'] = { solid: [0, 1], cut: [2, 3] };
  PARTS['party-hat'] = { hat: [0, 2, 3], pompom: [1] };
  MOTION['party-hat'] = { effect: 'wiggle', origin: [12, 20.25] };
}
// The party blower: the paper tongue a flat band that runs straight from the mouthpiece and rolls
// down into a curl (its outer edge r 5.75, its inner one 3 inside it); the mouthpiece a short stub
{
  const C = [15, 14.25];
  const [ro, ri, end] = [5.75, 2.75, 150];
  const band = `M7 8.5H15A${ro} ${ro} 0 1 1 ${P(polar(...C, ro, end))}L${P(polar(...C, ri, end))}A${ri} ${ri} 0 1 0 15 11.5H7Z`;
  add('party-blower', ['espantasuegras', 'matasuegras', 'año nuevo', 'cumpleaños', 'party blower', 'noisemaker', 'new year'], [band, line([2.75, 10], [7, 10])]);
  FILL['party-blower'] = { solid: [0], wire: [1] };
  PARTS['party-blower'] = { tongue: [0], mouthpiece: [1] };
  MOTION['party-blower'] = { effect: 'slide', parts: ['tongue'], vector: [1.25, 0] };
}
// Confetti on its own: three short tilted strips, two small squiggles and three dots
{
  const strip = (c, deg, l = 3.25) => line(polar(c[0], c[1], l / 2, deg + 180), polar(c[0], c[1], l / 2, deg));
  const squig = (c, deg) => {
    const u = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const n = [-u[1], u[0]];
    const at = (s, q) => add2(c, add2(mul(u, s), mul(n, q)));
    return smooth([at(-2.25, 0), at(-1.125, -0.8), at(0, 0), at(1.125, 0.8), at(2.25, 0)]);
  };
  add('confetti', ['confeti', 'celebración', 'felicidades', 'éxito', 'confetti', 'celebration', 'congrats'], [
    strip([5.5, 5.25], 35),
    strip([18.5, 8.75], -55),
    strip([9.75, 18.75], 70),
    squig([12.75, 4.25], -10),
    squig([17.75, 18.25], 20),
    dot(5.25, 12.25),
    dot(11.75, 11.25),
    dot(20.25, 14),
  ]);
  FILL.confetti = false;
  PARTS.confetti = { strips: [0, 1, 2], squiggles: [3, 4], dots: [5, 6, 7] };
  MOTION.confetti = { effect: 'float', vector: [0, 1.5] };
}
// Streamers: two paper ribbons falling from the top, each curling as it falls: a chain of half
// circles turning one way and the other down a slanted line (loops that cross themselves closed up
// at bold at this size)
const curl = (a, b, n) => {
  const step = mul(sub2(b, a), 1 / n);
  const r = len(step) / 2;
  let o = `M${P(a)}`;
  for (let i = 1; i <= n; i++) o += `A${f(r)} ${f(r)} 0 0 ${i % 2} ${P(add2(a, mul(step, i)))}`;
  return o;
};
add('party-streamers', ['serpentinas', 'decoración', 'carnaval', 'fiesta', 'streamers', 'party decor', 'carnival'], [curl([4.25, 2.75], [10.5, 21.25], 5), curl([13.5, 2.75], [19.75, 21.25], 5)]);
FILL['party-streamers'] = false;
PARTS['party-streamers'] = { streamers: [0, 1] };
MOTION['party-streamers'] = { effect: 'wiggle', origin: [12, 2.5] };
// Bunting: a cord sagging a little between the top corners and three long pennants hanging from it,
// apart, their tips straight down (wide ones packed on a deep sag read as a jaw)
{
  const [a, cy, b] = [[2.75, 6], 10.5, [21.25, 6]];
  const c = [12, cy];
  const cord = `M${P(a)}C${P(lerp(a, c, 2 / 3))} ${P(lerp(b, c, 2 / 3))} ${P(b)}`;
  const at = (x) => {
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  };
  const pennant = (x, hw = 2.1, h = 7.5) => {
    const [l, r] = [at(x - hw), at(x + hw)];
    const tip = [x, (l[1] + r[1]) / 2 + h];
    return rline([l, tip, r], [0, 0.35, 0]);
  };
  const flags = [pennant(6.25), pennant(12), pennant(17.75)];
  add('bunting', ['banderines', 'papel picado', 'guirnalda', 'fiesta', 'bunting', 'pennants', 'garland'], [cord, ...flags]);
  FILL.bunting = { solid: flags.map((d) => shut(d)), wire: [cord] };
  PARTS.bunting = { cord: [0], pennants: [1, 2, 3] };
  MOTION.bunting = { effect: 'wiggle', origin: [12, 6] };
}
// The piñata: a boxy donkey in profile (body, the neck and the head as one block, two stubby legs
// seen from the side), two long ears laid back and two fringes along its body, hung from a string
{
  const donkey = roundpoly(
    [[3.25, 10.25], [11.25, 10.25], [11.25, 5.25], [19.75, 5.25], [19.75, 8.75], [15, 8.75], [15, 21.5], [12, 21.5], [12, 19.5], [6.25, 19.5], [6.25, 21.5], [3.25, 21.5]],
    [1, 0.6, 1, 1.5, 1.5, 0.6, 0.75, 0.75, 0.5, 0.5, 0.75, 0.75],
  );
  const fringes = [line([3.25, 13.3], [15, 13.3]), line([3.25, 16.4], [15, 16.4])];
  const ears = [line([12.75, 5.25], [11.75, 2.25]), line([16, 5.25], [15, 2.25])];
  const cord = line([7.25, 1.75], [7.25, 10.25]);
  add('pinata', ['piñata', 'fiesta infantil', 'sorpresa', 'burro', 'pinata', 'kids party', 'surprise'], [donkey, ...fringes, ...ears, cord]);
  FILL.pinata = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
  PARTS.pinata = { body: [0, 1, 2, 3, 4], string: [5] };
  MOTION.pinata = { effect: 'ring', origin: [7.25, 1.75] };
}
// The birthday candle: slim, two stripes wrapping it; hogar's flame on a short wick
{
  const body = sq(9.25, 10.75, 5.5, 10.5, 1.5);
  const dir = unit([1, -0.5]);
  const stripes = [chord(body, [12, 13.75], dir), chord(body, [12, 18.25], dir)];
  const flame = 'M12 2.5C12.6 4.1 13.85 5.5 13.85 6.9A1.85 1.85 0 0 1 10.15 6.9C10.15 5.5 11.4 4.1 12 2.5Z';
  add('birthday-candle', ['vela de cumpleaños', 'cumpleaños', 'pide un deseo', 'edad', 'birthday candle', 'make a wish', 'age'], [body, ...stripes, line([12, 8.75], [12, 10.75]), flame]);
  FILL['birthday-candle'] = { solid: [0, 4], cut: [1, 2], wire: [3] };
  PARTS['birthday-candle'] = { candle: [0, 1, 2], wick: [3], flame: [4] };
  MOTION['birthday-candle'] = { effect: 'wiggle', parts: ['flame'], origin: [12, 8.75] };
}
// The wedding cake: three tiers narrowing upward as one stepped outline, the two lower ones with
// the cake's frosting (a scalloped line from wall to wall, 2.8 clear of both edges), the small
// top one plain, carrying the set's heart in place of candles
{
  const H = 6.05;
  const y1 = 21.25 - H;
  const y2 = y1 - H;
  const y3 = y2 - 3;
  const [x1, x2, x3] = [3.25, 6, 9];
  const cake = roundpoly(
    [[x1, 21.25], [x1, y1], [x2, y1], [x2, y2], [x3, y2], [x3, y3], [24 - x3, y3], [24 - x3, y2], [24 - x2, y2], [24 - x2, y1], [24 - x1, y1], [24 - x1, 21.25]],
    [1.75, 1, 0.5, 1, 0.5, 0.9, 0.9, 0.5, 1, 0.5, 1, 1.75],
  );
  /** The cake's frosting across a tier from x0 to x1 at y (its cusps), n scallops of sag s. */
  const frosting = (x0, xe, y, n, s = 0.5) => {
    const c = (xe - x0) / n;
    const r = ((c * c) / 4 + s * s) / (2 * s);
    let o = `M${P([x0, y])}`;
    for (let i = 1; i <= n; i++) o += `A${f(r)} ${f(r)} 0 0 0 ${P([x0 + c * i, y])}`;
    return o;
  };
  const waves = [frosting(x1, 24 - x1, y1 + 2.8, 5), frosting(x2, 24 - x2, y2 + 2.8, 4)];
  const heart = heartTip([12, y3], 0.24);
  add('cake-wedding', ['pastel de bodas', 'boda', 'recepción', 'pisos', 'wedding cake', 'wedding', 'reception'], [cake, ...waves, heart]);
  FILL['cake-wedding'] = { solid: [0, 3], cut: [1, 2] };
  PARTS['cake-wedding'] = { cake: [0, 1, 2], heart: [3] };
}
// The greeting card: standing half open, the front panel facing us (the signature corner; the
// fold's corners square) and the back panel receding to the left; the set's heart on the front
{
  const front = sq(9.5, 3.25, 10.25, 17.5, 3, { square: ['tl', 'bl', 'br'] });
  const back = rline([[9.5, 3.25], [4.25, 5.5], [4.25, 18.5], [9.5, 20.75]], [0, 1, 1, 0]);
  const heart = heartAt([14.625, 12], 0.26);
  add('greeting-card', ['tarjeta de felicitación', 'tarjeta', 'gracias', 'postal', 'greeting card', 'card', 'thank you'], [front, back, heart]);
  FILL['greeting-card'] = { solid: [0, shut(back)], cut: [2, line([9.5, 3.25], [9.5, 20.75])] };
  PARTS['greeting-card'] = { front: [0], back: [1], heart: [2] };
}
// Fireworks: two bursts of short rays round empty centers (their inner ends 2.85 apart), a large
// one at the top right and a small one at the bottom left; a trail of small dots (the dense dots
// of DESIGN.md, r 0.3) rising to the large one
{
  const burst = (c, n, r0, r1, off = 0) => Array.from({ length: n }, (_, i) => line(polar(c[0], c[1], r0, off + (360 * i) / n), polar(c[0], c[1], r1, off + (360 * i) / n)));
  const big = burst([15, 7.75], 8, 3.75, 6, 22.5);
  const small = burst([6.75, 17.5], 6, 2.9, 4.95, 0);
  const trail = [dot(15, 15.55, 0.3), dot(15, 18.35, 0.3), dot(15, 21.15, 0.3)];
  add('fireworks', ['fuegos artificiales', 'año nuevo', 'celebración', 'lanzamiento', 'fireworks', 'new year', 'launch'], [...big, ...small, ...trail]);
  FILL.fireworks = false;
  PARTS.fireworks = { large: big.map((_, i) => i), small: small.map((_, i) => 8 + i), trail: [14, 15, 16] };
  MOTION.fireworks = { effect: 'beat', origin: [15, 7.75] };
}
// The sparkler: a straight wire held upright and seven rays round its burning tip (45° apart,
// none down the wire, their inner ends 2.85 from each other and from the wire)
{
  const c = [12, 8.25];
  const rays = [-90, -45, 0, 45, 135, 180, 225].map((a) => line(polar(...c, 4.1, a), polar(...c, 6.2, a)));
  add('sparkler', ['bengala', 'chispas', 'año nuevo', 'boda', 'sparkler', 'sparks', 'new year'], [line(c, [12, 21.25]), ...rays]);
  FILL.sparkler = false;
  PARTS.sparkler = { wire: [0], sparks: [1, 2, 3, 4, 5, 6, 7] };
  MOTION.sparkler = { effect: 'beat', parts: ['sparks'], origin: c };
}
// The champagne popping: bebidas' bottle, its cork flown clear along the neck and three short
// spray lines bursting from the mouth, each starting clear of the neck
{
  const [bottle, label, cork] = bebidas.icons.champagne.d;
  const M = [13.475, 8.825];
  const u = unit([1.55, -2.21]);
  const flown = move(cork, ...mul(u, 2.25));
  const ray = (deg, r0, r1) => {
    const v = rot(u, [0, 0], deg);
    return line(add2(M, mul(v, r0)), add2(M, mul(v, r1)));
  };
  const spray = [ray(-62, 4, 6.25), ray(48, 3.75, 6), ray(92, 4.25, 6.4)];
  add('champagne-pop', ['descorchar', 'brindis', 'año nuevo', 'champán', 'champagne pop', 'toast', 'celebrate'], [bottle, label, flown, ...spray]);
  FILL['champagne-pop'] = { solid: [0, 2], cut: [1], lines: [3, 4, 5] };
  PARTS['champagne-pop'] = { bottle: [0, 1], cork: [2], spray: [3, 4, 5] };
  MOTION['champagne-pop'] = { effect: 'slide', parts: ['cork', 'spray'], vector: mul(u, 2) };
}
// Wedding rings: two thin bands side by side and linked, each passing behind the other at one
// crossing (the band behind stops 3 center to center from the one in front), and ropa's ring gem
// set on the right one, a piece on top. Two bare linked circles read as nucleo's link or a chain;
// the gem says rings
{
  const [c1, c2, r] = [[8.5, 14], [15.5, 14], 5.5];
  const A = circ(...c1, r);
  const B = circ(...c2, r);
  // Where the circles cross: straight above and below the middle
  const h = Math.sqrt(r * r - ((c2[0] - c1[0]) / 2) ** 2);
  const [top, bottom] = [[12, c1[1] - h], [12, c1[1] + h]];
  const onRing = (c) => (p) => Math.abs(len(sub2(p, c)) - r);
  const cut = (d0, crossing, other) => clip(d0, (p) => !(len(sub2(p, crossing)) < 4 && onRing(other)(p) < 3), 2);
  // ropa's gem and its facet line, at 0.62 with its point just inside the band's top
  const [gem, facet] = ropa.icons.ring.badge.d.map((d) => place(d, 0.62, [12, 10.75], [c2[0], c2[1] - r + 1]));
  add('wedding-rings', ['anillos de boda', 'argollas', 'matrimonio', 'aniversario', 'wedding rings', 'married', 'anniversary'], [cut(A, top, c2), cut(B, bottom, c1)], {
    badge: { d: [gem, facet], knock: gem, fill: { solid: [gem], cut: [facet] } },
  });
  FILL['wedding-rings'] = false;
  PARTS['wedding-rings'] = { rings: [0, 1] };
}
// The bouquet: three small blooms on short stems that gather into the wrapper's cone, the middle
// bloom higher (a bow on a cone this narrow left it in pieces: the cone gathers them alone)
{
  const R = 1.75;
  const C = [[12, 4.5], [4.75, 7.75], [19.25, 7.75]];
  const blooms = C.map((c) => bloom(c, R));
  const top = 12.5;
  const cone = roundpoly([[6.25, top], [17.75, top], [12, 21.5]], [0.9, 0.9, 1.25]);
  const stems = [line([12, 4.5 + R], [12, top]), line([4.75, 7.75 + R], [8.25, top]), line([19.25, 7.75 + R], [15.75, top])];
  add('bouquet', ['ramo de flores', 'boda', 'florería', 'día de las madres', 'bouquet', 'flowers', 'florist'], [...blooms, ...stems, cone]);
  FILL.bouquet = { solid: [0, 1, 2, 6], wire: [3, 4, 5] };
  PARTS.bouquet = { blooms: [0, 1, 2], stems: [3, 4, 5], wrapper: [6] };
}
// The wedding arch: a tall round arch on two posts, a draped swag hanging between its shoulders
// and a pair of leaves on each shoulder, pointing out
{
  const [c, r] = [[12, 11.5], 7];
  const arch = `M5 21.25V11.5A7 7 0 0 1 19 11.5V21.25`;
  const [l, rr] = [polar(...c, r, 225), polar(...c, r, 315)];
  const swag = `M${P(l)}C${P([9.5, 10.5])} ${P([14.5, 10.5])} ${P(rr)}`;
  const leaf = (p, deg, L = 3.5) => {
    const tip = add2(p, mul([Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)], L));
    return `M${P(p)}A1.8 1.8 0 0 1 ${P(tip)}A1.8 1.8 0 0 1 ${P(p)}Z`;
  };
  const leaves = [leaf(l, 185), leaf(l, 265), leaf(rr, -5), leaf(rr, -85)];
  add('wedding-arch', ['arco de boda', 'ceremonia', 'salón', 'boda', 'wedding arch', 'ceremony', 'venue'], [arch, swag, ...leaves]);
  FILL['wedding-arch'] = { solid: [2, 3, 4, 5], wire: [0, 1] };
}
// The headband the tiara and the flower crown share: a thin band arching up across the brow (an arc
// of r 15.5 over one of r 12.5, round ends)
const BC = [12, 28.75];
const BAND = (() => {
  const [ro, ri] = [15.5, 12.5];
  const a0 = Math.atan2(-Math.sqrt(ro * ro - (3.75 - 12) ** 2), 3.75 - 12);
  const a1 = Math.PI - a0;
  const pa = (r, a) => [BC[0] + r * Math.cos(a), BC[1] + r * Math.sin(a)];
  return `M${P(pa(ro, a0))}A${ro} ${ro} 0 0 1 ${P(pa(ro, a1))}A1.5 1.5 0 0 1 ${P(pa(ri, a1))}A${ri} ${ri} 0 0 0 ${P(pa(ri, a0))}A1.5 1.5 0 0 1 ${P(pa(ro, a0))}Z`;
})();
/** The band's top edge at x. */
const bandTop = (x) => [x, BC[1] - Math.sqrt(15.5 * 15.5 - (x - 12) ** 2)];
// The tiara: a thin band arching up across the brow and a frame of three peaks rising from it, the
// middle one tallest, a pearl on each point (a tiara needs its band arching up: on a straight one
// it is comercio's crown)
{
  const band = BAND;
  const edge = bandTop;
  const tips = [[7.5, 8.75], [12, 3.75], [16.5, 8.75]];
  const frame = rline([edge(5.25), tips[0], edge(9.75), tips[1], edge(14.25), tips[2], edge(18.75)], [0, 0.5, 0.4, 0.5, 0.4, 0.5, 0]);
  // Each pearl sits on its point as drawn (the rounded apex, not the corner it rounds)
  const ring = samples(frame)[0];
  const apex = (t) => ring.reduce((m, p) => (len(sub2(p, t)) < len(sub2(m, t)) ? p : m));
  add('tiara', ['tiara', 'quinceañera', 'novia', 'princesa', 'tiara', 'prom', 'princess'], [band, frame, ...tips.map((t) => dot(...apex(t)))]);
  FILL.tiara = { solid: [0, 2, 3, 4], wire: [1] };
}

// ── Love ──────────────────────────────────────────────────────────────────────────────────────
// The love letter: comunicacion's sealed letter (nucleo's mail seen from the back, its flap from
// corner to corner) with the set's heart for its seal, a piece on top on the flap's point
{
  const [env, flap] = comunicacion.icons['letter-sealed'].d;
  const heart = heartAt([12, 13.5], 0.3);
  add('love-letter', ['carta de amor', 'san valentín', 'romance', 'nota de amor', 'love letter', 'valentine', 'love note'], [env, flap], {
    badge: { d: [heart], knock: heart, fill: { solid: [heart] } },
  });
  FILL['love-letter'] = { solid: [0], cut: [1] };
  PARTS['love-letter'] = { envelope: [0], flap: [1] };
  MOTION['love-letter'] = { effect: 'beat', parts: ['badge'], origin: [12, 13.5] };
}
// The heart pierced: the set's heart at 0.7 and an arrow from the bottom left to the top right
// behind it (its shaft stops 3 center to center from the heart), the head at the top right and
// a pair of feathers at the tail
{
  const heart = heartAt([12, 12.25], 0.7);
  const u = unit([1, -1]);
  const [T, H] = [[4.25, 19.75], [20.75, 3.25]];
  const S = add2(T, mul(u, 1));
  const feathers = [line(S, add2(S, mul(rot(mul(u, -1), [0, 0], 45), 2.5))), line(S, add2(S, mul(rot(mul(u, -1), [0, 0], -45), 2.5)))];
  const shaft = behind(line(T, H), [heart]);
  const tip = head(H, u, 3.25);
  add('heart-arrow', ['corazón flechado', 'flechazo', 'enamorado', 'cupido', 'heart arrow', 'in love', 'crush'], [heart, ...shaft, tip, ...feathers]);
  const n = shaft.length;
  FILL['heart-arrow'] = { solid: [0], lines: [...shaft.map((_, i) => 1 + i), 1 + n, 2 + n, 3 + n] };
  PARTS['heart-arrow'] = { heart: [0], arrow: [...shaft.map((_, i) => 1 + i), 1 + n, 2 + n, 3 + n] };
  MOTION['heart-arrow'] = { effect: 'beat', parts: ['heart'], origin: [12, 12.25] };
}

// ── Winter holidays ───────────────────────────────────────────────────────────────────────────
// The decorated tree: lugares' tree-pine crown as it is, its trunk only below it, and two garlands
// wound round it, each sagging from one edge to the other and lower on the right (a garland level
// across the crown with round ornaments under it read as a slice of pizza)
{
  const crown = lugares.icons['tree-pine'].d[0];
  const edge = (y, side) => 12 + (side * (y - 2.75) * 7) / 15;
  const garland = (y0, y1, sag) => {
    const [a, b] = [[edge(y0, -1), y0], [edge(y1, 1), y1]];
    return `M${P(a)}C${P(add2(lerp(a, b, 1 / 3), [0, sag]))} ${P(add2(lerp(a, b, 2 / 3), [0, sag]))} ${P(b)}`;
  };
  add('tree-decorated', ['árbol decorado', 'árbol navideño', 'fiestas decembrinas', 'temporada', 'decorated tree', 'holiday tree', 'holiday season'], [crown, line([12, 17.75], [12, 21.25]), garland(7.5, 9.75, 1.5), garland(11.75, 14.75, 1.75)]);
  FILL['tree-decorated'] = { solid: [0], wire: [1], cut: [2, 3] };
  PARTS['tree-decorated'] = { crown: [0], trunk: [1], garland: [2, 3] };
  MOTION['tree-decorated'] = { effect: 'wiggle', origin: [12, 21.25] };
}
// The ornament: a round bauble, a square cap on it and the hook's loop on the cap; a wavy band
// across its middle (two waves 3.5 apart, in step)
{
  const [c, r] = [[12, 14.5], 6.75];
  const ball = circ(...c, r);
  const yAt = (x) => c[1] - Math.sqrt(r * r - (x - 12) ** 2);
  const cap = rline([[10.25, yAt(10.25)], [10.25, 5], [13.75, 5], [13.75, yAt(13.75)]], [0, 0.6, 0.6, 0]);
  const ring = circ(12, 3.65, 1.35);
  const wave = (y) => {
    const x0 = 12 - Math.sqrt(r * r - (y - c[1]) ** 2);
    const x1 = 24 - x0;
    const pts = Array.from({ length: 13 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / 12;
      return [x, y - 0.5 * Math.sin(((x - x0) / (x1 - x0)) * 3 * Math.PI)];
    });
    return smooth(pts);
  };
  add('ornament', ['esfera navideña', 'adorno', 'decoración', 'temporada', 'ornament', 'bauble', 'holiday decor'], [ball, cap, ring, wave(12.75), wave(16.25)]);
  FILL.ornament = { solid: [0, shut(cap)], wire: [2], cut: [3, 4] };
  PARTS.ornament = { bauble: [0, 3, 4], cap: [1], hook: [2] };
  MOTION.ornament = { effect: 'ring', origin: [12, 2.3] };
}
// The wreath: a ring with twelve leaf bumps outside and a plain edge inside; the gift's bow at the
// bottom, a piece on top (the engine clears the ring under it), two tails hanging from its knot. The
// bow sits low and clears only its own loops and tails, not their hull: filled, a hull's clearance
// ran into the ring's hole and the two read as a head over a pair of shoulders
{
  const [c, rp, ri] = [[12, 10.75], 7.5, 3.75];
  const A = Array.from({ length: 12 }, (_, i) => polar(...c, rp, -90 + 15 + 30 * i));
  let outer = `M${P(A[0])}`;
  for (let i = 0; i < 12; i++) outer += `A2.15 2.15 0 0 1 ${P(A[(i + 1) % 12])}`;
  outer += 'Z';
  const inner = circ(...c, ri);
  const k = [12, 20];
  const loops = [loop(k, [8.5, 18], 2.3), `M${P(k)}A2.3 2.3 0 0 0 ${P([15.5, 18])}A2.3 2.3 0 0 0 ${P(k)}Z`];
  const ends = [[10.5, 22.25], [13.5, 22.25]];
  const tails = ends.map((e) => line(k, e));
  // A tail's area: the segment as a hairline stadium
  const knock = `${loops.join('')}${ends.map((e) => stadium(k, e, 0.01)).join('')}`;
  add('wreath', ['corona navideña', 'guirnalda', 'puerta', 'temporada', 'wreath', 'holiday wreath', 'door decor'], [outer, inner], {
    badge: { d: [...loops, ...tails], knock, fill: { solid: loops, wire: tails } },
  });
  // Filled, a ring: the inner edge runs against the outer one, a hole under the nonzero rule
  FILL.wreath = { solid: [`${outer}${inner}`] };
  PARTS.wreath = { ring: [0, 1] };
}
// The snowman: a small head on a larger body (just touching), two buttons and two stick arms
{
  const body = circ(12, 15, 5.75);
  const headD = circ(12, 6.1, 3.25);
  const arm = (deg, to) => line(polar(12, 15, 5.75, deg), to);
  add('snowman', ['muñeco de nieve', 'invierno', 'nieve', 'temporada', 'snowman', 'winter', 'snow day'], [body, headD, dot(12, 13.25), dot(12, 17.5), arm(200, [3.25, 9.75]), arm(340, [20.75, 9.75])]);
  FILL.snowman = { solid: [0, 1], cut: [2, 3], wire: [4, 5] };
  PARTS.snowman = { body: [0, 2, 3], head: [1], arms: [4, 5] };
  MOTION.snowman = { effect: 'wiggle', origin: [12, 20.75] };
}
// The stocking: one stocking in profile, its toe to the right; a wide cuff band at the top and
// the loop it hangs from
{
  const cuff = sq(5, 4.75, 9.75, 4.25, 1.5);
  const sock = rline([[13.5, 9], [13.5, 13.25], [20.5, 14], [20.5, 20.75], [6.25, 20.75], [6.25, 9]], [0, 1.5, 3, 3.2, 4, 0]);
  add('holiday-stocking', ['calcetín navideño', 'bota navideña', 'regalos pequeños', 'temporada', 'holiday stocking', 'stocking', 'stocking stuffer'], [cuff, sock, circ(7.25, 3.4, 1.35)]);
  FILL['holiday-stocking'] = { solid: [0, shut(sock)], cut: [line([5, 9], [14.75, 9])], wire: [2] };
  PARTS['holiday-stocking'] = { cuff: [0], stocking: [1], loop: [2] };
  MOTION['holiday-stocking'] = { effect: 'ring', origin: [7.25, 2.05] };
}
// The gingerbread house: lugares' house walls (the signature corner), a steep roof whose eaves
// are a scalloped icing edge, a round-topped door and two candy dots
{
  const [apex, y0] = [[12, 2.25], 10.5];
  const [L, R] = [[2, y0], [22, y0]];
  const t = 0.92;
  const a1 = add2(apex, mul(unit(sub2(L, apex)), t));
  const a2 = add2(apex, mul(unit(sub2(R, apex)), t));
  // The icing hangs from 3 to 21; the eaves run on a little past it, so the roof's corners stay open
  let icing = `M21 ${y0}`;
  for (let i = 1; i <= 6; i++) icing += `A1.5 1.5 0 0 1 ${P([21 - 3 * i, y0])}`;
  const roof = `M${P(R)}L21 ${y0}${icing.replace(/^M[^A]*/, '')}L${P(L)}L${P(a1)}A1 1 0 0 1 ${P(a2)}Z`;
  const walls = 'M4.5 12V18.25A2.5 2.5 0 0 0 7 20.75H19.5V12';
  const door = 'M10.5 20.75V17.75A1.5 1.5 0 0 1 13.5 17.75V20.75';
  add('gingerbread-house', ['casita de jengibre', 'repostería navideña', 'galletas', 'temporada', 'gingerbread house', 'holiday baking', 'gingerbread'], [roof, walls, door, dot(7.5, 15.25), dot(16.5, 15.25)]);
  // Filled, the icing edge is cut out between the roof and the walls
  FILL['gingerbread-house'] = { solid: [0, shut(walls)], cut: [clip(icing, (p) => p[0] > 4.5 && p[0] < 19.5), 2, 3, 4] };
  PARTS['gingerbread-house'] = { roof: [0], walls: [1], door: [2], candy: [3, 4] };
}
// The sleigh in profile, going right: a tub with a high curved back, the front rising into a
// scroll that curls forward, two struts and the runner curling up at its front tip
{
  const tub = rline([[16.75, 15.75], [4.5, 15.75], [3, 6.25], [6.25, 6.25], [7.25, 10.5], [13.75, 10.5], [17.25, 4.75], [19.75, 4.75], [16.75, 15.75]], [0, 1.5, 1.5, 1.25, 1.25, 1.5, 1.5, 1.5, 0]);
  const scroll = arc(19.5, 6.75, 1.5, -90, 150).d;
  const curlUp = arc(17.5, 17, 2.5, 90, -25);
  const runner = `M2.75 19.5H17.5${curlUp.d.replace(/^M[^A]*/, '')}`;
  add('sleigh', ['trineo', 'trineo navideño', 'paseo en trineo', 'entrega', 'sleigh', 'sleigh ride', 'holiday delivery'], [shut(tub), scroll, line([6.5, 15.75], [6.5, 19.5]), line([13.5, 15.75], [13.5, 19.5]), runner]);
  FILL.sleigh = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS.sleigh = { body: [0, 1], struts: [2, 3], runner: [4] };
  MOTION.sleigh = { effect: 'slide', vector: [2, 0] };
}
// The sleigh bell: a sphere with a round-ended slot across its lower half, a slit from the slot
// down to the bottom, and the ring on top (a slot drawn as a line with a dot at each end read as a
// mustache under a face). Filled, the slot is a hole: its outline runs against the sphere's
{
  const ball = circ(12, 13.75, 7.5);
  const [y, r] = [16.75, 1.6];
  const slot = stadium([9.25, y], [14.75, y], r);
  add('jingle-bell', ['cascabel', 'campanita', 'sonido festivo', 'temporada', 'jingle bell', 'sleigh bell', 'holiday sound'], [ball, slot, line([12, y + r], [12, 21.25]), circ(12, 4.85, 1.4)]);
  // The slit's cut starts inside the hole, so it joins it at every weight
  FILL['jingle-bell'] = { solid: [`${ball}${flipPath(slot)}`], cut: [line([12, y], [12, 21.25])], wire: [3] };
  PARTS['jingle-bell'] = { bell: [0], slot: [1, 2], ring: [3] };
  MOTION['jingle-bell'] = { effect: 'ring', origin: [12, 3.45] };
}
// Holly: two spiky leaves spreading left and right from the middle and drooping a little, their
// bases 3 apart, and three berries clustered over them, 1.5 clear (rising leaves under the berries
// read as antlers over a snout; leaves crossing or sharing their base left small holes that closed
// at bold); each leaf three points a side with deep curves between them (a midrib on a leaf this
// small read as a fish's bones)
{
  const holly = (b, t, w) => {
    const u = unit(sub2(t, b));
    const n = [-u[1], u[0]];
    const L = len(sub2(t, b));
    const at = (s, q) => add2(b, add2(mul(u, s * L), mul(n, q)));
    const spikes = [[0.25, 0.8], [0.5, 1], [0.75, 0.8]];
    const pts = [at(0, 0), ...spikes.map(([s, q]) => at(s, q * w)), at(1, 0), ...spikes.map(([s, q]) => at(s, -q * w)).reverse()];
    // The curves bow in: against the outline's own turn
    const area = pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0);
    const sweep = area > 0 ? 0 : 1;
    let o = `M${P(pts[0])}`;
    for (let i = 1; i <= pts.length; i++) {
      const [p, q] = [pts[i - 1], pts[i % pts.length]];
      const r = len(sub2(q, p)) * 0.6;
      o += `A${f(r)} ${f(r)} 0 0 ${sweep} ${P(q)}`;
    }
    return { leaf: `${o}Z` };
  };
  const berries = [circ(10.4, 9.25, 1.6), circ(13.6, 9.25, 1.6), circ(12, 6.48, 1.6)];
  const leaves = [holly([10.5, 13.75], [2.25, 17], 2.6), holly([13.5, 13.75], [21.75, 17], 2.6)].map(({ leaf }) => leaf);
  add('holly', ['acebo', 'hojas de acebo', 'decoración', 'temporada', 'holly', 'holiday decor', 'berries'], [...leaves, ...berries]);
  FILL.holly = { solid: [0, 1, 2, 3, 4] };
}
// The holiday hat: a soft cone flopping over to the right into a pom-pom (a piece on top: the
// engine clears the cone under it) and a wide fur band at its base, in front of it
{
  const band = stadium([5.5, 18.6], [18.5, 18.6], 2.4);
  const cone = 'M5.75 16.2C5.5 9.5 8 4.25 12.75 4.25C16.25 4.25 18.5 6.25 19.25 9.75C17.75 9.25 16.5 9.75 16.25 11C16 12.5 16.75 14.5 17 16.2';
  const pom = circ(19.25, 10.75, 2);
  add('santa-hat', ['gorro navideño', 'gorro de invierno', 'modo festivo', 'temporada', 'holiday hat', 'winter hat', 'seasonal avatar'], [band, cone], { badge: { d: [pom], knock: pom, fill: { solid: [pom] } } });
  FILL['santa-hat'] = { solid: [0, shut(cone)], cut: [line([5.5, 16.2], [18.5, 16.2])] };
  PARTS['santa-hat'] = { band: [0], hat: [1] };
}

// ── Halloween and the Day of the Dead ─────────────────────────────────────────────────────────
// The jack-o'-lantern: frutas-verduras' pumpkin (its body and stem; the carving takes the rib's
// place) with two triangle eyes and a jagged grin
{
  const [body, , stem] = frutasVerduras.icons.pumpkin.d;
  const eyes = [roundpoly([[5.75, 13.25], [9.75, 13.25], [7.75, 9.9]], 0.45), roundpoly([[14.25, 13.25], [18.25, 13.25], [16.25, 9.9]], 0.45)];
  const grin = line(...Array.from({ length: 9 }, (_, i) => {
    const x = 6.75 + (10.5 * i) / 8;
    return [x, 16.65 + 0.75 * (1 - ((x - 12) / 5.25) ** 2) + (i % 2 ? 0.5 : -0.5)];
  }));
  add('pumpkin-carved', ['calabaza tallada', 'halloween', 'otoño', 'terror', 'jack-o-lantern', 'carved pumpkin', 'spooky'], [body, stem, ...eyes, grin]);
  FILL['pumpkin-carved'] = { solid: [0, shut(stem)], cut: [2, 3, 4] };
  PARTS['pumpkin-carved'] = { body: [0], stem: [1], face: [2, 3, 4] };
}
// The witch's hat: a tall cone bent near its tip, standing on a wide flat brim (thick enough that
// its hole holds at bold), a band across its base
{
  const top = [[2.5, 17.5], [8.83, 18.75], [15.17, 18.75], [21.5, 17.5]];
  const brim = `M2.5 17.5C8.83 18.75 15.17 18.75 21.5 17.5C15.17 22.75 8.83 22.75 2.5 17.5Z`;
  // Where the brim's top edge runs at x (its cubic, solved for x)
  const onTop = (x) => {
    const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * top[0][k] + 3 * (1 - t) ** 2 * t * top[1][k] + 3 * (1 - t) * t * t * top[2][k] + t ** 3 * top[3][k]);
    let [lo, hi] = [0, 1];
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (at(m)[0] < x) lo = m;
      else hi = m;
    }
    return at(lo);
  };
  const [l, r] = [onTop(6.75), onTop(17.25)];
  const cone = `M${P(l)}C7.5 13 9.5 8.75 12 6.25L17.75 3.5L14.25 8C14.75 11.5 16 15 ${P(r)}`;
  const band = chord(shut(cone), [12, 14.75], [1, 0]);
  add('witch-hat', ['sombrero de bruja', 'halloween', 'disfraz', 'magia', 'witch hat', 'costume', 'magic'], [brim, cone, band]);
  FILL['witch-hat'] = { solid: [0, shut(cone)], cut: [2] };
  PARTS['witch-hat'] = { brim: [0], hat: [1, 2] };
}
// The cauldron: a round belly under a thick rim, three short legs; a bubble rising off the rim
// and a smaller one above it
{
  const rim = stadium([5.5, 9.5], [18.5, 9.5], 1.5);
  const belly = 'M6.5 11A6.25 6.25 0 1 0 17.5 11';
  const legs = [line([8, 18.75], [8, 22.25]), line([12, 20.22], [12, 22.25]), line([16, 18.75], [16, 22.25])];
  add('cauldron', ['caldero', 'pócima', 'halloween', 'brujería', 'cauldron', 'potion', 'brewing'], [rim, belly, ...legs, circ(9.75, 6.6, 1.5), dot(13.25, 3.5)]);
  FILL.cauldron = { solid: [0, shut(belly), 6], wire: [2, 3, 4, 5] };
  PARTS.cauldron = { pot: [0, 1, 2, 3, 4], bubbles: [5, 6] };
  MOTION.cauldron = { effect: 'float', parts: ['bubbles'], vector: [0, -1.5] };
}
// The headstone: an upright slab with a rounded top on a ground line, a tuft of grass each side;
// plain
{
  const ground = 19.75;
  // Leaning a little, as old stones do (upright, it read as a doorway)
  const slab = clip(turnPath(`M7.5 21.5V10A4.5 4.5 0 0 1 16.5 10V21.5`, -7, [12, ground]), (p) => p[1] <= ground + 0.005, 2);
  const tuft = (x) => line([x - 1.25, ground - 2], [x - 0.6, ground], [x, ground - 2.6], [x + 0.6, ground], [x + 1.25, ground - 2]);
  add('gravestone', ['lápida', 'en memoria', 'halloween', 'tumba', 'gravestone', 'headstone', 'in memoriam'], [slab, line([2.5, ground], [21.5, ground]), tuft(3), tuft(21)]);
  FILL.gravestone = { solid: [shut(slab)], wire: [1, 2, 3] };
  PARTS.gravestone = { stone: [0], ground: [1, 2, 3] };
}
// The sugar skull: anatomia's skull (outline, nose and teeth) with flower sockets for eyes (the
// bloom) and a dot of a flower on its forehead
{
  const [skull, , , nose, teeth] = anatomia.icons.skull.d;
  const eyes = [bloom([8.6, 9.9], 1.55), bloom([15.4, 9.9], 1.55)];
  add('sugar-skull', ['calavera', 'día de muertos', 'calaverita', 'fiesta mexicana', 'sugar skull', 'calavera', 'day of the dead'], [skull, ...eyes, dot(12, 6), nose, teeth]);
  FILL['sugar-skull'] = { solid: [0], cut: [1, 2, 3, 4, anatomia.icons.skull.fill.cut[3]] };
  PARTS['sugar-skull'] = { skull: [0], eyes: [1, 2], flower: [3], nose: [4], teeth: [5] };
}

// ── Spring and harvest ────────────────────────────────────────────────────────────────────────
// The painted egg: comida's egg with a zigzag band round its middle, two dots above it and two below
{
  const egg = comida.icons.egg.d[0];
  const half = (y) => 6.75 * Math.sqrt(1 - ((y - 14) / (y < 14 ? 11.25 : 7.25)) ** 2);
  const y = 13.25;
  const n = 8;
  const zig = line(...Array.from({ length: n + 1 }, (_, i) => {
    const x = 12 - half(y) + (2 * half(y) * i) / n;
    return [x, y + (i % 2 ? -0.9 : 0.9) * (i === 0 || i === n ? 0 : 1)];
  }));
  add('egg-painted', ['huevo pintado', 'pascua', 'búsqueda de huevos', 'sorpresa oculta', 'painted egg', 'easter egg', 'egg hunt'], [egg, zig, dot(9.5, 9.25), dot(14.5, 9.25), dot(9.5, 17.25), dot(14.5, 17.25)]);
  FILL['egg-painted'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['egg-painted'] = { egg: [0], pattern: [1, 2, 3, 4, 5] };
  MOTION['egg-painted'] = { effect: 'wiggle', origin: [12, 21.25] };
}
// The egg basket: the punch bowl's bowl, woven (a wave round its middle), two eggs standing in it on
// its rim (comida's carton eggs, one stroke) and a tall handle arching from 2.5 inside the rim's
// ends. A handle as wide as the bowl closed the two into a round and the basket read as a dome
{
  const [rim, rx, ry] = [13.25, 9.25, 7.25];
  const bowl = `M2.75 ${rim}H21.25A${rx} ${ry} 0 0 1 2.75 ${rim}Z`;
  const wall = (yy) => rx * Math.sqrt(1 - ((yy - rim) / ry) ** 2);
  const wy = rim + 3.5;
  const weave = smooth(Array.from({ length: 13 }, (_, i) => {
    const x = 12 - wall(wy) + (2 * wall(wy) * i) / 12;
    return [x, wy - 0.6 * Math.sin((i / 12) * 3 * 2 * Math.PI)];
  }));
  // The carton's egg: a half ellipse 2.1 times as tall as it is half wide
  const [ew, eh] = [2, 4.2];
  const eggs = `M${P([12 - 2 * ew, rim])}A${ew} ${eh} 0 0 1 12 ${rim}A${ew} ${eh} 0 0 1 ${P([12 + 2 * ew, rim])}`;
  const handle = `M5.25 ${rim}A6.75 10.5 0 0 1 18.75 ${rim}`;
  add('egg-basket', ['canasta de huevos', 'pascua', 'búsqueda de huevos', 'primavera', 'egg basket', 'egg hunt', 'spring'], [bowl, weave, eggs, handle]);
  // Filled, the rim under the eggs is cut out, 1 inside their outer sides (as the carton's)
  FILL['egg-basket'] = { solid: [0, `${eggs}Z`], cut: [1, line([13 - 2 * ew, rim], [11 + 2 * ew, rim])], wire: [3] };
  PARTS['egg-basket'] = { basket: [0, 1], eggs: [2], handle: [3] };
}

// ── Lanterns, harvest and banners ─────────────────────────────────────────────────────────────
// The paper lantern: a round body between a top cap and a bottom cap, two ribs curving between
// them, hung from a short cord with a tassel below
{
  const [t0, t1, b0, b1] = [3.75, 6.6, 17.4, 20.25];
  const top = sq(8.75, t0, 6.5, t1 - t0, 0.9);
  const bot = sq(8.75, b0, 6.5, b1 - b0, 0.9);
  const side = (x, bulge) => {
    const h = (b0 - t1) / 2;
    const r = (h * h + bulge * bulge) / (2 * bulge);
    const sw = x < 12 ? 0 : 1;
    return `M${P([x, t1])}A${f(r)} ${f(r)} 0 0 ${sw} ${P([x, b0])}`;
  };
  add('paper-lantern', ['farol de papel', 'año nuevo lunar', 'festival de linternas', 'mercado nocturno', 'paper lantern', 'lunar new year', 'lantern festival'], [
    side(9.75, 5.25),
    side(14.25, 5.25),
    side(11.25, 3.25),
    side(12.75, 3.25),
    top,
    bot,
    line([12, 1.75], [12, t0]),
    line([12, b1], [12, 22.25]),
  ]);
  const h = (b0 - t1) / 2;
  const r = (h * h + 5.25 * 5.25) / (2 * 5.25);
  const body = `M${P([9.75, t1])}A${f(r)} ${f(r)} 0 0 0 ${P([9.75, b0])}H14.25A${f(r)} ${f(r)} 0 0 0 ${P([14.25, t1])}Z`;
  // Filled, the ribs stop 1 short of the caps (a cut ending on a cap's edge parts from it at some weights)
  const short = (d) => clip(d, (p) => p[1] > t1 + 1 && p[1] < b0 - 1, 2);
  FILL['paper-lantern'] = { solid: [body, 4, 5], cut: [short(side(11.25, 3.25)), short(side(12.75, 3.25))], wire: [6, 7] };
  PARTS['paper-lantern'] = { lantern: [0, 1, 2, 3, 4, 5], cord: [6], tassel: [7] };
  MOTION['paper-lantern'] = { effect: 'ring', origin: [12, 1.75] };
}
// The punch bowl: cocina's wide bowl on a short foot, the punch's surface a wave inside it and a
// ladle resting in it, its handle rising over the rim to a hook
{
  const [rim, rx, ry] = [10.5, 9.25, 7.25];
  const bowl = `M2.75 ${rim}H21.25A${rx} ${ry} 0 0 1 2.75 ${rim}Z`;
  const foot = 'M10.25 17.55L9.25 21H14.75L13.75 17.55';
  const wall = (yy) => rx * Math.sqrt(1 - ((yy - rim) / ry) ** 2);
  const wy = 13.5;
  const surface = smooth(Array.from({ length: 13 }, (_, i) => {
    const x = 12 - wall(wy) + (2 * wall(wy) * i) / 12;
    return [x, wy - 0.55 * Math.sin((i / 12) * 2 * 2 * Math.PI)];
  }));
  const hook = arc(18.6, 4.75, 1.6, 150, 330);
  const handle = `M13.75 ${rim}L${P(polar(18.6, 4.75, 1.6, 150))}${hook.d.replace(/^M[^A]*/, '')}`;
  add('punch-bowl', ['ponchera', 'ponche', 'fiesta', 'recepción', 'punch bowl', 'punch', 'drinks station'], [bowl, foot, surface, handle]);
  FILL['punch-bowl'] = { solid: [0, shut(foot)], cut: [2], wire: [3] };
  PARTS['punch-bowl'] = { bowl: [0, 1, 2], ladle: [3] };
}
// The flower crown: the tiara's band with three small blooms standing on it on short stems, the
// middle one higher
{
  const R = 1.5;
  const C = [[5.5, 10.25], [12, 7.5], [18.5, 10.25]];
  const blooms = C.map((c) => bloom(c, R));
  const stems = C.map(([x, y]) => line([x, y + R], bandTop(x)));
  add('flower-crown', ['corona de flores', 'festival', 'despedida de soltera', 'primavera', 'flower crown', 'floral crown', 'festival look'], [BAND, ...stems, ...blooms]);
  FILL['flower-crown'] = { solid: [0, 4, 5, 6], wire: [1, 2, 3] };
  PARTS['flower-crown'] = { band: [0], stems: [1, 2, 3], blooms: [4, 5, 6] };
}
// The party tent: a wide peaked roof, a scalloped valance along its lower edge (the eaves run on a
// little past it) and two poles at its corners; its sides open
{
  const [apex, y0] = [[12, 3.25], 10.75];
  const [L, R] = [[1.75, y0], [22.25, y0]];
  const [v0, v1, n] = [3, 21, 6];
  const c = (v1 - v0) / n;
  let valance = `M${P([v1, y0])}`;
  for (let i = 1; i <= n; i++) valance += `A${f(c / 2)} ${f(c / 2)} 0 0 1 ${P([v1 - c * i, y0])}`;
  const t = 1;
  const a1 = add2(apex, mul(unit(sub2(L, apex)), t));
  const a2 = add2(apex, mul(unit(sub2(R, apex)), t));
  const roof = `M${P(R)}L${P([v1, y0])}${valance.replace(/^M[^A]*/, '')}L${P(L)}L${P(a1)}A1.25 1.25 0 0 1 ${P(a2)}Z`;
  const poles = [line([v0 + c / 2, y0 + c / 2], [v0 + c / 2, 21]), line([v1 - c / 2, y0 + c / 2], [v1 - c / 2, 21])];
  add('party-tent', ['carpa', 'toldo', 'renta para eventos', 'boda', 'party tent', 'marquee', 'event rental'], [roof, ...poles]);
  FILL['party-tent'] = { solid: [0], wire: [1, 2] };
  PARTS['party-tent'] = { roof: [0], poles: [1, 2] };
}

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// Where the snapped drawing clumps, a drawing of its own with fewer pieces (DESIGN.md › 16 px): one
// pixel is 1.5 of the canvas and pixel centers fall on 0.75 + 1.5k. They are drawn as they are
// shown: the engine doesn't snap them.
const PX = (k) => 0.75 + 1.5 * k;
const SMALL = {};
// The bunch: three plain balloons, no knots, the strings gathering below
{
  const b = [ell([12, 6.25], 3, 3.75), ell([5.25, 9.75], 2.75, 3.5), ell([18.75, 9.75], 2.75, 3.5)];
  // The three strings gather just under the balloons and run on as one
  const g = [12, PX(11)];
  const strings = [line([12, 10], g), line([5.25, 13.25], g), line([18.75, 13.25], g), line(g, [12, PX(14)])];
  SMALL['balloon-bunch'] = { d: [...b, ...strings], fill: { solid: b, wire: strings } };
}
// The wreath: a plain ring two pixels thick and the bow's two loops hanging from its bottom, a piece
// on top that clears only its loops (lower and tighter, the bow's clearance stays out of the hole)
{
  const c = PX(6);
  const ring = [circ(12, c, 6.75), circ(12, c, 3.75)];
  // Filled, the inner edge runs against the outer one (a hole under the nonzero rule)
  const inner = `M15.75 ${f(c)}A3.75 3.75 0 1 1 8.25 ${f(c)}A3.75 3.75 0 1 1 15.75 ${f(c)}Z`;
  const k = [12, PX(12)];
  const loops = [roundpoly([k, [PX(4), PX(11)], [PX(4), PX(13)]], 0.3), roundpoly([k, [PX(11), PX(13)], [PX(11), PX(11)]], 0.3)];
  SMALL.wreath = { d: ring, fill: { solid: [`${ring[0]}${inner}`] }, badge: { d: loops, knock: loops.join(''), fill: { solid: loops } } };
}
// The tiara and the flower crown: the band a single arc
const BAND16 = `M${P([PX(2), PX(11)])}A13 13 0 0 1 ${P([PX(13), PX(11)])}`;
{
  const top = (x) => [x, 28.75 - Math.sqrt(169 - (x - 12) ** 2) + (PX(11) - (28.75 - Math.sqrt(169 - (PX(2) - 12) ** 2)))];
  // The tiara: its band a pixel lower and three spikes standing apart on it, the middle one tallest
  // (a frame whose valleys touch the band closed into one peak, an arrow up)
  const band = `M${P([PX(2), PX(12)])}A13 13 0 0 1 ${P([PX(13), PX(12)])}`;
  const on = (x) => [x, PX(12) + Math.sqrt(169 - (PX(13) - 12) ** 2) - Math.sqrt(169 - (x - 12) ** 2)];
  const spike = (x0, x1, apex) => rline([on(x0), apex, on(x1)], [0, 0.3, 0]);
  SMALL.tiara = { d: [band, spike(PX(2.5), PX(5.5), [PX(4), PX(7)]), spike(PX(6), PX(9), [12, PX(3)]), spike(PX(9.5), PX(12.5), [PX(11), PX(7)])] };
  // The blooms rings resting on the band, no stems (on stems they read as candles)
  const rings = [PX(3), 12, PX(12)].map((x) => circ(x, top(x)[1] - 2.15, 2.25));
  SMALL['flower-crown'] = { d: [BAND16, ...rings], fill: { solid: rings, wire: [BAND16] } };
}
// The sugar skull: the skull, round sockets, the nose, the teeth's line and the forehead's dot
{
  const [skull, , , nose] = anatomia.icons.skull.d;
  const eyes = [circ(8.6, 9.9, 1.75), circ(15.4, 9.9, 1.75)];
  SMALL['sugar-skull'] = { d: [skull, ...eyes, dot(12, 5.75), nose, line([7.38, 19], [16.62, 19])], fill: { solid: [skull], cut: [...eyes, dot(12, 5.75), nose, line([7.38, 19], [16.62, 19])] } };
}
// The egg basket: the bowl, its two eggs and the handle on pixel centers; no weave
{
  const rim = PX(9);
  const bowl = `M${f(PX(1))} ${f(rim)}H${f(PX(14))}A9.75 6 0 0 1 ${f(PX(1))} ${f(rim)}Z`;
  const eggs = `M${f(PX(5))} ${f(rim)}A1.875 4 0 0 1 12 ${f(rim)}A1.875 4 0 0 1 ${f(PX(10))} ${f(rim)}`;
  const handle = `M${f(PX(3))} ${f(rim)}A6.75 9 0 0 1 ${f(PX(12))} ${f(rim)}`;
  SMALL['egg-basket'] = { d: [bowl, eggs, handle], fill: { solid: [bowl, `${eggs}Z`], cut: [line([PX(5) + 1, rim], [PX(10) - 1, rim])], wire: [handle] } };
}
// Holly: two plain leaves from one point, spreading and drooping a little, as at 24 px, under the
// berries
{
  const lens = (b, t, r) => `M${P(b)}A${f(r)} ${f(r)} 0 0 1 ${P(t)}A${f(r)} ${f(r)} 0 0 1 ${P(b)}Z`;
  const berries = [circ(10.5, 9.75, 1.5), circ(13.5, 9.75, 1.5), circ(12, 7.15, 1.5)];
  const leaves = [lens([2.25, 16.5], [12, 14.25], 6.5), lens([12, 14.25], [21.75, 16.5], 6.5)];
  SMALL.holly = { d: [...leaves, ...berries], fill: { solid: [...leaves, ...berries] } };
}
// The paper lantern: an oval body narrowing to its caps (two pixels tall, wider than the body's
// ends so they show), the cord and the tassel; no ribs
{
  const body = ell([12, 12], 5.25, 6.75);
  const caps = [sq(PX(5), PX(2), 7.5, 1.5, 0.6), sq(PX(5), PX(12), 7.5, 1.5, 0.6)];
  const cords = [line([12, 1.75], [12, PX(2)]), line([12, PX(13)], [12, 22.25])];
  SMALL['paper-lantern'] = { d: [body, ...caps, ...cords], fill: { solid: [body, ...caps], wire: cords } };
}
// Bunting: the cord and three narrower pennants, two pixels apart
{
  const [a, b, cy] = [[PX(1), PX(3)], [PX(14), PX(3)], 9.5];
  const c = [12, cy];
  const cord = `M${P(a)}C${P(lerp(a, c, 2 / 3))} ${P(lerp(b, c, 2 / 3))} ${P(b)}`;
  const at = (x) => {
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  };
  const pen = (x) => rline([at(x - 1.6), [x, at(x)[1] + 6], at(x + 1.6)], [0, 0.4, 0]);
  const flags = [pen(PX(3)), pen(12), pen(PX(12))];
  SMALL.bunting = { d: [cord, ...flags], fill: { solid: flags.map(shut), wire: [cord] } };
}
// The ornament: the ball, its cap and one band across; the hook's loop doesn't fit
{
  const ball = circ(12, 13.5, 6.75);
  const yAt = (x) => 13.5 - Math.sqrt(6.75 * 6.75 - (x - 12) ** 2);
  const cap = rline([[PX(6), yAt(PX(6))], [PX(6), PX(2)], [PX(9), PX(2)], [PX(9), yAt(PX(9))]], [0, 0.4, 0.4, 0]);
  const band = line([5.25, 13.5], [18.75, 13.5]);
  SMALL.ornament = { d: [ball, cap, band], fill: { solid: [ball, shut(cap)], cut: [band] } };
}
// Fireworks: the large burst with eight rays and a small one with four
{
  const burst = (c, n, r0, r1, off = 0) => Array.from({ length: n }, (_, i) => line(polar(c[0], c[1], r0, off + (360 * i) / n), polar(c[0], c[1], r1, off + (360 * i) / n)));
  SMALL.fireworks = { d: [...burst([PX(9), PX(6)], 8, 3.5, 6.5, 22.5), ...burst([PX(3), PX(11)], 4, 1.75, 4.25, 45)] };
}
// The painted egg: the egg, its zigzag and a dot above it and below it
{
  const [egg, zig] = icons['egg-painted'].d;
  SMALL['egg-painted'] = { d: [egg, zig, dot(12, 8.25), dot(12, 18)], fill: { solid: [egg], cut: [zig, dot(12, 8.25), dot(12, 18)] } };
}
// The holiday hat: the band, the flopping cone and the pom-pom a dot at its tip
{
  const band = sq(PX(2), PX(10), 16.5, 4.5, 2.25);
  const cone = 'M6.75 15.75C6.5 9.75 8.75 5.25 12.75 5.25C16 5.25 18 7.25 18.75 10.5C17.5 10.25 16.5 10.75 16.25 12C16 13.25 16.5 14.75 16.75 15.75';
  SMALL['santa-hat'] = { d: [band, cone, dot(19.5, 11.25)], fill: { solid: [band, shut(cone), dot(19.5, 11.25)], cut: [line([6, 15.75], [18, 15.75])] } };
}
for (const [name, sm] of Object.entries(SMALL)) icons[name].small = sm;

// ── Fill, parts and motion, in blocks ────────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (!spec) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// Already round: the sleigh bell is a sphere and the wreath a ring, a circle round them says nothing
for (const name of ['jingle-bell', 'wreath']) icons[name].variants = { ...icons[name].variants, circle: false };
// Loose strokes with nothing to cross out: confetti and streamers
for (const name of ['confetti', 'party-streamers']) icons[name].variants = { ...icons[name].variants, slash: false };

// ── Mirror ────────────────────────────────────────────────────────────────────────────────────
// The sleigh travels, as the set's vehicles in profile do; what faces a side without going
// anywhere stays (the balloon dog, the piñata, the stocking), and so do objects with a fixed side
icons.sleigh.mirror = true;

export default { category: 'fiestas', label: 'Celebraciones', icons };
