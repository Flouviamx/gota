// Marcas (brands): the symbols of the platforms people link to and share on, adapted to Gota's
// stroke (docs/taxonomy.md, decision 81). Never a wordmark. Every brand turns off the slash, and the
// marks belong to their owners (TRADEMARKS.md): Gota's license covers only its drawings.
//
// Flouvia's own marks come first and are not drawings: `brand-flouvia` (the isotype, the drop with
// the u) and `brand-flouvia-u` (the u on its own) are traced from Flouvia's official logo by an
// exact scale and shift, never redrawn, and `mark` keeps them solid and unchanged in every style
// and weight. Isotype: its box (81.27–679.13 × 201.1–799 in the logo's canvas) to 18, centered;
// the u: its box (153.41–604.1 × 342.94–717.41) to 18 wide, centered. Don't edit these two.
// `brand-cord` is Flouvia's product Cord (cordhq.app), traced the same way from its official symbol
// (flouvia-cord's public/favicon.svg: the light shape inside the squircle that clips it, 1000 → 18,
// centered), and is a `mark` too.
//
// Every other brand is an adaptation of its symbol to the 1.5 monoline, as Tabler and Phosphor do,
// computed with the engine (engine/geometry.mjs): the symbol at its keyline, few strokes, legible at
// 18 px, one color. A monogram only where the letter is the mark itself (Facebook's f, Google's G).
// Their `fill` is the symbol solid, as its owner draws it in one color: a hole in a solid symbol
// (a counter, a cutout) is a second contour wound against the first. A shape that sits in front of
// another (a wheel on the Waze bubble, the front bubble of WeChat) is a custom badge, so the engine
// clears what it covers with exact clearance: nothing is trimmed by hand.
import { arc, circ, dot, drop, f, flipPath, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import nucleo from './nucleo.mjs';

const FLOUVIA_DROP = 'M21 11.79L21 11.73C20.85 6.76 16.7 2.85 11.73 3C6.76 3.15 2.85 7.3 3 12.26C3.14 17.13 7.13 20.98 11.96 21L21 21Z';
// The u inside the isotype, wound against the drop so the fill leaves it open
const FLOUVIA_U_IN = 'M18.74 18.54L15.43 18.54C7 18.5 5.38 14.36 5.19 10.26C5.18 10.16 5.17 10.07 5.17 9.97L5.18 9.9C5.17 9.87 5.17 9.84 5.18 9.8C5.27 8.37 6.55 7.27 8.12 7.27C9.67 7.27 10.94 8.38 11.06 9.79C11.32 11.51 10.33 17.66 15.43 16.9L15.43 10.1L18.74 10.1Z';
const FLOUVIA_U = 'M21 8.28L16.61 8.28L16.61 17.3C9.84 18.31 11.16 10.15 10.81 7.86C10.65 5.99 8.96 4.52 6.91 4.52C4.83 4.52 3.13 5.98 3.01 7.88C3 7.93 3 7.97 3 8.02L3 8.1C3 8.23 3.01 8.36 3.02 8.49C3.28 13.93 5.43 19.42 16.61 19.48L21 19.48Z';
const CORD = 'M10.94 19.7L10.94 12.17C10.94 12.07 10.86 12 10.76 12C10.66 12 10.58 12.07 10.58 12.17L10.58 19.7L6.78 19.7L6.78 12.17C6.8 9.98 8.57 8.21 10.76 8.19C12.89 8.18 14.65 9.86 14.74 12C14.74 12 14.74 13.15 14.74 19.7L10.94 19.7ZM19.24 19.52C19.24 19.06 19.25 16.54 19.24 8.28C19.24 8.19 19.16 8.11 19.07 8.11C18.97 8.11 18.89 8.19 18.89 8.28L18.89 19.63Q18.74 19.66 18.6 19.68Q18.45 19.69 18.3 19.7L15.09 19.7L15.09 8.28C15.1 6.09 16.87 4.32 19.06 4.31C19.76 4.31 20.42 4.49 21 4.82L21 16.99Q21 17.05 21 17.1Q21 17.15 20.99 17.2Q20.99 17.25 20.98 17.3Q20.98 17.35 20.97 17.4Q20.96 17.45 20.95 17.5Q20.94 17.55 20.93 17.6Q20.92 17.65 20.91 17.7Q20.89 17.75 20.88 17.8Q20.86 17.85 20.84 17.9Q20.83 17.95 20.81 17.99Q20.79 18.04 20.77 18.09Q20.75 18.14 20.73 18.18Q20.7 18.23 20.68 18.27Q20.65 18.32 20.63 18.36Q20.6 18.41 20.57 18.45Q20.55 18.49 20.52 18.53Q20.49 18.58 20.46 18.62Q20.43 18.66 20.39 18.7Q20.36 18.74 20.33 18.78Q20.29 18.82 20.26 18.85Q20.22 18.89 20.19 18.93Q20.15 18.96 20.11 19Q20.08 19.03 20.04 19.06Q20 19.1 19.96 19.13Q19.92 19.16 19.87 19.19Q19.83 19.22 19.79 19.25Q19.75 19.27 19.7 19.3Q19.66 19.33 19.62 19.35Q19.57 19.38 19.52 19.4Q19.48 19.42 19.43 19.45Q19.39 19.47 19.34 19.49Q19.29 19.51 19.24 19.52ZM6.43 19.7L5.7 19.7Q5.63 19.7 5.57 19.69Q5.5 19.69 5.44 19.68Q5.37 19.68 5.3 19.67Q5.24 19.66 5.17 19.64Q5.11 19.63 5.04 19.61Q4.98 19.6 4.92 19.58Q4.85 19.56 4.79 19.54Q4.73 19.51 4.67 19.49Q4.61 19.46 4.55 19.44Q4.49 19.41 4.43 19.38Q4.37 19.34 4.31 19.31Q4.26 19.28 4.2 19.24Q4.14 19.2 4.09 19.16Q4.04 19.12 3.99 19.08Q3.94 19.04 3.89 19Q3.84 18.95 3.79 18.9Q3.74 18.86 3.7 18.81Q3.65 18.76 3.61 18.71Q3.57 18.66 3.53 18.6Q3.49 18.55 3.46 18.5Q3.42 18.44 3.38 18.38Q3.35 18.33 3.32 18.27Q3.29 18.21 3.26 18.15Q3.23 18.09 3.21 18.03Q3.18 17.97 3.16 17.9Q3.14 17.84 3.12 17.78Q3.1 17.72 3.08 17.65Q3.06 17.59 3.05 17.52Q3.04 17.46 3.03 17.39Q3.02 17.33 3.01 17.26Q3.01 17.19 3 17.13Q3 17.06 3 16.99L3 12.91C3.05 12.84 3.11 12.77 3.17 12.71C3.52 12.36 3.99 12.17 4.49 12.17C5.64 12.17 6.43 13 6.43 14.03L6.43 19.7Z';

// ── Geometry helpers ──────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const unit = (a) => mul(a, 1 / Math.hypot(a[0], a[1]));
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const rev = (pts) => [...pts].reverse();

/** Ellipse (rx across, ry down). */
const ellipse = (cx, cy, rx, ry) => `M${P([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx - rx, cy])}Z`;

/** Capsule (a stadium) from center `a` to center `b`, radius `r`. */
function capsule(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1] * r, u[0] * r];
  const R = halfChord(add(b, n), sub(b, n));
  return `M${P(add(a, n))}L${P(add(b, n))}A${R} ${R} 0 0 0 ${P(sub(b, n))}L${P(sub(a, n))}A${R} ${R} 0 0 0 ${P(add(a, n))}Z`;
}

/**
 * A smooth curve through `pts` (Catmull-Rom written as cubic Béziers). A point given as [x, y, 1]
 * is a corner: the curve arrives and leaves it without a tangent of its own.
 */
function smooth(pts, closed = false, k = 1 / 6) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const tan = (i) => (at(i)[2] ? [0, 0] : mul(sub(at(i + 1), at(i - 1)), k));
  let d = `M${P(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) d += `C${P(add(at(i), tan(i)))} ${P(sub(at(i + 1), tan(i + 1)))} ${P(at(i + 1))}`;
  return closed ? `${d}Z` : d;
}

/** A symmetric outline: the right half from the top of the axis to its bottom, mirrored on x = 12. */
const mirrored = (half, c = 12) => [...half, ...half.slice(1, -1).reverse().map(([x, y, k]) => [2 * c - x, y, k])];

/** Open polyline with round corners of radius r (one per corner, or one for all). */
function bend(pts, r) {
  const rr = Array.isArray(r) ? r : pts.map(() => r);
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const u = unit(sub(A, V));
    const v = unit(sub(B, V));
    const t = rr[i] / Math.tan(Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${P(add(V, mul(u, t)))}A${f(rr[i])} ${f(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${P(add(V, mul(v, t)))}`;
  }
  return `${d}L${P(pts.at(-1))}`;
}

/**
 * Circular arc from p0 to p1 bowing `sag` off the chord (positive: to the right of p0 → p1, so down
 * for a left-to-right chord), written as one cubic (exact to a hundredth for the arcs used here).
 */
function bow(p0, p1, sag) {
  const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const R = (c * c) / 8 / Math.abs(sag) + Math.abs(sag) / 2;
  const th = 2 * Math.asin(Math.min(1, c / 2 / R));
  const k = (4 / 3) * Math.tan(th / 4) * R;
  // The tangent at p0 turns from the chord toward the bulge by half the arc's angle
  const u = unit(sub(p1, p0));
  const n = sag > 0 ? [-u[1], u[0]] : [u[1], -u[0]];
  const t0 = add(mul(u, Math.cos(th / 2)), mul(n, Math.sin(th / 2)));
  const t1 = sub(mul(u, Math.cos(th / 2)), mul(n, Math.sin(th / 2)));
  return `M${P(p0)}C${P(add(p0, mul(t0, k)))} ${P(sub(p1, mul(t1, k)))} ${P(p1)}`;
}

// ── Pieces shared by several brands ───────────────────────────────────────────────────────────
const RING = circ(12, 12, 9);

/** A round bubble with a tail: the circle broken between angles a0 and a1, the tail's tip at `tip`. */
function tailBubble(c, r, a0, a1, tip) {
  return `M${P(tip)}L${P(polar(...c, r, a0))}A${f(r)} ${f(r)} 0 1 1 ${P(polar(...c, r, a1))}Z`;
}

// ── The brands ────────────────────────────────────────────────────────────────────────────────
// Instagram: the camera, its lens and the flash dot
const IG = { body: sq(3.25, 3.25, 17.5, 17.5, 5.25), lens: circ(12, 12, 4), flash: dot(17, 7) };

// Facebook: the f rising from the circle's bottom edge, its top curling right
const FB_STEM = `M13.25 ${f(12 + Math.sqrt(81 - 1.25 ** 2))}V10A2.5 2.5 0 0 1 15.75 7.5`;

// X: the falling diagonal is a band; the rising one stops at both of its edges
const X_BAND = roundpoly([[3.25, 3.5], [8.25, 3.5], [20.75, 20.5], [15.75, 20.5]], 0.6);

// Threads: one stroke, the outer loop turning into the inner bowl and its hook
const THREADS = 'M18.25 7.25C17 4.5 14.75 3 12 3C6.75 3 3.75 6.5 3.75 12C3.75 17.5 6.75 21 12 21C16.5 21 19.75 18.5 19.75 15.25C19.75 12.5 17.25 11.25 13.5 11.25C10.5 11.25 8.75 12.5 8.75 14C8.75 15.5 10 16.5 11.75 16.5C14.25 16.5 15.5 14.75 15.5 11.75C15.5 9 14.25 7.25 12.25 7.25C11 7.25 10.25 7.75 9.75 8.5';

// TikTok: the note, its bowl, its stem and the curved flag that returns to the stem
const TT_HEAD = circ(9.5, 16, 4.25);
const TT_NOTE = 'M13.75 16V3.75C13.75 6.25 16.25 8.25 19.25 8.25V11.5C17 11.5 15.25 10.75 13.75 9.5';

// Snapchat: the ghost, its arms and its skirt
const SNAP = smooth(
  mirrored([[12, 3], [15.75, 4.5], [17.25, 8.25], [17.25, 10.25], [19.25, 10.25], [19.25, 12], [17.5, 12.75], [17.75, 15.25], [20.5, 17.5, 1], [17.5, 18.5], [15.5, 19.75], [12, 20.25]]),
  true,
);

// Pinterest: the P whose stem runs down to the circle's edge
const PIN_STEM = `M12.25 9.25L10 ${f(12 + Math.sqrt(81 - 4))}`;
const PIN_BOWL = 'M8 12.75C7.25 8.25 10 5.5 13 5.5C16 5.5 17.5 7.5 17.5 10C17.5 13.25 15 15 11.13 15';

// LinkedIn: the in on its square
const LI = {
  box: sq(3.25, 3.25, 17.5, 17.5, 3.5),
  dot: dot(7.75, 7.6),
  i: 'M7.75 11.25V17',
  n: 'M11.25 17V11.25M11.25 13.75C11.25 12 12.5 11.25 13.75 11.25C15.25 11.25 16.25 12.25 16.25 14V17',
};

/** An oval bubble with a tail: the ellipse broken between parametric angles a0 > a1, the tail's tip at `tip`. */
function tailOval(c, rx, ry, a0, a1, tip) {
  const E = (a) => [c[0] + rx * Math.cos((a * Math.PI) / 180), c[1] + ry * Math.sin((a * Math.PI) / 180)];
  return `M${P(tip)}L${P(E(a0))}A${f(rx)} ${f(ry)} 0 1 1 ${P(E(a1))}Z`;
}
/** A lens (a leaf) between two points, each side bowing `sag` off the chord. */
const lens = (a, b, sag) => `${bow(a, b, sag)}${bow(b, a, sag).replace(/^M[^C]*/, '')}Z`;
/** Superellipse |x/a|^n + |y/b|^n = 1: a rounded rectangle whose sides bulge softly. */
function superellipse(cx, cy, a, b, n, steps = 36) {
  const pts = Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * 2 * Math.PI;
    const [c, s] = [Math.cos(t), Math.sin(t)];
    return [cx + a * Math.sign(c) * Math.abs(c) ** (2 / n), cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)];
  });
  return smooth(pts, true);
}
/** Where a rounded polygon's corner passes: the arc's midpoint on the corner's bisector (lines meet it there). */
function cornerMid(pts, i, r) {
  const n = pts.length;
  const [A, V, B] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n]];
  const u = unit(sub(A, V));
  const v = unit(sub(B, V));
  const th = Math.acos(u[0] * v[0] + u[1] * v[1]);
  return add(V, mul(unit(add(u, v)), r / Math.sin(th / 2) - r));
}
const deg = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

// Signal: the bubble in a ring of ten dashes; its tail points into the gap at the lower left
const SIGNAL_BUBBLE = tailBubble([12, 12], 5.25, 150, 120, polar(12, 12, 6.4, 135));
const SIGNAL_DASHES = Array.from({ length: 10 }, (_, k) => arc(12, 12, 9, 153 + 36 * k - 8.75, 153 + 36 * k + 8.75).d);

// WeChat: the larger bubble behind, the smaller one in front (a custom badge, so the engine clears it)
const WECHAT_BACK = tailOval([9.5, 9.5], 7, 6, 150, 120, [3.75, 17.25]);
const WECHAT_FRONT = tailOval([15.75, 15.25], 5.5, 4.5, 60, 30, [20.75, 20.75]);
const WECHAT_EYES = [dot(13.75, 14.5), dot(17.75, 14.5)];

// Discord: Clyde, the controller head with its horns and feet
const DISCORD = smooth(mirrored([[12, 6.75], [15, 6.25], [17.25, 5], [19.25, 6.5], [20.75, 10], [21.5, 14.75], [20.75, 17], [18.25, 18.75], [16.5, 19.25], [15.5, 17.75, 1], [12, 18]]), true);

// Slack: one piece (a pill and its stub, the stub's square corner toward the pill's end) turned
// four times around the center; the pieces stand 3 apart
const SLACK_PIECE = (() => {
  const [pr, sr, g] = [1.25, 1.15, 3];
  const c1 = 12 - pr - g / 2;
  const s = c1 - pr - g - sr;
  return [capsule([c1, 24 - c1], [c1, 24 - s], pr), turnPath(drop(s, 24 - c1, sr), -90, [s, 24 - c1])];
})();
const SLACK = [0, 90, 180, 270].flatMap((a) => SLACK_PIECE.map((d) => turnPath(d, a)));

// SoundCloud: the cloud (a flat left edge, a big puff and a small one) and the bars rising to it
function soundcloud() {
  const [C1, r1, C2, r2, base] = [[15, 10.75], 3.75, [18.75, 14], 2.75, 16.75];
  const [dx, dy] = sub(C2, C1);
  const dd = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(r1 * r1 - a * a);
  const X = [C1[0] + (a * dx) / dd + (h * dy) / dd, C1[1] + (a * dy) / dd - (h * dx) / dd];
  const sweep1 = (deg(C1, X) + 360 - 180) % 360;
  const sweep2 = (90 - deg(C2, X) + 360) % 360;
  return `M${P([C1[0] - r1, base])}V${f(C1[1])}A${r1} ${r1} 0 ${sweep1 > 180 ? 1 : 0} 1 ${P(X)}A${r2} ${r2} 0 ${sweep2 > 180 ? 1 : 0} 1 ${P([C2[0], base])}H${f(C1[0] - r1)}Z`;
}

// Steam: the piston, a ring at the upper right and a disc at the lower left joined by its rod
const STEAM_ROD = line(polar(8.75, 14.75, 1.5, deg([8.75, 14.75], [14.5, 9.5])), polar(14.5, 9.5, 2.5, deg([14.5, 9.5], [8.75, 14.75])));

// Xbox: two S-curves crossing at the center, steep at the rim, so the side openings are wide
const XB1 = polar(12, 12, 9, -118);
const XB2 = polar(12, 12, 9, 62);
const XBOX_X = `M${P(XB1)}C${P(add(XB1, [0.75, 3.5]))} 10.25 10.25 12 12S${P(sub(XB2, [0.75, 3.5]))} ${P(XB2)}`;

// Roblox: the square tilted 15°, a small square hole at its center
const tilted = (s, a) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => rot([12 + (u * s) / 2, 12 + (v * s) / 2], [12, 12], a));
const RBX_OUT = tilted(14.75, 15);
const RBX_IN = tilted(4.25, 15);

// Apple: the apple with its bite on the right, the leaf floating above
const APPLE_BODY =
  'M12 8.75C13.25 8 14.75 7.6 16.25 7.75C17.4 7.85 18.4 8.4 19.1 9.25A4 4 0 0 0 19.75 15.9C19.2 17.6 18.2 19.5 16.75 20.5C15.75 21.2 14.5 21.2 13.6 20.7C12.6 20.2 11.4 20.2 10.4 20.7C9.5 21.2 8.25 21.2 7.25 20.5C5.25 19 3.75 16.25 3.75 13.25C3.75 9.75 5.75 7.75 8.25 7.75C9.75 7.75 10.9 8.2 12 8.75Z';
const APPLE_LEAF = lens([12.25, 5.25], [15.75, 2], 1.4);

// Tux: the penguin from the front, its body widening from the head into the flippers, the eyes, the
// beak (a lens thin enough to stay solid at every weight) and the two flat feet in front (a custom
// badge, so the engine clears what they cover). A belly drawn inside read as a frown under the eyes
const TUX = smooth(mirrored([[12, 2.75], [15.5, 3.5], [17.25, 6.5], [17.25, 9.5], [19.25, 13.25], [20, 16.75], [18.75, 19.25], [15.5, 20.25], [12, 20.25]]), true);
const TUX_BEAK = lens([9.5, 10], [14.5, 10], 0.4);
const TUX_FEET = [ellipse(7.75, 20, 3, 1.5), ellipse(16.25, 20, 3, 1.5)];

// Google Play: the play triangle and its folds, from the back corners to a point on the axis and on to the tip
const GP = [[5, 3.5], [20.25, 12], [5, 20.5]];
const GP_R = [1.75, 1.5, 1.75];
const GP_FOLD = [11.75, 12];

// Chrome: three strokes leave the inner circle tangentially and run to the rim
const CHROME_LINES = [0, 120, 240].map((a) => line(rot([12, 8.5], [12, 12], a), rot([12 + Math.sqrt(81 - 3.5 ** 2), 8.5], [12, 12], a)));

// Edge: the disc and its breaking wave. One closed line: the ring runs from the lower lip (31°) round
// the bottom, the left and the top to the crest (6°); the crest runs back under itself to its tip,
// turns up into the hollow, round the hollow's head and out along the lower lip. The swirl's arm
// leaves the head and runs round to the ring at the left, as the gap between the mark's two upper
// pieces. Filled, a disc with a comma-shaped hollow and the arm cut through (a wide mouth from the
// edge read as Pac-Man)
const edgeWave = (r, a0, a1, hollow) => `${arc(12, 12, r, a1, a0 + 360).d}${smooth([[...polar(12, 12, r, a0), 1], ...hollow, [...polar(12, 12, r, a1), 1]]).replace(/^M[^C]*/, '')}Z`;
const EDGE = edgeWave(9, 6, 31, [[18.25, 13.5], [15.5, 13.6], [14.25, 12.9, 1], [14.5, 10.75], [13.25, 9.25], [11, 9.25], [9.25, 10.75], [8.75, 13], [9.75, 15.25], [12.5, 16.75], [16, 17.25]]);
const EDGE_ARM = smooth([[12.25, 9.25], [9.75, 7.6], [7, 7.4], polar(12, 12, 9, 200)]);

// Amazon: the smile, its right end turning up into the arrowhead
const AMZ_A = [3, 10.25];
const AMZ_B = [20, 10.25];
const AMZ_SAG = 4.75;
const AMZ_HEAD = (() => {
  const c = Math.hypot(AMZ_B[0] - AMZ_A[0], AMZ_B[1] - AMZ_A[1]);
  const R = (c * c) / 8 / AMZ_SAG + AMZ_SAG / 2;
  const center = [(AMZ_A[0] + AMZ_B[0]) / 2, AMZ_A[1] + AMZ_SAG - R];
  const a = Math.atan2(AMZ_B[1] - center[1], AMZ_B[0] - center[0]);
  return head(AMZ_B, [Math.sin(a), -Math.cos(a)], 4);
})();

// Shopify: the bag, its handle and the S on its front
const SHOP_S = `M${P(polar(12, 11.6, 2.25, -25))}A2.25 2.25 0 1 0 12 13.85A2.25 2.25 0 1 1 ${P(polar(12, 16.1, 2.25, 155))}`;

// Airbnb: the Bélo, one line: the rounded A, its legs crossing at the bottom into the inner loop
const AIRBNB = smooth(
  [[12, 17.5], [13.5, 15.5], [14.5, 12.75], [13.75, 10.5], [12, 9.75], [10.25, 10.5], [9.5, 12.75], [10.5, 15.5], [12, 17.5], [13.5, 19.5], [15.75, 20.75], [18.5, 20], [19.75, 17.25], [19, 13.5], [16, 7.75], [12, 3], [8, 7.75], [5, 13.5], [4.25, 17.25], [5.5, 20], [8.25, 20.75], [10.5, 19.5]],
  true,
);

// GitHub: the Octocat's head with its pointed ears, the neck, the tentacle curling out at the lower left
const GH_HEAD = smooth(mirrored([[12, 5.75], [14.25, 5.9], [15.75, 6.5, 1], [17.75, 3.5, 1], [18.5, 6.75], [18.75, 9.5], [18, 12.5], [16, 14.5], [14, 15.25, 1], [12, 15.25]]), true);

// Stack Overflow: the tray and the bars fanning up out of it
const SO_BARS = [[9, 17.5, 0], [9.5, 14.25, -12], [10.5, 11, -25], [11.25, 7.25, -40]].map(([x, y, a]) => line([x, y], add([x, y], [6 * Math.cos((a * Math.PI) / 180), 6 * Math.sin((a * Math.PI) / 180)])));

// CodePen: the box in wireframe, the outer hexagon, the flat rhombus in its middle and the edges between
const CP_HEX = [[12, 2.75], [20, 7.5], [20, 16.5], [12, 21.25], [4, 16.5], [4, 7.5]];

// Docker: the whale and the two rows of containers on its back
const DOCKER = smooth([[3.25, 11.75, 1], [17.5, 11.75], [19.5, 10.5], [21.25, 8.25, 1], [21, 11], [19.75, 14], [16.75, 17.25], [12.5, 19.25], [7.5, 18.75], [4.5, 16.5], [3.25, 13.75]], true);

// DigitalOcean: the thick ring, a band open at the lower left (a single line read as a speech bubble).
// Its end at the bottom runs straight up into the first pixel, the square inside the opening, so band
// and pixel are one contour; the second pixel hangs from the first one's lower left corner. The mark's
// third, smallest pixel is left out: hollow it would close at bold
const doRing = (ro, ri, ay, x, y, s) => {
  const [o, i] = [Math.sqrt(ro * ro - (ay - 12) ** 2), Math.sqrt(ri * ri - (ay - 12) ** 2)];
  const yi = 12 + Math.sqrt(ri * ri - (x - 12) ** 2);
  return `M${P([12 - o, ay])}A${f(ro)} ${f(ro)} 0 1 1 ${P([x, 12 + Math.sqrt(ro * ro - (x - 12) ** 2)])}V${f(y)}H${f(x - s)}V${f(y + s)}H${f(x)}${Math.abs(yi - y - s) > 0.01 ? `V${f(yi)}` : ''}A${f(ri)} ${f(ri)} 0 1 0 ${P([12 - i, ay])}Z`;
};
const DO = [doRing(9, 5.75, 12, 12, 14.5, 3.25), sq(5.75, 17.75, 3, 3, 0)];

// Hugging Face: the grinning face (its open mouth a half disc) and its two hands raised in front at its
// lower corners, mittens whose thumbs point in and up (round ovals there read as Waze's wheels). The
// hands are a custom badge, so the engine clears the face round them and leaves its chin between them
const HF_GRIN = 'M9 11.5H15A3 2.75 0 0 1 9 11.5Z';
/** A left mitten pointing up (the right one mirrored), scaled by `s` and tilted `a` toward the face. */
function mitten(c, a, flip, s) {
  const pts = [[0, -3], [1.4, -2.6], [2, -1.25], [2.6, -1.5, 1], [3.3, -0.4], [2.6, 1.6], [0.75, 3], [-1.5, 2.6], [-2.3, 0.6], [-2, -1.75]];
  return turnPath(smooth(pts.map(([x, y, k]) => [c[0] + (flip ? -x : x) * s, c[1] + y * s, k]), true), flip ? -a : a, c);
}
const HF_HANDS = [mitten([4.75, 17.5], 35, false, 0.85), mitten([19.25, 17.5], 35, true, 0.85)];

// OpenAI: the blossom, six arcs turning round a hexagonal center; each arc ends on another or
// stands well clear of it
const OPENAI = range(0, 6).map((k) => {
  const t = 60 * k - 90;
  return arc(...polar(12, 12, 4.5, t), 4.5, t - 135, t + 60).d;
});

// Claude: the spark, eight rays of uneven length from one point
const CLAUDE = [[-90, 9], [-42, 7.25], [3, 8.5], [47, 6.75], [92, 8.75], [138, 7.5], [178, 9], [224, 6.5]].map(([a, r]) => line([12, 12], polar(12, 12, r, a)));

// Figma: five pieces in two columns, touching as in the mark
const FIGMA = ['M12 3H9A3 3 0 0 0 9 9H12Z', 'M12 3H15A3 3 0 0 1 15 9H12Z', 'M12 9H9A3 3 0 0 0 9 15H12Z', 'M12 15V18A3 3 0 0 1 6 18A3 3 0 0 1 9 15Z', circ(15, 12, 3)];

// Adobe: the A's right leg from its apex to the foot, and where the bar (at 17) runs into it
const ADOBE_APEX = [12, 9];
const ADOBE_FOOT = [16.25, 20.75];
const ADOBE_BAR = [ADOBE_APEX[0] + ((ADOBE_FOOT[0] - ADOBE_APEX[0]) * (17 - ADOBE_APEX[1])) / (ADOBE_FOOT[1] - ADOBE_APEX[1]), 17];

// Notion: the slab seen from above (its top and left faces), its front face and the N on it
const NOTION_SLAB = [[3.75, 3.75], [17.25, 3.75], [20.25, 6.75], [20.25, 20.25], [6.75, 20.25], [3.75, 17.25]];
const NOTION_R = [1, 0.75, 0.75, 1, 0.75, 0.75];

// Trello: the board and its two lists, cut out when filled
const TRELLO = { board: sq(3.25, 3.25, 17.5, 17.5, 3.5), a: sq(6.75, 6.75, 3.5, 10.25, 1.25), b: sq(13.25, 6.75, 3.5, 6.5, 1.25) };

// Linear: the disc sliced by three parallel slits across its lower left
const LINEAR_SLITS = [0.35, 3.25, 6.15].map((o) => {
  const m = [12 - o * Math.SQRT1_2, 12 + o * Math.SQRT1_2];
  const h = Math.sqrt(81 - o * o) * Math.SQRT1_2;
  return line([m[0] - h, m[1] - h], [m[0] + h, m[1] + h]);
});

// Jira: three nested chevrons pointing up and to the right
const JIRA = [0, 1, 2].map((k) => {
  const c = [20 - 3.5 * k, 4 + 3.5 * k];
  return bend([[c[0] - 9, c[1]], c, [c[0], c[1] + 9]], [0, 1.5, 0]);
});

// Dropbox: the open box, four rhombuses touching at their points and a fifth below
const DROPBOX = [[7.68, 6.18], [16.32, 6.18], [7.68, 11.68], [16.32, 11.68], [12, 17.93]].map(([x, y]) => roundpoly([[x, y - 2.75], [x + 4.32, y], [x, y + 2.75], [x - 4.32, y]], 0));

// Google Drive: the triangle of three bands; the inner triangle's edges run on to the rim, one each
const GD = [[12, 3.5], [21.25, 19.5], [2.75, 19.5]];
const GD_IN = GD.map(([x, y]) => [12 + (x - 12) * 0.4375, 14.17 + (y - 14.17) * 0.4375]);
/** Where the ray from p along v meets segment a–b. */
function hit(p, v, a, b) {
  const w = sub(b, a);
  const den = v[0] * w[1] - v[1] * w[0];
  const t = ((a[0] - p[0]) * w[1] - (a[1] - p[1]) * w[0]) / den;
  return add(p, mul(v, t));
}
const GD_SPLITS = [0, 1, 2].map((i) => {
  // The inner edge from vertex i to vertex i+1, carried on past i+1 to the outer edge facing it
  const [a, b] = [GD_IN[i], GD_IN[(i + 1) % 3]];
  return line(b, hit(b, sub(b, a), GD[(i + 1) % 3], GD[(i + 2) % 3]));
});

// Google Photos: four half-round petals turning round the center
const PHOTOS = [0, -90, -180, -270].map((a) => turnPath('M12 12L12 3.5A4.25 4.25 0 0 0 12 12Z', a));

// Microsoft Teams: the person behind; the tile with its T in front (a custom badge)
const TEAMS_TILE = sq(2.75, 7.5, 11.5, 11.5, 2.5);
const TEAMS_T = ['M5.75 10.75H11.25', 'M8.5 10.75V16.25'];

// HubSpot: the sprocket, its ring, the stem up to the cap and two arms out to the left
const HS = { c: [15.5, 14], top: [15.5, 4.5], a: [6.25, 8], b: [10.75, 19] };
const hsArm = (to) => line(polar(...HS.c, 3.5, deg(HS.c, to)), to);

// PayPal: two slanted P's; the rear one, up and to the right, peeks out from behind the front one
// (a custom badge that clears it). Its stem would hide entirely, so it is drawn only to the bowl
const PP_FRONT = transform('M5.25 20.5L7.75 5.75H12C14.75 5.75 16.25 7.5 15.75 10.25C15.25 13 13.25 14.25 10.5 14.25H6.31', 1, -0.75, 0.75);
const PP_REAR = transform('M6.31 14.25L7.75 5.75H12C14.75 5.75 16.25 7.5 15.75 10.25C15.25 13 13.25 14.25 10.5 14.25Z', 1, 3.25, -3.25);

// Stripe: the S, slanted, on its square
const STRIPE_S = smooth([[15, 8.5], [12, 7.25], [9.25, 9.25], [12, 12], [14.75, 14.75], [12, 16.75], [9, 15.5]].map(([x, y]) => [x + (12 - y) * 0.2, y]));

// Waze: the bubble with its face, on two wheels (a custom badge, so the engine clears the bubble)
const WAZE_WHEELS = [circ(8.5, 18.75, 1.75), circ(16.25, 18.75, 1.75)];

// Yelp: the burst, five teardrop petals from one point, the largest pointing up. Each runs from its
// tip to a tangent of its round end and the long way round it (counterclockwise: clockwise, the arc
// would swing onto the far center and fold the petal into a heart)
function petal(c, t, rho, D, a) {
  const tip = polar(...c, rho, t);
  const C = polar(...c, D, t);
  const al = (Math.acos(a / (D - rho)) * 180) / Math.PI;
  return `M${P(tip)}L${P(polar(...C, a, t + 180 - al))}A${f(a)} ${f(a)} 0 1 0 ${P(polar(...C, a, t + 180 + al))}Z`;
}
const YELP = [[-95, 2], [-22, 1.75], [48, 1.75], [122, 1.75], [192, 1.75]].map(([t, a]) => petal([12, 12.25], t, 2.5, 7, a));

// Tripadvisor: the owl's eyes, side by side and touching, their pupils and the beak below
const TA_L = [7.75, 10.5];
const TA_R = [16.25, 10.5];

const icons = {
  'brand-flouvia': {
    tags: ['flouvia', 'isotipo', 'logotipo', 'marca', 'estudio', 'isotype', 'logo', 'brand', 'studio'],
    d: [FLOUVIA_DROP, FLOUVIA_U_IN],
    fill: { solid: [`${FLOUVIA_DROP}${FLOUVIA_U_IN}`] },
    mark: true,
  },
  'brand-flouvia-u': {
    tags: ['flouvia', 'u', 'isotipo', 'marca', 'monograma', 'isotype', 'brand', 'monogram'],
    d: [FLOUVIA_U],
    fill: { solid: [FLOUVIA_U] },
    mark: true,
  },
  'brand-cord': {
    tags: ['cord', 'cordhq', 'propuestas', 'cotización', 'cobro', 'proposals', 'quote', 'payment'],
    d: [CORD],
    fill: { solid: [CORD] },
    mark: true,
  },

  // ── Social networks ──
  'brand-instagram': {
    tags: ['instagram', 'red social', 'fotos', 'perfil', 'social network', 'photos', 'profile'],
    d: [IG.body, IG.lens, IG.flash],
  },
  'brand-facebook': {
    tags: ['facebook', 'red social', 'página', 'perfil', 'social network', 'page', 'profile'],
    d: [RING, FB_STEM, 'M10 12.75H16.25'],
  },
  'brand-x': {
    tags: ['x', 'twitter', 'red social', 'publicar', 'social network', 'post', 'tweet'],
    d: [X_BAND, line([20.25, 3.5], [13.42, 10.53]), line([10.58, 13.47], [3.75, 20.5])],
  },
  'brand-threads': {
    tags: ['threads', 'hilos', 'red social', 'publicar', 'social network', 'post'],
    d: [THREADS],
  },
  'brand-tiktok': {
    tags: ['tiktok', 'videos cortos', 'red social', 'short videos', 'social network', 'music'],
    d: [TT_HEAD, TT_NOTE],
  },
  'brand-snapchat': {
    tags: ['snapchat', 'fantasma', 'red social', 'ghost', 'social network', 'snap'],
    d: [SNAP],
  },
  'brand-pinterest': {
    tags: ['pinterest', 'tablero', 'guardar', 'pin', 'board', 'save', 'inspiration'],
    d: [RING, PIN_BOWL, PIN_STEM],
  },
  'brand-linkedin': {
    tags: ['linkedin', 'red profesional', 'empleo', 'perfil', 'professional network', 'jobs', 'profile'],
    d: [LI.box, LI.dot, LI.i, LI.n],
  },
  'brand-reddit': {
    tags: ['reddit', 'comunidad', 'foro', 'subreddit', 'community', 'forum'],
    d: [ellipse(12, 14.5, 8.25, 5.75), dot(8.75, 13), dot(15.25, 13), bow([9, 16.75], [15, 16.75], 1.25), 'M12 8.75L13 4L15.51 4.6', circ(17.25, 4.75, 1.75)],
  },
  'brand-tumblr': {
    tags: ['tumblr', 'blog', 'rebloguear', 'reblog', 'microblog', 'social'],
    d: ['M10.75 3.5V15.75C10.75 18.75 12.25 20.25 15 20.25H17', 'M7.25 9.25H16'],
  },
  'brand-mastodon': {
    tags: ['mastodon', 'fediverso', 'red social', 'fediverse', 'social network', 'toot'],
    d: [
      roundpoly([[4, 3.25], [20, 3.25], [20, 17.25], [11.75, 17.25], [9.75, 20.75], [4, 20.75]], [4.5, 4.5, 4.5, 1.25, 1.25, 4.5]),
      'M8.5 13.75V9.75A1.75 1.75 0 0 1 12 9.75V12.25',
      'M12 9.75A1.75 1.75 0 0 1 15.5 9.75V13.75',
    ],
  },
  'brand-bluesky': {
    tags: ['bluesky', 'mariposa', 'red social', 'butterfly', 'social network', 'skeet'],
    d: [
      smooth(
        mirrored([[12, 10.25, 1], [13.75, 7.5], [16.75, 4.75], [19.5, 3.75], [21, 5], [20.75, 8.25], [19.75, 11], [17.25, 12.75, 1], [19, 14.75], [18.5, 17.25], [16.25, 18.75], [14.25, 17.75], [12, 14.75, 1]]),
        true,
      ),
    ],
  },
  'brand-meta': {
    tags: ['meta', 'infinito', 'empresa', 'infinity', 'company', 'business'],
    // The loop crosses low in the middle: a narrow left lobe and a wider right one, both peaked
    d: [
      smooth(
        [[11.25, 13.75], [13.5, 9.5], [16.5, 5.75], [19.25, 7], [21, 11.75], [20.5, 16.75], [18, 18.5], [15.5, 17], [11.25, 13.75], [9.25, 9.5], [7.25, 6.75], [5, 7.75], [3.25, 12], [3.5, 16.5], [5.75, 18.25], [8.5, 17]],
        true,
      ),
    ],
  },
  'brand-medium': {
    tags: ['medium', 'artículos', 'blog', 'lectura', 'articles', 'reading', 'writing'],
    d: [circ(6.85, 12, 4.6), ellipse(16.5, 12, 2, 4.4), 'M21.5 8.25V15.75'],
  },
  'brand-substack': {
    tags: ['substack', 'boletín', 'suscribirse', 'newsletter', 'subscribe', 'writing'],
    d: ['M4.5 3.5H19.5', 'M4.5 7H19.5', roundpoly([[4.5, 10.5], [19.5, 10.5], [19.5, 20.25], [12, 16], [4.5, 20.25]], 0.75)],
  },
  'brand-wordpress': {
    tags: ['wordpress', 'sitio web', 'blog', 'cms', 'website', 'built with'],
    d: [RING, line(polar(12, 12, 9, -150), [8.75, 17], [12, 9.5], [15.25, 17], polar(12, 12, 9, -30))],
  },
  'brand-linktree': {
    tags: ['linktree', 'enlaces', 'link en bio', 'links', 'link in bio', 'profile'],
    d: [line([3.5, 11], [20.5, 11]), line([12, 11], [12, 2.75]), line(polar(12, 11, 8, -135), [12, 11], polar(12, 11, 8, -45)), line([12, 14], [12, 21.25])],
  },

  // ── Messaging ──
  'brand-whatsapp': {
    tags: ['whatsapp', 'chat', 'mensaje', 'llamada', 'message', 'call', 'business'],
    d: [tailBubble([12.5, 11.25], 8.5, 158, 118, [3.25, 20.75]), transform(nucleo.icons.phone.d[0], 0.55, 5.9, 4.65)],
  },
  'brand-telegram': {
    tags: ['telegram', 'canal', 'mensaje', 'avión de papel', 'channel', 'message', 'paper plane'],
    d: [RING, roundpoly([[5.75, 11.5], [16.25, 7.5], [14.25, 17], [10.75, 14]], [0.75, 0.75, 0.75, 0.4]), line([10.75, 14], [12.5, 12])],
  },
  'brand-messenger': {
    tags: ['messenger', 'chat', 'mensaje', 'rayo', 'message', 'lightning'],
    d: [tailBubble([12, 11.25], 8.5, 145, 110, [5.5, 20.75]), line([7.25, 13.75], [10.5, 9.75], [13.5, 12.75], [16.75, 8.75])],
  },
  'brand-signal': {
    tags: ['signal', 'mensajes privados', 'cifrado', 'private messages', 'encrypted', 'chat'],
    d: [SIGNAL_BUBBLE, ...SIGNAL_DASHES],
  },
  'brand-wechat': {
    tags: ['wechat', 'weixin', 'chat', 'mensaje', 'message', 'contact'],
    d: [WECHAT_BACK, dot(6.75, 7.75), dot(11.25, 7.75)],
    badge: { d: [WECHAT_FRONT, ...WECHAT_EYES], knock: WECHAT_FRONT, fill: { solid: [WECHAT_FRONT], cut: WECHAT_EYES } },
  },
  'brand-discord': {
    tags: ['discord', 'servidor', 'comunidad', 'juegos', 'server', 'community', 'gaming'],
    d: [DISCORD, dot(9.25, 12.75, 1), dot(14.75, 12.75, 1)],
  },
  'brand-slack': {
    tags: ['slack', 'canal', 'espacio de trabajo', 'equipo', 'channel', 'workspace', 'team'],
    d: SLACK,
  },

  // ── Video, music and games ──
  'brand-youtube': {
    tags: ['youtube', 'video', 'canal', 'suscribirse', 'channel', 'subscribe'],
    d: [superellipse(12, 12, 9.5, 6.75, 4.5), roundpoly([[10, 9], [15.5, 12], [10, 15]], 1)],
  },
  'brand-twitch': {
    tags: ['twitch', 'en vivo', 'transmisión', 'canal', 'live', 'stream', 'channel'],
    d: [
      roundpoly([[7.5, 2.75], [20, 2.75], [20, 12], [14, 18], [11.25, 18], [8, 21.25], [8, 18], [4, 18], [4, 6.25]], [0.6, 0.9, 0.6, 0.6, 0.4, 0.4, 0.4, 0.9, 0.6]),
      'M12.25 6.5V10.25',
      'M16 6.5V10.25',
    ],
  },
  'brand-vimeo': {
    tags: ['vimeo', 'video', 'reproductor', 'player', 'showcase', 'film'],
    d: [smooth([[3, 9.25], [4.75, 7.5], [6.5, 7.75], [7.75, 10.25], [9.25, 15.75], [10.75, 19], [12.5, 18.75], [16.5, 14], [19.75, 9.5], [20.75, 6.5], [19.25, 4.5], [16.25, 5.25]])],
  },
  'brand-netflix': {
    tags: ['netflix', 'series', 'películas', 'streaming', 'movies', 'watch'],
    // The diagonal runs in front of both uprights, like a folded ribbon
    d: [sq(5, 3, 3.5, 18, 0.75), sq(15.5, 3, 3.5, 18, 0.75)],
    badge: (() => {
      const diag = roundpoly([[5, 3], [8.5, 3], [19, 21], [15.5, 21]], 0.6);
      return { d: [diag], knock: diag, fill: { solid: [diag] } };
    })(),
  },
  'brand-spotify': {
    tags: ['spotify', 'música', 'podcast', 'playlist', 'music', 'listen'],
    d: [RING, bow([6.5, 9.5], [17.75, 10.25], -2), bow([7.25, 13], [16.75, 13.5], -1.6), bow([8, 16.25], [15.75, 16.75], -1.25)],
  },
  'brand-soundcloud': {
    tags: ['soundcloud', 'música', 'audio', 'pista', 'music', 'track'],
    d: [soundcloud(), 'M8.25 16.75V10.25', 'M5.25 16.75V12', 'M2.25 16.75V13.75'],
  },
  'brand-tidal': {
    tags: ['tidal', 'música', 'álbum', 'alta fidelidad', 'music', 'album', 'hifi'],
    d: [[5.5, 8.75], [12, 8.75], [18.5, 8.75], [12, 15.25]].map(([x, y]) => roundpoly([[x, y - 3.25], [x + 3.25, y], [x, y + 3.25], [x - 3.25, y]], 0)),
  },
  'brand-apple-podcasts': {
    tags: ['apple podcasts', 'podcast', 'escuchar', 'programa', 'listen', 'show'],
    d: [circ(12, 10.25, 1.75), capsule([12, 16.25], [12, 20], 1.25), arc(12, 10.25, 5, 150, 390).d, arc(12, 10.25, 8.25, 125, 415).d],
  },
  'brand-steam': {
    tags: ['steam', 'juegos', 'tienda', 'videojuegos', 'games', 'store', 'gaming'],
    d: [RING, circ(14.5, 9.5, 2.5), circ(8.75, 14.75, 1.5), STEAM_ROD],
  },
  'brand-xbox': {
    tags: ['xbox', 'consola', 'juegos', 'gamertag', 'console', 'gaming'],
    d: [RING, XBOX_X, flipPath(XBOX_X)],
  },
  'brand-nintendo-switch': {
    tags: ['nintendo switch', 'consola', 'juegos', 'eshop', 'console', 'gaming'],
    d: [sq(3.5, 2.75, 7, 18.5, 4.5, { square: ['tr', 'br'] }), sq(13.5, 2.75, 7, 18.5, 4.5, { square: ['tl', 'bl'] }), dot(7, 7.5, 1), dot(17, 14.5, 1)],
  },
  'brand-roblox': {
    tags: ['roblox', 'juegos', 'experiencia', 'games', 'experience', 'gaming'],
    d: [roundpoly(RBX_OUT, 1.25), roundpoly(RBX_IN, 0.4)],
  },

  // ── Platforms and stores ──
  'brand-apple': {
    tags: ['apple', 'manzana', 'iniciar sesión', 'mac', 'iphone', 'sign in'],
    d: [APPLE_BODY, APPLE_LEAF],
  },
  'brand-google': {
    tags: ['google', 'iniciar sesión', 'cuenta', 'sign in', 'account', 'search'],
    d: [`${arc(12, 12, 9, -40, -360).d}H12.25`],
  },
  'brand-microsoft': {
    tags: ['microsoft', 'windows', 'iniciar sesión', 'sign in', 'office', 'download'],
    d: [[3.85, 3.85], [13.55, 3.85], [3.85, 13.55], [13.55, 13.55]].map(([x, y]) => sq(x, y, 6.6, 6.6, 0)),
  },
  'brand-android': {
    tags: ['android', 'robot', 'descargar', 'app', 'download', 'mobile'],
    d: ['M3.25 17.5A8.75 8.75 0 0 1 20.75 17.5Z', line(polar(12, 17.5, 8.75, -122), polar(12, 17.5, 12, -122)), line(polar(12, 17.5, 8.75, -58), polar(12, 17.5, 12, -58)), dot(8.5, 14.25), dot(15.5, 14.25)],
  },
  'brand-linux': {
    tags: ['linux', 'tux', 'pingüino', 'penguin', 'open source', 'download'],
    d: [TUX, dot(10, 6.5), dot(14, 6.5), TUX_BEAK],
    badge: { d: TUX_FEET, knock: TUX_FEET.join(''), fill: { solid: TUX_FEET } },
  },
  'brand-ubuntu': {
    tags: ['ubuntu', 'linux', 'círculo de amigos', 'circle of friends', 'download', 'package'],
    d: [180, -60, 60].flatMap((a) => [dot(...polar(12, 12, 7.75, a), 1), arc(12, 12, 6.25, a + 30, a + 90).d]),
  },
  'brand-app-store': {
    tags: ['app store', 'descargar', 'aplicación', 'download', 'app', 'ios'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4.5), line([7.5, 17], [13, 7.5]), line([11, 7.5], [16.5, 17]), line([6.5, 14], [17.5, 14])],
  },
  'brand-google-play': {
    tags: ['google play', 'descargar', 'aplicación', 'android', 'download', 'app'],
    d: [roundpoly(GP, GP_R), line(cornerMid(GP, 0, GP_R[0]), GP_FOLD, cornerMid(GP, 2, GP_R[2])), line(GP_FOLD, cornerMid(GP, 1, GP_R[1]))],
  },
  'brand-chrome': {
    tags: ['chrome', 'navegador', 'extensión', 'browser', 'extension', 'web'],
    d: [RING, circ(12, 12, 3.5), ...CHROME_LINES],
  },
  'brand-edge': {
    tags: ['edge', 'navegador', 'microsoft', 'browser', 'extension', 'web'],
    d: [EDGE, EDGE_ARM],
  },

  // ── Commerce ──
  'brand-amazon': {
    tags: ['amazon', 'comprar', 'tienda', 'lista de deseos', 'buy', 'store', 'wishlist'],
    d: [bow(AMZ_A, AMZ_B, AMZ_SAG), AMZ_HEAD],
  },
  'brand-shopify': {
    tags: ['shopify', 'tienda en línea', 'bolsa', 'comercio', 'online store', 'shop', 'ecommerce'],
    d: [roundpoly([[4.5, 6.25], [19.5, 6.25], [18.5, 21.25], [5.5, 21.25]], [1.5, 1.5, 2, 2]), 'M8.5 6.25A3.5 3.5 0 0 1 15.5 6.25', SHOP_S],
  },
  'brand-airbnb': {
    tags: ['airbnb', 'alojamiento', 'reservar', 'hospedaje', 'stay', 'book', 'listing'],
    d: [AIRBNB],
  },

  // ── Developers ──
  'brand-github': {
    tags: ['github', 'repositorio', 'código', 'octocat', 'repository', 'code'],
    d: [GH_HEAD, 'M10 15.25V21.25', 'M14 15.25V21.25', smooth([[10, 18.5], [8.25, 19], [6.5, 18], [5.25, 16.5]])],
  },
  'brand-gitlab': {
    tags: ['gitlab', 'repositorio', 'código', 'tanuki', 'repository', 'code'],
    d: [roundpoly([[2.75, 12.75], [5.5, 3.75], [8, 10.25], [16, 10.25], [18.5, 3.75], [21.25, 12.75], [12, 20.5]], [1, 0.9, 0.6, 0.6, 0.9, 1, 1.25])],
  },
  'brand-bitbucket': {
    tags: ['bitbucket', 'repositorio', 'código', 'cubeta', 'repository', 'code'],
    d: [roundpoly([[3, 4], [21, 4], [18.25, 20.25], [5.75, 20.25]], 1.25), roundpoly([[12, 9.5], [14.5, 12.5], [12, 15.5], [9.5, 12.5]], 0.5)],
  },
  'brand-stack-overflow': {
    tags: ['stack overflow', 'preguntas', 'respuestas', 'programación', 'questions', 'answers'],
    d: [bend([[6, 14.5], [6, 20.75], [18, 20.75], [18, 14.5]], 1), ...SO_BARS],
  },
  'brand-codepen': {
    tags: ['codepen', 'código', 'pen', 'front-end', 'code', 'playground'],
    d: [roundpoly(CP_HEX, 1.25), roundpoly([[4, 12], [12, 7.25], [20, 12], [12, 16.75]], 0), line(cornerMid(CP_HEX, 0, 1.25), [12, 7.25]), line([12, 16.75], cornerMid(CP_HEX, 3, 1.25))],
  },
  'brand-docker': {
    tags: ['docker', 'contenedor', 'imagen', 'ballena', 'container', 'image', 'whale'],
    d: [DOCKER, 'M5.5 11.75V8.25H9V4.75H16V11.75Z', 'M9 8.25H16', 'M9 8.25V11.75', 'M12.5 4.75V11.75'],
  },
  'brand-vscode': {
    tags: ['visual studio code', 'vs code', 'editor', 'extensión', 'code editor', 'extension'],
    d: [sq(15.5, 2.75, 4.25, 18.5, 2.1), 'M15.5 5.75L4.25 15.25', 'M15.5 18.25L4.25 8.75'],
  },
  'brand-digitalocean': {
    tags: ['digitalocean', 'nube', 'servidor', 'droplet', 'cloud', 'server', 'deploy'],
    d: DO,
  },
  'brand-hugging-face': {
    tags: ['hugging face', 'modelos', 'ia', 'dataset', 'models', 'ai', 'spaces'],
    d: [circ(12, 10.25, 8), dot(9.25, 8), dot(14.75, 8), HF_GRIN],
    badge: { d: HF_HANDS, knock: HF_HANDS.join(''), fill: { solid: HF_HANDS } },
  },

  // ── AI ──
  'brand-openai': {
    tags: ['openai', 'chatgpt', 'inteligencia artificial', 'ia', 'artificial intelligence', 'ai'],
    d: OPENAI,
  },
  'brand-claude': {
    tags: ['claude', 'anthropic', 'inteligencia artificial', 'ia', 'artificial intelligence', 'ai'],
    d: CLAUDE,
  },

  // ── Design ──
  'brand-figma': {
    tags: ['figma', 'diseño', 'prototipo', 'archivo', 'design', 'prototype', 'file'],
    d: FIGMA,
  },
  'brand-framer': {
    tags: ['framer', 'sitio web', 'diseño', 'prototipo', 'website', 'design', 'prototype'],
    d: [
      roundpoly([[5.75, 2.75], [18.25, 2.75], [18.25, 9], [12, 9]], [0.6, 0.6, 0.6, 0]),
      roundpoly([[5.75, 9], [12, 9], [18.25, 15.25], [12, 15.25], [12, 21.25], [5.75, 15]], [0.6, 0, 0.6, 0.4, 0.6, 0.6]),
    ],
  },
  'brand-dribbble': {
    tags: ['dribbble', 'diseño', 'portafolio', 'shot', 'design', 'portfolio'],
    d: [RING, bow(polar(12, 12, 9, -125), polar(12, 12, 9, 55), 2.5), bow(polar(12, 12, 9, 170), polar(12, 12, 9, -45), 2.5), bow(polar(12, 12, 9, 15), polar(12, 12, 9, 105), 2)],
  },
  'brand-adobe': {
    tags: ['adobe', 'creative cloud', 'diseño', 'design', 'creative', 'account'],
    // The two side pieces, and the A between them as a line: its right leg and the bar it runs into
    d: [roundpoly([[3.25, 3.25], [9.25, 3.25], [3.25, 20.75]], 0.6), roundpoly([[14.75, 3.25], [20.75, 3.25], [20.75, 20.75]], 0.6), line(ADOBE_APEX, ADOBE_FOOT), line([9, 17], ADOBE_BAR)],
  },
  'brand-unsplash': {
    tags: ['unsplash', 'fotos', 'crédito', 'fotógrafo', 'photos', 'credit', 'photographer'],
    d: [sq(8.75, 3.25, 6.5, 5, 0), roundpoly([[3.25, 11.25], [8.75, 11.25], [8.75, 15.25], [15.25, 15.25], [15.25, 11.25], [20.75, 11.25], [20.75, 20.75], [3.25, 20.75]], 0)],
  },
  'brand-notion': {
    tags: ['notion', 'página', 'notas', 'documentos', 'page', 'notes', 'docs'],
    d: [
      roundpoly(NOTION_SLAB, NOTION_R),
      line(cornerMid(NOTION_SLAB, 4, NOTION_R[4]), [6.75, 6.75], cornerMid(NOTION_SLAB, 2, NOTION_R[2])),
      line([10.5, 16.5], [10.5, 10.5], [16.5, 16.5], [16.5, 10.5]),
    ],
  },

  // ── Work and productivity ──
  'brand-trello': {
    tags: ['trello', 'tablero', 'tarjetas', 'kanban', 'board', 'cards'],
    d: [TRELLO.board, TRELLO.a, TRELLO.b],
  },
  'brand-asana': {
    tags: ['asana', 'proyecto', 'tareas', 'equipo', 'project', 'tasks', 'team'],
    d: [circ(12, 7.5, 3.25), circ(7.25, 16.5, 3.25), circ(16.75, 16.5, 3.25)],
  },
  'brand-linear': {
    tags: ['linear', 'incidencias', 'proyecto', 'issues', 'project', 'tracker'],
    d: [RING, ...LINEAR_SLITS],
  },
  'brand-clickup': {
    tags: ['clickup', 'tareas', 'productividad', 'tasks', 'productivity', 'project'],
    d: [line([6.25, 11], [12, 5.5], [17.75, 11]), bow([4, 13.75], [20, 13.75], 4.5)],
  },
  'brand-monday': {
    tags: ['monday', 'tablero', 'flujo de trabajo', 'board', 'work os', 'workflow'],
    d: [capsule([4.25, 15.5], [7.5, 9], 1.65), capsule([11.25, 15.5], [14.5, 9], 1.65), circ(19.25, 15.25, 1.75)],
  },
  'brand-miro': {
    tags: ['miro', 'pizarra', 'colaboración', 'whiteboard', 'collaboration', 'board'],
    d: [0, 1, 2].map((k) => line([4.25 + 5.25 * k, 19.75], [9.25 + 5.25 * k, 4.25], [7.25 + 5.25 * k, 4.25])),
  },
  'brand-airtable': {
    tags: ['airtable', 'base de datos', 'tabla', 'base', 'database', 'spreadsheet'],
    d: [roundpoly([[12, 3.25], [20.75, 7], [12, 10.75], [3.25, 7]], 1), roundpoly([[13.75, 13.5], [20.75, 10.25], [20.75, 18], [13.75, 21.25]], 0.75), roundpoly([[3.25, 10.5], [10.5, 14.25], [3.25, 18.5]], 0.75)],
  },
  'brand-jira': {
    tags: ['jira', 'incidencias', 'tickets', 'proyecto', 'issues', 'project'],
    d: JIRA,
  },

  // ── Files and storage ──
  'brand-dropbox': {
    tags: ['dropbox', 'archivos', 'nube', 'compartir', 'files', 'cloud', 'share'],
    d: DROPBOX,
  },
  'brand-google-drive': {
    tags: ['google drive', 'archivos', 'nube', 'guardar', 'files', 'cloud', 'save'],
    d: [roundpoly(GD, 1.5), roundpoly(GD_IN, 0), ...GD_SPLITS],
  },
  'brand-google-photos': {
    tags: ['google photos', 'fotos', 'álbum', 'galería', 'photos', 'album', 'gallery'],
    d: PHOTOS,
  },
  'brand-gmail': {
    tags: ['gmail', 'correo', 'email', 'bandeja', 'mail', 'inbox'],
    d: [bend([[3.25, 18.25], [3.25, 5.75], [12, 12.25], [20.75, 5.75], [20.75, 18.25]], [0, 1.75, 1.5, 1.75, 0])],
  },
  'brand-microsoft-teams': {
    tags: ['microsoft teams', 'reunión', 'videollamada', 'equipo', 'meeting', 'call', 'team'],
    d: [circ(19, 5.25, 2.25), sq(12, 10.5, 9.25, 9.25, 3.5)],
    badge: { d: [TEAMS_TILE, ...TEAMS_T], knock: TEAMS_TILE, fill: { solid: [TEAMS_TILE], cut: TEAMS_T } },
  },

  // ── Customers and support ──
  'brand-hubspot': {
    tags: ['hubspot', 'crm', 'formulario', 'marketing', 'form', 'sales'],
    d: [circ(...HS.c, 3.5), line([HS.c[0], HS.c[1] - 3.5], HS.top), dot(...HS.top, 1), hsArm(HS.a), dot(...HS.a, 1), hsArm(HS.b), dot(...HS.b, 1)],
  },
  'brand-intercom': {
    tags: ['intercom', 'soporte', 'chat', 'mensajero', 'support', 'messenger'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4), 'M7.5 7.5V12.75', 'M10.5 6.75V13.75', 'M13.5 6.75V13.75', 'M16.5 7.5V12.75', bow([7, 16.25], [17, 16.25], 1.5)],
  },
  'brand-zendesk': {
    tags: ['zendesk', 'soporte', 'centro de ayuda', 'support', 'help center', 'tickets'],
    d: [
      'M3 4H10.5A3.75 3.75 0 0 1 3 4Z',
      roundpoly([[13.5, 4], [21, 4], [13.5, 13.5]], 0.6),
      roundpoly([[10.5, 10.5], [10.5, 20], [3, 20]], 0.6),
      'M13.5 20H21A3.75 3.75 0 0 0 13.5 20Z',
    ],
  },
  'brand-basecamp': {
    tags: ['basecamp', 'proyecto', 'equipo', 'montaña', 'project', 'team'],
    d: ['M3 15.5C3 9 7 4.25 12 4.25C17 4.25 21 9 21 15.5C17.5 19.75 6.5 19.75 3 15.5Z', line([6.25, 14.5], [9.25, 11], [11.5, 13], [14.5, 8.75], [17.75, 14.5])],
  },
  'brand-todoist': {
    tags: ['todoist', 'tareas', 'pendientes', 'lista', 'tasks', 'to-do', 'list'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4), ...[8.25, 12, 15.75].map((y) => line([7, y], [8.75, y + 1.25], [17, y - 1.25]))],
  },

  // ── Payments ──
  'brand-paypal': {
    tags: ['paypal', 'pagar', 'pago', 'cobrar', 'pay', 'payment', 'checkout'],
    d: [PP_REAR],
    badge: { d: [PP_FRONT], knock: `${PP_FRONT}Z` },
  },
  'brand-stripe': {
    tags: ['stripe', 'pagar', 'pagos', 'cobro', 'pay', 'payments', 'checkout'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4), STRIPE_S],
  },

  // ── Places, travel and fitness ──
  'brand-waze': {
    tags: ['waze', 'navegación', 'cómo llegar', 'mapa', 'navigation', 'directions', 'map'],
    d: [tailOval([12.25, 10.5], 8.25, 6.75, 165, 140, [2.75, 15.75]), dot(10.75, 8.75), dot(15.75, 8.75), bow([10.25, 12.5], [16.5, 12.5], 1.5)],
    badge: { d: WAZE_WHEELS, knock: WAZE_WHEELS.join(''), fill: { solid: WAZE_WHEELS } },
  },
  'brand-yelp': {
    tags: ['yelp', 'reseñas', 'restaurantes', 'negocio', 'reviews', 'restaurants', 'business'],
    d: YELP,
  },
  'brand-tripadvisor': {
    tags: ['tripadvisor', 'viajes', 'reseñas', 'hoteles', 'travel', 'reviews', 'hotels'],
    d: [circ(...TA_L, 4.25), circ(...TA_R, 4.25), dot(...TA_L, 1), dot(...TA_R, 1), line(polar(...TA_L, 4.25, 50), [12, 17.5], polar(...TA_R, 4.25, 130))],
  },
  'brand-strava': {
    tags: ['strava', 'correr', 'ciclismo', 'actividad', 'running', 'cycling', 'activity'],
    d: [line([4.75, 13.5], [10.25, 2.75], [15.75, 13.5]), line([11.25, 13.5], [15.25, 21.25], [19.25, 13.5])],
  },
};

// ── Fill (DESIGN.md › Fill): the symbol solid, as its owner draws it in one color ──
// By index into d; a string is a contour of its own (a shape closed for the fill, or a symbol
// with its hole wound against it)
const FILL = {
  'brand-instagram': { solid: [0], cut: [1, 2] },
  'brand-facebook': { solid: [0], cut: [1, 2] },
  'brand-x': { solid: [0], wire: [1, 2] },
  'brand-tiktok': { solid: [0, `${TT_NOTE}Z`], cut: [dot(9.5, 16)], wire: ['M13.75 16V3.75'] },
  'brand-snapchat': { solid: [0] },
  'brand-pinterest': { solid: [0], cut: [1, 2] },
  'brand-linkedin': { solid: [0], cut: [1, 2, 3] },
  'brand-reddit': { solid: [0, 5], cut: [1, 2, 3], wire: [4] },
  'brand-mastodon': { solid: [0], cut: [1, 2] },
  'brand-bluesky': { solid: [0] },
  'brand-medium': { solid: [0, 1], wire: [2] },
  'brand-substack': { solid: [2], lines: [0, 1] },
  'brand-wordpress': { solid: [0], cut: [1] },
  'brand-whatsapp': { solid: [0], cut: [1] },
  'brand-telegram': { solid: [0], cut: [1, 2] },
  'brand-messenger': { solid: [0], cut: [1] },
  'brand-signal': { solid: [0], lines: range(1, 11) },
  'brand-wechat': { solid: [0], cut: [1, 2] },
  'brand-discord': { solid: [0], cut: [1, 2] },
  'brand-slack': { solid: range(0, 8) },
  'brand-youtube': { solid: [0], cut: [1] },
  'brand-twitch': { solid: [0], cut: [1, 2] },
  'brand-netflix': { solid: [0, 1] },
  'brand-spotify': { solid: [0], cut: [1, 2, 3] },
  'brand-soundcloud': { solid: [0], lines: [1, 2, 3] },
  'brand-tidal': { solid: [0, 1, 2, 3] },
  'brand-apple-podcasts': { solid: [0, 1], lines: [2, 3] },
  'brand-steam': { solid: [0], cut: [1, 2, 3] },
  'brand-xbox': { solid: [0], cut: [1, 2] },
  'brand-nintendo-switch': { solid: [0, 1], cut: [2, 3] },
  'brand-roblox': { solid: [`${roundpoly(RBX_OUT, 1.25)}${roundpoly(rev(RBX_IN), 0.4)}`] },
  'brand-apple': { solid: [0, 1] },
  'brand-microsoft': { solid: [0, 1, 2, 3] },
  'brand-android': { solid: [0], cut: [3, 4], wire: [1, 2] },
  'brand-linux': { solid: [0], cut: [1, 2, 3] },
  'brand-app-store': { solid: [0], cut: [1, 2, 3] },
  'brand-google-play': { solid: [0], cut: [1, 2] },
  'brand-chrome': { solid: [0], cut: [1, 2, 3, 4] },
  'brand-edge': { solid: [0], cut: [1] },
  // The handle rises from the bag's top edge: attached, as the lock's shackle
  'brand-shopify': { solid: [0], wire: [1], cut: [2] },
  'brand-github': { solid: [0], wire: [1, 2, 3] },
  'brand-gitlab': { solid: [0] },
  'brand-bitbucket': { solid: [`${roundpoly([[3, 4], [21, 4], [18.25, 20.25], [5.75, 20.25]], 1.25)}${roundpoly(rev([[12, 9.5], [14.5, 12.5], [12, 15.5], [9.5, 12.5]]), 0.5)}`] },
  'brand-codepen': { solid: [0], cut: [1, 2, 3] },
  'brand-docker': { solid: [0], wire: [1, 2, 3, 4] },
  'brand-vscode': { solid: [0], wire: [1, 2] },
  'brand-digitalocean': { solid: [0, 1] },
  'brand-hugging-face': { solid: [0], cut: [1, 2, 3] },
  // The four halves solid, parted by cuts along the seams where they touch (each run out past the
  // silhouette, so they part at every weight); the circle stays a ring, its clearance parting it from
  // the three pieces it touches (solid, the cuts would shave its round side flat)
  'brand-figma': { solid: [0, 1, 2, 3], lines: [4], cut: ['M12 1.5V9', 'M5.25 9H12', 'M5.25 15H12'] },
  'brand-framer': { solid: [0, 1] },
  'brand-dribbble': { solid: [0], cut: [1, 2, 3] },
  'brand-adobe': { solid: [0, 1], wire: [2, 3] },
  'brand-unsplash': { solid: [0, 1] },
  'brand-notion': { solid: [0], cut: [1, 2] },
  'brand-trello': { solid: [`${TRELLO.board}${flipPath(TRELLO.a, 'x', 8.5)}${flipPath(TRELLO.b, 'x', 15)}`] },
  'brand-asana': { solid: [0, 1, 2] },
  'brand-linear': { solid: [0], cut: [1, 2, 3] },
  'brand-monday': { solid: [0, 1, 2] },
  'brand-airtable': { solid: [0, 1, 2] },
  'brand-dropbox': { solid: [0, 1, 2, 3, 4] },
  'brand-google-drive': { solid: [`${roundpoly(GD, 1.5)}${roundpoly(rev(GD_IN), 0)}`], cut: [2, 3, 4] },
  'brand-google-photos': { solid: [0, 1, 2, 3] },
  'brand-microsoft-teams': { solid: [0, 1] },
  // The ring stays a ring, as in the mark; the cap and the arms' ends are solid
  'brand-hubspot': { solid: [2, 4, 6], wire: [0, 1, 3, 5] },
  'brand-intercom': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'brand-zendesk': { solid: [0, 1, 2, 3] },
  'brand-basecamp': { solid: [0], cut: [1] },
  'brand-todoist': { solid: [0], cut: [1, 2, 3] },
  'brand-stripe': { solid: [0], cut: [1] },
  'brand-waze': { solid: [0], cut: [1, 2, 3] },
  'brand-yelp': { solid: [0, 1, 2, 3, 4] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, ix]) => [k, pick(ix)]));
}
// Open strokes only: the symbol is its own stroke, so its filled version is the outline
for (const name of ['brand-threads', 'brand-tumblr', 'brand-meta', 'brand-linktree', 'brand-vimeo', 'brand-google', 'brand-ubuntu', 'brand-amazon', 'brand-airbnb', 'brand-stack-overflow', 'brand-openai', 'brand-claude', 'brand-clickup', 'brand-miro', 'brand-jira', 'brand-gmail', 'brand-paypal', 'brand-strava', 'brand-tripadvisor']) icons[name].fill = false;

// ── 16 px (DESIGN.md › 16 px): where the snapped drawing smudges, a simpler one on the pixel grid
// (pixel centers at 0.75 + 1.5k; a circle centered on the canvas has its extremes on them at r 8.25,
// 6.75…; a dot of r 0.75 centered between pixels fills a crisp 2 × 2). Pills and nubs too small to
// keep a hole become solid strokes: a capsule of r 0.75 inks 2 pixels wide.
const small = (name, d, fill) => {
  icons[name].small = { d, fill: fill === false ? undefined : fill };
};
const R16 = circ(12, 12, 8.25);
// Threads: the outer loop running into the bowl, and the bowl's hook
small('brand-threads', [`${arc(12, 12, 8.25, -45, -354.78).d}H14.25`, circ(11.25, 12.75, 3)], false);
// Pinterest: an upright P whose stem runs to the ring
small('brand-pinterest', [R16, `M11.25 ${f(12 + Math.sqrt(8.25 ** 2 - 0.75 ** 2))}V6.75H12.75A3 3 0 0 1 12.75 12.75H11.25`], { solid: [R16], cut: [`M11.25 ${f(12 + Math.sqrt(8.25 ** 2 - 0.75 ** 2))}V6.75H12.75A3 3 0 0 1 12.75 12.75H11.25`] });
// WordPress: the W, its outer arms on the ring
small('brand-wordpress', [R16, line(polar(12, 12, 8.25, -150), [8.25, 16.5], [12, 10.5], [15.75, 16.5], polar(12, 12, 8.25, -30))], { solid: [R16], cut: [line(polar(12, 12, 8.25, -150), [8.25, 16.5], [12, 10.5], [15.75, 16.5], polar(12, 12, 8.25, -30))] });
// WhatsApp and Messenger: the round bubble on a pixel center, its tail at the lower left
const BUBBLE16 = tailBubble([12.75, 11.25], 7.5, 160, 115, [3.75, 20.25]);
const HANDSET16 = 'M10.5 7.5L8.25 9.75C8.25 12.75 11.25 15.75 14.25 15.75L16.5 13.5';
small('brand-whatsapp', [BUBBLE16, HANDSET16], { solid: [BUBBLE16], cut: [HANDSET16] });
const BOLT16 = line([8.25, 14.25], [11.25, 9.75], [14.25, 12.75], [17.25, 8.25]);
small('brand-messenger', [BUBBLE16, BOLT16], { solid: [BUBBLE16], cut: [BOLT16] });
// Telegram: the plane as one triangle in the ring
const PLANE16 = roundpoly([[6.75, 11.25], [16.75, 7.25], [14.25, 16.75]], 0.4);
small('brand-telegram', [R16, PLANE16], { solid: [R16], cut: [PLANE16] });
// Slack: solid pills and round nubs, one piece turned four times
const SLACK16 = [0, 90, 180, 270].flatMap((a) => [turnPath(capsule([9, 15], [9, 19.5], 0.75), a), turnPath(dot(4.5, 15, 0.75), a)]);
small('brand-slack', SLACK16, { solid: SLACK16 });
// Apple Podcasts: the head, the body and both waves, two pixels apart and centered between pixels
// (so every extreme of the waves lands on a pixel center); head and body solid
const POD16 = [dot(12, 9, 0.75), capsule([12, 14.25], [12, 19.5], 0.75), arc(12, 9, 3.75, 140, 400).d, arc(12, 9, 6.75, 125, 415).d];
small('brand-apple-podcasts', POD16, { solid: POD16.slice(0, 2), lines: POD16.slice(2) });
// Chrome: the rim, the lens and its three edges, the first one level on a pixel row
const CHROME16 = [R16, circ(12, 12, 3.75), ...[0, 120, 240].map((a) => line(rot([12, 8.25], [12, 12], a), rot([12 + Math.sqrt(8.25 ** 2 - 3.75 ** 2), 8.25], [12, 12], a)))];
small('brand-chrome', CHROME16, { solid: [R16], cut: CHROME16.slice(1) });
// monday.com: two solid pills and the dot
const MONDAY16 = [capsule([5.25, 15.75], [8.25, 9.75], 0.75), capsule([11.25, 15.75], [14.25, 9.75], 0.75), dot(18, 15, 0.75)];
small('brand-monday', MONDAY16, { solid: MONDAY16 });
// Todoist: the square and three flat checks, two pixels apart
const TODO16 = [sq(3.75, 3.75, 16.5, 16.5, 3), ...[8.25, 12.75, 17.25].map((y) => line([6.75, y - 1.5], [8.25, y], [17.25, y - 3]))];
small('brand-todoist', TODO16, { solid: [TODO16[0]], cut: TODO16.slice(1) });
// Shopify and Stripe: the S drawn on the pixel grid
const S16 = 'M14.25 9.75H9.75V12.75H14.25V15.75H9.75';
small('brand-shopify', [sq(5.25, 6.75, 13.5, 12.75, 1.5), 'M9.75 6.75V3.75H14.25V6.75', S16], { solid: [sq(5.25, 6.75, 13.5, 12.75, 1.5)], wire: ['M9.75 6.75V3.75H14.25V6.75'], cut: [S16] });
small('brand-stripe', [sq(3.75, 3.75, 16.5, 16.5, 3), 'M14.25 8.25H9.75V12H14.25V15.75H9.75'], { solid: [sq(3.75, 3.75, 16.5, 16.5, 3)], cut: ['M14.25 8.25H9.75V12H14.25V15.75H9.75'] });
// Tripadvisor: the two eyes touching, their pupils and the beak as crisp 2 × 2 pixel squares (a
// slanted beak smudged into the eyes)
const TA16 = [circ(7.5, 10.5, 3.75), circ(16.5, 10.5, 3.75), sq(6.75, 9.75, 1.5, 1.5, 0), sq(15.75, 9.75, 1.5, 1.5, 0), sq(11.25, 15.75, 1.5, 1.5, 0)];
small('brand-tripadvisor', TA16, false);
// Strava: the Λ and the V on 1:2 slopes through pixel centers, so each leg is a clean staircase and
// the parallel pair stays a pixel apart (snapped, they smudged into one)
small('brand-strava', [line([5.25, 12.75], [9.75, 3.75], [14.25, 12.75]), line([11.25, 12.75], [15.75, 21.75], [20.25, 12.75])], false);
// Yelp: the five petals as solid two-pixel strokes from round the center, the top one the longest
const YELP16 = [[-90, 8.25], [-18, 7], [54, 7], [126, 7], [198, 7]].map(([t, r]) => capsule(polar(12, 12.75, 2.75, t), polar(12, 12.75, r - 0.75, t), 0.75));
small('brand-yelp', YELP16, { solid: YELP16 });
// Signal: the bubble on pixel extremes and eight dashes on the 16 px ring, the four on the axes crisp
const SIGNAL16 = [tailBubble([12, 12], 3.75, 150, 120, polar(12, 12, 5, 135)), ...range(0, 8).map((k) => arc(12, 12, 8.25, 45 * k - 11, 45 * k + 11).d)];
small('brand-signal', SIGNAL16, { solid: [SIGNAL16[0]], lines: SIGNAL16.slice(1) });
// Edge: the disc and its wave on the 16 px ring, the hollow's head on pixel centers
const EDGE16 = [edgeWave(8.25, 6, 33, [[17.25, 13.5], [15, 13.5], [14.25, 12.75, 1], [14.25, 10.5], [12.75, 9.75], [11.25, 9.75], [9.75, 11.25], [9.75, 13.5], [11.25, 15.75], [14.25, 16.5]]), smooth([[12, 9.75], [9.75, 8.25], [6.75, 8.25], polar(12, 12, 8.25, 205)])];
small('brand-edge', EDGE16, { solid: [EDGE16[0]], cut: [EDGE16[1]] });
// DigitalOcean: the band between the 16 px rings (r 8.25 and 5.25), its left end and both pixels on pixel rows
const DO16 = [doRing(8.25, 5.25, 12.75, 11.25, 14.25, 3), sq(5.25, 17.25, 3, 3, 0)];
small('brand-digitalocean', DO16, { solid: DO16 });
// Waze: the round bubble, its face and two solid wheels
const WAZE16 = [circ(12.75, 11.25, 6), dot(11.25, 9.75, 0.1), dot(14.25, 9.75, 0.1), 'M10.5 12.75C11.5 14.25 14 14.25 15 12.75', dot(9, 18.75, 0.75), dot(16.5, 18.75, 0.75)];
small('brand-waze', WAZE16, { solid: [WAZE16[0], WAZE16[4], WAZE16[5]], cut: WAZE16.slice(1, 4) });
// Hugging Face: the face, its one-pixel eyes and the open grin; the hands as two solid dots at its
// lower corners, where the mittens are at 24
const HF16 = [circ(12, 10.5, 6.75), dot(9.75, 8.25, 0.1), dot(14.25, 8.25, 0.1), 'M9.75 11.25H14.25A2.25 2.25 0 0 1 9.75 11.25Z'];
const HF_HANDS16 = [dot(5.75, 17.75, 1), dot(18.25, 17.75, 1)];
icons['brand-hugging-face'].small = {
  d: HF16,
  fill: { solid: [HF16[0]], cut: HF16.slice(1) },
  badge: { d: HF_HANDS16, knock: HF_HANDS16.join(''), fill: { solid: HF_HANDS16 } },
};
// Notion: the slab and its N, without the front face's edges
const NOTION16 = [roundpoly([[3.75, 3.75], [17.25, 3.75], [20.25, 6.75], [20.25, 20.25], [6.75, 20.25], [3.75, 17.25]], 1), line([9.75, 15.75], [9.75, 9.75], [15.75, 15.75], [15.75, 9.75])];
small('brand-notion', NOTION16, { solid: [NOTION16[0]], cut: [NOTION16[1]] });
// Tux: the body, one-pixel eyes, a 2 × 2 pixel beak and the feet in front (the badge, as at 24)
const TUX16 = [smooth(mirrored([[12, 3.75], [15.25, 4.5], [16.5, 7.5], [16.5, 9.75], [18, 12.75], [18.75, 15.75], [18, 18.75], [15, 19.5], [12, 19.5]]), true), dot(9.75, 6.75, 0.1), dot(14.25, 6.75, 0.1), sq(11.25, 9.75, 1.5, 1.5, 0)];
const TUX_FEET16 = [capsule([6, 19.5], [9, 19.5], 0.75), capsule([15, 19.5], [18, 19.5], 0.75)];
icons['brand-linux'].small = {
  d: TUX16,
  fill: { solid: [TUX16[0]], cut: TUX16.slice(1) },
  badge: { d: TUX_FEET16, knock: TUX_FEET16.join(''), fill: { solid: TUX_FEET16 } },
};
// CodePen: the hexagon and its rhombus, on pixel rows
const CP16 = [[12, 3.75], [20.25, 8.25], [20.25, 15.75], [12, 20.25], [3.75, 15.75], [3.75, 8.25]];
const CODEPEN16 = [roundpoly(CP16, 0.75), roundpoly([[3.75, 12], [12, 8.25], [20.25, 12], [12, 15.75]], 0), line(cornerMid(CP16, 0, 0.75), [12, 8.25]), line([12, 15.75], cornerMid(CP16, 3, 0.75))];
small('brand-codepen', CODEPEN16, { solid: [CODEPEN16[0]], cut: CODEPEN16.slice(1) });
// Instagram: the frame, the lens on pixel centers and a one-pixel flash clear of both
const IG16 = [sq(3.75, 3.75, 16.5, 16.5, 4.5), circ(12, 12, 3.75), dot(16.5, 7.5, 0.1)];
small('brand-instagram', IG16, { solid: [IG16[0]], cut: IG16.slice(1) });
// YouTube: the screen on pixel rows and the play, hollow (cut out when filled)
const YT16 = [sq(2.25, 5.25, 19.5, 13.5, 4.5), roundpoly([[9.75, 9], [15, 12], [9.75, 15]], 0.5)];
small('brand-youtube', YT16, { solid: [YT16[0]], cut: [YT16[1]] });
// Spotify: three flatter arcs on pixel rows, two pixels apart
const SPOTIFY16 = [bow([6.75, 9.75], [17.25, 9.75], -1.5), bow([7.5, 12.75], [16.5, 12.75], -1.5), bow([8.25, 15.75], [15.75, 15.75], -1.5)];
small('brand-spotify', [R16, ...SPOTIFY16], { solid: [R16], cut: SPOTIFY16 });
// Netflix: the three bands as solid strokes two pixels wide (the diagonal is the badge at 24)
const NETFLIX16 = [capsule([7.5, 4.5], [7.5, 19.5], 0.75), capsule([16.5, 4.5], [16.5, 19.5], 0.75), capsule([7.5, 4.5], [16.5, 19.5], 0.75)];
small('brand-netflix', NETFLIX16, { solid: NETFLIX16 });
// Trello: the board and its two lists as solid bars two pixels wide
const TRELLO16 = [sq(3.75, 3.75, 16.5, 16.5, 3), sq(7.5, 7.5, 1.5, 9, 0), sq(14.25, 7.5, 1.5, 4.5, 0)];
small('brand-trello', TRELLO16, { solid: [TRELLO16[0]], cut: TRELLO16.slice(1) });
// Dropbox: the five rhombuses at a 1:2 slope, so each edge steps one pixel down every two across
const DROPBOX16 = [[7.5, 6.75], [16.5, 6.75], [7.5, 11.25], [16.5, 11.25], [12, 16.5]].map(([x, y]) => roundpoly([[x - 4.5, y], [x, y - 2.25], [x + 4.5, y], [x, y + 2.25]], 0));
small('brand-dropbox', DROPBOX16, { solid: DROPBOX16 });
// OpenAI: the blossom drawn tighter (each arc a half turn of r 3.75 round a hexagon of r 3.75), so
// its six links stay apart and its center opens
small('brand-openai', range(0, 6).map((k) => arc(...polar(12, 12, 3.75, 60 * k - 90), 3.75, 60 * k - 210, 60 * k - 30).d), false);
// Adobe: the side pieces and the A on pixel rows
const ADOBE16 = [roundpoly([[3.75, 3.75], [9.75, 3.75], [3.75, 20.25]], 0.4), roundpoly([[14.25, 3.75], [20.25, 3.75], [20.25, 20.25]], 0.4), line([12, 9.75], [15.75, 20.25]), line([9.75, 17.25], [14.68, 17.25])];
small('brand-adobe', ADOBE16, { solid: ADOBE16.slice(0, 2), wire: ADOBE16.slice(2) });

// ── Named parts (DESIGN.md › Named parts): what moves, what a badge sits on, what has a meaning ──
const PARTS = {
  'brand-tiktok': { head: [0], note: [1] },
  'brand-reddit': { head: [0], eyes: [1, 2], mouth: [3], antenna: [4, 5] },
  'brand-whatsapp': { bubble: [0], phone: [1] },
  'brand-telegram': { ring: [0], plane: [1, 2] },
  'brand-snapchat': { ghost: [0] },
  'brand-bluesky': { butterfly: [0] },
  'brand-wechat': { bubble: [0], eyes: [1, 2] },
  'brand-slack': { pieces: range(0, 8) },
  'brand-netflix': { uprights: [0, 1] },
  'brand-apple-podcasts': { head: [0], body: [1], waves: [2, 3] },
  'brand-android': { head: [0], antennae: [1, 2], eyes: [3, 4] },
  'brand-ubuntu': { friends: [0, 2, 4], ring: [1, 3, 5] },
  'brand-chrome': { rim: [0], lens: [1], segments: [2, 3, 4] },
  'brand-github': { head: [0], body: [1, 2], tail: [3] },
  'brand-docker': { whale: [0], containers: [1, 2, 3, 4] },
  'brand-hugging-face': { face: [0], eyes: [1, 2], smile: [3] },
  'brand-linux': { body: [0], eyes: [1, 2], beak: [3] },
  'brand-openai': { petals: range(0, 6) },
  'brand-claude': { rays: range(0, 8) },
  'brand-dribbble': { ball: [0], seams: [1, 2, 3] },
  'brand-google-photos': { petals: [0, 1, 2, 3] },
  'brand-microsoft-teams': { person: [0, 1] },
  'brand-hubspot': { hub: [0], spokes: [1, 3, 5], ends: [2, 4, 6] },
  'brand-paypal': { rear: [0] },
  'brand-waze': { body: [0], face: [1, 2, 3] },
  'brand-yelp': { petals: range(0, 5) },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion): the brands whose symbol has a gesture of its own ──
icons['brand-tiktok'].motion = { effect: 'beat', origin: [12, 12] };
icons['brand-reddit'].motion = { effect: 'wiggle', parts: ['antenna'], origin: [12, 8.75] };
icons['brand-whatsapp'].motion = { effect: 'ring', parts: ['phone'], origin: [12.5, 11.25] };
icons['brand-telegram'].motion = { effect: 'slide', parts: ['plane'], vector: [1.5, -1] };
icons['brand-snapchat'].motion = { effect: 'float', vector: [0, -1.5] };
icons['brand-bluesky'].motion = { effect: 'float', vector: [0, -1.5] };
icons['brand-slack'].motion = { effect: 'spin', origin: [12, 12] };
icons['brand-apple-podcasts'].motion = { effect: 'beat', parts: ['waves'], origin: [12, 10.25] };
icons['brand-android'].motion = { effect: 'wiggle', origin: [12, 17.5] };
icons['brand-ubuntu'].motion = { effect: 'spin', origin: [12, 12] };
icons['brand-chrome'].motion = { effect: 'spin', origin: [12, 12] };
icons['brand-github'].motion = { effect: 'wiggle', parts: ['tail'], origin: [10, 18.5] };
icons['brand-docker'].motion = { effect: 'float', vector: [0, -1.5] };
icons['brand-openai'].motion = { effect: 'spin', origin: [12, 12] };
icons['brand-claude'].motion = { effect: 'spin', origin: [12, 12] };
icons['brand-dribbble'].motion = { effect: 'bounce', vector: [0, -2.5] };
icons['brand-google-photos'].motion = { effect: 'spin', origin: [12, 12] };
icons['brand-hubspot'].motion = { effect: 'spin', origin: HS.c };
icons['brand-waze'].motion = { effect: 'slide', vector: [2, 0] };
icons['brand-yelp'].motion = { effect: 'beat', origin: [12, 12.25] };

// ── Automatic variants that make no sense ──
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already a circle (a ring, a round bubble, a face): no circle around it
variants(['brand-facebook', 'brand-pinterest', 'brand-wordpress', 'brand-whatsapp', 'brand-telegram', 'brand-messenger', 'brand-signal', 'brand-spotify', 'brand-steam', 'brand-xbox', 'brand-ubuntu', 'brand-chrome', 'brand-edge', 'brand-hugging-face', 'brand-dribbble', 'brand-linear'], { circle: false });
// Already a square (a rounded tile, a box): no square around it
variants(['brand-instagram', 'brand-linkedin', 'brand-mastodon', 'brand-app-store', 'brand-notion', 'brand-trello', 'brand-intercom', 'brand-todoist', 'brand-stripe'], { square: false });
// Too many pieces to read at 58 %: the pinwheel clogs, and so do DigitalOcean's band and Edge's
// swirl (round already, so no circle either)
variants(['brand-slack', 'brand-digitalocean', 'brand-edge'], { circle: false, square: false });

// A brand is never slashed; Flouvia's marks and Cord's, whole logos, take no enclosure either
for (const icon of Object.values(icons)) icon.variants = { ...icon.variants, slash: false };
for (const name of ['brand-flouvia', 'brand-flouvia-u', 'brand-cord']) icons[name].variants = { ...icons[name].variants, circle: false, square: false };

export default { category: 'marcas', label: 'Marcas', icons };
