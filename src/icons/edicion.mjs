// Edición y texto (editing and text): clipboard, formatting, alignment, lists, drawing and image
// tools, marks, layers and selection. Everything is computed with engine/geometry.mjs; see DESIGN.md.
import { arc, badge, circ, dot, drop, f, flipPath, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snap, transform } from '../../engine/variants.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────
const xy = ([x, y]) => `${f(x)} ${f(y)}`;
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const unit = (v) => {
  const n = Math.hypot(v[0], v[1]);
  return [v[0] / n, v[1] / n];
};
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Container with the signature corner: a square bottom-right corner. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });

// The same continuous corner as the engine's sq() (0.6 smoothing), for use in polylines.
function corner(r, s = 0.6) {
  const p = (1 + s) * r;
  const a90 = 90 * (1 - s);
  const L = Math.sin(((a90 / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - a90) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L };
}

/**
 * Polyline (open or closed) with rounded corners: continuous at 90° turns and a circular arc
 * everywhere else (`circular`: a circular arc at every turn, like the mountains in
 * dispositivos/image). `r` is one radius or one per vertex (0 = sharp corner).
 */
function rpath(pts, r = 0, { closed = false, circular = false } = {}) {
  const n = pts.length;
  const rad = (i) => (Array.isArray(r) ? r[i] : r);
  const turn = (i) => {
    const V = pts[i];
    const u = unit(sub(V, pts[(i - 1 + n) % n]));
    const v = unit(sub(pts[(i + 1) % n], V));
    const rr = rad(i);
    if (!rr) return [V, ''];
    const cross = u[0] * v[1] - u[1] * v[0];
    const dp = u[0] * v[0] + u[1] * v[1];
    const sweep = cross > 0 ? 1 : 0;
    const rel = (X, Y) => xy([X * u[0] + Y * v[0], X * u[1] + Y * v[1]]);
    if (Math.abs(dp) < 1e-6 && !circular) {
      const k = corner(rr);
      return [add(V, u, -k.p), `c${rel(k.a, 0)} ${rel(k.a + k.b, 0)} ${rel(k.a + k.b + k.c, k.d)}a${f(rr)} ${f(rr)} 0 0 ${sweep} ${rel(k.L, k.L)}c${rel(k.d, k.c)} ${rel(k.d, k.b + k.c)} ${rel(k.d, k.a + k.b + k.c)}`];
    }
    const th = Math.acos(Math.max(-1, Math.min(1, -dp)));
    const t = rr / Math.tan(th / 2);
    return [add(V, u, -t), `A${f(rr)} ${f(rr)} 0 0 ${sweep} ${xy(add(V, v, t))}`];
  };
  if (!closed) {
    let out = `M${xy(pts[0])}`;
    for (let i = 1; i < n - 1; i++) {
      const [S, d] = turn(i);
      out += `L${xy(S)}${d}`;
    }
    return `${out}L${xy(pts[n - 1])}`;
  }
  let out = `M${xy([(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2])}`;
  for (let k = 1; k <= n; k++) {
    const [S, d] = turn(k % n);
    out += `L${xy(S)}${d}`;
  }
  return `${out}Z`;
}

/**
 * The logomark's drop rotated `deg` degrees (0 = square corner at bottom right). At -135 the
 * corner points up: it's the set's liquid drop (the same as lugares/droplet).
 */
function dropAt(cx, cy, r, deg = 0) {
  const c = [cx, cy];
  const R = (x, y) => xy(rot([x, y], c, deg));
  const A = `A${f(r)} ${f(r)} 0 0 1 `;
  return `M${R(cx + r, cy)}L${R(cx + r, cy + r)}L${R(cx, cy + r)}${A}${R(cx - r, cy)}${A}${R(cx, cy - r)}${A}${R(cx + r, cy)}Z`;
}

/** Endpoints of a straight line from a to b, trimmed by `t0` at a and by `t1` at b. */
const trim = (a, b, t0 = 0, t1 = 0) => {
  const u = unit(sub(b, a));
  return [add(a, u, t0), add(b, u, -t1)];
};

/** Numeral 2 in the box (x0, top, w, h). */
function two(x0, top, w, h) {
  const r = w / 2;
  return `${arc(x0 + r, top + r, r, 190, 400).d}L${xy([x0, top + h])}H${f(x0 + w)}`;
}

/** Local frame on an axis at `deg` degrees: P(u, v) = o + u·d + v·n (n is d rotated 90° clockwise). */
const axis = (o, deg) => {
  const d = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const n = [-d[1], d[0]];
  return (u, v = 0) => [o[0] + u * d[0] + v * n[0], o[1] + u * d[1] + v * n[1]];
};

/** Capsule of radius r between centers a and b. */
function capsule(a, b, r) {
  const d = unit(sub(b, a));
  const n = [-d[1], d[0]];
  const A = `A${f(r)} ${f(r)} 0 0 0 `;
  return `M${xy(add(a, n, r))}L${xy(add(b, n, r))}${A}${xy(add(b, n, -r))}L${xy(add(a, n, -r))}${A}${xy(add(a, n, r))}Z`;
}

/** Four-pointed sparkle with concave sides (k = how far the curves open). */
function spark(cx, cy, R, k = 0.9) {
  const pts = [[cx, cy - R], [cx + R, cy], [cx, cy + R], [cx - R, cy]];
  const ctl = [[k, -k], [k, k], [-k, k], [-k, -k]];
  let out = `M${xy(pts[0])}`;
  for (let i = 0; i < 4; i++) out += `Q${xy([cx + ctl[i][0], cy + ctl[i][1]])} ${xy(pts[(i + 1) % 4])}`;
  return `${out}Z`;
}

// ── Reversed paths (for the fill) ──
// `hole()` joins an outline with another one traced in reverse: the inner one stays hollow (the
// set square's window). Whatever stays a line flush with the body in the fill goes in `wire`.
function segments(d) {
  const out = [];
  let p = [0, 0];
  let start = p;
  for (const [, c, args] of transform(d, 1, 0, 0).matchAll(/([MLHVCQAZ])([^MLHVCQAZ]*)/g)) {
    const a = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (c === 'M') {
      p = [a[0], a[1]];
      start = p;
      continue;
    }
    const to = c === 'H' ? [a[0], p[1]] : c === 'V' ? [p[0], a[0]] : c === 'Z' ? start : [a.at(-2), a.at(-1)];
    out.push({ c, a, from: p, to });
    p = to;
  }
  return out;
}
const back = ({ c, a, from }) => {
  if (c === 'C') return `C${xy([a[2], a[3]])} ${xy([a[0], a[1]])} ${xy(from)}`;
  if (c === 'Q') return `Q${xy([a[0], a[1]])} ${xy(from)}`;
  if (c === 'A') return `A${a[0]} ${a[1]} ${a[2]} ${a[3]} ${1 - a[4]} ${xy(from)}`;
  return `L${xy(from)}`;
};
function hole(outer, inner) {
  const segs = segments(inner);
  return `${outer}M${xy(segs.at(-1).to)}${segs.reverse().map(back).join('')}Z`;
}

// Clipboard (the same piece as archivos/clipboard): the clip rests on the straight run of the
// board's top edge.
const CLIP = [
  rpath([[9.15, 4.5], [4.75, 4.5], [4.75, 21.25], [19.25, 21.25], [19.25, 4.5], [14.85, 4.5]], [0, 2.75, 2.75, 0, 2.75, 0]),
  sq(9.15, 2.75, 5.7, 3.5, 1.05),
];
// In the fill the board is closed: its closing segment runs under the clip, which covers it.
const CLIP_SOLID = [`${CLIP[0]}Z`, CLIP[1]];

// Copy: the back sheet ends at its corners, with a 1.5 gap from the front one.
const COPY_BACK = rpath([[13.75, 7.25], [13.75, 3.25], [3.25, 3.25], [3.25, 13.75], [7.25, 13.75]], 2.5);
const COPY_FRONT = box(10.25, 10.25, 10.5, 10.5, 2.5);

// Trash can: a lid with a handle and a closed body below, separated by a 1.5 gap.
const TRASH_LID = [hl(3.5, 20.5, 6), rpath([[9.25, 6], [9.25, 3.25], [14.75, 3.25], [14.75, 6]], 1.25)];
const TRASH_BODY = [box(5.25, 9, 13.5, 12.25, 3.25), vl(9.75, 12.75, 17.5), vl(14.25, 12.75, 17.5)];

// Archive: a wide lid and a body hanging from it.
const ARCHIVE = [sq(2.75, 3.5, 18.5, 4.75, 1.4), rpath([[5.25, 8.25], [5.25, 20.75], [18.75, 20.75], [18.75, 8.25]], [0, 3, 0, 0])];
// In the fill the box is closed: its closing segment runs along the channel that separates it from the lid.
const ARCHIVE_SOLID = [ARCHIVE[0], `${ARCHIVE[1]}Z`];

// Heading: a compact H to pair with a number.
const H_SMALL = [vl(3.75, 5, 19), vl(11.75, 5, 19), hl(3.75, 11.75, 12)];

// Scissors: two eyes and two straight blades; the second passes behind the first.
function scissors() {
  const L = [6.75, 17.25];
  const R = [17.25, 17.25];
  const r = 3.25;
  const tipR = [16.5, 3.25];
  const tipL = [7.5, 3.25];
  const a0 = add(L, unit(sub(tipR, L)), r);
  const b0 = add(R, unit(sub(tipL, R)), r);
  // the blades cross at x = 12
  const t = (12 - a0[0]) / (tipR[0] - a0[0]);
  const X = [12, a0[1] + t * (tipR[1] - a0[1])];
  const ub = unit(sub(tipL, b0));
  const ua = unit(sub(tipR, a0));
  const sin = Math.abs(ua[0] * ub[1] - ua[1] * ub[0]);
  const gap = 3 / sin;
  return [circ(...L, r), circ(...R, r), line(a0, tipR), line(b0, add(X, ub, -gap)), line(add(X, ub, gap), tipL)];
}

// Open lid: the trash can's lid rotated 10° on its left end, which drops 0.5 so the handle stays
// inside the live area (the end keeps more than a 1.5 gap from the body).
function trashLidOpen() {
  const c = [3.5, 6.5];
  const R = (p) => rot([p[0], p[1] + 0.5], c, -10);
  return [line(R([3.5, 6]), R([20.5, 6])), rpath([[9.25, 6], [9.25, 3.25], [14.75, 3.25], [14.75, 6]].map(R), 1.25)];
}

// Rotate: the piece and a concentric arc that wraps around it from above.
function rotateIcon(cw) {
  const a = cw ? arc(8, 15, 10.25, -118, 0) : arc(16, 15, 10.25, -62, -180);
  return [box(cw ? 3.25 : 11.25, 10.25, 9.5, 9.5, 2.25), a.d, head(a.end, a.tangent, 3.4)];
}

// Cut line or axis: three 3.5 dashes with 3.5 between them, the middle one centered (dashes
// shorter than 2 were fragments and turned into noise at 16 px).
const DASHES = [[3.25, 6.75], [10.25, 13.75], [17.25, 20.75]];

// Flip: the triangle, the dashed axis and its reflection (the legs 3 from the axis).
const FLIP = [
  [[[9, 5.75], [9, 18.25], [3, 18.25]], [1, 1.5, 1]],
  [[[15, 5.75], [21, 18.25], [15, 18.25]], [1, 1, 1.5]],
];
function flip(deg) {
  const R = (p) => rot(p, [12, 12], deg);
  const [left, right] = FLIP.map(([pts, r]) => rpath(pts.map(R), r, { closed: true }));
  return [left, ...DASHES.map(([a, b]) => line(R([12, a]), R([12, b]))), right];
}

// Palette: a circle with a thumb notch and four paint wells with a 1.5 gap between them.
function palette() {
  const R = 9;
  const rn = 2.75;
  const a = 45;
  const th = (Math.acos((2 * R * R - rn * rn) / (2 * R * R)) * 180) / Math.PI;
  const main = arc(12, 12, R, a + th, a - th + 360);
  const N = polar(12, 12, R, a);
  const P1 = polar(12, 12, R, a + th);
  const ang = (p) => (Math.atan2(p[1] - N[1], p[0] - N[0]) * 180) / Math.PI;
  const a2 = ang(main.end);
  const cw = (((ang(P1) - a2) % 360) + 360) % 360;
  const inside = (((a + 180 - a2) % 360) + 360) % 360 < cw;
  const span = inside ? cw : 360 - cw;
  const notch = `A${f(rn)} ${f(rn)} 0 ${span > 180 ? 1 : 0} ${inside ? 1 : 0} ${xy(P1)}Z`;
  return [`${main.d}${notch}`, ...[145, 197, 249, 301].map((g) => dot(...polar(12, 12, 5.25, g)))];
}

// Drafting compass: a hinge, two radial legs and the arc that joins them.
function compass() {
  const hc = [12, 6.25];
  const hr = 2.25;
  const tips = [[5.25, 20.75], [18.75, 20.75]];
  const ang = (p) => (Math.atan2(p[1] - hc[1], p[0] - hc[0]) * 180) / Math.PI;
  return [circ(...hc, hr), vl(12, 2, 4), ...tips.map((t) => line(add(hc, unit(sub(t, hc)), hr), t)), arc(...hc, 10, ang(tips[1]), ang(tips[0])).d];
}

// Paint bucket: tilted 45°, with the lip on its rim and the set's drop (the one in
// lugares/droplet) falling from the pouring side. No handle: over the opening it looked like a lid.
function bucket() {
  const C = [10, 10.25];
  const R = (p) => rot([C[0] + p[0], C[1] + p[1]], C, 45);
  return [
    rpath([[-5, -4.75], [-4, 5.25], [4, 5.25], [5, -4.75]].map(R), [0, 2.25, 2.25, 0]),
    line(R([-6, -4.75]), R([6, -4.75])),
    dropAt(18.25, 17.75, 2.1, -135),
  ];
}

// Núcleo's pencil (tip, cone, body, ferrule and round eraser) along 45°. `cut` opens the body
// between u1 and u2 so a diagonal can pass through.
function pencil(tip, L = 20.5, { w = 4.2, cut } = {}) {
  const P = axis(tip, -45);
  const h = w / 2;
  const cone = w;
  const band = L - 3.4;
  const cap = `A${f(h)} ${f(h)} 0 0 1 `;
  if (!cut)
    return [`M${xy(tip)}L${xy(P(cone, -h))}L${xy(P(L, -h))}${cap}${xy(P(L, h))}L${xy(P(cone, h))}Z`, line(P(cone, -h), P(cone, h)), line(P(band, -h), P(band, h))];
  const [u1, u2] = cut;
  return [
    `M${xy(P(u1, -h))}L${xy(P(cone, -h))}L${xy(tip)}L${xy(P(cone, h))}L${xy(P(u1, h))}`,
    line(P(cone, -h), P(cone, h)),
    `M${xy(P(u2, -h))}L${xy(P(L, -h))}${cap}${xy(P(L, h))}L${xy(P(u2, h))}`,
    line(P(band, -h), P(band, h)),
  ];
}

// Heart: two lobes of r 4.75 and straight tangents down to the tip.
function heart() {
  const r = 4.75;
  const L = [7.5, 8.75];
  const T = [12, 20.5];
  const base = (Math.atan2(T[1] - L[1], T[0] - L[0]) * 180) / Math.PI;
  const phi = (Math.acos(r / Math.hypot(T[0] - L[0], T[1] - L[1])) * 180) / Math.PI;
  const tl = polar(...L, r, base + phi);
  const cusp = [12, L[1] - Math.sqrt(r * r - (12 - L[0]) ** 2)];
  const A = `A${f(r)} ${f(r)} 0 1 1 `;
  return `M${xy(T)}L${xy(tl)}${A}${xy(cusp)}${A}${xy([24 - tl[0], tl[1]])}Z`;
}

// Five-pointed star with softened points.
const STAR = (() => {
  const pts = Array.from({ length: 10 }, (_, i) => polar(12, 12.4, i % 2 ? 4.75 : 9.5, -90 + i * 36));
  return rpath(pts, pts.map((_, i) => (i % 2 ? 0.75 : 1.5)), { closed: true });
})();

// Half star (rating): the same star split along its axis. The right half is an open path from
// the top point to the bottom notch (its rounded corners are split in half, on the axis); the
// left half is its reflection, closed along the axis (the one that gets filled). On its own, the
// left half read as a «1».
const STAR_HALVES = (() => {
  const pts = Array.from({ length: 10 }, (_, i) => polar(12, 12.4, i % 2 ? 4.75 : 9.5, -90 + i * 36));
  const bend = (i) => {
    const r = i % 2 ? 0.75 : 1.5;
    const V = pts[i];
    const u = unit(sub(V, pts[(i + 9) % 10]));
    const v = unit(sub(pts[(i + 1) % 10], V));
    const th = Math.acos(Math.max(-1, Math.min(1, -(u[0] * v[0] + u[1] * v[1]))));
    const t = r / Math.tan(th / 2);
    const w = unit(sub(v, u));
    const C = add(V, w, r / Math.sin(th / 2));
    return { r, S: add(V, u, -t), E: add(V, v, t), mid: add(C, w, -r), sweep: u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0 };
  };
  // The right half; `flip` mirrors it (x → 24 − x) and reverses the sweep of each arc.
  const half = (flip) => {
    const m = ([x, y]) => (flip ? [24 - x, y] : [x, y]);
    const A = (k, to) => `A${f(k.r)} ${f(k.r)} 0 0 ${flip ? 1 - k.sweep : k.sweep} ${xy(m(to))}`;
    const top = bend(0);
    const low = bend(5);
    let d = `M${xy(m(top.mid))}${A(top, top.E)}`;
    for (let i = 1; i < 5; i++) {
      const k = bend(i);
      d += `L${xy(m(k.S))}${A(k, k.E)}`;
    }
    return `${d}L${xy(m(low.S))}${A(low, low.mid)}`;
  };
  return [`${half(true)}Z`, half(false)];
})();

// Bookmark: a ribbon with a V notch.
const BOOKMARK = rpath([[5.75, 20.75], [5.75, 3.25], [18.25, 3.25], [18.25, 20.75], [12, 16]], [1, 3, 3, 1, 1.5], { closed: true });

// Flag: the pennant from sistema/flag-report (pole and a swallowtail end).
const FLAG = [vl(4.75, 3.25, 21.25), roundpoly([[4.75, 3.25], [19.75, 3.25], [16.25, 9.13], [19.75, 15], [4.75, 15]], [0, 0.9, 0.6, 0.9, 0])];

// Download and upload tray: a U with the signature corner at bottom right.
const TRAY = rpath([[3.25, 14], [3.25, 20.75], [20.75, 20.75], [20.75, 14]], [0, 3, 0, 0]);

// Selection: the corners and dashes of a dashed frame (dashes of 3 with 3.25 spacing).
const MARQUEE = [
  rpath([[3.25, 7.25], [3.25, 3.25], [7.25, 3.25]], 2),
  rpath([[16.75, 3.25], [20.75, 3.25], [20.75, 7.25]], 2),
  rpath([[20.75, 16.75], [20.75, 20.75], [16.75, 20.75]], 2),
  rpath([[7.25, 20.75], [3.25, 20.75], [3.25, 16.75]], 2),
  hl(10.5, 13.5, 3.25),
  hl(10.5, 13.5, 20.75),
  vl(3.25, 10.5, 13.5),
  vl(20.75, 10.5, 13.5),
];

// Lasso: a dashed ellipse that starts at the knot, and the rope that drops and curls to the right.
// Five dashes spread by arc length with the selection frame's gap (3.25): with more, they break
// down into noise at 16 px.
function lasso() {
  const c = [13, 9.25];
  const rx = 8;
  const ry = 5.5;
  const t0 = 140;
  const E = (t) => [c[0] + rx * Math.cos((t * Math.PI) / 180), c[1] + ry * Math.sin((t * Math.PI) / 180)];
  const ts = [];
  const len = [0];
  for (let i = 0; i <= 720; i++) {
    ts.push(t0 + i / 2);
    if (i) len.push(len[i - 1] + Math.hypot(...sub(E(ts[i]), E(ts[i - 1]))));
  }
  const at = (s) => ts[len.findIndex((l) => l >= s)];
  const P = len[len.length - 1];
  const n = 5;
  const gap = 3.25;
  const dash = P / n - gap;
  const dashes = Array.from({ length: n }, (_, i) => `M${xy(E(at(i * (dash + gap))))}A${rx} ${ry} 0 0 1 ${xy(E(at(i * (dash + gap) + dash)))}`);
  return [...dashes, `M${xy(E(t0))}C5.25 15.25 4 17 4 18.5C4 20.25 5.5 21 7.5 21`];
}

// Search in text: lines of text that stop with a 1.5 gap from the magnifier.
function textSearch() {
  const c = [15.75, 15.75];
  const r = 3.75;
  const k = r + 3;
  const lines = [5.25, 9.75, 14.25, 18.75].map((y) => {
    const dy = Math.abs(y - c[1]);
    return hl(3.25, dy >= k ? 20.75 : c[0] - Math.sqrt(k * k - dy * dy), y);
  });
  return [...lines, circ(...c, r), line(polar(...c, r, 45), [20.75, 20.75])];
}

// Network share: three nodes and two links that touch their edges.
function shareNodes() {
  const r = 2.5;
  const A = [6.25, 12];
  const nodes = [[17.75, 5.5], [17.75, 18.5]];
  return [circ(...A, r), ...nodes.map((n) => circ(...n, r)), ...nodes.map((n) => line(...trim(A, n, r, r)))];
}

// Opening quotes: two commas with the ball at the bottom and a tail that rises and opens to the
// right (the outer arc is tangent to the ball; the inner face curves back into it).
function comma(x, y, r = 2.6) {
  const L = [x - r, y];
  const T = [x + 2, y - 7];
  const R = ((T[0] - L[0]) ** 2 + (T[1] - L[1]) ** 2) / (2 * (T[0] - L[0]));
  return `M${xy(L)}A${f(R)} ${f(R)} 0 0 1 ${xy(T)}Q${xy([x + 0.6, y - 3.6])} ${xy(polar(x, y, r, -55))}A${f(r)} ${f(r)} 0 1 1 ${xy(L)}Z`;
}

// Capital A with a crossbar, for the text size icons.
const A_BIG = [line([3.25, 19.25], [9.25, 4.75], [15.25, 19.25]), hl(5.32, 13.18, 14.25)];

// Vector path: three square nodes joined by segments that touch their edges.
function vectorPath() {
  const nodes = [[5.5, 17.5], [12, 6.5], [18.5, 15.5]];
  const exit = (a, b) => 2 / Math.max(...unit(sub(b, a)).map(Math.abs));
  return [
    ...nodes.map(([x, y]) => sq(x - 2, y - 2, 4, 4, 1.1)),
    line(...trim(nodes[0], nodes[1], exit(nodes[0], nodes[1]), exit(nodes[0], nodes[1]))),
    line(...trim(nodes[1], nodes[2], exit(nodes[1], nodes[2]), exit(nodes[1], nodes[2]))),
  ];
}

// Layer order: the planes from nucleo/layers (the top one whole and the edge of the one below) and
// an arrow to their right that shows which way the object moves.
function layerOrder(up) {
  const c = [8.5, 9.25];
  const w = 6.25;
  const h = 4;
  const k = 4.5;
  const x = 18.75;
  const [y0, y1] = up ? [19.75, 4.25] : [4.25, 19.75];
  return [
    roundpoly([[c[0], c[1] - h], [c[0] + w, c[1]], [c[0], c[1] + h], [c[0] - w, c[1]]], 1.2),
    line([c[0] - w, c[1] + k], [c[0], c[1] + h + k], [c[0] + w, c[1] + k]),
    vl(x, y0, y1),
    head([x, y1], [0, up ? -1 : 1], 3.5),
  ];
}

// Text direction: a compact pilcrow and an arrow below it.
const PILCROW_SMALL = ['M12.25 8.75H10.5A2.75 2.75 0 0 1 10.5 3.25H17.25', vl(12.25, 3.25, 12.75), vl(15.75, 3.25, 12.75)];

// Indent: lines of text and a short arrow in the gap left by the two middle ones.
const INDENT_LINES = [hl(3.75, 20.25, 5.25), hl(11, 20.25, 9.75), hl(11, 20.25, 14.25), hl(3.75, 20.25, 18.75), hl(3.75, 7.75, 12)];

// ── Round 3 helpers: dashed outlines, split squircles and the design-tool pieces ──
/**
 * A polyline with circular corners as measurable pieces (lines and arcs), so it can be dashed:
 * `r` is one radius or one per vertex. Each piece knows where it starts along the track (`s`).
 */
function track(pts, r = 0, closed = false) {
  const n = pts.length;
  const rad = (i) => (Array.isArray(r) ? r[i] : r);
  const turns = pts.map((V, i) => {
    if (!closed && (i === 0 || i === n - 1)) return { S: V, E: V };
    const u = unit(sub(V, pts[(i - 1 + n) % n]));
    const v = unit(sub(pts[(i + 1) % n], V));
    const cross = u[0] * v[1] - u[1] * v[0];
    const phi = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    if (!rad(i) || phi < 1e-6) return { S: V, E: V };
    const t = rad(i) * Math.tan(phi / 2);
    const S = add(V, u, -t);
    const C = add(S, cross > 0 ? [-u[1], u[0]] : [u[1], -u[0]], rad(i));
    return { S, E: add(V, v, t), arc: { C, r: rad(i), sweep: cross > 0 ? 1 : 0, len: rad(i) * phi } };
  });
  const out = [];
  let s = 0;
  const push = (p) => {
    if (p.len < 1e-6) return;
    out.push({ ...p, s });
    s += p.len;
  };
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = turns[i].E;
    const nx = turns[(i + 1) % n];
    push({ kind: 'L', a, b: nx.S, len: Math.hypot(...sub(nx.S, a)) });
    if (nx.arc) push({ kind: 'A', a: nx.S, b: nx.E, ...nx.arc });
  }
  out.total = s;
  out.closed = closed;
  return out;
}
/** The point at `s` along a piece of a track. */
function along(p, s) {
  if (p.kind === 'L') return add(p.a, unit(sub(p.b, p.a)), s);
  const a0 = Math.atan2(p.a[1] - p.C[1], p.a[0] - p.C[0]) + ((p.sweep ? 1 : -1) * s) / p.r;
  return [p.C[0] + p.r * Math.cos(a0), p.C[1] + p.r * Math.sin(a0)];
}
/** The stretch of a track between s0 and s1 (wrapping around a closed one) as a path. */
function stretch(tr, s0, s1) {
  const T = tr.total;
  if (tr.closed) {
    const k = Math.floor(s0 / T) * T;
    [s0, s1] = [s0 - k, s1 - k];
  }
  const parts = tr.closed && s1 > T ? [[s0, T], [0, s1 - T]] : [[s0, Math.min(s1, T)]];
  let d = '';
  for (const [lo0, hi0] of parts)
    for (const p of tr) {
      const lo = Math.max(lo0, p.s);
      const hi = Math.min(hi0, p.s + p.len);
      if (hi <= lo + 1e-6) continue;
      if (!d) d = `M${xy(along(p, lo - p.s))}`;
      const e = xy(along(p, hi - p.s));
      d += p.kind === 'L' ? `L${e}` : `A${f(p.r)} ${f(p.r)} 0 ${(hi - lo) / p.r > Math.PI ? 1 : 0} ${p.sweep} ${e}`;
    }
  return d;
}
/** `n` dashes around a closed track, `gap` apart, the first one centered at `mid` (arc length). */
function ring(tr, n, gap, mid = 0) {
  const period = tr.total / n;
  const dash = period - gap;
  return Array.from({ length: n }, (_, i) => stretch(tr, mid + i * period - dash / 2, mid + i * period + dash / 2));
}
/** `n` dashes along an open track, `gap` apart, leaving `inset` free at each end. */
function run(tr, n, gap, inset = 0) {
  const dash = (tr.total - 2 * inset - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => stretch(tr, inset + i * (dash + gap), inset + i * (dash + gap) + dash));
}
/** Arc length of the middle of the k-th arc of a track (its k-th rounded corner). */
const cornerAt = (tr, k) => {
  const p = tr.filter((q) => q.kind === 'A')[k];
  return p.s + p.len / 2;
};
/**
 * A dotted outline (r 0.3 dots, as in the border grids) along a closed track: a dot on each corner
 * (the middle of its arc, or the vertex of a square corner) and the rest spread evenly between them,
 * at least `step` apart, so every side carries the same pattern.
 */
function dotted(tr, step = 2.9) {
  const anchors = tr.flatMap((p, i) => (p.kind === 'A' ? [p.s + p.len / 2] : tr[(i + 1) % tr.length].kind === 'L' ? [(p.s + p.len) % tr.total] : [])).sort((a, b) => a - b);
  return anchors.flatMap((s0, i) => {
    const s1 = anchors[i + 1] ?? anchors[0] + tr.total;
    const m = Math.max(1, Math.floor((s1 - s0) / step));
    return Array.from({ length: m }, (_, j) => {
      const s = (s0 + (j * (s1 - s0)) / m) % tr.total;
      const p = tr.find((q) => s >= q.s - 1e-9 && s <= q.s + q.len + 1e-9);
      return dot(...along(p, s - p.s), 0.3);
    });
  });
}

/**
 * The continuous-corner square of sq() (smoothing 0.6, no signature: a swatch, not a container)
 * split along its TR–BL diagonal: the whole outline, the diagonal, the upper-left half closed (what
 * the fill fills) and the middle of each corner. The same curves as sq(), written corner by corner.
 */
function squircle(x, y, w, h, r) {
  const k = corner(r);
  const beta = (27 * Math.PI) / 180;
  const frames = { tr: [[x + w, y], [1, 0], [0, 1]], br: [[x + w, y + h], [0, 1], [-1, 0]], bl: [[x, y + h], [-1, 0], [0, -1]], tl: [[x, y], [0, -1], [1, 0]] };
  const c = {};
  for (const [name, [V, u, v]] of Object.entries(frames)) {
    const P = (X, Y) => [V[0] + (X - k.p) * u[0] + Y * v[0], V[1] + (X - k.p) * u[1] + Y * v[1]];
    const A1 = P(k.a + k.b + k.c, k.d);
    const A2 = P(k.a + k.b + k.c + k.L, k.d + k.L);
    const C = [A1[0] + r * (-Math.sin(beta) * u[0] + Math.cos(beta) * v[0]), A1[1] + r * (-Math.sin(beta) * u[1] + Math.cos(beta) * v[1])];
    const M = [C[0] + r * Math.SQRT1_2 * (u[0] - v[0]), C[1] + r * Math.SQRT1_2 * (u[1] - v[1])];
    const A = (to) => `A${f(r)} ${f(r)} 0 0 1 ${xy(to)}`;
    c[name] = {
      S: P(0, 0),
      M,
      first: `C${xy(P(k.a, 0))} ${xy(P(k.a + k.b, 0))} ${xy(A1)}${A(M)}`,
      second: `${A(A2)}C${xy(P(k.p, k.d + k.L + k.c))} ${xy(P(k.p, k.d + k.L + k.b + k.c))} ${xy(P(k.p, k.p))}`,
    };
  }
  const L = (n) => `L${xy(c[n].S)}`;
  const whole = `M${xy(c.tr.S)}${c.tr.first}${c.tr.second}${L('br')}${c.br.first}${c.br.second}${L('bl')}${c.bl.first}${c.bl.second}${L('tl')}${c.tl.first}${c.tl.second}Z`;
  const upper = `M${xy(c.bl.M)}${c.bl.second}${L('tl')}${c.tl.first}${c.tl.second}${L('tr')}${c.tr.first}Z`;
  return { whole, upper, diagonal: line(c.tr.M, c.bl.M), corners: c };
}

/** A brick (datos/component): its body with the signature corner and its studs, open at the base. */
function brick(x, y, w, h, r, studs, sh, rs) {
  return [box(x, y, w, h, r), ...studs.map(([sx, sw]) => rpath([[sx, y], [sx, y - sh], [sx + sw, y - sh], [sx + sw, y]], [0, rs, rs, 0], { circular: true }))];
}
// datos/component, the same brick.
const COMPONENT = brick(3.25, 8.5, 17.5, 10.75, 3.25, [[6.25, 4], [13.75, 4]], 3.25, 1.25);

// Layer order to the end of the stack: bring-forward's planes and an arrow that stops 3 short of a
// bar, a step further right than bring-forward's so its head clears the planes. Drawn pointing up and
// flipped for the bottom, so both share every measurement.
function layerEnd(up) {
  const [top, low] = layerOrder(true);
  const arrow = [vl(19.75, 19.75, 6.25), head([19.75, 6.25], [0, -1], 3.5), hl(17.5, 22, 3.25)];
  return [top, low, ...(up ? arrow : arrow.map((d) => flipPath(d, 'y')))];
}

// Ungroup: group's circle and square pulled apart on the diagonal, each in its own frame of three
// corner marks (the fourth, where they parted, is left open). The marks clear the shapes by 3.
function ungroup() {
  const mark = (pts) => rpath(pts, 1.5);
  return [
    mark([[2.25, 5], [2.25, 2.25], [5, 2.25]]),
    mark([[9.5, 2.25], [12.25, 2.25], [12.25, 5]]),
    mark([[2.25, 9.5], [2.25, 12.25], [5, 12.25]]),
    circ(7.25, 7.25, 2),
    mark([[19, 11.75], [21.75, 11.75], [21.75, 14.5]]),
    mark([[21.75, 19], [21.75, 21.75], [19, 21.75]]),
    mark([[11.75, 19], [11.75, 21.75], [14.5, 21.75]]),
    sq(14.75, 14.75, 4, 4, 1.2),
  ];
}

// Flatten: two planes above (a plane and the edge of the one below it) and the single plane they
// press into, the arrow at their side. The planes keep 3 between them at their closest.
function flatten() {
  const c = [8.5, 6.25];
  const [w, h] = [5.75, 3];
  return [
    roundpoly([[c[0], c[1] - h], [c[0] + w, c[1]], [c[0], c[1] + h], [c[0] - w, c[1]]], 1.1),
    line([c[0] - w, c[1] + 3.5], [c[0], c[1] + h + 3.5], [c[0] + w, c[1] + 3.5]),
    roundpoly([[12, 14.75], [20.75, 18], [12, 21.25], [3.25, 18]], 1.4),
    vl(18.75, 3.75, 13.25),
    head([18.75, 13.25], [0, 1], 3),
  ];
}

// Instance: a solid brick in front of the main it copies, a dashed silhouette behind it at the top left.
function componentInstance() {
  const back = track([[16.75, 6.75], [16.75, 3.25], [3.25, 3.25], [3.25, 14.25]], [0, 3, 3, 0]);
  return [...brick(7.25, 12.25, 13.5, 8.5, 2.5, [[9.75, 3], [15.25, 3]], 2.5, 1), ...run(back, 5, 3)];
}

// Variants: two bricks of a component set stacked 3.5 apart. A dashed frame around them left bricks
// 3 tall, a smudge at 18 px; without it each brick keeps the proportions of datos/component.
function componentVariants() {
  const studs = [[6.75, 3], [14.25, 3]];
  return [...brick(4.5, 6, 15, 4.25, 1.5, studs, 2.25, 1), ...brick(4.5, 16, 15, 4.25, 1.5, studs, 2.25, 1)];
}

// Detach: the brick split down the middle, each half (one stud) pulled 1.75 aside.
function componentDetach() {
  const m = (pts, dx) => pts.map(([x, y]) => [x + dx, y]);
  return [
    rpath(m([[12, 19], [4.5, 19], [4.5, 8.5], [6.5, 8.5], [6.5, 5.5], [10, 5.5], [10, 8.5], [12, 8.5]], -1.75), [0, 3, 3, 0, 1.25, 1.25, 0, 0]),
    rpath(m([[12, 8.5], [14, 8.5], [14, 5.5], [17.5, 5.5], [17.5, 8.5], [19.5, 8.5], [19.5, 19], [12, 19]], 1.75), [0, 0, 1.25, 1.25, 0, 3, 0, 0]),
  ];
}

// Swap: the brick between the two arrows of navegacion/swap-horizontal, one above it going right and
// one below going left. Straight arrows leave the brick 6.75 tall (arcs squashed it to 4); the heads
// clear the studs and the body's corner by 3.
function componentSwap() {
  return [...brick(5.5, 9.5, 13, 6.75, 2.25, [[7.75, 3], [13.25, 3]], 2.25, 1), hl(3.5, 20.5, 3.75), head([20.5, 3.75], [1, 0], 2.25), hl(20.5, 3.5, 20.25), head([3.5, 20.25], [-1, 0], 2.25)];
}

// Boolean operations: two squares of 12 that overlap by 6.5 on the diagonal. Where an edge of one
// meets the other the corner is sharp; the squares' own corners keep their radius.
const BOOL = (() => {
  const A = [[15.25, 8.75], [15.25, 3.25], [3.25, 3.25], [3.25, 15.25], [8.75, 15.25]];
  const B = [[15.25, 8.75], [20.75, 8.75], [20.75, 20.75], [8.75, 20.75], [8.75, 15.25]];
  // The overlap dashed, from one crossing to the other: a dash on each of its rounded corners, 3
  // clear of where the outlines cross
  const overlapTrack = track([[15.25, 8.75], [15.25, 15.25], [8.75, 15.25], [8.75, 8.75]], [0, 3, 0, 3], true);
  const half = overlapTrack.total / 2;
  return {
    union: rpath([[3.25, 3.25], [15.25, 3.25], [15.25, 8.75], [20.75, 8.75], [20.75, 20.75], [8.75, 20.75], [8.75, 15.25], [3.25, 15.25]], [3, 3, 0.75, 3, 3, 3, 0.75, 3], { closed: true, circular: true }),
    aRest: rpath([[3.25, 3.25], [15.25, 3.25], [15.25, 8.75], [8.75, 8.75], [8.75, 15.25], [3.25, 15.25]], [3, 3, 0.75, 3, 0.75, 3], { closed: true, circular: true }),
    bRest: rpath([[15.25, 8.75], [20.75, 8.75], [20.75, 20.75], [8.75, 20.75], [8.75, 15.25], [15.25, 15.25]], [0.75, 3, 3, 3, 0.75, 3], { closed: true, circular: true }),
    overlap: rpath([[8.75, 8.75], [15.25, 8.75], [15.25, 15.25], [8.75, 15.25]], [3, 0.75, 3, 0.75], { closed: true, circular: true }),
    aTrack: track(A, [0, 3, 3, 3, 0]),
    bTrack: track(B, [0, 3, 3, 3, 0]),
    overlapDashes: [stretch(overlapTrack, 3, half - 3), stretch(overlapTrack, half + 3, 2 * half - 3)],
  };
})();

// Bezier curve: an S between two square nodes; each node's handle runs out the other side of it, to
// a dot (the curve leaves along the same line).
function bezier() {
  const [A, B] = [[5.5, 15.5], [18.5, 8.5]];
  const s = 1.75;
  return [
    `M${xy([A[0], A[1] - s])}C${xy([A[0], 3.5])} ${xy([B[0], 20.5])} ${xy([B[0], B[1] + s])}`,
    sq(A[0] - s, A[1] - s, 2 * s, 2 * s, 1),
    sq(B[0] - s, B[1] - s, 2 * s, 2 * s, 1),
    vl(A[0], A[1] + s, 20.5),
    vl(B[0], B[1] - s, 3.5),
    dot(A[0], 20.5),
    dot(B[0], 3.5),
  ];
}

// Smooth node: a round node on a curve, its tangent handle across it with a dot at each end. The
// curve runs behind node and handle: it shows only where it stands 3 clear of them.
function nodeSmooth() {
  const c = [12, 8.5];
  // Each side leaves the knockout along the arc's slope and flares out level at the foot, like a bell
  const side = (s) => {
    const P = (x, y) => xy([c[0] + s * x, y]);
    return `M${P(3.9, 11.91)}C${P(4.9, 13.65)} ${P(6.25, 19.75)} ${P(8.75, 19.75)}`;
  };
  return [circ(...c, 2), hl(4.25, c[0] - 2, c[1]), hl(c[0] + 2, 19.75, c[1]), dot(4.25, c[1]), dot(19.75, c[1]), side(-1), side(1)];
}

// Paths: one S curve (a cubic) for join and break. `cut()` splits it where it leaves a node's box.
const S_CURVE = [[3.25, 20.75], [9, 20.75], [15, 3.25], [20.75, 3.25]];
const cubicAt = (P, t) => [0, 1].map((k) => (1 - t) ** 3 * P[0][k] + 3 * t * (1 - t) ** 2 * P[1][k] + 3 * t * t * (1 - t) * P[2][k] + t ** 3 * P[3][k]);
/** The part of a cubic between t0 and t1 (de Casteljau), as a path. */
function cubicPart(P, t0, t1) {
  const split = (Q, t) => {
    const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const [a, b, c] = [L(Q[0], Q[1]), L(Q[1], Q[2]), L(Q[2], Q[3])];
    const [d, e] = [L(a, b), L(b, c)];
    const m = L(d, e);
    return [[Q[0], a, d, m], [m, e, c, Q[3]]];
  };
  const right = split(P, t0)[1];
  const Q = split(right, (t1 - t0) / (1 - t0))[0];
  return `M${xy(Q[0])}C${xy(Q[1])} ${xy(Q[2])} ${xy(Q[3])}`;
}
/** Where the curve leaves the square box of half-side h around its point at t, going forward or back. */
function exitAt(P, t, h, dir) {
  const [cx, cy] = cubicAt(P, t);
  let u = t;
  while (u > 0 && u < 1) {
    const [x, y] = cubicAt(P, u);
    if (Math.abs(x - cx) > h || Math.abs(y - cy) > h) return u;
    u += dir * 0.001;
  }
  return u;
}
function pathNodes(ts, h = 2.25) {
  const nodes = ts.map((t) => {
    const [x, y] = cubicAt(S_CURVE, t);
    return sq(x - h, y - h, 2 * h, 2 * h, 1.1);
  });
  return { nodes, out: (t, dir) => exitAt(S_CURVE, t, h, dir) };
}

// Offset path: a rounded triangle and its copy 3 out, dashed. Both are offsets of one triangle of
// arc centers (side 8): the shape at 1.5 and the copy at 4.5, so they stay exactly 3 apart.
function pathOffset() {
  const C = [[12, 8.5], [16, 15.43], [8, 15.43]];
  const out = (k) => C.map(([x, y]) => [12 + (x - 12) + ((x - 12) / Math.hypot(x - 12, y - 13.12)) * k * 2, y + ((y - 13.12) / Math.hypot(x - 12, y - 13.12)) * k * 2]);
  const outer = track(out(4.5), 4.5, true);
  return [roundpoly(out(1.5), 1.5), ...ring(outer, 8, 3, cornerAt(outer, 0))];
}

// Constrain proportions: the height and the width as one pair of dimension lines meeting at the
// bottom left corner (a tick at each far end) and núcleo's link inside the corner, at 0.9 (smaller,
// its pieces come closer than 3). Two separate bars read as a text cursor beside a link.
function constrainProportions() {
  const T = (d) => transform(d, 0.9, 3.6, -1.05);
  return [
    rpath([[4.75, 3.25], [4.75, 19.25], [20.75, 19.25]], [0, 0.75, 0]),
    hl(3.25, 6.25, 3.25),
    vl(20.75, 17.75, 20.75),
    T('M13.06 15.53 10.59 18.01A3.25 3.25 0 0 1 5.99 13.41L8.47 10.94'),
    T('M10.94 8.47 13.41 5.99A3.25 3.25 0 0 1 18.01 10.59L15.53 13.06'),
    T('M10.23 13.77 13.77 10.23'),
  ];
}

// Perspective: a trapezoid with a square handle on each corner; the edges run between the handles.
function perspective() {
  const pts = [[8.25, 4.75], [15.75, 4.75], [20.25, 19.25], [3.75, 19.25]];
  const h = 1.75;
  const exit = (a, b) => h / Math.max(...unit(sub(b, a)).map(Math.abs));
  return [...pts.map(([x, y]) => sq(x - h, y - h, 2 * h, 2 * h, 1)), ...pts.map((a, i) => {
    const b = pts[(i + 1) % 4];
    return line(...trim(a, b, exit(a, b), exit(a, b)));
  })];
}

// Mesh warp: an object's frame and the two lines of its 2 × 2 mesh, bowed (a quadratic each, 2 off
// its straight line at the middle).
const WARP = { v: 'M12 3.25Q16 12 12 20.75', h: 'M3.25 12Q12 8 20.75 12' };
/** The part of a quadratic (P0, P1, P2) between t0 and t1: its control point is the blossom at t0, t1. */
function quadPart([P0, P1, P2], t0, t1) {
  const B = (t) => [0, 1].map((k) => (1 - t) ** 2 * P0[k] + 2 * t * (1 - t) * P1[k] + t * t * P2[k]);
  const C = [0, 1].map((k) => (1 - t0) * (1 - t1) * P0[k] + ((1 - t0) * t1 + t0 * (1 - t1)) * P1[k] + t0 * t1 * P2[k]);
  return `M${xy(B(t0))}Q${xy(C)} ${xy(B(t1))}`;
}

// Opacity: the swatch split on its diagonal, the lower half a checker of dots (the transparency grid).
const SWATCH = squircle(3.25, 3.25, 17.5, 17.5, 4);

// Blend mode: a circle over a rounded square, the part they share hatched by two parallel strokes
// that run from edge to edge of it (at 45°, 3 apart).
function blendMode() {
  const c = [9.5, 9.5];
  const r = 6.25;
  const x0 = 8.25;
  // A hatch line x + y = k: from where it enters the overlap to where it leaves it
  const hatch = (k) => {
    const inside = (x) => {
      const y = k - x;
      return x >= x0 && y >= x0 && (x - c[0]) ** 2 + (y - c[1]) ** 2 <= r * r;
    };
    let a = null;
    let b = null;
    for (let x = 2; x <= 22; x += 0.005) if (inside(x)) [a, b] = [a ?? x, x];
    return line([a, k - a], [b, k - b]);
  };
  return [sq(x0, x0, 12.5, 12.5, 2.5), circ(...c, r), hatch(20.5), hatch(24.75)];
}
/** What blend-mode's two shapes share, closed: the circle's arc inside the square and its corner. */
const BLEND_OVERLAP = (() => {
  const k = 9.5 + Math.sqrt(6.25 ** 2 - 1.25 ** 2);
  const tl = squircle(8.25, 8.25, 12.5, 12.5, 2.5).corners.tl;
  return `M${xy([k, 8.25])}A6.25 6.25 0 0 1 ${xy([8.25, k])}L${xy(tl.S)}${tl.first}${tl.second}Z`;
})();

// Gradients: the swatch and dots that thin out (linear: columns of three, two and one; radial: a
// center and a ring; angular: the seam, a radius, and the arc arrow that sweeps on from its tip).
// The sweep starts at the seam: with the seam inside the arc's gap it read as a power button, below
// a cap as a T, and at the end of a long arc as a G.
const GRADIENT = sq(3.25, 3.25, 17.5, 17.5, 4);
function gradientAngular() {
  // The sweep ends at 60°: further up, the head's outer arm came within 2.2 of the swatch's edge
  const a = arc(12, 12, 5.75, -90, 60);
  return [GRADIENT, vl(12, 12, 6.25), a.d, head(a.end, a.tangent, 2.5)];
}

// Blur on a pane: a circle behind a pane of glass; what the pane covers shows as dots along it.
function blurBackground() {
  const c = [10, 10];
  const r = 8;
  const pane = box(7.25, 7.25, 13.5, 13.5, 3.5);
  // Outside the pane the circle is a line, 3 clear of its outline; behind it, five dots 3 apart
  // along the arc, 3 inside it
  return [pane, arc(...c, r, 136, 314).d, ...[3.5, 24.75, 46, 67.25, 88.5].map((t) => dot(...polar(...c, r, t), 0.3))];
}

// Stroke alignment: three L's 3 apart (corner at the bottom left, inside toward the top right); the
// dashed one is the path and the stroke is the band between the other two, closed at its ends like
// the bands of the caps and joins. Three open L's read as three lines, the path lost among them.
const ALIGN_L = [0, 3, 6].map((k) => [[4.25 + k, 3.25], [4.25 + k, 19.75 - k], [20.75, 19.75 - k]]);
const ALIGN_R = [6.5, 3.5, 0.5];
const alignL = (i) => rpath(ALIGN_L[i], [0, ALIGN_R[i], 0], { circular: true });
/** The stroke between L's a (outer) and b (inner), closed across both ends. */
const alignBand = (a, b) => `${alignL(a)}${rpath([...ALIGN_L[b]].reverse(), [0, ALIGN_R[b], 0], { circular: true }).replace(/^M/, 'L')}Z`;
function strokeAlign(path) {
  const [a, b] = [0, 1, 2].filter((i) => i !== path);
  // The dashes: one on the corner (a gap there would be a chord shorter than 3) and k more on each
  // side, the last ones touching the ends, about 3 long and 3 apart
  const tr = track(ALIGN_L[path], [0, ALIGN_R[path], 0]);
  const mid = cornerAt(tr, 0);
  const k = Math.max(1, Math.floor((mid - 1.5) / 6));
  const len = (mid - 3 * k) / (k + 0.5);
  return [alignBand(a, b), ...Array.from({ length: 2 * k + 1 }, (_, j) => {
    const c = mid + (j - k) * (len + 3);
    return stretch(tr, c - len / 2, c + len / 2);
  })];
}

// Stroke caps: a thick stroke (its two edges, 12 apart) running in from the left to its endpoint, the
// dot on its center line. Butt ends at the dot, its end cut short around it; round and square
// end 6 past it.
const CAP = { x: 14.75, top: 6, low: 18 };
function strokeCap(kind) {
  const { x, top, low } = CAP;
  if (kind === 'butt') return [`M3.25 ${top}H${x}V8.45`, `M3.25 ${low}H${x}V15.55`, dot(x, 12)];
  if (kind === 'round') return [`M3.25 ${top}H${x}A6 6 0 0 1 ${x} ${low}H3.25`, dot(x, 12)];
  return [rpath([[3.25, top], [x + 6, top], [x + 6, low], [3.25, low]], [0, 1, 1, 0]), dot(x, 12)];
}

// Stroke joins: a stroke 8 wide turning a right angle (path corner at 7.25, 7.25); only its outer
// corner changes: sharp (miter), an arc of 4 around the path's corner (round) or cut at 45° (bevel).
function strokeJoin(kind) {
  const corner = { miter: 'L3.25 3.25L7.25 3.25', round: 'A4 4 0 0 1 7.25 3.25', bevel: 'L7.25 3.25' }[kind];
  return [`M3.25 20.75V7.25${corner}H20.75`, 'M11.25 20.75V11.25H20.75'];
}

// Outline stroke: the stroke's path inside its own outline, a band of 8.5 with round ends, 4.25 from
// it all round. A line over a band beside it was formas/line-weight; an arc that turned into a band
// read as a bean, curved pairs as wifi or sound waves, and a diagonal pair as a paperclip.
function strokeOutline() {
  return [capsule([7, 12], [17, 12], 4.25), hl(7, 17, 12)];
}

// Type on a path: an S curve (a path, not a hill: on an arc the T read as a figure on a slide, and in
// the circle variant as a frown) and a capital T standing on its rising flank, square to it. A gentle
// rise keeps the T's tilt near 20°: steeper, it read as a hammer.
function textPath() {
  const P = [[3.25, 19.5], [8.5, 19.5], [15.5, 13.5], [20.75, 13.5]];
  const t = 0.4;
  const B = cubicAt(P, t);
  const d = unit([0, 1].map((k) => 3 * (1 - t) ** 2 * (P[1][k] - P[0][k]) + 6 * (1 - t) * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k])));
  const n = [d[1], -d[0]];
  const top = add(B, n, 9.5);
  return [`M${xy(P[0])}C${xy(P[1])} ${xy(P[2])} ${xy(P[3])}`, line(add(top, d, -4), add(top, d, 4)), line(top, B)];
}

// Font weight: a light T (a single line) beside a heavy one drawn as its outline, a block T. An A
// can't be heavy at this size (its counter closes; without it the outline read as a Λ) and two A's
// were letter-case-upper.
const T_LIGHT = [hl(2.75, 9.25, 4.75), vl(6, 4.75, 19.25)];
const T_HEAVY = rpath([[12.75, 4.75], [21.25, 4.75], [21.25, 9.25], [19, 9.25], [19, 19.25], [15, 19.25], [15, 9.25], [12.75, 9.25]], [1.25, 1.25, 1, 0.75, 1, 1, 0.75, 1], { closed: true });

// The set's capital A (text-larger) at 7.25 wide, for two letters side by side.
const capA = (x) => [line([x, 19.25], [x + 3.63, 4.75], [x + 7.25, 19.25]), hl(x + 1.26, x + 5.99, 14.25)];
// A single-storey lowercase a: its bowl and the stem tangent to it.
const smallA = (cx, cy, r = 3.5) => [circ(cx, cy, r), vl(cx + r, cy - r, cy + r)];

// Underline's letter, moved up to leave room under it (or down, for the line above it).
const U_HIGH = 'M7.25 3.25V9.5A4.75 4.75 0 0 0 16.75 9.5V3.25';
// A wave of six half waves (amplitude 1.25) from 4.25 to 19.75 at height y.
function wave(x0, x1, y, n = 6, a = 1.25) {
  const step = (x1 - x0) / n;
  let d = `M${xy([x0, y])}Q${xy([x0 + step / 2, y - 2 * a])} ${xy([x0 + step, y])}`;
  for (let i = 2; i <= n; i++) d += `T${xy([x0 + i * step, y])}`;
  return d;
}

// Text boxes that grow: the dashed box is four corner marks (the signature corner square) and its
// T; the sides the box grows from stay open around the arrow, 3.8 to each side of it, so the
// arrowheads keep 3 from the marks. `ax`: where the marks end along the top and bottom; `ay`: along
// the sides.
function textBox(x0, y0, x1, y1, [ax, ay]) {
  const m = (pts, r) => rpath(pts, [0, r, 0]);
  return [
    m([[x0, ay[0]], [x0, y0], [ax[0], y0]], 2),
    m([[ax[1], y0], [x1, y0], [x1, ay[0]]], 2),
    m([[x1, ay[1]], [x1, y1], [ax[1], y1]], 0),
    m([[ax[0], y1], [x0, y1], [x0, ay[1]]], 2),
  ];
}

// Heading digits beside H_SMALL, in the box of heading-2's 2 (15.25–20.75 × 10–19).
const DIGIT = {
  4: 'M18.75 19V10L15.25 16.25H20.75',
  5: 'M20.25 10H15.5V13.19A3.25 3.25 0 1 1 15.01 17.84',
  6: [circ(17.75, 16.25, 2.75), arc(22.75, 16.25, 7.75, 180, 235).d],
};

// datos/table, the same drawing (for table-plus).
const TABLE = [box(3.25, 3.25, 17.5, 17.5, 4.25), hl(3.25, 20.75, 8.75), vl(10.75, 8.75, 20.75)];

// Borders: a 2 × 2 grid of cells (the table's square with the signature corner, and its cross). The
// sides that apply are solid, each with its corners; the rest of the grid is dotted: r 0.3 dots a
// sixth of the side apart (2.92), the corners left open. A dot on a solid piece goes, and so does one
// 3.2 or less from a piece's end. Inner lines stop 3.25 short of a dotted frame (they touch a solid
// one), so the frame keeps every dot. `small`: the same grid on the 16 px pixels, one-pixel dots on
// every other pixel center.
function border(solid, small = false) {
  const [a, b, m] = small ? [3.75, 20.25, 12.75] : [3.25, 20.75, 12];
  const p = small ? 3 : 4.8;
  const r = small ? 2 : 3;
  const frame = solid.includes('outer');
  const inset = frame ? 0 : 3.25;
  const pieces = {
    outer: box(a, a, b - a, b - a, r),
    top: rpath([[a, a + p], [a, a], [b, a], [b, a + p]], [0, r, r, 0]),
    right: rpath([[b - p, a], [b, a], [b, b], [b - p, b]], [0, r, 0, 0]),
    bottom: rpath([[a, b - p], [a, b], [b, b], [b, b - p]], [0, r, 0, 0]),
    left: rpath([[a + p, a], [a, a], [a, b], [a + p, b]], [0, r, r, 0]),
    h: hl(a + inset, b - inset, m),
    v: vl(m, a + inset, b - inset),
  };
  const ds = solid.map((k) => pieces[k]);
  const q = small ? [6.75, 9.75, 12.75, 15.75, 18.75] : [1, 2, 3, 4, 5].map((k) => 3.25 + (17.5 / 6) * k);
  const spots = [...q.flatMap((t) => [[t, a], [t, b], [a, t], [b, t]]), ...q.filter((t) => t !== m).flatMap((t) => [[m, t], [t, m]]), [m, m]];
  const ends = ds.flatMap((d) => {
    const pts = pathPoints(d);
    return /Z\s*$/.test(d) ? [] : [pts[0], pts.at(-1)];
  });
  const on = (pt) => ds.some((d) => pathPoints(d).some((q2, i, all) => i && distToSeg(pt, all[i - 1], q2) < 0.5));
  const keep = spots.filter((pt) => !on(pt) && ends.every((e) => Math.hypot(...sub(e, pt)) > 3.2));
  return [...ds, ...keep.map((pt) => (small ? circ(...pt, 0.1) : dot(...pt, 0.3)))];
}
const distToSeg = (pt, A, B) => {
  const L = Math.hypot(...sub(B, A));
  if (L < 1e-9) return Math.hypot(...sub(pt, A));
  const t = Math.max(0, Math.min(1, ((pt[0] - A[0]) * (B[0] - A[0]) + (pt[1] - A[1]) * (B[1] - A[1])) / (L * L)));
  return Math.hypot(pt[0] - (A[0] + t * (B[0] - A[0])), pt[1] - (A[1] + t * (B[1] - A[1])));
};
const BORDER = (...solid) => border(solid);
/** A path's points (absolute, curves followed by their sampled points), to measure distances to it. */
function pathPoints(d) {
  const pts = [];
  for (const sg of segments(d)) {
    const n = sg.c === 'L' || sg.c === 'Z' ? 1 : 8;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (sg.c === 'C') {
        const [x1, y1, x2, y2, x, y] = sg.a;
        const P = [sg.from, [x1, y1], [x2, y2], [x, y]];
        pts.push(cubicAt(P, t));
      } else pts.push([sg.from[0] + (sg.to[0] - sg.from[0]) * t, sg.from[1] + (sg.to[1] - sg.from[1]) * t]);
    }
  }
  return [segments(d)[0]?.from ?? [0, 0], ...pts];
}

/** A small photo for page layouts: its frame, a peak standing on the bottom edge (45° slopes) and a sun. */
function photo(x, y, w, h, peak, sun) {
  const base = y + h;
  const rise = base - peak[1];
  return [box(x, y, w, h, 2), rpath([[peak[0] - rise, base], peak, [peak[0] + rise, base]], [0, 0.9, 0], { circular: true }), dot(...sun)];
}

// Track changes: a deleted line (struck by a slash), the text inserted above the next line and the
// caret under it that marks where (to the left, so a badge leaves it whole).
const TRACK_CHANGES = [hl(3.25, 20.75, 6), line([13, 8.25], [17.5, 3.75]), hl(4.5, 10.5, 11.25), hl(3.25, 20.75, 15), line([5.25, 20.75], [7.5, 18], [9.75, 20.75])];

// Replace: a square becomes a circle along an arc arrow. Replace all: each of them stacked, the one
// behind showing its edge (copy's back sheet), 3 from the front one.
function replaceAll() {
  const a = arc(14.25, 10.25, 4.5, -90, 0);
  return [
    rpath([[8.25, 3.25], [3.25, 3.25], [3.25, 8.25]], [0, 1.75, 0]),
    sq(6.25, 6.25, 5, 5, 1.5),
    arc(18.75, 18.75, 2.5, -28.6, 118.6).d,
    circ(15.75, 15.75, 2.5),
    a.d,
    head(a.end, a.tangent, 2.5),
  ];
}

// Page header: the page, a short line at its top and the dashed rule that separates it from the body
// (dashes 3 apart, the outer ones touching the page). The footer is the same, mirrored top to bottom.
const PAGE = box(4.75, 2.75, 14.5, 18.5, 3.75);
const pageBand = (line0, rule) => [PAGE, hl(8.25, 15.75, line0), hl(4.75, 7.25, rule), hl(10.25, 13.75, rule), hl(16.75, 19.25, rule)];

// Pen tool for the anchor point badges: `pen-tool` at 0.75 in the top left, clear of the badge (the
// eye, too small for a ring at that size, becomes a dot; the holder keeps its height, or its hole
// would close at bold).
const PEN_NIB = (() => {
  const T = (d) => transform(d, 0.75, -1.75, 0.69);
  return [
    T(rpath([[12, 2.75], [17.75, 11.75], [15, 16], [9, 16], [6.25, 11.75]], [0.9, 2.25, 1.25, 1.25, 2.25], { closed: true })),
    dot(12 * 0.75 - 1.75, 11 * 0.75 + 0.69),
    T(vl(12, 3.55, 9.75)),
    sq(8.5 * 0.75 - 1.75, 19 * 0.75 + 0.69, 7 * 0.75, 2.5, 0.75),
  ];
})();

const icons = {
  // ── Clipboard, delete and archive ──
  'copy': {
    tags: ['copiar', 'copia', 'portapapeles', 'copy', 'clone'],
    d: [COPY_BACK, COPY_FRONT],
  },
  'duplicate': {
    tags: ['duplicar', 'clonar', 'copia nueva', 'duplicate', 'clone'],
    d: [COPY_BACK, COPY_FRONT, hl(13.25, 17.75, 15.5), vl(15.5, 13.25, 17.75)],
  },
  'copy-check': {
    tags: ['copiado', 'copiar', 'listo', 'copied', 'copy done'],
    d: [COPY_BACK, COPY_FRONT, line([13.4, 15.75], [14.9, 17.25], [17.6, 14.25])],
  },
  'paste': {
    tags: ['pegar', 'portapapeles', 'insertar', 'paste', 'clipboard'],
    d: [...CLIP, hl(8.25, 15.75, 11.25), hl(8.25, 12.75, 15)],
  },
  'clipboard-check': {
    tags: ['portapapeles', 'revisado', 'tarea hecha', 'clipboard', 'checked'],
    d: [...CLIP, line([8.75, 13.6], [11, 15.85], [15.25, 11.35])],
  },
  'scissors': {
    tags: ['tijeras', 'cortar', 'recortar', 'cut', 'scissors'],
    d: scissors(),
  },
  'trash': {
    tags: ['papelera', 'borrar', 'eliminar', 'basura', 'delete', 'trash'],
    d: [...TRASH_LID, ...TRASH_BODY],
  },
  'trash-open': {
    tags: ['papelera abierta', 'tirar', 'eliminar', 'trash', 'discard'],
    d: [...trashLidOpen(), ...TRASH_BODY],
  },
  'wastebasket': {
    tags: ['cesto', 'papelera sin tapa', 'basura', 'bin', 'wastebasket'],
    d: [
      rpath([[3.75, 4.25], [20.25, 4.25], [18.25, 20.75], [5.75, 20.75]], [1.25, 1.25, 0, 3], { closed: true }),
      line([9.6, 8.25], [10.05, 16.75]),
      line([14.4, 8.25], [13.95, 16.75]),
    ],
  },
  'backspace': {
    tags: ['borrar', 'retroceso', 'suprimir', 'backspace', 'delete left'],
    d: [
      rpath([[2.75, 12], [8.25, 5], [21.25, 5], [21.25, 19], [8.25, 19]], [1.25, 1.75, 3.5, 0, 1.75], { closed: true }),
      line([12, 9.5], [17, 14.5]),
      line([17, 9.5], [12, 14.5]),
    ],
  },
  'archive': {
    tags: ['archivar', 'archivo muerto', 'caja', 'archive', 'store'],
    d: [...ARCHIVE, hl(9.75, 14.25, 12.25)],
  },
  'archive-restore': {
    tags: ['desarchivar', 'restaurar', 'recuperar', 'unarchive', 'restore'],
    d: [...ARCHIVE, vl(12, 11.5, 17.75), head([12, 11.5], [0, -1], 3.25)],
  },

  // ── Text formatting ──
  'bold': {
    tags: ['negrita', 'formato', 'texto grueso', 'bold', 'strong'],
    d: ['M7 11.75V4.25H12.25A3.75 3.75 0 0 1 12.25 11.75Z', 'M7 11.75H13A4 4 0 0 1 13 19.75H7Z'],
  },
  'italic': {
    tags: ['cursiva', 'itálica', 'formato', 'italic', 'emphasis'],
    d: [hl(10.25, 18, 4.25), hl(6, 13.75, 19.75), line([14.13, 4.25], [9.88, 19.75])],
  },
  'underline': {
    tags: ['subrayado', 'subrayar', 'formato', 'underline'],
    d: ['M7.25 4V11A4.75 4.75 0 0 0 16.75 11V4', hl(5.25, 18.75, 20)],
  },
  'strikethrough': {
    tags: ['tachado', 'tachar', 'formato', 'strikethrough', 'strike'],
    d: [arc(12, 7.75, 3.75, -25, -200).d, arc(12, 16.25, 3.75, -20, 150).d, hl(4.25, 19.75, 12)],
  },
  'text': {
    tags: ['texto', 'tipografía', 'escribir', 'text', 'type'],
    d: [hl(5, 19, 4.75), vl(12, 4.75, 19.5)],
  },
  'heading': {
    tags: ['encabezado', 'título', 'heading', 'title'],
    d: [vl(6, 4.25, 19.75), vl(18, 4.25, 19.75), hl(6, 18, 12)],
  },
  'heading-1': {
    tags: ['encabezado 1', 'título principal', 'h1', 'heading 1'],
    d: [...H_SMALL, vl(18.25, 10, 19), line([15.75, 12], [18.25, 10])],
  },
  'heading-2': {
    tags: ['encabezado 2', 'subtítulo', 'h2', 'heading 2'],
    d: [...H_SMALL, two(15.25, 10, 5, 9)],
  },
  'heading-3': {
    tags: ['encabezado 3', 'sección', 'h3', 'heading 3'],
    d: [...H_SMALL, arc(17.5, 12.25, 2.25, 200, 450).d, arc(17.5, 16.75, 2.25, 270, 510).d],
  },
  'quote': {
    tags: ['cita', 'comillas', 'testimonio', 'quote', 'quotation marks'],
    d: [comma(7.5, 14.5), comma(16.5, 14.5)],
  },
  'text-quote': {
    tags: ['cita en bloque', 'cita', 'extracto', 'blockquote', 'quote block'],
    d: [vl(4.5, 5.25, 18.75), hl(9, 20.25, 5.25), hl(9, 17.25, 9.75), hl(9, 20.25, 14.25), hl(9, 14.75, 18.75)],
  },
  'paragraph': {
    tags: ['párrafo', 'calderón', 'salto de párrafo', 'paragraph', 'pilcrow'],
    d: ['M12 12.25H10A4 4 0 0 1 10 4.25H18', vl(12, 4.25, 19.75), vl(16, 4.25, 19.75)],
  },
  'text-size': {
    tags: ['tamaño de texto', 'fuente', 'cuerpo de letra', 'font size', 'text size'],
    d: [hl(3.25, 14.25, 4.75), vl(8.75, 4.75, 19.25), hl(15, 20.75, 10.75), vl(17.88, 10.75, 19.25)],
  },
  'text-larger': {
    tags: ['agrandar texto', 'aumentar fuente', 'tamaño', 'increase font size', 'text larger'],
    d: [...A_BIG, line([16.25, 8], [18.75, 5.5], [21.25, 8])],
  },
  'text-smaller': {
    tags: ['reducir texto', 'disminuir fuente', 'tamaño', 'decrease font size', 'text smaller'],
    d: [...A_BIG, line([16.25, 5.5], [18.75, 8], [21.25, 5.5])],
  },
  'letter-case': {
    tags: ['mayúsculas y minúsculas', 'tipografía', 'capitalizar', 'letter case', 'font'],
    d: [line([3.25, 19.25], [7.75, 5.5], [12.25, 19.25]), hl(4.72, 10.78, 14.75), circ(18, 16.5, 2.75), vl(20.75, 13.75, 19.25)],
  },
  'text-color': {
    tags: ['color de texto', 'tinta', 'color de fuente', 'text color', 'font color'],
    d: [line([6, 16], [12, 3.75], [18, 16]), hl(7.96, 16.04, 12), hl(4.25, 19.75, 20)],
  },
  'format-clear': {
    tags: ['quitar formato', 'limpiar formato', 'texto plano', 'clear formatting', 'remove format'],
    d: [hl(4.25, 15.25, 4.75), vl(9.75, 4.75, 19.25), line([14.5, 14.25], [19.5, 19.25]), line([19.5, 14.25], [14.5, 19.25])],
  },
  'superscript': {
    tags: ['superíndice', 'exponente', 'potencia', 'superscript'],
    d: [line([3.75, 8.25], [12.75, 17.25]), line([12.75, 8.25], [3.75, 17.25]), two(15.75, 3.25, 4.5, 6.5)],
  },
  'subscript': {
    tags: ['subíndice', 'índice', 'fórmula', 'subscript'],
    d: [line([3.75, 6.75], [12.75, 15.75]), line([12.75, 6.75], [3.75, 15.75]), two(15.75, 14.25, 4.5, 6.5)],
  },
  'paint-roller': {
    tags: ['copiar formato', 'rodillo', 'brocha de formato', 'format painter', 'paint roller'],
    d: [
      sq(3.25, 3.25, 15, 5.5, 1.7),
      rpath([[18.25, 6], [20.75, 6], [20.75, 11.5], [12, 11.5], [12, 14]], [0, 1.25, 1.25, 1.25, 0]),
      sq(10.25, 14, 3.5, 7, 1.05),
    ],
  },

  // ── Alignment, lists and paragraphs ──
  'align-left': {
    tags: ['alinear a la izquierda', 'alineación', 'texto', 'align left'],
    d: [hl(3.75, 20.25, 5.25), hl(3.75, 15.25, 9.75), hl(3.75, 20.25, 14.25), hl(3.75, 12.25, 18.75)],
  },
  'align-center': {
    tags: ['centrar', 'alinear al centro', 'alineación', 'align center'],
    d: [hl(3.75, 20.25, 5.25), hl(7, 17, 9.75), hl(3.75, 20.25, 14.25), hl(8.25, 15.75, 18.75)],
  },
  'align-right': {
    tags: ['alinear a la derecha', 'alineación', 'texto', 'align right'],
    d: [hl(3.75, 20.25, 5.25), hl(8.75, 20.25, 9.75), hl(3.75, 20.25, 14.25), hl(11.75, 20.25, 18.75)],
  },
  'align-justify': {
    tags: ['justificar', 'alineación', 'bloque', 'justify', 'align justify'],
    d: [5.25, 9.75, 14.25, 18.75].map((y) => hl(3.75, 20.25, y)),
  },
  'list-bullets': {
    tags: ['lista', 'viñetas', 'puntos', 'bulleted list', 'unordered list'],
    d: [6.5, 12, 17.5].flatMap((y) => [dot(5, y), hl(9.25, 20.25, y)]),
  },
  'list-numbers': {
    tags: ['lista numerada', 'números', 'pasos', 'numbered list', 'ordered list'],
    d: [vl(6, 4.25, 9.75), line([4.25, 5.75], [6, 4.25]), hl(10.25, 20.25, 7), two(3.75, 14.25, 3.5, 5.5), hl(10.25, 20.25, 17)],
  },
  'list-checks': {
    tags: ['lista de tareas', 'pendientes', 'checklist', 'todo list', 'tasks'],
    d: [7, 17].flatMap((y) => [line([3.5, y], [5.1, y + 1.6], [8, y - 1.6]), hl(11.25, 20.25, y)]),
  },
  'indent-increase': {
    tags: ['aumentar sangría', 'sangría', 'tabular', 'indent', 'increase indent'],
    d: [...INDENT_LINES, head([7.75, 12], [1, 0], 3)],
  },
  'indent-decrease': {
    tags: ['reducir sangría', 'sangría', 'quitar sangría', 'outdent', 'decrease indent'],
    d: [...INDENT_LINES, head([3.75, 12], [-1, 0], 3)],
  },
  'line-spacing': {
    tags: ['interlineado', 'espaciado', 'altura de línea', 'line height', 'line spacing'],
    d: [vl(5.5, 4.25, 19.75), head([5.5, 4.25], [0, -1], 3), head([5.5, 19.75], [0, 1], 3), ...[5.25, 9.75, 14.25, 18.75].map((y) => hl(10.75, 20.25, y))],
  },
  'text-wrap': {
    tags: ['ajustar texto', 'salto de línea', 'envolver', 'text wrap', 'word wrap'],
    d: [hl(3.75, 20.25, 5.5), 'M3.75 11.5H16.75A3.25 3.25 0 0 1 16.75 18H12', head([12, 18], [-1, 0], 3), hl(3.75, 7.75, 18)],
  },
  'text-columns': {
    tags: ['columnas de texto', 'maquetación', 'diseño de página', 'text columns', 'layout'],
    d: [...[5.25, 9.75, 14.25, 18.75].map((y) => hl(3.25, 10.5, y)), ...[5.25, 9.75, 14.25].map((y) => hl(13.5, 20.75, y)), hl(13.5, 17.5, 18.75)],
  },
  'text-cursor': {
    tags: ['cursor de texto', 'escribir', 'insertar texto', 'i-beam', 'text cursor'],
    d: [
      'M8.75 3.75A3.25 3.25 0 0 1 12 7A3.25 3.25 0 0 1 15.25 3.75',
      vl(12, 7, 17),
      'M8.75 20.25A3.25 3.25 0 0 0 12 17A3.25 3.25 0 0 0 15.25 20.25',
    ],
  },
  'text-box': {
    tags: ['cuadro de texto', 'campo de texto', 'insertar texto', 'text box', 'text field'],
    d: [box(3.25, 3.25, 17.5, 17.5, 4), hl(8, 16, 8.25), vl(12, 8.25, 16)],
  },
  'text-direction-ltr': {
    tags: ['izquierda a derecha', 'dirección del texto', 'escritura', 'ltr', 'text direction'],
    d: [...PILCROW_SMALL, hl(4.25, 19.75, 18.75), head([19.75, 18.75], [1, 0], 3)],
  },
  'text-direction-rtl': {
    tags: ['derecha a izquierda', 'dirección del texto', 'árabe', 'rtl', 'text direction'],
    d: [...PILCROW_SMALL, hl(4.25, 19.75, 18.75), head([4.25, 18.75], [-1, 0], 3)],
  },
  'text-search': {
    tags: ['buscar en el texto', 'encontrar', 'buscar palabra', 'find', 'find in text'],
    d: textSearch(),
  },
  'page-break': {
    tags: ['salto de página', 'página', 'separar', 'page break', 'section break'],
    d: [
      rpath([[4.75, 3.25], [4.75, 8.75], [19.25, 8.75], [19.25, 3.25]], [0, 2.5, 0, 0]),
      ...DASHES.map(([a, b]) => hl(a, b, 12)),
      rpath([[4.75, 20.75], [4.75, 15.25], [19.25, 15.25], [19.25, 20.75]], [0, 2.5, 2.5, 0]),
    ],
  },

  // ── Image and transform ──
  'image-plus': {
    tags: ['insertar imagen', 'agregar foto', 'subir imagen', 'add image', 'insert picture'],
    // The frame and sun from dispositivos/image, whole; of its mountains only the first peak is left,
    // running down under the engine's badge (which clears the corner with a 1.5 gap).
    d: [box(2.5, 5, 19, 14, 3.5), dot(10.5, 8.75), rpath([[2.59, 16.08], [7.75, 11.25], [13.5, 17]], [0, 1, 0], { circular: true })],
    badge: badge('plus'),
  },
  'crop': {
    tags: ['recortar', 'encuadre', 'reencuadrar', 'crop', 'trim'],
    d: [rpath([[6.5, 2.75], [6.5, 17.5], [21.25, 17.5]], 1.5), rpath([[2.75, 6.5], [17.5, 6.5], [17.5, 21.25]], 1.5)],
  },
  'rotate-right': {
    tags: ['girar a la derecha', 'rotar', 'sentido horario', 'rotate clockwise', 'rotate right'],
    d: rotateIcon(true),
  },
  'rotate-left': {
    tags: ['girar a la izquierda', 'rotar', 'sentido antihorario', 'rotate counterclockwise', 'rotate left'],
    d: rotateIcon(false),
  },
  'flip-horizontal': {
    tags: ['voltear horizontal', 'espejo', 'reflejar', 'flip horizontal', 'mirror'],
    d: flip(0),
  },
  'flip-vertical': {
    tags: ['voltear vertical', 'espejo', 'reflejar', 'flip vertical', 'mirror'],
    d: flip(90),
  },
  'resize': {
    tags: ['redimensionar', 'escalar', 'cambiar tamaño', 'resize', 'scale'],
    d: [box(3.25, 12.25, 8.5, 8.5, 2.25), line([14.25, 9.75], [20.5, 3.5]), head([20.5, 3.5], [1, -1], 5)],
  },
  'transform': {
    tags: ['transformar', 'caja delimitadora', 'tiradores', 'bounding box', 'transform'],
    d: [
      ...[[2.75, 2.75], [16.75, 2.75], [2.75, 16.75], [16.75, 16.75]].map(([x, y]) => sq(x, y, 4.5, 4.5, 1.25)),
      hl(7.25, 16.75, 5),
      hl(7.25, 16.75, 19),
      vl(5, 7.25, 16.75),
      vl(19, 7.25, 16.75),
    ],
  },
  'corner-radius': {
    tags: ['radio de esquina', 'redondear esquina', 'esquina continua', 'corner radius', 'rounded corner'],
    d: [rpath([[4, 20.75], [4, 4], [20.75, 4]], 9.75), dot(4, 4)],
  },

  // ── Drawing tools ──
  'eraser': {
    tags: ['borrador', 'goma', 'borrar', 'eraser', 'rubber'],
    d: (() => {
      const P = axis([11.75, 10.25], -45);
      return [rpath([P(7.5, -3.75), P(7.5, 3.75), P(-7.5, 3.75), P(-7.5, -3.75)], 1.75, { closed: true }), line(P(-2.5, -3.75), P(-2.5, 3.75)), hl(9.5, 20.25, 20.75)];
    })(),
  },
  'brush': {
    tags: ['pincel', 'pintar', 'trazo', 'brush', 'paint'],
    d: (() => {
      const P = axis([3.5, 20.5], -45);
      const c = (...q) => q.map((p) => xy(P(...p))).join(' ');
      return [
        // the bristles close against the ferrule's edge, which stays open toward them
        `M${c([9, -2.25])}C${c([6.25, -3.75], [2.75, -2.25], [0, 0])}C${c([2.75, 2.25], [6.25, 3.75], [9, 2.25])}Z`,
        rpath([P(9, -2.25), P(12.5, -2.25), P(12.5, 2.25), P(9, 2.25)], [0, 0.9, 0.9, 0]),
        line(P(12.5), P(22)),
      ];
    })(),
  },
  'pen-tool': {
    tags: ['pluma', 'vector', 'curvas', 'pen tool', 'bezier'],
    d: [
      rpath([[12, 2.75], [17.75, 11.75], [15, 16], [9, 16], [6.25, 11.75]], [0.9, 2.25, 1.25, 1.25, 2.25], { closed: true }),
      circ(12, 11, 1.25),
      vl(12, 3.55, 9.75),
      sq(8.5, 19, 7, 2.5, 0.75),
    ],
  },
  'vector-path': {
    tags: ['trazado', 'nodos', 'puntos de ancla', 'vector path', 'anchor points'],
    d: vectorPath(),
  },
  'highlighter': {
    tags: ['resaltador', 'marcatextos', 'subrayar', 'highlighter', 'highlight'],
    d: (() => {
      const P = axis([3, 19], -45);
      return [
        rpath([P(6.75, -3.25), P(20.5, -3.25), P(20.5, 3.25), P(6.75, 3.25)], 1.25, { closed: true }),
        line(P(16.25, -3.25), P(16.25, 3.25)),
        // chisel tip: it starts from the straight run of the edge, not from the rounded corner
        rpath([P(6.75, -1.25), P(3.25, -1.25), P(4.5, 1.25), P(6.75, 1.25)], [0, 0.5, 0.5, 0]),
        hl(3.5, 11, 21),
      ];
    })(),
  },
  'magic-wand': {
    tags: ['varita mágica', 'automático', 'mejorar', 'magic wand', 'auto'],
    d: (() => {
      const a = [4, 20];
      const b = [11.75, 12.25];
      const u = unit(sub(b, a));
      const n = [-u[1], u[0]];
      const m = add(b, u, -3.25);
      return [capsule(a, b, 1.6), line(add(m, n, 1.6), add(m, n, -1.6)), spark(17.25, 6.75, 4), dot(8.5, 5.75), dot(19.75, 15)];
    })(),
  },
  'eyedropper': {
    tags: ['cuentagotas', 'muestrear color', 'pipeta', 'eyedropper', 'color picker'],
    d: (() => {
      const P = axis([3.5, 20.5], -45);
      return [
        rpath([P(13, -1.6), P(3, -1.6), P(0, 0), P(3, 1.6), P(13, 1.6)], [0, 0.75, 0.6, 0.75, 0]),
        line(P(13, -3.75), P(13, 3.75)),
        `M${xy(P(13, -2.75))}L${xy(P(19.25, -2.75))}A2.75 2.75 0 0 1 ${xy(P(19.25, 2.75))}L${xy(P(13, 2.75))}`,
      ];
    })(),
  },
  'paint-bucket': {
    tags: ['bote de pintura', 'rellenar', 'relleno', 'paint bucket', 'fill'],
    d: bucket(),
  },
  'palette': {
    tags: ['paleta', 'colores', 'tema', 'palette', 'colors'],
    d: palette(),
  },
  'shapes': {
    tags: ['formas', 'figuras', 'geometría', 'shapes', 'insert shape'],
    d: [rpath([[12, 2.75], [16.5, 9.75], [7.5, 9.75]], 1, { closed: true }), circ(6.5, 16.75, 3.75), sq(13.25, 13.25, 7.5, 7.5, 2)],
  },
  'ruler': {
    tags: ['regla', 'medir', 'medidas', 'ruler', 'measure'],
    d: [sq(2.5, 7.75, 19, 8.5, 2), vl(6, 7.75, 11.25), vl(9, 7.75, 9.75), vl(12, 7.75, 11.25), vl(15, 7.75, 9.75), vl(18, 7.75, 11.25)],
  },
  'set-square': {
    tags: ['escuadra', 'dibujo técnico', 'ángulo recto', 'set square', 'triangle ruler'],
    d: [
      rpath([[3.25, 3.25], [20.75, 20.75], [3.25, 20.75]], [1.25, 1.25, 2.25], { closed: true }),
      rpath([[6.75, 11.7], [12.3, 17.25], [6.75, 17.25]], [0.75, 0.75, 1], { closed: true }),
    ],
  },
  'drafting-compass': {
    tags: ['compás', 'trazar círculo', 'dibujo técnico', 'compass', 'drafting'],
    d: compass(),
  },

  // ── Pencils and freehand ──
  'pencil-plus': {
    tags: ['nuevo dibujo', 'lápiz', 'agregar trazo', 'add drawing', 'new sketch'],
    // The whole pencil, more than a 1.5 gap away from the engine's badge: it doesn't touch it.
    d: pencil([3.25, 18], 17.5),
    badge: badge('plus'),
  },
  'pencil-off': {
    tags: ['sin edición', 'solo lectura', 'bloquear edición', 'read only', 'edit off'],
    d: [...pencil([4.1, 19.9], 20.5, { cut: [8.17, 14.17] }), line([3.75, 3.75], [20.25, 20.25])],
  },
  'compose': {
    tags: ['redactar', 'escribir', 'nueva nota', 'compose', 'write'],
    // The full sheet with the pencil on top as a custom badge: the engine opens the 1.5 channel
    // along the pencil (previously, the sheet was cut by hand).
    d: [box(3.25, 6.25, 14.5, 14.5, 3.5)],
    badge: ((d) => ({ d, knock: d[0], fill: { solid: [d[0]], cut: d.slice(1) } }))(pencil([10.25, 13.75], 13.5, { w: 3.8 })),
  },
  'signature-line': {
    tags: ['firma', 'firmar', 'rúbrica', 'signature', 'sign here'],
    d: ['M3.75 16.5C5.5 10.5 9.25 7.5 9.5 10.25C9.75 13.25 6.25 16.5 7.5 16.75C9 17 11.5 12.75 13.25 12.75C14.75 12.75 13.75 16 15.25 16C16.5 16 18.25 14 20.25 13.5', hl(3.25, 20.75, 20.25)],
  },
  'scribble': {
    tags: ['dibujo libre', 'trazo', 'garabato', 'freehand', 'scribble'],
    d: ['M3.5 15.5C5.5 8 9 4.5 10.75 7C12.5 9.5 6.5 16 9 18.5C11.5 21 14.5 11 17 11.5C19 12 17.5 16.5 20.5 16.5'],
  },

  // ── View, mark and save ──
  'eye': {
    tags: ['ver', 'mostrar', 'vista previa', 'visible', 'show'],
    d: ['M2.75 12C5 7.75 8.25 5.5 12 5.5S19 7.75 21.25 12C19 16.25 15.75 18.5 12 18.5S5 16.25 2.75 12Z', circ(12, 12, 3.25)],
  },
  'eye-closed': {
    tags: ['ocultar', 'esconder', 'ojo cerrado', 'hidden', 'hide'],
    d: [arc(12, 1.75, 11.25, 143.13, 36.87).d, ...[66, 82, 98, 114].map((a) => line(polar(12, 1.75, 11.25, a), polar(12, 1.75, 14, a)))],
  },
  'bookmark': {
    tags: ['marcador', 'guardar', 'leer después', 'bookmark', 'save for later'],
    d: [BOOKMARK],
  },
  'bookmark-plus': {
    tags: ['agregar marcador', 'guardar', 'marcar', 'add bookmark'],
    d: [BOOKMARK, hl(9.5, 14.5, 9.5), vl(12, 7, 12)],
  },
  'bookmark-check': {
    tags: ['marcado', 'guardado', 'en marcadores', 'bookmarked', 'saved'],
    d: [BOOKMARK, line([9.25, 9.75], [11.1, 11.6], [14.75, 7.75])],
  },
  'star': {
    tags: ['estrella', 'favorito', 'destacar', 'favorite', 'star'],
    d: [STAR],
  },
  'heart': {
    tags: ['corazón', 'me gusta', 'favorito', 'like', 'love'],
    d: [heart()],
  },
  'flag': {
    tags: ['bandera', 'marcar', 'señalar', 'flag', 'mark'],
    d: FLAG,
  },
  'share': {
    tags: ['compartir', 'exportar', 'enviar', 'share', 'export'],
    d: [rpath([[14.95, 9.5], [19.75, 9.5], [19.75, 21], [4.25, 21], [4.25, 9.5], [9.05, 9.5]], [0, 3, 0, 3, 3, 0]), vl(12, 3.25, 15.5), head([12, 3.25], [0, -1], 4.25)],
  },
  'share-nodes': {
    tags: ['compartir', 'red', 'conexiones', 'share', 'social share'],
    d: shareNodes(),
  },
  'download': {
    tags: ['descargar', 'bajar', 'guardar en el equipo', 'download'],
    d: [TRAY, vl(12, 3.25, 15.75), head([12, 15.75], [0, 1], 5)],
  },
  'upload': {
    tags: ['subir', 'cargar', 'adjuntar', 'upload'],
    d: [TRAY, vl(12, 3.25, 16.25), head([12, 3.25], [0, -1], 5)],
  },
  'save': {
    tags: ['guardar', 'disquete', 'salvar cambios', 'save', 'floppy'],
    d: [box(3.25, 3.25, 17.5, 17.5, 3.5), rpath([[9, 3.25], [9, 8], [15, 8], [15, 3.25]], [0, 1.25, 1.25, 0]), sq(7.75, 12.75, 8.5, 5, 1.5)],
  },
  'sticky-note': {
    tags: ['nota adhesiva', 'apunte', 'post-it', 'sticky note', 'memo'],
    d: [
      rpath([[3.25, 3.25], [20.75, 3.25], [20.75, 14.25], [14.25, 20.75], [3.25, 20.75]], [4, 4, 0.75, 0.75, 4], { closed: true }),
      rpath([[14.25, 20.75], [14.25, 14.25], [20.75, 14.25]], [0, 1.75, 0]),
    ],
  },

  // ── Selection, layers and order ──
  'selection': {
    tags: ['selección', 'seleccionar', 'marco', 'select', 'marquee'],
    d: MARQUEE,
  },
  'select-all': {
    tags: ['seleccionar todo', 'selección', 'todo', 'select all'],
    d: [...MARQUEE, box(7.75, 7.75, 8.5, 8.5, 2.25)],
  },
  'deselect': {
    tags: ['deshacer selección', 'quitar selección', 'deseleccionar', 'deselect', 'clear selection'],
    d: [...MARQUEE, line([9.5, 9.5], [14.5, 14.5]), line([14.5, 9.5], [9.5, 14.5])],
  },
  'lasso': {
    tags: ['lazo', 'selección libre', 'seleccionar a mano', 'lasso', 'freeform select'],
    d: lasso(),
  },
  'group': {
    tags: ['agrupar', 'grupo', 'juntar objetos', 'group', 'combine'],
    d: [...MARQUEE, circ(8.75, 8.75, 2.5), sq(12.5, 12.5, 5.25, 5.25, 1.5)],
  },
  'bring-forward': {
    tags: ['traer al frente', 'subir capa', 'orden', 'bring forward', 'layer up'],
    d: layerOrder(true),
  },
  'send-backward': {
    tags: ['enviar atrás', 'bajar capa', 'orden', 'send backward', 'layer down'],
    d: layerOrder(false),
  },
  'align-top': {
    tags: ['alinear arriba', 'alinear objetos', 'borde superior', 'align top'],
    d: [hl(3.25, 20.75, 3.5), box(5.5, 6.5, 5, 14.25, 1.5), box(13.5, 6.5, 5, 9, 1.5)],
  },
  'align-bottom': {
    tags: ['alinear abajo', 'alinear objetos', 'borde inferior', 'align bottom'],
    d: [hl(3.25, 20.75, 20.5), box(5.5, 3.25, 5, 14.25, 1.5), box(13.5, 8.5, 5, 9, 1.5)],
  },
  'align-start': {
    tags: ['alinear al inicio', 'alinear a la izquierda', 'alinear objetos', 'align start', 'align left edge'],
    d: [vl(3.5, 3.25, 20.75), box(6.5, 5.5, 14.25, 5, 1.5), box(6.5, 13.5, 9, 5, 1.5)],
  },
  'align-end': {
    tags: ['alinear al final', 'alinear a la derecha', 'alinear objetos', 'align end', 'align right edge'],
    d: [vl(20.5, 3.25, 20.75), box(3.25, 5.5, 14.25, 5, 1.5), box(8.5, 13.5, 9, 5, 1.5)],
  },
  'distribute-horizontal': {
    tags: ['distribuir horizontal', 'espaciar', 'centrar entre guías', 'distribute horizontally', 'spacing'],
    d: [vl(3.5, 3.25, 20.75), vl(20.5, 3.25, 20.75), box(9.25, 6.25, 5.5, 11.5, 1.6)],
  },
  'distribute-vertical': {
    tags: ['distribuir vertical', 'espaciar', 'centrar entre guías', 'distribute vertically', 'spacing'],
    d: [hl(3.25, 20.75, 3.5), hl(3.25, 20.75, 20.5), box(6.25, 9.25, 11.5, 5.5, 1.6)],
  },

  // ── Coverage (round 2): what was missing in links, marks, forms and text ──
  'unlink': {
    tags: ['desvincular', 'quitar enlace', 'romper enlace', 'unlink', 'remove link', 'broken link'],
    // The two halves of Núcleo's `link`, pulled 1.4 apart along the diagonal and without the bridge;
    // two sparks on each side of the break, with their tips more than 3 apart.
    d: [
      'M12.06 16.53 9.59 19.01A3.25 3.25 0 0 1 4.99 14.41L7.47 11.94',
      'M11.94 7.47 14.41 4.99A3.25 3.25 0 0 1 19.01 9.59L16.53 12.06',
      vl(8, 2.75, 5.25),
      hl(2.75, 5.25, 8),
      vl(16, 18.75, 21.25),
      hl(18.75, 21.25, 16),
    ],
  },
  'bookmark-minus': {
    tags: ['quitar marcador', 'dejar de guardar', 'eliminar de guardados', 'remove bookmark', 'unsave'],
    d: [BOOKMARK, hl(9.5, 14.5, 9.5)],
  },
  'star-half': {
    tags: ['media estrella', 'calificación', 'reseña', 'valoración', 'half star', 'rating', 'review'],
    d: [...STAR_HALVES],
  },
  'pencil-sparkle': {
    tags: ['escribir con IA', 'redactar con IA', 'mejorar texto', 'asistente de escritura', 'ai writing', 'write with ai', 'rewrite'],
    // The whole pencil from `pencil-off` and the `magic-wand` sparkle in the free corner, more than
    // a 1.5 gap away from the body.
    d: [...pencil([4.1, 19.9], 20.5), spark(17.5, 17.5, 3.25)],
  },
  'copyright': {
    tags: ['derechos de autor', 'copyright', 'propiedad intelectual', 'legal', 'licencia', 'license'],
    d: [circ(12, 12, 9), arc(12, 12, 4.25, -45, -315).d],
  },
  'registered': {
    tags: ['marca registrada', 'registrado', 'marca', 'legal', 'registered', 'trademark'],
    // The R inside the `copyright` ring: a stem, a bowl of radius 2.25 and the leg coming out of it.
    d: [circ(12, 12, 9), rpath([[9.5, 16.5], [9.5, 7.5], [12.5, 7.5]], 0) + 'A2.25 2.25 0 0 1 12.5 12H9.5', line([12.25, 12], [14.75, 16.5])],
  },
  'trademark': {
    tags: ['marca comercial', 'marca', 'tm', 'legal', 'trademark', 'brand'],
    // ™: the T and the M, 3 apart center to center, at cap height.
    d: [hl(3.5, 10, 7.25), vl(6.75, 7.25, 16.75), rpath([[13, 16.75], [13, 7.25], [16.88, 13], [20.75, 7.25], [20.75, 16.75]], [0, 0.5, 0.5, 0.5, 0])],
  },
  'list-plus': {
    tags: ['agregar a la lista', 'nueva entrada', 'añadir elemento', 'colección', 'add to list', 'add item', 'collection'],
    // Three lines of text; the short last one leaves the corner free for the plus (arms of 2.75,
    // 3 apart center to center).
    d: [hl(3.75, 20.25, 6), hl(3.75, 20.25, 12), hl(3.75, 10.5, 18), vl(17, 15.25, 20.75), hl(14.25, 19.75, 18)],
  },
  'form': {
    tags: ['formulario', 'campos', 'registro', 'captura de datos', 'form', 'input fields', 'sign up'],
    // Two labels and their fields (containers: the signature corner), 3 apart center to center.
    d: [hl(4.25, 10.25, 3.25), box(3.25, 6.25, 17.5, 4.25, 1.5), hl(4.25, 10.25, 13.5), box(3.25, 16.5, 17.5, 4.25, 1.5)],
  },
  'aspect-ratio': {
    tags: ['relación de aspecto', 'proporción', 'formato', 'tamaño de imagen', 'aspect ratio', 'ratio', 'format'],
    // The landscape screen and two framing corners inside it, on the diagonal.
    d: [box(2.5, 5, 19, 14, 3.5), rpath([[6.25, 11.25], [6.25, 8.5], [9.25, 8.5]], 1), rpath([[14.75, 15.5], [17.75, 15.5], [17.75, 12.75]], 1)],
  },

  // ── Round 3: frames, layer order and components ──
  'frame': {
    tags: ['marco', 'mesa de trabajo', 'herramienta marco', 'frame', 'artboard', 'frame tool'],
    // The frame tool's grid: two lines each way that cross into a square and run past its corners.
    d: [vl(7.5, 3.25, 20.75), vl(16.5, 3.25, 20.75), hl(3.25, 20.75, 7.5), hl(3.25, 20.75, 16.5)],
  },
  'bring-to-front': {
    tags: ['traer al frente', 'primer plano', 'capa superior', 'bring to front', 'top layer'],
    d: layerEnd(true),
  },
  'send-to-back': {
    tags: ['enviar al fondo', 'último plano', 'capa inferior', 'send to back', 'bottom layer'],
    d: layerEnd(false),
  },
  'ungroup': {
    tags: ['desagrupar', 'separar objetos', 'deshacer grupo', 'ungroup', 'split group'],
    d: ungroup(),
  },
  'flatten': {
    tags: ['acoplar', 'aplanar', 'combinar capas', 'flatten', 'merge layers'],
    d: flatten(),
  },
  'mask': {
    tags: ['máscara', 'recorte', 'máscara de recorte', 'mask', 'clipping mask', 'clip content'],
    // The selection frame (the masked layer, its hidden part dashed) and the circle it shows through.
    d: [...MARQUEE, circ(12, 12, 5.75)],
  },
  'component-instance': {
    tags: ['instancia', 'componente', 'copia vinculada', 'instance', 'component instance'],
    d: componentInstance(),
  },
  'component-variants': {
    tags: ['variantes', 'conjunto de componentes', 'propiedades de variante', 'variants', 'component set'],
    d: componentVariants(),
  },
  'component-detach': {
    tags: ['desvincular instancia', 'separar componente', 'desacoplar', 'detach instance', 'detach'],
    d: componentDetach(),
  },
  'component-swap': {
    tags: ['cambiar componente', 'intercambiar instancia', 'reemplazar componente', 'swap instance', 'swap component'],
    d: componentSwap(),
  },
  'component-plus': {
    tags: ['crear componente', 'nuevo componente', 'componente', 'create component', 'add component'],
    // datos/component whole; the engine's badge clears its corner.
    d: COMPONENT,
    badge: badge('plus'),
  },

  // ── Round 3: boolean operations ──
  'boolean-union': {
    tags: ['unión', 'unir formas', 'booleana', 'union', 'boolean union', 'merge shapes'],
    d: [BOOL.union],
  },
  'boolean-subtract': {
    tags: ['restar', 'sustraer forma', 'booleana', 'subtract', 'boolean subtract'],
    d: [BOOL.aRest, ...run(BOOL.bTrack, 3, 3, 3)],
  },
  'boolean-intersect': {
    tags: ['intersecar', 'intersección', 'booleana', 'intersect', 'boolean intersect'],
    d: [BOOL.overlap, ...run(BOOL.aTrack, 3, 3, 3), ...run(BOOL.bTrack, 3, 3, 3)],
  },
  'boolean-exclude': {
    tags: ['excluir', 'excluir superposición', 'booleana', 'exclude', 'boolean exclude', 'xor'],
    d: [stretch(BOOL.aTrack, 0, BOOL.aTrack.total), stretch(BOOL.bTrack, 0, BOOL.bTrack.total), ...BOOL.overlapDashes],
  },

  // ── Round 3: curves, nodes and paths ──
  'bezier-curve': {
    tags: ['curva bézier', 'manejadores', 'editar curva', 'bezier curve', 'curve tool', 'handles'],
    d: bezier(),
  },
  'node-corner': {
    tags: ['nodo de esquina', 'punto de ancla', 'vértice', 'corner node', 'corner point'],
    // Two segments that meet at 90° on the square node: each leaves from the middle of one of its
    // lower corners.
    d: [sq(9.75, 6.75, 4.5, 4.5, 1), line([10.04, 10.96], [3.79, 17.21]), line([13.96, 10.96], [20.21, 17.21])],
  },
  'node-smooth': {
    tags: ['nodo suave', 'punto suave', 'manejadores simétricos', 'smooth node', 'smooth point'],
    d: nodeSmooth(),
  },
  'pen-tool-plus': {
    tags: ['añadir punto de ancla', 'agregar nodo', 'pluma', 'add anchor point', 'add node'],
    d: PEN_NIB,
    badge: badge('plus'),
  },
  'pen-tool-minus': {
    tags: ['eliminar punto de ancla', 'quitar nodo', 'pluma', 'delete anchor point', 'remove node'],
    d: PEN_NIB,
    badge: badge('minus'),
  },
  'path-join': {
    tags: ['unir trazado', 'juntar puntos', 'cerrar trazado', 'join path', 'join nodes'],
    // Two open curves (one S) that meet at a shared square node.
    d: (() => {
      const { nodes, out } = pathNodes([0.5]);
      return [cubicPart(S_CURVE, 0, out(0.5, -1)), nodes[0], cubicPart(S_CURVE, out(0.5, 1), 1)];
    })(),
  },
  'path-break': {
    tags: ['cortar trazado', 'romper trazado', 'dividir nodo', 'break path', 'cut path', 'split path'],
    // The same S broken in the middle, a square node on each side of the gap.
    d: (() => {
      const { nodes, out } = pathNodes([0.35, 0.65]);
      return [cubicPart(S_CURVE, 0, out(0.35, -1)), nodes[0], nodes[1], cubicPart(S_CURVE, out(0.65, 1), 1)];
    })(),
  },
  'path-offset': {
    tags: ['desplazar trazado', 'contorno paralelo', 'copia desplazada', 'offset path', 'outline offset'],
    d: pathOffset(),
  },
  'guides': {
    tags: ['guías', 'reglas', 'líneas guía', 'guides', 'ruler guides'],
    // The rulers' corner at the top left and a guide pulled from each one, crossing the canvas.
    d: [
      rpath([[3.25, 3.25], [20.75, 3.25], [20.75, 7.25], [7.25, 7.25], [7.25, 20.75], [3.25, 20.75]], [2.5, 1.25, 1.25, 0, 1.25, 1.25], { closed: true }),
      vl(14, 7.25, 20.75),
      hl(7.25, 20.75, 14),
    ],
  },
  'pixel-grid': {
    tags: ['cuadrícula de píxeles', 'píxeles', 'ajustar a píxel', 'pixel grid', 'snap to pixel'],
    // At 15 (not 17.5): nine cells are dense, and the marked one keeps its dot clear of its lines.
    d: [box(4.5, 4.5, 15, 15, 2.5), vl(9.5, 4.5, 19.5), vl(14.5, 4.5, 19.5), hl(4.5, 19.5, 9.5), hl(4.5, 19.5, 14.5), dot(12, 12, 0.3)],
  },
  'snap-to-grid': {
    tags: ['ajustar a la cuadrícula', 'imantar', 'encajar', 'snap to grid', 'snapping'],
    // A grid of two lines each way and a node sitting on one of its crossings; the grid stops 3 short
    // of the node. A single crossing with motion ticks read as a sparkle or a crosshair.
    d: [vl(7.5, 3.25, 20.75), hl(3.25, 20.75, 16.5), vl(16.5, 12.5, 20.75), hl(3.25, 11.5, 7.5), sq(14.5, 5.5, 4, 4, 1.25)],
  },
  'auto-layout-horizontal': {
    tags: ['diseño automático horizontal', 'apilar en fila', 'fila', 'auto layout', 'horizontal stack'],
    // Two cards in a row and the arrow they are laid along. Three cards fit only 3.83 wide, and three
    // slots that narrow read as «000».
    d: [box(3.25, 3.25, 7.25, 10, 2), box(13.5, 3.25, 7.25, 10, 2), hl(3.25, 20.75, 18.5), head([20.75, 18.5], [1, 0], 3)],
  },
  'auto-layout-vertical': {
    tags: ['diseño automático vertical', 'apilar en columna', 'columna', 'auto layout', 'vertical stack'],
    // auto-layout-horizontal turned 90°: the cards drawn again so the signature corner stays put.
    d: [box(10.75, 3.25, 10, 7.25, 2), box(10.75, 13.5, 10, 7.25, 2), vl(5.5, 3.25, 20.75), head([5.5, 20.75], [0, 1], 3)],
  },
  'auto-layout-wrap': {
    tags: ['ajuste automático', 'salto de fila', 'envolver elementos', 'flex wrap', 'wrap'],
    // Two cards in the first row and one in the second; the arrow returns from the end of the first
    // row to the start of the second.
    d: [
      box(3.25, 3.25, 5.5, 5.5, 1.5),
      box(11.75, 3.25, 5.5, 5.5, 1.5),
      box(3.25, 15.25, 5.5, 5.5, 1.5),
      'M20.25 6V14.5A3.5 3.5 0 0 1 16.75 18H11.75',
      head([11.75, 18], [-1, 0], 3),
    ],
  },
  'gap-horizontal': {
    tags: ['espacio entre elementos', 'separación horizontal', 'medianil', 'gap', 'item spacing', 'column gap'],
    d: [box(3.25, 3.25, 3.5, 17.5, 1.5), box(17.25, 3.25, 3.5, 17.5, 1.5), hl(9.75, 14.25, 12), vl(9.75, 9.5, 14.5), vl(14.25, 9.5, 14.5)],
  },
  'gap-vertical': {
    tags: ['espacio entre filas', 'separación vertical', 'interlineado de elementos', 'gap', 'row gap'],
    d: [box(3.25, 3.25, 17.5, 3.5, 1.5), box(3.25, 17.25, 17.5, 3.5, 1.5), vl(12, 9.75, 14.25), hl(9.5, 14.5, 9.75), hl(9.5, 14.5, 14.25)],
  },
  // Padding and margin dotted, as the box model is drawn: dashed, the margin's frame was the selection
  // marquee around a box (select-all).
  'padding': {
    tags: ['relleno', 'espaciado interior', 'margen interno', 'padding', 'inner spacing'],
    d: [box(3.25, 3.25, 17.5, 17.5, 4), ...dotted(track([[6.25, 6.25], [17.75, 6.25], [17.75, 17.75], [6.25, 17.75]], 1, true))],
  },
  'margin': {
    tags: ['margen', 'margen exterior', 'márgenes de página', 'margin', 'outer spacing'],
    // The dotted frame keeps the signature corner of the box inside it, 3 from it there too.
    d: [box(6.25, 6.25, 11.5, 11.5, 2), ...dotted(track([[3.25, 3.25], [20.75, 3.25], [20.75, 20.75], [3.25, 20.75]], [4, 4, 0, 4], true))],
  },
  'hug-contents': {
    tags: ['ajustar al contenido', 'abrazar contenido', 'tamaño automático', 'hug contents', 'fit content'],
    d: [box(10.5, 6.75, 3, 10.5, 1.25), hl(2.75, 7.5, 12), head([7.5, 12], [1, 0], 2.5), hl(16.5, 21.25, 12), head([16.5, 12], [-1, 0], 2.5)],
  },
  'fill-container': {
    tags: ['llenar contenedor', 'estirar', 'ancho completo', 'fill container', 'stretch'],
    d: [vl(2.75, 5.25, 18.75), vl(21.25, 5.25, 18.75), box(10.5, 6.75, 3, 10.5, 1.25), hl(5.75, 10.5, 12), head([5.75, 12], [-1, 0], 2.5), hl(13.5, 18.25, 12), head([18.25, 12], [1, 0], 2.5)],
  },
  'constraints': {
    tags: ['restricciones', 'anclar', 'fijar a los bordes', 'constraints', 'pin to edges'],
    // The layer at the center of its frame and a pin standing on the middle of each edge, 3 short of
    // the layer, as in the constraints widget. Pins joining the layer to the edges made a cross that
    // quartered the frame (producto/empathy-map).
    d: [box(3.25, 3.25, 17.5, 17.5, 4), box(9.25, 9.25, 5.5, 5.5, 1.5), vl(12, 3.25, 6.25), vl(12, 17.75, 20.75), hl(3.25, 6.25, 12), hl(17.75, 20.75, 12)],
  },
  'tidy-up': {
    tags: ['ordenar', 'acomodar en cuadrícula', 'alinear elementos', 'tidy up', 'arrange'],
    // Three tiles in place and the dashed slot of the fourth (the signature corner on the group).
    d: (() => {
      const slot = track([[14.25, 14.25], [20.75, 14.25], [20.75, 20.75], [14.25, 20.75]], [1.75, 1.75, 0, 1.75], true);
      return [sq(3.25, 3.25, 6.5, 6.5, 1.75), sq(14.25, 3.25, 6.5, 6.5, 1.75), sq(3.25, 14.25, 6.5, 6.5, 1.75), ...ring(slot, 4, 3, cornerAt(slot, 0))];
    })(),
  },
  'constrain-proportions': {
    tags: ['mantener proporción', 'bloquear relación de aspecto', 'proporcional', 'constrain proportions', 'lock aspect ratio'],
    d: constrainProportions(),
  },
  'align-center-horizontal': {
    tags: ['centrar horizontalmente', 'alinear al centro', 'eje vertical', 'align horizontal centers', 'center horizontally'],
    d: [box(5.75, 5.5, 12.5, 5, 1.5), box(8.25, 13.5, 7.5, 5, 1.5), vl(12, 3.25, 20.75)],
  },
  'align-middle': {
    tags: ['alinear al medio', 'centrar verticalmente', 'eje horizontal', 'align vertical centers', 'align middle'],
    d: [box(5.5, 5.75, 5, 12.5, 1.5), box(13.5, 8.25, 5, 7.5, 1.5), hl(3.25, 20.75, 12)],
  },

  // ── Round 3: transform and appearance ──
  'skew': {
    tags: ['sesgar', 'inclinar', 'cizallar', 'skew', 'shear'],
    d: [rpath([[7.25, 8.75], [20.75, 8.75], [16.75, 20.75], [3.25, 20.75]], 1.75, { closed: true }), hl(7.75, 18.25, 3.75), head([18.25, 3.75], [1, 0], 2.5)],
  },
  'perspective': {
    tags: ['perspectiva', 'distorsionar', 'deformar esquinas', 'perspective', 'distort'],
    d: perspective(),
  },
  'warp': {
    tags: ['deformar', 'malla', 'envolvente', 'warp', 'mesh warp'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4), WARP.v, WARP.h],
  },
  'opacity': {
    tags: ['opacidad', 'transparencia', 'canal alfa', 'opacity', 'transparency'],
    // Small dots 3 apart, the size of the gradients' halftone: four large ones read as a die.
    d: [SWATCH.whole, SWATCH.diagonal, ...[[17.5, 11.5], [14.5, 14.5], [17.5, 14.5], [11.5, 17.5], [14.5, 17.5], [17.5, 17.5]].map((p) => dot(...p, 0.3))],
  },
  'blend-mode': {
    tags: ['modo de fusión', 'multiplicar', 'superponer', 'blend mode', 'multiply'],
    d: blendMode(),
  },
  'gradient-linear': {
    tags: ['degradado lineal', 'gradiente', 'relleno degradado', 'linear gradient', 'gradient'],
    // A halftone: four columns of small dots, five, three, two and one, left to right.
    d: [GRADIENT, ...[6, 9, 12, 15, 18].map((y) => dot(7, y, 0.3)), ...[7.5, 12, 16.5].map((y) => dot(10.5, y, 0.3)), ...[9.75, 14.25].map((y) => dot(14, y, 0.3)), dot(17.5, 12, 0.3)],
  },
  'gradient-radial': {
    tags: ['degradado radial', 'gradiente circular', 'relleno degradado', 'radial gradient', 'gradient'],
    // The halftone from the center out: a dot, a close ring of six and a sparse ring of six between them.
    d: [GRADIENT, dot(12, 12, 0.3), ...[-90, -30, 30, 90, 150, 210].map((t) => dot(...polar(12, 12, 3, t), 0.3)), ...[-60, 0, 60, 120, 180, 240].map((t) => dot(...polar(12, 12, 6.25, t), 0.3))],
  },
  'gradient-angular': {
    tags: ['degradado angular', 'degradado cónico', 'gradiente', 'angular gradient', 'conic gradient'],
    d: gradientAngular(),
  },
  'shadow-drop': {
    tags: ['sombra paralela', 'sombra', 'efecto', 'drop shadow', 'shadow'],
    d: [sq(3.25, 3.25, 14.25, 14.25, 3.5), rpath([[6.5, 20.75], [20.75, 20.75], [20.75, 6.5]], [0, 6.5, 0])],
  },
  'shadow-inner': {
    tags: ['sombra interior', 'sombra interna', 'efecto', 'inner shadow', 'inset shadow'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4), rpath([[6.25, 14.25], [6.25, 6.25], [14.25, 6.25]], [0, 1, 0])],
  },
  'blur': {
    tags: ['desenfoque', 'difuminar', 'suavizar', 'blur', 'layer blur'],
    // A soft edge: sixteen small dots 3.25 out, a halo that greys out at small sizes. Twelve large
    // ones were lugares/sun-dim's rays.
    d: [circ(12, 12, 4.75), ...Array.from({ length: 16 }, (_, i) => dot(...polar(12, 12, 8, -90 + i * 22.5), 0.3))],
  },
  'blur-background': {
    tags: ['desenfoque de fondo', 'vidrio esmerilado', 'translúcido', 'background blur', 'frosted glass'],
    d: blurBackground(),
  },
  'corner-radius-independent': {
    tags: ['radios independientes', 'esquinas individuales', 'radio de esquina', 'independent corners', 'corner radius'],
    // Each corner of the square on its own, 3.5 apart at the middle of each side, and each with a
    // radius plainly its own: the top left a full quarter circle (corner-radius's), the bottom right
    // square. With radii close to each other the four read as navegacion/fullscreen's brackets.
    d: [
      rpath([[3.25, 10.25], [3.25, 3.25], [10.25, 3.25]], [0, 7, 0], { circular: true }),
      rpath([[13.75, 3.25], [20.75, 3.25], [20.75, 10.25]], [0, 3, 0]),
      rpath([[20.75, 13.75], [20.75, 20.75], [13.75, 20.75]], 0),
      rpath([[10.25, 20.75], [3.25, 20.75], [3.25, 13.75]], [0, 1.5, 0]),
    ],
  },
  'stroke-align-inside': {
    tags: ['trazo interior', 'alinear trazo', 'borde interior', 'stroke inside', 'inside stroke'],
    d: strokeAlign(0),
  },
  'stroke-align-center': {
    tags: ['trazo centrado', 'alinear trazo', 'borde centrado', 'stroke center', 'center stroke'],
    d: strokeAlign(1),
  },
  'stroke-align-outside': {
    tags: ['trazo exterior', 'alinear trazo', 'borde exterior', 'stroke outside', 'outside stroke'],
    d: strokeAlign(2),
  },
  'stroke-cap-butt': {
    tags: ['extremo plano', 'remate de línea', 'terminación', 'butt cap', 'line cap'],
    d: strokeCap('butt'),
  },
  'stroke-cap-round': {
    tags: ['extremo redondo', 'remate de línea', 'terminación', 'round cap', 'line cap'],
    d: strokeCap('round'),
  },
  'stroke-cap-square': {
    tags: ['extremo cuadrado', 'remate de línea', 'terminación', 'square cap', 'projecting cap'],
    d: strokeCap('square'),
  },
  'stroke-join-miter': {
    tags: ['unión en ángulo', 'esquina de trazo', 'inglete', 'miter join', 'line join'],
    d: strokeJoin('miter'),
  },
  'stroke-join-round': {
    tags: ['unión redonda', 'esquina de trazo', 'esquina redondeada', 'round join', 'line join'],
    d: strokeJoin('round'),
  },
  'stroke-join-bevel': {
    tags: ['unión biselada', 'esquina de trazo', 'bisel', 'bevel join', 'line join'],
    d: strokeJoin('bevel'),
  },
  'stroke-outline': {
    tags: ['contornear trazo', 'convertir trazo en forma', 'expandir trazo', 'outline stroke', 'expand stroke'],
    d: strokeOutline(),
  },

  // ── Round 3: type ──
  'text-path': {
    tags: ['texto en trazado', 'texto curvo', 'texto sobre curva', 'type on a path', 'text on path'],
    d: textPath(),
  },
  'letter-spacing': {
    tags: ['espaciado entre letras', 'tracking', 'interletraje', 'letter spacing', 'character spacing'],
    // The capital A over a double arrow wider than it, between two bars.
    d: [line([7, 13.25], [12, 3.25], [17, 13.25]), hl(8.67, 15.33, 9.92), vl(3.25, 16.75, 20.75), vl(20.75, 16.75, 20.75), hl(6.25, 17.75, 18.75), head([6.25, 18.75], [-1, 0], 2.5), head([17.75, 18.75], [1, 0], 2.5)],
  },
  'paragraph-spacing': {
    tags: ['espaciado entre párrafos', 'espacio antes', 'espacio después', 'paragraph spacing', 'space between paragraphs'],
    // Two paragraphs of two lines (on the portrait keyline's height) and a double arrow standing in the
    // gap between them, 3 from each, its heads 3 apart. Beside the lines, spanning them, it was
    // line-spacing.
    d: [hl(3.25, 20.75, 2.75), hl(3.25, 14.25, 5.75), hl(3.25, 20.75, 18.25), hl(3.25, 14.25, 21.25), vl(12, 8.75, 15.25), head([12, 8.75], [0, -1], 2.5), head([12, 15.25], [0, 1], 2.5)],
  },
  'font-weight': {
    tags: ['peso de fuente', 'grosor', 'negrita y fina', 'font weight', 'weight'],
    d: [...T_LIGHT, T_HEAVY],
  },
  'letter-case-upper': {
    tags: ['mayúsculas', 'todo en mayúsculas', 'versalitas', 'uppercase', 'all caps'],
    d: [...capA(3.25), ...capA(13.5)],
  },
  'letter-case-lower': {
    tags: ['minúsculas', 'todo en minúsculas', 'caja baja', 'lowercase', 'small letters'],
    d: [...smallA(7, 13), ...smallA(17, 13)],
  },
  'underline-double': {
    tags: ['subrayado doble', 'doble subrayado', 'formato', 'double underline'],
    d: [U_HIGH, hl(5.25, 18.75, 17.25), hl(5.25, 18.75, 20.25)],
  },
  'underline-wavy': {
    tags: ['subrayado ondulado', 'subrayado de error', 'formato', 'wavy underline', 'squiggly underline'],
    d: [U_HIGH, wave(4.25, 19.75, 18.75)],
  },
  'overline': {
    tags: ['línea superior', 'sobrerrayado', 'formato', 'overline'],
    d: ['M7.25 8.25V15.25A4.75 4.75 0 0 0 16.75 15.25V8.25', hl(5.25, 18.75, 4.25)],
  },
  'text-truncate': {
    tags: ['truncar texto', 'puntos suspensivos', 'desbordamiento', 'truncate', 'text overflow', 'ellipsis'],
    // A full line and one that stops against the edge, its end turned into an ellipsis.
    d: [vl(20.75, 5.25, 18.75), hl(3.25, 17.25, 8.5), hl(3.25, 7.25, 15.5), ...[10.75, 14, 17.25].map((x) => dot(x, 15.5, 0.5))],
  },
  'text-auto-width': {
    tags: ['ancho automático', 'cuadro de texto', 'crecer a lo ancho', 'auto width', 'text box'],
    d: [...textBox(6.25, 4.25, 17.75, 19.75, [[10.5, 13.5], [8.2, 15.8]]), hl(9.25, 14.75, 7.25), vl(12, 7.25, 16.75), hl(2.25, 6.25, 12), head([2.25, 12], [-1, 0], 2.5), hl(17.75, 21.75, 12), head([21.75, 12], [1, 0], 2.5)],
  },
  'text-auto-height': {
    tags: ['alto automático', 'cuadro de texto', 'crecer hacia abajo', 'auto height', 'text box'],
    d: [...textBox(4.25, 3.25, 19.75, 14.75, [[8.2, 15.8], [7.5, 10.5]]), hl(9.25, 14.75, 6.25), vl(12, 6.25, 11.75), vl(12, 14.75, 20.75), head([12, 20.75], [0, 1], 2.5)],
  },
  'text-vertical': {
    tags: ['texto vertical', 'escritura vertical', 'orientación del texto', 'vertical text', 'text orientation'],
    // A column of letters (a T and three strokes) and the arrow it is read along.
    d: [hl(5, 11, 3.75), vl(8, 3.75, 9.25), hl(6, 10, 12.5), hl(6, 10, 16.25), hl(6, 10, 20), vl(16.5, 3.75, 20), head([16.5, 20], [0, 1], 3)],
  },
  'drop-cap': {
    tags: ['letra capital', 'capitular', 'inicial grande', 'drop cap', 'initial'],
    d: [line([3.25, 14.25], [7, 3.75], [10.75, 14.25]), hl(4.41, 9.59, 11), hl(13.75, 20.75, 4.25), hl(13.75, 20.75, 9), hl(13.75, 18.25, 13.75), hl(3.25, 20.75, 19)],
  },
  'glyphs': {
    tags: ['glifos', 'caracteres especiales', 'símbolos', 'glyphs', 'special characters'],
    // An omega, as word processors mark the special characters. In a grid of cells there was no room
    // for a glyph inside one, and a tilde beside three empty cells read as apps.
    d: (() => {
      const [a, b] = [polar(12, 10.75, 6.25, 120), polar(12, 10.75, 6.25, 60)];
      return [`M4.5 19.25H${f(a[0])}V${f(a[1])}A6.25 6.25 0 1 1 ${f(b[0])} ${f(b[1])}V19.25H19.5`];
    })(),
  },
  'text-select': {
    tags: ['seleccionar texto', 'selección de texto', 'tiradores', 'select text', 'text selection'],
    // A line between two selection handles: a bar with its knob above (start) and below (end).
    d: [hl(8.25, 15.75, 12), vl(5.25, 8.25, 15.75), circ(5.25, 6.75, 1.5), vl(18.75, 8.25, 15.75), circ(18.75, 17.25, 1.5)],
  },
  'indent-first-line': {
    tags: ['sangría de primera línea', 'sangría', 'párrafo', 'first line indent', 'indent'],
    d: [hl(9.25, 20.25, 9.5), hl(3.75, 20.25, 13), hl(3.75, 20.25, 16.5), hl(3.75, 14.25, 20), roundpoly([[6.5, 3.5], [12, 3.5], [9.25, 6.5]], [0.5, 0.5, 0.3])],
  },
  'indent-hanging': {
    tags: ['sangría francesa', 'sangría colgante', 'bibliografía', 'hanging indent', 'indent'],
    // indent-first-line turned over: the ruler's lower marker, pointing up under the indented lines.
    // Without it the lines were align-right's.
    d: [hl(3.75, 20.25, 4), hl(9.25, 20.25, 7.5), hl(9.25, 20.25, 11), hl(9.25, 16.25, 14.5), roundpoly([[6.5, 20.5], [12, 20.5], [9.25, 17.5]], [0.5, 0.5, 0.3])],
  },
  'heading-4': {
    tags: ['encabezado 4', 'subtítulo', 'h4', 'heading 4'],
    d: [...H_SMALL, DIGIT[4]],
  },
  'heading-5': {
    tags: ['encabezado 5', 'subtítulo', 'h5', 'heading 5'],
    d: [...H_SMALL, DIGIT[5]],
  },
  'heading-6': {
    tags: ['encabezado 6', 'subtítulo', 'h6', 'heading 6'],
    d: [...H_SMALL, ...DIGIT[6]],
  },

  // ── Round 3: document blocks ──
  'list-nested': {
    tags: ['lista anidada', 'lista multinivel', 'subelementos', 'nested list', 'multilevel list'],
    d: [[5, 3.75, 4.5], [10, 8.75, 9.5], [10, 8.75, 14.5], [5, 3.75, 19.5]].flatMap(([x, , y]) => [dot(x, y), hl(x + 4.25, 20.25, y)]),
  },
  'divider': {
    tags: ['divisor', 'separador', 'línea horizontal', 'divider', 'horizontal rule'],
    // A rule across the whole width between two short centered lines of text, clear of both. Left
    // aligned, short, long and short read as align-left.
    d: [hl(8.25, 15.75, 4.25), hl(2.75, 21.25, 12), hl(8.25, 15.75, 19.75)],
  },
  'callout': {
    tags: ['destacado', 'aviso', 'nota resaltada', 'callout', 'note block'],
    // The block's mark is núcleo's important sign: a small circle beside two lines was an ID card.
    d: [box(2.5, 5, 19, 14, 3.5), vl(7.25, 8.5, 11.5), dot(7.25, 15.2), hl(11.25, 17.75, 10.25), hl(11.25, 15.5, 13.75)],
  },
  'toggle-list': {
    tags: ['lista desplegable', 'bloque plegable', 'mostrar y ocultar', 'toggle list', 'collapsible'],
    d: [roundpoly([[4, 3.75], [7.5, 6], [4, 8.25]], 0.6), hl(10.5, 20.25, 6), hl(10.5, 18, 12), hl(10.5, 16, 18)],
  },
  'table-plus': {
    tags: ['insertar tabla', 'nueva tabla', 'agregar tabla', 'insert table', 'add table'],
    d: TABLE,
    badge: badge('plus'),
  },
  'border-all': {
    tags: ['todos los bordes', 'bordes de celda', 'cuadrícula', 'all borders', 'cell borders'],
    d: BORDER('outer', 'h', 'v'),
  },
  'border-outer': {
    tags: ['bordes exteriores', 'contorno', 'bordes de celda', 'outer borders', 'outline border'],
    d: BORDER('outer'),
  },
  'border-inner': {
    tags: ['bordes interiores', 'líneas internas', 'bordes de celda', 'inner borders', 'inside borders'],
    d: BORDER('h', 'v'),
  },
  'border-none': {
    tags: ['sin bordes', 'quitar bordes', 'bordes de celda', 'no borders', 'clear borders'],
    d: BORDER(),
  },
  'border-top': {
    tags: ['borde superior', 'línea arriba', 'bordes de celda', 'top border'],
    d: BORDER('top'),
  },
  'border-bottom': {
    tags: ['borde inferior', 'línea abajo', 'bordes de celda', 'bottom border'],
    d: BORDER('bottom'),
  },
  'border-left': {
    tags: ['borde izquierdo', 'línea a la izquierda', 'bordes de celda', 'left border'],
    d: BORDER('left'),
  },
  'border-right': {
    tags: ['borde derecho', 'línea a la derecha', 'bordes de celda', 'right border'],
    d: BORDER('right'),
  },
  'border-horizontal': {
    tags: ['bordes horizontales internos', 'líneas entre filas', 'bordes de celda', 'inner horizontal borders', 'horizontal borders'],
    d: BORDER('h'),
  },
  'border-vertical': {
    tags: ['bordes verticales internos', 'líneas entre columnas', 'bordes de celda', 'inner vertical borders', 'vertical borders'],
    d: BORDER('v'),
  },
  'footnote': {
    tags: ['nota al pie', 'referencia', 'cita', 'footnote', 'endnote'],
    // A page: a short line ending in a raised mark and a full one, then the short rule of the notes
    // and the note, opening with the same mark. Without it the note was one more line of text and the
    // raised mark a notification dot.
    d: [PAGE, hl(8.25, 12.5, 7.25), dot(15.75, 5.75), hl(8.25, 15.75, 10.75), hl(8.25, 11.25, 14), dot(8.75, 17.75), hl(12.5, 15.75, 17.75)],
  },
  'figure-caption': {
    tags: ['pie de foto', 'leyenda', 'título de figura', 'caption', 'figure caption'],
    // The photo of image-wrap and image-break and two lines of caption under it. With one short
    // centered line it was a monitor on its stand.
    d: [...photo(3.25, 3.25, 17.5, 10.75, [10.5, 9], [15.75, 7.25]), hl(3.25, 20.75, 17.5), hl(3.25, 13.25, 20.75)],
  },
  'table-of-contents': {
    tags: ['índice', 'tabla de contenido', 'contenido', 'table of contents', 'toc'],
    // Three entries, each with its dotted leader to the page number at the right.
    d: [6, 12, 18].flatMap((y) => [hl(3.25, 9.25, y), dot(12.5, y, 0.3), dot(15.5, y, 0.3), hl(18.75, 20.75, y)]),
  },
  'document-outline': {
    tags: ['esquema del documento', 'títulos', 'navegación del documento', 'document outline', 'outline view'],
    d: [hl(3.75, 20.25, 4.5), vl(5.25, 7.5, 19.5), hl(8.75, 18.25, 9.5), hl(12.25, 18.25, 14.5), hl(8.75, 15.75, 19.5)],
  },
  'page-orientation': {
    tags: ['orientación de página', 'vertical u horizontal', 'girar página', 'page orientation', 'portrait landscape'],
    // A portrait page behind a landscape one (1.5 clear of it) and the arc arrow from one to the other.
    d: (() => {
      const a = arc(14.75, 9.25, 4.5, -90, 0);
      return [rpath([[11.75, 9.25], [11.75, 3.25], [3.25, 3.25], [3.25, 15.25], [6.25, 15.25]], [0, 2.25, 2.25, 2.25, 0]), box(9.25, 12.25, 11.5, 8.5, 2.25), a.d, head(a.end, a.tangent, 2.5)];
    })(),
  },
  'page-header': {
    tags: ['encabezado de página', 'cabecera', 'membrete', 'page header', 'header'],
    d: pageBand(6.25, 9.5),
  },
  'page-footer': {
    tags: ['pie de página', 'número de página', 'pie', 'page footer', 'footer'],
    d: pageBand(17.75, 14.5),
  },
  'image-wrap': {
    tags: ['ajustar texto a la imagen', 'texto alrededor', 'imagen en línea', 'wrap text', 'text wrapping'],
    d: [...photo(3.25, 3.25, 9.5, 8.5, [9, 8.5], [6.25, 6.25]), hl(15.75, 20.75, 4), hl(15.75, 20.75, 7.5), hl(15.75, 20.75, 11), hl(3.25, 20.75, 15.25), hl(3.25, 14.25, 19)],
  },
  'image-break': {
    tags: ['imagen entre párrafos', 'romper texto', 'arriba y abajo', 'break text', 'top and bottom'],
    d: [hl(3.25, 20.75, 3.75), ...photo(3.25, 7.25, 17.5, 9.5, [10, 12], [15.75, 10.25]), hl(3.25, 20.75, 20.25)],
  },
  'track-changes': {
    tags: ['control de cambios', 'modo sugerencia', 'revisión', 'track changes', 'suggesting'],
    d: TRACK_CHANGES,
  },
  'change-accept': {
    tags: ['aceptar cambio', 'aprobar sugerencia', 'revisión', 'accept change', 'accept suggestion'],
    d: TRACK_CHANGES,
    badge: badge('check'),
  },
  'change-reject': {
    tags: ['rechazar cambio', 'descartar sugerencia', 'revisión', 'reject change', 'reject suggestion'],
    d: TRACK_CHANGES,
    badge: badge('x'),
  },
  'comment-inline': {
    tags: ['comentario en el texto', 'anotación', 'nota al margen', 'inline comment', 'comment'],
    // Lines of text, one span bracketed, and the drop's bubble in the margin at its height (large:
    // small, beside the bracket, it read as a letter).
    d: [
      rpath([[4, 9.5], [2.5, 9.5], [2.5, 14.5], [4, 14.5]], 0.5),
      hl(5.5, 7.5, 12),
      rpath([[9, 9.5], [10.5, 9.5], [10.5, 14.5], [9, 14.5]], 0.5),
      drop(17.75, 12, 4.25),
      hl(2.5, 10.5, 5.5),
      hl(2.5, 8.5, 18.5),
    ],
  },
  'spell-check': {
    tags: ['ortografía', 'revisar ortografía', 'corrector', 'spell check', 'spelling'],
    d: [hl(3.25, 15.25, 5.5), wave(3.25, 15.25, 9.75, 4, 1), line([10.75, 16.5], [13.75, 19.5], [20.75, 12.5])],
  },
  'word-count': {
    tags: ['contar palabras', 'recuento', 'estadísticas', 'word count', 'character count'],
    // Two lines of text over a tally: four strokes and the diagonal that crosses them.
    d: [hl(3.25, 20.75, 4.5), hl(3.25, 14.25, 8.5), ...[6.5, 9.5, 12.5, 15.5].map((x) => vl(x, 12.75, 20.25)), line([4.25, 19], [17.75, 14])],
  },
  'replace': {
    tags: ['reemplazar', 'buscar y reemplazar', 'sustituir', 'replace', 'find and replace'],
    d: (() => {
      // The head tilted 10° out of the arc: along the tangent its inner arm and the arc merged at light
      const a = arc(12.25, 11.75, 5.5, -90, 0);
      const t = rot(a.tangent, [0, 0], -10);
      return [sq(3.25, 3.25, 6, 6, 1.75), circ(17.75, 17.75, 3), a.d, head(a.end, t, 2.75)];
    })(),
  },
  'replace-all': {
    tags: ['reemplazar todo', 'sustituir todas', 'buscar y reemplazar', 'replace all'],
    d: replaceAll(),
  },
  'save-all': {
    tags: ['guardar todo', 'guardar todos los documentos', 'disquetes', 'save all'],
    // save's floppy at 14 and the edge of a second one behind it (3.5 from the front one).
    d: [rpath([[16.25, 3.25], [3.25, 3.25], [3.25, 16.25]], [0, 3, 0]), box(6.75, 6.75, 14, 14, 3), rpath([[11.25, 6.75], [11.25, 10.25], [16.25, 10.25], [16.25, 6.75]], [0, 1, 1, 0]), sq(10.5, 14.25, 6.5, 3.5, 1.25)],
  },
  'redact': {
    tags: ['ocultar texto', 'tachar con barra', 'censurar', 'redact', 'redaction'],
    // Three lines; the end of the middle one becomes a block (filled in the fill style). A pill in the
    // middle of a line read as a toggle or a slider.
    d: [hl(3.25, 20.75, 5.25), hl(3.25, 7.25, 12), sq(10.25, 9.75, 10.5, 4.5, 1.25), hl(3.25, 15.25, 18.75)],
  },
};

// ── Fill (DESIGN.md › Fill), by index into d: `solid` is filled (and keeps its stroke; closed shapes
// only), `cut` is knocked out at stroke width, `lines` stays a line with a 1.5 gap, and `wire` stays
// a line flush with the fill. Anything made only of open lines (letters, lines of text, arrows)
// gets `fill: false`.
const all = (name) => icons[name].d.map((_, i) => i);
/** Every index after the first `n` (a dotted outline after its shape). */
const after = (name, n = 1) => all(name).slice(n);
const FILL = {
  'copy': { solid: [1], lines: [0] },
  'duplicate': { solid: [1], lines: [0], cut: [2, 3] },
  'copy-check': { solid: [1], lines: [0], cut: [2] },
  // The scissors' eyes filled; the blades stay as lines, flush with them.
  'scissors': { solid: [0, 1], wire: [2, 3, 4] },
  'wastebasket': { solid: [0], cut: [1, 2] },
  'backspace': { solid: [0], cut: [1, 2] },
  'quote': { solid: [0, 1] },
  'text-box': { solid: [0], cut: [1, 2] },
  'text-search': { solid: [4], wire: [5], lines: [0, 1, 2, 3] },
  'image-plus': { solid: [0], cut: [1, 2] },
  'rotate-right': { solid: [0], lines: [1, 2] },
  'rotate-left': { solid: [0], lines: [1, 2] },
  'flip-horizontal': { solid: [0, 4], lines: [1, 2, 3] },
  'flip-vertical': { solid: [0, 4], lines: [1, 2, 3] },
  'resize': { solid: [0], lines: [1, 2] },
  // The handles filled; the frame's edges join them as lines.
  'transform': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7] },
  'eraser': { solid: [0], cut: [1], lines: [2] },
  'vector-path': { solid: [0, 1, 2], wire: [3, 4] },
  'magic-wand': { solid: [0, 2, 3, 4], cut: [1] },
  'palette': { solid: [0], cut: [1, 2, 3, 4] },
  'shapes': { solid: all('shapes') },
  'pencil-plus': { solid: [0], cut: [1, 2] },
  'pencil-sparkle': { solid: [0, 3], cut: [1, 2] },
  'compose': { solid: [0] },
  'eye': { solid: [0], cut: [1] },
  'bookmark': { solid: [0] },
  'bookmark-plus': { solid: [0], cut: [1, 2] },
  'bookmark-check': { solid: [0], cut: [1] },
  'bookmark-minus': { solid: [0], cut: [1] },
  'star': { solid: [0] },
  'heart': { solid: [0] },
  'flag': { solid: [1], wire: [0] },
  'share-nodes': { solid: [0, 1, 2], wire: [3, 4] },
  'select-all': { solid: [8], lines: [0, 1, 2, 3, 4, 5, 6, 7] },
  'group': { solid: [8, 9], lines: [0, 1, 2, 3, 4, 5, 6, 7] },
  'bring-forward': { solid: [0], lines: [1, 2, 3] },
  'send-backward': { solid: [0], lines: [1, 2, 3] },
  'align-top': { solid: [1, 2], lines: [0] },
  'align-bottom': { solid: [1, 2], lines: [0] },
  'align-start': { solid: [1, 2], lines: [0] },
  'align-end': { solid: [1, 2], lines: [0] },
  'distribute-horizontal': { solid: [2], lines: [0, 1] },
  'distribute-vertical': { solid: [2], lines: [0, 1] },
  'copyright': { solid: [0], cut: [1] },
  'registered': { solid: [0], cut: [1, 2] },
  'form': { solid: [1, 3], lines: [0, 2] },
  'aspect-ratio': { solid: [0], cut: [1, 2] },
  // Round 3
  'bring-to-front': { solid: [0], lines: [1, 2, 3, 4] },
  'send-to-back': { solid: [0], lines: [1, 2, 3, 4] },
  'ungroup': { solid: [3, 7], lines: [0, 1, 2, 4, 5, 6] },
  'flatten': { solid: [0, 2], lines: [1, 3, 4] },
  'mask': { solid: [8], lines: [0, 1, 2, 3, 4, 5, 6, 7] },
  'boolean-union': { solid: [0] },
  'boolean-subtract': { solid: [0], lines: [1, 2, 3] },
  'boolean-intersect': { solid: [0], lines: [1, 2, 3, 4, 5, 6] },
  'bezier-curve': { solid: [1, 2, 5, 6], wire: [0, 3, 4] },
  'node-corner': { solid: [0], wire: [1, 2] },
  'node-smooth': { solid: [0, 3, 4], wire: [1, 2], lines: [5, 6] },
  'pen-tool-plus': { solid: [0, 3], cut: [1, 2] },
  'pen-tool-minus': { solid: [0, 3], cut: [1, 2] },
  'path-join': { solid: [1], wire: [0, 2] },
  'path-break': { solid: [1, 2], wire: [0, 3] },
  'path-offset': { solid: [0], lines: [1, 2, 3, 4, 5, 6, 7, 8] },
  'guides': { solid: [0], wire: [1, 2] },
  'snap-to-grid': { solid: [4], lines: [0, 1, 2, 3] },
  'auto-layout-horizontal': { solid: [0, 1], lines: [2, 3] },
  'auto-layout-vertical': { solid: [0, 1], lines: [2, 3] },
  'auto-layout-wrap': { solid: [0, 1, 2], lines: [3, 4] },
  'gap-horizontal': { solid: [0, 1], lines: [2, 3, 4] },
  'gap-vertical': { solid: [0, 1], lines: [2, 3, 4] },
  'padding': { solid: [0], cut: after('padding') },
  'margin': { solid: [0], lines: after('margin') },
  'hug-contents': { solid: [0], lines: [1, 2, 3, 4] },
  'fill-container': { solid: [2], wire: [3, 4, 5, 6], lines: [0, 1] },
  'tidy-up': { solid: [0, 1, 2], lines: [3, 4, 5, 6] },
  'align-center-horizontal': { solid: [0, 1], lines: [2] },
  'align-middle': { solid: [0, 1], lines: [2] },
  'skew': { solid: [0], lines: [1, 2] },
  'perspective': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7] },
  'gradient-linear': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  'gradient-radial': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  'gradient-angular': { solid: [0], cut: [1, 2, 3] },
  'shadow-drop': { solid: [0], lines: [1] },
  'shadow-inner': { solid: [0], cut: [1] },
  'blur': { solid: [0], lines: after('blur') },
  'blur-background': { solid: [0], lines: [1], cut: [2, 3, 4, 5, 6] },
  'stroke-outline': { solid: [0], cut: [1] },
  'font-weight': { solid: [2], lines: [0, 1] },
  'text-select': { solid: [2, 4], wire: [1, 3], lines: [0] },
  'indent-first-line': { solid: [4], lines: [0, 1, 2, 3] },
  'indent-hanging': { solid: [4], lines: [0, 1, 2, 3] },
  'callout': { solid: [0], cut: [1, 2, 3, 4] },
  'toggle-list': { solid: [0], lines: [1, 2, 3] },
  'footnote': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'figure-caption': { solid: [0], cut: [1, 2], lines: [3, 4] },
  'page-orientation': { solid: [1], lines: [0, 2, 3] },
  'page-header': { solid: [0], cut: [1, 2, 3, 4] },
  'page-footer': { solid: [0], cut: [1, 2, 3, 4] },
  'image-wrap': { solid: [0], cut: [1, 2], lines: [3, 4, 5, 6, 7] },
  'image-break': { solid: [1], cut: [2, 3], lines: [0, 4] },
  'comment-inline': { solid: [3], lines: [0, 1, 2, 4, 5] },
  'replace': { solid: [0, 1], wire: [2, 3] },
  'replace-all': { solid: [1, 3], lines: [0, 2, 4, 5] },
  'redact': { solid: [2], lines: [0, 1, 3] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
{
  const d = (name) => icons[name].d;
  // Clipboard: a channel separates the lower half of the clip from the board.
  const clipCut = rpath([[9.15, 4.5], [9.15, 6.25], [14.85, 6.25], [14.85, 4.5]], [0, 1.05, 1.05, 0]);
  icons.paste.fill = { solid: CLIP_SOLID, cut: [clipCut, d('paste')[2], d('paste')[3]] };
  icons['clipboard-check'].fill = { solid: CLIP_SOLID, cut: [clipCut, d('clipboard-check')[2]] };
  // Archive: a channel running side to side separates the lid from the box.
  icons.archive.fill = { solid: ARCHIVE_SOLID, cut: [hl(1, 23, 8.25), d('archive')[2]] };
  icons['archive-restore'].fill = { solid: ARCHIVE_SOLID, cut: [hl(1, 23, 8.25), d('archive-restore')[2], d('archive-restore')[3]] };
  // Trash can: the handle closes against the lid and is filled with it; the lid is a bar and the
  // slots are knocked out.
  for (const name of ['trash', 'trash-open']) icons[name].fill = { solid: [`${d(name)[1]}Z`, d(name)[2]], wire: [d(name)[0]], cut: [d(name)[3], d(name)[4]] };
  // Pilcrow: the bowl closes against the stem and is filled, as in type; the stem and the bar stay
  // as lines, flush with it.
  icons.paragraph.fill = { solid: ['M12 12.25H10A4 4 0 0 1 10 4.25H12Z'], wire: [hl(12, 18, 4.25), d('paragraph')[1], d('paragraph')[2]] };
  for (const name of ['text-direction-ltr', 'text-direction-rtl'])
    icons[name].fill = { solid: ['M12.25 8.75H10.5A2.75 2.75 0 0 1 10.5 3.25H12.25Z'], wire: [hl(12.25, 17.25, 3.25), d(name)[1], d(name)[2]], lines: [d(name)[3], d(name)[4]] };
  // Page break: the two sheets, closed, become two blocks; the break stays dashed.
  icons['page-break'].fill = {
    solid: [rpath([[4.75, 3.25], [4.75, 8.75], [19.25, 8.75], [19.25, 3.25]], [0, 2.5, 0, 0], { closed: true }), rpath([[4.75, 20.75], [4.75, 15.25], [19.25, 15.25], [19.25, 20.75]], [0, 2.5, 2.5, 0], { closed: true })],
    lines: [1, 2, 3].map((i) => d('page-break')[i]),
  };
  // The roller's arm joins the roller to the handle: a line, not an area.
  icons['paint-roller'].fill = { solid: [d('paint-roller')[0], d('paint-roller')[2]], wire: [d('paint-roller')[1]] };
  // Brush: the ferrule closes against the bristles and a channel separates them; the handle is a line.
  {
    const P = axis([3.5, 20.5], -45);
    icons.brush.fill = { solid: [d('brush')[0], `${d('brush')[1]}Z`], wire: [d('brush')[2]], cut: [line(P(9, -2.25), P(9, 2.25))] };
  }
  // Highlighter: the chisel tip closes against the edge of the body.
  icons.highlighter.fill = { solid: [d('highlighter')[0], `${d('highlighter')[2]}Z`], cut: [d('highlighter')[1]], lines: [d('highlighter')[3]] };
  // Eyedropper: the pipette and the bulb close against the collar, which sticks out at the sides
  // as a bar.
  icons.eyedropper.fill = { solid: [`${d('eyedropper')[0]}Z`, `${d('eyedropper')[2]}Z`], wire: [d('eyedropper')[1]] };
  // Paint bucket: the body closes across the opening, where the lip runs; the lip stays a bar.
  icons['paint-bucket'].fill = { solid: [`${d('paint-bucket')[0]}Z`, d('paint-bucket')[2]], wire: [d('paint-bucket')[1]] };
  // Share: the box closes across the top and the arrow knocks it out with its gap on the way out.
  icons.share.fill = { solid: [`${d('share')[0]}Z`], lines: [d('share')[1], d('share')[2]] };
  // Pen tool: the eye opens fully (r 2) and the slit runs up to the tip.
  icons['pen-tool'].fill = { solid: [d('pen-tool')[0], d('pen-tool')[3]], cut: [d('pen-tool')[1], d('pen-tool')[2], circ(12, 11, 0.5)] };
  // Ruler: the marks are knocked out from the edge (they start at it so no slivers are left).
  icons.ruler.fill = { solid: [d('ruler')[0]], cut: [[6, 11.25], [9, 9.75], [12, 11.25], [15, 9.75], [18, 11.25]].map(([x, y]) => vl(x, 6, y)) };
  // Set square: the window stays hollow.
  icons['set-square'].fill = { solid: [hole(d('set-square')[0], d('set-square')[1])] };
  // Compass: the hinge filled; the handle, the legs and the arc stay as lines.
  icons['drafting-compass'].fill = { solid: [d('drafting-compass')[0]], wire: d('drafting-compass').slice(1) };
  // Slashed pencil: each half closes against the cut.
  icons['pencil-off'].fill = { solid: [`${d('pencil-off')[0]}Z`, `${d('pencil-off')[2]}Z`], cut: [d('pencil-off')[1], d('pencil-off')[3]], lines: [d('pencil-off')[4]] };
  // Half star: one half filled and the outline of the other, joined to it.
  icons['star-half'].fill = { solid: [d('star-half')[0]], wire: [d('star-half')[1]] };
  // Floppy disk: the shutter is knocked out from the top edge and the label stays separate.
  icons.save.fill = { solid: [d('save')[0]], cut: [rpath([[9, 1.5], [9, 8], [15, 8], [15, 1.5]], [0, 1.25, 1.25, 0]), d('save')[2]] };
  // Sticky note: a channel that crosses the edge separates the folded corner.
  icons['sticky-note'].fill = { solid: [d('sticky-note')[0]], cut: [rpath([[14.25, 22.5], [14.25, 14.25], [22.5, 14.25]], [0, 1.75, 0])] };
  // ── Round 3 ──
  // Bricks: the studs close against the body (from index `at`: body, stud, stud); the rest of the
  // drawing (dashed outlines, arrows) stays lines, clear of the fill.
  const bricks = (name, ...at) => {
    const all = d(name);
    const mine = at.flatMap((i) => [i, i + 1, i + 2]);
    return { solid: at.flatMap((i) => [all[i], `${all[i + 1]}Z`, `${all[i + 2]}Z`]), ...(all.length > mine.length && { lines: all.filter((_, i) => !mine.includes(i)) }) };
  };
  icons['component-plus'].fill = bricks('component-plus', 0);
  icons['component-instance'].fill = bricks('component-instance', 0);
  icons['component-variants'].fill = bricks('component-variants', 0, 3);
  icons['component-swap'].fill = bricks('component-swap', 0);
  icons['component-detach'].fill = { solid: d('component-detach').map((p) => `${p}Z`) };
  // Table with a badge: datos/table's fill, but the column stops 0.75 short of the bottom edge's ink.
  // Through the edge, it left a sliver of ink between itself and the badge's clearance.
  icons['table-plus'].fill = { solid: [TABLE[0]], cut: [TABLE[1], vl(10.75, 8.75, 18.5)] };
  // Exclude: each square without the overlap, closed; the overlap is left hollow between them.
  icons['boolean-exclude'].fill = { solid: [BOOL.aRest, BOOL.bRest] };
  // Pixel grid: the cell lines knocked out, stopping 0.6 short of the frame's ink.
  icons['pixel-grid'].fill = { solid: [d('pixel-grid')[0]], cut: [vl(9.5, 6.75, 17.25), vl(14.5, 6.75, 17.25), hl(6.75, 17.25, 9.5), hl(6.75, 17.25, 14.5), d('pixel-grid')[5]] };
  // Warp: the bowed mesh knocked out, stopping 0.6 short of the frame's ink.
  icons.warp.fill = { solid: [d('warp')[0]], cut: [quadPart([[12, 3.25], [16, 12], [12, 20.75]], 0.129, 0.871), quadPart([[3.25, 12], [12, 8], [20.75, 12]], 0.129, 0.871)] };
  // Opacity: the upper half filled; the outline and the checker stay lines.
  icons.opacity.fill = { solid: [SWATCH.upper], wire: [SWATCH.whole], lines: d('opacity').slice(2) };
  // Blend mode: what the two shapes share is filled (the darker overlap of multiply); both outlines stay.
  icons['blend-mode'].fill = { solid: [BLEND_OVERLAP], wire: d('blend-mode').slice(0, 2) };
  // Stroke alignment, caps and joins: the stroke's body filled; the dashed path knocked out of it or
  // standing apart, and the endpoint knocked out.
  icons['stroke-align-inside'].fill = { solid: [d('stroke-align-inside')[0]], lines: d('stroke-align-inside').slice(1) };
  icons['stroke-align-center'].fill = { solid: [d('stroke-align-center')[0]], cut: d('stroke-align-center').slice(1) };
  icons['stroke-align-outside'].fill = { solid: [d('stroke-align-outside')[0]], lines: d('stroke-align-outside').slice(1) };
  icons['stroke-cap-butt'].fill = { solid: [`M3.25 ${CAP.top}H${CAP.x}V${CAP.low}H3.25Z`], cut: [dot(CAP.x, 12)] };
  for (const name of ['stroke-cap-round', 'stroke-cap-square']) icons[name].fill = { solid: [`${d(name)[0]}Z`], cut: [d(name)[1]] };
  for (const name of ['stroke-join-miter', 'stroke-join-round', 'stroke-join-bevel']) icons[name].fill = { solid: [`${d(name)[0]}V11.25H11.25V20.75Z`] };
  // Constraints: the layer and its pins knocked out of the frame; the pins stop 0.6 short of its ink.
  icons.constraints.fill = { solid: [d('constraints')[0]], cut: [d('constraints')[1], vl(12, 5.5, 6.25), vl(12, 17.75, 18.5), hl(5.5, 6.25, 12), hl(17.75, 18.5, 12)] };
  // Borders: the solid frame filled, the cross (stopping 0.6 short of its ink) or the dots knocked out.
  icons['border-all'].fill = { solid: [d('border-all')[0]], cut: [hl(5.5, 18.5, 12), vl(12, 5.5, 18.5)] };
  icons['border-outer'].fill = { solid: [d('border-outer')[0]], cut: d('border-outer').slice(1) };
  // Save all: save's fill on the front disk (the shutter cut from its top edge); the back one stays a line.
  icons['save-all'].fill = { solid: [d('save-all')[1]], lines: [d('save-all')[0]], cut: [rpath([[11.25, 5], [11.25, 10.25], [16.25, 10.25], [16.25, 5]], [0, 1, 1, 0]), d('save-all')[3]] };
}
// Open lines only: letters, lines of text, arrows, dashes and freehand strokes.
for (const icon of Object.values(icons)) if (icon.fill === undefined) icon.fill = false;

// ── 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough ──
// The engine doesn't pixel-snap a `small` drawing: it's snapped here with `snap`. The new marks run
// at 45° from pixel center to pixel center (0.75 + 1.5k), so every diagonal comes out crisp, not as a smudge.
const sharp = (d, fill) => {
  const s = (list) => list.map((p) => snap(p));
  return { d: s(d), ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, s(v)])) }) };
};
/** Pixel checkmark: vertex at (x, y), a short arm of `a` steps and a long one of `b` (1 step = 1 px). */
const tick = (x, y, a, b) => line([x - 1.5 * a, y - 1.5 * a], [x, y], [x + 1.5 * b, y - 1.5 * b]);
/** Pixel x: a square of `n` steps from (x, y). */
const cross = (x, y, n) => [line([x, y], [x + 1.5 * n, y + 1.5 * n]), line([x + 1.5 * n, y], [x, y + 1.5 * n])];
/** Pixel arrowhead: vertex at `tip`, arms of `n` steps, pointing toward `dir` ([±1, 0] or [0, ±1]). */
const point = (tip, [dx, dy], n = 1) => {
  const k = 1.5 * n;
  return dx ? line([tip[0] - dx * k, tip[1] - k], tip, [tip[0] - dx * k, tip[1] + k]) : line([tip[0] - k, tip[1] - dy * k], tip, [tip[0] + k, tip[1] - dy * k]);
};
// The 4-pixel checkmarks (copied, clipboard, bookmark, task list): the ones from 24 turned into a
// gray smudge at 16 px.
{
  const check = tick(14.25, 17.25, 1, 2);
  icons['copy-check'].small = sharp([COPY_BACK, COPY_FRONT, check], { solid: [COPY_FRONT], lines: [COPY_BACK], cut: [check] });
}
{
  const check = tick(11.25, 15.75, 2, 3);
  const clipCut = rpath([[9.15, 4.5], [9.15, 6.25], [14.85, 6.25], [14.85, 4.5]], [0, 1.05, 1.05, 0]);
  icons['clipboard-check'].small = sharp([...CLIP, check], { solid: CLIP_SOLID, cut: [clipCut, check] });
}
{
  const check = tick(11.25, 11.25, 2, 3);
  icons['bookmark-check'].small = sharp([BOOKMARK, check], { solid: [BOOKMARK], cut: [check] });
}
icons['list-checks'].small = sharp([6.75, 17.25].flatMap((y) => [tick(5.25, y + 1.5, 1, 2), hl(11.25, 20.25, y)]));
// Bullets: each dot centered on a pixel edge (multiples of 1.5) lands fully on 2 × 2 pixels, like
// the dots in navegacion; its line of text sits at the height of the dot's lower pixel row.
icons['list-bullets'].small = sharp([6, 12, 18].flatMap((y) => [dot(4.5, y, 0.8), hl(9.25, 20.25, y + 0.75)]));
// The 5-pixel x marks, crossing on a single pixel (with 4, the center turned into a square).
{
  const x = cross(11.25, 8.25, 4);
  icons.backspace.small = sharp([icons.backspace.d[0], ...x], { solid: [icons.backspace.d[0]], cut: x });
}
icons['format-clear'].small = sharp([icons['format-clear'].d[0], icons['format-clear'].d[1], ...cross(14.25, 14.25, 4)]);
icons.deselect.small = sharp([...MARQUEE, ...cross(8.25, 8.25, 4)]);
// Short arrows: the shaft on a pixel column and a 45° head (the one from 24 fell between two pixels).
{
  const arrow = [vl(12.75, 11.25, 17.25), point([12.75, 11.25], [0, -1], 2)];
  icons['archive-restore'].small = sharp([...ARCHIVE, ...arrow], { solid: ARCHIVE_SOLID, cut: [hl(1, 23, 8.25), ...arrow] });
}
// Indent: the two middle lines of text move one pixel apart so the arrow (a 2-step head; with 1 it
// read as a plus) sits centered between them.
for (const [name, dir] of [['indent-increase', 1], ['indent-decrease', -1]]) {
  const tip = [dir > 0 ? 8.25 : 3.75, 12.75];
  const rows = [hl(3.75, 20.25, 5.25), hl(11, 20.25, 9.75), hl(11, 20.25, 15.75), hl(3.75, 20.25, 20.25)];
  icons[name].small = sharp([...rows, hl(3.75, 8.25, 12.75), point(tip, [dir, 0], 2)]);
}
// The small chevrons for larger and smaller text: 5 pixels, above and beside the A.
icons['text-larger'].small = sharp([...A_BIG, point([17.25, 3.75], [0, -1], 2)]);
icons['text-smaller'].small = sharp([...A_BIG, point([17.25, 6.75], [0, 1], 2)]);
// Open trash can: the rotated handle turned into a smudge; at 16 px the lid lifts straight up.
{
  const lid = hl(3.5, 20.5, 3.75);
  icons['trash-open'].small = sharp([lid, ...TRASH_BODY], { solid: [TRASH_BODY[0]], wire: [lid], cut: TRASH_BODY.slice(1) });
}
// Wastebasket: the slanted slots blurred; at 16 px they're vertical.
{
  const d = [icons.wastebasket.d[0], vl(9.75, 8.25, 16.75), vl(14.25, 8.25, 16.75)];
  icons.wastebasket.small = sharp(d, { solid: [d[0]], cut: d.slice(1) });
}

// Borders at 16 px: the dots two pixels apart would snap into a solid line, so the grid is drawn on
// the pixels (one-pixel dots on every other pixel center); the frame is then 11 pixels and its cross
// falls one pixel off center, as every 2 × 2 grid does at that size.
{
  const KINDS = {
    'border-all': ['outer', 'h', 'v'], 'border-outer': ['outer'], 'border-inner': ['h', 'v'], 'border-none': [],
    'border-top': ['top'], 'border-bottom': ['bottom'], 'border-left': ['left'], 'border-right': ['right'],
    'border-horizontal': ['h'], 'border-vertical': ['v'],
  };
  for (const [name, solid] of Object.entries(KINDS)) {
    const d = border(solid, true);
    const fill = name === 'border-all' ? { solid: [d[0]], cut: [hl(5.25, 18.75, 12.75), vl(12.75, 5.25, 18.75)] } : name === 'border-outer' ? { solid: [d[0]], cut: d.slice(1) } : undefined;
    icons[name].small = { d, ...(fill && { fill }) };
  }
}

// Gradients at 16 px: their dots, a pixel apart once snapped, ran into bars; here they are one-pixel
// dots two pixels apart on the swatch snapped to the pixels (knocked out of the filled swatch they
// take a little more than a pixel, or they don't show).
{
  const swatch = snap(GRADIENT);
  const GRID = {
    'gradient-linear': [[6.75, 6.75], [6.75, 9.75], [6.75, 12.75], [6.75, 15.75], [6.75, 18.75], [9.75, 8.25], [9.75, 12.75], [9.75, 17.25], [12.75, 9.75], [12.75, 15.75], [15.75, 12.75]],
    'gradient-radial': [[12.75, 12.75], [12.75, 9.75], [15.75, 12.75], [12.75, 15.75], [9.75, 12.75], [8.25, 8.25], [17.25, 8.25], [8.25, 17.25], [17.25, 17.25]],
  };
  for (const [name, pts] of Object.entries(GRID))
    icons[name].small = { d: [swatch, ...pts.map((p) => circ(...p, 0.1))], fill: { solid: [swatch], cut: pts.map((p) => circ(...p, 0.35)) } };
  // Opacity: the same one-pixel dots, two pixels apart, in the half below the diagonal (snapped, they
  // disappeared into it).
  const dots = [[17.25, 11.25], [14.25, 14.25], [17.25, 14.25], [11.25, 17.25], [14.25, 17.25], [17.25, 17.25]].map((p) => circ(...p, 0.1));
  const [whole, diagonal, upper] = [SWATCH.whole, SWATCH.diagonal, SWATCH.upper].map((d) => snap(d));
  icons.opacity.small = { d: [whole, diagonal, ...dots], fill: { solid: [upper], wire: [whole], lines: dots } };
}
// Margin and padding at 16 px: the dotted outlines on the pixels, one-pixel dots on every other pixel
// center (snapped, the dots ran into a solid line). A dotted square needs an even span of pixels, so it
// sits half a pixel off center, as the border grids' cross does.
{
  const PX = [3.75, 6.75, 9.75, 12.75, 15.75, 18.75];
  const square = (list) => [...new Set(list.flatMap((t) => [[t, list[0]], [t, list.at(-1)], [list[0], t], [list.at(-1), t]]).map(String))].map((s) => s.split(',').map(Number));
  const outer = square(PX);
  const boxIn = box(6.75, 6.75, 9, 9, 1.5);
  icons.margin.small = { d: [boxIn, ...outer.map((p) => circ(...p, 0.1))], fill: { solid: [boxIn], lines: outer.map((p) => circ(...p, 0.1)) } };
  const inner = square(PX.slice(1, 5));
  const frame = snap(icons.padding.d[0]);
  icons.padding.small = { d: [frame, ...inner.map((p) => circ(...p, 0.1))], fill: { solid: [frame], cut: inner.map((p) => circ(...p, 0.35)) } };
}

// ── Mirroring (DESIGN.md › Mirroring): lines of text and indented lists, pencils and anything that deletes backward ──
for (const name of [
  'backspace', 'list-bullets', 'list-plus', 'indent-increase', 'indent-decrease', 'line-spacing', 'text-wrap', 'text-columns', 'text-quote',
  'pencil-plus', 'pencil-off', 'pencil-sparkle', 'compose', 'brush', 'highlighter', 'signature-line', 'align-start', 'align-end',
  // The half star fills the half where reading starts.
  'star-half',
  // Round 3: flows that run in the reading direction.
  'auto-layout-horizontal', 'auto-layout-wrap', 'skew',
  'paragraph-spacing', 'text-truncate', 'text-select', 'drop-cap', 'indent-first-line', 'indent-hanging', 'list-nested', 'callout', 'toggle-list', 'redact',
  'table-of-contents', 'document-outline', 'image-wrap', 'figure-caption', 'comment-inline', 'track-changes', 'change-accept', 'change-reject', 'spell-check', 'word-count',
  'replace', 'replace-all',
])
  icons[name].mirror = true;

// ── Named parts (DESIGN.md › Named parts) ──
const PARTS = {
  'copy': { back: [0], front: [1] },
  'duplicate': { back: [0], front: [1], mark: [2, 3] },
  'copy-check': { back: [0], front: [1], mark: [2] },
  'paste': { board: [0], clip: [1], lines: [2, 3] },
  'clipboard-check': { board: [0], clip: [1], mark: [2] },
  'scissors': { handles: [0, 1], blades: [2, 3, 4] },
  'trash': { lid: [0, 1], body: [2, 3, 4] },
  'trash-open': { lid: [0, 1], body: [2, 3, 4] },
  'backspace': { key: [0], mark: [1, 2] },
  'archive': { lid: [0], body: [1, 2] },
  'archive-restore': { lid: [0], body: [1], arrow: [2, 3] },
  'image-plus': { frame: [0], sun: [1], landscape: [2] },
  'rotate-right': { body: [0], arrow: [1, 2] },
  'rotate-left': { body: [0], arrow: [1, 2] },
  'flip-horizontal': { shape: [0], axis: [1, 2, 3], mirror: [4] },
  'flip-vertical': { shape: [0], axis: [1, 2, 3], mirror: [4] },
  'resize': { body: [0], arrow: [1, 2] },
  'eraser': { body: [0, 1], line: [2] },
  'brush': { bristles: [0], ferrule: [1], handle: [2] },
  'highlighter': { marker: [0, 1, 2], ink: [3] },
  'magic-wand': { wand: [0, 1], sparkle: [2, 3, 4] },
  'paint-bucket': { bucket: [0, 1], drop: [2] },
  'pencil-plus': { pencil: [0, 1, 2] },
  'pencil-off': { pencil: [0, 1, 2, 3], slash: [4] },
  'pencil-sparkle': { pencil: [0, 1, 2], sparkle: [3] },
  'compose': { paper: [0] },
  'eye': { body: [0], pupil: [1] },
  'eye-closed': { lid: [0], lashes: [1, 2, 3, 4] },
  'star': { body: [0] },
  'star-half': { half: [0], outline: [1] },
  'heart': { body: [0] },
  'flag': { pole: [0], banner: [1] },
  'share': { box: [0], arrow: [1, 2] },
  'download': { tray: [0], arrow: [1, 2] },
  'upload': { tray: [0], arrow: [1, 2] },
  'save': { body: [0], shutter: [1], label: [2] },
  'bring-forward': { layer: [0, 1], arrow: [2, 3] },
  'send-backward': { layer: [0, 1], arrow: [2, 3] },
  'unlink': { link: [0, 1], sparks: [2, 3, 4, 5] },
  'text-direction-ltr': { pilcrow: [0, 1, 2], arrow: [3, 4] },
  'text-direction-rtl': { pilcrow: [0, 1, 2], arrow: [3, 4] },
  // Round 3
  'bring-to-front': { layer: [0, 1], arrow: [2, 3], bar: [4] },
  'send-to-back': { layer: [0, 1], arrow: [2, 3], bar: [4] },
  'ungroup': { first: [0, 1, 2, 3], second: [4, 5, 6, 7] },
  'flatten': { layers: [0, 1], layer: [2], arrow: [3, 4] },
  'mask': { frame: [0, 1, 2, 3, 4, 5, 6, 7], shape: [8] },
  'component-instance': { component: [0, 1, 2], main: [3, 4, 5, 6, 7] },
  'component-variants': { first: [0, 1, 2], second: [3, 4, 5] },
  'component-detach': { left: [0], right: [1] },
  'component-swap': { component: [0, 1, 2], arrows: [3, 4, 5, 6] },
  'component-plus': { component: [0, 1, 2] },
  'boolean-subtract': { shape: [0], removed: [1, 2, 3] },
  'boolean-intersect': { shape: [0], removed: [1, 2, 3, 4, 5, 6] },
  'boolean-exclude': { shape: [0, 1], removed: [2, 3] },
  'bezier-curve': { curve: [0], nodes: [1, 2], handles: [3, 4, 5, 6] },
  'node-corner': { node: [0], path: [1, 2] },
  'node-smooth': { node: [0], handle: [1, 2, 3, 4], curve: [5, 6] },
  'pen-tool-plus': { pen: [0, 1, 2, 3] },
  'pen-tool-minus': { pen: [0, 1, 2, 3] },
  'path-join': { path: [0, 2], node: [1] },
  'path-break': { path: [0, 3], nodes: [1, 2] },
  'path-offset': { shape: [0], offset: [1, 2, 3, 4, 5, 6, 7, 8] },
  'guides': { rulers: [0], guides: [1, 2] },
  'pixel-grid': { grid: [0, 1, 2, 3, 4], pixel: [5] },
  'snap-to-grid': { grid: [0, 1, 2, 3], node: [4] },
  'auto-layout-horizontal': { items: [0, 1], arrow: [2, 3] },
  'auto-layout-vertical': { items: [0, 1], arrow: [2, 3] },
  'auto-layout-wrap': { items: [0, 1, 2], arrow: [3, 4] },
  'gap-horizontal': { items: [0, 1], measure: [2, 3, 4] },
  'gap-vertical': { items: [0, 1], measure: [2, 3, 4] },
  'padding': { frame: [0], padding: after('padding') },
  'margin': { box: [0], margin: after('margin') },
  'hug-contents': { box: [0], arrows: [1, 2, 3, 4] },
  'fill-container': { bounds: [0, 1], box: [2], arrows: [3, 4, 5, 6] },
  'constraints': { frame: [0], layer: [1], pins: [2, 3, 4, 5] },
  'tidy-up': { tiles: [0, 1, 2], slot: [3, 4, 5, 6] },
  'constrain-proportions': { measure: [0, 1, 2], link: [3, 4, 5] },
  'align-center-horizontal': { objects: [0, 1], axis: [2] },
  'align-middle': { objects: [0, 1], axis: [2] },
  'skew': { shape: [0], arrow: [1, 2] },
  'perspective': { handles: [0, 1, 2, 3], edges: [4, 5, 6, 7] },
  'warp': { frame: [0], mesh: [1, 2] },
  'opacity': { swatch: [0, 1], checker: [2, 3, 4, 5] },
  'blend-mode': { back: [0], front: [1], blend: [2, 3] },
  'gradient-linear': { swatch: [0], gradient: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  'gradient-radial': { swatch: [0], gradient: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  'gradient-angular': { swatch: [0], radius: [1], arrow: [2, 3] },
  'shadow-drop': { shape: [0], shadow: [1] },
  'shadow-inner': { shape: [0], shadow: [1] },
  'blur': { shape: [0], blur: after('blur') },
  'blur-background': { pane: [0], shape: [1], blur: [2, 3, 4, 5, 6] },
  'corner-radius-independent': { corners: [0, 1, 2, 3] },
  'stroke-cap-butt': { stroke: [0, 1], end: [2] },
  'stroke-cap-round': { stroke: [0], end: [1] },
  'stroke-cap-square': { stroke: [0], end: [1] },
  'stroke-outline': { outline: [0], line: [1] },
  'text-path': { path: [0], letter: [1, 2] },
  'letter-spacing': { letter: [0, 1], measure: [2, 3, 4, 5, 6] },
  'paragraph-spacing': { text: [0, 1, 2, 3], measure: [4, 5, 6] },
  'font-weight': { light: [0, 1], heavy: [2] },
  'text-auto-width': { box: [0, 1, 2, 3], letter: [4, 5], arrows: [6, 7, 8, 9] },
  'text-auto-height': { box: [0, 1, 2, 3], letter: [4, 5], arrow: [6, 7] },
  'text-vertical': { letters: [0, 1, 2, 3, 4], arrow: [5, 6] },
  'drop-cap': { initial: [0, 1], text: [2, 3, 4, 5] },
  'glyphs': { glyph: [0] },
  'text-select': { text: [0], handles: [1, 2, 3, 4] },
  'indent-first-line': { text: [0, 1, 2, 3], marker: [4] },
  'indent-hanging': { text: [0, 1, 2, 3], marker: [4] },
  'heading-4': { letter: [0, 1, 2], number: [3] },
  'heading-5': { letter: [0, 1, 2], number: [3] },
  'heading-6': { letter: [0, 1, 2], number: [3, 4] },
  'divider': { text: [0, 2], rule: [1] },
  'callout': { box: [0], mark: [1, 2], text: [3, 4] },
  'toggle-list': { caret: [0], text: [1, 2, 3] },
  'table-plus': { table: [0, 1, 2] },
  'footnote': { page: [0], text: [1, 3], mark: [2], note: [4, 5, 6] },
  'figure-caption': { image: [0, 1, 2], caption: [3, 4] },
  'page-orientation': { portrait: [0], landscape: [1], arrow: [2, 3] },
  'page-header': { page: [0], header: [1, 2, 3, 4] },
  'page-footer': { page: [0], footer: [1, 2, 3, 4] },
  'image-wrap': { image: [0, 1, 2], text: [3, 4, 5, 6, 7] },
  'image-break': { text: [0, 4], image: [1, 2, 3] },
  'track-changes': { deleted: [0, 1], inserted: [2], text: [3], caret: [4] },
  'change-accept': { deleted: [0, 1], inserted: [2], text: [3], caret: [4] },
  'change-reject': { deleted: [0, 1], inserted: [2], text: [3], caret: [4] },
  'comment-inline': { text: [0, 1, 2, 4, 5], comment: [3] },
  'spell-check': { text: [0], mark: [1], check: [2] },
  'word-count': { text: [0, 1], tally: [2, 3, 4, 5, 6] },
  'replace': { from: [0], to: [1], arrow: [2, 3] },
  'replace-all': { from: [0, 1], to: [2, 3], arrow: [4, 5] },
  'save-all': { back: [0], disk: [1, 2, 3] },
  'redact': { text: [0, 1, 3], redaction: [2] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
// Stroke alignment: the stroke's band and the dashed path (as many dashes as the path's length takes).
for (const name of ['stroke-align-inside', 'stroke-align-center', 'stroke-align-outside']) icons[name].parts = { stroke: [0], path: after(name) };

// ── Motion (DESIGN.md › Motion): each icon's own gesture ──
const lift = (parts, y) => ({ effect: 'bounce', parts, vector: [0, y] });
icons.trash.motion = lift(['lid'], -1.5);
icons['trash-open'].motion = { effect: 'wiggle', parts: ['lid'], origin: [3.5, 6.5] };
icons['archive-restore'].motion = lift(['arrow'], -1.5);
icons.share.motion = lift(['arrow'], -1.5);
icons.upload.motion = lift(['arrow'], -1.5);
icons.download.motion = lift(['arrow'], 1.5);
icons['paint-bucket'].motion = lift(['drop'], 1.5);
icons.backspace.motion = { effect: 'slide', vector: [-1.5, 0] };
icons['text-direction-ltr'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['text-direction-rtl'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] };
icons.resize.motion = { effect: 'slide', parts: ['arrow'], vector: [1.25, -1.25] };
icons['bring-forward'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons['send-backward'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
// Anything that rotates sways around its center (no direction, so it works both ways).
icons['rotate-right'].motion = { effect: 'wiggle', parts: ['body'], origin: [8, 15] };
icons['rotate-left'].motion = { effect: 'wiggle', parts: ['body'], origin: [16, 15] };
// Tools sway around their tip, like Núcleo's pencil.
icons.eraser.motion = { effect: 'wiggle', parts: ['body'], origin: [9.1, 18.2] };
icons.brush.motion = { effect: 'wiggle', origin: [3.5, 20.5] };
icons.highlighter.motion = { effect: 'wiggle', parts: ['marker'], origin: [5.3, 16.7] };
icons['magic-wand'].motion = { effect: 'wiggle', origin: [4, 20] };
icons['pencil-plus'].motion = { effect: 'wiggle', parts: ['pencil'], origin: [3.25, 18] };
icons.compose.motion = { effect: 'wiggle', parts: ['badge'], origin: [10.25, 13.75] };
icons['pencil-sparkle'].motion = { effect: 'beat', parts: ['sparkle'], origin: [17.5, 17.5] };
icons.flag.motion = { effect: 'wiggle', origin: [4.75, 21.25] };
icons.heart.motion = { effect: 'beat', origin: [12, 12.5] };
icons.star.motion = { effect: 'beat', origin: [12, 12.4] };
// Round 3
icons['bring-to-front'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1] };
icons['send-to-back'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1] };
icons.flatten.motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.25] };
icons['component-detach'].motion = { effect: 'slide', parts: ['right'], vector: [1.25, 0] };
icons['pen-tool-plus'].motion = { effect: 'wiggle', parts: ['pen'], origin: [7.25, 2.75] };
icons['pen-tool-minus'].motion = { effect: 'wiggle', parts: ['pen'], origin: [7.25, 2.75] };
icons['snap-to-grid'].motion = { effect: 'slide', parts: ['node'], vector: [0.75, -0.75] };
icons['auto-layout-horizontal'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['auto-layout-vertical'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
icons['auto-layout-wrap'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.25, 0] };
icons['fill-container'].motion = { effect: 'beat', parts: ['box', 'arrows'], origin: [12, 12] };
icons.skew.motion = { effect: 'slide', parts: ['arrow'], vector: [1.25, 0] };
icons['gradient-angular'].motion = { effect: 'spin', parts: ['radius', 'arrow'], origin: [12, 12] };
icons.blur.motion = { effect: 'beat', parts: ['blur'], origin: [12, 12] };
icons['text-auto-width'].motion = { effect: 'beat', parts: ['arrows'], origin: [12, 12] };
icons['text-auto-height'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.25] };
icons['text-vertical'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.25] };

// ── Automatic variants (DESIGN.md › Automatic variants) ──
const off = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// Already enclosed in a circle or a square.
off(['copyright', 'registered', 'palette'], { circle: false });
off(['text-box', 'save', 'sticky-note', 'transform', 'selection', 'select-all', 'deselect', 'group'], { square: false });
// With a badge: the slash would cut through it.
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, slash: false };
// Set square: the slash would land on its hypotenuse.
off(['set-square'], { slash: false });
// Round 3: already framed (a marquee) or already slashed in meaning.
off(['ungroup', 'mask'], { square: false });
off(['pixel-grid', 'padding', 'margin', 'constraints'], { square: false });
off(['warp', 'opacity', 'gradient-linear', 'gradient-radial', 'gradient-angular', 'shadow-inner', 'corner-radius-independent'], { square: false });
off(['blur'], { circle: false });
// The slash would run along the path's own diagonal.
off(['path-join', 'path-break'], { slash: false });
// Loose lines of text: slashing them says nothing.
off(['paragraph-spacing', 'text-truncate', 'indent-first-line', 'indent-hanging', 'list-nested', 'divider', 'toggle-list', 'table-of-contents', 'document-outline'], { slash: false });
// Border grids are a square already.
off(['border-all', 'border-outer', 'border-inner', 'border-none', 'border-top', 'border-bottom', 'border-left', 'border-right', 'border-horizontal', 'border-vertical'], { square: false });
// Already slashed or broken, and loose lines of text (slashing them says nothing).
off(
  ['pencil-off', 'eye-closed', 'unlink', 'deselect', 'selection', 'strikethrough', 'format-clear', 'align-left', 'align-center', 'align-right', 'align-justify', 'list-bullets', 'list-numbers', 'list-checks', 'list-plus', 'indent-increase', 'indent-decrease', 'line-spacing', 'text-wrap', 'text-columns', 'text-quote'],
  { slash: false },
);

export default { category: 'edicion', label: 'Edición y texto', icons };
