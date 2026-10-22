// Motor de dibujo de Gota, los íconos de Flouvia. Todo vive en el lienzo de 24 × 24 y devuelve
// el `d` de un path. Las reglas de uso están en DESIGN.md.

/** Número con dos decimales como máximo, sin ceros de sobra. */
export const f = (n) => {
  const s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const P = (x, y) => `${f(x)} ${f(y)}`;

// Esquina continua (squircle) al estilo Apple: el algoritmo de suavizado de esquinas de Figma
// con suavizado 0.6. Devuelve las medidas de una esquina de radio r.
function corner(r, s = 0.6) {
  if (r <= 0) return null;
  const p = (1 + s) * r;
  const arc = 90 * (1 - s);
  const L = Math.sin(((arc / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - arc) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L, r };
}

/**
 * Rectángulo de esquinas continuas. `square`: esquinas rectas, p. ej. ['br'] (la firma: la
 * esquina inferior derecha recta, como la gota del isotipo). El radio no debe pasar de
 * min(w, h) / 3.2 para que el suavizado quepa.
 */
export function sq(x, y, w, h, r, { square = [], smoothing = 0.6 } = {}) {
  const k = {};
  for (const n of ['tl', 'tr', 'br', 'bl']) k[n] = corner(square.includes(n) ? 0 : r, smoothing);
  const p = (n) => (k[n] ? k[n].p : 0);
  const o = [`M${P(x + w - p('tr'), y)}`];
  let t = k.tr;
  if (t) o.push(`c${f(t.a)} 0 ${f(t.a + t.b)} 0 ${f(t.a + t.b + t.c)} ${f(t.d)}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(t.L)} ${f(t.L)}c${f(t.d)} ${f(t.c)} ${f(t.d)} ${f(t.b + t.c)} ${f(t.d)} ${f(t.a + t.b + t.c)}`);
  o.push(`L${P(x + w, y + h - p('br'))}`);
  t = k.br;
  if (t) o.push(`c0 ${f(t.a)} 0 ${f(t.a + t.b)} ${f(-t.d)} ${f(t.a + t.b + t.c)}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(-t.L)} ${f(t.L)}c${f(-t.c)} ${f(t.d)} ${f(-(t.b + t.c))} ${f(t.d)} ${f(-(t.a + t.b + t.c))} ${f(t.d)}`);
  o.push(`L${P(x + p('bl'), y + h)}`);
  t = k.bl;
  if (t) o.push(`c${f(-t.a)} 0 ${f(-(t.a + t.b))} 0 ${f(-(t.a + t.b + t.c))} ${f(-t.d)}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(-t.L)} ${f(-t.L)}c${f(-t.d)} ${f(-t.c)} ${f(-t.d)} ${f(-(t.b + t.c))} ${f(-t.d)} ${f(-(t.a + t.b + t.c))}`);
  o.push(`L${P(x, y + p('tl'))}`);
  t = k.tl;
  if (t) o.push(`c0 ${f(-t.a)} 0 ${f(-(t.a + t.b))} ${f(t.d)} ${f(-(t.a + t.b + t.c))}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(t.L)} ${f(-t.L)}c${f(t.c)} ${f(-t.d)} ${f(t.b + t.c)} ${f(-t.d)} ${f(t.a + t.b + t.c)} ${f(-t.d)}`);
  return `${o.join('')}Z`;
}

/** Círculo. */
export const circ = (cx, cy, r) => `M${P(cx - r, cy)}A${f(r)} ${f(r)} 0 1 0 ${P(cx + r, cy)}A${f(r)} ${f(r)} 0 1 0 ${P(cx - r, cy)}Z`;

/** Punto: un círculo diminuto que con el trazo de 1.5 se ve sólido (diámetro ≈ 2.9). */
export const dot = (x, y, r = 0.7) => circ(x, y, r);

/** La gota del isotipo: un círculo con la esquina inferior derecha recta (globos de conversación). */
export const drop = (cx, cy, r) =>
  `M${P(cx + r, cy)}V${f(cy + r)}H${f(cx)}A${f(r)} ${f(r)} 0 0 1 ${P(cx - r, cy)}A${f(r)} ${f(r)} 0 0 1 ${P(cx, cy - r)}A${f(r)} ${f(r)} 0 0 1 ${P(cx + r, cy)}Z`;

/** Punto de un círculo a `deg` grados (0 = derecha, 90 = abajo: sentido horario en pantalla). */
export const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

/** Arco de a0 a a1 grados (si a1 > a0 va en sentido horario). Devuelve { d, end, tangent }. */
export function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  const rad = (a1 * Math.PI) / 180;
  const dir = sweep ? 1 : -1;
  return { d: `M${P(x0, y0)}A${f(r)} ${f(r)} 0 ${large} ${sweep} ${P(x1, y1)}`, end: [x1, y1], tangent: [-Math.sin(rad) * dir, Math.cos(rad) * dir] };
}

/**
 * Punta de flecha en `tip` mirando hacia `dir` (vector). `len` = largo de cada brazo (6 en
 * las flechas rectas, 3.4 en las de arco), `spread` = media apertura en grados (45).
 */
export function head(tip, dir, len = 6, spread = 45) {
  const n = Math.hypot(dir[0], dir[1]);
  const [ux, uy] = [dir[0] / n, dir[1] / n];
  const armTo = (k) => {
    const c = Math.cos((k * Math.PI) / 180);
    const s = Math.sin((k * Math.PI) / 180);
    return [tip[0] - len * (ux * c - uy * s), tip[1] - len * (ux * s + uy * c)];
  };
  return line(armTo(spread), tip, armTo(-spread));
}

/** Polígono con esquinas redondeadas (radio por esquina o uno para todas). */
export function roundpoly(pts, radius) {
  const n = pts.length;
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = pts[(i - 1 + n) % n];
    const V = pts[i];
    const B = pts[(i + 1) % n];
    const r = rr[i];
    let ux = A[0] - V[0];
    let uy = A[1] - V[1];
    const lu = Math.hypot(ux, uy);
    ux /= lu;
    uy /= lu;
    let vx = B[0] - V[0];
    let vy = B[1] - V[1];
    const lv = Math.hypot(vx, vy);
    vx /= lv;
    vy /= lv;
    const th = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    const t = r ? r / Math.tan(th / 2) : 0;
    const S = [V[0] + ux * t, V[1] + uy * t];
    const E = [V[0] + vx * t, V[1] + vy * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    let seg = `${i === 0 ? 'M' : 'L'}${P(...S)}`;
    if (r) seg += `A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(...E)}`;
    out.push(seg);
  }
  return `${out.join('')}Z`;
}

/** Línea abierta por puntos. */
export const line = (...pts) => `M${pts.map((p) => P(...p)).join('L')}`;

/** Gira un punto `deg` grados alrededor de `c`. */
export function rot(p, c, deg) {
  const a = (deg * Math.PI) / 180;
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
}

/**
 * Puntero (cursor del mouse): punta arriba a la izquierda, canto izquierdo vertical, diagonal a
 * 45° hasta el ala y la cola saliendo de la base hacia abajo a la derecha. `tip` es la punta y `s`
 * la escala (1 ≈ 11.4 × 19 del lienzo). Todo puntero del set sale de aquí.
 */
export function cursor(tip, s = 1) {
  const L = [0, 16.2];
  const W = [11.4, 11.4];
  const u = [W[0] - L[0], W[1] - L[1]];
  const lu = Math.hypot(u[0], u[1]);
  const ub = [u[0] / lu, u[1] / lu];
  const C = [L[0] + u[0] * 0.46, L[1] + u[1] * 0.46];
  const d = [0.38, 0.925];
  // La cola conserva al menos 0.8 de aire por dentro aunque el puntero se reduzca
  const h = Math.max(2.9, 2.3 / s) / 2;
  const N1 = [C[0] - ub[0] * h, C[1] - ub[1] * h];
  const N2 = [C[0] + ub[0] * h, C[1] + ub[1] * h];
  const T1 = [N1[0] + d[0] * 4.8, N1[1] + d[1] * 4.8];
  const T2 = [N2[0] + d[0] * 4.8, N2[1] + d[1] * 4.8];
  const pts = [[0, 0], L, N1, T1, T2, N2, W].map(([x, y]) => [tip[0] + x * s, tip[1] + y * s]);
  // La punta casi viva (en un ángulo de 45° un radio grande la vuelve roma)
  return roundpoly(pts, [0.55, 1, 0.35, 0.8, 0.8, 0.35, 0.9].map((r) => r * s));
}

// ── Insignias ──
// Se dibujan una vez, aquí, y van siempre en el mismo lugar: abajo a la derecha (centro 17.25,
// 17.25, r 4.25) o, el punto de aviso, arriba a la derecha. `knock` es el área que el motor
// despeja del ícono base con un aire exacto de 1.5 (nunca se recorta la base a mano).
const BC = [17.25, 17.25];
const BR = 4.25;
const signs = {
  plus: () => [`M${f(BC[0])} ${f(BC[1] - 2)}v4`, `M${f(BC[0] - 2)} ${f(BC[1])}h4`],
  minus: () => [`M${f(BC[0] - 2)} ${f(BC[1])}h4`],
  check: () => [line([BC[0] - 1.9, BC[1] + 0.15], [BC[0] - 0.55, BC[1] + 1.45], [BC[0] + 1.95, BC[1] - 1.3])],
  x: () => [line([BC[0] - 1.45, BC[1] - 1.45], [BC[0] + 1.45, BC[1] + 1.45]), line([BC[0] + 1.45, BC[1] - 1.45], [BC[0] - 1.45, BC[1] + 1.45])],
  alert: () => [`M${f(BC[0])} ${f(BC[1] - 2.1)}v2.2`, circ(BC[0], BC[1] + 1.95, 0.35)],
  info: () => [`M${f(BC[0])} ${f(BC[1] - 0.4)}v2.4`, circ(BC[0], BC[1] - 2.05, 0.35)],
  clock: () => [line([BC[0], BC[1] - 2.1], [BC[0], BC[1]], [BC[0] + 1.45, BC[1] + 0.85])],
  'arrow-up': () => [`M${f(BC[0])} ${f(BC[1] + 2.1)}V${f(BC[1] - 2)}`, line([BC[0] - 1.75, BC[1] - 0.25], [BC[0], BC[1] - 2], [BC[0] + 1.75, BC[1] - 0.25])],
  'arrow-down': () => [`M${f(BC[0])} ${f(BC[1] - 2.1)}V${f(BC[1] + 2)}`, line([BC[0] - 1.75, BC[1] + 0.25], [BC[0], BC[1] + 2], [BC[0] + 1.75, BC[1] + 0.25])],
  'arrow-right': () => [`M${f(BC[0] - 2.1)} ${f(BC[1])}H${f(BC[0] + 2)}`, line([BC[0] + 0.25, BC[1] - 1.75], [BC[0] + 2, BC[1]], [BC[0] + 0.25, BC[1] + 1.75])],
  star: () => [roundpoly(Array.from({ length: 10 }, (_, i) => polar(BC[0], BC[1] + 0.25, i % 2 ? 1.05 : 2.55, -90 + i * 36)), 0.2)],
};
/**
 * Insignia estándar. kind: plus, minus, check, x, alert, info, clock, arrow-up, arrow-down,
 * arrow-right, star (en círculo, abajo a la derecha), lock (candado sin círculo, abajo a la
 * derecha) o dot (punto de aviso, arriba a la derecha). Devuelve { kind, d, knock, fill }; con
 * { size: 16 } (o el render a ≤ 18 px, solo) da su versión de pixel: sin anillo, el signo más grande.
 */
export function badge(kind, { size } = {}) {
  if (size && size <= 18) return badge16(kind);
  return { kind, ...badge24(kind) };
}

function badge24(kind) {
  if (kind === 'dot') {
    const d = [circ(18.75, 5.25, 2), circ(18.75, 5.25, 0.7)];
    return { d, knock: d[0], fill: { solid: d } };
  }
  if (kind === 'lock') {
    const d = [sq(13.5, 16.25, 7.5, 5.5, 1.6, { square: ['br'] }), 'M15.1 16.25v-1.4a2.15 2.15 0 0 1 4.3 0v1.4'];
    return { d, knock: sq(13.5, 12.7, 7.5, 9.05, 2.4, { square: ['br'] }), fill: { solid: [d[0]], wire: [d[1]] } };
  }
  if (!signs[kind]) throw new Error(`Insignia desconocida: ${kind}`);
  const ring = circ(BC[0], BC[1], BR);
  const marks = signs[kind]();
  // Rellena: el círculo sólido y el signo calado
  return { d: [ring, ...marks], knock: ring, fill: { solid: [ring], cut: marks } };
}

// ── Insignias a 16 px ──
// A 16 px el anillo de r 4.25 mide 5.7 px y el signo se empasta: como en SF Symbols, la insignia
// pierde el anillo y queda el signo, más grande y en la cuadrícula de pixel (a 16 px un pixel son
// 1.5 del lienzo y sus centros caen en 0.75 + 1.5k). El área despejada sigue siendo la del anillo.
// Diseño de las categorías de la ronda 2 (archivos, comercio), llevado al motor para todo el set.
const PX = (k) => 0.75 + 1.5 * k;
const AT = (dx, dy) => [PX(11 + dx), PX(11 + dy)];
const RING16 = circ(BC[0], BC[1], BR);
const SIGN16 = {
  plus: () => [line(AT(0, -2), AT(0, 2)), line(AT(-2, 0), AT(2, 0))],
  minus: () => [line(AT(-2, 0), AT(2, 0))],
  check: () => [line(AT(-2, 0), AT(0, 2), AT(3, -1))],
  x: () => [line(AT(-2, -2), AT(2, 2)), line(AT(2, -2), AT(-2, 2))],
  alert: () => [line(AT(0, -3), AT(0, 0)), circ(...AT(0, 2), 0.1)],
  info: () => [line(AT(0, 0), AT(0, 3)), circ(...AT(0, -2), 0.1)],
  'arrow-up': () => [line(AT(0, 2), AT(0, -2)), line(AT(-2, 0), AT(0, -2), AT(2, 0))],
  'arrow-down': () => [line(AT(0, -2), AT(0, 2)), line(AT(-2, 0), AT(0, 2), AT(2, 0))],
  'arrow-right': () => [line(AT(-2, 0), AT(2, 0)), line(AT(0, -2), AT(2, 0), AT(0, 2))],
  star: () => [roundpoly([AT(0, -3), AT(1, -1), AT(3, -1), AT(1.5, 0.5), AT(2, 3), AT(0, 1.5), AT(-2, 3), AT(-1.5, 0.5), AT(-3, -1), AT(-1, -1)], 0.3)],
};
function badge16(kind) {
  if (kind === 'clock') {
    const face = circ(BC[0], BC[1], 4.5);
    const hands = line(AT(0, -2), AT(0, 0), AT(1, 1));
    return { kind, d: [face, hands], knock: face, fill: { solid: [face], cut: [hands] } };
  }
  if (kind === 'dot') return { kind, ...badge24(kind) };
  if (kind === 'lock') {
    // El candado de pixel: cuerpo de 4 × 3 pixeles con la firma y arco de 2 pixeles
    const body = sq(PX(9), PX(11), 6, 4.5, 1.2, { square: ['br'] });
    const shackle = `M${f(PX(10))} ${f(PX(11))}V${f(PX(10))}A1.5 1.5 0 0 1 ${f(PX(12))} ${f(PX(10))}V${f(PX(11))}`;
    return { kind, d: [body, shackle], knock: sq(13.5, 12.7, 7.5, 9.05, 2.4, { square: ['br'] }), fill: { solid: [body], wire: [shackle] } };
  }
  if (!SIGN16[kind]) throw new Error(`Insignia desconocida: ${kind}`);
  const d = SIGN16[kind]();
  // Rellena: las figuras cerradas (la estrella) van sólidas; los signos de línea siguen siendo línea
  return { kind, d, knock: `${RING16}${d.join('')}`, ...(kind === 'star' && { fill: { solid: d } }) };
}
