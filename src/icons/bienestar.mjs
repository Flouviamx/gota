// Bienestar (wellbeing): meditation and the mind, breathing, yoga poses, sleep, the spa and its
// rituals, journaling, support, stress and recovery, habits and screen time. Everything is computed
// with the engine (engine/geometry.mjs) and the rules in DESIGN.md. Its constructions:
// - the whole figure is lugares' walking figure as personas and fitness draw it: a round head of
//   r 1.9 standing 2.35 clear of the shoulders, one stroke for the torso and one per limb, rounded at
//   the joints (r 0.6); yoga poses in profile facing right, on a floor line where the pose needs one;
// - the mind is anatomia's head in profile, a glyph inside it where its brain sits;
// - the set's shapes: the heart (edicion's), the moon (lugares'), the progress ring (personas'), the
//   journal (archivos'), the bed, the bathtub and the hot tub (hogar's), the laptop and the battery
//   (dispositivos'), the flame, the tree and the cloud (lugares'), the calendar and the bolt (nucleo's).
// Badges are the engine's; a piece that sits in front of another is a custom badge and the engine
// clears what lies behind it.
import { arc, badge, circ, dot, drop, f, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
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
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const angOf = (c, p) => deg(Math.atan2(p[1] - c[1], p[0] - c[0]));
/** The point `l` away from `p` at `a` degrees (0 = right, 90 = down). */
const go = (p, a, l) => add2(p, [l * Math.cos(rad(a)), l * Math.sin(rad(a))]);
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Just the `A…` segment of an arc, to chain it inside a path. */
const arcTo = (c, r, a0, a1) => arc(c[0], c[1], r, a0, a1).d.replace(/^M[^A]*/, '');

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
/** Ellipse of semi-axes rx, ry at c, tilted `t` degrees, as two half arcs. */
function ellipse([cx, cy], rx, ry, t = 0) {
  const a = go([cx, cy], t + 180, rx);
  const b = go([cx, cy], t, rx);
  return `M${pt(a)}A${f(rx)} ${f(ry)} ${f(t)} 1 0 ${pt(b)}A${f(rx)} ${f(ry)} ${f(t)} 1 0 ${pt(a)}Z`;
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
/** lugares' crescent moon: the disc of radius R minus the one of radius r centered at `ic`. */
function moon(c, R, ic, r) {
  const [p, q] = meet([...c, R], [...ic, r]);
  return `M${pt(p)}A${f(R)} ${f(R)} 0 1 0 ${pt(q)}A${f(r)} ${f(r)} 0 0 1 ${pt(p)}Z`;
}
/** The set's moon (lugares') at scale s, its disc centered at `to`. */
const setMoon = (s, to) => place(moon([11.5, 12.5], 8.5, [16.75, 7.25], 6.75), s, [11.5, 12.5], to);
/**
 * The outline of overlapping discs [x, y, r] taken clockwise, each meeting the next: on a base line
 * `base`, an open mound from its left end to its right (foam on a rim); otherwise closed (a spike of buds).
 */
function mound(discs, base) {
  const n = discs.length;
  const mid = [discs.reduce((s, d) => s + d[0], 0) / n, discs.reduce((s, d) => s + d[1], 0) / n];
  const joins = [];
  for (let i = 0; i < (base === undefined ? n : n - 1); i++) {
    const [p, q] = meet(discs[i], discs[(i + 1) % n]);
    joins.push(base === undefined ? (len(sub(p, mid)) > len(sub(q, mid)) ? p : q) : p[1] < q[1] ? p : q);
  }
  const seg = (d, from, to) => {
    const a0 = angOf(d, from);
    let a1 = angOf(d, to);
    while (a1 <= a0) a1 += 360;
    return `A${f(d[2])} ${f(d[2])} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${pt(to)}`;
  };
  if (base === undefined) return `M${pt(joins[n - 1])}${discs.map((d, i) => seg(d, joins[(i - 1 + n) % n], joins[i])).join('')}Z`;
  const [a, b] = [discs[0], discs[n - 1]];
  const ends = [
    [a[0] - Math.sqrt(a[2] ** 2 - (base - a[1]) ** 2), base],
    [b[0] + Math.sqrt(b[2] ** 2 - (base - b[1]) ** 2), base],
  ];
  const stops = [ends[0], ...joins, ends[1]];
  return `M${pt(ends[0])}${discs.map((d, i) => seg(d, stops[i], stops[i + 1])).join('')}`;
}
/** A smooth open path through the points (Catmull-Rom as cubics). */
function smooth(pts, k = 1 / 6) {
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${pt(add2(p1, mul(sub(p2, p0), k)))} ${pt(sub(p2, mul(sub(p3, p1), k)))} ${pt(p2)}`;
  }
  return d;
}

// The set's heart (edicion's): two lobes of r 4.75 meeting at the top, the point at the bottom. Its
// box runs 3.3–20.7 × 3.1–20.5; `heartAt` scales it about the middle of that box.
const HEART = 'M12 20.5L4.03 12A4.75 4.75 0 1 1 12 7.23A4.75 4.75 0 1 1 19.97 12Z';
const HEART_C = [12, 11.8];
const heartAt = (c, s) => place(HEART, s, HEART_C, c);

// anatomia's head in profile, facing right (its `head-side`): the skull, the face with the nose at
// (20.4, 12.1) and the neck running down to the bottom edge. A glyph inside it sits where anatomia
// puts the brain, centered at MIND.
const HEAD =
  'M15 21.75C15 21.75 14.75 19.9 15 19.25C15.25 18.6 15.9 18.18 16.5 17.85C17.1 17.53 18.17 17.68 18.6 17.3C19.03 16.93 19.1 16.05 19.1 15.6C19.1 15.15 18.57 14.91 18.6 14.6C18.63 14.29 19.28 13.92 19.3 13.75C19.33 13.58 18.78 13.01 18.85 12.9C18.92 12.79 20.43 12.44 20.4 12.1C20.37 11.76 18.83 10.23 18.55 9.5C18.28 8.78 18.83 8.24 18.75 7.75C18.67 7.26 18.67 5.5 17.75 4.6C16.83 3.7 14.96 2.53 13.25 2.35C11.54 2.17 9.03 2.52 7.5 3.5C5.98 4.48 4.56 6.67 4.1 8.25C3.64 9.83 4.27 11.67 4.75 13C5.23 14.33 6.38 15.29 7 16.25C7.63 17.21 8.25 17.83 8.5 18.75C8.75 19.67 8.5 21.75 8.5 21.75';
const MIND = [11.25, 9.4];

const icons = {};
/** Fill specs, named parts and motion collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── The whole figure ──────────────────────────────────────────────────────────────────────────
// fitness' construction, to the hundredth: the head a circle of r 1.9 standing 2.35 clear of the
// shoulders, the torso one stroke from the shoulders to the hips, each limb one stroke rounded at its
// joints. In profile it faces right.
const HR = 1.9;
const GAP = 2.35;
/** The head's center, `hr + gap` from the shoulders at `a` degrees (0 = right, -90 = up). */
const headAt = (S, a, hr = HR, gap = GAP) => go(S, a, hr + gap);
/** A figure from its joints: [head, torso, ...legs, ...arms]. Legs meet at the hip and arms at the shoulders unrounded. */
function figure({ H, hr = HR, S, P, legs, arms, jr = 0.6 }) {
  const sharp = (pts, at) => rl(pts, pts.map((p) => (p[0] === at[0] && p[1] === at[1] ? 0 : jr)));
  return [circ(...H, hr), line(S, P), ...legs.map((l) => sharp(l, P)), ...arms.map((a) => sharp(a, S))];
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

// ── Meditation ────────────────────────────────────────────────────────────────────────────────
/**
 * Seated cross-legged, from the front: the head over a short torso, the folded legs a low diamond
 * (the thighs out to the knees, the shins back in to the crossed feet) and the hands resting on the
 * knees. `k` scales it about its hips, at `c`.
 */
function meditator(c = [12, 14], k = 1) {
  const P = c;
  const S = add2(P, [0, -5 * k]);
  const H = add2(S, [0, -(HR * k + GAP)]);
  const K = (m) => add2(P, [m * 8.25 * k, 3 * k]);
  const B = add2(P, [0, 5.25 * k]);
  const E = (m) => add2(S, [m * 4.75 * k, 2.75 * k]);
  const W = (m) => lerp(P, K(m), 0.5);
  return [
    circ(...H, HR * k),
    line(S, P),
    roundpoly([P, K(1), B, K(-1)], [0.6, 1.2, 0.6, 1.2].map((r) => r * k)),
    rl([W(-1), E(-1), S, E(1), W(1)], [0, 0.6 * k, 0, 0.6 * k, 0]),
  ];
}
const MED = meditator([12, 13.75]);
add('meditation', ['meditación', 'atención plena', 'calma', 'meditation', 'mindfulness', 'zen'], MED);
FILL.meditation = { solid: [0, 2], wire: [1, 3] };
PARTS.meditation = { head: [0], body: [1], legs: [2], arms: [3] };
add('meditation-clock', ['temporizador de meditación', 'minutos de atención plena', 'sesión', 'meditation timer', 'mindful minutes'], MED, { badge: badge('clock') });
FILL['meditation-clock'] = FILL.meditation;
PARTS['meditation-clock'] = PARTS.meditation;
{
  // Guided meditation: the meditator a little smaller and to the left, two sound arcs out from its
  // head (nucleo's waves, centered on the head, clear of the arms).
  const k = 0.8;
  const c = [9, 15.75];
  const d = meditator(c, k);
  const H = [c[0], c[1] - 5 * k - (HR * k + GAP)];
  const arcs = [4.5, 7.35].map((r) => arc(...H, r, -45, 25).d);
  add('meditation-audio', ['meditación guiada', 'audio', 'sesión guiada', 'guided meditation', 'meditation audio'], [...d, ...arcs]);
  FILL['meditation-audio'] = { solid: [0, 2], wire: [1, 3], lines: [4, 5] };
  PARTS['meditation-audio'] = { head: [0], body: [1], legs: [2], arms: [3], wave: [4, 5] };
}

// ── Lotus ─────────────────────────────────────────────────────────────────────────────────────
// Five petals, each a vesica (the meeting of two discs): the middle one upright and in front, a pair
// behind it leaning out and a lower pair behind those. A petal behind another stops 1.5 clear of it
// (3 center to center), as lugares' planet ends the back of its ring; over a short water line.
/** A vesica from `a` to `b`, `w` at its widest: its two circles and an inside test. */
function vesica(a, b, w) {
  const L = len(sub(b, a));
  const R = (L * L) / 4 / (2 * w) + w / 2;
  const m = lerp(a, b, 0.5);
  const u = unit(sub(b, a));
  const n = [-u[1], u[0]];
  const c1 = add2(m, mul(n, R - w));
  const c2 = sub(m, mul(n, R - w));
  return { a, b, R, c1, c2, inside: (p) => len(sub(p, c1)) < R && len(sub(p, c2)) < R };
}
/** The short way round from angle a0 to a1 (a vesica's arcs are under 180°). */
const short = (a0, a1) => (a1 - a0 > 180 ? a1 - 360 : a0 - a1 > 180 ? a1 + 360 : a1);
/** A vesica's closed outline: along its first circle from the base to the tip, back along the other. */
const vesicaPath = (v) =>
  `M${pt(v.a)}${arcTo(v.c1, v.R, angOf(v.c1, v.a), short(angOf(v.c1, v.a), angOf(v.c1, v.b)))}${arcTo(v.c2, v.R, angOf(v.c2, v.b), short(angOf(v.c2, v.b), angOf(v.c2, v.a)))}Z`;
/** A vesica's outline, as sampled points (to measure the clearance of the petals behind it). */
const outlinePts = (v) =>
  [v.c1, v.c2].flatMap((c) => {
    const a0 = angOf(c, v.a);
    const a1 = short(a0, angOf(c, v.b));
    return Array.from({ length: 80 }, (_, i) => polar(...c, v.R, a0 + ((a1 - a0) * i) / 79));
  });
/** The part of a petal's outline that stays 1.5 clear of the petals in front: an open path through its tip. */
function behind(v, front) {
  const pts = front.flatMap(outlinePts);
  const clear = (p) => !front.some((s) => s.inside(p)) && Math.min(...pts.map((q) => len(sub(p, q)))) >= 3;
  // Walk each arc from the tip back toward the base until it stops being clear
  const run = (c) => {
    const a0 = angOf(c, v.b);
    const a1 = short(a0, angOf(c, v.a));
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const ok = Array.from({ length: 24 }, (_, j) => polar(...c, v.R, a0 + (a1 - a0) * mid * (j / 23))).every(clear);
      if (ok) lo = mid;
      else hi = mid;
    }
    return [a0, a0 + (a1 - a0) * lo];
  };
  const [p0, p1] = run(v.c1);
  const [q0, q1] = run(v.c2);
  // From the end of one arc to the tip, then down the other
  return `M${pt(polar(...v.c1, v.R, p1))}${arcTo(v.c1, v.R, p1, p0)}${arcTo(v.c2, v.R, q0, q1)}`;
}
{
  const mid = vesica([12, 17.25], [12, 3.25], 3.25);
  const tilt = (a, l, w, base) => vesica(base, go(base, a, l), w);
  const inner = [tilt(-133, 11.75, 2.75, [12.5, 16.75]), tilt(-47, 11.75, 2.75, [11.5, 16.75])];
  const outer = [tilt(-165, 10, 2.25, [12, 17.5]), tilt(-15, 10, 2.25, [12, 17.5])];
  const d = [
    vesicaPath(mid),
    ...inner.map((v) => behind(v, [mid])),
    ...outer.map((v) => behind(v, [mid, ...inner])),
    hl(20.75, 9, 15),
  ];
  add('lotus', ['loto', 'spa', 'calma', 'bienestar', 'lotus', 'spa', 'wellness'], d);
  FILL.lotus = { solid: [0], lines: [1, 2, 3, 4], wire: [5] };
  PARTS.lotus = { petal: [0], petals: [1, 2, 3, 4], water: [5] };
}

// ── Sound and balance ─────────────────────────────────────────────────────────────────────────
{
  // Singing bowl: wide and round, its rim turning in (a Tibetan bowl: its sides bulge out past the
  // rim), one sound arc out of each side, centered on the bowl. No striker: a stick in or over a bowl
  // reads as cocina's mortar and pestle.
  const c = [12, 13.5];
  const [rx, ry, rim] = [6, 5, 11];
  const dx = rx * Math.sqrt(1 - ((c[1] - rim) / ry) ** 2);
  const bowl = `M${pt([c[0] - dx, rim])}H${f(c[0] + dx)}A${rx} ${ry} 0 1 1 ${pt([c[0] - dx, rim])}Z`;
  const arcs = [arc(...c, 8.85, 160, 220).d, arc(...c, 8.85, -40, 20).d];
  add('singing-bowl', ['cuenco tibetano', 'baño de sonido', 'campana de meditación', 'singing bowl', 'sound bath', 'meditation bell'], [bowl, ...arcs]);
  FILL['singing-bowl'] = { solid: [0], lines: [1, 2] };
  PARTS['singing-bowl'] = { bowl: [0], wave: [1, 2] };
  MOTION['singing-bowl'] = { effect: 'wiggle', parts: ['bowl'], origin: [12, 18.5] };
}
{
  // Stacked stones: three smooth pebbles, smaller as they rise and set a little off each other, each
  // 1.5 clear of the one under it.
  const d = [ellipse([12, 18.5], 7.75, 2.5), ellipse([11.25, 11], 5.5, 2, -3), ellipse([12.5, 4.4], 3.5, 1.6, 4)];
  add('stacked-stones', ['piedras apiladas', 'equilibrio', 'calma', 'piedras calientes', 'stacked stones', 'balance', 'cairn'], d);
  FILL['stacked-stones'] = { solid: [0, 1, 2] };
  PARTS['stacked-stones'] = { stones: [0, 1, 2] };
}

// ── Body and mind ─────────────────────────────────────────────────────────────────────────────
{
  // Body scan: personas' standing figure between two corner brackets, the scan line across its chest
  // in front of it (a custom badge: the engine clears the figure behind it).
  const fig = figure({ H: [12, 4.5], S: [12, 8.75], P: [12, 14.25], legs: [[[9.75, 21.25], [12, 14.25], [14.25, 21.25]]], arms: [[[8.95, 13.6], [9.45, 10.65], [12, 8.75], [14.55, 10.65], [15.05, 13.6]]] });
  // personas' arms: the elbows rounded on the way down
  const corner = (x, y, sx, sy) => rl([[x, y + sy * 3.75], [x, y], [x + sx * 3.75, y]], [0, 1.25, 0]);
  const brackets = [corner(2.75, 2.75, 1, 1), corner(21.25, 21.25, -1, -1)];
  const scan = hl(12.5, 2.75, 21.25);
  add('body-scan', ['escaneo corporal', 'conciencia del cuerpo', 'meditación', 'body scan', 'body awareness'], [...fig, ...brackets], {
    badge: { d: [scan], knock: scan },
  });
  FILL['body-scan'] = { solid: [0], wire: [1, 2, 3], lines: [4, 5] };
  PARTS['body-scan'] = { head: [0], body: [1], legs: [2], arms: [3], frame: [4, 5] };
}
{
  // The mind: anatomia's head with one glyph where its brain sits.
  const calm = wave([MIND[0] - 4.125, MIND[1]], 3, 2.75, 1.1);
  add('mind-calm', ['mente en calma', 'atención plena', 'serenidad', 'calm mind', 'mindfulness', 'peace'], [HEAD, calm]);
  const love = heartAt([MIND[0], MIND[1] + 0.2], 0.4);
  add('mind-heart', ['salud mental', 'bienestar emocional', 'emociones', 'mental health', 'emotional wellbeing'], [HEAD, love]);
  // Racing thoughts: a spiral winding in, half circles on two centers 1.5 apart so its turns stay 3 apart and open at every weight
  const twist = `M${pt([MIND[0], MIND[1] + 3.75])}${arcTo(MIND, 3.75, 90, 270)}${arcTo([MIND[0], MIND[1] - 1.5], 2.25, -90, 90)}${arcTo(MIND, 0.75, 90, 270)}`;
  add('mind-tangled', ['ansiedad', 'pensamientos acelerados', 'sobrepensar', 'anxiety', 'overthinking', 'racing thoughts'], [HEAD, twist]);
  add('mind-focus', ['enfoque', 'concentración', 'modo concentración', 'focus', 'concentration', 'focus mode'], [HEAD, circ(...MIND, 3.6), dot(...MIND)]);
  for (const name of ['mind-calm', 'mind-heart', 'mind-tangled']) {
    FILL[name] = { solid: [shut(HEAD)], cut: [1] };
    PARTS[name] = { head: [0], mind: [1] };
  }
  FILL['mind-focus'] = { solid: [shut(HEAD)], cut: [1, 2] };
  PARTS['mind-focus'] = { head: [0], mind: [1, 2] };
  MOTION['mind-heart'] = { effect: 'beat', parts: ['mind'], origin: MIND };
}
{
  // Breath: the head smaller at the bottom left, the air leaving its nose and rising to the right.
  // Breathing in and out share the stream and its arrowhead turns: into the nose or away from it.
  const s = 0.68;
  const head0 = place(HEAD, s, [4.1, 2.35], [2.25, 5.4]);
  // The nose sits at (13.33, 12.03); the air leaves it 2.9 clear, a soft wave of one period
  const y = 12;
  const air = wave([16.25, y], 2, 2.75, 0.9);
  add('breath', ['respiración', 'respirar', 'ejercicio de respiración', 'breath', 'breathing', 'breathwork'], [head0, air]);
  // Breathing in and out: the air a straight arrow, into the nose or away from it (an arrowhead on
  // the wave would lie against its curve)
  add('breath-in', ['inhalar', 'inhalación', 'inspirar', 'inhale', 'breathe in'], [head0, hl(y, 16.25, 21.75), head([16.25, y], [-1, 0], 3)]);
  add('breath-out', ['exhalar', 'exhalación', 'espirar', 'exhale', 'breathe out'], [head0, hl(y, 16.25, 21.75), head([21.75, y], [1, 0], 3)]);
  for (const name of ['breath', 'breath-in', 'breath-out']) {
    FILL[name] = { solid: [shut(head0)], lines: name === 'breath' ? [1] : [1, 2] };
    PARTS[name] = name === 'breath' ? { head: [0], air: [1] } : { head: [0], air: [1], arrow: [2] };
  }
  MOTION.breath = { effect: 'float', parts: ['air'], vector: [1, -0.5] };
  MOTION['breath-in'] = { effect: 'slide', parts: ['air', 'arrow'], vector: [-1, 0] };
  MOTION['breath-out'] = { effect: 'slide', parts: ['air', 'arrow'], vector: [1, 0] };
}
{
  // Box breathing: the square traced once round by an arrow, from a dot at the top back to it; the
  // corners continuous (sq's), the path opened at the top edge.
  const [x, y, w, r] = [4.25, 4.25, 15.5, 2.5];
  const body = sq(x, y, w, w, r).replace(/^M[^c]*/, '').replace(/Z$/, '');
  const p = 1.6 * r;
  const [dotX, gap] = [12.75, 3.55];
  const path = `M${pt([dotX + gap, y])}L${pt([x + w - p, y])}${body}L${pt([dotX - gap, y])}`;
  add('box-breathing', ['respiración cuadrada', 'respiración en caja', '4-4-4-4', 'box breathing', 'square breathing'], [path, head([dotX - gap, y], [1, 0], 3.4), dot(dotX, y)]);
  FILL['box-breathing'] = false;
  PARTS['box-breathing'] = { path: [0], arrow: [1], start: [2] };
  MOTION['box-breathing'] = { effect: 'spin', parts: ['path', 'arrow'], origin: [12, 12] };
}

// ── Yoga and movement ─────────────────────────────────────────────────────────────────────────
{
  // Tree pose, from the front: standing on one leg, the other bent out with its foot against the
  // standing knee (a triangle), the arms raised up and out (wake-up's arms): joined overhead they would
  // ring the head.
  const floor = 21.25;
  const P = [12, 14];
  const S = [12, 8.5];
  const arms = [add2(S, [-5.15, -6.45]), add2(S, [-3.65, -0.98]), S, add2(S, [3.65, -0.98]), add2(S, [5.15, -6.45])];
  const d = [
    ...figure({
      H: headAt(S, -90),
      S,
      P,
      legs: [
        [P, [12, floor]],
        [P, [16, 16.75], [12, 18.5]],
      ],
      arms: [arms],
    }),
    hl(floor, 7.75, 16.25),
  ];
  add('yoga-tree', ['postura del árbol', 'vrksasana', 'equilibrio', 'yoga', 'tree pose', 'balance pose'], d);
  FILL['yoga-tree'] = figFill(d.length);
  PARTS['yoga-tree'] = { head: [0], body: [1], legs: [2, 3], arms: [4], floor: [5] };
}
{
  // Warrior II, in profile: a wide lunge, the front knee bent square over its foot, the back leg
  // straight, the arms one line stretched front and back at the shoulders.
  const floor = 20.75;
  const P = [10.75, 13.75];
  const S = [10.75, 8.25];
  const d = [
    ...figure({
      H: headAt(S, -90),
      S,
      P,
      legs: [
        [P, [15.5, 14.25], [16, floor]],
        [P, [4, floor]],
      ],
      arms: [[[3, 8.25], S, [19.25, 8.25]]],
    }),
    hl(floor, 2.5, 21.5),
  ];
  add('yoga-warrior', ['guerrero', 'virabhadrasana', 'postura de fuerza', 'yoga', 'warrior pose', 'yoga flow'], d);
  FILL['yoga-warrior'] = figFill(d.length);
  PARTS['yoga-warrior'] = figParts(2, 1, { floor: [5] });
}
{
  // Cobra: lying face down, the legs along the floor, the chest lifted on straight arms and the back
  // curving up from the hips.
  const y = 20.75;
  const P = [10.75, y];
  const S = [15.25, 12.25];
  const torso = `M${pt(P)}C${pt([13.5, y])} ${pt([15.25, 16.5])} ${pt(S)}`;
  const d = [circ(...headAt(S, -100), HR), torso, line([2.75, y], P), line(S, [17.25, y])];
  add('yoga-cobra', ['cobra', 'bhujangasana', 'extensión', 'yoga', 'cobra pose', 'backbend'], d);
  FILL['yoga-cobra'] = figFill(d.length);
  PARTS['yoga-cobra'] = figParts(1, 1);
}
{
  // Tai chi: a soft lunge, upright, both arms rounded in front of the chest round a ball they hold:
  // each arm leaves the shoulder on a tangent to the ball's circle and follows it, the upper one over
  // the ball and the lower one under it, the hands facing each other across its front.
  const floor = 21;
  const P = [8.75, 13.5];
  const S = [8.75, 8];
  const [C, r] = [[14.25, 10.5], 3.5];
  // The two tangent points (the shoulder is up and to the left of the ball, at about -156°)
  const toS = angOf(C, S);
  const tan = deg(Math.acos(r / len(sub(S, C))));
  const [upA, lowA] = [toS + tan, toS - tan + 360];
  // Clockwise over the top to the front (-20°), counterclockwise under the bottom to the front (25°)
  const upper = `M${pt(S)}L${pt(polar(...C, r, upA))}${arcTo(C, r, upA, -20)}`;
  const lower = `M${pt(S)}L${pt(polar(...C, r, lowA))}${arcTo(C, r, lowA, 25)}`;
  const d = [
    ...figure({
      H: headAt(S, -90),
      S,
      P,
      legs: [
        [P, [12.25, 16.75], [12.75, floor]],
        [P, [6.25, 17], [4.5, floor]],
      ],
      arms: [],
    }),
    upper,
    lower,
    hl(floor, 2.75, 16.75),
  ];
  add('tai-chi', ['tai chi', 'qigong', 'meditación en movimiento', 'tai chi', 'qigong', 'moving meditation'], d);
  FILL['tai-chi'] = figFill(d.length);
  PARTS['tai-chi'] = figParts(2, 2, { floor: [6] });
}
{
  // Stretching, a side bend from the front: the legs apart, the body leaning well over to the right with
  // the hand on that side down on the thigh, the other arm out from the shoulder and curving up over to
  // the right, its hand stopping above the head's far side (2.85 clear of it: past the top it would
  // hook down and read as a question mark).
  const u = [Math.sin(rad(28)), -Math.cos(rad(28))];
  const P = [10, 14.75];
  const S = add2(P, mul(u, 5.5));
  const H = add2(S, mul(u, HR + GAP));
  const over = smooth([S, [8.75, 8.9], [7.5, 6.5], [8.25, 3.6], [10.75, 2.1]]);
  const d = [...figure({ H, S, P, legs: [[[6.25, 21.25], P, [13.75, 21.25]]], arms: [[S, [15.25, 12.75], [15.25, 16.25]]] }), over];
  add('stretching', ['estiramiento', 'flexibilidad', 'movilidad', 'pausa activa', 'stretching', 'stretch break', 'mobility'], d);
  FILL.stretching = figFill(d.length);
  PARTS.stretching = figParts(1, 2);
}
{
  // Posture: seated upright on a stool in profile, the back straight over the hips and a dashed plumb
  // line behind it.
  const P = [12.75, 15];
  const S = [12.75, 9.5];
  const x = 7.5;
  const dashes = [3, 8, 13, 18].map((y0) => vl(x, y0, y0 + 2));
  const d = [
    ...figure({ H: headAt(S, -90), S, P, legs: [[P, [18.25, 15], [18.25, 21.25]]], arms: [[S, [15.5, 11.5], [17, 15]]] }),
    hl(18, 10.5, 15),
    line([11.25, 18], [10.5, 21.25]),
    line([14.25, 18], [15, 21.25]),
    ...dashes,
  ];
  add('posture', ['postura', 'espalda recta', 'ergonomía', 'siéntate derecho', 'posture', 'ergonomics', 'sit up straight'], d);
  FILL.posture = { solid: [0], wire: [1, 2, 3, 4, 5, 6], lines: [7, 8, 9, 10] };
  PARTS.posture = { ...figParts(1, 1), stool: [4, 5, 6], line: [7, 8, 9, 10] };
}
{
  // Time outdoors: personas' standing figure beside lugares' tree.
  const fig = figure({ H: [5.75, 4.5], S: [5.75, 8.75], P: [5.75, 14.25], legs: [[[3.5, 21.25], [5.75, 14.25], [8, 21.25]]], arms: [[[2.85, 13.4], [3.55, 10.65], [5.75, 8.75], [7.95, 10.65], [8.65, 13.4]]] });
  const tree = ['M12 11A4.25 4.25 0 1 1 7.25 6.76A4.75 4.75 0 1 1 16.75 6.76A4.25 4.25 0 1 1 12 11Z', 'M12 21.25L12 10.25', 'M12 13.75L14.75 11'].map((p) => place(p, 0.62, [12, 21.25], [16.75, 21.25]));
  add('outdoor-time', ['tiempo al aire libre', 'naturaleza', 'luz del día', 'salir', 'outdoor time', 'nature', 'daylight'], [...fig, ...tree]);
  FILL['outdoor-time'] = { solid: [0, 4], wire: [1, 2, 3, 5] };
  PARTS['outdoor-time'] = { head: [0], body: [1], legs: [2], arms: [3], tree: [4, 5, 6] };
}

// ── Sleep ─────────────────────────────────────────────────────────────────────────────────────
// hogar's bed from the side (the headboard, the base and the foot) with someone in it: the head
// floats 3 clear of the pillow as the pillow floats over hogar's mattress, the blanket over the body.
const BED = { head: vl(3.25, 8.25, 20.75), base: hl(17.25, 3.25, 20.75) };
const PILLOW = capsule(6, 11.75, 4.5, 2.75);
const SLEEPER = circ(8.25, 7.5, HR);
const BLANKET = `M12.75 17.25V12.5C12.75 11.12 13.87 10 15.25 10H18.25C19.63 10 20.75 11.12 20.75 12.5V20.75`;
/** The blanket closed along the bed's base, for the fill (its stroke runs on down as the bed's foot). */
const BLANKET_SHUT = `M12.75 17.25V12.5C12.75 11.12 13.87 10 15.25 10H18.25C19.63 10 20.75 11.12 20.75 12.5V17.25Z`;
{
  const d = [BED.head, BED.base, PILLOW, SLEEPER, BLANKET];
  add('sleep', ['dormir', 'sueño', 'descanso', 'seguimiento del sueño', 'sleep', 'sleep tracking', 'bedtime'], d);
  add('sleep-check', ['meta de sueño', 'dormí suficiente', 'sueño registrado', 'sleep goal', 'enough sleep'], d, { badge: badge('check') });
  for (const name of ['sleep', 'sleep-check']) {
    FILL[name] = { solid: [2, 3, BLANKET_SHUT], wire: [0, 1, vl(20.75, 17.25, 20.75)] };
    PARTS[name] = { bed: [0, 1], pillow: [2], head: [3], blanket: [4] };
  }
  // Snoring: the sleeper with two sound arcs out from the head, over the blanket
  const arcs = [
    [6, -38, -5],
    [8.9, -38, -8],
  ].map(([r, a0, a1]) => arc(8.25, 7.5, r, a0, a1).d);
  add('snoring', ['ronquidos', 'roncar', 'detección de ronquidos', 'snoring', 'snore', 'sleep sound'], [...d, ...arcs]);
  FILL.snoring = { ...FILL.sleep, lines: [5, 6] };
  PARTS.snoring = { ...PARTS.sleep, wave: [5, 6] };
}
{
  // Sleep score: personas' open progress ring with lugares' moon inside.
  const ring = 'M12 3A9 9 0 1 1 3 12';
  add('sleep-score', ['puntuación de sueño', 'calidad del sueño', 'sleep score', 'sleep quality'], [ring, setMoon(0.55, [12.1, 11.9])]);
  FILL['sleep-score'] = { solid: [1], wire: [0] };
  PARTS['sleep-score'] = { ring: [0], moon: [1] };
}
{
  // Sleep stages, the hypnogram: one stepped line dropping and rising across three levels (awake,
  // light, deep) over the baseline.
  const L = [5.5, 9.75, 14];
  const steps = [
    [2.75, L[0]],
    [5.75, L[0]],
    [5.75, L[1]],
    [8.5, L[1]],
    [8.5, L[2]],
    [12, L[2]],
    [12, L[1]],
    [14.75, L[1]],
    [14.75, L[2]],
    [17.75, L[2]],
    [17.75, L[0]],
    [21.25, L[0]],
  ];
  add('sleep-stages', ['fases del sueño', 'hipnograma', 'sueño profundo', 'REM', 'sleep stages', 'hypnogram', 'deep sleep'], [rl(steps, 0.75), hl(19.25, 2.75, 21.25)]);
  FILL['sleep-stages'] = false;
  PARTS['sleep-stages'] = { line: [0], axis: [1] };
}
{
  // Bedtime: the clock's face bitten into a crescent on its right, the hands at ten.
  const face = moon([12, 12], 9, [19.75, 6.5], 6.75);
  const hands = line([10.25, 8.25], [10.25, 12.75], go([10.25, 12.75], -150, 3.25));
  add('bedtime', ['hora de dormir', 'recordatorio', 'desconectar', 'bedtime', 'wind down', 'sleep reminder'], [face, hands]);
  FILL.bedtime = { solid: [0], cut: [1] };
  PARTS.bedtime = { face: [0], hands: [1] };
  MOTION.bedtime = { effect: 'spin', parts: ['hands'], origin: [10.25, 12.75] };
}
{
  // Waking up: sitting up in bed under the blanket, both arms raised (personas' arms).
  const S = [8.5, 11.25];
  const top = 13.25;
  const blanket = `M11.75 17.5V16.25C11.75 14.87 12.87 13.75 14.25 13.75H18.25C19.63 13.75 20.75 14.87 20.75 16.25V20.75`;
  const arms = rl([add2(S, [-5.15, -6.45]), add2(S, [-3.65, -0.98]), S, add2(S, [3.65, -0.98]), add2(S, [5.15, -6.45])], [0, 0.6, 0, 0.6, 0]);
  const d = [vl(3.25, top, 20.75), hl(17.5, 3.25, 20.75), circ(...headAt(S, -90), HR), line(S, [S[0], 17.5]), arms, blanket];
  add('wake-up', ['despertar', 'buenos días', 'levantarse', 'wake up', 'woke up', 'morning'], d);
  FILL['wake-up'] = { solid: [2, 'M11.75 17.5V16.25C11.75 14.87 12.87 13.75 14.25 13.75H18.25C19.63 13.75 20.75 14.87 20.75 16.25V17.5Z'], wire: [0, 1, 3, 4, vl(20.75, 17.5, 20.75)] };
  PARTS['wake-up'] = { bed: [0, 1], head: [2], body: [3], arms: [4], blanket: [5] };
  MOTION['wake-up'] = { effect: 'bounce', parts: ['head', 'arms'], vector: [0, -1] };
}
{
  // Sleep mask: two rounded lenses joined at the bridge, the nose notch below, the strap out at the sides.
  const mask =
    'M12 8.75C13.4 7.95 14.75 7.75 16.25 7.75C18.4 7.75 19.75 9.5 19.75 11.75C19.75 14.15 18.25 16 16 16C14.2 16 13.3 13.9 12 13.9C10.7 13.9 9.8 16 8 16C5.75 16 4.25 14.15 4.25 11.75C4.25 9.5 5.6 7.75 7.75 7.75C9.25 7.75 10.6 7.95 12 8.75Z';
  add('sleep-mask', ['antifaz', 'máscara para dormir', 'viaje', 'sleep mask', 'eye mask', 'travel comfort'], [mask, hl(11.75, 1.75, 4.25), hl(11.75, 19.75, 22.25)]);
  FILL['sleep-mask'] = { solid: [0], wire: [1, 2] };
  PARTS['sleep-mask'] = { mask: [0], strap: [1, 2] };
}
{
  // Earplugs: two foam plugs leaning apart, joined at their ends by a short cord.
  const left = bar([6.75, 4.25], [8.25, 11.25], 2.1);
  const right = bar([17.25, 4.25], [15.75, 11.25], 2.1);
  const cord = `M8.69 13.3C9.25 17.5 10.25 19.25 12 19.25C13.75 19.25 14.75 17.5 15.31 13.3`;
  add('earplugs', ['tapones para oídos', 'silencio', 'ruido', 'dormir', 'earplugs', 'noise blocking', 'quiet'], [left, right, cord]);
  FILL.earplugs = { solid: [0, 1], wire: [2] };
  PARTS.earplugs = { plugs: [0, 1], cord: [2] };
}
{
  // Insomnia: edicion's eye wide open, lugares' moon over it.
  const eye = ['M2.75 12C5 7.75 8.25 5.5 12 5.5S19 7.75 21.25 12C19 16.25 15.75 18.5 12 18.5S5 16.25 2.75 12Z', 'M8.75 12A3.25 3.25 0 1 0 15.25 12A3.25 3.25 0 1 0 8.75 12Z'].map((p) => place(p, 0.8, [12, 12], [12, 15.5]));
  add('insomnia', ['insomnio', 'no puedo dormir', 'desvelo', 'despierto de noche', 'insomnia', 'sleepless', 'awake at night'], [...eye, setMoon(0.3, [12.25, 5])]);
  FILL.insomnia = { solid: [0, 2], cut: [1] };
  PARTS.insomnia = { eye: [0], iris: [1], moon: [2] };
}
{
  // Dream: comunicacion's thought bubble with lugares' crescent inside.
  const bubble = [
    'M11.73 12.7A3.75 3.75 0 1 1 10.82 5.54A3.75 3.75 0 0 1 18.25 6.25A3 3 0 1 1 17.53 12.16A3.25 3.25 0 0 1 11.73 12.7Z',
    'M5.75 16.5A1.5 1.5 0 1 0 8.75 16.5A1.5 1.5 0 1 0 5.75 16.5Z',
    'M3.05 20A0.7 0.7 0 1 0 4.45 20A0.7 0.7 0 1 0 3.05 20Z',
  ];
  // The crescent alone: a star beside it would crowd the bubble and run into it at heavy weights
  add('dream', ['sueños', 'diario de sueños', 'soñar', 'dream', 'dream journal', 'dreaming'], [...bubble, setMoon(0.26, [14, 9])]);
  FILL.dream = { solid: [0, 1, 2], cut: [3] };
  PARTS.dream = { bubble: [0, 1, 2], moon: [3] };
}

// ── The spa ───────────────────────────────────────────────────────────────────────────────────
/** hogar's steam: one soft S rising `h` from (x, y). */
const steam = (x, y, h = 4.5) => `M${pt([x, y])}C${pt([x - 1.25, y - h * 0.28])} ${pt([x + 1.25, y - h * 0.61])} ${pt([x, y - h])}`;
{
  // Massage: lying face down on the table (its top and two legs), the body a long capsule under a
  // towel, the head at the table's end, and the kneading strokes over the back as lugares' wave.
  const top = 16;
  const H = [4.75, 11.4];
  const body = capsule(9, 9.75, 12.25, 3.25);
  const strokes = [wave([9.75, 6], 4, 2.375, 0.9)];
  const d = [circ(...H, HR), body, hl(top, 2.75, 21.25), vl(5.5, top, 20.75), vl(18.5, top, 20.75), ...strokes];
  add('massage', ['masaje', 'spa', 'tratamiento', 'relajación', 'massage', 'spa treatment', 'bodywork'], d);
  FILL.massage = { solid: [0, 1], wire: [2, 3, 4], lines: [5] };
  PARTS.massage = { head: [0], body: [1], table: [2, 3, 4], wave: [5] };
}
{
  // Massage chair: one padded shape for the back and the seat, reclined; the leg rest, the stand and its
  // foot, and two arcs of vibration behind the back.
  const shell = roundpoly(
    [
      [7.5, 4.25],
      [10.5, 3.5],
      [13.25, 13],
      [19.25, 13],
      [19.25, 16.75],
      [11.75, 16.75],
    ],
    [1.4, 1.4, 0.8, 1.4, 1.4, 2],
  );
  const stand = vl(15.25, 16.75, 20.75);
  const foot = hl(20.75, 12, 17.5);
  // The back's rear edge runs from (7.5, 4.25) to (11.75, 16.75): the arcs are centered on its axis
  const u = unit(sub([11.75, 16.75], [7.5, 4.25]));
  const n = [u[1], -u[0]];
  const c = add2(lerp([7.5, 4.25], [11.75, 16.75], 0.38), mul(n, 1.5));
  const a = angOf([0, 0], mul(n, -1));
  const arcs = [5.1, 7.95].map((r) => arc(...c, r, a - 20, a + 20).d);
  const d = [shell, line([19.25, 15], [21, 20.5]), stand, foot, ...arcs];
  add('massage-chair', ['sillón de masaje', 'silla masajeadora', 'vibración', 'massage chair', 'recliner', 'vibration'], d);
  FILL['massage-chair'] = { solid: [0], wire: [1, 2, 3], lines: [4, 5] };
  PARTS['massage-chair'] = { chair: [0, 1, 2, 3], wave: [4, 5] };
  MOTION['massage-chair'] = { effect: 'wiggle', parts: ['chair'], origin: [15.25, 20.75] };
}
{
  // Sauna: the wooden bucket, wider at its rim, two hoops round it, the ladle's handle leaning on the
  // rim and two curls of steam (hogar's).
  const rim = 11.25;
  const [x0, x1, b0, b1] = [4.75, 17.25, 6, 16];
  const bucket = roundpoly(
    [
      [x0, rim],
      [x1, rim],
      [b1, 20.75],
      [b0, 20.75],
    ],
    [0.6, 0.6, 1.5, 1.5],
  );
  const at = (y, x, b) => x + ((y - rim) * (b - x)) / (20.75 - rim);
  const hoops = [14.5, 17.75].map((y) => hl(y, at(y, x0, b0), at(y, x1, b1)));
  const ladle = line([14, rim], [20, 4.5]);
  const d = [bucket, ...hoops, ladle, steam(7.75, 8.25, 5), steam(11.25, 8.25, 5)];
  add('sauna', ['sauna', 'baño de vapor', 'cubeta', 'calor', 'sauna', 'steam room', 'sauna bucket'], d);
  FILL.sauna = { solid: [0], cut: [hl(14.5, 2.5, 19.5), hl(17.75, 2.5, 19.5)], wire: [3], lines: [4, 5] };
  PARTS.sauna = { bucket: [0, 1, 2], ladle: [3], steam: [4, 5] };
  MOTION.sauna = { effect: 'float', parts: ['steam'], vector: [0, -1.5] };
}
{
  // Cold plunge: hogar's hot tub, its water and a snowflake over it where the hot tub has steam.
  const tub = 'M3.25 11.75H20.75V16.75C20.75 19.25 19 20.75 16.5 20.75H7.5C5 20.75 3.25 19.25 3.25 16.75Z';
  const water = 'M3.25 15Q5.44 13.5 7.63 15T12 15T16.38 15T20.75 15';
  const flake = [90, 30, 150].map((a) => line(go([12, 5.5], a, 3.25), go([12, 5.5], a + 180, 3.25)));
  add('cold-plunge', ['baño de hielo', 'inmersión en frío', 'terapia de frío', 'agua fría', 'cold plunge', 'ice bath', 'cold therapy'], [tub, water, ...flake]);
  FILL['cold-plunge'] = { solid: [0], cut: [1], lines: [2, 3, 4] };
  PARTS['cold-plunge'] = { tub: [0], water: [1], flake: [2, 3, 4] };
  MOTION['cold-plunge'] = { effect: 'spin', parts: ['flake'], origin: [12, 5.5] };
}
{
  // Bubble bath: hogar's bathtub (without its tap) a little lower, a mound of foam heaped over the
  // rim and a bubble rising from it.
  const tub = hogar.icons.bathtub.d.slice(0, 4).map((p) => place(p, 1, [0, 0], [0, 1.25]));
  const rim = 9.75;
  const blobs = [
    [7.25, 8.25, 2.25],
    [11.25, 6.5, 3],
    [15.25, 8.25, 2.25],
  ];
  const foam = mound(blobs, rim);
  const bubble = circ(19.75, 3.5, 1.25);
  const d = [...tub, foam, bubble];
  add('bubble-bath', ['baño de burbujas', 'espuma', 'tina', 'relajarse', 'bubble bath', 'bath', 'foam'], d);
  FILL['bubble-bath'] = { solid: [0, shut(tub[1]), shut(foam), 5], wire: [2, 3] };
  PARTS['bubble-bath'] = { tub: [0, 1, 2, 3], foam: [4], bubble: [5] };
  MOTION['bubble-bath'] = { effect: 'float', parts: ['foam', 'bubble'], vector: [0, -1.25] };
}
{
  // Hammock: the sling sagging between two posts, its two edges each tied to both.
  const [y0, y1] = [9.25, 12];
  const d = [`M3.25 ${f(y0)}Q12 15.5 20.75 ${f(y0)}`, `M3.25 ${f(y1)}Q12 21.5 20.75 ${f(y1)}`, vl(3.25, 5.25, 20.75), vl(20.75, 5.25, 20.75)];
  add('hammock', ['hamaca', 'descanso', 'vacaciones', 'relajarse', 'hammock', 'rest', 'lazy day'], d);
  FILL.hammock = { solid: [`M3.25 ${f(y0)}Q12 15.5 20.75 ${f(y0)}V${f(y1)}Q12 21.5 3.25 ${f(y1)}Z`], wire: [2, 3] };
  PARTS.hammock = { sling: [0, 1], posts: [2, 3] };
}
{
  // Relax: reclining in a lounge chair, in profile, the legs stretched out along the seat; the figure
  // lies 3 over the chair, the torso parallel to the back.
  const seat = 18;
  const C = [8.25, seat];
  const u = unit([-4.5, -8.75]);
  const n = [-u[1], u[0]];
  const B0 = add2(C, mul(u, 6.75));
  const y = seat - 3;
  const O = add2(C, mul(n, 3));
  const P = add2(O, mul(u, (y - O[1]) / u[1]));
  const S = add2(P, mul(u, 5.5));
  const H = add2(S, mul(u, HR + GAP));
  // The arm rests on the lap: out in front of the chest and down onto the thigh
  const E = add2(S, add2(mul(u, -3), mul(n, 3)));
  const d = [circ(...H, HR), rl([S, P, [20.75, y]], [0, 0.6, 0]), rl([S, E, [14.5, y]], [0, 0.6, 0]), rl([B0, C, [21.25, seat]], [0, 0.75, 0]), line([10.25, seat], [8.25, 21.25]), line([18.5, seat], [20.25, 21.25])];
  add('relax', ['relajarse', 'descansar', 'tiempo libre', 'tumbona', 'relax', 'downtime', 'lounge'], d);
  FILL.relax = figFill(d.length);
  PARTS.relax = { head: [0], body: [1], arms: [2], chair: [3, 4, 5] };
}
{
  // Essential oil: a round bottle with a short neck, the dropper's collar and bulb on it and a leaf on
  // its body.
  const c = [12, 15.25];
  const R = 6;
  const ny = c[1] - Math.sqrt(R * R - 4);
  const body = `M10 8.25V${f(ny)}A${R} ${R} 0 1 0 14 ${f(ny)}V8.25`;
  const collar = sq(8.75, 5.25, 6.5, 3, 1);
  const bulb = 'M10.5 5.25V3.5A1.5 1.5 0 0 1 13.5 3.5V5.25';
  const leaf = vesicaPath(vesica([10.25, 17.25], [13.75, 13.25], 1.4));
  add('essential-oil', ['aceite esencial', 'aromaterapia', 'gotero', 'aceite de masaje', 'essential oil', 'aromatherapy', 'dropper bottle'], [body, collar, bulb, leaf]);
  FILL['essential-oil'] = { solid: [shut(body), 1, shut(bulb)], cut: [3] };
  PARTS['essential-oil'] = { bottle: [0], cap: [1, 2], leaf: [3] };
}
{
  // Aroma diffuser: a rounded cone, two wisps of mist (hogar's steam) rising from its top.
  const body = 'M12 11.75C14.75 11.75 15.75 13.25 16.5 15L18.6 19.6A0.85 0.85 0 0 1 17.82 20.75H6.18A0.85 0.85 0 0 1 5.4 19.6L7.5 15C8.25 13.25 9.25 11.75 12 11.75Z';
  const mist = [steam(10.25, 8.75, 5.5), steam(13.75, 8.75, 5.5)];
  add('aroma-diffuser', ['difusor de aromas', 'aromaterapia', 'vapor', 'humidificador', 'aroma diffuser', 'diffuser', 'mist'], [body, ...mist]);
  FILL['aroma-diffuser'] = { solid: [0], lines: [1, 2] };
  PARTS['aroma-diffuser'] = { body: [0], mist: [1, 2] };
  MOTION['aroma-diffuser'] = { effect: 'float', parts: ['mist'], vector: [0, -1.25] };
}
{
  // Lavender: a stem crowned by its buds, the set's dots alternating either side of the stem and
  // overlapping it and each other into one spike (a dot is solid at every weight), one narrow leaf.
  const buds = [...Array.from({ length: 7 }, (_, i) => dot(12 + (i % 2 ? 0.8 : -0.8), 12.35 - i * 1.3)), dot(12, 3.3)];
  const leaf = vesicaPath(vesica([12, 18.25], [15.75, 14.75], 1.25));
  add('lavender', ['lavanda', 'aroma relajante', 'flor', 'dormir', 'lavender', 'calming scent', 'herb'], [vl(12, 21.25, 4.55), leaf, ...buds]);
  FILL.lavender = { solid: [1, 2, 3, 4, 5, 6, 7, 8, 9], wire: [0] };
  PARTS.lavender = { stem: [0], leaf: [1], flower: [2, 3, 4, 5, 6, 7, 8, 9] };
  MOTION.lavender = { effect: 'wiggle', origin: [12, 21.25] };
}

// ── Journaling and support ────────────────────────────────────────────────────────────────────
// archivos' journal (the cover, its band and the ribbon) with the engine's badges.
/**
 * The engine's pencil, its cleared area reaching past its far side to the canvas's corner: on the
 * journal, whose square corner sits just beyond the pencil, the engine's own area would leave a sliver
 * of that corner on the far side of it.
 */
function clearBeyond(b) {
  const at = (s, o) => [12.5 + (s + o) * Math.SQRT1_2, 21 + (o - s) * Math.SQRT1_2];
  return { ...b, kind: undefined, knock: `${b.knock}M${pt(at(0, 1.5))}L${pt(at(10.5, 1.5))}L23 ${f(at(10.5, 1.5)[1])}L23 23L${f(at(0, 1.5)[0])} 23Z` };
}
for (const [name, kind, tags] of [
  ['journal-heart', 'heart', ['diario de gratitud', 'gratitud', 'agradecimiento', 'gratitude journal', 'gratitude', 'thankful']],
  ['journal-edit', 'edit', ['escribir en el diario', 'entrada de hoy', 'diario', 'journaling', 'write entry', 'journal']],
  ['journal-lock', 'lock', ['diario privado', 'diario con candado', 'privado', 'private journal', 'locked journal', 'diary lock']],
]) {
  add(name, tags, archivos.icons.journal.d, { badge: kind === 'edit' ? clearBeyond(badge('edit')) : badge(kind) });
  FILL[name] = { solid: [0], cut: [1], wire: [2] };
  PARTS[name] = { cover: [0], band: [1], ribbon: [2] };
}
{
  // Self-care: the head over a heart that is the body, its lobes the shoulders and arms folded in.
  const heart = heartAt([12, 15], 0.75);
  add('self-care', ['autocuidado', 'cuidarse', 'amor propio', 'autocompasión', 'self-care', 'self-compassion', 'self-love'], [circ(12, 4, 2), heart]);
  FILL['self-care'] = { solid: [0, 1] };
  PARTS['self-care'] = { head: [0], heart: [1] };
  MOTION['self-care'] = { effect: 'beat', parts: ['heart'], origin: [12, 15] };
}
{
  // Wellbeing: the set's heart whose right lobe opens into a leaf, its tip up and out, a vein inside.
  const shape = 'M12 20.5L4.03 12A4.75 4.75 0 1 1 12 7.23C14 4.75 16.75 3.25 20.75 3C21 10 17.75 15.5 12 20.5Z';
  const vein = line([14.4, 13.75], [17.5, 7.25]);
  add('wellbeing', ['bienestar', 'salud integral', 'vida sana', 'holístico', 'wellbeing', 'wellness', 'holistic health'], [shape, vein]);
  FILL.wellbeing = { solid: [0], cut: [1] };
  PARTS.wellbeing = { heart: [0], vein: [1] };
  MOTION.wellbeing = { effect: 'beat', origin: [12, 12] };
}
{
  // Self-care day: nucleo's calendar with the engine's heart.
  add('calendar-heart', ['día de autocuidado', 'día de salud mental', 'día de bienestar', 'self-care day', 'mental health day', 'wellness day'], nucleo.icons.calendar.d, { badge: badge('heart') });
  FILL['calendar-heart'] = { solid: [0], lines: [1, 2], cut: [3, 4, 5, 6, 7, 8] };
  PARTS['calendar-heart'] = { body: [0], rings: [1, 2], header: [3], days: [4, 5, 6, 7, 8] };
}
{
  // Therapy: the couch (a chaise, its head end raised) on two legs, a speech drop over it.
  const couch = roundpoly(
    [
      [3.25, 10.75],
      [6.25, 10.75],
      [9.75, 14.5],
      [20.75, 14.5],
      [20.75, 18],
      [3.25, 18],
    ],
    [1.25, 1, 1, 1.25, 1.25, 1.25],
  );
  const d = [couch, vl(5.5, 18, 20.75), vl(18.5, 18, 20.75), drop(15.75, 7, 3.75)];
  add('therapy', ['terapia', 'psicoterapia', 'consejería', 'sesión', 'therapy', 'counseling', 'psychotherapy'], d);
  FILL.therapy = { solid: [0, 3], wire: [1, 2] };
  PARTS.therapy = { couch: [0, 1, 2], bubble: [3] };
}
{
  // Online therapy: dispositivos' laptop, a speech drop on its screen and the engine's heart.
  const [screen, base] = dispositivos.icons.laptop.d;
  add('online-therapy', ['terapia en línea', 'videoterapia', 'terapeuta', 'sesión virtual', 'online therapy', 'teletherapy', 'video session'], [screen, base, drop(10.25, 10, 2.6)], {
    badge: badge('heart'),
  });
  FILL['online-therapy'] = { solid: [0], lines: [1], cut: [2] };
  PARTS['online-therapy'] = { screen: [0], base: [1], bubble: [2] };
}
{
  // Support group: three busts round a small heart, the one at the back higher up.
  const d = [...bust([12, 3.75], 1.6, 6, 3), ...bust([5.25, 13.25], 1.6, 5.5, 3), ...bust([18.75, 13.25], 1.6, 5.5, 3), heartAt([12, 15.75], 0.28)];
  add('support-group', ['grupo de apoyo', 'terapia de grupo', 'comunidad', 'círculo', 'support group', 'group therapy', 'community'], d);
  FILL['support-group'] = { solid: [0, 1, 2, 3, 4, 5, 6] };
  PARTS['support-group'] = { people: [0, 1, 2, 3, 4, 5], heart: [6] };
  MOTION['support-group'] = { effect: 'beat', parts: ['heart'], origin: [12, 15.75] };
}
{
  // Peer support: two standing figures side by side, one arm over the other's shoulder: the arms are one
  // line from hand to hand across both shoulders.
  const [A, B] = [7, 17].map((x) => ({ H: [x, 4.5], S: [x, 8.75], P: [x, 14.25] }));
  const legs = (P) => line([P[0] - 2.25, 21.25], P, [P[0] + 2.25, 21.25]);
  const arms = rl([[3.75, 14.4], [4.45, 10.65], A.S, B.S, [19.55, 10.65], [20.25, 14.4]], [0, 0.6, 0.6, 0.6, 0.6, 0]);
  const d = [circ(...A.H, HR), circ(...B.H, HR), line(A.S, A.P), line(B.S, B.P), legs(A.P), legs(B.P), arms];
  add('peer-support', ['apoyo entre pares', 'compañero', 'amistad', 'acompañar', 'peer support', 'buddy', 'friendship'], d);
  FILL['peer-support'] = { solid: [0, 1], wire: [2, 3, 4, 5, 6] };
  PARTS['peer-support'] = { heads: [0, 1], bodies: [2, 3], legs: [4, 5], arms: [6] };
}
{
  // Helpline: nucleo's handset, smaller at the bottom left, the set's heart over it.
  const phone = place(nucleo.icons.phone.d[0], 0.74, [3.6, 20.7], [3, 21]);
  const heart = heartAt([16.75, 7], 0.36);
  add('helpline', ['línea de ayuda', 'línea de crisis', 'apoyo emocional', 'llamar', 'helpline', 'crisis line', 'support call'], [phone, heart]);
  FILL.helpline = { solid: [0, 1] };
  PARTS.helpline = { phone: [0], heart: [1] };
  MOTION.helpline = { effect: 'ring', parts: ['phone'], origin: [9.5, 14.5] };
}
{
  // Social battery: dispositivos' battery with a bust in its cell in place of the charge bars.
  const [body, cap] = dispositivos.icons['battery-full'].d;
  const head = circ(10.5, 10.9, 1.6);
  const shoulders = 'M6.5 17.5C7 15.75 8.5 14.9 10.5 14.9S14 15.75 14.5 17.5';
  add('social-battery', ['batería social', 'energía social', 'recargar', 'introvertido', 'social battery', 'social energy', 'recharge'], [body, cap, head, shoulders]);
  FILL['social-battery'] = { solid: [2, shut(shoulders)], wire: [0, 1] };
  PARTS['social-battery'] = { body: [0, 1], person: [2, 3] };
}

/**
 * A bust as nucleo's person draws it, at any size: the head of radius `r` and the shoulders (a dome
 * `w` wide, `h` tall) 2.45 below it, the clearance kept rather than scaled.
 */
function bust([x, y], r, w, h) {
  const top = y + r + 2.45;
  const yb = top + h;
  const k = 0.9;
  const body = `M${pt([x - w / 2 + k, yb])}H${f(x + w / 2 - k)}A${k} ${k} 0 0 0 ${pt([x + w / 2, yb - k])}C${pt([x + w / 2, top + h * 0.2])} ${pt([x + w * 0.3, top])} ${pt([x, top])}C${pt([x - w * 0.3, top])} ${pt([x - w / 2, top + h * 0.2])} ${pt([x - w / 2, yb - k])}A${k} ${k} 0 0 0 ${pt([x - w / 2 + k, yb])}Z`;
  return [circ(x, y, r), body];
}

/**
 * The circular arrow of recovery and habits: nucleo's refresh as the engine draws an arc arrow (an
 * arc of r 8.1 round (12, 12.4) open at the top right, the head of 3.4 on its tangent).
 */
const TURN = arc(12, 12.4, 8.1, -35, 265);
const TURN_D = [TURN.d, head(TURN.end, TURN.tangent, 3.4)];

// ── Stress, recovery and habits ───────────────────────────────────────────────────────────────
/** A sprout: its stem from `b` up 6.5·k, a leaf (a vesica of half width `w`) out to each side. */
function sprout(b, k = 1, w = 1.4) {
  const top = add2(b, [0, -6.5 * k]);
  const low = add2(b, [0, -3.5 * k]);
  return [line(b, top), vesicaPath(vesica(low, add2(low, [-4.25 * k, -2.75 * k]), w)), vesicaPath(vesica(top, add2(top, [4.5 * k, -3.25 * k]), w * 1.1))];
}
{
  // Stress: a spring pressed tight between two plates, its coils a zigzag from plate to plate.
  const coil = rl(
    [
      [12, 5.5],
      [17.75, 8.5],
      [6.25, 10.85],
      [17.75, 13.15],
      [6.25, 15.5],
      [12, 18.5],
    ],
    [0, 0.6, 0.6, 0.6, 0.6, 0],
  );
  add('stress', ['estrés', 'tensión', 'presión', 'nivel de estrés', 'stress', 'tension', 'pressure'], [hl(5.5, 4.25, 19.75), coil, hl(18.5, 4.25, 19.75)]);
  FILL.stress = false;
  PARTS.stress = { plates: [0, 2], spring: [1] };
}
{
  // Heart rate variability: the set's heart with a pulse running through it, its two beats unevenly
  // spaced (a custom badge: the engine clears the heart around the line).
  const pulse = line([2.25, 13], [6.25, 13], [7.75, 8], [9.25, 13], [14.75, 13], [16.25, 8], [17.75, 13], [21.75, 13]);
  add('heart-rate-variability', ['variabilidad de la frecuencia cardiaca', 'VFC', 'recuperación', 'estrés', 'heart rate variability', 'HRV', 'stress metric'], [HEART], {
    badge: { d: [pulse], knock: pulse },
  });
  FILL['heart-rate-variability'] = { solid: [0] };
  PARTS['heart-rate-variability'] = { heart: [0] };
}
{
  // Recovery: the circular arrow turning round the set's heart.
  const d = [...TURN_D, heartAt([12, 13], 0.4)];
  add('recovery', ['recuperación', 'descanso reparador', 'puntuación de recuperación', 'recovery', 'recovery score', 'restore'], d);
  FILL.recovery = { solid: [2], lines: [0, 1] };
  PARTS.recovery = { arrow: [0, 1], heart: [2] };
  MOTION.recovery = { effect: 'spin', parts: ['arrow'], origin: [12, 12.4] };
}
{
  // Readiness: personas' open progress ring with nucleo's bolt inside.
  const d = ['M12 3A9 9 0 1 1 3 12', place(nucleo.icons.bolt.d[0], 0.58, [12, 12], [12, 12])];
  add('readiness', ['preparación', 'energía del día', 'puntuación de energía', 'listo para el día', 'readiness', 'energy score', 'body battery'], d);
  FILL.readiness = { solid: [1], wire: [0] };
  PARTS.readiness = { ring: [0], bolt: [1] };
  MOTION.readiness = { effect: 'beat', parts: ['bolt'], origin: [12, 12] };
}
{
  // Resilience: a slab cracked through, a sprout growing up out of the crack.
  const slab = sq(2.75, 14.25, 18.5, 6.5, 1.5);
  const crack = line([12, 14.25], [10.75, 16.5], [12.75, 18.5], [11.75, 20.75]);
  const [stem, left, right] = sprout([12, 14.25]);
  add('resilience', ['resiliencia', 'superación', 'fortaleza', 'salir adelante', 'resilience', 'coping', 'bounce back'], [slab, crack, stem, left, right]);
  FILL.resilience = { solid: [0, 3, 4], cut: [line([12.6, 13.1], [12, 14.25], [10.75, 16.5], [12.75, 18.5], [11.75, 20.75], [11.2, 22])], wire: [2] };
  PARTS.resilience = { slab: [0, 1], sprout: [2, 3, 4] };
}
{
  // Habits: the circular arrow turning round a small sprout, alone and with the engine's badges.
  const d = [...TURN_D, vl(12, 10.75, 16), vesicaPath(vesica([12, 13.25], [8, 10.75], 1.25)), vesicaPath(vesica([12, 10.75], [15.25, 8.5], 1.3))];
  for (const [name, kind, tags] of [
    ['habit', null, ['hábito', 'práctica diaria', 'seguimiento de hábitos', 'habit', 'habit tracker', 'daily practice']],
    ['habit-plus', 'plus', ['nuevo hábito', 'agregar hábito', 'crear hábito', 'new habit', 'add habit']],
    ['habit-check', 'check', ['hábito cumplido', 'hecho hoy', 'hábito completado', 'habit done', 'completed today']],
    ['habit-x', 'x', ['hábito fallado', 'no cumplido', 'hábito perdido', 'habit missed', 'skipped today']],
  ]) {
    add(name, tags, d, kind ? { badge: badge(kind) } : {});
    FILL[name] = { solid: [3, 4], wire: [2], lines: [0, 1] };
    PARTS[name] = { arrow: [0, 1], sprout: [2, 3, 4] };
  }
  MOTION.habit = { effect: 'spin', parts: ['arrow'], origin: [12, 12.4] };
}
{
  // Streak: lugares' flame with its inner tongue (without it the flame reads as a water drop), smaller and
  // up to the left so the engine's check clears its outline and not its tongue; the tongue rises 0.5 so
  // it keeps lugares' 2.4 over the flame's bottom (scaled, it would close up at bold).
  const [flame, tongue] = lugares.icons.flame.d;
  const d = [place(flame, 0.8, [12, 12], [9, 9.5]), place(tongue, 0.8, [12, 12], [9, 9])];
  add('streak', ['racha', 'días seguidos', 'constancia', 'no romper la racha', 'streak', 'consecutive days', 'keep it up'], d, { badge: badge('check') });
  FILL.streak = { solid: [0], cut: [1] };
  PARTS.streak = { flame: [0], core: [1] };
  MOTION.streak = { effect: 'wiggle', parts: ['flame', 'core'], origin: [9, 16.7] };
}
{
  // Cigarette: lying flat, the filter's band at the left end and a wavy line of smoke rising from the
  // right (the engine's slash says no smoking).
  const body = sq(2.75, 13.5, 18.5, 4, 1);
  const smoke = turnPath(wave([18.75, 10.5], 3, 2.75, 0.9), -90, [18.75, 10.5]);
  add('cigarette', ['cigarro', 'fumar', 'tabaco', 'dejar de fumar', 'no fumar', 'cigarette', 'smoking', 'quit smoking'], [body, vl(7.25, 13.5, 17.5), smoke]);
  FILL.cigarette = { solid: [0], cut: [vl(7.25, 11, 20)], lines: [2] };
  PARTS.cigarette = { cigarette: [0, 1], smoke: [2] };
  MOTION.cigarette = { effect: 'float', parts: ['smoke'], vector: [0, -1.5] };
}
{
  // Vape: a slim pen upright, its mouthpiece on top, a band where the button is and a small cloud of
  // vapor (lugares' cloud) over the mouthpiece.
  const pen = sq(9.75, 12.75, 4.5, 8.5, 1.5);
  const tip = 'M10.75 12.75V10.75A1 1 0 0 1 11.75 9.75H12.25A1 1 0 0 1 13.25 10.75V12.75';
  const cloud = place(lugares.icons.cloud.d[0], 0.4, [12.125, 11.5], [13, 4.4]);
  add('vape', ['vapeador', 'cigarro electrónico', 'vapear', 'dejar de vapear', 'vape', 'e-cigarette', 'vaping'], [pen, tip, hl(16.25, 9.75, 14.25), cloud]);
  FILL.vape = { solid: [0, shut(tip), 3], cut: [hl(16.25, 7, 17)] };
  PARTS.vape = { pen: [0, 1, 2], vapor: [3] };
  MOTION.vape = { effect: 'float', parts: ['vapor'], vector: [0.75, -1.25] };
}
{
  // App limit: ventanas' app tile with an hourglass on it, its caps and its glass two triangles that
  // meet at the neck.
  const tile = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
  const [y0, y1] = [7.25, 16.75];
  const glass = `M9.25 ${f(y0)}H14.75C14.75 9.75 13.25 10.75 12 12C13.25 13.25 14.75 14.25 14.75 ${f(y1)}H9.25C9.25 14.25 10.75 13.25 12 12C10.75 10.75 9.25 9.75 9.25 ${f(y0)}Z`;
  const d = [tile, hl(y0, 8.25, 15.75), hl(y1, 8.25, 15.75), glass];
  add('app-limit', ['límite de apps', 'tiempo en pantalla', 'tiempo de uso', 'app limit', 'screen time', 'time limit'], d);
  FILL['app-limit'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['app-limit'] = { app: [0], hourglass: [1, 2, 3] };
}

// ── Assembly ──────────────────────────────────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (list) => list.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, pick(v)]));
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// Mirror: what has a reading direction (the breath leaves the face, the guide's voice its head)
for (const name of ['meditation-audio', 'mind-calm', 'mind-heart', 'mind-tangled', 'mind-focus', 'breath', 'breath-in', 'breath-out']) icons[name].mirror = true;

// Values: the scores fill their ring that far (personas' avatar-progress)
for (const name of ['sleep-score', 'readiness']) icons[name].value = { draw: ['ring'] };

// 16 px: fewer pieces where the snap leaves a smudge
{
  // Support group: the two busts at the sides of a larger heart (the one at the back clogs)
  const d = [...bust([4.75, 9], 1.75, 5, 3.25), ...bust([19.25, 9], 1.75, 5, 3.25), heartAt([12, 12], 0.36)];
  icons['support-group'].small = { d, fill: { solid: d } };
  // Online therapy: the laptop and the engine's pixel heart, without the drop on the screen (a `small`
  // replaces the whole drawing, its badge included)
  const [screen, base] = dispositivos.icons.laptop.d;
  icons['online-therapy'].small = { d: [screen, base], fill: { solid: [screen], lines: [base] }, badge: badge('heart', { size: 16 }) };
}

// Already enclosed (rings, the app tile, the box), or a slash that says nothing (a chart, a badge's
// sign, a pulse)
for (const name of ['sleep-score', 'readiness']) icons[name].variants = { circle: false, square: false };
for (const name of ['recovery', 'habit', 'habit-plus', 'habit-check', 'habit-x']) icons[name].variants = { circle: false };
icons['app-limit'].variants = { square: false };
icons['box-breathing'].variants = { square: false, slash: false };
icons['sleep-stages'].variants = { slash: false };
for (const name of ['meditation-clock', 'sleep-check', 'journal-heart', 'journal-edit', 'journal-lock', 'calendar-heart', 'online-therapy', 'habit-plus', 'habit-check', 'habit-x', 'heart-rate-variability', 'streak'])
  icons[name].variants = { ...icons[name].variants, slash: false };

export default { category: 'bienestar', label: 'Bienestar', icons };
