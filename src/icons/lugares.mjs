// Time, places and nature: calendar, clock, maps, buildings, transportation, weather and nature.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5
// stroke, keylines, continuous corners and a square bottom-right corner on containers.
import { arc, badge, circ, dot, flipPath, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

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
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const BR = { square: ['br'] };

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

/** Capsule (stadium): a rectangle whose short ends are semicircles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w, y + r])}V${N(y + h - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${N(x + w - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w - r, y + h])}H${N(x + r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** Open arc (just the `d`). */
const arcd = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d;

/** Intersections of two circles [x, y, r]; returns both (or null). */
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
const angOf = ([cx, cy], [x, y]) => deg(Math.atan2(y - cy, x - cx));

// ── Paths as segments ─────────────────────────────────────────────────────────────────────────
// A path is read as segments (line, cubic, circular arc) to measure a stroke's clearance next to a
// cloud (`clearOf`). Anything that passes behind another piece is never trimmed by hand: the piece
// on top goes in as a badge and the engine does the clearing.
function arcSeg(a, b, r, fa, fs) {
  const dx = (a[0] - b[0]) / 2;
  const dy = (a[1] - b[1]) / 2;
  const d2 = dx * dx + dy * dy;
  const R = Math.max(r, Math.sqrt(d2));
  const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (R * R - d2) / d2));
  const c = [k * dy + (a[0] + b[0]) / 2, -k * dx + (a[1] + b[1]) / 2];
  const t0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let dt = Math.atan2(b[1] - c[1], b[0] - c[0]) - t0;
  if (fs && dt < 1e-9) dt += 2 * Math.PI;
  if (!fs && dt > -1e-9) dt -= 2 * Math.PI;
  return { k: 'A', a, b, c, r: R, t0, dt };
}

function parse(d) {
  const toks = d.match(/[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)/g).map((t) => (/[a-z]/i.test(t) ? t : +t));
  const subs = [];
  let cur;
  let p = [0, 0];
  let cmd;
  let i = 0;
  const n = () => toks[i++];
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++];
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const o = rel ? p : [0, 0];
    if (C === 'M') {
      p = [o[0] + n(), o[1] + n()];
      cur = { segs: [], closed: false, start: p };
      subs.push(cur);
    } else if (C === 'Z') {
      if (len(sub(p, cur.start)) > 1e-6) cur.segs.push({ k: 'L', a: p, b: cur.start });
      cur.closed = true;
      p = cur.start;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      const q = C === 'L' ? [o[0] + n(), o[1] + n()] : C === 'H' ? [o[0] + n(), p[1]] : [p[0], o[1] + n()];
      cur.segs.push({ k: 'L', a: p, b: q });
      p = q;
    } else if (C === 'C') {
      const c1 = [o[0] + n(), o[1] + n()];
      const c2 = [o[0] + n(), o[1] + n()];
      const q = [o[0] + n(), o[1] + n()];
      cur.segs.push({ k: 'C', a: p, c1, c2, b: q });
      p = q;
    } else if (C === 'A') {
      const r = n();
      n();
      n();
      const fa = n();
      const fs = n();
      const q = [o[0] + n(), o[1] + n()];
      if (len(sub(q, p)) > 1e-6) cur.segs.push(arcSeg(p, q, r, fa, fs));
      p = q;
    }
  }
  return subs;
}

function at(s, t) {
  if (s.k === 'L') return lerp(s.a, s.b, t);
  if (s.k === 'A') {
    const th = s.t0 + s.dt * t;
    return [s.c[0] + s.r * Math.cos(th), s.c[1] + s.r * Math.sin(th)];
  }
  const m = 1 - t;
  return [0, 1].map((j) => m * m * m * s.a[j] + 3 * m * m * t * s.c1[j] + 3 * m * t * t * s.c2[j] + t * t * t * s.b[j]);
}

/**
 * An open outline that gets filled (the U of a tire, the house's roof, the sun's half disc): each
 * run is closed along its chord. `fill.solid` only takes closed shapes.
 */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

// Zones for measuring clearance next to a cloud.
const GAP = 3; // center to center: 1.5 of clearance between 1.5 strokes
const disc = (c, R) => (p) => len(sub(p, c)) < R;
function nearBox(x, y, w, h, D = GAP) {
  return (p) => {
    const dx = Math.max(x - p[0], 0, p[0] - x - w);
    const dy = Math.max(y - p[1], 0, p[1] - y - h);
    return Math.hypot(dx, dy) < D;
  };
}
/**
 * Drawn slash (the `-off` icons): the automatic slash's diagonal goes in as a custom badge and the
 * engine clears the base with 1.5 of clearance on each side. It's a line: with no `fill`, it's
 * drawn as a stroke in the filled version too.
 */
const SLASH = line([3.6, 3.6], [20.4, 20.4]);
const slashBadge = { d: [SLASH], knock: SLASH };

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
// `extra`: fields besides tags and d (e.g. the engine's badge: { badge: badge('plus') }).
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Calendar ──────────────────────────────────────────────────────────────────────────────────
// The core `calendar`: 18 × 16.25, radius 4, rings at 8 and 16, header at 9.75. The body (9.75–21)
// holds the glyph centered at y 15.375.
const CAL_Y = 15.375;
function calendar() {
  return [sq(3, 4.75, 18, 16.25, 4, BR), line([8, 2.9], [8, 6.5]), line([16, 2.9], [16, 6.5]), line([3, 9.75], [21, 9.75])];
}
const calGlyph = (g) => [...calendar(), ...g];

add('calendar-plus', ['agregar fecha', 'nuevo evento', 'calendario', 'add event'], calGlyph([line([9.25, CAL_Y], [14.75, CAL_Y]), line([12, CAL_Y - 2.75], [12, CAL_Y + 2.75])]));
add('calendar-minus', ['quitar fecha', 'calendario', 'cancelar evento', 'remove event', 'remove date'], calGlyph([line([9.25, CAL_Y], [14.75, CAL_Y])]));
add('calendar-check', ['fecha confirmada', 'asistiré', 'calendario', 'event confirmed'], calGlyph([line([8.9, CAL_Y + 0.1], [11, CAL_Y + 2.2], [15.1, CAL_Y - 1.9])]));
add('calendar-x', ['fecha cancelada', 'ocupado', 'calendario', 'event cancelled', 'busy'], calGlyph([line([9.9, CAL_Y - 2.1], [14.1, CAL_Y + 2.1]), line([14.1, CAL_Y - 2.1], [9.9, CAL_Y + 2.1])]));
// Range: the pill a date picker uses to mark several consecutive days.
add('calendar-range', ['rango de fechas', 'periodo', 'del al', 'vacaciones', 'date range', 'period'], calGlyph([capsule(8.5, CAL_Y - 1.5, 7, 3)]));
add('calendar-event', ['evento', 'cita', 'día marcado', 'event'], calGlyph([sq(12.25, 13.5, 5, 4.75, 1.5, BR)]));
add('calendar-day', ['día', 'hoy', 'fecha', 'today', 'day'], calGlyph([dot(12, CAL_Y)]));
// Badges: always the engine's, in `badge`; the engine clears the base with 1.5 of clearance.
add('calendar-clock', ['programado', 'fecha y hora', 'agenda', 'recordatorio', 'scheduled', 'reminder'], calendar(), { badge: badge('clock') });

// ── Hourglass, timer, stopwatch and alarm ───────────────────────────────────────────────────
{
  // The glass is a single outline: two straight bulbs narrowing to the neck, closed under the caps
  // (so it fills whole); the caps span the full width.
  const glass = roundpoly(
    [[7, 3.25], [17, 3.25], [17, 6.75], [13.1, 12], [17, 17.25], [17, 20.75], [7, 20.75], [7, 17.25], [10.9, 12], [7, 6.75]],
    [0, 0, 3, 1, 3, 0, 0, 3, 1, 3],
  );
  const caps = [line([5.25, 3.25], [18.75, 3.25]), line([5.25, 20.75], [18.75, 20.75])];
  add('hourglass', ['reloj de arena', 'espera', 'tiempo', 'hourglass', 'wait'], [glass, ...caps]);
  add('hourglass-end', ['tiempo agotado', 'reloj de arena', 'vencido', 'time up'], [glass, ...caps, `M9.25 20.75C9.75 18.5 10.75 17.75 12 17.75S14.25 18.5 14.75 20.75`]);
}
{
  // Timer: the ring is the time remaining; it starts at 12 o'clock with an end cap (the knob) and
  // empties backward. The hand marks the edge of what's left.
  const C = [12, 12];
  const ring = arc(...C, 9, -90, 210);
  add('timer', ['temporizador', 'cuenta regresiva', 'tiempo restante', 'timer', 'countdown'], [ring.d, dot(12, 3), line(C, polar(...C, 5.25, 210))]);
}
{
  const C = [12, 13.25];
  const r = 7.75;
  add('stopwatch', ['cronómetro', 'medir tiempo', 'vuelta', 'stopwatch'], [
    circ(...C, r),
    line([12, C[1] - r], [12, 2.75]),
    line([9.75, 2.75], [14.25, 2.75]),
    line(polar(...C, r, -45), polar(...C, r + 2.1, -45)),
    line(C, polar(...C, 4.25, -55)),
  ]);
}
const ALARM = [12, 13.25];
const ALARM_R = 7.25;
/**
 * Alarm clock bell: an arc of a circle (r 3.25, 8.5 from the center) that ends 1.5 clear of the
 * face (3 center to center). `lune` is the crescent that encloses that arc with the same clearance:
 * the bell's fill.
 */
function bell(a) {
  const B = polar(...ALARM, 8.5, a);
  const [p] = meet([...ALARM, ALARM_R + GAP], [...B, 3.25]);
  const half = Math.abs(((angOf(B, p) - a + 540) % 360) - 180);
  const outer = arc(...B, 3.25, a - half, a + half);
  const start = polar(...B, 3.25, a - half);
  return { d: outer.d, lune: `${outer.d}A${N(ALARM_R + GAP)} ${N(ALARM_R + GAP)} 0 0 0 ${pt(start)}Z` };
}
const BELLS = [bell(-135), bell(-45)];
const ALARM_LEGS = [130, 50].map((a) => line(polar(...ALARM, ALARM_R, a), polar(...ALARM, ALARM_R + 2.25, a)));
const ALARM_HANDS = line([12, 9.5], [12, 13.25], [14.75, 14.75]);
const alarm = (inner) => [circ(...ALARM, ALARM_R), ...BELLS.map((b) => b.d), ...ALARM_LEGS, ...inner];
add('alarm-clock', ['alarma', 'despertador', 'recordatorio', 'alarm', 'alarm clock', 'wake up'], alarm([ALARM_HANDS]));
add('alarm-plus', ['nueva alarma', 'agregar alarma', 'despertador', 'add alarm', 'new alarm'], alarm([line([12, 10.5], [12, 16]), line([9.25, 13.25], [14.75, 13.25])]));
add('alarm-check', ['alarma activa', 'alarma lista', 'despertador', 'alarm set', 'alarm on'], alarm([line([9, 13.4], [11.1, 15.5], [15.1, 11.5])]));
// Off: the slash (a badge) covers almost all of the left bell and the hands; they aren't drawn
// (they would leave fragments).
add('alarm-off', ['alarma apagada', 'sin alarma', 'silenciar alarma', 'alarm off', 'snooze'], [circ(...ALARM, ALARM_R), BELLS[1].d, ...ALARM_LEGS], { badge: slashBadge });

// ── Clock with arrow and badges ───────────────────────────────────────────────────────────────
{
  const a = arc(12, 12, 8.75, -40, 245);
  add('clock-forward', ['adelantar', 'más tarde', 'futuro', 'clock forward', 'later'], [a.d, head(a.end, a.tangent, 3.4), line([12, 7.75], [12, 12], [14.85, 13.75])]);
}
// The core clock with the hour hand at 10, away from the badge.
// With a badge the face loses its bottom right corner and its visual center moves up and left: the
// hands' pivot follows it (11.5, 11.5), which also keeps it clear of the badge's clearance
const clockBase = () => [circ(12, 12, 9), line([11.5, 6.35], [11.5, 11.5], [8.2, 9.45])];
add('clock-plus', ['agregar tiempo', 'nueva hora', 'tiempo extra', 'add time'], clockBase(), { badge: badge('plus') });
add('clock-check', ['a tiempo', 'hora confirmada', 'puntual', 'on time'], clockBase(), { badge: badge('check') });
// Time zone: the ring and meridian of the core `globe` (no equator: with the badge it clogged up)
// and the clock badge.
add('time-zone', ['zona horaria', 'hora mundial', 'huso', 'time zone', 'world clock'], [circ(12, 12, 9), 'M12 3c2.45 2.5 3.7 5.5 3.7 9s-1.25 6.5-3.7 9c-2.45-2.5-3.7-5.5-3.7-9s1.25-6.5 3.7-9Z'], { badge: badge('clock') });

// ── Sunrise and sunset ──────────────────────────────────────────────────────────────────────
function horizonSun(up) {
  const C = [12, 19.5];
  const rays = [-155, -122, -58, -25].map((a) => line(polar(...C, 8.25, a), polar(...C, 10.35, a)));
  const arrow = up ? [line([12, 9.75], [12, 3]), head([12, 3], [0, -1], 3)] : [line([12, 3], [12, 9.75]), head([12, 9.75], [0, 1], 3)];
  return [line([2.75, 19.5], [21.25, 19.5]), arcd(...C, 5.25, 180, 360), ...rays, ...arrow];
}
add('sunrise', ['amanecer', 'salida del sol', 'mañana', 'sunrise'], horizonSun(true));
add('sunset', ['atardecer', 'puesta de sol', 'tarde', 'sunset'], horizonSun(false));

// ── Maps and location ─────────────────────────────────────────────────────────────────────────
// The pin is the logomark's drop rotated 45°: a circle whose square corner points at the ground.
function pin([cx, cy], r) {
  const a = polar(cx, cy, r, 45);
  const b = polar(cx, cy, r, 135);
  return `M${pt(a)}A${N(r)} ${N(r)} 0 1 0 ${pt(b)}L${pt([cx, cy + r * Math.SQRT2])}Z`;
}
/** Ellipse from four cubics. */
function ellipse(cx, cy, rx, ry) {
  const k = 0.5523;
  return `M${pt([cx + rx, cy])}C${pt([cx + rx, cy + k * ry])} ${pt([cx + k * rx, cy + ry])} ${pt([cx, cy + ry])}C${pt([cx - k * rx, cy + ry])} ${pt([cx - rx, cy + k * ry])} ${pt([cx - rx, cy])}C${pt([cx - rx, cy - k * ry])} ${pt([cx - k * rx, cy - ry])} ${pt([cx, cy - ry])}C${pt([cx + k * rx, cy - ry])} ${pt([cx + rx, cy - k * ry])} ${pt([cx + rx, cy])}Z`;
}

// Map folded into three panels: zigzag top and bottom edges, two folds (`mapAt` places it, scaled,
// for the stacked maps of round 8).
const MAP_PTS = [[2.75, 6.25], [9, 4], [15, 6.25], [21.25, 4], [21.25, 17.75], [15, 20], [9, 17.75], [2.75, 20]];
const MAP_R = [1, 0.6, 0.6, 1, 1, 0.6, 0.6, 1];
{
  const P = MAP_PTS;
  add('map', ['mapa', 'plano', 'ubicación', 'map'], [roundpoly(P, MAP_R), line([9, 4], [9, 17.75]), line([15, 6.25], [15, 20])]);
}
const PIN = [12, 10.25];
const PIN_R = 7;
const pinWith = (g) => [pin(PIN, PIN_R), ...g];
add('map-pin', ['ubicación', 'pin de mapa', 'dirección', 'location', 'map pin'], pinWith([circ(...PIN, 2.5)]));
add('map-pin-plus', ['agregar ubicación', 'nuevo lugar', 'marcar sitio', 'add location', 'add place'], pinWith([line([9.25, PIN[1]], [14.75, PIN[1]]), line([12, PIN[1] - 2.75], [12, PIN[1] + 2.75])]));
add('map-pin-check', ['ubicación confirmada', 'llegada', 'entregado', 'location confirmed', 'arrived'], pinWith([line([8.9, PIN[1] + 0.1], [11, PIN[1] + 2.2], [15.1, PIN[1] - 1.9])]));
add('map-pin-x', ['quitar ubicación', 'lugar no disponible', 'sin cobertura', 'remove location', 'unavailable'], pinWith([line([9.9, PIN[1] - 2.1], [14.1, PIN[1] + 2.1]), line([14.1, PIN[1] - 2.1], [9.9, PIN[1] + 2.1])]));
{
  // Exact point: the pin floats above the point it marks.
  const c = [12, 8.25];
  const r = 5.75;
  add('map-pin-dot', ['punto exacto', 'soltar pin', 'aquí', 'drop pin', 'exact location'], [pin(c, r), circ(...c, 2), dot(12, 20)]);
}
{
  // Area: the pin standing at the center of an ellipse. The pin sits on top as a custom badge: the
  // engine clears the ellipse with exactly 1.5 of clearance.
  const c = [12, 8.25];
  const r = 5.5;
  const top = pin(c, r);
  const hole = circ(...c, 2);
  add('map-pin-area', ['zona', 'área', 'radio de entrega', 'area', 'nearby'], [ellipse(12, 16.75, 9, 3.5)], {
    badge: { d: [top, hole], knock: top, fill: { solid: [top], cut: [hole] } },
  });
}
{
  // Multiple places: a large pin with its ring and a smaller, complete one beside it (3 apart, not
  // overlapping: half a clipped pin read as a hook).
  const big = [15.25, 9.5];
  add('map-pins', ['ubicaciones', 'varios lugares', 'sucursales', 'puntos de venta', 'locations', 'branches'], [pin(big, 5), circ(...big, 2), pin([5.75, 14.25], 3)]);
}
{
  // Compass: the case with its four cardinal points and the diamond needle with north pointing northeast.
  const C = [12, 12];
  const n = polar(...C, 5.5, -45);
  const s = polar(...C, 5.5, 135);
  const e = polar(...C, 2.1, 45);
  const w = polar(...C, 2.1, -135);
  const ticks = [-90, 0, 90, 180].map((a) => line(polar(...C, 9, a), polar(...C, 6.75, a)));
  add('compass', ['brújula', 'orientación', 'explorar', 'norte', 'compass', 'explore'], [circ(...C, 9), roundpoly([n, e, s, w], [0.7, 0.5, 0.7, 0.5]), ...ticks]);
}
{
  // Navigation arrow: a 45° tip with a notched back; the faceted version has the ridge that splits
  // it into two faces, like a piece with volume. It's drawn pointing up and then rotated; `arrow`
  // centers it in its box so it carries the same weight at any angle.
  const TIP = [0, -9.25];
  const WING = [7.5, 8.75];
  const NOTCH = [0, 4.25];
  const R = [1.2, 1.1, 0.5, 1.1];
  // The ridge reaches the point where the tip's rounding ends.
  const half = Math.atan(WING[0] / (WING[1] - TIP[1]));
  const ridgeTop = [0, TIP[1] + R[0] * (1 / Math.sin(half) - 1)];
  const arrow = (turn, size, ridge) => {
    const shape = [TIP, WING, NOTCH, [-WING[0], WING[1]]].map((p) => rot(p, [0, 0], turn));
    const xs = shape.map((p) => p[0]);
    const ys = shape.map((p) => p[1]);
    const k = size / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const c = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
    const at = (p) => plus([12, 12], scale(sub(rot(p, [0, 0], turn), c), k));
    const body = roundpoly(shape.map((p) => plus([12, 12], scale(sub(p, c), k))), R.map((r) => r * k));
    return ridge ? [body, line(at(NOTCH), at(ridgeTop))] : [body];
  };
  // My location is the flat kite (with a ridge it would be confused with `send`); navigation is the
  // faceted piece moving forward.
  add('location-arrow', ['mi ubicación', 'ubicación actual', 'gps', 'current location'], arrow(45, 16.75, false));
  add('navigation', ['navegar', 'guía', 'rumbo', 'conducir', 'navigation', 'heading'], arrow(0, 18, true));
}
{
  // Route: leaves a ring, makes two turns and arrives at the tip of a pin.
  const end = [17.5, 6];
  const r = 3.4;
  const tip = [end[0], end[1] + r * Math.SQRT2];
  add('route', ['ruta', 'trayecto', 'recorrido', 'route', 'directions'], [
    circ(5.5, 18.5, 2.25),
    roundline([[7.75, 18.5], [12.25, 18.5], [12.25, 13.5], [17.5, 13.5], tip], [0, 2.25, 2.25, 2.25, 0]),
    pin(end, r),
  ]);
}
{
  // A post with two signs pointing in opposite directions.
  const top = [[5.75, 4.75], [16.75, 4.75], [19.75, 7.5], [16.75, 10.25], [5.75, 10.25]];
  const bottom = [[18.25, 12.75], [7.25, 12.75], [4.25, 15.5], [7.25, 18.25], [18.25, 18.25]];
  add('signpost', ['letrero', 'señal', 'dirección', 'signpost', 'wayfinding'], [
    roundpoly(top, [1.25, 1, 0.8, 1, 1.25]),
    roundpoly(bottom, [1.25, 1, 0.8, 1, 1.25]),
    line([12, 2.75], [12, 4.75]),
    line([12, 10.25], [12, 12.75]),
    line([12, 18.25], [12, 21.25]),
  ]);
}
add('directions', ['indicaciones', 'cómo llegar', 'vuelta', 'directions', 'turn'], [
  roundpoly([[12, 2.5], [21.5, 12], [12, 21.5], [2.5, 12]], 2.6),
  roundline([[9.75, 15], [9.75, 11.75], [15.25, 11.75]], [0, 1.75, 0]),
  head([15.25, 11.75], [1, 0], 3),
]);

// ── Buildings ─────────────────────────────────────────────────────────────────────────────────
{
  // House: a gabled roof with eaves, a round window in the gable, walls with a square bottom-right
  // corner and the door in the middle (the navigation `home` is the pentagon).
  const APEX = [12, 3.5];
  const EAVE = 11.25;
  const k = (EAVE - APEX[1]) / (APEX[0] - 2.75);
  const roof = (x) => APEX[1] + Math.abs(x - APEX[0]) * k;
  add('house', ['casa', 'hogar', 'vivienda', 'domicilio', 'house', 'residence'], [
    roundline([[2.75, EAVE], APEX, [21.25, EAVE]], [0, 1.25, 0]),
    roundline([[5.25, roof(5.25)], [5.25, 20.75], [18.75, 20.75], [18.75, roof(18.75)]], [0, 2.5, 0, 0]),
    roundline([[10.25, 20.75], [10.25, 16.25], [13.75, 16.25], [13.75, 20.75]], [0, 1.25, 1.25, 0]),
    circ(12, 9.75, 1.25),
  ]);
}
// Windows in a grid: r 0.3 dots, like the calendar's days (a dense group).
add('office-building', ['oficina', 'edificio', 'corporativo', 'empresa', 'office', 'building'], [
  sq(5.25, 2.75, 13.5, 18.5, 3.25, BR),
  ...[7, 10.75, 14.5].flatMap((y) => [9.5, 14.5].map((x) => dot(x, y, 0.3))),
  roundline([[10.25, 21.25], [10.25, 18], [13.75, 18], [13.75, 21.25]], [0, 1, 1, 0]),
]);
add('city', ['ciudad', 'edificios', 'centro', 'urbano', 'city', 'downtown'], [
  sq(3.25, 2.75, 9.5, 18.5, 2.75, BR),
  roundline([[12.75, 9], [20.75, 9], [20.75, 21.25], [12.75, 21.25]], [0, 2.75, 0, 0]),
  ...[6.75, 10.25, 13.75, 17.25].map((y) => dot(8, y, 0.3)),
  ...[13, 16.5].map((y) => dot(16.75, y, 0.3)),
]);
add('factory', ['fábrica', 'planta', 'industria', 'manufactura', 'factory', 'plant'], [
  roundpoly(
    [[2.75, 21.25], [2.75, 3.75], [7, 3.75], [7, 12], [11.75, 8.5], [11.75, 12], [16.5, 8.5], [16.5, 12], [21.25, 8.5], [21.25, 21.25]],
    [2.25, 1, 1, 0.4, 0.75, 0.4, 0.75, 0.4, 0.75, 0],
  ),
  roundline([[10.25, 21.25], [10.25, 16.75], [13.75, 16.75], [13.75, 21.25]], [0, 1, 1, 0]),
]);
add('hospital', ['hospital', 'clínica', 'salud', 'urgencias', 'hospital'], [
  roundpoly([[3.25, 21.25], [3.25, 10.5], [7.25, 10.5], [7.25, 3.25], [16.75, 3.25], [16.75, 10.5], [20.75, 10.5], [20.75, 21.25]], [2, 1.25, 0.4, 2, 2, 0.4, 1.25, 0]),
  line([12, 6.5], [12, 10]),
  line([10.25, 8.25], [13.75, 8.25]),
  roundline([[10.25, 21.25], [10.25, 16.75], [13.75, 16.75], [13.75, 21.25]], [0, 1, 1, 0]),
]);
add('school', ['escuela', 'colegio', 'educación', 'campus', 'school', 'education'], [
  roundpoly([[2.75, 21.25], [2.75, 13.5], [7.25, 13.5], [7.25, 11.75], [12, 7.75], [16.75, 11.75], [16.75, 13.5], [21.25, 13.5], [21.25, 21.25]], [2, 1.25, 0.4, 0.75, 1, 0.75, 0.4, 1.25, 0]),
  // The flagpole starts where the ridge's rounding ends (no stub).
  line([12, 8.06], [12, 2.75]),
  roundline([[12, 2.75], [16, 2.75], [14.9, 4.1], [16, 5.5], [12, 5.5]], [0, 0.3, 0.3, 0.3, 0]),
  roundline([[10.25, 21.25], [10.25, 16.5], [13.75, 16.5], [13.75, 21.25]], [0, 1, 1, 0]),
]);
{
  // Corner shop: a striped awning over the storefront; walls with a square bottom-right corner.
  const T = [[5.25, 3.25], [18.75, 3.25], [21.25, 9.25], [2.75, 9.25]];
  const stripe = (t) => line(lerp([5.25, 3.25], [18.75, 3.25], t), lerp([2.75, 9.25], [21.25, 9.25], t));
  add('corner-shop', ['tienda de barrio', 'abarrotes', 'local', 'tiendita', 'corner shop'], [
    roundpoly(T, [1, 1, 1, 1]),
    stripe(1 / 3),
    stripe(2 / 3),
    roundline([[4.5, 9.25], [4.5, 21.25], [19.5, 21.25], [19.5, 9.25]], [0, 2.25, 0, 0]),
    roundline([[10.25, 21.25], [10.25, 14.5], [13.75, 14.5], [13.75, 21.25]], [0, 1.25, 1.25, 0]),
  ]);
}
// Bed: the pillow floats 1.5 clear of the mattress (touching, it merged with it when filled).
add('bed', ['hotel', 'hospedaje', 'cama', 'dormir', 'bed', 'lodging'], [
  line([3.25, 4.75], [3.25, 20.25]),
  roundline([[3.25, 11.75], [17.75, 11.75], [20.75, 14.75], [20.75, 20.25]], [0, 2.5, 2.5, 0]),
  line([3.25, 16.75], [20.75, 16.75]),
  capsule(6.25, 5, 6.5, 3.75),
]);

// ── Transportation ────────────────────────────────────────────────────────────────────────────
/** Moves points: rotates `deg` around (12, 12), scales by `k` and moves to `to`. */
const place = (pts, deg, k = 1, to = [12, 12]) => pts.map((p) => plus(to, scale(sub(rot(p, [12, 12], deg), [12, 12]), k)));

// Car from the front: a trapezoidal cabin over the body, headlights and tires.
function car(cabinTop = 5.25) {
  return [
    sq(2.75, 10.25, 18.5, 7.5, 2.5),
    roundline([[4.6, 10.25], [6.75, cabinTop], [17.25, cabinTop], [19.4, 10.25]], [0, 1.4, 1.4, 0]),
    roundline([[5, 17.75], [5, 20.75], [8, 20.75], [8, 17.75]], [0, 0.75, 0.75, 0]),
    roundline([[16, 17.75], [16, 20.75], [19, 20.75], [19, 17.75]], [0, 0.75, 0.75, 0]),
    dot(6.75, 14),
    dot(17.25, 14),
  ];
}
add('car', ['auto', 'coche', 'carro', 'manejar', 'car'], car());
add('taxi', ['taxi', 'auto de alquiler', 'viaje', 'traslado', 'cab', 'ride'], [...car(6.5), roundline([[9.75, 6.5], [9.75, 3.75], [14.25, 3.75], [14.25, 6.5]], [0, 0.75, 0.75, 0])]);
add('bus', ['autobús', 'camión', 'transporte público', 'parada', 'bus', 'transit'], [
  sq(4.75, 2.75, 14.5, 15.75, 3.25),
  roundline([[6.75, 18.5], [6.75, 21.25], [9.25, 21.25], [9.25, 18.5]], [0, 0.75, 0.75, 0]),
  roundline([[14.75, 18.5], [14.75, 21.25], [17.25, 21.25], [17.25, 18.5]], [0, 0.75, 0.75, 0]),
  line([4.75, 6.5], [19.25, 6.5]),
  line([4.75, 12], [19.25, 12]),
  dot(8.25, 15.25),
  dot(15.75, 15.25),
]);
add('train', ['tren', 'metro', 'ferrocarril', 'train', 'subway'], [
  sq(5.25, 2.75, 13.5, 14.75, 4),
  sq(8, 6, 8, 4.5, 1.4),
  dot(9.25, 13.75),
  dot(14.75, 13.75),
  line([8.5, 17.5], [6.25, 21.25]),
  line([15.5, 17.5], [17.75, 21.25]),
]);

// Airplane seen from above: a 3-wide fuselage, swept wings and a straight stabilizer.
const PLANE = [
  [10.5, 2.75], [13.5, 2.75], [13.5, 9.25], [20.75, 13.25], [20.75, 15.25], [13.5, 13.75], [13.5, 18.25], [16.25, 20.25],
  [16.25, 21.25], [7.75, 21.25], [7.75, 20.25], [10.5, 18.25], [10.5, 13.75], [3.25, 15.25], [3.25, 13.25], [10.5, 9.25],
];
const PLANE_R = [1.5, 1.5, 0.5, 0.75, 0.75, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.75, 0.75, 0.5];
const plane = (deg, k = 1, to = [12, 12]) => roundpoly(place(PLANE, deg, k, to), PLANE_R);
add('plane', ['avión', 'vuelo', 'viaje', 'plane', 'flight'], [plane(45, 0.97)]);
add('plane-takeoff', ['despegue', 'salida', 'vuelo', 'takeoff', 'departure'], [plane(60, 0.9, [12.25, 10]), line([2.75, 20.75], [21.25, 20.75])]);
add('plane-landing', ['aterrizaje', 'llegada', 'vuelo', 'landing', 'arrival'], [plane(120, 0.84, [12, 10.5]), line([2.75, 20.75], [21.25, 20.75])]);

add('ship', ['barco', 'buque', 'envío marítimo', 'ship', 'ferry'], [
  roundpoly([[2.75, 13.25], [21.25, 13.25], [18, 19.75], [6, 19.75]], [1, 1, 1.75, 1.75]),
  roundline([[7, 13.25], [7, 8.75], [16, 8.75], [16, 13.25]], [0, 1.25, 1.25, 0]),
  roundline([[10, 8.75], [10, 4.25], [13, 4.25], [13, 8.75]], [0, 0.75, 0.75, 0]),
]);
add('sailboat', ['velero', 'vela', 'navegar', 'regata', 'sailboat', 'sailing'], [
  roundpoly([[10.75, 3], [10.75, 14.25], [4, 14.25]], [0.75, 0.75, 0.75]),
  roundpoly([[13.25, 5.75], [19.25, 14.25], [13.25, 14.25]], [0.75, 0.75, 0.75]),
  roundpoly([[2.75, 17], [21.25, 17], [18.5, 20.75], [5.5, 20.75]], [0.75, 0.75, 1.25, 1.25]),
]);
{
  const C = [12, 12.5];
  const r = 8.25;
  const L = arc(...C, r, 90, 155);
  const R = arc(...C, r, 90, 25);
  add('anchor', ['ancla', 'puerto', 'marino', 'anchor', 'harbor'], [
    circ(12, 4.75, 2),
    line([12, 6.75], [12, 20.75]),
    line([8.75, 10], [15.25, 10]),
    `M${pt(L.end)}A${N(r)} ${N(r)} 0 0 0 ${pt(R.end)}`,
    head(L.end, L.tangent, 2.75),
    head(R.end, R.tangent, 2.75),
  ]);
}
{
  // Bicycle: a diamond frame between two wheels, fork, seat and handlebar. The saddle and the
  // handlebar come out of square vertices of the frame (no stubs) and the tubes clear the wheels.
  const [A, F, B, S, H] = [[5.75, 15], [18.25, 15], [11.5, 15], [9, 9], [15, 9]];
  const R = 3.25;
  add('bicycle', ['bicicleta', 'bici', 'ciclismo', 'ciclovía', 'bicycle', 'bike'], [
    circ(...A, R),
    circ(...F, R),
    roundpoly([A, B, H, S], [0.4, 0.6, 0, 0]),
    line(H, F),
    line(S, [8.4, 6]),
    line([7, 6], [10, 6]),
    roundline([H, [14.25, 6], [16.75, 6]], [0, 0.6, 0]),
  ]);
}
{
  // Scooter: the handlebar stem comes down to touch the front wheel without crossing it.
  const F = [18.75, 18.25];
  const top = [16, 3.75];
  add('scooter', ['patín eléctrico', 'scooter', 'micromovilidad', 'kick scooter'], [
    circ(5.25, 18.25, 2.5),
    circ(...F, 2.5),
    line([7.75, 18.25], [16.25, 18.25]),
    line(top, sub(F, scale(unit(sub(F, top)), 2.5))),
    line([13.75, 3.75], [17.75, 3.75]),
  ]);
}
{
  // Person walking: head, leaning torso, and arms and legs mid-stride.
  add('walking', ['caminar', 'a pie', 'peatón', 'walking', 'pedestrian'], [
    circ(13.25, 4.5, 1.9),
    line([12.6, 8.5], [11, 14]),
    roundline([[11, 14], [8.5, 17.25], [7.25, 21]], [0, 0.6, 0]),
    roundline([[11, 14], [13.75, 16.5], [14.5, 21]], [0, 0.6, 0]),
    roundline([[8.5, 12.5], [9, 10], [12.6, 8.5], [14.75, 11.5], [17.25, 12.25]], [0, 0.6, 0.6, 0.6, 0]),
  ]);
}
const pump = () => [
  sq(3.5, 3.25, 10, 18, 2.75, BR),
  sq(6, 6, 5, 4.25, 1.25),
];
const hose = roundline([[13.5, 12.5], [16.25, 12.5], [16.25, 19], [19.5, 19], [19.5, 8.25], [17.25, 6]], [0, 1.25, 1.6, 1.6, 1.25, 0]);
add('gas-station', ['gasolinera', 'combustible', 'cargar gasolina', 'gas station', 'fuel'], [...pump(), hose]);
add('ev-charger', ['cargador eléctrico', 'auto eléctrico', 'cargar', 'ev charger', 'charging station'], [
  sq(3.5, 3.25, 10, 18, 2.75, BR),
  roundline([[9.75, 6.75], [6.75, 12.5], [10.25, 12.5], [7.25, 18]], [0, 0.5, 0.5, 0]),
  hose,
]);
add('parking', ['estacionamiento', 'aparcar', 'cochera', 'parking', 'parking lot'], [sq(3.25, 3.25, 17.5, 17.5, 4, BR), `M9.75 17.5V7H13a3.25 3.25 0 0 1 0 6.5H9.75`]);
add('traffic-light', ['semáforo', 'tráfico', 'alto', 'crucero', 'traffic light', 'stoplight'], [sq(7.5, 2.75, 9, 18.5, 3.25), circ(12, 7, 1.25), circ(12, 12, 1.25), circ(12, 17, 1.25)]);
// Road in perspective: the center dashes grow as they get closer.
add('road', ['carretera', 'camino', 'viaje', 'ruta', 'road', 'highway'], [line([8, 3], [3.5, 21]), line([16, 3], [20.5, 21]), line([12, 3.5], [12, 5.5]), line([12, 8.5], [12, 11.5]), line([12, 15], [12, 19.75])]);

// ── Weather ───────────────────────────────────────────────────────────────────────────────────
// The cloud is the one from archivos (three circles and a flat base), computed with exact arcs. `k`
// scales around (12, 12) and `o` moves it; on top of another piece it goes in as a custom badge.
const CLOUD = [[7.25, 14.25, 4], [12.5, 10.75, 5.5], [17.25, 14.5, 3.75]];
const cloudCircles = (k = 1, o = [0, 0]) => CLOUD.map(([x, y, r]) => [o[0] + 12 + (x - 12) * k, o[1] + 12 + (y - 12) * k, r * k]);
function cloud(k = 1, o = [0, 0]) {
  const [A, B, C] = cloudCircles(k, o);
  const top = (P, Q) => meet(P, Q).sort((p, q) => p[1] - q[1])[0];
  const ab = top(A, B);
  const bc = top(B, C);
  const base = A[1] + A[2];
  const ccw = (P, a0, a1, to) => {
    const span = (((a0 - a1) % 360) + 360) % 360;
    return `A${N(P[2])} ${N(P[2])} 0 ${span > 180 ? 1 : 0} 0 ${pt(to)}`;
  };
  return `M${pt([C[0], base])}${ccw(C, 90, angOf(C, bc), bc)}${ccw(B, angOf(B, bc), angOf(B, ab), ab)}${ccw(A, angOf(A, ab), 90, [A[0], base])}Z`;
}
/** Region of the cloud thickened by D (to measure the clearance of whatever sits next to it). */
function cloudZone(k = 1, o = [0, 0], D = GAP) {
  const [A, B, C] = cloudCircles(k, o);
  const base = A[1] + A[2];
  const y0 = Math.min(A[1], C[1]);
  return [disc(A, A[2] + D), disc(B, B[2] + D), disc(C, C[2] + D), nearBox(A[0], y0, C[0] - A[0], base - y0, D)];
}
// Rain cloud: a bit smaller and higher, to leave 5 of sky below.
const RK = 0.88;
const RO = [0, -3.1];
const rainCloud = () => cloud(RK, RO);

/** Sun: a disc of radius r and rays from r + 3 to r + 5.1 (1.5 of clearance and just over 2 long). */
const sunRays = (c, r, n = 8, a0 = 0, l0 = 3, l1 = 5.1) => Array.from({ length: n }, (_, i) => line(polar(...c, r + l0, a0 + (i * 360) / n), polar(...c, r + l1, a0 + (i * 360) / n)));
add('sun', ['sol', 'soleado', 'día', 'claro', 'modo claro', 'sun', 'sunny'], [circ(12, 12, 4.25), ...sunRays([12, 12], 4.25)]);
add('sun-dim', ['sol tenue', 'poco brillo', 'brillo bajo', 'dim', 'low brightness'], [circ(12, 12, 4.25), ...Array.from({ length: 8 }, (_, i) => dot(...polar(12, 12, 8, i * 45)))]);

/** Crescent moon: the disc of radius R minus the one of radius r centered at `ic`. */
function moon(c, R, ic, r) {
  const [p, q] = meet([...c, R], [...ic, r]);
  // p and q are the tips; the outer edge runs outside the inner circle.
  const outer = (a, b) => `A${N(R)} ${N(R)} 0 1 0 ${pt(b)}`;
  const inner = (a, b) => `A${N(r)} ${N(r)} 0 0 1 ${pt(b)}`;
  return `M${pt(p)}${outer(p, q)}${inner(q, p)}Z`;
}
const MOON = () => moon([11.5, 12.5], 8.5, [16.75, 7.25], 6.75);
add('moon', ['luna', 'noche', 'modo oscuro', 'moon', 'night'], [MOON()]);

/** Four-pointed sparkle with concave sides (cubics curving toward the center). */
function sparkle([cx, cy], R, k = 0.3) {
  const P = [0, 1, 2, 3].map((i) => polar(cx, cy, R, -90 + i * 90));
  let d = `M${pt(P[0])}`;
  for (let i = 0; i < 4; i++) {
    const a = P[i];
    const b = P[(i + 1) % 4];
    const c1 = lerp(a, [cx, cy], 1 - k);
    const c2 = lerp(b, [cx, cy], 1 - k);
    d += `C${pt(lerp(a, c1, 0.75))} ${pt(lerp(b, c2, 0.75))} ${pt(b)}`;
  }
  return `${d}Z`;
}
add('moon-stars', ['luna y estrellas', 'noche', 'dormir', 'descanso', 'night sky', 'sleep'], [moon([10.25, 13.75], 7.5, [15, 9], 6), sparkle([17.25, 6.25], 3.75), dot(20.5, 11.75)]);

add('cloud', ['nube', 'nublado', 'clima', 'cloud', 'cloudy'], [cloud()]);
/** Custom badge: a cloud on top of another piece (the engine clears what's behind with 1.5 of clearance). */
const cloudBadge = (d) => ({ d: [d], knock: d, fill: { solid: [d] } });
/** Does the stroke `d` stay fully 1.5 clear of the cloud (k, o)? (3 center to center, on the outside.) */
function clearOf(d, k, o) {
  const outline = parse(cloud(k, o))[0].segs.flatMap((sg) => Array.from({ length: 40 }, (_, i) => at(sg, i / 40)));
  const inside = cloudZone(k, o, 0);
  return parse(d)[0].segs.every((sg) =>
    Array.from({ length: 21 }, (_, i) => at(sg, i / 20)).every((p) => !inside.some((f) => f(p)) && Math.min(...outline.map((q) => len(sub(p, q)))) >= GAP),
  );
}
{
  // Two clouds: the front one sits on top as a custom badge; the back one is complete.
  add('clouds', ['nublado', 'nubes', 'cielo cubierto', 'clouds', 'overcast'], [cloud(0.6, [4, -3.4])], { badge: cloudBadge(cloud(0.82, [-1.25, 2.4])) });
}
{
  // Sun behind the cloud: at the top left; the cloud sits on top as a custom badge. Only the rays
  // that stay fully 1.5 clear of it are drawn (a partial one would be a fragment). The sun sits close
  // enough for the cloud's clearance to cut its ring through at every weight: at 9.5, 9.5 the ring's
  // inner edge came out of the clearance at 2.1 and closed the ring.
  const k = 0.72;
  const o = [2.75, 3.75];
  const s = [9.75, 9.75];
  add('cloud-sun', ['parcialmente nublado', 'medio nublado', 'sol y nubes', 'partly cloudy'], [circ(...s, 2.5), ...sunRays(s, 2.5).filter((r) => clearOf(r, k, o))], {
    badge: cloudBadge(cloud(k, o)),
  });
  // The moon hides its lower horn behind the cloud (with the horn next to it, the clearing left a
  // sliver of its tip).
  add('cloud-moon', ['noche nublada', 'luna y nubes', 'clima', 'partly cloudy night', 'cloudy night'], [moon([9, 9], 6, [14, 7], 5.25)], { badge: cloudBadge(cloud(k, o)) });
}
{
  const drops = [[8, 17.25], [12, 17.25], [16, 17.25]];
  add('cloud-rain', ['lluvia', 'lluvioso', 'chubascos', 'rain'], [rainCloud(), ...drops.map(([x, y]) => line([x, y], [x - 1.5, y + 4]))]);
  // Drizzle: the same slant as the rain, in short alternating dashes.
  const dash = ([x, y]) => line([x, y], [x - 0.7, y + 2]);
  add('cloud-drizzle', ['llovizna', 'lluvia ligera', 'chipi chipi', 'drizzle', 'light rain'], [rainCloud(), ...[[6.75, 17.25], [10.5, 19.25], [14.25, 17.25], [18, 19.25]].map(dash)]);
  // Snow: six-armed flakes.
  const flake = ([x, y], r = 2) => [90, 150, 210].map((a) => line(polar(x, y, r, a), polar(x, y, r, a + 180)));
  add('cloud-snow', ['nieve', 'nevada', 'invierno', 'snow', 'snowfall'], [rainCloud(), ...flake([8.5, 19.25]), ...flake([15.5, 19.25])]);
  add('storm', ['tormenta', 'tormenta eléctrica', 'rayo', 'thunderstorm', 'storm'], [
    rainCloud(),
    roundline([[13, 17.25], [10.75, 19.5], [13.5, 19.5], [11.5, 21.75]], [0, 0.4, 0.4, 0]),
    line([7.75, 17.25], [6.85, 19.75]),
    line([17.25, 17.25], [16.35, 19.75]),
  ]);
  add('fog', ['niebla', 'neblina', 'bruma', 'fog', 'mist'], [rainCloud(), line([3.5, 17.5], [17.5, 17.5]), line([6.5, 20.75], [20.5, 20.75])]);
}
add('wind', ['viento', 'aire', 'ventoso', 'wind', 'breeze'], [
  `M2.75 9H14.5${arc(14.5, 6.25, 2.75, 90, -180).d.replace(/^M[^A]+/, '')}`,
  `M2.75 12.75H18.25${arc(18.25, 15.5, 2.75, -90, 180).d.replace(/^M[^A]+/, '')}`,
  line([2.75, 16.5], [9.5, 16.5]),
]);
{
  // Tornado: the funnel's mouth is a full ellipse; below it, turns (half ellipses) that narrow and
  // sway from side to side.
  const turn = (cx, y, rx, ry = 1.25) => `M${pt([cx - rx, y])}A${N(rx)} ${N(ry)} 0 0 0 ${pt([cx + rx, y])}`;
  add('tornado', ['tornado', 'huracán', 'remolino', 'tormenta', 'tornado', 'twister'], [
    ell([12, 5.25], 9, 1.75),
    turn(12.5, 9.75, 6.5, 1),
    turn(12, 14.25, 4.5, 1),
    turn(11, 18.75, 2.5, 1),
  ]);
}
{
  // Snowflake: six arms coming out of a hollow center; each with a pair of branches opening
  // outward, the way the crystal grows.
  const SIX = [-90, -30, 30, 90, 150, 210];
  const branch = (a) => head(polar(12, 12, 5.5, a), [-Math.cos(rad(a)), -Math.sin(rad(a))], 2.5, 50);
  add('snowflake', ['copo de nieve', 'frío', 'congelado', 'invierno', 'snowflake', 'freeze'], [
    ...SIX.map((a) => line(polar(12, 12, 3, a), polar(12, 12, 9, a))),
    ...SIX.map(branch),
  ]);
}
{
  // Rainbow coming down to a cloud: three arched bands with their legs; the cloud sits on top as a
  // custom badge and the engine clears the right-hand legs with 1.5 of clearance.
  const band = (c, r, foot) => `M${pt([c[0] - r, foot])}V${N(c[1])}A${N(r)} ${N(r)} 0 0 1 ${pt([c[0] + r, c[1]])}V${N(foot)}`;
  const C = [11, 12.5];
  add('rainbow', ['arcoíris', 'después de la lluvia', 'esperanza', 'diversidad', 'rainbow', 'pride'], [8.25, 5.25, 2.25].map((r) => band(C, r, 17.25)), {
    badge: cloudBadge(cloud(0.46, [4.9, 5.4])),
  });
}
{
  // Thermometer: a 5.8 tube (the mercury 1.4 clear of the walls) ending in a bulb of radius 4.5;
  // the mercury goes down to the bulb's center.
  const thermo = (x = 12, top = 8.75) => {
    const [w, R, yb] = [2.9, 4.5, 16.75];
    const yi = yb - Math.sqrt(R * R - w * w);
    return [`M${N(x - w)} ${N(yi)}V${N(2.75 + w)}A${N(w)} ${N(w)} 0 0 1 ${N(x + w)} ${N(2.75 + w)}V${N(yi)}A${N(R)} ${N(R)} 0 1 1 ${N(x - w)} ${N(yi)}Z`, line([x, top], [x, yb])];
  };
  // The mercury in three touching segments (they read as one): its levels, from the bulb upward.
  const [glass] = thermo();
  add('thermometer', ['termómetro', 'temperatura', 'grados', 'thermometer', 'temperature'], [glass, line([12, 16.75], [12, 13.5]), line([12, 13.5], [12, 11]), line([12, 11], [12, 8.75])]);
  add('thermometer-up', ['calor', 'temperatura alta', 'sube la temperatura', 'hot', 'temperature up'], [...thermo(9, 8.25), line([17.75, 13.5], [17.75, 3.5]), head([17.75, 3.5], [0, -1], 3)]);
  add('thermometer-down', ['frío', 'temperatura baja', 'baja la temperatura', 'cold', 'temperature down'], [...thermo(9, 12.5), line([17.75, 3.5], [17.75, 13.5]), head([17.75, 13.5], [0, 1], 3)]);
}
add('umbrella', ['paraguas', 'sombrilla', 'lluvia', 'protección', 'umbrella'], [
  `M3 12.5A9 9 0 0 1 21 12.5A3 3 0 0 0 15 12.5A3 3 0 0 0 9 12.5A3 3 0 0 0 3 12.5Z`,
  `M12 9.5V19a1.75 1.75 0 0 1-3.5 0`,
]);
{
  // Water drop: the logomark's drop with its square corner pointing up, and a highlight.
  const drop2 = ([cx, cy], r) => {
    const a = polar(cx, cy, r, -45);
    const b = polar(cx, cy, r, -135);
    return `M${pt(a)}A${N(r)} ${N(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
  };
  add('droplet', ['gota', 'agua', 'líquido', 'droplet', 'water'], [drop2([12, 13.5], 7.25), arcd(12, 13.5, 4.25, 100, 165)]);
  add('droplets', ['humedad', 'gotas', 'agua', 'humidity', 'droplets'], [drop2([9, 15], 5.75), drop2([17.5, 7.25], 3)]);
}

// ── Nature ────────────────────────────────────────────────────────────────────────────────────
/** Ellipse with semi-axes rx, ry rotated `tilt` degrees, as four cubics. */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const P = (x, y) => plus(c, rot([x, y], [0, 0], tilt));
  return `M${pt(P(rx, 0))}C${pt(P(rx, k * ry))} ${pt(P(k * rx, ry))} ${pt(P(0, ry))}C${pt(P(-k * rx, ry))} ${pt(P(-rx, k * ry))} ${pt(P(-rx, 0))}C${pt(P(-rx, -k * ry))} ${pt(P(-k * rx, -ry))} ${pt(P(0, -ry))}C${pt(P(k * rx, -ry))} ${pt(P(rx, -k * ry))} ${pt(P(rx, 0))}Z`;
}

/** Lens: two arcs of radius R between A and B (leaf, petal). */
const lens = (A, B, R) => `M${pt(A)}A${N(R)} ${N(R)} 0 0 1 ${pt(B)}A${N(R)} ${N(R)} 0 0 1 ${pt(A)}Z`;

/**
 * Outline of the union of several circles [x, y, r] ordered clockwise around `c`: on each one, the
 * outer arc between its crossings with the previous and the next.
 */
function union(cs, c) {
  const n = cs.length;
  const far = (P, Q) => meet(P, Q).sort((p, q) => len(sub(q, c)) - len(sub(p, c)))[0];
  const X = cs.map((P, i) => far(P, cs[(i + 1) % n]));
  let d = `M${pt(X[n - 1])}`;
  cs.forEach((P, i) => {
    const a0 = angOf(P, X[(i - 1 + n) % n]);
    const a1 = angOf(P, X[i]);
    const span = (((a1 - a0) % 360) + 360) % 360;
    d += `A${N(P[2])} ${N(P[2])} 0 ${span > 180 ? 1 : 0} 1 ${pt(X[i])}`;
  });
  return { d: `${d}Z`, X };
}

add('leaf', ['hoja', 'ecológico', 'natural', 'leaf', 'eco'], [lens([5.5, 18.5], [20.25, 3.75], 15.5), line([3.25, 20.75], [14.25, 9.75])]);
{
  // Tree: a crown of three circles (a union) and the trunk rising from the notch at the bottom.
  const cs = [[7.5, 11, 4.25], [12, 6.75, 4.75], [16.5, 11, 4.25]];
  const u = union(cs, [12, 10]);
  add('tree', ['árbol', 'parque', 'naturaleza', 'sustentable', 'tree', 'nature'], [u.d, line([12, 21.25], [12, 10.25]), line([12, 13.75], [14.75, 11])]);
}
// Pine: the same construction as `tree` (the trunk enters the crown and puts out a branch), with a
// triangular crown.
add('tree-pine', ['pino', 'bosque', 'árbol', 'navidad', 'conífera', 'pine', 'forest'], [
  roundpoly([[12, 2.75], [19, 17.75], [5, 17.75]], [1.25, 1.5, 1.5]),
  line([12, 21.25], [12, 9.75]),
  line([12, 15.75], [13.9, 13.85]),
]);
{
  // Palm tree: a curved trunk and four fronds drooping from the crown.
  const T = [13, 8.25];
  add('palm-tree', ['palmera', 'playa', 'trópico', 'vacaciones', 'palm tree', 'beach'], [
    `M${pt(T)}C13.25 13 12.25 17.5 10.25 21.25`,
    `M${pt(T)}A6.5 6.5 0 0 0 3.25 11.25`,
    `M${pt(T)}A6.5 6.5 0 0 1 20.75 11.25`,
    `M${pt(T)}A6 6 0 0 0 6.5 3.25`,
    `M${pt(T)}A6 6 0 0 1 18.5 3.25`,
  ]);
}
{
  // Flower: five petals (a union of circles), the center and the stem with a leaf.
  const c = [12, 8.75];
  const cs = [0, 1, 2, 3, 4].map((i) => [...polar(...c, 3.6, -90 + i * 72), 2.9]);
  const u = union(cs, c);
  const bottom = u.X[2];
  add('flower', ['flor', 'jardín', 'primavera', 'flower', 'garden'], [u.d, circ(...c, 1.75), line(bottom, [12, 21.25]), lens([12, 19.75], [17, 16.75], 4.5)]);
}
add('sprout', ['brote', 'crecer', 'planta', 'semilla', 'sprout', 'growth'], [
  line([12, 21], [12, 10.5]),
  lens([12, 14.75], [4.5, 10], 6.5),
  lens([12, 10.25], [19.5, 5], 7),
  line([7.5, 21], [16.5, 21]),
]);
add('cactus', ['cactus', 'desierto', 'planta', 'cactus', 'desert'], [
  'M9.75 21V15.5H7a2.25 2.25 0 0 1-2.25-2.25V8.75a1.6 1.6 0 0 1 3.2 0V12.25H9.75V5a2.25 2.25 0 0 1 4.5 0V11.25h1.8V7.5a1.6 1.6 0 0 1 3.2 0V12.25a2.25 2.25 0 0 1-2.25 2.25H14.25V21',
  line([6.25, 21], [17.75, 21]),
]);
// Flame: a round base rising to a tilted tip; inside, the logomark's drop (the fire station's gable
// carries it too).
function flame(c, r, tip) {
  const L0 = polar(...c, r, 195);
  const R0 = polar(...c, r, -15);
  const tl = [Math.sin(rad(15)), -Math.cos(rad(15))];
  const tr = [Math.sin(rad(15)), Math.cos(rad(15))];
  const k = r * 0.62;
  const out = `M${pt(L0)}C${pt(plus(L0, scale(tl, k)))} ${pt(plus(tip, [-r * 0.42, r * 0.62]))} ${pt(tip)}C${pt(plus(tip, [r * 0.2, r * 0.5]))} ${pt(sub(R0, scale(tr, k)))} ${pt(R0)}A${N(r)} ${N(r)} 0 1 1 ${pt(L0)}Z`;
  const ri = r * 0.36;
  const ic = [c[0], c[1] + r - ri - 2.4];
  const a = polar(...ic, ri, -45);
  const b = polar(...ic, ri, -135);
  const drop = `M${pt(a)}A${N(ri)} ${N(ri)} 0 1 1 ${pt(b)}L${pt([ic[0], ic[1] - ri * Math.SQRT2])}Z`;
  return [out, drop];
}
{
  add('flame', ['llama', 'fuego', 'tendencia', 'popular', 'flame', 'fire'], flame([12, 14.25], 6.75, [13.25, 2.75]));
  // Campfire: the flame over two logs leaning toward the center (they don't cross: clearing such an
  // open crossing ate half a log).
  add('campfire', ['fogata', 'campamento', 'fuego', 'acampar', 'campfire', 'bonfire'], [
    ...flame([12, 10.25], 5, [12.75, 2.5]),
    line([4.25, 21], [10, 18.25]),
    line([19.75, 21], [14, 18.25]),
  ]);
}
{
  // Mountains: the back peak complete and the front one on top as a custom badge: the engine clears
  // the back one with exactly 1.5 of clearance (including its ground next to the front one).
  const F = [[2.75, 19.75], [9.5, 5.75], [16.25, 19.75]];
  const front = roundpoly(F, [1, 1.25, 1]);
  const back = roundpoly([[11, 19.75], [16.25, 9.75], [21.25, 19.75]], [1, 1.25, 1]);
  add('mountain', ['montaña', 'cerro', 'paisaje', 'sierra', 'mountain', 'landscape'], [back], { badge: { d: [front], knock: front, fill: { solid: [front] } } });
  const k = (F[1][0] - F[0][0]) / (F[0][1] - F[1][1]);
  const L = (y) => [F[1][0] - (y - F[1][1]) * k, y];
  const Rr = (y) => [F[1][0] + (y - F[1][1]) * k, y];
  const snow = line(L(10.75), [8.6, 12.25], [10.25, 10.75], Rr(11.75));
  add('mountain-snow', ['montaña nevada', 'cumbre', 'cima', 'nieve', 'snowy mountain', 'summit'], [back], {
    badge: { d: [front, snow], knock: front, fill: { solid: [front], cut: [snow] } },
  });
}
add('wave', ['ola', 'mar', 'océano', 'surf', 'wave', 'ocean'], [
  'M2.75 19.25C7.25 19.25 7.5 5 14.5 5A4.5 4.5 0 0 1 19 9.5A2.25 2.25 0 0 1 14.5 9.5C11.75 12.5 13 19.25 21.25 19.25',
]);
{
  // Planet: the ring passes in front of the disc at the bottom and behind it at the top. The front
  // half sits on top as a custom badge (it clears the disc with 1.5 of clearance); the two arcs of
  // the back half end 1.5 clear of the disc (3 center to center).
  const C = [12, 12];
  const R = 5.5;
  const [rx, ry] = [10.5, 2];
  const tilt = -18;
  const E = (t) => plus(C, rot([rx * Math.cos(rad(t)), ry * Math.sin(rad(t))], [0, 0], tilt));
  /** Ring arc from t0 to t1 (parameter in degrees, increasing = clockwise). */
  const ring = (t0, t1) => `M${pt(E(t0))}A${N(rx)} ${N(ry)} ${N(tilt)} 0 1 ${pt(E(t1))}`;
  /** Parameter (0–90) where the ring is `d` from the center. */
  const atDist = (d) => deg(Math.acos(Math.sqrt((d * d - ry * ry) / (rx * rx - ry * ry))));
  const tb = atDist(R + GAP);
  const front = `${ring(0, 90)}${ring(90, 180).replace(/^M[^A]+/, '')}`;
  // The area it clears: the front run that crosses the disc, out and back (no area); its tips stay
  // more than 1.5 clear of the back arcs.
  const tk = atDist(R + 1.5);
  const A = (t, sweep) => `A${N(rx)} ${N(ry)} ${N(tilt)} 0 ${sweep} ${pt(E(t))}`;
  const knock = `M${pt(E(tk))}${A(90, 1)}${A(180 - tk, 1)}${A(90, 0)}${A(tk, 0)}`;
  add('planet', ['planeta', 'espacio', 'saturno', 'planet', 'space'], [circ(...C, R), ring(180, 180 + tb), ring(360 - tb, 360)], { badge: { d: [front], knock } });
}
{
  const s = [15.25, 8.75];
  const star = roundpoly(Array.from({ length: 10 }, (_, i) => polar(...s, i % 2 ? 2.35 : 5.5, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.4 : 0.75)));
  add('shooting-star', ['estrella fugaz', 'deseo', 'destacado', 'shooting star', 'wish'], [star, line([10.25, 13.75], [3.5, 20.5]), line([13.75, 15.25], [9.75, 19.25]), line([8.75, 10.25], [4.75, 14.25])]);
}
{
  // Shoe print: an oval sole and a heel, angled outward. The heel sits 2.85 from the sole (center to
  // center) and the two heels 3 apart, so nothing merges at 2.1; the print keeps its length.
  const print = (c, tilt) => {
    const at = (dx, dy) => plus(c, rot([dx, dy], [0, 0], tilt));
    return [ell(at(0, 0), 2.6, 3.6, tilt), ell(at(0, 7.9), 2.1, 1.45, tilt)];
  };
  add('footprints', ['huellas', 'pasos', 'rastro', 'footprints', 'steps'], [...print([7.25, 9.5], -12), ...print([16.75, 6.5], 12)]);
}
add('paw', ['huella de mascota', 'pata', 'perro', 'gato', 'paw', 'pet'], [
  roundpoly([[9.5, 12.5], [14.5, 12.5], [18.75, 19.75], [5.25, 19.75]], [2.75, 2.75, 2.25, 2.25]),
  circ(4.75, 11.25, 1.75),
  circ(9, 6, 1.75),
  circ(15, 6, 1.75),
  circ(19.25, 11.25, 1.75),
]);
add('cat', ['gato', 'mascota', 'felino', 'cat', 'pet'], [
  'M4.25 4.25 9.25 8.5H14.75L19.75 4.25V13.5A7.75 7.75 0 0 1 4.25 13.5Z',
  dot(9, 13),
  dot(15, 13),
  line([11, 16.25], [12, 17.1], [13, 16.25]),
]);
{
  // Fish: the body is the logomark's drop with the corner pointing at the tail; the tail, a
  // triangle that starts at that corner.
  const c = [9, 12];
  const r = 5.75;
  const joint = [c[0] + r * Math.SQRT2, c[1]];
  const body = `M${pt(polar(...c, r, -45))}A${N(r)} ${N(r)} 0 1 0 ${pt(polar(...c, r, 45))}L${pt(joint)}Z`;
  add('fish', ['pez', 'pecera', 'mar', 'pesca', 'mascota', 'fish'], [body, roundpoly([joint, [21.25, 8], [21.25, 16]], [0.3, 1, 1]), dot(6.75, 10.75)]);
}
add('tent', ['tienda de campaña', 'acampar', 'campamento', 'tent', 'camping'], [
  roundpoly([[12, 3.5], [21.25, 20.25], [2.75, 20.25]], [1.25, 1.25, 1.25]),
  roundline([[8.5, 20.25], [12, 13], [15.5, 20.25]], [0, 0.6, 0]),
]);
add('volcano', ['volcán', 'erupción', 'montaña', 'volcano', 'eruption'], [
  roundpoly([[2.75, 20.5], [9, 10], [10.5, 11.25], [13.5, 11.25], [15, 10], [21.25, 20.5]], [1, 0.75, 0.4, 0.4, 0.75, 1]),
  line([12, 7.5], [12, 3]),
  line([9, 7.2], [7.25, 4.2]),
  line([15, 7.2], [16.75, 4.2]),
]);
// Water: three waves in phase, with amplitude 1 and period 6 (cubics whose peak is exactly 1). The
// landscapes of round 8 draw their water with this line.
function ripple(y, x0 = 3, n = 6, h = 3, a = 1) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
}
// The middle one, shorter and centered, breaks the repetition of three equal lines.
add('water', ['agua', 'río', 'lago', 'mar', 'oleaje', 'water'], [ripple(7.5), ripple(12, 6, 4), ripple(16.5)]);

// ── Travel ────────────────────────────────────────────────────────────────────────────────────
add('luggage', ['maleta', 'equipaje', 'viaje', 'hospedaje', 'luggage', 'suitcase'], [
  sq(5.25, 6.5, 13.5, 12.5, 3, BR),
  roundline([[9.25, 6.5], [9.25, 3.25], [14.75, 3.25], [14.75, 6.5]], [0, 1, 1, 0]),
  line([9.5, 10], [9.5, 15.5]),
  line([14.5, 10], [14.5, 15.5]),
  line([8.25, 19], [8.25, 21]),
  line([15.75, 19], [15.75, 21]),
]);
{
  // Passport: the booklet (square bottom-right corner) with the globe (ring and meridian, no
  // equator so it doesn't clog up at 18 px) and the data line.
  const g = [12, 10.75];
  const r = 3.75;
  add('passport', ['pasaporte', 'viaje', 'documento de viaje', 'identidad', 'passport', 'travel'], [
    sq(4.75, 2.75, 14.5, 18.5, 3.5, BR),
    circ(...g, r),
    `M${pt([g[0], g[1] - r])}C${pt([g[0] + 2, g[1] - r * 0.55])} ${pt([g[0] + 2, g[1] + r * 0.55])} ${pt([g[0], g[1] + r])}C${pt([g[0] - 2, g[1] + r * 0.55])} ${pt([g[0] - 2, g[1] - r * 0.55])} ${pt([g[0], g[1] - r])}Z`,
    line([9, 17.75], [15, 17.75]),
  ]);
}

// ── Coverage (round 2): what was missing from places, food, weather and objects ──────────────
// Hail: the rain cloud with three hailstones (dots) instead of drops.
add('cloud-hail', ['granizo', 'granizada', 'tormenta de hielo', 'clima', 'hail', 'sleet'], [rainCloud(), dot(8, 18.5), dot(16, 18.5), dot(12, 20.75)]);
{
  // Restaurant: the fork (three tines in a U and the handle rising from the middle one) and the
  // knife (straight spine, curved edge and the handle in line with the spine).
  const fx = 7.75;
  const kx = 15.75;
  add('utensils', ['restaurante', 'comida', 'cubiertos', 'comer', 'restaurant', 'dining', 'food'], [
    `M${N(fx - 3)} 2.75V7a3 3 0 0 0 6 0V2.75`,
    line([fx, 2.75], [fx, 21.25]),
    `M${N(kx)} 14V2.75C${N(kx + 2.25)} 3.6 ${N(kx + 3.5)} 6 ${N(kx + 3.5)} 9.75V12.75a1.25 1.25 0 0 1-1.25 1.25Z`,
    line([kx, 14], [kx, 21.25]),
  ]);
}
{
  // Coffee: the cup (a container: square bottom-right corner), the D-shaped handle and two wisps of
  // steam 3 from the rim (with three they read as «zzz»).
  const wisp = (x) => `M${N(x)} 7C${N(x - 0.8)} 6.25 ${N(x - 0.8)} 5.5 ${N(x)} 4.85S${N(x + 0.8)} 3.5 ${N(x)} 2.75`;
  add('coffee', ['café', 'cafetería', 'taza', 'descanso', 'coffee', 'cafe', 'break'], [
    roundpoly([[4.25, 10], [16.25, 10], [16.25, 21.25], [4.25, 21.25]], [0.75, 0.75, 0, 3.5]),
    roundline([[16.25, 12.5], [19.75, 12.5], [19.75, 17.25], [16.25, 17.25]], [0, 1.75, 1.75, 0]),
    wisp(8.25),
    wisp(12.25),
  ]);
}
{
  // Mortarboard: the board as a diamond, the cap dropping from its edges and the tassel hanging
  // from the right edge, 3 from the cap (the side points, which are sharper, use radius 0.75 so the
  // tassel starts on the straight run).
  const T = [[12, 5], [21.25, 9.75], [12, 14.5], [2.75, 9.75]];
  const k = (T[2][1] - T[3][1]) / (T[2][0] - T[3][0]);
  const yL = T[3][1] + (7.25 - T[3][0]) * k;
  const yT = T[1][1] + (21.25 - 19.75) * k;
  add('graduation-cap', ['birrete', 'graduación', 'educación', 'curso', 'graduation', 'education', 'course'], [
    roundpoly(T, [1, 0.75, 1, 0.75]),
    `M7.25 ${N(yL)}V16.25c0 1.6 2.2 2.75 4.75 2.75s4.75-1.15 4.75-2.75V${N(yL)}`,
    line([19.75, yT], [19.75, 16]),
  ]);
}
{
  // Door: the leaf with a rounded top, standing on the floor, and the knob.
  const leaf = roundline([[6, 21.25], [6, 2.75], [18, 2.75], [18, 21.25]], [0, 2.5, 2.5, 0]);
  const floor = line([3.25, 21.25], [20.75, 21.25]);
  add('door', ['puerta', 'entrada', 'acceso', 'habitación', 'door', 'entrance', 'room'], [leaf, floor, dot(14.25, 12.5)]);
  // Open: the empty frame and the leaf swinging inward on the left-hand hinges (in perspective, its
  // free edge is shorter). No knob: it doesn't fit on the narrow leaf with 1.5 of clearance.
  add('door-open', ['puerta abierta', 'entrar', 'bienvenida', 'check-in', 'door open', 'enter', 'welcome'], [
    roundline([[6, 21.25], [6, 2.75], [18, 2.75], [18, 21.25]], [0, 1.25, 1.25, 0]),
    floor,
    roundline([[6, 4.75], [11.75, 6.5], [11.75, 19.5], [6, 21.25]], [0, 0.75, 0.75, 0]),
  ]);
}
{
  // Recycle: three arrows chasing each other around a triangle; each one bends around a corner and
  // leaves a 3.5 gap before the tail of the next.
  const C = [12, 13.75];
  const V = [-90, 30, 150].map((a) => polar(...C, 10, a));
  const g = 3.5;
  const mid = (a, b) => lerp(a, b, 0.5);
  const arrows = V.flatMap((v, i) => {
    const A = V[(i + 2) % 3];
    const B = V[(i + 1) % 3];
    const start = plus(mid(A, v), scale(unit(sub(v, A)), g / 2));
    const tip = sub(mid(v, B), scale(unit(sub(B, v)), g / 2));
    return [roundline([start, v, tip], [0, 2.5, 0]), head(tip, sub(B, v), 2.75)];
  });
  add('recycle', ['reciclar', 'reciclaje', 'sustentable', 'reutilizar', 'recycle', 'reuse', 'eco'], arrows);
}
{
  // Binoculars: two large lenses at the bottom and, above each one, the body narrowing to the
  // eyepiece (its sides are tangent to the lens); the bridge joins the bodies.
  const y = 15;
  const r = 4;
  /** Point where the line coming down from T touches the circle (C, r); side = 1 outside, -1 inside. */
  const tangent = (T, C, side) => {
    const v = sub(T, C);
    const a = Math.atan2(v[1], v[0]) + side * Math.acos(r / len(v));
    return plus(C, [r * Math.cos(a), r * Math.sin(a)]);
  };
  const body = (cx, s) => {
    const C = [cx, y];
    const outer = [cx - s * 1.75, 5];
    const inner = [cx + s * 1.75, 5];
    return roundline([tangent(outer, C, -s), outer, inner, tangent(inner, C, s)], [0, 1.25, 1.25, 0]);
  };
  // The bridge touches the bodies: its ends are the inner sides at height y = 9.
  const innerAt = (cx, s, yy) => {
    const top = [cx + s * 1.75, 5];
    const foot = tangent(top, [cx, y], s);
    return lerp(top, foot, (yy - top[1]) / (foot[1] - top[1]));
  };
  add('binoculars', ['binoculares', 'explorar', 'descubrir', 'buscar a lo lejos', 'binoculars', 'explore', 'discover'], [
    circ(6.5, y, r),
    circ(17.5, y, r),
    body(6.5, 1),
    body(17.5, -1),
    line(innerAt(6.5, 1, 9), innerAt(17.5, -1, 9)),
  ]);
}
{
  // Dumbbell (gym): two plates, the bar between them and the ends sticking out past them.
  const plate = (x) => sq(x, 5.5, 3.5, 13, 1.5);
  add('dumbbell', ['gimnasio', 'pesas', 'ejercicio', 'entrenar', 'gym', 'fitness', 'workout'], [
    plate(4.75),
    plate(15.75),
    line([8.25, 12], [15.75, 12]),
    line([2.5, 12], [4.75, 12]),
    line([19.25, 12], [21.5, 12]),
  ]);
}

// ── Round 8: places and maps ──────────────────────────────────────────────────────────────────
// Buildings stand on one ground line (GROUND), take the house's roof pitch and carry one marker for
// their institution, as large as the building allows. Landscapes stand on the same ground and draw
// their water with `ripple`. The pin, the folded map and the route are the ones above, and their
// badges are the engine's. Each icon carries its fill, parts and motion where it is drawn: `put`
// takes the fill by index into `d` (or as a path), and `close` shuts the solid outlines.
function put(name, tags, d, { fill, ...extra } = {}) {
  add(name, tags, d, extra);
  if (fill === undefined) return;
  if (fill === false) {
    icons[name].fill = false;
    return;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? d[i] : i));
  icons[name].fill = { solid: pick(fill.solid).map(fill.close ? shut : (x) => x) };
  for (const k of ['cut', 'lines', 'wire']) if (fill[k]) icons[name].fill[k] = pick(fill[k]);
}
/** The badges' center (DESIGN.md › Badges) and the radius inside which a base stroke is cleared. */
const BADGE = [17.25, 17.25];
const BADGE_CLEAR = 7.25;
/** Is every point of the stroke `d` out of the badge's clearance? */
const freeOfBadge = (d) => parse(d).every((s) => s.segs.every((sg) => Array.from({ length: 33 }, (_, i) => at(sg, i / 32)).every((p) => len(sub(p, BADGE)) >= BADGE_CLEAR)));
/** Each badge's gesture, as the rest of the set: signs beat, tools rock, clocks and gears turn. */
const BADGE_MOTION = {
  plus: { effect: 'beat', parts: ['badge'], origin: BADGE },
  check: { effect: 'beat', parts: ['badge'], origin: BADGE },
  star: { effect: 'beat', parts: ['badge'], origin: BADGE },
  search: { effect: 'wiggle', parts: ['badge'], origin: BADGE },
  alert: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  lock: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  edit: { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  clock: { effect: 'spin', parts: ['badge'], origin: BADGE },
  gear: { effect: 'spin', parts: ['badge'], origin: BADGE },
  'arrow-down': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
};

// ── Measuring and dashing a path (a dashed outline is the outline, broken) ───────────────────
function measure(d) {
  const segs = parse(d)[0].segs.map((sg) => {
    const ps = Array.from({ length: 65 }, (_, i) => at(sg, i / 64));
    const acc = [0];
    for (let i = 1; i < ps.length; i++) acc.push(acc[i - 1] + len(sub(ps[i], ps[i - 1])));
    return { ...sg, acc, L: acc[64] };
  });
  let s = 0;
  for (const sg of segs) {
    sg.s = s;
    s += sg.L;
  }
  segs.total = s;
  return segs;
}
const tOf = (sg, u) => {
  let i = 1;
  while (i < 64 && sg.acc[i] < u) i++;
  return (i - 1 + (u - sg.acc[i - 1]) / (sg.acc[i] - sg.acc[i - 1] || 1)) / 64;
};
/** The cubic (a, c1, c2, b) between parameters t0 and t1. */
function cubicPart(sg, t0, t1) {
  const split = (P, t) => {
    const m = (a, b) => lerp(a, b, t);
    const [a, b, c] = [m(P[0], P[1]), m(P[1], P[2]), m(P[2], P[3])];
    const [d, e] = [m(a, b), m(b, c)];
    const g = m(d, e);
    return [[P[0], a, d, g], [g, e, c, P[3]]];
  };
  const left = split([sg.a, sg.c1, sg.c2, sg.b], t1)[0];
  return t1 > 0 ? split(left, t0 / t1)[1] : left;
}
/** The stretch of a measured path between arc lengths s0 and s1 (wrapping around if closed). */
function stretchOf(segs, s0, s1) {
  const T = segs.total;
  const runs = s1 > T + 1e-9 ? [[s0, T], [0, s1 - T]] : [[s0, s1]];
  let out = '';
  for (const [a, b] of runs)
    for (const sg of segs) {
      const lo = Math.max(a, sg.s);
      const hi = Math.min(b, sg.s + sg.L);
      if (hi <= lo + 1e-6) continue;
      const [ta, tb] = [tOf(sg, lo - sg.s), tOf(sg, hi - sg.s)];
      if (!out) out = `M${pt(at(sg, ta))}`;
      if (sg.k === 'L') out += `L${pt(at(sg, tb))}`;
      else if (sg.k === 'A') out += `A${N(sg.r)} ${N(sg.r)} 0 ${Math.abs((tb - ta) * sg.dt) > Math.PI ? 1 : 0} ${sg.dt > 0 ? 1 : 0} ${pt(at(sg, tb))}`;
      else {
        const q = cubicPart(sg, ta, tb);
        out += `C${pt(q[1])} ${pt(q[2])} ${pt(q[3])}`;
      }
    }
  return out;
}
/** The dashes of a closed path: everything but the gaps, each gap [center, width] in arc length. */
function dashed(d, gaps) {
  const segs = measure(d);
  const T = segs.total;
  const g = gaps.map(([c, w]) => [(((c - w / 2) % T) + T) % T, w]).sort((a, b) => a[0] - b[0]);
  return g.map(([s, w], i) => stretchOf(segs, s + w, g[(i + 1) % g.length][0] + (i === g.length - 1 ? T : 0)));
}
/** The arc length along a path of the point nearest to `p`. */
function lengthAt(d, p) {
  let best = [Infinity, 0];
  for (const sg of measure(d))
    for (let i = 0; i <= 64; i++) {
      const e = len(sub(at(sg, i / 64), p));
      if (e < best[0]) best = [e, sg.s + sg.acc[i]];
    }
  return best[1];
}

// ── Pins, maps and routes with a badge ───────────────────────────────────────────────────────
// The pin keeps its hole; at 16 px it takes the pixel pin of map-pin (center on a pixel, r 7.5,
// a 3-pixel hole) and the engine's pixel badge.
const PIN16 = [12.75, 9.75];
const pin16 = (kind) => {
  const d = [pin(PIN16, 7.5), circ(...PIN16, 3)];
  return { d, fill: { solid: [d[0]], cut: [d[1]] }, badge: badge(kind, { size: 16 }) };
};
put('map-pin-minus', ['quitar ubicación', 'eliminar parada', 'borrar lugar', 'remove location', 'remove stop'], pinWith([line([9.25, PIN[1]], [14.75, PIN[1]])]), {
  fill: { solid: [0], cut: [1] },
  parts: { pin: [0], mark: [1] },
  motion: { effect: 'bounce', vector: [0, -2] },
  small: (() => {
    const d = [pin(PIN16, 7.5), line([9.75, 9.75], [15.75, 9.75])];
    return { d, fill: { solid: [d[0]], cut: [d[1]] } };
  })(),
});
for (const [name, kind, tags] of [
  ['map-pin-edit', 'edit', ['editar ubicación', 'corregir dirección', 'mover pin', 'edit location', 'move pin']],
  ['map-pin-search', 'search', ['buscar lugar', 'buscar cerca', 'encontrar dirección', 'find place', 'search nearby']],
  ['map-pin-star', 'star', ['lugar destacado', 'punto de interés', 'favorito', 'point of interest', 'featured place']],
  ['map-pin-alert', 'alert', ['problema de ubicación', 'dirección incorrecta', 'peligro', 'wrong address', 'location issue']],
  ['map-pin-clock', 'clock', ['historial de ubicaciones', 'hora de llegada', 'lugares recientes', 'location history', 'arrival time']],
  ['map-pin-lock', 'lock', ['ubicación privada', 'ubicación protegida', 'privacidad', 'private location', 'location privacy']],
  ['map-pin-gear', 'gear', ['ajustes de ubicación', 'servicios de ubicación', 'permisos', 'location settings', 'location services']],
])
  // The lock clears a taller corner than the round badges: the hole shrinks to r 2 so the lock's
  // clearance passes it by at every weight (at r 2.5 it was cut into a C at the light weights)
  put(name, tags, kind === 'lock' ? pinWith([circ(...PIN, 2)]) : [...icons['map-pin'].d], {
    badge: badge(kind),
    fill: { solid: [0], cut: [1] },
    parts: { pin: [0], hole: [1] },
    motion: BADGE_MOTION[kind],
    small: pin16(kind),
  });
for (const [name, kind, tags] of [
  ['map-plus', 'plus', ['nuevo mapa', 'crear mapa', 'mapa personalizado', 'new map', 'create map']],
  ['map-search', 'search', ['buscar en el mapa', 'buscar en esta zona', 'explorar', 'search map', 'search this area']],
  ['map-edit', 'edit', ['editar mapa', 'sugerir cambio', 'reportar lugar', 'edit map', 'suggest an edit']],
  ['map-arrow-down', 'arrow-down', ['descargar mapa', 'mapa sin conexión', 'offline', 'download map', 'offline map']],
])
  put(name, tags, [...icons.map.d], { badge: badge(kind), fill: { solid: [0], cut: [1, 2] }, parts: { map: [0], folds: [1, 2] }, motion: BADGE_MOTION[kind] });
// The route's path runs through the badge's corner (cleared, it left the ring, a stub and the pin):
// with a badge the route is mirrored, so its pin stands at the top left and its path runs into the
// badge, which takes the place of the start ring.
const ROUTE_BADGED = [flipPath(icons.route.d[1]), flipPath(icons.route.d[2])];
for (const [name, kind, tags] of [
  ['route-plus', 'plus', ['agregar parada', 'nueva parada', 'varias paradas', 'add stop', 'multi-stop']],
  ['route-alert', 'alert', ['problema en la ruta', 'cierre', 'incidente', 'route issue', 'road closure']],
  ['route-check', 'check', ['ruta completada', 'viaje terminado', 'llegada', 'route complete', 'trip done']],
  ['route-clock', 'clock', ['duración del viaje', 'ruta programada', 'hora de salida', 'travel time', 'scheduled route']],
])
  put(name, tags, [...ROUTE_BADGED], { badge: badge(kind), fill: { solid: [1], wire: [0] }, parts: { path: [0], end: [1] }, motion: BADGE_MOTION[kind] });

// ── Geofence ──────────────────────────────────────────────────────────────────────────────────
// A dashed zone (gaps of 3, the corners whole) around a pin. With a badge, the dashes its clearance
// would reach are left out whole, as the rays behind a cloud.
const ZONE_PTS = [[3.25, 10.25], [7.5, 3.5], [16.75, 3], [21, 9.5], [19.5, 20], [5.75, 20.75]];
const ZONE = roundpoly(ZONE_PTS, 2);
const ZONE_DASHES = dashed(
  ZONE,
  ZONE_PTS.flatMap((p, i) => {
    const q = ZONE_PTS[(i + 1) % ZONE_PTS.length];
    return (len(sub(q, p)) > 12 ? [1 / 4, 3 / 4] : [1 / 2]).map((t) => [lengthAt(ZONE, lerp(p, q, t)), 3]);
  }),
);
const ZONE_PIN = [12.25, 10.5];
const zonePin = [pin(ZONE_PIN, 4.25), circ(...ZONE_PIN, 1.75)];
const zoneIx = (ds) => ds.map((_, i) => i + 2);
put('geofence', ['geocerca', 'perímetro', 'zona vigilada', 'límite virtual', 'geofence', 'virtual boundary'], [...zonePin, ...ZONE_DASHES], {
  fill: { solid: [0], cut: [1], lines: zoneIx(ZONE_DASHES) },
  parts: { pin: [0, 1], zone: zoneIx(ZONE_DASHES) },
  motion: { effect: 'bounce', parts: ['pin'], vector: [0, -1.5] },
});
for (const [name, kind, tags] of [
  ['geofence-alert', 'alert', ['salió de la zona', 'alerta de geocerca', 'entró a la zona', 'geofence alert', 'zone breach']],
  ['geofence-plus', 'plus', ['crear geocerca', 'nueva zona', 'agregar perímetro', 'add geofence', 'new zone']],
]) {
  const dashes = ZONE_DASHES.filter(freeOfBadge);
  put(name, tags, [...zonePin, ...dashes], {
    badge: badge(kind),
    fill: { solid: [0], cut: [1], lines: zoneIx(dashes) },
    parts: { pin: [0, 1], zone: zoneIx(dashes) },
    motion: BADGE_MOTION[kind],
  });
}

// ── Map tools ─────────────────────────────────────────────────────────────────────────────────
{
  // A map with a pin standing on its middle panel: the pin goes on top as a custom badge and the
  // engine clears the map's edge and folds around it. Its tip stands beside the right fold: centered,
  // the clearance met the top edge almost tangent and its cut ends ran unevenly with the weight.
  const c = [14.5, 7];
  const top = pin(c, 4.5);
  const hole = circ(...c, 1.75);
  put('map-pinned', ['ver en el mapa', 'lugar guardado', 'ubicación en mapa', 'show on map', 'saved place'], [...icons.map.d], {
    badge: { d: [top, hole], knock: top, fill: { solid: [top], cut: [hole] } },
    fill: { solid: [0], cut: [1, 2] },
    parts: { map: [0], folds: [1, 2] },
    motion: { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  });
}
/** The folded map scaled by k around its center and moved by o: its outline and its two folds. */
const mapAt = (k, o) => {
  const P = (p) => [12 + (p[0] - 12) * k + o[0], 12 + (p[1] - 12) * k + o[1]];
  return [roundpoly(MAP_PTS.map(P), MAP_R.map((r) => r * k)), line(P([9, 4]), P([9, 17.75])), line(P([15, 6.25]), P([15, 20]))];
};
{
  // Map styles: two maps stacked, the front one down and to the right (a custom badge: it clears
  // the back one with its paper). The back map is its outline alone: with its folds too, the strip
  // it shows filled up with stubs and read as a crate.
  // 3 apart across, so no edge of the back map ends on a corner of the front one.
  const k = 0.75;
  const [back] = mapAt(k, [-1.5, -3]);
  const front = mapAt(k, [1.5, 3]);
  put('map-layers', ['capas del mapa', 'estilo de mapa', 'satélite', 'relieve', 'map layers', 'map style'], [back], {
    badge: { d: front, knock: front[0], fill: { solid: [front[0]], cut: front.slice(1) } },
    fill: { solid: [0] },
    parts: { back: [0] },
    motion: { effect: 'slide', parts: ['badge'], vector: [1, 1] },
  });
}
{
  // 3D view: a cube (the core box's construction) standing on a flat ground plane at the same slope;
  // the cube goes on top as a custom badge and hides the plane's back corner.
  const s = 0.54;
  const [w, h] = [4.5, 6.5];
  const base = [12, 16];
  const B = (dx, dy) => [base[0] + dx, base[1] + dy];
  const hull = roundpoly([B(0, -h - 2 * w * s), B(w, -h - w * s), B(w, -w * s), B(0, 0), B(-w, -w * s), B(-w, -h - w * s)], 1);
  const ridge = line(B(-w, -h - w * s), B(0, -h), B(w, -h - w * s));
  const edge = line(B(0, -h), B(0, 0));
  const plane = roundpoly([[2.75, 15.5], [12, 15.5 - 9.25 * s], [21.25, 15.5], [12, 15.5 + 9.25 * s]], 1);
  put('map-3d', ['mapa 3d', 'vista en perspectiva', 'edificios 3d', 'inclinar mapa', '3d map', 'tilt'], [plane], {
    badge: { d: [hull, ridge, edge], knock: hull, fill: { solid: [hull], cut: [ridge, edge] } },
    fill: { solid: [0] },
    parts: { ground: [0] },
    motion: { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  });
}
{
  // Street view: a standing figure (round head, capsule body, 3 apart so they stay apart filled) on a
  // ground ellipse, the body ending 3.5 above its front. The ellipse runs around the front and ends 3
  // short of the body on both sides, the near end in an arc head; its arms are 2.75 (at 3.4 the
  // inner one closed a hole against the tight curve of the ellipse's end at some weights).
  const c = [12, 17];
  const [rx, ry] = [8.75, 3];
  const E = (t) => [c[0] + rx * Math.cos(rad(t)), c[1] + ry * Math.sin(rad(t))];
  const [t0, t1] = [-52, 232];
  const ring = `M${pt(E(t0))}A${N(rx)} ${N(ry)} 0 1 1 ${pt(E(t1))}`;
  const tan = [-rx * Math.sin(rad(t1)), ry * Math.cos(rad(t1))];
  put('street-view', ['vista de calle', 'vista 360', 'a pie de calle', 'panorámica', 'street view', '360 view'], [circ(12, 4.25, 2.25), capsule(9.5, 9.5, 5, 7), ring, head(E(t1), tan, 2.75)], {
    fill: { solid: [0, 1], lines: [2, 3] },
    parts: { person: [0, 1], arrow: [2, 3] },
    motion: { effect: 'bounce', parts: ['person'], vector: [0, -1.5] },
  });
}

// ── Maneuvers ─────────────────────────────────────────────────────────────────────────────────
// navegacion's arrow-turn-left: a stem rising from 20.25 and a head with arms of 5 on each axis (5√2
// at 45°), the bends rounded at r 4.5 (a hairpin at r 2). Each is drawn once, to the left, and its
// right twin is its mirror (flipPath). A maneuver names a physical side, so it never mirrors in
// right-to-left languages.
const HEAD = 5 * Math.SQRT2;
function maneuver(base, [tagsL, tagsR], d, parts, vector) {
  const common = { fill: false, parts, variants: { slash: false } };
  put(`${base}-left`, tagsL, d, { ...common, motion: { effect: 'slide', vector } });
  put(`${base}-right`, tagsR, d.map((p) => flipPath(p)), { ...common, motion: { effect: 'slide', vector: [-vector[0], vector[1]] } });
}
{
  // U-turn: the stem rises, turns 180° over a half circle of r 4.5 and comes back down to the head.
  maneuver('u-turn', [
    ['vuelta en u', 'retorno', 'dar la vuelta', 'u-turn', 'turn around'],
    ['vuelta en u a la derecha', 'retorno', 'dar la vuelta', 'u-turn right', 'turn around'],
  ], ['M19 20.25V8A4.5 4.5 0 0 0 10 8V16.5', head([10, 16.5], [0, 1], HEAD)], { arrow: [0, 1] }, [0, 2]);
  // Slight turn: the stem bends 45° up and to the left.
  const T = [8.25, 4];
  maneuver('turn-slight', [
    ['ligeramente a la izquierda', 'girar levemente', 'desviarse', 'bear left', 'slight left'],
    ['ligeramente a la derecha', 'girar levemente', 'desviarse', 'bear right', 'slight right'],
  ], [roundline([[16.75, 20.25], [16.75, 12.5], T], [0, 4.5, 0]), head(T, [-1, -1], HEAD)], { arrow: [0, 1] }, [-1.5, -1.5]);
  // Sharp turn: the stem bends back 135°, a hairpin, down and to the left.
  const S = [6.5, 11.75];
  maneuver('turn-sharp', [
    ['vuelta cerrada a la izquierda', 'giro pronunciado', 'curva cerrada', 'sharp left', 'hard left'],
    ['vuelta cerrada a la derecha', 'giro pronunciado', 'curva cerrada', 'sharp right', 'hard right'],
  ], [roundline([[17.5, 20.25], [17.5, 0.75], S], [0, 2, 0]), head(S, [-1, 1], HEAD)], { arrow: [0, 1] }, [-1.5, 1.5]);
  // Fork: the stem splits in a Y; the left branch ends in the head, the right one is a plain stub.
  const F = [13, 12];
  const t = 4.5 * Math.tan(rad(22.5));
  const L = [F[0] - 7, F[1] - 7];
  maneuver('keep', [
    ['mantenerse a la izquierda', 'bifurcación', 'carril izquierdo', 'keep left', 'fork left'],
    ['mantenerse a la derecha', 'bifurcación', 'carril derecho', 'keep right', 'fork right'],
  ], [
    line([F[0], 20.25], [F[0], F[1] + t]),
    roundline([[F[0], F[1] + t], F, L], [0, 4.5, 0]),
    roundline([[F[0], F[1] + t], F, [F[0] + 5, F[1] - 5]], [0, 4.5, 0]),
    head(L, [-1, -1], HEAD),
  ], { stem: [0], arrow: [1, 3], branch: [2] }, [-1.5, -1.5]);
  // Exit ramp: the road runs straight on; the arrow leaves its side in a gentle curve.
  const R = [6.75, 5.25];
  maneuver('ramp', [
    ['salida a la izquierda', 'rampa', 'tomar la salida', 'exit left', 'ramp left'],
    ['salida a la derecha', 'rampa', 'tomar la salida', 'exit right', 'ramp right'],
  ], [line([17.25, 20.25], [17.25, 3.25]), `M17.25 15.75C17.25 12 14 9.5 ${pt(plus(R, [3.5, 3.5]))}L${pt(R)}`, head(R, [-1, -1], HEAD)], { road: [0], arrow: [1, 2] }, [-1.5, -1.5]);
  // Roundabout: the stem enters the ring from below, the way runs three quarters around it (the way
  // traffic turns) and peels off at its left side, bending out to the head. A whole ring with the stem
  // and the arrow stuck to it read as a lollipop: nothing went around.
  const C = [15.75, 7.5];
  const r = 3.75;
  const out = C[1] + 2.5;
  maneuver('roundabout', [
    ['glorieta a la izquierda', 'rotonda', 'salida de la glorieta', 'roundabout left', 'traffic circle'],
    ['glorieta a la derecha', 'rotonda', 'salida de la glorieta', 'roundabout right', 'traffic circle'],
  ], [
    `M${pt([C[0], 20.25])}V${N(C[1] + r)}A${r} ${r} 0 1 0 ${pt([C[0] - r, C[1]])}A2.5 2.5 0 0 1 ${pt([C[0] - r - 2.5, out])}H4.25`,
    head([4.25, out], [-1, 0], HEAD),
  ], { arrow: [0, 1] }, [-2, 0]);
}

// ── Map tools (2) ─────────────────────────────────────────────────────────────────────────────
// Legend: a container with three rows, each a different symbol (dot, square, dash) and its line. The
// square is 3 wide, so its hole stays open at 2.1.
put('map-legend', ['leyenda', 'simbología', 'clave del mapa', 'map legend', 'map key', 'symbols'], [
  sq(3.25, 3.25, 17.5, 17.5, 4, BR),
  dot(7.75, 7),
  sq(6.25, 10.5, 3, 3, 0.75),
  line([6.25, 17], [9.25, 17]),
  line([12.25, 7], [16.75, 7]),
  line([12.25, 12], [16.75, 12]),
  line([12.25, 17], [16.75, 17]),
], { fill: { solid: [0], cut: [1, 2, 3, 4, 5, 6] }, parts: { frame: [0], symbols: [1, 2, 3], labels: [4, 5, 6] }, variants: { square: false } });
// Indoor map: a floor plan seen from above, three rooms (the long wall broken by a doorway), and a
// pin standing in the largest, 3 clear of every wall (a pin crossing a wall left stubs of it that
// came and went with the weight).
put('indoor-map', ['mapa interior', 'plano del lugar', 'centro comercial', 'aeropuerto', 'indoor map', 'venue map'], [
  sq(3.25, 3.25, 17.5, 17.5, 4, BR),
  roundline([[3.25, 12], [7.75, 12], [7.75, 3.25]], [0, 0, 0]),
  line([7.75, 17.75], [7.75, 20.75]),
  pin([14.25, 10.75], 3.5),
  dot(14.25, 10.75),
], { fill: { solid: [0], cut: [1, 2, 3, 4] }, parts: { plan: [0], walls: [1, 2], pin: [3, 4] }, motion: { effect: 'bounce', parts: ['pin'], vector: [0, -1.5] }, variants: { square: false } });
// Floor selector: three floor plates (the core layers' construction, flatter) between an up and a
// down chevron.
put('floor-selector', ['selector de piso', 'cambiar de nivel', 'pisos', 'niveles', 'floor selector', 'levels'], [
  line([9.75, 4.5], [12, 2.25], [14.25, 4.5]),
  roundpoly([[12, 7.5], [19.5, 9.25], [12, 11], [4.5, 9.25]], 1),
  line([4.5, 12.25], [12, 14], [19.5, 12.25]),
  line([4.5, 15.25], [12, 17], [19.5, 15.25]),
  line([9.75, 19.5], [12, 21.75], [14.25, 19.5]),
], { fill: { solid: [1], lines: [0, 2, 3, 4] }, parts: { up: [0], floors: [1, 2, 3], down: [4] }, motion: { effect: 'bounce', parts: ['up'], vector: [0, -1.5] } });
{
  // Desk globe: the globe with one meridian, held at a 23° tilt by a half ring on a short stem and
  // a base. The axle's ends join globe and ring.
  const G = [11, 10.25];
  const [r, R] = [5.5, 8.5];
  const ax = [Math.sin(rad(23)), -Math.cos(rad(23))];
  const at2 = (k) => plus(G, scale(ax, k));
  const meridian = `M${pt(at2(r))}A2.4 ${N(r)} 23 0 1 ${pt(at2(-r))}`;
  put('globe-stand', ['globo terráqueo', 'geografía', 'mundo', 'escuela', 'desk globe', 'world'], [
    circ(...G, r),
    meridian,
    `M${pt(at2(R))}A${N(R)} ${N(R)} 0 0 1 ${pt(at2(-R))}`,
    line(at2(r), at2(R)),
    line(polar(...G, R, 90), [G[0], 21.25]),
    line([7.25, 21.25], [14.75, 21.25]),
  ], { fill: { solid: [0], cut: [1], wire: [2, 3, 4, 5] }, parts: { globe: [0, 1], arm: [2, 3], stand: [4, 5] }, motion: { effect: 'spin', parts: ['globe'], origin: G }, variants: { circle: false } });
}
{
  // Compass rose: long north-south and east-west points, four short diagonal ones between them, and
  // the center.
  const C = [12, 12];
  const P = Array.from({ length: 16 }, (_, i) => polar(...C, i % 2 ? 2.75 : i % 4 ? 5.75 : 9.25, -90 + i * 22.5));
  put('compass-rose', ['rosa de los vientos', 'puntos cardinales', 'orientación', 'norte', 'compass rose', 'cardinal directions'], [
    roundpoly(P, P.map((_, i) => (i % 2 ? 0.5 : 0.3))),
    dot(...C),
  ], { fill: { solid: [0], cut: [1] }, parts: { rose: [0], center: [1] }, motion: { effect: 'spin', origin: C }, variants: { circle: false } });
}
{
  // Scale bar: a bar in four segments (the first and third fill), ticks rising at its ends and middle.
  const bar = sq(2.75, 13, 18.5, 4, 0);
  const xs = [7.375, 12, 16.625];
  put('scale-bar', ['escala', 'escala gráfica', 'distancia', 'unidades', 'scale bar', 'map scale'], [
    bar,
    ...xs.map((x) => line([x, 13], [x, 17])),
    line([2.75, 13], [2.75, 8.5]),
    line([12, 13], [12, 9.75]),
    line([21.25, 13], [21.25, 8.5]),
  ], {
    // Filled, the first and third segments go solid and the bar, its dividers and the ticks stay
    // lines (the whole bar filled lost its segments)
    fill: { solid: [sq(2.75, 13, 4.625, 4, 0), sq(12, 13, 4.625, 4, 0)], wire: [0, 1, 2, 3, 4, 5, 6] },
    parts: { bar: [0, 1, 2, 3], ticks: [4, 5, 6] },
  });
}
{
  // Coordinates: a two-by-two grid and a pin standing on its lower right crossing (a custom badge:
  // it clears the grid around it; the line under it starts inside its clearance, so nothing of it is
  // left above the pin at any weight).
  const c = [15.75, 15.75 - 4 * Math.SQRT2];
  const top = pin(c, 4);
  const hole = circ(...c, 1.5);
  put('coordinates', ['coordenadas', 'latitud y longitud', 'gps', 'copiar ubicación', 'coordinates', 'lat long'], [
    line([8.25, 3.25], [8.25, 20.75]),
    line([15.75, 5.5], [15.75, 20.75]),
    line([3.25, 8.25], [12.25, 8.25]),
    line([3.25, 15.75], [20.75, 15.75]),
  ], {
    badge: { d: [top, hole], knock: top, fill: { solid: [top], cut: [hole] } },
    fill: false,
    parts: { grid: [0, 1, 2, 3] },
    motion: { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  });
}
{
  // Latitude and longitude: the globe's ring with only its parallels (seen from a little above,
  // they sag) or only its meridians (the axis and a lens).
  const chord = (y) => Math.sqrt(81 - (y - 12) ** 2);
  const parallel = (y) => `M${pt([12 - chord(y), y])}A${N(chord(y))} 1.25 0 0 0 ${pt([12 + chord(y), y])}`;
  put('latitude', ['latitud', 'paralelos', 'ecuador', 'coordenadas', 'latitude', 'parallels'], [circ(12, 12, 9), parallel(7), parallel(12), parallel(17)], {
    fill: { solid: [0], cut: [1, 2, 3] },
    parts: { globe: [0], parallels: [1, 2, 3] },
    variants: { circle: false },
  });
  const R = (81 + 4 ** 2) / 8;
  put('longitude', ['longitud', 'meridianos', 'husos horarios', 'coordenadas', 'longitude', 'meridians'], [
    circ(12, 12, 9),
    line([12, 3], [12, 21]),
    `M12 3A${N(R)} ${N(R)} 0 0 1 12 21A${N(R)} ${N(R)} 0 0 1 12 3Z`,
  ], { fill: { solid: [0], cut: [1, 2] }, parts: { globe: [0], meridians: [1, 2] }, variants: { circle: false } });
}

// ── Map tools (3): areas, measures and routes ─────────────────────────────────────────────────
/** A smooth closed curve through the points (Catmull-Rom as cubics). */
function smoothClosed(P) {
  const n = P.length;
  let d = `M${pt(P[0])}`;
  for (let i = 0; i < n; i++) {
    const [a, b, c, e] = [P[(i - 1 + n) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]];
    d += `C${pt(plus(b, scale(sub(c, a), 1 / 6)))} ${pt(sub(c, scale(sub(e, b), 1 / 6)))} ${pt(c)}`;
  }
  return `${d}Z`;
}
/** A smooth open curve through the points (Catmull-Rom as cubics, its ends held). */
function smoothOpen(P) {
  const n = P.length;
  let d = `M${pt(P[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const [a, b, c, e] = [P[Math.max(0, i - 1)], P[i], P[i + 1], P[Math.min(n - 1, i + 2)]];
    d += `C${pt(plus(b, scale(sub(c, a), 1 / 6)))} ${pt(sub(c, scale(sub(e, b), 1 / 6)))} ${pt(c)}`;
  }
  return d;
}
/** A loop around `c` whose radius at each angle is `r(θ)` (degrees), through 16 points. */
const loop = (c, r) => smoothClosed(Array.from({ length: 16 }, (_, i) => polar(...c, r(i * 22.5), i * 22.5)));
{
  // Distance: two point rings and the dimension line between them, a head at each end touching
  // the rings.
  const [A, B] = [[5.25, 18.75], [18.75, 5.25]];
  const u = unit(sub(B, A));
  const [p, q] = [plus(A, scale(u, 2.25)), sub(B, scale(u, 2.25))];
  put('measure-distance', ['medir distancia', 'regla', 'distancia entre puntos', 'measure distance', 'ruler', 'distance'], [
    circ(...A, 2.25),
    circ(...B, 2.25),
    line(p, q),
    head(p, sub(A, B), 4.25),
    head(q, sub(B, A), 4.25),
  ], { fill: { solid: [0, 1], wire: [2, 3, 4] }, parts: { points: [0, 1], line: [2, 3, 4] }, variants: { slash: false } });
}
{
  // Elevation profile: the ground rising and falling inside a chart's axes; filled, the area under
  // it is solid. A chart that runs along the way: it mirrors in right-to-left languages.
  const P = [[6.5, 16.5], [9.5, 10.25], [12.25, 13.5], [15.5, 6.25], [18.25, 11.25], [20.75, 9.5]];
  const profile = roundline(P, [0, 0.75, 0.75, 0.75, 0.75, 0]);
  put('elevation-profile', ['perfil de elevación', 'desnivel', 'altimetría', 'ruta de montaña', 'elevation profile', 'elevation gain'], [
    roundline([[3.25, 3.25], [3.25, 20.75], [20.75, 20.75]], [0, 2, 0]),
    profile,
  ], { fill: { solid: [`${profile}L20.75 20.75L6.5 20.75Z`], wire: [0] }, parts: { axes: [0], profile: [1] }, mirror: true });
}
{
  // Altitude: a mountain with a lower shoulder rising from the water (its feet on two crests, so the
  // wave's clearance takes them whole at every weight), and an arrow standing on a trough of the water up to the summit's level. The water and
  // the arrow go in front as a custom badge: the wave clears the mountain's foot with its paper, so
  // filled it leaves no holes between the two that shut with the weight. A single peak with a dimension line ticked at both ends read as
  // the letters «AI».
  const water = ripple(19.75, 3, 6, 3);
  const measure = [line([19.5, 20.75], [19.5, 5.75]), head([19.5, 5.75], [0, -1], 3.4)];
  const peak = roundline([[4.5, 18.75], [9.75, 5.75], [12.25, 10.5], [13.75, 9], [16.5, 18.75]], [0, 1.25, 0.6, 0.75, 0]);
  put('altitude', ['altitud', 'altura sobre el nivel del mar', 'altímetro', 'elevación', 'altitude', 'elevation'], [peak], {
    badge: { d: [water, ...measure], knock: water },
    fill: { solid: [`${peak}Z`] },
    parts: { mountain: [0] },
  });
}
{
  // Contour lines: a hill from above, three nested loops. The summit is an elongated, tilted oval
  // and each line runs 3.25 outside the one within (its parallel curve), so they round out downhill
  // as real ones do and never come closer than 3.25 (the same shape scaled came within 2.5).
  const n = 72;
  const core = Array.from({ length: n }, (_, i) => polar(12, 12, 2.25 * (1 + 0.3 * Math.cos(rad(2 * (i * 5 + 25)))), i * 5));
  const grow = (d) =>
    core.map((p, i) => {
      const t = unit(sub(core[(i + 1) % n], core[(i - 1 + n) % n]));
      return plus(p, scale([t[1], -t[0]], d));
    });
  const ring = (d) => smoothClosed(grow(d).filter((_, i) => i % 2 === 0));
  put('contour-lines', ['curvas de nivel', 'topografía', 'relieve', 'mapa topográfico', 'contour lines', 'topographic'], [
    ring(6.5),
    ring(3.25),
    ring(0),
  ], { fill: { solid: [0], cut: [1, 2] }, parts: { lines: [0, 1, 2] }, variants: { circle: false } });
}
{
  // Satellite view: a satellite (a small body between two long solar panels on short arms, tilted
  // along its orbit) above a wide arc of the Earth. The arms are 2.5 long and each panel is split into
  // two cells of 3 across its length (an arm running through each panel as its spine turned the pieces
  // into the links of a chain).
  const S = [12, 9];
  const T = (u, v) => plus(S, rot([u, v], [0, 0], -30));
  const box = (u0, u1, v, r) => roundpoly([T(u0, -v), T(u1, -v), T(u1, v), T(u0, v)], r);
  const Rr = 16;
  const ex = 9.25;
  const ey = 35.25 - Math.sqrt(Rr * Rr - ex * ex);
  put('satellite-view', ['vista satelital', 'satélite', 'imagen aérea', 'capa satelital', 'satellite view', 'aerial'], [
    box(-1.75, 1.75, 1.75, 1),
    box(4.25, 10.25, 2.25, 0.6),
    box(-10.25, -4.25, 2.25, 0.6),
    line(T(1.75, 0), T(4.25, 0)),
    line(T(-1.75, 0), T(-4.25, 0)),
    line(T(7.25, -2.25), T(7.25, 2.25)),
    line(T(-7.25, -2.25), T(-7.25, 2.25)),
    `M${pt([12 - ex, ey])}A${Rr} ${Rr} 0 0 1 ${pt([12 + ex, ey])}`,
  ], {
    fill: { solid: [0, 1, 2], wire: [3, 4], cut: [5, 6], lines: [7] },
    parts: { satellite: [0, 1, 2, 3, 4, 5, 6], earth: [7] },
    motion: { effect: 'float', parts: ['satellite'], vector: [1.5, -0.75] },
  });
}
{
  // Location and heading: the dot in its ring and a wide beam whose sides point at the dot, standing
  // 3 clear of the ring (a narrow beam that grew out of the ring read as a medal on its ribbon).
  const c = [12, 16];
  const [r, r0, r1, h] = [3, 6, 13, 45];
  const P = (k, a) => polar(...c, k, -90 + a);
  const beam = `M${pt(P(r0, -h))}L${pt(P(r1, -h))}A${r1} ${r1} 0 0 1 ${pt(P(r1, h))}L${pt(P(r0, h))}A${r0} ${r0} 0 0 0 ${pt(P(r0, -h))}Z`;
  put('location-heading', ['orientación', 'dirección a la que miras', 'brújula del mapa', 'rumbo', 'location heading', 'facing direction'], [
    circ(...c, r),
    dot(...c),
    beam,
  ], {
    fill: { solid: [0, 2], cut: [1] },
    parts: { location: [0, 1], beam: [2] },
    value: { turn: { parts: ['beam'], origin: c, from: -90, to: 270, at: -90 } },
  });
}
{
  // Live location: the pin broadcasting, two arcs on each side.
  const c = [12, 10.25];
  const arcs = [7.25, 10.25].flatMap((r) => [arcd(...c, r, -25, 25), arcd(...c, r, 155, 205)]);
  put('map-pin-live', ['ubicación en vivo', 'compartir ubicación', 'rastreo en tiempo real', 'live location', 'real-time tracking'], [pin(c, 4.25), circ(...c, 1.75), ...arcs], {
    fill: { solid: [0], cut: [1], lines: [2, 3, 4, 5] },
    parts: { pin: [0, 1], waves: [2, 3, 4, 5] },
    levels: [[2, 3], [4, 5]],
    motion: { effect: 'beat', parts: ['waves'], origin: c },
  });
}
{
  // Waypoint: a diamond marker with its center sitting on a dashed path (gaps of 3).
  const c = [12, 11.25];
  const h = 6;
  const y = c[1] + h;
  put('waypoint', ['punto de paso', 'waypoint', 'parada intermedia', 'punto guardado', 'gps waypoint', 'track point'], [
    roundpoly([[c[0], c[1] - h], [c[0] + h, c[1]], [c[0], y], [c[0] - h, c[1]]], [1, 1, 0.75, 1]),
    dot(...c),
    line([3.25, y], [6.75, y]),
    line([9.75, y], [14.25, y]),
    line([17.25, y], [20.75, y]),
  ], { fill: { solid: [0], cut: [1], wire: [3], lines: [2, 4] }, parts: { marker: [0, 1], path: [2, 3, 4] }, motion: { effect: 'bounce', parts: ['marker'], vector: [0, -1.5] } });
}
// Theodolite: the telescope lying on a boxy head and reaching out in front of it, on a tripod.
put('theodolite', ['teodolito', 'topografía', 'agrimensura', 'estación total', 'theodolite', 'surveying'], [
  capsule(9.25, 4.75, 10.5, 3),
  roundline([[8.25, 7.75], [8.25, 12.75], [15.25, 12.75], [15.25, 7.75], [8.25, 7.75]], [0, 1.5, 1.5, 0, 0]),
  line([11.75, 12.75], [5.25, 21]),
  line([11.75, 12.75], [11.75, 21]),
  line([11.75, 12.75], [18.25, 21]),
], { fill: { solid: [0, 1], wire: [2, 3, 4], close: true }, parts: { telescope: [0], head: [1], tripod: [2, 3, 4] } });
{
  // Alternative route: the route's start ring and end pin, joined by two paths that split at the
  // ring and meet below the pin: one solid, one dashed (three dashes, gaps of 3).
  const tip = [17.5, 6 + 3.4 * Math.SQRT2];
  const other = roundline([[5.5, 16.25], [5.5, 12.75], [17.5, 12.75]], [0, 2.25, 0]);
  const segs = measure(other);
  const dash = (segs.total - 6) / 3;
  put('route-alternate', ['ruta alternativa', 'otra ruta', 'desvío', 'opciones de ruta', 'alternate route', 'reroute'], [
    circ(5.5, 18.5, 2.25),
    roundline([[7.75, 18.5], [17.5, 18.5], tip], [0, 2.25, 0]),
    pin([17.5, 6], 3.4),
    ...[0, 1, 2].map((i) => stretchOf(segs, i * (dash + 3), i * (dash + 3) + dash)),
  ], { fill: { solid: [0, 2], wire: [1, 5], lines: [3, 4] }, parts: { start: [0], route: [1], end: [2], alternate: [3, 4, 5] } });
}
{
  // Loop route: a closed irregular loop with its direction (an arc head on it, at the upper right)
  // and the start ring on it at the bottom (a custom badge: it clears the loop on both sides).
  const c = [12, 12];
  const R = (t) => 8.25 * (1 + 0.08 * Math.cos(rad(2 * t + 20)) + 0.06 * Math.cos(rad(3 * t)));
  const L = loop(c, R);
  const segs = measure(L);
  const pointAt = (u) => {
    const sg = segs.find((g) => u <= g.s + g.L) ?? segs.at(-1);
    return at(sg, tOf(sg, u - sg.s));
  };
  const s = lengthAt(L, [20.5, 9]);
  const tip = pointAt(s);
  const ring = circ(...polar(...c, R(110), 110), 2.25);
  put('route-loop', ['ruta circular', 'circuito', 'vuelta completa', 'recorrido cerrado', 'loop route', 'circuit'], [L, head(tip, sub(tip, pointAt(s - 1)), 3.4)], {
    badge: { d: [ring], knock: ring, fill: { solid: [ring] } },
    fill: false,
    parts: { route: [0, 1] },
    motion: { effect: 'spin', parts: ['route'], origin: c },
  });
}
{
  // Out and back: from the start ring the path goes out, turns around a half circle and comes back
  // alongside itself; a head on each leg, staggered so their inner arms stay 4 apart.
  put('route-out-and-back', ['ida y vuelta', 'regreso por el mismo camino', 'sendero', 'out and back', 'return trip', 'trail'], [
    circ(9, 19, 2.25),
    'M9 16.75V8A3 3 0 0 1 15 8V20.25',
    head([9, 8.75], [0, -1], 3.4),
    head([15, 17.5], [0, 1], 3.4),
  ], { fill: { solid: [0], wire: [1, 2, 3] }, parts: { start: [0], route: [1], arrows: [2, 3] } });
}

// ── Buildings ─────────────────────────────────────────────────────────────────────────────────
// One construction: every building stands on the ground line (GROUND, from 2.75 to 21.25), gabled
// roofs take the house's pitch (PITCH: 7.75 down for 9.25 across) and its eaves, flat roofs round
// their top corners at r 2.5 as the house's walls, and each carries one marker for its institution,
// as large as the building allows, 3 clear of its walls. A flat roof is a slab overhanging the
// walls by 1.5 (the gable's eaves, flat), narrower than the ground.
const GROUND = 20.75;
const PITCH = 7.75 / 9.25;
const ground = (x0 = 2.75, x1 = 21.25) => line([x0, GROUND], [x1, GROUND]);
/** A gabled roof from x0 to x1 (eaves included) whose ridge is at `apex`; and its height at x. */
const gableAt = (apex, x) => apex[1] + Math.abs(x - apex[0]) * PITCH;
const gable = (apex, x0, x1) => roundline([[x0, gableAt(apex, x0)], apex, [x1, gableAt(apex, x1)]], [0, 1.25, 0]);
/** Walls standing on the ground under a gable (they start where they meet the roof). */
const gableWalls = (apex, x0, x1) => [line([x0, gableAt(apex, x0)], [x0, GROUND]), line([x1, gableAt(apex, x1)], [x1, GROUND])];
/** A flat-roofed body: the slab at y, 1.5 past the walls at x0 and x1 that stand under it. */
const flatBody = (x0, x1, y) => [line([x0 - 1.5, y], [x1 + 1.5, y]), line([x0, y], [x0, GROUND]), line([x1, y], [x1, GROUND])];
const flatFill = (x0, x1, y) => sq(x0, y, x1 - x0, GROUND - y, 0);
/** A door standing on the ground: w wide, its top at y, corners of r. */
const doorway = (cx, w, y, r = 1) => roundline([[cx - w / 2, GROUND], [cx - w / 2, y], [cx + w / 2, y], [cx + w / 2, GROUND]], [0, r, r, 0]);
/** An arch standing on the ground: w wide, its crown at y. */
const archway = (cx, w, y) => `M${pt([cx - w / 2, GROUND])}V${N(y + w / 2)}A${N(w / 2)} ${N(w / 2)} 0 0 1 ${pt([cx + w / 2, y + w / 2])}V${N(GROUND)}`;
/** A five-pointed star (police, favorites) around c. */
const star5 = (c, R, r = R * 0.47) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(...c, i % 2 ? r : R, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.4 : 0.7)));
/** The core mail, scaled: an envelope (square bottom-right corner) and its flap, which starts on
 *  the top edge (at this size the core's flap ended 1.6 short of it). */
const envelope = (x, y, w, h) => [sq(x, y, w, h, Math.min(w, h) / 3.5, BR), line([x + w * 0.24, y], [x + w / 2, y + h * 0.54], [x + w * 0.76, y])];

// Post office: a flat-roofed building with one large envelope on its front (with a door below it
// too, it was too dense to read at 18 px).
put('post-office', ['oficina de correos', 'correo', 'paquetería', 'envíos', 'post office', 'mail'], [
  ...flatBody(5.25, 18.75, 3.75),
  ground(),
  ...envelope(8.25, 8.5, 7.5, 6),
], { fill: { solid: [flatFill(5.25, 18.75, 3.75)], wire: [0, 3], cut: [4, 5] }, parts: { building: [0, 1, 2], ground: [3], envelope: [4, 5] } });
// Police station: a flat-roofed building, a large star badge on its front and a short door below.
put('police-station', ['estación de policía', 'comisaría', 'seguridad', 'denuncia', 'police station', 'police'], [
  ...flatBody(5.25, 18.75, 2.75),
  ground(),
  star5([12, 9.75], 3.75),
  doorway(12, 3.5, 16),
], { fill: { solid: [flatFill(5.25, 18.75, 2.75)], wire: [0, 3], cut: [4, 5] }, parts: { building: [0, 1, 2], ground: [3], badge: [4], door: [5] } });
{
  // Fire station: a wide gable, two tall arched garage doors and the flame in the gable.
  const apex = [12, 2.5];
  const [f] = flame([12, 10.75], 2.5, [12.4, 6.6]);
  put('fire-station', ['estación de bomberos', 'bomberos', 'emergencias', 'incendio', 'fire station', 'firefighters'], [
    gable(apex, 2.75, 21.25),
    ...gableWalls(apex, 3.5, 20.5),
    ground(),
    archway(8.5, 4, 15),
    archway(15.5, 4, 15),
    f,
  ], { fill: { solid: [`${gable(apex, 2.75, 21.25)}L20.5 ${N(gableAt(apex, 20.5))}V${GROUND}H3.5V${N(gableAt(apex, 3.5))}Z`], wire: [3], cut: [4, 5, 6] }, parts: { roof: [0], walls: [1, 2], ground: [3], doors: [4, 5], flame: [6] } });
}
{
  // Library: the house's gable over three tall book spines standing on the ground, the last one
  // leaning on the second: its corner crosses into it (just touching, it came apart at light) and
  // its foot stands 3 from it, so the wedge between them stays open at every weight.
  const apex = [12, 3.5];
  const lean = 30;
  const L = 8.25;
  const base = [16.25, GROUND];
  const B = (dx, dy) => plus(base, rot([dx, dy], [0, 0], -lean));
  put('library', ['biblioteca', 'libros', 'lectura', 'préstamo', 'library', 'books'], [
    gable(apex, 2.75, 21.25),
    ground(),
    sq(5.25, 13, 3.75, 7.75, 0.75),
    sq(9, 10.25, 3.75, 10.5, 0.75),
    roundpoly([B(0, 0), B(3.75, 0), B(3.75, -L), B(0, -L)], [0, 0.75, 0.75, 0.75]),
  ], {
    // Filled, the books are solid and their shared edge is knocked out; the roof stays a line
    // (closed along its eaves, it swallowed the tallest book)
    fill: { solid: [2, 3, 4], wire: [0, 1], cut: [line([9, 12], [9, 19.75])] },
    parts: { roof: [0], ground: [1], books: [2, 3, 4] },
  });
}
{
  // Museum: a pediment (the house's pitch) wide enough to overhang its front like a temple's, over
  // one large picture frame and its mat, on a step that runs wider than the frame. (A pediment as
  // narrow as a tall frame read as a birdhouse, and filled as a headstone.)
  const apex = [12, 2.25];
  const [x0, x1] = [6.25, 17.75];
  const y0 = gableAt(apex, 4.25);
  const ped = roundpoly([[4.25, y0], apex, [19.75, y0]], [0.75, 1.25, 0.75]);
  put('museum', ['museo', 'galería', 'exposición', 'arte', 'museum', 'gallery'], [
    ped,
    sq(x0, y0, x1 - x0, 17.75 - y0, 0),
    sq(x0 + 3, y0 + 3, x1 - x0 - 6, 17.75 - y0 - 6, 0.5),
    roundline([[4.25, GROUND], [4.25, 17.75], [19.75, 17.75], [19.75, GROUND]], [0, 0.75, 0.75, 0]),
    ground(),
  ], { fill: { solid: [0, 1, 3], cut: [2], wire: [4], close: true }, parts: { pediment: [0], frame: [1, 2], step: [3], ground: [4] } });
}
{
  // Place of worship: a gabled hall and, at its side, a tall bell tower whose open belfry holds a
  // bell; nothing on top of the tower but its roof. No religious symbol: it serves every faith.
  const [t0, t1] = [11.75, 20.5];
  const tApex = [(t0 + t1) / 2, 2.25];
  const hApex = [7, 8.5];
  const floor = 12.25;
  const bx = tApex[0];
  const bell = `M${pt([bx - 1.75, 10])}L${pt([bx - 1.25, 7.5])}A1.25 1.25 0 0 1 ${pt([bx + 1.25, 7.5])}L${pt([bx + 1.75, 10])}Z`;
  const hallRoof = gable(hApex, 2.75, t0);
  put('place-of-worship', ['lugar de culto', 'templo', 'iglesia', 'mezquita', 'sinagoga', 'place of worship'], [
    hallRoof,
    line([4, gableAt(hApex, 4)], [4, GROUND]),
    gable(tApex, t0 - 0.75, t1 + 0.75),
    line([t0, gableAt(tApex, t0)], [t0, GROUND]),
    line([t1, gableAt(tApex, t1)], [t1, GROUND]),
    line([t0, floor], [t1, floor]),
    bell,
    ground(),
    doorway(7.25, 3, 17.5),
  ], {
    // Filled, the hall and the tower's shaft are solid (the tower's wall between them knocked out),
    // the belfry stays open around its bell and the tower's roof closes along its eaves
    fill: {
      solid: [`${hallRoof}L${t0} ${GROUND}H4V${N(gableAt(hApex, 4))}Z`, sq(t0, floor, t1 - t0, GROUND - floor, 0), `${gable(tApex, t0 - 0.75, t1 + 0.75)}Z`, 6],
      wire: [3, 4, 7],
      cut: [line([t0, gableAt(hApex, t0) + 0.75], [t0, GROUND]), 8],
    },
    parts: { hall: [0, 1, 8], tower: [2, 3, 4, 5], bell: [6], ground: [7] },
    motion: { effect: 'ring', parts: ['bell'], origin: [bx, 6.25] },
  });
}
{
  // Community center: one wide roof (the house's) sheltering two people, heads and shoulders,
  // standing on the ground.
  const apex = [12, 3.25];
  const bust = (x) => [circ(x, 12.75, 2), `M${pt([x - 2.75, GROUND])}V20A2.75 2.75 0 0 1 ${pt([x + 2.75, 20])}V${N(GROUND)}`];
  put('community-center', ['centro comunitario', 'casa de la cultura', 'vecinos', 'comunidad', 'community center', 'civic center'], [
    gable(apex, 2.75, 21.25),
    ground(),
    ...bust(7.75),
    ...bust(16.25),
  ], { fill: { solid: [2, 3, 4, 5], wire: [0, 1], close: true }, parts: { roof: [0], ground: [1], people: [2, 3, 4, 5] } });
}

// ── Towers ────────────────────────────────────────────────────────────────────────────────────
// Skyscraper: one slender tower that steps in twice toward its short spire; its windows are the
// office building's (r 0.3 dots in two columns).
put('skyscraper', ['rascacielos', 'torre', 'edificio alto', 'corporativo', 'skyscraper', 'high-rise'], [
  roundpoly([[7.75, GROUND], [7.75, 9.75], [9.25, 9.75], [9.25, 6], [10.5, 6], [10.5, 3.75], [13.5, 3.75], [13.5, 6], [14.75, 6], [14.75, 9.75], [16.25, 9.75], [16.25, GROUND]], [0, 0.5, 0.5, 0.5, 0.5, 0.75, 0.75, 0.5, 0.5, 0.5, 0.5, 0]),
  line([12, 3.75], [12, 1.75]),
  ground(),
  ...[12.5, 16.25].flatMap((y) => [10.25, 13.75].map((x) => dot(x, y, 0.3))),
], { fill: { solid: [0], wire: [1, 2], cut: [3, 4, 5, 6] }, parts: { tower: [0], spire: [1], ground: [2], windows: [3, 4, 5, 6] } });
{
  // Castle: a wall between two taller towers, all crowned with battlements (notches of 3), and an
  // arched gate in the middle of the wall.
  const t = 4.25;
  const w = 9.5;
  const notch = 1.75;
  const P = [
    [2.75, GROUND], [2.75, t], [4.25, t], [4.25, t + notch], [7.25, t + notch], [7.25, t], [8.75, t],
    [8.75, w], [10.5, w], [10.5, w + notch], [13.5, w + notch], [13.5, w], [15.25, w],
    [15.25, t], [16.75, t], [16.75, t + notch], [19.75, t + notch], [19.75, t], [21.25, t], [21.25, GROUND],
  ];
  put('castle', ['castillo', 'fortaleza', 'patrimonio', 'reino', 'castle', 'fortress'], [
    roundpoly(P, P.map((_, i) => (i === 0 || i === P.length - 1 ? 0 : 0.4))),
    archway(12, 4, 14.75),
  ], { fill: { solid: [0], cut: [1] }, parts: { castle: [0], gate: [1] } });
}

{
  // Observation tower: a thin shaft flaring at its foot, a disc pod two thirds up and a short antenna.
  const pod = ell([12, 7.75], 4.75, 2);
  const podLow = 7.75 + 2 * Math.sqrt(1 - (1.5 / 4.75) ** 2);
  const side = `M10.5 ${N(podLow)}V14C10.5 17.5 8.75 20 6.75 ${GROUND}`;
  put('observation-tower', ['torre mirador', 'torre de televisión', 'mirador', 'skyline', 'observation tower', 'tv tower'], [
    pod,
    line([12, 5.75], [12, 2]),
    side,
    flipPath(side),
    ground(),
  ], {
    fill: { solid: [0, `${side}H17.25C15.25 20 13.5 17.5 13.5 14V${N(podLow)}Z`], wire: [1, 4] },
    parts: { pod: [0], antenna: [1], shaft: [2, 3], ground: [4] },
  });
}
// Lifeguard tower: a hut under a sloping roof, raised on splayed legs, a ladder up the middle.
put('lifeguard-tower', ['torre de salvavidas', 'salvavidas', 'playa vigilada', 'socorrista', 'lifeguard tower', 'lifeguard'], [
  roundpoly([[7, 11.5], [7, 6.5], [17, 4.25], [17, 11.5]], [0.5, 1, 1, 0.5]),
  line([5.5, 6.84], [18.5, 3.91]),
  line([7.5, 11.5], [5.25, GROUND]),
  line([16.5, 11.5], [18.75, GROUND]),
  `M10.5 11.5V${GROUND}M13.5 11.5V${GROUND}`,
  'M10.5 14.5H13.5M10.5 17.5H13.5',
  ground(),
], { fill: { solid: [0], wire: [1, 2, 3, 4, 5, 6] }, parts: { hut: [0, 1], legs: [2, 3], ladder: [4, 5], ground: [6] } });

// ── Bridges ───────────────────────────────────────────────────────────────────────────────────
// One base: the deck at 9.5 across the whole width and the water (the landscapes' wave) far below
// it; each bridge adds what carries the deck. The stone bridge's deck is the top of its body.
const DECK = 9.5;
const deck = () => line([2.75, DECK], [21.25, DECK]);
const RIVER = ripple(21, 4.5, 5);
put('bridge', ['puente', 'cruce', 'río', 'puente cerrado', 'bridge', 'crossing'], [
  `M2.75 ${DECK}H21.25V17H18.25A6.25 4.5 0 0 0 5.75 17H2.75Z`,
  RIVER,
], { fill: { solid: [0], wire: [1] }, parts: { bridge: [0], water: [1] } });
put('bridge-suspension', ['puente colgante', 'puente de suspensión', 'cruce', 'costa', 'suspension bridge', 'bridge'], [
  deck(),
  line([7, 2.25], [7, 17]),
  line([17, 2.25], [17, 17]),
  `M2.75 ${DECK}L7 2.25Q12 10.75 17 2.25L21.25 ${DECK}`,
  line([10, 5.82], [10, DECK]),
  line([14, 5.82], [14, DECK]),
  RIVER,
], { fill: false, parts: { deck: [0], towers: [1, 2], cable: [3, 4, 5], water: [6] } });
{
  // Tunnel: a mountain of two peaks standing on the ground, a round-arched portal at its foot and the
  // lane line running out of it. (A rounded hill over a wide portal, its lanes splaying from it, read
  // as a hooded figure on two legs; the cave is the low mound with an irregular mouth and no road.)
  const slope = roundline([[21.25, GROUND], [16, 4.5], [12.75, 8.75], [8.5, 6], [2.75, GROUND]], [0, 1.25, 0.75, 1.25, 0]).replace(/^M[^L]+/, '');
  const hill = `M16 ${GROUND}H21.25${slope}H8V16.75A4 4 0 0 1 16 16.75Z`;
  put('tunnel', ['túnel', 'paso subterráneo', 'montaña', 'cierre de túnel', 'tunnel', 'underpass'], [hill, line([12, GROUND], [12, 17.75])], {
    fill: { solid: [0], wire: [1] },
    parts: { mountain: [0], lane: [1] },
  });
}

// ── Monuments and squares ─────────────────────────────────────────────────────────────────────
// Monument: an obelisk on a two-step plinth, one outline, standing on the ground.
put('monument', ['monumento', 'obelisco', 'memorial', 'conmemoración', 'monument', 'memorial'], [
  roundpoly([[5.25, GROUND], [5.25, 17.75], [8, 17.75], [8, 14.75], [10.25, 14.75], [10.75, 6], [12, 2.75], [13.25, 6], [13.75, 14.75], [16, 14.75], [16, 17.75], [18.75, 17.75], [18.75, GROUND]], [0, 0.4, 0.4, 0.4, 0.4, 0.3, 0.5, 0.3, 0.4, 0.4, 0.4, 0.4, 0]),
  ground(),
], { fill: { solid: [0], wire: [1] }, parts: { monument: [0], ground: [1] } });
// Statue: a standing figure (round head, robe) on a tall pedestal.
put('statue', ['estatua', 'escultura', 'arte público', 'plaza', 'statue', 'sculpture'], [
  circ(12, 4.25, 1.75),
  roundpoly([[10.5, 8.5], [13.5, 8.5], [14.75, 13.75], [9.25, 13.75]], [1, 1, 0, 0]),
  roundline([[8.5, GROUND], [8.5, 13.75], [15.5, 13.75], [15.5, GROUND]], [0, 0.75, 0.75, 0]),
  ground(),
], { fill: { solid: [0, 1, 2], wire: [3], close: true }, parts: { figure: [0, 1], pedestal: [2], ground: [3] } });
{
  // Fountain: a wide basin, a column holding a smaller bowl, and the water: a jet that splits at its
  // top into two streams that arc out past the bowl and fall toward the basin, ending in the air.
  // (Streams that ran on into the basin closed over the bowl like a dome.)
  const stream = 'M12 4.5C10.75 2.5 5.5 2.25 4.75 12';
  put('fountain', ['fuente', 'plaza', 'parque', 'agua', 'fountain', 'water feature'], [
    roundpoly([[3.25, 15.75], [20.75, 15.75], [18.75, GROUND], [5.25, GROUND]], [0.75, 0.75, 1, 1]),
    line([12, 15.75], [12, 12.75]),
    'M8.5 10.25H15.5A3.5 2.5 0 0 1 8.5 10.25Z',
    line([12, 10.25], [12, 4.5]),
    stream,
    flipPath(stream),
    ground(),
  ], { fill: { solid: [0, 2], wire: [1, 3, 4, 5, 6] }, parts: { basin: [0], column: [1], bowl: [2], water: [3, 4, 5], ground: [6] }, motion: { effect: 'bounce', parts: ['water'], vector: [0, -1] } });
}
// Park: a round-crowned tree beside a bench (its back and legs one frame, the seat across it and
// running past both legs).
put('park', ['parque', 'área verde', 'jardín', 'banca', 'park', 'green space'], [
  circ(6.75, 9, 4.25),
  line([6.75, 13.25], [6.75, GROUND]),
  roundline([[13.75, GROUND], [13.75, 14.25], [20.5, 14.25], [20.5, GROUND]], [0, 0.75, 0.75, 0]),
  line([12.5, 17.5], [21.5, 17.5]),
  ground(),
], { fill: { solid: [0], wire: [1, 2, 3, 4] }, parts: { tree: [0, 1], bench: [2, 3], ground: [4] } });
// Playground: a slide, its ladder up to a platform and the chute sweeping down.
put('playground', ['juegos infantiles', 'resbaladilla', 'parque', 'niños', 'playground', 'slide'], [
  `M4.75 ${GROUND}V7.75H10.25C14.25 7.75 15 17.75 21.25 17.75`,
  line([7.75, 7.75], [7.75, GROUND]),
  'M4.75 10.75H7.75M4.75 13.75H7.75M4.75 16.75H7.75',
  ground(),
], { fill: false, parts: { slide: [0, 1, 2], ground: [3] } });
// Swing set: two A-frames and the top bar, one seat hanging on two ropes.
put('swing-set', ['columpio', 'juegos', 'parque infantil', 'recreo', 'swing set', 'swing'], [
  roundline([[3.5, GROUND], [5.5, 4.25], [7.5, GROUND]], [0, 0.75, 0]),
  roundline([[16.5, GROUND], [18.5, 4.25], [20.5, GROUND]], [0, 0.75, 0]),
  line([5.5, 4.25], [18.5, 4.25]),
  roundline([[10.5, 4.25], [10.5, 15], [13.5, 15], [13.5, 4.25]], [0, 0.75, 0.75, 0]),
  ground(),
], { fill: false, parts: { frame: [0, 1, 2], swing: [3], ground: [4] }, motion: { effect: 'ring', parts: ['swing'], origin: [12, 4.25] } });
// Seesaw: a plank tilted across a small triangular pivot, a handle at each end.
put('seesaw', ['subibaja', 'balancín', 'equilibrio', 'turnos', 'seesaw', 'teeter-totter'], [
  roundpoly([[12, 14.5], [15.25, GROUND], [8.75, GROUND]], [0.75, 0.5, 0.5]),
  line([3.25, 17.25], [20.75, 11.75]),
  line([5.75, 16.46], [5.75, 13.25]),
  line([18.25, 12.54], [18.25, 9.25]),
  ground(),
], { fill: { solid: [0], wire: [1, 2, 3, 4] }, parts: { pivot: [0], plank: [1, 2, 3], ground: [4] }, motion: { effect: 'wiggle', parts: ['plank'], origin: [12, 14.5] } });
{
  // Plaza: an arcade of three arches across the back and the floor in front in perspective, its
  // paving drawn by the arches' lines running on toward us.
  const A = (x) => `A2.25 2.25 0 0 1 ${N(x)} 7.5`;
  put('plaza', ['plaza', 'zócalo', 'explanada', 'zona peatonal', 'plaza', 'town square'], [
    `M5.25 12V7.5${A(9.75)}${A(14.25)}${A(18.75)}V12M9.75 7.5V12M14.25 7.5V12`,
    roundpoly([[5.25, 12], [18.75, 12], [21.25, GROUND], [2.75, GROUND]], 0.5),
    line([9.75, 12], [8.92, GROUND]),
    line([14.25, 12], [15.08, GROUND]),
  ], { fill: { solid: [1], wire: [0], cut: [2, 3] }, parts: { arcade: [0], floor: [1, 2, 3] } });
}
{
  // Village: three gabled houses (the house's pitch) on the ground, the largest in front with its door
  // and two taller ones behind it at both sides (a custom badge that carries the ground with it: the
  // front house clears the walls it hides and the ground runs on whole). Strung along a slope they
  // read as tags on a sled; neighborhood (bienes raíces) is two houses and a tree side by side.
  const house = (cx, w, h) => roundpoly([[cx - w / 2, GROUND], [cx - w / 2, GROUND - h], [cx, GROUND - h - (w / 2) * PITCH], [cx + w / 2, GROUND - h], [cx + w / 2, GROUND]], [0, 0.5, 0.75, 0.5, 0]);
  const front = house(12, 8.5, 6);
  const door = doorway(12, 3, 17.25, 0.75);
  put('village', ['pueblo', 'aldea', 'localidad', 'zona rural', 'village', 'small town'], [house(5.75, 6, 9.5), house(18.25, 6, 9.5)], {
    badge: { d: [front, door, ground()], knock: front, fill: { solid: [front], cut: [door], wire: [ground()] } },
    fill: { solid: [0, 1] },
    parts: { houses: [0, 1] },
  });
}
{
  // Ruins: two columns on a base that steps down toward a fallen block, one column whole under its
  // capital and one broken off short (3 apart, so they never merge).
  put('ruins', ['ruinas', 'zona arqueológica', 'patrimonio', 'historia', 'ruins', 'archaeological site'], [
    roundpoly([[2.75, GROUND], [2.75, 15.25], [14.5, 15.25], [14.5, 18], [16.25, 18], [16.25, GROUND]], [0, 0.5, 0.5, 0.5, 0.5, 0]),
    roundline([[4.75, 15.25], [4.75, 6.25], [7.75, 6.25], [7.75, 15.25]], [0, 0, 0, 0]),
    line([3, 6.25], [9.5, 6.25]),
    roundline([[10.75, 15.25], [10.75, 10], [13.75, 11.75], [13.75, 15.25]], [0, 0.5, 0.5, 0]),
    roundpoly([[18.25, GROUND], [18.75, 17.25], [21.25, 17.75], [21.25, GROUND]], [0, 0.5, 0.5, 0]),
    ground(),
  ], { fill: { solid: [0, 1, 3, 4], wire: [2, 5], close: true }, parts: { base: [0], columns: [1, 2, 3], block: [4], ground: [5] } });
}
{
  // Windmill: a tapered tower, its four sails crossing in an X over its top (a custom badge: they
  // clear the tower behind them, and so does the disc around their hub, so the tower's top is hidden
  // whole at every weight). The sails start 3.5 out from the hub, so they never merge at it.
  const hub = [12, 8.5];
  const blade = (a) => {
    const P = (r, o) => plus(hub, rot([r, o], [0, 0], a));
    return roundpoly([P(3.5, -1.375), P(7.75, -1.375), P(7.75, 1.375), P(3.5, 1.375)], 0.5);
  };
  const sails = [45, 135, 225, 315].map(blade);
  const tower = roundline([[7.5, GROUND], [10.25, 11], [13.75, 11], [16.5, GROUND]], [0, 0.75, 0.75, 0]);
  put('windmill', ['molino de viento', 'molino', 'campo', 'paisaje rural', 'windmill', 'countryside'], [tower, doorway(12, 3, 17.5), ground()], {
    badge: { d: [...sails, dot(...hub)], knock: `${sails.join('')}${circ(...hub, 3.5)}`, fill: { solid: sails } },
    fill: { solid: [0], cut: [1], wire: [2], close: true },
    parts: { tower: [0, 1], ground: [2] },
    motion: { effect: 'spin', parts: ['badge'], origin: hub },
  });
}
{
  // Watermill: a gabled mill (the house's pitch) and a large paddle wheel against its side (a
  // custom badge: it clears the wall behind it), its foot over the water.
  const c = [15.75, 12.75];
  const R = 4.75;
  const spokes = [0, 60, 120, 180, 240, 300].map((a) => line(polar(...c, 1.25, a), polar(...c, R, a)));
  const rim = circ(...c, R);
  const hubRing = circ(...c, 1.25);
  const apex = [7.5, 3.75];
  const mill = roundline([[3, GROUND], [3, gableAt(apex, 3)], apex, [12, gableAt(apex, 12)], [12, GROUND]], [0, 0.5, 1, 0.5, 0]);
  put('watermill', ['molino de agua', 'rueda hidráulica', 'patrimonio', 'río', 'watermill', 'water wheel'], [mill, line([2.75, GROUND], [12, GROUND]), ripple(21.25, 15, 2)], {
    badge: { d: [rim, hubRing, ...spokes], knock: rim, fill: { solid: [rim], cut: [hubRing, ...spokes] } },
    fill: { solid: [0], wire: [1, 2], close: true },
    parts: { mill: [0], ground: [1], water: [2] },
    motion: { effect: 'spin', parts: ['badge'], origin: c },
  });
}
// Cemetery: two round-topped headstones of different heights on the ground, with no symbol on them.
put('cemetery', ['cementerio', 'panteón', 'lápidas', 'memorial', 'cemetery', 'graveyard'], [archway(7, 6.5, 6), archway(16.25, 6, 10.75), ground()], {
  fill: { solid: [0, 1], wire: [2], close: true },
  parts: { stones: [0, 1], ground: [2] },
});
// Shelter: an open lean-to, the house's roof on two posts set well in under it, open underneath.
{
  const apex = [12, 4.5];
  put('shelter', ['refugio', 'albergue', 'cobertizo', 'descanso', 'shelter', 'refuge'], [gable(apex, 2.75, 21.25), ...gableWalls(apex, 7, 17), ground()], {
    fill: { solid: [`${gable(apex, 2.75, 21.25)}Z`], wire: [1, 2, 3] },
    parts: { roof: [0], posts: [1, 2], ground: [3] },
  });
}
// Street lamp: a pole on a small base, its arm curving over into a downward lamp head.
put('street-lamp', ['alumbrado público', 'farola', 'poste de luz', 'reportar luminaria', 'street lamp', 'streetlight'], [
  roundpoly([[6.75, 17.75], [9.75, 17.75], [10.75, GROUND], [5.75, GROUND]], [0.5, 0.5, 0.25, 0.25]),
  roundline([[8.25, 17.75], [8.25, 4.25], [15.25, 4.25], [15.25, 5.75]], [0, 2.75, 1, 0]),
  'M12.25 8.75A3 3 0 0 1 18.25 8.75Z',
], { fill: { solid: [0, 2], wire: [1] }, parts: { base: [0], pole: [1], lamp: [2] } });
{
  // Aqueduct: three round arches below and three narrower above, each tier's crowns touching the
  // line it carries; the channel runs along the top.
  const w = 18.5 / 3;
  const r = w / 2;
  const low = `M2.75 ${GROUND}V${N(11.5 + r)}${[1, 2, 3].map((i) => `A${N(r)} ${N(r)} 0 0 1 ${N(2.75 + i * w)} ${N(11.5 + r)}`).join('')}V${GROUND}M${N(2.75 + w)} ${N(11.5 + r)}V${GROUND}M${N(2.75 + 2 * w)} ${N(11.5 + r)}V${GROUND}`;
  const up = (cx) => `M${N(cx - 1.5)} 11.5V8.5A1.5 1.5 0 0 1 ${N(cx + 1.5)} 8.5V11.5`;
  put('aqueduct', ['acueducto', 'arcos', 'patrimonio', 'ingeniería romana', 'aqueduct', 'arches'], [
    line([2.75, 7], [21.25, 7]),
    line([2.75, 11.5], [21.25, 11.5]),
    low,
    ...[2.75 + r, 12, 21.25 - r].map(up),
  ], { fill: false, parts: { channel: [0], tiers: [1, 2, 3, 4, 5] } });
}
{
  // Footbridge: a steep arched walkway with a step down at each end, its railing 3 above on two
  // posts along the radius, and the water beneath.
  const C = [12, 20.5];
  const R = Math.hypot(7.25, 3.5);
  const Rr = R + 3;
  const at2 = (r, a) => polar(...C, r, a);
  const ends = [215, 325];
  put('footbridge', ['puente peatonal', 'pasarela', 'cruce a pie', 'sendero', 'footbridge', 'pedestrian bridge'], [
    `M2.75 19.75H4.75V17A${N(R)} ${N(R)} 0 0 1 19.25 17V19.75H21.25`,
    `M${pt(at2(Rr, ends[0]))}A${N(Rr)} ${N(Rr)} 0 0 1 ${pt(at2(Rr, ends[1]))}`,
    ...ends.map((a) => line(at2(R, a), at2(Rr, a))),
    ripple(20.5, 7.75, 3, (16.25 - 7.75) / 3),
  ], { fill: false, parts: { walkway: [0], railing: [1, 2, 3], water: [4] } });
}

// ── Landscapes ────────────────────────────────────────────────────────────────────────────────
// The same ground line as the buildings and the water's wave (`ripple`); what stands in front of
// another piece goes on top as a custom badge and the engine clears what it hides.
/** A front shape standing on the ground, as a badge that carries the ground line with it. */
const onGround = (shape, extra = []) => ({ d: [shape, ...extra, ground()], knock: `${shape}Z`, fill: { solid: [`${shape}Z`], wire: [...extra, ground()] } });
{
  // Desert: two dunes, low and wide, each a long windward slope up to a rounded crest and a short
  // concave slip face down; the front one hides the back one's foot.
  const back = 'M2.75 20.75C6.25 18.25 9 12 12 12C14 12 15 16.5 17.25 20.75';
  const front = 'M9.25 20.75C12.5 19 14.75 15 17.25 15C19 15 19.75 18 21.25 20.75';
  put('desert', ['desierto', 'dunas', 'zona árida', 'arena', 'desert', 'dunes'], [back], {
    badge: onGround(front),
    fill: { solid: [`${back}Z`] },
    parts: { back: [0] },
  });
}
{
  // Hills: two round humps (half ellipses: the desert's dunes are the asymmetric ones), the front
  // one lower and to the right.
  const back = `M2.75 ${GROUND}A7 9.25 0 0 1 16.75 ${GROUND}`;
  const front = `M10.25 ${GROUND}A5.5 6.75 0 0 1 21.25 ${GROUND}`;
  put('hills', ['colinas', 'lomas', 'campo', 'terreno ondulado', 'hills', 'countryside'], [back], {
    badge: onGround(front),
    fill: { solid: [`${back}Z`] },
    parts: { back: [0] },
  });
}
{
  // Island: a low hump rising from the water (its feet on two crests), a second wave below and one
  // palm leaning from its top.
  const T = [13.5, 5];
  put('island', ['isla', 'trópico', 'destino', 'remoto', 'island', 'tropical'], [
    'M4.5 14.75A6 3.5 0 0 1 16.5 14.75',
    ripple(15.75, 3, 6),
    ripple(19.5, 3, 6),
    `M10.5 11.25C11.25 8.75 12 6.75 ${pt(T)}`,
    `M${pt(T)}A5 5 0 0 0 7.25 7`,
    `M${pt(T)}A5 5 0 0 1 19.75 6.75`,
    `M${pt(T)}A4.5 4.5 0 0 1 17.75 2.25`,
  ], { fill: { solid: ['M4.5 14.75A6 3.5 0 0 1 16.5 14.75Z'], lines: [1, 2], wire: [3, 4, 5, 6] }, parts: { island: [0], water: [1, 2], palm: [3, 4, 5, 6] }, motion: { effect: 'float', parts: ['water'], vector: [1.5, 0] } });
}
{
  // Canyon: two rock walls, each stepping down twice toward the other in sloping, eroded faces,
  // and the river winding between them from far to near.
  const P = [[2.75, 4.25], [5.25, 4.25], [6.5, 8.75], [7.75, 8.75], [8.75, 13.75], [9.25, 14.5], [9.25, GROUND], [2.75, GROUND]];
  const wall = roundpoly(P, [0.75, 0.5, 0.5, 0.5, 0.5, 0.5, 0, 0]);
  put('canyon', ['cañón', 'barranca', 'desfiladero', 'parque nacional', 'canyon', 'gorge'], [
    wall,
    flipPath(wall),
    'M12 12.25C11.5 14.25 12.5 15.75 12 17.5S12.5 20 12 21.75',
  ], { fill: { solid: [0, 1], wire: [2] }, parts: { walls: [0, 1], river: [2] } });
}
{
  // Lake: an irregular shoreline seen from above, two short ripples inside.
  const P = Array.from({ length: 24 }, (_, i) => {
    const t = rad(i * 15);
    const k = 1 + 0.07 * Math.cos(3 * t + 0.6) + 0.05 * Math.cos(2 * t - 0.8);
    return [12 + 9 * k * Math.cos(t), 12.25 + 6.75 * k * Math.sin(t)];
  });
  put('lake', ['lago', 'laguna', 'agua dulce', 'presa', 'lake', 'pond'], [smoothClosed(P), ripple(9.75, 7.5, 2), ripple(14.75, 9.75, 2)], {
    fill: { solid: [0], cut: [1, 2] },
    parts: { shore: [0], water: [1, 2] },
    variants: { circle: false },
  });
}
{
  // River: a band between two banks winding in an S from the top of the frame to the bottom.
  const L = 'M5.5 2.5C5.5 11 13.5 13 13.5 21.5';
  const R = 'M10.5 2.5C10.5 11 18.5 13 18.5 21.5';
  put('river', ['río', 'arroyo', 'cauce', 'ribera', 'river', 'stream'], [L, R], {
    fill: { solid: [`${L}L18.5 21.5C18.5 13 10.5 11 10.5 2.5Z`] },
    parts: { banks: [0, 1] },
  });
}
{
  // Beach: lugares' curling wave, smaller, rolling in over a gentle mound of sand.
  const k = 0.68;
  const W = (x, y) => [2.75 + (x - 2.75) * k, 15.25 + (y - 19.25) * k];
  const wave = `M${pt(W(2.75, 19.25))}C${pt(W(7.25, 19.25))} ${pt(W(7.5, 5))} ${pt(W(14.5, 5))}A${N(4.5 * k)} ${N(4.5 * k)} 0 0 1 ${pt(W(19, 9.5))}A${N(2.25 * k)} ${N(2.25 * k)} 0 0 1 ${pt(W(14.5, 9.5))}C${pt(W(11.75, 12.5))} ${pt(W(13, 19.25))} ${pt(W(21.25, 19.25))}`;
  put('beach', ['playa', 'costa', 'mar', 'arena', 'beach', 'coast'], [wave, `M2.75 ${GROUND}Q12 16.25 21.25 ${GROUND}`], {
    fill: { solid: [`${wave}Z`, `M2.75 ${GROUND}Q12 16.25 21.25 ${GROUND}Z`] },
    parts: { wave: [0], sand: [1] },
    motion: { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  });
}
{
  // Forest: three conifers (tree-pine's construction, slimmer) of different heights; the front one
  // goes on top as a custom badge, and the inner sides of the two behind cross under it, so the
  // engine cuts them through at every weight (grazed, they closed again at 2.1).
  const pine = (x, top, base, hw) => roundpoly([[x, top], [x + hw, base], [x - hw, base]], [1, 1, 1]);
  const front = pine(12, 8.5, 17.5, 3);
  put('forest', ['bosque', 'pinos', 'naturaleza', 'sendero', 'forest', 'woods'], [
    pine(6.25, 3, 16, 3.5),
    line([6.25, 16], [6.25, GROUND]),
    pine(17.75, 4.25, 16.5, 3.5),
    line([17.75, 16.5], [17.75, GROUND]),
    ground(),
  ], {
    badge: { d: [front, line([12, 17.5], [12, GROUND])], knock: front, fill: { solid: [front], wire: [line([12, 17.5], [12, GROUND])] } },
    fill: { solid: [0, 2], wire: [1, 3, 4] },
    parts: { trees: [0, 1, 2, 3], ground: [4] },
  });
}
// Cliff: the land rises to a short flat top at its edge and drops in a jagged face to the water at
// its foot. (A block with a flat top and a vertical back edge read as the letter D beside a tilde.)
{
  const face = smoothOpen([[11.75, 5.5], [11, 9.25], [12.5, 12.75], [11.5, 16.5], [12.5, GROUND]]).replace(/^M[^C]+/, '');
  const rock = `M2.75 ${GROUND}V12.25C5 10.75 6.5 5.75 9.5 5.5H11.75${face}Z`;
  put('cliff', ['acantilado', 'risco', 'mirador', 'precipicio', 'cliff', 'sea cliff'], [rock, ripple(19.75, 15.25, 2, 3)], {
    fill: { solid: [0], lines: [1] },
    parts: { cliff: [0], water: [1] },
  });
}
// Waterfall: seen from the front, the water falls in two lines between two rock shoulders into the
// pool's ripple. (Three lines turning over a ledge around one center read as a signal's arcs.)
{
  const rock = roundline([[2.75, 4.75], [7, 4.75], [7.5, 9], [6.75, 14.5]], [0, 0.75, 0.75, 0]);
  put('waterfall', ['cascada', 'catarata', 'salto de agua', 'naturaleza', 'waterfall', 'falls'], [
    line([10.5, 6], [10.5, 15.5]),
    line([13.5, 6], [13.5, 15.5]),
    rock,
    flipPath(rock),
    ripple(19.5, 3, 6),
  ], { fill: false, parts: { water: [0, 1], rocks: [2, 3], pool: [4] }, motion: { effect: 'slide', parts: ['water'], vector: [0, 1.5] } });
}
// Cave: a low rocky mound, much wider than it is tall, a small irregular mouth at its foot (the
// natural arch is the tall one, open through).
put('cave', ['cueva', 'caverna', 'gruta', 'espeleología', 'cave', 'cavern'], [
  `${smoothOpen([[2.75, GROUND], [3.5, 14.5], [6.25, 11.25], [9.25, 9.5], [12.75, 9.25], [15.25, 8.25], [18.75, 9.75], [20.75, 14], [21.25, GROUND]])}H13.25${smoothOpen([[13.25, GROUND], [13.25, 17.5], [11.25, 14.75], [8.75, 15.25], [7.5, 17.75], [7.25, GROUND]]).replace(/^M[^C]+/, '')}Z`,
  ground(),
], { fill: { solid: [0], wire: [1] }, parts: { rock: [0], ground: [1] } });
// Iceberg: one faceted body of ice, its small tip above the water and its much larger mass below,
// coming to a point off center; the water runs across it as a custom badge and the engine clears the
// ice around it. (A tip over a flat mass read as a boat on the waves; a flat-bottomed mass under the
// wave, as a cupcake.)
{
  // The wave's ends stand well outside the ice (3.8 or more from its edges, past the 3.35 a clearance
  // reaches at 2.1) and it crosses the ice on straight runs, so its cuts don't change with the weight
  // (cutting through a rounded corner left a sliver that came apart at 2.1).
  const ice = roundpoly([[12.75, 2.75], [18.5, 15], [17.25, 19], [11.75, 21.75], [7, 19.25], [5, 15]], [0.75, 1, 1, 1, 1, 1]);
  const sea = ripple(11, 3, 6);
  put('iceberg', ['iceberg', 'témpano', 'punta del iceberg', 'polar', 'iceberg', 'tip of the iceberg'], [ice], {
    badge: { d: [sea], knock: sea },
    fill: { solid: [0] },
    parts: { ice: [0] },
    motion: { effect: 'float', vector: [0, -1] },
  });
}
// Wetland: two short water lines and three reeds rising through them, one topped by a cattail.
put('wetland', ['humedal', 'pantano', 'marisma', 'reserva natural', 'wetland', 'marsh'], [
  ripple(15.25, 3, 6),
  ripple(19, 3, 6),
  line([7, 21.5], [7, 8]),
  line([12, 21.5], [12, 10]),
  line([17, 21.5], [17, 6.5]),
  capsule(10.5, 4.5, 3, 5.5),
  line([12, 4.5], [12, 2.5]),
], { fill: { solid: [5], lines: [0, 1], wire: [2, 3, 4, 6] }, parts: { water: [0, 1], reeds: [2, 3, 4, 5, 6] }, motion: { effect: 'wiggle', parts: ['reeds'], origin: [12, 21.5] } });
{
  // Hot spring: a pool seen at an angle, its rim lumpy like rocks, and three wisps of steam.
  const P = Array.from({ length: 32 }, (_, i) => {
    const t = rad(i * 11.25);
    const k = 1 + 0.05 * Math.cos(7 * t);
    return [12 + 8.5 * k * Math.cos(t), 16.75 + 3.5 * k * Math.sin(t)];
  });
  const wisp = (x) => `M${N(x)} 10.25C${N(x - 1.25)} 9 ${N(x - 1.25)} 7.75 ${N(x)} 6.5S${N(x + 1.25)} 4 ${N(x)} 2.75`;
  put('hot-spring', ['aguas termales', 'balneario', 'termas', 'vapor', 'hot spring', 'thermal pool'], [smoothClosed(P), wisp(8), wisp(12), wisp(16)], {
    fill: { solid: [0], lines: [1, 2, 3] },
    parts: { pool: [0], steam: [1, 2, 3] },
    motion: { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  });
}
{
  // Geyser: a column of water shooting up from a low mound (it rises from the mound's top) and
  // splashing out to both sides.
  const side = 'M10.5 19V8.75C10.5 5.75 8.5 3.5 6.25 3.5C4.5 3.5 3.5 5 3.75 7';
  put('geyser', ['géiser', 'geotermia', 'erupción de agua', 'parque nacional', 'geyser', 'geothermal'], [
    side,
    flipPath(side),
    `M4.5 ${GROUND}A9 4 0 0 1 19.5 ${GROUND}`,
    ground(),
  ], { fill: { solid: [`M4.5 ${GROUND}A9 4 0 0 1 19.5 ${GROUND}Z`], wire: [0, 1, 3] }, parts: { water: [0, 1], mound: [2], ground: [3] }, motion: { effect: 'bounce', parts: ['water'], vector: [0, -1.5] } });
}
// Natural arch: an irregular band of rock arching over a wide, tall opening, between two thick
// legs, on the ground (the cave is the low mound with a small mouth).
put('natural-arch', ['arco natural', 'formación rocosa', 'roca', 'mirador', 'natural arch', 'rock arch'], [
  `${smoothOpen([[2.75, GROUND], [3, 13], [4.75, 8.25], [8.5, 5], [12.5, 4.75], [16.75, 3.5], [20, 6.5], [21, 12], [21.25, GROUND]])}H16.75${smoothOpen([[16.75, GROUND], [16.5, 13.5], [15.25, 9.75], [12.25, 8.5], [9.25, 9.5], [7.75, 13], [7.5, GROUND]]).replace(/^M[^C]+/, '')}Z`,
  ground(),
], { fill: { solid: [0], wire: [1] }, parts: { arch: [0], ground: [1] } });
// Viewpoint: a railing in the foreground (two posts, the top rail) and two peaks beyond it.
put('viewpoint', ['mirador', 'vista panorámica', 'parada escénica', 'foto', 'viewpoint', 'lookout'], [
  roundline([[2.75, 12.25], [8, 5], [11.5, 8.75], [16, 3.75], [21.25, 12.25]], [0, 1, 0.75, 1, 0]),
  line([2.75, 15.25], [21.25, 15.25]),
  line([6, 15.25], [6, GROUND]),
  line([18, 15.25], [18, GROUND]),
  ground(),
], { fill: { solid: [`${roundline([[2.75, 12.25], [8, 5], [11.5, 8.75], [16, 3.75], [21.25, 12.25]], [0, 1, 0.75, 1, 0])}Z`], wire: [1, 2, 3, 4] }, parts: { peaks: [0], railing: [1, 2, 3], ground: [4] } });
// Plateau: a flat-topped mesa whose steep sides flare into the ground, and a smaller butte beside it.
// (Straight sides and a band of strata read as a bucket.)
{
  const mesa = `M2.75 ${GROUND}C4.75 19.5 5 17 5 14.5V9.5Q5 8.5 6 8.5H13Q14 8.5 14 9.5V14.5C14 17 14.25 19.5 16.25 ${GROUND}`;
  const butte = `M16.25 ${GROUND}C17.75 20 18 18.5 18 16.75V15.25Q18 14.25 19 14.25H20.25Q21.25 14.25 21.25 15.25V${GROUND}`;
  put('plateau', ['meseta', 'altiplano', 'mesa', 'terreno', 'plateau', 'mesa'], [mesa, butte, ground()], {
    fill: { solid: [0, 1], wire: [2], close: true },
    parts: { mesa: [0], butte: [1], ground: [2] },
  });
}
{
  // Oasis: two dunes on the horizon (the desert's profile), a small pond in front and one palm
  // rising from its bank between them.
  const T = [12.75, 6.25];
  put('oasis', ['oasis', 'descanso', 'desierto', 'refugio', 'oasis', 'rest stop'], [
    'M2.75 14.5C4.25 13.25 5.25 11.75 6.5 11.75C7.25 11.75 7.75 13 8.75 14.5',
    'M15.25 14.5C16.75 13.25 17.75 11.75 19 11.75C19.75 11.75 20.25 13 21.25 14.5',
    ell([12, 19.25], 6.25, 1.75),
    `M12 17.5C12.25 13.25 12.5 9.5 ${pt(T)}`,
    `M${pt(T)}A4.5 4.5 0 0 0 8.5 8.5`,
    `M${pt(T)}A4.5 4.5 0 0 1 17.25 8.5`,
    `M${pt(T)}A4.25 4.25 0 0 1 16.5 2.75`,
  ], { fill: { solid: [2], wire: [3, 4, 5, 6], lines: [0, 1] }, parts: { dunes: [0, 1], pond: [2], palm: [3, 4, 5, 6] } });
}
{
  // Archipelago: three small islands of falling sizes seen from above, scattered (side by side, two
  // read as glasses), short waves between them.
  const isle = (c, rx, ry, ph) =>
    smoothClosed(Array.from({ length: 12 }, (_, i) => {
      const t = rad(i * 30);
      const k = 1 + 0.09 * Math.cos(3 * t + ph);
      return [c[0] + rx * k * Math.cos(t), c[1] + ry * k * Math.sin(t)];
    }));
  put('archipelago', ['archipiélago', 'islas', 'saltar de isla en isla', 'geografía', 'archipelago', 'islands'], [
    isle([15, 13], 5, 3.5, 0.4),
    isle([6.5, 6.75], 3.5, 2.5, 1.7),
    isle([5.75, 17.75], 2.75, 2, 2.6),
    ripple(5, 14, 2),
    ripple(21, 11.75, 2),
  ], { fill: { solid: [0, 1, 2], lines: [3, 4] }, parts: { islands: [0, 1, 2], water: [3, 4] } });
}

// ── Round 8 at 16 px (DESIGN.md › 16 px) ──────────────────────────────────────────────────────
// The engine snaps every drawing; these didn't read after it (stripes and nested loops a pixel
// apart, waves of amplitude 1, three wisps). Each keeps fewer pieces, at least a pixel apart: strokes
// on pixel centers (0.75 + 1.5k), 2 × 2 pixel dots on pixel edges, and waves of amplitude 1.5 whose
// crests fall on pixel centers (as water's).
{
  const wave16 = (y, x0, n) => ripple(y, x0, n, 3, 1.5);
  const small = (name, d, fill) => {
    icons[name].small = { d, ...(fill && { fill }) };
  };
  // Latitude and longitude: the globe on pixel centers (r 8.25) and two straight lines 3 pixels apart.
  const globe = circ(12, 12, 8.25);
  const chord = (o) => Math.sqrt(8.25 ** 2 - o ** 2);
  const across = [9.75, 14.25].map((y) => line([12 - chord(y - 12), y], [12 + chord(y - 12), y]));
  small('latitude', [globe, ...across], { solid: [globe], cut: across });
  const down = [9.75, 14.25].map((x) => line([x, 12 - chord(x - 12)], [x, 12 + chord(x - 12)]));
  small('longitude', [globe, ...down], { solid: [globe], cut: down });
  // Contour lines: two loops 3 pixels apart instead of three.
  const n = 72;
  const core = Array.from({ length: n }, (_, i) => polar(12, 12, 2.25 * (1 + 0.3 * Math.cos(rad(2 * (i * 5 + 25)))), i * 5));
  const ring = (dd) =>
    smoothClosed(
      core
        .map((p, i) => {
          const t = unit(sub(core[(i + 1) % n], core[(i - 1 + n) % n]));
          return plus(p, scale([t[1], -t[0]], dd));
        })
        .filter((_, i) => i % 2 === 0),
    );
  small('contour-lines', [ring(6.5), ring(1.75)], { solid: [ring(6.5)], cut: [ring(1.75)] });
  // Live location: the pin on pixel centers (r 5.25) with a dot for its hole, one arc on each side.
  {
    const c = [12, 9];
    const d = [pin(c, 5.25), dot(12, 9, 1), arcd(...c, 8.25, -30, 30), arcd(...c, 8.25, 150, 210)];
    small('map-pin-live', d, { solid: [d[0]], cut: [d[1]], lines: [d[2], d[3]] });
  }
  // Floor selector: the chevrons, the top plate and one floor below it, half a pixel to the right.
  {
    const d = [
      line([9.75, 5.25], [12.75, 2.25], [15.75, 5.25]),
      roundpoly([[12.75, 8.25], [20.25, 11.25], [12.75, 14.25], [5.25, 11.25]], 0.75),
      line([5.25, 14.25], [12.75, 17.25], [20.25, 14.25]),
      line([9.75, 18.75], [12.75, 21.75], [15.75, 18.75]),
    ];
    small('floor-selector', d, { solid: [d[1]], lines: [d[0], d[2], d[3]] });
  }
  // Lake: the shore and one wave.
  {
    const d = [icons.lake.d[0], wave16(12.75, 6.75, 4)];
    small('lake', d, { solid: [d[0]], cut: [d[1]] });
  }
  // Island: the land, one wave and the palm.
  {
    const d = icons.island.d;
    const sd = [d[0], wave16(16.5, 2.25, 6), ...d.slice(3)];
    small('island', sd, { solid: [`${d[0]}Z`], lines: [sd[1]], wire: sd.slice(2) });
  }
  // Wetland: one wave and three reeds 4 pixels apart, the cattail on the middle one.
  {
    const d = [wave16(15.75, 3.75, 6), line([6.75, 21.75], [6.75, 8.25]), line([12.75, 21.75], [12.75, 10.5]), line([18.75, 21.75], [18.75, 6.75]), capsule(11.25, 4.5, 3, 6), line([12.75, 4.5], [12.75, 2.25])];
    small('wetland', d, { solid: [d[4]], lines: [d[0]], wire: [d[1], d[2], d[3], d[5]] });
  }
  // Hot spring: the pool and two wisps 3 pixels apart.
  {
    const wisp = (x) => `M${N(x)} 10.5C${N(x - 1.5)} 9.25 ${N(x - 1.5)} 7.75 ${N(x)} 6.5S${N(x + 1.5)} 3.75 ${N(x)} 2.25`;
    const d = [icons['hot-spring'].d[0], wisp(9.75), wisp(14.25)];
    small('hot-spring', d, { solid: [d[0]], lines: [d[1], d[2]] });
  }
  // Satellite view: the satellite level, so body, arms and panels land on pixel rows (tilted, they
  // smudged into one bar), over the Earth's arc.
  {
    const d = [sq(9.75, 5.25, 4.5, 3, 0.75), sq(2.25, 3.75, 4.5, 6, 0.75), sq(17.25, 3.75, 4.5, 6, 0.75), line([6.75, 6.75], [9.75, 6.75]), line([14.25, 6.75], [17.25, 6.75]), 'M3.75 20.25Q12 13.5 20.25 20.25'];
    small('satellite-view', d, { solid: d.slice(0, 3), wire: d.slice(3, 5), lines: [d[5]] });
  }
  // Archipelago: the three islands, without the waves between them.
  {
    const d = icons.archipelago.d.slice(0, 3);
    small('archipelago', d, { solid: d });
  }
}

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d`: `solid` is filled (and keeps its stroke: the silhouette doesn't change), `cut`
// is knocked out at stroke width, `lines` stays a line, separated from the fill by 1.5 of
// clearance, and `wire` stays a line attached to the fill, with no clearance (the hourglass caps, a
// signpost, the floor under the door, the flagpole). `solid` only takes closed shapes: `close`
// closes along their chord the open outlines that get filled (the U of a tire or of the chimney,
// the door leaf, the house's roof, the sun's half disc); the chord almost always lands on another
// stroke of the body (the floor, the ground, the edge of the hull or of the roof).
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const FILL = {};
// Calendar (like the core one): the rings stay lines; the header and the glyph are knocked out.
for (const name of ['calendar-plus', 'calendar-minus', 'calendar-check', 'calendar-x', 'calendar-range', 'calendar-event', 'calendar-day', 'calendar-clock'])
  FILL[name] = { solid: [0], lines: [1, 2], cut: range(3, icons[name].d.length) };
Object.assign(FILL, {
  // The caps are attached to the glass and stay whole: the knocked-out sand ends on the bottom one.
  hourglass: { solid: [0], wire: [1, 2] },
  'hourglass-end': { solid: [0], wire: [1, 2], cut: [3] },
  stopwatch: { solid: [0], wire: [1, 2, 3], cut: [4] },
  'clock-plus': { solid: [0], cut: [1] },
  'clock-check': { solid: [0], cut: [1] },
  'time-zone': { solid: [0], cut: [1] },
  // The half sun is filled down to the horizon (its chord lands on it); the rays and the arrow stay
  // lines.
  sunrise: { solid: [1], wire: [0], lines: [2, 3, 4, 5, 6, 7], close: true },
  sunset: { solid: [1], wire: [0], lines: [2, 3, 4, 5, 6, 7], close: true },
  map: { solid: [0], cut: [1, 2] },
  'map-pin': { solid: [0], cut: [1] },
  'map-pin-plus': { solid: [0], cut: [1, 2] },
  'map-pin-check': { solid: [0], cut: [1] },
  'map-pin-x': { solid: [0], cut: [1, 2] },
  'map-pin-dot': { solid: [0, 2], cut: [1] },
  'map-pin-area': { solid: [0] },
  'map-pins': { solid: [0, 2], cut: [1] },
  compass: { solid: [0], cut: [1, 2, 3, 4, 5] },
  'location-arrow': { solid: [0] },
  navigation: { solid: [0], cut: [1] },
  signpost: { solid: [0, 1], wire: [2, 3, 4] },
  directions: { solid: [0], cut: [1, 2] },
  // The roof closes along the line of its eaves; the walls, along a chord that sits under the roof.
  house: { solid: [0, 1], cut: [2, 3], close: true },
  'office-building': { solid: [0], cut: range(1, 8) },
  factory: { solid: [0], cut: [1] },
  hospital: { solid: [0], cut: [1, 2, 3] },
  // The awning and the shop are filled together (knocking out their shared edge left a loose slot);
  // the awning's stripes and the door are knocked out.
  'corner-shop': { solid: [0, 3], cut: [1, 2, 4], close: true },
  ship: { solid: [0, 1, 2], close: true },
  // Weather: the bodies (sun, moon, clouds) are filled; rays, drops, flakes and gusts stay lines.
  // Whatever sits behind a cloud badge is filled whole and the engine clears it.
  sun: { solid: [0], lines: range(1, 9) },
  'sun-dim': { solid: range(0, 9) },
  moon: { solid: [0] },
  'moon-stars': { solid: [0, 1, 2] },
  cloud: { solid: [0] },
  clouds: { solid: [0] },
  'cloud-sun': { solid: [0], lines: range(1, icons['cloud-sun'].d.length) },
  'cloud-moon': { solid: [0] },
  'cloud-rain': { solid: [0], lines: [1, 2, 3] },
  'cloud-drizzle': { solid: [0], lines: [1, 2, 3, 4] },
  'cloud-snow': { solid: [0], lines: range(1, 7) },
  storm: { solid: [0], lines: [1, 2, 3] },
  fog: { solid: [0], lines: [1, 2] },
  tornado: { solid: [0], lines: [1, 2, 3] },
  thermometer: { solid: [0], cut: [1, 2, 3] },
  'thermometer-up': { solid: [0], cut: [1], lines: [2, 3] },
  'thermometer-down': { solid: [0], cut: [1], lines: [2, 3] },
  'cloud-hail': { solid: [0, 1, 2, 3] },
  // Nature
  droplet: { solid: [0], cut: [1] },
  droplets: { solid: [0, 1] },
  // Stems and trunks are attached to what they hold up (the tree's branch stays inside the crown).
  tree: { solid: [0], wire: [1] },
  flower: { solid: [0, 3], wire: [2], cut: [1] },
  sprout: { solid: [1, 2], wire: [0, 3] },
  cactus: { solid: [0], wire: [1], close: true },
  flame: { solid: [0], cut: [1] },
  // The logs don't touch the flame: they stay lines, with their clearance.
  campfire: { solid: [0], lines: [2, 3], cut: [1] },
  mountain: { solid: [0] },
  'mountain-snow': { solid: [0] },
  // The wave closes along its base: the foot stays straight between its two ends.
  wave: { solid: [0], close: true },
  'shooting-star': { solid: [0], lines: [1, 2, 3] },
  footprints: { solid: [0, 1, 2, 3] },
  paw: { solid: [0, 1, 2, 3, 4] },
  cat: { solid: [0], cut: [1, 2, 3] },
  fish: { solid: [0, 1], cut: [2] },
  tent: { solid: [0], cut: [1] },
  volcano: { solid: [0], lines: [1, 2, 3] },
  // Travel and objects: the suitcase handle stays a line with its clearance (like the core
  // briefcase's); the wheels are attached to the body.
  luggage: { solid: [0], wire: [4, 5], lines: [1], cut: [2, 3] },
  passport: { solid: [0], cut: [1, 2, 3] },
  // The mortarboard's cap closes against the board; the tassel hangs attached to it.
  'graduation-cap': { solid: [0, 1], wire: [2], close: true },
  // The door leaf closes along the floor.
  door: { solid: [0], wire: [1], cut: [2], close: true },
  // Each body closes along its lens's chord; the bridge joins them, attached.
  binoculars: { solid: [0, 1, 2, 3], wire: [4], close: true },
  dumbbell: { solid: [0, 1], wire: [2, 3, 4] },
  school: { solid: [0, 2], wire: [1], cut: [3], close: true },
  bus: { solid: [0, 1, 2], cut: [3, 4, 5, 6], close: true },
  train: { solid: [0], wire: [4, 5], cut: [1, 2, 3] },
  plane: { solid: [0] },
  'plane-takeoff': { solid: [0], lines: [1] },
  'plane-landing': { solid: [0], lines: [1] },
  sailboat: { solid: [0, 1, 2] },
  scooter: { solid: [0, 1], wire: [2, 3, 4] },
  parking: { solid: [0], cut: [1] },
  'traffic-light': { solid: [0], cut: [1, 2, 3] },
});
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid).map(spec.close ? shut : (d) => d) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}
// Alarm clock: the face is filled, each bell is the crescent its arc leaves with 1.5 of clearance,
// and the legs are attached to the face; the hands or the sign are knocked out.
for (const name of ['alarm-clock', 'alarm-plus', 'alarm-check'])
  icons[name].fill = { solid: [icons[name].d[0], ...BELLS.map((b) => b.lune)], wire: ALARM_LEGS, cut: icons[name].d.slice(5) };
icons['alarm-off'].fill = { solid: [icons['alarm-off'].d[0], BELLS[1].lune], wire: ALARM_LEGS };
// Route: the ends are filled and the path is attached to them (closed along its chord, it got filled).
icons.route.fill = { solid: [icons.route.d[0], icons.route.d[2]], wire: [icons.route.d[1]] };
// Car and taxi: the cabin (the glass), the tires and the sign close against the body; the cabin is
// separated from it by its roofline, knocked out.
for (const name of ['car', 'taxi']) {
  const d = icons[name].d;
  icons[name].fill = { solid: [d[0], ...[d[1], d[2], d[3], ...d.slice(6)].map(shut)], cut: [line([6.75, 10.25], [17.25, 10.25]), d[4], d[5]] };
}
// Bed: the mattress is filled (its closed body is the outline itself) and the pillow floats with
// its clearance; the headboard, the mattress edge with the leg, and the base are attached to it.
{
  const [head, top, frame, pillow] = icons.bed.d;
  const mattress = roundpoly([[3.25, 11.75], [17.75, 11.75], [20.75, 14.75], [20.75, 16.75], [3.25, 16.75]], [0, 2.5, 2.5, 0, 0]);
  icons.bed.fill = { solid: [mattress, pillow], wire: [head, top, frame] };
}
// Anchor: the ring filled and the tips as solid flukes (each tip closed along its base); the shank,
// the stock and the curved arm are attached.
{
  const [ring, shank, stock, bow, ...tips] = icons.anchor.d;
  icons.anchor.fill = { solid: [ring, ...tips.map(shut)], wire: [shank, stock, bow] };
}
// Person walking: the head filled; arms and legs stay lines, with no clearance (with clearance they
// would bite into the head).
icons.walking.fill = { solid: [icons.walking.d[0]], wire: icons.walking.d.slice(1) };
// Fuel pump and charger: the body filled, the hose attached to it; the window or the bolt is knocked out.
for (const name of ['gas-station', 'ev-charger']) {
  const [body, mark, hose] = icons[name].d;
  icons[name].fill = { solid: [body], wire: [hose], cut: [mark] };
}
// Rainbow: the bands are lines only (closed along their chord they merged into a solid arch); in
// the filled version they look the same and the cloud badge fills on its own.
icons.rainbow.fill = false;
// Umbrella: the canopy filled; the handle attached to it.
icons.umbrella.fill = { solid: [icons.umbrella.d[0]], wire: [icons.umbrella.d[1]] };
// Leaf: the stem that sticks out, attached to the tip; inside, the midrib is knocked out starting
// 2.8 from the tip (knocked out from the tip itself, it severed the stem).
icons.leaf.fill = { solid: [icons.leaf.d[0]], wire: [line([3.25, 20.75], [5.5, 18.5])], cut: [line([7.5, 16.5], [14.25, 9.75])] };
// Pine: the outer trunk, attached to the crown; inside, it's knocked out from 1.5 above its base,
// along with the branch that comes out of it.
icons['tree-pine'].fill = { solid: [icons['tree-pine'].d[0]], wire: [line([12, 21.25], [12, 17.75])], cut: [line([12, 16.25], [12, 9.75]), icons['tree-pine'].d[2]] };
// Planet: the disc filled; the back arcs stay lines, and so does the front half (the badge).
icons.planet.fill = { solid: [icons.planet.d[0]], lines: icons.planet.d.slice(1) };
// Utensils and cup: the fork's tines, the handles and the cup's handle stay lines, attached (closed
// along their chord they became a shovel and a solid D); the knife's blade, filled.
{
  const [tines, fork, blade, knife] = icons.utensils.d;
  icons.utensils.fill = { solid: [blade], wire: [tines, fork, knife] };
  const [cup, handle, ...steam] = icons.coffee.d;
  icons.coffee.fill = { solid: [cup], wire: [handle], lines: steam };
}
// Open door: the leaf filled, closed against the frame; the frame stays a line (closed along the
// floor, the whole doorway got filled) and, like the floor, is attached.
icons['door-open'].fill = { solid: [shut(icons['door-open'].d[2])], wire: icons['door-open'].d.slice(0, 2) };
// City: both buildings filled (the right one closes against the tower); their shared edge is
// knocked out (the tower wall the other one hides).
icons.city.fill = { solid: [icons.city.d[0], shut(icons.city.d[1])], cut: [line([12.75, 9], [12.75, 21.25]), ...icons.city.d.slice(2)] };
// Only open lines: their filled version is the outline itself.
// The timer is an open ring (filled, its chord turned it into a bitten disc).
for (const name of ['timer', 'clock-forward', 'bicycle', 'road', 'wind', 'snowflake', 'palm-tree', 'water', 'recycle']) icons[name].fill = false;

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
const PARTS = {
  hourglass: { glass: [0], caps: [1, 2] },
  'hourglass-end': { glass: [0], caps: [1, 2], sand: [3] },
  timer: { ring: [0], knob: [1], hand: [2] },
  stopwatch: { face: [0], crown: [1, 2], button: [3], hand: [4] },
  'alarm-clock': { face: [0], bells: [1, 2], legs: [3, 4], hands: [5] },
  'alarm-plus': { face: [0], bells: [1, 2], legs: [3, 4], mark: [5, 6] },
  'alarm-check': { face: [0], bells: [1, 2], legs: [3, 4], mark: [5] },
  'alarm-off': { face: [0], bell: [1], legs: [2, 3] },
  'clock-forward': { arrow: [0, 1], hands: [2] },
  'clock-plus': { face: [0], hands: [1] },
  'clock-check': { face: [0], hands: [1] },
  'time-zone': { globe: [0], meridian: [1] },
  sunrise: { horizon: [0], sun: [1], rays: [2, 3, 4, 5], arrow: [6, 7] },
  sunset: { horizon: [0], sun: [1], rays: [2, 3, 4, 5], arrow: [6, 7] },
  map: { map: [0], folds: [1, 2] },
  'map-pin': { pin: [0], hole: [1] },
  'map-pin-plus': { pin: [0], mark: [1, 2] },
  'map-pin-check': { pin: [0], mark: [1] },
  'map-pin-x': { pin: [0], mark: [1, 2] },
  'map-pin-dot': { pin: [0, 1], spot: [2] },
  'map-pin-area': { area: [0] },
  'map-pins': { pin: [0, 1], second: [2] },
  compass: { ring: [0], needle: [1], ticks: [2, 3, 4, 5] },
  'location-arrow': { arrow: [0] },
  navigation: { arrow: [0], ridge: [1] },
  route: { start: [0], path: [1], end: [2] },
  signpost: { signs: [0, 1], post: [2, 3, 4] },
  directions: { sign: [0], arrow: [1, 2] },
  house: { roof: [0], walls: [1], door: [2], window: [3] },
  'office-building': { body: [0], windows: range(1, 7), door: [7] },
  city: { tower: [0], building: [1], windows: range(2, 8) },
  factory: { body: [0], door: [1] },
  hospital: { body: [0], cross: [1, 2], door: [3] },
  school: { body: [0], pole: [1], flag: [2], door: [3] },
  'corner-shop': { awning: [0, 1, 2], walls: [3], door: [4] },
  bed: { headboard: [0], mattress: [1], frame: [2], pillow: [3] },
  car: { body: [0], cabin: [1], wheels: [2, 3], lights: [4, 5] },
  taxi: { body: [0], cabin: [1], wheels: [2, 3], lights: [4, 5], sign: [6] },
  bus: { body: [0], wheels: [1, 2], windows: [3, 4], lights: [5, 6] },
  train: { body: [0], window: [1], lights: [2, 3], rails: [4, 5] },
  plane: { plane: [0] },
  'plane-takeoff': { plane: [0], ground: [1] },
  'plane-landing': { plane: [0], ground: [1] },
  ship: { hull: [0], cabin: [1], funnel: [2] },
  sailboat: { sails: [0, 1], hull: [2] },
  anchor: { ring: [0], shank: [1], stock: [2], arms: [3, 4, 5] },
  bicycle: { wheels: [0, 1], frame: [2, 3], seat: [4, 5], handlebar: [6] },
  scooter: { wheels: [0, 1], deck: [2], stem: [3], handlebar: [4] },
  walking: { head: [0], body: [1], legs: [2, 3], arms: [4] },
  'gas-station': { pump: [0], window: [1], hose: [2] },
  'ev-charger': { pump: [0], bolt: [1], hose: [2] },
  parking: { sign: [0], letter: [1] },
  // Each light separately: the traffic light turns on the right one.
  'traffic-light': { body: [0], red: [1], yellow: [2], green: [3] },
  road: { edges: [0, 1], lanes: [2, 3, 4] },
  sun: { sun: [0], rays: range(1, 9) },
  'sun-dim': { sun: [0], rays: range(1, 9) },
  moon: { moon: [0] },
  'moon-stars': { moon: [0], stars: [1, 2] },
  cloud: { cloud: [0] },
  clouds: { back: [0] },
  'cloud-sun': { sun: [0], rays: range(1, icons['cloud-sun'].d.length) },
  'cloud-moon': { moon: [0] },
  'cloud-rain': { cloud: [0], drops: [1, 2, 3] },
  'cloud-drizzle': { cloud: [0], drops: [1, 2, 3, 4] },
  'cloud-snow': { cloud: [0], flakes: range(1, 7) },
  storm: { cloud: [0], bolt: [1], drops: [2, 3] },
  fog: { cloud: [0], mist: [1, 2] },
  wind: { gusts: [0, 1, 2] },
  tornado: { top: [0], turns: [1, 2, 3] },
  snowflake: { arms: range(0, 6), branches: range(6, 12) },
  rainbow: { bands: [0, 1, 2] },
  thermometer: { body: [0], level: [1, 2, 3] },
  'thermometer-up': { body: [0], level: [1], arrow: [2, 3] },
  'thermometer-down': { body: [0], level: [1], arrow: [2, 3] },
  umbrella: { canopy: [0], handle: [1] },
  'cloud-hail': { cloud: [0], hail: [1, 2, 3] },
  droplet: { drop: [0], shine: [1] },
  droplets: { large: [0], small: [1] },
  leaf: { leaf: [0], stem: [1] },
  tree: { crown: [0], trunk: [1], branch: [2] },
  'tree-pine': { crown: [0], trunk: [1], branch: [2] },
  'palm-tree': { trunk: [0], fronds: [1, 2, 3, 4] },
  flower: { petals: [0], center: [1], stem: [2], leaf: [3] },
  sprout: { stem: [0], leaves: [1, 2], ground: [3] },
  cactus: { cactus: [0], ground: [1] },
  flame: { flame: [0], core: [1] },
  campfire: { flame: [0], core: [1], logs: [2, 3] },
  mountain: { back: [0] },
  'mountain-snow': { back: [0] },
  wave: { wave: [0] },
  planet: { planet: [0], ring: [1, 2] },
  'shooting-star': { star: [0], trail: [1, 2, 3] },
  footprints: { left: [0, 1], right: [2, 3] },
  paw: { pad: [0], toes: [1, 2, 3, 4] },
  cat: { head: [0], eyes: [1, 2], mouth: [3] },
  fish: { body: [0], tail: [1], eye: [2] },
  tent: { tent: [0], door: [1] },
  volcano: { mountain: [0], lava: [1, 2, 3] },
  water: { waves: [0, 1, 2] },
  luggage: { body: [0], handle: [1], stripes: [2, 3], wheels: [4, 5] },
  passport: { cover: [0], globe: [1, 2], line: [3] },
  utensils: { fork: [0, 1], knife: [2, 3] },
  coffee: { cup: [0], handle: [1], steam: [2, 3] },
  'graduation-cap': { board: [0], cap: [1], tassel: [2] },
  door: { door: [0], floor: [1], knob: [2] },
  'door-open': { frame: [0], floor: [1], door: [2] },
  recycle: { arrows: range(0, 6) },
  binoculars: { lenses: [0, 1], bodies: [2, 3], bridge: [4] },
  dumbbell: { plates: [0, 1], bar: [2, 3, 4] },
};
for (const name of Object.keys(icons).filter((n) => n.startsWith('calendar-'))) {
  const n = icons[name].d.length;
  PARTS[name] = { body: [0], rings: [1, 2], header: [3], ...(n > 4 && { mark: range(4, n) }) };
}
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
// The clock badge spins its hands in place (center 17.25, 17.25).
const BC = [17.25, 17.25];
const MOTION = {
  'calendar-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'time-zone': { effect: 'spin', parts: ['badge'], origin: BC },
  // The hourglass flips over; the one that's already empty shakes.
  hourglass: { effect: 'spin', origin: [12, 12] },
  'hourglass-end': { effect: 'wiggle', origin: [12, 20.75] },
  timer: { effect: 'spin', parts: ['hand'], origin: [12, 12] },
  stopwatch: { effect: 'spin', parts: ['hand'], origin: [12, 13.25] },
  'alarm-clock': { effect: 'ring', origin: ALARM },
  'alarm-plus': { effect: 'ring', origin: ALARM },
  'alarm-check': { effect: 'ring', origin: ALARM },
  'clock-forward': { effect: 'spin', parts: ['hands'], origin: [12, 12] },
  'clock-plus': { effect: 'spin', parts: ['hands'], origin: [11.5, 11.5] },
  'clock-check': { effect: 'spin', parts: ['hands'], origin: [11.5, 11.5] },
  sunrise: { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] },
  sunset: { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  // The pins bounce (like the core pin); on the ones that mark a point or an area, only the pin bounces.
  'map-pin': { effect: 'bounce', vector: [0, -2] },
  'map-pin-plus': { effect: 'bounce', vector: [0, -2] },
  'map-pin-check': { effect: 'bounce', vector: [0, -2] },
  'map-pin-x': { effect: 'bounce', vector: [0, -2] },
  'map-pin-dot': { effect: 'bounce', parts: ['pin'], vector: [0, -2] },
  'map-pin-area': { effect: 'bounce', parts: ['badge'], vector: [0, -2] },
  'map-pins': { effect: 'bounce', parts: ['pin'], vector: [0, -2] },
  compass: { effect: 'wiggle', parts: ['needle'], origin: [12, 12] },
  'location-arrow': { effect: 'slide', vector: [1.5, -1.5] },
  navigation: { effect: 'slide', vector: [0, -2] },
  directions: { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  school: { effect: 'wiggle', parts: ['flag'], origin: [12, 4.1] },
  // Front-facing vehicles bounce on their suspension; side-view ones move forward in the direction
  // they face.
  car: { effect: 'bounce', vector: [0, -1.5] },
  taxi: { effect: 'bounce', vector: [0, -1.5] },
  bus: { effect: 'bounce', vector: [0, -1.5] },
  train: { effect: 'bounce', parts: ['body', 'window', 'lights'], vector: [0, -1.5] },
  plane: { effect: 'slide', vector: [1.5, -1.5] },
  'plane-takeoff': { effect: 'slide', parts: ['plane'], vector: [1.75, -1] },
  'plane-landing': { effect: 'slide', parts: ['plane'], vector: [1.75, 1] },
  ship: { effect: 'float', vector: [0, -1.5] },
  sailboat: { effect: 'float', vector: [0, -1.5] },
  anchor: { effect: 'wiggle', origin: [12, 4.75] },
  bicycle: { effect: 'slide', vector: [2, 0] },
  scooter: { effect: 'slide', vector: [2, 0] },
  walking: { effect: 'slide', vector: [1.5, 0] },
  'ev-charger': { effect: 'beat', parts: ['bolt'], origin: [8.25, 12.4] },
  road: { effect: 'slide', parts: ['lanes'], vector: [0, 1.5] },
  // Weather: rays spin, clouds drift, rain falls at a slant, snow floats, hail bounces and the
  // lightning bolt pulses.
  sun: { effect: 'spin', parts: ['rays'], origin: [12, 12] },
  'sun-dim': { effect: 'spin', parts: ['rays'], origin: [12, 12] },
  moon: { effect: 'wiggle', origin: [11.5, 12.5] },
  'moon-stars': { effect: 'beat', parts: ['stars'], origin: [17.25, 6.25] },
  cloud: { effect: 'float', vector: [1.5, 0] },
  clouds: { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
  'cloud-sun': { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
  'cloud-moon': { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
  'cloud-rain': { effect: 'slide', parts: ['drops'], vector: [-0.5, 1.5] },
  'cloud-drizzle': { effect: 'slide', parts: ['drops'], vector: [-0.35, 1] },
  'cloud-snow': { effect: 'float', parts: ['flakes'], vector: [0, 1.5] },
  storm: { effect: 'beat', parts: ['bolt'], origin: [12.25, 19.5] },
  fog: { effect: 'float', parts: ['mist'], vector: [1.5, 0] },
  wind: { effect: 'slide', vector: [2, 0] },
  tornado: { effect: 'wiggle', origin: [11, 19.75] },
  snowflake: { effect: 'spin', origin: [12, 12] },
  'thermometer-up': { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] },
  'thermometer-down': { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  umbrella: { effect: 'wiggle', origin: [12, 12.5] },
  'cloud-hail': { effect: 'bounce', parts: ['hail'], vector: [0, 1.5] },
  // Nature: what grows sways from its root; fire flickers; water drifts.
  droplet: { effect: 'bounce', vector: [0, 1.5] },
  droplets: { effect: 'bounce', vector: [0, 1.5] },
  leaf: { effect: 'wiggle', origin: [3.25, 20.75] },
  tree: { effect: 'wiggle', origin: [12, 21.25] },
  'tree-pine': { effect: 'wiggle', origin: [12, 21.25] },
  'palm-tree': { effect: 'wiggle', origin: [10.25, 21.25] },
  flower: { effect: 'wiggle', origin: [12, 21.25] },
  sprout: { effect: 'beat', origin: [12, 21] },
  flame: { effect: 'wiggle', origin: [12, 20.5] },
  campfire: { effect: 'wiggle', parts: ['flame', 'core'], origin: [12, 15] },
  wave: { effect: 'float', vector: [1.5, 0] },
  water: { effect: 'float', vector: [1.5, 0] },
  planet: { effect: 'float', vector: [0, -1.5] },
  'shooting-star': { effect: 'slide', vector: [1.5, -1.5] },
  footprints: { effect: 'slide', vector: [0, -1.5] },
  fish: { effect: 'slide', vector: [-1.5, 0] },
  volcano: { effect: 'bounce', parts: ['lava'], vector: [0, -1.5] },
  coffee: { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  'graduation-cap': { effect: 'bounce', vector: [0, -2] },
  recycle: { effect: 'spin', origin: [12, 13.75] },
  dumbbell: { effect: 'bounce', vector: [0, -1.5] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// Values (0–1): the timer's ring is the time left, drawn from the top, and its hand points at
// where it ends; the stopwatch's hand runs a full turn from 12; the compass needle and the
// navigation arrow turn to a heading (0 is north)
const VALUE = {
  timer: { draw: ['ring'], turn: { parts: ['hand'], origin: [12, 12], from: -90, to: 210, at: 210 } },
  stopwatch: { turn: { parts: ['hand'], origin: [12, 13.25], from: -90, to: 270, at: -55 } },
  compass: { turn: { parts: ['needle'], origin: [12, 12], from: -90, to: 270, at: -45 } },
  navigation: { turn: { parts: ['arrow', 'ridge'], origin: [12, 12], from: -90, to: 270, at: -90 } },
};
for (const [name, v] of Object.entries(VALUE)) icons[name].value = v;

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge: the filled enclosure doesn't draw it and at 58% it stops reading; the slash would
// cut through it.
offV(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });
// Clocks: they already come in their own ring.
offV(['timer', 'stopwatch', 'clock-forward'], { circle: false });
offV(['compass'], { circle: false });
// The directions sign is already its own frame.
offV(['directions'], { circle: false, square: false });
offV(['parking'], { square: false });
// They already say «no»: slashing them adds nothing.
offV(['calendar-x', 'map-pin-x'], { slash: false });
// The alarm clock already has its hand-drawn off version (alarm-off).
offV(['alarm-clock'], { slash: false });

// ── Levels (DESIGN.md › Levels): the mercury rises from the bulb upward ─────────────────────
icons.thermometer.levels = [[1], [2], [3]];
// The sun's brightness: at half, the four rays on the axes; at full, the diagonal ones too.
for (const name of ['sun', 'sun-dim']) icons[name].levels = [[1, 3, 5, 7], [2, 4, 6, 8]];

// ── Mirroring (DESIGN.md › Mirroring) ─────────────────────────────────────────────────────────
// The turn on the directions sign follows the reading direction.
for (const name of ['directions']) icons[name].mirror = true;

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every icon to the pixel grid and swaps only the standard badges for their pixel
// version. Only the drawings that still don't read go here; the engine doesn't snap a `small`: it
// runs through pixel centers (0.75 + 1.5k) or, for 2 × 2 pixel dots, along their edges (multiples
// of 1.5), and if it has a badge, it uses the engine's pixel one (`badge(kind, { size: 16 })`).
// Clock and globe with a badge: with the face centered at 12, the hands fell between pixels. At
// 16 px the face is centered on a pixel (11.25, half a pixel toward the free corner), with a
// 3-pixel minute hand and the hour hand at 45°; the meridian opens to 2 pixels.
{
  const face = circ(11.25, 11.25, 9);
  const hands = line([11.25, 6.75], [11.25, 11.25], [8.25, 8.25]);
  for (const name of ['clock-plus', 'clock-check']) icons[name].small = { d: [face, hands], fill: { solid: [face], cut: [hands] }, badge: badge(icons[name].badge.kind, { size: 16 }) };
  const meridian = 'M11.25 2.25A15 15 0 0 1 11.25 20.25A15 15 0 0 1 11.25 2.25Z';
  icons['time-zone'].small = { d: [face, meridian], fill: { solid: [face], cut: [meridian] }, badge: badge('clock', { size: 16 }) };
}
// Marked day: the 0.7 dot fell between pixels (a gray smudge). The 12 × 11 pixel calendar with its
// center on a pixel edge and the 2 × 2 pixel dot right in the center.
{
  const body = sq(3.75, 5.25, 16.5, 15, 3.5, BR);
  const rings = [line([8.25, 2.25], [8.25, 6.75]), line([15.75, 2.25], [15.75, 6.75])];
  const header = line([3.75, 9.75], [20.25, 9.75]);
  const mark = dot(12, 15, 1);
  icons['calendar-day'].small = { d: [body, ...rings, header, mark], fill: { solid: [body], lines: rings, cut: [header, mark] } };
}

// Office and city: the r 0.3 windows disappeared. 2 × 2 pixel windows with 1 pixel of space between
// them and from the walls; walls and door on pixel centers.
{
  const body = sq(5.25, 2.25, 13.5, 19.5, 3, BR);
  const windows = [9, 15].flatMap((x) => [6, 10.5, 15].map((y) => dot(x, y, 1)));
  const door = roundline([[9.75, 21.75], [9.75, 18.75], [14.25, 18.75], [14.25, 21.75]], [0, 0.75, 0.75, 0]);
  icons['office-building'].small = { d: [body, ...windows, door], fill: { solid: [body], cut: [...windows, door] } };
}
{
  const tower = sq(2.25, 2.25, 10.5, 19.5, 2.5, BR);
  const building = roundline([[12.75, 9.75], [20.25, 9.75], [20.25, 21.75], [12.75, 21.75]], [0, 2.5, 0, 0]);
  const windows = [...[6, 10.5, 15].map((y) => dot(7.5, y, 1)), ...[13.5, 18].map((y) => dot(16.5, y, 1))];
  icons.city.small = { d: [tower, building, ...windows], fill: { solid: [tower, shut(building)], cut: [line([12.75, 9.75], [12.75, 21.75]), ...windows] } };
}
// Water: the amplitude-1 waves turned into gray bars. Amplitude-1.5 waves (their crests on pixel
// centers) with 2 pixels of space between them.
{
  const wave = (y, x0, n, h = 3, a = 1.5) => {
    let d = `M${pt([x0, y])}`;
    for (let i = 0; i < n; i++) {
      const sg = i % 2 ? 1 : -1;
      const x = x0 + i * h;
      d += `C${pt([x + h / 3, y + (sg * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (sg * 4 * a) / 3])} ${pt([x + h, y])}`;
    }
    return d;
  };
  icons.water.small = { d: [wave(5.25, 2.25, 6), wave(12, 5.25, 4), wave(18.75, 2.25, 6)] };
}
// Rainbow: three bands and the cloud don't fit (1 pixel between bands, the cloud a smudge). Two
// half arcs 2 pixels apart, with their ends and crests on pixel centers. Lines only: in the filled
// version they look the same.
{
  const band = (r) => `M${N(12 - r)} 16.5A${N(r)} ${N(r)} 0 0 1 ${N(12 + r)} 16.5`;
  icons.rainbow.small = { d: [band(8.25), band(3.75)] };
}
// Directions: the diamond with its sides at 45° through pixel centers and a 2 × 3 pixel turn, 1.5
// clear of the diamond.
{
  const sign = roundpoly([[12, 3], [21, 12], [12, 21], [3, 12]], 2.25);
  const turn = roundline([[9.75, 14.25], [9.75, 11.25], [15.75, 11.25]], [0, 1.5, 0]);
  const tip = line([13.5, 9], [15.75, 11.25], [13.5, 13.5]);
  icons.directions.small = { d: [sign, turn, tip], fill: { solid: [sign], cut: [turn, tip] } };
}
// Compass: at 16 px the four knocked-out marks turned the fill into a smudge; just the ring and the
// needle.
icons.compass.small = { d: [icons.compass.d[0], icons.compass.d[1]], fill: { solid: [icons.compass.d[0]], cut: [icons.compass.d[1]] } };
// Multiple places: the small pin stuck to the large one. Pins almost 2 pixels apart; the large one
// with its hole.
{
  const big = [16.5, 8.25];
  const d = [pin(big, 4.5), circ(...big, 1.5), pin([5.25, 14.25], 2.75)];
  icons['map-pins'].small = { d, fill: { solid: [d[0], d[2]], cut: [d[1]] } };
}
// Binoculars: the tapered bodies and the lenses clogged up. Lenses of r 3.75 on pixel centers,
// straight bodies tangent to them (closed along the lens diameter) and the bridge attached;
// 2 pixels between the lenses.
{
  const lenses = [circ(6, 15, 3.75), circ(18, 15, 3.75)];
  const body = (x) => roundline([[x - 3.75, 15], [x - 3.75, 5.25], [x + 3.75, 5.25], [x + 3.75, 15]], [0, 1.5, 1.5, 0]);
  const bodies = [body(6), body(18)];
  const bridge = line([9.75, 9.75], [14.25, 9.75]);
  icons.binoculars.small = { d: [...lenses, ...bodies, bridge], fill: { solid: [...lenses, ...bodies.map(shut)], wire: [bridge] } };
}
// Passport: the globe with its meridian was a smudge; at 16 px the globe is a 2.5-pixel ring.
{
  const book = sq(5.25, 2.25, 13.5, 19.5, 3, BR);
  const globe = circ(12, 10.5, 3.75);
  const data = line([9.75, 17.25], [14.25, 17.25]);
  icons.passport.small = { d: [book, globe, data], fill: { solid: [book], cut: [globe, data] } };
}
// Tornado: four turns 1 pixel tall became bars. The mouth and two turns 2 pixels deep, with
// 2 pixels of space, swaying by one pixel.
{
  const turn = (cx, y, rx) => `M${N(cx - rx)} ${N(y)}A${N(rx)} 1.5 0 0 0 ${N(cx + rx)} ${N(y)}`;
  const mouth = ellipse(12, 5.25, 8.25, 1.5);
  const d = [mouth, turn(12, 11.25, 5.25), turn(10.5, 17.25, 2.25)];
  icons.tornado.small = { d, fill: { solid: [mouth], lines: d.slice(1) } };
}

// Pins: the r 2.5 ring and the signs fell between pixels (a smudge). The pin with its center on a
// pixel (half a pixel to the right) and its circle on pixel centers (r 7.5); the ring with a
// 3-pixel hole and 5-pixel signs, their straight runs and diagonals on pixel centers.
{
  const c = [12.75, 9.75];
  const body = pin(c, 7.5);
  const marks = {
    'map-pin': [circ(...c, 3)],
    'map-pin-plus': [line([12.75, 6.75], [12.75, 12.75]), line([9.75, 9.75], [15.75, 9.75])],
    'map-pin-check': [line([9.75, 11.25], [11.25, 12.75], [15.75, 8.25])],
    'map-pin-x': [line([9.75, 6.75], [15.75, 12.75]), line([15.75, 6.75], [9.75, 12.75])],
  };
  for (const [name, mark] of Object.entries(marks)) icons[name].small = { d: [body, ...mark], fill: { solid: [body], cut: mark } };
}

export default { category: 'lugares', label: 'Tiempo, lugares y naturaleza', icons };
