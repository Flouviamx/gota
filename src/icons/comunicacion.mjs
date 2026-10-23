// Comunicación y personas (communication and people): bubbles, mail, calls, notifications,
// people and reactions. Everything comes from the engine (engine/geometry.mjs) plus a few local
// tools to move or scale Núcleo pieces (person, phone, bell, envelope) without redrawing them.
// Badges are the engine's (the pencil, the heart and the magnifier included), and anything that
// sits on top of another shape (an arrow, the front person, the diagonal of the -off icons) is a
// custom badge: the engine clears the base by exactly 1.5, never by hand. See DESIGN.md.
import { arc, badge, circ, dot, drop, f, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper } from '../../engine/variants.mjs';
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
// The other bubbles with a mark: the same small bubble, with the mark snapped by the engine.
// Snapped by the engine, the large bubble (r 8.75) fell between pixels at the top and left: it looked
// gray on those sides and one pixel wider than the bubbles with a custom drawing
for (const name of Object.keys(icons).filter((n) => n.startsWith('message-') && FILL[n]?.cut && !icons[n].small)) {
  const glyph = icons[name].d.slice(1);
  small(name, glyph.map(snapper([SDROP, ...glyph])));
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
for (const name of ['broadcast', 'radio-tower', 'satellite-dish', 'phone-ringing', 'person-speaking', 'rss']) icons[name].parts.level = icons[name].levels.flat();

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

export default { category: 'comunicacion', label: 'Comunicación y personas', icons };
