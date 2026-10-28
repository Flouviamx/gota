// Accessibility: wheelchair users in motion, accessible places and equipment, prosthetics, low
// vision and blindness, hearing and deafness, sign language, cognitive accessibility, and the
// settings and audits that make an interface accessible. Everything is computed with the engine
// (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a
// square bottom-right corner on containers. The category adopts sistema's `accessibility` and
// `wheelchair` (drawn there, never redrawn here).
//
// The rider: every wheelchair-* icon (and the accessible entrance and parking bay) shares one
// active figure, the Accessible Icon Project's idea drawn as Gota strokes: the head ahead of the
// body, the torso leaning forward, the arm swept back toward the rim, the thigh, shin and foot as
// one stroke, and the wheel an arc open at the front, where the leg leaves it. The wheel's ends are
// computed, never trimmed: each one stops where the arc would come within 3 (center to center) of
// the body or the head. Badges are the engine's; a piece on top of another (a pointer over a
// microphone, a figure over a file) is a custom badge and the engine clears what it covers.
import { arc, badge, circ, cursor, dot, f, flipPath, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import bienesRaices from './bienes-raices.mjs';
import comunicacion from './comunicacion.mjs';
import controles from './controles.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import hogar from './hogar.mjs';
import lugares from './lugares.mjs';
import mascotas from './mascotas.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';
import ventanas from './ventanas.mjs';

const N = nucleo.icons;
const L = lugares.icons;
const S = sistema.icons;

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

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rline(pts, radius = 0) {
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
    const S0 = add2(V, mul(u, t));
    const E = add2(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S0)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    const R = halfChord([x, y + r], [x + w, y + r]);
    return `M${pt([x, y + r])}A${R} ${R} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${R} ${R} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  const R = halfChord([x + r, y], [x + r, y + h]);
  return `M${pt([x + r, y])}H${f(x + w - r)}A${R} ${R} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${R} ${R} 0 0 1 ${pt([x + r, y])}Z`;
}

/** Just the A command of an engine arc(), to chain it after another path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]+/, '');

/** A path scaled by `s` around `o` and moved so that `o` lands on `at`. */
const xf = (d, s, o, at = o) => transform(d, s, at[0] - o[0] * s, at[1] - o[1] * s);
/** The same for a point. */
const xp = (p, s, o, at = o) => [at[0] + (p[0] - o[0]) * s, at[1] + (p[1] - o[1]) * s];

/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/**
 * The same open path, out and back: it looks identical but encloses no area. As a custom badge's
 * `knock` it clears a line with round caps (the engine clears it with the stroke + 3).
 */
function trace(d) {
  const abs = transform(d, 1, 0, 0);
  const tk = abs.match(/[MLHVCQAZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
  const subs = [];
  let cur = null;
  let p = [0, 0];
  let i = 0;
  let cmd = '';
  const n = () => Number(tk[i++]);
  while (i < tk.length) {
    if (/[A-Z]/i.test(tk[i])) cmd = tk[i++].toUpperCase();
    if (cmd === 'Z') {
      if (cur) cur.closed = true;
      continue;
    }
    if (cmd === 'M') {
      p = [n(), n()];
      cur = { start: p, segs: [], closed: false };
      subs.push(cur);
      cmd = 'L';
      continue;
    }
    const from = p;
    if (cmd === 'L') p = [n(), n()];
    else if (cmd === 'H') p = [n(), p[1]];
    else if (cmd === 'V') p = [p[0], n()];
    if (cmd === 'L' || cmd === 'H' || cmd === 'V') cur.segs.push({ c: 'L', from, to: p });
    else if (cmd === 'C') {
      const [c1, c2] = [[n(), n()], [n(), n()]];
      p = [n(), n()];
      cur.segs.push({ c: 'C', from, c1, c2, to: p });
    } else if (cmd === 'Q') {
      const c1 = [n(), n()];
      p = [n(), n()];
      cur.segs.push({ c: 'Q', from, c1, to: p });
    } else if (cmd === 'A') {
      const a = [n(), n(), n(), n(), n()];
      p = [n(), n()];
      cur.segs.push({ c: 'A', from, a, to: p });
    }
  }
  const fw = (s) => (s.c === 'L' ? `L${pt(s.to)}` : s.c === 'C' ? `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.to)}` : s.c === 'Q' ? `Q${pt(s.c1)} ${pt(s.to)}` : `A${s.a[0]} ${s.a[1]} ${s.a[2]} ${s.a[3]} ${s.a[4]} ${pt(s.to)}`);
  const bw = (s) => (s.c === 'L' ? `L${pt(s.from)}` : s.c === 'C' ? `C${pt(s.c2)} ${pt(s.c1)} ${pt(s.from)}` : s.c === 'Q' ? `Q${pt(s.c1)} ${pt(s.from)}` : `A${s.a[0]} ${s.a[1]} ${s.a[2]} ${s.a[3]} ${s.a[4] ? 0 : 1} ${pt(s.from)}`);
  return subs.map((s) => (s.closed ? `M${pt(s.start)}${s.segs.map(fw).join('')}Z` : `M${pt(s.start)}${s.segs.map(fw).join('')}${s.segs.toReversed().map(bw).join('')}Z`)).join('');
}

/** Custom badge: what's drawn on top, the area the engine clears and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/** Distance from p to the segment ab. */
function segDist(p, a, b) {
  const v = sub(b, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1] || 1)));
  return len(sub(p, add2(a, mul(v, t))));
}
/** Distance from p to a polyline. */
const polyDist = (p, pts) => Math.min(...pts.slice(1).map((b, i) => segDist(p, pts[i], b)));

// ── The rider ─────────────────────────────────────────────────────────────────────────────────
// The active figure, facing right. The torso runs from the hip up to the neck, leaning forward; the
// arm leaves it below the neck, swept back and down toward the rim; the thigh, shin and foot are
// one stroke with the torso. The head sits ahead on the torso's line, 3 (center to center) past the
// neck; the wheel (hub, R) is the arc around the bottom whose ends stop 3 from the body and the arm.
function rider({ hub, R, hip, neck, hand, knee, foot, toe, arm = 0.72, rh = 1.6, gap = 3.05, headGap = 2.95, joints = [0, 0.6, 0.75, 0.5, 0], armless = false, avoid = [] }) {
  const u = unit(sub(neck, hip));
  const hc = add2(neck, mul(u, rh + headGap));
  const shoulder = lerp(hip, neck, arm);
  const body = [neck, hip, knee, foot, toe];
  const clear = (a) => {
    const q = polar(...hub, R, a);
    return polyDist(q, body) >= gap && (armless || segDist(q, shoulder, hand) >= gap) && len(sub(q, hc)) - rh >= gap && avoid.every((pts) => polyDist(q, pts) >= gap);
  };
  let a0 = 90;
  while (a0 > -90 && clear(a0 - 0.5)) a0 -= 0.5;
  let a1 = 90;
  while (a1 < 270 && clear(a1 + 0.5)) a1 += 0.5;
  return { head: circ(...hc, rh), body: rline(body, joints), arm: line(shoulder, hand), wheel: arc(...hub, R, a0, a1).d, hc, rh, hub, R, hand, toe };
}
// The full figure: wheel r 5.25 at the bottom left, open from the back of the head to the front of
// the knee; the head at the top right and the toe at 20
const RIDE = { hub: [9, 16.25], R: 5.25, hip: [9.5, 12.75], neck: [12, 8], hand: [6.5, 10.25], knee: [16.25, 12.75], foot: [18, 18.25], toe: [20, 18.25] };
/**
 * The rider scaled by `s` about `o`, moved so `o` lands on `at` and turned `deg` about it. The head
 * and the gaps keep their size, so a smaller rider moves its knee, shin and foot forward until the
 * shin stands 3 clear of the wheel's front, and its hand back until it stands 3 clear of its rim:
 * the wheel stays open by the same angle at every size.
 */
function riderAt(s, o, at, { deg = 0, floor, ...extra } = {}) {
  const k = Object.fromEntries(Object.entries(RIDE).map(([key, v]) => [key, key === 'R' ? v * s : xp(v, s, o, at)]));
  // In the figure's own frame (before turning): push the leg forward and the hand back
  const front = [k.hub[0] + k.R, k.hub[1]];
  const dShin = (shift) => segDist(front, [k.knee[0] + shift, k.knee[1]], [k.foot[0] + shift, k.foot[1]]);
  let push = 0;
  while (dShin(push) < 3.1) push += 0.05;
  for (const key of ['knee', 'foot', 'toe']) k[key] = [k[key][0] + push, k[key][1]];
  // On a floor (the platform of a lift, a door's sill) the foot rises to stand 3 clear of it
  if (floor !== undefined) for (const key of ['foot', 'toe']) k[key] = [k[key][0], Math.min(k[key][1], floor - 3.05)];
  const dir = unit(sub(RIDE.hand, RIDE.hub));
  k.hand = add2(k.hub, mul(dir, Math.max(len(sub(k.hand, k.hub)), k.R + 1.35)));
  for (const key of ['hub', 'hip', 'neck', 'hand', 'knee', 'foot', 'toe']) k[key] = rot(k[key], at, deg);
  return rider({ ...k, rh: Math.max(1.35, 1.6 * s), ...extra });
}
/** The rider's box (centerlines): the wheel's back, the head's top, the toe and the wheel's bottom. */
const riderBox = (r) => [Math.min(r.hub[0] - r.R, r.hand[0]), r.hc[1] - r.rh, Math.max(r.toe[0], r.hc[0] + r.rh), r.hub[1] + r.R];
/**
 * The largest rider (up to `s0`) whose width fits between x0 and x1 with its wheel on `floor` (or
 * `lift` above it), centered between them.
 */
function fitRider(x0, x1, floor, s0, lift = 0) {
  for (let s = s0; s > 0.4; s -= 0.01) {
    const at = [0, floor - RIDE.R * s - lift];
    const r = riderAt(s, RIDE.hub, at, { floor });
    const [l, , rt] = riderBox(r);
    if (rt - l <= x1 - x0) return riderAt(s, RIDE.hub, [at[0] + (x0 + x1) / 2 - (l + rt) / 2, at[1]], { floor });
  }
  throw new Error('rider does not fit');
}
/** Head, body, arm, wheel: the rider's strokes in drawing order. */
const riderD = (r) => [r.head, r.body, r.arm, r.wheel];
const RIDER_PARTS = { head: [0], body: [1, 2], wheel: [3] };

const icons = {};
const FILL = {};
const PARTS = {};
/** Adds an icon: name, tags, strokes and optional fields. */
function add(name, tags, d, extra = {}) {
  icons[name] = { tags, d, ...extra };
}

// ── Wheelchair users ──────────────────────────────────────────────────────────────────────────
{
  const r = rider(RIDE);
  add('wheelchair-motion', ['silla de ruedas', 'acceso accesible', 'movilidad', 'wheelchair', 'accessible route', 'active wheelchair'], riderD(r));
  FILL['wheelchair-motion'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['wheelchair-motion'] = RIDER_PARTS;
}
{
  // With a badge the rider is smaller and up to the left: the badge takes the wheel's front and the
  // leg from the knee down, which ends well inside its clearance (1.1 past it) at every weight
  const r = riderAt(0.86, RIDE.hub, [8, 14.75]);
  for (const [name, kind, tags] of [
    ['wheelchair-check', 'check', ['accesible', 'acceso verificado', 'silla de ruedas', 'wheelchair accessible', 'step-free', 'verified access']],
    ['wheelchair-alert', 'alert', ['acceso limitado', 'parcialmente accesible', 'silla de ruedas', 'limited access', 'partially accessible', 'wheelchair']],
    ['wheelchair-question', 'question', ['accesibilidad desconocida', 'sin datos', 'silla de ruedas', 'unknown access', 'accessibility unknown', 'wheelchair']],
  ]) {
    add(name, tags, riderD(r), { badge: badge(kind) });
    FILL[name] = { solid: [0], wire: [1, 2, 3] };
    PARTS[name] = RIDER_PARTS;
  }
}

{
  // Up a ramp: the floor rises to the right and levels off in a short landing; the rider tilts with
  // the slope, its wheel 3 clear of it (a wheel resting on the line would clog where they meet). The
  // slope is gentle (about 13°): steeper, the rider had to shrink and lie back until its torso read
  // as a swimmer's
  const [a, b, c] = [[2.5, 21.25], [15.5, 18.25], [21.5, 18.25]];
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const u = unit(sub(b, a));
  // The largest rider, and the spot along the slope, that keeps the figure in the live area and its
  // toe 3 above the landing
  const at = (s, t) => riderAt(s, RIDE.hub, add2(lerp(a, b, t), mul([u[1], -u[0]], RIDE.R * s + 3.05)), { deg });
  const fits = (r) => {
    const pts = [add2(r.hub, [-r.R, 0]), add2(r.hub, [0, r.R]), [r.hc[0], r.hc[1] - r.rh], [r.hc[0] + r.rh, r.hc[1]], r.toe, r.hand];
    return pts.every(([x, y]) => x >= 2.6 && x <= 21.4 && y >= 2.6 && y <= 21.4) && r.toe[1] <= c[1] - 3.05;
  };
  let r = null;
  for (let s = 0.9; !r && s > 0.5; s -= 0.01) for (let t = 0.2; !r && t < 0.7; t += 0.02) if (fits(at(s, t))) r = at(s, t);
  add('wheelchair-ramp', ['rampa', 'acceso sin escalones', 'silla de ruedas', 'ramp', 'step-free access', 'accessible ramp'], [line(a, b, c), ...riderD(r)]);
  FILL['wheelchair-ramp'] = { solid: [1], wire: [0, 2, 3, 4] };
  PARTS['wheelchair-ramp'] = { ramp: [0], head: [1], body: [2, 3], wheel: [4] };
}
{
  // Platform lift: the guide rails and the platform between them, one U; the rider on it and a short
  // arrow up between the left rail and the head, above the hand
  const [x0, x1, top, floor] = [2.5, 21.5, 2.75, 20.75];
  const r = fitRider(x0 + 3.05, x1 - 3.05, floor, 0.8);
  const ax = (x0 + r.hc[0] - r.rh) / 2;
  const tip = 3.5;
  const tail = Math.min(r.hand[1] - 3.05, tip + 6);
  add('wheelchair-lift', ['plataforma elevadora', 'elevador para silla de ruedas', 'acceso', 'wheelchair lift', 'platform lift', 'vertical lift'], [line([x0, top], [x0, floor], [x1, floor], [x1, top]), ...riderD(r), vl(ax, tail, tip), line([ax - 1.75, tip + 1.75], [ax, tip], [ax + 1.75, tip + 1.75])]);
  FILL['wheelchair-lift'] = { solid: [1], wire: [0, 2, 3, 4, 5, 6] };
  PARTS['wheelchair-lift'] = { platform: [0], head: [1], body: [2, 3], wheel: [4], arrow: [5, 6] };
}
{
  // Assistance: the rider rests (no arm on the rim) in a chair with a push handle, and a helper
  // standing behind holds it. The handle rises from the seat behind the hip and turns back at the top.
  const s = 0.72;
  const floor = 21.5;
  const handleOf = (k) => {
    const hip = xp(RIDE.hip, s, RIDE.hub, k.at);
    const from = [hip[0] + 1.25, hip[1]];
    const post = [hip[0] - 2.4, hip[1] - 4.5];
    return [from, post, [post[0] - 1.75, post[1]]];
  };
  const place = (dx) => {
    const at = [dx, floor - RIDE.R * s];
    const h = handleOf({ at });
    return { r: riderAt(s, RIDE.hub, at, { floor: floor + 3.05, armless: true, avoid: [h] }), h };
  };
  const t = place(0);
  const { r, h } = place(21 - riderBox(t.r)[2]);
  const handle = rline(h, [0, 0.6, 0]);
  // The helper: head, a body that leans into the push, the legs and the arm out to the grip
  const hd = [4.75, 4.6];
  const neck = [5.6, 9.1];
  const waist = [4.75, 14.25];
  // The arm runs level from the shoulder to the grip's end, in line with it; the torso and both legs
  // meet at the waist, the legs spread wide enough that the angle between them stays open at 2.1
  const shoulder = [neck[0] + ((waist[0] - neck[0]) * (h[2][1] - neck[1])) / (waist[1] - neck[1]), h[2][1]];
  const helper = [circ(...hd, 1.6), line(neck, waist, [2.25, 21.25]), line(waist, [6.25, 21.25]), line(shoulder, h[2])];
  add('wheelchair-assistance', ['asistencia', 'acompañante', 'silla de ruedas', 'wheelchair assistance', 'special assistance', 'escort'], [r.head, r.body, r.wheel, handle, ...helper]);
  FILL['wheelchair-assistance'] = { solid: [0, 4], wire: [1, 2, 3, 5, 6, 7] };
  PARTS['wheelchair-assistance'] = { head: [0], body: [1], wheel: [2], handle: [3], helper: [4, 5, 6, 7] };
}
{
  // Power chair: the same rider (its head, torso, thigh and shin), but nobody pushes, so no arm on a
  // rim: the forearm lies level along the armrest, as the ISO figure's arm does, and the hand ends on
  // the joystick's knob out past the knee; the feet sit up on the footplate, and the chair rolls on a
  // mid-size drive wheel under the seat and a small caster under the footplate, both whole circles.
  // (A knob close to the torso read as something held to the chest; a stem down to the lap closed a
  // box with it.)
  const { hip, neck } = RIDE;
  const r = rider({ ...RIDE, foot: [17.25, 16], toe: [19.5, 16] });
  const knob = [16.6, 9.15];
  const shoulder = lerp(hip, neck, (hip[1] - knob[1]) / (hip[1] - neck[1]));
  const wheel = circ(9.75, 18.5, 2.75);
  const caster = circ(17.75, 20.1, 1.15);
  add('wheelchair-electric', ['silla de ruedas eléctrica', 'silla motorizada', 'movilidad', 'power wheelchair', 'electric wheelchair', 'mobility equipment'], [r.head, r.body, line(shoulder, [knob[0] - 0.7, knob[1]]), dot(...knob), wheel, caster]);
  FILL['wheelchair-electric'] = { solid: [0, 3, 4, 5], wire: [1, 2] };
  PARTS['wheelchair-electric'] = { head: [0], body: [1], joystick: [2, 3], wheels: [4, 5] };
}
{
  // The chair alone: the frame (handle, back, seat, legrest and footplate), the big wheel with its
  // hub (an arc that stops 3 from the frame, as the rider's) and the front caster on the same ground
  const pts = [[3.25, 4.5], [6.25, 4.5], [6.25, 12], [15.5, 12], [17, 15.75], [19.75, 15.75]];
  const frame = rline(pts, [0, 1, 0.75, 0.75, 0.5, 0]);
  const [hub, R] = [[9.5, 15.75], 5.25];
  const clear = (a) => polyDist(polar(...hub, R, a), pts) >= 3.05;
  let a0 = 90;
  while (a0 > -90 && clear(a0 - 0.5)) a0 -= 0.5;
  let a1 = 90;
  while (a1 < 270 && clear(a1 + 0.5)) a1 += 0.5;
  const caster = circ(18.25, 19.75, 1.25);
  add('wheelchair-empty', ['silla de ruedas', 'préstamo de silla', 'equipo', 'empty wheelchair', 'wheelchair rental', 'manual wheelchair'], [frame, arc(...hub, R, a0, a1).d, dot(...hub), caster]);
  FILL['wheelchair-empty'] = { solid: [2, 3], wire: [0, 1] };
  PARTS['wheelchair-empty'] = { frame: [0], wheel: [1, 2], caster: [3] };
}
{
  // Accessible entrance: a wide doorway (lugares' door frame, widened) on the floor, no step, and the
  // rider rolling through it
  const frame = rline([[3.25, 21.25], [3.25, 3], [20.75, 3], [20.75, 21.25]], [0, 1.25, 1.25, 0]);
  const r = fitRider(3.25 + 3.05, 20.75 - 3.05, 21.25, 0.8);
  add('door-accessible', ['entrada accesible', 'puerta accesible', 'sin escalones', 'accessible entrance', 'step-free entrance', 'accessible door'], [frame, hl(21.25, 2.25, 21.75), ...riderD(r)]);
  FILL['door-accessible'] = { solid: [2], wire: [0, 1, 3, 4, 5] };
  PARTS['door-accessible'] = { frame: [0], floor: [1], head: [2], body: [3, 4], wheel: [5] };
}
{
  // Accessible parking: bienes-raices' bay lines with the rider standing in the bay
  const P = bienesRaices.icons['parking-space'].d;
  const fit = (floor) => fitRider(3.75 + 3.05, 20.25 - 3.05, floor, 0.8);
  const [, t0, , b0] = riderBox(fit(20));
  const r = fit(20 + 12 - (t0 + b0) / 2);
  add('parking-accessible', ['estacionamiento accesible', 'cajón reservado', 'discapacidad', 'accessible parking', 'disabled parking', 'reserved bay'], [P[0], P[1], ...riderD(r)]);
  FILL['parking-accessible'] = { solid: [2], wire: [0, 1, 3, 4, 5] };
  PARTS['parking-accessible'] = { bay: [0, 1], head: [2], body: [3, 4], wheel: [5] };
}
// ── Mobility equipment ─────────────────────────────────────────────────────────────────────────
{
  // Stair lift: hogar's steps, the lift's rail running along them 3 above their nosings, and the seat
  // (a solid chair: back and cushion) mounted on the rail halfway up, in front of it: the engine
  // clears the rail behind the chair, so the chair reads as riding the track (a bare rail, or a chair
  // perched above it on a post, read as a slash through the stairs)
  const steps = hogar.icons.stairs.d[0];
  const slope = -4 / 4.5;
  const railY = (x) => 13 + slope * (x - 7.25);
  const rail = line([2.75, railY(2.75)], [19.5, railY(19.5)]);
  const [x0, x1, top, bottom] = [7.25, 12.75, 2, 9.5];
  const chair = roundpoly([[x0, top], [x0 + 2.5, top], [x0 + 2.5, bottom - 2.5], [x1, bottom - 2.5], [x1, bottom], [x0, bottom]], [0.9, 0.9, 0.6, 0.9, 0.9, 0.9]);
  add('stair-lift', ['salvaescaleras', 'silla salvaescaleras', 'escaleras', 'stair lift', 'stairlift', 'home adaptation'], [steps, rail], { badge: own([chair], chair, { solid: [chair] }) });
  FILL['stair-lift'] = { solid: [shut(steps)], wire: [1] };
  // (filled, the steps are solid as in hogar's stairs; the chair is the badge's solid)
  PARTS['stair-lift'] = { steps: [0], rail: [1] };
}
{
  // Mobility scooter: a low deck on two small wheels (in front of it), the seat with its backrest at
  // the rear and the raked tiller with its handlebar at the front
  const deck = capsule(3.25, 13.75, 17, 3);
  const seat = rline([[4.75, 5.75], [4.75, 10.75], [11, 10.75]], [0, 0.75, 0]);
  const post = vl(8, 10.75, 13.75);
  const tiller = rline([[17.75, 13.75], [15, 5.25], [12.5, 5.25]], [0, 0.6, 0]);
  const wheels = [circ(6.5, 18.75, 2.25), circ(17, 18.75, 2.25)];
  add('mobility-scooter', ['scooter de movilidad', 'scooter eléctrico', 'movilidad reducida', 'mobility scooter', 'scooter rental', 'limited mobility'], [deck, seat, post, tiller], { badge: own(wheels, wheels.join(''), { solid: wheels }) });
  FILL['mobility-scooter'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['mobility-scooter'] = { deck: [0], seat: [1, 2], tiller: [3] };
}
{
  // Rollator: the rear leg rising to the handle (its grip turned back, the brake lever under it), the
  // front leg reaching down to the front wheel, the seat bar between them and two large wheels
  const rear = circ(6.25, 18.75, 2.5);
  const front = circ(17.75, 18.75, 2.5);
  const frame = rline([[3.25, 4.25], [7.25, 4.25], [6.4, 16.25]], [0, 0.75, 0]);
  const fleg = line([7.05, 7.1], [16.55, 16.55]);
  const seat = hl(11.75, 6.65, 11.75);
  const lever = line([3.75, 7.25], [6.85, 7.25]);
  add('rollator', ['andadera con ruedas', 'rollator', 'caminar', 'rollator', 'wheeled walker', 'walking aid'], [rear, front, frame, fleg, seat, lever]);
  FILL.rollator = { solid: [0, 1], wire: [2, 3, 4, 5] };
  PARTS.rollator = { wheels: [0, 1], frame: [2, 3], seat: [4], brake: [5] };
}
{
  // Lower-leg prosthesis: the socket, the thin pylon, the ankle ring and the foot, stacked and touching
  // The pylon stands over the heel and the foot reaches forward to the toe
  const socket = roundpoly([[5.5, 2.75], [14.5, 2.75], [12.25, 10], [7.75, 10]], [0.75, 0.75, 1.6, 1.6]);
  const pylon = vl(10, 10, 14);
  const ring = circ(10, 15.5, 1.5);
  const foot = roundpoly([[8, 17], [12, 17], [20.5, 19], [20.5, 21.25], [5.75, 21.25]], [1, 1.75, 1, 0.5, 1.75]);
  add('prosthetic-leg', ['prótesis de pierna', 'amputación', 'prótesis', 'prosthetic leg', 'prosthesis', 'amputee'], [socket, pylon, ring, foot]);
  FILL['prosthetic-leg'] = { solid: [0, 2, 3], wire: [1] };
  PARTS['prosthetic-leg'] = { socket: [0], pylon: [1], ankle: [2], foot: [3] };
}
{
  // Arm prosthesis: the forearm socket, wider at the elbow and tapering up to the wrist ring, and the
  // hand: three rounded fingers (their seams as the set's raised hand draws them) and the thumb
  const [ax, bx] = [polar(5.75, 8.25, 1.5, 135), polar(5.75, 8.25, 1.5, -45)];
  const hand = `M7.5 ${f(bx[1] + (7.5 - bx[0]))}V6A1.5 1.5 0 0 1 10.5 6V4.75A1.5 1.5 0 0 1 13.5 4.75V6A1.5 1.5 0 0 1 16.5 6V10.5A1.75 1.75 0 0 1 14.75 12.25H9.4L${pt(ax)}A1.5 1.5 0 0 1 ${pt(bx)}Z`;
  const socket = roundpoly([[8.75, 12.25], [15.25, 12.25], [17, 21.25], [7, 21.25]], [0, 0, 1.5, 1.5]);
  add('prosthetic-arm', ['prótesis de brazo', 'mano biónica', 'rehabilitación', 'prosthetic arm', 'bionic hand', 'upper limb prosthesis'], [socket, hl(15.25, 8.25, 15.75), hand, vl(10.5, 6, 9.25), vl(13.5, 6, 9.25)]);
  FILL['prosthetic-arm'] = { solid: [0, 2], cut: [1, 3, 4] };
  PARTS['prosthetic-arm'] = { socket: [0, 1], hand: [2, 3, 4] };
}
{
  // Running blade: the socket and the long J-curve below it that bends back to its toe on the ground
  const socket = roundpoly([[5.75, 2.75], [14.25, 2.75], [12.25, 9.5], [7.75, 9.5]], [0.75, 0.75, 1.5, 1.5]);
  const blade = 'M10 9.5C10 13.5 18.75 12.75 18.75 17.25C18.75 19.9 16.5 21.25 13.25 21.25L10.75 21.25';
  add('prosthetic-blade', ['prótesis deportiva', 'pie de carrera', 'deporte adaptado', 'running blade', 'prosthetic blade', 'para athlete'], [socket, blade]);
  FILL['prosthetic-blade'] = { solid: [0], wire: [1] };
  PARTS['prosthetic-blade'] = { socket: [0], blade: [1] };
}

// ── Doors and rooms ───────────────────────────────────────────────────────────────────────────
{
  // Door width: lugares' door frame and floor, and a dimension line across the opening whose
  // arrowheads touch the jambs
  const D = L['door-open'].d;
  add('door-width', ['ancho de puerta', 'medida', 'paso libre', 'door width', 'clear width', 'doorway'], [D[0], D[1], hl(12.5, 6, 18), line([9, 9.5], [6, 12.5], [9, 15.5]), line([15, 9.5], [18, 12.5], [15, 15.5])]);
  FILL['door-width'] = false;
  PARTS['door-width'] = { frame: [0], floor: [1], dimension: [2, 3, 4] };
}
{
  // Automatic door: the doorway (door-accessible's wide frame), its two panels slid apart into the
  // jambs, the gap open between them, and under the header a short arrow outward over each. Each
  // panel shares its outer side with its jamb, so only its top and its leading edge are drawn (whole
  // panels beside the jambs made it too dense; without the frame, two loose panels read as pills)
  const frame = rline([[3.25, 21.25], [3.25, 2.75], [20.75, 2.75], [20.75, 21.25]], [0, 1.25, 1.25, 0]);
  const leaf = (x, jamb) => [[x, 21.25], [x, 11.75], [jamb, 11.75]];
  const panels = [rline(leaf(9.25, 3.25), [0, 1, 0]), rline(leaf(14.75, 20.75), [0, 1, 0])];
  const arrow = (x0, x1) => `${hl(7.25, x0, x1)}${head([x1, 7.25], [x1 - x0, 0], 2.25)}`;
  add('door-automatic', ['puerta automática', 'puerta corrediza', 'acceso', 'automatic door', 'sliding door', 'powered door'], [frame, ...panels, arrow(10.5, 6.5), arrow(13.5, 17.5)]);
  // Filled, each panel is the closed shape its two strokes make with the jamb
  const solid = [rline([...leaf(9.25, 3.25), [3.25, 21.25]], [0, 1, 0, 0]), rline([...leaf(14.75, 20.75), [20.75, 21.25]], [0, 1, 0, 0])].map((d) => `${d}Z`);
  FILL['door-automatic'] = { solid, wire: [0, 3, 4] };
  PARTS['door-automatic'] = { frame: [0], panels: [1, 2], arrows: [3, 4] };
}

{
  // Accessible toilet: hogar's toilet, smaller at the bottom left, and an L-shaped grab bar on the wall
  // beside it
  const m = (d) => xf(d, 0.8, [3.25, 20.75]);
  const T = hogar.icons.toilet.d.map(m);
  const TF = hogar.icons.toilet.fill;
  add('toilet-accessible', ['baño accesible', 'sanitario accesible', 'barra de apoyo', 'accessible toilet', 'accessible restroom', 'grab bar'], [...T, rline([[11.5, 9.75], [20.75, 9.75], [20.75, 3.25]], [0, 1, 0])]);
  FILL['toilet-accessible'] = { solid: TF.solid.map(m), cut: TF.cut.map(m), wire: [3] };
  PARTS['toilet-accessible'] = { toilet: [0, 1, 2], bar: [3] };
}
{
  // Shower seat: hogar's shower (the pipe is the wall), its head and its two outer lines of water, and
  // a seat on the wall under the head: a slab as thick as the head, square against the wall, on a leg
  // at its front. (A bare line for the seat read as a flag; a diagonal brace closed a triangle with
  // the wall and the seat that shut at 2.1.)
  const H = hogar.icons.shower.d;
  const seat = sq(4.75, 14.5, 5.5, 3.25, 1, { square: ['tl', 'bl'] });
  const brace = vl(9, 17.75, 21);
  add('shower-seat', ['asiento de ducha', 'ducha accesible', 'silla de baño', 'shower seat', 'accessible shower', 'roll-in shower'], [H[0], H[1], H[3], H[4], seat, brace]);
  FILL['shower-seat'] = { solid: [1, 4], wire: [0, 5], lines: [2, 3] };
  PARTS['shower-seat'] = { pipe: [0], head: [1], water: [2, 3], seat: [4, 5] };
}
{
  // Elevator out of service: bienes-raices' elevator, 1.5 to the left, with the engine's alert badge
  // (in place, the badge's clearance grazed the doors' seam and the fill lost its shape at 2.1)
  const E = bienesRaices.icons.elevator;
  add('elevator-alert', ['elevador fuera de servicio', 'ascensor averiado', 'sin acceso', 'elevator out of service', 'lift outage', 'elevator alert'], E.d.map((d) => xf(d, 1, [0, 0], [-1.5, 0])), { badge: badge('alert') });
  FILL['elevator-alert'] = { solid: [0, 2, 3], cut: [1] };
  PARTS['elevator-alert'] = { cabin: [0], seam: [1], arrows: [2, 3] };
}
{
  // Priority seat: hogar's chair and a walking stick leaning on its seat's front edge
  const C = hogar.icons.chair.d;
  const top = [16.05, 10.95];
  const stick = `${line([20.25, 21.25], top)}${arcTo(14.55, 10.33, 1.62, (Math.atan2(10.95 - 10.33, 16.05 - 14.55) * 180) / Math.PI, -150)}`;
  add('priority-seat', ['asiento preferente', 'asiento reservado', 'bastón', 'priority seat', 'reserved seating', 'seat for elderly'], [...C, stick]);
  FILL['priority-seat'] = { solid: [shut(C[0]), C[2]], cut: [C[1]], wire: [3, 4, 5] };
  PARTS['priority-seat'] = { chair: [0, 1, 2, 3, 4], cane: [5] };
}
{
  // Quiet room: lugares' door, closed, and a crescent moon as a piece of its own at the lower right
  // (the moon clears its whole disc). The open door's leaf pinches the floor: once the moon opens the
  // frame, that pinch splits the drawing at 2.1, so the room is shown with its door shut
  const D = L.door;
  const [mc, k] = [[17.25, 17.5], 0.5];
  const moon = xf(L.moon.d[0], k, [11.5, 12.5], mc);
  add('quiet-room', ['sala tranquila', 'espacio sensorial', 'descanso', 'quiet room', 'sensory room', 'quiet space'], [...D.d], { badge: own([moon], circ(...mc, 8.5 * k), { solid: [moon] }) });
  FILL['quiet-room'] = { solid: D.fill.solid, cut: D.fill.cut, wire: D.fill.wire };
  PARTS['quiet-room'] = { door: [0], floor: [1], knob: [2] };
}

// ── Low vision and blindness ──────────────────────────────────────────────────────────────────
{
  // White cane: lugares' walking figure, its front hand holding a long straight cane that reaches
  // the ground ahead of its feet
  const W = L.walking.d;
  add('walking-white-cane', ['bastón blanco', 'persona ciega', 'baja visión', 'white cane', 'blind person', 'visually impaired'], [...W, line([17.25, 12.25], [20.75, 21.25])]);
  FILL['walking-white-cane'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['walking-white-cane'] = { head: [0], body: [1], legs: [2, 3], arms: [4], cane: [5] };
}
const DOG = mascotas.icons['dog-side'].d;
{
  // Guide dog: mascotas' dog in profile in its harness: the chest strap and the tall rigid handle
  // rising from its back toward the handler (the U seen from the side), its grip at the top
  const handle = rline([[11.25, 9.75], [8, 3.25], [5.75, 3.25]], [0, 0.9, 0]);
  const strap = line([11.25, 9.75], [11.75, 14.5]);
  add('guide-dog', ['perro guía', 'perro lazarillo', 'ceguera', 'guide dog', 'seeing eye dog', 'service animal'], [...DOG, handle, strap]);
  FILL['guide-dog'] = { solid: [0], cut: [1, 8], wire: [2, 3, 4, 5, 6, 7] };
  PARTS['guide-dog'] = { body: [0], ear: [1], legs: [2, 3, 4, 5], tail: [6], harness: [7, 8] };
}
const EYE = edicion.icons.eye.d;
{
  // Low vision: edicion's eye whose right half fades into three parallel bars (the low-vision
  // symbol); the bars sit on top and the engine clears the eye under them
  const bars = [14, 17.25, 20.5].map((x) => line([x - 1.5, 16], [x + 1.5, 8]));
  add('eye-low-vision', ['baja visión', 'visión reducida', 'discapacidad visual', 'low vision', 'partially sighted', 'visual impairment'], [...EYE], { badge: own(bars, bars.map(trace).join(''), { solid: bars.map(trace) }) });
  FILL['eye-low-vision'] = { solid: [0], cut: [1] };
  PARTS['eye-low-vision'] = { eye: [0], pupil: [1] };
}
{
  // Braille: two cells of six positions (2 × 3), only their raised dots drawn: f and y. The dots
  // stand 4.5 apart (three pixels at 16 px), so they stay apart on the pixel grid
  const cell = (x0, on) => on.map((k) => dot(x0 + (k > 3 ? 4.5 : 0), 7.5 + ((k - 1) % 3) * 4.5));
  const d = [...cell(3.75, [1, 2, 4]), ...cell(15.75, [1, 3, 4, 5, 6])];
  add('braille', ['braille', 'lectura táctil', 'ceguera', 'braille', 'tactile reading', 'braille text'], d);
  FILL.braille = { solid: d.map((_, i) => i) };
}
{
  // Refreshable braille display: the device (a landscape container, the signature corner) showing the
  // same two cells as braille, f and y, in its pins: the dense dots (r 0.3), 3.5 apart within a cell
  // and 5 between the cells, so they stay apart at 2.1 and the cells read as two. (Pins in pairs 1.5
  // apart ran together into figures of eight, and thumb keys under them made it read as a keyboard.)
  const box = sq(2.5, 5, 19, 14, 3.5, BR);
  const cell = (x0, on) => on.map((k) => dot(x0 + (k > 3 ? 3.5 : 0), 8.5 + ((k - 1) % 3) * 3.5, 0.3));
  const pins = [...cell(6, [1, 2, 4]), ...cell(14.5, [1, 3, 4, 5, 6])];
  add('braille-display', ['línea braille', 'pantalla braille', 'lector de pantalla', 'braille display', 'refreshable braille', 'braille output'], [box, ...pins]);
  FILL['braille-display'] = { solid: [0], cut: pins.map((_, i) => i + 1) };
  PARTS['braille-display'] = { body: [0], pins: pins.map((_, i) => i + 1) };
}
{
  // Screen reader: a landscape screen with two lines of text and nucleo's two waves leaving its right
  // edge, as they leave the speaker
  const screen = sq(2.5, 7, 11.5, 10, 2.5, BR);
  const waves = N.waves.d.map((d) => xf(d, 1, [0, 0], [1.5, 0]));
  add('screen-reader', ['lector de pantalla', 'voiceover', 'leer en voz alta', 'screen reader', 'voiceover', 'text to speech'], [screen, hl(10, 5.5, 11), hl(14, 5.5, 8.75), ...waves]);
  FILL['screen-reader'] = { solid: [0], cut: [1, 2], lines: [3, 4] };
  PARTS['screen-reader'] = { screen: [0], text: [1, 2], wave: [3, 4] };
}
{
  // Magnifier: nucleo's search lens and handle with two lines of text inside the glass
  const S0 = N.search.d;
  add('text-magnifier', ['lupa', 'ampliar pantalla', 'zoom', 'magnifier', 'screen magnification', 'zoom text'], [...S0, hl(9.1, 7.5, 13.75), hl(12.1, 7.5, 11.25)]);
  FILL['text-magnifier'] = { solid: [S0[0]], wire: [1], cut: [2, 3] };
  PARTS['text-magnifier'] = { lens: [0, 2, 3], handle: [1] };
}
{
  // Color vision: three overlapping circles, the three channels; one of them dashed, a channel missing
  const C3 = [[12, 8.4], [8.25, 14.9], [15.75, 14.9]];
  const R0 = 5.25;
  const others = [C3[0], C3[1]];
  // Five dashes; the phase keeps each dash's ends clear of the other two circles (or on them)
  const okEnd = (p) => others.every((c) => Math.abs(len(sub(p, c)) - R0) >= 2.9 || Math.abs(len(sub(p, c)) - R0) < 0.2);
  let phase = 0;
  for (let ph = 0; ph < 72; ph += 0.5) {
    const ends = [0, 1, 2, 3, 4].flatMap((k) => [polar(...C3[2], R0, ph + k * 72), polar(...C3[2], R0, ph + k * 72 + 38)]);
    if (ends.every(okEnd)) {
      phase = ph;
      break;
    }
  }
  const dashes = [0, 1, 2, 3, 4].map((k) => arc(...C3[2], R0, phase + k * 72, phase + k * 72 + 38).d).join('');
  add('color-blindness', ['daltonismo', 'filtros de color', 'visión del color', 'color blindness', 'color vision deficiency', 'colorblind mode'], [circ(...C3[0], R0), circ(...C3[1], R0), dashes]);
  FILL['color-blindness'] = false;
  PARTS['color-blindness'] = { channels: [0, 1], missing: [2] };
}
{
  // Invert colors: lugares' droplet split down the middle, its right half hatched. The hatch is level:
  // contrast's 45° lines, under a droplet's point, fanned up from the split like the veins of a leaf
  const drop0 = L.droplet.d[0];
  const [c, r] = [[12, 13.5], 7.25];
  // A hatch line from the split to the droplet's edge (its round body or the straight side up to the
  // tip); none under 16.25, where the line and the round bottom would pinch shut
  const tip = [12, 3.25];
  const side = polar(...c, r, -45);
  const edgeX = (y) => (y >= side[1] ? c[0] + Math.sqrt(r * r - (y - c[1]) ** 2) : tip[0] + ((side[0] - tip[0]) * (y - tip[1])) / (side[1] - tip[1]));
  const hatch = [7.25, 10.25, 13.25, 16.25].map((y) => hl(y, 12, edgeX(y)));
  add('invert-colors', ['invertir colores', 'inversión inteligente', 'pantalla', 'invert colors', 'smart invert', 'display accommodations'], [drop0, vl(12, 3.25, 20.75), ...hatch]);
  FILL['invert-colors'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['invert-colors'] = { drop: [0], split: [1], hatch: [2, 3, 4, 5] };
}
{
  // Larger pointer: the engine's pointer, large, and a small one at its upper left, the size it grew
  // from
  const small = cursor([2.25, 2.5], 0.4);
  const big = cursor([10.25, 5.25], 0.8);
  add('cursor-large', ['puntero grande', 'tamaño del puntero', 'cursor', 'large pointer', 'pointer size', 'cursor size'], [big, small]);
  FILL['cursor-large'] = { solid: [0, 1] };
  PARTS['cursor-large'] = { pointer: [0], before: [1] };
}
{
  // Highlight the pointer: the engine's pointer with a full ring around its tip (the ring passes
  // behind it)
  const tip = [9.25, 8.5];
  const p = cursor(tip, 0.7);
  add('cursor-highlight', ['resaltar puntero', 'localizar cursor', 'foco', 'highlight pointer', 'cursor halo', 'locate pointer'], [circ(...tip, 5.5)], { badge: own([p], p, { solid: [p] }) });
  FILL['cursor-highlight'] = false;
  PARTS['cursor-highlight'] = { halo: [0] };
}
{
  // Reduce motion: a wave that starts tall at the left and settles into a flat line at the right
  const d = 'M2.75 12C3.9 4.5 5.6 4.5 6.75 12S9.4 17.5 10.5 12S12.4 9.75 13.25 12S14.5 13 15.25 12H21.25';
  add('reduce-motion', ['reducir movimiento', 'sin animaciones', 'movimiento', 'reduce motion', 'disable animations', 'motion sensitivity'], [d]);
  FILL['reduce-motion'] = false;
}
{
  // Reading guide: three lines of text, the middle one with a long ruler bar under it that runs past
  // both ends
  add('reading-guide', ['guía de lectura', 'regla de lectura', 'dislexia', 'reading guide', 'reading ruler', 'line focus'], [hl(4.75, 5.25, 18.75), hl(9.25, 5.25, 16.25), capsule(2.5, 12.25, 19, 3), hl(18.75, 5.25, 14.25)]);
  FILL['reading-guide'] = { solid: [2], wire: [0, 1, 3] };
  PARTS['reading-guide'] = { text: [0, 1, 3], ruler: [2] };
}
{
  // Reader mode: ventanas' window holding only a narrow column of text, wide margins around it
  const W = ventanas.icons.window;
  add('reader-mode', ['modo lectura', 'vista simplificada', 'legibilidad', 'reader mode', 'reader view', 'simplified view'], [...W.d, hl(13.25, 8.5, 15.5), hl(16.5, 8.5, 15.5)]);
  FILL['reader-mode'] = { solid: W.fill.solid, cut: [...W.fill.cut, 5, 6] };
  PARTS['reader-mode'] = { frame: [0], bar: [1], controls: [2, 3, 4], text: [5, 6] };
}
{
  // Large print: nucleo's document holding two rows of tall capsules where a document has thin lines
  const doc = N.document.d[0];
  add('large-print', ['letra grande', 'macrotipo', 'texto ampliado', 'large print', 'large type', 'enlarged text'], [doc, capsule(7.75, 6.25, 8.5, 4), capsule(7.75, 13.25, 5.5, 4)]);
  FILL['large-print'] = { solid: [0], cut: [1, 2] };
  PARTS['large-print'] = { page: [0], text: [1, 2] };
}
{
  // Audio description: edicion's eye, smaller at the left, and nucleo's two waves leaving it
  const eye = EYE.map((d) => xf(d, 0.62, [2.75, 12]));
  const waves = N.waves.d.map((d) => xf(d, 1, [0, 0], [1.75, 0]));
  add('audio-description', ['audiodescripción', 'narración', 'descripción de video', 'audio description', 'described video', 'narration'], [...eye, ...waves]);
  FILL['audio-description'] = { solid: [0], cut: [1], lines: [2, 3] };
  PARTS['audio-description'] = { eye: [0, 1], wave: [2, 3] };
}
{
  // Alt text: a picture (its frame, the sun and a hill standing on its bottom edge) in front; behind
  // it, offset down and to the right, a card with two lines of text
  const frame = sq(2.75, 3, 11.5, 8.75, 2.5, BR);
  const sun = dot(11, 6.25);
  const hill = line([4.75, 11.75], [8.25, 7.75], [11.75, 11.75]);
  const card = sq(7, 7.25, 14.25, 14, 3, BR);
  add('alt-text', ['texto alternativo', 'descripción de imagen', 'alt', 'alt text', 'image description', 'alternative text'], [card, hl(15, 10, 18.25), hl(18, 10, 15)], { badge: own([frame, sun, hill], frame, { solid: [frame], cut: [sun, line([4.4, 12.15], [8.25, 7.75], [12.1, 12.15])] }) });
  FILL['alt-text'] = { solid: [0], cut: [1, 2] };
  PARTS['alt-text'] = { card: [0], text: [1, 2] };
}

// ── Hearing and deafness ──────────────────────────────────────────────────────────────────────
// The ear, in profile: the helix (an arc over the top that comes down the back and curls into the
// lobe) and the inner fold, concentric with it 3 inside. Drawn at 1 about EAR_O; `ear(at, s)` scales it.
const EAR_O = [12.75, 8.75];
const EAR = [
  `M7.25 8.75${arcTo(12.75, 8.75, 5.5, 180, 385)}C16.6 13.6 14.75 14.6 14.25 17C13.8 19.25 12.6 20.75 10.75 20.75C9.4 20.75 8.5 20 8.1 19`,
  `M10.25 8.75${arcTo(12.75, 8.75, 2.5, 180, 375)}C14.9 10.5 13.25 11.25 12.75 13`,
];
/** A smaller ear keeps its fold 3 inside the helix: the fold's arc alone, without its tail. */
const ear = (at = EAR_O, s = 1) => (s === 1 ? EAR.map((d) => xf(d, 1, EAR_O, at)) : [xf(EAR[0], s, EAR_O, at), arc(...at, 5.5 * s - 3, 180, 375).d]);
/** Sound waves arriving from the left: arcs about a source at (cx, cy), radii r0 and r0 + 3. */
const arriving = (cx, cy, r0, span = 34) => [arc(cx, cy, r0, -span, span).d, arc(cx, cy, r0 + 3, -span, span).d];
{
  const E = ear([16, 8.75]);
  const waves = arriving(-1.75, 11.5, 6.25);
  add('hearing', ['audición', 'oído', 'sordera', 'hearing', 'ear', 'deaf'], [...E, ...waves]);
  FILL.hearing = false;
  PARTS.hearing = { ear: [0, 1], wave: [2, 3] };
  // With the badge, the ear is hearing-loop's smaller one, whole and up to the left, clear of the
  // badge: at full size the badge took its back and lobe and left the helix and its fold, which read
  // as a question mark beside the "!"
  add('hearing-alert', ['sonido fuerte', 'daño auditivo', 'volumen alto', 'loud sound', 'hearing safety', 'noise warning'], ear([9.5, 7.25], 0.8), { badge: badge('alert') });
  FILL['hearing-alert'] = false;
  PARTS['hearing-alert'] = { ear: [0, 1] };
}
/** A behind-the-ear body: an arc-shaped bean about (cx, cy) between radii r0 and r1, from a0 to a1. */
function bean(cx, cy, r0, r1, a0, a1) {
  const rc = (r1 - r0) / 2;
  const A = polar(cx, cy, r1, a0);
  // Each end is a half circle across the body's width
  const cap = (to) => `A${f(rc)} ${f(rc)} 0 0 1 ${pt(to)}`;
  return `M${pt(A)}${arcTo(cx, cy, r1, a0, a1)}${cap(polar(cx, cy, r0, a1))}${arcTo(cx, cy, r0, a1, a0)}${cap(A)}Z`;
}
{
  // Hearing aid: a behind-the-ear body and the thin tube that arcs over from its top and down to the
  // small round dome
  const body = bean(5.5, 13.25, 7.5, 11, -42, 38);
  const top = polar(5.5, 13.25, 9.25, -42);
  const tube = `M${pt(add2(top, [-0.85, -1.35]))}C10.5 2.75 5.25 2.25 5.25 8.5L5.25 11.25`;
  add('hearing-aid', ['audífono', 'aparato auditivo', 'audiología', 'hearing aid', 'hearing device', 'audiology'], [body, tube, circ(5.25, 13, 1.75)]);
  FILL['hearing-aid'] = { solid: [0, 2], wire: [1] };
  PARTS['hearing-aid'] = { body: [0], tube: [1], dome: [2] };
}
{
  // Hearing loop: the ear, smaller, standing in an open loop of cable that ends in two short leads;
  // the ear is in front (the engine clears the loop behind it)
  const E = ear([11.75, 7.5], 0.8);
  const [c, rx, ry] = [[11.5, 17.75], 8.75, 3.25];
  const at = (a) => [c[0] + rx * Math.cos((a * Math.PI) / 180), c[1] + ry * Math.sin((a * Math.PI) / 180)];
  const pts = [];
  for (let a = 38; a <= 322; a += 4) pts.push(at(a));
  const [p0, p1] = [at(38), at(322)];
  const loop = `M21.5 ${f(p0[1])}L${pts.map(pt).join('L')}L21.5 ${f(p1[1])}`;
  add('hearing-loop', ['bucle magnético', 'aro magnético', 'telebobina', 'hearing loop', 'induction loop', 'telecoil'], [loop], { badge: own(E, E.map(trace).join(''), { solid: E.map(trace) }) });
  FILL['hearing-loop'] = false;
  PARTS['hearing-loop'] = { loop: [0] };
}
{
  // Hearing test: an audiogram, the plot's axes and its line of rings stepping down to the right
  const rings = [[8.25, 6], [13.75, 8.5], [18.75, 14]];
  const R0 = 1.75;
  const links = rings.slice(1).map((q, i) => {
    const u = unit(sub(q, rings[i]));
    return line(add2(rings[i], mul(u, R0)), sub(q, mul(u, R0)));
  });
  add('hearing-test', ['prueba auditiva', 'audiometría', 'audiograma', 'hearing test', 'audiogram', 'hearing check'], [line([3.25, 3.25], [3.25, 20.75], [20.75, 20.75]), ...rings.map((q) => circ(...q, R0)), ...links]);
  FILL['hearing-test'] = { solid: [1, 2, 3], wire: [0, 4, 5] };
  PARTS['hearing-test'] = { axes: [0], rings: [1, 2, 3], line: [4, 5] };
}
{
  // Noise level: a half-round meter, its needle pushed to the right, and two waves rising beside it
  const [c, r] = [[9.25, 15.5], 6.5];
  const meter = `M${pt([c[0] - r, c[1]])}${arcTo(...c, r, 180, 360)}Z`;
  const needle = line(c, polar(...c, 4, -32));
  add('noise-level', ['nivel de ruido', 'decibeles', 'sonómetro', 'noise level', 'decibels', 'sound level'], [meter, needle, arc(...c, r + 3, -36, 0).d, arc(...c, r + 6, -32, 0).d]);
  FILL['noise-level'] = { solid: [0], cut: [1], lines: [2, 3] };
  PARTS['noise-level'] = { meter: [0], needle: [1], wave: [2, 3] };
}
{
  // Audio balance: dispositivos' headphones with a short two-way arrow between the cups
  const H = dispositivos.icons.headphones;
  const arrow = [hl(8.5, 9, 15), head([9, 8.5], [-1, 0], 2.1), head([15, 8.5], [1, 0], 2.1)];
  add('audio-balance', ['balance de audio', 'audio mono', 'izquierda derecha', 'audio balance', 'mono audio', 'left right balance'], [...H.d, ...arrow]);
  FILL['audio-balance'] = { solid: H.fill.solid, wire: [0, 3, 4, 5] };
  PARTS['audio-balance'] = { band: [0], cups: [1, 2], arrow: [3, 4, 5] };
}
// The open hand (comunicacion's raised hand, its silhouette), for sign language
const HAND = comunicacion.icons['hand-raised'].d[0];
{
  // Sign language: two open hands facing each other mid-sign (thumbs toward the middle, the right one
  // higher), and a short arc of motion over each
  const k = 0.56;
  const [R0, L0] = [[16.75, 10.5], [6.75, 15.25]];
  const right = xf(HAND, k, [11.57, 12], R0);
  const left = flipPath(xf(HAND, k, [11.57, 12], [24 - L0[0], L0[1]]));
  const motion = ([cx, cy]) => arc(cx, cy + (3.25 - 12) * k + 4.1, 7.1, -110, -70).d;
  add('sign-language', ['lengua de señas', 'interpretación', 'señas', 'sign language', 'signing', 'sign language interpretation'], [left, right, motion(L0), motion(R0)]);
  FILL['sign-language'] = { solid: [0, 1], lines: [2, 3] };
  PARTS['sign-language'] = { hands: [0, 1], motion: [2, 3] };
}
{
  // Interpreter: nucleo's person, smaller at the left, a hand raised beside the shoulder and two
  // ticks of motion
  // The head rises 0.5 so it keeps the person's 2.45 from the shoulders at this size
  const [hd, bd] = N.person.d.map((d, i) => xf(d, 0.8, [12, 20.6], [9, 20.6 - (i ? 0 : 0.5)]));
  const hand = xf(HAND, 0.42, [11.57, 12], [18.75, 12]);
  add('sign-language-interpreter', ['intérprete de señas', 'intérprete', 'lengua de señas', 'sign language interpreter', 'interpreter', 'signer'], [hd, bd, hand, line([17.25, 5.25], [16.5, 3.25]), line([20.5, 5.25], [21.25, 3.25])]);
  FILL['sign-language-interpreter'] = { solid: [0, 1, 2], wire: [3, 4] };
  PARTS['sign-language-interpreter'] = { person: [0, 1], hand: [2], motion: [3, 4] };
}
{
  // Text telephone: nucleo's handset lying across the top of a small keyboard with two rows of keys.
  // The keys are the dense dots 3.5 apart across and 3.35 down, as the calendar's days (2.5 apart,
  // they ran together into figures of eight at 2.1)
  const handset = xf(turnPath(N.phone.d[0], -45), 0.68, [12, 12], [12, 6]);
  const kb = sq(3.75, 11.75, 16.5, 9.5, 2.75, BR);
  const keys = [14.9, 18.25].flatMap((y) => [0, 1, 2, 3].map((i) => dot(6.75 + i * 3.5, y, 0.3)));
  add('text-telephone', ['teléfono de texto', 'tty', 'teletipo', 'text telephone', 'tty', 'relay service'], [handset, kb, ...keys]);
  FILL['text-telephone'] = { solid: [0, 1], cut: keys.map((_, i) => i + 2) };
  PARTS['text-telephone'] = { handset: [0], keyboard: [1, ...keys.map((_, i) => i + 2)] };
}
{
  // Captioned call: nucleo's handset with two caption lines under it, the bottom one shorter
  const handset = xf(N.phone.d[0], 0.68, [12, 3.3], [12, 2.75]);
  add('phone-captions', ['llamada subtitulada', 'subtítulos en llamada', 'teléfono', 'captioned call', 'live captions', 'call captions'], [handset, hl(17.5, 4.25, 19.75), hl(20.75, 7.75, 16.25)]);
  FILL['phone-captions'] = { solid: [0], wire: [1, 2] };
  PARTS['phone-captions'] = { handset: [0], captions: [1, 2] };
}
{
  // Flash alerts: dispositivos' phone back (to the left) with its flash dot and three short rays
  // bursting from it past the phone's edge
  const B = dispositivos.icons['smartphone-back'].d.map((d) => xf(d, 1, [0, 0], [-3, 0]));
  const flash = [10.75, 6.5];
  const rays = [-18, 8, 34].map((a) => line(polar(...flash, 8.5, a), polar(...flash, 10.85, a)));
  add('flash-notification', ['alerta con flash', 'led de notificación', 'aviso visual', 'flash alert', 'led flash', 'visual alert'], [...B, ...rays]);
  FILL['flash-notification'] = { solid: [0], cut: [1, 2, 3], lines: [4, 5, 6] };
  PARTS['flash-notification'] = { phone: [0, 1, 2], flash: [3], rays: [4, 5, 6] };
}

// ── Cognitive accessibility ───────────────────────────────────────────────────────────────────
{
  // Easy read: a page (square, the signature corner) in two rows, each a picture and one short line
  const page = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
  const pics = [sq(6.25, 6.25, 4.75, 4.75, 1.5), sq(6.25, 13, 4.75, 4.75, 1.5)];
  add('easy-read', ['lectura fácil', 'lenguaje sencillo', 'pictogramas', 'easy read', 'plain language', 'easy to read'], [page, ...pics, hl(8.6, 14, 17.75), hl(15.4, 14, 17.75)]);
  FILL['easy-read'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['easy-read'] = { page: [0], pictures: [1, 2], text: [3, 4] };
}
{
  // Communication board: the set's speech bubble (the drop) holding a 2 × 2 grid of symbols
  const bubble = N.comment.d[0];
  const cells = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => sq(7.75 + i * 6, 7.75 + j * 6, 3, 3, 1));
  add('communication-board', ['tablero de comunicación', 'pictogramas', 'caa', 'communication board', 'aac', 'picture symbols'], [bubble, ...cells]);
  FILL['communication-board'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['communication-board'] = { bubble: [0], symbols: [1, 2, 3, 4] };
}
{
  // Cognition: a head in profile and, inside it, a small looping spiral, a path of thought
  const [c, r] = [[11, 10.25], 7.5];
  const s0 = polar(...c, r, 122.5);
  const headD = `M${f(s0[0])} 21.25V${f(s0[1])}${arcTo(...c, r, 122.5, 360 - 17)}L20.6 13.25A0.75 0.75 0 0 1 19.95 14.4H18.75V16.25A2 2 0 0 1 16.75 18.25H14.75V21.25`;
  const spiral = (() => {
    const pts = [];
    for (let t = 0; t <= 1; t += 0.02) {
      const a = -90 + t * 390;
      pts.push(polar(...c, 1 + t * 3.25, a));
    }
    return `M${pts.map(pt).join('L')}`;
  })();
  add('cognition', ['accesibilidad cognitiva', 'memoria', 'neurodivergente', 'cognitive accessibility', 'cognition', 'neurodiversity'], [headD, spiral]);
  FILL.cognition = { solid: [`${headD}Z`], cut: [1] };
  PARTS.cognition = { head: [0], thought: [1] };
}

// ── Audits and settings ───────────────────────────────────────────────────────────────────────
{
  // sistema's accessibility figure, 0.6 to the left and 0.25 up in its ring: under the badge, its right arm and the
  // piece of the disc below it keep their shape at every weight (in place, the arm ran along the
  // badge's clearance)
  const A = S.accessibility;
  const FIG = A.d.slice(1).map((d) => xf(d, 1, [0, 0], [-0.6, -0.25]));
  for (const [name, kind, tags] of [
    ['accessibility-check', 'check', ['accesibilidad aprobada', 'auditoría', 'wcag', 'accessibility passed', 'a11y check', 'wcag compliant']],
    ['accessibility-alert', 'alert', ['problema de accesibilidad', 'error de accesibilidad', 'auditoría', 'accessibility issue', 'a11y error', 'audit warning']],
    ['accessibility-gear', 'gear', ['ajustes de accesibilidad', 'configuración', 'menú de accesibilidad', 'accessibility settings', 'a11y settings', 'accessibility menu']],
    ['accessibility-search', 'search', ['inspector de accesibilidad', 'árbol de accesibilidad', 'revisar', 'accessibility inspector', 'a11y audit', 'accessibility tree']],
  ]) {
    add(name, tags, [A.d[0], ...FIG], { badge: badge(kind) });
    FILL[name] = { solid: [0], cut: [1, 2, 3, 4] };
    PARTS[name] = { ring: [0], figure: [1, 2, 3, 4] };
  }
  const C = S.contrast;
  for (const [name, kind, tags] of [
    ['contrast-check', 'check', ['contraste suficiente', 'wcag', 'colores', 'contrast passes', 'contrast checker', 'color contrast']],
    ['contrast-alert', 'alert', ['contraste bajo', 'wcag', 'colores', 'low contrast', 'contrast fails', 'contrast error']],
  ]) {
    // The last hatch line runs entirely under the badge: it is left out. Filled, the split stops
    // short of the badge's clearance (where they met, the disc's halves lost their shape at 2.1)
    add(name, tags, C.d.slice(0, 4), { badge: badge(kind) });
    FILL[name] = { solid: C.fill.solid, cut: [line([12, 3], [12, 11.25]), C.fill.cut[1], C.fill.cut[2]] };
    PARTS[name] = { disc: [0], half: [1, 2, 3] };
  }
}
{
  // Accessible document: archivos' file with the accessibility figure (head and outstretched arms,
  // no ring) as a piece of its own at the lower right
  const file = archivos.icons.file.d[0];
  const headC = [17.25, 12.6];
  const arms = rline([[13, 15.75], [17.25, 16.4], [21.5, 15.75]], [0, 0.8, 0]);
  const torso = line([17.25, 16.4], [17.25, 18.25]);
  const legs = line([15.4, 21.25], [17.25, 18.25], [19.1, 21.25]);
  const fig = [dot(...headC), arms, torso, legs];
  const knock = roundpoly([[17.25, 11.25], [21.5, 15.25], [21.5, 16.25], [19.75, 21.75], [14.75, 21.75], [13, 16.25], [13, 15.25]], 1);
  add('file-accessible', ['documento accesible', 'pdf etiquetado', 'declaración de accesibilidad', 'accessible document', 'tagged pdf', 'accessibility statement'], [file], { badge: own(fig, knock, { solid: [fig[0], ...[arms, torso, legs].map(trace)] }) });
  FILL['file-accessible'] = { solid: [0] };
  PARTS['file-accessible'] = { file: [0] };
}
{
  // Highlight links: nucleo's link, smaller, over a long marker bar
  const lk = N.link.d.map((d) => xf(d, 0.9, [12, 12], [12, 8.75]));
  add('link-highlight', ['resaltar enlaces', 'subrayar vínculos', 'enlaces', 'highlight links', 'underline links', 'link highlighting'], [...lk, capsule(2.75, 17.5, 18.5, 3.5)]);
  FILL['link-highlight'] = { solid: [3], wire: [0, 1, 2] };
  PARTS['link-highlight'] = { link: [0, 1, 2], marker: [3] };
}
{
  // Touch target: a small pill button inside a larger dashed square, its hit area
  const [x0, x1, r] = [3.25, 20.75, 4];
  const corner = (cx, cy, a) => arc(cx, cy, r, a, a + 90).d;
  const ext = (p, q) => line(p, q);
  const dashes = [
    `${ext([x0, x0 + r + 0.25], [x0, x0 + r])}${corner(x0 + r, x0 + r, 180).replace(/^M[^A]+/, '')}L${f(x0 + r + 0.25)} ${f(x0)}`,
    `${ext([x1 - r - 0.25, x0], [x1 - r, x0])}${corner(x1 - r, x0 + r, 270).replace(/^M[^A]+/, '')}L${f(x1)} ${f(x0 + r + 0.25)}`,
    `${ext([x1, x1 - r - 0.25], [x1, x1 - r])}${corner(x1 - r, x1 - r, 0).replace(/^M[^A]+/, '')}L${f(x1 - r - 0.25)} ${f(x1)}`,
    `${ext([x0 + r + 0.25, x1], [x0 + r, x1])}${corner(x0 + r, x1 - r, 90).replace(/^M[^A]+/, '')}L${f(x0)} ${f(x1 - r - 0.25)}`,
    hl(x0, 10.6, 13.4), hl(x1, 10.6, 13.4), vl(x0, 10.6, 13.4), vl(x1, 10.6, 13.4),
  ];
  add('touch-target', ['área táctil', 'tamaño de toque', 'zona de toque', 'touch target', 'tap target', 'hit area'], [capsule(7.75, 9.5, 8.5, 5), ...dashes]);
  FILL['touch-target'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7, 8] };
  PARTS['touch-target'] = { button: [0], area: [1, 2, 3, 4, 5, 6, 7, 8] };
}
{
  // Focus order: three small boxes in a zigzag, joined by a path that turns at each and ends in an
  // arrowhead before the last
  const box = (x, y) => sq(x, y, 6, 4.5, 1.5);
  const path = rline([[9.25, 5.5], [17.75, 5.5], [17.75, 9.75]], [0, 1.25, 0]);
  const path2 = rline([[17.75, 14.25], [17.75, 18.5], [12.25, 18.5]], [0, 1.25, 0]);
  add('focus-order', ['orden de foco', 'navegación con teclado', 'tabulación', 'focus order', 'tab order', 'keyboard navigation'], [box(3.25, 3.25), box(14.75, 9.75), box(3.25, 16.25), path, path2, head([12.25, 18.5], [-1, 0], 2.25)]);
  FILL['focus-order'] = { solid: [0, 1, 2], wire: [3, 4, 5] };
  PARTS['focus-order'] = { boxes: [0, 1, 2], path: [3, 4, 5] };
}
{
  // Voice control: comunicacion's microphone with the engine's pointer as a piece of its own at the
  // lower right
  const M = comunicacion.icons.microphone;
  const ptr = cursor([14.5, 12.25], 0.5);
  add('voice-control', ['control por voz', 'acceso por voz', 'comandos de voz', 'voice control', 'voice access', 'voice commands'], [...M.d], { badge: own([ptr], ptr, { solid: [ptr] }) });
  FILL['voice-control'] = { solid: M.fill.solid, lines: M.fill.lines };
  PARTS['voice-control'] = { mic: [0], holder: [1, 2] };
}
{
  // Adaptive switch: the big round button seen from above and in front, a wide, squat disc (its top
  // face an ellipse, its side a short band), and a short arrow pressing down on it. (A dome on a base
  // in profile was restaurante's service bell.)
  const [cy, rx, ry, h] = [13.5, 8.75, 3.25, 4];
  const top = `M${f(12 - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 1 ${f(12 + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 1 ${f(12 - rx)} ${f(cy)}Z`;
  const side = `M${f(12 - rx)} ${f(cy)}V${f(cy + h)}A${f(rx)} ${f(ry)} 0 0 0 ${f(12 + rx)} ${f(cy + h)}V${f(cy)}`;
  const tip = cy - ry - 3;
  add('adaptive-switch', ['pulsador adaptado', 'botón grande', 'acceso por conmutador', 'adaptive switch', 'switch access', 'big button'], [side, top, vl(12, tip - 4, tip), head([12, tip], [0, 1], 2.5)]);
  FILL['adaptive-switch'] = { solid: [`${side}Z`, top], cut: [`M${f(12 - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 0 0 ${f(12 + rx)} ${f(cy)}`], lines: [2, 3] };
  PARTS['adaptive-switch'] = { base: [0], button: [1], arrow: [2, 3] };
}
{
  // Audio captcha: controles' captcha box with its check, and in place of the distorted text, nucleo's
  // speaker cone and one wave, smaller
  const K = controles.icons.captcha;
  const sp = [N.speaker.d[0], N.waves.d[1]].map((d) => xf(d, 0.52, [3.6, 12], [13.1, 12]));
  add('captcha-audio', ['captcha de audio', 'verificación por audio', 'captcha', 'audio captcha', 'audio challenge', 'accessible captcha'], [K.d[0], ...sp], { badge: K.badge });
  FILL['captcha-audio'] = { solid: [0, 1], lines: [2] };
  PARTS['captcha-audio'] = { box: [0], speaker: [1, 2] };
}

// ── Fill, parts, motion, mirror, variants ─────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// Where the snap leaves a smudge, a drawing of its own on the pixel grid (pixel centers at
// 0.75 + 1.5k), with fewer pieces: the fading eye as its left half, its pupil and two bars that
// shorten; the board's symbols as dots; the describing eye without its pupil; the captcha's box and
// a pixel speaker with its wave
{
  const eyeL = 'M12.75 6.75C8.25 6.75 5.25 8.25 2.25 12C5.25 15.75 8.25 17.25 12.75 17.25';
  const bars = [vl(15.75, 8.25, 15.75), vl(18.75, 9.75, 14.25)];
  icons['eye-low-vision'].small = { d: [eyeL, dot(9.75, 12), ...bars], fill: { solid: [`${eyeL}Z`], cut: [dot(9.75, 12)], wire: bars } };
  const board = [dot(9.75, 9.75), dot(14.25, 9.75), dot(9.75, 14.25), dot(14.25, 14.25)];
  icons['communication-board'].small = { d: [N.comment.d[0], ...board], fill: { solid: [N.comment.d[0]], cut: board } };
  const eye = 'M2.25 12C4.5 8.25 6.75 6.75 8.25 6.75S12 8.25 14.25 12C12 15.75 9.75 17.25 8.25 17.25S4.5 15.75 2.25 12Z';
  icons['audio-description'].small = { d: [eye, dot(8.25, 12), ...icons['audio-description'].d.slice(2)], fill: { solid: [eye], cut: [dot(8.25, 12)], lines: icons['audio-description'].d.slice(2) } };
  const K = controles.icons.captcha.small.d[0];
  const speaker = roundpoly([[12.75, 10.5], [14.25, 10.5], [17.25, 8.25], [17.25, 15.75], [14.25, 13.5], [12.75, 13.5]], 0.3);
  const wave = 'M20.25 9.75Q21.75 12 20.25 14.25';
  icons['captcha-audio'].small = { d: [K, speaker, wave], fill: { solid: [K, speaker], lines: [wave] } };
}
// The automatic door's arrows joined into one and its panels two pixels clear of each other, so each piece keeps a pixel of
// paper; the braille display's and the text telephone's dense dots one pixel each, two
// pixels apart; the big button's top face a capsule over its band, the arrow on a pixel column
{
  const PX = (k) => 0.75 + 1.5 * k;
  const frame = rline([[PX(2), PX(14)], [PX(2), PX(1)], [PX(13), PX(1)], [PX(13), PX(14)]], [0, 1, 1, 0]);
  const leaf = (k, jamb) => [[PX(k), PX(14)], [PX(k), PX(7)], [PX(jamb), PX(7)]];
  const panels = [rline(leaf(6, 2), [0, 0.75, 0]), rline(leaf(9, 13), [0, 0.75, 0])];
  const solid = [[6, 2], [9, 13]].map(([k, j]) => `${rline([...leaf(k, j), [PX(j), PX(14)]], [0, 0.75, 0, 0])}Z`);
  // The two arrows as one, with a head at each end: two-pixel arrows read as plus signs
  const arrows = [line([PX(4), PX(4)], [PX(11), PX(4)]), `${line([PX(5), PX(3)], [PX(4), PX(4)], [PX(5), PX(5)])}${line([PX(10), PX(3)], [PX(11), PX(4)], [PX(10), PX(5)])}`];
  icons['door-automatic'].small = { d: [frame, ...panels, ...arrows], fill: { solid, wire: [frame, ...arrows] } };

  const pix = (x, y) => circ(x, y, 0.1);
  const box = sq(PX(2), PX(4), PX(13) - PX(2), PX(12) - PX(4), 2.25, BR);
  const cell = (k0, on) => on.map((n) => pix(PX(k0 + (n > 3 ? 2 : 0)), PX(6 + ((n - 1) % 3) * 2)));
  const pins = [...cell(4, [1, 2, 4]), ...cell(9, [1, 3, 4, 5, 6])];
  icons['braille-display'].small = { d: [box, ...pins], fill: { solid: [box], cut: pins } };

  const tt = icons['text-telephone'];
  const kb = sq(PX(2), PX(8), PX(14) - PX(2), PX(14) - PX(8), 2.25, BR);
  const keys = [PX(10), PX(12)].flatMap((y) => [5, 7, 9, 11].map((k) => pix(PX(k), y)));
  icons['text-telephone'].small = { d: [tt.d[0], kb, ...keys], fill: { solid: [tt.d[0], kb], cut: keys } };

  const cap = capsule(PX(2), PX(7), PX(14) - PX(2), PX(10) - PX(7));
  const band = `M${f(PX(2))} ${f(PX(7) + 2.25)}V${f(PX(10) + 0.75)}A9 3 0 0 0 ${f(PX(14))} ${f(PX(10) + 0.75)}V${f(PX(7) + 2.25)}`;
  const arrow = [line([PX(8), PX(1)], [PX(8), PX(5)]), line([PX(6), PX(3)], [PX(8), PX(5)], [PX(10), PX(3)])];
  icons['adaptive-switch'].small = { d: [band, cap, ...arrow], fill: { solid: [`${band}Z`, cap], lines: arrow } };
}

// Motion: each icon's own gesture (draw, bounce and replace need no data)
const MOTION = {
  'wheelchair-motion': { effect: 'slide', vector: [2, 0] },
  'wheelchair-ramp': { effect: 'slide', parts: ['head', 'body', 'wheel'], vector: [2, -0.85] },
  'wheelchair-lift': { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] },
  'wheelchair-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'wheelchair-question': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'elevator-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'hearing-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'accessibility-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'contrast-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'accessibility-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'accessibility-gear': { effect: 'spin', parts: ['badge'], origin: BC },
  'mobility-scooter': { effect: 'slide', vector: [2, 0] },
  rollator: { effect: 'slide', vector: [2, 0] },
  'stair-lift': { effect: 'slide', parts: ['badge'], vector: [1.8, -1.6] },
  'flash-notification': { effect: 'beat', parts: ['rays'], origin: [10.75, 6.5] },
  'cursor-highlight': { effect: 'beat', parts: ['halo'], origin: [9.25, 8.5] },
  'adaptive-switch': { effect: 'bounce', parts: ['arrow'], vector: [0, 1.5] },
  'sign-language': { effect: 'wiggle', parts: ['hands'], origin: [12, 20] },
  'sign-language-interpreter': { effect: 'wiggle', parts: ['hand'], origin: [18, 15.5] },
  cognition: { effect: 'spin', parts: ['thought'], origin: [11, 10.25] },
  'door-automatic': { effect: 'beat', parts: ['arrows'], origin: [12, 7.25] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// The meter's needle shows a value: from the left end of the scale (0) to the right (1)
icons['noise-level'].value = { turn: { parts: ['needle'], origin: [9.25, 15.5], from: -172, to: -8, at: -32 } };

// Mirror: what moves or reads one way flips in right-to-left languages (the rider rolling, the ramp
// it climbs, sound leaving a screen or an eye, the order focus visits, a reading line)
for (const name of ['wheelchair-motion', 'wheelchair-ramp', 'screen-reader', 'audio-description', 'focus-order', 'reading-guide']) icons[name].mirror = true;

// Variants. Already enclosed (a ring, a disc, a tile, a page, a window, a frame): no enclosure of
// the same shape again
const off = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
off(['accessibility-check', 'accessibility-alert', 'accessibility-gear', 'accessibility-search', 'contrast-check', 'contrast-alert'], { circle: false });
off(['easy-read', 'touch-target', 'reader-mode', 'door-accessible', 'door-automatic', 'wheelchair-lift'], { square: false });
// A slash says nothing over a status badge, over what is already an "off" (reduce motion) or over a
// measure or an order
off(['wheelchair-check', 'wheelchair-alert', 'wheelchair-question', 'elevator-alert', 'hearing-alert', 'accessibility-check', 'accessibility-alert', 'accessibility-gear', 'accessibility-search', 'contrast-check', 'contrast-alert', 'reduce-motion', 'cursor-large', 'door-width', 'touch-target', 'focus-order', 'color-blindness'], { slash: false });

export default { category: 'accesibilidad', label: 'Accesibilidad', icons };
