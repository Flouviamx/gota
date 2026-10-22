// Edición y texto (editing and text): clipboard, formatting, alignment, lists, drawing and image
// tools, marks, layers and selection. Everything is computed with engine/geometry.mjs; see DESIGN.md.
import { arc, badge, circ, dot, f, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
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
};

// ── Fill (DESIGN.md › Fill), by index into d: `solid` is filled (and keeps its stroke; closed shapes
// only), `cut` is knocked out at stroke width, `lines` stays a line with a 1.5 gap, and `wire` stays
// a line flush with the fill. Anything made only of open lines (letters, lines of text, arrows)
// gets `fill: false`.
const all = (name) => icons[name].d.map((_, i) => i);
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

// ── Mirroring (DESIGN.md › Mirroring): lines of text and indented lists, pencils and anything that deletes backward ──
for (const name of [
  'backspace', 'list-bullets', 'list-plus', 'indent-increase', 'indent-decrease', 'line-spacing', 'text-wrap', 'text-columns', 'text-quote',
  'pencil-plus', 'pencil-off', 'pencil-sparkle', 'compose', 'brush', 'highlighter', 'signature-line', 'align-start', 'align-end',
  // The half star fills the half where reading starts.
  'star-half',
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
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

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
// Already slashed or broken, and loose lines of text (slashing them says nothing).
off(
  ['pencil-off', 'eye-closed', 'unlink', 'deselect', 'selection', 'strikethrough', 'format-clear', 'align-left', 'align-center', 'align-right', 'align-justify', 'list-bullets', 'list-numbers', 'list-checks', 'list-plus', 'indent-increase', 'indent-decrease', 'line-spacing', 'text-wrap', 'text-columns', 'text-quote'],
  { slash: false },
);

export default { category: 'edicion', label: 'Edición y texto', icons };
