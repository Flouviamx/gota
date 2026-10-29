// Aire libre y campamento (outdoors and camping): shelters, sleep, the camp kitchen and the fire, water,
// light, packs and tools, the trail and the park, winter gear and fishing. Everything is computed with
// the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on containers. The category adopts lugares' `tent`,
// `campfire` and `binoculars` (drawn there, never redrawn): the tent-* icons are lugares' tent or carry
// its door, and campfire-* keep its logs and its flame. The fishing icons share one hook, drawn once
// (`hook`), and trail-* build on `trail`. Badges are the engine's; a piece that sits in front of another
// (a tent or a hut before its mountain, a gate before its peak, a worm on its hook, a handle over
// its tools) is a custom badge and the engine clears what lies behind it. No
// weapons: the knives are pocket tools. Two approved icons are not drawn: `snowshoe`, since at 24 px
// every snowshoe tried (a teardrop with its webbing, a slim racket with crossbars, a modern deck, a
// pair) read as an ice cream cone, a carrot, a flip-flop or a pair of slippers; and `spork`, since
// every spork tried read as something else: cocina's fork with its U closed as a fork, and a spoon's
// oval bowl with tines, upright or at a slant, as an electric plug.
import { arc, badge, circ, dot, f, halfChord, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comunicacion from './comunicacion.mjs';
import lugares from './lugares.mjs';

const L = lugares.icons;

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
/** The point `l` away from `p` at `a` degrees (0 = right, 90 = down). */
const go = (p, a, l) => add2(p, [l * Math.cos(rad(a)), l * Math.sin(rad(a))]);
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** The same for a point. */
const placePt = (p, s, o, to = o) => [to[0] + (p[0] - o[0]) * s, to[1] + (p[1] - o[1]) * s];

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), lugares' roundline. */
function rl(pts, radius = 0.6) {
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

/** Capsule (stadium) of the box x, y, w, h: its short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const R = halfChord([x, y + w / 2], [x + w, y + w / 2]);
    return `M${pt([x, y + w / 2])}A${R} ${R} 0 0 1 ${pt([x + w, y + w / 2])}V${f(y + h - w / 2)}A${R} ${R} 0 0 1 ${pt([x, y + h - w / 2])}Z`;
  }
  const R = halfChord([x + h / 2, y], [x + h / 2, y + h]);
  return `M${pt([x + h / 2, y])}H${f(x + w - h / 2)}A${R} ${R} 0 0 1 ${pt([x + w - h / 2, y + h])}H${f(x + h / 2)}A${R} ${R} 0 0 1 ${pt([x + h / 2, y])}Z`;
}
/** A capsule along the axis from `a` to `b`, `r` either side of it. */
function bar(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1] * r, u[0] * r];
  const R = halfChord(add2(b, n), sub(b, n));
  return `M${pt(add2(a, n))}L${pt(add2(b, n))}A${R} ${R} 0 0 0 ${pt(sub(b, n))}L${pt(sub(a, n))}A${R} ${R} 0 0 0 ${pt(add2(a, n))}Z`;
}
/** Ellipse of semi-axes rx, ry at c, as two half arcs. */
const ellipse = ([cx, cy], rx, ry) => `M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx - rx, cy])}Z`;
/** lugares' water line: half waves of length h and amplitude a (cubics whose peak is exactly a), the first one up. */
function ripple([x0, y], n, h = 3, a = 1) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
}
/**
 * The area an open stroke clears as a custom badge's `knock`: the stroke out and back (no area), so
 * the engine clears a band of paper along it. Takes an absolute path of M, L and C only.
 */
function there(d) {
  const segs = [...d.matchAll(/([MLC])([^MLC]*)/g)].map(([, c, a]) => [c, a.trim().split(/[\s,]+/).map(Number)]);
  let back = '';
  for (let i = segs.length - 1; i > 0; i--) {
    const [c, a] = segs[i];
    const prev = segs[i - 1][1].slice(-2);
    back += c === 'C' ? `C${pt([a[2], a[3]])} ${pt([a[0], a[1]])} ${pt(prev)}` : `L${pt(prev)}`;
  }
  return `${d}${back}Z`;
}
/** A polygon given as points rotated `a` degrees about `c`. */
const turnPts = (pts, a, c) => pts.map((p) => {
  const [x, y] = sub(p, c);
  return add2(c, [x * Math.cos(rad(a)) - y * Math.sin(rad(a)), x * Math.sin(rad(a)) + y * Math.cos(rad(a))]);
});

/**
 * lugares' flame: a round base rising to a tilted tip, the logomark's drop inside (the campfire's).
 * Returns [outline, drop].
 */
function flame(c, r, tip) {
  const L0 = polar(...c, r, 195);
  const R0 = polar(...c, r, -15);
  const tl = [Math.sin(rad(15)), -Math.cos(rad(15))];
  const tr = [Math.sin(rad(15)), Math.cos(rad(15))];
  const k = r * 0.62;
  const out = `M${pt(L0)}C${pt(add2(L0, mul(tl, k)))} ${pt(add2(tip, [-r * 0.42, r * 0.62]))} ${pt(tip)}C${pt(add2(tip, [r * 0.2, r * 0.5]))} ${pt(sub(R0, mul(tr, k)))} ${pt(R0)}A${f(r)} ${f(r)} 0 1 1 ${pt(L0)}Z`;
  const ri = r * 0.36;
  const ic = [c[0], c[1] + r - ri - 2.4];
  const a = polar(...ic, ri, -45);
  const b = polar(...ic, ri, -135);
  const drop = `M${pt(a)}A${f(ri)} ${f(ri)} 0 1 1 ${pt(b)}L${pt([ic[0], ic[1] - ri * Math.SQRT2])}Z`;
  return [out, drop];
}

/** The set's drop (lugares' droplet): a circle whose corner points up. */
const droplet = (c, r) => `M${pt(polar(...c, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${pt(polar(...c, r, -135))}L${pt([c[0], c[1] - r * Math.SQRT2])}Z`;

const icons = {};
/** Fill specs, named parts and motion collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** The badges' center (DESIGN.md › Badges). */
const BC = [17.25, 17.25];
/** Each badge's gesture, as the rest of the set: signs beat, tools rock, alerts shake. */
const BADGE_MOTION = {
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  search: { effect: 'wiggle', parts: ['badge'], origin: BC },
  alert: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
};

// ── Shelters ──────────────────────────────────────────────────────────────────────────────────
// lugares' tent: a rounded triangle on the ground at 20.25 and its door, an inverted V.
const TENT = L.tent.d;
const GROUND = 20.25;
/** The tent at scale `s`, its base's middle at `at`. */
const tentAt = (s, at) => TENT.map((d) => place(d, s, [12, GROUND], at));

{
  // Dome: a low half-dome on the ground, its front pole a meridian over the crown (as the globe's) and
  // the tent's own door, the inverted V, between the pole's feet: an arched door made it an igloo.
  const shell = `M2.75 ${GROUND}A9.25 11.5 0 0 1 21.25 ${GROUND}Z`;
  const poles = `M7 ${GROUND}A5 11.5 0 0 1 17 ${GROUND}`;
  const door = place(TENT[1], 0.72, [12, GROUND]);
  add('tent-dome', ['tienda iglú', 'domo', 'carpa', 'acampar', 'dome tent', 'backpacking tent', 'tent'], [shell, poles, door]);
  FILL['tent-dome'] = { solid: [0], cut: [1, 2] };
  PARTS['tent-dome'] = { tent: [0], poles: [1], door: [2] };
}
/** A hoop standing on the ground: half an ellipse from foot x0 to foot x1, its crown at `top`. */
const onHoop = (h, a) => [h.c[0] + h.rx * Math.cos(rad(a)), h.c[1] + h.ry * Math.sin(rad(a))];
const inHoop = (h, [x, y]) => ((x - h.c[0]) / h.rx) ** 2 + ((y - h.c[1]) / h.ry) ** 2 < 1;
/**
 * The tunnel tent in three quarters: the front hoop facing us with the tent's door, the hoops behind
 * it stepping down toward the back, each seen past the one in front of it. `hoops` are [left foot,
 * right foot, crown] on the ground at `g`; the door is the tent's at scale `ds`, its middle at `dx`.
 * Returns its strokes and its fill (the hoops solid, the seams between them cut out).
 */
function tunnel(hoops, g, ds, dx) {
  const H = hoops.map(([x0, x1, top]) => ({ c: [(x0 + x1) / 2, g], rx: (x1 - x0) / 2, ry: g - top }));
  const arcTo = (h, p) => `A${f(h.rx)} ${f(h.ry)} 0 0 1 ${pt(p)}`;
  const foot = (h) => [h.c[0] + h.rx, g];
  // Where each back hoop comes out from behind the one in front (sampled along its crown)
  const back = H.slice(1).map((h, k) => {
    let a = 180;
    while (a < 360 && inHoop(H[k], onHoop(h, a))) a += 0.05;
    return `M${pt(onHoop(h, a))}${arcTo(h, foot(h))}`;
  });
  // The part of hoop k behind hoop k + 1, from where that one comes out down to the ground
  const seam = (k) => {
    let a = 360;
    while (a > 180 && inHoop(H[k + 1], onHoop(H[k], a))) a -= 0.05;
    return `M${pt(onHoop(H[k], a))}${arcTo(H[k], foot(H[k]))}`;
  };
  const door = place(TENT[1], ds, [12, GROUND], [dx, g]);
  const d = [hl(g, hoops[0][0], hoops.at(-1)[1]), `M${pt([hoops[0][0], g])}${arcTo(H[0], foot(H[0]))}`, ...back, door];
  const whole = H.map((h) => `M${pt([h.c[0] - h.rx, g])}${arcTo(h, foot(h))}Z`);
  return { d, fill: { solid: whole, cut: [...H.slice(0, -1).map((_, k) => seam(k)), door] } };
}
{
  // Tunnel: three hoops, the front one 11 wide and 13.5 tall, each one behind 3.75 further back and
  // 3.25 lower.
  const t = tunnel([[2.75, 13.75, 6.75], [7.5, 17.5, 10], [12.25, 21.25, 13.25]], GROUND, 0.85, 8.25);
  add('tent-tunnel', ['tienda túnel', 'tienda familiar', 'carpa grande', 'acampar', 'tunnel tent', 'family tent', 'tent'], t.d);
  icons['tent-tunnel'].fill = t.fill;
  PARTS['tent-tunnel'] = { tent: [0, 1, 2, 3], door: [4] };
}
{
  // Bell: a wide cone on a short wall, the center pole's tip above the peak, the door an inverted V
  // as the tent's.
  const apex = [12, 5.75];
  const body = roundpoly([[3.25, GROUND], [3.25, 15.25], apex, [20.75, 15.25], [20.75, GROUND]], [1, 1, 1.25, 1, 1]);
  const half = Math.atan((20.75 - 12) / (15.25 - 5.75));
  const top = apex[1] + 1.25 / Math.sin(half) - 1.25;
  add('tent-bell', ['tienda campana', 'glamping', 'tienda de lona', 'yurta', 'bell tent', 'glamping', 'canvas tent'], [body, vl(12, top, 2.75), rl([[9.25, GROUND], [12, 14.25], [14.75, GROUND]], [0, 0.6, 0])]);
  FILL['tent-bell'] = { solid: [0], wire: [1], cut: [2] };
  PARTS['tent-bell'] = { tent: [0], pole: [1], door: [2] };
}
{
  // Rooftop tent: a small SUV in profile (vehiculos' construction: the tires are arcs under the sill),
  // a wedge tent opened on its roof and overhanging the tail, the ladder leaning from it to the ground.
  const ROOF = 11.5;
  const BELT = 14.5;
  const BOT = 18;
  const body = roundpoly([[21.25, BOT], [21.25, 15.25], [17.5, BELT], [14.75, ROOF], [2.75, ROOF], [2.75, BOT]], [1, 1.25, 0.75, 1, 1, 1]);
  const tire = (x) => {
    const [y, r] = [18.75, 2.25];
    const a = deg(Math.asin((BOT - y) / r));
    return arc(x, y, r, a, 180 - a).d;
  };
  const belt = hl(BELT, 2.75, 17.5);
  const s = 0.43;
  const top = placePt([12, 3.5], s, [12, GROUND], [8.5, ROOF]);
  const half = 9.25 * s;
  const tent = rl([[8.5 - half, ROOF], top, [8.5 + half, ROOF]], [0, 1.25 * s, 0]);
  const door = place(TENT[1], s, [12, GROUND], [8.5, ROOF]);
  add('rooftop-tent', ['tienda de techo', 'overlanding', 'acampar en auto', 'camioneta', 'rooftop tent', 'car camping', 'overland'], [body, tire(6.75), tire(17.25), belt, tent, door]);
  FILL['rooftop-tent'] = { solid: [0, shut(tire(6.75)), shut(tire(17.25)), shut(tent)], cut: [line([4.5, BELT], [15.75, BELT]), door] };
  PARTS['rooftop-tent'] = { car: [0, 3], wheels: [1, 2], tent: [4, 5] };
}
{
  // Tarp: a sheet pitched as an open ridge over its pole, no floor and no door; its two edges staked
  // out by guy lines that leave them steeper.
  const apex = [12, 5.5];
  const eaves = [[4.75, 15], [19.25, 15]];
  const sheet = rl([eaves[0], apex, eaves[1]], [0, 1, 0]);
  const half = Math.atan((19.25 - 12) / (15 - 5.5));
  const under = apex[1] + 1 / Math.sin(half) - 1;
  add('tarp', ['lona', 'refugio', 'toldo', 'sombra', 'tarp', 'rain fly', 'shelter'], [sheet, vl(12, under, 20.75), line(eaves[0], [2.75, 20.75]), line(eaves[1], [21.25, 20.75])]);
  FILL.tarp = false;
  PARTS.tarp = { sheet: [0], pole: [1], guylines: [2, 3] };
}
{
  // Campground: the tent and a pine (lugares' construction) side by side on one ground line.
  const s = 0.58;
  const [tent, door] = tentAt(s, [8.25, GROUND]);
  const right = 8.25 + 9.25 * s;
  const crown = roundpoly([[17.75, 4.25], [21.25, 15.5], [14.25, 15.5]], [1, 1.25, 1.25]);
  add('campground', ['campamento', 'zona de acampar', 'camping', 'parque', 'campground', 'campsite', 'camping area'], [tent, door, crown, vl(17.75, 15.5, GROUND), hl(GROUND, right - 1, 21.25)]);
  FILL.campground = { solid: [0, 2], cut: [1], wire: [3, 4] };
  PARTS.campground = { tent: [0, 1], tree: [2, 3], ground: [4] };
}
{
  // Base camp: a tall peak with its snowline, the small tent at its foot in front (a custom badge: the
  // engine clears the mountain behind it).
  const P = [[2.75, GROUND], [13.75, 3.25], [21.25, GROUND]];
  const peak = roundpoly(P, [1, 1.25, 1]);
  const at = (y, side) => {
    const [a, b] = side < 0 ? [P[0], P[1]] : [P[2], P[1]];
    return lerp(b, a, (y - b[1]) / (a[1] - b[1]));
  };
  const snow = line(at(9.25, -1), [11.6, 10.75], [13.75, 9], at(10.25, 1));
  const [tent, door] = tentAt(0.47, [7.5, GROUND]);
  add('base-camp', ['campamento base', 'expedición', 'montañismo', 'alta montaña', 'base camp', 'expedition', 'mountaineering'], [peak, snow], {
    badge: { d: [tent, door], knock: tent, fill: { solid: [tent], cut: [door] } },
  });
  FILL['base-camp'] = { solid: [0], cut: [1] };
  PARTS['base-camp'] = { mountain: [0], snow: [1] };
}
{
  // Mountain hut: a gabled hut with its door in front of a peak (a custom badge, as base-camp's tent).
  const peak = roundpoly([[2.75, GROUND], [10, 3.5], [21.25, GROUND]], [1, 1.25, 1]);
  const hut = roundpoly([[12.25, GROUND], [12.25, 14], [16.5, 10], [20.75, 14], [20.75, GROUND]], [0.75, 0.75, 1, 0.75, 0.75]);
  const door = rl([[15, GROUND], [15, 16.25], [18, 16.25], [18, GROUND]], [0, 0.75, 0.75, 0]);
  add('mountain-hut', ['refugio de montaña', 'cabaña alpina', 'albergue', 'montaña', 'mountain hut', 'refuge', 'alpine hut'], [peak], {
    badge: { d: [hut, door], knock: hut, fill: { solid: [hut], cut: [door] } },
  });
  FILL['mountain-hut'] = { solid: [0] };
  PARTS['mountain-hut'] = { mountain: [0] };
}
{
  // Campsite on the map: lugares' pin with a small tent in place of its hole, drawn as one stroke (its
  // door a notch in the base): a door drawn inside a tent this small closed up at bold.
  const tent = roundpoly([[12, 5.75], [15.75, 12.75], [13.4, 12.75], [12, 10.25], [10.6, 12.75], [8.25, 12.75]], [0.75, 0.6, 0.3, 0.4, 0.3, 0.6]);
  add('map-pin-tent', ['zona de acampar', 'campamento en el mapa', 'sitio para acampar', 'ubicación', 'campsite location', 'camping spot', 'map pin'], [L['map-pin'].d[0], tent]);
  FILL['map-pin-tent'] = { solid: [0], cut: [1] };
  PARTS['map-pin-tent'] = { pin: [0], tent: [1] };
  MOTION['map-pin-tent'] = { effect: 'bounce', vector: [0, -2] };
}
for (const [kind, tags] of [
  ['check', ['reserva confirmada', 'campamento reservado', 'lugar asegurado', 'acampar', 'campsite booked', 'booking confirmed', 'reserved']],
  ['search', ['buscar campamento', 'encontrar sitio', 'buscar camping', 'acampar', 'find campsite', 'campsite search', 'search camping']],
]) {
  add(`tent-${kind}`, tags, [...TENT], { badge: badge(kind) });
  FILL[`tent-${kind}`] = { solid: [0], cut: [1] };
  PARTS[`tent-${kind}`] = { tent: [0], door: [1] };
  MOTION[`tent-${kind}`] = BADGE_MOTION[kind];
}
{
  // Hookup: a pedestal, its box marked with the bolt, the cord hanging under it in a loop.
  const box = sq(5.25, 2.75, 13.5, 10.75, 3, BR);
  add('campsite-hookup', ['conexión eléctrica', 'toma de corriente', 'servicios', 'electricidad', 'campsite hookup', 'electric hookup', 'rv hookup'], [
    box,
    rl([[13, 5.75], [10.75, 8.25], [13.25, 8.25], [11, 10.5]], [0, 0.4, 0.4, 0]),
    vl(8.75, 13.5, 21),
    `M14 13.5V16.25A2 2 0 0 0 18 16.25V13.5`,
    hl(21, 5.25, 12.25),
  ]);
  FILL['campsite-hookup'] = { solid: [0], cut: [1], wire: [2, 3, 4] };
  PARTS['campsite-hookup'] = { box: [0], bolt: [1], post: [2], cord: [3], ground: [4] };
}

// ── Sleep and furniture ───────────────────────────────────────────────────────────────────────
{
  // Sleeping bag from above: a mummy, the head's circle and the foot's joined by their tangents, the
  // hood's opening and the zipper down one side.
  const C1 = [12, 8.25];
  const r1 = 5.5;
  const C2 = [12, 18];
  const r2 = 3.25;
  const s = (r1 - r2) / (C2[1] - C1[1]);
  const n = [Math.sqrt(1 - s * s), s];
  const a1 = add2(C1, mul(n, r1));
  const b1 = add2(C2, mul(n, r2));
  const a0 = [2 * C1[0] - a1[0], a1[1]];
  const b0 = [2 * C2[0] - b1[0], b1[1]];
  const bag = `M${pt(a1)}A${f(r1)} ${f(r1)} 0 1 0 ${pt(a0)}L${pt(b0)}A${f(r2)} ${f(r2)} 0 0 0 ${pt(b1)}Z`;
  // Two baffles across the body, from side to side, sagging toward the foot
  const xAt = (y) => a1[0] + ((y - a1[1]) / (b1[1] - a1[1])) * (b1[0] - a1[0]);
  const baffle = (y) => `M${pt([2 * 12 - xAt(y), y])}Q12 ${f(y + 2)} ${pt([xAt(y), y])}`;
  add('sleeping-bag', ['saco de dormir', 'bolsa de dormir', 'dormir', 'equipo', 'sleeping bag', 'mummy bag', 'sleep system'], [bag, circ(...C1, 2.4), baffle(13.25), baffle(16.75)]);
  FILL['sleeping-bag'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['sleeping-bag'] = { bag: [0], hood: [1], baffles: [2, 3] };
}
{
  // Sleeping pad: the roll on the ground (its spiral end) and the mat running out of it, as thick as
  // the roll's layers are apart (3).
  const C = [7.5, 15.5];
  const R = 4.75;
  const top = GROUND - 3;
  const meet = C[0] + Math.sqrt(R * R - (top - C[1]) ** 2);
  const mat = `M${pt([C[0], GROUND])}H19.75A1.5 1.5 0 0 0 19.75 ${f(top)}H${f(meet)}`;
  add('sleeping-pad', ['colchoneta', 'aislante', 'esterilla', 'dormir', 'sleeping pad', 'camping mat', 'foam pad'], [circ(...C, R), arc(...C, 1.75, -30, 240).d, mat]);
  FILL['sleeping-pad'] = { solid: [0, shut(mat)], cut: [1] };
  PARTS['sleeping-pad'] = { roll: [0, 1], mat: [2] };
}
{
  // Cot: the taut bed over two pairs of X legs, its pillow a capsule floating over the head as on
  // hogar's beds. A dome for a pillow made it a cake on a table.
  const bed = capsule(2.75, 10.5, 18.5, 3);
  const pillow = capsule(4.25, 4.5, 6.75, 3);
  const x = (x0, x1) => [line([x0, 13.5], [x1, 20.75]), line([x1, 13.5], [x0, 20.75])];
  add('camping-cot', ['catre', 'cama de campaña', 'cama plegable', 'dormir', 'camping cot', 'camp bed', 'folding cot'], [bed, pillow, ...x(4.25, 9.75), ...x(14.25, 19.75)]);
  FILL['camping-cot'] = { solid: [0, 1], wire: [2, 3, 4, 5] };
  PARTS['camping-cot'] = { bed: [0], pillow: [1], legs: [2, 3, 4, 5] };
}
{
  // Camp chair from the front: the back's fabric between its uprights, an armrest each side down to
  // the front legs, the sagging seat and the crossed legs.
  const seat = 'M3.75 12.25Q12 14.75 20.25 12.25';
  const seatY = (x) => {
    const t = (x - 3.75) / 16.5;
    return (1 - t) ** 2 * 12.25 + 2 * (1 - t) * t * 14.75 + t * t * 12.25;
  };
  add('camp-chair', ['silla plegable', 'silla de campamento', 'asiento', 'mobiliario', 'camp chair', 'folding chair', 'quad chair'], [
    rl([[7.25, seatY(7.25)], [7.25, 3.25], [16.75, 3.25], [16.75, seatY(16.75)]], [0, 1.75, 1.75, 0]),
    seat,
    rl([[7.25, 9.25], [3.75, 9.25], [3.75, 14.75]], [0, 0.75, 0]),
    rl([[16.75, 9.25], [20.25, 9.25], [20.25, 14.75]], [0, 0.75, 0]),
    line([3.75, 14.75], [20.25, 20.75]),
    line([20.25, 14.75], [3.75, 20.75]),
  ]);
  FILL['camp-chair'] = { solid: [shut(icons['camp-chair'].d[0])], wire: [1, 2, 3, 4, 5] };
  PARTS['camp-chair'] = { back: [0], seat: [1], frame: [2, 3], legs: [4, 5] };
}

// ── The fire and the camp kitchen ─────────────────────────────────────────────────────────────
const FIRE = L.campfire.d;
{
  // Fire out: the campfire's logs, no flame, two wisps of smoke rising.
  const wisp = (x, y0 = 15, y1 = 3.25) => {
    const h = (y0 - y1) / 4;
    return `M${f(x)} ${f(y0)}C${f(x - 1.5)} ${f(y0 - h)} ${f(x - 1.5)} ${f(y0 - h * 1.5)} ${f(x)} ${f(y0 - 2 * h)}S${f(x + 1.5)} ${f(y0 - h * 3.5)} ${f(x)} ${f(y1)}`;
  };
  add('campfire-out', ['fogata apagada', 'fuego apagado', 'humo', 'apagar fuego', 'campfire out', 'fire extinguished', 'smoke'], [FIRE[2], FIRE[3], wisp(9.75), wisp(14.25, 13.5, 5)]);
  FILL['campfire-out'] = false;
  PARTS['campfire-out'] = { logs: [0, 1], smoke: [2, 3] };
  MOTION['campfire-out'] = { effect: 'float', parts: ['smoke'], vector: [0, -1.5] };
}
{
  // Marshmallow: the long stick held at a slant, the marshmallow skewered on its tip held over a small
  // campfire (lugares' flame without its drop, which closed at this size, over its two crossed logs).
  // Over a flame alone, the flame read as a drop of water.
  const from = [2.75, 17.5];
  const M = [12.75, 5.25];
  const ang = deg(Math.atan2(M[1] - from[1], M[0] - from[0]));
  const mallow = turnPath(sq(M[0] - 2.75, M[1] - 2, 5.5, 4, 1.5), ang, M);
  const end = go(M, ang + 180, 2.75);
  const [fl] = flame([16.5, 13.5], 2.75, [16.9, 9.25]);
  add('marshmallow-stick', ['malvavisco', 'bombón', 'asar', 'fogata', 'marshmallow', 'roasting', "s'mores"], [
    line(from, end),
    mallow,
    fl,
    line([11.75, 21.25], [15, 19.5]),
    line([21.25, 21.25], [18, 19.5]),
  ]);
  FILL['marshmallow-stick'] = { solid: [1, 2], wire: [0], lines: [3, 4] };
  PARTS['marshmallow-stick'] = { stick: [0], marshmallow: [1], flame: [2], logs: [3, 4] };
  MOTION['marshmallow-stick'] = { effect: 'wiggle', parts: ['flame'], origin: [16.5, 16.25] };
}
{
  // Match: the stick at a slant, the flame on its head (lugares' flame: its drop is the head).
  const c = [14, 9];
  const r = 4.25;
  const [out, drop] = flame(c, r, [15, 2.75]);
  const from = [5.5, 20.75];
  const u = unit(sub(c, from));
  add('matchstick', ['cerillo', 'fósforo', 'encender', 'fuego', 'match', 'matchstick', 'ignite'], [out, drop, line(from, sub(c, mul(u, r)))]);
  FILL.matchstick = { solid: [0], cut: [1], wire: [2] };
  PARTS.matchstick = { flame: [0, 1], stick: [2] };
  MOTION.matchstick = { effect: 'wiggle', parts: ['flame'], origin: [12, 12] };
}

{
  // Fire danger: a half dial of four segments (the levels, low to extreme), the flame at its pivot
  // and the needle leaving the flame toward the third.
  const C = [12, 17.25];
  const segs = [[180, 210], [230, 260], [280, 310], [330, 360]].map(([a, b]) => arc(...C, 9, a, b).d);
  const [fl] = flame(C, 2.5, [12.5, 12.25]);
  // The needle starts where its ray leaves the flame (sampled on the flame's outline)
  const a = -40;
  const start = (() => {
    const u = [Math.cos(rad(a)), Math.sin(rad(a))];
    // The flame's outline: its right cubic from the tip down to R0, sampled
    const R0 = polar(...C, 2.5, -15);
    const tip = [12.5, 12.25];
    const tr = [Math.sin(rad(15)), Math.cos(rad(15))];
    const P = [tip, add2(tip, [2.5 * 0.2, 2.5 * 0.5]), sub(R0, mul(tr, 2.5 * 0.62)), R0];
    let best = null;
    for (let i = 0; i <= 600; i++) {
      const t = i / 600;
      const q = (k) => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k];
      const p = [q(0), q(1)];
      const w = sub(p, C);
      const cross = Math.abs(w[0] * u[1] - w[1] * u[0]);
      if (w[0] * u[0] + w[1] * u[1] > 0 && (!best || cross < best.cross)) best = { p, cross };
    }
    return best.p;
  })();
  const needle = line(start, polar(...C, 6.25, a));
  add('fire-danger', ['peligro de incendio', 'riesgo de incendio', 'nivel de fuego', 'restricciones', 'fire danger', 'fire risk', 'fire rating'], [fl, needle, ...segs]);
  FILL['fire-danger'] = { solid: [0], wire: [1], lines: [2, 3, 4, 5] };
  PARTS['fire-danger'] = { flame: [0], needle: [1], level: [2, 3, 4, 5] };
  icons['fire-danger'].levels = [[2], [3], [4], [5]];
}

/** A gas canister: a domed top on straight sides, its bottom-right corner square (a container). */
function canister(x0, x1, shoulder, bot, dome, r = 1.75) {
  const rx = (x1 - x0) / 2;
  const d = `M${pt([x1, bot])}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x0, bot - r])}V${f(shoulder)}A${f(rx)} ${f(dome)} 0 0 1 ${pt([x1, shoulder])}Z`;
  const yAt = (x) => shoulder - dome * Math.sqrt(1 - ((x - (x0 + rx)) / rx) ** 2);
  return { d, yAt };
}
{
  // Stove: the burner on a short neck screwed into a squat canister, its pot supports folded out flat
  // to either side and a gas burner's row of flame tongues over it. A pan on the supports made it an
  // hourglass; one round flame over raised supports, a seated figure.
  const can = canister(5, 19, 18.75, 21.25, 2.25);
  const tongues = rl([[7.5, 8.75], [9, 5.5], [10.5, 8.75], [12, 4.5], [13.5, 8.75], [15, 5.5], [16.5, 8.75]], [0, 0.5, 0.3, 0.5, 0.3, 0.5, 0]);
  add('camp-stove', ['estufa de campamento', 'hornillo', 'cocinar', 'gas', 'camp stove', 'backpacking stove', 'burner'], [
    can.d,
    vl(12, can.yAt(12), 14.25),
    sq(7.5, 11.75, 9, 2.5, 1),
    hl(12.5, 3.25, 7.5),
    hl(12.5, 16.5, 20.75),
    tongues,
  ]);
  FILL['camp-stove'] = { solid: [0, 2], wire: [1, 3, 4], lines: [5] };
  PARTS['camp-stove'] = { canister: [0], burner: [1, 2], supports: [3, 4], flame: [5] };
  MOTION['camp-stove'] = { effect: 'wiggle', parts: ['flame'], origin: [12, 8.75] };
}
{
  // Fuel: a squat domed canister and its narrow threaded valve.
  const can = canister(4.25, 19.75, 13.5, 21.25, 4.5);
  add('fuel-canister', ['cartucho de gas', 'combustible', 'gas', 'estufa', 'fuel canister', 'gas canister', 'fuel'], [
    can.d,
    rl([[10, can.yAt(10)], [10, 3.25], [14, 3.25], [14, can.yAt(14)]], [0, 1, 1, 0]),
    hl(6.25, 10, 14),
  ]);
  FILL['fuel-canister'] = { solid: [0, shut(icons['fuel-canister'].d[1])], cut: [2] };
  PARTS['fuel-canister'] = { canister: [0], valve: [1, 2] };
}
/** A container open at the top: its sides and its bottom, the bottom-right corner square. */
const cup = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['tl', 'tr', 'br'] }).replace(/Z$/, '');
{
  // Mess kit: the pot under its lid, the wire bail folded over the lid.
  const lid = capsule(2.75, 8, 18.5, 3);
  add('mess-kit', ['olla de campamento', 'kit de cocina', 'menaje', 'cocinar', 'mess kit', 'cook kit', 'camp pot'], [cup(4.25, 11, 15.5, 10, 3), lid, 'M5.5 8A6.5 4.5 0 0 1 18.5 8']);
  FILL['mess-kit'] = { solid: [shut(icons['mess-kit'].d[0]), 1], wire: [2] };
  PARTS['mess-kit'] = { pot: [0], lid: [1], handle: [2] };
}
{
  // Bear canister: a stout body under a wider lid band, two lock tabs latched across their seam.
  add('bear-canister', ['contenedor antiosos', 'bote antiosos', 'guardar comida', 'osos', 'bear canister', 'bear-proof container', 'food storage'], [
    cup(5.75, 9, 12.5, 12, 3),
    sq(4.5, 3.25, 15, 5.75, 2),
    vl(9.25, 6.25, 11.75),
    vl(14.75, 6.25, 11.75),
  ]);
  FILL['bear-canister'] = { solid: [shut(icons['bear-canister'].d[0]), 1], cut: [2, 3] };
  PARTS['bear-canister'] = { body: [0], lid: [1], tabs: [2, 3] };
}
{
  // Soft cooler: a boxy bag, the zipper's arc around its lid and the shoulder strap over it.
  add('cooler-bag', ['hielera suave', 'bolsa térmica', 'pícnic', 'enfriador', 'soft cooler', 'cooler bag', 'insulated bag'], [
    sq(3.25, 9.25, 17.5, 11.75, 3.5, BR),
    'M3.25 15.25Q12 11 20.75 15.25',
    'M6.25 9.25A5.75 6 0 0 1 17.75 9.25',
  ]);
  FILL['cooler-bag'] = { solid: [0], cut: [1], wire: [2] };
  PARTS['cooler-bag'] = { bag: [0], zipper: [1], strap: [2] };
}
{
  // Picnic basket: a woven basket, its two lid flaps meeting at the center handle.
  const lidY = (x) => 11.5 - (1 - Math.abs(x - 12) / 8.75) * 2.75;
  const body = roundpoly([[3.25, 11.5], [20.75, 11.5], [19, 20.75], [5, 20.75]], [1, 1, 1.25, 1.25]);
  const xL = (y) => 3.25 + ((y - 11.5) / 9.25) * 1.75;
  add('picnic-basket', ['canasta de pícnic', 'cesta', 'pícnic', 'comida al aire libre', 'picnic basket', 'picnic', 'hamper'], [
    body,
    rl([[3.25, 11.5], [12, 8.75], [20.75, 11.5]], [0, 1.5, 0]),
    `M8.5 ${f(lidY(8.5))}A3.5 5.5 0 0 1 15.5 ${f(lidY(15.5))}`,
    hl(14.5, xL(14.5), 24 - xL(14.5)),
    hl(17.5, xL(17.5), 24 - xL(17.5)),
  ]);
  FILL['picnic-basket'] = { solid: [0, shut(icons['picnic-basket'].d[1])], cut: [3, 4], wire: [2] };
  PARTS['picnic-basket'] = { basket: [0, 3, 4], lid: [1], handle: [2] };
}
{
  // Canteen: a round flat flask under its screw cap, a drop on its face (what it carries).
  const C = [12, 14];
  const R = 7;
  const neckY = C[1] - Math.sqrt(R * R - 1.75 * 1.75);
  add('canteen', ['cantimplora', 'agua', 'hidratación', 'botella', 'canteen', 'water flask', 'hydration'], [
    circ(...C, R),
    rl([[10.25, neckY], [10.25, 3.75], [13.75, 3.75], [13.75, neckY]], [0, 0.75, 0.75, 0]),
    droplet([12, 15.25], 2.25),
  ]);
  FILL.canteen = { solid: [0, shut(icons.canteen.d[1])], cut: [2] };
  PARTS.canteen = { flask: [0], cap: [1], water: [2] };
}
{
  // Straw filter: a thick tube with its mouthpiece and a band, its foot dipped at a slant into the
  // water: the water's surface passes in front of it (a custom badge: the engine clears the tube).
  const c = [12, 13.75];
  const tube = turnPath(sq(9.75, 8, 4.5, 11.5, 1.75), 35, c);
  const mouth = turnPath('M10.75 8V5.75A1.25 1.25 0 0 1 13.25 5.75V8', 35, c);
  const band = turnPath(hl(11.25, 9.75, 14.25), 35, c);
  const waves = [ripple([3, 17.25], 6), ripple([3, 20.5], 6)];
  add('water-filter-straw', ['filtro de agua', 'pajilla filtrante', 'agua potable', 'purificar', 'water filter', 'filter straw', 'safe water'], [tube, mouth, band], {
    badge: { d: waves, knock: waves.map(there).join('') },
  });
  FILL['water-filter-straw'] = { solid: [0, shut(mouth)], cut: [2] };
  PARTS['water-filter-straw'] = { filter: [0, 1, 2] };
}
{
  // Hand pump: the cast-iron column on its plinth under a domed cap, the spout reaching out from its
  // top with a drop falling, the long lever handle rising on the other side.
  add('hand-pump', ['bomba de agua', 'agua potable', 'pozo', 'grifo', 'water pump', 'hand pump', 'drinking water'], [
    'M9.5 18.25V8.75A2.5 2.5 0 0 1 14.5 8.75V18.25',
    sq(8.5, 18.25, 7, 3, 1),
    rl([[9.5, 9.75], [4.25, 9.75], [4.25, 12.5]], [0, 1.5, 0]),
    droplet([4.25, 17.75], 1.25),
    'M14.25 7.75L18.75 4.75Q19.75 4 21.25 4.25',
  ]);
  FILL['hand-pump'] = { solid: [shut(icons['hand-pump'].d[0]), 1, 3], wire: [2, 4] };
  PARTS['hand-pump'] = { pump: [0, 1], spout: [2], water: [3], handle: [4] };
  MOTION['hand-pump'] = { effect: 'bounce', parts: ['water'], vector: [0, 1.5] };
}
{
  // Camp shower: the water bag hanging on its strap from a branch, its hose down to a head like the
  // home's shower (hogar), the water falling in slanted strokes as there. Dots for drops ran together.
  const drop = (x) => line([x - 0.4, 18.75], [x + 0.4, 21]);
  add('camp-shower', ['ducha de campamento', 'ducha solar', 'baño', 'regadera', 'camp shower', 'solar shower', 'shower'], [
    hl(2.75, 3.25, 20.75),
    vl(12, 2.75, 5),
    sq(7.25, 5, 9.5, 6.25, 2.25, BR),
    vl(12, 11.25, 13.25),
    'M8.75 15.75A3.25 2.5 0 0 1 15.25 15.75Z',
    drop(8.75),
    drop(12),
    drop(15.25),
  ]);
  FILL['camp-shower'] = { solid: [2, 4], wire: [0, 1, 3], lines: [5, 6, 7] };
  PARTS['camp-shower'] = { branch: [0, 1], bag: [2], hose: [3, 4], drops: [5, 6, 7] };
  MOTION['camp-shower'] = { effect: 'bounce', parts: ['drops'], vector: [0, 1.5] };
}
{
  // Outhouse: a narrow booth under its slanted roof, the crescent cut in its door.
  const roofY = (x) => 6.5 - ((x - 3.75) / 16.5) * 3;
  add('outhouse', ['letrina', 'baño seco', 'sanitario', 'baño', 'outhouse', 'pit toilet', 'restroom'], [
    line([3.75, 6.5], [20.25, 3.5]),
    rl([[6, roofY(6)], [6, 20.75], [18, 20.75], [18, roofY(18)]], [0, 1.25, 0, 0]),
    arc(12, 11.25, 2, 60, 300).d,
  ]);
  FILL.outhouse = { solid: [shut(icons.outhouse.d[1])], wire: [0], cut: [2] };
  PARTS.outhouse = { roof: [0], booth: [1], moon: [2] };
}
// ── Light ─────────────────────────────────────────────────────────────────────────────────────
// The lantern: a ring handle on the domed cap, the glass globe bulging between the cap and the base,
// both wider than the globe (a lantern's waist: the same width made it a gourd); lit, two short rays
// fan out from each side of the globe.
const GLOBE = [12, 12.75];
const LANTERN = (() => {
  const capY = (x) => 8.25 - 2.75 * Math.sqrt(1 - ((x - 12) / 5) ** 2);
  return [
    'M7 8.25A5 2.75 0 0 1 17 8.25Z',
    ellipse(GLOBE, 3.25, 4.5),
    sq(7, 17.25, 10, 3.5, 1.5),
    `M10 ${f(capY(10))}V4.25A2 2 0 0 1 14 4.25V${f(capY(14))}`,
  ];
})();
add('lantern', ['farol', 'linterna de campamento', 'luz', 'iluminación', 'lantern', 'camp light', 'lamp'], [...LANTERN]);
FILL.lantern = { solid: [0, 1, 2], wire: [3] };
PARTS.lantern = { cap: [0], globe: [1], base: [2], handle: [3] };
MOTION.lantern = { effect: 'ring', origin: [12, 2.25] };
{
  const rays = [195, 165, -15, 15].map((a) => line(polar(...GLOBE, 7.25, a), polar(...GLOBE, 9.5, a)));
  add('lantern-on', ['farol encendido', 'luz encendida', 'iluminar', 'noche', 'lantern on', 'light on', 'lit lantern'], [...LANTERN, ...rays]);
  FILL['lantern-on'] = { solid: [0, 1, 2], wire: [3], lines: [4, 5, 6, 7] };
  PARTS['lantern-on'] = { cap: [0], globe: [1], base: [2], handle: [3], rays: [4, 5, 6, 7] };
  MOTION['lantern-on'] = { effect: 'beat', parts: ['rays'], origin: GLOBE };
}
{
  // Headlamp: the band seen at an angle, the lamp at its front and a short beam.
  // The band is fastened to the lamp's housing: it leaves its left side and comes back to its top.
  const lamp = sq(10.25, 11.75, 5.5, 5, 1.75);
  const [c, rx, ry] = [[8.5, 12], 5.75, 3.5];
  const E = (t) => [c[0] + rx * Math.cos(rad(t)), c[1] + ry * Math.sin(rad(t))];
  const t0 = deg(Math.acos((10.25 - c[0]) / rx));
  const t1 = 360 + deg(Math.asin((11.75 - c[1]) / ry));
  const band = `M${pt(E(t0))}A${f(rx)} ${f(ry)} 0 1 1 ${pt(E(t1))}`;
  add('headlamp', ['linterna frontal', 'lámpara de cabeza', 'luz', 'noche', 'headlamp', 'head torch', 'night hike'], [
    lamp,
    band,
    line([18.75, 11.25], [21.25, 10.25]),
    hl(14.25, 18.75, 21.25),
    line([18.75, 17.25], [21.25, 18.25]),
  ]);
  FILL.headlamp = { solid: [0], wire: [1], lines: [2, 3, 4] };
  PARTS.headlamp = { lamp: [0], band: [1], beam: [2, 3, 4] };
  MOTION.headlamp = { effect: 'beat', parts: ['beam'], origin: [18.75, 14.25] };
}

// ── Packs and tools ───────────────────────────────────────────────────────────────────────────
{
  // Hiking pack: the tall pack, its lid's flap held by a buckled strap, the sleeping roll strapped
  // beneath it by two compression straps.
  add('backpack-hiking', ['mochila de montaña', 'mochila de travesía', 'mochilero', 'senderismo', 'hiking backpack', 'backpacking pack', 'trekking pack'], [
    rl([[5.25, 17.25], [5.25, 3.25], [18.75, 3.25], [18.75, 17.25]], [0, 3, 3, 0]),
    'M5.25 7.5C8 9.25 10 9.75 12 9.75S16 9.25 18.75 7.5',
    vl(12, 9.75, 12.75),
    capsule(3.75, 17.25, 16.5, 3.75),
    vl(8.25, 17.25, 21),
    vl(15.75, 17.25, 21),
  ]);
  FILL['backpack-hiking'] = { solid: [shut(icons['backpack-hiking'].d[0]), 3], cut: [1, 2, 4, 5] };
  PARTS['backpack-hiking'] = { pack: [0, 1, 2], roll: [3], straps: [4, 5] };
}
{
  // Dry bag: a tall soft sack, its top rolled down into a narrow band, the band's ends buckled together
  // above it into a handle.
  add('dry-bag', ['bolsa seca', 'bolsa estanca', 'impermeable', 'kayak', 'dry bag', 'waterproof bag', 'roll-top'], [
    capsule(6.5, 7, 11, 3.25),
    rl([[8, 10.25], [6.25, 14.5], [6.25, 21], [17.75, 21], [17.75, 14.5], [16, 10.25]], [0, 3, 2.5, 0, 3, 0]),
    rl([[8.5, 7], [10.25, 3.5], [13.75, 3.5], [15.5, 7]], [0, 1, 1, 0]),
  ]);
  FILL['dry-bag'] = { solid: [0, shut(icons['dry-bag'].d[1])], wire: [2] };
  PARTS['dry-bag'] = { roll: [0], bag: [1], handle: [2] };
}
{
  // Carabiner: a D-shaped ring, the straight gate on one side swung slightly open at its nose.
  const frame = 'M16.75 15.5C16.75 18.75 15 20.25 12.25 20.25H10.75C8.5 20.25 7.25 18.75 7.25 16.25V8C7.25 5.25 8.75 3.75 11.25 3.75H13.25C15.75 3.75 17 5 17 7.5';
  const c = [12, 12];
  add('carabiner', ['mosquetón', 'escalada', 'enganchar', 'seguro', 'carabiner', 'climbing', 'clip'], [turnPath(frame, 20, c), turnPath(line([16.75, 15.5], [15, 10.25]), 20, c)]);
  FILL.carabiner = false;
  PARTS.carabiner = { frame: [0], gate: [1] };
  MOTION.carabiner = { effect: 'wiggle', origin: [12, 3.75] };
}
/**
 * An Archimedean spiral about `c` from radius r0 at angle a0, growing `pitch` per turn for `turns`
 * (clockwise on screen), as cubics.
 */
function spiral(c, r0, pitch, a0, turns) {
  const k = pitch / (2 * Math.PI);
  const P = (t) => {
    const r = r0 + k * t;
    const a = rad(a0) + t;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  };
  const D = (t) => {
    const r = r0 + k * t;
    const a = rad(a0) + t;
    return [k * Math.cos(a) - r * Math.sin(a), k * Math.sin(a) + r * Math.cos(a)];
  };
  const n = Math.round(turns * 12);
  const h = (turns * 2 * Math.PI) / n;
  let d = `M${pt(P(0))}`;
  for (let i = 0; i < n; i++) {
    const [t0, t1] = [i * h, (i + 1) * h];
    d += `C${pt(add2(P(t0), mul(D(t0), h / 3)))} ${pt(sub(P(t1), mul(D(t1), h / 3)))} ${pt(P(t1))}`;
  }
  return { d, end: P(turns * 2 * Math.PI) };
}
{
  // Rope: a coil lying flat, its turns 3 apart, its end leaving the coil's side and hanging below.
  const c = [11, 9.75];
  const s = spiral(c, 1.25, 2.85, 180, 2.5);
  add('rope', ['cuerda', 'soga', 'paracord', 'escalada', 'rope', 'climbing rope', 'paracord'], [`${s.d}V21`]);
  FILL.rope = false;
  PARTS.rope = { rope: [0] };
}
/**
 * A pocket knife's blade opening from the pivot `B` at `a` degrees: its spine straight to the point,
 * its edge running out to a belly that curves up to it; its root (hidden by the handle) at the pivot.
 */
function pocketBlade(B, a, length, w = 4) {
  const u = [Math.cos(rad(a)), Math.sin(rad(a))];
  const n = [-u[1], u[0]];
  const at = (s, v) => add2(add2(B, mul(u, s)), mul(n, v));
  return roundpoly([at(-1, -w / 2 + 0.25), at(length, -w / 2 + 0.25), at(length * 0.6, w / 2), at(-1, w / 2)], [0.4, 0.5, 3, 0.4]);
}
{
  // Folding knife: the handle nearly level with its pivot (in front: a custom badge) and the blade open
  // at a wide angle above it, its spine straight and its edge curving up to the point. A narrow blade
  // rising in line with the handle read as a pen.
  const A = [5.25, 18.5];
  const B = [12.75, 17];
  // r 2.75, so the pivot stays clear of the handle's sides at bold
  const handle = bar(A, B, 2.75);
  add('folding-knife', ['navaja', 'cuchillo plegable', 'herramienta', 'cortar', 'folding knife', 'pocket knife', 'camp tool'], [pocketBlade(B, -64, 13)], {
    badge: { d: [handle, dot(...B, 0.3)], knock: handle, fill: { solid: [handle], cut: [dot(...B, 0.3)] } },
  });
  FILL['folding-knife'] = { solid: [0] };
  PARTS['folding-knife'] = { blade: [0] };
}
{
  // Multi-tool: the folding knife's handle (in front: a custom badge) and two implements opened out of
  // its end like a hand of cards, each on its own pivot so they stay 3 apart where they leave the
  // handle: the blade raised high and the saw, a strip with three teeth along its outer edge.
  // Implements opened from both ends read as a crab; thin lines fanned out, as a burst. No pivot dot:
  // at bold it merged with the handle's end.
  const A = [5, 18.5];
  const B = [12.75, 17];
  const handle = bar(A, B, 2.5);
  const axis = unit(sub(B, A));
  const blade = pocketBlade(sub(B, mul(axis, 2)), -100, 12.25, 3.75);
  const u = [Math.cos(rad(-38)), Math.sin(rad(-38))];
  const n = [-u[1], u[0]];
  const at = (s, v) => add2(add2(B, mul(u, s)), mul(n, v));
  const teeth = [];
  for (let k = 9.5; k > 4; k -= 2) teeth.push(at(k, 1.5), at(k - 1, 2.75));
  const saw = roundpoly([at(-1, -1.5), at(10.5, -1.5), at(10.5, 1.5), ...teeth, at(-1, 1.5)], [0.3, 0.6, 0.4, ...teeth.map(() => 0.2), 0.3]);
  add('multi-tool', ['multiherramienta', 'navaja suiza', 'herramienta', 'reparar', 'multi-tool', 'utility tool', 'repairs'], [blade, saw], {
    badge: { d: [handle], knock: handle, fill: { solid: [handle] } },
  });
  FILL['multi-tool'] = { solid: [0, 1] };
  PARTS['multi-tool'] = { blade: [0], saw: [1] };
}

{
  // Locator beacon: a small rugged handset with its SOS button, the stubby antenna and two signal
  // arcs rising from its tip.
  const tip = [11.25, 5.75];
  add('emergency-beacon', ['radiobaliza', 'baliza de emergencia', 'sos', 'rescate', 'emergency beacon', 'personal locator beacon', 'satellite sos'], [
    sq(4.25, 9.75, 10, 11.5, 3, BR),
    circ(9.25, 15.5, 2),
    vl(tip[0], 9.75, tip[1]),
    arc(...tip, 3.25, -60, 15).d,
    arc(...tip, 6.25, -35, 20).d,
  ]);
  FILL['emergency-beacon'] = { solid: [0], cut: [1], wire: [2], lines: [3, 4] };
  PARTS['emergency-beacon'] = { body: [0], button: [1], antenna: [2], wave: [3, 4] };
  MOTION['emergency-beacon'] = { effect: 'beat', parts: ['wave'], origin: tip };
  icons['emergency-beacon'].levels = [[3], [4]];
}
{
  // Trekking poles: two poles side by side, leaning, each with its long grip and its snow basket near
  // the tip (drawn once, upright, turned and repeated). Crossed in an X they read as crossed swords,
  // and the wrist straps turned the grips into keys.
  // The baskets keep 3.5 between them, so they stay apart at bold
  const up = [capsule(10.75, 2.75, 2.5, 6), vl(12, 8.75, 21.5), ellipse([12, 18.25], 2.25, 1.25)];
  const pole = (dx) => up.map((d) => turnPath(transform(d, 1, dx, 0), -12, [12 + dx, 12.25]));
  const [a, b] = [pole(-4.25), pole(4.25)];
  add('trekking-poles', ['bastones de senderismo', 'bastones de trekking', 'caminata', 'marcha nórdica', 'trekking poles', 'hiking poles', 'nordic walking'], [a[0], a[1], a[2], b[0], b[1], b[2]]);
  FILL['trekking-poles'] = { solid: [0, 2, 3, 5], wire: [1, 4] };
  PARTS['trekking-poles'] = { grips: [0, 3], poles: [1, 4], baskets: [2, 5] };
}
{
  // Hiking boot in profile, its toe to the right: a high ankle with two lace hooks across its front
  // edge, on a thick sole with a raised arch.
  const front = [[11.25, 3.25], [12.75, 10.25]];
  const upper = rl([[4.5, 17], [4.75, 3.25], ...front, [18.75, 13.25], [20.5, 15.25], [20.5, 17]], [0, 1, 1, 2.5, 2, 1.5, 0]);
  const sole = roundpoly([[3.25, 17], [21.25, 17], [21.25, 21], [13.75, 21], [12.75, 20], [9.25, 20], [8.25, 21], [3.25, 21]], [1, 1, 1, 0.5, 0.5, 0.5, 0.5, 1]);
  const u = unit(sub(front[1], front[0]));
  const n = [-u[1], u[0]];
  const hookAt = (t) => {
    const p = lerp(front[0], front[1], t);
    return line(sub(p, mul(n, 1.4)), add2(p, mul(n, 1.4)));
  };
  add('boot-hiking', ['bota de montaña', 'bota de senderismo', 'calzado', 'senderismo', 'hiking boot', 'trail boot', 'hiking footwear'], [upper, sole, hookAt(0.3), hookAt(0.75)]);
  // Filled, the hooks stay ink, standing out of the front edge: cut out, they split the collar at bold
  FILL['boot-hiking'] = { solid: [shut(upper), 1], wire: [2, 3] };
  PARTS['boot-hiking'] = { upper: [0], sole: [1], laces: [2, 3] };
}
{
  // Ranger's campaign hat from the front: the crown pinched up to its peak, its band, over a flat wide
  // brim.
  const brim = ellipse([12, 16.5], 9.25, 2.25);
  const yb = (x) => 16.5 - 2.25 * Math.sqrt(1 - ((x - 12) / 9.25) ** 2);
  const crown = `M6.25 ${f(yb(6.25))}C6.25 10.5 7.75 9.25 9.25 8L11 6.4Q12 5.5 13 6.4L14.75 8C16.25 9.25 17.75 10.5 17.75 ${f(yb(17.75))}`;
  const xs = (y) => {
    // The crown's sides at y, sampled from its left cubic
    const P = [[6.25, yb(6.25)], [6.25, 10.5], [7.75, 9.25], [9.25, 8]];
    let best = [0, 1e9];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const q = (k) => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k];
      if (Math.abs(q(1) - y) < best[1]) best = [q(0), Math.abs(q(1) - y)];
    }
    return best[0];
  };
  add('ranger-hat', ['guardabosques', 'sombrero de guardaparques', 'ranger', 'parque', 'park ranger', 'campaign hat', 'ranger'], [brim, crown, hl(11.25, xs(11.25), 24 - xs(11.25))]);
  FILL['ranger-hat'] = { solid: [0, shut(crown)], cut: [2] };
  PARTS['ranger-hat'] = { brim: [0], crown: [1, 2] };
  MOTION['ranger-hat'] = { effect: 'wiggle', origin: [12, 17] };
}
{
  // Waders from the front: the bib on its two straps, the legs ending in attached boots whose toes
  // turn out, a seam where each boot begins.
  const half = [[12, 6], [15.5, 6], [15.5, 9.5], [18.25, 11], [18.25, 16.75], [21.25, 19], [21.25, 21], [13.5, 21], [13.5, 14.75], [12, 13.25]];
  const pts = [...half, ...half.slice(1, -1).reverse().map(([x, y]) => [24 - x, y])];
  const rr = [0, 0.75, 0.6, 1, 0.6, 1.25, 0.75, 0.5, 1.5, 1.5, 0.5, 0.75, 1.25, 0.6, 1, 0.6, 0.75];
  const body = roundpoly(pts, rr);
  add('waders', ['botas de pesca', 'vadeadores', 'pesca con mosca', 'río', 'waders', 'chest waders', 'fly fishing'], [
    body,
    line([15.5, 6], [16.75, 2.75]),
    line([8.5, 6], [7.25, 2.75]),
    hl(16.75, 13.5, 18.25),
    hl(16.75, 5.75, 10.5),
  ]);
  FILL.waders = { solid: [0], wire: [1, 2], cut: [3, 4] };
  PARTS.waders = { body: [0], straps: [1, 2], boots: [3, 4] };
}
{
  // Ice axe, held at a slant: the shaft with its spike at the foot, the head across its top, a long
  // curved pick on one side and the flat adze on the other.
  const head = 'M13.5 6.75Q17.25 7.25 20.5 9.6Q21.25 10.1 21 9.25Q18.75 3.75 12 3L4.75 3.75Q4 3.85 4 4.6V5.4Q4 6.15 4.75 6.2L10.5 6.75Z';
  const shaft = 'M10.5 6.75V17.25L12 21.25L13.5 17.25V6.75';
  const tilt = (d) => transform(turnPath(d, -30, [12, 12]), 1, 0.75, 0.25);
  add('ice-axe', ['piolet', 'alpinismo', 'glaciar', 'montañismo', 'ice axe', 'mountaineering', 'alpine climbing'], [tilt(head), tilt(shaft)]);
  FILL['ice-axe'] = { solid: [0, shut(tilt(shaft))] };
  PARTS['ice-axe'] = { head: [0], shaft: [1] };
  MOTION['ice-axe'] = { effect: 'wiggle', origin: [12, 21] };
}
{
  // Sled in profile: the seat (one plank: slats cut across it made a battery) on two struts, the
  // runner sweeping forward under it and curling up at the front to the seat's nose.
  const seat = capsule(2.75, 8.75, 14.5, 3);
  add('sled', ['trineo', 'deslizarse', 'nieve', 'invierno', 'sled', 'sledding', 'toboggan'], [
    seat,
    vl(6.25, 11.75, 16.5),
    vl(13, 11.75, 16.5),
    'M2.75 16.5H16.25A3.75 3.75 0 0 0 16.25 9',
  ]);
  FILL.sled = { solid: [0], wire: [1, 2, 3] };
  PARTS.sled = { seat: [0], struts: [1, 2], runner: [3] };
}

// ── The trail ─────────────────────────────────────────────────────────────────────────────────
// The trail: a ridge of two peaks on the horizon and the footpath winding up toward their foot in
// dashes that shorten as they recede (3 apart). The path keeps 7.25 from the badge's center, so trail-*
// take the engine's badges whole, and stops well short of the ridge. Two round hills read as a
// moustache; an S-bend in the path, as a question mark.
const HILLS = rl([[2.75, 12.75], [7.75, 6.5], [11, 9.75], [15.5, 4.25], [21.25, 11.25]], [0, 1, 1, 1.25, 0]);
const TRAIL = (() => {
  const P = [[2.75, 21.25], [8.5, 20.75], [9.75, 17.5], [10, 12.25]];
  const B = (t) => [0, 1].map((k) => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k]);
  // Arc length table, to cut the dashes along it
  const N = 400;
  const at = [0];
  for (let i = 1; i <= N; i++) at.push(at[i - 1] + len(sub(B(i / N), B((i - 1) / N))));
  const tOf = (s) => {
    const i = at.findIndex((v) => v >= s);
    return (i < 0 ? N : i) / N;
  };
  const dash = (s0, s1) => {
    const ts = Array.from({ length: 9 }, (_, k) => tOf(s0 + ((s1 - s0) * k) / 8));
    return `M${pt(B(ts[0]))}${ts.slice(1).map((t) => `L${pt(B(t))}`).join('')}`;
  };
  const total = at[N];
  return [dash(0, total - 10.5), dash(total - 7.5, total - 5.25), dash(total - 2.25, total)];
})();
add('trail', ['sendero', 'ruta de senderismo', 'camino', 'caminata', 'trail', 'hiking trail', 'footpath'], [HILLS, ...TRAIL]);
FILL.trail = false;
PARTS.trail = { hills: [0], path: [1, 2, 3] };
for (const [kind, tags] of [
  ['check', ['sendero completado', 'ruta terminada', 'caminata hecha', 'senderismo', 'trail completed', 'hike done', 'completed route']],
  ['alert', ['aviso de sendero', 'sendero cerrado', 'peligro en la ruta', 'condiciones', 'trail alert', 'trail closure', 'trail conditions']],
]) {
  add(`trail-${kind}`, tags, [HILLS, ...TRAIL], { badge: badge(kind) });
  FILL[`trail-${kind}`] = false;
  PARTS[`trail-${kind}`] = { hills: [0], path: [1, 2, 3] };
  MOTION[`trail-${kind}`] = BADGE_MOTION[kind];
}
{
  // Trailhead: the information board and its gabled roof in one outline (the eaves stand out past the
  // board), two lines of notice on it, standing on two legs. Posts with the board as two bars between
  // them read as a gate.
  const board = roundpoly([[5, 18], [5, 9], [2.75, 9], [12, 3.25], [21.25, 9], [19, 9], [19, 18]], [1.25, 0.4, 0.6, 1, 0.6, 0.4, 1.25]);
  add('trailhead', ['inicio de sendero', 'tablero de información', 'punto de partida', 'senderismo', 'trailhead', 'trail info', 'information board'], [
    board,
    hl(12, 8, 16),
    hl(15, 8, 13.5),
    vl(8, 18, 21.25),
    vl(16, 18, 21.25),
  ]);
  FILL.trailhead = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS.trailhead = { board: [0, 1, 2], legs: [3, 4] };
}
{
  // Switchbacks: a zigzag path climbing the face of a slope, each leg 3 inside its sides.
  const P = [[2.75, GROUND], [12, 3.25], [21.25, GROUND]];
  const slope = roundpoly(P, [1, 1.25, 1]);
  const k = (P[1][0] - P[0][0]) / (P[0][1] - P[1][1]);
  const inset = 3 / Math.sin(Math.atan(1 / k));
  const L = (y) => P[1][0] - (y - P[1][1]) * k + inset;
  const R = (y) => P[1][0] + (y - P[1][1]) * k - inset;
  const zig = rl([[8.5, GROUND], [R(16.75), 16.75], [L(13.25), 13.25], [R(9.75), 9.75]], [0, 0.75, 0.75, 0]);
  add('switchbacks', ['zigzag', 'curvas de sendero', 'pendiente', 'subida', 'switchbacks', 'steep trail', 'zigzag trail'], [slope, zig]);
  FILL.switchbacks = { solid: [0], cut: [1] };
  PARTS.switchbacks = { slope: [0], path: [1] };
}
{
  // Stream crossing: three flat river stones stepping across the water on a diagonal, the water a wave
  // on either side of them, 3 clear of every stone. Thin ellipses for stones read as letters.
  const pebble = ([cx, cy], a) =>
    roundpoly(turnPts([[-0.5, 0.05], [-0.3, -0.45], [0.2, -0.5], [0.5, -0.05], [0.35, 0.45], [-0.25, 0.5]].map(([x, y]) => [cx + x * 6.25, cy + y * 4.25]), a, [cx, cy]), 1.25);
  const stones = [pebble([6.25, 18.25], 0), pebble([12, 12], 0), pebble([17.75, 5.75], 0)];
  add('stream-crossing', ['cruce de río', 'vado', 'piedras', 'arroyo', 'stream crossing', 'river ford', 'stepping stones'], [...stones, ripple([2.75, 5.5], 3), ripple([12.25, 18.5], 3)]);
  FILL['stream-crossing'] = { solid: [0, 1, 2], lines: [3, 4] };
  PARTS['stream-crossing'] = { stones: [0, 1, 2], water: [3, 4] };
}

// ── The park ──────────────────────────────────────────────────────────────────────────────────
{
  // National park: the entrance gate (a log crossbeam overhanging two posts, in front: a custom badge)
  // and the snowy peak seen through it, its feet behind the posts. Posts drawn as logs left the peak a
  // chevron in a doorway.
  const beam = capsule(2.75, 3.25, 18.5, 3);
  const posts = [vl(5.25, 6.25, 21), vl(18.75, 6.25, 21)];
  const P = [[5.25, 19.5], [12, 9.25], [18.75, 19.5]];
  const peak = rl(P, [0, 1.25, 0]);
  const k = (P[1][0] - P[0][0]) / (P[0][1] - P[1][1]);
  const snow = line([12 - (13.25 - 9.25) * k, 13.25], [10.75, 14.5], [12.25, 13], [12 + (13.75 - 9.25) * k, 13.75]);
  add('national-park', ['parque nacional', 'área protegida', 'reserva', 'naturaleza', 'national park', 'protected area', 'park'], [peak, snow], {
    badge: { d: [beam, ...posts], knock: `${beam}${posts.map(there).join('')}`, fill: { solid: [beam], wire: posts } },
  });
  FILL['national-park'] = { solid: [`${icons['national-park'].d[0]}V21H5.25Z`], cut: [1] };
  PARTS['national-park'] = { mountain: [0], snow: [1] };
}
const CARD = comunicacion.icons['id-card'].d;
{
  // Park pass: the set's id-card with a pine (lugares' construction) in the photo's place.
  const crown = roundpoly([[8.25, 8], [11, 14], [5.5, 14]], [0.75, 0.75, 0.75]);
  add('park-pass', ['pase de parque', 'permiso de entrada', 'pase anual', 'entrada', 'park pass', 'entry permit', 'annual pass'], [CARD[0], crown, vl(8.25, 14, 16), CARD[3], CARD[4]]);
  FILL['park-pass'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['park-pass'] = { card: [0], tree: [1, 2], lines: [3, 4] };
}
{
  // Fire lookout: a small cabin under its hipped roof, its catwalk, on four splayed stilts (two seen)
  // with a cross brace.
  const legL = [[7.75, 12], [4.25, 21]];
  const legR = [[16.25, 12], [19.75, 21]];
  const on = (leg, y) => lerp(leg[0], leg[1], (y - leg[0][1]) / (leg[1][1] - leg[0][1]));
  add('fire-lookout', ['torre de vigilancia', 'mirador', 'vigía de incendios', 'torre', 'fire lookout', 'lookout tower', 'watchtower'], [
    roundpoly([[9.5, 3], [14.5, 3], [19.25, 7], [4.75, 7]], [0.75, 0.75, 0.75, 0.75]),
    `M7 7V12M17 7V12`,
    hl(12, 4.5, 19.5),
    line(...legL),
    line(...legR),
    line(on(legL, 15), on(legR, 19.5)),
    line(on(legR, 15), on(legL, 19.5)),
  ]);
  FILL['fire-lookout'] = { solid: [0, 'M7 7H17V12H7Z'], wire: [1, 2, 3, 4, 5, 6] };
  PARTS['fire-lookout'] = { roof: [0], cabin: [1, 2], stilts: [3, 4, 5, 6] };
}

// ── Fishing ───────────────────────────────────────────────────────────────────────────────────
// One hook for the set's fishing: a J, its shank down to a round bend and the point rising, a barb
// folded back from it (one stroke, so the barb never stands near another piece).
function hook(x, top, r = 4, rise = 4.25, barb = true) {
  const yb = top;
  const R = halfChord([x, yb], [x - 2 * r, yb]);
  const tip = [x - 2 * r, yb - rise];
  return `V${f(yb)}A${R} ${R} 0 0 1 ${pt([x - 2 * r, yb])}V${f(tip[1])}${barb ? `L${pt([tip[0] + 1.75, tip[1] + 2])}` : ''}`;
}
{
  // Fishing rod: the rod rising at a slant from the grip, its reel hanging on a short foot, the line
  // falling from the tip to the hook.
  const butt = [3.25, 20.75];
  const tipR = [18.75, 3.25];
  const u = unit(sub(tipR, butt));
  const n = [-u[1], u[0]];
  const footA = add2(butt, mul(u, 5));
  const reelC = add2(footA, mul(n, -3.75));
  add('fishing-rod', ['caña de pescar', 'pesca', 'pescar', 'aparejo', 'fishing rod', 'fishing', 'rod'], [
    line(butt, tipR),
    line(footA, add2(footA, mul(n, -2.25))),
    circ(...reelC, 1.5),
    `M${pt(tipR)}${hook(tipR[0], 16.5, 1.75, 1.75, false)}`,
  ]);
  FILL['fishing-rod'] = { solid: [2], wire: [0, 1, 3] };
  PARTS['fishing-rod'] = { rod: [0], reel: [1, 2], line: [3] };
  MOTION['fishing-rod'] = { effect: 'wiggle', origin: butt };
}
{
  // Reel from the side: the round spool with the line wound on it, the crank reaching out level to its
  // knob, the foot that mounts it on the rod.
  const C = [10.75, 13.5];
  add('fishing-reel', ['carrete', 'carrete de pesca', 'pesca', 'lanzar', 'fishing reel', 'spinning reel', 'reel'], [
    circ(...C, 5.75),
    circ(...C, 2.75),
    hl(C[1], C[0] + 5.75, 19.25),
    vl(19.25, C[1] - 1.75, C[1] + 1.75),
    vl(C[0], C[1] - 5.75, 4.75),
    hl(4.75, 6.25, 15.25),
  ]);
  FILL['fishing-reel'] = { solid: [0], cut: [1], wire: [2, 3, 4, 5] };
  PARTS['fishing-reel'] = { spool: [0, 1], crank: [2, 3], foot: [4, 5] };
  MOTION['fishing-reel'] = { effect: 'spin', parts: ['spool'], origin: C };
}
{
  // Fish hook: the eye at the top, the shank, the bend, the point and its barb.
  add('fish-hook', ['anzuelo', 'pesca', 'aparejo', 'pescar', 'fish hook', 'hook', 'tackle'], [circ(14.25, 4.5, 1.75), `M14.25 6.25${hook(14.25, 14.5, 4, 4.25)}`]);
  FILL['fish-hook'] = false;
  PARTS['fish-hook'] = { eye: [0], hook: [1] };
  MOTION['fish-hook'] = { effect: 'wiggle', origin: [14.25, 4.5] };
}
{
  // Lure: a crankbait in lugares' fish shape (its eye moved in from the edge so it stays clear at this
  // size), the diving lip under its nose and one hook hanging from its belly. A plain oval with two
  // hooks under it read as an animal on its legs, the lip as its trunk.
  const s = 0.85;
  const to = [12.75, 9.25];
  const at = (p) => placePt(p, s, [12, 12], to);
  const [body, tail] = L.fish.d.slice(0, 2).map((d) => place(d, s, [12, 12], to));
  const C = at([9.01, 12]);
  const r = 5.75 * s;
  const lipFrom = polar(...C, r, 150);
  const bx = 11.75;
  const belly = [bx, C[1] + Math.sqrt(r * r - (bx - C[0]) ** 2)];
  add('fishing-lure', ['señuelo', 'carnada artificial', 'pesca', 'aparejo', 'fishing lure', 'crankbait', 'lure'], [
    body,
    tail,
    dot(...at([7.4, 11.15])),
    line(lipFrom, [2.75, 14.5]),
    `M${pt(belly)}${hook(bx, 18.25, 1.75, 1.75, false)}`,
  ]);
  FILL['fishing-lure'] = { solid: [0, 1], cut: [2], wire: [3, 4] };
  PARTS['fishing-lure'] = { body: [0, 1, 2], lip: [3], hook: [4] };
}
{
  // Bait: a worm, an S-shaped tube with round ends (its centerline two half circles, its sides
  // concentric arcs 3 apart), threaded on the hook: it hangs in front of the hook's bend (a custom
  // badge: the engine clears the hook behind it), the eye and the shank standing above. A worm drawn
  // as a single line around the shank read as a letter.
  const worm = place('M3 12A5 5 0 0 1 13 12A2 2 0 0 0 17 12A1.5 1.5 0 0 1 20 12A5 5 0 0 1 10 12A2 2 0 0 0 6 12A1.5 1.5 0 0 1 3 12Z', 0.85, [12, 12], [10.5, 15.5]);
  add('bait', ['carnada', 'lombriz', 'gusano', 'cebo', 'bait', 'worm', 'live bait'], [circ(17.75, 4.5, 1.5), `M17.75 6${hook(17.75, 14.5, 3.5, 2.5)}`], {
    badge: { d: [worm], knock: worm, fill: { solid: [worm] } },
  });
  FILL.bait = { solid: [0], wire: [1] };
  PARTS.bait = { hook: [0, 1] };
  MOTION.bait = { effect: 'wiggle', parts: ['badge'], origin: [10.5, 15.5] };
}
{
  // Bobber: the round float whole, split across its middle by its band, its stem on top, riding over the
  // water. Sunk to its middle in the water it read as a sunset, and with the line running from its stem
  // up to the rod, as a cable car.
  const C = [12, 11];
  const R = 5;
  const water = ripple([3, 20], 6);
  add('bobber', ['boya', 'flotador', 'pesca', 'picada', 'bobber', 'fishing float', 'bite indicator'], [circ(...C, R), hl(C[1], C[0] - R, C[0] + R), vl(12, C[1] - R, 2.75), water]);
  FILL.bobber = { solid: [0], cut: [1], wire: [2], lines: [3] };
  PARTS.bobber = { float: [0, 1, 2], water: [3] };
  MOTION.bobber = { effect: 'float', parts: ['float'], vector: [0, -1] };
}
{
  // Landing net: the hoop on its short handle, the deep mesh bag hanging from its front edge.
  const [c, rx, ry] = [[14.5, 7.25], 6.25, 3.25];
  const front = (x) => c[1] + ry * Math.sqrt(1 - ((x - c[0]) / rx) ** 2);
  const L0 = [10.5, front(10.5)];
  const R0 = [19.25, front(19.25)];
  add('landing-net', ['red de pesca', 'sacadera', 'pesca', 'atrapar', 'landing net', 'fishing net', 'net'], [
    ellipse(c, rx, ry),
    line([c[0] - rx, c[1]], [3.5, 20.75]),
    `M${pt(L0)}C10.5 15.5 12.25 19.75 14.75 19.75C17.25 19.75 19.25 15.5 ${pt(R0)}`,
    line([13.25, front(13.25)], [18.6, 15.5]),
    line([16.5, front(16.5)], [11.05, 15.75]),
  ]);
  FILL['landing-net'] = false;
  PARTS['landing-net'] = { hoop: [0], handle: [1], net: [2, 3, 4] };
}
{
  // Tackle box: the open box with its handle, the two cantilever trays raised out of it to either side
  // on their arms, 3 clear of the handle and of each other (crowded around the handle, they merged
  // into one lid at bold).
  const pivotL = [10, 8.5];
  const pivotR = [14, 8.5];
  const trayL = turnPath(sq(2.75, 5.5, 7.25, 3, 1.25), -12, pivotL);
  const trayR = turnPath(sq(14, 5.5, 7.25, 3, 1.25), 12, pivotR);
  const [armL] = turnPts([[6.25, 8.5]], -12, pivotL);
  const [armR] = turnPts([[17.75, 8.5]], 12, pivotR);
  add('tackle-box', ['caja de pesca', 'caja de aparejos', 'pesca', 'guardar', 'tackle box', 'fishing box', 'tackle'], [
    sq(4.25, 14, 15.5, 7.25, 2.5, BR),
    'M10.25 14V12.75A1.75 1.75 0 0 1 13.75 12.75V14',
    trayL,
    trayR,
    line(armL, [7, 14]),
    line(armR, [17, 14]),
  ]);
  FILL['tackle-box'] = { solid: [0, 2, 3], wire: [1, 4, 5] };
  PARTS['tackle-box'] = { box: [0], handle: [1], trays: [2, 3, 4, 5] };
}
{
  // Catch: lugares' fish with the engine's check badge, a catch landed and logged. Hanging from its
  // line, the fish read as a map pin (upright: its round body over its point) or as a b or a 6 (tipped);
  // the fish is only a fish lying level. It sits up and left, clear of the badge, so it stays whole.
  // Its eye moved in from the edge (as fishing-lure's), so it stays clear of the outline at bold
  const s = 0.82;
  const fish = [...L.fish.d.slice(0, 2).map((d) => place(d, s, [3.25, 6.25], [2.75, 3.5])), dot(...placePt([7.4, 11.15], s, [3.25, 6.25], [2.75, 3.5]))];
  add('fish-catch', ['captura', 'pesca del día', 'pez atrapado', 'pesca', 'fish catch', 'catch', 'catch log'], fish, { badge: badge('check') });
  FILL['fish-catch'] = { solid: [0, 1], cut: [2] };
  PARTS['fish-catch'] = { body: [0, 1, 2] };
  MOTION['fish-catch'] = BADGE_MOTION.check;
}
{
  // Fishing: the whole figure (fitness' construction) standing in profile, casting: the rod up and
  // forward from the hands, the line falling from its tip into the water ahead. A line curving down
  // to a float drawn as a dot read as a question mark.
  const P = [7.75, 14];
  const S = go(P, -95, 5.5);
  const H = go(S, -100, 1.9 + 2.35);
  const hand = [11.25, 10.5];
  const tipR = [19.75, 3.25];
  const water = ripple([14.25, 19.25], 2);
  add('fishing', ['pescar', 'pesca', 'pesca deportiva', 'actividades', 'fishing', 'angling', 'go fishing'], [
    circ(...H, 1.9),
    line(S, P),
    rl([P, [6, 17.5], [5.25, 21]], [0, 0.6, 0]),
    rl([P, [10, 17.25], [10.75, 21]], [0, 0.6, 0]),
    rl([S, [9.5, 11.25], hand], [0, 0.6, 0]),
    line(hand, tipR),
    `M${pt(tipR)}Q21 10 20.25 19.25`,
    water,
  ]);
  FILL.fishing = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7] };
  PARTS.fishing = { head: [0], body: [1], legs: [2, 3], arms: [4], rod: [5], line: [6], water: [7] };
  MOTION.fishing = { effect: 'wiggle', parts: ['rod', 'line'], origin: hand };
}
{
  // Fishing license: the set's id-card laid out as mascotas' id-card-paw (the glyph large on the left,
  // two short lines on the right), the glyph lugares' fish filling the band between them, 3 clear of
  // the card and of the lines: its body, its eye (a small dot at the middle of the body, clear of the
  // edge at every weight) and its tail open as a V, since a closed tail this small is a hole that shuts
  // at bold. Without the eye, the round body and the V read as the sign ∝.
  const s = 0.46;
  const cx = 5.35 + (12 - 3.26) * s;
  const at = (d) => place(d, s, [12, 12], [cx, 12]);
  const fish = [at(L.fish.d[0]), at(line([21, 9.25], [17.13, 12], [21, 14.75])), dot(cx + (9.01 - 12) * s, 12, 0.3)];
  add('id-card-fish', ['licencia de pesca', 'permiso de pesca', 'credencial', 'pesca', 'fishing license', 'fishing permit', 'license'], [CARD[0], ...fish, hl(10.5, 16.5, 18.5), hl(14, 16.5, 18.5)]);
  FILL['id-card-fish'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['id-card-fish'] = { card: [0], fish: [1, 2, 3], lines: [4, 5] };
}

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing; these didn't read after it (a pole, a spiral or baffles a pixel from
// the outline, a drop inside a small flame, stones run into their waves). Each keeps fewer pieces, at
// least a pixel apart, the new strokes on pixel centers (0.75 + 1.5k).
{
  const small = (name, d, fill, badge) => {
    icons[name].small = { d, ...(fill && { fill }), ...(badge && { badge }) };
  };
  // lugares' water at 16 px: waves of amplitude 1.5 whose crests fall on pixel centers
  const wave16 = (y, x0, n) => ripple([x0, y], n, 3, 1.5);
  const D = (name) => icons[name].d;
  // Dome: the shell and the door, without the pole
  small('tent-dome', [D('tent-dome')[0], D('tent-dome')[2]], { solid: [D('tent-dome')[0]], cut: [D('tent-dome')[2]] });
  // Tunnel: the hoops 3 pixels apart and 2 pixels lower each, the door smaller
  {
    const t = tunnel([[2.25, 12.75, 6.75], [7.5, 17.25, 9.75], [12.75, 21.75, 12.75]], 20.25, 0.7, 7.5);
    small('tent-tunnel', t.d, t.fill);
  }
  // Sleeping bag and pad: the bag with its hood, the roll and the mat
  small('sleeping-bag', D('sleeping-bag').slice(0, 2), { solid: [D('sleeping-bag')[0]], cut: [D('sleeping-bag')[1]] });
  small('sleeping-pad', [D('sleeping-pad')[0], D('sleeping-pad')[2]], { solid: [D('sleeping-pad')[0], shut(D('sleeping-pad')[2])] });
  // Rope: a turn and a half 3 pixels apart
  {
    const s = spiral([11.25, 9.75], 1, 4.5, 180, 1.5);
    small('rope', [`${s.d}V21`]);
  }
  // Stove: without the supports, a pixel from the burner
  {
    const d = [0, 1, 2, 5].map((i) => D('camp-stove')[i]);
    small('camp-stove', d, { solid: [d[0], d[2]], wire: [d[1]], lines: [d[3]] });
  }
  // Stream crossing: the stones as 3 × 2 pixel blobs on the diagonal, the waves at 16 px
  {
    const stones = [capsule(3.75, 17.25, 4.5, 3), capsule(9.75, 11.25, 4.5, 3), capsule(15.75, 5.25, 4.5, 3)];
    const d = [...stones, wave16(6.75, 2.25, 3), wave16(18.75, 12.75, 3)];
    small('stream-crossing', d, { solid: stones, lines: d.slice(3) });
  }
  // Straw filter: the tube and one wave at 16 px
  {
    const w = wave16(18.75, 2.25, 6);
    small('water-filter-straw', D('water-filter-straw').slice(0, 2), { solid: [D('water-filter-straw')[0], shut(D('water-filter-straw')[1])] }, { d: [w], knock: there(w) });
  }
  // Reel: the spool without the line wound on it
  {
    const d = D('fishing-reel').filter((_, i) => i !== 1);
    small('fishing-reel', d, { solid: [d[0]], wire: d.slice(1) });
  }
  // Match: the flame without its drop
  small('matchstick', [D('matchstick')[0], D('matchstick')[2]], { solid: [D('matchstick')[0]], wire: [D('matchstick')[2]] });
  // Fishing license: a round body 3 pixels across, its V tail and the two lines on pixel rows
  {
    const d = [CARD[0], circ(7.5, 12, 2.25), line([12.75, 9.75], [9.75, 12], [12.75, 14.25]), hl(9.75, 15.75, 18.75), hl(14.25, 15.75, 18.75)];
    small('id-card-fish', d, { solid: [d[0]], cut: d.slice(1) });
  }
  // Camp shower: the drops straight down and 2 pixels apart, under a flatter head
  {
    const d = [hl(2.25, 3.75, 20.25), vl(12.75, 2.25, 5.25), sq(8.25, 5.25, 9, 6, 2, BR), vl(12.75, 11.25, 14.25), 'M9.75 17.25A3 3 0 0 1 15.75 17.25Z', ...[9.75, 12.75, 15.75].map((x) => vl(x, 19.5, 21.75))];
    small('camp-shower', d, { solid: [d[2], d[4]], wire: [d[0], d[1], d[3]], lines: d.slice(5) });
  }
}

// ── Fill, parts, motion, mirror, levels, variants ─────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// Mirror: what has a direction of its own flips in right-to-left languages, as in the rest of the set:
// a vehicle seen from the side (vehiculos), a figure in motion (fitness) and a card laid out with its
// lines after the picture (comunicacion's id-card, mascotas' id-card-paw)
for (const name of ['rooftop-tent', 'sled', 'fishing', 'park-pass', 'id-card-fish']) icons[name].mirror = true;

// Variants: with a badge (as in comercio and fitness) the enclosures lose the piece on top and the
// slash would cross it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };

export default { category: 'camping', label: 'Aire libre y campamento', icons };
