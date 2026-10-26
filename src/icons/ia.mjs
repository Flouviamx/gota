// Inteligencia artificial: models and training, datasets, embeddings and vectors, tokens and
// context, prompts, agents and their tools, assistants, generation (text to image, video, speech,
// music, SQL), computer vision, and the safety and evaluation around them. Everything is computed
// with the engine (engine/geometry.mjs) on the rules in DESIGN.md.
//
// The AI mark is one sparkle, datos' own (`sparkle`, imported and scaled, never redrawn), at two
// sizes: 8.5 across when it is the subject (an agent's head, a reasoning orbit) and 5.5 across when
// it is an accent (inside a cube, a field, beside an object). The model is one cube for the whole
// model-* family: datos' 3D cube language (a square front face with its top and side in depth), with
// the sparkle in its front face; at the sizes where the sparkle has no room (a card, a field, a pair)
// the cube stands alone. The agent is Núcleo's person with the sparkle as its head; the prompt is
// datos' field. Badges are the engine's, and any piece that sits on top of another is a custom badge
// the engine clears with exact clearance: nothing is trimmed by hand.
import { arc, badge, circ, cursor, dot, drop, f, flipPath, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import datos from './datos.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Paths as segments ─────────────────────────────────────────────────────────────────────────
// parse() turns an engine `d` into absolute segments (L, C, A) and ser() turns them back, as social
// does: clip() keeps the parts of a path where a rule holds (a shape behind another stops 3 center to
// center from it), and span() cuts a path by arc length (the dashes of a dashed stroke).
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

/** Cumulative length table of a segment (64 steps), to cut it by arc length. */
function table(s) {
  const out = [0];
  let a = pt(s, 0);
  for (let k = 1; k <= 64; k++) {
    const b = pt(s, k / 64);
    out.push(out[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    a = b;
  }
  return out;
}
const segLen = (s) => table(s)[64];
/** The parameter t at which a segment reaches length `l`. */
function tAt(s, l) {
  const tb = table(s);
  if (l <= 0) return 0;
  if (l >= tb[64]) return 1;
  let k = 1;
  while (tb[k] < l) k++;
  return (k - 1 + (l - tb[k - 1]) / (tb[k] - tb[k - 1])) / 64;
}

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

/** Keeps only the parts of `d` where keep(p) holds (pieces shorter than 0.3 are dropped). */
function clip(d, keep) {
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
      if (segs.reduce((n, s) => n + segLen(s), 0) > 0.3) out.push({ segs, closed: false });
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
 * closer than `gap` (center to center) to their outline is dropped. 3 center to center is the
 * set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep);
}

/** The piece of a path's first subpath between arc lengths l0 and l1 (closed paths wrap around). */
function span(d, l0, l1) {
  const sp = parse(d)[0];
  const lens = sp.segs.map(segLen);
  const total = lens.reduce((a, b) => a + b, 0);
  const segs = [];
  const take = (a, b) => {
    let at = 0;
    sp.segs.forEach((s, i) => {
      const [s0, s1] = [at, at + lens[i]];
      at = s1;
      const [u, v] = [Math.max(a, s0), Math.min(b, s1)];
      if (v - u > 1e-6) segs.push(sub(s, tAt(s, u - s0), tAt(s, v - s0)));
    });
  };
  if (l0 < 0) {
    take(total + l0, total);
    take(0, l1);
  } else if (l1 > total) {
    take(l0, total);
    take(0, l1 - total);
  } else take(l0, l1);
  return ser([{ segs, closed: false }]);
}
const lengthOf = (d) => parse(d)[0].segs.reduce((n, s) => n + segLen(s), 0);
/**
 * A dashed stroke as one path (it draws itself as one): `n` dashes `gap` apart (3 center to center
 * is 1.5 of paper, as the set's dashed frames). Open paths start and end on a dash; closed ones
 * place the first dash centered at `mid` (arc length).
 */
function dashes(d, n, { gap = 3, mid = 0 } = {}) {
  const L = lengthOf(d);
  const closed = parse(d)[0].closed;
  if (closed) {
    const dash = L / n - gap;
    return Array.from({ length: n }, (_, i) => span(d, mid + (i * L) / n - dash / 2, mid + (i * L) / n + dash / 2)).join('');
  }
  const dash = (L - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => span(d, i * (dash + gap), i * (dash + gap) + dash)).join('');
}

/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Open polyline with rounded corners (one radius per vertex, or one for all). */
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
/** The area a custom badge clears: closed shapes whole, each segment of an open line on its own. */
const knockOf = (...ds) => ser(ds.flatMap((d) => parse(d).flatMap((sp) => (sp.closed ? [sp] : sp.segs.map((s) => ({ segs: [s], closed: false }))))));
/** A custom badge: `d` drawn on top, `knock` cleared with the engine's clearance. */
const own = (d, knock = knockOf(...d), fill) => ({ d, knock, ...(fill && { fill }) });
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });
/** A straight arrow from `a` to `b` with arms of `len` at 45° (6 on full arrows, 3 on small ones). */
const arrow = (a, b, len = 3) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], len)];

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const BC = [17.25, 17.25];
const RING = circ(...BC, 4.25);

// The sparkle: datos' own (R 9.25 at the center of the canvas), scaled to two sizes.
const SPARK = datos.icons.sparkle.d[0];
const RL = 4.25;
const RS = 2.75;
/** datos' sparkle with its center at (cx, cy) and R from the center to each point. */
const spark = (cx, cy, R = RS) => place(SPARK, R / 9.25, [12, 12], [cx, cy]);
/**
 * The sparkle on top of another shape (a custom badge): it clears the diamond through its four
 * points, not its own concave outline, so a line passing between two points is cut at every weight
 * instead of surviving at light and breaking at bold.
 */
const sparkOn = (cx, cy, R = RS) => {
  const s = spark(cx, cy, R);
  return own([s], roundpoly([[cx, cy - R], [cx + R, cy], [cx, cy + R], [cx - R, cy]], 0.5), { solid: [s] });
};

// The cube: a square front face with its top and right side in depth (datos' `cube`), its corners
// rounded 1.25. `d` is the depth; the back edge stops on the rounded back corner.
function cube(x, y, S, d, r = 1.25, { sharp = false } = {}) {
  // `sharp`: the back top corner stays square, so a pole can rise from it (model-checkpoint)
  const outline = roundpoly([[x, y + d], [x + d, y], [x + S, y], [x + S, y + S - d], [x + S - d, y + S], [x, y + S]], [r, r, sharp ? 0 : r, r, r, r]);
  // Each edge starts and ends on the outline's centerline: on a 135° corner rounded r, the line
  // through its vertex meets the arc 0.09 r inside it; on the 90° back corner, the diagonal meets
  // it at k from both sides
  const [k, e] = [sharp ? 0 : r * (1 - Math.SQRT1_2), r * (1 - Math.sqrt(1 - Math.tan(Math.PI / 8) ** 2))];
  const edges = [rline([[x + e, y + d], [x + S - d, y + d], [x + S - k, y + k]]), vl(x + S - d, y + d, y + S - e)];
  return { outline, edges, center: [x + (S - d) / 2, y + d + (S - d) / 2], box: [x, y, S] };
}
/** The model: the cube on the square keyline with the sparkle in its front face. */
const MODEL = (() => {
  const c = cube(3.25, 3.25, 17.5, 4.25);
  return { d: [c.outline, ...c.edges, spark(...c.center)], ...c };
})();
/**
 * The model under a badge: the cube at 14.75 from the top left corner (as comunicacion's person
 * moves aside for its badge), so the sparkle keeps its size clear of the badge's clearance. 14.75
 * with a depth of 3.5 is a size where every badge, the lock's square one too, cuts the cube's edges
 * the same way at every weight (14.25 left the lock's fill joined at light and split at bold).
 */
const MODEL_B = (() => {
  const c = cube(3.25, 3.25, 14.75, 3.5);
  return { d: [c.outline, ...c.edges, spark(...c.center)], ...c };
})();
/** A small cube on its own (no sparkle: it has no room), `S` across from (x, y). */
const smallCube = (x, y, S, d = 2.75, r = 1) => {
  const c = cube(x, y, S, d, r);
  return [c.outline, ...c.edges];
};

/** An up-down chevron pair (a picker's handle) centered on (cx, cy). */
const updown = (cx, cy, w = 3, h = 1.5, gap = 3) => [
  line([cx - w / 2, cy - gap / 2], [cx, cy - gap / 2 - h], [cx + w / 2, cy - gap / 2]),
  line([cx - w / 2, cy + gap / 2], [cx, cy + gap / 2 + h], [cx + w / 2, cy + gap / 2]),
];

// The bell curve of datos' chart-distribution: a smooth hump `w` wide and `h` tall on `base`.
function bell(cx, base, w, h) {
  const k = w / 2;
  return `M${P([cx - k, base])}C${P([cx - k * 0.45, base])} ${P([cx - k * 0.4, base - h])} ${P([cx, base - h])}C${P([cx + k * 0.4, base - h])} ${P([cx + k * 0.45, base])} ${P([cx + k, base])}`;
}

/** A smooth curve through points (Catmull-Rom tangents, as cubic Béziers). */
function smooth(pts, k = 1 / 6) {
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b, c, d] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    o += `C${P([b[0] + (c[0] - a[0]) * k, b[1] + (c[1] - a[1]) * k])} ${P([c[0] - (d[0] - b[0]) * k, c[1] - (d[1] - b[1]) * k])} ${P(c)}`;
  }
  return o;
}
/** Line between two circular nodes of radius r1 and r2: it touches their borders without going in. */
function edge(p, q, r1, r2 = r1) {
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const L = Math.hypot(dx, dy);
  return line([p[0] + (dx / L) * r1, p[1] + (dy / L) * r1], [q[0] - (dx / L) * r2, q[1] - (dy / L) * r2]);
}
/** A circular arc from p to q that bulges `h` upward (above the chord), or downward when h < 0. */
function hop(p, q, h) {
  const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
  const a = Math.abs(h);
  const R = (c * c + a * a) / (2 * a);
  return `M${P(p)}A${f(R)} ${f(R)} 0 ${a > c ? 1 : 0} ${(q[0] > p[0]) === h > 0 ? 1 : 0} ${P(q)}`;
}
/**
 * A pencil with the engine's `edit` glyph proportions (body 3 wide, a 2.6 cone, the band 2.4 from
 * its rounded end): its tip at `tip`, its body running `len` along `dir`.
 */
function pencil(tip, dir, len = 10.5, hw = 1.5) {
  const n = Math.hypot(dir[0], dir[1]);
  const u = [dir[0] / n, dir[1] / n];
  const v = [-u[1], u[0]];
  const at = (s, o) => [tip[0] + s * u[0] + o * v[0], tip[1] + s * u[1] + o * v[1]];
  const R = halfChord(at(len, -hw), at(len, hw));
  const body = `M${P(tip)}L${P(at(2.6, -hw))}L${P(at(len, -hw))}A${R} ${R} 0 0 ${u[0] * v[1] - u[1] * v[0] > 0 ? 0 : 1} ${P(at(len, hw))}L${P(at(2.6, hw))}Z`;
  return { body, band: line(at(len - 2.4, -hw), at(len - 2.4, hw)) };
}
/** The set's five-point star (edicion's `star`), R from its center to the tips. */
const STAR = edicion.icons.star.d[0];
const starAt = (cx, cy, R) => place(STAR, R / 7.1, [12, 12.4], [cx, cy]);
/** The dataset: three cards stacked 3 apart, the front one holding a grid of small dots (its rows). */
const DATASET = (() => {
  const front = box(3.25, 9.25, 11.5, 11.5, 3);
  const mid = box(6.25, 6.25, 11.5, 11.5, 3);
  const back = box(9.25, 3.25, 11.5, 11.5, 3);
  // Three rows of two dots, 3.25 apart: under a badge each dot is either well inside its clearance
  // (8.3 from its center at regular, 7.65 at light, 8.95 at bold) or well outside it, so the same
  // four stay at every weight (two rows of three lost a dot at some weights only)
  return [front, behind(mid, [front]), behind(back, [front, mid]), ...[11.75, 15, 18.25].flatMap((y) => [6.75, 10].map((x) => dot(x, y, 0.3)))];
})();
/** Horizontal capsule (semicircular ends). */
function pill(x, y, w, h) {
  const r = h / 2;
  return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
}
/** A wave along y from x0 to x1: `n` half periods of amplitude `a`, starting upward. */
function wave(x0, x1, y, a, n) {
  const w = (x1 - x0) / n;
  let o = `M${P([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const [xa, xb] = [x0 + i * w, x0 + (i + 1) * w];
    o += `C${P([xa + w * 0.36, y + s * a * 1.33])} ${P([xb - w * 0.36, y + s * a * 1.33])} ${P([xb, y])}`;
  }
  return o;
}
// The prompt: datos' field (19 × 12, radius 4, the signature) with the sparkle where the text starts.
const FIELD = box(2.5, 6, 19, 12, 4);
const PROMPT = [FIELD, spark(7.5, 12)];
/** Núcleo's database, exact: the band, the body and the lid. */
const DB = N.database.d;
const DB_RIM = 'M20.4 6.1c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3';
// People and agents: Núcleo's person, scaled from its feet (social's personAt: the head rises to keep
// 2.35 from the shoulders). The agent is the same shoulders with the sparkle as its head, 2.45 above
// them as Núcleo's head is: the large sparkle on a full bust, the small one on a bust at ~0.75.
const PERSON = N.person.d;
const personAt = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};
/** The agent: Núcleo's shoulders scaled `s` from the feet and the sparkle (R) 2.45 above them. */
const agentAt = (s, dx = 0, dy = 0, R = s < 0.9 ? RS : RL) => {
  const shoulders = place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy]);
  const top = 20.6 + dy - 7 * s;
  return [shoulders, spark(12 + dx, top - 2.45 - R, R)];
};
const AGENT = agentAt(1);
/** The center of the agent's head (its sparkle). */
const AGENT_TOP = 20.6 - 7 - 2.45 - RL;
/** The agent moved aside for a corner badge, as comunicacion's person-plus. */
const AGENT_B = agentAt(1, -2.5);
/** datos' brain, exact: the two hemispheres, the middle line and the folds. */
const BRAIN = datos.icons.brain.d;

/** Ellipse turned `deg` degrees around its center. */
function rell(cx, cy, rx, ry, deg) {
  const p0 = rot([cx - rx, cy], [cx, cy], deg);
  const p1 = rot([cx + rx, cy], [cx, cy], deg);
  return `M${P(p0)}A${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${P(p1)}A${f(rx)} ${f(ry)} ${f(deg)} 1 0 ${P(p0)}Z`;
}
/** The points of a closed shape, every ~0.1 (all its subpaths). */
const ringOf = (d) => samples(d).flat();
const distTo = (pts, p) => Math.min(...pts.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1])));
/** The point on p → q where it comes `gap` from `shape` (center to center): an arrow stops there. */
function stopBefore(shape, p, q, gap = 3) {
  const pts = ringOf(shape);
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  let last = p;
  for (let t = 0; t <= L; t += 0.02) {
    const x = [p[0] + ((q[0] - p[0]) * t) / L, p[1] + ((q[1] - p[1]) * t) / L];
    if (distTo(pts, x) < gap) return last;
    last = x;
  }
  return q;
}
/**
 * A path `gap` away from closed shapes all around them (center to center), traced from the point
 * `c` every `step` degrees between a0 and a1 and kept above `yMax`: a selection hugging a subject.
 */
function around(shapes, gap, c, a0, a1, yMax, step = 6) {
  const rings = shapes.flatMap(samples);
  const pts = rings.flat();
  const dist = (p) => (rings.some((r) => inPoly(r, p)) ? 0 : distTo(pts, p));
  const out = [];
  for (let a = a0; a <= a1 + 1e-9; a += step) {
    let r = 0;
    while (dist(polar(...c, r, a)) < gap) r += 0.05;
    out.push(polar(...c, r, a));
  }
  return clip(smooth(out), (p) => p[1] <= yMax);
}

// ── Pictures, scans and frames ────────────────────────────────────────────────────────────────
/**
 * A picture: a frame with the signature and a peak at 45° that rises from the bottom left corner
 * (where the diagonal meets the rounded corner) and comes down to the bottom right one, or to the
 * bottom edge when the frame is wider than tall.
 */
function pic(x, y, w, h, r) {
  const frame = box(x, y, w, h, r);
  const a = Math.min(w / 2, h * 0.55);
  const off = (p) => Math.abs(p[0] - x - (y + h - p[1]));
  const s = ringOf(frame)
    .filter(([px, py]) => px < x + r * 1.8 && py > y + h - r * 1.8)
    .reduce((b, p) => (off(p) < off(b) ? p : b));
  return [frame, line(s, [x + a, y + h - a], 2 * a >= w - 0.01 ? [x + w, y + h] : [x + 2 * a, y + h])];
}
/** A play triangle centered on (cx, cy). */
const play = (cx, cy, k = 1) => roundpoly([[cx - 1.4 * k, cy - 1.9 * k], [cx + 2 * k, cy], [cx - 1.4 * k, cy + 1.9 * k]], 0.6 * k);
/** Vertical bars: [x, top, bottom] each (a sound wave). */
const bars = (spec) => spec.map(([x, y0, y1]) => vl(x, y0, y1));
/** sistema's scan corners (the four brackets of a viewfinder), exact. */
const SCAN = sistema.icons.scan.d[0];

// ── From one thing to another ─────────────────────────────────────────────────────────────────
// The text-to-X family (and retrieval, parsing, recognition): the source at the upper left, a
// quarter arc that leaves it to the right and turns down, and the result at the lower right, in a
// box of 8.5 (12.75–21.25 × 12.25–21.25). One arc and one set of sources, so the family matches.
const FLOW = (() => {
  const a = arc(13.5, 9, 3.5, -90, 0);
  return [a.d, head(a.end, a.tangent, 3)];
})();
/** The handoff: an arc arrow that leaps from one figure on the left to the one on the right. */
const HANDOFF = (() => {
  const a = hop([6, 8], [18, 8], 4.25);
  const s = parse(a)[0].segs[0];
  const [end, before] = [pt(s, 1), pt(s, 0.98)];
  return [a, head(end, [end[0] - before[0], end[1] - before[1]], 3)];
})();
const SRC = {
  text: [hl(2.75, 10.5, 5.5), hl(2.75, 7.25, 9)],
  page: [box(2.5, 2.75, 8, 10, 2.5), hl(5.5, 7.5, 6.25), hl(5.5, 7.5, 9.25)],
  picture: pic(2.5, 2.75, 8, 8, 2.25),
  wave: bars([[3.25, 5, 9.5], [6.25, 2.75, 11.75], [9.25, 4.5, 10]]),
};
const OUT = {
  picture: pic(12.75, 12.75, 8.5, 8.5, 2.25),
  video: [box(12.75, 12.75, 8.5, 8.5, 2.25), play(16.75, 17)],
  wave: bars([[14, 15, 18.5], [17, 12.25, 21.25], [20, 14, 19.5]]),
  note: [rell(15.85, 18.6, 2.4, 1.75, -24), vl(18.05, 18.1, 12.5), 'M18.05 12.5C18.05 14 20.5 14 20.5 15.75'],
  database: ['M12.75 14v5.5A4.25 1.5 0 0 0 21.25 19.5V14', 'M12.75 14A4.25 1.5 0 1 0 21.25 14A4.25 1.5 0 1 0 12.75 14Z'],
  text: [hl(12.75, 21.25, 15), hl(12.75, 17.75, 18.5)],
  braces: datos.icons.braces.d.map((d) => place(d, 0.5, [12, 12], [17, 16.75])),
  // edicion's brush at 62 % (at 55 % its ferrule closed up at bold)
  brush: edicion.icons.brush.d.map((d) => place(d, 0.62, [11.28, 12.72], [16.9, 16.75])),
};
/** Núcleo's magnifier, exact: the lens (r 6.85 at 10.6, 10.6) and the handle. */
const LENS = N.search.d;

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------
const icons = {
  // Models -------------------------------------------------------------------------------------
  model: {
    tags: ['modelo', 'modelo de ia', 'llm', 'ai model', 'model'],
    d: MODEL.d,
  },
  'model-card': {
    tags: ['ficha del modelo', 'documentación del modelo', 'licencia', 'model card', 'model docs'],
    // comunicacion's id-card with the cube where the person is
    d: [box(2.5, 5, 19, 14, 3.5), ...smallCube(5.5, 8.5, 7), hl(15.5, 18.5, 10.5), hl(15.5, 17.5, 13.5)],
  },
  'model-picker': {
    tags: ['selector de modelo', 'elegir modelo', 'cambiar modelo', 'model picker', 'model selector'],
    // controles' field with the cube at its start and the picker's up-down handle at its end
    d: [box(2.5, 6, 19, 12, 3.5), ...smallCube(5.5, 8.75, 6.5, 2.5), ...updown(17, 12)],
  },
  'model-compare': {
    tags: ['comparar modelos', 'arena', 'prueba a/b', 'compare models', 'model arena'],
    d: [...smallCube(2.5, 8.75, 6.5, 2.5), ...smallCube(15, 8.75, 6.5, 2.5), dashes(vl(12, 3.25, 20.75), 4)],
  },
  'model-training': {
    tags: ['entrenamiento', 'entrenar modelo', 'ejecución', 'model training', 'training run'],
    // datos' automation cycle around the cube
    d: (() => {
      const a = arc(12, 12, 9, -60, 240);
      return [a.d, head(a.end, a.tangent, 3.4), ...smallCube(7.75, 7.75, 8.5, 3)];
    })(),
  },
  'model-fine-tune': {
    tags: ['ajuste fino', 'afinar modelo', 'datos propios', 'fine-tune', 'fine-tuning'],
    d: MODEL_B.d,
    // A tuning knob: a ring with its pointer
    badge: (() => {
      const ring = RING;
      const tick = line(polar(...BC, 0.6, -45), polar(...BC, 2.75, -45));
      return own([ring, tick], RING, { solid: [ring], cut: [tick] });
    })(),
  },
  'model-distillation': {
    tags: ['destilación', 'modelo pequeño', 'comprimir modelo', 'distillation', 'small model'],
    d: [...smallCube(2.75, 2.75, 11.5, 3.5, 1.25), rline([[14.25, 6.5], [19, 6.5], [19, 11]], 2), head([19, 11], [0, 1], 2.5), ...smallCube(14.5, 14.25, 7, 2.5)],
  },
  'model-routing': {
    tags: ['enrutador de modelos', 'gateway de ia', 'enrutar', 'model router', 'ai gateway'],
    d: (() => {
      const s = spark(9.25, 12);
      const o = [12, 12];
      return [
        hl(2.75, 6.5, 12),
        s,
        rline([o, [14.5, 12], [17.5, 5.5], [20.75, 5.5]], 2),
        head([20.75, 5.5], [1, 0], 2.25),
        hl(12, 20.75, 12),
        head([20.75, 12], [1, 0], 2.25),
        rline([o, [14.5, 12], [17.5, 18.5], [20.75, 18.5]], 2),
        head([20.75, 18.5], [1, 0], 2.25),
      ];
    })(),
  },
  'model-checkpoint': {
    tags: ['punto de control', 'guardar estado', 'reanudar', 'checkpoint', 'model snapshot'],
    // A pennant planted on the cube's back corner: the pole carries the cube's back edge up, so
    // nothing crosses the cube and nothing is cut (as a badge it chopped the top into fragments)
    d: (() => {
      const c = cube(3.25, 7.75, 13, 3.25, 1.25, { sharp: true });
      const pole = vl(16.25, 7.75, 2.75);
      const pennant = roundpoly([[16.25, 2.75], [21.25, 4.75], [16.25, 6.75]], [0, 0.9, 0]);
      return [c.outline, ...c.edges, spark(...c.center), pole, pennant];
    })(),
  },
  'model-drift': {
    tags: ['deriva del modelo', 'monitoreo', 'cambio de datos', 'model drift', 'data drift'],
    // The live curve passes behind the training one (cut 3 from it), so its dashes never pile up on
    // the crossing; the arrow runs from one peak to the other
    d: (() => {
      const train = bell(7.25, 19.5, 10, 10);
      const live = behind(bell(16.75, 19.5, 10, 10), [shut(train)]);
      return [train, dashes(live, 5, { gap: 2.75 }), hl(2.5, 21.5, 19.5), ...arrow([8.25, 5.25], [15.75, 5.25], 2.25)];
    })(),
  },
  'inference': {
    tags: ['inferencia', 'ejecutar modelo', 'endpoint', 'inference', 'model call'],
    d: [hl(2.5, 6.25, 13.5), ...smallCube(6.25, 7, 10, 3.25, 1.25), hl(16.25, 21.25, 13.5), head([21.25, 13.5], [1, 0], 2.25)],
  },
  'quantization': {
    tags: ['cuantización', 'comprimir pesos', 'bits', 'quantization', 'compression'],
    // The staircase's noses on the curve: three steps of 6, rising 6, 5 and 4
    d: [smooth([[3, 19.5], [9, 13.5], [15, 8.5], [21, 4.5]]), line([3, 19.5], [9, 19.5], [9, 13.5], [15, 13.5], [15, 8.5], [21, 8.5], [21, 4.5])],
  },
  'multimodal': {
    tags: ['multimodal', 'texto imagen y audio', 'entradas', 'multimodal', 'vision and voice'],
    d: [
      hl(2.75, 7.25, 5.75),
      wave(2.75, 7.25, 12, 1.1, 2),
      sq(2.75, 16, 4.5, 4.5, 1.25),
      'M10.25 4.25a1.5 1.5 0 0 1 1.5 1.5v4.75a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 0 -1.5 1.5v4.75a1.5 1.5 0 0 1 -1.5 1.5',
      spark(17.5, 12, RL),
    ],
  },
  'mixture-of-experts': {
    tags: ['mezcla de expertos', 'moe', 'enrutador', 'mixture of experts', 'sparse model'],
    // The routes stop 3 short of the experts (met at a slant, the filled boxes took them in differently
    // at each weight)
    d: (() => {
      const node = [4.75, 12];
      const r = 2;
      const boxes = [5, 12, 19].map((y) => sq(16.75, y - 2.25, 4.5, 4.5, 1.25));
      const to = (y, i) => {
        const a = polar(...node, r, (Math.atan2(y - 12, 16.75 - 4.75) * 180) / Math.PI);
        return line(a, stopBefore(boxes[i], a, [16.75, y]));
      };
      return [circ(...node, r), ...boxes, dashes(to(5, 0), 3, { gap: 2.75 }), to(12, 1), dashes(to(19, 2), 3, { gap: 2.75 })];
    })(),
  },
  'model-check': { tags: ['modelo verificado', 'evaluación aprobada', 'listo', 'model verified', 'model passed'], d: MODEL_B.d, badge: badge('check') },
  'model-download': { tags: ['descargar modelo', 'pesos', 'ejecutar local', 'download model', 'model weights'], d: MODEL_B.d, badge: badge('arrow-down') },
  'model-plus': { tags: ['agregar modelo', 'proveedor', 'nuevo modelo', 'add model', 'model provider'], d: MODEL_B.d, badge: badge('plus') },
  'model-alert': { tags: ['modelo con fallas', 'degradado', 'obsoleto', 'model alert', 'deprecated model'], d: MODEL_B.d, badge: badge('alert') },
  'model-lock': { tags: ['modelo privado', 'restringido', 'plan', 'locked model', 'private model'], d: MODEL_B.d, badge: badge('lock') },
  // Neural networks and learning ----------------------------------------------------------------
  'brain-circuit': {
    tags: ['inteligencia artificial', 'cerebro digital', 'aprendizaje automático', 'machine intelligence', 'ai brain'],
    // datos' brain with two circuit traces off the middle line in place of its folds, each ending in a
    // pad well inside its hemisphere (pads beside the lobes' notches merged with them at bold)
    d: [BRAIN[0], BRAIN[1], BRAIN[2], rline([[12, 15.5], [10.5, 15.5], [8.5, 13.5]], 0.75), dot(8, 13), rline([[12, 8.5], [13.5, 8.5], [15.5, 10.5]], 0.75), dot(16, 11)],
  },
  'brain-clock': {
    tags: ['memoria', 'recuerdos del asistente', 'historial', 'memory', 'assistant memory'],
    d: BRAIN,
    badge: badge('clock'),
  },
  'perceptron': {
    tags: ['perceptrón', 'neurona artificial', 'pesos', 'perceptron', 'artificial neuron'],
    d: (() => {
      const c = [13, 12];
      const r = 3.25;
      return [circ(...c, r), ...[[3, 5], [3, 12], [3, 19]].map((p) => edge(p, c, 0, r)), hl(c[0] + r, 21.25, 12), head([21.25, 12], [1, 0], 3)];
    })(),
  },
  'self-attention': {
    tags: ['atención', 'transformer', 'tokens', 'self-attention', 'attention'],
    // The query token (a ring) and the other tokens (dots); its attention leaps to each of them from
    // its own point on the ring: to the near ones by low hops, to the far one by a half circle over
    // them, so no two arcs share a start or run side by side
    d: (() => {
      const y = 16.5;
      const Q = [8.75, y];
      const T = [3.5, 14.25, 20.25];
      const from = (a) => polar(...Q, 2.25, a);
      const to = (x) => [x, y - 0.7];
      return [circ(...Q, 2.25), ...T.map((x) => dot(x, y)), hop(from(-150), to(T[0]), 1.6), hop(from(-35), to(T[1]), 1.9), hop(from(-95), to(T[2]), 6.25)];
    })(),
  },
  'backpropagation': {
    tags: ['retropropagación', 'error hacia atrás', 'gradientes', 'backpropagation', 'backprop'],
    d: (() => {
      const N = [[4.5, 8], [12, 8], [19.5, 8]];
      const r = 2;
      return [
        ...N.map((p) => circ(...p, r)),
        edge(N[0], N[1], r),
        edge(N[1], N[2], r),
        rline([[19.5, 13], [19.5, 18.5], [4.5, 18.5], [4.5, 13]], 3),
        head([4.5, 13], [0, -1], 3),
      ];
    })(),
  },
  'gradient-descent': {
    tags: ['descenso de gradiente', 'optimización', 'pérdida mínima', 'gradient descent', 'optimizer'],
    d: [
      'M2.75 4.5C5 14.5 8 19.75 12 19.75S19 14.5 21.25 4.5',
      circ(6.34, 9.25, 2.25),
      ...arrow([10.25, 13.25], [12.25, 16], 2.25),
    ],
  },
  'activation-function': {
    tags: ['función de activación', 'sigmoide', 'neurona', 'activation function', 'sigmoid'],
    d: ['M3 18.5C11.5 18.5 12.5 5.5 21 5.5', hl(2.75, 21.25, 12)],
  },
  'autoencoder': {
    tags: ['autoencoder', 'codificador', 'compresión', 'encoder decoder', 'latent space'],
    d: [
      roundpoly([[2.75, 3.75], [8.75, 8.5], [8.75, 15.5], [2.75, 20.25]], [1.5, 1, 1, 1.5]),
      roundpoly([[21.25, 3.75], [21.25, 20.25], [15.25, 15.5], [15.25, 8.5]], [1.5, 1.5, 1, 1]),
      dot(12, 12),
    ],
  },
  'convolution': {
    tags: ['convolución', 'kernel', 'red convolucional', 'convolution', 'cnn'],
    // The kernel (a frame) over the top left 2 × 2 of a 3 × 3 grid of pixels
    d: [sq(2.25, 2.25, 13, 13, 3.5), ...[5.5, 12, 18.5].flatMap((y) => [5.5, 12, 18.5].map((x) => dot(x, y)))],
  },
  'loss-curve': {
    tags: ['curva de pérdida', 'entrenamiento', 'épocas', 'loss curve', 'training loss'],
    d: [line([3.25, 3.25], [3.25, 20.75], [20.75, 20.75]), 'M7 4.75C8.5 12.5 11 16.75 20.25 17.25'],
  },
  'roc-curve': {
    tags: ['curva roc', 'clasificador', 'auc', 'roc curve', 'classifier metric'],
    d: [box(3.25, 3.25, 17.5, 17.5, 4), dashes(line([7, 17], [17, 7]), 3), 'M7 17C7 10.5 10.5 7 17 7'],
  },
  'classification': {
    tags: ['clasificación', 'categorías', 'etiquetar', 'classification', 'classifier'],
    d: (() => {
      const o = [3.5, 12];
      const C = [17.5, 6.5];
      const tri = roundpoly([[17.5, 14.25], [21.25, 20.5], [13.75, 20.5]], 1);
      return [dot(...o), rline([[4.2, 12], [8.5, 12], polar(...C, 3.25, 160)], 2), circ(...C, 3.25), rline([[4.2, 12], [8.5, 12], [15.63, 17.38]], 2), tri];
    })(),
  },
  'anomaly-detection': {
    tags: ['detección de anomalías', 'valor atípico', 'fraude', 'anomaly detection', 'outlier'],
    // A tight cluster (a hexagon of dots around one, 4.5 apart) and the outlier far from it, circled
    d: [
      ...[[8, 16.65], [12.5, 16.65], [10.25, 20.55], [5.75, 20.55], [3.5, 16.65], [5.75, 12.75], [10.25, 12.75]].map((p) => dot(...p)),
      circ(17.25, 6.5, 3.75),
      dot(17.25, 6.5),
    ],
  },
  'reinforcement-learning': {
    tags: ['aprendizaje por refuerzo', 'recompensa', 'agente', 'reinforcement learning', 'reward'],
    d: (() => {
      const top = arc(12, 12, 8.5, 230, 310);
      const bottom = arc(12, 12, 8.5, 50, 130);
      return [spark(4.5, 12), starAt(18.75, 12, 3.25), top.d, head(top.end, top.tangent, 3), bottom.d, head(bottom.end, bottom.tangent, 3)];
    })(),
  },
  'federated-learning': {
    tags: ['aprendizaje federado', 'dispositivos', 'privacidad', 'federated learning', 'on-device'],
    // Three devices send their updates up into the one shared model, their arrows converging on the
    // cube and stopping 3 short of it. On a ring around the cube there was no room for an arrow
    // between a device and the model: the heads ran into the cube.
    d: (() => {
      const c = cube(7.5, 2.75, 9, 2.75);
      const send = (from, tip) => {
        const u = [tip[0] - from[0], tip[1] - from[1]];
        const n = Math.hypot(...u);
        return [dot(...from), ...arrow([from[0] + (u[0] / n) * 0.7, from[1] + (u[1] / n) * 0.7], tip, 2.25)];
      };
      return [c.outline, ...c.edges, ...send([3.5, 20.75], [7, 14.75]), ...send([12, 20.75], [12, 14.75]), ...send([20.5, 20.75], [17, 14.75])];
    })(),
  },

  // Datasets -----------------------------------------------------------------------------------
  'dataset': {
    tags: ['conjunto de datos', 'dataset', 'datos de entrenamiento', 'training data', 'eval set'],
    d: DATASET,
  },
  'dataset-plus': {
    tags: ['agregar datos', 'fuente de conocimiento', 'subir archivos', 'add data', 'knowledge source'],
    d: DATASET,
    badge: badge('plus'),
  },
  'dataset-check': {
    tags: ['datos validados', 'dataset listo', 'verificado', 'validated dataset', 'dataset ready'],
    d: DATASET,
    badge: badge('check'),
  },
  'data-labeling': {
    tags: ['etiquetado', 'anotar', 'caja delimitadora', 'data labeling', 'annotation'],
    // The dashed box is left open at its last corner, where the pencil's tip is drawing it (a pencil laid
    // over a closed box cut its dashes into pieces that came and went with the weight). The pencil is
    // the edit badge's, without its band: at light the band split the body
    d: (() => {
      const frame = clip(box(3.25, 3.25, 17.5, 17.5, 4), (p) => !(p[0] > 14.25 && p[1] > 14.25));
      return [dashes(frame, 7), pencil([20.75, 20.75], [-1, -1]).body];
    })(),
  },
  'data-augmentation': {
    tags: ['aumento de datos', 'variaciones', 'transformar ejemplos', 'data augmentation', 'augmented data'],
    // The from-one-thing-to-another family: a sample picture becomes a new one, turned (a copy
    // fanned behind the sample showed only two corners, like ears)
    d: [...SRC.picture, ...FLOW, ...OUT.picture.map((d) => turnPath(d, -15, [17, 17]))],
  },
  'synthetic-data': {
    tags: ['datos sintéticos', 'datos generados', 'simulados', 'synthetic data', 'generated data'],
    d: [...[5.5, 12, 18.5].flatMap((y) => [5.5, 12, 18.5].filter((x) => x !== 12 || y !== 12).map((x) => dot(x, y))), spark(12, 12)],
  },

  // Embeddings and retrieval ---------------------------------------------------------------------
  'embedding': {
    tags: ['embedding', 'vector', 'representación', 'embeddings', 'vectorize'],
    // A word (the pill) turned into a vector: three values between brackets
    d: [
      pill(2.5, 10, 4.5, 4),
      ...arrow([10, 12], [12.5, 12], 2.25),
      rline([[16.75, 4.75], [15.5, 4.75], [15.5, 19.25], [16.75, 19.25]], 1),
      rline([[20.25, 4.75], [21.5, 4.75], [21.5, 19.25], [20.25, 19.25]], 1),
      ...[8.25, 12, 15.75].map((y) => dot(18.5, y)),
    ],
  },
  'vector-space': {
    tags: ['espacio vectorial', 'proyección', 'coordenadas', 'vector space', 'embedding space'],
    // The two vectors split the corner in thirds (at 60° and 30°): narrower wedges against the axes
    // filled in differently from one weight to another
    d: (() => {
      const O = [3.25, 20.75];
      const v = (a, r) => [line(O, polar(...O, r - 0.7, -a)), dot(...polar(...O, r, -a))];
      return [line([3.25, 3.25], O, [20.75, 20.75]), ...v(60, 14.5), ...v(30, 15)];
    })(),
  },
  'database-vector': {
    tags: ['base de datos vectorial', 'almacén de vectores', 'embeddings', 'vector database', 'vector store'],
    // Núcleo's database without its band: a vector on its front (a point and an arrow)
    d: [DB[1], DB[2], dot(8.75, 16.75), ...arrow([9.35, 16.15], [14.75, 12.75], 2.5)],
  },
  'nearest-neighbors': {
    tags: ['vecinos cercanos', 'búsqueda por similitud', 'knn', 'nearest neighbors', 'similarity search'],
    d: [circ(10.75, 12.5, 7), dot(10.75, 12.5), dot(12.6, 9.25), dot(12.6, 15.75), dot(7, 12.5), dot(20.25, 4.5), dot(19.75, 20.25)],
  },
  'chunking': {
    tags: ['fragmentar', 'dividir documento', 'trozos', 'chunking', 'text splitting'],
    // The page broken across in three pieces, 1.5 of paper between them, each holding one line
    d: (() => {
      const page = box(4.75, 2.75, 14.5, 18.5, 2.75);
      const [a, b] = [8.875, 15.125];
      return [
        clip(page, (p) => p[1] <= a - 1.5),
        clip(page, (p) => p[1] >= a + 1.5 && p[1] <= b - 1.5),
        clip(page, (p) => p[1] >= b + 1.5),
        hl(8, 16, 5.75),
        hl(8, 16, 12),
        hl(8, 13, 18.25),
      ];
    })(),
  },
  'retrieval': {
    tags: ['recuperación', 'rag', 'buscar fuentes', 'retrieval', 'retrieval augmented generation'],
    // The from-one-thing-to-another family: a source page, its arc, and the sparkle that answers
    d: [...SRC.page, ...FLOW, spark(17, 16.75, RL)],
  },
  'rerank': {
    tags: ['reordenar', 'relevancia', 'ranking', 'rerank', 'reranking'],
    // The bottom row's arrow runs out, up and back to the top row, the sparkle on its way up (on a half
    // circle the head's arm ran into the arc)
    d: [hl(3, 9.5, 6.25), hl(3, 7, 12), hl(3, 9.5, 17.75), rline([[12.5, 17.75], [19.25, 17.75], [19.25, 6.25], [12.5, 6.25]], 2.5), head([12.5, 6.25], [-1, 0], 2.5)],
    badge: sparkOn(19.25, 12),
  },

  // Tokens and context ---------------------------------------------------------------------------
  'tokens': {
    tags: ['tokens', 'tokenizar', 'fragmentos de palabra', 'token count', 'tokenizer'],
    // Text split into word pieces: pills of different widths, two to a row, 3 apart
    d: [pill(2.5, 6.5, 7.5, 4), pill(13, 6.5, 8.5, 4), pill(2.5, 13.5, 10, 4), pill(15.5, 13.5, 6, 4)],
  },
  'token-limit': {
    tags: ['límite de tokens', 'máximo de contexto', 'tope', 'token limit', 'max tokens'],
    // The tokens' pills running into the limit
    d: [pill(2.75, 10, 6.5, 4), pill(12.25, 10, 5, 4), vl(20.25, 4.25, 19.75)],
  },
  'context-window': {
    tags: ['ventana de contexto', 'contexto', 'memoria de trabajo', 'context window', 'context length'],
    d: [sq(5.75, 8.25, 12.5, 7.5, 3), ...[2.85, 9, 12, 15, 21.15].map((x) => dot(x, 12, 0.3))],
  },
  'context-compression': {
    tags: ['compactar contexto', 'resumir historial', 'comprimir', 'context compression', 'compact'],
    d: [...arrow([2.5, 12], [6.5, 12], 2.25), hl(9.5, 14.5, 8.5), hl(9.5, 14.5, 12), hl(9.5, 14.5, 15.5), ...arrow([21.5, 12], [17.5, 12], 2.25)],
  },
  'sampling-temperature': {
    tags: ['temperatura', 'creatividad', 'aleatoriedad', 'temperature', 'sampling'],
    d: [hl(2.75, 6.25, 12), circ(9, 12, 2.5), wave(11.75, 21.25, 12, 1.75, 4)],
  },

  // Prompts ------------------------------------------------------------------------------------
  'prompt-gear': {
    tags: ['instrucciones del sistema', 'prompt del sistema', 'personalizar', 'system prompt', 'custom instructions'],
    d: PROMPT,
    badge: badge('gear'),
  },
  'prompt-edit': {
    tags: ['editar prompt', 'reenviar', 'corregir mensaje', 'edit prompt', 'resend'],
    d: PROMPT,
    badge: badge('edit'),
  },
  'prompt-template': {
    tags: ['plantilla de prompt', 'variables', 'reutilizable', 'prompt template', 'placeholder'],
    // The text is a blank to fill in: two dashes
    d: [...PROMPT, dashes(hl(13.1, 18.65, 12), 2, { gap: 2.25 })],
  },
  'prompt-library': {
    tags: ['biblioteca de prompts', 'prompts guardados', 'colección', 'prompt library', 'saved prompts'],
    d: (() => {
      const front = box(2.5, 9.25, 13, 11, 3.5);
      const mid = box(5.5, 6.25, 13, 11, 3.5);
      const back = box(8.5, 3.25, 13, 11, 3.5);
      return [front, behind(mid, [front]), behind(back, [front, mid]), spark(9, 14.75)];
    })(),
  },
  'prompt-image': {
    tags: ['prompt con imagen', 'adjuntar imagen', 'visión', 'image prompt', 'image input'],
    // The prompt (its field and sparkle) with a picture attached at its corner (a picture shrunk into the
    // field in place of the sparkle was mush at 18 px)
    d: PROMPT,
    badge: (() => {
      const [frame, peak] = pic(13.25, 13.25, 8, 8, 2.25);
      return own([frame, peak], frame, { solid: [frame], cut: [peak] });
    })(),
  },
  'prompt-chain': {
    tags: ['encadenar prompts', 'cadena', 'pasos', 'prompt chaining', 'chain'],
    d: [box(4.5, 3.25, 15, 6.5, 3), hl(7.75, 16.25, 6.5), ...arrow([12, 9.75], [12, 14.25], 2.25), box(4.5, 14.25, 15, 6.5, 3), hl(7.75, 12.75, 17.5)],
  },
  'prompt-injection': {
    tags: ['inyección de prompt', 'ataque', 'instrucciones ocultas', 'prompt injection', 'jailbreak'],
    d: PROMPT,
    badge: (() => {
      const [a, b] = arrow([21.25, 2.75], [13.75, 10.25], 3);
      return own([a, b], undefined, false);
    })(),
  },
  'prompt-suggestions': {
    tags: ['sugerencias', 'preguntas de seguimiento', 'ideas', 'suggested prompts', 'follow-ups'],
    d: [spark(5.25, 8), pill(10.25, 4.75, 11.25, 6.5), pill(2.5, 13.75, 13, 6.5)],
  },
  'structured-output': {
    tags: ['salida estructurada', 'json', 'esquema', 'structured output', 'json mode'],
    d: [...datos.icons.braces.d, spark(12, 12)],
  },
  // Agents -------------------------------------------------------------------------------------
  'agent': { tags: ['agente', 'agente de ia', 'autónomo', 'ai agent', 'agent'], d: AGENT },
  'agent-plus': { tags: ['nuevo agente', 'crear agente', 'agregar', 'new agent', 'create agent'], d: AGENT_B, badge: badge('plus') },
  'agent-gear': { tags: ['configurar agente', 'herramientas', 'permisos', 'agent settings', 'configure agent'], d: AGENT_B, badge: badge('gear') },
  'agent-clock': { tags: ['tarea programada', 'agente en segundo plano', 'agenda', 'scheduled agent', 'background task'], d: AGENT_B, badge: badge('clock') },
  'agent-check': { tags: ['tarea completada', 'agente listo', 'terminado', 'agent done', 'task complete'], d: AGENT_B, badge: badge('check') },
  'agent-question': { tags: ['agente esperando', 'aclaración', 'pregunta', 'agent waiting', 'needs input'], d: AGENT_B, badge: badge('question') },
  'agent-alert': { tags: ['agente con error', 'requiere atención', 'falla', 'agent error', 'needs attention'], d: AGENT_B, badge: badge('alert') },
  'agent-lock': { tags: ['permisos del agente', 'agente bloqueado', 'acceso', 'agent permissions', 'blocked agent'], d: AGENT_B, badge: badge('lock') },
  'multi-agent': {
    tags: ['varios agentes', 'sistema multiagente', 'colaboración', 'multi-agent', 'agent team'],
    d: (() => {
      const front = agentAt(0.76, -3.25);
      const back = agentAt(0.76, 4, -2.25);
      return [...front, behind(back[0], front), back[1]];
    })(),
  },
  'subagent': {
    tags: ['subagente', 'tarea delegada', 'agente secundario', 'subagent', 'child agent'],
    d: [spark(7.5, 7.25, RL), rline([[7.5, 11.5], [7.5, 17], [14.5, 17]], 3), spark(17.25, 17)],
  },
  'ai-teammate': {
    tags: ['compañero de ia', 'equipo con ia', 'colaborador', 'ai teammate', 'ai coworker'],
    d: (() => {
      const front = personAt(0.76, -3.25);
      const back = agentAt(0.76, 4, -2.25);
      return [...front, behind(back[0], front), back[1]];
    })(),
  },
  'agent-orchestration': {
    tags: ['orquestación', 'orquestador', 'delegar trabajo', 'agent orchestration', 'orchestrator'],
    d: [
      spark(12, 6.25, RL),
      vl(12, 10.5, 18.55),
      rline([[12, 14.25], [4.75, 14.25], [4.75, 18.55]], 2.5),
      rline([[12, 14.25], [19.25, 14.25], [19.25, 18.55]], 2.5),
      dot(4.75, 19.25),
      dot(12, 19.25),
      dot(19.25, 19.25),
    ],
  },
  'agent-handoff': {
    tags: ['traspaso entre agentes', 'delegar', 'pasar tarea', 'agent handoff', 'handover'],
    // One agent hands the task over to the other: an arc arrow leaps from one sparkle to the next
    // (a short straight arrow between them shrank to a blob at 18 px)
    d: [spark(6, 15.75, RL), ...HANDOFF, spark(18, 15.75, RL)],
  },
  'agent-workflow': {
    tags: ['flujo con ia', 'automatización', 'pasos', 'ai workflow', 'agentic workflow'],
    d: [circ(4.75, 12, 2.35), line([7.1, 12], [9.25, 12]), spark(12, 12), line([14.75, 12], [16.9, 12]), circ(19.25, 12, 2.35)],
  },
  'agent-plan': {
    tags: ['plan del agente', 'pasos a seguir', 'tareas', 'agent plan', 'plan mode'],
    // The agent (its sparkle) lays a dashed route down and across to the goal, a flag
    d: [spark(5.5, 5.5), dashes(rline([[5.5, 11.25], [5.5, 18.25], [13.25, 18.25]], 4), 3), vl(16.25, 20.75, 11.75), roundpoly([[16.25, 11.75], [20.75, 13.5], [16.25, 15.25]], [0, 0.8, 0])],
  },
  'tool-call': {
    tags: ['llamada a herramienta', 'function calling', 'herramientas', 'tool call', 'tool use'],
    // sistema's wrench, mirrored so its head sits top left and the sparkle has the free corner
    d: [flipPath(sistema.icons.wrench.d[0]), spark(18, 6)],
  },
  'agent-skill': {
    tags: ['habilidad', 'plugin', 'extensión del agente', 'agent skill', 'plugin'],
    d: [datos.icons.puzzle.d[0], spark(10.25, 13.75)],
  },
  'computer-use': {
    tags: ['uso de computadora', 'agente navegador', 'controlar pantalla', 'computer use', 'browser agent'],
    // dispositivos' desktop with the sparkle and the pointer on its screen, each 3 clear of the other and
    // of the frame (on ventanas' window there was no room for both: the pointer had to cut the frame,
    // and the pieces it left changed with the weight)
    d: [...dispositivos.icons.desktop.d, spark(8.25, 10.1), cursor([13.75, 6.35], 0.39)],
  },
  'deep-research': {
    tags: ['investigación profunda', 'muchas fuentes', 'informe', 'deep research', 'research agent'],
    d: (() => {
      // A fan of three pages: the middle one in front, the others turned 20° on their foot and cut where
      // they pass behind it (at 16° only their corners showed)
      const page = sq(6.5, 2.75, 9, 11.5, 2.5);
      return [page, behind(turnPath(page, -20, [11, 19]), [page]), behind(turnPath(page, 20, [11, 19]), [page])];
    })(),
    badge: (() => {
      const lens = circ(14.25, 14.25, 5.5);
      const handle = line(polar(14.25, 14.25, 5.5, 45), [21.25, 21.25]);
      const s = spark(14.25, 14.25);
      return own([lens, handle, s], `${lens}${line(polar(14.25, 14.25, 5.5, 45), [21.25, 21.25])}`, { solid: [lens], wire: [handle], cut: [s] });
    })(),
  },
  'human-in-the-loop': {
    tags: ['humano en el ciclo', 'revisión humana', 'aprobar pasos', 'human in the loop', 'human review'],
    d: (() => {
      const left = arc(12, 12, 9, 130, 230);
      const right = arc(12, 12, 9, -50, 50);
      return [...personAt(0.5, 0, -8.6), spark(12, 18.75), left.d, head(left.end, left.tangent, 3), right.d, head(right.end, right.tangent, 3)];
    })(),
  },
  'human-handoff': {
    tags: ['pasar a una persona', 'agente humano', 'escalar', 'human handoff', 'live agent'],
    d: [spark(6, 15.75, RL), ...HANDOFF, ...personAt(0.55, 6, 0.65)],
  },
  'robot-humanoid': {
    tags: ['robot humanoide', 'ia física', 'androide', 'humanoid robot', 'embodied ai'],
    // A robot's head (its antenna, its eyes) on Núcleo's shoulders: a body that stands like a person's
    // (a short torso box beside two bars read as a bench)
    d: [dot(12, 3.2), vl(12, 3.9, 6), box(7.25, 6, 9.5, 6, 2.5), dot(10.25, 9), dot(13.75, 9), place(PERSON[1], 0.9, [12, 20.6], [12, 20.6])],
  },

  // Assistants ---------------------------------------------------------------------------------
  'assistant-panel': {
    tags: ['panel del asistente', 'copiloto', 'barra lateral de ia', 'assistant panel', 'copilot sidebar'],
    d: [box(2.5, 5, 19, 14, 4), vl(10.25, 5, 19), spark(15.88, 12)],
  },
  'assistant-canvas': {
    tags: ['lienzo', 'documento con ia', 'artefacto', 'canvas', 'artifacts'],
    d: [drop(6.25, 13.5, 3.75), box(12.75, 2.75, 8.5, 18.5, 3), hl(15.75, 18.25, 7.75), hl(15.75, 18.25, 10.75)],
  },
  'conversation-branch': {
    tags: ['bifurcar conversación', 'rama del chat', 'nueva rama', 'branch chat', 'fork conversation'],
    // The bubble holding datos' git-branch: the conversation goes on, and a branch leaves it
    d: [N.comment.d[0], dot(9, 15.5), vl(9, 14.8, 8.6), 'M9 13.5C9 11.5 15 12.25 15 9.3', dot(15, 8.6), dot(9, 7.9)],
  },
  'inline-completion': {
    tags: ['autocompletar', 'sugerencia en línea', 'texto fantasma', 'inline completion', 'ghost text'],
    // What you typed, the caret, and the suggestion that follows it, dashed
    d: [hl(2.75, 8.25, 12), vl(11.25, 6.5, 17.5), dashes(hl(14.25, 21.25, 12), 2)],
  },
  'response-streaming': {
    tags: ['respuesta en curso', 'escribiendo', 'transmisión', 'streaming', 'generating'],
    d: [hl(3.25, 20.75, 6.75), hl(3.25, 20.75, 12), hl(3.25, 11, 17.25), dot(14.75, 17.25)],
  },
  'reasoning': {
    tags: ['razonamiento', 'pensando', 'modelo que piensa', 'reasoning', 'thinking'],
    d: [spark(12, 12, RL), dashes(circ(12, 12, 9), 10)],
  },
  'reasoning-effort': {
    tags: ['esfuerzo de razonamiento', 'nivel de pensamiento', 'alto medio bajo', 'reasoning effort', 'thinking level'],
    d: [vl(5, 16, 20.5), vl(10.75, 13.5, 20.5), vl(16.5, 11, 20.5), spark(16.5, 5.25)],
  },
  'chain-of-thought': {
    tags: ['cadena de pensamiento', 'paso a paso', 'razonamiento', 'chain of thought', 'step by step'],
    // A chain of thoughts: a trail of growing thought bubbles that ends in the sparkle (rings joined
    // by arrows read as the ♂ sign at 18 px)
    d: [dot(4, 20), circ(7.75, 16.25, 1.5), circ(12.5, 11.5, 2.25), spark(17.75, 6.25, RL)],
  },
  'regenerate': {
    tags: ['regenerar', 'otra respuesta', 'volver a generar', 'regenerate', 'retry'],
    // Núcleo's refresh, redrawn on its own circle with its head at the arc's end, around the large
    // sparkle (its own arrow left a notch at the head that broke the weights with anything inside)
    d: (() => {
      const a = arc(12, 12.45, 8.1, -38.3, 262);
      return [a.d, head(a.end, a.tangent, 3.6), spark(12, 12.45, RL)];
    })(),
  },
  'summarize': {
    tags: ['resumir', 'resumen', 'acortar texto', 'summarize', 'tl;dr'],
    d: [hl(3.25, 20.75, 3.5), hl(3.25, 20.75, 6.5), hl(3.25, 20.75, 9.5), ...arrow([12, 12.5], [12, 16.5], 2.25), hl(8, 16, 20.25)],
  },
  'elaborate': {
    tags: ['ampliar', 'desarrollar', 'alargar texto', 'elaborate', 'expand text'],
    d: [hl(8, 16, 3.75), ...arrow([12, 7.5], [12, 11.5], 2.25), hl(3.25, 20.75, 14.5), hl(3.25, 20.75, 17.5), hl(3.25, 20.75, 20.5)],
  },
  'voice-assistant': {
    tags: ['asistente de voz', 'modo de voz', 'hablar con la ia', 'voice assistant', 'voice mode'],
    d: [
      spark(12, 12, RL),
      arc(12, 12, 7.25, -30, 30).d,
      arc(12, 12, 7.25, 150, 210).d,
      arc(12, 12, 10.25, -28, 28).d,
      arc(12, 12, 10.25, 152, 208).d,
    ],
  },
  'smart-suggestion': {
    tags: ['sugerencia inteligente', 'idea', 'consejo de ia', 'smart suggestion', 'ai tip'],
    // sistema's lightbulb with the sparkle for a filament
    d: [...sistema.icons.lightbulb.d, spark(12, 8.75)],
  },

  // Generation: from one thing to another --------------------------------------------------------
  'text-to-image': {
    tags: ['texto a imagen', 'generar imagen', 'imagen con ia', 'text to image', 'image generation'],
    d: [...SRC.text, ...FLOW, ...OUT.picture],
  },
  'text-to-video': {
    tags: ['texto a video', 'generar video', 'video con ia', 'text to video', 'video generation'],
    d: [...SRC.text, ...FLOW, ...OUT.video],
  },
  'text-to-speech': {
    tags: ['texto a voz', 'leer en voz alta', 'voz sintética', 'text to speech', 'tts'],
    d: [...SRC.text, ...FLOW, ...OUT.wave],
  },
  'text-to-music': {
    tags: ['texto a música', 'generar música', 'sonido con ia', 'text to music', 'music generation'],
    d: [...SRC.text, ...FLOW, ...OUT.note],
  },
  'text-to-sql': {
    tags: ['texto a sql', 'consultar en lenguaje natural', 'preguntar a la base', 'text to sql', 'natural language query'],
    d: [...SRC.text, ...FLOW, ...OUT.database],
  },
  'image-to-video': {
    tags: ['imagen a video', 'animar imagen', 'video con ia', 'image to video', 'animate photo'],
    d: [...SRC.picture, ...FLOW, ...OUT.video],
  },
  'style-transfer': {
    tags: ['transferencia de estilo', 'cambiar estilo', 'reestilizar', 'style transfer', 'restyle'],
    d: [...SRC.picture, ...FLOW, ...OUT.brush],
  },
  'image-captioning': {
    tags: ['describir imagen', 'texto alternativo', 'pie de foto', 'image captioning', 'alt text'],
    d: [...pic(3.25, 3.25, 17.5, 10.5, 3.5), hl(3.25, 20.75, 17), hl(3.25, 14.75, 20.5)],
    badge: sparkOn(19, 4.75),
  },
  'speech-recognition': {
    tags: ['reconocimiento de voz', 'transcribir', 'voz a texto', 'speech recognition', 'speech to text'],
    d: [...SRC.wave, ...FLOW, ...OUT.text],
  },
  'voice-clone': {
    tags: ['clonar voz', 'voz sintética', 'copia de voz', 'voice clone', 'voice cloning'],
    // A head in profile, looking right, with the sparkle where its voice comes out, 3 clear of the mouth
    // (closer, the two fills joined at bold)
    d: [
      smooth([[5, 21], [4.75, 18], [2.25, 13.5], [2.25, 8.5], [5.25, 4.25], [9.5, 3], [12.75, 4.75], [13.75, 8.25], [15.25, 11.25], [13.75, 12.25], [14, 14], [12.75, 16.5], [10.25, 17.5], [10.25, 21]], 0.17),
      spark(19.5, 15.5),
    ],
  },
  'generative-fill': {
    tags: ['relleno generativo', 'borrar objeto', 'inpainting', 'generative fill', 'remove object'],
    d: [dashes(sq(3.25, 3.25, 17.5, 17.5, 4), 8), spark(12, 12, RL)],
  },
  'generative-expand': {
    tags: ['expansión generativa', 'ampliar imagen', 'outpainting', 'generative expand', 'extend image'],
    // The picture inside the canvas it grows into, dashed; the arrows clear their way through it
    d: [dashes(sq(2.75, 2.75, 18.5, 18.5, 4), 8), ...pic(8.5, 8.5, 7, 7, 2)],
    badge: (() => {
      const a = arrow([17, 7], [20, 4], 2.25);
      const b = a.map((d) => turnPath(d, 180));
      return own([...a, ...b]);
    })(),
  },
  'background-removal': {
    tags: ['quitar fondo', 'eliminar fondo', 'recortar sujeto', 'background removal', 'remove background'],
    // The subject in front of a transparent background (a sparse grid of dots)
    d: (() => {
      const person = personAt(0.72);
      const frame = box(2.5, 3.25, 19, 15, 3.5);
      const avoid = ringOf(person.join(''));
      const grid = [6.25, 9.25, 12.25, 15.25].flatMap((y) => [5.75, 8.75, 15.25, 18.25].map((x) => [x, y])).filter((p) => distTo(avoid, p) >= 2.95);
      return [...person, behind(frame, [person[1]]), ...grid.map((p) => dot(...p, 0.3))];
    })(),
  },
  'subject-select': {
    tags: ['seleccionar sujeto', 'selección automática', 'recorte', 'select subject', 'auto select'],
    d: (() => {
      const person = personAt(0.72, -1);
      return [...person, dashes(around(person, 3, [11, 13], -270, 90, 20.6), 9, { gap: 2.75 })];
    })(),
    badge: (() => {
      const s = spark(18.75, 5);
      return own([s], s, { solid: [s] });
    })(),
  },
  'upscale': {
    tags: ['aumentar resolución', 'escalar imagen', 'mejorar calidad', 'upscale', 'super resolution'],
    // A block of four pixels grows to the corner of the large square
    d: [box(3.25, 3.25, 17.5, 17.5, 4), dot(7.25, 13.5), dot(10.5, 13.5), dot(7.25, 16.75), dot(10.5, 16.75), ...arrow([13.75, 10.25], [17.5, 6.5], 3)],
  },
  'variations': {
    tags: ['variaciones', 'generar opciones', 'alternativas', 'variations', 'generate options'],
    // Núcleo's apps grid with the sparkle in place of the first square
    d: [spark(7, 7), sq(13.25, 3.25, 7.5, 7.5, 2.25), sq(3.25, 13.25, 7.5, 7.5, 2.25), box(13.25, 13.25, 7.5, 7.5, 2.25)],
  },
  'diffusion': {
    tags: ['difusión', 'modelo de difusión', 'del ruido a la imagen', 'diffusion', 'denoising'],
    // A circle that takes shape out of noise: its right half drawn, its left half still scattered dots
    d: [box(3.25, 3.25, 17.5, 17.5, 4), arc(12, 12, 5.5, -90, 90).d, ...[[225, 6], [180, 5.25], [135, 5.75]].map(([a, r]) => dot(...polar(12, 12, r, a))), dot(9.75, 10.5)],
  },

  // Computer vision -----------------------------------------------------------------------------
  'computer-vision': {
    tags: ['visión artificial', 'visión por computadora', 'ver imágenes', 'computer vision', 'machine vision'],
    d: [edicion.icons.eye.d[0], spark(12, 12)],
  },
  // Detection joins the set's scan family (sistema's corners around what they find): a box with a
  // label tab around a circle read as a camera, and around a person as an ID card
  'object-detection': {
    tags: ['detección de objetos', 'caja delimitadora', 'reconocer objetos', 'object detection', 'bounding box'],
    d: [SCAN, ...smallCube(7.75, 7.75, 8.5, 3, 1.25)],
  },
  'person-detection': {
    tags: ['detección de personas', 'reconocer personas', 'cámara', 'person detection', 'people detection'],
    d: [SCAN, ...personAt(0.6, 0, -2.6)],
  },
  'object-tracking': {
    tags: ['seguimiento de objetos', 'rastrear', 'video', 'object tracking', 'tracking'],
    // The scan corners locked on the object (a dot), its trail leading in from the lower left (a box
    // with a ring in it read as a camera app's logo)
    d: [place(SCAN, 0.66, [12, 12], [15, 9]), dot(15, 9), dot(3.5, 20.5), dot(6.25, 17.75)],
  },
  'segmentation': {
    tags: ['segmentación', 'regiones', 'máscara', 'segmentation', 'image mask'],
    d: (() => {
      const frame = box(3.25, 3.25, 17.5, 17.5, 4);
      const cut = smooth([[10, 3.25], [7, 9], [10, 15], [9, 20.75]]);
      const avoid = ringOf(cut);
      const spots = [7, 10.5, 14, 17.5].flatMap((y) => [12.5, 16, 18.25].map((x) => [x, y])).filter((p) => distTo(avoid, p) >= 2.95 && distTo(ringOf(frame), p) >= 2.75);
      return [frame, cut, ...spots.map((p) => dot(...p, 0.3))];
    })(),
  },
  'pose-estimation': {
    tags: ['estimación de pose', 'esqueleto', 'postura', 'pose estimation', 'body tracking'],
    d: [
      circ(12, 4.75, 2.25),
      line([5, 8.5], [8.25, 12.5], [12, 10], [15.75, 12.5], [19, 8.5]),
      vl(12, 10, 15),
      line([8.25, 21], [9.75, 17.75], [12, 15], [14.25, 17.75], [15.75, 21]),
      dot(8.25, 12.5),
      dot(15.75, 12.5),
      dot(9.75, 17.75),
      dot(14.25, 17.75),
    ],
  },
  'face-mesh': {
    tags: ['malla facial', 'puntos del rostro', 'seguimiento facial', 'face mesh', 'face landmarks'],
    d: (() => {
      const [E1, E2, Nz, M1, M2] = [[8.5, 9.5], [15.5, 9.5], [12, 13.25], [9.5, 16.25], [14.5, 16.25]];
      const link = (p, q) => edge(p, q, 0.7);
      // The eyes and the nose a triangle, the mouth a smile between its corners
      return [rell(12, 12, 7.5, 9, 0), ...[E1, E2, Nz, M1, M2].map((p) => dot(...p)), link(E1, E2), link(E1, Nz), link(E2, Nz), `M${P(M1)}A2.83 2.83 0 0 0 ${P(M2)}`];
    })(),
  },
  'hand-tracking': {
    tags: ['seguimiento de manos', 'gestos', 'mano', 'hand tracking', 'gesture recognition'],
    // A hand's skeleton: the palm, four fingers 3 apart where they leave it, fanning a little to their
    // tips, and the thumb off its side (five lines fanned from a round palm read as a frog's foot)
    d: (() => {
      const palm = sq(6, 12.75, 12, 8, 2.5);
      const rim = ringOf(palm).filter((p) => p[1] < 16);
      const on = (x) => rim.reduce((b, p) => (Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b));
      const fingers = [7.5, 10.5, 13.5, 16.5].flatMap((x, i) => {
        const tip = [x + (x - 12) * 0.35, [6.75, 4.25, 4.25, 6.75][i]];
        return [edge(on(x), tip, 0, 0.7), dot(...tip)];
      });
      return [palm, ...fingers, edge([6, 15.75], [3.5, 11.75], 0, 0.7), dot(3.5, 11.75)];
    })(),
    // At 16 px the fingertips' dots, 2 px apart, ran into one block: the fingers alone, on the pixel grid
    small: (() => {
      const palm = sq(6.75, 12.75, 12, 7.5, 2);
      const fingers = [[8.25, 6.75], [11.25, 3.75], [14.25, 3.75], [17.25, 6.75]].map(([x, y]) => vl(x, 12.75, y));
      const thumb = line([6.75, 16.5], [3.75, 13.5]);
      return { d: [palm, ...fingers, thumb], fill: { solid: [palm], wire: [...fingers, thumb] } };
    })(),
  },
  'image-recognition': {
    tags: ['reconocimiento de imágenes', 'etiquetar imágenes', 'clasificar fotos', 'image recognition', 'image tagging'],
    d: pic(2.75, 5.75, 14.5, 14.5, 3.5),
    // A tag hangs from the picture's top right corner: comercio's price tag, upright, at 60 % with its
    // hole a dot 2.9 clear of its edges (its ring of a hole closed at bold)
    badge: (() => {
      const body = place(turnPath(comercio.icons['price-tag'].d[0], 45, [12.86, 12.86]), 0.6, [12.86, 12.86], [17.5, 8.5]);
      const hole = dot(17.5, 6.3);
      return own([body, hole], body, { solid: [body], cut: [hole] });
    })(),
  },
  'visual-search': {
    tags: ['búsqueda visual', 'buscar con la cámara', 'lente', 'visual search', 'search by image'],
    d: [SCAN, ...LENS.map((d) => place(d, 0.6, [12.1, 12.1], [12, 12]))],
  },
  'scan-handwriting': {
    tags: ['reconocer escritura', 'escritura a mano', 'ocr', 'handwriting recognition', 'scan handwriting'],
    d: [SCAN, smooth([[6.5, 14], [8.25, 10.25], [10, 14], [12, 10.25], [14, 14], [15.75, 10.25], [17.5, 13]])],
  },
  'voice-recognition': {
    tags: ['reconocimiento de voz', 'identificar hablante', 'huella de voz', 'voice recognition', 'voice id'],
    d: [SCAN, ...bars([[7.5, 10.5, 13.5], [10.5, 7.75, 16.25], [13.5, 9.25, 14.75], [16.5, 10.75, 13.25]])],
  },
  'sentiment-analysis': {
    tags: ['análisis de sentimiento', 'opiniones', 'emociones', 'sentiment analysis', 'opinion mining'],
    d: [...LENS, dot(8.6, 8), dot(12.6, 8), arc(10.6, 10.6, 2.75, 25, 155).d],
  },
  'entity-extraction': {
    tags: ['extraer entidades', 'nombres y fechas', 'datos del texto', 'entity extraction', 'named entities'],
    // Lines of text with one entity boxed in the middle one (a leader rising from the box to a dot read
    // as a walkie-talkie's antenna)
    d: [hl(3.25, 20.75, 5.75), hl(3.25, 5.75, 12), box(8.75, 9, 12, 6, 2), hl(11.75, 17.75, 12), hl(3.25, 14.25, 18.25)],
  },
  'document-parsing': {
    tags: ['extraer datos de documentos', 'facturas', 'formularios', 'document parsing', 'data extraction'],
    d: [...SRC.page, ...FLOW, ...OUT.braces],
  },
  'prediction': {
    tags: ['predicción', 'pronóstico', 'puntaje', 'prediction', 'forecast'],
    // The crystal ball sits in its stand, which is cut where it passes behind
    d: (() => {
      const ball = circ(12, 9.25, 6.75);
      const stand = roundpoly([[6.25, 14.5], [17.75, 14.5], [19, 20.5], [5, 20.5]], [1, 1, 1.25, 1.25]);
      return [ball, behind(stand, [ball]), spark(12, 9.25)];
    })(),
  },
  'recommendation': {
    tags: ['recomendado', 'para ti', 'personalizado', 'recommendation', 'for you'],
    d: [place(edicion.icons.heart.d[0], 0.82, [12, 12], [10.75, 13])],
    badge: sparkOn(18.75, 5.25),
  },

  // Safety and evaluation -----------------------------------------------------------------------
  'guardrails': {
    tags: ['barreras de seguridad', 'reglas del modelo', 'moderación', 'guardrails', 'ai safety'],
    d: [N.shield.d[0], spark(12, 11.75, RL)],
  },
  'hallucination': {
    tags: ['alucinación', 'respuesta inventada', 'sin fundamento', 'hallucination', 'ungrounded'],
    // Nine dashes, one on the drop's corner (with ten, two of them met at bold)
    d: [dashes(N.comment.d[0], 9, { mid: 8.75 }), spark(12, 11.75, RL)],
  },
  'deepfake': {
    tags: ['deepfake', 'rostro falso', 'medio manipulado', 'synthetic media', 'fake face'],
    // A face in front of a dashed copy of itself
    d: (() => {
      const front = circ(9.75, 13.5, 7);
      return [front, dot(7.5, 11.5), dot(12, 11.5), arc(9.75, 14, 3, 35, 145).d, dashes(behind(circ(14.25, 10.5, 7), [front]), 4, { gap: 2.75 })];
    })(),
  },
  'ai-detection': {
    tags: ['detectar ia', 'contenido generado', 'detector', 'ai detection', 'ai generated'],
    d: [SCAN, spark(12, 12, RL)],
  },
  'explainability': {
    tags: ['explicabilidad', 'por qué decidió', 'interpretabilidad', 'explainability', 'interpretability'],
    // A small decision tree in the lens
    d: [...LENS, dot(10.6, 7), rline([[10.6, 7.7], [10.6, 10], [7.85, 10], [7.85, 12.8]], 1), rline([[10.6, 7.7], [10.6, 10], [13.35, 10], [13.35, 12.8]], 1), dot(7.85, 13.5), dot(13.35, 13.5)],
  },
  'evaluation': {
    tags: ['evaluación', 'evals', 'casos de prueba', 'evaluation', 'benchmark'],
    // The sparkle stands on a ruler (edicion's)
    d: [spark(12, 10, RL), sq(3.25, 14.25, 17.5, 6.5, 2), vl(7.5, 20.75, 18), vl(12, 20.75, 18), vl(16.5, 20.75, 18)],
  },
  'confidence-score': {
    tags: ['nivel de confianza', 'certeza', 'puntaje del modelo', 'confidence score', 'certainty'],
    // datos' gauge, its needle high on the right, turning on the sparkle
    d: [arc(12, 15, 9, 180, 360).d, line(polar(12, 15, 4.5, -45), polar(12, 15, 9, -45)), spark(12, 15)],
  },
};

// ---------------------------------------------------------------------------------------------
// Fill (DESIGN.md › Fill), by path index: `solid` is filled, `closed` is filled once closed with Z
// (an open outline: a hemisphere, a cylinder's body, a profile), `cut` is knocked out, `lines` stay
// lines with a clearance of paper, `wire` stay lines attached. `false`: only open lines.
// ---------------------------------------------------------------------------------------------
const ix = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const MODEL_FILL = { solid: [0], cut: [1, 2, 3] };
const FLOW_LINES = [0, 1, 2, 3];
const FILL = {
  model: MODEL_FILL,
  'model-card': { solid: [0], cut: ix(1, 5) },
  'model-picker': { solid: [0], cut: ix(1, 5) },
  'model-compare': { solid: [0, 3], cut: [1, 2, 4, 5], lines: [6] },
  'model-training': { solid: [2], cut: [3, 4], lines: [0, 1] },
  'model-distillation': { solid: [0, 5], cut: [1, 2, 6, 7], wire: [3, 4] },
  'model-routing': { solid: [1], wire: [0, ...ix(2, 7)] },
  inference: { solid: [1], cut: [2, 3], wire: [0, 4, 5] },
  multimodal: { solid: [2, 4], lines: [0, 1], wire: [3] },
  'mixture-of-experts': { solid: [0, 1, 2, 3], wire: [4, 5, 6] },
  // Each hemisphere closes against the middle line, as datos' brain
  'brain-circuit': { closed: [0, 1], cut: ix(2, 6) },
  'brain-clock': { closed: [0, 1], cut: ix(2, 6) },
  perceptron: { solid: [0], wire: ix(1, 5) },
  'self-attention': { solid: [0, 1, 2, 3], wire: [4, 5, 6] },
  backpropagation: { solid: [0, 1, 2], wire: [3, 4], lines: [5, 6] },
  'gradient-descent': { solid: [1], wire: [0], lines: [2, 3] },
  autoencoder: { solid: [0, 1, 2] },
  // The kernel filled, the pixels under it knocked out
  convolution: { solid: [0, 3, 6, 7, 8, 9], cut: [1, 2, 4, 5] },
  'roc-curve': { solid: [0], cut: [1, 2] },
  classification: { solid: [0, 2, 4], wire: [1, 3] },
  'anomaly-detection': { solid: ix(0, 7), cut: [8] },
  'reinforcement-learning': { solid: [0, 1], lines: [2, 3, 4, 5] },
  'federated-learning': { solid: [0, 3, 6, 9], cut: [1, 2], wire: [4, 5, 7, 8, 10, 11] },
  dataset: { solid: [0], lines: [1, 2], cut: ix(3, 8) },
  'data-augmentation': { solid: [0, 4], cut: [1, 5], lines: [2, 3] },
  'synthetic-data': { solid: ix(0, 8) },
  embedding: { solid: [0, 5, 6, 7], lines: [1, 2, 3, 4] },
  'vector-space': { solid: [2, 4], wire: [0, 1, 3] },
  'database-vector': { closed: [0], solid: [1], cut: [2, 3, 4] },
  'nearest-neighbors': { solid: [0, 5, 6], cut: [1, 2, 3, 4] },
  // The pencil filled, the dashed box a line
  'data-labeling': { solid: [1], lines: [0] },
  // Each piece filled as a slab closed along its break (the middle one a band between the breaks)
  chunking: { closed: [0, 2], cut: [3, 4, 5] },
  retrieval: { solid: [0, 5], cut: [1, 2], lines: [3, 4] },
  tokens: { solid: ix(0, 3) },
  'token-limit': { solid: [0, 1], lines: [2] },
  'context-window': { solid: [0, 1, 5], cut: [2, 3, 4] },
  'sampling-temperature': { solid: [1], wire: [0, 2] },
  'prompt-gear': { solid: [0], cut: [1] },
  'prompt-edit': { solid: [0], cut: [1] },
  'prompt-injection': { solid: [0], cut: [1] },
  'prompt-template': { solid: [0], cut: [1, 2] },
  'prompt-library': { solid: [0], lines: [1, 2], cut: [3] },
  'prompt-image': { solid: [0], cut: [1] },
  'prompt-chain': { solid: [0, 4], cut: [1, 5], wire: [2, 3] },
  'prompt-suggestions': { solid: [0, 1, 2] },
  'structured-output': { solid: [2], lines: [0, 1] },
  agent: { solid: [0, 1] },
  // The person in front filled; the one behind stays a line, with its own head filled
  'multi-agent': { solid: [0, 1, 3], lines: [2] },
  'ai-teammate': { solid: [0, 1, 3], lines: [2] },
  subagent: { solid: [0, 2], wire: [1] },
  'agent-orchestration': { solid: [0, 4, 5, 6], wire: [1, 2, 3] },
  'agent-handoff': { solid: [0, 3], lines: [1, 2] },
  'agent-workflow': { solid: [0, 2, 4], wire: [1, 3] },
  'agent-plan': { solid: [0, 3], lines: [1], wire: [2] },
  'tool-call': { solid: [0, 1] },
  'agent-skill': { solid: [0], cut: [1] },
  'computer-use': { solid: [0], wire: [1, 2], cut: [3, 4] },
  'deep-research': { solid: [0], lines: [1, 2] },
  'human-in-the-loop': { solid: [0, 1, 2], lines: [3, 4, 5, 6] },
  'human-handoff': { solid: [0, 3, 4], lines: [1, 2] },
  'robot-humanoid': { solid: [0, 2, 5], wire: [1], cut: [3, 4] },
  'assistant-panel': { solid: [0], cut: [1, 2] },
  'assistant-canvas': { solid: [0, 1], cut: [2, 3] },
  'conversation-branch': { solid: [0], cut: ix(1, 5) },
  reasoning: { solid: [0], lines: [1] },
  'reasoning-effort': { solid: [3], lines: [0, 1, 2] },
  'chain-of-thought': { solid: [0, 1, 2, 3] },
  regenerate: { solid: [2], lines: [0, 1] },
  'voice-assistant': { solid: [0], lines: [1, 2, 3, 4] },
  'smart-suggestion': { solid: [0], lines: [1, 2], cut: [3] },
  'text-to-image': { solid: [4], cut: [5], lines: FLOW_LINES },
  'text-to-video': { solid: [4], cut: [5], lines: FLOW_LINES },
  'text-to-music': { solid: [4], wire: [5, 6], lines: FLOW_LINES },
  'text-to-sql': { closed: [4], solid: [5], lines: FLOW_LINES },
  'image-to-video': { solid: [0, 4], cut: [1, 5], lines: [2, 3] },
  'image-captioning': { solid: [0], cut: [1], lines: [2, 3] },
  // The profile closes along the neck: a head in silhouette
  'voice-clone': { closed: [0], solid: [1] },
  'generative-fill': { solid: [1], lines: [0] },
  'generative-expand': { solid: [1], cut: [2], lines: [0] },
  'background-removal': { solid: [0, 1, ...ix(3, 8)], lines: [2] },
  'subject-select': { solid: [0, 1], lines: [2] },
  upscale: { solid: [0], cut: ix(1, 6) },
  variations: { solid: [0, 1, 2, 3] },
  diffusion: { solid: [0], cut: ix(1, 5) },
  'computer-vision': { solid: [0], cut: [1] },
  // The scan corners stay lines around what they find, filled
  'object-detection': { solid: [1], cut: [2, 3], lines: [0] },
  'person-detection': { solid: [1, 2], lines: [0] },
  segmentation: { solid: [0], cut: ix(1, 7) },
  'pose-estimation': { solid: [0, 4, 5, 6, 7], wire: [1, 2, 3] },
  'face-mesh': { solid: [0], cut: ix(1, 9) },
  'hand-tracking': { solid: [0, 2, 4, 6, 8, 10], wire: [1, 3, 5, 7, 9] },
  'image-recognition': { solid: [0], cut: [1] },
  'visual-search': { solid: [1], wire: [2], lines: [0] },
  'sentiment-analysis': { solid: [0], wire: [1], cut: [2, 3, 4] },
  'entity-extraction': { solid: [2], cut: [3], lines: [0, 1, 4] },
  'document-parsing': { solid: [0], cut: [1, 2], lines: [3, 4, 5, 6] },
  // The ball filled with its sparkle knocked out; the stand behind it stays a line
  prediction: { solid: [0], cut: [2], lines: [1] },
  recommendation: { solid: [0] },
  guardrails: { solid: [0], cut: [1] },
  hallucination: { solid: [1], lines: [0] },
  deepfake: { solid: [0], cut: [1, 2, 3], lines: [4] },
  'ai-detection': { solid: [1], lines: [0] },
  explainability: { solid: [0], wire: [1], cut: ix(2, 6) },
  evaluation: { solid: [0, 1], cut: [2, 3, 4] },
  'confidence-score': { solid: [2], lines: [0, 1] },
};
// The model under each badge, the dataset under each badge and the agent under each badge
for (const name of ['model-fine-tune', 'model-check', 'model-download', 'model-plus', 'model-alert', 'model-lock']) FILL[name] = MODEL_FILL;
// The pennant filled, its pole a line attached to the cube
FILL['model-checkpoint'] = { solid: [0, 5], cut: [1, 2, 3], wire: [4] };
for (const name of ['dataset-plus', 'dataset-check']) FILL[name] = FILL.dataset;
for (const name of ['agent-plus', 'agent-gear', 'agent-clock', 'agent-check', 'agent-question', 'agent-alert', 'agent-lock']) FILL[name] = FILL.agent;
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (list) => (list ?? []).map((i) => d[i]);
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? shut(d[i]) : d[i]));
  icons[name].fill = { solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
icons.chunking.fill.solid.splice(1, 0, 'M4.75 10.375H19.25V13.625H4.75Z');
// The lids' front edges knocked out, as in Núcleo's database
icons['database-vector'].fill.cut.push(DB_RIM);
icons['text-to-sql'].fill.cut = ['M21.25 14A4.25 1.5 0 0 1 12.75 14'];
// The brush keeps edicion's own fill, placed where it stands
{
  const brush = edicion.icons.brush.fill;
  const at = (d) => place(d, 0.62, [11.28, 12.72], [16.9, 16.75]);
  const d = icons['style-transfer'].d;
  icons['style-transfer'].fill = { solid: [d[0], ...brush.solid.map(at)], cut: [d[1], ...brush.cut.map(at)], wire: brush.wire.map(at), lines: [d[2], d[3]] };
}
// The ruler's ticks cut through its bottom edge, as edicion's ruler
icons.evaluation.fill.cut = [7.5, 12, 16.5].map((x) => vl(x, 22.5, 18));
// Only open lines (and dots on lines): their filled version is the outline itself
for (const name of [
  'model-drift', 'quantization', 'activation-function', 'loss-curve', 'rerank', 'context-compression',
  'inline-completion', 'response-streaming', 'summarize', 'elaborate', 'text-to-speech', 'speech-recognition',
  'scan-handwriting', 'voice-recognition', 'object-tracking',
])
  icons[name].fill = false;

// ---------------------------------------------------------------------------------------------
// Named parts (DESIGN.md › Named parts): whatever animates, changes state or sits under a badge
// ---------------------------------------------------------------------------------------------
const PARTS = {
  model: { cube: [0, 1, 2], spark: [3] },
  'model-card': { card: [0], cube: [1, 2, 3], text: [4, 5] },
  'model-picker': { field: [0], cube: [1, 2, 3], handle: [4, 5] },
  'model-compare': { left: [0, 1, 2], right: [3, 4, 5], divider: [6] },
  'model-training': { cycle: [0, 1], cube: [2, 3, 4] },
  'model-distillation': { large: [0, 1, 2], arrow: [3, 4], small: [5, 6, 7] },
  'model-routing': { input: [0], spark: [1], routes: ix(2, 7) },
  'model-drift': { curve: [0], drifted: [1], axis: [2], arrow: [3, 4] },
  inference: { input: [0], cube: [1, 2, 3], output: [4, 5] },
  'brain-clock': { brain: ix(0, 6) },
  'reinforcement-learning': { agent: [0], reward: [1], loop: [2, 3, 4, 5] },
  'gradient-descent': { valley: [0], ball: [1], arrow: [2, 3] },
  'dataset-plus': { cards: [0, 1, 2], grid: ix(3, 8) },
  'dataset-check': { cards: [0, 1, 2], grid: ix(3, 8) },
  'data-labeling': { box: [0], pencil: [1] },
  rerank: { rows: [0, 1, 2], arrow: [3, 4] },
  'prompt-gear': { field: [0], spark: [1] },
  'prompt-edit': { field: [0], spark: [1] },
  'prompt-injection': { field: [0], spark: [1] },
  agent: { body: [0], spark: [1] },
  'computer-use': { screen: [0, 1, 2], spark: [3], pointer: [4] },
  'deep-research': { pages: [0, 1, 2] },
  'human-in-the-loop': { person: [0, 1], spark: [2], loop: [3, 4, 5, 6] },
  'response-streaming': { text: [0, 1, 2], cursor: [3] },
  reasoning: { spark: [0], orbit: [1] },
  'reasoning-effort': { level: [0, 1, 2], spark: [3] },
  regenerate: { arrow: [0, 1], spark: [2] },
  summarize: { text: [0, 1, 2], arrow: [3, 4], summary: [5] },
  elaborate: { summary: [0], arrow: [1, 2], text: [3, 4, 5] },
  'voice-assistant': { spark: [0], near: [1, 2], far: [3, 4] },
  'smart-suggestion': { bulb: [0, 1, 2], spark: [3] },
  'image-captioning': { picture: [0, 1], caption: [2, 3] },
  'generative-fill': { selection: [0], spark: [1] },
  'generative-expand': { canvas: [0], picture: [1, 2] },
  'subject-select': { person: [0, 1], selection: [2] },
  upscale: { frame: [0], pixels: [1, 2, 3, 4], arrow: [5, 6] },
  'object-detection': { frame: [0], object: [1, 2, 3] },
  'person-detection': { frame: [0], person: [1, 2] },
  'object-tracking': { frame: [0], object: [1], trail: [2, 3] },
  'hand-tracking': { palm: [0], fingers: ix(1, 10) },
  'image-recognition': { picture: [0, 1] },
  prediction: { ball: [0], stand: [1], spark: [2] },
  recommendation: { heart: [0] },
  'confidence-score': { dial: [0], needle: [1], spark: [2] },
};
for (const name of ['model-fine-tune', 'model-check', 'model-download', 'model-plus', 'model-alert', 'model-lock']) PARTS[name] = PARTS.model;
PARTS['model-checkpoint'] = { ...PARTS.model, flag: [4, 5] };
for (const name of ['agent-plus', 'agent-gear', 'agent-clock', 'agent-check', 'agent-question', 'agent-alert', 'agent-lock']) PARTS[name] = PARTS.agent;
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ---------------------------------------------------------------------------------------------
// Motion (DESIGN.md › Motion): each icon's own gesture
// ---------------------------------------------------------------------------------------------
icons.model.motion = { effect: 'beat', parts: ['spark'], origin: MODEL.center };
icons['model-training'].motion = { effect: 'spin', parts: ['cycle'], origin: [12, 12] };
icons['model-download'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] };
icons['reinforcement-learning'].motion = { effect: 'spin', parts: ['loop'], origin: [12, 12] };
icons['human-in-the-loop'].motion = { effect: 'spin', parts: ['loop'], origin: [12, 12] };
icons['data-labeling'].motion = { effect: 'wiggle', parts: ['pencil'], origin: [20.75, 20.75] };
icons.agent.motion = { effect: 'beat', parts: ['spark'], origin: [12, AGENT_TOP] };
icons['response-streaming'].motion = { effect: 'beat', parts: ['cursor'], origin: [14.75, 17.25] };
icons.reasoning.motion = { effect: 'spin', parts: ['orbit'], origin: [12, 12] };
icons.regenerate.motion = { effect: 'spin', parts: ['arrow'], origin: [12, 12.45] };
icons.summarize.motion = { effect: 'bounce', parts: ['arrow'], vector: [0, 1.25] };
icons.elaborate.motion = { effect: 'bounce', parts: ['arrow'], vector: [0, 1.25] };
icons['smart-suggestion'].motion = { effect: 'beat', parts: ['spark'], origin: [12, 8.75] };
icons['generative-fill'].motion = { effect: 'beat', parts: ['spark'], origin: [12, 12] };
icons.upscale.motion = { effect: 'slide', parts: ['arrow'], vector: [1.25, -1.25] };
icons['hand-tracking'].motion = { effect: 'wiggle', origin: [12, 20.75] };
icons.prediction.motion = { effect: 'beat', parts: ['spark'], origin: [12, 9.25] };
icons.recommendation.motion = { effect: 'beat', origin: [10.75, 13] };
icons['confidence-score'].motion = { effect: 'wiggle', parts: ['needle'], origin: [12, 15] };
// A value: the needle sweeps the dial, from its left end (180°) at 0 to its right end (360°) at 1
icons['confidence-score'].value = { turn: { parts: ['needle'], origin: [12, 15], from: 180, to: 360, at: 315 } };

// ---------------------------------------------------------------------------------------------
// Levels (DESIGN.md › Levels and values): from least to most
// ---------------------------------------------------------------------------------------------
icons['reasoning-effort'].levels = [[0], [1], [2]];
icons['voice-assistant'].levels = [[1, 2], [3, 4]];

// ---------------------------------------------------------------------------------------------
// Mirroring (DESIGN.md › Mirroring): flows that read left to right, text, charts that grow, the
// prompt's field (as datos' prompt) and a face that speaks toward the reading direction
// ---------------------------------------------------------------------------------------------
for (const name of [
  'model-card', 'model-picker', 'model-distillation', 'model-routing', 'model-drift', 'inference', 'quantization', 'multimodal',
  'mixture-of-experts', 'perceptron', 'loss-curve', 'classification', 'embedding', 'vector-space', 'retrieval', 'rerank', 'tokens',
  'token-limit', 'sampling-temperature', 'prompt-gear', 'prompt-edit', 'prompt-template', 'prompt-library', 'prompt-image',
  'prompt-chain', 'prompt-injection', 'prompt-suggestions', 'subagent', 'agent-handoff', 'agent-workflow', 'agent-plan',
  'human-handoff', 'assistant-panel', 'assistant-canvas', 'inline-completion', 'response-streaming', 'reasoning-effort',
  'chain-of-thought', 'text-to-image', 'text-to-video', 'text-to-speech', 'text-to-music', 'text-to-sql', 'image-to-video',
  'style-transfer', 'data-augmentation', 'data-labeling', 'image-captioning', 'speech-recognition', 'voice-clone', 'object-tracking', 'entity-extraction',
  'document-parsing',
])
  icons[name].mirror = true;

// ---------------------------------------------------------------------------------------------
// Automatic variants that make no sense (DESIGN.md › Automatic variants)
// ---------------------------------------------------------------------------------------------
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already round (a cycle, an orbit, a loop) or a bubble: they aren't enclosed in a circle again
variants(['model-training', 'reinforcement-learning', 'human-in-the-loop', 'reasoning', 'regenerate', 'conversation-branch', 'hallucination'], { circle: false });
// Already a square frame, a grid, a viewfinder or a bubble: they aren't enclosed in a square again
variants(
  ['roc-curve', 'convolution', 'generative-fill', 'upscale', 'variations', 'diffusion', 'segmentation', 'visual-search', 'scan-handwriting', 'voice-recognition', 'ai-detection', 'object-detection', 'person-detection', 'conversation-branch', 'hallucination'],
  { square: false },
);
// With a badge: scaled down to 58–60 % the badge stops reading, and the slash would cut through it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Loose lines: slashing them says nothing
variants(['quantization', 'activation-function', 'context-compression', 'inline-completion', 'response-streaming', 'summarize', 'elaborate'], { slash: false });

export default { category: 'ia', label: 'Inteligencia artificial', icons };
