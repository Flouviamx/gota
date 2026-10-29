// Conducción y tránsito vial (driving and the road): the driver's seat and its controls, the
// dashboard tell-tales (ISO 2575 concepts drawn as Gota geometry, never copied), the engine bay,
// tires and brakes, the glass, keys, fuel and charging, the workshop, the street and its signs.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md. A few
// pieces carry whole families: the steering wheel (a ring, a hub and three spokes), the tire seen
// head-on, the wheel seen from the side, the D-shaped lamp, the windshield trapezoid, the seat in
// profile, the seated figure, one top view and one side view of a car for the driver aids (lugares'
// car from the front for everything else), and one frame per kind of road sign: the warning diamond
// is lugares' directions sign, shared by every road-sign-*. The adopted icons (gas-station,
// ev-charger, parking, traffic-light, road) live in lugares and are built on, never redrawn, and
// every badge is the engine's.
import { arc, badge, circ, dot, f, flipPath, gear, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comunicacion from './comunicacion.mjs';
import datos from './datos.mjs';
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
const BR = { square: ['br'] };
const BC = [17.25, 17.25];
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
/** Moves a path by (dx, dy). */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales a path by `s` around `c`, then moves it by (dx, dy). */
const scale = (d, s, c = [12, 12], dx = 0, dy = 0) => transform(d, s, c[0] * (1 - s) + dx, c[1] * (1 - s) + dy);
/** Points moved like `scale`. */
const scalePt = (p, s, c = [12, 12], dx = 0, dy = 0) => [c[0] + (p[0] - c[0]) * s + dx, c[1] + (p[1] - c[1]) * s + dy];

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as hogar's. */
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
    const S = add2(V, mul(u, t));
    const E = add2(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Capsule (stadium) between the centers of its two round ends, `a` and `b`, of radius `r`. */
function stadium(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1], u[0]];
  const [a1, b1, b2, a2] = [add2(a, mul(n, r)), add2(b, mul(n, r)), add2(b, mul(n, -r)), add2(a, mul(n, -r))];
  const R1 = halfChord(b1, b2);
  const R2 = halfChord(a2, a1);
  return `M${pt(a1)}L${pt(b1)}A${R1} ${R1} 0 0 0 ${pt(b2)}L${pt(a2)}A${R2} ${R2} 0 0 0 ${pt(a1)}Z`;
}

/** Ellipse with semi-axes rx, ry (four cubics). */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}

/** Water drop, its point up (lugares' droplet): the circle (c, r) and the point √2·r above it. */
function droplet([cx, cy], r) {
  const a = polar(cx, cy, r, -45);
  const b = polar(cx, cy, r, -135);
  return `M${pt(a)}A${f(r)} ${f(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
}

/** A wavy line rising from (x, yBot) to (x, yTop) in `halves` half waves of amplitude `a`. */
function waveV(x, yTop, yBot, a = 1, halves = 2) {
  const h = (yBot - yTop) / halves;
  const k = (4 / 3) * a;
  let s = `M${pt([x, yBot])}`;
  for (let i = 0; i < halves; i++) {
    const y0 = yBot - i * h;
    const dir = i % 2 ? -1 : 1;
    s += `C${pt([x + dir * k, y0 - h * 0.25])} ${pt([x + dir * k, y0 - h * 0.75])} ${pt([x, y0 - h])}`;
  }
  return s;
}
/** The same wave lying down, from (x0, y) to (x1, y). */
function waveH(y, x0, x1, a = 1, halves = 2) {
  const h = (x1 - x0) / halves;
  const k = (4 / 3) * a;
  let s = `M${pt([x0, y])}`;
  for (let i = 0; i < halves; i++) {
    const xa = x0 + i * h;
    const dir = i % 2 ? 1 : -1;
    s += `C${pt([xa + h * 0.25, y + dir * k])} ${pt([xa + h * 0.75, y + dir * k])} ${pt([xa + h, y])}`;
  }
  return s;
}

/** Dashes along a straight line from a to b: `n` dashes with gaps of `gap`. */
function dashes(a, b, n, gap = 3) {
  const L0 = len(sub(b, a));
  const dl = (L0 - gap * (n - 1)) / n;
  const u = unit(sub(b, a));
  return Array.from({ length: n }, (_, i) => line(add2(a, mul(u, i * (dl + gap))), add2(a, mul(u, i * (dl + gap) + dl))));
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};

// ── The driver's seat ─────────────────────────────────────────────────────────────────────────
// The steering wheel: a ring, a hub and three spokes (two level, one down), at any size. Beside a
// badge it is smaller and moves up and to the left, so the badge's clearance never shaves a spoke.
function steering([cx, cy] = [12, 12], r = 9) {
  const h = (2.75 * r) / 9;
  return [circ(cx, cy, r), circ(cx, cy, h), hl(cy, cx - r, cx - h), hl(cy, cx + h, cx + r), vl(cx, cy + h, cy + r)];
}
add('steering-wheel', ['volante', 'conducir', 'manejar', 'conductor', 'steering wheel', 'drive', 'driver'], steering());
{
  const W = steering([12, 15.5], 5.75);
  add('steering-wheel-heated', ['volante calefactado', 'calefacción del volante', 'volante caliente', 'heated steering wheel', 'wheel heater', 'warm wheel'], [...W, ...[8, 12, 16].map((x) => waveV(x, 2.75, 6.75, 0.9))]);
  FILL['steering-wheel-heated'] = { solid: [1], wire: [0, 2, 3, 4], lines: [5, 6, 7] };
  PARTS['steering-wheel-heated'] = { rim: [0], hub: [1], spokes: [2, 3, 4], heat: [5, 6, 7] };
}
add('steering-wheel-alert', ['falla de dirección', 'dirección asistida', 'servicio de dirección', 'power steering fault', 'steering warning', 'eps fault'], steering([10, 10], 7), { badge: badge('alert') });
for (const name of ['steering-wheel', 'steering-wheel-alert']) {
  FILL[name] = { solid: [1], wire: [0, 2, 3, 4] };
  PARTS[name] = { rim: [0], hub: [1], spokes: [2, 3, 4] };
}

// Gearstick: a ball knob on a straight lever rising from a trapezoid boot.
add('gearstick', ['palanca de cambios', 'transmisión manual', 'estándar', 'cambio de velocidad', 'gearstick', 'manual transmission', 'gear shift'], [
  circ(12, 6, 3.25),
  vl(12, 9.25, 14.75),
  roundpoly([[9.25, 14.75], [14.75, 14.75], [18.25, 21.25], [5.75, 21.25]], [1.25, 1.25, 1.25, 1.25]),
]);
FILL.gearstick = { solid: [0, 2], wire: [1] };
PARTS.gearstick = { knob: [0], lever: [1], boot: [2] };

// Automatic shifter: a T handle on a stem that goes into a long slot, its detents ticked beside it.
add('automatic-shifter', ['transmisión automática', 'selector de marchas', 'automático', 'modo de manejo', 'automatic transmission', 'gear selector', 'drive mode'], [
  sq(4.75, 2.75, 9.5, 4, 2),
  vl(9.5, 6.75, 14.25),
  sq(6.25, 9.5, 6.5, 11.75, 3.25),
  hl(11.75, 15.75, 18.25),
  hl(15.25, 15.75, 18.25),
  hl(18.75, 15.75, 18.25),
]);
FILL['automatic-shifter'] = { solid: [0, 2], wire: [vl(9.5, 6.75, 9.5)], cut: [vl(9.5, 9.5, 14.25)], lines: [3, 4, 5] };
PARTS['automatic-shifter'] = { handle: [0, 1], slot: [2], detents: [3, 4, 5] };

// Gearbox: the case (the signature corner) with one large gear inside, the engine's gear at the
// badge's size, and a shaft out of each side: input on the left, output on the right. The bell
// housing narrowing to a shaft read as a price tag, and two small meshing gears as a flower.
add('gearbox', ['caja de cambios', 'transmisión', 'reparación de transmisión', 'gearbox', 'transmission', 'transmission repair'], [
  sq(4.25, 4.25, 15.5, 15.5, 3, BR),
  gear(12, 12, 4.75, 3.25, 6, 0.75, 0.5),
  hl(12, 2, 4.25),
  hl(12, 19.75, 22),
]);
FILL.gearbox = { solid: [0], cut: [1], wire: [2, 3] };
PARTS.gearbox = { housing: [0], gear: [1], shafts: [2, 3] };

// Four-wheel drive: the chassis from above, a driveshaft joining both axles, a tire at each end.
{
  const tire = (x, y) => sq(x, y, 3.5, 6.5, 1.5);
  add('four-wheel-drive', ['tracción en las cuatro ruedas', '4x4', 'tracción integral', 'todoterreno', 'four-wheel drive', 'all-wheel drive', '4wd'], [
    tire(3.25, 3.25),
    tire(17.25, 3.25),
    tire(3.25, 14.25),
    tire(17.25, 14.25),
    hl(6.5, 6.75, 17.25),
    hl(17.5, 6.75, 17.25),
    vl(12, 6.5, 17.5),
  ]);
  FILL['four-wheel-drive'] = { solid: [0, 1, 2, 3], wire: [4, 5, 6] };
  PARTS['four-wheel-drive'] = { tires: [0, 1, 2, 3], axles: [4, 5], driveshaft: [6] };
}

// The brake pedal, hanging from its arm: wide and short, two grip ribs across it.
add('pedal-brake', ['freno', 'pedal de freno', 'frenar', 'frenado brusco', 'brake pedal', 'braking', 'hard braking'], [
  sq(4.75, 11.75, 14.5, 9, 1.75),
  hl(14.75, 4.75, 19.25),
  hl(17.75, 4.75, 19.25),
  roundline([[15, 2.75], [15, 6.5], [12, 9], [12, 11.75]], [0, 2.5, 2.5, 0]),
]);
FILL['pedal-brake'] = { solid: [0], cut: [1, 2], wire: [3] };
PARTS['pedal-brake'] = { pedal: [0, 1, 2], arm: [3] };

// Handbrake: the lever rises from its pivot block at an angle, its release button out of the grip.
{
  const [a, b, r] = [[8, 14], [17.5, 7], 1.75];
  const u = unit(sub(b, a));
  add('handbrake', ['freno de mano', 'freno de estacionamiento', 'echar el freno', 'handbrake', 'parking brake', 'e-brake'], [
    sq(3.25, 15.75, 9.5, 5.5, 2),
    stadium(a, b, r),
    line(add2(b, mul(u, r)), add2(b, mul(u, r + 2.25))),
  ]);
  FILL.handbrake = { solid: [0, 1], wire: [2] };
  PARTS.handbrake = { base: [0], lever: [1], button: [2] };
}

// Ignition: the lock cylinder with the key's bow in it, turned toward the middle of three key
// positions ticked on an arc to its upper right, as a switch's positions run clockwise. Ticked evenly
// across the top they read as a stopwatch.
{
  const c = [10.75, 13.5];
  const tick = (deg) => line(polar(...c, 9, deg), polar(...c, 11.25, deg));
  add('ignition', ['encendido', 'arrancar el motor', 'switch de encendido', 'contacto', 'ignition', 'engine start', 'key on'], [circ(...c, 6), turnPath(sq(c[0] - 1.5, c[1] - 3.5, 3, 7, 1.5), 35, c), tick(-100), tick(-55), tick(-10)]);
  FILL.ignition = { solid: [0], cut: [1], lines: [2, 3, 4] };
  PARTS.ignition = { cylinder: [0], key: [1], positions: [2, 3, 4] };
}

// ── The engine bay ────────────────────────────────────────────────────────────────────────────
// The engine in profile: the block, its stepped manifold and filler cap, a stub on each side.
const ENGINE = [
  roundpoly(
    [[9.25, 6.5], [14.75, 6.5], [14.75, 8.5], [17.75, 8.5], [17.75, 11], [20.75, 11], [20.75, 16], [17.75, 16], [17.75, 18.75], [8.75, 18.75], [6.25, 16.25], [6.25, 15], [3.25, 15], [3.25, 10.75], [6.25, 10.75], [6.25, 8.5], [9.25, 8.5]],
    0.75,
  ),
  vl(12, 3.5, 6.5),
  hl(3.5, 9.75, 14.25),
];
add('engine', ['motor', 'revisar motor', 'tren motriz', 'mecánica', 'engine', 'check engine', 'motor'], ENGINE);
add('engine-alert', ['falla de motor', 'luz de check engine', 'código de falla', 'engine fault', 'check engine light', 'malfunction'], ENGINE.map((d) => move(d, -0.75, -1)), { badge: badge('alert') });
for (const name of ['engine', 'engine-alert']) {
  FILL[name] = { solid: [0], wire: [1, 2] };
  PARTS[name] = { block: [0], cap: [1, 2] };
}

// Oil can: the body runs out into a long tapered spout; a lid, a loop handle and one falling drop.
add('oil-can', ['presión de aceite', 'aceitera', 'lubricación', 'aceite de motor', 'oil pressure', 'oil can', 'lubrication'], [
  roundpoly([[6.25, 10.5], [13.25, 10.5], [20.25, 7.5], [15.75, 13.5], [15.75, 17.75], [6.25, 17.75]], [1.5, 0.75, 0.6, 0.75, 1.5, 1.5]),
  roundline([[8.5, 10.5], [8.5, 8.25], [11.5, 8.25], [11.5, 10.5]], [0, 0.75, 0.75, 0]),
  roundline([[6.25, 11.75], [3.25, 11.75], [3.25, 16], [6.25, 16]], [0, 1.25, 1.25, 0]),
  droplet([19.75, 16.25], 1.75),
]);
FILL['oil-can'] = { solid: [0, 3, shut(roundline([[8.5, 10.5], [8.5, 8.25], [11.5, 8.25], [11.5, 10.5]], [0, 0.75, 0.75, 0]))], wire: [2] };
PARTS['oil-can'] = { can: [0, 1], handle: [2], drop: [3] };

// Motor oil: the jug (the signature corner), its cap offset to the left, a loop handle on its side
// and a drop on the label.
const JUG = {
  body: sq(3.5, 9, 14.75, 12.25, 1.75, BR),
  cap: roundline([[6.25, 9], [6.25, 5.25], [10.25, 5.25], [10.25, 9]], [0, 1, 1, 0]),
  handle: roundline([[18.25, 12], [20.75, 12], [20.75, 17.5], [18.25, 17.5]], [0, 1.5, 1.5, 0]),
  drop: droplet([10.88, 15.5], 2.25),
};
add('motor-oil', ['aceite de motor', 'botella de aceite', 'rellenar aceite', 'grado de aceite', 'motor oil', 'engine oil', 'oil bottle'], [JUG.body, JUG.cap, JUG.handle, JUG.drop]);
FILL['motor-oil'] = { solid: [0, shut(JUG.cap)], wire: [2], cut: [3] };
PARTS['motor-oil'] = { jug: [0], cap: [1], handle: [2], drop: [3] };

// Oil change: the jug tipped over and pouring; the stream falls from its cap and ends in a drop.
{
  const [C, k, deg, to] = [[11.25, 13.25], 0.6, -45, [14.25, 10.75]];
  const T = (d) => move(turnPath(scale(d, k, C), deg, C), to[0] - C[0], to[1] - C[1]);
  const lip = add2(rot(scalePt([8.25, 5.25], k, C), C, deg), sub(to, C));
  const x = 5.75;
  const stream = `M${pt(lip)}C${pt([lip[0] - 2, lip[1] - 1.25])} ${pt([x, lip[1] - 0.5])} ${pt([x, lip[1] + 3.5])}`;
  add('oil-change', ['cambio de aceite', 'servicio de aceite', 'próximo cambio de aceite', 'oil change', 'oil service', 'lube service'], [T(JUG.body), T(JUG.cap), T(JUG.handle), stream, droplet([x, lip[1] + 9.25], 2)]);
  FILL['oil-change'] = { solid: [0, shut(T(JUG.cap)), 4], wire: [2, 3] };
  PARTS['oil-change'] = { jug: [0, 1, 2], stream: [3], drop: [4] };
}

// Oil filter: a short cylinder seen from above, its top showing the threaded hole and a ribbed band.
{
  const [cx, cy, rx, ry] = [12, 6.75, 7.5, 3.5];
  const front = (y) => `M${pt([cx - rx, y])}A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx + rx, y])}`;
  const yAt = (x) => cy + ry * Math.sqrt(1 - ((x - cx) / rx) ** 2);
  const ribs = [8, 12, 16].map((x) => vl(x, yAt(x), yAt(x) + 4));
  const body = `M${pt([cx - rx, cy])}V17.5A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx + rx, 17.5])}V${f(cy)}`;
  add('oil-filter', ['filtro de aceite', 'cambio de filtro', 'refacción', 'oil filter', 'filter change', 'service part'], [ell([cx, cy], rx, ry), body, front(cy + 4), ...ribs, dot(cx, cy)]);
  FILL['oil-filter'] = { solid: [0, shut(body)], cut: [front(cy), 2, 3, 4, 5, 6] };
  PARTS['oil-filter'] = { top: [0, 6], body: [1], band: [2, 3, 4, 5] };
}

// Car battery: a wide low block (the signature corner), two terminals, plus and minus under them.
add('car-battery', ['batería del auto', 'acumulador', 'carga de batería', 'pasar corriente', 'car battery', 'battery service', '12v battery'], [
  sq(2.75, 7.25, 18.5, 13, 3, BR),
  roundline([[5.5, 7.25], [5.5, 4.75], [9, 4.75], [9, 7.25]], [0, 0.75, 0.75, 0]),
  roundline([[15, 7.25], [15, 4.75], [18.5, 4.75], [18.5, 7.25]], [0, 0.75, 0.75, 0]),
  vl(7.25, 12.25, 15.25),
  hl(13.75, 5.75, 8.75),
  hl(13.75, 15.25, 18.25),
]);
FILL['car-battery'] = { solid: [0, shut(roundline([[5.5, 7.25], [5.5, 4.75], [9, 4.75], [9, 7.25]], [0, 0.75, 0.75, 0])), shut(roundline([[15, 7.25], [15, 4.75], [18.5, 4.75], [18.5, 7.25]], [0, 0.75, 0.75, 0]))], cut: [3, 4, 5] };
PARTS['car-battery'] = { body: [0], terminals: [1, 2], plus: [3, 4], minus: [5] };

// Jumper cables: two alligator clamps, jaws open and turned apart, their cables meeting below.
{
  const clamp = (deg, at) => {
    const P = (d) => move(turnPath(d, deg, [0, 0]), at[0], at[1]);
    return P(roundpoly([[-1.5, 0], [-1.5, -4.5], [-2.6, -9.5], [0, -6.5], [2.6, -9.5], [1.5, -4.5], [1.5, 0]], [0.6, 0.4, 0.45, 0.4, 0.45, 0.4, 0.6]));
  };
  const [deg, a, b] = [18, [6.75, 13.25], [17.25, 13.25]];
  const down = (d) => rot([0, 5.5], [0, 0], d);
  const cable = `M${pt(a)}C${pt(add2(a, down(-deg)))} ${pt(add2(b, down(deg)))} ${pt(b)}`;
  add('jumper-cables', ['cables pasacorriente', 'pasar corriente', 'batería descargada', 'auxilio vial', 'jumper cables', 'jump start', 'booster cables'], [clamp(-deg, a), clamp(deg, b), cable]);
  FILL['jumper-cables'] = { solid: [0, 1], wire: [2] };
  PARTS['jumper-cables'] = { clamps: [0, 1], cable: [2] };
}

// ── Tires, wheels and brakes ──────────────────────────────────────────────────────────────────
// The tire head-on: a tall rounded shape with a zigzag tread down its middle.
const TIRE = sq(6.75, 2.75, 10.5, 18.5, 3.5);
const TREAD = line([10.5, 5.75], [13.5, 8.25], [10.5, 10.75], [13.5, 13.25], [10.5, 15.75], [13.5, 18.25]);
add('tire', ['llanta', 'neumático', 'cambio de llantas', 'llantera', 'tire', 'tyre', 'new tires'], [TIRE, TREAD]);
FILL.tire = { solid: [0], cut: [1] };
PARTS.tire = { tire: [0], tread: [1] };

// Tire pressure: the tire's cross-section open at the rim, its tread ticked below and the mark inside.
add('tire-pressure', ['presión de llantas', 'llanta baja', 'tpms', 'inflar llantas', 'tire pressure', 'low tire pressure', 'tpms warning'], [
  'M7.25 4.75C4.4 6.6 3.25 9.1 3.25 12C3.25 14.6 4 16.6 5.25 18.25H18.75C20 16.6 20.75 14.6 20.75 12C20.75 9.1 19.6 6.6 16.75 4.75',
  vl(8, 18.25, 20.75),
  vl(12, 18.25, 20.75),
  vl(16, 18.25, 20.75),
  vl(12, 7.5, 11.25),
  dot(12, 14.85),
]);
FILL['tire-pressure'] = { solid: [shut('M7.25 4.75C4.4 6.6 3.25 9.1 3.25 12C3.25 14.6 4 16.6 5.25 18.25H18.75C20 16.6 20.75 14.6 20.75 12C20.75 9.1 19.6 6.6 16.75 4.75')], wire: [1, 2, 3], cut: [4, 5] };
PARTS['tire-pressure'] = { tire: [0, 1, 2, 3], mark: [4, 5] };

// The wheel from the side: the tire (r 9), the rim and five spokes around the hub.
{
  // The spokes leave a bare hub: their inner ends stand 2.9 apart
  const spokes = Array.from({ length: 5 }, (_, i) => line(polar(12, 12, 2.5, -90 + i * 72), polar(12, 12, 5.5, -90 + i * 72)));
  add('wheel', ['rin', 'rueda', 'llanta y rin', 'configurador', 'wheel', 'rim', 'alloy wheel'], [circ(12, 12, 9), circ(12, 12, 5.5), ...spokes]);
  FILL.wheel = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS.wheel = { tire: [0], rim: [1], spokes: [2, 3, 4, 5, 6] };
}

// Flat tire: the tire squashed onto the ground, its sidewalls bulging out where it sits.
{
  const c = [12, 10.75];
  const r = 7.75;
  const top = arc(...c, r, 180, 360).d.replace(/^M[^A]*/, '');
  const tire = `M7.5 18C3.25 18 ${pt([c[0] - r, 14.75])} ${pt([c[0] - r, c[1]])}${top}C${pt([c[0] + r, 14.75])} 20.75 18 16.5 18`;
  const spokes = Array.from({ length: 5 }, (_, i) => line(polar(...c, 1.5, -90 + i * 72), polar(...c, 4.25, -90 + i * 72)));
  add('tire-flat', ['llanta ponchada', 'pinchazo', 'reparar llanta', 'auxilio vial', 'flat tire', 'puncture', 'roadside help'], [tire, hl(18, 2.75, 21.25), circ(...c, 4.25), circ(...c, 1.5), ...spokes]);
  FILL['tire-flat'] = { solid: [shut(tire)], wire: [1], cut: [2, 3, 4, 5, 6, 7, 8] };
  PARTS['tire-flat'] = { tire: [0], ground: [1], rim: [2, 3, 4, 5, 6, 7, 8] };
}

// Wheel alignment: the tire head-on (its tread zigzag), whole, leaning a few degrees beside a
// vertical dashed line, the plumb it is set against. A bare tilted capsule with the axis through it
// read as a pill.
{
  const S = (d) => turnPath(move(d, 2.5, 0), 10, [14.5, 12]);
  const axis = dashes([4.75, 2.75], [4.75, 21.25], 4);
  add('wheel-alignment', ['alineación', 'alineación y balanceo', 'convergencia', 'camber', 'wheel alignment', 'toe adjustment', 'camber'], [S(TIRE), S(TREAD), ...axis]);
  FILL['wheel-alignment'] = { solid: [0], cut: [1], lines: axis };
  PARTS['wheel-alignment'] = { tire: [0, 1], axis: [2, 3, 4, 5] };
}

// Wheel clamp: a padlock at the hub of the wheel and a bracket gripping the tire's upper half.
{
  const c = [12, 13];
  const r = 8;
  const R = 10.75;
  const bracket = `M${pt(polar(...c, r, 215))}L${pt(polar(...c, R, 215))}${arc(...c, R, 215, 325).d.replace(/^M[^A]*/, '')}L${pt(polar(...c, r, 325))}`;
  add('wheel-clamp', ['cepo', 'inmovilizador', 'grúa', 'multa de estacionamiento', 'wheel clamp', 'parking boot', 'immobilized'], [
    circ(...c, r),
    sq(8.75, 12, 6.5, 5, 1.5, BR),
    'M10.25 12V10.75A1.75 1.75 0 0 1 13.75 10.75V12',
    bracket,
  ]);
  FILL['wheel-clamp'] = { solid: [0], cut: [1, 2], wire: [3] };
  PARTS['wheel-clamp'] = { tire: [0], lock: [1, 2], clamp: [3] };
}

// Tire rotation: a tire at each corner and the circular arrow between them.
{
  const tire = (x, y) => sq(x, y, 3, 5.5, 1.25);
  const a = arc(12, 12, 3.75, 180, 450);
  add('tire-rotation', ['rotación de llantas', 'intercambio de llantas', 'servicio de llantas', 'tire rotation', 'rotate tires', 'tire service'], [tire(3.25, 3.25), tire(17.75, 3.25), tire(3.25, 15.25), tire(17.75, 15.25), a.d, head(a.end, a.tangent, 2.75)]);
  FILL['tire-rotation'] = { solid: [0, 1, 2, 3], lines: [4, 5] };
  PARTS['tire-rotation'] = { tires: [0, 1, 2, 3], arrow: [4, 5] };
}

// Snow chains: the tire head-on, a lattice of chain crossing its tread from wall to wall.
{
  const [x0, x1] = [6.75, 17.25];
  const T = sq(6.75, 2.75, 10.5, 18.5, 2.75);
  const ys = [7.25, 12, 16.75];
  add('snow-chains', ['cadenas para nieve', 'invierno', 'nieve en carretera', 'control de cadenas', 'snow chains', 'tire chains', 'winter driving'], [
    T,
    line([x0, ys[0]], [x1, ys[1]]),
    line([x1, ys[0]], [x0, ys[1]]),
    line([x0, ys[1]], [x1, ys[2]]),
    line([x1, ys[1]], [x0, ys[2]]),
  ]);
  FILL['snow-chains'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['snow-chains'] = { tire: [0], chains: [1, 2, 3, 4] };
}

// Scissor jack: a rhombus of arms, the screw through its side joints, a saddle on top and a base.
add('scissor-jack', ['gato', 'gato hidráulico', 'levantar el auto', 'cambiar llanta', 'scissor jack', 'car jack', 'lift point'], [
  roundpoly([[12, 6], [18.5, 13.25], [12, 20.5], [5.5, 13.25]], [0, 0.75, 0, 0.75]),
  hl(13.25, 2.75, 21.25),
  roundline([[9, 3], [9, 6], [15, 6], [15, 3]], [0, 0.75, 0.75, 0]),
  hl(20.5, 6, 18),
]);
FILL['scissor-jack'] = { solid: [0], cut: [hl(13.25, 5.5, 18.5)], wire: [hl(13.25, 2.75, 5.5), hl(13.25, 18.5, 21.25), 2, 3] };
PARTS['scissor-jack'] = { arms: [0], screw: [1], saddle: [2], base: [3] };

// Brakes, as the tell-tales show them: the drum between its two shoes with the mark inside, or the
// drum turning (ABS).
const DRUM = [circ(12, 12, 6.5), arc(12, 12, 9.5, 145, 215).d, arc(12, 12, 9.5, -35, 35).d];
add('brake-warning', ['falla de frenos', 'líquido de frenos', 'testigo de frenos', 'brake warning', 'brake fault', 'brake fluid'], [...DRUM, vl(12, 8.6, 11.75), dot(12, 15.4)]);
FILL['brake-warning'] = { solid: [0], lines: [1, 2], cut: [3, 4] };
PARTS['brake-warning'] = { drum: [0], shoes: [1, 2], mark: [3, 4] };
{
  // The drum itself turns: a circular arrow between the shoes, its head where the shoes leave room
  const a = arc(12, 12, 6.5, -45, 250);
  add('brake-antilock', ['abs', 'frenos antibloqueo', 'sistema antibloqueo', 'anti-lock brakes', 'abs warning', 'antilock'], [a.d, DRUM[1], DRUM[2], head(a.end, a.tangent, 2.75)]);
  FILL['brake-antilock'] = false;
  PARTS['brake-antilock'] = { arrow: [0, 3], shoes: [1, 2] };
}

// Brake disc: the rotor, its hub and vent holes, the caliper on top clamping its upper right edge
// (a custom piece on top: the engine clears the disc under it).
{
  const c = [10.75, 13.25];
  const [r0, r1, a0, a1] = [5.75, 10.25, -78, -12];
  const cal = `M${pt(polar(...c, r1, a0))}${arc(...c, r1, a0, a1).d.replace(/^M[^A]*/, '')}L${pt(polar(...c, r0, a1))}${arc(...c, r0, a1, a0).d.replace(/^M[^A]*/, '')}Z`;
  add('brake-disc', ['disco de freno', 'balatas', 'servicio de frenos', 'cáliper', 'brake disc', 'brake pads', 'rotor'], [circ(...c, 8), circ(...c, 2.25), ...[45, 135, 225].map((deg) => dot(...polar(...c, 5.1, deg)))], {
    badge: { d: [cal], knock: cal, fill: { solid: [cal] } },
  });
  FILL['brake-disc'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['brake-disc'] = { disc: [0], hub: [1], vents: [2, 3, 4] };
}

// Shock absorber: an eye at each end and the coil spring zigzagging down the rod between them.
add('shock-absorber', ['amortiguador', 'suspensión', 'servicio de suspensión', 'shock absorber', 'suspension', 'strut'], [
  circ(12, 4.5, 1.75),
  line([12, 6.25], [12, 7.5], [16.25, 9], [7.75, 11.5], [16.25, 14], [7.75, 16.5], [12, 17.75]),
  circ(12, 19.5, 1.75),
]);
FILL['shock-absorber'] = { solid: [0, 2], wire: [1] };
PARTS['shock-absorber'] = { eyes: [0, 2], spring: [1] };

// ── Occupants ─────────────────────────────────────────────────────────────────────────────────
// The seated figure, facing right: the head, and one line down the back, along the thigh and down
// the shin.
const seated = (dx = 0) => [circ(7.5 + dx, 4.75, 2), roundline([[6.9 + dx, 9.6], [6.25 + dx, 14.25], [12.5 + dx, 14.25], [13 + dx, 20.75]], [0, 1, 1, 0])];
add('airbag', ['bolsa de aire', 'falla de airbag', 'airbag del pasajero', 'seguridad pasiva', 'airbag', 'airbag fault', 'passenger airbag'], [...seated(), circ(16.25, 7.75, 4.25)]);
FILL.airbag = { solid: [0, 2], wire: [1] };
PARTS.airbag = { person: [0, 1], bag: [2] };
add('seatbelt', ['cinturón de seguridad', 'abrocharse', 'recordatorio de cinturón', 'seatbelt', 'fasten seatbelt', 'occupant safety'], [
  ...seated(1.75),
  roundline([[3.5, 5], [3.5, 17.25], [10.25, 17.25]], [0, 1.5, 0]),
  line([3.5, 15], [12, 8.75]),
]);
FILL.seatbelt = { solid: [0], wire: [1, 2, 3] };
PARTS.seatbelt = { person: [0, 1], seat: [2], belt: [3] };

// ── Cooling and ignition ─────────────────────────────────────────────────────────────────────────
// Coolant temperature: the thermometer standing in two wavy lines of coolant; it goes on top as a
// custom piece and the engine clears the waves around its bulb.
{
  const [x, w, R, yb] = [12, 2.25, 3.5, 15.5];
  const yi = yb - Math.sqrt(R * R - w * w);
  const glass = `M${f(x - w)} ${f(yi)}V${f(2.75 + w)}A${f(w)} ${f(w)} 0 0 1 ${f(x + w)} ${f(2.75 + w)}V${f(yi)}A${f(R)} ${f(R)} 0 1 1 ${f(x - w)} ${f(yi)}Z`;
  const mercury = vl(x, 7, yb);
  add('coolant-temperature', ['temperatura del motor', 'sobrecalentamiento', 'anticongelante', 'refrigerante', 'coolant temperature', 'engine overheating', 'coolant'], [waveH(14.75, 2.75, 21.25, 0.8, 4), waveH(18.5, 2.75, 21.25, 0.8, 4)], {
    badge: { d: [glass, mercury], knock: glass, fill: { solid: [glass], cut: [mercury] } },
  });
  FILL['coolant-temperature'] = false;
  PARTS['coolant-temperature'] = { coolant: [0, 1] };
}

// Radiator: a wide, low block, its two tanks marked off across it and three fins of the core between
// them, the filler cap on the top tank and a hose stub out of each tank (in at the top left, out at the
// bottom right), on the straight part of the sides and clear of the seams' ends. Two loose tanks over a row of fins read as a
// columned building, and a square block as a bin with its lid.
{
  const cap = 'M13.25 6.75A2 2 0 0 1 17.25 6.75';
  add('radiator', ['radiador', 'sistema de enfriamiento', 'cambio de anticongelante', 'radiator', 'cooling system', 'coolant flush'], [
    sq(4.25, 6.75, 15.5, 13, 1),
    hl(10.5, 4.25, 19.75),
    hl(16, 4.25, 19.75),
    ...[8.13, 12, 15.88].map((x) => vl(x, 10.5, 16)),
    cap,
    hl(8.6, 2, 4.25),
    hl(17.9, 19.75, 22),
  ]);
  FILL.radiator = { solid: [0, shut(cap)], cut: [1, 2, 3, 4, 5], wire: [7, 8] };
  PARTS.radiator = { core: [0, 1, 2], fins: [3, 4, 5], cap: [6], hoses: [7, 8] };
}

// Spark plug: terminal, tapered insulator, hex nut, thread and the hooked electrode at the tip.
add('spark-plug', ['bujía', 'afinación', 'encendido', 'refacciones', 'spark plug', 'tune-up', 'ignition parts'], [
  vl(12, 2.75, 5),
  roundpoly([[10.5, 5], [13.5, 5], [14.25, 10.25], [9.75, 10.25]], [0.75, 0.75, 0, 0]),
  sq(7.75, 10.25, 8.5, 3.75, 1),
  roundline([[9.75, 14], [9.75, 17.75], [14.25, 17.75], [14.25, 14]], [0, 0.6, 0.6, 0]),
  roundline([[12, 17.75], [12, 21], [14.75, 21]], [0, 1, 0]),
]);
FILL['spark-plug'] = { solid: [1, 2, shut(roundline([[9.75, 14], [9.75, 17.75], [14.25, 17.75], [14.25, 14]], [0, 0.6, 0.6, 0]))], wire: [0, 4] };
PARTS['spark-plug'] = { terminal: [0], insulator: [1], nut: [2], thread: [3], electrode: [4] };

// Piston: the crown with two ring grooves, on its rod down to the big-end ring.
add('piston', ['pistón', 'motor por dentro', 'rectificación', 'potencia', 'piston', 'engine rebuild', 'horsepower'], [
  sq(5.25, 3.25, 13.5, 9.5, 2),
  hl(6.25, 5.25, 18.75),
  hl(9.25, 5.25, 18.75),
  vl(12, 12.75, 16.25),
  circ(12, 18.75, 2.5),
]);
FILL.piston = { solid: [0], cut: [1, 2], wire: [3, 4] };
PARTS.piston = { crown: [0], rings: [1, 2], rod: [3, 4] };


// ── Lights ────────────────────────────────────────────────────────────────────────────────────
// The lamp is a D, flat on the side it shines toward; its beams leave from that side.
const LAMP = 'M12 5.25C5.5 5.25 3.25 8.75 3.25 12S5.5 18.75 12 18.75Z';
const BEAM_Y = [5.25, 8.63, 12, 15.38, 18.75];
add('headlight-high', ['luces altas', 'faros', 'luz alta encendida', 'high beam', 'headlights', 'main beam'], [LAMP, ...BEAM_Y.map((y) => hl(y, 15, 21))]);
add('headlight-low', ['luces bajas', 'luces encendidas', 'faros bajos', 'low beam', 'dipped headlights', 'lights on'], [LAMP, ...BEAM_Y.map((y) => line([15, y], [20.75, y + 2.25]))]);
for (const name of ['headlight-high', 'headlight-low']) {
  FILL[name] = { solid: [0], lines: [1, 2, 3, 4, 5] };
  PARTS[name] = { lamp: [0], beams: [1, 2, 3, 4, 5] };
}
{
  const fog = waveV(18, 3.25, 20.75, 1, 4);
  add('fog-light', ['faros de niebla', 'antiniebla delantero', 'neblineros', 'fog lights', 'front fog light', 'fog lamp'], [LAMP, ...[8.63, 12, 15.38].map((y) => line([15, y], [20.75, y + 2.25])), fog]);
  add('fog-light-rear', ['antiniebla trasero', 'luz de niebla trasera', 'niebla', 'rear fog light', 'rear fog lamp', 'fog'], [flipPath(LAMP), ...[8.63, 12, 15.38].map((y) => hl(y, 3, 9)), flipPath(fog)]);
  for (const name of ['fog-light', 'fog-light-rear']) {
    FILL[name] = { solid: [0], lines: [1, 2, 3, 4] };
    PARTS[name] = { lamp: [0], beams: [1, 2, 3], fog: [4] };
  }
}

// Parking lights: two half-disc lamps back to back, three short beams leaving each one outward.
{
  const lamp = 'M10.5 9A3 3 0 0 0 10.5 15Z';
  const beams = [145, 180, 215].map((deg) => line(polar(10.5, 12, 6, deg), polar(10.5, 12, 8.25, deg)));
  add('parking-lights', ['luces de posición', 'cuartos', 'luces de estacionamiento', 'parking lights', 'side lights', 'position lights'], [lamp, flipPath(lamp), ...beams, ...beams.map((d) => flipPath(d))]);
  FILL['parking-lights'] = { solid: [0, 1], lines: [2, 3, 4, 5, 6, 7] };
  PARTS['parking-lights'] = { lamps: [0, 1], beams: [2, 3, 4, 5, 6, 7] };
}
// Turn signals: two block arrows pointing apart (the left one is the right one, mirrored).
{
  const right = roundpoly([[13.5, 10], [16.75, 10], [16.75, 6.75], [21.5, 12], [16.75, 17.25], [16.75, 14], [13.5, 14]], [0.6, 0.4, 0.75, 1, 0.75, 0.4, 0.6]);
  add('turn-signals', ['direccionales', 'intermitentes', 'señalar vuelta', 'turn signals', 'blinkers', 'indicators'], [flipPath(right), right]);
  FILL['turn-signals'] = { solid: [0, 1] };
  PARTS['turn-signals'] = { left: [0], right: [1] };
}
// Hazard lights and the warning triangle: a triangle inside a triangle; the reflective triangle
// stands on two short legs, nearly upright (splayed, they continued its sides into an A).
/** A triangle's inner copy, `gap` in from each side (scaled around its incenter). */
function inset(P, gap) {
  const [A, B, C] = P;
  const [a, b, c] = [len(sub(B, C)), len(sub(A, C)), len(sub(A, B))];
  const s = a + b + c;
  const I = [(a * A[0] + b * B[0] + c * C[0]) / s, (a * A[1] + b * B[1] + c * C[1]) / s];
  const area = Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
  const r = area / (s / 2);
  return P.map((p) => lerp(I, p, (r - gap) / r));
}
{
  const T = [[12, 3], [21.5, 19.5], [2.5, 19.5]];
  add('hazard-lights', ['luces intermitentes', 'emergencia', 'avería', 'parada en carretera', 'hazard lights', 'flashers', 'breakdown'], [roundpoly(T, 2.25), roundpoly(inset(T, 3.25), 0.9)]);
  FILL['hazard-lights'] = { solid: [0], cut: [1] };
  PARTS['hazard-lights'] = { outer: [0], inner: [1] };
  const W = [[12, 2.75], [20.75, 17.75], [3.25, 17.75]];
  add('warning-triangle', ['triángulo de emergencia', 'triángulo reflejante', 'kit de emergencia', 'avería', 'warning triangle', 'reflective triangle', 'emergency kit'], [
    roundpoly(W, 1.75),
    roundpoly(inset(W, 3), 0.75),
    line([8, 17.75], [7.25, 21.25]),
    line([16, 17.75], [16.75, 21.25]),
  ]);
  FILL['warning-triangle'] = { solid: [0], cut: [1], wire: [2, 3] };
  PARTS['warning-triangle'] = { triangle: [0, 1], legs: [2, 3] };
}

// ── Driver aids ───────────────────────────────────────────────────────────────────────────────
// Cruise control: datos' gauge (the arc, its hub and the needle) and a short arrow beneath it.
{
  const c = [12, 12.5];
  add('cruise-control', ['control de crucero', 'velocidad crucero', 'mantener velocidad', 'cruise control', 'set speed', 'cruise'], [
    arc(...c, 8.5, 150, 390).d,
    circ(...c, 1.75),
    line(polar(...c, 1.75, -45), polar(...c, 5.5, -45)),
    hl(19.5, 8.75, 15.5),
    head([15.5, 19.5], [1, 0], 2.5),
  ]);
  FILL['cruise-control'] = { solid: [1], wire: [2], lines: [0, 3, 4] };
  PARTS['cruise-control'] = { dial: [0], needle: [1, 2], arrow: [3, 4] };
}
/**
 * lugares' car from the front, scaled `k` around the bottom of its tires and moved; below 0.8 its
 * headlights (dots that would crowd the body) are left out. Returns the paths and their fill.
 */
function carFront(k = 1, dx = 0, dy = 0) {
  const c = [12, 20.75];
  const S = (d) => scale(d, k, c, dx, dy);
  const [body, cabin, tl, tr] = L.car.d.slice(0, 4).map(S);
  const lights = k >= 0.8 ? [dot(...scalePt([6.75, 14], k, c, dx, dy)), dot(...scalePt([17.25, 14], k, c, dx, dy))] : [];
  return { d: [body, cabin, tl, tr, ...lights], fill: { solid: [body, shut(cabin), shut(tl), shut(tr)], cut: [S(line([6.75, 10.25], [17.25, 10.25])), ...lights] } };
}
const carFill = (car, extra = {}) => ({ solid: [...car.fill.solid, ...(extra.solid ?? [])], cut: [...car.fill.cut, ...(extra.cut ?? [])], ...(extra.lines && { lines: extra.lines }), ...(extra.wire && { wire: extra.wire }) });
{
  const car = carFront(0.55);
  const bars = [hl(9.25, 5.5, 18.5), hl(6.25, 7.5, 16.5), hl(3.25, 9.5, 14.5)];
  add('adaptive-cruise', ['crucero adaptativo', 'distancia de seguimiento', 'crucero con radar', 'adaptive cruise', 'following distance', 'radar cruise'], [...car.d, ...bars]);
  FILL['adaptive-cruise'] = carFill(car, { lines: bars });
  PARTS['adaptive-cruise'] = { car: [0, 1, 2, 3], distance: [4, 5, 6] };
}
{
  const car = carFront(0.55);
  const lanes = [...dashes([2.5, 21], [7.25, 3], 3), ...dashes([21.5, 21], [16.75, 3], 3)];
  add('lane-assist', ['asistente de carril', 'mantenimiento de carril', 'salida de carril', 'lane assist', 'lane keeping', 'lane departure'], [...car.d, ...lanes]);
  FILL['lane-assist'] = carFill(car, { lines: lanes });
  PARTS['lane-assist'] = { car: [0, 1, 2, 3], lanes: [4, 5, 6, 7, 8, 9] };
}
{
  const car = carFront(0.62, 0, -8.15);
  const skids = [waveV(8.6, 15.5, 21.25, 0.9), waveV(15.4, 15.5, 21.25, 0.9)];
  add('traction-control', ['control de tracción', 'control de estabilidad', 'derrape', 'esp', 'traction control', 'stability control', 'esc'], [...car.d, ...skids]);
  FILL['traction-control'] = carFill(car, { lines: skids });
  PARTS['traction-control'] = { car: [0, 1, 2, 3], skids: [4, 5] };
}
// The car from above, its nose up, the same outline for the whole family: the body rounder at the
// nose than at the tail, the windshield and the rear window bowed across it, and the side mirrors,
// two short strokes swept back out of its sides. Without the mirrors and the round nose it read as
// a phone. Returns { d, fill } (the mirrors stay lines attached to the body).
function topCar([cx, cy], k = 1, { rear = true } = {}) {
  const [w, h] = [9 * k, 16 * k];
  const [x0, y0, x1, y1] = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  const body = roundpoly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [3.5 * k, 3.5 * k, 2.25 * k, 2.25 * k]);
  // A glass's edge: a curve across the body that bows `s` toward the nose (or the tail, s < 0)
  const bow = (y, s) => `M${pt([x0, y])}Q${pt([cx, y - 2 * s])} ${pt([x1, y])}`;
  // Each glass keeps 3 from the nose or the tail at its bow, at every size
  const yw = y0 + Math.max(0.32 * h, 3 + 1.25 * k);
  const glass = [bow(yw, 1.25 * k), ...(rear ? [bow(Math.min(y0 + 0.8 * h, y1 - 3 - 0.75 * k), -0.75 * k)] : [])];
  // The mirrors leave the sides where the windshield meets them, at the pillars
  const mirrors = [line([x0, yw], [x0 - 2, yw + 0.6]), line([x1, yw], [x1 + 2, yw + 0.6])];
  return { d: [body, ...glass, ...mirrors], fill: { solid: [body], cut: glass, wire: mirrors }, box: [x0, y0, x1, y1] };
}
const topFill = (car, extra = {}) => ({ ...car.fill, ...extra });
{
  // The zone beside the car's rear half, on its right: two arcs out of its side
  const car = topCar([8.75, 12]);
  const c = [13.25, 16];
  const zone = [arc(...c, 3.75, -40, 40).d, arc(...c, 6.75, -40, 40).d];
  add('blind-spot', ['punto ciego', 'monitor de punto ciego', 'vehículo al lado', 'blind spot', 'blind spot monitor', 'side assist'], [...car.d, ...zone]);
  FILL['blind-spot'] = topFill(car, { lines: zone });
  PARTS['blind-spot'] = { car: [0, 1, 2, 3, 4], zone: [5, 6] };
}
{
  // Two waves behind the rear bumper: a third one, 3 further out, would leave the canvas
  const car = topCar([12, 8.5], 0.72);
  const c = [12, 10.75];
  const waves = [arc(...c, 6.75, 75, 105).d, arc(...c, 9.75, 65, 115).d];
  add('parking-sensor', ['sensor de estacionamiento', 'asistente de estacionamiento', 'distancia al obstáculo', 'parking sensor', 'park assist', 'parking distance'], [...car.d, ...waves]);
  FILL['parking-sensor'] = topFill(car, { lines: waves });
  PARTS['parking-sensor'] = { car: [0, 1, 2, 3, 4], waves: [5, 6] };
}
{
  // lugares' car inside its sensing ring
  const car = carFront(0.55, 0, -4.49);
  const ring = Array.from({ length: 8 }, (_, i) => arc(12, 12, 9.25, -90 + 45 * i - 13.5, -90 + 45 * i + 13.5).d);
  add('self-driving', ['conducción autónoma', 'piloto automático', 'robotaxi', 'asistencia al conductor', 'self-driving', 'autopilot', 'autonomous'], [...car.d, ...ring]);
  FILL['self-driving'] = carFill(car, { lines: ring });
  PARTS['self-driving'] = { car: [0, 1, 2, 3], sensing: [4, 5, 6, 7, 8, 9, 10, 11] };
}

// ── Glass and mirrors ─────────────────────────────────────────────────────────────────────────
// The windshield: a trapezoid wider at the bottom, the landscape keyline's height.
const WS = roundpoly([[6.25, 5], [17.75, 5], [21.25, 19], [2.75, 19]], [2.25, 2.25, 2.5, 2.5]);
add('windshield-wiper', ['limpiaparabrisas', 'plumas', 'velocidad del limpiador', 'windshield wiper', 'wipers', 'wiper blades'], [WS, line([12, 19], polar(12, 19, 10.5, -105)), arc(12, 19, 7, -135, -45).d]);
FILL['windshield-wiper'] = { solid: [0], cut: [1, 2] };
PARTS['windshield-wiper'] = { glass: [0], wiper: [1], sweep: [2] };
add('windshield-defrost', ['desempañador delantero', 'desescarchar', 'parabrisas', 'front defrost', 'defog', 'defrost'], [WS, ...[8, 12, 16].map((x) => waveV(x, 10.5, 16, 0.8))]);
FILL['windshield-defrost'] = { solid: [0], cut: [1, 2, 3] };
PARTS['windshield-defrost'] = { glass: [0], heat: [1, 2, 3] };
add('windshield-washer', ['líquido limpiaparabrisas', 'chisguetero', 'lavar parabrisas', 'washer fluid', 'windshield washer', 'spray'], [WS, vl(12, 19, 16.75), ...[-135, -90, -45].map((deg) => line(polar(12, 16.75, 3.75, deg), polar(12, 16.75, 6.5, deg)))]);
FILL['windshield-washer'] = { solid: [0], cut: [1, 2, 3, 4] };
PARTS['windshield-washer'] = { glass: [0], nozzle: [1], spray: [2, 3, 4] };
// The crack runs from the point of impact, up near the top right, in three jagged rays of different
// lengths, the longest down to the left: a symmetric star of four read as an x, and one zigzag with a
// branch as the wiper.
{
  const P = [14.5, 9.75];
  add('windshield-crack', ['parabrisas estrellado', 'cristal roto', 'reparar parabrisas', 'windshield crack', 'chip repair', 'glass claim'], [
    WS,
    line([11.75, 8.25], P, [16.5, 12.5]),
    line(P, [12.75, 12], [13.75, 13.75], [9.75, 16]),
  ]);
}
FILL['windshield-crack'] = { solid: [0], cut: [1, 2] };
PARTS['windshield-crack'] = { glass: [0], crack: [1, 2] };
add('rear-window-defrost', ['desempañador trasero', 'medallón', 'calefacción trasera', 'rear defrost', 'rear window heater', 'rear defog'], [sq(2.75, 5.5, 18.5, 13, 3.5), ...[7.5, 12, 16.5].map((x) => waveV(x, 8.5, 15.5, 0.9))]);
FILL['rear-window-defrost'] = { solid: [0], cut: [1, 2, 3] };
PARTS['rear-window-defrost'] = { glass: [0], heat: [1, 2, 3] };
add('head-up-display', ['pantalla en el parabrisas', 'proyección en parabrisas', 'hud', 'indicaciones en el parabrisas', 'head-up display', 'windshield display'], [WS, roundline([[9, 16], [9, 12.25], [15, 12.25]], [0, 2, 0]), head([15, 12.25], [1, 0], 2.75)]);
FILL['head-up-display'] = { solid: [0], cut: [1, 2] };
PARTS['head-up-display'] = { glass: [0], arrow: [1, 2] };
add('rearview-mirror', ['espejo retrovisor', 'retrovisor interior', 'visibilidad trasera', 'rearview mirror', 'mirror camera', 'rear view'], [sq(2.75, 8.5, 18.5, 9, 4.25), vl(12, 5, 8.5), sq(9.5, 2.75, 5, 2.25, 0.75), line([15.25, 11.5], [13.25, 14.5])]);
FILL['rearview-mirror'] = { solid: [0, 2], wire: [1], cut: [3] };
PARTS['rearview-mirror'] = { mirror: [0, 3], mount: [1, 2] };
add('side-mirror', ['espejo lateral', 'retrovisor exterior', 'plegar espejos', 'side mirror', 'wing mirror', 'mirror fold'], [
  roundpoly([[8, 5.25], [17.75, 5.25], [21.25, 15.75], [8, 15.75]], [2.25, 2.5, 2.5, 2.25]),
  roundline([[2.75, 19.5], [7.25, 19.5], [10.75, 15.75]], [0, 1.5, 0]),
  line([15.75, 8.5], [13.5, 12.5]),
]);
FILL['side-mirror'] = { solid: [0], wire: [1], cut: [2] };
PARTS['side-mirror'] = { mirror: [0, 2], arm: [1] };
// Sunroof: the car from above with no rear window, its roof's glass panel slid back toward the tail.
{
  const car = topCar([12, 12], 18.5 / 16, { rear: false });
  const panel = sq(9.25, 11.75, 5.5, 6.75, 1.25);
  add('sunroof', ['quemacocos', 'techo solar', 'techo panorámico', 'sunroof', 'moonroof', 'panoramic roof'], [...car.d, panel]);
  FILL.sunroof = topFill(car, { cut: [...car.fill.cut, panel] });
  PARTS.sunroof = { car: [0, 1, 2, 3], roof: [4] };
}

// ── The cabin ─────────────────────────────────────────────────────────────────────────────────
// Instrument cluster: a wide housing with two dials, each with its needle.
add('instrument-cluster', ['tablero', 'cuadro de instrumentos', 'pantalla del conductor', 'velocímetro', 'instrument cluster', 'dashboard', 'gauges'], [
  sq(2.25, 6, 19.5, 12.5, 4),
  circ(7.75, 12.25, 2.75),
  circ(16.25, 12.25, 2.75),
  line([7.75, 12.25], polar(7.75, 12.25, 2.75, -135)),
  line([16.25, 12.25], polar(16.25, 12.25, 2.75, -45)),
]);
FILL['instrument-cluster'] = { solid: [0], cut: [1, 2, 3, 4] };
PARTS['instrument-cluster'] = { housing: [0], dials: [1, 2], needles: [3, 4] };

// The seat in profile, facing right: backrest leaning back, cushion, and the headrest on its post.
function seat(T = (d) => d) {
  return [
    T(roundpoly([[4.25, 7.75], [8.25, 7.75], [9.75, 13.75], [17.75, 13.75], [17.75, 17.75], [6, 17.75]], [1.5, 1.25, 1, 1.5, 1.5, 2])),
    T(sq(4.25, 2.75, 4, 2.5, 1.25)),
    T(vl(6.25, 5.25, 7.75)),
  ];
}
{
  const S = seat();
  const heat = [13, 16.5, 20].map((x) => waveV(x, 3, 10.75, 0.9));
  add('seat-heater', ['asiento calefactado', 'calefacción de asientos', 'asiento caliente', 'heated seats', 'seat heater', 'warm seat'], [...S, ...heat]);
  FILL['seat-heater'] = { solid: [0, 1], wire: [2], lines: [3, 4, 5] };
  PARTS['seat-heater'] = { seat: [0, 1, 2], heat: [3, 4, 5] };
  // Three arrows of air, the middle one lower so their heads stay clear of each other
  const air = [[12.5, 3.5], [16.6, 7.5], [20.7, 3.5]].flatMap(([x, y]) => [vl(x, 10.75, y), head([x, y], [0, -1], 1.75)]);
  add('seat-ventilation', ['asiento ventilado', 'ventilación de asientos', 'asiento fresco', 'ventilated seats', 'cooled seats', 'seat cooling'], [...S, ...air]);
  FILL['seat-ventilation'] = { solid: [0, 1], wire: [2], lines: [3, 4, 5, 6, 7, 8] };
  PARTS['seat-ventilation'] = { seat: [0, 1, 2], air: [3, 4, 5, 6, 7, 8] };
  const S2 = seat((d) => scale(d, 0.9, [11, 2.75]));
  add('seat-adjust', ['ajuste de asiento', 'asiento eléctrico', 'memoria de asiento', 'posición del asiento', 'seat adjust', 'power seat', 'memory seat'], [...S2, hl(20.75, 6.5, 17.5), head([6.5, 20.75], [-1, 0], 2), head([17.5, 20.75], [1, 0], 2)]);
  FILL['seat-adjust'] = { solid: [0, 1], wire: [2], lines: [3, 4, 5] };
  PARTS['seat-adjust'] = { seat: [0, 1, 2], arrow: [3, 4, 5] };
}
// Air recirculation and fresh air: the car from the side (the same profile for both), the air
// looping inside it or coming in from outside over the front.
const SIDE = roundpoly([[3, 18], [3, 12.75], [6.75, 6.25], [13.5, 6.25], [17.25, 11.5], [20.75, 12.5], [21, 18]], [1, 1.5, 1.5, 1.5, 1.25, 1.5, 1]);
add('air-recirculation', ['recirculación de aire', 'aire interior', 'recircular', 'air recirculation', 'recirculate', 'cabin air'], [SIDE, roundline([[16.5, 15], [8, 15], [8, 11], [13, 11]], [0, 2, 2, 0]), head([13, 11], [1, 0], 2.5)]);
add('fresh-air', ['aire exterior', 'toma de aire', 'aire fresco', 'fresh air', 'outside air', 'air intake'], [SIDE, roundline([[21, 3], [10.5, 3], [10.5, 12]], [0, 2, 0]), head([10.5, 12], [0, 1], 2.5)]);
FILL['air-recirculation'] = { solid: [0], cut: [1, 2] };
FILL['fresh-air'] = { solid: [0], wire: [line([21, 3], [12.5, 3])], cut: [roundline([[12.5, 3], [10.5, 3], [10.5, 12]], [0, 2, 0]), 2] };
for (const name of ['air-recirculation', 'fresh-air']) PARTS[name] = { car: [0], arrow: [1, 2] };

// ── Keys ──────────────────────────────────────────────────────────────────────────────────────
// Car key: the fob with its two buttons, the key blade out of one end.
const BLADE = roundline([[12.75, 10.5], [20, 10.5], [21.25, 12], [20, 13.5], [12.75, 13.5]], [0, 0.5, 0.4, 0.5, 0]);
add('car-key', ['llave del auto', 'llave con control', 'entrega de llaves', 'renta de autos', 'car key', 'key fob', 'key handover'], [sq(2.75, 6.5, 10, 11, 2.25), dot(7.75, 9.75), dot(7.75, 14.25), BLADE]);
FILL['car-key'] = { solid: [0, shut(BLADE)], cut: [1, 2] };
PARTS['car-key'] = { fob: [0, 1, 2], blade: [3] };
// Keyless entry: the smart fob with its three buttons and its signal leaving the top.
add('keyless-entry', ['llave inteligente', 'acceso sin llave', 'llave digital', 'abrir a distancia', 'keyless entry', 'smart key', 'remote lock'], [
  sq(7, 8.75, 10, 12.5, 3.5),
  hl(12, 10.5, 13.5),
  hl(15, 10.5, 13.5),
  hl(18, 10.5, 13.5),
  arc(12, 10, 4.5, 250, 290).d,
  arc(12, 10, 7.5, 240, 300).d,
]);
FILL['keyless-entry'] = { solid: [0], cut: [1, 2, 3], lines: [4, 5] };
PARTS['keyless-entry'] = { fob: [0, 1, 2, 3], wave: [4, 5] };

// ── Fuel and charging ─────────────────────────────────────────────────────────────────────────
// Fuel nozzle: the body and its grip in one piece, the spout bent down, the trigger guard and the hose.
{
  const grip = [[13.75, 10], [16.5, 15.75]];
  const gx = grip[0][0] + ((12.75 - grip[0][1]) / (grip[1][1] - grip[0][1])) * (grip[1][0] - grip[0][0]);
  add('fuel-nozzle', ['pistola de gasolina', 'bomba de gasolina', 'tipo de combustible', 'cargar gasolina', 'fuel nozzle', 'fuel pump', 'pay at the pump'], [
    roundpoly([[8.5, 5.25], [16.25, 5.25], [19.75, 14.75], [16.5, 15.75], [13.75, 10], [8.5, 10]], [1.25, 1.5, 1, 1, 0.75, 1.25]),
    roundline([[8.5, 7.5], [4.5, 7.5], [3, 10.5]], [0, 1, 0]),
    roundline([[10, 10], [10, 12.75], [gx, 12.75]], [0, 1, 0]),
    'M18.13 15.25C18.25 19 19.5 20.75 21.25 20.75',
  ]);
  FILL['fuel-nozzle'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['fuel-nozzle'] = { nozzle: [0, 1, 2], hose: [3] };
}
// Jerrycan: the body (the signature corner) with its spout on the cut corner, the three-bar
// handle on top and the X pressed into its side.
add('jerrycan', ['bidón', 'garrafa de gasolina', 'sin gasolina', 'combustible de reserva', 'jerrycan', 'fuel can', 'out of fuel'], [
  roundpoly([[4.75, 6.25], [14.5, 6.25], [19.25, 11], [19.25, 21.25], [4.75, 21.25]], [1.25, 1, 1, 0, 2]),
  roundline([[7, 6.25], [7, 3.25], [13, 3.25], [13, 6.25]], [0, 1, 1, 0]),
  vl(10, 3.25, 6.25),
  line([16.88, 8.63], [18.65, 6.86]),
  line([8.5, 12], [15.5, 18.25]),
  line([15.5, 12], [8.5, 18.25]),
]);
FILL.jerrycan = { solid: [0], wire: [1, 2, 3], cut: [4, 5] };
PARTS.jerrycan = { can: [0, 4, 5], handle: [1, 2], spout: [3] };
// The connectors' faces: Type 1 (J1772) with its latch notch, Type 2 with its flat top and seven
// pins.
{
  const yt = 12 - Math.sqrt(81 - 2.25);
  add('ev-connector-type-1', ['tipo 1', 'j1772', 'conector de carga', 'filtrar estaciones', 'type 1', 'ev connector', 'charging plug'], [
    `M13.5 ${f(yt)}A9 9 0 1 1 10.5 ${f(yt)}V5.25H13.5Z`,
    circ(8.25, 10.75, 2),
    circ(15.75, 10.75, 2),
    dot(7.5, 16),
    dot(16.5, 16),
    dot(12, 17.75),
  ]);
  FILL['ev-connector-type-1'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['ev-connector-type-1'] = { face: [0], pins: [1, 2, 3, 4, 5] };
  const hc = Math.sqrt(81 - 56.25);
  add('ev-connector-type-2', ['tipo 2', 'mennekes', 'conector de carga', 'filtrar estaciones', 'type 2', 'ev connector', 'charging plug'], [
    `M${f(12 - hc)} 4.5H${f(12 + hc)}A9 9 0 1 1 ${f(12 - hc)} 4.5Z`,
    ...[[9.75, 8.25], [14.25, 8.25], [7.5, 12.25], [12, 12.25], [16.5, 12.25], [9.75, 16.25], [14.25, 16.25]].map((p) => dot(...p)),
  ]);
  FILL['ev-connector-type-2'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS['ev-connector-type-2'] = { face: [0], pins: [1, 2, 3, 4, 5, 6, 7] };
}
// lugares' charger with the engine's badges.
add('ev-charger-clock', ['carga programada', 'horario de carga', 'tiempo restante de carga', 'scheduled charging', 'charge timer', 'off-peak charging'], [...L['ev-charger'].d], { badge: badge('clock') });
add('ev-charger-alert', ['cargador fuera de servicio', 'falla de carga', 'error del cargador', 'charger out of service', 'charging fault', 'charger error'], [...L['ev-charger'].d], { badge: badge('alert') });
for (const name of ['ev-charger-clock', 'ev-charger-alert']) {
  FILL[name] = { solid: [0], wire: [2], cut: [1] };
  PARTS[name] = { pump: [0], bolt: [1], hose: [2] };
}

// ── The workshop ──────────────────────────────────────────────────────────────────────────────
// Car wash: lugares' car under a row of falling drops.
{
  const car = carFront(0.7);
  const drops = [6, 12, 18].map((x) => droplet([x, 5.22], 1.75));
  add('car-wash', ['autolavado', 'lavado de autos', 'suscripción de lavado', 'car wash', 'wash bay', 'wash subscription'], [...car.d, ...drops]);
  FILL['car-wash'] = carFill(car, { solid: drops });
  PARTS['car-wash'] = { car: [0, 1, 2, 3], drops: [4, 5, 6] };
}
// Car detailing: the car with datos' sparkle above one roof corner.
{
  const car = carFront(0.75, -1);
  const spark = scale(datos.icons.sparkle.d[0], 3 / 9.25, [12, 12], 18.25 - 12, 5.25 - 12);
  add('car-detailing', ['detallado', 'pulido', 'encerado', 'limpieza de interiores', 'car detailing', 'polish', 'waxing'], [...car.d, spark]);
  FILL['car-detailing'] = carFill(car, { solid: [spark] });
  PARTS['car-detailing'] = { car: [0, 1, 2, 3], sparkle: [4] };
}
// Car lift: two posts, their arms holding the car's body raised between them.
{
  const k = 0.62;
  const car = carFront(k, 0, -5.75);
  const y = 15 + ((10.25 + 17.75) / 2 - 20.75) * k;
  const x = 12 - 9.25 * k;
  add('car-lift', ['elevador de autos', 'taller mecánico', 'cita de servicio', 'rampa', 'car lift', 'mechanic bay', 'service appointment'], [...car.d, vl(3.25, 2.75, 21.25), vl(20.75, 2.75, 21.25), hl(y, 3.25, x), hl(y, 24 - x, 20.75)]);
  FILL['car-lift'] = carFill(car, { wire: [vl(3.25, 2.75, 21.25), vl(20.75, 2.75, 21.25), hl(y, 3.25, x), hl(y, 24 - x, 20.75)] });
  PARTS['car-lift'] = { car: [0, 1, 2, 3], posts: [4, 5], arms: [6, 7] };
}
// Car repair: the car with the set's small wrench on top as a custom badge (desarrollo's
// lightbulb-wrench: an open jaw and its handle, the jaw opened wider so it never reads as a lens);
// the engine clears the car under it.
{
  const car = carFront(1, 0, -1);
  const C = [18.25, 16.25];
  // The jaw's two tips run straight out along the wrench, so the head reads as a wrench's
  const out = [Math.SQRT1_2, -Math.SQRT1_2];
  const a = arc(...C, 2.75, 20, 250);
  const [t0, t1] = [polar(...C, 2.75, 20), a.end];
  const jaw = `M${pt(add2(t0, mul(out, 1.25)))}L${pt(t0)}${a.d.replace(/^M[^A]*/, '')}L${pt(add2(t1, mul(out, 1.25)))}`;
  const handle = line(polar(...C, 2.75, 135), [14, 21.25]);
  // The right tire is under the wrench: left out, so no piece of it peeks past the wrench's clearance
  const [body, cabin, tl, , ...lights] = car.d;
  add('car-repair', ['taller', 'reparación de autos', 'presupuesto de reparación', 'hojalatería', 'car repair', 'auto repair', 'repair shop'], [body, cabin, tl, ...lights], {
    badge: { d: [jaw, handle], knock: `${circ(...C, 3.5)}M${pt(polar(...C, 2.75, 135))}L14 21.25Z` },
  });
  FILL['car-repair'] = { solid: [0, shut(cabin), shut(tl)], cut: [car.fill.cut[0], 3, 4] };
  PARTS['car-repair'] = { car: [0, 1, 2], lights: [3, 4] };
}
// OBD port: the trapezoid connector and its two rows of pins.
{
  const pins = [...[6.38, 10.13, 13.88, 17.63].map((x) => dot(x, 10.25, 0.3)), ...[8.25, 12, 15.75].map((x) => dot(x, 14, 0.3))];
  add('obd-port', ['puerto obd', 'diagnóstico', 'escáner automotriz', 'códigos de falla', 'obd port', 'diagnostics', 'fault codes'], [roundpoly([[2.75, 7], [21.25, 7], [19, 17], [5, 17]], [2, 2, 2.5, 2.5]), ...pins]);
  FILL['obd-port'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS['obd-port'] = { port: [0], pins: [1, 2, 3, 4, 5, 6, 7] };
}
// Blade fuse: the flat head with its window and the two blades below.
{
  const prong = (x) => roundline([[x, 12.75], [x, 21.25], [x + 3.25, 21.25], [x + 3.25, 12.75]], [0, 0.75, 0.75, 0]);
  add('blade-fuse', ['fusible', 'caja de fusibles', 'falla eléctrica', 'blade fuse', 'fuse box', 'electrical repair'], [sq(4.25, 3.25, 15.5, 9.5, 1.5), sq(9, 6.25, 6, 3.5, 1), prong(7), prong(13.75)]);
  FILL['blade-fuse'] = { solid: [0, shut(prong(7)), shut(prong(13.75))], cut: [1] };
  PARTS['blade-fuse'] = { head: [0, 1], blades: [2, 3] };
}
// Trailer hitch: the ball on its neck at the end of the receiver bar.
add('trailer-hitch', ['enganche', 'remolque', 'capacidad de arrastre', 'bola de remolque', 'trailer hitch', 'tow hitch', 'towing'], [sq(4.25, 14.5, 15.5, 4, 1.25), vl(16.5, 11.5, 14.5), circ(16.5, 8.25, 3.25)]);
FILL['trailer-hitch'] = { solid: [0, 2], wire: [1] };
PARTS['trailer-hitch'] = { bar: [0], neck: [1], ball: [2] };
// Breathalyzer: a handheld device (the signature corner), its display and button, the mouthpiece on top.
{
  const tube = roundline([[10.5, 7.25], [10.5, 2.75], [13.5, 2.75], [13.5, 7.25]], [0, 1, 1, 0]);
  add('breathalyzer', ['alcoholímetro', 'prueba de alcohol', 'alcoholemia', 'manejo seguro', 'breathalyzer', 'alcohol test', 'sobriety checkpoint'], [sq(6.75, 7.25, 10.5, 14, 2, BR), sq(9.75, 10.25, 4.5, 3.75, 1), dot(12, 17.5), tube]);
  FILL.breathalyzer = { solid: [0, shut(tube)], cut: [1, 2] };
  PARTS.breathalyzer = { device: [0, 1, 2], mouthpiece: [3] };
}

// ── Parking and tolls ─────────────────────────────────────────────────────────────────────────
add('parking-meter', ['parquímetro', 'pagar estacionamiento', 'tiempo de parquímetro', 'parking meter', 'pay for parking', 'street parking'], ['M6.25 13V8.5A5.75 5.75 0 0 1 17.75 8.5V13Z', sq(9.5, 6.5, 5, 3, 0.75), vl(12, 13, 21.25)]);
FILL['parking-meter'] = { solid: [0], cut: [1], wire: [2] };
PARTS['parking-meter'] = { head: [0, 1], post: [2] };
// Parking garage: the structure cut open, its columns and two decks over the ground level, and
// lugares' car parked under them. Its ramp zigzagging between three slabs read as a play arrow.
{
  const car = carFront(0.52, 0, -0.75);
  const frame = [vl(4, 3.75, 20), vl(20, 3.75, 20), hl(3.75, 4, 20), hl(8.25, 4, 20)];
  add('parking-garage', ['estacionamiento techado', 'edificio de estacionamiento', 'niveles', 'parking garage', 'multi-storey car park', 'covered parking'], [...frame, ...car.d]);
  FILL['parking-garage'] = { ...carFill(car), wire: frame };
  PARTS['parking-garage'] = { structure: [0, 1, 2, 3], car: [4, 5, 6, 7] };
}
add('parking-clock', ['tiempo de estacionamiento', 'tiempo restante', 'estancia máxima', 'parking time limit', 'time left', 'session expiring'], [...L.parking.d], { badge: badge('clock') });
FILL['parking-clock'] = { solid: [0], cut: [1] };
PARTS['parking-clock'] = { sign: [0], letter: [1] };
// Parking ticket: the windshield, the wiper arm at rest low across it, rising from its pivot on the
// bottom edge, and the ticket standing up from under it, its torn edge on top: its sides end on the
// arm, so its bottom is hidden behind it. With the arm across the slip's middle it read as a
// prohibition sign, and as a plain slip, as a door.
{
  const arm = line([7, 19], [16.75, 14.13]);
  const yArm = (x) => 19 - (x - 7) * ((19 - 14.13) / 9.75);
  const [x0, x1, y0, t] = [9.25, 15, 8.75, 0.9];
  const w = (x1 - x0) / 3;
  const slip = line([x0, yArm(x0)], [x0, y0], [x0 + w / 2, y0 - t], [x0 + w, y0], [x0 + 1.5 * w, y0 - t], [x0 + 2 * w, y0], [x0 + 2.5 * w, y0 - t], [x1, y0], [x1, yArm(x1)]);
  add('parking-ticket', ['multa de estacionamiento', 'infracción', 'pagar multa', 'parking ticket', 'parking fine', 'citation'], [WS, slip, arm]);
  FILL['parking-ticket'] = { solid: [0], cut: [1, 2] };
  PARTS['parking-ticket'] = { glass: [0], ticket: [1], wiper: [2] };
}
// Toll booth: the booth (the signature corner) under its roof, a window, and the boom arm.
add('toll-booth', ['caseta de cobro', 'casetas', 'peaje', 'pagar caseta', 'toll booth', 'toll plaza', 'pay a toll'], [
  sq(2.25, 4.25, 11.5, 3.25, 0.75),
  roundline([[3.5, 7.5], [3.5, 21.25], [12.5, 21.25], [12.5, 7.5]], [0, 1.25, 0, 0]),
  sq(6.5, 10.5, 3, 3, 0.75),
  sq(12.5, 11.5, 8.75, 3, 1.5),
]);
FILL['toll-booth'] = { solid: [0, shut(roundline([[3.5, 7.5], [3.5, 21.25], [12.5, 21.25], [12.5, 7.5]], [0, 1.25, 0, 0])), 3], cut: [2] };
PARTS['toll-booth'] = { booth: [0, 1, 2], boom: [3] };
// Speed camera: the camera box (the signature corner) facing us with its lens, on a pole under the
// lens, flashing to the side. Seen from the side with the pole at one end it read as a mallet.
add('speed-camera', ['fotomulta', 'radar de velocidad', 'cámara de tránsito', 'speed camera', 'red light camera', 'traffic camera'], [
  sq(3.25, 3.25, 11, 9.5, 2, BR),
  circ(8.75, 8, 1.75),
  vl(8.75, 12.75, 21.25),
  arc(14.25, 8, 3.5, -35, 35).d,
  arc(14.25, 8, 6.5, -35, 35).d,
]);
FILL['speed-camera'] = { solid: [0], cut: [1], wire: [2], lines: [3, 4] };
PARTS['speed-camera'] = { camera: [0], lens: [1], pole: [2], flash: [3, 4] };

// ── The driver ────────────────────────────────────────────────────────────────────────────────
// Driver's license: comunicacion's id-card (its card and its two lines) with the steering wheel in
// the photo's place: the rim, its bar and the spoke down. Beside the bust there was room only for a
// rim and a bar, and that read as a minus sign. The check badge takes the short line and leaves the
// wheel whole.
{
  const card = comunicacion.icons['id-card'].d;
  const [c, r] = [[8.6, 12], 3.25];
  const wheel = [circ(...c, r), hl(c[1], c[0] - r, c[0] + r), vl(c[0], c[1], c[1] + r)];
  add('driver-license', ['licencia de conducir', 'licencia', 'permiso de conducir', 'driver license', 'driving licence', 'license on file'], [card[0], ...wheel, card[3], card[4]]);
  FILL['driver-license'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['driver-license'] = { card: [0], wheel: [1, 2, 3], lines: [4, 5] };
  add('driver-license-check', ['conductor verificado', 'licencia aprobada', 'licencia validada', 'verified driver', 'license approved', 'driver verified'], [card[0], ...wheel, card[3]], { badge: badge('check') });
  FILL['driver-license-check'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['driver-license-check'] = { card: [0], wheel: [1, 2, 3], lines: [4] };
}

// ── The road ──────────────────────────────────────────────────────────────────────────────────
// Beside the badge the road narrows toward the left (only across: its dashes keep their lengths), so
// its far edge runs into the badge and its middle line stays clear of it.
const ROAD_S = L.road.d.map((d) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${f(1.75 + (Number(x) - 1.75) * 0.78)} ${y}`));
add('road-alert', ['incidente adelante', 'peligro en el camino', 'accidente reportado', 'road hazard', 'incident ahead', 'accident reported'], ROAD_S, { badge: badge('alert') });
add('road-clock', ['tráfico lento', 'retraso', 'tiempo de llegada', 'traffic delay', 'slow traffic', 'eta'], ROAD_S, { badge: badge('clock') });
add('road-block', ['camino cerrado', 'cierre vial', 'evitar esta vía', 'road closed', 'road closure', 'avoid road'], ROAD_S, { badge: badge('block') });
for (const name of ['road-alert', 'road-clock', 'road-block']) {
  FILL[name] = false;
  PARTS[name] = { edges: [0, 1], lanes: [2, 3, 4] };
}
// Pothole: lugares' road, its middle line stopping short of a ragged hole in the lane (its outline
// only bulges, so its inside never pinches shut at the heavy weights). A broken
// surface line in profile read as a pulse.
{
  const hole = roundpoly([[16.25, 16.5], [15, 18.5], [12.5, 19], [9.5, 18.75], [7.75, 17], [8.75, 15], [11, 14.25], [13.75, 14.75]], [0.75, 0.5, 0.75, 0.5, 0.75, 0.5, 0.75, 0.5]);
  add('pothole', ['bache', 'reportar bache', 'estado del camino', 'daño en el pavimento', 'pothole', 'road damage', 'road condition'], [L.road.d[0], L.road.d[1], L.road.d[2], L.road.d[3], hole]);
  FILL.pothole = { solid: [4], wire: [0, 1, 2, 3] };
  PARTS.pothole = { road: [0, 1, 2, 3], hole: [4] };
}
// Crosswalk from above: three wide bars between the two curbs (narrow ones read as zeros; four put
// more ink in it than the set allows).
{
  const bars = [2.75, 10, 17.25].map((x) => sq(x, 8.25, 4, 7.5, 0.75));
  add('crosswalk', ['paso peatonal', 'cebra', 'cruce peatonal', 'crosswalk', 'zebra crossing', 'pedestrian crossing'], [hl(4.5, 2.75, 21.25), hl(19.5, 2.75, 21.25), ...bars]);
  FILL.crosswalk = { solid: [2, 3, 4], lines: [0, 1] };
  PARTS.crosswalk = { curbs: [0, 1], stripes: [2, 3, 4] };
}
// Traffic drum: the drum with its two reflective stripes, on a wide base ring.
{
  const side = (y) => [7.25 - ((y - 3.25) / 15) * 1.25, 16.75 + ((y - 3.25) / 15) * 1.25];
  const drum = roundline([[6, 18.25], [7.25, 3.25], [16.75, 3.25], [18, 18.25]], [0, 1.5, 1.5, 0]);
  add('traffic-barrel', ['tambo', 'obras viales', 'cierre de carril', 'zona de construcción', 'traffic barrel', 'traffic drum', 'roadworks'], [drum, hl(8.25, ...side(8.25)), hl(13.25, ...side(13.25)), sq(3.25, 18.25, 17.5, 3, 1.5)]);
  FILL['traffic-barrel'] = { solid: [shut(drum), 3], cut: [1, 2] };
  PARTS['traffic-barrel'] = { drum: [0], stripes: [1, 2], base: [3] };
}
// Bollard: a short post with a domed cap and one reflective band (its two edges), on the ground.
{
  const post = 'M8.5 21.25V8.25A3.5 3.5 0 0 1 15.5 8.25V21.25';
  add('bollard', ['bolardo', 'poste', 'zona peatonal', 'barrera vehicular', 'bollard', 'vehicle barrier', 'pedestrian zone'], [post, hl(11.25, 8.5, 15.5), hl(14.25, 8.5, 15.5), hl(21.25, 4.75, 19.25)]);
  FILL.bollard = { solid: [shut(post)], cut: [1, 2], wire: [3] };
  PARTS.bollard = { post: [0], band: [1, 2], ground: [3] };
}
// Guardrail, running away from us along the road's edge: the beam with the groove of its W profile
// down its middle, on three posts that shorten into the distance. Seen square on, its beam on posts
// read as a bench, a columned building or a comb.
{
  const [l0, l1, r0, r1] = [9, 15.5, 3.75, 10.25];
  const beam = roundpoly([[2.75, l0], [21.25, r0], [21.25, r1], [2.75, l1]], 1);
  const groove = line([2.75, (l0 + l1) / 2], [21.25, (r0 + r1) / 2]);
  const yb = (x) => l1 + ((x - 2.75) * (r1 - l1)) / 18.5;
  const posts = [[6, 21.25], [12, 19.25], [18, 17.25]].map(([x, y]) => vl(x, yb(x), y));
  add('crash-barrier', ['barrera de contención', 'defensa metálica', 'orilla de carretera', 'guardrail', 'crash barrier', 'road edge'], [beam, groove, ...posts]);
  FILL['crash-barrier'] = { solid: [0], cut: [1], wire: [2, 3, 4] };
  PARTS['crash-barrier'] = { beam: [0, 1], posts: [2, 3, 4] };
}

// ── Signs ─────────────────────────────────────────────────────────────────────────────────────
// One frame per kind: the octagon (smaller than sistema's alert-octagon, with its rim and post),
// the yield triangle, the round sign, the plate, and lugares' directions diamond for every warning.
{
  const oct = (r, rad) => roundpoly(Array.from({ length: 8 }, (_, i) => polar(12, 9.5, r, 22.5 + i * 45)), rad);
  const R = 7.25;
  const apo = R * Math.cos(Math.PI / 8);
  add('stop-sign', ['alto', 'señal de alto', 'parada obligatoria', 'alto total', 'stop sign', 'stop', 'all-way stop'], [oct(R, 1.25), oct((apo - 3) / Math.cos(Math.PI / 8), 0.75), vl(12, 9.5 + apo, 21.25)]);
  FILL['stop-sign'] = { solid: [0], cut: [1], wire: [2] };
  PARTS['stop-sign'] = { sign: [0, 1], post: [2] };
}
{
  const T = [[2.75, 4], [21.25, 4], [12, 20.5]];
  add('yield-sign', ['ceda el paso', 'señal de ceder', 'preferencia', 'yield sign', 'give way', 'yield'], [roundpoly(T, 2), roundpoly(inset(T, 3), 0.75)]);
  FILL['yield-sign'] = { solid: [0], cut: [1] };
  PARTS['yield-sign'] = { sign: [0, 1] };
}
add('speed-limit', ['límite de velocidad', 'velocidad máxima', 'señal de velocidad', 'speed limit', 'speed sign', 'max speed'], [circ(12, 9.75, 7.5), circ(12, 9.75, 4.5), vl(12, 17.25, 21.25)]);
FILL['speed-limit'] = { solid: [0], cut: [1], wire: [2] };
PARTS['speed-limit'] = { sign: [0, 1], post: [2] };
add('no-entry', ['prohibido el paso', 'no entrar', 'sentido contrario', 'no entry', 'do not enter', 'wrong way'], [circ(12, 12, 9), sq(6, 10, 12, 4, 2)]);
FILL['no-entry'] = { solid: [0], cut: [1] };
PARTS['no-entry'] = { sign: [0], bar: [1] };
add('one-way', ['un sentido', 'calle de un sentido', 'sentido único', 'one way', 'one-way street', 'single direction'], [
  sq(2.5, 5.5, 19, 13, 3),
  roundpoly([[5.5, 10.5], [13.75, 10.5], [13.75, 8.5], [18.5, 12], [13.75, 15.5], [13.75, 13.5], [5.5, 13.5]], [0.6, 0.4, 0.6, 0.9, 0.6, 0.4, 0.6]),
]);
FILL['one-way'] = { solid: [0], cut: [1] };
PARTS['one-way'] = { sign: [0], arrow: [1] };
// Roundabout: three arrows chasing each other counterclockwise around the island.
{
  const arrows = [90, 210, 330].flatMap((a0) => {
    const a = arc(12, 12, 7.5, a0, a0 - 80);
    return [a.d, head(a.end, a.tangent, 2.75)];
  });
  add('roundabout', ['glorieta', 'rotonda', 'redondel', 'roundabout', 'traffic circle', 'rotary'], [circ(12, 12, 2.25), ...arrows]);
  FILL.roundabout = { solid: [0], lines: [1, 2, 3, 4, 5, 6] };
  PARTS.roundabout = { island: [0], arrows: [1, 2, 3, 4, 5, 6] };
}
add('height-limit', ['altura máxima', 'gálibo', 'puente bajo', 'height limit', 'low clearance', 'max height'], [
  roundpoly([[4.5, 3.25], [19.5, 3.25], [12, 8.25]], [1, 1, 1]),
  roundpoly([[12, 15.75], [19.5, 20.75], [4.5, 20.75]], [1, 1, 1]),
]);
FILL['height-limit'] = { solid: [0, 1] };
PARTS['height-limit'] = { top: [0], bottom: [1] };
// Railroad crossing: the crossbuck's boards on their post; the front board goes on top as a custom
// piece and the engine clears the board behind it. The post stands below them, clear of both.
{
  const board = (deg) => move(turnPath(sq(-9, -1.75, 18, 3.5, 1.75), deg, [0, 0]), 12, 9);
  const front = board(35);
  add('railroad-crossing', ['cruce de ferrocarril', 'paso a nivel', 'vías del tren', 'railroad crossing', 'level crossing', 'train crossing'], [board(-35), vl(12, 14.75, 21.25)], { badge: { d: [front], knock: front, fill: { solid: [front] } } });
  FILL['railroad-crossing'] = { solid: [0], wire: [1] };
  PARTS['railroad-crossing'] = { board: [0], post: [1] };
}
// School zone: the pentagon sign and a child walking with a backpack (lugares' walking figure).
{
  const k = 0.6;
  const W = (d) => scale(d, k, [12.25, 21], -0.5, -2.75);
  const head = scalePt([13.25, 4.5], k, [12.25, 21], -0.5, -2.75);
  add('school-zone', ['zona escolar', 'cruce escolar', 'escuela', 'niños', 'school zone', 'school crossing', 'children crossing'], [
    roundpoly([[12, 2.5], [20.5, 9], [20.5, 21.25], [3.5, 21.25], [3.5, 9]], [1.5, 1.25, 1.75, 1.75, 1.25]),
    circ(...head, 1.5),
    W(line([12.6, 8.5], [11, 14])),
    W(roundline([[11, 14], [8.5, 17.25], [7.25, 21]], [0, 0.6, 0])),
    W(roundline([[11, 14], [13.75, 16.5], [14.5, 21]], [0, 0.6, 0])),
    W(roundline([[12.6, 8.5], [14.75, 11.5], [17.25, 12.25]], [0, 0.6, 0])),
    W(roundpoly([[12.5, 8.75], [11.4, 12.6], [6.75, 11.5], [7.9, 7.6]], 1.25)),
  ]);
  FILL['school-zone'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['school-zone'] = { sign: [0], child: [1, 2, 3, 4, 5], backpack: [6] };
}
// The warning diamond (lugares' directions sign) and what each one warns of, inside its center.
const warn = (name, tags, d, fill) => {
  add(name, tags, [L.directions.d[0], ...d]);
  FILL[name] = { solid: [0], cut: d.map((_, i) => i + 1), ...fill };
  PARTS[name] = { sign: [0], symbol: d.map((_, i) => i + 1) };
};
warn('road-sign-curve', ['curva peligrosa', 'curva adelante', 'señal de curva', 'curve ahead', 'bend', 'curve sign'], ['M11.25 16.25V12.5C11.25 10.75 12.25 9.5 13.75 8.75']);
// The walker inside it is drawn for its size: a dot for the head, the arms through the shoulder, the
// legs from the hip, one figure in one stroke
warn('road-sign-pedestrian', ['cruce de peatones', 'peatones', 'señal peatonal', 'pedestrian crossing', 'pedestrians', 'crosswalk ahead'], [
  dot(12.75, 7.25),
  `${line([10, 11.25], [12.25, 10.75], [14.5, 11.75])}${line([12.25, 10.75], [11.5, 13.5], [10.85, 16.15])}${line([11.5, 13.5], [13.25, 15.75])}`,
]);
warn('road-sign-slippery', ['camino resbaloso', 'pavimento mojado', 'hielo', 'slippery road', 'slippery when wet', 'ice'], [waveV(10, 9, 15, 1), waveV(14, 9, 15, 1)]);
warn('road-sign-merge', ['incorporación', 'carril que se une', 'tráfico que entra', 'merge', 'merging traffic', 'lane merge'], [vl(11.25, 7.5, 16.5), 'M15 14.25C15 12.5 11.25 12.75 11.25 10.25']);
warn('road-sign-narrows', ['estrechamiento', 'camino angosto', 'reducción de carriles', 'road narrows', 'narrow road', 'lane reduction'], (() => {
  const left = roundline([[9, 14], [9, 12.5], [10.5, 11], [10.5, 8.5]], [0, 0.6, 0.6, 0]);
  return [left, flipPath(left)];
})());
warn('road-sign-bump', ['tope', 'reductor de velocidad', 'vibradores', 'speed bump', 'speed hump', 'uneven road'], ['M8.5 13.75H9.75C10.6 13.75 10.75 10.25 12 10.25S13.4 13.75 14.25 13.75H15.5']);
warn('road-sign-crossroads', ['cruce', 'intersección', 'crucero adelante', 'crossroads', 'intersection', 'junction ahead'], [vl(12, 6.75, 17.25), hl(12, 6.75, 17.25)]);

// ── Lanes ─────────────────────────────────────────────────────────────────────────────────────
// Lane guidance: three arrows side by side, the outer two shifting left and right as they rise.
{
  const left = 'M6.75 20.75V13C6.75 10.5 4.5 9 4.5 6.25';
  const tip = [4.5, 6.25];
  const arrowL = [left, head(tip, [0, -1], 2.5)];
  add('lane-guidance', ['guía de carriles', 'qué carril tomar', 'carriles', 'lane guidance', 'lane assist', 'which lane'], [...arrowL, vl(12, 20.75, 4.25), head([12, 4.25], [0, -1], 2.5), ...arrowL.map((d) => flipPath(d))]);
  FILL['lane-guidance'] = false;
  PARTS['lane-guidance'] = { left: [0, 1], straight: [2, 3], right: [4, 5] };
}
// Lane change: the dashed lane line and an arrow curving across it into the next lane.
{
  const arrow = 'M6.75 21V16.5C6.75 13 17.25 13 17.25 9.5V4.25';
  add('lane-change', ['cambio de carril', 'rebasar', 'cambiar de carril', 'lane change', 'change lanes', 'overtake'], [...dashes([12, 2.75], [12, 21.25], 3), arrow, head([17.25, 4.25], [0, -1], 2.75)]);
  FILL['lane-change'] = false;
  PARTS['lane-change'] = { lane: [0, 1, 2], arrow: [3, 4] };
}

// ── Fill, parts, motion, mirror and variants, in blocks ───────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (!spec) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut?.length && { cut: pick(spec.cut) }), ...(spec.lines?.length && { lines: pick(spec.lines) }), ...(spec.wire?.length && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// A badge moves on its own: the clock turns its hands, an alert rocks
for (const name of ['ev-charger-clock', 'parking-clock', 'road-clock']) icons[name].motion = { effect: 'spin', parts: ['badge'], origin: BC };
for (const name of ['steering-wheel-alert', 'engine-alert', 'ev-charger-alert', 'road-alert']) icons[name].motion = { effect: 'wiggle', parts: ['badge'], origin: BC };
const MOTION = {
  'steering-wheel': { effect: 'wiggle', origin: [12, 12] },
  'steering-wheel-heated': { effect: 'float', parts: ['heat'], vector: [0, -1.25] },
  gearstick: { effect: 'wiggle', origin: [12, 14.75] },
  'automatic-shifter': { effect: 'slide', parts: ['handle'], vector: [0, 1.5] },
  'pedal-brake': { effect: 'slide', parts: ['pedal'], vector: [0, 1] },
  handbrake: { effect: 'ring', parts: ['lever', 'button'], origin: [8, 14] },
  ignition: { effect: 'wiggle', parts: ['key'], origin: [10.75, 13.5] },
  engine: { effect: 'wiggle', origin: [12, 18.75] },
  'oil-can': { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
  'oil-change': { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
  wheel: { effect: 'spin', origin: [12, 12] },
  'tire-rotation': { effect: 'spin', parts: ['arrow'], origin: [12, 12] },
  'tire-pressure': { effect: 'wiggle', parts: ['mark'], origin: [12, 14.85] },
  'brake-warning': { effect: 'wiggle', parts: ['mark'], origin: [12, 15.4] },
  'brake-antilock': { effect: 'spin', parts: ['arrow'], origin: [12, 12] },
  'brake-disc': { effect: 'spin', parts: ['disc', 'hub', 'vents'], origin: [10.75, 13.25] },
  'shock-absorber': { effect: 'bounce', vector: [0, -1.5] },
  airbag: { effect: 'beat', parts: ['bag'], origin: [16.25, 7.75] },
  'turn-signals': { effect: 'beat', origin: [12, 12] },
  'hazard-lights': { effect: 'beat', origin: [12, 14] },
  'traction-control': { effect: 'wiggle', parts: ['car'], origin: [12, 8] },
  'self-driving': { effect: 'spin', parts: ['sensing'], origin: [12, 12] },
  'windshield-wiper': { effect: 'ring', parts: ['wiper'], origin: [12, 19] },
  'windshield-defrost': { effect: 'float', parts: ['heat'], vector: [0, -1] },
  'rear-window-defrost': { effect: 'float', parts: ['heat'], vector: [0, -1] },
  'seat-adjust': { effect: 'slide', parts: ['seat'], vector: [1.5, 0] },
  'car-key': { effect: 'wiggle', origin: [7.75, 12] },
  'car-wash': { effect: 'slide', parts: ['drops'], vector: [0, 1.5] },
  'car-detailing': { effect: 'beat', parts: ['sparkle'], origin: [18.25, 5.25] },
  'car-lift': { effect: 'bounce', parts: ['car'], vector: [0, -1.5] },
  'car-repair': { effect: 'wiggle', parts: ['badge'], origin: [18.25, 16.25] },
  'toll-booth': { effect: 'ring', parts: ['boom'], origin: [12.5, 13] },
  'one-way': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'lane-change': { effect: 'slide', parts: ['arrow'], vector: [1, -1] },
  'lane-guidance': { effect: 'slide', vector: [0, -1.5] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Levels and values ─────────────────────────────────────────────────────────────────────────
// Heat, air and signal step up; the following distance grows bar by bar from the car
icons['steering-wheel-heated'].levels = [[5], [6], [7]];
icons['seat-heater'].levels = [[3], [4], [5]];
icons['seat-ventilation'].levels = [[3, 4], [5, 6], [7, 8]];
icons['adaptive-cruise'].levels = [[4], [5], [6]];
icons['parking-sensor'].levels = [[5], [6]];
icons['blind-spot'].levels = [[5], [6]];
icons['keyless-entry'].levels = [[4], [5]];
icons['speed-camera'].levels = [[3], [4]];
// The cruise needle sweeps its dial
icons['cruise-control'].value = { turn: { parts: ['needle'], origin: [12, 12.5], from: 150, to: 390, at: 315 } };

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// Where the snap leaves a smudge, a drawing with fewer pieces: the vents, spokes, ribs, needles and
// waves go; what is left keeps 1.5 (a pixel) of clearance. (Pixel centers fall on 0.75 + 1.5k.)
{
  const tire = circ(12, 12, 9);
  const rim = circ(12, 12, 4.5);
  icons.wheel.small = { d: [tire, rim, dot(12, 12)], fill: { solid: [tire], cut: [rim, dot(12, 12)] } };
  const [flat, ground] = icons['tire-flat'].d;
  const hub = circ(12, 10.75, 3.75);
  icons['tire-flat'].small = { d: [flat, ground, hub], fill: { solid: [shut(flat)], wire: [ground], cut: [hub] } };
  const [top, body, band] = icons['oil-filter'].d;
  icons['oil-filter'].small = { d: [top, body, band], fill: { solid: [top, shut(body)], cut: [band, 'M4.5 6.75A7.5 3.5 0 0 0 19.5 6.75'] } };
  const [disc, hubD] = icons['brake-disc'].d;
  icons['brake-disc'].small = { d: [disc, hubD], fill: { solid: [disc], cut: [hubD] }, badge: icons['brake-disc'].badge };
  const [housing, d1, d2] = icons['instrument-cluster'].d;
  icons['instrument-cluster'].small = { d: [housing, d1, d2], fill: { solid: [housing], cut: [d1, d2] } };
  // The coolant as two level lines under the thermometer
  icons['coolant-temperature'].small = { d: [hl(14.25, 2.75, 21.25), hl(18.75, 2.75, 21.25)], badge: icons['coolant-temperature'].badge };
}

// ── Mirror and variants ───────────────────────────────────────────────────────────────────────
// Directions you read: the one-way arrow, the lane change, the turn on the head-up display
for (const name of ['one-way', 'lane-change', 'head-up-display']) icons[name].mirror = true;

// A badge sets the variants aside: it is already a status on the drawing
for (const [name, icon] of Object.entries(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };
const offV = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already round: they don't go in another circle
offV(['steering-wheel', 'wheel', 'no-entry', 'self-driving', 'ev-connector-type-1', 'ev-connector-type-2', 'roundabout'], { circle: false });
// Lone arrows and the prohibition sign: a slash says nothing
offV(['lane-guidance', 'lane-change', 'no-entry'], { slash: false });

export default { category: 'conduccion', label: 'Conducción y tránsito vial', icons };
