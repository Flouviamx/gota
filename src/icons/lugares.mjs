// Time, places and nature: calendar, clock, maps, buildings, transportation, weather and nature.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5
// stroke, keylines, continuous corners and a square bottom-right corner on containers.
import { arc, badge, circ, dot, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

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

{
  // Map folded into three panels: zigzag top and bottom edges, two folds.
  const P = [[2.75, 6.25], [9, 4], [15, 6.25], [21.25, 4], [21.25, 17.75], [15, 20], [9, 17.75], [2.75, 20]];
  add('map', ['mapa', 'plano', 'ubicación', 'map'], [roundpoly(P, [1, 0.6, 0.6, 1, 1, 0.6, 0.6, 1]), line([9, 4], [9, 17.75]), line([15, 6.25], [15, 20])]);
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
{
  // Flame: a round base rising to a tilted tip; inside, the logomark's drop.
  const flame = (c, r, tip) => {
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
  };
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
{
  // Water: three waves in phase, with amplitude 1 and period 6 (cubics whose peak is exactly 1).
  const wave = (y, x0 = 3, n = 6, h = 3, a = 1) => {
    let d = `M${pt([x0, y])}`;
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1;
      const x = x0 + i * h;
      d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
    }
    return d;
  };
  // The middle one, shorter and centered, breaks the repetition of three equal lines.
  add('water', ['agua', 'río', 'lago', 'mar', 'oleaje', 'water'], [wave(7.5), wave(12, 6, 4), wave(16.5)]);
}

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
