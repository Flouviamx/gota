// Industria y manufactura (industry and manufacturing): plants and extraction, machines and their
// states, machine tools, forming, automation and robots, machine elements, lifting gear,
// piping and process equipment, tanks and bulk, and the parts a plant makes. Everything is computed
// with the engine (engine/geometry.mjs) on the rules in DESIGN.md: a 1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on containers. The category adopts lugares' `factory`
// (never redrawn here: `factory-connected` builds on it); its gear is sistema's small one (the
// engine's gear with the proportions of sistema's gears icon). One construction per family:
// - machine-* is the machine (MACHINE, from machineAt()): a cabinet with the spindle's head on its
//   roof and the spindle running down into the window; the icons that need room around it use the
//   same machine drawn 12.5 wide (MACHINE_S), with the same heights and clearances, never scaled.
// - The open machine tool (the mill) stands on the plinth (PLINTH): its body ends on 18.25 and the
//   plinth runs to the floor.
// - The pipes (flange, pipeline, its leak, valve, the pump's discharge) share one bore:
//   walls 6 apart (pipe()), heavier than household plumbing on purpose, with raised flange plates.
// - Everything standing shares the floor at 21.25; the cranes share one hook (hook()).
// - The workpiece family is one bracket (bracketAt(), workpieceAt()).
// Whatever passes behind another piece is cut with `behind` (3 center to center: 1.5 of paper),
// never trimmed by hand; badges are the engine's.
import { arc, badge, circ, dot, f, gear, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import lugares from './lugares.mjs';
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
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const u = [A[0] - V[0], A[1] - V[1]];
    const v = [B[0] - V[0], B[1] - V[1]];
    const [lu, lv] = [Math.hypot(...u), Math.hypot(...v)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    if (!rr[i] || th > Math.PI - 1e-6) {
      d += `L${P(V)}`;
      continue;
    }
    const t = rr[i] / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${P([V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t])}A${f(rr[i])} ${f(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${P([V[0] + (v[0] / lv) * t, V[1] + (v[1] / lv) * t])}`;
  }
  return `${d}L${P(pts[pts.length - 1])}`;
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

/** Smooth open curve through points (Catmull-Rom as cubics). */
function smooth(pts, k = 1 / 6) {
  let d = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d;
}

// ── Paths as segments (cocina's): behind() keeps what shows of a stroke behind closed shapes ──
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

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d) => {
  icons[name] = { tags, d };
};
/** Every standing thing (tanks, machines, cranes) stands on this floor. */
const FLOOR = 21.25;
/** lugares' factory: its sawtooth body and its door. */
const FACTORY = lugares.icons.factory.d;
/** lugares' flame (its outer outline, tip up), for the flare stack. */
const FLAME = lugares.icons.flame.d[0];
/** lugares' droplet (tip up at 12, 3.25), for the leak. */
const DROPLET = lugares.icons.droplet.d[0];

/**
 * The machine tools' plinth: under a body that ends on 18.25, recessed 2.5 from both sides, down to
 * the floor. The body's bottom edge is its top.
 */
const PLINTH = rline(
  [
    [5.25, 18.25],
    [5.25, FLOOR],
    [18.75, FLOOR],
    [18.75, 18.25],
  ],
  [0, 1, 1, 0],
);
/** The seam the fill knocks out between a body and the plinth it stands on. */
const SEAM = hl(1.5, 22.5, 18.25);

/** A window with a block raised on its floor (the part), its corners continuous. */
const windowWithPart = (x0, x1, y0, y1, b0, b1, bh) =>
  roundpoly(
    [
      [x0, y0],
      [x1, y0],
      [x1, y1],
      [b1, y1],
      [b1, y1 - bh],
      [b0, y1 - bh],
      [b0, y1],
      [x0, y1],
    ],
    [1.5, 1.5, 1.5, 0, 0.4, 0.4, 0, 1.5],
  );
/**
 * A machining center: the cabinet on the floor with the spindle's head housing rising off the middle
 * of its roof, the window 3 inside the cabinet, and the spindle running from the top of the head
 * straight down into the window to 3 above the part, a block raised on the window's floor. Drawn at
 * each width with the same heights and clearances, never scaled.
 */
const machineAt = ({ x0, x1, head: [h0, h1], part: [b0, b1] }) => [
  roundpoly(
    [
      [x0, FLOOR],
      [x0, 7.25],
      [h0, 7.25],
      [h0, 4.25],
      [h1, 4.25],
      [h1, 7.25],
      [x1, 7.25],
      [x1, FLOOR],
    ],
    [0, 2, 0.5, 1, 1, 0.5, 2, 0],
  ),
  windowWithPart(x0 + 3, x1 - 3, 10.25, 18.25, b0, b1, 2),
  vl((h0 + h1) / 2, 4.25, 13.25),
];
const MACHINE = machineAt({ x0: 4.25, x1: 19.75, head: [9, 15], part: [9.75, 14.25] });
/** The same machine, 12.5 wide, for the icons that need room around it. */
const MACHINE_S = machineAt({ x0: 5.75, x1: 18.25, head: [9, 15], part: [10.25, 13.75] });

// ── Plants and extraction ─────────────────────────────────────────────────────────────────────
/** A column with a round top standing on the floor (distillation columns). */
const tower = (x, top, w) => `M${P([x, FLOOR])}V${f(top + w / 2)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${P([x + w, top + w / 2])}V${f(FLOOR)}Z`;

// Refinery: two distillation columns with their platform rings, the pipe joining them over the
// top, and the flare stack burning at the right (lugares' flame on a thin stack)
add('refinery', ['refinería', 'petroquímica', 'planta de proceso', 'petróleo y gas', 'refinery', 'petrochemical', 'oil and gas'], [
  tower(3.25, 3.25, 4.25),
  hl(3.25, 7.5, 11.75),
  tower(10.5, 9.75, 4.25),
  hl(10.5, 14.75, 16),
  rline(
    [
      [7.5, 7],
      [12.63, 7],
      [12.63, 9.75],
    ],
    [0, 1.5, 0],
  ),
  vl(19.5, FLOOR, 11.5),
  place(FLAME, 0.27, [12, 20.25], [19.5, 11.5]),
]);

// Oil rig: the deck on its legs, which come down to the sea (the wave runs under the whole rig, the
// legs land on it), and the lattice derrick standing on the deck
const RIG_WAVE_Y = (x) => 19.5 + 0.75 * Math.cos(((x - 2.75) / 4.625) * Math.PI);
const RIG_WAVE = smooth(Array.from({ length: 17 }, (_, i) => [2.75 + i * 1.15625, RIG_WAVE_Y(2.75 + i * 1.15625)]));
add('oil-rig', ['plataforma petrolera', 'costa afuera', 'perforación marina', 'offshore', 'oil rig', 'oil platform'], [
  sq(3.25, 11.75, 17.5, 3, 1),
  ...[6.25, 17.75].map((x) => vl(x, 14.75, RIG_WAVE_Y(x))),
  RIG_WAVE,
  rline(
    [
      [8.75, 11.75],
      [10.75, 2.75],
      [13.25, 2.75],
      [15.25, 11.75],
    ],
    [0, 0.5, 0.5, 0],
  ),
  hl(9.75, 14.25, 7.25),
]);

// Drilling rig: the tall tapered derrick with its crown block, two rungs of its lattice, the
// ground, and the drill string running from the crown down through the ground
add('drilling-rig', ['torre de perforación', 'pozo', 'perforación', 'petróleo', 'drilling rig', 'derrick', 'oil well'], [
  line([5.75, 17.75], [10.25, 5.75]),
  line([18.25, 17.75], [13.75, 5.75]),
  sq(9.25, 2.75, 5.5, 3, 1),
  hl(8.62, 15.38, 9.5),
  hl(7.3, 16.7, 13.5),
  hl(2.75, 21.25, 17.75),
  vl(12, 5.75, FLOOR),
]);

// Smokestack: the tall tapered chimney with two bands and a puff of smoke rising off its top to the
// right (the puff passes in front: the chimney's mouth is cut 1.5 short of it)
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
/** A cloud of discs [x, y, r] in a row, left to right, on a flat bottom at `base`: its outline. */
function puff(discs, base) {
  const [first, last] = [discs[0], discs.at(-1)];
  const left = [first[0] - first[2], first[1]];
  let d = `M${P([first[0], base])}A${f(first[2])} ${f(first[2])} 0 0 1 ${P(left)}`;
  for (let i = 0; i < discs.length - 1; i++) {
    const [top] = meet(discs[i], discs[i + 1]);
    d += `A${f(discs[i][2])} ${f(discs[i][2])} 0 0 1 ${P(top)}`;
  }
  const end = [last[0] + Math.sqrt(Math.max(0, last[2] ** 2 - (base - last[1]) ** 2)), base];
  // The last disc runs clockwise from where the one before meets it down to the bottom
  const [from] = meet(discs.at(-2), last);
  const ang = (q) => (Math.atan2(q[1] - last[1], q[0] - last[0]) * 180) / Math.PI;
  const sweep = (((ang(end) - ang(from)) % 360) + 360) % 360;
  d += `A${f(last[2])} ${f(last[2])} 0 ${sweep > 180 ? 1 : 0} 1 ${P(end)}Z`;
  return d;
}
const PUFF = puff(
  [
    [9.75, 6.5, 2.25],
    [14.25, 5, 2.5],
    [18.75, 6.5, 2.25],
  ],
  8.75,
);
const CHIMNEY = roundpoly(
  [
    [4.5, FLOOR],
    [6, 8.75],
    [9.5, 8.75],
    [11, FLOOR],
  ],
  [0, 0.5, 0.5, 0],
);
add('smokestack', ['chimenea industrial', 'emisiones', 'humo', 'gases', 'smokestack', 'chimney', 'emissions'], [
  behind(CHIMNEY, [PUFF]),
  line([5.45, 12.75], [10.05, 12.75]),
  line([4.9, 16.75], [10.6, 16.75]),
  PUFF,
]);

// ── Machines and their states ─────────────────────────────────────────────────────────────────
add('machine', ['máquina', 'centro de mecanizado', 'cnc', 'activo', 'machine', 'cnc machine', 'work center'], MACHINE);
add('machine-check', ['máquina operando', 'en marcha', 'disponible', 'machine running', 'uptime', 'machine ok'], MACHINE);
add('machine-alert', ['falla de máquina', 'alarma', 'paro', 'machine fault', 'machine alarm', 'breakdown'], MACHINE);
add('machine-clock', ['máquina en espera', 'tiempo muerto', 'paro programado', 'machine idle', 'downtime', 'cycle time'], MACHINE);
// Vibration: the smaller machine and a stroke at each side, 3 off the cabinet
add('machine-vibration', ['vibración', 'monitoreo de condición', 'mantenimiento predictivo', 'vibration', 'condition monitoring', 'predictive maintenance'], [
  ...MACHINE_S,
  vl(2.75, 12, 16.5),
  vl(21.25, 12, 16.5),
]);

// ── Machine tools (on the plinth) ─────────────────────────────────────────────────────────────
// Milling machine: the column with the head reaching over the table, the spindle, and the block on
// the table
add('milling-machine', ['fresadora', 'fresado', 'maquinado', 'mecanizado', 'milling machine', 'milling', 'mill'], [
  roundpoly(
    [
      [3.25, 18.25],
      [3.25, 3.25],
      [17.25, 3.25],
      [17.25, 7],
      [8.25, 7],
      [8.25, 18.25],
    ],
    [0, 2, 1, 1, 0.75, 0],
  ),
  vl(13.5, 7, 9.25),
  sq(11.25, 12.25, 4.5, 3, 0.75, { square: ['bl', 'br'] }),
  sq(8.25, 15.25, 11, 3, 1, { square: ['tl', 'bl'] }),
  PLINTH,
]);
// Stamping press: the frame (crown and columns standing on the floor), the ram on its rod with the
// down arrow, the sheet on the die block
add('stamping-press', ['prensa', 'troquelado', 'estampado', 'forja', 'stamping press', 'press', 'forging'], [
  rline(
    [
      [4.25, FLOOR],
      [4.25, 2.75],
      [19.75, 2.75],
      [19.75, FLOOR],
    ],
    [0, 2.5, 2.5, 0],
  ),
  vl(12, 2.75, 10.25),
  line([9.88, 8.13], [12, 10.25], [14.12, 8.13]),
  sq(8.75, 10.25, 6.5, 3, 0.75),
  hl(7.25, 16.75, 16.25),
  vl(8.75, 16.25, FLOOR),
  vl(15.25, 16.25, FLOOR),
]);

// ── Automation and control ────────────────────────────────────────────────────────────────────
// Stack light: three lamp segments stacked into a tower, on a short pole and a base; it lights as
// levels from the bottom
add('stack-light', ['torre de luces', 'andon', 'semáforo de máquina', 'señal de línea', 'stack light', 'andon light', 'tower light'], [
  sq(8.5, 11, 7, 4.25, 1, { square: ['tl', 'tr'] }),
  sq(8.5, 6.75, 7, 4.25, 0),
  sq(8.5, 2.75, 7, 4, 2, { square: ['bl', 'br'] }),
  vl(12, 15.25, 18.25),
  sq(8, 18.25, 8, 3, 1),
]);
// Control panel (HMI): a slanted console with its screen on top and a row of round buttons below
add('control-panel', ['panel de control', 'hmi', 'pantalla de operador', 'scada', 'control panel', 'operator panel', 'hmi'], [
  roundpoly(
    [
      [6, 3.75],
      [18, 3.75],
      [21.25, 20.25],
      [2.75, 20.25],
    ],
    [2, 2, 0, 1.5],
  ),
  box(8.5, 7.25, 7, 5, 1),
  ...[8.25, 12, 15.75].map((x) => dot(x, 16)),
]);
// Control cabinet: the tall floor-standing enclosure on its plinth with the core's bolt on its door
// (an electrical panel)
const BOLT = nucleo.icons.bolt.d[0];
add('control-cabinet', ['gabinete eléctrico', 'tablero de control', 'armario', 'control cabinet', 'electrical enclosure', 'panel enclosure'], [
  box(4.75, 2.75, 14.5, 15.5, 2.5),
  rline(
    [
      [5.75, 18.25],
      [5.75, FLOOR],
      [18.25, FLOOR],
      [18.25, 18.25],
    ],
    [0, 0.75, 0.75, 0],
  ),
  place(BOLT, 0.55, [12, 12], [12, 10.5]),
]);
// Connected factory: lugares' factory at 72% from its left foot and two signal arcs rising over its
// roof
add('factory-connected', ['fábrica conectada', 'fábrica inteligente', 'industria 4.0', 'iiot', 'smart factory', 'connected factory', 'industry 4.0'], [
  ...FACTORY.map((d) => place(d, 0.72, [2.75, FLOOR])),
  arc(14.5, 11.5, 3.5, -140, -40).d,
  arc(14.5, 11.5, 6.5, -140, -40).d,
]);

// ── Forming and the shop ──────────────────────────────────────────────────────────────────────
/** A segment from circle (c, r) toward point p, starting at the circle's edge. */
const fromEdge = (c, r, p, rEnd = 0) => {
  const L = Math.hypot(p[0] - c[0], p[1] - c[1]);
  const u = [(p[0] - c[0]) / L, (p[1] - c[1]) / L];
  return line([c[0] + u[0] * r, c[1] + u[1] * r], [p[0] - u[0] * rEnd, p[1] - u[1] * rEnd]);
};

// Industrial furnace: the squat chamber with its door raised (the opening), the glowing part on the
// hearth inside and the heat rising off the top
const heat = (x, y0, y1) => `M${P([x, y0])}C${P([x + 1.25, y0 - (y0 - y1) * 0.3])} ${P([x - 1.25, y0 - (y0 - y1) * 0.7])} ${P([x, y1])}`;
add('industrial-furnace', ['horno industrial', 'tratamiento térmico', 'recocido', 'curado', 'industrial furnace', 'heat treatment', 'kiln'], [
  box(3.25, 9.25, 17.5, 12, 3),
  rline(
    [
      [7, FLOOR],
      [7, 12.75],
      [17, 12.75],
      [17, FLOOR],
    ],
    [0, 1.5, 1.5, 0],
  ),
  rline(
    [
      [10, FLOOR],
      [10, 17.75],
      [14, 17.75],
      [14, FLOOR],
    ],
    [0, 0.75, 0.75, 0],
  ),
  heat(8, 6.25, 2.75),
  heat(12, 6.25, 2.75),
  heat(16, 6.25, 2.75),
]);

// Crucible: the tapered pot tipped 40° on its trunnion (the pivot dot), pouring its stream from the
// lip into the ingot mold below
const CRU = [8.75, 9];
const cru = (p) => rot([CRU[0] + p[0], CRU[1] + p[1]], CRU, 40);
const LIP = cru([4.5, -4.25]);
/** Where the stream leaves the lip: on its straight edge, 1 short of the rounded corner. */
const LIP_ON = (() => {
  const o = cru([-4.5, -4.25]);
  const L = Math.hypot(o[0] - LIP[0], o[1] - LIP[1]);
  return [LIP[0] + (o[0] - LIP[0]) / L, LIP[1] + (o[1] - LIP[1]) / L];
})();
add('crucible', ['crisol', 'fundición', 'metal fundido', 'colada', 'crucible', 'foundry', 'molten metal'], [
  roundpoly([cru([-4.5, -4.25]), LIP, cru([3, 4]), cru([-3, 4])], [0.6, 0.6, 1.5, 1.5]),
  dot(...CRU),
  `M${P(LIP_ON)}C${P([LIP[0] + 1.5, LIP[1] - 0.25])} ${P([17.25, LIP[1] + 1])} ${P([17.25, LIP[1] + 3])}V18.25`,
  rline(
    [
      [14.25, 18.25],
      [14.25, FLOOR],
      [20.25, FLOOR],
      [20.25, 18.25],
    ],
    [0, 1, 1, 0],
  ),
]);

// Anvil: the flat face, the horn tapering to the left, the narrow waist and the wide foot, one outline
add('anvil', ['yunque', 'forja', 'herrería', 'metalurgia', 'anvil', 'forging', 'blacksmith'], [
  roundpoly(
    [
      [2.75, 6.75],
      [8.5, 5.75],
      [21.25, 5.75],
      [21.25, 9.25],
      [16, 10.75],
      [15, 15.25],
      [19.25, 18.75],
      [19.25, FLOOR],
      [4.75, FLOOR],
      [4.75, 18.75],
      [9, 15.25],
      [8.5, 10.75],
      [6.25, 9.25],
    ],
    [0.5, 0, 0.75, 0.75, 1.5, 1.5, 1, 0.5, 0.5, 1, 1.5, 1.5, 2],
  ),
]);

// Mine cart: the open cart heaped with ore, on its two wheels over the rail
add('mine-cart', ['vagoneta minera', 'minería', 'carro minero', 'extracción', 'mine cart', 'mining', 'ore cart'], [
  roundpoly(
    [
      [3.25, 10.25],
      [20.75, 10.25],
      [18.25, 17.5],
      [5.75, 17.5],
    ],
    [0.75, 0.75, 1.25, 1.25],
  ),
  puff(
    [
      [8.25, 8.25, 2.25],
      [12.25, 6.5, 2.75],
      [16, 8.25, 2.25],
    ],
    10.25,
  ),
  circ(8, 19.5, 1.75),
  circ(16, 19.5, 1.75),
  hl(3.75, 20.25, FLOOR),
]);

// ── Automation ────────────────────────────────────────────────────────────────────────────────
// Robotic arm: the round base, the shoulder on it, the arm bent at the elbow joint, and the
// two-finger gripper at the end
const ARM = { base: [8, FLOOR], shoulder: [8, 15.75], elbow: [12.25, 6.25], wrist: [18.5, 10.25] };
add('robotic-arm', ['brazo robótico', 'robot industrial', 'automatización', 'celda robótica', 'robotic arm', 'industrial robot', 'automation'], [
  `M4.25 ${f(FLOOR)}A3.75 3.75 0 0 1 11.75 ${f(FLOOR)}Z`,
  circ(...ARM.shoulder, 1.75),
  fromEdge(ARM.shoulder, 1.75, ARM.elbow, 1.75),
  circ(...ARM.elbow, 1.75),
  fromEdge(ARM.elbow, 1.75, ARM.wrist),
  rline(
    [
      [16.5, 13.75],
      [16.5, 10.25],
      [20.5, 10.25],
      [20.5, 13.75],
    ],
    [0, 0.5, 0.5, 0],
  ),
]);

// Assembly line: the belt, two parts riding on it and the arm reaching down over the first
add('assembly-line', ['línea de ensamble', 'línea de producción', 'estaciones', 'manufactura', 'assembly line', 'production line', 'conveyor'], [
  capsule(2.75, 17.75, 18.5, 3.5),
  sq(4.75, 13.25, 4.5, 4.5, 1, { square: ['bl', 'br'] }),
  sq(14.75, 13.25, 4.5, 4.5, 1, { square: ['bl', 'br'] }),
  circ(18.25, 4.5, 1.75),
  rline(
    [
      [16.5, 4.5],
      [10.5, 4.5],
      [7, 7.75],
    ],
    [0, 1.5, 0],
  ),
  rline(
    [
      [5, 10.25],
      [5, 7.75],
      [9, 7.75],
      [9, 10.25],
    ],
    [0, 0.5, 0.5, 0],
  ),
]);

// Bottling line: three bottles standing on the line, 3 apart, and the filler over the middle one with
// its nozzle coming down 1.5 above the neck
/** A bottle standing on the floor at x0: a body 4.75 wide, its shoulders narrowing to a neck 3 wide. */
const bottle = (x0) => {
  const xc = x0 + 2.375;
  return roundpoly(
    [
      [x0, FLOOR],
      [x0, 15.75],
      [xc - 1.5, 13.75],
      [xc - 1.5, 10.75],
      [xc + 1.5, 10.75],
      [xc + 1.5, 13.75],
      [x0 + 4.75, 15.75],
      [x0 + 4.75, FLOOR],
    ],
    [0, 1, 0.6, 0.6, 0.6, 0.6, 1, 0],
  );
};
add('bottling-line', ['embotelladora', 'llenado', 'envasado', 'bebidas', 'bottling line', 'filling', 'packaging line'], [
  hl(1.875, 22.125, FLOOR),
  ...[1.875, 9.625, 17.375].map(bottle),
  sq(9.5, 2.75, 5, 3, 1),
  vl(12, 5.75, 7.75),
]);

// ── Machine elements ──────────────────────────────────────────────────────────────────────────
// Induction motor: the finned body, the terminal box on top, the feet on their base and the shaft
add('induction-motor', ['motor eléctrico', 'motor de inducción', 'equipo rotativo', 'mantenimiento', 'electric motor', 'induction motor', 'motor'], [
  sq(3.25, 7.75, 13.5, 10, 2),
  hl(6.25, 13.75, 11.25),
  hl(6.25, 13.75, 14.25),
  rline(
    [
      [7.75, 7.75],
      [7.75, 4.75],
      [12.25, 4.75],
      [12.25, 7.75],
    ],
    [0, 0.75, 0.75, 0],
  ),
  vl(6.25, 17.75, 20.75),
  vl(13.75, 17.75, 20.75),
  hl(4.25, 15.75, 20.75),
  hl(16.75, 21.25, 12.75),
]);

// Hydraulic cylinder: the barrel with the piston inside it, the rod coming out of its end and an eye
// mount at each end
add('hydraulic-cylinder', ['cilindro hidráulico', 'pistón', 'actuador', 'neumática', 'hydraulic cylinder', 'actuator', 'piston'], [
  sq(4.75, 8.75, 10.5, 6.5, 1.25),
  circ(3.25, 12, 1.5),
  sq(15.25, 10.5, 3.5, 3, 0.4, { square: ['tl', 'bl'] }),
  circ(20.25, 12, 1.5),
  vl(12.25, 8.75, 15.25),
]);

// Ball bearing: the outer and inner rings with the balls between them
add('ball-bearing', ['rodamiento', 'balero', 'cojinete', 'refacción', 'ball bearing', 'bearing', 'spare part'], [
  circ(12, 12, 8.75),
  circ(12, 12, 2.75),
  ...Array.from({ length: 8 }, (_, i) => dot(...polar(12, 12, 5.75, -90 + i * 45))),
]);

// Coil spring: the flat end coils and the coil zigzagging between them
add('coil-spring', ['resorte', 'muelle', 'compresión', 'refacción', 'coil spring', 'spring', 'compression'], [
  hl(7, 17, 3.25),
  rline(
    [
      [17, 3.25],
      [7, 5.75],
      [17, 8.25],
      [7, 10.75],
      [17, 13.25],
      [7, 15.75],
      [17, 18.25],
      [7, 20.75],
    ],
    [0, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0],
  ),
  hl(7, 17, 20.75),
]);

/** The cranes' and hoists' hook: a shank from (x, y) and the bowl turning back to the left. */
const hook = (x, y) => `M${P([x, y])}V${f(y + 1.25)}A2 2 0 0 1 ${P([x - 4, y + 1.25])}V${f(y + 0.5)}`;

// Pulley: the wheel hanging from its bracket, the rope over it with the weight on one end
add('pulley', ['polea', 'garrucha', 'elevación', 'ventaja mecánica', 'pulley', 'block', 'lifting'], [
  hl(6.75, 17.25, 2.75),
  vl(12, 2.75, 10.25),
  circ(12, 10.25, 3.75),
  dot(12, 10.25),
  vl(8.25, 10.25, 18.25),
  vl(15.75, 10.25, 17.25),
  roundpoly(
    [
      [13.75, 17.25],
      [17.75, 17.25],
      [18.75, 21.25],
      [12.75, 21.25],
    ],
    [0.75, 0.75, 0.75, 0.75],
  ),
]);

// Belt drive: a large and a small pulley with their hubs and the belt, the two lines tangent to both
const BELT = (() => {
  const [c1, r1, c2, r2] = [[7.75, 13.25], 4.75, [17.75, 8.75], 2.75];
  const th = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
  const al = Math.acos((r1 - r2) / Math.hypot(c2[0] - c1[0], c2[1] - c1[1]));
  const at = (c, r, a) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  return [circ(...c1, r1), circ(...c2, r2), line(at(c1, r1, th + al), at(c2, r2, th + al)), line(at(c1, r1, th - al), at(c2, r2, th - al)), dot(...c1), dot(...c2)];
})();
add('belt-drive', ['transmisión por banda', 'poleas', 'correa', 'transmisión', 'belt drive', 'pulleys', 'power transmission'], BELT);

// Rack and pinion: sistema's small gear (the one on its gears icon) over the toothed bar, its lowest
// tooth 1.5 above the bar's teeth, and the arrow of the bar's travel beside it
const RACK = (() => {
  const pts = [
    [2.75, 19.75],
    [2.75, 17],
  ];
  for (let i = 0; i < 4; i++) {
    const x = 5 + i * 3.75;
    pts.push([x, 17], [x + 0.75, 15.5], [x + 1.75, 15.5], [x + 2.5, 17]);
  }
  pts.push([21.25, 17], [21.25, 19.75]);
  return roundpoly(
    pts,
    pts.map((_, i) => (i < 2 || i >= pts.length - 2 ? 0.75 : 0.3)),
  );
})();
add('rack-and-pinion', ['cremallera y piñón', 'engranaje', 'movimiento lineal', 'actuador', 'rack and pinion', 'gear', 'linear motion'], [
  gear(7.5, 8, 4.5, 3.15, 6, 0.55, 0.7),
  dot(7.5, 8),
  RACK,
  hl(15.25, 20.75, 8),
  line([18.35, 5.6], [20.75, 8], [18.35, 10.4]),
]);

// ── Lifting ───────────────────────────────────────────────────────────────────────────────────
// Overhead crane: the bridge beam on its two end columns, the trolley under it and the hook on its
// cable
add('overhead-crane', ['grúa puente', 'polipasto', 'elevación', 'nave industrial', 'overhead crane', 'bridge crane', 'lifting'], [
  sq(2.75, 3.75, 18.5, 3, 1),
  vl(4.75, 6.75, FLOOR),
  vl(19.25, 6.75, FLOOR),
  rline(
    [
      [9.75, 6.75],
      [9.75, 9.25],
      [14.25, 9.25],
      [14.25, 6.75],
    ],
    [0, 0.75, 0.75, 0],
  ),
  vl(12, 9.25, 13),
  hook(12, 13),
]);

// Gantry crane: the top beam on two legs that splay out to their wheels, the hook over the load
// standing between them
add('gantry-crane', ['grúa pórtico', 'pórtico', 'patio de carga', 'elevación', 'gantry crane', 'gantry', 'lifting'], [
  sq(2.75, 3.25, 18.5, 3, 1),
  line([6.25, 6.25], [3.75, 19.75]),
  line([17.75, 6.25], [20.25, 19.75]),
  dot(3.75, 20.25),
  dot(20.25, 20.25),
  vl(13.25, 6.25, 9.25),
  hook(13.25, 9.25),
  box(8.75, 16.25, 6.5, 5, 1.25),
]);

// ── Piping ────────────────────────────────────────────────────────────────────────────────────
// The pipes share one bore: walls 6 apart, heavier than household plumbing, and one flange (two
// plates standing 3 past the walls)
/** A run of pipe from x0 to x1 with its walls centered on y. */
const pipe = (x0, x1, y) => [hl(x0, x1, y - 3), hl(x0, x1, y + 3)];
// Flange: two pipe ends meeting at the raised plates of the joint, bolted across
add('flange', ['brida', 'unión bridada', 'tubería', 'conexión', 'flange', 'flanged joint', 'piping'], [
  ...pipe(2.75, 9, 12),
  sq(9, 3.75, 6, 16.5, 1.25),
  vl(12, 3.75, 20.25),
  ...pipe(15, 21.25, 12),
  hl(7.5, 16.5, 6),
  hl(7.5, 16.5, 18),
]);
// Pipeline: the long pipe on its two support stands, joined in the middle by a raised flange (a plate
// standing 3 past the walls)
const PIPE_JOINT = sq(9.75, 5.75, 4.5, 12, 1);
const PIPELINE = [...pipe(2.75, 9.75, 11.75), PIPE_JOINT, ...pipe(14.25, 21.25, 11.75)];
const stand = (x) => [vl(x, 14.75, 19.75), hl(x - 2, x + 2, 19.75)];
add('pipeline', ['oleoducto', 'gasoducto', 'tubería', 'ducto', 'pipeline', 'piping', 'oil and gas'], [...PIPELINE, ...stand(5.25), ...stand(18.75)]);
// Pipeline leak: the pipeline with its bottom wall broken past the joint and a drop (lugares') falling
// from the break, where the second stand was
add('pipeline-leak', ['fuga', 'fuga en tubería', 'detección de fugas', 'derrame', 'pipeline leak', 'leak detection', 'spill'], [
  ...PIPELINE.slice(0, 4),
  hl(14.25, 16.25, 14.75),
  hl(19.25, 21.25, 14.75),
  ...stand(5.25),
  place(DROPLET, 0.2, [12, 3.25], [17.75, 17.5]),
]);
// Pump: the volute (its eye at the center) with the discharge leaving it tangent at the top, rising to
// its flange, and the motor coupled to it on its foot, both on the floor
const VOLUTE = [8.25, 15.5];
add('pump', ['bomba', 'bomba centrífuga', 'bombeo', 'equipo rotativo', 'pump', 'centrifugal pump', 'pumping'], [
  `M14 6.75V15.5A5.75 5.75 0 1 1 8 9.76V6.75Z`,
  dot(...VOLUTE),
  hl(7, 15, 6.75),
  hl(14, 16.5, 15.5),
  sq(16.5, 12, 3.75, 7, 1.25),
  vl(18.375, 19, FLOOR),
  hl(2.75, 21.25, FLOOR),
]);
// Valve: the pipe through the valve's body, its stem rising to the handwheel
add('valve', ['válvula', 'llave de paso', 'control de flujo', 'tubería', 'valve', 'gate valve', 'flow control'], [
  ...pipe(2.75, 8, 14.75),
  sq(8, 9.25, 8, 11, 2),
  ...pipe(16, 21.25, 14.75),
  vl(12, 5.25, 9.25),
  hl(7.5, 16.5, 5.25),
]);
// Control valve: the bowtie body on its line, the stem rising to the domed actuator
add('control-valve', ['válvula de control', 'actuador', 'control automático', 'proceso', 'control valve', 'actuated valve', 'process control'], [
  hl(2.75, 7, 16.25),
  roundpoly(
    [
      [7, 12.75],
      [12, 16.25],
      [7, 19.75],
    ],
    [0.75, 0.3, 0.75],
  ),
  roundpoly(
    [
      [17, 12.75],
      [17, 19.75],
      [12, 16.25],
    ],
    [0.75, 0.75, 0.3],
  ),
  hl(17, 21.25, 16.25),
  vl(12, 9.75, 16.25),
  `M6.5 9.75A5.5 5.5 0 0 1 17.5 9.75Z`,
]);
// Pressure gauge: the dial with its needle on the hub, the stem down to the hex fitting that screws it
// into a line
add('pressure-gauge', ['manómetro', 'presión', 'medidor', 'tubería', 'pressure gauge', 'manometer', 'pressure'], [
  circ(12, 9.5, 6.75),
  line([12, 9.5], polar(12, 9.5, 3.75, -45)),
  dot(12, 9.5),
  vl(12, 16.25, 18.25),
  sq(8.75, 18.25, 6.5, 3, 0.75),
]);

// ── Tanks and bulk (all on the floor at 21.25) ────────────────────────────────────────────────
// Air compressor: the horizontal tank on its wheels, the pump's finned head on top and the dial on its
// stem
add('air-compressor', ['compresor de aire', 'aire comprimido', 'neumática', 'tanque', 'air compressor', 'compressed air', 'compressor'], [
  capsule(3.25, 11.75, 17.5, 6.5),
  circ(7.25, 19.75, 1.5),
  circ(16.75, 19.75, 1.5),
  rline(
    [
      [11.75, 11.75],
      [11.75, 5.25],
      [18.25, 5.25],
      [18.25, 11.75],
    ],
    [0, 1.25, 1.25, 0],
  ),
  hl(11.75, 18.25, 8.5),
  circ(6.5, 7.25, 2.25),
  vl(6.5, 9.5, 11.75),
]);
// Storage tank: the squat cylinder under its shallow domed roof, the ladder up its side, the liquid's
// levels inside (the ladder's rungs at the same heights)
add('storage-tank', ['tanque de almacenamiento', 'nivel de tanque', 'parque de tanques', 'inventario', 'storage tank', 'tank level', 'tank farm'], [
  `M2.75 ${f(FLOOR)}V9.75A13.25 13.25 0 0 1 16.75 9.75V${f(FLOOR)}Z`,
  hl(2.75, 16.75, 9.75),
  vl(19.75, 9.75, FLOOR),
  hl(16.75, 19.75, 14.25),
  hl(16.75, 19.75, 17.75),
  hl(2.75, 16.75, 17.75),
  hl(2.75, 16.75, 14.25),
]);
// Mixing tank: the vessel with its dished bottom, the motor on the lid driving the shaft down to the
// impeller
add('mixing-tank', ['tanque de mezcla', 'agitador', 'reactor', 'mezclado', 'mixing tank', 'agitator', 'reactor'], [
  sq(4.25, 8.25, 15.5, 13, 4, { square: ['tl', 'tr'] }),
  rline(
    [
      [9.5, 8.25],
      [9.5, 3.25],
      [14.5, 3.25],
      [14.5, 8.25],
    ],
    [0, 1, 1, 0],
  ),
  smooth(Array.from({ length: 7 }, (_, i) => [4.25 + i * 2.583, 11.75 + (i % 2 ? -0.5 : 0.5)])),
  vl(12, 8.25, 16.25),
  hl(8.5, 15.5, 16.25),
]);
// Fermentation tank: the cylinder ending in its cone, on splayed legs, the valve at the cone's tip
add('fermentation-tank', ['fermentador', 'tanque cónico', 'cervecería', 'biotecnología', 'fermentation tank', 'fermenter', 'brewing'], [
  roundpoly(
    [
      [6.25, 2.75],
      [17.75, 2.75],
      [17.75, 12.25],
      [12, 17.25],
      [6.25, 12.25],
    ],
    [2.5, 2.5, 1, 0.75, 1],
  ),
  line([6.25, 12.25], [5, FLOOR]),
  line([17.75, 12.25], [19, FLOOR]),
  vl(12, 17.25, 20.75),
  hl(10.25, 13.75, 20),
]);
// Tote tank (IBC): the grid cage around the tank, standing on its pallet (the cage's floor is the
// pallet's top deck, three blocks under it)
add('tote-tank', ['contenedor ibc', 'tótem', 'granel líquido', 'químicos', 'ibc tote', 'tote tank', 'bulk container'], [
  box(4.75, 5.25, 14.5, 13, 2),
  vl(9.58, 5.25, 18.25),
  vl(14.42, 5.25, 18.25),
  hl(4.75, 19.25, 11.75),
  hl(4.25, 19.75, FLOOR),
  ...[5.75, 12, 18.25].map((x) => vl(x, 18.25, FLOOR)),
]);
// Hopper: the bin narrowing to its outlet chute, on its two legs
add('hopper', ['tolva', 'alimentador', 'silo', 'granel', 'hopper', 'feed bin', 'bulk material'], [
  roundpoly(
    [
      [3.25, 2.75],
      [20.75, 2.75],
      [20.75, 6.25],
      [13.75, 13.75],
      [10.25, 13.75],
      [3.25, 6.25],
    ],
    [1, 1, 0.75, 0.75, 0.75, 0.75],
  ),
  vl(10.5, 13.75, 16.25),
  vl(13.5, 13.75, 16.25),
  vl(7.25, 10.25, FLOOR),
  vl(16.75, 10.25, FLOOR),
]);

// ── Parts ─────────────────────────────────────────────────────────────────────────────────────
/** The workpiece: an angle bracket (two arms 6 wide at a right angle), its outer corner at (x0, y1). */
const bracketAt = (x0, y1, size, arm = 6) =>
  roundpoly(
    [
      [x0, y1 - size],
      [x0 + size, y1 - size],
      [x0 + size, y1 - size + arm],
      [x0 + arm, y1 - size + arm],
      [x0 + arm, y1],
      [x0, y1],
    ],
    [2, 1.5, 1.5, 1, 1.5, 1.5],
  );
/** The workpiece with its two bolt holes (dots: a ring beside a status badge breaks the weights). */
const workpieceAt = (x0, y1, size) => [bracketAt(x0, y1, size), dot(x0 + 3, y1 - 5), dot(x0 + size - 5, y1 - size + 3)];
const WORKPIECE = workpieceAt(3.25, 20.75, 17.5);
add('workpiece', ['pieza', 'componente', 'parte', 'número de parte', 'workpiece', 'part', 'component'], WORKPIECE);
// Batch: three brackets stacked with an offset, the back ones behind the front one
const BATCH = (() => {
  const [a, b, c] = [0, 1, 2].map((k) => bracketAt(3.25 + k * 3.5, 20.75 - k * 3.5, 11.5, 4.5));
  return [a, behind(b, [a]), behind(c, [a, b])];
})();
add('workpiece-batch', ['lote', 'lote de piezas', 'cantidad', 'producción', 'workpiece batch', 'batch', 'lot'], BATCH);
add('workpiece-check', ['pieza aprobada', 'conforme', 'calidad aprobada', 'qc pass', 'part passed', 'conforming'], WORKPIECE);
add('workpiece-x', ['pieza rechazada', 'scrap', 'no conforme', 'part rejected', 'reject', 'failed inspection'], WORKPIECE);
add('workpiece-search', ['inspección de pieza', 'buscar pieza', 'calidad', 'part inspection', 'find part', 'quality inspection'], WORKPIECE);
// Dimensions: the workpiece drawn 14 across at the bottom left, the dimension line over it with its
// ticks
add('workpiece-dimensions', ['dimensiones', 'tolerancias', 'cotas', 'metrología', 'part dimensions', 'tolerance', 'measurement'], [
  ...workpieceAt(3.25, 20.75, 14),
  hl(3.25, 17.25, 2.75),
  vl(3.25, 1.75, 3.75),
  vl(17.25, 1.75, 3.75),
]);
// Exploded view: the cap, the body and the base pulled apart along their axis
add('exploded-view', ['vista explosionada', 'lista de materiales', 'ensamble', 'componentes', 'exploded view', 'bill of materials', 'assembly'], [
  sq(8.25, 2.75, 7.5, 3, 1),
  sq(6.25, 9.25, 11.5, 6, 1.5),
  sq(4.25, 18.25, 15.5, 3, 1),
  vl(12, 5.75, 9.25),
  vl(12, 15.25, 18.25),
]);
// Platform scale: the low platform on the floor and the post at its side carrying the display
add('platform-scale', ['báscula de piso', 'báscula industrial', 'pesaje', 'tarimas', 'platform scale', 'floor scale', 'weighing'], [
  sq(2.75, 18.25, 18.5, 3, 1),
  vl(17.25, 18.25, 10.25),
  box(13.25, 3.75, 8, 6.5, 1.5),
  hl(16.25, 18.25, 7),
]);

// ── Blocks: fill, badges, parts, motion, mirror, levels, value and variants ───────────────────
// Fill by index into d (DESIGN.md › Fill): `solid` closed shapes ({ z: i } closes an open stroke),
// `cut` knocked out, `lines` apart with a clearance, `wire` attached. A string is a path of its own
// (a separator between two solids that touch).
// The spindle's cut runs out past the head's top, so it opens the head at every weight
const MACHINE_FILL = { solid: [0], cut: [1, vl(12, 2.5, 13.25)] };
const WORKPIECE_FILL = { solid: [0], cut: [1, 2] };
const FILL_SPEC = {
  refinery: { solid: [0, 2, 6], cut: [1, 3], wire: [4, 5] },
  'oil-rig': { solid: [0], wire: [1, 2, 3, 4, 5] },
  'drilling-rig': { solid: [2], wire: [0, 1, 3, 4, 5, 6] },
  smokestack: { solid: [{ z: 0 }, 3], cut: [1, 2] },
  machine: MACHINE_FILL,
  'machine-check': MACHINE_FILL,
  'machine-alert': MACHINE_FILL,
  'machine-clock': MACHINE_FILL,
  'machine-vibration': { ...MACHINE_FILL, lines: [3, 4] },
  'milling-machine': { solid: [0, 2, 3, { z: 4 }], cut: [hl(8.25, 22.5, 15.25), SEAM], wire: [1] },
  'stamping-press': { solid: [3], wire: [0, 1, 2, 4, 5, 6] },
  'stack-light': { solid: [0, 1, 2, 4], cut: [hl(7.5, 16.5, 6.75), hl(7.5, 16.5, 11)], wire: [3] },
  'control-panel': { solid: [0], cut: [1, 2, 3, 4] },
  'control-cabinet': { solid: [0, { z: 1 }], cut: [2, SEAM] },
  'factory-connected': { solid: [0], cut: [1], lines: [2, 3] },
  'industrial-furnace': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
  crucible: { solid: [0], cut: [1], wire: [2, 3] },
  anvil: { solid: [0] },
  'mine-cart': { solid: [0, 1, 2, 3], cut: [hl(1.5, 22.5, 10.25)], wire: [4] },
  'robotic-arm': { solid: [0, 1, 3], wire: [2, 4, 5] },
  'assembly-line': { solid: [0, 1, 2, 3], cut: [hl(4.75, 9.25, 17.75), hl(14.75, 19.25, 17.75)], wire: [4, 5] },
  'bottling-line': { solid: [1, 2, 3, 4], wire: [0, 5] },
  'induction-motor': { solid: [0, { z: 3 }], cut: [1, 2], wire: [4, 5, 6, 7] },
  'hydraulic-cylinder': { solid: [0, 2], cut: [4], wire: [1, 3] },
  'ball-bearing': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  'coil-spring': false,
  pulley: { solid: [2, 6], cut: [3], wire: [0, 1, 4, 5] },
  'belt-drive': { solid: [0, 1], cut: [4, 5], wire: [2, 3] },
  'rack-and-pinion': { solid: [0, 2], cut: [1], lines: [3, 4] },
  'overhead-crane': { solid: [0, { z: 3 }], wire: [1, 2, 4, 5] },
  'gantry-crane': { solid: [0, 3, 4, 7], wire: [1, 2, 5, 6] },
  flange: { solid: [2], cut: [3], wire: [0, 1, 4, 5, 6, 7] },
  pipeline: { solid: [2], wire: [0, 1, 3, 4, 5, 6, 7, 8] },
  'pipeline-leak': { solid: [2, 8], wire: [0, 1, 3, 4, 5, 6, 7] },
  pump: { solid: [0, 4], cut: [1], wire: [2, 3, 5, 6] },
  valve: { solid: [2], wire: [0, 1, 3, 4, 5, 6] },
  'control-valve': { solid: [1, 2, 5], wire: [0, 3, 4] },
  'pressure-gauge': { solid: [0, 4], cut: [1, 2], wire: [3] },
  'air-compressor': { solid: [0, 1, 2, 5, { z: 3 }], cut: [4], wire: [6] },
  'storage-tank': { solid: [0], cut: [1, 5, 6], wire: [2, 3, 4] },
  'mixing-tank': { solid: [0, { z: 1 }], cut: [2, 3, 4] },
  'fermentation-tank': { solid: [0], wire: [1, 2, 3, 4] },
  'tote-tank': { solid: [0], cut: [1, 2, 3], wire: [4, 5, 6, 7] },
  hopper: { solid: [0], wire: [1, 2, 3, 4] },
  workpiece: WORKPIECE_FILL,
  'workpiece-check': WORKPIECE_FILL,
  'workpiece-x': WORKPIECE_FILL,
  'workpiece-search': WORKPIECE_FILL,
  'workpiece-batch': { solid: [0], lines: [1, 2] },
  'workpiece-dimensions': { solid: [0], cut: [1, 2], wire: [3, 4, 5] },
  'exploded-view': { solid: [0, 1, 2], wire: [3, 4] },
  'platform-scale': { solid: [0, 2], cut: [3], wire: [1] },
};
const pick = (name, list) => list.map((x) => (typeof x === 'number' ? icons[name].d[x] : typeof x === 'string' ? x : shut(icons[name].d[x.z])));
for (const [name, spec] of Object.entries(FILL_SPEC)) {
  icons[name].fill = spec && Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, pick(name, v)]));
}

// Badges: the engine's, always
const BADGES = {
  'machine-check': 'check',
  'machine-alert': 'alert',
  'machine-clock': 'clock',
  'workpiece-check': 'check',
  'workpiece-x': 'x',
  'workpiece-search': 'search',
};
for (const [name, kind] of Object.entries(BADGES)) icons[name].badge = badge(kind);

// Named parts (by index into d)
const MACHINE_PARTS = { body: [0], window: [1], spindle: [2] };
const PARTS = {
  refinery: { columns: [0, 1, 2, 3], pipe: [4], stack: [5], flame: [6] },
  smokestack: { body: [0, 1, 2], smoke: [3] },
  machine: MACHINE_PARTS,
  'machine-check': MACHINE_PARTS,
  'machine-alert': MACHINE_PARTS,
  'machine-clock': MACHINE_PARTS,
  'machine-vibration': { ...MACHINE_PARTS, wave: [3, 4] },
  'stamping-press': { frame: [0], ram: [1, 2, 3], part: [4, 5, 6] },
  'stack-light': { level: [0, 1, 2], pole: [3], base: [4] },
  'control-cabinet': { body: [0, 1], bolt: [2] },
  'factory-connected': { factory: [0, 1], signal: [2, 3] },
  'industrial-furnace': { body: [0], door: [1], part: [2], heat: [3, 4, 5] },
  crucible: { crucible: [0, 1], stream: [2], mold: [3] },
  'robotic-arm': { base: [0], arm: [1, 2, 3, 4], gripper: [5] },
  'hydraulic-cylinder': { barrel: [0, 4], mount: [1], rod: [2, 3] },
  'ball-bearing': { body: [0, 1], balls: [2, 3, 4, 5, 6, 7, 8, 9] },
  'coil-spring': { ends: [0, 2], spring: [1] },
  pulley: { bracket: [0, 1], wheel: [2, 3], rope: [4, 5], weight: [6] },
  'belt-drive': { pulleys: [0, 1, 4, 5], belt: [2, 3] },
  'rack-and-pinion': { gear: [0, 1], rack: [2], arrow: [3, 4] },
  'overhead-crane': { beam: [0], columns: [1, 2], trolley: [3, 4, 5] },
  'gantry-crane': { beam: [0], legs: [1, 2, 3, 4], hook: [5, 6], load: [7] },
  'pipeline-leak': { pipe: [0, 1, 2, 3, 4, 5], stand: [6, 7], drop: [8] },
  pump: { volute: [0, 1, 2], motor: [3, 4, 5], base: [6] },
  valve: { pipe: [0, 1, 3, 4], body: [2], handle: [5, 6] },
  'control-valve': { pipe: [0, 3], body: [1, 2], stem: [4], actuator: [5] },
  'pressure-gauge': { dial: [0], needle: [1], hub: [2], stem: [3, 4] },
  'storage-tank': { body: [0, 1], ladder: [2, 3, 4], level: [5, 6] },
  'mixing-tank': { tank: [0], motor: [1], liquid: [2], shaft: [3, 4] },
  workpiece: { part: [0, 1, 2] },
  'workpiece-check': { part: [0, 1, 2] },
  'workpiece-x': { part: [0, 1, 2] },
  'workpiece-search': { part: [0, 1, 2] },
  'workpiece-batch': { part: [0], batch: [1, 2] },
  'workpiece-dimensions': { part: [0, 1, 2], dimension: [3, 4, 5] },
  'exploded-view': { cap: [0], body: [1], base: [2], axis: [3, 4] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// Motion: each icon's own gesture
const MOTION = {
  refinery: { effect: 'beat', parts: ['flame'], origin: [19.5, 11.5] },
  smokestack: { effect: 'float', parts: ['smoke'], vector: [0.75, -1.5] },
  'machine-vibration': { effect: 'wiggle', origin: [12, FLOOR] },
  'machine-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'industrial-furnace': { effect: 'float', parts: ['heat'], vector: [0, -1.5] },
  'robotic-arm': { effect: 'wiggle', parts: ['arm', 'gripper'], origin: ARM.shoulder },
  'hydraulic-cylinder': { effect: 'slide', parts: ['rod'], vector: [1.5, 0] },
  'ball-bearing': { effect: 'spin', parts: ['balls'], origin: [12, 12] },
  'coil-spring': { effect: 'beat', origin: [12, 12] },
  'rack-and-pinion': { effect: 'spin', parts: ['gear'], origin: [7.5, 8] },
  'overhead-crane': { effect: 'slide', parts: ['trolley'], vector: [2.5, 0] },
  'pipeline-leak': { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// Mirror: the icons whose arrow points one way
for (const name of ['rack-and-pinion']) icons[name].mirror = true;

// Levels: the stack light lights up from the bottom lamp; the tank fills up from its lower level
icons['stack-light'].levels = [[0], [1], [2]];
icons['storage-tank'].levels = [[5], [6]];

// Value: the gauge's needle sweeps the dial clockwise, from the bottom left (0) to the bottom right (1)
icons['pressure-gauge'].value = { turn: { parts: ['needle'], origin: [12, 9.5], from: 135, to: 405, at: -45 } };

// Variants: a bearing already comes as a circle
icons['ball-bearing'].variants = { circle: false };

export default { category: 'industria', label: 'Industria y manufactura', icons };
