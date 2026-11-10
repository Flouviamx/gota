// Entretenimiento (entertainment): the stage and the cinema, the masks and the magic show, the
// circus and the fair's rides, the door of a venue (tickets, wristbands, passes, the guest list),
// awards nights and nightlife. Everything is computed with engine/geometry.mjs; see DESIGN.md.
//
// One stage for the theater family: a straight valance across the top, the floor's edge across the
// bottom and two curtains between them, tied back at the sides (`theater`), framing a screen
// (`theater-screen`) or drawn closed (`theater-curtain`). The two theater masks share one outline.
// The tickets are Núcleo's ticket (soporte's, under a badge), the face is emociones', the hand is
// gestos' flat hand (comunicacion's raised hand), the guest list is social's member list, the
// calendar is Núcleo's and the drive-in's car vehiculos' side car. The fair's rides are drawn in
// profile on their ground. Stamped stars are ink at every weight, as emociones' star eyes.
import { arc, badge, circ, dot, f, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import nucleo from './nucleo.mjs';
import social from './social.mjs';
import soporte from './soporte.mjs';
import vehiculos from './vehiculos.mjs';

// ── Tools ─────────────────────────────────────────────────────────────────────────────────────
const P = ([x, y]) => `${f(x)} ${f(y)}`;
const BR = { square: ['br'] };
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Just the `A…` segment of an engine arc, to chain it inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');
/** Closes every open subpath (for `fill.solid`: the closing segment runs along a solid edge). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
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
/** A custom piece on top: the engine clears the base around `knock` (DESIGN.md › Badges). */
const piece = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** Ellipse with semi-axes rx, ry (four cubics), turned `deg` degrees around its center. */
function ell([cx, cy], rx, ry, deg = 0) {
  const k = 0.5523;
  const Q = (x, y) => P(rot([cx + x, cy + y], [cx, cy], deg));
  return `M${Q(rx, 0)}C${Q(rx, k * ry)} ${Q(k * rx, ry)} ${Q(0, ry)}C${Q(-k * rx, ry)} ${Q(-rx, k * ry)} ${Q(-rx, 0)}C${Q(-rx, -k * ry)} ${Q(-k * rx, -ry)} ${Q(0, -ry)}C${Q(k * rx, -ry)} ${Q(rx, -k * ry)} ${Q(rx, 0)}Z`;
}
/**
 * A stamped star: ink at every weight, its valleys 0.5 from the center so the stroke closes its
 * middle even at 0.9 (emociones' star eyes); a star with a hole closed it at some weights.
 */
const stamp = ([cx, cy], R) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? 0.42 : R, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0 : 0.1)));
/** A five-point star in edicion's proportions (inner radius half the outer), its points rounded. */
function star5([cx, cy], R) {
  const pts = Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? R / 2 : R, -90 + i * 36));
  return roundpoly(pts, pts.map((_, i) => (i % 2 ? R * 0.08 : R * 0.16)));
}
/** datos' four-point sparkle (concave sides). */
function sparkle(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const Q = (x, y) => P([cx + x * R, cy + y * R]);
  return `M${Q(0, -1)}C${Q(a, -b)} ${Q(b, -a)} ${Q(1, 0)}C${Q(b, a)} ${Q(a, b)} ${Q(0, 1)}C${Q(-a, b)} ${Q(-b, a)} ${Q(-1, 0)}C${Q(-b, -a)} ${Q(-a, -b)} ${Q(0, -1)}Z`;
}
/** A point along a cubic Bézier at t. */
const bez = (p0, p1, p2, p3, t) => [0, 1].map((k) => (1 - t) ** 3 * p0[k] + 3 * (1 - t) ** 2 * t * p1[k] + 3 * (1 - t) * t * t * p2[k] + t ** 3 * p3[k]);
/** The x where a cubic (monotonic in y) crosses the height y. */
function bezX(p0, p1, p2, p3, y) {
  let [lo, hi] = [0, 1];
  const down = p3[1] > p0[1];
  for (let i = 0; i < 48; i++) {
    const t = (lo + hi) / 2;
    (bez(p0, p1, p2, p3, t)[1] < y) === down ? (lo = t) : (hi = t);
  }
  return bez(p0, p1, p2, p3, (lo + hi) / 2)[0];
}
/**
 * A cloud of circles [cx, cy, r], listed around it: the outline runs along each circle between the
 * points where it crosses its neighbors (the crossing farther from the cloud's middle).
 */
function cloud(cs) {
  const n = cs.length;
  const mid = [cs.reduce((s, c) => s + c[0], 0) / n, cs.reduce((s, c) => s + c[1], 0) / n];
  const cross = (a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const x = (d * d + a[2] * a[2] - b[2] * b[2]) / (2 * d);
    const h = Math.sqrt(a[2] * a[2] - x * x);
    const u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
    const m = [a[0] + u[0] * x, a[1] + u[1] * x];
    const ps = [[m[0] - u[1] * h, m[1] + u[0] * h], [m[0] + u[1] * h, m[1] - u[0] * h]];
    return ps.sort((p, q) => Math.hypot(q[0] - mid[0], q[1] - mid[1]) - Math.hypot(p[0] - mid[0], p[1] - mid[1]))[0];
  };
  const xs = cs.map((c, i) => cross(c, cs[(i + 1) % n]));
  let d = `M${P(xs[n - 1])}`;
  cs.forEach((c, i) => {
    const [a, b] = [xs[(i - 1 + n) % n], xs[i]];
    const ang = (p) => Math.atan2(p[1] - c[1], p[0] - c[0]);
    let sweep = ang(b) - ang(a);
    while (sweep < 0) sweep += 2 * Math.PI;
    d += `A${f(c[2])} ${f(c[2])} 0 ${sweep > Math.PI ? 1 : 0} 1 ${P(b)}`;
  });
  return `${d}Z`;
}
/**
 * A tuft of hair over the face's edge: lobes of radius r at radius R from the face's center `c`, at
 * the angles `as` (ascending), scalloped on the outside and closed on the inside by an arc of radius
 * `inner` around the face's center, written as `n` arcs so the knock's outline follows the circle
 * (the engine finds the dots a knock takes by the points of its outline: one long arc read as its
 * chord and took the eyes).
 */
function tuft(c, R, as, r, inner, n = 6) {
  const meet = (a, ra, b, rb, far) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const x = (d * d + ra * ra - rb * rb) / (2 * d);
    const h = Math.sqrt(ra * ra - x * x);
    const u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
    const m = [a[0] + u[0] * x, a[1] + u[1] * x];
    const ps = [[m[0] - u[1] * h, m[1] + u[0] * h], [m[0] + u[1] * h, m[1] - u[0] * h]];
    return ps.sort((p, q) => Math.hypot(q[0] - far[0], q[1] - far[1]) - Math.hypot(p[0] - far[0], p[1] - far[1]))[0];
  };
  const cs = as.map((a) => polar(...c, R, a));
  // where the first and last lobes meet the inner arc, on the side away from their neighbors
  const start = meet(cs[0], r, c, inner, cs[1]);
  const end = meet(cs[cs.length - 1], r, c, inner, cs[cs.length - 2]);
  const joints = cs.slice(0, -1).map((p, i) => meet(p, r, cs[i + 1], r, c));
  const pts = [start, ...joints, end];
  const ang = (o, p) => (Math.atan2(p[1] - o[1], p[0] - o[0]) * 180) / Math.PI;
  let d = `M${P(start)}`;
  cs.forEach((o, i) => {
    let span = ang(o, pts[i + 1]) - ang(o, pts[i]);
    while (span < 0) span += 360;
    d += `A${f(r)} ${f(r)} 0 ${span > 180 ? 1 : 0} 1 ${P(pts[i + 1])}`;
  });
  const norm = (a) => ((a % 360) + 360) % 360;
  const [a1, a0] = [norm(ang(c, end)), norm(ang(c, start))];
  for (let k = 1; k <= n; k++) d += `A${f(inner)} ${f(inner)} 0 0 0 ${P(k === n ? start : polar(...c, inner, a1 + ((a0 - a1) * k) / n))}`;
  return `${d}Z`;
}
/** Núcleo's ticket construction at any size: corners of r, notches of nr at mid-height. */
function ticket(x, y, w, h, r = 2.85, nr = 2.25) {
  const [x1, y1, cy] = [x + w, y + h, y + h / 2];
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x1, y + r])}V${f(cy - nr)}A${f(nr)} ${f(nr)} 0 0 0 ${P([x1, cy + nr])}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x1 - r, y1])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y1 - r])}V${f(cy + nr)}A${f(nr)} ${f(nr)} 0 0 0 ${P([x, cy - nr])}Z`;
}

// ── The stage ─────────────────────────────────────────────────────────────────────────────────
// The valance and the floor's edge run across the whole stage. The two curtains meet at the
// valance's middle and sweep apart down to their tiebacks at (5.85, 11.75): above the tieback each
// is a swag closed by it, below it its edge falls free, flaring out to the floor (whole curtains,
// their outer edges down to the floor, drew the stage as a window and took too much ink). Drawn
// once, on the left, and mirrored.
const VALANCE = hl(2.25, 21.75, 3.75);
const FLOOR = hl(2.25, 21.75, 19.75);
const TIE = [5.85, 11.75];
const SWEEP = [[12, 3.75], [11.25, 6.5], [8.75, 9.75], TIE];
const FLARE = [TIE, [6.25, 14.5], [6.75, 17.25], [7.5, 19.75]];
const SWAG = `M3 3.75H12C${P(SWEEP[1])} ${P(SWEEP[2])} ${P(TIE)}H3Z`;
const FALL = `M${P(TIE)}C${P(FLARE[1])} ${P(FLARE[2])} ${P(FLARE[3])}`;
const SWAGS = [SWAG, flipPath(SWAG)];
const FALLS = [FALL, flipPath(FALL)];

// ── The seat ──────────────────────────────────────────────────────────────────────────────────
// A folding seat from the front: the tall back stands on the seat, which runs between the two
// armrest posts that stand on the floor (the row's standards).
const SEAT_BACK = roundline([[7, 12.75], [7, 3.25], [17, 3.25], [17, 12.75]], [0, 3.25, 3.25, 0]);
const SEAT = 'M3 12.75H21V16.25H3Z';
const ARMS = [vl(3, 9.5, 20.75), vl(21, 9.5, 20.75)];

// ── The masks ─────────────────────────────────────────────────────────────────────────────────
// A wide brow, its corners pointed, narrowing to a round chin; the ribbon tied at one corner.
const MASK = 'M4.25 5.25C8.25 3.5 15.75 3.5 19.75 5.25C20.25 13 17.5 19.25 12 20.75C6.5 19.25 3.75 13 4.25 5.25Z';
const RIBBON = (() => {
  // it leaves the mask's right edge at t = 0.1 and flows out to the side
  const o = bez([19.75, 5.25], [20.25, 13], [17.5, 19.25], [12, 20.75], 0.1);
  return `M${P(o)}C${P([o[0] + 1.5, o[1] + 0.25])} ${P([22, o[1] + 1])} ${P([22.1, o[1] + 3.25])}`;
})();
/**
 * An eye hole: half an ellipse 3.5 wide and 3 deep (a half disc closed up at 2.1), flat side down
 * (arched, comedy) or up (tragedy).
 */
const eyeHole = (cx, cy, up = true) => `M${P([cx - 1.75, cy])}A1.75 3 0 0 ${up ? 1 : 0} ${P([cx + 1.75, cy])}Z`;

// ── Tickets and the door ──────────────────────────────────────────────────────────────────────
/** soporte's ticket under a corner badge: its upper dash stops short of the badge's clearance. */
const TICKET_B = soporte.icons['ticket-plus'].d;
const SCAN = comercio.icons['barcode-scan'].d.slice(0, 4);
const HAND = comunicacion.icons['hand-raised'].d;
const MEMBERS = social.icons['member-list'].d;
const CAL = nucleo.icons.calendar.d.slice(0, 4);

// ── The wristband ─────────────────────────────────────────────────────────────────────────────
// The fabric band seen from a little above, a short ring: the top edge whole, the bottom edge's
// front and the two sides, 4 apart. The clasp rides its front on the left, its sides across the
// band and its top and bottom along it, and the loose end hangs out of it; the band's two front
// edges meet the clasp's sides. The clasp stands 2.75 from the band's left side (closer, the hole
// between them shut at the regular weight) and clear of a badge's clearance. (A ring turned at an
// angle, open at its clasp, read as a phone's handset or headphones.)
const WB = { c: [12, 8.5], rx: 8.5, ry: 3.75, h: 4, at: 7.9, half: 1.75, w: 3.25 };
function wristband({ badged = false } = {}) {
  const { c, rx, ry, h, at, half, w } = WB;
  const E = `${f(rx)} ${f(ry)} 0`;
  // the front edges, by angle (0 right, 90 the front, 180 left), dy below the top edge
  const pt = (t, dy = 0) => [c[0] + rx * Math.cos((t * Math.PI) / 180), c[1] + dy + ry * Math.sin((t * Math.PI) / 180)];
  const tOf = (x) => (Math.acos((x - c[0]) / rx) * 180) / Math.PI;
  const t = tOf(at);
  const T = (() => {
    const v = [-rx * Math.sin((t * Math.PI) / 180), ry * Math.cos((t * Math.PI) / 180)];
    const l = Math.hypot(v[0], v[1]);
    return [-v[0] / l, -v[1] / l];
  })();
  const C = pt(t, h / 2);
  const xs = [C[0] - T[0] * half, C[0] + T[0] * half];
  const [tL, tR] = xs.map(tOf);
  const [L, R] = [pt(180), pt(0)];
  // under a badge the bottom edge's right part goes: the badge takes all of it but a sliver at the
  // clasp, which came and went with the weight
  const outer = `M${P(pt(tL, h))}A${E} 0 1 ${P([L[0], L[1] + h])}V${f(L[1])}A${E} 0 1 ${P(R)}V${f(R[1] + h)}${badged ? '' : `A${E} 0 1 ${P(pt(tR, h))}`}`;
  const frontL = `M${P(L)}A${E} 0 0 ${P(pt(tL))}`;
  const frontR = `M${P(pt(tR))}A${E} 0 0 ${P(R)}`;
  const corner = (s, k) => [C[0] + T[0] * s * half, C[1] + T[1] * s * half + k * w];
  const clasp = roundpoly([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], 0.75);
  // the loose end, a strap's end out of the clasp's bottom edge (as a narrow loop its slit shut at 2.1)
  const tail = vl(C[0], C[1] + w, C[1] + w + 2.75);
  // under a badge the top edge stops inside its clearance at x = 13, so no sliver of it is left at
  // the corner; the fill's front stops there too
  const t13 = tOf(13);
  const frontRb = `M${P(pt(tR))}A${E} 0 0 ${P(pt(t13))}`;
  // for the fill: the band's front between its two edges, and the back of its top edge on it
  WB.front = badged
    ? `M${P(L)}V${f(L[1] + h)}A${E} 0 0 ${P(pt(t13, h))}V${f(pt(t13)[1])}A${E} 0 1 ${P(L)}Z`
    : `M${P(L)}V${f(L[1] + h)}A${E} 0 0 ${P([R[0], R[1] + h])}V${f(R[1])}A${E} 0 1 ${P(L)}Z`;
  return [outer, frontL, badged ? frontRb : frontR, clasp, tail];
}

const icons = {
  // ── Stage and cinema ──
  theater: {
    tags: ['teatro', 'escenario', 'función', 'artes escénicas', 'theater', 'stage', 'live show', 'performing arts'],
    d: [VALANCE, ...SWAGS, ...FALLS, FLOOR],
  },
  'theater-screen': {
    tags: ['cine', 'sala de cine', 'cartelera', 'en cines', 'cinema', 'movie theater', 'showtimes', 'now in theaters'],
    // The screen spans the stage between the curtains, which mask its sides: its top 5 under the
    // valance, its bottom 4.25 under the tiebacks and 3.75 over the floor
    d: (() => {
      const x0 = bezX(...SWEEP, 8.75);
      const x1 = bezX(...FLARE, 16);
      return [VALANCE, ...SWAGS, ...FALLS, FLOOR, hl(x0, 24 - x0, 8.25), hl(x1, 24 - x1, 16)];
    })(),
  },
  'theater-curtain': {
    tags: ['telón', 'telón cerrado', 'intermedio', 'próximamente', 'curtain', 'intermission', 'coming soon', 'reveal'],
    // The two curtains hanging straight and meeting at the center, parted a little where they reach
    // the floor, two folds in each 3 apart waving down from the valance most of the way to the floor
    // (straight folds that stopped halfway down read as a comb's teeth)
    d: (() => {
      const meet = 'M12 3.75C12 9.25 11.75 14.75 10.75 19.75';
      const folds = [5, 8].map((x) => `M${x} 3.75C${f(x + 0.9)} 7.5 ${f(x - 0.9)} 11.25 ${x} 15`);
      return [VALANCE, meet, flipPath(meet), ...folds, ...folds.map((d) => flipPath(d)), FLOOR];
    })(),
  },
  'cinema-seat': {
    tags: ['butaca', 'asiento', 'elegir asiento', 'disponibilidad', 'cinema seat', 'seat', 'seat selection', 'seating'],
    d: [SEAT_BACK, SEAT, ...ARMS],
  },
  'cinema-seat-check': {
    tags: ['asiento elegido', 'tu asiento', 'reservado', 'butaca seleccionada', 'seat selected', 'your seat', 'booked', 'reserved seat'],
    d: [SEAT_BACK, SEAT, ...ARMS],
    badge: badge('check'),
  },
  'cinema-seat-row': {
    tags: ['fila de asientos', 'butacas juntas', 'reserva de grupo', 'asientos', 'seat row', 'seats together', 'group booking', 'seating'],
    // Three narrower backs, each a tombstone 3.25 wide and 3 apart, on one seat; the shared armrests
    // run from it down to the floor, as cinema-seat's
    d: [
      ...[5.75, 12, 18.25].map((x) => roundline([[x - 1.625, 13.25], [x - 1.625, 6.5], [x + 1.625, 6.5], [x + 1.625, 13.25]], [0, 1.625, 1.625, 0])),
      'M2.75 13.25H21.25V16.5H2.75Z',
      ...[2.75, 8.875, 15.125, 21.25].map((x) => vl(x, 16.5, 20.75)),
    ],
  },
  'marquee-sign': {
    tags: ['marquesina', 'cartelera iluminada', 'estelar', 'evento destacado', 'marquee', 'now showing', 'headliner', 'featured event'],
    // The board's frame of bulbs, five across 4.375 apart and one at each side, the headline across it,
    // raised on two posts (bulbs 3.75 apart clumped at 18 px, and the shallow canopy under them read
    // as a tray)
    d: [
      ...[3.25, 7.63, 12, 16.38, 20.75].flatMap((x) => [dot(x, 4), dot(x, 14)]),
      dot(3.25, 9),
      dot(20.75, 9),
      hl(7.63, 16.38, 9),
      vl(7.63, 17.75, 21.25),
      vl(16.38, 17.75, 21.25),
    ],
  },
  'drive-in': {
    tags: ['autocinema', 'cine al aire libre', 'película desde el auto', 'drive-in', 'outdoor movie', 'car cinema', 'drive-in theater'],
    // The screen (a screen: the signature corner, as marketing's billboard) raised on two legs and
    // vehiculos' side car parked in front of them, its windows left out (a piece on top: the engine
    // clears the legs and the ground behind it)
    d: [sq(2.75, 2.75, 18.5, 7.5, 2, BR), vl(7.5, 10.25, 20.75), vl(16.5, 10.25, 20.75), hl(2.25, 21.75, 20.75)],
    badge: (() => {
      const k = 0.55;
      const car = vehiculos.icons['car-side'].d.slice(0, 3).map((d) => transform(d, k, 12 - 12 * k, 20.75 - 19.75 * k));
      // it clears its body, its wheels and the ground between them
      const [x0, x1] = [12 - 9.5 * k, 12 + 9.5 * k];
      const sill = 20.75 - (19.75 - 16.5) * k;
      return piece(car, `${car[0]}M${f(x0 + 0.5)} ${f(sill)}H${f(x1 - 0.5)}V21.5H${f(x0 + 0.5)}Z`, { solid: [car[0], ...car.slice(1).map(shut)] });
    })(),
  },
  'glasses-3d': {
    tags: ['lentes 3d', 'función 3d', 'formato 3d', 'cine 3d', '3d glasses', '3d screening', '3d movie', 'stereoscopic'],
    // Two square lenses 3 apart, joined by the frame's bridge; the left one hatched with three
    // diagonals 2.75 apart (the lowest ends where the bridge starts)
    d: (() => {
      const lens = (x) => sq(x, 7.75, 7.75, 7.75, 0.9);
      // x + y = c, 2.75 apart; each one meets the lens on its straight sides, clear of the corners
      const hatch = [12.46, 16.35, 20.24].map((c) => {
        const x0 = Math.max(2.75, c - 15.5);
        const x1 = Math.min(10.5, c - 7.75);
        return line([x0, c - x0], [x1, c - x1]);
      });
      return [lens(2.75), lens(13.5), hl(10.5, 13.5, 9.74), ...hatch];
    })(),
  },
  'opera-glasses': {
    tags: ['binoculares de teatro', 'gemelos', 'ópera', 'palco', 'opera glasses', 'theater binoculars', 'balcony', 'view from seat'],
    // Two barrels 3 apart with their lenses, joined by their bridge, and the handle running down from
    // the right one
    d: [circ(6.5, 8.25, 4), circ(17.5, 8.25, 4), dot(6.5, 8.25), dot(17.5, 8.25), hl(10.5, 13.5, 8.25), line(polar(17.5, 8.25, 4, 105), [19.75, 21.25])],
  },
  spotlight: {
    tags: ['reflector', 'iluminación escénica', 'destacado', 'en el foco', 'spotlight', 'stage light', 'highlight', 'featured'],
    // The can hung from above at the top left, its lens wider than its back, and its beam falling
    // to the pool of light it throws on the floor (on a tripod, tilted up, it read as espacio's
    // telescope)
    d: (() => {
      const C = [6.5, 6.25];
      const pool = [14.25, 18.5];
      const deg = (Math.atan2(pool[1] - C[1], pool[0] - C[0]) * 180) / Math.PI;
      const at = (x, y) => rot([C[0] + x, C[1] + y], C, deg);
      const can = roundpoly([at(-3, -1.75), at(2, -2.75), at(2, 2.75), at(-3, 1.75)], [0.8, 0.6, 0.6, 0.8]);
      const [rx, ry] = [6.75, 2.25];
      const spot = `M${P([pool[0] - rx, pool[1]])}A${rx} ${ry} 0 1 0 ${P([pool[0] + rx, pool[1]])}A${rx} ${ry} 0 1 0 ${P([pool[0] - rx, pool[1]])}Z`;
      // the beam leaves the lens's straight edge, inside its rounded corners
      const beam = [line(at(2, 2), [pool[0] - rx, pool[1]]), line(at(2, -2), [pool[0] + rx, pool[1]])];
      const top = at(-0.5, -2.35);
      return [can, ...beam, spot, line(top, [top[0], 2])];
    })(),
  },
  // ── Masks and magic ──
  'comedy-mask': {
    tags: ['máscara de comedia', 'comedia', 'humor', 'teatro', 'comedy mask', 'comedy', 'humor', 'theater'],
    d: [MASK, eyeHole(8.75, 10.75), eyeHole(15.25, 10.75), 'M8.25 13.75Q12 15.5 15.75 13.75Q15 18 12 18Q9 18 8.25 13.75Z', RIBBON],
  },
  'tragedy-mask': {
    tags: ['máscara de tragedia', 'drama', 'tragedia', 'teatro', 'tragedy mask', 'drama', 'tragedy', 'theater'],
    d: [
      MASK,
      turnPath(eyeHole(9, 8.5, false), -15, [9, 10]),
      turnPath(eyeHole(15, 8.5, false), 15, [15, 10]),
      'M9.5 16.5Q12 15.5 14.5 16.5Q14 13 12 13Q10 13 9.5 16.5Z',
      flipPath(RIBBON),
    ],
  },
  'masquerade-mask': {
    tags: ['antifaz', 'carnaval', 'baile de máscaras', 'disfraz', 'masquerade mask', 'carnival', 'masquerade ball', 'costume party'],
    // The eye mask's wings swept up to points, two almond eye holes, the stick at its lower corner
    d: (() => {
      const outline = 'M12 8.5C10.5 7.5 7.5 6.75 2.75 4.5C2.25 10.5 4 16 8.5 16C10.25 16 11 14.25 12 14.25C13 14.25 13.75 16 15.5 16C20 16 21.75 10.5 21.25 4.5C16.5 6.75 13.5 7.5 12 8.5Z';
      const almond = (cx) => `M${P([cx - 2.25, 11.75])}Q${P([cx, 8.5])} ${P([cx + 2.25, 11.75])}Q${P([cx, 15])} ${P([cx - 2.25, 11.75])}Z`;
      return [outline, almond(8.25), almond(15.75), line([17.75, 15.83], [19.75, 21.25])];
    })(),
  },
  'jester-hat': {
    tags: ['gorro de bufón', 'bufón', 'día de los inocentes', 'carnaval', 'jester hat', 'fool', 'april fools', 'carnival'],
    // A band curving across the brow and three floppy points over it: the side ones droop to the
    // sides, the middle one rises and flops over to the right; a bell at each tip (three points
    // standing up around a middle one read as comercio's crown)
    d: (() => {
      const hat = 'M6 16.5C6 13.5 5.25 11 3.25 11.5C3.75 7.5 5.25 5.75 7.5 6C9 6.25 9.75 7.75 10 9.5C10.5 5.5 12.75 2.75 16 2.75C17.25 2.75 18.25 3.25 19.25 4.25C17.25 4.5 15.75 5.5 14.75 7.75C16.75 7.25 19.5 8.5 20.75 12C19.5 11.75 18.25 13 18 16.5Q12 18.75 6 16.5Z';
      const band = 'M6 16.5Q12 18.75 18 16.5L18.25 19.75Q12 22.25 5.75 19.75Z';
      return [hat, band, dot(3.25, 11.5), dot(19.25, 4.25), dot(20.75, 12)];
    })(),
  },
  'magic-hat': {
    tags: ['sombrero de mago', 'magia', 'truco', 'sorpresa', 'magic hat', 'magic show', 'trick', 'surprise'],
    // A top hat upside down (its thin brim up, the band next to it) and a rabbit peeking out of it:
    // the top of its head and its two long ears, one bent at the tip
    d: [
      hl(2.75, 21.25, 12.5),
      roundpoly([[7, 12.5], [17, 12.5], [18, 21.25], [6, 21.25]], [0, 0, 1.25, 1.25]),
      hl(6.66, 17.34, 15.5),
      `M8.5 12.5${arcTo(12, 12.5, 3.5, 180, 360)}`,
      'M9 10.7C8.25 8 8.25 4.5 9.25 2.75C10.5 3.75 11 6.5 11 9.15',
      'M13 9.15C13 7 13.5 5 14.75 4C15.75 3.25 17.5 3.25 18.5 4C17.25 4.75 15.75 5.75 15.4 7C15.1 8.1 15 9.25 15 10.7',
    ],
  },
  'face-clown': {
    tags: ['payaso', 'circo', 'bromas', 'fiesta infantil', 'clown', 'circus', 'jokes', 'kids party'],
    // emociones' face with face-happy's arched eyes, a round nose and a wide smile, and a curly tuft
    // of hair over each side, four lobes along the face's edge (pieces on top: the engine clears the
    // face around them, clear of the eyes and the smile). Tufts higher up the face read as a koala's
    // ears, and dot eyes fell inside their knock
    d: [circ(12, 12, 9), arc(9, 9.5, 1.5, 180, 360).d, arc(15, 9.5, 1.5, 180, 360).d, circ(12, 13.75, 1.25), arc(12, 12.75, 5.25, 40, 140).d],
    badge: (() => {
      const left = tuft([12, 12], 8.5, [163, 180, 197, 214], 1.75, 8.25);
      const t = [left, flipPath(left)];
      // outlined, a tuft is its scallops: closed, the narrow band inside them opened and shut with the weight
      const curls = t.map((d) => d.replace(/^(M[^A]*(?:A[^A]*){4}).*$/, '$1'));
      return piece(curls, t.join(''), { solid: t });
    })(),
  },
  'crystal-ball': {
    tags: ['bola de cristal', 'adivinación', 'predicción', 'feria', 'crystal ball', 'fortune telling', 'prediction', 'magic show'],
    // The sphere set in a short flared stand, a four-point sparkle inside it
    d: (() => {
      const [c, r, y] = [[12, 10], 7.5, 16.5];
      const dx = Math.sqrt(r * r - (y - c[1]) ** 2);
      return [circ(...c, r), `M${P([12 - dx, y])}L6.25 20.75H17.75L${P([12 + dx, y])}`, sparkle(12, 10, 3.5)];
    })(),
  },
  marionette: {
    tags: ['marioneta', 'títere', 'teatro guiñol', 'teatro infantil', 'marionette', 'puppet', 'puppet show', 'puppetry'],
    // The control bar and its handle, a string from it to the head and one to each hand, and a figure
    // of a round head, a body, arms raised out to the strings and legs (two strings to the head drew a
    // V that, with the arms and the hand strings, read as a cup)
    d: [
      hl(5.5, 18.5, 3),
      vl(12, 1.75, 7),
      vl(5.5, 3, 10.5),
      vl(18.5, 3, 10.5),
      circ(12, 8.75, 1.75),
      roundline([[5.5, 10.5], [9.25, 12.75], [14.75, 12.75], [18.5, 10.5]], 1),
      vl(12, 10.5, 16.25),
      roundline([[8.75, 21.25], [9.5, 17.75], [12, 16.25], [14.5, 17.75], [15.25, 21.25]], 1),
    ],
  },
  'stand-up-comedy': {
    tags: ['stand-up', 'comedia en vivo', 'micrófono abierto', 'club de comedia', 'stand-up comedy', 'open mic', 'comedy club', 'comedian'],
    // A microphone on a straight stand with a round base, and a bar stool beside it
    d: [
      sq(5.25, 2.25, 4, 7, 2),
      hl(5.25, 9.25, 5.5),
      vl(7.25, 9.25, 18),
      'M4 20.75A3.25 2.75 0 0 1 10.5 20.75Z',
      sq(13, 10.25, 8.25, 3, 1.5),
      line([15, 13.25], [13.75, 21]),
      line([19.25, 13.25], [20.5, 21]),
      hl(14.3, 19.95, 17.5),
    ],
  },
  // ── Circus and fair ──
  'circus-tent': {
    tags: ['carpa de circo', 'circo', 'carnaval', 'feria', 'circus tent', 'big top', 'circus', 'carnival'],
    // The peaked big top on its pole with a streamer, its roof's eaves three hanging scallops; the walls
    // rise to the outer ones and the door opens under the middle one
    d: (() => {
      const y = 12 + Math.sqrt(9 - 2.25);
      return [
        `M3 12Q8 10.75 12 6.5Q16 10.75 21 12${arcTo(18, 12, 3, 0, 180)}${arcTo(12, 12, 3, 0, 180)}${arcTo(6, 12, 3, 0, 180)}Z`,
        `M4.5 ${f(y)}L4 20.75H20L19.5 ${f(y)}`,
        line([9.25, 20.75], [12, 15], [14.75, 20.75]),
        vl(12, 2, 6.5),
        'M12 2C13.5 1.75 14.25 3.5 16.25 3',
      ];
    })(),
  },
  unicycle: {
    tags: ['monociclo', 'acto de circo', 'equilibrio', 'artista callejero', 'unicycle', 'circus act', 'balance', 'street performer'],
    // One wheel, the post leaning 12° from the hub up to the saddle, and the crank across the hub with a
    // pedal at each end (three spokes and an upright post drew a peace sign; upright and without
    // them, a stopwatch)
    d: (() => {
      const c = [12.75, 14.75];
      const T = (p) => rot(p, c, -12);
      const [p0, p1] = [polar(...c, 3.25, 160), polar(...c, 3.25, 340)];
      const saddle = roundpoly([[9, 2.5], [16.5, 2.5], [15, 5], [10.5, 5]].map(T), [1.25, 1.25, 1, 1]);
      return [circ(...c, 6.5), line(T([12.75, 5]), c), saddle, line(p0, p1), dot(...p0), dot(...p1)];
    })(),
  },
  'ferris-wheel': {
    tags: ['rueda de la fortuna', 'noria', 'parque de diversiones', 'atracciones', 'ferris wheel', 'amusement park', 'fair', 'attractions'],
    // The wheel with three spokes across it and a gondola at each spoke's end, on an A-frame
    d: (() => {
      const [c, R] = [[12, 10.5], 7.25];
      return [
        circ(...c, R),
        ...[30, 90, 150].map((a) => line(polar(...c, R, a), polar(...c, R, a + 180))),
        ...[30, 90, 150, 210, 270, 330].map((a) => dot(...polar(...c, R, a))),
        line(c, [6.25, 21.25]),
        line(c, [17.75, 21.25]),
      ];
    })(),
  },
  'roller-coaster': {
    tags: ['montaña rusa', 'atracciones extremas', 'parque temático', 'emoción', 'roller coaster', 'thrill ride', 'theme park', 'coaster'],
    // One smooth track rising to a crest and plunging into a valley over its three posts, a car on the
    // plunge (a track of straight runs over its posts read as a chart)
    d: (() => {
      const [S, A, B, C, D] = [[2.25, 17.75], [8, 4.75], [11.25, 4.75], [11.75, 16.75], [15, 16.75]];
      const track = `M${P(S)}C4.25 11 5.5 4.75 ${P(A)}C${P(B)} ${P(C)} ${P(D)}C17.75 16.75 19.5 12.25 21.75 9.5`;
      const at = (q, t) => bez(...q, t);
      const tan = (q, t) => {
        const [a, b] = [at(q, t - 0.01), at(q, t + 0.01)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      };
      // the car rides the plunge, its floor on the rail
      const drop = [A, B, C, D];
      const o = at(drop, 0.42);
      const u = tan(drop, 0.42);
      const n = [u[1], -u[0]];
      const on = (s, k) => [o[0] + u[0] * s + n[0] * k, o[1] + u[1] * s + n[1] * k];
      const car = roundpoly([on(-2, 0), on(2, 0), on(1.5, 2.75), on(-2, 2.75)], [0, 0, 0.9, 0.9]);
      // the last post stands where the final rise crosses x = 19.5
      const rise = [D, [17.75, 16.75], [19.5, 12.25], [21.75, 9.5]];
      let [lo, hi] = [0, 1];
      for (let i = 0; i < 40; i++) {
        const m = (lo + hi) / 2;
        at(rise, m)[0] < 19.5 ? (lo = m) : (hi = m);
      }
      return [track, vl(8, 4.75, 21), vl(15, 16.75, 21), vl(19.5, at(rise, lo)[1], 21), hl(2.25, 21.75, 21), car];
    })(),
  },
  carousel: {
    tags: ['carrusel', 'tiovivo', 'feria', 'juegos infantiles', 'carousel', 'merry-go-round', 'fair', 'kids rides'],
    // The peaked canopy, its edge three hanging scallops (arcs of 120°), on its pole; a horse in
    // profile riding the pole (its back, the neck rising to the head, the muzzle, the chest), its hind
    // and front legs down to the round platform. A horse as a bent block read as a chair, and with it
    // the canopy as a beach umbrella; animales' horse scaled down kept its mane's notches, which
    // closed into holes at the heavy weights
    d: (() => {
      const R = 2.83 / Math.sin(Math.PI / 3);
      const SCALLOP_Y = (x) => 6.5 - R * Math.cos(Math.PI / 3) + Math.sqrt(R * R - (x - 12) ** 2);
      const body = roundpoly(
        [[8.75, 16.75], [8.75, 14.75], [9.75, 13.75], [13.25, 13.75], [15.25, 11.25], [17, 11.25], [19, 13.25], [18.25, 14.5], [16.75, 14.25], [16.25, 16.75]],
        [0.6, 0.6, 0.6, 0.9, 0.6, 0.6, 0.6, 0.5, 0.6, 0.6],
      );
      // its hind and front legs, 2.85 either side of the pole, down to the platform
      const legs = [9.4, 15.1].map((x) => vl(x, 16.75, 19.25));
      return [
        `M3.5 6.5L12 2.25L20.5 6.5${[17.67, 12, 6.33].map((x) => `A${f(R)} ${f(R)} 0 0 1 ${f(x - 2.83)} 6.5`).join('')}Z`,
        vl(12.25, SCALLOP_Y(12.25), 19.25),
        body,
        ...legs,
        sq(5.25, 19.25, 13.5, 2.5, 1.25),
      ];
    })(),
  },
  'bumper-car': {
    tags: ['carritos chocones', 'autos chocones', 'feria', 'atracción', 'bumper car', 'dodgems', 'fair ride', 'amusement'],
    // The small car on its wide rubber skirt, its pole rising from the back to the ceiling's grid
    d: [
      roundpoly([[5, 15.25], [5, 9.5], [8.5, 9.5], [9.75, 12.25], [17.5, 12.25], [19.25, 15.25]], [0, 1.5, 1, 1, 1.5, 0]),
      sq(2.75, 15.25, 18.5, 5.25, 2.625),
      vl(6.5, 3.25, 9.5),
      hl(2.5, 21.5, 3.25),
      line([15.25, 12.25], [13.75, 8.75]),
      line([12.5, 9.35], [15, 8.15]),
    ],
  },
  'teacup-ride': {
    tags: ['tazas locas', 'tazas giratorias', 'juego infantil', 'atracción suave', 'teacup ride', 'spinning teacups', 'kids ride', 'gentle ride'],
    // The teacup on its round platform and an arrow sweeping round it
    d: (() => {
      const a = arc(11, 12.5, 8.5, 190, 350);
      return [
        'M6 10.25H13.75C13.75 14 12.5 16.5 9.875 16.5C7.25 16.5 6 14 6 10.25Z',
        'M13.7 11.5C15.85 11.25 15.85 14.5 13 14.75',
        ell([9.875, 18.25], 5.5, 1.75),
        a.d,
        head(a.end, a.tangent, 3.4),
      ];
    })(),
  },
  'haunted-house': {
    tags: ['casa embrujada', 'casa del terror', 'halloween', 'miedo', 'haunted house', 'horror attraction', 'halloween', 'spooky'],
    // A narrow house leaning 6° under its crooked roof, the eaves overhanging its walls, a round attic
    // window and an arched door, and the crescent moon behind (a house without eaves or a door, its
    // round window in the middle, read as comercio's price tag)
    d: (() => {
      const lean = (d) => turnPath(d, 6, [10.5, 21]);
      const roof = line([2.75, 11.25], [10.25, 3.25], [18.25, 10.75]);
      const walls = line([5.25, 11.25 - 2.5 * (8 / 7.5)], [4.75, 21], [16.5, 21], [16, 3.25 + 5.75 * (7.5 / 8)]);
      const door = `M8.75 21V17.75${arcTo(10.5, 17.75, 1.75, 180, 360)}V21`;
      // the crescent 2.85 thick at its middle, so its own hole holds at every weight
      const [c, r] = [[19.5, 4.5], 2.5];
      const [t, b] = [polar(...c, r, 250), polar(...c, r, 110)];
      const [half, sag] = [r * Math.sin((70 * Math.PI) / 180), c[0] + r - 2.85 - t[0]];
      const ri = (half * half + sag * sag) / (2 * sag);
      const moon = `M${P(t)}A${f(r)} ${f(r)} 0 1 1 ${P(b)}A${f(ri)} ${f(ri)} 0 0 0 ${P(t)}Z`;
      return [lean(roof), lean(walls), lean(door), lean(circ(10.25, 10.25, 1.25)), moon];
    })(),
  },
  'cotton-candy': {
    tags: ['algodón de azúcar', 'feria', 'dulces', 'golosina', 'cotton candy', 'candy floss', 'fair food', 'sweets'],
    // A puffy cloud of floss on a narrow paper cone
    d: (() => {
      const floss = cloud([[7.25, 10.5, 3.25], [9.25, 5.75, 3.25], [14.75, 5.75, 3.25], [16.75, 10.5, 3.25], [12, 13, 3.25]]);
      const y = 13 + Math.sqrt(3.25 ** 2 - 1.75 ** 2);
      return [floss, line([10.25, y], [12, 21.25], [13.75, y])];
    })(),
  },
  // ── Tickets and the door ──
  'ticket-roll': {
    tags: ['rollo de boletos', 'rifa', 'boletos de feria', 'entrada', 'ticket roll', 'raffle', 'arcade tickets', 'admission'],
    // The roll and its hub, and a strip of tickets unrolling from under it, down and away at 22°: the
    // perforation between them and the core ticket's notched end
    d: (() => {
      const [c, r, h, deg] = [[7, 7.5], 4.5, 5.75, 22];
      const u = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
      const n = [-u[1], u[0]];
      // along the strip (s) and across it (t, 0 on its lower edge, tangent to the roll)
      const at = (s, t) => [c[0] + n[0] * r + u[0] * s - n[0] * t, c[1] + n[1] * r + u[1] * s - n[1] * t];
      // the upper edge leaves the roll where it crosses it
      const s0 = Math.sqrt(r * r - (r - h) ** 2);
      const L = 14.75;
      const end = `L${P(at(L - 2, h))}A2 2 0 0 1 ${P(at(L, h - 2))}L${P(at(L, h / 2 + 1.5))}A1.5 1.5 0 0 0 ${P(at(L, h / 2 - 1.5))}L${P(at(L, 2))}A2 2 0 0 1 ${P(at(L - 2, 0))}L${P(at(0, 0))}`;
      return [circ(...c, r), circ(...c, 1.5), `M${P(at(s0, h))}${end}`, line(at(9, 0), at(9, h))];
    })(),
  },
  'ticket-scan': {
    tags: ['escanear boleto', 'validar entrada', 'check-in', 'acceso', 'scan ticket', 'ticket check-in', 'entry validation', 'access'],
    // The core ticket's construction inside comercio's four scan corners, 3 clear of them
    d: [...SCAN, ticket(5.75, 7, 12.5, 10, 2, 1.75), vl(14, 9.85, 14.15)],
  },
  'ticket-arrow-right': {
    tags: ['transferir boleto', 'enviar boleto', 'compartir entrada', 'regalar boleto', 'transfer ticket', 'send ticket', 'share ticket', 'gift ticket'],
    d: [...TICKET_B],
    badge: badge('arrow-right'),
  },
  wristband: {
    tags: ['pulsera', 'brazalete de acceso', 'festival', 'pago sin efectivo', 'wristband', 'festival band', 'access', 'cashless'],
    d: wristband(),
  },
  'wristband-check': {
    tags: ['pulsera activada', 'acceso verificado', 'entrada válida', 'acceso concedido', 'wristband activated', 'entry verified', 'access granted', 'checked in'],
    d: wristband({ badged: true }),
    badge: badge('check'),
  },
  'backstage-pass': {
    tags: ['pase backstage', 'acceso total', 'vip', 'credencial', 'backstage pass', 'all access', 'vip', 'staff credential'],
    // A card with the signature corner hanging from a V-shaped strap, its clip through the slot at the
    // top, and a star on it
    d: [
      line([5.25, 2], [12, 6.5], [18.75, 2]),
      sq(6, 8.5, 12, 12.75, 2.5, BR),
      vl(12, 6.5, 11.5),
      hl(10.25, 13.75, 11.5),
      stamp([12, 16.5], 2.4),
    ],
  },
  'hand-stamp': {
    tags: ['sello en la mano', 'reingreso', 'entrada pagada', 'acceso al club', 'hand stamp', 're-entry', 'paid entry', 'club admission'],
    // gestos' flat hand from the back, its fingers' seams stopping short, and a star stamped on it
    d: [HAND[0], ...[[10.25, 6.25], [13.25, 5.5], [16.25, 8.25]].map(([x, y]) => vl(x, y, 10.5)), stamp([13.5, 15.5], 2.4)],
  },
  'tally-counter': {
    tags: ['contador', 'aforo', 'conteo de asistentes', 'clicker', 'tally counter', 'headcount', 'capacity', 'attendance'],
    // The round body with its small window, the plunger on top and the finger ring below
    d: [circ(12, 11.75, 6.75), sq(8.75, 9.75, 6.5, 3.25, 1), hl(10, 14, 2), vl(12, 2, 5), circ(12, 20.25, 1.75)],
  },
  'member-list-check': {
    tags: ['lista de invitados', 'invitados registrados', 'llegadas', 'check-in', 'guest list', 'checked in', 'arrivals', 'attendees'],
    // The badge takes the third name's place: its clearance left only a stub of it
    d: MEMBERS.slice(0, 5),
    badge: badge('check'),
  },
  'calendar-ticket': {
    tags: ['evento con boleto', 'función reservada', 'día del evento', 'fecha del show', 'ticketed event', 'booked show', 'event day', 'show date'],
    // Núcleo's calendar with a ticket in the badge's place, the core ticket's construction at 9 × 6.75
    d: [...CAL],
    badge: (() => {
      const t = ticket(12.25, 14.5, 9.5, 6.75, 1.5, 1.25);
      return piece([t], t, { solid: [t] });
    })(),
  },
  // ── Awards and nightlife ──
  statuette: {
    tags: ['estatuilla', 'premio', 'ceremonia de premiación', 'nominado', 'statuette', 'award', 'awards night', 'best of'],
    // A five-point star on a slim column, over a base of two steps
    d: (() => {
      const [c, R] = [[12, 6.75], 4.75];
      const valley = polar(...c, R / 2, 90);
      const tip = polar(...c, R, 126);
      const y = (x) => valley[1] + ((x - valley[0]) / (tip[0] - valley[0])) * (tip[1] - valley[1]);
      return [star5(c, R), `M10.5 ${f(y(10.5))}V15.5`, `M13.5 ${f(y(10.5))}V15.5`, sq(8, 15.5, 8, 2.75, 0.75), sq(5.75, 18.25, 12.5, 3, 0.75)];
    })(),
  },
  'disco-ball': {
    tags: ['bola disco', 'discoteca', 'fiesta', 'vida nocturna', 'disco ball', 'nightclub', 'dance party', 'nightlife'],
    // The sphere hanging from a short line, two meridians and two parallels for its facets, a sparkle
    // beside it
    d: (() => {
      const [c, r] = [[11, 13.75], 7.25];
      const w = Math.sqrt(r * r - 3.25 * 3.25);
      const R = (r * r + 3.5 * 3.5) / (2 * 3.5);
      const meridians = `M11 ${f(c[1] - r)}A${f(R)} ${f(R)} 0 0 1 11 ${f(c[1] + r)}A${f(R)} ${f(R)} 0 0 1 11 ${f(c[1] - r)}Z`;
      return [circ(...c, r), vl(11, 2.75, 6.5), meridians, hl(11 - w, 11 + w, 10.5), hl(11 - w, 11 + w, 17), sparkle(19, 4.75, 2.5)];
    })(),
  },
  'quiz-buzzer': {
    tags: ['botón de concurso', 'trivia', 'noche de preguntas', 'responder primero', 'quiz buzzer', 'trivia night', 'game show', 'buzz in'],
    // The push button, a wide flat cap on its collar over the low block, and the arrow pressing it (a
    // dome under rays read as sistema's siren)
    d: [sq(3.25, 16.5, 17.5, 4.5, 1.5), 'M9 16.5V13.5', 'M15 16.5V13.5', 'M5.25 13.5C5.25 11 8.25 9.75 12 9.75S18.75 11 18.75 13.5Z', vl(12, 2.75, 6.75), line([9.75, 4.5], [12, 6.75], [14.25, 4.5])],
  },
};

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index into d: `solid` filled (closed shapes), `cut` knocked out, `lines` on top with a
// clearance of paper, `wire` on top and attached. Badges and pieces carry their own.
const FILL = {
  // The stage: the swags filled, the curtains' falling edges and the valance attached to them
  theater: { solid: [1, 2], wire: [0, 3, 4, 5] },
  'theater-screen': { solid: [1, 2], wire: [0, 3, 4, 5, 6, 7] },

  'cinema-seat': { solid: [1], wire: [2, 3] },
  'cinema-seat-check': { solid: [1], wire: [2, 3] },
  'cinema-seat-row': { solid: [3], wire: [4, 5, 6, 7] },

  'drive-in': { solid: [0], wire: [1, 2, 3] },
  // 3D glasses: the hatched lens filled with its hatch cut out, the clear one left as its outline
  'glasses-3d': { solid: [0], cut: [3, 4, 5], wire: [1, 2] },
  'opera-glasses': { solid: [0, 1], cut: [2, 3], wire: [4, 5] },
  // The spotlight: the can and the pool of light filled, the beam and the hanger attached to them
  spotlight: { solid: [0, 3], wire: [1, 2, 4] },
  'comedy-mask': { solid: [0], cut: [1, 2, 3], wire: [4] },
  'tragedy-mask': { solid: [0], cut: [1, 2, 3], wire: [4] },
  'masquerade-mask': { solid: [0], cut: [1, 2], wire: [3] },
  'jester-hat': { solid: [0, 1, 2, 3, 4] },
  'magic-hat': { solid: [1], cut: [2], wire: [0] },
  'face-clown': { solid: [0], cut: [1, 2, 3, 4] },
  'crystal-ball': { solid: [0], cut: [2] },
  marionette: { solid: [4], wire: [0, 1, 2, 3, 5, 6, 7] },
  'stand-up-comedy': { solid: [0, 3, 4], cut: [1], wire: [2, 5, 6, 7] },
  'circus-tent': { solid: [0], wire: [3, 4] },
  unicycle: { solid: [2], wire: [0, 1, 3, 4, 5] },
  'roller-coaster': { solid: [5], wire: [0, 1, 2, 3, 4] },
  carousel: { solid: [0, 2, 5], wire: [1, 3, 4] },
  'bumper-car': { solid: [0, 1], wire: [2, 3, 4, 5] },
  'teacup-ride': { solid: [0, 2], wire: [1], lines: [3, 4] },
  // The house closes along its roof's underside; the eaves stay attached, the door and window cut out
  'haunted-house': { solid: [4], wire: [0], cut: [2, 3] },
  'ticket-roll': { solid: [0], cut: [1, 3] },
  'ticket-scan': { solid: [4], cut: [5], lines: [0, 1, 2, 3] },
  'ticket-arrow-right': { solid: [0], cut: [1] },
  'backstage-pass': { solid: [1], cut: [3, 4], wire: [0, 2] },
  'hand-stamp': { solid: [0], cut: [1, 2, 3, 4] },
  'tally-counter': { solid: [0], cut: [1], wire: [2, 3, 4] },
  'member-list-check': { solid: [0, 2, 4], lines: [1, 3] },
  'calendar-ticket': { solid: [0], lines: [1, 2], cut: [3] },
  statuette: { solid: [0, 3, 4] },
  'disco-ball': { solid: [0, 5], cut: [2, 3, 4], wire: [1] },
  'quiz-buzzer': { solid: [0, 3], lines: [4, 5] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, ix]) => [k, pick(ix)]));
}
const fillAdd = (name, key, ds) => {
  icons[name].fill[key] = [...(icons[name].fill[key] ?? []), ...ds];
};
// Open strokes that fill close along an edge that is already solid: the seat's back along the seat,
// the rabbit along the brim, the stand and the cone along their sphere and floss, the strip along
// the roll, the giraffe along the rail
for (const name of ['cinema-seat', 'cinema-seat-check']) fillAdd(name, 'solid', [shut(icons[name].d[0])]);
fillAdd('cinema-seat-row', 'solid', [0, 1, 2].map((i) => shut(icons['cinema-seat-row'].d[i])));
fillAdd('magic-hat', 'solid', [3, 4, 5].map((i) => shut(icons['magic-hat'].d[i])));
{
  // the crystal ball's stand, and the sphere's arc over it cut so the two stay apart
  const st = icons['crystal-ball'].d[1];
  const [a, b] = [st.match(/^M([\d.]+) ([\d.]+)/), st.match(/L([\d.]+) ([\d.]+)$/)];
  fillAdd('crystal-ball', 'solid', [shut(st)]);
  fillAdd('crystal-ball', 'cut', [`M${b[1]} ${b[2]}A7.5 7.5 0 0 1 ${a[1]} ${a[2]}`]);
}
{
  const [floss, cone] = icons['cotton-candy'].d;
  const y = f(13 + Math.sqrt(3.25 ** 2 - 1.75 ** 2));
  icons['cotton-candy'].fill = { solid: [floss, shut(cone)], cut: [`M13.75 ${y}A3.25 3.25 0 0 1 10.25 ${y}`] };
}
fillAdd('ticket-roll', 'solid', [shut(icons['ticket-roll'].d[2])]);
// The tent's walls close along the scallops, the door cut out of them
{
  // the walls closed inside the roof (under its solid), around the open door
  const w = icons['circus-tent'].d[1].match(/^M4.5 ([\d.]+)/)[1];
  fillAdd('circus-tent', 'solid', [`M4.5 11.75V${w}L4 20.75H9.25L12 15L14.75 20.75H20L19.5 ${w}V11.75Z`]);
}
// The jester's band stays apart from the hat along the edge they share
fillAdd('jester-hat', 'cut', ['M6 16.5Q12 18.75 18 16.5']);
// The statuette's column closes along the star, and its two steps stay apart
{
  const col = icons.statuette.d[1].match(/^M10.5 ([\d.]+)/)[1];
  fillAdd('statuette', 'solid', [`M10.5 ${col}V15.5H13.5V${col}Z`]);
  fillAdd('statuette', 'cut', [hl(8, 16, 18.25)]);
}
// The buzzer's collar between its cap and its base
fillAdd('quiz-buzzer', 'solid', ['M9 16.5V13.5H15V16.5Z']);
// The wristband's front between its edges and the clasp filled, the back of its top edge and the
// loose end lines on them (the clasp as a line with its clearance split the band at the light weight)
for (const name of ['wristband', 'wristband-check']) {
  const d = icons[name].d;
  wristband({ badged: name === 'wristband-check' });
  icons[name].fill = { solid: [WB.front, d[3]], wire: [d[0], d[1], d[2], d[4]] };
}
// The haunted house's walls closed along the roof's underside
{
  const [roof, walls] = icons['haunted-house'].d;
  const l = walls.match(/^M([\d.]+) ([\d.]+)/);
  const apex = roof.match(/L([\d.]+) ([\d.]+)L/);
  fillAdd('haunted-house', 'solid', [`${walls}L${apex[1]} ${apex[2]}L${l[1]} ${l[2]}Z`]);
}
// Only lines and dots: the closed curtains drawn by their edges, the
// wheel's rim, spokes and gondolas, the sign's bulbs, headline and posts
for (const name of ['theater-curtain', 'ferris-wheel', 'marquee-sign']) icons[name].fill = false;

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const PARTS = {
  theater: { valance: [0], curtains: [1, 2, 3, 4], stage: [5] },
  'theater-screen': { valance: [0], curtains: [1, 2, 3, 4], stage: [5], screen: [6, 7] },
  'theater-curtain': { valance: [0], curtains: [1, 2], folds: [3, 4, 5, 6], stage: [7] },
  'cinema-seat': { back: [0], seat: [1], arms: [2, 3] },
  'cinema-seat-check': { back: [0], seat: [1], arms: [2, 3] },
  'cinema-seat-row': { backs: [0, 1, 2], seat: [3], arms: [4, 5, 6, 7] },
  'marquee-sign': { bulbs: range(0, 11), headline: [12], posts: [13, 14] },
  'drive-in': { screen: [0], legs: [1, 2], ground: [3] },
  'glasses-3d': { lenses: [0, 1], bridge: [2], hatch: [3, 4, 5] },
  'opera-glasses': { barrels: [0, 1], lenses: [2, 3], bridge: [4], handle: [5] },
  spotlight: { lamp: [0], beam: [1, 2], pool: [3], hanger: [4] },
  'comedy-mask': { mask: [0], eyes: [1, 2], mouth: [3], ribbon: [4] },
  'tragedy-mask': { mask: [0], eyes: [1, 2], mouth: [3], ribbon: [4] },
  'masquerade-mask': { mask: [0], eyes: [1, 2], stick: [3] },
  'jester-hat': { hat: [0], band: [1], bells: [2, 3, 4] },
  'magic-hat': { brim: [0], hat: [1], band: [2], rabbit: [3, 4, 5] },
  'face-clown': { face: [0], eyes: [1, 2], nose: [3], mouth: [4] },
  'crystal-ball': { ball: [0], stand: [1], sparkle: [2] },
  marionette: { control: [0], strings: [1, 2, 3], puppet: [4, 5, 6, 7] },
  'stand-up-comedy': { mic: [0, 1], stand: [2, 3], stool: [4, 5, 6, 7] },
  'circus-tent': { roof: [0], walls: [1], door: [2], pole: [3], streamer: [4] },
  unicycle: { wheel: [0], post: [1], saddle: [2], crank: [3, 4, 5] },
  'ferris-wheel': { wheel: [0, 1, 2, 3], gondolas: range(4, 9), frame: [10, 11] },
  'roller-coaster': { track: [0], posts: [1, 2, 3], ground: [4], car: [5] },
  carousel: { canopy: [0], pole: [1], horse: [2, 3, 4], platform: [5] },
  'bumper-car': { car: [0], bumper: [1], pole: [2], grid: [3], steering: [4, 5] },
  'teacup-ride': { cup: [0, 1], platform: [2], arrow: [3, 4] },
  'haunted-house': { roof: [0], house: [1], door: [2], window: [3], moon: [4] },
  'cotton-candy': { floss: [0], cone: [1] },
  'ticket-roll': { roll: [0, 1], strip: [2, 3] },
  'ticket-scan': { frame: [0, 1, 2, 3], ticket: [4, 5] },
  'ticket-arrow-right': { ticket: [0, 1] },
  wristband: { band: [0, 1, 2], clasp: [3, 4] },
  'wristband-check': { band: [0, 1, 2], clasp: [3, 4] },
  'backstage-pass': { lanyard: [0, 2], card: [1], slot: [3], star: [4] },
  'hand-stamp': { hand: [0, 1, 2, 3], stamp: [4] },
  'tally-counter': { body: [0], window: [1], button: [2, 3], ring: [4] },
  'member-list-check': { avatars: [0, 2, 4], names: [1, 3] },
  'calendar-ticket': { body: [0], rings: [1, 2], header: [3] },
  statuette: { star: [0], column: [1, 2], base: [3, 4] },
  'disco-ball': { ball: [0, 2, 3, 4], cord: [1], sparkle: [5] },
  'quiz-buzzer': { base: [0], button: [1, 2, 3], arrow: [4, 5] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
const BC = [17.25, 17.25];
const MOTION = {
  // The spotlight's pool, the marquee's bulbs and the ball's sparkle flash
  spotlight: { effect: 'beat', parts: ['pool'], origin: [14.25, 18.5] },
  'marquee-sign': { effect: 'beat', parts: ['bulbs'], origin: [12, 9] },
  'crystal-ball': { effect: 'beat', parts: ['sparkle'], origin: [12, 10] },
  'disco-ball': { effect: 'beat', parts: ['sparkle'], origin: [19, 4.75] },
  statuette: { effect: 'beat', parts: ['star'], origin: [12, 6.75] },
  // The masks and the jester's bells rock; the puppet and the pass swing from where they hang
  'comedy-mask': { effect: 'wiggle', origin: [12, 20.75] },
  'tragedy-mask': { effect: 'wiggle', origin: [12, 20.75] },
  'masquerade-mask': { effect: 'wiggle', origin: [19.75, 21.25] },
  'jester-hat': { effect: 'wiggle', origin: [12, 19.5] },
  'face-clown': { effect: 'wiggle', origin: [12, 21] },
  marionette: { effect: 'ring', origin: [12, 1.75] },
  'backstage-pass': { effect: 'ring', origin: [12, 2] },
  'circus-tent': { effect: 'wiggle', parts: ['streamer'], origin: [12, 2] },
  'haunted-house': { effect: 'wiggle', parts: ['roof', 'house', 'door', 'window'], origin: [10.5, 21] },
  // Out of the hat, the rabbit pops up; the buttons go down when pressed
  'magic-hat': { effect: 'bounce', parts: ['rabbit'], vector: [0, -1.5] },
  'tally-counter': { effect: 'bounce', parts: ['button'], vector: [0, 1] },
  'quiz-buzzer': { effect: 'bounce', parts: ['button'], vector: [0, 1] },
  // The rides go round, along and back and forth
  'ferris-wheel': { effect: 'spin', parts: ['wheel', 'gondolas'], origin: [12, 10.5] },
  unicycle: { effect: 'spin', parts: ['crank'], origin: [12.75, 14.75] },
  // The carousel's horse rises and falls on its pole
  carousel: { effect: 'bounce', parts: ['horse'], vector: [0, -1.25] },
  'teacup-ride': { effect: 'spin', parts: ['arrow'], origin: [11, 12.5] },
  'roller-coaster': { effect: 'slide', parts: ['car'], vector: [0.55, 1.45] },
  'bumper-car': { effect: 'slide', parts: ['car', 'bumper', 'pole', 'steering'], vector: [1.5, 0] },
  // The tickets: the strip unrolls, the scan frame pulses, the transfer moves on
  'ticket-roll': { effect: 'slide', parts: ['strip'], vector: [1.4, 0.56] },
  'ticket-scan': { effect: 'beat', parts: ['frame'], origin: [12, 12] },
  'ticket-arrow-right': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'cinema-seat-check': { effect: 'beat', parts: ['badge'], origin: BC },
  'wristband-check': { effect: 'beat', parts: ['badge'], origin: BC },
  'member-list-check': { effect: 'beat', parts: ['badge'], origin: BC },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// Redrawn on the pixel grid (a pixel is 1.5, its centers at 0.75 + 1.5k) where the snap leaves a
// smudge: straight runs and 45° diagonals on pixel centers, circles whose extremes land on them,
// and fewer pieces (the masks lose their ribbon, the dots inside small rings become one pixel).
{
  const small = (name, d, fill) => {
    icons[name].small = { d, ...(fill && { fill }) };
  };
  // The stage: the swags as 45° diagonals to their tiebacks, the falls straight down
  const val = hl(2.25, 21.75, 3.75);
  const floor = hl(2.25, 21.75, 20.25);
  const swag = 'M3.75 3.75H11.25L5.25 9.75H3.75Z';
  const swags = [swag, flipPath(swag)];
  const falls = [vl(5.25, 9.75, 20.25), vl(18.75, 9.75, 20.25)];
  small('theater', [val, ...swags, ...falls, floor], { solid: swags, wire: [val, ...falls, floor] });
  const screen = [hl(5.25, 18.75, 12.75), hl(5.25, 18.75, 17.25)];
  small('theater-screen', [val, ...swags, ...falls, floor, ...screen], { solid: swags, wire: [val, ...falls, floor, ...screen] });
  const folds = [5.25, 8.25, 15.75, 18.75].map((x) => vl(x, 3.75, 14.25));
  small('theater-curtain', [val, vl(11.25, 3.75, 20.25), vl(12.75, 3.75, 20.25), ...folds, floor]);
  // 3D glasses: 5-pixel lenses, the hatch two 45° diagonals
  {
    const [l, r] = [sq(2.25, 6.75, 7.5, 7.5, 1), sq(14.25, 6.75, 7.5, 7.5, 1)];
    const hatch = [line([2.25, 11.25], [6.75, 6.75]), line([5.25, 14.25], [9.75, 9.75])];
    const bridge = hl(9.75, 14.25, 8.25);
    small('glasses-3d', [l, r, bridge, ...hatch], { solid: [l], cut: hatch, wire: [r, bridge] });
  }
  // Opera glasses: rings of r 3, a one-pixel lens in each
  {
    const rings = [circ(6.75, 8.25, 3), circ(17.25, 8.25, 3)];
    const lenses = [circ(6.75, 8.25, 0.1), circ(17.25, 8.25, 0.1)];
    const rest = [hl(9.75, 14.25, 8.25), vl(17.25, 11.25, 20.25)];
    small('opera-glasses', [...rings, ...lenses, ...rest], { solid: rings, cut: lenses, wire: rest });
  }
  // The masks: a straight brow, 45° cheeks and a flat chin; comedy's arched eyes and laugh, tragedy's
  // worried brows and frown (emociones' 16 px pieces)
  {
    const mask = roundpoly([[3.75, 3.75], [20.25, 3.75], [20.25, 12.75], [14.25, 18.75], [9.75, 18.75], [3.75, 12.75]], [0.75, 0.75, 1, 0.75, 0.75, 1]);
    const happy = [arc(9, 9.75, 1.5, 180, 360).d, arc(15, 9.75, 1.5, 180, 360).d, `M7.5 12.75H16.5${arcTo(12, 12.75, 4.5, 0, 180)}Z`];
    const sad = [line([7.5, 9.75], [10.5, 8.25]), line([16.5, 9.75], [13.5, 8.25]), `M8.25 17.25H15.75${arcTo(12, 17.25, 3.75, 0, -180)}Z`];
    small('comedy-mask', [mask, ...happy], { solid: [mask], cut: happy });
    small('tragedy-mask', [mask, ...sad], { solid: [mask], cut: sad });
    const eye = roundpoly([[2.25, 3.75], [12, 6.75], [21.75, 3.75], [20.25, 12.75], [15.75, 14.25], [12, 12.75], [8.25, 14.25], [3.75, 12.75]], [0.3, 0.75, 0.3, 1, 0.75, 0.75, 0.75, 1]);
    const slits = [hl(6.75, 9.75, 9.75), hl(14.25, 17.25, 9.75)];
    const stick = line([17.25, 14.25], [18.75, 20.25]);
    small('masquerade-mask', [eye, ...slits, stick], { solid: [eye], cut: slits, wire: [stick] });
  }
  // The wheel: a rim of r 6 on pixel centers, its spokes a cross
  {
    const rim = circ(12.75, 9.75, 6);
    const cross = [hl(6.75, 18.75, 9.75), vl(12.75, 3.75, 15.75)];
    const legs = [line([12.75, 9.75], [8.25, 20.25]), line([12.75, 9.75], [17.25, 20.25])];
    small('ferris-wheel', [rim, ...cross, ...legs]);
  }
  // The clown: emociones' 16 px face and arched eyes, a 2 × 2 pixel nose, the smile, and each tuft
  // two scallops on a straight edge, cleared from the face as at 24
  {
    const face = circ(12, 12, 8.25);
    const marks = [arc(9, 9.75, 1.5, 180, 360).d, arc(15, 9.75, 1.5, 180, 360).d, dot(12, 12.75, 0.8), arc(12, 11.25, 4.5, 40, 140).d];
    const left = 'M5.25 8.25H3.75A1.5 1.5 0 0 0 3.75 11.25A1.5 1.5 0 0 0 3.75 14.25A1.5 1.5 0 0 0 3.75 17.25H5.25Z';
    const t = [left, flipPath(left)];
    icons['face-clown'].small = { d: [face, ...marks], fill: { solid: [face], cut: marks }, badge: piece(t, t.join(''), { solid: t }) };
  }
  // The carousel: the canopy's slopes in steps of two pixels to one, the pole on a pixel column, the
  // horse a body with its neck and head, its two legs and the platform under them
  {
    const canopy = 'M3.75 6.75L9.75 3.75H14.25L20.25 6.75Z';
    const horse = roundpoly([[8.25, 12.75], [15.75, 12.75], [17.25, 11.25], [18.75, 11.25], [18.75, 12.75], [17.25, 14.25], [17.25, 15.75], [8.25, 15.75]], 0.3);
    const rest = [vl(12.75, 6.75, 20.25), vl(9.75, 15.75, 20.25), vl(15.75, 15.75, 20.25), hl(3.75, 20.25, 20.25)];
    small('carousel', [canopy, rest[0], horse, ...rest.slice(1)], { solid: [canopy, horse], wire: rest });
  }
  // The crystal ball: the sphere's extremes on pixel centers, a plus for its sparkle
  {
    const ball = circ(12, 9, 6.75);
    const stand = 'M8.25 14.25L6.75 18.75H17.25L15.75 14.25';
    const plus = [hl(9.75, 12.75, 8.25), vl(11.25, 6.75, 9.75)];
    small('crystal-ball', [ball, stand, ...plus], { solid: [ball, `${stand}Z`], cut: plus });
  }
  // The disco ball: a rim of r 6, its facets a vertical meridian and two parallels, a plus beside it
  {
    const ball = circ(11.25, 14.25, 6);
    const facets = [vl(11.25, 8.25, 20.25), hl(6.75, 15.75, 11.25), hl(6.75, 15.75, 17.25)];
    const plus = [hl(17.25, 20.25, 5.25), vl(18.75, 3.75, 6.75)];
    small('disco-ball', [ball, vl(11.25, 3.75, 8.25), ...facets, ...plus], { solid: [ball], cut: facets, wire: [vl(11.25, 3.75, 8.25), ...plus] });
  }
  // The tally counter: the body, the window, the plunger and the ring, on one pixel column
  {
    const body = circ(12.75, 12.75, 6);
    const win = sq(9.75, 11.25, 6, 3, 0.75);
    const plunger = [hl(11.25, 14.25, 3.75), vl(12.75, 3.75, 6.75)];
    const ring = circ(12.75, 20.25, 1.5);
    small('tally-counter', [body, win, ...plunger, ring], { solid: [body], cut: [win], wire: [...plunger, ring] });
  }
}

// ── Mirror and variants ───────────────────────────────────────────────────────────────────────
// The side cars face the reading direction (vehiculos'), and the transfer goes the way it reads
for (const name of ['drive-in', 'bumper-car', 'ticket-arrow-right']) icons[name].mirror = true;
// Already enclosed: the clown's face is a circle, the scan corners a square frame
icons['face-clown'].variants = { circle: false };
icons['ticket-scan'].variants = { square: false };

export default { category: 'entretenimiento', label: 'Entretenimiento', icons };
