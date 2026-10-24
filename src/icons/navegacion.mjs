// Navegación (navigation): arrows, chevrons, menus, panels, views and everything that moves the
// user through the interface. Drawn with the engine following the rules in DESIGN.md; the base
// measurements come from Núcleo (arrow-right: 16 shaft, arms of 6 per axis; chevron-right: arms of 6.75).
import { arc, badge, circ, cursor, dot, f, flipPath, head, line, polar, roundpoly, sq, turn, turnPath } from '../../engine/geometry.mjs';

const R2 = Math.SQRT2;
const P = ([x, y]) => `${f(x)} ${f(y)}`;

/** Straight arrow from `a` to `b`; `len` is the length of each arm of the head. */
const arrow = (a, b, len) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], len)];
/** Straight arrow rotated `deg` around the center. */
const arrowR = (a, b, len, deg) => {
  const [p, q] = turn([a, b], deg);
  return arrow(p, q, len);
};

// Continuous corner (squircle) with the same 0.6 smoothing as sq(): the measurements of a corner of radius r.
function corner(r, s = 0.6) {
  const p = (1 + s) * r;
  const ang = 90 * (1 - s);
  const L = Math.sin(((ang / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - ang) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L, r };
}

/**
 * Open polyline with continuous corners at its 90° vertices (the same ones as sq()). `radius` can
 * be a single value or one per vertex; 0 leaves the corner square (the signature corner).
 */
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
    const k = corner(r);
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

/** Vertical capsule: the same as the mouse in Dispositivos (straight sides, semicircular ends). */
const capsule = (x, y, w, h) => {
  const r = w / 2;
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
};

// Base containers (Núcleo keylines).
const SQUARE = sq(3.25, 3.25, 17.5, 17.5, 4.25, { square: ['br'] });
const RING = circ(12, 12, 9);

// Large arrow: Núcleo's arrow-right (shaft 3.75→19.75, arms of 6 per axis).
const BIG = [[3.75, 12], [19.75, 12]];
const BIG_ARM = 6 * R2;
// Large diagonal: a 12 box, arms of 8 along the axes.
const DIAG = [[5.75, 18.25], [17.75, 6.25]];
const DIAG_ARM = 8;
// Inner arrow (in a circle or a square): 9.25 shaft, arms of 4.25 per axis.
const IN = [[7.25, 12], [16.5, 12]];
const IN_ARM = 4.25 * R2;
const IN_DIAG = [[8.5, 15.5], [15.5, 8.5]];
const IN_DIAG_ARM = 5.75;

// Thick arrow (outline): 5.5 shaft and 15 head, rotated `deg`.
const THICK = [[3.25, 9.25], [11.75, 9.25], [11.75, 4.5], [20.75, 12], [11.75, 19.5], [11.75, 14.75], [3.25, 14.75]];
const thick = (deg) => [roundpoly(turn(THICK, deg), [1.25, 0.75, 1.25, 1.75, 1.25, 0.75, 1.25])];
// Arrow against a bar (scroll to top, scroll to bottom…), drawn pointing up and then rotated.
const toLine = (deg) => {
  const [a, b, c, e] = turn([[5.25, 4], [18.75, 4], [12, 20.25], [12, 8]], deg);
  return [line(a, b), ...arrow(c, e, 5.5 * R2)];
};
// Corner turn: goes up and turns right; the others are its mirror or its rotation.
const TURN = [[5.25, 20.25], [5.25, 9.5], [19.25, 9.5]];
const mirrorX = (pts) => pts.map(([x, y]) => [24 - x, y]);
const turnArrow = (pts) => [cline(pts, 4.5), head(pts[2], [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]], 5 * R2)];
// U-turn (undo): the way back is half a squircle, with the set's continuous corners.
const UNDO = [[4.25, 8.75], [19.75, 8.75], [19.75, 19.75], [10.5, 19.75]];
const uturn = (pts) => [cline(pts, [0, 3.4, 3.4, 0]), head(pts[0], [pts[0][0] - pts[1][0], 0], 4.5 * R2)];
// Arc that jumps to one side (the left one is its mirror: angle θ → 180 − θ). Arc head of 3.6,
// the same as Núcleo's refresh.
const curveArrow = (flip) => {
  const a = flip ? arc(12, 15.5, 8, 15, -162) : arc(12, 15.5, 8, 165, 342);
  return [a.d, head(a.end, a.tangent, 3.6)];
};
// History: the exact mirror of clock-forward (Lugares): the clock runs backward.
const HISTORY = arc(12, 12, 8.75, 220, -65);

// Núcleo's chevron (arms of 6.75, shifted 0.6 toward where it points) and its rotations.
const CHEV = [[9.25, 5.25], [16, 12], [9.25, 18.75]];
const chev = (deg, pts = CHEV) => line(...turn(pts, deg));
// Double chevron: arms of 5.5, set 5.5 apart (3.9 between strokes).
const CHEV2 = [[[6.75, 6.5], [12.25, 12], [6.75, 17.5]], [[12.25, 6.5], [17.75, 12], [12.25, 17.5]]];
const chev2 = (deg) => CHEV2.map((pts) => chev(deg, pts));
// Chevron inside the circle: arms of 4.25.
const CHEV_IN = [[10.25, 7.75], [14.5, 12], [10.25, 16.25]];
// Caret: outlined triangle, with the tip slightly rounder than the base.
const CARET = [[8.25, 5.75], [17.25, 12], [8.25, 18.25]];
const caret = (deg) => [roundpoly(turn(CARET, deg), [1.6, 1.9, 1.6])];
// Sort: a downward arrow (reading direction) and three bars.
const sortBars = (lens) => [...arrow([6.75, 4.25], [6.75, 19.75], 3.5 * R2), ...[6.5, 12, 17.5].map((y, i) => line([13.5, y], [13.5 + lens[i], y]))];

// Maximize / minimize: two diagonals that leave the center or return to it.
const OUT = [[13.75, 10.25], [20, 4]];
const out2 = (inward) =>
  [0, 180].flatMap((deg) => {
    const [a, b] = turn(OUT, deg);
    return inward ? arrow(b, a, 6) : arrow(a, b, 6);
  });
// Expand / collapse: a fold line and two chevrons that move apart or come together.
const fold = (open, deg) => {
  const ch = open
    ? [[[7.75, 8], [12, 3.75], [16.25, 8]], [[7.75, 16], [12, 20.25], [16.25, 16]]]
    : [[[7.75, 4], [12, 8.25], [16.25, 4]], [[7.75, 20], [12, 15.75], [16.25, 20]]];
  return [line(...turn([[4.25, 12], [19.75, 12]], deg)), ...ch.map((pts) => line(...turn(pts, deg)))];
};
// Fullscreen corners: the bottom-right one is square, like every container in the set.
const CORNERS = [
  [[3.25, 8.75], [3.25, 3.25], [8.75, 3.25]],
  [[15.25, 3.25], [20.75, 3.25], [20.75, 8.75]],
  [[20.75, 15.25], [20.75, 20.75], [15.25, 20.75]],
  [[8.75, 20.75], [3.25, 20.75], [3.25, 15.25]],
];
const CORNERS_IN = [
  [[3.25, 8.75], [8.75, 8.75], [8.75, 3.25]],
  [[15.25, 3.25], [15.25, 8.75], [20.75, 8.75]],
  [[20.75, 15.25], [15.25, 15.25], [15.25, 20.75]],
  [[8.75, 20.75], [8.75, 15.25], [3.25, 15.25]],
];
const brackets = (inward) => (inward ? CORNERS_IN : CORNERS).map((pts, i) => cline(pts, [0, i === 2 ? 0 : 2.5, 0]));

// Landscape window (19 × 14, radius 4, signature corner at bottom right) for panels and bars.
const WIN = sq(2.5, 5, 19, 14, 4, { square: ['br'] });
// Small cell for the views (3.5 per side); the bottom-right one gets the signature corner, as in apps.
const cell = (x, y, br = false) => sq(x, y, 3.5, 3.5, 1.05, { square: br ? ['br'] : [] });

// Núcleo's magnifier (search) for zoom.
const LENS = [circ(10.6, 10.6, 6.85), line([15.6, 15.6], [20.5, 20.5])];

// ── Round 3 ───────────────────────────────────────────────────────────────────────────────
// Arrow leaving a bar: toLine's bar and arrow (12.25 shaft, arms of 5.5 per axis) with the arrow
// reversed, its tail 4 from the bar. Drawn running down from a bar at the top, then rotated.
const fromLine = (deg) => {
  const [a, b, c, e] = turn([[5.25, 4], [18.75, 4], [12, 8], [12, 20.25]], deg);
  return [line(a, b), ...arrow(c, e, 5.5 * R2)];
};
// Arrow and dot: the same arrow, its tip (or its tail) 3.75 above a dot, 3.05 from its edge.
const DOT_ARROW = [[12, 3.5], [12, 16]];
const DOT_UNDER = dot(12, 19.75);
// Arrow into a corner: a diagonal arrow (12.75 box, arms of 6 along the axes) whose head nests 3.75
// inside an L bracket with arms of 8 (fullscreen's corner, radius 2.5). Drawn into the top right and
// turned; at the bottom right the bracket keeps the signature square corner, as in fullscreen.
const CORNER_L = [[12.75, 3.25], [20.75, 3.25], [20.75, 11.25]];
const CORNER_ARROW = [[4.25, 19.75], [17, 7]];
const toCorner = (deg) => {
  const pts = turn(CORNER_L, deg);
  const br = pts[1][0] > 12 && pts[1][1] > 12;
  return [cline(pts, [0, br ? 0 : 2.5, 0]), ...arrow(...turn(CORNER_ARROW, deg), 6)];
};
// The share box from Edición (an opening of 5.9 in its lid, signature corner at bottom right).
const SHARE_BOX = cline([[14.95, 9.5], [19.75, 9.5], [19.75, 21], [4.25, 21], [4.25, 9.5], [9.05, 9.5]], [0, 3, 0, 3, 3, 0]);
// Fork (merge and split): a branch leaves the stem at 45°, turns straight on an arc of 4.5 and runs
// to the edge (x 6 or 18). `sx` picks the side and `sy` the half (1: below the junction); the path
// runs from the edge in to the junction `jy`, or out from it.
const FORK_R = 4.5;
function forkBranch(sx, sy, jy, end, outward) {
  const J = [12, jy];
  const k = FORK_R * (1 - Math.SQRT1_2);
  const E1 = [12 + sx * (6 - k), jy + sy * (6 - k)];
  const A = [12 + sx * 6, E1[1] + sy * FORK_R * Math.SQRT1_2];
  const B = [12 + sx * 6, end];
  // Turning from the diagonal to the straight run: clockwise on screen when the cross product is positive
  const u = [E1[0] - J[0], E1[1] - J[1]];
  const v = [0, sy];
  const cw = u[0] * v[1] - u[1] * v[0] > 0;
  return outward
    ? `M${P(J)}L${P(E1)}A${f(FORK_R)} ${f(FORK_R)} 0 0 ${cw ? 1 : 0} ${P(A)}L${P(B)}`
    : `M${P(B)}L${P(A)}A${f(FORK_R)} ${f(FORK_R)} 0 0 ${cw ? 0 : 1} ${P(E1)}L${P(J)}`;
}
// Converge and diverge: two diagonal arrows (arms of 5 along the axes, like the set's diagonals)
// that point at a dot or leave it, 3 per axis from its center, so the inner arms stand 6 apart.
const FAN_DOT = [16, 12];
const fan = (out) => {
  const c = out ? [24 - FAN_DOT[0], 12] : FAN_DOT;
  const dir = out ? 1 : -1;
  return [-1, 1].flatMap((s) => {
    const near = [c[0] + dir * 3, 12 + s * 3];
    const far = [c[0] + dir * 8.5, 12 + s * 8.5];
    return out ? arrow(near, far, 5) : arrow(far, near, 5);
  });
};

// Orbit (rotate-3d): an ellipse of 9 × 3.75 around a vertical axis. Its front passes before the axis,
// which is cut 3 from it; at the back the axis passes before the orbit, which opens there (3 to each
// side of the axis) and ends in its head (3.4, like every arc arrow).
const ORBIT = (() => {
  const [rx, ry] = [9, 3.75];
  const y = 12 - ry * Math.sqrt(1 - (3 / rx) ** 2);
  const t = Math.acos(-3 / rx) + Math.PI; // the end, at the back left
  const tangent = [-rx * Math.sin(t), ry * Math.cos(t)];
  return [`M${P([15, y])}A${f(rx)} ${f(ry)} 0 1 1 ${P([9, y])}`, head([9, y], tangent, 3.4), line([12, 2.75], [12, 12 + ry - 3]), line([12, 12 + ry + 3], [12, 21.25])];
})();
// Loop: the line comes in from the left, turns up on an arc of 2.5 into a diagonal, goes once around a
// circle of r 3 and leaves on the other diagonal, crossing the way in at a right angle; then it turns
// level again to its head (arms of 3). The way in passes behind: it's cut 3 to each side of the crossing.
// The line runs at 15.5 so the whole loop sits on the canvas's center (at 17 it hung 1.5 low).
const LOOP = (() => {
  const [r, R, yb] = [3, 2.5, 15.5];
  const k = Math.SQRT1_2;
  const X = [12, yb - 3 * k - R * (1 - k)]; // the crossing, 3 along the diagonal from the turn
  const C = [12, X[1] - r * Math.SQRT2];
  const T1 = [C[0] + r * k, C[1] + r * k];
  const T2 = [C[0] - r * k, C[1] + r * k];
  const E1 = [X[0] - 3 * k, X[1] + 3 * k];
  const E2 = [X[0] + 3 * k, X[1] + 3 * k];
  const inWay = `M3.25 ${f(yb)}H${f(E1[0] - R * k)}A${f(R)} ${f(R)} 0 0 0 ${P(E1)}`;
  const around = `M${P(T1)}A${f(r)} ${f(r)} 0 1 0 ${P(T2)}L${P(E2)}A${f(R)} ${f(R)} 0 0 0 ${P([E2[0] + R * k, yb])}H20.75`;
  return [inWay, around, head([20.75, yb], [1, 0], 3 * R2)];
})();
// Bounce: the arrow comes down onto the ground and leaves it at the same angle, as a reflection, to its
// head (arms of 6, like every straight arrow); the corner (r 1.5) stops at least 3 above a ground line
// across the whole width (on the next quarter). Falling steep and leaving shallow over a short ground,
// it read as a check mark or a chart.
const BOUNCE = [[3.5, 5.25], [12, 16.25], [20.5, 5.25]];
const BOUNCE_R = 1.5;
const BOUNCE_GROUND = (() => {
  const half = Math.atan2(BOUNCE[1][0] - BOUNCE[0][0], BOUNCE[1][1] - BOUNCE[0][1]);
  return Math.ceil((BOUNCE[1][1] - (BOUNCE_R / Math.sin(half) - BOUNCE_R) + 3) * 4) / 4;
})();
/** Open polyline with a circular corner of radius `r` at each inner vertex (any angle). */
function rline(pts, r) {
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const u = [(A[0] - V[0]) / Math.hypot(A[0] - V[0], A[1] - V[1]), (A[1] - V[1]) / Math.hypot(A[0] - V[0], A[1] - V[1])];
    const v = [(B[0] - V[0]) / Math.hypot(B[0] - V[0], B[1] - V[1]), (B[1] - V[1]) / Math.hypot(B[0] - V[0], B[1] - V[1])];
    const t = r / Math.tan(Math.acos(u[0] * v[0] + u[1] * v[1]) / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${P([V[0] + u[0] * t, V[1] + u[1] * t])}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P([V[0] + v[0] * t, V[1] + v[1] * t])}`;
  }
  return `${d}L${P(pts.at(-1))}`;
}
// Cycle: three arc arrows on r 7.5, 85° each and 35° apart, each with its head (3.4): drawn once and
// turned. The heads sit off the axes (at 25°, 145° and 265°) so their outer arms stay in the live area.
const CYCLE = (() => {
  const a = arc(12, 12, 7.5, -60, 25);
  return [a.d, head(a.end, a.tangent, 3.4)];
})();
// The pointer that carries a status badge (block, question, plus) or a spinner: the engine's at 0.75,
// up and to the left, 7.45 from the badge's center, so the badge's 6.5 of clearance never reaches it.
const BADGE_PTR = cursor([3.5, 2.75], 0.75);
// Hand (Comunicación's raised hand): four fingers 3 wide with round tips, lines between them that end
// at `split`, and the thumb (3 wide) from `base` to `tip`, leaving the side of the palm. Grabbing, the
// fingers curl forward: from the back they show shorter. `dy` centers the hand on the canvas.
function hand(tops, split, base, tip, dy) {
  const xs = [7.25, 10.25, 13.25, 16.25, 19.25];
  const r = 1.5;
  const Y = (y) => f(y + dy);
  const [b, t] = [[base[0], base[1] + dy], [tip[0], tip[1] + dy]];
  const L = Math.hypot(t[0] - b[0], t[1] - b[1]);
  const n = [(t[1] - b[1]) / L, -(t[0] - b[0]) / L]; // toward the thumb's outer edge
  const at = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
  const [outB, outT, inT, inB] = [at(b, r), at(t, r), at(t, -r), at(b, -r)];
  const J = [xs[0], inT[1] + ((xs[0] - inT[0]) / (inB[0] - inT[0])) * (inB[1] - inT[1])]; // where the thumb leaves the index finger
  let d = `M${P(J)}`;
  for (let i = 0; i < 4; i++) d += `V${Y(tops[i])}A${f(r)} ${f(r)} 0 0 1 ${f(xs[i + 1])} ${Y(tops[i])}`;
  d += `V${Y(14.5)}C19.25 ${Y(18.1)} 16.65 ${Y(20.75)} 13.5 ${Y(20.75)}C10.65 ${Y(20.75)} ${P([outB[0] + 0.9, outB[1] + 1.1])} ${P(outB)}`;
  d += `L${P(outT)}A${f(r)} ${f(r)} 0 0 1 ${P(inT)}Z`;
  return [d, ...[1, 2, 3].map((i) => line([xs[i], Math.max(tops[i - 1], tops[i]) + dy], [xs[i], split + dy]))];
}
// Mouse (Dispositivos' capsule, 9.5 × 13.25 here) with its button seams, and three click rays off the
// corner of the pressed button, 3 to 5.5 out from its arc. Drawn for the left button and mirrored.
const MOUSE = (() => {
  const c = [14.25, 12.75];
  const rays = [195, 225, 255].map((a) => line(polar(...c, 7.75, a), polar(...c, 10.25, a)));
  return [capsule(9.5, 8, 9.5, 13.25), line([9.5, 13.25], [19, 13.25]), line([14.25, 8], [14.25, 13.25]), ...rays];
})();

// Collapse and expand a panel: sidebar-collapse's chevron (arms of 2.75) centered in the window's main
// area, pointing toward the panel (collapse) or away from it (expand).
const panelChevron = (c, deg) => line(...turn([[-1.375, -2.75], [1.375, 0], [-1.375, 2.75]], deg, [0, 0]).map(([x, y]) => [c[0] + x, c[1] + y]));
const PANEL = {
  'panel-bottom': { divider: line([2.5, 14], [21.5, 14]), main: [12, 9.5], toward: 90 },
  'panel-top': { divider: line([2.5, 10], [21.5, 10]), main: [12, 14.5], toward: -90 },
  'sidebar-right': { divider: line([14.75, 5], [14.75, 19]), main: [8.63, 12], toward: 0 },
};
const panelIcon = (name, collapse) => [WIN, PANEL[name].divider, panelChevron(PANEL[name].main, PANEL[name].toward + (collapse ? 0 : 180))];
// The portrait frame (keyline, signature corner) of the tab bar.
const PORTRAIT = sq(4.75, 2.75, 14.5, 18.5, 4, { square: ['br'] });
// Scrollbars: the panels' window with the thumb, a pill of half-width 0.4 (pagination-dots' pill: heavier
// than a line and solid at every weight) 2.85 from the edge it runs along, and a double arrow (heads of
// 2.25 per axis) for the way it scrolls. With the bare thumb the window read as a card, a phone or a door;
// with text lines beside it, as a document.
const vpill = (x, y0, y1, r = 0.4) => `M${f(x + r)} ${f(y0)}V${f(y1)}A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(y1)}V${f(y0)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y0)}Z`;
const twoWay = (a, b, arm) => [line(a, b), head(a, [a[0] - b[0], a[1] - b[1]], arm * R2), head(b, [b[0] - a[0], b[1] - a[1]], arm * R2)];
// Infinite scroll: the same frame with its sides running off the bottom edge.
const OPEN_FRAME = cline([[4.75, 21.25], [4.75, 2.75], [19.25, 2.75], [19.25, 21.25]], [0, 4, 4, 0]);
// Page indicator: the current page is a short pill and the others dots of r 0.4; the pill's half
// height is the same 0.4, so both are as tall at every weight (and the pill never opens a hole).
const pill = (x0, x1, y, r = 0.4) => `M${f(x0)} ${f(y - r)}H${f(x1)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y + r)}H${f(x0)}A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y - r)}Z`;
// Jump to: an arc arrow (r 6, head of 3.4) from beside the top line round to beside the bottom one.
const JUMP = arc(8.75, 12, 6, -90, -270);
// filter-x's funnel: the core filter at 78 %, up and to the left, so a badge only takes its stem's tip.
const FUNNEL_B = roundpoly(
  [[3.25, 4.75], [20.75, 4.75], [14, 12.25], [14, 19.75], [10, 19.75], [10, 12.25]].map(([x, y]) => [12 + (x - 12) * 0.78 - 2.25, 12 + (y - 12) * 0.78 - 2]),
  [1.75, 1.75, 1, 1, 1, 1].map((r) => r * 0.78),
);
// Fit to width (and, turned, to height): a double arrow (heads of 3.5 per axis) between two bars,
// its tips 3.5 from them.
const fit = (deg) => {
  const pts = (ps) => turn(ps, deg);
  const [l1, l2] = [pts([[3.25, 6], [3.25, 18]]), pts([[20.75, 6], [20.75, 18]])];
  const [a, b] = pts([[6.75, 12], [17.25, 12]]);
  return [line(...l1), line(...l2), line(a, b), head(a, [a[0] - b[0], a[1] - b[1]], 3.5 * R2), head(b, [b[0] - a[0], b[1] - a[1]], 3.5 * R2)];
};

const icons = {
  // ── Straight arrows ───────────────────────────────────────────────────────────────────
  'arrow-left': { tags: ['flecha', 'izquierda', 'atrás', 'arrow', 'left', 'back'], d: arrowR(...BIG, BIG_ARM, 180) },
  'arrow-up': { tags: ['flecha', 'arriba', 'subir', 'arrow', 'up'], d: arrowR(...BIG, BIG_ARM, -90) },
  'arrow-down': { tags: ['flecha', 'abajo', 'bajar', 'arrow', 'down'], d: arrowR(...BIG, BIG_ARM, 90) },
  'arrow-up-right': { tags: ['flecha', 'diagonal', 'arriba derecha', 'arrow', 'up right'], d: arrowR(...DIAG, DIAG_ARM, 0) },
  'arrow-down-right': { tags: ['flecha', 'diagonal', 'abajo derecha', 'arrow', 'down right'], d: arrowR(...DIAG, DIAG_ARM, 90) },
  'arrow-down-left': { tags: ['flecha', 'diagonal', 'abajo izquierda', 'arrow', 'down left'], d: arrowR(...DIAG, DIAG_ARM, 180) },
  'arrow-up-left': { tags: ['flecha', 'diagonal', 'arriba izquierda', 'arrow', 'up left'], d: arrowR(...DIAG, DIAG_ARM, -90) },

  // ── Arrows in a circle ────────────────────────────────────────────────────────────────
  'arrow-right-circle': { tags: ['flecha', 'círculo', 'siguiente', 'arrow', 'circle', 'next'], d: [RING, ...arrowR(...IN, IN_ARM, 0)] },
  'arrow-left-circle': { tags: ['flecha', 'círculo', 'anterior', 'arrow', 'circle', 'previous'], d: [RING, ...arrowR(...IN, IN_ARM, 180)] },
  'arrow-up-circle': { tags: ['flecha', 'círculo', 'subir', 'arrow', 'circle', 'up'], d: [RING, ...arrowR(...IN, IN_ARM, -90)] },
  'arrow-down-circle': { tags: ['flecha', 'círculo', 'bajar', 'arrow', 'circle', 'down'], d: [RING, ...arrowR(...IN, IN_ARM, 90)] },
  'arrow-up-right-circle': { tags: ['flecha', 'círculo', 'ir', 'arrow', 'circle', 'go'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 0)] },
  'arrow-down-right-circle': { tags: ['flecha', 'círculo', 'diagonal', 'arrow', 'circle', 'down right'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 90)] },
  'arrow-down-left-circle': { tags: ['flecha', 'círculo', 'entrante', 'arrow', 'circle', 'incoming'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 180)] },
  'arrow-up-left-circle': { tags: ['flecha', 'círculo', 'diagonal', 'arrow', 'circle', 'up left'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, -90)] },

  // ── Arrows in a square (container with the signature corner) ──────────────────────────
  'arrow-right-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'right'], d: [SQUARE, ...arrowR(...IN, IN_ARM, 0)] },
  'arrow-left-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'left'], d: [SQUARE, ...arrowR(...IN, IN_ARM, 180)] },
  'arrow-up-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'up'], d: [SQUARE, ...arrowR(...IN, IN_ARM, -90)] },
  'arrow-down-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'down'], d: [SQUARE, ...arrowR(...IN, IN_ARM, 90)] },
  'arrow-up-right-square': { tags: ['flecha', 'cuadrado', 'abrir', 'arrow', 'square', 'open'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 0)] },
  'arrow-down-right-square': { tags: ['flecha', 'cuadrado', 'diagonal', 'arrow', 'square', 'down right'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 90)] },
  'arrow-down-left-square': { tags: ['flecha', 'cuadrado', 'entrante', 'arrow', 'square', 'down left'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 180)] },
  'arrow-up-left-square': { tags: ['flecha', 'cuadrado', 'diagonal', 'arrow', 'square', 'up left'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, -90)] },

  // ── Thick arrows ──────────────────────────────────────────────────────────────────────
  'arrow-thick-right': { tags: ['flecha gruesa', 'derecha', 'avanzar', 'arrow', 'bold', 'right'], d: thick(0) },
  'arrow-thick-left': { tags: ['flecha gruesa', 'izquierda', 'regresar', 'arrow', 'bold', 'left'], d: thick(180) },
  'arrow-thick-up': { tags: ['flecha gruesa', 'arriba', 'subir', 'arrow', 'bold', 'up'], d: thick(-90) },
  'arrow-thick-down': { tags: ['flecha gruesa', 'abajo', 'bajar', 'arrow', 'bold', 'down'], d: thick(90) },

  // ── Arrows against a bar ──────────────────────────────────────────────────────────────
  'arrow-up-to-line': { tags: ['ir al inicio', 'arriba', 'tope', 'scroll to top', 'arrow', 'top'], d: toLine(0) },
  'arrow-down-to-line': { tags: ['ir al final', 'abajo', 'fondo', 'scroll to bottom', 'arrow', 'bottom'], d: toLine(180) },
  'arrow-left-to-line': { tags: ['al inicio', 'izquierda', 'tope', 'arrow', 'start', 'left'], d: toLine(-90) },
  'arrow-right-to-line': { tags: ['al final', 'derecha', 'tabulador', 'arrow', 'end', 'tab'], d: toLine(90) },

  // ── Turns and curves ──────────────────────────────────────────────────────────────────
  'arrow-turn-right': { tags: ['girar', 'vuelta', 'derecha', 'turn', 'corner', 'right'], d: turnArrow(TURN) },
  'arrow-turn-left': { tags: ['girar', 'vuelta', 'izquierda', 'turn', 'corner', 'left'], d: turnArrow(mirrorX(TURN)) },
  'arrow-turn-down-left': { tags: ['intro', 'entrar', 'retorno', 'enter', 'return', 'corner'], d: turnArrow(turn(TURN, 180)) },
  'arrow-turn-down-right': { tags: ['vuelta', 'abajo', 'derecha', 'turn', 'corner', 'indent'], d: turnArrow(mirrorX(turn(TURN, 180))) },
  'arrow-curve-right': { tags: ['curva', 'saltar', 'adelante', 'curve', 'skip', 'forward'], d: curveArrow(false) },
  'arrow-curve-left': { tags: ['curva', 'saltar', 'atrás', 'curve', 'skip', 'back'], d: curveArrow(true) },
  'undo': { tags: ['deshacer', 'regresar', 'atrás', 'undo', 'back'], d: uturn(UNDO) },
  'redo': { tags: ['rehacer', 'repetir', 'adelante', 'redo', 'forward'], d: uturn(mirrorX(UNDO)) },
  'history': {
    tags: ['historial', 'reciente', 'atrás en el tiempo', 'history', 'recent', 'back'],
    d: [HISTORY.d, head(HISTORY.end, HISTORY.tangent, 3.4), line([12, 7.75], [12, 12], [14.85, 13.75])],
  },

  // ── Double arrows and move ────────────────────────────────────────────────────────────
  'arrows-left-right': { tags: ['ancho', 'horizontal', 'ambos lados', 'arrows', 'left right', 'width'], d: [line([3.25, 12], [20.75, 12]), head([20.75, 12], [1, 0], 5 * R2), head([3.25, 12], [-1, 0], 5 * R2)] },
  'arrows-up-down': { tags: ['alto', 'vertical', 'ambos lados', 'arrows', 'up down', 'height'], d: [line([12, 3.25], [12, 20.75]), head([12, 3.25], [0, -1], 5 * R2), head([12, 20.75], [0, 1], 5 * R2)] },
  // Heads of 3 per axis: at 3.5, neighboring arms sat 2.5 apart and the cross read as a diamond.
  'move': {
    tags: ['mover', 'desplazar', 'cuatro direcciones', 'move', 'pan'],
    d: [line([3.25, 12], [20.75, 12]), line([12, 3.25], [12, 20.75]), ...[[20.75, 12], [3.25, 12], [12, 3.25], [12, 20.75]].map((t) => head(t, [t[0] - 12, t[1] - 12], 3 * R2))],
  },

  // ── Chevrons ──────────────────────────────────────────────────────────────────────────
  'chevron-up': { tags: ['subir', 'contraer', 'arriba', 'chevron', 'up', 'collapse'], d: [chev(-90)] },
  'chevron-down': { tags: ['bajar', 'desplegar', 'abajo', 'chevron', 'down', 'expand'], d: [chev(90)] },
  'chevrons-right': { tags: ['avanzar rápido', 'doble', 'derecha', 'chevrons', 'forward', 'next'], d: chev2(0) },
  'chevrons-left': { tags: ['regresar rápido', 'doble', 'izquierda', 'chevrons', 'rewind', 'previous'], d: chev2(180) },
  'chevrons-up': { tags: ['subir todo', 'doble', 'arriba', 'chevrons', 'up', 'top'], d: chev2(-90) },
  'chevrons-down': { tags: ['bajar todo', 'doble', 'abajo', 'chevrons', 'down', 'bottom'], d: chev2(90) },
  'chevron-up-down': { tags: ['selector', 'desplegable', 'elegir', 'select', 'dropdown', 'chevrons'], d: [line([7.75, 9.25], [12, 5], [16.25, 9.25]), line([7.75, 14.75], [12, 19], [16.25, 14.75])] },
  'chevron-left-right': { tags: ['deslizar', 'carrusel', 'anterior siguiente', 'chevrons', 'slide', 'horizontal'], d: [line([9.25, 7.25], [4.5, 12], [9.25, 16.75]), line([14.75, 7.25], [19.5, 12], [14.75, 16.75])] },
  'chevron-right-circle': { tags: ['siguiente', 'círculo', 'avanzar', 'chevron', 'circle', 'next'], d: [RING, chev(0, CHEV_IN)] },
  'chevron-left-circle': { tags: ['anterior', 'círculo', 'volver', 'chevron', 'circle', 'previous'], d: [RING, chev(180, CHEV_IN)] },
  'chevron-up-circle': { tags: ['subir', 'círculo', 'contraer', 'chevron', 'circle', 'up'], d: [RING, chev(-90, CHEV_IN)] },
  'chevron-down-circle': { tags: ['bajar', 'círculo', 'desplegar', 'chevron', 'circle', 'down'], d: [RING, chev(90, CHEV_IN)] },

  // ── Carets ────────────────────────────────────────────────────────────────────────────
  'caret-right': { tags: ['triángulo', 'derecha', 'disclosure', 'caret', 'triangle', 'right'], d: caret(0) },
  'caret-left': { tags: ['triángulo', 'izquierda', 'atrás', 'caret', 'triangle', 'left'], d: caret(180) },
  'caret-up': { tags: ['triángulo', 'arriba', 'contraer', 'caret', 'triangle', 'up'], d: caret(-90) },
  'caret-down': { tags: ['triángulo', 'abajo', 'desplegable', 'caret', 'triangle', 'dropdown'], d: caret(90) },
  'caret-up-down': {
    tags: ['ordenar', 'selector', 'triángulos', 'sort', 'caret', 'select'],
    d: [roundpoly([[7, 10.5], [12, 4], [17, 10.5]], [1.2, 1.4, 1.2]), roundpoly([[7, 13.5], [17, 13.5], [12, 20]], [1.2, 1.2, 1.4])],
  },

  // ── Pagination and sorting ────────────────────────────────────────────────────────────
  'page-first': { tags: ['primera página', 'inicio', 'paginación', 'first', 'page', 'start'], d: [line([6.5, 5.5], [6.5, 18.5]), line([17.5, 5.5], [11, 12], [17.5, 18.5])] },
  'page-last': { tags: ['última página', 'final', 'paginación', 'last', 'page', 'end'], d: [line([17.5, 5.5], [17.5, 18.5]), line([6.5, 5.5], [13, 12], [6.5, 18.5])] },
  'sort-ascending': { tags: ['ordenar', 'ascendente', 'menor a mayor', 'sort', 'ascending'], d: sortBars([3, 5, 7]) },
  'sort-descending': { tags: ['ordenar', 'descendente', 'mayor a menor', 'sort', 'descending'], d: sortBars([7, 5, 3]) },
  'sort': {
    tags: ['ordenar', 'orden', 'intercambiar vertical', 'sort', 'order', 'swap vertical'],
    d: [...arrow([8, 19.75], [8, 4.25], 3.75 * R2), ...arrow([16, 4.25], [16, 19.75], 3.75 * R2)],
  },
  'swap-horizontal': {
    tags: ['intercambiar', 'cambiar', 'transferir', 'swap', 'exchange', 'transfer'],
    d: [...arrow([4, 8], [20, 8], 4 * R2), ...arrow([20, 16], [4, 16], 4 * R2)],
  },

  // ── Size and fullscreen ───────────────────────────────────────────────────────────────
  'maximize': { tags: ['maximizar', 'agrandar', 'ampliar', 'maximize', 'enlarge'], d: out2(false) },
  'minimize': { tags: ['minimizar', 'reducir', 'achicar', 'minimize', 'shrink'], d: out2(true) },
  'expand-vertical': { tags: ['desplegar', 'expandir', 'mostrar todo', 'expand', 'unfold'], d: fold(true, 0) },
  'collapse-vertical': { tags: ['plegar', 'contraer', 'ocultar', 'collapse', 'fold'], d: fold(false, 0) },
  'expand-horizontal': { tags: ['ensanchar', 'expandir', 'ancho', 'expand', 'widen'], d: fold(true, 90) },
  'collapse-horizontal': { tags: ['estrechar', 'contraer', 'angosto', 'collapse', 'narrow'], d: fold(false, 90) },
  'fullscreen': { tags: ['pantalla completa', 'expandir', 'ver todo', 'fullscreen', 'expand'], d: brackets(false) },
  'fullscreen-exit': { tags: ['salir de pantalla completa', 'reducir', 'fullscreen', 'exit', 'shrink'], d: brackets(true) },
  'fit-screen': { tags: ['encajar', 'ajustar a pantalla', 'zoom', 'fit', 'screen'], d: [...brackets(false), sq(8.25, 8.25, 7.5, 7.5, 2.25, { square: ['br'] })] },

  // ── Sign in, sign out and links ───────────────────────────────────────────────────────
  'log-in': {
    tags: ['entrar', 'iniciar sesión', 'acceder', 'login', 'sign in'],
    d: [cline([[13.25, 3.25], [20.75, 3.25], [20.75, 20.75], [13.25, 20.75]], [0, 4.25, 0, 0]), ...arrow([3.25, 12], [14.75, 12], 4.5 * R2)],
  },
  'log-out': {
    tags: ['salir', 'cerrar sesión', 'logout', 'sign out', 'exit'],
    d: [cline([[10.75, 3.25], [3.25, 3.25], [3.25, 20.75], [10.75, 20.75]], [0, 4.25, 4.25, 0]), ...arrow([9.25, 12], [20.75, 12], 4.5 * R2)],
  },
  'external-link': {
    tags: ['enlace externo', 'abrir afuera', 'nueva pestaña', 'external', 'open', 'new tab'],
    d: [cline([[10.5, 5.25], [3.25, 5.25], [3.25, 20.75], [18.75, 20.75], [18.75, 13.5]], [0, 4, 4, 0, 0]), ...arrow([11, 13], [20.75, 3.25], 6.5)],
  },

  // ── Menus and handles ─────────────────────────────────────────────────────────────────
  'menu': { tags: ['menú', 'hamburguesa', 'navegación', 'menu', 'hamburger'], d: [6.5, 12, 17.5].map((y) => line([3.75, y], [20.25, y])) },
  'menu-compact': { tags: ['menú', 'dos líneas', 'asa', 'reordenar', 'menu', 'compact', 'drag handle'], d: [9.25, 14.75].map((y) => line([3.75, y], [20.25, y])) },
  'more-vertical': { tags: ['más', 'opciones', 'kebab', 'more', 'vertical'], d: [5, 12, 19].map((y) => dot(12, y, 0.8)) },
  'more-circle': { tags: ['más', 'opciones', 'círculo', 'more', 'circle'], d: [RING, ...[7.5, 12, 16.5].map((x) => dot(x, 12))] },
  'grip-vertical': { tags: ['arrastrar', 'asa', 'reordenar', 'grip', 'drag', 'handle'], d: [9.25, 14.75].flatMap((x) => [5.5, 12, 18.5].map((y) => dot(x, y, 0.8))) },
  'grip-horizontal': { tags: ['arrastrar', 'asa', 'reordenar', 'grip', 'drag', 'handle'], d: [9.25, 14.75].flatMap((y) => [5.5, 12, 18.5].map((x) => dot(x, y, 0.8))) },

  // ── Sidebars and panels ───────────────────────────────────────────────────────────────
  'sidebar-left': { tags: ['barra lateral', 'panel izquierdo', 'navegación', 'sidebar', 'left'], d: [WIN, line([9.25, 5], [9.25, 19])] },
  'sidebar-right': { tags: ['barra lateral', 'panel derecho', 'inspector', 'sidebar', 'right'], d: [WIN, line([14.75, 5], [14.75, 19])] },
  'panel-bottom': { tags: ['panel inferior', 'consola', 'abajo', 'panel', 'bottom'], d: [WIN, line([2.5, 14], [21.5, 14])] },
  'panel-top': { tags: ['panel superior', 'barra', 'arriba', 'panel', 'top', 'header'], d: [WIN, line([2.5, 10], [21.5, 10])] },
  'sidebar-collapse': { tags: ['ocultar barra lateral', 'cerrar panel', 'sidebar', 'collapse', 'hide'], d: [WIN, line([9.25, 5], [9.25, 19]), line([16.9, 9.25], [14.15, 12], [16.9, 14.75])] },
  'sidebar-expand': { tags: ['mostrar barra lateral', 'abrir panel', 'sidebar', 'expand', 'show'], d: [WIN, line([9.25, 5], [9.25, 19]), line([14.15, 9.25], [16.9, 12], [14.15, 14.75])] },
  'split-view': { tags: ['dividir', 'dos paneles', 'comparar', 'split', 'view', 'compare'], d: [WIN, line([12, 5], [12, 19])] },
  // One active tab open to the content and a strip for the others: a single divider (with two it
  // read as a labeled box).
  'tabs': { tags: ['pestañas', 'navegador', 'secciones', 'tabs', 'browser'], d: [WIN, line([11.25, 5], [11.25, 9.75], [21.5, 9.75])] },

  // ── Views ─────────────────────────────────────────────────────────────────────────────
  'view-grid': {
    tags: ['cuadrícula', 'mosaico', 'vista', 'grid', 'view', 'tiles'],
    d: [3.5, 10.25, 17].flatMap((y) => [3.5, 10.25, 17].map((x) => cell(x, y, x === 17 && y === 17))),
  },
  'view-list': { tags: ['lista', 'filas', 'vista', 'list', 'view', 'rows'], d: [3.5, 10.25, 17].flatMap((y) => [cell(3.5, y), line([10.25, y + 1.75], [20.5, y + 1.75])]) },
  'view-columns': { tags: ['columnas', 'tablero', 'vista', 'columns', 'view'], d: [SQUARE, line([9.1, 3.25], [9.1, 20.75]), line([14.9, 3.25], [14.9, 20.75])] },
  'view-cards': {
    tags: ['tarjetas', 'bloques', 'vista', 'cards', 'view', 'feed'],
    d: [sq(3.25, 3.25, 17.5, 7.25, 2.25), sq(3.25, 13.5, 17.5, 7.25, 2.25, { square: ['br'] })],
  },
  'view-carousel': {
    tags: ['carrusel', 'galería', 'deslizar', 'carousel', 'gallery', 'slides'],
    d: [sq(6.75, 4.25, 10.5, 15.5, 3, { square: ['br'] }), line([3.25, 7.5], [3.25, 16.5]), line([20.75, 7.5], [20.75, 16.5])],
  },

  // ── Filter, home and scroll ───────────────────────────────────────────────────────────
  'filter': {
    tags: ['filtro', 'embudo', 'filtrar', 'filter', 'funnel'],
    d: [roundpoly([[3.25, 4.75], [20.75, 4.75], [14, 12.25], [14, 19.75], [10, 19.75], [10, 12.25]], [1.75, 1.75, 1, 1, 1, 1])],
  },
  'filter-lines': { tags: ['filtro', 'filtrar', 'refinar', 'filter', 'refine'], d: [line([3.75, 6.5], [20.25, 6.5]), line([6.75, 12], [17.25, 12]), line([9.75, 17.5], [14.25, 17.5])] },
  'home': {
    tags: ['inicio', 'casa', 'principal', 'home', 'house'],
    d: [roundpoly([[12, 3], [20.25, 9.6], [20.25, 20.75], [3.75, 20.75], [3.75, 9.6]], [2.25, 1.5, 0, 2.5, 1.5]), cline([[10, 20.75], [10, 14.75], [14, 14.75], [14, 20.75]], [0, 1.25, 1.25, 0])],
  },
  // The mouse from Dispositivos, with its wheel and a scroll-down cue.
  'scroll': { tags: ['desplazar', 'ratón', 'rueda', 'scroll', 'mouse', 'wheel'], d: [capsule(6.5, 3, 11, 18), line([12, 6.75], [12, 9.25]), line([9.5, 13], [12, 15.5], [14.5, 13])] },

  // ── Pointer, drag and zoom ────────────────────────────────────────────────────────────
  'cursor': { tags: ['cursor', 'puntero', 'seleccionar', 'pointer', 'select', 'arrow'], d: [cursor([6.4, 2.9], 1)] },
  'cursor-click': {
    tags: ['clic', 'puntero', 'pulsar', 'click', 'pointer', 'tap'],
    // The engine's pointer and three rays 3.75 to 6 from its tip (their ends keep a 1.5 gap)
    d: [cursor([11, 8], 0.72), line([11, 4.25], [11, 2]), line([7.25, 8], [5, 8]), line([8.35, 5.35], [6.76, 3.76])],
  },
  'drag-drop': {
    tags: ['arrastrar y soltar', 'mover', 'seleccionar', 'drag', 'drop'],
    // The full box; the pointer goes in as a badge and the engine clears it with a 1.5 gap
    d: [sq(3.25, 3.25, 13, 13, 3.25)],
    badge: { d: [cursor([11.6, 9.4], 0.66)], knock: cursor([11.6, 9.4], 0.66), fill: { solid: [cursor([11.6, 9.4], 0.66)] } },
  },
  'crosshair': {
    tags: ['mira', 'apuntar', 'centrar', 'crosshair', 'target', 'focus'],
    d: [circ(12, 12, 6.75), line([12, 2.75], [12, 7.5]), line([12, 16.5], [12, 21.25]), line([2.75, 12], [7.5, 12]), line([16.5, 12], [21.25, 12])],
  },
  'zoom-in': { tags: ['acercar', 'ampliar', 'zoom', 'zoom in', 'magnify'], d: [...LENS, line([10.6, 7.85], [10.6, 13.35]), line([7.85, 10.6], [13.35, 10.6])] },
  'zoom-out': { tags: ['alejar', 'reducir', 'zoom', 'zoom out', 'magnify'], d: [...LENS, line([7.85, 10.6], [13.35, 10.6])] },

  // ── Coverage (round 2): window, layout, hand, search and filter ──────────────────────
  // The set's window (the one in `window-lock` and `page-not-found` from Sistema): the box with the
  // signature corner and its title bar.
  'browser': {
    tags: ['navegador', 'ventana', 'sitio web', 'página web', 'browser', 'window', 'web page'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), line([3.25, 7.75], [20.75, 7.75])],
  },
  // Layout: the same window with the sidebar below the header.
  'layout': {
    tags: ['diseño de página', 'plantilla', 'maqueta', 'estructura', 'layout', 'template', 'wireframe'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), line([3.25, 7.75], [20.75, 7.75]), line([9.25, 7.75], [9.25, 20.75])],
  },
  // Pointing hand (link, tap): a single closed outline. The index finger up (3 wide), the curled
  // fingers as a single knuckle (with two they read as teeth at 18 px), the palm, and the thumb
  // returning to the base of the index finger.
  'hand-pointer': {
    tags: ['mano', 'señalar', 'tocar', 'enlace', 'hand pointer', 'tap', 'touch'],
    d: ['M10.25 16V5a1.5 1.5 0 0 1 3 0V10.75a2.65 2.65 0 0 1 5.3 0V14.5c0 3.6-2.4 6.25-5.75 6.25h-1c-1.95 0-3.3-.9-4.3-2.45L6.1 15.4a1.4 1.4 0 0 1 2.3-1.6L10.25 16Z'],
  },
  // No results or clear search: the zoom magnifier with an x inside (like the plus and the minus).
  'search-x': {
    tags: ['sin resultados', 'borrar búsqueda', 'búsqueda vacía', 'no encontrado', 'no results', 'clear search', 'not found'],
    d: [...LENS, line([8.75, 8.75], [12.45, 12.45]), line([12.45, 8.75], [8.75, 12.45])],
  },
  // Clear filters: the `filter` funnel at 78 %, shifted up and to the left (like the bell in
  // Comunicación's badge icons), so the engine's close badge only takes the tip of the stem.
  'filter-x': {
    tags: ['quitar filtros', 'limpiar filtros', 'sin filtros', 'restablecer', 'clear filters', 'reset filters', 'remove filter'],
    d: [
      roundpoly(
        [[3.25, 4.75], [20.75, 4.75], [14, 12.25], [14, 19.75], [10, 19.75], [10, 12.25]].map(([x, y]) => [12 + (x - 12) * 0.78 - 2.25, 12 + (y - 12) * 0.78 - 2]),
        [1.75, 1.75, 1, 1, 1, 1].map((r) => r * 0.78),
      ),
    ],
    badge: badge('x'),
  },

  // ── Round 3: arrows leaving a bar, to and from a dot ─────────────────────────────────
  'arrow-up-from-line': { tags: ['subir desde', 'alejar del borde', 'redimensionar', 'arrow', 'up from line', 'n-resize'], d: fromLine(180) },
  'arrow-down-from-line': { tags: ['bajar desde', 'soltar', 'redimensionar', 'arrow', 'down from line', 's-resize'], d: fromLine(0) },
  'arrow-left-from-line': { tags: ['salir del panel', 'izquierda', 'redimensionar', 'arrow', 'left from line', 'w-resize'], d: fromLine(90) },
  'arrow-right-from-line': { tags: ['desde el borde', 'derecha', 'redimensionar', 'arrow', 'right from line', 'e-resize'], d: fromLine(-90) },
  'arrow-down-to-dot': { tags: ['soltar aquí', 'ir a no leídos', 'aterrizar', 'arrow', 'down to dot', 'drop here'], d: [...arrow(...DOT_ARROW, 5.5 * R2), DOT_UNDER] },
  'arrow-up-from-dot': { tags: ['despegar', 'lanzar', 'levantar', 'arrow', 'up from dot', 'launch'], d: [DOT_UNDER, ...arrow(DOT_ARROW[1], DOT_ARROW[0], 5.5 * R2)] },

  // ── Round 3: turns up and arrows into a corner ─────────────────────────────────────────
  'arrow-turn-right-up': { tags: ['girar', 'subir de nivel', 'promover', 'turn', 'right up', 'level up'], d: turnArrow(mirrorX(turn(TURN, -90))) },
  'arrow-turn-left-up': { tags: ['carpeta superior', 'subir un nivel', 'girar', 'turn', 'left up', 'parent folder'], d: turnArrow(turn(TURN, -90)) },
  'arrow-up-right-to-corner': { tags: ['a la esquina', 'acoplar', 'arriba derecha', 'arrow', 'corner', 'snap'], d: toCorner(0) },
  'arrow-down-right-to-corner': { tags: ['a la esquina', 'imagen en imagen', 'abajo derecha', 'arrow', 'corner', 'dock'], d: toCorner(90) },
  'arrow-down-left-to-corner': { tags: ['a la esquina', 'acoplar', 'abajo izquierda', 'arrow', 'corner', 'dock'], d: toCorner(180) },
  'arrow-up-left-to-corner': { tags: ['al inicio', 'insertar', 'arriba izquierda', 'arrow', 'corner', 'insert'], d: toCorner(-90) },

  // ── Round 3: in and out of a box ───────────────────────────────────────────────────────
  // Import: the share box with its arrow reversed, coming down through the opening (arms of 3.5).
  import: { tags: ['importar', 'traer', 'recibir', 'import', 'bring in', 'save to device'], d: [SHARE_BOX, ...arrow([12, 2.75], [12, 17], 3.5 * R2)] },
  // Pop in: external-link's frame with the arrow coming in from beyond the corner (arms of 5.5).
  'pop-in': {
    tags: ['acoplar', 'traer a la página', 'incrustar', 'pop in', 'embed', 'open in place'],
    d: [cline([[10.5, 5.25], [3.25, 5.25], [3.25, 20.75], [18.75, 20.75], [18.75, 13.5]], [0, 4, 4, 0, 0]), ...arrow([20.75, 3.25], [10, 14], 5.5)],
  },

  // ── Round 3: pairs that meet or part ───────────────────────────────────────────────────
  'arrows-merge': {
    tags: ['fusionar', 'combinar', 'unir', 'merge', 'combine', 'join'],
    d: [forkBranch(-1, 1, 11.75, 20.75, false), forkBranch(1, 1, 11.75, 20.75, false), line([12, 11.75], [12, 3.25]), head([12, 3.25], [0, -1], 4.5 * R2)],
  },
  // The heads at the corners need the junction lower: their inner arms stay 3 from the branches.
  'arrows-split': {
    tags: ['dividir', 'bifurcar', 'ramificar', 'split', 'fork', 'branch out'],
    d: [line([12, 20.75], [12, 13.5]), forkBranch(-1, -1, 13.5, 3.25, true), forkBranch(1, -1, 13.5, 3.25, true), head([6, 3.25], [0, -1], 3.75 * R2), head([18, 3.25], [0, -1], 3.75 * R2)],
  },
  'arrows-converge': { tags: ['converger', 'consolidar', 'enfocar', 'converge', 'consolidate', 'focus'], d: [...fan(false), dot(...FAN_DOT)] },
  'arrows-diverge': { tags: ['diverger', 'repartir', 'distribuir', 'diverge', 'fan out', 'distribute'], d: [dot(24 - FAN_DOT[0], 12), ...fan(true)] },
  // Resize along a diagonal: arrows-left-right on the 45° (one line, a head of 6 per axis at each end).
  'arrows-diagonal-up': {
    tags: ['redimensionar', 'diagonal', 'escalar', 'resize', 'nesw', 'diagonal'],
    d: [line([4, 20], [20, 4]), head([20, 4], [1, -1], 6), head([4, 20], [-1, 1], 6)],
  },
  'arrows-diagonal-down': {
    tags: ['redimensionar', 'diagonal', 'escalar', 'resize', 'nwse', 'diagonal'],
    d: [line([4, 4], [20, 20]), head([20, 20], [1, 1], 6), head([4, 4], [-1, -1], 6)],
  },

  // ── Round 3: turning and looping ───────────────────────────────────────────────────────
  'rotate-3d': { tags: ['rotar en 3d', 'girar', 'vista 360', 'rotate 3d', 'orbit', '360 view'], d: ORBIT },
  'arrow-loop': { tags: ['bucle', 'iterar', 'repetir hasta', 'loop', 'iterate', 'repeat'], d: LOOP },
  'arrow-bounce': {
    tags: ['rebote', 'tasa de rebote', 'rebotar', 'bounce', 'bounce rate', 'ricochet'],
    d: [rline(BOUNCE, BOUNCE_R), head(BOUNCE[2], [BOUNCE[2][0] - BOUNCE[1][0], BOUNCE[2][1] - BOUNCE[1][1]], 6), line([3.25, BOUNCE_GROUND], [20.75, BOUNCE_GROUND])],
  },
  'arrows-cycle': { tags: ['ciclo', 'ciclo de vida', 'recurrente', 'cycle', 'lifecycle', 'recurring'], d: [0, 120, 240].flatMap((deg) => CYCLE.map((p) => turnPath(p, deg))) },
  // Reset: history's arrow (the clock running back) around a dot instead of its hands.
  reset: { tags: ['restablecer', 'restaurar', 'empezar de nuevo', 'reset', 'restore defaults', 'start over'], d: [HISTORY.d, head(HISTORY.end, HISTORY.tangent, 3.4), dot(12, 12)] },

  // ── Round 3: pointer states ────────────────────────────────────────────────────────────
  // Busy: the pointer and sistema's loader (an open three-quarter ring) where a badge would go.
  'cursor-wait': { tags: ['ocupado', 'cargando', 'esperar', 'busy', 'wait', 'progress cursor'], d: [BADGE_PTR, arc(17.25, 17.25, 3.5, -90, 180).d] },
  'cursor-block': { tags: ['no permitido', 'prohibido', 'no soltar', 'not allowed', 'no drop', 'forbidden'], d: [BADGE_PTR], badge: badge('block') },
  'cursor-question': { tags: ['ayuda', 'qué es esto', 'ayuda contextual', 'help cursor', 'what is this', 'help'], d: [BADGE_PTR], badge: badge('question') },
  'cursor-plus': { tags: ['copiar', 'soltar copia', 'agregar', 'copy cursor', 'add', 'drop copy'], d: [BADGE_PTR], badge: badge('plus') },
  // Hover: the pointer and two short trails behind it, parallel to its tail, 3.25 apart.
  'cursor-hover': {
    tags: ['pasar encima', 'hover', 'sobrevolar', 'mouse over', 'hover state', 'pointer'],
    d: [cursor([5.5, 3], 0.8), line([15.5, 15.5], [16.87, 18.83]), line([18.5, 14.25], [19.87, 17.58])],
  },
  // Double click: cursor-click's pointer and two arcs around its tip (3.5 and 6.5), one per click.
  'cursor-double-click': {
    tags: ['doble clic', 'abrir', 'pulsar dos veces', 'double click', 'open', 'double tap'],
    d: [cursor([11.25, 8.75], 0.68), arc(11.25, 8.75, 3.5, 180, 270).d, arc(11.25, 8.75, 6.5, 180, 270).d],
  },
  // Multiplayer: a smaller pointer up and to the left and a larger one in front, 3.2 apart. Overlapped,
  // one pointer's tail ran along the other's edge and the knockout left a sliver that came and went
  // with the weight; side by side both stay whole.
  'cursor-multiplayer': {
    tags: ['colaboradores', 'en vivo', 'presencia', 'multiplayer', 'collaborators', 'presence'],
    d: [cursor([3.25, 2.75], 0.55), cursor([12.75, 8.5], 0.68)],
  },
  // Select: three corners of a selection square (arms of 3, gaps of 3) and the pointer at the fourth.
  'cursor-select': {
    tags: ['seleccionar área', 'arrastrar selección', 'marco', 'select', 'marquee', 'drag select'],
    d: [
      cline([[4.5, 6.25], [4.5, 3.25], [7.5, 3.25]], [0, 1.5, 0]),
      cline([[10.5, 3.25], [13.5, 3.25], [13.5, 6.25]], [0, 1.5, 0]),
      cline([[4.5, 9.25], [4.5, 12.25], [7.5, 12.25]], [0, 1.5, 0]),
      cursor([13.5, 12.25], 0.48),
    ],
  },

  // ── Round 3: hands and mouse buttons ───────────────────────────────────────────────────
  'hand-grab': {
    tags: ['mano', 'agarrar', 'desplazar lienzo', 'grab', 'pan', 'open hand'],
    d: hand([7.5, 6.25, 6.75, 8.5], 11, [9.5, 18.25], [4.5, 13.75], -0.75),
  },
  // Grabbing: the fingers curl under and only their knuckles show above the palm, the thumb tucked in.
  // With the fingers barely shorter than hand-grab's, the two read as the same open hand at 18 px.
  'hand-grabbing': {
    tags: ['mano cerrada', 'arrastrando', 'agarrando', 'grabbing', 'dragging', 'closed hand'],
    d: hand([10.75, 10.25, 10.5, 11], 13.25, [9.5, 18.25], [6.75, 16], -3),
  },
  'mouse-left-click': { tags: ['clic izquierdo', 'botón principal', 'ratón', 'left click', 'primary button', 'mouse'], d: MOUSE },
  'mouse-right-click': { tags: ['clic derecho', 'botón secundario', 'menú contextual', 'right click', 'secondary button', 'mouse'], d: MOUSE.map((p) => flipPath(p)) },

  // ── Round 3: menus and trails ──────────────────────────────────────────────────────────
  // Context menu: a card with three rows and the pointer in front of its top-left corner. The pointer
  // stays clear of the card's left edge (its tail ran along it), so the knockout only crosses edges.
  'menu-context': {
    tags: ['menú contextual', 'clic derecho', 'acciones', 'context menu', 'right-click menu', 'actions'],
    d: [sq(8, 8, 12.75, 12.75, 3.25, { square: ['br'] }), ...[11.5, 14.5, 17.5].map((y) => line([12, y], [17, y]))],
    badge: { d: [cursor([3.25, 2.75], 0.52)], knock: cursor([3.25, 2.75], 0.52), fill: { solid: [cursor([3.25, 2.75], 0.52)] } },
  },
  // Submenu: `menu`'s three rows, the middle one ending in the chevron that marks an item with a submenu
  // (arms of 2.5, 3 from the rows around it and from its own row). Two cards side by side with an arrow
  // between them read as a phone and a battery: 24 px has no room for both menus with their rows.
  submenu: {
    tags: ['submenú', 'menú anidado', 'cascada', 'submenu', 'nested menu', 'flyout'],
    d: [line([3.75, 6.5], [20.25, 6.5]), line([3.75, 12], [14.75, 12]), line([17.75, 9.5], [20.25, 12], [17.75, 14.5]), line([3.75, 17.5], [20.25, 17.5])],
  },
  // Breadcrumb: three crumbs and the two chevrons between them. With bars for crumbs the clearances
  // left them 2 long and the trail read as a dashed arrow; dots keep each crumb whole.
  breadcrumb: {
    tags: ['migas de pan', 'ruta', 'jerarquía', 'breadcrumb', 'path', 'hierarchy'],
    d: [dot(3.25, 12), line([5.85, 9.5], [8.35, 12], [5.85, 14.5]), dot(12, 12), line([14.6, 9.5], [17.1, 12], [14.6, 14.5]), dot(20.75, 12)],
  },
  // ── Round 3: pages, scrolling and jumping ──────────────────────────────────────────────
  pagination: {
    tags: ['paginación', 'páginas', 'resultados', 'pagination', 'pages', 'pager'],
    d: [line([5.5, 9], [2.5, 12], [5.5, 15]), ...[8, 12, 16].map((x) => dot(x, 12)), line([18.5, 9], [21.5, 12], [18.5, 15])],
  },
  'pagination-dots': { tags: ['indicador de página', 'carrusel', 'diapositiva actual', 'page indicator', 'page control', 'carousel dots'], d: [pill(5, 10, 12), dot(14.5, 12, 0.4), dot(19, 12, 0.4)] },
  // Load more: three dots in a column running down into a chevron (arms of 4.5), the list going on below.
  // In a row above the chevron they made a smiley face, plain to see once enclosed in a circle.
  'load-more': { tags: ['cargar más', 'ver más', 'siguientes', 'load more', 'show more', 'more results'], d: [...[4, 8, 12].map((y) => dot(12, y)), line([7.5, 16.25], [12, 20.75], [16.5, 16.25])] },
  'infinite-scroll': {
    tags: ['scroll infinito', 'carga continua', 'feed', 'infinite scroll', 'endless feed', 'auto load'],
    d: [OPEN_FRAME, line([8.5, 7], [15.5, 7]), line([8.5, 10.25], [15.5, 10.25]), line([12, 13.25], [12, 19.25]), head([12, 19.25], [0, 1], 3 * R2)],
  },
  // The thumb near the top of the right edge and the up-down arrow centered in the space beside it.
  scrollbar: { tags: ['barra de desplazamiento', 'desplazar', 'contenido', 'scrollbar', 'scroll', 'overflow'], d: [WIN, ...twoWay([10.25, 8], [10.25, 16], 2.25), vpill(18.25, 8.25, 13.25)] },
  // The thumb near the start of the bottom edge and the left-right arrow centered above it.
  'scrollbar-horizontal': {
    tags: ['desplazamiento horizontal', 'tabla ancha', 'carrusel', 'horizontal scroll', 'scrollbar', 'wide table'],
    d: [WIN, ...twoWay([6.5, 10.25], [17.5, 10.25], 2.25), pill(6.25, 11.75, 15.75)],
  },
  'jump-to': {
    tags: ['saltar a', 'ir a la línea', 'ir a la sección', 'jump to', 'go to line', 'skip'],
    d: [JUMP.d, head(JUMP.end, JUMP.tangent, 3.4), ...[6, 12, 18].map((y) => line([12.25, y], [20.75, y]))],
  },

  // ── Round 3: tabs, filters and history ─────────────────────────────────────────────────
  // Tab bar: the portrait screen with the bar across its foot and three tabs as dots.
  'tab-bar': {
    tags: ['barra de pestañas', 'navegación inferior', 'app móvil', 'tab bar', 'bottom navigation', 'mobile app'],
    d: [PORTRAIT, line([4.75, 14.5], [19.25, 14.5]), ...[8, 12, 16].map((x) => dot(x, 17.75))],
  },
  'tabs-plus': { tags: ['nueva pestaña', 'abrir pestaña', 'agregar', 'new tab', 'add tab', 'open tab'], d: [WIN, line([11.25, 5], [11.25, 9.75], [21.5, 9.75])], badge: badge('plus') },
  // Vertical tabs: a column of three tabs; the chosen one runs on to meet the content.
  'tabs-vertical': {
    tags: ['pestañas verticales', 'secciones', 'navegación lateral', 'vertical tabs', 'side tabs', 'settings sections'],
    d: [WIN, line([11.5, 5], [11.5, 19]), line([6, 8.5], [8.5, 8.5]), line([6, 12], [11.5, 12]), line([6, 15.5], [8.5, 15.5])],
  },
  'filter-plus': { tags: ['agregar filtro', 'nuevo filtro', 'regla', 'add filter', 'new filter', 'filter rule'], d: [FUNNEL_B], badge: badge('plus') },
  // Clear history: history's arrow with the hands at ten, pivot at (11.5, 11.5), clear of the badge.
  'history-x': {
    tags: ['borrar historial', 'limpiar recientes', 'eliminar historial', 'clear history', 'delete history', 'clear recent'],
    d: [HISTORY.d, head(HISTORY.end, HISTORY.tangent, 3.4), line([11.5, 6.35], [11.5, 11.5], [8.2, 9.45])],
    badge: badge('x'),
  },

  // ── Round 3: collapse and expand panels ────────────────────────────────────────────────
  'panel-bottom-collapse': { tags: ['ocultar panel inferior', 'cerrar consola', 'terminal', 'hide bottom panel', 'collapse', 'console'], d: panelIcon('panel-bottom', true) },
  'panel-bottom-expand': { tags: ['mostrar panel inferior', 'abrir consola', 'terminal', 'show bottom panel', 'expand', 'console'], d: panelIcon('panel-bottom', false) },
  'panel-top-collapse': { tags: ['ocultar panel superior', 'contraer cabecera', 'barra', 'hide top panel', 'collapse', 'header'], d: panelIcon('panel-top', true) },
  'panel-top-expand': { tags: ['mostrar panel superior', 'expandir cabecera', 'barra', 'show top panel', 'expand', 'header'], d: panelIcon('panel-top', false) },
  'sidebar-right-collapse': { tags: ['ocultar inspector', 'cerrar detalles', 'panel derecho', 'hide right sidebar', 'collapse', 'inspector'], d: panelIcon('sidebar-right', true) },
  'sidebar-right-expand': { tags: ['mostrar inspector', 'abrir detalles', 'panel derecho', 'show right sidebar', 'expand', 'inspector'], d: panelIcon('sidebar-right', false) },

  // ── Round 3: views ─────────────────────────────────────────────────────────────────────
  // Masonry: two columns of tiles, tall and short swapped between them (3 apart, radius 2).
  'view-masonry': {
    tags: ['mampostería', 'galería', 'mosaico irregular', 'masonry', 'gallery', 'pinterest grid'],
    d: [sq(3.25, 3.25, 7.25, 10, 2), sq(13.5, 3.25, 7.25, 4.5, 2), sq(3.25, 16.25, 7.25, 4.5, 2), sq(13.5, 10.75, 7.25, 10, 2, { square: ['br'] })],
  },
  // Thumbnails: the large preview and a strip of three cells (3.75, view-grid's kind) beneath it.
  'view-thumbnails': {
    tags: ['miniaturas', 'galería', 'vista previa', 'thumbnails', 'gallery', 'filmstrip'],
    d: [sq(3.25, 3.25, 17.5, 10.5, 3), ...[3.25, 10.13, 17].map((x) => sq(x, 17, 3.75, 3.75, 1.1, { square: x === 17 ? ['br'] : [] }))],
  },
  // Stack: a card and the edges of two more behind it, above it, 2 and 3.5 narrower per side and 3 apart
  // (Apple's rectangle.stack). With the edges below, the card read as a monitor on its stand.
  'view-stack': {
    tags: ['pila', 'tarjetas apiladas', 'notificaciones', 'stack', 'card stack', 'deck'],
    d: [sq(3.25, 9.25, 17.5, 11.5, 3.25, { square: ['br'] }), line([5.25, 6.25], [18.75, 6.25]), line([6.75, 3.25], [17.25, 3.25])],
  },
  // view-carousel turned: the card lies landscape and its neighbors show above and below.
  'view-carousel-vertical': {
    tags: ['carrusel vertical', 'feed', 'deslizar', 'vertical carousel', 'swipe feed', 'reels'],
    d: [sq(4.25, 6.75, 15.5, 10.5, 3, { square: ['br'] }), line([7.5, 3.25], [16.5, 3.25]), line([7.5, 20.75], [16.5, 20.75])],
  },
  // Resize grip: grip-vertical's dots (r 0.8) in a triangle, three, two and one toward the corner.
  'grip-diagonal': {
    tags: ['asa de redimensión', 'esquina', 'redimensionar', 'resize grip', 'resize handle', 'corner'],
    d: [[6.5, 17.5], [12, 12], [17.5, 6.5], [12, 17.5], [17.5, 12], [17.5, 17.5]].map(([x, y]) => dot(x, y, 0.8)),
  },
  // Zoom to selection: fullscreen's corners around a magnifier (lens r 3.5).
  'zoom-selection': {
    tags: ['zoom a la selección', 'encuadrar', 'acercar selección', 'zoom to selection', 'zoom to fit', 'frame selection'],
    d: [...brackets(false), circ(11, 11, 3.5), line(polar(11, 11, 3.5, 45), [16.25, 16.25])],
  },
  'fit-width': { tags: ['ajustar al ancho', 'ancho completo', 'escalar', 'fit width', 'full width', 'scale'], d: fit(0) },
  'fit-height': { tags: ['ajustar al alto', 'alto completo', 'escalar', 'fit height', 'full height', 'scale'], d: fit(90) },
};

// ── Fill (DESIGN.md › Fill): indices into `d` that are filled, knocked out or stay as lines.
// Arrows, chevrons and menus made only of open lines get no fill.
const FILL = {
  'more-vertical': { solid: [0, 1, 2] },
  'more-circle': { solid: [0], cut: [1, 2, 3] },
  'grip-vertical': { solid: [0, 1, 2, 3, 4, 5] },
  'grip-horizontal': { solid: [0, 1, 2, 3, 4, 5] },
  'caret-right': { solid: [0] },
  'caret-left': { solid: [0] },
  'caret-up': { solid: [0] },
  'caret-down': { solid: [0] },
  'caret-up-down': { solid: [0, 1] },
  'arrow-thick-right': { solid: [0] },
  'arrow-thick-left': { solid: [0] },
  'arrow-thick-up': { solid: [0] },
  'arrow-thick-down': { solid: [0] },
  'fit-screen': { solid: [4], lines: [0, 1, 2, 3] },
  'sidebar-left': { solid: [0], cut: [1] },
  'sidebar-right': { solid: [0], cut: [1] },
  'panel-bottom': { solid: [0], cut: [1] },
  'panel-top': { solid: [0], cut: [1] },
  'sidebar-collapse': { solid: [0], cut: [1, 2] },
  'sidebar-expand': { solid: [0], cut: [1, 2] },
  'split-view': { solid: [0], cut: [1] },
  'tabs': { solid: [0], cut: [1] },
  // Browser window and layout: the solid box with the header (and the sidebar) knocked out.
  'browser': { solid: [0], cut: [1] },
  'layout': { solid: [0], cut: [1, 2] },
  'view-grid': { solid: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  'view-list': { solid: [0, 2, 4], lines: [1, 3, 5] },
  'view-columns': { solid: [0], cut: [1, 2] },
  'view-cards': { solid: [0, 1] },
  'view-carousel': { solid: [0], lines: [1, 2] },
  'filter': { solid: [0] },
  // Clear filters: the solid funnel; the engine's badge brings its own fill (solid circle, knocked-out x).
  'filter-x': { solid: [0] },
  'home': { solid: [0], cut: [1] },
  'scroll': { solid: [0], cut: [1, 2] },
  'cursor': { solid: [0] },
  'cursor-click': { solid: [0], lines: [1, 2, 3] },
  'drag-drop': { solid: [0] },
  'hand-pointer': { solid: [0] },
  // Filled crosshair: the solid disc and the four ticks that stick out, flush with it (wire: they're
  // open lines; the inner part merges with the disc).
  'crosshair': { solid: [0], wire: [1, 2, 3, 4] },
  // Round 3. Pointers solid with their marks as lines; a badge brings its own fill (the front pointer
  // too); the hands as the raised hand; cards, frames and windows with their details knocked out.
  'cursor-wait': { solid: [0], lines: [1] },
  'cursor-block': { solid: [0] },
  'cursor-question': { solid: [0] },
  'cursor-plus': { solid: [0] },
  'cursor-hover': { solid: [0], lines: [1, 2] },
  'cursor-double-click': { solid: [0], lines: [1, 2] },
  'cursor-multiplayer': { solid: [0, 1] },
  'cursor-select': { solid: [3], lines: [0, 1, 2] },
  'hand-grab': { solid: [0], cut: [1, 2, 3] },
  'hand-grabbing': { solid: [0], cut: [1, 2, 3] },
  'mouse-left-click': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
  'mouse-right-click': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
  'menu-context': { solid: [0], cut: [1, 2, 3] },
  scrollbar: { solid: [0], cut: [1, 2, 3, 4] },
  'scrollbar-horizontal': { solid: [0], cut: [1, 2, 3, 4] },
  'tab-bar': { solid: [0], cut: [1, 2, 3, 4] },
  'tabs-plus': { solid: [0], cut: [1] },
  'tabs-vertical': { solid: [0], cut: [1, 2, 3, 4] },
  'filter-plus': { solid: [0] },
  'view-masonry': { solid: [0, 1, 2, 3] },
  'view-thumbnails': { solid: [0, 1, 2, 3] },
  'view-stack': { solid: [0], lines: [1, 2] },
  'view-carousel-vertical': { solid: [0], lines: [1, 2] },
  'grip-diagonal': { solid: [0, 1, 2, 3, 4, 5] },
  'zoom-selection': { solid: [4], lines: [0, 1, 2, 3], wire: [5] },
};
for (const name of ['panel-bottom', 'panel-top', 'sidebar-right']) for (const v of ['collapse', 'expand']) FILL[`${name}-${v}`] = { solid: [0], cut: [1, 2] };
for (const name of ['right', 'left', 'up', 'down', 'up-right', 'down-right', 'down-left', 'up-left'])
  for (const form of ['circle', 'square']) FILL[`arrow-${name}-${form}`] = { solid: [0], cut: [1, 2] };
for (const name of ['right', 'left', 'up', 'down']) FILL[`chevron-${name}-circle`] = { solid: [0], cut: [1] };
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = {
    solid: pick(spec.solid),
    ...(spec.cut && { cut: pick(spec.cut) }),
    ...(spec.lines && { lines: pick(spec.lines) }),
    ...(spec.wire && { wire: pick(spec.wire) }),
  };
}
// Open lines only (arrows, chevrons, menus, corners) and the magnifiers, like Núcleo's search: their
// filled version is the outline itself.
for (const icon of Object.values(icons)) if (icon.fill === undefined) icon.fill = false;
// Round 3. Import, like Edición's share: the box closes along its lid and fills; the arrow stays a
// line, apart from it.
icons.import.fill = { solid: [`${SHARE_BOX}Z`], lines: icons.import.d.slice(1) };
// Infinite scroll: the frame closes along the bottom it runs off; its lines and arrow are knocked out.
icons['infinite-scroll'].fill = { solid: [`${OPEN_FRAME}Z`], cut: icons['infinite-scroll'].d.slice(1) };

// ── 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough ──
// A custom drawing isn't snapped for you: its straight runs sit on pixel centers (0.75 + 1.5k) and
// its 45° diagonals pass through pixel centers (x ± y a multiple of 1.5), so they land crisp, not gray.
// The grid: once snapped, the 3.5 cells came out at 2, 3 and 2 px and the middle one smeared.
// Three equal 3 px cells (4.5) with 1 px of space between them.
{
  const at = [2.25, 9.75, 17.25];
  const d = at.flatMap((y) => at.map((x) => sq(x, y, 4.5, 4.5, 1.25, { square: x === 17.25 && y === 17.25 ? ['br'] : [] })));
  icons['view-grid'].small = { d, fill: { solid: d } };
}
// Dots: centered on pixel edges (multiples of 1.5) so each dot lands fully on 2 × 2 pixels and
// doesn't merge with its neighbor. At r 1: at r 0.7–0.8 the dot turns gray (≈ 50 %).
const SMALL_DOT = 1;
const dotsSmall = (pts) => {
  const d = pts.map(([x, y]) => dot(x, y, SMALL_DOT));
  return { d, fill: { solid: d } };
};
icons['more-vertical'].small = dotsSmall([4.5, 12, 19.5].map((y) => [12, y]));
icons['grip-vertical'].small = dotsSmall([9, 15].flatMap((x) => [6, 12, 18].map((y) => [x, y])));
icons['grip-horizontal'].small = dotsSmall([9, 15].flatMap((y) => [6, 12, 18].map((x) => [x, y])));
// More in a circle: the same 2 × 2 px dots, 1 px apart; knocked out in the filled version.
{
  const dots = [7.5, 12, 16.5].map((x) => dot(x, 12, SMALL_DOT));
  icons['more-circle'].small = { d: [RING, ...dots], fill: { solid: [RING], cut: dots } };
}
// List view: once snapped, the middle cell measured 4 px and the others 3, and it read as a
// zero. Equal 3 × 3 px bullets and rows on pixel centers, with 1 px of space between them.
{
  const ys = [2.25, 9.75, 17.25];
  const cells = ys.map((y) => sq(2.25, y, 3, 3, 0.6));
  const rows = ys.map((y) => line([9.75, y + 1.5], [20.25, y + 1.5]));
  icons['view-list'].small = { d: cells.flatMap((c, i) => [c, rows[i]]), fill: { solid: cells, lines: rows } };
}
// Pointers: the engine's pointer with its tip on a pixel center, so its vertical edge and its 45°
// diagonal land crisp (shifted less than 0.7; the scale doesn't change).
{
  const p = cursor([6.75, 2.25], 1);
  icons.cursor.small = { d: [p], fill: { solid: [p] } };
}
{
  const p = cursor([11.25, 8.25], 0.72);
  const rays = [line([11.25, 3.75], [11.25, 2.25]), line([6.75, 8.25], [5.25, 8.25]), line([8.25, 5.25], [6.75, 3.75])];
  icons['cursor-click'].small = { d: [p, ...rays], fill: { solid: [p], lines: rays } };
}
{
  const box = sq(3.75, 3.75, 12, 12, 3);
  const p = cursor([11.25, 9.75], 0.66);
  icons['drag-drop'].small = { d: [box], fill: { solid: [box] }, badge: { d: [p], knock: p, fill: { solid: [p] } } };
}
// The two carets: at 16 px the filled triangles touched; bases on pixel centers with 2 px of
// space between them.
{
  const d = [roundpoly([[7.5, 9.75], [12, 4.5], [16.5, 9.75]], [1, 1.2, 1]), roundpoly([[7.5, 14.25], [16.5, 14.25], [12, 19.5]], [1, 1, 1.2])];
  icons['caret-up-down'].small = { d, fill: { solid: d } };
}
// Scroll: at 16 px the wheel and the chevron read as a face; the wheel becomes the shaft of a
// downward arrow (arms of 2.25: a 3 gap to each side of the capsule).
{
  const body = capsule(6.5, 3, 11, 18);
  const shaft = line([12, 6.75], [12, 15.75]);
  const tip = head([12, 15.75], [0, 1], 2.25 * R2);
  icons.scroll.small = { d: [body, shaft, tip], fill: { solid: [body], cut: [shaft, tip] } };
}
// The two-chevron selectors: their 4.25 arms fell between pixels and looked gray and faint.
// Arms of 4.5 (3 px) through pixel centers and 4 px of space between the two.
icons['chevron-up-down'].small = { d: [line([7.5, 9], [12, 4.5], [16.5, 9]), line([7.5, 15], [12, 19.5], [16.5, 15])] };
icons['chevron-left-right'].small = { d: [line([9, 7.5], [4.5, 12], [9, 16.5]), line([15, 7.5], [19.5, 12], [15, 16.5])] };
// The large chevrons have no straight runs for snapping to move, and their diagonals fell 1/3 of a
// pixel off the centers: at 16 px they didn't have a single full pixel. Their 45° diagonals run
// through pixel centers (x ± y a multiple of 1.5), with the tip on a pixel corner, like the
// selectors above. `vee(tip, arm)` points right and is rotated with chev().
const vee = (x0, a) => [[x0 - a, 12 - a], [x0, 12], [x0 - a, 12 + a]];
// Single: the same chevron as at 24 (arms of 6.75), shifted 0.5 toward where it points.
const CHEV16 = vee(16.5, 6.75);
icons['chevron-up'].small = { d: [chev(-90, CHEV16)] };
icons['chevron-down'].small = { d: [chev(90, CHEV16)] };
// Doubles: arms of 5.25, set 6 apart (4 px) instead of 5.5, so both land on the grid without the
// gray that joined them.
for (const [n, deg] of [['right', 0], ['left', 180], ['up', -90], ['down', 90]])
  icons[`chevrons-${n}`].small = { d: [vee(12, 5.25), vee(18, 5.25)].map((pts) => chev(deg, pts)) };
// In a circle: arms of 4.5 (3 px); the chevron is knocked out of the fill, as at 24.
for (const [n, deg] of [['right', 0], ['left', 180], ['up', -90], ['down', 90]]) {
  const chevron = chev(deg, vee(15, 4.5));
  icons[`chevron-${n}-circle`].small = { d: [RING, chevron], fill: { solid: [RING], cut: [chevron] } };
}
// First and last page: the bar and the chevron at the same height (13.5), on pixel centers, with
// 1.5 px of space between the bar and the tip; the whole thing stays centered.
icons['page-first'].small = { d: [line([6.75, 5.25], [6.75, 18.75]), line([17.25, 5.25], [10.5, 12], [17.25, 18.75])] };
icons['page-last'].small = { d: [line([17.25, 5.25], [17.25, 18.75]), line([6.75, 5.25], [13.5, 12], [6.75, 18.75])] };
// Crosshair: snapping moved the ticks to 12.75 while the ring stayed at 12, so it looked off-center
// and gray. All of it centered on one pixel (11.25): the same ring and four ticks, which reach in 2.25
// as at 24 and stick out 0.25 less to stay inside the live area.
{
  const c = 11.25;
  const ring = circ(c, c, 6.75);
  const ticks = [line([c, c - 9], [c, c - 4.5]), line([c, c + 4.5], [c, c + 9]), line([c - 9, c], [c - 4.5, c]), line([c + 4.5, c], [c + 9, c])];
  icons.crosshair.small = { d: [ring, ...ticks], fill: { solid: [ring], wire: ticks } };
}
// Expand and collapse: the same small chevrons, gray at 16 px. The fold on a pixel center (12.75,
// where snapping puts it) and 3 px chevrons symmetric around it, with 2 px of space.
const foldSmall = (open, deg) => {
  const ch = open
    ? [[[7.5, 9], [12, 4.5], [16.5, 9]], [[7.5, 16.5], [12, 21], [16.5, 16.5]]]
    : [[[7.5, 4.5], [12, 9], [16.5, 4.5]], [[7.5, 21], [12, 16.5], [16.5, 21]]];
  return { d: [line(...turn([[3.75, 12.75], [20.25, 12.75]], deg)), ...ch.map((pts) => line(...turn(pts, deg)))] };
};
icons['expand-vertical'].small = foldSmall(true, 0);
icons['collapse-vertical'].small = foldSmall(false, 0);
icons['expand-horizontal'].small = foldSmall(true, 90);
icons['collapse-horizontal'].small = foldSmall(false, 90);
// Collapse and expand the sidebar: the 2.75 chevron turned into a 2-pixel smudge. The window on
// pixel centers and a 3 × 6 px chevron, centered in the panel with 1 px of space.
{
  const win = sq(2.25, 5.25, 19.5, 13.5, 4, { square: ['br'] });
  const divider = line([9.75, 5.25], [9.75, 18.75]);
  for (const [name, pts] of [
    ['sidebar-collapse', [[18, 7.5], [13.5, 12], [18, 16.5]]],
    ['sidebar-expand', [[13.5, 7.5], [18, 12], [13.5, 16.5]]],
  ]) {
    const chevron = line(...pts);
    icons[name].small = { d: [win, divider, chevron], fill: { solid: [win], cut: [divider, chevron] } };
  }
}
// No results: the 3.7 x smeared into a smudge inside the magnifier (and a 4 × 4 px one read as a
// square: its center is 2 × 2). A 5 × 5 px x with a single pixel at its center, in a magnifier of
// r 7.5 centered on that pixel, with a 1.75 gap to the ring.
icons['search-x'].small = {
  d: [circ(9.75, 9.75, 7.5), line([15.25, 15.25], [20.25, 20.25]), line([6.75, 6.75], [12.75, 12.75]), line([12.75, 6.75], [6.75, 12.75])],
};
// Clear filters: the close badge (a 5.7 px circle) doesn't fit at 16 px and its x turned into a
// gray square. The funnel on pixel centers and, instead of the badge, a 5 × 5 px x that the engine
// clears the same way (with 1 px of space to the stem).
{
  const funnel = roundpoly([[2.25, 3.75], [17.25, 3.75], [11.25, 9.75], [11.25, 15.75], [8.25, 15.75], [8.25, 9.75]], [1.1, 1.1, 0.75, 0.6, 0.6, 0.75]);
  const x = [line([14.25, 14.25], [20.25, 20.25]), line([20.25, 14.25], [14.25, 20.25])];
  icons['filter-x'].small = { d: [funnel], fill: { solid: [funnel] }, badge: { d: x, knock: x.join(''), fill: { solid: x } } };
}

// Round 3. Panels: the sidebar's pixel window and its 3 × 6 px chevron, 1 px from the edges, for the
// bottom and top panels and the right sidebar (toward the panel to collapse, away to expand).
{
  const win = sq(2.25, 5.25, 19.5, 13.5, 4, { square: ['br'] });
  const PANEL16 = {
    'panel-bottom': [line([2.25, 14.25], [21.75, 14.25]), [[7.5, 7.5], [12, 12], [16.5, 7.5]], [[7.5, 12], [12, 7.5], [16.5, 12]]],
    'panel-top': [line([2.25, 9.75], [21.75, 9.75]), [[7.5, 16.5], [12, 12], [16.5, 16.5]], [[7.5, 12], [12, 16.5], [16.5, 12]]],
    'sidebar-right': [line([14.25, 5.25], [14.25, 18.75]), [[6, 7.5], [10.5, 12], [6, 16.5]], [[10.5, 7.5], [6, 12], [10.5, 16.5]]],
  };
  for (const [name, [divider, collapse, expand]] of Object.entries(PANEL16))
    for (const [v, pts] of [['collapse', collapse], ['expand', expand]]) {
      const chevron = line(...pts);
      icons[`${name}-${v}`].small = { d: [win, divider, chevron], fill: { solid: [win], cut: [divider, chevron] } };
    }
}
// Arrows into a corner: the bracket on pixel centers and the diagonal through them, the head 2 px
// inside the bracket.
{
  const L = [[12.75, 3.75], [20.25, 3.75], [20.25, 11.25]];
  const A = [[5.25, 18.75], [17.25, 6.75]];
  for (const [n, deg] of [['up-right', 0], ['down-right', 90], ['down-left', 180], ['up-left', -90]]) {
    const pts = turn(L, deg);
    const br = pts[1][0] > 12 && pts[1][1] > 12;
    icons[`arrow-${n}-to-corner`].small = { d: [cline(pts, [0, br ? 0 : 2.25, 0]), ...arrow(...turn(A, deg), 6)] };
  }
}
// Dots on 2 × 2 px (centers on pixel edges) and chevrons whose tips are two pixels tall, so they
// center on the dots: the trail, the pages, load more and the grip.
{
  const flat = (x, s) => line([x - s * 1.5, 9.75], [x, 11.25], [x, 12.75], [x - s * 1.5, 14.25]);
  icons.breadcrumb.small = { d: [dot(3, 12, SMALL_DOT), flat(8.25, 1), dot(12, 12, SMALL_DOT), flat(17.25, 1), dot(21, 12, SMALL_DOT)] };
  icons.pagination.small = { d: [flat(2.25, -1), ...[7.5, 12, 16.5].map((x) => dot(x, 12, SMALL_DOT)), flat(21.75, 1)] };
  // Load more: the column 3 px apart (1 px between dots; at 4 they ran together into an exclamation mark)
  icons['load-more'].small = { d: [...[4.5, 9, 13.5].map((y) => dot(12, y, SMALL_DOT)), line([7.5, 16.5], [12, 21], [16.5, 16.5])] };
  icons['grip-diagonal'].small = dotsSmall([[6, 18], [12, 12], [18, 6], [12, 18], [18, 12], [18, 18]]);
}
// Submenu: the rows 4 px apart on pixel centers and a chevron with 2 px arms, 1 px clear of the rows
// around it and of its own row (at 24 its 2.5 arms fell between pixels).
icons.submenu.small = { d: [line([3.75, 5.25], [20.25, 5.25]), line([3.75, 11.25], [14.25, 11.25]), line([17.25, 8.25], [20.25, 11.25], [17.25, 14.25]), line([3.75, 17.25], [20.25, 17.25])] };
// Scrollbars: the sidebar's pixel window; the thumb a solid bar 2 px thick (a pill of half-width 0.75
// between two rows of pixel centers) and the double arrow with 1 px arms, each 1 px clear of the rest.
{
  const win = sq(2.25, 5.25, 19.5, 13.5, 4, { square: ['br'] });
  const two = (a, b) => [line(a, b), head(a, [a[0] - b[0], a[1] - b[1]], 1.5 * R2), head(b, [b[0] - a[0], b[1] - a[1]], 1.5 * R2)];
  const v = [...two([9.75, 8.25], [9.75, 15.75]), vpill(18, 9, 12, 0.75)];
  const h = [...two([6.75, 9.75], [17.25, 9.75]), pill(6.75, 11.25, 15, 0.75)];
  icons.scrollbar.small = { d: [win, ...v], fill: { solid: [win], cut: v } };
  icons['scrollbar-horizontal'].small = { d: [win, ...h], fill: { solid: [win], cut: h } };
}
// Bounce: the legs at 45° through pixel centers (the steeper ones at 24 fell between pixels and grayed the
// head), the head with 2 px arms, and the ground 1 px clear of the corner.
icons['arrow-bounce'].small = { d: [line([3.75, 6.75], [12, 15], [20.25, 6.75]), line([17.25, 6.75], [20.25, 6.75], [20.25, 9.75]), line([3.75, 18.75], [20.25, 18.75])] };
// Fit to width and height: the double arrow's heads (2 px arms) and the bars on pixel centers, 1 px apart;
// snapped, the 3.5 heads closed into a diamond.
{
  const fit16 = (deg) => {
    const [l1, l2, [a, b]] = [[[3.75, 6.75], [3.75, 18.75]], [[20.25, 6.75], [20.25, 18.75]], [[6.75, 12.75], [17.25, 12.75]]].map((ps) => turn(ps, deg));
    return { d: [line(...l1), line(...l2), line(a, b), head(a, [a[0] - b[0], a[1] - b[1]], 3 * R2), head(b, [b[0] - a[0], b[1] - a[1]], 3 * R2)] };
  };
  icons['fit-width'].small = fit16(0);
  icons['fit-height'].small = fit16(90);
}

// ── Mirroring (DESIGN.md › Mirroring): anything with a reading direction flips in RTL ──
for (const name of [
  'arrow-left', 'arrow-up-right', 'arrow-down-right', 'arrow-down-left', 'arrow-up-left',
  ...['right', 'left', 'up-right', 'down-right', 'down-left', 'up-left'].flatMap((n) => [`arrow-${n}-circle`, `arrow-${n}-square`]),
  'arrow-thick-right', 'arrow-thick-left', 'arrow-left-to-line', 'arrow-right-to-line',
  'arrow-turn-right', 'arrow-turn-left', 'arrow-turn-down-left', 'arrow-turn-down-right', 'arrow-curve-right', 'arrow-curve-left',
  'undo', 'redo', 'chevrons-right', 'chevrons-left', 'chevron-right-circle', 'chevron-left-circle', 'caret-right', 'caret-left',
  'page-first', 'page-last', 'sort-ascending', 'sort-descending', 'log-in', 'log-out', 'external-link',
  'sidebar-left', 'sidebar-right', 'sidebar-collapse', 'sidebar-expand', 'tabs', 'view-list', 'layout',
])
  icons[name].mirror = true;
// Round 3
for (const name of [
  'arrow-left-from-line', 'arrow-right-from-line', 'arrow-turn-right-up', 'arrow-turn-left-up',
  'arrow-up-right-to-corner', 'arrow-down-right-to-corner', 'arrow-down-left-to-corner', 'arrow-up-left-to-corner',
  'pop-in', 'arrows-converge', 'arrows-diverge', 'arrow-loop', 'arrow-bounce', 'submenu', 'breadcrumb', 'pagination-dots',
  'scrollbar', 'scrollbar-horizontal', 'jump-to', 'tabs-plus', 'tabs-vertical', 'sidebar-right-collapse', 'sidebar-right-expand', 'grip-diagonal',
])
  icons[name].mirror = true;

// ── Named parts (DESIGN.md › Named parts): what moves, changes state or is a badge.
// Vocabulary: `arrow` (shaft and head), `shape` (the enclosing circle or box, as in Núcleo's
// important), `chevron`, `caret`, `bar` (the line an arrow runs into), `window`.
const DIRS8 = ['right', 'left', 'up', 'down', 'up-right', 'down-right', 'down-left', 'up-left'];
const parts = (names, p) => {
  for (const n of names) icons[n].parts = p;
};
parts(DIRS8.filter((n) => n !== 'right').map((n) => `arrow-${n}`), { arrow: [0, 1] });
parts(DIRS8.flatMap((n) => [`arrow-${n}-circle`, `arrow-${n}-square`]), { shape: [0], arrow: [1, 2] });
parts(['right', 'left', 'up', 'down'].map((n) => `arrow-thick-${n}`), { arrow: [0] });
parts(['right', 'left', 'up', 'down'].map((n) => `arrow-${n}-to-line`), { bar: [0], arrow: [1, 2] });
parts(['arrow-turn-right', 'arrow-turn-left', 'arrow-turn-down-left', 'arrow-turn-down-right', 'arrow-curve-right', 'arrow-curve-left', 'undo', 'redo'], { arrow: [0, 1] });
parts(['history'], { arrow: [0, 1], hands: [2] });
// Each direction separately: the table lights up the active one
parts(['sort'], { up: [0, 1], down: [2, 3] });
parts(['swap-horizontal'], { right: [0, 1], left: [2, 3] });
parts(['sort-ascending', 'sort-descending'], { arrow: [0, 1], bars: [2, 3, 4] });
parts(['maximize', 'minimize'], { arrow: [0, 1, 2, 3] });
parts(['chevron-up', 'chevron-down'], { chevron: [0] });
// The back one and the front one (the one that points), to light them up one after the other
parts(['right', 'left', 'up', 'down'].map((n) => `chevrons-${n}`), { back: [0], front: [1] });
parts(['right', 'left', 'up', 'down'].map((n) => `chevron-${n}-circle`), { shape: [0], chevron: [1] });
parts(['chevron-up-down', 'caret-up-down'], { up: [0], down: [1] });
parts(['chevron-left-right'], { left: [0], right: [1] });
parts(['right', 'left', 'up', 'down'].map((n) => `caret-${n}`), { caret: [0] });
parts(['page-first', 'page-last'], { bar: [0], chevron: [1] });
parts(['fullscreen', 'fullscreen-exit'], { corners: [0, 1, 2, 3] });
parts(['fit-screen'], { corners: [0, 1, 2, 3], screen: [4] });
parts(['log-in', 'log-out'], { door: [0], arrow: [1, 2] });
parts(['external-link'], { frame: [0], arrow: [1, 2] });
parts(['more-circle'], { shape: [0], dots: [1, 2, 3] });
parts(['sidebar-left', 'sidebar-right', 'panel-bottom', 'panel-top', 'split-view'], { window: [0], divider: [1] });
parts(['sidebar-collapse', 'sidebar-expand'], { window: [0], divider: [1], chevron: [2] });
parts(['tabs'], { window: [0], tab: [1] });
parts(['browser'], { window: [0], header: [1] });
parts(['layout'], { window: [0], header: [1], sidebar: [2] });
parts(['filter', 'filter-x'], { funnel: [0] });
parts(['home'], { body: [0], door: [1] });
parts(['scroll'], { body: [0], wheel: [1], chevron: [2] });
parts(['cursor'], { pointer: [0] });
parts(['cursor-click'], { pointer: [0], rays: [1, 2, 3] });
parts(['drag-drop'], { box: [0] });
parts(['hand-pointer'], { hand: [0] });
parts(['crosshair'], { ring: [0], ticks: [1, 2, 3, 4] });
parts(['zoom-in', 'search-x'], { lens: [0], handle: [1], mark: [2, 3] });
parts(['zoom-out'], { lens: [0], handle: [1], mark: [2] });
// Round 3
parts(['up', 'down', 'left', 'right'].map((n) => `arrow-${n}-from-line`), { bar: [0], arrow: [1, 2] });
parts(['arrow-down-to-dot'], { arrow: [0, 1], dot: [2] });
parts(['arrow-up-from-dot'], { dot: [0], arrow: [1, 2] });
parts(['arrow-turn-right-up', 'arrow-turn-left-up'], { arrow: [0, 1] });
parts(['up-right', 'down-right', 'down-left', 'up-left'].map((n) => `arrow-${n}-to-corner`), { corner: [0], arrow: [1, 2] });
parts(['import'], { box: [0], arrow: [1, 2] });
parts(['pop-in'], { frame: [0], arrow: [1, 2] });
parts(['arrows-merge'], { branches: [0, 1], stem: [2, 3] });
parts(['arrows-split'], { stem: [0], branches: [1, 2, 3, 4] });
parts(['arrows-converge'], { arrows: [0, 1, 2, 3], dot: [4] });
parts(['arrows-diverge'], { dot: [0], arrows: [1, 2, 3, 4] });
parts(['arrows-diagonal-up', 'arrows-diagonal-down'], { arrow: [0, 1, 2] });
parts(['rotate-3d'], { orbit: [0, 1], axis: [2, 3] });
parts(['arrow-loop'], { arrow: [0, 1, 2] });
parts(['arrow-bounce'], { arrow: [0, 1], ground: [2] });
parts(['arrows-cycle'], { arrows: [0, 1, 2, 3, 4, 5] });
parts(['reset'], { arrow: [0, 1], dot: [2] });
parts(['cursor-wait'], { pointer: [0], spinner: [1] });
parts(['cursor-block', 'cursor-question', 'cursor-plus'], { pointer: [0] });
parts(['cursor-multiplayer'], { back: [0], front: [1] });
parts(['cursor-hover'], { pointer: [0], trails: [1, 2] });
parts(['cursor-double-click'], { pointer: [0], clicks: [1, 2] });
parts(['cursor-select'], { selection: [0, 1, 2], pointer: [3] });
parts(['hand-grab', 'hand-grabbing'], { hand: [0], fingers: [1, 2, 3] });
parts(['mouse-left-click', 'mouse-right-click'], { body: [0], seams: [1, 2], rays: [3, 4, 5] });
parts(['menu-context'], { card: [0], rows: [1, 2, 3] });
parts(['submenu'], { menu: [0, 1, 3], chevron: [2] });
parts(['breadcrumb'], { crumbs: [0, 2, 4], chevrons: [1, 3] });
parts(['pagination'], { previous: [0], pages: [1, 2, 3], next: [4] });
parts(['pagination-dots'], { current: [0], pages: [1, 2] });
parts(['load-more'], { dots: [0, 1, 2], chevron: [3] });
parts(['infinite-scroll'], { frame: [0], lines: [1, 2], arrow: [3, 4] });
parts(['scrollbar', 'scrollbar-horizontal'], { frame: [0], arrow: [1, 2, 3], thumb: [4] });
parts(['jump-to'], { arrow: [0, 1], lines: [2, 3, 4] });
parts(['tab-bar'], { frame: [0], bar: [1], tabs: [2, 3, 4] });
parts(['tabs-plus'], { window: [0], tab: [1] });
parts(['tabs-vertical'], { window: [0], divider: [1], tabs: [2, 3, 4] });
parts(['filter-plus'], { funnel: [0] });
parts(['history-x'], { arrow: [0, 1], hands: [2] });
parts(['panel-bottom', 'panel-top', 'sidebar-right'].flatMap((n) => [`${n}-collapse`, `${n}-expand`]), { window: [0], divider: [1], chevron: [2] });
parts(['view-masonry'], { tiles: [0, 1, 2, 3] });
parts(['view-thumbnails'], { preview: [0], thumbnails: [1, 2, 3] });
parts(['view-stack'], { card: [0], stack: [1, 2] });
parts(['view-carousel-vertical'], { card: [0], previous: [1], next: [2] });
parts(['grip-diagonal'], { dots: [0, 1, 2, 3, 4, 5] });
parts(['zoom-selection'], { corners: [0, 1, 2, 3], lens: [4], handle: [5] });
parts(['fit-width', 'fit-height'], { bars: [0, 1], arrow: [2, 3, 4] });

// ── Motion (DESIGN.md › Motion): arrows slide toward where they point ──
const DIR = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1], 'up-right': [0.8, -0.8], 'down-right': [0.8, 0.8], 'down-left': [-0.8, 0.8], 'up-left': [-0.8, -0.8] };
const slide = ([x, y], k, moving) => ({ effect: 'slide', vector: [x * k, y * k], ...(moving && { parts: moving }) });
for (const [n, v] of Object.entries(DIR)) {
  if (n !== 'right') icons[`arrow-${n}`].motion = slide(v, 2.5);
  icons[`arrow-${n}-circle`].motion = slide(v, 1.5, ['arrow']);
  icons[`arrow-${n}-square`].motion = slide(v, 1.5, ['arrow']);
}
for (const n of ['right', 'left', 'up', 'down']) {
  icons[`arrow-thick-${n}`].motion = slide(DIR[n], 2.5);
  icons[`arrow-${n}-to-line`].motion = slide(DIR[n], 2, ['arrow']);
  icons[`chevrons-${n}`].motion = slide(DIR[n], 2);
  icons[`chevron-${n}-circle`].motion = slide(DIR[n], 1.5, ['chevron']);
  icons[`caret-${n}`].motion = slide(DIR[n], 1.5);
}
for (const n of ['up', 'down']) icons[`chevron-${n}`].motion = slide(DIR[n], 2);
for (const [name, n] of [['arrow-turn-right', 'right'], ['arrow-turn-left', 'left'], ['arrow-turn-down-left', 'left'], ['arrow-turn-down-right', 'right'], ['arrow-curve-right', 'right'], ['arrow-curve-left', 'left'], ['undo', 'left'], ['redo', 'right']])
  icons[name].motion = slide(DIR[n], 2);
icons['page-first'].motion = slide(DIR.left, 2, ['chevron']);
icons['page-last'].motion = slide(DIR.right, 2, ['chevron']);
icons['log-in'].motion = slide(DIR.right, 2, ['arrow']);
icons['log-out'].motion = slide(DIR.right, 2, ['arrow']);
icons['external-link'].motion = slide(DIR['up-right'], 1.75, ['arrow']);
icons['sidebar-collapse'].motion = slide(DIR.left, 1.5, ['chevron']);
icons['sidebar-expand'].motion = slide(DIR.right, 1.5, ['chevron']);
icons.scroll.motion = slide(DIR.down, 1.5, ['chevron']);
icons['drag-drop'].motion = slide(DIR['down-right'], 1.75, ['badge']);
// Sort: the arrow moves down in the sort direction; the bars stay put
icons['sort-ascending'].motion = slide(DIR.down, 1.5, ['arrow']);
icons['sort-descending'].motion = slide(DIR.down, 1.5, ['arrow']);
// The hands spin (like Núcleo's clock); the click rays pulse from the tip.
icons.history.motion = { effect: 'spin', parts: ['hands'], origin: [12, 12] };
icons['cursor-click'].motion = { effect: 'beat', parts: ['rays'], origin: [11, 8] };
// Enlarge: the icon pulses from the center; fit: the screen grows inside its corners;
// zoom in: the plus grows inside the magnifier.
icons.maximize.motion = { effect: 'beat', origin: [12, 12] };
icons.fullscreen.motion = { effect: 'beat', origin: [12, 12] };
icons['fit-screen'].motion = { effect: 'beat', parts: ['screen'], origin: [12, 12] };
icons['zoom-in'].motion = { effect: 'beat', parts: ['mark'], origin: [10.6, 10.6] };
// No results: the magnifier shakes its head, swaying from the handle; the hand taps upward; the
// crosshair pulses as it locks on target.
icons['search-x'].motion = { effect: 'wiggle', origin: [20.5, 20.5] };
icons['hand-pointer'].motion = { effect: 'bounce', vector: [0, -1.5] };
icons.crosshair.motion = { effect: 'beat', origin: [12, 12] };
// Round 3: arrows slide away from their bar or dot and into their corner; import drops its arrow
// into the box, like download; the fork rises; the fan slides toward (or away from) its dot; the
// diagonal resize pulses, like maximize.
for (const n of ['up', 'down', 'left', 'right']) icons[`arrow-${n}-from-line`].motion = slide(DIR[n], 2, ['arrow']);
icons['arrow-down-to-dot'].motion = slide(DIR.down, 1.5, ['arrow']);
icons['arrow-up-from-dot'].motion = slide(DIR.up, 2, ['arrow']);
icons['arrow-turn-right-up'].motion = slide(DIR.up, 2);
icons['arrow-turn-left-up'].motion = slide(DIR.up, 2);
for (const n of ['up-right', 'down-right', 'down-left', 'up-left']) icons[`arrow-${n}-to-corner`].motion = slide(DIR[n], 1.5, ['arrow']);
icons.import.motion = { effect: 'bounce', parts: ['arrow'], vector: [0, 1.5] };
icons['pop-in'].motion = slide(DIR['down-left'], 1.75, ['arrow']);
icons['arrows-merge'].motion = slide(DIR.up, 1.5);
icons['arrows-split'].motion = slide(DIR.up, 1.5);
icons['arrows-converge'].motion = slide(DIR.right, 1.5, ['arrows']);
icons['arrows-diverge'].motion = slide(DIR.right, 1.5, ['arrows']);
icons['arrows-diagonal-up'].motion = { effect: 'beat', origin: [12, 12] };
icons['arrows-diagonal-down'].motion = { effect: 'beat', origin: [12, 12] };
// The loop runs on to the right; the bounce drops to its ground and back; the cycle turns (clockwise,
// as drawn); the spinner spins and the click arcs pulse from the tip, like cursor-click's rays; the
// mouse's rays pulse from its corner; trails and chevrons slide where they point; the zoom pulses.
icons['arrow-loop'].motion = slide(DIR.right, 2);
icons['arrow-bounce'].motion = { effect: 'bounce', parts: ['arrow'], vector: [0, 1.5] };
icons['arrows-cycle'].motion = { effect: 'spin', origin: [12, 12] };
icons['cursor-wait'].motion = { effect: 'spin', parts: ['spinner'], origin: [17.25, 17.25] };
icons['cursor-hover'].motion = slide([-0.4, -0.9], 1.5, ['pointer']);
icons['cursor-double-click'].motion = { effect: 'beat', parts: ['clicks'], origin: [11.25, 8.75] };
icons['cursor-select'].motion = slide(DIR['down-right'], 1.25, ['pointer']);
icons['mouse-left-click'].motion = { effect: 'beat', parts: ['rays'], origin: [14.25, 12.75] };
icons['mouse-right-click'].motion = { effect: 'beat', parts: ['rays'], origin: [9.75, 12.75] };
icons.submenu.motion = slide(DIR.right, 1.5, ['chevron']);
icons['load-more'].motion = slide(DIR.down, 1.5, ['chevron']);
icons['infinite-scroll'].motion = slide(DIR.down, 1.5, ['arrow']);
icons.scrollbar.motion = slide(DIR.down, 2.5, ['thumb']);
icons['scrollbar-horizontal'].motion = slide(DIR.right, 2.5, ['thumb']);
icons['history-x'].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 17.25] };
for (const [name, toward] of [['panel-bottom', 'down'], ['panel-top', 'up'], ['sidebar-right', 'right']]) {
  const away = { down: 'up', up: 'down', right: 'left' }[toward];
  icons[`${name}-collapse`].motion = slide(DIR[toward], 1.5, ['chevron']);
  icons[`${name}-expand`].motion = slide(DIR[away], 1.5, ['chevron']);
}
icons['zoom-selection'].motion = { effect: 'beat', parts: ['lens', 'handle'], origin: [12, 12] };
icons['fit-width'].motion = { effect: 'beat', parts: ['arrow'], origin: [12, 12] };
icons['fit-height'].motion = { effect: 'beat', parts: ['arrow'], origin: [12, 12] };

// ── Automatic variants (DESIGN.md › Automatic variants) ──
const off = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// The eight arrows already have hand-drawn circle and square versions.
off(['arrow-left', 'arrow-up', 'arrow-down', 'arrow-up-right', 'arrow-down-right', 'arrow-down-left', 'arrow-up-left'], { circle: false, square: false });
off(['chevron-up', 'chevron-down'], { circle: false });
// Already enclosed: no circle or square (a circle inside a box adds nothing).
off([...DIRS8.flatMap((n) => [`arrow-${n}-circle`, `arrow-${n}-square`]), 'chevron-right-circle', 'chevron-left-circle', 'chevron-up-circle', 'chevron-down-circle', 'more-circle'], { circle: false, square: false });
off(['history', 'crosshair'], { circle: false });
off(['view-columns', 'browser', 'layout'], { square: false });
// The 3 × 3 grid stops reading at 58 %; so do the badges (the x, the pointer), and the enclosed
// filled version doesn't draw them.
off(['view-grid', 'filter-x', 'drag-drop'], { circle: false, square: false });
// A slash through an arrow, a chevron or a lone line says nothing; neither does a slash through
// something that already negates (clear filters, no results).
off(
  Object.keys(icons).filter((n) => /^(arrow|arrows|chevron|chevrons|caret)-/.test(n)),
  { slash: false },
);
off(
  ['undo', 'redo', 'move', 'page-first', 'page-last', 'sort-ascending', 'sort-descending', 'sort', 'swap-horizontal', 'maximize', 'minimize', 'expand-vertical', 'collapse-vertical', 'expand-horizontal', 'collapse-horizontal', 'fullscreen', 'fullscreen-exit', 'fit-screen', 'log-in', 'log-out', 'external-link', 'menu', 'menu-compact', 'more-vertical', 'more-circle', 'grip-vertical', 'grip-horizontal', 'filter-lines', 'filter-x', 'search-x'],
  { slash: false },
);
// Round 3. Lone marks and pieces that already negate take no slash; enclosed or badged ones (and
// pieces that stop reading at 58 %: the pointers with their marks, the hands' fingers) no enclosure.
off(['pop-in', 'reset', 'submenu', 'breadcrumb', 'pagination', 'pagination-dots', 'load-more', 'jump-to', 'grip-diagonal', 'fit-width', 'fit-height'], { slash: false });
// A slash through a status badge says nothing, as across the set (and the spinner is no badge to slash)
off(['cursor-block', 'cursor-question', 'cursor-plus', 'cursor-wait', 'tabs-plus', 'filter-plus', 'history-x'], { slash: false });
off(['reset', 'history-x'], { circle: false });
off(['cursor-block', 'cursor-question', 'cursor-plus', 'cursor-wait', 'cursor-multiplayer', 'menu-context', 'tabs-plus', 'filter-plus', 'history-x'], { circle: false, square: false });
off(['zoom-selection', 'view-masonry', 'view-thumbnails'], { square: false });

export default { category: 'navegacion', label: 'Navegación', icons };
