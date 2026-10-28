// Restaurantes (restaurants and dining): menus, reservations, the floor plan's tables and seats,
// service (the waiter, the bells, the cloche, the bill), takeaway, street food and venues, the
// kitchen's pass, portions and dietary labels. Everything is computed with the engine
// (engine/geometry.mjs) on the rules in DESIGN.md.
//
// One piece per object, reused by its family: the menu card, the reserved table (its slab and legs
// also carry the buffet), the floor plan's table and chair (a rounded square and a capsule, the round
// table's chairs the same capsule bent around it), the cloche (on its own, on the waiter's tray, in
// the open hand, on the buffet), the place setting, the paper bag (alone, behind a cup, on the
// counter), the service bell (alone, on the counter, on the kitchen's ledge), the plate seen from
// above (a circle) and from the side (cocina's profile, with what the dish is over it or the forks
// sharing it), cocina's bowl, lugares' leaf, the chili. Containers (the menu, the
// folder, the bag, the boxes, the screens) keep the signature's square bottom-right corner; tables,
// plates and round things don't. A piece that passes behind another stops 3 center to center from it
// (behind(), as cocina and rrhh draw it): nothing is trimmed by hand, and badges are the engine's.
import { arc, badge, circ, dot, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import datos from './datos.mjs';
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
/** Closes every open subpath, for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
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
/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
}

// ── Paths as segments (cocina's and rrhh's): behind() keeps what shows of a stroke behind others ──
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
 * `lines` are open strokes in front: only their distance counts.
 */
function behind(d, fronts, gap = 3, min = 2, lines = []) {
  const rings = fronts.flatMap(samples);
  const pts = [...rings.flat(), ...lines.flatMap(samples).flat()];
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep, min);
}

/** Moves a set of paths so their outline's box is centered in the live area (cocina's). */
function fit(ds, box = [2.75, 2.75, 21.25, 21.25]) {
  const pts = ds.flatMap((d) => samples(d).flat());
  const [x0, y0, x1, y1] = [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
  const dx = (box[0] + box[2]) / 2 - (x0 + x1) / 2;
  const dy = (box[1] + box[3]) / 2 - (y0 + y1) / 2;
  return ds.map((d) => move(d, dx, dy));
}

const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
const N = nucleo.icons;
/** Whole shapes the fills need where the outline shows them cut (behind another piece). */
const KEEP = {};
/** The badges' center (DESIGN.md › Badges). */
const BC = [17.25, 17.25];
const rad = (deg) => (deg * Math.PI) / 180;

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
// cocina's plate in profile (its meal slots stand things over it): the symbol icons below share it.
const PLATE_SIDE = roundpoly([[2.75, 18.25], [21.25, 18.25], [18.75, 21.25], [5.25, 21.25]], [0.6, 0.6, 1.5, 1.5]);
/** cocina's wisp of steam, rising from y0 to y1 at x; `a` is how far it sways. */
const wisp = (x, y0, y1, a = 0.85) => {
  const k = (y0 - y1) / 4;
  return `M${f(x)} ${f(y0)}C${f(x - a)} ${f(y0 - k)} ${f(x - a)} ${f(y0 - 2 * k)} ${f(x)} ${f(y0 - 2 * k)}S${f(x + a)} ${f(y1 + k)} ${f(x)} ${f(y1)}`;
};
/** A two-tine fork, seen from above: the tines a U of radius 1.5 and the handle from its bottom. */
const fork2 = (x, top, bottom) => [`M${f(x - 1.5)} ${f(top)}V${f(top + 3)}a1.5 1.5 0 0 0 3 0V${f(top)}`, vl(x, top + 4.5, bottom)];
/** cocina's three-tine fork: the tines a U of radius 3 and the handle rising from the middle one. */
const fork3 = (x, top = 2.75, bottom = 21.25, neck = 7) => [`M${f(x - 3)} ${f(top)}V${f(neck)}a3 3 0 0 0 6 0V${f(top)}`, vl(x, top, bottom)];

// ── Menus ─────────────────────────────────────────────────────────────────────────────────────
// The menu card: a tall card (the signature's corner) with a short centered title and three dishes,
// each a line ending in its price (a dot) at the right. The rows stand 3.75 apart so the dots stay
// apart at bold, and every dot lies well inside the star's and the pencil's clearance, so the badges
// take the three prices away at every weight.
const MENU_ROWS = [10, 13.75, 17.5];
const MENU = [box(4.75, 2.75, 14.5, 18.5, 3.75), hl(9.75, 14.25, 6), ...MENU_ROWS.flatMap((y) => [hl(7.75, 12, y), dot(16, y)])];
add('menu-card', ['menú', 'carta', 'platillos', 'precios', 'menu', 'dishes', 'prices'], MENU);
add('menu-card-star', ['recomendación del chef', 'especialidad', 'platillo destacado', "chef's pick", 'house special', 'featured dish'], MENU, { badge: badge('star') });
add('menu-card-edit', ['editar menú', 'editor de menú', 'cambiar precios', 'edit menu', 'menu editor', 'update prices'], MENU, { badge: badge('edit') });
// The menu board: a wide board (the signature's corner) hung by two strings from a nail (a dot: with
// the strings meeting in a bare point the board read as a house under its roof), three dishes with
// their prices.
add('menu-board', ['pizarra', 'menú del día', 'especiales', 'cafetería', 'menu board', 'chalkboard', 'specials'], [
  box(2.5, 7.5, 19, 13.75, 3),
  line([7.5, 7.5], [11.4, 3.6]),
  line([16.5, 7.5], [12.6, 3.6]),
  dot(12, 3.25),
  ...[10.75, 14.5, 18.25].flatMap((y) => [hl(6.5, 12.5, y), dot(16.5, y)]),
]);
{
  // QR menu: an upright card standing in a block, the three corner squares of a QR code on its face;
  // the card's sides go into the block.
  const top = 18.25;
  const card = clip(box(5, 2.75, 14, 18, 3.25), (p) => p[1] < top);
  add('qr-menu', ['menú QR', 'escanear menú', 'pedir en mesa', 'pagar en mesa', 'qr menu', 'scan menu', 'order at table'], [
    sq(3.5, top, 17, 3, 1.25, BR),
    card,
    sq(8, 5.75, 2.5, 2.5, 0.75),
    sq(13.5, 5.75, 2.5, 2.5, 0.75),
    sq(8, 11.25, 2.5, 2.5, 0.75),
  ]);
}

// ── Reservations ──────────────────────────────────────────────────────────────────────────────
// The reserved table, in profile: a slab top on two legs (hogar's table), and the folded reserved
// card standing on it as a small tent at its left end, clear of the badges. Two legs and not a
// pedestal: under a badge the pedestal would vanish, the left leg stays. (A flat placard read as a
// monitor on a desk, a trapezoid as a lamp, and a large tent in the middle as a roof on posts.)
const SLAB = 10;
const RESERVED = [
  capsule(3.25, SLAB, 17.5, 3),
  vl(6, SLAB + 3, 21.25),
  vl(18, SLAB + 3, 21.25),
  roundpoly([[6.25, SLAB], [9.25, 4.75], [12.25, SLAB]], [0.6, 0.8, 0.6]),
];
add('reservation', ['reservación', 'reservado', 'mesa reservada', 'booking', 'reservation', 'reserved table'], RESERVED);
add('reservation-check', ['reservación confirmada', 'mesa asignada', 'llegó', 'confirmed booking', 'seated', 'checked in'], RESERVED, { badge: badge('check') });
add('reservation-clock', ['hora de la reservación', 'próxima reservación', 'retraso', 'booking time', 'upcoming', 'running late'], RESERVED, { badge: badge('clock') });
add('reservation-plus', ['nueva reservación', 'reservar mesa', 'agregar reservación', 'new booking', 'book a table', 'add reservation'], RESERVED, { badge: badge('plus') });
{
  // Walk-in: the walking figure (lugares') stepping into a door frame from the left; the frame's
  // jamb passes behind the figure.
  const W = lugares.icons.walking.d.map((d) => move(d, -2.5, 0));
  const frame = rline([[10.5, 21.25], [10.5, 2.75], [20.75, 2.75], [20.75, 21.25]], [0, 2.5, 2.5, 0]);
  add('walk-in', ['sin reservación', 'cliente sin cita', 'llegar sin reservar', 'walk-in', 'no reservation', 'walk-ins welcome'], [behind(frame, [W[0]], 3, 2, W.slice(1)), ...W]);
}

// ── Floor plan ────────────────────────────────────────────────────────────────────────────────
// Seen from above: the table is a rounded square of 6.5, a chair a capsule of 5 × 3 set 3 from the
// table's edge; the round table is a circle of the same size and its chairs the same capsule bent
// around it.
const T = 6.5;
const table = (cx, cy, w = T, h = T) => sq(cx - w / 2, cy - h / 2, w, h, 1.75);
const chairH = (cx, cy) => capsule(cx - 2.5, cy - 1.5, 5, 3);
const chairV = (cx, cy) => capsule(cx - 1.5, cy - 2.5, 3, 5);
/** A chair bent around a round table: the capsule along an arc of radius R from a0 to a1. */
function chairArc(c, R, a0, a1, h = 1.5) {
  const o0 = polar(...c, R + h, a0);
  const o1 = polar(...c, R + h, a1);
  const i1 = polar(...c, R - h, a1);
  const i0 = polar(...c, R - h, a0);
  return `M${P(o0)}A${f(R + h)} ${f(R + h)} 0 0 1 ${P(o1)}A${h} ${h} 0 0 1 ${P(i1)}A${f(R - h)} ${f(R - h)} 0 0 0 ${P(i0)}A${h} ${h} 0 0 1 ${P(o0)}Z`;
}
const GAP = 3;
const SEATS4 = [table(12, 12), chairH(12, 4.25), chairV(19.75, 12), chairH(12, 19.75), chairV(4.25, 12)];
add('seating-two', ['mesa para dos', 'mesa de dos', 'plano del salón', 'two-top', 'table for two', 'floor plan'], [table(12, 12), chairH(12, 4.25), chairH(12, 19.75)]);
add('seating-four', ['mesa para cuatro', 'mesa de cuatro', 'plano del salón', 'four-top', 'table for four', 'floor plan'], SEATS4);
add('seating-four-check', ['mesa disponible', 'mesa lista', 'lista para sentar', 'table available', 'table ready', 'ready to seat'], SEATS4, { badge: badge('check') });
add('seating-four-clock', ['tiempo de mesa', 'rotación de mesa', 'límite de tiempo', 'turn time', 'table time limit', 'seating time'], SEATS4, { badge: badge('clock') });
{
  // Round table for a large party: the table (r 3.25) ringed by six bent chairs.
  const R = 3.25 + GAP + 1.5;
  add('seating-round', ['mesa redonda', 'banquete', 'grupo grande', 'round table', 'banquet', 'large party'], [
    circ(12, 12, 3.25),
    ...[0, 60, 120, 180, 240, 300].map((a) => chairArc([12, 12], R, a - 90 - 7.25, a - 90 + 7.25)),
  ]);
}
{
  // Booth, in profile: the two benches' high, thick backs and their seats facing each other across
  // the table. (From above, two long benches beside a table read as a pause sign: there is no room
  // for a back and a seat side by side.)
  const bench = roundpoly([[2.75, 4.25], [6, 4.25], [6, 13.5], [8.75, 13.5], [8.75, 20.25], [2.75, 20.25]], [1.5, 1.5, 0.75, 0.75, 0.75, 0.75]);
  add('seating-booth', ['gabinete', 'booth', 'reservado', 'asientos', 'booth seating', 'banquette', 'diner'], [
    bench,
    flipPath(bench),
    capsule(9, 9.5, 6, 2.25),
    vl(12, 11.75, 20.25),
  ]);
}
// Counter: the long bar seen from above and three round stools in a row in front of it.
add('seating-counter', ['barra', 'asientos en barra', 'mostrador del chef', 'counter seating', 'bar seats', "chef's counter"], [
  sq(2.75, 5.75, 18.5, 5.5, 1.75),
  ...[5.25, 12, 18.75].map((x) => circ(x, 16.25, 1.85)),
]);
{
  // Floor plan: the room (the signature's corner) open at its door, with a round table and a square
  // one. (Their chairs don't fit: at this size they shrink to dots and the plan reads as dice.)
  const walls = clip(box(2.75, 2.75, 18.5, 18.5, 4), (p) => !(p[1] > 21 && p[0] > 6.75 && p[0] < 13.25));
  add('seating-plan', ['plano del salón', 'mapa de mesas', 'distribución', 'anfitrión', 'floor plan', 'table map', 'host stand'], [
    walls,
    circ(8.5, 8.5, 2.75),
    sq(12.75, 12.25, 5.5, 5.5, 1.5),
  ]);
}
{
  // Transfer: two tables side by side and an arc arrow jumping from the left one to the right one.
  const a = arc(12, 12.75, 7, 210, 330);
  add('seating-transfer', ['cambiar de mesa', 'transferir mesa', 'mover grupo', 'move table', 'transfer table', 'reseat'], [
    table(6, 16),
    table(18, 16),
    a.d,
    head(a.end, a.tangent, 3.4),
  ]);
}
{
  // Merge: two tables pushed together (their seam shows), and an arrow from each side pointing at it.
  const y = 18;
  add('seating-merge', ['juntar mesas', 'unir mesas', 'grupo grande', 'combine tables', 'merge tables', 'join tables'], [
    table(9, 8.5, 6, 6),
    table(15, 8.5, 6, 6),
    hl(3, 9, y),
    head([9, y], [1, 0], 3.4),
    hl(21, 15, y),
    head([15, y], [-1, 0], 3.4),
  ]);
}

// ── Tables in profile ─────────────────────────────────────────────────────────────────────────
{
  // Bistro: a small round table on its pedestal between two bentwood chairs facing it; the chairs'
  // front legs stand 3 from the table's foot.
  const chair = [smooth([[5.25, 6.5], [3.75, 9.5], [3.5, 13.25], [3, 21.25]]), rline([[3.5, 14.25], [7.25, 14.25], [7.5, 21.25]], [0, 0.75, 0])];
  add('bistro-table', ['mesa de café', 'mesa bistró', 'mesa para dos', 'terraza', 'bistro table', 'cafe table', 'patio'], [
    hl(9.25, 14.75, 10.75),
    vl(12, 10.75, 21.25),
    hl(10.5, 13.5, 21.25),
    ...chair,
    ...chair.map((d) => flipPath(d)),
  ]);
}
// Picnic table, seen from its end: the top on two legs splayed as an A, and the bar across them
// whose ends carry a bench on each side.
add('picnic-table', ['mesa de picnic', 'al aire libre', 'jardín cervecero', 'food truck', 'picnic table', 'outdoor seating', 'beer garden'], [
  capsule(5.25, 5.25, 13.5, 3),
  line([9.5, 8.25], [5.25, 21.25]),
  line([14.5, 8.25], [18.75, 21.25]),
  hl(2.75, 21.25, 14.75),
]);

// ── Service ───────────────────────────────────────────────────────────────────────────────────
/** The cloche: a dome on its platter, which runs past it on both sides, and a ring handle on top. */
const cloche = (cx, y, R, r = 1.5, ext = 1.5) => [arc(cx, y, R, 180, 360).d, hl(cx - R - ext, cx + R + ext, y), circ(cx, y - R - r, r)];
const CLOCHE = cloche(12, 17.5, 8);
add('cloche', ['campana de plato', 'platillo', 'alta cocina', 'servir', 'cloche', 'dish', 'fine dining'], CLOCHE);
add('cloche-block', ['agotado', 'no disponible', 'platillo agotado', 'sold out', 'unavailable', "86'd"], CLOCHE, { badge: badge('block') });
add('cloche-clock', ['tiempo de preparación', 'en preparación', 'pedido en cocina', 'prep time', 'being prepared', 'order in kitchen'], CLOCHE, { badge: badge('clock') });
add('cloche-check', ['platillo servido', 'pedido entregado', 'en la mesa', 'served', 'order delivered', 'dish served'], CLOCHE, { badge: badge('check') });
{
  // Waiter: the core person, smaller and to the left, the arm bent at the elbow and the forearm
  // straight up under a tray that carries a small cloche (its handle a dot: a ring that small would
  // close). (A straight arm from the shoulder to the tray read as a torch held up.)
  // Scaled to 0.85, the head keeps the core's 2.45 from the shoulders (closer, they merge at bold)
  const body0 = place(N.person.d[1], 0.85, [12, 20.6], [8.5, 20.6]);
  const head0 = place(N.person.d[0], 0.85, [12, 7.45], [8.5, 20.6 - 7 * 0.85 - 2.45 - 3.7 * 0.85]);
  add('waiter', ['mesero', 'servicio a la mesa', 'asignar mesero', 'personal', 'waiter', 'server', 'table service'], [
    head0,
    body0,
    // The arm leaves the shoulder's outline from its nearest point, a little inside it
    (() => {
      const elbow = [18, 13.5];
      const at = samples(body0).flat().reduce((m, q) => (Math.hypot(q[0] - 13.9, q[1] - 16.6) < Math.hypot(m[0] - 13.9, m[1] - 16.6) ? q : m));
      const u = [at[0] - elbow[0], at[1] - elbow[1]];
      const k = 0.25 / Math.hypot(...u);
      return rline([[at[0] + u[0] * k, at[1] + u[1] * k], elbow, [18, 7.75]], [0, 1.5, 0]);
    })(),
    hl(14.5, 21.5, 7.75),
    arc(18, 7.75, 3, 180, 360).d,
    dot(18, 4),
  ]);
}
{
  // Serve: comercio's open hand (its cuff and its palm up, as in donation) carrying the cloche on
  // its platter, 3 over the fingers.
  const [, cuff, hand] = comercio.icons.donation.d;
  add('hand-platter', ['servir', 'platillo servido', 'hospitalidad', 'a la mesa', 'serve', 'hospitality', 'food is served'], [
    hand,
    cuff,
    ...cloche(13.25, 10.25, 5.25, 1.25, 1.75),
  ]);
}
// The service bell: a hemisphere on a thick base plate, the plunger and its cap on top.
const SERVICE_BELL = [arc(12, 15.75, 7.25, 180, 360).d, capsule(2.75, 15.75, 18.5, 3), vl(12, 8.5, 5.75), hl(10, 14, 5.75)];
add('service-bell', ['timbre de servicio', 'campana de mostrador', 'orden lista', 'llamar', 'service bell', 'order up', 'desk bell'], SERVICE_BELL);
add('service-bell-ringing', ['llamar al mesero', 'servicio solicitado', 'timbre sonando', 'call waiter', 'service requested', 'ring for service'], [
  ...SERVICE_BELL,
  arc(12, 5.75, 5, 170, 200).d,
  arc(12, 5.75, 8, 170, 200).d,
  arc(12, 5.75, 5, -20, 10).d,
  arc(12, 5.75, 8, -20, 10).d,
]);
// Call button, in profile: a wide flat button on its base and the call going out above it in two
// arcs. (The puck seen from above with a tall round button read as a top hat; with a low one, as a
// doughnut. A dome for the button would be the service bell's.)
add('call-button', ['botón de llamada', 'llamar al personal', 'servicio en mesa', 'call button', 'call staff', 'table service'], [
  capsule(2.75, 16.25, 18.5, 4),
  rline([[7.25, 16.25], [7.25, 12.5], [16.75, 12.5], [16.75, 16.25]], [0, 1.5, 1.5, 0]),
  arc(12, 13.5, 6.25, 232, 308).d,
  arc(12, 13.5, 9.25, 240, 300).d,
]);
// Guest pager: the coaster buzzer, a rounded square with its ring of light, and a vibration arc at
// each side (there is room for one: a second would leave the canvas). (Four lights read as a die.)
add('guest-pager', ['localizador', 'buzzer', 'tu mesa está lista', 'pedido listo', 'guest pager', 'buzzer', 'table ready'], [
  sq(6.75, 6.75, 10.5, 10.5, 3.25),
  circ(12, 12, 2.25),
  arc(12, 12, 8.75, -20, 20).d,
  arc(12, 12, 8.75, 160, 200).d,
]);
// Stanchions: two posts topped with a ball on round bases, the rope sagging between them from just
// under the balls.
add('stanchion', ['fila', 'esperar mesa', 'cordón', 'acceso', 'stanchion', 'queue', 'velvet rope'], [
  ...[5, 19].flatMap((x) => [vl(x, 4.75, 18.75), arc(x, 21, 2.25, 180, 360).d]),
  'M5 7.25C9.5 13.25 14.5 13.25 19 7.25',
  dot(5, 4.75),
  dot(19, 4.75),
]);
// Food and drink: cocina's fork standing beside a cocktail glass (a wine glass beside a fork is
// cocina's food-safe mark).
add('food-and-drink', ['comida y bebida', 'restaurantes y bares', 'comer y beber', 'food and drink', 'restaurants', 'bars'], [
  ...fork3(6.5),
  roundpoly([[12.5, 3.75], [21.5, 3.75], [17, 10]], [0.75, 0.75, 1]),
  vl(17, 9.3, 21.25),
  hl(13.75, 20.25, 21.25),
]);
// Bill presenter: the closed check folder, tall as a booklet (the signature's corner), its spine down
// the left, and the receipt standing out of its top edge, tilted, its torn edge up.
let FOLDER;
{
  const body = box(5.75, 7.25, 12.5, 14, 3);
  const ring = samples(body)[0];
  const torn = Array.from({ length: 7 }, (_, i) => [9.25 + i * 1.25, i % 2 ? 4 : 2.75]);
  const slip = turnPath(line([9.25, 14], ...torn, [16.75, 14]), 10, [13, 12]);
  FOLDER = [body, clip(vl(8.75, 2, 23), (p) => inPoly(ring, p)), clip(slip, (p) => !inPoly(ring, p))];
}
add('bill-presenter', ['pedir la cuenta', 'cuenta', 'portacuentas', 'la cuenta por favor', 'check presenter', 'bill', 'check please'], FOLDER);
add('bill-presenter-check', ['cuenta pagada', 'mesa cerrada', 'pago recibido', 'bill paid', 'check closed', 'paid'], FOLDER, { badge: badge('check') });
{
  // Place setting, from above: the plate between a two-tine fork and a table knife (its spine
  // outside, the blade's edge curving in above the plate). The plate has no well: under a badge a
  // ring that small would be cut into fragments.
  const knife = [`M20.75 10V3.5C19.1 4 18 5.5 18 7.25V7.75C18 9 19 10 20.75 10Z`, vl(20.75, 10, 20)];
  const SETTING = [circ(11.5, 12.25, 4.5), ...fork2(3.75, 3.5, 20), ...knife];
  add('place-setting', ['cubierto', 'comer en el lugar', 'comensal', 'mesa puesta', 'place setting', 'dine in', 'cover'], SETTING);
  add('place-setting-alert', ['alergia', 'aviso de alergia', 'restricción alimentaria', 'allergy', 'allergy alert', 'dietary restriction'], SETTING, { badge: badge('alert') });
  add('place-setting-search', ['buscar restaurante', 'dónde comer', 'lugares para comer', 'find restaurant', 'places to eat', 'search restaurants'], SETTING, { badge: badge('search') });
}

// ── Takeaway ──────────────────────────────────────────────────────────────────────────────────
/**
 * A paper bag open at the top: its edge serrated in `teeth` teeth of depth `a`, the signature's
 * square corner at the bottom right and a continuous one at the bottom left.
 */
function paperBag(x0, x1, top, bottom, teeth, a, r) {
  const body = sq(x0, top + a, x1 - x0, bottom - top - a, r, { square: ['tl', 'tr', 'br'] }).replace(/Z$/, '');
  const w = (x1 - x0) / teeth;
  const pts = [];
  for (let i = 0; i < teeth; i++) pts.push([x0 + w * (i + 0.5), top], [x0 + w * (i + 1), top + a]);
  return `${body}${pts
    .slice(0, -1)
    .map((p) => `L${P(p)}`)
    .join('')}Z`;
}
// The takeout bag: a paper bag (the signature's corner) open at its serrated top, no handles, the
// side gusset folding in down its left edge. Smaller, behind a cup or on a counter, it keeps the
// serrated top and drops the gusset. (Folded over in a band, it read as a jar; with the gussets
// folding in at the bottom, as a pair of shorts.)
const BAG = (() => {
  const bag = paperBag(5.25, 18.75, 2.75, 21.25, 4, 1.5, 3);
  // The gusset's crease runs down until it meets the bottom left corner
  const x = 7.75;
  const yb = Math.max(...samples(bag)[0].filter((q) => Math.abs(q[0] - x) < 0.06 && q[1] > 15).map((q) => q[1]));
  return [bag, line([5.25, 7.25], [x, 9.75], [x, yb])];
})();
add('takeout-bag', ['bolsa para llevar', 'para llevar', 'recoger pedido', 'pedido', 'takeout bag', 'to go', 'pickup order'], BAG);
add('takeout-bag-check', ['pedido listo', 'listo para recoger', 'orden lista', 'order ready', 'ready for pickup', 'pickup ready'], BAG, { badge: badge('check') });
{
  // Takeaway meal: the bag, smaller and behind, and a lidded cup with its straw in front (the bag
  // stops 3 from the cup).
  const bag = paperBag(2.75, 13.75, 6.25, 21.25, 3, 1.25, 2.5);
  const cup = roundpoly([[12.25, 12.5], [20.75, 12.5], [19.5, 21.25], [13.5, 21.25]], [0.4, 0.4, 1.25, 1.25]);
  const lid = capsule(11.5, 9.5, 10, 3);
  const straw = line([16.5, 9.5], [18.75, 2.75]);
  add('takeout-meal', ['comida para llevar', 'combo para llevar', 'bolsa y bebida', 'takeaway meal', 'meal to go', 'combo'], [
    behind(bag, [cup, lid], 3, 2, [straw]),
    cup,
    lid,
    straw,
  ]);
}
// Takeout box: the folded noodle pail, a carton wider at the top, its flaps folded into a ridge and
// the wire handle arching from its corners over them (3 clear of the ridge).
add('takeout-box', ['caja para llevar', 'comida china', 'fideos para llevar', 'takeout box', 'noodle box', 'to go'], [
  roundpoly([[4.5, 10.25], [19.5, 10.25], [17, 21.25], [7, 21.25]], [0.75, 0.75, 1.5, 1.5]),
  rline([[4.5, 10.25], [8.5, 7.5], [15.5, 7.5], [19.5, 10.25]], [0, 0.75, 0.75, 0]),
  arc(12, 10.25, 7.5, 180, 360).d,
]);
{
  // Clamshell: the tray from the front and its lid, the same shape shallower and upside down, tilted
  // open about the hinge at the tray's right corner.
  const tray = roundpoly([[3, 13], [21, 13], [18.75, 19.75], [5.25, 19.75]], [0.6, 0.6, 1.5, 1.5]);
  const lid = turnPath(roundpoly([[3, 13], [21, 13], [19.5, 9.5], [4.5, 9.5]], [0.6, 0.6, 1.25, 1.25]), 20, [21, 13]);
  add('clamshell-box', ['contenedor para llevar', 'sobras', 'caja de unicel', 'doggy bag', 'to-go container', 'leftovers', 'clamshell'], fit([tray, lid]));
}
// Meal tray: the cafeteria tray in profile carrying a bowl and a cup. (From above, a tray with a
// plate and a cup read as a speaker: there is no room for the cup's handle.)
add('meal-tray', ['charola', 'menú del día', 'comedor', 'cafetería', 'meal tray', 'set meal', 'canteen'], [
  roundpoly([[2.75, 17], [21.25, 17], [19.75, 19.75], [4.25, 19.75]], [0.6, 0.6, 1, 1]),
  `M4.5 13H12.5A4 4 0 0 1 4.5 13Z`,
  roundpoly([[15.25, 10], [20.25, 10], [19.5, 17], [16, 17]], [0.4, 0.4, 0.6, 0.6]),
]);
// Pickup counter: the counter from the front (its top and its front panel), a takeout bag standing
// on it beside a small service bell.
add('pickup-counter', ['mostrador de recolección', 'recoger en mostrador', 'pickup', 'entrega', 'pickup counter', 'collect order', 'counter'], [
  sq(2.75, 14.25, 18.5, 7, 1.5, BR),
  hl(2.75, 21.25, 17.25),
  paperBag(4.25, 10.25, 5.25, 14.25, 2, 1.25, 1.5),
  arc(16.5, 14.25, 3.25, 180, 360).d,
  vl(16.5, 11, 8),
  hl(15.5, 17.5, 8),
]);

// ── Street food and venues ────────────────────────────────────────────────────────────────────
{
  // Food truck: the van in profile (its cab's windshield sloping down to the hood), the serving
  // window in its side with the counter running out under it, and two wheels.
  const van = roundpoly([[2.75, 4.75], [15, 4.75], [18.25, 10], [21.25, 10.75], [21.25, 17.5], [2.75, 17.5]], [2, 1, 1, 1.5, 1.5, 2]);
  const wheels = [circ(7, 17.75, 2.25), circ(17, 17.75, 2.25)];
  KEEP['food-truck'] = van;
  add('food-truck', ['food truck', 'comida callejera', 'camión de comida', 'antojitos', 'food truck', 'street food', 'mobile kitchen'], [
    behind(van, wheels),
    rline([[6.75, 12.75], [6.75, 7.75], [13.25, 7.75], [13.25, 12.75]], [0, 1, 1, 0]),
    hl(5.75, 15.25, 12.75),
    ...wheels,
  ]);
}
{
  // Food cart: a box on its big wheel (in front of it; the box's top and its right side stay clear of
  // it), a handle bar, a leg down from the box's square corner, and the parasol over it.
  const wheel = circ(8.5, 17.5, 3.5);
  KEEP['food-cart'] = box(2.75, 10.5, 13, 6, 1.75);
  add('food-cart', ['carrito de comida', 'puesto ambulante', 'hot dogs', 'tacos', 'food cart', 'street vendor', 'pushcart'], [
    behind(KEEP['food-cart'], [wheel]),
    wheel,
    line([15.75, 12.25], [21.25, 9.75]),
    vl(15.75, 16.5, 21.25),
    `M2.75 7.25A6.5 4.25 0 0 1 15.75 7.25Z`,
    vl(9.25, 7.25, 10.5),
  ]);
}
// Buffet: the long serving table (the reserved table's slab and legs) with two covered dishes on it,
// the cloche's dome with a dot for its handle. (The chafing dish from its end, lid half open over a
// flame, read as a kettle grill.)
add('buffet', ['buffet', 'catering', 'bufé', 'mesa de servicio', 'buffet', 'catering', 'serving table'], [
  capsule(2.25, 14.25, 19.5, 3),
  vl(5, 17.25, 21.25),
  vl(19, 17.25, 21.25),
  arc(7.25, 14.25, 3.75, 180, 360).d,
  arc(16.75, 14.25, 3.75, 180, 360).d,
  dot(7.25, 9.25),
  dot(16.75, 9.25),
]);
// Order kiosk: a tall body (the signature's corner) on a short foot, its screen filling the top and
// the card slot in the panel under it. (A square screen on two legs read as a chair.)
add('order-kiosk', ['kiosco', 'autoservicio', 'pedir en pantalla', 'comida rápida', 'order kiosk', 'self-order', 'self-service'], [
  box(6, 2.75, 12, 15.5, 3),
  hl(6, 18, 12.25),
  hl(10.5, 13.5, 15.25),
  vl(12, 18.25, 21.25),
  hl(8.5, 15.5, 21.25),
]);
{
  // Pastry case: the counter (square on top, where the glass stands on it) under its curved glass, a
  // shelf across it, and round pastries (dots) sitting on the shelf and on the counter.
  const shelf = 10.5;
  const gx = 12 - 9.25 * Math.sqrt(1 - ((15.75 - shelf) / 11) ** 2);
  add('pastry-case', ['vitrina', 'panadería', 'pastelería', 'cafetería', 'pastry case', 'bakery', 'display case'], [
    sq(2.75, 15.75, 18.5, 4.75, 1.75, { square: ['tl', 'tr', 'br'] }),
    `M2.75 15.75A9.25 11 0 0 1 12 4.75H18.25A3 3 0 0 1 21.25 7.75V15.75`,
    hl(gx, 21.25, shelf),
    dot(12, shelf - 1.25),
    dot(17, shelf - 1.25),
    dot(10.5, 14.5),
    dot(15.5, 14.5),
  ]);
}

// ── The kitchen's pass ────────────────────────────────────────────────────────────────────────
// The serving hatch: an opening in the wall over a ledge that runs past it. Open, its shutter is rolled up at the
// top and a service bell waits on the ledge; closed, the shutter comes down to the ledge in slats.
const HATCH = [rline([[4.25, 17.75], [4.25, 3.25], [19.75, 3.25], [19.75, 17.75]], [0, 3, 3, 0]), hl(2.75, 21.25, 17.75), hl(4.25, 19.75, 6.25)];
add('kitchen-open', ['cocina abierta', 'recibiendo pedidos', 'abierto', 'servicio', 'kitchen open', 'taking orders', 'open'], [
  ...HATCH,
  arc(12, 17.75, 4, 180, 360).d,
  vl(12, 13.75, 10.75),
  hl(10.75, 13.25, 10.75),
]);
add('kitchen-closed', ['cocina cerrada', 'sin pedidos', 'cerrado', 'pausa', 'kitchen closed', 'not taking orders', 'closed'], [...HATCH, hl(4.25, 19.75, 10.25), hl(4.25, 19.75, 14.25)]);
// Kitchen display: a wide screen (the signature's corner) on a short mount, three order cards of
// different lengths in columns.
add('kitchen-display', ['pantalla de cocina', 'KDS', 'comandas', 'pedidos en cocina', 'kitchen display', 'order screen', 'kds'], [
  box(2.25, 4.25, 19.5, 11.5, 2.5),
  ...[
    [5.25, 5.5],
    [10.75, 3.75],
    [16.25, 4.75],
  ].map(([x, h]) => sq(x, 7.25, 2.5, h, 0.75)),
  vl(12, 15.75, 19.75),
  hl(9.5, 14.5, 19.75),
]);
// Order rail: the ticket rail and three order slips of different lengths hanging from it, each torn
// off its printer in two teeth. (With round ends they read as datos' kanban columns.)
{
  const W = 3.83;
  const slip = (x, b) => line([x, 4.25], [x, b], [x + W / 4, b - 1.25], [x + W / 2, b], [x + (3 * W) / 4, b - 1.25], [x + W, b], [x + W, 4.25]);
  add('order-rail', ['comandas', 'riel de pedidos', 'pedidos en curso', 'cocina', 'order rail', 'ticket rail', 'orders in progress'], [
    hl(2.75, 21.25, 4.25),
    slip(3.25, 19.25),
    slip(10.08, 14.5),
    slip(16.92, 17),
  ]);
}

// ── Portions and price ────────────────────────────────────────────────────────────────────────
/** A bowl in profile: its rim and a deep half ellipse under it (deep enough to keep its paper at bold). */
const bowl = (cx, rim, rx, ry) => `M${f(cx - rx)} ${f(rim)}H${f(cx + rx)}A${f(rx)} ${f(ry)} 0 0 1 ${f(cx - rx)} ${f(rim)}Z`;
// Portion size: three bowls growing from the bottom left to the top right, each 3 clear of the next
// (in a row on one line they don't fit the canvas at a size that reads); levels light up the sizes.
add('portion-size', ['tamaño de porción', 'chico mediano grande', 'porción', 'tamaño', 'portion size', 'small medium large', 'serving size'], [
  bowl(5.5, 16.5, 2.75, 3),
  bowl(11, 10.75, 3.5, 3.75),
  bowl(17, 4.25, 4.25, 4.5),
]);
{
  // Half portion: cocina's bowl in profile (deeper, on its foot), the food in it up to half its
  // depth, as bebidas' glass-half. (A plate from above with food on its left half read as the
  // half-moon of a contrast or dark-mode toggle.)
  const [rim, rx, ry] = [5.25, 9.25, 10];
  const fy = rim + ry * Math.sqrt(1 - (3.5 / rx) ** 2);
  const lv = rim + ry / 2;
  const hx = rx * Math.sqrt(1 - ((lv - rim) / ry) ** 2);
  add('half-portion', ['media porción', 'media orden', 'mitad', 'porción', 'half portion', 'half order', 'half'], fit([
    `M2.75 ${f(rim)}H21.25A${f(rx)} ${f(ry)} 0 0 1 2.75 ${f(rim)}Z`,
    `M8.5 ${f(fy)}L8.25 ${f(fy + 3)}H15.75L15.5 ${f(fy)}`,
    hl(12 - hx, 12 + hx, lv),
  ]));
}
{
  // Sharing plate: two forks reaching down into the same dish, cocina's plate in profile (the
  // family over the plate), their tines 3 over it and 3.4 apart. (From above, two forks crossing a
  // plate's rim from opposite sides read as a euro sign.)
  const forkDown = (tip, deg, L = 12) => [`M-1.5 0V-3a1.5 1.5 0 0 1 3 0V0`, `M0 -4.5V${-L}`].map((d) => turnPath(move(d, ...tip), deg, tip));
  const left = forkDown([9, 14.25], -30);
  add('sharing-plate', ['para compartir', 'al centro', 'estilo familiar', 'platos para compartir', 'sharing plate', 'family style', 'to share'], [
    PLATE_SIDE,
    ...left,
    ...left.map((d) => flipPath(d)),
  ]);
}
{
  // Price level: three coins in a row, each one in front of the next (the one behind stops 3 from
  // it), a dot at each center; levels light up how many.
  const C = [5.4, 12, 18.6].map((x) => circ(x, 12, 3.6));
  add('price-level', ['nivel de precio', 'rango de precios', 'barato', 'caro', 'price level', 'price range', 'pricey'], [
    C[0],
    behind(C[1], [C[0]]),
    behind(C[2], [C[1]]),
    dot(5.4, 12),
    dot(12, 12),
    dot(18.6, 12),
  ]);
}

// ── Over the plate ────────────────────────────────────────────────────────────────────────────
// cocina's plate in profile with what the dish is above it: a flame for its calories, steam for a
// hot dish, a snowflake for a cold one, an infinity for endless servings, a leaf for a vegan one.
/** The set's flame (lugares'): a round base rising to a tilted tip, the logomark's drop inside. */
function setFlame(c, r, tip) {
  const L0 = polar(...c, r, 195);
  const R0 = polar(...c, r, -15);
  const tl = [Math.sin(rad(15)), -Math.cos(rad(15))];
  const tr = [Math.sin(rad(15)), Math.cos(rad(15))];
  const k = r * 0.62;
  const out = `M${P(L0)}C${P([L0[0] + tl[0] * k, L0[1] + tl[1] * k])} ${P([tip[0] - r * 0.42, tip[1] + r * 0.62])} ${P(tip)}C${P([tip[0] + r * 0.2, tip[1] + r * 0.5])} ${P([R0[0] - tr[0] * k, R0[1] - tr[1] * k])} ${P(R0)}A${f(r)} ${f(r)} 0 1 1 ${P(L0)}Z`;
  const ri = r * 0.36;
  const ic = [c[0], c[1] + r - ri - 2.4];
  const drop = `M${P(polar(...ic, ri, -45))}A${f(ri)} ${f(ri)} 0 1 1 ${P(polar(...ic, ri, -135))}L${P([ic[0], ic[1] - ri * Math.SQRT2])}Z`;
  return [out, drop];
}
add('calories', ['calorías', 'kcal', 'energía', 'información nutricional', 'calories', 'kcal', 'energy'], [PLATE_SIDE, ...setFlame([12, 10.75], 4.25, [12.79, 3.5])]);
add('served-hot', ['servido caliente', 'platillo caliente', 'caliente', 'recién hecho', 'served hot', 'hot dish', 'warm'], [PLATE_SIDE, ...[7.5, 12, 16.5].map((x) => wisp(x, 15.25, 4.25, 1.5))]);
{
  // The snowflake: three arms crossing at its center, a pair of branches opening outward on each
  // arm's ends. (lugares' hollow center, scaled to fit over the plate, closed up into a blot.)
  const c = [12, 9];
  add('served-cold', ['servido frío', 'platillo frío', 'frío', 'refrigerado', 'served cold', 'cold dish', 'chilled'], [
    PLATE_SIDE,
    ...[-90, -30, 30].map((a) => line(polar(...c, 6.25, a), polar(...c, 6.25, a + 180))),
    ...[-90, -30, 30, 90, 150, 210].map((a) => head(polar(...c, 4, a), [-Math.cos(rad(a)), -Math.sin(rad(a))], 2, 45)),
  ]);
}
add('all-you-can-eat', ['todo lo que puedas comer', 'barra libre', 'ilimitado', 'buffet libre', 'all you can eat', 'unlimited', 'bottomless'], [
  PLATE_SIDE,
  place(datos.icons.infinity.d[0], 0.9, [12, 16.25], [12, 15.25]),
]);
// The leaf (lugares'), smaller: vegan over the plate, and beside the egg or the fish.
const LEAF = lugares.icons.leaf;
/** lugares' leaf fill (the blade solid, the stem attached, the vein cut) moved as its outline is. */
const leafFill = (map) => Object.fromEntries(Object.entries(LEAF.fill).map(([k, v]) => [k, v.map(map)]));
{
  const map = (d) => place(d, 0.62, [12, 20.75], [12.5, 15.25]);
  add('vegan', ['vegano', 'a base de plantas', 'sin productos animales', 'vegan', 'plant-based', 'plant based'], [PLATE_SIDE, ...LEAF.d.map(map)]);
  KEEP.vegan = leafFill(map);
}

// ── Spicy ─────────────────────────────────────────────────────────────────────────────────────
/** A chili pepper standing, its body curving to a tip that curls right and its stem curling over, drawn at scale `s` with the stem's foot at `at`. */
const chili = (s, at) => ['M-2 2C-2.25 7 -0.75 11.25 2.75 13.75C1.75 10 2 6.5 2 2A2 2 0 0 0 -2 2Z', 'M0 0C0 -1.75 1 -2.75 2.5 -2.75'].map((d) => transform(d, s, at[0], at[1]));
// Spicy: the chili, large, with a wisp of heat rising on each side of it. (Leaning, with the heat
// over it, it read as a carrot.)
add('spicy', ['picante', 'platillo picante', 'enchilado', 'chile', 'spicy', 'hot', 'chili'], [...chili(1.1, [11.25, 6]), wisp(5.25, 14, 6.5, 1), wisp(17.75, 14, 6.5, 1)]);
// Spice level: three small chilies in a row; levels light up how many.
add('spice-level', ['nivel de picante', 'poco picante', 'muy picante', 'escala de picor', 'spice level', 'mild', 'extra hot'], [-6.5, 0, 6.5].flatMap((dx) => chili(0.85, [11.5 + dx, 6.25])));

// ── Dietary labels ────────────────────────────────────────────────────────────────────────────
/** The egg: a half circle below and a taller half ellipse above. */
const egg = (cx, cy, r, k = 1.35) => `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 0 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r * k)} 0 0 0 ${f(cx - r)} ${f(cy)}Z`;
/** The leaf at scale `s`, its box centered in `box2`: the paths and the map that put it there. */
function leafAt(s, box2) {
  const scaled = LEAF.d.map((d) => place(d, s, [12, 12]));
  const pts = scaled.flatMap((d) => samples(d).flat());
  const dx = (box2[0] + box2[2]) / 2 - (Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2;
  const dy = (box2[1] + box2[3]) / 2 - (Math.min(...pts.map((q) => q[1])) + Math.max(...pts.map((q) => q[1]))) / 2;
  const map = (d) => move(place(d, s, [12, 12]), dx, dy);
  return { d: LEAF.d.map(map), fill: leafFill(map) };
}
// The leaf at the top left (vegan's size), the egg or lugares' fish (its body and tail; at this size
// its eye would merge with the body at bold) at the bottom right.
const LEAF_TL = leafAt(0.62, [2.75, 2.75, 13.29, 13.29]);
add('vegetarian', ['vegetariano', 'lacto ovo', 'sin carne', 'huevo y hoja', 'vegetarian', 'meat-free', 'lacto-ovo'], [...LEAF_TL.d, egg(16.25, 16.25, 4)]);
add('pescatarian', ['pescetariano', 'plantas y pescado', 'mariscos', 'sin carne roja', 'pescatarian', 'fish and plants', 'seafood'], [
  ...LEAF_TL.d,
  ...fit(lugares.icons.fish.d.slice(0, 2).map((d) => place(d, 0.75, [12, 12])), [7.75, 12.65, 21.25, 21.25]),
]);
// The Indian marks: a square outline with sharp corners, a large dot (vegetarian) or a triangle
// (non-vegetarian) at its center. Outlined, the dot is a ring; filled, it's solid.
add('veg-mark', ['marca vegetariana', 'vegetariano', 'India', 'punto verde', 'veg mark', 'vegetarian symbol', 'green dot'], [sq(3.25, 3.25, 17.5, 17.5, 0), circ(12, 12, 4)]);
add('non-veg-mark', ['marca no vegetariana', 'con carne', 'India', 'non-veg', 'non-veg mark', 'non-vegetarian', 'contains meat'], [sq(3.25, 3.25, 17.5, 17.5, 0), roundpoly([[12, 7.5], [16.75, 15.75], [7.25, 15.75]], 1)]);

// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// By index of `d` (a `~` before the index closes that open stroke, `shut`), or a path of its own:
// `solid` is filled (closed shapes only), `cut` is knocked out at stroke width, `lines` stays a line
// with a clearance of paper and `wire` a line attached to the fill. Where two filled pieces share an
// edge (a card on its stand, a dome on its plate, a bag on the counter), a cut along that edge keeps
// them apart. Where the outline shows a piece cut behind another, its fill takes the whole piece
// (KEEP) and the piece in front stays a line with its clearance (a wheel, a fork, a button).
{
  // Price level: the coins behind are crescents, the coin's own arc and the clearance's arc around
  // the coin in front (3 from it), so the fill keeps the outline's gap.
  const crescent = (c, front, r = 3.6, R = 6.6) => {
    const d = front[0] - c[0];
    const x = (d * d + r * r - R * R) / (2 * d);
    const h = Math.sqrt(r * r - x * x);
    const [p1, p2] = [[c[0] + x, c[1] - h], [c[0] + x, c[1] + h]];
    return `M${P(p1)}A${f(r)} ${f(r)} 0 1 ${d < 0 ? 1 : 0} ${P(p2)}A${f(R)} ${f(R)} 0 0 ${d < 0 ? 0 : 1} ${P(p1)}Z`;
  };
  KEEP['price-level'] = [crescent([12, 12], [5.4, 12]), crescent([18.6, 12], [12, 12])];
}
const FILL = {
  'menu-card': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] },
  'menu-board': { solid: [0, 3], wire: [1, 2], cut: [4, 5, 6, 7, 8, 9] },
  'qr-menu': { solid: [0, '~1'], cut: [2, 3, 4, hl(5, 19, 18.25)] },
  reservation: { solid: [0, 3], wire: [1, 2], cut: [hl(6.25, 12.25, SLAB)] },
  'walk-in': { solid: [1], wire: [0, 2, 3, 4, 5] },
  'seating-two': { solid: [0, 1, 2] },
  'seating-four': { solid: [0, 1, 2, 3, 4] },
  'seating-round': { solid: [0, 1, 2, 3, 4, 5, 6] },
  'seating-booth': { solid: [0, 1, 2], wire: [3] },
  'seating-counter': { solid: [0, 1, 2, 3] },
  'seating-plan': { solid: [1, 2], wire: [0] },
  'seating-transfer': { solid: [0, 1], lines: [2, 3] },
  'seating-merge': { solid: [0, 1], lines: [2, 3, 4, 5], cut: [vl(12, 5.5, 11.5)] },
  'picnic-table': { solid: [0], wire: [1, 2, 3] },
  cloche: { solid: ['~0', 2], wire: [1] },
  waiter: { solid: [0, 1, '~4', 5], wire: [2, 3] },
  'hand-platter': { solid: ['~0', 1, '~2', 4], wire: [3] },
  'service-bell': { solid: ['~0', 1], wire: [2, 3], cut: [hl(4.75, 19.25, 15.75)] },
  'service-bell-ringing': { solid: ['~0', 1], wire: [2, 3], lines: [4, 5, 6, 7], cut: [hl(4.75, 19.25, 15.75)] },
  'call-button': { solid: [0, '~1'], lines: [2, 3], cut: [hl(7.25, 16.75, 16.25)] },
  'guest-pager': { solid: [0], cut: [1], lines: [2, 3] },
  stanchion: { solid: ['~1', '~3', 5, 6], wire: [0, 2, 4] },
  'food-and-drink': { solid: [2], wire: [0, 1, 3, 4] },
  'bill-presenter': { solid: [0], cut: [1], wire: [2] },
  'place-setting': { solid: [0, 3], lines: [1, 2], wire: [4] },
  'takeout-bag': { solid: [0], cut: [1] },
  'takeout-meal': { solid: [1, 2], lines: [0], cut: [hl(10.5, 22.5, 12.5)], wire: [3] },
  'takeout-box': { solid: [0, '~1'], wire: [2], cut: [hl(4.5, 19.5, 10.25)] },
  'clamshell-box': { solid: [0, 1] },
  'meal-tray': { solid: [0, 1, 2], cut: [hl(6.5, 10.5, 17), hl(16, 19.5, 17)] },
  'pickup-counter': { solid: [0, 2, '~3'], cut: [1, hl(4.25, 10.25, 14.25), hl(13.25, 19.75, 14.25)], wire: [4, 5] },
  // The counter isn't cut: under it, the wheels' clearance would cut the body into islands
  'food-truck': { solid: [KEEP['food-truck']], cut: [1], lines: [3, 4] },
  'food-cart': { solid: [KEEP['food-cart'], 4], lines: [1], wire: [2, 3, 5] },
  buffet: { solid: [0, '~3', '~4', 5, 6], wire: [1, 2], cut: [hl(3.5, 11, 14.25), hl(13, 20.5, 14.25)] },
  'order-kiosk': { solid: [0], cut: [1, 2], wire: [3, 4] },
  // The counter is solid and the glass stays clear (filled, the case read as a burger)
  'pastry-case': { solid: [0, 3, 4, 5, 6], wire: [1, 2] },
  'kitchen-open': { solid: ['~0'], wire: [1], cut: [2, 3, 4, 5] },
  'kitchen-closed': { solid: ['~0'], wire: [1], cut: [2, 3, 4] },
  'kitchen-display': { solid: [0], cut: [1, 2, 3], wire: [4, 5] },
  'order-rail': { solid: ['~1', '~2', '~3'], wire: [0], cut: [hl(3.25, 20.75, 4.25)] },
  'portion-size': { solid: [0, 1, 2] },
  'half-portion': { solid: [0, '~1'], cut: [2] },
  'sharing-plate': { solid: [0], lines: [1, 2, 3, 4] },
  'price-level': { solid: [0, ...KEEP['price-level']], cut: [3, 4, 5] },
  calories: { solid: [0, 1], cut: [2] },
  'served-hot': { solid: [0], lines: [1, 2, 3] },
  'served-cold': { solid: [0], lines: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  'all-you-can-eat': { solid: [0], lines: [1] },
  vegan: { solid: [0, ...KEEP.vegan.solid], wire: KEEP.vegan.wire, cut: KEEP.vegan.cut },
  spicy: { solid: [0], wire: [1], lines: [2, 3] },
  'spice-level': { solid: [0, 2, 4], wire: [1, 3, 5] },
  vegetarian: { solid: [...LEAF_TL.fill.solid, 2], wire: LEAF_TL.fill.wire, cut: LEAF_TL.fill.cut },
  pescatarian: { solid: [...LEAF_TL.fill.solid, 2, 3], wire: LEAF_TL.fill.wire, cut: LEAF_TL.fill.cut },
  'veg-mark': { solid: [1], lines: [0] },
  'non-veg-mark': { solid: [1], lines: [0] },
};
// A badge's icon is filled as its base
const BASE = {
  'menu-card': ['menu-card-star', 'menu-card-edit'],
  reservation: ['reservation-check', 'reservation-clock', 'reservation-plus'],
  'seating-four': ['seating-four-check', 'seating-four-clock'],
  cloche: ['cloche-block', 'cloche-clock', 'cloche-check'],
  'bill-presenter': ['bill-presenter-check'],
  'place-setting': ['place-setting-alert', 'place-setting-search'],
  'takeout-bag': ['takeout-bag-check'],
};
for (const [base, kids] of Object.entries(BASE)) for (const kid of kids) FILL[kid] = FILL[base];
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? d[i] : /^~\d+$/.test(i) ? shut(d[Number(i.slice(1))]) : i));
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, pick(v)]));
}
// Only lines: the bistro table and its chairs are strokes, their filled version is the outline
icons['bistro-table'].fill = false;

// ── Named parts (emitted as data-part) ────────────────────────────────────────────────────────
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const PARTS = {
  'menu-card': { card: [0], title: [1], items: range(2, 7) },
  'menu-board': { board: [0], hanger: [1, 2, 3], items: range(4, 9) },
  'qr-menu': { stand: [0], card: [1], code: [2, 3, 4] },
  reservation: { table: [0, 1, 2], card: [3] },
  'walk-in': { door: [0], person: range(1, 5) },
  'seating-two': { table: [0], chairs: [1, 2] },
  'seating-four': { table: [0], chairs: range(1, 4) },
  'seating-round': { table: [0], chairs: range(1, 6) },
  'seating-booth': { benches: [0, 1], table: [2, 3] },
  'seating-counter': { counter: [0], stools: [1, 2, 3] },
  'seating-plan': { room: [0], tables: [1, 2] },
  'seating-transfer': { tables: [0, 1], arrow: [2, 3] },
  'seating-merge': { tables: [0, 1], arrows: range(2, 5) },
  'bistro-table': { table: [0, 1, 2], chairs: range(3, 6) },
  'picnic-table': { table: [0, 1, 2], benches: [3] },
  cloche: { lid: [0, 2], platter: [1] },
  waiter: { person: [0, 1], arm: [2], tray: [3, 4, 5] },
  'hand-platter': { hand: [0, 1], cloche: [2, 3, 4] },
  'service-bell': { bell: [0, 1], plunger: [2, 3] },
  'service-bell-ringing': { bell: [0, 1], plunger: [2, 3], wave: range(4, 7) },
  'call-button': { base: [0], button: [1], wave: [2, 3] },
  'guest-pager': { body: [0], light: [1], wave: [2, 3] },
  stanchion: { posts: [0, 1, 2, 3, 5, 6], rope: [4] },
  'food-and-drink': { fork: [0, 1], glass: [2, 3, 4] },
  'bill-presenter': { folder: [0, 1], receipt: [2] },
  'place-setting': { plate: [0], fork: [1, 2], knife: [3, 4] },
  'takeout-bag': { bag: [0], fold: [1] },
  'takeout-meal': { bag: [0], cup: [1, 2, 3] },
  'takeout-box': { box: [0, 1], handle: [2] },
  'clamshell-box': { tray: [0], lid: [1] },
  'meal-tray': { tray: [0], dishes: [1, 2] },
  'pickup-counter': { counter: [0, 1], bag: [2], bell: [3, 4, 5] },
  'food-truck': { van: [0], window: [1, 2], wheels: [3, 4] },
  'food-cart': { cart: [0, 1, 2, 3], parasol: [4, 5] },
  buffet: { table: [0, 1, 2], dishes: range(3, 6) },
  'order-kiosk': { body: [0, 1], slot: [2], stand: [3, 4] },
  'pastry-case': { case: [0, 1, 2], pastries: range(3, 6) },
  'kitchen-open': { hatch: [0, 1, 2], bell: [3, 4, 5] },
  'kitchen-closed': { hatch: [0, 1, 2], shutter: [3, 4] },
  'kitchen-display': { screen: [0], cards: [1, 2, 3], mount: [4, 5] },
  'order-rail': { rail: [0], slips: [1, 2, 3] },
  'portion-size': { small: [0], medium: [1], large: [2] },
  'half-portion': { bowl: [0, 1], food: [2] },
  'sharing-plate': { plate: [0], forks: range(1, 4) },
  'price-level': { coins: [0, 1, 2], marks: [3, 4, 5] },
  calories: { plate: [0], flame: [1, 2] },
  'served-hot': { plate: [0], steam: [1, 2, 3] },
  'served-cold': { plate: [0], snowflake: range(1, 9) },
  'all-you-can-eat': { plate: [0], infinity: [1] },
  vegan: { plate: [0], leaf: [1, 2] },
  spicy: { chili: [0, 1], heat: [2, 3] },
  'spice-level': { mild: [0, 1], medium: [2, 3], hot: [4, 5] },
  vegetarian: { leaf: [0, 1], egg: [2] },
  pescatarian: { leaf: [0, 1], fish: [2, 3] },
  'veg-mark': { frame: [0], mark: [1] },
  'non-veg-mark': { frame: [0], mark: [1] },
};
for (const [base, kids] of Object.entries(BASE)) for (const kid of kids) PARTS[kid] = PARTS[base];
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// With a badge (as in comercio): the filled enclosure loses the piece on top, at 58 % the sign stops
// reading, and the slash would cross it with no clearance
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };
// Already enclosed: the Indian marks are a square
for (const name of ['veg-mark', 'non-veg-mark']) icons[name].variants = { square: false };

// ── Mirroring: whatever moves or grows toward one side ────────────────────────────────────────
for (const name of ['walk-in', 'seating-transfer', 'portion-size', 'food-truck']) icons[name].mirror = true;

// ── Levels: the sizes, the price and the heat light up from the first ─────────────────────────
icons['portion-size'].levels = [[0], [1], [2]];
icons['price-level'].levels = [
  [0, 3],
  [1, 4],
  [2, 5],
];
icons['spice-level'].levels = [
  [0, 1],
  [2, 3],
  [4, 5],
];

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
const MOTION = {
  'menu-card-star': { effect: 'beat', parts: ['badge'], origin: BC },
  'menu-card-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'reservation-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'seating-four-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'cloche-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'walk-in': { effect: 'slide', parts: ['person'], vector: [2, 0] },
  'seating-transfer': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  cloche: { effect: 'bounce', parts: ['lid'], vector: [0, -1.5] },
  'cloche-check': { effect: 'bounce', parts: ['lid'], vector: [0, -1.5] },
  'hand-platter': { effect: 'bounce', parts: ['cloche'], vector: [0, -1.5] },
  'service-bell': { effect: 'bounce', parts: ['plunger'], vector: [0, 1] },
  'service-bell-ringing': { effect: 'wiggle', origin: [12, 18.75] },
  'call-button': { effect: 'bounce', parts: ['button'], vector: [0, 1] },
  'guest-pager': { effect: 'wiggle', origin: [12, 12] },
  'takeout-bag': { effect: 'bounce', vector: [0, -2] },
  'takeout-box': { effect: 'bounce', vector: [0, -2] },
  'clamshell-box': { effect: 'wiggle', parts: ['lid'], origin: [21, 13] },
  'food-truck': { effect: 'slide', vector: [2, 0] },
  'food-cart': { effect: 'wiggle', origin: [8.5, 21] },
  'order-rail': { effect: 'wiggle', parts: ['slips'], origin: [12, 4.25] },
  calories: { effect: 'beat', parts: ['flame'], origin: [12, 10.75] },
  'served-hot': { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  'served-cold': { effect: 'spin', parts: ['snowflake'], origin: [12, 9] },
  vegan: { effect: 'wiggle', parts: ['leaf'], origin: [7.1, 15.25] },
  spicy: { effect: 'float', parts: ['heat'], vector: [0, -1.5] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── 16 px (DESIGN.md › 16 px): drawings of their own where pixel snapping isn't enough ────────
// The engine snaps each icon to the pixel grid and swaps the standard badges for their pixel
// versions; it neither snaps a `small` nor swaps its badge, so they are snapped here and carry the
// engine's pixel badge. A pixel measures 1.5 canvas units and pixel centers fall at 0.75 + 1.5k:
// g(column, row) is the center of a pixel.
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
const snapAll = (list) => list.map(snapper(list));
const smallOf = (d, fill, kind) => ({ d, fill, ...(kind && { badge: badge(kind, { size: 16 }) }) });
{
  // The menu: its price dots merged with the dishes. One-pixel prices one pixel past each dish.
  const [card] = snapAll([MENU[0]]);
  const rows = [6, 9, 12].flatMap((r) => [pl([5, r], [8, r]), circ(...g(10, r), 0.1)]);
  const d = [card, pl([6, 3], [9, 3]), ...rows];
  const fill = { solid: [card], cut: d.slice(1) };
  icons['menu-card'].small = smallOf(d, fill);
  icons['menu-card-star'].small = smallOf(d, fill, 'star');
  icons['menu-card-edit'].small = smallOf(d, fill, 'edit');
}
{
  // The menu board: its prices run into a bar and its strings blur. The board and its hanger on the
  // grid, one-pixel prices two pixels past each dish.
  const [board, ...hanger] = snapAll(icons['menu-board'].d.slice(0, 4));
  const rows = [8, 10, 12].flatMap((r) => [pl([4, r], [8, r]), circ(...g(11, r), 0.1)]);
  const d = [board, ...hanger, ...rows];
  icons['menu-board'].small = smallOf(d, { solid: [board, hanger[2]], wire: hanger.slice(0, 2), cut: rows });
}
{
  // The call button: its two arcs run together. Two pixel arcs a row apart.
  const [base, button, seam] = snapAll([icons['call-button'].d[0], icons['call-button'].d[1], hl(7.25, 16.75, 16.25)]);
  const waves = [pl([5, 6], [6, 5], [9, 5], [10, 6]), pl([3, 3], [4, 2], [11, 2], [12, 3])];
  icons['call-button'].small = smallOf([base, button, ...waves], { solid: [base, shut(button)], lines: waves, cut: [seam] });
}
{
  // The guest pager: its ring of light clogs. A ring of four pixels with a hole of two.
  const [body, ...waves] = snapAll([icons['guest-pager'].d[0], ...icons['guest-pager'].d.slice(2)]);
  const ring = sq(px(6), px(6), 4.5, 4.5, 1.25);
  icons['guest-pager'].small = smallOf([body, ring, ...waves], { solid: [body], cut: [ring], lines: waves });
}
{
  // The takeout bag: four teeth turn into a dotted line. Three, snapped with the gusset.
  const d = snapAll([paperBag(5.25, 18.75, 2.75, 21.25, 3, 1.5, 3), BAG[1]]);
  icons['takeout-bag'].small = smallOf(d, { solid: [d[0]], cut: [d[1]] });
  icons['takeout-bag-check'].small = smallOf(d, { solid: [d[0]], cut: [d[1]] }, 'check');
}
{
  // Rings of four pixels with a hole of two: the price level's coins (their center dots clog them)
  // and the counter's stools (round, they blur), one pixel apart.
  const ring = (c, r) => sq(px(c), px(r), 4.5, 4.5, 1.25);
  const coins = [1, 6, 11].map((c) => ring(c, 6));
  icons['price-level'].small = smallOf(coins, { solid: coins });
  const [counter] = snapAll([icons['seating-counter'].d[0]]);
  const stools = [1, 6, 11].map((c) => ring(c, 10));
  icons['seating-counter'].small = smallOf([counter, ...stools], { solid: [counter, ...stools] });
}
{
  // The QR menu: its corner squares blur. Each a block of 2 × 2 pixels.
  const q = icons['qr-menu'].d;
  const [stand, card, seam] = snapAll([q[0], q[1], hl(5, 19, 18.25)]);
  const blocks = [
    [5, 4],
    [9, 4],
    [5, 7],
  ].map(([c, r]) => sq(px(c), px(r), 1.5, 1.5, 0));
  icons['qr-menu'].small = smallOf([stand, card, ...blocks], { solid: [stand, shut(card)], cut: [...blocks, seam] });
}
{
  // The kitchen display: its narrow cards read as zeros. Bars two pixels wide hanging from the
  // screen's top, on a neck two pixels wide.
  const [screen] = snapAll([icons['kitchen-display'].d[0]]);
  const bars = [
    [3, 5],
    [7, 3],
    [11, 4],
  ].map(([c, h]) => sq(px(c), px(4), 1.5, 1.5 * (h - 1), 0));
  const mount = [sq(px(7), px(11), 1.5, 1.5, 0), pl([5, 13], [10, 13])];
  icons['kitchen-display'].small = smallOf([screen, ...bars, ...mount], { solid: [screen], cut: bars, wire: mount });
}
{
  // The bill presenter: the receipt's tilted teeth smear. Upright, two teeth on the grid.
  const [folder, spine] = snapAll(icons['bill-presenter'].d.slice(0, 2));
  const slip = pl([7, 4], [7, 2], [8, 1], [9, 2], [10, 1], [10, 4]);
  icons['bill-presenter'].small = smallOf([folder, spine, slip], { solid: [folder], cut: [spine], wire: [slip] });
  icons['bill-presenter-check'].small = smallOf([folder, spine, slip], { solid: [folder], cut: [spine], wire: [slip] }, 'check');
}
{
  // Calories: the drop inside the flame clogs it. The flame alone over the plate.
  const d = snapAll(icons.calories.d.slice(0, 2));
  icons.calories.small = smallOf(d, { solid: d });
}
{
  // The four-top under a badge: the chairs the badge cuts leave hooks; the table keeps the two whole
  for (const [name, kind] of [
    ['seating-four-check', 'check'],
    ['seating-four-clock', 'clock'],
  ]) {
    const d = snapAll([SEATS4[0], SEATS4[1], SEATS4[4]]);
    icons[name].small = smallOf(d, { solid: d }, kind);
  }
  // The round table: six bent chairs turn to a smudge (and six dots read as a sun); the round table
  // with the four-top's four chairs
  const d = snapAll([circ(12, 12, 3.25), ...SEATS4.slice(1)]);
  icons['seating-round'].small = smallOf(d, { solid: d });
}
{
  // The bistro table: the bentwood chairs, straightened; the table centered on its pedestal
  const chairL = [pl([1, 3], [1, 13]), pl([1, 9], [4, 9], [4, 13])];
  const chairR = [pl([13, 3], [13, 13]), pl([13, 9], [10, 9], [10, 13])];
  icons['bistro-table'].small = { d: [pl([5, 6], [9, 6]), pl([7, 6], [7, 13]), pl([6, 13], [8, 13]), ...chairL, ...chairR] };
}
{
  // The waiter: the cloche's dot handle merged with the dome
  const w = icons.waiter.d;
  const d = snapAll(w.slice(0, 5));
  icons.waiter.small = smallOf(d, { solid: [d[0], d[1], shut(d[4])], wire: [d[2], d[3]] });
}
{
  // Over the plate: the steam's sway and the snowflake's branches blur; pixel wisps and a six-armed
  // star.
  const plate = snapAll([PLATE_SIDE])[0];
  const wisp16 = (c) => pl([c, 10], [c, 8], [c + 1, 7], [c + 1, 5], [c, 4]);
  const steam = [4, 7, 10].map(wisp16);
  icons['served-hot'].small = smallOf([plate, ...steam], { solid: [plate], lines: steam });
  const flake = [pl([7, 3], [7, 9]), pl([5, 4], [9, 8]), pl([9, 4], [5, 8])];
  icons['served-cold'].small = smallOf([plate, ...flake], { solid: [plate], lines: flake });
  // The leaf without its vein (at this size the vein fills it)
  const vegan = snapAll([plate, KEEP.vegan.solid[0], KEEP.vegan.wire[0]]);
  icons.vegan.small = smallOf(vegan, { solid: [vegan[0], vegan[1]], wire: [vegan[2]] });
  const leaf = [LEAF_TL.fill.solid[0], LEAF_TL.fill.wire[0]];
  const veg = snapAll([...leaf, icons.vegetarian.d[2]]);
  icons.vegetarian.small = smallOf(veg, { solid: [veg[0], veg[2]], wire: [veg[1]] });
  const pesc = snapAll([...leaf, icons.pescatarian.d[2], icons.pescatarian.d[3]]);
  icons.pescatarian.small = smallOf(pesc, { solid: [pesc[0], pesc[2], pesc[3]], wire: [pesc[1]] });
}
{
  // Spicy: the heat as pixel wisps clear of the chili; the spice level's chilies smaller and further
  // apart, so they don't run together.
  const ch = snapAll(chili(1.1, [11.25, 6]));
  const heat = [pl([2, 10], [2, 8], [3, 7], [3, 5], [2, 4]), pl([13, 10], [13, 8], [12, 7], [12, 5], [13, 4])];
  icons.spicy.small = smallOf([...ch, ...heat], { solid: [ch[0]], wire: [ch[1]], lines: heat });
  const three = snapAll([-6.75, 0, 6.75].flatMap((dx) => chili(0.75, [11.5 + dx, 7])));
  icons['spice-level'].small = smallOf(three, { solid: [three[0], three[2], three[4]], wire: [three[1], three[3], three[5]] });
}

export default { category: 'restaurante', label: 'Restaurantes', icons };
