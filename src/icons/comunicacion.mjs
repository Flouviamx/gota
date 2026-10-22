// Comunicación y personas: globos, correo, llamadas, avisos, personas y reacciones. Todo sale
// del motor (engine/geometry.mjs) más unas herramientas locales para mover o escalar piezas del
// núcleo (persona, teléfono, campana, sobre) sin redibujarlas. Las insignias son las del motor y
// lo que va encima de otra figura (el lápiz sobre el sobre, la persona de adelante, la diagonal
// de los -off) es una insignia propia: el motor despeja la base con 1.5 exacto, nunca a mano.
// Ver DESIGN.md.
import { arc, badge, circ, dot, drop, f, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import nucleo from './nucleo.mjs';

// ── Trazos como segmentos ─────────────────────────────────────────────────────────────────
// parse() convierte un `d` del motor en segmentos absolutos (L, C, A); ser() los vuelve `d`.
// Con eso se recorta una figura con una regla (clip), se mueve o escala una pieza (xf) y se
// arma el área que despeja una insignia propia (knockOf).
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

/** Deja de `d` solo lo que cumple keep(p): una forma que se construye así (la esquina del sticker). */
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

/**
 * Área que despeja una insignia propia: las figuras cerradas tal cual (se despeja su interior) y
 * cada tramo de una línea abierta como subtrazo aparte, para que el motor no rellene el triángulo
 * que cierra una punta de flecha o un lápiz abierto.
 */
const knockOf = (...ds) =>
  ser(ds.flatMap((d) => parse(d).flatMap((sp) => (sp.closed ? [sp] : sp.segs.map((s) => ({ segs: [s], closed: false }))))));

/**
 * Un trazo abierto y su regreso por el mismo camino: en `solid` se ve igual que la línea pero sin
 * área que rellenar ni aire alrededor. Para lo que toca al cuerpo y debe seguir unido en el relleno
 * (la diadema y el brazo del micrófono), donde `lines` mordería el cuerpo con su aire.
 */
function twin(d) {
  const rev = (s) => (s.t === 'L' ? { t: 'L', a: s.b, b: s.a } : s.t === 'C' ? { t: 'C', p: [...s.p].reverse() } : { ...s, a0: s.a0 + s.da, da: -s.da });
  return ser(parse(d).map((sp) => ({ segs: [...sp.segs, ...sp.segs.toReversed().map(rev)], closed: false })));
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
/** La junta del puño con la manga: en el relleno se cala para que no se vuelvan una sola mancha. */
const THUMB_SEAM = line([7.25, 10.75], [7.25, 20.5]);

/**
 * Mano levantada en un solo contorno: cuatro dedos de 3 con la punta en semicírculo (cada punta
 * asienta en el costado del dedo vecino), la palma y el pulgar abierto a unos 50°. Las rayas entre
 * dedos nacen del contorno y en el relleno se calan.
 */
function raisedHand() {
  const tops = [6.25, 4.75, 5.5, 8.25];
  const xs = [7.25, 10.25, 13.25, 16.25, 19.25];
  const r = 1.5;
  const base = [9.5, 18.25];
  const tip = [5, 13.25];
  const L = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
  const u = [(tip[0] - base[0]) / L, (tip[1] - base[1]) / L];
  const n = [u[1], -u[0]]; // hacia el canto de afuera del pulgar
  const at = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
  const [outB, outT, inT, inB] = [at(base, r), at(tip, r), at(tip, -r), at(base, -r)];
  const J = [xs[0], inT[1] + ((xs[0] - inT[0]) / (inB[0] - inT[0])) * (inB[1] - inT[1])]; // donde el pulgar sale del índice
  let d = `M${P(J)}`;
  for (let i = 0; i < 4; i++) d += `V${f(tops[i])}A${f(r)} ${f(r)} 0 0 1 ${f(xs[i + 1])} ${f(tops[i])}`;
  d += `V14.5C19.25 18.1 16.65 20.75 13.5 20.75C10.65 20.75 ${P([outB[0] + 0.9, outB[1] + 1.1])} ${P(outB)}`;
  d += `L${P(outT)}A${f(r)} ${f(r)} 0 0 1 ${P(inT)}Z`;
  return [d, ...[1, 2, 3].map((i) => line([xs[i], Math.max(tops[i - 1], tops[i])], [xs[i], 11.25]))];
}

/** Busto pequeño (credenciales y tarjetas): cabeza y hombros que asientan en el borde inferior. */
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

/** 文: el trazo de arriba que asienta en la barra y las dos diagonales, en una caja de unas 8 × 8. */
const wen = (cx, cy) => [
  line([cx, cy - 4.25], [cx, cy - 1.5]),
  line([cx - 3.9, cy - 1.5], [cx + 3.9, cy - 1.5]),
  line([cx + 2.4, cy - 1.5], [cx - 3.3, cy + 4]),
  line([cx - 2.4, cy - 1.5], [cx + 3.3, cy + 4]),
];
/** La letra A de alto h: dos piernas con la punta suave y su travesaño. */
const letterA = (cx, top, h) => [
  rline(
    [
      [cx - 0.42 * h, top + h],
      [cx, top],
      [cx + 0.42 * h, top + h],
    ],
    [0, 0.7, 0],
  ),
  line([cx - 0.27 * h, top + 0.66 * h], [cx + 0.27 * h, top + 0.66 * h]),
];

// ── Piezas base ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const DROP = drop(12, 11.75, 8.75); // el globo del núcleo
const MAIL = N.mail.d[0];
const FLAP = N.mail.d[1];
const PHONE = N.phone.d[0];
// La campana del núcleo en orden de dibujo: primero el cuerpo, después el badajo
const BELL = [N.bell.d[1], N.bell.d[0]];
/**
 * La campana bajo una insignia de esquina: al 85 % y corrida abajo a la izquierda, así el badajo
 * queda entero fuera del área que despeja la insignia (completa, se lo comía a la mitad). El badajo
 * baja 0.45 para conservar los 3 entre ejes con el cuerpo que tiene a tamaño completo.
 */
const BELL_B = [xf(BELL[0], { s: 0.85, dx: -3.25, dy: 1 }), xf(BELL[1], { s: 0.85, dx: -3.25, dy: 1.45 })];
const BELL_B_TOP = [12 - 3.25, 12 + (2.95 - 12) * 0.85 + 1]; // el cuelgue, para el movimiento
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
/**
 * El sobre bajo una insignia de esquina: al 85 % y arriba a la izquierda, así la solapa queda a 1.5
 * de aire del área que despeja la insignia (completo, su brazo derecho la rozaba y en el relleno
 * dejaba una astilla entre la solapa calada y el aire de la insignia).
 */
const MAIL_B = [MAIL, FLAP].map((d) => xf(d, { s: 0.85, o: [2.5, 5], dy: -0.5 }));
/** El sobre bajo el punto de aviso: completo y 2.5 más abajo, con la solapa lejos del punto. */
const MAIL_DOT = [MAIL, FLAP].map((d) => xf(d, { dy: 2.5 }));

// ── Insignias propias ────────────────────────────────────────────────────────────────────
// En el mismo lugar que las del motor (centro 17.25, 17.25; círculo de r 4.25). `knock` es el
// área que el motor despeja con 1.5 de aire; lo que va encima de otra figura lleva su propia área.
const BC = [17.25, 17.25];
const BR = 4.25;
const RING = circ(...BC, BR);
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** Bloquear: el círculo con su diagonal (calada en el relleno). */
const blockBadge = () => {
  const bar = line(polar(...BC, BR, 225), polar(...BC, BR, 45));
  return own([RING, bar], RING, { solid: [RING], cut: [bar] });
};
/** Corazón sin círculo: la figura es la insignia y despeja el círculo entero (sin pedazos junto a su punta). */
const heartBadge = () => {
  const h = heart(BC[0], 15.6, 7.6);
  return own([h], RING, { solid: [h] });
};
/** Lupa: el lente en el círculo de la insignia (r 3.25) y el mango hacia la esquina. */
const searchBadge = () => {
  const lens = circ(...BC, 3.25);
  const handle = line(polar(...BC, 3.25, 45), [21.25, 21.25]);
  return own([lens, handle], knockOf(lens, handle), { solid: [lens, handle] });
};
/** Lápiz encima de una figura: el cuerpo se rellena y el casquillo se cala. */
const pencilOver = (tip, len) => {
  const pen = pencil(tip, len);
  return own(pen, pen[0], { solid: [pen[0]], cut: [pen[1]] });
};
/** Flecha a la derecha encima de una figura (en el relleno sigue siendo línea). */
const arrowOver = (from, to, len = 3.4) => {
  const d = [line(from, to), head(to, [to[0] - from[0], to[1] - from[1]], len)];
  return own(d, knockOf(...d));
};
/** La diagonal de los -off: va encima como pieza propia y el motor le despeja 1.5 a cada lado. */
const SLASH = line([3.25, 3.25], [20.75, 20.75]);
const slashOver = (s = SLASH) => own([s], s);
/** Una figura cerrada encima de otra (el globo de adelante, la persona del frente). */
const front = (ds, fill = { solid: ds }) => own(ds, ds.join(''), fill);

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
    // El gancho termina a 1.5 de aire del punto
    d: [DROP, `${arc(12, 9.25, 2.5, 180, 360).d}C14.5 11 12 11 12 12.75V12.85`, dot(12, 16.55)],
  },
  'message-alert': {
    tags: ['aviso', 'reportar', 'mensaje importante', 'report', 'alert'],
    // Las medidas del signo de `important` (núcleo): 1.5 de aire entre la raya y el punto
    d: [DROP, line([12, 7.4], [12, 12.6]), dot(12, 16.3)],
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
    // La gota un poco menor y corrida abajo a la izquierda: el punto del motor le toma poco
    d: [drop(11.25, 12.5, 8.25)],
    badge: badge('dot'),
  },
  'message-off': {
    tags: ['silenciar chat', 'sin mensajes', 'chat desactivado', 'chat off', 'mute chat'],
    d: [DROP],
    badge: slashOver(),
  },
  'messages': {
    tags: ['conversaciones', 'chats', 'diálogo', 'conversations', 'chat'],
    // Dos interlocutores: la gota de atrás en espejo, la de adelante con la firma encima
    d: [dropL(9.5, 9.5, 6.25)],
    badge: front([drop(14.5, 14.5, 6.25)]),
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
    d: MAIL_DOT,
    badge: badge('dot'),
  },
  'mail-plus': {
    tags: ['redactar', 'nuevo correo', 'escribir', 'compose', 'new email'],
    d: MAIL_B,
    badge: badge('plus'),
  },
  'mail-minus': {
    tags: ['darse de baja', 'quitar correo', 'desuscribir', 'unsubscribe'],
    d: MAIL_B,
    badge: badge('minus'),
  },
  'mail-check': {
    tags: ['correo entregado', 'confirmado', 'verificado', 'delivered', 'verified email'],
    d: MAIL_B,
    badge: badge('check'),
  },
  'mail-x': {
    tags: ['correo rebotado', 'error de envío', 'no entregado', 'bounced', 'failed'],
    d: MAIL_B,
    badge: badge('x'),
  },
  'mail-clock': {
    tags: ['envío programado', 'enviar después', 'correo pendiente', 'scheduled', 'send later'],
    d: MAIL_B,
    badge: badge('clock'),
  },
  'mail-send': {
    tags: ['enviar correo', 'salida', 'enviado', 'send mail', 'outbox'],
    // La flecha sale por la esquina de abajo del sobre
    d: [MAIL, FLAP],
    badge: arrowOver([13.75, 18.5], [21.75, 18.5]),
  },
  'mail-draft': {
    tags: ['borrador', 'redactando', 'editar correo', 'draft', 'edit email'],
    d: MAIL_B,
    badge: pencilOver([13, 21.25], 10.5),
  },
  'mail-attachment': {
    tags: ['adjunto', 'archivo adjunto', 'clip', 'attachment', 'paperclip'],
    d: MAIL_S,
    badge: own([CLIP], knockOf(CLIP)),
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
    d: MAIL_B,
    badge: searchBadge(),
  },
  'mail-letter': {
    tags: ['carta', 'invitación', 'sobre con carta', 'letter', 'invitation'],
    // La carta asoma del sobre: el bolsillo del frente va encima y el motor la despeja. Su borde
    // de abajo queda dentro del bolsillo (más arriba dejaba una astilla junto al vértice)
    d: [sq(6.5, 3, 11, 14.5, 2, { square: ['br'] }), line([9.5, 7], [14.5, 7])],
    badge: front([
      roundpoly(
        [
          [2.75, 11.5],
          [12, 16.75],
          [21.25, 11.5],
          [21.25, 20.75],
          [2.75, 20.75],
        ],
        [1, 1.6, 1, 0, 3.25],
      ),
    ]),
  },
  'mail-stack': {
    tags: ['correos', 'boletín', 'envío masivo', 'newsletter', 'bulk mail'],
    // El sobre de atrás completo; el de adelante va encima con su solapa calada en el relleno
    d: [sq(5.75, 4, 15.75, 12.25, 3.5, { square: ['br'] })],
    badge: (() => {
      const body = sq(2.5, 7.25, 15.75, 12.25, 3.5, { square: ['br'] });
      const fl = flap(2.5, 7.25, 15.75, 12.25);
      return own([body, fl], body, { solid: [body], cut: [fl] });
    })(),
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
    // Dos flechas cortas en sentidos opuestos (la de ida abajo, lejos del auricular); las puntas de
    // 2.75 dejan 1.5 de aire entre sí y con el teléfono
    d: [PHONE, line([21.25, 3.75], [14.5, 3.75]), head([14.5, 3.75], [-1, 0], 2.75), line([14.5, 9], [21.25, 9]), head([21.25, 9], [1, 0], 2.75)],
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
    d: [PHONE],
    badge: slashOver(line([20.75, 3.25], [3.25, 20.75])),
  },
  'voicemail': {
    tags: ['buzón de voz', 'mensaje de voz', 'grabación', 'voicemail'],
    d: [circ(6.75, 12, 3.75), circ(17.25, 12, 3.75), line([6.75, 15.75], [17.25, 15.75])],
  },
  'dialpad': {
    tags: ['teclado', 'marcador', 'números', 'keypad', 'dialpad'],
    d: [4.5, 9.5, 14.5].flatMap((y) => [6.25, 12, 17.75].map((x) => dot(x, y))).concat(dot(12, 19.5)),
  },

  // ── Video y voz ──
  'video-call': {
    tags: ['videollamada', 'llamada de video', 'cámara', 'video call', 'facetime'],
    d: [VIDEO, LENS, ...CALLER],
  },
  'video-call-off': {
    tags: ['cámara apagada', 'sin video', 'terminar videollamada', 'video off'],
    // Sin la persona: la diagonal le pasaba por la cabeza y dejaba pedazos
    d: [VIDEO, LENS],
    badge: slashOver(),
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
    d: [MIC, MIC_HOLDER, MIC_STEM],
    badge: slashOver(),
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
    d: BELL,
    badge: badge('dot'),
  },
  'bell-plus': {
    tags: ['crear aviso', 'suscribirse', 'activar notificaciones', 'add alert', 'subscribe'],
    d: BELL_B,
    badge: badge('plus'),
  },
  'bell-check': {
    tags: ['suscrito', 'avisos activos', 'notificación vista', 'subscribed'],
    d: BELL_B,
    badge: badge('check'),
  },
  'bell-clock': {
    tags: ['posponer aviso', 'recordatorio', 'más tarde', 'snooze', 'reminder'],
    d: BELL_B,
    badge: badge('clock'),
  },
  'bell-ringing': {
    tags: ['timbrando', 'alarma', 'notificación', 'ringing', 'alert'],
    d: [...BELL, arc(12, 9.35, 9.25, -155, -125).d, arc(12, 9.35, 9.25, -55, -25).d],
  },
  'bell-off': {
    tags: ['silenciar avisos', 'no molestar', 'notificaciones apagadas', 'notifications off'],
    d: BELL,
    badge: slashOver(),
  },
  'notification-badge': {
    tags: ['notificación', 'insignia', 'app con aviso', 'badge', 'notification'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] })],
    badge: badge('dot'),
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
    // Sin el punto del centro: quedaría entero detrás de la diagonal
    d: BROADCAST.slice(1),
    badge: slashOver(),
  },
  'radio-tower': {
    tags: ['antena', 'señal', 'transmisión', 'radio tower', 'antenna'],
    d: [circ(12, 7.25, 1.75), line([7.75, 21], [12, 9], [16.25, 21]), arc(12, 7.25, 5, 150, 210).d, arc(12, 7.25, 5, -30, 30).d, arc(12, 7.25, 8.25, 152, 208).d, arc(12, 7.25, 8.25, -28, 28).d],
  },
  'satellite-dish': {
    tags: ['satélite', 'parabólica', 'antena', 'satellite', 'dish'],
    // El brazo del receptor llega al punto (lo toca, no lo roza)
    d: [`${arc(9.25, 14.75, 6.5, 225, 45).d}Z`, line([9.25, 14.75], [13.75, 10.25]), dot(14.25, 9.75), arc(14.25, 9.75, 4, -80, -10).d, arc(14.25, 9.75, 7.25, -82, -8).d],
  },

  // ── Personas: la persona del núcleo ──
  'person-plus': {
    tags: ['agregar persona', 'invitar', 'nuevo usuario', 'add user', 'invite'],
    d: PERSON_L,
    badge: badge('plus'),
  },
  'person-minus': {
    tags: ['quitar persona', 'eliminar usuario', 'sacar', 'remove user'],
    d: PERSON_L,
    badge: badge('minus'),
  },
  'person-check': {
    tags: ['verificado', 'aprobado', 'usuario activo', 'verified user', 'approved'],
    d: PERSON_L,
    badge: badge('check'),
  },
  'person-x': {
    tags: ['rechazar', 'denegar acceso', 'usuario', 'deny user', 'reject'],
    d: PERSON_L,
    badge: badge('x'),
  },
  'person-block': {
    tags: ['bloquear', 'vetar', 'usuario bloqueado', 'block user', 'ban'],
    d: PERSON_L,
    badge: blockBadge(),
  },
  'person-clock': {
    tags: ['invitación pendiente', 'en espera', 'usuario', 'pending user'],
    d: PERSON_L,
    badge: badge('clock'),
  },
  'person-heart': {
    tags: ['contacto favorito', 'seguir', 'cliente frecuente', 'favorite', 'follow'],
    d: PERSON_L,
    badge: heartBadge(),
  },
  'person-edit': {
    tags: ['editar perfil', 'cuenta', 'datos personales', 'edit profile', 'account'],
    d: PERSON_L,
    badge: pencilOver([12.5, 21], 10.5),
  },
  'person-search': {
    tags: ['buscar persona', 'directorio', 'encontrar usuario', 'find user'],
    d: PERSON_L,
    badge: searchBadge(),
  },
  'person-arrow': {
    tags: ['asignar', 'transferir', 'delegar', 'assign', 'transfer'],
    d: PERSON_L,
    badge: arrowOver([14, 18], [21.5, 18]),
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
    // Las dos personas de atrás completas; la del frente va encima y el motor las despeja
    d: [-5.4, 5.4].flatMap((dx) => personAt(0.66, dx, -1.75)),
    badge: front(personAt(0.84)),
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
    // Las pestañas del lomo cruzan la tapa; el busto, corrido a la derecha, les deja 1.5 de aire
    d: [sq(5.5, 2.75, 14, 18.5, 3.5, { square: ['br'] }), ...bust(13.25, 10.25, 2.5, 21.25, 4.5), ...[6.5, 11.25, 16].map((y) => line([3.5, y], [7.25, y]))],
  },
  'handshake': {
    tags: ['apretón de manos', 'acuerdo', 'trato', 'handshake', 'deal'],
    // Dos puños de manga y las manos trabadas entre ellos, en una sola figura: arriba el nudillo de
    // una mano y la muesca donde asienta el pulgar de la otra; abajo los dedos que envuelven. El
    // pulgar y el dedo nacen del contorno (nada flota)
    d: [
      rline(
        [
          [2.75, 7],
          [6.25, 7],
          [6.25, 16.5],
          [2.75, 16.5],
        ],
        [0, 1, 1, 0],
      ),
      rline(
        [
          [21.25, 7],
          [17.75, 7],
          [17.75, 16.5],
          [21.25, 16.5],
        ],
        [0, 1, 1, 0],
      ),
      roundpoly(
        [
          [6.25, 9],
          [10, 7],
          [13, 9.5],
          [17.75, 9.5],
          [17.75, 14.5],
          [14, 17.75],
          [10.5, 17.75],
          [6.25, 14.5],
        ],
        [0, 2, 1, 0, 0, 2.5, 2.5, 0],
      ),
      line([13, 9.5], [10.25, 12.25]),
      line([11.75, 17.75], [14.75, 14.75]),
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
    // La cara corrida arriba a la izquierda y la sonrisa más chica: a 7.3 del centro de la insignia
    // queda entera (más cerca, el despeje la adelgazaba)
    d: [circ(10, 10, 7.5), dot(7.6, 8.2), dot(12.4, 8.2), arc(10, 10.25, 2.75, 35, 145).d],
    badge: badge('plus'),
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
    d: raisedHand(),
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
      // Las serpentinas nacen a 1.5 de aire de la boca del cono
      smooth([
        [11, 8.75],
        [11, 6.25],
        [13.5, 4.75],
      ]),
      smooth([
        [15.25, 13],
        [17.75, 13],
        [19.25, 10.5],
      ]),
      dot(17.25, 3.5),
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
    // 文 arriba y, encima, la gota en espejo con la A: el otro idioma responde
    d: wen(7.25, 7),
    badge: (() => {
      const bubble = dropL(15.25, 15, 6.25);
      const a = letterA(15.25, 12.25, 5.5);
      return own([bubble, ...a], bubble, { solid: [bubble], cut: a });
    })(),
  },

  // ── Cobertura (ronda 2): lo que faltaba de correo, difusión y celebraciones ──
  // Correo no deseado o con problema: el sobre del núcleo y la insignia de alerta del motor.
  'mail-alert': {
    tags: ['correo no deseado', 'spam', 'reportar correo', 'correo sospechoso', 'mail alert', 'junk', 'report spam'],
    d: MAIL_B,
    badge: badge('alert'),
  },
  // Suscripción por fuente (RSS): el punto de origen y dos arcos que se abren desde él, con el
  // aire de las ondas de `broadcast`.
  'rss': {
    tags: ['rss', 'fuente', 'suscribirse', 'feed', 'noticias', 'subscribe', 'news feed'],
    d: [dot(6.5, 17.5), arc(6.5, 17.5, 6, 270, 360).d, arc(6.5, 17.5, 11.5, 270, 360).d],
  },
  // Pastel (cumpleaños, aniversario): el cuerpo, el betún que escurre en tres ondas y tres velas
  // con su llama a 3 de la mecha.
  'cake': {
    tags: ['pastel', 'cumpleaños', 'aniversario', 'celebración', 'cake', 'birthday', 'anniversary'],
    d: [
      sq(3.75, 11, 16.5, 9.5, 2.5),
      `M3.75 14${[9.25, 14.75, 20.25].map((x) => `A3.27 3.27 0 0 0 ${x} 14`).join('')}`,
      ...[8, 12, 16].flatMap((x) => [line([x, 8], [x, 11]), dot(x, 4.25)]),
    ],
  },
};

// ── Relleno (DESIGN.md › Relleno), por índice de d ──
// `solid` se rellena (y conserva su trazo), `cut` se cala al ancho del trazo y `lines` sigue siendo
// línea con 1.5 de aire alrededor. Lo que toca al cuerpo y debe seguir unido va en `solid`; las
// puntas de flecha y las polilíneas con esquina van en `lines` (en `solid` cerrarían un triángulo).
const all = (name) => icons[name].d.map((_, i) => i);
const rest = (name, from = 1) => icons[name].d.map((_, i) => i).slice(from);
const FILL = {
  'mail-open': { solid: [0], cut: [1] },
  'mail-signature': { solid: [0], cut: [1, 2] },
  'mail-letter': { solid: [0], cut: [1] },
  'mail-stack': { solid: [0] },
  'mail-attachment': { solid: [0], cut: [1] },
  // El buzón: el poste, el asta y la bandera tocan al cuerpo y siguen unidos; la puerta se cala
  mailbox: { solid: [0, 2, 3, 4], cut: [1] },
  'phone-hangup': { solid: [0] },
  voicemail: { solid: [0, 1, 2] },
  dialpad: { solid: all('dialpad') },
  'video-call': { solid: [0, 1], cut: [2, 3] },
  'video-call-off': { solid: [0, 1] },
  'video-meeting': { solid: [0], lines: [1], cut: [2, 3] },
  'screen-share': { solid: [0], lines: [1], cut: [2, 3] },
  'screen-share-off': { solid: [0], lines: [1], cut: [2, 3] },
  microphone: { solid: [0], lines: [1, 2] },
  'microphone-off': { solid: [0], lines: [1, 2] },
  'walkie-talkie': { solid: [0, 1], cut: [2, 3] },
  'bell-ringing': { solid: [0, 1], lines: [2, 3] },
  'notification-badge': { solid: [0] },
  megaphone: { solid: [0, 1], lines: [2] },
  broadcast: { solid: [0], lines: [1, 2, 3, 4] },
  // La torre: la bola y las patas rellenas (el triángulo de la estructura), las ondas en línea
  'radio-tower': { solid: [0, 1], lines: [2, 3, 4, 5] },
  'satellite-dish': { solid: [0, 1, 2], lines: [3, 4] },
  'person-speaking': { solid: [0, 1], lines: [2, 3] },
  'person-circle': { solid: [0], cut: [1, 2] },
  people: { solid: [0, 1, 2, 3] },
  'id-card': { solid: [0], cut: [1, 2, 3, 4] },
  'id-badge': { solid: [0], cut: [1, 2, 3] },
  // Las pestañas siguen unidas a la tapa (con aire se leían como rayas sueltas)
  contacts: { solid: [0, 3, 4, 5], cut: [1, 2] },
  'face-laugh': { solid: [0], cut: [1, 2, 3] },
  'reaction-add': { solid: [0], cut: [1, 2, 3] },
  // El puño y la manga rellenos; la junta se cala para que no se vuelvan una sola mancha
  'thumbs-up': { solid: [0, 1] },
  'thumbs-down': { solid: [0, 1] },
  // La mano rellena con las rayas entre dedos caladas
  'hand-raised': { solid: [0], cut: [1, 2, 3] },
  'party-popper': { solid: [0, 3, 4, 5], lines: [1, 2] },
  // El sticker y su esquina despegada: la doblez se cala para separarlos, y los ojos también
  sticker: { solid: [0, 2], cut: [1, 3, 4] },
  translate: { solid: [0, 1, 2, 3] },
  cake: { solid: [0, 2, 3, 4, 5, 6, 7], cut: [1] },
};
// Globos con un signo dentro: la gota rellena y el signo calado
for (const name of Object.keys(icons).filter((n) => n.startsWith('message-') && !['message-unread', 'message-off'].includes(n))) FILL[name] = { solid: [0], cut: rest(name) };
for (const name of ['message-unread', 'message-off', 'messages']) FILL[name] = { solid: [0] };
// El sobre con su solapa calada (también bajo las insignias)
for (const name of ['mail-unread', 'mail-plus', 'mail-minus', 'mail-check', 'mail-x', 'mail-clock', 'mail-send', 'mail-draft', 'mail-search', 'mail-alert']) FILL[name] = { solid: [0], cut: [1] };
// El teléfono relleno; las flechas, signos y ondas de al lado siguen siendo línea con su aire
for (const name of ['phone-incoming', 'phone-outgoing', 'phone-missed', 'phone-plus', 'phone-forward', 'phone-transfer', 'phone-hold', 'phone-ringing']) FILL[name] = { solid: [0], lines: rest(name) };
FILL['phone-off'] = { solid: [0] };
// La campana: cuerpo y badajo
for (const name of ['bell-dot', 'bell-plus', 'bell-check', 'bell-clock', 'bell-off']) FILL[name] = { solid: [0, 1] };
// La persona: cabeza y cuerpo
for (const name of Object.keys(icons).filter((n) => n.startsWith('person-') && !['person-speaking', 'person-circle'].includes(n))) FILL[name] = { solid: [0, 1] };
// Las caras: el círculo relleno y los gestos calados
for (const name of ['face-smile', 'face-wink', 'face-neutral', 'face-confused', 'face-surprised', 'face-sad', 'face-angry']) FILL[name] = { solid: [0], cut: rest(name) };
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut?.length && { cut: pick(spec.cut) }), ...(spec.lines?.length && { lines: pick(spec.lines) }) };
}
// Los audífonos: las copas rellenas y la diadema, el brazo y la cápsula unidos a ellas, sin aire
icons.headset.fill = { solid: [icons.headset.d[1], icons.headset.d[2], twin(icons.headset.d[0]), twin(icons.headset.d[3]), icons.headset.d[4]] };
// El apretón: puños y manos rellenos; se calan la junta de cada mano con su puño, el pulgar y el dedo
icons.handshake.fill = {
  solid: icons.handshake.d.slice(0, 3),
  cut: [line([6.25, 9], [6.25, 14.5]), line([17.75, 9.5], [17.75, 14.5]), ...icons.handshake.d.slice(3)],
};
// La junta del puño con la manga, calada
icons['thumbs-up'].fill.cut = [THUMB_SEAM];
icons['thumbs-down'].fill.cut = [xf(THUMB_SEAM, { flipY: true })];
// Solo líneas abiertas: su relleno es el mismo contorno
for (const name of ['reply-all', 'at-sign', 'hashtag', 'broadcast-off', 'rss']) icons[name].fill = false;

// ── 16 px (DESIGN.md › 16 px): dibujos propios donde el ajuste al pixel no basta ──
// A 16 px un pixel mide 1.5 del lienzo: los centros caen en 0.75 + 1.5k y los bordes en 1.5k. El
// globo pequeño tiene sus cuatro extremos en centros de pixel (3.75 y 20.25), así se ve nítido.
const SDROP = drop(12, 12, 8.25);
const small = (name, glyph, { cut = glyph, solid = [SDROP] } = {}) => {
  icons[name].small = { d: [SDROP, ...glyph], fill: { solid, cut } };
};
// Los puntos: centrados en el borde del pixel para que cada uno caiga entero en 2 × 2 pixeles,
// con 1 pixel de aire entre ellos y contra el globo
small('message-dots', [7.5, 12, 16.5].map((x) => dot(x, 12, 1)));
// El corazón y la estrella, mayores y con el centro en la cuadrícula: a 13 pixeles de globo los
// del dibujo grande se volvían una mancha
small('message-heart', [heart(12, 9.75, 9)]);
small('message-star', [star(12, 12.4, 5.6, 2.75, 0.6, 0.45)]);
// El pastel: dos velas en centros de pixel con su llama a 1 pixel de aire (las tres del dibujo
// grande caían entre pixeles y sus llamas se fundían en una raya)
{
  const body = sq(3.75, 11.25, 16.5, 9, 2.25);
  const icing = `M3.75 14.25${[9.25, 14.75, 20.25].map((x) => `A3.27 3.27 0 0 0 ${x} 14.25`).join('')}`;
  const candles = [9.75, 14.25].flatMap((x) => [line([x, 8.25], [x, 11.25]), dot(x, 4.5)]);
  icons.cake.small = { d: [body, icing, ...candles], fill: { solid: [body, ...candles], cut: [icing] } };
}
// Las caras: el círculo de r 8.25 (sus extremos en centros de pixel; el de r 9 caía entre dos y se
// veía como un anillo gris), los ojos en 2 × 2 pixeles y cada boca con sus tramos rectos y sus
// extremos sobre la cuadrícula
{
  const sface = (name, mouth, eyes = [dot(9, 9, 0.8), dot(15, 9, 0.8)]) => {
    const d = [circ(12, 12, 8.25), ...eyes, ...mouth];
    icons[name].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
  };
  const smile = arc(12, 11.25, 4.5, 35, 145).d;
  const frown = arc(12, 20.25, 4.5, 215, 325).d;
  sface('face-smile', [smile]);
  sface('face-laugh', [`M7.5 12.75H16.5${arcTo(12, 12.75, 4.5, 0, 180)}`], [arc(9, 9.75, 1.5, 180, 360).d, arc(15, 9.75, 1.5, 180, 360).d]);
  sface('face-wink', [smile], [dot(9, 9, 0.8), line([13.5, 9.75], [16.5, 9.75])]);
  sface('face-neutral', [line([8.25, 15.75], [15.75, 15.75])]);
  sface('face-confused', [
    smooth([
      [8.25, 15.75],
      [10.5, 14.25],
      [13.5, 15.75],
      [15.75, 14.25],
    ]),
  ]);
  sface('face-surprised', [circ(12, 15, 2.25)]);
  sface('face-sad', [frown]);
  sface('face-angry', [frown], [line([7.5, 8.25], [10.5, 9.75]), line([16.5, 8.25], [13.5, 9.75])]);
}
// El teclado: 3 × 3 y el cero, cada punto en 2 × 2 pixeles con 1 pixel de aire (a 16 px los del
// dibujo grande caían entre pixeles y se veían grises)
{
  const d = [4.5, 9, 13.5].flatMap((y) => [7.5, 12, 16.5].map((x) => dot(x, y, 0.8))).concat(dot(12, 18, 0.8));
  icons.dialpad.small = { d, fill: { solid: d } };
}

// ── Piezas con nombre (DESIGN.md › Piezas): lo que se anima, cambia de nivel o va bajo una insignia ──
const PARTS = {
  'message-dots': { body: [0], dots: [1, 2, 3] },
  'message-clock': { body: [0], hands: [1] },
  'message-heart': { body: [0], mark: [1] },
  'message-sparkle': { body: [0], mark: [1] },
  'message-reply': { body: [0], arrow: [1, 2] },
  'message-unread': { body: [0] },
  'message-off': { body: [0] },
  messages: { back: [0] },
  'mail-attachment': { body: [0], flap: [1] },
  'mail-letter': { letter: [0, 1] },
  'mail-stack': { back: [0] },
  'reply-all': { arrow: [0, 1, 2] },
  'phone-incoming': { body: [0], arrow: [1, 2] },
  'phone-outgoing': { body: [0], arrow: [1, 2] },
  'phone-forward': { body: [0], arrow: [1, 2] },
  'phone-transfer': { body: [0], arrow: [1, 2, 3, 4] },
  'phone-ringing': { body: [0] },
  'phone-off': { body: [0] },
  'video-call-off': { body: [0], lens: [1] },
  'screen-share': { screen: [0], stand: [1], arrow: [2, 3] },
  'microphone-off': { body: [0], holder: [1, 2] },
  'bell-ringing': { body: [0], clapper: [1], wave: [2, 3] },
  'notification-badge': { body: [0] },
  broadcast: { source: [0] },
  'broadcast-off': { wave: [0, 1, 2, 3] },
  'radio-tower': { source: [0], tower: [1] },
  'satellite-dish': { dish: [0], feed: [1, 2] },
  'person-speaking': { head: [0], body: [1] },
  people: { back: [0, 1, 2, 3] },
  'thumbs-up': { hand: [0], cuff: [1] },
  'thumbs-down': { hand: [0], cuff: [1] },
  'hand-raised': { hand: [0], fingers: [1, 2, 3] },
  handshake: { cuffs: [0, 1], hands: [2, 3, 4] },
  'party-popper': { cone: [0], streamers: [1, 2], confetti: [3, 4, 5] },
  translate: { glyph: [0, 1, 2, 3] },
  rss: { source: [0] },
};
for (const name of ['mail-unread', 'mail-plus', 'mail-minus', 'mail-check', 'mail-x', 'mail-clock', 'mail-send', 'mail-draft', 'mail-search', 'mail-alert']) PARTS[name] = { body: [0], flap: [1] };
for (const name of ['bell-dot', 'bell-plus', 'bell-check', 'bell-clock', 'bell-off']) PARTS[name] = { body: [0], clapper: [1] };
for (const name of ['person-plus', 'person-minus', 'person-check', 'person-x', 'person-block', 'person-clock', 'person-heart', 'person-edit', 'person-search', 'person-arrow'])
  PARTS[name] = { head: [0], body: [1] };
PARTS['reaction-add'] = { face: [0, 1, 2, 3] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Niveles (DESIGN.md › Niveles): las ondas se encienden de adentro hacia afuera ──
icons.broadcast.levels = [
  [1, 2],
  [3, 4],
];
icons['radio-tower'].levels = [
  [2, 3],
  [4, 5],
];
icons['satellite-dish'].levels = [[3], [4]];
icons['phone-ringing'].levels = [[1], [2]];
icons['person-speaking'].levels = [[2], [3]];
icons.rss.levels = [[1], [2]];
for (const name of ['broadcast', 'radio-tower', 'satellite-dish', 'phone-ringing', 'person-speaking', 'rss']) icons[name].parts.level = icons[name].levels.flat();

// ── Variantes automáticas que no tienen sentido ──
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Un globo con un signo dentro ya es un encierro (como un ícono -circle), y el signo hace de
// insignia: el tache lo atravesaría
variants(
  Object.keys(icons).filter((n) => n.startsWith('message-') && !['message-unread', 'message-off'].includes(n)),
  { circle: false, square: false, slash: false },
);
// Ya vienen encerrados en un círculo o en un cuadrado
variants(['face-smile', 'face-laugh', 'face-wink', 'face-neutral', 'face-confused', 'face-surprised', 'face-sad', 'face-angry', 'person-circle', 'reaction-add'], { circle: false });
variants(['notification-badge', 'sticker'], { square: false });
// Sin tachado: los -off dibujados a mano y sus bases; las insignias (el tache las atravesaría);
// las líneas, signos y puntos sueltos, donde un tache no dice nada
variants(['video-call', 'screen-share', 'screen-share-off', 'microphone', 'broadcast'], { slash: false });
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, slash: false };
variants(['reply-all', 'dialpad', 'hashtag', 'at-sign'], { slash: false });
// Al 58 % los puntos del teclado se juntan
variants(['dialpad'], { circle: false, square: false });

// ── Espejo (DESIGN.md › Espejo): lo que tiene dirección de lectura ──
for (const name of ['message-reply', 'reply-all', 'mail-send', 'mail-draft', 'phone-forward', 'person-edit', 'person-arrow', 'person-speaking', 'megaphone', 'id-card']) icons[name].mirror = true;

// ── Movimiento (DESIGN.md › Movimiento): el gesto propio de cada ícono ──
icons['message-heart'].motion = { effect: 'beat', parts: ['mark'], origin: [12, 12.75] };
icons['message-sparkle'].motion = { effect: 'beat', parts: ['mark'], origin: [12, 12] };
icons['message-clock'].motion = { effect: 'spin', parts: ['hands'], origin: [12, 12.25] };
icons['message-reply'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] };
icons['reply-all'].motion = { effect: 'slide', vector: [-2, 0] };
icons['mail-send'].motion = { effect: 'slide', parts: ['badge'], vector: [2, 0] };
icons['mail-draft'].motion = { effect: 'wiggle', parts: ['badge'], origin: [13, 21.25] };
icons['person-edit'].motion = { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] };
icons['person-arrow'].motion = { effect: 'slide', parts: ['badge'], vector: [2, 0] };
icons['phone-incoming'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 1.5] };
icons['phone-outgoing'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, -1.5] };
icons['phone-forward'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['phone-ringing'].motion = { effect: 'ring', origin: [12, 12] };
icons['screen-share'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
for (const name of ['bell-dot', 'bell-ringing']) icons[name].motion = { effect: 'ring', parts: ['body', 'clapper'], origin: [12, 2.95] };
for (const name of ['bell-plus', 'bell-check', 'bell-clock']) icons[name].motion = { effect: 'ring', parts: ['body', 'clapper'], origin: BELL_B_TOP };
for (const name of ['message-unread', 'mail-unread', 'notification-badge']) icons[name].motion = { effect: 'beat', parts: ['badge'], origin: [18.75, 5.25] };
icons['thumbs-up'].motion = { effect: 'bounce', vector: [0, -2] };
icons['thumbs-down'].motion = { effect: 'bounce', vector: [0, 2] };
icons['hand-raised'].motion = { effect: 'wiggle', origin: [12, 20.75] };
icons['party-popper'].motion = { effect: 'beat', parts: ['confetti', 'streamers'], origin: [7.25, 16.75] };

export default { category: 'comunicacion', label: 'Comunicación y personas', icons };
