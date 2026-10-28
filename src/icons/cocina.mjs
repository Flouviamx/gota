// Cocina y utensilios (kitchen and cooking): cutlery and kitchen tools, cookware, bakeware and
// grills, storage, tableware, cooking methods, doneness and heat, recipes and meal planning.
// Everything is computed with the engine (engine/geometry.mjs) on the rules in DESIGN.md.
//
// One piece per object, reused by its family: the fork is lugares' (from its `utensils`, which this
// category adopts), the pot (`cooking-pot`) and the pan (`frying-pan`) carry
// their states drawn on them, a recipe is one card, a stored meal is one container. Knives are
// kitchen tools, drawn on the diagonal from the handle (bottom left) to the tip. Containers (the
// pot, the jars, the boxes, the cards) keep the signature's square bottom-right corner; round
// tableware (plates, bowls, pans) doesn't. A piece that passes behind another stops 3 center to
// center from it (behind(), as rrhh and social draw it): nothing is trimmed by hand, and badges are
// the engine's.
import { arc, badge, circ, dot, f, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;
const BR = { square: ['br'] };
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Just the `A…` segment of an engine arc, to chain it inside a path. */
const arcTo = (...a) => arc(...a).d.replace(/^M[^A]+/, '');
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Moves `d` by (dx, dy). */
const move = (d, dx, dy) => transform(d, 1, dx, dy);

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
/** Ellipse with semi-axes rx, ry turned `tilt` degrees, as four cubics (lugares' `ell`). */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const Q = (x, y) => {
    const [a, b] = rot([x, y], [0, 0], tilt);
    return [c[0] + a, c[1] + b];
  };
  return `M${P(Q(rx, 0))}C${P(Q(rx, k * ry))} ${P(Q(k * rx, ry))} ${P(Q(0, ry))}C${P(Q(-k * rx, ry))} ${P(Q(-rx, k * ry))} ${P(Q(-rx, 0))}C${P(Q(-rx, -k * ry))} ${P(Q(-k * rx, -ry))} ${P(Q(0, -ry))}C${P(Q(k * rx, -ry))} ${P(Q(rx, -k * ry))} ${P(Q(rx, 0))}Z`;
}
/**
 * An arc of the ellipse (c, rx, ry) from a0 to a1 degrees (clockwise if a1 > a0), as cubics: as
 * cubics, behind() can cut it (its own reading of `A` takes every arc as circular).
 */
function ellArc(c, rx, ry, a0, a1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90));
  const step = ((a1 - a0) / n) * (Math.PI / 180);
  const k = (4 / 3) * Math.tan(step / 4);
  const at = (t) => [c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t)];
  const tan = (t) => [-rx * Math.sin(t), ry * Math.cos(t)];
  let t = (a0 * Math.PI) / 180;
  let o = `M${P(at(t))}`;
  for (let i = 0; i < n; i++) {
    const [p0, p3] = [at(t), at(t + step)];
    const [d0, d3] = [tan(t), tan(t + step)];
    o += `C${P([p0[0] + k * d0[0], p0[1] + k * d0[1]])} ${P([p3[0] - k * d3[0], p3[1] - k * d3[1]])} ${P(p3)}`;
    t += step;
  }
  return o;
}
/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
}

// ── Paths as segments (rrhh's): behind() keeps what shows of a stroke behind closed shapes ──
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
 * The part of `d` that shows behind the closed shapes `fronts`: whatever lies inside them or
 * closer than `gap` (center to center) to their outline is dropped, and so is any piece left
 * shorter than `min`. 3 center to center is the set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3, min = 2) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep, min);
}

/** Moves a set of paths so their outline's box sits inside the live area, centered where it has room. */
function fit(ds, box = [2.75, 2.75, 21.25, 21.25]) {
  const pts = ds.flatMap((d) => samples(d).flat());
  const [x0, y0, x1, y1] = [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
  const q = (n) => Math.round(n * 4) / 4;
  const dx = q((box[0] + box[2]) / 2 - (x0 + x1) / 2);
  const dy = q((box[1] + box[3]) / 2 - (y0 + y1) / 2);
  return { ds: ds.map((d) => move(d, dx, dy)), at: (p) => [p[0] + dx, p[1] + dy] };
}

const icons = {};
/** Seams the fill knocks out, kept where an icon is drawn (by name): see the Fill block below. */
const SEAM = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
/** The badges' center (DESIGN.md › Badges): pivots for the badge motions. */
const BC = [17.25, 17.25];

// ── Cutlery ───────────────────────────────────────────────────────────────────────────────────
// lugares' `utensils`: the fork is three tines in a U of radius 3 with the handle rising from the
// middle one (a fourth tine would need a head 9 wide to keep 3 between tines).
const fork = (x, top = 2.75, bottom = 21.25, neck = 7) => [`M${f(x - 3)} ${f(top)}V${f(neck)}a3 3 0 0 0 6 0V${f(top)}`, vl(x, top, bottom)];
/** The spoon: an oval bowl on a slim handle. */
const spoon = (x = 12, top = 2.75, bottom = 21.25, rx = 3.5, ry = 4.75) => [ell([x, top + ry], rx, ry), vl(x, top + 2 * ry, bottom)];

// The chef's knife, drawn level (handle left, edge down) and turned onto the diagonal: a broad
// blade whose edge curves up to the tip, its handle in line with the spine and resting on the heel.
const KNIFE_TILT = -45;
const CHEF = [
  `M7.5 9.75H17C20 9.75 22.5 10.1 24.25 10.75C21.5 13.4 18.5 14.75 14.5 14.75H8.5A1 1 0 0 1 7.5 13.75Z`,
  `M7.5 9.75H0.5A1.75 1.75 0 0 0 0.5 13.25H7.5`,
].map((d) => turnPath(d, KNIFE_TILT));

add('fork', ['tenedor', 'cubierto', 'comer', 'fork', 'cutlery', 'eat'], fork(12));
add('spoon', ['cuchara', 'cubierto', 'sopa', 'postre', 'spoon', 'cutlery', 'soup'], spoon());
add('knife', ['cuchillo', 'cuchillo de chef', 'picar', 'cocina', 'knife', 'chef knife', 'prep'], CHEF);
{
  // Bread knife: a long straight blade with a rounded tip and an edge of scallops, the same handle.
  const scallops = [];
  for (let x = 22.25; x > 9; x -= 2.25) scallops.push(`A1.36 1.36 0 0 0 ${f(x - 2.25)} 13.5`);
  const blade = `M7.5 10H22.25A1.75 1.75 0 0 1 22.25 13.5${scallops.join('')}H8.5A1 1 0 0 1 7.5 12.5Z`;
  add('bread-knife', ['cuchillo de pan', 'sierra', 'rebanar', 'pan', 'bread knife', 'serrated', 'slice'], [blade, `M7.5 10H0.5A1.75 1.75 0 0 0 0.5 13.5H7.5`].map((d) => turnPath(d, KNIFE_TILT)));
}
// Cleaver: a tall blade with its hanging hole 3 from the spine and the heel, and the handle in line
// with the spine.
add('cleaver', ['cuchilla', 'carnicero', 'hacha de cocina', 'cortar', 'cleaver', 'butcher', 'chop'], [
  roundpoly([[2.75, 4.75], [14.5, 4.75], [14.5, 17.5], [2.75, 16.5]], [1.5, 0.75, 1, 1.5]),
  circ(7.25, 9.25, 1.25),
  `M14.5 4.75H19.5A1.75 1.75 0 0 1 19.5 8.25H14.5`,
]);
// Chopsticks: two tapering sticks, their tips 3 apart.
add('chopsticks', ['palillos', 'comida asiática', 'sushi', 'cubiertos', 'chopsticks', 'asian food'], [
  roundpoly([[6.5, 2.75], [9.25, 2.75], [10.75, 21.25], [10.25, 21.25]], [0.75, 0.75, 0.25, 0.25]),
  roundpoly([[14.75, 2.75], [17.5, 2.75], [13.75, 21.25], [13.25, 21.25]], [0.75, 0.75, 0.25, 0.25]),
]);
// Soup spoon (renge), in profile: a deep flat-bottomed bowl whose short thick handle rises at 45°.
add('soup-spoon', ['cuchara china', 'ramen', 'sopa', 'caldo', 'soup spoon', 'ramen', 'broth'], [
  roundpoly([[2.75, 11.25], [13.25, 11.25], [19, 5.5], [21.25, 7.75], [16.5, 12.5], [15.25, 18], [6.5, 18]], [0.5, 0.75, 1.5, 1.5, 1.5, 1.5, 4.5]),
]);
{
  // Ladle: the deep cup (a half circle under its rim) and the handle rising from the rim to a hook.
  const E = [17.5, 4.5];
  const dir = [5.25, -9.25];
  const k = Math.hypot(...dir);
  const nrm = [-dir[1] / k, dir[0] / k];
  const C = [E[0] + 1.75 * nrm[0], E[1] + 1.75 * nrm[1]];
  const a0 = (Math.atan2(E[1] - C[1], E[0] - C[0]) * 180) / Math.PI;
  add('ladle', ['cucharón', 'servir', 'sopa', 'porción', 'ladle', 'serve', 'soup'], [
    `M2.75 13.75H13.25A5.25 5.25 0 0 1 2.75 13.75Z`,
    `M12.25 13.75L${P(E)}${arcTo(...C, 1.75, a0, a0 + 200)}`,
  ]);
}
// Turner: a wide head with three slots 3 apart, a neck and the handle.
add('spatula', ['espátula', 'voltear', 'freír', 'pala', 'spatula', 'turner', 'flip'], [
  sq(5.25, 2.75, 13.5, 8.75, 2.5),
  vl(9, 5.75, 8.5),
  vl(12, 5.75, 8.5),
  vl(15, 5.75, 8.5),
  vl(12, 11.5, 14.25),
  capsule(10.5, 14.25, 3, 7),
]);
// Silicone scraper: a paddle with one curved corner, on a straight handle.
add('rubber-spatula', ['espátula de silicón', 'raspar', 'envolver', 'repostería', 'rubber spatula', 'scraper', 'baking'], [
  roundpoly([[7.25, 2.75], [16.75, 2.75], [16.75, 12.25], [7.25, 12.25]], [1.25, 5.5, 1.25, 1.25]),
  vl(12, 12.25, 21.25),
]);
// Slotted spoon: a larger bowl with three short slots stacked along it.
add('slotted-spoon', ['cuchara ranurada', 'escurrir', 'colar', 'servir', 'slotted spoon', 'drain', 'serve'], [
  ell([12, 9], 5.4, 6.25),
  hl(11, 13, 6),
  hl(10.75, 13.25, 9),
  hl(11, 13, 12),
  vl(12, 15.25, 21.25),
]);
// Whisk: two looped wires and the one seen edge-on, gathered into the handle.
add('whisk', ['batidor', 'batir', 'huevos', 'repostería', 'whisk', 'whip', 'beat'], [
  `M12 14C5.25 10.25 5.5 2.75 12 2.75S18.75 10.25 12 14`,
  `M12 14C8.75 11.25 8.75 5.75 12 5.75S15.25 11.25 12 14`,
  vl(12, 2.75, 14),
  capsule(10.5, 14, 3, 7.25),
]);
// Tongs: the loop at the hinge and the two arms, their scalloped tips turned toward each other.
add('tongs', ['pinzas', 'asar', 'servir', 'voltear', 'tongs', 'grill', 'serve'], [
  circ(12, 4.5, 1.75),
  `M10.78 5.75L7.25 17.25C6.75 19 7.75 20.75 9.75 20.75`,
  `M13.22 5.75L16.75 17.25C17.25 19 16.25 20.75 14.25 20.75`,
]);
// Rolling pin on the diagonal: the body and a handle at each end.
add('rolling-pin', ['rodillo', 'amasar', 'masa', 'repostería', 'rolling pin', 'dough', 'pastry'], [
  turnPath(sq(5.25, 9.4, 13.5, 5.2, 1.6), -45),
  line(turn1([18.75, 12]), turn1([23, 12])),
  line(turn1([5.25, 12]), turn1([1, 12])),
]);
function turn1(p, deg = -45) {
  return rot(p, [12, 12], deg);
}
// Box grater: the tapered box, the loop handle and two rows of holes.
add('grater', ['rallador', 'rallar', 'queso', 'verduras', 'grater', 'grate', 'cheese'], [
  roundpoly([[6.5, 6.5], [17.5, 6.5], [19.5, 21.25], [4.5, 21.25]], [1.5, 1.5, 1.5, 1.5]),
  `M9.75 6.5V5A2.25 2.25 0 0 1 14.25 5V6.5`,
  ...[11.25, 15.25].flatMap((y) => [9, 12, 15].map((x) => dot(x, y, 0.3))),
]);
// Y-peeler: the frame, the slotted blade on its two pins and the handle.
add('peeler', ['pelador', 'pelar', 'verduras', 'preparar', 'peeler', 'peel', 'prep'], [
  `M5.25 3.25V6.25A5.25 5.25 0 0 0 10.5 11.5H13.5A5.25 5.25 0 0 0 18.75 6.25V3.25`,
  capsule(8.25, 3.25, 7.5, 3),
  hl(5.25, 8.25, 4.75),
  hl(15.75, 18.75, 4.75),
  `M10.5 11.5V19.75A1.5 1.5 0 0 0 13.5 19.75V11.5`,
]);
// Cutting board: the board and its handle as one outline, the hanging hole in the handle.
add('cutting-board', ['tabla de picar', 'picar', 'preparar', 'tabla', 'cutting board', 'chopping board', 'prep'], [
  roundpoly([[2.75, 5.5], [15.5, 5.5], [15.5, 8.5], [21.25, 8.5], [21.25, 15.5], [15.5, 15.5], [15.5, 18.5], [2.75, 18.5]], [3, 1.25, 1, 3.5, 3.5, 1, 1.25, 3]),
  dot(18, 12),
]);
// Measuring jug: the jug (the spout at its top left, the signature's corner), its handle and three
// graduation ticks up its wall.
const JUG = [
  roundpoly([[3, 4.75], [16, 4.75], [16, 21], [5.25, 21], [5.25, 8.5]], [0.6, 0.75, 0, 2.75, 1.25]),
  rline([[16, 8], [20.25, 8], [20.25, 15.75], [16, 15.75]], [0, 2, 2, 0]),
  hl(5.25, 9.25, 10.5),
  hl(5.25, 7.75, 13.75),
  hl(5.25, 9.25, 17),
];
add('measuring-cup', ['taza medidora', 'medir', 'jarra', 'líquidos', 'measuring cup', 'measure', 'jug'], JUG);
add('measuring-cup-sync', ['convertir unidades', 'tazas a gramos', 'métrico', 'convert units', 'cups to grams', 'metric'], JUG, { badge: badge('sync') });
{
  // Measuring spoons: three spoons of descending size fanned out from one ring, each an oval bowl
  // along its handle.
  const R = [5, 19];
  const d = [circ(...R, 1.5)];
  for (const [a, dist, along, across] of [
    [-82, 12.75, 3.9, 2.5],
    [-46, 12.75, 3.3, 2.15],
    [-10, 12.25, 2.75, 1.85],
  ]) {
    d.push(ell(polar(...R, dist, a), along, across, a), line(polar(...R, 1.5, a), polar(...R, dist - along, a)));
  }
  add('measuring-spoons', ['cucharas medidoras', 'cucharadita', 'cucharada', 'medir', 'measuring spoons', 'teaspoon', 'tablespoon'], d);
}
// Can opener: the cutting wheel on its hub, the butterfly key standing on its shaft beside it, and
// the two long handles held together under the wheel. (Splayed handles and a level key read as a
// figure with legs and an arm.)
{
  const C = [8.75, 7];
  const R = 3.5;
  const foot = (x) => [x, C[1] + Math.sqrt(R * R - (x - C[0]) ** 2)];
  add('can-opener', ['abrelatas', 'lata', 'abrir', 'conservas', 'can opener', 'tin opener', 'open'], [
    circ(...C, R),
    dot(...C),
    hl(C[0] + R, 15.25, C[1]),
    capsule(15.25, 2.75, 3, 8.5),
    line(foot(C[0] - 1.5), [C[0] - 2.5, 21.25]),
    line(foot(C[0] + 1.5), [C[0] + 2.5, 21.25]),
  ]);
}
{
  // Pizza cutter: the wheel rolling at the bottom left, its hub, and the neck from the hub to the
  // handle rising on the diagonal.
  const C = [8.25, 15.25];
  const handle = turnPath(capsule(C[0] + 7.25, C[1] - 1.625, 8.25, 3.25), -45, C);
  add('pizza-cutter', ['cortador de pizza', 'rueda', 'pizzería', 'cortar', 'pizza cutter', 'pizza wheel', 'cut'], [
    circ(...C, 5.75),
    dot(...C),
    line(C, rot([C[0] + 7.25, C[1]], C, -45)),
    handle,
  ]);
}
// Pizza peel from above: the wide paddle with a straight front and short shoulders, and the long
// handle.
add('pizza-peel', ['pala para pizza', 'horno', 'pizzería', 'pan', 'pizza peel', 'oven', 'bread'], [
  roundpoly([[3.25, 2.75], [20.75, 2.75], [20.75, 11.25], [15.25, 14], [8.75, 14], [3.25, 11.25]], [2.25, 2.25, 1.75, 1, 1, 1.75]),
  `M10.5 14V19.75A1.5 1.5 0 0 0 13.5 19.75V14`,
]);
{
  // Ice cream scoop: the half-sphere cup upright under its rim with a ball of ice cream in it (the
  // scoop at work: a cup on its own read as a blade), and the round handle leaving the cup's side
  // on the diagonal, on a short neck.
  const C = [15.5, 8];
  const R = 5.25;
  const u = [-Math.SQRT1_2, Math.SQRT1_2];
  const N0 = polar(...C, R, 135);
  const H0 = [N0[0] + u[0] * 2.25, N0[1] + u[1] * 2.25];
  const handle = turnPath(capsule(0, -1.5, 9, 3), 135, [0, 0]);
  const placed = fit([
    `M${f(C[0] - R)} ${f(C[1])}H${f(C[0] + R)}A${f(R)} ${f(R)} 0 0 1 ${f(C[0] - R)} ${f(C[1])}Z`,
    arc(...C, 3.75, 180, 360).d,
    line(N0, H0),
    move(handle, H0[0], H0[1]),
  ]);
  add('ice-cream-scoop', ['cuchara para helado', 'sacabolas', 'helado', 'porcionar', 'ice cream scoop', 'scoop', 'portion'], placed.ds);
  // The ball sits on the cup's rim: in the fill, the rim parts them
  SEAM['ice-cream-scoop'] = line(placed.at([C[0] - R - 1, C[1]]), placed.at([C[0] + R + 1, C[1]]));
}
// Pepper mill: the knob on the turning cap, the waisted body widening to its base.
add('pepper-mill', ['molinillo', 'pimienta', 'sazonar', 'especias', 'pepper mill', 'grinder', 'season'], [
  `M7.75 9.5A4.25 4.25 0 0 1 16.25 9.5Z`,
  dot(12, 4.25),
  `M8.25 9.5C8.25 12 10 13 10 15.25S7.75 18.5 7.75 21.25H16.25C16.25 18.5 14 17.5 14 15.25S15.75 12 15.75 9.5`,
]);
{
  // Mortar and pestle (molcajete): the bowl under its rim on a short foot, and the club-shaped
  // pestle leaning in it, its lower end lost behind the rim.
  const RIM = 11.75;
  const A0 = [12.75, RIM];
  const a = (-55 * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)];
  const v = [-u[1], u[0]];
  const at = (s, t) => [A0[0] + s * u[0] + t * v[0], A0[1] + s * u[1] + t * v[1]];
  // Each side, extended down to the rim line
  const side = (t0, t1) => {
    const [p, q] = [at(0, t0), at(7, t1)];
    const k = (RIM - p[1]) / (q[1] - p[1]);
    return [[p[0] + (q[0] - p[0]) * k, RIM], q];
  };
  const [L0, L1] = side(-1.3, -2.25);
  const [R0, R1] = side(1.3, 2.25);
  const pestle = `M${P(L0)}L${P(L1)}A2.25 2.25 0 0 1 ${P(R1)}L${P(R0)}`;
  const footY = RIM + 6.5 * Math.sqrt(1 - (3.5 / 9.25) ** 2);
  add('mortar-pestle', ['molcajete', 'mortero', 'moler', 'salsa', 'especias', 'mortar and pestle', 'grind'], [
    `M2.75 ${RIM}H21.25A9.25 6.5 0 0 1 2.75 ${RIM}Z`,
    `M8.5 ${f(footY)}L8.25 21.25H15.75L15.5 ${f(footY)}`,
    pestle,
  ]);
  icons['mortar-pestle'].fill = { solid: [icons['mortar-pestle'].d[0], shut(pestle)], wire: [icons['mortar-pestle'].d[1]], cut: [line([L0[0] - 1, RIM], [R0[0] + 1, RIM])] };
}
{
  // Piping bag: the cone gathered and twisted shut at its wide end, tipped toward its nozzle, and a
  // swirl of frosting under the nozzle.
  const T = (d) => turnPath(d, 40, [12, 12]);
  const bag = roundpoly([[10.5, 16.5], [8, 6.25], [10.75, 4.75], [10.25, 2.75], [13.75, 2.75], [13.25, 4.75], [16, 6.25], [13.5, 16.5]], [0, 1.75, 0.5, 0.5, 0.5, 0.5, 1.75, 0]);
  const nozzle = roundpoly([[10.5, 16.5], [13.5, 16.5], [12.75, 19.25], [11.25, 19.25]], [0, 0, 0.6, 0.6]);
  const placed = fit([T(bag), T(nozzle)], [5.75, 2.75, 21.25, 16.25]);
  const end = placed.at(rot([12, 19.25], [12, 12], 40));
  const swirl = `M${f(end[0] - 3)} 21.25A3 2.5 0 0 1 ${f(end[0] + 3)} 21.25Z`;
  add('piping-bag', ['manga pastelera', 'decorar', 'betún', 'repostería', 'piping bag', 'frosting', 'decorate'], [...placed.ds, swirl]);
  SEAM['piping-bag'] = line(placed.at(rot([9.5, 16.5], [12, 12], 40)), placed.at(rot([14.5, 16.5], [12, 12], 40)));
}
// Citrus reamer: the ridged dome on its shallow dish, the dish's lip running out into a spout.
add('citrus-squeezer', ['exprimidor', 'limón', 'jugo', 'cítricos', 'citrus squeezer', 'juicer', 'lemon'], [
  roundpoly([[2.75, 15], [19, 15], [21.25, 13.75], [18.25, 19.5], [5.75, 19.5]], [0.75, 0.5, 0.5, 1.75, 1.75]),
  `M6.75 15C6.75 9.75 9.5 4.75 12 4.75S17.25 9.75 17.25 15`,
  `M12 4.75C10.75 7.25 10 10.75 10 15`,
  `M12 4.75C13.25 7.25 14 10.75 14 15`,
]);
// Potato masher: the handle, its shaft and the zigzag wire head hanging from it.
add('masher', ['machacador', 'puré', 'aplastar', 'papas', 'masher', 'mash', 'puree'], [
  capsule(10.5, 2.75, 3, 7.75),
  vl(12, 10.5, 14.75),
  rline([[4.25, 21], [6.83, 14.75], [9.42, 21], [12, 14.75], [14.58, 21], [17.17, 14.75], [19.75, 21]], [0, 0.75, 0.75, 0, 0.75, 0.75, 0]),
]);
// Meat mallet: the square head, its left face toothed, on a straight handle.
add('meat-mallet', ['mazo para carne', 'ablandador', 'aplanar', 'carne', 'meat mallet', 'tenderizer', 'pound'], [
  roundpoly([[6.5, 3], [19.5, 3], [19.5, 9.75], [6.5, 9.75], [4.25, 8.06], [6.5, 6.38], [4.25, 4.69]], [1, 1.5, 1.5, 0.75, 0.5, 0.5, 0.5]),
  `M10.5 9.75V19.75A1.5 1.5 0 0 0 13.5 19.75V9.75`,
]);
// Probe thermometer: the dial with its needle, on the long probe pointing down.
add('meat-thermometer', ['termómetro de carne', 'temperatura interna', 'término', 'seguridad alimentaria', 'meat thermometer', 'probe', 'doneness'], [
  circ(12, 8.25, 5.5),
  line([12, 8.25], polar(12, 8.25, 2.5, -45)),
  vl(12, 13.75, 21.25),
]);
// Colander: the bowl under its rim, the two handles at the rim's ends, the foot ring and a row of
// holes.
const COLANDER_RIM = 9;
const colander = (dy = 0) => {
  const y = COLANDER_RIM + dy;
  const footY = y + 7 * Math.sqrt(1 - (3.5 / 7.25) ** 2);
  return [
    `M4.75 ${f(y)}H19.25A7.25 7 0 0 1 4.75 ${f(y)}Z`,
    hl(2.25, 4.75, y),
    hl(19.25, 21.75, y),
    `M8.5 ${f(footY)}L8.25 ${f(y + 10)}H15.75L15.5 ${f(footY)}`,
    ...[9, 12, 15].map((x) => dot(x, y + 3, 0.3)),
  ];
};
add('colander', ['colador', 'escurridor', 'escurrir', 'pasta', 'colander', 'drain', 'strain'], colander());
{
  // Strainer: the hemispherical mesh under its rim, its wires crossing (three down, one across), on
  // a long straight handle.
  const [c, r, y] = [9.25, 6.5, 9];
  const down = (x) => vl(x, y, y + Math.sqrt(r * r - (x - c) ** 2));
  const w = Math.sqrt(r * r - 9);
  add('strainer', ['colador fino', 'tamiz', 'colar', 'salsa', 'strainer', 'sieve', 'mesh'], [
    `M${f(c - r)} ${y}H${f(c + r)}A${r} ${r} 0 0 1 ${f(c - r)} ${y}Z`,
    down(c - 3),
    down(c),
    down(c + 3),
    hl(c - w, c + w, y + 3),
    hl(c + r, 21.25, y),
  ]);
}
// Flour sifter: the cup (the signature's corner) narrowing to its mesh band, the crank on its side
// and a sprinkle of flour falling below, fine as the calendar's days. (Three full dots under the cup
// read as the wheels of a shopping cart.)
add('sifter', ['tamizador', 'cernidor', 'harina', 'repostería', 'sifter', 'flour', 'sift'], [
  roundpoly([[4.75, 3.25], [16.75, 3.25], [15.75, 13.75], [5.75, 13.75]], [1.5, 1.5, 0, 1.75]),
  hl(5.04, 16.04, 10.75),
  rline([[16.47, 6.25], [20.75, 6.25], [20.75, 2.75]], [0, 1.25, 0]),
  ...[[7.75, 17], [10.75, 17], [13.75, 17], [9.25, 20.25], [12.25, 20.25]].map(([x, y]) => dot(x, y, 0.3)),
]);

// ── Kitchen wear, furniture and storage ─────────────────────────────────────────────────────
/** Intersections of two circles [x, y, r] (both). */
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
const angOf = ([cx, cy], [x, y]) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
/** Clockwise arc along circle [x, y, r] from p to q, as an `A…` segment. */
function cw([cx, cy, r], p, q) {
  const span = (((angOf([cx, cy], q) - angOf([cx, cy], p)) % 360) + 360) % 360;
  return `A${f(r)} ${f(r)} 0 ${span > 180 ? 1 : 0} 1 ${P(q)}`;
}
/**
 * The toque: a puff of three circles over straight sides that come down to `bottom` at x0 and x1.
 * Returns the outline closed along the bottom (rounded `rb`) or, with rb null, open at the bottom.
 */
function toque(x0, x1, bottom, L, M, R, rb = 1.25) {
  const yL = L[1] + Math.sqrt(L[2] ** 2 - (x0 - L[0]) ** 2);
  const yR = R[1] + Math.sqrt(R[2] ** 2 - (x1 - R[0]) ** 2);
  const up = (pts) => pts.sort((a, b) => a[1] - b[1])[0];
  const LM = up(meet(L, M));
  const MR = up(meet(M, R));
  const top = `M${P([x0, yL])}${cw(L, [x0, yL], LM)}${cw(M, LM, MR)}${cw(R, MR, [x1, yR])}`;
  return `${top}V${f(bottom - rb)}A${f(rb)} ${f(rb)} 0 0 1 ${P([x1 - rb, bottom])}H${f(x0 + rb)}A${f(rb)} ${f(rb)} 0 0 1 ${P([x0, bottom - rb])}Z`;
}
add('oven-mitt', ['guante de cocina', 'manopla', 'horno', 'caliente', 'oven mitt', 'pot holder', 'hot'], [
  `M8.75 17.25L8.25 14.5C5.75 13.75 3.75 11.75 3.75 9.75A1.75 1.75 0 0 1 7 8.85L7.25 9.5V8A4.75 4.75 0 0 1 16.75 8L15.25 17.25`,
  sq(6.25, 17.25, 11.5, 4, 1.25),
  circ(19.25, 19.25, 1.5),
]);
add('apron', ['mandil', 'delantal', 'cocinar', 'clase de cocina', 'apron', 'cooking', 'kitchen staff'], [
  `M8.5 6.5H15.5V8.75C15.5 10.25 16.75 11.5 18.75 11.5L18.25 19.25A2 2 0 0 1 16.25 21.25H7.75A2 2 0 0 1 5.75 19.25L5.25 11.5C7.25 11.5 8.5 10.25 8.5 8.75Z`,
  `M9.25 6.5V6A2.75 2.75 0 0 1 14.75 6V6.5`,
  line([5.25, 11.5], [2.75, 13.75]),
  line([18.75, 11.5], [21.25, 13.75]),
  box(9, 14.25, 6, 4, 1.25),
]);
const HAT = [toque(7.25, 16.75, 20.75, [7.75, 10.5, 3.5], [12, 7.25, 4.5], [16.25, 10.5, 3.5]), hl(7.25, 16.75, 16.75)];
add('chef-hat', ['gorro de chef', 'chef', 'cocinero', 'cocina', 'chef hat', 'toque', 'cook'], HAT);
add('chef-hat-star', ['receta destacada', 'elección del chef', 'recomendado', "chef's pick", 'featured recipe', 'editor choice'], HAT, { badge: badge('star') });
{
  // The person (Núcleo's, scaled from its feet as rrhh's personAt) in a small toque: the hat rests
  // on the head, whose top it hides (the head's arc ends on the hat's band).
  const s = 0.72;
  const up = Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s);
  const hc = [12, 20.6 + (7.45 - 20.6) * s - up];
  const hr = 3.7 * s;
  const band = 9;
  const a = (Math.asin((band - hc[1]) / hr) * 180) / Math.PI;
  add('person-chef', ['chef', 'cocinero', 'personal de cocina', 'perfil de chef', 'chef', 'cook', 'kitchen staff'], [
    arc(...hc, hr, a, 180 - a).d,
    place(N.person.d[1], s, [12, 20.6]),
    toque(9, 15, band, [9.25, 6, 1.75], [12, 5, 2.25], [14.75, 6, 1.75], 0.75),
  ]);
}
{
  // Utensil holder: the crock (the signature's corner) and, standing out of it, a ladle, a whisk
  // and a turner, each meeting the rim.
  const RIM = 12.75;
  add('utensil-holder', ['utensilios', 'herramientas de cocina', 'equipo', 'portautensilios', 'utensil holder', 'kitchen tools', 'equipment'], [
    box(6, RIM, 12, 21.25 - RIM, 1.5),
    circ(4.75, 6.25, 2),
    line(polar(4.75, 6.25, 2, 60), [8.75, RIM]),
    `M11.25 9.75C9.25 7.5 9.5 2.75 11.25 2.75S13.25 7.5 11.25 9.75`,
    vl(11.25, 9.75, RIM),
    turnPath(sq(16.25, 2.75, 4.5, 5, 1.5), 12, [18.5, 5.25]),
    line(rot([18.5, 7.75], [18.5, 5.25], 12), [14.25, RIM]),
  ]);
}
{
  // Knife block: the block with its top sloping up to the back, and three handles standing out of
  // their slots, square to the top.
  const A = [3.25, 14.75];
  const B = [20.75, 9.75];
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const e = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  const u = [e[1], -e[0]];
  const stub = (sAlong, w = 2.5, len = 6) => {
    const B0 = [A[0] + e[0] * sAlong, A[1] + e[1] * sAlong];
    const at = (s, t) => [B0[0] + s * u[0] + t * e[0], B0[1] + s * u[1] + t * e[1]];
    return `M${P(at(0, -w / 2))}L${P(at(len - w / 2, -w / 2))}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${P(at(len - w / 2, w / 2))}L${P(at(0, w / 2))}`;
  };
  add('knife-block', ['bloque de cuchillos', 'juego de cuchillos', 'cuchillos', 'guardar', 'knife block', 'knife set', 'storage'], [
    roundpoly([A, B, [20.75, 21.25], [3.25, 21.25]], [1.5, 1, 0, 1.5]),
    stub(4),
    stub(9.6),
    stub(15.2),
  ]);
}
{
  // Whetstone: the stone and, above it, the knife (the chef's knife, its tip to the left) held at
  // the sharpening angle.
  const blade = `M16.5 9.75H7C4 9.75 1.5 10.1-0.25 10.75C2.5 13.4 5.5 14.75 9.5 14.75H15.5A1 1 0 0 0 16.5 13.75Z`;
  const handle = `M16.5 9.75H23.5A1.75 1.75 0 0 1 23.5 13.25H16.5`;
  const tip = (d) => move(turnPath(place(d, 0.74, [12, 12]), -14, [12, 12]), 0.5, -1.25);
  add('whetstone', ['afilar', 'piedra de afilar', 'cuchillos', 'mantenimiento', 'whetstone', 'sharpen', 'knife care'], [sq(2.75, 15.75, 18.5, 5.5, 2), tip(blade), tip(handle)]);
}
// Pantry: the cupboard (the signature's corner), its door swung open to the right, and a jar of the
// stock standing inside, shaped like canning-jar's. (Small jars and boxes on shelves read as padlocks and arches,
// and were too dense.)
const PANTRY = [
  box(3.25, 3.25, 12, 17.5, 2.5),
  rline([[15.25, 4], [19.75, 5.5], [19.75, 18.5], [15.25, 20]], [0, 1.25, 1.25, 0]),
  rline([[7.5, 13.75], [7.5, 14.25], [5.75, 16], [5.75, 20.75], [12.75, 20.75], [12.75, 16], [11, 14.25], [11, 13.75]], [0, 0.75, 1, 0, 0, 1, 0.75, 0]),
  sq(6.5, 10.75, 5.5, 3, 1),
];
add('pantry', ['despensa', 'alacena', 'inventario', 'en casa', 'pantry', 'cupboard', 'stock'], PANTRY);
add('pantry-plus', ['agregar a la despensa', 'registrar compras', 'inventario', 'add to pantry', 'groceries', 'stock'], PANTRY, { badge: badge('plus') });
// Kitchen: the lower cabinets with two doors and their knobs under the counter, the hood above.
add('kitchen', ['cocina', 'amenidades', 'cuarto', 'hogar', 'kitchen', 'amenities', 'room'], [
  roundpoly([[10.25, 2.75], [13.75, 2.75], [13.75, 5], [17.75, 8.25], [6.25, 8.25], [10.25, 5]], [0.5, 0.5, 0.75, 0.75, 0.75, 0.75]),
  hl(2.75, 21.25, 11.25),
  rline([[3.75, 11.25], [3.75, 21.25], [20.25, 21.25], [20.25, 11.25]], [0, 2, 0, 0]),
  vl(12, 11.25, 21.25),
  dot(9, 14.25),
  dot(15, 14.25),
]);
// Kitchen sink: the basin set into the counter and the tall gooseneck faucet arching over it.
add('kitchen-sink', ['tarja', 'fregadero', 'lavar trastes', 'plomería', 'kitchen sink', 'faucet', 'washing up'], [
  hl(2.75, 21.25, 13),
  rline([[4.25, 13], [4.25, 19.75], [15, 19.75], [15, 13]], [0, 3, 3, 0]),
  `M18.5 13V6.25A3.5 3.5 0 0 0 11.5 6.25V8.25`,
]);
// Kitchen island, from the side: the counter top running out past its cabinet (the signature's
// corner, a drawer under the top) and a bar stool tucked under the overhang. (Two stools in front of
// the block, seen face on, cut it into arches.)
add('kitchen-island', ['isla de cocina', 'barra', 'desayunador', 'amenidades', 'kitchen island', 'breakfast bar', 'counter'], [
  sq(2.75, 7.75, 18.5, 3, 1),
  rline([[3.75, 10.75], [3.75, 21.25], [12.25, 21.25], [12.25, 10.75]], [0, 1.5, 0, 0]),
  hl(3.75, 12.25, 14.75),
  capsule(15.25, 13.75, 5, 2.5),
  vl(17.75, 16.25, 21.25),
  hl(15.75, 19.75, 21.25),
]);
/**
 * The food container: its lid, a clip tab coming down each end over the box's walls, and the box
 * (the signature's corner) hanging from the lid.
 */
const container = (top = 6, bottom = 21.25) => [
  roundpoly([[2.75, top], [21.25, top], [21.25, top + 6.5], [18.25, top + 6.5], [18.25, top + 3.25], [5.75, top + 3.25], [5.75, top + 6.5], [2.75, top + 6.5]], [1.5, 1.5, 1, 1, 0, 0, 1, 1]),
  rline([[5.75, top + 3.25], [5.75, bottom], [18.25, bottom], [18.25, top + 3.25]], [0, 2.5, 0, 0]),
];
add('food-container', ['táper', 'recipiente', 'sobras', 'meal prep', 'food container', 'leftovers', 'tupperware'], container());
add('food-container-clock', ['consumir antes de', 'caducidad', 'sobras', 'use by', 'expiry', 'meal prep date'], container(), { badge: badge('clock') });
add('food-container-plus', ['agregar sobras', 'guardar comida', 'inventario', 'add leftovers', 'meal prep', 'inventory'], container(), { badge: badge('plus') });
add('food-container-alert', ['caducado', 'comida echada a perder', 'vencido', 'expired', 'spoiled food', 'gone off'], container(), { badge: badge('alert') });
// Lunch box: the box (the signature's corner) under its domed lid, the handle on top and the latch
// hanging from the seam.
{
  const ly = (x) => 11.5 - 4.5 * Math.sqrt(1 - ((x - 12) / 9) ** 2);
  add('lunch-box', ['lonchera', 'almuerzo', 'escuela', 'comida para llevar', 'lunch box', 'packed lunch', 'school'], [
    `M3 11.5A9 4.5 0 0 1 21 11.5Z`,
    rline([[3, 11.5], [3, 21], [21, 21], [21, 11.5]], [0, 3, 0, 0]),
    `M9.5 ${f(ly(9.5))}V5.25A2.5 2.5 0 0 1 14.5 5.25V${f(ly(14.5))}`,
    rline([[10.5, 11.5], [10.5, 14.5], [13.5, 14.5], [13.5, 11.5]], [0, 1, 1, 0]),
  ]);
}
// Canning jar: the mason jar, shouldered (the signature's corner), its screw band over the neck. (The
// hinged glass lid with its wire clasp read as a handbag.) Ferment reuses it.
const JAR = (top = 6.75) => rline([[7.25, top], [7.25, top + 1.5], [4.25, top + 4.5], [4.25, 21.25], [19.75, 21.25], [19.75, top + 4.5], [16.75, top + 1.5], [16.75, top]], [0, 1.5, 2, 2.5, 0, 2, 1.5, 0]);
const JAR_LID = (top = 6.75) => sq(6.25, top - 3.5, 11.5, 3.5, 1.25);
add('canning-jar', ['frasco', 'conservas', 'tarro de vidrio', 'envasar', 'canning jar', 'preserving jar', 'mason jar'], [JAR(), JAR_LID()]);
{
  // Freezer bag: the flat bag (the signature's corner), the zipper across its top and a snowflake on
  // it (lugares' six arms).
  const c = [12, 14.5];
  add('freezer-bag', ['bolsa ziploc', 'bolsa para congelar', 'guardar', 'congelar', 'freezer bag', 'zip bag', 'storage'], [
    box(3.75, 3.5, 16.5, 17.75, 3),
    hl(3.75, 20.25, 7.75),
    ...[-90, -30, 30].map((a) => line(polar(...c, 3.75, a), polar(...c, 3.75, a + 180))),
  ]);
}
{
  // Freezer safe: the food container, lower, under a snowflake (at this size, its six arms).
  const c = [12, 6.25];
  add('freezer-safe', ['apto para congelador', 'congelador', 'frío', 'etiqueta', 'freezer safe', 'freezer', 'label'], [
    ...container(12.75),
    ...[-90, -30, 30].map((a) => line(polar(...c, 3.5, a), polar(...c, 3.5, a + 180))),
  ]);
}
/** lugares' water drop: the logomark's drop with its square corner pointing up. */
const drop2 = ([cx, cy], r) => `M${P(polar(cx, cy, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${P(polar(cx, cy, r, -135))}L${P([cx, cy - r * Math.SQRT2])}Z`;
const DROPS = (y = 6, xs = [6.25, 12, 17.75], r = 1.5) => xs.map((x) => drop2([x, y], r));
// Dishwasher safe: a plate and a glass standing side by side under three falling drops.
add('dishwasher-safe', ['apto para lavavajillas', 'lavavajillas', 'lavaplatos', 'etiqueta', 'dishwasher safe', 'dishwasher', 'label'], [
  ...DROPS(6),
  circ(7.75, 16.5, 4.25),
  circ(7.75, 16.5, 1.25),
  roundpoly([[14.75, 12.25], [20.75, 12.25], [20, 20.75], [15.5, 20.75]], [0.5, 0.5, 0, 1.25]),
]);
{
  // Induction safe: the pan's flat base over the induction coil, a row of three loops (a prolate
  // cycloid through its points).
  const [a, b, y0, n] = [0.9, 2.6, 15.25, 3];
  const x0 = 12 - n * Math.PI * a + Math.PI * a;
  const pts = [];
  for (let th = -Math.PI; th <= (2 * n - 1) * Math.PI + 1e-9; th += Math.PI / 6) pts.push([x0 + a * th - b * Math.sin(th), y0 - b * Math.cos(th)]);
  add('induction-safe', ['apto para inducción', 'inducción', 'parrilla de inducción', 'etiqueta', 'induction safe', 'induction', 'label'], [
    rline([[3.5, 4], [4.25, 8.5], [19.75, 8.5], [20.5, 4]], [0, 1.25, 1.25, 0]),
    smooth(pts),
  ]);
}
// Food safe: a wine glass and a fork side by side, the international food contact symbol.
add('food-safe', ['apto para alimentos', 'grado alimenticio', 'contacto con alimentos', 'etiqueta', 'food safe', 'food grade', 'label'], [
  `M3.5 3.25H10.5C10.5 7.25 9.25 10 7 10S3.5 7.25 3.5 3.25Z`,
  vl(7, 10, 20.75),
  hl(4.25, 9.75, 20.75),
  ...fork(17, 3.25, 20.75),
]);

// ── Tableware ─────────────────────────────────────────────────────────────────────────────────
// The plate seen at an angle: the rim and the well 2.85 inside it.
const PLATE = [ell([12, 12], 9.25, 5.25), ell([12, 11.6], 5.5, 2)];
add('plate', ['plato', 'comida', 'vajilla', 'diario de comidas', 'plate', 'dish', 'tableware'], PLATE);
add('plate-plus', ['registrar comida', 'agregar comida', 'diario de comidas', 'log meal', 'food diary', 'add meal'], PLATE, { badge: badge('plus') });
add('plate-check', ['comida registrada', 'comí', 'plan cumplido', 'meal logged', 'eaten', 'done'], PLATE, { badge: badge('check') });
add('plate-clock', ['hora de comer', 'ventana de alimentación', 'recordatorio', 'meal time', 'eating window', 'reminder'], PLATE, { badge: badge('clock') });
{
  // Bowl in profile: the half-round body under its straight rim, on a short foot.
  const fy = 10.25 + 7.5 * Math.sqrt(1 - (3.5 / 9.25) ** 2);
  add('bowl', ['tazón', 'plato hondo', 'cereal', 'sopa', 'bowl', 'serving', 'tableware'], [
    `M2.75 10.25H21.25A9.25 7.5 0 0 1 2.75 10.25Z`,
    `M8.5 ${f(fy)}L8.25 21H15.75L15.5 ${f(fy)}`,
  ]);
}
// Dishes: three plates in profile stacked, wider toward the bottom of the pile.
add('dishes', ['trastes', 'platos', 'lavar', 'vajilla', 'dishes', 'washing up', 'stack'], [
  [6.5, 5.25, 18.75],
  [11, 4, 20],
  [15.5, 2.75, 21.25],
].map(([y, x0, x1]) => rline([[x0, y], [x0 + 2.25, y + 2.25], [x1 - 2.25, y + 2.25], [x1, y]], [0, 1, 1, 0])));
// Cake stand: the flat plate seen at an angle on its stem, which flares into a wide foot.
add('cake-stand', ['base para pastel', 'pastelería', 'postres', 'exhibir', 'cake stand', 'bakery', 'dessert'], [
  ell([12, 8.5], 8.75, 2.5),
  `M10.75 10.97C10.9 14.5 10 16.75 7 19.75H17C14 16.75 13.1 14.5 13.25 10.97`,
]);

// ── Cookware ──────────────────────────────────────────────────────────────────────────────────
/**
 * A flame: a round base of radius r and a tip h above the base's center, flicking right past the
 * base; its left side full, its right side drawn in under the tip. (Leaning less, with a full right
 * side, three of them under a pot read as falling drops.)
 */
function flame([x, bottom], r, h) {
  const B = bottom - r;
  const T = [x + 1.15 * r, B - h];
  return `M${P([x - r, B])}C${P([x - r, B - 0.62 * h])} ${P([x + 0.05 * r, B - 0.72 * h])} ${P(T)}C${P([x + 0.3 * r, B - 0.62 * h])} ${P([x + r, B - 0.42 * h])} ${P([x + r, B])}A${f(r)} ${f(r)} 0 0 1 ${P([x - r, B])}Z`;
}
/** Three flames 6 apart: a burner's fire. */
const FLAMES = (bottom = 21.25, h = 4.5, xs = [6, 12, 18]) => xs.map((x) => flame([x, bottom], 1.5, h - 1.5));
/** A wisp of steam or heat, rising from y0 to y1 at x. */
const wisp = (x, y0, y1) => {
  const k = (y0 - y1) / 4;
  return `M${f(x)} ${f(y0)}C${f(x - 0.85)} ${f(y0 - k)} ${f(x - 0.85)} ${f(y0 - 2 * k)} ${f(x)} ${f(y0 - 2 * k)}S${f(x + 0.85)} ${f(y1 + k)} ${f(x)} ${f(y1)}`;
};

// The pot (`cooking-pot`): the lid with its knob resting on the body (the signature's corner), and
// a short handle on each side. `y` is the top of the body; the lid stands 3 over it.
const POT_X = [5, 19];
const potLid = (y) => roundpoly([[3.75, y], [20.25, y], [18, y - 3], [6, y - 3]], [0.6, 0.6, 1.25, 1.25]);
const potKnob = (y) => `M10.5 ${f(y - 3)}V${f(y - 4)}A1.5 1.5 0 0 1 13.5 ${f(y - 4)}V${f(y - 3)}`;
const potBody = (y, bottom = 20.25, open = true) =>
  open ? rline([[POT_X[0], y], [POT_X[0], bottom], [POT_X[1], bottom], [POT_X[1], y]], [0, 3, 0, 0]) : roundpoly([[POT_X[0], y], [POT_X[1], y], [POT_X[1], bottom], [POT_X[0], bottom]], [0, 0, 0, 3]);
const potHandles = (y) => [hl(2.75, POT_X[0], y), hl(POT_X[1], 21.25, y)];
const POT = (y = 10, bottom = 20.25, hy = y + 4.25) => [potBody(y, bottom), potLid(y), potKnob(y), ...potHandles(hy)];
add('cooking-pot', ['olla', 'cacerola', 'cocinar', 'batería de cocina', 'cooking pot', 'stockpot', 'cookware'], POT());
add('cooking-pot-clock', ['tiempo de cocción', 'receta', 'cocinar', 'cook time', 'cooking time', 'recipe'], POT(), { badge: badge('clock') });
add('cooking-pot-check', ['listo', 'platillo terminado', 'paso cocinado', 'done cooking', 'dish ready', 'cooked'], POT(), { badge: badge('check') });
// Cooking: the pot, shorter, over a burner's three flames.
add('cooking', ['cocinando', 'al fuego', 'en preparación', 'estufa', 'cooking', 'on the stove', 'in progress'], [...POT(8.25, 14.25, 11.25), ...FLAMES(21.25, 4)]);
// Boil: the open pot (its rim closes the body) and three bubbles rising over it.
add('boil', ['hervir', 'ebullición', 'agua hirviendo', 'método', 'boil', 'boiling', 'cooking method'], [
  potBody(11, 20.25, false),
  ...potHandles(14.25),
  circ(6.5, 6.75, 1.25),
  circ(12, 4.5, 1.75),
  circ(17.5, 6.75, 1.25),
]);
{
  // Simmer: the lid tipped ajar on the rim's left end, and a wisp of steam escaping at the gap, rising
  // from under the lid's raised end.
  const y = 11;
  const tilt = (d) => turnPath(d, -26, [6, y]);
  add('simmer', ['fuego lento', 'hervir a fuego bajo', 'tapa entreabierta', 'método', 'simmer', 'low heat', 'lid ajar'], [
    potBody(y, 20.25, false),
    tilt(potLid(y)),
    tilt(potKnob(y)),
    ...potHandles(14.25),
    `M${P(rot([19.68, 10.25], [6, y], -26))}C19.75 4.5 20.75 4.25 21 2.5`,
  ]);
}
// Saucepan: a smaller deep pan (the signature's corner) with its lid and knob, and one long straight
// handle.
add('saucepan', ['cacerola', 'cazo', 'salsas', 'batería de cocina', 'saucepan', 'sauce pan', 'cookware'], [
  rline([[3, 11], [3, 20.25], [14.75, 20.25], [14.75, 11]], [0, 3, 0, 0]),
  roundpoly([[2.25, 11], [15.5, 11], [13.5, 8], [4.25, 8]], [0.6, 0.6, 1.25, 1.25]),
  `M7.25 8V7A1.5 1.5 0 0 1 10.25 7V8`,
  hl(14.75, 21.25, 14),
]);
// The frying pan in profile: a shallow pan (round tableware: no signature corner) and its long
// handle rising slightly. `y` is the rim.
const PAN = (y = 9.75) => [roundpoly([[2.75, y], [15.5, y], [14, y + 5.5], [4.25, y + 5.5]], [0.5, 0.5, 2, 2]), line([15.21, y + 1.05], [21.25, y - 0.75])];
add('frying-pan', ['sartén', 'freír', 'batería de cocina', 'cocinar', 'frying pan', 'skillet', 'cookware'], PAN());
// Fry: the pan with oil jumping out of it.
add('fry', ['freír', 'frito', 'aceite', 'método', 'fry', 'pan fried', 'cooking method'], [...PAN(13.5), dot(5.25, 9.25), dot(9, 5.75), dot(12.75, 9.25)]);
{
  // Saute: the pan tipped up at its front, and two pieces tossed along an arc above it.
  const tip = (d) => turnPath(d, 10, [21.25, 13.75]);
  add('saute', ['saltear', 'sofreír', 'wok', 'método', 'saute', 'stir fry', 'toss'], [
    ...PAN(14.5).map(tip),
    arc(11.5, 13.5, 8.5, 219, 248).d,
    turnPath(sq(11.5, 3.25, 3, 3, 1), 20, [13, 4.75]),
    turnPath(sq(17, 5.75, 3, 3, 1), -15, [18.5, 7.25]),
  ]);
}
// Flambe: the pan with one tall flame rising out of it, its foot lost behind the rim.
add('flambe', ['flamear', 'flambeado', 'flama', 'método', 'flambe', 'flame', 'ignite'], [
  ...PAN(14.5),
  `M5.5 14.5C4.25 10.75 6.25 7.75 8.5 5.75C8.75 7.5 9.5 8.5 10.5 9C10.25 6.25 11.5 4 13.25 2.75C13 6.25 15.5 8.5 15 12.25C14.9 13 14.75 13.75 14.5 14.5`,
]);
{
  // Deep fry: the open pot, the frying basket down in it (3 inside its walls), the basket's handle
  // rising from its rim to a hook, and two bubbles over the oil. (Bubbles sitting on the rim read as
  // a pair of eyes.)
  const y = 11;
  const E = [19.5, 4.75];
  add('deep-fry', ['freír en aceite', 'freidora', 'fritura', 'método', 'deep fry', 'deep fried', 'fryer'], [
    potBody(y, 20.25, false),
    ...potHandles(14.25),
    `M8 ${y}V15.75A1.5 1.5 0 0 0 9.5 17.25H14V${y}`,
    `M14 ${y}L${P(E)}A1.75 1.75 0 0 1 ${P([E[0] + 2.38, E[1] - 1.25])}`,
    circ(6.25, 6.75, 1.25),
    circ(11, 4, 1.25),
  ]);
}
{
  // Wok: the deep round-bottomed pan, its long handle on one side and a loop on the other.
  const [cx, y, rx, ry] = [11.25, 10, 6.25, 6.25];
  const wy = (dy) => cx - rx * Math.sqrt(1 - (dy / ry) ** 2);
  add('wok', ['wok', 'saltear', 'comida asiática', 'batería de cocina', 'wok', 'stir fry', 'asian cooking'], [
    `M${f(cx - rx)} ${y}H${f(cx + rx)}A${rx} ${ry} 0 0 1 ${f(cx - rx)} ${y}Z`,
    line([cx + rx, y], [21.25, 7.25]),
    `M${f(cx - rx)} ${y}H3.75A1.5 1.5 0 0 0 3.75 ${y + 3}H${f(wy(3))}`,
  ]);
}
// Pot lid, alone and seen a little from above: the shallow dome, the front of its rim and the knob.
add('pot-lid', ['tapa', 'tapar', 'cocinar tapado', 'olla', 'pot lid', 'lid', 'cover'], [
  `M2.75 14.25C2.75 10.5 7 8.75 12 8.75S21.25 10.5 21.25 14.25A9.25 2.5 0 0 1 2.75 14.25Z`,
  `M10.5 8.85V7.25A1.5 1.5 0 0 1 13.5 7.25V8.85`,
]);
// Griddle (comal): a thin round plate seen at an angle, its edge and two small side handles.
add('griddle', ['comal', 'plancha', 'tortillas', 'hot cakes', 'griddle', 'flat top', 'pancakes'], [
  ell([12, 10.5], 7.5, 3.5),
  `M4.5 10.5V13.5A7.5 3.5 0 0 0 19.5 13.5V10.5`,
  hl(2.25, 4.5, 13),
  hl(19.5, 21.75, 13),
]);
// Pressure cooker: the pot (the signature's corner), the locking lid with its long handle across the
// top, and steam escaping from the valve.
add('pressure-cooker', ['olla exprés', 'olla de presión', 'cocción rápida', 'vapor', 'pressure cooker', 'fast cooking', 'steam'], [
  rline([[4.75, 12], [4.75, 20.75], [18.25, 20.75], [18.25, 12]], [0, 3, 0, 0]),
  roundpoly([[3.75, 12], [19.25, 12], [17.75, 9], [5.25, 9]], [0.6, 0.6, 1.25, 1.25]),
  rline([[10.5, 9], [10.5, 6], [21.25, 6]], [0, 1.25, 0]),
  wisp(6.75, 9, 2.75),
]);
// Steam: the two-tier bamboo steamer under its lid, three wisps of steam over it.
add('steam', ['al vapor', 'vaporera', 'bambú', 'método', 'steam', 'steamed', 'steamer'], [
  box(3.5, 13, 17, 8.25, 2.25),
  hl(3.5, 20.5, 17.25),
  roundpoly([[3.5, 13], [20.5, 13], [18, 10], [6, 10]], [0.6, 0.6, 1.25, 1.25]),
  wisp(8, 7, 2.75),
  wisp(12, 7, 2.75),
  wisp(16, 7, 2.75),
]);
{
  // Baking sheet: a flat tray in perspective, its raised lip all round (the floor 3 inside it).
  const outer = [[6.75, 6.5], [21.25, 6.5], [17.25, 17.5], [2.75, 17.5]];
  const inset = (pts, d) => {
    const n = pts.length;
    const lines = pts.map((p, i) => {
      const q = pts[(i + 1) % n];
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const nrm = [-(q[1] - p[1]) / L, (q[0] - p[0]) / L];
      return [[p[0] + nrm[0] * d, p[1] + nrm[1] * d], [q[0] + nrm[0] * d, q[1] + nrm[1] * d]];
    });
    return lines.map((l, i) => {
      const [a, b] = lines[(i - 1 + n) % n];
      const [c, e] = l;
      const den = (a[0] - b[0]) * (c[1] - e[1]) - (a[1] - b[1]) * (c[0] - e[0]);
      const t = ((a[0] - c[0]) * (c[1] - e[1]) - (a[1] - c[1]) * (c[0] - e[0])) / den;
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    });
  };
  add('baking-sheet', ['charola para hornear', 'bandeja', 'horno', 'repostería', 'baking sheet', 'sheet pan', 'oven tray'], [roundpoly(outer, 1.5), roundpoly(inset(outer, 3), 0.75)]);
}
// Baking dish: the low dish (the signature's corner) with flared sides, its rim running out into a
// handle at each end.
add('baking-dish', ['refractario', 'molde para hornear', 'lasaña', 'gratinar', 'baking dish', 'casserole', 'lasagna'], [
  roundpoly([[4.5, 9], [19.5, 9], [18, 16.5], [6, 16.5]], [0.5, 0.5, 0, 2]),
  hl(2.25, 4.5, 9),
  hl(19.5, 21.75, 9),
]);
// Roasting pan: the deep pan (the signature's corner), a loop handle on each side, and the rack's
// top bar standing out of it on its wires.
add('roasting-pan', ['asadera', 'charola para asar', 'pavo', 'rostizar', 'roasting pan', 'roaster', 'roast'], [
  roundpoly([[5.25, 11.5], [18.75, 11.5], [18.75, 20.75], [5.25, 20.75]], [0, 0, 0, 3]),
  `M5.25 12.75H3.75A1.5 1.5 0 0 0 3.75 15.75H5.25`,
  `M18.75 12.75H20.25A1.5 1.5 0 0 1 20.25 15.75H18.75`,
  hl(7.5, 16.5, 8.5),
  vl(9, 8.5, 11.5),
  vl(12, 8.5, 11.5),
  vl(15, 8.5, 11.5),
]);
// The loaf pan in profile: the rolled rim and the deep tin (the signature's corner) with sloped
// sides. `y` is the top of the rim.
const LOAF = (y = 6.25, bottom = 18.25) => [capsule(2.75, y, 18.5, 3), rline([[4.25, y + 3], [5.75, bottom], [18.25, bottom], [19.75, y + 3]], [0, 2, 0, 0])];
add('loaf-pan', ['molde para pan', 'panqué', 'pan de caja', 'repostería', 'loaf pan', 'bread tin', 'pound cake'], LOAF());
// Bake: the loaf pan with three wisps of heat rising from it.
add('bake', ['hornear', 'horneado', 'horno', 'método', 'bake', 'oven baked', 'cooking method'], [...LOAF(11.25, 21.25), wisp(7.5, 8.25, 2.75), wisp(12, 8.25, 2.75), wisp(16.5, 8.25, 2.75)]);
// Muffin tin from above: the rounded tray and two rows of three cups.
add('muffin-tin', ['molde para muffins', 'panquecitos', 'cupcakes', 'repostería', 'muffin tin', 'cupcake pan', 'bakeware'], [
  sq(2.5, 4.75, 19, 14.5, 3.75),
  ...[9.25, 14.75].flatMap((y) => [6.6, 12, 17.4].map((x) => circ(x, y, 1.2))),
]);
{
  // Pie dish in profile: the shallow dish, its rim crimped into six scallops.
  const [x0, x1, y] = [2.75, 21.25, 10.75];
  const n = 6;
  const w = (x1 - x0) / n;
  let top = `M${P([x0, y])}`;
  for (let i = 1; i <= n; i++) top += `A${f(w / 2)} ${f(w / 2)} 0 0 1 ${P([x0 + i * w, y])}`;
  add('pie-dish', ['molde para pay', 'pay', 'tarta', 'repostería', 'pie dish', 'pie', 'tart'], [`${top}L18.25 16.75A1.75 1.75 0 0 1 16.5 18.25H7.5A1.75 1.75 0 0 1 5.75 16.75Z`]);
}
{
  // Kettle grill: the round body split into lid and bowl, the handle on the lid and three legs.
  const [c, r] = [[12, 12], 6.5];
  const yAt = (x) => c[1] - Math.sqrt(r * r - (x - c[0]) ** 2);
  add('barbecue', ['asador', 'parrilla', 'carne asada', 'amenidades', 'barbecue', 'bbq', 'kettle grill'], [
    circ(...c, r),
    hl(c[0] - r, c[0] + r, c[1]),
    `M10 ${f(yAt(10))}V4.75A2 2 0 0 1 14 4.75V${f(yAt(14))}`,
    line(polar(...c, r, 120), [6.5, 21.25]),
    line(polar(...c, r, 60), [17.5, 21.25]),
    vl(12, c[1] + r, 21.25),
  ]);
}
// Grill: a low grate of parallel bars in its frame, over a burner's three tall flames. (A grate as
// tall as the flames read as a battery.)
add('grill', ['asar', 'a la parrilla', 'parrilla', 'método', 'grill', 'grilled', 'cooking method'], [
  sq(2.75, 4.25, 18.5, 5.5, 1.75),
  vl(7.25, 4.25, 9.75),
  vl(12, 4.25, 9.75),
  vl(16.75, 4.25, 9.75),
  ...FLAMES(21.25, 7.5),
]);
// Smoker: the barrel on its legs, its lid's seam, and the chimney rising from one end.
add('smoker-grill', ['ahumador', 'carnes ahumadas', 'barbacoa', 'asador', 'smoker', 'smoked meat', 'low and slow'], [
  capsule(2.75, 9.25, 18.5, 7.5),
  hl(2.75, 21.25, 13),
  rline([[7.25, 9.25], [7.25, 3.25], [9.75, 3.25], [9.75, 9.25]], [0, 0.75, 0.75, 0]),
  line([6.75, 16.75], [5.75, 21.25]),
  line([17.25, 16.75], [18.25, 21.25]),
]);
{
  // Rotisserie: the spit through a tied roast (it enters and leaves at its edge), the crank at one
  // end and a burner's flames below.
  const [c, rx, ry] = [[11.5, 8.75], 5, 3.75];
  const tie = (x) => {
    const h = ry * Math.sqrt(1 - ((x - c[0]) / rx) ** 2);
    return vl(x, c[1] - h, c[1] + h);
  };
  add('rotisserie', ['rostizado', 'pollo rostizado', 'asador giratorio', 'espetón', 'rotisserie', 'spit roast', 'rotisserie chicken'], [
    ell(c, rx, ry),
    tie(10),
    tie(13),
    hl(2.75, c[0] - rx, c[1]),
    rline([[c[0] + rx, c[1]], [19.25, c[1]], [19.25, 12.25], [21.25, 12.25]], [0, 0.75, 0.75, 0]),
    ...FLAMES(21.25, 5, [6.75, 12, 17.25]),
  ]);
}
// Pizza oven: the dome on its base, the chimney on top and the arched mouth with a flame inside.
add('pizza-oven', ['horno de leña', 'horno de pizza', 'pizzería', 'pan', 'pizza oven', 'wood-fired oven', 'brick oven'], [
  `M2.75 20.75C2.75 12.5 6.75 7 12 7S21.25 12.5 21.25 20.75Z`,
  rline([[10.5, 7.1], [10.5, 2.75], [13.5, 2.75], [13.5, 7.1]], [0, 0.75, 0.75, 0]),
  `M7.75 20.75V16A4.25 4.25 0 0 1 16.25 16V20.75`,
  flame([12, 20.75], 1.5, 3.25),
]);

// ── Prep and cooking steps ────────────────────────────────────────────────────────────────────
// Chop: the chef's knife, level, raised over three diced pieces on the board's edge. (The knife
// beside round pieces, at the board's height, read as a fish and its bubbles.)
const CHOP_KNIFE = (d) => place(d, 0.72, [11.5, 12.25], [11.75, 6]);
add('chop', ['picar', 'cortar', 'preparar', 'paso de receta', 'chop', 'cut', 'prep'], [
  sq(2.75, 17.25, 18.5, 3, 1.25),
  CHOP_KNIFE(`M7.5 9.75H17C20 9.75 22.5 10.1 24.25 10.75C21.5 13.4 18.5 14.75 14.5 14.75H8.5A1 1 0 0 1 7.5 13.75Z`),
  CHOP_KNIFE(`M7.5 9.75H0.5A1.75 1.75 0 0 0 0.5 13.25H7.5`),
  ...[5, 10.5, 16].map((x) => sq(x, 11.25, 2.5, 2.5, 0.6)),
]);
{
  // Mix: the bowl (`bowl`) and a whisk leaning in it, its loop head up and its handle going into the
  // bowl behind the rim.
  const fy = 10.25 + 7.5 * Math.sqrt(1 - (3.5 / 9.25) ** 2);
  const Nk = [13.5, 7.25];
  const tilt = (d) => turnPath(move(d, Nk[0], Nk[1]), 35, Nk);
  const loop = `M0 0C-3.4 -2 -3.25 -6 0 -6S3.4 -2 0 0`;
  add('mixing-bowl', ['mezclar', 'batir', 'tazón', 'paso de receta', 'mixing bowl', 'mix', 'combine'], [
    `M2.75 10.25H21.25A9.25 7.5 0 0 1 2.75 10.25Z`,
    `M8.5 ${f(fy)}L8.25 21H15.75L15.5 ${f(fy)}`,
    tilt(loop),
    tilt(vl(0, -6, 0)),
    line(Nk, [Nk[0] - 3 * Math.tan((35 * Math.PI) / 180), 10.25]),
  ]);
}
{
  // Seasoning: the shaker (a tapered body, the signature's corner, under its domed cap) tipped
  // over, set into the top right; the grains fall from the cap.
  const C = [14.5, 10];
  const tip = (d) => turnPath(d, -130, C);
  const shaker = fit([tip(roundpoly([[11, 9], [18, 9], [18.75, 17.5], [10.25, 17.5]], [0.5, 0.5, 0, 2])), tip(`M11 9A3.5 3.5 0 0 1 18 9Z`)], [8, 2.75, 21.25, 16]);
  add('seasoning', ['sazonar', 'sal y pimienta', 'al gusto', 'salero', 'seasoning', 'salt', 'pepper'], [...shaker.ds, dot(4.75, 15.25), dot(7.75, 18), dot(4, 20.25)]);
  SEAM.seasoning = line(shaker.at(rot([10, 9], C, -130)), shaker.at(rot([19, 9], C, -130)));
}
{
  // Ferment: the canning jar with its lid lifted off the neck (loose: the gas pushes it up) and
  // bubbles rising inside. (Tipped onto the neck, the lid left a sliver of paper that changed with
  // the weight.)
  add('ferment', ['fermentar', 'encurtir', 'kimchi', 'masa madre', 'ferment', 'pickle', 'sourdough'], [
    JAR(8.75),
    JAR_LID(5.75),
    circ(9.25, 17.25, 1.75),
    circ(14.75, 15, 1.5),
    dot(11, 12.75),
  ]);
}
// Pour: the measuring jug tipped toward its spout, and the stream falling from it.
{
  // The jug (its body and handle, a little smaller) turned 35° toward its spout and set into the
  // canvas's top right; the stream falls from under the spout.
  const k = 0.85;
  const turned = JUG.slice(0, 2).map((d) => turnPath(place(d, k, [12, 12]), -35, [12, 12]));
  const pts = turned.flatMap((d) => samples(d).flat());
  const [dx, dy] = [21.25 - Math.max(...pts.map((q) => q[0])), 2.75 - Math.min(...pts.map((q) => q[1]))];
  const spout = rot([12 + (3 - 12) * k, 12 + (4.75 - 12) * k], [12, 12], -35);
  add('pour', ['verter', 'agregar líquido', 'servir', 'paso de receta', 'pour', 'add liquid', 'recipe step'], [
    ...turned.map((d) => move(d, dx, dy)),
    vl(spout[0] + dx, spout[1] + dy + 3.5, 21.25),
  ]);
}
// Rinse: the colander under three falling drops.
add('rinse', ['enjuagar', 'lavar verduras', 'escurrir', 'paso de receta', 'rinse', 'wash produce', 'drain'], [...colander(2.25), ...DROPS(5.5)]);
{
  // Thaw: lugares' snowflake (its hollow center, shorter arms) whose lowest arm melts into a
  // falling drop.
  const c = [12, 9.75];
  const FIVE = [-90, -30, 30, 150, 210];
  const branch = (a) => head(polar(...c, 4.75, a), [-Math.cos((a * Math.PI) / 180), -Math.sin((a * Math.PI) / 180)], 1.9, 50);
  add('thaw', ['descongelar', 'deshielo', 'derretir', 'paso de receta', 'thaw', 'defrost', 'melt'], [
    ...FIVE.map((a) => line(polar(...c, 3, a), polar(...c, 7, a))),
    ...FIVE.map(branch),
    vl(12, c[1] + 3, 18.75 - 2.5 * Math.SQRT2),
    drop2([12, 18.75], 2.5),
  ]);
}
// Heat level: three flames of rising height under the pan, lit as levels.
add('heat-level', ['nivel de fuego', 'fuego bajo', 'fuego alto', 'intensidad', 'heat level', 'low heat', 'high heat'], [
  ...PAN(3.75),
  flame([6, 21.25], 1.5, 2.25),
  flame([12, 21.25], 1.5, 4),
  flame([18, 21.25], 1.5, 5.75),
]);
{
  // Doneness: a steak cut in profile, a band 3 inside its edge and the core along its middle, lit
  // as levels from the outside in.
  const out = [[3, 8], [11.5, 6], [19.5, 6.75], [21.25, 12], [19.5, 17.75], [11, 18], [3.75, 16.5], [2.75, 12]];
  const c = [12, 12];
  const band = out.map(([x, y]) => {
    const [dx, dy] = [x - c[0], y - c[1]];
    const L = Math.hypot(dx, dy);
    const k = (L - 3.05) / L;
    return [c[0] + dx * k, c[1] + dy * k];
  });
  add('doneness', ['término de la carne', 'cocción', 'jugoso', 'bien cocido', 'doneness', 'rare', 'well done'], [roundpoly(out, 3), roundpoly(band, 1.5), hl(11, 13.5, 12)]);
}

// ── Recipes and meals ─────────────────────────────────────────────────────────────────────────
let RECIPE;
{
  // Recipe: an index card (the signature's corner) with three lines, a spoon resting across its top
  // left corner (the card stops 3 from it), the first line beside the spoon's handle. On the left,
  // the spoon leaves the card's right side whole under any badge.
  const B = [4.75, 4.5];
  const bowl = ell(B, 3, 2.1, 45);
  const handle = line(polar(...B, 3, 45), [9.75, 9.5]);
  const knock = [bowl, `${handle}L${P(polar(...B, 3, 45))}Z`];
  RECIPE = [behind(box(2.75, 6.75, 16.5, 14, 3), knock), hl(12.75, 15.25, 11), hl(6.25, 15.25, 14.25), hl(6.25, 11.75, 17.5), bowl, handle];
}
add('recipe', ['receta', 'tarjeta de receta', 'cocinar', 'recetario', 'recipe', 'recipe card', 'cook'], RECIPE);
add('recipe-plus', ['nueva receta', 'agregar receta', 'importar', 'add recipe', 'new recipe', 'import'], RECIPE, { badge: badge('plus') });
add('recipe-heart', ['receta favorita', 'guardada', 'receta familiar', 'favorite recipe', 'saved', 'family recipe'], RECIPE, { badge: badge('heart') });
add('recipe-search', ['buscar recetas', 'por ingrediente', 'buscar platillo', 'find recipes', 'search recipes', 'by ingredient'], RECIPE, { badge: badge('search') });
add('recipe-check', ['receta hecha', 'paso listo', 'lo cociné', 'cooked it', 'recipe done', 'step done'], RECIPE, { badge: badge('check') });
{
  // Cookbook: the book (archivos' cover, its spine nearer the edge) and a large fork on the cover. (A
  // fork and a spoon crossing don't fit the cover with 3 between their pieces.)
  const [cover] = archivos.icons.book.d;
  add('cookbook', ['recetario', 'libro de cocina', 'colección de recetas', 'cocina', 'cookbook', 'recipe book', 'collection'], [cover, vl(7.25, 2.75, 21.25), ...fork(13.25, 6, 18, 9.25)]);
}
{
  // Recipe box: the box (the signature's corner) with two tabbed index cards rising out of it, their
  // tabs at opposite ends; the back one stops 3 from the front one.
  const TOP = 12;
  const front = [[5.75, TOP], [5.75, 5.75], [9.75, 5.75], [9.75, 8.25], [14.75, 8.25], [14.75, TOP]];
  const back = [[9.5, TOP], [9.5, 5.25], [14.75, 5.25], [14.75, 2.75], [18.75, 2.75], [18.75, TOP]];
  const frontD = rline(front, [0, 1, 0.75, 0.6, 1, 0]);
  add('recipe-box', ['caja de recetas', 'fichero', 'colección', 'biblioteca de recetas', 'recipe box', 'recipe cards', 'library'], [
    box(3.25, TOP, 17.5, 21.25 - TOP, 2.5),
    frontD,
    behind(rline(back, [0, 1, 0.6, 0.75, 1, 0]), [`${frontD}Z`]),
  ]);
}
{
  // Cook mode: archivos' open book, smaller, propped behind the stand's lip (the pages stop 3 from
  // it), and the stand's legs.
  const lip = capsule(3.25, 14.75, 17.5, 3);
  const [pages, spine] = archivos.icons['book-open'].d.map((d) => behind(place(d, 0.8, [12, 19.75], [12, 15.5]), [lip]));
  add('recipe-stand', ['modo cocina', 'atril', 'receta abierta', 'cocinar', 'cook mode', 'recipe stand', 'cookbook holder'], [
    pages,
    spine,
    lip,
    line([8, 17.75], [6, 21.25]),
    line([16, 17.75], [18, 21.25]),
  ]);
}
// Ingredients: a small jar (the signature's corner) under its lid beside a taller bottle.
add('ingredients', ['ingredientes', 'despensa', 'lista de compras', 'receta', 'ingredients', 'staples', 'shopping list'], [
  box(2.75, 12.75, 7.5, 8.5, 2.25),
  sq(3.5, 9.75, 6, 3, 1),
  roundpoly([[15.5, 5.5], [18.5, 5.5], [18.5, 7.75], [20.75, 10.5], [20.75, 21.25], [13.25, 21.25], [13.25, 10.5], [15.5, 7.75]], [0, 0, 1.5, 1.5, 0, 2, 1.5, 1.5]),
  sq(15, 2.75, 4, 2.75, 1),
]);
// The plate in profile, shared by the servings and the meal slots.
const PLATE_SIDE = roundpoly([[2.75, 18.25], [21.25, 18.25], [18.75, 21.25], [5.25, 21.25]], [0.6, 0.6, 1.5, 1.5]);
// Servings: a person (Núcleo's head and shoulders) behind the plate; the shoulders stop 3 from it.
add('servings', ['porciones', 'raciones', 'para cuántos', 'comensales', 'servings', 'portions', 'serves'], [
  circ(12, 6.25, 3),
  behind(place(N.person.d[1], 0.85, [12, 13.6], [12, 11.75]), [PLATE_SIDE]),
  PLATE_SIDE,
]);
add('knife-clock', ['tiempo de preparación', 'preparar', 'receta', 'prep time', 'preparation', 'recipe'], CHEF, { badge: badge('clock') });
{
  // Meal plan: the core calendar with a served dish as its mark in the body's band: the cloche on
  // its tray, its knob on top. (A fork and a knife at this size read as the letters ΨP.)
  const y = 17.75;
  add('calendar-utensils', ['plan de comidas', 'menú semanal', 'planificador', 'comidas', 'meal plan', 'meal planner', 'weekly menu'], [
    ...N.calendar.d.slice(0, 4),
    arc(12, y, 3, 180, 360).d,
    hl(7.75, 16.25, y),
    dot(12, y - 4),
  ]);
}
// Meal slots: the time of day over the plate in profile: the half sun rising from it, the sun high
// above it (its lowest ray behind it), the crescent moon. (A fork and a knife flanking the sun, as
// first proposed, leave 3 between them at 24 px.)
const rays = (c, r0, r1, angles) => angles.map((a) => line(polar(...c, r0, a), polar(...c, r1, a)));
add('meal-breakfast', ['desayuno', 'mañana', 'comida', 'planificador', 'breakfast', 'morning', 'meal'], [
  PLATE_SIDE,
  arc(12, 15.25, 3.25, 180, 360).d,
  ...rays([12, 15.25], 6.25, 8.35, [180, 225, 270, 315, 360]),
]);
add('meal-lunch', ['comida', 'almuerzo', 'mediodía', 'planificador', 'lunch', 'midday', 'meal'], [
  PLATE_SIDE,
  circ(12, 9.5, 2.5),
  ...rays([12, 9.5], 5.5, 7.6, [0, 45, 135, 180, 225, 270, 315]),
]);
{
  const [c, R, ic, r] = [[11.25, 9.75], 5.5, [14.65, 6.35], 4.37];
  const [pp, qq] = meet([...c, R], [...ic, r]);
  add('meal-dinner', ['cena', 'noche', 'comida', 'planificador', 'dinner', 'evening', 'meal'], [
    PLATE_SIDE,
    `M${P(pp)}A${f(R)} ${f(R)} 0 1 0 ${P(qq)}A${f(r)} ${f(r)} 0 0 1 ${P(pp)}Z`,
  ]);
}


// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d`: `solid` is filled (and keeps its stroke: the silhouette doesn't change), `closed`
// is filled closed along its chord (an open outline: a handle on its blade, a body under its lid, a
// card behind the spoon, closed 3 short of what stands in front of it), `cut` is knocked out at
// stroke width, `lines` stays a line with a clearance of paper, and `wire` stays a line attached to
// the fill. Where two filled pieces share an edge (a lid on its body, a blade on its handle, a ball
// in its scoop), the seam between them is knocked out right through the silhouette (`seam`).
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
/** A seam across the silhouette at height y, from x0 to x1 (run past the edges). */
const seamH = (x0, x1, y) => hl(x0, x1, y);
/** A knife's heel, drawn level from y0 to y1 at x and turned onto the diagonal with the knife. */
const heel = (x, y0, y1) => turnPath(line([x, y0], [x, y1]), KNIFE_TILT);
const POT_FILL = (y = 10) => ({ closed: [0, 2], solid: [1], wire: [3, 4], seam: [seamH(2.75, 21.25, y)] });
const CONTAINER_FILL = (top = 6) => ({ solid: [0], closed: [1], seam: [seamH(1.75, 22.25, top + 3.25)] });
const FILL = {
  spoon: { solid: [0], wire: [1] },
  knife: { solid: [0], closed: [1], seam: [heel(7.5, 8.75, 14.75)] },
  'bread-knife': { solid: [0], closed: [1], seam: [heel(7.5, 9, 14.5)] },
  cleaver: { solid: [0], closed: [2], cut: [1] },
  chopsticks: { solid: [0, 1] },
  'soup-spoon': { solid: [0] },
  ladle: { solid: [0], wire: [1] },
  spatula: { solid: [0, 5], cut: [1, 2, 3], wire: [4] },
  'rubber-spatula': { solid: [0], wire: [1] },
  'slotted-spoon': { solid: [0], cut: [1, 2, 3], wire: [4] },
  // The handle filled; the wires stay lines, gathered into it
  whisk: { solid: [3], wire: [0, 1, 2] },
  tongs: { solid: [0], wire: [1, 2] },
  'rolling-pin': { solid: [0], wire: [1, 2] },
  grater: { solid: [0], wire: [1], cut: range(2, 8) },
  // The blade and the handle filled (the handle closes along the frame); the frame and the pins stay lines
  peeler: { solid: [1], closed: [4], wire: [0, 2, 3] },
  'cutting-board': { solid: [0], cut: [1] },
  'measuring-cup': { solid: [0], wire: [1], cut: [2, 3, 4] },
  'measuring-cup-sync': { solid: [0], wire: [1], cut: [2, 3, 4] },
  'measuring-spoons': { solid: [1, 3, 5], wire: [0, 2, 4, 6] },
  'can-opener': { solid: [0, 3], cut: [1], wire: [2, 4, 5] },
  'pizza-cutter': { solid: [0, 3], cut: [1], wire: [2] },
  'pizza-peel': { solid: [0], closed: [1] },
  'ice-cream-scoop': { solid: [0, 3], closed: [1], wire: [2], seam: [SEAM['ice-cream-scoop']] },
  'pepper-mill': { solid: [0, 1], closed: [2], seam: [seamH(6.75, 17.25, 9.5)] },
  'piping-bag': { solid: [0, 1, 2], seam: [SEAM['piping-bag']] },
  'citrus-squeezer': { solid: [0], closed: [1], cut: [2, 3] },
  masher: { solid: [0], wire: [1, 2] },
  'meat-mallet': { solid: [0], closed: [1] },
  'meat-thermometer': { solid: [0], cut: [1], wire: [2] },
  colander: { solid: [0], wire: [1, 2, 3], cut: [4, 5, 6] },
  // The mesh filled, its wire and its ring knocked out through the rim
  strainer: { solid: [0], cut: [1, 2, 3, 4], wire: [5] },
  sifter: { solid: [0, ...range(3, 8)], wire: [2], seam: [seamH(3.5, 18, 10.75)] },
  'oven-mitt': { closed: [0], solid: [1], wire: [2], seam: [seamH(5.25, 18.75, 17.25)] },
  apron: { solid: [0], wire: [1, 2, 3], cut: [4] },
  'chef-hat': { solid: [0], seam: [seamH(6.25, 17.75, 16.75)] },
  'chef-hat-star': { solid: [0], seam: [seamH(6.25, 17.75, 16.75)] },
  // The head closes along the hat's band, which parts them
  'person-chef': { closed: [0], solid: [1, 2], seam: [seamH(8, 16, 9)] },
  'utensil-holder': { solid: [0, 1, 5], wire: [2, 3, 4, 6] },
  'knife-block': { solid: [0], closed: [1, 2, 3], seam: [line([2.25, 15.04], [21.75, 9.46])] },
  whetstone: { solid: [0, 1], closed: [2] },
  pantry: { solid: [0], wire: [1], cut: [2, 3] },
  'pantry-plus': { solid: [0], wire: [1], cut: [2, 3] },
  kitchen: { solid: [0], closed: [2], wire: [1], cut: [4, 5], seam: [vl(12, 10.25, 22.25)] },
  'kitchen-sink': { closed: [1], wire: [0, 2] },
  // The block closes behind the stools (3 above the floor), which stay lines over it
  // The top and the cabinet parted along the top's underside (a hair below it, so no sliver of the
  // overhang's edge is left), the drawer cut across the cabinet
  'kitchen-island': { solid: [0, 3], closed: [1], wire: [4, 5], seam: [seamH(1.75, 22.25, 10.85), seamH(1.75, 13.25, 14.75)] },
  'food-container': CONTAINER_FILL(),
  'food-container-clock': CONTAINER_FILL(),
  'food-container-plus': CONTAINER_FILL(),
  'food-container-alert': CONTAINER_FILL(),
  'lunch-box': { solid: [0], closed: [1], wire: [2], cut: [3], seam: [seamH(1.75, 22.25, 11.5)] },
  'canning-jar': { closed: [0], solid: [1], seam: [seamH(5.25, 18.75, 6.75)] },
  'freezer-bag': { solid: [0], cut: [2, 3, 4], seam: [seamH(2.75, 21.25, 7.75)] },
  'freezer-safe': { ...CONTAINER_FILL(12.75), lines: [2, 3, 4] },
  'dishwasher-safe': { solid: [0, 1, 2, 3, 5], cut: [4] },
  'food-safe': { solid: [0], wire: [1, 2], lines: [3, 4] },
  plate: { solid: [0], cut: [1] },
  'plate-plus': { solid: [0], cut: [1] },
  'plate-check': { solid: [0], cut: [1] },
  'plate-clock': { solid: [0], cut: [1] },
  bowl: { solid: [0], closed: [1] },
  'cake-stand': { solid: [0], closed: [1] },
  'cooking-pot': POT_FILL(),
  // Under a badge the seam stops short of it: run through, it left a sliver of the body by the badge
  'cooking-pot-clock': { ...POT_FILL(), seam: [seamH(2.75, 14.75, 10)] },
  'cooking-pot-check': { ...POT_FILL(), seam: [seamH(2.75, 14.75, 10)] },
  cooking: { ...POT_FILL(8.25), solid: [1, 5, 6, 7] },
  // The bubbles stay rings over the open pot
  boil: { solid: [0], wire: [1, 2], lines: [3, 4, 5] },
  // The lid, tipped on the rim, stays a line: filled, the sliver of paper under it changed with the weight
  simmer: { solid: [0], wire: [1, 2, 3, 4, 5] },
  saucepan: { closed: [0, 2], solid: [1], wire: [3], seam: [seamH(1.75, 16.5, 11)] },
  'frying-pan': { solid: [0], wire: [1] },
  fry: { solid: [0, 2, 3, 4], wire: [1] },
  saute: { solid: [0, 3, 4], wire: [1], lines: [2] },
  flambe: { solid: [0], closed: [2], wire: [1], seam: [seamH(1.75, 16.75, 14.5)] },
  // The basket parted from the pot by its own outline, run up through the rim
  'deep-fry': { solid: [0], wire: [1, 2, 4], lines: [5, 6], seam: ['M8 9.5V15.75A1.5 1.5 0 0 0 9.5 17.25H14V9.5'] },
  wok: { solid: [0], closed: [2], wire: [1] },
  'pot-lid': { solid: [0], closed: [1] },
  griddle: { solid: [0], closed: [1], wire: [2, 3], seam: [`M20.5 10.5L${ellArc([12, 10.5], 7.5, 3.5, 0, 180).slice(1)}L3.5 10.5`] },
  'pressure-cooker': { closed: [0], solid: [1], wire: [2, 3], seam: [seamH(2.75, 20.25, 12)] },
  steam: { solid: [0, 2], lines: [3, 4, 5], seam: [seamH(2.5, 21.5, 13), seamH(2.5, 21.5, 17.25)] },
  'baking-sheet': { solid: [0], cut: [1] },
  'baking-dish': { solid: [0], wire: [1, 2] },
  'roasting-pan': { solid: [0], closed: [1, 2], wire: [3, 4, 5, 6] },
  'loaf-pan': { solid: [0], closed: [1], seam: [seamH(1.75, 22.25, 9.25)] },
  bake: { solid: [0], closed: [1], lines: [2, 3, 4], seam: [seamH(1.75, 22.25, 14.25)] },
  'muffin-tin': { solid: [0], cut: range(1, 7) },
  'pie-dish': { solid: [0] },
  barbecue: { solid: [0], wire: [2, 3, 4, 5], seam: [seamH(4.5, 19.5, 12)] },
  // The grate filled, its bars knocked out as slots
  grill: { solid: [0, 4, 5, 6], seam: [vl(7.25, 6, 8), vl(12, 6, 8), vl(16.75, 6, 8)] },
  'smoker-grill': { solid: [0], closed: [2], wire: [3, 4], seam: [seamH(1.75, 22.25, 13)] },
  rotisserie: { solid: [0, 5, 6, 7], wire: [3, 4], seam: [vl(10, 4, 13.5), vl(13, 4, 13.5)] },
  chop: { solid: [0, 1, 3, 4, 5], closed: [2], seam: [CHOP_KNIFE(line([7.5, 8.5], [7.5, 15]))] },
  'mixing-bowl': { solid: [0], closed: [1], wire: [2, 3, 4] },
  seasoning: { solid: [0, 1, 2, 3, 4], seam: [SEAM.seasoning] },
  ferment: { closed: [0], solid: [1], cut: [2, 3, 4] },
  pour: { solid: [0], wire: [1], lines: [2] },
  rinse: { solid: [0, 7, 8, 9], wire: [1, 2, 3], cut: [4, 5, 6] },
  thaw: { solid: [11], wire: [10], lines: range(0, 10) },
  'heat-level': { solid: [0, 2, 3, 4], wire: [1] },
  doneness: { solid: [0], cut: [1, 2] },
  cookbook: { solid: [0], cut: [1, 2, 3] },
  'recipe-box': { solid: [0], closed: [1], wire: [2], seam: [seamH(1.75, 22.25, 12)] },
  'recipe-stand': { closed: [0], solid: [2], cut: [1], wire: [3, 4] },
  ingredients: { solid: [0, 1, 2, 3], seam: [seamH(1.75, 11.25, 12.75), seamH(14, 20, 5.5)] },
  servings: { solid: [0, 2], closed: [1] },
  'knife-clock': { solid: [0], closed: [1], seam: [heel(7.5, 8.75, 14.75)] },
  'calendar-utensils': { solid: [0], lines: [1, 2], cut: range(3, 7) },
  'meal-breakfast': { solid: [0], closed: [1], lines: range(2, 7) },
  'meal-lunch': { solid: [0, 1], lines: range(2, 9) },
  'meal-dinner': { solid: [0, 1] },
};
// The recipe card closes 3 short of the spoon lying across its corner; the spoon's bowl is filled
// and its handle, over the card, keeps a clearance of paper
for (const name of ['recipe', 'recipe-plus', 'recipe-heart', 'recipe-search', 'recipe-check']) FILL[name] = { closed: [0], cut: [1, 2, 3], lines: [4, 5] };
// The pizza cutter's neck shows only where it leaves the wheel, clear of the hub's hole
FILL['pizza-cutter'].wire = [];
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? shut(d[i]) : d[i]));
  const pick = (ix) => (ix ?? []).map((i) => d[i]);
  const cut = [...pick(spec.cut), ...(spec.seam ?? [])];
  icons[name].fill = { solid, ...(cut.length && { cut }), ...(spec.lines?.length && { lines: pick(spec.lines) }), ...(spec.wire?.length && { wire: pick(spec.wire) }) };
}
{
  // The oven's dome is filled around its open mouth (the dome's outline and the mouth's, as one),
  // the floor running under the mouth; the flame inside it filled too
  const [, chimney, , fire] = icons['pizza-oven'].d;
  icons['pizza-oven'].fill = { solid: ['M2.75 20.75C2.75 12.5 6.75 7 12 7S21.25 12.5 21.25 20.75H16.25V16A4.25 4.25 0 0 0 7.75 16V20.75Z', shut(chimney), fire], wire: [hl(7.75, 16.25, 20.75)] };
}
icons['pizza-cutter'].fill.wire = [line(polar(8.25, 15.25, 5.75, -45), rot([15.5, 15.25], [8.25, 15.25], -45))];
// Lines only (a fork, a stack of plates side-on, the induction coil): their filled version is the
// outline itself
for (const name of ['fork', 'induction-safe', 'dishes']) icons[name].fill = false;

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
const PARTS = {
  'measuring-cup-sync': { jug: [0, 1], marks: [2, 3, 4] },
  'chef-hat-star': { hat: [0, 1] },
  'pantry-plus': { cupboard: [0, 1], jar: [2, 3] },
  'food-container-clock': { lid: [0], body: [1] },
  'food-container-plus': { lid: [0], body: [1] },
  'food-container-alert': { lid: [0], body: [1] },
  'plate-plus': { plate: [0, 1] },
  'plate-check': { plate: [0, 1] },
  'plate-clock': { plate: [0, 1] },
  'cooking-pot': { body: [0], lid: [1, 2], handle: [3, 4] },
  'cooking-pot-clock': { body: [0], lid: [1, 2], handle: [3, 4] },
  'cooking-pot-check': { body: [0], lid: [1, 2], handle: [3, 4] },
  cooking: { body: [0], lid: [1, 2], handle: [3, 4], flames: [5, 6, 7] },
  boil: { body: [0], handle: [1, 2], bubbles: [3, 4, 5] },
  simmer: { body: [0], lid: [1, 2], handle: [3, 4], steam: [5] },
  fry: { pan: [0, 1], oil: [2, 3, 4] },
  flambe: { pan: [0, 1], flame: [2] },
  'deep-fry': { body: [0], handle: [1, 2], basket: [3, 4], bubbles: [5, 6] },
  'pressure-cooker': { body: [0], lid: [1, 2], steam: [3] },
  steam: { steamer: [0, 1, 2], steam: [3, 4, 5] },
  bake: { pan: [0, 1], heat: [2, 3, 4] },
  grill: { grate: [0, 1, 2, 3], flames: [4, 5, 6] },
  rotisserie: { roast: [0, 1, 2], spit: [3, 4], flames: [5, 6, 7] },
  seasoning: { shaker: [0, 1], grains: [2, 3, 4] },
  ferment: { jar: [0], lid: [1], bubbles: [2, 3, 4] },
  pour: { jug: [0, 1], stream: [2] },
  rinse: { colander: range(0, 7), drops: [7, 8, 9] },
  thaw: { snowflake: range(0, 10), drop: [10, 11] },
  'heat-level': { pan: [0, 1], level: [2, 3, 4] },
  doneness: { cut: [0], level: [1, 2] },
  'recipe-plus': { card: [0, 1, 2, 3], spoon: [4, 5] },
  'recipe-heart': { card: [0, 1, 2, 3], spoon: [4, 5] },
  'recipe-search': { card: [0, 1, 2, 3], spoon: [4, 5] },
  'recipe-check': { card: [0, 1, 2, 3], spoon: [4, 5] },
  'knife-clock': { blade: [0], handle: [1] },
  whisk: { wires: [0, 1, 2], handle: [3] },
  'meal-breakfast': { plate: [0], sun: [1], rays: range(2, 7) },
  'meal-lunch': { plate: [0], sun: [1], rays: range(2, 9) },
  'meal-dinner': { plate: [0], moon: [1] },
};
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
const MOTION = {
  'measuring-cup-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'chef-hat-star': { effect: 'beat', parts: ['badge'], origin: BC },
  'food-container-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'plate-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'cooking-pot-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'knife-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'recipe-heart': { effect: 'beat', parts: ['badge'], origin: BC },
  'food-container-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  whisk: { effect: 'wiggle', parts: ['wires', 'handle'], origin: [12, 21.25] },
  cooking: { effect: 'wiggle', parts: ['flames'], origin: [12, 21.25] },
  boil: { effect: 'float', parts: ['bubbles'], vector: [0, -1.5] },
  simmer: { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  fry: { effect: 'bounce', parts: ['oil'], vector: [0, -1.5] },
  flambe: { effect: 'wiggle', parts: ['flame'], origin: [10, 14.5] },
  'pressure-cooker': { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  steam: { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  bake: { effect: 'float', parts: ['heat'], vector: [0, -1.5] },
  grill: { effect: 'wiggle', parts: ['flames'], origin: [12, 21.25] },
  rotisserie: { effect: 'wiggle', parts: ['flames'], origin: [12, 21.25] },
  seasoning: { effect: 'wiggle', parts: ['shaker'], origin: [16, 9.5] },
  ferment: { effect: 'float', parts: ['bubbles'], vector: [0, -1.5] },
  pour: { effect: 'slide', parts: ['stream'], vector: [0, 1.5] },
  rinse: { effect: 'slide', parts: ['drops'], vector: [0, 1.5] },
  thaw: { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Levels (DESIGN.md › Levels): the heat's flames from low to high; the doneness from the
// cooked band at the edge to the core ──────────────────────────────────────────────────────────
icons['heat-level'].levels = [[2], [3], [4]];
icons.doneness.levels = [[1], [2]];

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge: the filled enclosure doesn't draw it and at 58% it stops reading; the slash would
// cut through it.
offV(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every icon to the pixel grid; only the drawings that still clump at 16 px get
// their own, with fewer pieces, through pixel centers (0.75 + 1.5k) and 2 pixels apart.
const SMALL = {};
// Whisk: one loop and the middle wire, gathered into the handle
{
  const loop = 'M11.25 14.25C6.75 11.25 6.75 2.25 11.25 2.25S15.75 11.25 11.25 14.25';
  const wire = vl(11.25, 2.25, 15.75);
  const handle = capsule(9.75, 15.75, 3, 6);
  SMALL.whisk = { d: [loop, wire, handle], fill: { solid: [handle], wire: [loop, wire] } };
}
// Measuring spoons: two of them, square to each other on their ring
{
  const ring = circ(5.25, 18.75, 1.5);
  const up = ell([5.25, 6.75], 3, 4.5);
  const side = ell([17.25, 18.75], 4.5, 3);
  const handles = [vl(5.25, 11.25, 17.25), hl(6.75, 12.75, 18.75)];
  SMALL['measuring-spoons'] = { d: [ring, up, handles[0], side, handles[1]], fill: { solid: [up, side], wire: [ring, ...handles] } };
}
// Masher: the handle, its shaft and a W of wire with three points up
{
  const handle = capsule(9.75, 2.25, 3, 7.5);
  const shaft = vl(11.25, 9.75, 14.25);
  const zig = rline([[5.25, 14.25], [8.25, 20.25], [11.25, 14.25], [14.25, 20.25], [17.25, 14.25]], [0, 0.5, 0.5, 0.5, 0]);
  SMALL.masher = { d: [handle, shaft, zig], fill: { solid: [handle], wire: [shaft, zig] } };
}
// Grater: the tapered box, its loop and two rows of two holes, a pixel each
{
  const body = roundpoly([[6.75, 8.25], [15.75, 8.25], [17.25, 21.75], [5.25, 21.75]], [1, 1, 1, 1]);
  const loop = 'M9.75 8.25V5.25A1.5 1.5 0 0 1 12.75 5.25V8.25';
  const holes = [9.75, 12.75].flatMap((x) => [12.75, 17.25].map((y) => dot(x, y, 0.1)));
  SMALL.grater = { d: [body, loop, ...holes], fill: { solid: [body], wire: [loop], cut: holes } };
}
// Muffin tin: the tray and two rows of three cups, a pixel each (rings of two pixels clumped into a
// checkerboard)
{
  const tray = sq(2.25, 5.25, 18, 13.5, 3);
  const cups = [9.75, 14.25].flatMap((y) => [6.75, 11.25, 15.75].map((x) => dot(x, y, 0.1)));
  SMALL['muffin-tin'] = { d: [tray, ...cups], fill: { solid: [tray], cut: cups } };
}
// Induction safe: the pan's base over three rings of the coil, a pixel apart (the loops ran together)
SMALL['induction-safe'] = { d: ['M3.75 3.75V6.75A1.5 1.5 0 0 0 5.25 8.25H17.25A1.5 1.5 0 0 0 18.75 6.75V3.75', ...[5.25, 11.25, 17.25].map((x) => circ(x, 14.25, 1.5))] };
// Strainer: the bowl under its rim, one wire down and one across, the handle
{
  const bowl = 'M3.75 9.75H15.75A6 6 0 0 1 3.75 9.75Z';
  const w = Math.sqrt(36 - 9);
  const mesh = [vl(9.75, 9.75, 15.75), hl(9.75 - w, 9.75 + w, 12.75)];
  const handle = hl(15.75, 21.75, 9.75);
  SMALL.strainer = { d: [bowl, ...mesh, handle], fill: { solid: [bowl], cut: mesh, wire: [handle] } };
}
// Citrus squeezer: the dome with one ridge on the dish
{
  const dish = roundpoly([[2.25, 15.75], [20.25, 15.75], [17.25, 20.25], [5.25, 20.25]], [0.5, 0.5, 1.5, 1.5]);
  const dome = 'M5.25 15.75C5.25 9.75 8.25 5.25 11.25 5.25S17.25 9.75 17.25 15.75';
  const ridge = vl(11.25, 8.25, 15.75);
  SMALL['citrus-squeezer'] = { d: [dish, dome, ridge], fill: { solid: [dish, shut(dome)], cut: [ridge] } };
}
// Grill: the low grate with two bars over three tall flames, 4 pixels apart
{
  const grate = sq(2.25, 3.75, 18, 6, 1.5);
  const bars = [vl(8.25, 3.75, 9.75), vl(14.25, 3.75, 9.75)];
  const fire = [5.25, 11.25, 17.25].map((x) => flame([x, 21.75], 1.5, 5.25));
  SMALL.grill = { d: [grate, ...bars, ...fire], fill: { solid: [grate, ...fire], cut: bars } };
}
// Cooking: the pot without its knob over three flames
{
  const lid = roundpoly([[3.75, 6.75], [18.75, 6.75], [17.25, 3.75], [5.25, 3.75]], [0.5, 0.5, 1, 1]);
  const body = rline([[5.25, 6.75], [5.25, 14.25], [17.25, 14.25], [17.25, 6.75]], [0, 1.5, 0, 0]);
  const handles = [hl(2.25, 5.25, 9.75), hl(17.25, 20.25, 9.75)];
  const fire = [5.25, 11.25, 17.25].map((x) => flame([x, 21.75], 1.5, 2.25));
  SMALL.cooking = { d: [body, lid, ...handles, ...fire], fill: { solid: [shut(body), lid, ...fire], cut: [hl(2.25, 20.25, 6.75)], wire: handles } };
}
// Heat level: the pan and three flames of rising height
{
  const pan = roundpoly([[2.25, 3.75], [15.75, 3.75], [14.25, 8.25], [3.75, 8.25]], [0.5, 0.5, 1.5, 1.5]);
  const handle = hl(15.25, 21.75, 5.25);
  const fire = [
    [5.25, 1.5],
    [11.25, 3.25],
    [17.25, 5],
  ].map(([x, h]) => flame([x, 21.75], 1.5, h));
  SMALL['heat-level'] = { d: [pan, handle, ...fire], fill: { solid: [pan, ...fire], wire: [handle] } };
}
// Rotisserie: the roast with one tie on the spit, three flames
{
  const roast = ell([11.25, 8.25], 6, 4.5);
  const tie = vl(11.25, 3.75, 12.75);
  const spit = [hl(2.25, 5.25, 8.25), hl(17.25, 21.75, 8.25)];
  const fire = [5.25, 11.25, 17.25].map((x) => flame([x, 21.75], 1.5, 2.25));
  SMALL.rotisserie = { d: [roast, tie, ...spit, ...fire], fill: { solid: [roast, ...fire], cut: [tie], wire: spit } };
}
// Thaw: a plainer snowflake (eight arms on the pixel grid) melting into the drop
{
  const c = [11.25, 6.75];
  const arms = [vl(c[0], 2.25, 11.25), hl(6.75, 15.75, c[1]), line([8.25, 3.75], [14.25, 9.75]), line([14.25, 3.75], [8.25, 9.75])];
  const drop = drop2([11.25, 18], 2.25);
  const stem = vl(11.25, 11.25, 18 - 2.25 * Math.SQRT2);
  SMALL.thaw = { d: [...arms, stem, drop], fill: { solid: [drop], lines: arms, wire: [stem] } };
}
// Doneness: the cut and its cooked core, 2 pixels apart
{
  const cut = roundpoly([[2.25, 9.75], [8.25, 6.75], [17.25, 6.75], [21.75, 9.75], [21.75, 15.75], [17.25, 18.75], [8.25, 18.75], [2.25, 15.75]], 1.5);
  const core = capsule(6.75, 11.25, 10.5, 3);
  SMALL.doneness = { d: [cut, core], fill: { solid: [cut], cut: [core] } };
}
for (const [name, small] of Object.entries(SMALL)) icons[name].small = small;

export default { category: 'cocina', label: 'Cocina y utensilios', icons };
