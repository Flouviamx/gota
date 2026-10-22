// Sistema, seguridad y estado: candados, llaves, biometría, escudos, ajustes, avisos, estados,
// logros, herramientas, accesibilidad y apariencia. Todo sale del motor (engine/geometry.mjs)
// más unas herramientas locales para construir piezas (encajar una figura dentro de otra, unir
// piezas que se tocan) y reutilizar las del núcleo sin redibujarlas. Lo que va encima de otra
// figura (insignias, el tache, la lupa, el desarmador) va en `badge`: la base se dibuja completa
// y el motor la despeja con 1.5 de aire exacto; nunca se recorta a mano. Ver DESIGN.md.
import { arc, badge, circ, dot, drop, f, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import nucleo from './nucleo.mjs';

// ── Trazos como segmentos ─────────────────────────────────────────────────────────────────
// parse() lleva un `d` a segmentos absolutos (L, C, A circular); ser() los regresa a `d`.
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;
const BR = { square: ['br'] };

/** Arco SVG (extremos + banderas) a centro, radio, ángulo inicial y barrido. */
function arcSeg(p0, p1, r, large, sweep) {
  const hx = (p0[0] - p1[0]) / 2;
  const hy = (p0[1] - p1[1]) / 2;
  const k2 = (hx * hx + hy * hy) / (r * r);
  if (k2 > 1) r *= Math.sqrt(k2);
  const num = r * r * r * r - r * r * (hx * hx + hy * hy);
  const den = r * r * (hx * hx + hy * hy);
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const c = [k * hy + (p0[0] + p1[0]) / 2, -k * hx + (p0[1] + p1[1]) / 2];
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let da = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  if (sweep && da < 0) da += 2 * Math.PI;
  if (!sweep && da > 0) da -= 2 * Math.PI;
  if (Math.abs(da) < 1e-9 && large) da = sweep ? 2 * Math.PI : -2 * Math.PI;
  return { t: 'A', c, r, a0, da };
}

function parse(d) {
  const tk = d.match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const subs = [];
  let sp = null;
  let i = 0;
  let cmd = '';
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let lc = null;
  const n = () => Number.parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    if (C === 'Z') {
      if (sp) {
        if (!near([x, y], [sx, sy], 1e-6)) sp.segs.push({ t: 'L', a: [x, y], b: [sx, sy] });
        sp.closed = true;
      }
      [x, y] = [sx, sy];
      sp = null;
      lc = null;
      continue;
    }
    if (C === 'M') {
      x = ox + n();
      y = oy + n();
      [sx, sy] = [x, y];
      sp = { segs: [], closed: false };
      subs.push(sp);
      cmd = rel ? 'l' : 'L';
      lc = null;
      continue;
    }
    if (!sp) {
      sp = { segs: [], closed: false };
      subs.push(sp);
      [sx, sy] = [x, y];
    }
    const a = [x, y];
    if (C === 'L' || C === 'H' || C === 'V') {
      if (C === 'L') {
        x = ox + n();
        y = oy + n();
      } else if (C === 'H') x = ox + n();
      else y = oy + n();
      sp.segs.push({ t: 'L', a, b: [x, y] });
      lc = null;
    } else if (C === 'C' || C === 'S') {
      const p1 = C === 'C' ? [ox + n(), oy + n()] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
      const p2 = [ox + n(), oy + n()];
      const p3 = [ox + n(), oy + n()];
      sp.segs.push({ t: 'C', p: [a, p1, p2, p3] });
      lc = p2;
      [x, y] = p3;
    } else if (C === 'A') {
      const r = n();
      n();
      n();
      const large = n();
      const sweep = n();
      const b = [ox + n(), oy + n()];
      sp.segs.push(arcSeg(a, b, r, large, sweep));
      [x, y] = b;
      lc = null;
    }
  }
  return subs;
}

function pt(s, t) {
  if (s.t === 'L') return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
  if (s.t === 'A') {
    const g = s.a0 + s.da * t;
    return [s.c[0] + s.r * Math.cos(g), s.c[1] + s.r * Math.sin(g)];
  }
  const [p0, p1, p2, p3] = s.p;
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [0, 1].map((k) => w[0] * p0[k] + w[1] * p1[k] + w[2] * p2[k] + w[3] * p3[k]);
}

function splitC(p, t) {
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [a, b, c] = [L(p[0], p[1]), L(p[1], p[2]), L(p[2], p[3])];
  const [d, e] = [L(a, b), L(b, c)];
  const m = L(d, e);
  return [
    [p[0], a, d, m],
    [m, e, c, p[3]],
  ];
}

function sub(s, t0, t1) {
  if (s.t === 'L') return { t: 'L', a: pt(s, t0), b: pt(s, t1) };
  if (s.t === 'A') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}

function segLen(s) {
  let n = 0;
  let a = pt(s, 0);
  for (let k = 1; k <= 16; k++) {
    const b = pt(s, k / 16);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
}

function segD(s) {
  if (s.t === 'L') return `L${P(s.b)}`;
  if (s.t === 'C') return `C${P(s.p[1])} ${P(s.p[2])} ${P(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(sub(s, 0, 0.5)) + segD(sub(s, 0.5, 1));
  return `A${f(s.r)} ${f(s.r)} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${P(pt(s, 1))}`;
}

function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = pt(sp.segs[0], 0);
    o += `M${P(last)}`;
    for (const s of sp.segs) {
      if (!near(pt(s, 0), last)) o += `M${P(pt(s, 0))}`;
      o += segD(s);
      last = pt(s, 1);
    }
    if (sp.closed) o += 'Z';
  }
  return o;
}

/** Deja de `d` solo lo que cumple keep(p); lo demás se corta con precisión de bisección. */
function clip(d, keep) {
  const out = [];
  for (const sp of parse(d)) {
    const pieces = [];
    sp.segs.forEach((s, i) => {
      const N = 96;
      let prev = keep(pt(s, 0));
      let start = prev ? 0 : null;
      for (let k = 1; k <= N; k++) {
        const now = keep(pt(s, k / N));
        if (now === prev) continue;
        let [lo, hi] = [(k - 1) / N, k / N];
        for (let j = 0; j < 30; j++) {
          const m = (lo + hi) / 2;
          if (keep(pt(s, m)) === prev) lo = m;
          else hi = m;
        }
        if (prev) pieces.push({ i, t0: start, t1: lo });
        else start = hi;
        prev = now;
      }
      if (prev) pieces.push({ i, t0: start, t1: 1 });
    });
    if (pieces.length === sp.segs.length && pieces.every((p) => p.t0 === 0 && p.t1 === 1)) {
      out.push(sp);
      continue;
    }
    const chains = [];
    for (const pc of pieces) {
      const last = chains.at(-1)?.at(-1);
      if (last && last.t1 === 1 && pc.t0 === 0 && pc.i === last.i + 1) chains.at(-1).push(pc);
      else chains.push([pc]);
    }
    if (sp.closed && chains.length > 1) {
      const a = chains[0][0];
      const z = chains.at(-1).at(-1);
      if (a.i === 0 && a.t0 === 0 && z.i === sp.segs.length - 1 && z.t1 === 1) chains[0] = [...chains.pop(), ...chains[0]];
    }
    for (const ch of chains) {
      const segs = ch.map((pc) => sub(sp.segs[pc.i], pc.t0, pc.t1));
      if (segs.reduce((n, s) => n + segLen(s), 0) > 0.3) out.push({ segs, closed: false });
    }
  }
  return ser(out);
}

/** Distancia con signo al contorno de una figura (negativa adentro si es cerrada). */
function field(d) {
  const polys = parse(d).map((sp) => ({ closed: sp.closed, pts: sp.segs.flatMap((s) => Array.from({ length: 33 }, (_, j) => pt(s, j / 32))) }));
  return (p) => {
    let best = Number.POSITIVE_INFINITY;
    let inside = false;
    for (const { closed, pts } of polys)
      for (let k = 1; k < pts.length; k++) {
        const [a, b] = [pts[k - 1], pts[k]];
        const vx = b[0] - a[0];
        const vy = b[1] - a[1];
        const L = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L));
        best = Math.min(best, Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t));
        if (closed && a[1] > p[1] !== b[1] > p[1] && p[0] < a[0] + ((p[1] - a[1]) * vx) / vy) inside = !inside;
      }
    return inside ? -best : best;
  };
}

/** Deja de `d` solo lo que queda fuera de `shape`: la pieza llega justo a su borde y lo toca (no es un recorte con aire). */
function outside(d, shape) {
  const F = field(shape);
  return clip(d, (p) => F(p) >= 0);
}

/** Deja de `d` solo lo que queda dentro de `shape` con `gap` entre ejes respecto a su contorno. */
function inside(d, shape, gap = 3) {
  const F = field(shape);
  return clip(d, (p) => F(p) <= -gap);
}

/** Semejanza (escala, giro, espejo, traslado) sobre un `d`. */
function xf(d, { s = 1, deg = 0, o = [12, 12], dx = 0, dy = 0, flipX = false } = {}) {
  const m = (p) => {
    let v = [(p[0] - o[0]) * s, (p[1] - o[1]) * s];
    if (flipX) v[0] = -v[0];
    v = rot(v, [0, 0], deg);
    return [v[0] + o[0] + dx, v[1] + o[1] + dy];
  };
  return ser(
    parse(d).map((sp) => ({
      closed: sp.closed,
      segs: sp.segs.map((g) => {
        if (g.t === 'L') return { t: 'L', a: m(g.a), b: m(g.b) };
        if (g.t === 'C') return { t: 'C', p: g.p.map(m) };
        const c = m(g.c);
        const a = m(pt(g, 0));
        return { t: 'A', c, r: g.r * s, a0: Math.atan2(a[1] - c[1], a[0] - c[0]), da: g.da * (flipX ? -1 : 1) };
      }),
    })),
  );
}

/** Polilínea abierta con esquinas redondeadas (como roundpoly, sin cerrar). */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let o = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = rr[i];
    if (!r) {
      o += `L${P(V)}`;
      continue;
    }
    const u = [A[0] - V[0], A[1] - V[1]];
    const w = [B[0] - V[0], B[1] - V[1]];
    const lu = Math.hypot(...u);
    const lw = Math.hypot(...w);
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (w[0] / lw) * t, V[1] + (w[1] / lw) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}

/** Los dos puntos donde se cruzan dos círculos (el primero a la izquierda de c1→c2). */
function meet(c1, r1, c2, r2) {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = [c1[0] + (a * dx) / d, c1[1] + (a * dy) / d];
  return [
    [m[0] + (h * dy) / d, m[1] - (h * dx) / d],
    [m[0] - (h * dy) / d, m[1] + (h * dx) / d],
  ];
}
const ang = (c, p) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
/** Arco de `from` a `to` sobre (c, r) por el lado cuyo punto medio cumple want(p). */
function arcPick(c, r, from, to, want) {
  const a0 = ang(c, from);
  const a1 = ang(c, to);
  const cw = a1 > a0 ? a1 : a1 + 360;
  const ccw = a1 < a0 ? a1 : a1 - 360;
  return arcTo(...c, r, a0, want(polar(...c, r, (a0 + cw) / 2)) ? cw : ccw);
}
/** Solo el comando A de un arc() del motor, para encadenarlo tras otro trazo. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]+/, '');

/** Un tramo recorrido al revés (para ir y volver por el mismo trazo). */
function reverse(s) {
  if (s.t === 'L') return { t: 'L', a: s.b, b: s.a };
  if (s.t === 'C') return { t: 'C', p: [...s.p].reverse() };
  return { ...s, a0: s.a0 + s.da, da: -s.da };
}
/**
 * El mismo trazo abierto de ida y vuelta: se ve idéntico (las vueltas son uniones redondas, como
 * las puntas) pero no encierra área. En `fill.solid`, una pieza abierta que sigue unida al cuerpo
 * sin rellenar su hueco (el asa del trofeo); en el `knock` de una insignia propia, el área de una
 * línea con las puntas redondas (el motor la despeja con el ancho del trazo + 3).
 */
const trace = (d) => ser(parse(d).map((sp) => (sp.closed ? sp : { closed: true, segs: [...sp.segs, ...sp.segs.toReversed().map(reverse)] })));

/** Insignia propia: lo que se dibuja encima, el área que el motor despeja y su relleno. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** El tache de los `-off`: va encima como insignia propia y el motor despeja la base a su paso. */
const slashOver = (a, b) => {
  const s = line(a, b);
  return own([s], trace(s));
};

// ── Glifos ───────────────────────────────────────────────────────────────────────────────
/** Check con las proporciones del check del núcleo, de ancho w y centrado en (cx, cy). */
const check = (cx, cy, w) => line([cx - 0.5 * w, cy + 0.036 * w], [cx - 0.183 * w, cy + 0.357 * w], [cx + 0.5 * w, cy - 0.357 * w]);
const plus = (cx, cy, a) => [line([cx, cy - a], [cx, cy + a]), line([cx - a, cy], [cx + a, cy])];
const minus = (cx, cy, a) => [line([cx - a, cy], [cx + a, cy])];
const ex = (cx, cy, a) => [line([cx - a, cy - a], [cx + a, cy + a]), line([cx + a, cy - a], [cx - a, cy + a])];
/** Exclamación: la vara de y0 a y1 y el punto 3.7 abajo (3 entre la vara y el punto), como en `important`. */
const bang = (cx, y0, y1) => [line([cx, y0], [cx, y1]), dot(cx, y1 + 3.7)];
/** Interrogación: gancho de radio r cuya cima toca `top`; la vara baja al centro y el punto queda 3.7 abajo. */
function question(cx, top, r = 2.6) {
  const cy = top + r;
  const a = arc(cx, cy, r, 165, 405);
  const [ex0, ey0] = a.end;
  const k = r * 0.38;
  const stem = cy + r * 1.35;
  return [`${a.d}C${P([ex0 + a.tangent[0] * k, ey0 + a.tangent[1] * k])} ${P([cx, stem - r * 0.45])} ${P([cx, stem])}`, dot(cx, stem + 3.7)];
}

// ── Piezas base ──────────────────────────────────────────────────────────────────────────
const CIRCLE = circ(12, 12, 9);
const SQUARE = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
const SHIELD = nucleo.icons.shield.d[0];
const [LOCK_BODY, LOCK_SHACKLE, LOCK_HOLE] = nucleo.icons.lock.d;
const [PERSON_HEAD, PERSON_BODY] = nucleo.icons.person.d;
const KEY = nucleo.icons.key.d;
const EYE = 'M2.75 12C5 7.75 8.25 5.5 12 5.5S19 7.75 21.25 12C19 16.25 15.75 18.5 12 18.5S5 16.25 2.75 12Z';
const PUPIL = circ(12, 12, 3.25);

/** Candado chico dentro de otra figura (ventana, escudo): cuerpo de w × h con la firma y su argolla. */
function padlock(x, y, w, h) {
  const r = Math.min(1.75, h / 3.2);
  const rs = w * 0.27;
  const cx = x + w / 2;
  const legs = h * 0.3;
  return [sq(x, y, w, h, r, BR), `M${P([cx - rs, y])}V${f(y - legs)}${arcTo(cx, y - legs, rs, 180, 360)}V${f(y)}`];
}

/** Centro de las insignias del motor (abajo a la derecha). */
const BC = [17.25, 17.25];

/** Bandera con la cola en V (reportar, hito). */
const FLAG = roundpoly([[4.75, 3.25], [19.75, 3.25], [16.25, 9.625], [19.75, 16], [4.75, 16]], [0, 0.9, 0.6, 0.9, 0]);

/** Cápsula horizontal (interruptores). */
const pill = (x, y, w, h) => {
  const r = h / 2;
  return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
};

/** Engrane de n dientes: cima de radio ro, raíz ri; los flancos se redondean. */
function gear(cx, cy, ro, ri, n, tip = 0.7, root = 0.9) {
  const step = 360 / n;
  const dt = step * 0.2;
  const db = step * 0.31;
  const pts = [];
  const rr = [];
  for (let i = 0; i < n; i++) {
    const a = -90 + i * step;
    pts.push(polar(cx, cy, ri, a - db), polar(cx, cy, ro, a - dt), polar(cx, cy, ro, a + dt), polar(cx, cy, ri, a + db));
    rr.push(root, tip, tip, root);
  }
  return roundpoly(pts, rr);
}

/** Curva cerrada suave por puntos (Catmull-Rom → Bézier). */
function smoothClosed(pts, k = 1 / 6) {
  const n = pts.length;
  const at = (i) => pts[(i + n) % n];
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    o += `C${P([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${P([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${P(p2)}`;
  }
  return `${o}Z`;
}

/** Sello festoneado: un círculo de radio R con n ondas de amplitud amp (cresta arriba). */
function scallop(cx, cy, R, amp, n) {
  const m = n * 4;
  return smoothClosed(Array.from({ length: m }, (_, k) => polar(cx, cy, R + amp * Math.cos((2 * Math.PI * n * k) / m), -90 + (k * 360) / m)));
}

/** Cola de listón de ancho w de `a` a `b`, con la punta en V; el borde de arriba queda abierto. */
function ribbon(a, b, w = 3.25, notch = 1.4) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  const n = [-u[1] * (w / 2), u[0] * (w / 2)];
  return rline([[a[0] - n[0], a[1] - n[1]], [b[0] - n[0], b[1] - n[1]], [b[0] - u[0] * notch, b[1] - u[1] * notch], [b[0] + n[0], b[1] + n[1]], [a[0] + n[0], a[1] + n[1]]], [0, 0.4, 0.4, 0.4, 0]);
}

// Roseta del premio y medalla con su cinta: la pieza de enfrente y la de atrás.
const ROSETTE = scallop(12, 9, 6.1, 0.4, 16);
const MEDAL = circ(12, 15.75, 5.25);
const STRAP = roundpoly([[6.25, 3.25], [10.25, 3.25], [12, 7], [13.75, 3.25], [17.75, 3.25], [14.25, 11.25], [9.75, 11.25]], [0.6, 0.6, 0.5, 0.6, 0.6, 0, 0]);

/** Una pieza dibujada a lo largo del eje x local, girada `deg` y con el punto `o` llevado a (12, 12). */
const place = (d, deg, o, to = [12, 12]) => xf(d, { deg, o, dx: to[0] - o[0], dy: to[1] - o[1] });

/** Llave inglesa en coordenadas locales: mango de x 0 a la cabeza (centro x L, radio 4.5). */
function wrench(L = 13) {
  const [R, h, w, dd] = [4.5, 1.75, 1.75, 0.25];
  const x1 = L - Math.sqrt(R * R - h * h);
  const xj = L + Math.sqrt(R * R - w * w);
  return `M0 ${f(-h)}H${f(x1)}A${R} ${R} 0 0 1 ${f(xj)} ${f(-w)}H${f(L + dd)}A${w} ${w} 0 0 0 ${f(L + dd)} ${f(w)}H${f(xj)}A${R} ${R} 0 0 1 ${f(x1)} ${f(h)}H0A${h} ${h} 0 0 1 0 ${f(-h)}Z`;
}
const WRENCH = wrench();

/** Lleva un grupo de trazos a que su caja (muestreada) quede centrada en (12, 12). */
function center(ds) {
  let [x0, y0, x1, y1] = [99, 99, -99, -99];
  for (const d of ds) for (const sp of parse(d)) for (const s of sp.segs) for (let k = 0; k <= 32; k++) {
    const [x, y] = pt(s, k / 32);
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  return ds.map((d) => xf(d, { dx: 12 - (x0 + x1) / 2, dy: 12 - (y0 + y1) / 2 }));
}
// Desarmador en coordenadas locales: mango de esquinas continuas, el casquillo (el escalón que lo
// distingue de una pluma), la estría del mango y la vara hasta x 18.5. Orden: mango, casquillo, estría, vara.
const DRIVER_HANDLE = sq(0, -3, 8.5, 6, 1.85);
const DRIVER = [DRIVER_HANDLE, outside(rline([[7, -1.75], [10.75, -1.75], [10.75, 1.75], [7, 1.75]], [0, 0.6, 0.6, 0]), DRIVER_HANDLE), line([2.75, 0], [5.75, 0]), line([10.75, 0], [18.5, 0])];

/** Corazón: dos lóbulos de radio r que bajan tangentes a la punta (cx, tipY). */
function heart(cx, cy, k, r, tipY) {
  const L = [cx - k, cy];
  const R = [cx + k, cy];
  const T = [cx, tipY];
  const tan = (C, side) => {
    const dv = [T[0] - C[0], T[1] - C[1]];
    return (Math.atan2(dv[1], dv[0]) + side * Math.acos(r / Math.hypot(...dv))) * (180 / Math.PI);
  };
  const dip = (Math.acos(k / r) * 180) / Math.PI;
  return `M${P(T)}L${P(polar(...L, r, tan(L, 1)))}${arcTo(...L, r, tan(L, 1), 360 - dip)}${arcTo(...R, r, 180 + dip, tan(R, -1) + 360)}Z`;
}

/** Estrella de cinco puntas con las esquinas suaves. */
const star = (cx, cy, R, r) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? r : R, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.45 : 0.7)));

// Clavija y contacto de un conector en coordenadas locales (eje x): la clavija hasta x 10.5.
const PLUG = [sq(2.5, -3.25, 5.75, 6.5, 1.75, { square: ['tr', 'br'] }), line([8.25, -1.6], [10.5, -1.6]), line([8.25, 1.6], [10.5, 1.6]), line([0, 0], [2.5, 0])];
const SOCKET = (x) => [sq(x, -3.25, 5.75, 6.5, 1.75, { square: ['tl', 'bl'] }), line([x + 5.75, 0], [x + 8.25, 0])];

/** Las cuatro esquinas de un marco de escaneo: la squircle del cuadrado, sin los centros. */
const SCAN = clip(sq(3.25, 3.25, 17.5, 17.5, 4.5), ([x, y]) => Math.abs(x - 12) > 4.25 && Math.abs(y - 12) > 4.25);

const icons = {
  // ── Candados y llaves ──
  'lock-open': {
    tags: ['candado abierto', 'desbloqueado', 'abrir', 'unlock', 'unlocked', 'open lock'],
    d: [sq(3.25, 10.25, 13.5, 11, 3.5, BR), `M12.95 10.25V7.4${arcTo(16.85, 7.4, 3.9, 180, 360)}V9.5`, line([10, 14.4], [10, 16.9])],
  },
  'lock-check': {
    tags: ['candado', 'protegido', 'verificado', 'seguro', 'secured', 'lock check', 'verified lock'],
    d: [LOCK_BODY, LOCK_SHACKLE, check(12, 15.6, 6.5)],
  },
  // Una exclamación no cabe en el cuerpo del candado con su punto a 3.7 y 1.5 de aire: el acceso
  // denegado se dice con la x, centrada en el cuerpo (10.25–21.25) y a 3 de sus bordes.
  'lock-x': {
    tags: ['acceso denegado', 'cuenta bloqueada', 'intentos fallidos', 'candado', 'access denied', 'locked out', 'lock error'],
    d: [LOCK_BODY, LOCK_SHACKLE, ...ex(12, 15.75, 2.35)],
  },
  // El candado del núcleo completo, corrido arriba a la izquierda: así el reloj del motor lo cruza
  // de frente (el borde de arriba del cuerpo queda lejos del aro) y la cerradura queda entera.
  'lock-clock': {
    tags: ['sesión expirada', 'bloqueo temporal', 'tiempo de espera', 'timeout', 'session expired', 'lock timer'],
    d: [LOCK_BODY, LOCK_SHACKLE, LOCK_HOLE].map((d) => xf(d, { dx: -2.25, dy: -1 })),
    badge: badge('clock'),
  },
  keyhole: {
    tags: ['cerradura', 'ojo de cerradura', 'acceso', 'privado', 'keyhole', 'access'],
    d: [CIRCLE, `${rline([polar(12, 10.25, 2.6, 62), [13.75, 16.25], [10.25, 16.25], polar(12, 10.25, 2.6, 118)], [0, 0.6, 0.6, 0])}${arcTo(12, 10.25, 2.6, 118, 422)}Z`],
  },
  password: {
    tags: ['contraseña', 'clave', 'campo de contraseña', 'pin', 'password', 'passcode'],
    d: [sq(2.5, 7, 19, 10, 3, BR), dot(6.5, 12), dot(10.5, 12), dot(14.5, 12), line([18.25, 10], [18.25, 14])],
  },
  'key-skeleton': {
    tags: ['llave maestra', 'llave antigua', 'acceso total', 'administrador', 'master key', 'skeleton key', 'admin'],
    // Llave antigua: argolla, el collarín junto a ella y el paletón escalonado en la punta
    d: [circ(6.75, 11.5, 4), line([10.75, 11.5], [21.25, 11.5]), line([13.75, 9.75], [13.75, 13.25]), rline([[16.75, 11.5], [16.75, 17.25], [19, 17.25], [19, 14.5], [21.25, 14.5], [21.25, 11.5]], [0, 0.75, 0.75, 0.6, 0.75, 0])],
  },
  // La persona al 85 % y la llave a su lado, con más de 1.5 de aire: no se tocan.
  passkey: {
    tags: ['passkey', 'llave de acceso', 'sin contraseña', 'identidad', 'webauthn', 'passwordless'],
    d: [
      xf(PERSON_HEAD, { s: 0.85, o: [12, 20.6], dx: -3, dy: -0.3 }),
      xf(PERSON_BODY, { s: 0.85, o: [12, 20.6], dx: -3 }),
      circ(18.25, 7.75, 2.75),
      line([18.25, 10.5], [18.25, 20.75]),
      line([18.25, 17.25], [20.5, 17.25]),
      line([18.25, 20.25], [20.5, 20.25]),
    ],
  },
  // La persona del núcleo completa, corrida a la izquierda; el candado del motor le toma el hombro.
  'person-lock': {
    tags: ['cuenta protegida', 'usuario bloqueado', 'perfil privado', 'user lock', 'private account'],
    d: [xf(PERSON_HEAD, { dx: -2.5 }), xf(PERSON_BODY, { dx: -2.5 })],
    badge: badge('lock'),
  },

  // ── Biometría y escaneo ──
  fingerprint: {
    tags: ['huella', 'huella digital', 'biometría', 'identidad', 'fingerprint', 'touch id', 'biometrics'],
    d: [
      // Crestas concéntricas a 3 entre sí; cada extremo queda a 3 de la cresta vecina
      `M3 14.5V11.75${arcTo(12, 11.75, 9, 180, 342)}`,
      `M6 16.25V11.75${arcTo(12, 11.75, 6, 180, 360)}V15.5C18 17.25 17.4 18.9 16.25 20.25`,
      `M9 20.75V11.75${arcTo(12, 11.75, 3, 180, 360)}V15.75`,
      line([12, 12], [12, 15.75]),
    ],
  },
  'face-scan': {
    tags: ['reconocimiento facial', 'rostro', 'biometría', 'face id', 'face recognition', 'face scan'],
    d: [SCAN, dot(9.25, 10), dot(14.75, 10), arc(12, 11.75, 3.75, 35, 145).d],
  },
  'iris-scan': {
    tags: ['escaneo de iris', 'retina', 'ojo', 'biometría', 'iris scan', 'eye scan'],
    d: [SCAN, `M6.5 12${arcTo(12, 12 + 3.6, 6.6, 213, 327)}${arcTo(12, 12 - 3.6, 6.6, 33, 147)}Z`, dot(12, 12)],
  },
  scan: {
    tags: ['escanear', 'escáner', 'lector', 'marco', 'scan', 'scanner'],
    d: [SCAN, line([6.75, 12], [17.25, 12])],
  },
  'two-factor': {
    tags: ['dos pasos', 'verificación', 'código', 'autenticación', '2fa', 'two-factor', 'otp'],
    d: [sq(6.25, 2.75, 11.5, 18.5, 3.25, BR), line([10.5, 5.75], [13.5, 5.75]), dot(9.25, 12.5, 0.3), dot(12, 12.5, 0.3), dot(14.75, 12.5, 0.3)],
  },

  // ── Privacidad ──
  // El ojo de edición completo; el tache va encima y el motor lo despeja a su paso.
  'eye-off': {
    tags: ['ocultar', 'privado', 'no visible', 'ocultar contraseña', 'hide', 'hidden', 'invisible'],
    d: [EYE, PUPIL],
    badge: slashOver([4, 4], [20, 20]),
  },
  // El ojo al 90 % arriba a la izquierda, con la pupila de r 2.5 (a 3 del párpado y del candado):
  // el candado del motor le toma la esquina del párpado de abajo.
  'eye-lock': {
    tags: ['privacidad', 'vista protegida', 'confidencial', 'privacy', 'confidential', 'protected view'],
    d: [xf(EYE, { s: 0.9, dx: -1.5, dy: -3 }), circ(10.5, 9, 2.5)],
    badge: badge('lock'),
  },
  incognito: {
    tags: ['incógnito', 'anónimo', 'navegación privada', 'espía', 'incognito', 'anonymous', 'private browsing'],
    d: [rline([[6.5, 10.25], [7.9, 4.25], [16.1, 4.25], [17.5, 10.25]], [0, 1.25, 1.25, 0]), line([2.75, 10.25], [21.25, 10.25]), circ(7.25, 16.25, 3), circ(16.75, 16.25, 3), `M10.25 16.25${arcTo(12, 17.15, 1.97, 207.2, 332.8)}`],
  },
  'window-lock': {
    tags: ['sitio seguro', 'https', 'conexión cifrada', 'página protegida', 'secure site', 'ssl'],
    d: [SQUARE, line([3.25, 7.75], [20.75, 7.75]), ...padlock(9.25, 13.75, 5.5, 4)],
  },
  // La tarjeta completa con dos renglones; el sello va dentro, a 3 de los bordes y de los renglones,
  // y sus listones bajan por encima del borde inferior (insignia propia: el motor despeja la tarjeta
  // a su paso, de frente).
  certificate: {
    tags: ['certificado', 'diploma', 'ssl', 'acreditación', 'certificate', 'credential'],
    d: [sq(2.5, 4, 19, 14, 3.25, BR), line([6, 8], [12, 8]), line([6, 11.5], [9.75, 11.5])],
    badge: (() => {
      const seal = circ(15.25, 12.5, 2.5);
      const tails = [line(polar(15.25, 12.5, 2.5, 115), [13.5, 21.25]), line(polar(15.25, 12.5, 2.5, 65), [17, 21.25])];
      return own([seal, ...tails], [seal, ...tails.map(trace)].join(''), { solid: [seal, ...tails] });
    })(),
  },
  firewall: {
    tags: ['firewall', 'muro', 'cortafuegos', 'protección de red', 'wall', 'network security'],
    // Muro de tres hiladas, la de en medio trabada a media pieza, en el ancho de la keyline
    // cuadrada (17.5) e hiladas de 4.75: a todo lo ancho (19 × 15) era el ícono más denso del set.
    d: (() => {
      const [x0, x1] = [3.25, 20.75];
      const w = (x1 - x0) / 3;
      const rows = [4.75, 9.5, 14.25, 19];
      const joints = (y0, y1, xs) => xs.map((x) => line([x, y0], [x, y1]));
      return [
        ...rows.map((y) => line([x0, y], [x1, y])),
        ...joints(rows[0], rows[1], [x0 + w, x0 + 2 * w]),
        ...joints(rows[1], rows[2], [x0 + w / 2, 12, x1 - w / 2]),
        ...joints(rows[2], rows[3], [x0 + w, x0 + 2 * w]),
      ];
    })(),
  },
  cookie: {
    tags: ['cookies', 'galleta', 'consentimiento', 'rastreo', 'cookie', 'tracking consent'],
    d: (() => {
      const bc = polar(12, 12, 9, -45);
      const [p1, p2] = meet([12, 12], 9, bc, 3.6);
      const a1 = ang([12, 12], p1);
      const a2 = ang([12, 12], p2);
      return [`M${P(p2)}${arcTo(12, 12, 9, a2, a1 + 360)}${arcTo(bc[0], bc[1], 3.6, ang(bc, p1), ang(bc, p2) - (ang(bc, p2) > ang(bc, p1) ? 360 : 0))}Z`, dot(8.25, 9.25), dot(13, 12.75), dot(8.75, 15.75), dot(15.75, 16.75)];
    })(),
  },

  // ── Escudos (el del núcleo ya lleva el check) ──
  'shield-empty': {
    tags: ['escudo', 'protección', 'seguridad', 'defensa', 'shield', 'protection', 'security'],
    d: [SHIELD],
  },
  'shield-x': {
    tags: ['desprotegido', 'amenaza', 'riesgo', 'bloqueado', 'unprotected', 'threat', 'security error'],
    d: [SHIELD, ...ex(12, 12, 2.6)],
  },
  'shield-alert': {
    tags: ['alerta de seguridad', 'vulnerabilidad', 'riesgo', 'advertencia', 'security warning', 'vulnerability'],
    d: [SHIELD, ...bang(12, 7.75, 12.25)],
  },
  'shield-plus': {
    tags: ['agregar protección', 'seguro', 'cobertura', 'activar seguridad', 'add security', 'insurance'],
    d: [SHIELD, ...plus(12, 12, 3.25)],
  },
  'shield-minus': {
    tags: ['quitar protección', 'reducir', 'excepción', 'remove security', 'exception'],
    d: [SHIELD, ...minus(12, 12, 3.25)],
  },
  'shield-lock': {
    tags: ['cifrado', 'protegido', 'bóveda', 'seguridad', 'encrypted', 'encryption', 'secure'],
    d: [SHIELD, ...padlock(9, 11.75, 6, 4.5)],
  },
  'shield-person': {
    tags: ['cuenta protegida', 'identidad', 'privacidad', 'datos personales', 'user security', 'identity protection'],
    d: [SHIELD, circ(12, 9.5, 2.25), inside(arc(12, 18.5, 4.75, 180, 360).d, SHIELD)],
  },
  'shield-off': {
    tags: ['sin protección', 'desactivado', 'inseguro', 'shield off', 'unsecured', 'disabled'],
    d: [SHIELD],
    badge: slashOver([3.75, 3.75], [20.25, 20.25]),
  },
  'shield-question': {
    tags: ['seguridad', 'duda', 'verificar', 'sospechoso', 'security question', 'unverified'],
    d: [SHIELD, ...question(12, 7, 2.4)],
  },

  // ── Información, ayuda y avisos ──
  info: {
    tags: ['información', 'detalles', 'acerca de', 'ayuda', 'info', 'information', 'about'],
    d: [CIRCLE, dot(12, 7.7), line([12, 11.4], [12, 16.75])],
  },
  'info-square': {
    tags: ['información', 'nota', 'detalles', 'aviso', 'info', 'information', 'note'],
    d: [SQUARE, dot(12, 7.7), line([12, 11.4], [12, 16.75])],
  },
  help: {
    tags: ['ayuda', 'pregunta', 'dudas', 'soporte', 'help', 'question', 'support'],
    d: [CIRCLE, ...question(12, 6.9, 2.6)],
  },
  'help-square': {
    tags: ['ayuda', 'pregunta', 'preguntas frecuentes', 'dudas', 'faq', 'help', 'question'],
    d: [SQUARE, ...question(12, 6.9, 2.6)],
  },
  'alert-octagon': {
    tags: ['error', 'alto', 'crítico', 'peligro', 'error alert', 'critical', 'danger'],
    d: [roundpoly(Array.from({ length: 8 }, (_, i) => polar(12, 12, 9.75, 22.5 + i * 45)), 2.25), ...bang(12, 7.4, 12.75)],
  },
  'close-octagon': {
    tags: ['detener', 'fallo', 'cancelado', 'alto', 'stop', 'halt', 'failed'],
    d: [roundpoly(Array.from({ length: 8 }, (_, i) => polar(12, 12, 9.75, 22.5 + i * 45)), 2.25), ...ex(12, 12, 3.25)],
  },
  'alert-square': {
    tags: ['aviso', 'atención', 'advertencia', 'warning', 'attention', 'notice'],
    d: [SQUARE, ...bang(12, 7.4, 12.75)],
  },
  'alert-diamond': {
    tags: ['precaución', 'advertencia', 'riesgo', 'caution', 'hazard', 'warning'],
    d: [roundpoly([[12, 1.75], [22.25, 12], [12, 22.25], [1.75, 12]], 3), ...bang(12, 7.6, 12.6)],
  },

  // ── Estados: círculo y cuadrado ──
  'check-circle': {
    tags: ['completado', 'aprobado', 'listo', 'éxito', 'success', 'done', 'approved'],
    d: [CIRCLE, check(12, 11.85, 9)],
  },
  'close-circle': {
    tags: ['error', 'rechazado', 'cancelar', 'fallido', 'failed', 'rejected', 'cancel'],
    d: [CIRCLE, ...ex(12, 12, 3.25)],
  },
  'plus-circle': {
    tags: ['agregar', 'nuevo', 'crear', 'sumar', 'add', 'create', 'new'],
    d: [CIRCLE, ...plus(12, 12, 4)],
  },
  'minus-circle': {
    tags: ['quitar', 'restar', 'reducir', 'eliminar', 'remove', 'subtract', 'minus'],
    d: [CIRCLE, ...minus(12, 12, 4)],
  },
  'check-square': {
    tags: ['casilla marcada', 'tarea hecha', 'seleccionado', 'checkbox', 'checked', 'task done'],
    d: [SQUARE, check(12, 11.85, 9)],
  },
  'close-square': {
    tags: ['cerrar', 'descartar', 'rechazar', 'dismiss', 'close', 'reject'],
    d: [SQUARE, ...ex(12, 12, 3.25)],
  },
  'plus-square': {
    tags: ['agregar', 'nuevo elemento', 'crear', 'expandir', 'add', 'new item', 'expand'],
    d: [SQUARE, ...plus(12, 12, 4)],
  },
  'minus-square': {
    tags: ['quitar', 'contraer', 'colapsar', 'collapse', 'remove', 'minus'],
    d: [SQUARE, ...minus(12, 12, 4)],
  },
  // El segundo check completo; el primero pasa por delante (insignia propia) y el motor despeja el
  // brazo corto del segundo a su paso.
  'check-double': {
    tags: ['leído', 'todo listo', 'confirmado', 'entregado', 'read', 'double check', 'delivered'],
    d: [line([9.25, 12.6], [13.1, 16.6], [21, 7.5])],
    badge: (() => {
      const a = line([2.75, 12.6], [6.6, 16.6], [14.5, 7.5]);
      return own([a], trace(a));
    })(),
  },

  // ── Carga y estados de proceso ──
  loader: {
    tags: ['cargando', 'progreso', 'espera', 'procesando', 'loading', 'progress', 'busy'],
    d: [arc(12, 12, 9, -90, 180).d],
  },
  spinner: {
    tags: ['cargando', 'procesando', 'espera', 'actividad', 'spinner', 'loading', 'activity indicator'],
    // Ocho rayos que se acortan detrás del que encabeza el giro: la estela se dibuja con el largo,
    // no con opacidad (un solo tono). El de arriba es el más largo; los anteriores, en sentido
    // contrario al reloj, pierden 0.4 cada uno (el último mide 2.2).
    d: Array.from({ length: 8 }, (_, i) => line(polar(12, 12, 4 + i * 0.4, -90 - i * 45), polar(12, 12, 9, -90 - i * 45))),
  },
  'status-pending': {
    tags: ['pendiente', 'por hacer', 'en espera', 'en cola', 'pending', 'to do', 'queued'],
    d: Array.from({ length: 8 }, (_, i) => arc(12, 12, 9, -101.25 + i * 45, -78.75 + i * 45).d),
  },
  'status-progress': {
    tags: ['en progreso', 'en curso', 'avance', 'a medias', 'in progress', 'ongoing', 'partial'],
    d: [CIRCLE, `M12 12V6${arcTo(12, 12, 6, -90, 0)}Z`],
  },
  block: {
    tags: ['bloquear', 'prohibido', 'sin acceso', 'no permitido', 'blocked', 'forbidden', 'banned'],
    d: [CIRCLE, line(polar(12, 12, 9, 225), polar(12, 12, 9, 45))],
  },
  // ── Ajustes y controles ──
  gear: {
    tags: ['ajustes', 'configuración', 'engranaje', 'opciones', 'settings', 'preferences', 'cog'],
    d: [gear(12, 12, 9.25, 6.9, 8), circ(12, 12, 3)],
  },
  // El engrane grande completo y el chico encima (insignia propia): se despeja un círculo de su
  // radio exterior, no el perfil de los dientes, para que el corte del grande sea un arco limpio. El
  // grande da un diente al chico y el arco lo cruza de frente, sin dejar trozos de diente.
  gears: {
    tags: ['ajustes avanzados', 'mecanismo', 'engranes', 'sistema', 'advanced settings', 'mechanism', 'cogs'],
    d: [gear(8.75, 8.75, 6.6, 4.85, 8, 0.6, 0.8), circ(8.75, 8.75, 1.85)],
    badge: (() => {
      const small = gear(...BC, 4.5, 3.15, 6, 0.55, 0.7);
      return own([small, dot(...BC)], circ(...BC, 4.5), { solid: [small], cut: [dot(...BC)] });
    })(),
  },
  'sliders-horizontal': {
    tags: ['ajustes', 'filtros', 'controles', 'ecualizador', 'adjustments', 'filters', 'controls'],
    d: nucleo.icons.sliders.d.map((d) => xf(d, { deg: 90 })),
  },
  preferences: {
    tags: ['preferencias', 'interruptores', 'opciones', 'activar funciones', 'preferences', 'toggles', 'switches'],
    // Dos interruptores apilados con 1.5 de aire; a esta altura la perilla es un punto en el
    // centro del remate (una perilla del radio de la pastilla se encimaba con su borde).
    d: [pill(3.25, 3.25, 17.5, 7.25), dot(20.75 - 3.625, 6.875), pill(3.25, 13.5, 17.5, 7.25), dot(3.25 + 3.625, 17.125)],
  },
  'toggle-on': {
    tags: ['encendido', 'activado', 'interruptor', 'switch on', 'enabled', 'toggle'],
    d: [pill(2.5, 6, 19, 12), circ(15.5, 12, 3)],
  },
  'toggle-off': {
    tags: ['apagado', 'desactivado', 'interruptor', 'switch off', 'disabled', 'toggle'],
    d: [pill(2.5, 6, 19, 12), circ(8.5, 12, 3)],
  },
  restart: {
    tags: ['reiniciar', 'reinicio', 'encender de nuevo', 'restart', 'reboot', 'power cycle'],
    d: (() => {
      const a = arc(12, 12.75, 8.25, -60, 240);
      return [a.d, head(a.end, a.tangent, 3.4), line([12, 2.75], [12, 11])];
    })(),
  },

  // ── Ayuda, reportes y errores ──
  lifebuoy: {
    tags: ['soporte', 'salvavidas', 'ayuda', 'rescate', 'support', 'lifebuoy', 'help'],
    d: [CIRCLE, circ(12, 12, 4), ...[45, 135, 225, 315].map((a) => line(polar(12, 12, 4, a), polar(12, 12, 9, a)))],
  },
  // La bandera llega a 16 para que la exclamación quepa con su punto a 3.7 y 1.5 de aire
  'flag-report': {
    tags: ['reportar', 'denunciar', 'marcar problema', 'incidencia', 'report', 'flag', 'abuse'],
    d: [line([4.75, 3.25], [4.75, 21.25]), FLAG, line([10.5, 6.35], [10.5, 8.35]), dot(10.5, 12.05)],
  },
  'flag-check': {
    tags: ['meta cumplida', 'hito', 'completado', 'llegada', 'milestone', 'goal reached', 'finish'],
    d: [line([4.75, 3.25], [4.75, 21.25]), FLAG, check(10.75, 9.625, 5.5)],
  },
  siren: {
    tags: ['alarma', 'incidente', 'emergencia', 'urgente', 'siren', 'incident', 'alarm'],
    d: [`M7 17.25V13.5${arcTo(12, 13.5, 5, 180, 360)}V17.25`, sq(4.75, 17.25, 14.5, 3.5, 1.1), ...[-90, -148, -32].map((a) => line(polar(12, 13.5, 8, a), polar(12, 13.5, 10, a)))],
  },
  'page-not-found': {
    tags: ['404', 'página no encontrada', 'error', 'página de error', 'not found', 'error page'],
    d: [SQUARE, line([3.25, 7.75], [20.75, 7.75]), dot(9.25, 12.5), dot(14.75, 12.5), arc(12, 19.25, 3.5, 236, 304).d],
  },
  // ── Logros e ideas ──
  verified: {
    tags: ['verificado', 'cuenta oficial', 'insignia', 'auténtico', 'verified', 'badge', 'authentic'],
    d: [scallop(12, 12, 8.35, 0.7, 12), check(12, 11.9, 7.25)],
  },
  'badge-star': {
    tags: ['insignia', 'destacado', 'logro', 'favorito', 'badge', 'featured', 'achievement'],
    d: [scallop(12, 12, 8.35, 0.7, 12), star(12, 12.35, 4.4, 1.9)],
  },
  award: {
    tags: ['premio', 'reconocimiento', 'roseta', 'galardón', 'award', 'prize', 'rosette'],
    // Los listones completos detrás; la roseta va encima (insignia propia) y el motor los despeja.
    // Nacen juntos bajo la roseta (se cruzan ahí, donde no se ven) y salen por su borde en la misma
    // línea de siempre.
    d: [ribbon([10.5, 8], [7.25, 21]), ribbon([13.5, 8], [16.75, 21])],
    badge: own([ROSETTE, circ(12, 9, 2.5)], ROSETTE, { solid: [ROSETTE], cut: [circ(12, 9, 2.5)] }),
  },
  trophy: {
    tags: ['trofeo', 'campeón', 'logro', 'ganador', 'trophy', 'winner', 'champion'],
    d: [
      `M7 3.75H17V9.25${arcTo(12, 9.25, 5, 0, 180)}Z`,
      `M7 5.5H5.5${arcTo(5.5, 7.75, 2.25, 270, 90)}H7.15`,
      `M17 5.5H18.5${arcTo(18.5, 7.75, 2.25, -90, 90)}H16.85`,
      line([12, 14.25], [12, 17.5]),
      sq(7.75, 17.5, 8.5, 3.25, 1),
    ],
  },
  'medal-ribbon': {
    tags: ['medalla', 'primer lugar', 'ganador', 'condecoración', 'medal', 'first place', 'winner'],
    // La cinta completa detrás; la medalla va encima (insignia propia) y el motor la despeja.
    d: [STRAP],
    badge: own([MEDAL, circ(12, 15.75, 2.25)], MEDAL, { solid: [MEDAL], cut: [circ(12, 15.75, 2.25)] }),
  },
  lightbulb: {
    tags: ['idea', 'foco', 'sugerencia', 'consejo', 'lightbulb', 'tip', 'hint'],
    d: (() => {
      const a = arc(12, 8.5, 6, 135, 405);
      const t = 1.2;
      const [ex0, ey0] = a.end;
      const [sx0, sy0] = polar(12, 8.5, 6, 135);
      return [`${a.d}C${P([ex0 - 0.707 * t, ey0 + 0.707 * t])} 14.25 14.4 14.25 15.25H9.75C9.75 14.4 ${P([sx0 + 0.707 * t, sy0 + 0.707 * t])} ${P([sx0, sy0])}Z`, line([9.75, 18.25], [14.25, 18.25]), line([10.75, 21.25], [13.25, 21.25])];
    })(),
  },
  'lightbulb-on': {
    tags: ['idea', 'inspiración', 'encendido', 'eureka', 'insight', 'bright idea', 'inspiration'],
    d: (() => {
      const [cx, cy, r] = [12, 11.5, 4.25];
      const a = arc(cx, cy, r, 135, 405);
      const [ex0, ey0] = a.end;
      const [sx0, sy0] = polar(cx, cy, r, 135);
      const t = 0.9;
      return [`${a.d}C${P([ex0 - 0.707 * t, ey0 + 0.707 * t])} 13.75 15.75 13.75 16.5H10.25C10.25 15.75 ${P([sx0 + 0.707 * t, sy0 + 0.707 * t])} ${P([sx0, sy0])}Z`, line([10.25, 19.5], [13.75, 19.5]), ...[-90, -140, -40, 180, 0].map((g) => line(polar(cx, cy, 7.25, g), polar(cx, cy, 9.5, g)))];
    })(),
  },
  'rocket-launch': {
    tags: ['lanzamiento', 'despegue', 'publicar', 'estreno', 'launch', 'go live', 'deploy'],
    d: [
      'M12 2.75C14.6 4.4 15.25 7.5 15.25 10.5V15.25H8.75V10.5C8.75 7.5 9.4 4.4 12 2.75Z',
      circ(12, 8.75, 1.6),
      rline([[8.75, 11.25], [5.75, 14.25], [5.75, 17.25], [8.75, 15.25]], [0, 0.8, 0.6, 0]),
      rline([[15.25, 11.25], [18.25, 14.25], [18.25, 17.25], [15.25, 15.25]], [0, 0.8, 0.6, 0]),
      rline([[10.25, 15.25], [12, 20.75], [13.75, 15.25]], [0, 0.8, 0]),
    ],
  },
  'target-arrow': {
    tags: ['meta', 'objetivo cumplido', 'diana', 'acierto', 'goal', 'target hit', 'bullseye'],
    // La diana completa; la flecha va encima (insignia propia) y la cruza de frente, en radio.
    d: [circ(10.75, 13.25, 8), circ(10.75, 13.25, 4.25)],
    badge: (() => {
      const arrow = [line([10.75, 13.25], [19.75, 4.25]), rline([[16.75, 3.75], [16.75, 7.25], [20.25, 7.25]], [0, 0.6, 0]), line([19.75, 4.25], [21.25, 2.75])];
      return own(arrow, arrow.map(trace).join(''));
    })(),
  },
  podium: {
    tags: ['podio', 'ranking', 'clasificación', 'primeros lugares', 'leaderboard', 'podium', 'top three'],
    d: [roundpoly([[3.25, 20.75], [3.25, 12.25], [8.75, 12.25], [8.75, 7.25], [15.25, 7.25], [15.25, 15.25], [20.75, 15.25], [20.75, 20.75]], [1, 1, 0, 1, 1, 0, 1, 0]), line([8.75, 12.25], [8.75, 20.75]), line([15.25, 15.25], [15.25, 20.75])],
  },

  // ── Herramientas y mantenimiento ──
  wrench: {
    tags: ['llave inglesa', 'herramienta', 'ajustar', 'reparar', 'wrench', 'spanner', 'fix'],
    d: [place(WRENCH, -45, [7.875, 0])],
  },
  screwdriver: {
    tags: ['desarmador', 'destornillador', 'herramienta', 'armar', 'screwdriver', 'tool', 'assemble'],
    d: DRIVER.map((d) => place(xf(d, { s: 1.08, o: [0, 0] }), -45, [10, 0])),
  },
  hammer: {
    tags: ['martillo', 'construir', 'herramienta', 'compilar', 'hammer', 'build', 'tool'],
    d: [roundpoly([[4.75, 4.25], [8, 3.25], [18.75, 3.25], [18.75, 8.75], [8, 8.75], [4.75, 7.75]], [0.6, 0.5, 1.25, 1.25, 0.5, 0.6]), `M10.5 8.75V19.5${arcTo(12, 19.5, 1.5, 180, 0)}V8.75`].map((d) => xf(d, { deg: 45, s: 0.94, dx: -1.6, dy: 1.6 })),
  },
  tools: {
    tags: ['herramientas', 'mantenimiento', 'reparar', 'servicio', 'tools', 'maintenance', 'repair'],
    // Llave de mango largo para que el cruce caiga a media empuñadura y no en el cuello (si no, la
    // cabeza quedaba suelta en dos trozos). La llave completa; el desarmador pasa adelante con la vara
    // más larga (insignia propia) y el motor despeja la llave a su paso.
    ...(() => {
      const key = place(xf(wrench(16), { s: 0.8, o: [0, 0] }), -45, [6.1, 0]);
      const driver = [DRIVER[0], DRIVER[1], line([10.75, 0], [23.25, 0])].map((d) => place(xf(d, { s: 0.76, o: [0, 0] }), -135, [12.35, 0]));
      const [k, ...dr] = center([key, ...driver]);
      return { d: [k], badge: own(dr, [dr[0], trace(dr[1]), trace(dr[2])].join(''), { solid: dr }) };
    })(),
  },
  'traffic-cone': {
    tags: ['mantenimiento', 'en obra', 'precaución', 'cono', 'under construction', 'traffic cone', 'caution'],
    d: [rline([[6.5, 17.5], [10.4, 3.25], [13.6, 3.25], [17.5, 17.5]], [0, 1, 1, 0]), sq(3.25, 17.5, 17.5, 3.25, 1), line([9.1, 8], [14.9, 8]), line([7.8, 12.75], [16.2, 12.75])],
  },
  barrier: {
    tags: ['barrera', 'en construcción', 'cerrado', 'desvío', 'roadblock', 'barrier', 'closed'],
    d: (() => {
      const board = sq(2.75, 5.75, 18.5, 7, 2);
      return [board, line([6.5, 12.75], [6.5, 20.75]), line([17.5, 12.75], [17.5, 20.75]), line([4.25, 20.75], [8.75, 20.75]), line([15.25, 20.75], [19.75, 20.75]), ...[6.25, 11, 15.75].map((x) => inside(line([x - 4, 14], [x + 4.5, 4.5]), board, 0))];
    })(),
  },
  'hard-hat': {
    tags: ['casco', 'mantenimiento', 'obra', 'construcción', 'hard hat', 'construction', 'safety'],
    d: [`M5 14.5V13${arcTo(12, 13, 7, 180, 360)}V14.5`, sq(2.75, 14.5, 18.5, 3.5, 1.1), line([10.5, 6.25], [10.5, 10]), line([13.5, 6.25], [13.5, 10])],
  },
  'hex-nut': {
    tags: ['tuerca', 'pieza', 'componente', 'hardware', 'nut', 'hex nut', 'component'],
    d: [roundpoly(Array.from({ length: 6 }, (_, i) => polar(12, 12, 9.5, -90 + i * 60)), 1.75), circ(12, 12, 3.75)],
  },
  // ── Más estados y controles ──
  checkbox: {
    tags: ['casilla', 'sin marcar', 'pendiente', 'opción', 'checkbox', 'unchecked', 'empty box'],
    d: [SQUARE],
  },
  'radio-selected': {
    tags: ['opción elegida', 'botón de opción', 'seleccionado', 'radio button', 'selected', 'option'],
    d: [CIRCLE, circ(12, 12, 4)],
  },
  'progress-bar': {
    tags: ['progreso', 'avance', 'barra de carga', 'porcentaje', 'progress', 'loading bar', 'completion'],
    // Riel de 8.5 de alto y el avance como una cápsula concéntrica a su remate, a 1.5 de aire
    d: [pill(2.5, 7.75, 19, 8.5), pill(5.5, 10.75, 8, 2.5)],
  },
  update: {
    tags: ['actualización del sistema', 'instalar', 'nueva versión', 'descargar actualización', 'update', 'software update', 'upgrade'],
    d: (() => {
      const a = arc(12, 12, 9, -150, -25);
      const b = arc(12, 12, 9, 30, 155);
      return [a.d, head(a.end, a.tangent, 3.4), b.d, head(b.end, b.tangent, 3.4), line([12, 7.25], [12, 16]), head([12, 16], [0, 1], 3.4)];
    })(),
  },
  'person-gear': {
    tags: ['ajustes de cuenta', 'perfil', 'configuración de usuario', 'account settings', 'user preferences', 'profile settings'],
    // La persona como en `person-lock`; el engrane, del tamaño del aro de las insignias, va en su
    // lugar (insignia propia) y se despeja su círculo exterior, no el perfil de los dientes.
    d: [xf(PERSON_HEAD, { dx: -2.5 }), xf(PERSON_BODY, { dx: -2.5 })],
    badge: (() => {
      const g = gear(...BC, 4.25, 3.05, 6, 0.45, 0.55);
      return own([g, dot(...BC)], circ(...BC, 4.25), { solid: [g], cut: [dot(...BC)] });
    })(),
  },
  // La llave del núcleo girada (el ojo arriba a la derecha) y al 90 %, a más de 1.5 del más.
  'key-plus': {
    tags: ['agregar llave', 'nueva credencial', 'registrar passkey', 'add key', 'new credential', 'add passkey'],
    d: KEY.map((d) => xf(d, { deg: 180, s: 0.9, dx: -2, dy: -2 })),
    badge: badge('plus'),
  },
  // El globo del núcleo al 76 % arriba a la izquierda: el candado del motor solo toma su contorno y
  // cruza el aro de frente; el ecuador y el meridiano quedan enteros (a 3 o más de su área).
  'globe-lock': {
    tags: ['vpn', 'red privada', 'acceso restringido', 'navegación segura', 'private network', 'secure web'],
    d: nucleo.icons.globe.d.map((d) => xf(d, { s: 0.76, dx: -3.25, dy: -3.25 })),
    badge: badge('lock'),
  },
  // El escudo del núcleo al 94 %; la lupa de las insignias (la de datos) va encima.
  'shield-search': {
    tags: ['auditoría', 'análisis de seguridad', 'escaneo', 'revisión', 'security scan', 'audit', 'inspection'],
    d: [xf(SHIELD, { s: 0.94, o: [12, 3], dx: -1.75 })],
    badge: (() => {
      const lens = circ(...BC, 3.25);
      const handle = line(polar(...BC, 3.25, 45), [21.25, 21.25]);
      return own([lens, handle], lens + trace(handle), { solid: [lens, handle] });
    })(),
  },
  'security-camera': {
    tags: ['cámara de seguridad', 'vigilancia', 'monitoreo', 'cctv', 'surveillance', 'security camera'],
    d: [roundpoly([[3.25, 9.25], [15.5, 4.75], [17.5, 10.25], [5.25, 14.75]], 1.5), rline([[13.5, 11.72], [14.5, 16.25], [20.75, 16.25]], [0, 1, 0]), line([20.75, 13.25], [20.75, 19.25]), dot(7.5, 10.75)],
  },
  radar: {
    tags: ['monitoreo', 'detección', 'radar', 'escaneo de red', 'detection', 'monitoring', 'sweep'],
    d: [CIRCLE, circ(12, 12, 4.25), line([12, 12], polar(12, 12, 9, -50)), dot(...polar(12, 12, 6.6, 145))],
  },
  'heart-pulse': {
    tags: ['salud del sistema', 'estado', 'monitoreo', 'latido', 'health', 'health check', 'uptime'],
    d: (() => {
      const h = heart(12, 8.75, 4.25, 4.65, 20.5);
      return [h, inside(line([2, 12.5], [9.25, 12.5], [10.75, 9.75], [13.25, 15.25], [14.75, 12.5], [22, 12.5]), h, 3)];
    })(),
  },
  stethoscope: {
    tags: ['diagnóstico', 'salud del sistema', 'revisión', 'chequeo', 'diagnostics', 'health check', 'stethoscope'],
    // Binaural en U, el tubo que baja y sube en curva hasta la campana; la campana queda a 3 del
    // arco de la U (1.5 de aire). Todo corrido 0.75 a la izquierda para centrarlo en el lienzo.
    d: (() => {
      const o = -0.75;
      return [
        `M${f(5.5 + o)} 3.25V8.75${arcTo(9 + o, 8.75, 3.5, 180, 0)}V3.25`,
        `M${f(9 + o)} 12.25V15.75${arcTo(13.25 + o, 15.75, 4.25, 180, 0)}`,
        circ(17.5 + o, 13, 2.75),
      ];
    })(),
  },
  virus: {
    tags: ['malware', 'virus', 'amenaza', 'infección', 'antivirus', 'threat', 'infection'],
    // Seis receptores en T: con puntos en las puntas se confundía con el sol (sun, sun-dim)
    d: [
      circ(12, 12, 5.25),
      ...Array.from({ length: 6 }, (_, i) => -90 + i * 60).flatMap((a) => {
        const tip = polar(12, 12, 8.1, a);
        const t = ((a + 90) * Math.PI) / 180;
        return [line(polar(12, 12, 5.25, a), tip), line([tip[0] - 1.5 * Math.cos(t), tip[1] - 1.5 * Math.sin(t)], [tip[0] + 1.5 * Math.cos(t), tip[1] + 1.5 * Math.sin(t)])];
      }),
    ],
  },
  'plug-connected': {
    tags: ['conectado', 'integración activa', 'enchufado', 'conexión', 'connected', 'plugged in', 'integration'],
    d: [...PLUG, ...SOCKET(10.5)].map((d) => place(d, -45, [9.375, 0])),
  },
  'plug-disconnected': {
    tags: ['desconectado', 'sin conexión', 'integración caída', 'disconnected', 'unplugged', 'offline'],
    d: [...PLUG, ...SOCKET(14)].map((d) => place(d, -45, [11.125, 0])),
  },

  command: {
    tags: ['atajo de teclado', 'comando', 'tecla', 'shortcut', 'command', 'keyboard shortcut'],
    d: [`M9 17.25V6.75${arcTo(6.75, 6.75, 2.25, 0, -270)}H17.25${arcTo(17.25, 6.75, 2.25, 90, -180)}V17.25${arcTo(17.25, 17.25, 2.25, 180, -90)}H6.75${arcTo(6.75, 17.25, 2.25, 270, 0)}Z`],
  },
  patch: {
    tags: ['parche', 'corrección', 'hotfix', 'curita', 'fix', 'patch', 'bandage'],
    d: [pill(-9.5, -3.5, 19, 7), line([-3.25, -3.5], [-3.25, 3.5]), line([3.25, -3.5], [3.25, 3.5]), dot(0, -1.35, 0.3), dot(0, 1.35, 0.3)].map((d) => place(d, -45, [0, 0])),
  },

  // ── Accesibilidad, apariencia e idioma ──
  accessibility: {
    tags: ['accesibilidad', 'inclusión', 'a11y', 'discapacidad', 'accessibility', 'inclusive', 'universal access'],
    // Cabeza, brazos y pies a 3 del aro y entre sí; el torso nace en los brazos y llega al vértice
    // de las piernas (que se tocan, no rozan)
    d: [CIRCLE, circ(12, 7.3, 1.3), rline([[6.75, 10.6], [12, 11.6], [17.25, 10.6]], [0, 2, 0]), line([12, 11.6], [12, 13.65]), line([9.6, 17.5], [12, 13.65], [14.4, 17.5])],
  },
  // La luna y el sol sueltos ya existen en lugares (moon, sun): el modo oscuro del sistema es
  // el interruptor encendido con la luna por perilla.
  'dark-mode': {
    tags: ['modo oscuro', 'tema oscuro', 'apariencia', 'dark mode', 'night mode', 'theme'],
    d: (() => {
      const [c1, r1, c2, r2] = [[14.5, 12], 4, [16.6, 10.1], 3.3];
      const [A, B] = meet(c1, r1, c2, r2);
      const out2 = (p) => Math.hypot(p[0] - c2[0], p[1] - c2[1]) > r2;
      const in1 = (p) => Math.hypot(p[0] - c1[0], p[1] - c1[1]) < r1;
      return [pill(2.5, 5, 19, 14), `M${P(A)}${arcPick(c1, r1, A, B, out2)}${arcPick(c2, r2, B, A, in1)}Z`];
    })(),
  },
  contrast: {
    tags: ['contraste', 'apariencia', 'tema', 'modo claro y oscuro', 'contrast', 'appearance', 'theme'],
    d: [CIRCLE, line([12, 3], [12, 21]), ...[-1, 4, 9].map((c) => inside(clip(line([12, 12 + c], [21, 3 + c]), ([x]) => x >= 12), CIRCLE, 0))],
  },
  language: {
    tags: ['idioma', 'región', 'localización', 'traducción', 'language', 'locale', 'localization'],
    // El globo del núcleo a dos tercios (r 6) arriba a la izquierda; el globo de conversación va
    // encima (insignia propia) y el motor despeja el mundo. Así el ecuador y el meridiano quedan a 3
    // o más de la gota: solo el contorno pasa detrás, y la cruza de frente. Renglones a 3 del borde.
    d: nucleo.icons.globe.d.map((d) => xf(d, { s: 2 / 3, dx: -4, dy: -4 })),
    badge: (() => {
      const bubble = drop(16.5, 16.5, 5.25);
      const rows = [line([14.85, 15], [18.15, 15]), line([14.85, 18], [17.1, 18])];
      return own([bubble, ...rows], bubble, { solid: [bubble], cut: rows });
    })(),
  },

  // ── Cobertura (ronda 2): signos, controles y emergencias que faltaban ──
  // Menos: la pareja de `plus` del núcleo (el mismo largo sobre el mismo eje).
  minus: {
    tags: ['menos', 'restar', 'quitar', 'reducir', 'minus', 'subtract', 'remove'],
    d: [line([4.25, 12], [19.75, 12])],
  },
  // Asterisco (campo obligatorio, nota al pie): seis brazos de 7 que se cruzan en el centro.
  asterisk: {
    tags: ['asterisco', 'obligatorio', 'campo requerido', 'nota', 'asterisk', 'required', 'footnote'],
    d: [-90, -30, 30].map((a) => line(polar(12, 12, 7, a), polar(12, 12, 7, a + 180))),
  },
  // Sincronizar: las dos flechas en círculo de `update`, sin la flecha de descarga.
  sync: {
    tags: ['sincronizar', 'sincronizando', 'actualizar datos', 'al día', 'sync', 'syncing', 'synchronize'],
    d: (() => {
      const a = arc(12, 12, 9, -150, -25);
      const b = arc(12, 12, 9, 30, 155);
      return [a.d, head(a.end, a.tangent, 3.4), b.d, head(b.end, b.tangent, 3.4)];
    })(),
  },
  // La opción sin elegir: la pareja de `radio-selected` (y de `checkbox`, que es el cuadro vacío).
  'radio-unselected': {
    tags: ['opción sin elegir', 'botón de opción', 'círculo', 'por hacer', 'radio button', 'unselected', 'circle'],
    d: [CIRCLE],
  },
  // Imán: la herradura (brazos de 4.5 que se unen en un arco) con sus polos marcados.
  magnet: {
    tags: ['imán', 'atraer', 'ajustar a la cuadrícula', 'captar clientes', 'magnet', 'snap', 'attract'],
    d: [
      'M4.5 4.5A1 1 0 0 1 5.5 3.5H8A1 1 0 0 1 9 4.5V12.75A3 3 0 0 0 15 12.75V4.5A1 1 0 0 1 16 3.5H18.5A1 1 0 0 1 19.5 4.5V12.75A7.5 7.5 0 0 1 4.5 12.75Z',
      line([4.5, 7.75], [9, 7.75]),
      line([15, 7.75], [19.5, 7.75]),
    ],
  },
  // Botiquín: el estuche (contenedor: la esquina inferior derecha recta), su asa y la cruz.
  'first-aid': {
    tags: ['primeros auxilios', 'botiquín', 'emergencia', 'salud', 'first aid', 'medical kit', 'emergency'],
    d: [
      sq(2.75, 7, 18.5, 13.5, 3.5, BR),
      rline([[9, 7], [9, 4.25], [15, 4.25], [15, 7]], [0, 1.25, 1.25, 0]),
      line([12, 10.75], [12, 16.75]),
      line([9, 13.75], [15, 13.75]),
    ],
  },
  // Silla de ruedas (accesibilidad física, el símbolo internacional): cabeza (a 3 de la espalda),
  // espalda, asiento y pierna; la rueda pasa detrás de la pierna con 1.5 de aire.
  wheelchair: {
    tags: ['silla de ruedas', 'acceso accesible', 'discapacidad', 'movilidad reducida', 'wheelchair', 'accessible', 'disability'],
    // Cabeza y rueda completas; el cuerpo (espalda, asiento y pierna) va encima como insignia propia
    // y el motor despeja la rueda a su paso. La cabeza, a 3 de la espalda.
    ...(() => {
      const x = 9.75;
      const leg = rline([[x, 9], [x, 13.5], [x + 5, 13.5], [x + 7.25, 19.75], [x + 9.5, 19.75]], [0, 1, 0.75, 0.75, 0]);
      const seat = line([x, 11], [x + 4, 11]);
      return { d: [circ(x, 4.35, 1.6), arc(x + 1, 15.25, 5.75, 205, -10).d], badge: own([leg, seat], trace(leg) + trace(seat)) };
    })(),
  },
};

// ── Relleno (DESIGN.md › Relleno) ──
// Por índice de `d`: `solid` se rellena (y conserva su trazo), `cut` se cala al ancho del trazo y
// `lines` sigue siendo línea con 1.5 de aire. T(i): la pieza abierta i de ida y vuelta (`trace`),
// para que siga unida al cuerpo sin rellenar su hueco (asas, soportes, tubos).
const T = (i) => (d) => trace(d[i]);
const FILL = {
  // Candados: como el del núcleo, el cuerpo y el arco rellenos; el abierto no encierra nada con su
  // arco, así que va de ida y vuelta (si no, se rellenaba un domo chueco).
  'lock-open': { solid: [0, T(1)], cut: [2] },
  'lock-check': { solid: [0, 1], cut: [2] },
  'lock-x': { solid: [0, 1], cut: [2, 3] },
  'lock-clock': { solid: [0, 1], cut: [2] },
  keyhole: { solid: [0], cut: [1] },
  password: { solid: [0], cut: [1, 2, 3, 4] },
  // La llave antigua: argolla, vara, collarín y paletón (que se cierra contra la vara)
  'key-skeleton': { solid: [0, 1, 2, 3] },
  passkey: { solid: [0, 1, 2, 3, 4, 5] },
  'person-lock': { solid: [0, 1] },
  // El ojo relleno con la pupila calada; las esquinas del marco siguen siendo línea
  'iris-scan': { solid: [1], cut: [2], lines: [0] },
  'two-factor': { solid: [0], cut: [1, 2, 3, 4] },
  'eye-off': { solid: [0], cut: [1] },
  'eye-lock': { solid: [0], cut: [1] },
  // La copa del sombrero se cierra contra el ala; el puente de los lentes va de ida y vuelta
  incognito: { solid: [0, 1, 2, 3, T(4)] },
  'window-lock': { solid: [0], cut: [1, 2, 3] },
  certificate: { solid: [0], cut: [1, 2] },
  cookie: { solid: [0], cut: [1, 2, 3, 4] },
  'shield-empty': { solid: [0] },
  'shield-off': { solid: [0] },
  'status-progress': { solid: [1], lines: [0] },
  gear: { solid: [0], cut: [1] },
  gears: { solid: [0], cut: [1] },
  'sliders-horizontal': { solid: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  preferences: { solid: [0, 2], cut: [1, 3] },
  'toggle-on': { solid: [0], cut: [1] },
  'toggle-off': { solid: [0], cut: [1] },
  lifebuoy: { solid: [0], cut: [1, 2, 3, 4, 5] },
  'flag-report': { solid: [0, 1], cut: [2, 3] },
  'flag-check': { solid: [0, 1], cut: [2] },
  // El domo se cierra contra la base; los destellos siguen siendo línea
  siren: { solid: [0, 1], lines: [2, 3, 4] },
  'page-not-found': { solid: [0], cut: [1, 2, 3, 4] },
  verified: { solid: [0], cut: [1] },
  'badge-star': { solid: [0], cut: [1] },
  award: { solid: [0, 1] },
  // Las asas de la copa, de ida y vuelta: rellenas se volvían orejas macizas
  trophy: { solid: [0, T(1), T(2), 3, 4] },
  'medal-ribbon': { solid: [0] },
  lightbulb: { solid: [0], lines: [1, 2] },
  'lightbulb-on': { solid: [0], lines: [1, 2, 3, 4, 5, 6] },
  // Aletas y llama se cierran contra el cuerpo; la ventanilla, calada
  'rocket-launch': { solid: [0, 2, 3, 4], cut: [1] },
  'target-arrow': { solid: [0], cut: [1] },
  podium: { solid: [0], cut: [1, 2] },
  wrench: { solid: [0] },
  screwdriver: { solid: [0, 1, 3], cut: [2] },
  hammer: { solid: [0, 1] },
  tools: { solid: [0] },
  'traffic-cone': { solid: [0, 1], cut: [2, 3] },
  barrier: { solid: [0, 1, 2, 3, 4], cut: [5, 6, 7] },
  'hard-hat': { solid: [0, 1], cut: [2, 3] },
  'hex-nut': { solid: [0], cut: [1] },
  checkbox: { solid: [0] },
  // La opción elegida: el aro sigue siendo línea y el centro se rellena
  'radio-selected': { solid: [1], lines: [0] },
  'radio-unselected': { solid: [0] },
  // La barra: el riel sigue siendo línea y el avance se rellena
  'progress-bar': { solid: [1], lines: [0] },
  'person-gear': { solid: [0, 1] },
  'key-plus': { solid: [0, 2, 3, 4], cut: [1] },
  'globe-lock': { solid: [0], cut: [1, 2] },
  'shield-search': { solid: [0] },
  // La base del soporte va de ida y vuelta (rellena era un triángulo)
  'security-camera': { solid: [0, T(1), 2], cut: [3] },
  radar: { solid: [0], cut: [1, 2, 3] },
  'heart-pulse': { solid: [0], cut: [1] },
  // Estetoscopio: la campana rellena; las olivas y el tubo, de ida y vuelta
  stethoscope: { solid: [T(0), T(1), 2] },
  virus: { solid: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  'plug-connected': { solid: [0, 1, 2, 3, 4, 5] },
  'plug-disconnected': { solid: [0, 1, 2, 3, 4, 5] },
  patch: { solid: [0], cut: [1, 2, 3, 4] },
  accessibility: { solid: [0], cut: [1, 2, 3, 4] },
  'dark-mode': { solid: [0], cut: [1] },
  contrast: { solid: [0], cut: [1, 2, 3, 4] },
  language: { solid: [0], cut: [1, 2] },
  magnet: { solid: [0], cut: [1, 2] },
  // El asa del botiquín, como la del maletín del núcleo: línea con aire
  'first-aid': { solid: [0], lines: [1], cut: [2, 3] },
  wheelchair: { solid: [0], lines: [1] },
};
// Un escudo, aviso o estado con su signo: la figura rellena y el signo calado
for (const name of ['shield-x', 'shield-alert', 'shield-plus', 'shield-minus', 'shield-lock', 'shield-person', 'shield-question', 'info', 'info-square', 'help', 'help-square', 'alert-octagon', 'close-octagon', 'alert-square', 'alert-diamond', 'check-circle', 'close-circle', 'plus-circle', 'minus-circle', 'check-square', 'close-square', 'plus-square', 'minus-square', 'block'])
  FILL[name] = { solid: [0], cut: icons[name].d.map((_, i) => i).slice(1) };
for (const [name, spec] of Object.entries(FILL)) {
  const ds = icons[name].d;
  const pick = (ix) => ix.map((i) => (typeof i === 'function' ? i(ds) : ds[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }) };
}
// Solo líneas abiertas (o signos): su relleno es el mismo contorno
for (const name of ['fingerprint', 'face-scan', 'scan', 'firewall', 'check-double', 'loader', 'spinner', 'status-pending', 'restart', 'update', 'command', 'minus', 'asterisk', 'sync'])
  icons[name].fill = false;

// ── 16 px (DESIGN.md › 16 px): dibujos con menos piezas para los que se empastan a 1x ──
// Un dibujo propio no se ajusta solo: sus tramos rectos van en centros de pixel (0.75 + 1.5k) y los
// puntos de r 1 en bordes de pixel (múltiplos de 1.5), así caen enteros en 2 × 2 pixeles.
/** Dibujo de 16 px con su relleno: `solid` y `cut` por índice de `d`. */
const small = (d, solid, cut = [], extra = {}) => ({ d, fill: { solid: solid.map((i) => d[i]), ...(cut.length && { cut: cut.map((i) => d[i]) }) }, ...extra });
// La huella con las crestas a 4.5 en vez de 3 (3 px entre ejes en lugar de 2) y su eje en un centro
// de pixel (en 12 cada cresta caía entre dos pixeles y se veía gris).
icons.fingerprint.small = {
  d: [`M2.25 14.25V11.25${arcTo(11.25, 11.25, 9, 180, 342)}`, `M6.75 17.25V11.25${arcTo(11.25, 11.25, 4.5, 180, 360)}V15.75`, line([11.25, 11.25], [11.25, 17.25])],
};
// El campo en centros de pixel; los puntos de 2 × 2 y el cursor de un pixel, con uno de aire.
icons.password.small = small([sq(2.25, 6.75, 19.5, 10.5, 3, BR), ...[6, 10.5, 15].map((x) => dot(x, 12, 1)), line([18.75, 9.75], [18.75, 14.25])], [0], [1, 2, 3, 4]);
// El teléfono de 12 de ancho (centrado en un pixel) y el código en tres puntos de un pixel con uno
// de aire: los de r 0.3 se volvían una raya gris.
icons['two-factor'].small = small([sq(6.75, 2.25, 12, 19.5, 3.25, BR), line([11.25, 5.25], [14.25, 5.25]), ...[9.75, 12.75, 15.75].map((x) => dot(x, 12.75, 0.25))], [0], [1, 2, 3, 4]);
// El parche sin los poros (a 16 px eran ruido gris).
icons.patch.small = small(icons.patch.d.slice(0, 3), [0], [1, 2]);
// El radar con los aros en centros de pixel y sin el eco (se encimaba con los aros).
icons.radar.small = small([circ(12, 12, 8.25), circ(12, 12, 3.75), line([12, 12], polar(12, 12, 8.25, -50))], [0], [1, 2]);
// El pulso con un solo pico, a la altura de un centro de pixel: con dos se volvía una x.
icons['heart-pulse'].small = small([icons['heart-pulse'].d[0], inside(line([2, 12.75], [10.5, 12.75], [12, 9.75], [13.5, 12.75], [22, 12.75]), icons['heart-pulse'].d[0], 3)], [0], [1]);
// El mundo y la gota en centros de pixel, con los renglones en filas enteras.
{
  const globe = nucleo.icons.globe.d.map((d) => xf(d, { s: 2 / 3, dx: -3.75, dy: -3.75 }));
  const bubble = drop(16.5, 16.5, 5.25);
  const rows = [line([14.25, 15.75], [18.75, 15.75]), line([14.25, 18.75], [17.25, 18.75])];
  icons.language.small = small(globe, [0], [1, 2], { badge: own([bubble, ...rows], bubble, { solid: [bubble], cut: rows }) });
}
// El certificado con un renglón y los listones rectos, en columnas de pixel.
{
  const seal = circ(15.75, 12.75, 2.25);
  const tails = [14.25, 17.25].map((x) => line([x, 12.75 + Math.sqrt(2.25 ** 2 - 1.5 ** 2)], [x, 21.75]));
  icons.certificate.small = small([sq(2.25, 3.75, 19.5, 15, 3.25, BR), line([6.75, 8.25], [11.25, 8.25])], [0], [1], { badge: own([seal, ...tails], [seal, ...tails.map(trace)].join(''), { solid: [seal, ...tails] }) });
}
// Los engranes con menos dientes y sin el punto del chico.
{
  const big = [gear(8.75, 8.75, 6.6, 4.85, 6, 0.8, 1), circ(8.75, 8.75, 1.85)];
  const cog = gear(...BC, 4.5, 3.15, 5, 0.6, 0.8);
  icons.gears.small = small(big, [0], [1], { badge: own([cog], circ(...BC, 4.5), { solid: [cog] }) });
}
// Medalla y roseta sin el aro interior.
icons['medal-ribbon'].small = small([STRAP], [0], [], { badge: own([MEDAL], MEDAL, { solid: [MEDAL] }) });
icons.award.small = small(icons.award.d, [0, 1], [], { badge: own([ROSETTE], ROSETTE, { solid: [ROSETTE] }) });

// ── Variantes (DESIGN.md › Variantes automáticas) ──
const off = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Ya vienen encerrados en un círculo (o el contorno es el ícono): no se vuelven a encerrar.
off(['keyhole', 'cookie', 'info', 'help', 'check-circle', 'close-circle', 'plus-circle', 'minus-circle', 'loader', 'spinner', 'status-pending', 'status-progress', 'block', 'lifebuoy', 'verified', 'badge-star', 'radio-selected', 'radio-unselected', 'radar', 'accessibility', 'contrast', 'alert-octagon', 'close-octagon', 'alert-diamond'], { circle: false });
// Ya vienen en un cuadrado o en una ventana: no se vuelven a encerrar en cuadrado.
off(['info-square', 'help-square', 'alert-square', 'check-square', 'close-square', 'plus-square', 'minus-square', 'checkbox', 'window-lock', 'page-not-found', 'scan', 'face-scan', 'iris-scan'], { square: false });
// Reducidos al 58–60 % dejan de leerse (la luna de la perilla, la persona con su llave).
off(['passkey', 'dark-mode'], { circle: false, square: false });
// Con insignia: encerrada, la insignia deja de leerse (y relleno en círculo no la dibuja), y el
// tache la atravesaría sin aire.
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Líneas sueltas, signos, estados y los que ya tienen su versión tachada dibujada (`shield-off`,
// `plug-disconnected`): sin tachado.
off(['minus', 'asterisk', 'command', 'loader', 'spinner', 'status-pending', 'status-progress', 'progress-bar', 'block', 'restart', 'sync', 'update', 'shield-empty', 'toggle-on', 'toggle-off', 'plug-connected', 'plug-disconnected'], { slash: false });

// ── Espejo (DESIGN.md › Espejo): lo que se lee de izquierda a derecha ──
// El cursor al final del campo, los interruptores (en derecha a izquierda el encendido va a la
// izquierda) y la barra que avanza.
for (const name of ['password', 'toggle-on', 'toggle-off', 'preferences', 'dark-mode', 'progress-bar']) icons[name].mirror = true;

// ── Piezas con nombre (DESIGN.md › Piezas): lo que se anima, cambia de estado o va bajo una insignia ──
const PARTS = {
  'lock-open': { body: [0], shackle: [1], keyhole: [2] },
  'lock-check': { body: [0], shackle: [1], mark: [2] },
  'lock-x': { body: [0], shackle: [1], mark: [2, 3] },
  'lock-clock': { body: [0], shackle: [1], keyhole: [2] },
  keyhole: { shape: [0], keyhole: [1] },
  password: { field: [0], dots: [1, 2, 3], caret: [4] },
  'key-skeleton': { bow: [0], shaft: [1, 2, 3] },
  passkey: { person: [0, 1], key: [2, 3, 4, 5] },
  'person-lock': { person: [0, 1] },
  'two-factor': { device: [0], code: [2, 3, 4] },
  'eye-off': { body: [0], pupil: [1] },
  'eye-lock': { body: [0], pupil: [1] },
  certificate: { body: [0], text: [1, 2] },
  'shield-empty': { shape: [0] },
  'shield-off': { shape: [0] },
  'shield-lock': { shape: [0], lock: [1, 2] },
  'shield-person': { shape: [0], person: [1, 2] },
  'check-double': { mark: [0] },
  loader: { arc: [0] },
  spinner: { rays: [0, 1, 2, 3, 4, 5, 6, 7] },
  'status-pending': { ring: [0, 1, 2, 3, 4, 5, 6, 7] },
  'status-progress': { ring: [0], progress: [1] },
  gear: { gear: [0], hub: [1] },
  gears: { gear: [0], hub: [1] },
  preferences: { track: [0, 2], knob: [1, 3] },
  'toggle-on': { track: [0], knob: [1] },
  'toggle-off': { track: [0], knob: [1] },
  restart: { arrow: [0, 1], power: [2] },
  'flag-report': { pole: [0], flag: [1], mark: [2, 3] },
  'flag-check': { pole: [0], flag: [1], mark: [2] },
  siren: { dome: [0], base: [1], rays: [2, 3, 4] },
  award: { ribbons: [0, 1] },
  trophy: { cup: [0], handles: [1, 2], stand: [3, 4] },
  'medal-ribbon': { strap: [0] },
  'lightbulb-on': { bulb: [0], base: [1], rays: [2, 3, 4, 5, 6] },
  'rocket-launch': { body: [0], window: [1], fins: [2, 3], flame: [4] },
  'target-arrow': { rings: [0, 1] },
  wrench: { body: [0] },
  hammer: { head: [0], handle: [1] },
  tools: { wrench: [0] },
  'radio-selected': { ring: [0], dot: [1] },
  'progress-bar': { track: [0], progress: [1] },
  update: { cycle: [0, 1, 2, 3], arrow: [4, 5] },
  sync: { cycle: [0, 1, 2, 3] },
  'person-gear': { person: [0, 1] },
  'key-plus': { bow: [0, 1], shaft: [2, 3, 4] },
  'globe-lock': { globe: [0, 1, 2] },
  'shield-search': { shape: [0] },
  'security-camera': { body: [0, 3], mount: [1, 2] },
  radar: { face: [0, 1], sweep: [2], blip: [3] },
  'heart-pulse': { heart: [0], pulse: [1] },
  'plug-connected': { plug: [0, 1, 2, 3], socket: [4, 5] },
  'plug-disconnected': { plug: [0, 1, 2, 3], socket: [4, 5] },
  'dark-mode': { track: [0], knob: [1] },
  language: { globe: [0, 1, 2] },
  wheelchair: { head: [0], wheel: [1] },
};
// Escudos, avisos y estados: la figura y su signo
for (const name of ['shield-x', 'shield-alert', 'shield-plus', 'shield-minus', 'shield-question', 'info', 'info-square', 'help', 'help-square', 'alert-octagon', 'close-octagon', 'alert-square', 'alert-diamond', 'check-circle', 'close-circle', 'plus-circle', 'minus-circle', 'check-square', 'close-square', 'plus-square', 'minus-square', 'block'])
  PARTS[name] = { shape: [0], mark: icons[name].d.map((_, i) => i).slice(1) };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Movimiento (DESIGN.md › Movimiento): el gesto propio de cada ícono ──
const MOTION = {
  // El arco del candado abierto salta; el reloj de la insignia gira
  'lock-open': { effect: 'bounce', parts: ['shackle'], vector: [0, -1.5] },
  'lock-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'key-skeleton': { effect: 'wiggle', origin: [6.75, 11.5] },
  // Los avisos se sacuden desde su base, como `alert` del núcleo
  'shield-alert': { effect: 'wiggle', origin: [12, 21.5] },
  'alert-octagon': { effect: 'wiggle', origin: [12, 21.75] },
  'alert-square': { effect: 'wiggle', origin: [12, 20.75] },
  'alert-diamond': { effect: 'wiggle', origin: [12, 22] },
  // Lo que gira: cargas, engranes, el barrido del radar y las flechas de sincronizar
  loader: { effect: 'spin', parts: ['arc'], origin: [12, 12] },
  spinner: { effect: 'spin', parts: ['rays'], origin: [12, 12] },
  'status-pending': { effect: 'spin', parts: ['ring'], origin: [12, 12] },
  gear: { effect: 'spin', origin: [12, 12] },
  gears: { effect: 'spin', parts: ['gear', 'hub'], origin: [8.75, 8.75] },
  'person-gear': { effect: 'spin', parts: ['badge'], origin: BC },
  radar: { effect: 'spin', parts: ['sweep'], origin: [12, 12] },
  sync: { effect: 'spin', parts: ['cycle'], origin: [12, 12] },
  // La flecha de la actualización baja
  update: { effect: 'bounce', parts: ['arrow'], vector: [0, 1.5] },
  // La bandera ondea desde el pie del asta
  'flag-report': { effect: 'wiggle', origin: [4.75, 21.25] },
  'flag-check': { effect: 'wiggle', origin: [4.75, 21.25] },
  // La sirena y el foco destellan
  siren: { effect: 'beat', parts: ['rays'], origin: [12, 13.5] },
  'lightbulb-on': { effect: 'beat', parts: ['rays'], origin: [12, 11.5] },
  'heart-pulse': { effect: 'beat', origin: [12, 13] },
  'rocket-launch': { effect: 'slide', vector: [0, -2] },
  // La flecha entra en la diana
  'target-arrow': { effect: 'slide', parts: ['badge'], vector: [-1.5, 1.5] },
  // La llave inglesa gira sobre la tuerca; el martillo golpea desde el puño
  wrench: { effect: 'wiggle', origin: [15.6, 8.4] },
  hammer: { effect: 'wiggle', origin: [4.4, 19.6] },
  'security-camera': { effect: 'wiggle', parts: ['body'], origin: [13.5, 11.75] },
  // La clavija avanza hacia el contacto
  'plug-disconnected': { effect: 'slide', parts: ['plug'], vector: [1.25, -1.25] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

export default { category: 'sistema', label: 'Sistema, seguridad y estado', icons };
