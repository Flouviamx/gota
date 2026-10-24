// Producto y UX (product and UX): design deliverables, research, analytics, experiments, releases
// and agile planning. Everything is computed with engine/geometry.mjs on the rules in DESIGN.md:
// 1.5 stroke, keylines, continuous corners, the square bottom-right corner on containers and the
// drop for speech bubbles. Pointers and badges are the engine's; anything that sits on top of
// another shape is a custom badge, and the engine clears the base with a clearance of paper.
import { arc, badge, circ, cursor, dot, drop, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import nucleo from './nucleo.mjs';

const N = nucleo.icons;

// ---------------------------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------------------------

const P = (p) => `${f(p[0])} ${f(p[1])}`;
const BR = { square: ['br'] };
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);

/** Capsule (semicircular ends), horizontal or vertical depending on the longer side. */
function pill(x, y, w, h) {
  if (w >= h) {
    const r = h / 2;
    return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
  }
  const r = w / 2;
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
}

/** Open line through points with rounded interior corners (one radius per vertex, or one for all). */
function rline(pts, r = 0) {
  const rr = Array.isArray(r) ? r : pts.map(() => r);
  let d = `M${P(pts[0])}`;
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
      d += `L${P(V)}`;
      continue;
    }
    const t = rr[i] / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${P([V[0] + ux * t, V[1] + uy * t])}A${f(rr[i])} ${f(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${P([V[0] + vx * t, V[1] + vy * t])}`;
  }
  return `${d}L${P(pts[pts.length - 1])}`;
}

/** Smooth open curve through points (Catmull-Rom → Bézier). */
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

/** Ellipse (axis-aligned). */
const ellipse = (cx, cy, rx, ry) => `M${P([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx - rx, cy])}Z`;

/** Straight arrow from `a` to `b`, its head `len` long, as one stroke (shaft and head). */
const arrow = (a, b, len = 6) => `${line(a, b)}${head(b, [b[0] - a[0], b[1] - a[1]], len)}`;

/** A closed outline that retraces an open polyline: the area a custom badge clears around it. */
const retrace = (...pts) => `M${pts.map(P).join('L')}${pts.length > 2 ? `L${pts.slice(1, -1).reverse().map(P).join('L')}` : ''}Z`;
/** A custom badge: what is drawn on top, the area it clears and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

// ── Paths as points ──
// A small parser for the engine's paths (absolute or relative M, L, H, V, C, A, Z) that samples
// them as points: the inside of a shape and where a line meets its outline (a diagonal that ends
// on a rounded corner stays buried in the stroke).
function samples(d, step = 0.1) {
  const tk = d.match(/[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const pts = [];
  let i = 0;
  let cmd = '';
  let [x, y, sx, sy] = [0, 0, 0, 0];
  const n = () => Number.parseFloat(tk[i++]);
  const push = (fn, L) => {
    const k = Math.max(2, Math.ceil(L / step));
    for (let j = 1; j <= k; j++) pts.push(fn(j / k));
  };
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    if (C === 'Z') {
      push((t) => [x + (sx - x) * t, y + (sy - y) * t], Math.hypot(sx - x, sy - y));
      [x, y] = [sx, sy];
      continue;
    }
    if (C === 'M') {
      [x, y] = [ox + n(), oy + n()];
      [sx, sy] = [x, y];
      pts.push([x, y]);
      cmd = rel ? 'l' : 'L';
      continue;
    }
    if (C === 'L' || C === 'H' || C === 'V') {
      const a = [x, y];
      if (C === 'L') [x, y] = [ox + n(), oy + n()];
      else if (C === 'H') x = ox + n();
      else y = oy + n();
      const b = [x, y];
      push((t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], Math.hypot(b[0] - a[0], b[1] - a[1]));
    } else if (C === 'C') {
      const p0 = [x, y];
      const p1 = [ox + n(), oy + n()];
      const p2 = [ox + n(), oy + n()];
      const p3 = [ox + n(), oy + n()];
      const bz = (t) => {
        const u = 1 - t;
        return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
      };
      push(bz, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1]));
      [x, y] = p3;
    } else if (C === 'A') {
      let r = n();
      n();
      n();
      const large = n();
      const sweep = n();
      const p0 = [x, y];
      const p1 = [ox + n(), oy + n()];
      const [hx, hy] = [(p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2];
      const h2 = hx * hx + hy * hy;
      if (h2 > r * r) r = Math.sqrt(h2);
      const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, (r * r - h2) / h2));
      const c = [(p0[0] + p1[0]) / 2 + k * hy, (p0[1] + p1[1]) / 2 - k * hx];
      const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
      let da = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
      if (sweep && da < 0) da += 2 * Math.PI;
      if (!sweep && da > 0) da -= 2 * Math.PI;
      push((t) => [c[0] + r * Math.cos(a0 + da * t), c[1] + r * Math.sin(a0 + da * t)], Math.abs(da) * r);
      [x, y] = p1;
    }
  }
  return pts;
}
/** The inside of a closed shape (even-odd, on its sampled outline). */
function inside(d) {
  const poly = samples(d);
  return (p) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** Where the line from `from` (inside shape `d`) toward `to` (outside) crosses its outline. */
function toEdge(from, to, d) {
  const isIn = inside(d);
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (isIn(lerp(from, to, m))) lo = m;
    else hi = m;
  }
  return lerp(from, to, (lo + hi) / 2);
}
/** A box crossed by both diagonals, corner to corner (the placeholder of an image). */
function crossed(x, y, w, h, r) {
  const b = box(x, y, w, h, r);
  const c = [x + w / 2, y + h / 2];
  const out = (dx, dy) => toEdge(c, [c[0] + dx * w, c[1] + dy * h], b);
  return [b, line(out(-1, -1), out(1, 1)), line(out(1, -1), out(-1, 1))];
}

// ── Shared pieces ──
// The landscape keyline (19 × 14) and the portrait one (14.5 × 18.5), the phone's screen as in
// ventanas (`home-screen`, `lock-screen`); the square one (17.5).
const LAND = box(2.5, 5, 19, 14, 4);
const PORT = box(4.75, 2.75, 14.5, 18.5, 4);
const SQUARE = box(3.25, 3.25, 17.5, 17.5, 4);
// A page in a browser: the landscape frame with its bar.
const PAGE_BAR = line([2.5, 8.25], [21.5, 8.25]);

/**
 * Handoff: the frame (12.5 × 5.5, its left edge at `fx`), the arrow down from it at `ax` and the
 * code below it (two brackets at 45°, 3 apart). The arrow is long enough that its head stays 3
 * clear of the frame; handoff-check moves the arrow and the code under the frame's left end.
 */
const handoffAt = (fx, ax) => [
  box(fx, 2.75, 12.5, 5.5, 2),
  arrow([ax, 8.25], [ax, 13.75], 3.4),
  line([ax - 1.5, 16.75], [ax - 3.75, 19], [ax - 1.5, 21.25]),
  line([ax + 1.5, 16.75], [ax + 3.75, 19], [ax + 1.5, 21.25]),
];

/** Núcleo's person scaled `s` from the feet, centered on `cx` with its feet on `y`; the head moves up to keep its gap. */
const person = (s, cx, y) => {
  const [tx, ty] = [cx - 12 * s, y - 20.6 * s];
  return [transform(N.person.d[0], s, tx, ty - 1.95 * (1 - s)), transform(N.person.d[1], s, tx, ty)];
};

/**
 * Mountain-and-sun picture (as in dispositivos' `image`): a sun and a range with 45° slopes that
 * runs edge to edge. The first and last points lie outside the frame: the range starts and ends
 * where it meets the outline.
 */
const picture = (frame, sun, pts) => {
  const ends = [toEdge(pts[1], pts[0], frame), toEdge(pts.at(-2), pts.at(-1), frame)];
  return [dot(...sun), rline([ends[0], ...pts.slice(1, -1), ends[1]], pts.map((_, i) => (i === 0 || i === pts.length - 1 ? 0 : 1)))];
};

/**
 * Sistema's lightbulb scaled to a glass of radius `r` at (cx, cy): the glass narrows to its neck
 * and the base lines stand below it, 3 apart as in the original (they don't scale).
 */
function bulb(cx, cy, r, bases = 1) {
  const k = r / 6;
  const a = arc(cx, cy, r, 135, 405);
  const t = 1.2 * k;
  const [ex, ey] = a.end;
  const [sx, sy] = polar(cx, cy, r, 135);
  const [nx, ny] = [2.25 * k, cy + 6.75 * k];
  const glass = `${a.d}C${P([ex - 0.707 * t, ey + 0.707 * t])} ${P([cx + nx, ny - 0.85 * k])} ${P([cx + nx, ny])}H${f(cx - nx)}C${P([cx - nx, ny - 0.85 * k])} ${P([sx + 0.707 * t, sy + 0.707 * t])} ${P([sx, sy])}Z`;
  const lines = [line([cx - nx, ny + 3], [cx + nx, ny + 3])];
  if (bases > 1) lines.push(line([cx - nx + 1, ny + 6], [cx + nx - 1, ny + 6]));
  return [glass, ...lines];
}
// Sprint: the arrow curls once and carries on to the right, high enough to leave the badges' corner free.
const SPRINT = [smooth([[2.75, 13.75], [7.5, 13.75], [11.25, 10.75], [10, 5.5], [6.5, 6], [6.25, 10], [10.75, 12.25], [15.5, 9.5], [20.75, 9.5]]), head([20.75, 9.5], [1, 0], 3.4)];
// An open tray (the signature corner at the bottom right), deep enough for triage's arrows.
const TRAY = rline([[3.25, 13.5], [3.25, 20.75], [20.75, 20.75], [20.75, 13.5]], [0, 3, 0, 0]);
// The release: an open box, its flaps out, and an arrow rising out of it. The box's top stands 1.75
// below the badges' clearance, so release-clock's badge cuts its corner and flap cleanly.
const RELEASE = [
  rline([[4.75, 12.5], [4.75, 20.75], [19.25, 20.75], [19.25, 12.5]], [0, 2.5, 0, 0]),
  line([4.75, 12.5], [2.75, 9.5]),
  line([19.25, 12.5], [21.25, 9.5]),
  arrow([12, 17.75], [12, 3.75], 4.5),
];
// Chart axes, as in datos' chart-scatter.
const AXES = rline([[3.25, 3.25], [3.25, 20.75], [20.75, 20.75]], 0);
// The backlog: three rows 3.5 high, 7 apart, each with its grip at the left end.
const BACKLOG = [...[5, 12, 19].map((y) => pill(7, y - 1.75, 13.75, 3.5)), ...[5, 12, 19].map((y) => line([3.75, y - 1], [3.75, y + 1]))];

// Sistema's flag (the pole and the notched cloth) with a switch's knob on the cloth, far enough
// left that its cut stays clear of a badge's clearance at every weight.
const FEATURE_FLAG = [line([4.75, 3.25], [4.75, 21.25]), roundpoly([[4.75, 3.25], [19.75, 3.25], [16.25, 9.63], [19.75, 16], [4.75, 16]], [0, 0.9, 0.6, 0.9, 0]), circ(10, 9.63, 2.75)];

// Sistema's lightbulb, whole, 1.75 to the left: the badges' clearance cuts across its glass (not
// along its shoulder, where slivers came and went with the weight) and trims its first base line
// the same way at every weight.
const BULB_L = bulb(10.25, 8.5, 6, 2);

/** Cubic between two rings of radius `r` on a curve: it leaves `p` along `tp` and reaches `q` along `tq`. */
function between(p, q, tp, tq, r) {
  const n = (v) => {
    const l = Math.hypot(v[0], v[1]);
    return [v[0] / l, v[1] / l];
  };
  const [u, w] = [n(tp), n(tq)];
  const a = [p[0] + u[0] * r, p[1] + u[1] * r];
  const b = [q[0] - w[0] * r, q[1] - w[1] * r];
  const k = Math.hypot(b[0] - a[0], b[1] - a[1]) / 3;
  return `M${P(a)}C${P([a[0] + u[0] * k, a[1] + u[1] * k])} ${P([b[0] - w[0] * k, b[1] - w[1] * k])} ${P(b)}`;
}

// Edicion's eye: the almond and its pupil.
const EYE = 'M2.75 12C5 7.75 8.25 5.5 12 5.5S19 7.75 21.25 12C19 16.25 15.75 18.5 12 18.5S5 16.25 2.75 12Z';

/** A question mark: the hook (radius `r`) turns down into a stem, its point 3.7 below the stem. */
const question = (cx, top, r) => {
  const cy = top + r;
  const end = cy + 1.4 * r + 0.1;
  return [`${arc(cx, cy, r, 180, 360).d}C${P([cx + r, cy + 0.7 * r])} ${P([cx, cy + 0.7 * r])} ${P([cx, end - 0.1])}V${f(end)}`, dot(cx, end + 3.7)];
};

/** Smooth closed curve through points (Catmull-Rom → Bézier): the irregular contours of a heatmap. */
function smoothClosed(pts, k = 1 / 6) {
  const n = pts.length;
  const at = (i) => pts[(i + n) % n];
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    o += `C${P([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${P([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${P(p2)}`;
  }
  return `${o}Z`;
}
/** An irregular contour around (cx, cy): one radius per point, evenly around. */
const contour = (cx, cy, radii) => smoothClosed(radii.map((r, i) => polar(cx, cy, r, -90 + (i * 360) / radii.length)));

/**
 * The set's cloud (archivos): three lobes on a flat base, scaled `k` around the middle and moved
 * `dy`. Each lobe runs from where it meets the next one.
 */
function cloud(k = 1, dy = 0) {
  const T = ([x, y, r]) => [12 + (x - 12) * k, 12 + (y - 12) * k + dy, r * k];
  const [A, B, C] = [T([7.25, 14.25, 4]), T([12.5, 10.75, 5.5]), T([17.25, 14.5, 3.75])];
  const meet = (c1, c2) => {
    const [x1, y1, r1] = c1;
    const [x2, y2, r2] = c2;
    const d = Math.hypot(x2 - x1, y2 - y1);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(r1 * r1 - a * a);
    const [mx, my] = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
    const p = [mx + (h * (y2 - y1)) / d, my - (h * (x2 - x1)) / d];
    const q = [mx - (h * (y2 - y1)) / d, my + (h * (x2 - x1)) / d];
    return p[1] < q[1] ? p : q;
  };
  const ang = (c, p) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
  const [ab, bc] = [meet(A, B), meet(B, C)];
  const base = A[1] + A[2];
  const seg = (c, a0, a1) => arc(c[0], c[1], c[2], a0, a1).d.replace(/^M[^A]*/, '');
  return `M${P([A[0], base])}${seg(A, 90, ang(A, ab) + 360)}${seg(B, ang(B, ab), ang(B, bc) + 360)}${seg(C, ang(C, bc), 90 + 360)}Z`;
}

/**
 * A card with a rounded pointer on its bottom edge (a tip bubble): `cx` its middle, `half` and
 * `depth` its size. The pointer is spliced into the bottom edge, between the square corner and the
 * start of the bottom-left one.
 */
function tipCard(x, y, w, h, r, cx, half, depth) {
  const b = box(x, y, w, h, r);
  const yb = f(y + h);
  const m = new RegExp(`L(-?[\\d.]+) ${yb}(?=c)`).exec(b);
  const run = rline([[x + w, y + h], [cx + half, y + h], [cx, y + h + depth], [cx - half, y + h], [Number(m[1]), y + h]], [0, 0.6, 0.6, 0.6, 0]);
  return b.replace(m[0], run.replace(/^M[^L]*/, ''));
}

/** A status badge of the set's own (on the engine's ring): a solid disc with its sign cut out. */
const statusBadge = (...sign) => {
  const ring = circ(17.25, 17.25, 4.25);
  return own([ring, ...sign], ring, { solid: [ring], cut: sign });
};

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------

const icons = {
  // Design deliverables -------------------------------------------------------------------------
  wireframe: {
    tags: ['wireframe', 'boceto de pantalla', 'baja fidelidad', 'maqueta', 'lo-fi', 'layout sketch'],
    // A crossed placeholder on the left and two text lines beside it. No bar: with it the frame,
    // the box and its cross went past the density limit.
    d: [LAND, ...crossed(5.5, 8, 6, 8, 1.75), line([14.5, 10.5], [18.5, 10.5]), line([14.5, 13.5], [16.75, 13.5])],
  },
  'wireframe-mobile': {
    tags: ['wireframe móvil', 'boceto de app', 'baja fidelidad', 'mobile wireframe', 'app sketch', 'lo-fi'],
    d: [PORT, ...crossed(8.5, 6, 7, 5.5, 1.75), line([8.5, 14.5], [15.5, 14.5]), line([8.5, 17.5], [12.5, 17.5])],
  },
  'image-placeholder': {
    tags: ['marcador de imagen', 'espacio para imagen', 'imagen vacía', 'image placeholder', 'empty image', 'media slot'],
    // Square: a landscape frame crossed corner to corner reads as an envelope.
    d: crossed(3.25, 3.25, 17.5, 17.5, 4),
  },
  mockup: {
    tags: ['mockup', 'diseño de alta fidelidad', 'maqueta visual', 'hi-fi', 'design comp', 'visual design'],
    // A page with its bar, showing a picture full bleed: a sun and a range edge to edge.
    d: [LAND, PAGE_BAR, ...picture(LAND, [16.5, 11.5], [[-2, 8.25], [5.5, 15.75], [10.25, 11], [24, 24.75]])],
  },
  'mockup-mobile': {
    tags: ['mockup móvil', 'pantalla de app', 'alta fidelidad', 'mobile mockup', 'app screen', 'hi-fi'],
    // The phone's screen: the same picture full bleed above a pill button.
    d: [PORT, ...picture(PORT, [8.75, 6.5], [[2.75, 6.25], [8.75, 12.25], [14.5, 6.5], [21.5, 13.5]]), pill(7.75, 15.25, 8.5, 3)],
  },
  prototype: {
    tags: ['prototipo', 'pantallas enlazadas', 'interacción', 'prototype', 'clickable prototype', 'flow'],
    // Two screens side by side; the arrow (on top: the engine clears the edges it crosses) leaves
    // the hotspot on the first and lands inside the second.
    d: [box(2.5, 5.5, 7.5, 13, 2), box(14, 5.5, 7.5, 13, 2)],
    badge: (() => {
      const [from, to] = [[6.25, 12], [17.25, 12]];
      const hotspot = dot(...from);
      const tip = head(to, [1, 0], 3.4);
      return own([hotspot, line(from, to), tip], `${hotspot}${retrace(from, to)}${tip}`);
    })(),
  },
  moodboard: {
    tags: ['moodboard', 'tablero de inspiración', 'referencias', 'mood board', 'inspiration', 'collage'],
    // Three tiles of a collage: a tall picture with its peak, a round swatch and a square one (a
    // board around them went past the density limit).
    d: [box(3.25, 3.25, 7.5, 17.5, 2.25), line([3.25, 15.5], [7, 11.75], [10.75, 15.5]), circ(17.25, 6.75, 3.5), box(13.75, 13.25, 7, 7.5, 2.25)],
  },
  'style-guide': {
    tags: ['guía de estilo', 'manual de marca', 'colores', 'style guide', 'brand guidelines', 'swatches'],
    // Núcleo's document: a strip of three swatches across the top and two text lines below.
    d: [N.document.d[0], box(7.75, 6.25, 8.5, 4.5, 1.25), line([10.58, 6.25], [10.58, 10.75]), line([13.42, 6.25], [13.42, 10.75]), line([7.75, 13.75], [16.25, 13.75]), line([7.75, 17], [12.5, 17])],
  },
  'design-system': {
    tags: ['sistema de diseño', 'biblioteca de componentes', 'kit de interfaz', 'design system', 'component library', 'ui kit'],
    // Archivos' book (the cover and its spine) with the component's diamond high on the cover,
    // clear of the badges' corner.
    d: [box(4.75, 2.75, 14.5, 18.5, 2.5), line([8.75, 2.75], [8.75, 21.25]), roundpoly([[14, 6.5], [16.5, 9], [14, 11.5], [11.5, 9]], 0.6)],
  },
  'design-system-sync': {
    tags: ['actualizar biblioteca', 'sincronizar componentes', 'cambios disponibles', 'library update', 'sync library', 'updates available'],
    d: [box(4.75, 2.75, 14.5, 18.5, 2.5), line([8.75, 2.75], [8.75, 21.25]), roundpoly([[14, 6.5], [16.5, 9], [14, 11.5], [11.5, 9]], 0.6)],
    badge: badge('sync'),
  },
  'design-token': {
    tags: ['token de diseño', 'variable de diseño', 'valor compartido', 'design token', 'variables', 'tokens'],
    // Datos' braces holding a swatch.
    d: [
      'M8.75 3.25h-.5A2.25 2.25 0 0 0 6 5.5v3.75A2.75 2.75 0 0 1 3.25 12 2.75 2.75 0 0 1 6 14.75v3.75a2.25 2.25 0 0 0 2.25 2.25h.5',
      'M15.25 3.25h.5A2.25 2.25 0 0 1 18 5.5v3.75A2.75 2.75 0 0 0 20.75 12 2.75 2.75 0 0 0 18 14.75v3.75a2.25 2.25 0 0 1-2.25 2.25h-.5',
      circ(12, 12, 2.75),
    ],
  },
  annotation: {
    tags: ['anotación', 'especificaciones', 'nota de diseño', 'annotation', 'design specs', 'callout'],
    // The frame with a leader from a dot inside it toward the label, which sits on top of the
    // frame's top-right corner (the engine clears the corner around it).
    d: [LAND, line([7, 14.5], [12.5, 9]), dot(7, 14.5)],
    badge: own([pill(13.25, 2.75, 8.25, 3.5)], pill(13.25, 2.75, 8.25, 3.5), { solid: [pill(13.25, 2.75, 8.25, 3.5)] }),
  },
  handoff: {
    tags: ['entrega a desarrollo', 'modo desarrollador', 'diseño a código', 'handoff', 'dev mode', 'design to code'],
    // The design (a frame) flows down into the code (a pair of angle brackets): side by side they
    // didn't fit at 24 without shrinking each to a smudge.
    d: handoffAt(5.75, 12),
  },
  'handoff-check': {
    tags: ['listo para desarrollo', 'entregado', 'diseño aprobado', 'ready for dev', 'handoff done', 'dev ready'],
    // The same pieces, the frame 3.25 to the left and the arrow and code under its left end: the
    // badge takes the corner the code had.
    d: handoffAt(2.5, 6.25),
    badge: badge('check'),
  },
  'live-cursors': {
    tags: ['cursores en vivo', 'colaboración en tiempo real', 'multijugador', 'live cursors', 'multiplayer', 'presence'],
    // Two of the engine's pointers, both the same way round, each trailing its name tag 3 clear of
    // its wing; the second tip stands 3 clear of the first pointer's tail.
    d: [cursor([2.75, 2.75], 0.42), pill(10.5, 5.9, 6, 3.25), cursor([7.75, 13.25], 0.42), pill(15.5, 16.4, 6, 3.25)],
  },
  easing: {
    tags: ['curva de aceleración', 'easing', 'animación', 'timing', 'ease in out', 'motion curve'],
    // The graph box and an ease-in-out curve between its two ends.
    d: [SQUARE, 'M6.75 17.25C12.25 17.25 11.75 6.75 17.25 6.75', dot(6.75, 17.25), dot(17.25, 6.75)],
  },
  'easing-spring': {
    tags: ['animación de resorte', 'rebote', 'spring', 'resorte', 'overshoot', 'bounce'],
    // The same box: the curve shoots past its end, comes back once and settles.
    d: [SQUARE, smooth([[6.75, 17.25], [9.75, 6.25], [12.75, 11.75], [15, 8.75], [17.25, 9.5]]), dot(6.75, 17.25), dot(17.25, 9.5)],
  },
  'pencil-ruler': {
    tags: ['diseño', 'lápiz y regla', 'herramientas de diseño', 'design', 'pencil and ruler', 'design tools'],
    // The ruler across one diagonal with its ticks; Núcleo's pencil across the other, on top.
    d: (() => {
      const u = [Math.SQRT1_2, Math.SQRT1_2];
      const v = [Math.SQRT1_2, -Math.SQRT1_2];
      const at = (s, t) => [12 + u[0] * s + v[0] * t, 12 + u[1] * s + v[1] * t];
      // The ticks 3 apart and 3 from the ends, clear of the pencil's clearance (4.35 from its axis)
      const [L, W] = [11.5, 2.75];
      const ruler = roundpoly([at(-L, -W), at(L, -W), at(L, W), at(-L, W)], 1);
      const ticks = [-8.5, -5.5, 5.5, 8.5].map((s) => line(at(s, W), at(s, W - 2.25)));
      return [ruler, ...ticks];
    })(),
    badge: own(N.edit.d, N.edit.d[0], { solid: [N.edit.d[0]], cut: [N.edit.d[1], N.edit.d[2]] }),
  },
  breakpoints: {
    tags: ['puntos de quiebre', 'diseño responsivo', 'tamaños de pantalla', 'breakpoints', 'responsive', 'screen sizes'],
    // A ruler of widths over the screen: a double arrow across it with two ticks where the layout
    // changes. (Three frames nested in one corner read as stacked pages, side by side as a bar
    // chart, overlapping as `devices`.)
    d: [
      box(2.5, 9.25, 19, 11.5, 3.5),
      `${line([2.75, 4.25], [21.25, 4.25])}${head([2.75, 4.25], [-1, 0], 3)}${head([21.25, 4.25], [1, 0], 3)}`,
      line([9.5, 2.75], [9.5, 5.75]),
      line([14.5, 2.75], [14.5, 5.75]),
    ],
  },
  'thumb-zone': {
    tags: ['zona del pulgar', 'alcance', 'ergonomía móvil', 'thumb zone', 'reachability', 'one-handed'],
    // The phone's screen and the sweep of a thumb pivoting at its bottom-right corner: an arc with
    // a head at each end, every point of them 2.9 clear of the frame. (The bare arc read as a page
    // with a curve.)
    d: (() => {
      const [c, r] = [[19.25, 21.25], 10.5];
      const [a, b] = [arc(...c, r, 198, 254), arc(...c, r, 254, 198)];
      return [PORT, `${a.d}${head(a.end, a.tangent, 3.4)}${head(b.end, b.tangent, 3.4)}`];
    })(),
  },

  // Process, flows and journeys -----------------------------------------------------------------
  'double-diamond': {
    tags: ['doble diamante', 'proceso de diseño', 'divergir y converger', 'double diamond', 'design process', 'diverge converge'],
    d: [roundpoly([[2.4, 12], [7.2, 7.2], [12, 12], [7.2, 16.8]], [1.2, 1.2, 0, 1.2]), roundpoly([[12, 12], [16.8, 7.2], [21.6, 12], [16.8, 16.8]], [0, 1.2, 1.2, 1.2])],
  },
  'user-flow': {
    tags: ['flujo de usuario', 'recorrido', 'pantallas', 'user flow', 'screen flow', 'task flow'],
    // The entry, an arrow down to the first screen, another on to the second, lower and to the right.
    d: [dot(5.25, 3.5), arrow([5.25, 3.5], [5.25, 8.5], 3.4), box(2.75, 11.5, 5, 7.25, 1.75), arrow([7.75, 16], [13.25, 16], 3.4), box(16.25, 13.5, 5, 7.25, 1.75)],
  },
  'drop-off': {
    tags: ['abandono', 'punto de salida', 'embudo', 'drop-off', 'churn point', 'abandonment'],
    // Three steps on a path; at the middle one an arrow falls away.
    d: [circ(4.5, 7.5, 1.75), circ(12, 7.5, 1.75), circ(19.5, 7.5, 1.75), line([6.25, 7.5], [10.25, 7.5]), line([13.75, 7.5], [17.75, 7.5]), arrow([12, 9.25], [12, 18], 4)],
  },
  'journey-map': {
    tags: ['mapa de viaje', 'experiencia del cliente', 'etapas', 'journey map', 'customer journey', 'experience map'],
    // The mood rises and dips through three moments over the stages' baseline.
    d: (() => {
      const [A, B, C] = [[5, 13], [12, 6.5], [19, 11.5]];
      return [
        circ(...A, 1.75),
        circ(...B, 1.75),
        circ(...C, 1.75),
        between(A, B, [1, -1], [1, 0], 1.75),
        between(B, C, [1, 0], [1, 0.4], 1.75),
        line([3.25, 20.75], [20.75, 20.75]),
        line([9.25, 20.75], [9.25, 18.25]),
        line([14.75, 20.75], [14.75, 18.25]),
      ];
    })(),
  },
  'pain-point': {
    tags: ['punto de dolor', 'fricción', 'frustración', 'pain point', 'friction', 'frustration'],
    // A user's quote with a bolt in it: the sharp moment of frustration, insight's sibling (the
    // drop with a lightbulb). A line that dips into a notch read as a letter Y.
    d: [N.comment.d[0], transform(N.bolt.d[0], 0.62, 12 - 12 * 0.62, 11.75 - 12 * 0.62)],
  },
  'service-blueprint': {
    tags: ['blueprint de servicio', 'diseño de servicios', 'carriles', 'service blueprint', 'service design', 'swimlanes'],
    // The front stage and the backstage split by the line of visibility; the service's path leaves
    // a step in front and crosses the line to a step behind it. (Three lanes and a frame already
    // took 26% of ink before any path; a straight connector through three dots read as a table
    // with a slider.)
    d: [SQUARE, line([3.25, 12], [20.75, 12]), rline([[7.5, 7.5], [12, 7.5], [12, 16.5], [16.5, 16.5]], 1.75), dot(7.5, 7.5), dot(16.5, 16.5)],
  },
  'use-case': {
    tags: ['caso de uso', 'actor', 'requisitos', 'use case', 'actor', 'uml'],
    // The actor (núcleo's person) and the use case's ellipse, joined by the association at the
    // height of the head: it touches the case and stands 3 clear of the actor.
    d: [...person(0.6, 6.25, 18.25), line([11.5, 9.5], [13.75, 9.5]), ellipse(17.5, 9.5, 3.75, 3)],
  },

  // Research ---------------------------------------------------------------------------------------
  persona: {
    tags: ['persona', 'arquetipo', 'perfil de usuario', 'persona', 'user archetype', 'user profile'],
    // Núcleo's person and three attribute lines, with no card around them.
    d: [...person(0.6, 7.25, 17.25), line([14.5, 8.75], [20.75, 8.75]), line([14.5, 12.25], [19, 12.25]), line([14.5, 15.75], [20, 15.75])],
  },
  'user-interview': {
    tags: ['entrevista', 'investigación de usuarios', 'pregunta', 'user interview', 'research', 'question'],
    // The question in a drop that comes from the left (the interviewer); the person in front of it.
    d: [flipPath(drop(14.25, 9.5, 7.25)), ...question(9.75, 4.55, 1.6)],
    badge: own(person(0.55, 17.25, 21.25), person(0.55, 17.25, 21.25).join(''), { solid: person(0.55, 17.25, 21.25) }),
  },
  'focus-group': {
    tags: ['grupo focal', 'sesión grupal', 'investigación', 'focus group', 'group session', 'research'],
    // Three people in a shallow arc (the one in front on top) under one shared drop.
    d: [drop(12, 5.25, 3), ...person(0.45, 6, 19.75), ...person(0.45, 18, 19.75)],
    badge: own(person(0.55, 12, 21.25), person(0.55, 12, 21.25).join(''), { solid: person(0.55, 12, 21.25) }),
  },
  'usability-test': {
    tags: ['prueba de usabilidad', 'test con usuarios', 'observar', 'usability test', 'user testing', 'observation'],
    // A screen with a pointer on it; the person in front, on top (the engine clears the screen's edge).
    d: [box(2.5, 3, 19, 13.5, 3.5), cursor([14.5, 5.5], 0.42)],
    badge: own(person(0.55, 8.5, 21.25), person(0.55, 8.5, 21.25).join(''), { solid: person(0.55, 8.5, 21.25) }),
  },
  'eye-tracking': {
    tags: ['seguimiento ocular', 'mirada', 'atención', 'eye tracking', 'gaze', 'attention'],
    // Edicion's eye, its pupil a sight: the vertical ticks reach the lids, the level ones stop 3
    // short of them.
    d: [EYE, circ(12, 12, 2.75), line([14.75, 12], [17.5, 12]), line([9.25, 12], [6.5, 12]), line([12, 9.25], [12, 5.5]), line([12, 14.75], [12, 18.5])],
  },
  'card-sorting': {
    tags: ['card sorting', 'clasificar tarjetas', 'arquitectura de información', 'card sort', 'information architecture', 'categorize'],
    // Two stacks (a card and the edge of the one behind it) and a third card on its way, tilted,
    // high enough to stand 3 clear of both stacks.
    d: [box(2.5, 13.75, 7.5, 7, 1.75), line([4.25, 10.75], [8.25, 10.75]), box(14, 13.75, 7.5, 7, 1.75), line([15.75, 10.75], [19.75, 10.75]), turnPath(box(8.75, 2.75, 6.5, 4.5, 1.5), 20, [12, 5])],
  },
  'tree-test': {
    tags: ['tree test', 'prueba de árbol', 'navegación', 'tree testing', 'findability', 'navigation test'],
    // A root, two children indented under it and a grandchild under the first; the pointer points
    // at the grandchild from 3.7 away (ink 1.5 apart). It's part of the drawing, not a badge: a
    // badge removes every dot within 4.45 of it at regular and 5.1 at bold, so the grandchild came
    // and went with the weight. Every connector ends on a dot's outline.
    d: (() => {
      const [R, C1, C2, G] = [[4.25, 3.5], [8.75, 7.5], [8.75, 16.5], [12.25, 10.75]];
      const r = 0.7;
      return [
        dot(...R),
        rline([[R[0], R[1] + r], [R[0], C2[1]], [C2[0] - r, C2[1]]], 2),
        line([R[0], C1[1]], [C1[0] - r, C1[1]]),
        dot(...C1),
        dot(...C2),
        rline([[C1[0], C1[1] + r], [C1[0], G[1]], [G[0] - r, G[1]]], 1.75),
        dot(...G),
        cursor([G[0] + 2.65, G[1] + 2.65], 0.42),
      ];
    })(),
  },
  'preference-test': {
    tags: ['prueba de preferencia', 'elegir diseño', 'opciones', 'preference test', 'desirability', 'pick a design'],
    // Two options side by side; the heart goes to the second.
    d: [box(2.75, 3.25, 8, 13.5, 2.25), box(13.25, 3.25, 8, 13.5, 2.25)],
    badge: badge('heart'),
  },
  'five-second-test': {
    tags: ['prueba de cinco segundos', 'primera impresión', 'temporizador', 'five second test', 'first impression', 'timed'],
    // Edicion's eye, smaller, in a quarter of a timer's ring.
    d: [transform(EYE, 0.65, 4.2, 4.2), circ(12, 12, 2.1), arc(12, 12, 9, -90, 0).d],
  },
  'diary-study': {
    tags: ['estudio de diario', 'bitácora', 'investigación longitudinal', 'diary study', 'longitudinal', 'journal'],
    // Archivos' notebook, logged over time: the engine's clock. (Four day dots on its cover read
    // as a keypad.)
    d: [box(6.25, 2.75, 13, 18.5, 3), line([3.75, 8.5], [8.75, 8.5]), line([3.75, 12], [8.75, 12]), line([3.75, 15.5], [8.75, 15.5])],
    badge: badge('clock'),
  },
  'empathy-map': {
    tags: ['mapa de empatía', 'dice piensa hace siente', 'usuario', 'empathy map', 'user needs', 'says thinks does feels'],
    // Four quadrants (says, thinks, does, feels) around the user: núcleo's person sits on the
    // crossing and the engine clears the cross around it. (A ring there read as a crosshair.)
    d: [SQUARE, line([12, 3.25], [12, 20.75]), line([3.25, 12], [20.75, 12])],
    badge: (() => {
      const p = person(0.42, 12, 16.15);
      return own(p, p.join(''), { solid: p });
    })(),
  },
  insight: {
    tags: ['hallazgo', 'aprendizaje', 'idea clave', 'insight', 'finding', 'learning'],
    // Núcleo's comment holding a lightbulb.
    d: [N.comment.d[0], ...bulb(12, 9.25, 3.5)],
  },
  'mental-model': {
    tags: ['modelo mental', 'cómo piensa el usuario', 'percepción', 'mental model', 'user understanding', 'cognition'],
    // A head in profile (facing right, open at the neck) with three linked ideas inside it.
    d: [
      `M8 21.25L7.25 16.75${arc(11, 10.25, 7.5, 120, 330).d.replace(/^M[^A]*/, '')}${rline([[17.5, 6.5], [19, 10.75], [20.75, 13.25], [18.75, 14.25], [18.75, 16.25], [16, 17.25], [15.75, 21.25]], [0, 1.5, 0.75, 0.75, 1, 1, 0]).replace(/^M[^L]*/, '')}`,
      dot(7.75, 8),
      dot(14, 7.5),
      dot(11, 13.25),
      line([7.75, 8], [14, 7.5]),
      line([14, 7.5], [11, 13.25]),
      line([11, 13.25], [7.75, 8]),
    ],
  },
  discovery: {
    tags: ['descubrimiento', 'explorar problemas', 'investigar ideas', 'discovery', 'product discovery', 'explore'],
    // The lightbulb family's idea, searched: the engine's magnifier. (A bulb's glass inside a lens
    // read as a pin at 18 px.)
    d: BULB_L,
    badge: badge('search'),
  },
  brainstorm: {
    tags: ['lluvia de ideas', 'idear', 'sesión creativa', 'brainstorm', 'ideation', 'ideas'],
    // The set's cloud, smaller and higher; a lightbulb hangs in front of its base (on top: the
    // engine clears the cloud around it).
    d: [cloud(0.85, -4)],
    badge: own(bulb(12, 13, 3.75), bulb(12, 13, 3.75)[0], { solid: [bulb(12, 13, 3.75)[0]], wire: [bulb(12, 13, 3.75)[1]] }),
  },

  // Analytics -----------------------------------------------------------------------------------
  heatmap: {
    tags: ['mapa de calor', 'atención', 'zonas calientes', 'heatmap', 'attention map', 'hot spots'],
    // The page with two nested contours, a hot spot in its upper half.
    d: [PORT, contour(12, 9.75, [4.25, 4.5, 4, 4.25, 4, 4.5]), contour(12.25, 9.75, [1.5, 1.6, 1.35, 1.5, 1.4, 1.6])],
  },
  'heatmap-click': {
    tags: ['mapa de clics', 'clics', 'interacción', 'click map', 'clicks', 'click heatmap'],
    // The page with a cluster of clicks and the pointer clicking at them.
    d: [PORT, dot(8.5, 9.75), dot(9.25, 6.25), dot(13, 6.5), cursor([11.75, 9.75], 0.5)],
  },
  'heatmap-scroll': {
    tags: ['mapa de scroll', 'profundidad de desplazamiento', 'pliegue', 'scroll map', 'scroll depth', 'fold'],
    // The page crossed by two folds; the chevron in the lowest band.
    d: [PORT, line([4.75, 8], [19.25, 8]), line([4.75, 12.75], [19.25, 12.75]), line([9.75, 15.75], [12, 18], [14.25, 15.75])],
  },
  'heatmap-move': {
    tags: ['mapa de movimiento', 'recorrido del ratón', 'trayectoria', 'move map', 'mouse movement', 'hover map'],
    // The page with the winding trail of the mouse, ending 3 short of the pointer; the pointer
    // stands 3 clear of the page.
    d: [PORT, smooth([[15.75, 5.75], [9.5, 6], [7.75, 9.25], [8, 12.25]]), cursor([11, 9.75], 0.45)],
  },
  'rage-click': {
    tags: ['clics de frustración', 'rage click', 'frustración', 'rage clicks', 'frustration signal', 'repeated clicks'],
    // The pointer, its tip ringed by three ripples.
    d: [cursor([11.5, 11], 0.52), arc(11.5, 11, 3, 180, 270).d, arc(11.5, 11, 6, 180, 270).d, arc(11.5, 11, 9, 180, 270).d],
  },
  'session-replay': {
    tags: ['repetición de sesión', 'grabación', 'reproducir sesión', 'session replay', 'session recording', 'replay'],
    // Núcleo's refresh ring turned the other way (the engine's arc and head, counterclockwise, its
    // gap at the top left) around the pointer, small and centred so the fill's clearance around it
    // never reaches the ring.
    d: (() => {
      const a = arc(12, 12.4, 8.1, 214, -82);
      return [a.d, head(a.end, a.tangent, 3.4), cursor([9.75, 8.5], 0.42)];
    })(),
  },

  // Onboarding and flags --------------------------------------------------------------------------
  onboarding: {
    tags: ['bienvenida', 'primeros pasos', 'introducción', 'onboarding', 'welcome', 'walkthrough'],
    // The phone's screen: an illustration and the page dots.
    d: [PORT, circ(12, 10, 3.75), dot(8.5, 17.25, 0.3), dot(12, 17.25, 0.3), dot(15.5, 17.25, 0.3)],
  },
  'product-tour': {
    tags: ['tour del producto', 'guía interactiva', 'coach marks', 'product tour', 'guided tour', 'tooltip tour'],
    // A spotlight ring on one point of the screen and the tip pointing at it (below the tip, the
    // ring read as a person's head).
    d: [SQUARE, tipCard(6.75, 6.5, 10.5, 4, 1.25, 13.5, 1.5, 2), circ(13.5, 14.5, 2)],
  },
  'feature-flag': {
    tags: ['feature flag', 'bandera de función', 'activar función', 'feature toggle', 'flag', 'toggle'],
    // Sistema's flag, its cloth carrying a switch's knob (a pill-shaped cloth read as a P).
    d: FEATURE_FLAG,
  },
  'feature-flag-clock': {
    tags: ['lanzamiento programado', 'programar función', 'activar después', 'scheduled rollout', 'scheduled flag', 'timed release'],
    d: FEATURE_FLAG,
    badge: badge('clock'),
  },
  'kill-switch': {
    tags: ['interruptor de emergencia', 'apagar función', 'kill switch', 'emergency off', 'disable feature', 'shut off'],
    // The flag with a power sign on the badges' ring: a power symbol inside the cloth couldn't keep
    // its clearances. Its gap is wide (120°) so the stem's cut and the ring's never meet, even
    // where the paper is widest (light).
    d: FEATURE_FLAG,
    badge: statusBadge(arc(17.25, 17.6, 2.5, -30, 210).d, line([17.25, 14.1], [17.25, 17.35])),
  },
  rollout: {
    tags: ['despliegue gradual', 'porcentaje de usuarios', 'lanzamiento escalonado', 'rollout', 'staged rollout', 'percentage rollout'],
    // A quarter taken; the arrow carries on clockwise from it.
    d: (() => {
      const a = arc(12, 12, 8.75, 0, 250);
      return ['M12 12V3.25A8.75 8.75 0 0 1 20.75 12Z', a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  'multivariate-test': {
    tags: ['prueba multivariante', 'a/b/n', 'variantes', 'multivariate test', 'split test', 'experiment'],
    // One stem splits into three: left, up and right (datos' ab-test with a third way).
    d: [
      line([12, 20.75], [12, 14.25]),
      arrow([12, 14.25], [12, 3.25], 3.4),
      `${rline([[12, 14.25], [9, 11.25], [3.5, 11.25]], 2.5)}${head([3.5, 11.25], [-1, 0], 3.4)}`,
      `${rline([[12, 14.25], [15, 11.25], [20.5, 11.25]], 2.5)}${head([20.5, 11.25], [1, 0], 3.4)}`,
    ],
  },
  'lightbulb-question': {
    tags: ['hipótesis', 'suposición', 'idea sin validar', 'hypothesis', 'assumption', 'untested idea'],
    d: BULB_L,
    badge: badge('question'),
  },
  'lightbulb-check': {
    tags: ['idea validada', 'hipótesis confirmada', 'aprendizaje', 'validated idea', 'confirmed', 'validated learning'],
    d: BULB_L,
    badge: badge('check'),
  },
  'lightbulb-plus': {
    tags: ['proponer idea', 'solicitar función', 'nueva idea', 'submit idea', 'feature request', 'new idea'],
    d: BULB_L,
    badge: badge('plus'),
  },
  release: {
    tags: ['lanzamiento', 'publicar versión', 'nueva versión', 'release', 'ship', 'new version'],
    // An open box (its flaps out) and an arrow rising out of it.
    d: RELEASE,
  },
  'release-clock': {
    tags: ['lanzamiento programado', 'fecha de versión', 'plan de lanzamiento', 'scheduled release', 'release date', 'release plan'],
    d: RELEASE,
    badge: badge('clock'),
  },
  changelog: {
    tags: ['registro de cambios', 'novedades', 'historial de versiones', 'changelog', 'release notes', 'version history'],
    // A timeline rail with three versions on it, each with its line of text.
    d: [line([5.75, 3.25], [5.75, 20.75]), dot(5.75, 5.75), dot(5.75, 12), dot(5.75, 18.25), line([10, 5.75], [20.25, 5.75]), line([10, 12], [17.25, 12]), line([10, 18.25], [18.75, 18.25])],
  },
  'feedback-loop': {
    tags: ['ciclo de retroalimentación', 'comentarios continuos', 'mejora continua', 'feedback loop', 'continuous feedback', 'iterate'],
    // Núcleo's comment, small, inside the cycle of two arrows (sistema's sync).
    d: (() => {
      const a = arc(12, 12, 9, -150, -25);
      const b = arc(12, 12, 9, 30, 155);
      return [a.d, head(a.end, a.tangent, 3.4), b.d, head(b.end, b.tangent, 3.4), drop(12, 12, 3.75)];
    })(),
  },
  'impact-effort': {
    tags: ['impacto y esfuerzo', 'matriz de priorización', 'cuadrantes', 'impact effort', 'prioritization matrix', '2x2'],
    // Two axes crossing in four quadrants (impact up, effort right); the quick win, top left.
    d: [arrow([12, 20.75], [12, 3.25], 3.4), arrow([3.25, 12], [20.75, 12], 3.4), dot(7.5, 7.5)],
  },
  triage: {
    tags: ['triaje', 'clasificar solicitudes', 'bandeja de entrada', 'triage', 'sort requests', 'intake'],
    // The tray, and three arrows fanning up and out of it, their tails 3 apart; the side heads
    // stand 3 clear of the tray's walls and of the middle arrow.
    d: [TRAY, arrow([9, 17.25], [4.5, 7.25], 3.4), arrow([12, 17.25], [12, 3.75], 3.4), arrow([15, 17.25], [19.5, 7.25], 3.4)],
  },
  backlog: {
    tags: ['backlog', 'pendientes', 'lista priorizada', 'product backlog', 'queue', 'to do'],
    // Three rows, each with its grip at the left end.
    d: BACKLOG,
  },
  'backlog-plus': {
    tags: ['agregar al backlog', 'nueva tarea', 'añadir historia', 'add to backlog', 'new item', 'add story'],
    d: BACKLOG,
    badge: badge('plus'),
  },
  'user-story': {
    tags: ['historia de usuario', 'requisito', 'tarjeta ágil', 'user story', 'story card', 'requirement'],
    // The story's card: the user (resting on its edge) and the goal they want, a flag.
    d: [LAND, circ(7.25, 10.5, 2.25), arc(7.25, 19, 3.75, 180, 360).d, line([14.25, 19], [14.25, 8]), roundpoly([[14.25, 8], [18.5, 8], [17.25, 10], [18.5, 12], [14.25, 12]], [0, 0.6, 0.4, 0.6, 0])],
  },
  epic: {
    tags: ['épica', 'historias', 'trabajo grande', 'epic', 'stories', 'initiative'],
    // The epic's card and the trunk under its left end, branching into three stories (inside a
    // tall card, trunk and rows read as the letter E).
    d: [box(4.75, 2.75, 14.5, 6.5, 2.5), rline([[8.25, 9.25], [8.25, 19], [17.5, 19]], 2), line([8.25, 12.5], [17.5, 12.5]), line([8.25, 15.75], [15.25, 15.75])],
  },
  'story-map': {
    tags: ['mapa de historias', 'recorrido del usuario', 'planeación', 'story map', 'user story map', 'backbone'],
    // The backbone (three cards above the line) and the stories below it: two, one and two.
    // The stories are short rows: as cards, the eight read as a keypad.
    d: (() => {
      const X = [3.25, 10.25, 17.25];
      const story = (x, y) => line([x, y], [x + 3.5, y]);
      return [...X.map((x) => box(x, 3.25, 3.5, 3.5, 1)), line([2.75, 9.75], [21.25, 9.75]), story(X[0], 13), story(X[0], 16.5), story(X[1], 13), story(X[2], 13), story(X[2], 16.5)];
    })(),
  },
  icebox: {
    tags: ['congelador', 'ideas en pausa', 'para después', 'icebox', 'parked ideas', 'on hold'],
    // The tray and a snowflake above it (lugares' crystal: arms and their branches).
    d: (() => {
      const c = [12, 7.75];
      const arms = [90, 30, 150].map((a) => line(polar(...c, 5.5, a), polar(...c, 5.5, a + 180)));
      // Branches 1.6 long: the facing ends of two neighbours stand 2.9 apart
      const branches = [-90, -30, 30, 90, 150, 210].map((a) => head(polar(...c, 3.75, a), [-Math.cos((a * Math.PI) / 180), -Math.sin((a * Math.PI) / 180)], 1.6, 45));
      return [rline([[3.25, 16.25], [3.25, 20.75], [20.75, 20.75], [20.75, 16.25]], [0, 3, 0, 0]), ...arms, ...branches];
    })(),
  },
  sprint: {
    tags: ['sprint', 'iteración', 'ciclo', 'sprint', 'iteration', 'cycle'],
    // An arrow that curls once and carries on to the right.
    d: SPRINT,
  },
  'sprint-check': {
    tags: ['sprint completado', 'cerrar sprint', 'iteración terminada', 'complete sprint', 'sprint done', 'finish iteration'],
    d: SPRINT,
    badge: badge('check'),
  },
  'chart-burndown': {
    tags: ['gráfica burndown', 'trabajo restante', 'sprint', 'burndown chart', 'remaining work', 'burndown'],
    // The axes, the ideal (straight) and the work left, stepping down beside it.
    d: [AXES, line([6.25, 8.5], [15.5, 17.75]), rline([[7, 5], [11, 5], [11, 9], [15, 9], [15, 13], [19, 13], [19, 17]], 1)],
  },
  'chart-burnup': {
    tags: ['gráfica burnup', 'trabajo completado', 'alcance', 'burnup chart', 'completed work', 'scope'],
    // The axes, the scope (flat, near the top) and the work done climbing toward it.
    d: [AXES, line([6.25, 6.25], [20.75, 6.25]), rline([[6.25, 17.75], [10.25, 14.25], [14, 14.25], [19.75, 9.25]], 2.5)],
  },
  'chart-velocity': {
    tags: ['velocidad', 'puntos por sprint', 'comprometido y hecho', 'velocity chart', 'velocity', 'story points'],
    // Three sprints, each a pair of bars (committed and done) on the baseline.
    // Each pair close in height and 4.75 from the next, so they group (committed, then done).
    d: [line([2.75, 20.75], [21.25, 20.75]), ...[[2.75, 10.25], [5.75, 11.75], [10.5, 14.75], [13.5, 15.75], [18.25, 6.25], [21.25, 7.75]].map(([x, y]) => line([x, 20.75], [x, y]))],
  },
  'planning-poker': {
    tags: ['planning poker', 'estimación', 'puntos de historia', 'planning poker', 'estimation', 'story points'],
    // The card behind, fanned to the left; the one in front (on top) asks.
    d: [turnPath(box(5, 4.5, 9.5, 14, 2.25), -12, [9.75, 18.5])],
    badge: (() => {
      const card = box(9.75, 5.75, 10, 14.5, 2.25);
      const q = question(14.75, 8.4, 1.6);
      return own([card, ...q], card, { solid: [card], cut: q });
    })(),
  },
};

// ---------------------------------------------------------------------------------------------
// Fill (DESIGN.md › Fill): by index into d
// ---------------------------------------------------------------------------------------------
const FILL = {
  wireframe: { solid: [0], cut: [1, 2, 3, 4, 5] },
  'wireframe-mobile': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'image-placeholder': { solid: [0], cut: [1, 2] },
  mockup: { solid: [0], cut: [1, 2, 3] },
  'mockup-mobile': { solid: [0], cut: [1, 2, 3] },
  prototype: { solid: [0, 1] },
  moodboard: { solid: [0, 2, 3], cut: [1] },
  'style-guide': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'design-system': { solid: [0], cut: [1, 2] },
  'design-system-sync': { solid: [0], cut: [1, 2] },
  'design-token': { solid: [2], lines: [0, 1] },
  annotation: { solid: [0], cut: [1, 2] },
  handoff: { solid: [0], lines: [1, 2, 3] },
  'handoff-check': { solid: [0], lines: [1, 2, 3] },
  'live-cursors': { solid: [0, 1, 2, 3] },
  easing: { solid: [0], cut: [1, 2, 3] },
  'easing-spring': { solid: [0], cut: [1, 2, 3] },
  'pencil-ruler': { solid: [0], cut: [1, 2, 3, 4] },
  breakpoints: { solid: [0], lines: [1, 2, 3] },
  'thumb-zone': { solid: [0], cut: [1] },
  'double-diamond': { solid: [0, 1] },
  'user-flow': { solid: [0, 2, 4], wire: [1, 3] },
  'drop-off': { solid: [0, 1, 2], wire: [3, 4, 5] },
  'journey-map': { solid: [0, 1, 2], wire: [3, 4, 5, 6, 7] },
  'service-blueprint': { solid: [0], cut: [1, 2, 3, 4] },
  'pain-point': { solid: [0], cut: [1] },
  'use-case': { solid: [0, 1, 3], wire: [2] },
  persona: { solid: [0, 1], lines: [2, 3, 4] },
  'user-interview': { solid: [0], cut: [1, 2] },
  'focus-group': { solid: [0, 1, 2, 3, 4] },
  'usability-test': { solid: [0], cut: [1] },
  'eye-tracking': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'card-sorting': { solid: [0, 2, 4], lines: [1, 3] },
  'tree-test': { solid: [0, 3, 4, 6, 7], wire: [1, 2, 5] },
  'preference-test': { solid: [0, 1] },
  'five-second-test': { solid: [0], cut: [1], lines: [2] },
  'diary-study': { solid: [0], wire: [1, 2, 3] },
  'empathy-map': { solid: [0], cut: [1, 2] },
  insight: { solid: [0], cut: [1, 2] },
  discovery: { solid: [0], lines: [1, 2] },
  brainstorm: { solid: [0] },
  heatmap: { solid: [0], cut: [1, 2] },
  'heatmap-click': { solid: [0], cut: [1, 2, 3, 4] },
  'heatmap-scroll': { solid: [0], cut: [1, 2, 3] },
  'heatmap-move': { solid: [0], cut: [1, 2] },
  'rage-click': { solid: [0], lines: [1, 2, 3] },
  'session-replay': { solid: [2], lines: [0, 1] },
  onboarding: { solid: [0], cut: [1, 2, 3, 4] },
  'product-tour': { solid: [0], cut: [1, 2] },
  'feature-flag': { solid: [1], wire: [0], cut: [2] },
  'feature-flag-clock': { solid: [1], wire: [0], cut: [2] },
  'kill-switch': { solid: [1], wire: [0], cut: [2] },
  rollout: { solid: [0], wire: [1, 2] },
  'lightbulb-question': { solid: [0], lines: [1, 2] },
  'lightbulb-check': { solid: [0], lines: [1, 2] },
  'lightbulb-plus': { solid: [0], lines: [1, 2] },
  'feedback-loop': { solid: [4], lines: [0, 1, 2, 3] },
  backlog: { solid: [0, 1, 2], lines: [3, 4, 5] },
  'backlog-plus': { solid: [0, 1, 2], lines: [3, 4, 5] },
  'user-story': { solid: [0], cut: [1, 2, 3, 4] },
  epic: { solid: [0], wire: [1, 2, 3] },
  'story-map': { solid: [0, 1, 2], lines: [3, 4, 5, 6, 7, 8] },
  'planning-poker': { solid: [0] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
// Open lines only (the dots are solid already): their filled version is the outline itself
for (const name of ['multivariate-test', 'changelog', 'impact-effort', 'sprint', 'sprint-check', 'chart-burndown', 'chart-burnup', 'chart-velocity'])
  icons[name].fill = false;
// What gets filled must be closed: the head closes across the neck, the open trays and the box
// across their top (the tray's arrows and the snowflake stay lines, with their clearance). The
// release's arrow is attached to its box: as a line, its clearance split the box in two and left
// an island beside release-clock's badge
{
  const mm = icons['mental-model'].d;
  icons['mental-model'].fill = { solid: [`${mm[0]}Z`], cut: mm.slice(1) };
  for (const name of ['release', 'release-clock']) {
    const d = icons[name].d;
    icons[name].fill = { solid: [`${d[0]}Z`], wire: [d[1], d[2], d[3]] };
  }
  const t = icons.triage.d;
  icons.triage.fill = { solid: [`${t[0]}Z`], lines: t.slice(1) };
  const ice = icons.icebox.d;
  icons.icebox.fill = { solid: [`${ice[0]}Z`], lines: ice.slice(1) };
}

// ---------------------------------------------------------------------------------------------
// 16 px (DESIGN.md › 16 px): their own drawings where the snap leaves a smudge. On the 16 px grid
// pixel k has its center at 0.75 + 1.5k: lines on those centers stay crisp, diagonals at 45°.
// ---------------------------------------------------------------------------------------------
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...cells) => line(...cells.map(([c, r]) => g(c, r)));
/** A box on whole pixels: from cell (c0, r0) to cell (c1, r1). */
const pbox = (c0, r0, c1, r1, r, square = ['br']) => sq(px(c0), px(r0), px(c1) - px(c0), px(r1) - px(r0), r, { square });
/**
 * The crossed placeholder at 16 px: a panel in the frame's corner (its frame-side edges are the
 * frame's) with its diagonals at 45°; a box of its own left a 4 × 4 interior that the cross clogged.
 */
const pcross = (c0, r0, n, inner) => [inner, pl([c0, r0], [c0 + n, r0 + n]), pl([c0 + n, r0], [c0, r0 + n])];
// The landscape and portrait frames on the grid
const LAND16 = pbox(1, 3, 14, 12, 3.5);
const PORT16 = pbox(3, 1, 12, 14, 3.5);
// The crossed boxes were gray: square, so their diagonals fall at 45° through pixel centers
{
  const d = [LAND16, ...pcross(1, 3, 7, pl([8, 3], [8, 10], [1, 10])), pl([10, 5], [12, 5]), pl([10, 8], [12, 8])];
  icons.wireframe.small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
{
  const d = [PORT16, ...pcross(3, 1, 9, pl([3, 10], [12, 10])), pl([5, 12], [10, 12])];
  icons['wireframe-mobile'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
// The picture over the button: the range at 45° on pixel centers, the sun in its valley
{
  const d = [PORT16, dot(15, 6), rline([g(3, 9), g(7, 5), g(11, 9), g(12, 9)], [0, 0.5, 0.5, 0]), pbox(5, 11, 10, 12, 0.75, [])];
  icons['mockup-mobile'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
// The flag's knob was a gray ring: a ring of one pixel around a pixel
{
  const knob = circ(px(7), px(6), 1.5);
  for (const name of ['feature-flag', 'feature-flag-clock', 'kill-switch']) {
    const [pole, cloth] = icons[name].d;
    icons[name].small = { d: [pole, cloth, knob], fill: { solid: [cloth], wire: [pole], cut: [knob] } };
  }
  icons['feature-flag-clock'].small.badge = badge('clock', { size: 16 });
  // The power sign as the engine's pixel badges are drawn: no ring, a larger sign
  const sign = [arc(17.25, 18, 3.25, -55, 235).d, pl([11, 8], [11, 11])];
  icons['kill-switch'].small.badge = { d: sign, knock: `${circ(17.25, 17.25, 4.25)}${sign.join('')}` };
}
// The eyes: centered on a pixel (0.75 off the canvas's center), the sight's ticks on its row and column
{
  const c = 12.75;
  const eye = transform(EYE, 0.8, c - 12 * 0.8, c - 12 * 0.8);
  const d = [eye, circ(c, c, 1.5), line([c, c - 1.5], [c, 7.5]), line([c, c + 1.5], [c, 18]), line([c + 1.5, c], [17.25, c]), line([c - 1.5, c], [8.25, c])];
  icons['eye-tracking'].small = { d, fill: { solid: [eye], cut: d.slice(1) } };
}
{
  const eye = transform(EYE, 0.6, 12.75 - 12 * 0.6, 12.75 - 12 * 0.6);
  const timer = arc(12.75, 12.75, 8.25, -90, 0).d;
  const d = [eye, dot(12.75, 12.75), timer];
  icons['five-second-test'].small = { d, fill: { solid: [eye], cut: [d[1]], lines: [timer] } };
}
// The hot spot: the inner contour becomes the point at its heart
{
  const d = [PORT16, contour(12.75, 9.75, [4.5, 4.5, 4.25, 4.5, 4.25, 4.5]), dot(12.75, 9.75)];
  icons.heatmap.small = { d, fill: { solid: [d[0]], cut: [d[1], d[2]] } };
}
// The story's card: the user and the goal on whole pixels, the flag's cloth a 3 × 3 square
{
  const d = [LAND16, circ(px(4), px(6), 1.5), arc(px(4), px(12), 3, 180, 360).d, pl([9, 12], [9, 5]), pbox(9, 5, 11, 7, 0.5, [])];
  icons['user-story'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
// The bolt was a blot: a zigzag on pixel centres (two 45° strokes and a level one), cut out of the drop
{
  const d = [N.comment.d[0], pl([9, 4], [6, 7], [9, 7], [6, 10])];
  icons['pain-point'].small = { d, fill: { solid: [d[0]], cut: [d[1]] } };
}
// The ruler's heads and ticks ran together: each on its own pixel column, one row of paper above the frame
{
  const d = [pbox(1, 5, 14, 14, 3), `${pl([1, 2], [14, 2])}${pl([2, 1], [1, 2], [2, 3])}${pl([13, 1], [14, 2], [13, 3])}`, pl([6, 1], [6, 3]), pl([9, 1], [9, 3])];
  icons.breakpoints.small = { d, fill: { solid: [d[0]], lines: d.slice(1) } };
}
// Two ripples instead of three, the pointer's tip on a pixel center
{
  const tip = g(7, 7);
  const d = [cursor(tip, 0.52), arc(...tip, 3, 180, 270).d, arc(...tip, 6, 180, 270).d];
  icons['rage-click'].small = { d, fill: { solid: [d[0]], lines: [d[1], d[2]] } };
}

// ---------------------------------------------------------------------------------------------
// Named parts (DESIGN.md › Named parts)
// ---------------------------------------------------------------------------------------------
const PARTS = {
  wireframe: { page: [0], placeholder: [1, 2, 3], text: [4, 5] },
  'wireframe-mobile': { screen: [0], placeholder: [1, 2, 3], text: [4, 5] },
  'image-placeholder': { frame: [0], cross: [1, 2] },
  mockup: { page: [0, 1], sun: [2], mountain: [3] },
  'mockup-mobile': { screen: [0], sun: [1], mountain: [2], button: [3] },
  prototype: { screens: [0, 1] },
  moodboard: { picture: [0, 1], swatch: [2], tile: [3] },
  'style-guide': { page: [0], swatches: [1, 2, 3], text: [4, 5] },
  'design-system': { book: [0, 1], mark: [2] },
  'design-system-sync': { book: [0, 1], mark: [2] },
  'design-token': { braces: [0, 1], swatch: [2] },
  annotation: { frame: [0], leader: [1, 2] },
  handoff: { design: [0], arrow: [1], code: [2, 3] },
  'handoff-check': { design: [0], arrow: [1], code: [2, 3] },
  'live-cursors': { pointer: [0, 2], tags: [1, 3] },
  easing: { box: [0], curve: [1], ends: [2, 3] },
  'easing-spring': { box: [0], curve: [1], ends: [2, 3] },
  'pencil-ruler': { ruler: [0], ticks: [1, 2, 3, 4] },
  breakpoints: { screen: [0], ruler: [1], marks: [2, 3] },
  'thumb-zone': { screen: [0], reach: [1] },
  'double-diamond': { discover: [0], deliver: [1] },
  'user-flow': { start: [0], arrows: [1, 3], screens: [2, 4] },
  'drop-off': { steps: [0, 1, 2], path: [3, 4], arrow: [5] },
  'journey-map': { moments: [0, 1, 2], line: [3, 4], stages: [5, 6, 7] },
  'pain-point': { bubble: [0], bolt: [1] },
  'service-blueprint': { lanes: [0, 1], path: [2, 3, 4] },
  'use-case': { actor: [0, 1], link: [2], case: [3] },
  persona: { person: [0, 1], attributes: [2, 3, 4] },
  'user-interview': { bubble: [0], mark: [1, 2] },
  'focus-group': { bubble: [0], people: [1, 2, 3, 4] },
  'usability-test': { screen: [0], pointer: [1] },
  'eye-tracking': { eye: [0], pupil: [1], sight: [2, 3, 4, 5] },
  'card-sorting': { stacks: [0, 1, 2, 3], card: [4] },
  'tree-test': { tree: [0, 1, 2, 3, 4, 5, 6], pointer: [7] },
  'preference-test': { options: [0, 1] },
  'five-second-test': { eye: [0, 1], timer: [2] },
  'diary-study': { cover: [0], rings: [1, 2, 3] },
  'empathy-map': { quadrants: [0, 1, 2] },
  insight: { bubble: [0], bulb: [1, 2] },
  'mental-model': { head: [0], ideas: [1, 2, 3, 4, 5, 6] },
  discovery: { bulb: [0], base: [1, 2] },
  brainstorm: { cloud: [0] },
  heatmap: { page: [0], spot: [1, 2] },
  'heatmap-click': { page: [0], clicks: [1, 2, 3], pointer: [4] },
  'heatmap-scroll': { page: [0], folds: [1, 2], chevron: [3] },
  'heatmap-move': { page: [0], trail: [1], pointer: [2] },
  'rage-click': { pointer: [0], ripples: [1, 2, 3] },
  'session-replay': { arrow: [0, 1], pointer: [2] },
  onboarding: { screen: [0], illustration: [1], dots: [2, 3, 4] },
  'product-tour': { screen: [0], tip: [1], spotlight: [2] },
  rollout: { done: [0], arrow: [1, 2] },
  'multivariate-test': { stem: [0], arrows: [1, 2, 3] },
  changelog: { rail: [0], versions: [1, 2, 3], notes: [4, 5, 6] },
  'feedback-loop': { cycle: [0, 1, 2, 3], bubble: [4] },
  'impact-effort': { axes: [0, 1], item: [2] },
  triage: { tray: [0], arrows: [1, 2, 3] },
  'user-story': { card: [0], user: [1, 2], goal: [3, 4] },
  epic: { epic: [0], stories: [1, 2, 3] },
  'story-map': { backbone: [0, 1, 2, 3], stories: [4, 5, 6, 7, 8] },
  icebox: { tray: [0], snowflake: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  'chart-burndown': { axis: [0], ideal: [1], line: [2] },
  'chart-burnup': { axis: [0], scope: [1], line: [2] },
  'chart-velocity': { axis: [0], bars: [1, 2, 3, 4, 5, 6] },
  'planning-poker': { back: [0] },
};
// Families that share a base
for (const name of ['feature-flag', 'feature-flag-clock', 'kill-switch']) PARTS[name] = { pole: [0], flag: [1], knob: [2] };
for (const name of ['lightbulb-question', 'lightbulb-check', 'lightbulb-plus']) PARTS[name] = { bulb: [0], base: [1, 2] };
for (const name of ['release', 'release-clock']) PARTS[name] = { box: [0, 1, 2], arrow: [3] };
for (const name of ['backlog', 'backlog-plus']) PARTS[name] = { rows: [0, 1, 2], grips: [3, 4, 5] };
for (const name of ['sprint', 'sprint-check']) PARTS[name] = { arrow: [0, 1] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ---------------------------------------------------------------------------------------------
// Automatic variants that make no sense (DESIGN.md › Automatic variants)
// ---------------------------------------------------------------------------------------------
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// With a badge or a piece on top: scaled down the badge stops reading, and the slash would cut it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Already a square card: not enclosed in another square
variants(['easing', 'easing-spring', 'image-placeholder', 'service-blueprint'], { square: false });
// A ring, a cycle or a bubble of their own: not enclosed in a circle
variants(['five-second-test', 'insight', 'pain-point', 'session-replay', 'rollout', 'feedback-loop'], { circle: false });
variants(['product-tour'], { square: false });
// A tree and its pointer stop reading at 58 %, and a slash through them says nothing
variants(['tree-test'], { circle: false, square: false, slash: false });
// Loose lines: slashing them says nothing
variants(['double-diamond', 'multivariate-test', 'impact-effort', 'sprint'], { slash: false });

// ---------------------------------------------------------------------------------------------
// Mirroring (DESIGN.md › Mirroring): flows that read left to right
// ---------------------------------------------------------------------------------------------
for (const name of [
  'wireframe', 'prototype', 'handoff', 'handoff-check', 'easing', 'easing-spring', 'annotation', 'user-flow', 'journey-map', 'persona',
  'use-case', 'tree-test', 'changelog', 'backlog', 'backlog-plus', 'user-story', 'epic', 'story-map', 'sprint', 'sprint-check',
  'chart-burndown', 'chart-burnup', 'chart-velocity', 'impact-effort',
])
  icons[name].mirror = true;

// ---------------------------------------------------------------------------------------------
// Motion (DESIGN.md › Motion)
// ---------------------------------------------------------------------------------------------
icons['design-system-sync'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons.handoff.motion = { effect: 'slide', parts: ['arrow'], vector: [1.25, 0] };
icons['live-cursors'].motion = { effect: 'float', vector: [1, -1] };
icons['pencil-ruler'].motion = { effect: 'wiggle', parts: ['badge'], origin: [4.1, 19.9] };
icons['drop-off'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
icons['card-sorting'].motion = { effect: 'bounce', parts: ['card'], vector: [1.5, 1.5] };
icons['usability-test'].motion = { effect: 'slide', parts: ['pointer'], vector: [-1.25, 1.25] };
icons.insight.motion = { effect: 'beat', parts: ['bulb'], origin: [12, 11] };
icons['pain-point'].motion = { effect: 'beat', parts: ['bolt'], origin: [12, 11.75] };
icons.brainstorm.motion = { effect: 'beat', parts: ['badge'], origin: [12, 13] };
icons['rage-click'].motion = { effect: 'beat', parts: ['ripples'], origin: [11.5, 11] };
icons['feature-flag'].motion = { effect: 'wiggle', origin: [4.75, 21.25] };
icons['kill-switch'].motion = { effect: 'beat', parts: ['badge'], origin: [17.25, 17.25] };
icons.rollout.motion = { effect: 'spin', parts: ['arrow'], origin: [12, 12] };
icons['feedback-loop'].motion = { effect: 'spin', parts: ['cycle'], origin: [12, 12] };
icons.triage.motion = { effect: 'slide', parts: ['arrows'], vector: [0, -1.5] };
icons.release.motion = { effect: 'slide', parts: ['arrow'], vector: [0, -2] };
icons.icebox.motion = { effect: 'spin', parts: ['snowflake'], origin: [12, 7.75] };
icons.sprint.motion = { effect: 'slide', vector: [2, 0] };
icons['planning-poker'].motion = { effect: 'wiggle', parts: ['badge'], origin: [14.75, 20.25] };
// A value: the timer's quarter is drawn that far
icons['five-second-test'].value = { draw: ['timer'] };

export default { category: 'producto', label: 'Producto y UX', icons };
