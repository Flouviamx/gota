// Símbolos y caracteres (symbols and characters): letters, digits, math, logic and punctuation
// signs, brackets and the currency signs that were missing. Every character is drawn as Gota
// geometry on one shared grid (lines, circular and elliptical arcs, the set's 1.5 stroke and round
// caps); none is set in, traced from or modeled on a font. See DESIGN.md.
import { arc, circ, dot, f, flipPath, halfChord, line, polar, sq, turnPath } from '../../engine/geometry.mjs';
import { snap } from '../../engine/variants.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────
const P = (x, y) => `${f(x)} ${f(y)}`;
const xy = ([x, y]) => P(x, y);
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
const rad = (deg) => (deg * Math.PI) / 180;
/** Point on an ellipse at parametric angle `t` (degrees, 0 = right, 90 = down). */
const ept = (cx, cy, rx, ry, t) => [cx + rx * Math.cos(rad(t)), cy + ry * Math.sin(rad(t))];
/** Elliptical arc from t0 to t1 (clockwise if t1 > t0): just the `A…` segment, to chain it. */
const earcTo = (cx, cy, rx, ry, t0, t1) => {
  const large = Math.abs(t1 - t0) > 180 ? 1 : 0;
  const sweep = t1 > t0 ? 1 : 0;
  return `A${f(rx)} ${f(ry)} 0 ${large} ${sweep} ${xy(ept(cx, cy, rx, ry, t1))}`;
};
/** Elliptical arc from t0 to t1 as a stroke of its own. */
const earc = (cx, cy, rx, ry, t0, t1) => `M${xy(ept(cx, cy, rx, ry, t0))}${earcTo(cx, cy, rx, ry, t0, t1)}`;
/** Full ellipse, written like circ(): two halves. */
const ellipse = (cx, cy, rx, ry) => `M${P(cx - rx, cy)}A${f(rx)} ${f(ry)} 0 1 0 ${P(cx + rx, cy)}A${f(rx)} ${f(ry)} 0 1 0 ${P(cx - rx, cy)}Z`;
/** Half circle between two points (exactly half the chord as radius), clockwise or not. */
const half = (a, b, cw = true) => {
  const R = halfChord(a, b);
  return `A${R} ${R} 0 0 ${cw ? 1 : 0} ${xy(b)}`;
};
/**
 * Polyline with circular rounded corners (one radius per vertex, 0 = a plain round join), open or
 * closed: the brackets' corners.
 */
function rl(pts, r = 0, { closed = false } = {}) {
  const n = pts.length;
  const R = (i) => (Array.isArray(r) ? r[i] : r);
  const unit = (v) => {
    const k = Math.hypot(v[0], v[1]);
    return [v[0] / k, v[1] / k];
  };
  const turnAt = (i) => {
    const V = pts[i];
    const A = pts[(i - 1 + n) % n];
    const B = pts[(i + 1) % n];
    const rr = R(i);
    if (!rr) return [V, '', V];
    const u = unit([A[0] - V[0], A[1] - V[1]]);
    const v = unit([B[0] - V[0], B[1] - V[1]]);
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const t = rr / Math.tan(th / 2);
    const S = [V[0] + u[0] * t, V[1] + u[1] * t];
    const E = [V[0] + v[0] * t, V[1] + v[1] * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    return [S, `A${f(rr)} ${f(rr)} 0 0 ${cz > 0 ? 1 : 0} ${xy(E)}`, E];
  };
  if (!closed) {
    let out = `M${xy(pts[0])}`;
    for (let i = 1; i < n - 1; i++) {
      const [S, a] = turnAt(i);
      out += `L${xy(S)}${a}`;
    }
    return `${out}L${xy(pts[n - 1])}`;
  }
  const first = turnAt(0);
  let out = `M${xy(first[2])}`;
  for (let i = 1; i <= n; i++) {
    const [S, a] = turnAt(i % n);
    out += `L${xy(S)}${a}`;
  }
  return `${out}Z`;
}

// ── The letter grid ───────────────────────────────────────────────────────────────────────
// One cap height for every letter and digit: the cap line at 4.25 and the baseline at 19.75 (15.5
// of path, the height of the core `plus`), the middle at 12. Widths come in a few steps: the
// narrow letters (E, F, L, P, B) 9–9.5, the regular ones (H, N, U, X) 11, the round ones (O, C,
// G, Q) an ellipse of 13 × 15.5, the wide ones (M 13, W 16.5); the digits are narrower (9: 7.5–16.5),
// so the zero is a narrow oval beside the round O. Each glyph is centered by its box.
const T = 4.25;
const B = 19.75;
const M = 12;
// The round letters: an ellipse a little taller than wide
const ORX = 6.5;
const ORY = 7.75;

/** The tilde: two arcs of equal radius, point-symmetric, from x0 to x1 around y (`s` = height of each hump). */
function wave(x0, x1, y, s) {
  const c = (x1 - x0) / 2;
  const R = (c * c) / 4 / (2 * s) + s / 2;
  const xm = (x0 + x1) / 2;
  return `M${P(x0, y)}A${f(R)} ${f(R)} 0 0 1 ${P(xm, y)}A${f(R)} ${f(R)} 0 0 0 ${P(x1, y)}`;
}

/** Letters, as functions of their position so a currency sign can reuse them. */
const glyph = {
  A: () => {
    const bar = 14.5;
    const k = (6.25 * (bar - T)) / (B - T);
    return [line([5.75, B], [12, T], [18.25, B]), hl(12 - k, 12 + k, bar)];
  },
  B: () => [`M7.25 11.75V${T}H12.25${half([12.25, T], [12.25, 11.75])}H7.25`, `M7.25 11.75H12.75${half([12.75, 11.75], [12.75, B])}H7.25V11.75`],
  C: (cx = 12.75) => [`M${xy(ept(cx, M, ORX, ORY, -45))}${earcTo(cx, M, ORX, ORY, -45, -315)}`],
  D: () => [`M6.75 ${T}H11A6.25 7.75 0 0 1 11 ${B}H6.75Z`],
  E: () => [`M16.75 ${T}H7.25V${B}H16.75`, hl(7.25, 15.25, M)],
  F: () => [`M16.75 ${T}H7.5V${B}`, hl(7.5, 15.25, M)],
  G: (cx = 12) => [`M${xy(ept(cx, M, ORX, ORY, -45))}${earcTo(cx, M, ORX, ORY, -45, -360)}H${f(cx + 1.5)}`],
  H: () => [vl(6.5, T, B), vl(17.5, T, B), hl(6.5, 17.5, M)],
  I: () => [hl(9.25, 14.75, T), vl(12, T, B), hl(9.25, 14.75, B)],
  J: () => [`M16.75 ${T}V15${arc(12, 15, 4.75, 0, 160).d.replace(/^M[^A]*/, '')}`],
  K: () => {
    // The arm runs from the cap line to the stem; the leg branches from the arm to the baseline
    const s = [7.25, 13.25];
    const a = [17, T];
    const k = 0.62;
    const j = [s[0] + (a[0] - s[0]) * k, s[1] + (a[1] - s[1]) * k];
    return [vl(7.25, T, B), line(a, s), line(j, [17.25, B])];
  },
  L: () => [`M7.5 ${T}V${B}H16.5`],
  M: () => [`M5.5 ${B}V${T}L12 13L18.5 ${T}V${B}`],
  N: (top = T) => [`M6.5 ${B}V${f(top)}L17.5 ${B}V${f(top)}`],
  O: () => [ellipse(12, M, ORX, ORY)],
  P: () => [`M7.25 ${B}V${T}H12.5${half([12.5, T], [12.5, 12.75])}H7.25`],
  Q: () => [ellipse(12, M, ORX, ORY), line([14, 15], [18.75, 19.75])],
  R: () => [`M7.25 ${B}V${T}H12.25${half([12.25, T], [12.25, 12.75])}H7.25`, line([12, 12.75], [17, B])],
  S: (cx = 11.75) => [`M${xy(ept(cx, 8, 4.25, 3.75, -30))}${earcTo(cx, 8, 4.25, 3.75, -30, -270)}${earcTo(cx, 15.75, 4.75, 4, -90, 150)}`],
  T: () => [hl(6.25, 17.75, T), vl(12, T, B)],
  U: () => [`M6.5 ${T}V14.25${half([6.5, 14.25], [17.5, 14.25], false)}V${T}`],
  V: () => [line([5.75, T], [12, B], [18.25, T])],
  W: () => [line([3.75, T], [7.88, B], [12, T], [16.13, B], [20.25, T])],
  X: () => [line([6.5, T], [17.5, B]), line([17.5, T], [6.5, B])],
  Y: () => [line([6, T], [12, M], [18, T]), vl(12, M, B)],
  Z: () => [`M6.75 ${T}H17.25L6.75 ${B}H17.25`],
};

/** Tangent point from the outside point `e` to the circle (c, r), on the side `side` (+1 / -1). */
function tangentPoint(c, r, e, side = 1) {
  const d = Math.hypot(e[0] - c[0], e[1] - c[1]);
  const a = Math.atan2(e[1] - c[1], e[0] - c[0]) * (180 / Math.PI);
  const b = Math.acos(r / d) * (180 / Math.PI);
  return a - side * b;
}

// ── Digits: the same cap height, 9 wide (7.5–16.5) ──
// The 6 is a bowl (r 4.5) and a stroke of a circle of r 11 that leaves it tangent at its left
// side; the 9 is the 6 turned, so they share every measurement. The 3 and the 8 stack a smaller
// shape over a larger one, meeting at 11.75.
const SIX = (() => {
  const top = 4.75;
  const phi = 180 + (Math.asin((15.25 - top) / 11) * 180) / Math.PI;
  const end = polar(18.5, 15.25, 11, phi);
  return `M${xy(end)}A11 11 0 0 0 7.5 15.25${half([7.5, 15.25], [16.5, 15.25], false)}${half([16.5, 15.25], [7.5, 15.25], false)}`;
})();
const digit = {
  0: () => [ellipse(12, M, 4.5, ORY)],
  1: () => [line([9.75, 7.75], [13.75, T], [13.75, B])],
  2: () => {
    // The top arc and the diagonal that leaves it tangent, down to the corner of the base
    const c = [12, 8.5];
    const corner = [7.5, B];
    const t = tangentPoint(c, 4.25, corner, 1);
    const a = arc(...c, 4.25, 200, t + 360);
    return [`${a.d}L${xy(corner)}H16.5`];
  },
  3: () => [`M${xy(ept(12, 8, 3.75, 3.75, 200))}${earcTo(12, 8, 3.75, 3.75, 200, 450)}${earcTo(12, 15.75, 4.25, 4, -90, 160)}`],
  4: () => [`M13.5 ${T}L7.25 15.25H17`, vl(14.25, 9.5, B)],
  5: () => {
    const c = [11.75, 15];
    const r = 4.75;
    const y = c[1] - Math.sqrt(r * r - (8 - c[0]) ** 2);
    const a0 = (Math.atan2(y - c[1], 8 - c[0]) * 180) / Math.PI;
    return [`M16.25 ${T}H8V${f(y)}${arc(...c, r, a0, 150).d.replace(/^M[^A]*/, '')}`];
  },
  6: () => [SIX],
  7: () => [`M7.5 ${T}H16.5L10.5 ${B}`],
  8: () => [ellipse(12, 8, 4, 3.75), ellipse(12, 15.75, 4.5, 4)],
  9: () => [turnPath(SIX, 180)],
};
const DIGIT_NAMES = [
  ['cero', 'zero'],
  ['uno', 'one'],
  ['dos', 'two'],
  ['tres', 'three'],
  ['cuatro', 'four'],
  ['cinco', 'five'],
  ['seis', 'six'],
  ['siete', 'seven'],
  ['ocho', 'eight'],
  ['nueve', 'nine'],
];

// ── Math: the operators' size (the core `plus` and `minus` are 15.5 long; `equals` runs 5.5–18.5
// with its bars 5 apart) ──
const EQ = [hl(5.5, 18.5, 9.5), hl(5.5, 18.5, 14.5)];
/** Less-than: two strokes at 30° from the horizontal meeting at a sharp vertex on the left. */
const lessThan = (x0, x1, y) => {
  const h = (x1 - x0) * Math.tan(rad(30));
  return line([x1, y - h], [x0, y], [x1, y + h]);
};
const LT = lessThan(5.75, 18.25, M);
// ≤: the sign 11 wide, raised, and a bar of its width 3.15 under its lower arm
const LTE = [lessThan(6.5, 17.5, 10.25), hl(6.5, 17.5, B)];

// The dots of punctuation and logic signs: the largest dot the engine draws solid (r 1, a disc of
// 3.5 at regular), so a sign made only of dots holds its own beside the letters
const DR = 1;
const pdot = (x, y) => dot(x, y, DR);

// ∫: two hooks of r 2 joined by the tangent that crosses between them, point-symmetric around the
// center (the stem leans 9°)
const INTEGRAL = (() => {
  const c1 = [15, 6];
  const r = 2;
  const v = [c1[0] - 12, c1[1] - 12];
  const L = Math.hypot(...v);
  const dir = Math.atan2(v[1], v[0]) - Math.asin(r / L);
  const k = Math.sqrt(L * L - r * r);
  const t1 = [12 + k * Math.cos(dir), 12 + k * Math.sin(dir)];
  const a1 = (Math.atan2(t1[1] - c1[1], t1[0] - c1[0]) * 180) / Math.PI;
  const top = arc(...c1, r, 15, a1);
  const bottom = arc(24 - c1[0], 24 - c1[1], r, a1 + 180, 195);
  return `${top.d}L${xy([24 - t1[0], 24 - t1[1]])}${bottom.d.replace(/^M[^A]*/, '')}`;
})();

// The degree ring beside a letter: r 2.25 with its top on the cap line, 3 clear of the letter
const DEG_RING = circ(5.5, 6.5, 2.25);

// ⊂: a half circle of r 6 with straight arms, open to the right
const subset = (cy, r, x0 = 5.5, x1 = 18.5) => `M${P(x1, cy - r)}H${f(x0 + r)}${half([x0 + r, cy - r], [x0 + r, cy + r], false)}H${f(x1)}`;
const SUBSET = subset(M, 6);
// ⊆: the sign 10 tall, raised, and a bar of its width 3 under it
const SUBSET_EQ = [subset(10.5, 5), hl(5.5, 18.5, 18.5)];

/** ⇒ and ⇔: the equals shafts and wide arrowheads (arms at 45°, 6.5 to each side). */
const ARROW_H = 6.5;
const doubleArrow = (both) => {
  const [l, r] = [both ? 3 : 3.5, 20.5];
  const left = both ? l + 2.5 : l;
  return [
    hl(left, r - 2.5, 9.5),
    hl(left, r - 2.5, 14.5),
    line([r - ARROW_H, M - ARROW_H], [r, M], [r - ARROW_H, M + ARROW_H]),
    ...(both ? [line([l + ARROW_H, M - ARROW_H], [l, M], [l + ARROW_H, M + ARROW_H])] : []),
  ];
};

// ── Punctuation ──
/**
 * A quotation mark: the ball and its tail as one closed shape (hollow in outline, solid filled), the
 * mark of edicion's `quote` (a ball of r 2.6 and a tail 7 tall).
 */
function mark(x, y) {
  const r = 2.6;
  const L = [x - r, y];
  const tip = [x + 2, y - 7];
  const R = ((tip[0] - L[0]) ** 2 + (tip[1] - L[1]) ** 2) / (2 * (tip[0] - L[0]));
  return `M${xy(L)}A${f(R)} ${f(R)} 0 0 1 ${xy(tip)}Q${P(x + 0.6, y - 3.6)} ${xy(polar(x, y, r, -55))}A${f(r)} ${f(r)} 0 1 1 ${xy(L)}Z`;
}
// “ ”: edicion's quote marks; the closing ones are those turned
const QUOTE = [mark(7.5, 14.5), mark(16.5, 14.5)];
// The comma: the point and a tail that leaves its center and turns down and left (an arc of r 3.25
// over 75°). A lone hollow mark read as a drop or a 9, so the single marks are made like the colon:
// the comma, the semicolon's comma and the single quote (turned) are this same mark
const COMMA_R = 3.25;
const COMMA_TAIL = (x, y) => `M${P(x, y)}${arc(x - COMMA_R, y, COMMA_R, 0, 75).d.replace(/^M[^A]*/, '')}`;
const comma = (x, y) => [pdot(x, y), COMMA_TAIL(x, y)];

// ?: the hook of sistema's `help` drawn on the letter grid (r 4 under the cap line), a stem down to
// 14.5 and the point on the baseline; ! has the same stem and point
const QUESTION_HOOK = (() => {
  const [cx, cy, r] = [12, 8.25, 4];
  const a = arc(cx, cy, r, 165, 405);
  const k = r * 0.38;
  const end = a.end;
  return `${a.d}C${P(end[0] + a.tangent[0] * k, end[1] + a.tangent[1] * k)} 12 12.75 12 14.5`;
})();
const POINT_Y = 18.75;

// « »: two double chevrons, steep (2 deep, 6 tall) and 3.5 apart (2.9 between their arms), 6
// between the pairs
const chevrons = (v, dir) => [0, 3.5].map((o) => line([v + dir * (o + 2), 9], [v + dir * o, M], [v + dir * (o + 2), 15]));

// ( ): two arcs 18.5 tall that bulge 3.5
const PAREN = (() => {
  const s = 3.5;
  const c = 9.25;
  const R = (c * c + s * s) / (2 * s);
  return `M9 2.75A${f(R)} ${f(R)} 0 0 0 9 21.25`;
})();

/** {: a brace from the cusp `p` with point arcs of r `rp`, its stem and corners of r `rc`, top to bottom. */
function brace(p, rp, rc, top, bottom, tick = 0.25) {
  const s = p + rp;
  const e = s + rc + tick;
  return `M${P(e, top)}H${f(s + rc)}A${f(rc)} ${f(rc)} 0 0 0 ${P(s, top + rc)}V${f(M - rp)}A${f(rp)} ${f(rp)} 0 0 1 ${P(p, M)}A${f(rp)} ${f(rp)} 0 0 1 ${P(s, M + rp)}V${f(bottom - rc)}A${f(rc)} ${f(rc)} 0 0 0 ${P(s + rc, bottom)}H${f(e)}`;
}
// {{: the inner brace 4.25 to the right (3 across its 45° stretches) and 3 shorter at each end
const BRACES = [brace(2.75, 2, 1.25, 3.25, 20.75), brace(7, 2, 1.25, 6.25, 17.75)];
// [[: corners of r 2 outside, 1.5 inside, the inner bracket 3 in and 3 shorter
const BRACKETS = [rl([[8, 3.25], [3.5, 3.25], [3.5, 20.75], [8, 20.75]], [0, 2, 2, 0]), rl([[9.5, 6.25], [6.5, 6.25], [6.5, 17.75], [9.5, 17.75]], [0, 1.5, 1.5, 0])];
// ⌊: the stem and a short foot turning in (4 between the feet)
const FLOOR = rl([[6.5, 3.25], [6.5, 20.75], [10, 20.75]], [0, 1.75, 0]);

// §: three stacked ellipses (7.5 × 5.5); the upper S is the top hook and the right half of the
// middle one, the lower S the left half of the middle one and the bottom hook
const SECTION = (() => {
  const [rx, ry] = [3.75, 2.75];
  const [y1, y2, y3] = [6.5, 12, 17.5];
  const upper = `M${xy(ept(12, y1, rx, ry, -30))}${earcTo(12, y1, rx, ry, -30, -270)}${earcTo(12, y2, rx, ry, -90, 90)}`;
  const lower = `M${P(12, y2 - ry)}${earcTo(12, y2, rx, ry, -90, -270)}${earcTo(12, y3, rx, ry, -90, 150)}`;
  return [upper, lower];
})();

/** Internal tangent between two circles (they sit on opposite sides of it), `s` = ±1 picks one. */
function crossTangent(c1, r1, c2, r2, s) {
  const D = [c2[0] - c1[0], c2[1] - c1[1]];
  const d = Math.hypot(...D);
  const a = Math.atan2(D[1], D[0]) + s * Math.acos(-(r1 + r2) / d);
  const n = [Math.cos(a), Math.sin(a)];
  return [
    [c1[0] - r1 * n[0], c1[1] - r1 * n[1]],
    [c2[0] + r2 * n[0], c2[1] + r2 * n[1]],
  ];
}
const angleOf = (c, p) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
// &: one stroke. The bowl starts on the leg, where the leg crosses its right side, runs down and
// around to its upper left, rises along the tangent to the right side of the top loop, goes around
// the loop over the top and leaves its lower left as the leg, which crosses the rising stroke, meets
// the bowl and kicks out at the bottom right
const AMPERSAND = (() => {
  const cb = [10.5, 15.25];
  const rb = 4.5;
  const ct = [11, 7.25];
  const rt = 3;
  const E = [18.75, B];
  const [t1, t2] = crossTangent(cb, rb, ct, rt, -1);
  const a1 = angleOf(cb, t1);
  const a2 = angleOf(ct, t2);
  const tLeg = tangentPoint(ct, rt, E, -1);
  const legPt = polar(...ct, rt, tLeg);
  // Where the leg leaves the bowl: the farther of the line's two crossings with the bowl's circle
  const u = [E[0] - legPt[0], E[1] - legPt[1]].map((v, _, a) => v / Math.hypot(...a));
  const w = [cb[0] - legPt[0], cb[1] - legPt[1]];
  const along = w[0] * u[0] + w[1] * u[1];
  const off = w[0] * u[1] - w[1] * u[0];
  const out = along + Math.sqrt(rb * rb - off * off);
  const aOut = angleOf(cb, [legPt[0] + u[0] * out, legPt[1] + u[1] * out]);
  const bowl = arc(...cb, rb, aOut, a1 < aOut ? a1 + 360 : a1);
  const loop = arc(...ct, rt, a2, tLeg > a2 ? tLeg - 360 : tLeg);
  return `${bowl.d}L${xy(t2)}${loop.d.replace(/^M[^A]*/, '')}L${xy(E)}`;
})();

// ── Currency signs: the coin ring of comercio's `currency-*` (r 9) and a sign about 10 tall that
// stays within r 6 of the center, 3 clear of the ring; bars come in pairs 3 apart, as in `currency-yen`
const COIN = circ(12, 12, 9);
/** A slanted bar through (cx, cy), `w` wide, rising `rise` from left to right. */
const slant = (cx, cy, w, rise) => line([cx - w / 2, cy + rise / 2], [cx + w / 2, cy - rise / 2]);
const CURRENCY = {
  // ¢: a small c (r 3.75, open 90° on the right, like the euro's) and a stroke through its top and bottom
  cent: [arc(12.5, M, 3.75, 45, 315).d, vl(12.5, 6.25, 17.75)],
  // ₩: the W of two V's sharing the middle stroke, and its two bars 1.75 inside its points, where the
  // V's are still too narrow to leave a hole (the cells between the bars stay open at every weight)
  won: [line([7.75, 8], [9.88, 16], [12, 8], [14.13, 16], [16.25, 8]), hl(6.75, 17.25, 9.75), hl(6.75, 17.25, 14.25)],
  // ₽: the P (bowl r 2.75) and a bar 3 under the bowl
  ruble: [`M10.5 17.5V6.75H13${half([13, 6.75], [13, 12.25])}H10.5`, hl(8.25, 13.75, 15.25)],
  // ₺: a stem that curves out to the right at its foot, crossed by two bars rising at 22°
  lira: [`M10 6.75V14${arc(13.25, 14, 3.25, 180, -15).d.replace(/^M[^A]*/, '')}`, slant(10.25, 9.5, 5, 2), slant(10.25, 12.75, 5, 2)],
  // ₪: two hooks, one open downward and one open upward, their four legs 3 apart
  shekel: [`M7.25 15.75V10.25${half([7.25, 10.25], [13.25, 10.25])}V13.25`, `M16.25 8.25V13.75${half([16.25, 13.75], [10.25, 13.75])}V10.75`],
  // ₦: the N and two bars 1.75 inside its ends, where the diagonal still hugs the stems (the corner
  // between them stays ink at every weight)
  naira: [`M8.75 16.75V7.25L15.25 16.75V7.25`, hl(6.75, 17.25, 9), hl(6.75, 17.25, 15)],
  // ₱: the P (bowl r 3) with its top extended past the stem and a bar through the middle of the bowl
  'philippine-peso': [`M10.25 17.25V7.5`, `M8.25 7.5H12.75${half([12.75, 7.5], [12.75, 13.5])}H10.25`, `M8.25 10.5H15.75`],
  // ฿: a B (two bowls of r 2.25) and the stroke that runs through it
  baht: [`M9 12V7.5H12.5${half([12.5, 7.5], [12.5, 12])}H9`, `M9 12H13${half([13, 12], [13, 16.5])}H9V12`, vl(12, 6.25, 17.75)],
  // ₫: a small d (bowl r 2), a bar across its ascender and a bar under it
  dong: [circ(11.25, 12.75, 2), vl(13.25, 6.5, 14.75), hl(11.75, 14.75, 7.75), hl(10, 14, 17.75)],
  // ₴: an S turned over (two arcs of r 2.5 joined by a diagonal) and its two bars
  hryvnia: (() => {
    const [c1, c2, r] = [[12, 9.25], [12, 14.75], 2.5];
    // The diagonal leaves the right side of the upper arc for the left side of the lower one
    const [t1, t2] = [1, -1].map((k) => crossTangent(c1, r, c2, r, k)).find(([p]) => p[0] > 12);
    const a1 = angleOf(c1, t1);
    const a2 = (angleOf(c2, t2) + 360) % 360;
    const top = arc(...c1, r, 200, a1 < 200 ? a1 + 360 : a1);
    return [`${top.d}L${xy(t2)}${arc(...c2, r, a2, 20).d.replace(/^M[^A]*/, '')}`, hl(8, 16, 10.5), hl(8, 16, 13.5)];
  })(),
  // ₸: a T under a second bar, 3 apart
  tenge: [hl(8.5, 15.5, 7.25), hl(8.5, 15.5, 10.25), vl(12, 10.25, 17.25)],
  // ₲: the G (an ellipse of 8.5 × 10) and the stroke through it, which its bar reaches
  guarani: [`M${xy(ept(12, M, 4.25, 5, -45))}${earcTo(12, M, 4.25, 5, -45, -360)}H12`, vl(12, 6, 18)],
  // ₡: the C and two strokes 3 apart that cross it, leaning 13°
  colon: [`M${xy(ept(12.75, M, 4.25, 5, -45))}${earcTo(12.75, M, 4.25, 5, -45, -315)}`, line([9.88, 17], [12.13, 7]), line([12.88, 17], [15.13, 7])],
  // ₭: the K, its arms meeting the stem at the middle, and the bar through them
  kip: [vl(9.25, 7, 17), line([15.25, 7], [9.25, M], [15.25, 17]), hl(7, 17, M)],
  // ₮: the T, its stem crossed by two bars rising at 22°
  tugrik: [hl(8.5, 15.5, 7.5), vl(12, 7.5, 17.25), slant(12, 11.75, 5, 2), slant(12, 15, 5, 2)],
  // ₼: an arch (r 4.25) and the stroke through its middle
  manat: [`M7.75 16.25V12${half([7.75, 12], [16.25, 12])}V16.25`, vl(12, 6.5, 16.75)],
  // ₣: the F and a short bar 3 under its middle bar
  franc: [`M15.75 7.25H10.5V17.25`, hl(10.5, 14.75, 10.5), hl(8.25, 13.25, 13.5)],
  // The UAE dirham (2025): a D whose stem two bars cross, running from left of it to its bowl
  dirham: (() => {
    const [cx, rx, ry] = [11.75, 4.5, 4.75];
    const at = (y) => cx + rx * Math.sqrt(1 - ((y - M) / ry) ** 2);
    return [`M10 7.25H${f(cx)}A${f(rx)} ${f(ry)} 0 0 1 ${P(cx, 16.75)}H10Z`, hl(7.5, at(10.5), 10.5), hl(7.5, at(13.5), 13.5)];
  })(),
  // ¤: a small ring with four ticks on its diagonals
  generic: [circ(12, M, 3), ...[45, 135, 225, 315].map((a) => line(polar(12, M, 3, a), polar(12, M, 5.5, a)))],
};
const CURRENCY_TAGS = {
  cent: ['centavo', 'céntimo', 'centavos', 'precio', 'cent', 'cents', 'price'],
  won: ['won', 'won surcoreano', 'moneda', 'krw', 'corea', 'korean won', 'currency'],
  ruble: ['rublo', 'rublo ruso', 'moneda', 'rub', 'rusia', 'ruble', 'currency'],
  lira: ['lira', 'lira turca', 'moneda', 'try', 'turquía', 'turkish lira', 'currency'],
  shekel: ['séquel', 'nuevo séquel', 'moneda', 'ils', 'israel', 'shekel', 'currency'],
  naira: ['naira', 'naira nigeriana', 'moneda', 'ngn', 'nigeria', 'currency'],
  'philippine-peso': ['peso filipino', 'moneda', 'php', 'filipinas', 'philippine peso', 'currency'],
  baht: ['baht', 'baht tailandés', 'moneda', 'thb', 'tailandia', 'thai baht', 'currency'],
  dong: ['dong', 'dong vietnamita', 'moneda', 'vnd', 'vietnam', 'vietnamese dong', 'currency'],
  hryvnia: ['grivna', 'grivna ucraniana', 'moneda', 'uah', 'ucrania', 'hryvnia', 'currency'],
  tenge: ['tenge', 'tenge kazajo', 'moneda', 'kzt', 'kazajistán', 'kazakhstani tenge', 'currency'],
  guarani: ['guaraní', 'guaraní paraguayo', 'moneda', 'pyg', 'paraguay', 'guarani', 'currency'],
  colon: ['colón', 'colón costarricense', 'moneda', 'crc', 'costa rica', 'colon', 'currency'],
  kip: ['kip', 'kip laosiano', 'moneda', 'lak', 'laos', 'lao kip', 'currency'],
  tugrik: ['tugrik', 'tögrög', 'moneda', 'mnt', 'mongolia', 'togrog', 'currency'],
  manat: ['manat', 'manat azerí', 'moneda', 'azn', 'azerbaiyán', 'azerbaijani manat', 'currency'],
  franc: ['franco', 'franco suizo', 'franco cfa', 'moneda', 'chf', 'franc', 'currency'],
  dirham: ['dírham', 'dírham emiratí', 'moneda', 'aed', 'emiratos', 'uae dirham', 'currency'],
  generic: ['moneda', 'divisa', 'signo monetario', 'configuración de moneda', 'currency', 'generic currency', 'money'],
};

const LETTER_TAGS = {
  A: ['respuesta a', 'opción a'],
  B: ['respuesta b', 'opción b'],
  C: ['respuesta c', 'opción c'],
  D: ['respuesta d', 'opción d'],
};
const letter = (L, extra = []) => ({
  tags: [`letra ${L.toLowerCase()}`, `${L.toLowerCase()} mayúscula`, 'inicial', 'abecedario', `letter ${L.toLowerCase()}`, `capital ${L.toLowerCase()}`, 'initial', 'alphabet', ...(LETTER_TAGS[L] ?? []), ...extra],
  d: glyph[L](),
});

const icons = {
  // ── Letters ──
  ...Object.fromEntries(Object.keys(glyph).map((L) => [`letter-${L.toLowerCase()}`, letter(L)])),
  // Ñ: the N, 4 shorter, and the tilde 3 above it (center to center)
  'letter-n-tilde': {
    tags: ['eñe', 'ñ', 'letra ñ', 'español', 'teclado español', 'enye', 'spanish n', 'n tilde', 'spanish keyboard'],
    d: [...glyph.N(8.25), wave(8, 16, 4.25, 1)],
  },

  // ── Digits ──
  ...Object.fromEntries(
    DIGIT_NAMES.map(([es, en], n) => [
      `number-${n}`,
      { tags: [`número ${n}`, es, 'dígito', 'cifra', `number ${n}`, en, 'digit', 'numeral'], d: digit[n]() },
    ]),
  ),

  // ── Math ──
  // ×: 9.5 across, the optical size of the plus (smaller than `close`, 11)
  'multiply': {
    tags: ['multiplicar', 'por', 'multiplicación', 'dimensiones', 'multiply', 'times', 'multiplication'],
    d: [line([7.25, 7.25], [16.75, 16.75]), line([16.75, 7.25], [7.25, 16.75])],
  },
  // ≠: the equals bars and a stroke at 70° that crosses both and runs 3.25 past them
  'not-equal': {
    tags: ['distinto', 'diferente', 'no es igual', 'desigualdad', 'not equal', 'is not', 'inequality'],
    d: [...EQ, line([12 + 5.75 / Math.tan(rad(70)), 6.25], [12 - 5.75 / Math.tan(rad(70)), 17.75])],
  },
  'less-than': {
    tags: ['menor que', 'comparar', 'filtro', 'condición', 'less than', 'compare', 'filter'],
    d: [LT],
  },
  'greater-than': {
    tags: ['mayor que', 'comparar', 'filtro', 'condición', 'greater than', 'compare', 'filter'],
    d: [flipPath(LT)],
  },
  'less-than-or-equal': {
    tags: ['menor o igual', 'como máximo', 'límite', 'filtro', 'less than or equal', 'at most', 'maximum'],
    d: LTE,
  },
  'greater-than-or-equal': {
    tags: ['mayor o igual', 'al menos', 'mínimo', 'filtro', 'greater than or equal', 'at least', 'minimum'],
    d: LTE.map((d) => flipPath(d)),
  },
  // ≈: two tildes where the equals bars run
  'approximately': {
    tags: ['aproximadamente', 'casi igual', 'estimado', 'redondeo', 'approximately', 'about', 'estimate'],
    d: [wave(5.5, 18.5, 9.5, 1.25), wave(5.5, 18.5, 14.5, 1.25)],
  },
  // √: a tick rising into the long stroke down to the baseline, back up to the cap line and the bar
  'square-root': {
    tags: ['raíz cuadrada', 'radical', 'fórmula', 'calculadora', 'square root', 'radical', 'root'],
    d: [line([3.75, 13.5], [6.25, 12.25], [9.75, B], [14, T], [20.25, T])],
  },
  // A numerator over a denominator: two slots wider than tall (7 × 5), 3.25 from the bar, so they read
  // as boxes to fill and not as the dots of `divide`
  'fraction': {
    tags: ['fracción', 'quebrado', 'división', 'insertar fracción', 'fraction', 'numerator', 'denominator'],
    d: [hl(4.25, 19.75, M), sq(8.5, 3.75, 7, 5, 1.75), sq(8.5, 15.25, 7, 5, 1.75)],
    fill: { solid: [sq(8.5, 3.75, 7, 5, 1.75), sq(8.5, 15.25, 7, 5, 1.75)], lines: [hl(4.25, 19.75, M)] },
  },
  // xʸ: the base's slot and the power's, raised off its top right corner (4 apart corner to corner)
  'exponent': {
    tags: ['exponente', 'potencia', 'elevar', 'insertar exponente', 'exponent', 'power', 'superscript'],
    d: [sq(3.25, 10.25, 10.5, 10.5, 3), sq(15.25, 3.25, 5.5, 5.5, 1.75)],
    fill: { solid: [sq(3.25, 10.25, 10.5, 10.5, 3), sq(15.25, 3.25, 5.5, 5.5, 1.75)] },
  },
  // π: the bar overhangs the legs; the right leg turns out into a quarter circle at its foot
  'pi': {
    tags: ['pi', 'constante', 'círculo', 'geometría', 'pi', 'constant', 'circle'],
    d: [hl(4.75, 19.25, 5.25), vl(9, 5.25, 18.75), `M15 5.25V15.5A3.25 3.25 0 0 0 18.25 18.75`],
  },
  'integral': {
    tags: ['integral', 'cálculo', 'área bajo la curva', 'fórmula', 'integral', 'calculus', 'area under curve'],
    d: [INTEGRAL],
  },
  // ∂: a bowl (r 4.5) whose right side rises as a stem and curls back over the top (r 4.5)
  'partial-derivative': {
    tags: ['derivada parcial', 'cálculo', 'tasa de cambio', 'fórmula', 'partial derivative', 'calculus', 'rate of change'],
    d: [circ(12, 15.25, 4.5), `M16.5 15.25V8.75${arc(12, 8.75, 4.5, 0, -165).d.replace(/^M[^A]*/, '')}`],
  },
  'degree': {
    tags: ['grado', 'grados', 'ángulo', 'temperatura', 'degree', 'angle', 'temperature'],
    d: [circ(12, 7.5, 3.25)],
  },
  'degree-celsius': {
    tags: ['grados celsius', 'centígrados', 'temperatura', 'clima', 'celsius', 'temperature', 'weather'],
    d: [DEG_RING, ...glyph.C(16.25)],
  },
  'degree-fahrenheit': {
    tags: ['grados fahrenheit', 'temperatura', 'clima', 'unidad', 'fahrenheit', 'temperature', 'weather'],
    d: [DEG_RING, `M20.25 ${T}H11V${B}`, hl(11, 18.75, M)],
  },
  // ‰: percent's rings (r 2) and its slash, steeper (60°) so the third ring fits beside the lower one
  'per-mille': {
    tags: ['por mil', 'tanto por mil', 'tasa', 'alcoholemia', 'per mille', 'per thousand', 'rate'],
    d: (() => {
      const dx = 7.75 / Math.tan(rad(60));
      return [circ(5.25, 6.75, 2), line([8.5 - dx, B], [8.5 + dx, T]), circ(11.75, 17.25, 2), circ(18.75, 17.25, 2)];
    })(),
  },
  // ∝: the `infinity` of datos cut open: its left loop and the two strokes that leave it, level
  'proportional': {
    tags: ['proporcional', 'proporción', 'escala', 'relación', 'proportional', 'proportional to', 'scaling'],
    d: ['M20.5 7.75H18.25C16.25 7.75 14.75 9.25 13 12C11.25 14.75 9.75 16.25 7.75 16.25C5.4 16.25 3.5 14.35 3.5 12S5.4 7.75 7.75 7.75C9.75 7.75 11.25 9.25 13 12S16.25 16.25 18.25 16.25H20.5'],
  },
  'therefore': {
    tags: ['por lo tanto', 'conclusión', 'lógica', 'demostración', 'therefore', 'conclusion', 'proof'],
    d: [pdot(12, 7.75), pdot(7.25, 16.25), pdot(16.75, 16.25)],
  },
  'because': {
    tags: ['porque', 'premisa', 'lógica', 'demostración', 'because', 'premise', 'proof'],
    d: [pdot(7.25, 7.75), pdot(16.75, 7.75), pdot(12, 16.25)],
  },
  // |x|: two bars around a slot, 3 apart
  'absolute-value': {
    tags: ['valor absoluto', 'abs', 'fórmula', 'hoja de cálculo', 'absolute value', 'modulus', 'formula'],
    d: [vl(5.75, T, B), sq(8.75, 8.75, 6.5, 6.5, 2), vl(18.25, T, B)],
    fill: { solid: [sq(8.75, 8.75, 6.5, 6.5, 2)], lines: [vl(5.75, T, B), vl(18.25, T, B)] },
  },
  // A group of five: four strokes 3.5 apart and the one that crosses them
  'tally-marks': {
    tags: ['conteo', 'palotes', 'contar', 'marcador', 'tally marks', 'count', 'score'],
    d: [...[6.75, 10.25, 13.75, 17.25].map((x) => vl(x, 4.75, 19.25)), line([4.25, 16.25], [19.75, 7.75])],
  },

  // ── Sets and logic ──
  'subset': {
    tags: ['subconjunto', 'contenido en', 'conjuntos', 'filtro', 'subset', 'contained in', 'sets'],
    d: [SUBSET],
  },
  'superset': {
    tags: ['superconjunto', 'contiene', 'conjuntos', 'filtro', 'superset', 'contains', 'sets'],
    d: [flipPath(SUBSET)],
  },
  'subset-or-equal': {
    tags: ['subconjunto o igual', 'contenido o igual', 'conjuntos', 'subset or equal', 'sets', 'contained'],
    d: SUBSET_EQ,
  },
  'superset-or-equal': {
    tags: ['superconjunto o igual', 'contiene o igual', 'conjuntos', 'superset or equal', 'sets', 'contains'],
    d: SUBSET_EQ.map((d) => flipPath(d)),
  },
  // ∈: the subset's half ring and a bar from its middle to the opening
  'element-of': {
    tags: ['pertenece a', 'es uno de', 'elemento', 'conjuntos', 'element of', 'is any of', 'member of'],
    d: [SUBSET, hl(5.5, 18.5, M)],
  },
  // ∅: a ring (r 6.5) and a stroke at 60° that runs 2.75 past it at both ends
  'empty-set': {
    tags: ['conjunto vacío', 'vacío', 'nulo', 'sin valor', 'empty set', 'null', 'is empty'],
    d: [circ(12, M, 6.5), line(polar(12, M, 9.25, 120), polar(12, M, 9.25, -60))],
  },
  // ∀: the A turned upside down
  'for-all': {
    tags: ['para todo', 'cuantificador universal', 'lógica', 'regla', 'for all', 'universal quantifier', 'every'],
    d: glyph.A().map((d) => flipPath(d, 'y')),
  },
  // ∃: the E mirrored
  'there-exists': {
    tags: ['existe', 'cuantificador existencial', 'al menos uno', 'lógica', 'there exists', 'existential quantifier', 'at least one'],
    d: glyph.E().map((d) => flipPath(d)),
  },
  'logic-not': {
    tags: ['negación', 'no lógico', 'lógica', 'condición', 'logical not', 'negation', 'not'],
    d: [line([4.25, 9.75], [19.75, 9.75], [19.75, 14.25])],
  },
  'implies': {
    tags: ['implica', 'si entonces', 'lógica', 'regla', 'implies', 'if then', 'logic'],
    d: doubleArrow(false),
  },
  'if-and-only-if': {
    tags: ['si y solo si', 'equivalencia', 'lógica', 'bicondicional', 'if and only if', 'iff', 'equivalence'],
    d: doubleArrow(true),
  },

  // ── Punctuation and typographic signs ──
  'ampersand': {
    tags: ['y', 'et', 'ampersand', 'unir', 'conjunción', 'and', 'and sign'],
    d: [AMPERSAND],
  },
  'section-sign': {
    tags: ['sección', 'párrafo legal', 'artículo', 'cláusula', 'section sign', 'section', 'clause'],
    d: SECTION,
  },
  // •: one dot, the largest the engine draws solid
  'bullet': {
    tags: ['viñeta', 'punto', 'separador', 'estado', 'bullet', 'dot', 'separator'],
    d: [dot(12, M, 1)],
  },
  'question-mark': {
    tags: ['signo de interrogación', 'pregunta', 'desconocido', 'ayuda', 'question mark', 'question', 'unknown'],
    d: [QUESTION_HOOK, pdot(12, POINT_Y)],
  },
  'exclamation-mark': {
    tags: ['signo de exclamación', 'énfasis', 'prioridad', 'importante', 'exclamation mark', 'emphasis', 'priority'],
    d: [vl(12, T, 14.5), pdot(12, POINT_Y)],
  },
  // ¿ and ¡: the same signs turned (the point is redrawn where it lands: a dot is a circle from its left)
  'question-mark-inverted': {
    tags: ['signo de interrogación de apertura', 'abrir pregunta', 'español', 'teclado español', 'inverted question mark', 'spanish', 'opening question mark'],
    d: [turnPath(QUESTION_HOOK, 180), pdot(12, 24 - POINT_Y)],
  },
  'exclamation-mark-inverted': {
    tags: ['signo de exclamación de apertura', 'abrir exclamación', 'español', 'teclado español', 'inverted exclamation mark', 'spanish', 'opening exclamation mark'],
    d: [vl(12, 24 - 14.5, 24 - T), pdot(12, 24 - POINT_Y)],
  },
  'quote-closing': {
    tags: ['comillas de cierre', 'cerrar cita', 'comillas', 'cita', 'closing quote', 'end quote', 'quotation marks'],
    d: QUOTE.map((d) => turnPath(d, 180)),
  },
  'quote-straight': {
    tags: ['comillas rectas', 'cadena de texto', 'código', 'tipo texto', 'straight quotes', 'string', 'double quotes'],
    d: [vl(9.5, T, 10.25), vl(14.5, T, 10.25)],
  },
  // ‘: the comma turned, in the upper half where quote-straight's marks sit (the point is redrawn where
  // it lands: a dot is a circle from its left)
  'quote-single': {
    tags: ['comilla simple', 'apóstrofo', 'cita anidada', 'comilla', 'single quote', 'apostrophe', 'quotation mark'],
    d: [pdot(11.25, 8.25), turnPath(COMMA_TAIL(12.75, 15.75), 180)],
  },
  'guillemets': {
    tags: ['comillas angulares', 'comillas latinas', 'comillas españolas', 'tipografía', 'guillemets', 'angle quotes', 'french quotes'],
    d: [...chevrons(3.5, 1), ...chevrons(20.5, -1)],
  },
  // ,: the mark centered by its box
  'comma': {
    tags: ['coma', 'separador decimal', 'separador de miles', 'csv', 'comma', 'decimal separator', 'thousands separator'],
    d: comma(12.75, 11),
  },
  'colon': {
    tags: ['dos puntos', 'separador de hora', 'proporción', 'clave valor', 'colon', 'time separator', 'ratio'],
    d: [pdot(12, 8.25), pdot(12, 15.75)],
  },
  // ;: the colon's top point over the comma
  'semicolon': {
    tags: ['punto y coma', 'fin de instrucción', 'delimitador', 'código', 'semicolon', 'statement end', 'delimiter'],
    d: [pdot(12, 8.25), ...comma(12, 15.75)],
  },
  'slash': {
    tags: ['barra', 'diagonal', 'ruta', 'comando', 'slash', 'forward slash', 'path'],
    d: [line([7.25, 20.25], [16.75, 3.75])],
  },
  'backslash': {
    tags: ['barra invertida', 'escape', 'ruta de archivo', 'código', 'backslash', 'escape', 'file path'],
    d: [flipPath(line([7.25, 20.25], [16.75, 3.75]))],
  },
  'pipe': {
    tags: ['barra vertical', 'tubería', 'separador', 'o lógico', 'pipe', 'vertical bar', 'separator'],
    d: [vl(12, 2.75, 21.25)],
  },
  'underscore': {
    tags: ['guion bajo', 'subrayado', 'identificador', 'espacio en blanco', 'underscore', 'snake case', 'blank'],
    d: [hl(4.25, 19.75, 20.75)],
  },
  'tilde': {
    tags: ['tilde', 'virgulilla', 'aproximado', 'carpeta personal', 'tilde', 'about', 'home folder'],
    d: [wave(4.25, 19.75, M, 2)],
  },
  'parentheses': {
    tags: ['paréntesis', 'agrupar', 'función', 'aclaración', 'parentheses', 'group', 'function call'],
    d: [PAREN, flipPath(PAREN)],
  },
  'braces-double': {
    tags: ['llaves dobles', 'variable de plantilla', 'etiqueta de combinación', 'personalizar', 'double braces', 'template variable', 'merge tag'],
    d: [...BRACES, ...BRACES.map((d) => flipPath(d))],
  },
  'brackets-double': {
    tags: ['corchetes dobles', 'enlace wiki', 'enlazar notas', 'arreglo anidado', 'double brackets', 'wiki link', 'nested array'],
    d: [...BRACKETS, ...BRACKETS.map((d) => flipPath(d))],
  },
  'brackets-floor': {
    tags: ['piso', 'redondear hacia abajo', 'entero inferior', 'fórmula', 'floor', 'round down', 'formula'],
    d: [FLOOR, flipPath(FLOOR)],
  },
  'brackets-ceiling': {
    tags: ['techo', 'redondear hacia arriba', 'entero superior', 'fórmula', 'ceiling', 'round up', 'formula'],
    d: [flipPath(FLOOR, 'y'), flipPath(flipPath(FLOOR), 'y')],
  },

  // ── Currency ──
  ...Object.fromEntries(Object.entries(CURRENCY).map(([k, sign]) => [`currency-${k}`, { tags: CURRENCY_TAGS[k], d: [COIN, ...sign] }])),
};

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────
// The closing quotation marks are closed shapes, like edicion's `quote`: hollow in outline, solid
// filled. The slots of the templates were given theirs above. Per mille fills its rings and keeps its
// slash a line, as comercio's `percent` does. Letters, digits, points and signs are open lines and
// dots: their filled version is the outline itself.
icons['quote-closing'].fill = { solid: icons['quote-closing'].d };
{
  const d = icons['per-mille'].d;
  icons['per-mille'].fill = { solid: [d[0], d[2], d[3]], lines: [d[1]] };
}
// The coins, as comercio's: a solid disc with the sign knocked out
const COINS = Object.keys(CURRENCY).map((k) => `currency-${k}`);
for (const name of COINS) icons[name].fill = { solid: [COIN], cut: icons[name].d.slice(1) };
for (const icon of Object.values(icons)) if (icon.fill === undefined) icon.fill = false;

// ── 16 px (DESIGN.md › 16 px) ───────────────────────────────────────────────────────────────
// Only the drawings that don't read once snapped. At 16 px a pixel measures 1.5 of the canvas and
// pixel centers fall at 0.75 + 1.5k; g(column, row) is the center of a pixel, and these glyphs run
// from center to center (their diagonals at 45° or steeper).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
{
  // « »: pixel chevrons, arms of 2 pixels, two empty columns between the pairs
  const d = [pl([3, 5], [1, 7], [3, 9]), pl([6, 5], [4, 7], [6, 9]), pl([12, 5], [14, 7], [12, 9]), pl([9, 5], [11, 7], [9, 9])];
  icons.guillemets.small = { d };
  // {{ }}: pixel braces, the inner ones 3 columns in and 3 rows shorter
  const outer = pl([3, 1], [2, 2], [2, 6], [1, 7], [2, 8], [2, 12], [3, 13]);
  const inner = pl([6, 4], [5, 5], [5, 6], [4, 7], [5, 8], [5, 9], [6, 10]);
  icons['braces-double'].small = { d: [outer, inner, snap(flipPath(outer)), snap(flipPath(inner))] };
  // ~ and ≈: waves of 45° steps and flats through pixel centers, point-symmetric (snapped, the arcs
  // turned gray and the two tildes of ≈ ran together); Ñ keeps its snapped N under a two-row tilde
  const wave = (r) => pl([4, r + 1], [5, r], [7, r], [8, r + 1], [10, r + 1], [11, r]);
  icons.approximately.small = { d: [wave(5), wave(9)] };
  icons.tilde.small = { d: [pl([2, 8], [4, 6], [6, 6], [9, 9], [11, 9], [13, 7])] };
  icons['letter-n-tilde'].small = { d: [snap(glyph.N(8.25)[0]), pl([5, 3], [6, 2], [7, 2], [8, 3], [9, 3], [10, 2])] };
  // °: a ring centered on a pixel edge with its four extremes on pixel centers (r 3.25 was a gray blur)
  icons.degree.small = { d: [circ(12, 7.5, 3.75)] };
  // , and ‘: the point a crisp 2 × 2 (a dot on a pixel corner) and the tail one diagonal pixel
  icons.comma.small = { d: [pdot(12, 10.5), pl([8, 8], [7, 9])] };
  icons['quote-single'].small = { d: [pdot(12, 9), pl([7, 4], [8, 3])] };
}
{
  // The coins that clog: the snapped ring and a sign on the pixel grid with fewer pieces (one bar
  // for the won and the naira; the colón's strokes upright, 3 columns apart)
  const coin = snap(COIN);
  const sign = {
    'currency-won': [pl([4, 4], [5, 10], [7, 6], [9, 10], [10, 4]), pl([3, 7], [11, 7])],
    'currency-naira': [pl([5, 11], [5, 4], [10, 11], [10, 4]), pl([3, 7], [12, 7])],
    'currency-colon': [snap(`M${xy(ept(12.75, M, 4.25, 5, -45))}${earcTo(12.75, M, 4.25, 5, -45, -315)}`), pl([6, 11], [7, 4]), pl([9, 11], [10, 4])],
  };
  for (const [name, sg] of Object.entries(sign)) icons[name].small = { d: [coin, ...sg], fill: { solid: [coin], cut: sg } };
}

// ── Named parts: what animates, counts or has a meaning of its own ──────────────────────────
const PARTS = {
  'letter-n-tilde': { letter: [0], tilde: [1] },
  'not-equal': { bars: [0, 1], slash: [2] },
  'less-than-or-equal': { sign: [0], bar: [1] },
  'greater-than-or-equal': { sign: [0], bar: [1] },
  'subset-or-equal': { sign: [0], bar: [1] },
  'superset-or-equal': { sign: [0], bar: [1] },
  'element-of': { sign: [0], bar: [1] },
  'empty-set': { ring: [0], slash: [1] },
  'fraction': { bar: [0], numerator: [1], denominator: [2] },
  'exponent': { base: [0], power: [1] },
  'absolute-value': { bars: [0, 2], value: [1] },
  'tally-marks': { marks: [0, 1, 2, 3], strike: [4] },
  'degree-celsius': { degree: [0], letter: [1] },
  'degree-fahrenheit': { degree: [0], letter: [1, 2] },
  'implies': { shafts: [0, 1], arrow: [2] },
  'if-and-only-if': { shafts: [0, 1], arrow: [2, 3] },
  'bullet': { dot: [0] },
  'question-mark': { hook: [0], point: [1] },
  'exclamation-mark': { stroke: [0], point: [1] },
  'question-mark-inverted': { hook: [0], point: [1] },
  'exclamation-mark-inverted': { stroke: [0], point: [1] },
  'semicolon': { point: [0], comma: [1, 2] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const name of COINS) icons[name].parts = { coin: [0], sign: icons[name].d.slice(1).map((_, i) => i + 1) };

// ── Levels: the tally counts its strokes, the strike last (value 0–1) ──────────────────────
icons['tally-marks'].levels = [[0], [1], [2], [3], [4]];

// ── Motion: each icon's own gesture ─────────────────────────────────────────────────────────
// The question and the exclamation rock on their point; the inverted ones hang from it
icons['question-mark'].motion = { effect: 'wiggle', origin: [12, 20.5] };
icons['exclamation-mark'].motion = { effect: 'wiggle', origin: [12, 20.5] };
icons['question-mark-inverted'].motion = { effect: 'wiggle', origin: [12, 3.5] };
icons['exclamation-mark-inverted'].motion = { effect: 'wiggle', origin: [12, 3.5] };
icons.implies.motion = { effect: 'slide', vector: [2, 0] };
icons.bullet.motion = { effect: 'beat', origin: [12, 12] };

// ── Variants ────────────────────────────────────────────────────────────────────────────────
// A slash through a character says nothing; the coins keep theirs, as comercio's do
for (const [name, icon] of Object.entries(icons)) if (!COINS.includes(name)) icon.variants = { ...icon.variants, slash: false };
// Already in a coin: not enclosed again
for (const name of COINS) icons[name].variants = { ...icons[name].variants, circle: false };
// A dot in a ring or a frame is a radio button or a checkbox, not a bullet; at 58 % a lone comma or
// quote mark is a speck (in a ring, the quote read as a clock hand)
for (const name of ['bullet', 'comma', 'quote-single']) icons[name].variants = { ...icons[name].variants, circle: false, square: false };

export default { category: 'simbolos', label: 'Símbolos y caracteres', icons };
