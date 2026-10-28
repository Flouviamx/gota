// Personas y roles (people and roles): whole figures in their postures and actions, children and
// elders, couples and groups, queues and crowds, avatars, and people by their role. Everything is
// computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md. Two constructions only:
// - the whole figure is lugares' walking figure: a round head of r 1.9, a single stroke for the
//   torso and one per limb, rounded at the joints (one proportion for adults, one for children);
// - the bust is Núcleo's person, as comunicacion places it: the professions that carry an object put
//   the bust 2.5 to the left and the object at the bottom right, at one size and in one place.
// Badges are the engine's; anything that sits on top of another piece (a person in front, a box in
// the hands) is a custom badge and the engine clears what lies behind it.
import { arc, badge, circ, dot, f, flipPath, halfChord, head, line, polar, roundpoly, sq } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

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

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), lugares' roundline. */
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

// ── Paths as segments ─────────────────────────────────────────────────────────────────────────
// social's parse(), ser() and clip(): a path read as absolute segments (L, C, A) and written back, so a
// piece behind another stops at exactly 3 center to center from it (behind()), the set's knockout,
// the way the core `clients` and comunicacion's people draw the person behind.
const PP = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;

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
  const tk = d.match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
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

function subSeg(s, t0, t1) {
  if (s.t === 'L') return { t: 'L', a: segPt(s, t0), b: segPt(s, t1) };
  if (s.t === 'A') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}

const segLen = (s) => {
  let [n, a] = [0, segPt(s, 0)];
  for (let k = 1; k <= 16; k++) {
    const b = segPt(s, k / 16);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
};

function segD(s) {
  if (s.t === 'L') return `L${PP(s.b)}`;
  if (s.t === 'C') return `C${PP(s.p[1])} ${PP(s.p[2])} ${PP(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(subSeg(s, 0, 0.5)) + segD(subSeg(s, 0.5, 1));
  // A half circle is written with exactly half its written chord as radius (rounded up, it drew a
  // whole head as a stadium)
  const R = Math.abs(Math.abs(s.da) - Math.PI) < 1e-3 ? halfChord(segPt(s, 0).map((v) => Number(f(v))), segPt(s, 1).map((v) => Number(f(v)))) : f(s.r);
  return `A${R} ${R} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${PP(segPt(s, 1))}`;
}

function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = segPt(sp.segs[0], 0);
    o += `M${PP(last)}`;
    for (const s of sp.segs) {
      if (!near(segPt(s, 0), last)) o += `M${PP(segPt(s, 0))}`;
      o += segD(s);
      last = segPt(s, 1);
    }
    if (sp.closed) o += 'Z';
  }
  return o;
}

/** Keeps only the parts of `d` where keep(p) holds (pieces shorter than `min` are dropped). */
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
      const segs = ch.map((pc) => subSeg(sp.segs[pc.i], pc.t0, pc.t1));
      if (segs.reduce((n, s) => n + segLen(s), 0) > min) out.push({ segs, closed: false });
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
 * closer than `gap` (center to center) to their outline is dropped. 3 center to center is the
 * set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  // What is left shorter than 2.2 would be a fragment: it goes too
  return clip(d, keep, 2.2);
}

/**
 * social's settle(): the open pieces of `ds` whose ends stop near another piece (closer than `min`
 * center to center without touching it) are shortened until they stand `min` clear (a shoulder cut by
 * the person in front ends next to its own head).
 */
function settle(ds, min = 2.9) {
  ds = ds.filter(Boolean);
  const pts = ds.map((d) => samples(d).flat());
  const dist = (p, i) => Math.min(...pts.flatMap((q, j) => (j === i ? [] : q.map((r) => Math.hypot(r[0] - p[0], r[1] - p[1])))));
  return ds
    .map((d, i) => {
      const out = parse(d).map((sp) => {
        if (sp.closed) return sp;
        const bad = (p) => {
          const m = dist(p, i);
          return m > 0.35 && m < min;
        };
        const at = [];
        sp.segs.forEach((s, k) => {
          for (let j = 0; j <= 48; j++) at.push({ k, t: j / 48 });
        });
        const ok = at.map(({ k, t }) => !bad(segPt(sp.segs[k], t)));
        let [a, b] = [0, at.length - 1];
        if (!ok[a]) while (a < b && !ok[a]) a++;
        if (!ok[b]) while (b > a && !ok[b]) b--;
        if (a === 0 && b === at.length - 1) return sp;
        const segs = [];
        for (let k = at[a].k; k <= at[b].k; k++) segs.push(subSeg(sp.segs[k], k === at[a].k ? at[a].t : 0, k === at[b].k ? at[b].t : 1));
        return { segs: segs.filter((s) => segLen(s) > 0.01), closed: false };
      });
      return ser(out);
    })
    .filter(Boolean);
}

/** Custom badge: the piece on top, the area the engine clears around it, and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/** The area a piece of strokes clears: closed shapes whole, open polylines one segment at a time (a bent
 *  polyline would fill as a wedge). */
const knockOf = (closed, polylines) => [...closed, ...polylines.flatMap((pts) => pts.slice(1).map((p, i) => line(pts[i], p)))].join('');

const icons = {};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── The whole figure ──────────────────────────────────────────────────────────────────────────
// lugares' walking figure: the head a circle of r 1.9, the torso one stroke from the shoulders to
// the hips, each limb one stroke rounded at its joint (r 0.6). The head stands 2.35 clear of the
// shoulders, so the two never merge up to weight 2.1. Adults: torso 5.5, legs about 7 to 8, arms
// about 7. Children: a larger head on a shorter torso and shorter limbs.
const HR = 1.9;
const GAP = 2.35;
/** The head's center, `hr + GAP` from the shoulders, leaning `deg` degrees off the vertical (+ forward, to the right). */
const headAt = (S, deg = 0, hr = HR) => add2(S, mul([Math.sin(rad(deg)), -Math.cos(rad(deg))], hr + GAP));
/**
 * A figure from its joints: [head, torso, ...legs, ...arms]; legs and arms are polylines. The legs
 * meet at the hip and the arms at the shoulders unrounded, exactly where the torso ends: a rounded
 * apex would part them from it, or leave its end poking out (a structure that changes with the weight).
 */
function figure({ H, hr = HR, S, P, legs, arms }) {
  const sharp = (pts, at) => rl(pts, pts.map((p) => (p === at || (p[0] === at[0] && p[1] === at[1]) ? 0 : 0.6)));
  return [circ(...H, hr), line(S, P), ...legs.map((l) => sharp(l, P)), ...arms.map((a) => sharp(a, S))];
}
/** Fill and parts of a figure: the head filled, the limbs lines attached to it (lugares' walking). */
const figFill = (d) => ({ solid: [0], wire: d.map((_, i) => i).slice(1) });
const figParts = (nLegs, nArms, at = 0) => ({
  head: [at],
  body: [at + 1],
  legs: Array.from({ length: nLegs }, (_, i) => at + 2 + i),
  arms: Array.from({ length: nArms }, (_, i) => at + 2 + nLegs + i),
});

/** The adult standing from the front: feet ±2.25 apart at `foot`, arms hanging with the elbows out. */
function adultFront(cx, foot = 21.25, { arms } = {}) {
  const P = [cx, foot - 7];
  const S = [cx, P[1] - 5.5];
  const hang = (m) => [[cx + m * 3.25, S[1] + 5.65], [cx + m * 2.5, S[1] + 1.65], S];
  return {
    H: headAt(S),
    S,
    P,
    legs: [[[cx - 2.25, foot], P, [cx + 2.25, foot]]],
    arms: arms ? arms(S, hang) : [[...hang(-1), ...hang(1).reverse().slice(1)]],
  };
}
/**
 * The child standing from the front at scale k (1: 16.65 tall): the head r 2.4k on a torso of 4k and
 * legs of 5.5k, the arms hanging with the elbows out; the head's gap to the shoulders stays 2.35.
 */
function childFront(cx, foot = 21.25, k = 1, { arms } = {}) {
  const hr = 2.4 * k;
  const P = [cx, foot - 5.5 * k];
  const S = [cx, P[1] - 4 * k];
  const hang = (m) => [[cx + m * Math.max(3 * k, 3.05), S[1] + 3.6 * k], [cx + m * 2 * k, S[1] + 1.4 * k], S];
  return {
    H: headAt(S, 0, hr),
    hr,
    S,
    P,
    legs: [[[cx - 1.75 * k, foot], P, [cx + 1.75 * k, foot]]],
    arms: arms ? arms(S, hang) : [[...hang(-1), ...hang(1).reverse().slice(1)]],
  };
}

// The walking figure, lugares' stride, for the figures that walk: its joints at scale k moved by dx,
// the feet on 21.25 and the head 2.35 clear of the shoulders like every figure here (lugares' own
// 2.15 let the head touch the shoulders at weight 2.1)
function walkPose(k = 1, dx = 0) {
  const at = (p) => [12 + dx + (p[0] - 12) * k, 21.25 + (p[1] - 21.25) * k];
  const S = at([12.6, 8.5]);
  const P = at([11, 14]);
  const H = add2(S, mul(unit(sub([13.25, 4.5], [12.6, 8.5])), HR * k + GAP));
  return { at, H, hr: HR * k, S, P, legs: [[P, at([8.5, 17.25]), at([7.25, 21.25])], [P, at([13.75, 16.5]), at([14.5, 21.25])]] };
}
/** The walking figure whole, with lugares' swinging arms (`back`: the back hand, raised a little at 80 %
 *  so it stays clear of the back leg). */
function walker(k = 1, dx = 0, back = [8.5, 12.5]) {
  const w = walkPose(k, dx);
  return figure({ ...w, arms: [[w.at(back), w.at([9, 10]), w.S, w.at([14.75, 11.5]), w.at([17.25, 12.25])]] });
}

const FIGURE_TAGS = (es, en) => [...es, ...en];

// Standing, front view: the head over a straight torso, the arms hanging and the legs a little apart
{
  const d = figure(adultFront(12));
  add('figure-standing', FIGURE_TAGS(['persona de pie', 'adulto', 'de cuerpo entero', 'parado'], ['standing person', 'adult', 'full body']), d);
  FILL['figure-standing'] = figFill(d);
  PARTS['figure-standing'] = figParts(1, 1);
}
// Sitting, in profile facing right: a plain chair (its back and its seat), the thighs level and the
// shins down at a right angle, the forearm resting on the knee. The seat lies 3 under the thighs.
{
  const o = 2.25;
  const P = [8.5 + o, 16];
  const K = [13.5 + o, 16];
  const S = [P[0], 10.5];
  const H = headAt(S, 6);
  const d = [
    ...figure({ H, S, P, legs: [[P, K, [K[0], 21.25]]], arms: [[S, [10.5 + o, 13], K]] }),
    vl(5.5 + o, 11.5, 21.25),
    hl(19, 5.5 + o, 10.5 + o),
  ];
  add('figure-sitting', FIGURE_TAGS(['sentado', 'asiento ocupado', 'tome asiento', 'espera sentado'], ['sitting', 'seated', 'seat taken', 'please sit']), d);
  FILL['figure-sitting'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['figure-sitting'] = { ...figParts(1, 1), chair: [4, 5] };
}
// Kneeling on one knee: the back knee on the floor, the front foot planted under a right-angled
// knee, the forearm resting on it
{
  const P = [10, 16.25];
  const K = [15.25, 16.25];
  const S = [10, 10.75];
  const d = [
    ...figure({ H: headAt(S, 5), S, P, legs: [[P, [8, 21.25]], [P, K, [K[0], 21.25]]], arms: [[S, [12, 13.25], K]] }),
    hl(21.25, 2.75, 21.25),
  ];
  add('figure-kneeling', FIGURE_TAGS(['arrodillado', 'de rodillas', 'trabajo a ras de suelo', 'hincarse'], ['kneeling', 'kneel', 'take a knee']), d);
  FILL['figure-kneeling'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['figure-kneeling'] = { ...figParts(2, 1), floor: [5] };
}
// Lifting the safe way: a half squat, the back upright, the hands at the side of the box held low
{
  const F = [9.25, 21.25];
  const K = [12.5, 17.25];
  const P = [8, 15.25];
  const S = [8.5, 9.75];
  const box = sq(15.25, 13.5, 6, 6, 1.75, BR);
  const d = [...figure({ H: headAt(S, 8), S, P, legs: [[P, K, F]], arms: [[S, [10.75, 12.75], [15.25, 16.25]]] }), box];
  add('figure-lifting', FIGURE_TAGS(['levantar carga', 'manejo manual', 'cargar con las rodillas', 'objeto pesado'], ['lifting', 'manual handling', 'lift with your knees', 'heavy item']), d);
  FILL['figure-lifting'] = { solid: [0, 4], wire: [1, 2, 3] };
  PARTS['figure-lifting'] = { ...figParts(1, 1), box: [4] };
}
// Carrying a box: walking's stride, the arm round the box held in front of the chest
{
  const w = walkPose();
  const box = sq(16.5, 8.5, 4.75, 5.25, 1.5, BR);
  const d = [...figure({ ...w, arms: [[w.S, [14.25, 12.25], [16.5, 11.5]]] }), box];
  add('figure-carrying', FIGURE_TAGS(['cargar caja', 'mudanza', 'llevar paquete', 'entrega en mano'], ['carrying', 'carry a box', 'moving house', 'hand delivery']), d);
  FILL['figure-carrying'] = { solid: [0, 5], wire: [1, 2, 3, 4] };
  PARTS['figure-carrying'] = { ...figParts(2, 1), box: [5] };
}
// Pushing: leaning into the box, the back leg stretched behind, the arms straight against its side
{
  const P = [8.5, 15.5];
  const S = [11.5, 11];
  const H = add2(S, mul(unit(sub(S, P)), HR + GAP));
  const box = sq(16.25, 12.25, 5, 9, 1.75, BR);
  const d = [...figure({ H, S, P, legs: [[P, [3.25, 21.25]], [P, [11.75, 17.75], [11, 21.25]]], arms: [[S, [16.25, 13.75]]] }), box];
  add('figure-pushing', FIGURE_TAGS(['empujar', 'esfuerzo', 'empujar carga', 'puerta pesada'], ['pushing', 'push', 'push a load', 'heavy door']), d);
  FILL['figure-pushing'] = { solid: [0, 5], wire: [1, 2, 3, 4] };
  PARTS['figure-pushing'] = { ...figParts(2, 1), box: [5] };
}
// Celebrating, front view: both arms up, the elbows out and the forearms raised beside the head
{
  const cx = 12;
  const P = [cx, 16.25];
  const S = [cx, 11];
  const up = (m) => {
    const E = add2(S, [m * -4.01, -1.07]);
    return [add2(E, [m * -1.14, -5.38]), E];
  };
  const d = figure({ H: headAt(S), S, P, legs: [[[8.75, 21.25], P, [15.25, 21.25]]], arms: [[...up(1), S, ...up(-1).reverse()]] });
  add('figure-arms-raised', FIGURE_TAGS(['celebrar', 'éxito', 'victoria', 'meta lograda'], ['celebrate', 'success', 'cheer', 'win']), d);
  FILL['figure-arms-raised'] = figFill(d);
  PARTS['figure-arms-raised'] = figParts(1, 1);
}
// Waving, front view: one arm hanging, the other raised from the elbow, two short arcs beside the hand
{
  const cx = 10.5;
  const fig = adultFront(cx, 21.25, {
    arms: (S, hang) => {
      const E = add2(S, [4.25, 0.97]);
      return [hang(-1), [S, E, add2(E, [0.78, -4.43])]];
    },
  });
  const hand = fig.arms[1][2];
  const d = [...figure(fig), arc(...hand, 3, -30, 20).d, arc(...hand, 6, -30, 20).d];
  add('figure-waving', FIGURE_TAGS(['saludar', 'hola', 'bienvenida', 'saludo'], ['waving', 'hello', 'welcome', 'say hi']), d);
  FILL['figure-waving'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS['figure-waving'] = { head: [0], body: [1], legs: [2], arms: [3], hand: [4], wave: [5, 6] };
}
// Falling backward: the torso tipping back, the arms flung up, one foot still on a short floor line
// and the other kicked up off it
{
  const dy = -1.5;
  const at = (x, y) => [x, y + dy];
  const P = at(12, 15.25);
  const S = at(8, 11.5);
  const H = add2(S, mul(unit(sub(S, P)), HR + GAP));
  const d = [
    ...figure({ H, S, P, legs: [[P, at(16.25, 21.25)], [P, at(16.25, 13), at(19.75, 14.75)]], arms: [[S, at(12.5, 5.75)], [S, at(14, 10.25)]] }),
    hl(21.25 + dy, 12.75, 20.75),
  ];
  add('figure-falling', FIGURE_TAGS(['caída', 'resbalón', 'detección de caídas', 'alerta de caída'], ['falling', 'fall detection', 'slip and fall', 'fall alert']), d);
  FILL['figure-falling'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS['figure-falling'] = { ...figParts(2, 2), floor: [6] };
}
// Jumping, front view: the knees tucked out to the sides, the arms up, a gap of air over the floor
{
  const cx = 12;
  const P = [cx, 14];
  const S = [cx, 9];
  const up = (m) => {
    const E = add2(S, [m * -3.62, -0.97]);
    return [add2(E, [m * -1.25, -4.05]), E];
  };
  const d = [
    ...figure({ H: headAt(S), S, P, legs: [[[10.25, 17.75], [8.5, 15.5], P, [15.5, 15.5], [13.75, 17.75]]], arms: [[...up(1), S, ...up(-1).reverse()]] }),
    hl(21.25, 7, 17),
  ];
  add('figure-jumping', FIGURE_TAGS(['saltar', 'brincar', 'alegría', 'rebote'], ['jumping', 'jump', 'hop', 'joy']), d);
  FILL['figure-jumping'] = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS['figure-jumping'] = { ...figParts(1, 1), floor: [4] };
}
// Entering and exiting: walking's stride and a doorway on the floor line, ahead of the figure or
// behind it
{
  const door = (x) => rl([[x, 21.25], [x, 3], [x + 5, 3], [x + 5, 21.25]], 1.5);
  const floor = hl(21.25, 2.75, 21.25);
  // Entering, the floor starts at the back foot: a foot a hair short of the floor's end left a cusp at bold
  const inD = [...walker(1, -4.25), door(16.25), hl(21.25, 3, 21.25)];
  add('figure-entering', FIGURE_TAGS(['entrar', 'llegada', 'entrada de visitantes', 'registro de entrada'], ['entering', 'walk in', 'arrival', 'check-in']), inD);
  const outD = [...walker(1, 3.75), door(2.75), floor];
  add('figure-exiting', FIGURE_TAGS(['salir', 'salida', 'abandonar el lugar', 'registro de salida'], ['exiting', 'leaving', 'departure', 'check-out']), outD);
  for (const name of ['figure-entering', 'figure-exiting']) {
    FILL[name] = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
    PARTS[name] = { ...figParts(2, 1), door: [5], floor: [6] };
  }
}
// Working at a desk: seated in profile, the forearm on the desk and an open laptop on it
{
  const P = [6.5, 15.75];
  const K = [11, 15.75];
  const S = [6.5, 10.25];
  const E = [8.5, 12.75];
  const d = [
    ...figure({ H: headAt(S, 10), S, P, legs: [[P, K, [K[0], 21.25]]], arms: [[S, E, [10.25, 12.75]]] }),
    rl([[10.25, 12.75], [20.75, 12.75], [20.75, 21.25]]),
    line([16.25, 12.75], [18.5, 6.25]),
  ];
  add('figure-working', FIGURE_TAGS(['trabajando', 'escritorio', 'concentración', 'ocupado'], ['working', 'at work', 'desk job', 'focus time']), d);
  FILL['figure-working'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['figure-working'] = { ...figParts(1, 1), desk: [4], laptop: [5] };
}

// ── Children ──────────────────────────────────────────────────────────────────────────────────
{
  const d = figure(childFront(12));
  add('child', FIGURE_TAGS(['niño', 'niña', 'infante', 'menor de edad'], ['child', 'kid', 'minor']), d);
  FILL.child = figFill(d);
  PARTS.child = figParts(1, 1);
  const L = figure(childFront(8.25));
  for (const [name, kind, tags] of [
    ['child-check', 'check', FIGURE_TAGS(['niño registrado', 'recogido', 'entrada a la guardería', 'salida escolar'], ['child checked in', 'pickup', 'daycare check-in'])],
    ['child-alert', 'alert', FIGURE_TAGS(['niño extraviado', 'niño perdido', 'alerta de menor', 'atención'], ['lost child', 'missing child', 'child alert'])],
  ]) {
    add(name, tags, L, { badge: badge(kind) });
    FILL[name] = figFill(L);
    PARTS[name] = figParts(1, 1);
  }
}
// Two children holding hands, one a little taller: their inner hands meet between them
{
  const meet = [12, 15.1];
  const A = childFront(7.25, 21.25, 1, { arms: (S, hang) => [[...hang(-1), meet]] });
  const B = childFront(16.75, 21.25, 0.85, { arms: (S, hang) => [[meet, ...hang(1).reverse()]] });
  const d = [...figure(A), ...figure(B)];
  add('children', FIGURE_TAGS(['niños', 'hermanos', 'área infantil', 'chicos'], ['children', 'kids', 'siblings']), d);
  FILL.children = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7] };
  PARTS.children = { first: [0, 1, 2, 3], second: [4, 5, 6, 7] };
}

// ── Elders ────────────────────────────────────────────────────────────────────────────────────
// The elder: lugares' figure a little stooped, the head forward of the shoulders, the knees soft,
// one hand on the crook of a walking stick planted ahead of the feet
const ELDER_S = [11.5, 8.5];
const ELDER_P = [9.75, 13.75];
/**
 * The elder's joints, moved by dx and scaled by k from its back foot (8, 21.25); a smaller elder keeps
 * its head's gap to the shoulders, so the two never merge at weight 2.1.
 */
const elderAt = (dx = 0, dy = 0, k = 1) => (p) => [8 + dx + (p[0] - 8) * k, 21.25 + dy + (p[1] - 21.25) * k];
function elderFig(dx = 0, dy = 0, k = 1) {
  const m = elderAt(dx, dy, k);
  const S = m(ELDER_S);
  const P = m(ELDER_P);
  const H = headAt(S, 35, HR * k);
  return { H, hr: HR * k, S, P, legs: [[P, m([8.75, 17.5]), m([8, 21.25])], [P, m([11.5, 17.5]), m([11.25, 21.25])]] };
}
/** The walking stick: its shaft from the ground up to the hand, and its crook curling forward. */
const stick = (top, foot, r = 1.5) => `${line(foot, top)}A${f(r)} ${f(r)} 0 0 1 ${pt([top[0] + 2 * r, top[1]])}`;
function elder(dx = 0, dy = 0, k = 1) {
  const m = elderAt(dx, dy, k);
  const fig = elderFig(dx, dy, k);
  const top = m([16.25, 12.25]);
  fig.arms = [[fig.S, m([13.5, 11.25]), top]];
  return [...figure(fig), stick(top, m([16.75, 21.25]), 1.5 * k)];
}
const ELDER_PARTS = { ...figParts(2, 1), stick: [5] };
{
  const d = elder(0.5);
  add('elder', FIGURE_TAGS(['adulto mayor', 'tercera edad', 'jubilado', 'bastón', 'cuidado de mayores'], ['elder', 'senior', 'older adult', 'senior fare']), d);
  FILL.elder = figFill(d);
  PARTS.elder = ELDER_PARTS;
  // With the badge the elder stands at 82 % against the left edge: at full size its stick runs down
  // the badge's clearance and is nicked at every weight; at this size it stands clear of it
  const L = elder(-5.5, 0, 0.82);
  add('elder-alert', FIGURE_TAGS(['alerta de adulto mayor', 'ayuda', 'emergencia médica', 'aviso'], ['senior alert', 'medical alert', 'missed check-in']), L, { badge: badge('alert') });
  FILL['elder-alert'] = figFill(L);
  PARTS['elder-alert'] = ELDER_PARTS;
}
// With a walking frame: the elder behind it, both hands on its grips; the frame's crossbar between
// its legs is what tells it from a table
{
  const fig = elderFig(-1.5);
  fig.arms = [[fig.S, [11.75, 11.5], [14.75, 11.75]]];
  const frame = rl([[13.75, 21.25], [14.75, 11.75], [19.75, 11.75], [20.75, 21.25]], [0, 0.75, 0.75, 0]);
  const legX = (x0, x1, y) => x0 + ((x1 - x0) * (21.25 - y)) / (21.25 - 11.75);
  const barY = 16.25;
  const bar = hl(barY, legX(13.75, 14.75, barY), legX(20.75, 19.75, barY));
  const d = [...figure(fig), frame, bar];
  add('elder-walker', FIGURE_TAGS(['andadera', 'caminar asistido', 'ayuda para caminar', 'adulto mayor'], ['walker', 'walking frame', 'rollator', 'mobility aid']), d);
  FILL['elder-walker'] = figFill(d);
  PARTS['elder-walker'] = { ...figParts(2, 1), frame: [5, 6] };
}

// ── Two and more ──────────────────────────────────────────────────────────────────────────────
// All ages: a child, an adult and an elder in a row by height, front view: the child holds the adult's
// hand and the elder, at 90 % with its head bowed, leans on a stick at its side (holding hands all
// along ran past the density limit). Neighboring feet stand 3 apart and every pair of legs opens wide
// enough not to fill in at weight 2.1
{
  const J1 = [7.25, 15.25];
  const c = childFront(4, 21.25, 0.62, { arms: (S) => [[S, J1]] });
  c.legs = [[[2.5, 21.25], c.P, [5.5, 21.25]]];
  const a = adultFront(10.5, 21.25, { arms: (S, hang) => [[J1, [8.5, 10.75], ...hang(1).reverse()]] });
  a.legs = [[[8.5, 21.25], a.P, [12.5, 21.25]]];
  const k = 0.9;
  const at = (p) => [p[0], 21.25 + (p[1] - 21.25) * k];
  const eS = at([17.25, 10.25]);
  const eP = at([17.25, 15]);
  const top = [21.75, at([0, 14.25])[1]];
  const e = { H: headAt(eS, 8, HR * k), hr: HR * k, S: eS, P: eP, legs: [[[15.75, 21.25], eP, [18.75, 21.25]]], arms: [[eS, at([19.5, 11.75]), top]] };
  const d = [...figure(c), ...figure(a), ...figure(e), vl(top[0], top[1], 21.25)];
  add('generations', FIGURE_TAGS(['generaciones', 'todas las edades', 'grupos de edad', 'familia multigeneracional'], ['generations', 'all ages', 'age groups', 'multigenerational']), d);
  FILL.generations = { solid: [0, 4, 8], wire: [1, 2, 3, 5, 6, 7, 9, 10, 11, 12] };
  PARTS.generations = { child: [0, 1, 2, 3], adult: [4, 5, 6, 7], elder: [8, 9, 10, 11, 12] };
}
// A couple: two figures of one height side by side, holding hands
{
  const J = [12, 14.25];
  const A = adultFront(7.25, 21.25, { arms: (S, hang) => [[...hang(-1), [S[0] + 2.25, S[1] + 2], J]] });
  const B = adultFront(16.75, 21.25, { arms: (S, hang) => [[J, [S[0] - 2.25, S[1] + 2], ...hang(1).reverse()]] });
  const d = [...figure(A), ...figure(B)];
  add('couple', FIGURE_TAGS(['pareja', 'dos personas', 'acompañante', 'viajeros'], ['couple', 'partners', 'two people', 'plus-one']), d);
  FILL.couple = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7] };
  PARTS.couple = { first: [0, 1, 2, 3], second: [4, 5, 6, 7] };
}
// A caregiver: an adult walking beside the elder, a hand under the elder's arm; both at 82 %, each
// head keeping its gap to the shoulders (scaled with them, it merged at weight 2.1)
{
  const k = 0.82;
  const old = elder(4, 0, k);
  const at = (p) => [6.5 + (p[0] - 12) * k, 21.25 + (p[1] - 21.25) * k];
  const S = at([12.6, 8.5]);
  const P = at([11, 14]);
  const H = add2(S, mul(unit(sub([13.25, 4.5], [12.6, 8.5])), HR * k + GAP));
  const eS = elderAt(4, 0, k)(ELDER_S);
  const eP = elderAt(4, 0, k)(ELDER_P);
  const under = add2(eS, mul(sub(eP, eS), 0.45));
  const carer = figure({ H, hr: HR * k, S, P, legs: [[P, at([8.5, 17.25]), at([7.25, 21.25])], [P, at([13.75, 16.5]), at([14.5, 21.25])]], arms: [[S, add2(S, [1.75, 2.75]), under]] });
  const d = [...carer, ...old];
  add('caregiver', FIGURE_TAGS(['cuidador', 'cuidado en casa', 'acompañante', 'asistencia'], ['caregiver', 'carer', 'home care', 'support worker']), d);
  FILL.caregiver = { solid: [0, 5], wire: [1, 2, 3, 4, 6, 7, 8, 9, 10] };
  PARTS.caregiver = { carer: [0, 1, 2, 3, 4], elder: [5, 6, 7, 8, 9, 10] };
}
// Out shopping, front view: one arm hanging and the other held out to the handle of a shopping bag
// at the figure's side, clear of the legs (a bag in each hand, the arms spread to clear the legs,
// read as a pair of scales)
{
  const cx = 8.5;
  const [x, y] = [13.75, 15];
  const body = roundpoly([[x + 0.5, y], [x + 4.75, y], [x + 5.25, y + 6], [x, y + 6]], [0.6, 0.6, 1, 1]);
  const handle = `M${pt([x + 1.125, y])}V${f(y - 0.75)}A1.5 1.5 0 0 1 ${pt([x + 4.125, y - 0.75])}V${f(y)}`;
  const grip = [x + 2.625, y - 2.25];
  const fig = adultFront(cx, 21.25, { arms: (S, hang) => [hang(-1), [S, [S[0] + 2.75, S[1] + 2.5], grip]] });
  const d = [...figure(fig), handle, body];
  add('shopper', FIGURE_TAGS(['de compras', 'comprador', 'visita a la tienda', 'bolsas'], ['shopper', 'shopping trip', 'in-store shopping', 'store visit']), d);
  FILL.shopper = { solid: [0, 6], wire: [1, 2, 3, 4, 5] };
  PARTS.shopper = { ...figParts(1, 2), bag: [5, 6] };
}
// A traveler: walking's stride pulling a wheeled suitcase by its handle, the case tipped toward the
// hand and its handle running along the case's axis to the back hand, raised enough to leave the torso
// at an open angle
{
  const w = walkPose(1, 3.5);
  const axis = unit([6.25, -6.5]);
  const nrm = [-axis[1], axis[0]];
  const base = [3.5, 20.25];
  const at = (u, v) => add2(base, add2(mul(axis, u), mul(nrm, v)));
  const hand = at(9.4, 0);
  const arms = [hand, [w.S[0] - 3.25, w.S[1] + 1.5], w.S, w.at([14.75, 11.5]), w.at([17.25, 12.25])];
  const caseD = roundpoly([at(0, -2.25), at(6, -2.25), at(6, 2.25), at(0, 2.25)], 1.25);
  const handle = line(at(6, 0), hand);
  const d = [...figure({ ...w, arms: [arms] }), caseD, handle];
  add('traveler', FIGURE_TAGS(['viajero', 'llegadas', 'maleta', 'viaje'], ['traveler', 'trip', 'arrivals', 'suitcase']), d);
  FILL.traveler = { solid: [0, 5], wire: [1, 2, 3, 4, 6] };
  PARTS.traveler = { ...figParts(2, 1), suitcase: [5, 6] };
}

// ── Queues ────────────────────────────────────────────────────────────────────────────────────
/** A figure standing in profile, facing right: the legs a short step apart, the arm hanging forward. */
function sideStand(cx, foot = 21.25, k = 1) {
  const P = [cx, foot - 7 * k];
  const S = [cx, P[1] - 5.5 * k];
  // The upper arm leaves the torso at about 48° (at 39° the notch between them filled in at bold)
  return { H: headAt(S, 4, HR * k), hr: HR * k, S, P, legs: [[[cx - 1.75 * k, foot], P, [cx + 2 * k, foot]]], arms: [[S, [cx + 2.75 * k, S[1] + 2.5 * k], [cx + Math.max(3.25 * k, 3.05), S[1] + 5.25 * k]]] };
}
// Three in line at 90 %, 6.75 apart (full size they ran past the density limit)
const LINE_UP = [4.5, 11.25, 18].flatMap((x) => figure(sideStand(x, 21.25, 0.9)));
add('waiting-line', FIGURE_TAGS(['fila', 'cola', 'hacer fila', 'turno'], ['waiting line', 'queue', 'line up']), LINE_UP);
FILL['waiting-line'] = { solid: [0, 4, 8], wire: [1, 2, 3, 5, 6, 7, 9, 10, 11] };
PARTS['waiting-line'] = { first: [0, 1, 2, 3], second: [4, 5, 6, 7], third: [8, 9, 10, 11] };
// Skipping the line: two figures in line, smaller, and an arc arrow leaping over them to the front
{
  const k = 0.66;
  const two = [5.25, 11.5].flatMap((x) => figure(sideStand(x, 21.25, k)));
  // The arc starts above the first head, 3 clear of it (from behind the line it grazed that head)
  const a = arc(10.5, 11.41, 8.16, 235, 371.24);
  const d = [...two, a.d, head(a.end, a.tangent, 3.4)];
  add('skip-the-line', FIGURE_TAGS(['acceso prioritario', 'saltar la fila', 'pase rápido', 'abordaje prioritario'], ['skip the line', 'priority access', 'fast pass', 'priority boarding']), d);
  FILL['skip-the-line'] = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7, 8, 9] };
  PARTS['skip-the-line'] = { first: [0, 1, 2, 3], second: [4, 5, 6, 7], arrow: [8, 9] };
}
// Keeping apart: two figures facing each other and a double-headed arrow between them
{
  const facing = (cx) => {
    const fig = sideStand(cx);
    fig.arms = [[fig.S, [cx - 2.5, fig.S[1] + 2.25], [cx - 3.05, fig.S[1] + 5.4]]];
    return figure(fig);
  };
  const left = facing(5.5);
  const right = left.map((p) => flipPath(p));
  const y = 11;
  // The arrow's tips stand 3 from the torsos and the two heads' arms 3 apart
  const d = [...left, ...right, line([8.5, y], [15.5, y]), head([8.5, y], [-1, 0], 2.75), head([15.5, y], [1, 0], 2.75)];
  add('social-distance', FIGURE_TAGS(['distancia social', 'espacio personal', 'mantener distancia', 'proximidad'], ['social distance', 'keep your distance', 'personal space', 'proximity']), d);
  FILL['social-distance'] = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7, 8, 9, 10] };
  PARTS['social-distance'] = { first: [0, 1, 2, 3], second: [4, 5, 6, 7], arrow: [8, 9, 10] };
}
// Foot traffic: two walkers, one behind the other, lugares' stride at 80 %
{
  const d = [...walker(0.8, -5.25, [8.25, 11.25]), ...walker(0.8, 5.25, [8.25, 11.25])];
  add('foot-traffic', FIGURE_TAGS(['tráfico peatonal', 'afluencia', 'visitas a la tienda', 'transeúntes'], ['foot traffic', 'footfall', 'pedestrians', 'store visits']), d);
  FILL['foot-traffic'] = { solid: [0, 5], wire: [1, 2, 3, 4, 6, 7, 8, 9] };
  PARTS['foot-traffic'] = { first: [0, 1, 2, 3, 4], second: [5, 6, 7, 8, 9] };
}
// A patient in bed: the bed's frame on its two legs and its backrest raised; the figure lies 3 above
// them, the torso along the backrest and the head lifted off it, the arm resting on the belly
{
  const pivot = [9, 16.25];
  const back = unit([-4.25, -5.75]);
  const off = mul([-back[1], back[0]], 3);
  const legY = 16.25 - 3;
  const t = (legY - (pivot[1] + off[1])) / back[1];
  const P = add2(add2(pivot, off), mul(back, t));
  const S = add2(P, mul(back, 5.5));
  const ang = Math.atan2(back[1], back[0]) + rad(35);
  const H = add2(S, mul([Math.cos(ang), Math.sin(ang)], HR + GAP));
  const d = [
    ...figure({ H, S, P, legs: [[P, [20.5, legY]]], arms: [[S, [12.5, legY - 3]]] }),
    rl([[3.25, 21.25], [3.25, 16.25], [21.25, 16.25], [21.25, 21.25]], [0, 0.75, 0.75, 0]),
    line(pivot, add2(pivot, mul(back, 7.15))),
  ];
  add('patient', FIGURE_TAGS(['paciente', 'hospitalizado', 'reposo en cama', 'internado'], ['patient', 'inpatient', 'hospital stay', 'bed rest']), d);
  FILL.patient = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.patient = { ...figParts(1, 1), bed: [4, 5] };
}

// ── The bust ──────────────────────────────────────────────────────────────────────────────────
// Núcleo's person (head and shoulders), as comunicacion uses it: centered when the attribute is worn
// (a hat, headphones, a mark on the chest), 2.5 to the left when it carries an object, which stands
// at the bottom right on top of the shoulder (a custom badge: the engine clears the shoulder behind
// it), always inside the same box, about 8.5 × 9 from (12.75, 12.25) to (21.25, 21.25).
const PERSON = nucleo.icons.person.d;
const PERSON_L = PERSON.map((d) => move(d, -2.5, 0));
const BUST_FILL = { solid: [0, 1] };
const BUST_PARTS = { head: [0], body: [1] };
/**
 * Núcleo's person scaled from the feet (comunicacion's personSmall): the head moves up to keep its
 * gap from the shoulders, never less than 2.35 between them, so a small person keeps its head apart at 2.1.
 */
const personAt = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};
/** The top of the core person's shoulders at x (its right half is a cubic, mirrored on the left). */
const shoulderTop = (x) => {
  const [p0, p1, p2, p3] = [[19.22, 18.68], [18.5, 15.45], [15.6, 13.6], [12, 13.6]];
  const X = 12 + Math.abs(x - 12);
  const at = (t, i) => (1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t ** 3 * p3[i];
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (at(m, 0) > X) lo = m;
    else hi = m;
  }
  return at((lo + hi) / 2, 1);
};

/** The objects the professions carry, each one a piece on top of the shoulder. */
const TOOL = {};
// A tooth: the crown's two lobes and two roots splayed apart
TOOL.tooth = (() => {
  const d = [
    'M13.5 15.25C13.5 13.25 14.75 12.5 15.75 12.5C16.4 12.5 16.6 12.85 17 12.85C17.4 12.85 17.6 12.5 18.25 12.5C19.25 12.5 20.5 13.25 20.5 15.25C20.5 17 19.85 17.75 19.6 19.5L19.4 20.6C19.25 21.3 18.45 21.3 18.3 20.6L17.6 18.4C17.45 17.85 16.55 17.85 16.4 18.4L15.7 20.6C15.55 21.3 14.75 21.3 14.6 20.6L14.4 19.5C14.15 17.75 13.5 17 13.5 15.25Z',
  ];
  return own(d, d[0], { solid: d });
})();
// A capsule on the diagonal, its two halves parted by a band
TOOL.capsule = (() => {
  const c = [17, 16.75];
  const u = unit([1, -1]);
  const n = [-u[1], u[0]];
  const [h, w] = [4.5, 1.85];
  const p = (a, b) => add2(c, add2(mul(u, a), mul(n, b)));
  const R = f(w);
  const body = `M${pt(p(-h + w, -w))}L${pt(p(h - w, -w))}A${R} ${R} 0 0 1 ${pt(p(h - w, w))}L${pt(p(-h + w, w))}A${R} ${R} 0 0 1 ${pt(p(-h + w, -w))}Z`;
  const band = line(p(0, -w), p(0, w));
  return own([body, band], body, { solid: [body], cut: [band] });
})();
/**
 * A wrench in strokes at badge size: its head an open ring whose jaw opens up and to the right, 3.8
 * wide (open at weight 2.1), and the shaft running from its back to the bottom left. Drawn as a closed
 * silhouette, the inside of its jaw's prongs closed up at bold.
 */
function wrench(c = [18.5, 15.25], r = 2.5, L = 5) {
  const head = arc(...c, r, 5, 265).d;
  const back = polar(...c, r, 135);
  const end = add2(back, mul(unit([-1, 1]), L));
  return { d: [head, line(back, end)], knock: `${circ(...c, r)}${line(back, end)}` };
}
TOOL.wrench = (() => {
  const w = wrench();
  return own(w.d, w.knock);
})();
// A lightning bolt as one zigzag stroke: at badge size Núcleo's closed bolt filled in and read as an
// eraser, the stroke keeps its two steps open at every weight
TOOL.bolt = (() => {
  const d = ['M20.25 12.25L15.75 16.75H19.75L15.25 21.25'];
  return own(d, d[0]);
})();
// A tap: the pipe bent down into its outlet, the handle over the outlet, and a drop falling from it
TOOL.faucet = (() => {
  const pipe = roundpoly([[13.75, 12.75], [20.25, 12.75], [20.25, 16.25], [17.75, 16.25], [17.75, 15.25], [13.75, 15.25]], [0.5, 1, 0.6, 0.6, 0.5, 0.5]);
  const handle = 'M18.25 10.5H20.25M19.25 10.5V12.75';
  const drop = 'M19 18.75L19.95 19.6A1.25 1.25 0 1 1 18.05 19.6Z';
  // It clears its whole box: around each piece alone, a sliver of shoulder showed under the pipe
  const hull = sq(13.75, 12.75, 6.5, 8.1, 1);
  return own([pipe, handle, drop], `${hull}${handle}`, { solid: [pipe, drop], wire: [handle] });
})();
// A paint roller: the roller, its frame bent out and down 3 clear of it, and its handle (a grip drawn
// as a box closed up at weight 2.1)
TOOL.roller = (() => {
  const roller = sq(12.75, 12.25, 5, 3.25, 1.625);
  const frame = rl([[17.75, 13.875], [20.75, 13.875], [20.75, 18.5], [16.25, 18.5], [16.25, 21.25]], [0, 0.75, 0.75, 0.6, 0]);
  // It clears the area its pieces enclose: around each piece alone, a sliver of shoulder showed
  // between the roller and the handle
  const hull = roundpoly([[12.75, 12.25], [20.75, 12.25], [20.75, 18.5], [16.25, 21.25], [12.75, 15.5]], [1.625, 0.75, 0.75, 0.5, 1.625]);
  return own([roller, frame], hull, { solid: [roller], wire: [frame] });
})();
// A spray bottle in one silhouette: the body, the neck and the trigger head with its nozzle
TOOL.spray = (() => {
  const d = [roundpoly([[13.25, 21.25], [18.75, 21.25], [18.75, 16.75], [17.25, 15.5], [17.25, 14.75], [20.75, 14.75], [20.75, 12.25], [14.25, 12.25], [14.75, 15.5], [13.25, 16.75]], [0, 0, 1, 0.4, 0.4, 0.5, 0.5, 0.75, 0.4, 1])];
  return own(d, d[0], { solid: d });
})();
// A watering can: the body, its handle over the top (3 wide, open at weight 2.1) and the spout rising
// from its side to the rose; without the handle it read as a dustpan
TOOL.can = (() => {
  const body = roundpoly([[13.75, 15.5], [18.25, 15.5], [18.75, 21], [13.25, 21]], [0.6, 0.6, 0.6, 0.6]);
  const handle = 'M13.75 15.5V14.25A1.5 1.5 0 0 1 16.75 14.25V15.5';
  const rose = [[19.6, 12.6], [22, 14.25]];
  const mid = [(rose[0][0] + rose[1][0]) / 2, (rose[0][1] + rose[1][1]) / 2];
  const spout = line([18.15, 18], mid);
  return own([body, handle, spout, line(...rose)], `${body}${handle}Z${knockOf([], [[[18.15, 18], mid], rose])}`, { solid: [body], wire: [handle, spout, line(...rose)] });
})();
// A flask: the neck, the cone and the liquid's level
TOOL.flask = (() => {
  const body = roundpoly([[15.5, 12.25], [18.5, 12.25], [18.5, 15], [21, 20.5], [13, 20.5], [15.5, 15]], [0.4, 0.4, 0.75, 0.9, 0.9, 0.75]);
  const level = line([14.5, 17.75], [19.5, 17.75]);
  return own([body, level], body, { solid: [body], cut: [level] });
})();
// Code: a pair of chevrons, 3 apart (at badge size the slash between them would run into both)
TOOL.code = (() => {
  const d = [line([15.5, 13.75], [13, 16.75], [15.5, 19.75]), line([18.5, 13.75], [21, 16.75], [18.5, 19.75])];
  return own(d, roundpoly([[12.75, 13.5], [21.25, 13.5], [21.25, 20], [12.75, 20]], 1.5));
})();
// A vector pen nib: the nib, its slit and its hole
TOOL.nib = (() => {
  const P = 'M14.88 7.25L16.97 10.53A2.25 2.25 0 0 1 16.96 12.96L15.37 15.43A1.25 1.25 0 0 1 14.32 16L9.68 16A1.25 1.25 0 0 1 8.63 15.43L7.04 12.96A2.25 2.25 0 0 1 7.03 10.53L11.24 3.94A0.9 0.9 0 0 1 12.76 3.94Z';
  const nib = place(P, 0.72, [12, 10], [17, 15.75]);
  const hole = dot(17, 16.5);
  // The slit runs from the tip down to the hole and touches it
  const slit = line([17, 11.4], [17, 15.8]);
  return own([nib, slit, hole], nib, { solid: [nib], cut: [slit, hole] });
})();
// A calculator: its display band, edge to edge, and two keys (small dots: at the usual size they ran
// into the case's sides at weight 2.1)
TOOL.calculator = (() => {
  const box = sq(12.75, 12.25, 8.5, 9, 1.5, BR);
  const band = hl(14.75, 12.75, 21.25);
  const keys = [dot(15.5, 18, 0.3), dot(18.5, 18, 0.3)];
  return own([box, band, ...keys], box, { solid: [box], cut: [hl(14.75, 11.5, 22.5), ...keys] });
})();
// Dispositivos' music note at badge size
TOOL.note = (() => {
  const N = ['M11.97 16.43A3.25 2.3 -24 1 1 6.03 19.07A3.25 2.3 -24 1 1 11.97 16.43Z', 'M12.11 17.12L12.11 3', 'M12.11 3C12.11 6.25 17.11 6.5 17.11 10.75'];
  const d = N.map((p) => place(p, 0.55, [11.6, 11.75], [17, 16.75]));
  return own(d, `${d[0]}${knockOf([], [[[17.29, 17.45], [17.29, 9.99]], [[17.29, 9.99], [19.04, 12.5], [20.04, 14.29]]])}`, { solid: [d[0]], wire: [d[1], d[2]] });
})();
// Scissors: two finger rings and the blades crossing above them
TOOL.scissors = (() => {
  const [A, B] = [[14.25, 19.25], [19.75, 19.25]];
  const rings = [circ(...A, 1.5), circ(...B, 1.5)];
  const ends = [[polar(...A, 1.5, -50), [20.25, 12.25]], [polar(...B, 1.5, 230), [13.75, 12.25]]];
  const blades = ends.map(([a, b]) => line(a, b));
  return own([...rings, ...blades], `${rings.join('')}${knockOf([], ends)}`, { solid: rings, wire: blades });
})();
// Comercio's shopping bag, its body flaring to the bottom and the handle over it
TOOL.bag = (() => {
  const B = ['M10.62 11.91A1.31 1.31 0 0 1 11.92 10.75L18.96 10.75A1.31 1.31 0 0 1 20.26 11.91L21.25 20.5L11.74 20.5A1.88 1.88 0 0 1 9.87 18.41Z', 'M12.82 10.75V9.81A2.625 2.625 0 0 1 18.07 9.81V10.75'];
  const d = B.map((p) => place(p, 0.76, [21.25, 20.5], [21.25, 21]));
  return own(d, `${d[0]}${d[1]}`, { solid: [d[0]], wire: [d[1]] });
})();
// Comercio's price tag at badge size, its hole a dot
TOOL.tag = (() => {
  const T = 'M5.53 7.1A1.6 1.6 0 0 1 7.1 5.53L12.92 5.4A1.4 1.4 0 0 1 13.94 5.81L20.31 12.18A2.4 2.4 0 0 1 20.31 15.57L15.57 20.31A2.4 2.4 0 0 1 12.18 20.31L5.81 13.94A1.4 1.4 0 0 1 5.4 12.92Z';
  const s = 0.6;
  const body = place(T, s, [12.85, 12.85], [17, 16.75]);
  // The hole sits 2.9 clear of the edges, so it stays open at weight 2.1
  const hole = dot(17 + (10.5 - 12.85) * s, 16.75 + (10.5 - 12.85) * s);
  return own([body, hole], body, { solid: [body], cut: [hole] });
})();
// A wheel: the tire, the hub and five spokes (four, on the diagonals, read as a circled x)
TOOL.wheel = (() => {
  const c = [17, 16.75];
  const tire = circ(...c, 4.25);
  const hub = circ(...c, 1.4);
  const spokes = [-90, -18, 54, 126, 198].map((a) => line(polar(...c, 1.4, a), polar(...c, 4.25, a)));
  return own([tire, hub, ...spokes], tire, { solid: [tire], cut: [hub, ...spokes] });
})();
// A plane in strokes, nose up and to the right: its fuselage, its swept wings and its tail (lugares'
// plane in outline, at badge size, closed its fuselage at weight 2.1)
TOOL.plane = (() => {
  const c = [17, 16.75];
  const u = unit([1, -1]);
  const n = [-u[1], u[0]];
  const p = (a, b) => add2(c, add2(mul(u, a), mul(n, b)));
  const d = [line(p(-4.25, 0), p(4.25, 0)), line(p(-1.25, -4), p(1, 0), p(-1.25, 4)), line(p(-3.5, -1.75), p(-2.75, 0), p(-3.5, 1.75))];
  // It clears a round area: around the strokes the shoulder would peek through in slivers
  return own(d, circ(17, 16.75, 4.6));
})();
// A parcel and its tape
TOOL.parcel = (() => {
  const box = sq(12.75, 13, 8.5, 8.25, 1.75, BR);
  const tape = vl(17, 13, 21.25);
  return own([box, tape], box, { solid: [box], cut: [tape] });
})();
// A whistle: the round chamber and the mouthpiece running off it
TOOL.whistle = (() => {
  const c = [15.75, 18];
  const r = 3;
  const y = 16.75;
  const xr = c[0] + Math.sqrt(r * r - (y - c[1]) ** 2);
  const d = [`M${pt([c[0], c[1] - r])}H21V${f(y)}H${f(xr)}A${r} ${r} 0 1 1 ${pt([c[0], c[1] - r])}Z`];
  return own(d, d[0], { solid: d });
})();

for (const [name, kind, tags] of [
  ['dentist', 'tooth', ['dentista', 'odontólogo', 'cita dental', 'salud dental', 'dentist', 'dental care']],
  ['pharmacist', 'capsule', ['farmacéutico', 'farmacia', 'medicamentos', 'pharmacist', 'pharmacy staff']],
  ['technician', 'wrench', ['técnico', 'reparación', 'servicio a domicilio', 'technician', 'repair person', 'field service']],
  ['electrician', 'bolt', ['electricista', 'instalación eléctrica', 'servicios del hogar', 'electrician', 'electrical work']],
  ['plumber', 'faucet', ['plomero', 'fontanero', 'plomería', 'plumber', 'plumbing']],
  ['painter', 'roller', ['pintor', 'pintura de casas', 'decorador', 'painter', 'house painting']],
  ['cleaner', 'spray', ['limpieza', 'personal de limpieza', 'conserje', 'cleaner', 'housekeeper', 'janitor']],
  ['gardener', 'can', ['jardinero', 'jardinería', 'paisajismo', 'gardener', 'landscaper']],
  ['scientist', 'flask', ['científico', 'investigador', 'laboratorista', 'scientist', 'researcher']],
  ['developer', 'code', ['desarrollador', 'programador', 'ingeniero de software', 'developer', 'programmer']],
  ['designer', 'nib', ['diseñador', 'diseño gráfico', 'creativo', 'designer', 'ui designer']],
  ['accountant', 'calculator', ['contador', 'contabilidad', 'impuestos', 'accountant', 'bookkeeper']],
  ['musician', 'note', ['músico', 'artista', 'intérprete', 'musician', 'performer']],
  ['hairstylist', 'scissors', ['estilista', 'peluquero', 'barbero', 'hairstylist', 'barber']],
  ['customer', 'bag', ['cliente', 'comprador', 'ficha de cliente', 'customer', 'buyer']],
  ['seller', 'tag', ['vendedor', 'comerciante', 'perfil de vendedor', 'seller', 'vendor', 'merchant']],
  ['mechanic', 'wheel', ['mecánico', 'taller', 'reparación de autos', 'mechanic', 'auto repair']],
  ['coach', 'whistle', ['entrenador', 'instructor', 'coach', 'trainer', 'team coach']],
]) {
  add(name, tags, PERSON_L, { badge: TOOL[kind] });
  FILL[name] = BUST_FILL;
  PARTS[name] = BUST_PARTS;
}

// ── Worn attributes: hats ─────────────────────────────────────────────────────────────────────
// The hats sit on the bust at 85 % (its head lower, so a hat fits above it), the head's arc ending on
// the hat's lower edge as person-chef's ends on its band. One bust for every hat.
const HAT_S = 0.85;
const HATTED = personAt(HAT_S);
const HC = [12, 20.6 + (7.45 - 20.6) * HAT_S - Math.max(1.95, (2.35 - 2.45 * HAT_S) / (1 - HAT_S)) * (1 - HAT_S)];
const HR_B = 3.7 * HAT_S;
/** The part of the hatted head below the line y = yb, from the right end round the chin to the left one. */
const headBelow = (yb) => {
  const a = (Math.asin((yb - HC[1]) / HR_B) * 180) / Math.PI;
  return arc(...HC, HR_B, a, 180 - a).d;
};
const hatted = (name, tags, yb, hat, fill, parts) => {
  const d = [headBelow(yb), HATTED[1], ...hat];
  add(name, tags, d);
  FILL[name] = fill ?? { solid: [`${d[0]}Z`, 1, ...hat.map((_, i) => i + 2)] };
  PARTS[name] = parts ?? { head: [0], body: [1], hat: hat.map((_, i) => i + 2) };
};
// A hard hat: the dome, its brim reaching past it and the ridge down its middle
{
  const yb = 7.25;
  const dome = `M${pt([7.5, yb])}A4.5 4.5 0 0 1 ${pt([16.5, yb])}Z`;
  const brim = hl(yb, 5.5, 18.5);
  const ridge = vl(12, yb - 4.5, yb);
  hatted('builder', ['obrero', 'constructor', 'ingeniero en obra', 'contratista', 'builder', 'construction worker', 'contractor'], yb, [dome, brim, ridge], { solid: [`${headBelow(yb)}Z`, 1, 2], wire: [3], cut: [4] });
}
// A mortarboard: the flat board seen from the front and its tassel hanging from a corner
{
  const L = [4, 4.5];
  const R = [20, 4.5];
  const T0 = [12, 1.85];
  const B = [12, 7.15];
  const board = roundpoly([T0, R, B, L], [0.6, 0.6, 0.6, 0.6]);
  // The head's arc ends on the board's lower edges
  const hit = (P0, P1) => {
    let [lo, hi] = [0, 1];
    const at = (t) => [P0[0] + (P1[0] - P0[0]) * t, P0[1] + (P1[1] - P0[1]) * t];
    const out = (t) => Math.hypot(at(t)[0] - HC[0], at(t)[1] - HC[1]) > HR_B;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (out(m) === out(0)) lo = m;
      else hi = m;
    }
    return at(lo);
  };
  const pl = hit(L, B);
  const pr = hit(R, B);
  const ang = (p) => (Math.atan2(p[1] - HC[1], p[0] - HC[0]) * 180) / Math.PI;
  const face = arc(...HC, HR_B, ang(pr), ang(pl) < 0 ? ang(pl) + 360 : ang(pl)).d;
  const tassel = vl(R[0] + (B[0] - R[0]) * 0.25, R[1] + (B[1] - R[1]) * 0.25, 9.5);
  const d = [face, HATTED[1], board, tassel];
  add('graduate', ['graduado', 'egresado', 'titulación', 'exalumno', 'graduate', 'alumni', 'degree'], d);
  FILL.graduate = { solid: [`${face}Z`, 1, 2], wire: [3] };
  PARTS.graduate = { head: [0], body: [1], hat: [2, 3] };
}
// A peaked cap: the crown wider at the top, its band running out as the peak, and a badge on its
// front; the pilot wears it with the plane at the corner
const CAP_Y = 7.75;
const CAP = roundpoly([[4.75, 2], [19.25, 2], [16.75, CAP_Y], [7.25, CAP_Y]], [1.5, 1.5, 0.4, 0.4]);
const PEAK = hl(CAP_Y, 5.75, 18.25);
{
  const emblem = dot(12, 4.85);
  hatted('police-officer', ['policía', 'agente', 'seguridad pública', 'denunciar', 'police officer', 'police', 'law enforcement'], CAP_Y, [CAP, PEAK, emblem], { solid: [`${headBelow(CAP_Y)}Z`, 1, 2], wire: [3], cut: [4] });
  const d = [headBelow(CAP_Y), HATTED[1], CAP, PEAK].map((p) => move(p, -2.5, 0));
  add('pilot', ['piloto', 'capitán', 'tripulación', 'aviación', 'pilot', 'captain', 'flight crew'], d, { badge: TOOL.plane });
  FILL.pilot = { solid: [`${d[0]}Z`, 1, 2], wire: [3] };
  PARTS.pilot = { head: [0], body: [1], hat: [2, 3] };
}
// A fire helmet: a high dome with the front shield rising over it, in one silhouette, and the brim
// sweeping down at the sides
{
  const yb = 7.75;
  const r = 4.25;
  const w = 2.25;
  const y0 = yb - Math.sqrt(r * r - w * w);
  const dome = `M${pt([12 - r, yb])}A${r} ${r} 0 0 1 ${pt([12 - w, y0])}V2.75A4 4 0 0 1 ${pt([12 + w, 2.75])}V${f(y0)}A${r} ${r} 0 0 1 ${pt([12 + r, yb])}`;
  const brim = rl([[4.25, 9.5], [5.75, yb], [18.25, yb], [19.75, 9.5]], [0, 1, 1, 0]);
  hatted('firefighter', ['bombero', 'cuerpo de bomberos', 'brigada contra incendios', 'firefighter', 'fire service', 'fire warden'], yb, [dome, brim], { solid: [`${headBelow(yb)}Z`, 1, `${dome}Z`], wire: [3] });
}
// A wide-brimmed hat: a low crown and the straight brim reaching past the shoulders
{
  const yb = 7.75;
  const crown = roundpoly([[8.75, 3], [15.25, 3], [16, yb], [8, yb]], [1.75, 1.75, 0, 0]);
  const brim = hl(yb, 2.75, 21.25);
  hatted('farmer', ['agricultor', 'campesino', 'productor', 'granjero', 'farmer', 'grower', 'farm worker'], yb, [crown, brim], { solid: [`${headBelow(yb)}Z`, 1, 2], wire: [3] });
}
// A courier: a cap with its bill to the side, the bust on the left and the parcel at the corner
{
  const yb = 7.75;
  const cap = `M${pt([8.25, yb])}A3.75 3.75 0 0 1 ${pt([15.75, yb])}Z`;
  const bill = hl(yb, 15.75, 19.5);
  const d = [headBelow(yb), HATTED[1], cap, bill].map((p) => move(p, -2.5, 0));
  add('courier', ['repartidor', 'mensajero', 'cartero', 'entrega', 'courier', 'delivery person', 'mail carrier'], d, { badge: TOOL.parcel });
  FILL.courier = { solid: [`${d[0]}Z`, 1, 2], wire: [3] };
  PARTS.courier = { head: [0], body: [1], hat: [2, 3] };
}

// ── Worn attributes: on the head and the chest ────────────────────────────────────────────────
// Headphones: the band over the head and a cup at each side
{
  const [cx, cy] = HC;
  const cups = [sq(3.25, cy - 1.5, 2.75, 5.25, 1.375), sq(18, cy - 1.5, 2.75, 5.25, 1.375)];
  const band = arc(cx, cy, 7.375, 180, 360).d;
  const d = [HATTED[0], HATTED[1], band, ...cups];
  add('listener', ['oyente', 'escuchar', 'audífonos', 'fan de la música', 'listener', 'music fan', 'monthly listeners'], d);
  FILL.listener = { solid: [0, 1, 3, 4], wire: [2] };
  PARTS.listener = { head: [0], body: [1], headphones: [2, 3, 4] };
}
// A two-way radio clipped at the shoulder, its antenna up beside the head
{
  const radio = sq(16.25, 13.25, 3.75, 5.5, 1.25, BR);
  const antenna = vl(19, 9.25, 13.25);
  add('security-guard', ['guardia de seguridad', 'vigilante', 'seguridad del evento', 'security guard', 'guard', 'bouncer'], PERSON, {
    badge: own([radio, antenna], `${radio}${antenna}`, { solid: [radio], wire: [antenna] }),
  });
  FILL['security-guard'] = BUST_FILL;
  PARTS['security-guard'] = BUST_PARTS;
}
// A stethoscope round the neck: the tubing hangs down the chest in a loop, its chest piece on the
// loop at one side
const STETHO = (() => {
  const y = 14.75;
  const loop = `M${pt([9.25, shoulderTop(9.25)])}V${f(y)}A2.75 2.75 0 0 0 ${pt([14.75, y])}V${f(shoulderTop(14.75))}`;
  return [loop, dot(...polar(12, y, 2.75, 40))];
})();
{
  const d = [...PERSON, ...STETHO];
  add('doctor', ['médico', 'doctor', 'personal médico', 'consulta', 'doctor', 'physician', 'find care'], d);
  FILL.doctor = { solid: [0, 1], cut: [2, 3] };
  PARTS.doctor = { ...BUST_PARTS, stethoscope: [2, 3] };
  const L = d.map((p) => move(p, -2.5, 0));
  add('doctor-search', ['buscar médico', 'directorio médico', 'encontrar atención', 'find a doctor', 'provider search', 'find care near you'], L, { badge: badge('search') });
  FILL['doctor-search'] = FILL.doctor;
  PARTS['doctor-search'] = PARTS.doctor;
}
// A nurse: the medical cross on the chest, on top of the bust (the engine clears the shoulders around
// it); carried at the corner like an object it read as the add-person badge
{
  const [cx, cy, a, L] = [12, 17.5, 1.4, 3.25];
  const P = [[cx - a, cy - L], [cx + a, cy - L], [cx + a, cy - a], [cx + L, cy - a], [cx + L, cy + a], [cx + a, cy + a], [cx + a, cy + L], [cx - a, cy + L], [cx - a, cy + a], [cx - L, cy + a], [cx - L, cy - a], [cx - a, cy - a]];
  const cross = roundpoly(P, P.map((_, i) => (i % 3 === 2 ? 0.4 : 0.6)));
  add('nurse', ['enfermería', 'personal de salud', 'primeros auxilios', 'nurse', 'healthcare worker', 'care team'], PERSON, { badge: own([cross], cross, { solid: [cross] }) });
  FILL.nurse = BUST_FILL;
  PARTS.nurse = BUST_PARTS;
}
// A tie down the chest
{
  const tie = roundpoly([[11.1, 13.6], [12.9, 13.6], [13.35, 15], [12.7, 19.5], [12, 20.6], [11.3, 19.5], [10.65, 15]], [0.3, 0.3, 0.4, 0.4, 0, 0.4, 0.4]);
  const d = [...PERSON, tie];
  add('businessperson', ['ejecutivo', 'profesional', 'gerente', 'cuenta empresarial', 'businessperson', 'executive', 'manager'], d);
  FILL.businessperson = { solid: [0, 1], cut: [2] };
  PARTS.businessperson = { ...BUST_PARTS, tie: [2] };
}
// An apron: its bib on the chest and the straps running up to the shoulders
{
  const bib = `M${pt([9, shoulderTop(9)])}L${pt([10.25, 16.75])}H13.75L${pt([15, shoulderTop(15)])}`;
  const sides = [vl(10.25, 16.75, 20.6), vl(13.75, 16.75, 20.6)];
  const d = [...PERSON, bib, ...sides];
  add('shop-assistant', ['dependiente', 'empleado de tienda', 'asesor de ventas', 'barista', 'shop assistant', 'store staff', 'sales associate'], d);
  FILL['shop-assistant'] = { solid: [0, 1], cut: [2, 3, 4] };
  PARTS['shop-assistant'] = { ...BUST_PARTS, apron: [2, 3, 4] };
}
// A heart on the chest, its point resting on the shoulders' lower edge
{
  const heart = (() => {
    const [r, a] = [1.45, 1.35];
    const cy = 17.85;
    const tip = [12, 20.6];
    const cl = [12 - a, cy];
    const cr = [12 + a, cy];
    const ang = (c, p) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
    const tan = (c, side) => ang(c, tip) + (side * Math.acos(r / Math.hypot(tip[0] - c[0], tip[1] - c[1])) * 180) / Math.PI;
    const top = [12, cy - Math.sqrt(r * r - a * a)];
    const [t1, t2] = [tan(cl, 1), tan(cr, -1)];
    const seg = (c, a0, a1) => arc(...c, r, a0, a1).d.replace(/^M[^A]*/, '');
    return `M${pt(tip)}L${pt(polar(...cl, r, t1))}${seg(cl, t1, ang(cl, top) + 360)}${seg(cr, ang(cr, top), t2 + 360)}Z`;
  })();
  const d = [...PERSON, heart];
  add('volunteer', ['voluntario', 'voluntariado', 'ayudante', 'organización sin fines de lucro', 'volunteer', 'helper', 'nonprofit'], d);
  FILL.volunteer = { solid: [0, 1], cut: [2] };
  PARTS.volunteer = { ...BUST_PARTS, heart: [2] };
}
// Behind the wheel: the head, the shoulders running behind the steering wheel and ending on its rim,
// and the wheel with its hub and three spokes
const DRIVER = (() => {
  const W = [12, 17.75];
  const rw = 4;
  const C = [12, 23];
  const rs = 8.5;
  const dd = C[1] - W[1];
  const a = (rs * rs - rw * rw + dd * dd) / (2 * dd);
  const h = Math.sqrt(rs * rs - a * a);
  const hit = (Math.atan2(-a, -h) * 180) / Math.PI + 360;
  const low = 180 + (Math.asin((C[1] - 21.25) / rs) * 180) / Math.PI;
  return [
    circ(12, 6.75, 3.5),
    arc(...C, rs, low, hit).d,
    arc(...C, rs, 540 - hit, 540 - low).d,
    circ(...W, rw),
    circ(...W, 1.5),
    ...[0, 90, 180].map((g) => line(polar(...W, 1.5, g), polar(...W, rw, g))),
  ];
})();
{
  const fill = { solid: [0, 3], wire: [1, 2], cut: [4, 5, 6, 7] };
  const parts = { head: [0], body: [1, 2], wheel: [3, 4, 5, 6, 7] };
  add('driver', ['conductor', 'chofer', 'tu conductor', 'viaje compartido', 'driver', 'chauffeur', 'ride-hailing'], DRIVER);
  FILL.driver = fill;
  PARTS.driver = parts;
}
// A camera held in front of the chest: its body and lens
{
  const body = sq(5.5, 14.25, 13, 7, 2.25, BR);
  const lens = circ(12, 17.75, 2);
  add('photographer', ['fotógrafo', 'sesión de fotos', 'camarógrafo', 'photographer', 'photo shoot', 'camera operator'], PERSON, {
    badge: own([body, lens], body, { solid: [body], cut: [lens] }),
  });
  FILL.photographer = BUST_FILL;
  PARTS.photographer = BUST_PARTS;
}
// A studio microphone on a short stand, carried like the professions' objects: the bust on the left and
// the microphone at the corner (centered in front of the chest, it hid the shoulders and read as a robot)
{
  const mic = sq(14.75, 12.25, 4.5, 6.5, 2.25);
  const grille = hl(15.5, 14.75, 19.25);
  const stand = vl(17, 18.75, 21.25);
  const foot = hl(21.25, 14.75, 19.25);
  add('podcaster', ['podcaster', 'locutor', 'creador de audio', 'transmisión', 'podcaster', 'podcast host', 'broadcaster'], PERSON_L, {
    badge: own([mic, grille, stand, foot], `${mic}${stand}${foot}`, { solid: [mic], cut: [grille], wire: [stand, foot] }),
  });
  FILL.podcaster = BUST_FILL;
  PARTS.podcaster = BUST_PARTS;
}
// ── Badged professions ────────────────────────────────────────────────────────────────────────
// The corner is the badge's: a profession that takes one carries its object up at the top right,
// at 75 %, beside the head (the wrench's jaw stays open at weight 2.1; the tag goes without its hole,
// which at this size ran into its edge)
const TOP_RIGHT = (ds, s = 0.75, at = [18.75, 6]) => ds.map((d) => place(d, s, [17, 16.75], at));
{
  const wrench = TOP_RIGHT(TOOL.wrench.d);
  const d = [...PERSON_L, ...wrench];
  add('technician-clock', ['llegada del técnico', 'horario de servicio', 'técnico en camino', 'technician arrival', 'service appointment', 'arrival window'], d, { badge: badge('clock') });
  FILL['technician-clock'] = { solid: [0, 1], wire: [2, 3] };
  PARTS['technician-clock'] = { ...BUST_PARTS, tool: [2, 3] };
  const tag = TOP_RIGHT([TOOL.tag.d[0]], 0.75, [18.5, 6]);
  const e = [...PERSON_L, ...tag];
  add('seller-check', ['vendedor verificado', 'vendedor confiable', 'comerciante verificado', 'verified seller', 'trusted seller', 'verified merchant'], e, { badge: badge('check') });
  FILL['seller-check'] = { solid: [0, 1, 2] };
  PARTS['seller-check'] = { ...BUST_PARTS, tool: [2] };
}

// ── Selfies, portraits and avatars ────────────────────────────────────────────────────────────
// A selfie: the bust with one arm raised, a phone held up beside the head
const PHONE = sq(16.25, 2.75, 4.75, 7.25, 1.5, BR);
const SELFIE = [...PERSON_L, line([14.75, shoulderTop(17.25)], [18.25, 10]), PHONE];
add('selfie', ['selfi', 'autorretrato', 'cámara frontal', 'verificación de identidad', 'selfie', 'front camera', 'identity check'], SELFIE);
add('selfie-check', ['selfi verificada', 'prueba de vida', 'coincide con la identificación', 'selfie verified', 'liveness check', 'photo matches id'], SELFIE, { badge: badge('check') });
for (const name of ['selfie', 'selfie-check']) {
  FILL[name] = { solid: [0, 1, 3], wire: [2] };
  PARTS[name] = { ...BUST_PARTS, arm: [2], phone: [3] };
}
// A portrait: the bust rising from the bottom edge of an upright frame with the drop's corner
{
  const d = [sq(4.75, 2.75, 14.5, 18.5, 3.5, BR), circ(12, 9.25, 3.25), arc(12, 21.25, 5.75, 180, 360).d];
  add('portrait', ['retrato', 'foto de perfil', 'foto de identificación', 'fotografía', 'portrait', 'profile picture', 'headshot'], d);
  FILL.portrait = { solid: [0], cut: [1, 2] };
  PARTS.portrait = { frame: [0], head: [1], body: [2] };
}
// Avatars: person-circle's bust (comunicacion) in a dashed ring, or in a ring drawn as far as the
// profile is complete
const AV_HEAD = circ(12, 9.5, 3.25);
const AV_BODY = 'M6.21 18.89A6.25 6.25 0 0 1 17.79 18.89';
/** The body closed along the ring below it (filled, a chord would run 2 from the ring's bottom). */
const AV_SHUT = `${AV_BODY}A9 9 0 0 1 6.21 18.89Z`;
{
  // Nine dashes, one where each shoulder meets the ring (50° and 130°)
  const dashes = Array.from({ length: 9 }, (_, i) => arc(12, 12, 9, 10 + i * 40 - 10.35, 10 + i * 40 + 10.35).d);
  const d = [AV_HEAD, AV_BODY, ...dashes];
  add('avatar-placeholder', ['sin foto', 'avatar vacío', 'sin asignar', 'lugar libre', 'avatar placeholder', 'no photo', 'unassigned'], d);
  FILL['avatar-placeholder'] = { solid: [0, AV_SHUT], wire: dashes.map((_, i) => i + 2) };
  PARTS['avatar-placeholder'] = { head: [0], body: [1], ring: dashes.map((_, i) => i + 2) };
}
{
  const ring = arc(12, 12, 9, -90, 180).d;
  const d = [ring, AV_HEAD, AV_BODY];
  add('avatar-progress', ['perfil completo', 'completar perfil', 'configuración de cuenta', 'progreso', 'profile completeness', 'complete your profile', 'account setup'], d);
  FILL['avatar-progress'] = { solid: [1, AV_SHUT], wire: [0] };
  PARTS['avatar-progress'] = { ring: [0], head: [1], body: [2] };
}
// Where a person is: lugares' map pin with the bust in place of its hole; the shoulders run out to
// the pin's outline and end on it
{
  const pinD = lugares.icons['map-pin'].d[0];
  const C = [12, 17];
  const r = 4.5;
  const A = [16.95, 15.2];
  const tip = [12, 20.15];
  let [lo, hi] = [0, 1];
  const at = (t) => [A[0] + (tip[0] - A[0]) * t, A[1] + (tip[1] - A[1]) * t];
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (Math.hypot(at(m)[0] - C[0], at(m)[1] - C[1]) > r) lo = m;
    else hi = m;
  }
  const hitR = at(lo);
  const a = (Math.atan2(hitR[1] - C[1], hitR[0] - C[0]) * 180) / Math.PI;
  const body = arc(...C, r, 180 - a, 360 + a).d;
  const d = [pinD, circ(12, 7.75, 2), body];
  add('map-pin-person', ['ubicación de una persona', 'ubicación en vivo', 'punto de encuentro', 'contacto', 'person location', 'live location', 'meet here'], d);
  FILL['map-pin-person'] = { solid: [0], cut: [1, 2] };
  PARTS['map-pin-person'] = { pin: [0], head: [1], body: [2] };
}

// ── Two and more: busts ───────────────────────────────────────────────────────────────────────
// Face to face: two people seated across a small table, each leaning a forearm on it (two busts in
// profile did not show which way they faced at 18 px; the seated figures do)
{
  const S = [5.25, 10.5];
  const P = [5.25, 16];
  const K = [9, 16];
  const left = figure({ H: headAt(S, 6), S, P, legs: [[P, K, [K[0], 21.25]]], arms: [[S, [7.25, 13.25], [10, 13]]] });
  const table = [hl(13, 10, 14), vl(12, 13, 21.25)];
  const d = [...left, ...left.map((p) => flipPath(p)), ...table];
  add('face-to-face', ['cara a cara', 'en persona', 'diálogo', 'asesoría', 'face to face', 'in person', 'counseling'], d);
  FILL['face-to-face'] = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7, 8, 9] };
  PARTS['face-to-face'] = { first: [0, 1, 2, 3], second: [4, 5, 6, 7], table: [8, 9] };
}
/** People in rows: the ones in `back` cut 3 short of the closed shapes of the ones in `front`. */
const rows = (back, front) => settle([...back.map((d) => behind(d, front.map(shut))).filter((d) => d), ...front], 3);
// A large group: comunicacion's people grown to two rows, three behind and two in front
{
  const back = [-6.5, 0, 6.5].flatMap((dx) => personAt(0.5, dx, -4.75));
  const front = [-5.43, 5.43].flatMap((dx) => personAt(0.55, dx, 0));
  const d = rows(back, front);
  add('people-group', ['grupo grande', 'reserva de grupo', 'equipo grande', 'cinco o más', 'people group', 'group booking', 'big team'], d);
  FILL['people-group'] = { solid: d.map((_, i) => i).slice(-4), lines: d.map((_, i) => i).slice(0, -4) };
  PARTS['people-group'] = { back: d.map((_, i) => i).slice(0, -4), front: d.map((_, i) => i).slice(-4) };
}
// A crowd: rows of heads and shoulders packed together, the back row running off the edges
{
  const bust = (cx, hy, hr, base, sr) => [circ(cx, hy, hr), arc(cx, base, sr, 180, 360).d];
  const front = [5.5, 12, 18.5].flatMap((x) => bust(x, 13.5, 2, 21.25, 3.25));
  const back = [2.25, 8.75, 15.25, 21.75].flatMap((x) => bust(x, 5.75, 1.75, 13.25, 3.25));
  const inside = (p) => p[0] >= 2 && p[0] <= 22;
  const fronts = [0, 2, 4].flatMap((i) => [front[i], shut(front[i + 1])]);
  const backs = back.map((d) => behind(clip(d, inside), fronts)).filter((d) => d);
  const d = [...backs, ...front];
  const n = backs.length;
  const fill = { solid: [n, `${front[1]}Z`, n + 2, `${front[3]}Z`, n + 4, `${front[5]}Z`], lines: backs.map((_, i) => i) };
  add('crowd', ['multitud', 'lugar concurrido', 'aglomeración', 'mucha gente', 'crowd', 'busy place', 'mass gathering'], d);
  FILL.crowd = fill;
  PARTS.crowd = { back: backs.map((_, i) => i), front: front.map((_, i) => n + i) };
}
// A family: two adults behind and a child in front between them
{
  const adults = [-5.5, 5.5].flatMap((dx) => personAt(0.64, dx, -3));
  const child = personAt(0.48, 0, 0);
  const d = rows(adults, child);
  add('family', ['familia', 'plan familiar', 'cuenta familiar', 'miembros de la familia', 'family', 'family plan', 'family members'], d);
  add('family-plus', ['agregar familiar', 'invitar al plan familiar', 'nuevo miembro', 'add family member', 'invite to family plan'], d, { badge: badge('plus') });
  for (const name of ['family', 'family-plus']) {
    FILL[name] = { solid: d.map((_, i) => i).slice(-2), lines: d.map((_, i) => i).slice(0, -2) };
    PARTS[name] = { adults: d.map((_, i) => i).slice(0, -2), child: d.map((_, i) => i).slice(-2) };
  }
}
// A family tree: two busts at the top joined by a line, a branch down to one below
{
  const bust = (cx, hy) => [circ(cx, hy, 1.5), arc(cx, hy + 6.6, 2.75, 180, 360).d];
  const d = [...bust(6, 3.5), ...bust(18, 3.5), hl(10.1, 8.75, 15.25), vl(12, 10.1, 12.6), ...bust(12, 14.1)];
  add('family-tree', ['árbol genealógico', 'genealogía', 'ascendencia', 'parientes', 'family tree', 'ancestry', 'relatives'], d);
  FILL['family-tree'] = { solid: [0, `${d[1]}Z`, 2, `${d[3]}Z`, 6, `${d[7]}Z`], wire: [4, 5] };
  PARTS['family-tree'] = { parents: [0, 1, 2, 3], branch: [4, 5], child: [6, 7] };
}
// A guardian: the bust and, in front of it at its right, a child's
{
  const d = rows(personAt(0.85, 3, -1.25), personAt(0.56, -5, 0));
  add('guardian', ['tutor', 'padre o madre', 'dependientes', 'cuenta supervisada', 'guardian', 'parent account', 'dependents'], d);
  FILL.guardian = { solid: d.map((_, i) => i).slice(-2), lines: d.map((_, i) => i).slice(0, -2) };
  PARTS.guardian = { adult: d.map((_, i) => i).slice(0, -2), child: d.map((_, i) => i).slice(-2) };
}

// ── Fill, parts, variants, mirroring and motion ──────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : i));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// Directional: whatever faces or moves one way (the figures in profile, the line, the walkers) flips
// in right-to-left languages; front views, busts and the professions' objects keep their side
for (const name of [
  'figure-sitting', 'figure-kneeling', 'figure-lifting', 'figure-carrying', 'figure-pushing', 'figure-falling',
  'figure-entering', 'figure-exiting', 'figure-working', 'elder', 'elder-alert', 'elder-walker',
  'generations', 'caregiver', 'traveler', 'patient', 'waiting-line', 'skip-the-line', 'foot-traffic',
])
  icons[name].mirror = true;

// Values: the profile's ring drawn as far as it is complete
icons['avatar-progress'].value = { draw: ['ring'] };

// Motion: the walkers and the line move ahead, the jumper and the celebrating figure hop, the hand
// waves from the elbow, the falling figure tips from its planted foot, the pin bounces
const FIGURE = ['head', 'body', 'legs', 'arms'];
for (const name of ['figure-entering', 'figure-exiting', 'figure-carrying']) icons[name].motion = { effect: 'slide', parts: FIGURE, vector: [1.5, 0] };
for (const name of ['traveler', 'caregiver', 'foot-traffic', 'figure-pushing']) icons[name].motion = { effect: 'slide', vector: [1.5, 0] };
for (const name of ['elder', 'elder-walker']) icons[name].motion = { effect: 'slide', vector: [1, 0] };
icons['waiting-line'].motion = { effect: 'slide', parts: ['first', 'second', 'third'], vector: [1.25, 0] };
icons['figure-jumping'].motion = { effect: 'bounce', parts: FIGURE, vector: [0, -2] };
icons['figure-arms-raised'].motion = { effect: 'bounce', vector: [0, -1.5] };
icons['figure-waving'].motion = { effect: 'wiggle', parts: ['hand'], origin: [14.38, 9.57] };
icons['figure-falling'].motion = { effect: 'wiggle', parts: FIGURE, origin: [16.25, 19.75] };
icons['skip-the-line'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['map-pin-person'].motion = { effect: 'bounce', vector: [0, -2] };
icons.volunteer.motion = { effect: 'beat', parts: ['heart'], origin: [12, 18.25] };
icons['figure-lifting'].motion = { effect: 'bounce', parts: ['arms', 'box'], vector: [0, -1.25] };
for (const name of ['child-alert', 'elder-alert']) icons[name].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };

// Variants: with a badge (the engine's or a profession's object) the enclosures stop reading at 58 %
// and the slash would cut through it, as in lugares; the avatars come enclosed already, the portrait
// is its own frame
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };
for (const name of ['avatar-placeholder', 'avatar-progress']) icons[name].variants = { circle: false, square: false };
icons.portrait.variants = { square: false };

export default { category: 'personas', label: 'Personas y roles', icons };
