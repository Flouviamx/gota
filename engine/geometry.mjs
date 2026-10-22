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
