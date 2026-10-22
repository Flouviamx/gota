// Comunicación y personas: globos, correo, llamadas, avisos, personas y reacciones. Todo sale
// del motor (engine/geometry.mjs) más unas herramientas locales para recortar (dejar 1.5 de
// aire cuando una figura pasa detrás de otra) y para reutilizar las piezas del núcleo
// (persona, teléfono, campana, sobre) sin redibujarlas. Ver DESIGN.md.
import { arc, circ, dot, drop, f, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import nucleo from './nucleo.mjs';

// ── Trazos como segmentos ─────────────────────────────────────────────────────────────────
// parse() convierte un `d` del motor en segmentos absolutos (L, C, A); ser() los vuelve `d`.
// Con eso se recorta un trazo contra otra figura (cut) y se mueve o escala una pieza (xf).
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;

function arcSeg(p0, p1, r, large, sweep) {
  const x1 = (p0[0] - p1[0]) / 2;
  const y1 = (p0[1] - p1[1]) / 2;
  const lam = (x1 * x1 + y1 * y1) / (r * r);
  if (lam > 1) r *= Math.sqrt(lam);
  const num = r * r * r * r - r * r * y1 * y1 - r * r * x1 * x1;
  const den = r * r * y1 * y1 + r * r * x1 * x1;
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const cxp = k * y1;
  const cyp = -k * x1;
  const c = [cxp + (p0[0] + p1[0]) / 2, cyp + (p0[1] + p1[1]) / 2];
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
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
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
      x = sx;
      y = sy;
      lc = null;
      sp = null;
      continue;
    }
    if (C === 'M') {
      x = ox + n();
      y = oy + n();
      sx = x;
      sy = y;
      sp = { segs: [], closed: false };
      subs.push(sp);
      cmd = rel ? 'l' : 'L';
      lc = null;
      continue;
    }
    if (!sp) {
      sp = { segs: [], closed: false };
      subs.push(sp);
      sx = x;
      sy = y;
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
      let p1;
      if (C === 'C') p1 = [ox + n(), oy + n()];
      else p1 = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
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
  return [w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0], w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1]];
}

function splitC(p, t) {
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const a = L(p[0], p[1]);
  const b = L(p[1], p[2]);
  const c = L(p[2], p[3]);
  const d = L(a, b);
  const e = L(b, c);
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

const segLen = (s) => {
  let n = 0;
  let a = pt(s, 0);
  for (let k = 1; k <= 16; k++) {
    const b = pt(s, k / 16);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
};

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

/** Recorta `d` dejando solo lo que cumple keep(p). */
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
        let lo = (k - 1) / N;
        let hi = k / N;
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
  const polys = parse(d).map((sp) => ({
    closed: sp.closed,
    pts: sp.segs.flatMap((s) => Array.from({ length: 33 }, (_, j) => pt(s, j / 32))),
  }));
  return (p) => {
    let best = Infinity;
    let inside = false;
    for (const { closed, pts } of polys) {
      for (let k = 1; k < pts.length; k++) {
        const [a, b] = [pts[k - 1], pts[k]];
        const vx = b[0] - a[0];
        const vy = b[1] - a[1];
        const L = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L));
        best = Math.min(best, Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t));
        if (closed && a[1] > p[1] !== b[1] > p[1] && p[0] < a[0] + ((p[1] - a[1]) * vx) / vy) inside = !inside;
      }
    }
    return inside ? -best : best;
  };
}

/** Corta `d` donde pasa detrás de `front` (una o varias figuras), dejando `gap` entre ejes:
 *  3 = 1.5 de aire entre los bordes de los dos trazos de 1.5. */
function cut(d, front, gap = 3) {
  const fs = [front].flat().map(field);
  return clip(d, (p) => fs.every((F) => F(p) >= gap));
}

/** Transformación de semejanza (giro, escala, espejo, traslado) sobre un `d`. */
function xf(d, { s = 1, deg = 0, o = [12, 12], dx = 0, dy = 0, flipX = false, flipY = false } = {}) {
  const m = (p) => {
    let v = [(p[0] - o[0]) * s, (p[1] - o[1]) * s];
    if (flipX) v[0] = -v[0];
    if (flipY) v[1] = -v[1];
    v = rot(v, [0, 0], deg);
    return [v[0] + o[0] + dx, v[1] + o[1] + dy];
  };
  const mir = flipX !== flipY ? -1 : 1;
  return ser(
    parse(d).map((sp) => ({
      closed: sp.closed,
      segs: sp.segs.map((g) => {
        if (g.t === 'L') return { t: 'L', a: m(g.a), b: m(g.b) };
        if (g.t === 'C') return { t: 'C', p: g.p.map(m) };
        const c = m(g.c);
        const a = m(pt(g, 0));
        return { t: 'A', c, r: g.r * s, a0: Math.atan2(a[1] - c[1], a[0] - c[0]), da: g.da * mir };
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

/** Curva suave por puntos (Catmull-Rom → Bézier) para formas orgánicas. */
function smooth(pts, k = 1 / 6) {
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    o += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return o;
}

// ── Glifos pequeños ──────────────────────────────────────────────────────────────────────
/** Check con las proporciones del check del núcleo, de ancho w y centrado en (cx, cy). */
const check = (cx, cy, w) => line([cx - 0.5 * w, cy + 0.036 * w], [cx - 0.183 * w, cy + 0.357 * w], [cx + 0.5 * w, cy - 0.357 * w]);
const plus = (cx, cy, a) => [line([cx, cy - a], [cx, cy + a]), line([cx - a, cy], [cx + a, cy])];
const minus = (cx, cy, a) => [line([cx - a, cy], [cx + a, cy])];
const ex = (cx, cy, a) => [line([cx - a, cy - a], [cx + a, cy + a]), line([cx + a, cy - a], [cx - a, cy + a])];

/** Corazón: dos lóbulos que se cruzan y bajan tangentes a una punta. */
function heart(cx, cy, w) {
  const r = w / 3.7;
  const k = 0.82 * r;
  const L = [cx - k, cy];
  const R = [cx + k, cy];
  const T = [cx, cy + w * 0.62];
  const tan = (C, side) => {
    const dv = [T[0] - C[0], T[1] - C[1]];
    const dl = Math.hypot(...dv);
    const g = Math.atan2(dv[1], dv[0]) + side * Math.acos(r / dl);
    return g;
  };
  const gl = tan(L, 1);
  const gr = tan(R, -1);
  const dip = Math.acos(k / r);
  const dipL = 2 * Math.PI - dip;
  const a1 = arc(L[0], L[1], r, (gl * 180) / Math.PI, (dipL * 180) / Math.PI);
  const a2 = arc(R[0], R[1], r, ((Math.PI + dip) * 180) / Math.PI, ((gr + 2 * Math.PI) * 180) / Math.PI);
  return `M${P(T)}L${a1.d.slice(1)}${a2.d.replace(/^M[^A]+/, '')}Z`;
}

/** Destello de cuatro puntas: cuatro arcos cóncavos centrados en las esquinas de su caja. */
function sparkle(cx, cy, r) {
  const k = [
    [cx + r, cy - r, 180, 90],
    [cx + r, cy + r, 270, 180],
    [cx - r, cy + r, 360, 270],
    [cx - r, cy - r, 90, 0],
  ];
  return `${k.map(([x, y, a0, a1], i) => (i ? arc(x, y, r, a0, a1).d.replace(/^M[^A]+/, '') : arc(x, y, r, a0, a1).d)).join('')}Z`;
}

/** Estrella de n puntas con las esquinas suaves. */
function star(cx, cy, R, r, rt = 0.8, rv = 0.5) {
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push(polar(cx, cy, i % 2 ? r : R, -90 + i * 36));
  return roundpoly(
    pts,
    pts.map((_, i) => (i % 2 ? rv : rt)),
  );
}

/** La solapa del sobre del núcleo, a la medida de un sobre (x, y, w, h). */
const flap = (x, y, w, h) =>
  rline(
    [
      [x + 0.216 * w, y + 0.3 * h],
      [x + w / 2, y + 0.3 * h + 0.7 * (0.284 * w)],
      [x + 0.784 * w, y + 0.3 * h],
    ],
    [0, 1.5 * Math.min(1, w / 19), 0],
  );

/** Cápsula vertical (micrófono). */
const pill = (x, y, w, h) => {
  const r = w / 2;
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
};

/** Cara: el círculo de r 9 con dos ojos y lo que se pase como boca. */
const face = (...mouth) => [circ(12, 12, 9), dot(9, 9.75), dot(15, 9.75), ...mouth];

/** Pulgar arriba: puño con el pulgar levantado y su puño de manga a la izquierda. */
const THUMB = [
  roundpoly(
    [
      [7.25, 20.5],
      [7.25, 10.75],
      [10.1, 3.4],
      [12.9, 4.35],
      [12.4, 9.25],
      [20.25, 9.25],
      [18.75, 20.5],
    ],
    [0, 0.6, 1.5, 1.3, 0.9, 2.25, 1.75],
  ),
  rline(
    [
      [7.25, 10.75],
      [3.25, 10.75],
      [3.25, 20.5],
      [7.25, 20.5],
    ],
    [0, 1.25, 1.25, 0],
  ),
];

/** Busto pequeño (credenciales y tarjetas): cabeza y hombros recortados por el borde inferior. */
const bust = (cx, headY, hr, baseY, sr) => [circ(cx, headY, hr), arc(cx, baseY, sr, 180, 360).d];

/** Lápiz a 45° con la punta en `tip`, de largo `len` y cuerpo de 3 (como el del núcleo). */
function pencil(tip, len, w = 3) {
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  const at = (a, b) => [tip[0] + u[0] * a + n[0] * b, tip[1] + u[1] * a + n[1] * b];
  const a = 2.6;
  const body = `M${P(tip)}L${P(at(a, -w / 2))}L${P(at(len, -w / 2))}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${P(at(len, w / 2))}L${P(at(a, w / 2))}Z`;
  return [body, line(at(len - 2.4, -w / 2), at(len - 2.4, w / 2))];
}

/** Medidas de una esquina continua de radio r (el mismo suavizado 0.6 que sq() en el motor). */
function cornerK(r, s = 0.6) {
  const p = (1 + s) * r;
  const a90 = 90 * (1 - s);
  const L = Math.sin(((a90 / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - a90) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L, r };
}

/** Polilínea abierta con esquinas continuas (como las flechas de vuelta de Navegación). */
function cline(pts, radius) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  const add = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
  const unit = (a, b) => {
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / n, (b[1] - a[1]) / n];
  };
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const V = pts[i];
    const r = rr[i];
    if (!r) {
      d += `L${P(V)}`;
      continue;
    }
    const u = unit(pts[i - 1], V);
    const v = unit(V, pts[i + 1]);
    const k = cornerK(r);
    const S = add(V, u, -k.p);
    const e1 = add(add(S, u, k.a + k.b + k.c), v, k.d);
    const e2 = add(add(e1, u, k.L), v, k.L);
    const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    d += `L${P(S)}C${P(add(S, u, k.a))} ${P(add(S, u, k.a + k.b))} ${P(e1)}`;
    d += `A${f(r)} ${f(r)} 0 0 ${sweep} ${P(e2)}`;
    d += `C${P(add(add(e2, u, k.d), v, k.c))} ${P(add(add(e2, u, k.d), v, k.b + k.c))} ${P(add(add(e2, u, k.d), v, k.a + k.b + k.c))}`;
  }
  return `${d}L${P(pts.at(-1))}`;
}

/** El arco de arc() sin su M inicial, para encadenarlo a un trazo. */
const arcTo = (...a) => arc(...a).d.replace(/^M[^A]+/, '');

/** 文: punto, barra y las dos diagonales que bajan de la barra, en una caja de unas 8 × 8. */
const wen = (cx, cy) => [
  line([cx, cy - 4], [cx, cy - 3.1]),
  line([cx - 3.9, cy - 1.5], [cx + 3.9, cy - 1.5]),
  line([cx + 2.4, cy - 1.5], [cx - 3.3, cy + 4]),
  line([cx - 2.4, cy - 1.5], [cx + 3.3, cy + 4]),
];
/** La letra A de alto h: dos piernas con la punta suave y su travesaño. */
const letterA = (cx, top, h) => [
  rline([[cx - 0.42 * h, top + h], [cx, top], [cx + 0.42 * h, top + h]], [0, 0.7, 0]),
  line([cx - 0.27 * h, top + 0.66 * h], [cx + 0.27 * h, top + 0.66 * h]),
];

// ── Piezas base ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const DROP = drop(12, 11.75, 8.75); // el globo del núcleo
const SLASH = line([3.25, 3.25], [20.75, 20.75]); // la diagonal de «apagado»
const off = (paths, slash = SLASH) => [...paths.map((d) => cut(d, slash)).filter(Boolean), slash];
const MAIL = N.mail.d[0];
const FLAP = N.mail.d[1];
const PHONE = N.phone.d[0];
const BELL = N.bell.d;
/** La campana un poco menor y corrida arriba a la izquierda, para dejarle la esquina a la insignia. */
const BELL_B = BELL.map((d) => xf(d, { s: 0.9, dx: -1.75, dy: -1.25 }));
const VIDEO = sq(2.5, 6, 13.25, 12, 3.5, { square: ['br'] });
const LENS = rline(
  [
    [15.75, 10.25],
    [21.25, 7.25],
    [21.25, 16.75],
    [15.75, 13.75],
  ],
  [0, 1.5, 1.5, 0],
);
/** Quien está del otro lado de la videollamada: cabeza y hombros dentro de la cámara. */
const CALLER = [circ(9.13, 10.35, 1.9), arc(9.13, 18, 3.6, 180, 360).d];
const SCREEN = sq(2.5, 3.5, 19, 13.5, 3.5, { square: ['br'] });
const STAND = line([8.5, 20.5], [15.5, 20.5]);
const MIC = pill(9, 2.75, 6, 10.75);
const MIC_HOLDER = rline(
  [
    [5.75, 9.75],
    [5.75, 17.25],
    [18.25, 17.25],
    [18.25, 9.75],
  ],
  [0, 6.25, 6.25, 0],
);
const MIC_STEM = line([12, 17.25], [12, 21.25]);
const BROADCAST = [circ(12, 12, 1.75), arc(12, 12, 5, -42, 42).d, arc(12, 12, 5, 138, 222).d, arc(12, 12, 8.5, -40, 40).d, arc(12, 12, 8.5, 140, 220).d];
const PERSON = N.person.d;
const PERSON_L = PERSON.map((d) => xf(d, { dx: -2.5 })); // la persona corrida para dejar sitio a la insignia
/** La persona del núcleo escalada desde sus pies; la cabeza sube para conservar el aire con los hombros. */
const personAt = (s, dx = 0, dy = 0) => [xf(PERSON[0], { s, o: [12, 20.6], dx, dy: dy - 1.95 * (1 - s) }), xf(PERSON[1], { s, o: [12, 20.6], dx, dy })];
const dropL = (cx, cy, r) => xf(drop(cx, cy, r), { flipX: true, o: [cx, cy] }); // la gota en espejo: el otro interlocutor
/** Clip de papel de tres patas a 3 de distancia, de pie a la derecha del sobre. */
const CLIP = `M18.5 10V17.75${arcTo(17, 17.75, 1.5, 0, 180)}V7.5${arcTo(18.5, 7.5, 3, 180, 360)}V19.5`;
/** El sobre del núcleo al 80 %, arriba a la izquierda, para que el clip quepa a su lado. */
const MAIL_S = [MAIL, FLAP].map((d) => xf(d, { s: 0.8, o: [2.5, 5], dy: 0.75 }));

/** Insignia: círculo de r 4.25 en la esquina inferior derecha que recorta 1.5 al objeto base. */
const BADGE = [18, 18];
function badge(base, kind, [cx, cy] = BADGE, R = 4.25) {
  const ring = circ(cx, cy, R);
  const glyph = {
    plus: () => plus(cx, cy, 1.6),
    minus: () => minus(cx, cy, 1.6),
    check: () => [check(cx - 0.05, cy + 0.1, 3.3)],
    x: () => ex(cx, cy, 1.3),
    clock: () => [line([cx, cy - 1.75], [cx, cy], [cx + 1.35, cy + 0.8])],
    block: () => [line(polar(cx, cy, R, 225), polar(cx, cy, R, 45))],
    heart: () => [heart(cx, cy - 0.85, 3.35)],
  }[kind]();
  return [...[base].flat().map((d) => cut(d, ring)).filter(Boolean), ring, ...glyph];
}

/** Punto de «nuevo» (r 2.5) en la esquina superior derecha, con 1.5 de aire alrededor. */
const UNREAD = (cx, cy) => circ(cx, cy, 2.5);

const icons = {
  // ── Globos de conversación: siempre la gota del isotipo ──
  'message-dots': {
    tags: ['escribiendo', 'chat', 'mensaje', 'typing', 'chat bubble'],
    d: [DROP, dot(7.75, 12), dot(12, 12), dot(16.25, 12)],
  },
  'message-plus': {
    tags: ['nuevo mensaje', 'iniciar chat', 'conversación', 'new message', 'compose'],
    d: [DROP, ...plus(12, 12, 3.5)],
  },
  'message-minus': {
    tags: ['quitar mensaje', 'ocultar', 'chat', 'remove message'],
    d: [DROP, ...minus(12, 12, 3.5)],
  },
  'message-check': {
    tags: ['mensaje leído', 'resuelto', 'conversación', 'resolved', 'read'],
    d: [DROP, check(12, 12, 7.5)],
  },
  'message-x': {
    tags: ['borrar mensaje', 'cerrar chat', 'eliminar', 'delete message'],
    d: [DROP, ...ex(12, 12, 2.6)],
  },
  'message-question': {
    tags: ['pregunta', 'ayuda', 'preguntas frecuentes', 'help', 'faq'],
    d: [DROP, `${arc(12, 9.25, 2.5, 180, 360).d}C14.5 11 12 11 12 12.75V13.1`, dot(12, 16.55)],
  },
  'message-alert': {
    tags: ['aviso', 'reportar', 'mensaje importante', 'report', 'alert'],
    d: [DROP, line([12, 7.4], [12, 12.75]), dot(12, 16.3)],
  },
  'message-heart': {
    tags: ['me gusta', 'reacción', 'mensaje', 'love', 'like'],
    d: [DROP, heart(12, 10.25, 8)],
  },
  'message-smile': {
    tags: ['reacción', 'emoji', 'mensaje amable', 'reaction', 'smile'],
    d: [DROP, dot(9.5, 9.75), dot(14.5, 9.75), arc(12, 11.5, 3.6, 30, 150).d],
  },
  'message-star': {
    tags: ['favorito', 'reseña', 'opinión', 'feedback', 'review'],
    d: [DROP, star(12, 12.2, 5, 2.3, 0.75, 0.5)],
  },
  'message-video': {
    tags: ['videomensaje', 'video', 'reproducir', 'video message'],
    d: [
      DROP,
      roundpoly(
        [
          [10, 8.25],
          [16, 12],
          [10, 15.75],
        ],
        1.1,
      ),
    ],
  },
  'message-voice': {
    tags: ['nota de voz', 'audio', 'mensaje de voz', 'voice message', 'voice note'],
    d: [DROP, line([7.5, 10.75], [7.5, 13.25]), line([10.5, 8.25], [10.5, 15.75]), line([13.5, 9.75], [13.5, 14.25]), line([16.5, 11], [16.5, 13])],
  },
  'message-reply': {
    tags: ['responder', 'hilo', 'contestar', 'reply', 'thread'],
    d: [
      DROP,
      rline(
        [
          [8, 10.25],
          [15.75, 10.25],
          [15.75, 15.25],
        ],
        [0, 3, 0],
      ),
      head([8, 10.25], [-1, 0], 2.75),
    ],
  },
  'message-search': {
    tags: ['buscar en chats', 'buscar mensajes', 'conversación', 'search messages'],
    d: [DROP, circ(11.25, 11.25, 3), line([13.4, 13.4], [15.6, 15.6])],
  },
  'message-sparkle': {
    tags: ['asistente', 'inteligencia artificial', 'chat con ia', 'ai chat', 'assistant'],
    d: [DROP, sparkle(12, 12, 4.75)],
  },
  'message-hashtag': {
    tags: ['canal', 'tema', 'conversación', 'channel', 'topic'],
    d: [DROP, line([10, 8], [10, 16]), line([14, 8], [14, 16]), line([8, 10], [16, 10]), line([8, 14], [16, 14])],
  },
  'message-code': {
    tags: ['código', 'revisión', 'comentario técnico', 'code review', 'snippet'],
    d: [DROP, line([10, 9], [7.75, 12], [10, 15]), line([14, 9], [16.25, 12], [14, 15])],
  },
  'message-lock': {
    tags: ['privado', 'cifrado', 'chat seguro', 'private', 'encrypted'],
    d: [
      DROP,
      sq(8.75, 11, 6.5, 5, 1.5, { square: ['br'] }),
      rline(
        [
          [10, 11],
          [10, 7.25],
          [14, 7.25],
          [14, 11],
        ],
        [0, 2, 2, 0],
      ),
    ],
  },
  'message-clock': {
    tags: ['pendiente', 'programado', 'esperando respuesta', 'pending', 'scheduled'],
    d: [DROP, line([12, 7.5], [12, 12.25], [15.25, 14.25])],
  },
  'message-unread': {
    tags: ['no leído', 'mensaje nuevo', 'chat', 'unread', 'new message'],
    // La gota un poco menor para que el punto la recorte poco y siga leyéndose como globo
    d: [cut(drop(11.25, 12.5, 8.25), UNREAD(19.25, 4.75)), UNREAD(19.25, 4.75)],
  },
  'message-off': {
    tags: ['silenciar chat', 'sin mensajes', 'chat desactivado', 'chat off', 'mute chat'],
    d: off([DROP]),
  },
  'messages': {
    tags: ['conversaciones', 'chats', 'diálogo', 'conversations', 'chat'],
    // Dos interlocutores: la gota de atrás en espejo, la de adelante con la firma
    d: ((front) => [cut(dropL(9.5, 9.5, 6.25), front), front])(drop(14.5, 14.5, 6.25)),
  },

  // ── Correo ──
  'mail-open': {
    tags: ['correo abierto', 'leído', 'sobre abierto', 'mail open', 'read'],
    d: [
      roundpoly(
        [
          [2.75, 10.25],
          [12, 3.25],
          [21.25, 10.25],
          [21.25, 20.75],
          [2.75, 20.75],
        ],
        [2, 2.4, 2, 0, 3.25],
      ),
      rline(
        [
          [6.6, 13.5],
          [12, 17.25],
          [17.4, 13.5],
        ],
        [0, 1.6, 0],
      ),
    ],
  },
  'mail-unread': {
    tags: ['correo nuevo', 'no leído', 'bandeja', 'unread mail', 'new email'],
    d: [cut(MAIL, UNREAD(19.75, 4.25)), FLAP, UNREAD(19.75, 4.25)],
  },
  'mail-plus': {
    tags: ['redactar', 'nuevo correo', 'escribir', 'compose', 'new email'],
    d: badge([MAIL, FLAP], 'plus'),
  },
  'mail-minus': {
    tags: ['darse de baja', 'quitar correo', 'desuscribir', 'unsubscribe'],
    d: badge([MAIL, FLAP], 'minus'),
  },
  'mail-check': {
    tags: ['correo entregado', 'confirmado', 'verificado', 'delivered', 'verified email'],
    d: badge([MAIL, FLAP], 'check'),
  },
  'mail-x': {
    tags: ['correo rebotado', 'error de envío', 'no entregado', 'bounced', 'failed'],
    d: badge([MAIL, FLAP], 'x'),
  },
  'mail-clock': {
    tags: ['envío programado', 'enviar después', 'correo pendiente', 'scheduled', 'send later'],
    d: badge([MAIL, FLAP], 'clock'),
  },
  'mail-send': {
    tags: ['enviar correo', 'salida', 'enviado', 'send mail', 'outbox'],
    d: [cut(MAIL, [line([13.75, 18.5], [21.75, 18.5]), head([21.75, 18.5], [1, 0], 3.4)]), FLAP, line([13.75, 18.5], [21.75, 18.5]), head([21.75, 18.5], [1, 0], 3.4)],
  },
  'mail-draft': {
    tags: ['borrador', 'redactando', 'editar correo', 'draft', 'edit email'],
    d: ((pen) => [cut(MAIL, pen[0]), FLAP, ...pen])(pencil([13, 21.25], 10.5)),
  },
  'mail-attachment': {
    tags: ['adjunto', 'archivo adjunto', 'clip', 'attachment', 'paperclip'],
    d: [...MAIL_S.map((d) => cut(d, CLIP)), CLIP],
  },
  'mail-signature': {
    tags: ['firma de correo', 'firma', 'remitente', 'email signature', 'signature'],
    d: [
      MAIL,
      rline(
        [
          [8, 8.75],
          [12, 11.25],
          [16, 8.75],
        ],
        [0, 1.1, 0],
      ),
      smooth([
        [6.5, 16],
        [8.25, 13.5],
        [9.5, 13.75],
        [9.25, 15.75],
        [11.25, 14.25],
        [12.75, 15.5],
        [14.5, 14.5],
        [17.5, 14.5],
      ]),
    ],
  },
  'mail-search': {
    tags: ['buscar correo', 'filtrar', 'bandeja', 'search mail'],
    d: ((lens) => [cut(MAIL, lens), FLAP, ...lens])([circ(17.25, 16.5, 2.75), line([19.2, 18.45], [21.5, 20.75])]),
  },
  'mail-letter': {
    tags: ['carta', 'invitación', 'sobre con carta', 'letter', 'invitation'],
    d: ((pocket, letter) => [
      cut(line([2.75, 11.5], [12, 5.25], [21.25, 11.5]), letter),
      rline(
        [
          [2.75, 11.5],
          [2.75, 20.75],
          [21.25, 20.75],
          [21.25, 11.5],
        ],
        [0, 3.25, 0, 0],
      ),
      rline(
        [
          [2.75, 11.5],
          [12, 16.75],
          [21.25, 11.5],
        ],
        [0, 1.6, 0],
      ),
      cut(letter, pocket),
      cut(line([9.5, 7], [14.5, 7]), pocket),
    ])(
      roundpoly(
        [
          [2.75, 11.5],
          [12, 16.75],
          [21.25, 11.5],
          [21.25, 20.75],
          [2.75, 20.75],
        ],
        0,
      ),
      sq(6.5, 3, 11, 11, 2, { square: ['br'] }),
    ),
  },
  'mail-stack': {
    tags: ['correos', 'boletín', 'envío masivo', 'newsletter', 'bulk mail'],
    d: [
      cut(sq(5.75, 4, 15.75, 12.25, 3.5, { square: ['br'] }), sq(2.5, 7.25, 15.75, 12.25, 3.5, { square: ['br'] }), 2.9),
      sq(2.5, 7.25, 15.75, 12.25, 3.5, { square: ['br'] }),
      flap(2.5, 7.25, 15.75, 12.25),
    ],
  },
  'mailbox': {
    tags: ['buzón', 'correo postal', 'cartas', 'mailbox', 'postbox'],
    d: [
      // El buzón de lado: la puerta en arco al frente, la bandera levantada y el poste
      roundpoly(
        [
          [2.75, 17.5],
          [2.75, 8],
          [21.25, 8],
          [21.25, 17.5],
        ],
        [1, 4.75, 4.75, 0],
      ),
      `M11.75 17.5V12.75${arcTo(7, 12.75, 4.75, 0, -90)}`,
      line([7.25, 17.5], [7.25, 21.25]),
      line([16.5, 8], [16.5, 2.75]),
      rline(
        [
          [16.5, 2.75],
          [19.75, 2.75],
          [19.75, 5],
          [16.5, 5],
        ],
        [0, 0.6, 0.6, 0],
      ),
    ],
  },
  'reply-all': {
    tags: ['responder a todos', 'contestar', 'correo', 'reply all'],
    // La misma vuelta que arrow-turn-left (Navegación) con una segunda punta a 3 de aire
    d: [
      cline(
        [
          [18.75, 20.25],
          [18.75, 9.5],
          [9, 9.5],
        ],
        [0, 4.5, 0],
      ),
      head([9, 9.5], [-1, 0], 5 * Math.SQRT2),
      head([4.75, 9.5], [-1, 0], 5 * Math.SQRT2),
    ],
  },

  // ── Llamadas: el teléfono del núcleo ──
  'phone-incoming': {
    tags: ['llamada entrante', 'recibir llamada', 'teléfono', 'incoming call'],
    d: [PHONE, line([20.5, 3.5], [14.5, 9.5]), head([14.5, 9.5], [-1, 1], 4.5)],
  },
  'phone-outgoing': {
    tags: ['llamada saliente', 'marcar', 'llamar', 'outgoing call', 'dial'],
    d: [PHONE, line([14.5, 9.5], [20.5, 3.5]), head([20.5, 3.5], [1, -1], 4.5)],
  },
  'phone-missed': {
    tags: ['llamada perdida', 'rechazada', 'sin contestar', 'missed call'],
    d: [PHONE, ...ex(17.5, 6.5, 2.75)],
  },
  'phone-plus': {
    tags: ['agregar llamada', 'conferencia', 'añadir', 'add call', 'conference'],
    d: [PHONE, ...plus(17.5, 6.5, 3.25)],
  },
  'phone-forward': {
    tags: ['desviar llamada', 'reenviar', 'redirigir', 'forward call'],
    d: [PHONE, line([14, 6.5], [21, 6.5]), head([21, 6.5], [1, 0], 3.4)],
  },
  'phone-transfer': {
    tags: ['transferir llamada', 'cambiar', 'pasar llamada', 'transfer call'],
    d: [PHONE, line([14.5, 4.25], [20.75, 4.25]), head([20.75, 4.25], [1, 0], 3.4), line([20.75, 9.25], [14.5, 9.25]), head([14.5, 9.25], [-1, 0], 3.4)],
  },
  'phone-hold': {
    tags: ['en espera', 'pausa', 'llamada retenida', 'on hold'],
    d: [PHONE, line([15.75, 3.5], [15.75, 9.5]), line([19.75, 3.5], [19.75, 9.5])],
  },
  'phone-ringing': {
    tags: ['timbrando', 'llamando', 'llamada', 'ringing', 'calling'],
    d: [PHONE, arc(13, 11, 5, -78, -12).d, arc(13, 11, 8.5, -80, -10).d],
  },
  'phone-hangup': {
    tags: ['colgar', 'terminar llamada', 'cortar', 'hang up', 'end call'],
    d: [xf(PHONE, { deg: 135, s: 0.82, dy: 1 })],
  },
  'phone-off': {
    tags: ['sin llamadas', 'no molestar', 'teléfono apagado', 'phone off'],
    // La diagonal va al revés para no correr a lo largo del auricular
    d: off([PHONE], line([20.75, 3.25], [3.25, 20.75])),
  },
  'voicemail': {
    tags: ['buzón de voz', 'mensaje de voz', 'grabación', 'voicemail'],
    d: [circ(6.75, 12, 3.75), circ(17.25, 12, 3.75), line([6.75, 15.75], [17.25, 15.75])],
  },
  'dialpad': {
    tags: ['teclado', 'marcador', 'números', 'keypad', 'dialpad'],
    d: [6.25, 12, 17.75].flatMap((x) => [4.5, 9.5, 14.5].map((y) => dot(x, y))).concat(dot(12, 19.5)),
  },

  // ── Video y voz ──
  'video-call': {
    tags: ['videollamada', 'llamada de video', 'cámara', 'video call', 'facetime'],
    d: [VIDEO, LENS, ...CALLER],
  },
  'video-call-off': {
    tags: ['cámara apagada', 'sin video', 'terminar videollamada', 'video off'],
    d: off([VIDEO, LENS, ...CALLER]),
  },
  'video-meeting': {
    tags: ['videoconferencia', 'reunión', 'junta en línea', 'meeting', 'webinar'],
    d: [SCREEN, STAND, ...bust(12, 8.75, 2.25, 17, 3.75)],
  },
  'screen-share': {
    tags: ['compartir pantalla', 'presentar', 'proyectar', 'screen share', 'present'],
    d: [SCREEN, STAND, line([12, 13.5], [12, 7]), head([12, 7], [0, -1], 3.4)],
  },
  'screen-share-off': {
    tags: ['dejar de compartir', 'detener presentación', 'pantalla', 'stop sharing'],
    d: [SCREEN, STAND, ...ex(12, 10.25, 2.5)],
  },
  'microphone': {
    tags: ['micrófono', 'voz', 'grabar', 'mic', 'microphone'],
    d: [MIC, MIC_HOLDER, MIC_STEM],
  },
  'microphone-off': {
    tags: ['silenciar', 'micrófono apagado', 'mudo', 'mute mic', 'mic off'],
    d: off([MIC, MIC_HOLDER, MIC_STEM]),
  },
  'headset': {
    tags: ['diadema', 'soporte', 'atención a clientes', 'headset', 'support'],
    // La diadema de headphones (Dispositivos) con el brazo del micrófono rematado en su cápsula
    d: [
      arc(12, 12, 8.25, 180, 360).d,
      sq(3.75, 12, 4.5, 6.75, 1.5, { square: ['tl'] }),
      sq(15.75, 12, 4.5, 6.75, 1.5, { square: ['tr'] }),
      cline(
        [
          [18, 18.75],
          [18, 20.75],
          [12.25, 20.75],
        ],
        [0, 2, 0],
      ),
      dot(11.75, 20.75),
    ],
  },
  'walkie-talkie': {
    tags: ['radio', 'dos vías', 'intercomunicador', 'walkie talkie'],
    d: [sq(6.5, 7.75, 11, 13.5, 3, { square: ['br'] }), line([9.5, 7.75], [9.5, 2.75]), line([9.75, 12], [14.25, 12]), line([9.75, 15], [14.25, 15])],
  },

  // ── Avisos: la campana del núcleo ──
  'bell-dot': {
    tags: ['aviso nuevo', 'notificación', 'sin leer', 'unread', 'new notification'],
    d: [BELL[0], cut(BELL[1], UNREAD(18.75, 4.75)), UNREAD(18.75, 4.75)],
  },
  'bell-plus': {
    tags: ['crear aviso', 'suscribirse', 'activar notificaciones', 'add alert', 'subscribe'],
    d: badge(BELL_B, 'plus'),
  },
  'bell-check': {
    tags: ['suscrito', 'avisos activos', 'notificación vista', 'subscribed'],
    d: badge(BELL_B, 'check'),
  },
  'bell-clock': {
    tags: ['posponer aviso', 'recordatorio', 'más tarde', 'snooze', 'reminder'],
    d: badge(BELL_B, 'clock'),
  },
  'bell-ringing': {
    tags: ['timbrando', 'alarma', 'notificación', 'ringing', 'alert'],
    d: [...BELL, arc(12, 9.35, 9.25, -155, -125).d, arc(12, 9.35, 9.25, -55, -25).d],
  },
  'bell-off': {
    tags: ['silenciar avisos', 'no molestar', 'notificaciones apagadas', 'notifications off'],
    d: off(BELL),
  },
  'notification-badge': {
    tags: ['notificación', 'insignia', 'app con aviso', 'badge', 'notification'],
    d: [cut(sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), UNREAD(19.25, 4.75)), UNREAD(19.25, 4.75)],
  },

  // ── Símbolos y difusión ──
  'at-sign': {
    tags: ['arroba', 'mención', 'correo', 'at', 'mention'],
    d: [circ(12, 12, 3.5), `M15.5 8.5V12${arcTo(18, 12, 2.5, 180, 0)}${arcTo(12, 12, 8.5, 0, -300)}`],
  },
  'hashtag': {
    tags: ['etiqueta', 'canal', 'almohadilla', 'hashtag', 'channel'],
    d: [line([10.25, 3.5], [8.5, 20.5]), line([15.5, 3.5], [13.75, 20.5]), line([4.5, 8.75], [19.75, 8.75]), line([4.25, 15.25], [19.5, 15.25])],
  },
  'megaphone': {
    tags: ['anuncio', 'campaña', 'altavoz', 'announcement', 'marketing'],
    d: [
      roundpoly(
        [
          [3, 9],
          [8.5, 9],
          [18.25, 4],
          [18.25, 20],
          [8.5, 15],
          [3, 15],
        ],
        [1.75, 0.6, 1.5, 1.5, 0.6, 1.75],
      ),
      // El mango nace y muere sobre el cuerpo
      rline(
        [
          [6, 15],
          [7, 20.25],
          [10.25, 20.25],
          [9.85, 15.69],
        ],
        [0, 1, 1, 0],
      ),
      line([21.25, 10.25], [21.25, 13.75]),
    ],
  },
  'broadcast': {
    tags: ['transmisión', 'en vivo', 'señal', 'broadcast', 'live'],
    d: BROADCAST,
  },
  'broadcast-off': {
    tags: ['fuera del aire', 'sin transmisión', 'desconectado', 'offline'],
    d: off(BROADCAST),
  },
  'radio-tower': {
    tags: ['antena', 'señal', 'transmisión', 'radio tower', 'antenna'],
    d: [circ(12, 7.25, 1.75), line([7.75, 21], [12, 9], [16.25, 21]), arc(12, 7.25, 5, 150, 210).d, arc(12, 7.25, 5, -30, 30).d, arc(12, 7.25, 8.25, 152, 208).d, arc(12, 7.25, 8.25, -28, 28).d],
  },
  'satellite-dish': {
    tags: ['satélite', 'parabólica', 'antena', 'satellite', 'dish'],
    d: [`${arc(9.25, 14.75, 6.5, 225, 45).d}Z`, line([9.25, 14.75], [13.5, 10.5]), dot(14.25, 9.75), arc(14.25, 9.75, 4, -80, -10).d, arc(14.25, 9.75, 7.25, -82, -8).d],
  },

  // ── Personas: la persona del núcleo ──
  'person-plus': {
    tags: ['agregar persona', 'invitar', 'nuevo usuario', 'add user', 'invite'],
    d: badge(PERSON_L, 'plus'),
  },
  'person-minus': {
    tags: ['quitar persona', 'eliminar usuario', 'sacar', 'remove user'],
    d: badge(PERSON_L, 'minus'),
  },
  'person-check': {
    tags: ['verificado', 'aprobado', 'usuario activo', 'verified user', 'approved'],
    d: badge(PERSON_L, 'check'),
  },
  'person-x': {
    tags: ['rechazar', 'denegar acceso', 'usuario', 'deny user', 'reject'],
    d: badge(PERSON_L, 'x'),
  },
  'person-block': {
    tags: ['bloquear', 'vetar', 'usuario bloqueado', 'block user', 'ban'],
    d: badge(PERSON_L, 'block'),
  },
  'person-clock': {
    tags: ['invitación pendiente', 'en espera', 'usuario', 'pending user'],
    d: badge(PERSON_L, 'clock'),
  },
  'person-heart': {
    tags: ['contacto favorito', 'seguir', 'cliente frecuente', 'favorite', 'follow'],
    d: badge(PERSON_L, 'heart'),
  },
  'person-edit': {
    tags: ['editar perfil', 'cuenta', 'datos personales', 'edit profile', 'account'],
    d: ((pen) => [...PERSON_L.map((d) => cut(d, pen[0])), ...pen])(pencil([12.5, 21], 10.5)),
  },
  'person-search': {
    tags: ['buscar persona', 'directorio', 'encontrar usuario', 'find user'],
    d: ((lens) => [...PERSON_L.map((d) => cut(d, lens)), ...lens])([circ(16.75, 16.25, 3.25), line([19.1, 18.6], [21.25, 20.75])]),
  },
  'person-arrow': {
    tags: ['asignar', 'transferir', 'delegar', 'assign', 'transfer'],
    d: ((arrow) => [...PERSON_L.map((d) => cut(d, arrow)), ...arrow])([line([14, 18], [21.5, 18]), head([21.5, 18], [1, 0], 3.4)]),
  },
  'person-speaking': {
    tags: ['hablando', 'presentador', 'voz', 'speaker', 'talking'],
    d: [...PERSON.map((d) => xf(d, { dx: -2.75 })), arc(9.25, 7.6, 6.75, -38, 38).d, arc(9.25, 7.6, 10, -33, 33).d],
  },
  'person-circle': {
    tags: ['perfil', 'avatar', 'cuenta', 'profile', 'account'],
    d: [circ(12, 12, 9), circ(12, 9.5, 3.25), arc(12, 21.25, 6.25, 202.17, 337.83).d],
  },
  'people': {
    tags: ['grupo', 'equipo', 'comunidad', 'team', 'group'],
    d: ((front) => [...[-5.4, 5.4].flatMap((dx) => personAt(0.66, dx, -1.75).map((d) => cut(d, front))), ...front])(personAt(0.84)),
  },
  'id-card': {
    tags: ['identificación', 'tarjeta de contacto', 'credencial', 'id card', 'vcard'],
    d: [sq(2.5, 5, 19, 14, 3.5, { square: ['br'] }), ...bust(8, 10.5, 2.25, 19, 3.75), line([14.75, 10.5], [18.25, 10.5]), line([14.75, 14], [17, 14])],
  },
  'id-badge': {
    tags: ['credencial', 'gafete', 'acceso', 'badge', 'employee'],
    d: [sq(4.75, 2.75, 14.5, 18.5, 3.5, { square: ['br'] }), line([10.25, 6.25], [13.75, 6.25]), ...bust(12, 11.75, 2.25, 21.25, 4)],
  },
  'contacts': {
    tags: ['contactos', 'agenda', 'libreta de direcciones', 'address book', 'contacts'],
    d: [sq(5.5, 2.75, 14, 18.5, 3.5, { square: ['br'] }), ...bust(12.5, 10.5, 2.5, 21.25, 4.5), ...[7.25, 12, 16.75].map((y) => line([3.5, y], [7.5, y]))],
  },
  'handshake': {
    tags: ['apretón de manos', 'acuerdo', 'trato', 'handshake', 'deal'],
    // Dos puños de manga y las manos trabadas: el nudillo arriba, los dedos que envuelven abajo
    d: [
      rline(
        [
          [2.75, 6.25],
          [6.25, 6.25],
          [6.25, 16.75],
          [2.75, 16.75],
        ],
        [0, 1, 1, 0],
      ),
      rline(
        [
          [21.25, 6.25],
          [17.75, 6.25],
          [17.75, 16.75],
          [21.25, 16.75],
        ],
        [0, 1, 1, 0],
      ),
      smooth([
        [6.25, 8.25],
        [9.5, 6.5],
        [12.75, 8.5],
        [17.75, 8.5],
      ]),
      smooth([
        [6.25, 14.75],
        [9.25, 17],
        [13.5, 17.75],
        [17.75, 15],
      ]),
      line([12.75, 8.5], [9.75, 11.5]),
      line([12, 15.25], [15, 12.25]),
    ],
  },

  // ── Reacciones ──
  'face-smile': {
    tags: ['sonrisa', 'feliz', 'emoji', 'smile', 'happy'],
    d: face(arc(12, 12, 4.25, 30, 150).d),
  },
  'face-laugh': {
    tags: ['risa', 'alegría', 'carcajada', 'laugh', 'joy'],
    d: [circ(12, 12, 9), arc(9, 10.25, 1.5, 180, 360).d, arc(15, 10.25, 1.5, 180, 360).d, `M7.75 13.25H16.25${arcTo(12, 13.25, 4.25, 0, 180)}`],
  },
  'face-wink': {
    tags: ['guiño', 'broma', 'complicidad', 'wink'],
    d: [circ(12, 12, 9), dot(9, 9.75), line([13.75, 9.75], [16.25, 9.75]), arc(12, 12, 4.25, 30, 150).d],
  },
  'face-neutral': {
    tags: ['neutral', 'indiferente', 'serio', 'neutral face', 'meh'],
    d: face(line([8.75, 15], [15.25, 15])),
  },
  'face-confused': {
    tags: ['confusión', 'duda', 'no entiendo', 'confused'],
    d: face(
      smooth([
        [8.25, 15.75],
        [10.25, 14.5],
        [12.25, 15.25],
        [14, 15.75],
        [15.75, 14.5],
      ]),
    ),
  },
  'face-surprised': {
    tags: ['sorpresa', 'asombro', 'wow', 'surprised'],
    d: face(circ(12, 15.25, 1.75)),
  },
  'face-sad': {
    tags: ['triste', 'molesto', 'insatisfecho', 'sad', 'unhappy'],
    d: face(arc(12, 19.25, 4.25, 215, 325).d),
  },
  'face-angry': {
    tags: ['enojo', 'molestia', 'furia', 'angry', 'mad'],
    d: [circ(12, 12, 9), line([7.75, 8.75], [10.25, 10]), line([16.25, 8.75], [13.75, 10]), arc(12, 19.25, 4.25, 215, 325).d],
  },
  'reaction-add': {
    tags: ['agregar reacción', 'emoji', 'reaccionar', 'add reaction'],
    d: badge([circ(10.5, 10.5, 7.75), dot(8, 8.75), dot(13, 8.75), arc(10.5, 10.75, 3, 35, 145).d], 'plus'),
  },
  'thumbs-up': {
    tags: ['me gusta', 'aprobar', 'de acuerdo', 'like', 'thumbs up'],
    d: THUMB,
  },
  'thumbs-down': {
    tags: ['no me gusta', 'rechazar', 'desacuerdo', 'dislike', 'thumbs down'],
    d: THUMB.map((d) => xf(d, { flipY: true })),
  },
  'hand-raised': {
    tags: ['levantar la mano', 'pedir la palabra', 'turno', 'raise hand'],
    d: [
      line([7.75, 6.5], [7.75, 13]),
      line([10.75, 4], [10.75, 12.5]),
      line([14, 4.75], [14, 12.5]),
      smooth([
        [17.25, 7],
        [17.25, 14],
        [15.75, 18.75],
        [12, 20.75],
        [8.5, 19.75],
        [6, 16.75],
        [4, 12.25],
      ]),
    ],
  },
  'party-popper': {
    tags: ['celebrar', 'festejo', 'felicidades', 'celebrate', 'party'],
    d: [
      roundpoly(
        [
          [3.5, 20.5],
          [7.25, 9.5],
          [14.5, 16.75],
        ],
        [1, 1.25, 1.25],
      ),
      smooth([
        [10.75, 9],
        [11, 6.25],
        [13.5, 4.75],
      ]),
      smooth([
        [15, 13.25],
        [17.75, 13],
        [19.25, 10.5],
      ]),
      dot(16.75, 3.75),
      dot(20.25, 7),
      dot(15.5, 8.5),
    ],
  },
  'sticker': {
    tags: ['sticker', 'calcomanía', 'emoji', 'pegatina'],
    d: [
      clip(sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), (p) => !(p[0] > 14.3 && p[1] > 14.3)),
      line([20.75, 14.25], [14.25, 20.75]),
      rline(
        [
          [20.75, 14.25],
          [14.25, 14.25],
          [14.25, 20.75],
        ],
        [0, 2.75, 0],
      ),
      dot(9.5, 9.5),
      dot(14.5, 9.5),
    ],
  },

  // ── Lenguaje ──
  'translate': {
    tags: ['traducir', 'idioma', 'traducción', 'translate', 'language'],
    // 文 arriba y la A dentro de la gota en espejo: el otro idioma responde
    d: ((front) => [...wen(7.25, 7).map((d) => cut(d, front)), front, ...letterA(15.25, 12.25, 5.5)])(dropL(15.25, 15, 6.25)),
  },
};

// ── Variantes ──
// Ya vienen encerrados en un círculo: no se vuelven a encerrar
for (const name of ['face-smile', 'face-laugh', 'face-wink', 'face-neutral', 'face-confused', 'face-surprised', 'face-sad', 'face-angry', 'person-circle', 'reaction-add'])
  icons[name].variants = { circle: false };
// Ya son un cuadrado con la firma
for (const name of ['notification-badge', 'sticker']) icons[name].variants = { square: false };
// Sin tachado automático: los -off dibujados a mano, sus bases (que ya tienen su -off) y las
// líneas o signos sueltos, donde un tache no dice nada
for (const name of [
  'message-off',
  'phone-off',
  'video-call',
  'video-call-off',
  'screen-share',
  'screen-share-off',
  'microphone',
  'microphone-off',
  'bell-off',
  'broadcast',
  'broadcast-off',
  'reply-all',
  'dialpad',
  'hashtag',
  'at-sign',
])
  icons[name].variants = { ...icons[name].variants, slash: false };

export default { category: 'comunicacion', label: 'Comunicación y personas', icons };
