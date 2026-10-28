// Bebidas (drinks): coffee by kind and how it's brewed, tea, water and hydration, juices and
// smoothies, milk, sodas, wine, beer, cocktails and spirits, ice, and what drinks are carried in.
// Everything is computed with the engine (engine/geometry.mjs) on the rules in DESIGN.md.
//
// One piece per family, reused by its members: the cups build on lugares' `coffee` (which this
// category adopts): a flat rim with corners of 0.75, the signature's square bottom-right corner and
// the D-shaped handle; the glass-* family is one tumbler with its levels and badges; wine, beer and
// cocktail glasses stand on one stem and foot. Containers (cups, glasses, bottles, cans, cartons)
// keep the square bottom-right corner; round-bellied pots and organic things (beans, fruit) don't.
// A piece that passes behind another stops 3 center to center from it (behind(), as cocina and
// rrhh draw it): nothing is trimmed by hand. Badges are the engine's, and the custom ones (a flame,
// a leaf, a bolt, a return arrow) clear their area through it too.
import { arc, badge, circ, dot, f, flipPath, line, polar, rot, roundpoly, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
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
/** Ellipse with semi-axes rx, ry turned `tilt` degrees, as four cubics. */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const Q = (x, y) => {
    const [a, b] = rot([x, y], [0, 0], tilt);
    return [c[0] + a, c[1] + b];
  };
  return `M${P(Q(rx, 0))}C${P(Q(rx, k * ry))} ${P(Q(k * rx, ry))} ${P(Q(0, ry))}C${P(Q(-k * rx, ry))} ${P(Q(-rx, k * ry))} ${P(Q(-rx, 0))}C${P(Q(-rx, -k * ry))} ${P(Q(-k * rx, -ry))} ${P(Q(0, -ry))}C${P(Q(k * rx, -ry))} ${P(Q(rx, -k * ry))} ${P(Q(rx, 0))}Z`;
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
/** Rectangle with plain rounded corners (small pieces: tags, cubes, bands). */
const rrect = (x, y, w, h, r) => roundpoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
/** An ice cube: a rounded square of side s centered at c, turned deg degrees. */
const cube = (c, s, deg = 0, r = 0.9) => turnPath(rrect(c[0] - s / 2, c[1] - s / 2, s, s, r), deg, c);
/** lugares' water drop: the logomark's drop with its square corner pointing up. */
const waterDrop = ([cx, cy], r) => `M${P(polar(cx, cy, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${P(polar(cx, cy, r, -135))}L${P([cx, cy - r * Math.SQRT2])}Z`;

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
 * Each piece that shows comes back as a stroke of its own.
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
 * The fill of a shape drawn behind others: the piece behind() left of `back` closed along the front
 * shapes' outlines pushed out by `gap` (the knockout's own edge), so the filled body keeps the same
 * 1.5 of paper from the front ones that its outline does. `front` is one closed shape or a list.
 */
function hug(piece, front, back, gap = 3) {
  const rings = [front].flat().map((d) => samples(d)[0]);
  const all = rings.flat();
  const backRing = samples(back)[0];
  const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  // The offset of each front shape, kept where it stays `gap` clear of every front and inside the back
  const edge = rings.flatMap((ring) => {
    const n = ring.length - 1;
    const area = ring.slice(0, n).reduce((s, p, i) => s + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0);
    const out = area > 0 ? 1 : -1;
    return ring.slice(0, n).map((p, i) => {
      const [a, b] = [ring[(i - 1 + n) % n], ring[(i + 1) % n]];
      const [tx, ty] = [b[0] - a[0], b[1] - a[1]];
      const l = Math.hypot(tx, ty) || 1;
      return [p[0] + (out * gap * ty) / l, p[1] - (out * gap * tx) / l];
    });
  }).filter((q) => all.every((r) => dist(q, r) >= gap - 0.02) && inPoly(backRing, q));
  const segs = parse(piece)[0].segs;
  const [A, B] = [pt(segs[0], 0), pt(segs.at(-1), 1)];
  // Walk the kept offset from the piece's end back to its start, always to the nearest next point
  const left = new Set(edge.map((_, i) => i));
  const near = (p) => [...left].reduce((k, i) => (k < 0 || dist(edge[i], p) < dist(edge[k], p) ? i : k), -1);
  const path = [];
  let cur = B;
  while (left.size) {
    const k = near(cur);
    if (dist(edge[k], cur) > 0.6 || dist(cur, A) < 0.3) break;
    path.push(edge[k]);
    left.delete(k);
    cur = edge[k];
  }
  // Every ~0.6 along the offset is enough for a smooth edge
  const keep = path.filter((_, i) => i % 6 === 0 || i === path.length - 1);
  return `${piece}${keep.map((q) => `L${P(q)}`).join('')}Z`;
}
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
/** A gentle wave across the outline `d` at height y (a liquid's surface), from wall to wall. */
function wave(d, y, amp = 0.55, humps = 2) {
  const [x0, x1] = [wallX(d, y, -1), wallX(d, y, 1)];
  const n = humps * 4;
  return smooth(Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y - amp * Math.sin((i / n) * humps * Math.PI)]));
}

const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** The badges' center (DESIGN.md › Badges): pivots for the badge motions. */
const BC = [17.25, 17.25];

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
// lugares' coffee cup: a flat rim with corners of 0.75, a large bottom-left corner and the
// signature's square bottom-right one; its handle is a D of radius 1.75 on the right wall; its
// steam rises in wisps 3 above the rim.
const cupBody = (x0, y0, x1, y1, r = 3.5) => roundpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [0.75, 0.75, 0, r]);
/** The cup's handle: a D of width w on the wall at x, from y0 to y1. */
const cupHandle = (x, y0, y1, w = 3.5) => {
  const r = Math.min(w, (y1 - y0) / 2) - 0.01;
  return rline([[x, y0], [x + w, y0], [x + w, y1], [x, y1]], [0, r, r, 0]);
};
/** A wisp of steam rising from yb (lugares' coffee: 4.25 tall at k = 1). */
const wisp = (x, yb, k = 1) =>
  `M${f(x)} ${f(yb)}C${f(x - 0.8)} ${f(yb - 0.75 * k)} ${f(x - 0.8)} ${f(yb - 1.5 * k)} ${f(x)} ${f(yb - 2.15 * k)}S${f(x + 0.8)} ${f(yb - 3.5 * k)} ${f(x)} ${f(yb - 4.25 * k)}`;
/** A saucer in profile: a flat dish at y whose ends turn up. */
const saucer = (y, x0 = 2.75, x1 = 21.25, lift = 2.5) =>
  rline(
    [
      [x0, y - lift],
      [x0 + 1.5, y],
      [x1 - 1.5, y],
      [x1, y - lift],
    ],
    [0, 1.25, 1.25, 0],
  );

// ── Coffee ────────────────────────────────────────────────────────────────────────────────────
// Espresso: the demitasse, low and wide where coffee is a tall mug, its small handle, the saucer
// it stands on and a single wisp.
const ESPRESSO = [cupBody(4.75, 11, 15.25, 17.25, 3), cupHandle(15.25, 12.25, 15.75, 3), saucer(20.25), wisp(10, 8)];
add('espresso', ['espresso', 'café corto', 'expreso', 'espresso', 'short coffee', 'shot'], ESPRESSO);
add('espresso-plus', ['shot extra', 'carga extra', 'personalizar café', 'extra shot', 'add shot', 'customize'], ESPRESSO, { badge: badge('plus') });

/** A heart (latte art): lobes of radius r, a apart from its axis, its point h below them. */
function heart([cx, cy], r = 1.25, a = 1.1, h = 2.75) {
  const tip = [cx, cy + h];
  const ang = (cc, p) => (Math.atan2(p[1] - cc[1], p[0] - cc[0]) * 180) / Math.PI;
  const tang = (cc, side) => ang(cc, tip) + (side * Math.acos(r / Math.hypot(tip[0] - cc[0], tip[1] - cc[1])) * 180) / Math.PI;
  const [cl, cr] = [
    [cx - a, cy],
    [cx + a, cy],
  ];
  const top = [cx, cy - Math.sqrt(r * r - a * a)];
  const [t1, t2] = [tang(cl, 1), tang(cr, -1)];
  const arcTo = (cc, a0, a1) => arc(...cc, r, a0, a1).d.replace(/^M[^A]+/, '');
  return `M${P(tip)}L${P(polar(...cl, r, t1))}${arcTo(cl, t1, ang(cl, top) + 360)}${arcTo(cr, ang(cr, top), t2 + 360)}Z`;
}
// Cappuccino from above: the saucer's ring, the cup inside it with a heart of latte art on its
// surface, and the handle as a short tab running out over the saucer's edge (the saucer passes
// behind it).
const cupTop = (c, R, hy = 1.5, end = 19.75) => {
  const xs = c[0] + Math.sqrt(R ** 2 - hy ** 2);
  return [circ(...c, R), `M${P([xs, c[1] - hy])}H${f(end)}A${f(hy)} ${f(hy)} 0 0 1 ${f(end)} ${f(c[1] + hy)}H${f(xs)}`];
};
{
  const c = [11, 12];
  const [cup, handle] = cupTop(c, 5.5);
  add('cappuccino', ['capuchino', 'latte', 'arte latte', 'cappuccino', 'flat white', 'latte art'], [...behind(circ(...c, 8.5), [shut(handle)]), cup, handle, heart([c[0], c[1] - 0.6])]);
}

// Latte: a tall glass with no handle served on the espresso's saucer, the foam's curve under the
// rim and the coffee's surface below it: three layers, foam, coffee and milk. (Three level lines
// across a straight glass read as a striped can; the saucer is what makes it a coffee.)
{
  const glass = roundpoly([[7, 2.75], [17, 2.75], [16.25, 17.25], [7.75, 17.25]], [0.75, 0.75, 0, 2.5]);
  const y = 6.25;
  const foam = `M${f(wallX(glass, y, -1))} ${f(y)}Q12 ${f(y + 2)} ${f(wallX(glass, y, 1))} ${f(y)}`;
  add('latte', ['latte', 'café con leche', 'latte macchiato', 'latte', 'layered coffee', 'milk coffee'], [glass, foam, wave(glass, 10.75), saucer(20.25, 3.25, 20.75)]);
}

// Iced coffee: a clear tapered cup under a flat lid, a straight straw standing out of the lid and
// two ice cubes inside.
{
  const lid = capsule(3.25, 4.75, 17.5, 3);
  const cup = rline([[3.75, 7.75], [6.25, 21.25], [17.75, 21.25], [20.25, 7.75]], [0, 2, 0, 0]);
  const cubes = [
    [[9.25, 12.25], -12],
    [[14, 16.75], 14],
  ].map(([c, deg]) => cube(c, 3, deg));
  add('iced-coffee', ['café helado', 'cold brew', 'frío', 'iced coffee', 'cold brew', 'iced latte'], [lid, cup, line([13.5, 4.75], [15, 1.75]), ...cubes]);
}

// Frappé: a tapered cup capped by a tall dome lid, a swirl of whipped cream inside the dome and a
// straw rising out of the cream through the dome.
{
  const dome = `M5 11.25A7 7 0 0 1 19 11.25Z`;
  const cup = rline([[5.5, 11.25], [7.25, 21.25], [16.75, 21.25], [18.5, 11.25]], [0, 1.75, 0, 0]);
  const cream = smooth([[8.25, 11.25], [8.4, 9.6], [10, 9.1], [10.9, 7.9], [12.6, 7.6], [13.9, 9.1], [15.5, 9.6], [15.75, 11.25]]);
  add('frappe', ['frappé', 'granizado', 'bebida helada', 'frappe', 'blended drink', 'slush'], [dome, cup, cream, line([13.35, 7.95], [16.25, 2])]);
}

// Takeaway cup: the paper cup tapering down under its stepped lid, with the sleeve's band around
// its middle. The lid's brim is 3 tall (narrower, its inside closes at 2.1); the cup's corner of 2
// and the sleeve's place let the badges' cut interpolate cleanly between the weights.
const TAKEAWAY_LID = roundpoly([[4.75, 8.25], [4.75, 5.25], [6.75, 5.25], [7.25, 2.75], [16.75, 2.75], [17.25, 5.25], [19.25, 5.25], [19.25, 8.25]], [0.6, 0.6, 0.6, 0.75, 0.75, 0.6, 0.6, 0.6]);
const TAKEAWAY_CUP = rline([[5.75, 8.25], [7.5, 21.25], [16.5, 21.25], [18.25, 8.25]], [0, 2, 0, 0]);
const TAKEAWAY = [TAKEAWAY_LID, TAKEAWAY_CUP, across(TAKEAWAY_CUP, 12.25), across(TAKEAWAY_CUP, 16.5)];
add('takeaway-cup', ['café para llevar', 'vaso de papel', 'para llevar', 'takeaway cup', 'coffee to go', 'to go'], TAKEAWAY);
add('takeaway-cup-check', ['pedido listo', 'listo para recoger', 'bebida lista', 'order ready', 'ready for pickup', 'drink ready'], TAKEAWAY, { badge: badge('check') });
add('takeaway-cup-clock', ['ordenar con anticipación', 'hora de recogida', 'programar pedido', 'order ahead', 'pickup time', 'scheduled order'], TAKEAWAY, { badge: badge('clock') });

// Coffee bean: a tilted oval with the S of its crease running from end to end.
const beanAt = (c, rx, ry, tilt) => {
  const Q = (p) => {
    const [a, b] = rot(p, [0, 0], tilt);
    return [c[0] + a, c[1] + b];
  };
  const k = 0.18 * rx;
  return [
    ell(c, rx, ry, tilt),
    smooth([[0, -ry], [k, -ry / 2], [0, 0], [-k, ry / 2], [0, ry]].map(Q)),
  ];
};
add('coffee-bean', ['grano de café', 'origen', 'tueste', 'coffee bean', 'beans', 'roast'], beanAt([12, 12], 6.25, 9, 35));
// Coffee roast: the bean, and a flame as its badge: two tongues over a round base.
{
  const flame = `M18.25 10.75C20.25 12.75 21 15 21 17.75A3.5 3.5 0 0 1 14 17.75C14 15.75 14.5 14.25 15.25 12.75C15.6 14 16.1 14.8 16.75 15.25C17.4 13.75 17.75 12.25 18.25 10.75Z`;
  add('coffee-roast', ['tueste', 'tostador', 'nivel de tueste', 'coffee roast', 'roastery', 'dark roast'], beanAt([10.5, 10.25], 5.25, 7.75, 35), {
    badge: { d: [flame], knock: flame, fill: { solid: [flame] } },
  });
}

// Coffee bag: a stand-up pouch, its sides swelling toward the base, the folded top as a band and
// the round valve below it.
add('coffee-bag', ['bolsa de café', 'café en grano', 'tostador', 'coffee bag', 'whole bean', 'ground coffee'], [
  rrect(5.5, 3.25, 13, 3, 0.75),
  `M6 6.25C5.1 9.75 4.75 13.5 4.75 18.75A2.5 2.5 0 0 0 7.25 21.25H19.25C19.25 13.5 18.9 9.75 18 6.25`,
  circ(12, 11, 1.5),
]);

// Coffee capsule, from the side: the wide end up with its rim lip, the foil lid domed over it and
// the cone narrowing to its rounded end.
add('coffee-capsule', ['cápsula de café', 'monodosis', 'cafetera de cápsulas', 'coffee capsule', 'coffee pod', 'single serve'], [
  `M5.25 7Q12 0.75 18.75 7`,
  rrect(3.25, 7, 17.5, 3, 0.75),
  rline([[5.5, 10], [8.75, 20.75], [15.25, 20.75], [18.5, 10]], [0, 3, 3, 0]),
]);

// French press: the glass carafe under its lid, the plunger's rod rising from the mesh through the
// lid to the knob, and the handle at its side.
add('french-press', ['prensa francesa', 'cafetera de émbolo', 'método', 'french press', 'cafetiere', 'brew'], [
  rline([[4.75, 9.5], [4.75, 21.25], [15.75, 21.25], [15.75, 9.5]], [0, 2.5, 0, 0]),
  rrect(4.25, 6.75, 12, 2.75, 0.75),
  vl(10.25, 3.25, 15.5),
  dot(10.25, 3.25),
  hl(4.75, 15.75, 15.5),
  cupHandle(15.75, 12.5, 19.25, 4),
]);

// Moka pot: the angular pot pinched at the waist, its spout at the top left, the knob on the lid,
// the handle off the upper chamber and the facets of the lower one.
{
  const pot = roundpoly([[3.75, 4.75], [16.75, 4.75], [15.25, 12], [17.5, 20.75], [6.5, 20.75], [8.75, 12], [7.5, 7]], [0.4, 0.75, 0.5, 0, 1.25, 0.5, 0.75]);
  const [y0, y1] = [5.75, 9];
  add('moka-pot', ['cafetera italiana', 'moka', 'greca', 'moka pot', 'stovetop', 'italian coffee'], [
    pot,
    dot(12.25, 3.5),
    rline([[wallX(pot, y0, 1), y0], [20.25, y0], [19.5, y1], [wallX(pot, y1, 1), y1]], [0, 1, 1, 0]),
    across(pot, 12),
    line([10.5, 12], [10, 20.75]),
    line([13.5, 12], [14, 20.75]),
  ]);
}

// Pour-over: the cone dripper over the cup and a drop falling between them. (Two drops side by
// side under the dripper read as a face; stacked, they leave no room for the cup.)
// The drop is lugares' at r 1.25, 3 clear of both: smaller, its hole closes at the heavy weights.
add('pour-over', ['pour over', 'goteo manual', 'filtrado', 'pour over', 'hand drip', 'filter coffee'], [
  roundpoly([[3.25, 3.25], [17.25, 3.25], [13.25, 8.5], [7.25, 8.5]], 0.75),
  waterDrop([10.25, 13.15], 1.25),
  cupBody(4.25, 17.25, 16.25, 21.25, 2.5),
  cupHandle(16.25, 17.75, 20.75, 3),
]);

// Coffee pot: the glass carafe bulging toward its base, the collar band under the rim, the spout
// at the top left and the straight grip on the right.
{
  const pot = `M4.5 3.25H15.5V9C17.75 10.5 18.75 12.75 18.75 15.25C18.75 18.75 17 21 14.5 21H8.5C6 21 4.25 18.75 4.25 15.25C4.25 12.75 5.25 10.5 7.5 9V5.5Z`;
  const [y0, y1] = [7.25, 12.75];
  // The collar and the grip are one piece: the grip leaves the pot along the collar's line
  add('coffee-pot', ['jarra de café', 'cafetera', 'rellenar', 'coffee pot', 'carafe', 'refill'], [pot, hl(7.5, 15.5, y0), rline([[15.5, y0], [20.5, y0], [20.5, y1], [wallX(pot, y1, 1), y1]], [0, 1.25, 1.25, 0])]);
}

// Portafilter: the basket from the side, its two spouts under it and the long handle to the right.
{
  const basket = roundpoly([[2.75, 8], [13.25, 8], [12, 13.5], [4, 13.5]], [0.5, 0.5, 1.5, 1.5]);
  const [y0, y1] = [9.5, 12.5];
  add('portafilter', ['portafiltro', 'barista', 'extracción', 'portafilter', 'espresso shot', 'barista tools'], [
    basket,
    `M${P([wallX(basket, y0, 1), y0])}H19.75A1.5 1.5 0 0 1 19.75 ${f(y1)}H${f(wallX(basket, y1, 1))}`,
    vl(6.5, 13.5, 16.5),
    vl(9.5, 13.5, 16.5),
  ]);
}

// ── Tea ───────────────────────────────────────────────────────────────────────────────────────
// Tea: the cup on its saucer, a tea bag's string hanging from the rim and its square tag dangling
// on the cup's outside. (Drawn over the rim and down the left, the string read as a second handle.)
add('tea', ['té', 'infusión', 'taza de té', 'tea', 'tea time', 'infusion'], [
  cupBody(4.75, 6.5, 15.75, 16.5, 3),
  cupHandle(15.75, 8.25, 13.5, 3.5),
  saucer(19.5),
  vl(10.25, 6.5, 9.75),
  rrect(8.75, 9.75, 3, 2.85, 0.5),
]);

// Teapot: the round belly, the lid's dome and its knob, the spout curving up on the left (one
// stroke: a hollow one has no room 3 wide beside the belly) and the loop handle on the right.
{
  const body = `M7.25 9H16.75C18.5 10.25 19 12.5 19 14.75C19 18 17.75 20.75 15.25 20.75H8.75C6.25 20.75 5 18 5 14.75C5 12.5 5.5 10.25 7.25 9Z`;
  const b = 16.25;
  add('teapot', ['tetera', 'servicio de té', 'té', 'teapot', 'tea service', 'tea shop'], [
    body,
    `M8.75 9A3.25 3.25 0 0 1 15.25 9`,
    dot(12, 4.25),
    `M${P([wallX(body, b, -1), b])}C3.25 15.25 2.75 12.5 2.75 9.5`,
    rline([[wallX(body, 11.25, 1), 11.25], [21.25, 11.25], [21.25, 17.25], [wallX(body, 17.25, 1), 17.25]], [0, 2, 2, 0]),
  ]);
}

// Tea bag: the sachet (the signature's corner) with its folded top, the string rising from it to
// a small tag.
add('tea-bag', ['bolsita de té', 'infusión', 'reposar', 'tea bag', 'steep', 'tea'], [
  roundpoly([[3.75, 9.25], [15.25, 9.25], [15.25, 21.25], [3.75, 21.25]], [3, 3, 0, 3]),
  hl(3.75, 15.25, 12.75),
  `M9.5 9.25C9.5 6 12 4.75 15.25 4.75`,
  rrect(15.25, 2.75, 5, 4, 0.75),
]);

// Tea infuser: the ball with its seam and a row of holes, hanging from a short chain that ends in
// a ring.
add('tea-infuser', ['infusor de té', 'té a granel', 'colador de té', 'tea infuser', 'loose leaf', 'steep'], [
  circ(12, 14.35, 6.75),
  across(circ(12, 14.35, 6.75), 13.75),
  dot(8.75, 16.85, 0.3),
  dot(12, 16.85, 0.3),
  dot(15.25, 16.85, 0.3),
  vl(12, 4.75, 7.6),
  circ(12, 3.25, 1.5),
]);

// Tea leaves: a sprig, two leaves opening on either side of the stem and the closed bud on top.
/** A leaf: a lens from its base A to its tip B, `w` wide at the middle (two arcs). */
function leaf(A, B, w) {
  const c = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const s = w / 2;
  const R = f((s * s + (c * c) / 4) / (2 * s));
  return `M${P(A)}A${R} ${R} 0 0 1 ${P(B)}A${R} ${R} 0 0 1 ${P(A)}Z`;
}
add('tea-leaves', ['hojas de té', 'té verde', 'té a granel', 'tea leaves', 'green tea', 'loose tea'], [
  vl(12, 10.75, 21.25),
  leaf([12, 10.75], [12, 2.75], 4),
  leaf([12, 19], [4, 14.5], 4),
  leaf([12, 15.25], [20, 10.75], 4),
]);

// Matcha: the wide low bowl and the bamboo whisk resting tilted in it: its handle and the cage of
// its tines opening above the rim (the bowl stands in front of them).
{
  const bowl = `M3 13.5H21C21 18 17 20.75 12 20.75S3 18 3 13.5Z`;
  // The whisk, drawn upright and turned: a handle 2.5 wide and the tines spreading from its foot
  const [x, top, foot] = [12, 2.25, 6.5];
  const handle = capsule(x - 1.25, top, 2.5, foot - top);
  const tines = [
    `M${f(x - 1.25)} ${f(foot - 1.25)}C${f(x - 1.25)} ${f(foot + 1.5)} ${f(x - 4.5)} ${f(foot + 2.5)} ${f(x - 4.5)} ${f(foot + 7)}`,
    vl(x, foot, foot + 7),
    `M${f(x + 1.25)} ${f(foot - 1.25)}C${f(x + 1.25)} ${f(foot + 1.5)} ${f(x + 4.5)} ${f(foot + 2.5)} ${f(x + 4.5)} ${f(foot + 7)}`,
  ];
  const whisk = [handle, ...tines].map((d) => turnPath(move(d, 3.75, 0), 14, [x + 3.75, top]));
  add('matcha', ['matcha', 'té verde', 'batidor de bambú', 'matcha', 'green tea', 'whisk'], [bowl, whisk[0], ...whisk.slice(1).flatMap((d) => behind(d, [bowl]))]);
}

// Yerba mate: the gourd's round belly under the metal rim (the virola) that crowns its mouth, the
// small foot it stands on, and the bombilla leaning out of the mouth, bent at the mouthpiece. (A
// round gourd alone, its straw rising like a stalk, read as a fruit; the rim and the foot make it a
// vessel, and set it apart from the coconut.)
{
  // One outline from the rim down the belly and into the foot (drawn apart, the foot met the belly
  // at a tangent and merged with it at the heavy weights)
  const gourd = `M6.75 6.25H15.25L14.25 9.25C16.1 10.2 17 11.9 17 14C17 16.6 15.4 18.5 13.25 19.25L14.25 21.25H7.75L8.75 19.25C6.6 18.5 5 16.6 5 14C5 11.9 5.9 10.2 7.75 9.25Z`;
  add('yerba-mate', ['mate', 'yerba mate', 'bombilla', 'yerba mate', 'mate gourd', 'south american tea'], [gourd, hl(7.75, 14.25, 9.25), rline([[12.75, 6.25], [15.75, 2.5], [18.75, 2.5]], [0, 1, 0])]);
}

// Bubble tea: a tall cup sealed with a flat film, a wide straw piercing it and the pearls
// gathered at the bottom.
add('bubble-tea', ['té de burbujas', 'boba', 'té con leche', 'bubble tea', 'boba tea', 'milk tea'], [
  roundpoly([[4.75, 7.5], [19.25, 7.5], [17.5, 21.25], [6.5, 21.25]], [0.75, 0.75, 0, 2.5]),
  roundpoly([[11.5, 7.5], [14.25, 7.5], [15.75, 2.25], [13, 2.25]], [0, 0, 0.6, 0.6]),
  dot(9.75, 17.5),
  dot(14.25, 17.5),
  dot(12, 13.25),
]);

// Iced tea: a tall glass with two ice cubes and a lemon wheel hooked on its rim (the glass passes
// behind the wheel), no straw.
{
  const glass = roundpoly([[3.75, 6], [17.75, 6], [17, 21.25], [4.5, 21.25]], [0.75, 0.75, 0, 2.5]);
  const wc = [17.75, 6];
  const wheel = circ(...wc, 3.5);
  const [piece] = behind(glass, [wheel]);
  const spokes = [90, 210, 330].map((a) => line(wc, polar(...wc, 3.5, a)));
  const cubes = [cube([8.75, 12.25], 3, -12), cube([12.75, 16.75], 3, 12)];
  // Filled, the glass keeps its paper around the wheel; the spokes and the ice are knocked out
  add('iced-tea', ['té helado', 'té frío', 'limón', 'iced tea', 'cold tea', 'lemon'], [piece, wheel, ...spokes, ...cubes], {
    fill: { solid: [hug(piece, wheel, glass), wheel], cut: [...spokes, ...cubes] },
  });
}

// ── Water ─────────────────────────────────────────────────────────────────────────────────────
// The glass: one slightly tapered tumbler (the signature's corner) with the water's surface as a
// gentle wave; its levels and badges are all this one.
const GLASS = roundpoly([[5.25, 3.25], [18.75, 3.25], [17.25, 20.75], [6.75, 20.75]], [0.75, 0.75, 0, 3]);
const WATER = [GLASS, wave(GLASS, 7.5)];
add('glass', ['vaso de agua', 'agua', 'hidratación', 'glass of water', 'water', 'drink'], WATER);
add('glass-half', ['medio vaso', 'progreso de hidratación', 'a la mitad', 'half glass', 'hydration progress', 'halfway'], [GLASS, wave(GLASS, 12.75)]);
add('glass-empty', ['vaso vacío', 'rellenar', 'sin registro', 'empty glass', 'refill', 'finished'], [GLASS, waterDrop([12, 16.25], 1.25)]);
add('glass-plus', ['registrar agua', 'agregar vaso', 'consumo diario', 'log water', 'add a glass', 'intake'], WATER, { badge: badge('plus') });
add('glass-clock', ['recordatorio de agua', 'hora de beber', 'horario de hidratación', 'water reminder', 'drink reminder', 'hydration schedule'], WATER, { badge: badge('clock') });
add('glass-check', ['meta de agua', 'objetivo cumplido', 'hidratado', 'water goal', 'goal reached', 'hydrated'], WATER, { badge: badge('check') });
add('glass-sparkling', ['agua mineral', 'agua con gas', 'soda', 'sparkling water', 'seltzer', 'soda water'], [...WATER, dot(14, 11.75), dot(10.25, 14.25), dot(13.5, 17.5)]);

// Water bottle: the reusable bottle, a straight body (the signature's corner) under a cap as wide
// as it, and the wide carrying loop on top.
add('water-bottle', ['botella reutilizable', 'termo de agua', 'deporte', 'water bottle', 'reusable bottle', 'hydration'], [
  roundpoly([[6.75, 8.5], [17.25, 8.5], [17.25, 21.25], [6.75, 21.25]], [1, 1, 0, 3]),
  rrect(6.75, 5.5, 10.5, 3, 1),
  rline([[9, 5.5], [9, 2.5], [15, 2.5], [15, 5.5]], [0, 2, 2, 0]),
]);

// Bottle: a plastic bottle, its screw cap over a short neck, sloped shoulders and the groove at
// its waist.
{
  const body = roundpoly(
    [[10.25, 5.75], [13.75, 5.75], [13.75, 7.25], [17.5, 10.5], [17.5, 13.5], [16.75, 14.75], [17.5, 16], [17.5, 21.25], [6.5, 21.25], [6.5, 16], [7.25, 14.75], [6.5, 13.5], [6.5, 10.5], [10.25, 7.25]],
    [0, 0, 1, 1.5, 0.5, 0.5, 0.5, 0, 2, 0.5, 0.5, 0.5, 1.5, 1],
  );
  add('bottle', ['botella', 'agua embotellada', 'refresco', 'bottle', 'bottled water', 'plastic bottle'], [body, rrect(9.5, 2.75, 5, 3, 0.75), across(body, 14.75)]);
}

// Water jug (garrafón): the big drum with its two ribs and its round shoulders rising to the capped
// neck. (The grip molded into the shoulder had no room 3 clear of the ribs and the shoulder: as a
// slot under the shoulder it read as a label.)
{
  const jug = `M10 5.75H14V6.5C14 7.75 14.75 8.25 16 8.5C18.6 9 20.25 10.5 20.25 13V21.25H6.75A3 3 0 0 1 3.75 18.25V13C3.75 10.5 5.4 9 8 8.5C9.25 8.25 10 7.75 10 6.5Z`;
  add('water-jug', ['garrafón', 'agua a domicilio', 'botellón', 'water jug', 'water delivery', '5 gallon'], [jug, rrect(9.25, 2.75, 5.5, 3, 0.75), across(jug, 13.75), across(jug, 17.5)]);
}

// Drinking water: a tap, its spout bending down and the cross handle on top, pouring a stream into
// a glass of water below it. (Without its handle the spout read as a bent pipe.)
{
  const tap = roundpoly([[3.25, 5.75], [16.25, 5.75], [16.25, 10.75], [13.25, 10.75], [13.25, 8.75], [3.25, 8.75]], [0.5, 3, 0.5, 0.5, 0.5, 0.5]);
  const glass = roundpoly([[9.5, 13.75], [20, 13.75], [19, 21.25], [10.5, 21.25]], [0.5, 0.5, 0, 2.25]);
  const water = wave(glass, 17);
  add('drinking-water', ['agua potable', 'llave de agua', 'bebedero', 'drinking water', 'potable water', 'tap water'], [
    tap,
    vl(8.25, 2.75, 5.75),
    hl(5.75, 10.75, 2.75),
    vl(14.75, 10.75, 17),
    glass,
    water,
  ]);
}

// Refill station: the station's tall unit (the signature's corner), its spout arm reaching out over
// a bottle that stands under the nozzle at full size. (The bottle in a niche of the unit was too
// small to read, and the niche open to the floor made the unit an arch.)
add('refill-station', ['estación de recarga', 'rellenar botella', 'bebedero', 'refill station', 'bottle refill', 'water point'], [
  roundpoly([[3.25, 2.75], [8.25, 2.75], [8.25, 21.25], [3.25, 21.25]], [2, 2, 0, 2]),
  rline([[8.25, 4.25], [16.75, 4.25], [16.75, 8.75], [13.75, 8.75], [13.75, 7.25], [8.25, 7.25]], [0, 2.5, 0.5, 0.5, 0.5, 0]),
  roundpoly([[13.75, 11.75], [16.75, 11.75], [16.75, 13.25], [19.25, 15.5], [19.25, 21.25], [11.25, 21.25], [11.25, 15.5], [13.75, 13.25]], [0.5, 0.5, 1, 1.25, 0, 1.75, 1.25, 1]),
]);

// Pitcher: a tall jug flaring a little toward its base, the rim rising into the beak of its spout
// at the left, the loop handle on the right and the drink's surface inside. (With a flat rim and
// only its left wall leaning out it read as a mug.)
{
  const jug = `M16.5 4.75H10.25C8.5 4.75 6.5 4.25 3.75 3.25C5.75 4.75 7 6.25 7 8.25C7 12.5 5.75 15.5 5.75 19A2.25 2.25 0 0 0 8 21.25H17.75C17.75 16.5 16.5 12.5 16.5 8.25Z`;
  add('pitcher', ['jarra', 'limonada', 'agua fresca', 'pitcher', 'jug', 'lemonade'], [
    jug,
    rline([[wallX(jug, 7.25, 1), 7.25], [21.25, 7.25], [21.25, 15.25], [wallX(jug, 15.25, 1), 15.25]], [0, 2.5, 2.5, 0]),
    wave(jug, 11),
  ]);
}

// Milk jug: a small round-bellied jug, its pointed spout at the rim's left and a small handle.
{
  const jug = `M3.25 8.25L15.75 9.25C17.25 10.6 18 12.4 18 14.5C18 18.25 15.1 21 11.25 21S4.5 18.25 4.5 14.5C4.5 12.75 5.1 11.25 6.25 10.25Z`;
  add('milk-jug', ['jarrita de leche', 'cremera', 'jarra para espumar', 'milk jug', 'creamer', 'frothing pitcher'], [jug, rline([[wallX(jug, 11.25, 1), 11.25], [21, 11.25], [21, 15.5], [wallX(jug, 15.5, 1), 15.5]], [0, 1.75, 1.75, 0])]);
}

// Drink dispenser: the big lidded jar (the signature's corner) on its short legs, the drink's
// surface inside and the spigot near its base.
{
  const jar = `M7.5 6.75H13.5C15.5 7.75 16.5 9 16.5 11.5V17.5H7A2.5 2.5 0 0 1 4.5 15V11.5C4.5 9 5.5 7.75 7.5 6.75Z`;
  add('drink-dispenser', ['vitrolero', 'dispensador de bebidas', 'aguas frescas', 'drink dispenser', 'beverage jar', 'self-serve'], [
    jar,
    rrect(6.5, 3.75, 8, 3, 0.75),
    wave(jar, 11),
    rline([[16.5, 13.75], [20.25, 13.75], [20.25, 16.5]], [0, 1.25, 0]),
    line([7.5, 17.5], [6.75, 21.25]),
    line([13.5, 17.5], [14.25, 21.25]),
  ]);
}

// ── Juice, smoothies and milk ─────────────────────────────────────────────────────────────────
/** Where the segment p0 → p1 first meets the outline `d` (to stand a straw on a curve). */
function meet(d, p0, p1) {
  const ring = samples(d).flat();
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const p = [p0[0] + ((p1[0] - p0[0]) * i) / n, p0[1] + ((p1[1] - p0[1]) * i) / n];
    if (ring.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.06)) return p;
  }
  return p1;
}
/** A citrus wheel: the rind's ring and three segments meeting at its center. */
const wheel = (c, r, at = [90, 210, 330]) => [circ(...c, r), ...at.map((a) => line(c, polar(...c, r, a)))];

// Juice: a citrus half served as its own cup, its cut face up: the rind's inner line, the segments
// fanning below the face and a straw stuck in it.
{
  const c = [12, 11.5];
  add('juice', ['jugo', 'jugo de naranja', 'cítricos', 'juice', 'orange juice', 'juice bar'], [
    `M3.25 11.5A8.75 8.75 0 0 0 20.75 11.5Z`,
    arc(...c, 5.75, 0, 180).d,
    ...[45, 90, 135].map((a) => line(c, polar(...c, 5.75, a))),
    line([15, 11.5], [17.5, 2.75]),
  ]);
}

// Juice box: a small upright carton (the signature's corner) with its top seam, and the bent straw
// poking out of its top corner.
add('juice-box', ['jugo de cajita', 'tetrapack', 'lonchera', 'juice box', 'drink carton', 'lunchbox'], [
  roundpoly([[5.75, 7.5], [16.25, 7.5], [16.25, 21.25], [5.75, 21.25]], [0.75, 0.75, 0, 2.5]),
  hl(5.75, 16.25, 10.5),
  rline([[13.25, 7.5], [13.25, 4], [17.75, 2]], [0, 1, 0]),
]);

// Smoothie: a tall cup tapering down, a low thick swirl standing over its rim and a wide straw
// rising out of it to the top. (A tall domed mound with a stub of straw read as a cupcake.)
{
  const cup = roundpoly([[5.75, 10.25], [18.25, 10.25], [16.75, 21.25], [7.25, 21.25]], [0.75, 0.75, 0, 2.5]);
  const mound = smooth([[6.25, 10.25], [6.5, 8.25], [9, 7.5], [11.5, 6.75], [14.5, 7.25], [17.25, 8.25], [17.75, 10.25]]);
  const u = [0.34, -0.94];
  const [a0, b0] = [[9.75, 10.25], [12.5, 10.25]];
  const top = (p) => [p[0] + 9 * u[0], p[1] + 9 * u[1]];
  const [a1, b1] = [meet(mound, top(a0), a0), meet(mound, top(b0), b0)];
  const [ta, tb] = [a1, b1].map((p) => [p[0] + (p[1] - 2.75) * (u[0] / -u[1]), 2.75]);
  add('smoothie', ['licuado', 'smoothie', 'batido de fruta', 'smoothie', 'blended fruit', 'healthy drink'], [cup, mound, `M${P(a1)}L${P(ta)}H${f(tb[0])}L${P(b1)}`]);
}

// Lemonade: a mason jar with its threaded rim and side handle, a lemon wheel inside and a straw
// standing out of the rim.
{
  const jar = roundpoly([[4.5, 6.25], [16.5, 6.25], [16.5, 21.25], [4.5, 21.25]], [0.75, 0.75, 0, 3]);
  add('lemonade', ['limonada', 'agua fresca', 'frasco', 'lemonade', 'mason jar', 'summer drink'], [
    jar,
    hl(4.5, 16.5, 9.25),
    cupHandle(16.5, 12.25, 18.25, 3.75),
    ...wheel([10.5, 15.25], 2.75),
    line([12.25, 6.25], [14.25, 2]),
  ]);
}

// Coconut drink: a whole coconut, the straw's hole cut in its top and a bent straw standing in it.
add('coconut-drink', ['agua de coco', 'coco', 'bebida tropical', 'coconut water', 'coconut', 'tropical drink'], [
  circ(11, 13.5, 7.75),
  ell([11, 10.1], 2.75, 1.5),
  rline([[12.25, 10.1], [12.25, 3.75], [16.25, 2]], [0, 1, 0]),
]);

// Shaker bottle: a tall bottle with measure ticks up one side, its wide screw lid and the flip
// spout on the lid.
add('shaker-bottle', ['shaker', 'proteína', 'batido', 'gimnasio', 'shaker bottle', 'protein shake', 'gym'], [
  roundpoly([[6.25, 8.5], [17.75, 8.5], [17.25, 21.25], [6.75, 21.25]], [0, 0, 0, 2.5]),
  rrect(5.25, 5.5, 13.5, 3, 0.75),
  rline([[8, 5.5], [8, 2.5], [11.5, 2.5], [11.5, 5.5]], [0, 1, 1, 0]),
  hl(6.4, 9.75, 12),
  hl(6.5, 8.75, 15),
  hl(6.6, 9.75, 18),
]);

// Milk: the gable-top carton in three quarters, its front and side, the gable, the folded ridge
// along the top and the crease below the gable.
const CARTON = [
  roundpoly([[4.75, 21.25], [4.75, 9.5], [9, 5.25], [9, 2.25], [15, 2.25], [15, 5.25], [19.25, 9.5], [19.25, 21.25]], [3, 0.5, 0, 0.5, 0.5, 0, 0.5, 0]),
  line([9, 5.25], [15, 5.25]),
  line([9, 5.25], [13.25, 9.5], [13.25, 21.25]),
  hl(4.75, 19.25, 9.5),
];
add('milk', ['leche', 'lácteos', 'cartón de leche', 'milk', 'dairy', 'milk carton'], CARTON);
// Plant milk: the carton with a leaf as its badge.
{
  // The leaf spans the badge's circle on the diagonal and clears that circle (a glyph badge, like the heart)
  const lf = leaf([14.25, 20.25], [20.25, 14.25], 4.5);
  const rib = line([14.25, 20.25], [17.25, 17.25]);
  add('plant-milk', ['leche vegetal', 'leche de avena', 'sin lácteos', 'plant milk', 'oat milk', 'dairy free'], CARTON, {
    badge: { d: [lf, rib], knock: circ(...BC, 4.25), fill: { solid: [lf], cut: [rib] } },
  });
}

// Milkshake: a flared glass on a short foot, the cloud of whipped cream over its rim with a cherry
// on top, and a straw.
{
  const glass = roundpoly([[5, 11], [19, 11], [14.5, 17.75], [9.5, 17.75]], [0.75, 0.75, 1, 1]);
  const cream = smooth([[5.75, 11], [5.5, 8.75], [8, 7.5], [10.25, 6.5], [13.75, 6.5], [16, 7.5], [18.5, 8.75], [18.25, 11]]);
  add('milkshake', ['malteada', 'batido', 'crema batida', 'milkshake', 'shake', 'diner'], [
    glass,
    vl(12, 17.75, 20.75),
    hl(8.5, 15.5, 20.75),
    cream,
    circ(10.5, 5, 1.6),
    line([10.9, 3.45], [12, 1.75]),
    line(meet(cream, [17.25, 2], [14.5, 9]), [17.25, 2]),
  ]);
}

// Hot chocolate: a wide low mug, two marshmallows floating at its rim (the rim passes behind them)
// and one wisp.
{
  const mug = cupBody(3.25, 12.25, 17.25, 21.25, 3.5);
  const m = [cube([7.5, 11.75], 3, -8), cube([13.5, 11.25], 3, 10)];
  const [handle, steam] = [cupHandle(17.25, 13.75, 18.75, 3.5), wisp(10.5, 6.75, 0.95)];
  const [piece] = behind(mug, m);
  add('hot-chocolate', ['chocolate caliente', 'cocoa', 'atole', 'hot chocolate', 'cocoa', 'champurrado'], [piece, ...m, handle, steam], {
    fill: { solid: [hug(piece, m, mug), ...m], lines: [steam], wire: [handle] },
  });
}

// ── Sodas ─────────────────────────────────────────────────────────────────────────────────────
// Soda: an opaque tapered cup (the signature's corner) under a flat lid, a bent straw rising
// from it.
add('soda', ['refresco', 'soda', 'combo', 'soft drink', 'fountain soda', 'fast food'], [
  roundpoly([[5, 9.25], [19, 9.25], [17.25, 21.25], [6.75, 21.25]], [0, 0, 0, 2.5]),
  capsule(4, 6.25, 16, 3),
  rline([[12.25, 6.25], [12.25, 3.75], [15.75, 1.75]], [0, 1, 0]),
]);

/** A can: the top narrowed by its neck, the bevelled base (the square corner at bottom right). */
function can(x0, x1, y0, y1, neck = 1.5) {
  return roundpoly([[x0 + neck, y0], [x1 - neck, y0], [x1, y0 + 2.5], [x1, y1 - 1.75], [x1 - 1.25, y1], [x0 + 1.25, y1], [x0, y1 - 1.75], [x0, y0 + 2.5]], [0.5, 0.5, 1, 0.75, 0, 0.75, 0.75, 1]);
}
// Soda can: the can, the crease where its neck meets the body and the ring of the pull tab standing
// on its top.
const SODA_CAN = can(5.75, 18.25, 5.25, 21.25);
add('soda-can', ['lata', 'refresco de lata', 'cerveza de lata', 'soda can', 'can', 'canned drink'], [SODA_CAN, across(SODA_CAN, 7.75), rrect(10.25, 2.25, 3.5, 3, 1.25)]);

// Soda fountain: the machine (the signature's corner), its top panel with three nozzles under it
// and a cup standing on the drip tray.
add('soda-fountain', ['máquina de refrescos', 'dispensador', 'barra de refrescos', 'soda fountain', 'drink dispenser', 'refill'], [
  roundpoly([[4.75, 2.75], [19.25, 2.75], [19.25, 21.25], [4.75, 21.25]], [3.25, 3.25, 0, 3.25]),
  hl(4.75, 19.25, 7.25),
  vl(9, 7.25, 9.25),
  vl(12, 7.25, 9.25),
  vl(15, 7.25, 9.25),
  hl(4.75, 19.25, 18.25),
  roundpoly([[10, 12.25], [14, 12.25], [13.5, 18.25], [10.5, 18.25]], [0.5, 0.5, 0, 0.75]),
]);

// Energy drink: a tall slim can and Núcleo's lightning bolt, smaller, as its badge.
{
  const slim = can(7, 15, 2.75, 21.25, 1.25);
  const bolt = place(nucleo.icons.bolt.d[0], 0.6, [12, 12], BC);
  add('energy-drink', ['bebida energética', 'cafeína', 'energía', 'energy drink', 'caffeine', 'energy'], [slim, across(slim, 5.25)], { badge: { d: [bolt], knock: circ(...BC, 4.5), fill: { solid: [bolt] } } });
}

// Beverages: a bottle and a can standing side by side, the can in front (the bottle passes behind).
{
  const bottle = roundpoly([[6.5, 5.75], [9.5, 5.75], [9.5, 7.25], [12.5, 10], [12.5, 21.25], [3.5, 21.25], [3.5, 10], [6.5, 7.25]], [0, 0, 1, 1.5, 0, 2, 1.5, 1]);
  const front = can(11.5, 20.75, 9.5, 21.25, 1.25);
  const [piece] = behind(bottle, [front]);
  const cap = rrect(5.75, 2.75, 4.5, 3, 0.75);
  const crease = across(front, 12);
  add('beverages', ['bebidas', 'pasillo de bebidas', 'categoría', 'beverages', 'drinks', 'drinks aisle'], [piece, cap, front, crease], {
    fill: { solid: [hug(piece, front, bottle), cap, front], cut: [crease, hl(5.75, 10.25, 5.75)] },
  });
}

// ── Wine ──────────────────────────────────────────────────────────────────────────────────────
// Wine, beer and cocktail glasses stand on one stem and foot.
const STEM_FOOT = (yb, x = 12) => [vl(x, yb, 20.75), hl(x - 4.25, x + 4.25, 20.75)];
const BOWL = `M6.75 3.25H17.25C18 7.5 17.6 10.6 16 12.15C14.9 13.2 13.5 13.75 12 13.75S9.1 13.2 8 12.15C6.4 10.6 6 7.5 6.75 3.25Z`;
const WINE = [BOWL, across(BOWL, 7.75), ...STEM_FOOT(13.75)];
add('wine-glass', ['vino', 'copa de vino', 'carta de vinos', 'wine', 'wine glass', 'wine list'], WINE);
// With a badge, the glass steps left so its stem stays clear of the badge's cutout
add('wine-glass-star', ['calificar vino', 'vino favorito', 'reseña', 'rate wine', 'favorite wine', 'wine review'], WINE.map((d) => move(d, -3.5, 0)), { badge: badge('star') });

// Wine bottle: high round shoulders, a long neck and the capsule's band at its top, no label.
const WINE_BOTTLE = `M10.5 2.75H13.5V7.5C13.5 8.5 14 9 15 9.5C16.1 10.05 16.75 11 16.75 12.25V21.25H9.25A2 2 0 0 1 7.25 19.25V12.25C7.25 11 7.9 10.05 9 9.5C10 9 10.5 8.5 10.5 7.5Z`;
add('wine-bottle', ['botella de vino', 'vinoteca', 'servicio de botella', 'wine bottle', 'wine shop', 'bottle service'], [WINE_BOTTLE, hl(10.5, 13.5, 6)]);

// Wine pour: a small bottle tipped over a glass, a stream falling from its mouth into the bowl.
{
  const s = 0.55;
  const at = [15.5, 21.25];
  const glass = [BOWL, ...STEM_FOOT(13.75)].map((d) => place(d, s, [12, 20.75], at));
  const level = place(across(BOWL, 8.5), s, [12, 20.75], at);
  const yLevel = at[1] - (20.75 - 8.5) * s;
  // The bottle, its neck as wide as the wine bottle's, turned 100° so its mouth points down and
  // to the right, the mouth's lower corner 3 above the glass's rim
  const deg = 100;
  const small = `M10.5 2.75H13.5V6.25C13.5 7 13.9 7.4 14.5 7.75C15.1 8.1 15.5 8.6 15.5 9.25V12.5H8.5V9.25C8.5 8.6 8.9 8.1 9.5 7.75C10.1 7.4 10.5 7 10.5 6.25Z`;
  const mouth = [at[0], at[1] - 17.5 * s - 3 - 1.5 * Math.abs(Math.sin((deg * Math.PI) / 180))];
  const bottle = move(turnPath(small, deg, [12, 2.75]), mouth[0] - 12, mouth[1] - 2.75);
  const rimY = at[1] - 17.5 * s;
  add('wine-pour', ['servir vino', 'copa de vino', 'por copa', 'wine pour', 'pouring', 'by the glass'], [...glass, level, bottle, vl(mouth[0], mouth[1], yLevel)], {
    fill: { solid: [glass[0], bottle], cut: [level], wire: [glass[1], glass[2], vl(mouth[0], mouth[1], rimY)] },
  });
}

// Cheers: two wine glasses tipped toward each other, their rims touching, and three sparks above.
{
  const s = 0.68;
  const pivot = [7.5, 21];
  const one = [BOWL, ...STEM_FOOT(13.75)].map((d) => turnPath(place(d, s, [12, 20.75], pivot), 16, pivot));
  // Its rim's right corner, after the turn, meets the other glass's at x 12
  const rimR = rot([pivot[0] + (17.25 - 12) * s, pivot[1] - (20.75 - 3.25) * s], pivot, 16);
  const left = one.map((d) => move(d, 12 - rimR[0], 0));
  const right = left.map((d) => flipPath(d));
  const c = [12, rimR[1]];
  // The sparks start 5.25 out, 3 clear of the tipped rims, and 41° apart so they stand 3 apart too
  add('cheers', ['brindis', 'salud', 'celebrar', 'cheers', 'toast', 'celebration'], [...left, ...right, ...[-131, -90, -49].map((a) => line(polar(...c, 5.25, a), polar(...c, 7.5, a)))]);
}

/** A piece turned `deg` degrees about `pivot` and then moved so the pivot lands on `to`. */
const tilt = (d, deg, pivot, to = pivot) => move(turnPath(d, deg, pivot), to[0] - pivot[0], to[1] - pivot[1]);

// Champagne: the bottle tipped to the right, its cork flying off its mouth and the spray around it.
{
  // Drawn upright (the mouth at y 7.5, the cork 3 above it) and tipped 35° about the base
  const bottle = `M10.5 7.5H13.5V10C13.5 11.25 16 12 16 14.5V21.25H10A2 2 0 0 1 8 19.25V14.5C8 12 10.5 11.25 10.5 10Z`;
  const cork = rrect(10.5, 1.5, 3, 3, 0.75);
  // and the whole at 0.9, so the spray stays inside the live area
  const [deg, pivot, to, k] = [35, [12, 21.25], [5.75, 19.4], 0.9];
  const fit = (d) => move(place(tilt(d, deg, pivot, to), k, [12, 12]), 0, 0.3);
  const at = (p) => rot(p, pivot, deg).map((v, i) => (v + to[i] - pivot[i] - 12) * k + 12 + (i ? 0.3 : 0));
  add('champagne', ['champaña', 'vino espumoso', 'celebración', 'champagne', 'sparkling wine', 'celebration'], [
    fit(bottle),
    fit(hl(10.5, 13.5, 10)),
    fit(cork),
    ...[[7.25, 3.75], [16.75, 3.75], [16, -0.5]].map((p) => dot(...at(p))),
  ]);
}

// Champagne glass: the tall flute on the family's stem and foot, two bubbles rising in it.
{
  const flute = `M8.25 2.75H15.75L15.25 10.5A3.25 3.25 0 0 1 8.75 10.5Z`;
  add('champagne-glass', ['copa de champaña', 'flauta', 'brindis', 'champagne glass', 'flute', 'brunch'], [flute, ...STEM_FOOT(13.75), dot(12, 5.75), dot(12, 9.75)]);
}

// Corkscrew: the T of its handle and the shaft turning into the worm below it.
add('corkscrew', ['sacacorchos', 'descorchar', 'abrir vino', 'corkscrew', 'open wine', 'corkage'], [
  capsule(3.75, 3.25, 16.5, 3.5),
  smooth([[12, 6.75], [12, 9], [14.5, 10.75], [9.5, 13.25], [14.5, 15.75], [9.5, 18.25], [12, 20.75]]),
]);

// Decanter: the wide low bowl on its flat base, its round shoulders drawn up into a long neck that
// flares into the lip, and the wine's surface. (A straight level under a narrow mouth repeated
// datos' flask; the flared lip and the wine's wave make it a decanter.)
{
  const decanter = `M9.25 2.75H14.75C13.75 3.75 13.25 4.75 13.25 6V10.5C13.25 12 20.75 12.5 20.75 17.5C20.75 19.75 19.5 21.25 17.25 21.25H6.75C4.5 21.25 3.25 19.75 3.25 17.5C3.25 12.5 10.75 12 10.75 10.5V6C10.75 4.75 10.25 3.75 9.25 2.75Z`;
  add('decanter', ['decantador', 'jarra de vino', 'vino de la casa', 'decanter', 'carafe', 'house wine'], [decanter, wave(decanter, 17, 0.5)]);
}

// Wine barrel: upright, its staves bulging at the middle, held by two hoops.
{
  const barrel = `M6.75 3.25H17.25C19.6 7.25 19.6 16.75 17.25 20.75H6.75C4.4 16.75 4.4 7.25 6.75 3.25Z`;
  add('wine-barrel', ['barrica', 'barril', 'añejamiento', 'wine barrel', 'cask', 'winery'], [barrel, across(barrel, 7.75), across(barrel, 16.25)]);
}

// Tasting flight: the paddle and three small tasting glasses standing on it in a row, each bowl on
// a short stem. (Three squat tumblers side by side, each with its level, read as a row of blocks;
// a bowl on a stem is a glass at any size.)
{
  const board = rrect(2.75, 16.25, 18.5, 3.25, 1);
  // Bowls 3.8 wide, 7 apart: 3.2 of the canvas between their rims, so they stand apart at 2.1
  const bowl = (cx) => `M${f(cx - 1.9)} 7H${f(cx + 1.9)}C${f(cx + 2.1)} 10.5 ${f(cx + 1.45)} 12.5 ${f(cx)} 12.5S${f(cx - 2.1)} 10.5 ${f(cx - 1.9)} 7Z`;
  const xs = [5, 12, 19];
  add('tasting-flight', ['degustación', 'muestras', 'paleta de cervezas', 'tasting flight', 'sampler', 'tasting'], [board, ...xs.map(bowl), ...xs.map((x) => vl(x, 12.5, 16.25))]);
}

// Sake: the slim tokkuri, its neck pinched under the lip, and the small round cup beside it.
{
  const cx = 8.25;
  const X = (dx) => f(cx + dx);
  const flask = `M${X(-2)} 3H${X(2)}C${X(1.5)} 4 ${X(1.5)} 4.5 ${X(1.5)} 6V8.25C${X(1.5)} 10.25 ${X(4.75)} 12 ${X(4.75)} 16C${X(4.75)} 18.5 ${X(4.25)} 21.25 ${X(3.25)} 21.25H${X(-3.25)}C${X(-4.25)} 21.25 ${X(-4.75)} 18.5 ${X(-4.75)} 16C${X(-4.75)} 12 ${X(-1.5)} 10.25 ${X(-1.5)} 8.25V6C${X(-1.5)} 4.5 ${X(-1.5)} 4 ${X(-2)} 3Z`;
  const cup = `M16 16.75H21C21 19.5 20 21.25 18.5 21.25S16 19.5 16 16.75Z`;
  add('sake', ['sake', 'licor japonés', 'tokkuri', 'sake', 'japanese drink', 'rice wine'], [flask, cup]);
}

// ── Beer ──────────────────────────────────────────────────────────────────────────────────────
// Beer: the straight mug (the cup's rim and corner), its thick handle, the foam bubbling over the
// rim and two ridges in the glass.
{
  const mug = cupBody(4.25, 9, 15.25, 21.25, 3);
  const foam = `${smooth([[4.25, 9], [3.5, 7.25], [4.75, 5.25], [7.25, 4.75], [9, 3], [11.75, 2.75], [13.5, 4.25], [15.5, 4.75], [16.25, 7], [15.25, 9]])}Z`;
  add('beer', ['cerveza', 'tarro', 'bar', 'beer', 'beer mug', 'pub'], [mug, foam, cupHandle(15.25, 11.5, 18.25, 4), vl(8, 12.25, 18), vl(11.5, 12.25, 18)]);
}

// Pint glass: tall, widening toward the rim with the bulge just under it, and the head's line.
{
  const pint = roundpoly([[5.5, 3.25], [18.5, 3.25], [19, 6], [18.5, 8.5], [16.75, 21.25], [7.25, 21.25], [5.5, 8.5], [5, 6]], [0.75, 0.75, 1.5, 1.5, 0, 2.5, 1.5, 1.5]);
  add('pint-glass', ['pinta', 'cerveza de barril', 'cerveza artesanal', 'pint', 'draft beer', 'craft beer'], [pint, across(pint, 8.5)]);
}

// Beer bottle: long sloping shoulders, a long neck and the crown cap.
const BEER_BOTTLE = `M10.5 5.25H13.5V8.75C13.5 10 16.25 11 16.25 13.75V21.25H9.75A2 2 0 0 1 7.75 19.25V13.75C7.75 11 10.5 10 10.5 8.75Z`;
const CROWN = roundpoly([[10.25, 2.25], [13.75, 2.25], [14.25, 5.25], [9.75, 5.25]], [0.5, 0.5, 0.4, 0.4]);
add('beer-bottle', ['botella de cerveza', 'cerveza', 'chela', 'beer bottle', 'bottled beer', 'lager'], [BEER_BOTTLE, CROWN]);

// Beer tap: the tall handle standing on the faucet, its spout curving down and a drop under it.
add('beer-tap', ['cerveza de barril', 'grifo', 'de barril', 'beer tap', 'draft', 'on tap'], [
  roundpoly([[8.5, 2.25], [12.5, 2.25], [12, 9.5], [9, 9.5]], [1.25, 1.25, 0.5, 0.5]),
  capsule(3.5, 9.5, 13.5, 3),
  rline([[17, 11], [19.25, 11], [19.25, 15]], [0, 1.5, 0]),
  waterDrop([19.25, 19.75], 1.25),
]);

// Keg: the metal drum, its two rolling rings standing out of the silhouette, and the coupler on
// top. (Its handle cutouts read as a face side by side and as a backpack's handle alone.) The rings
// sit low and the bottom-left corner is 1.5 so that a badge's cut crosses plain wall and edge,
// which keeps keg-alert one structure from 0.9 to 2.1.
const KEG = (() => {
  const [x0, x1, y0, y1, out] = [5.25, 18.75, 5.25, 21.25, 1];
  const ribs = [13.75, 17.5];
  const side = (x, s) => ribs.flatMap((y) => [[x, y - 1.25], [x + s * out, y], [x, y + 1.25]]);
  const body = roundpoly(
    [[x0, y0], [x1, y0], ...side(x1, 1), [x1, y1], [x0, y1], ...side(x0, -1).reverse()],
    [2.25, 2.25, ...ribs.flatMap(() => [0.75, 0.6, 0.75]), 0, 1.5, ...ribs.flatMap(() => [0.75, 0.6, 0.75])],
  );
  return [body, rrect(9.75, 2.25, 4.5, 3, 0.75), ...ribs.map((y) => hl(x0 - out, x1 + out, y))];
})();
add('keg', ['barril de cerveza', 'inventario de bar', 'cerveza de barril', 'keg', 'beer keg', 'bar stock'], KEG);
add('keg-alert', ['barril vacío', 'poco inventario', 'cambiar barril', 'keg low', 'empty keg', 'restock'], KEG, { badge: badge('alert') });

// Six-pack: three necks standing in the carrier, the divider rising behind them with the hole for
// the hand.
{
  const box = roundpoly([[3.25, 16.5], [20.75, 16.5], [20.75, 21.25], [3.25, 21.25]], [0.75, 0.75, 0, 2]);
  const neck = (cx) => `M${f(cx - 1.5)} 16.5V13.75A1.5 1.5 0 0 1 ${f(cx + 1.5)} 13.75V16.5`;
  const necks = [6, 12, 18].map(neck);
  const panel = rline([[5.25, 16.5], [5.25, 3.25], [18.75, 3.25], [18.75, 16.5]], [0, 2.5, 2.5, 0]);
  add('six-pack', ['six pack', 'paquete de cervezas', 'cartón', 'six-pack', 'multipack', 'beer pack'], [box, ...necks, ...behind(panel, [box, ...necks.map(shut)]), capsule(9.75, 6.25, 4.5, 3)]);
}

// Bottle opener: the flat opener at 45°, the lip inside its round head and the long handle.
{
  const [hx, R, hh] = [16, 5, 2];
  const xt = hx - Math.sqrt(R * R - hh * hh);
  const body = `M4.75 ${f(12 - hh)}H${f(xt)}A${R} ${R} 0 1 1 ${f(xt)} ${f(12 + hh)}H4.75A${hh} ${hh} 0 0 1 4.75 ${f(12 - hh)}Z`;
  const hole = `M17.5 9.9V14.1H16A2.1 2.1 0 0 1 16 9.9Z`;
  add('bottle-opener', ['destapador', 'abridor', 'abrir botella', 'bottle opener', 'opener', 'open a beer'], [body, hole].map((d) => move(turnPath(d, -45), 0.5, 0.5)));
}

// Bottle return: the bottle with a return arrow as its badge, a U-turn: it points back along the
// top and its tail turns down and back under it. The bottle steps left so the badge's cut crosses its
// wall clear of the shoulder's corner.
{
  const [x0, x1, y0, y1] = [14, 18.25, 15.1, 19.6];
  const u = `M${x0} ${y0}H${x1}A2.25 2.25 0 0 1 ${x1} ${y1}H${f(x0 + 1.5)}`;
  const tip = line([x0 + 1.6, y0 - 1.6], [x0, y0], [x0 + 1.6, y0 + 1.6]);
  add('bottle-return', ['retornable', 'envase retornable', 'devolver envase', 'bottle return', 'returnable', 'deposit'], icons.bottle.d.map((d) => move(d, -2, 0)), { badge: { d: [u, tip], knock: circ(...BC, 4.25) } });
}

// Hops: the cone of petals hanging from its stem, narrow where it hangs and widest below the
// middle, each tier's petals swelling out to tips that point down and out, the lower edge of each
// tier across it, and one leaf on the stem. (A round cone with a leaf on top and rows of scales
// meeting in points read as a pineapple.)
{
  const T = [12, 7];
  // The right side, top to bottom: each tier swells out to its tip and steps back in to the notch
  // the next tier comes out of; the left side mirrors it. The cone hangs 3.25 under the leaf's
  // base, so the paper between the leaf and the cone's shoulder stays open at every weight.
  const tiers = [
    [[14.75, 10.5], [13.4, 11]],
    [[16.75, 13.75], [14.9, 14.35]],
    [[15.9, 17.1], [13.75, 17.7]],
  ];
  const segs = [];
  let from = T;
  for (const [tip, notch] of tiers) {
    segs.push({ from, c: [[from[0] + (tip[0] - from[0]) * 0.55 + 0.9, from[1] + (tip[1] - from[1]) * 0.15], [tip[0] + 0.15, tip[1] - (tip[1] - from[1]) * 0.35]], to: tip });
    segs.push({ from: tip, to: notch });
    from = notch;
  }
  segs.push({ from, c: [[from[0] + 0.5, from[1] + 1.5], [13.25, 20.25]], to: [12, 21.25] });
  const L = ([x, y]) => [24 - x, y];
  const right = segs.map((g) => (g.c ? `C${P(g.c[0])} ${P(g.c[1])} ${P(g.to)}` : `L${P(g.to)}`)).join('');
  const left = [...segs].reverse().map((g) => (g.c ? `C${P(L(g.c[1]))} ${P(L(g.c[0]))} ${P(L(g.from))}` : `L${P(L(g.from))}`)).join('');
  const cone = `M${P(T)}${right}${left}Z`;
  const edges = tiers.map(([, n]) => `M${P(n)}Q12 ${f(n[1] + (n[0] - 12) * 0.9)} ${P(L(n))}`);
  add('hops', ['lúpulo', 'cerveza artesanal', 'amargor', 'hops', 'craft beer', 'brewing'], [cone, ...edges, vl(12, 2.75, T[1]), leaf([12, 4], [19, 3.25], 3.25)]);
}

// ── Cocktails and spirits ─────────────────────────────────────────────────────────────────────
/** Where a rounded apex's arc actually bottoms out (a stem starts there, touching it). */
const apexY = ([ax, ay], [bx, by], r) => {
  const half = Math.atan2(Math.abs(ax - bx), Math.abs(ay - by));
  return by - (r / Math.sin(half) - r);
};
// Cocktail: the V of the martini glass on the family's stem and foot, the olive (a dot: solid at
// every weight) on its pick.
const [COCKTAIL, COCKTAIL_FILL] = (() => {
  const [L, R, A] = [[4.75, 3.25], [19.25, 3.25], [12, 13.25]];
  const [olive, end] = [[12, 7], [16.75, 2]];
  const d = [roundpoly([L, R, A], [0.75, 0.75, 1.25]), ...STEM_FOOT(apexY(L, A, 1.25)), circ(...olive, 1), line(olive, end)];
  // Filled, the pick is knocked out inside the glass and stays a line where it rises out of it
  const t = (olive[1] - L[1]) / (olive[1] - end[1]);
  const rim = [olive[0] + (end[0] - olive[0]) * t, L[1]];
  return [d, (dx) => ({ solid: [move(d[0], dx, 0)], cut: [move(d[3], dx, 0), move(line(olive, rim), dx, 0)], wire: [move(d[1], dx, 0), move(d[2], dx, 0), move(line(rim, end), dx, 0)] })];
})();
add('cocktail', ['cóctel', 'martini', 'coctelería', 'cocktail', 'martini', 'cocktail bar'], COCKTAIL, { fill: COCKTAIL_FILL(0) });
// With the badge, the glass steps left so its stem and foot stay clear of the cutout
add('cocktail-clock', ['happy hour', 'hora feliz', 'promoción de bebidas', 'happy hour', 'drink specials', 'bar deals'], COCKTAIL.map((d) => move(d, -2.75, 0)), { badge: badge('clock'), fill: COCKTAIL_FILL(-2.75) });

// Margarita: the stepped bowl (a wide shallow top over a smaller bowl) on its stem, and a lime
// wheel slit onto the rim behind it (the bowl's outline is what says margarita: it stays whole).
{
  // The wheel (r 3.75) sits low enough that its rind's cut ends stand 3 from its lower spoke
  const bowl = `M3.25 11H20.75C20.75 13 18.75 14.25 15.75 14.25C15.75 16.5 14.25 18 12 18S8.25 16.5 8.25 14.25C5.25 14.25 3.25 13 3.25 11Z`;
  const [c, r] = [[15.75, 5.6], 3.75];
  const [rind, ...spokes] = wheel(c, r).flatMap((d) => behind(d, [bowl]));
  const stem = STEM_FOOT(18);
  add('margarita', ['margarita', 'coctel con sal', 'bar mexicano', 'margarita', 'salted rim', 'lime'], [bowl, ...stem, rind, ...spokes], {
    fill: { solid: [bowl, hug(rind, bowl, circ(...c, r))], cut: spokes, wire: stem },
  });
}

// Tropical drink: the curvy hurricane glass on a short foot and a cocktail umbrella leaning out of it.
{
  const cx = 10.75;
  const X = (dx) => f(cx + dx);
  const glass = `M${X(-4.5)} 9H${X(4.5)}C${X(4.5)} 11 ${X(2.5)} 11.5 ${X(2.5)} 13.25C${X(2.5)} 14.5 ${X(4.25)} 15.25 ${X(4.25)} 17C${X(4.25)} 18.5 ${X(2.5)} 19.25 ${X(0)} 19.25S${X(-4.25)} 18.5 ${X(-4.25)} 17C${X(-4.25)} 15.25 ${X(-2.5)} 14.5 ${X(-2.5)} 13.25C${X(-2.5)} 11.5 ${X(-4.5)} 11 ${X(-4.5)} 9Z`;
  // The umbrella, upright and then tipped 30° about the foot of its stick
  const foot = [cx, 11.5];
  const top = [cx, 4.75];
  const canopy = `M${P([cx - 3.5, top[1]])}A3.5 3.5 0 0 1 ${P([cx + 3.5, top[1]])}Z`;
  const stand = `M${X(0)} 19.25V21.25M${X(-3.5)} 21.25H${X(3.5)}`;
  const tip = rot(top, foot, 30);
  const rim = [foot[0] + (tip[0] - foot[0]) * ((foot[1] - 9) / (foot[1] - tip[1])), 9];
  const shade = turnPath(canopy, 30, foot);
  add('tropical-drink', ['coctel tropical', 'piña colada', 'bar de playa', 'tropical drink', 'beach bar', 'pina colada'], [glass, stand, line(foot, tip), shade], {
    fill: { solid: [glass, shade], cut: [line(foot, rim)], wire: [stand, line(rim, tip)] },
  });
}

// Cocktail shaker: the cobbler's three sections, the tin, the strainer tapering up from it and the
// small cap, with the seams between them.
{
  const shaker = roundpoly([[10.25, 2.75], [13.75, 2.75], [14, 6.25], [17.25, 10.75], [16.5, 21.25], [7.5, 21.25], [6.75, 10.75], [10, 6.25]], [0.75, 0.75, 0.5, 0.75, 0, 2.25, 0.75, 0.5]);
  add('cocktail-shaker', ['coctelera', 'mezclar', 'bartender', 'cocktail shaker', 'shaker', 'mixology'], [shaker, across(shaker, 6.25), across(shaker, 10.75)]);
}

// Whiskey: the short wide rocks glass, one large cube and the liquid's line behind it.
{
  const glass = roundpoly([[4.25, 8.25], [19.75, 8.25], [18.75, 20.75], [5.25, 20.75]], [0.75, 0.75, 0, 3]);
  const ice = cube([13.25, 14.25], 5, -12, 1.25);
  add('whiskey', ['whisky', 'en las rocas', 'destilados', 'whiskey', 'on the rocks', 'spirits'], [glass, ...behind(across(glass, 12), [ice]), ice]);
}

// Shot glass: the small tapered glass with its thick base, and a lime wheel's half beside it.
{
  const glass = roundpoly([[3.25, 9.75], [11.75, 9.75], [10.75, 20.75], [4.25, 20.75]], [0.75, 0.75, 0, 2]);
  const [c, r] = [[17.25, 20.75], 4];
  add('shot-glass', ['caballito', 'shot', 'tequila', 'shot glass', 'tequila', 'mezcal'], [
    glass,
    across(glass, 17.5),
    `M${P([c[0] - r, c[1]])}A${r} ${r} 0 0 1 ${P([c[0] + r, c[1]])}Z`,
    ...[240, 300].map((a) => line(c, polar(...c, r, a))),
  ]);
}

// Liquor: a squat bottle with a short neck and its cap, and a short glass beside it.
{
  const bottle = roundpoly([[6.75, 5.25], [9.75, 5.25], [9.75, 7.5], [13.25, 9.75], [13.25, 21.25], [3.25, 21.25], [3.25, 9.75], [6.75, 7.5]], [0, 0, 0.75, 2, 0, 2, 2, 0.75]);
  const glass = roundpoly([[16.25, 13.25], [21.25, 13.25], [20.75, 21.25], [16.75, 21.25]], [0.5, 0.5, 0, 1.25]);
  add('liquor', ['licores', 'destilados', 'vinos y licores', 'liquor', 'spirits', 'liquor store'], [bottle, rrect(6, 2.25, 4.5, 3, 0.6), glass, across(glass, 16.75)]);
}

// Bar counter: the counter top with the cocktail's glass standing on it at half size, and two
// stools beneath it, a round seat on a single leg. (A plain tumbler on the counter and T-shaped
// stools read as a table.)
{
  const [s, ay] = [0.5, 7.5];
  const glass = place(COCKTAIL[0], s, [12, 13.25], [12, ay]);
  const foot = ay - (13.25 - apexY([4.75, 3.25], [12, 13.25], 1.25)) * s;
  const stool = (cx) => [capsule(cx - 2.75, 16, 5.5, 3), `M${f(cx)} 19V21.25M${f(cx - 2)} 21.25H${f(cx + 2)}`];
  add('bar-counter', ['bar', 'barra', 'vida nocturna', 'bar', 'pub', 'bar seating'], [rrect(2.75, 10, 18.5, 3, 0.75), glass, vl(12, foot, 10), ...stool(7), ...stool(17)]);
}

// ── Ice and keeping drinks cold ───────────────────────────────────────────────────────────────
// Ice cubes: two rounded cubes, the back one leaning on the front one, and the shine on the front.
{
  const front = cube([9.25, 14.5], 10, -6, 2.25);
  const back = cube([15.25, 8], 8.5, 18, 2);
  const [piece] = behind(back, [front]);
  const shine = rline([[7.25, 16], [7.25, 12.5], [10, 12.5]].map((p) => rot(p, [9.25, 14.5], -6)), [0, 1.25, 0]);
  add('ice-cubes', ['hielo', 'cubos de hielo', 'con hielo', 'ice cubes', 'ice', 'with ice'], [piece, front, shine], { fill: { solid: [hug(piece, front, back), front], cut: [shine] } });
}

// Ice bucket: the tapered bucket (the signature's corner) with its two side handles, and the neck
// of a bottle rising from it at an angle.
{
  const bucket = roundpoly([[6, 13.5], [18, 13.5], [17, 21.25], [7, 21.25]], [0.75, 0.75, 0, 2]);
  const handle = rline([[wallX(bucket, 14.75, 1), 14.75], [21, 14.75], [21, 18.5], [wallX(bucket, 18.5, 1), 18.5]], [0, 1.5, 1.5, 0]);
  // The wine bottle at 0.9, tipped 20°: its neck and shoulders show over the bucket
  const s = 0.9;
  const [deg, pivot, to] = [12, [12, 21.25], [11.25, 18.5]];
  const bottle = tilt(place(WINE_BOTTLE, s, pivot), deg, pivot, to);
  const [neck] = behind(bottle, [bucket]);
  const band = tilt(place(hl(10.5, 13.5, 6), s, pivot), deg, pivot, to);
  add('ice-bucket', ['hielera', 'cubeta de hielo', 'servicio de botella', 'ice bucket', 'bottle service', 'bucket of beers'], [bucket, handle, flipPath(handle), neck, band], {
    fill: { solid: [bucket, hug(neck, bucket, bottle)], cut: [band], wire: [handle, flipPath(handle)] },
  });
}

// Ice chest: the wide cooler (the signature's corner), its lid's line and the handle swung over it.
add('ice-chest', ['hielera', 'nevera portátil', 'picnic', 'ice chest', 'cooler', 'picnic'], [
  roundpoly([[2.75, 9.25], [21.25, 9.25], [21.25, 20.75], [2.75, 20.75]], [2.25, 2.25, 0, 2.25]),
  hl(2.75, 21.25, 12.75),
  rline([[6.25, 9.25], [6.25, 5.25], [17.75, 5.25], [17.75, 9.25]], [0, 2, 2, 0]),
]);

// Beverage cooler: the upright cabinet (the signature's corner), its header strip, the door's handle
// and two shelves with bottles standing on them.
{
  const shelf = (y) => [hl(5.25, 12.75, y), ...[8.25, 11.25].map((x) => vl(x, y - 2.5, y))];
  add('beverage-cooler', ['refrigerador de bebidas', 'enfriador', 'tienda de conveniencia', 'beverage cooler', 'drinks fridge', 'display cooler'], [
    roundpoly([[5.25, 2.75], [18.75, 2.75], [18.75, 21.25], [5.25, 21.25]], [2.5, 2.5, 0, 2.5]),
    hl(5.25, 18.75, 6.5),
    vl(15.75, 9.5, 18),
    ...shelf(12),
    ...shelf(17.5),
  ]);
}

// ── Carrying drinks ───────────────────────────────────────────────────────────────────────────
// Thermos: the tall flask (the signature's corner) under its cup-cap, wider than it, and the
// shoulder's band where the stopper sits.
add('thermos', ['termo', 'bebida caliente', 'para llevar', 'thermos', 'vacuum flask', 'hot drink'], [
  roundpoly([[7.25, 7.25], [16.75, 7.25], [16.75, 21.25], [7.25, 21.25]], [0, 0, 0, 2.5]),
  rrect(6.25, 2.75, 11.5, 4.5, 1.25),
  hl(7.25, 16.75, 10.25),
]);

// Travel mug: the tall tumbler (the cup's corner) under a lid with its raised sip spout, and the
// side handle.
{
  const cup = roundpoly([[5.25, 7.75], [15.75, 7.75], [15, 21.25], [6, 21.25]], [0, 0, 0, 2.5]);
  const lid = roundpoly([[4.5, 7.75], [4.5, 4.75], [6.5, 4.75], [7.25, 2.25], [10.25, 2.25], [11, 4.75], [16.5, 4.75], [16.5, 7.75]], [0.6, 0.6, 0.5, 0.6, 0.6, 0.5, 0.6, 0.6]);
  const [y0, y1] = [10.5, 17];
  add('travel-mug', ['vaso térmico', 'taza de viaje', 'reutilizable', 'travel mug', 'tumbler', 'commute'], [cup, lid, rline([[wallX(cup, y0, 1), y0], [19.5, y0], [19.5, y1], [wallX(cup, y1, 1), y1]], [0, 2, 2, 0])]);
}

// Straw: the bendable straw, its tube rising and turning 45° at the bend, the accordion's folds
// below the bend.
{
  const hw = 1.75;
  const [x, yb, end] = [10.25, 9.75, [16.25, 3.75]];
  const t = hw * Math.tan(Math.PI / 8);
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  const tube = roundpoly(
    [[x - hw, 21.25], [x - hw, yb - t], [end[0] - hw * n[0], end[1] - hw * n[1]], [end[0] + hw * n[0], end[1] + hw * n[1]], [x + hw, yb + t], [x + hw, 21.25]],
    [0.75, 0.75, 0.75, 0.75, 0.75, 0.75],
  );
  add('straw', ['popote', 'pajilla', 'sin popote', 'straw', 'drinking straw', 'no straw'], [tube, hl(x - hw, x + hw, 13), hl(x - hw, x + hw, 16)]);
}

// Drink carrier: the cardboard tray seen from the front holding two takeaway cups, their lids and
// the top of their cups showing over it.
{
  const tray = roundpoly([[2.75, 13.25], [21.25, 13.25], [19.75, 21.25], [4.25, 21.25]], [0.75, 0.75, 0, 2]);
  const cup = (cx) => [rrect(cx - 3.75, 2.75, 7.5, 3, 0.75), roundpoly([[cx - 3.25, 5.75], [cx + 3.25, 5.75], [cx + 2.25, 18], [cx - 2.25, 18]], 0)];
  const cups = [6.75, 17.25].map(cup).map(([lid, body]) => [lid, behind(body, [tray])[0], body]);
  add('drink-carrier', ['portavasos', 'charola para llevar', 'pedido grupal', 'drink carrier', 'cup holder', 'group order'], [tray, ...cups.flatMap(([lid, piece]) => [lid, piece])], {
    fill: { solid: [tray, ...cups.flatMap(([lid, piece, body]) => [lid, hug(piece, tray, body)])], cut: [6.75, 17.25].map((cx) => hl(cx - 3.25, cx + 3.25, 5.75)) },
  });
}

// Cup sizes: three cups of growing height on one baseline, each in front of the next.
{
  const cupAt = (cx, top, w) => roundpoly([[cx - w / 2, top], [cx + w / 2, top], [cx + w / 2 - w * 0.12, 21.25], [cx - w / 2 + w * 0.12, 21.25]], [0.75, 0.75, 0, 1.25]);
  const [small, medium, large] = [cupAt(6, 14, 6.5), cupAt(11.75, 9.25, 7.5), cupAt(17, 4.25, 8.5)];
  const [m] = behind(medium, [small]);
  const [l] = behind(large, [medium]);
  add('cup-sizes', ['tamaños', 'chico mediano grande', 'tamaño de bebida', 'cup sizes', 'small medium large', 'drink size'], [small, m, l], {
    fill: { solid: [small, hug(m, small, medium), hug(l, medium, large)] },
  });
}

// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// By index into each icon's `d` (or a path of its own): `solid` is filled (closed shapes only;
// 'shut:i' closes an open outline), `cut` knocked out, `lines` on top with a clearance, `wire` on
// top and attached. Where a lid sits on its cup, both go solid and the seam between them is cut; a
// piece behind another goes in `lines`, or fills up to the knockout's edge (hug()). Icons whose
// fill needs their own pieces set it where they are drawn. See DESIGN.md › Fill.
const FILL = {
  espresso: { solid: [0], wire: [1], lines: [2, 3] },
  latte: { solid: [0], cut: [1, 2], lines: [3] },
  'iced-coffee': { solid: [0, 'shut:1'], cut: [3, 4, hl(3.75, 20.25, 7.75)], wire: [2] },
  frappe: { solid: [0, 'shut:1'], cut: [2, hl(5.5, 18.5, 11.25)], wire: [3] },
  'takeaway-cup': { solid: [0, 'shut:1'], cut: [2, 3, hl(5.75, 18.25, 8.25)] },
  'coffee-bean': { solid: [0], cut: [1] },
  'coffee-bag': { solid: [0, 'shut:1'], cut: [2, hl(5.75, 18.25, 6.25)] },
  'coffee-capsule': { solid: ['shut:0', 1, 'shut:2'], cut: [hl(5.25, 18.75, 7), hl(5.5, 18.5, 10)] },
  'french-press': { solid: ['shut:0', 1, 3], cut: [4, vl(10.25, 9.5, 15.5), hl(4.75, 15.75, 9.5)], wire: [vl(10.25, 3.25, 6.75), 5] },
  'moka-pot': { solid: [0, 1], cut: [3, 4, 5], wire: [2] },
  'pour-over': { solid: [0, 1, 2], wire: [3] },
  'coffee-pot': { solid: [0], cut: [1], wire: [2] },
  portafilter: { solid: [0, 'shut:1'], wire: [2, 3] },
  tea: { solid: [0], cut: [3, 4], wire: [1], lines: [2] },
  teapot: { solid: [0, 'shut:1', 2], cut: [hl(8.75, 15.25, 9)], wire: [3, 4] },
  'tea-bag': { solid: [0, 3], cut: [1], wire: [2] },
  'tea-infuser': { solid: [0], cut: [1, 2, 3, 4], wire: [5, 6] },
  'tea-leaves': { solid: [1, 2, 3], wire: [0] },
  matcha: { solid: [0, 1], wire: [2, 3, 4] },
  'yerba-mate': { solid: [0], cut: [1], wire: [2] },
  'bubble-tea': { solid: [0, 1], cut: [2, 3, 4] },
  glass: { solid: [0], cut: [1] },
  'glass-half': { solid: [0], cut: [1] },
  'glass-empty': { solid: [0], cut: [1] },
  'glass-sparkling': { solid: [0], cut: [1, 2, 3, 4] },
  'water-bottle': { solid: [0, 1], cut: [hl(6.75, 17.25, 8.5)], wire: [2] },
  bottle: { solid: [0, 1], cut: [2, hl(9.5, 14.5, 5.75)] },
  'water-jug': { solid: [0, 1], cut: [2, 3, hl(9.25, 14.75, 5.75)] },
  'drinking-water': { solid: [0, 4], cut: [5], wire: [1, 2, 3] },
  'refill-station': { solid: [0, 'shut:1', 2] },
  pitcher: { solid: [0], cut: [2], wire: [1] },
  'milk-jug': { solid: [0], wire: [1] },
  'drink-dispenser': { solid: [0, 1], cut: [2, hl(6.5, 14.5, 6.75)], wire: [3, 4, 5] },
  juice: { solid: [0], cut: [1, 2, 3, 4], wire: [5] },
  'juice-box': { solid: [0], cut: [1], wire: [2] },
  smoothie: { solid: [0, 'shut:1'], cut: [hl(5.75, 18.25, 10.25)], wire: [2] },
  lemonade: { solid: [0], cut: [1, 3, 4, 5, 6], wire: [2, 7] },
  'coconut-drink': { solid: [0], cut: [1], wire: [2] },
  'shaker-bottle': { solid: [0, 1], cut: [3, 4, 5, hl(5.25, 18.75, 8.5)], wire: [2] },
  milk: { solid: [0], cut: [1, 2, 3] },
  milkshake: { solid: [0, 'shut:3'], cut: [hl(5, 19, 11)], lines: [4, 5], wire: [1, 2, 6] },
  soda: { solid: [0, 1], cut: [hl(5, 19, 9.25)], wire: [2] },
  'soda-can': { solid: [0, 2], cut: [1, hl(10.25, 13.75, 5.25)] },
  'soda-fountain': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'energy-drink': { solid: [0], cut: [1] },
  'wine-glass': { solid: [0], cut: [1], wire: [2, 3] },
  'wine-bottle': { solid: [0], cut: [1] },
  cheers: { solid: [0, 3], wire: [1, 2, 4, 5], lines: [6, 7, 8] },
  champagne: { solid: [0, 2, 3, 4, 5], cut: [1] },
  'champagne-glass': { solid: [0], cut: [3, 4], wire: [1, 2] },
  corkscrew: { solid: [0], wire: [1] },
  decanter: { solid: [0], cut: [1] },
  'wine-barrel': { solid: [0], cut: [1, 2] },
  'tasting-flight': { solid: [0, 1, 2, 3], wire: [4, 5, 6] },
  sake: { solid: [0, 1] },
  beer: { solid: [0, 1], cut: [3, 4, hl(4.25, 15.25, 9)], wire: [2] },
  'pint-glass': { solid: [0], cut: [1] },
  'beer-bottle': { solid: [0, 1], cut: [hl(9.75, 14.25, 5.25)] },
  'beer-tap': { solid: [0, 1, 3], cut: [hl(9, 12, 9.5)], wire: [2] },
  keg: { solid: [0, 1], cut: [2, 3, hl(9.75, 14.25, 5.25)] },
  'six-pack': { solid: [0, 'shut:1', 'shut:2', 'shut:3'], cut: [6, 12, 18].map((cx) => hl(cx - 1.5, cx + 1.5, 16.5)), lines: [4, 5] },
  'bottle-opener': { solid: [0], cut: [1] },
  hops: { solid: [0, 5], cut: [1, 2, 3], wire: [4] },
  'cocktail-shaker': { solid: [0], cut: [1, 2] },
  whiskey: { solid: [0], cut: [1, 2] },
  'shot-glass': { solid: [0, 2], cut: [1, 3, 4] },
  liquor: { solid: [0, 1, 2], cut: [3, hl(6, 10.5, 5.25)] },
  'bar-counter': { solid: [0, 1, 3, 5], wire: [2, 4, 6] },
  'ice-chest': { solid: [0], cut: [1], wire: [2] },
  'beverage-cooler': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] },
  thermos: { solid: [0, 1], cut: [2, hl(6.25, 17.75, 7.25)] },
  'travel-mug': { solid: [0, 1], cut: [hl(4.5, 16.5, 7.75)], wire: [2] },
  straw: { solid: [0], cut: [1, 2] },
};
// Badge siblings share their base's drawing, fill and parts
const SIBLINGS = {
  espresso: ['espresso-plus'],
  'coffee-bean': ['coffee-roast'],
  'takeaway-cup': ['takeaway-cup-check', 'takeaway-cup-clock'],
  glass: ['glass-plus', 'glass-clock', 'glass-check'],
  milk: ['plant-milk'],
  'wine-glass': ['wine-glass-star'],
  keg: ['keg-alert'],
  bottle: ['bottle-return'],
};
for (const [base, kids] of Object.entries(SIBLINGS)) for (const k of kids) if (FILL[base]) FILL[k] = FILL[base];
const pickFill = (name, spec) => {
  const { d } = icons[name];
  const one = (x) => (typeof x === 'number' ? d[x] : x.startsWith('shut:') ? shut(d[Number(x.slice(5))]) : x);
  const out = {};
  for (const k of ['solid', 'cut', 'lines', 'wire']) if (spec[k]?.length) out[k] = spec[k].map(one);
  return out;
};
for (const [name, spec] of Object.entries(FILL)) icons[name].fill = pickFill(name, spec);
// The cappuccino: the cup and its tab are solid with the heart knocked out; the saucer stays a ring
{
  const { d } = icons.cappuccino;
  const [cup, handle, heart] = d.slice(-3);
  icons.cappuccino.fill = { solid: [cup, shut(handle)], cut: [heart], lines: d.slice(0, -3) };
}

// ── Parts ─────────────────────────────────────────────────────────────────────────────────────
const PARTS = {
  espresso: { cup: [0], handle: [1], saucer: [2], steam: [3] },
  latte: { glass: [0], layers: [1, 2], saucer: [3] },
  'iced-coffee': { lid: [0], cup: [1], straw: [2], ice: [3, 4] },
  frappe: { lid: [0], cup: [1], cream: [2], straw: [3] },
  'takeaway-cup': { lid: [0], cup: [1], sleeve: [2, 3] },
  'coffee-bean': { bean: [0], crease: [1] },
  'coffee-bag': { bag: [0, 1], valve: [2] },
  'coffee-capsule': { lid: [0], rim: [1], body: [2] },
  'french-press': { carafe: [0], lid: [1], plunger: [2, 3, 4], handle: [5] },
  'moka-pot': { pot: [0], knob: [1], handle: [2], facets: [3, 4, 5] },
  'pour-over': { dripper: [0], drop: [1], cup: [2], handle: [3] },
  'coffee-pot': { pot: [0], collar: [1], handle: [2] },
  portafilter: { basket: [0], handle: [1], spouts: [2, 3] },
  tea: { cup: [0], handle: [1], saucer: [2], tag: [3, 4] },
  teapot: { body: [0], lid: [1, 2], spout: [3], handle: [4] },
  'tea-bag': { bag: [0, 1], string: [2], tag: [3] },
  'tea-infuser': { ball: [0, 1, 2, 3, 4], chain: [5, 6] },
  'tea-leaves': { stem: [0], leaves: [1, 2, 3] },
  matcha: { bowl: [0], whisk: [1, 2, 3, 4] },
  'yerba-mate': { gourd: [0, 1], straw: [2] },
  'bubble-tea': { cup: [0], straw: [1], pearls: [2, 3, 4] },
  'iced-tea': { glass: [0], lemon: [1, 2, 3, 4], ice: [5, 6] },
  glass: { glass: [0], water: [1] },
  'glass-half': { glass: [0], water: [1] },
  'glass-empty': { glass: [0], drop: [1] },
  'glass-sparkling': { glass: [0], water: [1], bubbles: [2, 3, 4] },
  'water-bottle': { bottle: [0], cap: [1], loop: [2] },
  bottle: { body: [0, 2], cap: [1] },
  'water-jug': { jug: [0, 2, 3], cap: [1] },
  'drinking-water': { tap: [0, 1, 2], stream: [3], glass: [4, 5] },
  'refill-station': { unit: [0], spout: [1], bottle: [2] },
  pitcher: { jug: [0], handle: [1], drink: [2] },
  'milk-jug': { jug: [0], handle: [1] },
  'drink-dispenser': { jar: [0, 2], lid: [1], spigot: [3], stand: [4, 5] },
  juice: { fruit: [0, 1, 2, 3, 4], straw: [5] },
  'juice-box': { box: [0, 1], straw: [2] },
  smoothie: { cup: [0], top: [1], straw: [2] },
  lemonade: { jar: [0, 1], handle: [2], lemon: [3, 4, 5, 6], straw: [7] },
  'coconut-drink': { coconut: [0, 1], straw: [2] },
  'shaker-bottle': { bottle: [0, 3, 4, 5], lid: [1, 2] },
  milk: { carton: [0, 1, 2, 3] },
  milkshake: { glass: [0, 1, 2], cream: [3], cherry: [4, 5], straw: [6] },
  'hot-chocolate': { mug: [0, 3], marshmallows: [1, 2], steam: [4] },
  soda: { cup: [0], lid: [1], straw: [2] },
  'soda-can': { can: [0, 1], tab: [2] },
  'soda-fountain': { machine: [0, 1, 5], nozzles: [2, 3, 4], cup: [6] },
  'energy-drink': { can: [0, 1] },
  beverages: { bottle: [0, 1], can: [2, 3] },
  'wine-glass': { glass: [0, 2, 3], wine: [1] },
  'wine-bottle': { bottle: [0, 1] },
  'wine-pour': { glass: [0, 1, 2, 3], bottle: [4], stream: [5] },
  cheers: { left: [0, 1, 2], right: [3, 4, 5], sparks: [6, 7, 8] },
  champagne: { bottle: [0, 1], cork: [2], spray: [3, 4, 5] },
  'champagne-glass': { glass: [0, 1, 2], bubbles: [3, 4] },
  corkscrew: { handle: [0], worm: [1] },
  decanter: { decanter: [0], wine: [1] },
  'wine-barrel': { barrel: [0], hoops: [1, 2] },
  'tasting-flight': { board: [0], glasses: [1, 2, 3, 4, 5, 6] },
  sake: { flask: [0], cup: [1] },
  beer: { mug: [0, 3, 4], foam: [1], handle: [2] },
  'pint-glass': { glass: [0], head: [1] },
  'beer-bottle': { bottle: [0], cap: [1] },
  'beer-tap': { handle: [0], faucet: [1, 2], drop: [3] },
  keg: { keg: [0, 2, 3], valve: [1] },
  'six-pack': { carrier: [0, 4, 5], bottles: [1, 2, 3] },
  'bottle-opener': { opener: [0, 1] },
  hops: { cone: [0, 1, 2, 3], stem: [4], leaf: [5] },
  cocktail: { glass: [0, 1, 2], olive: [3, 4] },
  margarita: { glass: [0, 1, 2], lime: [3, 4, 5, 6] },
  'tropical-drink': { glass: [0, 1], umbrella: [2, 3] },
  'cocktail-shaker': { shaker: [0, 1, 2] },
  whiskey: { glass: [0, 1], ice: [2] },
  'shot-glass': { glass: [0, 1], lime: [2, 3, 4] },
  liquor: { bottle: [0, 1], glass: [2, 3] },
  'bar-counter': { counter: [0], glass: [1, 2], stools: [3, 4, 5, 6] },
  'ice-cubes': { ice: [0, 1], shine: [2] },
  'ice-bucket': { bucket: [0, 1, 2], bottle: [3, 4] },
  'ice-chest': { chest: [0, 1], handle: [2] },
  'beverage-cooler': { cabinet: [0, 1, 2], shelves: [3, 4, 5, 6, 7, 8] },
  thermos: { flask: [0, 2], cap: [1] },
  'travel-mug': { cup: [0], lid: [1], handle: [2] },
  straw: { straw: [0, 1, 2] },
  'drink-carrier': { tray: [0], cups: [1, 2, 3, 4] },
  'cup-sizes': { small: [0], medium: [1], large: [2] },
};
for (const [base, kids] of Object.entries({ ...SIBLINGS, cocktail: ['cocktail-clock'] })) for (const k of kids) PARTS[k] = PARTS[base];
{
  const n = icons.cappuccino.d.length;
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  PARTS.cappuccino = { saucer: range(0, n - 3), cup: [n - 3], handle: [n - 2], art: [n - 1] };
}
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
const MOTION = {
  espresso: { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  'hot-chocolate': { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  'coffee-roast': { effect: 'wiggle', parts: ['badge'], origin: [17.5, 21.25] },
  'french-press': { effect: 'bounce', parts: ['plunger'], vector: [0, 1.5] },
  'pour-over': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'beer-tap': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  tea: { effect: 'wiggle', parts: ['tag'], origin: [10.25, 6.5] },
  teapot: { effect: 'wiggle', origin: [12, 20.75] },
  // Steeping: the bag dips on its string
  'tea-bag': { effect: 'bounce', parts: ['bag'], vector: [0, 1.5] },
  'tea-infuser': { effect: 'ring', origin: [12, 3.25] },
  hops: { effect: 'ring', origin: [12, 2.75] },
  // Whisking: the whisk rocks from its tines
  matcha: { effect: 'wiggle', parts: ['whisk'], origin: [12.5, 10.5] },
  'glass-sparkling': { effect: 'float', parts: ['bubbles'], vector: [0, -1.5] },
  cheers: { effect: 'wiggle', origin: [12, 21] },
  // The cork flies on along the bottle's axis (tipped 35°)
  champagne: { effect: 'slide', parts: ['cork', 'spray'], vector: [1.15, -1.64] },
  corkscrew: { effect: 'wiggle', origin: [12, 5] },
  'bottle-opener': { effect: 'wiggle', origin: [6, 18] },
  'cocktail-shaker': { effect: 'wiggle', origin: [12, 12] },
  'tropical-drink': { effect: 'wiggle', parts: ['umbrella'], origin: [10.75, 11.5] },
  'energy-drink': { effect: 'beat', parts: ['badge'], origin: BC },
  'keg-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── 16 px (DESIGN.md › 16 px) ──────────────────────────────────────────────────────────────────
// Where the engine's snap leaves a smudge, the 16 px drawing keeps the icon's own strokes minus the
// details that run together, snapped here as the engine would (it doesn't snap a `small`).
function smallOf(name, d, fill) {
  const sn = snapper([...d, ...Object.values(fill).flat()]);
  icons[name].small = { d: d.map(sn), fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)])) };
}
{
  // The cappuccino without the saucer's ring: a larger cup, its tab and the heart
  const c = [10.5, 12];
  const [cup, tab] = cupTop(c, 7.5, 1.5, 20.75);
  const art = heart([c[0], c[1] - 0.75], 1.75, 1.5, 3.75);
  smallOf('cappuccino', [cup, tab, art], { solid: [cup, shut(tab)], cut: [art] });
  // Iced tea: the glass, the lemon's rind without its spokes and one ice cube
  const t = icons['iced-tea'];
  const ice = cube([9.75, 14.5], 4.25, -10, 1);
  smallOf('iced-tea', [t.d[0], t.d[1], ice], { solid: t.fill.solid, cut: [ice] });
  // Lemonade: the lemon wheel's rind only
  const l = icons.lemonade.d;
  smallOf('lemonade', [l[0], l[1], l[2], l[3], l[7]], { solid: [l[0]], cut: [l[1], l[3]], wire: [l[2], l[7]] });
  // Cheers: the two glasses touching, without the sparks
  const ch = icons.cheers.d;
  smallOf('cheers', ch.slice(0, 6), { solid: [ch[0], ch[3]], wire: [ch[1], ch[2], ch[4], ch[5]] });
  // The six-pack: the carrier without its hand hole
  const sp = icons['six-pack'];
  smallOf('six-pack', sp.d.slice(0, 5), { solid: sp.fill.solid, cut: sp.fill.cut, lines: [sp.d[4]] });
  // On the pixel grid (pixel centers at 0.75 + 1.5k)
  const px = ([c, r]) => [0.75 + 1.5 * c, 0.75 + 1.5 * r];
  // Hops: the cone's tiers as steps of one pixel, the middle tier's edge and the stem; the leaf
  // drops (at 16 px it and the stem read as a musical note)
  const right = [[7, 3], [9, 5], [8, 6], [10, 8], [9, 9], [10, 11], [9, 12], [7, 14]];
  const cone16 = roundpoly([...right, ...right.slice(1, -1).reverse().map(([c, r]) => [14 - c, r])].map(px), 0.3);
  const edge16 = line(...[[9, 9], [7, 10], [5, 9]].map(px));
  smallOf('hops', [cone16, edge16, line(px([7, 3]), px([7, 1]))], { solid: [cone16], cut: [edge16], wire: [line(px([7, 3]), px([7, 1]))] });
  // The tasting flight: three cups of 4 pixels with one between them, on the paddle (the bowls on
  // their stems ran together into one strip)
  const cups = [1, 6, 11].map((k) => roundpoly([[k, 4], [k + 3, 4], [k + 3, 7], [k + 2, 9], [k + 1, 9], [k, 7]].map(px), [0.3, 0.3, 0.6, 0.4, 0.4, 0.6]));
  const [p0, p1] = [px([1, 10]), px([14, 12])];
  const paddle = rrect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], 0.75);
  smallOf('tasting-flight', [paddle, ...cups], { solid: [paddle, ...cups] });
}

// Levels: the sizes light up from the small cup to the large one
icons['cup-sizes'].levels = [[0], [1], [2]];

export default { category: 'bebidas', label: 'Bebidas', icons };
