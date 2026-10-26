// Data and analytics: charts, dashboards, databases, and data work. Its code, git, and AI icons were
// drawn here and are shown under desarrollo and ia, which adopt them (src/taxonomy.json). Everything is
// computed with engine/geometry.mjs on the rules in DESIGN.md (1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on containers).
import { arc, badge, circ, dot, drop, flipPath, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper } from '../../engine/variants.mjs';

// ---------------------------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------------------------

/** Number with at most two decimals (same as the engine). */
const n = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${n(p[0])} ${n(p[1])}`;

/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });

/** Capsule (semicircular ends), horizontal or vertical depending on the longer side. */
function pill(x, y, w, h) {
  if (w >= h) {
    const r = h / 2;
    return `M${pt([x + r, y])}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x + w - r, y + h])}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x + r, y])}Z`;
  }
  const r = w / 2;
  return `M${pt([x, y + r])}A${n(r)} ${n(r)} 0 0 1 ${pt([x + w, y + r])}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
}

/** Open line through points with rounded interior corners (one radius per vertex, or one for all). */
function rline(pts, r = 0) {
  const rr = Array.isArray(r) ? r : pts.map(() => r);
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    let [ux, uy] = [A[0] - V[0], A[1] - V[1]];
    const lu = Math.hypot(ux, uy);
    ux /= lu;
    uy /= lu;
    let [vx, vy] = [B[0] - V[0], B[1] - V[1]];
    const lv = Math.hypot(vx, vy);
    vx /= lv;
    vy /= lv;
    const th = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    if (!rr[i] || th > Math.PI - 1e-6) {
      d += `L${pt(V)}`;
      continue;
    }
    const t = rr[i] / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${pt([V[0] + ux * t, V[1] + uy * t])}A${n(rr[i])} ${n(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${pt([V[0] + vx * t, V[1] + vy * t])}`;
  }
  return `${d}L${pt(pts[pts.length - 1])}`;
}

/** Path with transformed points (e.g. rotated): [['M', p], ['C', c1, c2, p], ['A', r, large, sweep, p], ['Z']]. */
function tp(cmds, T = (p) => p) {
  return cmds
    .map(([c, ...a]) => {
      if (c === 'Z') return 'Z';
      if (c === 'A') return `A${n(a[0])} ${n(a[0])} 0 ${a[1]} ${a[2]} ${pt(T(a[3]))}`;
      return c + a.map((p) => pt(T(p))).join(' ');
    })
    .join('');
}

/** Four-pointed sparkle with concave sides (the AI sparkle). */
function star4(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const P = (x, y) => [cx + x * R, cy + y * R];
  return tp([
    ['M', P(0, -1)],
    ['C', P(a, -b), P(b, -a), P(1, 0)],
    ['C', P(b, a), P(a, b), P(0, 1)],
    ['C', P(-a, b), P(-b, a), P(-1, 0)],
    ['C', P(-b, -a), P(-a, -b), P(0, -1)],
    ['Z'],
  ]);
}

/** Upper intersection of two circles [cx, cy, r]. */
function meet(c1, c2) {
  const [x1, y1, r1] = c1;
  const [x2, y2, r2] = c2;
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const [mx, my] = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  const P = [mx + (h * (y2 - y1)) / d, my - (h * (x2 - x1)) / d];
  const Q = [mx - (h * (y2 - y1)) / d, my + (h * (x2 - x1)) / d];
  return P[1] < Q[1] ? P : Q;
}
/** Clockwise arc on circle c from p0 to p1. */
function cwArc(c, p0, p1) {
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let span = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  while (span < 0) span += 2 * Math.PI;
  return `A${n(c[2])} ${n(c[2])} 0 ${span > Math.PI ? 1 : 0} 1 ${pt(p1)}`;
}
/** Cloud: three lobes (left, top, right) on a flat base at `base`. */
function cloud(L, T, R, base) {
  const a = [L[0], base];
  const b = meet(L, T);
  const c = meet(T, R);
  const e = [R[0], base];
  return `M${pt(a)}${cwArc(L, a, b)}${cwArc(T, b, c)}${cwArc(R, c, e)}Z`;
}

/** Ellipse rotated `deg` degrees around its center. */
function rell(cx, cy, rx, ry, deg) {
  const p0 = rot([cx - rx, cy], [cx, cy], deg);
  const p1 = rot([cx + rx, cy], [cx, cy], deg);
  return `M${pt(p0)}A${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${pt(p1)}A${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${pt(p0)}Z`;
}

/** Edge between two circular nodes of radius r1 and r2: it touches their borders without going in. */
function edge(p, q, r1, r2 = r1) {
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const L = Math.hypot(dx, dy);
  return line([p[0] + (dx / L) * r1, p[1] + (dy / L) * r1], [q[0] - (dx / L) * r2, q[1] - (dy / L) * r2]);
}

/** Ring for the fill: the outer circle and the inner one in the opposite direction (the center stays hollow). */
const ring = (cx, cy, R, r) => `${circ(cx, cy, R)}M${pt([cx - r, cy])}A${n(r)} ${n(r)} 0 1 1 ${pt([cx + r, cy])}A${n(r)} ${n(r)} 0 1 1 ${pt([cx - r, cy])}Z`;

// The core database, complete (the badges clear it through the engine).
const DB = {
  body: 'M3.6 6.1v11.8c0 1.66 3.76 3 8.4 3s8.4-1.34 8.4-3V6.1',
  lid: 'M3.6 6.1c0-1.66 3.76-3 8.4-3s8.4 1.34 8.4 3-3.76 3-8.4 3-8.4-1.34-8.4-3Z',
  band: 'M20.4 12c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3',
  // The lid's edge, which is knocked out in the fill (as in the core `database`)
  rim: 'M20.4 6.1c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3',
};
const DB_D = [DB.body, DB.lid, DB.band];

// The badges' center (the engine's), for the motions that turn a badge.
const BC = [17.25, 17.25];

// Keylines.
const K0 = 3.25;
const K1 = 20.75;
/** The set's square card (17.5, radius 4.25, signature). */
const CARD = box(K0, K0, 17.5, 17.5, 4.25);

// Bars: three columns 3.75 wide with 3.13 between edges.
const BW = 3.75;
const BX = [3.25, 10.125, 17];
const bar = (x, top, bottom = K1) => sq(x, top, BW, bottom - top, 1.15, { square: ['bl', 'br'] });

// Data lines: soft bends (radius 2.5); trends even softer (radius 3) and with a short arrowhead
// along the last segment, so they read as a flow and not as a zigzag.
const SOFT = 2.5;
const TREND = 3;
const UP = [[3, 17], [9.25, 10.75], [13, 14.5], [20.25, 7.25]];
const DOWN = UP.map(([x, y]) => [x, 24 - y]);
const FLAT = [[2.75, 13], [7.5, 8.25], [12, 12.75], [20.5, 12.75]];

// Git: nodes of r 2.35 (the ones from the core roadmap) and branches that leave and rejoin the
// trunk like a lane change, with tangent curves instead of elbows.
const GR = 2.35;

// The core magnifier (search), identical: a ring of r 6.85 at 10.6 and a handle from 15.6 to 20.5.
const SEARCH = [circ(10.6, 10.6, 6.85), line([15.6, 15.6], [20.5, 20.5])];

// A 90° vertex of a `roundpoly` with radius r sits (√2 − 1)·r inside: that's where the connectors
// touch.
const INSET = (r) => (Math.SQRT2 - 1) * r;

// ---------------------------------------------------------------------------------------------
// Charts and data (round 5): paths as segments, to cut a shape where it passes behind another,
// dash a stroke, or split a curve where it crosses another (as `ia` and `social` do), smooth
// curves through points, and the cylinders of the data stores
// ---------------------------------------------------------------------------------------------

const same = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;

/** An SVG arc without rotation, from its endpoints to its center: { t: 'E', c, rx, ry, a0, da }. */
function arcSeg(p0, p1, rx, ry, large, sweep) {
  const x1 = (p0[0] - p1[0]) / 2;
  const y1 = (p0[1] - p1[1]) / 2;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const [u, v] = [(k * rx * y1) / ry, (-k * ry * x1) / rx];
  const c = [u + (p0[0] + p1[0]) / 2, v + (p0[1] + p1[1]) / 2];
  const a0 = Math.atan2((y1 - v) / ry, (x1 - u) / rx);
  let da = Math.atan2((-y1 - v) / ry, (-x1 - u) / rx) - a0;
  if (sweep && da < 0) da += 2 * Math.PI;
  if (!sweep && da > 0) da -= 2 * Math.PI;
  return { t: 'E', c, rx, ry, a0, da };
}

/** A path as subpaths of segments: lines (L), cubics (C) and arcs (E), all absolute. */
function parse(d) {
  const tk = d.match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const subs = [];
  let [sp, i, cmd, x, y, sx, sy, lc] = [null, 0, '', 0, 0, 0, 0, null];
  const num = () => Number.parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    if (C === 'Z') {
      if (sp) {
        if (!same([x, y], [sx, sy], 1e-6)) sp.segs.push({ t: 'L', a: [x, y], b: [sx, sy] });
        sp.closed = true;
      }
      [x, y, lc, sp] = [sx, sy, null, null];
      continue;
    }
    if (C === 'M') {
      [x, y] = [ox + num(), oy + num()];
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
      if (C === 'L') [x, y] = [ox + num(), oy + num()];
      else if (C === 'H') x = ox + num();
      else y = oy + num();
      sp.segs.push({ t: 'L', a, b: [x, y] });
      lc = null;
    } else if (C === 'C' || C === 'S') {
      const p1 = C === 'C' ? [ox + num(), oy + num()] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
      const p2 = [ox + num(), oy + num()];
      const p3 = [ox + num(), oy + num()];
      sp.segs.push({ t: 'C', p: [a, p1, p2, p3] });
      lc = p2;
      [x, y] = p3;
    } else if (C === 'A') {
      const [rx, ry] = [num(), num()];
      num();
      const [large, sweep] = [num(), num()];
      const b = [ox + num(), oy + num()];
      sp.segs.push(arcSeg(a, b, rx, ry, large, sweep));
      [x, y] = b;
      lc = null;
    }
  }
  return subs;
}

/** The point at t (0–1) of a segment. */
function at(s, t) {
  if (s.t === 'L') return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
  if (s.t === 'E') {
    const g = s.a0 + s.da * t;
    return [s.c[0] + s.rx * Math.cos(g), s.c[1] + s.ry * Math.sin(g)];
  }
  const [p0, p1, p2, p3] = s.p;
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map((j) => w[0] * p0[j] + w[1] * p1[j] + w[2] * p2[j] + w[3] * p3[j]);
}
/** A cubic split at t. */
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
/** The piece of a segment between t0 and t1. */
function piece(s, t0, t1) {
  if (s.t === 'L') return { t: 'L', a: at(s, t0), b: at(s, t1) };
  if (s.t === 'E') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}
/** Cumulative lengths of a segment in 64 steps (to cut it by arc length). */
function lengths(s) {
  const out = [0];
  let a = at(s, 0);
  for (let k = 1; k <= 64; k++) {
    const b = at(s, k / 64);
    out.push(out[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    a = b;
  }
  return out;
}
const segLen = (s) => lengths(s)[64];
/** The t at which a segment reaches length `l`. */
function tAt(s, l) {
  const tb = lengths(s);
  if (l <= 0) return 0;
  if (l >= tb[64]) return 1;
  let k = 1;
  while (tb[k] < l) k++;
  return (k - 1 + (l - tb[k - 1]) / (tb[k] - tb[k - 1])) / 64;
}
function segD(s) {
  if (s.t === 'L') return `L${pt(s.b)}`;
  if (s.t === 'C') return `C${pt(s.p[1])} ${pt(s.p[2])} ${pt(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(piece(s, 0, 0.5)) + segD(piece(s, 0.5, 1));
  const [a, b] = [at(s, 0), at(s, 1)];
  // A half circle is written with exactly half its chord as radius (DESIGN.md › circles are exact)
  const half = Math.abs(s.rx - s.ry) < 1e-6 && Math.abs(Math.abs(s.da) - Math.PI) < 1e-6;
  const [rx, ry] = half ? [halfChord(a, b), halfChord(a, b)] : [n(s.rx), n(s.ry)];
  return `A${rx} ${ry} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${pt(b)}`;
}
/** Subpaths back to a path. */
function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = at(sp.segs[0], 0);
    o += `M${pt(last)}`;
    for (const s of sp.segs) {
      if (!same(at(s, 0), last)) o += `M${pt(at(s, 0))}`;
      o += segD(s);
      last = at(s, 1);
    }
    if (sp.closed) o += 'Z';
  }
  return o;
}

/** Keeps the parts of `d` where keep(p) holds (pieces shorter than 0.3 are dropped). */
function clip(d, keep) {
  const out = [];
  for (const sp of parse(d)) {
    const pieces = [];
    sp.segs.forEach((s, i) => {
      const N = 96;
      let prev = keep(at(s, 0));
      let start = prev ? 0 : null;
      for (let k = 1; k <= N; k++) {
        const now = keep(at(s, k / N));
        if (now === prev) continue;
        let [lo, hi] = [(k - 1) / N, k / N];
        for (let j = 0; j < 30; j++) {
          const m = (lo + hi) / 2;
          if (keep(at(s, m)) === prev) lo = m;
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
      const [a, z] = [chains[0][0], chains.at(-1).at(-1)];
      if (a.i === 0 && a.t0 === 0 && z.i === sp.segs.length - 1 && z.t1 === 1) chains[0] = [...chains.pop(), ...chains[0]];
    }
    for (const ch of chains) {
      const segs = ch.map((pc) => piece(sp.segs[pc.i], pc.t0, pc.t1));
      if (segs.reduce((m, s) => m + segLen(s), 0) > 0.3) out.push({ segs, closed: false });
    }
  }
  return ser(out);
}

/** Points along a path, every ~0.1 (to measure distances and test insides). */
const samples = (d) =>
  parse(d).map((sp) =>
    sp.segs.flatMap((s) => {
      const k = Math.max(2, Math.ceil(segLen(s) / 0.1));
      return Array.from({ length: k + 1 }, (_, j) => at(s, j / k));
    }),
  );
function inside(ring, [px, py]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/**
 * The part of `d` that shows behind the closed shapes `fronts`: whatever lies inside them or
 * closer than `gap` (center to center) to their outline is dropped. 3 center to center is the
 * set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  return clip(d, (p) => !rings.some((r) => inside(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005));
}
/** The piece of an open path (its first subpath) between arc lengths l0 and l1. */
function span(d, l0, l1) {
  const sp = parse(d)[0];
  const lens = sp.segs.map(segLen);
  const segs = [];
  let from = 0;
  sp.segs.forEach((s, i) => {
    const [s0, s1] = [from, from + lens[i]];
    from = s1;
    const [u, v] = [Math.max(l0, s0), Math.min(l1, s1)];
    if (v - u > 1e-6) segs.push(piece(s, tAt(s, u - s0), tAt(s, v - s0)));
  });
  return ser([{ segs, closed: false }]);
}
const lengthOf = (d) => parse(d)[0].segs.reduce((m, s) => m + segLen(s), 0);
/**
 * A dashed open stroke as one path: `k` dashes `gap` apart (3 center to center: 1.5 of paper), the
 * first and the last on the path's ends. A closed path starts its first dash, centered, at `mid`
 * (arc length).
 */
function dashes(d, k, { gap = 3, mid = 0 } = {}) {
  const L = lengthOf(d);
  const sp = parse(d)[0];
  if (sp.closed) {
    // Around a closed path: the path twice over, so a dash may run across its start
    const dash = L / k - gap;
    const twice = ser([{ segs: [...sp.segs, ...sp.segs], closed: false }]);
    return Array.from({ length: k }, (_, i) => {
      let m = (((mid + (i * L) / k) % L) + L) % L;
      if (m < dash / 2) m += L;
      return span(twice, m - dash / 2, m + dash / 2);
    }).join('');
  }
  const dash = (L - (k - 1) * gap) / k;
  return Array.from({ length: k }, (_, i) => span(d, i * (dash + gap), i * (dash + gap) + dash)).join('');
}

/**
 * A smooth curve through points (Catmull-Rom as cubics). Open by default, its ends leaving along
 * their first and last chords; `closed` joins the last point back to the first.
 */
function smooth(P, { closed = false } = {}) {
  const N = P.length;
  const get = (i) => (closed ? P[(i + N) % N] : P[Math.max(0, Math.min(N - 1, i))]);
  const tan = (i) => {
    const [a, b] = [get(i - 1), get(i + 1)];
    return [(b[0] - a[0]) / 2, (b[1] - a[1]) / 2];
  };
  let d = `M${pt(P[0])}`;
  for (let i = 0; i < (closed ? N : N - 1); i++) {
    const [a, b] = [get(i), get(i + 1)];
    const [ta, tb] = [tan(i), tan(i + 1)];
    d += `C${pt([a[0] + ta[0] / 3, a[1] + ta[1] / 3])} ${pt([b[0] - tb[0] / 3, b[1] - tb[1] / 3])} ${pt(b)}`;
  }
  return closed ? `${d}Z` : d;
}

/**
 * A cylinder (the data stores): its lid (a whole ellipse), its body (the sides and the bottom
 * arc), the lid's rim (knocked out in the fill, as in the core `database`), its outline (to cut
 * what passes behind it) and the band arcs at the given heights.
 */
function cylinder(cx, top, rx, ry, bottom, bands = []) {
  const [l, r] = [n(cx - rx), n(cx + rx)];
  const arcTo = (x, y, sweep, large = 0) => `A${n(rx)} ${n(ry)} 0 ${large} ${sweep} ${x} ${n(y)}`;
  return {
    lid: `M${l} ${n(top)}${arcTo(r, top, 1)}${arcTo(l, top, 1)}Z`,
    body: `M${l} ${n(top)}V${n(bottom)}${arcTo(r, bottom, 0)}V${n(top)}`,
    rim: `M${r} ${n(top)}${arcTo(l, top, 1)}`,
    bands: bands.map((y) => `M${r} ${n(y)}${arcTo(l, y, 1)}`),
    outline: `M${l} ${n(top)}${arcTo(r, top, 1)}V${n(bottom)}${arcTo(l, bottom, 1)}Z`,
  };
}

/** A gentle wave across [x0, x1] at height y: `k` half waves of amplitude `amp`, the first one up. */
function wave(x0, x1, y, k, amp) {
  const w = (x1 - x0) / k;
  const h = (amp * 4) / 3;
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < k; i++) {
    const s = i % 2 ? h : -h;
    const x = x0 + i * w;
    d += `C${pt([x + w / 3, y + s])} ${pt([x + (2 * w) / 3, y + s])} ${pt([x + w, y])}`;
  }
  return d;
}

/** A dashed arc of `k` dashes 3 apart, from a0 to a1 degrees, its first and last dash on the ends. */
const dashedArc = (cx, cy, r, a0, a1, k) => dashes(arc(cx, cy, r, a0, a1).d, k);

/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);

/** The warehouse roof: a wide, low gable over a store (lakehouse shares it). */
const ROOF = rline([[2.5, 7.05], [12, 3.25], [21.5, 7.05]], 1.5);
/** The store under the roof: a cylinder 12 wide that stands 3.5 or more clear of the gable. */
const STORE = (bands) => cylinder(12, 9.25, 6, 1.75, 19.25, bands);
/** A data source: a narrow store, a short cable from its side and the plug (sistema's, smaller), up
 * and clear of the badge's corner. */
const SOURCE_STORE = cylinder(7.75, 5.1, 4.5, 1.6, 18, [11.1]);
const SOURCE = [
  SOURCE_STORE.body,
  SOURCE_STORE.lid,
  SOURCE_STORE.bands[0],
  line([12.25, 7], [15.25, 7]),
  sq(15.25, 4.5, 4, 5, 1.5, { square: ['tr', 'br'] }),
  line([19.25, 5.5], [21.25, 5.5]) + line([19.25, 8.5], [21.25, 8.5]),
];
/** The pipeline: an elbow pipe 6 wide (its walls 3 either side of the flow), up the left and along
 * the top, with a flange across each end; the badge's corner stays clear. */
const PIPE = (() => {
  const [x, y, R] = [6.75, 6.75, 4.5];
  const c = [x + R, y + R];
  const wall = (o) => `M${n(x + o)} 20.25V${n(c[1])}A${n(R - o)} ${n(R - o)} 0 0 1 ${n(c[0])} ${n(y + o)}H20.5`;
  const body = `M${n(x - 3)} 20.25V${n(c[1])}A${n(R + 3)} ${n(R + 3)} 0 0 1 ${n(c[0])} ${n(y - 3)}H20.5V${n(y + 3)}H${n(c[0])}A${n(R - 3)} ${n(R - 3)} 0 0 0 ${n(x + 3)} ${n(c[1])}V20.25Z`;
  const flow = [dot(x, 16.25), dot(...polar(...c, R, 225)), dot(15.25, y)];
  return { d: [wall(-3), wall(3), line([x - 4, 20.25], [x + 4, 20.25]), line([20.5, y - 4], [20.5, y + 4]), ...flow], body };
})();
/** The table card (datos' `table`). */
const TABLE = [CARD, line([K0, 8.75], [K1, 8.75]), line([10.75, 8.75], [10.75, K1])];
/** The venn's two sets (centers 6.5 apart, r 6.25), where they meet (P above, Q below) and the angle a. */
const VA = [8.75, 12];
const VB = [15.25, 12];
const VR = 6.25;
const Va = (Math.acos(3.25 / VR) * 180) / Math.PI;
const VP = [12, 12 - Math.sqrt(VR * VR - 3.25 * 3.25)];
const VQ = [12, 12 + Math.sqrt(VR * VR - 3.25 * 3.25)];
/** The dashed parts start 3.6 along the circle from where the circles meet (in degrees). */
const VG = (3.6 / VR) * (180 / Math.PI);
/** ER notation: two bars across the line (one and only one) and the crow's foot (many). */
const ONE = (x) => line([x, 8.75], [x, 15.25]) + line([x + 3, 8.75], [x + 3, 15.25]);
const MANY = (x, to) => line([x, 12], [to, 7.5]) + line([x, 12], [to, 16.5]);

/**
 * Drill down and up: one tall bar (chart-bar's) and the breakdown, three short bars side by side as
 * one silhouette (as chart-histogram), and an arc arrow between them that starts 3 above one and
 * lands 3 above the other.
 */
function drill(down) {
  const parts = roundpoly([[11, K1], [11, 16.25], [14.25, 16.25], [14.25, 15], [17.5, 15], [17.5, 17.5], [K1, 17.5], [K1, K1]], [0, 1.15, 0, 1.15, 1.15, 0, 1.15, 0]);
  const [A, B] = [[5.125, 5.25], [15.875, 12]];
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const c = [(A[0] + B[0]) / 2 - (4 * (B[1] - A[1])) / L, (A[1] + B[1]) / 2 + (4 * (B[0] - A[0])) / L];
  const r = Math.hypot(A[0] - c[0], A[1] - c[1]);
  const ang = (p) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
  const a = down ? arc(...c, r, ang(A), ang(B)) : arc(...c, r, ang(B), ang(A));
  return [bar(K0, 8.5), parts, line([14.25, 16.25], [14.25, K1]), line([17.5, 17.5], [17.5, K1]), a.d, head(a.end, a.tangent, 3.4)];
}

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------

const icons = {
  // Charts -------------------------------------------------------------------------------------
  'chart-bar': {
    tags: ['gráfica de barras', 'barras', 'estadísticas', 'bar chart'],
    d: [bar(BX[0], 11.75), bar(BX[1], 3.25), bar(BX[2], 7.75)],
  },
  'chart-bar-horizontal': {
    tags: ['barras horizontales', 'gráfica', 'ranking', 'horizontal bar chart'],
    d: [
      sq(K0, 3.25, 10.5, BW, 1.15, { square: ['tl', 'bl'] }),
      sq(K0, 10.125, 17.5, BW, 1.15, { square: ['tl', 'bl'] }),
      sq(K0, 17, 13.25, BW, 1.15, { square: ['tl', 'bl'] }),
    ],
  },
  'chart-bar-stacked': {
    tags: ['barras apiladas', 'gráfica', 'composición', 'stacked bar chart'],
    d: [
      bar(BX[0], 9.25),
      bar(BX[1], 3.25),
      bar(BX[2], 12),
      line([BX[0], 14.5], [BX[0] + BW, 14.5]),
      line([BX[1], 10.75], [BX[1] + BW, 10.75]),
      line([BX[2], 16.5], [BX[2] + BW, 16.5]),
    ],
  },
  'chart-histogram': {
    tags: ['histograma', 'distribución', 'frecuencia', 'histogram'],
    d: [
      roundpoly(
        [
          [3.25, 20.75], [3.25, 15], [6.75, 15], [6.75, 9.5], [10.25, 9.5], [10.25, 4.25],
          [13.75, 4.25], [13.75, 8], [17.25, 8], [17.25, 13.5], [20.75, 13.5], [20.75, 20.75],
        ],
        [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
      ),
      line([6.75, 15], [6.75, 20.75]),
      line([10.25, 9.5], [10.25, 20.75]),
      line([13.75, 8], [13.75, 20.75]),
      line([17.25, 13.5], [17.25, 20.75]),
    ],
  },
  'chart-line': {
    tags: ['gráfica de líneas', 'serie', 'evolución', 'line chart'],
    d: [rline([[3.25, 15.25], [8.5, 9.25], [12.75, 13.25], [20.75, 4.75]], SOFT), line([K0, K1], [K1, K1])],
  },
  'chart-lines': {
    tags: ['varias series', 'comparar', 'líneas', 'multi line chart'],
    d: [
      rline([[3.25, 10.75], [8.5, 5.75], [13, 8.75], [20.75, 3.5]], SOFT),
      rline([[3.25, 16.75], [8.75, 12.75], [13.5, 15], [20.75, 9.75]], SOFT),
      line([K0, K1], [K1, K1]),
    ],
  },
  'chart-step': {
    tags: ['gráfica escalonada', 'escalones', 'cambios por etapa', 'step chart'],
    d: [rline([[K0, 16.25], [8.5, 16.25], [8.5, 10.75], [14, 10.75], [14, 5.25], [K1, 5.25]], 1.5), line([K0, K1], [K1, K1])],
  },
  'chart-area': {
    tags: ['gráfica de área', 'volumen', 'acumulado', 'area chart'],
    d: [
      roundpoly([[3.25, 20.75], [3.25, 14.5], [8.5, 8.75], [12.75, 12.5], [20.75, 4.5], [20.75, 20.75]], [0, 1, 1.5, 1.5, 1, 0]),
    ],
  },
  'chart-pie': {
    tags: ['gráfica de pastel', 'proporción', 'porcentaje', 'pie chart'],
    d: ['M13.5 13.5V6.25A7.25 7.25 0 1 1 6.25 13.5Z', 'M10.5 10.5H3.25A7.25 7.25 0 0 1 10.5 3.25Z'],
  },
  'chart-donut': {
    tags: ['dona', 'anillo', 'proporción', 'donut chart'],
    d: [
      circ(12, 12, 9),
      circ(12, 12, 4.5),
      ...[-90, 30, 140].map((a) => line(polar(12, 12, 4.5, a), polar(12, 12, 9, a))),
    ],
  },
  'chart-scatter': {
    tags: ['dispersión', 'puntos', 'correlación', 'scatter chart'],
    d: [
      rline([[K0, K0], [K0, K1], [K1, K1]], 0),
      dot(7.25, 16.25),
      dot(10.25, 12.25),
      dot(13, 15.5),
      dot(14.75, 9),
      dot(17.75, 12),
      dot(18.25, 5.75),
    ],
  },
  'chart-bubble': {
    tags: ['burbujas', 'magnitud', 'dispersión', 'bubble chart'],
    d: [circ(8.25, 15.25, 5), circ(16.5, 7.25, 3.5), circ(18, 17.5, 2), dot(6.5, 6.5)],
  },
  'chart-funnel': {
    tags: ['embudo', 'conversión', 'etapas', 'funnel chart'],
    d: [sq(K0, 3.25, 17.5, BW, 1.15), sq(6, 10.125, 12, BW, 1.15), sq(8.75, 17, 6.5, BW, 1.15)],
  },
  'chart-radar': {
    tags: ['radar', 'araña', 'atributos', 'radar chart'],
    d: (() => {
      // The web and the data, without spokes: the spokes crossed the polygon and turned into a star
      // at 18 px. Each data vertex sits 3 or more from the web (radius ≤ 9.3 − 3.71).
      const c = [12, 12.4];
      const A = [-90, -18, 54, 126, 198];
      const outer = A.map((a) => polar(c[0], c[1], 9.3, a));
      const rr = [5.6, 3.6, 5, 2.9, 5.3];
      const inner = A.map((a, i) => polar(c[0], c[1], rr[i], a));
      return [roundpoly(outer, 1.4), roundpoly(inner, 0.6)];
    })(),
  },
  'chart-waterfall': {
    tags: ['cascada', 'variación', 'puente', 'waterfall chart'],
    // The start, the floating change and the total: the middle bar starts at the height of the
    // first and reaches the height of the last, with no connectors (they grazed the corners of the
    // bars).
    d: [bar(BX[0], 11.5), sq(BX[1], 4.25, BW, 7.25, 1.15), bar(BX[2], 4.25)],
  },
  'chart-gantt': {
    tags: ['gantt', 'cronograma', 'planeación', 'gantt chart'],
    d: [pill(K0, 4.125, 8.5, 3.25), pill(8.25, 10.375, 9.25, 3.25), pill(13.75, 16.625, 7, 3.25)],
  },
  'chart-treemap': {
    tags: ['mapa de árbol', 'jerarquía', 'proporción', 'treemap'],
    d: [CARD, line([11.25, K0], [11.25, K1]), line([11.25, 10.75], [K1, 10.75]), line([K0, 14.5], [11.25, 14.5]), line([16, 10.75], [16, K1])],
  },
  'chart-combo': {
    tags: ['combinada', 'barras y línea', 'mixta', 'combo chart'],
    d: [bar(BX[0], 14.5), bar(BX[1], 12.25), bar(BX[2], 15.5), rline([[3.25, 10.25], [8.75, 6], [13.75, 8.5], [20.75, 3.5]], SOFT)],
  },
  'chart-radial': {
    tags: ['barras radiales', 'progreso', 'anillos', 'radial chart'],
    d: [arc(12, 12, 9, -90, 180).d, arc(12, 12, 5.5, -90, 90).d, dot(12, 12)],
  },
  'chart-distribution': {
    tags: ['distribución', 'curva normal', 'campana', 'distribution'],
    // No mean line: with it, the bell read as a tent.
    d: ['M2.75 17.25C7.5 17.25 8.25 4.5 12 4.5S16.5 17.25 21.25 17.25', line([K0, K1], [K1, K1])],
  },
  'trend-up': {
    tags: ['tendencia', 'sube', 'crecimiento', 'al alza', 'trending up', 'growth'],
    d: [rline(UP, TREND), head(UP[3], [1, -1], 4.5)],
  },
  'trend-down': {
    tags: ['tendencia', 'baja', 'caída', 'a la baja', 'trending down', 'decline'],
    d: [rline(DOWN, TREND), head(DOWN[3], [1, 1], 4.5)],
  },
  'trend-flat': {
    tags: ['tendencia', 'estable', 'sin cambio', 'trending flat', 'steady'],
    d: [rline(FLAT, TREND), head(FLAT[3], [1, 0], 4.5)],
  },
  'dashboard': {
    tags: ['tablero', 'panel', 'resumen', 'dashboard'],
    // Panels 3 apart (2.5 before: they stuck together at 16 px); the last one has the signature.
    d: [
      sq(K0, K0, 7.25, 17.5, 2.25),
      sq(13.5, K0, 7.25, 7.25, 2.25),
      sq(13.5, 13.5, 7.25, 7.25, 2.25, { square: ['br'] }),
    ],
  },
  'gauge': {
    tags: ['medidor', 'velocidad', 'rendimiento', 'gauge'],
    d: (() => {
      // Center at 14: the arc (from 5 to 18.5) is centered on the canvas. The needle ends 3 from
      // the arc (2.75 before: it grazed it).
      const c = [12, 14];
      return [arc(c[0], c[1], 9, 150, 390).d, circ(c[0], c[1], 1.75), line(polar(c[0], c[1], 1.75, -45), polar(c[0], c[1], 6, -45))];
    })(),
  },
  'analytics': {
    tags: ['análisis', 'analítica', 'explorar datos', 'insights', 'analytics'],
    // The core magnifier (search) with three bars 3 apart, all 3 or more from the ring.
    d: [...SEARCH, line([7.6, 10.6], [7.6, 12.85]), line([10.6, 7.35], [10.6, 12.85]), line([13.6, 9.1], [13.6, 12.85])],
  },

  // Tables and dashboards ----------------------------------------------------------------------
  'table': {
    tags: ['tabla', 'registros', 'filas', 'table'],
    d: [CARD, line([K0, 8.75], [K1, 8.75]), line([10.75, 8.75], [10.75, K1])],
  },
  'kanban': {
    tags: ['kanban', 'tablero', 'columnas', 'board'],
    d: [sq(BX[0], K0, BW, 17.5, 1.15), sq(BX[1], K0, BW, 10.5, 1.15), sq(BX[2], K0, BW, 14, 1.15)],
  },
  'schema': {
    tags: ['esquema', 'modelo de datos', 'relación', 'schema'],
    d: [
      box(K0, K0, 8.5, 7.5, 2.25),
      box(12.25, 13.25, 8.5, 7.5, 2.25),
      rline([[11.75, 8.5], [16.5, 8.5], [16.5, 13.25]], 2),
      line([K0, 6.5], [11.75, 6.5]),
      line([12.25, 16.5], [K1, 16.5]),
    ],
  },

  // Code ---------------------------------------------------------------------------------------
  'braces': {
    tags: ['llaves', 'objeto', 'json', 'curly braces'],
    d: [
      'M8.75 3.25h-.5A2.25 2.25 0 0 0 6 5.5v3.75A2.75 2.75 0 0 1 3.25 12 2.75 2.75 0 0 1 6 14.75v3.75a2.25 2.25 0 0 0 2.25 2.25h.5',
      'M15.25 3.25h.5A2.25 2.25 0 0 1 18 5.5v3.75A2.75 2.75 0 0 0 20.75 12 2.75 2.75 0 0 0 18 14.75v3.75a2.25 2.25 0 0 1-2.25 2.25h-.5',
    ],
  },
  'brackets': {
    tags: ['corchetes', 'lista', 'código', 'brackets'],
    d: [rline([[9.25, 3.25], [5.25, 3.25], [5.25, K1], [9.25, K1]], 2), rline([[14.75, 3.25], [18.75, 3.25], [18.75, K1], [14.75, K1]], 2)],
  },
  'array': {
    tags: ['arreglo', 'lista', 'colección', 'array'],
    d: [
      rline([[6.75, 4.75], [3.5, 4.75], [3.5, 19.25], [6.75, 19.25]], 1.75),
      rline([[17.25, 4.75], [20.5, 4.75], [20.5, 19.25], [17.25, 19.25]], 1.75),
      dot(8.5, 12),
      dot(12, 12),
      dot(15.5, 12),
    ],
  },
  'terminal': {
    tags: ['terminal', 'consola', 'línea de comandos', 'terminal'],
    d: [box(2.5, 5, 19, 14, 4), rline([[6.75, 9.25], [9.5, 12], [6.75, 14.75]], 0), line([12, 14.75], [17, 14.75])],
  },
  'function': {
    tags: ['función', 'fórmula', 'cálculo', 'function'],
    d: [
      'M17.5 4.75C16.9 3.9 15.9 3.4 14.75 3.6 13.4 3.85 12.6 4.9 12.4 6.3L10.6 17.7C10.4 19.1 9.6 20.15 8.25 20.4 7.1 20.6 6.1 20.1 5.5 19.25',
      line([8.25, 9.25], [16, 9.25]),
    ],
  },
  'variable': {
    tags: ['variable', 'valor', 'parámetro', 'variable'],
    d: [
      'M7.25 4.75h-.25a1.75 1.75 0 0 0-1.75 1.75v2.75A2.75 2.75 0 0 1 2.5 12a2.75 2.75 0 0 1 2.75 2.75v2.75a1.75 1.75 0 0 0 1.75 1.75h.25',
      'M16.75 4.75h.25a1.75 1.75 0 0 1 1.75 1.75v2.75A2.75 2.75 0 0 0 21.5 12a2.75 2.75 0 0 0-2.75 2.75v2.75a1.75 1.75 0 0 1-1.75 1.75h-.25',
      line([9.75, 9.75], [14.25, 14.25]),
      line([14.25, 9.75], [9.75, 14.25]),
    ],
  },
  'sum': {
    tags: ['suma', 'sigma', 'total', 'sum'],
    d: [rline([[17.75, 6.5], [17.75, 4.25], [6.25, 4.25], [12.5, 12], [6.25, 19.75], [17.75, 19.75], [17.75, 17.5]], [0, 1, 0.6, 0.6, 0.6, 1, 0])],
  },
  'code-window': {
    tags: ['ventana de código', 'editor', 'desarrollo', 'code editor'],
    // The chevrons 3 from the bar and 3.25 from the bottom edge (2.75 from the bar before: they
    // grazed it).
    d: [
      box(2.5, 4, 19, 16, 4),
      line([2.5, 8.75], [21.5, 8.75]),
      rline([[9.5, 11.75], [7.25, 14.25], [9.5, 16.75]], 0),
      rline([[14.5, 11.75], [16.75, 14.25], [14.5, 16.75]], 0),
    ],
  },

  // Git ----------------------------------------------------------------------------------------
  'git-branch': {
    tags: ['rama', 'git', 'bifurcación', 'nueva rama', 'branch'],
    // Time runs upward: the branch leaves the trunk like a lane change and ends at the top, at its
    // node.
    d: [circ(6.25, 18.4, GR), line([6.25, K0], [6.25, 16.05]), 'M6.25 15.25C6.25 11.25 17.75 12.75 17.75 8.75V7.95', circ(17.75, 5.6, GR)],
  },
  'git-commit': {
    tags: ['commit', 'git', 'confirmación', 'versión', 'commit'],
    d: [circ(12, 12, 3.75), line([2.5, 12], [8.25, 12]), line([15.75, 12], [21.5, 12])],
  },
  'git-merge': {
    tags: ['fusionar', 'merge', 'git', 'unir ramas', 'merge branch'],
    // The mirror of git-branch: the branch starts at the bottom and merges into the trunk like a
    // lane change.
    d: [circ(6.25, 18.4, GR), line([6.25, 7.95], [6.25, 16.05]), circ(6.25, 5.6, GR), circ(17.75, 18.4, GR), 'M17.75 16.05V15C17.75 11.25 6.25 12.75 6.25 8.75'],
  },
  'git-pull-request': {
    tags: ['pull request', 'revisión', 'git', 'solicitud de cambios'],
    d: [
      circ(6.25, 5.6, GR),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(6.25, 18.4, GR),
      circ(17.75, 18.4, GR),
      rline([[17.75, 16.05], [17.75, 5.6], [11.75, 5.6]], 3.5),
      head([11.75, 5.6], [-1, 0], 3.4),
    ],
  },
  'git-pull-request-closed': {
    tags: ['pull request cerrado', 'rechazado', 'git', 'closed'],
    d: [
      circ(6.25, 5.6, GR),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(6.25, 18.4, GR),
      circ(17.75, 18.4, GR),
      line([17.75, 16.05], [17.75, 11.25]),
      line([15.75, 3.6], [19.75, 7.6]),
      line([19.75, 3.6], [15.75, 7.6]),
    ],
  },
  'git-pull-request-draft': {
    tags: ['borrador', 'pull request', 'git', 'draft'],
    d: [
      circ(6.25, 5.6, GR),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(6.25, 18.4, GR),
      circ(17.75, 18.4, GR),
      dot(17.75, 12.75),
      dot(17.75, 9),
      dot(17.75, 5.25),
    ],
  },
  'git-fork': {
    tags: ['fork', 'bifurcar', 'copia del repositorio', 'git', 'repository fork'],
    // A Y of tangent curves: the two copies leave the same trunk with no elbows.
    d: [
      circ(12, 18.4, GR),
      'M6.25 7.95C6.25 11.5 12 10.5 12 14.25V16.05',
      'M17.75 7.95C17.75 11.5 12 10.5 12 14.25',
      circ(6.25, 5.6, GR),
      circ(17.75, 5.6, GR),
    ],
  },
  'git-compare': {
    tags: ['comparar', 'diferencias', 'git', 'compare'],
    d: [
      circ(5.6, 5.6, 2.35),
      rline([[7.95, 5.6], [18.4, 5.6], [18.4, 12.5]], 3.5),
      head([18.4, 12.5], [0, 1], 3.4),
      circ(18.4, 18.4, 2.35),
      rline([[16.05, 18.4], [5.6, 18.4], [5.6, 11.5]], 3.5),
      head([5.6, 11.5], [0, -1], 3.4),
    ],
  },

  // Testing ------------------------------------------------------------------------------------
  'bug': {
    tags: ['error', 'bicho', 'falla', 'depurar', 'bug', 'debug'],
    // The body has rounded shoulders (they used to be sharp corners, foreign to the set). The
    // bottom legs start on the body's arc (they used to sit 0.4 away: they grazed it).
    d: (() => {
      const foot = (a) => polar(12, 14, 5.25, a);
      return [
        'M6.75 14V11A2.5 2.5 0 0 1 9.25 8.5H14.75A2.5 2.5 0 0 1 17.25 11V14A5.25 5.25 0 0 1 6.75 14Z',
        'M9.25 8.5A2.75 2.75 0 0 1 14.75 8.5',
        line([12, 8.5], [12, 19.25]),
        line([6.75, 12.75], [3.5, 12.75]),
        line(foot(141.5), [4.5, 19.75]),
        line([17.25, 12.75], [20.5, 12.75]),
        line(foot(38.5), [19.5, 19.75]),
      ];
    })(),
  },
  'flask': {
    tags: ['matraz', 'prueba', 'experimento', 'laboratorio', 'test', 'testing'],
    d: [
      rline([[9.75, K0], [9.75, 9.25], [3.75, K1], [20.25, K1], [14.25, 9.25], [14.25, K0]], [0, 1.5, 1.75, 1.75, 1.5, 0]),
      line([8.25, K0], [15.75, K0]),
      line([6.88, 14.75], [17.12, 14.75]),
    ],
  },
  'test-tube': {
    tags: ['tubo de ensayo', 'laboratorio', 'prueba', 'test tube'],
    d: (() => {
      const T = (p) => rot(p, [12, 12], 35);
      return [
        tp([['M', [9.5, 3.5]], ['L', [9.5, 16.5]], ['A', 2.5, 0, 0, [14.5, 16.5]], ['L', [14.5, 3.5]]], T),
        tp([['M', [7.75, 3.5]], ['L', [16.25, 3.5]]], T),
        tp([['M', [9.5, 11.75]], ['L', [14.5, 11.75]]], T),
      ];
    })(),
  },

  // Connections and infrastructure ---------------------------------------------------------------
  'api': {
    tags: ['api', 'conexión', 'integración', 'conector', 'endpoint', 'plug'],
    d: (() => {
      const T = (p) => rot([12 + p[0], 12 + p[1]], [12, 12], -45);
      return [
        tp([['M', [-12.25, 0]], ['L', [-8.25, 0]]], T),
        tp([['M', [-3.25, -3.75]], ['L', [-4.5, -3.75]], ['A', 3.75, 0, 0, [-4.5, 3.75]], ['L', [-3.25, 3.75]], ['Z']], T),
        tp([['M', [3.25, -3.75]], ['L', [4.5, -3.75]], ['A', 3.75, 0, 1, [4.5, 3.75]], ['L', [3.25, 3.75]], ['Z']], T),
        tp([['M', [8.25, 0]], ['L', [12.25, 0]]], T),
        tp([['M', [3.25, -1.75]], ['L', [0.25, -1.75]], ['M', [3.25, 1.75]], ['L', [0.25, 1.75]]], T),
      ];
    })(),
  },
  'webhook': {
    tags: ['webhook', 'evento', 'notificación', 'callback'],
    // A hook that calls back: the git node (r 2.35) and a U of r 5.25 that fills the live area (it
    // used to weigh less than its neighbors).
    d: [circ(17, 5.6, GR), 'M17 7.95V14.5A5.25 5.25 0 0 1 6.5 14.5V11', head([6.5, 11], [0, -1], 3.4)],
  },
  'cpu': {
    tags: ['procesador', 'chip', 'cómputo', 'cpu'],
    d: [
      sq(6, 6, 12, 12, 3.25),
      sq(9.5, 9.5, 5, 5, 1.5),
      [9.5, 14.5].map((x) => line([x, K0], [x, 6])).join(''),
      [9.5, 14.5].map((x) => line([x, 18], [x, K1])).join(''),
      [9.5, 14.5].map((y) => line([K0, y], [6, y])).join(''),
      [9.5, 14.5].map((y) => line([18, y], [K1, y])).join(''),
    ],
  },
  'ai-chip': {
    tags: ['chip de ia', 'modelo', 'inteligencia artificial', 'ai chip'],
    d: [
      sq(6, 6, 12, 12, 3.25),
      star4(12, 12, 3.5),
      [9.5, 14.5].map((x) => line([x, K0], [x, 6])).join(''),
      [9.5, 14.5].map((x) => line([x, 18], [x, K1])).join(''),
      [9.5, 14.5].map((y) => line([K0, y], [6, y])).join(''),
      [9.5, 14.5].map((y) => line([18, y], [K1, y])).join(''),
    ],
  },
  'server': {
    tags: ['servidor', 'hosting', 'infraestructura', 'server'],
    // Two units like the ones in `archivos` (`external-drive`, `file-server`): the slot on the left
    // and the light on the right. 16 × 6.5 and 3 apart: at 17.5 × 7.25 it went over 28 % ink.
    d: [
      box(4, 4, 16, 6.5, 2),
      box(4, 13.5, 16, 6.5, 2),
      line([7.5, 7.25], [11, 7.25]),
      dot(16, 7.25),
      line([7.5, 16.75], [11, 16.75]),
      dot(16, 16.75),
    ],
  },
  'cloud-compute': {
    tags: ['nube', 'cómputo en la nube', 'servidor remoto', 'cloud computing'],
    // The file cloud (same three lobes and base at 18.25) with the terminal prompt, 3 or more from
    // the outline (the chevron's tip used to sit 2.4 from the left lobe).
    d: [
      cloud([7.25, 14.25, 4], [12.5, 10.75, 5.5], [17.25, 14.5, 3.75], 18.25),
      rline([[9.75, 11.25], [11.75, 13.25], [9.75, 15.25]], 0),
      line([14, 15.25], [16.25, 15.25]),
    ],
  },
  'container': {
    tags: ['contenedor', 'docker', 'imagen', 'despliegue', 'container'],
    // A shipping container with its ribs. It used to be three stacked boxes that touched (1.5
    // between strokes) and merged at 18 px.
    d: [box(2.5, 5, 19, 14, 4), ...[7.25, 12, 16.75].map((x) => line([x, 8.75], [x, 15.25]))],
  },
  'rocket': {
    tags: ['cohete', 'lanzamiento', 'despliegue', 'deploy'],
    // The window is a dot: a ring (r 1.6) sat 1.64 from the walls, center to center, and merged
    // with them at bold; there is no room in the body for a ring that keeps its hole and its air.
    d: (() => {
      const k = 1.08;
      const T = (p) => rot([12 + (p[0] - 12) * k, 12 + (p[1] - 12) * k], [12, 12], 45);
      return [
        tp([['M', [9, 15.25]], ['L', [9, 9.5]], ['C', [9, 6.5], [10.25, 4.25], [12, 2.75]], ['C', [13.75, 4.25], [15, 6.5], [15, 9.5]], ['L', [15, 15.25]], ['Z']], T),
        tp([['M', [9, 11.75]], ['L', [6.5, 14.25]], ['L', [6.5, 17.5]], ['L', [9, 15.25]]], T),
        tp([['M', [15, 11.75]], ['L', [17.5, 14.25]], ['L', [17.5, 17.5]], ['L', [15, 15.25]]], T),
        dot(...T([12, 9.25])),
        tp([['M', [12, 18.25]], ['L', [12, 20.5]]], T),
      ];
    })(),
  },
  'pulse': {
    tags: ['pulso', 'monitoreo', 'actividad', 'disponibilidad', 'activity', 'monitoring', 'heartbeat'],
    d: [rline([[2.5, 12.5], [6.5, 12.5], [9, 6.25], [14, 18], [16.5, 12.5], [21.5, 12.5]], [0, 0.6, 0.6, 0.6, 0.6, 0])],
  },
  'log': {
    tags: ['registro', 'bitácora', 'eventos', 'log', 'logs', 'audit trail'],
    // Lines 3.75 from their dot (at 3 they grazed: the edge of the dot sat 2.3 from the line).
    d: [CARD, ...[8.5, 12, 15.5].flatMap((y) => [dot(7.75, y), line([11.5, y], [16.25, y])])],
  },

  // Structures and flows -------------------------------------------------------------------------
  'network': {
    tags: ['red', 'nodos', 'conexiones', 'network'],
    d: (() => {
      const c = [12, 13.5];
      const A = [-90, 30, 150];
      return [
        circ(c[0], c[1], 2.5),
        ...A.map((a) => line(polar(c[0], c[1], 2.5, a), polar(c[0], c[1], 5.75, a))),
        ...A.map((a) => circ(...polar(c[0], c[1], 8, a), 2.25)),
      ];
    })(),
  },
  'node-graph': {
    tags: ['grafo', 'nodos', 'relaciones', 'grafo de conocimiento', 'graph', 'knowledge graph'],
    // A real graph: nodes of different weights and irregular edges. The old one was a symmetric bow
    // tie that read as an X between two bars at 18 px.
    d: (() => {
      const N = [[5.75, 6.25, 2.25], [18, 5.5, 1.75], [16, 15.25, 2.75], [6, 18.25, 1.75]];
      const E = [[0, 1], [0, 2], [1, 2], [2, 3], [0, 3]];
      return [...N.map(([x, y, r]) => circ(x, y, r)), ...E.map(([a, b]) => edge(N[a], N[b], N[a][2], N[b][2]))];
    })(),
  },
  'hierarchy': {
    tags: ['jerarquía', 'árbol', 'niveles', 'hierarchy'],
    d: [
      circ(12, 5.6, 2.35),
      line([12, 7.95], [12, 12]),
      rline([[5.6, 16.05], [5.6, 12], [18.4, 12], [18.4, 16.05]], 2.5),
      circ(5.6, 18.4, 2.35),
      circ(18.4, 18.4, 2.35),
    ],
  },
  'sitemap': {
    tags: ['mapa del sitio', 'estructura', 'páginas', 'sitemap'],
    // Three child pages across the landscape width (19), exactly 3 apart: they used to sit 2.75
    // apart and stuck together at 18 px.
    d: (() => {
      const w = (19 - 6) / 3;
      const xs = [2.5, 2.5 + w + 3, 2.5 + 2 * (w + 3)];
      return [
        box(8.25, K0, 7.5, 5.5, 1.7),
        line([12, 8.75], [12, 15.5]),
        rline([[xs[0] + w / 2, 15.5], [xs[0] + w / 2, 12], [xs[2] + w / 2, 12], [xs[2] + w / 2, 15.5]], 1.5),
        ...xs.map((x) => box(x, 15.5, w, 5.25, 1.35)),
      ];
    })(),
  },
  'flowchart': {
    tags: ['diagrama de flujo', 'proceso', 'algoritmo', 'decisión', 'flowchart', 'algorithm'],
    // The connector reaches the diamond's rounded vertex (it used to end 0.4 short of it).
    d: [
      box(K0, K0, 8, 6, 1.85),
      rline([[7.25, 9.25], [7.25, 15.75], [11.75 + INSET(1), 15.75]], 2.5),
      roundpoly([[16.25, 11.25], [20.75, 15.75], [16.25, 20.25], [11.75, 15.75]], 1),
    ],
  },
  'workflow': {
    tags: ['flujo de trabajo', 'automatización', 'pasos', 'workflow'],
    // Two diagonal steps of 6: that way the connector's last segment is long enough for its
    // arrowhead, and the arrowhead sits 3 from the second box (2.25 before: it almost touched it).
    d: [sq(K0, K0, 6, 6, 1.85), rline([[9.25, 6.25], [17.75, 6.25], [17.75, 11.75]], 2), head([17.75, 11.75], [0, 1], 3), box(14.75, 14.75, 6, 6, 1.85)],
  },
  'automation': {
    tags: ['automatización', 'disparador', 'ciclo', 'automation'],
    d: (() => {
      const a = arc(12, 12, 9, -60, 240);
      return [a.d, head(a.end, a.tangent, 3.4), roundpoly([[13.25, 6.25], [8.25, 13], [12, 13], [10.75, 17.75], [15.75, 11], [12, 11]], 0.5)];
    })(),
  },

  // Artificial intelligence ----------------------------------------------------------------------
  'sparkle': {
    tags: ['chispa', 'ia', 'mágico', 'sparkle'],
    d: [star4(12, 12, 9.25)],
  },
  'sparkles': {
    tags: ['chispas', 'ia', 'generar', 'sparkles'],
    d: [star4(10, 13.5, 7.5), star4(18.25, 5.5, 3.25)],
  },
  'search-sparkle': {
    tags: ['búsqueda con ia', 'búsqueda inteligente', 'semántica', 'ai search'],
    d: [...SEARCH, star4(10.6, 10.6, 3.75)],
  },
  'robot': {
    tags: ['robot', 'bot', 'ia', 'automatización', 'ai bot'],
    d: [box(4.75, 8, 14.5, 12.25, 3.75), line([12, 8], [12, 5.5]), circ(12, 4.25, 1.25), line([9.25, 12.75], [9.25, 14.75]), line([14.75, 12.75], [14.75, 14.75])],
  },
  'chatbot': {
    tags: ['chatbot', 'asistente', 'bot', 'conversación con ia'],
    d: [drop(12, 11.75, 8.75), line([9, 10.25], [9, 12.75]), line([15, 10.25], [15, 12.75])],
  },
  'brain': {
    tags: ['cerebro', 'inteligencia', 'conocimiento', 'brain'],
    d: (() => {
      const half = [
        ['M', [12, 5.5]],
        ['C', [11.3, 4.3], [9.9, 3.6], [8.5, 3.9]],
        ['C', [6.6, 4.3], [5.4, 6], [5.6, 7.9]],
        ['C', [3.9, 8.7], [3, 10.5], [3.4, 12.4]],
        ['C', [3.7, 14], [4.6, 15.1], [5.9, 15.6]],
        ['C', [5.8, 17.8], [7.5, 19.7], [9.7, 19.8]],
        ['C', [10.7, 19.9], [11.5, 19.4], [12, 18.6]],
      ];
      const folds = [
        [['M', [5.6, 7.9]], ['C', [6.6, 8.1], [7.4, 8.8], [7.75, 9.75]]],
        [['M', [5.9, 15.6]], ['C', [7.25, 15.6], [8.5, 14.75], [9, 13.5]]],
      ];
      const M = (p) => [24 - p[0], p[1]];
      return [tp(half), tp(half, M), line([12, 5.5], [12, 18.6]), ...folds.map((f) => tp(f)), ...folds.map((f) => tp(f, M))];
    })(),
  },
  'atom': {
    tags: ['átomo', 'ciencia', 'partículas', 'atom'],
    // Orbits of 8.75 (the vertical one runs exactly from 3.25 to 20.75 of the set's square) and 3.5
    // tall, which leave clearance around the nucleus: at 9.25 it went over 28 % ink.
    d: [dot(12, 12), ...[30, 90, 150].map((a) => rell(12, 12, 8.75, 3.5, a))],
  },
  'neural-network': {
    tags: ['red neuronal', 'aprendizaje automático', 'modelo', 'neural network'],
    d: (() => {
      const r = 1.75;
      const N = { a: [4.25, 7.25], b: [4.25, 16.75], c: [12, 7.25], d: [12, 16.75], e: [19.75, 12] };
      return [
        ...Object.values(N).map((p) => circ(p[0], p[1], r)),
        ...[['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'e'], ['d', 'e']].map(([x, y]) => edge(N[x], N[y], r)),
      ];
    })(),
  },
  'prompt': {
    tags: ['prompt', 'instrucción', 'pedir a la ia', 'ai prompt'],
    // The sparkle opens the field and the text follows it: the old symmetrical "− ✦" looked like a
    // game controller.
    d: [box(2.5, 6, 19, 12, 4), star4(7.5, 12, 2.75), line([13.25, 12], [17.75, 12])],
  },

  // Components and 3D --------------------------------------------------------------------------
  'component': {
    tags: ['componente', 'bloque', 'módulo', 'component'],
    d: [box(K0, 8.5, 17.5, 10.75, 3.25), rline([[6.25, 8.5], [6.25, 5.25], [10.25, 5.25], [10.25, 8.5]], 1.25), rline([[13.75, 8.5], [13.75, 5.25], [17.75, 5.25], [17.75, 8.5]], 1.25)],
  },
  'puzzle': {
    tags: ['rompecabezas', 'extensión', 'plugin', 'puzzle'],
    d: ['M3.25 8.75A2 2 0 0 1 5.25 6.75H8.57A2.25 2.25 0 1 1 11.93 6.75H15.25A2 2 0 0 1 17.25 8.75V12.07A2.25 2.25 0 1 1 17.25 15.43V20.75H5.25A2 2 0 0 1 3.25 18.75Z'],
  },
  'cube': {
    tags: ['cubo', '3d', 'modelo 3d', 'cube', '3d model'],
    d: [
      roundpoly([[3.25, 8.5], [8.5, 3.25], [20.75, 3.25], [20.75, 15.5], [15.5, 20.75], [3.25, 20.75]], 1.25),
      rline([[3.25, 8.5], [15.5, 8.5], [20.75, 3.25]], 0),
      line([15.5, 8.5], [15.5, 20.75]),
    ],
  },
  'axis-3d': {
    tags: ['ejes', '3d', 'coordenadas', 'axis', 'coordinates'],
    d: [
      line([9.5, 14.5], [9.5, K0]),
      head([9.5, K0], [0, -1], 3),
      line([9.5, 14.5], [K1, 14.5]),
      head([K1, 14.5], [1, 0], 3),
      line([9.5, 14.5], [3.75, 20.25]),
      head([3.75, 20.25], [-1, 1], 3),
    ],
  },

  // Databases ----------------------------------------------------------------------------------
  // The full core database with the badge on top: the engine clears it with 1.5 of clearance.
  'database-plus': {
    tags: ['nueva base de datos', 'agregar datos', 'crear tabla', 'add database'],
    d: DB_D,
    badge: badge('plus'),
  },
  'database-check': {
    tags: ['datos validados', 'base de datos lista', 'verificado', 'database check'],
    d: DB_D,
    badge: badge('check'),
  },
  'database-search': {
    tags: ['consulta', 'query', 'buscar datos', 'database search'],
    d: DB_D,
    badge: badge('search'),
  },
  'database-sync': {
    tags: ['sincronizar datos', 'réplica', 'actualizar', 'database sync'],
    d: DB_D,
    badge: badge('sync'),
  },

  // Filters and experiments ----------------------------------------------------------------------
  'data-filter': {
    tags: ['filtrar datos', 'filtro', 'segmentar', 'data filter', 'filter data'],
    d: [roundpoly([[K0, 7.25], [K1, 7.25], [13.75, 14.25], [13.75, K1], [10.25, K1], [10.25, 14.25]], [1.25, 1.25, 1, 0.6, 0.6, 1]), dot(7, 3.75), dot(12, 3.75), dot(17, 3.75)],
  },
  'ab-test': {
    tags: ['prueba a/b', 'experimento', 'variantes', 'ab test'],
    d: [line([12, K1], [12, 14.25]), line([12, 14.25], [6, 8.25]), head([6, 8.25], [-1, -1], 4.5), line([12, 14.25], [18, 8.25]), head([18, 8.25], [1, -1], 4.5)],
  },
  'tree-view': {
    tags: ['árbol', 'estructura', 'anidado', 'tree view'],
    // The two children used to sit 1.5 apart (they touched); now 3, and every node has the
    // signature.
    d: [
      box(K0, K0, 6.5, 4, 1.25),
      rline([[6.5, 7.25], [6.5, 18.75], [12, 18.75]], 2.25),
      line([6.5, 11.75], [12, 11.75]),
      box(12, 9.75, 8.75, 4, 1.25),
      box(12, 16.75, 8.75, 4, 1.25),
    ],
  },
  'chart-progress': {
    tags: ['progreso', 'avance', 'barras de progreso', 'progress'],
    // Capsules of 6: the progress sits 3 from the edge (2.5 before, with no clearance).
    d: [pill(2.5, 4.5, 19, 6), pill(2.5, 13.5, 19, 6), line([5.5, 7.5], [14.5, 7.5]), line([5.5, 16.5], [10, 16.5])],
  },
  'chart-forecast': {
    tags: ['pronóstico', 'proyección', 'predicción', 'forecast'],
    d: [rline([[K0, 15.5], [8.25, 10.25], [12.25, 13.25]], SOFT), dot(15, 10.75), dot(17.75, 8.25), dot(20.5, 5.75), line([K0, K1], [K1, K1])],
  },
  'target': {
    tags: ['objetivo', 'meta', 'kpi', 'target'],
    d: [circ(12, 12, 9), circ(12, 12, 5.25), dot(12, 12)],
  },
  'venn': {
    tags: ['intersección', 'conjuntos', 'unión de tablas', 'join', 'venn', 'sets'],
    d: [circ(8.75, 12, 6.25), circ(15.25, 12, 6.25)],
  },
  'matrix': {
    tags: ['matriz', 'tabla de valores', 'cuadrícula', 'matrix'],
    d: [
      rline([[6.75, 4.75], [3.5, 4.75], [3.5, 19.25], [6.75, 19.25]], 1.75),
      rline([[17.25, 4.75], [20.5, 4.75], [20.5, 19.25], [17.25, 19.25]], 1.75),
      ...[8.25, 12, 15.75].flatMap((y) => [8.25, 12, 15.75].map((x) => dot(x, y, 0.3))),
    ],
  },
  'math': {
    tags: ['matemáticas', 'operaciones', 'cálculo', 'math'],
    d: [
      line([7.5, 4.5], [7.5, 10.5]),
      line([4.5, 7.5], [10.5, 7.5]),
      line([13.5, 7.5], [19.5, 7.5]),
      line([5.4, 14.4], [9.6, 18.6]),
      line([9.6, 14.4], [5.4, 18.6]),
      line([13.5, 15], [19.5, 15]),
      line([13.5, 18], [19.5, 18]),
    ],
  },
  'diff': {
    tags: ['diferencias', 'cambios', 'comparar versiones', 'diff'],
    // Plus and minus 8.5 wide, centered on the canvas (they used to weigh less than their
    // neighbors).
    d: [line([12, 4.75], [12, 13.25]), line([7.75, 9], [16.25, 9]), line([7.75, 19.25], [16.25, 19.25])],
  },
  'regex': {
    tags: ['expresión regular', 'patrón', 'búsqueda', 'regex', 'regular expression'],
    d: [dot(6.25, 17.75), line([15, 4.5], [15, 13.5]), line(polar(15, 9, 4.5, -30), polar(15, 9, 4.5, 150)), line(polar(15, 9, 4.5, 30), polar(15, 9, 4.5, 210))],
  },
  'lambda': {
    tags: ['lambda', 'función', 'serverless', 'función anónima'],
    d: [rline([[5.5, 3.75], [7.25, 3.75], [17.25, 20.25], [19, 20.25]], 1), line([11.89, 11.4], [5.25, 20.25])],
  },
  'binary': {
    tags: ['binario', 'bits', 'datos', 'binary'],
    d: [
      rline([[5.5, 4.75], [7, K0], [7, 10.25]], 0),
      pill(13.75, K0, 4.5, 7),
      pill(4.75, 13.75, 4.5, 7),
      rline([[14.5, 15.25], [16, 13.75], [16, K1]], 0),
    ],
  },
  'code-sparkle': {
    tags: ['código con ia', 'generar código', 'asistente', 'ai code'],
    d: [rline([[7.5, 7.5], [3, 12], [7.5, 16.5]], 0), rline([[16.5, 7.5], [21, 12], [16.5, 16.5]], 0), star4(12, 12, 2.9)],
  },
  'condition': {
    tags: ['condición', 'si no', 'decisión', 'algoritmo', 'if else', 'branching'],
    // The lines reach the diamond's rounded vertices (they used to end 0.4 short of them).
    d: [
      line([12, K0], [12, 7.5 + INSET(1)]),
      roundpoly([[12, 7.5], [16.5, 12], [12, 16.5], [7.5, 12]], 1),
      rline([[7.5 + INSET(1), 12], [4.5, 12], [4.5, 20.25]], 2),
      head([4.5, 20.25], [0, 1], 3),
      rline([[16.5 - INSET(1), 12], [19.5, 12], [19.5, 20.25]], 2),
      head([19.5, 20.25], [0, 1], 3),
    ],
  },
  'infinity': {
    tags: ['ciclo continuo', 'devops', 'infinito', 'infinity'],
    d: ['M12 12C10.25 9.25 8.75 7.75 6.75 7.75 4.4 7.75 2.5 9.65 2.5 12S4.4 16.25 6.75 16.25C8.75 16.25 10.25 14.75 12 12S15.25 7.75 17.25 7.75C19.6 7.75 21.5 9.65 21.5 12S19.6 16.25 17.25 16.25C15.25 16.25 13.75 14.75 12 12Z'],
  },
  'git-graph': {
    tags: ['historial', 'commits', 'git', 'git history', 'commit graph'],
    d: [
      circ(7, 5, 1.9),
      line([7, 6.9], [7, 10.1]),
      circ(7, 12, 1.9),
      line([7, 13.9], [7, 17.1]),
      circ(7, 19, 1.9),
      'M8.9 5H12.5A4.5 4.5 0 0 1 17 9.5V10.1',
      circ(17, 12, 1.9),
      'M17 13.9V14.5A4.5 4.5 0 0 1 12.5 19H8.9',
    ],
  },
  'server-rack': {
    tags: ['rack', 'centro de datos', 'servidores', 'data center'],
    // The rack with three units, each with its light on the right, as in `server`. With light and
    // slot it went over 28 % ink and the light got tucked into the corner; without slots it isn't
    // confused with `filing-cabinet` either (handles in the middle).
    d: [
      box(4.75, 2.75, 14.5, 18.5, 3.75),
      line([4.75, 8.92], [19.25, 8.92]),
      line([4.75, 15.08], [19.25, 15.08]),
      ...[5.83, 12, 18.17].map((y) => dot(15.25, y)),
    ],
  },
  'memory': {
    tags: ['memoria', 'ram', 'hardware', 'memory'],
    // Chips and board exactly 3 apart (2.5–2.75 before: they clogged up at 18 px).
    d: [
      box(2.5, 5.5, 19, 10, 2.75),
      sq(5.5, 8.5, 5, 4, 1.2),
      sq(13.5, 8.5, 5, 4, 1.2),
      [5.5, 8.5, 11.5, 15.5, 18.5].map((x) => line([x, 15.5], [x, 18.5])).join(''),
    ],
  },
  'load-balancer': {
    tags: ['balanceador', 'distribuir', 'tráfico', 'load balancer'],
    // Outputs 7.25 apart: the arrowheads end up 3 apart (they used to almost touch).
    d: [
      circ(5, 12, GR),
      line([7.35, 12], [20.25, 12]),
      head([20.25, 12], [1, 0], 3),
      rline([[7.35, 12], [10.25, 12], [14, 4.75], [20.25, 4.75]], 1.75),
      head([20.25, 4.75], [1, 0], 3),
      rline([[7.35, 12], [10.25, 12], [14, 19.25], [20.25, 19.25]], 1.75),
      head([20.25, 19.25], [1, 0], 3),
    ],
  },
  'database-export': {
    tags: ['exportar datos', 'extraer', 'descargar base', 'export'],
    d: DB_D,
    badge: badge('arrow-up'),
  },
  'database-import': {
    tags: ['importar datos', 'cargar', 'migrar', 'import'],
    d: DB_D,
    badge: badge('arrow-down'),
  },

  // Coverage (round 2) -------------------------------------------------------------------------
  'presentation': {
    tags: ['presentación', 'pizarra', 'exponer', 'junta', 'presentation', 'slides', 'pitch'],
    // The landscape whiteboard (a container: the signature), the rising trend and the Λ easel that
    // comes out of the center of its bottom edge.
    d: [
      box(2.5, 3.25, 19, 12.75, 3),
      rline([[8, 21], [12, 16], [16, 21]], 0.6),
      rline([[6.5, 12], [9.75, 8.75], [12.75, 10.75], [17.25, 6.75]], 0.6),
    ],
  },
  // Standalone operators: the same lengths as the core `plus` and `minus` from `sistema`; the
  // equals sign is shorter than `menu-compact` so the two aren't confused.
  'equals': {
    tags: ['igual', 'resultado', 'equivale', 'fórmula', 'equals', 'equal', 'result'],
    d: [line([5.5, 9.5], [18.5, 9.5]), line([5.5, 14.5], [18.5, 14.5])],
  },
  'divide': {
    tags: ['dividir', 'división', 'entre', 'operación', 'divide', 'division', 'math'],
    d: [line([4.25, 12], [19.75, 12]), dot(12, 7), dot(12, 17)],
  },

  // Charts (round 5) ---------------------------------------------------------------------------
  // Every chart keeps chart-bar's bars (3.75 wide, corners of 1.15), the baseline at 20.75 and the
  // corner axes of chart-scatter.
  'chart-bar-grouped': {
    tags: ['barras agrupadas', 'comparar series', 'barras dobles', 'grouped bar chart', 'clustered bars'],
    // Two pairs of bars (3.63 wide, 3 apart): each pair one silhouette, as chart-histogram, its two
    // bars split by the edge they share.
    d: (() => {
      const w = (17.5 - 3) / 4;
      const pair = (x, a, b) => {
        const m = x + w;
        const R = a < b ? [0, 1.15, 1.15, 0, 1.15, 0] : [0, 1.15, 0, 1.15, 1.15, 0];
        return [roundpoly([[x, K1], [x, a], [m, a], [m, b], [x + 2 * w, b], [x + 2 * w, K1]], R), line([m, Math.max(a, b)], [m, K1])];
      };
      return [...pair(K0, 6.5, 11.5), ...pair(K0 + 2 * w + 3, 10, K0)];
    })(),
  },
  'chart-bar-horizontal-stacked': {
    tags: ['barras horizontales apiladas', 'encuesta', 'composición por fila', 'likert', 'stacked horizontal bar chart'],
    // chart-bar-horizontal's rows (as chart-bar-stacked keeps chart-bar's bars at its own heights),
    // the outer two a little shorter so the three splits stay under the set's density.
    d: [
      sq(K0, 3.25, 12, BW, 1.15, { square: ['tl', 'bl'] }),
      sq(K0, 10.125, 17.5, BW, 1.15, { square: ['tl', 'bl'] }),
      sq(K0, 17, 9.25, BW, 1.15, { square: ['tl', 'bl'] }),
      line([9.75, 3.25], [9.75, 3.25 + BW]),
      line([13.75, 10.125], [13.75, 10.125 + BW]),
      line([7.5, 17], [7.5, 17 + BW]),
    ],
  },
  'chart-bar-diverging': {
    tags: ['barras divergentes', 'positivo y negativo', 'pirámide', 'a favor y en contra', 'diverging bar chart'],
    d: [
      line([12, 3.375], [12, 20.625]),
      sq(12, 3.375, 8.75, BW, 1.15, { square: ['tl', 'bl'] }),
      sq(4.25, 10.125, 7.75, BW, 1.15, { square: ['tr', 'br'] }),
      sq(12, 16.875, 5, BW, 1.15, { square: ['tl', 'bl'] }),
    ],
  },
  'chart-lollipop': {
    tags: ['gráfica de paleta', 'ranking', 'puntos y tallos', 'lollipop chart', 'dot plot'],
    d: [[5.5, 10.25], [12, 5.5], [18.5, 12.5]].flatMap(([x, y]) => [line([x, K1], [x, y + 2.25]), circ(x, y, 2.25)]).concat(line([K0, K1], [K1, K1])),
  },
  'chart-bullet': {
    tags: ['gráfica de bala', 'meta', 'kpi contra objetivo', 'rangos', 'bullet chart', 'target'],
    // The bar of two ranges (split at 14.25), the measure running through the first one, 3 from
    // its edges, and the target crossing the bar 3 from its end. (A measure 4 long read as a minus
    // sign in a box.)
    d: [sq(2.5, 7.5, 19, 9, 2.25), line([14.25, 7.5], [14.25, 16.5]), line([5.5, 12], [11.25, 12]), line([18.5, 5], [18.5, 19])],
  },
  'chart-error-bars': {
    tags: ['barras de error', 'incertidumbre', 'intervalo', 'desviación', 'error bars', 'uncertainty'],
    // Each value a ring (r 1.75) with its range above and below, capped like an I.
    d: [[5.5, 13, 8.5, 17.5], [12, 8.5, 3.25, 14], [18.5, 15, 10, 20.75]].flatMap(([x, y, top, bottom]) => [
      circ(x, y, 1.75),
      line([x - 2, top], [x + 2, top]) + line([x, top], [x, y - 1.75]) + line([x, y + 1.75], [x, bottom]) + line([x - 2, bottom], [x + 2, bottom]),
    ]),
  },
  'chart-area-stacked': {
    tags: ['área apilada', 'series acumuladas', 'participación', 'stacked area chart'],
    // chart-area with a second series inside it, 3.5 or more from the top everywhere.
    d: [
      roundpoly([[3.25, 20.75], [3.25, 14.5], [8.5, 8.75], [12.75, 12.5], [20.75, 4.5], [20.75, 20.75]], [0, 1, 1.5, 1.5, 1, 0]),
      rline([[K0, 17.75], [8.5, 14], [12.75, 16.25], [K1, 10.75]], SOFT),
    ],
  },
  'chart-streamgraph': {
    tags: ['streamgraph', 'flujo de series', 'temas en el tiempo', 'tendencias', 'streamgraph', 'stream chart'],
    // Two stacked streams that swell and meander together, in phase, with no baseline: they rise
    // out of a point at the left and run on to the right edge, cut there as the chart's present. (A
    // ribbon pointed at both ends read as lips, or as a leaf with its midrib.)
    d: (() => {
      const a = [2.5, 13.5];
      const top = smooth([a, [6.75, 8.75], [11.5, 10], [16.25, 6.25], [21.5, 7.5]]);
      const bottom = smooth([[21.5, 15.5], [16.25, 14], [11.5, 17.25], [6.75, 15.25], a]);
      return [`${top}L21.5 15.5${bottom.replace(/^M[^C]*/, '')}Z`, smooth([a, [6.75, 12], [11.5, 13.75], [16.25, 10.25], [21.5, 11.25]])];
    })(),
  },
  'chart-spline': {
    tags: ['curva suave', 'spline', 'línea curva', 'smooth line chart', 'spline chart'],
    // chart-line's points joined by a curve with no corners: level at each peak and valley.
    d: ['M3.25 15.25C5.25 11.75 6.5 9.25 8.5 9.25S10.75 13.25 12.75 13.25S18.25 7.75 20.75 4.75', line([K0, K1], [K1, K1])],
  },
  'chart-slope': {
    tags: ['gráfica de pendiente', 'antes y después', 'cambio entre dos momentos', 'slope chart'],
    // Each line's ends are dots on the two axes; the slopes are steep enough to read as change (near
    // level lines were a ladder at 18 px), and the top two cross.
    d: (() => {
      const L = [[5.5, 12.25], [11.25, 5.25], [17.25, 18.25]];
      return [line([K0, K0], [K0, K1]), line([K1, K0], [K1, K1]), ...L.map(([a, b]) => line([K0, a], [K1, b])), ...L.flatMap(([a, b]) => [dot(K0, a), dot(K1, b)])];
    })(),
  },
  'chart-bump': {
    tags: ['gráfica de ranking', 'posiciones', 'liga', 'cambio de lugar', 'bump chart', 'rankings'],
    // Two series that swap places twice; every vertex a ring (r 1.75, as chart-error-bars' values).
    d: (() => {
      const r = 1.75;
      const A = [[4.75, 6], [12, 18], [19.25, 6]];
      const B = [[4.75, 18], [12, 6], [19.25, 18]];
      const series = (S) => [...S.map(([x, y]) => circ(x, y, r)), edge(S[0], S[1], r), edge(S[1], S[2], r)];
      return [...series(A), ...series(B)];
    })(),
  },
  'chart-regression': {
    tags: ['línea de tendencia', 'regresión', 'correlación', 'ajuste', 'trend line', 'regression'],
    // chart-scatter's axes and the fitted line through a cloud of five dots, 3.25 to 3.75 off it on
    // either side. The line is shallower than a slash: at 45° with two dots on each side it read as
    // a percent sign.
    d: (() => {
      const [a, b] = [[6.5, 16], [20.5, 7.25]];
      const k = (b[1] - a[1]) / (b[0] - a[0]);
      const L = Math.hypot(1, k);
      const at = (x, off) => [x - (off * k) / L, a[1] + k * (x - a[0]) + off / L];
      return [rline([[K0, K0], [K0, K1], [K1, K1]], 0), line(a, b), dot(...at(8.75, -3.25)), dot(...at(10.25, 3.5)), dot(...at(13.25, -3.5)), dot(...at(16, 3.25)), dot(...at(18, -3.75))];
    })(),
  },
  'chart-moving-average': {
    tags: ['media móvil', 'suavizado', 'promedio', 'tendencia', 'moving average', 'smoothing'],
    // The noisy series swings 3 or more either side of its smooth trend, so every hole stays open.
    d: [rline([[K0, 17.75], [6.75, 10.5], [10.5, 17.25], [14.25, 7.25], [17.5, 14], [K1, 4.5]], 0.6), smooth([[K0, 14.75], [12, 12.5], [K1, 8.25]]), line([K0, K1], [K1, K1])],
  },
  'chart-compare': {
    tags: ['comparar periodos', 'periodo anterior', 'contra el mes pasado', 'compare', 'period comparison'],
    // The previous period is the same series, dashed and 5 lower.
    d: (() => {
      const P = [[K0, 11.75], [8.5, 6], [12.75, 9.75], [K1, 3.25]];
      return [rline(P, SOFT), dashes(rline(P.map(([x, y]) => [x, y + 5]), SOFT), 5), line([K0, K1], [K1, K1])];
    })(),
  },
  'chart-anomaly': {
    tags: ['anomalía', 'pico', 'valor atípico', 'detección de anomalías', 'anomaly', 'outlier', 'spike'],
    // A quiet series with one sharp spike, flagged by the engine's alert badge; the series stays 7.5
    // or more from the badge's center, so only the baseline goes under it. (A ring on the spike's
    // tip, with or without the tip inside, read as a stick figure's head.)
    d: [
      rline([[K0, 14.25], [5.5, 12.5], [7.5, 14.25], [9.5, 4], [11.75, 12], [14.25, 9.75], [K1, 9.25]], [0, 0.6, 0.6, 0.6, 0.6, 0.6, 0]),
      line([K0, K1], [K1, K1]),
    ],
    badge: badge('alert'),
  },
  'chart-threshold': {
    tags: ['umbral', 'límite', 'línea de meta', 'alerta', 'threshold', 'goal line', 'slo'],
    // The series rises across the dashed limit over chart-line's baseline; it crosses inside the
    // middle dash, never next to the end of one.
    d: [
      rline([[K0, 17.25], [7.25, 13.75], [9.75, 15.25], [13.75, 6.5], [16.5, 7.75], [K1, 4]], [0, 1, 1, 0.6, 0.6, 0]),
      dashes(line([K0, 10.75], [K1, 10.75]), 3),
      line([K0, K1], [K1, K1]),
    ],
  },
  'chart-confidence': {
    tags: ['intervalo de confianza', 'pronóstico', 'incertidumbre', 'abanico', 'confidence band', 'fan chart'],
    // The series runs alone to the middle and on through a band that opens toward the right edge:
    // the band starts round, 3 either side of the line, and is cut flat at the edge. (Bounds leaving
    // the line itself merged with it into a twig; loose bounds read as speed lines.)
    d: [
      'M12 9C14.5 8.25 17.75 5.75 20.75 4V15.75C17.75 15.75 14.5 15.25 12 15A3 3 0 0 1 12 9Z',
      line([K0, 15.25], [K1, 8.75]),
      line([K0, K1], [K1, K1]),
    ],
  },
  'chart-realtime': {
    tags: ['tiempo real', 'en vivo', 'transmisión', 'datos en vivo', 'real time', 'live data'],
    // The last point is a dot and the signal opens from it.
    d: (() => {
      const p = [13.25, 11.5];
      return [rline([[K0, 17], [6.5, 12.5], [9.25, 15], p], SOFT), dot(...p), arc(...p, 3.75, -45, 45).d, arc(...p, 7.25, -50, 50).d, line([K0, K1], [K1, K1])];
    })(),
  },
  'chart-retention': {
    tags: ['curva de retención', 'usuarios que regresan', 'cohortes', 'abandono', 'retention curve'],
    d: [rline([[K0, K0], [K0, K1], [K1, K1]], 0), 'M6.5 4.75C7.5 11.5 10.5 15 20.75 15.5'],
  },
  'chart-distribution-overlap': {
    tags: ['distribuciones comparadas', 'control y variante', 'antes y después', 'overlapping distributions'],
    // Two equal bells, chart-distribution's narrowed, their tails level 3.5 over the baseline and
    // crossing at its middle; each tail ends under the other bell's crown, never along the other
    // tail. (Bells standing on the baseline read as two mountains.)
    d: (() => {
      const bell = (x0) => {
        const [w, m] = [12.75, x0 + 6.375];
        const k = w / 18.5;
        return `M${pt([x0, 17.25])}C${pt([x0 + 4.75 * k, 17.25])} ${pt([x0 + 5.5 * k, 4.5])} ${pt([m, 4.5])}S${pt([x0 + w - 4.75 * k, 17.25])} ${pt([x0 + w, 17.25])}`;
      };
      return [bell(2.75), bell(8.5), line([K0, K1], [K1, K1])];
    })(),
  },
  'chart-dumbbell': {
    tags: ['gráfica de pesas', 'brecha', 'antes y después', 'diferencia entre grupos', 'dumbbell chart'],
    // Each row two values (rings of r 1.9) joined by their gap.
    d: [[5, 6.5, 15.5], [12, 10, 19], [19, 4.75, 12.5]].flatMap(([y, a, b]) => [circ(a, y, 1.9), line([a + 1.9, y], [b - 1.9, y]), circ(b, y, 1.9)]),
  },
  'chart-box-plot': {
    tags: ['diagrama de caja', 'bigotes', 'cuartiles', 'mediana', 'box plot', 'box and whisker'],
    d: [
      sq(7, 4.75, 7.5, 5.5, 1.5),
      line([10.5, 4.75], [10.5, 10.25]),
      line([K0, 6], [K0, 9]) + line([K0, 7.5], [7, 7.5]),
      line([14.5, 7.5], [19.25, 7.5]) + line([19.25, 6], [19.25, 9]),
      sq(9, 13.75, 8, 5.5, 1.5),
      line([14, 13.75], [14, 19.25]),
      line([4.75, 15], [4.75, 18]) + line([4.75, 16.5], [9, 16.5]),
      line([17, 16.5], [K1, 16.5]) + line([K1, 15], [K1, 18]),
    ],
  },
  'chart-violin': {
    tags: ['diagrama de violín', 'forma de la distribución', 'densidad', 'violin plot'],
    // Two mirrored outlines, each with two bulges and a waist (one wider below, the other above),
    // crossed edge to edge by its median at its widest. (Lenses and single bulges read as bottles.)
    d: (() => {
      const violin = (x, P) => smooth([[x, K0], ...P.map(([y, w]) => [x + w, y]), [x, K1], ...[...P].reverse().map(([y, w]) => [x - w, y])], { closed: true });
      const median = (v, y) => clip(line([0, y], [24, y]), (p) => inside(samples(v)[0], p));
      const a = violin(7.25, [[5, 1.25], [8, 2.25], [10.75, 1.6], [14.25, 3.5], [18, 1.75]]);
      const b = violin(16.75, [[6, 1.75], [9.75, 3.5], [13.25, 1.6], [16, 2.25], [19, 1.25]]);
      return [a, median(a, 14.25), b, median(b, 9.75)];
    })(),
  },
  'chart-cluster': {
    tags: ['clústeres', 'agrupamiento', 'segmentos', 'k-means', 'clusters', 'clustering'],
    // Two rings 2.9 apart on the diagonal, three dots in each, their triangles turned opposite ways.
    d: (() => {
      const group = ([cx, cy], a0) => [circ(cx, cy, 5.25), ...[0, 120, 240].map((a) => dot(...polar(cx, cy, 2.3, a0 + a)))];
      return [...group([7.25, 7.25], -90), ...group([16.75, 16.75], 90)];
    })(),
  },
  'chart-sunburst': {
    tags: ['gráfica solar', 'jerarquía en anillos', 'sunburst', 'drill down'],
    // The center, a full ring split twice and the next level, which covers only one of its parts;
    // the dividers of the inner ring run on through the outer one.
    d: [
      circ(12, 12, 3),
      circ(12, 12, 6),
      arc(12, 12, 9, -90, 60).d,
      line(polar(12, 12, 3, -90), polar(12, 12, 9, -90)),
      line(polar(12, 12, 3, 60), polar(12, 12, 9, 60)),
      line(polar(12, 12, 6, -15), polar(12, 12, 9, -15)),
    ],
  },
  'chart-polar': {
    tags: ['gráfica polar', 'rosa', 'cíclico', 'meses', 'polar area chart', 'rose chart'],
    // Four quarters 3 apart (their straight sides 1.5 off the axes), each to its own radius; the
    // smallest at 5.5 keeps its hole open at every weight (at 4.75 it closed at bold).
    d: [9, 6.25, 7.75, 5.5].map((R, k) => {
      const h = Math.sqrt(R * R - 2.25);
      return turnPath(`M13.5 10.5V${n(12 - h)}A${n(R)} ${n(R)} 0 0 1 ${n(12 + h)} 10.5Z`, 90 * k);
    }),
  },
  'chart-sankey': {
    tags: ['diagrama de sankey', 'flujos', 'volumen entre etapas', 'sankey diagram', 'flow'],
    // The node at the upper left feeds the two on the right through two bands 3 wide, each a pair of
    // S curves: one runs nearly level, the other sweeps down. Nodes are bars 3 wide whose ends stand
    // 1.5 past the bands. (Level bands between line nodes read as a ladder.)
    d: (() => {
      const S = (y0, y1) => `M6.25 ${n(y0)}C12 ${n(y0)} 12 ${n(y1)} 17.75 ${n(y1)}`;
      return [sq(K0, 4.25, 3, 12, 0.75), S(5.75, 6.75), S(8.75, 9.75), S(11.75, 16.25), S(14.75, 19.25), sq(17.75, 5.25, 3, 6, 0.75), sq(17.75, 14.75, 3, 6, 0.75)];
    })(),
  },
  'chart-heatmap': {
    tags: ['mapa de calor', 'matriz de correlación', 'intensidad', 'heatmap chart', 'correlation matrix'],
    // The size of each cell is its value: a full square, a smaller one or a dot (the diagonal full, as
    // in a correlation matrix), on a pitch of 7.25 so the smaller squares keep a hole at bold (at 2.5
    // they were rings with a pinhole that closed).
    d: (() => {
      const c = [4.75, 12, 19.25];
      const cell = (x, y, k) => (k === 2 ? sq(x - 2.125, y - 2.125, 4.25, 4.25, 1.35) : k === 1 ? sq(x - 1.375, y - 1.375, 2.75, 2.75, 0.9) : dot(x, y));
      return [[2, 1, 0], [1, 2, 1], [0, 1, 2]].flatMap((row, j) => row.map((k, i) => cell(c[i], c[j], k)));
    })(),
  },
  'chart-cohort': {
    tags: ['tabla de cohortes', 'retención por cohorte', 'suscripciones', 'cohort table', 'cohort analysis'],
    // Each later cohort has one period less: a staircase of cells 4.38 square.
    d: (() => {
      const g = (i) => K0 + (i * 17.5) / 4;
      return [
        roundpoly([[K0, K0], [K1, K0], [K1, g(1)], [g(3), g(1)], [g(3), g(2)], [g(2), g(2)], [g(2), g(3)], [g(1), g(3)], [g(1), K1], [K0, K1]], [2.25, 2.25, 1, 0, 1, 0, 1, 0, 1, 2.25]),
        line([K0, g(1)], [g(3), g(1)]),
        line([K0, g(2)], [g(2), g(2)]),
        line([K0, g(3)], [g(1), g(3)]),
        line([g(1), K0], [g(1), g(3)]),
        line([g(2), K0], [g(2), g(2)]),
        line([g(3), K0], [g(3), g(1)]),
      ];
    })(),
  },
  'chart-dendrogram': {
    tags: ['dendrograma', 'agrupamiento jerárquico', 'árbol de similitud', 'taxonomía', 'dendrogram'],
    d: [
      rline([[4.25, K1], [4.25, 13], [9.25, 13], [9.25, K1]], 1.5),
      rline([[14.75, K1], [14.75, 15.5], [19.75, 15.5], [19.75, K1]], 1.5),
      rline([[6.75, 13], [6.75, 6.25], [17.25, 6.25], [17.25, 15.5]], 1.5),
      line([12, 6.25], [12, K0]),
    ],
  },
  'chart-small-multiples': {
    tags: ['múltiplos pequeños', 'cuadrícula de gráficas', 'comparar grupos', 'small multiples', 'trellis'],
    // Four corner axes 7.25 square, 3 apart, each with the same short series rising from its axis at
    // its own slope (a line floating in the corner read as an arrow).
    d: [[K0, K0, 2], [13.5, K0, 4.25], [K0, 13.5, 1], [13.5, 13.5, 3]].flatMap(([x, y, k]) => [rline([[x, y], [x, y + 7.25], [x + 7.25, y + 7.25]], 0), line([x, y + 4.25], [x + 7.25, y + 4.25 - k])]),
  },
  'chart-map': {
    tags: ['mapa de datos', 'coropletas', 'por región', 'analítica geográfica', 'choropleth', 'map chart'],
    // lugares' folded map with a region (an irregular closed border, 3 clear of the map's edges) laid
    // over its first fold, which it hides, and the border between the next two regions running from
    // it across the second fold to the edge. (A round region bisected by the fold read as a Φ; a
    // polygon, as a nut.)
    d: [
      roundpoly([[2.75, 6.25], [9, 4], [15, 6.25], [21.25, 4], [21.25, 17.75], [15, 20], [9, 17.75], [2.75, 20]], [1, 0.6, 0.6, 1, 1, 0.6, 0.6, 1]),
      line([15, 6.25], [15, 20]),
      smooth([[5.75, 9.25], [8, 7.5], [10.25, 8.5], [12, 10.25], [11.25, 12.25], [11.75, 14.25], [9, 14.5], [6.5, 13.5]], { closed: true }),
      smooth([[12, 10.25], [15, 11.5], [18, 10.5], [21.25, 11.75]]),
    ],
  },
  'chart-axes': {
    tags: ['ejes', 'gráfica vacía', 'sin datos', 'chart axes', 'empty chart'],
    d: [rline([[K0, K0], [K0, K1], [K1, K1]], 0), ...[8.25, 13.25, 18.25].map((x) => line([x, K1], [x, 18.25])), ...[15.75, 10.75, 5.75].map((y) => line([K0, y], [5.75, y]))],
  },
  'data-point': {
    tags: ['punto de datos', 'coordenadas', 'valor', 'inspeccionar', 'data point', 'tooltip'],
    // One ring in the field and its two readings, straight to each axis.
    d: [rline([[K0, K0], [K0, K1], [K1, K1]], 0), line([K0, 10], [11.25, 10]), line([13.5, 12.25], [13.5, K1]), circ(13.5, 10, 2.25)],
  },
  'chart-bar-plus': {
    tags: ['agregar gráfica', 'nueva visualización', 'insertar gráfica', 'add chart', 'new chart'],
    d: [bar(BX[0], 11.75), bar(BX[1], 3.25), bar(BX[2], 7.75)],
    badge: badge('plus'),
  },
  'chart-bar-edit': {
    tags: ['editar gráfica', 'configurar visualización', 'ejes y series', 'edit chart', 'configure chart'],
    d: [bar(BX[0], 11.75), bar(BX[1], 3.25), bar(BX[2], 7.75)],
    badge: badge('edit'),
  },
  'drill-down': {
    tags: ['profundizar', 'desglose', 'ver detalle', 'drill down', 'breakdown'],
    d: drill(true),
  },
  'drill-up': {
    tags: ['subir de nivel', 'agregar', 'ver resumen', 'drill up', 'roll up'],
    d: drill(false),
  },
  'trend-up-down': {
    tags: ['tendencia mixta', 'volátil', 'sube y baja', 'fluctuación', 'mixed trend', 'volatility'],
    // trend-up's and trend-down's zigzags at 45°, with their full dip (2.5) and arrowheads (4.5),
    // crossing once at the middle; before the crossing they stay 3 apart. (With the dip flattened it
    // read as shuffle.)
    d: (() => {
      const U = [[3, 18], [7.5, 13.5], [10, 16], [20.25, 5.75]];
      const D = U.map(([x, y]) => [x, 24 - y]);
      return [rline(U, [0, 1.25, 1.25, 0]), head(U[3], [1, -1], 4.5), rline(D, [0, 1.25, 1.25, 0]), head(D[3], [1, 1], 4.5)];
    })(),
  },
  'gauge-zones': {
    tags: ['medidor por zonas', 'semáforo', 'estado del kpi', 'salud', 'gauge zones', 'health score'],
    // The gauge's dial in three ranges, their ends 3 apart.
    d: (() => {
      const c = [12, 14];
      const gap = (2 * Math.asin(1.5 / 9) * 180) / Math.PI;
      const seg = (240 - 2 * gap) / 3;
      return [...[0, 1, 2].map((i) => arc(...c, 9, 150 + i * (seg + gap), 150 + i * (seg + gap) + seg).d), circ(...c, 1.75), line(polar(...c, 1.75, 290), polar(...c, 6, 290))];
    })(),
  },
  'gauge-linear': {
    tags: ['medidor lineal', 'escala', 'nivel', 'puntaje', 'linear gauge', 'meter'],
    // A ruler: the scale with long ticks at its ends and middle and short ones between; the pointer's
    // rounded tip rests exactly on it, over a short tick (between ticks, its flank came 2.7 from the
    // middle one).
    d: (() => {
      const [y, hw, h, r] = [13.25, 3, 5.75, 0.9];
      const tip = [16.375, y + r / Math.sin(Math.atan(hw / h)) - r];
      return [
        rline([[K0, y + 3.5], [K0, y], [K1, y], [K1, y + 3.5]], 0),
        line([12, y], [12, y + 3.5]) + line([7.625, y], [7.625, y + 2]) + line([16.375, y], [16.375, y + 2]),
        roundpoly([[tip[0] - hw, tip[1] - h], [tip[0] + hw, tip[1] - h], tip], [1.2, 1.2, r]),
      ];
    })(),
  },
  'gauge-progress': {
    tags: ['medidor de porcentaje', 'avance', 'uso', 'puntaje', 'percent gauge', 'utilization'],
    // A half ring 4 wide; the divider marks the value.
    d: (() => {
      const c = [12, 16.25];
      return [`${arc(...c, 9, 180, 360).d}H17${arc(...c, 5, 360, 180).d.replace(/^M[^A]*/, '')}Z`, line(polar(...c, 5, 300), polar(...c, 9, 300))];
    })(),
  },
  'metric-card': {
    tags: ['tarjeta de kpi', 'métrica', 'indicador', 'resumen', 'metric card', 'kpi tile'],
    d: [box(2.5, 5, 19, 14, 4), line([6.25, 9.25], [11.75, 9.25]), rline([[6.25, 15.25], [9.5, 12.75], [12.5, 14.5], [17.75, 10.25]], 0.6)],
  },
  'dashboard-plus': {
    tags: ['nuevo tablero', 'crear dashboard', 'agregar panel', 'new dashboard', 'add dashboard'],
    // dashboard's first two panels and a plus where the third one was, 3.4 from its neighbors, as
    // ventanas' apps-plus. (The engine's badge took the third panel anyway and bit the edges of the
    // other two, which graze its clearance.)
    d: [sq(K0, K0, 7.25, 17.5, 2.25), sq(13.5, K0, 7.25, 7.25, 2.25), line([17.125, 13.875], [17.125, 20.375]), line([13.875, 17.125], [20.375, 17.125])],
  },
  'dashboard-edit': {
    tags: ['editar tablero', 'personalizar dashboard', 'acomodar paneles', 'edit dashboard', 'customize'],
    // dashboard's first two panels and the engine's pencil where the third one was, as
    // dashboard-plus's plus: over the third panel the pencil left two of its corners as fragments.
    // The top-right panel is 5.5 tall here, so the pencil's clearance misses it at every weight (at
    // 7.25 it grazed its bottom edge, which split at light).
    d: [sq(K0, K0, 7.25, 17.5, 2.25), sq(13.5, K0, 7.25, 5.5, 2.25)],
    badge: badge('edit'),
  },

  // Data stores (round 5) ----------------------------------------------------------------------
  'database-cluster': {
    tags: ['clúster de bases de datos', 'réplicas', 'varias bases', 'database cluster', 'replicas'],
    // A store in front and two behind it, to either side and higher, each cut 1.5 clear of the one in
    // front: three stores, a group. (Stores stepped 3 apart on the diagonal showed only slivers of
    // the ones behind, which read as signal arcs.)
    d: (() => {
      const front = cylinder(12, 12, 5.5, 2, 19);
      const show = (c) => [c.lid, c.body].map((d) => behind(d, [front.outline])).join('');
      return [front.body, front.lid, show(cylinder(6.75, 4.75, 3.75, 1.5, 12)), show(cylinder(17.25, 4.75, 3.75, 1.5, 12))];
    })(),
  },
  'database-shard': {
    tags: ['fragmentación', 'particiones', 'sharding', 'dividir datos', 'database shard', 'partitioning'],
    // The core store, its lid and its band, split down the middle into two halves pulled 3 apart.
    // (Three slices stacked and slid sideways read as a stack of coins.)
    d: (() => {
      const [cx, rx, ry, top, bottom, band] = [10.5, 6.75, 2.5, 6.5, 17.5, 12];
      const to = (p) => `A${n(rx)} ${n(ry)} 0 0 0 ${pt(p)}`;
      const half = [`M${pt([cx, top - ry])}${to([cx - rx, top])}V${n(bottom)}${to([cx, bottom + ry])}Z`, `M${pt([cx - rx, top])}${to([cx, top + ry])}`, `M${pt([cx - rx, band])}${to([cx, band + ry])}`];
      return [...half, ...half.map((d) => flipPath(d))];
    })(),
  },
  'database-cloud': {
    tags: ['base de datos en la nube', 'base administrada', 'hosting de datos', 'cloud database', 'managed database'],
    d: DB_D,
    // A small cloud (three lobes on a flat base) inside the badge's ring, which is what it clears, as
    // the engine's badges do (clearing the cloud's own outline left the band's end at the edge of the
    // clearance, and the fill found no clean interpolation between weights)
    badge: (() => {
      const c = cloud([14.75, 18.25, 1.5], [17, 16, 2.5], [19.5, 18.25, 1.6], 19.75);
      return { d: [c], knock: circ(...BC, 4.25), fill: { solid: [c] } };
    })(),
  },
  'database-transfer': {
    tags: ['migración de datos', 'transferir', 'mover datos', 'data migration', 'transfer'],
    // Two small stores (the core one's lid, band and body) and the arrow from one to the other above
    // them.
    d: (() => {
      const C = (cx) => cylinder(cx, 11.75, 3.5, 1.4, 19.5, [15.75]);
      const [a, b] = [C(6.5), C(17.5)];
      return [a.body, a.lid, a.bands[0], b.body, b.lid, b.bands[0], line([4.75, 4.25], [19.25, 4.25]), head([19.25, 4.25], [1, 0], 2.75)];
    })(),
  },
  'database-backup': {
    tags: ['respaldo de base de datos', 'copia de seguridad', 'restaurar', 'database backup', 'restore point'],
    d: DB_D,
    // The history arrow (counterclockwise, as navegacion's history) around the badge's corner, its
    // head 15° further on than first drawn: there its clearance met the band's end and the fill
    // found no clean interpolation between weights
    badge: (() => {
      const a = arc(...BC, 3.5, 235, -50);
      const h = head(a.end, a.tangent, 2.4);
      return { d: [a.d, h], knock: `${circ(...BC, 4.25)}${h}` };
    })(),
  },
  'database-x': {
    tags: ['base de datos no disponible', 'conexión fallida', 'fuente caída', 'database error', 'database offline'],
    d: DB_D,
    badge: badge('x'),
  },
  'database-alert': {
    tags: ['problema de datos', 'error de sincronización', 'calidad de datos', 'database warning', 'data issue'],
    d: DB_D,
    badge: badge('alert'),
  },
  'database-lock': {
    tags: ['datos restringidos', 'base cifrada', 'acceso limitado', 'database lock', 'encrypted database'],
    d: DB_D,
    badge: badge('lock'),
  },
  'database-clock': {
    tags: ['actualización de datos', 'última actualización', 'programado', 'data freshness', 'scheduled refresh'],
    d: DB_D,
    badge: badge('clock'),
  },
  'database-gear': {
    tags: ['configuración de base de datos', 'conexión', 'credenciales', 'database settings', 'data source settings'],
    d: DB_D,
    // The engine's gear clearing a ring 0.15 wider than its own, as archivos' file-gear, and turned
    // 15° on its pivot: as drawn, the store's cut ends and the gear's teeth paired differently
    // between weights at every clearance tried. Its pixel version is the engine's (`kind`).
    badge: (() => {
      const g = badge('gear');
      const t = (d) => turnPath(d, 15, BC);
      return { ...g, d: g.d.map(t), knock: circ(...BC, 4.4), fill: { solid: g.fill.solid.map(t), cut: g.fill.cut.map(t) } };
    })(),
  },
  'database-edit': {
    tags: ['editar datos', 'modificar registros', 'editar tabla', 'edit data', 'edit records'],
    d: DB_D,
    badge: badge('edit'),
  },
  'data-warehouse': {
    tags: ['almacén de datos', 'data warehouse', 'datos modelados', 'analítica', 'warehouse'],
    // The low gable over a store of three discs.
    d: (() => {
      const c = STORE([9.25 + 10 / 3, 9.25 + 20 / 3]);
      return [c.body, c.lid, ...c.bands, ROOF];
    })(),
  },
  'data-lake': {
    tags: ['lago de datos', 'datos sin procesar', 'data lake', 'raw data', 'almacenamiento'],
    // The core store with water inside: two waves in place of its band, 3 clear of its sides (wall to
    // wall they took it over the set's density).
    d: [DB.body, DB.lid, wave(6.6, 17.4, 12.75, 4, 0.6), wave(6.6, 17.4, 16.25, 4, 0.6)],
  },
  'data-lakehouse': {
    tags: ['lakehouse', 'lago y almacén', 'datos crudos y modelados', 'data lakehouse'],
    d: (() => {
      const c = STORE();
      return [c.body, c.lid, wave(6, 18, 14, 4, 0.5), wave(6, 18, 17, 4, 0.5), ROOF];
    })(),
  },
  'data-source': {
    tags: ['fuente de datos', 'conector', 'conectar datos', 'data source', 'connector'],
    d: SOURCE,
  },
  'data-source-plus': {
    tags: ['agregar fuente de datos', 'conectar fuente', 'nuevo conector', 'add data source', 'new connection'],
    d: SOURCE,
    badge: badge('plus'),
  },
  'table-export': {
    tags: ['exportar tabla', 'descargar csv', 'exportar resultados', 'export table', 'download csv'],
    d: TABLE,
    badge: badge('arrow-up'),
  },
  'table-import': {
    tags: ['importar a tabla', 'cargar filas', 'subir csv', 'import table', 'load rows'],
    d: TABLE,
    badge: badge('arrow-down'),
  },
  'data-stream': {
    tags: ['flujo de eventos', 'streaming', 'datos continuos', 'event stream', 'live feed'],
    // Three events moving right, each with two speed lines behind it, the nearer one 3 from the dot's
    // edge.
    d: [[17, 6.5], [20.5, 12], [15, 17.5]].flatMap(([x, y]) => [line([x - 12.25, y], [x - 9.75, y]), line([x - 6.75, y], [x - 3.75, y]), dot(x, y)]),
  },
  'data-batch': {
    tags: ['procesamiento por lotes', 'lote', 'carga programada', 'batch processing', 'batch'],
    // Three records bound by a bracket and an arrow leaving the batch.
    d: [pill(8.25, 4.125, 6.5, 3.25), pill(8.25, 10.375, 6.5, 3.25), pill(8.25, 16.625, 6.5, 3.25), rline([[5.25, K0], [K0, K0], [K0, K1], [5.25, K1]], 1.25), line([17.75, 12], [21.25, 12]), head([21.25, 12], [1, 0], 3)],
  },
  'data-pipeline': {
    tags: ['canalización de datos', 'etl', 'elt', 'tubería', 'data pipeline'],
    d: PIPE.d,
  },
  'data-pipeline-clock': {
    tags: ['canalización programada', 'próxima ejecución', 'etl programado', 'scheduled pipeline', 'pipeline schedule'],
    d: PIPE.d,
    badge: badge('clock'),
  },
  'data-pipeline-alert': {
    tags: ['canalización fallida', 'error de etl', 'ejecución con error', 'failed pipeline', 'pipeline error'],
    d: PIPE.d,
    badge: badge('alert'),
  },
  'data-transform': {
    tags: ['transformar datos', 'convertir', 'paso de transformación', 'transform', 'etl'],
    // The same data in a new shape: a triangle becomes a square of the same height, under an arc arrow.
    d: (() => {
      const a = arc(11.75, 9.25, 5.25, 180, 360);
      return [roundpoly([[2.75, 19.75], [6.5, 12.25], [10.25, 19.75]], 1), sq(13.25, 12.25, 7.5, 7.5, 2), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  'data-mapping': {
    tags: ['mapeo de campos', 'emparejar columnas', 'esquema', 'field mapping', 'schema mapping'],
    // Three source fields and three destination fields, two of the links crossing.
    d: (() => {
      const Y = [5.5, 12, 18.5];
      return [...Y.map((y) => pill(K0, y - 1.5, 4.5, 3)), ...Y.map((y) => pill(16.25, y - 1.5, 4.5, 3)), line([7.75, 5.5], [16.25, 5.5]), line([7.75, 12], [16.25, 18.5]), line([7.75, 18.5], [16.25, 12])];
    })(),
  },
  'data-lineage': {
    tags: ['linaje de datos', 'origen de datos', 'dependencias', 'data lineage', 'upstream'],
    // Two sources join into a table (a card with its header), which feeds on to the right.
    d: [
      sq(K0, 4.25, 4, 4, 1.25),
      sq(K0, 15.75, 4, 4, 1.25),
      'M7.25 6.25H8A2 2 0 0 1 10 8.25V15.75A2 2 0 0 1 8 17.75H7.25',
      line([10, 13.5], [13, 13.5]),
      box(13, 7.25, 6.25, 10, 2),
      line([13, 10.25], [19.25, 10.25]),
      line([19.25, 13.5], [21.5, 13.5]),
    ],
  },
  'deduplicate': {
    tags: ['quitar duplicados', 'deduplicar', 'limpiar datos', 'fusionar registros', 'deduplicate', 'remove duplicates'],
    // Two identical records join into one.
    d: [pill(K0, 4.5, 6, 4), pill(K0, 15.5, 6, 4), 'M9.25 6.5H9.75A2 2 0 0 1 11.75 8.5V15.5A2 2 0 0 1 9.75 17.5H9.25', line([11.75, 12], [14.75, 12]), pill(14.75, 10, 6, 4)],
  },
  'join-inner': {
    tags: ['inner join', 'unión interna', 'coincidencias', 'intersección', 'sql join'],
    // venn's sets: what the join keeps is solid, the rest dashed (dashes 3 apart). The dashes start
    // 3.6 along the circle from where the circles meet, so the kept part stands clear of them
    // (dashes leaving the lens's tips gave it horns).
    d: [`M${pt(VP)}A${VR} ${VR} 0 0 1 ${pt(VQ)}A${VR} ${VR} 0 0 1 ${pt(VP)}Z`, dashedArc(...VA, VR, Va + VG, 360 - Va - VG, 5), dashedArc(...VB, VR, 180 + Va + VG, 540 - Va - VG, 5)],
  },
  'join-left': {
    tags: ['left join', 'unión izquierda', 'conservar la primera tabla', 'sql join'],
    d: [circ(...VA, VR), arc(...VB, VR, 180 - Va, 180 + Va).d, dashedArc(...VB, VR, 180 + Va + VG, 540 - Va - VG, 5)],
  },
  'join-right': {
    tags: ['right join', 'unión derecha', 'conservar la segunda tabla', 'sql join'],
    // join-left mirrored
    d: [circ(...VA, VR), arc(...VB, VR, 180 - Va, 180 + Va).d, dashedArc(...VB, VR, 180 + Va + VG, 540 - Va - VG, 5)].map((d) => flipPath(d)),
  },
  'join-anti': {
    tags: ['anti join', 'sin coincidencia', 'huérfanos', 'registros faltantes', 'sql join'],
    d: [`M${pt(VQ)}A${VR} ${VR} 0 1 1 ${pt(VP)}A${VR} ${VR} 0 0 0 ${pt(VQ)}Z`, dashedArc(...VA, VR, -Va + VG, Va - VG, 2), dashedArc(...VB, VR, 180 + Va + VG, 540 - Va - VG, 5)],
  },
  'primary-key': {
    tags: ['llave primaria', 'clave primaria', 'identificador único', 'primary key', 'pk'],
    // A table's header row (a short card split in two) and the core key in front of its corner,
    // cleared by the engine.
    d: [box(2.75, 3.75, 14.25, 7.5, 2.5), line([8.5, 3.75], [8.5, 11.25])],
    badge: (() => {
      const [o, s, c] = [[8.1, 15.9], 3.5 / 4.6, [8.25, 17.75]];
      const P = (p) => [c[0] + (p[0] - o[0]) * s, c[1] + (p[1] - o[1]) * s];
      const bow = circ(...c, 3.5);
      const shaft = line(P([11.35, 12.65]), P([20.25, 3.75]));
      const teeth = line(P([17.3, 6.7]), P([19.6, 9])) + line(P([14.8, 9.2]), P([16.65, 11.05]));
      return { d: [bow, shaft, teeth], knock: `${bow}${shaft}${teeth}`, fill: { solid: [bow], wire: [shaft, teeth] } };
    })(),
  },
  'foreign-key': {
    tags: ['llave foránea', 'clave externa', 'referencia', 'foreign key', 'fk'],
    // A key whose shaft runs on into an arrow.
    d: [circ(6.25, 12, 3.5), line([9.75, 12], [20.75, 12]), line([12.25, 12], [12.25, 15]) + line([14.75, 12], [14.75, 14.25]), head([20.75, 12], [1, 0], 4.5)],
  },
  'star-schema': {
    tags: ['esquema de estrella', 'tabla de hechos', 'dimensiones', 'modelo de datos', 'star schema'],
    // The fact table (a card with its header) and four dimensions on its corners, each joined along
    // the diagonal from outline to outline.
    d: (() => {
      const center = box(8.75, 8.75, 6.5, 6.5, 2);
      const dims = [[K0, K0], [16.5, K0], [K0, 16.5], [16.5, 16.5]].map(([x, y]) => sq(x, y, 4.25, 4.25, 1.25));
      const ring = (d) => samples(d)[0];
      const links = dims.map((d, i) => {
        const [x, y] = [[K0, K0], [16.5, K0], [K0, 16.5], [16.5, 16.5]][i];
        return clip(line([x + 2.125, y + 2.125], [12, 12]), (p) => !inside(ring(d), p) && !inside(ring(center), p));
      });
      return [center, line([8.75, 11.75], [15.25, 11.75]), ...dims, ...links];
    })(),
  },
  'data-cube': {
    tags: ['cubo olap', 'multidimensional', 'dimensiones', 'segmentar', 'olap cube', 'data cube'],
    // datos' cube split 2 × 2 × 2: every visible face in four cells, its lines 3 apart. Drawn 14.5 wide
    // (depth 6) so the grid stays under the set's density; full size it was 34.5 % ink.
    d: (() => {
      const [x0, s, dp] = [4.75, 14.5, 6];
      const [x1, f] = [x0 + s, s - dp];
      const [fx, fy, h] = [x0 + f, x0 + dp, f / 2];
      return [
        roundpoly([[x0, fy], [x0 + dp, x0], [x1, x0], [x1, x1 - dp], [fx, x1], [x0, x1]], 1.25),
        // The front's top edge runs on to the rounded corner, not to its vertex (which left a nub)
        rline([[x0, fy], [fx, fy], [x1 - INSET(1.25) * Math.SQRT1_2, x0 + INSET(1.25) * Math.SQRT1_2]], 0),
        line([fx, fy], [fx, x1]),
        rline([[x0 + h, x1], [x0 + h, fy], [x0 + h + dp, x0]], 0),
        rline([[x0, fy + h], [fx, fy + h], [x1, fy + h - dp]], 0),
        rline([[x0 + dp / 2, x0 + dp / 2], [x1 - dp / 2, x0 + dp / 2], [x1 - dp / 2, x1 - dp / 2]], 0),
      ];
    })(),
  },
  'relation-one-to-one': {
    tags: ['relación uno a uno', 'diagrama er', 'cardinalidad', 'one to one', 'er diagram'],
    d: [line([2.75, 12], [21.25, 12]), ONE(5.75), ONE(15.25)],
  },
  'relation-one-to-many': {
    tags: ['relación uno a muchos', 'diagrama er', 'pata de gallo', 'one to many', 'er diagram'],
    d: [line([2.75, 12], [21.25, 12]), ONE(5.75), MANY(15.25, 21.25)],
  },
  'relation-many-to-many': {
    tags: ['relación muchos a muchos', 'diagrama er', 'tabla intermedia', 'many to many', 'er diagram'],
    d: [line([2.75, 12], [21.25, 12]), MANY(8.75, 2.75), MANY(15.25, 21.25)],
  },
  'metadata': {
    tags: ['metadatos', 'catálogo de datos', 'etiquetas', 'definiciones', 'metadata', 'data catalog'],
    d: DB_D,
    // comercio's price tag, smaller, hanging off the store's lower right, its point toward it; set
    // 0.5 further into the corner than first drawn, where its clearance left a sliver of the store
    // that joined the fill at bold
    badge: (() => {
      const [L, H, nose, c] = [9.5, 3.25, 3.25, [16.25, 16.25]];
      const W = (p) => {
        const q = rot([p[0] - L * 0.52, p[1]], [0, 0], 45);
        return [q[0] + c[0], q[1] + c[1]];
      };
      const body = roundpoly([[0, 0], [nose, -H], [L, -H], [L, H], [nose, H]].map(W), [1.2, 1, 1.6, 1.6, 1]);
      const hole = dot(...W([4.25, 0]));
      return { d: [body, hole], knock: body, fill: { solid: [body], cut: [hole] } };
    })(),
  },
  'missing-value': {
    tags: ['valores faltantes', 'nulos', 'celda vacía', 'calidad de datos', 'missing values', 'null'],
    // Three rows of values; the middle one is missing, its row dashed. (A dashed pill read as
    // parentheses around an equals sign.)
    d: [CARD, line([6.75, 7.25], [17.25, 7.25]), dashes(line([6.75, 12], [17.25, 12]), 3), line([6.75, 16.75], [14.25, 16.75])],
  },
  'data-sample': {
    tags: ['muestra', 'muestreo', 'subconjunto', 'vista previa de datos', 'sample', 'sampling'],
    // The sample (r 5) touches the population (r 9) inside, at its lower right.
    d: (() => {
      const c = [12 + 4 * Math.SQRT1_2, 12 + 4 * Math.SQRT1_2];
      return [circ(12, 12, 9), circ(...c, 5), dot(7.5, 9), dot(11.5, 6.25), dot(6.75, 13.5), dot(...polar(...c, 2, 135)), dot(...polar(...c, 2, -45))];
    })(),
  },
  'data-notebook': {
    tags: ['cuaderno de datos', 'notebook', 'celdas', 'análisis', 'jupyter', 'data notebook'],
    // A page (the portrait document, with the signature) that mixes code and its result: a prompt and
    // a line of code above, three bars of its chart below. (Two cells as boxes with nothing around
    // them read as a server or a drawer.)
    d: [
      box(4.75, 2.75, 14.5, 18.5, 3.75),
      line([8.25, 6.25], [10.25, 8], [8.25, 9.75]),
      line([12.75, 9.75], [15.75, 9.75]),
      line([8.75, 17.75], [8.75, 14.75]),
      line([12, 17.75], [12, 13.25]),
      line([15.25, 17.75], [15.25, 15.5]),
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Fill (DESIGN.md › Fill): by index into d. `solid` is filled and keeps its stroke (closed shapes
// only); `closed` too, but it is an open stroke of the outline that encloses a body (the bug's half
// head, the flask's glass, the rocket's fins, the block's buttons, each brain hemisphere, the
// database body) and is filled closed with Z: its closing segment runs along a stroke that is
// already there, so the silhouette doesn't change. `cut` is knocked out at the stroke width;
// `lines` stays a line with 1.5 of clearance and `wire` stays a line attached to the fill, with no
// clearance (git branches, a graph's edges, a chip's pins, a flow's connectors).
// ---------------------------------------------------------------------------------------------
const all = (name) => icons[name].d.map((_, i) => i);
// The round 5 databases with a badge (the engine's, or a custom piece in its corner)
const DB_R5 = ['database-cloud', 'database-backup', 'database-x', 'database-alert', 'database-lock', 'database-clock', 'database-gear', 'database-edit'];
const from = (name, i) => all(name).slice(i);
const FILL = {
  'chart-bar': { solid: [0, 1, 2] },
  'chart-bar-horizontal': { solid: [0, 1, 2] },
  // The bars filled and the cuts in each stack knocked out
  'chart-bar-stacked': { solid: [0, 1, 2], cut: [3, 4, 5] },
  'chart-histogram': { solid: [0], cut: [1, 2, 3, 4] },
  'chart-area': { solid: [0] },
  'chart-pie': { solid: [0, 1] },
  'chart-bubble': { solid: [0, 1, 2, 3] },
  'chart-funnel': { solid: [0, 1, 2] },
  // The data filled inside the web, which stays a line
  'chart-radar': { solid: [1], lines: [0] },
  'chart-waterfall': { solid: [0, 1, 2] },
  'chart-gantt': { solid: [0, 1, 2] },
  'chart-treemap': { solid: [0], cut: [1, 2, 3, 4] },
  // The bars filled; the series runs over them as a line
  'chart-combo': { solid: [0, 1, 2], lines: [3] },
  dashboard: { solid: [0, 1, 2] },
  // The gauge's axis stays a line; the center filled and the needle attached to it
  gauge: { solid: [1], wire: [2], lines: [0] },
  // The lens with the handle attached and the bars knocked out
  analytics: { solid: [0], wire: [1], cut: [2, 3, 4] },
  table: { solid: [0], cut: [1, 2] },
  kanban: { solid: [0, 1, 2] },
  schema: { solid: [0, 1], wire: [2], cut: [3, 4] },
  terminal: { solid: [0], cut: [1, 2] },
  'code-window': { solid: [0], cut: [1, 2, 3] },
  // Git: the nodes filled, with the trunk and the branches as lines attached to them
  'git-branch': { solid: [0, 3], wire: [1, 2] },
  'git-commit': { solid: [0], wire: [1, 2] },
  'git-merge': { solid: [0, 2, 3], wire: [1, 4] },
  'git-pull-request': { solid: [0, 2, 3], wire: [1, 4, 5] },
  // The closed-state x touches nothing: it stays a line
  'git-pull-request-closed': { solid: [0, 2, 3], wire: [1, 4], lines: [5, 6] },
  'git-pull-request-draft': { solid: [0, 2, 3, 4, 5, 6], wire: [1] },
  'git-fork': { solid: [0, 3, 4], wire: [1, 2] },
  'git-compare': { solid: [0, 3], wire: [1, 2, 4, 5] },
  'git-graph': { solid: [0, 2, 4, 6], wire: [1, 3, 5, 7] },
  // The body and the head filled (the head closes against the body), the wing-case line knocked
  // out; the legs stay joined to the body
  bug: { solid: [0], closed: [1], wire: [3, 4, 5, 6], cut: [2] },
  // The glass filled (closed along the mouth, under the rim) and the liquid level knocked out
  flask: { closed: [0], wire: [1], cut: [2] },
  'test-tube': { closed: [0], wire: [1], cut: [2] },
  // The plug and the socket filled; the cables and the pins, attached to them
  api: { solid: [1, 2], wire: [0, 3, 4] },
  webhook: { solid: [0], wire: [1, 2] },
  cpu: { solid: [0], wire: [2, 3, 4, 5], cut: [1] },
  'ai-chip': { solid: [0], wire: [2, 3, 4, 5], cut: [1] },
  server: { solid: [0, 1], cut: [2, 3, 4, 5] },
  'cloud-compute': { solid: [0], cut: [1, 2] },
  container: { solid: [0], cut: [1, 2, 3] },
  // The fuselage and the fins filled (the fins close against the side), the window knocked out; the
  // trail touches nothing and stays a line
  rocket: { solid: [0], closed: [1, 2], lines: [4], cut: [3] },
  log: { solid: [0], cut: from('log', 1) },
  network: { solid: [0, 4, 5, 6], wire: [1, 2, 3] },
  'node-graph': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7, 8] },
  hierarchy: { solid: [0, 3, 4], wire: [1, 2] },
  sitemap: { solid: [0, 3, 4, 5], wire: [1, 2] },
  flowchart: { solid: [0, 2], wire: [1] },
  workflow: { solid: [0, 3], wire: [1, 2] },
  // The sparkle filled inside the cycle, which stays a line
  automation: { solid: [2], lines: [0, 1] },
  sparkle: { solid: [0] },
  sparkles: { solid: [0, 1] },
  'search-sparkle': { solid: [0], wire: [1], cut: [2] },
  robot: { solid: [0, 2], wire: [1], cut: [3, 4] },
  chatbot: { solid: [0], cut: [1, 2] },
  // Each hemisphere closes against the middle line, which is knocked out along with the folds
  brain: { closed: [0, 1], cut: [2, 3, 4, 5, 6] },
  'neural-network': { solid: [0, 1, 2, 3, 4], wire: [5, 6, 7, 8, 9, 10] },
  prompt: { solid: [0], cut: [1, 2] },
  // The block's buttons close against its edge
  component: { solid: [0], closed: [1, 2] },
  puzzle: { solid: [0] },
  cube: { solid: [0], cut: [1, 2] },
  'data-filter': { solid: [0, 1, 2, 3] },
  'tree-view': { solid: [0, 3, 4], wire: [1, 2] },
  'chart-progress': { solid: [0, 1], cut: [2, 3] },
  target: { solid: [0], cut: [1, 2] },
  'code-sparkle': { solid: [2], lines: [0, 1] },
  condition: { solid: [1], wire: [0, 2, 3, 4, 5] },
  'server-rack': { solid: [0], cut: from('server-rack', 1) },
  memory: { solid: [0], wire: [3], cut: [1, 2] },
  'load-balancer': { solid: [0], wire: [1, 2, 3, 4, 5, 6] },
  // The whiteboard filled with the trend knocked out; the easel stays joined to its edge
  presentation: { solid: [0], wire: [1], cut: [2] },

  // Round 5: bars and bands filled with their splits knocked out; dots, rings and nodes filled with
  // their stems, whiskers and edges attached
  'chart-bar-grouped': { solid: [0, 2], cut: [1, 3] },
  'chart-bar-horizontal-stacked': { solid: [0, 1, 2], cut: [3, 4, 5] },
  'chart-bar-diverging': { solid: [1, 2, 3], wire: [0] },
  'chart-lollipop': { solid: [1, 3, 5], wire: [0, 2, 4, 6] },
  // The measure is knocked out inside the ranges; the target crosses them as a line
  'chart-bullet': { solid: [0], cut: [1, 2], lines: [3] },
  'chart-error-bars': { solid: [0, 2, 4], wire: [1, 3, 5] },
  'chart-area-stacked': { solid: [0], cut: [1] },
  'chart-streamgraph': { solid: [0], cut: [1] },
  'chart-bump': { solid: [0, 1, 2, 5, 6, 7], wire: [3, 4, 8, 9] },
  'chart-dumbbell': { solid: [0, 2, 3, 5, 6, 8], wire: [1, 4, 7] },
  'chart-box-plot': { solid: [0, 4], cut: [1, 5], wire: [2, 3, 6, 7] },
  'chart-violin': { solid: [0, 2], cut: [1, 3] },
  'chart-cluster': { solid: [0, 4], cut: [1, 2, 3, 5, 6, 7] },
  'chart-polar': { solid: [0, 1, 2, 3] },
  'chart-heatmap': { solid: all('chart-heatmap') },
  'chart-cohort': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'chart-map': { solid: [0], cut: [1, 2, 3] },
  'data-point': { solid: [3], wire: [0, 1, 2] },
  'chart-bar-plus': { solid: [0, 1, 2] },
  'chart-bar-edit': { solid: [0, 1, 2] },
  // The bars filled, the breakdown's splits knocked out and the arch attached to both
  'drill-down': { solid: [0, 1], cut: [2, 3], wire: [4, 5] },
  'drill-up': { solid: [0, 1], cut: [2, 3], wire: [4, 5] },
  'gauge-zones': { solid: [3], wire: [4], lines: [0, 1, 2] },
  'gauge-linear': { solid: [2], wire: [0, 1] },
  'metric-card': { solid: [0], cut: [1, 2] },
  'dashboard-plus': { solid: [0, 1], lines: [2, 3] },
  'dashboard-edit': { solid: [0, 1] },
  // The front store filled as the core one; the ones behind stay lines
  'database-cluster': { solid: [1], closed: [0], lines: [2, 3] },
  'database-shard': { solid: [0, 3], cut: [1, 2, 4, 5] },
  'database-transfer': { solid: [1, 4], closed: [0, 3], cut: [2, 5], lines: [6, 7] },
  'data-warehouse': { solid: [1], closed: [0], cut: [2, 3], lines: [4] },
  'data-lake': { solid: [1], closed: [0], cut: [2, 3] },
  'data-lakehouse': { solid: [1], closed: [0], cut: [2, 3], lines: [4] },
  'data-source': { solid: [1, 4], closed: [0], cut: [2], wire: [3, 5] },
  'data-source-plus': { solid: [1, 4], closed: [0], cut: [2], wire: [3, 5] },
  'table-export': { solid: [0], cut: [1, 2] },
  'table-import': { solid: [0], cut: [1, 2] },
  'data-batch': { solid: [0, 1, 2], lines: [3, 4, 5] },
  'data-transform': { solid: [0, 1], lines: [2, 3] },
  'data-mapping': { solid: [0, 1, 2, 3, 4, 5], wire: [6, 7, 8] },
  'data-lineage': { solid: [0, 1, 4], wire: [2, 3, 6], cut: [5] },
  deduplicate: { solid: [0, 1, 4], wire: [2, 3] },
  // What the join keeps is filled; the dashed rest stays lines
  'join-inner': { solid: [0], lines: [1, 2] },
  'join-left': { solid: [0], cut: [1], lines: [2] },
  'join-right': { solid: [0], cut: [1], lines: [2] },
  'join-anti': { solid: [0], lines: [1, 2] },
  'foreign-key': { solid: [0], wire: [1, 2, 3] },
  'star-schema': { solid: [0, 2, 3, 4, 5], cut: [1], wire: [6, 7, 8, 9] },
  'missing-value': { solid: [0], cut: [1, 2, 3] },
  'data-sample': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'data-notebook': { solid: [0], cut: [1, 2, 3, 4, 5] },
};
// The databases with a badge: the body (closed by the lid) and the lid filled, the band and the
// lid's edge knocked out, as in the core `database`
for (const name of ['database-plus', 'database-check', 'database-search', 'database-sync', 'database-export', 'database-import', ...DB_R5, 'metadata'])
  FILL[name] = { solid: [1], closed: [0], cut: [2] };
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => (ix ?? []).map((i) => d[i]);
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? `${d[i]}Z` : d[i]));
  icons[name].fill = { solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
for (const name of ['database-plus', 'database-check', 'database-search', 'database-sync', 'database-export', 'database-import', ...DB_R5, 'metadata']) icons[name].fill.cut.push(DB.rim);
// The donut: the hollow ring (not a disc) with its divisions knocked out
icons['chart-donut'].fill = { solid: [ring(12, 12, 9, 4.5)], cut: icons['chart-donut'].d.slice(2) };
// Venn: the two sets filled and the two inner arcs knocked out: what remains is the two crescents
// and the intersection, separated by the stroke width.
{
  const a = (Math.acos(3.25 / 6.25) * 180) / Math.PI;
  icons.venn.fill = { solid: icons.venn.d, cut: [arc(15.25, 12, 6.25, 180 - a, 180 + a).d, arc(8.75, 12, 6.25, -a, a).d] };
}
// Only open lines, glyphs and dots on lines: their fill is the outline itself. Not the atom or the
// infinity sign either: filled, their orbits and loops become a smudge.
for (const name of [
  'chart-line', 'chart-lines', 'chart-step', 'chart-scatter', 'chart-radial', 'chart-distribution', 'chart-forecast',
  'trend-up', 'trend-down', 'trend-flat', 'braces', 'brackets', 'array', 'function', 'variable', 'sum', 'pulse',
  'atom', 'axis-3d', 'ab-test', 'matrix', 'math', 'diff', 'regex', 'lambda', 'binary', 'infinity', 'equals', 'divide',
])
  icons[name].fill = false;

// Round 5: the line charts are lines; their filled version is the outline itself
for (const name of [
  'chart-spline', 'chart-slope', 'chart-regression', 'chart-moving-average', 'chart-compare', 'chart-threshold', 'chart-confidence',
  'chart-realtime', 'chart-retention', 'chart-anomaly', 'chart-dendrogram', 'chart-small-multiples', 'chart-axes', 'trend-up-down',
  'data-stream', 'relation-one-to-one', 'relation-one-to-many', 'relation-many-to-many',
])
  icons[name].fill = false;
// The two bells filled and each one's flank inside the other knocked out, as venn's arcs: what
// remains is both bells and their overlap
{
  const [a, b, axis] = icons['chart-distribution-overlap'].d;
  // Only the flanks are cut: the tails run into the other bell's flat bottom and stay ink
  icons['chart-distribution-overlap'].fill = { solid: [shut(a), shut(b)], cut: [clip(a, (p) => p[0] > 12 && p[1] < 15.5), clip(b, (p) => p[0] < 12 && p[1] < 15.5)], wire: [axis] };
}
// The sunburst: the inner ring filled whole and the outer part as its sector; the center's edge,
// the inner ring's dividers, the seam between the levels and the outer divider knocked out
{
  const c = [12, 12];
  const sector = `${arc(...c, 9, -90, 60).d}L${pt(polar(...c, 6, 60))}${arc(...c, 6, 60, -90).d.replace(/^M[^A]*/, '')}Z`;
  icons['chart-sunburst'].fill = {
    solid: [circ(...c, 6), sector],
    cut: [circ(...c, 3), line(polar(...c, 3, -90), polar(...c, 6, -90)), line(polar(...c, 3, 60), polar(...c, 6, 60)), arc(...c, 6, -90, 60).d, icons['chart-sunburst'].d[5]],
  };
}
// The sankey: the nodes and each band (closed along the nodes' edges) filled
{
  const d = icons['chart-sankey'].d;
  const band = ([a0, a1], [b0, b1]) => `M6.25 ${n(a0)}C12 ${n(a0)} 12 ${n(a1)} 17.75 ${n(a1)}V${n(b1)}C12 ${n(b1)} 12 ${n(b0)} 6.25 ${n(b0)}Z`;
  icons['chart-sankey'].fill = { solid: [d[0], d[5], d[6], band([5.75, 6.75], [8.75, 9.75]), band([11.75, 16.25], [14.75, 19.25])] };
}
// The percent gauge filled up to its value; the rest of the band stays an outline, attached
{
  const c = [12, 16.25];
  const value = `${arc(...c, 9, 180, 300).d}L${pt(polar(...c, 5, 300))}${arc(...c, 5, 300, 180).d.replace(/^M[^A]*/, '')}Z`;
  const rest = `${arc(...c, 9, 300, 360).d}H17${arc(...c, 5, 360, 300).d.replace(/^M[^A]*/, '')}`;
  icons['gauge-progress'].fill = { solid: [value], wire: [rest] };
}
// The stores' lids are knocked out along their rim, as in the core database
icons['database-cluster'].fill.cut = [cylinder(12, 12, 5.5, 2, 19).rim];
icons["database-transfer"].fill.cut.push(...[6.5, 17.5].map((cx) => cylinder(cx, 11.75, 3.5, 1.4, 19.5).rim));
for (const name of ['data-warehouse', 'data-lakehouse']) icons[name].fill.cut.push(STORE().rim);
icons['data-lake'].fill.cut.push(DB.rim);
for (const name of ['data-source', 'data-source-plus']) icons[name].fill.cut.push(SOURCE_STORE.rim);
// The OLAP cube filled: its edges knocked out as the cube's, and its grid knocked out through the
// silhouette, 1.5 past it, so the cells stand apart at every weight (ending on the edge, the cuts
// found no clean interpolation between weights)
{
  const [x0, s, dp] = [4.75, 14.5, 6];
  const [x1, f] = [x0 + s, s - dp];
  const [fx, fy, h] = [x0 + f, x0 + dp, f / 2];
  const d = icons['data-cube'].d;
  const o = 1.5 * Math.SQRT1_2;
  icons['data-cube'].fill = {
    solid: [d[0]],
    cut: [
      d[1],
      d[2],
      rline([[x0 + h, x1 + 1.5], [x0 + h, fy], [x0 + h + dp + o, x0 - o]], 0),
      rline([[x0 - 1.5, fy + h], [fx, fy + h], [x1 + o, fy + h - dp - o]], 0),
      rline([[x0 + dp / 2 - 1.5, x0 + dp / 2], [x1 - dp / 2, x0 + dp / 2], [x1 - dp / 2, x1 - dp / 2 + 1.5]], 0),
    ],
  };
}
// The primary key's header: its divider knocked out through the card, 1.5 past both edges, so the
// two cells stand apart at every weight (ending on the edges, the cells joined at bold)
icons['primary-key'].fill = { solid: [icons['primary-key'].d[0]], cut: [line([8.5, 2.25], [8.5, 12.75])] };
// The pipe filled whole, the flow knocked out and the flanges attached
for (const name of ['data-pipeline', 'data-pipeline-clock', 'data-pipeline-alert']) icons[name].fill = { solid: [PIPE.body], wire: PIPE.d.slice(2, 4), cut: PIPE.d.slice(4) };

// ---------------------------------------------------------------------------------------------
// 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough. At 16 px a pixel
// measures 1.5 canvas units: straight runs go on pixel centers (0.75 + 1.5k), 45° diagonals pass
// through them, and dots (r 1) are centered on a pixel edge (multiples of 1.5), so each one falls
// whole into 2 × 2 pixels with 1 pixel of clearance or more.
// ---------------------------------------------------------------------------------------------
const SMALL_DOT = 1;
// The brackets of `array` and `matrix`, on pixel centers
const SMALL_BRACKETS = [
  rline([[6.75, 5.25], [3.75, 5.25], [3.75, 18.75], [6.75, 18.75]], 1.5),
  rline([[17.25, 5.25], [20.25, 5.25], [20.25, 18.75], [17.25, 18.75]], 1.5),
];
// The three dots turned into a gray bar
icons.array.small = { d: [...SMALL_BRACKETS, ...[7.5, 12, 16.5].map((x) => dot(x, 12, SMALL_DOT))] };
// The nine dots of r 0.3 were a smudge: at 16 px, the 2 × 2 grid
icons.matrix.small = { d: [...SMALL_BRACKETS, ...[9, 15].flatMap((y) => [9, 15].map((x) => dot(x, y, SMALL_DOT)))] };
// The dash on a pixel center and the dots symmetric, 2 pixels from it
icons.divide.small = { d: [line([4.25, 12.75], [19.75, 12.75]), dot(12, 7.5, SMALL_DOT), dot(12, 18, SMALL_DOT)] };
// The panels clogged up in the center: at 16 px, 2 pixels of clearance between them
{
  const d = [sq(3.75, 3.75, 6, 16.5, 1.5), sq(14.25, 3.75, 6, 6, 1.5), sq(14.25, 14.25, 6, 6, 1.5, { square: ['br'] })];
  icons.dashboard.small = { d, fill: { solid: d } };
}
// The 2.25 × 5 chevrons were two gray smudges: at 45°, through pixel centers
{
  const body = box(2.25, 3.75, 19.5, 16.5, 3.5);
  const rule = line([2.25, 8.25], [21.75, 8.25]);
  const code = [line([9.75, 11.25], [6.75, 14.25], [9.75, 17.25]), line([14.25, 11.25], [17.25, 14.25], [14.25, 17.25])];
  icons['code-window'].small = { d: [body, rule, ...code], fill: { solid: [body], cut: [rule, ...code] } };
}
// 16 px grid: the center of pixel k, the point (column, row) and a line through pixel centers.
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...cells) => line(...cells.map(([c, r]) => g(c, r)));

// The databases with a badge: the 24 px ellipses fell between two pixel rows and became gray bands.
// At 16 px, the sides in columns 2 and 13, and the flat parts of the lid, its rim, the band and the
// bottom on pixel centers (rows 1, 5, 9 and 13). The badge is the engine's pixel badge.
{
  const lid = 'M3.75 5.25c0-1.66 3.69-3 8.25-3s8.25 1.34 8.25 3-3.69 3-8.25 3-8.25-1.34-8.25-3Z';
  const body = 'M3.75 5.25v12c0 1.66 3.69 3 8.25 3s8.25-1.34 8.25-3v-12';
  const band = 'M20.25 11.25c0 1.66-3.69 3-8.25 3s-8.25-1.34-8.25-3';
  const rim = 'M20.25 5.25c0 1.66-3.69 3-8.25 3s-8.25-1.34-8.25-3';
  for (const name of ['database-plus', 'database-check', 'database-export', 'database-import', 'database-search', 'database-sync', ...DB_R5.filter((k) => icons[k].badge.kind)])
    icons[name].small = { d: [body, lid, band], fill: { solid: [`${body}Z`, lid], cut: [band, rim] }, badge: badge(icons[name].badge.kind, { size: 16 }) };
  // The round 5 stores with a custom piece in the corner (the cloud, the history arrow, the tag): the
  // same pixel store, their own piece as drawn
  for (const name of ['database-cloud', 'database-backup', 'metadata'])
    icons[name].small = { d: [body, lid, band], fill: { solid: [`${body}Z`, lid], cut: [band, rim] }, badge: icons[name].badge };
}
// The atom: the nucleus stuck to the orbits and at 16 px it was a gray flower. The center goes at
// the center of pixel (7, 7): the vertical orbit falls crisp (its sides in columns 5 and 9, its
// tips in rows 1 and 13) and the nucleus is a single pixel with clearance around it.
{
  const c = g(7, 7);
  icons.atom.small = { d: [circ(...c, 0.1), ...[30, 90, 150].map((a) => rell(...c, 9, 3, a))] };
}
// Automation: the r 9 cycle fell between two pixels and the bolt was a smudge. At 16 px, the r 8.25
// cycle (its sides in columns 2 and 13) with the 24 px arrowhead, and the pixel bolt from
// `cloud-bolt` (`archivos`): it drops at 45°, steps across and drops again, in the center of the
// cycle.
{
  const a = arc(12, 12, 8.25, -60, 240);
  icons.automation.small = { d: [a.d, head(a.end, a.tangent, 3.4), pl([9, 5], [6, 8], [9, 8], [6, 11])] };
}
// The neural network: the r 1.75 nodes and the connections that didn't fall on pixel centers turned
// into a gray mesh. At 16 px, nodes of r 1.5 on pixel centers (3 × 3 with their hole), the layers
// in columns 2, 7 and 13, and each layer's connections on pixel rows.
{
  const N = { a: g(2, 4), b: g(2, 10), c: g(7, 4), d: g(7, 10), e: g(13, 7) };
  const nodes = Object.values(N).map((p) => circ(...p, 1.5));
  const links = [['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'e'], ['d', 'e']].map(([x, y]) => edge(N[x], N[y], 1.5));
  icons['neural-network'].small = { d: [...nodes, ...links], fill: { solid: nodes, wire: links } };
}
// The graph: with nearly horizontal and nearly vertical edges, everything was gray at 16 px. The
// nodes on pixel centers (the big one r 3, the others r 1.5) and the first node's two edges, one
// pixel row and one pixel column; the one going to the big node, at 45°.
{
  const N = [[...g(3, 3), 1.5], [...g(12, 3), 1.5], [...g(10, 10), 3], [...g(3, 12), 1.5]];
  const nodes = N.map(([x, y, r]) => circ(x, y, r));
  const links = [[0, 1], [0, 2], [1, 2], [2, 3], [0, 3]].map(([a, b]) => edge(N[a], N[b], N[a][2], N[b][2]));
  icons['node-graph'].small = { d: [...nodes, ...links], fill: { solid: nodes, wire: links } };
}
// The draft: the dots sat 2 pixels apart and merged into a bar. At 16 px, the rest with the same
// adjustment the engine gives it, and the three 2 × 2 dots 1 pixel apart from each other and from
// the node.
{
  const [top, trunk, bottom, node] = icons['git-pull-request-draft'].d.slice(0, 4).map(snapper(icons['git-pull-request-draft'].d));
  const dots = [12, 7.5, 3].map((y) => dot(18, y, SMALL_DOT));
  icons['git-pull-request-draft'].small = { d: [top, trunk, bottom, node, ...dots], fill: { solid: [top, bottom, node, ...dots], wire: [trunk] } };
}

// The bump chart: rings of r 2 and edges off the pixel grid were a gray X. At 16 px, rings of r 1.5 on
// pixel centers (columns 2, 7 and 12, rows 5 and 10) joined by edges at 45°, through pixel centers.
{
  const r = 1.5;
  const A = [g(2, 5), g(7, 10), g(12, 5)];
  const B = [g(2, 10), g(7, 5), g(12, 10)];
  const nodes = [...A, ...B].map((p) => circ(...p, r));
  const links = [edge(A[0], A[1], r), edge(A[1], A[2], r), edge(B[0], B[1], r), edge(B[1], B[2], r)];
  icons['chart-bump'].small = { d: [...nodes, ...links], fill: { solid: nodes, wire: links } };
}
// The sunburst: rings 3 apart off the pixel grid were a gray target. At 16 px, the center on pixel
// (7, 7) and radii of 1.5, 4.5 and 7.5 (pixel centers), the outer level a quarter, its dividers on a
// pixel row, a pixel column and the pixel diagonal.
{
  const c = g(7, 7);
  const [r0, r1, r2] = [1.5, 4.5, 7.5];
  const spoke = (a, from, to) => line(polar(...c, from, a), polar(...c, to, a));
  const d = [circ(...c, r0), circ(...c, r1), arc(...c, r2, -90, 0).d, spoke(-90, r0, r2), spoke(0, r0, r2), spoke(-45, r1, r2)];
  const sector = `${arc(...c, r2, -90, 0).d}L${pt(polar(...c, r1, 0))}${arc(...c, r1, 0, -90).d.replace(/^M[^A]*/, '')}Z`;
  icons['chart-sunburst'].small = { d, fill: { solid: [circ(...c, r1), sector], cut: [circ(...c, r0), spoke(-90, r0, r1), spoke(0, r0, r1), arc(...c, r1, -90, 0).d, spoke(-45, r1, r2)] } };
}

// ---------------------------------------------------------------------------------------------
// Named parts (DESIGN.md › Named parts): whatever animates, changes state or sits under a badge
// ---------------------------------------------------------------------------------------------
const PARTS = {
  'chart-bar-stacked': { bars: [0, 1, 2], split: [3, 4, 5] },
  'chart-line': { line: [0], axis: [1] },
  'chart-lines': { line: [0, 1], axis: [2] },
  'chart-step': { line: [0], axis: [1] },
  'chart-pie': { pie: [0], slice: [1] },
  'chart-donut': { ring: [0, 1], split: [2, 3, 4] },
  'chart-scatter': { axis: [0], points: [1, 2, 3, 4, 5, 6] },
  'chart-radar': { web: [0], data: [1] },
  'chart-waterfall': { start: [0], change: [1], total: [2] },
  'chart-combo': { bars: [0, 1, 2], line: [3] },
  'chart-radial': { progress: [0, 1], center: [2] },
  'chart-distribution': { curve: [0], axis: [1] },
  'trend-up': { line: [0], arrow: [1] },
  'trend-down': { line: [0], arrow: [1] },
  'trend-flat': { line: [0], arrow: [1] },
  gauge: { dial: [0], needle: [1, 2] },
  analytics: { lens: [0], handle: [1], bars: [2, 3, 4] },
  schema: { tables: [0, 1], relation: [2] },
  terminal: { screen: [0], prompt: [1, 2] },
  'code-window': { screen: [0, 1], code: [2, 3] },
  'git-branch': { trunk: [0, 1], branch: [2, 3] },
  'git-merge': { trunk: [0, 1, 2], branch: [3, 4] },
  'git-pull-request': { trunk: [0, 1, 2], branch: [3, 4], arrow: [5] },
  'git-pull-request-closed': { trunk: [0, 1, 2], branch: [3, 4], mark: [5, 6] },
  'git-pull-request-draft': { trunk: [0, 1, 2], branch: [3, 4, 5, 6] },
  'git-fork': { trunk: [0], branch: [1, 2, 3, 4] },
  'git-compare': { base: [0, 1, 2], head: [3, 4, 5] },
  bug: { body: [0, 1, 2], legs: [3, 4, 5, 6] },
  flask: { body: [0, 1], level: [2] },
  'test-tube': { body: [0, 1], level: [2] },
  api: { socket: [0, 1], plug: [2, 3, 4] },
  webhook: { node: [0], hook: [1], arrow: [2] },
  cpu: { body: [0], core: [1], pins: [2, 3, 4, 5] },
  'ai-chip': { body: [0], spark: [1], pins: [2, 3, 4, 5] },
  server: { body: [0, 1], slots: [2, 4], lights: [3, 5] },
  'cloud-compute': { cloud: [0], prompt: [1, 2] },
  rocket: { body: [0, 1, 2], window: [3], flame: [4] },
  log: { body: [0], rows: from('log', 1) },
  automation: { cycle: [0, 1], bolt: [2] },
  sparkles: { large: [0], small: [1] },
  'search-sparkle': { lens: [0], handle: [1], spark: [2] },
  robot: { head: [0], antenna: [1, 2], eyes: [3, 4] },
  chatbot: { body: [0], eyes: [1, 2] },
  atom: { nucleus: [0], orbits: [1, 2, 3] },
  prompt: { field: [0], spark: [1], text: [2] },
  'code-sparkle': { code: [0, 1], spark: [2] },
  'chart-progress': { track: [0, 1], progress: [2, 3] },
  'chart-forecast': { line: [0], forecast: [1, 2, 3], axis: [4] },
  target: { rings: [0, 1], center: [2] },
  'data-filter': { funnel: [0], points: [1, 2, 3] },
  condition: { input: [0], decision: [1], branches: [2, 3, 4, 5] },
  'load-balancer': { source: [0], routes: [1, 2, 3, 4, 5, 6] },
  presentation: { board: [0], stand: [1], chart: [2] },
  'server-rack': { body: [0, 1, 2], lights: [3, 4, 5] },
  // Round 5: the pieces under a badge, and the ones that move or show a value
  'chart-bar-plus': { bars: [0, 1, 2] },
  'chart-bar-edit': { bars: [0, 1, 2] },
  'chart-anomaly': { line: [0], axis: [1] },
  'chart-realtime': { line: [0, 1], signal: [2, 3], axis: [4] },
  'dashboard-plus': { panels: [0, 1], mark: [2, 3] },
  'dashboard-edit': { panels: [0, 1] },
  'gauge-zones': { dial: [0, 1, 2], needle: [3, 4] },
  'database-transfer': { source: [0, 1, 2], target: [3, 4, 5], arrow: [6, 7] },
  'data-source': { store: [0, 1, 2], plug: [3, 4, 5] },
  'data-source-plus': { store: [0, 1, 2], plug: [3, 4, 5] },
  'table-export': { table: [0, 1, 2] },
  'table-import': { table: [0, 1, 2] },
  'data-pipeline': { pipe: [0, 1, 2, 3], flow: [4, 5, 6] },
  'data-pipeline-clock': { pipe: [0, 1, 2, 3], flow: [4, 5, 6] },
  'data-pipeline-alert': { pipe: [0, 1, 2, 3], flow: [4, 5, 6] },
  'primary-key': { table: [0, 1] },
  metadata: { body: [0, 2], lid: [1] },
};
// The database under each badge
for (const name of ['database-plus', 'database-check', 'database-search', 'database-sync', 'database-export', 'database-import', ...DB_R5])
  PARTS[name] = { body: [0, 2], lid: [1] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ---------------------------------------------------------------------------------------------
// Automatic variants that make no sense (DESIGN.md › Automatic variants)
// ---------------------------------------------------------------------------------------------
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already enclosed in a circle, or they are a bubble: they aren't enclosed again
variants(['chart-donut', 'chart-radial', 'target', 'automation', 'chatbot'], { circle: false });
// Already a card (or a bubble with a sign): they aren't enclosed in another square
variants(['chart-treemap', 'table', 'log', 'chatbot'], { square: false });
// With a badge: scaled down to 58–60 % the badge stops reading, and the slash would cut through it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Loose lines, arrows and glyphs: slashing them says nothing
variants(
  [
    'trend-up', 'trend-down', 'trend-flat', 'pulse', 'braces', 'brackets', 'array', 'function', 'variable', 'code-sparkle',
    'axis-3d', 'ab-test', 'matrix', 'diff', 'math', 'sum', 'lambda', 'regex', 'binary', 'infinity', 'equals', 'divide',
  ],
  { slash: false },
);

// ---------------------------------------------------------------------------------------------
// Mirroring (DESIGN.md › Mirroring): charts that grow or advance over time, indented lists, flows
// that read left to right and the prompt's text field
// ---------------------------------------------------------------------------------------------
for (const name of [
  'chart-bar-horizontal', 'chart-line', 'chart-lines', 'chart-step', 'chart-area', 'chart-scatter', 'chart-waterfall',
  'chart-gantt', 'chart-combo', 'chart-forecast', 'chart-progress', 'trend-up', 'trend-down', 'trend-flat', 'log',
  'tree-view', 'workflow', 'flowchart', 'load-balancer', 'neural-network', 'prompt', 'presentation',
])
  icons[name].mirror = true;
// Round 5: charts that run over time or grow from one side, flows that read left to right and rows of
// values
for (const name of [
  'chart-bar-horizontal-stacked', 'chart-bullet', 'chart-area-stacked', 'chart-streamgraph', 'chart-spline', 'chart-slope',
  'chart-bump', 'chart-regression', 'chart-moving-average', 'chart-compare', 'chart-threshold', 'chart-confidence',
  'chart-realtime', 'chart-retention', 'chart-sankey', 'chart-cohort', 'chart-small-multiples', 'chart-axes', 'data-point',
  'drill-down', 'drill-up', 'trend-up-down', 'gauge-linear', 'metric-card', 'database-transfer', 'data-stream', 'data-batch',
  'data-transform', 'data-lineage', 'deduplicate', 'foreign-key', 'relation-one-to-many', 'missing-value', 'data-notebook',
])
  icons[name].mirror = true;

// ---------------------------------------------------------------------------------------------
// Motion (DESIGN.md › Motion): each icon's own gesture
// ---------------------------------------------------------------------------------------------
icons['chart-pie'].motion = { effect: 'slide', parts: ['slice'], vector: [-1.25, -1.25] };
icons['trend-up'].motion = { effect: 'slide', vector: [1.5, -1.5] };
icons['trend-down'].motion = { effect: 'slide', vector: [1.5, 1.5] };
icons['trend-flat'].motion = { effect: 'slide', vector: [2, 0] };
icons.gauge.motion = { effect: 'wiggle', parts: ['needle'], origin: [12, 14] };
// A value: the needle sweeps the dial, from its start (150°) at 0 to its end (390°) at 1
icons.gauge.value = { turn: { parts: ['needle'], origin: [12, 14], from: 150, to: 390, at: 315 } };
icons.bug.motion = { effect: 'wiggle', origin: [12, 14] };
icons.api.motion = { effect: 'slide', parts: ['plug'], vector: [-1.25, 1.25] };
icons['ai-chip'].motion = { effect: 'beat', parts: ['spark'], origin: [12, 12] };
icons['cloud-compute'].motion = { effect: 'float', vector: [0, -1.5] };
icons.rocket.motion = { effect: 'slide', vector: [2, -2] };
icons.automation.motion = { effect: 'spin', parts: ['cycle'], origin: [12, 12] };
icons.sparkle.motion = { effect: 'beat', origin: [12, 12] };
icons.sparkles.motion = { effect: 'beat', origin: [12, 12] };
icons['search-sparkle'].motion = { effect: 'beat', parts: ['spark'], origin: [10.6, 10.6] };
icons['code-sparkle'].motion = { effect: 'beat', parts: ['spark'], origin: [12, 12] };
icons.prompt.motion = { effect: 'beat', parts: ['spark'], origin: [7.5, 12] };
icons.atom.motion = { effect: 'spin', parts: ['orbits'], origin: [12, 12] };
icons['database-sync'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['database-export'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] };
icons['database-import'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] };
// Round 5
icons['gauge-zones'].motion = { effect: 'wiggle', parts: ['needle'], origin: [12, 14] };
// A value: the needle sweeps the dial, as gauge's
icons['gauge-zones'].value = { turn: { parts: ['needle'], origin: [12, 14], from: 150, to: 390, at: 290 } };
icons['chart-realtime'].motion = { effect: 'beat', parts: ['signal'], origin: [13.25, 11.5] };
icons['database-transfer'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['database-gear'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['database-cloud'].motion = { effect: 'float', parts: ['badge'], vector: [0, -1.25] };
icons['data-stream'].motion = { effect: 'slide', vector: [2, 0] };

export default { category: 'datos', label: 'Datos y analítica', icons };
