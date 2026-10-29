// Vehicles: cars by body and by view, vans, trucks by kind, construction machines, motorcycles,
// bicycles by kind, caravans and trailers. Everything is computed with the engine
// (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a
// square bottom-right corner on containers. The category adopts lugares's `car`, `taxi`, `bicycle`
// and `scooter` (drawn there, never redrawn here): the car's front view and the bicycle are read
// from lugares, and comercio's truck (its box, its cab and its wheels) is every truck's base, with
// logistica's snowflake and limpieza's broom riding on it as pieces.
//
// The side view: every car seen from the side faces right and shares one construction. The wheels
// are arcs of r 2.5 hanging under the sill (y 16.5) from centers 0.75 below it, so more than half of
// each tire shows, as the front view's tires hang under its body; the window band is the belt line
// at y 10.5 and the glass above it is split by pillars. A body type changes only its silhouette (a
// polygon with rounded corners): its roof, its tail, its hood. Trucks keep comercio's construction
// (a body over full wheels of r 1.75, 3 below it) with one cab for all of them.
import { arc, badge, circ, dot, gear, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import bienesRaices from './bienes-raices.mjs';
import comercio from './comercio.mjs';
import logistica from './logistica.mjs';
import limpieza from './limpieza.mjs';
import lugares from './lugares.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => scale(v, 1 / len(v));
const deg = (r) => (r * 180) / Math.PI;
const SQ = { square: ['br'] };
/** Moves `d` from a toward b. */
const toward = (a, b, d) => plus(a, scale(unit(sub(b, a)), d));
/** The x where the segment a → b crosses the height y. */
const atY = (a, b, y) => a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
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
    const S = plus(V, scale(u, t));
    const E = plus(V, scale(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/**
 * Closes every open subpath, for `fill.solid` (only closed shapes go there). The closing segment
 * runs along an edge that is already solid, so the silhouette doesn't change.
 */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w, y + r])}V${N(y + h - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${N(x + w - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w - r, y + h])}H${N(x + r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** A segment shortened by `d0` at its start and `d1` at its end (a cut that stops short of an edge). */
const inset = (a, b, d0, d1 = d0) => line(toward(a, b, d0), toward(b, a, d1));

// ── The side view ─────────────────────────────────────────────────────────────────────────────
const ROOF = 5.75;
const BELT = 10.5;
const BOT = 16.5;
const WY = 17.25;
const WR = 2.5;
const XR = 6.75;
const XF = 17.25;
/** A tire under the sill: the arc of its circle below `bot`, its ends on the sill. */
function wheel(x, { r = WR, y = WY, bot = BOT } = {}) {
  const a = deg(Math.asin((bot - y) / r));
  return arc(x, y, r, a, 180 - a).d;
}

/**
 * A car from the side: its silhouette (`pts` with one radius per vertex), its tires, the belt line
 * between `belt[0]` and `belt[1]` and a pillar at each of `pillars`, from the roof `roof` down to the
 * belt. Returns { d, fill, parts } with the glass's lines knocked out of the fill, short of the edges
 * (the belt's cut runs on into a pillar that stands at its end; `beltCut` sets its ends).
 * `extra` adds pieces of its own: { d, as, name }, `as` its place in the fill (an open stroke in
 * `solid` closes along its chord) and `name` its part.
 */
function side({ pts, r, belt, pillars = [], roof = ROOF, wheels = [XR, XF], tire = {}, extra = [], beltCut }) {
  const body = roundpoly(pts, r);
  const tires = wheels.map((x) => wheel(x, tire));
  const band = line([belt[0], BELT], [belt[1], BELT]);
  const posts = pillars.map((x) => line([x, roof], [x, BELT]));
  const d = [body, ...tires, band, ...posts, ...extra.map((x) => x.d)];
  const fill = {
    solid: [body, ...tires.map(shut)],
    cut: [beltCut ? line([beltCut[0], BELT], [beltCut[1], BELT]) : inset([belt[0], BELT], [belt[1], BELT], pillars.includes(belt[0]) ? 0 : 1.75, pillars.includes(belt[1]) ? 0 : 1.75), ...pillars.map((x) => line([x, BELT], [x, roof + 2.25]))],
  };
  const parts = { body: [0], wheels: [1, 2], windows: [3, ...posts.map((_, i) => 4 + i)] };
  extra.forEach((x, i) => {
    fill[x.as] = [...(fill[x.as] ?? []), x.fillD ?? (x.as === 'solid' ? shut(x.d) : x.d)];
    if (x.name) parts[x.name] = [...(parts[x.name] ?? []), 4 + posts.length + i];
  });
  return { d, fill, parts };
}

// The generic car: a rounded body, the cabin centered over it with its rear falling to the tail
// (no trunk step) and one pillar between the two windows.
const SIDE = {
  pts: [
    [2.5, BOT],
    [2.5, 12],
    [8.25, ROOF],
    [14.5, ROOF],
    [18, BELT],
    [21.5, 11.25],
    [21.5, BOT],
  ],
  r: [1, 1.25, 1.5, 1.5, 0, 2, 1],
};
SIDE.belt = [atY(SIDE.pts[1], SIDE.pts[2], BELT), 18];

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
/** Adds an icon; `extra` holds its other fields (badge, fill, parts…). */
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Adds a side-view car built by `side()`. */
const addSide = (name, tags, spec) => {
  const { d, fill, parts } = side(spec);
  add(name, tags, d, { fill, parts });
};

// ── Cars by view ──
addSide('car-side', ['auto de lado', 'coche', 'perfil', 'vehículo', 'car side', 'vehicle'], { ...SIDE, pillars: [11.25] });
{
  // The front car's body, cabin and tires; the headlights become two tail-light bars high at the
  // corners and the plate a short slot low in the middle, 2.9 from every edge
  const [body, cabin, ...tires] = lugares.icons.car.d.slice(0, 4);
  const lights = [line([5.75, 13.15], [8.25, 13.15]), line([15.75, 13.15], [18.25, 13.15])];
  const plate = line([10.75, 14.85], [13.25, 14.85]);
  add('car-rear', ['auto por detrás', 'parte trasera', 'calaveras', 'car rear', 'back of car', 'tail lights'], [body, cabin, ...tires, ...lights, plate], {
    fill: { solid: [body, shut(cabin), ...tires.map(shut)], cut: [line([6.75, 10.25], [17.25, 10.25]), ...lights, plate] },
    parts: { body: [0], cabin: [1], wheels: [2, 3], lights: [4, 5], plate: [6] },
  });
}
// The car from above, its nose up, as on a parking plan: the body, the roof inset in its middle and
// the four pillars running from the roof's corners out to the body's sides, so the windshield and
// the rear window read as the trapezoids between them. (A roof alone between two bands across the
// body read as a zero in a capsule; a cabin inset along the whole body, as an eye.)
const TOP = (() => {
  const [x0, x1] = [6.25, 17.75];
  const body = sq(x0, 2.75, x1 - x0, 18.5, 4.5);
  // The roof's corners are tight (0.5) so each pillar ends on its corner
  const roof = roundpoly(
    [
      [9.25, 9.75],
      [14.75, 9.75],
      [14.75, 15.75],
      [9.25, 15.75],
    ],
    0.5,
  );
  const pillars = [line([9.25, 9.75], [x0, 7]), line([14.75, 9.75], [x1, 7]), line([9.25, 15.75], [x0, 18]), line([14.75, 15.75], [x1, 18])];
  return { body, roof, pillars };
})();
add('car-top', ['auto visto desde arriba', 'marcador de viaje', 'flotilla en mapa', 'car top view', 'trip marker', 'fleet map'], [TOP.body, TOP.roof, ...TOP.pillars], {
  fill: { solid: [TOP.body], cut: [TOP.roof, ...TOP.pillars] },
  parts: { body: [0], roof: [1], pillars: [2, 3, 4, 5] },
});

// ── Cars by body ──
// The sedan: three boxes, the trunk deck level at the belt for 4.75 behind the rear window, the
// cabin and the hood (a trunk shorter than that read as car-side's fastback)
const SEDAN = {
  pts: [
    [2.5, BOT],
    [2.5, BELT],
    [7.25, BELT],
    [9.5, ROOF],
    [14.25, ROOF],
    [17.5, BELT],
    [21.5, 11.25],
    [21.5, BOT],
  ],
  r: [1, 1, 0, 1.5, 1.5, 0, 2, 1],
  belt: [7.25, 17.5],
  pillars: [11.75],
};
addSide('car-sedan', ['sedán', 'tres volúmenes', 'tipo de carrocería', 'sedan', 'saloon', 'body type'], SEDAN);
// The hatchback: shorter at the back, its roof dropping into a near-vertical tailgate right behind
// the rear wheel
{
  const pts = [
    [3.75, BOT],
    [4.5, ROOF],
    [14, ROOF],
    [17.75, BELT],
    [21.5, 11.25],
    [21.5, BOT],
  ];
  addSide('car-hatchback', ['hatchback', 'compacto', 'cinco puertas', 'hatchback car', 'body type', 'two-box'], {
    pts,
    r: [1, 1.75, 1.5, 0, 2, 1],
    belt: [atY(pts[0], pts[1], BELT), 17.75],
    pillars: [10.75],
    wheels: [7.5, XF],
  });
}
// The SUV: taller and boxier, an upright tail, its sill higher (more of each tire shows) and its
// roof rails a line over the roof, 3 above it
{
  const [roof, bot] = [5, 16];
  const pts = [
    [2.75, bot],
    [2.75, roof],
    [14.25, roof],
    [17.5, BELT],
    [21.5, 11],
    [21.5, bot],
  ];
  addSide('car-suv', ['camioneta', 'suv', 'todoterreno urbano', 'sport utility', 'crossover', 'body type'], {
    pts,
    r: [1, 1.75, 1.5, 0, 1.75, 1],
    belt: [2.75, 17.5],
    pillars: [10.25],
    roof,
    tire: { bot },
    extra: [{ d: line([4.75, 2], [12.75, 2]), as: 'lines', name: 'rails' }],
  });
}
// The wagon: the sedan's length with the roof carried flat to a slanted tail and three windows
const WAGON = (() => {
  const pts = [
    [2.5, BOT],
    [3, ROOF],
    [14.5, ROOF],
    [18, BELT],
    [21.5, 11.25],
    [21.5, BOT],
  ];
  return { pts, r: [1, 1.5, 1.5, 0, 2, 1], belt: [atY(pts[0], pts[1], BELT), 18] };
})();
addSide('car-wagon', ['familiar', 'station wagon', 'guayín', 'estate car', 'wagon', 'body type'], { ...WAGON, pillars: [7.25, 11.5] });
// The coupe: a lower roof that falls to the tail in one long curve, a long hood and one window
{
  const pts = [
    [2.5, BOT],
    [2.5, 12.5],
    [8.5, 6.25],
    [12.75, 6.25],
    [16.25, BELT],
    [21.5, 11.25],
    [21.5, BOT],
  ];
  addSide('car-coupe', ['cupé', 'dos puertas', 'deportivo', 'coupe', 'two-door', 'body type'], {
    pts,
    r: [1, 1.25, 4.5, 1.5, 0, 2, 1],
    belt: [atY(pts[1], pts[2], BELT), 16.25],
    roof: 6.25,
  });
}
// The convertible: the side car's lower body with no roof over it, the windshield's frame raked
// back from the cowl and the folded top bunched in a small half round on the rear deck. (Two seat
// backs between them made a row of spikes; a taller top, a pickup's cab.)
{
  const body = roundpoly(
    [
      [2.5, BOT],
      [2.5, BELT],
      [16.5, BELT],
      [21.5, 11.75],
      [21.5, BOT],
    ],
    [1, 1.25, 0, 2, 1],
  );
  const tires = [wheel(XR), wheel(XF)];
  const top = arc(6, BELT, 2, 180, 360).d;
  const shield = line([16.5, BELT], [13.75, 5.75]);
  add('car-convertible', ['convertible', 'descapotable', 'sin techo', 'cabriolet', 'roadster', 'open top'], [body, ...tires, top, shield], {
    fill: { solid: [body, ...tires.map(shut), shut(top)], wire: [shield] },
    parts: { body: [0], wheels: [1, 2], top: [3], windshield: [4] },
  });
}
// The sports car: a low wedge, its small cabin set back, a long falling hood, the wheels at the
// extremes and a wing on a stalk over the rear deck
{
  const wing = 'M2 7.5H4.5M3.25 7.5V10.5';
  addSide('car-sports', ['deportivo', 'auto de carreras', 'alto desempeño', 'sports car', 'performance', 'supercar'], {
    pts: [
      [2.5, BOT],
      [2.5, BELT],
      [5.5, BELT],
      [9, 7.25],
      [11.5, 7.25],
      [15.75, BELT],
      [21.5, 12.5],
      [21.5, BOT],
    ],
    r: [1, 1, 0, 1.75, 1.25, 0, 1.75, 1],
    belt: [5.5, 15.75],
    roof: 7.25,
    wheels: [6, 18],
    extra: [{ d: wing, as: 'wire', name: 'wing' }],
  });
}
// The city car: a very short body that is almost all cabin, one window, a wheel at each corner
{
  const pts = [
    [5, BOT],
    [5.5, ROOF],
    [13, ROOF],
    [16.25, BELT],
    [19, 11.25],
    [19, BOT],
  ];
  addSide('car-compact', ['auto urbano', 'microcoche', 'auto compartido', 'city car', 'microcar', 'car sharing'], {
    pts,
    r: [1, 2, 1.5, 0, 1.75, 1],
    belt: [atY(pts[0], pts[1], BELT), 16.25],
    wheels: [8.5, 15.5],
  });
}
// The off-roader: an upright box on larger tires (r 3) with its sill high and the spare wheel
// standing off the tailgate (a roof rack on posts read as a suitcase's handle)
{
  const [roof, bot] = [5.5, 15.5];
  const tire = { r: 3, bot };
  const spare = roundline(
    [
      [5, 7.5],
      [2, 7.5],
      [2, 13.5],
      [5, 13.5],
    ],
    [0, 1.25, 1.25, 0],
  );
  addSide('car-offroad', ['todoterreno', '4x4', 'aventura', 'off-road', 'four-wheel drive', 'jeep'], {
    pts: [
      [5, bot],
      [5, roof],
      [14.5, roof],
      [16.25, BELT],
      [21.5, BELT],
      [21.5, bot],
    ],
    r: [1, 1.5, 1, 0, 1.5, 1],
    belt: [5, 16.25],
    pillars: [10],
    roof,
    tire,
    wheels: [8.75, 18],
    extra: [{ d: spare, as: 'solid', name: 'spare' }],
  });
}
// The classic car: a round fender over each wheel, the running board between them along the sill,
// the upright cabin rounded at the back of its roof and the long hood between it and the front
// fender. (With a narrow cabin rising straight off the rear fender, it read as a tractor.)
{
  const [rc, rr, fc, fr] = [6.5, 4.25, 17.25, 4.25];
  const wall = 4.5;
  const glass = 12.25;
  const grille = 19.25;
  const rearTop = [wall, BOT - Math.sqrt(rr * rr - (wall - rc) ** 2)];
  const frontTop = [grille, BOT - Math.sqrt(fr * fr - (grille - fc) ** 2)];
  const upper = roundline(
    [
      rearTop,
      [wall, ROOF],
      [11.5, ROOF],
      [glass, BELT],
      [grille, BELT],
      frontTop,
    ],
    [0, 2.75, 1, 0, 1, 0],
  ).replace(/^M[^LA]*/, '');
  const body = `M${pt([rc - rr, BOT])}A${N(rr)} ${N(rr)} 0 0 1 ${pt(rearTop)}${upper}A${N(fr)} ${N(fr)} 0 0 1 ${pt([fc + fr, BOT])}Z`;
  const tires = [wheel(rc), wheel(fc)];
  const band = line([wall, BELT], [glass, BELT]);
  const post = line([8.75, ROOF], [8.75, BELT]);
  add('car-classic', ['auto clásico', 'antiguo', 'de colección', 'classic car', 'vintage', 'oldtimer'], [body, ...tires, band, post], {
    fill: { solid: [body, ...tires.map(shut)], cut: [inset([wall, BELT], [glass, BELT], 1.75, 0), line([8.75, BELT], [8.75, ROOF + 2.25])] },
    parts: { body: [0], wheels: [1, 2], windows: [3, 4] },
  });
}
// The limousine: a long low body with the wheels at its ends and four windows in a row
addSide('limousine', ['limusina', 'chofer', 'traslado de lujo', 'limousine', 'limo', 'chauffeur'], {
  pts: [
    [2.25, BOT],
    [2.25, BELT],
    [4.25, BELT],
    [6.5, 6.5],
    [15.5, 6.5],
    [18, BELT],
    [21.75, 11.25],
    [21.75, BOT],
  ],
  r: [1, 1.25, 0, 1.25, 1.25, 0, 1.75, 1],
  belt: [4.25, 18],
  pillars: [8.25, 11.25, 14.25],
  roof: 6.5,
  wheels: [5.75, 18.25],
});
// The minivan: one box, the windshield running down into the hood in a single slope under a long
// tall roof. (The sliding door's rail as a stripe along the body read as a train's livery.)
{
  const pts = [
    [2.5, BOT],
    [2.75, 5.25],
    [12.5, 5.25],
    [21.25, 11.75],
    [21.5, BOT],
  ];
  addSide('minivan', ['minivan', 'monovolumen', 'familiar de siete plazas', 'people carrier', 'mpv', 'family van'], {
    pts,
    r: [1, 2, 2.5, 1.25, 1],
    belt: [atY(pts[0], pts[1], BELT), atY(pts[2], pts[3], BELT)],
    pillars: [7.25, 11.25],
    roof: 5.25,
  });
}
// The pickup: the cab with one window, and the open bed behind it at the height of the belt
addSide('pickup-truck', ['camioneta pickup', 'caja abierta', 'carga', 'pickup truck', 'pickup', 'hauling'], {
  pts: [
    [2.5, BOT],
    [2.5, BELT],
    [10, BELT],
    [10, ROOF],
    [14.25, ROOF],
    [17.75, BELT],
    [21.5, 11.25],
    [21.5, BOT],
  ],
  r: [1, 0.75, 0, 1.25, 1.5, 0, 2, 1],
  belt: [10, 17.75],
});
// The patrol car: the side car with its light bar standing on the flat of the roof and a stripe
// along its doors, from the tail to the nose. (Two domes on the roof read as a bumpy roof.)
{
  const bar = roundline(
    [
      [9.5, ROOF],
      [9.5, 3],
      [13.25, 3],
      [13.25, ROOF],
    ],
    [0, 0.75, 0.75, 0],
  );
  addSide('police-car', ['patrulla', 'policía', 'emergencia', 'police car', 'patrol', 'cop car'], {
    ...SIDE,
    pillars: [11.25],
    extra: [
      { d: bar, as: 'solid', name: 'lights' },
      { d: line([2.5, 13.5], [21.5, 13.5]), as: 'cut', name: 'stripe' },
    ],
  });
}
// A door open: the car from above, as on a dashboard, with its right front door swung out from its
// hinge at the foot of the windshield's pillar
const DOOR = line([17.75, 7.5], [21.5, 10.75]);
add('car-door-open', ['puerta abierta', 'puerta mal cerrada', 'listo para abordar', 'door open', 'door ajar', 'unlocked'], [TOP.body, TOP.roof, ...TOP.pillars, DOOR], {
  fill: { solid: [TOP.body], cut: [TOP.roof, ...TOP.pillars], wire: [DOOR] },
  parts: { body: [0], roof: [1], pillars: [2, 3, 4, 5], door: [6] },
});
// The trunk open: the sedan with its trunk lid lifted on its hinge at the foot of the rear window,
// as car-hood-open lifts the hood (car-side's fastback has no lid to lift: raised from its roof, the
// tailgate read as an antenna); the body stays open between the tail and the hinge
{
  const [A, , C, D, E, F, G, H] = SEDAN.pts;
  const body = roundline([C, D, E, F, G, H, A, [2.5, 12.25]], [0, 1.5, 1.5, 0, 2, 1, 1, 0]);
  const lid = line(C, plus(C, scale([-Math.cos((55 * Math.PI) / 180), -Math.sin((55 * Math.PI) / 180)], 4.75)));
  const tires = [wheel(XR), wheel(XF)];
  const band = line(C, F);
  const post = line([11.75, ROOF], [11.75, BELT]);
  add('car-trunk-open', ['maletero abierto', 'cajuela abierta', 'equipaje', 'trunk open', 'tailgate', 'boot open'], [body, ...tires, band, post, lid], {
    fill: { solid: [shut(body), ...tires.map(shut)], cut: [inset(C, F, 0, 1.75), line([11.75, BELT], [11.75, ROOF + 2.25])], wire: [lid] },
    parts: { body: [0], wheels: [1, 2], windows: [3, 4], lid: [5] },
  });
}
// The hood open: the side car with its hood lifted at the front, hinged at the windshield
{
  const [A, B, C, D, E, , G] = SIDE.pts;
  const body = roundline([E, D, C, B, A, G, [21.5, 12.25]], [0, 1.5, 1.5, 1.25, 1, 1, 0]);
  const lid = line(E, plus(E, scale([0.94, -0.34], 4.25)));
  const tires = [wheel(XR), wheel(XF)];
  const band = line([SIDE.belt[0], BELT], E);
  const post = line([11.25, ROOF], [11.25, BELT]);
  add('car-hood-open', ['cofre abierto', 'capó abierto', 'revisar motor', 'hood open', 'bonnet', 'frunk'], [body, ...tires, band, post, lid], {
    fill: { solid: [shut(body), ...tires.map(shut)], cut: [inset([SIDE.belt[0], BELT], E, 1.75, 1.75), line([11.25, BELT], [11.25, ROOF + 2.25])], wire: [lid] },
    parts: { body: [0], wheels: [1, 2], windows: [3, 4], lid: [5] },
  });
}

// ── The front car with a piece ──
// Lugares's car as drawn there, with the engine's badges or a piece of its own cut out of it.
const CAR = lugares.icons.car.d;
// With a piece at the lower right, the cut under the cabin stops at 14: run to 17.25, it pinched
// the cabin's right foot off the body at light weights, between its end and the piece's clearance.
const CAR_FILL = { ...lugares.icons.car.fill, cut: [line([6.75, 10.25], [14, 10.25]), ...lugares.icons.car.fill.cut.slice(1)] };
const CAR_PARTS = { body: [0], cabin: [1], wheels: [2, 3], lights: [4, 5] };
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** A closed outline around an open stroke, so the engine clears around it. */
const trace = (d) => `${d}Z`;
/** A bolt as one zigzag stroke (archivos's cloud-bolt): top right, a step across, bottom left. */
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
/** A fuel drop: a circle and the two tangents up to its point, `k` radii above the center. */
function droplet(cx, cy, r, k = 1.9) {
  const tip = [cx, cy - r * k];
  const a = deg(Math.acos(1 / k));
  return `M${pt(tip)}L${pt(polar(cx, cy, r, -90 + a))}A${N(r)} ${N(r)} 0 1 1 ${pt(polar(cx, cy, r, -90 - a))}Z`;
}
/** Lugares's pin: the logomark's drop turned 45°, its square corner pointing at the ground. */
function pin([cx, cy], r) {
  return `M${pt(polar(cx, cy, r, 45))}A${N(r)} ${N(r)} 0 1 0 ${pt(polar(cx, cy, r, 135))}L${pt([cx, cy + r * Math.SQRT2])}Z`;
}
/** The front car scaled by k and moved by (tx, ty); its lights stay dots of the set's size. */
function carAt(k, tx, ty) {
  const d = CAR.slice(0, 4).map((p) => transform(p, k, tx, ty));
  const lights = [dot(6.75 * k + tx, 14 * k + ty), dot(17.25 * k + tx, 14 * k + ty)];
  const fill = { solid: [d[0], ...d.slice(1).map(shut)], cut: [line([6.75 * k + tx, 10.25 * k + ty], [17.25 * k + tx, 10.25 * k + ty]), ...lights] };
  return { d: [...d, ...lights], fill, roof: 5.25 * k + ty };
}
const addCar = (name, tags, extra) => add(name, tags, CAR, { fill: CAR_FILL, parts: CAR_PARTS, ...extra });

// Electric: a bolt standing over the cabin's right shoulder, cut out of it
addCar('car-electric', ['auto eléctrico', 'vehículo eléctrico', 'cero emisiones', 'electric car', 'ev', 'zero emission'], {
  badge: (() => {
    const b = zigBolt(19.5, 1.75, 3.5, 6.5);
    return own([b], trace(b));
  })(),
});
// Hybrid: a fuel drop over the left shoulder and the bolt over the right one
addCar('car-hybrid', ['auto híbrido', 'gasolina y eléctrico', 'tipo de combustible', 'hybrid car', 'hybrid', 'fuel type'], {
  badge: (() => {
    const drop = droplet(5.75, 6.25, 2, 2);
    const b = zigBolt(19.5, 1.75, 3.5, 6.5);
    return own([drop, b], `${drop}${trace(b)}`, { solid: [drop], wire: [b] });
  })(),
});
// Connected: the car at 0.8, low, with two signal arcs rising from its roof
{
  const C = carAt(0.8, 2.4, 4.15);
  const waves = [3.5, 6.5].map((r) => arc(12, C.roof, r, -125, -55).d);
  add('car-connected', ['auto conectado', 'telemática', 'acceso remoto', 'connected car', 'telematics', 'remote access'], [...C.d, ...waves], {
    fill: { ...C.fill, lines: waves },
    parts: { ...CAR_PARTS, wave: [6, 7] },
  });
}
// The alarm: the car at 0.75 between two sound waves, one on each side
{
  const C = carAt(0.75, 3, 3.25);
  const waves = [arc(12, 12.75, 10.15, 162, 198).d, arc(12, 12.75, 10.15, -18, 18).d];
  add('car-alarm', ['alarma del auto', 'alarma activada', 'seguridad', 'car alarm', 'alarm', 'anti-theft'], [...C.d, ...waves], {
    fill: { ...C.fill, lines: waves },
    parts: { ...CAR_PARTS, wave: [6, 7] },
  });
}
// Location: a map pin standing over the cabin's right shoulder, cut out of it, as truck-location;
// small, it carries no dot (at r 2.75 its dot met its outline at bold)
addCar('car-location', ['ubicación del auto', 'encontrar mi auto', 'rastreo', 'car location', 'find my car', 'vehicle tracking'], {
  badge: (() => {
    const p = pin([18.25, 4.6], 2.6);
    return own([p], p, { solid: [p] });
  })(),
});
// Unlock: the engine's padlock with its shackle lifted out of the body
addCar('car-unlock', ['abrir auto', 'desbloquear', 'acceso sin llave', 'unlock car', 'keyless entry', 'car sharing'], {
  badge: (() => {
    const body = sq(13.5, 16.25, 7.5, 5.5, 1.6, SQ);
    const shackle = 'M15.1 16.25V12.75A2.15 2.15 0 0 1 19.4 12.75V13.5';
    return own([body, shackle], sq(13.5, 10.6, 7.5, 11.15, 2.4, SQ), { solid: [body], wire: [shackle] });
  })(),
});
// Remote start: a power symbol (the ring open at the top and its stroke) in the badge's place
addCar('car-remote-start', ['encendido remoto', 'arrancar desde la app', 'climatizar', 'remote start', 'engine start', 'pre-condition'], {
  badge: (() => {
    const c = [17.25, 17.75];
    const ring = arc(...c, 3.25, -35, 215).d;
    const stroke = line([17.25, 13], [17.25, 17]);
    return own([ring, stroke], `${circ(...c, 3.25)}${trace(stroke)}`);
  })(),
});
// Rental: bienes-raices's key at badge size
addCar('car-rental', ['renta de autos', 'alquiler', 'mostrador de renta', 'car rental', 'car hire', 'rent a car'], { badge: bienesRaices.icons['room-rental'].badge });
// For sale: a price tag hanging at 45° in the badge's place, its point up and left, with its eyelet
addCar('car-sale', ['auto en venta', 'agencia', 'seminuevos', 'car for sale', 'dealer', 'used cars'], {
  badge: (() => {
    const c = [17.25, 17.25];
    const [hw, nose, len0] = [2.75, 2.25, 8.25];
    const local = [
      [0, -len0 / 2],
      [hw, -len0 / 2 + nose],
      [hw, len0 / 2],
      [-hw, len0 / 2],
      [-hw, -len0 / 2 + nose],
    ];
    const P = local.map(([x, y]) => rot([c[0] + x, c[1] + y], c, -45));
    const tag = roundpoly(P, [0.75, 0.75, 1.25, 1.25, 0.75]);
    const eye = dot(...rot([c[0], c[1] - len0 / 2 + 3.4], c, -45));
    return own([tag, eye], tag, { solid: [tag], cut: [eye] });
  })(),
});
addCar('car-plus', ['agregar vehículo', 'nuevo auto', 'registrar auto', 'add vehicle', 'add car', 'new car'], { badge: badge('plus') });
addCar('car-check', ['vehículo verificado', 'auto disponible', 'inspección aprobada', 'vehicle verified', 'car ready', 'inspection passed'], { badge: badge('check') });
addCar('car-alert', ['falla del auto', 'revisión', 'llamado a revisión', 'vehicle issue', 'recall', 'service warning'], { badge: badge('alert') });
addCar('car-clock', ['tiempo de renta', 'hora de entrega', 'servicio pendiente', 'rental period', 'pick-up time', 'service due'], { badge: badge('clock') });
// The padlock clears a taller area than a disc: the cut under the cabin stops at 11
addCar('car-lock', ['auto cerrado', 'bloquear auto', 'vehículo seguro', 'car locked', 'lock car', 'secured vehicle'], {
  badge: badge('lock'),
  fill: { ...CAR_FILL, cut: [line([6.75, 10.25], [11, 10.25]), ...CAR_FILL.cut.slice(1)] },
});
addCar('car-search', ['buscar auto', 'inventario', 'buscador de autos', 'find a car', 'car search', 'inventory'], { badge: badge('search') });

// ── The side car in situations ──
/** The side car's strokes, scaled by k and moved by (tx, ty) (and its fill and parts). */
function sideAt(spec, k, tx, ty) {
  const S = side(spec);
  const T = (d) => transform(d, k, tx, ty);
  return { d: S.d.map(T), fill: Object.fromEntries(Object.entries(S.fill).map(([key, v]) => [key, v.map(T)])), parts: S.parts, at: ([x, y]) => [x * k + tx, y * k + ty] };
}
const CAR_SIDE = { ...SIDE, pillars: [11.25] };
/** A vertical wisp of smoke: half waves `h` tall bulging `a` to each side, from `y0` up to `y1`. */
function wisp(x, y0, y1, h = 2.5, a = 0.75) {
  let d = `M${pt([x, y0])}`;
  for (let y = y0, i = 0; y > y1 + 0.01; y -= h, i++) {
    const s = i % 2 ? -a : a;
    d += `C${pt([x + s, y - h / 3])} ${pt([x + s, y - (2 * h) / 3])} ${pt([x, y - h])}`;
  }
  return d;
}
// Broken down: the side car at 0.8, back and low, with two wisps of smoke rising from its hood
{
  const S = sideAt(CAR_SIDE, 0.8, 0.25, 4.45);
  const smoke = [wisp(16.75, 10, 2.5), wisp(20.25, 10, 2.5)];
  add('car-breakdown', ['auto descompuesto', 'avería', 'asistencia vial', 'car breakdown', 'roadside assistance', 'broken down'], [...S.d, ...smoke], {
    fill: { ...S.fill, lines: smoke },
    parts: { ...S.parts, smoke: [5, 6] },
  });
}
// Crash: the side car at 0.78 with its nose crumpled into a zigzag and three impact strokes ahead
{
  const pts = [
    [2.5, BOT],
    [2.5, 12],
    [8.25, ROOF],
    [14.5, ROOF],
    [18, BELT],
    [21, 11.5],
    [19.75, 12.9],
    [21.25, 14.25],
    [19.75, 15.5],
    [21, BOT],
  ];
  const S = sideAt({ ...CAR_SIDE, pts, r: [1, 1.25, 1.5, 1.5, 0, 0.75, 0.4, 0.4, 0.4, 0.75] }, 0.78, 0.3, 4.85);
  const hits = [line([19.75, 9.5], [21.5, 7.75]), line([20, 13.75], [22.25, 13.75]), line([19.75, 18], [21.5, 19.75])];
  add('car-crash', ['choque', 'accidente', 'siniestro', 'car crash', 'collision', 'accident'], [...S.d, ...hits], {
    fill: { ...S.fill, lines: hits },
    parts: { ...S.parts, impact: [5, 6, 7] },
  });
}
// Damage: the side car with a crack running down the front door from the belt to the sill
{
  const S = side(CAR_SIDE);
  const crack = roundline(
    [
      [14.5, BELT],
      [13.25, 12.25],
      [15, 13.75],
      [13.75, 15],
      [14.75, BOT],
    ],
    0.3,
  );
  add('car-damage', ['daño', 'golpe', 'reporte de daños', 'car damage', 'dent', 'damage report'], [...S.d, crack], {
    fill: { ...S.fill, cut: [...S.fill.cut, crack] },
    parts: { ...S.parts, crack: [5] },
  });
}
// Towed: the side car at 0.75 tilted nose up on its rear wheel, its bumper caught by a hook at the
// end of a line from above. (The line alone, run to its nose, read as a pole it leaned on.)
{
  const S = sideAt(CAR_SIDE, 0.75, 1.5, 4.5);
  const pivot = S.at([XR, WY + WR]);
  const tilt = (d) => turnPath(d, -18, pivot);
  const T = (q) => rot(S.at(q), pivot, -18);
  // The hook's tip rests under the bumper, 1.25 behind its front corner; its bowl swings round in
  // front of the nose, 2.9 clear of it, and the line rises from there
  const tip = T([19.75, BOT]);
  const front = Math.max(T([21.5, 11.25])[0], T([21.5, BOT])[0]);
  const r = (front + 2.9 - tip[0]) / 2;
  const x = tip[0] + 2 * r;
  const hook = `M${N(x)} 1.75V${N(tip[1])}A${N(r)} ${N(r)} 0 0 1 ${pt(tip)}`;
  add('car-towed', ['grúa', 'auto remolcado', 'corralón', 'car towed', 'impounded', 'tow away'], [...S.d.map(tilt), hook], {
    fill: { ...Object.fromEntries(Object.entries(S.fill).map(([key, v]) => [key, v.map(tilt)])), wire: [hook] },
    parts: { ...S.parts, hook: [5] },
  });
}
// Charging: the side car at 0.7, low and to the right, and a plug (its body and two prongs) up at
// the left, its cable running down and into the car's rear flank. (A cable curling down to a plug's
// head on the ground read as a tail.)
{
  const k = 0.7;
  const S = sideAt(CAR_SIDE, k, 21.75 - 21.5 * k, 21 - (WY + WR) * k);
  const port = S.at([2.5, 14]);
  const plug = sq(2.25, 7.25, 5, 4, 1.25);
  const prongs = `M3.25 7.25V5M6.25 7.25V5`;
  const cable = roundline([[4.75, 11.25], [4.75, port[1]], port], [0, 1.5, 0]);
  add('car-charging', ['cargando', 'carga eléctrica', 'sesión de carga', 'car charging', 'ev charging', 'charge status'], [...S.d, plug, prongs, cable], {
    fill: { ...S.fill, solid: [...S.fill.solid, plug], wire: [prongs, cable] },
    parts: { ...S.parts, plug: [5, 6], cable: [7] },
  });
}
// Fast: the side car at 0.75, to the right, with two speed lines behind it, as truck-fast
{
  const S = sideAt(CAR_SIDE, 0.75, 5.875, 5.44);
  const speed = [line([2.5, 10.75], [6.75, 10.75]), line([2, 14], [4.25, 14])];
  add('car-fast', ['viaje rápido', 'servicio exprés', 'recogida rápida', 'fast ride', 'express', 'quick pickup'], [...S.d, ...speed], {
    fill: { ...S.fill, lines: speed },
    parts: { ...S.parts, speed: [5, 6] },
  });
}
// Roof box: the side car at 0.85, low, with a long cargo box on its roof bars (two short posts
// standing on the flat of the roof, 3 long so the box clears the roof). (Lying on the roof, as short
// as it, it read as a taxi's sign; on a wagon's long roof, it merged into a van's.)
{
  const k = 0.85;
  const S = sideAt(CAR_SIDE, k, 12 - 12 * k, 21.25 - (WY + WR) * k);
  const roof = S.at([0, ROOF])[1];
  const box = capsule(6.5, 3.25, 11, 3);
  const posts = `M10 6.25V${N(roof)}M14 6.25V${N(roof)}`;
  add('car-roof-box', ['portaequipaje', 'caja de techo', 'equipaje extra', 'roof box', 'cargo box', 'roof carrier'], [...S.d, posts, box], {
    fill: { ...S.fill, solid: [...S.fill.solid, box], wire: [posts] },
    parts: { ...S.parts, rack: [5], box: [6] },
  });
}
// Flood: the side car sunk to its axles behind two lines of water; the water clears what is under it
{
  const S = side(CAR_SIDE);
  const wave = (y) => {
    const w = 20.5 / 7;
    let d = `M${pt([1.75, y])}`;
    for (let i = 0; i < 7; i++) {
      const [x, s] = [1.75 + i * w, i % 2 ? 1.2 : -1.2];
      d += `C${pt([x + w / 3, y + s])} ${pt([x + (2 * w) / 3, y + s])} ${pt([x + w, y])}`;
    }
    return d;
  };
  const water = [wave(16.75), wave(20)];
  add('car-flood', ['inundación', 'auto inundado', 'daño por agua', 'car flood', 'flooded road', 'water damage'], S.d, {
    fill: S.fill,
    parts: S.parts,
    badge: own(water, `${water[0]}L22.25 22.25L1.75 22.25Z`),
  });
}
// Fire: the side car with a flame of two tongues rising over its hood, cut out of it
{
  const S = side(CAR_SIDE);
  const flame = transform('M15.5 8.75C15.5 6.25 17.25 4.75 17.5 1.75C18.75 3 19.5 4.5 19.5 5.75C20 5.25 20.5 4.5 20.75 3.75C21.5 5.25 21.75 6.75 21.75 8.75A3.125 3.125 0 0 1 15.5 8.75Z', 1, -0.6, 0);
  add('car-fire', ['auto en llamas', 'incendio', 'siniestro', 'car fire', 'vehicle fire', 'burning car'], S.d, {
    fill: S.fill,
    parts: S.parts,
    badge: own([flame], flame, { solid: [flame] }),
  });
}

// ── Vans ──
// The van: the side car's construction under one long box, its roof 4.5, a short sloping nose, the
// window of the front door and the sliding door's seam behind it
const vanBody = (roof = 4.5, tail = 2.5) => ({
  pts: [
    [tail, BOT],
    [tail, roof],
    [15.5, roof],
    [19.75, BELT],
    [21.5, 11.25],
    [21.5, BOT],
  ],
  r: [1, 2, 1.75, 0, 1.5, 1],
});
const VAN = { ...vanBody(), belt: [14.25, 19.75], pillars: [14.25], roof: 4.5 };
const seamDoor = (roof = 4.5) => ({ d: line([10.5, roof + 3], [10.5, BOT]), fillD: line([10.5, roof + 3], [10.5, BOT - 1.5]), as: 'cut', name: 'door' });
addSide('van', ['camioneta', 'furgoneta', 'van de carga', 'van', 'cargo van', 'panel van'], { ...VAN, extra: [seamDoor()] });
// The passenger van: a row of windows from the tail to the front door
addSide('van-passenger', ['van de pasajeros', 'traslado grupal', 'shuttle', 'passenger van', 'minibus', 'group transfer'], { ...VAN, belt: [2.5, 19.75], pillars: [6.5, 10.5, 14.25] });
// The camper: the van with its pop-up roof raised as a wedge, hinged at the front
{
  const roof = 5.75;
  const wedge = roundline(
    [
      [13.75, roof],
      [4.25, 2],
      [4.25, roof],
    ],
    [0, 0.75, 0],
  );
  addSide('van-camper', ['camper', 'casa rodante', 'viaje por carretera', 'camper van', 'campervan', 'road trip'], { ...vanBody(roof), belt: [14.25, 19.75], pillars: [14.25], roof, extra: [seamDoor(roof), { d: wedge, as: 'solid', name: 'roof' }] });
}
// The van head-on: the front car's body, lights and tires under a tall, upright cabin
add('van-front', ['van de frente', 'clase de vehículo', 'caseta', 'van front', 'vehicle class', 'toll'], [CAR[0], roundline([[4, 10.25], [5, 3], [19, 3], [20, 10.25]], [0, 1.75, 1.75, 0]), ...CAR.slice(2)], {
  fill: { solid: [CAR[0], shut(roundline([[4, 10.25], [5, 3], [19, 3], [20, 10.25]], [0, 1.75, 1.75, 0])), ...CAR.slice(2, 4).map(shut)], cut: [line([6.25, 10.25], [17.75, 10.25]), CAR[4], CAR[5]] },
  parts: CAR_PARTS,
});

// ── Trucks ──
// Comercio's truck: its cargo box, its cab and its wheels (r 1.75, 3 under the body). Every truck
// has that cab; without the box behind it, the cab closes on its own back wall.
const TRUCK = comercio.icons.truck.d;
const TRUCK_FILL = { solid: [TRUCK[0], shut(TRUCK[1]), TRUCK[2], TRUCK[3]], cut: ['M14.5 7.5V14'] };
const cabAt = (dx = 0) =>
  roundpoly(
    [
      [14.5 + dx, 14],
      [14.5 + dx, 7.5],
      [17.6 + dx, 7.5],
      [21.5 + dx, 11.25],
      [21.5 + dx, 14],
    ],
    [0, 1, 1.25, 1.5, 0],
  );
const CAB = cabAt();
const tw = (x) => circ(x, 18.75, 1.75);
/** A truck: its body's strokes, then the cab and the wheels; `solid` and the rest of its fill. */
const addTruck = (name, tags, body, { wheels = [7, 17.75], cab = CAB, fill = {}, parts = {} } = {}) => {
  const W = wheels.map(tw);
  const d = [...body, cab, ...W];
  const n = body.length;
  add(name, tags, d, {
    fill: { ...fill, solid: [...(fill.solid ?? []), shut(cab), ...W] },
    parts: { cab: [n], wheels: W.map((_, i) => n + 1 + i), ...parts },
  });
};
// The tractor-trailer: the trailer at the left, taller than the cab, coupled to it, a wheel under each
{
  const trailer = sq(2.25, 4, 9.25, 10, 2, SQ);
  const hitch = line([11.5, 14], [14.5, 14]);
  addTruck('semi-truck', ['tráiler', 'tractocamión', 'carga de largo recorrido', 'semi truck', 'tractor trailer', 'big rig'], [trailer, hitch], {
    wheels: [5.5, 12.75, 19.25],
    fill: { solid: [trailer], wire: [hitch] },
    parts: { trailer: [0], hitch: [1] },
  });
}
// The tractor alone: the cab with its sleeper standing taller behind it and the bare chassis
// reaching back over the rear axle. (The fifth wheel as a half disc on it read as a bump.)
{
  const tractor = roundpoly(
    [
      [10.75, 14],
      [10.75, 5],
      [14.5, 5],
      [14.5, 7.5],
      [17.6, 7.5],
      [21.5, 11.25],
      [21.5, 14],
    ],
    [0, 1.25, 0.75, 0, 1.25, 1.5, 0],
  );
  const chassis = line([2.75, 14], [10.75, 14]);
  add('truck-cab', ['tractocamión', 'cabina', 'transportista', 'truck cab', 'tractor unit', 'bobtail'], [tractor, chassis, tw(7), tw(17.75)], {
    fill: { solid: [tractor, tw(7), tw(17.75)], wire: [chassis] },
    parts: { cab: [0], chassis: [1], wheels: [2, 3] },
  });
}
// The flatbed: a flat deck behind the cab with a stake standing at each end
{
  const deck = roundline(
    [
      [14.5, 11],
      [2.5, 11],
      [2.5, 14],
      [14.5, 14],
    ],
    [0, 0.75, 0.75, 0],
  );
  const stakes = [line([3.75, 11], [3.75, 8]), line([11.5, 11], [11.5, 8])];
  addTruck('flatbed-truck', ['camión plataforma', 'plataforma', 'carga sobredimensionada', 'flatbed truck', 'flatbed', 'oversized load'], [deck, ...stakes], {
    fill: { solid: [shut(deck)], wire: stakes },
    parts: { deck: [0], stakes: [1, 2] },
  });
}
// The dump truck: its bed tipped up on the hinge at the back of the chassis
{
  const hinge = [3, 14];
  const bed = roundpoly(
    [
      [3, 14],
      [12.75, 14],
      [13.25, 9],
      [4, 9],
    ].map((q) => rot(q, hinge, -22)),
    [0.5, 0.75, 1, 1],
  );
  const chassis = line(hinge, [14.5, 14]);
  addTruck('dump-truck', ['volteo', 'camión de volteo', 'material', 'dump truck', 'tipper', 'earthworks'], [bed, chassis], {
    fill: { solid: [bed, roundpoly([hinge, [7.5, 14], rot([7.5, 14], hinge, -22)], 0.25)], wire: [chassis] },
    parts: { bed: [0], chassis: [1] },
  });
}
// The tow truck: a short body behind the cab and, from its back, a short boom rising to the rear
// with the hook hanging low on its line, ready to lift a car (a hook high on a long boom is the
// crane's)
{
  const body = roundline(
    [
      [14.5, 10.5],
      [7.75, 10.5],
      [7.75, 14],
      [14.5, 14],
    ],
    [0, 0.75, 0.75, 0],
  );
  const boom = `${roundline(
    [
      [10.25, 10.5],
      [4.75, 5.25],
      [4.75, 12.25],
    ],
    [0, 0.75, 0],
  )}A1.25 1.25 0 0 1 2.25 12.25`;
  addTruck('tow-truck', ['grúa', 'auxilio vial', 'remolque', 'tow truck', 'wrecker', 'recovery'], [body, boom], {
    fill: { solid: [shut(body)], wire: [boom] },
    parts: { body: [0], boom: [1] },
  });
}
// The garbage truck: a body rounded over the top, the hopper at its back sloping down and in to the
// chassis, and the seam of the tailgate
{
  const body = roundpoly(
    [
      [5.25, 14],
      [2.5, 10.25],
      [2.5, 4],
      [14.5, 4],
      [14.5, 14],
    ],
    [0.5, 1, 3.5, 2.5, 0],
  );
  const seam = line([8, 4], [7.25, 14]);
  add('garbage-truck', ['camión de basura', 'recolección', 'servicios urbanos', 'garbage truck', 'refuse truck', 'waste collection'], [body, seam, TRUCK[1], tw(7), tw(17.75)], {
    fill: { solid: [body, shut(TRUCK[1]), tw(7), tw(17.75)], cut: [seam, 'M14.5 7.5V14'] },
    parts: { body: [0, 1], cab: [2], wheels: [3, 4] },
  });
}
// The tanker: a long tank with round ends lying on the chassis, its flat underside on it. (On two
// saddles, a small round tank read as a tree.)
{
  const tank = sq(2.5, 7.25, 9, 6.75, 3);
  const chassis = line([5.5, 14], [14.5, 14]);
  addTruck('tanker-truck', ['pipa', 'camión cisterna', 'combustible', 'tanker truck', 'tanker', 'fuel truck'], [tank, chassis], {
    fill: { solid: [tank], wire: [chassis] },
    parts: { tank: [0], chassis: [1] },
  });
}
// The mixer: the drum as a cone tilted up toward its mouth at the back, two stripes winding across
// it, on its stand over the chassis. (A drum as wide at both ends read as a ball.)
{
  const [R1, F1, F2, R2] = [
    [2.25, 4.25],
    [10, 6.25],
    [11.25, 11.25],
    [2.5, 8.25],
  ];
  // Its sharp lower front corner takes a small radius: a large one ran past the short front edge
  const drum = roundpoly([R1, F1, F2, R2], [1.25, 2, 1.25, 1.25]);
  const top = (t) => plus(R1, scale(sub(F1, R1), t));
  const bot = (t) => plus(R2, scale(sub(F2, R2), t));
  // The stripes' ends and the stand's foot stand 2.9 apart along the drum's edges
  const runs = [
    [0.25, 0.42],
    [0.62, 0.74],
  ];
  const stripes = runs.map(([a, b]) => line(top(a), bot(b)));
  const foot = bot(0.1);
  const stand = line(foot, [foot[0], 14]);
  const chassis = line([2.5, 14], [14.5, 14]);
  addTruck('cement-mixer', ['revolvedora', 'olla de concreto', 'concreto premezclado', 'cement mixer', 'concrete mixer', 'ready-mix'], [drum, ...stripes, stand, chassis], {
    fill: {
      solid: [drum],
      // The cuts stop 0.9 inside the drum at both ends
      cut: runs.map(([a, b]) => inset(top(a), bot(b), 0.9)),
      wire: [stand, chassis],
    },
    parts: { drum: [0, 1, 2], chassis: [3, 4] },
  });
}
// The mobile crane: the deck behind the cab with the crane's own cab standing on it, and the long
// boom raised from it to the upper rear, its hook hanging high from the tip. (A boom straight off
// the deck read as the tow truck's.)
{
  const deck = roundline(
    [
      [14.5, 11],
      [2.5, 11],
      [2.5, 14],
      [14.5, 14],
    ],
    [0, 0.75, 0.75, 0],
  );
  const house = roundline(
    [
      [8.5, 11],
      [8.5, 7.5],
      [12.25, 7.5],
      [12.25, 11],
    ],
    [0, 0.75, 0.75, 0],
  );
  const boom = `${roundline(
    [
      [10.25, 7.5],
      [4, 2],
      [4, 6.5],
    ],
    [0, 0.5, 0],
  )}A1 1 0 0 1 2 6.5`;
  addTruck('crane-truck', ['grúa móvil', 'pluma telescópica', 'izaje', 'crane truck', 'mobile crane', 'lifting'], [deck, house, boom], {
    fill: { solid: [shut(deck), shut(house)], wire: [boom] },
    parts: { deck: [0], house: [1], boom: [2] },
  });
}
// The car carrier: the lower deck on the chassis and the upper deck sloping up over the cab, two
// posts between them
{
  const lower = line([2.5, 14], [14.5, 14]);
  const upper = line([2.5, 10.5], [16.5, 4]);
  const yAt = (x) => 10.5 - ((x - 2.5) * 6.5) / 14;
  const posts = [line([5.5, 14], [5.5, yAt(5.5)]), line([10.75, 14], [10.75, yAt(10.75)])];
  addTruck('car-carrier', ['madrina', 'portavehículos', 'traslado de autos', 'car carrier', 'car transporter', 'auto hauler'], [lower, upper, ...posts], {
    fill: { wire: [lower, upper, ...posts] },
    parts: { frame: [0, 1, 2, 3] },
  });
}
// The street sweeper: comercio's truck with limpieza's broom crossing its lower right, as
// truck-refrigerated carries its snowflake; its handle stops at 2.75 (at house-cleaning's length,
// its clearance cut a sliver off the cab's nose at light weights). (A round brush between the
// wheels read as a third axle.)
{
  const B = limpieza.icons['house-cleaning'].badge;
  const handle = line([18.78, 16.47], [20.73, 14.52]);
  add('street-sweeper', ['barredora', 'limpieza urbana', 'barrido de calles', 'street sweeper', 'road sweeper', 'street cleaning'], TRUCK, {
    // The seam stops 1 short of the broom's clearance (which reaches 11.3 on it at every weight)
    fill: { ...TRUCK_FILL, cut: ['M14.5 7.5V9.5'] },
    parts: { body: [0], cab: [1], wheels: [2, 3] },
    badge: own([handle, B.d[1], B.d[2]], B.knock.replace(B.d[0], handle), { solid: [B.d[1]], cut: [B.d[2]], wire: [handle] }),
  });
}
// The snowplow: a shorter truck with its curved blade ahead of the cab on a short arm
{
  const dx = -4.5;
  const box = sq(2.5, 4, 7.5, 10, 2.5, SQ);
  const cab = transform(TRUCK[1], 1, dx, 0);
  const blade = 'M19.75 9.75A10 10 0 0 0 21.75 20.25';
  const arm = line([17, 14], [20.2, 14]);
  addTruck('snowplow', ['quitanieves', 'barredora de nieve', 'carretera en invierno', 'snowplow', 'snow plough', 'road clearing'], [box, blade, arm], {
    wheels: [5.5, 13.5],
    cab,
    fill: { solid: [box], cut: [`M${N(14.5 + dx)} 7.5V14`], wire: [blade, arm] },
    parts: { body: [0], blade: [1, 2] },
  });
}
// The bucket truck: a deck behind the cab and an arm folded at its elbow, the basket at its tip
{
  const deck = roundline(
    [
      [14.5, 11],
      [2.5, 11],
      [2.5, 14],
      [14.5, 14],
    ],
    [0, 0.75, 0.75, 0],
  );
  const boom = roundline(
    [
      [11, 11],
      [4.5, 7],
      [10.5, 4.75],
    ],
    [0, 0.75, 0],
  );
  const basket = roundline(
    [
      [8.5, 1.75],
      [8.5, 4.75],
      [12.25, 4.75],
      [12.25, 1.75],
    ],
    [0, 0.75, 0.75, 0],
  );
  addTruck('bucket-truck', ['canastilla', 'grúa con canasta', 'cuadrilla', 'bucket truck', 'cherry picker', 'utility truck'], [deck, boom, basket], {
    fill: { solid: [shut(deck), shut(basket)], wire: [boom] },
    parts: { deck: [0], boom: [1], basket: [2] },
  });
}
// Refrigerated: comercio's truck with logistica's snowflake in the badge's place
add('truck-refrigerated', ['camión refrigerado', 'cadena de frío', 'termo', 'refrigerated truck', 'reefer', 'cold chain'], TRUCK, {
  fill: TRUCK_FILL,
  parts: { body: [0], cab: [1], wheels: [2, 3] },
  badge: logistica.icons['parcel-snowflake'].badge,
});
// Electric: comercio's truck with a bolt standing over its box, cut out of it, as car-electric
add('truck-electric', ['camión eléctrico', 'reparto sin emisiones', 'flotilla eléctrica', 'electric truck', 'ev truck', 'zero emission'], TRUCK, {
  fill: TRUCK_FILL,
  parts: { body: [0], cab: [1], wheels: [2, 3] },
  badge: (() => {
    const b = zigBolt(8.5, 1.75, 3.75, 8.5);
    return own([b], trace(b));
  })(),
});
// The armored truck: a heavy box with a slit window and a cab of sharp angles
{
  const box = sq(2.5, 4, 12, 10, 1.75, SQ);
  const slit = line([5.5, 7.5], [11.5, 7.5]);
  const cab = roundline(
    [
      [14.5, 7.5],
      [17.75, 7.5],
      [21.5, 11],
      [21.5, 14],
      [14.5, 14],
    ],
    [0, 0.5, 0.5, 0, 0],
  );
  add('armored-truck', ['camión blindado', 'traslado de valores', 'blindado', 'armored truck', 'cash in transit', 'security van'], [box, slit, cab, tw(7), tw(17.75)], {
    fill: { solid: [box, shut(cab), tw(7), tw(17.75)], cut: [slit, 'M14.5 7.5V14'] },
    parts: { body: [0, 1], cab: [2], wheels: [3, 4] },
  });
}
// The fire engine: a low body behind the cab with the ladder lying on it (its rail and three rungs)
{
  const body = sq(2.5, 10, 12, 4, 1.5, SQ);
  const rail = line([2.5, 7], [11.5, 7]);
  const rungs = [4, 7.75, 11.5].map((x) => line([x, 7], [x, 10]));
  add('fire-truck', ['camión de bomberos', 'bomberos', 'emergencia', 'fire truck', 'fire engine', 'firefighters'], [body, rail, ...rungs, TRUCK[1], tw(7), tw(17.75)], {
    fill: { solid: [body, shut(TRUCK[1]), tw(7), tw(17.75)], wire: [rail, ...rungs], cut: ['M14.5 10V14'] },
    parts: { body: [0], ladder: [1, 2, 3, 4], cab: [5], wheels: [6, 7] },
  });
}

// ── Construction machines ──
// One track (a rounded slab) and one cab (5 wide, its front window raked at the top) for every
// machine. A machine's body is one silhouette with its cab in it; its wheels hang from its sill as the
// side car's do.
const TRACK = capsule(2.75, 16.25, 13, 4.5);
/** The cab's outline from its rear foot up and over to its front foot, for a body's polygon. */
const cabPts = (x0, base, top) => [
  [x0, base],
  [x0, top],
  [x0 + 3.5, top],
  [x0 + 5, top + 1.75],
  [x0 + 5, base],
];
const CAB_R = [0, 1, 0.75, 0.75, 0];
/** A tire hanging from a sill, as on the side car, with its own radius and center. */
const hang = (x, y, r, bot) => wheel(x, { r, y, bot });
// The excavator: the house on the track with the cab on it, the boom and the stick folded at the top
// and the bucket at the stick's end
{
  const house = roundline(
    [
      [4.25, 16.25],
      [4.25, 12.25],
      ...cabPts(7.5, 12.25, 7.25),
      [14, 12.25],
      [14, 16.25],
    ],
    [0, 1, 0, ...CAB_R.slice(1, 4), 0, 0.75, 0],
  );
  const arm = roundline(
    [
      [14, 14],
      [18.25, 4.25],
      [20.5, 11.55],
    ],
    [0, 1.25, 0],
  );
  const bucket = roundpoly(
    [
      [19.5, 11],
      [22.25, 12.5],
      [21.25, 15.75],
      [18.5, 15],
    ],
    [0.5, 1, 0.5, 1],
  );
  add('excavator', ['excavadora', 'retroexcavadora de orugas', 'obra', 'excavator', 'digger', 'earthworks'], [TRACK, house, arm, bucket], {
    fill: { solid: [TRACK, shut(house), bucket], wire: [arm] },
    parts: { track: [0], body: [1], arm: [2], bucket: [3] },
  });
}
// The bulldozer: the cab at the back of the body on the track, and the tall curved blade ahead of
// it on its push arm
{
  const body = roundline([...cabPts(4.25, 16.25, 7.25).slice(0, 4), [9.25, 11.5], [14, 11.5], [14, 16.25]], [0, 1, 0.75, 0.75, 0, 0.75, 0]);
  const blade = 'M20.25 9.25A7.5 7.5 0 0 0 20.25 20.75';
  const push = line([14, 14], [17.64, 14]);
  add('bulldozer', ['buldócer', 'tractor de orugas', 'nivelación', 'bulldozer', 'dozer', 'grading'], [TRACK, body, blade, push], {
    fill: { solid: [TRACK, shut(body)], wire: [blade, push] },
    parts: { track: [0], body: [1], blade: [2, 3] },
  });
}
// The wheel loader: the engine low at the back, the cab standing in the middle and the front frame
// ahead of it, on one sill, with two big tires hanging from it far apart (small tires close together
// under a cab at the back read as a pram), and the bucket ahead: its back, its sloping top and its
// flat floor, carried level on a short arm.
{
  const x0 = 2;
  const body = roundpoly(
    [
      [x0, 15.75],
      [x0, 10.75],
      ...cabPts(x0 + 3.75, 10.75, 4.75).slice(0, 4),
      [x0 + 8.75, 10.75],
      [x0 + 12.75, 10.75],
      [x0 + 12.75, 15.75],
    ],
    [0.75, 1, 0, 1, 0.75, 0.75, 0, 1, 0.75],
  );
  const tires = [hang(x0 + 2.75, 18.25, 2.75, 15.75), hang(x0 + 11.25, 18.25, 2.75, 15.75)];
  const lift = line([x0 + 12.75, 12.25], [18, 12.25]);
  const bucket = roundpoly(
    [
      [18, 8.25],
      [21.75, 11.75],
      [22.25, 15.25],
      [18, 15.25],
    ],
    [0.5, 1.5, 0.5, 1],
  );
  add('wheel-loader', ['cargador frontal', 'payloader', 'cantera', 'wheel loader', 'front loader', 'quarry'], [body, ...tires, lift, bucket], {
    fill: { solid: [body, ...tires.map(shut), bucket], wire: [lift] },
    parts: { body: [0], wheels: [1, 2], arm: [3], bucket: [4] },
  });
}
// The skid steer: a short body that is mostly its cab, two small wheels 2.9 apart, and the arm
// reaching forward from the back of the cab, over the hood and down to the bucket
{
  const body = roundpoly([[5.25, 17.25], ...cabPts(5.25, 17.25, 6.5).slice(1, 4), [10.25, 11.5], [16, 11.5], [16, 17.25]], [0.75, 1, 0.75, 0.75, 0, 0.75, 0.75]);
  const tires = [hang(7.75, 18.75, 1.75, 17.25), hang(14.15, 18.75, 1.75, 17.25)];
  const arm = roundline(
    [
      [5.25, 7.5],
      [17.25, 7.5],
      [19.75, 13],
    ],
    [0, 1.5, 0],
  );
  const scoop = roundpoly(
    [
      [19, 13],
      [21.75, 13],
      [22.25, 18.5],
      [18.75, 18.5],
    ],
    [0.5, 0.75, 0.75, 0.75],
  );
  add('skid-steer', ['minicargador', 'bobcat', 'renta de maquinaria', 'skid steer', 'compact loader', 'equipment rental'], [body, ...tires, arm, scoop], {
    fill: { solid: [body, ...tires.map(shut), scoop], wire: [arm] },
    parts: { body: [0], wheels: [1, 2], arm: [3], bucket: [4] },
  });
}
// The road roller: the cab over the rear wheel and the big drum ahead, held at its hub
{
  const body = roundpoly([[3, 16.5], ...cabPts(3, 16.5, 6.75).slice(1, 4), [8, 10.75], [9.25, 10.75], [9.25, 16.5]], [0.75, 1, 0.75, 0.75, 0, 0.75, 0.75]);
  const tire = hang(6, 18.25, 2.5, 16.5);
  const drum = circ(16.75, 16.25, 4.5);
  const hub = dot(16.75, 16.25);
  const yoke = line([9.25, 12.5], [16.75, 16.25]);
  add('road-roller', ['aplanadora', 'compactadora', 'pavimentación', 'road roller', 'compactor', 'paving'], [body, tire, drum, yoke, hub], {
    fill: { solid: [body, shut(tire), drum], wire: [yoke], cut: [hub] },
    parts: { body: [0], wheels: [1, 2], yoke: [3, 4] },
  });
}
// The scissor lift: the railed platform over one pair of crossed arms, on a base with two wheels
{
  const base = sq(4, 14.5, 16, 3.25, 1.25);
  const tires = [hang(7.25, 19, 1.75, 17.75), hang(16.75, 19, 1.75, 17.75)];
  const scissor = [line([6.5, 14.5], [17.5, 8]), line([6.5, 8], [17.5, 14.5])];
  const deck = line([4, 8], [20, 8]);
  const rail = roundline(
    [
      [5, 8],
      [5, 4.5],
      [19, 4.5],
      [19, 8],
    ],
    [0, 0.75, 0.75, 0],
  );
  add('scissor-lift', ['plataforma de tijera', 'elevador de tijera', 'trabajo en altura', 'scissor lift', 'aerial platform', 'work at height'], [base, ...tires, ...scissor, deck, rail], {
    fill: { solid: [base, ...tires.map(shut)], wire: [...scissor, deck, rail] },
    parts: { base: [0], wheels: [1, 2], scissor: [3, 4], platform: [5, 6] },
  });
}
// The boom lift: a low base on two wheels, the boom folded at its elbow up to the railed basket
{
  const base = sq(3.5, 14.75, 12.5, 3, 1.25);
  const tires = [hang(6.5, 19, 1.75, 17.75), hang(13, 19, 1.75, 17.75)];
  const boom = roundline(
    [
      [12, 14.75],
      [5.5, 9],
      [15.25, 6.25],
    ],
    [0, 1, 0],
  );
  const basket = roundline(
    [
      [14.5, 2],
      [14.5, 6.25],
      [20.25, 6.25],
      [20.25, 2],
    ],
    [0, 0.75, 0.75, 0],
  );
  add('boom-lift', ['plataforma articulada', 'brazo articulado', 'trabajo en altura', 'boom lift', 'cherry picker', 'aerial lift'], [base, ...tires, boom, basket], {
    fill: { solid: [base, ...tires.map(shut), shut(basket)], wire: [boom] },
    parts: { base: [0], wheels: [1, 2], boom: [3], basket: [4] },
  });
}

// ── Motorcycles ──
// The motorcycle from the side, facing right: wheels of r 3.25 (bottom 20) and one body (the tail,
// the seat, the tank and the engine) between and above them, 2.9 clear of both tires; the swingarm
// from its belly to the rear axle, the fork from the head to the front axle and the handlebar
// rising from the tank.
/** A motorcycle from its body's polygon, its wheels, its fork's ends and its handlebar. */
function moto({ body, r, wheels, swing, fork, bar, extra = [] }) {
  const B = roundpoly(body, r);
  const W = wheels.map(([x, rr]) => circ(x, 16.75, rr));
  const S = line([wheels[0][0], 16.75], swing);
  const F = line(fork, [wheels[1][0], 16.75]);
  const d = [...W, B, S, F, bar, ...extra];
  return { d, fill: { solid: [...W, B], wire: [S, F, bar, ...extra] }, parts: { wheels: [0, 1], body: [2], frame: [3, 4], handlebar: [5] } };
}
const MOTO = moto({
  body: [
    [2.5, 9.25],
    [8.5, 10],
    [10.25, 7.25],
    [14.75, 7.25],
    [15.75, 9.25],
    [13.5, 13.25],
    [10.5, 13.25],
    [8, 10.75],
    [3.25, 10.5],
  ],
  r: [0.5, 0.75, 1, 1, 0.75, 1, 1, 0.75, 0.5],
  wheels: [
    [5.25, 3.25],
    [18.75, 3.25],
  ],
  swing: [9.25, 12],
  fork: [15.25, 8.25],
  bar: roundline(
    [
      [14.75, 7.25],
      [13.75, 4],
      [16.5, 4],
    ],
    [0, 0.6, 0],
  ),
});
add('motorcycle', ['motocicleta', 'moto', 'renta de motos', 'motorcycle', 'motorbike', 'ride'], MOTO.d, { fill: MOTO.fill, parts: MOTO.parts });
// Electric: the motorcycle with the bolt standing over its tank, cut out of it, as car-electric
add('motorcycle-electric', ['moto eléctrica', 'motocicleta eléctrica', 'cero emisiones', 'electric motorcycle', 'e-motorcycle', 'ev'], MOTO.d, {
  fill: MOTO.fill,
  parts: MOTO.parts,
  badge: (() => {
    const b = zigBolt(8.75, 1.75, 3.25, 8);
    return own([b], trace(b));
  })(),
});
const MW = MOTO.d.slice(0, 2);
// The sport bike: a fairing wrapping the front up to its screen, the seat rising to a high short
// tail, the rider's place low between them
{
  const body = roundpoly(
    [
      [2.5, 7.25],
      [9.25, 10],
      [11.5, 8],
      [15.25, 4.5],
      [19.75, 10.5],
      [14, 13.25],
      [10.5, 13.25],
    ],
    [0.75, 0.5, 1, 1, 1.25, 1, 1],
  );
  const swing = line([5.25, 16.75], [10.5, 13.25]);
  const fork = line([17.25, 11.7], [18.75, 16.75]);
  add('motorcycle-sport', ['moto deportiva', 'pista', 'alto desempeño', 'sport bike', 'superbike', 'racing'], [...MW, body, swing, fork], {
    fill: { solid: [...MW, body], wire: [swing, fork] },
    parts: { wheels: [0, 1], body: [2], frame: [3, 4] },
  });
}
// The cruiser: long and low, the wheels far apart, a low seat before a high round tank over a deep
// engine, the fork raked far out to the front wheel and tall handlebars; its tail stays 3 over the
// rear tire (closer, it touched it at some weights and not at others)
{
  const C = moto({
    body: [
      [2.25, 9.5],
      [8.25, 10],
      [9.75, 7.75],
      [13.25, 7.5],
      [14.25, 8.75],
      [12.75, 13.75],
      [9.75, 13.75],
      [8, 11.25],
      [2.75, 10.75],
    ],
    r: [0.5, 0.75, 1.25, 1, 0.75, 1, 1, 0.75, 0.5],
    wheels: [
      [4.75, 3],
      [19.25, 3],
    ],
    swing: [8.88, 12.5],
    fork: [14.18, 9],
    bar: roundline(
      [
        [13.25, 7.5],
        [12, 2.5],
        [14.5, 2],
      ],
      [0, 0.6, 0],
    ),
  });
  add('motorcycle-cruiser', ['moto custom', 'chopper', 'carretera', 'cruiser', 'chopper bike', 'touring'], C.d, { fill: C.fill, parts: C.parts });
}
// The dirt bike: a thin body on wheels set far apart, a long flat seat, a long fork from the bar and
// the front fender high over the wheel
{
  const C = moto({
    body: [
      [2.5, 8.25],
      [10.5, 8.25],
      [11.75, 7.25],
      [14.25, 7.25],
      [14.5, 9],
      [12.5, 13.25],
      [10.75, 13.25],
      [8.75, 10],
      [3, 9.5],
    ],
    r: [0.5, 0.5, 0.75, 0.75, 0.5, 0.75, 0.75, 0.5, 0.5],
    wheels: [
      [4.75, 3],
      [19.25, 3],
    ],
    swing: [9.75, 11.6],
    fork: [16.5, 4.25],
    bar: line([14, 4.25], [18.5, 4.25]),
    extra: [line([17, 10.75], [21.75, 10.75])],
  });
  add('motorcycle-dirt', ['moto de cross', 'motocross', 'todoterreno', 'dirt bike', 'motocross bike', 'off-road'], C.d, { fill: C.fill, parts: { ...C.parts, fender: [6] } });
}

// ── Small vehicles ──
// The moped: lugares's scooter wheels (r 2.5), the cowl with the seat over the rear wheel, the
// step-through line from under the cowl down to the floorboard and up the front shield to the head,
// the fork to the front axle and the handlebar
{
  const W = [circ(5.5, 18.25, 2.5), circ(18.5, 18.25, 2.5)];
  const cowl = roundpoly(
    [
      [2.75, 12.75],
      [2.75, 10],
      [11, 10],
      [11, 12.75],
    ],
    [1, 1.25, 1, 0.75],
  );
  const step = roundline(
    [
      [9.75, 12.75],
      [9.75, 15.5],
      [13.75, 15.5],
      [16, 7.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  const fork = line([16, 7.5], [18.5, 18.25]);
  const bar = roundline(
    [
      [16, 7.5],
      [16.5, 5.25],
      [19, 5.25],
    ],
    [0, 0.6, 0],
  );
  add('moped', ['motoneta', 'scooter', 'renta urbana', 'moped', 'motor scooter', 'step-through'], [...W, cowl, step, fork, bar], {
    fill: { solid: [...W, cowl], wire: [step, fork, bar] },
    parts: { wheels: [0, 1], body: [2, 3], frame: [4], handlebar: [5] },
  });
}
// The quad: a straddle body on two big tires hanging from its sill, the seat raised in the middle,
// a rack over each end and the handlebar ahead of the seat
{
  const body = roundpoly(
    [
      [2.25, 14.75],
      [2.25, 11.5],
      [8.5, 11.5],
      [9.25, 9.25],
      [13, 9.25],
      [14, 11.5],
      [21.75, 11.5],
      [21.75, 14.75],
    ],
    [0.75, 0.75, 0, 0.75, 0.75, 0, 0.75, 0.75],
  );
  const tires = [hang(5.75, 17.25, 3.5, 14.75), hang(18.25, 17.25, 3.5, 14.75)];
  const racks = [line([2.75, 8.5], [6.25, 8.5]), line([17.75, 8.5], [21.25, 8.5])];
  const bar = roundline(
    [
      [13.5, 10.25],
      [13, 6.25],
      [15, 6.25],
    ],
    [0, 0.6, 0],
  );
  add('quad-bike', ['cuatrimoto', 'todoterreno', 'paseo', 'quad bike', 'atv', 'four-wheeler'], [body, ...tires, ...racks, bar], {
    fill: { solid: [body, ...tires.map(shut)], lines: racks, wire: [bar] },
    parts: { body: [0], wheels: [1, 2], racks: [3, 4], handlebar: [5] },
  });
}
// The snowmobile: the body with its windshield and seat, the track under its back half and the
// ski under its nose, curling up at the tip
{
  const body = roundpoly(
    [
      [2.5, 14],
      [2.5, 11.25],
      [10.5, 11.25],
      [14.5, 8],
      [21.25, 13],
      [21.25, 14],
    ],
    [0.75, 0.75, 0.75, 1.25, 1, 0.5],
  );
  const shield = line([14.5, 8], [13.5, 4.5]);
  const track = capsule(2.5, 17, 10.75, 3.75);
  const skiTip = roundline(
    [
      [16, 20.25],
      [21, 20.25],
      [22.25, 18.25],
    ],
    [0, 1.5, 0],
  );
  const strut = line([17.75, 14], [17.75, 20.25]);
  add('snowmobile', ['motonieve', 'paseo en nieve', 'invierno', 'snowmobile', 'snow trail', 'winter tour'], [body, shield, track, strut, skiTip], {
    fill: { solid: [body, track], wire: [shield, strut, skiTip] },
    parts: { body: [0, 1], track: [2], ski: [3, 4] },
  });
}
// The golf cart: a low open body, the flat roof overhanging its two posts (the front one raked as
// the windshield's frame) and the bench's back between them. (A roof that closed on its posts made
// a frame, and read as a screen on wheels.)
{
  const body = roundpoly(
    [
      [3, 17],
      [3, 12.5],
      [17.75, 12.5],
      [21, 14.5],
      [21, 17],
    ],
    [1, 0.75, 0.5, 1, 1],
  );
  const roof = line([2.75, 4.25], [19.5, 4.25]);
  const posts = 'M5.25 4.25V12.5M15.75 4.25L17 12.5';
  const bench = line([10.5, 12.5], [9.75, 8.75]);
  const tires = [hang(6.75, 18.75, 2, 17), hang(17, 18.75, 2, 17)];
  add('golf-cart', ['carrito de golf', 'campo de golf', 'traslado en resort', 'golf cart', 'golf buggy', 'campus shuttle'], [body, roof, posts, bench, ...tires], {
    fill: { solid: [body, ...tires.map(shut)], wire: [roof, posts, bench] },
    parts: { body: [0], canopy: [1, 2], seat: [3], wheels: [4, 5] },
  });
}
// The self-balancing transporter: one wheel from the side, the platform through its axle, the tall
// stalk and its T handlebar
{
  const tire = circ(12, 17, 3.75);
  const deck = line([6, 17], [18, 17]);
  const stalk = line([12, 17], [13.5, 4.5]);
  const bar = line([10.75, 4.25], [16.25, 4.75]);
  add('personal-transporter', ['segway', 'transportador personal', 'patrullaje', 'personal transporter', 'self-balancing', 'city tour'], [tire, deck, stalk, bar], {
    fill: { solid: [tire], wire: [deck, stalk, bar] },
    parts: { wheels: [0], deck: [1], stalk: [2], handlebar: [3] },
  });
}

// ── Bicycles ──
// Lugares's bicycle: its wheels (r 3.25), its diamond frame, the fork, the seat post and saddle and
// the handlebar. Every bicycle-* is built on it, changing only what makes the kind.
const BIKE = lugares.icons.bicycle.d;
const [BA, BF, BH] = [
  [5.75, 15],
  [18.25, 15],
  [15, 9],
];
const bikeParts = { wheels: [0, 1], frame: [2, 3], seat: [4, 5], handlebar: [6] };
// The e-bike: the bicycle with a bolt standing beside its handlebar, over the front wheel, 2.85 clear
// of both. (Cut out of the bicycle as car-electric's, its clearance's mask shut the small sector the
// stays close inside the rear wheel at bold.)
add('bicycle-electric', ['bicicleta eléctrica', 'pedaleo asistido', 'renta de e-bikes', 'e-bike', 'electric bicycle', 'pedal assist'], [...BIKE, zigBolt(20.85, 2.5, 2.5, 6.25)], {
  fill: false,
  parts: { ...bikeParts, bolt: [7] },
});
// The road bike: the drop handlebar, forward from the stem and curling down at its end
add('bicycle-road', ['bicicleta de ruta', 'ciclismo de carretera', 'manubrio de carreras', 'road bike', 'racing bike', 'drop bar'], [...BIKE.slice(0, 6), roundline([BH, [14.25, 4.75], [16.5, 4.75], [17.75, 7.5]], [0, 0.6, 1.25, 0])], { fill: false, parts: bikeParts });
// The mountain bike: thick tires (each a second rim 0.75 inside, one ring at every weight), the
// suspension fork's legs as a slim body down to the axle and a flat bar
{
  const tires = [circ(...BA, 2.5), circ(...BF, 2.5)];
  const u = unit(sub(BF, BH));
  const nrm = [-u[1], u[0]];
  const top = plus(BH, scale(u, 0.75));
  const low = plus(BH, scale(u, 4));
  const leg = roundpoly([plus(top, scale(nrm, 1.25)), plus(low, scale(nrm, 1.25)), plus(low, scale(nrm, -1.25)), plus(top, scale(nrm, -1.25))], 0.6);
  const bar = roundline(
    [
      BH,
      [14.25, 6],
      [17.5, 6],
    ],
    [0, 0.6, 0],
  );
  add('bicycle-mountain', ['bicicleta de montaña', 'mtb', 'tienda de bicicletas', 'mountain bike', 'mtb bike', 'trail bike'], [BIKE[0], BIKE[1], ...tires, BIKE[2], BIKE[3], leg, BIKE[4], BIKE[5], bar], {
    fill: false,
    parts: { wheels: [0, 1, 2, 3], frame: [4, 5, 6], seat: [7, 8], handlebar: [9] },
  });
}
// The city bike: a step-through frame (no top tube), and a basket over the front wheel
{
  const frame = roundline([BA, [11.5, 15], BH], [0, 1.5, 0]);
  const seatTube = line([11.5, 15], [9, 9]);
  const stay = line(BA, [9, 9]);
  const post = line([9, 9], [8.4, 6]);
  const saddle = line([7, 6], [10, 6]);
  const bar = roundline([BH, [14.25, 6], [15.75, 6]], [0, 0.6, 0]);
  const basket = roundline(
    [
      [18.75, 4.75],
      [18.75, 8.75],
      [22.25, 8.75],
      [22.25, 4.75],
    ],
    [0, 0.75, 0.75, 0],
  );
  add('bicycle-city', ['bicicleta urbana', 'bici de ciudad', 'canasta', 'city bike', 'commuter bike', 'step-through'], [BIKE[0], BIKE[1], frame, seatTube, stay, BIKE[3], post, saddle, bar, basket], {
    fill: false,
    parts: { wheels: [0, 1], frame: [2, 3, 4, 5], seat: [6, 7], handlebar: [8], basket: [9] },
  });
}
// The folding bike: small wheels under one low tube with its hinge, a tall seat post and a tall stem
{
  const W = [circ(5.75, 17.5, 2.5), circ(18.25, 17.5, 2.5)];
  const tube = line([9.5, 14.25], [15.75, 14.25]);
  const hinge = dot(12.5, 14.25);
  const rear = line([5.75, 17.5], [9.5, 14.25]);
  const fork = line([15.75, 14.25], [18.25, 17.5]);
  const post = line([9.5, 14.25], [8.5, 6]);
  const saddle = line([7, 6], [10, 6]);
  const stem = roundline([[15.75, 14.25], [15.25, 5.25], [17.25, 5.25]], [0, 0.6, 0]);
  add('bicycle-folding', ['bicicleta plegable', 'plegable', 'bici compacta', 'folding bike', 'foldable bicycle', 'compact bike'], [...W, tube, hinge, rear, fork, post, saddle, stem], {
    fill: false,
    parts: { wheels: [0, 1], frame: [2, 3, 4, 5], seat: [6, 7], handlebar: [8] },
  });
}
// The tandem: a long frame between two wheels and two saddles on it, the front one's handlebar
{
  const W = [circ(4.75, 15.5, 3), circ(19.25, 15.5, 3)];
  const frame = roundpoly(
    [
      [4.75, 15.5],
      [13.25, 15.5],
      [16.25, 9.5],
      [6.75, 9.5],
    ],
    [0.4, 0.6, 0, 0],
  );
  const mid = line([10.5, 9.5], [10, 15.5]);
  const fork = line([16.25, 9.5], [19.25, 15.5]);
  const posts = [line([6.75, 9.5], [6.25, 6.5]), line([12.75, 9.5], [12.25, 6.5])];
  const saddles = [line([4.5, 6.5], [7.5, 6.5]), line([10.5, 6.5], [13.25, 6.5])];
  const bar = roundline([[16.25, 9.5], [16, 6.5], [18.75, 6.5]], [0, 0.6, 0]);
  add('bicycle-tandem', ['bicicleta tándem', 'tándem', 'para dos', 'tandem bicycle', 'tandem', 'bike for two'], [...W, frame, mid, fork, ...posts, ...saddles, bar], {
    fill: false,
    parts: { wheels: [0, 1], frame: [2, 3, 4], seat: [5, 6, 7, 8], handlebar: [9] },
  });
}
// The kids' bike: the bicycle's construction on smaller wheels (r 3), low and to the right, with a
// training wheel (a dot) on its arm behind the rear wheel. The seat stay rises at 77° so the sector
// it closes inside the rear wheel stays open at bold. (The bicycle scaled to 0.8 brought its saddle
// within 2.4 of the top tube.)
{
  const [A, F, B, H, S] = [
    [9.25, 17.5],
    [19.25, 17.5],
    [12.75, 17.5],
    [15.5, 12.5],
    [10.4, 12.5],
  ];
  const W = [circ(...A, 3), circ(...F, 3)];
  const frame = roundpoly([A, B, H, S], [0, 0.6, 0, 0]);
  const fork = line(H, F);
  const post = line(S, [9.9, 9.5]);
  const saddle = line([8.4, 9.5], [11.4, 9.5]);
  const bar = roundline([H, [15.5, 9.5], [17.5, 9.5]], [0, 0.6, 0]);
  const tc = [4.25, 19.75];
  const trainer = circ(...tc, 1.25);
  const arm = line(A, toward(tc, A, 1.25));
  add('bicycle-kids', ['bicicleta infantil', 'rueditas', 'niños', 'kids bike', 'training wheels', 'children bicycle'], [...W, frame, fork, post, saddle, bar, arm, trainer], {
    fill: false,
    parts: { ...bikeParts, trainer: [7, 8] },
  });
}
// The tricycle: the big front wheel with its pedals' crank on the hub, the frame down to the small
// rear wheel, the saddle on it and the handlebar on the fork
{
  const front = circ(15.5, 15.5, 4.75);
  const rear = circ(4.75, 18.25, 2);
  const fork = line([15.5, 15.5], [14.5, 6.5]);
  const bar = line([12.25, 6.5], [16.5, 6.5]);
  const frame = line([14.95, 10.5], [4.75, 18.25]);
  const post = line([9.25, 14.83], [8.75, 9.75]);
  const saddle = line([7.25, 9.75], [10.25, 9.75]);
  const crank = line([14.2, 16.8], [16.8, 14.2]);
  add('tricycle', ['triciclo', 'triciclo infantil', 'tres ruedas', 'tricycle', 'trike', 'kids trike'], [front, rear, frame, fork, post, saddle, bar, crank], {
    fill: false,
    parts: { wheels: [0, 1], frame: [2, 3], seat: [4, 5], handlebar: [6], pedals: [7] },
  });
}
// The handcycle: a low frame between the wheels, the reclined seat's back and the hand crank on its
// post over the front wheel, at the rider's chest
{
  const W = [circ(5.25, 17, 3.25), circ(18.75, 17, 3.25)];
  const frame = line([8.5, 17], [15.5, 17]);
  const back = line([8.5, 17], [6, 9.5]);
  const post = line([18.75, 17], [16, 9]);
  const crank = line([14.25, 10.25], [17.75, 7.75]);
  add('handcycle', ['handbike', 'ciclismo adaptado', 'bicicleta de mano', 'handcycle', 'hand bike', 'adaptive cycling'], [...W, frame, back, post, crank], {
    fill: false,
    parts: { wheels: [0, 1], frame: [2, 4], seat: [3], crank: [5] },
  });
}
// The balance bike: two equal small wheels, a low frame, the saddle and the handlebar; no pedals
{
  const W = [circ(5.5, 17.25, 3), circ(18.5, 17.25, 3)];
  const frame = roundline([[5.5, 17.25], [9.5, 12], [15.25, 12], [18.5, 17.25]], [0, 0.75, 0.75, 0]);
  const post = line([9.5, 12], [9, 9]);
  const saddle = line([7.5, 9], [10.5, 9]);
  const bar = roundline([[15.25, 12], [14.75, 8.75], [17.25, 8.75]], [0, 0.6, 0]);
  add('balance-bike', ['bicicleta de equilibrio', 'sin pedales', 'primera bici', 'balance bike', 'push bike', 'first bike'], [...W, frame, post, saddle, bar], {
    fill: false,
    parts: { wheels: [0, 1], frame: [2], seat: [3, 4], handlebar: [5] },
  });
}
// The wheel: the rim around the hub and six spokes between them
{
  const rim = circ(12, 12, 9);
  const hub = circ(12, 12, 1.75);
  const spokes = [0, 60, 120, 180, 240, 300].map((a) => line(polar(12, 12, 1.75, a - 90), polar(12, 12, 9, a - 90)));
  add('bicycle-wheel', ['rueda de bicicleta', 'rin', 'rayos', 'bicycle wheel', 'spokes', 'wheel build'], [rim, hub, ...spokes], {
    fill: { solid: [rim], cut: [hub, ...spokes] },
    parts: { rim: [0], hub: [1], spokes: [2, 3, 4, 5, 6, 7] },
  });
}
// The floor pump: the T handle on its rod into the barrel standing on its foot, the hose curling off
{
  const barrel = roundline(
    [
      [9.75, 19.75],
      [9.75, 8.25],
      [14.25, 8.25],
      [14.25, 19.75],
    ],
    [0, 1.25, 1.25, 0],
  );
  const foot = line([6.25, 19.75], [17.75, 19.75]);
  const rod = line([12, 8.25], [12, 4]);
  const handle = line([8.5, 4], [15.5, 4]);
  const hose = roundline(
    [
      [14.25, 16.75],
      [17.5, 16.75],
      [17.5, 8.5],
      [19.5, 8.5],
    ],
    [0, 1.5, 1, 0],
  );
  add('bicycle-pump', ['bomba de aire', 'inflador', 'llantas', 'bike pump', 'floor pump', 'inflate'], [barrel, foot, rod, handle, hose], {
    fill: { solid: [shut(barrel)], wire: [foot, rod, handle, hose] },
    parts: { body: [0, 1], handle: [2, 3], hose: [4] },
  });
}
// The bike trailer: a small canopied pod on one wheel and its long tow arm reaching forward
{
  const pod = roundline(
    [
      [3, 15.5],
      [3, 10.5],
      [6.5, 7],
      [12.5, 7],
      [13.5, 15.5],
    ],
    [0, 1.5, 2.5, 1, 0],
  );
  const floor = line([3, 15.5], [13.5, 15.5]);
  const tire = hang(8.25, 17.75, 2.5, 15.5);
  const arm = roundline(
    [
      [13.5, 13.5],
      [21.25, 11.5],
    ],
    0,
  );
  add('bicycle-trailer', ['remolque para bicicleta', 'carrito para niños', 'carga', 'bike trailer', 'child trailer', 'cargo trailer'], [pod, floor, tire, arm], {
    fill: { solid: [shut(pod), shut(tire)], wire: [arm] },
    parts: { body: [0, 1], wheels: [2], arm: [3] },
  });
}
// The drivetrain: the big chainring and the small cog, toothed, with the chain's two runs between
{
  const [A, rA, B, rB] = [[7.75, 12], 4.5, [18.25, 12], 2.5];
  const ring = gear(...A, rA, rA - 0.7, 16, 0.3, 0.3);
  const cog = gear(...B, rB, rB - 0.65, 9, 0.25, 0.25);
  // The chain's two runs: the outer tangents of the two rings, top and bottom
  const sn = (rA - rB) / (B[0] - A[0]);
  const cs = Math.sqrt(1 - sn * sn);
  const runs = [-1, 1].map((v) => line([A[0] + rA * sn, A[1] + v * rA * cs], [B[0] + rB * sn, B[1] + v * rB * cs]));
  const hole = dot(...A);
  add('bicycle-chain', ['cadena de bicicleta', 'transmisión', 'refacciones', 'bike chain', 'drivetrain', 'chainring'], [ring, cog, ...runs, hole], {
    fill: { solid: [ring, cog], cut: [hole], wire: runs },
    parts: { chainring: [0, 4], cog: [1], chain: [2, 3] },
  });
}
// ── Caravans and trailers ──
// The caravan: a rounded box (its signature corner over the drawbar) with a window and the door, on
// one axle, and the drawbar to its coupling
{
  const box = sq(2.5, 5, 15.75, 11.5, 3.5, SQ);
  const window = sq(5.5, 8, 4.5, 3.5, 1);
  const door = roundline(
    [
      [12.75, 16.5],
      [12.75, 8],
      [15.25, 8],
      [15.25, 16.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  const tire = hang(7.75, 18.25, 2.5, 16.5);
  const bar = line([18.25, 15.25], [21.75, 17.25]);
  add('caravan', ['caravana', 'remolque de viaje', 'campamento', 'caravan', 'travel trailer', 'rv park'], [box, window, door, tire, bar], {
    fill: { solid: [box, shut(tire)], cut: [window, door], wire: [bar] },
    parts: { body: [0], window: [1], door: [2], wheels: [3], drawbar: [4] },
  });
}
// The motorhome: a big box with the cab at the front under the bunk that bulges over it
{
  const pts = [
    [2.5, BOT],
    [2.5, 3.5],
    [19.75, 3.5],
    [19.75, 7.25],
    [17.25, 7.25],
    [19.25, BELT],
    [21.5, 11.5],
    [21.5, BOT],
  ];
  addSide('motorhome', ['casa rodante', 'autocaravana', 'camping', 'motorhome', 'rv', 'camper'], {
    pts,
    r: [1, 2, 1.75, 0.75, 0, 0, 1.5, 1],
    belt: [15.25, 19.25],
    beltCut: [15.25, 17.5],
    roof: 7.25,
    extra: [
      { d: roundline([[17.25, 7.25], [15.25, 7.25], [15.25, BELT]], [0, 0.5, 0]), fillD: roundline([[16.25, 7.25], [15.25, 7.25], [15.25, BELT]], [0, 0.5, 0]), as: 'cut', name: 'windows' },
      { d: sq(5.5, 6.5, 5, 3.5, 1), as: 'cut', name: 'window' },
    ],
  });
}
// The utility trailer: an open low box on one wheel and the drawbar to its ball coupling
{
  const box = roundline(
    [
      [3, 10.5],
      [3, 15.5],
      [15.5, 15.5],
      [15.5, 10.5],
    ],
    [0, 1, 1, 0],
  );
  const tire = hang(9.25, 17.75, 2.75, 15.5);
  const bar = line([15.5, 14], [19.25, 14]);
  const ball = circ(20.5, 14, 1.25);
  add('trailer', ['remolque', 'tráiler de carga', 'mudanza', 'utility trailer', 'trailer', 'towing'], [box, tire, bar, ball], {
    fill: { solid: [shut(box), shut(tire), ball], wire: [bar] },
    parts: { body: [0], wheels: [1], drawbar: [2, 3] },
  });
}
// The enclosed trailer: a long closed box with its nose chamfered at the top front and the signature
// at its lower front corner, the seam of its rear ramp door, one wheel and the drawbar
{
  const box = roundpoly(
    [
      [2.5, 15.75],
      [2.5, 4.75],
      [14.5, 4.75],
      [17.25, 8],
      [17.25, 15.75],
    ],
    [1, 1.5, 1.5, 1.25, 0],
  );
  const ramp = line([5.5, 4.75], [5.5, 15.75]);
  const tire = hang(10.25, 18, 2.5, 15.75);
  const bar = line([17.25, 14.25], [21.5, 14.25]);
  add('trailer-enclosed', ['remolque cerrado', 'caja cerrada', 'mudanza', 'enclosed trailer', 'cargo trailer', 'box trailer'], [box, ramp, tire, bar], {
    fill: { solid: [box, shut(tire)], cut: [ramp], wire: [bar] },
    parts: { body: [0], door: [1], wheels: [2], drawbar: [3] },
  });
}

// ── Plates ──
// The license plate: a landscape plate (the signature at its corner), two bolts at the top and a
// row of three short dashes for its characters
const PLATE = [sq(2.5, 6, 19, 12, 3, SQ), dot(6.75, 9), dot(17.25, 9), line([5.5, 14], [7.75, 14]), line([10.88, 14], [13.13, 14]), line([16.25, 14], [18.5, 14])];
const PLATE_FILL = { solid: [PLATE[0]], cut: PLATE.slice(1) };
const PLATE_PARTS = { plate: [0], bolts: [1, 2], characters: [3, 4, 5] };
add('license-plate', ['placa', 'matrícula', 'registro vehicular', 'license plate', 'number plate', 'registration'], PLATE, { fill: PLATE_FILL, parts: PLATE_PARTS });
// With the magnifier, the right bolt (3.9 from its ring: kept at light, taken at bold) and the third
// dash (inside the ring) are left out
{
  const d = [PLATE[0], PLATE[1], PLATE[3], PLATE[4]];
  add('license-plate-search', ['consultar placa', 'historial vehicular', 'buscar matrícula', 'plate lookup', 'vehicle history', 'registry check'], d, {
    fill: { solid: [d[0]], cut: d.slice(1) },
    parts: { plate: [0], bolts: [1], characters: [2, 3] },
    badge: badge('search'),
  });
}

// ── Mirror (DESIGN.md › Mirroring) ────────────────────────────────────────────────────────────
// What is seen from the side faces right and drives that way: it flips in right-to-left languages,
// as comercio's and logistica's trucks do. Views from the front, the back and above, and the parts
// and plates, don't.
const STILL = new Set(['car-rear', 'car-top', 'car-door-open', 'car-connected', 'car-alarm', 'van-front', 'scissor-lift', 'bicycle-wheel', 'bicycle-pump', 'bicycle-chain', 'license-plate', 'license-plate-search']);
for (const [name, icon] of Object.entries(icons)) if (!STILL.has(name) && !icon.d.includes(CAR[0])) icon.mirror = true;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
// Whatever drives slides forward; the front views hop as lugares's car does; a piece does its own
// gesture: a lid swings on its hinge, a light pulses, a wheel spins.
for (const [name, icon] of Object.entries(icons)) icon.motion = icon.mirror ? { effect: 'slide', vector: [2, 0] } : { effect: 'bounce', vector: [0, -1.5] };
const MOTION = {
  'car-top': { effect: 'slide', vector: [0, -2] },
  'car-door-open': { effect: 'wiggle', parts: ['door'], origin: [17.75, 7.5] },
  'car-trunk-open': { effect: 'wiggle', parts: ['lid'], origin: [7.25, 10.5] },
  'car-hood-open': { effect: 'wiggle', parts: ['lid'], origin: [18, 10.5] },
  'car-electric': { effect: 'beat', parts: ['badge'], origin: [19.5, 5.25] },
  'car-hybrid': { effect: 'beat', parts: ['badge'], origin: [12, 5.5] },
  'car-connected': { effect: 'beat', parts: ['wave'], origin: [12, 8.35] },
  'car-alarm': { effect: 'wiggle', origin: [12, 20.75] },
  'car-location': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'car-unlock': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.75] },
  'car-remote-start': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.75] },
  'car-rental': { effect: 'wiggle', parts: ['badge'], origin: [17, 19.25] },
  'car-sale': { effect: 'wiggle', parts: ['badge'], origin: [14.4, 14.4] },
  'car-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'car-clock': { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] },
  'car-lock': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.75] },
  'car-search': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 17.25] },
  'car-breakdown': { effect: 'float', parts: ['smoke'], vector: [0, -1.5] },
  'car-crash': { effect: 'beat', parts: ['impact'], origin: [20.5, 13.75] },
  'car-damage': { effect: 'wiggle', origin: [12, 19.75] },
  'car-towed': { effect: 'ring', origin: [19.5, 1.75] },
  'car-charging': { effect: 'beat', parts: ['plug'], origin: [4.75, 8.5] },
  'car-flood': { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
  'car-fire': { effect: 'beat', parts: ['badge'], origin: [18, 8.5] },
  'police-car': { effect: 'beat', parts: ['lights'], origin: [11.38, 5.75] },
  'truck-refrigerated': { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] },
  'truck-electric': { effect: 'beat', parts: ['badge'], origin: [8.5, 6] },
  'motorcycle-electric': { effect: 'beat', parts: ['badge'], origin: [8.75, 5.5] },
  'bicycle-electric': { effect: 'beat', parts: ['bolt'], origin: [20.85, 5.6] },
  excavator: { effect: 'wiggle', parts: ['arm', 'bucket'], origin: [14, 14] },
  'dump-truck': { effect: 'wiggle', parts: ['bed'], origin: [3, 14] },
  'tow-truck': { effect: 'wiggle', parts: ['boom'], origin: [10.25, 10.5] },
  'crane-truck': { effect: 'wiggle', parts: ['boom'], origin: [10.25, 7.5] },
  'cement-mixer': { effect: 'wiggle', parts: ['drum'], origin: [7.75, 10] },
  'scissor-lift': { effect: 'bounce', parts: ['platform'], vector: [0, -1.5] },
  'boom-lift': { effect: 'wiggle', parts: ['boom', 'basket'], origin: [12, 14.75] },
  'bucket-truck': { effect: 'wiggle', parts: ['boom', 'basket'], origin: [11, 11] },
  'bicycle-wheel': { effect: 'spin', origin: [12, 12] },
  'bicycle-chain': { effect: 'spin', parts: ['chainring'], origin: [7.75, 12] },
  'bicycle-pump': { effect: 'bounce', parts: ['handle'], vector: [0, 1.5] },
  'license-plate': { effect: 'bounce', vector: [0, -1.5] },
  'license-plate-search': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 17.25] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Variants (DESIGN.md › Automatic variants) ─────────────────────────────────────────────────
const off = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already round: no circle around it
off(['bicycle-wheel'], { circle: false });
// A slash says nothing over a status badge
off(['car-plus', 'car-check', 'car-alert', 'car-clock', 'car-lock', 'car-search', 'license-plate-search'], { slash: false });

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// At 16 px one pixel is 1.5 of the canvas and pixel centers fall on 0.75 + 1.5k: these drawings put
// their strokes on them. Only the icons whose snapped drawing smudged get one.
const px = (k) => 0.75 + 1.5 * k;
const pl = (...cr) => line(...cr.map(([c, r]) => [px(c), px(r)]));
// The flood: the side car snapped as the engine would, the water two stepped waves (a pixel up, a
// pixel across, a pixel down) and the area under the first one cleared
{
  const icon = icons['car-flood'];
  const sn = snapper([...icon.d, ...Object.values(icon.fill).flat()]);
  const zig = (r) => pl(...Array.from({ length: 15 }, (_, i) => [i, r + [1, 0, 0, 1][i % 4]]));
  const water = [zig(10), zig(13)];
  icon.small = {
    d: icon.d.map(sn),
    fill: Object.fromEntries(Object.entries(icon.fill).map(([k, v]) => [k, v.map(sn)])),
    badge: { d: water, knock: `M0.75 ${px(10)}H23.25V23.25H0.75Z` },
  };
}

export default { category: 'vehiculos', label: 'Vehículos', icons };
