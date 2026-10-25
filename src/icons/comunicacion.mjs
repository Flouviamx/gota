// Comunicación y personas (communication and people): bubbles, mail, calls, notifications,
// people and reactions. Everything comes from the engine (engine/geometry.mjs) plus a few local
// tools to move or scale Núcleo pieces (person, phone, bell, envelope) without redrawing them.
// Badges are the engine's (the pencil, the heart and the magnifier included), and anything that
// sits on top of another shape (an arrow, the front person, the diagonal of the -off icons) is a
// custom badge: the engine clears the base by exactly 1.5, never by hand. See DESIGN.md.
import { arc, badge, circ, dot, drop, f, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import navegacion from './navegacion.mjs';
import nucleo from './nucleo.mjs';

// ── Paths as segments ─────────────────────────────────────────────────────────────────────
// parse() turns an engine `d` into absolute segments (L, C, A); ser() turns them back into a `d`.
// That's how a shape is clipped by a rule (clip), a piece is moved or scaled (xf), and the area a
// custom badge clears is assembled (knockOf).
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
  const cxp = k * y1;
  const cyp = -k * x1;
  const c = [cxp + (p0[0] + p1[0]) / 2, cyp + (p0[1] + p1[1]) / 2];
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let da = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  if (sweep && da < 0) da += 2 * Math.PI;
  if (!sweep && da > 0) da -= 2 * Math.PI;
  if (Math.abs(da) < 1e-9 && large) da = sweep ? 2 * Math.PI : -2 * Math.PI;
  return { t: 'A', c, r, a0, da };
}

function parse(d) {
  const tk = d.match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const subs = [];
  let sp = null;
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lc = null;
  const n = () => Number.parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === 'Z') {
      if (sp) {
        if (!near([x, y], [sx, sy], 1e-6)) sp.segs.push({ t: 'L', a: [x, y], b: [sx, sy] });
        sp.closed = true;
      }
      x = sx;
      y = sy;
      lc = null;
      sp = null;
      continue;
    }
    if (C === 'M') {
      x = ox + n();
      y = oy + n();
      sx = x;
      sy = y;
      sp = { segs: [], closed: false };
      subs.push(sp);
      cmd = rel ? 'l' : 'L';
      lc = null;
      continue;
    }
    if (!sp) {
      sp = { segs: [], closed: false };
      subs.push(sp);
      sx = x;
      sy = y;
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
      let p1;
      if (C === 'C') p1 = [ox + n(), oy + n()];
      else p1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
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
  const a = L(p[0], p[1]);
  const b = L(p[1], p[2]);
  const c = L(p[2], p[3]);
  const d = L(a, b);
  const e = L(b, c);
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
  let n = 0;
  let a = pt(s, 0);
  for (let k = 1; k <= 16; k++) {
    const b = pt(s, k / 16);
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

/** Keeps only the parts of `d` where keep(p) holds: some shapes are built this way (the sticker's corner). */
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
        let lo = (k - 1) / N;
        let hi = k / N;
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

/** Similarity transform (rotation, scale, mirror, translation) applied to a `d`. */
function xf(d, { s = 1, deg = 0, o = [12, 12], dx = 0, dy = 0, flipX = false, flipY = false } = {}) {
  const m = (p) => {
    let v = [(p[0] - o[0]) * s, (p[1] - o[1]) * s];
    if (flipX) v[0] = -v[0];
    if (flipY) v[1] = -v[1];
    v = rot(v, [0, 0], deg);
    return [v[0] + o[0] + dx, v[1] + o[1] + dy];
  };
  const mir = flipX !== flipY ? -1 : 1;
  return ser(
    parse(d).map((sp) => ({
      closed: sp.closed,
      segs: sp.segs.map((g) => {
        if (g.t === 'L') return { t: 'L', a: m(g.a), b: m(g.b) };
        if (g.t === 'C') return { t: 'C', p: g.p.map(m) };
        const c = m(g.c);
        const a = m(pt(g, 0));
        return { t: 'A', c, r: g.r * s, a0: Math.atan2(a[1] - c[1], a[0] - c[0]), da: g.da * mir };
      }),
    })),
  );
}

/**
 * The area a custom badge clears: closed shapes as they are (their interior is cleared) and each
 * segment of an open line as a separate subpath, so the engine doesn't fill the triangle that
 * closes an arrowhead or an open pencil.
 */
const knockOf = (...ds) =>
  ser(ds.flatMap((d) => parse(d).flatMap((sp) => (sp.closed ? [sp] : sp.segs.map((s) => ({ segs: [s], closed: false }))))));

/** Open polyline with rounded corners (like roundpoly, without closing it). */
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

/** Smooth curve through points (Catmull-Rom → Bézier) for organic shapes. */
function smooth(pts, k = 1 / 6) {
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    o += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return o;
}

// ── Small glyphs ─────────────────────────────────────────────────────────────────────────
/** Check with the proportions of Núcleo's check, w wide and centered on (cx, cy). */
const check = (cx, cy, w) => line([cx - 0.5 * w, cy + 0.036 * w], [cx - 0.183 * w, cy + 0.357 * w], [cx + 0.5 * w, cy - 0.357 * w]);
const plus = (cx, cy, a) => [line([cx, cy - a], [cx, cy + a]), line([cx - a, cy], [cx + a, cy])];
const minus = (cx, cy, a) => [line([cx - a, cy], [cx + a, cy])];
const ex = (cx, cy, a) => [line([cx - a, cy - a], [cx + a, cy + a]), line([cx + a, cy - a], [cx - a, cy + a])];

/** Heart: two overlapping lobes that run down tangentially to a point. */
function heart(cx, cy, w) {
  const r = w / 3.7;
  const k = 0.82 * r;
  const L = [cx - k, cy];
  const R = [cx + k, cy];
  const T = [cx, cy + w * 0.62];
  const tan = (C, side) => {
    const dv = [T[0] - C[0], T[1] - C[1]];
    const dl = Math.hypot(...dv);
    const g = Math.atan2(dv[1], dv[0]) + side * Math.acos(r / dl);
    return g;
  };
  const gl = tan(L, 1);
  const gr = tan(R, -1);
  const dip = Math.acos(k / r);
  const dipL = 2 * Math.PI - dip;
  const a1 = arc(L[0], L[1], r, (gl * 180) / Math.PI, (dipL * 180) / Math.PI);
  const a2 = arc(R[0], R[1], r, ((Math.PI + dip) * 180) / Math.PI, ((gr + 2 * Math.PI) * 180) / Math.PI);
  return `M${P(T)}L${a1.d.slice(1)}${a2.d.replace(/^M[^A]+/, '')}Z`;
}

/** Four-pointed sparkle: four concave arcs centered on the corners of its box. */
function sparkle(cx, cy, r) {
  const k = [
    [cx + r, cy - r, 180, 90],
    [cx + r, cy + r, 270, 180],
    [cx - r, cy + r, 360, 270],
    [cx - r, cy - r, 90, 0],
  ];
  return `${k.map(([x, y, a0, a1], i) => (i ? arc(x, y, r, a0, a1).d.replace(/^M[^A]+/, '') : arc(x, y, r, a0, a1).d)).join('')}Z`;
}

/** Star with n points and soft corners. */
function star(cx, cy, R, r, rt = 0.8, rv = 0.5) {
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push(polar(cx, cy, i % 2 ? r : R, -90 + i * 36));
  return roundpoly(
    pts,
    pts.map((_, i) => (i % 2 ? rv : rt)),
  );
}

/** Núcleo's envelope flap, sized to an envelope (x, y, w, h). */
const flap = (x, y, w, h) =>
  rline(
    [
      [x + 0.216 * w, y + 0.3 * h],
      [x + w / 2, y + 0.3 * h + 0.7 * (0.284 * w)],
      [x + 0.784 * w, y + 0.3 * h],
    ],
    [0, 1.5 * Math.min(1, w / 19), 0],
  );

/** Vertical capsule (microphone). */
const pill = (x, y, w, h) => {
  const r = w / 2;
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
};

/** Face: the r 9 circle with two eyes and whatever is passed in as the mouth. */
const face = (...mouth) => [circ(12, 12, 9), dot(9, 9.75), dot(15, 9.75), ...mouth];

/** Thumbs up: a fist with the thumb raised and its cuff on the left. */
const THUMB = [
  roundpoly(
    [
      [7.25, 20.5],
      [7.25, 10.75],
      [10.1, 3.4],
      [12.9, 4.35],
      [12.4, 9.25],
      [20.25, 9.25],
      [18.75, 20.5],
    ],
    [0, 0.6, 1.5, 1.3, 0.9, 2.25, 1.75],
  ),
  rline(
    [
      [7.25, 10.75],
      [3.25, 10.75],
      [3.25, 20.5],
      [7.25, 20.5],
    ],
    [0, 1.25, 1.25, 0],
  ),
];
/** The seam between the fist and the cuff: knocked out in the fill so they don't merge into one blob. */
const THUMB_SEAM = line([7.25, 10.75], [7.25, 20.5]);

/**
 * Raised hand as a single outline: four fingers 3 wide with semicircular tips (each tip rests on
 * the side of the neighboring finger), the palm, and the thumb open at about 50°. The lines between
 * the fingers start from the outline and are knocked out in the fill.
 */
function raisedHand() {
  const tops = [6.25, 4.75, 5.5, 8.25];
  const xs = [7.25, 10.25, 13.25, 16.25, 19.25];
  const r = 1.5;
  const base = [9.5, 18.25];
  const tip = [5, 13.25];
  const L = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
  const u = [(tip[0] - base[0]) / L, (tip[1] - base[1]) / L];
  const n = [u[1], -u[0]]; // toward the thumb's outer edge
  const at = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
  const [outB, outT, inT, inB] = [at(base, r), at(tip, r), at(tip, -r), at(base, -r)];
  const J = [xs[0], inT[1] + ((xs[0] - inT[0]) / (inB[0] - inT[0])) * (inB[1] - inT[1])]; // where the thumb leaves the index finger
  let d = `M${P(J)}`;
  for (let i = 0; i < 4; i++) d += `V${f(tops[i])}A${f(r)} ${f(r)} 0 0 1 ${f(xs[i + 1])} ${f(tops[i])}`;
  d += `V14.5C19.25 18.1 16.65 20.75 13.5 20.75C10.65 20.75 ${P([outB[0] + 0.9, outB[1] + 1.1])} ${P(outB)}`;
  d += `L${P(outT)}A${f(r)} ${f(r)} 0 0 1 ${P(inT)}Z`;
  return [d, ...[1, 2, 3].map((i) => line([xs[i], Math.max(tops[i - 1], tops[i])], [xs[i], 11.25]))];
}

/** Small bust (badges and cards): head and shoulders resting on the bottom edge. */
const bust = (cx, headY, hr, baseY, sr) => [circ(cx, headY, hr), arc(cx, baseY, sr, 180, 360).d];

/** Measurements of a continuous corner of radius r (the same 0.6 smoothing as the engine's sq()). */
function cornerK(r, s = 0.6) {
  const p = (1 + s) * r;
  const a90 = 90 * (1 - s);
  const L = Math.sin(((a90 / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - a90) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L, r };
}

/** Open polyline with continuous corners (like the turn arrows in Navegación). */
function cline(pts, radius) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  const add = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
  const unit = (a, b) => {
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / n, (b[1] - a[1]) / n];
  };
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const V = pts[i];
    const r = rr[i];
    if (!r) {
      d += `L${P(V)}`;
      continue;
    }
    const u = unit(pts[i - 1], V);
    const v = unit(V, pts[i + 1]);
    const k = cornerK(r);
    const S = add(V, u, -k.p);
    const e1 = add(add(S, u, k.a + k.b + k.c), v, k.d);
    const e2 = add(add(e1, u, k.L), v, k.L);
    const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    d += `L${P(S)}C${P(add(S, u, k.a))} ${P(add(S, u, k.a + k.b))} ${P(e1)}`;
    d += `A${f(r)} ${f(r)} 0 0 ${sweep} ${P(e2)}`;
    d += `C${P(add(add(e2, u, k.d), v, k.c))} ${P(add(add(e2, u, k.d), v, k.b + k.c))} ${P(add(add(e2, u, k.d), v, k.a + k.b + k.c))}`;
  }
  return `${d}L${P(pts.at(-1))}`;
}

/** The arc from arc() without its leading M, so it can be chained onto a path. */
const arcTo = (...a) => arc(...a).d.replace(/^M[^A]+/, '');

/**
 * 文: the top stroke resting on the bar and the two diagonals, in a box of 8.5 × 8.75. The diagonals
 * leave 6 between them on the bar and cross 3 below it: the triangle they close with the bar stays
 * open at 2.1 (narrower, it filled in at heavy weights).
 */
const wen = (cx, cy) => [
  line([cx, cy - 4.25], [cx, cy - 2]),
  line([cx - 4.25, cy - 2], [cx + 4.25, cy - 2]),
  line([cx + 3, cy - 2], [cx - 3.4, cy + 4.5]),
  line([cx - 3, cy - 2], [cx + 3.4, cy + 4.5]),
];
/**
 * The letter A, h tall and as wide: two legs with a soft apex and a crossbar at 70 % of the height,
 * so its counter stays open at 2.1 (a narrower A with the bar at 66 % filled in).
 */
const letterA = (cx, top, h) => [
  rline(
    [
      [cx - 0.5 * h, top + h],
      [cx, top],
      [cx + 0.5 * h, top + h],
    ],
    [0, 0.7, 0],
  ),
  line([cx - 0.35 * h, top + 0.7 * h], [cx + 0.35 * h, top + 0.7 * h]),
];

// ── Base pieces ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const DROP = drop(12, 11.75, 8.75); // Núcleo's bubble
const MAIL = N.mail.d[0];
const FLAP = N.mail.d[1];
const PHONE = N.phone.d[0];
// Núcleo's bell in drawing order: the body first, then the clapper
const BELL = [N.bell.d[1], N.bell.d[0]];
/**
 * The bell under a corner badge: at 85 % and shifted down and to the left, so the clapper stays
 * whole outside the area the badge clears (at full size, the badge ate half of it). The clapper
 * drops 0.45 to keep the same 3 center to center from the body that it has at full size.
 */
const BELL_B = [xf(BELL[0], { s: 0.85, dx: -3.25, dy: 1 }), xf(BELL[1], { s: 0.85, dx: -3.25, dy: 1.45 })];
const BELL_B_TOP = [12 - 3.25, 12 + (2.95 - 12) * 0.85 + 1]; // the hanging point, for motion
const VIDEO = sq(2.5, 6, 13.25, 12, 3.5, { square: ['br'] });
const LENS = rline(
  [
    [15.75, 10.25],
    [21.25, 7.25],
    [21.25, 16.75],
    [15.75, 13.75],
  ],
  [0, 1.5, 1.5, 0],
);
/** Whoever is on the other end of the video call: head and shoulders inside the camera. */
const CALLER = [circ(9.13, 10.35, 1.9), arc(9.13, 18, 3.6, 180, 360).d];
const SCREEN = sq(2.5, 3.5, 19, 13.5, 3.5, { square: ['br'] });
const STAND = line([8.5, 20.5], [15.5, 20.5]);
const MIC = pill(9, 2.75, 6, 10.75);
const MIC_HOLDER = rline(
  [
    [5.75, 9.75],
    [5.75, 17.25],
    [18.25, 17.25],
    [18.25, 9.75],
  ],
  [0, 6.25, 6.25, 0],
);
const MIC_STEM = line([12, 17.25], [12, 21.25]);
const BROADCAST = [circ(12, 12, 1.75), arc(12, 12, 5, -42, 42).d, arc(12, 12, 5, 138, 222).d, arc(12, 12, 8.5, -40, 40).d, arc(12, 12, 8.5, 140, 220).d];
const PERSON = N.person.d;
const PERSON_L = PERSON.map((d) => xf(d, { dx: -2.5 })); // the person shifted to make room for the badge
/** Núcleo's person scaled from the feet; the head moves up to keep its gap from the shoulders. */
const personAt = (s, dx = 0, dy = 0) => [xf(PERSON[0], { s, o: [12, 20.6], dx, dy: dy - 1.95 * (1 - s) }), xf(PERSON[1], { s, o: [12, 20.6], dx, dy })];
const dropL = (cx, cy, r) => xf(drop(cx, cy, r), { flipX: true, o: [cx, cy] }); // the mirrored drop: the other side of the conversation
/** Paper clip with three legs 3 apart, standing to the right of the envelope. */
const CLIP = `M18.5 10V17.75${arcTo(17, 17.75, 1.5, 0, 180)}V7.5${arcTo(18.5, 7.5, 3, 180, 360)}V19.5`;
/** Núcleo's envelope at 80 %, top left, so the clip fits beside it. */
const MAIL_S = [MAIL, FLAP].map((d) => xf(d, { s: 0.8, o: [2.5, 5], dy: 0.75 }));
/**
 * The envelope under a corner badge: at 85 % and top left, so the flap keeps a 1.5 gap from the
 * area the badge clears (at full size, its right arm grazed it and, in the fill, left a sliver
 * between the knocked-out flap and the badge's gap).
 */
const MAIL_B = [MAIL, FLAP].map((d) => xf(d, { s: 0.85, o: [2.5, 5], dy: -0.5 }));
/** The envelope under the notification dot: full size and 2.5 lower, with the flap away from the dot. */
const MAIL_DOT = [MAIL, FLAP].map((d) => xf(d, { dy: 2.5 }));

// ── Custom badges ────────────────────────────────────────────────────────────────────────
// `knock` is the area the engine clears with a 1.5 gap; anything sitting on top of another shape
// brings its own area.
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** Right arrow on top of a shape (it stays a line in the fill). */
const arrowOver = (from, to, len = 3.4) => {
  const d = [line(from, to), head(to, [to[0] - from[0], to[1] - from[1]], len)];
  return own(d, knockOf(...d));
};
/** The diagonal of the -off icons: it sits on top as its own piece and the engine clears 1.5 on each side. */
const SLASH = line([3.25, 3.25], [20.75, 20.75]);
const slashOver = (s = SLASH) => own([s], s);
/** A closed shape on top of another (the front bubble, the person in front). */
const front = (ds, fill = { solid: ds }) => own(ds, ds.join(''), fill);

// ── Round 4 pieces ───────────────────────────────────────────────────────────────────────
// What another category already drew comes from it (navegacion's undo, lugares' map pin, dispositivos'
// smartphone, the turn arrow of message-reply); the corner glyphs are built
// around the standard badge's center as social's are, and clear its circle as well as their own
// shape, so a pair like mail-pin ↔ mail-plus only swaps the badge.
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
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
 * The part of `d` that shows behind the closed shapes `fronts` (social's behind()): whatever lies
 * inside them or closer than `gap` center to center to their outline is dropped, the set's knockout.
 */
function behind(d, fronts, gap = 3) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  return clip(d, (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005));
}
/** Inside the drop (cx, cy, r): its circle, and the square quadrant at the bottom right. */
const inDrop = (cx, cy, r) => ([x, y]) => (x > cx && y > cy ? x <= cx + r + 1e-6 && y <= cy + r + 1e-6 : Math.hypot(x - cx, y - cy) <= r + 1e-6);
/**
 * A bust inside the drop: the head, and the shoulders an arc that runs out to the bubble's outline
 * and ends on it (as person-circle's shoulders end on the ring).
 */
const dropBust = (cx, headY, hr, shY, sr, bubble = [12, 11.75, 8.75]) => [circ(cx, headY, hr), clip(arc(cx, shY, sr, 180, 360).d, inDrop(...bubble))];

/**
 * Núcleo's person scaled from the feet (social's personAt): the head moves up to keep its gap from
 * the shoulders, never less than 2.35 between them, so a small person keeps its head apart at 2.1.
 */
const personSmall = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};

/** The pair from people (Núcleo's clients): the one in front whole, the one behind cut 3 short of it. */
const pair = (s, [fx, fy], [bx, by], sb = s * 0.85) => {
  const fr = personSmall(s, fx, fy);
  return [...personSmall(sb, bx, by).map((d) => behind(d, fr.map(shut))), ...fr];
};

const BC = [17.25, 17.25];
const RING = circ(BC[0], BC[1], 4.25);
/** A glyph for the corner: it clears the standard badge's circle and its own shape. */
const glyph = (d, mine, fill) => ({ d, knock: `${RING}${mine}`, ...(fill && { fill }) });
/** Núcleo's pushpin at half size, its needle into the corner (social's post-pin, ventanas' window-pin). */
const PIN_B = (() => {
  const s = 0.5;
  const [bar, top, needle] = N.pin.d.map((d) => place(d, s, [12, 3.25], [BC[0], 12.75]));
  const k = (p) => [BC[0] + (p[0] - 12) * s, 12.75 + (p[1] - 3.25) * s];
  const area = roundpoly([k([8.75, 3.25]), k([15.25, 3.25]), k([17.4, 11.9]), k([17.4, 12.75]), k([12, 20.75]), k([6.6, 12.75]), k([6.6, 11.9])], 0);
  return glyph([bar, top, needle], area, { solid: [shut(top)], wire: [bar, needle] });
})();
/** A chain link laid on the diagonal as Núcleo's link lies: two hooks of r 2.25 and the bar between them (social's person-link). */
const LINK_B = (() => {
  const [x, y] = BC;
  const d = [`M${f(x - 2.83)} ${f(y - 2.25)}A2.25 2.25 0 0 0 ${f(x - 2.83)} ${f(y + 2.25)}`, `M${f(x + 2.83)} ${f(y - 2.25)}A2.25 2.25 0 0 1 ${f(x + 2.83)} ${f(y + 2.25)}`, line([x - 1, y], [x + 1, y])].map((p) => turnPath(p, -45, BC));
  return glyph(d, knockOf(...d));
})();
// ── Marks inside the bubble ──
// The family's marks sit inside the drop (message-lock, message-search, message-clock): its whole
// silhouette and its square corner stay, the fill is the drop with the mark knocked out, and at 16 px
// the mark snaps into the small bubble like the others'. Each one fits inside r 5.75 of the bubble's
// center, so it keeps 3 center to center from the outline.
/** A pencil at 45°, its tip at the bottom left: the engine's edit glyph (a body 3 wide, its band 2.4 from the rounded end), `len` long. */
function pencil(tip, len, hw = 1.5) {
  const at = (s, o) => [tip[0] + (s + o) * Math.SQRT1_2, tip[1] + (o - s) * Math.SQRT1_2];
  const R = f(hw);
  const body = `M${P(tip)}L${P(at(2.6, -hw))}L${P(at(len, -hw))}A${R} ${R} 0 0 1 ${P(at(len, hw))}L${P(at(2.6, hw))}Z`;
  return [body, line(at(len - 2.4, -hw), at(len - 2.4, hw))];
}
/** The chain link of mail-link and phone-link (LINK_B), on the bubble's center and a tenth larger. */
const LINK_IN = LINK_B.d.map((d) => place(d, 1.1, BC, [12, 12]));
/** The paper clip of mail-attachment (legs 3 apart, turns of 1.5 and 3), leaning 45° as archivos' does. */
const CLIP_IN = (() => {
  const [x, y] = [12, 12.75];
  return turnPath(`M${P([x, y - 1])}V${f(y + 2.5)}${arcTo(x - 1.5, y + 2.5, 1.5, 0, 180)}V${f(y - 2.5)}${arcTo(x, y - 2.5, 3, 180, 360)}V${f(y + 4)}`, 45, [12, 12]);
})();
/** lugares' map pin at 60 %, its hole a dot. */
const MAP_PIN_IN = (() => {
  const s = 0.6;
  return [place(lugares.icons['map-pin'].d[0], s, [12, 11.7], [12, 12]), dot(12, 12 + (10.25 - 11.7) * s)];
})();

const icons = {
  // ── Chat bubbles: always the logomark's drop ──
  'message-dots': {
    tags: ['escribiendo', 'chat', 'mensaje', 'typing', 'chat bubble'],
    d: [DROP, dot(7.75, 12), dot(12, 12), dot(16.25, 12)],
  },
  'message-plus': {
    tags: ['nuevo mensaje', 'iniciar chat', 'conversación', 'new message', 'compose'],
    d: [DROP, ...plus(12, 12, 3.5)],
  },
  'message-minus': {
    tags: ['quitar mensaje', 'ocultar', 'chat', 'remove message'],
    d: [DROP, ...minus(12, 12, 3.5)],
  },
  'message-check': {
    tags: ['mensaje leído', 'resuelto', 'conversación', 'resolved', 'read'],
    d: [DROP, check(12, 12, 7.5)],
  },
  'message-x': {
    tags: ['borrar mensaje', 'cerrar chat', 'eliminar', 'delete message'],
    d: [DROP, ...ex(12, 12, 2.6)],
  },
  'message-question': {
    tags: ['pregunta', 'ayuda', 'preguntas frecuentes', 'help', 'faq'],
    // The hook ends with a 1.5 gap from the dot
    d: [DROP, `${arc(12, 9.25, 2.5, 180, 360).d}C14.5 11 12 11 12 12.75V12.85`, dot(12, 16.55)],
  },
  'message-alert': {
    tags: ['aviso', 'reportar', 'mensaje importante', 'report', 'alert'],
    // The measurements of the mark in `important` (Núcleo): a 1.5 gap between the bar and the dot
    d: [DROP, line([12, 7.4], [12, 12.6]), dot(12, 16.3)],
  },
  'message-heart': {
    tags: ['me gusta', 'reacción', 'mensaje', 'love', 'like'],
    d: [DROP, heart(12, 10.25, 8)],
  },
  'message-smile': {
    tags: ['reacción', 'emoji', 'mensaje amable', 'reaction', 'smile'],
    d: [DROP, dot(9.5, 9.75), dot(14.5, 9.75), arc(12, 11.5, 3.6, 30, 150).d],
  },
  'message-star': {
    tags: ['favorito', 'reseña', 'opinión', 'feedback', 'review'],
    d: [DROP, star(12, 12.2, 5, 2.3, 0.75, 0.5)],
  },
  'message-video': {
    tags: ['videomensaje', 'video', 'reproducir', 'video message'],
    d: [
      DROP,
      roundpoly(
        [
          [10, 8.25],
          [16, 12],
          [10, 15.75],
        ],
        1.1,
      ),
    ],
  },
  'message-voice': {
    tags: ['nota de voz', 'audio', 'mensaje de voz', 'voice message', 'voice note'],
    d: [DROP, line([7.5, 10.75], [7.5, 13.25]), line([10.5, 8.25], [10.5, 15.75]), line([13.5, 9.75], [13.5, 14.25]), line([16.5, 11], [16.5, 13])],
  },
  'message-reply': {
    tags: ['responder', 'hilo', 'contestar', 'reply', 'thread'],
    d: [
      DROP,
      rline(
        [
          [8, 10.25],
          [15.75, 10.25],
          [15.75, 15.25],
        ],
        [0, 3, 0],
      ),
      head([8, 10.25], [-1, 0], 2.75),
    ],
  },
  'message-search': {
    tags: ['buscar en chats', 'buscar mensajes', 'conversación', 'search messages'],
    d: [DROP, circ(11.25, 11.25, 3), line([13.4, 13.4], [15.6, 15.6])],
  },
  'message-sparkle': {
    tags: ['asistente', 'inteligencia artificial', 'chat con ia', 'ai chat', 'assistant'],
    d: [DROP, sparkle(12, 12, 4.75)],
  },
  'message-hashtag': {
    tags: ['canal', 'tema', 'conversación', 'channel', 'topic'],
    d: [DROP, line([10, 8], [10, 16]), line([14, 8], [14, 16]), line([8, 10], [16, 10]), line([8, 14], [16, 14])],
  },
  'message-code': {
    tags: ['código', 'revisión', 'comentario técnico', 'code review', 'snippet'],
    d: [DROP, line([10, 9], [7.75, 12], [10, 15]), line([14, 9], [16.25, 12], [14, 15])],
  },
  'message-lock': {
    tags: ['privado', 'cifrado', 'chat seguro', 'private', 'encrypted'],
    d: [
      DROP,
      sq(8.75, 11, 6.5, 5, 1.5, { square: ['br'] }),
      rline(
        [
          [10, 11],
          [10, 7.25],
          [14, 7.25],
          [14, 11],
        ],
        [0, 2, 2, 0],
      ),
    ],
  },
  'message-clock': {
    tags: ['pendiente', 'programado', 'esperando respuesta', 'pending', 'scheduled'],
    d: [DROP, line([12, 7.5], [12, 12.25], [15.25, 14.25])],
  },
  'message-unread': {
    tags: ['no leído', 'mensaje nuevo', 'chat', 'unread', 'new message'],
    // The drop slightly smaller and shifted down and to the left: the engine's dot takes little from it
    d: [drop(11.25, 12.5, 8.25)],
    badge: badge('dot'),
  },
  'message-off': {
    tags: ['silenciar chat', 'sin mensajes', 'chat desactivado', 'chat off', 'mute chat'],
    d: [DROP],
    badge: slashOver(),
  },
  'messages': {
    tags: ['conversaciones', 'chats', 'diálogo', 'conversations', 'chat'],
    // Two people talking: the back drop mirrored, the front one on top with the signature corner
    d: [dropL(9.5, 9.5, 6.25)],
    badge: front([drop(14.5, 14.5, 6.25)]),
  },

  // ── Mail ──
  'mail-open': {
    tags: ['correo abierto', 'leído', 'sobre abierto', 'mail open', 'read'],
    d: [
      roundpoly(
        [
          [2.75, 10.25],
          [12, 3.25],
          [21.25, 10.25],
          [21.25, 20.75],
          [2.75, 20.75],
        ],
        [2, 2.4, 2, 0, 3.25],
      ),
      rline(
        [
          [6.6, 13.5],
          [12, 17.25],
          [17.4, 13.5],
        ],
        [0, 1.6, 0],
      ),
    ],
  },
  'mail-unread': {
    tags: ['correo nuevo', 'no leído', 'bandeja', 'unread mail', 'new email'],
    d: MAIL_DOT,
    badge: badge('dot'),
  },
  'mail-plus': {
    tags: ['redactar', 'nuevo correo', 'escribir', 'compose', 'new email'],
    d: MAIL_B,
    badge: badge('plus'),
  },
  'mail-minus': {
    tags: ['darse de baja', 'quitar correo', 'desuscribir', 'unsubscribe'],
    d: MAIL_B,
    badge: badge('minus'),
  },
  'mail-check': {
    tags: ['correo entregado', 'confirmado', 'verificado', 'delivered', 'verified email'],
    d: MAIL_B,
    badge: badge('check'),
  },
  'mail-x': {
    tags: ['correo rebotado', 'error de envío', 'no entregado', 'bounced', 'failed'],
    d: MAIL_B,
    badge: badge('x'),
  },
  'mail-clock': {
    tags: ['envío programado', 'enviar después', 'correo pendiente', 'scheduled', 'send later'],
    d: MAIL_B,
    badge: badge('clock'),
  },
  'mail-send': {
    tags: ['enviar correo', 'salida', 'enviado', 'send mail', 'outbox'],
    // The arrow leaves through the envelope's bottom corner
    d: [MAIL, FLAP],
    badge: arrowOver([13.75, 18.5], [21.75, 18.5]),
  },
  'mail-draft': {
    tags: ['borrador', 'redactando', 'editar correo', 'draft', 'edit email'],
    d: MAIL_B,
    badge: badge('edit'),
  },
  'mail-attachment': {
    tags: ['adjunto', 'archivo adjunto', 'clip', 'attachment', 'paperclip'],
    d: MAIL_S,
    badge: own([CLIP], knockOf(CLIP)),
  },
  'mail-signature': {
    tags: ['firma de correo', 'firma', 'remitente', 'email signature', 'signature'],
    d: [
      MAIL,
      rline(
        [
          [8, 8.75],
          [12, 11.25],
          [16, 8.75],
        ],
        [0, 1.1, 0],
      ),
      smooth([
        [6.5, 16],
        [8.25, 13.5],
        [9.5, 13.75],
        [9.25, 15.75],
        [11.25, 14.25],
        [12.75, 15.5],
        [14.5, 14.5],
        [17.5, 14.5],
      ]),
    ],
  },
  'mail-search': {
    tags: ['buscar correo', 'filtrar', 'bandeja', 'search mail'],
    d: MAIL_B,
    badge: badge('search'),
  },
  'mail-letter': {
    tags: ['carta', 'invitación', 'sobre con carta', 'letter', 'invitation'],
    // The letter peeks out of the envelope: the front pocket sits on top and the engine clears it.
    // Its bottom edge stays inside the pocket (any higher, it left a sliver next to the vertex)
    d: [sq(6.5, 3, 11, 14.5, 2, { square: ['br'] }), line([9.5, 7], [14.5, 7])],
    badge: front([
      roundpoly(
        [
          [2.75, 11.5],
          [12, 16.75],
          [21.25, 11.5],
          [21.25, 20.75],
          [2.75, 20.75],
        ],
        [1, 1.6, 1, 0, 3.25],
      ),
    ]),
  },
  'mail-stack': {
    tags: ['correos', 'boletín', 'envío masivo', 'newsletter', 'bulk mail'],
    // The back envelope whole; the front one sits on top, with its flap knocked out in the fill
    d: [sq(5.75, 4, 15.75, 12.25, 3.5, { square: ['br'] })],
    badge: (() => {
      const body = sq(2.5, 7.25, 15.75, 12.25, 3.5, { square: ['br'] });
      const fl = flap(2.5, 7.25, 15.75, 12.25);
      return own([body, fl], body, { solid: [body], cut: [fl] });
    })(),
  },
  'mailbox': {
    tags: ['buzón', 'correo postal', 'cartas', 'mailbox', 'postbox'],
    d: [
      // The mailbox from the side: the arched door at the front, the raised flag and the post
      roundpoly(
        [
          [2.75, 17.5],
          [2.75, 8],
          [21.25, 8],
          [21.25, 17.5],
        ],
        [1, 4.75, 4.75, 0],
      ),
      `M11.75 17.5V12.75${arcTo(7, 12.75, 4.75, 0, -90)}`,
      line([7.25, 17.5], [7.25, 21.25]),
      line([16.5, 8], [16.5, 2.75]),
      rline(
        [
          [16.5, 2.75],
          [19.75, 2.75],
          [19.75, 5],
          [16.5, 5],
        ],
        [0, 0.6, 0.6, 0],
      ),
    ],
  },
  'reply-all': {
    tags: ['responder a todos', 'contestar', 'correo', 'reply all'],
    // The same turn as arrow-turn-left (Navegación) with a second head 3 away
    d: [
      cline(
        [
          [18.75, 20.25],
          [18.75, 9.5],
          [9, 9.5],
        ],
        [0, 4.5, 0],
      ),
      head([9, 9.5], [-1, 0], 5 * Math.SQRT2),
      head([4.75, 9.5], [-1, 0], 5 * Math.SQRT2),
    ],
  },

  // ── Calls: Núcleo's phone ──
  'phone-incoming': {
    tags: ['llamada entrante', 'recibir llamada', 'teléfono', 'incoming call'],
    d: [PHONE, line([20.5, 3.5], [14.5, 9.5]), head([14.5, 9.5], [-1, 1], 4.5)],
  },
  'phone-outgoing': {
    tags: ['llamada saliente', 'marcar', 'llamar', 'outgoing call', 'dial'],
    d: [PHONE, line([14.5, 9.5], [20.5, 3.5]), head([20.5, 3.5], [1, -1], 4.5)],
  },
  'phone-missed': {
    tags: ['llamada perdida', 'rechazada', 'sin contestar', 'missed call'],
    d: [PHONE, ...ex(17.5, 6.5, 2.75)],
  },
  'phone-plus': {
    tags: ['agregar llamada', 'conferencia', 'añadir', 'add call', 'conference'],
    d: [PHONE, ...plus(17.5, 6.5, 3.25)],
  },
  'phone-forward': {
    tags: ['desviar llamada', 'reenviar', 'redirigir', 'forward call'],
    d: [PHONE, line([14, 6.5], [21, 6.5]), head([21, 6.5], [1, 0], 3.4)],
  },
  'phone-transfer': {
    tags: ['transferir llamada', 'cambiar', 'pasar llamada', 'transfer call'],
    // Two short arrows in opposite directions (the outgoing one below, away from the handset); the
    // 2.75 heads leave a 1.5 gap between them and from the phone
    d: [PHONE, line([21.25, 3.75], [14.5, 3.75]), head([14.5, 3.75], [-1, 0], 2.75), line([14.5, 9], [21.25, 9]), head([21.25, 9], [1, 0], 2.75)],
  },
  'phone-hold': {
    tags: ['en espera', 'pausa', 'llamada retenida', 'on hold'],
    d: [PHONE, line([15.75, 3.5], [15.75, 9.5]), line([19.75, 3.5], [19.75, 9.5])],
  },
  'phone-ringing': {
    tags: ['timbrando', 'llamando', 'llamada', 'ringing', 'calling'],
    d: [PHONE, arc(13, 11, 5, -78, -12).d, arc(13, 11, 8.5, -80, -10).d],
  },
  'phone-hangup': {
    tags: ['colgar', 'terminar llamada', 'cortar', 'hang up', 'end call'],
    d: [xf(PHONE, { deg: 135, s: 0.82, dy: 1 })],
  },
  'phone-off': {
    tags: ['sin llamadas', 'no molestar', 'teléfono apagado', 'phone off'],
    // The diagonal runs the other way so it doesn't run along the handset
    d: [PHONE],
    badge: slashOver(line([20.75, 3.25], [3.25, 20.75])),
  },
  'voicemail': {
    tags: ['buzón de voz', 'mensaje de voz', 'grabación', 'voicemail'],
    d: [circ(6.75, 12, 3.75), circ(17.25, 12, 3.75), line([6.75, 15.75], [17.25, 15.75])],
  },
  'dialpad': {
    tags: ['teclado', 'marcador', 'números', 'keypad', 'dialpad'],
    d: [4.5, 9.5, 14.5].flatMap((y) => [6.25, 12, 17.75].map((x) => dot(x, y))).concat(dot(12, 19.5)),
  },

  // ── Video and voice ──
  'video-call': {
    tags: ['videollamada', 'llamada de video', 'cámara', 'video call', 'facetime'],
    d: [VIDEO, LENS, ...CALLER],
  },
  'video-call-off': {
    tags: ['cámara apagada', 'sin video', 'terminar videollamada', 'video off'],
    // Without the person: the diagonal ran through their head and left fragments. The diagonal runs
    // 0.53 below the canvas's, so its clearance stays clear of where the lens meets the body: on the
    // canvas's diagonal it cut that joint at light weights and not at heavy ones (the lens opened)
    d: [VIDEO, LENS],
    badge: slashOver(line([2.9, 3.65], [20.4, 21.15])),
  },
  'video-meeting': {
    tags: ['videoconferencia', 'reunión', 'junta en línea', 'meeting', 'webinar'],
    d: [SCREEN, STAND, ...bust(12, 8.75, 2.25, 17, 3.75)],
  },
  'screen-share': {
    tags: ['compartir pantalla', 'presentar', 'proyectar', 'screen share', 'present'],
    d: [SCREEN, STAND, line([12, 13.5], [12, 7]), head([12, 7], [0, -1], 3.4)],
  },
  'screen-share-off': {
    tags: ['dejar de compartir', 'detener presentación', 'pantalla', 'stop sharing'],
    d: [SCREEN, STAND, ...ex(12, 10.25, 2.5)],
  },
  'microphone': {
    tags: ['micrófono', 'voz', 'grabar', 'mic', 'microphone'],
    d: [MIC, MIC_HOLDER, MIC_STEM],
  },
  'microphone-off': {
    tags: ['silenciar', 'micrófono apagado', 'mudo', 'mute mic', 'mic off'],
    d: [MIC, MIC_HOLDER, MIC_STEM],
    badge: slashOver(),
  },
  'headset': {
    tags: ['diadema', 'soporte', 'atención a clientes', 'headset', 'support'],
    // The headband from headphones (Dispositivos) with the mic boom ending in its capsule
    d: [
      arc(12, 12, 8.25, 180, 360).d,
      sq(3.75, 12, 4.5, 6.75, 1.5, { square: ['tl'] }),
      sq(15.75, 12, 4.5, 6.75, 1.5, { square: ['tr'] }),
      cline(
        [
          [18, 18.75],
          [18, 20.75],
          [12.25, 20.75],
        ],
        [0, 2, 0],
      ),
      dot(11.75, 20.75),
    ],
  },
  'walkie-talkie': {
    tags: ['radio', 'dos vías', 'intercomunicador', 'walkie talkie'],
    d: [sq(6.5, 7.75, 11, 13.5, 3, { square: ['br'] }), line([9.5, 7.75], [9.5, 2.75]), line([9.75, 12], [14.25, 12]), line([9.75, 15], [14.25, 15])],
  },

  // ── Notifications: Núcleo's bell ──
  'bell-dot': {
    tags: ['aviso nuevo', 'notificación', 'sin leer', 'unread', 'new notification'],
    d: BELL,
    badge: badge('dot'),
  },
  'bell-plus': {
    tags: ['crear aviso', 'suscribirse', 'activar notificaciones', 'add alert', 'subscribe'],
    d: BELL_B,
    badge: badge('plus'),
  },
  'bell-check': {
    tags: ['suscrito', 'avisos activos', 'notificación vista', 'subscribed'],
    d: BELL_B,
    badge: badge('check'),
  },
  'bell-clock': {
    tags: ['posponer aviso', 'recordatorio', 'más tarde', 'snooze', 'reminder'],
    d: BELL_B,
    badge: badge('clock'),
  },
  'bell-ringing': {
    tags: ['timbrando', 'alarma', 'notificación', 'ringing', 'alert'],
    d: [...BELL, arc(12, 9.35, 9.25, -155, -125).d, arc(12, 9.35, 9.25, -55, -25).d],
  },
  'bell-off': {
    tags: ['silenciar avisos', 'no molestar', 'notificaciones apagadas', 'notifications off'],
    d: BELL,
    badge: slashOver(),
  },
  'notification-badge': {
    tags: ['notificación', 'insignia', 'app con aviso', 'badge', 'notification'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] })],
    badge: badge('dot'),
  },

  // ── Symbols and broadcast ──
  'at-sign': {
    tags: ['arroba', 'mención', 'correo', 'at', 'mention'],
    d: [circ(12, 12, 3.5), `M15.5 8.5V12${arcTo(18, 12, 2.5, 180, 0)}${arcTo(12, 12, 8.5, 0, -300)}`],
  },
  'hashtag': {
    tags: ['etiqueta', 'canal', 'almohadilla', 'hashtag', 'channel'],
    d: [line([10.25, 3.5], [8.5, 20.5]), line([15.5, 3.5], [13.75, 20.5]), line([4.5, 8.75], [19.75, 8.75]), line([4.25, 15.25], [19.5, 15.25])],
  },
  'megaphone': {
    tags: ['anuncio', 'campaña', 'altavoz', 'announcement', 'marketing'],
    d: [
      roundpoly(
        [
          [3, 9],
          [8.5, 9],
          [18.25, 4],
          [18.25, 20],
          [8.5, 15],
          [3, 15],
        ],
        [1.75, 0.6, 1.5, 1.5, 0.6, 1.75],
      ),
      // The handle starts and ends on the body
      rline(
        [
          [6, 15],
          [7, 20.25],
          [10.25, 20.25],
          [9.85, 15.69],
        ],
        [0, 1, 1, 0],
      ),
      line([21.25, 10.25], [21.25, 13.75]),
    ],
  },
  'broadcast': {
    tags: ['transmisión', 'en vivo', 'señal', 'broadcast', 'live'],
    d: BROADCAST,
  },
  'broadcast-off': {
    tags: ['fuera del aire', 'sin transmisión', 'desconectado', 'offline'],
    // Without the center dot: it would sit entirely behind the diagonal
    d: BROADCAST.slice(1),
    badge: slashOver(),
  },
  'radio-tower': {
    tags: ['antena', 'señal', 'transmisión', 'radio tower', 'antenna'],
    d: [circ(12, 7.25, 1.75), line([7.75, 21], [12, 9], [16.25, 21]), arc(12, 7.25, 5, 150, 210).d, arc(12, 7.25, 5, -30, 30).d, arc(12, 7.25, 8.25, 152, 208).d, arc(12, 7.25, 8.25, -28, 28).d],
  },
  'satellite-dish': {
    tags: ['satélite', 'parabólica', 'antena', 'satellite', 'dish'],
    // The receiver's arm reaches the dot (it touches it rather than grazing it)
    d: [`${arc(9.25, 14.75, 6.5, 225, 45).d}Z`, line([9.25, 14.75], [13.75, 10.25]), dot(14.25, 9.75), arc(14.25, 9.75, 4, -80, -10).d, arc(14.25, 9.75, 7.25, -82, -8).d],
  },

  // ── People: Núcleo's person ──
  'person-plus': {
    tags: ['agregar persona', 'invitar', 'nuevo usuario', 'add user', 'invite'],
    d: PERSON_L,
    badge: badge('plus'),
  },
  'person-minus': {
    tags: ['quitar persona', 'eliminar usuario', 'sacar', 'remove user'],
    d: PERSON_L,
    badge: badge('minus'),
  },
  'person-check': {
    tags: ['verificado', 'aprobado', 'usuario activo', 'verified user', 'approved'],
    d: PERSON_L,
    badge: badge('check'),
  },
  'person-x': {
    tags: ['rechazar', 'denegar acceso', 'usuario', 'deny user', 'reject'],
    d: PERSON_L,
    badge: badge('x'),
  },
  'person-block': {
    tags: ['bloquear', 'vetar', 'usuario bloqueado', 'block user', 'ban'],
    d: PERSON_L,
    badge: badge('block'),
  },
  'person-clock': {
    tags: ['invitación pendiente', 'en espera', 'usuario', 'pending user'],
    d: PERSON_L,
    badge: badge('clock'),
  },
  'person-heart': {
    tags: ['contacto favorito', 'seguir', 'cliente frecuente', 'favorite', 'follow'],
    d: PERSON_L,
    badge: badge('heart'),
  },
  'person-edit': {
    tags: ['editar perfil', 'cuenta', 'datos personales', 'edit profile', 'account'],
    d: PERSON_L,
    badge: badge('edit'),
  },
  'person-search': {
    tags: ['buscar persona', 'directorio', 'encontrar usuario', 'find user'],
    d: PERSON_L,
    badge: badge('search'),
  },
  'person-arrow': {
    tags: ['asignar', 'transferir', 'delegar', 'assign', 'transfer'],
    d: PERSON_L,
    badge: arrowOver([14, 18], [21.5, 18]),
  },
  'person-speaking': {
    tags: ['hablando', 'presentador', 'voz', 'speaker', 'talking'],
    d: [...PERSON.map((d) => xf(d, { dx: -2.75 })), arc(9.25, 7.6, 6.75, -38, 38).d, arc(9.25, 7.6, 10, -33, 33).d],
  },
  'person-circle': {
    tags: ['perfil', 'avatar', 'cuenta', 'profile', 'account'],
    d: [circ(12, 12, 9), circ(12, 9.5, 3.25), arc(12, 21.25, 6.25, 202.17, 337.83).d],
  },
  'people': {
    tags: ['grupo', 'equipo', 'comunidad', 'team', 'group'],
    // The two people in back whole; the one in front sits on top and the engine clears them
    d: [-5.4, 5.4].flatMap((dx) => personAt(0.66, dx, -1.75)),
    badge: front(personAt(0.84)),
  },
  'id-card': {
    tags: ['identificación', 'tarjeta de contacto', 'credencial', 'id card', 'vcard'],
    d: [sq(2.5, 5, 19, 14, 3.5, { square: ['br'] }), ...bust(8, 10.5, 2.25, 19, 3.75), line([14.75, 10.5], [18.25, 10.5]), line([14.75, 14], [17, 14])],
  },
  'id-badge': {
    tags: ['credencial', 'gafete', 'acceso', 'badge', 'employee'],
    d: [sq(4.75, 2.75, 14.5, 18.5, 3.5, { square: ['br'] }), line([10.25, 6.25], [13.75, 6.25]), ...bust(12, 11.75, 2.25, 21.25, 4)],
  },
  'contacts': {
    tags: ['contactos', 'agenda', 'libreta de direcciones', 'address book', 'contacts'],
    // The spine tabs cross the cover; the bust, shifted right, leaves them a 1.5 gap
    d: [sq(5.5, 2.75, 14, 18.5, 3.5, { square: ['br'] }), ...bust(13.25, 10.25, 2.5, 21.25, 4.5), ...[6.5, 11.25, 16].map((y) => line([3.5, y], [7.25, y]))],
  },
  'handshake': {
    tags: ['apretón de manos', 'acuerdo', 'trato', 'handshake', 'deal'],
    // Two cuffs and the hands clasped between them, as a single shape: on top, one hand's knuckle
    // and the notch where the other's thumb rests; below, the wrapping fingers. The thumb and the
    // finger start from the outline (nothing floats)
    d: [
      rline(
        [
          [2.75, 7],
          [6.25, 7],
          [6.25, 16.5],
          [2.75, 16.5],
        ],
        [0, 1, 1, 0],
      ),
      rline(
        [
          [21.25, 7],
          [17.75, 7],
          [17.75, 16.5],
          [21.25, 16.5],
        ],
        [0, 1, 1, 0],
      ),
      roundpoly(
        [
          [6.25, 9],
          [10, 7],
          [13, 9.5],
          [17.75, 9.5],
          [17.75, 14.5],
          [14, 17.75],
          [10.5, 17.75],
          [6.25, 14.5],
        ],
        [0, 2, 1, 0, 0, 2.5, 2.5, 0],
      ),
      line([13, 9.5], [10.25, 12.25]),
      line([11.75, 17.75], [14.75, 14.75]),
    ],
  },

  // ── Reactions ──
  'face-smile': {
    tags: ['sonrisa', 'feliz', 'emoji', 'smile', 'happy'],
    d: face(arc(12, 12, 4.25, 30, 150).d),
  },
  'face-laugh': {
    tags: ['risa', 'alegría', 'carcajada', 'laugh', 'joy'],
    d: [circ(12, 12, 9), arc(9, 10.25, 1.5, 180, 360).d, arc(15, 10.25, 1.5, 180, 360).d, `M7.75 13.25H16.25${arcTo(12, 13.25, 4.25, 0, 180)}`],
  },
  'face-wink': {
    tags: ['guiño', 'broma', 'complicidad', 'wink'],
    d: [circ(12, 12, 9), dot(9, 9.75), line([13.75, 9.75], [16.25, 9.75]), arc(12, 12, 4.25, 30, 150).d],
  },
  'face-neutral': {
    tags: ['neutral', 'indiferente', 'serio', 'neutral face', 'meh'],
    d: face(line([8.75, 15], [15.25, 15])),
  },
  'face-confused': {
    tags: ['confusión', 'duda', 'no entiendo', 'confused'],
    d: face(
      smooth([
        [8.25, 15.75],
        [10.25, 14.5],
        [12.25, 15.25],
        [14, 15.75],
        [15.75, 14.5],
      ]),
    ),
  },
  'face-surprised': {
    tags: ['sorpresa', 'asombro', 'wow', 'surprised'],
    d: face(circ(12, 15.25, 1.75)),
  },
  'face-sad': {
    tags: ['triste', 'molesto', 'insatisfecho', 'sad', 'unhappy'],
    d: face(arc(12, 19.25, 4.25, 215, 325).d),
  },
  'face-angry': {
    tags: ['enojo', 'molestia', 'furia', 'angry', 'mad'],
    d: [circ(12, 12, 9), line([7.75, 8.75], [10.25, 10]), line([16.25, 8.75], [13.75, 10]), arc(12, 19.25, 4.25, 215, 325).d],
  },
  'reaction-add': {
    tags: ['agregar reacción', 'emoji', 'reaccionar', 'add reaction'],
    // The face shifted up and to the left, with a smaller smile: 7.7 from the badge center it stays
    // whole, and in the fill its cut keeps a rim of ink from the badge's clearance even at 0.9, where
    // the cut is widest (at 7.3 the two met)
    d: [circ(9.75, 9.75, 7.5), dot(7.35, 7.95), dot(12.15, 7.95), arc(9.75, 10, 2.75, 35, 145).d],
    badge: badge('plus'),
  },
  'thumbs-up': {
    tags: ['me gusta', 'aprobar', 'de acuerdo', 'like', 'thumbs up'],
    d: THUMB,
  },
  'thumbs-down': {
    tags: ['no me gusta', 'rechazar', 'desacuerdo', 'dislike', 'thumbs down'],
    d: THUMB.map((d) => xf(d, { flipY: true })),
  },
  'hand-raised': {
    tags: ['levantar la mano', 'pedir la palabra', 'turno', 'raise hand'],
    d: raisedHand(),
  },
  'party-popper': {
    tags: ['celebrar', 'festejo', 'felicidades', 'celebrate', 'party'],
    d: [
      roundpoly(
        [
          [3.5, 20.5],
          [7.25, 9.5],
          [14.5, 16.75],
        ],
        [1, 1.25, 1.25],
      ),
      // The streamers start with a 1.5 gap from the cone's mouth
      smooth([
        [11, 8.75],
        [11, 6.25],
        [13.5, 4.75],
      ]),
      smooth([
        [15.25, 13],
        [17.75, 13],
        [19.25, 10.5],
      ]),
      dot(17.25, 3.5),
      dot(20.25, 7),
      dot(15.5, 8.5),
    ],
  },
  'sticker': {
    tags: ['sticker', 'calcomanía', 'emoji', 'pegatina'],
    d: [
      clip(sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), (p) => !(p[0] > 14.3 && p[1] > 14.3)),
      line([20.75, 14.25], [14.25, 20.75]),
      rline(
        [
          [20.75, 14.25],
          [14.25, 14.25],
          [14.25, 20.75],
        ],
        [0, 2.75, 0],
      ),
      dot(9.5, 9.5),
      dot(14.5, 9.5),
    ],
  },

  // ── Language ──
  'translate': {
    tags: ['traducir', 'idioma', 'traducción', 'translate', 'language'],
    // 文 at the top and, over it, the mirrored drop with the A: the other language replies
    d: wen(7.25, 7),
    badge: (() => {
      const bubble = dropL(15.25, 15, 6.25);
      const a = letterA(14.75, 11.75, 5.75);
      return own([bubble, ...a], bubble, { solid: [bubble], cut: a });
    })(),
  },

  // ── Coverage (round 2): what was missing in mail, broadcast and celebrations ──
  // Junk or problem mail: Núcleo's envelope and the engine's alert badge.
  'mail-alert': {
    tags: ['correo no deseado', 'spam', 'reportar correo', 'correo sospechoso', 'mail alert', 'junk', 'report spam'],
    d: MAIL_B,
    badge: badge('alert'),
  },
  // Feed subscription (RSS): the source dot and two arcs that open out from it, with the spacing
  // of the `broadcast` waves.
  'rss': {
    tags: ['rss', 'fuente', 'suscribirse', 'feed', 'noticias', 'subscribe', 'news feed'],
    d: [dot(6.5, 17.5), arc(6.5, 17.5, 6, 270, 360).d, arc(6.5, 17.5, 11.5, 270, 360).d],
  },
  // Cake (birthday, anniversary): the body, the frosting dripping in three waves, and three
  // candles with their flame 3 from the wick.
  'cake': {
    tags: ['pastel', 'cumpleaños', 'aniversario', 'celebración', 'cake', 'birthday', 'anniversary'],
    d: [
      sq(3.75, 11, 16.5, 9.5, 2.5),
      `M3.75 14${[9.25, 14.75, 20.25].map((x) => `A3.27 3.27 0 0 0 ${x} 14`).join('')}`,
      ...[8, 12, 16].flatMap((x) => [line([x, 8], [x, 11]), dot(x, 4.25)]),
    ],
  },
};

// ── Round 4: messaging ─────────────────────────────────────────────────────────────────────
/**
 * Read: Núcleo's check and a second one 4.25 to its right (their long arms 3 apart), whose short arm
 * starts on the first one's long arm.
 */
function doubleCheck(cx, cy, w, dx) {
  const at = (ox) => [
    [ox - 0.5 * w, cy + 0.036 * w],
    [ox - 0.183 * w, cy + 0.357 * w],
    [ox + 0.5 * w, cy - 0.357 * w],
  ];
  const [a1, b1, c1] = at(cx);
  const [a2, b2, c2] = at(cx + dx);
  const u = [b2[0] - a2[0], b2[1] - a2[1]];
  const v = [c1[0] - b1[0], c1[1] - b1[1]];
  const t = ((b1[0] - a2[0]) * v[1] - (b1[1] - a2[1]) * v[0]) / (u[0] * v[1] - u[1] * v[0]);
  return [line(a1, b1, c1), line([a2[0] + t * u[0], a2[1] + t * u[1]], b2, c2)];
}
/**
 * The drop's outline as n even dashes, 3 apart center to center (1.5 of paper), one of them bent
 * around the signature corner: one path, so it draws itself as one.
 */
function dashedDrop(cx, cy, r, n) {
  const round = 1.5 * Math.PI * r;
  const total = 2 * r + round;
  const len = total / n - 3;
  // From the corner along the bottom, around the circle clockwise, and down the right side
  const at = (s) => {
    if (s <= r) return [cx + r - s, cy + r];
    if (s <= r + round) return polar(cx, cy, r, 90 + (((s - r) / r) * 180) / Math.PI);
    return [cx + r, cy + (s - r - round)];
  };
  const breaks = [r, r + round, total];
  let d = '';
  for (let k = 0; k < n; k++) {
    let s = (k * total) / n - len / 2;
    const end = s + len;
    if (s < 0) s += total;
    let stop = end < 0 ? end + total : end;
    if (stop < s) stop += total;
    d += `M${P(at(s % total))}`;
    while (s < stop - 1e-9) {
      const b = Math.min(stop, ...breaks.map((x) => (x > s + 1e-9 ? x : x + total)).filter((x) => x > s + 1e-9));
      const q = at(b % total || (b > 0 ? total : 0));
      const inRound = s % total >= r - 1e-9 && s % total < r + round - 1e-9;
      d += inRound ? `A${f(r)} ${f(r)} 0 0 1 ${P(q)}` : `L${P(q)}`;
      s = b;
    }
  }
  return d;
}
/**
 * A cloud of scallops: the outer arcs of circles given clockwise, each running between the points
 * where it meets its neighbors.
 */
function scallops(cs) {
  const c = [cs.reduce((n, q) => n + q[0], 0) / cs.length, cs.reduce((n, q) => n + q[1], 0) / cs.length];
  const meet = ([x0, y0, r0], [x1, y1, r1]) => {
    const dd = Math.hypot(x1 - x0, y1 - y0);
    const a = (dd * dd + r0 * r0 - r1 * r1) / (2 * dd);
    const h = Math.sqrt(r0 * r0 - a * a);
    const m = [x0 + ((x1 - x0) * a) / dd, y0 + ((y1 - y0) * a) / dd];
    const ps = [
      [m[0] + ((y1 - y0) * h) / dd, m[1] - ((x1 - x0) * h) / dd],
      [m[0] - ((y1 - y0) * h) / dd, m[1] + ((x1 - x0) * h) / dd],
    ];
    return ps.sort((p, q) => Math.hypot(q[0] - c[0], q[1] - c[1]) - Math.hypot(p[0] - c[0], p[1] - c[1]))[0];
  };
  const pts = cs.map((q, i) => meet(cs[(i - 1 + cs.length) % cs.length], q));
  let d = `M${P(pts[0])}`;
  cs.forEach(([x, y, r], i) => {
    const [p, q] = [pts[i], pts[(i + 1) % cs.length]];
    const span = ((((Math.atan2(q[1] - y, q[0] - x) - Math.atan2(p[1] - y, p[0] - x)) * 180) / Math.PI) % 360 + 360) % 360;
    d += `A${f(r)} ${f(r)} 0 ${span > 180 ? 1 : 0} 1 ${P(q)}`;
  });
  return `${d}Z`;
}
Object.assign(icons, {
  'message-forward': {
    tags: ['reenviar mensaje', 'compartir', 'reenviar', 'forward message', 'share message'],
    // message-reply's turn arrow mirrored: it turns right
    d: [DROP, ...icons['message-reply'].d.slice(1).map((d) => flipPath(d))],
  },
  'message-quote': {
    tags: ['citar', 'responder citando', 'cita', 'quote', 'quote reply'],
    // The quoted block as chat apps draw it: a bar and the lines beside it
    d: [DROP, line([8.25, 8.5], [8.25, 15]), line([11.25, 10], [15.75, 10]), line([11.25, 13.5], [14, 13.5])],
  },
  'message-pin': {
    tags: ['mensaje fijado', 'fijar', 'anclar', 'pinned message', 'pin'],
    // Núcleo's pushpin at 60 %, upright inside the bubble
    d: [DROP, ...N.pin.d.map((d) => place(d, 0.6, [12, 12]))],
  },
  'message-edit': {
    tags: ['editar mensaje', 'editado', 'corregir', 'edit message', 'edited'],
    // The engine's pencil (the edit badge's, 3 wide) across the bubble
    d: [DROP, ...pencil([8.3, 15.7], 9)],
  },
  'message-info': {
    tags: ['detalles del mensaje', 'información', 'entregado', 'message info', 'details'],
    // message-alert's mark turned over: the dot above, the bar below
    d: [DROP, dot(12, 7.2), line([12, 10.9], [12, 16.1])],
  },
  'message-read': {
    tags: ['leído', 'visto', 'confirmación de lectura', 'read receipt', 'seen'],
    d: [DROP, ...doubleCheck(12 - 4.25 / 2, 12, 6.5, 4.25)],
  },
  'message-person': {
    tags: ['mensaje directo', 'chat privado', 'conversación', 'direct message', 'dm'],
    d: [DROP, ...dropBust(12, 9.35, 2.75, 21.25, 6)],
  },
  'message-people': {
    tags: ['chat grupal', 'grupo', 'conversación de grupo', 'group chat', 'group'],
    // conference-call's pair with a bubble in front of it instead of the handset: the group and its
    // conversation (two busts inside the bubble read as a face). The bubble hides the shoulders of the
    // one behind: what was left of them peeked out beside it at bold
    d: pair(0.72, [-4.5, -2.5], [2.75, -5], 0.6).filter((_, i) => i !== 1),
    badge: front([drop(16.75, 16.5, 4.75)]),
  },
  'message-link': {
    tags: ['enlace al mensaje', 'copiar enlace', 'vínculo', 'message link', 'copy link'],
    d: [DROP, ...LINK_IN],
  },
  'message-bolt': {
    tags: ['respuestas rápidas', 'plantillas', 'respuesta guardada', 'quick replies', 'canned responses'],
    // Núcleo's bolt at 70 %
    d: [DROP, place(N.bolt.d[0], 0.7, [12, 12])],
  },
  'message-disappearing': {
    tags: ['mensajes temporales', 'autodestrucción', 'efímero', 'disappearing messages', 'ephemeral'],
    d: [dashedDrop(12, 11.75, 8.75, 10)],
  },
  'message-image': {
    tags: ['foto', 'mensaje con imagen', 'mms', 'photo message', 'image'],
    // The landscape fills the bubble: the mountains run from edge to edge, the sun above them
    d: [
      DROP,
      dot(9.25, 7.75),
      rline(
        [
          [4.32, 15.94],
          [8, 12.25],
          [11, 15.25],
          [15.5, 10.75],
          [20.75, 16],
        ],
        [0, 1, 1, 1, 0],
      ),
    ],
  },
  'message-history': {
    tags: ['historial del chat', 'conservar mensajes', 'retención', 'chat history', 'retention'],
    // The bubble is the history arrow: the drop runs back around from navegacion's history gap (220° to
    // 295°) through its square corner, with history's head (3.4) at its end, and message-clock's hands
    d: (() => {
      const [cx, cy, r] = [12, 11.75, 8.75];
      const back = arc(cx, cy, r, 360, 295);
      return [
        `${arc(cx, cy, r, 220, 90).d}L${P([cx + r, cy + r])}L${P([cx + r, cy])}${arcTo(cx, cy, r, 360, 295)}`,
        head(back.end, back.tangent, 3.4),
        line([12, 7.5], [12, 12.25], [15.25, 14.25]),
      ];
    })(),
  },
  'message-attachment': {
    tags: ['adjunto', 'archivo en el chat', 'clip', 'attachment', 'attach file'],
    d: [DROP, CLIP_IN],
  },
  'message-location': {
    tags: ['compartir ubicación', 'ubicación', 'dónde estoy', 'share location', 'location'],
    d: [DROP, ...MAP_PIN_IN],
  },
  'thought-bubble': {
    tags: ['pensamiento', 'pensando', 'idea', 'thought', 'thinking'],
    // Four scallops and the two circles trailing from it (not the drop: a thought isn't said), the
    // last one a dot inside the live area
    d: [
      scallops([
        [10.25, 9.25, 3.75],
        [14.5, 6.25, 3.75],
        [18.25, 9.25, 3],
        [14.5, 11, 3.25],
      ]),
      circ(7.25, 16.5, 1.5),
      dot(3.75, 20),
    ],
  },
  'text-message': {
    tags: ['sms', 'mensaje de texto', 'celular', 'text message', 'texting'],
    // dispositivos' smartphone at the left and the drop over its corner (its clearance stops short of
    // the speaker at every weight)
    d: dispositivos.icons.smartphone.d.map((d) => transform(d, 1, -3.5, 0)),
    badge: front([drop(17.25, 8.75, 4.5)]),
  },
  'hashtag-lock': {
    tags: ['canal privado', 'privado', 'canal cerrado', 'private channel', 'locked'],
    d: icons.hashtag.d,
    badge: badge('lock'),
  },
  'hashtag-plus': {
    tags: ['crear canal', 'nuevo canal', 'canal', 'create channel', 'new channel'],
    d: icons.hashtag.d,
    badge: badge('plus'),
  },
});

// ── Round 4: mail ──────────────────────────────────────────────────────────────────────────
/** message-reply's turn arrow on the badge's center (and mirrored, to forward). */
const REPLY_B = (() => {
  const d = icons['message-reply'].d.slice(1).map((p) => transform(p, 1, BC[0] - 11.875, BC[1] - 12.75));
  return glyph(d, knockOf(...d));
})();
const FORWARD_B = (() => {
  const d = REPLY_B.d.map((p) => flipPath(p, 'x', BC[0]));
  return glyph(d, knockOf(...d));
})();
/** navegacion's funnel for the corner: its cone and a stem 3 wide (at half size the stem closed). */
const FUNNEL_B = (() => {
  const d = roundpoly(
    [
      [13, 13],
      [21.5, 13],
      [18.75, 16.75],
      [18.75, 21],
      [15.75, 21],
      [15.75, 16.75],
    ],
    [1, 1, 0.6, 0.6, 0.6, 0.6],
  );
  return glyph([d], d, { solid: [d] });
})();
/**
 * Two people for the corner, drawn as Núcleo's clients and calendario's calendar-people draw them:
 * the one in front a whole bust, and of the one behind, to its right, only the far side of its head
 * (the arc that stays 3.1 clear of the front head) and its far shoulder. The person behind cut out
 * by the front one left loose hooks that read as an S at 18 px. Both clear the base, the hidden part
 * of the one behind included (no bit of the base shows through it); filled, the one in front is
 * solid and the one behind stays lines.
 */
const PAIR_B = (() => {
  const [sh, r, fx, bx, base] = [2.75, 1.6, 15.5, 19.25, 21.25];
  const y = base - sh - 2.45 - r;
  const reach = r + 3.1;
  const lim = (Math.acos((reach * reach - (bx - fx) ** 2 - r * r) / (2 * (bx - fx) * r)) * 180) / Math.PI;
  const head = circ(fx, y, r);
  const shoulders = arc(fx, base, sh, 180, 360).d;
  const back = [arc(bx, y, r, -lim, lim).d, arc(bx, base, sh, 312, 360).d];
  const hidden = [circ(bx, y, r), shut(arc(bx, base, sh, 180, 360).d)];
  return { d: [head, shoulders, ...back], knock: [head, shut(shoulders), ...hidden].join(''), fill: { solid: [head, shut(shoulders)], wire: back } };
})();

Object.assign(icons, {
  'mail-reply': {
    tags: ['responder correo', 'contestar', 'respuesta', 'reply email', 'reply'],
    d: MAIL_B,
    badge: REPLY_B,
  },
  'mail-forward': {
    tags: ['reenviar correo', 'reenviar', 'compartir correo', 'forward email', 'forward'],
    d: MAIL_B,
    badge: FORWARD_B,
  },
  'mail-filter': {
    tags: ['filtrar correo', 'no leídos', 'filtro', 'filter mail', 'unread'],
    d: MAIL_B,
    badge: FUNNEL_B,
  },
  'mail-rule': {
    tags: ['reglas de correo', 'clasificar', 'automatizar', 'mail rules', 'routing'],
    // A smaller envelope (its flap 3.1 inside the corners, so it keeps its clearance) and the arrow
    // that leaves its side and forks: where the mail goes
    d: [
      sq(2.5, 7.5, 12, 9, 2.75, { square: ['br'] }),
      rline(
        [
          [5.6, 10.6],
          [8.5, 12.63],
          [11.4, 10.6],
        ],
        [0, 1.2, 0],
      ),
      line([14.5, 12], [16.5, 12], [21, 7.5]),
      line([16.5, 12], [21, 16.5]),
      head([21, 7.5], [1, -1], 2.75),
      head([21, 16.5], [1, 1], 2.75),
    ],
  },
  'mail-incoming': {
    tags: ['correo entrante', 'recibido', 'llega correo', 'incoming mail', 'received'],
    // phone-incoming's arrow (pointing down and to the left, its head 4) over the corner of the envelope
    // at 78 %, which sits at the bottom left. Across the envelope, the arrow tangled with the flap
    d: [...[MAIL, FLAP].map((d) => place(d, 0.78, [2.5, 19], [2.5, 21])), line([21.5, 2.75], [16.75, 7.5]), head([16.75, 7.5], [-1, 1], 4)],
  },
  'mail-fast': {
    tags: ['correo urgente', 'exprés', 'prioridad', 'express mail', 'priority'],
    // The envelope at 71 % (its flap keeps its clearance), against the right, and truck-fast's speed
    // lines (3 apart, ending 2.9 from it)
    d: [...[MAIL, FLAP].map((d) => place(d, 0.71, [21.5, 12])), line([1.95, 9], [5.1, 9]), line([2.45, 12], [5.1, 12]), line([2.95, 15], [5.1, 15])],
  },
  'mail-lock': {
    tags: ['correo cifrado', 'confidencial', 'privado', 'encrypted email', 'confidential'],
    d: MAIL_B,
    badge: badge('lock'),
  },
  'mail-block': {
    tags: ['bloquear remitente', 'bloqueado', 'spam', 'block sender', 'blocked'],
    d: MAIL_B,
    badge: badge('block'),
  },
  'mail-star': {
    tags: ['correo destacado', 'importante', 'seguimiento', 'starred email', 'flagged'],
    d: MAIL_B,
    badge: badge('star'),
  },
  'mail-sync': {
    tags: ['sincronizar correo', 'conectar cuenta', 'actualizar bandeja', 'sync mail', 'fetch mail'],
    d: MAIL_B,
    badge: badge('sync'),
  },
  'mailing-list': {
    tags: ['lista de correo', 'lista de distribución', 'grupo de correo', 'mailing list', 'distribution list'],
    d: MAIL_B,
    badge: PAIR_B,
  },
  'mail-pin': {
    tags: ['correo fijado', 'fijar', 'anclar', 'pinned email', 'pin'],
    d: MAIL_B,
    badge: PIN_B,
  },
  'mail-link': {
    tags: ['enlace por correo', 'enlace mágico', 'compartir por correo', 'magic link', 'email link'],
    d: MAIL_B,
    badge: LINK_B,
  },
  'mail-postal': {
    tags: ['correo postal', 'carta', 'remitente', 'postal mail', 'letter'],
    // The address side: no flap, the stamp and two address lines
    d: [MAIL, sq(15, 8, 3.5, 3.5, 0.9), line([6.75, 13], [12.25, 13]), line([6.75, 16], [15.25, 16])],
  },
  'letter-sealed': {
    tags: ['carta sellada', 'sello de cera', 'invitación', 'sealed letter', 'wax seal'],
    // The back of the envelope: the flap runs from corner to corner down to the middle, the wax seal
    // on its point (Núcleo's short flap left two dashes beside the seal)
    d: [
      MAIL,
      clip(
        rline(
          [
            [0.5, 3.6],
            [12, 13],
            [23.5, 3.6],
          ],
          [0, 1.5, 0],
        ),
        (p) => inPoly(samples(MAIL)[0], p),
      ),
    ],
    badge: front([circ(12, 13, 2.75)]),
  },
  'inbox-arrow-down': {
    tags: ['mover a la bandeja', 'desarchivar', 'recibir', 'move to inbox', 'unarchive'],
    // The arrow over the notch, which sits 1 left of the tray's middle in Núcleo's inbox
    d: [...N.inbox.d, line([11, 6.75], [11, 12.5]), head([11, 12.5], [0, 1], 3.5)],
  },
  'outbox': {
    tags: ['bandeja de salida', 'por enviar', 'pendiente de envío', 'outbox', 'sending'],
    d: [...N.inbox.d, line([11, 12.5], [11, 6.75]), head([11, 6.75], [0, -1], 3.5)],
  },
  'inbox-full': {
    tags: ['bandeja llena', 'correo pendiente', 'documentos', 'full inbox', 'pending'],
    // Two sheets resting in the tray, seen by their top edges above its rim (drawn whole, the sheets
    // tangled with the notch)
    d: [...N.inbox.d, line([7, 7], [16, 7]), line([7, 10.25], [16, 10.25])],
  },
  'inbox-check': {
    tags: ['bandeja vacía', 'todo al día', 'inbox cero', 'inbox zero', 'all done'],
    d: N.inbox.d,
    badge: badge('check'),
  },
});

// ── Round 4: post ──────────────────────────────────────────────────────────────────────────
/**
 * A stamp's perforated edge: the rectangle (x, y, w, h) with n × m bites of radius rb along its sides,
 * evenly spaced, the corners left as teeth.
 */
function perforated(x, y, w, h, n, m, rb) {
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  let d = `M${P(corners[0])}`;
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4];
    const k = i % 2 ? m : n;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    for (let j = 0; j < k; j++) {
      const t = (len * (j + 0.5)) / k;
      d += `L${P([a[0] + u[0] * (t - rb), a[1] + u[1] * (t - rb)])}A${f(rb)} ${f(rb)} 0 0 0 ${P([a[0] + u[0] * (t + rb), a[1] + u[1] * (t + rb)])}`;
    }
    d += i === 3 ? 'Z' : `L${P(b)}`;
  });
  return d;
}
/** A wave along y from x0 to x1: half-waves of `half` (cubic halves of a sine), amplitude `amp`, starting upward. */
function wave(x0, x1, y, half, amp) {
  let d = `M${P([x0, y])}`;
  let s = -1;
  for (let x = x0; x < x1 - 1e-6; x += half) {
    const e = Math.min(x + half, x1);
    const k = (e - x) / half;
    d += `C${P([x + 0.36 * half * k, y + s * amp * 1.3 * k])} ${P([e - 0.36 * half * k, y + s * amp * 1.3 * k])} ${P([e, y])}`;
    s = -s;
  }
  return d;
}
/** A tilted envelope (center c, w × h, `deg`), cut off along y = cut: what shows above a slot. */
function envelopeIn(c, w, h, deg, cut) {
  const R = (p) => rot([c[0] + p[0], c[1] + p[1]], c, deg);
  const [tl, tr, br, bl] = [R([-w / 2, -h / 2]), R([w / 2, -h / 2]), R([w / 2, h / 2]), R([-w / 2, h / 2])];
  const at = (a, b) => {
    const t = (cut - a[1]) / (b[1] - a[1]);
    return [a[0] + (b[0] - a[0]) * t, cut];
  };
  const body = roundpoly([tl, tr, at(tr, br), at(tl, bl)], [1.5, 1.5, 0, 0]);
  const fl = rline([R([-w * 0.284, -h / 2 + 0.3 * h]), R([0, -h / 2 + 0.3 * h + 0.7 * 0.284 * w]), R([w * 0.284, -h / 2 + 0.3 * h])], [0, 1.2, 0]);
  return [body, fl];
}

Object.assign(icons, {
  'postcard': {
    tags: ['postal', 'tarjeta postal', 'saludos', 'postcard', 'greetings'],
    // The back: the rule between the message and the address side, the stamp and the address
    d: [sq(2.5, 4.5, 19, 15, 3.5, { square: ['br'] }), line([11, 7.5], [11, 16.5]), sq(15.5, 7.5, 3, 3, 0.75), line([14, 13.5], [18.5, 13.5]), line([14, 16.5], [18.5, 16.5])],
  },
  'postage-stamp': {
    tags: ['estampilla', 'timbre postal', 'sello', 'postage stamp', 'stamp'],
    // The inner frame kept small: at 6.5 × 10.5 the stamp ran too dense
    d: [perforated(4.75, 2.75, 14.5, 18.5, 4, 5, 1), sq(9.25, 7.5, 5.5, 9, 1.5, { square: ['br'] })],
  },
  'postmark': {
    tags: ['matasellos', 'sello de correos', 'fecha de envío', 'postmark', 'cancellation'],
    // The round date stamp and the three waves that cancel the stamp, running out of it
    d: (() => {
      const ring = circ(8, 12, 5.25);
      const out = (p) => Math.hypot(p[0] - 8, p[1] - 12) >= 5.25;
      return [ring, circ(8, 12, 2.25), ...[8.5, 12, 15.5].map((y) => clip(wave(8, 21.5, y, 3.375, 0.85), out))];
    })(),
  },
  'postbox': {
    tags: ['buzón de correos', 'buzón público', 'enviar carta', 'postbox', 'pillar box'],
    // A pillar box: the dome over its rim, the slot under it and the collection door
    d: ['M17.5 8.25V21.25H8A1.5 1.5 0 0 1 6.5 19.75V8.25A5.5 5.5 0 0 1 17.5 8.25Z', line([6.5, 8.25], [17.5, 8.25]), line([9.5, 11.25], [14.5, 11.25]), sq(9.5, 14.25, 5, 4, 1)],
  },
  'mailbox-open': {
    tags: ['llegó correo', 'buzón abierto', 'carta recibida', 'mail arrived', 'open mailbox'],
    // mailbox at 80 % against the right (its flag kept at full size, its post under the middle, clear of
    // the letter) and an envelope coming out of its open front, in front of it: the engine clears the
    // body. A bare strip of letter sticking out of the body read as a nozzle
    d: (() => {
      const [body, , , , flag] = icons.mailbox.d;
      // The pole rises from where the body's rounded top meets its flat run, as mailbox's does
      return [place(body, 0.8, [21.25, 17.5]), line([14.5, 17.5], [14.5, 21.25]), line([17.45, 9.9], [17.45, 2.75]), transform(flag, 1, 0.95, 0)];
    })(),
    badge: (() => {
      const R = (d) => turnPath(d, -12, [6.25, 13.5]);
      const env = R(sq(2.25, 10.63, 8, 5.75, 1.5, { square: ['br'] }));
      const fl = R(flap(2.25, 10.63, 8, 5.75));
      return own([env, fl], env, { solid: [env], cut: [fl] });
    })(),
  },
  'mailbox-wall': {
    tags: ['buzón de pared', 'buzón de casa', 'correspondencia', 'letterbox', 'wall mailbox'],
    // The lid hinged along the top edge, the slot under it, and the lock
    d: [sq(4.75, 2.75, 14.5, 18.5, 3.5, { square: ['br'] }), line([4.75, 7.25], [19.25, 7.25]), line([8.25, 10.25], [15.75, 10.25]), dot(12, 16.75)],
  },
  'mail-slot': {
    tags: ['ranura de correo', 'buzón de puerta', 'entrega', 'letter slot', 'mail slot'],
    // The door's plate and the letter half through it, tilted: it sits on top and the engine clears the
    // plate around it (a slot line beside it left fragments a pixel long)
    d: [sq(2.5, 13, 19, 7.25, 2.25, { square: ['br'] })],
    badge: (() => {
      const [body, fl] = envelopeIn([12, 12.75], 10.5, 8, -10, 16);
      return own([body, fl], body, { solid: [body], cut: [fl] });
    })(),
  },
  'mailbag': {
    tags: ['bolsa de correo', 'cartero', 'reparto', 'mailbag', 'mail carrier'],
    // The carrier's satchel is the envelope itself (Núcleo's, at 85 %, its flap the bag's), hung from a
    // shoulder strap that arches over it and ends on its outline. A satchel with a letter in its mouth
    // read as mail-slot's envelope over a tray
    d: (() => {
      const [env, fl] = [MAIL, FLAP].map((d) => place(d, 0.85, [12, 19], [12, 21.25]));
      // Wide and low, from corner to corner (a narrow round arch read as a padlock's shackle)
      const strap = clip('M4.75 12C4.75 2.75 19.25 2.75 19.25 12', (p) => !inPoly(samples(env)[0], p));
      return [env, fl, strap];
    })(),
  },
  'mailboxes': {
    tags: ['buzones', 'apartado postal', 'casilleros', 'mailboxes', 'po box'],
    d: [sq(2.5, 5, 19, 14, 3.5, { square: ['br'] }), line([12, 5], [12, 19]), line([2.5, 12], [21.5, 12]), ...[8.5, 15.5].flatMap((y) => [line([6, y], [8.5, y]), line([15.5, y], [18, y])])],
  },
});

// ── Round 4: calls ─────────────────────────────────────────────────────────────────────────
// The handset whole, as in the rest of the phone family, and its mark in the corner it leaves free
// at the top right (3 from it at least); the round marks share one ring, r 3.75 at (17.75, 6.25).
const MARK = [17.75, 6.25];
const MARK_RING = circ(...MARK, 3.75);
/**
 * Núcleo's handset at 62 %, in front at the bottom right: the engine clears what's behind it. Its grip
 * is 3.85 across at full size: smaller (at half size), it clogged up at bold.
 */
const HANDSET_B = front([place(PHONE, 0.62, [12.41, 11.57], [16.5, 16.5])]);
/** video-call's camera at 85 %, against the bottom left, so an arrow fits above its lens. */
const CAMERA_S = [VIDEO, LENS, ...CALLER].map((d) => place(d, 0.85, [2.5, 18], [2.5, 20.75]));

Object.assign(icons, {
  'phone-merge': {
    tags: ['unir llamadas', 'conferencia', 'fusionar', 'merge calls', 'conference'],
    // navegacion's arrows-merge, small: the two branches meet at 45° and leave as one (its head 3 clear of them)
    d: [PHONE, line([14.5, 10], [17.75, 6.75], [21, 10]), line([17.75, 6.75], [17.75, 2.5]), head([17.75, 2.5], [0, -1], 2.75)],
  },
  'phone-record': {
    tags: ['grabar llamada', 'grabación', 'registro', 'call recording', 'record'],
    d: [PHONE, MARK_RING, dot(...MARK)],
  },
  'phone-list': {
    tags: ['registro de llamadas', 'recientes', 'historial', 'call log', 'recent calls'],
    d: [PHONE, ...[3.75, 6.75, 9.75].map((y) => line([14.75, y], [21, y]))],
  },
  'phone-wifi': {
    tags: ['llamadas por wifi', 'voip', 'llamada por internet', 'wifi calling', 'internet call'],
    // dispositivos' wifi: the dot and two arcs, 3 apart
    d: [PHONE, dot(17.75, 9.5), arc(17.75, 9.5, 3.75, 230, 310).d, arc(17.75, 9.5, 6.75, 230, 310).d],
  },
  'phone-callback': {
    tags: ['devolver llamada', 'llámame', 'rellamar', 'callback', 'call back'],
    // navegacion's undo, small: it leaves the handset and comes back to it
    d: [PHONE, ...navegacion.icons.undo.d.map((d) => place(d, 0.45, [12, 12], MARK))],
  },
  'phone-link': {
    tags: ['enlace de llamada', 'unirse por enlace', 'invitación', 'call link', 'join link'],
    // The link of mail-link and message-link
    d: [PHONE, ...LINK_B.d.map((d) => transform(d, 1, MARK[0] - BC[0], MARK[1] - BC[1]))],
  },
  'phone-globe': {
    tags: ['llamada internacional', 'roaming', 'larga distancia', 'international call', 'roaming'],
    // The handset at 64 %, bottom left, and Núcleo's globe at 70 % in the hollow it leaves at the top
    // right, 3.85 from it: the two stand apart, the globe whole. In front of the globe, the handset cut
    // its meridian into an A; a globe small enough for the handset's free corner (r 3.75) closed its
    // cells at bold
    d: [place(PHONE, 0.64, [12.41, 11.57], [7.5, 16.5]), ...N.globe.d.map((d) => place(d, 0.7, [12, 12], [15.5, 8.5]))],
  },
  'phone-block': {
    tags: ['bloquear número', 'llamada bloqueada', 'número bloqueado', 'block number', 'blocked caller'],
    // The block badge's sign: the ring crossed from edge to edge
    d: [PHONE, MARK_RING, line(polar(...MARK, 3.75, 225), polar(...MARK, 3.75, 45))],
  },
  'conference-call': {
    tags: ['llamada grupal', 'conferencia', 'llamada de varios', 'conference call', 'group call'],
    // caller-id's handset in front of the pair
    d: pair(0.72, [-4.5, -2.5], [2.75, -5], 0.6),
    badge: HANDSET_B,
  },
  'caller-id': {
    tags: ['identificador de llamadas', 'quién llama', 'contacto', 'caller id', 'contact call'],
    // Núcleo's person at 80 %, top left, and the handset in front of it
    d: personSmall(0.8, -3.75, -1.5),
    badge: HANDSET_B,
  },
  'video-call-incoming': {
    tags: ['videollamada entrante', 'recibir video', 'videollamada', 'incoming video call'],
    // phone-incoming's arrow over the camera's lens
    d: [...CAMERA_S, line([21.25, 2.75], [16, 8]), head([16, 8], [-1, 1], 4.5)],
  },
});

// ── Round 4: telephones, devices and contacts ──────────────────────────────────────────────
/** Núcleo's handset turned to lie flat, its cups down (phone-hangup's turn), or upright, its cups to the right. */
const HANDSET_FLAT = turnPath(PHONE, 135);
const HANDSET_UP = turnPath(PHONE, 45);
/** The handset upright at 62 % (at less, its grip clogs up at bold), centered on `at`. */
const handsetUp = (at) => place(HANDSET_UP, 0.62, [11.39, 12.11], at);
/** contacts at 85 %, top left, under a corner badge (as the envelope is under MAIL_B). */
const CONTACTS_B = () => icons.contacts.d.map((d) => place(d, 0.85, [3.5, 2.75]));

Object.assign(icons, {
  'rotary-phone': {
    tags: ['teléfono fijo', 'teléfono clásico', 'llámanos', 'rotary phone', 'landline', 'telephone'],
    // The handset lies on the cradle: the body's sides start at its cups; the dial and its hub
    d: [
      place(HANDSET_FLAT, 0.7, [11.89, 6.72], [12, 2.75]),
      rline(
        [
          [6.4, 9.3],
          [3.25, 21.25],
          [20.75, 21.25],
          [17.6, 9.3],
        ],
        [0, 2.25, 2.25, 0],
      ),
      circ(12, 14.5, 3.75),
      dot(12, 14.5),
    ],
  },
  'payphone': {
    tags: ['teléfono público', 'caseta', 'cabina telefónica', 'payphone', 'public phone'],
    // The handset hung on the left of the unit, the coin slot and the keypad (dense dots, as the
    // calendar's days): with the slot alone, the unit was a smartphone and its speaker
    d: [
      sq(10.5, 2.75, 9.25, 18.5, 3, { square: ['br'] }),
      handsetUp([4.75, 12]),
      line([13.5, 6.5], [16.75, 6.5]),
      ...[10.75, 14, 17.25].flatMap((y) => [13.25, 17].map((x) => dot(x, y, 0.3))),
    ],
  },
  'intercom': {
    tags: ['interfón', 'portero eléctrico', 'timbre', 'intercom', 'door phone', 'buzzer'],
    // The speaker grille and the call button
    d: [sq(4.75, 2.75, 14.5, 18.5, 3.5, { square: ['br'] }), ...[5.75, 8.75, 11.75].map((y) => line([9.5, y], [14.5, y])), circ(12, 16.5, 1.75)],
  },
  'fax': {
    tags: ['fax', 'facsímil', 'enviar fax', 'fax machine'],
    // The sheet comes out of the machine's top; the handset stands at its left
    d: [
      sq(10.75, 12.5, 10.5, 8.25, 2.5, { square: ['br'] }),
      rline(
        [
          [12.25, 12.5],
          [12.25, 2.75],
          [20.25, 2.75],
          [20.25, 12.5],
        ],
        [0, 1.25, 1.25, 0],
      ),
      line([15.25, 5.75], [17.25, 5.75]),
      line([15.25, 8.75], [17.25, 8.75]),
      handsetUp([5, 12]),
    ],
  },
  'pager': {
    tags: ['localizador', 'bíper', 'guardia', 'pager', 'beeper', 'on call'],
    // The screen across the top and one button under it
    d: [sq(2.5, 5, 19, 14, 3.5, { square: ['br'] }), sq(6, 8, 12, 3.5, 1), dot(12, 15.25)],
  },
  'contacts-plus': {
    tags: ['agregar contacto', 'nuevo contacto', 'agenda', 'add contact', 'new contact'],
    d: CONTACTS_B(),
    badge: badge('plus'),
  },
  'contacts-sync': {
    tags: ['sincronizar contactos', 'importar contactos', 'agenda', 'sync contacts', 'import contacts'],
    d: CONTACTS_B(),
    badge: badge('sync'),
  },
  'contacts-group': {
    tags: ['grupo de contactos', 'etiqueta', 'lista de contactos', 'contact group', 'label'],
    // The book with the pair from people in its corner, as mailing-list carries it; its own bust gives
    // way to them (the three of them crowded the book and merged at bold)
    d: CONTACTS_B().filter((_, i) => i === 0 || i > 2),
    badge: PAIR_B,
  },
  'business-card': {
    tags: ['tarjeta de presentación', 'datos de contacto', 'escanear tarjeta', 'business card', 'contact card'],
    // A logo and three lines: the company's card, not a person's
    d: [sq(2.5, 5, 19, 14, 3.5, { square: ['br'] }), sq(6, 9.75, 4.5, 4.5, 1.25), line([13.5, 9], [18.25, 9]), line([13.5, 12], [18.25, 12]), line([13.5, 15], [16.5, 15])],
  },
  'bell-gear': {
    tags: ['ajustes de notificaciones', 'preferencias de avisos', 'notificaciones', 'notification settings'],
    d: BELL_B,
    badge: badge('gear'),
  },
  'public-address': {
    tags: ['altavoz', 'megafonía', 'anuncios', 'public address', 'loudspeaker', 'announcement'],
    // A horn that flares from its driver, on its pole, and two waves out of its mouth
    d: [
      'M3.25 10.25A1 1 0 0 1 4.25 9.25H7C9.67 9.25 12.25 7.5 14.75 4.5V17.5C12.25 14.5 9.67 12.75 7 12.75H4.25A1 1 0 0 1 3.25 11.75Z',
      line([9, 13.07], [9, 21.25]),
      arc(14.75, 11, 3.75, -35, 35).d,
      arc(14.75, 11, 6.75, -35, 35).d,
    ],
  },
});

// ── Fill (DESIGN.md › Fill), by index into d ──
// `solid` is filled (and keeps its stroke); so is `closed`, but it's an open outline path that
// encloses a body (the clapper, the camera lens, the cuff) and is filled closed with Z, without
// changing the silhouette; `cut` is knocked out at stroke width; `lines` stays a line with a 1.5 gap
// around it, and `wire` stays a line flush with the body, with no gap (a pole, an antenna, a wick).
// Only closed shapes go in `solid`: an open path would fill as a wedge.
const all = (name) => icons[name].d.map((_, i) => i);
const rest = (name, from = 1) => icons[name].d.map((_, i) => i).slice(from);
const FILL = {
  'mail-open': { solid: [0], cut: [1] },
  'mail-signature': { solid: [0], cut: [1, 2] },
  'mail-letter': { solid: [0], cut: [1] },
  'mail-stack': { solid: [0] },
  'mail-attachment': { solid: [0], cut: [1] },
  // Mailbox: the flag is filled (it closes along its pole); the post and the pole stay attached
  // to the body as lines, and the door is knocked out
  mailbox: { solid: [0], closed: [4], wire: [2, 3], cut: [1] },
  'phone-hangup': { solid: [0] },
  // The two reels filled and the tape joining them, flush with them
  voicemail: { solid: [0, 1], wire: [2] },
  dialpad: { solid: all('dialpad') },
  // The camera lens closes along the edge of the body
  'video-call': { solid: [0], closed: [1], cut: [2, 3] },
  'video-call-off': { solid: [0], closed: [1] },
  'video-meeting': { solid: [0], lines: [1], cut: [2, 3] },
  'screen-share': { solid: [0], lines: [1], cut: [2, 3] },
  'screen-share-off': { solid: [0], lines: [1], cut: [2, 3] },
  microphone: { solid: [0], lines: [1, 2] },
  'microphone-off': { solid: [0], lines: [1, 2] },
  'walkie-talkie': { solid: [0], wire: [1], cut: [2, 3] },
  'bell-ringing': { solid: [0], closed: [1], lines: [2, 3] },
  'notification-badge': { solid: [0] },
  // The handle (a grip 3 wide) is filled, closed along the edge of the body
  megaphone: { solid: [0], closed: [1], lines: [2] },
  broadcast: { solid: [0], lines: [1, 2, 3, 4] },
  // Tower: the ball and the structure filled (the legs close across the base into a triangle);
  // the waves stay as lines with their gap
  'radio-tower': { solid: [0], closed: [1], lines: [2, 3, 4, 5] },
  // The dish and the receiver filled; the arm joining them stays a line
  'satellite-dish': { solid: [0, 2], wire: [1], lines: [3, 4] },
  'person-speaking': { solid: [0, 1], lines: [2, 3] },
  'person-circle': { solid: [0], cut: [1, 2] },
  people: { solid: [0, 1, 2, 3] },
  'id-card': { solid: [0], cut: [1, 2, 3, 4] },
  'id-badge': { solid: [0], cut: [1, 2, 3] },
  // The tabs stay attached to the cover (with a gap they read as loose dashes)
  contacts: { solid: [0], wire: [3, 4, 5], cut: [1, 2] },
  'face-laugh': { solid: [0], cut: [1, 2, 3] },
  'reaction-add': { solid: [0], cut: [1, 2, 3] },
  // The fist and the cuff filled (the cuff closes along the seam); the seam is knocked out so they
  // don't merge into one blob
  'thumbs-up': { solid: [0], closed: [1] },
  'thumbs-down': { solid: [0], closed: [1] },
  // The hand filled, with the lines between the fingers knocked out
  'hand-raised': { solid: [0], cut: [1, 2, 3] },
  'party-popper': { solid: [0, 3, 4, 5], lines: [1, 2] },
  // The sticker closes along the fold (its silhouette, as in the outline) and the peeled corner,
  // which sits on top of it, is separated by knocking out its L-shaped edge; the eyes are knocked
  // out too. Knocking out the fold erased the corner: the fill read as a square with a line through it
  sticker: { closed: [0], cut: [2, 3, 4] },
  // The cake and the flames filled; the candles, flush with the cake, stay as lines
  cake: { solid: [0, 3, 5, 7], wire: [2, 4, 6], cut: [1] },
};
// Bubbles with a mark inside: the drop filled and the mark knocked out
for (const name of Object.keys(icons).filter((n) => n.startsWith('message-') && !['message-unread', 'message-off'].includes(n))) FILL[name] = { solid: [0], cut: rest(name) };
for (const name of ['message-unread', 'message-off', 'messages']) FILL[name] = { solid: [0] };
// The envelope with its flap knocked out (under badges too)
for (const name of ['mail-unread', 'mail-plus', 'mail-minus', 'mail-check', 'mail-x', 'mail-clock', 'mail-send', 'mail-draft', 'mail-search', 'mail-alert']) FILL[name] = { solid: [0], cut: [1] };
// The phone filled; the arrows, marks and waves beside it stay as lines with their gap
for (const name of ['phone-incoming', 'phone-outgoing', 'phone-missed', 'phone-plus', 'phone-forward', 'phone-transfer', 'phone-hold', 'phone-ringing']) FILL[name] = { solid: [0], lines: rest(name) };
FILL['phone-off'] = { solid: [0] };
// The bell: the body and the clapper (a half-moon), closed as in Núcleo
for (const name of ['bell-dot', 'bell-plus', 'bell-check', 'bell-clock', 'bell-off']) FILL[name] = { solid: [0], closed: [1] };
// The person: head and body
for (const name of Object.keys(icons).filter((n) => n.startsWith('person-') && !['person-speaking', 'person-circle'].includes(n))) FILL[name] = { solid: [0, 1] };
// Faces: the circle filled and the features knocked out
for (const name of ['face-smile', 'face-wink', 'face-neutral', 'face-confused', 'face-surprised', 'face-sad', 'face-angry']) FILL[name] = { solid: [0], cut: rest(name) };
// Headset: the ear cups and the capsule filled; the headband and the mic boom flush with them
FILL.headset = { solid: [1, 2, 4], wire: [0, 3] };
// Round 4: the bases fill as their families do (the envelope, the tray, the phone, the bell, contacts)
for (const name of ['mail-reply', 'mail-forward', 'mail-filter', 'mail-lock', 'mail-block', 'mail-star', 'mail-sync', 'mailing-list', 'mail-pin', 'mail-link', 'letter-sealed'])
  FILL[name] = { solid: [0], cut: [1] };
for (const name of ['phone-merge', 'phone-record', 'phone-list', 'phone-wifi', 'phone-callback', 'phone-link', 'phone-block']) FILL[name] = { solid: [0], lines: rest(name) };
// The handset and the globe filled, the globe's equator and meridian knocked out as in Núcleo
FILL['phone-globe'] = { solid: [0, 1], cut: [2, 3] };
for (const name of ['contacts-plus', 'contacts-sync']) FILL[name] = FILL.contacts;
FILL['contacts-group'] = { solid: [0], wire: [1, 2, 3] };
// The dashes of a disappearing bubble and the history arrow are lines (filled further down)
delete FILL['message-disappearing'];
delete FILL['message-history'];
Object.assign(FILL, {
  'thought-bubble': { solid: [0, 1, 2] },
  'text-message': { solid: [0], cut: [1] },
  'mail-rule': { solid: [0], cut: [1], lines: rest('mail-rule', 2) },
  'mail-incoming': { solid: [0], cut: [1], lines: [2, 3] },
  // The people as conference-call's; the bubble in front brings its own fill
  'message-people': { solid: [1, 2], lines: [0] },
  'mail-fast': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'mail-postal': { solid: [0], cut: [1, 2, 3] },
  'inbox-arrow-down': { solid: [0], cut: [1, 2, 3] },
  outbox: { solid: [0], cut: [1, 2, 3] },
  'inbox-full': { solid: [0], cut: rest('inbox-full') },
  'inbox-check': { solid: [0], cut: [1] },
  postcard: { solid: [0], cut: [1, 2, 3, 4] },
  'postage-stamp': { solid: [0], cut: [1] },
  // The waves leave the date stamp's ring, flush with it
  postmark: { solid: [0], cut: [1], wire: [2, 3, 4] },
  postbox: { solid: [0], cut: [1, 2, 3] },
  'mailbox-wall': { solid: [0], cut: [1, 2, 3] },
  'mail-slot': { solid: [0] },
  mailboxes: { solid: [0], cut: rest('mailboxes') },
  // As mailbox: the flag filled (it closes along its pole), the post and the pole flush with the body;
  // the letter in front brings its own fill
  'mailbox-open': { solid: [0], closed: [3], wire: [1, 2] },
  // The strap flush with the satchel
  mailbag: { solid: [0], cut: [1], wire: [2] },
  // The person in front filled; the one behind, cut short of it, stays lines
  'conference-call': { solid: [2, 3], lines: [0, 1] },
  'caller-id': { solid: [0, 1] },
  'video-call-incoming': { solid: [0], closed: [1], cut: [2, 3], lines: [4, 5] },
  // The body closes under the handset along the cradle; the dial and its hub are knocked out
  'rotary-phone': { solid: [0], closed: [1], cut: [2, 3] },
  payphone: { solid: [0, 1], cut: rest('payphone', 2) },
  intercom: { solid: [0], cut: [1, 2, 3, 4] },
  // The sheet closes along the machine's top
  fax: { solid: [0, 4], closed: [1], cut: [2, 3] },
  pager: { solid: [0], cut: [1, 2] },
  'business-card': { solid: [0], cut: [1, 2, 3, 4] },
  'bell-gear': { solid: [0], closed: [1] },
  'public-address': { solid: [0], wire: [1], lines: [2, 3] },
});
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? `${d[i]}Z` : d[i]));
  const pick = (ix) => ix.map((i) => d[i]);
  icons[name].fill = { solid, ...(spec.cut?.length && { cut: pick(spec.cut) }), ...(spec.lines?.length && { lines: pick(spec.lines) }), ...(spec.wire?.length && { wire: pick(spec.wire) }) };
}
// Handshake: cuffs and hands filled (each cuff closes along the canvas edge); the seam between each
// hand and its cuff, the thumb and the finger are knocked out
icons.handshake.fill = {
  solid: [`${icons.handshake.d[0]}Z`, `${icons.handshake.d[1]}Z`, icons.handshake.d[2]],
  cut: [line([6.25, 9], [6.25, 14.5]), line([17.75, 9.5], [17.75, 14.5]), ...icons.handshake.d.slice(3)],
};
// The seam between the fist and the cuff, knocked out
icons['thumbs-up'].fill.cut = [THUMB_SEAM];
icons['thumbs-down'].fill.cut = [xf(THUMB_SEAM, { flipY: true })];
// Open lines only: their filled version is the outline itself. In translate that's the base 文: its
// badge (the drop with the A) brings its own fill and the engine fills it all the same
for (const name of ['reply-all', 'at-sign', 'hashtag', 'broadcast-off', 'rss', 'translate']) icons[name].fill = false;
// Round 4: the dashes of a disappearing bubble, the history arrow and the hashtag under their badges
// (the drop in message-history's corner brings its own fill)
for (const name of ['message-disappearing', 'message-history', 'hashtag-lock', 'hashtag-plus']) icons[name].fill = false;

// ── 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough ──
// At 16 px one pixel is 1.5 canvas units: centers fall on 0.75 + 1.5k and edges on 1.5k. The
// small bubble has its four extremes on pixel centers (3.75 and 20.25), so it looks crisp.
const SDROP = drop(12, 12, 8.25);
const small = (name, glyph, { cut = glyph, solid = [SDROP] } = {}) => {
  icons[name].small = { d: [SDROP, ...glyph], fill: { solid, cut } };
};
// Dots: centered on pixel edges so each one lands fully on 2 × 2 pixels, with 1 pixel of space
// between them and from the bubble
small('message-dots', [7.5, 12, 16.5].map((x) => dot(x, 12, 1)));
// The heart and the star, larger and centered on the grid: in a 13-pixel bubble, the ones from the
// large drawing turned into a smudge
small('message-heart', [heart(12, 9.75, 9)]);
small('message-star', [star(12, 12.4, 5.6, 2.75, 0.6, 0.45)]);
// Read: the two checks on pixel diagonals, their long arms 3 pixels apart (snapped, they ran into one)
small('message-read', [line([6.75, 12.75], [8.25, 14.25], [12.75, 9.75]), line([10.5, 12], [12.75, 14.25], [17.25, 9.75])]);
// The other bubbles with a mark: the same small bubble, with the mark snapped by the engine.
// Snapped by the engine, the large bubble (r 8.75) fell between pixels at the top and left: it looked
// gray on those sides and one pixel wider than the bubbles with a custom drawing
for (const name of Object.keys(icons).filter((n) => n.startsWith('message-') && FILL[n]?.cut && !icons[n].small && !icons[n].badge)) {
  const glyph = icons[name].d.slice(1);
  small(name, glyph.map(snapper([SDROP, ...glyph])));
}
// Disappearing messages: the small bubble's outline in eight dashes (ten fell under a pixel apart)
icons['message-disappearing'].small = { d: [dashedDrop(12, 12, 8.25, 8)] };
// Rotary phone: without the dial's hub (at 16 px it ran into the ring)
{
  const [hand, body] = icons['rotary-phone'].d;
  const dial = circ(12, 14.25, 3.75);
  const d = [hand, body, dial].map(snapper([hand, body, dial]));
  icons['rotary-phone'].small = { d, fill: { solid: [d[0], `${d[1]}Z`], cut: [d[2]] } };
}
// Payphone: the unit on pixel centers and its keypad as single pixels, 1 pixel apart (snapped, the
// dense dots grew into a block)
{
  const unit = sq(11.25, 3.75, 9, 16.5, 2.25, { square: ['br'] });
  const keys = [11.25, 14.25, 17.25].flatMap((y) => [14.25, 17.25].map((x) => circ(x, y, 0.1)));
  const d = [unit, icons.payphone.d[1], line([14.25, 6.75], [17.25, 6.75]), ...keys];
  icons.payphone.small = { d, fill: { solid: [unit, d[1]], cut: d.slice(2) } };
}
// Postmark: the ring alone and two waves (the date ring and the third wave ran together)
{
  const ring = circ(7.5, 12, 4.5);
  const out = (p) => Math.hypot(p[0] - 7.5, p[1] - 12) >= 4.5;
  const waves = [9.75, 14.25].map((y) => clip(wave(7.5, 21.75, y, 3, 0.75), out));
  icons.postmark.small = { d: [ring, ...waves], fill: { solid: [ring], wire: waves } };
}
// Bubble off: the same small bubble under its diagonal
icons['message-off'].small = { d: [SDROP], fill: { solid: [SDROP] }, badge: icons['message-off'].badge };
// Bubble with a notification: the same small bubble, one pixel to the left to make room for the dot
// (the one in the large drawing, smaller and shifted, fell between pixels on the left)
{
  const d = drop(10.5, 12, 8.25);
  icons['message-unread'].small = { d: [d], fill: { solid: [d] }, badge: badge('dot', { size: 16 }) };
}
// Cake: two candles on pixel centers with their flame 1 pixel away (the three in the large drawing
// fell between pixels and their flames merged into a line)
{
  const body = sq(3.75, 11.25, 16.5, 9, 2.25);
  const icing = `M3.75 14.25${[9.25, 14.75, 20.25].map((x) => `A3.27 3.27 0 0 0 ${x} 14.25`).join('')}`;
  const wicks = [9.75, 14.25].map((x) => line([x, 8.25], [x, 11.25]));
  const flames = [9.75, 14.25].map((x) => dot(x, 4.5));
  icons.cake.small = { d: [body, icing, wicks[0], flames[0], wicks[1], flames[1]], fill: { solid: [body, ...flames], wire: wicks, cut: [icing] } };
}
// Faces: the r 8.25 circle (its extremes on pixel centers; the r 9 one fell between two pixels and
// looked like a gray ring), the eyes on 2 × 2 pixels, and each mouth with its straight runs and its
// ends on the grid
{
  const sface = (name, mouth, eyes = [dot(9, 9, 0.8), dot(15, 9, 0.8)]) => {
    const d = [circ(12, 12, 8.25), ...eyes, ...mouth];
    icons[name].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
  };
  const smile = arc(12, 11.25, 4.5, 35, 145).d;
  const frown = arc(12, 20.25, 4.5, 215, 325).d;
  sface('face-smile', [smile]);
  sface('face-laugh', [`M7.5 12.75H16.5${arcTo(12, 12.75, 4.5, 0, 180)}`], [arc(9, 9.75, 1.5, 180, 360).d, arc(15, 9.75, 1.5, 180, 360).d]);
  sface('face-wink', [smile], [dot(9, 9, 0.8), line([13.5, 9.75], [16.5, 9.75])]);
  sface('face-neutral', [line([8.25, 15.75], [15.75, 15.75])]);
  sface('face-confused', [
    smooth([
      [8.25, 15.75],
      [10.5, 14.25],
      [13.5, 15.75],
      [15.75, 14.25],
    ]),
  ]);
  sface('face-surprised', [circ(12, 15, 2.25)]);
  sface('face-sad', [frown]);
  sface('face-angry', [frown], [line([7.5, 8.25], [10.5, 9.75]), line([16.5, 8.25], [13.5, 9.75])]);
}
// Dial pad: 3 × 3 plus the zero, each dot on 2 × 2 pixels with 1 pixel of space (at 16 px the ones
// from the large drawing fell between pixels and looked gray)
{
  const d = [4.5, 9, 13.5].flatMap((y) => [7.5, 12, 16.5].map((x) => dot(x, y, 0.8))).concat(dot(12, 18, 0.8));
  icons.dialpad.small = { d, fill: { solid: d } };
}

// ── Named parts (DESIGN.md › Named parts): what animates, changes level or sits under a badge ──
const PARTS = {
  'message-dots': { body: [0], dots: [1, 2, 3] },
  'message-clock': { body: [0], hands: [1] },
  'message-heart': { body: [0], mark: [1] },
  'message-sparkle': { body: [0], mark: [1] },
  'message-reply': { body: [0], arrow: [1, 2] },
  'message-unread': { body: [0] },
  'message-off': { body: [0] },
  messages: { back: [0] },
  'mail-attachment': { body: [0], flap: [1] },
  'mail-letter': { letter: [0, 1] },
  'mail-stack': { back: [0] },
  'reply-all': { arrow: [0, 1, 2] },
  'phone-incoming': { body: [0], arrow: [1, 2] },
  'phone-outgoing': { body: [0], arrow: [1, 2] },
  'phone-forward': { body: [0], arrow: [1, 2] },
  'phone-transfer': { body: [0], arrow: [1, 2, 3, 4] },
  'phone-ringing': { body: [0] },
  'phone-off': { body: [0] },
  'video-call-off': { body: [0], lens: [1] },
  'screen-share': { screen: [0], stand: [1], arrow: [2, 3] },
  'microphone-off': { body: [0], holder: [1, 2] },
  'bell-ringing': { body: [0], clapper: [1], wave: [2, 3] },
  'notification-badge': { body: [0] },
  broadcast: { source: [0] },
  'broadcast-off': { wave: [0, 1, 2, 3] },
  'radio-tower': { source: [0], tower: [1] },
  'satellite-dish': { dish: [0], feed: [1, 2] },
  'person-speaking': { head: [0], body: [1] },
  people: { back: [0, 1, 2, 3] },
  'thumbs-up': { hand: [0], cuff: [1] },
  'thumbs-down': { hand: [0], cuff: [1] },
  'hand-raised': { hand: [0], fingers: [1, 2, 3] },
  handshake: { cuffs: [0, 1], hands: [2, 3, 4] },
  'party-popper': { cone: [0], streamers: [1, 2], confetti: [3, 4, 5] },
  translate: { glyph: [0, 1, 2, 3] },
  rss: { source: [0] },
};
for (const name of ['mail-unread', 'mail-plus', 'mail-minus', 'mail-check', 'mail-x', 'mail-clock', 'mail-send', 'mail-draft', 'mail-search', 'mail-alert']) PARTS[name] = { body: [0], flap: [1] };
for (const name of ['bell-dot', 'bell-plus', 'bell-check', 'bell-clock', 'bell-off']) PARTS[name] = { body: [0], clapper: [1] };
for (const name of ['person-plus', 'person-minus', 'person-check', 'person-x', 'person-block', 'person-clock', 'person-heart', 'person-edit', 'person-search', 'person-arrow'])
  PARTS[name] = { head: [0], body: [1] };
PARTS['reaction-add'] = { face: [0, 1, 2, 3] };
// Round 4
for (const name of ['message-pin', 'message-edit', 'message-link', 'message-bolt', 'message-attachment', 'message-location']) PARTS[name] = { body: [0], mark: rest(name) };
PARTS['message-history'] = { arrow: [0, 1], hands: [2] };
for (const name of ['mail-reply', 'mail-forward', 'mail-filter', 'mail-lock', 'mail-block', 'mail-star', 'mail-sync', 'mailing-list', 'mail-pin', 'mail-link', 'letter-sealed']) PARTS[name] = { body: [0], flap: [1] };
for (const name of ['phone-record', 'phone-list', 'phone-wifi', 'phone-link', 'phone-block']) PARTS[name] = { body: [0], mark: rest(name) };
PARTS['phone-globe'] = { body: [0], globe: [1, 2, 3] };
for (const name of ['phone-merge', 'phone-callback']) PARTS[name] = { body: [0], arrow: rest(name) };
for (const name of ['contacts-plus', 'contacts-sync']) PARTS[name] = { book: [0], person: [1, 2], tabs: [3, 4, 5] };
PARTS['contacts-group'] = { book: [0], tabs: [1, 2, 3] };
for (const name of ['hashtag-lock', 'hashtag-plus']) PARTS[name] = { hashtag: [0, 1, 2, 3] };
Object.assign(PARTS, {
  'message-forward': { body: [0], arrow: [1, 2] },
  'message-quote': { body: [0], bar: [1], text: [2, 3] },
  'message-info': { body: [0], mark: [1, 2] },
  'message-read': { body: [0], mark: [1, 2] },
  'message-person': { body: [0], person: [1, 2] },
  'message-people': { people: [0, 1, 2] },
  'mail-incoming': { body: [0], flap: [1], arrow: [2, 3] },
  'message-image': { body: [0], sun: [1], mountain: [2] },
  'thought-bubble': { cloud: [0], trail: [1, 2] },
  'text-message': { phone: [0, 1] },
  'mail-rule': { body: [0], flap: [1], arrow: rest('mail-rule', 2) },
  'mail-fast': { body: [0], flap: [1], speed: [2, 3, 4] },
  'mail-postal': { body: [0], stamp: [1], address: [2, 3] },
  'inbox-arrow-down': { tray: [0, 1], arrow: [2, 3] },
  outbox: { tray: [0, 1], arrow: [2, 3] },
  'inbox-full': { tray: [0, 1], sheets: rest('inbox-full', 2) },
  'inbox-check': { tray: [0, 1] },
  postcard: { card: [0], rule: [1], stamp: [2], address: [3, 4] },
  'postage-stamp': { stamp: [0], frame: [1] },
  postmark: { stamp: [0, 1], waves: [2, 3, 4] },
  postbox: { body: [0, 1], slot: [2], door: [3] },
  'mailbox-wall': { body: [0], lid: [1], slot: [2], lock: [3] },
  'mail-slot': { plate: [0] },
  mailboxes: { body: [0, 1, 2], slots: rest('mailboxes', 3) },
  'mailbox-open': { body: [0], post: [1], flag: [2, 3] },
  mailbag: { bag: [0], flap: [1], strap: [2] },
  'conference-call': { people: [0, 1, 2, 3] },
  'caller-id': { head: [0], body: [1] },
  'video-call-incoming': { body: [0], lens: [1], caller: [2, 3], arrow: [4, 5] },
  'rotary-phone': { handset: [0], body: [1], dial: [2, 3] },
  payphone: { unit: [0], handset: [1], slot: [2], keypad: rest('payphone', 3) },
  intercom: { panel: [0], grille: [1, 2, 3], button: [4] },
  fax: { body: [0], sheet: [1, 2, 3], handset: [4] },
  pager: { body: [0], screen: [1], button: [2] },
  'business-card': { card: [0], logo: [1], text: [2, 3, 4] },
  'bell-gear': { body: [0], clapper: [1] },
  'public-address': { horn: [0], pole: [1] },
});
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Levels (DESIGN.md › Levels): the waves light up from the inside out ──
icons.broadcast.levels = [
  [1, 2],
  [3, 4],
];
icons['radio-tower'].levels = [
  [2, 3],
  [4, 5],
];
icons['satellite-dish'].levels = [[3], [4]];
icons['phone-ringing'].levels = [[1], [2]];
icons['person-speaking'].levels = [[2], [3]];
icons.rss.levels = [[1], [2]];
icons['public-address'].levels = [[2], [3]];
for (const name of ['broadcast', 'radio-tower', 'satellite-dish', 'phone-ringing', 'person-speaking', 'rss', 'public-address']) icons[name].parts.level = icons[name].levels.flat();

// ── Automatic variants that make no sense ──
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// A bubble with a mark inside is already an enclosure (like a -circle icon), and the mark acts as
// a badge: the slash would cut through it
variants(
  Object.keys(icons).filter((n) => n.startsWith('message-') && !['message-unread', 'message-off'].includes(n)),
  { circle: false, square: false, slash: false },
);
// Group chat is the people with a bubble in front, not a bubble with a mark: it encloses as
// conference-call does
icons['message-people'].variants = { slash: false };
// Already enclosed in a circle or a square
variants(['face-smile', 'face-laugh', 'face-wink', 'face-neutral', 'face-confused', 'face-surprised', 'face-sad', 'face-angry', 'person-circle', 'reaction-add'], { circle: false });
variants(['notification-badge', 'sticker'], { square: false });
// No slashed variant: the hand-drawn -off icons and their bases; badges (the slash would cut
// through them); loose lines, marks and dots, where a slash says nothing
variants(['video-call', 'screen-share', 'screen-share-off', 'microphone', 'broadcast'], { slash: false });
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, slash: false };
variants(['reply-all', 'dialpad', 'hashtag', 'at-sign'], { slash: false });
// At 58 % the dial pad's dots run together
variants(['dialpad'], { circle: false, square: false });

// ── Mirroring (DESIGN.md › Mirroring): anything with a reading direction ──
for (const name of ['message-reply', 'reply-all', 'mail-send', 'mail-draft', 'phone-forward', 'person-edit', 'person-arrow', 'person-speaking', 'megaphone', 'id-card']) icons[name].mirror = true;

// ── Motion (DESIGN.md › Motion): each icon's own gesture ──
icons['message-heart'].motion = { effect: 'beat', parts: ['mark'], origin: [12, 12.75] };
icons['message-sparkle'].motion = { effect: 'beat', parts: ['mark'], origin: [12, 12] };
icons['message-clock'].motion = { effect: 'spin', parts: ['hands'], origin: [12, 12.25] };
icons['message-reply'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] };
icons['reply-all'].motion = { effect: 'slide', vector: [-2, 0] };
icons['mail-send'].motion = { effect: 'slide', parts: ['badge'], vector: [2, 0] };
icons['mail-draft'].motion = { effect: 'wiggle', parts: ['badge'], origin: [13, 21.25] };
icons['person-edit'].motion = { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] };
icons['person-arrow'].motion = { effect: 'slide', parts: ['badge'], vector: [2, 0] };
icons['phone-incoming'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 1.5] };
icons['phone-outgoing'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, -1.5] };
icons['phone-forward'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['phone-ringing'].motion = { effect: 'ring', origin: [12, 12] };
icons['screen-share'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
for (const name of ['bell-dot', 'bell-ringing']) icons[name].motion = { effect: 'ring', parts: ['body', 'clapper'], origin: [12, 2.95] };
for (const name of ['bell-plus', 'bell-check', 'bell-clock']) icons[name].motion = { effect: 'ring', parts: ['body', 'clapper'], origin: BELL_B_TOP };
for (const name of ['message-unread', 'mail-unread', 'notification-badge']) icons[name].motion = { effect: 'beat', parts: ['badge'], origin: [18.75, 5.25] };
icons['thumbs-up'].motion = { effect: 'bounce', vector: [0, -2] };
icons['thumbs-down'].motion = { effect: 'bounce', vector: [0, 2] };
icons['hand-raised'].motion = { effect: 'wiggle', origin: [12, 20.75] };
icons['party-popper'].motion = { effect: 'beat', parts: ['confetti', 'streamers'], origin: [7.25, 16.75] };

// ── Round 4: mirroring and motion ──
for (const name of ['message-forward', 'message-quote', 'message-edit', 'mail-reply', 'mail-forward', 'mail-fast', 'mail-rule', 'phone-callback', 'phone-list', 'business-card', 'public-address'])
  icons[name].mirror = true;
Object.assign(icons['message-forward'], { motion: { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] } });
icons['message-edit'].motion = { effect: 'wiggle', parts: ['mark'], origin: [8.3, 15.7] };
icons['message-history'].motion = { effect: 'spin', parts: ['hands'], origin: [12, 12.25] };
icons['message-pin'].motion = { effect: 'bounce', parts: ['mark'], vector: [0, -1.5] };
icons['message-location'].motion = { effect: 'bounce', parts: ['mark'], vector: [0, -1.5] };
icons['message-bolt'].motion = { effect: 'beat', parts: ['mark'], origin: [12, 12] };
icons['thought-bubble'].motion = { effect: 'float', vector: [0, -1.5] };
icons['mail-reply'].motion = { effect: 'slide', parts: ['badge'], vector: [-1.5, 0] };
icons['mail-forward'].motion = { effect: 'slide', parts: ['badge'], vector: [1.5, 0] };
icons['mail-incoming'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 1.5] };
icons['mail-fast'].motion = { effect: 'slide', vector: [2, 0] };
icons['mail-rule'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['mail-sync'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['contacts-sync'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['mail-star'].motion = { effect: 'beat', parts: ['badge'], origin: BC };
icons['mail-pin'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -2] };
icons['inbox-arrow-down'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
icons.outbox.motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons['phone-merge'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons['phone-record'].motion = { effect: 'beat', parts: ['mark'], origin: MARK };
icons['video-call-incoming'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 1.5] };
for (const name of ['conference-call', 'caller-id']) icons[name].motion = { effect: 'ring', parts: ['badge'], origin: [16.5, 16.5] };
icons['phone-globe'].motion = { effect: 'ring', parts: ['body'], origin: [7.5, 16.5] };
icons['rotary-phone'].motion = { effect: 'ring', parts: ['handset'], origin: [12, 9.3] };
icons.pager.motion = { effect: 'wiggle', origin: [12, 19] };
icons['bell-gear'].motion = { effect: 'ring', parts: ['body', 'clapper'], origin: BELL_B_TOP };

export default { category: 'comunicacion', label: 'Comunicación y personas', icons };
