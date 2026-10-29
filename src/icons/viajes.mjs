// Viajes y hospedaje (travel and hospitality): luggage by kind, passports and visas, hotels and
// stays, the hotel's staff and services, room keys and views, beach and pool, resort activities,
// tours and guides, itineraries, generic landmarks and souvenirs. Everything is computed with the
// engine (engine/geometry.mjs) on the rules in DESIGN.md.
//
// One piece per object, reused by its family: lugares' `luggage` (the badged luggage, its handle and
// feet on the other cases) and `passport` (badged; its cover is the visa's page and, smaller, the
// documents'; the open booklet is two of its pages); the hotel's building; the stays on one ground line at one
// scale; personas' bust with the object at the bottom right, as its professions carry theirs; one
// window frame for the room views (hogar's windowpane on its sill); the door hanger; lugares'
// calendar. Containers (cases, pages, cards, screens, the hanger) keep the signature's square
// bottom-right corner, and so do the buildings' walls, as lugares' house; people, round things, tents
// and huts don't. Badges are the engine's; a piece in front of another (a key across a phone, a hut in
// front of its tree, an object on a person's shoulder) is a custom badge and the engine clears what
// lies behind it.
import { arc, badge, circ, dot, f, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import comercio from './comercio.mjs';
import dispositivos from './dispositivos.mjs';
import hogar from './hogar.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes every open subpath, for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
/** Moves a path. */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
const arcd = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d;

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as lugares'. */
function rl(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${pt(V)}`;
      continue;
    }
    const u = unit(sub(A, V));
    const v = unit(sub(B, V));
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const t = r / Math.tan(th / 2);
    const S = add2(V, mul(u, t));
    const E = add2(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}
/** Custom badge: the piece on top, the area the engine clears around it, and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/**
 * The area open strokes clear: each polyline one segment at a time (a bent one would fill as a wedge),
 * each segment closed back on itself so its ends are round joins and the clearance wraps around them
 * (an open segment's butt ends let a stroke in line with it run up to it).
 */
const segs = (...polylines) => polylines.flatMap((pts) => pts.slice(1).map((p, i) => `${line(pts[i], p)}Z`)).join('');

const icons = {};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** The badges' center (DESIGN.md › Badges) and each badge's gesture, as the rest of the set. */
const BC = [17.25, 17.25];
const BADGE_MOTION = {
  plus: { effect: 'beat', parts: ['badge'], origin: BC },
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  x: { effect: 'wiggle', parts: ['badge'], origin: BC },
  heart: { effect: 'beat', parts: ['badge'], origin: BC },
  search: { effect: 'wiggle', parts: ['badge'], origin: BC },
  lock: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  clock: { effect: 'spin', parts: ['badge'], origin: BC },
};
/** A base with one of the engine's badges: the same drawing, fill and parts, and the badge's gesture. */
const badged = (name, tags, base, kind, d = icons[base].d) => {
  add(name, tags, d, { badge: badge(kind) });
  MOTION[name] = BADGE_MOTION[kind];
};

// ── Luggage ───────────────────────────────────────────────────────────────────────────────────
// lugares' luggage: [body, handle, stripe, stripe, foot, foot]. Under a badge its right stripe and
// foot fall inside the badge's clearance (the stripe would leave a stub of 1.3), so they are left out.
const LUG = lugares.icons.luggage.d;
const LUG_B = [LUG[0], LUG[1], LUG[2], LUG[4]];
badged('luggage-lock', ['consigna', 'guardar maletas', 'equipaje guardado', 'luggage storage', 'left luggage', 'bag storage'], null, 'lock', LUG_B);
badged('luggage-check', ['maleta lista', 'equipaje listo', 'viaje confirmado', 'packed', 'ready to go', 'trip confirmed'], null, 'check', LUG_B);
for (const name of ['luggage-lock', 'luggage-check']) {
  FILL[name] = { solid: [0], lines: [1], cut: [2], wire: [3] };
  PARTS[name] = { body: [0], handle: [1], stripes: [2], wheels: [3] };
}
// Rolling case: a portrait case on two wheels (rings hanging from its bottom edge), its telescoping
// handle raised as two rails under a grip that reaches past them, the rails running on as the stripes.
{
  const body = sq(7, 8, 10, 10.5, 2.5, BR);
  const rails = [vl(10, 3, 8), vl(14, 3, 8)];
  const grip = hl(3, 8.75, 15.25);
  const stripes = [vl(10, 11, 15.5), vl(14, 11, 15.5)];
  // Under the case's middle, 3 apart (centered on it: off-center they read as a skew)
  const wheels = [circ(9, 20, 1.5), circ(15, 20, 1.5)];
  add('luggage-rolling', ['maleta con ruedas', 'equipaje', 'mis viajes', 'rolling suitcase', 'trolley bag', 'trips'], [body, grip, ...rails, ...stripes, ...wheels]);
  FILL['luggage-rolling'] = { solid: [0, 6, 7], wire: [1, 2, 3], cut: [4, 5] };
  PARTS['luggage-rolling'] = { body: [0], handle: [1, 2, 3], stripes: [4, 5], wheels: [6, 7] };
}
// Hard-shell spinner: a taller shell with three ribs, its trolley handle down (only the short grip
// shows on top) and a caster at each bottom corner, lugares' feet.
{
  const body = sq(6, 6, 12, 13, 3, BR);
  const grip = rl([[10, 6], [10, 3], [14, 3], [14, 6]], [0, 1, 1, 0]);
  const ribs = [9, 12, 15].map((x) => vl(x, 9, 16));
  add('luggage-hardside', ['maleta rígida', 'maleta de cuatro ruedas', 'tipo de maleta', 'hardside suitcase', 'spinner', 'hard shell'], [body, grip, ...ribs, vl(8.5, 19, 21), vl(15.5, 19, 21)]);
  FILL['luggage-hardside'] = { solid: [0], lines: [1], cut: [2, 3, 4], wire: [5, 6] };
  PARTS['luggage-hardside'] = { body: [0], handle: [1], ribs: [2, 3, 4], wheels: [5, 6] };
}
// A set: the large case and a smaller one beside it, apart, its handle lower.
{
  const big = [sq(2.75, 7.5, 9.75, 11.75, 2.5, BR), rl([[5.75, 7.5], [5.75, 4.25], [9.5, 4.25], [9.5, 7.5]], [0, 1, 1, 0]), vl(7.625, 10.5, 16.25), vl(5.25, 19.25, 21.25), vl(10, 19.25, 21.25)];
  const small = [sq(15.5, 11.5, 5.75, 7.75, 2, BR), rl([[17, 11.5], [17, 8.5], [19.75, 8.5], [19.75, 11.5]], [0, 0.75, 0.75, 0]), vl(16.75, 19.25, 21.25), vl(19.75, 19.25, 21.25)];
  add('luggage-set', ['juego de maletas', 'maletas incluidas', 'cuántas maletas', 'luggage set', 'bags included', 'number of bags'], [...big, ...small]);
  FILL['luggage-set'] = { solid: [0, 5], lines: [1, 6], cut: [2], wire: [3, 4, 7, 8] };
  PARTS['luggage-set'] = { large: [0, 1, 2, 3, 4], small: [5, 6, 7, 8] };
}
// Bell cart: a deck on two wheels under the tall arched rail, one case standing on the deck.
{
  const deck = hl(17.5, 2.75, 21.25);
  const wheels = [circ(6, 19.5, 1.75), circ(18, 19.5, 1.75)];
  const R = 8;
  const rail = `M4.25 17.5V${f(11 - Math.sqrt(R * R - 7.75 * 7.75))}A${R} ${R} 0 0 1 19.75 ${f(11 - Math.sqrt(R * R - 7.75 * 7.75))}V17.5`;
  const bag = rl([[8, 17.5], [8, 11], [16, 11], [16, 17.5]], [0, 2, 2, 0]);
  const handle = rl([[10.5, 11], [10.5, 8.5], [13.5, 8.5], [13.5, 11]], [0, 0.75, 0.75, 0]);
  add('luggage-cart', ['carrito de hotel', 'botones', 'ayuda con equipaje', 'luggage cart', 'bellhop cart', 'porter service'], [rail, deck, ...wheels, bag, handle]);
  FILL['luggage-cart'] = { solid: [2, 3, shut(bag)], wire: [0, 1, 5] };
  PARTS['luggage-cart'] = { cart: [0, 1, 2, 3], bag: [4, 5] };
}
// Bag tag: a tag with a round top end and the signature corner, its eyelet, the strap looped through
// it and a name line.
{
  const tag = `M17 11.5V21.25H9.5A2.5 2.5 0 0 1 7 18.75V11.5A5 5 0 0 1 17 11.5Z`;
  const eyelet = circ(12, 11.5, 1.5);
  const strap = 'M12 10C9.25 7.75 9.5 2.75 12 2.75S14.75 7.75 12 10';
  add('luggage-tag', ['etiqueta de maleta', 'identificar maleta', 'datos del viajero', 'luggage tag', 'name tag', 'bag label'], [tag, eyelet, strap, hl(17, 10, 14)]);
  FILL['luggage-tag'] = { solid: [0], cut: [1, 3], wire: [2] };
  PARTS['luggage-tag'] = { tag: [0, 1], strap: [2], name: [3] };
}

// ── Travel accessories ───────────────────────────────────────────────────────────────────────
// Neck pillow from the front: a thick horseshoe, open at the top, its ends round.
{
  const C = [12, 12.5];
  const [R, r] = [9, 3];
  const m = (R + r) / 2;
  const k = (R - r) / 2;
  const [a0, a1] = [-40, 220];
  const P = (rad, a) => pt(polar(...C, rad, a));
  const pillow = `M${P(R, a0)}A${R} ${R} 0 1 1 ${P(R, a1)}A${f(k)} ${f(k)} 0 0 1 ${P(r, a1)}A${r} ${r} 0 1 0 ${P(r, a0)}A${f(k)} ${f(k)} 0 0 1 ${P(R, a0)}Z`;
  const seam = arcd(...C, m, 20, 160);
  add('travel-pillow', ['almohada de viaje', 'cojín de cuello', 'viaje largo', 'neck pillow', 'travel pillow', 'overnight trip'], [pillow, seam]);
  FILL['travel-pillow'] = { solid: [0], cut: [1] };
  PARTS['travel-pillow'] = { pillow: [0], seam: [1] };
}
// Plug adapter: dispositivos' plug, smaller and up at the left, with the passport's globe (ring,
// meridian and equator, r 3.75) in front of it at the bottom right: a plug for another country. (A
// cube with prongs under it and its socket's two holes on its face read as a robot's face on legs,
// with a recess or with the outlet's ring.)
{
  const plug = dispositivos.icons['power-plug'].d.map((d) => place(d, 0.85, [12, 2.75], [9.25, 2.75]));
  const c = [17.5, 17.5];
  const r = 3.75;
  const ring = circ(...c, r);
  const meridian = `M${pt([c[0], c[1] - r])}C${pt([c[0] + 2, c[1] - r * 0.55])} ${pt([c[0] + 2, c[1] + r * 0.55])} ${pt([c[0], c[1] + r])}C${pt([c[0] - 2, c[1] + r * 0.55])} ${pt([c[0] - 2, c[1] - r * 0.55])} ${pt([c[0], c[1] - r])}Z`;
  const equator = hl(c[1], c[0] - r, c[0] + r);
  // The cable runs on to the foot of the canvas, as the full-size plug's
  add('travel-adapter', ['adaptador de enchufe', 'tipo de enchufe', 'adaptador de viaje', 'travel adapter', 'plug adapter', 'power adapter'], [plug[0], plug[1], plug[2], vl(9.25, 13.16, 21.25)], {
    badge: own([ring, meridian, equator], ring, { solid: [ring], cut: [meridian, equator] }),
  });
  FILL['travel-adapter'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['travel-adapter'] = { body: [0], prongs: [1, 2], cable: [3] };
}

// ── Passports, visas and documents ───────────────────────────────────────────────────────────
// lugares' passport: [cover, globe, meridian, data line]. Under a badge the data line would keep a
// stub of 1.8 and what the clearance left of the meridian merged with the globe's cut end at some
// weights, so the badged passport keeps the cover and the globe's ring.
const PASS = lugares.icons.passport.d;
const PASS_B = PASS.slice(0, 2);
badged('passport-check', ['pasaporte válido', 'documento verificado', 'pasaporte vigente', 'passport verified', 'valid passport', 'document checked'], null, 'check', PASS_B);
badged('passport-clock', ['pasaporte por vencer', 'renovar pasaporte', 'vigencia', 'passport expiring', 'renewal due', 'expiry'], null, 'clock', PASS_B);
for (const name of ['passport-check', 'passport-clock']) {
  FILL[name] = { solid: [0], cut: [1] };
  PARTS[name] = { cover: [0], globe: [1] };
}
// The open booklet: two of the passport's pages side by side over the spine (the signature corner on
// the right page).
const BOOKLET = [sq(2.5, 4.25, 19, 15.5, 3, BR), vl(12, 4.25, 19.75)];
add('passport-open', ['datos del pasaporte', 'página de datos', 'escanear pasaporte', 'passport details', 'data page', 'scan passport'], [
  ...BOOKLET,
  sq(5.5, 8.5, 3.5, 4.5, 1),
  hl(9, 15, 18.5),
  hl(12, 15, 18.5),
  hl(15, 15, 18.5),
]);
FILL['passport-open'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
PARTS['passport-open'] = { booklet: [0, 1], photo: [2], data: [3, 4, 5] };
// Visa: the passport's page with the sticker across its middle as a band, edge to edge, 4.25 of the page
// left above it and below it: the portrait at its left, two lines at its right, everything 3 apart.
// (The seal over the band's lower edge had no room on a page 14.5 wide: under the lines it came 1.5
// from them, at the photo's corner it read as a hinge. A band high on the page with a plain divider
// for the photo read as a layout with a sidebar.)
const VISA = [PASS[0], hl(7, 4.75, 19.25), hl(17, 4.75, 19.25), sq(7.75, 10, 3, 4, 0.75), hl(10.5, 13.75, 16.25), hl(13.5, 13.75, 16.25)];
add('travel-visa', ['visa', 'permiso de entrada', 'requisitos de visa', 'visa', 'entry permit', 'visa application'], VISA);
FILL['travel-visa'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
PARTS['travel-visa'] = { page: [0], sticker: [1, 2, 3, 4, 5] };
// Under a badge the lines fall at the edge of its clearance (the lower one would keep a stub, the upper
// one was nicked at some weights and not at others): the sticker keeps its band and the portrait, whose
// corner stands 7.27 from the badge's center, clear of it
badged('travel-visa-check', ['visa aprobada', 'visa concedida', 'entrada permitida', 'visa approved', 'visa granted', 'entry allowed'], null, 'check', VISA.slice(0, 4));
badged('travel-visa-x', ['visa negada', 'visa rechazada', 'entrada denegada', 'visa denied', 'visa refused', 'entry denied'], null, 'x', VISA.slice(0, 4));
for (const name of ['travel-visa-check', 'travel-visa-x']) {
  FILL[name] = { solid: [0], cut: [1, 2, 3] };
  PARTS[name] = { page: [0], sticker: [1, 2, 3] };
}
// Documents: the passport, smaller, in front of a ticket tucked behind it that sticks out at the top
// right, the notch of the core ticket in its right edge (without it the ticket read as a second card:
// the pair was the copy icon); the ticket's edges stop 3 from the passport. At 0.75 the globe's
// meridian closed up at bold, so the small passport's globe is the ring and a straight meridian, and
// its data line (2.6 from the bottom edge) is left out.
// Travel insurance: comercio's insurance canopy over a small case with its handle.
{
  const canopy = comercio.icons.insurance.d[0];
  add('insurance-travel', ['seguro de viaje', 'asistencia en viaje', 'cancelación', 'travel insurance', 'trip protection', 'travel cover'], [
    canopy,
    sq(7.5, 16.25, 9, 5, 1.75, BR),
    rl([[10, 16.25], [10, 13.25], [14, 13.25], [14, 16.25]], [0, 0.75, 0.75, 0]),
  ]);
  FILL['insurance-travel'] = { solid: [0, 1], wire: [2] };
  PARTS['insurance-travel'] = { canopy: [0], case: [1, 2] };
}

// ── Hotels and stays ─────────────────────────────────────────────────────────────────────────
// Hotel: a tall building (the walls keep lugares' square bottom-right corner) with a grid of window
// dots and the canopy over its door, standing out on two thin poles.
const HOTEL = [
  sq(4.25, 2.75, 15.5, 18.5, 3.25, BR),
  ...[6.25, 9.25, 12.25].flatMap((y) => [8, 12, 16].map((x) => dot(x, y, 0.3))),
  roundpoly([[8.75, 15.25], [15.25, 15.25], [16.75, 17.5], [7.25, 17.5]], [0.6, 0.6, 0.6, 0.6]),
  vl(8.25, 17.5, 21.25),
  vl(15.75, 17.5, 21.25),
];
add('hotel', ['hotel', 'hospedaje', 'alojamiento', 'hotel', 'lodging', 'stays'], HOTEL);
// Under a badge the canopy and its poles fall inside the clearance (what was left read as an f), so
// the badged hotels are the building and its windows, less the two the clearance reaches at some
// weights and not at others.
{
  const d = HOTEL.slice(0, 9).filter((_, i) => i !== 6 && i !== 8);
  badged('hotel-search', ['buscar hotel', 'buscar hospedaje', 'disponibilidad', 'find stays', 'search hotels', 'hotel search'], null, 'search', d);
  badged('hotel-check', ['reserva confirmada', 'hotel reservado', 'estancia confirmada', 'booking confirmed', 'stay booked', 'reservation'], null, 'check', d);
  badged('hotel-heart', ['hoteles guardados', 'lista de deseos', 'favoritos', 'saved stays', 'wishlist', 'favorite hotel'], null, 'heart', d);
  for (const name of ['hotel-search', 'hotel-check', 'hotel-heart']) {
    FILL[name] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
    PARTS[name] = { building: [0], windows: [1, 2, 3, 4, 5, 6] };
  }
}
FILL.hotel = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
PARTS.hotel = { building: [0], windows: [1, 2, 3, 4, 5, 6, 7, 8, 9], canopy: [10, 11, 12] };

// Motel: a long single-story block under a low hip roof (its foot sharp, where the walls meet it), three
// doors in a row along its foot (2.94 from each other and from the walls) and, at its right end, a post
// rising from the roof to hold the sign board. (A rounded block with the doors and a small board on a
// thin post read as dispositivos' router: the roof makes it a building. Taller doors and a wider board
// took it past the ink a drawing can carry.)
{
  const door = (x) => rl([[x, 21], [x, 18], [x + 2.25, 18], [x + 2.25, 21]], [0, 0.6, 0.6, 0]);
  const walls = rl([[2.75, 13.75], [2.75, 21], [21.25, 21], [21.25, 13.75]], [0, 1.25, 0, 0]);
  add('motel', ['motel', 'hospedaje de carretera', 'tipo de propiedad', 'motel', 'roadside lodging', 'motor inn'], [
    roundpoly([[5, 11.5], [19, 11.5], [21.25, 13.75], [2.75, 13.75]], [0.75, 0.75, 0, 0]),
    walls,
    ...[5.69, 10.88, 16.06].map(door),
    vl(18, 7.5, 11.5),
    sq(15.25, 3.75, 5.5, 3.75, 1.25, BR),
  ]);
  // Filled, the walls close along the roof's foot, under it
  FILL.motel = { solid: [0, shut(walls), 6], cut: [2, 3, 4], wire: [5] };
  PARTS.motel = { roof: [0], building: [1], doors: [2, 3, 4], sign: [5, 6] };
}
// Inn: a small gabled house (lugares' pitch) with its door, and the inn's sign out of its wall: an iron
// bracket (the arm and the quarter-round brace under it) with the board hung right under the arm's
// outer half. (On a plain arm, low beside the door, the board and its two hangers read as a small bag
// with its handle; on the bracket, hangers and board read as a padlock and its shackle.)
{
  const k = 7.75 / 9.25;
  const apex = [8, 5.25];
  const roofAt = (x) => apex[1] + Math.abs(x - apex[0]) * k;
  add('inn', ['posada', 'casa de huéspedes', 'bed and breakfast', 'inn', 'guesthouse', 'b&b'], [
    rl([[2.75, roofAt(2.75)], apex, [13.25, roofAt(13.25)]], [0, 1.25, 0]),
    rl([[4.25, roofAt(4.25)], [4.25, 21], [11.75, 21], [11.75, roofAt(11.75)]], [0, 2, 0, 0]),
    rl([[6.5, 21], [6.5, 16.75], [9.5, 16.75], [9.5, 21]], [0, 1, 1, 0]),
    hl(12.5, 11.75, 21.25),
    arcd(11.75, 12.5, 3, 0, 90),
    sq(16.75, 12.5, 4.5, 4.25, 0.75, BR),
  ]);
  FILL.inn = { solid: [shut(rl([[4.25, roofAt(4.25)], apex, [11.75, roofAt(11.75)], [11.75, 21], [4.25, 21]], [0, 1.25, 0, 0, 2])), 5], wire: [0, 3, 4], cut: [2] };
  PARTS.inn = { roof: [0], walls: [1], door: [2], sign: [3, 4, 5] };
}
// Resort: a low building in two levels (a row of window dots on each) and a palm standing at its lower
// end, clear of its walls (in front of them, the clearance cut the walls into pieces that came and
// went with the weight).
{
  const T = [6, 8.5];
  const palm = [
    `M${pt(T)}C6.5 12.5 6.25 17 5.25 21`,
    `M${pt(T)}A4.75 4.75 0 0 0 2.75 12.25`,
    `M${pt(T)}A4.75 4.75 0 0 1 9.5 11.5`,
    `M${pt(T)}A4.25 4.25 0 0 0 3.25 4.75`,
    `M${pt(T)}A4.25 4.25 0 0 1 9 4.5`,
  ];
  const body = roundpoly([[9.25, 21], [9.25, 14.5], [12.75, 14.5], [12.75, 8], [21.25, 8], [21.25, 21]], [1.75, 1.25, 0.6, 1.5, 1.5, 0]);
  const windows = [dot(15.5, 11.25, 0.3), dot(18.5, 11.25, 0.3), dot(12, 17.75, 0.3), dot(15.25, 17.75, 0.3), dot(18.5, 17.75, 0.3)];
  add('resort', ['resort', 'todo incluido', 'vacaciones', 'resort', 'all-inclusive', 'holiday'], [body, ...windows, ...palm]);
  FILL.resort = { solid: [0], cut: [1, 2, 3, 4, 5], wire: [6, 7, 8, 9, 10] };
  PARTS.resort = { building: [0], windows: [1, 2, 3, 4, 5], palm: [6, 7, 8, 9, 10] };
}

// ── Stays: one ground line (21), one scale ──────────────────────────────────────────────────
const GROUND = 21;
const groundLine = hl(GROUND, 2.75, 21.25);
/** Waves of amplitude 1 (lugares' water), `n` half periods of `h` from x0. */
function ripple(y, x0, n, h) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (s * 4) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4) / 3])} ${pt([x + h, y])}`;
  }
  return d;
}
// Overwater villa: a hut under a tall pitched roof, its two walls running on down as the stilts past
// the deck, two waves between them.
add('overwater-bungalow', ['villa sobre el agua', 'bungaló', 'trópico', 'overwater villa', 'overwater bungalow', 'tropical stay'], [
  roundpoly([[12, 2.75], [20.75, 9.75], [3.25, 9.75]], [1.25, 0.75, 0.75]),
  hl(12.5, 3.75, 20.25),
  vl(5.75, 9.75, GROUND),
  vl(18.25, 9.75, GROUND),
  ripple(16, 8.75, 2, 3.25),
  ripple(20, 8.75, 2, 3.25),
]);
FILL['overwater-bungalow'] = { solid: [0], wire: [1, 2, 3], lines: [4, 5] };
PARTS['overwater-bungalow'] = { roof: [0], deck: [1], stilts: [2, 3], water: [4, 5] };
// Treehouse: the hut (roof, walls and the platform it stands on) in front of a round crown, as a custom
// badge so the engine clears the crown behind it; the trunk below, on the ground.
{
  const roof = roundpoly([[12, 7.75], [16.75, 11.75], [7.25, 11.75]], [1, 0.6, 0.6]);
  const walls = rl([[8.5, 11.75], [8.5, 15.75], [15.5, 15.75], [15.5, 11.75]], [0, 0, 0, 0]);
  const deck = hl(15.75, 6.25, 17.75);
  add('treehouse', ['casa del árbol', 'casa en el árbol', 'renta vacacional', 'treehouse', 'tree house', 'unique stay'], [lugares.icons.tree.d[0], vl(12, 11, GROUND), groundLine], {
    badge: own([roof, walls, deck], `${roof}${shut(walls)}${deck}`, { solid: [roof, shut(walls)], wire: [deck] }),
  });
  FILL.treehouse = { solid: [0], wire: [1, 2] };
  PARTS.treehouse = { crown: [0], trunk: [1], ground: [2] };
}
// Dome: a half dome on the ground, two ribs curving from its foot up to its crown, and a small door.
{
  const R = 8.5;
  const top = [12, GROUND - R];
  // A rib: a circular arc of r 10 from the foot to the crown, bulging outward
  const rib = (x, side) => `M${pt([x, GROUND])}A10 10 0 0 ${side > 0 ? 0 : 1} ${pt(top)}`;
  add('dome-house', ['domo', 'glamping', 'domo geodésico', 'dome', 'geodesic dome', 'glamping dome'], [
    arcd(12, GROUND, R, 180, 360),
    rib(7.25, -1),
    rib(16.75, 1),
    rl([[10.5, GROUND], [10.5, 18], [13.5, 18], [13.5, GROUND]], [0, 1, 1, 0]),
    groundLine,
  ]);
  FILL['dome-house'] = { solid: [shut(arcd(12, GROUND, R, 180, 360))], cut: [1, 2, 3], wire: [4] };
  PARTS['dome-house'] = { dome: [0, 1, 2], door: [3], ground: [4] };
}
// Yurt: a round tent from the side: the low cone roof cut flat at its crown, its eave and the wall's
// band curving round the drum (the curves say it is round), the short wall and the door. (Straight
// eaves with a zigzag lattice band read as a barn's truss; a flat-topped roof on a box, as a garage.) The
// eave, the band and the low door stand 2.75 to 3 apart down the middle, so none of them merge at bold.
{
  const [ey, sag] = [11.5, 1.25];
  const eaveAt = (x) => ey + sag * Math.sqrt(Math.max(0, 1 - ((x - 12) / 9.25) ** 2));
  const roof = `M${pt([2.75, ey])}L10.25 6.5H13.75L${pt([21.25, ey])}A9.25 ${sag} 0 0 1 ${pt([2.75, ey])}Z`;
  const [wl, wr] = [[4.5, eaveAt(4.5)], [19.5, eaveAt(19.5)]];
  add('yurt', ['yurta', 'glamping', 'tienda redonda', 'yurt', 'ger', 'glamping tent'], [
    roof,
    vl(4.5, wl[1], GROUND),
    vl(19.5, wr[1], GROUND),
    'M4.5 15A7.5 0.75 0 0 0 19.5 15',
    rl([[10.5, GROUND], [10.5, 18.5], [13.5, 18.5], [13.5, GROUND]], [0, 0.6, 0.6, 0]),
    groundLine,
  ]);
  // Filled, the roof and the drum are one silhouette (an eave knocked out between the walls ended on their
  // edges and parted them at some weights only); the band and the door are knocked out
  FILL.yurt = { solid: [0, shut(line(wl, [4.5, GROUND], [19.5, GROUND], wr))], cut: [3, 4], wire: [1, 2, 5] };
  PARTS.yurt = { roof: [0], wall: [1, 2, 3], door: [4], ground: [5] };
}
// Igloo: a dome of snow blocks (two courses across it) and the rounded tunnel at its left foot; the
// dome and the courses stop where they meet the tunnel.
{
  const [D, R] = [[13.25, GROUND], 8];
  const [Tc, Tr] = [[6.25, GROUND], 3.75];
  // Where the dome meets the tunnel
  const dd = D[0] - Tc[0];
  const ax = (dd * dd + Tr * Tr - R * R) / (2 * dd);
  const meetX = Tc[0] + ax;
  const meetY = GROUND - Math.sqrt(Tr * Tr - ax * ax);
  const dome = `M${pt([meetX, meetY])}A${R} ${R} 0 0 1 ${pt([D[0] + R, GROUND])}`;
  const across = (y) => {
    const hw = Math.sqrt(R * R - (GROUND - y) ** 2);
    const tx = GROUND - y < Tr ? Tc[0] + Math.sqrt(Tr * Tr - (GROUND - y) ** 2) : D[0] - hw;
    return hl(y, tx, D[0] + hw);
  };
  add('igloo', ['iglú', 'hotel de hielo', 'viaje al ártico', 'igloo', 'ice hotel', 'arctic trip'], [dome, arcd(...Tc, Tr, 180, 360), across(15.75), across(18.25), vl(15.25, 15.75, 18.25), vl(12.5, 18.25, GROUND), vl(18, 18.25, GROUND), groundLine]);
  FILL.igloo = { solid: [shut(`${dome}L${pt([meetX, GROUND])}`), shut(arcd(...Tc, Tr, 180, 360))], cut: [2, 3, 4, 5, 6], wire: [7] };
  PARTS.igloo = { dome: [0], tunnel: [1], blocks: [2, 3, 4, 5, 6], ground: [7] };
}
// Cabana: a canopy on its posts with a lounger under it (the sun lounger's backrest and bed, smaller,
// on two legs to the ground). (With its curtains swept back to the posts it read as a theater's stage,
// with or without a daybed under it.)
add('cabana', ['cabaña de playa', 'camastro con toldo', 'day bed', 'cabana', 'poolside cabana', 'daybed'], [
  roundpoly([[5, 4.25], [19, 4.25], [21.25, 8.5], [2.75, 8.5]], [1, 1, 0.6, 0.6]),
  vl(4.25, 8.5, GROUND),
  vl(19.75, 8.5, GROUND),
  rl([[7.5, 12], [9.75, 16.25], [16.75, 16.25]], [0, 1, 0]),
  vl(11, 16.25, GROUND),
  vl(16, 16.25, GROUND),
  groundLine,
]);
FILL.cabana = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
PARTS.cabana = { canopy: [0], posts: [1, 2], lounger: [3, 4, 5], ground: [6] };
// Palapa: a shallow cone of thatch on its pole, a fringe of short strokes along the eave.
add('palapa', ['palapa', 'sombra de playa', 'club de playa', 'palapa', 'thatched umbrella', 'beach shade'], [
  roundpoly([[12, 4.5], [21.25, 11], [2.75, 11]], [1, 0.75, 0.75]),
  vl(12, 11, GROUND),
  ...[4.75, 7.75, 16.25, 19.25].map((x) => vl(x, 11, 13.25)),
  groundLine,
]);
FILL.palapa = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
PARTS.palapa = { roof: [0, 2, 3, 4, 5], pole: [1], ground: [6] };

// ── Hotel staff (personas' bust; the object at the bottom right, on top of the shoulder) ──────────
const PERSON = nucleo.icons.person.d;
const PERSON_L = PERSON.map((d) => move(d, -2.5, 0));
/** Núcleo's person scaled from the feet, its head moved up to keep 2.35 from the shoulders (personas'). */
const personAt = (s) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12, 20.6 - up]), place(PERSON[1], s, [12, 20.6], [12, 20.6])];
};
// Bellhop: the bust at 85 % (personas' hats), wearing the round pillbox cap; the head's arc ends on the
// cap's lower edge.
{
  const s = 0.85;
  const hatted = personAt(s);
  const HC = [12, 20.6 + (7.45 - 20.6) * s - Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s)];
  const HR = 3.7 * s;
  // The cap worn at a tilt: a box 6 × 4 turned -10° about the middle of its lower edge
  const [B, tilt] = [[12, 6.75], -10];
  const u = [Math.cos((tilt * Math.PI) / 180), Math.sin((tilt * Math.PI) / 180)];
  const v = [-u[1], u[0]];
  const at = (x, y) => add2(B, add2(mul(u, x), mul(v, y)));
  const cap = roundpoly([at(-3, -4), at(3, -4), at(3, 0), at(-3, 0)], [1.25, 1.25, 0.75, 0.75]);
  // Where the cap's lower edge crosses the head: the face runs from there round the chin
  const w = sub(B, HC);
  const bq = w[0] * u[0] + w[1] * u[1];
  const cq = w[0] * w[0] + w[1] * w[1] - HR * HR;
  const ts = [-bq + Math.sqrt(bq * bq - cq), -bq - Math.sqrt(bq * bq - cq)];
  const [pR, pL] = ts.map((t) => add2(B, mul(u, t)));
  const ang = (p) => (Math.atan2(p[1] - HC[1], p[0] - HC[0]) * 180) / Math.PI;
  const face = arcd(...HC, HR, ang(pR), ang(pL) < ang(pR) ? ang(pL) + 360 : ang(pL));
  add('bellhop', ['botones', 'maletero', 'servicio de equipaje', 'bellhop', 'porter', 'bellboy'], [face, hatted[1], cap]);
  FILL.bellhop = { solid: [shut(face), 1, 2] };
  PARTS.bellhop = { head: [0], body: [1], hat: [2] };
}
// Concierge: the bust on the left and a small service bell at its side (restaurante's bell at badge
// size: the dome on its base, the plunger and its knob).
{
  const dome = arcd(17, 20, 3.25, 180, 360);
  const base = hl(20, 12.75, 21.25);
  const plunger = vl(17, 16.75, 14.25);
  const knob = hl(14.25, 15.75, 18.25);
  add('concierge', ['conserje', 'concierge', 'recomendaciones', 'concierge', 'front desk', 'guest services'], PERSON_L, {
    badge: own([dome, base, plunger, knob], `${shut(dome)}${segs([[12.75, 20], [21.25, 20]], [[17, 16.75], [17, 14.25]], [[15.75, 14.25], [18.25, 14.25]])}`, { solid: [shut(dome)], wire: [base, plunger, knob] }),
  });
}
// Host: the bust and a key standing at its side, its bow up.
{
  const bow = circ(17, 14.5, 2.25);
  const blade = vl(17, 16.75, 21.25);
  const teeth = [hl(19, 17, 19.25), hl(21.25, 17, 19.25)];
  add('host', ['anfitrión', 'contactar al anfitrión', 'perfil del anfitrión', 'host', 'hosted by', 'contact host'], PERSON_L, {
    badge: own([bow, blade, ...teeth], `${bow}${segs([[17, 16.75], [17, 21.25]], [[17, 19], [19.25, 19]], [[17, 21.25], [19.25, 21.25]])}`, { solid: [bow], wire: [blade, ...teeth] }),
  });
}
// Travel agent: the bust and a small globe at its side (the passport's globe with an equator: with the
// meridian alone, at the bust's side it read as a ball).
{
  const c = [17, 16.75];
  const r = 4.25;
  const ring = circ(...c, r);
  const meridian = `M${pt([c[0], c[1] - r])}C${pt([c[0] + 2.25, c[1] - r * 0.55])} ${pt([c[0] + 2.25, c[1] + r * 0.55])} ${pt([c[0], c[1] + r])}C${pt([c[0] - 2.25, c[1] + r * 0.55])} ${pt([c[0] - 2.25, c[1] - r * 0.55])} ${pt([c[0], c[1] - r])}Z`;
  const equator = hl(c[1], c[0] - r, c[0] + r);
  add('travel-agent', ['agente de viajes', 'agencia de viajes', 'asesor de viajes', 'travel agent', 'travel agency', 'trip advisor'], PERSON_L, {
    badge: own([ring, meridian, equator], ring, { solid: [ring], cut: [meridian, equator] }),
  });
}
for (const name of ['concierge', 'host', 'travel-agent']) {
  FILL[name] = { solid: [0, 1] };
  PARTS[name] = { head: [0], body: [1] };
}
// Tour guide: personas' standing figure on the left, one arm hanging and the other raised to hold up a
// short pole with a pennant.
{
  const HRF = 1.9;
  const cx = 9.25;
  const P = [cx, 14.25];
  const S = [cx, 8.75];
  const H = [cx, S[1] - HRF - 2.35];
  const sharp = (pts, at) => rl(pts, pts.map((p) => (p[0] === at[0] && p[1] === at[1] ? 0 : 0.6)));
  const hang = [[cx - 3.25, S[1] + 5.65], [cx - 2.5, S[1] + 1.65], S];
  const raised = [S, [13.5, 10.25], [16, 7.5]];
  add('tour-guide', ['guía de turistas', 'visita guiada', 'tour', 'tour guide', 'guided tour', 'local guide'], [
    circ(...H, HRF),
    line(S, P),
    sharp([[cx - 2.25, 21.25], P, [cx + 2.25, 21.25]], P),
    sharp([...hang, ...raised.slice(1)], S),
    vl(16, 12.25, 2.75),
    roundpoly([[16, 2.75], [20.75, 4.5], [16, 6.25]], [0.4, 0.6, 0.4]),
  ]);
  FILL['tour-guide'] = { solid: [0, 5], wire: [1, 2, 3, 4] };
  PARTS['tour-guide'] = { head: [0], body: [1], legs: [2], arms: [3], pennant: [4, 5] };
}

// ── Hotel services ───────────────────────────────────────────────────────────────────────────
// Room service: the trolley's top with restaurante's cloche on it, the cloth hanging over its front,
// two wheels below it.
{
  // The cloth falls straight from the top and ends in three scallops, the wheels under the outer two
  const c = (19.75 - 4.25) / 3;
  // Each scallop: an arc 1 deep across its chord c
  const R = f(((c * c) / 4 + 1) / 2);
  const cloth = `M4.25 12.75V17${[1, 2, 3].map((i) => `A${R} ${R} 0 0 0 ${pt([4.25 + c * i, 17])}`).join('')}V12.75`;
  add('room-service', ['servicio a la habitación', 'comida en el cuarto', 'carrito de servicio', 'room service', 'in-room dining', 'service trolley'], [
    hl(12.75, 2.75, 21.25),
    arcd(12, 12.75, 5.5, 180, 360),
    circ(12, 5.75, 1.5),
    cloth,
    circ(4.25 + c / 2, 19.5, 1.5),
    circ(19.75 - c / 2, 19.5, 1.5),
  ]);
  FILL['room-service'] = { solid: [shut(arcd(12, 12.75, 5.5, 180, 360)), 2, shut(cloth), 4, 5], wire: [0] };
}
PARTS['room-service'] = { cloche: [1, 2], trolley: [0, 3], wheels: [4, 5] };
// Door hanger: a tall card (the signature corner) with its round hole near the top and the slit from
// the hole out to the edge.
const HANGER = [sq(6.25, 2.75, 11.5, 18.5, 3, BR), circ(12, 7.75, 2.25), line(polar(12, 7.75, 2.25, 135), [6.25, 13.5])];
add('door-hanger', ['letrero de puerta', 'arreglar la habitación', 'limpieza', 'door hanger', 'make up room', 'room sign'], HANGER);
FILL['door-hanger'] = { solid: [0], cut: [1, 2] };
PARTS['door-hanger'] = { card: [0], hole: [1, 2] };
// Do not disturb: the hanger with lugares' crescent moon on its face.
{
  const moonD = place(lugares.icons.moon.d[0], 0.42, [12, 12], [12.25, 15.75]);
  add('door-hanger-moon', ['no molestar', 'privacidad', 'descanso', 'do not disturb', 'privacy please', 'dnd'], [...HANGER, moonD]);
  FILL['door-hanger-moon'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['door-hanger-moon'] = { card: [0], hole: [1, 2], moon: [3] };
}
// Housekeeping cart: a push cart (its handle up at the left, the deck on two wheels) carrying two folded
// towels (limpieza's linens: the folded edge round at the left), staggered, and the linen hamper at its
// other end. (A cabinet with the towels on top and the bag hanging from its bar read as a truck; a frame
// with two shelves and a towel on each, as a bus.)
{
  const slab = (x0, x1, y0, y1) => {
    const r = (y1 - y0) / 2;
    return `M${pt([x0 + r, y0])}H${f(x1 - 1)}A1 1 0 0 1 ${pt([x1, y0 + 1])}V${f(y1 - 1)}A1 1 0 0 1 ${pt([x1 - 1, y1])}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x0 + r, y0])}Z`;
  };
  add('housekeeping-cart', ['carrito de limpieza', 'camarista', 'limpieza de habitaciones', 'housekeeping cart', 'housekeeping', 'room cleaning'], [
    rl([[2.75, 5.25], [4, 5.25], [4, 17.25], [21.25, 17.25]], [0, 0.6, 1.25, 0]),
    slab(7, 13.75, 14.25, 17.25),
    slab(7.5, 13.25, 11.25, 14.25),
    rl([[16.75, 9.5], [16.75, 17.25], [21.25, 17.25], [21.25, 9.5]], 0),
    circ(6.75, 19, 1.75),
    circ(18.75, 19, 1.75),
  ]);
  // Filled, the two towels are parted by their seam, knocked out; the hamper stays a line (closed across
  // its open top it would change the silhouette)
  FILL['housekeeping-cart'] = { solid: [1, 2, 4, 5], wire: [0, 3], cut: [hl(14.25, 8.75, 14.75)] };
  PARTS['housekeeping-cart'] = { cart: [0], towels: [1, 2], hamper: [3], wheels: [4, 5] };
}
// Key card: a portrait card (the signature corner), distinct from comercio's landscape payment cards,
// with a key on its face: the bow's ring and a short blade with two teeth.
add('key-card', ['tarjeta llave', 'llave de habitación', 'acceso a la habitación', 'key card', 'room key', 'hotel key'], [
  sq(5.75, 2.75, 12.5, 18.5, 3, BR),
  circ(12, 8.75, 2.5),
  vl(12, 11.25, 17.5),
  hl(14.5, 12, 14.25),
  hl(17.5, 12, 14.25),
]);
FILL['key-card'] = { solid: [0], cut: [1, 2, 3, 4] };
PARTS['key-card'] = { card: [0], key: [1, 2, 3, 4] };
// Mobile key: dispositivos' smartphone with a key crossing its lower right corner, in front as a custom
// badge: the engine clears the phone behind it.
{
  const phone = dispositivos.icons.smartphone.d;
  const c = [18, 18];
  const u = unit([-1, -1]);
  const n = [-u[1], u[0]];
  const bowR = 2.25;
  const start = add2(c, mul(u, bowR));
  const tip = add2(c, mul(u, 9));
  const tooth = (t, l) => [add2(c, mul(u, t)), add2(add2(c, mul(u, t)), mul(n, l))];
  const t1 = tooth(7, 2);
  const t2 = tooth(9, 2);
  const key = [circ(...c, bowR), line(start, tip), line(...t1), line(...t2)];
  add('smartphone-key', ['llave digital', 'llave móvil', 'abrir con el celular', 'mobile key', 'digital key', 'phone key'], phone, {
    badge: own(key, `${key[0]}${segs([start, tip], t1, t2)}`, { solid: [key[0]], wire: key.slice(1) }),
  });
  FILL['smartphone-key'] = { solid: [0], cut: [1] };
  PARTS['smartphone-key'] = { phone: [0], speaker: [1] };
}

// ── Room views: hogar's windowpane frame on its sill, the view inside ──────────────────────────
const [FRAME, SILL] = hogar.icons.windowpane.d;
// Sea: two waves from side to side and a half sun on the horizon, its ends where the upper wave
// crosses its own middle line
{
  const h = 14.5 / 4;
  add('sea-view', ['vista al mar', 'frente al mar', 'tipo de habitación', 'sea view', 'ocean view', 'beachfront room'], [
    FRAME,
    SILL,
    ripple(11.75, 4.75, 4, h),
    ripple(14.75, 4.75, 4, h),
    `M${pt([4.75 + h, 11.75])}A${f(h)} ${f(h)} 0 0 1 ${pt([4.75 + 3 * h, 11.75])}`,
  ]);
  FILL['sea-view'] = { solid: [shut(`${FRAME}`)], cut: [2, 3, 4], wire: [1] };
  PARTS['sea-view'] = { window: [0, 1], waves: [2, 3], sun: [4] };
}
// City: a skyline of three blocks standing on the sill
add('city-view', ['vista a la ciudad', 'vista urbana', 'tipo de habitación', 'city view', 'skyline view', 'urban view'], [
  FRAME,
  SILL,
  rl([[7.75, 18.25], [7.75, 11], [10.5, 11], [10.5, 7.25], [13.5, 7.25], [13.5, 12.25], [16.25, 12.25], [16.25, 18.25]], [0, 0.6, 0, 0.6, 0.6, 0, 0.6, 0]),
]);
FILL['city-view'] = { solid: [shut(FRAME)], cut: [2], wire: [1] };
PARTS['city-view'] = { window: [0, 1], skyline: [2] };
// Mountains: two peaks from side to side
add('mountain-view', ['vista a la montaña', 'vista al bosque', 'tipo de habitación', 'mountain view', 'nature view', 'valley view'], [
  FRAME,
  SILL,
  rl([[4.75, 15.75], [9.5, 8.25], [12.5, 12.25], [15.25, 9.5], [19.25, 15.25]], [0, 1, 0.75, 1, 0]),
]);
FILL['mountain-view'] = { solid: [shut(FRAME)], cut: [2], wire: [1] };
PARTS['mountain-view'] = { window: [0, 1], mountains: [2] };

// Stay dates: lugares' calendar with a bed in its body: the headboard, the mattress turning down at
// its foot, the pillow.
{
  const cal = [sq(3, 4.75, 18, 16.25, 4, BR), line([8, 2.9], [8, 6.5]), line([16, 2.9], [16, 6.5]), line([3, 9.75], [21, 9.75])];
  add('calendar-bed', ['fechas de estancia', 'noches', 'entrada y salida', 'stay dates', 'nights', 'check-in check-out'], [
    ...cal,
    vl(7.25, 12.75, 18),
    rl([[7.25, 15.5], [16.75, 15.5], [16.75, 18]], [0, 1, 0]),
    hl(12.63, 10.25, 12.75),
  ]);
  FILL['calendar-bed'] = { solid: [0], lines: [1, 2], cut: [3, 4, 5, 6] };
  PARTS['calendar-bed'] = { calendar: [0, 1, 2, 3], bed: [4, 5, 6] };
}

// ── Beach and pool ───────────────────────────────────────────────────────────────────────────
// Beach umbrella: lugares' umbrella canopy, smaller, tilted to one side on its pole planted in the sand.
{
  const base = [13.5, 20.75];
  const tilt = -18;
  const canopy = turnPath(place(lugares.icons.umbrella.d[0], 0.8, [12, 12.5], [base[0], base[1] - 8]), tilt, base);
  const top = [base[0], base[1] - 8 - 3 * 0.8];
  const tipP = turnPath(line(top, base), tilt, base);
  add('beach-umbrella', ['sombrilla de playa', 'acceso a la playa', 'día de playa', 'beach umbrella', 'beach access', 'beachfront'], [canopy, tipP, hl(20.75, 2.75, 21.25)]);
  FILL['beach-umbrella'] = { solid: [0], wire: [1, 2] };
  PARTS['beach-umbrella'] = { canopy: [0], pole: [1], sand: [2] };
}
// Sun lounger: a long flat bed with its backrest raised at one end, on short legs.
add('sun-lounger', ['camastro', 'tumbona', 'reservar camastro', 'sun lounger', 'sunbed', 'pool lounger'], [
  rl([[3.25, 8.75], [7.25, 15.25], [21.25, 15.25]], [0, 1.25, 0]),
  vl(9.25, 15.25, 19.75),
  vl(19.25, 15.25, 19.75),
]);
FILL['sun-lounger'] = false;
PARTS['sun-lounger'] = { bed: [0], legs: [1, 2] };
// Sandcastle: a wide base and two towers shaped by a bucket (narrower at the top), a door in the base and
// a pennant on the right tower, its pole one of its sides (a closed triangle that small closed up at
// bold). (Crenellations cut into towers 6 wide left merlons 1.25 wide that changed shape with the weight.)
{
  const L = [[3.75, 15.5], [4.5, 9.5], [10, 9.5], [10.75, 15.5]];
  const R = [[13.25, 15.5], [14, 9.5], [19.5, 9.5], [20.25, 15.5]];
  const outline = roundpoly([[2.75, 21], [2.75, 15.5], ...L, ...R, [21.25, 15.5], [21.25, 21]], [1.5, 0.6, 0, 0.75, 0.75, 0, 0, 0.75, 0.75, 0, 0.6, 0]);
  const x = 16.75;
  add('sandcastle', ['castillo de arena', 'playa familiar', 'actividades para niños', 'sandcastle', 'family beach', 'kids club'], [
    outline,
    rl([[10.5, 21], [10.5, 18.25], [13.5, 18.25], [13.5, 21]], [0, 1.25, 1.25, 0]),
    vl(x, 9.5, 2.75),
    rl([[x, 2.75], [x + 4.5, 4.75], [x, 6.75]], [0, 0.5, 0]),
  ]);
  FILL.sandcastle = { solid: [0, shut(icons.sandcastle.d[3])], cut: [1], wire: [2] };
  PARTS.sandcastle = { castle: [0, 1], pennant: [2, 3] };
}
// Beach ball: the ball turned toward us, its cap near the top left and three seams running from the cap
// over its face: a sphere's meridians in orthographic projection (from straight down, three seams to
// the bottom read as a peace sign).
{
  const C = [12, 12];
  const R = 9;
  const n3 = (v) => v.map((x) => x / Math.hypot(...v));
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const N = n3([-0.42, -0.72, 0.55]);
  const A = n3(cross(N, [0, 0, 1]));
  const B = cross(N, A);
  const at = (t, phi) => [0, 1, 2].map((i) => Math.cos(t) * N[i] + Math.sin(t) * (Math.cos(phi) * A[i] + Math.sin(phi) * B[i]));
  const proj = (v) => [C[0] + R * v[0], C[1] + R * v[1]];
  const alpha = 0.27;
  // The cap: a small circle around the pole, an ellipse once projected
  const capC = proj(mul(N, Math.cos(alpha)));
  const rx = R * Math.sin(alpha);
  const ry = rx * N[2];
  const rotDeg = (Math.atan2(A[1], A[0]) * 180) / Math.PI;
  const e1 = add2(capC, mul([A[0], A[1]], rx));
  const e2 = sub(capC, mul([A[0], A[1]], rx));
  const cap = `M${pt(e1)}A${f(rx)} ${f(ry)} ${f(rotDeg)} 0 1 ${pt(e2)}A${f(rx)} ${f(ry)} ${f(rotDeg)} 0 1 ${pt(e1)}Z`;
  // A seam: the meridian from the cap's edge to the horizon (where it turns away from us)
  const seam = (phi) => {
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const t = alpha + (k / 40) * Math.PI;
      const v = at(t, phi);
      if (v[2] < 0) break;
      pts.push(proj(v));
    }
    return line(...pts.filter((_, k) => k % 2 === 0 || k === pts.length - 1));
  };
  add('beach-ball', ['pelota de playa', 'diversión en la alberca', 'actividades familiares', 'beach ball', 'pool fun', 'family fun'], [
    circ(...C, R),
    cap,
    seam(-0.85),
    seam(-1.57),
    seam(-2.29),
  ]);
  FILL['beach-ball'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['beach-ball'] = { ball: [0], seams: [1, 2, 3, 4] };
}
// Indoor pool: bienes-raices' pool (the ladder's two rails curving over the deck, a rung, two of lugares'
// waves), its ladder shorter to fit under a roof line.
add('swimming-pool-indoor', ['alberca techada', 'piscina cubierta', 'amenidades', 'indoor pool', 'covered pool', 'hotel pool'], [
  rl([[2.75, 7.25], [12, 2.75], [21.25, 7.25]], [0, 1.25, 0]),
  'M5.75 11.25V10A2.25 2.25 0 0 1 10.25 10V12.75',
  'M18.25 11.25V10A2.25 2.25 0 0 0 13.75 10V12.75',
  hl(11.5, 10.25, 13.75),
  ripple(16.75, 3, 6, 3),
  ripple(20.75, 3, 6, 3),
]);
FILL['swimming-pool-indoor'] = false;
PARTS['swimming-pool-indoor'] = { roof: [0], ladder: [1, 2, 3], water: [4, 5] };
// Water slide: the tower (its ladder's rungs), the slide curving down from its top into a wave.
add('water-slide', ['tobogán', 'parque acuático', 'resbaladilla', 'water slide', 'water park', 'slide'], [
  rl([[3.25, 21], [3.25, 6], [7.75, 6], [7.75, 21]], [0, 0.75, 0.75, 0]),
  hl(10.5, 3.25, 7.75),
  hl(15, 3.25, 7.75),
  'M7.75 8.75C13.75 8.75 11 16.5 17 16.5',
  ripple(20, 12, 3, 3),
]);
FILL['water-slide'] = false;
PARTS['water-slide'] = { tower: [0, 1, 2], slide: [3], water: [4] };

// ── Mountain and adventure ───────────────────────────────────────────────────────────────────
// Chairlift: the sloped cable and the chair in profile hanging from its grip: the hanger bar down and back
// to the top of the backrest, and the seat. (A footrest under it turned the chair into a squiggle.)
// Zipline: the sloped cable and the rider hanging from it by one hand, the trolley a dot where the hand
// grips the cable; personas' figure (head r 1.9, 2.35 clear of the shoulders), its raised arm out past the
// head and up, the other arm hanging, legs dangling. (Both arms up to straps from one pulley closed a
// pentagon round the head: it read as a birdhouse on a wire.)
{
  const cy = (x) => 2.75 + (4 * (x - 2.75)) / 18.5;
  const cx = 9.75;
  const H = [cx, 9.75];
  const S = [cx, H[1] + 1.9 + 2.35];
  const P = [cx, S[1] + 4.25];
  const hand = [15.25, cy(15.25)];
  const sharp = (pts, at) => rl(pts, pts.map((p) => (p[0] === at[0] && p[1] === at[1] ? 0 : 0.6)));
  add('zipline', ['tirolesa', 'canopy', 'tour de aventura', 'zipline', 'zip line', 'adventure tour'], [
    line([2.75, cy(2.75)], [21.25, cy(21.25)]),
    circ(...H, 1.9),
    line(S, P),
    sharp([[cx - 1.5, 21.25], P, [cx + 1.5, 21.25]], P),
    sharp([[6.25, 18], [7.25, 15.4], S, [14.75, 13.5], hand], S),
    dot(...hand),
  ]);
  FILL.zipline = { solid: [1, 5], wire: [0, 2, 3, 4] };
  PARTS.zipline = { cable: [0], head: [1], body: [2], legs: [3], arms: [4], trolley: [5] };
  MOTION.zipline = { effect: 'slide', parts: ['head', 'body', 'legs', 'arms', 'trolley'], vector: [1.5, 0.32] };
}

// ── Tours, guides and plans ──────────────────────────────────────────────────────────────────
// Audio guide: a slim handset (the signature corner) on its lanyard's loop, its round speaker near the top
// and two sound waves (the core's) coming out of its side, at the speaker's height. (A grille of three
// dots over a round button read as a face, and as dispositivos' remote control.)
{
  const C = [12.75, 11];
  add('audio-guide', ['audioguía', 'guía de museo', 'recorrido con audio', 'audio guide', 'museum guide', 'audio tour'], [
    sq(4.25, 6.25, 8.5, 15, 3, BR),
    rl([[7, 6.25], [7, 3.25], [10, 3.25], [10, 6.25]], [0, 1, 1, 0]),
    circ(8.5, 11, 1.75),
    arcd(...C, 4, -40, 40),
    arcd(...C, 7.5, -40, 40),
  ]);
  FILL['audio-guide'] = { solid: [0], wire: [1], cut: [2], lines: [3, 4] };
  PARTS['audio-guide'] = { device: [0], lanyard: [1], speaker: [2], wave: [3, 4] };
}
// Guidebook: archivos' book (its spine nearer the edge, as cocina's cookbook) with lugares' map pin on its cover.
{
  const [cover] = archivos.icons.book.d;
  const pinD = [place(lugares.icons['map-pin'].d[0], 0.5, [12, 12], [13.25, 11.75]), dot(13.25, 10.88)];
  add('guidebook', ['guía de viaje', 'guía turística', 'destinos', 'guidebook', 'travel guide', 'destination guide'], [cover, vl(7.25, 2.75, 21.25), ...pinD]);
  FILL.guidebook = { solid: [0], cut: [1, 2, 3] };
  PARTS.guidebook = { book: [0, 1], pin: [2, 3] };
}
// Itinerary: the page (the core document) with the route down it: a pin at the top, the route's line from
// its tip through a stop to the last one, a line of text beside the first and the last. (Drawn dotted, the
// dots ran into one another and into the pin at bold.)
{
  const page = nucleo.icons.document.d[0];
  const pin = (() => {
    const c = [8.75, 6.25];
    const r = 1.25;
    const tip = [c[0], c[1] + 3.25];
    const a = (Math.acos(r / (tip[1] - c[1])) * 180) / Math.PI;
    const p = polar(...c, r, 90 - a);
    const q = polar(...c, r, 90 + a);
    return `M${pt(tip)}L${pt(p)}A${r} ${r} 0 1 0 ${pt(q)}Z`;
  })();
  const route = [vl(8.75, 9.5, 18.25), dot(8.75, 13.88), dot(8.75, 18.25)];
  add('itinerary', ['itinerario', 'plan del viaje', 'día por día', 'itinerary', 'trip plan', 'day by day'], [page, pin, ...route, hl(6.25, 13, 16.25), hl(18.25, 12.5, 15.25)]);
  FILL.itinerary = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS.itinerary = { page: [0], route: [1, 2, 3, 4], text: [5, 6] };
  // Under the plus the last line would keep a stub, and the stops on the route lost their shape against
  // it from one weight to another: the route is the pin and its line
  badged('itinerary-plus', ['agregar al itinerario', 'agregar al viaje', 'nueva parada', 'add to itinerary', 'add to trip', 'add stop'], null, 'plus', [page, pin, route[0], hl(6.25, 13, 16.25)]);
  FILL['itinerary-plus'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['itinerary-plus'] = { page: [0], route: [1, 2], text: [3] };
}

// ── Landmarks (generic, never a real monument) and souvenirs ────────────────────────────────
// Step pyramid: three tiers and the small temple on top, the stair up its middle to the temple's base.
add('step-pyramid', ['pirámide', 'zona arqueológica', 'ruinas', 'pyramid', 'archaeological site', 'ruins'], [
  roundpoly(
    [[2.75, 21], [2.75, 17], [5.75, 17], [5.75, 13], [8.75, 13], [8.75, 9.25], [10, 9.25], [10, 4.75], [14, 4.75], [14, 9.25], [15.25, 9.25], [15.25, 13], [18.25, 13], [18.25, 17], [21.25, 17], [21.25, 21]],
    [0.75, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.6, 0.4, 0.6, 0.4, 0.6, 0.75],
  ),
  hl(9.25, 10, 14),
  vl(10.75, 9.25, 21),
  vl(13.25, 9.25, 21),
]);
FILL['step-pyramid'] = { solid: [0], cut: [1, 2, 3] };
PARTS['step-pyramid'] = { pyramid: [0], temple: [1], stair: [2, 3] };
// Snow globe: the glass sphere on its base, a little house inside on the globe's floor and three flakes,
// scattered (two at one height over the house read as a face).
{
  const C = [12, 10.25];
  const R = 8;
  const floorY = 16.25;
  const hw = Math.sqrt(R * R - (floorY - C[1]) ** 2);
  const globe = `M${pt([C[0] - hw, floorY])}A${R} ${R} 0 1 1 ${pt([C[0] + hw, floorY])}`;
  add('snow-globe', ['bola de nieve', 'recuerdo', 'tienda de regalos', 'snow globe', 'souvenir', 'gift shop'], [
    globe,
    roundpoly([[C[0] - hw, floorY], [C[0] + hw, floorY], [18.75, 21], [5.25, 21]], [0, 0, 0.75, 0.75]),
    rl([[9.25, 12], [12, 9.5], [14.75, 12]], [0, 0.75, 0]),
    rl([[10.25, 11.1], [10.25, 16.25]], 0),
    rl([[13.75, 11.1], [13.75, 16.25]], 0),
    dot(8.5, 7),
    dot(12.5, 5.25),
    dot(16.25, 8),
  ]);
  FILL['snow-globe'] = { solid: [shut(globe), 1], cut: [2, 3, 4, 5, 6, 7] };
  PARTS['snow-globe'] = { globe: [0], base: [1], house: [2, 3, 4], snow: [5, 6, 7] };
}

// ── Fill, parts, variants, mirroring and motion ──────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : i));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
// ── 16 px ────────────────────────────────────────────────────────────────────────────────────
// Where the snapped drawing smudges, a simpler one: the detail that clogged is left out and what is
// left is snapped to the pixel (the engine does not snap `small`).
const smallOf = (d, fill) => {
  const sn = snapper([...d, ...Object.values(fill ?? {}).flat()]);
  return { d: d.map(sn), ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)])) }) };
};
const pick = (name, ix) => ix.map((i) => icons[name].d[i]);
// Seams, joints and second waves run together: the shape alone
icons['travel-pillow'].small = smallOf(pick('travel-pillow', [0]), { solid: pick('travel-pillow', [0]) });
icons.igloo.small = smallOf(pick('igloo', [0, 1, 2, 3, 7]), { solid: icons.igloo.fill.solid, cut: pick('igloo', [2, 3]), wire: pick('igloo', [7]) });
icons['overwater-bungalow'].small = smallOf(pick('overwater-bungalow', [0, 1, 2, 3, 4]), { solid: pick('overwater-bungalow', [0]), wire: pick('overwater-bungalow', [1, 2, 3]), lines: pick('overwater-bungalow', [4]) });
icons['sea-view'].small = smallOf(pick('sea-view', [0, 1, 2, 4]), { solid: [shut(FRAME)], cut: pick('sea-view', [2, 4]), wire: [SILL] });
icons['swimming-pool-indoor'].small = smallOf(pick('swimming-pool-indoor', [0, 1, 2, 4]));
// The snow globe: the flakes ran into the roof and the glass, so the house alone in it
icons['snow-globe'].small = smallOf(pick('snow-globe', [0, 1, 2, 3, 4]), { solid: icons['snow-globe'].fill.solid, cut: pick('snow-globe', [2, 3, 4]) });
icons['beach-ball'].small = smallOf(pick('beach-ball', [0, 1, 2, 4]), { solid: pick('beach-ball', [0]), cut: pick('beach-ball', [1, 2, 4]) });
// Travel insurance: comercio's pixel canopy (its scallops a pixel deep) over a pixel case, centered on
// the canopy's column 7
{
  const px = (k) => 0.75 + 1.5 * k;
  const canopy = comercio.icons.insurance.small.d[0];
  const body = sq(px(4), px(10), 9, 6, 1.2, BR);
  const handle = line([px(6), px(10)], [px(6), px(8)], [px(8), px(8)], [px(8), px(10)]);
  icons['insurance-travel'].small = { d: [canopy, body, handle], fill: { solid: [canopy, body], wire: [handle] } };
}

// Motion: what rolls slides, what hangs swings from where it hangs, balls bounce, the riders ride the
// cable, a souvenir is shaken, pins drop
Object.assign(MOTION, {
  'luggage-rolling': { effect: 'slide', vector: [1.5, 0] },
  'luggage-cart': { effect: 'slide', vector: [1.5, 0] },
  'room-service': { effect: 'slide', vector: [1.5, 0] },
  'housekeeping-cart': { effect: 'slide', vector: [1.5, 0] },
  'luggage-tag': { effect: 'ring', origin: [12, 2.75] },
  'door-hanger': { effect: 'ring', origin: [12, 5.5] },
  'door-hanger-moon': { effect: 'ring', origin: [12, 5.5] },
  'beach-ball': { effect: 'bounce', vector: [0, -2] },
  'beach-umbrella': { effect: 'wiggle', origin: [13.5, 20.75] },
  'snow-globe': { effect: 'wiggle', origin: [12, 21] },
  'tour-guide': { effect: 'wiggle', parts: ['pennant'], origin: [16, 12.25] },
  'sea-view': { effect: 'float', parts: ['waves'], vector: [1.5, 0] },
  'overwater-bungalow': { effect: 'float', parts: ['water'], vector: [1.25, 0] },
  'swimming-pool-indoor': { effect: 'float', parts: ['water'], vector: [1.5, 0] },
  concierge: { effect: 'bounce', parts: ['badge'], vector: [0, 1] },
  host: { effect: 'wiggle', parts: ['badge'], origin: [17, 14.5] },
  'travel-agent': { effect: 'spin', parts: ['badge'], origin: [17, 16.75] },
  'smartphone-key': { effect: 'wiggle', parts: ['badge'], origin: [18, 18] },
  'key-card': { effect: 'wiggle', origin: [12, 21.25] },
});
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// Mirroring: the rides run one way along their cable
for (const name of ['zipline']) icons[name].mirror = true;

// With a badge the enclosures stop reading at 58 % and the slash would cut through it, as in lugares
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };

export default { category: 'viajes', label: 'Viajes y hospedaje', icons };
