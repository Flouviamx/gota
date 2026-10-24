// Calendario y tiempo (calendar and time): calendar views, events by kind and state, schedules,
// shifts, time tracking, clocks and watches by kind, countdowns. Everything is computed with
// engine/geometry.mjs; see DESIGN.md.
//
// One calendar and one clock for the whole family: the core `calendar` (18 × 16.25, radius 4,
// rings at 8 and 16, header at 9.75) and the core `clock` (r 9), as lugares already draws them for
// the icons this category adopts. A calendar's mark lives in its body, inside the band its day
// dots take (centerlines from 12.6 to 18.15, 2.85 from the header and from the bottom, and from
// 5.85 to 18.15 across). A mark that can't hold its pieces apart at that size (a globe's meridian,
// a coin's slot, a sparkle's center, an hourglass's bulbs, a bell's clapper, an envelope's flap, a
// link's loops, a briefcase's band, a flag's notch) is a custom piece in the badge's place, and the
// engine clears the calendar around it, as controles does with its fields. Status and actions go
// in the engine's badges. A mark keeps to about 25 of stroke length: the calendar alone is 22 % ink
// at 32 px and QA's ceiling is 28 %.
import { arc, badge, circ, dot, f, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import nucleo from './nucleo.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────
const P = ([x, y]) => `${f(x)} ${f(y)}`;
const BR = { square: ['br'] };
/** Container with the signature corner: a square bottom-right corner. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Just the `A…` segment of an engine arc, to chain it inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');
/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function roundline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${P(V)}`;
      continue;
    }
    const lu = Math.hypot(A[0] - V[0], A[1] - V[1]);
    const lv = Math.hypot(B[0] - V[0], B[1] - V[1]);
    const u = [(A[0] - V[0]) / lu, (A[1] - V[1]) / lu];
    const v = [(B[0] - V[0]) / lv, (B[1] - V[1]) / lv];
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const t = r / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${P([V[0] + u[0] * t, V[1] + u[1] * t])}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P([V[0] + v[0] * t, V[1] + v[1] * t])}`;
  }
  return `${s}L${P(pts[pts.length - 1])}`;
}
/** A closed outline that retraces an open polyline: the area a custom piece clears around it. */
const retrace = (pts) => `M${pts.map(P).join('L')}${pts.length > 2 ? `L${pts.slice(1, -1).reverse().map(P).join('L')}` : ''}Z`;
/** A custom piece over the base: the engine clears the base around `knock` (DESIGN.md › Badges). */
const piece = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** Moves points: scales by `k` around (0, 0), turns `deg` and moves to `to`. */
const place = (pts, k, deg, to) => pts.map(([x, y]) => rot([to[0] + x * k, to[1] + y * k], to, deg));

// ── The calendar ──────────────────────────────────────────────────────────────────────────
// The core calendar (lugares draws it the same for calendar-plus, -check, -day…).
const CAL = [box(3, 4.75, 18, 16.25, 4), vl(8, 2.9, 6.5), vl(16, 2.9, 6.5), hl(3, 21, 9.75)];
/** The body's center: a mark is centered here, within 2.775 above and below. */
const CY = 15.375;
const cal = (...g) => [...CAL, ...g];

// ── Marks small enough for the calendar's body ────────────────────────────────────────────
/**
 * The set's person in a calendar: the head (r 1.6, its top 2.85 under the header) and the
 * shoulders rising from the bottom edge, as if seen through the body, 2.45 apart as in the core
 * `person`. A smaller head (r 1.25) closed its hole at bold and read as a dot.
 */
const SHOULDER = 2.75;
const HEAD_R = 1.6;
const HEAD_Y = 21 - SHOULDER - 2.45 - HEAD_R;
const person = (x) => [circ(x, HEAD_Y, HEAD_R), arc(x, 21, SHOULDER, 180, 360).d];
/**
 * Two people, as the core `clients`, a little smaller than the one person (as clients' are next to
 * `person`): the one behind, to the right, shows the far side of its head (the arc of it that stays
 * 3.1 clear of the front head) and its right shoulder (from 312°, 2 long). Side by side and whole, the two
 * heads read as a face's eyes; with the front head as a piece on top, its clearance met the
 * shoulders' cut in the fill at some weights and not at others; at the one person's size the pair
 * passed QA's ink ceiling.
 */
const PEOPLE = (() => {
  const [sh, r, front, back] = [2.5, 1.5, 10.25, 13.75];
  const y = 21 - sh - 2.45 - r;
  const reach = r + 3.1;
  const lim = (Math.acos((reach * reach - (back - front) ** 2 - r * r) / (2 * (back - front) * r)) * 180) / Math.PI;
  return [circ(front, y, r), arc(front, 21, sh, 180, 360).d, arc(back, y, r, -lim, lim).d, arc(back, 21, sh, 312, 360).d];
})();
/** The lugares map pin: a circle and its two tangents meeting at the tip. */
const pin = ([cx, cy], r) => {
  const a = polar(cx, cy, r, 45);
  const b = polar(cx, cy, r, 135);
  return `M${P(a)}A${f(r)} ${f(r)} 0 1 0 ${P(b)}L${P([cx, cy + r * Math.SQRT2])}Z`;
};
/**
 * The core phone handset at the size of a day, drawn as its center line: the grip bulges toward
 * the bottom left (sagitta 1) and the two cups turn in toward the face, 25° off square. Scaled
 * whole, the core handset's grip clogged up and opened again across the weights.
 */
const PHONE = (() => {
  const [L, sag, cup, a] = [3, 1, 2.3, 25];
  const R = (L * L + sag * sag) / (2 * sag);
  const at = (y, s) => [cup * Math.cos((a * Math.PI) / 180), y - s * cup * Math.sin((a * Math.PI) / 180)];
  const [p0, p1, p2, p3] = place([at(-L, -1), [0, -L], [0, L], at(L, 1)], 1, -45, [11.4, CY + 0.2]);
  return `M${P(p0)}L${P(p1)}A${f(R)} ${f(R)} 0 0 0 ${P(p2)}L${P(p3)}`;
})();
/**
 * The set's plane (lugares: a fuselage, swept wings and a straight stabilizer) at the size of a
 * day, drawn as its center lines: the stroke is its body. Nose up and right, as lugares' plane;
 * the wing tips stay 2.85 clear of the stabilizer.
 */
const PLANE = (() => {
  const at = (pts) => place(pts, 0.87, 45, [12.64, 14.73]);
  return [line(...at([[0, -3.25], [0, 3.75]])), line(...at([[-3.5, 1], [0, -0.75], [3.5, 1]])), line(...at([[-1.6, 3.75], [0, 2.6], [1.6, 3.75]]))];
})();
/**
 * A sun rising from the calendar's bottom edge: half a disc (r 2.75) and four rays 2 long, 2.85
 * from it, fanned so their ends stay 2.85 from the sides and the bottom.
 */
const RISING_SUN = [arc(12, 21, 2.75, 180, 360).d, ...[-140, -105, -75, -40].map((a) => line(polar(12, 21, 5.6, a), polar(12, 21, 7.7, a)))];
/**
 * The middle of a continuous corner of radius r (sq's smoothing, 0.6), measured from the corner
 * point along each side: a stroke that starts there touches the outline (an envelope's flap).
 */
function cornerMid(r, s = 0.6) {
  const a90 = 90 * (1 - s);
  const L = Math.sin(((a90 / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - a90) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const sag = r - Math.sqrt(r * r - (L * L) / 2);
  return d + L / 2 - sag / Math.SQRT2;
}

// ── Pieces in the badge's place (bottom right, around 17.25, 17.25) ─────────────────────────
// A piece's top stays at 13 or below: from there its clearance (2.3 at bold) ends just under the
// header, which a higher one bit into.
/**
 * The envelope (controles' email field at 9 × 6.5): the flap starts at the corners' middles, so it
 * touches the outline. At 5.25 × 4 in the calendar's body its flap clogged up at bold.
 */
const ENVELOPE = (() => {
  const [x, y, w, h, r] = [12.5, 15, 9, 6.5, 2];
  const u = cornerMid(r);
  const body = box(x, y, w, h, r);
  const flap = line([x + u, y + u], [x + w / 2, y + h * 0.55], [x + w - u, y + u]);
  return piece([body, flap], body, { solid: [body], cut: [flap] });
})();
/**
 * The core link at 45°, its loops r 2.85 (the bar 2.85 from their open ends, as it is 3.25 in the
 * core) and shortened, so it fits the badge's place. Flat across the calendar's body it could not
 * keep that gap under the header and read as "(-)". In the fill it stays lines, as the core link.
 */
const LINK = (() => {
  const C = [17.5, 17.75];
  const [r, g, c] = [2.85, 1.5, 2.25];
  const at = (s, t) => [C[0] + (s + t) * Math.SQRT1_2, C[1] + (t - s) * Math.SQRT1_2];
  const R = halfChord(at(c, -r), at(c, r));
  const loop = (k) => `M${P(at(k * g, -k * r))}L${P(at(k * c, -k * r))}A${R} ${R} 0 0 1 ${P(at(k * c, k * r))}L${P(at(k * g, k * r))}`;
  const [a, b] = [loop(-1), loop(1)];
  return piece([a, b, line(at(-c, 0), at(c, 0))], `${a}Z${b}Z`);
})();
/**
 * The core briefcase at 9.25 × 5.75: the body with the signature corner, its handle and its band.
 * Standing on the calendar's bottom edge, its body and handle read as a padlock.
 */
const BRIEFCASE = (() => {
  const body = box(12.25, 15.75, 9.25, 5.75, 2);
  const handle = roundline([[14.875, 15.75], [14.875, 13.25], [18.875, 13.25], [18.875, 15.75]], [0, 1, 1, 0]);
  const band = hl(12.25, 21.5, 18.6);
  return piece([body, handle, band], `${body}M14.875 15.75V13.25H18.875V15.75Z`, { solid: [body], cut: [band], wire: [handle] });
})();
/**
 * edicion's flag (a pole and a swallowtail cloth) at 7.5 × 8.5. In the calendar's body a flag
 * standing on the bottom edge read as a P; its notch is what makes it a flag, and here it holds.
 */
const FLAG = (() => {
  const pole = vl(13.75, 13.25, 21.75);
  const cloth = roundpoly([[13.75, 13.25], [21.25, 13.25], [19.5, 15.875], [21.25, 18.5], [13.75, 18.5]], [0, 0.6, 0.4, 0.6, 0]);
  return piece([pole, cloth], `${cloth}${retrace([[13.75, 13.25], [13.75, 21.75]])}`, { solid: [cloth], wire: [pole] });
})();
/**
 * comercio's dollar sign without its tails: an S of two half ellipses on a stem that pokes out
 * `stub` above and below. In a coin this small the tails closed loops of ink at light weights that
 * heavier ones filled in.
 */
function dollarS(cx, cy, h, w, stub) {
  const R = `${f(w / 2)} ${f(h / 4)}`;
  return `M${P([cx, cy - h / 2 - stub])}V${f(cy - h / 2)}A${R} 0 0 0 ${P([cx, cy])}A${R} 0 0 1 ${P([cx, cy + h / 2])}V${f(cy + h / 2 + stub)}`;
}
/**
 * Coin: a coin with the dollar sign, on the status badges' ring (r 4.25), so it is solid in every
 * style with its sign cut out, as comercio's coins. A coin with a bare slot read as the info badge.
 */
const COIN = (() => {
  const ring = circ(17.25, 17.25, 4.25);
  const sign = dollarS(17.25, 17.25, 4.6, 3.1, 0.75);
  return piece([ring, sign], ring, { solid: [ring], cut: [sign] });
})();
/**
 * comunicacion's camera in the badge's place: the body with the signature corner and the lens,
 * open toward it (its ends 2.6 apart, so its hole holds at bold). At the size of a day it read as
 * a battery.
 */
const CAMERA = (() => {
  const body = box(12.5, 14.5, 5.75, 5, 1.5);
  const lens = roundline([[18.25, 15.7], [21.25, 14.5], [21.25, 19.5], [18.25, 18.3]], [0, 0.6, 0.6, 0]);
  // It clears the badges' ring too, so no sliver of the calendar's corner is left under the lens
  return piece([body, lens], `${body}M18.25 15.7L21.25 14.5V19.5L18.25 18.3Z${circ(17.25, 17.25, 4.25)}`, { solid: [body, `${lens}Z`] });
})();
/** datos' four-point sparkle (concave sides). */
function star4(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const Q = (x, y) => P([cx + x * R, cy + y * R]);
  return `M${Q(0, -1)}C${Q(a, -b)} ${Q(b, -a)} ${Q(1, 0)}C${Q(b, a)} ${Q(a, b)} ${Q(0, 1)}C${Q(-a, b)} ${Q(-b, a)} ${Q(-1, 0)}C${Q(-b, -a)} ${Q(-a, -b)} ${Q(0, -1)}Z`;
}
const SPARKLE = (() => {
  const s = star4(17.25, 17.25, 4.25);
  return piece([s], s, { solid: [s] });
})();
/**
 * Globe: on the status badges' ring, solid in every style, with lugares' meridian and the equator
 * cut out (drawn as lines, a meridian 1.4 wide inside a ring this small clogged up).
 */
const GLOBE = (() => {
  const ring = circ(17.25, 17.25, 4.25);
  const R = (4.25 * 4.25 + 1.75 * 1.75) / (2 * 1.75);
  const meridian = `M17.25 13A${f(R)} ${f(R)} 0 0 1 17.25 21.5A${f(R)} ${f(R)} 0 0 1 17.25 13Z`;
  const equator = hl(13, 21.5, 17.25);
  return piece([ring, meridian, equator], ring, { solid: [ring], cut: [meridian, equator] });
})();
/**
 * Hourglass: lugares' glass pinched to a point at the waist (its two bulbs stay apart at every
 * weight) between its two caps, 8.5 tall.
 */
const HOURGLASS = (() => {
  const glass = roundpoly(
    [[14.25, 13], [20.25, 13], [20.25, 14.5], [17.25, 17.25], [20.25, 20], [20.25, 21.5], [14.25, 21.5], [14.25, 20], [17.25, 17.25], [14.25, 14.5]],
    [0, 0, 1.5, 0, 1.5, 0, 0, 1.5, 0, 1.5],
  );
  const caps = [hl(13.25, 21.25, 13), hl(13.25, 21.25, 21.5)];
  return piece([glass, ...caps], `${glass}${retrace([[13.25, 13], [21.25, 13]])}${retrace([[13.25, 21.5], [21.25, 21.5]])}`, { solid: [glass], wire: caps });
})();

/**
 * The core bell (social draws it the same under a corner): the body at 40 %, its top at 13.1, and
 * the clapper at 50 %, 2.6 under it, so the two stay apart at bold. At the size of a day the
 * clapper ran into the body. It clears the badges' ring too, as the engine's glyphs do: cleared
 * around the bell alone, the clearance pinched between body and clapper differently at each weight.
 */
const BELL = (() => {
  const N = nucleo.icons.bell.d;
  const move = (d, s, o, to) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
  const body = move(N[1], 0.4, [12, 10.15], [17.25, 16]);
  const clapper = move(N[0], 0.5, [12, 20.35], [17.25, 21.5]);
  return piece([body, clapper], `${circ(17.25, 17.25, 4.25)}${body}${clapper}Z`, { solid: [body, `${clapper}Z`] });
})();

// ── The clock ────────────────────────────────────────────────────────────────────────────
// The core clock. With a piece at the bottom right its hands turn to 10 and their pivot moves to
// (11.5, 11.5), the visual center of what the piece leaves (lugares' clock-plus).
const FACE = circ(12, 12, 9);
const HANDS_BR = line([11.5, 6.35], [11.5, 11.5], [8.2, 9.45]);
/** Crescent moon (lugares): the disc of radius R minus the one of radius r centered at `ic`. */
function moon(c, R, ic, r) {
  const d = Math.hypot(ic[0] - c[0], ic[1] - c[1]);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(R * R - a * a);
  const m = [c[0] + (a * (ic[0] - c[0])) / d, c[1] + (a * (ic[1] - c[1])) / d];
  const p = [m[0] + (h * (ic[1] - c[1])) / d, m[1] - (h * (ic[0] - c[0])) / d];
  const q = [m[0] - (h * (ic[1] - c[1])) / d, m[1] + (h * (ic[0] - c[0])) / d];
  return `M${P(p)}A${f(R)} ${f(R)} 0 1 0 ${P(q)}A${f(r)} ${f(r)} 0 0 1 ${P(p)}Z`;
}
/** A cup (lugares' coffee without its steam): the body with the signature corner and its handle. */
const CUP = (() => {
  const body = roundpoly([[13.25, 14.25], [18.25, 14.25], [18.25, 21.25], [13.25, 21.25]], [0.5, 0.5, 0, 2]);
  const handle = roundline([[18.25, 15.75], [21, 15.75], [21, 19.25], [18.25, 19.25]], [0, 1.25, 1.25, 0]);
  return piece([body, handle], `${body}M18.25 15.75H21V19.25H18.25Z`, { solid: [body], wire: [handle] });
})();
// ── The shifts ──
// The time of day is the subject and the engine's clock badge says "shift", as lugares' time-zone
// (a globe and the clock badge). A clock with a sun, half a sun or a moon in its top right corner
// had no room for a sun's rays (they read as a spark) and its hands, turned away from the corner,
// read as a 1. Rays the badge would cut are left out (a partial one would be a fragment).
/** lugares' sun (a disc of r 4.25, rays from r + 3 to r + 5.1), up and left of the badge. */
const SUN = (() => {
  const [c, r] = [[11.5, 11.5], 4.25];
  return [circ(...c, r), ...[135, 180, 225, 270, 315].map((a) => line(polar(...c, r + 3, a), polar(...c, r + 5.1, a)))];
})();
/** lugares' sunset without its arrow: half the sun on the horizon, raised clear of the badge. */
const SUNSET = (() => {
  const [c, r] = [[10.75, 15.25], 4.25];
  return [hl(2.75, 21.25, 15.25), arc(...c, r, 180, 360).d, ...[-155, -122, -90, -58].map((a) => line(polar(...c, r + 3, a), polar(...c, r + 5.1, a)))];
})();
/** lugares' stopwatch, its hand left out for a sign in the face. */
const STOPWATCH = [circ(12, 13.25, 7.75), vl(12, 5.5, 2.75), hl(9.75, 14.25, 2.75), line(polar(12, 13.25, 7.75, -45), polar(12, 13.25, 9.85, -45))];
/** lugares' hourglass: one glass narrowing to the neck, and its caps. */
const GLASS = roundpoly(
  [[7, 3.25], [17, 3.25], [17, 6.75], [13.1, 12], [17, 17.25], [17, 20.75], [7, 20.75], [7, 17.25], [10.9, 12], [7, 6.75]],
  [0, 0, 3, 1, 3, 0, 0, 3, 1, 3],
);
const CAPS = [hl(5.25, 18.75, 3.25), hl(5.25, 18.75, 20.75)];
/** Where the top bulb's slanted side is at height y (it runs from (17, 6.75) to (13.1, 12)). */
const bulbX = (y) => 17 - ((y - 6.75) * 3.9) / 5.25;

const icons = {
  // ── Views ──
  'calendar-week': {
    tags: ['vista semanal', 'semana', 'columnas', 'week view', 'week', 'weekly'],
    // The body in columns: two lines from the header to the bottom edge (a third one took the
    // calendar past QA's ink ceiling, and three columns read as a week the same)
    d: cal(vl(9, 9.75, 21), vl(15, 9.75, 21)),
  },
  'calendar-month': {
    tags: ['vista mensual', 'mes', 'cuadrícula', 'month view', 'month', 'monthly'],
    // The whole month: two full rows of four days, where the core calendar shows a week and a half.
    // Ruled into cells it took 31 % ink, past QA's ceiling
    d: cal(...[6.75, 10.25, 13.75, 17.25].flatMap((x) => [13.6, 17.15].map((y) => dot(x, y, 0.3)))),
  },
  'calendar-year': {
    tags: ['vista anual', 'año', 'doce meses', 'year view', 'year', 'annual'],
    // Twelve months, a dot each, in the whole body: under the header three rows don't fit apart.
    // Four mini months as squircles took 31 % ink, past QA's ceiling
    d: [CAL[0], CAL[1], CAL[2], ...[6.5, 10.17, 13.83, 17.5].flatMap((x) => [10, 13.5, 17].map((y) => dot(x, y, 0.3)))],
  },
  'calendar-agenda': {
    tags: ['agenda', 'vista de lista', 'próximos eventos', 'agenda view', 'schedule', 'upcoming'],
    // Two entries on the day dots' rows (13.6 and 17.15): a dot for the time and a line for the event
    d: cal(dot(7.85, 13.6), hl(11.45, 16.85, 13.6), dot(7.85, 17.15), hl(11.45, 15, 17.15)),
  },
  'calendar-stack': (() => {
    // The front calendar at 80 %; the one behind is 2.5 to the right and 5 up, so its top edge stays
    // 3.5 clear of the front rings and its right edge, 2.5 from the front's, is cleared all along it
    const front = [box(2.75, 7.25, 14.5, 14, 3.5), vl(6.75, 5.75, 8.75), vl(13.25, 5.75, 8.75), hl(2.75, 17.25, 11.5)];
    const knock = `${front[0]}${retrace([[6.75, 5.75], [6.75, 8.75]])}${retrace([[13.25, 5.75], [13.25, 8.75]])}`;
    return {
      tags: ['calendarios', 'mis calendarios', 'calendario compartido', 'calendars', 'calendar list', 'overlay'],
      d: [box(5.25, 2.25, 14.5, 14, 3.5)],
      badge: piece(front, knock, { solid: [front[0]], wire: [front[1], front[2]], cut: [front[3]] }),
    };
  })(),
  'calendar-blank': {
    tags: ['calendario vacío', 'sin eventos', 'sin fecha', 'empty calendar', 'no events', 'blank'],
    d: [...CAL],
  },
  'calendar-tear-off': {
    tags: ['calendario de hojas', 'día a día', 'arrancar hoja', 'tear-off calendar', 'daily', 'day by day'],
    // The pad bound under its header, the front page's corner folded up along the line from (15, 21)
    // to (21, 15): the flap is that corner turned over, and under it the next page's square corner
    d: cal(roundpoly([[15, 21], [15, 15], [21, 15]], [0, 2, 0])),
  },
  'timeline': {
    tags: ['línea de tiempo', 'cronología', 'historial', 'timeline', 'chronology', 'history'],
    // The axis and four events along it, above and below in turn, each a landscape card (an event
    // block) 2.85 from it. Ring nodes on the axis with stems to their labels read as a molecule (or,
    // rings alone, as controles' progress steps); stems from the axis to the cards, as a sitemap
    d: [hl(2.75, 21.25, 12), ...[4.875, 9.625, 14.375, 19.125].map((x, i) => box(x - 2.75, i % 2 ? 14.85 : 4.9, 5.5, 4.25, 1.5))],
  },
  'timeline-list': {
    tags: ['actividad', 'historial', 'seguimiento', 'activity', 'audit trail', 'tracking'],
    d: [circ(6, 5, 1.75), circ(6, 12, 1.75), circ(6, 19, 1.75), vl(6, 6.75, 10.25), vl(6, 13.75, 17.25), hl(10.75, 20.25, 5), hl(10.75, 17.25, 12), hl(10.75, 19, 19)],
  },
  'time-block': {
    tags: ['bloques de tiempo', 'horario del día', 'agenda del día', 'time blocking', 'day schedule', 'planner'],
    // The day as a column: hour ticks on its left edge and two blocks of different lengths
    d: [box(4.75, 2.75, 14.5, 18.5, 4), hl(4.85, 7.5, 7), hl(4.75, 7.5, 12), hl(4.85, 7.5, 17), box(10.5, 5.75, 5.75, 5.5, 1.5), box(10.5, 14.25, 5.75, 4, 1.5)],
  },

  // ── Events by kind ──
  'calendar-person': {
    tags: ['cita', 'reunión con una persona', 'disponibilidad', 'appointment', 'one-on-one', 'availability'],
    d: cal(...person(12)),
  },
  'calendar-people': {
    tags: ['calendario de equipo', 'evento grupal', 'asistentes', 'team calendar', 'group event', 'attendees'],
    // The person in front and, behind, the head and right shoulder of a second one (the core `clients`)
    d: cal(...PEOPLE),
  },
  'calendar-pin': {
    tags: ['evento presencial', 'lugar del evento', 'ubicación', 'in-person event', 'event location', 'venue'],
    d: cal(pin([12, 14.9], 2.3)),
  },
  'calendar-video': {
    tags: ['evento virtual', 'videollamada', 'reunión en línea', 'virtual event', 'video meeting', 'online meeting'],
    d: [...CAL],
    badge: CAMERA,
  },
  'calendar-phone': {
    tags: ['llamada agendada', 'cita telefónica', 'llamada', 'phone call', 'scheduled call', 'call booking'],
    d: cal(PHONE),
  },
  'calendar-plane': {
    tags: ['viaje', 'fuera de la oficina', 'vacaciones', 'trip', 'travel', 'out of office'],
    d: cal(...PLANE),
  },
  'calendar-cake': {
    tags: ['cumpleaños', 'aniversario', 'celebración', 'birthday', 'birthdays', 'anniversary'],
    // A cake of two tiers standing on the calendar's bottom edge, and its candle
    d: cal(roundline([[8.25, 21], [8.25, 18.4], [15.75, 18.4], [15.75, 21]], [0, 1, 1, 0]), roundline([[10, 18.4], [10, 15.8], [14, 15.8], [14, 18.4]], [0, 1, 1, 0]), vl(12, 12.65, 15.8)),
  },
  'calendar-coin': {
    tags: ['fecha de pago', 'cobro', 'día de pago', 'payment date', 'payday', 'billing date'],
    d: [...CAL],
    badge: COIN,
  },
  'calendar-workday': {
    tags: ['día laborable', 'días hábiles', 'trabajo', 'workday', 'business days', 'work calendar'],
    d: [...CAL],
    badge: BRIEFCASE,
  },
  'calendar-sun': {
    tags: ['día festivo', 'feriado', 'día inhábil', 'holiday', 'public holiday', 'day off'],
    // The sun rises from the bottom edge, like the cake and the bars, inside the body
    d: cal(...RISING_SUN),
  },
  'calendar-globe': {
    tags: ['evento público', 'calendario público', 'feriados regionales', 'public event', 'public calendar', 'regional holidays'],
    d: [...CAL],
    badge: GLOBE,
  },
  'calendar-bolt': {
    tags: ['reserva instantánea', 'evento rápido', 'agregar rápido', 'instant booking', 'quick event', 'quick add'],
    // The core bolt as its center line: a Z whose ends clear the middle bar by 2.85
    d: cal(roundline([[15, 12.6], [9.75, CY], [14.25, CY], [9, 18.15]], [0, 0.4, 0.4, 0])),
  },
  'calendar-sparkle': {
    tags: ['programación inteligente', 'ia', 'sugerir horario', 'smart scheduling', 'ai', 'find a time'],
    d: [...CAL],
    badge: SPARKLE,
  },
  'calendar-chart': {
    tags: ['uso del tiempo', 'informe de tiempo', 'estadísticas', 'time insights', 'time report', 'analytics'],
    // Three bars standing on the bottom edge
    d: cal(vl(8.25, 18, 21), vl(12, 15.5, 21), vl(15.75, 13, 21)),
  },
  'calendar-link': {
    tags: ['enlace de reserva', 'agendar', 'suscripción', 'booking link', 'scheduling link', 'subscribe url'],
    d: [...CAL],
    badge: LINK,
  },
  'calendar-invite': {
    tags: ['invitación', 'invitar', 'convocatoria', 'invite', 'invitation', 'rsvp'],
    d: [...CAL],
    badge: ENVELOPE,
  },
  'calendar-bell': {
    tags: ['notificaciones del evento', 'recordatorio', 'aviso', 'event notification', 'reminder', 'alert'],
    d: [...CAL],
    badge: BELL,
  },
  'calendar-due': {
    tags: ['fecha límite', 'vencimiento', 'entrega', 'due date', 'deadline', 'due'],
    d: [...CAL],
    badge: FLAG,
  },
  'calendar-start': {
    tags: ['fecha de inicio', 'comienza', 'arranque', 'start date', 'begins', 'kickoff'],
    // The start line and the arrow leaving it
    d: cal(vl(8.5, 12.65, 18.1), hl(8.5, 15.75, CY), head([15.75, CY], [1, 0], 3.4)),
  },
  'calendar-hourglass': {
    tags: ['tiempo restante', 'vencimiento', 'cuenta regresiva', 'expiration', 'time left', 'countdown'],
    d: [...CAL],
    badge: HOURGLASS,
  },
  'calendar-repeat': (() => {
    // A loop with one arrowhead on its top run; its top arm stays 2.85 below the header
    const loop = `M${P(polar(13.5, 16.15, 2, -60))}${arcTo(13.5, 16.15, 2, -60, 90)}H10.5${arcTo(10.5, 16.15, 2, 90, 270)}H12`;
    return {
      tags: ['evento recurrente', 'repetir', 'periodicidad', 'recurring event', 'repeat', 'recurrence'],
      d: cal(loop, head([12, 14.15], [1, 0], 2.15)),
    };
  })(),
  'calendar-conflict': {
    tags: ['conflicto de horario', 'empalme', 'doble reserva', 'scheduling conflict', 'overlap', 'double booking'],
    // Two events in the same slot: calendar-event's block in the body and a second one over it in
    // the badge's place, so the engine clears the one behind. Two flat blocks side by side in the
    // body read as a chain link
    d: cal(box(5.85, 12.6, 6.5, 4.75, 1.5)),
    badge: (() => {
      const front = box(12, 16.25, 8.5, 5.5, 1.75);
      return piece([front], front, { solid: [front] });
    })(),
  },
  'calendar-pause': {
    tags: ['en pausa', 'pausado hasta', 'suspendido', 'paused', 'on hold', 'pause until'],
    d: cal(vl(10.5, 12.6, 18.15), vl(13.5, 12.6, 18.15)),
  },
  'calendar-search': {
    tags: ['buscar eventos', 'buscar fecha', 'encontrar horario', 'search events', 'find a time', 'search calendar'],
    d: [...CAL],
    badge: badge('search'),
  },
  'calendar-sync': {
    tags: ['sincronizar calendario', 'calendario conectado', 'sincronización', 'calendar sync', 'sync', 'connected calendar'],
    d: [...CAL],
    badge: badge('sync'),
  },
  'calendar-edit': {
    tags: ['editar evento', 'cambiar fecha', 'modificar horario', 'edit event', 'change date', 'reschedule'],
    d: [...CAL],
    badge: badge('edit'),
  },
  'calendar-gear': {
    tags: ['ajustes del calendario', 'horario laboral', 'preferencias', 'calendar settings', 'working hours', 'preferences'],
    d: [...CAL],
    badge: badge('gear'),
  },
  'calendar-lock': {
    tags: ['evento privado', 'calendario bloqueado', 'privado', 'private event', 'locked calendar', 'private'],
    d: [...CAL],
    badge: badge('lock'),
  },
  'calendar-question': {
    tags: ['tentativo', 'quizás asista', 'por confirmar', 'tentative', 'maybe', 'unconfirmed'],
    d: [...CAL],
    badge: badge('question'),
  },
  'calendar-star': {
    tags: ['evento importante', 'destacado', 'favorito', 'important event', 'starred', 'featured'],
    d: [...CAL],
    badge: badge('star'),
  },
  'calendar-forward': {
    tags: ['posponer', 'reprogramar', 'próximamente', 'postpone', 'reschedule', 'upcoming'],
    d: [...CAL],
    badge: badge('arrow-right'),
  },
  'calendar-block': {
    tags: ['fechas bloqueadas', 'no disponible', 'sin reservas', 'blocked dates', 'unavailable', 'blackout dates'],
    d: [...CAL],
    badge: badge('block'),
  },
  'calendar-export': {
    tags: ['exportar calendario', 'publicar calendario', 'descargar', 'export calendar', 'publish', 'share calendar'],
    d: [...CAL],
    badge: badge('arrow-up'),
  },
  'calendar-import': {
    tags: ['importar eventos', 'suscribirse', 'cargar calendario', 'import events', 'subscribe', 'import calendar'],
    d: [...CAL],
    badge: badge('arrow-down'),
  },

  // ── Clocks ──
  'clock-range': {
    tags: ['rango de horas', 'horario laboral', 'de a', 'time range', 'business hours', 'time span'],
    // The hands opened to the start and the end of the span (12 to 4) and the arc that joins them
    d: [FACE, `M12 12L12 6.25${arcTo(12, 12, 5.75, -90, 30)}Z`],
  },
  'clock-fast': {
    tags: ['rápido', 'respuesta rápida', 'exprés', 'fast', 'quick', 'express'],
    // The clock moves right and three speed lines trail it, each 2.85 from the ring
    d: [circ(15, 12, 7), line([15, 7.9], [15, 12], [17.6, 13.5]), hl(3.25, 5.8, 8.25), hl(2, 5.1, 12), hl(3.25, 5.8, 15.75)],
  },
  'clock-in': {
    tags: ['registrar entrada', 'checar entrada', 'inicio de turno', 'clock in', 'punch in', 'start shift'],
    // The ring opens on the left (80°) and the arrow comes in to the center: with the minute hand,
    // it reads as the clock's hands
    d: [arc(12, 12, 9, 220, 500).d, hl(2, 12, 12), head([12, 12], [1, 0], 4), vl(12, 6.25, 12)],
  },
  'clock-out': {
    tags: ['registrar salida', 'checar salida', 'fin de turno', 'clock out', 'punch out', 'end shift'],
    d: [arc(12, 12, 9, 220, 500).d, hl(2.25, 12, 12), head([2.25, 12], [-1, 0], 4), vl(12, 6.25, 12)],
  },
  'hourly-rate': {
    tags: ['tarifa por hora', 'tiempo facturable', 'costo por hora', 'hourly rate', 'billable time', 'billable hours'],
    d: [FACE, HANDS_BR],
    badge: COIN,
  },
  'break-time': {
    tags: ['descanso', 'pausa del turno', 'receso', 'break', 'coffee break', 'time off'],
    d: [FACE, HANDS_BR],
    badge: CUP,
  },
  'shift-day': {
    tags: ['turno de día', 'turno matutino', 'día', 'day shift', 'morning shift', 'daytime'],
    d: SUN,
    badge: badge('clock'),
  },
  'shift-evening': {
    tags: ['turno vespertino', 'turno de tarde', 'tarde', 'evening shift', 'afternoon shift', 'swing shift'],
    d: SUNSET,
    badge: badge('clock'),
  },
  'shift-night': {
    tags: ['turno nocturno', 'turno de noche', 'noche', 'night shift', 'overnight', 'graveyard shift'],
    // lugares' moon
    d: [moon([11.5, 12.5], 8.5, [16.75, 7.25], 6.75)],
    badge: badge('clock'),
  },
  'shift-swap': (() => {
    // Two shifts (event blocks) in opposite corners and an arc arrow each way between them, the
    // second the first turned half a turn
    const a = arc(12, 12, 6.75, -72, -18);
    const go = [a.d, head(a.end, a.tangent, 3.4)];
    return {
      tags: ['cambio de turno', 'intercambiar turno', 'cubrir turno', 'shift swap', 'trade shift', 'swap'],
      d: [box(3, 3, 7, 7, 2.25), box(14, 14, 7, 7, 2.25), ...go, ...go.map((d) => turnPath(d, 180))],
    };
  })(),
  'clock-alert': {
    tags: ['atrasado', 'vencido', 'fuera de tiempo', 'overdue', 'late', 'missed deadline'],
    d: [FACE, HANDS_BR],
    badge: badge('alert'),
  },
  'clock-edit': {
    tags: ['editar hora', 'ajustar tiempo', 'corregir registro', 'edit time', 'adjust hours', 'edit time entry'],
    d: [FACE, HANDS_BR],
    badge: badge('edit'),
  },

  // ── Timepieces ──
  'digital-clock': {
    tags: ['reloj digital', 'despertador digital', 'pantalla', 'digital clock', 'display clock', 'led clock'],
    // The display on two feet: two blank digit cells and the colon between them
    d: [box(2.5, 5, 19, 11.75, 3.5), vl(6.5, 16.75, 19), vl(17.5, 16.75, 19), sq(5.5, 8, 3.25, 5.75, 1.25), sq(15.25, 8, 3.25, 5.75, 1.25), dot(12, 8.875), dot(12, 12.875)],
  },
  'flip-clock': {
    tags: ['reloj de paletas', 'retro', 'tablero de salidas', 'flip clock', 'split-flap', 'departure board'],
    // Two cards split across the middle; the split runs 0.75 past each side, the hinges
    d: [box(2.5, 6.75, 7.25, 10.5, 2), box(14.25, 6.75, 7.25, 10.5, 2), hl(1.75, 10.5, 12), hl(13.5, 22.25, 12)],
  },
  'watch-analog': {
    tags: ['reloj de pulsera', 'reloj analógico', 'clásico', 'wristwatch', 'analog watch', 'watch'],
    // The face, its straps rising from it and the crown at 3
    d: [
      circ(12, 12, 6),
      line([12, 8.85], [12, 12], [14.25, 13.3]),
      roundline([[9.25, 6.67], [9.25, 2.75], [14.75, 2.75], [14.75, 6.67]], [0, 1.25, 1.25, 0]),
      roundline([[9.25, 17.33], [9.25, 21.25], [14.75, 21.25], [14.75, 17.33]], [0, 1.25, 1.25, 0]),
      hl(18, 20, 12),
    ],
  },
  'pocket-watch': {
    tags: ['reloj de bolsillo', 'puntualidad', 'antiguo', 'pocket watch', 'vintage', 'punctuality'],
    d: [circ(12, 14, 7.25), line([12, 9.9], [12, 14], [14.6, 15.5]), vl(12, 4.75, 6.75), circ(12, 3.5, 1.25), `M13.25 3.5C16 3.5 18.5 4 20.25 6`],
  },
  'grandfather-clock': {
    tags: ['reloj de péndulo', 'reloj de pie', 'antiguo', 'grandfather clock', 'pendulum clock', 'longcase clock'],
    // The tall case with an arched hood, a round dial in the hood (concentric with it, 3 inside) and
    // the pendulum under it. The dial is too small for hands that stop short of its rim: they reach
    // it, as chess-clock's. With the hood itself as the dial and a bob ring, it read as a padlock
    d: [
      `M18 8.75V21.25H8.75A2.75 2.75 0 0 1 6 18.5V8.75A6 6 0 0 1 18 8.75Z`,
      circ(12, 8.75, 3),
      line([12, 5.75], [12, 8.75], polar(12, 8.75, 3, 30)),
      vl(12, 14.6, 17.25),
      dot(12, 18),
    ],
  },
  'punch-clock': {
    tags: ['reloj checador', 'checador', 'asistencia', 'punch clock', 'time clock', 'attendance'],
    // The terminal, its dial and the time card hanging from the slot along its bottom edge
    d: [box(4.25, 2.75, 15.5, 15.25, 3.5), circ(12, 10.35, 4.75), line([12, 8.5], [12, 10.35], [13.6, 11.28]), roundline([[9, 18], [9, 21.25], [15, 21.25], [15, 18]], [0, 1.25, 0, 0])],
  },
  'chess-clock': {
    tags: ['reloj de ajedrez', 'turnos', 'partida', 'chess clock', 'game clock', 'timed match'],
    // Two dials, each hand reaching its rim, and a plunger on top of each: the left one pressed
    d: [
      box(2.5, 9.75, 19, 10.5, 3),
      circ(7.75, 15, 2.85),
      circ(16.25, 15, 2.85),
      line([7.75, 15], polar(7.75, 15, 2.85, -120)),
      line([16.25, 15], polar(16.25, 15, 2.85, -60)),
      `M6.45 6.85H9.05M7.75 6.85V9.75`,
      `M14.95 5.15H17.55M16.25 5.15V9.75`,
    ],
  },
  'kitchen-timer': {
    tags: ['temporizador de cocina', 'cocina', 'cuenta regresiva', 'kitchen timer', 'egg timer', 'twist timer'],
    // The dome on its base: three marks of its dial along the top, and the pointer rising from the
    // base toward them (with a knob instead, it read as a service bell)
    d: [
      arc(12, 17.25, 7.75, 180, 360).d,
      box(3.25, 17.25, 17.5, 3.5, 1.5),
      ...[-135, -90, -45].map((a) => line(polar(12, 17.25, 7.75, a), polar(12, 17.25, 5.5, a))),
      vl(12, 14.6, 17.25),
    ],
  },
  'hourglass-start': {
    tags: ['cuenta regresiva', 'recién iniciado', 'tiempo completo', 'countdown start', 'time left', 'full'],
    // The sand's surface high in the top bulb
    d: [GLASS, ...CAPS, hl(17 - bulbX(8) + 7, bulbX(8), 8)],
  },
  'hourglass-half': {
    tags: ['tiempo corriendo', 'a la mitad', 'en curso', 'countdown running', 'half time', 'in progress'],
    // The surface lower in the top bulb, and a small mound in the bottom one
    d: [GLASS, ...CAPS, hl(24 - bulbX(10), bulbX(10), 10), `M10 20.75C10.4 19.4 11.1 18.9 12 18.9S13.6 19.4 14 20.75`],
  },
  'stopwatch-play': {
    tags: ['iniciar cronómetro', 'empezar a medir', 'registrar tiempo', 'start timer', 'start tracking', 'play'],
    d: [...STOPWATCH, roundpoly([[10.5, 10.5], [15, 13.25], [10.5, 16]], 0.75)],
  },
  'stopwatch-pause': {
    tags: ['pausar cronómetro', 'pausa', 'detener temporalmente', 'pause timer', 'pause tracking', 'pause'],
    d: [...STOPWATCH, vl(10.5, 10.5, 16), vl(13.5, 10.5, 16)],
  },
  'stopwatch-stop': {
    tags: ['detener cronómetro', 'guardar tiempo', 'terminar registro', 'stop timer', 'stop tracking', 'stop'],
    d: [...STOPWATCH, sq(9.75, 11, 4.5, 4.5, 1.25)],
  },
};

// ── Fill (DESIGN.md › Fill) ─────────────────────────────────────────────────────────────────
// By index of `d`: `solid` is filled (closed shapes only; `close` closes an open outline along its
// chord, which lands on another stroke of the body: a strap on the face, a button on its box),
// `cut` is knocked out, `lines` stays a line with a clearance of paper and `wire` stays a line
// attached. The calendar like the core one: the body is filled, the rings stay lines, the header
// and the mark are knocked out; a mark that stands on the bottom edge is knocked out the same way.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const FILL = {};
for (const name of Object.keys(icons).filter((n) => n.startsWith('calendar-') && !['calendar-year', 'calendar-stack'].includes(n)))
  FILL[name] = { solid: [0], lines: [1, 2], cut: range(3, icons[name].d.length) };
// Clocks with a piece or a badge: the face filled, the hands knocked out
for (const name of ['hourly-rate', 'break-time', 'clock-alert', 'clock-edit', 'clock-range']) FILL[name] = { solid: [0], cut: [1] };
// The stopwatch and the hourglass like lugares': the crown, the button and the caps stay attached
for (const name of ['stopwatch-play', 'stopwatch-pause', 'stopwatch-stop']) FILL[name] = { solid: [0], wire: [1, 2, 3], cut: range(4, icons[name].d.length) };
for (const name of ['hourglass-start', 'hourglass-half']) FILL[name] = { solid: [0], wire: [1, 2], cut: range(3, icons[name].d.length) };
Object.assign(FILL, {
  'calendar-year': { solid: [0], lines: [1, 2], cut: range(3, 15) },
  'calendar-stack': { solid: [0] },
  timeline: { solid: [1, 2, 3, 4], wire: [0] },
  // The shifts as lugares' sun, sunset and moon: the rays stay lines with their clearance
  'shift-day': { solid: [0], lines: range(1, 6) },
  'shift-evening': { solid: [1], wire: [0], lines: range(2, 6), close: [1] },
  'shift-night': { solid: [0] },
  'timeline-list': { solid: [0, 1, 2], wire: [3, 4], lines: [5, 6, 7] },
  'time-block': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'clock-fast': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'shift-swap': { solid: [0, 1], wire: [2, 3, 4, 5] },
  'digital-clock': { solid: [0], wire: [1, 2], cut: [3, 4, 5, 6] },
  // The split is a line in a clearance of paper: the two flaps, with the hinges past the sides
  'flip-clock': { solid: [0, 1], lines: [2, 3] },
  'watch-analog': { solid: [0, 2, 3], cut: [1], wire: [4], close: [2, 3] },
  'pocket-watch': { solid: [0, 3], cut: [1], wire: [2, 4] },
  'grandfather-clock': { solid: [0], cut: [1, 2, 3, 4] },
  'punch-clock': { solid: [0, 3], cut: [1, 2], close: [3] },
  'chess-clock': { solid: [0], cut: [1, 2, 3, 4], wire: [5, 6] },
  'kitchen-timer': { solid: [0, 1], cut: [2, 3, 4, 5], close: [0] },
});
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  const shut = (i) => (spec.close?.includes(i) ? `${icons[name].d[i]}Z` : icons[name].d[i]);
  icons[name].fill = { solid: spec.solid.map(shut) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}
// Open rings: filled, their chord would turn them into a bitten disc (as lugares' timer)
for (const name of ['clock-in', 'clock-out']) icons[name].fill = false;
// Under a lock, a sync, a sparkle, an hourglass or a bell the header stops at 13 in the fill: their
// clearance comes so near it that at bold weights the two met and split off a sliver of the body.
// The clearance's top edge then reads as the rest of the header.
for (const name of ['calendar-lock', 'calendar-sync', 'calendar-sparkle', 'calendar-hourglass', 'calendar-bell']) icons[name].fill.cut = [hl(3, 13, 9.75)];

// ── Named parts (DESIGN.md › Named parts) ───────────────────────────────────────────────────
const PARTS = {
  'calendar-year': { body: [0], rings: [1, 2], months: range(3, 15) },
  'calendar-stack': { body: [0] },
  'calendar-tear-off': { body: [0], rings: [1, 2], header: [3], curl: [4] },
  'calendar-start': { body: [0], rings: [1, 2], header: [3], line: [4], arrow: [5, 6] },
  'calendar-repeat': { body: [0], rings: [1, 2], header: [3], arrow: [4, 5] },
  timeline: { axis: [0], events: [1, 2, 3, 4] },
  'timeline-list': { events: [0, 1, 2], axis: [3, 4], entries: [5, 6, 7] },
  'time-block': { day: [0], hours: [1, 2, 3], blocks: [4, 5] },
  'clock-range': { face: [0], range: [1] },
  'clock-fast': { face: [0], hands: [1], speed: [2, 3, 4] },
  'clock-in': { face: [0], arrow: [1, 2], hand: [3] },
  'clock-out': { face: [0], arrow: [1, 2], hand: [3] },
  'shift-swap': { shifts: [0, 1], arrows: [2, 3, 4, 5] },
  'digital-clock': { display: [0], feet: [1, 2], digits: [3, 4], colon: [5, 6] },
  'flip-clock': { cards: [0, 1], split: [2, 3] },
  'watch-analog': { face: [0], hands: [1], straps: [2, 3], crown: [4] },
  'pocket-watch': { face: [0], hands: [1], crown: [2], ring: [3], chain: [4] },
  'grandfather-clock': { case: [0], face: [1], hands: [2], pendulum: [3, 4] },
  'shift-day': { sun: [0], rays: range(1, 6) },
  'shift-evening': { horizon: [0], sun: [1], rays: range(2, 6) },
  'shift-night': { moon: [0] },
  'punch-clock': { body: [0], face: [1], hands: [2], card: [3] },
  'chess-clock': { body: [0], faces: [1, 2], hands: [3, 4], buttons: [5, 6] },
  'kitchen-timer': { dome: [0], base: [1], dial: [2, 3, 4], pointer: [5] },
};
for (const name of Object.keys(icons).filter((n) => n.startsWith('calendar-') && !PARTS[n])) {
  const n = icons[name].d.length;
  PARTS[name] = { body: [0], rings: [1, 2], header: [3], ...(n > 4 && { mark: range(4, n) }) };
}
for (const name of ['hourly-rate', 'break-time', 'clock-alert', 'clock-edit']) PARTS[name] = { face: [0], hands: [1] };
for (const name of ['stopwatch-play', 'stopwatch-pause', 'stopwatch-stop']) PARTS[name] = { face: [0], crown: [1, 2], button: [3], mark: range(4, icons[name].d.length) };
for (const name of ['hourglass-start', 'hourglass-half']) PARTS[name] = { glass: [0], caps: [1, 2], sand: range(3, icons[name].d.length) };
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// ── Motion (DESIGN.md › Motion) ─────────────────────────────────────────────────────────────
const BC = [17.25, 17.25];
const MOTION = {
  'calendar-tear-off': { effect: 'wiggle', parts: ['curl'], origin: [15, 21] },
  'calendar-plane': { effect: 'slide', parts: ['mark'], vector: [1.5, -1.5] },
  'calendar-pin': { effect: 'bounce', parts: ['mark'], vector: [0, -1.5] },
  'calendar-phone': { effect: 'ring', parts: ['mark'], origin: [12, CY] },
  'calendar-bell': { effect: 'ring', parts: ['badge'], origin: [17.25, 13.12] },
  'calendar-bolt': { effect: 'beat', parts: ['mark'], origin: [12, CY] },
  'calendar-due': { effect: 'wiggle', parts: ['badge'], origin: [13.75, 21.75] },
  'calendar-start': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'calendar-repeat': { effect: 'spin', parts: ['arrow'], origin: [12, 16.15] },
  'calendar-sparkle': { effect: 'beat', parts: ['badge'], origin: BC },
  'calendar-hourglass': { effect: 'spin', parts: ['badge'], origin: BC },
  'calendar-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'calendar-gear': { effect: 'spin', parts: ['badge'], origin: BC },
  'calendar-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'calendar-star': { effect: 'beat', parts: ['badge'], origin: BC },
  'calendar-question': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'calendar-forward': { effect: 'slide', parts: ['badge'], vector: [2, 0] },
  'calendar-export': { effect: 'slide', parts: ['badge'], vector: [0, -2] },
  'calendar-import': { effect: 'slide', parts: ['badge'], vector: [0, 2] },
  'clock-fast': { effect: 'slide', vector: [2, 0] },
  'clock-in': { effect: 'slide', parts: ['arrow'], vector: [2, 0] },
  'clock-out': { effect: 'slide', parts: ['arrow'], vector: [-2, 0] },
  'hourly-rate': { effect: 'spin', parts: ['hands'], origin: [11.5, 11.5] },
  'break-time': { effect: 'spin', parts: ['hands'], origin: [11.5, 11.5] },
  'clock-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'clock-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  // The clock badge spins its hands in place, as lugares' time-zone
  'shift-day': { effect: 'spin', parts: ['badge'], origin: BC },
  'shift-evening': { effect: 'spin', parts: ['badge'], origin: BC },
  'shift-night': { effect: 'spin', parts: ['badge'], origin: BC },
  'shift-swap': { effect: 'spin', parts: ['arrows'], origin: [12, 12] },
  'watch-analog': { effect: 'spin', parts: ['hands'], origin: [12, 12] },
  'pocket-watch': { effect: 'spin', parts: ['hands'], origin: [12, 14] },
  'punch-clock': { effect: 'spin', parts: ['hands'], origin: [12, 10.35] },
  // The pendulum swings from the dial; the twist timer rings; the hourglass flips over
  'grandfather-clock': { effect: 'ring', parts: ['pendulum'], origin: [12, 11.75] },
  'kitchen-timer': { effect: 'ring', origin: [12, 20.75] },
  'hourglass-start': { effect: 'spin', origin: [12, 12] },
  'hourglass-half': { effect: 'spin', origin: [12, 12] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Mirroring (DESIGN.md › Mirroring) ───────────────────────────────────────────────────────
// What reads in a direction: lists and timelines, the arrows out of a clock or a start line, the
// recurrence loop, growing bars, the pencil. Clocks that turn clockwise never flip; the clocks in
// and out show a single hand at 12, so their arrow can.
for (const name of ['calendar-agenda', 'timeline', 'timeline-list', 'time-block', 'calendar-chart', 'calendar-start', 'calendar-repeat', 'calendar-forward', 'calendar-edit', 'clock-in', 'clock-out'])
  icons[name].mirror = true;

// ── Variants (DESIGN.md › Automatic variants) ───────────────────────────────────────────────
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge or a piece in its place: the filled enclosure doesn't draw it and at 58 % it stops
// reading; the slash would cut through it.
offV(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });
// Clocks: they already come in their own ring.
offV(['clock-range', 'clock-in', 'clock-out'], { circle: false });

export default { category: 'calendario', label: 'Calendario y tiempo', icons };
