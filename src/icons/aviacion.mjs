// Air travel: aircraft by kind, flight status, routes, airports, boarding, baggage, the cabin and
// the cockpit. Everything is computed with the engine (engine/geometry.mjs) and the rules in
// DESIGN.md: a 1.5 stroke, keylines, continuous corners and a square bottom-right corner on
// containers. The category adopts lugares's `plane`, `plane-takeoff` and `plane-landing` (drawn
// there, never redrawn here): the plane-* badges stand on lugares's plane itself, and the small plane
// that rides an arc, a pin or a pass is the same plane drawn as its center lines (calendario's, never
// under 0.87, where its wings and tail stay 2.85 apart).
// Every aircraft seen from the side faces right and shares one airframe (`airframe`): a fuselage
// with a round nose, the fin rising from its tail; drawn small, the airliner's wing is one stroke.
// The flight arcs are one arc with two end dots. The airline seat is one side view (`seat`) for every
// seat icon, the boarding pass one card (`PASS`), the bag tag one strip (`TAG`). Badges are the
// engine's (`badge`); a piece that sits in front of another (a wifi fan, a pass, a bag, a sign) is a
// custom piece and the engine clears what is behind it. Under a badge, every stroke that ends near
// it ends well inside its clearance or well outside it, so the cut is the same at every weight.
import { arc, badge, circ, dot, flipPath, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const SQ = { square: ['br'] };

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
    const S = add(V, mul(u, t));
    const E = add(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/**
 * Closes every open subpath, for `fill.solid` (only closed shapes go there). The closing segment
 * runs along an edge that is already solid or knocked out, so the silhouette doesn't change.
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

/** Ellipse from four cubics (lugares's). */
function ellipse(cx, cy, rx, ry) {
  const k = 0.5523;
  return `M${pt([cx + rx, cy])}C${pt([cx + rx, cy + k * ry])} ${pt([cx + k * rx, cy + ry])} ${pt([cx, cy + ry])}C${pt([cx - k * rx, cy + ry])} ${pt([cx - rx, cy + k * ry])} ${pt([cx - rx, cy])}C${pt([cx - rx, cy - k * ry])} ${pt([cx - k * rx, cy - ry])} ${pt([cx, cy - ry])}C${pt([cx + k * rx, cy - ry])} ${pt([cx + rx, cy - k * ry])} ${pt([cx + rx, cy])}Z`;
}
/** The y of the ellipse's upper (s = -1) or lower (s = 1) edge at x. */
const ellipseY = (cx, cy, rx, ry, x, s) => cy + s * ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));

/** A circle drawn clockwise: an area the engine clears is filled nonzero (logistica's note). */
const clockwise = ([cx, cy], r) => `M${pt([cx - r, cy])}A${N(r)} ${N(r)} 0 1 1 ${pt([cx + r, cy])}A${N(r)} ${N(r)} 0 1 1 ${pt([cx - r, cy])}Z`;
/** A custom piece on top: drawn, and the area the engine clears around it. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

// ── Lugares's plane ───────────────────────────────────────────────────────────────────────────
const L = lugares.icons;
/** The plane itself (nose up and to the right), the base of every plane-* badge. */
const PLANE = L.plane.d[0];

/**
 * The same plane drawn as its center lines (calendario's construction), for where it rides small:
 * the fuselage, the swept wings and the tail. `c` is its middle, `k` its scale and `deg` its heading
 * (0 = nose up, 90 = nose right).
 */
function mini(c, k = 1, deg = 45) {
  const at = (pts) => pts.map((p) => add(c, rot(mul(p, k), [0, 0], deg)));
  return [
    line(...at([
      [0, -3.25],
      [0, 3.75],
    ])),
    line(...at([
      [-3.5, 1],
      [0, -0.75],
      [3.5, 1],
    ])),
    line(...at([
      [-1.6, 3.75],
      [0, 2.6],
      [1.6, 3.75],
    ])),
  ];
}

// ── The airframe (side view, facing right) ────────────────────────────────────────────────────
/**
 * One construction for every aircraft seen from the side: the fuselage's top and belly, a round
 * nose (two cubics through its tip, which hangs `droop` under the middle) and the fin rising from
 * the tail. `fin` is [x of its top back, x of its top front, y of its top]; `finBase` is where its
 * leading edge meets the top line; `tail` is the tip of the tail cone, `belly` where the belly
 * starts rising to it. A light plane's `cabin` [x0, x1, y] raises the top line into a cabin whose
 * windshield slopes down to the nose.
 */
function airframe({ top, bot, nose, noseLen = 3.5, droop = 0.25, fin, finBase, tail, belly, cabin, blunt = 0.3, r = {} }) {
  const mid = (top + bot) / 2 + droop;
  const E = [nose - noseLen, top];
  const F = [nose, mid];
  const G = [nose - noseLen * 0.8, bot];
  const hump = cabin
    ? [
        [cabin[1], cabin[2]],
        [cabin[0], cabin[2]],
        [cabin[0] - 1.25, top],
      ]
    : [];
  const pts = [E, ...hump, [finBase, top], [fin[1], fin[2]], [fin[0], fin[2]], tail, [belly, bot], G];
  const rad = [0, ...(cabin ? [1.25, 1.25, 0.75] : []), r.base ?? 1.25, r.front ?? 0.75, r.back ?? 0.75, r.tail ?? 0.75, r.belly ?? 1.5, 0];
  const kx = noseLen * 0.55;
  const ky = (bot - top) * blunt;
  return `${roundline(pts, rad)}C${pt([G[0] + kx * 0.8, bot])} ${pt([nose, mid + ky])} ${pt(F)}C${pt([nose, mid - ky])} ${pt([E[0] + kx, top])} ${pt(E)}Z`;
}

/** The airliner: the fuselage 4.5 tall, the swept fin, the swept wing hanging under its middle. */
const AIRLINER = {
  body: airframe({ top: 10.25, bot: 14.75, nose: 21.25, noseLen: 3.75, fin: [3, 5.25, 5.25], finBase: 8.5, tail: [3, 11], belly: 8.75 }),
  wing: roundline(
    [
      [15.25, 14.75],
      [11.25, 18.75],
      [9.25, 18.75],
      [11.75, 14.75],
    ],
    [0, 0.75, 0.75, 0],
  ),
  // Drawn small, the wing is one stroke down its middle (its outline's hole closed up at bold)
  wingLine: line([13.5, 14.75], [10.25, 18.75]),
};

/**
 * The small single-engine plane, a taildragger: a short fuselage tapering to its tail, the high
 * wing on top seen as its airfoil (round at the front, pointed at the back), the spinner and the
 * propeller at its nose. `dy` moves it up or down.
 */
function lightPlane(dy = 0) {
  const body = airframe({ top: 10.5 + dy, bot: 14.5 + dy, nose: 18.5, noseLen: 3.5, droop: 0, fin: [2.75, 4.75, 5.5 + dy], finBase: 6.75, tail: [3, 11 + dy], belly: 10.5, r: { belly: 2 } });
  const wing = transform('M8.25 10.5H15.5A1.5 1.5 0 0 0 17 9C17 8.2 16.3 7.75 15.25 7.75C12.75 7.75 10.25 8.75 8.25 10.5Z', 1, 0, dy);
  const spinner = line([18.5, 12.5 + dy], [20.75, 12.5 + dy]);
  const prop = line([20.75, 8.75 + dy], [20.75, 16.25 + dy]);
  return { body, wing, spinner, prop };
}

// ── The flight arcs ───────────────────────────────────────────────────────────────────────────
// One arc between two end dots (r 1, a solid disc of 3.5): 17 wide and 7 high. `flight(y)` places
// it with its ends at the height y; `t` (0–1) reads a point and its heading along it.
const FL = { x0: 3.5, x1: 20.5, s: 7 };
FL.r = ((FL.x1 - FL.x0) ** 2 / 4 + FL.s ** 2) / (2 * FL.s);
FL.half = (Math.asin((FL.x1 - FL.x0) / 2 / FL.r) * 180) / Math.PI;
const END = 1;
function flight(y, s = FL.s) {
  const r = ((FL.x1 - FL.x0) ** 2 / 4 + s ** 2) / (2 * s);
  const half = (Math.asin((FL.x1 - FL.x0) / 2 / r) * 180) / Math.PI;
  const c = [12, y - s + r];
  const a0 = 270 - half;
  const a1 = 270 + half;
  const at = (t) => {
    const a = a0 + (a1 - a0) * t;
    return { p: polar(...c, r, a), dir: [-Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)], a };
  };
  return { c, r, a0, a1, at, d: arc(...c, r, a0, a1).d, ends: [polar(...c, r, a0), polar(...c, r, a1)] };
}

// ── Custom pieces in the badge's place ────────────────────────────────────────────────────────
const BC = [17.25, 17.25];

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
// `extra`: fields besides tags and d (the badge, a fill, parts…).
const put = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
const FILL = {};
const PARTS = {};

// ── Aircraft ──
put('plane-side', ['avión de lado', 'aeronave', 'vuelo', 'airliner', 'aircraft side view', 'flight'], [AIRLINER.body, AIRLINER.wing]);
FILL['plane-side'] = { solid: [AIRLINER.body, shut(AIRLINER.wing)] };
PARTS['plane-side'] = { fuselage: [0], wing: [1] };

{
  // Head-on: the round fuselage, low wings rising to their tips, an engine hanging under each, the
  // fin above. The engines stand 2.85 clear of the fuselage.
  const c = [12, 12.75];
  const R = 3.25;
  const rootL = polar(...c, R, 140);
  const tipL = [2.75, 11.75];
  const e = 1.75;
  const ex = 5.25;
  const wy = rootL[1] + ((tipL[1] - rootL[1]) * (rootL[0] - ex)) / (rootL[0] - tipL[0]);
  const engL = [ex, wy + e];
  const d = [
    circ(...c, R),
    line(rootL, tipL),
    line(polar(...c, R, 40), [24 - tipL[0], tipL[1]]),
    circ(...engL, e),
    circ(24 - engL[0], engL[1], e),
    line([12, c[1] - R], [12, 4]),
  ];
  put('plane-front', ['avión de frente', 'flota', 'aeronave', 'plane front', 'fleet', 'aircraft type'], d);
  FILL['plane-front'] = { solid: [d[0], d[3], d[4]], wire: [d[1], d[2], d[5]] };
  PARTS['plane-front'] = { fuselage: [0], wings: [1, 2], engines: [3, 4], fin: [5] };
}
{
  // The business jet: a slim fuselage with a long pointed nose, a T-tail, the engine on the rear
  // fuselage (3 clear of the fin) and a small swept wing.
  const body = airframe({ top: 11, bot: 14.75, nose: 21.25, noseLen: 5, droop: 0.45, blunt: 0.18, fin: [3.5, 5.25, 5], finBase: 7, tail: [3.5, 11.5], belly: 10 });
  // The stabilizer stands well past the fin's top on both sides, at every weight
  const stab = line([2, 5], [7.75, 5]);
  const engine = capsule(9.25, 8, 5.5, 3);
  const wing = roundline(
    [
      [16.75, 14.75],
      [13.75, 18],
      [11.75, 18],
      [13.75, 14.75],
    ],
    [0, 0.75, 0.75, 0],
  );
  const d = [body, stab, engine, wing];
  put('private-jet', ['jet privado', 'chárter', 'aviación ejecutiva', 'private jet', 'business jet', 'charter'], d);
  FILL['private-jet'] = { solid: [body, engine, shut(wing)], wire: [stab] };
  PARTS['private-jet'] = { fuselage: [0, 1], engine: [2], wing: [3] };
}
{
  // On its fixed gear: the main wheel forward on its strut (the tail rests on its tail skid)
  const { body, wing, spinner, prop } = lightPlane(-0.5);
  const strut = line([14.5, 14], [15.75, 17.25]);
  const wheel = circ(16.25, 18.75, 1.5);
  const d = [body, wing, spinner, prop, strut, wheel];
  put('propeller-plane', ['avioneta', 'hélice', 'escuela de vuelo', 'propeller plane', 'light aircraft', 'flight school'], d);
  FILL['propeller-plane'] = { solid: [body, wing, wheel], wire: [spinner, prop, strut] };
  PARTS['propeller-plane'] = { fuselage: [0], wing: [1], propeller: [2, 3], gear: [4, 5] };
}
{
  // The light plane, 2.75 higher (its fin up to the portrait keyline), on struts 3 long down to its
  // float, 3 over the water: the belly 3 clear of the float, where 2.25 ran them together at 18 px.
  // (Drawn smaller instead, its fin's hole split at bold and its spinner fell under 2.)
  const { body, wing, spinner, prop } = lightPlane(-2.75);
  const float = roundpoly(
    [
      [5, 14.75],
      [17.75, 14.75],
      [16.25, 17.25],
      [6, 17.25],
    ],
    [0.75, 0.75, 1.25, 1.25],
  );
  const struts = [11, 15].map((x) => line([x, 11.75], [x, 14.75]));
  const water = 'M5.85 21.5c1.55 0 1.55-1.25 3.08-1.25s1.55 1.25 3.08 1.25 1.55-1.25 3.09-1.25 1.55 1.25 3.08 1.25';
  const d = [body, wing, spinner, prop, ...struts, float, water];
  put('seaplane', ['hidroavión', 'amerizaje', 'traslado a islas', 'seaplane', 'floatplane', 'water landing'], d);
  FILL.seaplane = { solid: [body, wing, float], wire: [spinner, prop, ...struts], lines: [water] };
  PARTS.seaplane = { fuselage: [0], wing: [1], propeller: [2, 3], float: [4, 5, 6], water: [7] };
}
{
  // Top view, nose up: a short pod and boom under very long, thin wings that taper to round tips
  // (straight wings as long as the fuselage read as any light plane), and the T-tail.
  const pod = sq(10.25, 5, 3.5, 8, 1.75);
  const wingL = roundline(
    [
      [10.25, 7.75],
      [2.5, 8.75],
      [2.5, 10.75],
      [10.25, 10.75],
    ],
    [0, 1, 1, 0],
  );
  const wingR = flipPath(wingL);
  const boom = line([12, 13], [12, 18.25]);
  const stab = line([9, 18.25], [15, 18.25]);
  const d = [pod, wingL, wingR, boom, stab];
  put('glider', ['planeador', 'vuelo sin motor', 'vuelo a vela', 'glider', 'sailplane', 'soaring'], d);
  FILL.glider = { solid: [pod, shut(wingL), shut(wingR)], wire: [boom, stab] };
  PARTS.glider = { fuselage: [0, 3], wings: [1, 2], tail: [4] };
}
{
  // The cabin with its front window, the tail boom and its rotor, the main rotor on its mast, skids.
  const cabin = sq(8.75, 7.75, 11.5, 8, 4);
  const window = roundline(
    [
      [14.75, 7.75],
      [14.75, 11.75],
      [20.25, 11.75],
    ],
    [0, 0.75, 0],
  );
  const boom = line([8.75, 10.75], [5.5, 10.75]);
  const tailRotor = circ(3.75, 10.75, 1.75);
  const mast = line([13, 7.75], [13, 4.75]);
  const rotor = line([3.75, 4.75], [21.25, 4.75]);
  const legs = [line([11.5, 15.75], [11.25, 18.75]), line([17, 15.75], [17.25, 18.75])];
  const skid = roundline(
    [
      [8.75, 18.75],
      [19.25, 18.75],
      [21, 17],
    ],
    [0, 1, 0],
  );
  const d = [cabin, window, boom, tailRotor, mast, rotor, ...legs, skid];
  put('helicopter', ['helicóptero', 'traslado aéreo', 'tour en helicóptero', 'helicopter', 'heli transfer', 'chopper'], d);
  FILL.helicopter = { solid: [cabin, tailRotor], cut: [window], wire: [boom, mast, rotor, ...legs, skid] };
  PARTS.helicopter = { cabin: [0, 1], tail: [2, 3], rotor: [4, 5], skids: [6, 7, 8] };
}
{
  // The envelope tapers into its neck; a gore down its middle; the ropes and the basket.
  const env = 'M10.25 15.75C8.75 14.5 5.25 12.5 5.25 9A6.75 6.75 0 0 1 18.75 9C18.75 12.5 15.25 14.5 13.75 15.75Z';
  const gore = 'M12 2.25C10.1 4.4 9 6.7 9 9.25S10.25 12.75 12 13.25C13.75 12.75 15 11.8 15 9.25S13.9 4.4 12 2.25Z';
  const ropes = [line([10.25, 15.75], [10, 18.25]), line([13.75, 15.75], [14, 18.25])];
  const basket = sq(9.25, 18.25, 5.5, 3, 1, SQ);
  const d = [env, gore, ...ropes, basket];
  put('hot-air-balloon', ['globo aerostático', 'vuelo en globo', 'experiencia', 'hot-air balloon', 'balloon ride', 'adventure'], d);
  FILL['hot-air-balloon'] = { solid: [env, basket], cut: [gore], wire: ropes };
  PARTS['hot-air-balloon'] = { envelope: [0, 1], ropes: [2, 3], basket: [4] };
}
{
  // The envelope, the cross tail at its back (the upper and lower fins) and the gondola under it.
  const [cx, cy, rx, ry] = [13, 11.25, 8.25, 4.25];
  const env = ellipse(cx, cy, rx, ry);
  const upFin = roundline(
    [
      [8.5, ellipseY(cx, cy, rx, ry, 8.5, -1)],
      [3.5, 4.5],
      [2.75, 5.75],
      [5.25, ellipseY(cx, cy, rx, ry, 5.25, -1)],
    ],
    [0, 0.6, 0.6, 0],
  );
  const lowFin = flipPath(upFin, 'y', cy);
  const gondola = roundline(
    [
      [10.75, ellipseY(cx, cy, rx, ry, 10.75, 1)],
      [10.75, 18.25],
      [15.25, 18.25],
      [15.25, ellipseY(cx, cy, rx, ry, 15.25, 1)],
    ],
    [0, 1, 1, 0],
  );
  const d = [env, upFin, lowFin, gondola];
  put('airship', ['dirigible', 'zepelín', 'publicidad aérea', 'airship', 'blimp', 'zeppelin'], d);
  FILL.airship = { solid: [env, shut(upFin), shut(lowFin), shut(gondola)] };
  PARTS.airship = { envelope: [0], fins: [1, 2], gondola: [3] };
}

// ── Flight status: lugares's plane with the engine's badges ──
for (const [name, kind, tags] of [
  ['plane-check', 'check', ['vuelo a tiempo', 'vuelo confirmado', 'reserva', 'on time', 'flight confirmed', 'booked']],
  ['plane-x', 'x', ['vuelo cancelado', 'cancelación', 'sin vuelo', 'flight cancelled', 'cancellation', 'cancelled']],
  ['plane-clock', 'clock', ['vuelo retrasado', 'demora', 'retraso', 'flight delayed', 'delay', 'late']],
  ['plane-alert', 'alert', ['interrupción', 'aviso de vuelo', 'incidencia', 'flight disruption', 'travel advisory', 'irregular operations']],
  ['plane-search', 'search', ['buscar vuelos', 'búsqueda de vuelos', 'vuelos', 'search flights', 'flight search', 'find flights']],
])
  put(name, tags, [PLANE], { badge: badge(kind) });
{
  // Dispositivos's wifi (the dot and two arcs, 3 apart) in the badge's place, cut out of the plane
  const c = [17.25, 20.5];
  const arcs = [3.25, 6.25].map((r) => arc(...c, r, 228, 312).d);
  const fan = dot(...c, 0.7);
  const knock = `M${pt(add(c, [0, 1.6]))}L${pt(add(polar(...c, 6.25, 228), [-0.3, 0.6]))}${arc(...c, 6.25, 228, 312).d.replace(/^M[^A]*/, '')}L${pt(add(c, [0, 1.6]))}Z`;
  put('plane-wifi', ['wifi a bordo', 'internet en vuelo', 'conectividad', 'in-flight wifi', 'onboard internet', 'connectivity'], [PLANE], { badge: own([fan, ...arcs], knock) });
}

// ── Flight arcs ──
{
  const f = flight(15.5);
  const ends = f.ends.map((p) => dot(...p, END));
  put('flight-nonstop', ['vuelo directo', 'sin escalas', 'directo', 'nonstop', 'direct flight', 'no stops'], [f.d, ...ends]);
  PARTS['flight-nonstop'] = { route: [0], ends: [1, 2] };
}
{
  // The ring at the peak: the arc runs into it from both sides
  const f = flight(15.5);
  const R = 2;
  const da = (Math.asin(R / f.r) * 180 * 2) / Math.PI / 2;
  const d = [arc(...f.c, f.r, f.a0, 270 - da).d, arc(...f.c, f.r, 270 + da, f.a1).d, circ(12, f.c[1] - f.r, R), ...f.ends.map((p) => dot(...p, END))];
  put('flight-layover', ['escala', 'conexión', 'transbordo', 'layover', 'connection', 'stopover'], d);
  PARTS['flight-layover'] = { route: [0, 1], stop: [2], ends: [3, 4] };
}
{
  // Out on the upper arc, back on the lower one: each carries its arrowhead at its peak
  const up = flight(12, 4.5);
  const down = flipPath(up.d, 'y', 12);
  const top = up.at(0.5).p;
  const heads = [head(add(top, [1, 0]), [1, 0], 3.4), head([11, 24 - top[1]], [-1, 0], 3.4)];
  const d = [up.d, heads[0], down, heads[1], ...up.ends.map((p) => dot(...p, END))];
  put('flight-round-trip', ['ida y vuelta', 'viaje redondo', 'regreso', 'round trip', 'return flight', 'trip type'], d);
  PARTS['flight-round-trip'] = { out: [0, 1], back: [2, 3], ends: [4, 5] };
}
{
  // Two hops across three dots, the second the longer; it lands, arrowed, short of the last one (its arrowhead
  // follows the hop's chord over its last 2.4, so the inner arm stays clear of the curve)
  const y = 14.25;
  const xs = [3.5, 11, 20.5];
  const hop = (x0, x1) => {
    const h = (x1 - x0) / 2;
    const s = h * 0.75;
    const r = (h * h + s * s) / (2 * s);
    const half = (Math.asin(h / r) * 180) / Math.PI;
    return { c: [(x0 + x1) / 2, y - s + r], r, half };
  };
  const [a, b] = [hop(xs[0], xs[1]), hop(xs[1], xs[2])];
  let stop = 270 + b.half;
  while (len(sub(polar(...b.c, b.r, stop), [xs[2], y])) < 3.85) stop -= 0.1;
  const end = polar(...b.c, b.r, stop);
  const back = polar(...b.c, b.r, stop - (2.4 / b.r) * (180 / Math.PI));
  const d = [arc(...a.c, a.r, 270 - a.half, 270 + a.half).d, arc(...b.c, b.r, 270 - b.half, stop).d, head(end, sub(end, back), 3.4), ...xs.map((x) => dot(x, y, END))];
  put('flight-multi-city', ['multidestino', 'varias ciudades', 'itinerario', 'multi-city', 'itinerary', 'open jaw'], d);
  PARTS['flight-multi-city'] = { route: [0, 1], arrow: [2], ends: [3, 4, 5] };
}
{
  // Bound for the right dot, the arc bends off past its peak and lands, arrowed, on a lower one
  const f = flight(13.25);
  const bend = f.at(0.5);
  const turnR = 4;
  // A tighter arc that leaves the flight arc at `bend` with the same heading, turning down
  const n = [-bend.dir[1], bend.dir[0]];
  const c = add(bend.p, mul(n, turnR));
  const a0 = (Math.atan2(bend.p[1] - c[1], bend.p[0] - c[0]) * 180) / Math.PI;
  const off = arc(...c, turnR, a0, a0 + 100);
  const land = add(off.end, mul(off.tangent, 4.1));
  // The arrowhead follows the curve's chord over its last 2.4, so its inner arm stays clear of it
  const back = polar(...c, turnR, a0 + 100 - (2.4 / turnR) * (180 / Math.PI));
  const d = [arc(...f.c, f.r, f.a0, bend.a).d, off.d, head(off.end, sub(off.end, back), 3.4), ...f.ends.map((p) => dot(...p, END)), dot(...land, END)];
  put('flight-diverted', ['vuelo desviado', 'desvío', 'otro aeropuerto', 'diverted flight', 'diversion', 'rerouted'], d);
  PARTS['flight-diverted'] = { route: [0, 1], arrow: [2], ends: [3, 4, 5] };
}
{
  // Lugares's moon, small, in the sky over the arc's right shoulder: centered over its middle, the
  // moon and the arc read as a person's head and shoulders
  const f = flight(19.25);
  const moon = transform(L.moon.d[0], 0.42, 17 - 11.5 * 0.42, 6.25 - 12.5 * 0.42);
  const d = [f.d, ...f.ends.map((p) => dot(...p, END)), moon];
  put('flight-overnight', ['vuelo nocturno', 'vuelo de noche', 'red-eye', 'overnight flight', 'red-eye flight', 'night flight'], d);
  FILL['flight-overnight'] = { solid: [moon], wire: d.slice(0, 3) };
  PARTS['flight-overnight'] = { route: [0], ends: [1, 2], moon: [3] };
}
{
  // Flown so far: a dotted climb from its first dot, the plane at the head heading along it. Three
  // dots 4 apart and the plane's center 8.75 past the last one, so its tail stands as far from that
  // dot as the dots from each other (a fourth dot ran into the tail)
  const c = [15.75, 22.5];
  const r = 12.75;
  const step = (4 / r) * (180 / Math.PI);
  const [from, to] = [200, 200 + 2 * step];
  const dots = [];
  for (let a = from; a <= to + 0.01; a += step) dots.push(dot(...polar(...c, r, a)));
  const tipA = to + (8.75 / r) * (180 / Math.PI);
  const tip = polar(...c, r, tipA);
  const heading = tipA + 90 + 90;
  const plane = mini(tip, 1.2, heading);
  const d = [...dots, ...plane];
  put('flight-path', ['ruta de vuelo', 'vuelo en curso', 'seguimiento', 'flight path', 'live tracking', 'in flight'], d);
  PARTS['flight-path'] = { route: dots.map((_, i) => i), plane: plane.map((_, i) => i + dots.length) };
}
{
  // The airliner, smaller and higher, over two jagged lines 3.75 apart (3 across their slopes)
  const k = 0.78;
  const [tx, ty] = [12 - k * 12.125, 2.75 - k * 5.25];
  const body = transform(AIRLINER.body, k, tx, ty);
  const wing = transform(AIRLINER.wingLine, k, tx, ty);
  const zig = (x0, y, n = 4, h = 2, a = 0.75) => line(...Array.from({ length: n + 1 }, (_, i) => [x0 + i * h, y + (i % 2 ? -a : a)]));
  const bumps = [zig(6, 16.75), zig(10, 20.5)];
  const d = [body, wing, ...bumps];
  put('turbulence', ['turbulencia', 'vuelo movido', 'zona de turbulencia', 'turbulence', 'bumpy flight', 'rough air'], d);
  FILL.turbulence = { solid: [body], wire: [wing], lines: bumps };
  PARTS.turbulence = { plane: [0, 1], bumps: [2, 3] };
}
{
  // The globe of the globe-* badges (sistema's globe-lock) with the plane in the badge's place: the
  // plane as its center lines, its wing tips on the badge's ring, and the engine clears the ring
  const GLOBE = sistema.icons['globe-lock'].d;
  const plane = mini([BC[0] + 0.74, BC[1] - 0.74], 1, 45);
  put('globe-plane', ['vuelos internacionales', 'volar por el mundo', 'internacional', 'international flights', 'worldwide', 'fly abroad'], GLOBE, {
    badge: own(plane, clockwise(BC, 4.25)),
  });
  FILL['globe-plane'] = { solid: [GLOBE[0]], cut: [GLOBE[1], GLOBE[2]] };
  PARTS['globe-plane'] = { globe: [0, 1, 2] };
}
{
  // Lugares's pin with the plane in its head, as map-pin-medical carries its cross
  const pin = L['map-pin'].d[0];
  const k = 0.9;
  const plane = mini([12 + 0.74 * k, 10.25 - 0.74 * k], k, 45);
  put('map-pin-plane', ['aeropuerto cercano', 'aeropuertos', 'ubicación del aeropuerto', 'nearest airport', 'nearby airports', 'airport map'], [pin, ...plane]);
  FILL['map-pin-plane'] = { solid: [pin], cut: plane };
  PARTS['map-pin-plane'] = { pin: [0], plane: [1, 2, 3] };
}

// ── The airport ──
/** The control tower: the flat cap, the glass cab leaning out, its mullion and the slender shaft. */
const TOWER = {
  cap: roundline(
    [
      [8.75, 6.5],
      [8.75, 3.25],
      [15.25, 3.25],
      [15.25, 6.5],
    ],
    [0, 1, 1, 0],
  ),
  cab: roundpoly(
    [
      [5, 6.5],
      [19, 6.5],
      [16.5, 11.75],
      [7.5, 11.75],
    ],
    [1, 1, 0.75, 0.75],
  ),
  mullion: line([12, 6.5], [12, 11.75]),
  shaft: roundline(
    [
      [10, 11.75],
      [9, 21.25],
      [15, 21.25],
      [14, 11.75],
    ],
    [0, 0.75, 0.75, 0],
  ),
};
{
  const { cap, cab, mullion, shaft } = TOWER;
  put('control-tower', ['torre de control', 'control aéreo', 'controlador', 'control tower', 'air traffic control', 'atc'], [cap, cab, mullion, shaft]);
  FILL['control-tower'] = { solid: [shut(cap), cab, shut(shaft)], cut: [mullion] };
  PARTS['control-tower'] = { cab: [0, 1, 2], shaft: [3] };
}
{
  // The control tower, smaller, standing on the left end of the terminal's roof; the terminal's
  // glass front in panes (square bottom-right corner)
  const k = 0.62;
  const [tx, ty] = [7.5 - 12 * k, 3.25 - 3.25 * k];
  const [cap, cab, shaft] = [TOWER.cap, TOWER.cab, TOWER.shaft].map((p) => transform(p, k, tx, ty));
  const roof = ty + 21.25 * k;
  const hall = sq(2.75, roof, 18.5, 20.75 - roof, 2, SQ);
  const panes = [12.25, 15.25, 18.25].map((x) => line([x, roof], [x, 20.75]));
  const d = [cap, cab, shaft, hall, ...panes];
  put('airport', ['aeropuerto', 'terminal', 'traslado al aeropuerto', 'airport', 'terminal building', 'airport transfer'], d);
  FILL.airport = { solid: [shut(cap), cab, shut(shaft), hall], cut: panes };
  PARTS.airport = { tower: [0, 1, 2], terminal: [3, 4, 5, 6] };
}
{
  // The strip in perspective, open to the horizon; two center dashes and the threshold bars on its
  // near end
  const far = [8.75, 15.25];
  const [yF, yN] = [3.25, 20.75];
  const strip = line([far[0], yF], [2.75, yN], [21.25, yN], [far[1], yF]);
  const dashes = [line([12, 6.25], [12, 8.25]), line([12, 11.25], [12, 14])];
  const bars = [7.5, 10.35, 13.65, 16.5].map((x) => line([x, 17.75], [x, yN]));
  const d = [strip, ...dashes, ...bars];
  put('runway', ['pista', 'pista de aterrizaje', 'aeródromo', 'runway', 'airstrip', 'airfield'], d);
  FILL.runway = { solid: [`${strip}Z`], cut: [...dashes, ...bars] };
  PARTS.runway = { strip: [0], marks: [1, 2, 3, 4, 5, 6] };
}
{
  // The arched hall and its tall doors, split down the middle
  const arch = 'M2.75 20.75V13A9.25 8.25 0 0 1 21.25 13V20.75Z';
  const doors = roundline(
    [
      [6.75, 20.75],
      [6.75, 11.75],
      [17.25, 11.75],
      [17.25, 20.75],
    ],
    [0, 0.75, 0.75, 0],
  );
  const split = line([12, 11.75], [12, 20.75]);
  put('hangar', ['hangar', 'mantenimiento', 'nave de aviones', 'hangar', 'aircraft maintenance', 'aircraft storage'], [arch, doors, split]);
  FILL.hangar = { solid: [arch], cut: [doors, split] };
  PARTS.hangar = { hall: [0], doors: [1, 2] };
}
{
  // The flight of steps rising to the platform, its handrail 3 above the treads, on the truck's bed
  // and its two wheels
  const [bed, top, x0, n] = [16, 6.75, 4.5, 4];
  const rise = (bed - top) / n;
  const run = 2.25;
  const pts = [
    [20.25, top],
    [20.25, bed],
    [x0, bed],
  ];
  for (let i = 0; i < n; i++) {
    const [x, y] = [x0 + i * run, bed - (i + 1) * rise];
    pts.push([x, y]);
    if (i < n - 1) pts.push([x + run, y]);
  }
  const stairs = roundpoly(pts, pts.map((_, i) => (i < 3 ? 0.6 : 0.35)));
  const slope = rise / run;
  const lift = 3 * Math.hypot(1, slope);
  const railY = 3.25;
  const start = [x0, bed - rise - lift];
  const rail = roundline([start, [x0 + (start[1] - railY) / slope, railY], [20.25, railY], [20.25, top]], [0, 1, 0.75, 0]);
  const chassis = line([2.75, bed], [21.25, bed]);
  const wheels = [circ(6.5, 17.75, 1.75), circ(17.5, 17.75, 1.75)];
  const d = [stairs, rail, chassis, ...wheels];
  put('airstairs', ['escalerilla', 'embarque en plataforma', 'posición remota', 'airstairs', 'boarding stairs', 'remote stand'], d);
  FILL.airstairs = { solid: [stairs, ...wheels], wire: [rail, chassis] };
  PARTS.airstairs = { stairs: [0, 1], truck: [2, 3, 4] };
}

// ── The gate and the boards ──
/** The boarding gate: an open doorway seen head-on, its sign panel and the floor running out. */
const GATE = {
  sign: sq(4.25, 3.25, 10, 3.75, 1.25, SQ),
  door: roundline(
    [
      [4.25, 20.75],
      [4.25, 9.85],
      [14.25, 9.85],
      [14.25, 20.75],
    ],
    [0, 1.25, 1.25, 0],
  ),
  floor: line([2.75, 20.75], [21.25, 20.75]),
};
put('boarding-gate', ['puerta de embarque', 'sala de abordar', 'ir a la puerta', 'boarding gate', 'gate', 'go to gate'], [GATE.sign, GATE.door, GATE.floor]);
put('boarding-gate-sync', ['cambio de puerta', 'nueva puerta', 'aviso de puerta', 'gate change', 'new gate', 'gate update'], [GATE.sign, GATE.door, GATE.floor], { badge: badge('sync') });
for (const name of ['boarding-gate', 'boarding-gate-sync']) {
  FILL[name] = { solid: [GATE.sign], wire: [GATE.door, GATE.floor] };
  PARTS[name] = { sign: [0], door: [1], floor: [2] };
}
{
  // The screen hangs from two cables; its first two rows start after the arrow (drawn once, pointing
  // up and right, and mirrored for the arrivals)
  const screen = sq(2.5, 5.25, 19, 14.75, 3.5, SQ);
  const cables = [line([7.5, 2.75], [7.5, 5.25]), line([16.5, 2.75], [16.5, 5.25])];
  const rows = [line([13.75, 9.25], [17.75, 9.25]), line([13.75, 12.75], [17.75, 12.75]), line([6.25, 16.5], [17.75, 16.5])];
  const up = [line([6.25, 13.25], [10.75, 8.75]), head([10.75, 8.75], [1, -1], 3)];
  const down = up.map((p) => flipPath(p, 'y', 11));
  for (const [name, arrow, tags] of [
    ['departures-board', up, ['salidas', 'pantalla de salidas', 'vuelos de salida', 'departures', 'departures board', 'outgoing flights']],
    ['arrivals-board', down, ['llegadas', 'pantalla de llegadas', 'vuelos de llegada', 'arrivals', 'arrivals board', 'incoming flights']],
  ]) {
    const d = [screen, ...cables, ...arrow, ...rows];
    put(name, tags, d);
    FILL[name] = { solid: [screen], wire: cables, cut: [...arrow, ...rows] };
    PARTS[name] = { screen: [0], cables: [1, 2], arrow: [3, 4], rows: [5, 6, 7] };
  }
}
{
  // A deep armchair seen from the side, its arm, and the side table with a cup
  const chair = roundpoly(
    [
      [2.75, 5.75],
      [6.25, 5.75],
      [7.25, 12.5],
      [12.75, 12.5],
      [12.75, 19.75],
      [3.75, 19.75],
    ],
    [1.25, 1.25, 1, 1.25, 1.25, 1.25],
  );
  const arm = line([6.75, 9.5], [12.25, 9.5]);
  const tableTop = line([15.75, 14], [21.25, 14]);
  const foot = line([16, 19.75], [21, 19.75]);
  const cup = roundline(
    [
      [16.75, 10.25],
      [16.75, 14],
      [20.25, 14],
      [20.25, 10.25],
    ],
    [0, 1.1, 1.1, 0],
  );
  const pedestal = line([18.5, 14], [18.5, 19.75]);
  const d = [chair, arm, tableTop, pedestal, foot, cup];
  put('airport-lounge', ['sala vip', 'salón de aeropuerto', 'acceso a sala', 'airport lounge', 'lounge access', 'vip lounge'], d);
  FILL['airport-lounge'] = { solid: [chair, shut(cup)], wire: [arm, tableTop, pedestal, foot] };
  PARTS['airport-lounge'] = { chair: [0, 1], table: [2, 3, 4], cup: [5] };
}
{
  // The airliner on the ground, the flake over its tail and the spray falling on it in an arc
  const k = 0.72;
  const [tx, ty] = [12.5 - k * 12.125, 20.75 - k * 18.75];
  const body = transform(AIRLINER.body, k, tx, ty);
  const wing = transform(AIRLINER.wingLine, k, tx, ty);
  const flake = [90, 150, 210].map((a) => line(polar(6.25, 5.5, 2.5, a), polar(6.25, 5.5, 2.5, a + 180)));
  const spray = [
    [19.75, 3.5],
    [18, 6.75],
    [16.75, 10.25],
  ].map((p) => dot(...p));
  const d = [body, wing, ...flake, ...spray];
  put('deicing', ['deshielo', 'descongelar', 'antihielo', 'de-icing', 'deicing', 'winter delay'], d);
  FILL.deicing = { solid: [body, ...spray], wire: [wing], lines: flake };
  PARTS.deicing = { plane: [0, 1], flake: [2, 3, 4], spray: [5, 6, 7] };
}

// ── Boarding passes ──
/**
 * The boarding pass: a landscape pass (square bottom-right corner), the stub's tear line at 15.25
 * (two dashes kept clear of the badge's clearance) and the plane across the main part (its center
 * lines, nose right). A barcode bar on the stub was dropped: cut by the badge it left a sliver.
 */
const PASS = {
  card: sq(2.5, 5, 19, 14, 3.5, SQ),
  tear: [line([15.25, 7.85], [15.25, 9.85]), line([15.25, 14.15], [15.25, 16.15])],
  plane: mini([8.75, 12], 0.9, 90),
};
const PASS_D = [PASS.card, ...PASS.tear, ...PASS.plane];
put('boarding-pass', ['pase de abordar', 'tarjeta de embarque', 'mis viajes', 'boarding pass', 'flight ticket', 'my trips'], PASS_D);
put('boarding-pass-check', ['check-in hecho', 'pase emitido', 'documentado', 'checked in', 'pass issued', 'ready to board'], PASS_D, { badge: badge('check') });
for (const name of ['boarding-pass', 'boarding-pass-check']) {
  FILL[name] = { solid: [PASS.card], cut: PASS_D.slice(1) };
  PARTS[name] = { pass: [0], tear: [1, 2], plane: [3, 4, 5] };
}
{
  // The phone (dispositivos's, narrower, to the left) with the pass sliding out past its right edge,
  // in front and down to its foot: the plane on its main part and the stub's tear line
  const phone = [sq(2.75, 2.75, 9.5, 18.5, 3, SQ), line([6, 5.75], [9, 5.75])];
  const card = sq(6.75, 9.25, 14.5, 12, 2.5, SQ);
  const k = 0.87;
  const plane = mini([12.25 + 0.74 * k, 15.25 - 0.74 * k], k, 45);
  const tear = line([18.25, 12.1], [18.25, 18.4]);
  put('boarding-pass-mobile', ['pase móvil', 'pase en el celular', 'pase digital', 'mobile boarding pass', 'digital pass', 'wallet pass'], phone, {
    badge: own([card, ...plane, tear], card, { solid: [card], cut: [...plane, tear] }),
  });
  FILL['boarding-pass-mobile'] = { solid: [phone[0]], cut: [phone[1]] };
  PARTS['boarding-pass-mobile'] = { phone: [0, 1] };
}
{
  // Sistema's scan corners around the pass, smaller: its outline and the plane on it
  const SCAN = sistema.icons.scan.d[0];
  const card = sq(6.25, 6.5, 11.5, 11, 2, SQ);
  const k = 0.87;
  const plane = mini([12 + 0.74 * k, 12 - 0.74 * k], k, 45);
  const d = [SCAN, card, ...plane];
  put('boarding-pass-scan', ['escanear pase', 'lector de pases', 'abordar', 'scan boarding pass', 'gate scanner', 'boarding scan'], d);
  FILL['boarding-pass-scan'] = { solid: [card], cut: plane, wire: [SCAN] };
  PARTS['boarding-pass-scan'] = { frame: [0], pass: [1, 2, 3, 4] };
}

// ── Check-in and security ──
{
  // The counter from the front: the desk with its monitor, the scale lower at its right end and a
  // suitcase standing on it, as wide as it is tall (narrower, it read as a bottle)
  const counter = roundpoly(
    [
      [2.75, 12.25],
      [12, 12.25],
      [12, 17],
      [21.25, 17],
      [21.25, 20.75],
      [2.75, 20.75],
    ],
    [1.25, 1, 0, 1, 0, 1.25],
  );
  const monitor = sq(4, 4.75, 6.5, 4.75, 1.25, SQ);
  const stand = line([7.25, 9.5], [7.25, 12.25]);
  const bag = sq(14.85, 10.5, 6.4, 6.5, 1.6, SQ);
  const handle = roundline(
    [
      [16.4, 10.5],
      [16.4, 8],
      [19.7, 8],
      [19.7, 10.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  const d = [counter, monitor, stand, bag, handle];
  put('check-in-counter', ['mostrador', 'documentación', 'check-in', 'check-in counter', 'ticketing', 'check-in desk'], d);
  FILL['check-in-counter'] = { solid: [counter, monitor, bag], wire: [stand, handle] };
  PARTS['check-in-counter'] = { counter: [0], monitor: [1, 2], bag: [3, 4] };
}
{
  // The kiosk's head (its screen tilted back, a trapezoid) and the printer slot, on a pedestal
  const head = roundpoly(
    [
      [5.75, 2.75],
      [18.25, 2.75],
      [17.5, 16.5],
      [6.5, 16.5],
    ],
    [2, 2, 0, 1.5],
  );
  const screen = roundpoly(
    [
      [9, 5.6],
      [15, 5.6],
      [15.75, 10.6],
      [8.25, 10.6],
    ],
    [1, 1, 1, 1],
  );
  const slot = line([9.5, 13.5], [14.5, 13.5]);
  const pedestal = roundline(
    [
      [10.25, 16.5],
      [10.25, 21.25],
      [13.75, 21.25],
      [13.75, 16.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  const d = [head, screen, slot, pedestal];
  put('check-in-kiosk', ['autoservicio', 'quiosco', 'imprimir pase', 'check-in kiosk', 'self check-in', 'self-service'], d);
  FILL['check-in-kiosk'] = { solid: [head, shut(pedestal)], cut: [screen, slot] };
  PARTS['check-in-kiosk'] = { kiosk: [0, 3], screen: [1], slot: [2] };
}
{
  // The bag over a short belt and the arrow down into it
  const bag = sq(4.5, 6.25, 9, 8.25, 2.25, SQ);
  const handle = roundline(
    [
      [7.1, 6.25],
      [7.1, 3.5],
      [10.9, 3.5],
      [10.9, 6.25],
    ],
    [0, 0.75, 0.75, 0],
  );
  const arrow = [line([18.75, 4], [18.75, 14.5]), head([18.75, 14.5], [0, 1], 3.25)];
  const belt = capsule(2.75, 17.5, 18.5, 3.5);
  const d = [bag, handle, ...arrow, belt];
  put('baggage-drop', ['entrega de equipaje', 'documentar maleta', 'bag drop', 'baggage drop', 'drop off bag', 'checked bag'], d);
  FILL['baggage-drop'] = { solid: [bag, belt], wire: [handle], lines: arrow };
  PARTS['baggage-drop'] = { bag: [0, 1], arrow: [2, 3], belt: [4] };
}
/**
 * The walk-through arch and a figure stepping through it: lugares's walker redrawn at this size so
 * its limbs keep their clearances (scaled down, they came within 2 of each other).
 */
const ARCH = roundline(
  [
    [3.5, 21.25],
    [3.5, 3.25],
    [20.5, 3.25],
    [20.5, 21.25],
  ],
  [0, 2.5, 2.5, 0],
);
const WALKER = [
  circ(10.9, 8, 1.85),
  line([10.45, 12.7], [9.55, 16.6]),
  roundline([[9.55, 16.6], [7.9, 18.75], [6.9, 21.25]], [0, 0.6, 0]),
  roundline([[9.55, 16.6], [11.5, 18.6], [13.4, 20.9]], [0, 0.6, 0]),
  roundline([[6.75, 15.4], [7.75, 13.4], [10.45, 12.7], [12.55, 14.6], [14.55, 15.4]], [0, 0.6, 0.6, 0.6, 0]),
];
put('security-screening', ['control de seguridad', 'detector de metales', 'filtro de seguridad', 'security check', 'metal detector', 'security screening'], [ARCH, ...WALKER]);
put('security-screening-clock', ['tiempo de espera', 'fila de seguridad', 'espera en control', 'security wait time', 'queue time', 'wait time'], [ARCH, ...WALKER], { badge: badge('clock') });
for (const name of ['security-screening', 'security-screening-clock']) {
  FILL[name] = { solid: [WALKER[0]], wire: [ARCH, ...WALKER.slice(1)] };
  PARTS[name] = { arch: [0], person: [1, 2, 3, 4, 5] };
}
{
  // The scanner from the front: the housing with its mouth cut into the bottom edge (square
  // bottom-right corner), the bag going in and the strip curtain resting on its top
  const housing = roundpoly(
    [
      [3.25, 3.75],
      [20.75, 3.75],
      [20.75, 18.75],
      [17.75, 18.75],
      [17.75, 9.25],
      [6.25, 9.25],
      [6.25, 18.75],
      [3.25, 18.75],
    ],
    [3.5, 3.5, 0, 0, 1.25, 1.25, 0, 1.5],
  );
  const bag = sq(9, 14.25, 6, 4.5, 1, SQ);
  const strips = [10.5, 13.5].map((x) => line([x, 9.25], [x, 14.25]));
  const d = [housing, bag, ...strips];
  put('baggage-scanner', ['rayos x', 'escáner de equipaje', 'revisión de maletas', 'baggage scanner', 'x-ray', 'bag screening'], d);
  FILL['baggage-scanner'] = { solid: [housing, bag], wire: strips };
  PARTS['baggage-scanner'] = { housing: [0], bag: [1], curtain: [2, 3] };
}
{
  // The clear bag, its zip across the top and two small bottles inside, their shoulders tapering to
  // the neck
  const bag = sq(4.25, 4.25, 15.5, 16.25, 3.5, SQ);
  const zip = line([4.25, 8], [19.75, 8]);
  const w = 3.5;
  const bottle = (x) => [
    roundpoly(
      [
        [x, 17.65],
        [x, 14.75],
        [x + 1, 12.85],
        [x + w - 1, 12.85],
        [x + w, 14.75],
        [x + w, 17.65],
      ],
      [1.25, 0.6, 0.4, 0.4, 0.6, 1.25],
    ),
    line([x + w / 2, 10.85], [x + w / 2, 12.85]),
  ];
  const d = [bag, zip, ...bottle(7.25), ...bottle(13.25)];
  put('liquids-bag', ['líquidos', 'bolsa de líquidos', '100 ml', 'liquids bag', 'liquids rule', 'toiletries bag'], d);
  FILL['liquids-bag'] = { solid: [bag], cut: d.slice(1) };
  PARTS['liquids-bag'] = { bag: [0, 1], bottles: [2, 3, 4, 5] };
}

// ── Baggage ──
{
  // The carousel's belt sweeping across the bottom (the near side of its oval), its slats, and a bag
  // standing on it, in front: the engine clears the belt's edge under it
  const sag = 2.5;
  const r = (9.25 ** 2 + sag * sag) / (2 * sag);
  const yc = 15.5 - Math.sqrt(r * r - 9.25 ** 2);
  const topY = (x) => yc + Math.sqrt(r * r - (x - 12) ** 2);
  const belt = `M2.75 15.5A${N(r)} ${N(r)} 0 0 0 21.25 15.5L21.25 18.75A${N(r)} ${N(r)} 0 0 1 2.75 18.75Z`;
  const slats = [5.75, 18.25].map((x) => line([x, topY(x)], [x, topY(x) + 3.25]));
  const bag = sq(8, 8.5, 8, 8.75, 2, SQ);
  const handle = roundline(
    [
      [10.25, 8.5],
      [10.25, 5.75],
      [13.75, 5.75],
      [13.75, 8.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  put('baggage-claim', ['recoger equipaje', 'banda de equipaje', 'llegadas', 'baggage claim', 'carousel', 'bag pickup'], [belt, ...slats], {
    badge: own([bag, handle], `${bag}${clockwise([12, 7.1], 1.5)}`, { solid: [bag], wire: [handle] }),
  });
  FILL['baggage-claim'] = { solid: [belt], cut: [5.75, 18.25].map((x) => line([x, topY(x) - 1], [x, topY(x) + 4.25])) };
  PARTS['baggage-claim'] = { belt: [0, 1, 2] };
}
{
  // The trolley in side view: an upright post with the push handle bent back at its top (leaning
  // back, it read as a shopping cart), the bed along its foot with its front lip, a suitcase standing
  // on the bed and two wheels under it
  const frame = roundline(
    [
      [2.75, 3.75],
      [6, 3.75],
      [6, 16.75],
      [19.25, 16.75],
      [21.25, 14.5],
    ],
    [0, 1, 1, 1, 0],
  );
  const bag = sq(9, 7.75, 8.25, 9, 1.75, SQ);
  const handle = roundline(
    [
      [11.25, 7.75],
      [11.25, 5],
      [14.75, 5],
      [14.75, 7.75],
    ],
    [0, 0.75, 0.75, 0],
  );
  const wheels = [circ(8.75, 18.75, 1.75), circ(17, 18.75, 1.75)];
  const d = [frame, bag, handle, ...wheels];
  put('baggage-trolley', ['carrito de equipaje', 'carrito', 'maletas', 'baggage trolley', 'luggage cart', 'trolley'], d);
  FILL['baggage-trolley'] = { solid: [bag, ...wheels], wire: [frame, handle] };
  PARTS['baggage-trolley'] = { trolley: [0, 3, 4], bag: [1, 2] };
}
/**
 * The bag tag: the long strip (its top end tapered, its bottom-right corner square), the loop of
 * strap folded through its top end, and two barcode bars on its free end.
 */
const TAG = {
  strip: roundpoly(
    [
      [9, 7.5],
      [12.5, 7.5],
      [15.1, 9.25],
      [15.1, 21.25],
      [6.4, 21.25],
      [6.4, 9.25],
    ],
    [1, 1, 0.75, 0, 2, 0.75],
  ),
  loop: 'M10.75 11C7.75 8.75 7.75 2.75 10.75 2.75S13.75 8.75 10.75 11',
  bars: [line([9.25, 15.75], [9.25, 18.25]), line([12.25, 15.75], [12.25, 18.25])],
};
const TAG_D = [TAG.strip, TAG.loop, ...TAG.bars];
put('baggage-tag', ['etiqueta de equipaje', 'marbete', 'maleta documentada', 'baggage tag', 'bag tag', 'luggage label'], TAG_D);
put('baggage-tag-search', ['rastrear maleta', 'equipaje perdido', 'reclamo de equipaje', 'track bag', 'lost baggage', 'mishandled bag'], TAG_D, { badge: badge('search') });
for (const name of ['baggage-tag', 'baggage-tag-search']) {
  FILL[name] = { solid: [TAG.strip], wire: [TAG.loop], cut: TAG.bars };
  PARTS[name] = { tag: [0, 1], barcode: [2, 3] };
}
/** The carry-on standing in the sizer's open frame: its body, wheels and telescoping handle. */
const CARRY = {
  frame: roundline(
    [
      [3.25, 6.25],
      [3.25, 20.75],
      [20.75, 20.75],
      [20.75, 6.25],
    ],
    [0, 1.5, 0, 0],
  ),
  bag: sq(7, 8.5, 9, 9.5, 0.75, SQ),
  wheels: [line([9.25, 18], [9.25, 20.75]), line([13.75, 18], [13.75, 20.75])],
  handle: roundline(
    [
      [9.75, 8.5],
      [9.75, 4],
      [13.25, 4],
      [13.25, 8.5],
    ],
    [0, 0.75, 0.75, 0],
  ),
};
const CARRY_D = [CARRY.frame, CARRY.bag, CARRY.handle, ...CARRY.wheels];
put('carry-on', ['equipaje de mano', 'maleta de cabina', 'medidas permitidas', 'carry-on', 'cabin bag', 'size allowance'], CARRY_D);
put('carry-on-plus', ['agregar equipaje de mano', 'maleta extra', 'añadir a la tarifa', 'add carry-on', 'extra bag', 'add baggage'], CARRY_D, { badge: badge('plus') });
for (const name of ['carry-on', 'carry-on-plus']) {
  FILL[name] = { solid: [CARRY.bag], wire: [CARRY.handle, ...CARRY.wheels, CARRY.frame] };
  PARTS[name] = { sizer: [0], bag: [1, 2, 3, 4] };
}
{
  // The bag on the platform scale, the dial on its column at the right, its needle to the rim
  const platform = sq(2.75, 17.75, 18.5, 3, 1.25, SQ);
  const column = line([18, 17.75], [18, 10.25]);
  const dial = circ(18, 7, 3.25);
  const needle = line([18, 7], polar(18, 7, 3.25, -60));
  const bag = sq(3.75, 10.5, 9, 7.25, 2, SQ);
  const handle = roundline(
    [
      [6.5, 10.5],
      [6.5, 8],
      [10, 8],
      [10, 10.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  const d = [platform, column, dial, needle, bag, handle];
  put('baggage-weight', ['peso del equipaje', 'sobrepeso', 'báscula', 'baggage weight', 'overweight bag', 'weight allowance'], d);
  FILL['baggage-weight'] = { solid: [platform, dial, bag], cut: [needle], wire: [column, handle] };
  PARTS['baggage-weight'] = { scale: [0, 1, 2], needle: [3], bag: [4, 5] };
}

// ── The airline seat ──
/**
 * The airline seat in side view, facing right: the back (its headrest parted by a line) and the
 * cushion as one shell, the armrest, and the two legs. `tilt` reclines the back about its hinge
 * (degrees, negative leans it back); `dx` moves it sideways. Every seat icon is built from here.
 */
function seat({ tilt = 0, dx = 0 } = {}) {
  const C = [10.5, 11];
  const back = (p) => rot(p, C, tilt);
  const A = back([5.75, 3.25]);
  const B = back([9.5, 3.25]);
  const F = [7.5, 14];
  const shell = roundpoly([A, B, C, [18.25, 11], [18.25, 14], F], [1.5, 1.5, 0.75, 1.25, 1, 1.25]);
  const at = (a, b, y) => [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
  const headrest = line(back([6.28, 6.5]), back([9.92, 6.5]));
  const arm = line(at(B, C, 8), [15.5, 8]);
  const legs = [line([9, 14], [8.25, 20.75]), line([16.5, 14], [17.25, 20.75])];
  const move = (d) => (dx ? transform(d, 1, dx, 0) : d);
  return { shell: move(shell), headrest: move(headrest), arm: move(arm), legs: legs.map(move), hinge: [C[0] + dx, C[1]] };
}
const SEAT = seat();
const SEAT_D = [SEAT.shell, SEAT.headrest, SEAT.arm, ...SEAT.legs];
const SEAT_FILL = { solid: [SEAT.shell], cut: [SEAT.headrest], wire: [SEAT.arm, ...SEAT.legs] };
const SEAT_PARTS = { seat: [0, 1], arm: [2], legs: [3, 4] };
put('airline-seat', ['asiento', 'clase turista', 'asiento de avión', 'airline seat', 'economy', 'plane seat'], SEAT_D);
put('airline-seat-check', ['asiento elegido', 'asiento asignado', 'selección hecha', 'seat selected', 'seat assigned', 'seat confirmed'], SEAT_D, { badge: badge('check') });
put('airline-seat-arrow-up', ['mejora de asiento', 'subir de clase', 'upgrade', 'seat upgrade', 'upgrade', 'class upgrade'], SEAT_D, { badge: badge('arrow-up') });
for (const name of ['airline-seat', 'airline-seat-check', 'airline-seat-arrow-up']) {
  FILL[name] = SEAT_FILL;
  PARTS[name] = SEAT_PARTS;
}
{
  // The back reclined 20° about its hinge; the arm reaches the back again and the arrow sweeps,
  // in the room the back left, from upright to reclined
  const S = seat({ tilt: -20 });
  const r = 7.5;
  const sweep = arc(...S.hinge, r, -72, -95);
  const arrow = [sweep.d, head(sweep.end, sweep.tangent, 2)];
  const d = [S.shell, S.headrest, S.arm, ...S.legs, ...arrow];
  put('airline-seat-recline', ['reclinar', 'asiento reclinable', 'respaldo', 'seat recline', 'recline', 'lean back'], d);
  FILL['airline-seat-recline'] = { solid: [S.shell], cut: [S.headrest], wire: [S.arm, ...S.legs], lines: arrow };
  PARTS['airline-seat-recline'] = { seat: [0, 1], arm: [2], legs: [3, 4], arrow: [5, 6] };
}
{
  // Unfolded into a bed: the cushion runs flat to the foot, the headrest end stays raised
  const bed = roundpoly(
    [
      [2.75, 7.75],
      [6.25, 7.75],
      [8.25, 11],
      [21.25, 11],
      [21.25, 14],
      [3.75, 14],
    ],
    [1.25, 1.25, 0.75, 1, 1, 1.25],
  );
  const legs = [line([7, 14], [6.25, 20.75]), line([17.5, 14], [18.25, 20.75])];
  const d = [bed, ...legs];
  put('airline-seat-flat', ['cama plana', 'clase ejecutiva', 'asiento cama', 'lie-flat seat', 'business class', 'flat bed'], d);
  FILL['airline-seat-flat'] = { solid: [bed], wire: legs };
  PARTS['airline-seat-flat'] = { seat: [0], legs: [1, 2] };
}
{
  // The seat moved left; the back of the seat ahead and its rear leg at the right, and the
  // dimension arrow between the legs, at shin height
  const S = seat({ dx: -3 });
  const ahead = roundpoly(
    [
      [18.25, 3.25],
      [21.25, 3.25],
      [21.25, 14],
      [19.75, 14],
    ],
    [1.25, 1, 0, 0.75],
  );
  const aheadLeg = line([20.5, 14], [19.75, 20.75]);
  const y = 18.5;
  const legX = (a, b) => a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
  const [x0, x1] = [legX([13.5, 14], [14.25, 20.75]), legX([20.5, 14], [19.75, 20.75])];
  const span = [line([x0, y], [x1, y]), head([x0, y], [-1, 0], 2), head([x1, y], [1, 0], 2)];
  const d = [S.shell, S.headrest, S.arm, ...S.legs, ahead, aheadLeg, ...span];
  put('airline-seat-legroom', ['espacio para piernas', 'más espacio', 'asiento amplio', 'extra legroom', 'legroom', 'seat pitch'], d);
  FILL['airline-seat-legroom'] = { solid: [S.shell, ahead], cut: [S.headrest], wire: [S.arm, ...S.legs, aheadLeg, ...span] };
  PARTS['airline-seat-legroom'] = { seat: [0, 1], arm: [2], legs: [3, 4], ahead: [5, 6], span: [7, 8, 9] };
}
{
  // A small bag on the floor under the seat, in front of its front leg
  const bag = sq(12, 17, 8.5, 4.25, 1.6, SQ);
  put('personal-item', ['artículo personal', 'bajo el asiento', 'bolso de mano', 'personal item', 'under-seat bag', 'small bag'], SEAT_D, {
    badge: own([bag], bag, { solid: [bag] }),
  });
  FILL['personal-item'] = SEAT_FILL;
  PARTS['personal-item'] = SEAT_PARTS;
}
{
  // The seat, at three quarters (from its foot), beside the doorway's jamb and lintel; the arrow
  // leaves through the doorway over the seat, in front of the jamb (the engine opens the jamb around
  // it). At full size the arrow had to cross the seat and the engine cut its cushion and leg apart
  const S = seat({ dx: -3 });
  const k = 0.75;
  const small = (p) => transform(p, k, 2.75 * (1 - k), 20.75 * (1 - k));
  const [shell, headrest, arm, ...legs] = [S.shell, S.headrest, S.arm, ...S.legs].map(small);
  const jamb = roundline(
    [
      [16, 20.75],
      [16, 3.25],
      [21.25, 3.25],
    ],
    [0, 1.25, 0],
  );
  const y = 9;
  const arrow = [line([9.5, y], [20.5, y]), head([20.5, y], [1, 0], 2.75)];
  const knock = `M9.5 ${y}H20.5Z${arrow[1]}Z`;
  const d = [shell, headrest, arm, ...legs, jamb];
  put('exit-row', ['fila de emergencia', 'salida de emergencia', 'asiento junto a salida', 'exit row', 'emergency exit', 'exit seat'], d, {
    badge: own(arrow, knock),
  });
  FILL['exit-row'] = { solid: [shell], cut: [headrest], wire: [arm, ...legs], lines: [jamb] };
  PARTS['exit-row'] = { seat: [0, 1], arm: [2], legs: [3, 4], door: [5] };
}
{
  // The seat map: the cabin's rounded nose seen from above, and the seats in two columns either side
  // of the aisle
  const cabin = `M4.75 21.25V12.5C4.75 7 8 3.75 12 2.75C16 3.75 19.25 7 19.25 12.5V21.25`;
  const seats = [];
  for (const y of [11, 15, 19]) for (const x of [8.5, 15.5]) seats.push(dot(x, y));
  const d = [cabin, ...seats];
  put('seat-map', ['mapa de asientos', 'elegir asiento', 'cabina', 'seat map', 'seat selection', 'cabin layout'], d);
  FILL['seat-map'] = { solid: [`${cabin}Z`], cut: seats };
  PARTS['seat-map'] = { cabin: [0], seats: seats.map((_, i) => i + 1) };
}
{
  // The porthole: its bezel, the pane, and the wing's edge crossing the pane's lower half
  const bezel = sq(5.5, 2.75, 13, 18.5, 6.5);
  const pane = sq(8.5, 5.75, 7, 12.5, 3.5);
  const wing = line([8.5, 15.75], [15.5, 13.25]);
  const d = [bezel, pane, wing];
  put('cabin-window', ['ventanilla', 'asiento de ventana', 'vista', 'cabin window', 'window seat', 'porthole'], d);
  FILL['cabin-window'] = { solid: [bezel], cut: [pane, wing] };
  PARTS['cabin-window'] = { bezel: [0], pane: [1], wing: [2] };
}
{
  // The two straps running into the flat latch buckle, its lever across the middle
  const buckle = sq(7.75, 7, 8.5, 10, 2.25);
  const straps = [
    line([2.75, 9.75], [7.75, 9.75]),
    line([2.75, 14.25], [7.75, 14.25]),
    line([16.25, 9.75], [21.25, 9.75]),
    line([16.25, 14.25], [21.25, 14.25]),
  ];
  const lever = line([10.6, 12], [13.4, 12]);
  const d = [buckle, lever, ...straps];
  put('fasten-seatbelt', ['abrocharse el cinturón', 'cinturón de seguridad', 'aviso', 'fasten seatbelt', 'seatbelt sign', 'buckle up'], d);
  FILL['fasten-seatbelt'] = { solid: [buckle], cut: [lever], wire: straps };
  PARTS['fasten-seatbelt'] = { buckle: [0, 1], straps: [2, 3, 4, 5] };
}
{
  // Comunicacion's person-circle as the call button, hanging from the overhead panel
  const k = 0.8;
  const [tx, ty] = [12 - 12 * k, 13.4 - 12 * k];
  const button = ['M3 12A9 9 0 1 0 21 12A9 9 0 1 0 3 12Z', circ(12, 9.5, 3.25), arc(12, 21.25, 6.25, 202.17, 337.83).d].map((p) => transform(p, k, tx, ty));
  const panel = line([3.25, 3], [20.75, 3]);
  const stem = line([12, 3], [12, 13.4 - 9 * k]);
  const d = [panel, stem, ...button];
  put('attendant-call', ['llamar al sobrecargo', 'botón de llamada', 'asistencia a bordo', 'call attendant', 'call button', 'cabin service'], d);
  FILL['attendant-call'] = { solid: [button[0]], cut: [button[1], button[2]], wire: [panel, stem] };
  PARTS['attendant-call'] = { panel: [0, 1], button: [2, 3, 4] };
}
{
  // The back of a seat seen from behind, its top arched, and the screen set into it with the play
  // sign on it: an empty screen read as a mailbox. The headrest's curve is left out so the screen and
  // its sign get the room to keep the sign's hole open at bold
  const shell = 'M4.75 21.25V8.5C4.75 5 7.75 2.75 12 2.75S19.25 5 19.25 8.5V21.25Z';
  const screen = sq(7.25, 7.75, 9.5, 9.75, 1.75, SQ);
  const play = roundpoly(
    [
      [10.35, 10.75],
      [13.85, 12.7],
      [10.35, 14.65],
    ],
    0.4,
  );
  const d = [shell, screen, play];
  put('seatback-screen', ['pantalla', 'entretenimiento a bordo', 'películas', 'seatback screen', 'in-flight entertainment', 'ife'], d);
  FILL['seatback-screen'] = { solid: [shell], cut: [screen, play] };
  PARTS['seatback-screen'] = { seat: [0], screen: [1, 2] };
}
{
  // The seat (moved right) and, folded down off the back of it, the table with a cup standing on it
  // (a bare table and its strut read as a stick behind a chair)
  const S = seat({ dx: 3 });
  const rear = (y) => 10.5 - ((10.5 - 8.75) * (14 - y)) / (14 - 3.25);
  const table = line([2.75, 12.25], [rear(12.25), 12.25]);
  const cup = roundline(
    [
      [3.5, 8.25],
      [3.5, 12.25],
      [6.5, 12.25],
      [6.5, 8.25],
    ],
    [0, 1, 1, 0],
  );
  const d = [S.shell, S.headrest, S.arm, ...S.legs, table, cup];
  put('tray-table', ['mesa plegable', 'mesita', 'charola', 'tray table', 'seatback tray', 'fold-down table'], d);
  FILL['tray-table'] = { solid: [S.shell, shut(cup)], cut: [S.headrest], wire: [S.arm, ...S.legs, table] };
  PARTS['tray-table'] = { seat: [0, 1], arm: [2], legs: [3, 4], table: [5], cup: [6] };
}
{
  // The bin seen end-on: its back wall curving with the fuselage, its floor and front lip, the door
  // swung up and out from the hinge, and a suitcase lying in it on its floor (a duffel and a curved
  // door read as an iron)
  const bin = 'M16.25 5.75H8.5A5.75 5.75 0 0 0 2.75 11.5V18.75H16.25V16.25';
  const door = line([16.25, 5.75], [21.25, 3.25]);
  const bag = sq(5.75, 12.25, 7.75, 6.5, 1.5, { square: ['br', 'bl'] });
  const handle = roundline(
    [
      [7.9, 12.25],
      [7.9, 9.75],
      [11.35, 9.75],
      [11.35, 12.25],
    ],
    [0, 0.75, 0.75, 0],
  );
  const d = [bin, door, bag, handle];
  put('overhead-bin', ['compartimento superior', 'portaequipaje', 'equipaje de mano', 'overhead bin', 'cabin storage', 'overhead locker'], d);
  FILL['overhead-bin'] = { solid: [shut(bin)], cut: [bag, handle], wire: [door] };
  PARTS['overhead-bin'] = { bin: [0], lid: [1], bag: [2, 3] };
}
{
  // Nucleo's person (scaled from its feet, as cocina's chef) in a pillbox hat resting on the head,
  // whose top it hides, and the scarf's V at the neck, its ends on the body's top edge
  const s = 0.82;
  const up = Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s);
  const hc = [12, 20.6 + (7.45 - 20.6) * s - up];
  const hr = 3.7 * s;
  const band = hc[1] - hr * 0.7;
  const a = (Math.asin((band - hc[1]) / hr) * 180) / Math.PI;
  const head = arc(...hc, hr, a, 180 - a).d;
  const body = transform(nucleo.icons.person.d[1], s, 12 - 12 * s, 20.6 - 20.6 * s);
  const hat = sq(8.25, band - 3.25, 7.5, 3.25, 0.75);
  // The body's top edge (nucleo's left-hand cubic, scaled as the body) gives where the V starts
  const top = [
    [12, 13.6],
    [8.4, 13.6],
    [5.5, 15.45],
    [4.78, 18.68],
  ].map(([x, y]) => [12 + (x - 12) * s, 20.6 + (y - 20.6) * s]);
  const yAt = (x) => {
    const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * top[0][k] + 3 * (1 - t) ** 2 * t * top[1][k] + 3 * (1 - t) * t * t * top[2][k] + t ** 3 * top[3][k]);
    let [lo, hi] = [0, 1];
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (at(m)[0] > x) lo = m;
      else hi = m;
    }
    return at(lo)[1];
  };
  const scarf = line([9.75, yAt(9.75)], [12, 18.25], [14.25, yAt(9.75)]);
  // Filled, the V is knocked out through the edge, past it
  const past = (x) => [x + (x < 12 ? -0.45 : 0.45), yAt(9.75) - 1];
  const scarfCut = line(past(9.75), [12, 18.25], past(14.25));
  const d = [head, body, hat, scarf];
  put('cabin-crew', ['sobrecargo', 'tripulación', 'auxiliar de vuelo', 'cabin crew', 'flight attendant', 'crew'], d);
  FILL['cabin-crew'] = { solid: [`${head}Z`, body, hat], cut: [scarfCut] };
  PARTS['cabin-crew'] = { person: [0, 1], hat: [2], scarf: [3] };
}

// ── The cockpit and the airframe ──
{
  // The ram-horn yoke: its two grips rising from the bar, on the central column
  const yoke = roundpoly(
    [
      [2.75, 4.5],
      [6.25, 4.5],
      [6.25, 10.75],
      [17.75, 10.75],
      [17.75, 4.5],
      [21.25, 4.5],
      [21.25, 14.5],
      [2.75, 14.5],
    ],
    [1.75, 1.75, 1.5, 1.5, 1.75, 1.75, 4.5, 4.5],
  );
  const column = roundline(
    [
      [10.25, 14.5],
      [10.25, 21.25],
      [13.75, 21.25],
      [13.75, 14.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  const d = [yoke, column];
  put('control-yoke', ['timón', 'cabina de mando', 'simulador de vuelo', 'control yoke', 'cockpit', 'flight simulator'], d);
  FILL['control-yoke'] = { solid: [yoke, shut(column)] };
  PARTS['control-yoke'] = { yoke: [0], column: [1] };
}
{
  // The attitude indicator: the dial, the horizon banked 15° under the aircraft's W
  const dial = circ(12, 12, 9);
  const tilt = Math.tan((15 * Math.PI) / 180);
  const yAt = (x) => 16.5 - (x - 12) * tilt;
  const xs = [3, 21].map((edge) => {
    // where the horizon meets the dial
    let [lo, hi] = edge < 12 ? [edge, 12] : [12, edge];
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      const inside = Math.hypot(m - 12, yAt(m) - 12) < 9;
      if (edge < 12 === inside) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  });
  const horizon = line([xs[0], yAt(xs[0])], [xs[1], yAt(xs[1])]);
  const symbol = line([6.25, 11.75], [9.75, 11.75], [12, 13.5], [14.25, 11.75], [17.75, 11.75]);
  const d = [dial, horizon, symbol];
  put('artificial-horizon', ['horizonte artificial', 'actitud', 'instrumento de vuelo', 'artificial horizon', 'attitude indicator', 'flight instrument'], d);
  FILL['artificial-horizon'] = { solid: [dial], cut: [horizon, symbol] };
  PARTS['artificial-horizon'] = { dial: [0], horizon: [1], aircraft: [2] };
}
{
  // The engine from the front: the nacelle, the fan's curved blades and the spinner
  const c = [12, 12];
  const R = 9;
  const hub = 2.25;
  const n = 5;
  const blades = Array.from({ length: n }, (_, i) => {
    const a = -90 + (i * 360) / n;
    const p0 = polar(...c, hub, a);
    const p1 = polar(...c, R, a + 45);
    const q = polar(...c, 6.25, a + 8);
    return `M${pt(p0)}Q${pt(q)} ${pt(p1)}`;
  });
  const d = [circ(...c, R), circ(...c, hub), ...blades];
  put('jet-engine', ['motor a reacción', 'turbina', 'mantenimiento', 'jet engine', 'turbofan', 'aircraft engine'], d);
  FILL['jet-engine'] = { solid: [d[0]], cut: d.slice(1) };
  PARTS['jet-engine'] = { nacelle: [0], fan: d.slice(1).map((_, i) => i + 1) };
}
{
  // The gear seen from the front: the oleo strut (its cylinder, and the piston sliding out of it at
  // the knee), the axle and two wheels side by side
  const tires = [capsule(4.75, 12.75, 4.5, 8.5), capsule(14.75, 12.75, 4.5, 8.5)];
  const cylinder = sq(10.5, 2.75, 3, 8.75, 1);
  const piston = line([12, 11.5], [12, 17]);
  const axle = line([9.25, 17], [14.75, 17]);
  const d = [cylinder, piston, axle, ...tires];
  put('landing-gear', ['tren de aterrizaje', 'ruedas', 'tren abajo', 'landing gear', 'gear down', 'undercarriage'], d);
  FILL['landing-gear'] = { solid: [cylinder, ...tires], wire: [piston, axle] };
  PARTS['landing-gear'] = { strut: [0, 1, 2], wheels: [3, 4] };
}
{
  // The wings: each drawn once (the right one, swept up, its trailing edge stepped into three
  // feathers) and mirrored, spreading from the central disc
  const wing = roundpoly(
    [
      [14.25, 10],
      [21.25, 5.25],
      [21, 8.25],
      [18.5, 10.25],
      [18.75, 12.25],
      [16.25, 13.5],
      [16, 15.5],
      [13.75, 14.25],
    ],
    [0, 1, 0.75, 0.25, 0.75, 0.25, 0.75, 0],
  );
  const left = flipPath(wing);
  const disc = circ(12, 12, 2.75);
  const d = [disc, wing, left];
  put('aviator-wings', ['alas de piloto', 'insignia', 'nivel élite', 'pilot wings', 'aviator badge', 'elite status'], d);
  FILL['aviator-wings'] = { solid: d };
  PARTS['aviator-wings'] = { disc: [0], wings: [1, 2] };
}

// ── 16 px: simpler drawings where the snapped one clogs up (DESIGN.md › 16 px) ─────────────────────
{
  // The engine: three blades instead of five
  const blades = [0, 1, 2].map((i) => {
    const a = -90 + i * 120;
    return `M${pt(polar(12, 12, 2.25, a))}Q${pt(polar(12, 12, 6.25, a + 10))} ${pt(polar(12, 12, 9, a + 55))}`;
  });
  const d = [circ(12, 12, 9), circ(12, 12, 2.25), ...blades];
  icons['jet-engine'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
{
  // The liquids bag: the bottles as two plain flasks
  const d = [sq(4.25, 4.25, 15.5, 16.25, 3.5, SQ), line([4.25, 8.25], [19.75, 8.25]), sq(7.5, 12, 3, 6, 1), sq(13.5, 12, 3, 6, 1)];
  icons['liquids-bag'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
{
  // The window: the bezel and the wing's edge, without the pane
  const d = [sq(5.5, 2.75, 13, 18.5, 6.5), line([5.5, 16.5], [18.5, 12.75])];
  icons['cabin-window'].small = { d, fill: { solid: [d[0]], cut: [d[1]] } };
}
{
  // The kiosk: its head, screen and pedestal, without the slot
  const icon = icons['check-in-kiosk'];
  const d = [icon.d[0], icon.d[1], icon.d[3]];
  icon.small = { d, fill: { solid: [d[0], shut(d[2])], cut: [d[1]] } };
}
{
  // The call button: the ring and the head only
  const d = [line([3.25, 3], [20.75, 3]), line([12, 3], [12, 6.2]), circ(12, 13.4, 7.2), circ(12, 12.25, 2.25)];
  icons['attendant-call'].small = { d, fill: { solid: [d[2]], cut: [d[3]], wire: [d[0], d[1]] } };
}


// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
for (const [name, fill] of Object.entries(FILL)) icons[name].fill = fill;
// The plane-* badges: lugares's plane, solid, with the engine's badge
for (const name of ['plane-check', 'plane-x', 'plane-clock', 'plane-alert', 'plane-search', 'plane-wifi']) icons[name].fill = { solid: [PLANE] };
// The arcs and their dots: lines and discs, the same in the fill
for (const name of ['flight-nonstop', 'flight-layover', 'flight-round-trip', 'flight-multi-city', 'flight-diverted', 'flight-path']) icons[name].fill = false;

// ── Named parts (emitted as data-part) ────────────────────────────────────────────────────────
for (const name of ['plane-check', 'plane-x', 'plane-clock', 'plane-alert', 'plane-search', 'plane-wifi']) PARTS[name] = { plane: [0] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// With a badge or a piece on top: at 58 % the sign stops reading, and the slash would cross it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Already enclosed (a dial, a nacelle, a call button, the scan corners): not enclosed again
for (const name of ['artificial-horizon', 'jet-engine', 'attendant-call']) icons[name].variants = { ...icons[name].variants, circle: false };
icons['boarding-pass-scan'].variants = { circle: false, square: false };

// ── Mirroring: what is seen from the side faces right and flies that way ──────────────────────
for (const name of ['plane-side', 'private-jet', 'propeller-plane', 'seaplane', 'helicopter', 'airship', 'flight-path', 'flight-multi-city', 'flight-diverted', 'turbulence', 'deicing']) icons[name].mirror = true;
// The boards read from their arrow onward, and the exit row's arrow leaves to one side
for (const name of ['departures-board', 'arrivals-board', 'exit-row']) icons[name].mirror = true;

// ── Motion: each icon's own gesture ───────────────────────────────────────────────────────────
const MOTION = {
  'plane-side': { effect: 'slide', vector: [2, 0] },
  'plane-front': { effect: 'float', vector: [0, -1.5] },
  'private-jet': { effect: 'slide', vector: [2, 0] },
  'propeller-plane': { effect: 'slide', vector: [2, 0] },
  seaplane: { effect: 'float', parts: ['fuselage', 'wing', 'propeller', 'float'], vector: [0, -1] },
  glider: { effect: 'float', vector: [0, -1.5] },
  helicopter: { effect: 'float', vector: [0, -1.5] },
  'hot-air-balloon': { effect: 'float', vector: [0, -2] },
  airship: { effect: 'float', vector: [1.5, 0] },
  'plane-check': { effect: 'beat', parts: ['badge'], origin: BC },
  'plane-x': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'plane-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'plane-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'plane-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'plane-wifi': { effect: 'beat', parts: ['badge'], origin: [17.25, 20.5] },
  'flight-path': { effect: 'slide', parts: ['plane'], vector: [1.5, -0.5] },
  'flight-round-trip': { effect: 'slide', parts: ['out'], vector: [1.5, 0] },
  turbulence: { effect: 'wiggle', parts: ['plane'], origin: [12, 9] },
  'globe-plane': { effect: 'slide', parts: ['badge'], vector: [1.5, -1.5] },
  'map-pin-plane': { effect: 'bounce', vector: [0, -2.5] },
  'boarding-gate-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'departures-board': { effect: 'slide', parts: ['arrow'], vector: [1, -1] },
  'arrivals-board': { effect: 'slide', parts: ['arrow'], vector: [1, 1] },
  deicing: { effect: 'slide', parts: ['spray'], vector: [-0.75, 1.5] },
  'boarding-pass-check': { effect: 'beat', parts: ['badge'], origin: BC },
  'boarding-pass-mobile': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'baggage-drop': { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  'security-screening': { effect: 'slide', parts: ['person'], vector: [1.5, 0] },
  'security-screening-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'baggage-claim': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'baggage-trolley': { effect: 'slide', vector: [1.5, 0] },
  'baggage-tag': { effect: 'ring', origin: [10.75, 2.75] },
  'baggage-tag-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'carry-on-plus': { effect: 'beat', parts: ['badge'], origin: BC },
  'baggage-weight': { effect: 'wiggle', parts: ['needle'], origin: [18, 7] },
  'airline-seat-check': { effect: 'beat', parts: ['badge'], origin: BC },
  'airline-seat-arrow-up': { effect: 'slide', parts: ['badge'], vector: [0, -1.5] },
  'exit-row': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'attendant-call': { effect: 'ring', origin: [12, 3] },
  'overhead-bin': { effect: 'wiggle', parts: ['lid'], origin: [16.25, 5.75] },
  'control-yoke': { effect: 'wiggle', origin: [12, 21.25] },
  'artificial-horizon': { effect: 'wiggle', parts: ['horizon'], origin: [12, 12] },
  'jet-engine': { effect: 'spin', parts: ['fan'], origin: [12, 12] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

export default { category: 'aviacion', label: 'Aviación', icons };
