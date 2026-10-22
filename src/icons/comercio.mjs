// Comercio y finanzas: compra, pago, dinero, envío e inventario. Todo se calcula con el motor
// (engine/geometry.mjs) y las reglas de DESIGN.md: trazo de 1.5, keylines, esquinas continuas y
// la esquina inferior derecha recta en los contenedores.
import { arc, circ, dot, drop, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

// ── Utilidades locales ────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);

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
    const u = sub(A, V);
    const v = sub(B, V);
    const [lu, lv] = [len(u), len(v)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (v[0] / lv) * t, V[1] + (v[1] / lv) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Las cuatro esquinas de sq() en orden [tr, br, bl, tl]: punto de arranque y trazo relativo. */
function corners(x, y, w, h, r, opts) {
  return sq(x, y, w, h, r, opts)
    .match(/[ML][^MLZ]*/g)
    .map((t) => {
      const m = t.slice(1).match(/^(-?[\d.]+) (-?[\d.]+)(.*)$/);
      return { p: [+m[1], +m[2]], c: m[3] };
    });
}

/**
 * Tramo abierto de un sq(): de `A` (sobre el borde `eA`) a `B` (sobre el borde `eB`) en sentido
 * horario. Bordes: 0 arriba, 1 derecha, 2 abajo, 3 izquierda.
 */
function sqOpen(x, y, w, h, r, opts, A, eA, B, eB) {
  const k = corners(x, y, w, h, r, opts);
  let s = `M${pt(A)}`;
  let e = eA;
  do {
    s += `L${pt(k[e].p)}${k[e].c}`;
    e = (e + 1) % 4;
  } while (e !== eB);
  return `${s}L${pt(B)}`;
}

// Insignia de la esquina inferior derecha: círculo de r 4 y recorte de 1.5 de aire alrededor.
const BC = [17.75, 17.75];
const BR = 4;
const BD = BR + 3;

/** Contenedor sq() con la esquina inferior derecha mordida por la insignia. */
function sqBadge(x, y, w, h, r, opts = { square: ['br'] }, c = BC, D = BD) {
  const xa = c[0] - Math.sqrt(D ** 2 - (y + h - c[1]) ** 2);
  const yb = c[1] - Math.sqrt(D ** 2 - (x + w - c[0]) ** 2);
  return sqOpen(x, y, w, h, r, opts, [xa, y + h], 2, [x + w, yb], 1);
}

/** Segmento a→b sin la parte que cae dentro del círculo (c, D). */
function clip(a, b, c = BC, D = BD) {
  const d = sub(b, a);
  const f0 = sub(a, c);
  const A = d[0] ** 2 + d[1] ** 2;
  const B = 2 * (f0[0] * d[0] + f0[1] * d[1]);
  const C = f0[0] ** 2 + f0[1] ** 2 - D ** 2;
  const disc = B * B - 4 * A * C;
  if (disc <= 0) return [line(a, b)];
  const t0 = (-B - Math.sqrt(disc)) / (2 * A);
  const t1 = (-B + Math.sqrt(disc)) / (2 * A);
  const at = (t) => [a[0] + d[0] * t, a[1] + d[1] * t];
  const out = [];
  if (t0 > 0.02) out.push(line(a, at(Math.min(t0, 1))));
  if (t1 < 0.98) out.push(line(at(Math.max(t1, 0)), b));
  return out;
}

/** Círculo (cx, cy, r) abierto donde lo muerde la insignia. */
function circBadge(cx, cy, r, c = BC, D = BD) {
  const d = len(sub(c, [cx, cy]));
  const base = (Math.atan2(c[1] - cy, c[0] - cx) * 180) / Math.PI;
  const half = (Math.acos((r * r + d * d - D * D) / (2 * r * d)) * 180) / Math.PI;
  return arc(cx, cy, r, base + half, base + 360 - half).d;
}

/** Insignia: círculo con más, menos, check o x. */
function badge(kind, c = BC, r = BR) {
  const [x, y] = c;
  const o = [circ(x, y, r)];
  if (kind === 'plus') o.push(line([x - 1.75, y], [x + 1.75, y]), line([x, y - 1.75], [x, y + 1.75]));
  if (kind === 'minus') o.push(line([x - 1.75, y], [x + 1.75, y]));
  if (kind === 'check') o.push(line([x - 1.85, y + 0.1], [x - 0.55, y + 1.4], [x + 1.85, y - 1.15]));
  if (kind === 'back') o.push(line([x + 1.9, y], [x - 1.9, y]), line([x - 0.15, y - 1.75], [x - 1.9, y], [x - 0.15, y + 1.75]));
  if (kind === 'x') o.push(line([x - 1.35, y - 1.35], [x + 1.35, y + 1.35]), line([x + 1.35, y - 1.35], [x - 1.35, y + 1.35]));
  return o;
}

/** Glifos sueltos (más, menos, check, x) para el interior de un contenedor. */
function glyph(kind, [x, y], s = 1.75) {
  if (kind === 'plus') return [line([x - s, y], [x + s, y]), line([x, y - s], [x, y + s])];
  if (kind === 'minus') return [line([x - s, y], [x + s, y])];
  if (kind === 'check') return [line([x - s * 1.1, y + s * 0.05], [x - s * 0.3, y + s * 0.85], [x + s * 1.15, y - s * 0.7])];
  const k = s * 0.8;
  return [line([x - k, y - k], [x + k, y + k]), line([x + k, y - k], [x - k, y + k])];
}

/** Signo de porcentaje: dos aros y la diagonal. */
const percent = (cx, cy, s, rr, L) => [circ(cx - s, cy - s, rr), circ(cx + s, cy + s, rr), line([cx - L, cy + L], [cx + L, cy - L])];

/** Porcentaje compacto: puntos en lugar de aros (para piezas chicas). */
const percentDots = (cx, cy, s, L) => [dot(cx - s, cy - s), dot(cx + s, cy + s), line([cx - L, cy + L], [cx + L, cy - L])];

/** Arco de un punto a otro sobre un círculo, con las banderas calculadas. */
function arcTo(c, r, from, to, cw = true) {
  const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
  const a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
  let span = ((a1 - a0) * 180) / Math.PI;
  if (cw) span = (span + 360) % 360;
  else span = (-span + 360) % 360;
  return `A${N(r)} ${N(r)} 0 ${span > 180 ? 1 : 0} ${cw ? 1 : 0} ${pt(to)}`;
}

/** Corazón de dos lóbulos y punta; `w` = ancho total. */
function heart(cx, cy, w) {
  const r = w * 0.28;
  const a = w / 2 - r;
  const T = [cx, cy + w * 0.5];
  const CL = [cx - a, cy];
  const CR = [cx + a, cy];
  const dip = [cx, cy - Math.sqrt(r * r - a * a)];
  const tangent = (C, side) => {
    const v = sub(T, C);
    const d = len(v);
    const phi = Math.atan2(v[1], v[0]);
    const k = Math.acos(r / d);
    const p1 = [C[0] + r * Math.cos(phi + k), C[1] + r * Math.sin(phi + k)];
    const p2 = [C[0] + r * Math.cos(phi - k), C[1] + r * Math.sin(phi - k)];
    return side < 0 ? (p1[0] < p2[0] ? p1 : p2) : p1[0] > p2[0] ? p1 : p2;
  };
  const L = tangent(CL, -1);
  const R = tangent(CR, 1);
  return `M${pt(T)}L${pt(L)}${arcTo(CL, r, L, dip)}${arcTo(CR, r, dip, R)}Z`;
}

/** Ondas de toldo: arcos que cuelgan entre x0 y x1 (de derecha a izquierda). */
function scallops(x0, x1, y, n, sag) {
  const c = (x1 - x0) / n;
  const R = ((c * c) / 4 + sag * sag) / (2 * sag);
  let s = '';
  for (let i = n - 1; i >= 0; i--) s += `A${N(R)} ${N(R)} 0 0 1 ${pt([x0 + c * i, y])}`;
  return s;
}

/** Signo de dólar: una S de dos óvalos y el asta arriba y abajo. */
function dollar(cx, cy, h, w = h * 0.68, stub = 1.5) {
  const ry = h / 4;
  const rx = w / 2;
  const up = [cx, cy - ry];
  const lo = [cx, cy + ry];
  const at = (c, deg) => [c[0] + rx * Math.cos((deg * Math.PI) / 180), c[1] + ry * Math.sin((deg * Math.PI) / 180)];
  const s0 = at(up, -28);
  const s1 = at(lo, 152);
  return [
    `M${pt(s0)}A${N(rx)} ${N(ry)} 0 1 0 ${pt([cx, cy])}A${N(rx)} ${N(ry)} 0 1 1 ${pt(s1)}`,
    line([cx, cy - h / 2 - stub], [cx, cy - h / 2]),
    line([cx, cy + h / 2], [cx, cy + h / 2 + stub]),
  ];
}

// ── Piezas compartidas ────────────────────────────────────────────────────────────────────────

// Carrito: asa, canasta y dos ruedas. La canasta es un contenedor: frente vertical y la esquina
// inferior derecha recta (la firma). Deja hueco para un glifo en CART_IN; ruedas a 3 del fondo.
const CART_IN = [13.25, 10.1];
const cart = () => [
  roundline(
    [
      [2.75, 3.25],
      [4.4, 3.25],
      [6.95, 14.5],
      [20.25, 14.5],
      [20.25, 5.75],
      [4.97, 5.75],
    ],
    [0, 1, 1.5, 0, 1.5, 0],
  ),
  circ(8.75, 19.25, 1.5),
  circ(17.75, 19.25, 1.5),
];

// Bolsa de compra: cuerpo con la esquina de la firma y asa en arco.
const BAG_IN = [12, 14.5];
const bag = () => [
  roundpoly(
    [
      [5.75, 8],
      [18.25, 8],
      [19.75, 21],
      [4.25, 21],
    ],
    [1.75, 1.75, 0, 2.5],
  ),
  'M8.5 8V6.75a3.5 3.5 0 0 1 7 0V8',
];

// Documento del núcleo (14.5 × 18.5, radio 3.75).
const DOC = [4.75, 2.75, 14.5, 18.5, 3.75];
// Tarjeta del núcleo (19 × 14, radio 3.75).
const CARD = [2.5, 5, 19, 14, 3.75];

// Recibo: arriba con esquinas continuas y abajo el corte en sierra.
function receipt(x = 4.75, y = 2.75, w = 14.5, h = 18.5, teeth = 5, depth = 1.5) {
  const k = corners(x, y, w, h, 3.5);
  const tl = k[3];
  const tr = k[0];
  const z = [];
  const step = w / teeth;
  for (let i = 1; i <= teeth * 2; i++) z.push([x + w - (step / 2) * i, i % 2 ? y + h - depth : y + h]);
  return `M${pt([x, y + h])}L${pt(tl.p)}${tl.c}L${pt(tr.p)}${tr.c}L${pt([x + w, y + h])}${z.map((p) => `L${pt(p)}`).join('')}`;
}

// Etiqueta de precio: un pentágono con la punta arriba a la izquierda y su ojal.
function tag({ L = 17.5, H = 5.75, nose = 5.5, c = [12, 12], ang = 45 } = {}) {
  const local = [
    [0, 0],
    [nose, -H],
    [L, -H],
    [L, H],
    [nose, H],
  ];
  const mid = [L * 0.52, 0];
  const pts = local.map((p) => rot(sub(p, mid), [0, 0], ang)).map((p) => add(p, c));
  const hole = add(rot(sub([nose - 0.25, 0], mid), [0, 0], ang), c);
  const toWorld = (p) => add(rot(sub(p, mid), [0, 0], ang), c);
  return { body: roundpoly(pts, [1.6, 1.4, 2.4, 2.4, 1.4]), hole, toWorld };
}

const T = tag();

const mul = (v, k) => [v[0] * k, v[1] * k];
const unit = (v) => mul(v, 1 / len(v));
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** Avanza `d` desde a hacia b. */
const toward = (a, b, d) => add(a, mul(unit(sub(b, a)), d));

/** Parámetros t (0–1) donde el segmento a→b cruza el círculo (c, D). */
function hits(a, b, c = BC, D = BD) {
  const d = sub(b, a);
  const f0 = sub(a, c);
  const A = d[0] ** 2 + d[1] ** 2;
  const B = 2 * (f0[0] * d[0] + f0[1] * d[1]);
  const C = f0[0] ** 2 + f0[1] ** 2 - D ** 2;
  const q = Math.sqrt(Math.max(0, B * B - 4 * A * C));
  return [(-B - q) / (2 * A), (-B + q) / (2 * A)].map((t) => add(a, mul(d, t)));
}

// Caja isométrica del núcleo (`box`): mismas proporciones, pendiente de 28.4°.
function iso(cx, top, w, h, k = 0.541) {
  const wk = w * k;
  return { T: [cx, top], R: [cx + w, top + wk], C: [cx, top + 2 * wk], L: [cx - w, top + wk], Rb: [cx + w, top + wk + h], B: [cx, top + 2 * wk + h], Lb: [cx - w, top + wk + h] };
}

/** Paquete: la caja del núcleo con la cinta sobre la tapa; `cut` deja lugar a la insignia. */
function parcel({ cx = 12, top = 2.75, w = 8.6, h = 9.2, cut = false, tape = true } = {}) {
  const P = iso(cx, top, w, h);
  const outline = cut ? roundline([hits(P.Rb, P.B)[1], P.B, P.Lb, P.L, P.T, P.R, hits(P.R, P.Rb)[0]], [0, 1.6, 1.6, 1.6, 1.6, 1.6, 0]) : roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 1.6);
  const o = [outline, line(toward(P.L, P.C, 0.4), P.C, toward(P.R, P.C, 0.4)), line(P.C, toward(P.B, P.C, 0.4))];
  if (tape) {
    const u = unit(sub(P.R, P.T));
    const [a, b] = [mid(P.T, P.R), mid(P.L, P.C)];
    const [Pm, Pp, Qm, Qp] = [add(a, mul(u, -1.5)), add(a, mul(u, 1.5)), add(b, mul(u, -1.5)), add(b, mul(u, 1.5))];
    o.push(line(Pm, Qm, add(Qm, [0, 3]), add(Qp, [0, 3]), Qp, Pp));
  }
  return o;
}

/** Estrella de cinco puntas con las puntas suavizadas. */
const star = (cx, cy, ro, ri, r = 0.55) =>
  roundpoly(
    Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? ri : ro, -90 + i * 36)),
    Array.from({ length: 10 }, (_, i) => (i % 2 ? r * 0.6 : r)),
  );

/** Hoja: dos arcos iguales entre p0 y p1. */
const leaf = (p0, p1, R) => `M${pt(p0)}A${N(R)} ${N(R)} 0 0 1 ${pt(p1)}A${N(R)} ${N(R)} 0 0 1 ${pt(p0)}Z`;

/** Firma manuscrita: un trazo continuo de curvas, escalado desde (x, y). */
function signature(x, y, k = 1) {
  const seg = [
    [1, -2.5, 2.25, -3.5, 2.75, -2.5],
    [3.35, -1.35, 2.35, 0.85, 3.5, 0.5],
    [4.5, 0.2, 5, -1.85, 6, -1.5],
    [6.75, -1.25, 6.35, 0, 7.5, 0],
  ];
  const P2 = (a, b) => pt([x + a * k, y + b * k]);
  return `M${P2(0, 0)}${seg.map((c) => `C${P2(c[0], c[1])} ${P2(c[2], c[3])} ${P2(c[4], c[5])}`).join('')}`;
}

/** Rectángulo girado con esquinas redondeadas (piezas que no son contenedores). */
function rrect(c, a, hw, hh, r) {
  const u = unit(a);
  const n = [-u[1], u[0]];
  const P = (i, j) => add(c, add(mul(u, i * hw), mul(n, j * hh)));
  return roundpoly([P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], r);
}

// La firma: contenedor con la esquina inferior derecha recta.
const SQ = { square: ['br'] };
/** Espejo horizontal sobre el eje x = 12 (piezas simétricas). */
const M = (p) => [24 - p[0], p[1]];
/** Desplaza un punto. */
const at = (p, dx, dy) => [p[0] + dx, p[1] + dy];

// Apretón de manos: dos antebrazos que suben desde los puños; la mano derecha queda al frente y sus
// dedos envuelven a la izquierda, cuyo pulgar asoma arriba. Todo a 3 o más entre trazos paralelos.
const handshake = (dy = -0.75) => {
  const s = (p) => at(p, 0, dy);
  return [
    line(s([2.75, 14.5]), s([6.25, 18])),
    roundline([s([4.5, 12.75]), s([9.5, 7.75]), s([10.75, 7.75])], [0, 1.5, 0]),
    line(s([8.25, 16.5]), s([9.4, 15.35])),
    line(s(M([2.75, 14.5])), s(M([6.25, 18]))),
    roundline([s(M([4.5, 12.75])), s([16, 8.5]), s([14.25, 8.5]), s([10.5, 12.25]), s([11.75, 13.5])], [0, 1.5, 1.75, 1, 0]),
    line(s(M([8.25, 16.5])), s(M([9.4, 15.35]))),
  ];
};

const icons = {
  // ── Carrito ──
  'cart': { tags: ['carrito', 'carrito vacío', 'compra', 'cart', 'shopping cart', 'empty cart'], d: cart() },
  'cart-full': {
    tags: ['carrito lleno', 'productos', 'compra', 'cart full', 'shopping', 'items'],
    d: [
      ...cart(),
      roundline(
        [
          [7.75, 5.75],
          [7.75, 2.25],
          [11.5, 2.25],
          [11.5, 5.75],
        ],
        [0, 1.25, 1.25, 0],
      ),
      'M14.5 5.75a2.1 2.1 0 0 1 4.2 0',
    ],
  },
  'cart-plus': { tags: ['agregar al carrito', 'añadir', 'comprar', 'add to cart', 'cart plus'], d: [...cart(), ...glyph('plus', CART_IN, 1.6)] },
  'cart-minus': { tags: ['quitar del carrito', 'restar', 'menos', 'remove from cart', 'cart minus'], d: [...cart(), ...glyph('minus', CART_IN, 1.6)] },
  'cart-check': { tags: ['carrito listo', 'pedido confirmado', 'compra', 'cart checked', 'checkout'], d: [...cart(), ...glyph('check', CART_IN, 1.6)] },
  'cart-remove': { tags: ['vaciar carrito', 'eliminar', 'cancelar compra', 'cart remove', 'clear cart'], d: [...cart(), ...glyph('x', CART_IN, 1.6)] },
  'cart-arrow-down': {
    tags: ['agregar al carrito', 'meter al carrito', 'comprar', 'add to cart', 'cart download'],
    d: [...cart(), line([CART_IN[0], 8], [CART_IN[0], 12]), head([CART_IN[0], 12], [0, 1], 2.4)],
  },

  // ── Bolsa y canasta ──
  'bag': { tags: ['bolsa', 'bolsa de compra', 'tienda', 'shopping bag', 'bag'], d: bag() },
  'bag-plus': { tags: ['agregar a la bolsa', 'añadir', 'comprar', 'add to bag', 'bag plus'], d: [...bag(), ...glyph('plus', BAG_IN, 2)] },
  'bag-minus': { tags: ['quitar de la bolsa', 'restar', 'menos', 'remove from bag', 'bag minus'], d: [...bag(), ...glyph('minus', BAG_IN, 2)] },
  'bag-check': { tags: ['compra hecha', 'pedido', 'confirmado', 'bag check', 'purchased'], d: [...bag(), ...glyph('check', BAG_IN, 1.9)] },
  'bag-remove': { tags: ['eliminar de la bolsa', 'quitar', 'cancelar', 'remove from bag', 'bag x'], d: [...bag(), ...glyph('x', BAG_IN, 2)] },
  'bag-heart': { tags: ['favoritos', 'lista de deseos', 'me gusta', 'wishlist', 'favorites'], d: [...bag(), heart(12, 13.25, 6.5)] },
  'bag-return': {
    tags: ['devolución', 'devolver compra', 'regresar', 'return', 'refund order'],
    d: [...bag(), 'M9.5 13.25H12.5a2 2 0 0 1 0 4H10.25', head([9.5, 13.25], [-1, 0], 2.4)],
  },
  'basket': {
    tags: ['canasta', 'cesta', 'súper', 'compra', 'basket', 'grocery'],
    d: [
      roundpoly(
        [
          [3.25, 10.25],
          [20.75, 10.25],
          [18.75, 20.75],
          [5.25, 20.75],
        ],
        [1.25, 1.25, 0, 1.75],
      ),
      'M7 10.25A5 5 0 0 1 17 10.25',
      line([9, 13.5], [9.4, 17.5]),
      line([12, 13.5], [12, 17.5]),
      line([15, 13.5], [14.6, 17.5]),
    ],
  },

  // ── Tienda ──
  'store': {
    tags: ['tienda', 'local', 'escaparate', 'negocio', 'storefront', 'shop'],
    d: [
      `${roundline(
        [
          [3.25, 8.25],
          [5.25, 3.25],
          [18.75, 3.25],
          [20.75, 8.25],
        ],
        [0, 1.25, 1.25, 0],
      )}${scallops(3.25, 20.75, 8.25, 4, 1.5)}`,
      roundline(
        [
          [4.75, 12.25],
          [4.75, 20.75],
          [19.25, 20.75],
          [19.25, 12.25],
        ],
        [0, 2.25, 0, 0],
      ),
      roundline(
        [
          [9.75, 20.75],
          [9.75, 15.25],
          [14.25, 15.25],
          [14.25, 20.75],
        ],
        [0, 1.5, 1.5, 0],
      ),
    ],
  },
  'store-online': {
    tags: ['tienda en línea', 'ecommerce', 'comercio electrónico', 'online store', 'web shop'],
    d: [
      sq(4.25, 4.5, 15.5, 11, 2.75, SQ),
      `M19.75 8.25${scallops(4.25, 19.75, 8.25, 3, 1.25)}`,
      roundline(
        [
          [10.25, 15.5],
          [10.25, 12.5],
          [13.75, 12.5],
          [13.75, 15.5],
        ],
        [0, 1, 1, 0],
      ),
      line([2.5, 18.75], [21.5, 18.75]),
    ],
  },
  'market-stall': {
    tags: ['puesto', 'mercado', 'tianguis', 'feria', 'market stall', 'kiosk'],
    d: [
      `${roundline(
        [
          [3.25, 8.25],
          [5.25, 3.25],
          [18.75, 3.25],
          [20.75, 8.25],
        ],
        [0, 1.25, 1.25, 0],
      )}${scallops(3.25, 20.75, 8.25, 4, 1.5)}`,
      line([4.75, 12.25], [4.75, 20.75]),
      line([19.25, 12.25], [19.25, 20.75]),
      line([2.75, 15.75], [21.25, 15.75]),
    ],
  },

  // ── Recibo, factura y cotización ──
  'receipt': {
    tags: ['recibo', 'ticket de compra', 'comprobante', 'receipt', 'order'],
    d: [receipt(), line([8.5, 7.75], [15.5, 7.75]), line([8.5, 11.25], [15.5, 11.25]), line([8.5, 14.75], [12.25, 14.75])],
  },
  'receipt-tax': { tags: ['impuestos', 'IVA', 'retención', 'tax', 'vat', 'tax receipt'], d: [receipt(), ...percent(12, 11.25, 2.4, 1.15, 3.25)] },
  'invoice': {
    tags: ['factura', 'cobro', 'cuenta', 'invoice', 'bill'],
    d: [sq(...DOC, SQ), ...dollar(12, 10.25, 7.5, 5, 1.25), line([8.75, 17.25], [15.25, 17.25])],
  },
  'invoice-plus': {
    tags: ['nueva factura', 'facturar', 'emitir', 'new invoice', 'create bill'],
    d: [sqBadge(...DOC), ...dollar(11, 9.75, 7, 4.75, 1.25), ...badge('plus')],
  },
  'invoice-paid': {
    tags: ['factura pagada', 'pagado', 'liquidada', 'invoice paid', 'settled'],
    d: [sqBadge(...DOC), ...dollar(11, 9.75, 7, 4.75, 1.25), ...badge('check')],
  },
  'invoice-due': {
    tags: ['factura vencida', 'por pagar', 'pendiente', 'invoice due', 'overdue'],
    d: [sqBadge(...DOC), ...dollar(11, 9.75, 7, 4.75, 1.25), circ(...BC, BR), line([17.75, 15.75], [17.75, 17.75], [19.25, 18.75])],
  },
  'price-quote': {
    tags: ['cotización', 'presupuesto', 'pedir precio', 'quote', 'estimate', 'price request'],
    d: [drop(12, 11.75, 8.75), ...dollar(12, 11.75, 8, 5.25, 1.25)],
  },
  'purchase-order': {
    tags: ['orden de compra', 'pedido', 'lista', 'purchase order', 'po'],
    d: [
      sqOpen(4.75, 4.25, 14.5, 17, 3, SQ, [14.25, 4.25], 0, [9.75, 4.25], 0),
      sq(9.75, 2.75, 4.5, 3.25, 1.25),
      dot(8.5, 9.75),
      line([11.25, 9.75], [15.75, 9.75]),
      dot(8.5, 13.25),
      line([11.25, 13.25], [15.75, 13.25]),
      dot(8.5, 16.75),
      line([11.25, 16.75], [14, 16.75]),
    ],
  },
  'contract-signed': {
    tags: ['contrato', 'firma', 'acuerdo', 'contract', 'signed', 'agreement'],
    d: [sq(...DOC, SQ), line([8.75, 7.5], [15.25, 7.5]), line([8.75, 11], [15.25, 11]), signature(8.5, 17.25, 0.9)],
  },
  'deal': { tags: ['trato', 'apretón de compra', 'cerrar venta', 'acuerdo comercial', 'deal', 'handshake'], d: handshake() },

  // ── Precio y descuento ──
  'price-tag': { tags: ['etiqueta', 'precio', 'producto', 'price tag', 'label'], d: [T.body, circ(...T.hole, 1.25)] },
  'price-tags': {
    tags: ['etiquetas', 'precios', 'catálogo', 'price tags', 'labels'],
    d: (() => {
      const t = tag({ L: 15, H: 5, nose: 5, c: [11.5, 9.75] });
      const e = [t.toWorld([8, 8]), t.toWorld([18, 8]), t.toWorld([18, -0.5])];
      return [t.body, circ(...t.hole, 1.15), roundline(e, [0, 2.4, 0])];
    })(),
  },
  'price-tag-percent': {
    tags: ['oferta', 'descuento', 'rebaja', 'sale tag', 'discount'],
    d: [T.body, circ(...T.hole, 1.25), ...percentDots(...T.toWorld([11.5, 0]), 1.75, 2.5)],
  },
  'price-tag-dollar': {
    tags: ['precio', 'etiqueta', 'costo', 'price', 'cost'],
    d: [T.body, circ(...T.hole, 1.25), ...dollar(...T.toWorld([11.25, 0]), 5.25, 3.5, 0.85)],
  },
  'percent': { tags: ['porcentaje', 'descuento', 'tasa', 'percent', 'percentage'], d: percent(12, 12, 4.75, 2.6, 6.75) },
  'percent-circle': { tags: ['porcentaje', 'tasa', 'impuesto', 'rate', 'percent'], d: [circ(12, 12, 9), ...percent(12, 12, 3, 1.4, 4.25)] },
  'discount': {
    tags: ['descuento', 'oferta', 'sello', 'promoción', 'discount', 'sale badge'],
    d: [
      roundpoly(
        Array.from({ length: 24 }, (_, i) => polar(12, 12, i % 2 ? 7.85 : 9.15, i * 15 - 90)),
        Array.from({ length: 24 }, (_, i) => (i % 2 ? 1.1 : 0.9)),
      ),
      ...percent(12, 12, 2.6, 1.2, 3.25),
    ],
  },
  'coupon': {
    tags: ['cupón', 'vale', 'código de descuento', 'coupon', 'voucher'],
    d: (() => {
      const [x, y, w, h, r] = [2.5, 5.25, 19, 13.5, 3];
      const k = corners(x, y, w, h, r);
      const n = 8.5;
      const nr = 1.75;
      return [
        `M${pt(k[0].p)}${k[0].c}L${pt(k[1].p)}${k[1].c}L${pt([n + nr, y + h])}A${nr} ${nr} 0 0 0 ${pt([n - nr, y + h])}L${pt(k[2].p)}${k[2].c}L${pt(k[3].p)}${k[3].c}L${pt([n - nr, y])}A${nr} ${nr} 0 0 0 ${pt([n + nr, y])}Z`,
        ...percentDots(15, 12, 2.4, 3.25),
      ];
    })(),
  },

  // ── Cartera y tarjetas ──
  'wallet': {
    tags: ['cartera', 'billetera', 'monedero', 'wallet', 'purse'],
    d: [sq(2.75, 5.5, 18.5, 14, 3.5, SQ), 'M21.25 9.25H16.75a3.25 3.25 0 0 0 0 6.5H21.25', dot(16.75, 12.5)],
  },
  'wallet-cards': {
    tags: ['cartera', 'tarjetas', 'métodos de pago', 'wallet', 'cards', 'payment methods'],
    d: (() => {
      // La tarjeta asoma inclinada y se corta 1.5 antes del borde de la cartera
      const top = 9.5;
      const cut = top - 3;
      const c = [10.75, 7.5];
      const P = (x, y) => rot(add(c, [x, y]), c, -9);
      const [TL, TR, BLc, BRc] = [P(-6.5, -4.25), P(6.5, -4.25), P(-6.5, 4.25), P(6.5, 4.25)];
      const onCut = (p, q) => [p[0] + ((q[0] - p[0]) * (cut - p[1])) / (q[1] - p[1]), cut];
      return [sq(2.75, top, 18.5, 11.75, 3.25, SQ), 'M21.25 12.5H17.5a2.75 2.75 0 0 0 0 5.5H21.25', roundline([onCut(TL, BLc), TL, TR, onCut(TR, BRc)], [0, 1.75, 1.75, 0])];
    })(),
  },
  'card-chip': {
    tags: ['tarjeta', 'chip', 'tarjeta de crédito', 'card chip', 'credit card'],
    d: [sq(...CARD, SQ), sq(5.75, 8, 6, 5, 1.6), line([5.75, 10.5], [11.75, 10.5]), line([5.75, 16], [13.75, 16])],
  },
  'card-contactless': {
    tags: ['sin contacto', 'tarjeta', 'pago con acercamiento', 'contactless card', 'tap to pay'],
    d: [sq(...CARD, SQ), sq(5.75, 9.5, 6, 5, 1.6), line([5.75, 12], [11.75, 12]), arc(12.75, 12, 3.5, -38, 38).d, arc(12.75, 12, 6.5, -38, 38).d],
  },
  'card-plus': {
    tags: ['agregar tarjeta', 'nuevo método de pago', 'add card', 'new card'],
    d: [sqBadge(...CARD), ...clip([2.5, 9.6], [21.5, 9.6]), line([6.25, 15], [9.75, 15]), ...badge('plus')],
  },
  'card-check': {
    tags: ['pago aprobado', 'tarjeta', 'cobro exitoso', 'payment approved', 'card verified'],
    d: [sqBadge(...CARD), ...clip([2.5, 9.6], [21.5, 9.6]), line([6.25, 15], [9.75, 15]), ...badge('check')],
  },
  'card-declined': {
    tags: ['pago rechazado', 'tarjeta', 'declinada', 'payment declined', 'card error'],
    d: [sqBadge(...CARD), ...clip([2.5, 9.6], [21.5, 9.6]), line([6.25, 15], [9.75, 15]), ...badge('x')],
  },
  'cards': {
    tags: ['tarjetas', 'métodos de pago', 'cartera', 'cards', 'payment methods'],
    d: [
      sq(2.5, 8, 16, 12, 3.25, SQ),
      sqOpen(5.5, 5, 16, 12, 3.25, SQ, [6.25, 5], 0, [21.5, 17], 1),
      line([2.5, 11.75], [18.5, 11.75]),
    ],
  },
  'loyalty-card': {
    tags: ['tarjeta de lealtad', 'puntos', 'cliente frecuente', 'loyalty', 'membership'],
    d: [sq(...CARD, SQ), star(12, 12.3, 4.6, 2, 0.7)],
  },
  'gift-card': {
    tags: ['tarjeta de regalo', 'regalo', 'vale', 'gift card', 'voucher'],
    d: (() => {
      // Listón vertical y moño: dos lazos y dos puntas que salen del nudo
      const k = [9, 11.5];
      return [
        sq(...CARD, SQ),
        line([k[0], 5], [k[0], 19]),
        leaf(k, add(k, [-3.4, -3.2]), 2.5),
        leaf(add(k, [3.4, -3.2]), k, 2.5),
        line(k, add(k, [-2.5, 3])),
        line(k, add(k, [2.5, 3])),
      ];
    })(),
  },
  'contactless': {
    tags: ['sin contacto', 'pago con acercamiento', 'nfc', 'contactless', 'tap'],
    d: [3.5, 7, 10.5, 14].map((r) => arc(3.75, 12, r, -38, 38).d),
  },
  'mobile-payment': {
    tags: ['pago móvil', 'celular', 'pagar con el teléfono', 'mobile payment', 'phone pay'],
    d: [sq(3.5, 2.75, 10.5, 18.5, 3, SQ), line([7.25, 5.75], [10.25, 5.75]), arc(12.5, 12, 5.5, -36, 36).d, arc(12.5, 12, 8.75, -36, 36).d],
  },

  // ── Billetes y monedas ──
  'banknote': {
    tags: ['billete', 'efectivo', 'dinero', 'cash', 'bill'],
    d: [sq(2.5, 5.5, 19, 13, 3.25, SQ), circ(12, 12, 2.75), dot(6.5, 12), dot(17.5, 12)],
  },
  'banknotes': {
    tags: ['billetes', 'efectivo', 'dinero', 'money', 'cash'],
    d: [sq(2.5, 4, 19, 12.5, 3.25, SQ), circ(12, 10.25, 2.5), dot(6.5, 10.25), dot(17.5, 10.25), line([4.75, 19.5], [19.25, 19.5])],
  },
  'money-bag': {
    tags: ['bolsa de dinero', 'ahorro', 'fondos', 'money bag', 'funds'],
    d: [
      `M9.6 8.25H14.4${arcTo([12, 14.6], 6.8, [14.4, 8.25], [9.6, 8.25])}Z`,
      roundline(
        [
          [9.6, 8.25],
          [7.75, 3.25],
          [16.25, 3.25],
          [14.4, 8.25],
        ],
        [0, 0.9, 0.9, 0],
      ),
      ...dollar(12, 14.75, 5.5, 3.75, 0.9),
    ],
  },
  'coins': {
    tags: ['monedas', 'cambio', 'dinero', 'coins', 'change'],
    d: [circBadge(15.25, 8.75, 6, [8.75, 15.25], 9), circ(8.75, 15.25, 6), ...dollar(8.75, 15.25, 5.25, 3.5, 0.85)],
  },
  'gold-bars': {
    tags: ['lingotes', 'oro', 'reserva', 'gold', 'bullion'],
    d: [
      roundpoly(
        [
          [2.75, 19.75],
          [4.5, 13.25],
          [9.5, 13.25],
          [11.25, 19.75],
        ],
        1,
      ),
      roundpoly(
        [
          [12.75, 19.75],
          [14.5, 13.25],
          [19.5, 13.25],
          [21.25, 19.75],
        ],
        1,
      ),
      roundpoly(
        [
          [7.75, 13.25],
          [9.5, 6.75],
          [14.5, 6.75],
          [16.25, 13.25],
        ],
        1,
      ),
    ],
  },

  // ── Signos de moneda ──
  'dollar': { tags: ['dólar', 'peso', 'signo de pesos', 'dinero', 'dollar sign', 'money'], d: dollar(12, 12, 14, 9.25, 2.25) },
  'currency-dollar': { tags: ['dólar', 'peso', 'moneda', 'usd', 'mxn', 'dollar'], d: [circ(12, 12, 9), ...dollar(12, 12, 9, 6, 1.5)] },
  'currency-euro': {
    tags: ['euro', 'moneda', 'eur', 'divisa', 'currency'],
    d: [circ(12, 12, 9), arc(13.25, 12, 4.75, 45, 315).d, line([7, 10.5], [12, 10.5]), line([7, 13.5], [12, 13.5])],
  },
  'currency-pound': {
    tags: ['libra', 'libra esterlina', 'moneda', 'gbp', 'pound'],
    d: [circ(12, 12, 9), 'M15 8.75A2.85 2.85 0 0 0 9.85 9.6V14.25C9.85 15.35 9.35 16.2 8.5 16.75H15.75', line([8.25, 12.25], [13, 12.25])],
  },
  'currency-yen': {
    tags: ['yen', 'yuan', 'moneda', 'jpy', 'currency'],
    d: [circ(12, 12, 9), line([8.5, 6.75], [12, 11], [15.5, 6.75]), line([12, 11], [12, 17.5]), line([8.75, 12.25], [15.25, 12.25]), line([8.75, 15.25], [15.25, 15.25])],
  },
  'currency-bitcoin': {
    tags: ['bitcoin', 'cripto', 'criptomoneda', 'btc', 'crypto'],
    d: [
      circ(12, 12, 9),
      'M9.5 7.5H13.1A2.25 2.25 0 0 1 13.1 12H9.5ZM9.5 12H13.6A2.25 2.25 0 0 1 13.6 16.5H9.5V12',
      line([10.75, 5.75], [10.75, 7.5]),
      line([13.25, 5.75], [13.25, 7.5]),
      line([10.75, 16.5], [10.75, 18.25]),
      line([13.25, 16.5], [13.25, 18.25]),
    ],
  },
  'currency-exchange': {
    tags: ['tipo de cambio', 'divisas', 'cambiar moneda', 'exchange', 'forex'],
    d: [
      circ(7, 7, 4.25),
      ...dollar(7, 7, 4.5, 3, 0),
      circ(17, 17, 4.25),
      arc(17.6, 17, 2.1, 50, 310).d,
      line([14.4, 17], [17, 17]),
      'M14 5H16.25A2.75 2.75 0 0 1 19 7.75V10.25',
      head([19, 10.25], [0, 1], 2.75),
      'M10 19H7.75A2.75 2.75 0 0 1 5 16.25V13.75',
      head([5, 13.75], [0, -1], 2.75),
    ],
  },

  // ── Banco, ahorro e inversión ──
  'bank': {
    tags: ['banco', 'institución', 'finanzas', 'bank', 'finance'],
    d: [
      roundpoly(
        [
          [12, 2.75],
          [20.75, 8.25],
          [3.25, 8.25],
        ],
        [1, 1, 1],
      ),
      line([6.75, 11.25], [6.75, 17]),
      line([12, 11.25], [12, 17]),
      line([17.25, 11.25], [17.25, 17]),
      line([3.25, 20], [20.75, 20]),
    ],
  },
  'piggy-bank': {
    tags: ['alcancía', 'ahorro', 'cochinito', 'savings', 'piggy bank'],
    d: (() => {
      const [cx, cy, rx, ry] = [11, 14, 7.5, 5];
      const ex = (y) => cx + rx * Math.sqrt(1 - ((y - cy) / ry) ** 2);
      const on = (t) => [cx + rx * Math.cos((t * Math.PI) / 180), cy + ry * Math.sin((t * Math.PI) / 180)];
      const A = [ex(12.25), 12.25];
      const B = [ex(15.75), 15.75];
      const snout = roundline([A, [20.5, 12.25], [20.5, 15.75], B], [0, 1.1, 1.1, 0]).slice(1);
      const legY = cy + ry * Math.sqrt(1 - (3.75 / rx) ** 2);
      return [
        `M${pt(B)}A${rx} ${ry} 0 1 1 ${pt(A)}L${snout}Z`,
        roundline([on(-74), [15.25, 6.25], on(-44)], [0, 0.9, 0]),
        dot(15.25, 12.75),
        circ(10, 4.5, 1.6),
        line([7.25, legY], [7.25, 20.75]),
        line([14.75, legY], [14.75, 20.75]),
      ];
    })(),
  },
  'safe-box': {
    tags: ['caja fuerte', 'bóveda', 'resguardo', 'safe', 'vault'],
    d: [
      sq(3.25, 3.25, 17.5, 15.5, 3.5, SQ),
      // El volante de tres rayos: con cuatro en diagonal se leía como una X (cerrar)
      circ(10.75, 11, 1.75),
      ...[-90, 30, 150].map((a) => line(polar(10.75, 11, 1.75, a), polar(10.75, 11, 4.75, a))),
      line([17, 8.75], [17, 13.25]),
      line([6.75, 18.75], [6.75, 20.75]),
      line([17.25, 18.75], [17.25, 20.75]),
    ],
  },
  'atm': {
    tags: ['cajero automático', 'retiro', 'efectivo', 'atm', 'cash machine'],
    d: [
      sq(2.75, 3, 18.5, 7.75, 3, SQ),
      line([6.5, 6.875], [17.5, 6.875]),
      roundline(
        [
          [7.25, 10.75],
          [7.25, 20.75],
          [16.75, 20.75],
          [16.75, 10.75],
        ],
        [0, 2, 0, 0],
      ),
      // El billete que sale lleva el signo: con un aro se confundía con una impresora
      ...dollar(12, 15.75, 5.5, 3.75, 0.9),
    ],
  },
  'cheque': {
    tags: ['cheque', 'pago', 'documento bancario', 'check', 'bank check'],
    d: [sq(2.5, 5.5, 19, 13, 3.25, SQ), line([6, 9.5], [12.5, 9.5]), line([6, 12.75], [9.25, 12.75]), signature(11.5, 15.25, 0.8)],
  },
  'mortgage': {
    tags: ['hipoteca', 'crédito', 'casa', 'vivienda', 'mortgage', 'home loan'],
    d: [
      roundline(
        [
          [2.75, 11],
          [12, 3.25],
          [21.25, 11],
        ],
        [0, 1.5, 0],
      ),
      roundline(
        [
          [5, 9.11],
          [5, 20.75],
          [19, 20.75],
          [19, 9.11],
        ],
        [0, 2.5, 0, 0],
      ),
      ...dollar(12, 15, 6, 4, 0.9),
    ],
  },
  'investment': {
    tags: ['inversión', 'crecimiento', 'rendimiento', 'invest', 'growth'],
    d: [circ(12, 17, 4.25), ...dollar(12, 17, 4.75, 3, 0.6), line([12, 12.75], [12, 7.25]), leaf([12, 9.75], [6.25, 5.75], 4.25), leaf([17.75, 3.75], [12, 7.75], 4.25)],
  },
  'revenue-up': {
    tags: ['ingresos', 'crecimiento', 'ganancia', 'ventas al alza', 'revenue', 'profit'],
    d: [...dollar(7.75, 12, 11.5, 7.25, 1.75), line([16.75, 19.75], [16.75, 4.5]), head([16.75, 4.5], [0, -1], 4.75)],
  },
  'revenue-down': {
    tags: ['pérdida', 'caída', 'ventas a la baja', 'gastos', 'loss', 'decline'],
    d: [...dollar(7.75, 12, 11.5, 7.25, 1.75), line([16.75, 4.25], [16.75, 19.5]), head([16.75, 19.5], [0, 1], 4.75)],
  },
  'stocks': {
    tags: ['bolsa de valores', 'acciones', 'velas', 'mercado', 'stocks', 'trading'],
    d: [
      [5.25, 6.75, 9.25, 15.25, 18.5],
      [12, 3.25, 5.75, 12.25, 15.5],
      [18.75, 8.5, 11, 17.75, 20.75],
    ].flatMap(([x, t, b0, b1, bt]) => [line([x, t], [x, b0]), sq(x - 1.75, b0, 3.5, b1 - b0, 1.1), line([x, b1], [x, bt])]),
  },

  // ── Pagos ──
  'recurring-payment': {
    tags: ['pago recurrente', 'suscripción', 'cobro automático', 'subscription', 'recurring'],
    d: (() => {
      const a = arc(12, 12, 8.5, 205, 330);
      const b = arc(12, 12, 8.5, 25, 150);
      return [a.d, head(a.end, a.tangent, 3.4), b.d, head(b.end, b.tangent, 3.4), ...dollar(12, 12, 7, 4.5, 1.15)];
    })(),
  },
  'refund': {
    tags: ['reembolso', 'devolución de dinero', 'regresar pago', 'refund', 'money back'],
    d: (() => {
      const a = arc(12, 12.4, 8.1, 218, -82);
      return [a.d, head(a.end, a.tangent, 3.4), ...dollar(12, 12.4, 8, 5.25, 1.25)];
    })(),
  },
  'secure-payment': {
    tags: ['pago seguro', 'protección', 'compra protegida', 'secure payment', 'safe checkout'],
    d: [
      'M11.3 3.15a2 2 0 0 1 1.4 0l5.65 2.12c.6.23 1 .8 1 1.44v4.92c0 4.6-2.95 8.1-7.35 9.82-4.4-1.72-7.35-5.22-7.35-9.82V6.71c0-.64.4-1.21 1-1.44Z',
      ...dollar(12, 12, 7, 4.5, 1.15),
    ],
  },
  'tip-jar': {
    tags: ['propina', 'bote', 'frasco', 'tip', 'tip jar'],
    d: [sq(5, 8.25, 14, 13, 3.75, SQ), line([6.75, 5.25], [17.25, 5.25]), ...dollar(12, 14.75, 6, 4, 0.9)],
  },
  'donation': {
    tags: ['donativo', 'donación', 'causa', 'donate', 'charity'],
    d: [heart(12, 9.75, 18.5), ...dollar(12, 11.25, 6, 4, 0.85)],
  },
  'reward-points': {
    tags: ['puntos', 'recompensa', 'lealtad', 'rewards', 'points'],
    d: [circ(12, 12, 9), star(12, 12.35, 5.25, 2.3, 0.75)],
  },

  // ── Punto de venta ──
  'cash-register': {
    tags: ['caja registradora', 'punto de venta', 'caja', 'cash register', 'checkout'],
    d: [
      sq(4.25, 2.75, 8.5, 4.5, 1.5),
      line([8.5, 7.25], [8.5, 9.5]),
      sq(3.25, 9.5, 17.5, 11.5, 3, SQ),
      line([3.25, 15.75], [20.75, 15.75]),
      line([10.25, 18.4], [13.75, 18.4]),
      ...[6.75, 10.25, 13.75, 17.25].map((x) => dot(x, 12.6, 0.3)),
    ],
  },
  'payment-terminal': {
    tags: ['terminal', 'punto de venta', 'datáfono', 'pos', 'card reader'],
    d: [
      sq(5.25, 6.5, 13.5, 14.75, 2.5, SQ),
      roundline(
        [
          [9.25, 6.5],
          [9.25, 2.75],
          [14.75, 2.75],
          [14.75, 6.5],
        ],
        [0, 1.25, 1.25, 0],
      ),
      sq(8.25, 9.5, 7.5, 3.25, 1.25),
      ...[9, 12, 15].flatMap((x) => [dot(x, 15.5, 0.3), dot(x, 18.25, 0.3)]),
    ],
  },
  'calculator': {
    tags: ['calculadora', 'cálculo', 'cuentas', 'calculator', 'math'],
    d: [
      sq(4.75, 2.75, 14.5, 18.5, 3.5, SQ),
      sq(7.75, 5.75, 8.5, 3.5, 1.25),
      ...glyph('plus', [9.25, 13.25], 1.5),
      ...glyph('minus', [14.75, 13.25], 1.5),
      ...glyph('x', [9.25, 17.75], 1.5),
      line([13.25, 16.5], [16.25, 16.5]),
      line([13.25, 19], [16.25, 19]),
    ],
  },
  'barcode': {
    tags: ['código de barras', 'producto', 'sku', 'barcode', 'upc'],
    // Barras guía (orillas y centro) más largas, como en un código EAN/UPC
    d: [3.25, 6.25, 9.25, 12, 14.75, 17.75, 20.75].map((x, i) => line([x, 4.5], [x, i % 3 === 0 ? 19.5 : 16.5])),
  },
  'barcode-scan': {
    tags: ['escanear', 'código de barras', 'lector', 'scan', 'barcode scanner'],
    d: [
      roundline(
        [
          [2.75, 7.25],
          [2.75, 2.75],
          [7.25, 2.75],
        ],
        [0, 2.25, 0],
      ),
      roundline(
        [
          [16.75, 2.75],
          [21.25, 2.75],
          [21.25, 7.25],
        ],
        [0, 2.25, 0],
      ),
      roundline(
        [
          [21.25, 16.75],
          [21.25, 21.25],
          [16.75, 21.25],
        ],
        [0, 2.25, 0],
      ),
      roundline(
        [
          [7.25, 21.25],
          [2.75, 21.25],
          [2.75, 16.75],
        ],
        [0, 2.25, 0],
      ),
      ...[7.25, 10.25, 13.75, 16.75].map((x) => line([x, 7.75], [x, 16.25])),
    ],
  },
  'qr-code': {
    tags: ['código QR', 'escanear', 'pagar con QR', 'qr code', 'scan'],
    d: [
      sq(3.25, 3.25, 7.25, 7.25, 2.1),
      sq(13.5, 3.25, 7.25, 7.25, 2.1),
      sq(3.25, 13.5, 7.25, 7.25, 2.1),
      dot(6.875, 6.875),
      dot(17.125, 6.875),
      dot(6.875, 17.125),
      line([14, 14], [17, 14]),
      dot(20.25, 14),
      line([20.25, 17.25], [20.25, 20.25]),
      dot(14, 20.25),
      dot(17.15, 17.25),
    ],
  },
  'qr-scan': {
    tags: ['escanear QR', 'pagar con QR', 'lector', 'qr scan', 'scan to pay'],
    d: [
      roundline(
        [
          [2.75, 7.25],
          [2.75, 2.75],
          [7.25, 2.75],
        ],
        [0, 2.25, 0],
      ),
      roundline(
        [
          [16.75, 2.75],
          [21.25, 2.75],
          [21.25, 7.25],
        ],
        [0, 2.25, 0],
      ),
      roundline(
        [
          [21.25, 16.75],
          [21.25, 21.25],
          [16.75, 21.25],
        ],
        [0, 2.25, 0],
      ),
      roundline(
        [
          [7.25, 21.25],
          [2.75, 21.25],
          [2.75, 16.75],
        ],
        [0, 2.25, 0],
      ),
      sq(7, 7, 4, 4, 1.25),
      sq(13, 7, 4, 4, 1.25),
      sq(7, 13, 4, 4, 1.25),
      dot(15, 15),
    ],
  },

  // ── Regalo ──
  'gift': {
    tags: ['regalo', 'obsequio', 'sorpresa', 'gift', 'present'],
    d: [
      sq(3, 7.75, 18, 4.5, 1.75),
      roundline(
        [
          [4.5, 12.25],
          [4.5, 21],
          [19.5, 21],
          [19.5, 12.25],
        ],
        [0, 2.5, 0, 0],
      ),
      line([12, 7.75], [12, 21]),
      // El moño: los mismos lazos que la tarjeta de regalo
      leaf([12, 7.75], [8.25, 4.5], 2.75),
      leaf([15.75, 4.5], [12, 7.75], 2.75),
    ],
  },

  // ── Paquetes y envío ──
  'parcel': { tags: ['paquete', 'caja', 'envío', 'pedido', 'parcel', 'package'], d: parcel() },
  'parcel-open': {
    tags: ['paquete abierto', 'desempacar', 'recibido', 'unbox', 'open package'],
    d: (() => {
      const P = iso(12, 7.5, 8, 5);
      return [
        roundline([P.L, P.Lb, P.B, P.Rb, P.R], [0, 1.4, 1.4, 1.4, 0]),
        roundpoly([P.L, P.T, P.R, P.C], [1.1, 1.1, 1.1, 1.1]),
        line(P.C, toward(P.B, P.C, 0.4)),
        roundline([toward(P.L, P.T, 0.6), add(P.L, [-1.25, -4.5]), add(P.T, [-1.25, -4.5]), toward(P.T, P.L, 1.2)], [0, 1, 1, 0]),
        roundline([toward(P.R, P.T, 0.6), add(P.R, [1.25, -4.5]), add(P.T, [1.25, -4.5]), toward(P.T, P.R, 1.2)], [0, 1, 1, 0]),
      ];
    })(),
  },
  'parcel-check': { tags: ['entregado', 'paquete', 'pedido completo', 'delivered', 'package check'], d: [...parcel({ cx: 10.5, w: 8, h: 8.5, cut: true }), ...badge('check')] },
  'parcel-return': { tags: ['devolución', 'paquete', 'regresar envío', 'return', 'package return'], d: [...parcel({ cx: 10.5, w: 8, h: 8.5, cut: true }), ...badge('back')] },
  'delivery-time': {
    tags: ['tiempo de entrega', 'envío', 'en camino', 'delivery time', 'eta'],
    d: [...parcel({ cx: 10.5, w: 8, h: 8.5, cut: true }), circ(...BC, BR), line([17.75, 15.75], [17.75, 17.75], [19.25, 18.75])],
  },
  'truck': {
    tags: ['camión', 'envío', 'reparto', 'shipping', 'truck'],
    d: [
      sq(2.5, 4, 12, 10, 2.5, SQ),
      roundline(
        [
          [14.5, 7.5],
          [17.6, 7.5],
          [21.5, 11.25],
          [21.5, 14],
          [14.5, 14],
        ],
        [0, 1.25, 1.5, 0, 0],
      ),
      circ(7, 18.75, 1.75),
      circ(17.75, 18.75, 1.75),
    ],
  },
  'truck-fast': {
    tags: ['envío exprés', 'entrega rápida', 'mismo día', 'fast shipping', 'express'],
    d: [
      sq(8.5, 4, 7.5, 10, 2.25, SQ),
      roundline(
        [
          [16, 7.5],
          [18.3, 7.5],
          [21.5, 10.75],
          [21.5, 14],
          [16, 14],
        ],
        [0, 1.1, 1.4, 0, 0],
      ),
      circ(11.5, 18.75, 1.75),
      circ(18.5, 18.75, 1.75),
      line([2.5, 7.25], [5.5, 7.25]),
      line([3.75, 10.25], [5.5, 10.25]),
    ],
  },
  'home-delivery': {
    tags: ['entrega a domicilio', 'casa', 'a domicilio', 'home delivery', 'doorstep'],
    d: [
      roundline(
        [
          [2.75, 11],
          [12, 3.25],
          [21.25, 11],
        ],
        [0, 1.5, 0],
      ),
      roundline(
        [
          [5, 9.11],
          [5, 20.75],
          [19, 20.75],
          [19, 9.11],
        ],
        [0, 2.5, 0, 0],
      ),
      ...(() => {
        const P = iso(12, 10, 3.75, 3.75);
        return [roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 0.9), line(toward(P.L, P.C, 0.3), P.C, toward(P.R, P.C, 0.3)), line(P.C, toward(P.B, P.C, 0.3))];
      })(),
    ],
  },
  'pickup-point': {
    tags: ['punto de recogida', 'sucursal', 'recoger en tienda', 'pickup', 'collection point'],
    d: (() => {
      const tip = [12, 21.25];
      const [tR, tL] = [polar(12, 10, 7.5, 41.8), polar(12, 10, 7.5, 138.2)];
      const P = iso(12, 6, 4, 4.5);
      return [
        `${roundline([tL, tip, tR], [0, 1.25, 0])}A7.5 7.5 0 1 0 ${pt(tL)}Z`,
        roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 1),
        line(toward(P.L, P.C, 0.3), P.C, toward(P.R, P.C, 0.3)),
        line(P.C, toward(P.B, P.C, 0.3)),
      ];
    })(),
  },

  // ── Peso y medida ──
  'weighing-scale': {
    tags: ['báscula', 'peso', 'pesar', 'scale', 'weight'],
    d: [
      line([5.75, 4.25], [18.25, 4.25]),
      line([12, 4.25], [12, 7.75]),
      sq(3.75, 7.75, 16.5, 13.25, 3.5, SQ),
      circ(12, 14.25, 3.75),
      line([12, 14.25], polar(12, 14.25, 2.25, -55)),
    ],
  },
  'balance-scale': {
    tags: ['balanza', 'equilibrio', 'justo', 'balance', 'scales'],
    d: [
      line([12, 3.25], [12, 20.5]),
      line([5.75, 6.25], [18.25, 6.25]),
      line([8, 20.5], [16, 20.5]),
      line([3, 13.25], [5.75, 6.25], [8.5, 13.25]),
      'M8.5 13.25H3A2.75 2.75 0 0 0 8.5 13.25Z',
      line([15.5, 13.25], [18.25, 6.25], [21, 13.25]),
      'M21 13.25H15.5A2.75 2.75 0 0 0 21 13.25Z',
    ],
  },

  // ── Premium ──
  'gem': {
    tags: ['diamante', 'premium', 'gema', 'joya', 'gem', 'diamond'],
    d: [
      roundpoly(
        [
          [7.25, 4.25],
          [16.75, 4.25],
          [21, 9.5],
          [12, 20.5],
          [3, 9.5],
        ],
        [1.2, 1.2, 1.2, 1.4, 1.2],
      ),
      line([3.6, 9.5], [20.4, 9.5]),
      // Facetas: la corona arriba y el pabellón, que se detiene antes de la punta
      line([9.75, 4.25], [8.5, 9.5], [12, 16.75], [15.5, 9.5], [14.25, 4.25]),
    ],
  },
  'crown': {
    tags: ['corona', 'premium', 'vip', 'realeza', 'crown'],
    d: [
      roundpoly(
        [
          [4.75, 20],
          [3.5, 9.25],
          [8.5, 12.5],
          [12, 7.25],
          [15.5, 12.5],
          [20.5, 9.25],
          [19.25, 20],
        ],
        [1.5, 0.9, 1, 0.9, 1, 0.9, 1.5],
      ),
      line([4.4, 17], [19.6, 17]),
      dot(4, 6.25),
      dot(12, 3.9),
      dot(20, 6.25),
    ],
  },
  'medal': {
    tags: ['medalla', 'premio', 'recompensa', 'logro', 'award', 'badge'],
    d: [
      circ(12, 9, 6.25),
      star(12, 9, 3.4, 1.5),
      roundline([polar(12, 9, 6.25, 122), [7.5, 20.75], [9.9, 19.4]], [0, 0.6, 0]),
      roundline([polar(12, 9, 6.25, 58), [16.5, 20.75], [14.1, 19.4]], [0, 0.6, 0]),
    ],
  },

  // ── Subasta y sello ──
  'gavel': {
    tags: ['subasta', 'martillo', 'puja', 'auction', 'gavel', 'bid'],
    d: [
      rrect([14.5, 8], [1, 1], 4.75, 2.4, 1.1),
      line(add([14.5, 8], mul(unit([-1, 1]), 2.4)), add([14.5, 8], mul(unit([-1, 1]), 13))),
      sq(12.75, 17.5, 8.5, 3.25, 1.25),
    ],
  },
  'rubber-stamp': {
    tags: ['sello', 'aprobado', 'autorizar', 'stamp', 'approve'],
    d: [circ(12, 5.25, 2.5), line([10.6, 7.3], [10, 11.75]), line([13.4, 7.3], [14, 11.75]), sq(4.25, 11.75, 15.5, 4.75, 1.75), line([4.25, 20], [19.75, 20])],
  },

  // ── Inventario y almacén ──
  'inventory': {
    tags: ['inventario', 'estantes', 'existencias', 'stock', 'inventory', 'shelves'],
    d: [
      line([3.25, 2.75], [3.25, 21.25]),
      line([20.75, 2.75], [20.75, 21.25]),
      line([3.25, 11], [20.75, 11]),
      line([3.25, 19.75], [20.75, 19.75]),
      roundline(
        [
          [6.25, 11],
          [6.25, 5.25],
          [11.25, 5.25],
          [11.25, 11],
        ],
        [0, 1.25, 1.25, 0],
      ),
      roundline(
        [
          [14.25, 11],
          [14.25, 7.75],
          [17.75, 7.75],
          [17.75, 11],
        ],
        [0, 1.1, 1.1, 0],
      ),
      roundline(
        [
          [6.25, 19.75],
          [6.25, 15.25],
          [9.75, 15.25],
          [9.75, 19.75],
        ],
        [0, 1.1, 1.1, 0],
      ),
      roundline(
        [
          [12.75, 19.75],
          [12.75, 14],
          [17.75, 14],
          [17.75, 19.75],
        ],
        [0, 1.25, 1.25, 0],
      ),
    ],
  },
  'warehouse': {
    tags: ['almacén', 'bodega', 'centro de distribución', 'warehouse', 'fulfillment'],
    d: [
      roundline(
        [
          [2.5, 9.5],
          [12, 4],
          [21.5, 9.5],
        ],
        [0, 1.25, 0],
      ),
      roundline(
        [
          [4.5, 8.34],
          [4.5, 20.75],
          [19.5, 20.75],
          [19.5, 8.34],
        ],
        [0, 2.25, 0, 0],
      ),
      roundline(
        [
          [8.25, 20.75],
          [8.25, 12.25],
          [15.75, 12.25],
          [15.75, 20.75],
        ],
        [0, 1, 1, 0],
      ),
      line([8.25, 15.25], [15.75, 15.25]),
      line([8.25, 18.25], [15.75, 18.25]),
    ],
  },
  'pallet': {
    tags: ['tarima', 'carga', 'mayoreo', 'pallet', 'freight'],
    d: [
      roundline(
        [
          [4, 16.25],
          [4, 9.25],
          [10.5, 9.25],
          [10.5, 16.25],
        ],
        [0, 1.4, 1.4, 0],
      ),
      roundline(
        [
          [13.5, 16.25],
          [13.5, 5],
          [20, 5],
          [20, 16.25],
        ],
        [0, 1.4, 1.4, 0],
      ),
      line([2.75, 16.25], [21.25, 16.25]),
      line([2.75, 20.75], [21.25, 20.75]),
      line([5, 16.25], [5, 20.75]),
      line([12, 16.25], [12, 20.75]),
      line([19, 16.25], [19, 20.75]),
    ],
  },

  // ── Moda ──
  'hanger': {
    tags: ['gancho', 'ropa', 'moda', 'percha', 'hanger', 'apparel'],
    d: (() => {
      const a = arc(12, 6.25, 2.25, 90, -200);
      return [
        a.d,
        line([12, 8.5], [12, 10.25]),
        roundpoly(
          [
            [12, 10],
            [21.25, 17.75],
            [2.75, 17.75],
          ],
          [0.9, 1.6, 1.6],
        ),
      ];
    })(),
  },
  'shirt': {
    tags: ['camiseta', 'playera', 'ropa', 'moda', 'shirt', 't-shirt'],
    d: [
      `${roundline(
        [
          [15.25, 3.75],
          [21.25, 7.25],
          [19.25, 11.5],
          [17.5, 10.5],
          [17.5, 20.75],
          [6.5, 20.75],
          [6.5, 10.5],
          [4.75, 11.5],
          [2.75, 7.25],
          [8.75, 3.75],
        ],
        [0, 1.25, 0.9, 0.6, 1.5, 1.5, 0.6, 0.9, 1.25, 0],
      )}A4.5 4.5 0 0 0 15.25 3.75Z`,
    ],
  },
};

// Ya vienen encerrados en un círculo o en un marco: no se vuelven a encerrar
for (const name of ['currency-dollar', 'currency-euro', 'currency-pound', 'currency-yen', 'currency-bitcoin', 'percent-circle', 'reward-points', 'discount', 'refund', 'recurring-payment'])
  icons[name].variants = { circle: false };
for (const name of ['barcode-scan', 'qr-scan']) icons[name].variants = { square: false };

export default { category: 'comercio', label: 'Comercio y finanzas', icons };
