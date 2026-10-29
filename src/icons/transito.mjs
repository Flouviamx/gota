// Public transport: trains by kind, buses by kind, stops and stations, platforms, fares and cards,
// lines and maps, and shared mobility at the stops. Everything is computed with the engine
// (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a
// square bottom-right corner on containers. The category adopts lugares's `bus` and `train` (drawn
// there, never redrawn here): every bus-* and train-* badge is theirs as they are, and every smaller
// bus front is built on the bus's measures (`busFront`): the body and its lines scale, the lights
// stay the set's dots at a fixed distance from their neighbors (so they never touch at 2.1) and the
// tires keep their width.
//
// The side view: every vehicle seen from the side faces right and shares one construction, the one
// vehiculos's cars use. A body is a polygon with rounded corners over a sill; its wheels are arcs
// hanging under the sill (a bus's of r 2.5, 0.75 below it, as the cars'; a train's bogies of r 2,
// 0.25 below it, over one rail line 3 under them); its windows are one band 3 below the roof, 3.25
// tall, split by short pillars. Doors are left out of the side views: at 24 px a door's jambs
// either run into the wheels or turn the band into a grid.
//
// Lines and maps: one line weight, stops as rings (r 2) that break the line, a stop on a line or a
// ring as a dot. The ticket is nucleo's; the card is nucleo's card; the booth's awning is comercio's
// store's.
import { arc, badge, circ, dot, f, head, line, polar, roundpoly, sq } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

const L = lugares.icons;
const N = nucleo.icons;

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const deg = (r) => (r * 180) / Math.PI;
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes every subpath of an open stroke (to fill it, or to clear around it). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
/** A custom piece on top: drawn as `d`, it clears `knock` from the base with the engine's clearance. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** Moves and scales a path: every point p becomes p·k + (tx, ty). */
const xf = (d, k, tx, ty) => transform(d, k, tx, ty);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as lugares's. */
function roundline(pts, radius = 0) {
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
    const S = plus(V, mul(u, t));
    const E = plus(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Intersections of two circles [x, y, r]. */
function meet([x1, y1, r1], [x2, y2, r2]) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  return [
    [m[0] + (h * (y2 - y1)) / d, m[1] - (h * (x2 - x1)) / d],
    [m[0] - (h * (y2 - y1)) / d, m[1] + (h * (x2 - x1)) / d],
  ];
}
/** Lugares's crescent moon: the disc of radius R minus the one of radius r centered at `ic`. */
function moon(c, R, ic, r) {
  const [p, q] = meet([...c, R], [...ic, r]);
  return `M${pt(p)}A${f(R)} ${f(R)} 0 1 0 ${pt(q)}A${f(r)} ${f(r)} 0 0 1 ${pt(p)}Z`;
}
/** A bolt as one zigzag stroke (vehiculos's): top right, a step across, bottom left. */
const zigBolt = (x, top, w = 3.5, h = 7) =>
  roundline(
    [
      [x + w / 2, top],
      [x - w / 2, top + h / 2],
      [x + w / 2, top + h / 2],
      [x - w / 2, top + h],
    ],
    [0, 0.5, 0.5, 0],
  );
/**
 * Nucleo's ticket at any size: a rectangle with circular corners (r) and a half-round notch (n) in
 * the middle of each short side. At 18.5 × 14.5 with r 2.85 and n 2.25 it is nucleo's own path.
 */
function ticket(x0, y0, w, h, r = 2.85, n = 2.25) {
  const [x1, y1, cy] = [x0 + w, y0 + h, y0 + h / 2];
  const R = f(r);
  const Nn = f(n);
  return `M${pt([x0, y0 + r])}A${R} ${R} 0 0 1 ${pt([x0 + r, y0])}H${f(x1 - r)}A${R} ${R} 0 0 1 ${pt([x1, y0 + r])}V${f(cy - n)}A${Nn} ${Nn} 0 0 0 ${pt([x1, cy + n])}V${f(y1 - r)}A${R} ${R} 0 0 1 ${pt([x1 - r, y1])}H${f(x0 + r)}A${R} ${R} 0 0 1 ${pt([x0, y1 - r])}V${f(cy + n)}A${Nn} ${Nn} 0 0 0 ${pt([x0, cy - n])}Z`;
}

// ── The front views (lugares's bus and train) ─────────────────────────────────────────────────
const BUS = L.bus.d;
const TRAIN = L.train.d;
/**
 * The bus's front at any size, on lugares's measures: the body (x0, top, w × h) with its corner, the
 * sign line and the windshield's lower edge; the lights stay dots of radius `r` 3.25 from the
 * windshield and the bottom and 3.5 in from the sides; the tires keep their 2.5 of width. At
 * (4.75, 2.75, 14.5 × 15.75) it is lugares's bus.
 */
function busFront(x0, top, w = 14.5, h = 15.75, { r = 0.7, panel = 6.5 } = {}) {
  const [x1, bot] = [x0 + w, top + h];
  const s = h / 15.75;
  const body = sq(x0, top, w, h, 3.25 * Math.min(1, w / 14.5));
  const shieldY = bot - panel;
  const signY = Math.min(top + 3.75 * s, shieldY - 2.75);
  const sign = hl(signY, x0, x1);
  const shield = hl(shieldY, x0, x1);
  const th = 2.75 * Math.max(s, 0.8);
  const tire = (a) => roundline([[a, bot], [a, bot + th], [a + 2.5, bot + th], [a + 2.5, bot]], [0, 0.75, 0.75, 0]);
  const tires = [tire(x0 + 2 * Math.min(1, w / 14.5)), tire(x1 - 2 * Math.min(1, w / 14.5) - 2.5)];
  const inset = r < 0.7 ? Math.min(3.5, w * 0.24) : 3.5;
  const ly = bot - panel / 2;
  const lights = [dot(x0 + inset, ly, r), dot(x1 - inset, ly, r)];
  const d = [body, ...tires, sign, shield, ...lights];
  return { d, fill: { solid: [body, ...tires.map(shut)], cut: [sign, shield, ...lights] }, top, bot: bot + th, x0, x1 };
}
/**
 * The train's front where lugares's scaled down would close up (at 0.72 its lights touch its window
 * at 1.5): the body (x0, top, w × 12) with its window 3 under the top and 2.75 in from the sides,
 * the lights 3 under the window and 3.25 in from the sides, the bottom 3 under them, and the rails
 * slanting out from the bottom to the ground at 21.25. Body, window, lights, rails, as lugares's.
 */
function trainFront(x0, top, w = 11) {
  const [x1, bot] = [x0 + w, top + 12];
  const d = [
    sq(x0, top, w, 12, 3.25),
    sq(x0 + 2.75, top + 3, w - 5.5, 3, 1.25),
    dot(x0 + 3.25, top + 9),
    dot(x1 - 3.25, top + 9),
    line([x0 + 3, bot], [x0 + 1, 21.25]),
    line([x1 - 3, bot], [x1 - 1, 21.25]),
  ];
  return { d, bot };
}
// ── The side view ─────────────────────────────────────────────────────────────────────────────
/** A wheel under the sill: the arc of its circle (radius r, its center `drop` below) under `sill`. */
function wheel(x, sill, r, drop) {
  const a = deg(Math.asin(-drop / r));
  return arc(x, sill + drop, r, a, 180 - a).d;
}
const BUS_S = { roof: 4.25, sill: 16.5, r: 2.5, drop: 0.75 };
const RAIL_S = { roof: 4.25, sill: 14.5, r: 2, drop: 0.25, rail: 19.75 };
const busWheel = (x, sill = BUS_S.sill) => wheel(x, sill, BUS_S.r, BUS_S.drop);
const bogie = (x, sill = RAIL_S.sill) => wheel(x, sill, RAIL_S.r, RAIL_S.drop);
/** The window band open into the windshield: a strip `h` tall from x0 to the body's front edge x1. */
const band = (x0, x1, top, h = 3.25, r = 1) => roundline([[x1, top], [x0, top], [x0, top + h], [x1, top + h]], [0, r, r, 0]);
/** A closed window band (a strip with rounded corners). */
const strip = (x0, x1, top, h = 3.25, r = 1) => sq(x0, top, x1 - x0, h, r);
/** Pillars across a band, from its top to its bottom. */
const pillars = (xs, top, h = 3.25) => xs.map((x) => vl(x, top, top + h));
/**
 * A sloped front (a nose, a raked windshield) from `a` (on the roof) down to `b`: returns the point
 * at height y on the parallel line `d` inside it, where a band's front end runs.
 */
const inside = (a, b, d = 3) => (y) => {
  const u = unit(sub(b, a));
  const o = plus(a, mul([-u[1], u[0]], d));
  return [o[0] + ((y - o[1]) / u[1]) * u[0], y];
};

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
/** Adds an icon; `extra` holds its other fields (badge, small…). */
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Trains from the side ──
{
  // The lead car: the nose falls from the roof to the front; the band's front end runs parallel to
  // it, 3 inside
  const { roof, sill, rail } = RAIL_S;
  const nose = [[15, roof], [21.5, 12]];
  const at = inside(...nose);
  const [T, B] = [roof + 3, roof + 6.25];
  add('train-side', ['tren de lado', 'tramo en tren', 'ferrocarril', 'train side', 'rail leg', 'train'], [
    roundpoly([[2.5, sill], [2.5, roof], ...nose, [21.5, sill]], [1, 1.5, 3.5, 1.5, 1]),
    bogie(6.25),
    bogie(17),
    roundpoly([[5.5, T], at(T), at(B), [5.5, B]], 1),
    hl(rail, 2.5, 21.5),
  ]);
}
/** One coach: square ends, a band split into `n` windows, two bogies and (with `rail`) the rail. */
function carriage({ dy = 0, x0 = 2.5, x1 = 21.5, roof = RAIL_S.roof, n = 4, rail = true } = {}) {
  const { sill } = RAIL_S;
  const [R, S, T] = [roof + dy, sill + dy, roof + 3 + dy];
  const [b0, b1] = [x0 + 3, x1 - 3];
  const step = (b1 - b0) / n;
  return [
    sq(x0, R, x1 - x0, S - R, 1.5),
    bogie(x0 + 3.75, S),
    bogie(x1 - 3.75, S),
    strip(b0, b1, T),
    ...pillars(Array.from({ length: n - 1 }, (_, i) => b0 + (i + 1) * step), T),
    ...(rail ? [hl(RAIL_S.rail + dy, x0, x1)] : []),
  ];
}
// The coach leaves the rail out: with it, its four windows take it over the set's density
add('train-carriage', ['vagón', 'coche de pasajeros', 'número de vagón', 'train car', 'carriage', 'coach'], carriage({ dy: 1.5, rail: false }));
{
  // Night train: the coach, lower, with lugares's crescent over its roof at the right, its roof's
  // corner cut out under it (low enough that the crescent's clearance never reaches the band)
  const m = moon([18.5, 4.5], 2.75, [20.5, 2.75], 2.25);
  add('train-sleeper', ['tren nocturno', 'coche cama', 'viaje de noche', 'night train', 'sleeper', 'overnight'], carriage({ dy: 4, rail: false }), { badge: own([m], m, { solid: [m] }) });
}
{
  // High speed: a long, low body whose roof runs into a long nose that ends low at the front; one
  // thin window line and the rail under it, no wheels
  const body = 'M3.75 7H9C14.5 7 19.25 9.25 21.1 11.9C21.75 12.85 21.2 14 20 14H3.75A1.25 1.25 0 0 1 2.5 12.75V8.25A1.25 1.25 0 0 1 3.75 7Z';
  add('train-high-speed', ['tren de alta velocidad', 'tren bala', 'interurbano', 'high-speed rail', 'bullet train', 'intercity'], [body, hl(10.5, 5.5, 13.5), hl(17, 2.5, 21.5)]);
}

// ── Buses from the side ──
{
  // City bus: a long box, the band running into the windshield, two pillars across it
  const { sill } = BUS_S;
  const roof = 4.75;
  const T = roof + 3;
  add('bus-side', ['autobús de lado', 'tramo en autobús', 'camión', 'bus side', 'bus leg', 'city bus'], [
    roundpoly([[3, sill], [3, roof], [21, roof], [21, sill]], [1.25, 2, 2, 1.25]),
    busWheel(7),
    busWheel(17),
    band(6, 21, T),
    ...pillars([10.75, 15.5], T),
  ]);
}
{
  // Kneeling bus: a short city bus, its ramp sloping from the front door down to the curb
  const { roof, sill } = BUS_S;
  const T = roof + 3;
  add('bus-ramp', ['rampa', 'abordaje accesible', 'piso bajo', 'wheelchair ramp', 'accessible boarding', 'low floor'], [
    roundpoly([[2.5, sill], [2.5, roof], [16, roof], [16, sill]], [1.25, 2, 2, 1.25]),
    busWheel(6),
    busWheel(12.5),
    band(5.5, 16, T),
    roundline([[16, sill - 0.75], [19.75, 20.25], [21.5, 20.25]], [0, 0.75, 0]),
  ]);
}
{
  // Two decks, from the front: the bus's front taller and narrower, one window over the other and its
  // tires (from the side, two bands of windows take it far over the set's density, and a band split
  // in two reads as a letter E)
  const B = busFront(5.75, 2.5, 12.5, 16.25);
  add('bus-double-decker', ['autobús de dos pisos', 'turibús', 'doble piso', 'double-decker', 'sightseeing bus', 'tour bus'], [
    B.d[0],
    B.d[1],
    B.d[2],
    sq(8.75, 5.5, 6.5, 3.5, 1.25),
    sq(8.75, 12, 6.5, 3.75, 1.25),
  ]);
}
{
  // Coach: a raked windshield, the band high (its front end parallel to the windshield), the luggage
  // bay's line along the body under it (its door, with jambs down to the sill between the wheels,
  // read as a letter R)
  const [roof, sill] = [4, 16.5];
  const xw = [6.5, 17.5];
  add('bus-coach', ['autobús foráneo', 'autobús de pasajeros', 'larga distancia', 'coach', 'intercity bus', 'long-distance bus'], [
    roundpoly([[3.25, sill], [3.25, roof], [16.5, roof], [20.75, 10.5], [20.75, sill]], [1.25, 2, 2.25, 1.5, 1.25]),
    busWheel(xw[0], sill),
    busWheel(xw[1], sill),
    roundpoly([[6.25, 7], inside([16.5, roof], [20.75, 10.5])(7), inside([16.5, roof], [20.75, 10.5])(10), [6.25, 10]], 1),
    hl(13.25, 6.25, 17.75),
  ]);
}
{
  // School bus: the cabin ends at the windshield and a short hood runs ahead of it, its top level
  // with the band's bottom
  const { roof, sill } = BUS_S;
  const hood = 10.5;
  add('school-bus', ['autobús escolar', 'transporte escolar', 'ruta escolar', 'school bus', 'student transport', 'school route'], [
    roundpoly([[2.5, sill], [2.5, roof], [16.75, roof], [16.75, hood], [21.5, hood], [21.5, sill]], [1.25, 2, 1.5, 0, 1.5, 1.25]),
    busWheel(6.25),
    busWheel(18.25),
    band(5.5, 16.75, roof + 3, hood - roof - 3),
    ...pillars([11.25], roof + 3, hood - roof - 3),
  ]);
}
{
  // Minibus: short, a raked windshield down to a short hood ahead of it; the window's front parallel
  // to the windshield, a pillar between its two windows (one long nose from the roof, as before, was
  // train-side without its rail)
  const [roof, sill] = [5, 16.5];
  const ws = [[14.25, roof], [18, 11.25]];
  const at = inside(...ws);
  const [T, B] = [roof + 3, roof + 6.25];
  add('minibus', ['minibús', 'combi', 'transporte compartido', 'minibus', 'shuttle', 'van'], [
    roundpoly([[3.25, sill], [3.25, roof], ...ws, [20.75, 12], [20.75, sill]], [1.25, 2, 1.75, 1, 1.25, 1.25]),
    busWheel(7, sill),
    busWheel(17, sill),
    roundpoly([[6.25, T], at(T), at(B), [6.25, B]], 1),
    vl(10.75, T, B),
  ]);
}

// ── Other rail ──
{
  // Steam: the cab behind and higher, the boiler ahead with a flared chimney standing on it, the
  // cowcatcher a wedge under the front, two large driving wheels
  const sill = 15;
  add('locomotive', ['locomotora', 'tren de vapor', 'tren turístico', 'locomotive', 'steam train', 'heritage railway'], [
    roundpoly([[2.5, sill], [2.5, 4], [9.25, 4], [9.25, 8.75], [17.75, 8.75], [17.75, 12.5], [21.25, 18.75], [17.5, 18.75], [17.5, sill]], [1, 1, 1, 0, 2.25, 0, 0.75, 0.75, 0.5]),
    wheel(5.75, sill, 2.75, 1),
    wheel(12, sill, 2.75, 1),
    roundline([[12.25, 8.75], [11.5, 4.5], [15.5, 4.5], [14.75, 8.75]], [0, 0.6, 0.6, 0]),
  ]);
}
{
  // Metro: the train's front coming out of a tunnel arch that runs from ground to ground; the train
  // is an arch too, its sides running down to the ground, its window and lights inside
  add('subway', ['metro', 'subterráneo', 'tren urbano', 'subway', 'metro', 'underground'], [
    'M3 21.25V12.25A9 9 0 0 1 21 12.25V21.25',
    roundline([[6.5, 21.25], [6.5, 8.25], [17.5, 8.25], [17.5, 21.25]], [0, 3, 3, 0]),
    sq(9.5, 11.25, 5, 3, 1.25),
    dot(10, 17.5),
    dot(14, 17.5),
  ]);
}
{
  // Tram: a tall front with a wide windshield and two lights; the pantograph a diamond from the roof
  // to the overhead wire
  add('tram', ['tranvía', 'tren ligero', 'trolebús', 'tram', 'streetcar', 'light rail'], [
    sq(6.25, 8.75, 11.5, 12.5, 3),
    sq(8.75, 11.75, 6.5, 3.5, 1.25),
    dot(9.5, 18.25),
    dot(14.5, 18.25),
    roundpoly([[12, 3.25], [14.75, 6], [12, 8.75], [9.25, 6]], [0, 0.6, 0, 0.6]),
    hl(3.25, 3.25, 20.75),
  ]);
}
{
  // Monorail: a rounded car (the coach's window band) resting on one thick beam that runs past it on
  // both sides, the beam carried high on two pillars. The car with train-side's nose on a beam on one
  // T post read as a clothes iron on its stand (electrodomesticos's iron), and the rounded car on a T
  // post as a monitor
  const [roof, top, bot, x0, x1] = [4.25, 13.25, 17, 4.25, 19.75];
  const T = roof + 3;
  const step = (x1 - x0 - 6) / 3;
  add('monorail', ['monorriel', 'tren elevado', 'aeropuerto', 'monorail', 'people mover', 'skytrain'], [
    roundline([[x0, top], [x0, roof], [x1, roof], [x1, top]], [0, 2.5, 4, 0]),
    strip(x0 + 3, x1 - 3, T),
    ...pillars([x0 + 3 + step, x0 + 3 + 2 * step], T),
    hl(top, 2.5, 21.5),
    hl(bot, 2.5, 21.5),
    vl(7.5, bot, 21.25),
    vl(16.5, bot, 21.25),
  ]);
}
{
  // Funicular: a car slanted on its steep track; its floor, roof and window line follow the slope and
  // its pillars stand plumb, so its windows step up the hill
  // A 1:2 slope, as its 16 px drawing (at 3:8 the car lay almost level and read as a tilted box)
  const slope = 0.5;
  const yT = (x) => 21.25 - slope * (x - 2.75);
  const floor = (x) => yT(x) - 3.25;
  const roof = (x) => floor(x) - 7.5;
  const belt = (x) => roof(x) + 3.5;
  const [a, b] = [5, 18.5];
  add('funicular', ['funicular', 'tren de cremallera', 'cerro', 'funicular', 'rack railway', 'cliff railway'], [
    roundpoly([[a, floor(a)], [a, roof(a)], [b, roof(b)], [b, floor(b)]], [1, 1.5, 1.5, 1]),
    line([a, belt(a)], [b, belt(b)]),
    vl(9.5, roof(9.5), belt(9.5)),
    vl(14, roof(14), belt(14)),
    line([2.75, yT(2.75)], [21.25, yT(21.25)]),
  ]);
}
{
  // Cable car: the cabin hangs from its grip arm on one cable crossing above
  const y = 7.25 - ((12 - 2.5) * 4.5) / 19;
  add('cable-car', ['teleférico', 'cablebús', 'góndola', 'cable car', 'aerial tramway', 'gondola'], [
    sq(5.5, 10, 13, 11.25, 3),
    sq(8.25, 13, 7.5, 3.75, 1.25),
    vl(12, y, 10),
    line([2.5, 7.25], [21.5, 2.75]),
  ]);
}

// ── The bus's and the train's fronts ──
add('bus-electric', ['autobús eléctrico', 'cero emisiones', 'flota eléctrica', 'electric bus', 'zero emission', 'e-bus'], BUS, {
  badge: (() => {
    const b = zigBolt(19.75, 1.75, 3.5, 6.5);
    return own([b], `${b}Z`);
  })(),
});
{
  const m = moon([18.75, 5.25], 3.25, [21.25, 3.25], 2.75);
  add('bus-night', ['autobús nocturno', 'servicio nocturno', 'búho', 'night bus', 'owl service', 'late night'], BUS, { badge: own([m], m, { solid: [m] }) });
}
// Under a status badge the bus and the train stand 0.5 and 1 to the left: their far light then stays
// clear of the badge's reach at every weight (in place, the engine drops it at 2.1 only)
const BUS_B = BUS.map((d) => xf(d, 1, -0.5, 0));
const TRAIN_B = TRAIN.map((d) => xf(d, 1, -1, 0));
add('bus-alert', ['aviso de servicio', 'desvío', 'interrupción', 'service alert', 'detour', 'bus disruption'], BUS_B, { badge: badge('alert') });
add('bus-clock', ['próximo autobús', 'horario', 'salidas', 'next bus', 'departures', 'schedule'], BUS_B, { badge: badge('clock') });
{
  // Live: the bus low and left, two signal arcs rising from its top right corner
  const B = busFront(2.5, 7.75, 11.75, 12.25);
  const c = [B.x1 - 0.5, B.top + 0.5];
  add('bus-live', ['llegadas en tiempo real', 'seguimiento en vivo', 'ubicación del autobús', 'real-time arrivals', 'live tracking', 'bus tracker'], [
    ...B.d,
    arc(...c, 3, -75, -15).d,
    arc(...c, 6, -75, -15).d,
  ]);
}
add('train-alert', ['aviso de servicio', 'estado de la línea', 'obras', 'rail disruption', 'line status', 'service alert'], TRAIN_B, { badge: badge('alert') });
add('train-clock', ['próximo tren', 'salidas', 'retraso', 'next train', 'departures', 'delay'], TRAIN_B, { badge: badge('clock') });
add('train-x', ['tren cancelado', 'viaje cancelado', 'sin servicio', 'cancelled train', 'trip cancelled', 'no service'], TRAIN_B, { badge: badge('x') });

// ── Stops and stations ──
{
  // Real-time display: a screen on a pole, three rows of a line and its minutes
  const rows = [5.75, 8.75, 11.75];
  add('stop-display', ['pantalla de llegadas', 'próximas salidas', 'tiempo real', 'arrivals display', 'departure board', 'next arrivals'], [
    sq(3.25, 2.75, 17.5, 12, 3, BR),
    ...rows.flatMap((y) => [hl(y, 6.25, 10.75), hl(y, 15, 17.75)]),
    vl(12, 14.75, 21.25),
  ]);
}
/** The stop: a pole on a short foot, `plate` on top and the timetable halfway down. */
const stop = (x = 12, plate = circ(x, 6.25, 4), top = 10.25) => [plate, vl(x, top, 21.25), hl(21.25, x - 2.5, x + 2.5), roundline([[x, 12.75], [x - 4, 12.75], [x - 4, 17.75], [x, 17.75]], [0, 1, 1, 0])];
add('bus-stop', ['parada', 'parada de autobús', 'paradero', 'bus stop', 'tram stop', 'stop'], stop());
add('bus-stop-star', ['parada favorita', 'parada guardada', 'favoritos', 'saved stop', 'favorite stop', 'starred'], stop(9.5, circ(9.5, 6.25, 4)), { badge: badge('star') });
{
  // Shelter, from the side: the roof slab carried by one back post, the glass panel under it and
  // the bench in front of it
  add('bus-shelter', ['refugio', 'parada techada', 'cobertizo', 'bus shelter', 'covered stop', 'stop amenities'], [
    sq(3.25, 3.25, 17.5, 3, 1.5),
    vl(5.5, 6.25, 21.25),
    roundline([[5.5, 14.75], [14.25, 14.75], [14.25, 21.25]], [0, 0.75, 0]),
  ]);
}
{
  // Bus station: a long canopy over the bus's front parked under it
  const B = busFront(6.25, 7.25, 11.5, 12);
  add('bus-station', ['terminal de autobuses', 'central camionera', 'andenes', 'bus station', 'coach terminal', 'bus bays'], [
    roundline([[2.75, 7.25], [2.75, 3.75], [21.25, 3.75], [21.25, 7.25]], [0, 1.25, 1.25, 0]),
    ...B.d,
  ]);
}
{
  // Station: the train shed's arch over the facade, the clock at its crown and the door under it;
  // the clock's hands reach its rim
  const hand = polar(12, 9, 2.75, 30);
  add('train-station', ['estación de tren', 'estación', 'terminal', 'train station', 'railway station', 'station'], [
    'M2.75 21.25V12A9.25 9.25 0 0 1 21.25 12V21.25Z',
    circ(12, 9, 2.75),
    line([12, 6.25], [12, 9], hand),
    roundline([[9.5, 21.25], [9.5, 14.75], [14.5, 14.75], [14.5, 21.25]], [0, 1, 1, 0]),
  ]);
}
{
  // Metro entrance: stairs going down from the ground, the railing arching over the top step
  add('subway-entrance', ['entrada al metro', 'acceso', 'escaleras', 'subway entrance', 'metro entrance', 'station exit'], [
    roundline([[2.75, 8.5], [8, 8.5], [8, 11.5], [11, 11.5], [11, 14.5], [14, 14.5], [14, 17.5], [17, 17.5], [17, 20.5], [21.25, 20.5]], 0.5),
    roundline([[5, 8.5], [5, 4.25], [8.25, 4.25], [17.75, 13.75]], [0, 1.5, 2.5, 0]),
  ]);
}
{
  // Platform, from its end: the train's front standing on its rails beside the platform's edge (the
  // platform level with its floor), the canopy's post on the platform and its roof over both. The
  // train stands at the left so the sync badge only takes the platform's step (the slab under a
  // canopy on a center post, seen from the track, read as the character 工); 11.5 wide, so under the
  // badge its far light goes at every weight, as on train-alert (at 11 it stayed at 0.9 only). The
  // canopy reaches over the train's half, under the set's density
  const T = trainFront(2.75, 5.5, 11.5);
  const P = [
    roundline([[21.25, T.bot], [17.25, T.bot], [17.25, 21.25]], [0, 1, 0]),
    roundline([[19.75, T.bot], [19.75, 2.5], [8.25, 2.5]], [0, 1, 0]),
    ...T.d,
  ];
  add('train-platform', ['andén', 'vía', 'dónde abordar', 'platform', 'track', 'boarding'], P);
  add('train-platform-sync', ['cambio de andén', 'cambio de vía', 'andén nuevo', 'platform change', 'track change', 'new platform'], P, { badge: badge('sync') });
}
{
  // Doors: two sliding leaves with a window each; two arrows open outward from the seam
  const mk = (x0, x1) => [line([x0, 16.25], [x1, 16.25]), head([x1, 16.25], [x1 - x0, 0], 2)];
  add('train-doors', ['puertas', 'lado de apertura', 'abrir puertas', 'train doors', 'doors open', 'door side'], [
    roundline([[3.75, 21.25], [3.75, 3.25], [20.25, 3.25], [20.25, 21.25]], [0, 3, 3, 0]),
    vl(12, 3.25, 21.25),
    sq(6.5, 6.25, 3, 4, 1.25),
    sq(14.5, 6.25, 3, 4, 1.25),
    ...mk(9, 6.75),
    ...mk(15, 17.25),
  ]);
}
{
  // Stop request: the grab pole with its button, two short arcs pressing out from it
  add('stop-request', ['solicitar parada', 'botón de parada', 'bajada', 'stop request', 'request stop', 'stop button'], [
    vl(12, 2.75, 8.25),
    vl(12, 15.75, 21.25),
    circ(12, 12, 3.75),
    dot(12, 12),
    arc(12, 12, 6.75, -30, 30).d,
    arc(12, 12, 6.75, 150, 210).d,
  ]);
}
{
  // Standing room: the ceiling rail and two straps hanging from it, each a ring handle
  add('grab-strap', ['de pie', 'agarradera', 'pasamanos', 'standing room', 'grab handle', 'handhold'], [
    hl(3.5, 2.75, 21.25),
    vl(7.75, 3.5, 13.25),
    vl(16.25, 3.5, 13.25),
    circ(7.75, 16.25, 3),
    circ(16.25, 16.25, 3),
  ]);
}
{
  // Occupancy: three standing figures, a head over a rounded body each
  const fig = (x) => [circ(x, 5.25, 1.75), sq(x - 1.75, 10, 3.5, 10.25, 1.75)];
  add('occupancy', ['ocupación', 'qué tan lleno', 'asientos disponibles', 'occupancy', 'crowding', 'how full'], [...fig(5.25), ...fig(12), ...fig(18.75)]);
}

// ── Tickets and fares ──
{
  // Ticket office: comercio's store awning over nucleo's ticket, a booth that sells it (an arched
  // window with the ticket under its glass read as a face, then as a helmet)
  add('ticket-office', ['taquilla', 'venta de boletos', 'ventanilla', 'ticket office', 'ticket window', 'box office'], [
    comercio.icons.store.d[0],
    ticket(3.25, 13.5, 17.5, 7.75, 2, 1.75),
    vl(14.75, 13.5, 21.25),
  ]);

}
{
  // Ticket machine: a tall cabinet, its screen on top and the slot below with a ticket half out
  add('ticket-machine', ['máquina de boletos', 'expendedora', 'recargar tarjeta', 'ticket machine', 'vending machine', 'top up'], [
    sq(5, 2.75, 14, 18.5, 3, BR),
    sq(8, 5.75, 8, 5.25, 1.25),
    hl(14, 8.5, 15.5),
    roundline([[10, 14], [10, 18.25], [14, 18.25], [14, 14]], [0, 0.75, 0.75, 0]),
  ]);
}
/** The validator: a post on a foot, its reader head slanted on top and two waves rising from it. */
function validator(cx = 12) {
  // The head: a box whose reading face slopes up toward the back (right), as a lectern's
  const [x0, x1, low, high, bot] = [cx - 5, cx + 5, 10.25, 8, 14.25];
  const headD = roundpoly([[x0, bot], [x0, low], [x1, high], [x1, bot]], [1.25, 1, 1, 1.25]);
  const mid = [cx, (low + high) / 2];
  const n = deg(Math.atan2(-(x1 - x0), -(low - high)));
  const waves = [3.5, 6.5].map((r) => arc(...mid, r, n - 30, n + 30).d);
  return [headD, vl(cx, bot, 21.25), hl(21.25, cx - 2.75, cx + 2.75), ...waves];
}
add('fare-validator', ['validador', 'acercar tarjeta', 'sin contacto', 'card reader', 'validator', 'tap to pay'], validator());
add('tap-in', ['entrada', 'iniciar viaje', 'validar al subir', 'tap in', 'check in', 'start trip'], validator(9.5), { badge: badge('arrow-right') });
add('tap-out', ['salida', 'terminar viaje', 'validar al bajar', 'tap out', 'check out', 'end trip'], validator(9.5), { badge: badge('arrow-left') });
{
  // Fare gates: two waist-high cabinets from the front, their glass paddles meeting in the aisle
  const paddle = (x0, x1) => roundline([[x0, 9.75], [x1, 9.75], [x1, 16.25], [x0, 16.25]], [0, 1.5, 1.5, 0]);
  add('fare-gate', ['torniquete', 'acceso con boleto', 'barrera', 'fare gates', 'ticket barrier', 'station entry'], [
    sq(2.75, 7.5, 5, 13.75, 1.75),
    sq(16.25, 7.5, 5, 13.75, 1.75),
    paddle(7.75, 10.5),
    paddle(16.25, 13.5),
  ]);
}
{
  // Transit card: the set's card with the train's front drawn on its face: its window and lights
  // (with the plus badge, the window's corner and the right light are cut out at every weight)
  const face = [N.card.d[0], sq(7, 8, 10, 4.5, 1.25), dot(7.75, 15.75), dot(16.25, 15.75)];
  add('transit-card', ['tarjeta de transporte', 'abono', 'saldo', 'transit card', 'travel card', 'pass'], face);
  add('transit-card-plus', ['recargar tarjeta', 'agregar saldo', 'nuevo abono', 'top up', 'reload card', 'add pass'], face, { badge: badge('plus') });
}
{
  // Mobile ticket: the phone at the left (comercio's mobile-top-up) with nucleo's ticket in front of
  // it at the bottom right (the ticket across the phone's middle left its top and bottom as a bag's
  // handle and base)
  const t = ticket(8.75, 12, 12.5, 9.25, 2, 1.75);
  const perf = vl(17.25, 14.25, 18.75);
  add('mobile-ticket', ['boleto digital', 'boleto en el celular', 'pase móvil', 'mobile ticket', 'e-ticket', 'digital pass'], [
    sq(3.25, 2.75, 11.5, 18.5, 3.25, BR),
    hl(5.75, 7.5, 10.5),
  ], { badge: own([t, perf], t, { solid: [t], cut: [perf] }) });
}
{
  // Timetable: a portrait panel, its clock as the header and two rows of times under it
  add('timetable', ['horario', 'itinerario', 'horas de salida', 'timetable', 'schedule', 'departure times'], [
    sq(4.75, 2.75, 14.5, 18.5, 3.5, BR),
    circ(12, 8.5, 2.75),
    line([12, 5.75], [12, 8.5], polar(12, 8.5, 2.75, 30)),
    hl(14.75, 8, 10.5),
    hl(14.75, 13.5, 16),
    hl(17.75, 8, 10.5),
    hl(17.75, 13.5, 16),
  ]);
}

// ── Lines and maps ──
/** A stop ring. */
const ring = (x, y) => circ(x, y, 2);
{
  // A line and its stops: the line breaks at each ring
  add('transit-line', ['línea', 'paradas', 'recorrido', 'transit line', 'stops', 'route diagram'], [
    ring(12, 4.5),
    vl(12, 6.5, 10),
    ring(12, 12),
    vl(12, 14, 17.5),
    ring(12, 19.5),
  ]);
}
{
  // Branches: the line splits at its middle ring into two branches at 45°, each ending in a ring
  const [top, mid] = [[12, 4.5], [12, 11.5]];
  const out = (s) => {
    const dir = [s * Math.SQRT1_2, Math.SQRT1_2];
    const a = plus(mid, mul(dir, 2));
    const c = plus(mid, mul(dir, 7.75));
    return [line(a, plus(mid, mul(dir, 5.75))), ring(...c)];
  };
  const [l, r] = [out(-1), out(1)];
  add('transit-line-branch', ['ramal', 'línea con ramales', 'bifurcación', 'branch line', 'branches', 'split'], [
    ring(...top),
    vl(12, 6.5, 9.5),
    ring(...mid),
    l[0],
    l[1],
    r[0],
    r[1],
  ]);
}
{
  // Network map: two lines meeting at 45°, the interchange ring where they cross and a bar at each end
  const C = [12, 12];
  const k = 2.25;
  const d45 = Math.SQRT1_2;
  add('transit-map', ['mapa de la red', 'mapa del metro', 'red de transporte', 'transit map', 'metro map', 'network'], [
    roundline([[3.25, 7.5], [7.5, 7.5], plus(C, mul([-d45, -d45], k))], [0, 1.5, 0]),
    roundline([plus(C, mul([d45, d45], k)), [16.5, 16.5], [20.75, 16.5]], [0, 1.5, 0]),
    vl(12, 3.25, 12 - k),
    vl(12, 12 + k, 20.75),
    circ(...C, k),
    vl(3.25, 5.25, 9.75),
    vl(20.75, 14.25, 18.75),
    hl(3.25, 9.75, 14.25),
    hl(20.75, 9.75, 14.25),
  ]);
}
{
  // Interchange: two stop rings joined by a bar (one outline), a line leaving each of them
  const [A, B, r, w] = [[12, 6.5], [12, 17.5], 2.75, 1.5];
  const dy = Math.sqrt(r * r - w * w);
  const pA = (s) => [A[0] + s * w, A[1] + dy];
  const pB = (s) => [B[0] + s * w, B[1] - dy];
  const outline = `M${pt(pA(1))}A${f(r)} ${f(r)} 0 1 0 ${pt(pA(-1))}L${pt(pB(-1))}A${f(r)} ${f(r)} 0 1 0 ${pt(pB(1))}Z`;
  add('interchange', ['transbordo', 'correspondencia', 'cambio de línea', 'interchange', 'transfer', 'change lines'], [
    outline,
    hl(A[1], 3.25, A[0] - r),
    hl(B[1], B[0] + r, 20.75),
  ]);
}
{
  // Walking transfer: lugares's walking figure, raised 0.75, walking on a two-headed arrow (its
  // scaled-down figure brings its arm within 2.2 of its leg)
  const W = L.walking.d.map((d) => xf(d, 1, 0, -0.75));
  add('walk-transfer', ['transbordo a pie', 'caminar entre estaciones', 'conexión a pie', 'walking transfer', 'walk between', 'connection'], [
    ...W,
    hl(20.25, 2.75, 21.25),
    head([2.75, 20.25], [-1, 0], 2.5),
    head([21.25, 20.25], [1, 0], 2.5),
  ]);
}
{
  // The pins: lugares's map pin with a front view in its head, as mascotas's map-pin-paw. A front
  // under 8 wide can't hold its lights at 2.1: the bus is its body with its two tires in one outline
  // (separate, their insides closed at 2.1) and its windshield's line, the train its body, its
  // window line and its rails
  const pinD = L['map-pin'].d[0];
  const PIN_C = [12, 10.25];
  const bus = roundpoly([[9.5, 6.75], [14.5, 6.75], [14.5, 13.5], [13, 13.5], [13, 12.25], [11, 12.25], [11, 13.5], [9.5, 13.5]], [1.25, 1.25, 0.5, 0.5, 0.4, 0.4, 0.5, 0.5]);
  add('map-pin-bus', ['parada en el mapa', 'paradas cercanas', 'marcador de parada', 'bus stop marker', 'nearby stops', 'stop on map'], [pinD, bus, hl(9.75, 9.5, 14.5)]);
  // The train's rails run from its body down to the pin's walls
  const wall = (s) => {
    const a = polar(...PIN_C, 7, 90 - s * 45);
    const t = [12, PIN_C[1] + 7 * Math.SQRT2];
    return [a, t];
  };
  const rail = (s) => {
    const from = [12 + s * 1.75, 13.25];
    const dir = [s * 0.5, 1];
    const [a, t] = wall(s);
    // Where the rail's line meets the wall
    const den = dir[0] * (t[1] - a[1]) - dir[1] * (t[0] - a[0]);
    const k = ((a[0] - from[0]) * (t[1] - a[1]) - (a[1] - from[1]) * (t[0] - a[0])) / den;
    return line(from, plus(from, mul(dir, k)));
  };
  add('map-pin-train', ['estación en el mapa', 'estaciones cercanas', 'marcador de estación', 'station marker', 'nearby stations', 'station on map'], [
    pinD,
    sq(8.75, 5.5, 6.5, 7.75, 2.5),
    hl(9.25, 8.75, 15.25),
    rail(-1),
    rail(1),
  ]);
}

// ── Track and street ──
/** Two rails converging into the distance, with three sleepers across them. */
function track() {
  const [lb, lt, rb, rt] = [[5, 21.25], [9.75, 2.75], [19, 21.25], [14.25, 2.75]];
  const xAt = (a, b, y) => a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
  const sleeper = (y, e) => hl(y, xAt(lb, lt, y) - e, xAt(rb, rt, y) + e);
  return [line(lb, lt), line(rb, rt), sleeper(6.25, 1.25), sleeper(11.75, 1.5), sleeper(17.75, 1.75)];
}
add('train-track', ['vía', 'vías del tren', 'ferrocarril', 'railway track', 'rail line', 'tracks'], track());
{
  // Signal: a tall post with the signal head on top, its two lamps one above the other
  add('railway-signal', ['señal ferroviaria', 'semáforo de tren', 'falla de señal', 'railway signal', 'rail signal', 'signal failure'], [
    sq(8, 2.75, 8, 13, 4),
    circ(12, 6.75, 1.25),
    circ(12, 11.75, 1.25),
    vl(12, 15.75, 21.25),
    hl(21.25, 9.5, 14.5),
  ]);
}
{
  // Works: the track with a striped barrier set across it
  const bar = sq(3.25, 12, 17.5, 4.75, 1.5);
  const stripes = [6.5, 11.5, 16.5].map((x) => line([x - 2.375, 16.75], [x + 2.375, 12]));
  add('track-works', ['obras en la vía', 'cierre de línea', 'mantenimiento', 'track works', 'engineering works', 'line closure'], track(), {
    badge: own([bar, ...stripes], bar, { solid: [bar], cut: stripes }),
  });
}
{
  // Bus lane: the lane's two edges in perspective, the bus's front in it
  const B = busFront(6.25, 4.5, 11.5, 12.25);
  add('bus-lane', ['carril exclusivo', 'carril bus', 'metrobús', 'bus lane', 'busway', 'brt'], [line([2.5, 21.25], [3.25, 10.5]), line([21.5, 21.25], [20.75, 10.5]), ...B.d]);
}

// ── Shared mobility at the stops ──
/** The dock: a bollard whose head slopes up toward the back, its lock slot on the face. */
const dock = (x0, w = 6) => [roundpoly([[x0, 21.25], [x0, 9], [x0 + w, 6], [x0 + w, 21.25]], [0, 1.5, 1.5, 0]), vl(x0 + w / 2, 11.5, 15.5)];
{
  // Bike dock: a bike's front wheel locked in the bollard from behind it, its fork and handlebar
  const [post, slot] = dock(14.5);
  add('bike-dock', ['estación de bicicletas', 'bici compartida', 'bicicletas disponibles', 'bike dock', 'bike share', 'bikes available'], [
    circ(8.75, 15, 6),
    dot(8.75, 15),
    line([8.75, 15], [5.5, 5.25]),
    hl(5.25, 3, 8),
  ], { badge: own([post, slot], shut(post), { solid: [shut(post)], cut: [slot] }) });
  add('bike-dock-empty', ['anclaje libre', 'devolver bici', 'lugares disponibles', 'free dock', 'return bike', 'docks available'], [...dock(9), hl(21.25, 4.75, 19.25)]);
}
{
  // Bike rack: two inverted U stands on the ground
  const stand = (x0, x1) => roundline([[x0, 20.25], [x0, 6.5], [x1, 6.5], [x1, 20.25]], [0, 3, 3, 0]);
  add('bike-rack', ['estacionamiento de bicis', 'biciestacionamiento', 'aparcabicis', 'bike rack', 'bike parking', 'cycle parking'], [stand(4.75, 10.75), stand(13.25, 19.25), hl(20.25, 2.75, 21.25)]);
}
{
  // Scooter parking: lugares's kick scooter standing in a dashed bay
  const k = 0.58;
  const S = L.scooter.d.map((d) => xf(d, k, 12 - 12 * k, 12 - 11 * k));
  const R = 3;
  const [x0, y0, x1, y1] = [2.75, 2.75, 21.25, 21.25];
  // Each corner a dash (its quarter arc and 0.75 of each side), a dash in the middle of each side
  const corner = (cx, cy, a0) => {
    const p0 = polar(cx, cy, R, a0);
    const p1 = polar(cx, cy, R, a0 + 90);
    const r0 = (a0 * Math.PI) / 180;
    const r1 = ((a0 + 90) * Math.PI) / 180;
    const t0 = [p0[0] + Math.sin(r0) * 0.75, p0[1] - Math.cos(r0) * 0.75];
    const t1 = [p1[0] - Math.sin(r1) * 0.75, p1[1] + Math.cos(r1) * 0.75];
    return `M${pt(t0)}L${pt(p0)}A${R} ${R} 0 0 1 ${pt(p1)}L${pt(t1)}`;
  };
  const dashes = [
    corner(x1 - R, y0 + R, -90),
    corner(x1 - R, y1 - R, 0),
    corner(x0 + R, y1 - R, 90),
    corner(x0 + R, y0 + R, 180),
    hl(y0, 9.5, 14.5),
    hl(y1, 9.5, 14.5),
    vl(x0, 9.5, 14.5),
    vl(x1, 9.5, 14.5),
  ];
  add('scooter-parking', ['estacionar scooter', 'zona de scooters', 'terminar viaje', 'scooter parking', 'parking zone', 'end ride here'], [...S, ...dashes]);
}
{
  // Carpool: lugares's car, its cabin a little taller, two riders' heads resting on its dashboard
  const C = L.car.d;
  const cabin = roundline([[4.6, 10.25], [6.5, 4.25], [17.5, 4.25], [19.4, 10.25]], [0, 1.4, 1.4, 0]);
  add('carpool', ['viaje compartido', 'compartir auto', 'aventón', 'carpool', 'shared ride', 'rideshare'], [C[0], cabin, C[2], C[3], C[4], C[5], circ(9.25, 8.75, 1.5), circ(14.75, 8.75, 1.5)]);
}
/** Lugares's taxi at 0.8 in the bottom right corner (smaller, its lights touch its body at 2.1). */
const taxiAt = (d) => xf(d, 0.8, 21.25 - 21.25 * 0.8, 21.25 - 20.75 * 0.8);
{
  // Taxi stand: the stop (its round plate on its pole) with lugares's taxi waiting in front of it,
  // the pole cleared behind the taxi
  const T = L.taxi.d.map(taxiAt);
  const knock = [T[0], shut(T[1]), shut(T[2]), shut(T[3]), shut(T[6])].join('');
  add('taxi-stand', ['sitio de taxis', 'base de taxis', 'punto de recogida', 'taxi stand', 'taxi rank', 'pickup zone'], [circ(5.5, 5.25, 3), vl(5.5, 8.25, 14.5)], {
    badge: own(T, knock, { solid: L.taxi.fill.solid.map(taxiAt), cut: L.taxi.fill.cut.map(taxiAt) }),
  });
}
{
  // Park and ride: the parking P (lugares's) beside the bus's front
  const k = 0.68;
  const P = xf(L.parking.d[1], k, 2.75 - 9.75 * k, 8.5 - 7 * k);
  const B = busFront(9.75, 7.5, 11.5, 11.5);
  add('park-and-ride', ['estaciona y viaja', 'estacionamiento en estación', 'transbordo en auto', 'park and ride', 'park & ride', 'station parking'], [P, ...B.d]);
}

// ── Fill (DESIGN.md › Fill) ────────────────────────────────────────────────────────────────────
// By index into d: `solid` is filled (an open stroke is closed along an edge that is already solid:
// a wheel along its sill, a train's arch along the ground), `cut` is knocked out, `lines` stays a line
// with a clearance of paper, `wire` stays a line attached to the fill. The adopted fronts keep
// lugares's fill (moved with them); a front built by busFront carries its own.
const shift = (fill, dx) => Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map((d) => xf(d, 1, dx, 0))]));
const FILL = {
  'train-side': { solid: [0, 1, 2], cut: [3], lines: [4] },
  'train-carriage': { solid: [0, 1, 2], cut: [3, 4, 5, 6] },
  'train-sleeper': { solid: [0, 1, 2], cut: [3, 4, 5, 6] },
  'train-high-speed': { solid: [0], cut: [1], lines: [2] },
  'bus-side': { solid: [0, 1, 2], cut: [3, 4, 5] },
  'bus-ramp': { solid: [0, 1, 2], cut: [3], wire: [4] },
  'bus-double-decker': { solid: [0, 1, 2], cut: [3, 4] },
  'bus-coach': { solid: [0, 1, 2], cut: [3, 4] },
  'school-bus': { solid: [0, 1, 2], cut: [3, 4] },
  minibus: { solid: [0, 1, 2], cut: [3, 4] },
  locomotive: { solid: [0, 1, 2, 3] },
  subway: { solid: [1], cut: [2, 3, 4], lines: [0] },
  tram: { solid: [0], cut: [1, 2, 3], wire: [4, 5] },
  monorail: { solid: [0], cut: [1, 2, 3], wire: [4, 5, 6, 7] },
  funicular: { solid: [0], cut: [1, 2, 3], lines: [4] },
  'cable-car': { solid: [0], cut: [1], wire: [2, 3] },
  'bus-live': { solid: [0, 1, 2], cut: [3, 4, 5, 6], lines: [7, 8] },
  'stop-display': { solid: [0], cut: [1, 2, 3, 4, 5, 6], wire: [7] },
  'bus-stop': { solid: [0, 3], wire: [1, 2] },
  'bus-stop-star': { solid: [0, 3], wire: [1, 2] },
  'bus-shelter': { solid: [0], wire: [1, 2] },
  'bus-station': { solid: [1, 2, 3], cut: [4, 5, 6, 7], lines: [0] },
  'train-station': { solid: [0], cut: [1, 2, 3] },
  'train-platform': { solid: [2], cut: [3, 4, 5], wire: [6, 7], lines: [0, 1] },
  'train-platform-sync': { solid: [2], cut: [3, 4, 5], wire: [6, 7], lines: [0, 1] },
  'train-doors': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] },
  'stop-request': { solid: [2], cut: [3], wire: [0, 1], lines: [4, 5] },
  occupancy: { solid: [0, 1, 2, 3, 4, 5] },
  'ticket-office': { solid: [0, 1], cut: [2] },
  'ticket-machine': { solid: [0], cut: [1, 2, 3] },
  'fare-validator': { solid: [0], wire: [1, 2], lines: [3, 4] },
  'tap-in': { solid: [0], wire: [1, 2], lines: [3, 4] },
  'tap-out': { solid: [0], wire: [1, 2], lines: [3, 4] },
  'fare-gate': { solid: [0, 1, 2, 3] },
  'transit-card': { solid: [0], cut: [1, 2, 3] },
  'transit-card-plus': { solid: [0], cut: [1, 2, 3] },
  'mobile-ticket': { solid: [0], cut: [1] },
  timetable: { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'transit-line': { solid: [0, 2, 4], wire: [1, 3] },
  'transit-line-branch': { solid: [0, 2, 4, 6], wire: [1, 3, 5] },
  'transit-map': { solid: [4], wire: [0, 1, 2, 3, 5, 6, 7, 8] },
  interchange: { solid: [0], wire: [1, 2] },
  'walk-transfer': { solid: [0], wire: [1, 2, 3, 4], lines: [5, 6, 7] },
  'map-pin-bus': { solid: [0], cut: [1, 2] },
  'map-pin-train': { solid: [0], cut: [1, 2, 3, 4] },
  'railway-signal': { solid: [0], cut: [1, 2], wire: [3, 4] },
  'bus-lane': { solid: [2, 3, 4], cut: [5, 6, 7, 8], lines: [0, 1] },
  'bike-dock': { solid: [1], wire: [0, 2, 3] },
  'bike-dock-empty': { solid: [0], cut: [1], wire: [2] },
  'scooter-parking': { solid: [0, 1], wire: [2, 3, 4], lines: [5, 6, 7, 8, 9, 10, 11, 12] },
  'park-and-ride': { solid: [1, 2, 3], cut: [4, 5, 6, 7], lines: [0] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const pick = (ix) => ix.map((i) => d[i]);
  icons[name].fill = { solid: pick(spec.solid).map(shut) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}
// The adopted fronts: lugares's fill, moved with the drawing
for (const name of ['bus-electric', 'bus-night']) icons[name].fill = L.bus.fill;
for (const name of ['bus-alert', 'bus-clock']) icons[name].fill = shift(L.bus.fill, -0.5);
for (const name of ['train-alert', 'train-clock', 'train-x']) icons[name].fill = shift(L.train.fill, -1);
// The car's (lugares's): its cabin closed along the body, the cut between them, the riders' heads
// and the lights cut out; the taxi in front of its stop carries its own fill, scaled with it
{
  const { d } = icons.carpool;
  icons.carpool.fill = { solid: [d[0], shut(d[1]), shut(d[2]), shut(d[3])], cut: [hl(10.25, 6.4, 17.6), d[4], d[5], d[6], d[7]] };
  const T = icons['taxi-stand'].d;
  icons['taxi-stand'].fill = { solid: [T[0]], wire: [T[1]] };
}
// Glass in a filled body (vehiculos's rule): a band that runs into the front stops 1.75 short of it
// and the pillars stop 0.6 inside the band, so no cut nicks the silhouette or pokes out of the band;
// on the funicular the window line stops short of its ends and its short pillars are left out
{
  const shorten = (d, a, b = a) => {
    const [[x0, y0], [x1, y1]] = d.match(/-?[\d.]+/g).map(Number).reduce((p, v, i, arr) => (i % 2 ? p : [...p, [v, arr[i + 1]]]), []);
    const u = unit([x1 - x0, y1 - y0]);
    return line([x0 + u[0] * a, y0 + u[1] * a], [x1 - u[0] * b, y1 - u[1] * b]);
  };
  const glass = (name, bandIx, pillarIx, front) => {
    const { d } = icons[name];
    const cut = icons[name].fill.cut.filter((c) => c !== d[bandIx] && !pillarIx.map((i) => d[i]).includes(c));
    const bandCut = front ? d[bandIx].replace(new RegExp(`^M${f(front[0])} `), `M${f(front[0] - 1.75)} `).replace(new RegExp(`L${f(front[0])} ${f(front[1])}$`), `L${f(front[0] - 1.75)} ${f(front[1])}`) : d[bandIx];
    icons[name].fill.cut = [bandCut, ...pillarIx.map((i) => shorten(d[i], 0.6)), ...cut];
  };
  glass('bus-side', 3, [4, 5], [21, 11]);
  glass('school-bus', 3, [4], [16.75, 10.5]);
  glass('bus-ramp', 3, [], [16, 10.5]);
  glass('train-carriage', 3, [4, 5, 6]);
  glass('train-sleeper', 3, [4, 5, 6]);
  glass('minibus', 3, [4]);
  glass('monorail', 1, [2, 3]);
  const { d } = icons.funicular;
  icons.funicular.fill.cut = [shorten(d[1], 1.9)];
}
// Lines only: their filled version is the outline itself
for (const name of ['subway-entrance', 'grab-strap', 'train-track', 'track-works', 'bike-rack']) icons[name].fill = false;

// ── Parts ─────────────────────────────────────────────────────────────────────────────────────
const SIDE = { body: [0], wheels: [1, 2] };
const PARTS = {
  'train-side': { ...SIDE, windows: [3], rail: [4] },
  'train-carriage': { ...SIDE, windows: [3, 4, 5, 6] },
  'train-sleeper': { ...SIDE, windows: [3, 4, 5, 6] },
  'train-high-speed': { body: [0], windows: [1], rail: [2] },
  'bus-side': { ...SIDE, windows: [3, 4, 5] },
  'bus-ramp': { ...SIDE, windows: [3], ramp: [4] },
  'bus-double-decker': { ...SIDE, windows: [3, 4] },
  'bus-coach': { ...SIDE, windows: [3], hatch: [4] },
  'school-bus': { ...SIDE, windows: [3, 4] },
  minibus: { ...SIDE, windows: [3, 4] },
  locomotive: { ...SIDE, chimney: [3] },
  subway: { tunnel: [0], body: [1], window: [2], lights: [3, 4] },
  tram: { body: [0], window: [1], lights: [2, 3], pantograph: [4], wire: [5] },
  monorail: { body: [0], windows: [1, 2, 3], beam: [4, 5], pillars: [6, 7] },
  funicular: { body: [0], windows: [1, 2, 3], track: [4] },
  'cable-car': { cabin: [0], window: [1], grip: [2], cable: [3] },
  'bus-electric': L.bus.parts,
  'bus-night': L.bus.parts,
  'bus-alert': L.bus.parts,
  'bus-clock': L.bus.parts,
  'bus-live': { body: [0], wheels: [1, 2], windows: [3, 4], lights: [5, 6], wave: [7, 8] },
  'train-alert': L.train.parts,
  'train-clock': L.train.parts,
  'train-x': L.train.parts,
  'stop-display': { screen: [0], rows: [1, 2, 3, 4, 5, 6], pole: [7] },
  'bus-stop': { sign: [0], pole: [1, 2], timetable: [3] },
  'bus-stop-star': { sign: [0], pole: [1, 2], timetable: [3] },
  'bus-shelter': { roof: [0], post: [1], bench: [2] },
  'bus-station': { canopy: [0], body: [1], wheels: [2, 3], windows: [4, 5], lights: [6, 7] },
  'train-station': { building: [0], clock: [1], hands: [2], door: [3] },
  'subway-entrance': { stairs: [0], railing: [1] },
  'train-platform': { platform: [0], canopy: [1], body: [2], window: [3], lights: [4, 5], rails: [6, 7] },
  'train-platform-sync': { platform: [0], canopy: [1], body: [2], window: [3], lights: [4, 5], rails: [6, 7] },
  'train-doors': { frame: [0], seam: [1], windows: [2, 3], arrow: [4, 5, 6, 7] },
  'stop-request': { pole: [0, 1], button: [2, 3], wave: [4, 5] },
  'grab-strap': { rail: [0], straps: [1, 2, 3, 4] },
  occupancy: { person: [0, 1, 2, 3, 4, 5] },
  'ticket-office': { awning: [0], ticket: [1, 2] },
  'ticket-machine': { body: [0], screen: [1], slot: [2], ticket: [3] },
  'fare-validator': { reader: [0], post: [1, 2], wave: [3, 4] },
  'tap-in': { reader: [0], post: [1, 2], wave: [3, 4] },
  'tap-out': { reader: [0], post: [1, 2], wave: [3, 4] },
  'fare-gate': { cabinets: [0, 1], paddles: [2, 3] },
  'transit-card': { card: [0], window: [1], lights: [2, 3] },
  'transit-card-plus': { card: [0], window: [1], lights: [2, 3] },
  'mobile-ticket': { phone: [0, 1] },
  timetable: { panel: [0], clock: [1], hands: [2], rows: [3, 4, 5, 6] },
  'transit-line': { stops: [0, 2, 4], line: [1, 3] },
  'transit-line-branch': { stops: [0, 2, 4, 6], line: [1, 3, 5] },
  'transit-map': { line: [0, 1, 2, 3], interchange: [4], ends: [5, 6, 7, 8] },
  interchange: { stations: [0], line: [1, 2] },
  'walk-transfer': { person: [0, 1, 2, 3, 4], arrow: [5, 6, 7] },
  'map-pin-bus': { pin: [0], bus: [1, 2] },
  'map-pin-train': { pin: [0], train: [1, 2, 3, 4] },
  'train-track': { rails: [0, 1], sleepers: [2, 3, 4] },
  'railway-signal': { head: [0], lamps: [1, 2], post: [3, 4] },
  'track-works': { rails: [0, 1], sleepers: [2, 3, 4] },
  'bus-lane': { lane: [0, 1], body: [2], wheels: [3, 4], windows: [5, 6], lights: [7, 8] },
  'bike-dock': { wheel: [0, 1], fork: [2, 3] },
  'bike-dock-empty': { dock: [0], slot: [1], ground: [2] },
  'bike-rack': { stands: [0, 1], ground: [2] },
  'scooter-parking': { scooter: [0, 1, 2, 3, 4], bay: [5, 6, 7, 8, 9, 10, 11, 12] },
  carpool: { body: [0], cabin: [1], wheels: [2, 3], lights: [4, 5], riders: [6, 7] },
  'taxi-stand': { sign: [0], pole: [1] },
  'park-and-ride': { letter: [0], body: [1], wheels: [2, 3], windows: [4, 5], lights: [6, 7] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// Vehicles from the side drive ahead (on their rail, the rail stays); fronts and pins bounce; each
// badge keeps its gesture from the rest of the set
const BADGE = [17.25, 17.25];
const MOTION = {
  'train-side': { effect: 'slide', parts: ['body', 'wheels', 'windows'], vector: [2, 0] },
  'train-high-speed': { effect: 'slide', parts: ['body', 'windows'], vector: [2.5, 0] },
  'bus-side': { effect: 'slide', vector: [2, 0] },
  'bus-ramp': { effect: 'wiggle', parts: ['ramp'], origin: [16, 15.75] },
  'bus-double-decker': { effect: 'bounce', vector: [0, -1.5] },
  'bus-coach': { effect: 'slide', vector: [2, 0] },
  'school-bus': { effect: 'slide', vector: [2, 0] },
  minibus: { effect: 'slide', vector: [2, 0] },
  locomotive: { effect: 'slide', vector: [2, 0] },
  'train-carriage': { effect: 'bounce', vector: [0, -1.5] },
  subway: { effect: 'bounce', parts: ['body', 'window', 'lights'], vector: [0, -1.5] },
  tram: { effect: 'bounce', parts: ['body', 'window', 'lights'], vector: [0, -1.5] },
  monorail: { effect: 'slide', parts: ['body', 'windows'], vector: [2, 0] },
  funicular: { effect: 'slide', parts: ['body', 'windows'], vector: [2, -1] },
  'cable-car': { effect: 'slide', parts: ['cabin', 'window', 'grip'], vector: [2, -0.47] },
  'bus-electric': { effect: 'beat', parts: ['badge'], origin: [19.75, 5] },
  'bus-night': { effect: 'float', parts: ['badge'], vector: [0, -1.5] },
  'train-sleeper': { effect: 'float', parts: ['badge'], vector: [0, -1.5] },
  'bus-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'bus-clock': { effect: 'spin', parts: ['badge'], origin: BADGE },
  'bus-live': { effect: 'beat', parts: ['wave'], origin: [13.75, 8.25] },
  'train-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'train-clock': { effect: 'spin', parts: ['badge'], origin: BADGE },
  'train-x': { effect: 'beat', parts: ['badge'], origin: BADGE },
  'bus-stop': { effect: 'wiggle', origin: [12, 21.25] },
  'bus-stop-star': { effect: 'beat', parts: ['badge'], origin: BADGE },
  'train-station': { effect: 'spin', parts: ['hands'], origin: [12, 9] },
  'train-platform-sync': { effect: 'spin', parts: ['badge'], origin: BADGE },
  'stop-request': { effect: 'beat', parts: ['button'], origin: [12, 12] },
  'grab-strap': { effect: 'ring', parts: ['straps'], origin: [12, 3.5] },
  'ticket-office': { effect: 'bounce', parts: ['ticket'], vector: [0, -1.5] },
  'ticket-machine': { effect: 'slide', parts: ['ticket'], vector: [0, 1.5] },
  'fare-validator': { effect: 'beat', parts: ['wave'], origin: [12, 9.13] },
  'tap-in': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'tap-out': { effect: 'slide', parts: ['badge'], vector: [-1.5, 0] },
  'transit-card-plus': { effect: 'beat', parts: ['badge'], origin: BADGE },
  'mobile-ticket': { effect: 'wiggle', parts: ['badge'], origin: [15, 16.5] },
  timetable: { effect: 'spin', parts: ['hands'], origin: [12, 8.5] },
  'walk-transfer': { effect: 'slide', parts: ['person'], vector: [1.5, 0] },
  'map-pin-bus': { effect: 'bounce', vector: [0, -2] },
  'map-pin-train': { effect: 'bounce', vector: [0, -2] },
  'bus-lane': { effect: 'bounce', parts: ['body', 'wheels', 'windows', 'lights'], vector: [0, -1.5] },
  'bike-dock': { effect: 'wiggle', parts: ['badge'], origin: [17.5, 21.25] },
  'scooter-parking': { effect: 'bounce', parts: ['scooter'], vector: [0, -1.5] },
  carpool: { effect: 'bounce', vector: [0, -1.5] },
  'taxi-stand': { effect: 'slide', parts: ['badge'], vector: [1, 0] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Mirror, levels and variants ───────────────────────────────────────────────────────────────
// What faces or moves one way flips in right-to-left languages: the vehicles seen from the side (as
// vehiculos's), the walk, the hop across the gap and the tap in and out; symmetric fronts and
// coaches, and fixed things (stairs, a shelter, a validator alone) don't
for (const name of ['train-side', 'train-high-speed', 'bus-side', 'bus-ramp', 'bus-coach', 'school-bus', 'minibus', 'locomotive', 'monorail', 'funicular', 'cable-car', 'walk-transfer', 'tap-in', 'tap-out']) icons[name].mirror = true;
// Occupancy lights one, two or three riders
icons.occupancy.levels = [[0, 1], [2, 3], [4, 5]];
// A slash says nothing over a status badge
for (const name of ['bus-alert', 'bus-clock', 'train-alert', 'train-clock', 'train-x', 'bus-stop-star', 'train-platform-sync', 'tap-in', 'tap-out', 'transit-card-plus']) icons[name].variants = { slash: false };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// Drawn on the pixel grid (pixel centers at 0.75 + 1.5k): fewer pieces, crisp lines.
const px = (k) => 0.75 + 1.5 * k;
const P = (x, y) => [px(x), px(y)];
/** A small drawing: its paths, and its fill by index ({ solid, cut, lines, wire }). */
const small = (name, d, fill) => {
  const pick = (ix) => ix.map((i) => d[i]);
  icons[name].small = { d, ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, k === 'solid' ? pick(v).map(shut) : pick(v)])) }) };
};
// Funicular: the car on a 1:2 slope (whole pixel steps), its windows left out
small('funicular', [roundpoly([P(4, 10), P(4, 6), P(12, 2), P(12, 6)], 0.4), line(P(2, 13), P(14, 7))], { solid: [0], lines: [1] });
// Metro entrance: four steps of two pixels, the railing at 45°
small('subway-entrance', [line(P(1, 5), P(4, 5), P(4, 7), P(6, 7), P(6, 9), P(8, 9), P(8, 11), P(10, 11), P(10, 13), P(14, 13)), line(P(2, 5), P(2, 2), P(5, 2), P(11, 8))]);
// Stop request: the button a two-pixel ring on its pole; its arcs ran into it
{
  const c = px(7);
  small('stop-request', [vl(c, px(1), c - 3), vl(c, c + 3, px(13)), circ(c, c, 3), circ(c, c, 0.1)], { solid: [2], cut: [3], wire: [0, 1] });
}
// The validator: its head level, one pixel row of waves less
const validator16 = (k) => {
  const c = px(k);
  return [sq(c - 6, px(6), 12, 4.5, 1), vl(c, px(9), px(13)), hl(px(13), c - 3, c + 3), arc(c, px(6), 3, -135, -45).d, arc(c, px(6), 6, -130, -50).d];
};
const VAL16 = { solid: [0], wire: [1, 2], lines: [3, 4] };
small('fare-validator', validator16(7), VAL16);
small('tap-in', validator16(5), VAL16);
small('tap-out', validator16(5), VAL16);
// A small drawing carries its own badge (without one, tap in and tap out were the validator alone)
icons['tap-in'].small.badge = badge('arrow-right', { size: 16 });
icons['tap-out'].small.badge = badge('arrow-left', { size: 16 });
// The pins: the bus a 3 × 3 pixel body with its windshield line and two pixel tires; the train a
// rounder body with its window line and two pixel rails
{
  const pinD = L['map-pin'].d[0];
  small('map-pin-bus', [pinD, sq(px(6), px(4), 4.5, 4.5, 0.75), hl(px(5), px(6), px(9)), circ(px(6), px(8), 0.1), circ(px(9), px(8), 0.1)], { solid: [0], cut: [1, 2, 3, 4] });
  small('map-pin-train', [pinD, sq(px(6), px(3), 4.5, 6, 1.5), hl(px(5), px(6), px(9)), circ(px(6), px(8), 0.1), circ(px(9), px(8), 0.1)], { solid: [0], cut: [1, 2, 3, 4] });
}
// Monorail: the car's band one window (its pillars ran into a grid), the beam and its two pillars
small('monorail', [roundline([P(2, 8), P(2, 2), P(13, 2), P(13, 8)], [0, 1.5, 2.25, 0]), sq(px(4), px(4), 10.5, 3, 0.75), line(P(1, 8), P(14, 8)), line(P(1, 10), P(14, 10)), line(P(4, 10), P(4, 13)), line(P(11, 10), P(11, 13))], { solid: [0], cut: [1], wire: [2, 3, 4, 5] });
// Platform: the train's front seven pixels wide (its window, its pixel lights and its rails), the
// canopy and the platform's step on whole pixels; with the sync badge it carries its own
{
  const d = [
    roundline([P(14, 11), P(11, 11), P(11, 14)], [0, 0.75, 0]),
    roundline([P(13, 11), P(13, 1), P(1, 1)], [0, 0.75, 0]),
    sq(px(1), px(3), 10.5, 12, 2.25),
    sq(px(3), px(5), 4.5, 3, 0.75),
    circ(...P(3, 9), 0.1),
    circ(...P(6, 9), 0.1),
    line(P(3, 11), P(2, 14)),
    line(P(6, 11), P(7, 14)),
  ];
  const fill = { solid: [2], cut: [3, 4, 5], wire: [6, 7], lines: [0, 1] };
  small('train-platform', d, fill);
  small('train-platform-sync', d, fill);
  icons['train-platform-sync'].small.badge = badge('sync', { size: 16 });
}
// Doors: the leaves' windows left out (with them and the arrows the doors ran into a grid); the
// seam on a pixel column, the arrows two-pixel chevrons opening out from it (a pixel shaft and head
// read as a plus)
small('train-doors', [roundline([P(2, 14), P(2, 2), P(14, 2), P(14, 14)], [0, 2.25, 2.25, 0]), line(P(8, 2), P(8, 14)), line(P(6, 8), P(4, 10), P(6, 12)), line(P(10, 8), P(12, 10), P(10, 12))], { solid: [0], cut: [1, 2, 3] });
// Network map: the two lines and the interchange ring on whole pixels, their end bars left out
{
  const c = px(8);
  const o = 3 * Math.SQRT1_2;
  small('transit-map', [
    roundline([P(1, 4), P(4, 4), [c - o, c - o]], [0, 0.75, 0]),
    roundline([[c + o, c + o], P(12, 12), P(14, 12)], [0, 0.75, 0]),
    line(P(8, 1), [c, c - 3]),
    line([c, c + 3], P(8, 14)),
    circ(c, c, 3),
  ], { solid: [4], wire: [0, 1, 2, 3] });
}
// Railway signal: the head five pixels wide, its lamps two crisp 2 × 2 dots
small('railway-signal', [sq(px(5), px(1), 7.5, 10.5, 3.75), circ(12, 6, 1), circ(12, 10.5, 1), vl(px(7), px(8), px(13)), hl(px(13), px(5), px(9))], { solid: [0], cut: [1, 2], wire: [3, 4] });

export default { category: 'transito', label: 'Transporte público', icons };
