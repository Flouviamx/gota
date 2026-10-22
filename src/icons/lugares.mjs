// Tiempo, lugares y naturaleza: calendario, reloj, mapas, edificios, transporte, clima y
// naturaleza. Todo se calcula con el motor (engine/geometry.mjs) y las reglas de DESIGN.md: trazo
// de 1.5, keylines, esquinas continuas y la esquina inferior derecha recta en los contenedores.
import { arc, badge, circ, dot, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

// ── Utilidades locales ────────────────────────────────────────────────────────────────────────
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

/** Polilínea abierta con los vértices interiores redondeados (radio por vértice o uno para todos). */
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

/** Cápsula (estadio): un rectángulo con los extremos cortos en semicírculo. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w, y + r])}V${N(y + h - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${N(x + w - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w - r, y + h])}H${N(x + r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** Arco abierto (solo el `d`). */
const arcd = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d;

/** Intersecciones de dos círculos [x, y, r]; devuelve las dos (o null). */
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

// ── Trazos como segmentos ─────────────────────────────────────────────────────────────────────
// Un path se lee como segmentos (recta, cúbica, arco de círculo) para medir el aire de un trazo
// junto a una nube (`clearOf`). Lo que pasa detrás de otra pieza nunca se recorta a mano: la pieza
// de encima va como insignia y el motor despeja.
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
 * Un contorno abierto que se rellena (la U de una llanta, el techo de la casa, la media luna del
 * sol): cada tramo se cierra por su cuerda. En `fill.solid` solo van figuras cerradas.
 */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

// Zonas para medir el aire junto a una nube.
const GAP = 3; // centro a centro: 1.5 de aire entre trazos de 1.5
const disc = (c, R) => (p) => len(sub(p, c)) < R;
function nearBox(x, y, w, h, D = GAP) {
  return (p) => {
    const dx = Math.max(x - p[0], 0, p[0] - x - w);
    const dy = Math.max(y - p[1], 0, p[1] - y - h);
    return Math.hypot(dx, dy) < D;
  };
}
/**
 * Tachado dibujado (los `-off`): la diagonal del tachado automático va como insignia propia y el
 * motor despeja la base con 1.5 de aire a cada lado. Es una línea: sin `fill`, también en el
 * relleno se dibuja como trazo.
 */
const SLASH = line([3.6, 3.6], [20.4, 20.4]);
const slashBadge = { d: [SLASH], knock: SLASH };

// ── Íconos ────────────────────────────────────────────────────────────────────────────────────
const icons = {};
// `extra`: campos además de tags y d (p. ej. la insignia del motor: { badge: badge('plus') }).
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Calendario ────────────────────────────────────────────────────────────────────────────────
// El `calendar` del núcleo: 18 × 16.25, radio 4, argollas en 8 y 16, cabecera en 9.75. El cuerpo
// (9.75–21) lleva el glifo centrado en y 15.375.
const CAL_Y = 15.375;
function calendar() {
  return [sq(3, 4.75, 18, 16.25, 4, BR), line([8, 2.9], [8, 6.5]), line([16, 2.9], [16, 6.5]), line([3, 9.75], [21, 9.75])];
}
const calGlyph = (g) => [...calendar(), ...g];

add('calendar-plus', ['agregar fecha', 'nuevo evento', 'calendario', 'add event'], calGlyph([line([9.25, CAL_Y], [14.75, CAL_Y]), line([12, CAL_Y - 2.75], [12, CAL_Y + 2.75])]));
add('calendar-minus', ['quitar fecha', 'calendario', 'cancelar evento', 'remove event', 'remove date'], calGlyph([line([9.25, CAL_Y], [14.75, CAL_Y])]));
add('calendar-check', ['fecha confirmada', 'asistiré', 'calendario', 'event confirmed'], calGlyph([line([8.9, CAL_Y + 0.1], [11, CAL_Y + 2.2], [15.1, CAL_Y - 1.9])]));
add('calendar-x', ['fecha cancelada', 'ocupado', 'calendario', 'event cancelled', 'busy'], calGlyph([line([9.9, CAL_Y - 2.1], [14.1, CAL_Y + 2.1]), line([14.1, CAL_Y - 2.1], [9.9, CAL_Y + 2.1])]));
// Rango: la píldora con que un selector de fechas marca varios días seguidos.
add('calendar-range', ['rango de fechas', 'periodo', 'del al', 'vacaciones', 'date range', 'period'], calGlyph([capsule(8.5, CAL_Y - 1.5, 7, 3)]));
add('calendar-event', ['evento', 'cita', 'día marcado', 'event'], calGlyph([sq(12.25, 13.5, 5, 4.75, 1.5, BR)]));
add('calendar-day', ['día', 'hoy', 'fecha', 'today', 'day'], calGlyph([dot(12, CAL_Y)]));
// Insignias: siempre las del motor, en `badge`; el motor despeja la base con 1.5 de aire.
add('calendar-clock', ['programado', 'fecha y hora', 'agenda', 'recordatorio', 'scheduled', 'reminder'], calendar(), { badge: badge('clock') });

// ── Reloj de arena, temporizador, cronómetro y alarma ───────────────────────────────────────
{
  // El vidrio es un solo contorno: dos bulbos rectos que se angostan hasta el cuello, cerrados
  // bajo las tapas (así se rellena entero); las tapas van a lo ancho.
  const glass = roundpoly(
    [[7, 3.25], [17, 3.25], [17, 6.75], [13.1, 12], [17, 17.25], [17, 20.75], [7, 20.75], [7, 17.25], [10.9, 12], [7, 6.75]],
    [0, 0, 3, 1, 3, 0, 0, 3, 1, 3],
  );
  const caps = [line([5.25, 3.25], [18.75, 3.25]), line([5.25, 20.75], [18.75, 20.75])];
  add('hourglass', ['reloj de arena', 'espera', 'tiempo', 'hourglass', 'wait'], [glass, ...caps]);
  add('hourglass-end', ['tiempo agotado', 'reloj de arena', 'vencido', 'time up'], [glass, ...caps, `M9.25 20.75C9.75 18.5 10.75 17.75 12 17.75S14.25 18.5 14.75 20.75`]);
}
{
  // Temporizador: el anillo es el tiempo que queda; arranca en las 12 con un remate (la perilla) y
  // se vacía hacia atrás. La manecilla marca el borde de lo que falta.
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
 * Campana del despertador: el arco de un círculo (r 3.25, a 8.5 del centro) que termina a 1.5 de
 * aire de la carátula (3 de centro a centro). `lune` es la medialuna que encierra ese arco con el
 * mismo aire: el relleno de la campana.
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
// Apagada: el tachado (insignia) tapa casi entera la campana de la izquierda y las manecillas;
// no se dibujan (quedarían fragmentos).
add('alarm-off', ['alarma apagada', 'sin alarma', 'silenciar alarma', 'alarm off', 'snooze'], [circ(...ALARM, ALARM_R), BELLS[1].d, ...ALARM_LEGS], { badge: slashBadge });

// ── Reloj con flecha e insignias ──────────────────────────────────────────────────────────────
{
  const a = arc(12, 12, 8.75, -40, 245);
  add('clock-forward', ['adelantar', 'más tarde', 'futuro', 'clock forward', 'later'], [a.d, head(a.end, a.tangent, 3.4), line([12, 7.75], [12, 12], [14.85, 13.75])]);
}
// El reloj del núcleo con la manecilla de la hora a las 10, lejos de la insignia.
const clockBase = () => [circ(12, 12, 9), line([12, 7.1], [12, 12.25], [8.7, 10.2])];
add('clock-plus', ['agregar tiempo', 'nueva hora', 'tiempo extra', 'add time'], clockBase(), { badge: badge('plus') });
add('clock-check', ['a tiempo', 'hora confirmada', 'puntual', 'on time'], clockBase(), { badge: badge('check') });
// Zona horaria: el aro y el meridiano del `globe` del núcleo (sin ecuador: con la insignia se
// empastaba) y el reloj de insignia.
add('time-zone', ['zona horaria', 'hora mundial', 'huso', 'time zone', 'world clock'], [circ(12, 12, 9), 'M12 3c2.45 2.5 3.7 5.5 3.7 9s-1.25 6.5-3.7 9c-2.45-2.5-3.7-5.5-3.7-9s1.25-6.5 3.7-9Z'], { badge: badge('clock') });

// ── Amanecer y atardecer ────────────────────────────────────────────────────────────────────
function horizonSun(up) {
  const C = [12, 19.5];
  const rays = [-155, -122, -58, -25].map((a) => line(polar(...C, 8.25, a), polar(...C, 10.35, a)));
  const arrow = up ? [line([12, 9.75], [12, 3]), head([12, 3], [0, -1], 3)] : [line([12, 3], [12, 9.75]), head([12, 9.75], [0, 1], 3)];
  return [line([2.75, 19.5], [21.25, 19.5]), arcd(...C, 5.25, 180, 360), ...rays, ...arrow];
}
add('sunrise', ['amanecer', 'salida del sol', 'mañana', 'sunrise'], horizonSun(true));
add('sunset', ['atardecer', 'puesta de sol', 'tarde', 'sunset'], horizonSun(false));

// ── Mapas y ubicación ─────────────────────────────────────────────────────────────────────────
// El pin es la gota del isotipo girada 45°: un círculo cuya esquina recta apunta al suelo.
function pin([cx, cy], r) {
  const a = polar(cx, cy, r, 45);
  const b = polar(cx, cy, r, 135);
  return `M${pt(a)}A${N(r)} ${N(r)} 0 1 0 ${pt(b)}L${pt([cx, cy + r * Math.SQRT2])}Z`;
}
/** Elipse con cuatro cúbicas. */
function ellipse(cx, cy, rx, ry) {
  const k = 0.5523;
  return `M${pt([cx + rx, cy])}C${pt([cx + rx, cy + k * ry])} ${pt([cx + k * rx, cy + ry])} ${pt([cx, cy + ry])}C${pt([cx - k * rx, cy + ry])} ${pt([cx - rx, cy + k * ry])} ${pt([cx - rx, cy])}C${pt([cx - rx, cy - k * ry])} ${pt([cx - k * rx, cy - ry])} ${pt([cx, cy - ry])}C${pt([cx + k * rx, cy - ry])} ${pt([cx + rx, cy - k * ry])} ${pt([cx + rx, cy])}Z`;
}

{
  // Mapa plegado en tres paneles: el borde de arriba y el de abajo en zigzag, dos pliegues.
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
  // Punto exacto: el pin flota sobre el punto que señala.
  const c = [12, 8.25];
  const r = 5.75;
  add('map-pin-dot', ['punto exacto', 'soltar pin', 'aquí', 'drop pin', 'exact location'], [pin(c, r), circ(...c, 2), dot(12, 20)]);
}
{
  // Área: el pin parado en el centro de una elipse. El pin va encima como insignia propia: el
  // motor despeja la elipse con 1.5 de aire exacto.
  const c = [12, 8.25];
  const r = 5.5;
  const top = pin(c, r);
  const hole = circ(...c, 2);
  add('map-pin-area', ['zona', 'área', 'radio de entrega', 'area', 'nearby'], [ellipse(12, 16.75, 9, 3.5)], {
    badge: { d: [top, hole], knock: top, fill: { solid: [top], cut: [hole] } },
  });
}
{
  // Varios lugares: un pin grande con su aro y otro chico, completo, a su lado (a 3 de aire, sin
  // encimarse: medio pin recortado se leía como gancho).
  const big = [15.25, 9.5];
  add('map-pins', ['ubicaciones', 'varios lugares', 'sucursales', 'puntos de venta', 'locations', 'branches'], [pin(big, 5), circ(...big, 2), pin([5.75, 14.25], 3)]);
}
{
  // Brújula: la caja con sus cuatro puntos cardinales y la aguja en rombo con el norte al noreste.
  const C = [12, 12];
  const n = polar(...C, 5.5, -45);
  const s = polar(...C, 5.5, 135);
  const e = polar(...C, 2.1, 45);
  const w = polar(...C, 2.1, -135);
  const ticks = [-90, 0, 90, 180].map((a) => line(polar(...C, 9, a), polar(...C, 6.75, a)));
  add('compass', ['brújula', 'orientación', 'explorar', 'norte', 'compass', 'explore'], [circ(...C, 9), roundpoly([n, e, s, w], [0.7, 0.5, 0.7, 0.5]), ...ticks]);
}
{
  // Flecha de navegación: punta de 45° con la espalda en muesca; la versión facetada lleva la
  // arista que la divide en dos caras, como una pieza con volumen. Se dibuja apuntando arriba y se gira; `arrow` la centra en su caja
  // para que pese igual a cualquier ángulo.
  const TIP = [0, -9.25];
  const WING = [7.5, 8.75];
  const NOTCH = [0, 4.25];
  const R = [1.2, 1.1, 0.5, 1.1];
  // La arista llega al punto donde termina el redondeo de la punta.
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
  // Mi ubicación es la cometa plana (con arista se confundiría con `send`); la navegación, la
  // pieza facetada que avanza.
  add('location-arrow', ['mi ubicación', 'ubicación actual', 'gps', 'current location'], arrow(45, 16.75, false));
  add('navigation', ['navegar', 'guía', 'rumbo', 'conducir', 'navigation', 'heading'], arrow(0, 18, true));
}
{
  // Ruta: sale de un aro, da dos vueltas y llega a la punta de un pin.
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
  // Poste con dos letreros en sentidos opuestos.
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

// ── Edificios ─────────────────────────────────────────────────────────────────────────────────
{
  // Casa: techo a dos aguas con alero, ventana redonda en el hastial, muros con la esquina
  // inferior derecha recta y la puerta al centro (el `home` de navegación es el pentágono).
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
// Ventanas en retícula: puntos de r 0.3, como los días del calendario (grupo denso).
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
  // El asta nace donde termina el redondeo del caballete (sin muñón).
  line([12, 8.06], [12, 2.75]),
  roundline([[12, 2.75], [16, 2.75], [14.9, 4.1], [16, 5.5], [12, 5.5]], [0, 0.3, 0.3, 0.3, 0]),
  roundline([[10.25, 21.25], [10.25, 16.5], [13.75, 16.5], [13.75, 21.25]], [0, 1, 1, 0]),
]);
{
  // Tiendita: toldo a rayas sobre el local; muros con la esquina inferior derecha recta.
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
// Cama: la almohada flota a 1.5 de aire del colchón (pegada, al rellenarse se fundía con él).
add('bed', ['hotel', 'hospedaje', 'cama', 'dormir', 'bed', 'lodging'], [
  line([3.25, 4.75], [3.25, 20.25]),
  roundline([[3.25, 11.75], [17.75, 11.75], [20.75, 14.75], [20.75, 20.25]], [0, 2.5, 2.5, 0]),
  line([3.25, 16.75], [20.75, 16.75]),
  capsule(6.25, 5, 6.5, 3.75),
]);

// ── Transporte ────────────────────────────────────────────────────────────────────────────────
/** Lleva puntos: gira `deg` alrededor de (12, 12), escala `k` y mueve a `to`. */
const place = (pts, deg, k = 1, to = [12, 12]) => pts.map((p) => plus(to, scale(sub(rot(p, [12, 12], deg), [12, 12]), k)));

// Auto de frente: cabina trapezoidal sobre la carrocería, faros y llantas.
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

// Avión visto desde arriba: fuselaje de 3, alas en flecha y estabilizador recto.
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
  // Bicicleta: cuadro de rombo entre dos ruedas, horquilla, asiento y manubrio. El sillín y el
  // manubrio salen de vértices rectos del cuadro (sin muñones) y los tubos libran las ruedas.
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
  // Patín: el manubrio baja hasta tocar la rueda delantera, sin cruzarla.
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
  // Persona caminando: cabeza, torso inclinado, brazos y piernas en paso.
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
// Carretera en perspectiva: las rayas del centro crecen al acercarse.
add('road', ['carretera', 'camino', 'viaje', 'ruta', 'road', 'highway'], [line([8, 3], [3.5, 21]), line([16, 3], [20.5, 21]), line([12, 3.5], [12, 5.5]), line([12, 8.5], [12, 11.5]), line([12, 15], [12, 19.75])]);

// ── Clima ─────────────────────────────────────────────────────────────────────────────────────
// La nube es la de archivos (tres círculos y la base recta), calculada con arcos exactos. `k`
// escala alrededor de (12, 12) y `o` la mueve; encima de otra pieza va como insignia propia.
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
/** Región de la nube engrosada D (para medir el aire de lo que va junto a ella). */
function cloudZone(k = 1, o = [0, 0], D = GAP) {
  const [A, B, C] = cloudCircles(k, o);
  const base = A[1] + A[2];
  const y0 = Math.min(A[1], C[1]);
  return [disc(A, A[2] + D), disc(B, B[2] + D), disc(C, C[2] + D), nearBox(A[0], y0, C[0] - A[0], base - y0, D)];
}
// Nube de lluvia: un poco menor y más arriba, para dejar 5 de cielo abajo.
const RK = 0.88;
const RO = [0, -3.1];
const rainCloud = () => cloud(RK, RO);

/** Sol: disco de radio r y rayos de r + 3 a r + 5.1 (1.5 de aire y poco más de 2 de largo). */
const sunRays = (c, r, n = 8, a0 = 0, l0 = 3, l1 = 5.1) => Array.from({ length: n }, (_, i) => line(polar(...c, r + l0, a0 + (i * 360) / n), polar(...c, r + l1, a0 + (i * 360) / n)));
add('sun', ['sol', 'soleado', 'día', 'claro', 'modo claro', 'sun', 'sunny'], [circ(12, 12, 4.25), ...sunRays([12, 12], 4.25)]);
add('sun-dim', ['sol tenue', 'poco brillo', 'brillo bajo', 'dim', 'low brightness'], [circ(12, 12, 4.25), ...Array.from({ length: 8 }, (_, i) => dot(...polar(12, 12, 8, i * 45)))]);

/** Luna creciente: el disco de radio R menos el de radio r con centro `ic`. */
function moon(c, R, ic, r) {
  const [p, q] = meet([...c, R], [...ic, r]);
  // p y q son las puntas; el borde exterior va por fuera del círculo interior.
  const outer = (a, b) => `A${N(R)} ${N(R)} 0 1 0 ${pt(b)}`;
  const inner = (a, b) => `A${N(r)} ${N(r)} 0 0 1 ${pt(b)}`;
  return `M${pt(p)}${outer(p, q)}${inner(q, p)}Z`;
}
const MOON = () => moon([11.5, 12.5], 8.5, [16.75, 7.25], 6.75);
add('moon', ['luna', 'noche', 'modo oscuro', 'moon', 'night'], [MOON()]);

/** Destello de cuatro puntas con los lados cóncavos (cúbicas que se curvan hacia el centro). */
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
/** Insignia propia: una nube encima de otra pieza (el motor despeja lo de atrás con 1.5 de aire). */
const cloudBadge = (d) => ({ d: [d], knock: d, fill: { solid: [d] } });
/** ¿El trazo `d` queda entero a 1.5 de aire de la nube (k, o)? (3 de centro a centro, por fuera.) */
function clearOf(d, k, o) {
  const outline = parse(cloud(k, o))[0].segs.flatMap((sg) => Array.from({ length: 40 }, (_, i) => at(sg, i / 40)));
  const inside = cloudZone(k, o, 0);
  return parse(d)[0].segs.every((sg) =>
    Array.from({ length: 21 }, (_, i) => at(sg, i / 20)).every((p) => !inside.some((f) => f(p)) && Math.min(...outline.map((q) => len(sub(p, q)))) >= GAP),
  );
}
{
  // Dos nubes: la de adelante va encima como insignia propia; la de atrás, completa.
  add('clouds', ['nublado', 'nubes', 'cielo cubierto', 'clouds', 'overcast'], [cloud(0.6, [4, -3.4])], { badge: cloudBadge(cloud(0.82, [-1.25, 2.4])) });
}
{
  // Sol detrás de la nube: arriba a la izquierda; la nube va encima como insignia propia. Solo se
  // dibujan los rayos que quedan enteros a 1.5 de aire de ella (uno a medias sería un fragmento).
  const k = 0.72;
  const o = [2.75, 3.75];
  const s = [9.5, 9.5];
  add('cloud-sun', ['parcialmente nublado', 'medio nublado', 'sol y nubes', 'partly cloudy'], [circ(...s, 2.5), ...sunRays(s, 2.5).filter((r) => clearOf(r, k, o))], {
    badge: cloudBadge(cloud(k, o)),
  });
  // La luna esconde su cuerno de abajo detrás de la nube (con el cuerno junto a ella, el despeje
  // dejaba una astilla de su punta).
  add('cloud-moon', ['noche nublada', 'luna y nubes', 'clima', 'partly cloudy night', 'cloudy night'], [moon([9, 9], 6, [14, 7], 5.25)], { badge: cloudBadge(cloud(k, o)) });
}
{
  const drops = [[8, 17.25], [12, 17.25], [16, 17.25]];
  add('cloud-rain', ['lluvia', 'lluvioso', 'chubascos', 'rain'], [rainCloud(), ...drops.map(([x, y]) => line([x, y], [x - 1.5, y + 4]))]);
  // Llovizna: la misma inclinación que la lluvia, en rayas cortas y alternadas.
  const dash = ([x, y]) => line([x, y], [x - 0.7, y + 2]);
  add('cloud-drizzle', ['llovizna', 'lluvia ligera', 'chipi chipi', 'drizzle', 'light rain'], [rainCloud(), ...[[6.75, 17.25], [10.5, 19.25], [14.25, 17.25], [18, 19.25]].map(dash)]);
  // Nieve: copos de seis brazos.
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
  // Tornado: la boca del embudo es una elipse completa; debajo, vueltas (medias elipses) que se
  // angostan y se mecen hacia los lados.
  const turn = (cx, y, rx, ry = 1.25) => `M${pt([cx - rx, y])}A${N(rx)} ${N(ry)} 0 0 0 ${pt([cx + rx, y])}`;
  add('tornado', ['tornado', 'huracán', 'remolino', 'tormenta', 'tornado', 'twister'], [
    ell([12, 5.25], 9, 1.75),
    turn(12.5, 9.75, 6.5, 1),
    turn(12, 14.25, 4.5, 1),
    turn(11, 18.75, 2.5, 1),
  ]);
}
{
  // Copo: seis brazos que salen de un centro hueco; cada uno con un par de ramas que se abren
  // hacia afuera, como crece el cristal.
  const SIX = [-90, -30, 30, 90, 150, 210];
  const branch = (a) => head(polar(12, 12, 5.5, a), [-Math.cos(rad(a)), -Math.sin(rad(a))], 2.5, 50);
  add('snowflake', ['copo de nieve', 'frío', 'congelado', 'invierno', 'snowflake', 'freeze'], [
    ...SIX.map((a) => line(polar(12, 12, 3, a), polar(12, 12, 9, a))),
    ...SIX.map(branch),
  ]);
}
{
  // Arcoíris que baja hasta una nube: tres bandas en arco con sus patas; la nube va encima como
  // insignia propia y el motor despeja las patas de la derecha con 1.5 de aire.
  const band = (c, r, foot) => `M${pt([c[0] - r, foot])}V${N(c[1])}A${N(r)} ${N(r)} 0 0 1 ${pt([c[0] + r, c[1]])}V${N(foot)}`;
  const C = [11, 12.5];
  add('rainbow', ['arcoíris', 'después de la lluvia', 'esperanza', 'diversidad', 'rainbow', 'pride'], [8.25, 5.25, 2.25].map((r) => band(C, r, 17.25)), {
    badge: cloudBadge(cloud(0.46, [4.9, 5.4])),
  });
}
{
  // Termómetro: tubo de 5.8 (el mercurio a 1.4 de aire de las paredes) que remata en un bulbo de
  // radio 4.5; el mercurio baja hasta el centro del bulbo.
  const thermo = (x = 12, top = 8.75) => {
    const [w, R, yb] = [2.9, 4.5, 16.75];
    const yi = yb - Math.sqrt(R * R - w * w);
    return [`M${N(x - w)} ${N(yi)}V${N(2.75 + w)}A${N(w)} ${N(w)} 0 0 1 ${N(x + w)} ${N(2.75 + w)}V${N(yi)}A${N(R)} ${N(R)} 0 1 1 ${N(x - w)} ${N(yi)}Z`, line([x, top], [x, yb])];
  };
  // El mercurio en tres tramos que se tocan (se ven como uno): sus niveles, del bulbo hacia arriba.
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
  // Gota de agua: la gota del isotipo con la esquina recta hacia arriba, y un brillo.
  const drop2 = ([cx, cy], r) => {
    const a = polar(cx, cy, r, -45);
    const b = polar(cx, cy, r, -135);
    return `M${pt(a)}A${N(r)} ${N(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
  };
  add('droplet', ['gota', 'agua', 'líquido', 'droplet', 'water'], [drop2([12, 13.5], 7.25), arcd(12, 13.5, 4.25, 100, 165)]);
  add('droplets', ['humedad', 'gotas', 'agua', 'humidity', 'droplets'], [drop2([9, 15], 5.75), drop2([17.5, 7.25], 3)]);
}

// ── Naturaleza ────────────────────────────────────────────────────────────────────────────────
/** Elipse de semiejes rx, ry girada `tilt` grados, como cuatro cúbicas. */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const P = (x, y) => plus(c, rot([x, y], [0, 0], tilt));
  return `M${pt(P(rx, 0))}C${pt(P(rx, k * ry))} ${pt(P(k * rx, ry))} ${pt(P(0, ry))}C${pt(P(-k * rx, ry))} ${pt(P(-rx, k * ry))} ${pt(P(-rx, 0))}C${pt(P(-rx, -k * ry))} ${pt(P(-k * rx, -ry))} ${pt(P(0, -ry))}C${pt(P(k * rx, -ry))} ${pt(P(rx, -k * ry))} ${pt(P(rx, 0))}Z`;
}

/** Lente: dos arcos de radio R entre A y B (hoja, pétalo). */
const lens = (A, B, R) => `M${pt(A)}A${N(R)} ${N(R)} 0 0 1 ${pt(B)}A${N(R)} ${N(R)} 0 0 1 ${pt(A)}Z`;

/**
 * Contorno de la unión de varios círculos [x, y, r] ordenados en sentido horario alrededor de
 * `c`: en cada uno, el arco exterior entre sus cruces con el anterior y el siguiente.
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
  // Árbol: copa de tres círculos (unión) y el tronco que nace en la muesca de abajo.
  const cs = [[7.5, 11, 4.25], [12, 6.75, 4.75], [16.5, 11, 4.25]];
  const u = union(cs, [12, 10]);
  add('tree', ['árbol', 'parque', 'naturaleza', 'sustentable', 'tree', 'nature'], [u.d, line([12, 21.25], [12, 10.25]), line([12, 13.75], [14.75, 11])]);
}
// Pino: la misma construcción que `tree` (el tronco entra a la copa y saca una rama), con la copa
// en triángulo.
add('tree-pine', ['pino', 'bosque', 'árbol', 'navidad', 'conífera', 'pine', 'forest'], [
  roundpoly([[12, 2.75], [19, 17.75], [5, 17.75]], [1.25, 1.5, 1.5]),
  line([12, 21.25], [12, 9.75]),
  line([12, 15.75], [13.9, 13.85]),
]);
{
  // Palmera: tronco curvo y cuatro palmas que caen desde la corona.
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
  // Flor: cinco pétalos (unión de círculos), el centro y el tallo con una hoja.
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
  // Llama: base redonda que sube a una punta inclinada; dentro, la gota del isotipo.
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
  // Fogata: la llama sobre dos leños que se apoyan hacia el centro (no se cruzan: despejar un
  // cruce tan abierto se comía medio leño).
  add('campfire', ['fogata', 'campamento', 'fuego', 'acampar', 'campfire', 'bonfire'], [
    ...flame([12, 10.25], 5, [12.75, 2.5]),
    line([4.25, 21], [10, 18.25]),
    line([19.75, 21], [14, 18.25]),
  ]);
}
{
  // Montañas: el pico de atrás completo y el de adelante encima como insignia propia: el motor
  // despeja al de atrás con 1.5 de aire exacto (también su suelo junto al de adelante).
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
  // Planeta: el anillo pasa por delante del disco abajo y por detrás arriba. La mitad de adelante va
  // encima como insignia propia (despeja el disco con 1.5 de aire); los dos arcos de la mitad de
  // atrás terminan a 1.5 de aire del disco (3 de centro a centro).
  const C = [12, 12];
  const R = 5.5;
  const [rx, ry] = [10.5, 2];
  const tilt = -18;
  const E = (t) => plus(C, rot([rx * Math.cos(rad(t)), ry * Math.sin(rad(t))], [0, 0], tilt));
  /** Arco del anillo de t0 a t1 (grados del parámetro, creciente = sentido horario). */
  const ring = (t0, t1) => `M${pt(E(t0))}A${N(rx)} ${N(ry)} ${N(tilt)} 0 1 ${pt(E(t1))}`;
  /** Parámetro (0–90) donde el anillo está a `d` del centro. */
  const atDist = (d) => deg(Math.acos(Math.sqrt((d * d - ry * ry) / (rx * rx - ry * ry))));
  const tb = atDist(R + GAP);
  const front = `${ring(0, 90)}${ring(90, 180).replace(/^M[^A]+/, '')}`;
  // El área que despeja: el tramo de adelante que cruza el disco, de ida y vuelta (sin área); sus
  // puntas quedan a más de 1.5 de aire de los arcos de atrás.
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
  // Huella de zapato: suela ovalada y tacón, girada hacia afuera.
  const print = (c, tilt) => {
    const at = (dx, dy) => plus(c, rot([dx, dy], [0, 0], tilt));
    return [ell(at(0, 0), 2.6, 3.9, tilt), ell(at(0, 7.4), 2.2, 1.5, tilt)];
  };
  add('footprints', ['huellas', 'pasos', 'rastro', 'footprints', 'steps'], [...print([7.5, 9.75], -12), ...print([16.5, 6.75], 12)]);
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
  // Pez: el cuerpo es la gota del isotipo con la esquina apuntando a la cola; la cola, un
  // triángulo que nace de esa esquina.
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
  // Agua: tres ondas en fase, de amplitud 1 y periodo 6 (cúbicas cuyo pico es exactamente 1).
  const wave = (y, x0 = 3, n = 6, h = 3, a = 1) => {
    let d = `M${pt([x0, y])}`;
    for (let i = 0; i < n; i++) {
      const s = i % 2 ? 1 : -1;
      const x = x0 + i * h;
      d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
    }
    return d;
  };
  // La del medio, más corta y al centro, rompe la repetición de tres líneas iguales.
  add('water', ['agua', 'río', 'lago', 'mar', 'oleaje', 'water'], [wave(7.5), wave(12, 6, 4), wave(16.5)]);
}

// ── Viaje ─────────────────────────────────────────────────────────────────────────────────────
add('luggage', ['maleta', 'equipaje', 'viaje', 'hospedaje', 'luggage', 'suitcase'], [
  sq(5.25, 6.5, 13.5, 12.5, 3, BR),
  roundline([[9.25, 6.5], [9.25, 3.25], [14.75, 3.25], [14.75, 6.5]], [0, 1, 1, 0]),
  line([9.5, 10], [9.5, 15.5]),
  line([14.5, 10], [14.5, 15.5]),
  line([8.25, 19], [8.25, 21]),
  line([15.75, 19], [15.75, 21]),
]);
{
  // Pasaporte: la libreta (esquina inferior derecha recta) con el globo (aro y meridiano, sin
  // ecuador para no empastarse a 18 px) y la línea de datos.
  const g = [12, 10.75];
  const r = 3.75;
  add('passport', ['pasaporte', 'viaje', 'documento de viaje', 'identidad', 'passport', 'travel'], [
    sq(4.75, 2.75, 14.5, 18.5, 3.5, BR),
    circ(...g, r),
    `M${pt([g[0], g[1] - r])}C${pt([g[0] + 2, g[1] - r * 0.55])} ${pt([g[0] + 2, g[1] + r * 0.55])} ${pt([g[0], g[1] + r])}C${pt([g[0] - 2, g[1] + r * 0.55])} ${pt([g[0] - 2, g[1] - r * 0.55])} ${pt([g[0], g[1] - r])}Z`,
    line([9, 17.75], [15, 17.75]),
  ]);
}

// ── Cobertura (ronda 2): lo que faltaba de lugares, comida, clima y objetos ──────────────────
// Granizo: la nube de lluvia y tres granos (puntos) en lugar de gotas.
add('cloud-hail', ['granizo', 'granizada', 'tormenta de hielo', 'clima', 'hail', 'sleet'], [rainCloud(), dot(8, 18.5), dot(16, 18.5), dot(12, 20.75)]);
{
  // Restaurante: el tenedor (tres dientes en U y el mango que nace del de en medio) y el cuchillo
  // (lomo recto, filo curvo y el mango en la línea del lomo).
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
  // Café: la taza (recipiente: la esquina inferior derecha recta), el asa en D y dos hilos de
  // vapor a 3 del borde (con tres se leían como «zzz»).
  const wisp = (x) => `M${N(x)} 7C${N(x - 0.8)} 6.25 ${N(x - 0.8)} 5.5 ${N(x)} 4.85S${N(x + 0.8)} 3.5 ${N(x)} 2.75`;
  add('coffee', ['café', 'cafetería', 'taza', 'descanso', 'coffee', 'cafe', 'break'], [
    roundpoly([[4.25, 10], [16.25, 10], [16.25, 21.25], [4.25, 21.25]], [0.75, 0.75, 0, 3.5]),
    roundline([[16.25, 12.5], [19.75, 12.5], [19.75, 17.25], [16.25, 17.25]], [0, 1.75, 1.75, 0]),
    wisp(8.25),
    wisp(12.25),
  ]);
}
{
  // Birrete: el tablero en rombo, la copa que baja de sus bordes y la borla que cuelga del borde
  // derecho, a 3 de la copa (las puntas de los lados, más agudas, llevan radio 0.75 para que la
  // borla nazca del tramo recto).
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
  // Puerta: la hoja con el remate de arriba redondeado, parada sobre el piso, y la perilla.
  const leaf = roundline([[6, 21.25], [6, 2.75], [18, 2.75], [18, 21.25]], [0, 2.5, 2.5, 0]);
  const floor = line([3.25, 21.25], [20.75, 21.25]);
  add('door', ['puerta', 'entrada', 'acceso', 'habitación', 'door', 'entrance', 'room'], [leaf, floor, dot(14.25, 12.5)]);
  // Abierta: el marco vacío y la hoja que gira hacia adentro sobre las bisagras de la izquierda
  // (en perspectiva, su borde libre es más corto). Sin perilla: en la hoja angosta no cabe con
  // 1.5 de aire.
  add('door-open', ['puerta abierta', 'entrar', 'bienvenida', 'check-in', 'door open', 'enter', 'welcome'], [
    roundline([[6, 21.25], [6, 2.75], [18, 2.75], [18, 21.25]], [0, 1.25, 1.25, 0]),
    floor,
    roundline([[6, 4.75], [11.75, 6.5], [11.75, 19.5], [6, 21.25]], [0, 0.75, 0.75, 0]),
  ]);
}
{
  // Reciclar: tres flechas que se persiguen alrededor de un triángulo; cada una dobla una esquina
  // y deja 3.5 de hueco a la cola de la siguiente.
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
  // Binoculares: dos lentes grandes abajo y, sobre cada uno, el cuerpo que se angosta hasta el
  // ocular (sus lados son tangentes al lente); el puente une los cuerpos.
  const y = 15;
  const r = 4;
  /** Punto donde la recta que baja de T toca el círculo (C, r); side = 1 por fuera, -1 por dentro. */
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
  // El puente toca los cuerpos: sus extremos son los lados de adentro a la altura y = 9.
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
  // Mancuerna (gimnasio): dos discos, la barra entre ellos y los remates que asoman por fuera.
  const plate = (x) => sq(x, 5.5, 3.5, 13, 1.5);
  add('dumbbell', ['gimnasio', 'pesas', 'ejercicio', 'entrenar', 'gym', 'fitness', 'workout'], [
    plate(4.75),
    plate(15.75),
    line([8.25, 12], [15.75, 12]),
    line([2.5, 12], [4.75, 12]),
    line([19.25, 12], [21.5, 12]),
  ]);
}

// ── Relleno (DESIGN.md › Relleno) ─────────────────────────────────────────────────────────────
// Por índice de `d`: `solid` se rellena (y conserva su trazo: la silueta no cambia), `cut` se cala
// al ancho del trazo, `lines` sigue siendo línea, separada del relleno con 1.5 de aire, y `wire`
// sigue siendo línea pegada al relleno, sin aire (las tapas del reloj de arena, el poste de un
// letrero, el piso bajo la puerta, el asta de la bandera). En `solid` solo van figuras cerradas:
// `close` cierra por su cuerda los contornos abiertos que se rellenan (la U de una llanta o de la
// chimenea, la hoja de la puerta, el techo de la casa, la media luna del sol); casi siempre la
// cuerda cae sobre otro trazo del cuerpo (el piso, el suelo, el borde del casco o del techo).
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const FILL = {};
// Calendario (como el del núcleo): las argollas siguen siendo línea; se calan la cabecera y el glifo.
for (const name of ['calendar-plus', 'calendar-minus', 'calendar-check', 'calendar-x', 'calendar-range', 'calendar-event', 'calendar-day', 'calendar-clock'])
  FILL[name] = { solid: [0], lines: [1, 2], cut: range(3, icons[name].d.length) };
Object.assign(FILL, {
  // Las tapas van pegadas al vidrio y quedan enteras: la arena calada termina sobre la de abajo.
  hourglass: { solid: [0], wire: [1, 2] },
  'hourglass-end': { solid: [0], wire: [1, 2], cut: [3] },
  stopwatch: { solid: [0], wire: [1, 2, 3], cut: [4] },
  'clock-plus': { solid: [0], cut: [1] },
  'clock-check': { solid: [0], cut: [1] },
  'time-zone': { solid: [0], cut: [1] },
  // El sol a medias se rellena hasta el horizonte (su cuerda cae sobre él); los rayos y la flecha
  // siguen siendo línea.
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
  // El techo cerrado por la línea de sus aleros; los muros, por una cuerda que queda bajo el techo.
  house: { solid: [0, 1], cut: [2, 3], close: true },
  'office-building': { solid: [0], cut: range(1, 8) },
  factory: { solid: [0], cut: [1] },
  hospital: { solid: [0], cut: [1, 2, 3] },
  // El toldo y el local se rellenan juntos (calar su lindero dejaba una ranura suelta); las
  // rayas del toldo y la puerta se calan.
  'corner-shop': { solid: [0, 3], cut: [1, 2, 4], close: true },
  ship: { solid: [0, 1, 2], close: true },
  // Clima: los cuerpos (sol, luna, nubes) se rellenan; rayos, gotas, copos y rachas siguen siendo
  // línea. Lo que va detrás de una nube-insignia se rellena entero y el motor lo despeja.
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
  // Naturaleza
  droplet: { solid: [0], cut: [1] },
  droplets: { solid: [0, 1] },
  // Los tallos y troncos van pegados a lo que sostienen (la rama del árbol queda dentro de la copa).
  tree: { solid: [0], wire: [1] },
  flower: { solid: [0, 3], wire: [2], cut: [1] },
  sprout: { solid: [1, 2], wire: [0, 3] },
  cactus: { solid: [0], wire: [1], close: true },
  flame: { solid: [0], cut: [1] },
  // Los leños no tocan la llama: siguen siendo línea, con su aire.
  campfire: { solid: [0], lines: [2, 3], cut: [1] },
  mountain: { solid: [0] },
  'mountain-snow': { solid: [0] },
  // La ola se cierra por su base: el pie queda recto entre sus dos remates.
  wave: { solid: [0], close: true },
  'shooting-star': { solid: [0], lines: [1, 2, 3] },
  footprints: { solid: [0, 1, 2, 3] },
  paw: { solid: [0, 1, 2, 3, 4] },
  cat: { solid: [0], cut: [1, 2, 3] },
  fish: { solid: [0, 1], cut: [2] },
  tent: { solid: [0], cut: [1] },
  volcano: { solid: [0], lines: [1, 2, 3] },
  // Viaje y objetos: el asa de la maleta sigue siendo línea con su aire (como la del maletín del
  // núcleo); las ruedas, pegadas al cuerpo.
  luggage: { solid: [0], wire: [4, 5], lines: [1], cut: [2, 3] },
  passport: { solid: [0], cut: [1, 2, 3] },
  // La copa del birrete se cierra contra el tablero; la borla cuelga pegada a él.
  'graduation-cap': { solid: [0, 1], wire: [2], close: true },
  // La hoja de la puerta se cierra por el piso.
  door: { solid: [0], wire: [1], cut: [2], close: true },
  // Cada cuerpo se cierra por la cuerda de su lente; el puente los une, pegado.
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
// Despertador: la carátula rellena, cada campana es la medialuna que deja su arco con 1.5 de aire
// y las patas van pegadas a la carátula; se calan las manecillas o el signo.
for (const name of ['alarm-clock', 'alarm-plus', 'alarm-check'])
  icons[name].fill = { solid: [icons[name].d[0], ...BELLS.map((b) => b.lune)], wire: ALARM_LEGS, cut: icons[name].d.slice(5) };
icons['alarm-off'].fill = { solid: [icons['alarm-off'].d[0], BELLS[1].lune], wire: ALARM_LEGS };
// Ruta: los extremos rellenos y el camino pegado a ellos (cerrado por su cuerda se rellenaba).
icons.route.fill = { solid: [icons.route.d[0], icons.route.d[2]], wire: [icons.route.d[1]] };
// Auto y taxi: la cabina (el vidrio), las llantas y el letrero se cierran contra la carrocería; la
// cabina se separa de ella por la línea de su techo, calada.
for (const name of ['car', 'taxi']) {
  const d = icons[name].d;
  icons[name].fill = { solid: [d[0], ...[d[1], d[2], d[3], ...d.slice(6)].map(shut)], cut: [line([6.75, 10.25], [17.25, 10.25]), d[4], d[5]] };
}
// Cama: el colchón se rellena (su cuerpo cerrado es el mismo contorno) y la almohada flota con su
// aire; la cabecera, el borde del colchón con la pata y la base van pegados a él.
{
  const [head, top, frame, pillow] = icons.bed.d;
  const mattress = roundpoly([[3.25, 11.75], [17.75, 11.75], [20.75, 14.75], [20.75, 16.75], [3.25, 16.75]], [0, 2.5, 2.5, 0, 0]);
  icons.bed.fill = { solid: [mattress, pillow], wire: [head, top, frame] };
}
// Ancla: el aro relleno y las puntas como uñas sólidas (cada punta cerrada por su base); la caña,
// el cepo y el brazo curvo van pegados.
{
  const [ring, shank, stock, bow, ...tips] = icons.anchor.d;
  icons.anchor.fill = { solid: [ring, ...tips.map(shut)], wire: [shank, stock, bow] };
}
// Persona caminando: la cabeza rellena; brazos y piernas siguen siendo línea, sin aire (con aire
// morderían la cabeza).
icons.walking.fill = { solid: [icons.walking.d[0]], wire: icons.walking.d.slice(1) };
// Surtidor y cargador: el cuerpo relleno, la manguera pegada a él; se calan la ventanilla o el rayo.
for (const name of ['gas-station', 'ev-charger']) {
  const [body, mark, hose] = icons[name].d;
  icons[name].fill = { solid: [body], wire: [hose], cut: [mark] };
}
// Arcoíris: las bandas son solo líneas (cerradas por su cuerda se fundían en un arco macizo); en el
// relleno se ven igual y la nube-insignia se rellena sola.
icons.rainbow.fill = false;
// Paraguas: la tela rellena; el mango pegado a ella.
icons.umbrella.fill = { solid: [icons.umbrella.d[0]], wire: [icons.umbrella.d[1]] };
// Hoja: el tallo que asoma, pegado a la punta; dentro, la nervadura se cala desde 2.8 de la punta
// (calada desde la punta, cortaba el tallo).
icons.leaf.fill = { solid: [icons.leaf.d[0]], wire: [line([3.25, 20.75], [5.5, 18.5])], cut: [line([7.5, 16.5], [14.25, 9.75])] };
// Pino: el tronco de afuera, pegado a la copa; dentro, se cala desde 1.5 de su base con la rama
// que sale de él.
icons['tree-pine'].fill = { solid: [icons['tree-pine'].d[0]], wire: [line([12, 21.25], [12, 17.75])], cut: [line([12, 16.25], [12, 9.75]), icons['tree-pine'].d[2]] };
// Planeta: el disco relleno; los arcos de atrás siguen siendo línea y la mitad de adelante
// (insignia) también.
icons.planet.fill = { solid: [icons.planet.d[0]], lines: icons.planet.d.slice(1) };
// Cubiertos y taza: los dientes del tenedor, los mangos y el asa siguen siendo línea, pegada
// (cerrados por su cuerda se volvían una pala y una D maciza); el filo del cuchillo, relleno.
{
  const [tines, fork, blade, knife] = icons.utensils.d;
  icons.utensils.fill = { solid: [blade], wire: [tines, fork, knife] };
  const [cup, handle, ...steam] = icons.coffee.d;
  icons.coffee.fill = { solid: [cup], wire: [handle], lines: steam };
}
// Puerta abierta: la hoja rellena, cerrada contra el marco; el marco sigue siendo línea (cerrado
// por el piso, se rellenaba el vano entero) y, como el piso, va pegado.
icons['door-open'].fill = { solid: [shut(icons['door-open'].d[2])], wire: icons['door-open'].d.slice(0, 2) };
// Ciudad: los dos edificios rellenos (el de la derecha se cierra contra la torre); se cala su
// lindero (el muro de la torre que el otro tapa).
icons.city.fill = { solid: [icons.city.d[0], shut(icons.city.d[1])], cut: [line([12.75, 9], [12.75, 21.25]), ...icons.city.d.slice(2)] };
// Solo líneas abiertas: su relleno es el mismo contorno.
// El temporizador es un aro abierto (relleno, su cuerda lo volvía un disco mordido).
for (const name of ['timer', 'clock-forward', 'bicycle', 'road', 'wind', 'snowflake', 'palm-tree', 'water', 'recycle']) icons[name].fill = false;

// ── Piezas con nombre (DESIGN.md › Piezas con nombre) ─────────────────────────────────────────
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
  // Cada luz por separado: el semáforo enciende la que toca.
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

// ── Movimiento (DESIGN.md › Movimiento) ───────────────────────────────────────────────────────
// La insignia de reloj gira sus manecillas en su lugar (centro 17.25, 17.25).
const BC = [17.25, 17.25];
const MOTION = {
  'calendar-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'time-zone': { effect: 'spin', parts: ['badge'], origin: BC },
  // El reloj de arena se voltea; el que ya se vació se sacude.
  hourglass: { effect: 'spin', origin: [12, 12] },
  'hourglass-end': { effect: 'wiggle', origin: [12, 20.75] },
  timer: { effect: 'spin', parts: ['hand'], origin: [12, 12] },
  stopwatch: { effect: 'spin', parts: ['hand'], origin: [12, 13.25] },
  'alarm-clock': { effect: 'ring', origin: ALARM },
  'alarm-plus': { effect: 'ring', origin: ALARM },
  'alarm-check': { effect: 'ring', origin: ALARM },
  'clock-forward': { effect: 'spin', parts: ['hands'], origin: [12, 12] },
  'clock-plus': { effect: 'spin', parts: ['hands'], origin: [12, 12] },
  'clock-check': { effect: 'spin', parts: ['hands'], origin: [12, 12] },
  sunrise: { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] },
  sunset: { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  // Los pines saltan (como el pin del núcleo); el que señala un punto o un área salta solo.
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
  // Los vehículos de frente brincan en su suspensión; los de perfil avanzan hacia donde miran.
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
  // Clima: los rayos giran, las nubes se desplazan, la lluvia cae inclinada, la nieve flota, el
  // granizo rebota y el rayo late.
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
  // Naturaleza: lo que crece se mece desde su raíz; el fuego titila; el agua se desplaza.
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

// ── Variantes automáticas (DESIGN.md › Variantes) ─────────────────────────────────────────────
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// Con insignia: el encierro relleno no la dibuja y al 58 % deja de leerse; el tache la atravesaría.
offV(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });
// Relojes: ya vienen en su aro.
offV(['timer', 'stopwatch', 'clock-forward'], { circle: false });
offV(['compass'], { circle: false });
// El letrero de indicaciones ya es su propio marco.
offV(['directions'], { circle: false, square: false });
offV(['parking'], { square: false });
// Ya dicen «no»: tacharlos no agrega nada.
offV(['calendar-x', 'map-pin-x'], { slash: false });
// El despertador ya tiene su versión apagada dibujada a mano (alarm-off).
offV(['alarm-clock'], { slash: false });

// ── Niveles (DESIGN.md › Niveles): el mercurio sube del bulbo hacia arriba ──────────────────
icons.thermometer.levels = [[1], [2], [3]];
// El brillo del sol: a medias, los cuatro rayos de los ejes; lleno, también los diagonales.
for (const name of ['sun', 'sun-dim']) icons[name].levels = [[1, 3, 5, 7], [2, 4, 6, 8]];

// ── Espejo (DESIGN.md › Espejo) ───────────────────────────────────────────────────────────────
// La vuelta de las indicaciones sigue la dirección de lectura.
for (const name of ['directions']) icons[name].mirror = true;

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// El motor ajusta al pixel cada ícono y cambia solo las insignias estándar a su versión de pixel.
// Aquí van solo los dibujos que aun así no se leen; un `small` no lo ajusta el motor: va por
// centros de pixel (0.75 + 1.5k) o, los puntos de 2 × 2 pixeles, por sus bordes (múltiplos de 1.5),
// y si lleva insignia, la de pixel del motor (`badge(kind, { size: 16 })`).
// Reloj y globo con insignia: con la carátula centrada en 12 las manecillas caían entre pixeles. A
// 16 px la carátula se centra en un pixel (11.25, medio pixel hacia la esquina libre), con la
// manecilla de los minutos de 3 pixeles y la de la hora a 45°; el meridiano se abre 2 pixeles.
{
  const face = circ(11.25, 11.25, 9);
  const hands = line([11.25, 6.75], [11.25, 11.25], [8.25, 8.25]);
  for (const name of ['clock-plus', 'clock-check']) icons[name].small = { d: [face, hands], fill: { solid: [face], cut: [hands] }, badge: badge(icons[name].badge.kind, { size: 16 }) };
  const meridian = 'M11.25 2.25A15 15 0 0 1 11.25 20.25A15 15 0 0 1 11.25 2.25Z';
  icons['time-zone'].small = { d: [face, meridian], fill: { solid: [face], cut: [meridian] }, badge: badge('clock', { size: 16 }) };
}
// Día marcado: el punto de 0.7 caía entre pixeles (una mancha gris). El calendario de 12 × 11
// pixeles con su centro en un borde de pixel y el punto de 2 × 2 pixeles justo al centro.
{
  const body = sq(3.75, 5.25, 16.5, 15, 3.5, BR);
  const rings = [line([8.25, 2.25], [8.25, 6.75]), line([15.75, 2.25], [15.75, 6.75])];
  const header = line([3.75, 9.75], [20.25, 9.75]);
  const mark = dot(12, 15, 1);
  icons['calendar-day'].small = { d: [body, ...rings, header, mark], fill: { solid: [body], lines: rings, cut: [header, mark] } };
}

// Oficina y ciudad: las ventanas de r 0.3 desaparecían. Ventanas de 2 × 2 pixeles con 1 pixel
// de aire entre ellas y a los muros; muros y puerta por centros de pixel.
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
// Agua: las ondas de amplitud 1 se volvían barras grises. Ondas de amplitud 1.5 (sus crestas en
// centros de pixel) con 2 pixeles de aire entre ellas.
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
// Arcoíris: tres bandas y la nube no caben (1 pixel entre bandas, la nube una mancha). Dos medios
// arcos con 2 pixeles de aire, con sus extremos y crestas en centros de pixel. Solo líneas: en el
// relleno se ven igual.
{
  const band = (r) => `M${N(12 - r)} 16.5A${N(r)} ${N(r)} 0 0 1 ${N(12 + r)} 16.5`;
  icons.rainbow.small = { d: [band(8.25), band(3.75)] };
}
// Indicaciones: el rombo con sus lados a 45° por centros de pixel y la vuelta de 2 × 3 pixeles,
// a 1.5 de aire del rombo.
{
  const sign = roundpoly([[12, 3], [21, 12], [12, 21], [3, 12]], 2.25);
  const turn = roundline([[9.75, 14.25], [9.75, 11.25], [15.75, 11.25]], [0, 1.5, 0]);
  const tip = line([13.5, 9], [15.75, 11.25], [13.5, 13.5]);
  icons.directions.small = { d: [sign, turn, tip], fill: { solid: [sign], cut: [turn, tip] } };
}
// Brújula: a 16 px las cuatro marcas caladas volvían el relleno una mancha; solo el aro y la aguja.
icons.compass.small = { d: [icons.compass.d[0], icons.compass.d[1]], fill: { solid: [icons.compass.d[0]], cut: [icons.compass.d[1]] } };
// Varios lugares: el pin chico se pegaba al grande. Pines separados casi 2 pixeles; el grande con
// su hueco.
{
  const big = [16.5, 8.25];
  const d = [pin(big, 4.5), circ(...big, 1.5), pin([5.25, 14.25], 2.75)];
  icons['map-pins'].small = { d, fill: { solid: [d[0], d[2]], cut: [d[1]] } };
}
// Binoculares: los cuerpos cónicos y los lentes se empastaban. Lentes de r 3.75 por centros de
// pixel, cuerpos rectos tangentes a ellos (cerrados por el diámetro del lente) y el puente pegado;
// 2 pixeles entre los lentes.
{
  const lenses = [circ(6, 15, 3.75), circ(18, 15, 3.75)];
  const body = (x) => roundline([[x - 3.75, 15], [x - 3.75, 5.25], [x + 3.75, 5.25], [x + 3.75, 15]], [0, 1.5, 1.5, 0]);
  const bodies = [body(6), body(18)];
  const bridge = line([9.75, 9.75], [14.25, 9.75]);
  icons.binoculars.small = { d: [...lenses, ...bodies, bridge], fill: { solid: [...lenses, ...bodies.map(shut)], wire: [bridge] } };
}
// Pasaporte: el globo con meridiano era una mancha; a 16 px el globo es un aro de 2.5 pixeles.
{
  const book = sq(5.25, 2.25, 13.5, 19.5, 3, BR);
  const globe = circ(12, 10.5, 3.75);
  const data = line([9.75, 17.25], [14.25, 17.25]);
  icons.passport.small = { d: [book, globe, data], fill: { solid: [book], cut: [globe, data] } };
}
// Tornado: cuatro vueltas de 1 pixel de alto se volvían barras. La boca y dos vueltas de 2 pixeles
// de hondo, con 2 pixeles de aire, que se mecen un pixel.
{
  const turn = (cx, y, rx) => `M${N(cx - rx)} ${N(y)}A${N(rx)} 1.5 0 0 0 ${N(cx + rx)} ${N(y)}`;
  const mouth = ellipse(12, 5.25, 8.25, 1.5);
  const d = [mouth, turn(12, 11.25, 5.25), turn(10.5, 17.25, 2.25)];
  icons.tornado.small = { d, fill: { solid: [mouth], lines: d.slice(1) } };
}

// Pines: el aro de r 2.5 y los signos caían entre pixeles (una mancha). El pin con su centro en
// un pixel (medio pixel a la derecha) y su círculo en centros de pixel (r 7.5); el aro con 3
// pixeles de hueco y los signos de 5 pixeles, sus tramos rectos y sus diagonales por centros de
// pixel.
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
