// Tiempo, lugares y naturaleza: calendario, reloj, mapas, edificios, transporte, clima y
// naturaleza. Todo se calcula con el motor (engine/geometry.mjs) y las reglas de DESIGN.md: trazo
// de 1.5, keylines, esquinas continuas y la esquina inferior derecha recta en los contenedores.
import { arc, badge, circ, dot, drop, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

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

// ── Recorte ───────────────────────────────────────────────────────────────────────────────────
// Cuando una pieza pasa detrás de otra se corta con 1.5 de aire (3 de centro a centro). Se lee
// el path como segmentos (recta, cúbica, arco), se quitan los tramos que caen dentro de alguna
// región y se vuelve a escribir.
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

function piece(s, t0, t1) {
  if (s.k === 'L') return { k: 'L', a: at(s, t0), b: at(s, t1) };
  if (s.k === 'A') return { ...s, a: at(s, t0), b: at(s, t1), t0: s.t0 + s.dt * t0, dt: s.dt * (t1 - t0) };
  const split = (c, t) => {
    const p01 = lerp(c.a, c.c1, t);
    const p12 = lerp(c.c1, c.c2, t);
    const p23 = lerp(c.c2, c.b, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const m = lerp(p012, p123, t);
    return [
      { k: 'C', a: c.a, c1: p01, c2: p012, b: m },
      { k: 'C', a: m, c1: p123, c2: p23, b: c.b },
    ];
  };
  const right = t0 > 0 ? split(s, t0)[1] : s;
  return t1 < 1 ? split(right, (t1 - t0) / (1 - t0))[0] : right;
}

function write(segs, closed) {
  let o = `M${pt(segs[0].a)}`;
  for (const s of segs) {
    if (s.k === 'L') o += `L${pt(s.b)}`;
    else if (s.k === 'C') o += `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.b)}`;
    else o += `A${N(s.r)} ${N(s.r)} 0 ${Math.abs(s.dt) > Math.PI ? 1 : 0} ${s.dt > 0 ? 1 : 0} ${pt(s.b)}`;
  }
  return closed ? `${o}Z` : o;
}

/** Tramos [t0, t1] de un segmento que quedan fuera de todas las regiones. */
function keep(s, out) {
  const n = 200;
  const inside = (t) => out.some((f) => f(at(s, t)));
  const res = [];
  let prev = inside(0);
  let start = prev ? null : 0;
  for (let j = 1; j <= n; j++) {
    const t = j / n;
    const now = inside(t);
    if (now !== prev) {
      let lo = (j - 1) / n;
      let hi = t;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (inside(mid) === prev) lo = mid;
        else hi = mid;
      }
      const edge = (lo + hi) / 2;
      if (now) res.push([start, edge]);
      else start = edge;
      prev = now;
    }
  }
  if (!prev) res.push([start, 1]);
  return res.filter(([a, b]) => b - a > 1e-4);
}

/** Corta los trazos `ds` donde caen dentro de alguna región (tramos de menos de `min` se quitan). */
function cut(ds, out, min = 1) {
  const res = [];
  for (const d of [].concat(ds)) {
    for (const sp of parse(d)) {
      const runs = [];
      let run = null;
      let cutAny = false;
      sp.segs.forEach((s, j) => {
        const iv = keep(s, out);
        if (iv.length !== 1 || iv[0][0] > 0 || iv[0][1] < 1) cutAny = true;
        iv.forEach(([t0, t1], k) => {
          const p = piece(s, t0, t1);
          if (k === 0 && t0 === 0 && run && run.end === j - 1) run.segs.push(p);
          else {
            run = { segs: [p], first: j === 0 && t0 === 0 };
            runs.push(run);
          }
          run.end = t1 === 1 ? j : -9;
        });
        if (!iv.length) run = null;
      });
      if (!cutAny) {
        res.push(write(sp.segs, sp.closed));
        continue;
      }
      if (sp.closed && runs.length > 1 && runs[0].first && runs.at(-1).end === sp.segs.length - 1) {
        runs[0].segs = runs.pop().segs.concat(runs[0].segs);
      }
      for (const r of runs) {
        const L = r.segs.reduce((n, s) => n + len(sub(s.b, s.a)), 0);
        if (L > min) res.push(write(r.segs, false));
      }
    }
  }
  return res;
}

// Regiones de recorte.
const GAP = 3; // centro a centro: 1.5 de aire entre trazos de 1.5
const disc = (c, R) => (p) => len(sub(p, c)) < R;
function nearSeg(a, b, D = GAP) {
  return (p) => {
    const v = sub(b, a);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] ** 2 + v[1] ** 2)));
    return len(sub(p, lerp(a, b, t))) < D;
  };
}
function nearBox(x, y, w, h, D = GAP) {
  return (p) => {
    const dx = Math.max(x - p[0], 0, p[0] - x - w);
    const dy = Math.max(y - p[1], 0, p[1] - y - h);
    return Math.hypot(dx, dy) < D;
  };
}
/** Polígono convexo o no (regla par-impar), engrosado D. */
function nearPoly(pts, D = GAP) {
  return (p) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
    return pts.some((a, i) => nearSeg(a, pts[(i + 1) % pts.length], D)(p));
  };
}

/** Versión tachada: la diagonal cruza el ícono y lo corta con 1.5 de aire a cada lado. */
function off(ds, a = [3.5, 3.5], b = [20.5, 20.5]) {
  return [...cut(ds, [nearSeg(a, b)], 2.5), line(a, b)];
}

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
  // Dos bulbos rectos arriba y abajo que se angostan hasta el cuello; tapas a lo ancho.
  const side = (x, nx) => roundline([[x, 3.25], [x, 6.75], [nx, 12], [x, 17.25], [x, 20.75]], [0, 3, 1, 3, 0]);
  const glass = [line([5.25, 3.25], [18.75, 3.25]), line([5.25, 20.75], [18.75, 20.75]), side(7, 10.9), side(17, 13.1)];
  add('hourglass', ['reloj de arena', 'espera', 'tiempo', 'hourglass', 'wait'], glass);
  add('hourglass-end', ['tiempo agotado', 'reloj de arena', 'vencido', 'time up'], [...glass, `M9.25 20.75C9.75 18.5 10.75 17.75 12 17.75S14.25 18.5 14.75 20.75`]);
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
function alarm(inner) {
  const [C, r] = [ALARM, ALARM_R];
  const bell = (a) => cut(circ(...polar(...C, 8.5, a), 3.25), [disc(C, r + GAP)]);
  return [circ(...C, r), ...bell(-135), ...bell(-45), line(polar(...C, r, 130), polar(...C, r + 2.25, 130)), line(polar(...C, r, 50), polar(...C, r + 2.25, 50)), ...inner];
}
add('alarm-clock', ['alarma', 'despertador', 'recordatorio', 'alarm', 'alarm clock', 'wake up'], alarm([line([12, 9.5], [12, 13.25], [14.75, 14.75])]));
add('alarm-plus', ['nueva alarma', 'agregar alarma', 'despertador', 'add alarm', 'new alarm'], alarm([line([9.25, 13.25], [14.75, 13.25]), line([12, 10.5], [12, 16])]));
add('alarm-check', ['alarma activa', 'alarma lista', 'despertador', 'alarm set', 'alarm on'], alarm([line([9, 13.4], [11.1, 15.5], [15.1, 11.5])]));
add('alarm-off', ['alarma apagada', 'sin alarma', 'silenciar alarma', 'alarm off', 'snooze'], off(alarm([line([12, 9.5], [12, 13.25], [14.75, 14.75])])));

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
/** Región del pin engrosada (para recortar lo que pasa detrás). */
function pinZone([cx, cy], r, D = GAP) {
  const tip = [cx, cy + r * Math.SQRT2];
  return [disc([cx, cy], r + D), nearPoly([polar(cx, cy, r, 45), tip, polar(cx, cy, r, 135), [cx, cy]], D)];
}
/** Elipse con cuatro cúbicas (para poder recortarla). */
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
  // Área: el pin parado en el centro de una elipse que se abre a su paso.
  const c = [12, 8.25];
  const r = 5.5;
  add('map-pin-area', ['zona', 'área', 'radio de entrega', 'area', 'nearby'], [pin(c, r), circ(...c, 2), ...cut(ellipse(12, 16.75, 9, 3.5), pinZone(c, r))]);
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
add('bed', ['hotel', 'hospedaje', 'cama', 'dormir', 'bed', 'lodging'], [
  line([3.25, 4.75], [3.25, 20.25]),
  roundline([[3.25, 11.75], [17.75, 11.75], [20.75, 14.75], [20.75, 20.25]], [0, 2.5, 2.5, 0]),
  line([3.25, 16.75], [20.75, 16.75]),
  capsule(6.25, 7.25, 6, 4.5),
]);

// ── Transporte ────────────────────────────────────────────────────────────────────────────────
/** Lleva puntos: gira `deg` alrededor de (12, 12), escala `k` y mueve a `to`. */
const place = (pts, deg, k = 1, to = [12, 12]) => pts.map((p) => plus(to, scale(sub(rot(p, [12, 12], deg), [12, 12]), k)));

// Auto de frente: cabina trapezoidal sobre la carrocería, faros y llantas.
function car(cabinTop = 5.25) {
  return [
    sq(2.75, 10.25, 18.5, 7.5, 2.5),
    roundline([[4.6, 10.25], [6.75, cabinTop], [17.25, cabinTop], [19.4, 10.25]], [0, 1.4, 1.4, 0]),
    dot(6.75, 14),
    dot(17.25, 14),
    roundline([[5, 17.75], [5, 20.75], [8, 20.75], [8, 17.75]], [0, 0.75, 0.75, 0]),
    roundline([[16, 17.75], [16, 20.75], [19, 20.75], [19, 17.75]], [0, 0.75, 0.75, 0]),
  ];
}
add('car', ['auto', 'coche', 'carro', 'manejar', 'car'], car());
add('taxi', ['taxi', 'auto de alquiler', 'viaje', 'traslado', 'cab', 'ride'], [...car(6.5), roundline([[9.75, 6.5], [9.75, 3.75], [14.25, 3.75], [14.25, 6.5]], [0, 0.75, 0.75, 0])]);
add('bus', ['autobús', 'camión', 'transporte público', 'parada', 'bus', 'transit'], [
  sq(4.75, 2.75, 14.5, 15.75, 3.25),
  line([4.75, 6.5], [19.25, 6.5]),
  line([4.75, 12], [19.25, 12]),
  dot(8.25, 15.25),
  dot(15.75, 15.25),
  roundline([[6.75, 18.5], [6.75, 21.25], [9.25, 21.25], [9.25, 18.5]], [0, 0.75, 0.75, 0]),
  roundline([[14.75, 18.5], [14.75, 21.25], [17.25, 21.25], [17.25, 18.5]], [0, 0.75, 0.75, 0]),
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
// La nube es la de archivos (tres círculos y la base recta), calculada con arcos exactos para
// poder recortarla y recortar lo que pasa detrás. `k` escala alrededor de (12, 12) y `o` la mueve.
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
/** Región de la nube engrosada D (para recortar lo que pasa detrás). */
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
{
  const fk = 0.82;
  const fo = [-1.25, 2.4];
  const bk = 0.6;
  const bo = [4, -3.4];
  add('clouds', ['nublado', 'nubes', 'cielo cubierto', 'clouds', 'overcast'], [cloud(fk, fo), ...cut(cloud(bk, bo), cloudZone(fk, fo))]);
}
{
  // Sol detrás de la nube: arriba a la izquierda, recortado con 1.5 de aire; los rayos que
  // quedan miden 2, como los del sol.
  const k = 0.72;
  const o = [2.75, 3.75];
  const s = [9.5, 9.5];
  add('cloud-sun', ['parcialmente nublado', 'medio nublado', 'sol y nubes', 'partly cloudy'], [
    cloud(k, o),
    ...cut([circ(...s, 2.5), ...sunRays(s, 2.5)], cloudZone(k, o), 2),
  ]);
  add('cloud-moon', ['noche nublada', 'luna y nubes', 'clima', 'partly cloudy night', 'cloudy night'], [cloud(k, o), ...cut(moon([9, 9], 6, [12.5, 5.25], 4.75), cloudZone(k, o), 2)]);
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
  // Arcoíris que baja hasta una nube: tres bandas en arco con sus patas; las de la derecha pasan
  // detrás de la nube con 1.5 de aire.
  const band = (c, r, foot) => `M${pt([c[0] - r, foot])}V${N(c[1])}A${N(r)} ${N(r)} 0 0 1 ${pt([c[0] + r, c[1]])}V${N(foot)}`;
  const C = [11, 12.5];
  const k = 0.46;
  const o = [4.9, 5.4];
  add('rainbow', ['arcoíris', 'después de la lluvia', 'esperanza', 'diversidad', 'rainbow', 'pride'], [cloud(k, o), ...cut([8.25, 5.25, 2.25].map((r) => band(C, r, 17.25)), cloudZone(k, o), 1.5)]);
}
{
  // Termómetro: tubo de 5.8 (el mercurio a 1.4 de aire de las paredes) que remata en un bulbo de
  // radio 4.5; el mercurio baja hasta el centro del bulbo.
  const thermo = (x = 12, top = 8.75) => {
    const [w, R, yb] = [2.9, 4.5, 16.75];
    const yi = yb - Math.sqrt(R * R - w * w);
    return [`M${N(x - w)} ${N(yi)}V${N(2.75 + w)}A${N(w)} ${N(w)} 0 0 1 ${N(x + w)} ${N(2.75 + w)}V${N(yi)}A${N(R)} ${N(R)} 0 1 1 ${N(x - w)} ${N(yi)}Z`, line([x, top], [x, yb])];
  };
  add('thermometer', ['termómetro', 'temperatura', 'grados', 'thermometer', 'temperature'], thermo());
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
  // Fogata: la llama sobre dos leños que se apoyan hacia el centro (no se cruzan: el recorte de un
  // cruce tan abierto se comía medio leño).
  add('campfire', ['fogata', 'campamento', 'fuego', 'acampar', 'campfire', 'bonfire'], [
    ...flame([12, 10.25], 5, [12.75, 2.5]),
    line([4.25, 21], [10, 18.25]),
    line([19.75, 21], [14, 18.25]),
  ]);
}
{
  // Montañas: el pico de adelante completo y el de atrás que pasa detrás de él con 1.5 de aire;
  // la base del de atrás sigue la del de adelante como un solo suelo.
  const F = [[2.75, 19.75], [9.5, 5.75], [16.25, 19.75]];
  const foot = Math.atan2(F[2][1] - F[1][1], F[2][0] - F[1][0]);
  const t = 1 / Math.tan(foot / 2); // donde empieza el redondeo (radio 1) de la esquina derecha
  const front = roundpoly(F, [1, 1.25, 1]);
  const behind = (p) => p[1] < 18.5 && nearPoly(F)(p);
  const back = cut(roundline([[16.25 - t, 19.75], [21.25, 19.75], [16.25, 9.75], [11, 19.75]], [0, 1, 1.25, 0]), [behind], 1.5);
  add('mountain', ['montaña', 'cerro', 'paisaje', 'sierra', 'mountain', 'landscape'], [front, ...back]);
  const k = (F[1][0] - F[0][0]) / (F[0][1] - F[1][1]);
  const L = (y) => [F[1][0] - (y - F[1][1]) * k, y];
  const Rr = (y) => [F[1][0] + (y - F[1][1]) * k, y];
  add('mountain-snow', ['montaña nevada', 'cumbre', 'cima', 'nieve', 'snowy mountain', 'summit'], [front, ...back, line(L(10.75), [8.6, 12.25], [10.25, 10.75], Rr(11.75))]);
}
add('wave', ['ola', 'mar', 'océano', 'surf', 'wave', 'ocean'], [
  'M2.75 19.25C7.25 19.25 7.5 5 14.5 5A4.5 4.5 0 0 1 19 9.5A2.25 2.25 0 0 1 14.5 9.5C11.75 12.5 13 19.25 21.25 19.25',
]);
{
  // Planeta: el anillo pasa por delante abajo y por detrás arriba, con 1.5 de aire.
  const C = [12, 12];
  const R = 5.5;
  const [rx, ry] = [10.5, 2];
  const tilt = -18;
  const E = (t) => plus(C, rot([rx * Math.cos(rad(t)), ry * Math.sin(rad(t))], [0, 0], tilt));
  // La mitad de adelante como polilínea fina, para saber qué tanto del disco tapa.
  const half = (t0, t1) => Array.from({ length: 41 }, (_, i) => E(t0 + ((t1 - t0) * i) / 40));
  // Las dos mitades como cúbicas (cuatro cuartos de elipse girados).
  const quarter = (t0) => {
    const k = 0.5523;
    const a = E(t0);
    const b = E(t0 + 90);
    const ta = rot([-rx * Math.sin(rad(t0)), ry * Math.cos(rad(t0))], [0, 0], tilt);
    const tb = rot([-rx * Math.sin(rad(t0 + 90)), ry * Math.cos(rad(t0 + 90))], [0, 0], tilt);
    return `C${pt(plus(a, scale(ta, k)))} ${pt(sub(b, scale(tb, k)))} ${pt(b)}`;
  };
  const front = `M${pt(E(0))}${quarter(0)}${quarter(90)}`;
  const back = `M${pt(E(180))}${quarter(180)}${quarter(270)}`;
  const fp = half(0, 180);
  const nearFront = fp.slice(1).map((p, i) => nearSeg(fp[i], p));
  add('planet', ['planeta', 'espacio', 'saturno', 'planet', 'space'], [front, ...cut(back, [disc(C, R + GAP)]), ...cut(circ(...C, R), nearFront)]);
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

export default { category: 'lugares', label: 'Tiempo, lugares y naturaleza', icons };
