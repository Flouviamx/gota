// Herramientas (tools): hand tools, saws, power tools, measuring tools, fasteners and fittings,
// storage, ladders, paint and lifting gear. Everything is computed with the engine
// (engine/geometry.mjs) and the rules in DESIGN.md. The category adopts sistema's `wrench`,
// `screwdriver`, `hammer`, `tools` and `hex-nut` (drawn there, never redrawn here), and builds on
// their pieces:
// - The wrenches: every one is sistema's wrench handle (half-width 1.75, a round end) laid on the
//   diagonal, its working end at the top right.
// - The striking tools (mallet, sledgehammer, axe, hatchet, pickaxe, shovel) are drawn upright and
//   turned like sistema's hammer, on its handle (3 wide, a round end), so they lean the same way.
// - The pliers share one construction: a pivot dot, the jaws above it and two handles that flare
//   from the joint to round ends, laid on the diagonal; only the jaws change.
// - The power tools are side views facing right. Those held like a pistol (the drill, the heat gun)
//   share one body: the motor housing, the same grip and trigger, and a battery under the grip where
//   they have one. The saws keep the handle their kind is known by: the jigsaw's closed top handle,
//   the circular saw's D grip over its blade, the chainsaw's top handle.
// - The saws share one tooth rhythm (TEETH) and the fasteners are upright side views at one scale.
// Whatever passes in front of another piece goes in `badge` (the engine clears the base) or is cut
// with `behind`, never trimmed by hand.
import { arc, badge, circ, dot, f, halfChord, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import sistema from './sistema.mjs';

// ── Paths as segments (cocina's): xf() moves and turns a path, behind() keeps what shows of a
// stroke behind closed shapes ─────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
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
  // A half circle keeps exactly half its chord as written for its radius (DESIGN.md › Circles are exact)
  const R = Math.abs(Math.abs(s.da) - Math.PI) < 1e-6 ? halfChord(pt(s, 0), pt(s, 1)) : f(s.r);
  return `A${R} ${R} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${P(pt(s, 1))}`;
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
        const a = m(pt(g, 0));
        return { t: 'A', c, r: g.r * s, a0: Math.atan2(a[1] - c[1], a[0] - c[0]), da: g.da * (flip ? -1 : 1) };
      }),
    })),
  );
}
/** The point xf() would move `p` to. */
const xfPt = (p, { s = 1, deg = 0, o = [12, 12], to = o } = {}) => add2(rot([(p[0] - o[0]) * s, (p[1] - o[1]) * s], [0, 0], deg), to);
/** Open polyline with rounded corners (like roundpoly, without closing). */
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
    const lu = Math.hypot(...u);
    const lw = Math.hypot(...w);
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (w[0] / lw) * t, V[1] + (w[1] / lw) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** A capsule (a pill) between two points, `r` its half-width. */
function capsule(a, b, r) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const n = [-u[1] * r, u[0] * r];
  const A1 = [a[0] + n[0], a[1] + n[1]];
  const A2 = [a[0] - n[0], a[1] - n[1]];
  const B1 = [b[0] + n[0], b[1] + n[1]];
  const B2 = [b[0] - n[0], b[1] - n[1]];
  const R = halfChord(B1, B2);
  return `M${P(A1)}L${P(B1)}A${R} ${R} 0 0 0 ${P(B2)}L${P(A2)}A${R} ${R} 0 0 0 ${P(A1)}Z`;
}
/** The same path drawn the other way round (a hole in a fill: a contour of opposite winding). */
const rev = (d) =>
  ser(
    parse(d).map((sp) => ({
      closed: sp.closed,
      segs: sp.segs.toReversed().map((g) => {
        if (g.t === 'L') return { t: 'L', a: g.b, b: g.a };
        if (g.t === 'C') return { t: 'C', p: g.p.toReversed() };
        return { ...g, a0: g.a0 + g.da, da: -g.da };
      }),
    })),
  );
/** Signed area of a closed path (its winding: positive turns clockwise on screen). */
const area = (d) => samples(d).reduce((A, ring) => A + ring.reduce((a, q, i) => a + q[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * q[1], 0) / 2, 0);
/** A closed shape with holes: the inner contours drawn the other way round, so a fill leaves them open. */
const holed = (outer, ...inners) => outer + inners.map((d) => (Math.sign(area(d)) === Math.sign(area(outer)) ? rev(d) : d)).join('');
const Z = (d) => (/[zZ]\s*$/.test(d) ? d : `${d}Z`);
/** A closed shape mirrored about x = cx: `start` on the axis, `ops` the right half down to the axis again. */
function mirrored(start, ops, cx = 0) {
  const mir = (p) => [2 * cx - p[0], p[1]];
  const pts = [start, ...ops.map((o) => o.p)];
  let d = `M${P(start)}`;
  for (const o of ops) {
    if (o.t === 'L') d += `L${P(o.p)}`;
    else if (o.t === 'C') d += `C${P(o.c1)} ${P(o.c2)} ${P(o.p)}`;
    else d += `A${f(o.r)} ${f(o.r)} 0 ${o.large ?? 0} ${o.sweep} ${P(o.p)}`;
  }
  for (let i = ops.length - 1; i >= 0; i--) {
    const o = ops[i];
    const to = mir(pts[i]);
    if (i === 0 && near(to, start)) {
      if (o.t === 'C') d += `C${P(mir(o.c2))} ${P(mir(o.c1))} ${P(to)}`;
      else if (o.t === 'A') d += `A${f(o.r)} ${f(o.r)} 0 ${o.large ?? 0} ${o.sweep} ${P(to)}`;
      break;
    }
    if (o.t === 'L') d += `L${P(to)}`;
    else if (o.t === 'C') d += `C${P(mir(o.c2))} ${P(mir(o.c1))} ${P(to)}`;
    else d += `A${f(o.r)} ${f(o.r)} 0 ${o.large ?? 0} ${o.sweep} ${P(to)}`;
  }
  return `${d}Z`;
}
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const unit = (a, b) => {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
};

// ── Shared constructions ──────────────────────────────────────────────────────────────────────
const SIS = sistema.icons;

/** Upright → leaning right, as the pliers lie: the top goes to the top right (45° about the center). */
const lean = (d, to = [12, 12], s = 1) => xf(d, { deg: 45, s, to });
/** sistema's hammer: drawn upright, turned 45° and scaled 0.94 about the center, moved (-1.6, 1.6). */
const hammerTurn = (d, { s = 0.94, to = [10.4, 13.6] } = {}) => xf(d, { deg: 45, s, to });
/** sistema's hammer handle, upright: 3 wide, from `top` (open, it ends on the head) to a round end at `bottom`. */
const haft = (top, bottom = 21) => `M10.5 ${f(top)}V${f(bottom - 1.5)}A1.5 1.5 0 0 0 13.5 ${f(bottom - 1.5)}V${f(top)}`;

/**
 * The saws' tooth rhythm: points along an edge from x0 to x1 at height y, a tooth every 2.4 with a
 * steep front and a long back, 1.4 deep, pointing down (dir 1) or up (dir -1).
 */
function teeth(x0, x1, y, { dir = 1, pitch = 2.4, depth = 1.4 } = {}) {
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / pitch));
  const step = (x1 - x0) / n;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([x0 + i * step, y], [x0 + (i + 0.75) * step, y + dir * depth]);
  return pts;
}
// sistema's screwdriver in local coordinates (its handle, ferrule, groove and shaft), scaled 1.08
// and laid on the diagonal as sistema lays it; the chisel, the file and the putty knife keep its
// handle and ferrule.
const DRIVER_HANDLE = sq(0, -3, 8.5, 6, 1.85);
const DRIVER = [DRIVER_HANDLE, `M8.5 -1.75H10.15A0.6 0.6 0 0 1 10.75 -1.15V1.15A0.6 0.6 0 0 1 10.15 1.75H8.5`, line([2.75, 0], [5.75, 0])];
const onDriver = (d, o = [10.8, 0]) => xf(xf(d, { s: 1.08, o: [0, 0] }), { deg: -45, o, to: [12, 12] });

/**
 * A saw blade's rim: hooked teeth around (cx, cy) between radii r and R, from angle a0 to a1
 * (degrees, clockwise), a tooth every `step` degrees. The saws' blades all come from here.
 */
function sawRim(cx, cy, r, R, { a0 = -90, a1 = 270, step = 360 / 14, lead = 0.85 } = {}) {
  const n = Math.round((a1 - a0) / step);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + i * step;
    pts.push(polar(cx, cy, r, a), polar(cx, cy, R, a + step * lead));
  }
  return pts;
}
// The power tools' pistol body, facing right: the motor housing, the grip slanting back with its
// trigger in the crook, and the battery under it. Order: housing and grip, trigger, battery.
// The circular saw's arbor; the chainsaw laid on its slant (the bar 35° up to the right)
const SAW_C = [13.75, 13.75];
const CHAINSAW = { deg: -35, o: [9, -1], to: [12, 12] };
const PISTOL = [
  roundpoly([[2.75, 4.25], [15.25, 4.25], [15.25, 10.25], [10.5, 10.25], [9.25, 17.25], [4.75, 17.25], [5.75, 10.25], [2.75, 10.25]], [2, 1.5, 1.5, 0.75, 0.4, 0.4, 0.75, 1.75]),
  rline([[12.75, 10.25], [12.5, 12], [10.25, 13.25]], [0, 0.75, 0]),
  sq(3.25, 17.25, 8.5, 4, 1.25),
];
// The tripod the work light stands on: a pole down from `top` and two legs folded out from it
const TRIPOD = (top, x = 12) => [line([x, top], [x, 21.25]), rline([[x - 5.5, 21.25], [x, top + 2.75], [x + 5.5, 21.25]], [0, 0.5, 0])];
// lugares's droplet, for the glue's drop
const lugaresDrop = 'M17.13 8.37A7.25 7.25 0 1 1 6.87 8.37L12 3.25Z';

// The bungee cord's hook: an open J hanging from each end of the cord, curling in toward the
// middle.
// Drawn along the x axis from x 0 (where the cord ends) out to the left, then laid on the
// diagonal with the cord.
const HOOK = 'M0 0H-3.5A2.25 2.25 0 0 0 -3.5 4.5H-1.75';

// The wrenches are drawn along the x axis (sistema's handle: its round end at x 0, the head at the
// far end) and laid on the diagonal by onWrench(), as sistema lays its wrench: `o` goes to `to`.
const onWrench = (d, o = [7.875, 0], to = [12, 12]) => xf(d, { deg: -45, o, to });
// The ring spanner's middle: halfway between its open end's edge (x -3.9) and its ring's (x 18.75)
const RING_O = [7.425, 0];

// The pliers, upright about (0, 0) and laid on the diagonal by lean(): the jaws' tip at the top,
// the pivot (a dot) at y PIV, and two handles that flare from the joint to round ends. `jaw` is
// the right half from the tip to the joint (where the handle's outer edge starts); `spread` turns
// the handles open.
const PIV = -4.25;
function pliersBody(jaw, { spread = 0, root = [2.6, -1.2], end = [3.9, 7.5], hw = 1.35, crotch = 1 } = {}) {
  const E = rot(end, root, -spread);
  const dir = unit(root, E);
  const n = [dir[1], -dir[0]];
  const Eo = add2(E, mul(n, hw));
  const Ei = add2(E, mul(n, -hw));
  const ops = [...jaw.ops, { t: 'L', p: Eo }, { t: 'A', r: hw, sweep: 1, p: Ei }, { t: 'C', c1: add2(Ei, mul(dir, -3)), c2: [0.6, crotch + 0.9], p: [0, crotch] }];
  return mirrored(jaw.start, ops);
}
const at = (d, dx = 12, dy = 12) => transform(d, 1, dx, dy);

const icons = {
  // ── Wrenches ──
  'wrench-clock': {
    tags: ['mantenimiento', 'servicio programado', 'próximo servicio', 'maintenance', 'service due', 'scheduled'],
    d: [xf(SIS.wrench.d[0], { to: [13, 13] })],
    badge: badge('clock'),
  },
  'wrench-ring': {
    tags: ['llave de estrías', 'llave de anillo', 'mecánica', 'ring spanner', 'box-end wrench', 'mechanic'],
    d: (() => {
      // A combination spanner: the closed ring with its hex at the top right, the open end at the
      // bottom left; a lone ring on a handle read as a magnifier or a key
      const [h, R, Ro, w, L] = [1.6, 4.25, 3.9, 1.6, 14.5];
      const xo = Math.sqrt(Ro * Ro - h * h);
      const xm = Math.sqrt(Ro * Ro - w * w);
      const xr = L - Math.sqrt(R * R - h * h);
      const body = `M${f(xo)} ${f(-h)}H${f(xr)}A${R} ${R} 0 1 1 ${f(xr)} ${f(h)}H${f(xo)}A${Ro} ${Ro} 0 0 1 ${f(-xm)} ${f(w)}H-0.25A${w} ${w} 0 0 1 -0.25 ${f(-w)}H${f(-xm)}A${Ro} ${Ro} 0 0 1 ${f(xo)} ${f(-h)}Z`;
      const hex = roundpoly(Array.from({ length: 6 }, (_, i) => polar(L, 0, 1.45, i * 60)), 0.35);
      return [body, hex].map((d) => onWrench(d, RING_O));
    })(),
  },
  'wrench-adjustable': {
    tags: ['llave ajustable', 'perica', 'llave francesa', 'adjustable wrench', 'adjustable spanner', 'repair'],
    d: (() => {
      // A larger head with a square mouth; the seam under the mouth frees the sliding jaw
      const [L, R, m, h] = [13, 5.25, 1.6, 1.75];
      const x1 = L - Math.sqrt(R * R - h * h);
      const xj = L + Math.sqrt(R * R - m * m);
      const t = L - 0.25;
      const body = `M0 ${f(-h)}H${f(x1)}A${R} ${R} 0 0 1 ${f(xj)} ${f(-m)}H${f(t + 0.6)}A0.6 0.6 0 0 0 ${f(t)} ${f(-m + 0.6)}V${f(m - 0.6)}A0.6 0.6 0 0 0 ${f(t + 0.6)} ${f(m)}H${f(xj)}A${R} ${R} 0 0 1 ${f(x1)} ${f(h)}H0A${h} ${h} 0 0 1 0 ${f(-h)}Z`;
      const seam = line([t + 1.5, m], [t + 1.5, Math.sqrt(R * R - 1.25 * 1.25)]);
      return [onWrench(body, [8.6, 0]), onWrench(seam, [8.6, 0])];
    })(),
  },
  'pipe-wrench': {
    tags: ['llave stillson', 'llave de tubo', 'plomería', 'pipe wrench', 'plumbing', 'stillson'],
    d: (() => {
      // Upright, then on the diagonal: a heavy handle ending in the heel jaw, the hooked jaw on its
      // shank above it and the knurled nut between them; the mouth opens sideways
      const heel = roundpoly([[12.5, 22], [12.5, 13.25], [8, 13.25], [8, 10.5], [16, 10.5], [16, 22]], [1.75, 0.5, 0.75, 0.75, 0.75, 1.75]);
      const hook = roundpoly([[8, 2.5], [17.25, 2.5], [17.25, 7.5], [14.5, 7.5], [14.5, 5.25], [8, 5.25]], [0.75, 1, 0, 0, 0.5, 0.75]);
      const nut = sq(13.25, 7.5, 5.25, 3, 1.2);
      return [heel, hook, nut].map((d) => lean(d, [11.75, 12.4]));
    })(),
  },
  'torque-wrench': {
    tags: ['torquímetro', 'llave de torque', 'apriete', 'torque wrench', 'tightening', 'auto service'],
    d: (() => {
      // A long handle into the ratchet head; a gauge rests on the shaft, its needle on the scale
      const [h, L, r] = [1.5, 19, 3];
      const x1 = L - Math.sqrt(r * r - h * h);
      const body = `M0 ${f(-h)}H${f(x1)}A${r} ${r} 0 1 1 ${f(x1)} ${f(h)}H0A${h} ${h} 0 0 1 0 ${f(-h)}Z`;
      const o = [10.25, -0.75];
      const gauge = `M5.25 ${f(h)}A4.5 4.5 0 0 0 14.25 ${f(h)}`;
      const needle = line([9.75, h], polar(9.75, h, 4.5, 55));
      return [body, gauge, needle].map((d) => onWrench(d, o));
    })(),
  },
  'lug-wrench': {
    tags: ['llave de cruz', 'llanta', 'birlos', 'lug wrench', 'tire iron', 'flat tire'],
    d: (() => {
      const sock = (deg) => xf(sq(5.5, -1.75, 4.25, 3.5, 1), { deg, o: [0, 0], to: [12, 12] });
      const bar = (deg) => xf(line([-5.5, 0], [5.5, 0]), { deg, o: [0, 0], to: [12, 12] });
      return [bar(-45), bar(45), sock(-45), sock(45), sock(135), sock(225)];
    })(),
  },
  'hex-key': {
    tags: ['llave allen', 'llave hexagonal', 'armar muebles', 'hex key', 'allen key', 'assembly'],
    d: (() => {
      // An L of hex bar: the long arm, a tight bend, the short arm; flat ends
      const L = roundpoly([[0, -1.6], [16.5, -1.6], [16.5, 1.6], [3.2, 1.6], [3.2, 6.5], [0, 6.5]].map(([x, y]) => [x - 1.6, y]), [2.2, 0.4, 0.4, 0.6, 0.4, 0.4]);
      return [xf(L, { deg: -45, o: [7, 2.4], to: [12, 12] })];
    })(),
  },

  // ── Pliers ──
  pliers: {
    tags: ['pinzas', 'alicates', 'sujetar', 'pliers', 'grip', 'hand tool'],
    d: (() => {
      const jaw = { start: [0, -12.25], ops: [{ t: 'C', c1: [1.1, -11.4], c2: [3.3, -8.6], p: [3.4, -5.4] }, { t: 'C', c1: [3.5, -3.4], c2: [3.25, -2.2], p: [2.6, -1.2] }] };
      return [pliersBody(jaw), dot(0, PIV), line([0, -12.25], [0, PIV - 0.7])].map((d) => lean(at(d, 12, 11.5)));
    })(),
  },
  'pliers-needle-nose': {
    tags: ['pinzas de punta', 'alicates de punta', 'electrónica', 'needle-nose pliers', 'long-nose pliers', 'electronics'],
    d: (() => {
      const jaw = { start: [0, -13], ops: [{ t: 'C', c1: [0.55, -12.4], c2: [1.6, -9.6], p: [2.2, -7.6] }, { t: 'C', c1: [2.9, -5.4], c2: [3.6, -3.4], p: [2.6, -1.2] }] };
      return [pliersBody(jaw), dot(0, PIV)].map((d) => lean(at(d, 12, 11.75)));
    })(),
  },
  'wire-cutter': {
    tags: ['pinzas de corte', 'alicates de corte', 'cortar cable', 'wire cutter', 'diagonal cutters', 'snips'],
    d: (() => {
      // Short pointed jaws that close on one edge; the handles open wider
      const jaw = { start: [0, -10.5], ops: [{ t: 'C', c1: [1.6, -9.9], c2: [3.6, -8], p: [3.6, -5.6] }, { t: 'C', c1: [3.6, -3.6], c2: [3.3, -2.2], p: [2.6, -1.2] }] };
      return [pliersBody(jaw, { spread: 10 }), dot(0, PIV), line([0, -10.5], [0, PIV - 0.7])].map((d) => lean(at(d, 12, 10.5)));
    })(),
  },
  'wire-stripper': {
    tags: ['pelacables', 'pinzas pelacables', 'electricista', 'wire stripper', 'electrician', 'wiring'],
    d: (() => {
      // Long flat jaws; the stripping holes sit on their seam
      const jaw = { start: [0, -12.5], ops: [{ t: 'L', p: [3, -12.5] }, { t: 'A', r: 0.75, sweep: 1, p: [3.75, -11.75] }, { t: 'L', p: [3.75, -6] }, { t: 'C', c1: [3.75, -3.6], c2: [3.4, -2.2], p: [2.6, -1.2] }] };
      const holes = [dot(0, -8.75)];
      const seam = [line([0, -12.5], [0, -9.45]), line([0, -8.05], [0, PIV - 0.7])];
      return [pliersBody(jaw), dot(0, PIV), ...holes, ...seam].map((p) => lean(at(p, 12, 12.1), [12, 12], 0.9));
    })(),
  },
  'bolt-cutter': {
    tags: ['cizalla', 'corta pernos', 'cortar candado', 'bolt cutter', 'cutting', 'locksmith'],
    d: (() => {
      // Short thick jaws on a double pivot, long straight handles
      const jaw = { start: [0, -12.75], ops: [{ t: 'C', c1: [1.9, -12.75], c2: [3, -11.5], p: [3, -9.75] }, { t: 'L', p: [3, -6.75] }, { t: 'C', c1: [3, -5.75], c2: [2.4, -5.2], p: [2.1, -4.6] }] };
      const body = pliersBody(jaw, { root: [2.1, -4.6], end: [3.6, 8.25], hw: 1.2, crotch: -2.5 });
      return [body, dot(0, -8.25)].map((d) => lean(at(d, 12, 11.85), [12, 12], 0.97));
    })(),
  },

  // ── Striking, chopping and digging ──
  mallet: {
    tags: ['mazo', 'mazo de goma', 'golpear', 'mallet', 'rubber mallet', 'woodworking'],
    d: (() => {
      const head = sq(4, 2, 16, 7.25, 3);
      return [head, line([7.5, 2], [7.5, 9.25]), line([16.5, 2], [16.5, 9.25]), haft(9.25, 21.25)].map((d) => hammerTurn(d));
    })(),
  },
  sledgehammer: {
    tags: ['marro', 'mazo', 'demolición', 'sledgehammer', 'demolition', 'heavy'],
    d: (() => {
      const head = roundpoly([[5.5, 4], [7, 2.5], [17, 2.5], [18.5, 4], [18.5, 8.25], [17, 9.75], [7, 9.75], [5.5, 8.25]], 0.5);
      return [head, haft(9.75, 23)].map((d) => hammerTurn(d, { s: 0.88, to: [10.6, 13.4] }));
    })(),
  },
  crowbar: {
    tags: ['barreta', 'pata de cabra', 'palanca', 'crowbar', 'pry bar', 'demolition'],
    d: (() => {
      // A bar curled over into a forked claw at the top; the other end flattened into a chisel
      const [c, R, r] = [[11.6, 6.25], 3.85, 1.15];
      const end = 30;
      const o = polar(...c, R, end);
      const i = polar(...c, r, end);
      const bar = `M7.75 19.5V6.25${arc(...c, R, 180, 360 + end).d.replace(/^M[^A]*/, '')}L${P(i)}${arc(...c, r, 360 + end, 180).d.replace(/^M[^A]*/, '')}V19.5L9.6 21.75A0.75 0.75 0 0 1 8.8 22.4L7.75 19.5Z`;
      return [xf(bar, { deg: 38, to: [12.75, 12.5] })];
    })(),
  },
  axe: {
    tags: ['hacha', 'leña', 'cortar madera', 'axe', 'firewood', 'chopping'],
    d: (() => {
      const head = `M10.25 3.25L5.5 1.75A13 13 0 0 0 5.5 12.5L10.25 8.75H13.75A1 1 0 0 0 14.75 7.75V4.25A1 1 0 0 0 13.75 3.25Z`;
      return [head, haft(8.75, 22.5)].map((d) => hammerTurn(d, { s: 0.86, to: [11, 13] }));
    })(),
  },
  hatchet: {
    tags: ['hachuela', 'hacha de mano', 'campismo', 'hatchet', 'camping', 'kindling'],
    d: (() => {
      // A compact blade and a flat hammer poll behind the eye, on a short handle
      const head = `M10.25 4L6.25 2.75A10 10 0 0 0 6.25 11.25L10.25 9.25H17.25A1 1 0 0 0 18.25 8.25V5A1 1 0 0 0 17.25 4Z`;
      return [head, haft(9.25, 19.75), line([15, 4], [15, 9.25])].map((d) => hammerTurn(d, { s: 1, to: [11.6, 12.4] }));
    })(),
  },
  pickaxe: {
    tags: ['pico', 'zapapico', 'excavar', 'pickaxe', 'pick', 'mining'],
    d: (() => {
      const head = `M2.75 9A9.97 9.97 0 0 1 21.25 9A14.79 14.79 0 0 0 2.75 9Z`;
      return [head, haft(5.75, 22)].map((d) => hammerTurn(d, { s: 0.9, to: [11.4, 12.9] }));
    })(),
  },
  shovel: {
    tags: ['pala', 'excavar', 'obra', 'shovel', 'digging', 'construction'],
    d: (() => {
      const grip = sq(8.5, 1.75, 7, 3, 1.5);
      const shaft = 'M10.5 4.75V11.5M13.5 4.75V11.5';
      const blade = mirrored([12, 11.5], [{ t: 'L', p: [16.25, 11.5] }, { t: 'A', r: 1.25, sweep: 1, p: [17.5, 12.75] }, { t: 'L', p: [17.5, 15] }, { t: 'C', c1: [17.5, 18.25], c2: [14.5, 20.75], p: [12, 22.5] }], 12);
      return [blade, shaft, grip].map((d) => lean(d, [12, 12], 0.92));
    })(),
  },

  // ── Saws, blades and edge tools ──
  'hand-saw': {
    tags: ['serrucho', 'sierra de mano', 'carpintería', 'hand saw', 'saw', 'woodworking'],
    ...(() => {
      // A tapered blade, its teeth along the bottom (TEETH), into a closed handle
      const t = teeth(21.5, 9.25, 14.75).slice(1);
      const blade = roundpoly([[8.5, 6.75], [21.5, 11.25], [21.5, 14.75], ...t, [8.5, 14.75]], [0, 0.75, 0, ...t.map(() => 0), 0]);
      const handle = roundpoly([[2.25, 5.25], [9, 4], [10.25, 16.75], [4, 19.5]], [2, 1, 1, 2]);
      const slot = line([6.25, 9], [6.75, 15]);
      const on = (d) => xf(d, { deg: 18, to: [12, 11.5] });
      return { d: [behind(blade, [handle], 0.01, 0.5), handle, slot].map(on), fill: { solid: [on(blade), on(handle)], cut: [on(slot)] } };
    })(),
  },
  hacksaw: {
    tags: ['segueta', 'arco de sierra', 'cortar metal', 'hacksaw', 'metal saw', 'metalwork'],
    d: (() => {
      // A C frame over a thin toothed blade, a pistol grip at the back
      const frame = rline([[6.25, 13.5], [6.25, 6.25], [21.25, 6.25], [21.25, 13.5]], [0, 1.5, 1.5, 0]);
      const blade = line([6.25, 13.5], ...teeth(9.25, 21.25, 13.5), [21.25, 13.5]);
      const grip = roundpoly([[6.25, 12], [8, 13.5], [5.25, 20.75], [2.25, 19.75]], [0, 0.5, 1.4, 1.4]);
      return [frame, blade, grip];
    })(),
  },
  'utility-knife': {
    tags: ['cúter', 'navaja', 'cortar', 'utility knife', 'box cutter', 'blade'],
    d: (() => {
      // The body with its thumb slider; the blade's angled tip out of the front
      const body = 'M1.5 -2.25H8.25A1 1 0 0 1 10.25 -2.25H14.5A1.5 1.5 0 0 1 16 -0.75V0.75A1.5 1.5 0 0 1 14.5 2.25H1.5A1.5 1.5 0 0 1 0 0.75V-0.75A1.5 1.5 0 0 1 1.5 -2.25Z';
      const blade = rline([[16, -1.5], [19.25, -1.5], [22.25, 1.5], [16, 1.5]], [0, 0.3, 0.3, 0]);
      return [body, blade].map((d) => onWrench(d, [11.1, 0]));
    })(),
  },
  chisel: {
    tags: ['formón', 'cincel', 'carpintería', 'chisel', 'woodworking', 'carving'],
    d: (() => {
      // sistema's screwdriver handle and ferrule, then a flat blade with its bevel
      const [handle, ferrule] = DRIVER.slice(0, 2);
      const blade = rline([[10.75, -1.25], [12.25, -2.25], [18.75, -2.25], [18.75, 2.25], [12.25, 2.25], [10.75, 1.25]], [0, 0.4, 0.4, 0.4, 0.4, 0]);
      const bevel = line([16.5, -2.25], [16.5, 2.25]);
      return [handle, ferrule, blade, bevel].map((d) => onDriver(d, [10.15, 0]));
    })(),
  },
  'metal-file': {
    tags: ['lima', 'escofina', 'limar', 'metal file', 'rasp', 'deburring'],
    d: (() => {
      // sistema's screwdriver handle and ferrule, then a long tapering blade crossed by its teeth
      const [handle, ferrule] = DRIVER.slice(0, 2);
      const blade = rline([[10.75, -1.75], [20.25, -1.25], [20.25, 1.25], [10.75, 1.75]], [0, 1.2, 1.2, 0]);
      const hw = (x) => 1.75 - ((x - 10.75) / 9.5) * 0.5;
      const cuts = [12.75, 15.5, 18.25].map((x) => line([x - 0.9, hw(x - 0.9)], [x + 0.9, -hw(x + 0.9)]));
      return [handle, ferrule, blade, ...cuts].map((d) => onDriver(d, [10.95, 0]));
    })(),
  },
  'hand-plane': {
    tags: ['cepillo de carpintero', 'garlopa', 'cepillar', 'hand plane', 'woodworking', 'smoothing'],
    d: (() => {
      // Side view, facing right: the low body, the rear tote, the iron at its angle, the front knob
      const body = sq(2.5, 14, 19, 5, 1.5);
      const tote = rline([[4, 14], [3.25, 7], [4.25, 5.75], [6.75, 5.75], [9.25, 14]], [0, 1, 1, 1, 0]);
      const iron = line([10.75, 14], [14.5, 8.25]);
      const knob = `M16.25 14V12.75A1.75 1.75 0 0 1 19.75 12.75V14`;
      return [body, tote, iron, knob];
    })(),
  },
  'putty-knife': {
    tags: ['espátula', 'resanar', 'pintura', 'putty knife', 'scraper', 'spackle'],
    d: (() => {
      // sistema's screwdriver handle and ferrule, then a wide flat blade
      const [handle, ferrule] = DRIVER.slice(0, 2);
      const blade = rline([[10.75, -1.25], [13.25, -3.5], [18.75, -3.5], [18.75, 3.5], [13.25, 3.5], [10.75, 1.25]], [0, 1, 0.6, 0.6, 1, 0]);
      return [handle, ferrule, blade].map((d) => onDriver(d, [10.6, 0]));
    })(),
  },
  sandpaper: {
    tags: ['lija', 'lijar', 'abrasivo', 'sandpaper', 'sanding', 'grit'],
    d: (() => {
      // A sheet whose top right corner curls up, a field of grit
      const sheet = clip(sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), (q) => q[0] - q[1] < 11 - 1e-3);
      const curl = 'M14.25 3.25C14.25 7.5 16.5 9.75 20.75 9.75C19.25 7.25 16.75 4.75 14.25 3.25Z';
      const grit = [[7.25, 7.75], [10.75, 7.75], [9, 11], [12.5, 11], [7.25, 14.25], [10.75, 14.25], [14.25, 14.25], [9, 17.5], [12.5, 17.5], [16, 17.5], [17.75, 14.25]].map(([x, y]) => dot(x, y, 0.3));
      return [sheet, curl, ...grit];
    })(),
  },
  'saw-blade': {
    tags: ['disco de sierra', 'hoja circular', 'corte', 'saw blade', 'circular blade', 'cutting'],
    d: (() => {
      // A disc ringed with hooked teeth, the arbor hole in the middle
      const pts = sawRim(12, 12, 7.1, 9.4);
      return [roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.25 : 0.6))), circ(12, 12, 2.25)];
    })(),
  },
  'drill-bit': {
    tags: ['broca', 'barrena', 'taladrar', 'drill bit', 'bit', 'drilling'],
    d: (() => {
      // A plain shank, the fluted body (its spiral as slanted strokes) and the point
      const bit = roundpoly([[9.75, 2.75], [14.25, 2.75], [14.25, 17.25], [12, 21.5], [9.75, 17.25]], [1, 1, 0.5, 0.4, 0.5]);
      const flutes = [9.5, 12.5, 15.25].map((y) => line([9.75, y + 1.4], [14.25, y - 1.4]));
      return [bit, line([9.75, 7.5], [14.25, 7.5]), ...flutes];
    })(),
  },

  // ── Fasteners (upright side views at one scale: heads 9.5–10.5 wide, shanks 4.5) ──
  screw: {
    tags: ['tornillo', 'pijas', 'fijación', 'screw', 'fastener', 'hardware'],
    d: (() => {
      const head = 'M6.75 7.5C6.75 4.25 9.25 3 12 3S17.25 4.25 17.25 7.5Z';
      const shank = `M9.75 7.5V16.5L12 21.5L14.25 16.5V7.5`;
      const slot = line([12, 3], [12, 5.5]);
      const threads = [11, 14].map((y) => line([9.75, y + 1.25], [14.25, y - 1.25]));
      return [head, shank, slot, ...threads];
    })(),
  },
  'hex-bolt': {
    tags: ['perno', 'tornillo hexagonal', 'pieza', 'hex bolt', 'bolt', 'fastener'],
    d: (() => {
      const head = sq(6.75, 2.75, 10.5, 5, 1);
      const faces = [10.25, 13.75].map((x) => line([x, 2.75], [x, 7.75]));
      const shank = `M9.75 7.75V19.75A1.5 1.5 0 0 0 11.25 21.25H12.75A1.5 1.5 0 0 0 14.25 19.75V7.75`;
      const threads = [13.5, 16.5, 19.5].map((y) => line([9.75, y + 1.25], [14.25, y - 1.25]));
      return [head, ...faces, shank, ...threads];
    })(),
  },
  nail: {
    tags: ['clavo', 'clavar', 'fijación', 'nail', 'fastener', 'framing'],
    d: (() => {
      // Its flat head across the top, the shank down to a point, laid on the diagonal
      const head = sq(6.75, 2.5, 10.5, 2.75, 1.25);
      const shank = `M10.5 5.25V18L12 22L13.5 18V5.25`;
      return [head, shank].map((d) => lean(d, [12, 12]));
    })(),
  },
  washer: {
    tags: ['rondana', 'arandela', 'ferretería', 'washer', 'fastener', 'hardware'],
    d: (() => {
      // A flat ring seen from above at an angle, its thickness showing below
      const top = `M3.5 10.75A8.5 4.75 0 1 0 20.5 10.75A8.5 4.75 0 1 0 3.5 10.75Z`;
      const side = `M3.5 10.75V13.5A8.5 4.75 0 0 0 20.5 13.5V10.75`;
      const hole = `M8.5 10.75A3.5 1.75 0 1 0 15.5 10.75A3.5 1.75 0 1 0 8.5 10.75Z`;
      return [top, side, hole];
    })(),
    fill: {
      // The face with its hole (the opposite winding), the band of its thickness under it
      solid: ['M3.5 10.75A8.5 4.75 0 1 1 20.5 10.75A8.5 4.75 0 1 1 3.5 10.75ZM8.5 10.75A3.5 1.75 0 1 0 15.5 10.75A3.5 1.75 0 1 0 8.5 10.75Z', 'M3.5 10.75V13.5A8.5 4.75 0 0 0 20.5 13.5V10.75A8.5 4.75 0 0 1 3.5 10.75Z'],
      cut: ['M3.5 10.75A8.5 4.75 0 0 0 20.5 10.75'],
    },
  },
  rivet: {
    tags: ['remache', 'remachar', 'lámina', 'rivet', 'pop rivet', 'sheet metal'],
    d: (() => {
      // The domed head on its sleeve; the mandrel's stem out of the top
      const head = `M6.5 11.5C6.5 9 9 7.75 12 7.75S17.5 9 17.5 11.5Z`;
      const sleeve = `M9.75 11.5V19.5A1.75 1.75 0 0 0 11.5 21.25H12.5A1.75 1.75 0 0 0 14.25 19.5V11.5`;
      const stem = line([12, 2.75], [12, 7.75]);
      return [head, sleeve, stem];
    })(),
  },
  'wall-plug': {
    tags: ['taquete', 'taco', 'fijar a la pared', 'wall plug', 'anchor', 'mounting'],
    d: (() => {
      // A ribbed sleeve with fins and a split tip; a screw entering its open end
      const right = [[15.25, 8.5], ...[10.25, 13.25, 16.25].flatMap((y) => [[14.5, y], [15.75, y], [14.25, y + 2.75]]), [13.75, 21.25]];
      const plug = roundpoly([...right, ...right.toReversed().map(([x, y]) => [24 - x, y])], 0.3);
      const split = line([12, 21.25], [12, 17.75]);
      const head = sq(8.25, 2.75, 7.5, 2.5, 1.25);
      const shank = line([12, 5.25], [12, 8.5]);
      return [plug, split, head, shank];
    })(),
  },
  'eye-bolt': {
    tags: ['armella', 'cáncamo', 'izar', 'eye bolt', 'rigging', 'lifting'],
    d: (() => {
      // A closed ring on top of a threaded shank
      const ring = circ(12, 7.5, 4.75);
      const hole = circ(12, 7.5, 1.75);
      const y0 = 7.5 + Math.sqrt(4.75 ** 2 - 2.25 ** 2);
      const shank = `M9.75 ${f(y0)}V19.75A1.5 1.5 0 0 0 11.25 21.25H12.75A1.5 1.5 0 0 0 14.25 19.75V${f(y0)}`;
      const threads = [15.25, 18.25].map((y) => line([9.75, y + 1.25], [14.25, y - 1.25]));
      return [ring, hole, shank, ...threads];
    })(),
  },

  // ── Power tools (side views facing right, on one pistol body) ──
  drill: {
    tags: ['taladro', 'taladro inalámbrico', 'perforar', 'drill', 'power drill', 'cordless'],
    d: [...PISTOL, sq(15.25, 5.5, 2.75, 3.5, 0.75), line([18, 7.25], [21.5, 7.25])],
  },
  'heat-gun': {
    tags: ['pistola de calor', 'decapar', 'termocontraíble', 'heat gun', 'hot air', 'paint stripping'],
    d: (() => {
      // The pistol body (a little smaller, to leave the heat room), its housing narrowing into the
      // nozzle; three waves of heat in front of it
      const body = roundpoly([[2.75, 4.25], [15.25, 4.25], [16.75, 5.75], [16.75, 8.75], [15.25, 10.25], [10.5, 10.25], [9.25, 17.25], [4.75, 17.25], [5.75, 10.25], [2.75, 10.25]], [2, 1, 0.6, 0.6, 1, 0.75, 0.4, 0.4, 0.75, 1.75]);
      const small = (d) => xf(d, { s: 0.86, o: [2.75, 17.25], to: [2.75, 18] });
      const wave = (y) => `M17.75 ${f(y)}A1.25 1.25 0 0 1 19.625 ${f(y)}A1.25 1.25 0 0 0 21.5 ${f(y)}`;
      return [small(body), small(PISTOL[1]), ...[5.75, 9.25, 12.75].map(wave)];
    })(),
  },
  'paint-sprayer': {
    tags: ['pistola de pintura', 'aerógrafo', 'pintar', 'paint sprayer', 'spray gun', 'coating'],
    d: (() => {
      const body = roundpoly([[3.5, 10.75], [14.75, 10.75], [14.75, 15.25], [10.5, 15.25], [9.5, 21.25], [5.5, 21.25], [6.25, 15.25], [3.5, 15.25]], [1.5, 1.25, 1.25, 0.75, 0.4, 0.4, 0.75, 1.5]);
      const cup = roundpoly([[6, 3], [12.5, 3], [11.5, 8.25], [7, 8.25]], [1.25, 1.25, 0.75, 0.75]);
      const neck = 'M8.25 8.25V10.75M10.25 8.25V10.75';
      const mist = [[19, 9.75], [20.5, 13], [19, 16.25]].map(([x, y]) => dot(x, y));
      return [body, cup, neck, line([14.75, 13], [16.75, 13]), ...mist];
    })(),
  },
  'staple-gun': {
    tags: ['engrapadora', 'grapadora industrial', 'tapicería', 'staple gun', 'stapler', 'upholstery'],
    d: (() => {
      // The body, its squeeze lever hinged at the front and raised at the back, a staple below the nose
      const body = sq(2.75, 11, 18.5, 6, 2);
      const lever = capsule([4.75, 6.25], [18, 9.5], 1.5);
      const staple = rline([[15.75, 21.25], [15.75, 19.75], [19.25, 19.75], [19.25, 21.25]], [0, 0.4, 0.4, 0]);
      return [body, lever, staple];
    })(),
  },
  'soldering-iron': {
    tags: ['cautín', 'soldador', 'electrónica', 'soldering iron', 'soldering', 'electronics repair'],
    d: (() => {
      // A pen-shaped handle with grip rings, the metal barrel and its fine tip; the cord trails back
      const handle = sq(0, -2.25, 9, 4.5, 2.25);
      const barrel = rline([[8.5, -1.4], [14.25, -1.4], [17.75, 0], [14.25, 1.4], [8.5, 1.4]], [0, 0.6, 0, 0.6, 0]);
      const tip = line([17.75, 0], [20.5, 0]);
      const cord = 'M0 0C-2.25 0 -3.5 0.75 -3.5 2.75';
      return [handle, barrel, tip, cord].map((d) => onWrench(d, [8.5, 1]));
    })(),
  },
  'circular-saw': {
    tags: ['sierra circular', 'cortar tablas', 'herramienta eléctrica', 'circular saw', 'power saw', 'cutting'],
    ...(() => {
      // The toothed blade (sawRim, as the saw blade's) behind the grip, which rises back from the
      // motor on the arbor. (Seen with its guard over the blade and its base plate, it read as a
      // service bell; cut by a badge, the blade's end fell on a tooth's tip at some weights.)
      const pts = sawRim(...SAW_C, 6, 7.5, { step: 360 / 14, lead: 0.55 });
      const grip = roundpoly([[2.75, 3.25], [9.75, 3.25], [13.5, 11.25], [11.25, 13.5], [2.75, 7]], [1.25, 1.5, 1, 1, 1.5]);
      const blade = behind(roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.2 : 0.5))), [grip]);
      const motor = circ(...SAW_C, 2.25);
      return { d: [blade, grip, motor], fill: { solid: [grip, motor], lines: [blade] } };
    })(),
  },
  jigsaw: {
    tags: ['caladora', 'sierra de calar', 'cortes curvos', 'jigsaw', 'scroll saw', 'woodworking'],
    d: (() => {
      // Its profile: the body with the closed handle's opening in it, the back sloping down, on the
      // shoe; the blade straight down from the front. (A handle arched over a box read as a padlock.)
      const body = roundpoly([[3.25, 3.25], [15.5, 3.25], [17.75, 5.75], [17.75, 12.25], [7.25, 12.25], [3.25, 8]], [1.5, 1, 1.5, 0.75, 1, 1.5]);
      const hole = sq(7.5, 6.25, 7.25, 3, 1.5);
      const shoe = sq(5.25, 12.25, 15, 2.75, 1);
      const blade = rline([[13.25, 15], [13.25, 21.25], [15.75, 18.75], [15.75, 15]], [0, 0.4, 0.4, 0]);
      return [body, hole, shoe, blade];
    })(),
  },
  chainsaw: {
    tags: ['motosierra', 'talar', 'leña', 'chainsaw', 'tree felling', 'forestry'],
    d: (() => {
      // Raised to cut, the bar up to the right: the engine, its top handle, the long guide bar with
      // the chain's teeth along its top (TEETH). (Level, the engine and its handle read as a padlock.)
      const engine = roundpoly([[0, -4.25], [7.5, -4.25], [7.5, 4.25], [0, 4.25]], [1.75, 1, 1, 1.75]);
      const handle = rline([[1.5, -4.25], [1.5, -7.25], [5.25, -7.25], [6.75, -4.25]], [0, 1.25, 1, 0]);
      const t = teeth(7.5, 16.5, -2.25, { dir: -1, pitch: 2.25, depth: 1.25 });
      const bar = `M7.5 -2.25${t.map((q) => `L${P(q)}`).join('')}L16.75 -2.25A2.25 2.25 0 0 1 16.75 2.25H7.5`;
      return [engine, handle, bar].map((d) => xf(d, CHAINSAW));
    })(),
  },
  'miter-saw': {
    tags: ['ingletadora', 'sierra de inglete', 'cortes en ángulo', 'miter saw', 'chop saw', 'framing'],
    d: (() => {
      // The base and its back fence; the arm pivots from the fence to the toothed blade, a handle on top
      const base = sq(2.75, 17.25, 18.5, 3.75, 1.25);
      const fence = line([5.25, 17.25], [5.25, 8.75]);
      const pts = sawRim(14.5, 8.75, 4, 5.75, { step: 40, lead: 0.5 });
      const blade = roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.2 : 0.5)));
      const arm = behind(line([5.25, 8.75], [14.5, 8.75]), [blade], 0.01, 1);
      return [base, fence, blade, arm, dot(14.5, 8.75)];
    })(),
  },
  'table-saw': {
    tags: ['sierra de mesa', 'banco de sierra', 'taller', 'table saw', 'rip saw', 'workshop'],
    d: (() => {
      // The table on its legs, the toothed blade rising through it
      const top = sq(2.75, 12, 18.5, 3, 1);
      const legs = ['M5.25 15L4 21.25', 'M18.75 15L20 21.25'];
      const n = 7;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const a = 180 + (i * 180) / n;
        pts.push(polar(12, 12, 5.5, a));
        if (i < n) pts.push(polar(12, 12, 7.25, a + 180 / n - 6));
      }
      return [top, ...legs, line(...pts)];
    })(),
  },
  jackhammer: {
    tags: ['rotomartillo', 'martillo neumático', 'demoler', 'jackhammer', 'demolition hammer', 'roadworks'],
    d: (() => {
      // The T handle, the body, the chisel point; strokes of the impact at the tip
      const handle = sq(3.25, 3, 17.5, 3, 1.5);
      const body = sq(8.25, 6, 7.5, 10.25, 2);
      const chisel = rline([[10.5, 16.25], [10.5, 19], [12, 21.5], [13.5, 19], [13.5, 16.25]], [0, 0.5, 0.3, 0.5, 0]);
      const hits = [line([6.25, 18.75], [7.75, 20.25]), line([17.75, 18.75], [16.25, 20.25])];
      return [handle, body, chisel, ...hits];
    })(),
  },
  'drill-press': {
    tags: ['taladro de banco', 'taladro de columna', 'taller', 'drill press', 'bench drill', 'makerspace'],
    d: (() => {
      // The column on its base, the head on top with the chuck and bit over the table, the feed lever
      const base = sq(2.75, 18.5, 12.5, 2.75, 1);
      const column = 'M4.75 9V18.5M7.75 9V18.5';
      const head = sq(2.75, 3, 13, 6, 2);
      const chuck = line([12.25, 9], [12.25, 12.75]);
      const table = line([7.75, 15.75], [17.25, 15.75]);
      const lever = line([15.75, 6], [20.25, 10.5]);
      return [base, column, head, chuck, table, lever, dot(20.5, 10.75)];
    })(),
  },
  'cord-reel': {
    tags: ['carrete de extensión', 'extensión', 'corriente en obra', 'cord reel', 'extension cord', 'power'],
    d: (() => {
      // The reel's flange and hub, its crank; the cable runs off the bottom to a plug
      const reel = circ(9.5, 9.25, 6.5);
      const hub = circ(9.5, 9.25, 2);
      const crank = line([9.5 - 2 * Math.SQRT1_2, 9.25 - 2 * Math.SQRT1_2], [3.75, 3.5]);
      const cable = line([9.5, 15.75], [12.75, 15.75]);
      const plug = [sq(2.5, -3.25, 5.75, 6.5, 1.75, { square: ['tr', 'br'] }), line([8.25, -1.6], [10.5, -1.6]), line([8.25, 1.6], [10.5, 1.6])].map((d) => xf(d, { s: 0.9, o: [0, 0], to: [10.5, 15.75] }));
      return [reel, hub, crank, cable, ...plug];
    })(),
  },

  // ── Measuring ──
  'tape-measure': {
    tags: ['flexómetro', 'cinta métrica', 'medir', 'tape measure', 'measuring tape', 'dimensions'],
    d: (() => {
      // The case (its square corner where the blade comes out), the center screw, the blade and hook
      const caseD = sq(2.75, 4.5, 14, 14, 4.25, { square: ['br'] });
      const blade = rline([[16.75, 15], [21, 15], [21, 20.5]], [0, 0.5, 0]);
      const under = line([16.75, 18.5], [21, 18.5]);
      return [caseD, circ(9.75, 11.5, 2.25), blade, under];
    })(),
  },
  'spirit-level': {
    tags: ['nivel de burbuja', 'nivelar', 'instalación', 'spirit level', 'bubble level', 'leveling'],
    d: [sq(2.5, 8.5, 19, 7, 2.25), line([9, 8.5], [9, 15.5]), line([15, 8.5], [15, 15.5]), dot(12, 12)],
  },
  'carpenter-square': {
    tags: ['escuadra', 'escuadra de carpintero', 'ángulo recto', 'carpenter square', 'framing square', 'layout'],
    d: (() => {
      const L = roundpoly([[3.25, 3.25], [8.75, 3.25], [8.75, 15.25], [20.75, 15.25], [20.75, 20.75], [3.25, 20.75]], [1, 1, 0.5, 1, 1, 1]);
      const ticks = [...[6.5, 9.5, 12.5].map((y) => line([8.75, y], [6.25, y])), ...[12, 15, 18].map((x) => line([x, 15.25], [x, 17.75]))];
      return [L, ...ticks];
    })(),
  },
  'voltage-tester': {
    tags: ['probador de voltaje', 'detector de corriente', 'electricista', 'voltage tester', 'non-contact tester', 'electrical safety'],
    d: (() => {
      // A pen with its pocket clip; its tip gives off short rays
      const body = `M0 -1.75H11L14.5 -0.75V0.75L11 1.75H0A1.75 1.75 0 0 1 0 -1.75Z`;
      const clip = rline([[1, -1.75], [1, -3.25], [6.5, -3.25]], [0, 0.75, 0]);
      const rays = [-55, 0, 55].map((a) => line(polar(14.5, 0, 3.5, a), polar(14.5, 0, 5.75, a)));
      return [body, clip, ...rays].map((d) => onWrench(d, [8.6, 0.5]));
    })(),
  },

  // ── Fittings ──
  hinge: {
    tags: ['bisagra', 'puerta', 'herraje', 'hinge', 'door', 'cabinet hardware'],
    d: (() => {
      const knuckle = sq(10.25, 3, 3.5, 18, 1.75);
      const leafL = `M10.25 6H4.75A1.5 1.5 0 0 0 3.25 7.5V16.5A1.5 1.5 0 0 0 4.75 18H10.25`;
      const leafR = `M13.75 6H19.25A1.5 1.5 0 0 1 20.75 7.5V16.5A1.5 1.5 0 0 1 19.25 18H13.75`;
      const joints = [line([10.25, 9], [13.75, 9]), line([10.25, 15], [13.75, 15])];
      return [knuckle, leafL, leafR, ...joints, dot(6.75, 9, 0.3), dot(6.75, 15, 0.3), dot(17.25, 9, 0.3), dot(17.25, 15, 0.3)];
    })(),
  },
  'shelf-bracket': {
    tags: ['escuadra para repisa', 'soporte de repisa', 'montaje', 'shelf bracket', 'L bracket', 'mounting'],
    d: (() => {
      // An L of plate with its brace across the corner and a screw hole in each arm
      const L = roundpoly([[3.25, 3.25], [20.75, 3.25], [20.75, 8.5], [8.5, 8.5], [8.5, 20.75], [3.25, 20.75]], [1.25, 1.25, 1.25, 0.5, 1.25, 1.25]);
      const brace = line([8.5, 17.75], [17.75, 8.5]);
      return [L, brace, dot(5.875, 13.25, 0.3), dot(13.25, 5.875, 0.3)];
    })(),
  },
  chain: {
    tags: ['cadena', 'eslabones', 'asegurar', 'chain', 'links', 'securing'],
    d: (() => {
      // Three links on the diagonal: two flat, the middle one edge on, threaded through both
      const A = capsule([-8.5, 0], [-4, 0], 2.75);
      const C = capsule([4, 0], [8.5, 0], 2.75);
      const B = capsule([-3.25, 0], [3.25, 0], 1.5);
      return [behind(A, [B]), behind(C, [B]), B].map((d) => onWrench(d, [0, 0]));
    })(),
  },
  'bungee-cord': {
    tags: ['pulpo', 'cuerda elástica', 'sujetar carga', 'bungee cord', 'elastic cord', 'tie-down'],
    d: (() => {
      // The elastic cord waving along the diagonal, a hook at each end
      const cord = 'M-6.5 0C-4 -2.75 -1.5 -2.75 0 0S4 2.75 6.5 0';
      const hooks = [xf(HOOK, { o: [0, 0], to: [-6.5, 0] }), xf(HOOK, { o: [0, 0], to: [6.5, 0], deg: 180 })];
      return [cord, ...hooks].map((d) => xf(d, { deg: -35, o: [0, 0], to: [12, 12] }));
    })(),
  },

  // ── Storage and the workshop ──
  toolbox: {
    tags: ['caja de herramientas', 'kit', 'reparaciones', 'toolbox', 'tool kit', 'handyman'],
    d: (() => {
      const body = sq(2.75, 10, 18.5, 10.75, 2, { square: ['br'] });
      const lid = rline([[6, 10], [7, 6.75], [17, 6.75], [18, 10]], [0, 1, 1, 0]);
      const handle = rline([[9, 6.75], [9, 3.25], [15, 3.25], [15, 6.75]], [0, 1, 1, 0]);
      const latch = sq(10.5, 8.5, 3, 4, 0.75);
      return [body, lid, handle, behind(line([2.75, 13.25], [21.25, 13.25]), [latch], 3, 1), latch].filter((d) => d);
    })(),
  },
  'toolbox-open': {
    tags: ['caja de herramientas abierta', 'herramientas disponibles', 'kit', 'open toolbox', 'toolkit', 'tool library'],
    d: (() => {
      // The toolbox's body with its lid swung back; a hammer and a screwdriver rise from inside
      const body = sq(2.75, 10, 18.5, 10.75, 2, { square: ['br'] });
      const lid = line([6, 10], [3.25, 4]);
      const head = xf(sq(-3, -1.25, 6, 2.5, 0.75), { deg: -12, o: [0, 0], to: [10, 4.25] });
      const haft = line([11, 10], [10.26, 5.47]);
      const driver = clip(capsule([17.25, 10], [17.75, 4.5], 1.4), (q) => q[1] < 10 - 1e-3);
      return [body, lid, head, haft, driver];
    })(),
  },
  'tool-bag': {
    tags: ['bolsa de herramientas', 'maletín de técnico', 'servicio en campo', 'tool bag', 'tool tote', 'field service'],
    d: (() => {
      // An open bag with its handle; a hammer and a screwdriver stick out of it
      const bag = roundpoly([[2.75, 10.75], [21.25, 10.75], [20.25, 20.75], [3.75, 20.75]], [0.75, 0.75, 2.5, 2.5]);
      const handle = 'M5.75 10.75C5.75 7 7.25 5.25 9.5 5.25';
      const hammer = [line([12.25, 10.75], [14.75, 4.5]), xf(sq(-2.5, -1, 5, 2.5, 0.75), { deg: 22, o: [0, 0], to: [15.25, 3.75] })];
      const driver = capsule([18, 10.75], [18.75, 6.25], 1.25);
      return [bag, handle, behind(hammer[0], [hammer[1]], 0.01, 1), hammer[1], clip(driver, (q) => q[1] < 10.75 - 1e-3), line([6.5, 15.25], [17.5, 15.25])];
    })(),
  },
  'tool-chest': {
    tags: ['gabinete de herramientas', 'carro de herramientas', 'taller', 'tool chest', 'tool cabinet', 'garage storage'],
    d: (() => {
      // A wide cabinet of stacked drawers with long pulls, on casters
      const cab = sq(4.25, 2.25, 15.5, 17.25, 2.5, { square: ['br'] });
      const drawers = [8, 13.75].map((y) => line([4.25, y], [19.75, y]));
      const pulls = [5.125, 10.875, 16.625].map((y) => line([10.75, y], [13.25, y]));
      return [cab, ...drawers, ...pulls, dot(7.25, 20.75), dot(16.75, 20.75)];
    })(),
  },
  'parts-organizer': {
    tags: ['organizador de piezas', 'gavetero', 'tornillería', 'parts organizer', 'small parts storage', 'inventory'],
    d: (() => {
      // A case of six small drawers, three by two, each with its pull
      const box = sq(3.5, 5.5, 17, 13, 3, { square: ['br'] });
      const grid = [line([9.17, 5.5], [9.17, 18.5]), line([14.83, 5.5], [14.83, 18.5]), line([3.5, 12], [20.5, 12])];
      const pulls = [8.75, 15.25].flatMap((y) => [6.33, 12, 17.67].map((x) => dot(x, y, 0.3)));
      return [box, ...grid, ...pulls];
    })(),
  },
  pegboard: {
    tags: ['tablero perforado', 'panel de herramientas', 'organizar taller', 'pegboard', 'tool wall', 'garage organization'],
    d: (() => {
      // The board with its holes; a large wrench hangs across it from two pegs
      const board = sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] });
      const wrench = xf(SIS.wrench.d[0], { s: 0.62 });
      const holes = [[7.25, 7.25], [7.25, 11.25], [16.75, 16.75]].map(([x, y]) => dot(x, y, 0.3));
      return [board, wrench, ...holes];
    })(),
  },
  workbench: {
    tags: ['banco de trabajo', 'mesa de taller', 'bricolaje', 'workbench', 'work table', 'workshop'],
    d: (() => {
      // A thick top on its legs with a lower shelf; a vise at one end
      const top = sq(2.75, 8.25, 18.5, 3.5, 1);
      const legs = [line([5, 11.75], [5, 21.25]), line([19, 11.75], [19, 21.25])];
      const shelf = line([5, 17.25], [19, 17.25]);
      const vise = rline([[4, 8.25], [4, 4.75], [8.75, 4.75], [8.75, 8.25]], [0, 0.75, 0.75, 0]);
      return [top, ...legs, shelf, vise];
    })(),
  },
  sawhorse: {
    tags: ['caballete', 'burro de carpintero', 'obra', 'sawhorse', 'trestle', 'job site'],
    d: (() => {
      // A beam on splayed A-frame legs at each end
      const beam = sq(2.75, 5.75, 18.5, 3.5, 1.25);
      const legs = [[6, 3], [6, 9], [18, 15], [18, 21]].map(([top, foot]) => line([top, 9.25], [foot, 21.25]));
      return [beam, ...legs];
    })(),
  },
  clamp: {
    tags: ['prensa en C', 'sargento', 'sujetar', 'C-clamp', 'clamp', 'gluing'],
    d: (() => {
      // The C frame; the screw through its lower arm closes its mouth with a swivel pad
      const frame = roundpoly([[17.75, 3], [17.75, 6.25], [7, 6.25], [7, 14.5], [17.75, 14.5], [17.75, 17.5], [3.75, 17.5], [3.75, 3]], [0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 3, 3]);
      const screw = line([14.75, 21.25], [14.75, 9.5]);
      const pad = line([12.5, 9.5], [17, 9.5]);
      const tee = line([11.75, 21.25], [17.75, 21.25]);
      return [frame, screw, pad, tee];
    })(),
  },

  // ── Access and paint ──
  ladder: {
    tags: ['escalera', 'altura', 'mantenimiento', 'ladder', 'height', 'maintenance'],
    d: (() => {
      const xl = (y) => 6.75 + ((21.25 - y) / 18.5) * 2;
      const xr = (y) => 17.25 - ((21.25 - y) / 18.5) * 2;
      return [line([6.75, 21.25], [8.75, 2.75]), line([17.25, 21.25], [15.25, 2.75]), ...[6.25, 10.5, 14.75, 19].map((y) => line([xl(y), y], [xr(y), y]))];
    })(),
  },
  stepladder: {
    tags: ['escalera de tijera', 'escalera plegable', 'pintar', 'stepladder', 'step ladder', 'A-frame'],
    d: (() => {
      // Side view: the front leg with its steps, the back leg, the small top platform
      const front = line([4.5, 21.25], [10, 5.25]);
      const back = line([19, 21.25], [14.5, 5.25]);
      const top = sq(8.5, 2.25, 7.5, 3, 1);
      const fx = (y) => 10 - ((y - 5.25) / 16) * 5.5;
      const steps = [9.75, 14, 18.25].map((y) => line([fx(y), y], [fx(y) + 4.25, y]));
      return [front, back, top, ...steps];
    })(),
  },
  'paint-can': {
    tags: ['bote de pintura', 'lata de pintura', 'colores', 'paint can', 'paint tin', 'painting'],
    d: (() => {
      // The tin, paint run over its top in two drips, the wire bail from its ears. (A bail held
      // halfway down its sides and arched high over it read as headphones.)
      const can = sq(4.25, 8.25, 15.5, 13, 2.5, { square: ['br'] });
      const paint = 'M4.25 11.75H7.75V13.75A1.5 1.5 0 0 0 10.75 13.75V11.75H13.25V15.75A1.5 1.5 0 0 0 16.25 15.75V11.75H19.75';
      const bail = 'M6.25 8.25C6.25 5.25 8.75 3.5 12 3.5S17.75 5.25 17.75 8.25';
      return [can, paint, bail];
    })(),
  },
  'flat-brush': {
    tags: ['brocha', 'pintar paredes', 'decorar', 'paintbrush', 'flat brush', 'decorating'],
    d: (() => {
      // The short handle, the metal ferrule, the wide flat bristles
      const handle = 'M10.25 9.75V4.75A1.75 1.75 0 0 1 13.75 4.75V9.75';
      const ferrule = sq(6, 9.75, 12, 4, 1, { square: ['bl', 'br'] });
      const bristles = rline([[6, 13.75], [6, 20.25], [18, 20.25], [18, 13.75]], [0, 1.25, 1.25, 0]);
      const lines = [10, 14].map((x) => line([x, 13.75], [x, 20.25]));
      return [handle, ferrule, bristles, ...lines];
    })(),
  },
  glue: {
    tags: ['pegamento', 'adhesivo', 'pegar', 'glue', 'adhesive', 'repairs'],
    d: (() => {
      // A squeezed tube, crimped at the top, its pointed nozzle down and a drop at its tip
      const tube = roundpoly([[7.25, 2.5], [16.75, 2.5], [16.25, 10], [13.5, 12.25], [12.6, 15], [11.4, 15], [10.5, 12.25], [7.75, 10]], [0.6, 0.6, 2.5, 0.75, 0.4, 0.4, 0.75, 2.5]);
      const crimp = line([7.5, 5], [16.5, 5]);
      const drop = xf(lugaresDrop, { s: 0.19, o: [12, 12], to: [12, 19.75] });
      return [tube, crimp, drop].map((d) => xf(d, { deg: -20, to: [12.25, 12.5] }));
    })(),
  },
  'duct-tape': {
    tags: ['cinta adhesiva', 'cinta gris', 'reparación rápida', 'duct tape', 'tape roll', 'sealing'],
    d: (() => {
      // The roll and its core; a strip peels down off its side and ends in a torn edge
      const roll = circ(10.5, 9.75, 7);
      const core = circ(10.5, 9.75, 3);
      const y0 = 9.75 + Math.sqrt(49 - 4 * 4);
      const strip = line([14.5, y0], [14.5, 20], [15.375, 21.25], [16.25, 20], [17.5, 21.25], [17.5, 9.75]);
      return [roll, core, strip];
    })(),
  },

  // ── Lifting ──
  'engine-hoist': {
    tags: ['grúa de taller', 'pluma hidráulica', 'levantar motor', 'engine hoist', 'shop crane', 'lifting'],
    d: (() => {
      // The mast on a wheeled base, the boom angled up from it, the chain and hook from its tip
      const base = line([4.25, 18.5], [19.5, 18.5]);
      const boom = capsule([5.25, 7.5], [18.25, 3.75], 1.25);
      const u = unit([5.25, 7.5], [18.25, 3.75]);
      const low = (x) => 7.5 + u[0] * 1.25 + ((x - 5.25 + u[1] * 1.25) / u[0]) * u[1];
      const mast = line([6.5, 18.5], [6.5, low(6.5)]);
      const ram = line([6.5, 15.25], [11.5, low(11.5)]);
      const chain = line([17.75, 5], [17.75, 11.25]);
      const hook = 'M17.75 11.25V14A1.75 1.75 0 0 1 14.25 14';
      return [base, mast, boom, ram, chain, hook, circ(4.25, 19.75, 1.25), circ(19.5, 19.75, 1.25)];
    })(),
  },

  // ── Site lights ──
  'work-light': {
    tags: ['lámpara de trabajo', 'reflector de obra', 'iluminación', 'work light', 'job site light', 'floodlight'],
    d: (() => {
      // Side view: the flood head on its tripod, its light thrown forward
      const head = roundpoly([[5, 6.75], [11.5, 4.25], [11.5, 13.75], [5, 11.25]], [1, 0.75, 0.75, 1]);
      const rays = [-40, 0, 40].map((a) => line(polar(11.5, 9, 4.5, a), polar(11.5, 9, 8, a)));
      return [head, ...rays, ...TRIPOD(12.5, 8.25)];
    })(),
  },

  // ── Clamping ──
  'bar-clamp': {
    tags: ['sargento', 'prensa F', 'encolar', 'bar clamp', 'F-clamp', 'woodworking'],
    d: (() => {
      // The bar and its fixed jaw in one piece, the sliding jaw lower on the bar; its screw rises to
      // the pad and its handle hangs below
      const frame = roundpoly([[3.5, 2.75], [17.75, 2.75], [17.75, 6.25], [7, 6.25], [7, 21.25], [3.5, 21.25]], [1.25, 1.25, 1.25, 0.5, 1.25, 1.25]);
      const jaw = rline([[7, 12.25], [17.75, 12.25], [17.75, 15.75], [7, 15.75]], [0, 1.25, 1.25, 0]);
      const screw = line([15, 9.25], [15, 12.25]);
      const pad = line([12.75, 9.25], [17.25, 9.25]);
      const handle = behind(capsule([15, 15.5], [15, 19.75], 1.5), [sq(7, 12.25, 10.75, 3.5, 1.25)], 0.01, 1);
      return [frame, jaw, screw, pad, handle];
    })(),
  },
};

// ── Fill (DESIGN.md › Fill), by path index: `solid` filled (closed shapes only: an open stroke that
// closes on another piece goes in as Z(…)), `cut` knocked out, `lines` on top with a clearance,
// `wire` on top and attached. The handles that end on their heads close along the head's edge.
const FILL = {
  'wrench-clock': { solid: [0] },
  'wrench-ring': { solid: [0], cut: [1] },
  'wrench-adjustable': { solid: [0], cut: [1] },
  'pipe-wrench': { solid: [0, 1, 2] },
  'torque-wrench': { solid: [0, 'Z:1'], cut: [2] },
  'lug-wrench': { solid: [2, 3, 4, 5], wire: [0, 1] },
  'hex-key': { solid: [0] },
  pliers: { solid: [0], cut: [1, 2] },
  'pliers-needle-nose': { solid: [0], cut: [1] },
  'wire-cutter': { solid: [0], cut: [1, 2] },
  'wire-stripper': { solid: [0], cut: [1, 2, 3, 4] },
  'bolt-cutter': { solid: [0], cut: [1] },
  mallet: { solid: [0, 'Z:3'], cut: [1, 2] },
  sledgehammer: { solid: [0, 'Z:1'] },
  crowbar: { solid: [0] },
  axe: { solid: [0, 'Z:1'] },
  hatchet: { solid: [0, 'Z:1'], cut: [2] },
  pickaxe: { solid: [0, 'Z:1'] },
  hacksaw: { solid: [2], wire: [0, 1] },
  'utility-knife': { solid: [0, 'Z:1'] },
  chisel: { solid: [0, 'Z:1', 'Z:2'], cut: [3] },
  'metal-file': { solid: [0, 'Z:1', 'Z:2'], cut: [3, 4, 5] },
  'hand-plane': { solid: [0, 'Z:1', 'Z:3'], wire: [2] },
  'putty-knife': { solid: [0, 'Z:1', 'Z:2'] },
  sandpaper: { solid: ['Z:0', 1], cut: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  'saw-blade': { solid: [0], cut: [1] },
  'drill-bit': { solid: [0], cut: [1, 2, 3, 4] },
  screw: { solid: [0, 'Z:1'], cut: [2, 3, 4] },
  'hex-bolt': { solid: [0, 'Z:3'], cut: [1, 2, 4, 5, 6] },
  nail: { solid: [0, 'Z:1'] },
  rivet: { solid: [0, 'Z:1'], wire: [2] },
  'wall-plug': { solid: [0, 2], cut: [1], wire: [3] },
  'eye-bolt': { solid: [0, 'Z:2'], cut: [3, 4] },
  drill: { solid: [0, 2, 3], cut: ['M4.75 17.25H9.25'], wire: [1, 4] },
  'heat-gun': { solid: [0], wire: [1], lines: [2, 3, 4] },
  'paint-sprayer': { solid: [0, 1, 'M8.25 8.25H10.25V10.75H8.25Z', 4, 5, 6], wire: [3] },
  'staple-gun': { solid: [0, 1], lines: [2] },
  'soldering-iron': { solid: [0, 'Z:1'], wire: [2, 3] },
  jigsaw: { solid: [holed(icons.jigsaw.d[0], icons.jigsaw.d[1]), 2, 'Z:3'] },
  chainsaw: { solid: [0, 'Z:2'], wire: [1] },
  'miter-saw': { solid: [0, 2], cut: [4], wire: [1, 'M5.25 8.75H10.5'] },
  'table-saw': { solid: [0, 'Z:3'], wire: [1, 2] },
  jackhammer: { solid: [0, 1, 'Z:2'], lines: [3, 4] },
  'drill-press': { solid: [0, 'M4.75 9H7.75V18.5H4.75Z', 2, 6], wire: [3, 4, 5] },
  'cord-reel': { solid: [0, 4], cut: [1, 2], wire: [3, 5, 6] },
  'tape-measure': { solid: [0, 'M16.75 15H21V18.5H16.75Z'], cut: [1], wire: [2] },
  'spirit-level': { solid: [0], cut: [1, 2, 3] },
  'carpenter-square': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'voltage-tester': { solid: [0], wire: [1], lines: [2, 3, 4] },
  hinge: { solid: [0, 'Z:1', 'Z:2'], cut: [3, 4, 5, 6, 7, 8] },
  'shelf-bracket': { solid: [0], cut: [2, 3], wire: [1] },
  toolbox: { solid: [0, 'Z:1'], cut: [3, 4], wire: [2] },
  'toolbox-open': { solid: [0, 2, 'Z:4'], wire: [1, 3] },
  'tool-bag': { solid: [0, 3, 'Z:4'], cut: [5], wire: [1, 2] },
  'tool-chest': { solid: [0, 6, 7], cut: [1, 2, 3, 4, 5] },
  'parts-organizer': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  pegboard: { solid: [0], cut: [1, 2, 3, 4] },
  workbench: { solid: [0, 'Z:4'], wire: [1, 2, 3] },
  sawhorse: { solid: [0], wire: [1, 2, 3, 4] },
  clamp: { solid: [0], wire: [1, 2, 3] },
  stepladder: { solid: [2], wire: [0, 1, 3, 4, 5] },
  'paint-can': { solid: [0], cut: [1], wire: [2] },
  'flat-brush': { solid: ['Z:0', 1, 'Z:2'], cut: [3, 4, 'M6 13.75H18'] },
  glue: { solid: [0, 2], cut: [1] },
  'duct-tape': { solid: [0, 'Z:2'], cut: [1] },
  'engine-hoist': { solid: [2, 6, 7], wire: [0, 1, 3, 4, 5] },
  'work-light': { solid: [0], lines: [1, 2, 3], wire: [4, 5] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : i.startsWith('Z:') ? Z(d[Number(i.slice(2))]) : i));
  const out = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) out[k] = pick(spec[k]);
  icons[name].fill = out;
}
// A piece that closes only for the fill: the shovel's shaft
icons.shovel.fill = { solid: [icons.shovel.d[0], lean('M10.5 4.75H13.5V11.5H10.5Z', [12, 12], 0.92), icons.shovel.d[2]] };
// The bar clamp's sliding jaw and handle close on the bar
{
  const [frame, jaw, screw, pad, grip] = icons['bar-clamp'].d;
  icons['bar-clamp'].fill = { solid: [frame, Z(jaw), Z(grip)], wire: [screw, pad] };
}
// Wire and cord only: their filled version is the outline
for (const name of ['chain', 'bungee-cord', 'ladder']) icons[name].fill = false;
// The eye bolt's ring keeps its hole open when filled
icons['eye-bolt'].fill.solid[0] = holed(icons['eye-bolt'].d[0], icons['eye-bolt'].d[1]);

// ── 16 px (DESIGN.md › 16 px): fewer pieces, straight edges on pixel centers (0.75 + 1.5k) ──
const small = (d, solid, cut = [], extra = {}) => ({ d, fill: { solid: solid.map((i) => (typeof i === 'number' ? d[i] : i)), ...(cut.length && { cut: cut.map((i) => d[i]) }), ...extra } });
{
  // Sandpaper: the sheet, its curl and four grains of grit
  const sheet = clip(sq(3.75, 3.75, 16.5, 16.5, 3, { square: ['br'] }), (q) => q[0] - q[1] < 10.5 - 1e-3);
  const curl = 'M14.25 3.75C14.25 7.5 16.5 9.75 20.25 9.75C18.75 7.5 16.5 5.25 14.25 3.75Z';
  const grit = [[8.25, 8.25], [12.75, 12.75], [8.25, 15.75], [15.75, 15.75]].map(([x, y]) => dot(x, y, 0.75));
  icons.sandpaper.small = small([sheet, curl, ...grit], [Z(sheet), 1], [2, 3, 4, 5]);
}
// The hinge with one screw a leaf and no joints
icons.hinge.small = small(
  [sq(9.75, 3.75, 4.5, 16.5, 2.25), 'M9.75 6.75H5.25A1.5 1.5 0 0 0 3.75 8.25V15.75A1.5 1.5 0 0 0 5.25 17.25H9.75', 'M14.25 6.75H18.75A1.5 1.5 0 0 1 20.25 8.25V15.75A1.5 1.5 0 0 1 18.75 17.25H14.25', dot(6.75, 12, 0.75), dot(17.25, 12, 0.75)],
  [0, 'M9.75 6.75H5.25A1.5 1.5 0 0 0 3.75 8.25V15.75A1.5 1.5 0 0 0 5.25 17.25H9.75Z', 'M14.25 6.75H18.75A1.5 1.5 0 0 1 20.25 8.25V15.75A1.5 1.5 0 0 1 18.75 17.25H14.25Z'],
  [3, 4],
);
// The pegboard with a larger wrench and two holes
icons.pegboard.small = small([sq(3.75, 3.75, 16.5, 16.5, 3.5, { square: ['br'] }), xf(SIS.wrench.d[0], { s: 0.66 }), dot(7.5, 7.5, 0.75), dot(16.5, 16.5, 0.75)], [0], [1, 2, 3]);
// The saw blade with fewer, larger teeth
{
  const pts = sawRim(12, 12, 6.75, 9.5, { step: 36, lead: 0.7 });
  icons['saw-blade'].small = small([roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.25 : 0.6))), circ(12, 12, 2.25)], [0], [1]);
}
// The fasteners with fewer threads
icons.screw.small = small(['M6.75 8.25C6.75 4.5 9.25 3.75 12 3.75S17.25 4.5 17.25 8.25Z', 'M9.75 8.25V16.5L12 21L14.25 16.5V8.25', line([9.75, 14.25], [14.25, 11.25])], [0, 'M9.75 8.25V16.5L12 21L14.25 16.5V8.25Z'], [2]);
icons['hex-bolt'].small = small([sq(6.75, 3.75, 10.5, 4.5, 1), 'M9.75 8.25V19.5A1.5 1.5 0 0 0 11.25 21H12.75A1.5 1.5 0 0 0 14.25 19.5V8.25', line([9.75, 15.75], [14.25, 12.75]), line([9.75, 19.5], [14.25, 16.5])], [0, 'M9.75 8.25V19.5A1.5 1.5 0 0 0 11.25 21H12.75A1.5 1.5 0 0 0 14.25 19.5V8.25Z'], [2, 3]);
{
  const ring = circ(12, 7.5, 4.5);
  const hole = circ(12, 7.5, 1.5);
  const y0 = 7.5 + Math.sqrt(4.5 ** 2 - 2.25 ** 2);
  const shank = `M9.75 ${f(y0)}V19.5A1.5 1.5 0 0 0 11.25 21H12.75A1.5 1.5 0 0 0 14.25 19.5V${f(y0)}`;
  icons['eye-bolt'].small = small([ring, hole, shank, line([9.75, 18.75], [14.25, 15.75])], [holed(ring, hole), Z(shank)], [3]);
}
icons['drill-bit'].small = small([roundpoly([[9.75, 3.75], [14.25, 3.75], [14.25, 17.25], [12, 21], [9.75, 17.25]], [1, 1, 0.5, 0.4, 0.5]), line([9.75, 11.25], [14.25, 8.25]), line([9.75, 15.75], [14.25, 12.75])], [0], [1, 2]);
// The paint can with one drip (two ran together at 16 px)
icons['paint-can'].small = small([sq(3.75, 8.25, 16.5, 12, 2.25, { square: ['br'] }), 'M3.75 12.75H11.25V15.75A1.5 1.5 0 0 0 14.25 15.75V12.75H20.25', 'M6.75 8.25C6.75 5.25 9 3.75 12 3.75S17.25 5.25 17.25 8.25'], [0], [1], { wire: ['M6.75 8.25C6.75 5.25 9 3.75 12 3.75S17.25 5.25 17.25 8.25'] });
// The circular saw with ten larger teeth, its grip and motor on the pixel grid
{
  const C = [14.25, 14.25];
  const pts = sawRim(...C, 5.25, 7, { step: 36, lead: 0.6 });
  const grip = roundpoly([[3.75, 3.75], [9.75, 3.75], [12.75, 11.25], [11.25, 12.75], [3.75, 6.75]], [1, 1.25, 0.75, 0.75, 1]);
  const blade = behind(roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.25 : 0.6))), [grip]);
  const motor = circ(...C, 1.5);
  icons['circular-saw'].small = { d: [blade, grip, motor], fill: { solid: [grip, motor], lines: [blade] } };
}

// ── Named parts (DESIGN.md › Named parts) ──
const PARTS = {
  'wrench-clock': { body: [0] },
  'wrench-ring': { body: [0], hole: [1] },
  'wrench-adjustable': { body: [0], seam: [1] },
  'pipe-wrench': { handle: [0], jaw: [1], nut: [2] },
  'torque-wrench': { body: [0], gauge: [1], needle: [2] },
  'lug-wrench': { bars: [0, 1], sockets: [2, 3, 4, 5] },
  'hex-key': { body: [0] },
  'saw-blade': { blade: [0], hole: [1] },
  drill: { body: [0], trigger: [1], battery: [2], chuck: [3], bit: [4] },
  'heat-gun': { body: [0], trigger: [1], heat: [2, 3, 4] },
  'paint-sprayer': { body: [0], cup: [1], nozzle: [3], mist: [4, 5, 6] },
  'miter-saw': { base: [0], fence: [1], blade: [2], arm: [3], hub: [4] },
  'circular-saw': { blade: [0], grip: [1], motor: [2] },
  jigsaw: { body: [0, 1], shoe: [2], blade: [3] },
  'paint-can': { can: [0], paint: [1], handle: [2] },
  jackhammer: { handle: [0], body: [1], chisel: [2], impact: [3, 4] },
  'cord-reel': { reel: [0], hub: [1], crank: [2], cable: [3], plug: [4, 5, 6] },
  'voltage-tester': { body: [0], clip: [1], rays: [2, 3, 4] },
  glue: { tube: [0], crimp: [1], drop: [2] },
  'engine-hoist': { base: [0], mast: [1], boom: [2], ram: [3], hook: [4, 5], wheels: [6, 7] },
  chainsaw: { body: [0], handle: [1], bar: [2] },
  'work-light': { lamp: [0], rays: [1, 2, 3], tripod: [4, 5] },
  'bar-clamp': { frame: [0], jaw: [1], screw: [2, 3], handle: [4] },
};
for (const name of ['pliers', 'wire-cutter']) PARTS[name] = { body: [0], pivot: [1], jaws: [2] };
PARTS['pliers-needle-nose'] = { body: [0], pivot: [1] };
PARTS['wire-stripper'] = { body: [0], pivot: [1], hole: [2], jaws: [3, 4] };
PARTS['bolt-cutter'] = { body: [0], pivot: [1] };
PARTS.mallet = { head: [0, 1, 2], handle: [3] };
for (const name of ['sledgehammer', 'axe', 'pickaxe']) PARTS[name] = { head: [0], handle: [1] };
PARTS.hatchet = { head: [0, 2], handle: [1] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// The torque wrench's gauge shows a value: its needle sweeps the scale
{
  const c = xfPt([9.75, 1.5], { deg: -45, o: [10.25, -0.75], to: [12, 12] });
  icons['torque-wrench'].value = { turn: { parts: ['needle'], origin: [Number(f(c[0])), Number(f(c[1]))], from: 125, to: -35, at: 10 } };
}

// ── Motion: each tool's own gesture ──
const R = (p) => p.map((v) => Number(f(v)));
// The pliers open and close on their pivot; the striking tools swing from the end of the handle
const pivot = (dy, to = [12, 12], s = 1) => R(xfPt([12, 12 + dy + PIV - 0], { deg: 45, s, to }));
icons.pliers.motion = { effect: 'wiggle', origin: pivot(-0.5) };
icons['pliers-needle-nose'].motion = { effect: 'wiggle', origin: pivot(-0.25) };
icons['wire-cutter'].motion = { effect: 'wiggle', origin: pivot(-1.5) };
icons['bolt-cutter'].motion = { effect: 'wiggle', origin: R(xfPt([12, 11.85 - 8.25], { deg: 45, s: 0.97 })) };
icons.mallet.motion = { effect: 'wiggle', origin: R(xfPt([12, 21.25], { deg: 45, s: 0.94, to: [10.4, 13.6] })) };
icons.sledgehammer.motion = { effect: 'wiggle', origin: R(xfPt([12, 23], { deg: 45, s: 0.88, to: [10.6, 13.4] })) };
icons.axe.motion = { effect: 'wiggle', origin: R(xfPt([12, 22.5], { deg: 45, s: 0.86, to: [11, 13] })) };
icons.hatchet.motion = { effect: 'wiggle', origin: R(xfPt([12, 19.75], { deg: 45, s: 1, to: [11.6, 12.4] })) };
icons.pickaxe.motion = { effect: 'wiggle', origin: R(xfPt([12, 22], { deg: 45, s: 0.9, to: [11.4, 12.9] })) };
// The wrenches turn their nut (sistema's wrench wiggles about its head)
icons['wrench-clock'].motion = { effect: 'wiggle', origin: [16.6, 9.4] };
icons['wrench-ring'].motion = { effect: 'wiggle', origin: R(xfPt([14.5, 0], { deg: -45, o: RING_O, to: [12, 12] })) };
icons['wrench-adjustable'].motion = { effect: 'wiggle', origin: R(xfPt([13, 0], { deg: -45, o: [8.6, 0], to: [12, 12] })) };
icons['lug-wrench'].motion = { effect: 'spin', origin: [12, 12] };
// Blades and reels turn; the hoist's hook swings; the hammer drill bounces; heat rises
icons['saw-blade'].motion = { effect: 'spin', origin: [12, 12] };
icons['miter-saw'].motion = { effect: 'spin', parts: ['blade'], origin: [14.5, 8.75] };
icons['circular-saw'].motion = { effect: 'spin', parts: ['blade'], origin: SAW_C };
icons['cord-reel'].motion = { effect: 'spin', parts: ['crank'], origin: [9.5, 9.25] };
icons['engine-hoist'].motion = { effect: 'ring', parts: ['hook'], origin: [17.75, 5] };
icons.jackhammer.motion = { effect: 'bounce', vector: [0, -1.5] };
icons['heat-gun'].motion = { effect: 'float', parts: ['heat'], vector: [1.5, 0] };
icons['paint-sprayer'].motion = { effect: 'float', parts: ['mist'], vector: [1.5, 0] };
icons.glue.motion = { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] };
icons['voltage-tester'].motion = { effect: 'beat', parts: ['rays'], origin: R(xfPt([14.5, 0], { deg: -45, o: [8.6, 0.5], to: [12, 12] })) };
// The work light pulses; the chainsaw shakes on its engine and the jigsaw's blade strokes; the bar
// clamp's sliding jaw closes on the work
icons['work-light'].motion = { effect: 'beat', parts: ['rays'], origin: [11.5, 9] };
icons.chainsaw.motion = { effect: 'wiggle', origin: R(xfPt([3.75, 0], CHAINSAW)) };
icons.jigsaw.motion = { effect: 'bounce', parts: ['blade'], vector: [0, 1] };
icons['bar-clamp'].motion = { effect: 'bounce', parts: ['jaw', 'screw', 'handle'], vector: [0, -1.5] };

// ── Mirror (DESIGN.md › Mirroring): none. Every icon here is a physical tool with a fixed side (the
// power tools face right as an object, not as a direction), so none flips in right-to-left languages.

// ── Automatic variants (DESIGN.md › Automatic variants) ──
const off = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// With a status badge: at 58% the badge stops reading and a slash would cut through it
off(['wrench-clock'], { circle: false, square: false, slash: false });
// Already round, or already a square sheet or board
off(['saw-blade'], { circle: false });
off(['sandpaper', 'pegboard'], { square: false });

export default { category: 'herramientas', label: 'Herramientas', icons };
