// Música y audio (music and audio): the instruments, drawn whole in their best-known view (the
// strings, the keys, the drums and percussion, the brass and the woodwinds), the studio and live
// sound gear, the players and retro audio, the notation and the production views. Everything is
// computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke,
// keylines, continuous corners and the square bottom-right corner on the gear's cases. The
// guitars share one body (two bouts joined by a waist, or the electric's cutaway body), one neck
// and one head; the brass share one bell; the drums one ellipse head; the stands one tripod foot.
// The notes build on dispositivos' `music-note` (its tilted head and stem), the playlists on its
// `playlist`, the albums on its `album` and the microphones on its heads (the handheld's round head
// and band, the studio mic's capsule and bands); sheet music is nucleo's document and spatial audio
// anatomia's head in profile. Notation is drawn as strokes, never typed characters.
import { arc, badge, circ, dot, f, flipPath, halfChord, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import anatomia from './anatomia.mjs';
import dispositivos from './dispositivos.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Moves a path by (dx, dy). */
const move = (d, dx, dy) => transform(d, 1, dx, dy);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
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
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(add2(V, mul(u, t)))}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(add2(V, mul(v, t)))}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}
/** A capsule along the axis from `a` to `b`, `r` either side of it (r ≤ 0.45: ink at every weight). */
function bar(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1] * r, u[0] * r];
  const R = halfChord(add2(b, n), sub(b, n));
  return `M${pt(add2(a, n))}L${pt(add2(b, n))}A${R} ${R} 0 0 0 ${pt(sub(b, n))}L${pt(sub(a, n))}A${R} ${R} 0 0 0 ${pt(add2(a, n))}Z`;
}
/** Ellipse of semi-axes rx, ry at (cx, cy) turned `deg` degrees (`back`: drawn the other way round). */
function ell(cx, cy, rx, ry, deg = 0, back = false) {
  const a = [cx + rx * Math.cos((deg * Math.PI) / 180), cy + rx * Math.sin((deg * Math.PI) / 180)];
  const b = [2 * cx - a[0], 2 * cy - a[1]];
  const s = back ? 0 : 1;
  return `M${pt(a)}A${f(rx)} ${f(ry)} ${f(deg)} 1 ${s} ${pt(b)}A${f(rx)} ${f(ry)} ${f(deg)} 1 ${s} ${pt(a)}Z`;
}
/** A point on that ellipse at parameter angle `t` degrees. */
const ellAt = (cx, cy, rx, ry, deg, t) => {
  const [c, s] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const [x, y] = [rx * Math.cos((t * Math.PI) / 180), ry * Math.sin((t * Math.PI) / 180)];
  return [cx + x * c - y * s, cy + x * s + y * c];
};
/** The y of a level ellipse's lower (s = 1) or upper (s = -1) edge at x. */
const ellY = (cx, cy, rx, ry, x, s = 1) => cy + s * ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));

/**
 * A parametric curve `fn(t) → [x, y]` from t0 to t1 as n cubic segments (each one matched to the
 * curve's tangents at its ends).
 */
function curve(fn, t0, t1, n = 8, moveTo = true) {
  const h = 1e-4;
  const der = (t) => {
    const a = fn(t - h);
    const b = fn(t + h);
    return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h)];
  };
  let s = moveTo ? `M${pt(fn(t0))}` : '';
  for (let i = 0; i < n; i++) {
    const a = t0 + ((t1 - t0) * i) / n;
    const b = t0 + ((t1 - t0) * (i + 1)) / n;
    const k = (b - a) / 3;
    const [P0, P1, D0, D1] = [fn(a), fn(b), der(a), der(b)];
    s += `C${pt(add2(P0, mul(D0, k)))} ${pt(sub(P1, mul(D1, k)))} ${pt(P1)}`;
  }
  return s;
}
/** Smooth curve through points (Catmull-Rom as cubics), closed or open. */
function smooth(pts, closed = true, k = 1 / 6) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let s = `M${pt(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    s += `C${pt(add2(p1, mul(sub(p2, p0), k)))} ${pt(sub(p2, mul(sub(p3, p1), k)))} ${pt(p2)}`;
  }
  return closed ? `${s}Z` : s;
}
/** Circle arc from point `p0` to `p1` around `c` (cw: clockwise on screen; large: more than half). */
const arcTo = (c, r, p1, cw, large = 0) => `A${f(r)} ${f(r)} 0 ${large} ${cw ? 1 : 0} ${pt(p1)}`;
/** The area an open piece clears (the slash, a stick in front): the path out and back, closed. */
const knockLine = (...pts) => `M${pts.map(pt).join('L')}${pts
  .slice(0, -1)
  .reverse()
  .map((p) => `L${pt(p)}`)
  .join('')}Z`;

/** A frame along an axis: `at(s, t)` is s along the axis (at `deg` degrees from O) and t across it. */
const frame = (O, deg) => {
  const u = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const n = [-u[1], u[0]];
  return (s, t = 0) => [O[0] + s * u[0] + t * n[0], O[1] + s * u[1] + t * n[1]];
};

// ── Icons and their blocks ────────────────────────────────────────────────────────────────────
const icons = {};
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** The badges' center (DESIGN.md › Badges). */
const BC = [17.25, 17.25];
/** Each badge's gesture, as the rest of the set: signs beat, tools rock, arrows slide. */
const BADGE_MOTION = {
  plus: { effect: 'beat', parts: ['badge'], origin: BC },
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  heart: { effect: 'beat', parts: ['badge'], origin: BC },
  search: { effect: 'wiggle', parts: ['badge'], origin: BC },
  'arrow-down': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
};

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
/**
 * Two bouts joined by a waist: circles of radius R1 at C1 and R2 at C2, the waist two concave arcs
 * of radius rw tangent to both (the acoustic guitar, the violin, the cello). Clockwise from the
 * lower bout.
 */
function bouts(C1, R1, C2, R2, rw) {
  const d = len(sub(C2, C1));
  const u = unit(sub(C2, C1));
  const n = [-u[1], u[0]];
  const [a, b] = [R1 + rw, R2 + rw];
  const s = (d * d + a * a - b * b) / (2 * d);
  const t = Math.sqrt(a * a - s * s);
  const W = (k) => add2(add2(C1, mul(u, s)), mul(n, k * t));
  const on = (C, R, P) => add2(C, mul(unit(sub(P, C)), R));
  const [Wp, Wm] = [W(1), W(-1)];
  const [T1p, T1m, T2p, T2m] = [on(C1, R1, Wp), on(C1, R1, Wm), on(C2, R2, Wp), on(C2, R2, Wm)];
  const far1 = sub(C1, mul(u, R1));
  const far2 = add2(C2, mul(u, R2));
  const cw = (c, p, q) => cross(sub(p, c), sub(q, c)) > 0;
  return (
    `M${pt(T1p)}` +
    arcTo(C1, R1, T1m, cw(C1, T1p, far1), 1) +
    arcTo(Wm, rw, T2m, cw(Wm, T1m, T2m), 0) +
    arcTo(C2, R2, T2p, cw(C2, T2m, far2), 1) +
    arcTo(Wp, rw, T1p, cw(Wp, T2p, T1p), 0) +
    'Z'
  );
}

// The guitars: on the diagonal, the lower bout at the bottom left and the head at the top right.
// One neck (a line out of the body) and one head (a small rounded block turned 12° off the neck).
const GUITAR = frame([7.25, 16.75], -45);
const NECK_END = 15.25;
const guitarHead = (at = GUITAR) => {
  const N = at(NECK_END);
  const H = frame(N, -45 - 12);
  return roundpoly([H(0, -1.35), H(4, -1.5), H(4, 1.5), H(0, 1.35)], [0.5, 1, 1, 0.5]);
};
const guitarNeck = (s0, at = GUITAR) => line(at(s0), at(NECK_END));

// ── Strings ───────────────────────────────────────────────────────────────────────────────────
// Acoustic guitar: the figure eight (a lower bout of r 5 and an upper bout of r 4.1 joined by a waist
// of r 1.5), the sound hole in the upper bout, the bridge across the lower one, the neck and the head.
// The sound hole is a dot, ink at every weight (a ring of r 1.25 closed to a pinhole at bold).
{
  const body = bouts(GUITAR(0), 5, GUITAR(6), 4.1, 1.5);
  const hole = dot(...GUITAR(6), 0.95);
  const bridge = line(GUITAR(-1.25, -1.75), GUITAR(-1.25, 1.75));
  add('guitar', ['guitarra', 'guitarra acústica', 'clases de guitarra', 'instrumento', 'guitar', 'acoustic guitar', 'instrument'], [body, hole, bridge, guitarNeck(10.1), guitarHead()]);
  FILL.guitar = { solid: [0, 4], cut: [1, 2], wire: [3] };
  PARTS.guitar = { body: [0, 1, 2], neck: [3, 4] };
  MOTION.guitar = { effect: 'wiggle', origin: GUITAR(0) };
}
// Electric guitar: the same neck and head on a solid body with two horns of different lengths (the
// offset double cutaway) and two pickups across it. (Its knob is left out: the lower bout has no
// room for it 3 clear of the pickups and the edge.)
{
  const P = [
    [-5, 0], [-4.2, 3.1], [-1.6, 4.85], [1.6, 4.3], [3.8, 3.55], [6.1, 3.45], [7.3, 2.6], [6.7, 1.55], [5.2, 1.45],
    [5.2, -1.45], [7.4, -1.9], [9.1, -2.85], [8.6, -4.05], [5.8, -4.3], [3.2, -4.05], [0.6, -4.9], [-2.6, -4.85], [-4.4, -3],
  ];
  const body = smooth(P.map(([s, t]) => GUITAR(s, t)));
  const pickups = [-1, 2].map((s) => line(GUITAR(s, -1.2), GUITAR(s, s > 0 ? 1.05 : 1.2)));
  add('guitar-electric', ['guitarra eléctrica', 'rock', 'amplificador', 'instrumento', 'electric guitar', 'rock', 'instrument'], [body, ...pickups, guitarNeck(5.2), guitarHead()]);
  FILL['guitar-electric'] = { solid: [0, 4], cut: [1, 2], wire: [3] };
  PARTS['guitar-electric'] = { body: [0, 1, 2], neck: [3, 4] };
  MOTION['guitar-electric'] = { effect: 'wiggle', origin: GUITAR(0) };
}
// Banjo: the guitars' neck and head on a round drum body, the neck running over the head to the
// bridge. (An inner ring for the head, 3 inside the rim, read as a target or a record on a stick.)
{
  const B = frame([7.5, 16.5], -45);
  add('banjo', ['banjo', 'bluegrass', 'country', 'folk', 'banjo', 'instrument'], [circ(...B(0), 5.5), line(B(-1.75, -1.75), B(-1.75, 1.75)), line(B(-1.75), B(5.5)), guitarNeck(5.5, B), guitarHead(B)]);
  FILL.banjo = { solid: [0, 4], cut: [1, line(B(-1.75), B(6.5))], wire: [3] };
  PARTS.banjo = { body: [0, 1], neck: [2, 3, 4] };
  MOTION.banjo = { effect: 'wiggle', origin: B(0) };
}
// Violin: steeper than the guitars, its waisted body (the bouts of the guitars, smaller), the
// fingerboard from the upper bout out to the scroll (a dot: a ring that small closed at bold). The
// bow crosses behind its waist, square to it and off the slash's diagonal (across the upper bout the
// engine left only a stub of it): the violin goes on top and the engine clears the bow around it.
{
  const W = [11.5, 12.5];
  const V = frame(add2(W, mul([Math.cos((-58 * Math.PI) / 180), Math.sin((-58 * Math.PI) / 180)], -3.04)), -58);
  const body = bouts(V(0), 3.5, V(5), 2.9, 1.3);
  const board = line(V(5), V(7.9));
  const neck = line(V(7.9), V(13.25));
  const scroll = dot(...V(13.5), 0.95);
  const u = [Math.cos((32 * Math.PI) / 180), Math.sin((32 * Math.PI) / 180)];
  const bowA = add2(W, mul(u, -10.25));
  const bowB = add2(W, mul(u, 10.75));
  const bow = line(bowA, bowB);
  const frog = bar(lerp(bowA, bowB, 0.8), lerp(bowA, bowB, 0.91), 0.4);
  add('violin', ['violín', 'música clásica', 'cuerdas', 'arco', 'violin', 'fiddle', 'strings'], [bow, frog], {
    badge: {
      d: [body, board, neck, scroll],
      knock: `${body}${knockLine(V(7.9), V(13.5))}${scroll}`,
      fill: { solid: [body, scroll], cut: [board], wire: [neck] },
    },
  });
  FILL.violin = false;
  PARTS.violin = { bow: [0, 1] };
}
// Cello: upright, the violin's waisted body, the fingerboard running from the waist up the neck to the
// scroll (a dot, as on the violin), the bridge across the lower bout and the endpin on the ground. (A
// body filling the canvas left no neck, and its f-holes, as curls, read as a face: a gourd.)
{
  const body = bouts([12, 15], 4.25, [12, 9.75], 3.25, 1.5);
  const scroll = dot(12, 3.5, 0.95);
  const board = vl(12, 6.5, 12.5);
  add('cello', ['violonchelo', 'chelo', 'orquesta', 'cuerdas', 'cello', 'orchestra', 'strings'], [body, board, vl(12, 3.5, 6.5), scroll, hl(15.75, 11, 13), vl(12, 19.25, 21.25)]);
  FILL.cello = { solid: [0, 3], cut: [1, 4], wire: [2, 5] };
  PARTS.cello = { body: [0, 1, 4], neck: [2, 3], endpin: [5] };
}
// Harp: the column (a bar of ink), the neck curving over the top and the soundboard running back
// down to the column's foot, four strings between them.
{
  const col = bar([4.5, 4.25], [4.5, 20.5], 0.4);
  const neck = 'M4.5 4.25C7 1.75 9.25 6.25 12.25 5.75C15 5.3 16.5 2.75 19.25 4.25';
  const top = [19.25, 4.25];
  const foot = [4.5, 20.5];
  const board = line(top, foot);
  const yAt = (x) => top[1] + ((top[0] - x) * (foot[1] - top[1])) / (top[0] - foot[0]);
  const neckY = (x) => {
    // the neck's y at x, sampled from its two cubics
    const segs = [
      [[4.5, 4.25], [7, 1.75], [9.25, 6.25], [12.25, 5.75]],
      [[12.25, 5.75], [15, 5.3], [16.5, 2.75], [19.25, 4.25]],
    ];
    for (const [p0, p1, p2, p3] of segs) {
      for (let i = 0; i <= 400; i++) {
        const t = i / 400;
        const m = 1 - t;
        const X = m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0];
        if (Math.abs(X - x) < 0.03) return m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1];
      }
    }
    return 5;
  };
  const strings = [7.5, 10.5, 13.5, 16.5].map((x) => vl(x, neckY(x), yAt(x)));
  add('harp', ['arpa', 'música clásica', 'orquesta', 'relajante', 'harp', 'classical', 'relaxing'], [col, neck, board, ...strings]);
  FILL.harp = false;
  PARTS.harp = { frame: [0, 1, 2], strings: [3, 4, 5, 6] };
}
// Lyre: a U whose arms curl outward at the top, the crossbar between them and three strings down to
// the sound box.
{
  const arm = (k) => {
    const x = (v) => 12 + k * v;
    return `M${pt([x(3.25), 17.75])}C${pt([x(7.5), 16.75])} ${pt([x(7.75), 11])} ${pt([x(6), 6.5])}C${pt([x(5.25), 4.5])} ${pt([x(6.5), 3])} ${pt([x(8), 3.75])}`;
  };
  const box = 'M8.75 17.75H15.25V18.75A2.5 2.5 0 0 1 12.75 21.25H11.25A2.5 2.5 0 0 1 8.75 18.75Z';
  const xbar = hl(7.5, 5.95, 18.05);
  add('lyre', ['lira', 'poesía', 'música antigua', 'escuela de música', 'lyre', 'poetry', 'ancient music'], [box, arm(-1), arm(1), xbar, ...[9, 12, 15].map((x) => vl(x, 7.5, 17.75))]);
  FILL.lyre = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS.lyre = { frame: [0, 1, 2, 3], strings: [4, 5, 6] };
}
// Guitar pick: a rounded triangle, wider and softer at the top, point down and tipped a little as it
// lies in the hand, with the grip ridge following its top edge.
{
  const pick = 'M12 3.25C16.75 3.25 20.25 4.5 20.25 8C20.25 12.25 15.25 18.5 13.35 20.4C12.6 21.15 11.4 21.15 10.65 20.4C8.75 18.5 3.75 12.25 3.75 8C3.75 4.5 7.25 3.25 12 3.25Z';
  const ridge = 'M8.75 8.5C10.75 7.5 13.25 7.5 15.25 8.5';
  const tip = (d) => turnPath(d, -18, [12, 12.25]);
  add('guitar-pick', ['púa', 'plumilla', 'uñeta', 'guitarra', 'guitar pick', 'plectrum', 'picking'], [tip(pick), tip(ridge)]);
  FILL['guitar-pick'] = { solid: [0], cut: [1] };
}

// ── Keys ──────────────────────────────────────────────────────────────────────────────────────
// Grand piano in profile: the case with its tail rounded, the lid raised over it (the wing's curve
// descending to the tail) on its prop stick, the keyboard ledge at the front and two legs.
{
  const kase = roundpoly([[6.5, 11.75], [18.5, 11.75], [21.25, 13.25], [21.25, 15.25], [6.5, 15.25]], [0.75, 1.5, 1.25, 0.75, 0.75]);
  const lid = 'M7.25 11.75L8.5 4.25C13.5 4.25 18.25 7.5 20.75 11.75';
  add('piano', ['piano', 'piano de cola', 'clases de piano', 'recital', 'grand piano', 'piano', 'recital'], [kase, lid, vl(12.5, 11.75, 4.85), hl(12.75, 2.75, 6.5), vl(8.75, 15.25, 20.75), vl(19, 15.25, 20.75)]);
  FILL.piano = { solid: [0, shut(lid)], wire: [3, 4, 5], cut: [2] };
  PARTS.piano = { case: [0], lid: [1, 2], keys: [3], legs: [4, 5] };
}
// Upright piano from the front: the case standing on its two feet, the keyboard across its middle
// with its black keys hanging from it (bars of ink, as on piano-keys) and the music desk above.
{
  const kase = roundpoly([[4.75, 3.25], [19.25, 3.25], [19.25, 21.25], [16.75, 21.25], [16.75, 19], [7.25, 19], [7.25, 21.25], [4.75, 21.25]], [2.5, 2.5, 0.75, 0.75, 0.5, 0.5, 0.75, 0.75]);
  const blacks = [8.75, 12, 15.25].map((x) => bar([x, 11.75], [x, 14.25], 0.4));
  add('upright-piano', ['piano vertical', 'piano de pared', 'práctica', 'escuela de música', 'upright piano', 'practice', 'music school'], [kase, hl(11.75, 4.75, 19.25), ...blacks, hl(7.75, 8.25, 15.75)]);
  FILL['upright-piano'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['upright-piano'] = { case: [0], keys: [1, 2, 3, 4], desk: [5] };
}
// Piano keys from above: four white keys and three black ones hanging from the top edge (bars of
// ink), each black key continuing down as its divider.
{
  const X = [8.25, 12, 15.75];
  const blacks = X.map((x) => bar([x, 4.75], [x, 11.25], 0.35));
  const dividers = X.map((x) => vl(x, 11.25, 19.5));
  add('piano-keys', ['teclas de piano', 'teclado', 'midi', 'escalas', 'piano keys', 'keyboard', 'keys'], [sq(4.5, 4.5, 15, 15, 3.5), ...blacks, ...dividers]);
  FILL['piano-keys'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['piano-keys'] = { keys: [0, 4, 5, 6], black: [1, 2, 3] };
}
// Synthesizer: a wide low body, three knobs (dots) along the top and the keyboard below its line, its
// black keys hanging from it.
{
  const blacks = [6.3, 10.1, 17.7].map((x) => bar([x, 11.75], [x, 14.5], 0.35));
  add('synthesizer', ['sintetizador', 'teclado midi', 'música electrónica', 'diseño de sonido', 'synthesizer', 'synth', 'midi keyboard'], [sq(2.5, 5, 19, 14, 3, BR), ...[6.5, 12, 17.5].map((x) => dot(x, 8.25)), hl(11.75, 2.5, 21.5), ...blacks]);
  FILL.synthesizer = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS.synthesizer = { body: [0], knobs: [1, 2, 3], keys: [4, 5, 6, 7] };
}
// Pipe organ: five pipes side by side, the middle one tallest, each standing on its conical foot (a V
// below the line of the mouths) over the wind chest's line. (Flat-footed pipes with a zigzag of mouths
// across them read as a skyline or a bar chart at 18 px.)
{
  const tops = [10.5, 7.5, 4.5, 7.5, 10.5];
  const xs = [4.5, 7.5, 10.5, 13.5, 16.5, 19.5];
  const m = 16;
  let pipes = `M4.5 ${m}V${tops[0]}`;
  for (let i = 0; i < 5; i++) pipes += `H${xs[i + 1]}${i < 4 ? `V${tops[i + 1]}` : ''}`;
  pipes += `V${m}`;
  for (let i = 4; i >= 0; i--) pipes += `L${f(xs[i] + 1.5)} 20.25L${f(xs[i])} ${m}`;
  pipes += 'Z';
  const walls = [1, 2, 3, 4].map((i) => vl(xs[i], Math.max(tops[i - 1], tops[i]), m));
  // The feet stand free: on a chest's line, the small holes between two feet and the line closed at bold
  add('pipe-organ', ['órgano', 'órgano de tubos', 'iglesia', 'música clásica', 'pipe organ', 'organ', 'church'], [pipes, ...walls, hl(m, 4.5, 19.5)]);
  FILL['pipe-organ'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['pipe-organ'] = { pipes: [0, 1, 2, 3, 4], mouths: [5] };
}
// Accordion, opened: the two end boxes, the larger one the keyboard's, and the bellows between them
// (zigzag edges, two folds).
{
  const zig = (y0, y1) => line(...[6.5, 8, 9.5, 11, 12.5, 14, 15.5].map((x, i) => [x, i % 2 ? y1 : y0]));
  add('piano-accordion', ['acordeón', 'tango', 'polka', 'folclor', 'accordion', 'tango', 'folk'], [sq(2.5, 5.5, 4, 13, 1.5), sq(15.5, 5.5, 5, 13, 1.75, BR), zig(7, 8.5), zig(17, 15.5), vl(9.5, 7, 17), vl(12.5, 7, 17)]);
  FILL['piano-accordion'] = { solid: [0, 1], wire: [2, 3, 4, 5] };
  PARTS['piano-accordion'] = { boxes: [0, 1], bellows: [2, 3, 4, 5] };
  MOTION['piano-accordion'] = { effect: 'beat', parts: ['bellows'], origin: [12, 12] };
}
// Harmonica from the front: a long flat bar, the edges of its two cover plates and the row of square
// holes between them.
{
  add('harmonica', ['armónica', 'blues', 'folk', 'tablaturas', 'harmonica', 'blues harp', 'mouth organ'], [sq(2.5, 7.5, 19, 9, 3), hl(10.5, 2.5, 21.5), hl(13.5, 2.5, 21.5), ...[6, 9, 12, 15, 18].map((x) => vl(x, 10.5, 13.5))]);
  FILL.harmonica = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS.harmonica = { body: [0], holes: [1, 2, 3, 4, 5, 6, 7] };
}

// ── Drums and percussion ──────────────────────────────────────────────────────────────────────
// The drums share one head: a level ellipse, its shell dropping from its ends to a bottom edge of the
// same curve.
const drumShell = (cx, cy, rx, ry, depth) => `M${pt([cx - rx, cy])}V${f(cy + depth)}A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx + rx, cy + depth])}V${f(cy)}`;
/** The stands' tripod: a pole down to `foot` and two legs splaying from `hub`. */
const tripod = (x, hub, foot, spread) => line([x - spread, foot], [x, hub], [x + spread, foot]);

// Snare drum in three-quarter view: the head, the shell with its zigzag of tension cords, and two
// sticks crossing above it.
{
  const [cx, cy, rx, ry, dep] = [12, 13.25, 8.5, 2.75, 5.25];
  const zz = line(...[6, 9, 12, 15, 18].map((x, i) => [x, i % 2 ? ellY(cx, cy + dep, rx, ry, x) : ellY(cx, cy, rx, ry, x)]));
  add('drum', ['tambor', 'redoblante', 'batería', 'percusión', 'drum', 'snare', 'percussion'], [ell(cx, cy, rx, ry), drumShell(cx, cy, rx, ry, dep), zz, line([4.5, 2.75], [15, 7.5]), line([19.5, 2.75], [9, 7.5])]);
  FILL.drum = { solid: [0, shut(drumShell(cx, cy, rx, ry, dep))], cut: [2], wire: [3, 4] };
  PARTS.drum = { head: [0], shell: [1, 2], sticks: [3, 4] };
  MOTION.drum = { effect: 'beat', parts: ['head', 'shell'], origin: [12, 16] };
}
// Drum kit from the front: the bass drum, the tom (the drums' head on a short shell) mounted on it, a
// cymbal on its stand. (A rounded box for the tom read with the bass drum as an 8.)
{
  // The tom's head and shell 2.75 deep (flatter, their paper closed at bold)
  const [cx, cy, rx, ry, dep] = [9.5, 4.25, 3.75, 1.5, 2.75];
  const shell = drumShell(cx, cy, rx, ry, dep);
  add('drum-kit', ['batería', 'kit de batería', 'banda', 'ensayo', 'drum kit', 'drums', 'band'], [circ(9.5, 16, 5.25), ell(cx, cy, rx, ry), shell, vl(9.5, cy + dep + ry, 10.75), line([16.25, 6.9], [21.5, 5.25]), vl(18.75, 6.1, 21.25), tripod(18.75, 18.5, 21.25, 2.25)]);
  FILL['drum-kit'] = { solid: [0, 1, shut(shell)], wire: [3, 4, 5, 6] };
  PARTS['drum-kit'] = { drums: [0, 1, 2, 3], cymbal: [4, 5, 6] };
}
// Cymbal: the thin plate with its bell, on a straight stand with a tripod foot.
{
  const plate = ell(12, 8.25, 9, 1.5);
  const y = ellY(12, 8.25, 9, 1.5, 10, -1);
  const bell = `M${pt([10, y])}A2 2 0 0 1 ${pt([14, y])}`;
  add('cymbal', ['platillo', 'crash', 'ride', 'batería', 'cymbal', 'crash', 'drums'], [plate, bell, vl(12, 9.75, 21.25), tripod(12, 17.25, 21.25, 4.5)]);
  FILL.cymbal = { solid: [0, shut(bell)], wire: [2, 3] };
  PARTS.cymbal = { plate: [0, 1], stand: [2, 3] };
  MOTION.cymbal = { effect: 'wiggle', parts: ['plate'], origin: [12, 8.25] };
}
// Gong: the disc with its boss hanging by two cords in its frame, on two feet.
{
  const fr = rl([[3.5, 21.25], [3.5, 4], [20.5, 4], [20.5, 21.25]], [0, 1.5, 1.5, 0]);
  const disc = circ(12, 13, 5.5);
  const cy = (x) => 13 - Math.sqrt(5.5 * 5.5 - (x - 12) ** 2);
  add('gong', ['gong', 'meditación', 'anuncio', 'percusión', 'gong', 'meditation', 'announcement'], [fr, hl(21.25, 2, 5), hl(21.25, 19, 22), vl(10, 4, cy(10)), vl(14, 4, cy(14)), disc, circ(12, 13, 1.75)]);
  FILL.gong = { solid: [5], cut: [6], wire: [0, 1, 2, 3, 4] };
  PARTS.gong = { frame: [0, 1, 2], cords: [3, 4], disc: [5, 6] };
  MOTION.gong = { effect: 'ring', parts: ['disc', 'cords'], origin: [12, 4] };
}
// Tambourine: the drums' ellipse head on a shallow frame, three slots for the jingles cut in it.
{
  const [cx, cy, rx, ry, dep] = [12, 10, 9, 5.25, 3.75];
  const slots = [4.75, 7.75, 10.5, 13.5, 16.25, 19.25].map((x) => line([x, ellY(cx, cy, rx, ry, x)], [x, ellY(cx, cy + dep, rx, ry, x)]));
  add('tambourine', ['pandereta', 'pandero', 'percusión', 'música infantil', 'tambourine', 'percussion', 'jingles'], [ell(cx, cy, rx, ry), drumShell(cx, cy, rx, ry, dep), ...slots]);
  FILL.tambourine = { solid: [0, shut(drumShell(cx, cy, rx, ry, dep))], cut: [2, 3, 4, 5, 6, 7] };
  PARTS.tambourine = { frame: [0, 1], jingles: [2, 3, 4, 5, 6, 7] };
  MOTION.tambourine = { effect: 'wiggle', origin: [12, 12] };
}

// Maracas: two in a V, each an oval head on a straight handle, the handles meeting at the bottom.
{
  const M = [12, 21];
  const maraca = (k) => {
    const a = (32 * Math.PI) / 180;
    const dir = [-k * Math.sin(a), -Math.cos(a)];
    const bottom = add2(M, mul(dir, 6.5));
    const c = add2(bottom, mul(dir, 4.25));
    return [ell(...c, 4.25, 3, (Math.atan2(dir[1], dir[0]) * 180) / Math.PI), line(bottom, M)];
  };
  const [L, R] = [maraca(1), maraca(-1)];
  add('maracas', ['maracas', 'percusión', 'música latina', 'sonajas', 'maracas', 'shakers', 'latin music'], [L[0], R[0], L[1], R[1]]);
  FILL.maracas = { solid: [0, 1], wire: [2, 3] };
  PARTS.maracas = { heads: [0, 1], handles: [2, 3] };
  MOTION.maracas = { effect: 'wiggle', origin: M };
}
// Xylophone: four bars of decreasing length (bars of ink, heavier than the rails, as on the chimes)
// lying across two rails that converge, and the mallet standing beside them, its head a ball. (Bars
// as plain strokes made a fence with the rails; a mallet crossing them, cleared around by the engine,
// cut them into a tangle at 18 px.)
// The rails run 2 inside the bars' ends and stop 1.25 past them, 3.3 apart at the short end.
const XYLO = [4.75, 8.5, 12.25, 16];
const XYLO_L = [14, 12, 10, 8];
{
  const bars = XYLO.map((x, i) => bar([x, 12 - XYLO_L[i] / 2], [x, 12 + XYLO_L[i] / 2], 0.35));
  const k = 3 / 11.25;
  const rail = (s) => line([3.5, 12 + s * (5 + 1.25 * k)], [17.25, 12 + s * (2 - 1.25 * k)]);
  const ball = [20.2, 5.75];
  add('xylophone', ['xilófono', 'marimba', 'glockenspiel', 'música infantil', 'xylophone', 'marimba', 'mallets'], [...bars, rail(-1), rail(1), line([21.25, 21], ball), dot(...ball, 0.95)]);
  FILL.xylophone = false;
  PARTS.xylophone = { bars: [0, 1, 2, 3], rails: [4, 5], mallet: [6, 7] };
  MOTION.xylophone = { effect: 'wiggle', parts: ['mallet'], origin: [21.25, 21] };
}
// Triangle: open at its bottom left corner, hanging from a short string at its top, the beater
// striking its right side.
{
  const tri = rl([[7, 19.5], [20, 19.5], [12, 6.25], [4.75, 18.25]], [0, 1, 1, 0]);
  const side = lerp([20, 19.5], [12, 6.25], 0.5);
  const nrm = unit([13.25, 8]);
  add('triangle-instrument', ['triángulo', 'percusión', 'orquesta', 'música infantil', 'triangle', 'percussion', 'ding'], [tri, vl(12, 2.75, 7.25), line(side, add2(side, mul(nrm, 6)))]);
  FILL['triangle-instrument'] = false;
  PARTS['triangle-instrument'] = { triangle: [0], string: [1], beater: [2] };
  MOTION['triangle-instrument'] = { effect: 'ring', parts: ['triangle'], origin: [12, 2.75] };
}
// Bongos: two short drums of different sizes, the drums' ellipse heads on tapered shells, joined by
// a small block.
{
  const drum = (cx, cy, rx, ry, bx, by) => [ell(cx, cy, rx, ry), `M${pt([cx - rx, cy])}L${pt([cx - bx, by])}A${f(bx)} ${f(ry * 0.8)} 0 0 0 ${pt([cx + bx, by])}L${pt([cx + rx, cy])}`];
  const L = drum(7, 8.75, 4.25, 1.75, 3, 19);
  const R = drum(17.5, 10.25, 3.5, 1.5, 2.5, 18);
  const xL = (y) => 7 + 4.25 - ((y - 8.75) * 1.25) / 10.25;
  const xR = (y) => 17.5 - 3.5 + ((y - 10.25) * 1) / 7.75;
  add('bongos', ['bongós', 'bongo', 'percusión latina', 'tambores de mano', 'bongos', 'hand drums', 'latin percussion'], [L[0], R[0], L[1], R[1], hl(12.75, xL(12.75), xR(12.75)), hl(15.75, xL(15.75), xR(15.75))]);
  FILL.bongos = { solid: [0, 1, shut(L[1]), shut(R[1])], wire: [4, 5] };
  PARTS.bongos = { heads: [0, 1], shells: [2, 3], block: [4, 5] };
  MOTION.bongos = { effect: 'beat', origin: [12, 12] };
}
// Djembe: the drums' head on a goblet, its rope a zigzag down the bowl to a ring at the waist.
{
  const [cx, cy, rx, ry] = [12, 5.5, 7, 2.25];
  const goblet = 'M5 5.5C5 10.25 9.75 11.75 10.1 14.5C10.4 16.9 8 18.75 8 20.75H16C16 18.75 13.6 16.9 13.9 14.5C14.25 11.75 19 10.25 19 5.5';
  const ring = 'M7.95 11.25Q12 13 16.05 11.25';
  const zz = line([7.75, ellY(cx, cy, rx, ry, 7.75)], [10, 12.06], [12, ellY(cx, cy, rx, ry, 12)], [14, 12.06], [16.25, ellY(cx, cy, rx, ry, 16.25)]);
  add('djembe', ['djembé', 'tambor africano', 'percusión', 'círculo de tambores', 'djembe', 'hand drum', 'world percussion'], [ell(cx, cy, rx, ry), goblet, ring, zz]);
  FILL.djembe = { solid: [0, shut(goblet)], cut: [2, 3] };
  PARTS.djembe = { head: [0], body: [1], rope: [2, 3] };
  MOTION.djembe = { effect: 'beat', origin: [12, 12] };
}
// Cowbell: a tapered bell with its mouth's rim and a loop handle on top. (A stick striking its side
// read as a kettle's spout.)
{
  const bell = roundpoly([[9.25, 7], [14.75, 7], [18.25, 20], [5.75, 20]], [1.25, 1.25, 1, 1]);
  const handle = rl([[10.5, 7], [10.5, 4.25], [13.5, 4.25], [13.5, 7]], [0, 1.25, 1.25, 0]);
  add('cowbell', ['cencerro', 'campana de vaca', 'percusión', 'caja de ritmos', 'cowbell', 'percussion', 'drum machine'], [bell, hl(17, 9.25 - (3.5 * 10) / 13 - 0.1, 14.75 + (3.5 * 10) / 13 + 0.1), handle]);
  FILL.cowbell = { solid: [0], cut: [1], wire: [2] };
  PARTS.cowbell = { bell: [0, 1], handle: [2] };
  MOTION.cowbell = { effect: 'wiggle', parts: ['bell', 'handle'], origin: [12, 4.25] };
}
// Chimes: the crossbar, four tubes of decreasing length (bars of ink) hanging apart from it, and the
// small mallet, its head a ball (a ring on a stick read as a magnifier).
{
  const X = [5.75, 9.25, 12.75, 16.25];
  const tubes = X.map((x, i) => bar([x, 4], [x, 19 - 2 * i], 0.45));
  add('chimes', ['campanas tubulares', 'carillón', 'campanillas', 'sonido ambiental', 'chimes', 'tubular bells', 'wind chimes'], [hl(4, 3.5, 18.5), ...tubes, line([21.25, 21.25], [19.25, 17.75]), dot(18.85, 17.1, 0.95)]);
  FILL.chimes = false;
  PARTS.chimes = { bar: [0], tubes: [1, 2, 3, 4], mallet: [5, 6] };
  MOTION.chimes = { effect: 'ring', parts: ['tubes'], origin: [12, 4] };
}

// ── Brass ─────────────────────────────────────────────────────────────────────────────────────
/**
 * The brass's bell: from the tube's end at P0 along `dir`, flaring from half-width w0 to w1 over L
 * (slowly, then fast at the rim: as t^k), closed by its rim.
 */
function bell(P0, dir, L, w0, w1, k = 2.6) {
  const u = unit(dir);
  const nn = [-u[1], u[0]];
  const h = (t) => w0 + (w1 - w0) * Math.max(0, t) ** k;
  const side = (k) => (t) => add2(add2(P0, mul(u, L * t)), mul(nn, k * h(t)));
  return `${curve(side(1), 0, 1, 5)}L${pt(side(-1)(1))}${curve(side(-1), 1, 0, 5, false)}Z`;
}
// Trumpet, pointing right: the mouthpiece, the lead pipe with its three valves (bars of ink), the
// loop of tubing under them and the bell.
{
  const y = 9.75;
  add('trumpet', ['trompeta', 'jazz', 'fanfarria', 'metales', 'trumpet', 'brass', 'fanfare'], [hl(y, 2.75, 13.25), bell([13.25, y], [1, 0], 8, 0, 3.75), ...[6.25, 9.5, 12.75].map((x) => bar([x, y], [x, 5.75], 0.45)), rl([[5.75, y], [5.75, 14.25], [12.75, 14.25], [12.75, y]], [0, 2, 2, 0]), vl(2.75, 8.75, 10.75)]);
  FILL.trumpet = { solid: [1, 2, 3, 4], wire: [0, 5, 6] };
  PARTS.trumpet = { pipe: [0, 5, 6], bell: [1], valves: [2, 3, 4] };
  MOTION.trumpet = { effect: 'beat', parts: ['bell'], origin: [17, y] };
}
// Trombone: the bell section on top, bending down into the long slide (a U) below it, the
// mouthpiece at the slide's end.
{
  add('trombone', ['trombón', 'jazz', 'banda de marcha', 'metales', 'trombone', 'brass', 'marching band'], [bell([13, 7.25], [1, 0], 8.25, 0, 3.75), rl([[13, 7.25], [5.75, 7.25], [5.75, 14.5]], [0, 2, 0]), `M2.75 14.5H18.5A1.5 1.5 0 0 1 18.5 17.5H7.5`, vl(2.75, 13.5, 15.5)]);
  FILL.trombone = { solid: [0], wire: [1, 2, 3] };
  PARTS.trombone = { bell: [0], tubes: [1], slide: [2], mouthpiece: [3] };
  MOTION.trombone = { effect: 'slide', parts: ['slide'], vector: [1.5, 0] };
}
// French horn: the round coil, the brass's bell leaving it along its foot (tangent, as the tubing
// runs) and flaring to the right, and the short mouthpiece pipe at the top right. (A bell leaving the
// coil square to it, with a second turn inside, read as a magnifier on a target.)
{
  // The bell leaves at 16° below the tangent: run along the coil, the sliver between them changed the
  // outline's structure from weight to weight
  const C = [9, 9];
  const r = 5.5;
  add('french-horn', ['corno francés', 'trompa', 'orquesta', 'metales', 'french horn', 'horn', 'brass'], [circ(...C, r), bell([C[0], C[1] + r], [1, 0.3], 11.5, 0, 3.5), line(polar(...C, r, -40), polar(...C, r + 2.75, -40))]);
  FILL['french-horn'] = { solid: [0, 1], wire: [2] };
  PARTS['french-horn'] = { coil: [0], bell: [1], mouthpiece: [2] };
  MOTION['french-horn'] = { effect: 'beat', parts: ['bell'], origin: [20, 17.75] };
}

// ── Woodwinds ─────────────────────────────────────────────────────────────────────────────────
// Saxophone: the J, a tube widening from the neck down to the bow and up into the flared bell; the
// neck curving into the mouthpiece and three key dots down its front.
{
  const [xa, xb, top, by, R] = [7.5, 16, 5.25, 14, 4.25];
  const cx = (xa + xb) / 2;
  const L1 = by - top;
  const L2 = Math.PI * R;
  const L3 = 5.75;
  const tot = L1 + L2 + L3;
  const C = (s) => {
    if (s <= L1) return [[xa, top + s], [0, 1]];
    if (s <= L1 + L2) {
      const a = Math.PI - (s - L1) / R;
      return [[cx + R * Math.cos(a), by + R * Math.sin(a)], [Math.sin(a), -Math.cos(a)]];
    }
    const u = unit([0.6, -L3]);
    return [add2([xb, by], mul(u, s - L1 - L2)), u];
  };
  const W = (s) => (s < 2.25 ? 1.5 + (1.1 * s) / 2.25 : s < L1 + L2 ? 2.6 : 2.6 + 1.6 * Math.max(0, (s - L1 - L2) / L3) ** 2.4);
  const side = (k) => (s) => {
    const [c, u] = C(s);
    return add2(c, mul([-u[1], u[0]], k * W(s)));
  };
  const body = `${curve(side(-1), 0, tot, 14)}L${pt(side(1)(tot))}${curve(side(1), tot, 0, 14, false)}Z`;
  const neck = `M${pt([xa, top])}C${pt([xa, 3.25])} ${pt([6.25, 2.5])} ${pt([3.75, 3.25])}`;
  add('saxophone', ['saxofón', 'saxo', 'jazz', 'soul', 'saxophone', 'sax', 'jazz'], [body, neck, ...[9, 12, 15].map((y) => dot(xa, y, 0.3))]);
  FILL.saxophone = { solid: [0], cut: [2, 3, 4], wire: [1] };
  PARTS.saxophone = { body: [0], neck: [1], keys: [2, 3, 4] };
  MOTION.saxophone = { effect: 'wiggle', origin: [11.75, 18] };
}
// Clarinet, nearly upright: the mouthpiece (a bar of ink), the barrel's joint across the slim tube and
// the bell flaring at its foot. (A tube wide enough for key dots, with a flat flare, read as a tube of
// toothpaste; inside a slim one the dots ran into its walls at bold.)
{
  const flare = (k) => (t) => [12 + k * (1.75 + 2 * Math.max(0, k > 0 ? t : 1 - t) ** 2.2), 15.75 + 5.5 * (k > 0 ? t : 1 - t)];
  const tube = `M10.25 6.25H13.75V15.75${curve(flare(1), 0, 1, 4, false)}H8.25${curve(flare(-1), 0, 1, 4, false)}Z`;
  const T = (d) => turnPath(d, 10, [12, 12.25]);
  add('clarinet', ['clarinete', 'maderas', 'orquesta', 'banda escolar', 'clarinet', 'woodwind', 'school band'], [T(tube), T(bar([12, 2.75], [12, 6.25], 0.45)), T(hl(9.25, 10.25, 13.75))]);
  FILL.clarinet = { solid: [0, 1], cut: [2] };
  PARTS.clarinet = { body: [0, 2], mouthpiece: [1] };
}
// Flute: a long straight tube on a slight diagonal, the embouchure near its left end (a short bar of
// ink) and a row of key dots, no bell.
{
  const T = (d) => turnPath(d, -18, [12, 12]);
  add('flute', ['flauta', 'flauta traversa', 'maderas', 'música tranquila', 'flute', 'woodwind', 'calm music'], [T(sq(2.75, 9.5, 18.5, 5, 1.25)), T(bar([5.75, 12], [7.75, 12], 0.45)), ...[11.5, 14.5, 17.5].map((x) => T(dot(x, 12, 0.3)))]);
  FILL.flute = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS.flute = { body: [0], keys: [1, 2, 3, 4] };
}
// Pan flute: five tubes side by side, their tops on one line and their feet stepping up, bound by a
// band (two lines across them made a grid).
{
  const bots = [20, 18, 16, 14, 12];
  let tubes = 'M4.5 4.5H19.5';
  for (let i = 4; i >= 0; i--) tubes += `V${f(bots[i])}H${f(4.5 + 3 * i)}`;
  tubes += 'Z';
  const walls = [1, 2, 3, 4].map((i) => vl(4.5 + 3 * i, 4.5, bots[i]));
  add('pan-flute', ['flauta de pan', 'zampoña', 'folclor', 'música relajante', 'pan flute', 'panpipes', 'folk'], [tubes, ...walls, hl(8, 4.5, 19.5)]);
  FILL['pan-flute'] = { solid: [0], cut: [...[1, 2, 3, 4].map((i) => vl(4.5 + 3 * i, 3.5, bots[i] + 0.75)), hl(8, 3.25, 20.75)] };
  PARTS['pan-flute'] = { tubes: [0, 1, 2, 3, 4], band: [5] };
}

// ── Studio and live sound ─────────────────────────────────────────────────────────────────────
// Mixing desk: four knobs along the top and four fader slots below, each cap (a bar of ink) at its
// own height.
{
  const X = [6.25, 10.08, 13.92, 17.75];
  const caps = [14.75, 12.25, 14.75, 12.25];
  add('mixing-console', ['mesa de mezcla', 'consola', 'mezclar', 'sonido en vivo', 'mixing console', 'mixer', 'soundboard'], [sq(2.75, 3.75, 18.5, 15.5, 3, BR), ...X.map((x) => dot(x, 8, 0.5)), ...X.map((x) => vl(x, 11.4, 15.75)), ...X.map((x, i) => bar([x - 0.6, caps[i]], [x + 0.6, caps[i]], 0.4))]);
  FILL['mixing-console'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
  PARTS['mixing-console'] = { body: [0], knobs: [1, 2, 3, 4], faders: [5, 6, 7, 8, 9, 10, 11, 12] };
}
// Audio interface: a low wide box, two input jacks on the left, the meter bar and the large gain knob,
// its pointer from the center to the rim. (A pointer across the whole knob read as a screw's slot.)
{
  add('audio-interface', ['interfaz de audio', 'tarjeta de sonido', 'estudio en casa', 'grabar', 'audio interface', 'sound card', 'home studio'], [sq(2.5, 5, 19, 14, 3, BR), circ(6.75, 9.25, 1.25), circ(6.75, 14.75, 1.25), vl(11, 9.25, 14.75), circ(16.5, 12, 2.25), line([16.5, 12], polar(16.5, 12, 2.25, -125))]);
  FILL['audio-interface'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['audio-interface'] = { body: [0], inputs: [1, 2], meter: [3], knob: [4, 5] };
}
// Drum machine: a portrait body, the screen and a knob along the top and the 2 × 2 grid of pads.
{
  const pads = [9.1, 14.95].flatMap((y) => [7.6, 13.45].map((x) => sq(x, y, 3, 3, 0.9)));
  add('drum-machine', ['caja de ritmos', 'sampler', 'pads', 'hacer beats', 'drum machine', 'sampler', 'beat maker'], [sq(4.75, 3.25, 14.5, 17.5, 3.5, BR), hl(6.25, 8.25, 11.5), dot(15, 6.25, 0.3), ...pads]);
  FILL['drum-machine'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['drum-machine'] = { body: [0], screen: [1, 2], pads: [3, 4, 5, 6] };
  MOTION['drum-machine'] = { effect: 'beat', parts: ['pads'], origin: [12, 13.5] };
}
// MIDI connector: the round socket with its key notch at the bottom and five pins on the arc above.
{
  const a = (Math.acos(1.5 / 9) * 180) / Math.PI;
  const R0 = polar(12, 12, 9, a);
  const L0 = polar(12, 12, 9, 180 - a);
  const socket = `M${pt(R0)}A9 9 0 1 0 ${pt(L0)}L10.5 19.25L13.5 19.25Z`;
  add('midi-port', ['midi', 'conector midi', 'controlador', 'entrada midi', 'midi port', 'midi connector', 'din'], [socket, ...[180, 225, 270, 315, 0].map((d) => dot(...polar(12, 12, 5, d)))]);
  FILL['midi-port'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['midi-port'] = { socket: [0], pins: [1, 2, 3, 4, 5] };
  icons['midi-port'].variants = { circle: false };
}
// DJ controller: a wide body, one platter (its spindle at the center) and the mixer's two channel
// faders beside it, each cap at its own height. (Two platters side by side read as a face, with spindles
// or with markers.)
{
  // The faders 3.5 apart, so a cap stays clear of the next slot at bold
  const pc = [8.6, 12];
  // (each cap 3 clear of the other slot's ends)
  const [fa, fb] = [14.85, 18.35];
  add('dj-controller', ['controlador dj', 'dj', 'tornamesas', 'mezclar pistas', 'dj controller', 'turntables', 'mixing'], [sq(2.5, 5, 19, 14, 3, BR), circ(...pc, 3.25), dot(...pc, 0.3), vl(fa, 8.5, 15.5), vl(fb, 8.5, 15.5), bar([fa - 0.5, 10], [fa + 0.5, 10], 0.4), bar([fb - 0.5, 13], [fb + 0.5, 13], 0.4)]);
  FILL['dj-controller'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['dj-controller'] = { body: [0], platter: [1, 2], faders: [3, 4, 5, 6] };
  MOTION['dj-controller'] = { effect: 'spin', parts: ['platter'], origin: pc };
}
// Guitar amp: the half stack, the amp's head with its row of knobs standing on the cabinet with its
// speaker. (A combo with a handle on top and the speaker below the knobs read as a camera at 18 px.)
{
  add('guitar-amp', ['amplificador', 'amplificador de guitarra', 'ampli', 'backline', 'guitar amp', 'amplifier', 'amp'], [sq(5, 3.25, 14, 5.5, 1.75, BR), ...[8.5, 12, 15.5].map((x) => dot(x, 6, 0.4)), sq(4, 11.75, 16, 9.5, 2.5, BR), circ(12, 16.5, 2.25)]);
  FILL['guitar-amp'] = { solid: [0, 4], cut: [1, 2, 3, 5] };
  PARTS['guitar-amp'] = { head: [0, 1, 2, 3], cabinet: [4], speaker: [5] };
  MOTION['guitar-amp'] = { effect: 'beat', parts: ['speaker'], origin: [12, 16.5] };
}
// PA speaker: a tapered cabinet, the horn above the cone, on a pole over the stands' tripod.
{
  const cab = roundpoly([[5, 2.75], [19, 2.75], [17.5, 17.25], [6.5, 17.25]], [1.75, 1.75, 1.25, 1.25]);
  add('pa-speaker', ['bocina pa', 'sonido en vivo', 'evento', 'sistema de sonido', 'pa speaker', 'live sound', 'speaker stand'], [cab, hl(5.75, 9.5, 14.5), circ(12, 11.5, 2.75), vl(12, 17.25, 21.25), tripod(12, 18.75, 21.25, 3.5)]);
  FILL['pa-speaker'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS['pa-speaker'] = { cabinet: [0, 1, 2], stand: [3, 4] };
  MOTION['pa-speaker'] = { effect: 'beat', parts: [2], origin: [12, 11.5] };
}
// Subwoofer: a square cabinet, one large cone (the cone and its dust cap, a dot: a ring of r 1.25
// closed at bold) and the port slot.
{
  add('subwoofer', ['subwoofer', 'bajos', 'cine en casa', 'sistema de sonido', 'subwoofer', 'bass', 'home theater'], [sq(3.25, 3.25, 17.5, 17.5, 4, BR), circ(12, 10.5, 4.25), dot(12, 10.5, 0.95), hl(17.75, 9.5, 14.5)]);
  FILL.subwoofer = { solid: [0], cut: [1, 2, 3] };
  PARTS.subwoofer = { cabinet: [0], cone: [1, 2], port: [3] };
  MOTION.subwoofer = { effect: 'beat', parts: ['cone'], origin: [12, 10.5] };
}
// Soundbar: a long low capsule, its row of grille dots, on two small feet.
{
  add('soundbar', ['barra de sonido', 'cine en casa', 'televisión', 'audio', 'soundbar', 'home theater', 'tv audio'], [`M5.5 9H18.5A3 3 0 0 1 18.5 15H5.5A3 3 0 0 1 5.5 9Z`, ...[6, 9, 12, 15, 18].map((x) => dot(x, 12, 0.3)), vl(6.5, 15, 17.5), vl(17.5, 15, 17.5)]);
  FILL.soundbar = { solid: [0], cut: [1, 2, 3, 4, 5], wire: [6, 7] };
  PARTS.soundbar = { body: [0], grille: [1, 2, 3, 4, 5], feet: [6, 7] };
}

// ── Microphones ───────────────────────────────────────────────────────────────────────────────
// Microphone on a stand: microphone-handheld's round head and grille band, angled toward the singer
// as it sits in its clip, its handle (a bar of ink) on top of the pole, over the stands' tripod.
// (Upright on a short pole with a domed base it read as a chess pawn or a trophy; upright on the
// tripod, as a stick figure.)
{
  const C = [15.25, 6.25];
  const R = 3.25;
  const u = [-Math.SQRT1_2, Math.SQRT1_2];
  const nn = [-u[1], u[0]];
  const clip = add2(C, mul(u, 7.75));
  const bandC = add2(C, mul(u, -0.5));
  const bh = Math.sqrt(R * R - 0.25);
  // The handle's bar is 0.4 either side: at 0.45, on the diagonal, it opened a hairline at light
  add('microphone-stand', ['micrófono con pie', 'escenario', 'micrófono abierto', 'cantar', 'microphone stand', 'open mic', 'stage'], [circ(...C, R), line(add2(bandC, mul(nn, bh)), add2(bandC, mul(nn, -bh))), bar(add2(C, mul(u, R)), clip, 0.4), vl(clip[0], clip[1], 21.25), tripod(clip[0], 17.75, 21.25, 4)]);
  FILL['microphone-stand'] = { solid: [0, 2], cut: [1], wire: [3, 4] };
  PARTS['microphone-stand'] = { mic: [0, 1, 2], stand: [3, 4] };
}
// Microphone on a boom arm: microphone-studio's head (its capsule and two bands) standing at the end
// of an arm of two segments jointed at the elbow, clamped to the edge of the desk. (Hanging from the
// arm, the capsule read as a desk lamp's shade.)
{
  const mic = 'M14 6A3 3 0 0 1 20 6V9A3 3 0 0 1 14 9Z';
  const arm = rl([[6.75, 15.5], [8.25, 6.5], [14, 7.5]], [0, 0, 0]);
  add('microphone-arm', ['brazo de micrófono', 'podcast', 'streaming', 'escritorio', 'mic arm', 'boom arm', 'podcast setup'], [mic, hl(6, 14, 20), hl(9, 14, 20), arm, dot(8.25, 6.5), rl([[4, 15.5], [8.75, 15.5], [8.75, 21], [4, 21]], [0, 1, 1, 0]), hl(18.25, 2.25, 8.75)]);
  FILL['microphone-arm'] = { solid: [0], cut: [1, 2], wire: [3, 4, 5, 6] };
  PARTS['microphone-arm'] = { mic: [0, 1, 2], arm: [3, 4], clamp: [5, 6] };
}
// Vintage microphone: the pill-shaped head with its grille slots, held at its sides by the yoke, on a
// short stem and base.
{
  const pill = 'M7.5 7.25A4.5 4.5 0 0 1 16.5 7.25V10.25A4.5 4.5 0 0 1 7.5 10.25Z';
  const yoke = rl([[7.5, 9], [4.5, 9], [4.5, 17.5], [19.5, 17.5], [19.5, 9], [16.5, 9]], [0, 0, 3, 3, 0, 0]);
  add('microphone-vintage', ['micrófono antiguo', 'micrófono retro', 'radio', 'jazz', 'vintage microphone', 'retro mic', 'radio show'], [pill, hl(6.25, 10.75, 13.25), hl(9.25, 10.75, 13.25), yoke, vl(12, 17.5, 21.25), hl(21.25, 9, 15)]);
  FILL['microphone-vintage'] = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
  PARTS['microphone-vintage'] = { head: [0, 1, 2], yoke: [3], stand: [4, 5] };
}
// Pop filter: the studio mic on its stand, and in front of it the round screen (seen at an angle)
// on its curved gooseneck, clamped to the stand.
{
  const mic = 'M14 6.5A3 3 0 0 1 20 6.5V10A3 3 0 0 1 14 10Z';
  add('pop-filter', ['filtro antipop', 'grabar voz', 'estudio', 'micrófono', 'pop filter', 'vocal recording', 'studio'], [mic, hl(6.5, 14, 20), hl(9.5, 14, 20), vl(17, 13, 21.25), hl(21.25, 14.5, 19.5), ell(7.75, 8.25, 2.25, 5), 'M7.75 13.25C7.75 17.25 10.75 18.25 17 18.25']);
  FILL['pop-filter'] = { solid: [0, 5], cut: [1, 2], wire: [3, 4, 6] };
  PARTS['pop-filter'] = { mic: [0, 1, 2], stand: [3, 4], filter: [5, 6] };
}

// ── Meters ────────────────────────────────────────────────────────────────────────────────────
// VU meter: a landscape window with its arc scale, the scale's right end a heavier band, and the needle
// rising from a pivot below the window. (Long ticks off the scale read as the fingers of a hand.)
{
  const P = [12, 21.5];
  const R = 12;
  const red = `M${pt(polar(...P, R - 0.4, -78))}${arc(...P, R - 0.4, -78, -58).d.replace(/^M[^A]*/, '')}L${pt(polar(...P, R + 0.4, -58))}${arc(...P, R + 0.4, -58, -78).d.replace(/^M[^A]*/, '')}Z`;
  // The needle leans at rest, left of the red end, and stops 3 short of the scale (touching the arc
  // it made a hammer, crossing the red band a pickaxe; upright, a T)
  const nd = [Math.cos((-110 * Math.PI) / 180), Math.sin((-110 * Math.PI) / 180)];
  const start = add2(P, mul(nd, (P[1] - 19) / -nd[1]));
  add('vu-meter', ['vúmetro', 'nivel de audio', 'grabación', 'analógico', 'vu meter', 'audio level', 'analog'], [sq(2.5, 5, 19, 14, 3.5, BR), arc(...P, R, -122, -78).d, red, line(start, polar(...P, R - 3, -110))]);
  FILL['vu-meter'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['vu-meter'] = { window: [0], scale: [1, 2], needle: [3] };
  MOTION['vu-meter'] = { effect: 'wiggle', parts: ['needle'], origin: P };
}
// Level meters: two bars of stacked segments (bars of ink), one higher than the other, each with its
// peak tick above it.
{
  const seg = (x, y) => bar([x - 2, y], [x + 2, y], 0.45);
  add('level-meter', ['medidor de nivel', 'nivel de micrófono', 'volumen de entrada', 'grabar', 'level meter', 'input level', 'peak meter'], [...[20, 16.5, 13, 9.5].map((y) => seg(7.5, y)), seg(7.5, 4), ...[20, 16.5].map((y) => seg(16.5, y)), seg(16.5, 10.5)]);
  FILL['level-meter'] = false;
  PARTS['level-meter'] = { left: [0, 1, 2, 3], 'left-peak': [4], right: [5, 6], 'right-peak': [7] };
  MOTION['level-meter'] = { effect: 'beat', origin: [12, 20] };
}

// ── Players and retro audio ───────────────────────────────────────────────────────────────────
// Boombox: a wide box with its handle, a speaker at each end and the cassette slot between them.
{
  add('boombox', ['radiograbadora', 'grabadora', 'hip hop', 'fiesta', 'boombox', 'ghetto blaster', 'retro'], [sq(2, 7.5, 20, 13, 3, BR), rl([[8, 7.5], [8, 4.5], [16, 4.5], [16, 7.5]], [0, 1.25, 1.25, 0]), circ(7.25, 15, 2.5), circ(16.75, 15, 2.5), hl(10.5, 10.75, 13.25)]);
  FILL.boombox = { solid: [0], wire: [1], cut: [2, 3, 4] };
  PARTS.boombox = { body: [0], handle: [1], speakers: [2, 3], slot: [4] };
  MOTION.boombox = { effect: 'beat', parts: ['speakers'], origin: [12, 15] };
}
// Jukebox: a tall cabinet with an arched top, the window showing a record's edge and the grille below.
{
  const body = 'M4.75 10A7.25 7.25 0 0 1 19.25 10V21.25H6.75A2 2 0 0 1 4.75 19.25Z';
  add('jukebox', ['rocola', 'sinfonola', 'pedir canción', 'cola de canciones', 'jukebox', 'song request', 'diner'], [body, hl(12.5, 4.75, 19.25), 'M8.75 12.5A3.25 3.25 0 0 1 15.25 12.5', ...[9, 12, 15].map((x) => vl(x, 15.5, 18.25))]);
  FILL.jukebox = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS.jukebox = { cabinet: [0], window: [1, 2], grille: [3, 4, 5] };
}
// Gramophone: the box, the record plate on it and the large horn (the brass's bell) rising from the
// record to the upper right.
{
  add('gramophone', ['gramófono', 'fonógrafo', 'música antigua', 'discos', 'gramophone', 'phonograph', 'vintage music'], [sq(3.5, 15.5, 12, 5.75, 1.5, BR), hl(12.5, 3.25, 15.75), bell([9.5, 12.5], [0.75, -1], 9.5, 0, 3.75)]);
  FILL.gramophone = { solid: [0, 2], wire: [1] };
  PARTS.gramophone = { box: [0], plate: [1], horn: [2] };
}
// Portable cassette player: dispositivos' cassette (its label line and its two reels low, the layout
// that keeps it from being a face) as the player's door, moved down, and the player's keys along its
// top edge, at the left. (Reels across the middle of a portrait player, under keys like antennas,
// read as a robot.)
{
  const C = dispositivos.icons.cassette.d.map((d) => move(d, 0, 1.75));
  add('cassette-player', ['walkman', 'reproductor de casete', 'mixtape', 'retro', 'cassette player', 'walkman', 'mixtape'], [...C, ...[6.5, 9.5].map((x) => vl(x, 4.5, 6.75))]);
  FILL['cassette-player'] = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
  PARTS['cassette-player'] = { body: [0], window: [1, 2, 3], buttons: [4, 5] };
}
// Vintage radio: a cathedral case, its grille of vertical slots in the arch, and the base band below
// it with its two knobs.
{
  const [cy, r] = [12.5, 8];
  const top = (x) => cy - Math.sqrt(r * r - (x - 12) ** 2) + 3;
  add('radio-retro', ['radio antigua', 'radio retro', 'nostalgia', 'emisora', 'vintage radio', 'retro radio', 'oldies'], [`M4 ${cy}A${r} ${r} 0 0 1 20 ${cy}V20.5H6A2 2 0 0 1 4 18.5Z`, ...[9, 12, 15].map((x) => vl(x, top(x) + (x === 12 ? 0 : 0.35), 12.25)), hl(15.25, 4, 20), dot(8.5, 17.9, 0.3), dot(15.5, 17.9, 0.3)]);
  FILL['radio-retro'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['radio-retro'] = { case: [0], grille: [1, 2, 3], knobs: [4, 5, 6] };
}
// Music box: a small chest in profile, its lid standing open behind it, the wind-up key out of its
// side and the note it plays rising from it.
{
  const N = [dot(12.75, 8.75, 0.95), vl(13.7, 8.75, 3.25), 'M13.7 3.25C13.7 4.75 16.25 5 16.25 6.75'];
  add('music-box', ['caja de música', 'canción de cuna', 'música infantil', 'dormir', 'music box', 'lullaby', 'wind-up'], [sq(3.25, 12.75, 14, 8.5, 2, BR), bar([6.75, 12.75], [8.5, 4.25], 0.45), hl(17, 17.25, 20.25), bar([20.25, 14.5], [20.25, 19.5], 0.45), ...N]);
  FILL['music-box'] = { solid: [0, 1, 3, 4], wire: [2, 5, 6] };
  PARTS['music-box'] = { box: [0], lid: [1], key: [2, 3], note: [4, 5, 6] };
  MOTION['music-box'] = { effect: 'float', parts: ['note'], vector: [0, -1.5] };
}

// ── Notation ──────────────────────────────────────────────────────────────────────────────────
// The notes build on dispositivos' music-note: its head (an oval of 3.25 × 2.3 tilted 24°), its stem
// rising from the head's right side and its flag.
const NOTE = dispositivos.icons['music-note'].d;
/** A note's head, its rightmost point (where the stem starts) and its stem up to `top`. */
const noteAt = (cx, cy, top, rx = 3.25, ry = 2.3, deg = -24) => {
  const f0 = (deg * Math.PI) / 180;
  const t = Math.atan2(-ry * Math.sin(f0), rx * Math.cos(f0));
  const x = cx + rx * Math.cos(t) * Math.cos(f0) - ry * Math.sin(t) * Math.sin(f0);
  const y = cy + rx * Math.cos(t) * Math.sin(f0) + ry * Math.sin(t) * Math.cos(f0);
  return { head: ell(cx, cy, rx, ry, deg), stem: line([x, y], [x, top]), x, y };
};

// Treble clef: one stroke, from the spine around the spiral (no inner curl: one beside the spine left a
// hole that closed at regular), up into the top loop, down through the spiral and into the hook with
// its point.
{
  const P = [
    [12.3, 13], [14, 12.5], [15.35, 14.25], [13.9, 16.6], [10.6, 16.65], [8.35, 14.15], [8.9, 10.3], [12.1, 7.1], [14.5, 4.4],
    [13.4, 2.4], [11, 3.4], [10.8, 7.1], [12.3, 13], [13.25, 18.25], [12.6, 20.75], [10.75, 21.1], [9.75, 19.75],
  ];
  const clef = smooth(P, false, 1 / 5);
  add('treble-clef', ['clave de sol', 'partitura', 'notación', 'teoría musical', 'treble clef', 'g clef', 'notation'], [clef, dot(9.75, 19.75)]);
  FILL['treble-clef'] = false;
  PARTS['treble-clef'] = { clef: [0, 1] };
}
// Bass clef: the curl, a reversed C hanging from the dot at its head, and its two dots to the right.
{
  const curl = 'M6.25 9.25C6.25 6.5 8.25 5 10.75 5C13.75 5 15.5 7 15.5 9.75C15.5 14.5 11.25 18 6 19.75';
  add('bass-clef', ['clave de fa', 'partitura', 'notación', 'graves', 'bass clef', 'f clef', 'notation'], [curl, dot(7.25, 9.4, 0.95), dot(18.75, 7.75), dot(18.75, 12.25)]);
  FILL['bass-clef'] = false;
  PARTS['bass-clef'] = { clef: [0, 1], dots: [2, 3] };
}
// Sharp: two upright stems crossed by two bars rising to the right (bars of ink, as they are
// engraved: heavier than the stems, which tells it from the hash).
{
  add('sharp-sign', ['sostenido', 'alteración', 'notación', 'tonalidad', 'sharp', 'accidental', 'notation'], [vl(9.5, 4.25, 20.75), vl(14.5, 3.25, 19.75), bar([6.25, 10.25], [17.75, 8.25], 0.45), bar([6.25, 15.75], [17.75, 13.75], 0.45)]);
  FILL['sharp-sign'] = false;
  PARTS['sharp-sign'] = { stems: [0, 1], bars: [2, 3] };
  icons['sharp-sign'].variants = { slash: false };
}
// Flat: a tall stem and, at its foot, the rounded half heart that comes to a point at the bottom.
{
  const bowl = 'M8.75 12.75C10.75 10.75 15.75 10.25 15.75 13.75C15.75 16.5 12 18.75 8.75 20.75';
  add('flat-sign', ['bemol', 'alteración', 'notación', 'tonalidad', 'flat', 'accidental', 'notation'], [vl(8.75, 3, 20.75), bowl]);
  FILL['flat-sign'] = false;
  PARTS['flat-sign'] = { flat: [0, 1] };
  icons['flat-sign'].variants = { slash: false };
}
// Quarter rest: the narrow zigzag (its middle stroke a bar of ink, heavier as it is engraved) and the
// small curl at its foot.
{
  const zig = rl([[10.25, 2.75], [14, 7.5], [10.5, 11.75], [14.25, 16.25]], [0, 0.75, 0.75, 0]);
  const curl = 'M14.25 16.25C12 15 9.5 16.25 10.5 18.5C11 19.5 11.75 20.25 12.5 21';
  add('quarter-rest', ['silencio de negra', 'silencio', 'ritmo', 'notación', 'quarter rest', 'rest', 'rhythm'], [zig, bar([13.5, 8.15], [11.25, 10.85], 0.45), curl]);
  FILL['quarter-rest'] = false;
  PARTS['quarter-rest'] = { rest: [0, 1, 2] };
}
// Whole note: the head alone, wider and less tilted, solid around its counter turned steeply inside
// it, as it is engraved: rings stepping from the head to the counter, under 0.75 apart, make it ink at
// every weight (as the quarter note's head). Filled, the counter is the hole. (A hollow head with a
// small counter inside it, two rings with paper between, read as an eye.)
{
  const [O, K] = [[6.75, 4.5, -10], [4.25, 2.85, -50]];
  const at = (t) => O.map((v, i) => v + (K[i] - v) * t);
  const rings = Array.from({ length: 7 }, (_, i) => ell(12, 12, ...at(i / 6)));
  add('music-note-whole', ['redonda', 'nota entera', 'duración', 'notación', 'whole note', 'semibreve', 'note value'], rings);
  FILL['music-note-whole'] = { solid: [`${rings[0]}${ell(12, 12, ...K, true)}`] };
  PARTS['music-note-whole'] = { head: [0, 1, 2, 3, 4, 5, 6] };
  MOTION['music-note-whole'] = { effect: 'float', vector: [0, -1.5] };
}
// Half note: music-note's hollow head and stem, without the flag (centered).
{
  const d = NOTE.slice(0, 2).map((p) => move(p, 3, 0));
  add('music-note-half', ['blanca', 'media nota', 'duración', 'notación', 'half note', 'minim', 'note value'], d);
  FILL['music-note-half'] = false;
  PARTS['music-note-half'] = { head: [0], stem: [1] };
  MOTION['music-note-half'] = { effect: 'float', vector: [0, -1.5] };
}
// Quarter note: the same head and stem, the head made solid by rings nested inside it, 0.75 apart
// (closer than the lightest stroke), so it is ink at every weight.
{
  const [cx, cy, rx, ry, deg] = [9, 17.75, 3.25, 2.3, -24];
  const rings = [0.75, 1.5, 2.2].map((k) => ell(cx, cy, rx - k, Math.max(0.1, ry - k), deg));
  const d = [NOTE[0], ...rings, NOTE[1]].map((p) => move(p, 3, 0));
  add('music-note-quarter', ['negra', 'cuarto de nota', 'pulso', 'ritmo', 'quarter note', 'crotchet', 'beat'], d);
  FILL['music-note-quarter'] = { solid: [0], wire: [4] };
  PARTS['music-note-quarter'] = { head: [0, 1, 2, 3], stem: [4] };
  MOTION['music-note-quarter'] = { effect: 'float', vector: [0, -1.5] };
}
// Sixteenth note: music-note's head and stem with two flags stacked on it (two of music-note's long
// flags can't stack 3 apart: each a shorter hook, 4 apart).
{
  const x = 12.11;
  const flag = (y0) => `M${f(x)} ${y0}C${f(x + 0.5)} ${y0 + 2.25} ${f(x + 3)} ${y0 + 2.5} ${f(x + 4.75)} ${y0 + 4.75}`;
  const d = [NOTE[0], NOTE[1], flag(3), flag(7)].map((p) => move(p, 0.75, 0));
  add('music-note-sixteenth', ['semicorchea', 'dieciseisavo', 'ritmo rápido', 'notación', 'sixteenth note', 'semiquaver', 'note value'], d);
  FILL['music-note-sixteenth'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['music-note-sixteenth'] = { head: [0], stem: [1], flags: [2, 3] };
  MOTION['music-note-sixteenth'] = { effect: 'float', vector: [0, -1.5] };
}
// Staff: five lines closed by a barline at each end and a whole note on the middle line, in front
// of it: the engine clears the middle line around it (the note fills one space, so the lines above
// and below it stand clear).
{
  const Y = [4, 8, 12, 16, 20];
  const head = ell(12, 12, 3.25, 1.5, -10);
  const axis = knockLine(ellAt(12, 12, 3.25, 1.5, -10, 180), ellAt(12, 12, 3.25, 1.5, -10, 0));
  add('music-staff', ['pentagrama', 'partitura', 'notación', 'escribir música', 'music staff', 'stave', 'score'], [...Y.map((y) => hl(y, 4.5, 19.5)), vl(4.5, 4, 20), vl(19.5, 4, 20)], {
    badge: { d: [head], knock: axis, fill: { solid: [head] } },
  });
  FILL['music-staff'] = false;
  PARTS['music-staff'] = { staff: [0, 1, 2, 3, 4, 5, 6] };
}
// Sheet music: nucleo's page with a beamed pair of notes (the beam a bar of ink) and two ruled lines
// under them.
const DOC = nucleo.icons.document.d[0];
// The heads are solid (ovals so thin they are ink at every weight): hollow ones had no room on the
// page to stand 3 clear of its edge and of each other's stem, and dots near the badge were dropped.
const beamed = () => {
  const a = noteAt(8.25, 10.75, 6.75, 1.2, 0.45);
  const b = noteAt(12.75, 9.25, 5.75, 1.2, 0.45);
  return [a.head, b.head, line([a.x, a.y], [a.x, 6.75]), line([b.x, b.y], [b.x, 5.75]), bar([a.x, 6.75], [b.x, 5.75], 0.45)];
};
{
  add('sheet-music', ['partitura', 'cancionero', 'particella', 'leer música', 'sheet music', 'score', 'songbook'], [DOC, ...beamed(), hl(15.25, 8.75, 15.25), hl(18.25, 8.75, 12.5)]);
  FILL['sheet-music'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS['sheet-music'] = { page: [0], notes: [1, 2, 3, 4, 5], lines: [6, 7] };
  // With the download badge: the ruled lines the badge would clear are left out
  add('sheet-music-arrow-down', ['descargar partitura', 'partitura sin conexión', 'tienda de partituras', 'bajar', 'download sheet music', 'offline score', 'download'], [DOC, ...beamed()], { badge: badge('arrow-down') });
  FILL['sheet-music-arrow-down'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['sheet-music-arrow-down'] = { page: [0], notes: [1, 2, 3, 4, 5] };
  MOTION['sheet-music-arrow-down'] = BADGE_MOTION['arrow-down'];
}
// Chord diagram: four strings and three frets under the heavier nut (a bar of ink), three fingers.
{
  const X = [7.25, 10.5, 13.75, 17];
  const F = [3.25, 9, 14.75, 20.5];
  add('chord-diagram', ['diagrama de acorde', 'acordes', 'guitarra', 'ukulele', 'chord diagram', 'chord chart', 'fingering'], [bar([X[0], F[0]], [X[3], F[0]], 0.45), ...X.map((x) => vl(x, F[0], F[3])), ...F.slice(1).map((y) => hl(y, X[0], X[3])), dot(X[2], 6.2, 0.6), dot(X[0], 11.875, 0.6), dot(X[3], 11.875, 0.6)]);
  FILL['chord-diagram'] = false;
  PARTS['chord-diagram'] = { grid: [0, 1, 2, 3, 4, 5, 6, 7], fingers: [8, 9, 10] };
}
// Transpose: music-note, moved right, with an up-and-down arrow beside its stem.
{
  const d = NOTE.map((p) => move(p, 2.5, 0));
  add('transpose', ['transponer', 'cambiar tono', 'subir tono', 'bajar tono', 'transpose', 'change key', 'pitch shift'], [...d, vl(5.5, 3.75, 13.75), head([5.5, 3.75], [0, -1], 2.5), head([5.5, 13.75], [0, 1], 2.5)]);
  FILL.transpose = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.transpose = { note: [0, 1, 2], arrow: [3, 4, 5] };
  MOTION.transpose = { effect: 'bounce', parts: ['arrow'], vector: [0, -1.5] };
}

// ── Practice ──────────────────────────────────────────────────────────────────────────────────
// Metronome: a rounded pyramid, the pendulum swinging from the line of its base and its sliding
// weight, a bead on the rod. (A pivot dot under the bead read as the alert sign.)
{
  const piv = [12, 17.75];
  const tip = [13.25, 9.25];
  const w = lerp(piv, tip, 0.68);
  add('metronome', ['metrónomo', 'tempo', 'bpm', 'práctica', 'metronome', 'tempo', 'click track'], [roundpoly([[9.25, 2.75], [14.75, 2.75], [19.25, 21.25], [4.75, 21.25]], [1.25, 1.25, 1.5, 1.5]), hl(17.75, 4.75 + (3.5 * 4.5) / 18.5 - 0.1, 19.25 - (3.5 * 4.5) / 18.5 + 0.1), line(piv, tip), dot(...w, 0.95)]);
  FILL.metronome = { solid: [0], cut: [1, 2, 3] };
  PARTS.metronome = { case: [0, 1], pendulum: [2, 3] };
  MOTION.metronome = { effect: 'wiggle', parts: ['pendulum'], origin: piv };
}
// Tuning fork: two long tines in a U on a short stem, a small vibration arc beside each tine.
{
  add('tuning-fork', ['diapasón', 'afinar', 'tono de referencia', 'sonoterapia', 'tuning fork', 'pitch', 'tuning'], ['M10.5 3V13.25A1.5 1.5 0 0 0 13.5 13.25V3', vl(12, 14.75, 21.25), arc(12, 6.75, 5.5, 155, 205).d, arc(12, 6.75, 5.5, -25, 25).d]);
  FILL['tuning-fork'] = false;
  PARTS['tuning-fork'] = { fork: [0, 1], wave: [2, 3] };
  MOTION['tuning-fork'] = { effect: 'beat', parts: ['wave'], origin: [12, 6.5] };
}
// Music stand: the tilted desk with its ledge, on a thin pole over the stands' tripod.
{
  const desk = rl([[4.5, 11.5], [5.75, 3.25], [18.25, 3.25], [19.5, 11.5]], [0, 1.25, 1.25, 0]);
  add('music-stand', ['atril', 'práctica', 'ensayo', 'partitura', 'music stand', 'rehearsal', 'sheet music'], [desk, hl(11.5, 3, 21), vl(12, 11.5, 21.25), tripod(12, 17.75, 21.25, 4.5)]);
  FILL['music-stand'] = { solid: [shut(desk)], wire: [1, 2, 3] };
  PARTS['music-stand'] = { desk: [0, 1], stand: [2, 3] };
}

// ── Production ────────────────────────────────────────────────────────────────────────────────
// Tracks: three lanes, each a short waveform (dispositivos' audio-waveform bars, 3 apart) at its own
// offset in the timeline. (Clips holding a zigzag that touched their edges read as three envelopes.)
{
  const lane = (y, xs, hs) => xs.map((x, i) => vl(x, y - hs[i], y + hs[i]));
  add('multitrack', ['pistas', 'multipista', 'sesión', 'arreglo', 'multitrack', 'tracks', 'stems'], [...lane(5, [3.5, 6.5, 9.5, 12.5], [1, 2, 1.5, 1]), ...lane(12, [9.5, 12.5, 15.5, 18.5], [1.25, 2.25, 1, 1.75]), ...lane(19, [5, 8, 11, 14], [1.5, 1, 2.25, 1])]);
  FILL.multitrack = false;
  PARTS.multitrack = { lanes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] };
}
// Piano roll: the strip of keys on the left (its black keys bars of ink, hanging from its left edge as
// piano-keys' hang from the top: started on the edge, their round ends stuck out of it) and three
// notes (bars of ink, as MIDI notes are solid) at different heights.
{
  add('piano-roll', ['piano roll', 'editor midi', 'secuenciar', 'notas midi', 'piano roll', 'midi editor', 'sequencer'], [sq(3.25, 3.25, 6, 17.5, 2), ...[7.5, 12, 16.5].map((y) => bar([3.7, y], [6.5, y], 0.45)), bar([12.5, 5.75], [17, 5.75], 0.45), bar([15, 10.25], [20.75, 10.25], 0.45), bar([12.5, 16.5], [16, 16.5], 0.45)]);
  FILL['piano-roll'] = { solid: [0, 4, 5, 6], cut: [7.5, 12, 16.5].map((y) => hl(y, 1.75, 6.95)) };
  PARTS['piano-roll'] = { keys: [0, 1, 2, 3], notes: [4, 5, 6] };
}
// Loop: a circular arrow closing on itself, three waveform bars inside it.
{
  const a = arc(12, 12, 8, -55, 250);
  add('audio-loop', ['bucle', 'loop', 'repetir región', 'loops de audio', 'audio loop', 'loop', 'repeat region'], [a.d, head(a.end, a.tangent, 3.4), vl(9, 10.25, 13.75), vl(12, 8.5, 15.5), vl(15, 10.25, 13.75)]);
  FILL['audio-loop'] = false;
  PARTS['audio-loop'] = { arrow: [0, 1], wave: [2, 3, 4] };
  MOTION['audio-loop'] = { effect: 'spin', parts: ['arrow'], origin: [12, 12] };
  icons['audio-loop'].variants = { circle: false, slash: false };
}
// Stem separation: one waveform on the left branching into three parallel lines to the right.
{
  add('stem-separation', ['separar pistas', 'stems', 'aislar voz', 'separación', 'stem separation', 'split stems', 'isolate vocals'], [vl(3.5, 10, 14), vl(6.5, 8, 16), vl(9.5, 9.5, 14.5), 'M9.5 12C12.5 12 13.5 5.5 16.5 5.5H21', hl(12, 9.5, 21), 'M9.5 12C12.5 12 13.5 18.5 16.5 18.5H21']);
  FILL['stem-separation'] = false;
  PARTS['stem-separation'] = { wave: [0, 1, 2], stems: [3, 4, 5] };
  MOTION['stem-separation'] = { effect: 'slide', parts: ['stems'], vector: [1.5, 0] };
}
// Parametric EQ: a level line with a bell-shaped boost and a shallow cut, the handle on the boost.
{
  add('eq-curve', ['ecualizador paramétrico', 'curva de ecualización', 'filtro', 'frecuencias', 'eq curve', 'parametric eq', 'filter'], ['M2.75 14.5H4C6.5 14.5 6.75 6.25 9 6.25S11.5 14.5 14 14.5C15.5 14.5 15.75 17.25 17 17.25S18.5 14.5 20 14.5H21.25', dot(9, 6.25)]);
  FILL['eq-curve'] = false;
  PARTS['eq-curve'] = { curve: [0], handle: [1] };
}
// ADSR envelope: the attack rising steeply, the decay down to the sustain plateau and the release
// to the baseline, a node at each corner.
{
  const P = [[3, 20], [7.5, 4.5], [11.75, 11.5], [16.25, 11.5], [21, 20]];
  add('synth-envelope', ['envolvente', 'adsr', 'ataque', 'sintetizador', 'adsr envelope', 'synth envelope', 'attack'], [line(...P), dot(...P[1]), dot(...P[2]), dot(...P[3])]);
  FILL['synth-envelope'] = false;
  PARTS['synth-envelope'] = { envelope: [0], nodes: [1, 2, 3] };
}
// Step sequencer: two rows of four steps, the ones that play solid (a square, a square 0.45 inside
// it and a dot: ink at every weight), and the playhead over the third column, above and below it.
// The steps are 2.75 across (at 2.5 the hole of a step that rests nearly closed at bold, and the rows
// went grey).
{
  const s = 2.75;
  const [x0, y0, pitch] = [2.25, 7.9, 5.6];
  const on = [[1, 0, 1, 0], [0, 1, 1, 0]];
  const d = [];
  const live = [];
  on.forEach((row, j) => row.forEach((v, i) => {
    const [x, y] = [x0 + i * pitch, y0 + j * pitch];
    d.push(sq(x, y, s, s, 0.6));
    if (v) live.push(sq(x + 0.45, y + 0.45, s - 0.9, s - 0.9, 0.35), dot(x + s / 2, y + s / 2, 0.3));
  }));
  const px = x0 + 2 * pitch + s / 2;
  add('step-sequencer', ['secuenciador', 'patrón de batería', 'pasos', 'beats', 'step sequencer', 'drum pattern', 'beat grid'], [...d, ...live, vl(px, 2.75, y0 - 2.85), vl(px, y0 + pitch + s + 2.85, 21.25)]);
  FILL['step-sequencer'] = false;
  PARTS['step-sequencer'] = { steps: [0, 1, 2, 3, 4, 5, 6, 7], on: [8, 9, 10, 11, 12, 13, 14, 15], playhead: [16, 17] };
}
// Crossfade: two lines crossing over a baseline, each from a short level run: one fades out as the
// other fades in.
{
  add('crossfade', ['fundido cruzado', 'transición', 'mezcla', 'dj', 'crossfade', 'transition', 'blend'], [rl([[2.75, 6], [6.5, 6], [17.5, 18]], [0, 0.75, 0]), rl([[21.25, 6], [17.5, 6], [6.5, 18]], [0, 0.75, 0]), hl(18, 2.75, 21.25)]);
  FILL.crossfade = false;
  PARTS.crossfade = { out: [0], in: [1], base: [2] };
}
// Fade in: waveform bars growing taller from left to right under the rising fade line, 3 clear of it.
const fadeIn = [line([3, 10.43], [21, 3.23]), ...[6, 9, 12, 15, 18].map((x) => {
  const h = 0.4 * (x - 3);
  return vl(x, 13.5 - h, 13.5 + h);
})];
{
  add('audio-fade-in', ['fundido de entrada', 'subir volumen', 'editar audio', 'clip', 'fade in', 'audio fade', 'volume ramp'], fadeIn);
  FILL['audio-fade-in'] = false;
  PARTS['audio-fade-in'] = { fade: [0], wave: [1, 2, 3, 4, 5] };
  add('audio-fade-out', ['fundido de salida', 'bajar volumen', 'editar audio', 'clip', 'fade out', 'audio fade', 'volume ramp'], fadeIn.map((d) => flipPath(d)));
  FILL['audio-fade-out'] = false;
  PARTS['audio-fade-out'] = { fade: [0], wave: [1, 2, 3, 4, 5] };
}

// ── Library ───────────────────────────────────────────────────────────────────────────────────
// The album and its note, from dispositivos.
const ALBUM = dispositivos.icons.album.d;
// Music library: album's cover (at 0.7) in front and two backs behind it, up and to the right, 3
// apart: the first showing its top and right edges, the last only its corner.
{
  const s = 0.7;
  const z = 17.5 * s;
  const front = ALBUM.map((d) => place(d, s, [3.25, 3.25], [3.5, 20.75 - z]));
  const back = (o) => rl([[3.5 + o, 20.75 - z], [3.5 + o, 20.75 - z - o], [3.5 + z + o, 20.75 - z - o], [3.5 + z + o, 20.75 - o], [3.5 + z, 20.75 - o]], [0, 2.7, 2.7, 0, 0]);
  const far = rl([[3.5 + z + 6 - 5, 20.75 - z - 6], [3.5 + z + 6, 20.75 - z - 6], [3.5 + z + 6, 20.75 - z - 6 + 5]], [0, 2.7, 0]);
  add('album-stack', ['biblioteca musical', 'álbumes', 'discografía', 'colección', 'music library', 'albums', 'discography'], [...front, back(3), far]);
  FILL['album-stack'] = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
  PARTS['album-stack'] = { album: [0, 1, 2, 3], backs: [4, 5] };
}
// Save an album: album with the plus badge; the note, at 0.8, sits up and to the left, clear of it.
{
  const note = ALBUM.slice(1).map((d) => transform(d, 0.8, -2.5 + 10.75 * 0.2, -1.5 + 11.25 * 0.2));
  add('album-plus', ['guardar álbum', 'agregar a biblioteca', 'añadir álbum', 'colección', 'save album', 'add to library', 'add album'], [ALBUM[0], ...note], { badge: badge('plus') });
  FILL['album-plus'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['album-plus'] = { cover: [0], note: [1, 2, 3] };
  MOTION['album-plus'] = BADGE_MOTION.plus;
}
// Lyrics: an opening quote at the top left (each mark a point and its tail; edicion's hollow marks at
// half size closed up at bold) and music-note to its right.
{
  const mark = (x) => [dot(x, 7.5, 0.95), `M${f(x)} 7.5C${f(x)} 5.75 ${f(x + 0.75)} 4.25 ${f(x + 2)} 3.25`];
  const Q = [...mark(4), ...mark(8.5)];
  const n = NOTE.map((d) => move(d, 4, 0.75));
  add('lyrics', ['letra', 'letras de canciones', 'karaoke', 'cantar', 'lyrics', 'sing along', 'karaoke'], [...Q, ...n]);
  FILL.lyrics = { solid: [0, 2, 4], wire: [1, 3, 5, 6] };
  PARTS.lyrics = { quote: [0, 1, 2, 3], note: [4, 5, 6] };
}
// Spatial audio: anatomia's head in profile (at 0.55) with an arc around its front and one around
// its back.
{
  const HEAD = anatomia.icons['head-side'].d[0];
  const h = place(HEAD, 0.55, [12.25, 12], [12, 12.5]);
  add('spatial-audio', ['audio espacial', 'sonido envolvente', '3d', 'inmersivo', 'spatial audio', 'surround sound', 'immersive'], [h, arc(12, 12, 9, -50, 50).d, arc(12, 12, 9, 130, 230).d]);
  FILL['spatial-audio'] = { solid: [shut(h)], lines: [1, 2] };
  PARTS['spatial-audio'] = { head: [0], wave: [1, 2] };
  MOTION['spatial-audio'] = { effect: 'beat', parts: ['wave'], origin: [12, 12] };
  icons['spatial-audio'].mirror = true;
}
// Add, like and search a song: music-note, moved up and left clear of the engine's badge.
const NOTE_B = NOTE.map((d) => move(d, -2.5, -1));
for (const [name, kind, tags] of [
  ['music-note-plus', 'plus', ['agregar canción', 'añadir música', 'nueva canción', 'biblioteca', 'add song', 'add music', 'add track']],
  ['music-note-heart', 'heart', ['canciones que me gustan', 'favorita', 'me gusta', 'guardar', 'liked songs', 'favorite song', 'love track']],
  ['music-note-search', 'search', ['buscar música', 'identificar canción', 'qué suena', 'buscar', 'search music', 'identify song', 'find song']],
]) {
  add(name, tags, NOTE_B, { badge: badge(kind) });
  FILL[name] = { solid: [0], wire: [1, 2] };
  PARTS[name] = { head: [0], stem: [1], flag: [2] };
  MOTION[name] = BADGE_MOTION[kind];
}
// The playlist with a badge: playlist's lines on the left (four, as playlist-play has, all one length:
// 3 clear of the note and of the badge's clearance) and its note (its head, stem and short flag) moved
// up to the top right, so the badge takes the corner.
{
  const n = noteAt(14.5, 8, 2.75, 2.75, 1.95);
  const base = [...[5.5, 10, 14.5, 19].map((y) => hl(y, 3.5, 9)), n.head, n.stem, line([n.x, 2.75], [n.x + 3, 4])];
  for (const [name, kind, tags] of [
    ['playlist-plus', 'plus', ['agregar a lista', 'crear lista', 'nueva lista', 'canciones', 'add to playlist', 'new playlist', 'create playlist']],
    ['playlist-check', 'check', ['agregada a la lista', 'en la lista', 'guardada', 'canciones', 'added to playlist', 'in playlist', 'saved']],
    ['playlist-arrow-down', 'arrow-down', ['descargar lista', 'sin conexión', 'escuchar offline', 'bajar', 'download playlist', 'offline', 'download']],
  ]) {
    add(name, tags, base, { badge: badge(kind) });
    FILL[name] = { solid: [4], lines: [0, 1, 2, 3], wire: [5, 6] };
    PARTS[name] = { list: [0, 1, 2, 3], note: [4, 5, 6] };
    MOTION[name] = BADGE_MOTION[kind];
    icons[name].mirror = true;
  }
}

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// Where the engine's snap left a smudge, the icon keeps fewer pieces at 16 px: the details that ran
// together (the sound holes and bridges, the pickups, the f-holes, the tension cords, the key dots,
// the inner coils, the markers) are left out and the rest is snapped to the pixel grid as the engine
// snaps any drawing.
{
  /** A 16 px drawing from some of the icon's own strokes (indices into d, or paths), snapped. */
  const small = (name, keep, fill, badge16) => {
    const icon = icons[name];
    const get = (i) => (typeof i === 'number' ? icon.d[i] : i);
    const d = keep.map(get);
    const sn = snapper([...d, ...Object.values(fill || {}).flat().map(get), ...(badge16 ? [...badge16.d, badge16.knock] : [])]);
    icon.small = { d: d.map(sn) };
    if (fill) icon.small.fill = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map((i) => sn(get(i)))]));
    if (badge16) icon.small.badge = { d: badge16.d.map(sn), knock: sn(badge16.knock), ...(badge16.fill && { fill: Object.fromEntries(Object.entries(badge16.fill).map(([k, v]) => [k, v.map(sn)])) }) };
  };
  const d = (name) => icons[name].d;
  small('guitar', [0, 3, 4], { solid: [0, 4], wire: [3] });
  small('guitar-electric', [0, 3, 4], { solid: [0, 4], wire: [3] });
  small('banjo', [0, 2, 3, 4], { solid: [0, 4], cut: [2], wire: [3] });
  small('violin', [0], false, icons.violin.badge);
  small('cello', [0, 1, 2, 3, 5], { solid: [0, 3], cut: [1], wire: [2, 5] });
  small('drum', [0, 1, 3, 4], { solid: [0, shut(d('drum')[1])], wire: [3, 4] });
  // The xylophone's bars as lines: bars of ink fell between pixels
  small('xylophone', [...XYLO.map((x, i) => vl(x, 12 - XYLO_L[i] / 2, 12 + XYLO_L[i] / 2)), 4, 5, 6, 7], false);
  small('saxophone', [0, 1], { solid: [0], wire: [1] });
  small('clarinet', [0, 1], { solid: [0, 1] });
  small('flute', [0, 1], { solid: [0], cut: [1] });
  // The drum machine on the pixel grid: its pads as 2 × 2 pixel blocks, a pixel apart, and the screen
  {
    const dm = [sq(5.25, 3.75, 13.5, 16.5, 2.25, BR), hl(6.75, 8.25, 12.75), ...[12, 16.5].flatMap((y) => [9, 13.5].map((x) => dot(x, y, 0.75)))];
    icons['drum-machine'].small = { d: dm, fill: { solid: [dm[0]], cut: dm.slice(1) } };
  }
  small('subwoofer', [0, 1, 3], { solid: [0], cut: [1, 3] });
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

for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };

export default { category: 'musica', label: 'Música y audio', icons };
