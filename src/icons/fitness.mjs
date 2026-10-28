// Fitness y entrenamiento (fitness and training): the gym's equipment, the cardio machines, the
// activities and exercises as whole figures, and the numbers of a workout. Everything is computed
// with the engine (engine/geometry.mjs) and the rules in DESIGN.md. Three constructions only:
// - the equipment in profile or front view, on lugares' dumbbell (the family's head, adopted here:
//   its plates, its bar and its proportions);
// - the whole figure is lugares' walking figure, as personas draws it: a round head of r 1.9 standing
//   2.35 clear of the shoulders, a single stroke for the torso and one per limb, rounded at the
//   joints (r 0.6), side view, on a floor line where the pose needs one;
// - the numbers (zones, calories, distance, pace, records) on the set's shapes: the heart, the flame,
//   the stopwatch, the clipboard, the medal.
// Badges are the engine's; a piece that sits in front of another (a sled on its rail, a scoop in
// front of its tub) is a custom badge and the engine clears what lies behind it.
import { arc, badge, circ, dot, f, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import logistica from './logistica.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const rad = (d) => (d * Math.PI) / 180;
/** The point `l` away from `p` at `deg` degrees (0 = right, 90 = down). */
const go = (p, deg, l) => add2(p, [l * Math.cos(rad(deg)), l * Math.sin(rad(deg))]);
const BR = { square: ['br'] };
/** Rotates a point `deg` degrees about `c`. */
const rot2 = (p, c, deg) => add2(c, [(p[0] - c[0]) * Math.cos(rad(deg)) - (p[1] - c[1]) * Math.sin(rad(deg)), (p[0] - c[0]) * Math.sin(rad(deg)) + (p[1] - c[1]) * Math.cos(rad(deg))]);
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);

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
    const r = w / 2;
    return `M${pt([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + r, y])}Z`;
}
/** A capsule along the axis from `a` to `b`, `r` either side of it (a pad seen at an angle). */
function bar(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1] * r, u[0] * r];
  return `M${pt(add2(a, n))}L${pt(add2(b, n))}A${f(r)} ${f(r)} 0 0 0 ${pt(sub(b, n))}L${pt(sub(a, n))}A${f(r)} ${f(r)} 0 0 0 ${pt(add2(a, n))}Z`;
}
/** Ellipse of semi-axes rx, ry at c, as two half arcs. */
const ellipse = ([cx, cy], rx, ry) => `M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx - rx, cy])}Z`;
/** lugares' wave: half waves of length h and amplitude a (cubics whose peak is exactly a), the first one up. */
function wave([x0, y], n, h = 3, a = 1, first = -1) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? -first : first;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
}

const icons = {};
/** Fill specs, named parts and motion collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── The dumbbell (lugares', adopted) ──────────────────────────────────────────────────────────
// Its two plates, the bar between them and the ends past them: the badges' base, and the model for
// the smaller dumbbells (`bell`) in a plan, a rest day and a set of reps.
const DUMBBELL = lugares.icons.dumbbell.d;
/**
 * The dumbbell at scale s, centered at c: [plate, plate, bar, end, end]. At 1 it is lugares' to the
 * hundredth; smaller, its plates keep 2.75 of width (their hole stays open up to weight 2.1) and its
 * ends 2, and without `ends` it drops them (inside a container, where they would crowd the walls).
 */
function bell([cx, cy], s = 1, { ends = true, deg = 0 } = {}) {
  const pw = Math.max(2.75, 3.5 * s);
  const ph = 13 * s;
  const gi = 3.75 * s;
  const end = Math.max(2, 2.25 * s);
  const plate = (x) => sq(x, cy - ph / 2, pw, ph, Math.max(1, 1.5 * s));
  const d = [plate(cx - gi - pw), plate(cx + gi), hl(cy, cx - gi, cx + gi)];
  if (ends) d.push(hl(cy, cx - gi - pw - end, cx - gi - pw), hl(cy, cx + gi + pw, cx + gi + pw + end));
  return deg ? d.map((p) => turnPath(p, deg, [cx, cy])) : d;
}

// The set's heart (edicion's): two lobes of r 4.75 meeting at the top, the point at the bottom.
const HEART = 'M12 20.5L4.03 12A4.75 4.75 0 1 1 12 7.23A4.75 4.75 0 1 1 19.97 12Z';

/** The set's flame (lugares'), as restaurante builds it: a round base of radius r rising to a tilted tip, the logomark's drop inside, 2.4 above the base. */
function setFlame(c, r, tip) {
  const L0 = polar(...c, r, 195);
  const R0 = polar(...c, r, -15);
  const tl = [Math.sin(rad(15)), -Math.cos(rad(15))];
  const tr = [Math.sin(rad(15)), Math.cos(rad(15))];
  const k = r * 0.62;
  const out = `M${pt(L0)}C${pt([L0[0] + tl[0] * k, L0[1] + tl[1] * k])} ${pt([tip[0] - r * 0.42, tip[1] + r * 0.62])} ${pt(tip)}C${pt([tip[0] + r * 0.2, tip[1] + r * 0.5])} ${pt([R0[0] - tr[0] * k, R0[1] - tr[1] * k])} ${pt(R0)}A${f(r)} ${f(r)} 0 1 1 ${pt(L0)}Z`;
  const ri = r * 0.36;
  const ic = [c[0], c[1] + r - ri - 2.4];
  const drop = `M${pt(polar(...ic, ri, -45))}A${f(ri)} ${f(ri)} 0 1 1 ${pt(polar(...ic, ri, -135))}L${pt([ic[0], ic[1] - ri * Math.SQRT2])}Z`;
  return [out, drop];
}

// ── Strength equipment ────────────────────────────────────────────────────────────────────────
{
  // Barbell: the long bar through two plates a side, a tall one inside (the dumbbell's plate, lower)
  // and a thin one outside, the sleeve running out past it.
  const tall = (x) => sq(x, 6, 3, 12, 1.25);
  add('barbell', ['barra olímpica', 'pesas libres', 'fuerza', 'levantamiento', 'barbell', 'free weights', 'strength'], [
    tall(6.25),
    tall(14.75),
    vl(3.25, 8.5, 15.5),
    vl(20.75, 8.5, 15.5),
    hl(12, 9.25, 14.75),
    hl(12, 2, 6.25),
    hl(12, 17.75, 22),
  ]);
  FILL.barbell = { solid: [0, 1], wire: [2, 3, 4, 5, 6] };
  PARTS.barbell = { plates: [0, 1, 2, 3], bar: [4, 5, 6] };
  MOTION.barbell = { effect: 'bounce', vector: [0, -1.5] };
}
{
  // Weight plate, face on: the disc, its sleeve hole, and two grip slots curving near the rim.
  const c = [12, 12];
  add('weight-plate', ['disco de pesas', 'placa', 'carga', 'kilos', 'weight plate', 'bumper plate', 'plate'], [
    circ(...c, 9),
    circ(...c, 2.25),
    ...[-90, 30, 150].map((a) => arc(...c, 6, a - 28, a + 28).d),
  ]);
  FILL['weight-plate'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['weight-plate'] = { plate: [0], hole: [1], grips: [2, 3, 4] };
  MOTION['weight-plate'] = { effect: 'spin', origin: c };
}
// The bench's pads: the seat level, the back raised at 40°, a clearance of paper between them
const SEAT = { a: [14.5, 12], b: [19.25, 12] };
const BACK = { a: [8.5, 12], b: go([8.5, 12], 220, 5.5) };
{
  add('weight-bench', ['banco de pesas', 'banco inclinado', 'press de banca', 'equipo', 'weight bench', 'incline bench', 'gym bench'], [
    bar(SEAT.a, SEAT.b, 1.5),
    bar(BACK.a, BACK.b, 1.5),
    vl(16.75, 13.5, 20.75),
    hl(20.75, 4.75, 20.25),
    line(go(BACK.a, 180 + 40 + 90, 1.5), [10.5, 20.75]),
  ]);
  FILL['weight-bench'] = { solid: [0, 1], wire: [2, 3, 4] };
  PARTS['weight-bench'] = { seat: [0], back: [1], frame: [2, 3, 4] };
}
{
  // Squat rack, front view: two uprights on one base, the bar across them at shoulder height with
  // a plate on each end.
  add('squat-rack', ['rack de sentadillas', 'jaula', 'estación de barra', 'power rack', 'squat rack', 'squat stand'], [
    vl(8.5, 3.25, 20.75),
    vl(15.5, 3.25, 20.75),
    hl(20.75, 4.5, 19.5),
    hl(8.5, 5.5, 18.5),
    sq(2.5, 5.25, 3, 6.5, 1.1),
    sq(18.5, 5.25, 3, 6.5, 1.1),
  ]);
  FILL['squat-rack'] = { solid: [4, 5], wire: [0, 1, 2, 3] };
  PARTS['squat-rack'] = { rack: [0, 1, 2], bar: [3, 4, 5] };
}
{
  // Cable machine: the upright and its arm, the pulley hanging under the arm's end, and the cable
  // dropping from it to a D-handle that hangs free.
  add('cable-machine', ['máquina de poleas', 'polea', 'jalón', 'cruce de poleas', 'cable machine', 'pulley', 'cable crossover'], [
    rl([[5.5, 20.75], [5.5, 3.25], [13.75, 3.25]], [0, 1.5, 0]),
    hl(20.75, 2.75, 8.25),
    circ(13.75, 5.5, 2.25),
    vl(16, 5.5, 15.12),
    roundpoly([[16, 14.5], [19.25, 20.25], [12.75, 20.25]], [0.6, 1, 1]),
  ]);
  FILL['cable-machine'] = { solid: [2, 4], wire: [0, 1, 3] };
  PARTS['cable-machine'] = { frame: [0, 1], pulley: [2], cable: [3], handle: [4] };
  MOTION['cable-machine'] = { effect: 'bounce', vector: [0, -1.5] };
}
{
  // Leg press: the reclined seat at the low end of the base, the rail rising past it at 45° to its
  // post, and the sled riding on the rail, its footplate facing the seat.
  const back = { a: [3.75, 9], b: [5.75, 14.5] };
  const foot = go(back.b, (Math.atan2(5.5, 2) * 180) / Math.PI, 1.5);
  add('leg-press', ['prensa de piernas', 'máquina de piernas', 'tren inferior', 'leg press', 'leg machine', 'sled press'], [
    bar(back.a, back.b, 1.5),
    vl(foot[0], foot[1], 21),
    hl(21, 2.5, 21),
    line([9.5, 21], [13.46, 17.04]),
    line([16.29, 14.21], [20.75, 9.75]),
    vl(20.75, 9.75, 21),
    roundpoly([[12.75, 17.75], [17, 13.5], [14.53, 11.03], [10.28, 15.28]], 1),
  ]);
  FILL['leg-press'] = { solid: [0, 6], wire: [1, 2, 3, 4, 5] };
  PARTS['leg-press'] = { seat: [0, 1], frame: [2, 3, 4, 5], sled: [6] };
  MOTION['leg-press'] = { effect: 'slide', parts: ['sled'], vector: [1.5, -1.5] };
}
{
  // Doorway pull-up bar: the frame's two jambs and its head, the bar across it resting past them.
  add('pull-up-bar', ['barra de dominadas', 'barra de puerta', 'colgarse', 'gimnasio en casa', 'pull-up bar', 'doorway bar', 'chin-up bar'], [
    rl([[7.75, 21.25], [7.75, 2.75], [16.25, 2.75], [16.25, 21.25]], 1.5),
    hl(6.75, 4.75, 19.25),
    capsule(2, 5.25, 2.75, 3),
    capsule(19.25, 5.25, 2.75, 3),
  ]);
  FILL['pull-up-bar'] = { solid: [2, 3], wire: [0, 1] };
  PARTS['pull-up-bar'] = { frame: [0], bar: [1, 2, 3] };
}
{
  // Gymnastic rings: two straps hanging from the top edge, a ring on each.
  add('gym-rings', ['anillas', 'calistenia', 'gimnasia', 'peso corporal', 'gym rings', 'gymnastic rings', 'calisthenics'], [
    vl(7.25, 2.75, 13.25),
    vl(16.75, 2.75, 13.25),
    circ(7.25, 16.5, 3.25),
    circ(16.75, 16.5, 3.25),
  ]);
  FILL['gym-rings'] = false;
  PARTS['gym-rings'] = { straps: [0, 1], rings: [2, 3] };
  MOTION['gym-rings'] = { effect: 'ring', origin: [12, 2.75] };
}
{
  // Plyo box, front view: a little narrower at the top, its oval hand hole near the top.
  add('plyo-box', ['cajón pliométrico', 'saltos al cajón', 'step', 'acondicionamiento', 'plyo box', 'jump box', 'step-up'], [
    roundpoly([[3.5, 20.75], [5.25, 4.25], [18.75, 4.25], [20.5, 20.75]], [1.5, 2.5, 2.5, 1.5]),
    capsule(9, 7.25, 6, 3),
  ]);
  FILL['plyo-box'] = { solid: [0], cut: [1] };
  PARTS['plyo-box'] = { box: [0], hole: [1] };
}
{
  // Battle ropes: two ropes in waves from the anchor post at the left, ending in their grips.
  add('battle-ropes', ['cuerdas de batalla', 'cuerdas', 'ondas', 'hiit', 'battle ropes', 'rope waves', 'conditioning'], [
    sq(2.75, 6, 3, 12, 1.5),
    wave([5.75, 9], 4, 3, 1),
    wave([5.75, 15], 4, 3, 1),
    hl(9, 17.75, 21.25),
    hl(15, 17.75, 21.25),
  ]);
  FILL['battle-ropes'] = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS['battle-ropes'] = { anchor: [0], wave: [1, 2], grips: [3, 4] };
}
{
  // Resistance band: two D-handles, their grips upright, joined by the band in a shallow arc.
  const sag = (y) => `M5 ${f(y)}Q12 ${f(y + 4)} 19 ${f(y)}`;
  const [b0, b1] = [9.25, 12.75];
  add('resistance-band', ['banda elástica', 'liga de resistencia', 'ejercicio en casa', 'rehabilitación', 'resistance band', 'exercise band', 'tube band'], [
    capsule(2, 6.5, 3, 11),
    capsule(19, 6.5, 3, 11),
    sag(b0),
    sag(b1),
  ]);
  FILL['resistance-band'] = { solid: [0, 1, shut(`${sag(b0)}L19 ${f(b1)}Q12 ${f(b1 + 4)} 5 ${f(b1)}`)] };
  PARTS['resistance-band'] = { handles: [0, 1], band: [2, 3] };
}
{
  // Jump rope: two upright handles, the rope dropping from them into one wide loop.
  add('jump-rope', ['cuerda para saltar', 'saltar la cuerda', 'cardio', 'comba', 'jump rope', 'skipping rope', 'skipping'], [
    capsule(4.5, 2.75, 3, 7),
    capsule(16.5, 2.75, 3, 7),
    'M6 9.75C2.75 14.75 3.25 20.75 12 20.75S21.25 14.75 18 9.75',
  ]);
  FILL['jump-rope'] = { solid: [0, 1], wire: [2] };
  PARTS['jump-rope'] = { handles: [0, 1], rope: [2] };
}
{
  // Stability ball: a large ball resting on the floor line, a highlight curving inside its rim.
  add('exercise-ball', ['pelota de ejercicio', 'fitball', 'pelota suiza', 'equilibrio', 'exercise ball', 'stability ball', 'swiss ball'], [
    circ(12, 11.75, 8.75),
    hl(20.5, 2.25, 21.75),
    arc(12, 11.75, 5.75, 195, 255).d,
  ]);
  FILL['exercise-ball'] = { solid: [0], wire: [1], cut: [2] };
  PARTS['exercise-ball'] = { ball: [0, 2], floor: [1] };
  MOTION['exercise-ball'] = { effect: 'bounce', vector: [0, -2] };
}
{
  // Ab wheel, front view: the thick wheel and its tread, the axle out of both sides to the grips.
  add('ab-wheel', ['rueda abdominal', 'rodillo abdominal', 'core', 'abdomen', 'ab wheel', 'ab roller', 'rollout'], [
    sq(8.75, 3.5, 6.5, 17, 3.25),
    vl(12, 6.75, 17.25),
    capsule(1.75, 10.5, 4, 3),
    capsule(18.25, 10.5, 4, 3),
    hl(12, 5.75, 8.75),
    hl(12, 15.25, 18.25),
  ]);
  FILL['ab-wheel'] = { solid: [0, 2, 3], cut: [1], wire: [4, 5] };
  PARTS['ab-wheel'] = { wheel: [0, 1], handle: [2, 3, 4, 5] };
}
{
  // Foam roller, three-quarter view: its end facing out, the body with two ridges ringing it.
  const [y0, y1] = [5.5, 18.5];
  const ry = (y1 - y0) / 2;
  const ring = (x) => `M${pt([x, y0])}A2.75 ${f(ry)} 0 0 1 ${pt([x, y1])}`;
  add('foam-roller', ['rodillo de espuma', 'recuperación', 'liberación miofascial', 'movilidad', 'foam roller', 'recovery', 'myofascial release'], [
    ellipse([6.25, 12], 2.75, ry),
    `M6.25 ${f(y0)}H17.5A2.75 ${f(ry)} 0 0 1 17.5 ${f(y1)}H6.25`,
    ring(10.25),
    ring(13.75),
  ]);
  // Filled, the end face keeps its edge: the near half of its rim is cut out with the ridges
  FILL['foam-roller'] = { solid: [0, shut(`M6.25 ${f(y0)}H17.5A2.75 ${f(ry)} 0 0 1 17.5 ${f(y1)}H6.25`)], cut: [ring(6.25), 2, 3] };
  PARTS['foam-roller'] = { end: [0], body: [1], ridges: [2, 3] };
}
{
  // Massage gun: the barrel, its round head on a short neck at the front, the grip below.
  add('massage-gun', ['pistola de masaje', 'masajeador', 'recuperación', 'dolor muscular', 'massage gun', 'percussion massager', 'recovery'], [
    capsule(2.75, 5, 11.5, 5.5),
    hl(7.75, 14.25, 16.75),
    circ(19.25, 7.75, 2.5),
    rl([[6.5, 10.5], [7.25, 20.75], [11.5, 20.75], [11, 10.5]], [0, 1.5, 1.5, 0]),
  ]);
  FILL['massage-gun'] = { solid: [0, 2, shut(rl([[6.5, 10.5], [7.25, 20.75], [11.5, 20.75], [11, 10.5]], [0, 1.5, 1.5, 0]))], wire: [1] };
  PARTS['massage-gun'] = { body: [0, 3], head: [1, 2] };
  MOTION['massage-gun'] = { effect: 'wiggle', origin: [9, 15] };
}
{
  // Heavy bag: a tall bag on one chain from its ceiling mount, swung a little as if just hit, its top
  // band. Straight and on a ring with two chains it read as a baby bottle; straight on one chain, as a
  // pump bottle: the swing is what says it hangs.
  const o = [12, 2.75];
  const swing = (d) => turnPath(d, -12, o);
  add('punching-bag', ['saco de boxeo', 'costal', 'boxeo', 'golpear', 'punching bag', 'heavy bag', 'boxing'], [
    swing(sq(7.75, 6.75, 8.5, 14.25, 3)),
    hl(2.75, 7.5, 16.5),
    swing(vl(12, 2.75, 6.75)),
    swing(hl(10.75, 7.75, 16.25)),
  ]);
  FILL['punching-bag'] = { solid: [0], wire: [1, 2], cut: [3] };
  PARTS['punching-bag'] = { bag: [0, 3], mount: [1], chain: [2] };
  MOTION['punching-bag'] = { effect: 'ring', parts: ['bag', 'chain'], origin: o };
}
{
  // Boxing glove in profile: the rounded fist, the thumb along its front, the cuff at the wrist.
  add('boxing-glove', ['guante de boxeo', 'boxeo', 'kickboxing', 'combate', 'boxing glove', 'boxing', 'kickboxing'], [
    'M7.75 21.25V17.25C5.75 16 4.75 14 4.75 11.25C4.75 6 8 2.75 12.5 2.75C16.75 2.75 19.5 5.75 19.5 10.25C19.5 13.25 18.5 15.75 16.75 17.25V21.25Z',
    hl(17.25, 7.75, 16.75),
    'M4.9 9.5C7.5 9 9.75 10 9.75 12.5V17.25',
  ]);
  FILL['boxing-glove'] = { solid: [0], cut: [1, 2] };
  PARTS['boxing-glove'] = { glove: [0, 2], cuff: [1] };
  MOTION['boxing-glove'] = { effect: 'slide', vector: [0, -2] };
}
// ── Cardio machines ───────────────────────────────────────────────────────────────────────────
// In profile, the user facing right: the front of each machine (its console, its flywheel) at the
// right.
{
  // Treadmill: the deck rising a little toward the front, the upright from its front end to the
  // console, and the handrail reaching back from it.
  const deck = bar([3.75, 19.25], [17, 17.25], 1.5);
  const front = go([17, 17.25], (Math.atan2(-2, 13.25) * 180) / Math.PI, 1.5);
  add('treadmill', ['caminadora', 'cinta de correr', 'correr bajo techo', 'cardio', 'treadmill', 'running machine', 'indoor run'], [
    deck,
    line(front, [16.5, 6.5]),
    sq(14.25, 3, 7, 3.5, 1.25),
    hl(10, 10.5, 16.5 + ((10 - 6.5) / (front[1] - 6.5)) * (front[0] - 16.5)),
  ]);
  FILL.treadmill = { solid: [0, 2], wire: [1, 3] };
  PARTS.treadmill = { deck: [0], frame: [1, 3], console: [2] };
}
{
  // Stationary bike: lugares' bicycle raised on a stand, its rear wheel swapped for two legs on the
  // base and its front wheel the flywheel, on a post.
  const [A, F, B, S, H] = [[5.75, 12.25], [18.25, 12.25], [11.5, 12.25], [9, 6.25], [15, 6.25]];
  add('exercise-bike', ['bicicleta fija', 'spinning', 'ciclismo bajo techo', 'cardio', 'exercise bike', 'stationary bike', 'spin bike'], [
    circ(...F, 3.25),
    roundpoly([A, B, H, S], [0, 0.6, 0, 0]),
    line(H, F),
    line(S, [8.4, 3.25]),
    line([7, 3.25], [10, 3.25]),
    rl([H, [14.25, 3.25], [16.75, 3.25]], [0, 0.6, 0]),
    line([3.5, 20.75], A, [8, 20.75]),
    hl(20.75, 2.5, 21.5),
    vl(18.25, 15.5, 20.75),
  ]);
  FILL['exercise-bike'] = false;
  PARTS['exercise-bike'] = { flywheel: [0], frame: [1, 2], seat: [3, 4], handlebar: [5], stand: [6, 7, 8] };
  MOTION['exercise-bike'] = { effect: 'spin', parts: ['flywheel'], origin: F };
}
{
  // Rowing machine: the long low rail rising to the flywheel at the front, raised on its leg, the
  // sliding seat riding on the rail and the handle on its cord.
  const fc = [18, 12.75];
  const fr = 3.25;
  const r0 = [2.75, 19.75];
  const ru = unit([13.25, -3.75]);
  const rn = [ru[1], -ru[0]];
  // The rail meets the flywheel's rim
  const tHit = (() => {
    const w = sub(r0, fc);
    const b = w[0] * ru[0] + w[1] * ru[1];
    return -b - Math.sqrt(b * b - (w[0] ** 2 + w[1] ** 2 - fr * fr));
  })();
  const onRail = (t, off = 0) => add2(add2(r0, mul(ru, t)), mul(rn, off));
  const cordY = 12.25;
  add('rowing-machine', ['máquina de remo', 'remo bajo techo', 'remadora', 'cardio', 'rowing machine', 'rower', 'indoor rowing'], [
    line(r0, onRail(tHit)),
    circ(...fc, fr),
    line(polar(...fc, fr, 55), [20.5, 20.75]),
    bar(onRail(2.75, 1.25), onRail(5.75, 1.25), 1.25),
    hl(cordY, 11.75, fc[0] - Math.sqrt(fr * fr - (cordY - fc[1]) ** 2)),
    vl(11.75, 10.5, 14),
  ]);
  FILL['rowing-machine'] = { solid: [1, 3], wire: [0, 2, 4, 5] };
  PARTS['rowing-machine'] = { rail: [0, 2], flywheel: [1], seat: [3], handle: [4, 5] };
  MOTION['rowing-machine'] = { effect: 'slide', parts: ['seat'], vector: [2, -0.55] };
}
{
  // Elliptical: the flywheel at the back on the base, the handle arm rising at the front, and the
  // pedal arm running between them.
  add('elliptical', ['elíptica', 'bicicleta elíptica', 'bajo impacto', 'cardio', 'elliptical', 'cross trainer', 'low impact'], [
    hl(20.75, 2.5, 21.5),
    circ(6, 17.5, 3.25),
    line([19, 20.75], [15.25, 3.25]),
    bar([7.5, 13], [16.25, 11.25], 1.25),
    hl(3.25, 12.75, 15.25),
  ]);
  FILL.elliptical = { solid: [1, 3], wire: [0, 2, 4] };
  PARTS.elliptical = { base: [0], flywheel: [1], handle: [2, 4], pedal: [3] };
}
{
  // Stair climber: three steps rising in their housing, the post and the handrail at its front.
  add('stair-climber', ['escaladora', 'máquina de escaleras', 'subir escalones', 'cardio', 'stair climber', 'stair machine', 'stepmill'], [
    rl([[3.25, 20.75], [3.25, 17.25], [7, 17.25], [7, 13.5], [10.75, 13.5], [10.75, 9.75], [14.5, 9.75], [14.5, 20.75]], [0, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0]),
    hl(20.75, 2.5, 21),
    vl(18, 4, 20.75),
    rl([[12.25, 6.5], [18, 4]], 0),
  ]);
  FILL['stair-climber'] = { solid: [shut(rl([[3.25, 20.75], [3.25, 17.25], [7, 17.25], [7, 13.5], [10.75, 13.5], [10.75, 9.75], [14.5, 9.75], [14.5, 20.75]], [0, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0]))], wire: [1, 2, 3] };
  PARTS['stair-climber'] = { steps: [0], frame: [1, 2, 3] };
}

// ── Gear and accessories ──────────────────────────────────────────────────────────────────────
{
  // Chest heart-rate monitor: the strap as a loop round the chest and the sensor pod at its front, a
  // heart on it (on top: the engine clears the strap behind it).
  const pod = capsule(6.5, 11.75, 11, 6.5);
  const heart = transform(HEART, 0.3, 12 - 12 * 0.3, 15 - 13.6 * 0.3);
  add('heart-rate-strap', ['banda de frecuencia cardiaca', 'sensor de pulso', 'monitor de pecho', 'emparejar sensor', 'heart rate strap', 'chest strap', 'hr monitor'], [
    ellipse([12, 10.5], 9.25, 5.25),
  ], { badge: { d: [pod, heart], knock: pod, fill: { solid: [pod], cut: [heart] } } });
  FILL['heart-rate-strap'] = false;
  PARTS['heart-rate-strap'] = { strap: [0] };
}
{
  // Swim goggles: two oval lenses joined by the nose bridge, the strap arcing behind them.
  add('swim-goggles', ['goggles', 'lentes de natación', 'gafas de natación', 'alberca', 'swim goggles', 'swimming goggles', 'pool'], [
    ellipse([6.6, 14.5], 3.85, 3.25),
    ellipse([17.4, 14.5], 3.85, 3.25),
    'M10.45 14.5Q12 12.5 13.55 14.5',
    'M2.75 14.5C2.75 7.25 7 4.75 12 4.75S21.25 7.25 21.25 14.5',
  ]);
  FILL['swim-goggles'] = { solid: [0, 1], wire: [2], lines: [3] };
  PARTS['swim-goggles'] = { lenses: [0, 1, 2], strap: [3] };
}
{
  // Protein powder: the tub and its lid band, the scoop resting in front of it (on top: the engine
  // clears the tub behind it).
  const bowl = 'M14 15.5H20.5A3.25 3.25 0 0 1 14 15.5Z';
  const handle = line([20.5, 15.5], [21.75, 11.25]);
  add('protein-powder', ['proteína en polvo', 'suplemento', 'bote', 'nutrición deportiva', 'protein powder', 'supplement', 'whey'], [
    rl([[4, 7], [4, 21.25], [16, 21.25], [16, 7]], [0, 2.5, 0, 0]),
    sq(3, 3, 14, 4, 1.25),
  ], { badge: { d: [bowl, handle], knock: `${bowl}M20.5 15.5L21.75 11.25Z`, fill: { solid: [bowl], wire: [handle] } } });
  FILL['protein-powder'] = { solid: [shut(rl([[4, 7], [4, 21.25], [16, 21.25], [16, 7]], [0, 2.5, 0, 0])), 1] };
  PARTS['protein-powder'] = { tub: [0], lid: [1] };
}

// ── The whole figure ──────────────────────────────────────────────────────────────────────────
// lugares' walking figure as personas draws it: the head a circle of r 1.9 standing 2.35 clear of
// the shoulders (so the two never merge up to weight 2.1), the torso one stroke from the shoulders to
// the hips (5.5), each limb one stroke rounded at its joint (thigh and shin about 4, upper arm 3.5,
// forearm 3). In profile it faces right. A figure lying on something keeps 3 clear of it, as
// personas' lie on their beds; feet, hands and knees that bear the weight touch their floor.
const HR = 1.9;
const GAP = 2.35;
/** The head's center, `hr + gap` from the shoulders at `deg` degrees (0 = right, -90 = up). */
const headAt = (S, deg, hr = HR, gap = GAP) => go(S, deg, hr + gap);
/** A limb from `start` as [length, degrees] segments: its joints, start included. */
const chain = (start, segs, k = 1) => segs.reduce((pts, [l, a]) => [...pts, go(pts[pts.length - 1], a, l * k)], [start]);
/**
 * A figure from its joints: [head, torso, ...legs, ...arms]; legs and arms are polylines. The legs
 * meet at the hip and the arms at the shoulders unrounded, exactly where the torso ends (personas').
 */
function figure({ H, hr = HR, S, P, legs, arms, jr = 0.6 }) {
  const sharp = (pts, at) => rl(pts, pts.map((p) => (p[0] === at[0] && p[1] === at[1] ? 0 : jr)));
  return [circ(...H, hr), line(S, P), ...legs.map((l) => sharp(l, P)), ...arms.map((a) => sharp(a, S))];
}
/** A pose from the hip: the torso's [length, degrees], the head's direction, and each limb's segments. */
function pose({ P, torso, head: ha = torso[1], legs = [], arms = [], k = 1, hr = HR * k, gap = GAP }) {
  const S = go(P, torso[1], torso[0] * k);
  return { P, S, H: headAt(S, ha, hr, gap), hr, legs: legs.map((l) => chain(P, l, k)), arms: arms.map((a) => chain(S, a, k)) };
}
/** Fill and parts of a figure: the head filled, the limbs lines attached to it (lugares' walking). */
const figFill = (n, extra = {}) => ({ solid: [0], wire: Array.from({ length: n - 1 }, (_, i) => i + 1), ...extra });
const figParts = (nLegs, nArms, extra = {}) => ({
  head: [0],
  body: [1],
  ...(nLegs && { legs: Array.from({ length: nLegs }, (_, i) => 2 + i) }),
  ...(nArms && { arms: Array.from({ length: nArms }, (_, i) => 2 + nLegs + i) }),
  ...extra,
});
const FIGURE = ['head', 'body', 'legs', 'arms'];

// ── Activities ────────────────────────────────────────────────────────────────────────────────
// Running: leaning into a long stride, the back foot kicked up behind, the elbows bent and pumping.
const RUN = {
  P: [11, 13.75],
  torso: [5.5, -72],
  legs: [
    [[4, 35], [4.25, 100]],
    [[4, 115], [4, 200]],
  ],
  arms: [
    [[3.5, 60], [3, -40]],
    [[3.5, 145], [3, 215]],
  ],
};
{
  const d = figure(pose(RUN));
  add('running', ['correr', 'carrera', 'trotar', 'running', 'run', 'jogging'], d);
  FILL.running = figFill(d.length);
  PARTS.running = figParts(2, 2);
  MOTION.running = { effect: 'slide', vector: [1.5, 0] };
}
{
  // Trail running: the runner, a little smaller, on the trail where it turns up a hill ahead of it. On
  // a straight slope under both feet it read as a snowboarder.
  const k = 0.85;
  const fig = pose({ ...RUN, P: [8.25, 12.75], k });
  const foot = fig.legs[0][2];
  // The foot lands on the flat, 3.25 short of where the trail turns up (at the turn, the shin and the
  // two stretches of ground closed up into slivers at weight 2.1)
  const d = [...figure(fig), rl([[2.5, foot[1]], [foot[0] + 3.25, foot[1]], [18.25, 11.75], [21.5, 15]], [0, 1, 1.25, 0])];
  add('trail-running', ['trail running', 'correr en montaña', 'sendero', 'campo traviesa', 'trail run', 'off-road running'], d);
  FILL['trail-running'] = figFill(d.length);
  PARTS['trail-running'] = figParts(2, 2, { ground: [6] });
}
// The bicycle (lugares'), 0.9 of its size, its wheels on 20.75 and its saddle raised 0.15 so it
// keeps 2.85 from the top tube. Like the bicycle, the rider on it takes no fill: its filled version
// is the outline (a solid head alone changed how the small gaps at the hubs hold across weights)
const BIKE = (() => {
  const T = (p) => [12 + (p[0] - 12) * 0.9, 20.75 + (p[1] + 2.5 - 20.75) * 0.9];
  const [A, F, B, S, H] = [[5.75, 15], [18.25, 15], [11.5, 15], [9, 9], [15, 9]].map(T);
  const R = 3.25 * 0.9;
  const up = (p) => [p[0], p[1] - 0.15];
  return {
    A, F, R,
    saddle: up(T([8.5, 6])),
    stem: T([14.25, 6]),
    bar: T([16.75, 6]),
    d: [
      circ(...A, R),
      circ(...F, R),
      roundpoly([A, B, H, S], [0.4, 0.6, 0, 0]),
      line(H, F),
      line(S, up(T([8.4, 6]))),
      line(up(T([7, 6])), up(T([10, 6]))),
      rl([H, T([14.25, 6]), T([16.75, 6])], [0, 0.6, 0]),
    ],
  };
})();
// The rider bent over it: the hips on the saddle, the back reaching forward over the top tube, the
// arm down to the handlebar's end, the head up ahead of the shoulders, square to the arm
function rider() {
  const P = BIKE.saddle;
  const S = go(P, -32, 5.5);
  const arm = sub(BIKE.bar, S);
  const a = (Math.atan2(arm[1], arm[0]) * 180) / Math.PI;
  return figure({ P, S, H: headAt(S, a - 90), legs: [], arms: [[S, BIKE.bar]] });
}
{
  const d = [...rider(), ...BIKE.d];
  add('cycling', ['ciclismo', 'bicicleta', 'rodada', 'pedalear', 'cycling', 'ride', 'bike ride'], d);
  FILL.cycling = false;
  PARTS.cycling = { head: [0], body: [1], arms: [2], wheels: [3, 4], frame: [5, 6, 7, 8, 9] };
  MOTION.cycling = { effect: 'slide', vector: [1.5, 0] };
}
{
  // Mountain biking: the rider and the bicycle tilted 12° down a slope tangent to both wheels.
  const deg = 12;
  const c = [12, 13.5];
  const [A, F] = [BIKE.A, BIKE.F].map((p) => rot2(p, c, deg));
  const along = unit(sub(F, A));
  const n = [-along[1], along[0]];
  const g0 = add2(A, mul(n, BIKE.R));
  const ground = (x) => add2(g0, mul(along, (x - g0[0]) / along[0]));
  const dy = 21.7 - ground(21.75)[1];
  const tilt = (d) => transform(turnPath(d, deg, c), 1, 0, dy);
  const d = [...[...rider(), ...BIKE.d].map(tilt), transform(line(ground(2.25), ground(21.75)), 1, 0, dy)];
  add('mountain-biking', ['ciclismo de montaña', 'bici de montaña', 'descenso', 'mtb', 'mountain biking', 'mountain bike', 'downhill'], d);
  FILL['mountain-biking'] = false;
  PARTS['mountain-biking'] = { head: [0], body: [1], arms: [2], wheels: [3, 4], frame: [5, 6, 7, 8, 9], ground: [10] };
}
{
  // Swimming, freestyle: the head at the surface (on top: the engine clears the water behind it),
  // one arm reaching over it out of the water, two waves.
  const head = circ(9.75, 13.75, HR);
  const d = [wave([2.25, 14.5], 6, 3.25, 0.75, -1), wave([2.25, 18.5], 6, 3.25, 0.75, -1), rl([[4.5, 14.5], [8, 7.75], [16.5, 9.5]], [0, 0.6, 0])];
  add('swimming', ['natación', 'nadar', 'alberca', 'estilo libre', 'swimming', 'swim', 'freestyle'], d, { badge: { d: [head], knock: head, fill: { solid: [head] } } });
  FILL.swimming = false;
  PARTS.swimming = { water: [0, 1], arm: [2] };
}
{
  // Hiking: walking's stride (personas'), the head looking ahead, a small pack on the upper back
  // (its front edge on the torso) and the stick planted ahead, the hand on it.
  const S = [12.6, 8.5];
  const P = [11, 14];
  const u = unit(sub(S, P));
  const back = [u[1], -u[0]];
  const pr = 1.4;
  const pack = bar(add2(add2(P, mul(u, 3.25)), mul(back, pr)), add2(add2(P, mul(u, 4)), mul(back, pr)), pr);
  const stick = [[16.75, 9.5], [19.25, 21.25]];
  const hand = [16.75 + ((12.25 - 9.5) / 11.75) * 2.5, 12.25];
  const d = [
    ...figure({ H: headAt(S, -70), S, P, legs: [[P, [8.5, 17.25], [7.25, 21.25]], [P, [13.75, 16.5], [14.5, 21.25]]], arms: [[S, [14.75, 11.5], hand]] }),
    pack,
    line(...stick),
  ];
  add('hiking', ['senderismo', 'caminata', 'excursión', 'montaña', 'hiking', 'hike', 'trekking'], d);
  FILL.hiking = { solid: [0, 5], wire: [1, 2, 3, 4, 6] };
  PARTS.hiking = { ...figParts(2, 1), pack: [5], stick: [6] };
  MOTION.hiking = { effect: 'slide', vector: [1.25, 0] };
}

{
  // Dancing, front view: one arm thrown up, the other out, the hips tilted and one leg kicked to the side.
  const fig = pose({
    P: [11, 13.75],
    torso: [5.5, -100],
    head: -110,
    legs: [
      [[4, 97], [3.75, 92]],
      [[4, 20], [4, 5]],
    ],
    arms: [
      [[3.5, -32], [3, -62]],
      [[3.5, 168], [3, 205]],
    ],
  });
  const d = figure(fig);
  add('dancing', ['baile', 'bailar', 'danza', 'clase de baile', 'dancing', 'dance', 'zumba'], d);
  FILL.dancing = figFill(d.length);
  PARTS.dancing = figParts(2, 2);
  MOTION.dancing = { effect: 'wiggle', origin: [11, 21] };
}
{
  // Weightlifting, front view: the feet apart and the barbell pressed overhead, the elbows out.
  const k = 0.85;
  const cx = 12;
  const P = [cx, 21.25 - 4.75 * k];
  const S = [cx, P[1] - 5.25 * k];
  const H = [cx, S[1] - (HR * k + GAP)];
  const barY = H[1] - HR * k - 2.85;
  const hand = (m) => [cx + m * 4.25, barY];
  const elbow = (m) => [cx + m * 4.75, S[1] - 1.25];
  const plate = (x) => sq(x, barY - 2.5, 2.5, 5, 1);
  const d = [
    ...figure({ H, hr: HR * k, S, P, legs: [[[cx - 3.25 * k, 21.25], P, [cx + 3.25 * k, 21.25]]], arms: [[hand(-1), elbow(-1), S, elbow(1), hand(1)]] }),
    hl(barY, 4.5, 19.5),
    plate(2),
    plate(19.5),
  ];
  add('weightlifting', ['levantamiento de pesas', 'fuerza', 'press', 'halterofilia', 'weightlifting', 'strength training', 'overhead press'], d);
  FILL.weightlifting = { solid: [0, 5, 6], wire: [1, 2, 3, 4] };
  PARTS.weightlifting = { ...figParts(1, 1), barbell: [4, 5, 6] };
  MOTION.weightlifting = { effect: 'bounce', parts: ['arms', 'barbell'], vector: [0, -1.25] };
}
{
  // Pilates, the hundred: lying with the legs together raised at 45°, the head and shoulders curled
  // up and the arms reaching forward, over a floor line.
  const fig = pose({ P: [12.5, 16.5], torso: [5.5, 200], head: 235, legs: [[[8.5, -45]]], arms: [[[5, -20]]] });
  const d = [...figure(fig), hl(19.75, 2.75, 21.25)];
  add('pilates', ['pilates', 'core', 'abdomen', 'el cien', 'pilates', 'core workout', 'mat class'], d);
  FILL.pilates = figFill(d.length);
  PARTS.pilates = figParts(1, 1, { floor: [4] });
}
{
  // Push-up: high on straight arms, the body one straight line from the head to the feet; the hands
  // and the toes mark the floor.
  const F = [2.75, 18.75];
  const P = go(F, -26, 8.5);
  const S = go(P, -26, 5.75);
  const d = figure({ H: headAt(S, -32), S, P, legs: [[P, F]], arms: [[S, [S[0] + 0.25, 18.75]]] });
  add('push-up', ['lagartija', 'flexión', 'plancha alta', 'peso corporal', 'push-up', 'press-up', 'bodyweight'], d);
  FILL['push-up'] = figFill(d.length);
  PARTS['push-up'] = figParts(1, 1);
  MOTION['push-up'] = { effect: 'bounce', parts: ['head', 'body', 'legs'], vector: [0, 1] };
}
{
  // Squat: the hips back and the thighs level, the knees over the feet, the arms reaching forward.
  const F = [12, 21.25];
  const K = [12.75, 17.25];
  const P = [8.75, 17.25];
  const S = go(P, -55, 5.5);
  const d = figure({ H: headAt(S, -80), S, P, legs: [[P, K, F]], arms: [[S, go(S, 10, 6.5)]] });
  add('squat', ['sentadilla', 'pierna', 'tren inferior', 'series', 'squat', 'squats', 'leg day'], d);
  FILL.squat = figFill(d.length);
  PARTS.squat = figParts(1, 1);
  MOTION.squat = { effect: 'bounce', parts: ['head', 'body', 'arms'], vector: [0, 1.5] };
}
{
  // Lunge: upright, the front foot forward and both knees bent square, the back knee near the floor,
  // the arms forward for balance.
  const P = [11.25, 15.5];
  const S = [11.25, 10];
  const d = figure({
    H: headAt(S, -90),
    S,
    P,
    legs: [
      [P, [15.25, 15.5], [15.25, 19.75]],
      [P, [10.5, 19], [6.5, 20.25]],
    ],
    arms: [[S, go(S, 20, 6)]],
  });
  add('lunge', ['zancada', 'desplante', 'pierna', 'tren inferior', 'lunge', 'lunges', 'split squat'], d);
  FILL.lunge = figFill(d.length);
  PARTS.lunge = figParts(2, 1);
}
{
  // Sit-up: lying with the knees bent up, the shoulders curled up off the floor and the arms reaching
  // toward the knees, over a floor line (the hands behind the head closed up into a knot in profile).
  const P = [12.5, 18.5];
  const S = go(P, 205, 5.5);
  const K = go(P, -55, 4.5);
  const d = [
    ...figure({ H: headAt(S, 215), S, P, legs: [[P, K, [18.5, 18.5]]], arms: [[S, go(S, -20, 4.25)]] }),
    hl(21.5, 2.75, 21.25),
  ];
  add('sit-up', ['abdominal', 'crunch', 'abdomen', 'core', 'sit-up', 'crunch', 'abs'], d);
  FILL['sit-up'] = figFill(d.length);
  PARTS['sit-up'] = figParts(1, 1, { floor: [4] });
  MOTION['sit-up'] = { effect: 'wiggle', parts: ['head', 'body', 'arms'], origin: P };
}
{
  // Glute bridge: the shoulders down, the feet planted, the hips lifted into one straight ramp from
  // the shoulders to the knees, over a floor line. No arm meets the shoulders, so the head stands the
  // full 2.85 clear of them (personas' lying figure).
  const S = [8.5, 16.5];
  const P = go(S, -25, 5.5);
  const K = go(P, -25, 4);
  const d = [...figure({ H: headAt(S, 200, HR, 2.9), S, P, legs: [[P, K, [K[0] + 0.75, 16.5]]], arms: [] }), hl(19.75, 2.25, 21.75)];
  add('glute-bridge', ['puente de glúteo', 'glúteos', 'cadera', 'puente', 'glute bridge', 'hip bridge', 'hip thrust'], d);
  FILL['glute-bridge'] = figFill(d.length);
  PARTS['glute-bridge'] = { ...figParts(1, 0), floor: [3] };
  MOTION['glute-bridge'] = { effect: 'bounce', parts: ['body', 'legs'], vector: [0, -1] };
}
{
  // Jumping jack, front view: an X off the ground, the arms raised and spread, the legs apart, a
  // floor line below.
  const k = 0.85;
  const cx = 12;
  const P = [cx, 12.5];
  const S = [cx, P[1] - 5.25 * k];
  const H = [cx, S[1] - (HR * k + GAP)];
  const E = (m) => go(S, m > 0 ? -2 : 182, 3.75 * k);
  const Wr = (m) => go(E(m), m > 0 ? -42 : 222, 3.5 * k);
  const foot = (m) => go(P, m > 0 ? 58 : 122, 7.25 * k);
  const d = [
    ...figure({ H, hr: HR * k, S, P, legs: [[foot(-1), P, foot(1)]], arms: [[Wr(-1), E(-1), S, E(1), Wr(1)]] }),
    hl(21.25, 6.75, 17.25),
  ];
  add('jumping-jack', ['jumping jack', 'saltos de tijera', 'calentamiento', 'cardio', 'jumping jacks', 'star jump', 'warm-up'], d);
  FILL['jumping-jack'] = figFill(d.length);
  PARTS['jumping-jack'] = figParts(1, 1, { floor: [4] });
  MOTION['jumping-jack'] = { effect: 'bounce', parts: FIGURE, vector: [0, -1.5] };
}

{
  // Pull-up, front view: hanging under the bar by both hands, the elbows bent out, the legs hanging
  // together. With the chin over the bar, the bar across the head read as a yoke on the shoulders.
  const cx = 12;
  const barY = 3;
  // The head stands 2.85 under the bar, the shoulders 2.35 under the head (the set's figure)
  const H = [cx, barY + 2.85 + HR];
  const S = [cx, H[1] + HR + GAP];
  const P = [cx, S[1] + 5.25];
  const d = [
    hl(barY, 2.5, 21.5),
    ...figure({ H, S, P, legs: [[[cx - 1.5, 21.25], P, [cx + 1.5, 21.25]]], arms: [[[cx - 5.25, barY], [cx - 6.5, S[1] - 1.25], S, [cx + 6.5, S[1] - 1.25], [cx + 5.25, barY]]] }),
  ];
  add('pull-up', ['dominada', 'barra', 'espalda', 'peso corporal', 'pull-up', 'chin-up', 'bodyweight'], d);
  FILL['pull-up'] = { solid: [1], wire: [0, 2, 3, 4] };
  PARTS['pull-up'] = { bar: [0], head: [1], body: [2], legs: [3], arms: [4] };
}
{
  // Deadlift, front view: standing tall at the top of the lift, the arms straight down to the barbell
  // across the hips, a plate at each end. In profile the bar is seen end on, and a plate beside the
  // hinged figure read as a wheelchair.
  const cx = 12;
  const barY = 14.5;
  const S = [cx, 9];
  const P = [cx, barY];
  const plate = (x) => sq(x, barY - 4.25, 3, 8.5, 1.25);
  const d = [
    ...figure({ H: [cx, S[1] - HR - GAP], S, P, legs: [[[cx - 2.75, 21.25], P, [cx + 2.75, 21.25]]], arms: [[[cx - 4.5, barY], S, [cx + 4.5, barY]]] }),
    hl(barY, 5.5, 18.5),
    plate(2.5),
    plate(18.5),
  ];
  add('deadlift', ['peso muerto', 'bisagra de cadera', 'fuerza', 'espalda baja', 'deadlift', 'hip hinge', 'strength'], d);
  FILL.deadlift = { solid: [0, 5, 6], wire: [1, 2, 3, 4] };
  PARTS.deadlift = { ...figParts(1, 1), barbell: [4, 5, 6] };
}
{
  // Bench press: lying on the bench, the head past its end and the feet down past the other, the arm
  // straight up to the barbell, drawn side on over the body (end on, its plate read as a lollipop).
  // The figure keeps 3 clear of the bench, as personas' lie on their beds, and its head 2.85 clear of
  // the plate over it.
  const y = 12.5;
  const S = [8.5, y];
  const P = [14, y];
  const barY = 5;
  const plate = (x) => sq(x, barY - 2.75, 2.75, 5.5, 1);
  const d = [
    ...figure({ H: [S[0] - HR - GAP, y], S, P, legs: [[P, [17.75, 14.25], [17.75, 21.25]]], arms: [[S, [S[0], barY]]] }),
    capsule(7.25, y + 3, 7.5, 2.5),
    vl(11, y + 5.5, 21.25),
    hl(21.25, 8, 14),
    hl(barY, 5.25, 18.75),
    plate(2.5),
    plate(18.75),
  ];
  add('bench-press', ['press de banca', 'pecho', 'banco plano', 'fuerza', 'bench press', 'chest press', 'bench'], d);
  FILL['bench-press'] = { solid: [0, 4, 8, 9], wire: [1, 2, 3, 5, 6, 7] };
  PARTS['bench-press'] = { ...figParts(1, 1), bench: [4, 5, 6], barbell: [7, 8, 9] };
}
{
  // Kettlebell swing: at the top of the swing, standing tall with the hips through, the arms straight
  // forward at shoulder height and the kettlebell (the set's weight, logistica's) hanging from the
  // hands. Hinged, with the bell low in front, the figure read as a wheelchair user.
  // The bell at 0.55: the hole under its handle stays open up to weight 2.1
  const P = [8, 13.5];
  const S = go(P, -93, 5.5);
  const hand = [15.5, S[1] + 0.5];
  const kb = logistica.icons.weight.d.map((d) => place(d, 0.55, [12, 2.75], hand));
  const d = [...figure({ H: headAt(S, -100), S, P, legs: [[P, [5.5, 21.25]], [P, [10.5, 21.25]]], arms: [[S, hand]] }), ...kb];
  add('kettlebell-swing', ['swing con pesa rusa', 'pesa rusa', 'funcional', 'kettlebell', 'kettlebell swing', 'functional training', 'swing'], d);
  FILL['kettlebell-swing'] = { solid: [0, 5], wire: [1, 2, 3, 4, 6] };
  PARTS['kettlebell-swing'] = { ...figParts(2, 1), kettlebell: [5, 6] };
  MOTION['kettlebell-swing'] = { effect: 'wiggle', parts: ['arms', 'kettlebell'], origin: S };
}
{
  // Box jump: landed on the plyo box in a squat, the arms swung forward. Tucked in the air beside the
  // box, the figure read as kneeling at it. The figure at 0.85, its feet on the box's top.
  const k = 0.85;
  const top = 14.25;
  const box = roundpoly([[6, 21.25], [7.25, top], [17.25, top], [18.5, 21.25]], [1.25, 1.75, 1.75, 1.25]);
  const P = [8.5, 11];
  const S = go(P, -60, 4.75 * k);
  const d = [...figure({ H: headAt(S, -75, HR * k), hr: HR * k, S, P, legs: [[P, [12, 11], [11.75, top]]], arms: [[S, go(S, 6, 5.75)]] }), box];
  add('box-jump', ['salto al cajón', 'pliometría', 'salto', 'explosividad', 'box jump', 'plyometrics', 'jump'], d);
  FILL['box-jump'] = { solid: [0, 4], wire: [1, 2, 3] };
  PARTS['box-jump'] = { ...figParts(1, 1), box: [4] };
  MOTION['box-jump'] = { effect: 'bounce', parts: FIGURE, vector: [0, -1.5] };
}

// ── Numbers of a workout ──────────────────────────────────────────────────────────────────────
{
  // Heart-rate zones: the set's heart and three bands across it, levels lit from the bottom up.
  const side = (y) => 4.03 + ((y - 12) / 8.5) * 7.97;
  const lobe = (y) => 7.5 - Math.sqrt(4.75 ** 2 - (y - 8.76) ** 2);
  const band = (y, x) => hl(y, x, 24 - x);
  add('heart-rate-zone', ['zona de frecuencia cardiaca', 'zonas de entrenamiento', 'tiempo en zona', 'pulso', 'heart rate zone', 'training zones', 'time in zone'], [
    HEART,
    band(16.75, side(16.75)),
    band(13.5, side(13.5)),
    band(10.25, lobe(10.25)),
  ]);
  FILL['heart-rate-zone'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['heart-rate-zone'] = { heart: [0], level: [1, 2, 3] };
  MOTION['heart-rate-zone'] = { effect: 'beat', origin: [12, 13] };
}
{
  // Calories burned: the set's flame (lugares', as restaurante sizes it for its calories) inside a
  // three-quarter ring that is drawn as far as a value says.
  const flame = setFlame([12, 13.75], 4.25, [12.79, 6.5]);
  add('calories-burned', ['calorías quemadas', 'energía activa', 'kcal', 'meta de calorías', 'calories burned', 'active energy', 'burn goal'], [arc(12, 12, 9, 135, 405).d, ...flame]);
  FILL['calories-burned'] = { solid: [1], cut: [2], wire: [0] };
  PARTS['calories-burned'] = { ring: [0], flame: [1, 2] };
  MOTION['calories-burned'] = { effect: 'wiggle', parts: ['flame'], origin: [12, 17.5] };
}
{
  // Distance: a double-headed arrow between two end ticks, over a short winding trail.
  add('distance', ['distancia', 'kilómetros', 'recorrido', 'millas', 'distance', 'kilometers', 'miles'], [
    hl(7.5, 3, 21),
    head([3, 7.5], [-1, 0], 3),
    head([21, 7.5], [1, 0], 3),
    vl(3, 4.25, 10.75),
    vl(21, 4.25, 10.75),
    wave([3, 16.75], 4, 4.5, 1.75),
  ]);
  FILL.distance = false;
  PARTS.distance = { arrow: [0, 1, 2], ticks: [3, 4], trail: [5] };
}
{
  // Pace: a running shoe in profile, its midsole across it, three speed lines trailing its heel.
  const shoe = roundpoly(
    [
      [8.5, 18.25],
      [7.75, 12],
      [10.75, 13.25],
      [12.5, 10.75],
      [17.5, 14],
      [20.75, 15.25],
      [21.25, 17],
      [20.5, 18.25],
    ],
    [1, 0.9, 1.25, 1, 1.5, 1.25, 0.75, 0.75],
  );
  add('pace', ['ritmo', 'minutos por kilómetro', 'velocidad', 'correr', 'pace', 'running pace', 'speed'], [
    shoe,
    hl(16, 8.25, 21.1),
    hl(11.75, 2.25, 4.5),
    hl(14.75, 2.25, 5),
    hl(17.75, 2.25, 5.5),
  ]);
  FILL.pace = { solid: [0], cut: [1], lines: [2, 3, 4] };
  PARTS.pace = { shoe: [0, 1], speed: [2, 3, 4] };
  MOTION.pace = { effect: 'slide', parts: ['shoe'], vector: [1.5, 0] };
}
{
  // Lap: the track's two lanes, the start line across them on the bottom straight and an arrowhead
  // between them on the top one (runners go counterclockwise).
  const outer = capsule(2.75, 5.5, 18.5, 13);
  const inner = capsule(5.75, 8.5, 12.5, 7);
  add('lap', ['vuelta', 'pista', 'parciales', 'conteo de vueltas', 'lap', 'track', 'splits'], [outer, inner, vl(12, 15.5, 18.5), head([10.5, 7], [-1, 0], 2.12)]);
  FILL.lap = { solid: [0], cut: [1, 2, 3] };
  PARTS.lap = { track: [0, 1], start: [2], arrow: [3] };
}
{
  // Elevation gain: a jagged profile rising from left to right over its baseline, an up arrow over
  // its summit.
  const peak = [17.5, 11];
  const terrain = rl([[2.5, 20.75], [6.25, 16], [8.75, 18.25], [13, 12.75], [14.75, 14.5], peak, [21.25, 20.75]], [0, 0.6, 0.6, 0.6, 0.6, 0.75, 0]);
  add('elevation-gain', ['desnivel positivo', 'ascenso', 'elevación', 'altimetría', 'elevation gain', 'total climb', 'ascent'], [
    terrain,
    hl(20.75, 2.5, 21.25),
    vl(peak[0], 2.75, peak[1] - 2.85),
    head([peak[0], 2.75], [0, -1], 2.5),
  ]);
  FILL['elevation-gain'] = { solid: [shut(terrain)], lines: [2, 3] };
  PARTS['elevation-gain'] = { terrain: [0, 1], arrow: [2, 3] };
  MOTION['elevation-gain'] = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
}
{
  // Floors climbed: a three-step stair profile and an arrow rising along it.
  add('floors-climbed', ['pisos subidos', 'escaleras', 'subir', 'actividad diaria', 'floors climbed', 'flights', 'stairs'], [
    rl([[2.75, 20.75], [7.25, 20.75], [7.25, 16.25], [11.75, 16.25], [11.75, 11.75], [16.25, 11.75], [16.25, 7.25], [21.25, 7.25]], 0.6),
    line([3.25, 13.75], [11.25, 5.75]),
    head([11.25, 5.75], [1, -1], 3),
  ]);
  FILL['floors-climbed'] = false;
  PARTS['floors-climbed'] = { stairs: [0], arrow: [1, 2] };
  MOTION['floors-climbed'] = { effect: 'slide', parts: ['arrow'], vector: [1.25, -1.25] };
}
{
  // Finish line: two posts, a pennant on one, and the tape between them snapped in the middle, its
  // ends flicking up.
  add('finish-line', ['meta', 'línea de meta', 'carrera', 'reto cumplido', 'finish line', 'race', 'goal'], [
    vl(4.25, 2.75, 21.25),
    vl(19.75, 2.75, 21.25),
    roundpoly([[4.25, 2.75], [8.75, 4.5], [4.25, 6.25]], 0.5),
    'M4.25 10C7.25 10 9 11 10.5 9.25',
    'M19.75 10C16.75 10 15 11 13.5 9.25',
  ]);
  FILL['finish-line'] = { solid: [2], wire: [0, 1], lines: [3, 4] };
  PARTS['finish-line'] = { posts: [0, 1], flag: [2], tape: [3, 4] };
  MOTION['finish-line'] = { effect: 'wiggle', parts: ['flag'], origin: [4.25, 4.5] };
}
{
  // Personal record: sistema's medal on its ribbon, an up chevron on its face (on top: the engine
  // clears the ribbon behind it).
  const strap = sistema.icons['medal-ribbon'].d[0];
  const medal = sistema.icons['medal-ribbon'].badge.d[0];
  const up = line([10, 16.75], [12, 14.75], [14, 16.75]);
  add('personal-record', ['récord personal', 'mejor marca', 'nuevo récord', 'logro', 'personal record', 'personal best', 'pr'], [strap], { badge: { d: [medal, up], knock: medal, fill: { solid: [medal], cut: [up] } } });
  FILL['personal-record'] = { solid: [0] };
  PARTS['personal-record'] = { strap: [0] };
}
{
  // Reps: the dumbbell inside a three-quarter arc arrow going round it, the way a set repeats (a
  // half-circle arc over a dumbbell read as headphones).
  const a = arc(12, 12.25, 8, 0, 270);
  add('reps', ['repeticiones', 'series', 'conteo de repeticiones', 'curl', 'reps', 'repetitions', 'rep count'], [...bell([12, 12.25], 0.42, { ends: false }), a.d, head(a.end, a.tangent, 3)]);
  FILL.reps = { solid: [0, 1], wire: [2], lines: [3, 4] };
  PARTS.reps = { dumbbell: [0, 1, 2], arrow: [3, 4] };
  MOTION.reps = { effect: 'spin', parts: ['arrow'], origin: [12, 12.25] };
}
{
  // Interval training: lugares' stopwatch with nucleo's bolt for a face.
  const sw = lugares.icons.stopwatch.d;
  const bolt = place(nucleo.icons.bolt.d[0], 0.6, [12, 12], [12, 13.25]);
  add('interval-training', ['entrenamiento por intervalos', 'hiit', 'temporizador', 'rondas', 'interval training', 'hiit timer', 'work and rest'], [sw[0], sw[1], sw[2], sw[3], bolt]);
  FILL['interval-training'] = { solid: [0], wire: [1, 2, 3], cut: [4] };
  PARTS['interval-training'] = { face: [0], crown: [1, 2], button: [3], bolt: [4] };
  MOTION['interval-training'] = { effect: 'beat', parts: ['bolt'], origin: [12, 13.25] };
}
{
  // Circuit training: four stations on a circle, each joined to the next by an arc arrow (clockwise).
  const r = 7.5;
  const d = [];
  for (const a of [-90, 0, 90, 180]) {
    const s = arc(12, 12, r, a + 28, a + 62);
    d.push(dot(...polar(12, 12, r, a)), s.d, head(s.end, s.tangent, 2.5));
  }
  add('circuit-training', ['circuito', 'estaciones', 'entrenamiento en circuito', 'rotación', 'circuit training', 'stations', 'circuit'], d);
  FILL['circuit-training'] = false;
  PARTS['circuit-training'] = { stations: [0, 3, 6, 9], arrows: [1, 2, 4, 5, 7, 8, 10, 11] };
  MOTION['circuit-training'] = { effect: 'spin', origin: [12, 12] };
}
{
  // Workout plan: archivos' clipboard with the dumbbell across its sheet.
  const [board, clip] = archivos.icons.clipboard.d;
  add('workout-plan', ['plan de entrenamiento', 'rutina', 'programa', 'sesión de hoy', 'workout plan', 'training program', 'routine'], [board, clip, ...bell([12, 14], 0.42, { ends: false })]);
  FILL['workout-plan'] = { ...archivos.icons.clipboard.fill, cut: [...(archivos.icons.clipboard.fill.cut ?? []), ...bell([12, 14], 0.42, { ends: false })] };
  PARTS['workout-plan'] = { board: [0], clip: [1], dumbbell: [2, 3, 4] };
}
{
  // Rest day: the dumbbell lying under lugares' crescent moon.
  const moon = place(lugares.icons.moon.d[0], 0.5, [11.5, 12.5], [12, 7]);
  add('rest-day', ['día de descanso', 'recuperación', 'descanso', 'pausa', 'rest day', 'recovery day', 'day off'], [moon, ...bell([12, 17.5], 0.58)]);
  FILL['rest-day'] = { solid: [0, 1, 2], wire: [3, 4, 5] };
  PARTS['rest-day'] = { moon: [0], dumbbell: [1, 2, 3, 4, 5] };
  MOTION['rest-day'] = { effect: 'wiggle', parts: ['moon'], origin: [12, 7] };
}

// ── The body ──────────────────────────────────────────────────────────────────────────────────
const SCALE = [sq(3.25, 3.25, 17.5, 17.5, 4, BR), capsule(8.25, 6.25, 7.5, 3.25)];
{
  // Bathroom scale, from above: the square platform and its dial window near the top edge.
  add('bathroom-scale', ['báscula', 'pesarse', 'peso corporal', 'báscula inteligente', 'bathroom scale', 'body weight', 'weigh-in'], SCALE);
  add('bathroom-scale-arrow-down', ['bajar de peso', 'pérdida de peso', 'peso a la baja', 'definición', 'weight loss', 'weight down', 'cutting'], SCALE, { badge: badge('arrow-down') });
  add('bathroom-scale-arrow-up', ['subir de peso', 'aumento de peso', 'volumen', 'peso al alza', 'weight gain', 'weight up', 'bulking'], SCALE, { badge: badge('arrow-up') });
  for (const name of ['bathroom-scale', 'bathroom-scale-arrow-down', 'bathroom-scale-arrow-up']) {
    FILL[name] = { solid: [0], cut: [1] };
    PARTS[name] = { platform: [0], dial: [1] };
  }
}
{
  // Waist measurement: the waist's two inward curves and the tape wrapped round it (seen a little
  // from above, so it bows down), its tail hanging free at the front.
  const L = 'M5.25 2.75C8.25 7.5 8.25 16.5 5.25 21.25';
  const R = 'M18.75 2.75C15.75 7.5 15.75 16.5 18.75 21.25';
  const xAt = (y) => {
    let best = [99, 0];
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const u = 1 - t;
      const yy = u * u * u * 2.75 + 3 * u * u * t * 7.5 + 3 * u * t * t * 16.5 + t * t * t * 21.25;
      const xx = u * u * u * 5.25 + 3 * u * u * t * 8.25 + 3 * u * t * t * 8.25 + t * t * t * 5.25;
      if (Math.abs(yy - y) < best[0]) best = [Math.abs(yy - y), xx];
    }
    return best[1];
  };
  const band = (y) => `M${pt([xAt(y), y])}Q12 ${f(y + 3)} ${pt([24 - xAt(y), y])}`;
  // The tail leaves the lower edge of the band 1.25 right of center and hangs down
  const y1 = 12.25;
  const x0 = xAt(y1);
  const tq = (() => {
    let best = [99, 0];
    for (let i = 0; i <= 400; i++) {
      const t = i / 400;
      const x = (1 - t) ** 2 * x0 + 2 * t * (1 - t) * 12 + t * t * (24 - x0);
      if (Math.abs(x - 13.25) < best[0]) best = [Math.abs(x - 13.25), t];
    }
    return best[1];
  })();
  const ty = (1 - tq) ** 2 * y1 + 2 * tq * (1 - tq) * (y1 + 3) + tq * tq * y1;
  const tail = `M13.25 ${f(ty)}C14 ${f(ty + 2.25)} 13.25 ${f(ty + 4.25)} 12.25 ${f(ty + 5.75)}`;
  add('waist-measure', ['medida de cintura', 'cinta métrica', 'medidas corporales', 'progreso', 'waist measurement', 'measuring tape', 'body measurements'], [
    L,
    R,
    band(8.75),
    band(12.25),
    tail,
  ]);
  FILL['waist-measure'] = false;
  PARTS['waist-measure'] = { body: [0, 1], tape: [2, 3, 4] };
}
{
  // Flexed biceps: the arm bent up from the elbow, the fist on top with its fingers' crease, the
  // biceps bulging over the upper arm.
  const arm = 'M2.75 19.25H14C17.25 19.25 19.5 17.25 19.5 14V10.5C19.5 9.5 20 8.5 20 7C20 4.5 18.25 2.75 16 2.75C13.75 2.75 12.25 4.25 12.25 6.25C12.25 7.75 13.25 9 14.75 9.25V12.5C12.75 9.5 9.25 8.25 6.25 9.75C4.25 10.75 2.75 12 2.75 13.25Z';
  add('flexed-biceps', ['bíceps', 'músculo', 'fuerza', 'ganar músculo', 'flexed biceps', 'muscle', 'strong'], [arm, hl(6.25, 12.25, 15.5)]);
  FILL['flexed-biceps'] = { solid: [0], cut: [1] };
  PARTS['flexed-biceps'] = { arm: [0], fist: [1] };
  MOTION['flexed-biceps'] = { effect: 'beat', origin: [11, 13] };
}

// ── The dumbbell with a badge ─────────────────────────────────────────────────────────────────
// lugares' dumbbell raised 3: in place, the badge's clearance cut its bar's end and its right end into
// slivers that came and went with the weight; raised, it takes only the right plate's foot.
const DUMBBELL_UP = DUMBBELL.map((d) => transform(d, 1, 0, -3));
for (const [kind, tags] of [
  ['plus', ['agregar entrenamiento', 'nuevo ejercicio', 'añadir rutina', 'add workout', 'new exercise', 'log exercise']],
  ['check', ['entrenamiento completado', 'rutina terminada', 'ejercicio registrado', 'workout done', 'workout logged', 'completed']],
  ['clock', ['entrenamiento programado', 'duración del entrenamiento', 'agendar rutina', 'scheduled workout', 'workout duration', 'training time']],
]) {
  add(`dumbbell-${kind}`, tags, DUMBBELL_UP, { badge: badge(kind) });
  FILL[`dumbbell-${kind}`] = { solid: [0, 1], wire: [2, 3, 4] };
  PARTS[`dumbbell-${kind}`] = { plates: [0, 1], bar: [2, 3, 4] };
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

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these still turned to mush. Each `small` runs its
// straight pieces through pixel centers (0.75 + 1.5k) with fewer pieces: a pixel apart at least.
{
  // Barbell: three-pixel plates with a one-pixel hole, one-pixel outer plates, the bar on one row
  const plates = [sq(5.25, 5.25, 3, 12, 0.75), sq(15.75, 5.25, 3, 12, 0.75)];
  const lines = [vl(2.25, 8.25, 14.25), vl(21.75, 8.25, 14.25), hl(11.25, 8.25, 15.75), hl(11.25, 2.25, 5.25), hl(11.25, 18.75, 21.75)];
  icons.barbell.small = { d: [...plates, ...lines], fill: { solid: plates, wire: lines } };
}
{
  // Deadlift: the figure on the pixel column at 11.25 (on the canvas's center it fell between two
  // pixels and went grey), its limbs at two rows a column, three-pixel plates on the bar's row
  const plates = [sq(2.25, 9.75, 3, 9, 0.75), sq(17.25, 9.75, 3, 9, 0.75)];
  const head = circ(11.25, 3.75, 1.5);
  const lines = [vl(11.25, 8.25, 14.25), line([8.25, 20.25], [11.25, 14.25], [14.25, 20.25]), line([8.25, 14.25], [11.25, 8.25], [14.25, 14.25]), hl(14.25, 5.25, 17.25)];
  icons.deadlift.small = { d: [head, ...lines, ...plates], fill: { solid: [head, ...plates], wire: lines } };
}
{
  // Weight plate: the disc and its hole, two grip slots (the third crowded the hole)
  const disc = circ(12, 12, 9.75);
  const cut = [circ(12, 12, 2.25), hl(6.75, 9.75, 14.25), hl(17.25, 9.75, 14.25)];
  icons['weight-plate'].small = { d: [disc, ...cut], fill: { solid: [disc], cut } };
}
{
  // Battle ropes: the anchor and two ropes as 45° zigzags, a pixel between them
  const anchor = sq(2.25, 5.25, 3, 12, 0.75);
  const zig = (dy) => line(...[[6.75, 8.25], [8.25, 6.75], [11.25, 9.75], [14.25, 6.75], [17.25, 9.75], [20.25, 6.75], [21.75, 8.25]].map(([x, y]) => [x, y + dy]));
  const ropes = [zig(0), zig(6)];
  icons['battle-ropes'].small = { d: [anchor, ...ropes], fill: { solid: [anchor], wire: ropes } };
}
{
  // Foam roller: the end, the body and one ridge
  const body = 'M6 5.25H17.25A2.25 6 0 0 1 17.25 17.25H6';
  const ridge = 'M11.25 5.25A2.25 6 0 0 1 11.25 17.25';
  const end = ellipse([6, 11.25], 2.25, 6);
  icons['foam-roller'].small = { d: [end, body, ridge], fill: { solid: [end, shut(body)], cut: [ridge] } };
}
{
  // Calories burned: the ring on pixel centers and the flame without its drop
  const ring = arc(12, 12, 9.75, 135, 405).d;
  const [flame] = setFlame([12, 14.25], 3.75, [12.75, 7.5]);
  icons['calories-burned'].small = { d: [ring, flame], fill: { solid: [flame], wire: [ring] } };
}
{
  // Lap: the two lanes and the start line; the arrowhead is dropped
  const outer = capsule(2.25, 5.25, 19.5, 12);
  const inner = capsule(5.25, 8.25, 13.5, 6);
  const start = vl(12.75, 14.25, 17.25);
  icons.lap.small = { d: [outer, inner, start], fill: { solid: [outer], cut: [inner, start] } };
}
{
  // Interval training: the face, a two-pixel stem and the crown, the bolt as a pixel zigzag
  const face = circ(12, 13.5, 6.75);
  const crown = [hl(3.75, 9.75, 14.25), vl(11.25, 3.75, 6.75), vl(12.75, 3.75, 6.75)];
  const bolt = line([14.25, 9.75], [11.25, 12.75], [14.25, 12.75], [11.25, 15.75]);
  icons['interval-training'].small = { d: [face, ...crown, bolt], fill: { solid: [face], wire: crown, cut: [bolt] } };
}
{
  // Heart-rate strap: the loop and the pod in front of it, without the heart
  const strap = ellipse([12, 9.75], 9.75, 4.5);
  const pod = capsule(6.75, 11.25, 10.5, 6);
  icons['heart-rate-strap'].small = { d: [strap], badge: { d: [pod], knock: pod, fill: { solid: [pod] } } };
}
{
  // Personal record: sistema's medal at 16 px, a flat-topped chevron on its face
  const base = sistema.icons['medal-ribbon'].small;
  const medal = base.badge.d[0];
  const up = line([9.75, 17.25], [11.25, 15.75], [12.75, 15.75], [14.25, 17.25]);
  icons['personal-record'].small = { d: base.d, fill: base.fill, badge: { d: [medal, up], knock: medal, fill: { solid: [medal], cut: [up] } } };
}

// Mirror: the figures in profile and whatever moves or grows toward one side (personas' rule: front
// views keep their side; the machines are objects with a fixed side, like lugares' bicycle)
for (const name of [
  'running', 'trail-running', 'cycling', 'mountain-biking', 'swimming', 'hiking', 'pilates', 'push-up',
  'squat', 'lunge', 'sit-up', 'glute-bridge', 'bench-press', 'kettlebell-swing', 'box-jump',
  'pace', 'elevation-gain', 'floors-climbed',
])
  icons[name].mirror = true;

// Levels and values: the zones light from the bottom up; the calories' ring is drawn as far as the
// burn goal is met
icons['heart-rate-zone'].levels = [[1], [2], [3]];
icons['calories-burned'].value = { draw: ['ring'] };

// Variants: with a badge (as in comercio and restaurante) the enclosures lose the piece on top and
// the slash would cross it; already enclosed, the plate, the ball, the ring and the stopwatch skip the
// circle and the scale skips the square
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };
for (const name of ['weight-plate', 'exercise-ball', 'calories-burned', 'interval-training', 'circuit-training']) icons[name].variants = { ...icons[name].variants, circle: false };
icons['bathroom-scale'].variants = { square: false };

export default { category: 'fitness', label: 'Fitness y entrenamiento', icons };
