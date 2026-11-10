// Deportes (sports): the balls, the rackets, bats and sticks, the gear worn and ridden, the fields,
// courts and venues, officiating and competition, and the sports as whole figures. Everything is
// computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md. The constructions:
// - every ball is one circle, the keyline's (r 9), and the sport is told by its seams alone;
// - the rackets share one grip, a capsule 3 wide and 6.5 long, at one place on the racket's axis;
//   rackets, bats and boards are drawn upright and turned to their diagonal (turnPath);
// - the fields and courts (and the billiard table and the lineup's pitch) are top views on one
//   rounded rectangle, the landscape keyline;
// - the football and racing helmets share one shell in profile, facing right, and differ in what
//   covers the face; the cycling helmet draws that shell out into its tail;
// - a player is the set's whole figure (fitness' and personas': a round head of r 1.9 standing 2.35
//   clear of the shoulders, one stroke for the torso and one per limb, rounded at the joints), one
//   per icon, and the equipment tells the sport;
// - calendar-ball builds on calendario's calendar, referee-shirt on ropa's polo and chairlift on
//   hogar's chair; the trophy, the medal and the podium are sistema's and comercio's and are never
//   drawn here;
// - a ball beside a head carries the tennis ball's S seam (seamBall): plain, it reads as a second head.
// Badges are the engine's; a piece in front of another (the flagstick over the green) is a custom
// badge and the engine clears what lies behind it.
import { arc, badge, circ, dot, f, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import calendario from './calendario.mjs';
import hogar from './hogar.mjs';
import ropa from './ropa.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const deg = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
/** The point `l` away from `p` at `a` degrees (0 = right, 90 = down). */
const go = (p, a, l) => add2(p, [l * Math.cos(rad(a)), l * Math.sin(rad(a))]);
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Turns a path `a` degrees about `c` (the canvas's center by default). */
const tp = (d, a, c = [12, 12]) => turnPath(d, a, c);

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
/** A capsule along the axis from `a` to `b`, `r` either side of it. */
function bar(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1] * r, u[0] * r];
  return `M${pt(add2(a, n))}L${pt(add2(b, n))}A${f(r)} ${f(r)} 0 0 0 ${pt(sub(b, n))}L${pt(sub(a, n))}A${f(r)} ${f(r)} 0 0 0 ${pt(add2(a, n))}Z`;
}
/** Ellipse of semi-axes rx, ry at c, as two half arcs. */
const ellipse = ([cx, cy], rx, ry) => `M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx - rx, cy])}Z`;
/** The circle through three points: its center and radius. */
function circle3(a, m, b) {
  const [ax, ay, bx, by, cx, cy] = [...a, ...m, ...b];
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  return { c: [ux, uy], r: Math.hypot(ax - ux, ay - uy) };
}
/** The `A…` segment of the circular arc from `a` through `m` to `b` (to chain it inside a path). */
function arc3To(a, m, b) {
  const { c, r } = circle3(a, m, b);
  const cross = (m[0] - a[0]) * (b[1] - m[1]) - (m[1] - a[1]) * (b[0] - m[0]);
  const side = (p) => Math.sign((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  const large = side(m) === side(c) ? 1 : 0;
  return `A${f(r)} ${f(r)} 0 ${large} ${cross > 0 ? 1 : 0} ${pt(b)}`;
}
/** The circular arc from `a` through `m` to `b`. */
const arc3 = (a, m, b) => `M${pt(a)}${arc3To(a, m, b)}`;
/** The point of the cubic p0 p1 p2 p3 where coordinate `axis` (0 = x, 1 = y) equals v (the curve is monotonic there). */
function cubicAt([p0, p1, p2, p3], axis, v) {
  const at = (t) => {
    const u = 1 - t;
    return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]);
  };
  let [lo, hi] = [0, 1];
  const up = at(1)[axis] > at(0)[axis];
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid)[axis] < v === up) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2);
}
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

/**
 * electrodomesticos' fire standing on (cx, by), `w` wide and `h` tall: a round foot, its main tip
 * leaning right and a second, smaller tip on its left.
 */
function fire(cx, by, w, h) {
  const r = w / 2;
  const T = [cx + 0.12 * w, by - h];
  const S = [cx - 0.36 * w, by - 0.68 * h];
  const N = [cx - 0.1 * w, by - 0.5 * h];
  return `M${pt(T)}C${pt([cx + 0.2 * w, by - 0.72 * h])} ${pt([cx + r, by - 0.62 * h])} ${pt([cx + r, by - r])}A${f(r)} ${f(r)} 0 0 1 ${pt([cx - r, by - r])}C${pt([cx - r, by - 0.45 * h])} ${pt([cx - 0.45 * w, by - 0.58 * h])} ${pt(S)}C${pt([cx - 0.25 * w, by - 0.6 * h])} ${pt([cx - 0.18 * w, by - 0.55 * h])} ${pt(N)}C${pt([cx - 0.12 * w, by - 0.75 * h])} ${pt([cx, by - 0.85 * h])} ${pt(T)}Z`;
}
/** A ball of radius `br` crossed by the tennis ball's S seam: what tells a ball from a head. */
const seamBall = (bc, br) => [circ(...bc, br), `M${pt(polar(...bc, br, -120))}C${pt(add2(bc, [br * 0.93, -br * 0.69]))} ${pt(add2(bc, [-br * 0.93, br * 0.69]))} ${pt(polar(...bc, br, 60))}`];

/** Clips the line through `p` along `u` to the box [x0, x1] × [y0, y1] (Liang–Barsky); null if it misses. */
function clipLine(p, u, [x0, y0, x1, y1]) {
  let [t0, t1] = [-1e9, 1e9];
  for (const [d, lo, hi, q] of [[u[0], x0, x1, p[0]], [u[1], y0, y1, p[1]]]) {
    if (Math.abs(d) < 1e-9) {
      if (q < lo || q > hi) return null;
      continue;
    }
    const [a, b] = [(lo - q) / d, (hi - q) / d].sort((m, n) => m - n);
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
  }
  return t1 - t0 > 2 ? [add2(p, mul(u, t0)), add2(p, mul(u, t1))] : null;
}
/** A net's diamond mesh over a box: lines at ±45° whose centerlines stand `gap` apart, through `o`. */
function mesh(box, gap, o = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]) {
  const out = [];
  for (const u of [[Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]]) {
    const n = [-u[1], u[0]];
    for (let k = -8; k <= 8; k++) {
      const seg = clipLine(add2(o, mul(n, k * gap)), u, box);
      if (seg) out.push(line(...seg));
    }
  }
  return out;
}

const icons = {};
/** Fill specs, named parts and motion collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Balls ─────────────────────────────────────────────────────────────────────────────────────
// One circle, the keyline's, and the seams that tell the sport. Filled, the ball is solid and its
// seams are cut out.
const C = [12, 12];
const R = 9;
const BALL = circ(...C, R);
const rim = (a) => polar(...C, R, a);
{
  // Soccer ball: a pentagon at the center and a seam from each corner straight out to the rim.
  const corners = Array.from({ length: 5 }, (_, i) => -90 + i * 72);
  const pent = roundpoly(corners.map((a) => polar(...C, 3.5, a)), 0.5);
  add('soccer-ball', ['balón de fútbol', 'fútbol', 'gol', 'soccer ball', 'football', 'soccer'], [
    BALL,
    pent,
    ...corners.map((a) => line(polar(...C, 3.5, a), rim(a))),
  ]);
  FILL['soccer-ball'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['soccer-ball'] = { ball: [0], seams: [1, 2, 3, 4, 5, 6] };
  MOTION['soccer-ball'] = { effect: 'spin', origin: C };
}
{
  // Basketball: the vertical seam through the center and a seam down each side bowing in toward it
  // (with the horizontal seam too, the ball ran past the ink ceiling).
  const side = (m) => arc3(rim(m > 0 ? -42 : -138), [12 + m * 3.5, 12], rim(m > 0 ? 42 : 138));
  add('basketball', ['balón de basquetbol', 'básquetbol', 'baloncesto', 'basketball', 'hoops', 'nba'], [BALL, vl(12, 3, 21), side(-1), side(1)]);
  FILL.basketball = { solid: [0], cut: [1, 2, 3] };
  PARTS.basketball = { ball: [0], seams: [1, 2, 3] };
  MOTION.basketball = { effect: 'bounce', vector: [0, -2] };
}
{
  // American football: a pointed oval laid on the 45° diagonal, its lace along the middle crossed by
  // three stitches. Drawn upright and turned.
  const [L, w] = [10.6, 5.6];
  const oval = `M12 ${f(12 - L)}${arc3To([12, 12 - L], [12 + w, 12], [12, 12 + L])}${arc3To([12, 12 + L], [12 - w, 12], [12, 12 - L])}Z`;
  const lace = vl(12, 7.75, 16.25);
  const stitches = [9, 12, 15].map((y) => hl(y, 10.5, 13.5));
  add('american-football', ['balón de fútbol americano', 'fútbol americano', 'touchdown', 'american football', 'gridiron', 'nfl'], [oval, lace, ...stitches].map((d) => tp(d, 45)));
  FILL['american-football'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['american-football'] = { ball: [0], lace: [1, 2, 3, 4] };
  MOTION['american-football'] = { effect: 'spin', origin: C };
}
{
  // Baseball: two seams bowing in from left and right, each crossed by three stitches.
  const seam = (m) => {
    const a = rim(m > 0 ? -45 : -135);
    const b = rim(m > 0 ? 45 : 135);
    const mid = [12 + m * 3, 12];
    const { c, r } = circle3(a, mid, b);
    const base = deg(sub(mid, c));
    const ticks = [-25, 0, 25].map((da) => {
      const p = polar(...c, r, base + da);
      const u = unit(sub(p, c));
      return line(add2(p, mul(u, -1.1)), add2(p, mul(u, 1.1)));
    });
    return [arc3(a, mid, b), ...ticks];
  };
  add('baseball', ['pelota de béisbol', 'béisbol', 'sóftbol', 'baseball', 'softball', 'mlb'], [BALL, ...seam(-1), ...seam(1)]);
  FILL.baseball = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] };
  PARTS.baseball = { ball: [0], seams: [1, 2, 3, 4, 5, 6, 7, 8] };
  MOTION.baseball = { effect: 'spin', origin: C };
}
{
  // Tennis ball: one S seam that leaves the rim at the top left and meets it at the bottom right,
  // swinging out toward each side on the way (a shallow one read as a slash through a circle).
  const a = rim(-120);
  const b = rim(60);
  const s = `M${pt(a)}C${pt([19.5, 6.5])} ${pt([4.5, 17.5])} ${pt(b)}`;
  add('tennis-ball', ['pelota de tenis', 'tenis', 'pádel', 'tennis ball', 'tennis', 'padel'], [BALL, s]);
  FILL['tennis-ball'] = { solid: [0], cut: [1] };
  PARTS['tennis-ball'] = { ball: [0], seam: [1] };
  MOTION['tennis-ball'] = { effect: 'bounce', vector: [0, -2] };
}
{
  // Volleyball: three panel seams swirling out of the center to the rim, a third of a turn apart.
  const seam = (a) => `M12 12A7.5 7.5 0 0 1 ${pt(rim(a))}`;
  add('volleyball', ['balón de voleibol', 'voleibol', 'vóley playa', 'volleyball', 'beach volleyball', 'volley'], [BALL, seam(-30), seam(90), seam(210)]);
  FILL.volleyball = { solid: [0], cut: [1, 2, 3] };
  PARTS.volleyball = { ball: [0], seams: [1, 2, 3] };
  MOTION.volleyball = { effect: 'spin', origin: C };
}
{
  // Rugby ball: a blunt oval lying almost flat, two seams running from end to end. Drawn level and
  // turned 15°.
  const [x0, x1, h] = [2.75, 21.25, 6];
  const oval = `M${pt([x0, 12])}C${pt([x0 + 0.75, 12 - h * 0.62])} ${pt([7.25, 12 - h])} ${pt([12, 12 - h])}S${pt([x1 - 0.75, 12 - h * 0.62])} ${pt([x1, 12])}C${pt([x1 - 0.75, 12 + h * 0.62])} ${pt([16.75, 12 + h])} ${pt([12, 12 + h])}S${pt([x0 + 0.75, 12 + h * 0.62])} ${pt([x0, 12])}Z`;
  const seam = (m) => `M${pt([x0, 12])}C${pt([7, 12 + m * 2.25])} ${pt([17, 12 + m * 2.25])} ${pt([x1, 12])}`;
  add('rugby-ball', ['balón de rugby', 'rugby', 'ensayo', 'rugby ball', 'rugby', 'try'], [oval, seam(-1), seam(1)].map((d) => tp(d, -15)));
  FILL['rugby-ball'] = { solid: [0], cut: [1, 2] };
  PARTS['rugby-ball'] = { ball: [0], seams: [1, 2] };
  MOTION['rugby-ball'] = { effect: 'wiggle', origin: C };
}
{
  // Golf ball on its tee: a smaller ball dimpled in two staggered rows, resting in the tee's narrow
  // cup, the stem down from it. Three dimples read as a face, and a cup as wide as the ball, with
  // the stem, as a map pin.
  const c = [12, 8.75];
  const r = 6.5;
  const ball = circ(...c, r);
  const dimples = [[-3, -1.5], [0, -1.5], [3, -1.5], [-1.5, 1.5], [1.5, 1.5]].map((o) => dot(...add2(c, o), 0.3));
  const [l, rt] = [polar(...c, r, 110), polar(...c, r, 70)];
  const yb = c[1] + r + 2.5;
  const cup = rl([l, [11.1, yb], [12.9, yb], rt], [0, 0.6, 0.6, 0]);
  add('golf-ball', ['pelota de golf', 'golf', 'tee', 'golf ball', 'tee off', 'driving range'], [ball, ...dimples, cup, vl(12, yb, 21.25)]);
  FILL['golf-ball'] = { solid: [0, `${cup}A${f(r)} ${f(r)} 0 0 0 ${pt(l)}Z`], cut: [1, 2, 3, 4, 5], wire: [7] };
  PARTS['golf-ball'] = { ball: [0, 1, 2, 3, 4, 5], tee: [6, 7] };
  MOTION['golf-ball'] = { effect: 'bounce', parts: ['ball'], vector: [0, -1.5] };
}
{
  // Bowling ball: three finger holes clustered up and to the right of the center.
  add('bowling-ball', ['bola de boliche', 'boliche', 'bolos', 'bowling ball', 'bowling', 'tenpin'], [BALL, dot(12.5, 7), dot(16.25, 8.75), dot(13.25, 11.25)]);
  FILL['bowling-ball'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['bowling-ball'] = { ball: [0], holes: [1, 2, 3] };
  MOTION['bowling-ball'] = { effect: 'spin', origin: C };
}
{
  // Billiard ball: a stripe ball, its band between two chords and the number's disc in it, blank.
  const y = 4.75;
  const x = Math.sqrt(R * R - y * y);
  add('billiard-ball', ['bola de billar', 'billar', 'pool', 'billiard ball', 'pool ball', 'snooker'], [BALL, hl(12 - y, 12 - x, 12 + x), hl(12 + y, 12 - x, 12 + x), circ(...C, 2.25)]);
  FILL['billiard-ball'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['billiard-ball'] = { ball: [0], band: [1, 2], number: [3] };
  MOTION['billiard-ball'] = { effect: 'spin', origin: C };
}
{
  // Pickleball: six holes in a ring around one at the center.
  add('pickleball', ['pelota de pickleball', 'pickleball', 'pádel', 'pickleball', 'pickleball ball', 'paddle sports'], [
    BALL,
    dot(...C),
    ...Array.from({ length: 6 }, (_, i) => dot(...polar(...C, 4.5, -90 + i * 60))),
  ]);
  FILL.pickleball = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS.pickleball = { ball: [0], holes: [1, 2, 3, 4, 5, 6, 7] };
  MOTION.pickleball = { effect: 'bounce', vector: [0, -2] };
}
{
  // Shuttlecock: the cork's dome and the skirt of feathers flaring from it, two quills along the
  // skirt, the top edge bowed. Drawn upright, cork down, and turned 45°.
  const [cy, cr] = [16, 3.5];
  const top = 4.25;
  const tw = 6;
  const cork = `M${pt([12 - cr, cy])}A${f(cr)} ${f(cr)} 0 0 0 ${pt([12 + cr, cy])}Z`;
  const skirt = `M${pt([12 - cr, cy])}L${pt([12 - tw, top])}${arc3To([12 - tw, top], [12, top - 1.25], [12 + tw, top])}L${pt([12 + cr, cy])}`;
  const quill = (m) => line([12 + m * 1.2, cy], [12 + m * 2.05, top - 0.95]);
  add('shuttlecock', ['gallito', 'volante', 'bádminton', 'shuttlecock', 'badminton', 'birdie'], [cork, skirt, quill(-1), quill(1)].map((d) => tp(d, 45)));
  FILL.shuttlecock = { solid: [0, tp(shut(skirt), 45)], cut: [2, 3] };
  PARTS.shuttlecock = { cork: [0], skirt: [1, 2, 3] };
  MOTION.shuttlecock = { effect: 'float', vector: [1.5, -1.5] };
}
{
  // Hockey puck: a short wide cylinder at a low angle, two speed lines trailing behind it.
  const [cx, cy, rx, ry, h] = [14.75, 10.5, 6.25, 2.25, 3.5];
  const top = ellipse([cx, cy], rx, ry);
  const side = `M${pt([cx - rx, cy])}V${f(cy + h)}A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx + rx, cy + h])}V${f(cy)}`;
  add('hockey-puck', ['disco de hockey', 'hockey sobre hielo', 'puck', 'hockey puck', 'ice hockey', 'puck'], [top, side, hl(cy, 2.5, 5.5), hl(cy + h, 2.5, 5.5)]);
  FILL['hockey-puck'] = { solid: [`${side}A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx - rx, cy])}Z`, 0], cut: [`M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx + rx, cy])}`], lines: [2, 3] };
  PARTS['hockey-puck'] = { puck: [0, 1], speed: [2, 3] };
  MOTION['hockey-puck'] = { effect: 'slide', parts: ['puck'], vector: [2, 0] };
}

// ── Rackets, bats and sticks ──────────────────────────────────────────────────────────────────
// The rackets are drawn upright on the canvas's vertical axis and turned 45°: the head up and to the
// right, the grip down and to the left. They share one grip: a capsule 3 wide from 15.25 to 21.75.
const GRIP = capsule(10.5, 15.25, 3, 6.5);
const RACKET = 45;
/** The strings of a head: lines `x` (vertical) and `y` (horizontal) clipped to the ellipse (c, rx, ry). */
function strings(c, rx, ry, xs, ys) {
  const v = (x) => {
    const h = ry * Math.sqrt(1 - ((x - c[0]) / rx) ** 2);
    return vl(x, c[1] - h, c[1] + h);
  };
  const hz = (y) => {
    const w = rx * Math.sqrt(1 - ((y - c[1]) / ry) ** 2);
    return hl(y, c[0] - w, c[0] + w);
  };
  return [...xs.map(v), ...ys.map(hz)];
}
{
  // Tennis racket: the oval head with a two-by-two string grid, a short throat to the grip.
  const c = [12, 7.4];
  const [rx, ry] = [4.75, 5.75];
  const d = [ellipse(c, rx, ry), vl(12, c[1] + ry, 15.25), GRIP, ...strings(c, rx, ry, [10.5, 13.5], [5.9, 8.9])];
  add('tennis-racket', ['raqueta de tenis', 'tenis', 'squash', 'tennis racket', 'racquet', 'court sports'], d.map((p) => tp(p, RACKET)));
  // Filled, the strings stop 1.75 inside the rim: cut to it, they split the rim at light weights
  FILL['tennis-racket'] = { solid: [0, 2], cut: strings(c, rx - 1.75, ry - 1.75, [10.5, 13.5], [5.9, 8.9]).map((p) => tp(p, RACKET)), wire: [1] };
  PARTS['tennis-racket'] = { head: [0, 3, 4, 5, 6], handle: [1, 2] };
  MOTION['tennis-racket'] = { effect: 'wiggle', origin: [7, 17] };
}
{
  // Padel racket: a solid teardrop face, perforated in a hexagon of small holes, the grip straight
  // under its neck.
  const face = 'M6.25 8.75A5.75 5.75 0 0 1 17.75 8.75C17.75 11.75 15.5 13.75 13.5 15.25H10.5C8.5 13.75 6.25 11.75 6.25 8.75Z';
  const c = [12, 9];
  const holes = [dot(...c, 0.3), ...Array.from({ length: 6 }, (_, i) => dot(...polar(...c, 3, -90 + i * 60), 0.3))];
  const d = [face, GRIP, ...holes];
  add('padel-racket', ['pala de pádel', 'pádel', 'reserva de cancha', 'padel racket', 'padel', 'paddle'], d.map((p) => tp(p, RACKET)));
  FILL['padel-racket'] = { solid: [0, 1], cut: [2, 3, 4, 5, 6, 7, 8] };
  PARTS['padel-racket'] = { head: [0, 2, 3, 4, 5, 6, 7, 8], handle: [1] };
  MOTION['padel-racket'] = { effect: 'wiggle', origin: [7, 17] };
}
{
  // Badminton racket: a small strung teardrop head on a long thin shaft, thick only at the grip.
  const head = 'M8 6.25A4 4 0 0 1 16 6.25C16 8.75 14 10.5 12 11.75C10 10.5 8 8.75 8 6.25Z';
  // The strings run from the round top to the teardrop's lower edges
  const low = [[16, 6.25], [16, 8.75], [14, 10.5], [12, 11.75]];
  const vs = (x, k = 0) => {
    const m = Math.abs(x - 12);
    return vl(x, 6.25 - Math.sqrt(16 - m * m) + k, cubicAt(low, 0, 12 + m)[1] - k);
  };
  const hs = (y, k = 0) => {
    const w = (y <= 6.25 ? 12 + Math.sqrt(16 - (y - 6.25) ** 2) : cubicAt(low, 1, y)[0]) - 12 - k;
    return hl(y, 12 - w, 12 + w);
  };
  const d = [head, vl(12, 11.75, 15.25), GRIP, vs(10.5), vs(13.5), hs(4.75), hs(7.75)];
  add('badminton-racket', ['raqueta de bádminton', 'bádminton', 'deportes de raqueta', 'badminton racket', 'badminton', 'racquet'], d.map((p) => tp(p, RACKET)));
  // Filled, the strings stop short of the frame, as the tennis racket's
  FILL['badminton-racket'] = { solid: [0, 2], cut: [vs(10.5, 1.75), vs(13.5, 1.75), hs(4.75, 1.75), hs(7.75, 1.75)].map((p) => tp(p, RACKET)), wire: [1] };
  PARTS['badminton-racket'] = { head: [0, 3, 4, 5, 6], handle: [1, 2] };
  MOTION['badminton-racket'] = { effect: 'wiggle', origin: [7, 17] };
}
{
  // Table tennis paddle: the round blade flaring into the rackets' grip as one outline (a blade and
  // a separate grip read as a magnifier), turned 30°, the ball floating at its top left.
  const [l, r] = [polar(12, 8.5, 6.25, 125), polar(12, 8.5, 6.25, 55)];
  const paddle = `M${pt(l)}A6.25 6.25 0 1 1 ${pt(r)}C14.1 15 13.5 15.25 13.5 16.25V20.25A1.5 1.5 0 0 1 10.5 20.25V16.25C10.5 15.25 9.9 15 ${pt(l)}Z`;
  add('table-tennis-paddle', ['raqueta de ping pong', 'ping pong', 'tenis de mesa', 'table tennis', 'ping pong paddle', 'table tennis bat'], [tp(paddle, 30, [12, 12.5]), circ(4.25, 4.65, 1.6)]);
  FILL['table-tennis-paddle'] = { solid: [0, 1] };
  PARTS['table-tennis-paddle'] = { paddle: [0], ball: [1] };
  MOTION['table-tennis-paddle'] = { effect: 'bounce', parts: ['ball'], vector: [0, -1.5] };
}
{
  // Baseball bat: drawn level, the knob at the left and the barrel at the right, and turned -45°;
  // the ball just off the barrel's end.
  const bat = 'M2.25 10.75A1.25 1.25 0 0 1 3.5 10.25L4.25 10.6C5.25 10.5 6.75 10.5 9 10.5C13 10.25 15.75 9.75 18.5 9.6C20.25 9.5 21.5 10.75 21.5 12S20.25 14.5 18.5 14.4C15.75 14.25 13 13.75 9 13.5C6.75 13.5 5.25 13.5 4.25 13.4L3.5 13.75A1.25 1.25 0 0 1 2.25 13.25Z';
  add('baseball-bat', ['bate de béisbol', 'batear', 'béisbol', 'baseball bat', 'batting', 'softball'], [tp(bat, -45), circ(19.25, 15.5, 2.25)]);
  FILL['baseball-bat'] = { solid: [0, 1] };
  PARTS['baseball-bat'] = { bat: [0], ball: [1] };
  MOTION['baseball-bat'] = { effect: 'wiggle', parts: ['bat'], origin: [5, 19] };
}
{
  // Cricket bat: the long flat blade with its rounded toe and sloped shoulders, the narrow handle
  // rising from them as one outline, and the ridge down the middle of the blade, turned 35° (upright
  // and short it read as a bottle).
  const bat = `M9 10.5L10.5 9V3.25A1.5 1.5 0 0 1 13.5 3.25V9L15 10.5V20.75A1.75 1.75 0 0 1 13.25 22.5H10.75A1.75 1.75 0 0 1 9 20.75Z`;
  add('cricket-bat', ['bate de críquet', 'críquet', 'bateo', 'cricket bat', 'cricket', 'batting'], [bat, vl(12, 13.4, 19.6)].map((d) => tp(d, 35)));
  FILL['cricket-bat'] = { solid: [0], cut: [1] };
  PARTS['cricket-bat'] = { bat: [0], ridge: [1] };
  MOTION['cricket-bat'] = { effect: 'wiggle', origin: [12, 4] };
}
{
  // Golf club: the grip at the top (the rackets' grip, along the shaft), the long thin shaft and the
  // iron head at the bottom, its toe to the left.
  const top = [16.75, 3.25];
  const hosel = [10.25, 17.75];
  const u = unit(sub(hosel, top));
  const gripEnd = add2(top, mul(u, 5));
  const headD = roundpoly([hosel, [3.25, 16.75], [3, 20.5], [10.75, 21.25]], [0.6, 1.5, 1.5, 0.9]);
  add('golf-club', ['palo de golf', 'golf', 'hierro', 'golf club', 'golf iron', 'club fitting'], [bar(top, gripEnd, 1.5), line(add2(gripEnd, mul(u, 1.5)), hosel), headD]);
  FILL['golf-club'] = { solid: [0, 2], wire: [1] };
  PARTS['golf-club'] = { grip: [0], shaft: [1], head: [2] };
  MOTION['golf-club'] = { effect: 'wiggle', origin: top };
}
{
  // Hockey stick: the long shaft down to the heel, the flat blade along the ice toward the toe at the
  // left, and the puck ahead of the heel at the right.
  const heel = [11.75, 17.5];
  const blade = roundpoly([heel, [3, 18.25], [3, 21.25], [12.75, 21.25]], [0.6, 1.4, 1.2, 1.2]);
  add('hockey-stick', ['palo de hockey', 'hockey sobre hielo', 'equipo de hockey', 'hockey stick', 'ice hockey', 'hockey gear'], [line([17.75, 2.75], heel), blade, sq(15.75, 18.25, 5.5, 3, 1.25)]);
  FILL['hockey-stick'] = { solid: [1, 2], wire: [0] };
  PARTS['hockey-stick'] = { stick: [0, 1], puck: [2] };
  MOTION['hockey-stick'] = { effect: 'slide', parts: ['puck'], vector: [1.5, 0] };
}

{
  // Baseball glove, the palm side: the fingers' four rounded tips along the top, the thumb at the
  // left, and the webbing laced across the gap between the thumb and the index finger.
  const glove = 'M8.75 21.25H15.25C17.75 19.75 20.5 16 20.5 11.5V8.25A1.6 1.6 0 0 0 17.5 7.5A1.6 1.6 0 0 0 14.5 5.75A1.6 1.6 0 0 0 11.5 4.75A1.6 1.6 0 0 0 8.4 5.5V10.75C7.75 9.75 6.5 9 5.25 9.25C3.5 9.75 3.25 11.5 3.75 13C4.5 15.5 6.25 19 8.75 21.25Z';
  add('baseball-glove', ['guante de béisbol', 'manopla', 'atrapar', 'baseball glove', 'mitt', 'fielding'], [
    glove,
    'M8.4 10.75C8.4 12.75 8.75 14 9.75 15.25',
    vl(11.5, 7.6, 11.75),
    vl(14.5, 8.6, 12.25),
    vl(17.5, 10.35, 12.75),
    line(cubicAt([[3.75, 13], [4.5, 15.5], [6.25, 19], [8.75, 21.25]], 1, 18.25), cubicAt([[15.25, 21.25], [17.75, 19.75], [20.5, 16], [20.5, 11.5]], 1, 18.25)),
  ]);
  FILL['baseball-glove'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['baseball-glove'] = { glove: [0, 1, 2, 3, 4], strap: [5] };
}
{
  // Golf bag: the tall bag and its collar, the strap on its side, and three clubs fanning out of
  // the top, each with its head turned out.
  // A short strap read as a mug's handle: it runs nearly the bag's whole height.
  const bag = sq(8.25, 8.75, 7, 12.5, 1.75);
  const club = (base, top, toe) => [line(base, top), line(top, toe)];
  add('golf-bag', ['bolsa de golf', 'palos de golf', 'caddie', 'golf bag', 'golf clubs', 'caddie'], [
    bag,
    hl(11.75, 8.25, 15.25),
    arc3([15.25, 9.75], [18.5, 15], [15.25, 20.25]),
    ...club([9.25, 8.75], [6.75, 4.25], [4.25, 5]),
    ...club([11.75, 8.75], [11.75, 3], [14.25, 2.5]),
    ...club([14.25, 8.75], [16.75, 5], [19.25, 5.75]),
  ]);
  FILL['golf-bag'] = { solid: [0], cut: [1], wire: [2, 3, 4, 5, 6, 7, 8] };
  PARTS['golf-bag'] = { bag: [0, 1, 2], clubs: [3, 4, 5, 6, 7, 8] };
}

// ── Goals, hoops and nets ─────────────────────────────────────────────────────────────────────
{
  // Soccer goal, front on: the crossbar and the posts, the net behind them as a diamond mesh (as a
  // square grid it read as a window; with the goal line under it, it ran past the ink ceiling).
  const GOAL_MESH = mesh([3.25, 5, 20.75, 19.5], 6.5, [12, 8.75]);
  add('soccer-goal', ['portería', 'gol', 'red', 'arco', 'soccer goal', 'goal', 'goalkeeping'], [
    rl([[3.25, 19.5], [3.25, 5], [20.75, 5], [20.75, 19.5]], [0, 0.75, 0.75, 0]),
    ...GOAL_MESH,
  ]);
  FILL['soccer-goal'] = false;
  PARTS['soccer-goal'] = { frame: [0], net: GOAL_MESH.map((_, i) => 1 + i) };
}
{
  // Basketball hoop: the backboard and its inner square, the rim on its bracket, the net tapering
  // under the rim, laced across.
  add('basketball-hoop', ['aro de basquetbol', 'canasta', 'tablero', 'basketball hoop', 'hoop', 'basket'], [
    sq(3.75, 2.75, 16.5, 9.25, 2.25),
    sq(9, 5.6, 6, 3.55, 1),
    vl(12, 12, 15),
    hl(15, 6.75, 17.25),
    line([7.5, 15], [9.5, 21.25]),
    line([16.5, 15], [14.5, 21.25]),
    line([10.5, 15], [14.5, 21.25]),
    line([13.5, 15], [9.5, 21.25]),
  ]);
  FILL['basketball-hoop'] = { solid: [0], cut: [1], wire: [2, 3, 4, 5, 6, 7] };
  PARTS['basketball-hoop'] = { board: [0, 1], rim: [2, 3], net: [4, 5, 6, 7] };
  MOTION['basketball-hoop'] = { effect: 'wiggle', parts: ['net'], origin: [12, 14.75] };
}
{
  // Net on its posts: the two tall posts, the band of net strung high between them, its top tape and
  // its bottom edge, and the diamond mesh between (low, with a square mesh, it read as a crib).
  const net = mesh([3.5, 5, 20.5, 12.5], 4.5, [12, 8.75]);
  add('volleyball-net', ['red de voleibol', 'red', 'red de tenis', 'volleyball net', 'net', 'net sports'], [
    vl(3.5, 3, 21.25),
    vl(20.5, 3, 21.25),
    hl(5, 3.5, 20.5),
    hl(12.5, 3.5, 20.5),
    ...net,
  ]);
  FILL['volleyball-net'] = false;
  PARTS['volleyball-net'] = { posts: [0, 1], net: [2, 3, ...net.map((_, i) => 4 + i)] };
}
{
  // Goalpost: the H on one post, two tall uprights from the crossbar and the stem down to its base.
  add('goalpost', ['poste de gol de campo', 'gol de campo', 'conversión', 'goalpost', 'field goal', 'uprights'], [
    rl([[6, 2.75], [6, 11.25], [18, 11.25], [18, 2.75]], [0, 0.75, 0.75, 0]),
    vl(12, 11.25, 21.25),
    hl(21.25, 8.5, 15.5),
  ]);
  FILL.goalpost = false;
  PARTS.goalpost = { uprights: [0], post: [1, 2] };
}
{
  // Cricket wicket: three stumps and the two bails resting over them.
  add('cricket-wicket', ['wicket', 'críquet', 'eliminado', 'cricket wicket', 'stumps', 'bails'], [
    vl(7.5, 6.5, 21.25),
    vl(12, 6.5, 21.25),
    vl(16.5, 6.5, 21.25),
    hl(3.6, 6.25, 10.55),
    hl(3.6, 13.45, 17.75),
  ]);
  FILL['cricket-wicket'] = false;
  PARTS['cricket-wicket'] = { stumps: [0, 1, 2], bails: [3, 4] };
  MOTION['cricket-wicket'] = { effect: 'bounce', parts: ['bails'], vector: [0, -1.5] };
}
{
  // Archery target on its stand: the face of rings and the bullseye, and three legs.
  const c = [12, 9.25];
  add('archery-target', ['diana', 'tiro con arco', 'blanco', 'archery target', 'archery', 'target practice'], [
    circ(...c, 7),
    circ(...c, 4),
    dot(...c),
    line(polar(...c, 7, 115), [5.5, 21.25]),
    line(polar(...c, 7, 65), [18.5, 21.25]),
    vl(12, 16.25, 21.25),
  ]);
  FILL['archery-target'] = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
  PARTS['archery-target'] = { target: [0, 1, 2], stand: [3, 4, 5] };
}
{
  // Bowling pin: the round head, the narrow neck with its two stripes, the full belly, the flat base.
  const pin = 'M12 2.75C13.6 2.75 14.65 3.9 14.65 5.5C14.65 7.25 13.6 8.25 13.6 9.75C13.6 11.5 16.25 12.75 16.25 15.75C16.25 18 15.25 19.75 14.75 21.25H9.25C8.75 19.75 7.75 18 7.75 15.75C7.75 12.75 10.4 11.5 10.4 9.75C10.4 8.25 9.35 7.25 9.35 5.5C9.35 3.9 10.4 2.75 12 2.75Z';
  const stripe = (y, seg) => {
    const x = cubicAt(seg, 1, y)[0];
    return hl(y, 24 - x, x);
  };
  add('bowling-pin', ['pino de boliche', 'boliche', 'chuza', 'bowling pin', 'bowling', 'strike'], [
    pin,
    stripe(8.25, [[14.65, 5.5], [14.65, 7.25], [13.6, 8.25], [13.6, 9.75]]),
    stripe(11.25, [[13.6, 9.75], [13.6, 11.5], [16.25, 12.75], [16.25, 15.75]]),
  ]);
  FILL['bowling-pin'] = { solid: [0], cut: [1, 2] };
  PARTS['bowling-pin'] = { pin: [0], stripes: [1, 2] };
  MOTION['bowling-pin'] = { effect: 'wiggle', origin: [12, 21.25] };
}
{
  // Curling stone, in profile: the squat rounded stone and its band, and the handle rising from the
  // top and curving forward.
  const stone = 'M3 16.75C3 13.75 5 12.75 7 12.75H17C19 12.75 21 13.75 21 16.75C21 19.75 19 20.75 17 20.75H7C5 20.75 3 19.75 3 16.75Z';
  add('curling-stone', ['piedra de curling', 'curling', 'deportes de hielo', 'curling stone', 'curling', 'ice sports'], [stone, hl(16.75, 3, 21), rl([[9.5, 12.75], [9.5, 7.75], [18, 7.75]], [0, 2, 0])]);
  FILL['curling-stone'] = { solid: [0], cut: [1], wire: [2] };
  PARTS['curling-stone'] = { stone: [0, 1], handle: [2] };
  MOTION['curling-stone'] = { effect: 'slide', vector: [2, 0] };
}

// ── Helmets ───────────────────────────────────────────────────────────────────────────────────
// One shell in profile, facing right: the back of the head at the left and the crown rising to the
// forehead; each helmet finishes it at the face.
const DOME = 'M4.75 18.25C3.25 15.5 2.75 12 3.75 9C5 5.25 8.5 3.25 12.25 3.25C16 3.25 18.75 5.5 19.75 8.75';
{
  // Football helmet: the shell open at the face under the brow, the ear hole, and the face mask's
  // two bars joined at the front.
  const shell = `${DOME}L20 10.75H16.5C15.75 12.5 15.5 14.5 15.75 16L16.75 18.25C12.5 19.75 8 19.75 4.75 18.25Z`;
  add('football-helmet', ['casco de fútbol americano', 'fútbol americano', 'equipo', 'football helmet', 'gridiron', 'helmet'], [
    shell,
    dot(10.25, 12.5),
    rl([[15.65, 13.25], [20.5, 13.25], [20.5, 17], [16.3, 17]], [0, 0.75, 0.75, 0]),
  ]);
  FILL['football-helmet'] = { solid: [0], cut: [1], wire: [2] };
  PARTS['football-helmet'] = { shell: [0, 1], mask: [2] };
}
{
  // Cycling helmet: the shell drawn out into a tail at the back, three vents along its top and the
  // chin strap under it.
  const shell = 'M2.75 14.25C3.25 9 7.25 5.25 12.75 5.25C17 5.25 20.25 8 20.75 11.75C21 13.25 20.25 14.25 18.75 14.25Z';
  add('bike-helmet', ['casco de ciclismo', 'ciclismo', 'casco de bici', 'bike helmet', 'cycling helmet', 'bike safety'], [
    shell,
    ...[[8, [9.25, 9.25]], [12.5, [12.5, 8.25]], [16.75, [15.75, 9]]].map(([x, end]) => {
      const seg = x < 12.75 ? [[2.75, 14.25], [3.25, 9], [7.25, 5.25], [12.75, 5.25]] : [[12.75, 5.25], [17, 5.25], [20.25, 8], [20.75, 11.75]];
      return line(cubicAt(seg, 0, x), end);
    }),
    line([7.25, 14.25], [11.25, 19.25], [16.5, 14.25]),
  ]);
  FILL['bike-helmet'] = { solid: [0], cut: [1, 2, 3], wire: [4] };
  PARTS['bike-helmet'] = { shell: [0, 1, 2, 3], strap: [4] };
}
{
  // Racing helmet: the shell closed over the face, the visor's window across its front and a livery
  // stripe sweeping from the back under it. A visor slit with the stripe read as a G; the spoiler
  // at the crown read as a tuft and is left out. Filled, the visor is a window through the shell.
  const shell = `${DOME}C20.5 11 20.75 13 20.75 15.25C20.75 17.5 19.25 19.25 17 19.25H8C6.75 19.25 5.5 19 4.75 18.25Z`;
  const VISOR = [[9.75, 9], [16.5, 9], [17.75, 13.25], [9.75, 13.25]];
  const VR = [1.75, 1.25, 1, 1.75];
  const visor = roundpoly(VISOR, VR);
  const back = cubicAt([[4.75, 18.25], [3.25, 15.5], [2.75, 12], [3.75, 9]], 1, 12.5);
  add('racing-helmet', ['casco de carreras', 'automovilismo', 'piloto', 'racing helmet', 'motorsport', 'racing driver'], [
    shell,
    visor,
    `M${pt(back)}C6 15.5 11 16.25 17.5 16.25`,
  ]);
  FILL['racing-helmet'] = { solid: [`${shell}${roundpoly([...VISOR].reverse(), [...VR].reverse())}`], cut: [2] };
  PARTS['racing-helmet'] = { shell: [0, 2], visor: [1] };
}

// ── Worn gear ─────────────────────────────────────────────────────────────────────────────────
{
  // Ski goggles: one wide curved lens dipping over the nose, a glint in its corner, and the strap's
  // band running out on both sides.
  const lens = 'M4.75 9.75C4.75 7.75 6 6.75 8 6.75H16C18 6.75 19.25 7.75 19.25 9.75V13C19.25 15.5 18 16.75 16 16.75C14.5 16.75 13.5 15 12 15C10.5 15 9.5 16.75 8 16.75C6 16.75 4.75 15.5 4.75 13Z';
  add('ski-goggles', ['goggles de esquí', 'gafas de nieve', 'esquí', 'ski goggles', 'snow goggles', 'snowboarding'], [
    lens,
    hl(9.75, 1.75, 4.75),
    hl(13, 1.75, 4.75),
    hl(9.75, 19.25, 22.25),
    hl(13, 19.25, 22.25),
    'M7.75 12C7.75 10.75 8.25 10 9.5 9.75',
  ]);
  FILL['ski-goggles'] = { solid: [0], wire: [1, 2, 3, 4], cut: [5] };
  PARTS['ski-goggles'] = { lens: [0, 5], strap: [1, 2, 3, 4] };
}
{
  // Soccer cleat: a low boot in profile, toe to the right, its sole and the studs under it, and two
  // laces across the instep.
  const boot = 'M4.25 16.75V10.75C4.25 9.75 5 9.25 6 9.25H9.5C10.5 9.25 11.25 10 12 11C13.25 12.5 15.25 13.25 18 13.75C20 14.1 21 15 21 16.25C21 17 20.5 17.25 19.75 17.25H4.75C4.5 17.25 4.25 17 4.25 16.75Z';
  add('soccer-cleat', ['tachos', 'zapato de fútbol', 'tacos', 'soccer cleat', 'football boot', 'studs'], [
    boot,
    ...[6.5, 10.25, 17.75].map((x) => vl(x, 17.25, 19.75)),
    ...[12.75, 15.75].map((x) => {
      const p = cubicAt([[12, 11], [13.25, 12.5], [15.25, 13.25], [18, 13.75]], 0, x);
      return line(p, add2(p, [-1.1, 2]));
    }),
  ]);
  FILL['soccer-cleat'] = { solid: [0], wire: [1, 2, 3], cut: [4, 5] };
  PARTS['soccer-cleat'] = { boot: [0, 4, 5], studs: [1, 2, 3] };
}
{
  // Referee shirt: ropa's polo (its collar and its band behind), its buttons swapped for three
  // stripes running down from the collar to the hem.
  const [body, back] = ropa.icons['shirt-polo'].d;
  // The collar's band behind the neck is left out: with it the shirt ran past the ink ceiling
  // The stripes run down from the neck's corners and stop 2.85 short of the hem; filled, the side ones
  // start below the collar (cut from the neck's corners, they split it at bold)
  add('referee-shirt', ['camiseta de árbitro', 'árbitro', 'réferi', 'referee shirt', 'referee', 'umpire'], [body, vl(8.75, 3.75, 17.9), vl(12, 5.5, 17.9), vl(15.25, 3.75, 17.9)]);
  FILL['referee-shirt'] = { solid: [0], cut: [ropa.icons['shirt-polo'].fill.cut[0], vl(8.75, 9, 17.9), vl(12, 5.5, 17.9), vl(15.25, 9, 17.9)] };
  PARTS['referee-shirt'] = { shirt: [0], stripes: [1, 2, 3] };
}
{
  // Wrestling mask (lucha libre): the head's outline, two large teardrop eye openings slanting up to
  // the center, the mouth's opening and the stripe down the middle of the forehead.
  const mask = 'M12 2.75C16.5 2.75 19.25 6.25 19.25 10.75C19.25 15.75 16 21.25 12 21.25C8 21.25 4.75 15.75 4.75 10.75C4.75 6.25 7.5 2.75 12 2.75Z';
  const eye = (m) => {
    const c = [12 + m * 3.25, 11.5];
    const r = 1.9;
    const tip = [12 + m * 6, 8.5];
    const u = sub(tip, c);
    const a = deg(u);
    const t = Math.acos(r / len(u)) * (180 / Math.PI);
    return `M${pt(tip)}L${pt(polar(...c, r, a - t * m))}A${f(r)} ${f(r)} 0 1 ${m > 0 ? 0 : 1} ${pt(polar(...c, r, a + t * m))}Z`;
  };
  add('wrestling-mask', ['máscara de luchador', 'lucha libre', 'luchador', 'wrestling mask', 'lucha libre', 'pro wrestling'], [mask, eye(-1), eye(1), ellipse([12, 16.5], 2.25, 1.5), vl(12, 2.75, 5.5)]);
  FILL['wrestling-mask'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['wrestling-mask'] = { mask: [0, 4], eyes: [1, 2], mouth: [3] };
}

// ── Snow, ice and boards ──────────────────────────────────────────────────────────────────────
{
  // Skis: a pair crossed in an X, each a long stroke whose tip turns up and over at the top, on a
  // curl of r 2.75 (on r 2 the tips were lost at 18 px and the pair read as a close sign).
  const ski = (m) => {
    const a = [12 - m * 7.25, 21];
    const b = [12 + m * 5.25, 6.25];
    const u = unit(sub(b, a));
    const n = [u[1] * m, -u[0] * m];
    const c = add2(b, mul(n, -2.75));
    return `M${pt(a)}L${pt(b)}A2.75 2.75 0 0 ${m > 0 ? 0 : 1} ${pt(add2(c, mul(u, 2.75)))}`;
  };
  add('skis', ['esquís', 'esquí', 'renta de esquís', 'skis', 'skiing', 'ski rental'], [ski(1), ski(-1)]);
  FILL.skis = false;
  PARTS.skis = { skis: [0, 1] };
}
{
  // Snowboard: one board with rounded ends laid on the diagonal, its two bindings across it at a
  // stance's angles.
  // Drawn level and turned 30°: the board narrows at its waist between the wider rounded tips (a
  // straight capsule read as a bandage), the bindings at a stance's angles.
  const [L, w0, w1] = [7.25, 3, 2.35];
  const board = `M${pt([12 - L, 12 - w0])}C${pt([9, 12 - w1])} ${pt([15, 12 - w1])} ${pt([12 + L, 12 - w0])}A${f(w0)} ${f(w0)} 0 0 1 ${pt([12 + L, 12 + w0])}C${pt([15, 12 + w1])} ${pt([9, 12 + w1])} ${pt([12 - L, 12 + w0])}A${f(w0)} ${f(w0)} 0 0 1 ${pt([12 - L, 12 - w0])}Z`;
  const binding = (x, tilt) => {
    const hw = w1 + 0.12;
    const dx = Math.tan(rad(tilt)) * hw;
    return line([x - dx, 12 - hw], [x + dx, 12 + hw]);
  };
  add('snowboard', ['tabla de snowboard', 'snowboard', 'renta de tabla', 'snowboard', 'snowboarding', 'terrain park'], [board, binding(8.5, -15), binding(15.5, 15)].map((d) => tp(d, -30)));
  FILL.snowboard = { solid: [0], cut: [1, 2] };
  PARTS.snowboard = { board: [0], bindings: [1, 2] };
}

// The skates share one lace-up boot in profile, toe to the right, its sole on 16.25.
const BOOT = 'M5.5 16.25V4.75A1.5 1.5 0 0 1 7 3.25H9.75A1.25 1.25 0 0 1 11 4.5V9.5C11 11 12.25 11.75 14.25 12.25L18 13.1C19.25 13.4 20 14.25 20 15.25V16.25Z';
const LACES = [hl(6.5, 8.25, 11), hl(9.5, 8.25, 11)];
{
  // Ice skate: the boot on its blade, the blade's front curling up into the toe, a post at the heel.
  add('ice-skate', ['patín de hielo', 'patinaje sobre hielo', 'pista de hielo', 'ice skate', 'ice skating', 'skate rental'], [
    BOOT,
    ...LACES,
    'M4.25 19.5H17.5C19.25 19.5 20.25 18.25 20 16.25',
    vl(7.5, 16.25, 19.5),
  ]);
  FILL['ice-skate'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS['ice-skate'] = { boot: [0, 1, 2], blade: [3, 4] };
  MOTION['ice-skate'] = { effect: 'slide', vector: [2, 0] };
}
{
  // Roller skate: the boot on two wheels, the toe stop under its front.
  add('roller-skate', ['patín de ruedas', 'patinaje', 'roller derby', 'roller skate', 'quad skate', 'roller skating'], [
    BOOT,
    ...LACES,
    circ(8, 18.5, 2.25),
    circ(14.75, 18.5, 2.25),
    vl(20, 16.25, 18.75),
  ]);
  FILL['roller-skate'] = { solid: [0, 3, 4], cut: [1, 2], wire: [5] };
  PARTS['roller-skate'] = { boot: [0, 1, 2], wheels: [3, 4], stop: [5] };
  MOTION['roller-skate'] = { effect: 'slide', vector: [2, 0] };
}
{
  // Skateboard, in profile: the deck with both kicktails raised, the trucks and two wheels.
  add('skateboard', ['patineta', 'skate', 'tabla', 'skateboard', 'skate shop', 'street skating'], [
    rl([[2.25, 10.25], [4.75, 13.25], [19.25, 13.25], [21.75, 10.25]], [0, 1.25, 1.25, 0]),
    vl(7, 13.25, 16.25),
    vl(17, 13.25, 16.25),
    circ(7, 18.25, 2),
    circ(17, 18.25, 2),
  ]);
  FILL.skateboard = { solid: [3, 4], wire: [0, 1, 2] };
  PARTS.skateboard = { deck: [0], trucks: [1, 2], wheels: [3, 4] };
  MOTION.skateboard = { effect: 'slide', vector: [2, 0] };
}
{
  // Surfboard: a long board pointed at the nose, its stringer down the middle and the fin off the
  // tail; drawn upright and turned 40°.
  const board = 'M12 1.75C15.25 4.75 16 9.25 16 13.5C16 17.75 14.5 21 12 22C9.5 21 8 17.75 8 13.5C8 9.25 8.75 4.75 12 1.75Z';
  const fin = rl([[15.45, 17.75], [18.25, 20.25], [14.4, 19.95]], [0, 0.6, 0]);
  add('surfboard', ['tabla de surf', 'surf', 'escuela de surf', 'surfboard', 'surfing', 'board rental'], [board, vl(12, 7, 18.25), fin].map((d) => tp(d, 40)));
  FILL.surfboard = { solid: [0, tp(shut(fin), 40)], cut: [1] };
  PARTS.surfboard = { board: [0, 1], fin: [2] };
}

// ── Venues ────────────────────────────────────────────────────────────────────────────────────
{
  // Chairlift: the cable across the top and hogar's chair (its back, rail and seat, at its own size)
  // hanging from it by the hanger on the back, the footrest down from the seat's front. Drawn as bare
  // lines (hanger, back, seat, footrest as one bent stroke) it read as a zigzag; front on, as a
  // gondola.
  const [back, rail, seat] = hogar.icons.chair.d.map((d) => transform(d, 1, 0.25, 3.75));
  const y = (x) => 3 + (x - 2) * 0.1;
  add('chairlift', ['telesilla', 'remonte', 'centro de esquí', 'chairlift', 'ski lift', 'lift status'], [
    line([2, y(2)], [22, y(22)]),
    vl(8.5, y(8.5), 7),
    back,
    rail,
    seat,
    rl([[16.75, 19], [16.75, 21.25], [19.75, 21.25]], [0, 0.75, 0]),
  ]);
  FILL.chairlift = { solid: [shut(back), 4], cut: [3], wire: [0, 1, 5] };
  PARTS.chairlift = { cable: [0], chair: [1, 2, 3, 4, 5] };
  MOTION.chairlift = { effect: 'slide', parts: ['chair'], vector: [1.5, 0.15] };
}
{
  // Half-pipe: the U-shaped ramp in profile, a flat deck at each lip, standing on its base.
  add('half-pipe', ['half pipe', 'rampa', 'skatepark', 'half-pipe', 'skate ramp', 'freestyle'], [
    'M2 7.5H5.25C5.25 13.5 8 16.75 12 16.75S18.75 13.5 18.75 7.5H22V20.75H2Z',
  ]);
  FILL['half-pipe'] = { solid: [0] };
  PARTS['half-pipe'] = { ramp: [0] };
}
{
  // Stadium, from the side: the facade's roofline rising at both ends, where the stands are highest,
  // and three arches along its foot (the bowl seen from above read as a puck or a drum).
  const arch = (x) => `M${pt([x - 1.75, 19.5])}V15.5A1.75 1.75 0 0 1 ${pt([x + 1.75, 15.5])}V19.5`;
  const facade = 'M2.5 19.5V8.25C8 11.5 16 11.5 21.5 8.25V19.5Z';
  add('stadium', ['estadio', 'partido', 'sede', 'boletos', 'stadium', 'arena', 'venue'], [facade, arch(7), arch(12), arch(17)]);
  // Filled, the arches are openings: subpaths wound the other way through the facade
  const opening = (x) => `M${pt([x + 1.75, 19.5])}V15.5A1.75 1.75 0 0 0 ${pt([x - 1.75, 15.5])}V19.5Z`;
  FILL.stadium = { solid: [`${facade}${opening(7)}${opening(12)}${opening(17)}`] };
  PARTS.stadium = { stands: [0], arches: [1, 2, 3] };
}
{
  // Stadium lights: a tall mast and the bank of lamps on top, tilted down toward the field, two
  // short rays of light.
  const bank = sq(3, 2.75, 11, 8, 2);
  const lamps = [5.5, 8.5, 11.5].flatMap((x) => [dot(x, 5.25, 0.3), dot(x, 8.25, 0.3)]);
  const tilt = (d) => tp(d, 14, [8.5, 6.75]);
  const foot = rot([8.5, 10.75], [8.5, 6.75], 14);
  add('stadium-lights', ['luces del estadio', 'juego nocturno', 'reflectores', 'stadium lights', 'floodlights', 'night game'], [
    vl(foot[0], foot[1], 21.25),
    tilt(bank),
    ...lamps.map(tilt),
    line([17.25, 11.25], [19.75, 13]),
    line([15.25, 14.5], [17, 16.75]),
  ]);
  FILL['stadium-lights'] = { solid: [1], cut: [2, 3, 4, 5, 6, 7], wire: [0], lines: [8, 9] };
  PARTS['stadium-lights'] = { mast: [0], lamps: [1, 2, 3, 4, 5, 6, 7], light: [8, 9] };
}

// ── Fields, courts and pools, from above ──────────────────────────────────────────────────────
// One rounded rectangle, the landscape keyline (19 × 14), every line on it meeting its edge.
const FIELD = sq(2.5, 5, 19, 14, 2.5);
/** A box open toward the side `x0` sits on: depth to `x1`, from y0 to y1. */
const sideBox = (x0, x1, y0, y1) => rl([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], [0, 0.6, 0.6, 0]);
const SOCCER = [FIELD, vl(12, 5, 9.75), vl(12, 14.25, 19), circ(12, 12, 2.25), sideBox(2.5, 6, 9, 15), sideBox(21.5, 18, 9, 15)];
const TENNIS = [FIELD, vl(7.5, 5, 19), vl(16.5, 5, 19), hl(12, 7.5, 16.5), vl(12, 3.25, 20.75)];
{
  add('soccer-field', ['cancha de fútbol', 'campo de fútbol', 'fútbol 7', 'soccer field', 'pitch', 'five-a-side'], SOCCER);
  add('soccer-field-clock', ['renta de cancha', 'reservar cancha', 'horario de cancha', 'book a pitch', 'pitch rental', 'field booking'], SOCCER, { badge: badge('clock') });
  for (const name of ['soccer-field', 'soccer-field-clock']) {
    FILL[name] = { solid: [0], cut: [1, 2, 3, 4, 5] };
    PARTS[name] = { field: [0], lines: [1, 2, 3, 4, 5] };
  }
}
{
  // American football field: an end zone at each end, the midfield line's ticks at the sidelines and
  // the football itself at the middle, a pointed oval. Yard lines between the end zones read as a
  // sound wave or a radiator grille, at any length and spacing.
  const [L, w] = [3.75, 1.9];
  const ball = `M${pt([12 - L, 12])}${arc3To([12 - L, 12], [12, 12 - w], [12 + L, 12])}${arc3To([12 + L, 12], [12, 12 + w], [12 - L, 12])}Z`;
  add('football-field', ['campo de fútbol americano', 'emparrillado', 'yardas', 'football field', 'gridiron', 'end zone'], [
    FIELD,
    vl(6, 5, 19),
    vl(18, 5, 19),
    ball,
    vl(12, 5, 7.25),
    vl(12, 16.75, 19),
  ]);
  FILL['football-field'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['football-field'] = { field: [0], lines: [1, 2, 4, 5], ball: [3] };
}
{
  // Basketball court: the halfway line and at each end the key with its free-throw arc (the center
  // circle has no room between the arcs: it stood 1.25 from them).
  const key = (m) => {
    const [x0, x1] = m > 0 ? [2.5, 6.5] : [21.5, 17.5];
    return [sideBox(x0, x1, 9.75, 14.25), `M${pt([x1, 9.75])}A2.25 2.25 0 0 ${m > 0 ? 1 : 0} ${pt([x1, 14.25])}`];
  };
  add('basketball-court', ['cancha de basquetbol', 'duela', 'reservar cancha', 'basketball court', 'court', 'court booking'], [FIELD, vl(12, 5, 19), ...key(1), ...key(-1)]);
  FILL['basketball-court'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['basketball-court'] = { court: [0], lines: [1, 2, 3, 4, 5] };
}
{
  // Tennis court: the service lines and the center line between them marking the service boxes, and
  // the net across the middle, past the sidelines to its posts (with the doubles alleys too, it ran
  // past the ink ceiling).
  add('tennis-court', ['cancha de tenis', 'cancha de pádel', 'reservar cancha', 'tennis court', 'padel court', 'court booking'], TENNIS);
  FILL['tennis-court'] = { solid: [0], cut: [1, 2, 3], wire: [4] };
  PARTS['tennis-court'] = { court: [0], lines: [1, 2, 3], net: [4] };
}
{
  // Baseball diamond: the fan of the field between the foul lines and the outfield arc, the infield's
  // far sides from first to second to third base, a base at each corner.
  const home = [12, 18.75];
  const base = (a) => polar(...home, 6.5, a);
  const [l, r] = [polar(...home, 13, -135), polar(...home, 13, -45)];
  add('baseball-diamond', ['diamante de béisbol', 'campo de béisbol', 'estadio de béisbol', 'baseball diamond', 'ballpark', 'baseball field'], [
    `M${pt(home)}L${pt(l)}A13 13 0 0 1 ${pt(r)}Z`,
    line(base(-135), add2(home, [0, -6.5 * Math.SQRT2]), base(-45)),
    dot(...home),
    dot(...base(-45)),
    dot(...add2(home, [0, -6.5 * Math.SQRT2])),
    dot(...base(-135)),
  ]);
  // Filled, home plate at the apex stays ink (cut out, it shrank the silhouette)
  FILL['baseball-diamond'] = { solid: [0, 2], cut: [1, 3, 4, 5] };
  PARTS['baseball-diamond'] = { field: [0], infield: [1], bases: [2, 3, 4, 5] };
}
{
  // Golf course: the flag on the green: the green an ellipse, the flagstick standing in its cup in
  // front of it (on top: the engine clears the green's far edge behind the stick).
  const stick = vl(12, 2.75, 17.5);
  const flag = roundpoly([[12, 2.75], [18.5, 5.25], [12, 7.75]], [0.4, 0.75, 0.4]);
  const cup = dot(12, 17.5);
  add('golf-course', ['campo de golf', 'green', 'hoyo', 'golf course', 'golf green', 'hole'], [ellipse([12, 17.5], 8.5, 3)], {
    badge: { d: [stick, flag, cup], knock: `M12 2.75L12 17.5Z${flag}${cup}`, fill: { solid: [flag, cup], wire: [stick] } },
  });
  FILL['golf-course'] = { solid: [0] };
  PARTS['golf-course'] = { green: [0] };
  MOTION['golf-course'] = { effect: 'wiggle', parts: ['badge'], origin: [12, 17.5] };
}
{
  // Boxing ring seen from a corner: the near corner's post in the middle, its two ropes running back
  // to the side corners' posts, and the platform's two near sides (front on, posts and ropes read as
  // a crib).
  add('boxing-ring', ['ring de boxeo', 'boxeo', 'box', 'boxing ring', 'boxing', 'combat sports'], [
    'M3.5 14L12 17L20.5 14V16.5L12 20.25L3.5 16.5Z',
    vl(12, 4.5, 17),
    vl(3.5, 6.5, 14),
    vl(20.5, 6.5, 14),
    line([12, 7.75], [3.5, 9]),
    line([12, 11.25], [3.5, 12]),
    line([12, 7.75], [20.5, 9]),
    line([12, 11.25], [20.5, 12]),
  ]);
  FILL['boxing-ring'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7] };
  PARTS['boxing-ring'] = { platform: [0], posts: [1, 2, 3], ropes: [4, 5, 6, 7] };
}
{
  // Diving board: the springboard on its stand reaching out over two waves.
  add('diving-board', ['trampolín', 'clavados', 'alberca', 'diving board', 'springboard', 'diving'], [
    hl(8, 2.5, 17),
    rl([[3, 21.25], [3, 8], [6.25, 8], [6.25, 21.25]], [0, 0, 0, 0]),
    wave([9.25, 14.75], 4, 3, 1),
    wave([9.25, 19], 4, 3, 1),
  ]);
  FILL['diving-board'] = { solid: [`M3 21.25V8H6.25V21.25Z`], wire: [0], lines: [2, 3] };
  PARTS['diving-board'] = { board: [0, 1], water: [2, 3] };
  MOTION['diving-board'] = { effect: 'float', parts: ['water'], vector: [1.5, 0] };
}
{
  // Billiard table, from above: the table, six pockets at the corners and the middle of the long
  // sides, and one ball.
  // The table and its six pockets on its edge, at the corners and the middle of the long sides, and
  // one ball (pockets as dots inside it read as a die's face; bitten out of the outline, as a ticket;
  // a cushion inside the rail ran past the ink ceiling).
  const pockets = [[3.25, 5.75], [12, 5], [20.75, 5.75], [3.25, 18.25], [12, 19], [20.75, 18.25]].map((p) => dot(...p));
  add('billiard-table', ['mesa de billar', 'billar', 'pool', 'billiard table', 'pool table', 'snooker'], [FIELD, ...pockets, circ(15, 12, 1.5)]);
  FILL['billiard-table'] = { solid: [0, 1, 2, 3, 4, 5, 6], cut: [7] };
  PARTS['billiard-table'] = { table: [0], pockets: [1, 2, 3, 4, 5, 6], ball: [7] };
}

// ── Officiating ───────────────────────────────────────────────────────────────────────────────
{
  // Whistle, in profile: the round chamber with its pea, the mouthpiece running out to the left, and
  // the ring for the lanyard on the chamber's back.
  const [cc, r] = [[14.5, 14.25], 5.5];
  const y1 = 12.25;
  const xl = cc[0] - Math.sqrt(r * r - (y1 - cc[1]) ** 2);
  const body = `M4.5 ${f(cc[1] - r)}H${f(cc[0])}A${f(r)} ${f(r)} 0 1 1 ${pt([xl, y1])}H4.5A1.75 1.75 0 0 1 4.5 ${f(cc[1] - r)}Z`;
  const ringC = polar(...cc, r + 1.75, -38);
  add('whistle', ['silbato', 'árbitro', 'entrenador', 'pitazo inicial', 'whistle', 'referee', 'coach'], [body, dot(...cc), circ(...ringC, 1.75)]);
  FILL.whistle = { solid: [0], cut: [1], wire: [2] };
  PARTS.whistle = { body: [0, 1], ring: [2] };
  MOTION.whistle = { effect: 'wiggle', origin: [9, 11] };
}
{
  // Scoreboard: the board on two legs, its two score panels and the colon between them, no numbers.
  add('scoreboard', ['marcador', 'resultados', 'en vivo', 'pizarra', 'scoreboard', 'live score', 'results'], [
    sq(2.25, 3.75, 19.5, 10.5, 3, BR),
    vl(7, 14.25, 20.5),
    vl(17, 14.25, 20.5),
    sq(5.1, 6.6, 3.9, 4.8, 1.25),
    sq(15, 6.6, 3.9, 4.8, 1.25),
    dot(12, 7),
    dot(12, 11),
  ]);
  FILL.scoreboard = { solid: [0], wire: [1, 2], cut: [3, 4, 5, 6] };
  PARTS.scoreboard = { board: [0], legs: [1, 2], score: [3, 4, 5, 6] };
}
{
  // Penalty card: one upright card tilted 15°, two short strokes flicking off its side as it is shown.
  const c = [11.25, 12.25];
  const card = tp(sq(c[0] - 4.75, c[1] - 6.75, 9.5, 13.5, 2, BR), 15, c);
  const along = rot([0, 1], [0, 0], 15);
  const out = rot([1, 0], [0, 0], 15);
  const edgeTop = rot([c[0] + 4.75, c[1] - 6.75], c, 15);
  const tick = (t, l) => {
    const p = add2(edgeTop, mul(along, t));
    return line(add2(p, mul(out, 3)), add2(p, mul(out, 3 + l)));
  };
  add('penalty-card', ['tarjeta amarilla', 'tarjeta roja', 'amonestación', 'expulsión', 'yellow card', 'red card', 'booking'], [card, tick(2.75, 2.5), tick(6.25, 2.25)]);
  FILL['penalty-card'] = { solid: [0], lines: [1, 2] };
  PARTS['penalty-card'] = { card: [0], motion: [1, 2] };
  MOTION['penalty-card'] = { effect: 'wiggle', parts: ['card'], origin: [11.25, 19] };
}
{
  // Corner flag: the short flag on its post, the corner arc round its foot and the field's edge.
  const foot = [6, 20.5];
  add('corner-flag', ['banderín de córner', 'tiro de esquina', 'córner', 'corner flag', 'corner kick', 'corner'], [
    vl(6, 3, 20.5),
    hl(20.5, 6, 21.25),
    arc(...foot, 6, -90, 0).d,
    'M6 3C9 2.25 11.5 4.75 15.25 3.5V9.5C11.5 10.75 9 8.25 6 9Z',
  ]);
  FILL['corner-flag'] = { solid: [3], wire: [0, 1, 2] };
  PARTS['corner-flag'] = { post: [0], field: [1, 2], flag: [3] };
  MOTION['corner-flag'] = { effect: 'wiggle', parts: ['flag'], origin: [6, 6] };
}
{
  // Checkered flag: a waving flag on its pole, a grid of three by two inside and its alternate cells
  // marked with dots.
  const [x0, x1, y0, y1] = [4.25, 20.75, 3.25, 15.25];
  const h = (x1 - x0) / 2;
  const top = wave([x0, y0], 2, h, 0.75, -1);
  const back = wave([x1, y1], 2, -h, 0.75, 1).replace(/^M[^C]*/, '');
  const flag = `${top}L${pt([x1, y1])}${back}Z`;
  // The wave's height at x: lugares' cubics peak exactly at a, close to a sine
  const dy = (x) => -0.75 * Math.sin(((x - x0) / h) * Math.PI);
  const cols = [x0 + (x1 - x0) / 3, x0 + (2 * (x1 - x0)) / 3];
  const ym = (y0 + y1) / 2;
  const mid = wave([x0, ym], 2, h, 0.75, -1);
  const cell = (i, j) => {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / 3;
    return dot(x, y0 + ((j + 0.5) * (y1 - y0)) / 2 + dy(x), 0.3);
  };
  add('checkered-flag', ['bandera a cuadros', 'meta', 'carrera ganada', 'automovilismo', 'checkered flag', 'finish', 'race won'], [
    vl(x0, 2.75, 21.25),
    flag,
    ...cols.map((x) => vl(x, y0 + dy(x), y1 + dy(x))),
    mid,
    cell(0, 0),
    cell(2, 0),
    cell(1, 1),
  ]);
  FILL['checkered-flag'] = { solid: [1], wire: [0], cut: [2, 3, 4, 5, 6, 7] };
  PARTS['checkered-flag'] = { pole: [0], flag: [1, 2, 3, 4, 5, 6, 7] };
  MOTION['checkered-flag'] = { effect: 'wiggle', parts: ['flag'], origin: [4.25, 9] };
}

// ── Competition ───────────────────────────────────────────────────────────────────────────────
{
  // Tournament bracket: four entries joined in pairs into two, and those two into the final.
  const pair = (y0, y1) => rl([[2.75, y0], [8.25, y0], [8.25, y1], [2.75, y1]], [0, 0.75, 0.75, 0]);
  add('tournament-bracket', ['llaves del torneo', 'eliminatoria', 'playoffs', 'cuadro', 'tournament bracket', 'knockout', 'playoffs'], [
    pair(3.75, 8.25),
    pair(15.75, 20.25),
    rl([[8.25, 6], [14.25, 6], [14.25, 18], [8.25, 18]], [0, 0.75, 0.75, 0]),
    hl(12, 14.25, 21.25),
  ]);
  FILL['tournament-bracket'] = false;
  PARTS['tournament-bracket'] = { first: [0, 1], semis: [2], final: [3] };
}
{
  // Lineup: the soccer field's halfway line and center circle, and the players as dots in their rows
  // around it: the keeper, two in defense, two in midfield, one in attack. With the halfway line alone,
  // the two halves of dots read as a domino.
  const players = [[5.5, 12], [8.5, 8.25], [8.5, 15.75], [15.5, 8.25], [15.5, 15.75], [18.5, 12]].map((p) => dot(...p, 0.3));
  const LINEUP = [FIELD, vl(12, 5, 9.75), vl(12, 14.25, 19), circ(12, 12, 2.25), ...players];
  add('lineup', ['alineación', 'formación', 'once inicial', 'posiciones', 'lineup', 'formation', 'starting eleven'], LINEUP);
  FILL.lineup = { solid: [0], cut: LINEUP.slice(1).map((_, i) => 1 + i) };
  PARTS.lineup = { field: [0, 1, 2, 3], players: players.map((_, i) => 4 + i) };
}
{
  // Tactics board: the board, an X and an O, and a dashed arrow curving over from one to the other.
  const X = [7.5, 14];
  const O = [16.5, 14];
  const k = 1.25;
  const [c, r, a0, a1] = [[12, 14.25], 6, 225, 310];
  // Two dashes 3 apart (their chord), the arrowhead at the end of the second
  const g = (2 * Math.asin(3 / (2 * r)) * 180) / Math.PI;
  const dash = (a1 - a0 - g) / 2;
  const dashes = [0, 1].map((i) => arc(...c, r, a0 + i * (dash + g), a0 + i * (dash + g) + dash));
  add('tactics-board', ['pizarra táctica', 'jugada', 'estrategia', 'entrenador', 'tactics board', 'playbook', 'game plan'], [
    sq(3.25, 3.25, 17.5, 17.5, 4, BR),
    line(add2(X, [-k, -k]), add2(X, [k, k])),
    line(add2(X, [k, -k]), add2(X, [-k, k])),
    circ(...O, 1.5),
    ...dashes.map((a) => a.d),
    head(dashes[1].end, dashes[1].tangent, 2.5),
  ]);
  FILL['tactics-board'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['tactics-board'] = { board: [0], marks: [1, 2, 3], play: [4, 5, 6] };
}
// The crest: a shield whose top edge dips to a notch in the middle, its sides straight, its foot a point.
const CREST_PTS = [[4.75, 4], [12, 6], [19.25, 4], [19.25, 12], [12, 19.5], [4.75, 12]];
const CREST_R = [1, 1, 1, 2, 1.5, 2];
const CREST = roundpoly(CREST_PTS, CREST_R);
/** The two points where the line through `p` along `u` crosses a polygon's edges, nearest `p` on each side. */
function acrossPoly(p, u, pts) {
  const hits = [];
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const e = sub(b, a);
    const det = u[0] * -e[1] - u[1] * -e[0];
    if (Math.abs(det) < 1e-9) return;
    const w = sub(a, p);
    const t = (w[0] * -e[1] - w[1] * -e[0]) / det;
    const s = (u[0] * w[1] - u[1] * w[0]) / det;
    if (s >= 0 && s <= 1) hits.push(t);
  });
  const lo = Math.max(...hits.filter((t) => t < 0));
  const hi = Math.min(...hits.filter((t) => t > 0));
  return [add2(p, mul(u, lo)), add2(p, mul(u, hi))];
}
{
  // Team crest: the crest and a diagonal band across it, from its upper left to its lower right.
  const u = [Math.SQRT1_2, Math.SQRT1_2];
  const n = [-u[1], u[0]];
  const c = [12, 11.5];
  const band = [1.75, -1.75].map((o) => line(...acrossPoly(add2(c, mul(n, o)), u, CREST_PTS)));
  const d = [CREST, ...band];
  add('team-crest', ['escudo del equipo', 'club', 'equipo', 'escudo', 'team crest', 'club badge', 'team'], d);
  FILL['team-crest'] = { solid: [0], cut: [1, 2] };
  PARTS['team-crest'] = { crest: [0], band: [1, 2] };
}
{
  // Matchup: two small crests side by side and a short slash between them. Each carries the middle of
  // the crest's band as one stroke (the band's two strokes would clog at this size): empty, the small
  // crests read as hearts.
  const band = line(...acrossPoly([12, 11.5], [Math.SQRT1_2, Math.SQRT1_2], CREST_PTS));
  const small = (d, x) => place(d, 0.42, [12, 11.75], [x, 12]);
  add('matchup', ['enfrentamiento', 'versus', 'partido', 'cara a cara', 'matchup', 'versus', 'head to head'], [small(CREST, 5.5), small(band, 5.5), small(CREST, 18.5), small(band, 18.5), line([12.6, 9.75], [11.4, 14.25])]);
  FILL.matchup = { solid: [0, 2], cut: [1, 3], lines: [4] };
  PARTS.matchup = { home: [0, 1], away: [2, 3], versus: [4] };
}
{
  // Match day: calendario's calendar with a ball in its body, the tennis ball's S seam across it.
  const cal = calendario.icons['calendar-blank'];
  const c = [12, 15.375];
  const r = 2.75;
  const [a, b] = [polar(...c, r, -120), polar(...c, r, 60)];
  const ball = [circ(...c, r), `M${pt(a)}C${pt([c[0] + 2.6, c[1] - 1.9])} ${pt([c[0] - 2.6, c[1] + 1.9])} ${pt(b)}`];
  add('calendar-ball', ['día de partido', 'calendario de partidos', 'jornada', 'fixtures', 'match day', 'fixtures', 'game schedule'], [...cal.d, ...ball]);
  FILL['calendar-ball'] = { solid: [0], lines: [1, 2], cut: [3, 4, 5] };
  PARTS['calendar-ball'] = { body: [0], rings: [1, 2], header: [3], ball: [4, 5] };
}
{
  // Pennant: a long triangle on its short stick, a band across it at the hoist.
  const [s0, tip, s1] = [[4.5, 3.75], [21.25, 8.75], [4.5, 13.75]];
  const yAt = (x, a, b) => a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  add('pennant', ['banderín', 'afición', 'equipo', 'recuerdo', 'pennant', 'team spirit', 'fan merch'], [
    vl(4.5, 3, 21.25),
    roundpoly([s0, tip, s1], [0.3, 0.75, 0.3]),
    vl(8, yAt(8, s0, tip), yAt(8, s1, tip)),
  ]);
  FILL.pennant = { solid: [1], wire: [0], cut: [2] };
  PARTS.pennant = { stick: [0], pennant: [1, 2] };
  MOTION.pennant = { effect: 'wiggle', parts: ['pennant'], origin: [4.5, 8.75] };
}
{
  // Foam finger: a big foam hand, its index raised, the knuckles of the folded fingers beside it and
  // the thumb across them, on a wide flat cuff.
  const hand = 'M6.75 16.75V12.25C6.75 11.25 7.25 10.5 8 10V5A2.25 2.25 0 0 1 12.5 5V9.5A1.25 1.25 0 0 1 15 9.75A1.25 1.25 0 0 1 17.5 10.5V16.75';
  add('foam-finger', ['mano de espuma', 'afición', 'porra', 'número uno', 'foam finger', 'fans', 'cheering'], [
    hand,
    hl(13.25, 6.75, 11.5),
    sq(5.25, 16.75, 13.5, 4.5, 1.5),
  ]);
  FILL['foam-finger'] = { solid: [shut(hand), 2], cut: [1] };
  PARTS['foam-finger'] = { hand: [0, 1], cuff: [2] };
  MOTION['foam-finger'] = { effect: 'wiggle', origin: [12, 21] };
}
{
  // Relay torch, held tilted: electrodomesticos' fire (two tips) standing over the wide cup, the
  // tapered handle under it with a band round its grip. Lugares' round flame over the cup read as an
  // ice cream's scoop, upright or tilted.
  const top = 12;
  const T = (d) => tp(d, 18, [12, 14]);
  add('relay-torch', ['antorcha', 'fuego olímpico', 'ceremonia', 'relevo', 'relay torch', 'torch', 'flame'], [
    fire(12, top - 2.75, 8, 8.25),
    roundpoly([[6.75, top], [17.25, top], [15.25, top + 3], [8.75, top + 3]], 0.6),
    roundpoly([[10, top + 3], [14, top + 3], [13.25, 21.25], [10.75, 21.25]], [0, 0, 0.6, 0.6]),
    hl(17.75, 10.2, 13.8),
  ].map(T));
  FILL['relay-torch'] = { solid: [0, 1, 2], cut: [3] };
  PARTS['relay-torch'] = { flame: [0], torch: [1, 2, 3] };
  MOTION['relay-torch'] = { effect: 'wiggle', parts: ['flame'], origin: rot([12, top], [12, 14], 18) };
}
{
  // Hurdle: the striped top board on two uprights, each ending in a long foot pointing back toward the
  // runner (short feet and a plain board read as a table).
  add('hurdle', ['valla', 'carrera de vallas', 'atletismo', 'hurdle', 'hurdles', 'track and field'], [
    capsule(5.25, 5, 16.5, 3.5),
    vl(11, 5, 8.5),
    vl(16.25, 5, 8.5),
    rl([[7.75, 8.5], [7.75, 20.75], [2.75, 20.75]], [0, 0.6, 0]),
    rl([[19.25, 8.5], [19.25, 20.75], [14.25, 20.75]], [0, 0.6, 0]),
  ]);
  FILL.hurdle = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS.hurdle = { board: [0, 1, 2], legs: [3, 4] };
}





// ── The players ───────────────────────────────────────────────────────────────────────────────
// The set's whole figure as fitness poses it: the head a circle of r 1.9 standing 2.35 clear of the
// shoulders, the torso one stroke from the shoulders to the hips (5.5), each limb one stroke rounded at
// its joint (thigh and shin about 4, upper arm 3.5, forearm 3); in profile it faces right. One figure
// per icon, and the equipment tells the sport.
const HR = 1.9;
const GAP = 2.35;
/** The head's center, `hr + gap` from the shoulders at `a` degrees (0 = right, -90 = up). */
const headAt = (S, a, hr = HR, gap = GAP) => go(S, a, hr + gap);
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
function pose({ P, torso, head: ha = torso[1], legs = [], arms = [], k = 1, hr = Math.max(1.35, HR * k), gap = GAP }) {
  const S = go(P, torso[1], torso[0] * k);
  return { P, S, H: headAt(S, ha, hr, gap), hr, legs: legs.map((l) => chain(P, l, k)), arms: arms.map((a) => chain(S, a, k)) };
}
const figParts = (nLegs, nArms, extra = {}) => ({
  head: [0],
  body: [1],
  ...(nLegs && { legs: Array.from({ length: nLegs }, (_, i) => 2 + i) }),
  ...(nArms && { arms: Array.from({ length: nArms }, (_, i) => 2 + nLegs + i) }),
  ...extra,
});
const FIGURE = ['head', 'body', 'legs', 'arms'];
/** Two limbs that leave one joint as one stroke through it: three strokes meeting at a point left a sliver there at light weights. */
const through = (pair) => (pair.length === 2 ? [[...[...pair[0]].reverse(), ...pair[1].slice(1)]] : pair);
/** Adds a figure with its gear: `gear` strokes after the figure, `solidGear` its closed pieces (by index into gear). */
function player(name, tags, fig, gear = [], { solidGear = [], cutGear = [], extra = {} } = {}) {
  fig = { ...fig, legs: through(fig.legs), arms: through(fig.arms) };
  const d = [...figure(fig), ...gear];
  const n = d.length - gear.length;
  const g = (ix) => ix.map((i) => n + i);
  add(name, tags, d);
  const wire = d.map((_, i) => i).filter((i) => i > 0 && !g(solidGear).includes(i) && !g(cutGear).includes(i));
  FILL[name] = { solid: [0, ...g(solidGear)], wire, ...(cutGear.length && { cut: g(cutGear) }) };
  PARTS[name] = { ...figParts(fig.legs.length, fig.arms.length), ...extra };
  return n;
}
{
  // Hurdles: the runner over a low hurdle, leaning into it, the lead leg straight out over the board,
  // the trail leg folded behind, the lead arm reaching forward.
  const fig = pose({
    P: [8.75, 11.75],
    torso: [5.25, -52],
    head: -58,
    legs: [[[8, 10]], [[4, 160], [3.5, 230]]],
    arms: [[[3.5, 30], [3, 12]], [[3.5, 175], [3, 225]]],
  });
  const n = player('hurdling', ['carrera de vallas', 'vallas', 'atletismo', 'hurdling', 'hurdles', 'track'], fig, [
    capsule(10.5, 16, 10, 2.75),
    rl([[13, 18.75], [13, 21.25], [10.5, 21.25]], [0, 0.6, 0]),
    rl([[18.5, 18.75], [18.5, 21.25], [16, 21.25]], [0, 0.6, 0]),
  ], { solidGear: [0] });
  PARTS.hurdling.hurdle = [n, n + 1, n + 2];
  MOTION.hurdling = { effect: 'slide', parts: FIGURE, vector: [1.5, 0] };
}
{
  // Playing soccer: the kicking leg swung forward, its foot meeting the ball, the arms out for balance.
  const fig = pose({
    P: [9.5, 13.25],
    torso: [5.5, -80],
    head: -75,
    k: 0.9,
    legs: [[[4.25, 100], [4.5, 95]], [[4, 35], [3.75, 15]]],
    arms: [[[3.5, 160], [3, 210]], [[3.5, 25], [3, -20]]],
  });
  const foot = fig.legs[1][2];
  const ball = circ(foot[0] + 2, foot[1] + 0.5, 2);
  const n = player('soccer-player', ['jugar fútbol', 'futbolista', 'patear', 'soccer player', 'playing soccer', 'kick'], fig, [ball], { solidGear: [0] });
  PARTS['soccer-player'].ball = [n];
  MOTION['soccer-player'] = { effect: 'slide', parts: ['ball'], vector: [1.5, 0] };
}
{
  // Goalkeeper: leaping up across the goal, the body stretched out on the rise and the leg trailing,
  // the arms reaching ahead (one stroke in profile; two arms closed a hole between them at bold) to
  // the ball at the fingertips, the head over the shoulders. The ball carries its seam: plain, it read
  // as a second head, and the head under the arm was lost in the line of the body.
  const P = [8, 17];
  const S = go(P, -45, 5.5);
  const hand = go(S, -50, 5);
  const fig = { H: headAt(S, -140), S, P, legs: [chain(P, [[4, 165], [3.5, 120]])], arms: [[S, hand]] };
  const n = player('goalkeeper', ['portero', 'arquero', 'atajada', 'goalkeeper', 'keeper', 'save'], fig, seamBall(go(hand, -50, 2.65), 2.5), { solidGear: [0], cutGear: [1] });
  PARTS.goalkeeper.ball = [n, n + 1];
}
{
  // Playing basketball: jumping, the knees bent up, the head tipped back, the shooting arm raised
  // forward and the ball over the hand with its seam (beside a head looking ahead, and plain, the
  // ball read as a second head).
  const k = 0.85;
  const fig = pose({
    P: [9.75, 16],
    torso: [5.5, -86],
    head: -122,
    k,
    legs: [[[4, 115], [3.75, 160]], [[4, 65], [3.5, 110]]],
    arms: [[[3.5, -32], [3, -70]], [[3.5, 150], [3, 105]]],
  });
  const hand = fig.arms[0][2];
  const n = player('basketball-player', ['jugar basquetbol', 'basquetbolista', 'tirar a la canasta', 'basketball player', 'shooting', 'jump shot'], fig, seamBall(go(hand, -60, 2.65), 2.4), { solidGear: [0], cutGear: [1] });
  PARTS['basketball-player'].ball = [n, n + 1];
  MOTION['basketball-player'] = { effect: 'bounce', parts: FIGURE, vector: [0, -1.25] };
}
{
  // Playing tennis: stretching up to serve, the racket raised over the head and forward, the ball
  // tossed high above them.
  const k = 0.85;
  const fig = pose({
    P: [9, 15.5],
    torso: [5.5, -95],
    head: -115,
    k,
    legs: [[[4, 72], [3.75, 100]], [[4, 115], [3.75, 125]]],
    arms: [[[3.5, -40], [3, -60]], [[3.5, 165], [3, 125]]],
  });
  const hand = fig.arms[0][2];
  const dir = -20;
  const c = go(hand, dir, 4.4);
  const racket = [line(hand, go(hand, dir, 2.25)), tp(ellipse(c, 1.6, 2.15), dir + 90, c)];
  const n = player('tennis-player', ['jugar tenis', 'tenista', 'saque', 'tennis player', 'serve', 'playing tennis'], fig, [...racket, dot(10.75, 3.25)], { solidGear: [1, 2] });
  PARTS['tennis-player'].racket = [n, n + 1];
  PARTS['tennis-player'].ball = [n + 2];
}
{
  // Batting: the stance side on, the feet apart and the knees a little bent, the hands at the back
  // shoulder and the bat cocked up and back over it, the pitch coming in (alone, the raised bat read
  // as a figure brandishing a stick).
  const P = [11.25, 14];
  const S = [11.5, 8.5];
  const hands = [8.75, 9.75];
  const fig = { H: headAt(S, -85), S, P, legs: [[[7.75, 21.25], [8.5, 17.25], P, [14.75, 17.25], [15.25, 21.25]]], arms: [[S, [9.75, 11.5], hands]] };
  const n = player('baseball-player', ['batear', 'bateador', 'béisbol', 'baseball player', 'batter', 'batting'], fig, [line(hands, go(hands, -122, 8)), circ(19, 11.5, 1.6)], { solidGear: [1] });
  PARTS['baseball-player'].bat = [n];
  PARTS['baseball-player'].ball = [n + 1];
  MOTION['baseball-player'] = { effect: 'wiggle', parts: ['arms', 'bat'], origin: hands };
}
{
  // Playing hockey: leaning forward on bent knees, the stick down to the ice, its blade flat on it
  // and pointing back as the hockey stick's, the puck on the ice ahead of the heel (held over the
  // blade, it read as a box being pushed).
  const fig = pose({
    P: [7.25, 12.75],
    torso: [5.5, -38],
    head: -25,
    legs: [[[4, 80], [4.25, 130]], [[4, 40], [4, 95]]],
    arms: [[[3.5, 50], [3, 70]]],
  });
  const hand = fig.arms[0][2];
  const heel = [15.5, 20.5];
  const n = player('hockey-player', ['jugar hockey', 'jugador de hockey', 'hockey sobre hielo', 'hockey player', 'ice hockey', 'playing hockey'], fig, [line(go(hand, -110, 1.5), heel, [12.75, 20.5]), sq(18.35, 17.75, 3.4, 2.75, 1.1)], { solidGear: [1] });
  PARTS['hockey-player'].stick = [n];
  PARTS['hockey-player'].puck = [n + 1];
}
{
  // Downhill skiing: crouched on the skis down a slope, the poles trailing back from the hands.
  const deg0 = 18;
  const fig = pose({
    P: [8.75, 11.75],
    torso: [5.5, -45],
    head: -25,
    legs: [[[4, 55], [4, 120]]],
    arms: [[[3.5, 75], [2.5, 20]]],
  });
  const foot = fig.legs[0][2];
  const u = [Math.cos(rad(deg0)), Math.sin(rad(deg0))];
  const ski = sub(foot, mul(u, 6.25));
  const tipEnd = add2(foot, mul(u, 6));
  const hand = fig.arms[0][2];
  const n = player('skiing', ['esquí', 'esquiar', 'esquí alpino', 'skiing', 'downhill', 'ski trip'], fig, [
    `M${pt(ski)}L${pt(tipEnd)}A1.5 1.5 0 0 0 ${pt(add2(tipEnd, rot(mul(u, 1.5), [0, 0], -90)))}`,
    line(hand, go(hand, 160, 8)),
  ]);
  PARTS.skiing.skis = [n];
  PARTS.skiing.poles = [n + 1];
  MOTION.skiing = { effect: 'slide', vector: [1.5, 0.5] };
}
{
  // Snowboarding: side on to the board, the knees bent and the arms out for balance, the board tilted
  // under both feet.
  const k = 0.85;
  const [b0, b1, br] = [[4.25, 20.25], [19.75, 16.75], 1.25];
  const u = unit(sub(b1, b0));
  const n0 = [u[1], -u[0]];
  const top = (x) => add2(add2(b0, mul(u, (x - b0[0]) / u[0])), mul(n0, br));
  const P = [12, 12.5];
  const S = [12, P[1] - 5.5 * k];
  const hr = HR * k;
  const fig = {
    H: [12, S[1] - hr - GAP],
    hr,
    S,
    P,
    legs: [[top(8.75), [9.5, 15.75], P, [14.75, 15.25], top(15.25)]],
    arms: [[[4.75, 9.75], [7.5, 8.5], S, [16.5, 8.5], [19.25, 9.75]]],
  };
  const n = player('snowboarding', ['snowboard', 'tabla de nieve', 'deportes de invierno', 'snowboarding', 'snowboard', 'winter sports'], fig, [bar(b0, b1, br)], { solidGear: [0] });
  PARTS.snowboarding.board = [n];
}
{
  // Surfing: crouched low on the board, the arms out, the board riding the face of the wave as it rises
  // to its crest and curls over at the right.
  const [b0, b1, br] = [[3.5, 17], [14.5, 14.5], 1.25];
  const u = unit(sub(b1, b0));
  const n0 = [u[1], -u[0]];
  const top = (x) => add2(add2(b0, mul(u, (x - b0[0]) / u[0])), mul(n0, br));
  const P = [9.25, 11]
  const S = go(P, -65, 4);
  const fig = { H: headAt(S, -75, 1.6), hr: 1.6, S, P, legs: [[top(6), [6.75, 12], P, [12.25, 11.25], top(11.75)]], arms: [[[3.5, 8.5], [6.5, 8], S, [14.75, 7.75], [17.25, 9.25]]] };
  const n = player('surfing', ['surf', 'surfear', 'ola', 'surfing', 'surf', 'wave'], fig, [
    bar(b0, b1, br),
    'M2.25 21.25C9 21.25 14.5 20.25 17.5 16.25C18.75 14.5 20.75 14.5 21.75 16.5',
  ], { solidGear: [0] });
  PARTS.surfing.board = [n];
  PARTS.surfing.wave = [n + 1];
}
{
  // Windsurfing: on the board, leaning back and holding the boom of the sail, the triangular sail
  // rising from the mast at the board's middle.
  const fig = pose({
    P: [15.5, 13.25],
    torso: [5, -80],
    head: -70,
    k: 0.9,
    legs: [],
    arms: [[[3, 200], [2.75, 185]]],
  });
  // The feet stand on the board's top
  fig.legs = [[fig.P, go(fig.P, 120, 3.15), [13.25, 20.5]], [fig.P, go(fig.P, 70, 3.15), [17.75, 20.5]]];
  const hand = fig.arms[0][2];
  const n = player('windsurfing', ['windsurf', 'tabla vela', 'viento', 'windsurfing', 'sailboard', 'windsurf'], fig, [
    roundpoly([[9.25, 2.75], [9.25, 17], [3, 17]], [0.6, 0.4, 0.75]),
    line([9.25, hand[1]], hand),
    hl(20.5, 2.75, 21.25),
  ], { solidGear: [0] });
  PARTS.windsurfing.sail = [n, n + 1];
  PARTS.windsurfing.board = [n + 2];
}
{
  // Skateboarding: standing side on on the skateboard, front on to us, the knees bent and the arms out.
  // The wheels 3 under the deck: dots any closer met it at bold and not at regular.
  const k = 0.85;
  const cx = 12;
  const P = [cx, 12.75];
  const S = [cx, P[1] - 5.5 * k];
  const hr = HR * k;
  const fig = { H: [cx, S[1] - hr - GAP], hr, S, P, legs: [[[cx - 3.5, 17.5], [cx - 2.5, 15.25], P, [cx + 2.5, 15.25], [cx + 3.5, 17.5]]], arms: [[[cx - 6.5, 9.25], S, [cx + 6.5, 9.25]]] };
  const n = player('skateboarding', ['patinar', 'skate', 'patinetero', 'skateboarding', 'skater', 'street skating'], fig, [
    rl([[3, 16], [4.75, 17.5], [19.25, 17.5], [21, 16]], [0, 0.75, 0.75, 0]),
    dot(7.5, 20.5),
    dot(16.5, 20.5),
  ], { solidGear: [1, 2] });
  PARTS.skateboarding.board = [n, n + 1, n + 2];
}
{
  // Ice skating: gliding on one skate, the other leg stretched out behind, the arms open.
  const fig = pose({
    P: [11, 12.25],
    torso: [5.25, -60],
    head: -45,
    legs: [[[4, 95], [4, 90]], [[4.25, 175], [4, 165]]],
    arms: [[[3.5, -25], [3, -10]], [[3.5, 200], [3, 220]]],
  });
  const foot = fig.legs[0][2];
  const n = player('ice-skating', ['patinaje sobre hielo', 'patinaje artístico', 'pista de hielo', 'ice skating', 'figure skating', 'skater'], fig, [`M${pt([foot[0] - 3, foot[1] + 0.25])}H${f(foot[0] + 2.25)}A1.25 1.25 0 0 0 ${pt([foot[0] + 3.5, foot[1] - 1])}`]);
  PARTS['ice-skating'].blade = [n];
  MOTION['ice-skating'] = { effect: 'slide', vector: [1.5, 0] };
}
{
  // Gymnastics: a split leap, the legs flung out fore and aft and dipping a little at the feet, the
  // arms raised in a V. Level legs as long as the canvas read as a bar the figure stood behind, and
  // tilted, as a slope.
  const fig = pose({
    P: [12, 17],
    torso: [5.5, -90],
    head: -90,
    legs: [[[6.75, 8]], [[6.75, 172]]],
    arms: [[[3.5, -15], [3, -60]], [[3.5, -165], [3, -120]]],
  });
  player('gymnastics', ['gimnasia', 'gimnasia artística', 'salto', 'gymnastics', 'gymnast', 'split leap'], fig);
  MOTION.gymnastics = { effect: 'bounce', vector: [0, -1.5] };
}
{
  // Martial arts: a high side kick, the kicking leg straight out at head height, the body leaning
  // away, the fist up on guard (a belt across the waist had no room between the legs and the guard).
  const fig = pose({
    P: [10, 13.5],
    torso: [5.5, -120],
    head: -112,
    legs: [[[4, 115], [4, 95]], [[8.75, -8]]],
    arms: [[[3, -30], [2.75, -62]]],
  });
  player('martial-arts', ['artes marciales', 'karate', 'taekwondo', 'patada', 'martial arts', 'karate', 'kickboxing'], fig);
  MOTION['martial-arts'] = { effect: 'wiggle', parts: FIGURE, origin: [8.75, 21.25] };
}

{
  // Horse riding: the horse in profile, its neck raised and its head forward, four legs and the tail,
  // and the rider seated on its back as part of one silhouette, the hands on the reins at the neck.
  const horse = 'M6 12.5L14 12.25C15.5 12.25 16.5 9.5 17.75 7.75L18.5 7.25L21.25 10.25C21.5 10.75 21.25 11.5 20.75 11.5L18.75 11.25C17.75 12 17.25 13 17 14.75C16.75 16.25 15.75 16.5 14.5 16.5H8C5.5 16.5 4.25 15 4.25 13.75C4.25 13 5 12.5 6 12.5Z';
  const k = 0.75;
  const P = [10.25, 12.37];
  const S = go(P, -84, 5.5 * k);
  const hr = Math.max(1.35, HR * k);
  const rein = [15.97, 10.66];
  const d = [
    horse,
    line([16, 16.25], [16.5, 21.25]),
    rl([[13.25, 16.5], [12.5, 18.75], [13.25, 21.25]], 0.6),
    line([9.25, 16.5], [8.75, 21.25]),
    rl([[6.25, 16.1], [5, 18.5], [5.75, 21.25]], 0.6),
    'M4.4 13.4C3.25 14 2.5 15.25 2.5 16.5',
    circ(...headAt(S, -88, hr), hr),
    line(S, P),
    line(S, rein),
  ];
  add('horse-riding', ['equitación', 'montar a caballo', 'salto ecuestre', 'horse riding', 'equestrian', 'show jumping'], d);
  FILL['horse-riding'] = { solid: [0, 6], wire: [1, 2, 3, 4, 5, 7, 8] };
  PARTS['horse-riding'] = { horse: [0, 1, 2, 3, 4, 5], rider: [6, 7, 8] };
  MOTION['horse-riding'] = { effect: 'bounce', vector: [0, -1.25] };
}
{
  // Wheelchair basketball: accesibilidad's rider (the head ahead of the body, the torso leaning
  // forward, the leg as one stroke, the wheel an arc open where the body leaves it) at 80 %, the arm
  // raised up and back and the ball over the hand (raised beside the head, the ball read as a second
  // head).
  const segDist = (p, a, b) => {
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
    return len(sub(p, add2(a, mul(ab, t))));
  };
  const polyDist = (p, pts) => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));
  const RIDE = { hub: [9, 16.25], R: 5.25, hip: [9.5, 12.75], neck: [12, 8], knee: [16.25, 12.75], foot: [18, 18.25], toe: [20, 18.25] };
  const s0 = 0.72;
  const hub = [8.25, 21.25 - RIDE.R * s0];
  const at = (p) => add2(hub, mul(sub(p, RIDE.hub), s0));
  const R0 = RIDE.R * s0;
  const [hip, neck] = [at(RIDE.hip), at(RIDE.neck)];
  let [knee, foot, toe] = [at(RIDE.knee), at(RIDE.foot), at(RIDE.toe)];
  // The shin stands 3.1 clear of the wheel's front, as accesibilidad pushes it
  const front = [hub[0] + R0, hub[1]];
  let push = 0;
  while (segDist(front, [knee[0] + push, knee[1]], [foot[0] + push, foot[1]]) < 3.1) push += 0.05;
  [knee, foot, toe] = [knee, foot, toe].map((q) => [q[0] + push, q[1]]);
  const rh = 1.35;
  const hc = add2(neck, mul(unit(sub(neck, hip)), rh + 2.95));
  const shoulder = lerp(hip, neck, 0.72);
  const hand = go(shoulder, -120, 5);
  const body = [neck, hip, knee, foot, toe];
  const clear = (a) => {
    const q = polar(...hub, R0, a);
    return polyDist(q, body) >= 3.05 && segDist(q, shoulder, hand) >= 3.05 && len(sub(q, hc)) - rh >= 2.95;
  };
  let a0 = 90;
  while (a0 > -90 && clear(a0 - 0.5)) a0 -= 0.5;
  let a1 = 90;
  while (a1 < 270 && clear(a1 + 0.5)) a1 += 0.5;
  const ball = seamBall(go(hand, -115, 2.5), 2.25);
  add('wheelchair-basketball', ['básquetbol en silla de ruedas', 'deporte adaptado', 'paralímpico', 'wheelchair basketball', 'para sports', 'adaptive sports'], [
    circ(...hc, rh),
    rl(body, [0, 0.6, 0.75, 0.5, 0]),
    line(shoulder, hand),
    arc(...hub, R0, a0, a1).d,
    ...ball,
  ]);
  FILL['wheelchair-basketball'] = { solid: [0, 4], wire: [1, 2, 3], cut: [5] };
  PARTS['wheelchair-basketball'] = { head: [0], body: [1, 2], wheel: [3], ball: [4, 5] };
  MOTION['wheelchair-basketball'] = { effect: 'bounce', parts: ['ball'], vector: [0, -1.5] };
}
{
  // Parachute: the dome of the canopy, its scalloped hem, the lines from it to the jumper's raised
  // hands, the jumper small below it.
  const hem = [3, 8.5, 15.5, 21];
  const y0 = 7.5;
  let canopy = `M${pt([3, y0])}A9 4.75 0 0 1 ${pt([21, y0])}`;
  for (let i = 3; i > 0; i--) canopy += arc3To([hem[i], y0], [(hem[i] + hem[i - 1]) / 2, y0 - 1], [hem[i - 1], y0]);
  canopy += 'Z';
  const k = 0.6;
  const P = [12, 18.25];
  const S = [12, P[1] - 5.5 * k];
  const hr = 1.35;
  const hands = [[8, 14.25], [16, 14.25]];
  const fig = { H: [12, S[1] - hr - GAP], hr, S, P, legs: [[[11, 21.25], P, [13, 21.25]]], arms: [[hands[0], S, hands[1]]] };
  const d = [...figure(fig), canopy, line([3, y0], hands[0]), line([8.5, y0], hands[0]), line([15.5, y0], hands[1]), line([21, y0], hands[1])];
  add('parachute', ['paracaídas', 'paracaidismo', 'salto', 'parachute', 'skydiving', 'jump'], d);
  FILL.parachute = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7, 8] };
  PARTS.parachute = { head: [0], body: [1], legs: [2], arms: [3], canopy: [4], lines: [5, 6, 7, 8] };
  MOTION.parachute = { effect: 'float', vector: [0, 1.5] };
}

// ── Motorsport ────────────────────────────────────────────────────────────────────────────────
{
  // Race car, open wheel, in profile: the long low body resting on its exposed wheels, low at the
  // nose, the driver's helmet a dome over the cockpit and the rear wing on its strut. With the wheels
  // in front of the body, their clearance ate the body and it read as a tractor; behind it, as a
  // bumper car.
  const rear = [6.25, 18.5];
  const front = [17, 19];
  const [rr, fr] = [2.5, 2];
  const t0 = [rear[0], rear[1] - rr];
  const t1 = [front[0], front[1] - fr];
  const slope = (t1[1] - t0[1]) / (t1[0] - t0[0]);
  const yb = (x) => t0[1] + (x - t0[0]) * slope;
  const body = roundpoly([[2.75, yb(2.75)], [21.5, yb(21.5)], [21.25, yb(21.5) - 1.5], [13.75, 13.25], [2.75, 12.75]], [0.6, 0.6, 0.6, 1.5, 0.6]);
  // The dome stands on the cockpit's top edge (the line from 2.75 to 13.75 rises 0.5)
  const top = (x) => 12.75 + ((x - 2.75) / 11) * 0.5;
  const dome = `M${pt([8.75, top(8.75)])}A1.75 1.75 0 0 1 ${pt([12.25, top(12.25)])}`;
  add('race-car', ['auto de carreras', 'fórmula 1', 'automovilismo', 'race car', 'formula racing', 'motorsport'], [body, circ(...rear, rr), circ(...front, fr), dome, vl(4.25, top(4.25), 8.5), hl(8.5, 2.25, 6.5)]);
  FILL['race-car'] = { solid: [0, 1, 2, shut(dome)], wire: [4, 5] };
  PARTS['race-car'] = { body: [0], wheels: [1, 2], driver: [3], wing: [4, 5] };
  MOTION['race-car'] = { effect: 'slide', vector: [2, 0] };
}
{
  // Go-kart, in profile: the low frame resting on its small wheels, the seat's back, the steering
  // column and its wheel, and the helmeted driver seated on the frame, the arms out to the wheel (the
  // legs, under the column, closed small holes at bold).
  const k = 0.8;
  const P = [8.25, 16.75];
  const S = go(P, -100, 5.5 * k);
  const hr = 1.6;
  const grip = [13.25, 11.25];
  const base = [17.75, 16.75];
  const u = unit(sub(grip, base));
  const fig = { H: headAt(S, -95, hr), hr, S, P, legs: [], arms: [[S, grip]] };
  const n = player('go-kart', ['go kart', 'karting', 'pista de karts', 'go-kart', 'kart', 'karting'], fig, [
    hl(16.75, 5.25, 17.75),
    line([5.25, 16.75], [4.25, 12.5]),
    line(base, grip),
    line(go(grip, deg(u) - 90, 1.15), go(grip, deg(u) + 90, 1.15)),
    circ(6.25, 18.75, 2),
    circ(17.75, 18.75, 2),
  ], { solidGear: [4, 5] });
  PARTS['go-kart'].kart = [n, n + 1, n + 2, n + 3];
  PARTS['go-kart'].wheels = [n + 4, n + 5];
  MOTION['go-kart'] = { effect: 'slide', vector: [2, 0] };
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
// pieces through pixel centers (0.75 + 1.5k) with fewer of them: a pixel apart at least.
{
  // Soccer goal: the frame and a mesh of half as many lines
  const frame = rl([[3.75, 19.5], [3.75, 5.25], [20.25, 5.25], [20.25, 19.5]], [0, 0.75, 0.75, 0]);
  const net = mesh([3.75, 5.25, 20.25, 19.5], 9.5, [12, 9.75]);
  icons['soccer-goal'].small = { d: [frame, ...net] };
}
{
  // Pickleball: the ball and five holes, the center and four around it, on pixel centers
  const ball = circ(12, 12, 9.75);
  const holes = [[12, 12], [12, 6.75], [12, 17.25], [6.75, 12], [17.25, 12]].map((p) => dot(...p));
  icons.pickleball.small = { d: [ball, ...holes], fill: { solid: [ball], cut: holes } };
}

// Mirror: the figures in profile and whatever moves toward one side (fitness' rule: front views keep
// their side, and so do the objects that only stand: the rackets, the helmets, the boots at rest)
for (const name of [
  'hockey-puck', 'curling-stone', 'ice-skate', 'roller-skate', 'skateboard',
  'hurdling', 'soccer-player', 'goalkeeper', 'basketball-player', 'tennis-player', 'baseball-player', 'hockey-player',
  'skiing', 'surfing', 'windsurfing', 'ice-skating', 'gymnastics', 'martial-arts', 'horse-riding', 'wheelchair-basketball',
  'race-car', 'go-kart',
])
  icons[name].mirror = true;

// Variants: the balls are already round, so they skip the circle
for (const name of ['soccer-ball', 'basketball', 'baseball', 'tennis-ball', 'volleyball', 'bowling-ball', 'billiard-ball', 'pickleball']) icons[name].variants = { circle: false };
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };

export default { category: 'deportes', label: 'Deportes', icons };
