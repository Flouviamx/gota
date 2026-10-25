// Commerce and finance: shopping, payment, money, shipping and inventory. Everything is computed
// with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines,
// continuous corners and a square bottom-right corner on containers. The badges are the engine's
// (`badge`): the base is drawn whole and the engine clears it with 1.5 of clearance; a piece on top
// of another (the front coin, the front card, the wallet, the ATM's bill) works the same way.
import { arc, badge, circ, dot, drop, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snap, snapper, transform } from '../../engine/variants.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const mul = (v, k) => [v[0] * k, v[1] * k];
const unit = (v) => mul(v, 1 / len(v));
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** Moves `d` from a toward b. */
const toward = (a, b, d) => add(a, mul(unit(sub(b, a)), d));

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

/**
 * Closes every open subpath, for `fill.solid` (only closed shapes go there): the store body under
 * its awning, the gift box under its lid, the boxes on their shelf. The closing segment runs along
 * an edge that is already solid or knocked out, so the silhouette doesn't change.
 */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** The four corners of sq() in order [tr, br, bl, tl]: start point and relative path. */
function corners(x, y, w, h, r, opts) {
  return sq(x, y, w, h, r, opts)
    .match(/[ML][^MLZ]*/g)
    .map((t) => {
      const m = t.slice(1).match(/^(-?[\d.]+) (-?[\d.]+)(.*)$/);
      return { p: [+m[1], +m[2]], c: m[3] };
    });
}

/**
 * Open run of a sq(): from `A` (on edge `eA`) to `B` (on edge `eB`), clockwise. Edges: 0 top,
 * 1 right, 2 bottom, 3 left.
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

/** Standalone glyphs (plus, minus, check, x) for the inside of a container. */
function glyph(kind, [x, y], s = 1.75) {
  if (kind === 'plus') return [line([x - s, y], [x + s, y]), line([x, y - s], [x, y + s])];
  if (kind === 'minus') return [line([x - s, y], [x + s, y])];
  if (kind === 'check') return [line([x - s * 1.1, y + s * 0.05], [x - s * 0.3, y + s * 0.85], [x + s * 1.15, y - s * 0.7])];
  const k = s * 0.8;
  return [line([x - k, y - k], [x + k, y + k]), line([x + k, y - k], [x - k, y + k])];
}

/** Percent sign: two rings and the diagonal. */
const percent = (cx, cy, s, rr, L) => [circ(cx - s, cy - s, rr), circ(cx + s, cy + s, rr), line([cx - L, cy + L], [cx + L, cy - L])];

/** Compact percent: dots instead of rings (for small pieces). */
const percentDots = (cx, cy, s, L) => [dot(cx - s, cy - s), dot(cx + s, cy + s), line([cx - L, cy + L], [cx + L, cy - L])];

/** Arc from one point to another on a circle, with the flags computed. */
function arcTo(c, r, from, to, cw = true) {
  const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
  const a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
  let span = ((a1 - a0) * 180) / Math.PI;
  if (cw) span = (span + 360) % 360;
  else span = (-span + 360) % 360;
  return `A${N(r)} ${N(r)} 0 ${span > 180 ? 1 : 0} ${cw ? 1 : 0} ${pt(to)}`;
}

/** Heart with two lobes and a point; `w` = total width. */
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

/** Awning scallops: arcs hanging between x0 and x1 (right to left). */
function scallops(x0, x1, y, n, sag) {
  const c = (x1 - x0) / n;
  const R = ((c * c) / 4 + sag * sag) / (2 * sag);
  let s = '';
  for (let i = n - 1; i >= 0; i--) s += `A${N(R)} ${N(R)} 0 0 1 ${pt([x0 + c * i, y])}`;
  return s;
}

/**
 * Dollar sign: an S made of two ovals with the stem above and below. The stem and the body of the S
 * are a single stroke (from the top tip to the bottom one, through the center); the two tails of
 * the S branch off it. That way no tip is a loose fragment. `top` = the upper stem, if it differs.
 */
function dollar(cx, cy, h, w = h * 0.68, stub = 1.5, top = stub) {
  const ry = h / 4;
  const rx = w / 2;
  const at = (c, deg) => [c[0] + rx * Math.cos((deg * Math.PI) / 180), c[1] + ry * Math.sin((deg * Math.PI) / 180)];
  const up = [cx, cy - ry];
  const lo = [cx, cy + ry];
  const T0 = [cx, cy - h / 2];
  const B0 = [cx, cy + h / 2];
  const R = `${N(rx)} ${N(ry)}`;
  // The tail reaches -28° (152° at the bottom); in a small sign it stretches to a length of 2.1
  let tail = -28;
  const arcLen = (t) => {
    let L = 0;
    for (let a = -90; a < t; a += 1) L += len(sub(at(up, a + 1), at(up, a)));
    return L;
  };
  while (arcLen(tail) < 2.1 && tail < -5) tail += 1;
  return [
    `M${pt([cx, T0[1] - top])}L${pt(T0)}A${R} 0 0 0 ${pt([cx, cy])}A${R} 0 0 1 ${pt(B0)}L${pt([cx, B0[1] + stub])}`,
    `M${pt(T0)}A${R} 0 0 1 ${pt(at(up, tail))}`,
    `M${pt(B0)}A${R} 0 0 1 ${pt(at(lo, tail + 180))}`,
  ];
}

/** Euro: the C open to the right and its two bars, which cross it on the left. */
function euro(cx, cy, r, bar = 1.5) {
  const x0 = cx - r - 1.5;
  const x1 = cx + r * 0.05;
  return [arc(cx, cy, r, 45, 315).d, line([x0, cy - bar], [x1, cy - bar]), line([x0, cy + bar], [x1, cy + bar])];
}

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────

// Cart: the basket (a container: vertical right side and a square bottom-right corner, the
// signature), the handle that follows the slope of the front, and two wheels. The basket and the
// handle are two strokes that touch: in the fill the handle stays a line. It leaves room for a
// glyph at CART_IN.
const CART_IN = [13.25, 10.125];
const CART_HANDLE = [
  [2.75, 3.25],
  [4.4, 3.25],
  [4.97, 5.75],
];
const cart = () => [
  roundpoly(
    [
      [4.97, 5.75],
      [6.95, 14.5],
      [20.25, 14.5],
      [20.25, 5.75],
    ],
    [0, 1.5, 0, 1.5],
  ),
  roundline(CART_HANDLE, [0, 1, 0]),
  circ(8.75, 19.25, 1.5),
  circ(17.75, 19.25, 1.5),
];
/**
 * Cart fill: the basket, the wheels and whatever it carries (closed against the basket's edge),
 * solid; the handle stays a line, attached to the basket.
 */
const cartFill = (d, cut = [], extra = []) => ({ solid: [d[0], d[2], d[3], ...extra.map(shut)], wire: [d[1]], ...(cut.length && { cut }) });

// Shopping bag: body with the signature corner and an arched handle.
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

// Core document (14.5 × 18.5, radius 3.75).
const DOC = [4.75, 2.75, 14.5, 18.5, 3.75];
// Core card (19 × 14, radius 3.75).
const CARD = [2.5, 5, 19, 14, 3.75];
// The signature: a container with a square bottom-right corner.
const SQ = { square: ['br'] };

// Receipt: continuous corners at the top and a sawtooth tear at the bottom.
function receipt(x = 4.75, y = 2.75, w = 14.5, h = 18.5, teeth = 5, depth = 1.5, r = 3.5) {
  const k = corners(x, y, w, h, r);
  const tl = k[3];
  const tr = k[0];
  const z = [];
  const step = w / teeth;
  for (let i = 1; i < teeth * 2; i++) z.push([x + w - (step / 2) * i, i % 2 ? y + h - depth : y + h]);
  return `M${pt([x, y + h])}L${pt(tl.p)}${tl.c}L${pt(tr.p)}${tr.c}L${pt([x + w, y + h])}${z.map((p) => `L${pt(p)}`).join('')}Z`;
}

// Price tag: a pentagon with its point at the top left and its eyelet (r 1, 3 from the edges of the
// point).
function tag({ L = 17.5, H = 5.75, nose = 5.5, c = [12, 12], ang = 45 } = {}) {
  const local = [
    [0, 0],
    [nose, -H],
    [L, -H],
    [L, H],
    [nose, H],
  ];
  const m = [L * 0.52, 0];
  const toWorld = (p) => add(rot(sub(p, m), [0, 0], ang), c);
  return { body: roundpoly(local.map(toWorld), [1.6, 1.4, 2.4, 2.4, 1.4]), hole: toWorld([5.5, 0]), toWorld };
}
const T = tag();

// Core isometric box (`box`): same proportions, 28.4° slope.
function iso(cx, top, w, h, k = 0.541) {
  const wk = w * k;
  return { T: [cx, top], R: [cx + w, top + wk], C: [cx, top + 2 * wk], L: [cx - w, top + wk], Rb: [cx + w, top + wk + h], B: [cx, top + 2 * wk + h], Lb: [cx - w, top + wk + h] };
}

/**
 * Package: the core box with the tape over the lid, folding down the left face and covering the
 * edge it crosses. In the core box (17.2 wide) the lid measures 8.2 between edges, and the tape was
 * left with 1 of clearance between its sides and 1.34 from the edges; with the tape, the box is 19
 * wide (the landscape format) and its faces 7.5 tall (the same area as the core box, and ink under
 * 28 %). That way everything keeps 1.5: the tape's sides 3 apart and 3 from the lid's edges (center
 * to center, perpendicular), the legs of the fold 3.17 from the side and from the front edge, and
 * its end 3.08 from the edge it crosses.
 */
function parcel({ cx = 12, top = 3.1, w = 9.5, h = 7.5, tape = true } = {}) {
  const P = iso(cx, top, w, h);
  const u = unit(sub(P.R, P.T));
  const [a, b] = [mid(P.T, P.R), mid(P.L, P.C)];
  const body = roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 1.6);
  const front = line(P.C, toward(P.B, P.C, 0.4));
  if (!tape) return [body, line(toward(P.L, P.C, 0.4), P.C, toward(P.R, P.C, 0.4)), front];
  // 1.8 along the edge = 1.5 perpendicular (the lid's edges cross at 56.8°)
  const [Pm, Pp, Qm, Qp] = [add(a, mul(u, -1.8)), add(a, mul(u, 1.8)), add(b, mul(u, -1.8)), add(b, mul(u, 1.8))];
  return [body, line(toward(P.L, P.C, 0.4), Qm), line(Qp, P.C, toward(P.R, P.C, 0.4)), front, line(Pm, Qm, add(Qm, [0, 3.5]), add(Qp, [0, 3.5]), Qp, Pp)];
}
// The small package, shifted left, that carries a badge (no tape: it doesn't fit with its
// clearance)
const PARCEL_B = { cx: 10.5, w: 8, h: 8.5, tape: false };

/** Small isometric box (inside the house or the pin): outline and inner edges. */
function cube(cx, top, w, h, r) {
  const P = iso(cx, top, w, h);
  return [roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], r), line(toward(P.L, P.C, 0.3), P.C, toward(P.R, P.C, 0.3)), line(P.C, toward(P.B, P.C, 0.3))];
}

/** Five-pointed star with softened points. */
const star = (cx, cy, ro, ri, r = 0.55) =>
  roundpoly(
    Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? ri : ro, -90 + i * 36)),
    Array.from({ length: 10 }, (_, i) => (i % 2 ? r * 0.6 : r)),
  );

/** Leaf: two equal arcs between p0 and p1. */
const leaf = (p0, p1, R) => `M${pt(p0)}A${N(R)} ${N(R)} 0 0 1 ${pt(p1)}A${N(R)} ${N(R)} 0 0 1 ${pt(p0)}Z`;

/** Handwritten signature: one continuous stroke of curves, scaled from (x, y). */
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

/** Rotated rectangle with rounded corners (for pieces that aren't containers). */
function rrect(c, a, hw, hh, r) {
  const u = unit(a);
  const n = [-u[1], u[0]];
  const P = (i, j) => add(c, add(mul(u, i * hw), mul(n, j * hh)));
  return roundpoly([P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], r);
}

// House (mortgage, home delivery): a gable roof with eaves, and walls with a rounded bottom-left
// corner and a square bottom-right one (the signature). The walls start at the roof.
const ROOF = roundline(
  [
    [2.75, 11],
    [12, 3.25],
    [21.25, 11],
  ],
  [0, 1.5, 0],
);
const WALLS = roundline(
  [
    [5, 9.11],
    [5, 20.75],
    [19, 20.75],
    [19, 9.11],
  ],
  [0, 2.5, 0, 0],
);
// The house body for the fill: the eave stays a line
const HOUSE = roundpoly(
  [
    [5, 9.11],
    [12, 3.25],
    [19, 9.11],
    [19, 20.75],
    [5, 20.75],
  ],
  [0, 1.5, 0, 0, 2.5],
);

/** Custom badge: the piece on top, its cleared area and its fill. */
const own = (d, knock, fill) => ({ d, knock, fill });
// Return: the left arrow in the circle of the engine's badges
const BC = [17.25, 17.25];
const backBadge = () => {
  const ring = circ(BC[0], BC[1], 4.25);
  const marks = [`M${N(BC[0] + 2.1)} ${N(BC[1])}H${N(BC[0] - 2)}`, line([BC[0] - 0.25, BC[1] - 1.75], [BC[0] - 2, BC[1]], [BC[0] - 0.25, BC[1] + 1.75])];
  return own([ring, ...marks], ring, { solid: [ring], cut: marks });
};

const icons = {
  // ── Cart ──
  'cart': { tags: ['carrito', 'carrito vacío', 'compra', 'cart', 'shopping cart', 'empty cart'], d: cart() },
  'cart-full': {
    tags: ['carrito lleno', 'productos', 'compra', 'cart full', 'shopping', 'items'],
    d: [
      ...cart(),
      roundline(
        [
          [8, 5.75],
          [8, 2.25],
          [11.5, 2.25],
          [11.5, 5.75],
        ],
        [0, 1.25, 1.25, 0],
      ),
      'M14.5 5.75a2.1 2.1 0 0 1 4.2 0',
    ],
  },
  'cart-plus': { tags: ['agregar al carrito', 'añadir', 'comprar', 'add to cart', 'cart plus'], d: [...cart(), ...glyph('plus', CART_IN, 1.5)] },
  'cart-minus': { tags: ['quitar del carrito', 'restar', 'menos', 'remove from cart', 'cart minus'], d: [...cart(), ...glyph('minus', CART_IN, 1.6)] },
  'cart-check': { tags: ['carrito listo', 'pedido confirmado', 'compra', 'cart checked', 'checkout'], d: [...cart(), ...glyph('check', CART_IN, 1.6)] },
  'cart-remove': { tags: ['vaciar carrito', 'eliminar', 'cancelar compra', 'cart remove', 'clear cart'], d: [...cart(), ...glyph('x', CART_IN, 1.6)] },
  'cart-arrow-down': {
    tags: ['agregar al carrito', 'meter al carrito', 'comprar', 'add to cart', 'cart download'],
    // The arrow fits between the edge and the bottom of the basket with 1.5 of clearance
    d: [...cart(), line([CART_IN[0], 8.65], [CART_IN[0], 11.65]), head([CART_IN[0], 11.65], [0, 1], 2.25)],
  },

  // ── Bag and basket ──
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
      // The rods follow the slope of the sides and sit 3 apart
      line([8.6, 13.5], [9, 17.5]),
      line([12, 13.5], [12, 17.5]),
      line([15.4, 13.5], [15, 17.5]),
    ],
  },

  // ── Store ──
  // The walls hang 3 from the awning's scallops (1.5 of clearance)
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
      )}${scallops(3.25, 20.75, 8.25, 4, 1.5)}Z`,
      roundline(
        [
          [4.75, 12.75],
          [4.75, 20.75],
          [19.25, 20.75],
          [19.25, 12.75],
        ],
        [0, 2.25, 0, 0],
      ),
      roundline(
        [
          [9.75, 20.75],
          [9.75, 15.75],
          [14.25, 15.75],
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
      )}${scallops(3.25, 20.75, 8.25, 4, 1.5)}Z`,
      line([4.75, 12.75], [4.75, 20.75]),
      line([19.25, 12.75], [19.25, 20.75]),
      line([2.75, 16], [21.25, 16]),
    ],
  },

  // ── Receipt, invoice and quote ──
  'receipt': {
    tags: ['recibo', 'ticket de compra', 'comprobante', 'receipt', 'order'],
    d: [receipt(), line([8.5, 7.75], [15.5, 7.75]), line([8.5, 11.25], [15.5, 11.25]), line([8.5, 14.75], [12.25, 14.75])],
  },
  // The % rings at r 1.35, as in `percent-circle`, and 3 from the diagonal: at r 1.05 a ring lost
  // its hole at 2.1
  'receipt-tax': { tags: ['impuestos', 'IVA', 'retención', 'tax', 'vat', 'tax receipt'], d: [receipt(), ...percent(12, 11.25, 3, 1.35, 3.25)] },
  // The invoice: the document with the peso sign in the middle
  'invoice': { tags: ['factura', 'cobro', 'cuenta', 'invoice', 'bill'], d: [sq(...DOC, SQ), ...dollar(12, 12, 8, 5.25, 1.5)] },
  // With a badge: the full document (the engine clears it) and a smaller sign at the top left,
  // outside the badge area
  'invoice-plus': { tags: ['nueva factura', 'facturar', 'emitir', 'new invoice', 'create bill'], d: [sq(...DOC, SQ), ...dollar(9.5, 9.9, 6.5, 4.25, 1)], badge: badge('plus') },
  'invoice-paid': { tags: ['factura pagada', 'pagado', 'liquidada', 'invoice paid', 'settled'], d: [sq(...DOC, SQ), ...dollar(9.5, 9.9, 6.5, 4.25, 1)], badge: badge('check') },
  'invoice-due': { tags: ['factura vencida', 'por pagar', 'pendiente', 'invoice due', 'overdue'], d: [sq(...DOC, SQ), ...dollar(9.5, 9.9, 6.5, 4.25, 1)], badge: badge('clock') },
  'price-quote': {
    tags: ['cotización', 'presupuesto', 'pedir precio', 'quote', 'estimate', 'price request'],
    d: [drop(12, 11.75, 8.75), ...dollar(12, 11.75, 7.5, 5, 1.5)],
  },
  'purchase-order': {
    tags: ['orden de compra', 'pedido', 'lista', 'purchase order', 'po'],
    // The board opens at the top and its edges end at the sides of the clip; lines 4 apart
    d: [
      sqOpen(4.75, 4.25, 14.5, 17, 3, SQ, [14.25, 4.25], 0, [9.75, 4.25], 0),
      sq(9.75, 2.75, 4.5, 3.25, 1.25),
      dot(8.5, 9.5, 0.55),
      line([12.25, 9.5], [15.75, 9.5]),
      dot(8.5, 13.5, 0.55),
      line([12.25, 13.5], [15.75, 13.5]),
      dot(8.5, 17.5, 0.55),
      line([12.25, 17.5], [14.25, 17.5]),
    ],
  },
  'contract-signed': {
    tags: ['contrato', 'firma', 'acuerdo', 'contract', 'signed', 'agreement'],
    d: [sq(...DOC, SQ), line([8.75, 7.5], [15.25, 7.5]), line([8.75, 11], [15.25, 11]), signature(8.5, 17.25, 0.9)],
  },
  // The handshake: a shirt cuff on each side; the left hand comes up from behind and the right one
  // goes on top (custom badge), with the fingers coming down in three knuckles. The engine clears
  // it.
  'deal': (() => {
    const front = 'M18.25 10.25H14.9L9.65 12.75a1.25 1.25 0 0 0 .75 2.35H10.9a1.25 1.25 0 0 0 1.25 1.4h1a1.25 1.25 0 0 0 1.25 1.1h.75L18.25 15.5';
    const cuff = sq(18.25, 9, 3, 7.5, 0.9);
    return {
      tags: ['trato', 'apretón de compra', 'cerrar venta', 'acuerdo comercial', 'deal', 'handshake'],
      d: ['M5.75 10.5L9.25 8.1C10 7.6 10.6 7.5 11.5 7.5H13.5a1.5 1.5 0 0 1 1.5 1.5V13.5H5.75Z', sq(2.75, 9, 3, 7.5, 0.9)],
      // Filled, the hand closes along the edge of the cuff (its closing segment runs along it)
      badge: own([front, cuff], `${front}Z${cuff}`, { solid: [`${front}Z`, cuff] }),
    };
  })(),

  // ── Price and discount ──
  'price-tag': { tags: ['etiqueta', 'precio', 'producto', 'price tag', 'label'], d: [T.body, circ(...T.hole, 1)] },
  'price-tags': {
    tags: ['etiquetas', 'precios', 'catálogo', 'price tags', 'labels'],
    d: (() => {
      const t = tag({ L: 15, H: 5, nose: 5, c: [11.5, 9.75] });
      const e = [t.toWorld([8, 8]), t.toWorld([18, 8]), t.toWorld([18, -0.5])];
      return [t.body, circ(...t.hole, 1), roundline(e, [0, 2.4, 0])];
    })(),
  },
  // The eyelet is the first ring of the %: the second ring and the diagonal complete the sign with
  // 1.5 of clearance
  'price-tag-percent': {
    tags: ['oferta', 'descuento', 'rebaja', 'sale tag', 'discount'],
    d: (() => {
      const c = T.toWorld([9.5, 0]);
      return [T.body, circ(...T.hole, 1), circ(...T.toWorld([13.5, 0]), 1), line([c[0] - 2, c[1] + 2], [c[0] + 2, c[1] - 2])];
    })(),
  },
  'price-tag-dollar': {
    tags: ['precio', 'etiqueta', 'costo', 'price', 'cost'],
    d: [T.body, circ(...T.hole, 1), ...dollar(...T.toWorld([12, 0]), 5.5, 3.75, 1)],
  },
  'percent': { tags: ['porcentaje', 'descuento', 'tasa', 'percent', 'percentage'], d: percent(12, 12, 4.75, 2.6, 6.75) },
  'percent-circle': { tags: ['porcentaje', 'tasa', 'impuesto', 'rate', 'percent'], d: [circ(12, 12, 9), ...percent(12, 12, 3.05, 1.4, 4.25)] },
  'discount': {
    tags: ['descuento', 'oferta', 'sello', 'promoción', 'discount', 'sale badge'],
    d: [
      roundpoly(
        Array.from({ length: 24 }, (_, i) => polar(12, 12, i % 2 ? 7.85 : 9.15, i * 15 - 90)),
        Array.from({ length: 24 }, (_, i) => (i % 2 ? 1.1 : 0.9)),
      ),
      ...percent(12, 12, 2.75, 1, 3.25),
    ],
  },
  'coupon': {
    tags: ['cupón', 'vale', 'código de descuento', 'coupon', 'voucher'],
    d: (() => {
      const [x, y, w, h, r] = [2.5, 5.25, 19, 13.5, 3];
      const k = corners(x, y, w, h, r);
      // The notches start where the corners end (2.5 + 1.6 × 3 = 7.3): at 6.75 the outline ran back
      // over the corner, a sliver that broke the outline at light weights
      const n = 9.25;
      const nr = 1.75;
      return [
        `M${pt(k[0].p)}${k[0].c}L${pt(k[1].p)}${k[1].c}L${pt([n + nr, y + h])}A${nr} ${nr} 0 0 0 ${pt([n - nr, y + h])}L${pt(k[2].p)}${k[2].c}L${pt(k[3].p)}${k[3].c}L${pt([n - nr, y])}A${nr} ${nr} 0 0 0 ${pt([n + nr, y])}Z`,
        ...percentDots(15.25, 12, 2.75, 3),
      ];
    })(),
  },

  // ── Wallet and cards ──
  'wallet': {
    tags: ['cartera', 'billetera', 'monedero', 'wallet', 'purse'],
    d: [sq(2.75, 5.5, 18.5, 14, 3.5, SQ), 'M21.25 9H16.75a3.5 3.5 0 0 0 0 7H21.25', dot(16.75, 12.5, 0.55)],
  },
  // The card peeks out, tilted, behind the wallet; the wallet goes on top and the engine clears it
  'wallet-cards': (() => {
    const c = [10.75, 7.5];
    const P = (x, y) => rot(add(c, [x, y]), c, -9);
    const card = roundpoly([P(-6.5, -4.25), P(6.5, -4.25), P(6.5, 4.25), P(-6.5, 4.25)], 1.75);
    const body = sq(2.75, 9.5, 18.5, 11.75, 3.25, SQ);
    const flap = 'M21.25 12.5H17.5a2.75 2.75 0 0 0 0 5.5H21.25';
    return {
      tags: ['cartera', 'tarjetas', 'métodos de pago', 'wallet', 'cards', 'payment methods'],
      d: [card],
      badge: own([body, flap], body, { solid: [body], cut: [flap] }),
    };
  })(),
  'card-chip': {
    tags: ['tarjeta', 'chip', 'tarjeta de crédito', 'card chip', 'credit card'],
    d: [sq(...CARD, SQ), sq(5.75, 8, 6, 5, 1.6), line([5.75, 10.5], [11.75, 10.5]), line([6.25, 16], [13.75, 16])],
  },
  'card-contactless': {
    tags: ['sin contacto', 'tarjeta', 'pago con acercamiento', 'contactless card', 'tap to pay'],
    d: [sq(...CARD, SQ), sq(5.75, 9.5, 6, 5, 1.6), line([5.75, 12], [11.75, 12]), arc(12.25, 12, 3.25, -38, 38).d, arc(12.25, 12, 6.25, -38, 38).d],
  },
  // The full core card; the engine clears the corner for the badge
  'card-plus': { tags: ['agregar tarjeta', 'nuevo método de pago', 'add card', 'new card'], d: [sq(...CARD, SQ), line([2.5, 9.6], [21.5, 9.6]), line([6.25, 15], [9.75, 15])], badge: badge('plus') },
  'card-check': { tags: ['pago aprobado', 'tarjeta', 'cobro exitoso', 'payment approved', 'card verified'], d: [sq(...CARD, SQ), line([2.5, 9.6], [21.5, 9.6]), line([6.25, 15], [9.75, 15])], badge: badge('check') },
  'card-declined': { tags: ['pago rechazado', 'tarjeta', 'declinada', 'payment declined', 'card error'], d: [sq(...CARD, SQ), line([2.5, 9.6], [21.5, 9.6]), line([6.25, 15], [9.75, 15])], badge: badge('x') },
  // Two cascading cards: the back one is complete; the front one goes on top and the engine clears
  // it. Shifted 3 to the right and 7 up: with less, the cut fell halfway through the back card's
  // corner (flattening it and leaving a curved bit peeking out); this way its corner shows whole
  // and the cut falls on the straight run of its sides.
  'cards': (() => {
    const front = sq(2.5, 10.25, 16, 10.5, 3.25, SQ);
    const stripe = line([2.5, 13.75], [18.5, 13.75]);
    return {
      tags: ['tarjetas', 'métodos de pago', 'cartera', 'cards', 'payment methods'],
      d: [sq(5.5, 3.25, 16, 10.5, 3.25, SQ)],
      badge: own([front, stripe], front, { solid: [front], cut: [stripe] }),
    };
  })(),
  'loyalty-card': {
    tags: ['tarjeta de lealtad', 'puntos', 'cliente frecuente', 'loyalty', 'membership'],
    d: [sq(...CARD, SQ), star(12, 12.3, 4.6, 2, 0.7)],
  },
  'gift-card': {
    tags: ['tarjeta de regalo', 'regalo', 'vale', 'gift card', 'voucher'],
    d: (() => {
      // Vertical ribbon and bow: two loops and two tails coming out of the knot
      const k = [9, 11.5];
      return [sq(...CARD, SQ), line([k[0], 5], [k[0], 19]), leaf(k, add(k, [-3.4, -3.2]), 2.5), leaf(add(k, [3.4, -3.2]), k, 2.5), line(k, add(k, [-2.5, 3])), line(k, add(k, [2.5, 3]))];
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

  // ── Bills and coins ──
  'banknote': {
    tags: ['billete', 'efectivo', 'dinero', 'cash', 'bill'],
    d: [sq(2.5, 5.5, 19, 13, 3.25, SQ), circ(12, 12, 2.1), dot(6.2, 12), dot(17.8, 12)],
  },
  'banknotes': {
    tags: ['billetes', 'efectivo', 'dinero', 'money', 'cash'],
    d: [sq(2.5, 4, 19, 12.5, 3.25, SQ), circ(12, 10.25, 2.1), dot(6.2, 10.25), dot(17.8, 10.25), line([4.75, 19.5], [19.25, 19.5])],
  },
  // The bag: a circle with a tied mouth; the sign, centered between the mouth and the bottom
  'money-bag': (() => {
    const c = [12, 14.25];
    const r = 7;
    const yo = c[1] - Math.sqrt(r * r - 2.4 * 2.4);
    return {
      tags: ['bolsa de dinero', 'ahorro', 'fondos', 'money bag', 'funds'],
      d: [
        `M${pt([9.6, yo])}H14.4${arcTo(c, r, [14.4, yo], [9.6, yo])}Z`,
        roundline(
          [
            [9.6, yo],
            [7.75, 3.25],
            [16.25, 3.25],
            [14.4, yo],
          ],
          [0, 0.9, 0.9, 0],
        ),
        ...dollar(12, (yo + c[1] + r) / 2, 5.75, 4, 1),
      ],
    };
  })(),
  // The back coin is complete; the front one, with the sign, goes on top
  'coins': (() => {
    const front = circ(9.5, 14.5, 6.75);
    const sign = dollar(9.5, 14.5, 5.5, 3.75, 1.1);
    return {
      tags: ['monedas', 'cambio', 'dinero', 'coins', 'change'],
      d: [circ(16, 8, 5.75)],
      badge: own([front, ...sign], front, { solid: [front], cut: sign }),
    };
  })(),
  'gold-bars': {
    tags: ['lingotes', 'oro', 'reserva', 'gold', 'bullion'],
    d: [
      roundpoly(
        [
          [7.75, 13.25],
          [9.5, 6.75],
          [14.5, 6.75],
          [16.25, 13.25],
        ],
        1,
      ),
      roundpoly(
        [
          [2.75, 19.75],
          [4.25, 13.25],
          [9.25, 13.25],
          [10.75, 19.75],
        ],
        1,
      ),
      roundpoly(
        [
          [13.25, 19.75],
          [14.75, 13.25],
          [19.75, 13.25],
          [21.25, 19.75],
        ],
        1,
      ),
    ],
  },

  // ── Currency signs ──
  'dollar': { tags: ['dólar', 'peso', 'signo de pesos', 'dinero', 'dollar sign', 'money'], d: dollar(12, 12, 14, 9.25, 2.25) },
  'currency-dollar': { tags: ['dólar', 'peso', 'moneda', 'usd', 'mxn', 'dollar'], d: [circ(12, 12, 9), ...dollar(12, 12, 9, 6, 1.5)] },
  'currency-euro': { tags: ['euro', 'moneda', 'eur', 'divisa', 'currency'], d: [circ(12, 12, 9), arc(13.25, 12, 4.75, 45, 315).d, line([7, 10.5], [12, 10.5]), line([7, 13.5], [12, 13.5])] },
  'currency-pound': {
    tags: ['libra', 'libra esterlina', 'moneda', 'gbp', 'pound'],
    d: [circ(12, 12, 9), 'M15 8.75A2.85 2.85 0 0 0 9.85 9.6V14.25C9.85 15.35 9.35 16.2 8.5 16.75H15.75', line([8.25, 12.25], [13, 12.25])],
  },
  // ¥: the V 3 from the coin and from the first bar
  'currency-yen': {
    tags: ['yen', 'yuan', 'moneda', 'jpy', 'currency'],
    d: [circ(12, 12, 9), line([9.25, 7], [12, 10.25], [14.75, 7]), line([12, 10.25], [12, 18]), line([8.75, 13.25], [15.25, 13.25]), line([8.75, 16.25], [15.25, 16.25])],
  },
  // ₿: the B sits lower so its four stems measure 2 (the 1.75 ones were fragments) and stay 3 from
  // each other and from the coin
  'currency-bitcoin': {
    tags: ['bitcoin', 'cripto', 'criptomoneda', 'btc', 'crypto'],
    d: [
      circ(12, 12, 9),
      'M9 8.25H13.4A1.88 1.88 0 0 1 13.4 12H9ZM9 12H13.9A1.88 1.88 0 0 1 13.9 15.75H9V12',
      line([10.5, 6.25], [10.5, 8.25]),
      line([13.5, 6.25], [13.5, 8.25]),
      line([10.5, 15.75], [10.5, 17.75]),
      line([13.5, 15.75], [13.5, 17.75]),
    ],
  },
  // $ at the top left, € at the bottom right, and the two arrows that exchange them
  'currency-exchange': {
    tags: ['tipo de cambio', 'divisas', 'cambiar moneda', 'exchange', 'forex'],
    d: [
      ...dollar(7.25, 7.25, 6.5, 4.5, 1.25),
      ...euro(17.5, 16.75, 3.5),
      'M12.75 5H16a3 3 0 0 1 3 3V9.75',
      head([19, 9.75], [0, 1], 2.75),
      'M9.5 19H8a3 3 0 0 1-3-3V14.5',
      head([5, 14.5], [0, -1], 2.75),
    ],
  },

  // ── Bank, savings and investment ──
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
        dot(14.25, 13.5, 0.55),
        circ(10, 4.5, 1.6),
        line([7.25, legY], [7.25, 20.75]),
        line([14.75, legY], [14.75, 20.75]),
      ];
    })(),
  },
  // The safe: the three-spoke wheel (with four it read as an X) and the handle at 3.5
  'safe-box': {
    tags: ['caja fuerte', 'bóveda', 'resguardo', 'safe', 'vault'],
    d: [
      sq(3.25, 3.25, 17.5, 15.5, 3.5, SQ),
      circ(10.25, 11, 1.75),
      ...[-90, 30, 150].map((a) => line(polar(10.25, 11, 1.75, a), polar(10.25, 11, 4, a))),
      line([17.25, 9], [17.25, 13]),
      line([6.75, 18.75], [6.75, 20.75]),
      line([17.25, 18.75], [17.25, 20.75]),
    ],
  },
  // The ATM: the slot and the bill coming out of it, on top of the front (the engine clears it)
  'atm': (() => {
    const billFrom = (top) =>
      roundline(
        [
          [7.25, top],
          [7.25, 21.25],
          [16.75, 21.25],
          [16.75, top],
        ],
        [0, 2, 0, 0],
      );
    const bill = billFrom(6.25);
    const sign = dollar(12, 13.75, 6.75, 4.5, 1.25);
    // The clearance beside the bill starts 0.35 below the slot even at 0.9, where the slot is
    // widest: from 9.25 it met the slot at light weights and opened it to the outside
    const knock = roundpoly(
      [
        [7.25, 9.75],
        [16.75, 9.75],
        [16.75, 21.25],
        [7.25, 21.25],
      ],
      [0, 0, 0, 2],
    );
    return {
      tags: ['cajero automático', 'retiro', 'efectivo', 'atm', 'cash machine'],
      d: [sq(2.75, 2.75, 18.5, 7.5, 2.5, SQ), line([5.75, 6.25], [18.25, 6.25])],
      // Filled, the bill goes up through the slot and joins the front at every weight (closed along
      // the slot, it came loose at light weights, where the slot is wider than the stroke)
      badge: own([bill, ...sign], knock, { solid: [`${billFrom(5.5)}Z`], cut: sign }),
    };
  })(),
  'cheque': {
    tags: ['cheque', 'pago', 'documento bancario', 'check', 'bank check'],
    d: [sq(2.5, 5.5, 19, 13, 3.25, SQ), line([6, 9.5], [12.5, 9.5]), line([6, 12.75], [9.25, 12.75]), signature(11.5, 14.75, 0.8)],
  },
  'mortgage': { tags: ['hipoteca', 'crédito', 'casa', 'vivienda', 'mortgage', 'home loan'], d: [ROOF, WALLS, ...dollar(12, 12.75, 7, 4.75, 1.5)] },
  // Investment: the sign's upper stem is the stalk that sprouts two leaves
  'investment': {
    tags: ['inversión', 'crecimiento', 'rendimiento', 'invest', 'growth'],
    d: [...dollar(12, 16.5, 7, 4.75, 1.5, 4.75), leaf([12, 8.25], [17.25, 4.25], 4), leaf([6.75, 4.25], [12, 8.25], 4)],
  },
  'revenue-up': {
    tags: ['ingresos', 'crecimiento', 'ganancia', 'ventas al alza', 'revenue', 'profit'],
    d: [...dollar(7.5, 12, 11.5, 7, 1.75), line([17.5, 20], [17.5, 4.25]), head([17.5, 4.25], [0, -1], 4.25)],
  },
  'revenue-down': {
    tags: ['pérdida', 'caída', 'ventas a la baja', 'gastos', 'loss', 'decline'],
    d: [...dollar(7.5, 12, 11.5, 7, 1.75), line([17.5, 4], [17.5, 19.75]), head([17.5, 19.75], [0, 1], 4.25)],
  },
  'stocks': {
    tags: ['bolsa de valores', 'acciones', 'velas', 'mercado', 'stocks', 'trading'],
    d: [
      [5.25, 6.75, 9.25, 15.25, 18.5],
      [12, 3.25, 5.75, 12.25, 15.5],
      [18.75, 8.5, 11, 17.75, 20.75],
    ].flatMap(([x, t, b0, b1, bt]) => [sq(x - 1.75, b0, 3.5, b1 - b0, 1.1), line([x, t], [x, b0]), line([x, b1], [x, bt])]),
  },

  // ── Payments ──
  'recurring-payment': {
    tags: ['pago recurrente', 'suscripción', 'cobro automático', 'subscription', 'recurring'],
    d: (() => {
      const a = arc(12, 12, 8.5, 205, 330);
      const b = arc(12, 12, 8.5, 25, 150);
      return [a.d, head(a.end, a.tangent, 3.4), b.d, head(b.end, b.tangent, 3.4), ...dollar(12, 12, 7, 4.5, 1.25)];
    })(),
  },
  'refund': {
    tags: ['reembolso', 'devolución de dinero', 'regresar pago', 'refund', 'money back'],
    d: (() => {
      const a = arc(12, 12.4, 8.1, 218, -82);
      return [a.d, head(a.end, a.tangent, 3.4), ...dollar(12, 12.75, 7, 4.5, 1.25)];
    })(),
  },
  'secure-payment': {
    tags: ['pago seguro', 'protección', 'compra protegida', 'secure payment', 'safe checkout'],
    d: [
      'M11.3 3.15a2 2 0 0 1 1.4 0l5.65 2.12c.6.23 1 .8 1 1.44v4.92c0 4.6-2.95 8.1-7.35 9.82-4.4-1.72-7.35-5.22-7.35-9.82V6.71c0-.64.4-1.21 1-1.44Z',
      ...dollar(12, 12, 7.5, 5, 1.25),
    ],
  },
  'tip-jar': {
    tags: ['propina', 'bote', 'frasco', 'tip', 'tip jar'],
    d: [sq(5, 7.75, 14, 13.5, 3.75, SQ), line([6.75, 4.75], [17.25, 4.75]), ...dollar(12, 14.5, 5.75, 4, 1)],
  },
  // Donation: the open hand (with the shirt cuff from `deal`) offering a heart
  'donation': {
    tags: ['donativo', 'donación', 'causa', 'donate', 'charity'],
    d: [
      heart(13.75, 7.25, 9),
      sq(2.75, 13.25, 3, 7.75, 0.9),
      'M5.75 14.5H8.5C9.5 14.5 10.25 15 10.75 15.75L11.25 16.5H15.5L18.75 13.75a1.4 1.4 0 0 1 2 2L17.25 19.5C16.6 20.15 15.9 20.25 15 20.25H5.75',
    ],
  },
  'reward-points': {
    tags: ['puntos', 'recompensa', 'lealtad', 'rewards', 'points'],
    d: [circ(12, 12, 9), star(12, 12.35, 5.25, 2.3, 0.75)],
  },

  // ── Point of sale ──
  // The tallest drawer: the handle sits 3 from its edge and from the bottom. The display, 7.5 wide
  // and centered on its post, keeps the ink under QA's density limit (at 8.5 it was just over)
  'cash-register': {
    tags: ['caja registradora', 'punto de venta', 'caja', 'cash register', 'checkout'],
    d: [
      sq(3.25, 9, 17.5, 12.25, 3, SQ),
      sq(4.75, 2.75, 7.5, 3.25, 1),
      line([8.5, 6], [8.5, 9]),
      line([3.25, 15.5], [20.75, 15.5]),
      line([10.25, 18.375], [13.75, 18.375]),
      ...[6.75, 10.25, 13.75, 17.25].map((x) => dot(x, 12.25, 0.3)),
    ],
  },
  // The terminal: the full portrait container (14.5 × 18.5) with the ticket on top. The keys are
  // dots of r 0.3, 3.6 apart (1.5 of clearance) and 1.85 from the edge; the screen is as wide as
  // the keypad.
  'payment-terminal': {
    tags: ['terminal', 'punto de venta', 'datáfono', 'pos', 'card reader'],
    d: [
      sq(4.75, 5.75, 14.5, 15.5, 2.5, SQ),
      roundline(
        [
          [9.25, 5.75],
          [9.25, 2.75],
          [14.75, 2.75],
          [14.75, 5.75],
        ],
        [0, 1.25, 1.25, 0],
      ),
      sq(8.1, 8.75, 7.8, 2.25, 0.7),
      ...[8.4, 12, 15.6].flatMap((x) => [dot(x, 14.3, 0.3), dot(x, 17.9, 0.3)]),
    ],
  },
  // The calculator: the four operations, 4 apart and 3.25 from the edge
  'calculator': {
    tags: ['calculadora', 'cálculo', 'cuentas', 'calculator', 'math'],
    d: [
      sq(3.25, 3.25, 17.5, 17.5, 4, SQ),
      ...glyph('plus', [8.25, 8.25], 1.75),
      ...glyph('minus', [15.75, 8.25], 1.75),
      ...glyph('x', [8.25, 15.75], 1.85),
      line([14, 14.25], [17.5, 14.25]),
      line([14, 17.25], [17.5, 17.25]),
    ],
  },
  // Barcode: longer outer bars and symmetrical gaps of 3 and 4.5
  'barcode': {
    tags: ['código de barras', 'producto', 'sku', 'barcode', 'upc'],
    d: [3, 6, 10.5, 13.5, 18, 21].map((x, i) => line([x, 4.5], [x, i === 0 || i === 5 ? 19.5 : 16.5])),
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
  // QR: three finder squares with their dots, the alignment square and a loose module
  'qr-code': {
    tags: ['código QR', 'escanear', 'pagar con QR', 'qr code', 'scan'],
    d: [
      sq(3.25, 3.25, 7.25, 7.25, 2.1),
      sq(13.5, 3.25, 7.25, 7.25, 2.1),
      sq(3.25, 13.5, 7.25, 7.25, 2.1),
      sq(16.5, 16.5, 4.25, 4.25, 1.25),
      dot(6.875, 6.875),
      dot(17.125, 6.875),
      dot(6.875, 17.125),
      dot(14.25, 14.25),
    ],
  },
  'qr-scan': {
    tags: ['escanear QR', 'pagar con QR', 'lector', 'qr scan', 'scan to pay'],
    d: [
      sq(7, 7, 3.5, 3.5, 1.1),
      sq(13.5, 7, 3.5, 3.5, 1.1),
      sq(7, 13.5, 3.5, 3.5, 1.1),
      dot(15.25, 15.25),
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
    ],
  },

  // ── Gift ──
  'gift': {
    tags: ['regalo', 'obsequio', 'sorpresa', 'gift', 'present'],
    d: [
      roundline(
        [
          [4.5, 12.25],
          [4.5, 21],
          [19.5, 21],
          [19.5, 12.25],
        ],
        [0, 2.5, 0, 0],
      ),
      sq(3, 7.75, 18, 4.5, 1.75),
      line([12, 7.75], [12, 21]),
      // The bow: the same loops as the gift card
      leaf([12, 7.75], [8.25, 4.5], 2.75),
      leaf([15.75, 4.5], [12, 7.75], 2.75),
    ],
  },

  // ── Packages and shipping ──
  'parcel': { tags: ['paquete', 'caja', 'envío', 'pedido', 'parcel', 'package'], d: parcel() },
  // The flaps open from the straight run of the opening's edges (they touch the border)
  'parcel-open': {
    tags: ['paquete abierto', 'desempacar', 'recibido', 'unbox', 'open package'],
    d: (() => {
      const P = iso(12, 7.5, 8, 5);
      const lift = (a, b, dx) => roundline([a, add(a, [dx, -4]), add(b, [dx, -4]), b], [0, 1, 1, 0]);
      return [
        roundline([P.L, P.Lb, P.B, P.Rb, P.R], [0, 1.4, 1.4, 1.4, 0]),
        // The side corners almost sharp: that's where the walls start
        roundpoly([P.L, P.T, P.R, P.C], [0.25, 1.1, 0.25, 1.1]),
        line(P.C, toward(P.B, P.C, 0.4)),
        lift(toward(P.L, P.T, 2.3), toward(P.T, P.L, 1.75), -1.5),
        lift(toward(P.R, P.T, 2.3), toward(P.T, P.R, 1.75), 1.5),
      ];
    })(),
  },
  'parcel-check': { tags: ['entregado', 'paquete', 'pedido completo', 'delivered', 'package check'], d: parcel(PARCEL_B), badge: badge('check') },
  'parcel-return': { tags: ['devolución', 'paquete', 'regresar envío', 'return', 'package return'], d: parcel(PARCEL_B), badge: backBadge() },
  'delivery-time': { tags: ['tiempo de entrega', 'envío', 'en camino', 'delivery time', 'eta'], d: parcel(PARCEL_B), badge: badge('clock') },
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
      line([3.25, 10.25], [5.5, 10.25]),
    ],
  },
  'home-delivery': { tags: ['entrega a domicilio', 'casa', 'a domicilio', 'home delivery', 'doorstep'], d: [ROOF, WALLS, ...cube(12, 10, 3.75, 3.75, 0.9)] },
  'pickup-point': {
    tags: ['punto de recogida', 'sucursal', 'recoger en tienda', 'pickup', 'collection point'],
    d: (() => {
      const tip = [12, 21.25];
      const [tR, tL] = [polar(12, 10, 7.5, 41.8), polar(12, 10, 7.5, 138.2)];
      return [`${roundline([tL, tip, tR], [0, 1.25, 0])}A7.5 7.5 0 1 0 ${pt(tL)}Z`, ...cube(12, 6, 4, 4.5, 1)];
    })(),
  },

  // ── Weight and measure ──
  // The needle runs from the center to the dial (it touches it): a floating segment inside ended up
  // only 1.5 away
  'weighing-scale': {
    tags: ['báscula', 'peso', 'pesar', 'scale', 'weight'],
    d: [sq(3.75, 7.75, 16.5, 13.5, 3.5, SQ), line([5.75, 4.25], [18.25, 4.25]), line([12, 4.25], [12, 7.75]), circ(12, 14.5, 3.75), line([12, 14.5], polar(12, 14.5, 3.75, -55))],
  },
  'balance-scale': {
    tags: ['balanza', 'equilibrio', 'justo', 'balance', 'scales'],
    d: [
      line([12, 3.25], [12, 20.5]),
      line([8, 20.5], [16, 20.5]),
      line([5.75, 6.25], [18.25, 6.25]),
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
      // Facets: the crown on top and the pavilion, which stops short of the point
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

  // ── Auction and stamp ──
  'gavel': {
    tags: ['subasta', 'martillo', 'puja', 'auction', 'gavel', 'bid'],
    d: [rrect([14.5, 8], [1, 1], 4.75, 2.4, 1.1), line(add([14.5, 8], mul(unit([-1, 1]), 2.4)), add([14.5, 8], mul(unit([-1, 1]), 13))), sq(12.75, 17.5, 8.5, 3.25, 1.25)],
  },
  'rubber-stamp': {
    tags: ['sello', 'aprobado', 'autorizar', 'stamp', 'approve'],
    d: [circ(12, 5.25, 2.5), line([10.5, 7.25], [10, 11.75]), line([13.5, 7.25], [14, 11.75]), sq(4.25, 11.75, 15.5, 4.75, 1.75), line([4.25, 20], [19.75, 20])],
  },

  // ── Inventory and warehouse ──
  // The shelving unit: two shelves with three boxes (with four it clogged up)
  'inventory': {
    tags: ['inventario', 'estantes', 'existencias', 'stock', 'inventory', 'shelves'],
    d: [
      line([3.25, 2.75], [3.25, 21.25]),
      line([20.75, 2.75], [20.75, 21.25]),
      line([3.25, 11], [20.75, 11]),
      line([3.25, 19.75], [20.75, 19.75]),
      roundline(
        [
          [6.5, 11],
          [6.5, 5.75],
          [11, 5.75],
          [11, 11],
        ],
        [0, 1.25, 1.25, 0],
      ),
      roundline(
        [
          [14.25, 11],
          [14.25, 8],
          [17.5, 8],
          [17.5, 11],
        ],
        [0, 1.1, 1.1, 0],
      ),
      roundline(
        [
          [8.5, 19.75],
          [8.5, 14.75],
          [15.5, 14.75],
          [15.5, 19.75],
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
          [8.25, 11.75],
          [15.75, 11.75],
          [15.75, 20.75],
        ],
        [0, 1, 1, 0],
      ),
      line([8.25, 14.75], [15.75, 14.75]),
      line([8.25, 17.75], [15.75, 17.75]),
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

  // ── Fashion ──
  // The hook drops straight to the triangle's apex: a single stroke, with no loose segment
  'hanger': (() => {
    const apex = [12, 10];
    const half = Math.atan(9.25 / 7.75);
    const neck = apex[1] + 0.9 / Math.sin(half) - 0.9;
    const a = arc(12, 6.25, 2.25, 90, -200);
    return {
      tags: ['gancho', 'ropa', 'moda', 'percha', 'hanger', 'apparel'],
      d: [
        roundpoly(
          [
            apex,
            [21.25, 17.75],
            [2.75, 17.75],
          ],
          [0.9, 1.6, 1.6],
        ),
        `M12 ${N(neck)}V8.5${a.d.replace(/^M[^A]*/, '')}`,
      ],
    };
  })(),
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

  // ── Coverage (round 2) ──
  'currency-rupee': {
    tags: ['rupia', 'rupia india', 'moneda', 'inr', 'divisa', 'rupee', 'currency'],
    // ₹ at the height of the yen: two bars 3 apart, the bowl growing out of the top one and the leg
    // on a diagonal.
    d: [circ(12, 12, 9), line([8.75, 7], [15.25, 7]), line([8.75, 10], [15.25, 10]), 'M11 7A3 3 0 0 1 11 13H8.75L14.25 17.5'],
  },
};

// ── Round 4: payments, cards, banking, investing, insurance, accounting and the shop floor ─────
// Every family reuses its base exactly: the core card, the wallet, the bag, the cart, the store,
// the bank, the document, the invoice and the receipt from above, and the viewfinder corners of
// barcode-scan. The badges are the engine's; a piece on top (the slot, the front coin, the reader)
// is a custom badge and clears the base the same way.
const NU = nucleo.icons;
const FRAME = icons['barcode-scan'].d.slice(0, 4);
const CARD_FACE = icons['card-plus'].d;
const INVOICE_B = icons['invoice-plus'].d;
/** A coin seen from the front: its rim and an inner ring (the coins too small to carry a sign). */
const coin = (c, r, rim) => [circ(...c, r), circ(...c, rim)];
/**
 * A dollar coin: its rim and the sign, whose stem ends 2.9 from the rim (closer, it merged with the
 * rim at bold). Below r 6.25 the sign's counters close at light weights and its tails get shorter
 * than 2: smaller coins carry an inner ring.
 */
function coinDollar(c, r) {
  const span = 2 * (r - 2.9);
  // Short stems leave the S its room: with longer ones its counters closed at bold
  const stub = 0.6;
  return [circ(...c, r), ...dollar(c[0], c[1], span - 2 * stub, (span - 2 * stub) * 0.68, stub)];
}

/** A receipt's lower piece: a straight top (where it was cut) and the toothed foot. */
function receiptFoot(x, y, w, h, teeth = 5, depth = 1.5) {
  const step = w / teeth;
  const z = [];
  for (let i = 1; i < teeth * 2; i++) z.push([x + w - (step / 2) * i, i % 2 ? y + h - depth : y + h]);
  return `M${pt([x, y])}L${pt([x + w, y])}L${pt([x + w, y + h])}${z.map((p) => `L${pt(p)}`).join('')}L${pt([x, y + h])}Z`;
}
/** A receipt's upper piece: the receipt's continuous top corners and a straight bottom (the cut). */
function receiptHead(x, y, w, h, r = 3.5) {
  const k = corners(x, y, w, h, r);
  return `M${pt([x, y + h])}L${pt(k[3].p)}${k[3].c}L${pt(k[0].p)}${k[0].c}L${pt([x + w, y + h])}Z`;
}

// Cash in and out: a capsule slot (the piece on top) takes in or gives up the coin, which sinks
// into it; the arrow beside it is drawn once, pointing down into the slot, and flipped for the
// payout. The coin is the smallest that carries its sign (r 6.25), which stays clear of the slot's
// clearance at every weight.
const SLOT = sq(3.25, 15.5, 17.5, 3.5, 1.75);
const SLOT_COIN = coinDollar([8.25, 8.75], 6.25);
const SLOT_ARROW = [line([19.5, 4], [19.5, 11.75]), head([19.5, 11.75], [0, 1], 2.5)];
// The bank with a badge keeps its pediment and base and pulls its columns to the left, 3 apart:
// in place, the middle column was cut to a stub whose length changed with the weight
const BANK_B = () => [icons.bank.d[0], line([6.5, 11.25], [6.5, 17]), line([9.5, 11.25], [9.5, 17]), icons.bank.d[4]];

// Dashed card (virtual): the corners as L pieces and dashes 3 apart, so no end sits near another
const dashedCard = () => {
  const [x0, y0, x1, y1, r] = [2.5, 5, 21.5, 19, 3];
  return [
    roundline([[x0, 10.5], [x0, y0], [6, y0]], [0, r, 0]),
    line([9, y0], [15, y0]),
    roundline([[18, y0], [x1, y0], [x1, 10.5]], [0, r, 0]),
    roundline([[x1, 13.5], [x1, y1], [18, y1]], [0, 0, 0]),
    line([15, y1], [9, y1]),
    roundline([[6, y1], [x0, y1], [x0, 13.5]], [0, r, 0]),
  ];
};

// Coin stack: three coins seen from the side, each a capsule 14 × 3.5; the middle one shifted 1.5 to
// the left and the bottom one 1 to the right. The top coin is whole and each lower one starts at the
// edge of the coin above it (its rim runs on from that edge), so nothing overlaps.
function coinStack(x, y) {
  const [w, h, r] = [14, 3.5, 1.75];
  const A = (to, sweep = 0) => `A${r} ${r} 0 0 ${sweep} ${pt(to)}`;
  const [m, b] = [x - 1.5, x + 1];
  return [
    sq(x, y, w, h, r),
    `M${pt([x + r, y + h])}H${N(m + r)}${A([m + r, y + 2 * h])}H${N(m + w - r)}${A([m + w - r, y + h])}`,
    `M${pt([b + r, y + 2 * h])}${A([b + r, y + 3 * h])}H${N(b + w - r)}${A([b + w - r, y + 2 * h])}H${N(m + w - r)}`,
  ];
}

/** The arc of circle B that lies outside circle A, from one crossing to the other (a bear's ear). */
function outerArc(cA, rA, cB, rB) {
  const d = len(sub(cB, cA));
  const a = (rA * rA - rB * rB + d * d) / (2 * d);
  const h = Math.sqrt(rA * rA - a * a);
  const u = unit(sub(cB, cA));
  const P = add(cA, mul(u, a));
  const [p, q] = [add(P, mul([-u[1], u[0]], h)), add(P, mul([u[1], -u[0]], h))];
  const ang = (x) => (Math.atan2(x[1] - cB[1], x[0] - cB[0]) * 180) / Math.PI;
  // Clockwise from p to q passes the far side of B (away from A)
  const span = (((ang(q) - ang(p)) % 360) + 360) % 360;
  const [from, to, sweep] = span > 180 ? [p, q, 1] : [q, p, 1];
  return `M${pt(from)}A${N(rB)} ${N(rB)} 0 1 ${sweep} ${pt(to)}`;
}

/**
 * A wing on the left of a bill: its upper edge out to the tip and two feathers back to the bill. The
 * last feather is an arc around the wing's root, at least 3 wide inside, and meets the bill square,
 * so the wing never pinches at bold.
 */
const WING = 'M7.25 10.5C5.5 8.5 4.25 7 3 6.25A5 5 0 0 0 4.25 11A3.05 3.05 0 0 0 7.25 13.5';

// Insurance: lugares' umbrella, flattened (an elliptical dome, three shallow scallops) to leave room
// below for what it covers: a coin, a house, a heart, a car, a paw. The policy carries it small.
const CANOPY = (() => {
  const [x0, x1, y, n, sag] = [2.75, 21.25, 10.25, 3, 1.5];
  const c = (x1 - x0) / n;
  const R = ((c * c) / 4 + sag * sag) / (2 * sag);
  let s = `M${pt([x0, y])}A${N((x1 - x0) / 2)} 7.25 0 0 1 ${pt([x1, y])}`;
  for (let i = n - 1; i >= 0; i--) s += `A${N(R)} ${N(R)} 0 0 0 ${pt([x0 + c * i, y])}`;
  return `${s}Z`;
})();
/** The policy: the document with the canopy at half size as its letterhead and two lines of terms. */
const POLICY = [sq(...DOC, SQ), transform(CANOPY, 0.5, 6, 4.75), line([8.75, 13.5], [15.25, 13.5]), line([8.75, 16.75], [12.75, 16.75])];

// Pickaxe: a crescent head and the handle, drawn upright and turned 45° to strike down to the left
const PICK = ['M6 9A7 7 0 0 1 18 9A28 28 0 0 0 6 9Z', line([12, 8.35], [12, 20.5])].map((d) => transform(turnPath(d, -45), 1, 2.5, -2.5));

/**
 * Ledger: the bound book, its cover ruled in columns and the spine band wrapped around the cover's
 * left edge (the cover's left corners are square, so the spine meets them at its ends).
 */
const LEDGER = [
  sq(7.75, 2.75, 12, 18.5, 3, { square: ['tl', 'bl', 'br'] }),
  roundline([[7.75, 2.75], [4.25, 2.75], [4.25, 21.25], [7.75, 21.25]], [0, 2.25, 2.25, 0]),
  line([11.75, 6.25], [11.75, 17.75]),
  line([15.75, 6.25], [15.75, 17.75]),
];

/** A rotated rectangle with the signature corner (a tilted screen): center, half sizes, angle. */
function tilted(c, hw, hh, deg, r) {
  const P = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map((p) => add(c, rot(p, [0, 0], deg)));
  return roundpoly(P, [r, r, 0, r]);
}

Object.assign(icons, {
  // ── Payments ──
  // The receipt cut across its middle and its halves pulled apart, each with its line
  'payment-split': {
    tags: ['dividir cuenta', 'pago dividido', 'cuenta compartida', 'split bill', 'split payment'],
    d: [receiptHead(3.75, 2.75, 14.5, 6.75), line([7.25, 6.25], [14.75, 6.25]), receiptFoot(5.75, 12.5, 14.5, 8.75), line([9.25, 16], [16.75, 16])],
  },
  // Four payments: the rim broken into four arcs (22° gaps: 3.4 between their ends)
  installments: {
    tags: ['pagos en plazos', 'meses sin intereses', 'pago diferido', 'installments', 'pay in 4'],
    d: [...[-79, 11, 101, 191].map((a) => arc(12, 12, 9, a, a + 68).d), ...dollar(12, 12, 9, 6, 1.5)],
  },
  'card-clock': { tags: ['pago pendiente', 'cargo autorizado', 'pagar después', 'pending charge', 'pay later'], d: CARD_FACE, badge: badge('clock') },
  'cash-in': {
    tags: ['depositar', 'abonar', 'agregar saldo', 'deposit', 'cash in', 'add money'],
    d: [...SLOT_COIN, ...SLOT_ARROW],
    badge: own([SLOT], SLOT, { solid: [SLOT] }),
  },
  'cash-out': {
    tags: ['retirar', 'retiro', 'transferir al banco', 'withdraw', 'payout', 'cash out'],
    d: [...SLOT_COIN, ...SLOT_ARROW.map((d) => flipPath(d, 'y', 7.875))],
    badge: own([SLOT], SLOT, { solid: [SLOT] }),
  },
  // The coin moving right, three speed lines trailing it (each 3 or more from the rim)
  'instant-payment': {
    tags: ['transferencia inmediata', 'enviar dinero', 'pago al instante', 'instant transfer', 'send money', 'p2p'],
    d: [...coinDollar([15, 12], 6.25), line([3.75, 8.75], [6.25, 8.75]), line([2.25, 12], [5.75, 12]), line([3.75, 15.25], [6.25, 15.25])],
  },
  // The link and the dollar sign at its free corner, a piece on top (a coin that small could only
  // carry a ring, and read as a target)
  'payment-link': {
    tags: ['liga de pago', 'enlace de cobro', 'cobrar con link', 'payment link', 'pay link'],
    d: NU.link.d,
    badge: own(dollar(17.75, 16.75, 5.75, 3.75, 1), sq(15.25, 12.5, 5, 8.5, 2.5)),
  },
  // The bill in front of the closed package (the engine clears the package around it)
  'cash-on-delivery': {
    tags: ['pago contra entrega', 'pagar al recibir', 'efectivo', 'cash on delivery', 'cod'],
    d: parcel({ cx: 9.75, top: 2.75, w: 7.25, h: 7, tape: false }),
    badge: (() => {
      const note = sq(9.25, 13, 12, 8.25, 2.25, SQ);
      const mark = circ(15.25, 17.125, 1.6);
      return own([note, mark], note, { solid: [note], cut: [mark] });
    })(),
  },

  // ── Cards ──
  // Cash-in's slot and arrow with the card going in, chip end first (card-chip's chip, 5 wide, 2.75
  // from the card's sides): a card standing in a tray read as a document in an inbox
  'card-insert': {
    tags: ['insertar tarjeta', 'chip', 'lector', 'insert card', 'chip card', 'card reader'],
    d: [roundline([[4.25, 17.25], [4.25, 3.25], [14.75, 3.25], [14.75, 17.25]], [0, 2.5, 2.5, 0]), sq(7, 6.25, 5, 4.5, 1.5), line([7, 8.5], [12, 8.5]), ...SLOT_ARROW],
    badge: own([SLOT], SLOT, { solid: [SLOT] }),
  },
  // The card on its way, three speed lines trailing it (as instant-payment's coin): a card in a
  // reader's channel read as a drawer
  'card-swipe': {
    tags: ['deslizar tarjeta', 'banda magnética', 'lector', 'swipe card', 'card reader', 'magstripe'],
    d: [sq(8, 6.75, 13.5, 10.5, 2.75, SQ), line([8, 10.25], [21.5, 10.25]), line([3, 9], [5, 9]), line([2.25, 12], [5, 12]), line([3, 15], [5, 15])],
  },
  // The lock clears more than the round badges: the card rises 0.5 so its stripe's cut (filled)
  // stays clear of the lock's clearance at bold
  'card-lock': { tags: ['bloquear tarjeta', 'congelar tarjeta', 'tarjeta bloqueada', 'lock card', 'freeze card'], d: CARD_FACE.map((d) => transform(d, 1, 0, -0.5)), badge: badge('lock') },
  // The back: the wide magnetic stripe and, below it, the security code's box beside a short
  // signature line (a longer one made it too dense)
  'card-back': {
    tags: ['reverso de tarjeta', 'código de seguridad', 'firma', 'card back', 'cvv', 'security code'],
    d: [sq(...CARD, SQ), line([2.5, 8], [21.5, 8]), line([2.5, 11], [21.5, 11]), line([12.5, 15], [15.25, 15]), sq(15.25, 13.75, 3, 2.5, 0.9)],
  },
  'card-scan': {
    tags: ['escanear tarjeta', 'cámara', 'agregar tarjeta', 'scan card', 'card scanner'],
    d: [sq(6.5, 7.75, 11, 8.5, 2.25, SQ), line([6.5, 10.75], [17.5, 10.75]), ...FRAME],
  },
  'card-alert': { tags: ['contracargo', 'disputa', 'fraude', 'chargeback', 'dispute', 'card fraud'], d: CARD_FACE, badge: badge('alert') },
  // The gear's teeth change their contours with the weight; with the card's right edge cut at 21.5
  // the outlines at 0.9 and 2.1 could not be matched, so the card sits 0.5 to the left (as card-lock's
  // rises 0.5) and its edge's cut end falls clear of the teeth
  'card-gear': { tags: ['ajustes de tarjeta', 'límites', 'controles', 'card settings', 'card controls'], d: CARD_FACE.map((d) => transform(d, 1, -0.5, 0)), badge: badge('gear') },
  'card-virtual': {
    tags: ['tarjeta virtual', 'tarjeta digital', 'compras en línea', 'virtual card', 'digital card'],
    d: [...dashedCard(), line([2.5, 9.6], [7, 9.6]), line([10, 9.6], [14, 9.6]), line([17, 9.6], [21.5, 9.6]), line([6.25, 15], [9.75, 15])],
  },
  // The PIN: the card with its stripe and four masked digits under it, dots 3.75 apart (apart at
  // every weight); without the stripe the card read as a password field
  'card-pin': {
    tags: ['nip', 'pin', 'contraseña de tarjeta', 'card pin', 'passcode'],
    d: [sq(...CARD, SQ), line([2.5, 9.6], [21.5, 9.6]), ...[6.375, 10.125, 13.875, 17.625].map((x) => dot(x, 14.25, 0.55))],
  },

  // ── Wallet and devices ──
  'wallet-plus': { tags: ['recargar saldo', 'agregar fondos', 'cartera', 'top up', 'add funds', 'wallet'], d: icons.wallet.d, badge: badge('plus') },
  // The watch (as in dispositivos, 10 wide) and the contactless arcs of mobile-payment from its face
  'watch-payment': {
    tags: ['pagar con reloj', 'reloj inteligente', 'sin contacto', 'watch pay', 'smartwatch payment'],
    d: [
      sq(3, 6.5, 10, 11, 3, SQ),
      roundline([[5.5, 6.5], [6, 3], [10, 3], [10.5, 6.5]], [0, 0.75, 0.75, 0]),
      roundline([[5.5, 17.5], [6, 21], [10, 21], [10.5, 17.5]], [0, 0.75, 0.75, 0]),
      arc(11.5, 12, 5.5, -36, 36).d,
      arc(11.5, 12, 8.75, -36, 36).d,
    ],
  },
  // The smartphone of dispositivos, 3 to the left, and the dollar coin in front of its lower right
  // (as on global-payment): with the coin sunk into its top edge the phone was left a squat stub
  // under a coin and read as a trophy
  'mobile-top-up': {
    tags: ['recarga', 'tiempo aire', 'saldo celular', 'mobile top up', 'recharge', 'prepaid'],
    d: [sq(3.25, 2.75, 11.5, 18.5, 3.25, SQ), line([7.5, 5.75], [10.5, 5.75])],
    badge: (() => {
      const c = coinDollar([15.5, 15.5], 6.25);
      return own(c, c[0], { solid: [c[0]], cut: c.slice(1) });
    })(),
  },
  // ── Bag and cart ──
  // A bolt drawn as one zigzag stroke in the bag (the core set's bolt at half size closed its
  // waist at bold)
  'express-checkout': {
    tags: ['compra rápida', 'comprar ya', 'pago exprés', 'express checkout', 'buy now', 'one tap'],
    d: [...bag(), line([13.75, 11], [10.25, 15], [13.75, 14.5], [10.25, 18])],
  },
  'bag-sync': { tags: ['volver a comprar', 'repetir pedido', 'suscribirse', 'buy again', 'reorder', 'subscribe'], d: bag(), badge: badge('sync') },
  // Two opposed arrows, the lower one the upper one turned half a turn; offset so no arrowhead sits
  // near the other shaft
  'bag-exchange': (() => {
    const top = [line([10.8, 12.5], [15.8, 12.5]), head([15.8, 12.5], [1, 0], 2)];
    return {
      tags: ['cambio de producto', 'cambiar talla', 'intercambio', 'exchange', 'swap item', 'size exchange'],
      d: [...bag(), ...top, ...top.map((d) => turnPath(d, 180, [12, 14.5]))],
    };
  })(),
  'bag-clock': { tags: ['preventa', 'próximamente', 'apartar', 'pre-order', 'coming soon'], d: bag(), badge: badge('clock') },
  // The percent sign in the basket: its slash 2.85 from the edges, its dots 3.3 from the slash
  'cart-discount': {
    tags: ['descuento en carrito', 'cupón aplicado', 'oferta', 'cart discount', 'promo code'],
    d: [...cart(), dot(10.25, 8.6, 0.55), line([12.3, 11.55], [14.2, 8.7]), dot(16.25, 11.65, 0.55)],
  },
  'cart-clock': { tags: ['guardar para después', 'carrito abandonado', 'pendiente', 'saved for later', 'abandoned cart'], d: cart(), badge: badge('clock') },

  // ── Price ──
  // Three plans: two side by side, each with its header, and the featured one pulled in front of
  // them carrying the price (the engine clears the two behind it). Side cards lower than the front
  // one, the two holding it from below, read as a phone in a holder. The front card starts low
  // enough that the headers fall inside its clearance whole, at every weight (a header that ran
  // along the clearance's edge left slivers at light and bold)
  'pricing-plans': {
    tags: ['planes', 'precios', 'suscripción', 'pricing', 'plans', 'tiers'],
    d: [sq(2.5, 2.75, 8, 13, 2.25, SQ), line([2.5, 6.25], [10.5, 6.25]), sq(13.5, 2.75, 8, 13, 2.25, SQ), line([13.5, 6.25], [21.5, 6.25])],
    badge: (() => {
      const card = sq(7.25, 7, 9.5, 14.25, 2.5, SQ);
      const sign = dollar(12, 14.1, 6, 3.5, 0.9);
      return own([card, ...sign], card, { solid: [card], cut: sign });
    })(),
  },
  'price-tag-arrow-down': { tags: ['baja de precio', 'alerta de precio', 'más barato', 'price drop', 'price alert'], d: [T.body, circ(...T.hole, 1)], badge: badge('arrow-down') },
  // The percent sign and, beneath it, the arrow that runs out and curls back
  cashback: {
    tags: ['reembolso', 'dinero de vuelta', 'bonificación', 'cashback', 'cash back', 'rebate'],
    d: [...percent(12, 7.5, 3, 1.35, 3.25), 'M4.5 15.25H16a3 3 0 0 1 0 6H10.5', head([4.5, 15.25], [-1, 0], 3)],
  },
  // The paddle raised for a bid, tilted in the hand: a rounded plate carrying the price on a grip
  // 3.5 wide (a round plate on a thin stick read as a lollipop). The sign's stems end 2.9 from the
  // plate's top and foot. Turned 12° about the grip's foot and moved 2.25 right, so the tilted
  // paddle sits centered in the live area
  auction: (() => {
    const raise = (d) => transform(turnPath(d, -12, [12, 21.25]), 1, 2.25, 0);
    const d = [sq(4.75, 2.75, 14.5, 12.5, 3.5), roundline([[10.25, 15.25], [10.25, 21.25], [13.75, 21.25], [13.75, 15.25]], [0, 1.5, 1.5, 0]), ...dollar(12, 9, 5.5, 3.75, 0.6)];
    return { tags: ['subasta', 'pujar', 'oferta', 'auction', 'bid', 'bidding'], d: d.map(raise) };
  })(),

  // ── Invoice and receipt ──
  'invoice-recurring': { tags: ['factura recurrente', 'cobro automático', 'facturación periódica', 'recurring invoice', 'auto billing'], d: INVOICE_B, badge: badge('sync') },
  'invoice-minus': { tags: ['nota de crédito', 'abono', 'factura negativa', 'credit note', 'credit memo'], d: INVOICE_B, badge: badge('minus') },
  // A receipt 10.5 wide inside the viewfinder with the receipt's three lines (narrower, with its
  // round top and two lines, it read as a ghost); its foot stays 3 from the corners' ends
  'receipt-scan': {
    tags: ['escanear recibo', 'capturar gasto', 'comprobante', 'scan receipt', 'expense capture'],
    d: [receipt(6.75, 5.5, 10.5, 12.75, 4, 1, 2.25), line([9.75, 8.5], [14.25, 8.5]), line([9.75, 11.38], [14.25, 11.38]), line([9.75, 14.25], [12.25, 14.25]), ...FRAME],
  },
  // The receipt with its second line shortened and no third, so every end stays 7.6 or more from the
  // badge's center (clear of its clearance at every weight); its teeth stop where the badge begins
  // and the foot runs on straight under it, so the clearance never cuts across a tooth
  'receipt-clock': {
    tags: ['historial de compras', 'pedidos anteriores', 'historial', 'order history', 'purchase history'],
    d: [
      (() => {
        const k = corners(4.75, 2.75, 14.5, 18.5, 3.5);
        const teeth = [[10.55, 21.25], [9.1, 19.75], [7.65, 21.25], [6.2, 19.75]];
        return `M4.75 21.25L${pt(k[3].p)}${k[3].c}L${pt(k[0].p)}${k[0].c}L19.25 21.25${teeth.map((p) => `L${pt(p)}`).join('')}Z`;
      })(),
      line([8.5, 7.75], [14.5, 7.75]),
      line([8.5, 11.25], [11.75, 11.25]),
    ],
    badge: badge('clock'),
  },

  // ── Coins and cash ──
  'coin-stack': {
    tags: ['monedas apiladas', 'ahorro', 'saldo', 'coin stack', 'savings', 'earnings'],
    d: coinStack(5.25, 6.75),
  },
  // The stack lowered and a small flag (the notched banner of edicion's flag) planted on top
  'coin-stack-goal': {
    tags: ['meta de ahorro', 'objetivo', 'ahorrar', 'savings goal', 'goal', 'target'],
    d: [...coinStack(5.25, 10.75), line([12, 10.75], [12, 2.75]), roundpoly([[12, 2.75], [17.25, 2.75], [15.6, 4.88], [17.25, 7], [12, 7]], [0, 0.6, 0.4, 0.6, 0])],
  },
  // The stack and a small coin popping off it along a short curved arrow (a cubic that starts 3
  // above the stack; drawn as a circular arc it didn't interpolate in the fill)
  'coin-stack-dividend': {
    tags: ['dividendos', 'reparto de utilidades', 'rendimiento', 'dividend', 'payout', 'yield'],
    d: [...coinStack(5.25, 10.75), 'M8.5 7.75C8.75 5.5 10.5 4.5 13.25 4.5', head([13.25, 4.5], [1, 0], 2.4), circ(18.75, 4.75, 2.25)],
  },
  // The cash box: a low box, the lid's seam, the handle on the lid and, in front, the capsule coin
  // slot of cash-in (a plain line read as a briefcase's grip)
  'cash-box': {
    tags: ['caja chica', 'caja de efectivo', 'fondo fijo', 'petty cash', 'cash box'],
    d: [sq(3.25, 9.25, 17.5, 11.5, 3, SQ), line([3.25, 12.75], [20.75, 12.75]), roundline([[9.25, 9.25], [9.25, 6.25], [14.75, 6.25], [14.75, 9.25]], [0, 1.25, 1.25, 0]), sq(8.75, 15.75, 6.5, 2.5, 1.25)],
  },
  // The kiss-lock purse: the frame a bar across the top, wider than the pouch's mouth, the pouch
  // hanging from it and bulging past its ends, and the clasp's two knobs on the bar, 3.5 apart and
  // sunk into it at every weight. A dome over the pouch read as a pot's lid, and the knobs touching
  // each other as a heart.
  'coin-purse': {
    tags: ['monedero', 'portamonedas', 'cambio', 'coin purse', 'change purse'],
    d: ['M6.25 9.25C4.5 11 3.75 13.25 3.75 15.75A5 5 0 0 0 8.75 20.75H15.25A5 5 0 0 0 20.25 15.75C20.25 13.25 19.5 11 17.75 9.25', 'M5 9.25H19', dot(10.25, 8.1, 0.5), dot(13.75, 8.1, 0.5)],
  },
  // A bill flying off to the right, a wing trailing from its left edge, the whole turned 10° up (a
  // small bill with a wing on each side read as a face with ears). The wing's ends run 0.25 into
  // the bill's edge (on it, they failed to join it at light)
  'money-wings': (() => {
    const fly = (d) => turnPath(d, -10, [12, 12]);
    return {
      tags: ['gastos', 'dinero que se va', 'egresos', 'spending', 'money out', 'expenses'],
      d: [sq(7.25, 7, 14, 10, 2.25, SQ), circ(14.25, 12, 2.1), transform(WING, 1, 0.25, 0.5)].map(fly),
    };
  })(),
  // The vault door: the round door, the three-spoke wheel (as on safe-box) with a knob on each spoke,
  // and two hinges on its left (tabs whose ends meet the door)
  vault: (() => {
    const c = [12.75, 12];
    const xAt = (y) => c[0] - Math.sqrt(8.5 ** 2 - (y - c[1]) ** 2);
    const hinge = (y) => roundline([[xAt(y - 1.25), y - 1.25], [2.75, y - 1.25], [2.75, y + 1.25], [xAt(y + 1.25), y + 1.25]], [0, 0.6, 0.6, 0]);
    return {
      tags: ['bóveda', 'tesorería', 'apartados de ahorro', 'vault', 'treasury', 'savings'],
      d: [circ(...c, 8.5), circ(...c, 1.75), ...[-90, 30, 150].map((a) => line(polar(...c, 1.75, a), polar(...c, 4.5, a))), ...[-90, 30, 150].map((a) => dot(...polar(...c, 4.5, a))), hinge(7.75), hinge(16.25)],
    };
  })(),

  // ── Bank ──
  // With a badge the bank keeps two columns, pulled left and clear of the badge's clearance at every
  // weight (BANK_B)
  'bank-transfer': { tags: ['transferencia bancaria', 'enviar a cuenta', 'spei', 'bank transfer', 'wire'], d: BANK_B(), badge: badge('arrow-right') },
  'bank-plus': { tags: ['agregar cuenta', 'vincular banco', 'nueva cuenta', 'add bank', 'link account'], d: BANK_B(), badge: badge('plus') },
  // The bank with the engine's info badge, as its transfer and plus (the pediment and base with a row
  // of masked digits lost the columns that say bank, and read as a loading bar)
  'bank-details': { tags: ['datos bancarios', 'número de cuenta', 'clabe', 'bank details', 'account number', 'routing number'], d: BANK_B(), badge: badge('info') },
  // The statement: rows that pair a description with an amount, ruled off by a double line
  'account-statement': {
    tags: ['estado de cuenta', 'movimientos', 'saldo', 'account statement', 'bank statement'],
    d: [sq(...DOC, SQ), line([7.75, 6.75], [11.25, 6.75]), line([14.25, 6.75], [16.25, 6.75]), line([7.75, 10.25], [11.25, 10.25]), line([14.25, 10.25], [16.25, 10.25]), line([7.75, 14], [16.25, 14]), line([7.75, 17], [16.25, 17])],
  },
  'account-statement-check': (() => ({
    tags: ['conciliación', 'conciliar cuenta', 'estado de cuenta revisado', 'reconcile', 'reconciled statement'],
    d: [sq(...DOC, SQ), line([7.75, 6.75], [11.25, 6.75]), line([14.25, 6.75], [16.25, 6.75]), line([7.75, 10.25], [11.25, 10.25]), line([14.25, 10.25], [16.25, 10.25]), line([7.75, 14], [16.25, 14]), line([7.75, 17], [16.25, 17])],
    badge: badge('check'),
  }))(),
  // The cheque inside the viewfinder, carrying its signature
  'cheque-scan': {
    tags: ['depositar cheque', 'escanear cheque', 'depósito móvil', 'mobile deposit', 'scan check'],
    d: [sq(6.25, 7.5, 11.5, 9, 2.25, SQ), signature(9.25, 13.5, 0.7), ...FRAME],
  },

  // ── Investing ──
  // The percent sign whose slash runs on into an arrowhead
  'interest-rate': {
    tags: ['tasa de interés', 'rendimiento', 'interés', 'interest rate', 'yield', 'apr'],
    d: [circ(7.75, 7.75, 2.25), circ(16.25, 16.25, 2.25), line([4.5, 19.5], [19.75, 4.25]), head([19.75, 4.25], [1, -1], 4.5)],
  },
  // The open hand of donation, palm up, with a coin above it
  loan: {
    tags: ['préstamo', 'crédito', 'financiamiento', 'loan', 'credit', 'lending'],
    d: [...coin([13.75, 7.25], 5.25, 2.25), icons.donation.d[1], icons.donation.d[2]],
  },
  // The dial in four segments (20° gaps) and the needle at the high end, on its pivot
  'credit-score': (() => {
    const c = [12, 15.5];
    return {
      tags: ['historial crediticio', 'buró de crédito', 'puntaje', 'credit score', 'credit rating'],
      d: [...[180, 230, 280, 330].map((a) => arc(...c, 9, a, a + 30).d), circ(...c, 1.75), line(polar(...c, 1.75, 340), polar(...c, 6, 340))],
    };
  })(),
  // The briefcase of the core set with a rising line across its body
  portfolio: {
    tags: ['portafolio de inversión', 'inversiones', 'cartera de valores', 'portfolio', 'investments'],
    d: [NU.briefcase.d[0], NU.briefcase.d[1], roundline([[6.25, 16.75], [10, 13], [13, 15.5], [17.75, 10.75]], [0, 1, 1, 0])],
  },
  // The bond: a landscape certificate carrying the interest it pays (the percent, with dots) and
  // its rosette over the corner, a piece on top. A strip of coupons along its foot made it a grid
  // (too dense at 18 px). The rosette and its ribbon have file-certificate's proportions (the notch
  // 2.25 under the seal: closer, it met the seal at 2.1). The lower dot stays 8.2 from the
  // rosette's center: the engine drops a dot that comes within 8.05 of a round piece of r 3
  bond: (() => {
    const seal = circ(18.25, 15.5, 3);
    const ribbon = roundline([[16.25, 17.74], [16.25, 22], [18.25, 20.75], [20.25, 22], [20.25, 17.74]], [0, 0.4, 0.4, 0.4, 0]);
    return {
      tags: ['bono', 'renta fija', 'deuda', 'bond', 'fixed income', 'coupon'],
      d: [sq(2.5, 3.75, 19, 14, 3.25, SQ), ...percentDots(8.25, 9.75, 2.5, 2.75)],
      badge: own([seal, ribbon], `${seal}${ribbon}Z`, { solid: [seal, `${ribbon}Z`] }),
    };
  })(),
  // The bull: its head, the horns curving up, the eyes and the muzzle
  'bull-market': {
    tags: ['mercado alcista', 'alza', 'toro', 'bull market', 'bullish', 'rally'],
    d: [
      roundpoly([[6.75, 8.75], [17.25, 8.75], [16, 19.75], [8, 19.75]], [2.5, 2.5, 3, 3]),
      'M7.1 10.25C4.5 10.25 2.75 8.5 2.75 5',
      flipPath('M7.1 10.25C4.5 10.25 2.75 8.5 2.75 5', 'x'),
      dot(10, 12.5),
      dot(14, 12.5),
      line([10.75, 16.75], [13.25, 16.75]),
    ],
  },
  // The bear: a round head, the ears outside it, the snout with its nose and the eyes (dots of r 0.5:
  // the nose stays clear of the snout at bold)
  'bear-market': {
    tags: ['mercado bajista', 'baja', 'oso', 'bear market', 'bearish', 'downturn'],
    d: [circ(12, 13, 7.75), outerArc([12, 13], 7.75, [6, 6.25], 2.75), outerArc([12, 13], 7.75, [18, 6.25], 2.75), circ(12, 15.25, 2.75), dot(12, 15.25, 0.5), dot(8.75, 10.75, 0.5), dot(15.25, 10.75, 0.5)],
  },
  // ── Crypto ──
  // Three blocks on the diagonal, each bar from one corner to the next
  blockchain: (() => {
    const s = 5.5;
    const r = 1.75;
    const at = [2.75, 9.25, 15.75];
    const k = (1 - Math.SQRT1_2) * r;
    return {
      tags: ['cadena de bloques', 'blockchain', 'registro distribuido', 'web3', 'ledger'],
      d: [...at.map((x) => sq(x, x, s, s, r)), line([at[0] + s - k, at[0] + s - k], [at[1] + k, at[1] + k]), line([at[1] + s - k, at[1] + s - k], [at[2] + k, at[2] + k])],
    };
  })(),
  'crypto-token': {
    tags: ['token', 'cripto', 'activo digital', 'crypto token', 'digital asset'],
    d: [circ(12, 12, 9), ...cube(12, 7.31, 4.5, 4.5, 0.9)],
  },
  // With the lock, as on invoice-plus, a smaller cube at the top left, whole and clear of the lock's
  // clearance
  'crypto-token-lock': {
    tags: ['staking', 'tokens bloqueados', 'cripto', 'staking', 'locked tokens'],
    d: [circ(12, 12, 9), ...cube(9.75, 6.25, 2.5, 2.5, 0.6)],
    badge: badge('lock'),
  },
  // Two coins on the diagonal and two arc arrows trading their places (the lower one the upper one
  // turned half a turn)
  'token-swap': (() => {
    const arrow = ['M14.5 4.25H16.5a3 3 0 0 1 3 3V9.5', head([19.5, 9.5], [0, 1], 2.75)];
    return {
      tags: ['intercambiar tokens', 'swap', 'convertir cripto', 'token swap', 'exchange'],
      d: [...coin([7.5, 7.5], 4.5, 1.75), ...coin([16.5, 16.5], 4.5, 1.75), ...arrow, ...arrow.map((d) => turnPath(d, 180))],
    };
  })(),
  // The key of the core set with a hexagonal bow; the shaft starts at the middle of its edge and the
  // hole moves toward the center (the hexagon's flat side came within reach of it at bold)
  'key-crypto': (() => {
    const c = [8.1, 15.9];
    const bow = roundpoly([-75, -15, 45, 105, 165, 225].map((a) => polar(...c, 5, a)), 1);
    const start = polar(...c, 5 * Math.cos(Math.PI / 6), -45);
    return {
      tags: ['llave privada', 'cartera cripto', 'clave', 'private key', 'crypto wallet', 'seed'],
      d: [bow, dot(7.35, 16.65, 0.55), line(start, [20.25, 3.75]), NU.key.d[3], NU.key.d[4]],
    };
  })(),
  // The pickaxe's tip on the coin's rim
  'crypto-mining': {
    tags: ['minería', 'minar cripto', 'prueba de trabajo', 'crypto mining', 'mining', 'proof of work'],
    d: [...coin([6.75, 16.25], 4.75, 2.25), ...PICK],
  },

  // ── Insurance ──
  insurance: {
    tags: ['seguro', 'cobertura', 'póliza', 'protección', 'insurance', 'coverage'],
    d: [CANOPY, ...coin([12, 17.25], 4, 1.75)],
  },
  'insurance-home': {
    tags: ['seguro de casa', 'seguro de hogar', 'vivienda', 'home insurance', 'property insurance'],
    d: [CANOPY, roundline([[6.25, 17.75], [12, 13.25], [17.75, 17.75]], [0, 1, 0]), roundline([[8, 16.38], [8, 21.25], [16, 21.25], [16, 16.38]], [0, 1.5, 0, 0])],
  },
  'insurance-life': {
    tags: ['seguro de vida', 'vida', 'salud', 'life insurance', 'health'],
    d: [CANOPY, heart(12, 15.75, 9)],
  },
  // The car from the front, small: body, cabin and tires
  'insurance-car': {
    tags: ['seguro de auto', 'seguro de coche', 'vehículo', 'car insurance', 'auto insurance'],
    d: [
      CANOPY,
      sq(6, 16.25, 12, 3.5, 1.5),
      roundline([[7.1, 16.25], [8.5, 13.25], [15.5, 13.25], [16.9, 16.25]], [0, 0.9, 0.9, 0]),
      roundline([[7.25, 19.75], [7.25, 21.25], [9.75, 21.25], [9.75, 19.75]], [0, 0.6, 0.6, 0]),
      roundline([[14.25, 19.75], [14.25, 21.25], [16.75, 21.25], [16.75, 19.75]], [0, 0.6, 0.6, 0]),
    ],
  },
  // The paw of lugares, small: the pad and four toes as dots
  'insurance-pet': {
    tags: ['seguro de mascota', 'mascota', 'veterinario', 'pet insurance', 'vet'],
    d: [CANOPY, roundpoly([[10.5, 17.25], [13.5, 17.25], [15.75, 21], [8.25, 21]], [1.5, 1.5, 1.25, 1.25]), dot(7.5, 16), dot(10.25, 13.75), dot(13.75, 13.75), dot(16.5, 16)],
  },
  'insurance-policy': {
    tags: ['póliza de seguro', 'contrato de seguro', 'cobertura', 'insurance policy', 'policy'],
    d: POLICY,
  },
  'insurance-claim': {
    tags: ['reclamación', 'siniestro', 'reportar daño', 'insurance claim', 'file a claim'],
    d: POLICY,
    badge: badge('edit'),
  },

  // ── Accounting ──
  ledger: {
    tags: ['libro mayor', 'contabilidad', 'libro contable', 'ledger', 'bookkeeping', 'accounts'],
    d: LEDGER,
  },
  // The ledger with its first column ending 7.6 from the badge's center (clear of the magnifier's
  // clearance at every weight)
  'ledger-search': {
    tags: ['auditoría', 'revisar cuentas', 'contabilidad', 'audit', 'financial audit'],
    d: [LEDGER[0], LEDGER[1], line([11.75, 6.25], [11.75, 11.75]), LEDGER[3]],
    badge: badge('search'),
  },
  // The T account: a line across the top and one down the middle, two entries on each side
  'balance-sheet': {
    tags: ['balance general', 'activos y pasivos', 'cuenta T', 'balance sheet', 'assets', 'liabilities'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, SQ), line([3.25, 7.75], [20.75, 7.75]), line([12, 7.75], [12, 20.75]), line([6.25, 11.25], [8.75, 11.25]), line([6.25, 14.75], [8.75, 14.75]), line([15.25, 11.25], [17.75, 11.25]), line([15.25, 14.75], [17.75, 14.75])],
  },
  // A plus row and a minus row above a double rule (the result)
  'income-statement': {
    tags: ['estado de resultados', 'pérdidas y ganancias', 'utilidad', 'income statement', 'profit and loss', 'p&l'],
    d: [sq(...DOC, SQ), ...glyph('plus', [9.25, 7.25], 1.5), line([13.75, 7.25], [16.25, 7.25]), ...glyph('minus', [9.25, 11.75], 1.5), line([13.75, 11.75], [16.25, 11.75]), line([8.25, 15], [15.75, 15]), line([8.25, 18], [15.75, 18])],
  },
  // A dollar coin and the ring around it, drawn as far as the budget is spent (a value)
  budget: {
    tags: ['presupuesto', 'gasto', 'límite', 'budget', 'spending limit', 'allowance'],
    d: [arc(12, 12, 9.25, -90, 180).d, ...coinDollar([12, 12], 6.25)],
  },
  // A receipt in front of a page (the engine clears the page around it)
  'expense-report': {
    tags: ['reporte de gastos', 'comprobación de gastos', 'viáticos', 'expense report', 'expenses'],
    d: [sq(3.25, 2.75, 12.5, 16, 3, SQ), line([6.25, 6.25], [12.75, 6.25])],
    badge: (() => {
      const r = receipt(10.25, 9.75, 10.5, 11.5, 4, 1.25, 2.5);
      const lines = [line([13.25, 13], [17.75, 13]), line([13.25, 16], [15.75, 16])];
      return own([r, ...lines], r, { solid: [r], cut: lines });
    })(),
  },
  // The sign between money coming in and going out
  'cash-flow': {
    tags: ['flujo de efectivo', 'entradas y salidas', 'liquidez', 'cash flow', 'money in and out'],
    d: [...dollar(12, 12, 14, 6.5, 1.75), line([4, 19.5], [4, 4.5]), head([4, 4.5], [0, -1], 2.75), line([20, 4.5], [20, 19.5]), head([20, 19.5], [0, 1], 2.75)],
  },
  // Revenue and cost crossing over the axes, a dot where they meet
  'break-even': (() => {
    const [a0, a1, b0, b1] = [[6.25, 17.75], [20.25, 4.75], [6.25, 12.25], [20.25, 9.25]];
    const t = (b0[1] - a0[1]) / (a1[1] - a0[1] - (b1[1] - b0[1]));
    return {
      tags: ['punto de equilibrio', 'costos e ingresos', 'rentabilidad', 'break-even', 'breakeven point'],
      d: [line([3.25, 3.25], [3.25, 20.75], [20.75, 20.75]), line(a0, a1), line(b0, b1), dot(a0[0] + t * (a1[0] - a0[0]), a0[1] + t * (a1[1] - a0[1]))],
    };
  })(),
  'tax-return': {
    tags: ['declaración de impuestos', 'declaración anual', 'sat', 'tax return', 'file taxes'],
    d: [sq(...DOC, SQ), ...percent(12, 12, 3, 1.35, 3.25)],
  },

  // ── The shop floor ──
  // The dress form: neck cap, torso (shoulders, waist, hips), the pole and its tripod
  mannequin: {
    tags: ['maniquí', 'aparador', 'exhibidor', 'mannequin', 'dress form', 'window display'],
    d: [
      'M10.5 4.75C8 5 6.25 5.75 6.25 7.75C6.25 9.5 8.5 10 8.5 11.75C8.5 13 7.25 13.75 7.25 15.25H16.75C16.75 13.75 15.5 13 15.5 11.75C15.5 10 17.75 9.5 17.75 7.75C17.75 5.75 16 5 13.5 4.75Z',
      'M10.75 4.83V3.75a1.25 1.25 0 0 1 2.5 0V4.83',
      line([12, 15.25], [12, 21.25]),
      line([7.75, 21.25], [12, 18.75], [16.25, 21.25]),
    ],
  },
  // The curtain hung from the rail and drawn to one side: two folds down it and a scalloped hem
  'fitting-room': {
    tags: ['probador', 'vestidor', 'cortina', 'fitting room', 'changing room'],
    d: [line([2.75, 3.25], [21.25, 3.25]), `M3.75 3.25H13.25V20.25${scallops(3.75, 13.25, 20.25, 3, 1)}Z`, line([6.92, 6.25], [6.92, 17.25]), line([10.08, 6.25], [10.08, 17.25])],
  },
  // The kiosk: a screen tilted back on a short neck over the scanning ledge (at waist height, wider
  // than the cabinet it stands on)
  'self-checkout': {
    tags: ['autocobro', 'caja de autoservicio', 'quiosco', 'self-checkout', 'kiosk'],
    d: [tilted([12, 6.25], 6.25, 3.75, -6, 1.5), line([12, 10.05], [12, 12.75]), line([3.25, 12.75], [20.75, 12.75]), roundline([[7.75, 12.75], [7.75, 21.25], [16.25, 21.25], [16.25, 12.75]], [0, 2, 0, 0])],
  },
  // The cabinet: the glass window ruled into a two-by-two grid of product slots, the pickup flap at
  // its foot
  // and the coin slot beside the glass
  'vending-machine': {
    tags: ['máquina expendedora', 'snacks', 'autoservicio', 'vending machine', 'snack machine'],
    d: [sq(4.75, 2.75, 14.5, 18.5, 3, SQ), sq(7.25, 6, 6, 8.25, 1.25), line([7.25, 10.13], [13.25, 10.13]), line([10.25, 6], [10.25, 14.25]), line([8, 17.5], [12.5, 17.5]), line([16.25, 6.25], [16.25, 9.25])],
  },
  // The printer (its top corners square, as card-insert's reader) and, on top of it, the receipt
  // rising from its slot, torn edge up
  'receipt-printer': {
    tags: ['impresora de tickets', 'ticket', 'punto de venta', 'receipt printer', 'pos printer'],
    d: [sq(3.25, 10.75, 17.5, 10.5, 3, { square: ['tl', 'tr', 'br'] })],
    badge: (() => {
      const [x0, x1, top, slot] = [7.25, 16.75, 2.75, 13.75];
      const teeth = Array.from({ length: 7 }, (_, i) => [x0 + ((i + 1) * (x1 - x0)) / 8, i % 2 ? top : top + 1.25]);
      const run = [[x0, slot], [x0, top], ...teeth, [x1, top], [x1, slot]];
      const paper = line(...run);
      const text = line([10.25, 7.25], [13.75, 7.25]);
      const lip = line([6.25, slot], [17.75, slot]);
      const body = `${line(...run)}Z`;
      return own([paper, text, lip], body, { solid: [body], cut: [text], wire: [lip] });
    })(),
  },
  // The tablet on its stand, tilted toward the customer, with the camera dot of dispositivos' tablet
  // 3.5 in from its short side (without it, it read as a monitor)
  'checkout-tablet': {
    tags: ['punto de venta en tableta', 'terminal', 'caja', 'tablet pos', 'point of sale'],
    d: [tilted([12, 8.75], 8, 5.25, -10, 2.25), line([12, 14.2], [12, 20.75]), line([7.75, 20.75], [16.25, 20.75]), dot(...add([12, 8.75], rot([-4.5, 0], [0, 0], -10)), 0.55)],
  },
  // The tailor's tape: the band with its ticks and the roll it winds into
  'size-guide': {
    tags: ['guía de tallas', 'medidas', 'cinta métrica', 'size guide', 'measurements', 'size chart'],
    d: [circ(16.25, 12, 5), circ(16.25, 12, 1.75), roundline([[11.25, 12], [2.75, 12], [2.75, 17], [16.25, 17]], [0, 1, 1, 0]), line([5.25, 12], [5.25, 14]), line([8.25, 12], [8.25, 14])],
  },

  // ── Store ──
  // With a badge the store keeps its awning and body and loses its door, which the badge cut to a
  // hook beside it
  'store-clock': { tags: ['horario', 'horas de apertura', 'abierto', 'store hours', 'opening times'], d: icons.store.d.slice(0, 2), badge: badge('clock') },
  // The store with its rolling shutter down: slats across the front instead of the door
  'store-closed': {
    tags: ['tienda cerrada', 'cerrado', 'cortina', 'store closed', 'closed', 'shutter'],
    d: [icons.store.d[0], icons.store.d[1], line([4.75, 13.75], [19.25, 13.75]), line([4.75, 17.25], [19.25, 17.25])],
  },
  'store-search': { tags: ['buscar tienda', 'sucursales', 'localizador', 'store locator', 'find a store'], d: icons.store.d.slice(0, 2), badge: badge('search') },
  // The phone with the store's awning across its screen and the door at its foot
  'store-mobile': {
    tags: ['tienda en app', 'compras móviles', 'app de compras', 'mobile store', 'shopping app'],
    d: [sq(6.25, 2.75, 11.5, 18.5, 3.25, SQ), line([6.25, 8.75], [17.75, 8.75]), `M17.75 11.25${scallops(6.25, 17.75, 11.25, 3, 1.25)}`, roundline([[10.25, 21.25], [10.25, 17], [13.75, 17], [13.75, 21.25]], [0, 1.25, 1.25, 0])],
  },
  // The mall: the store grown wide, its awning across the whole canvas (five scallops) over an
  // arcade of two arched entrances, 3 from the walls and 3.5 from each other. With a raised center
  // it read as a briefcase (the center its handle); a tall box with the awning on its facade went
  // over the density limit
  'shopping-mall': {
    tags: ['centro comercial', 'plaza', 'tienda departamental', 'shopping mall', 'department store'],
    d: [
      `${roundline([[2.5, 9.25], [4.25, 4.25], [19.75, 4.25], [21.5, 9.25]], [0, 1.25, 1.25, 0])}${scallops(2.5, 21.5, 9.25, 5, 1.5)}Z`,
      roundline([[3.75, 13.75], [3.75, 20.75], [20.25, 20.75], [20.25, 13.75]], [0, 2.25, 0, 0]),
      roundline([[6.75, 20.75], [6.75, 16.5], [10.25, 16.5], [10.25, 20.75]], [0, 1.25, 1.25, 0]),
      roundline([[13.75, 20.75], [13.75, 16.5], [17.25, 16.5], [17.25, 20.75]], [0, 1.25, 1.25, 0]),
    ],
  },
  // The store's awning over a two-by-two grid of stalls (many sellers)
  marketplace: {
    tags: ['marketplace', 'mercado en línea', 'vendedores', 'tiendas', 'marketplace', 'sellers'],
    d: [icons.store.d[0], ...[[4.75, 12.75], [13.5, 12.75], [4.75, 18.5], [13.5, 18.5]].map(([x, y]) => sq(x, y, 5.75, 2.75, 1.1))],
  },
  // One shelf on its brackets (triangles 5 × 3.75: smaller, their holes closed at bold) holding a
  // bottle, a box and a jar
  'retail-shelf': {
    tags: ['anaquel', 'exhibición', 'góndola', 'retail shelf', 'merchandising', 'display shelf'],
    d: [
      line([2.75, 17.25], [21.25, 17.25]),
      roundpoly([[4.25, 17.25], [9.25, 17.25], [4.25, 21]], [0.4, 0.6, 0.6]),
      roundpoly([[19.75, 17.25], [14.75, 17.25], [19.75, 21]], [0.4, 0.6, 0.6]),
      'M3.25 17.25V11.25A2.25 2.25 0 0 1 7.75 11.25V17.25',
      line([5.5, 9], [5.5, 5.75]),
      roundline([[10.75, 17.25], [10.75, 8.25], [14.75, 8.25], [14.75, 17.25]], [0, 1.25, 1.25, 0]),
      roundline([[18, 17.25], [18, 12.75], [21, 12.75], [21, 17.25]], [0, 0, 0, 0]),
      sq(17.75, 9.25, 3.5, 3.5, 1.1),
    ],
  },
  // The rack: the rail and its two legs in one stroke, the wheels, three hangers on it (the middle
  // one in front)
  'clothing-rack': {
    tags: ['perchero', 'rack de ropa', 'exhibidor', 'clothing rack', 'garment rack'],
    d: [
      line([3.5, 19.25], [3.5, 4.75], [20.5, 4.75], [20.5, 19.25]),
      dot(3.5, 20.25),
      dot(20.5, 20.25),
      line([8.25, 4.75], [8.25, 8.25]),
      roundpoly([[8.25, 7.5], [10.5, 10.5], [6, 10.5]], [0.6, 0.6, 0.6]),
      line([15.75, 4.75], [15.75, 8.25]),
      roundpoly([[15.75, 7.5], [18, 10.5], [13.5, 10.5]], [0.6, 0.6, 0.6]),
    ],
    badge: (() => {
      const tri = roundpoly([[12, 7.5], [14.25, 10.5], [9.75, 10.5]], [0.6, 0.6, 0.6]);
      const hook = line([12, 4.75], [12, 8.25]);
      return own([hook, tri], tri, { solid: [tri], wire: [hook] });
    })(),
  },
  // The glass case on its counter, a gem inside it (a slanted front over a box read as an open box,
  // and a glint beside an item as a picture). The gem's girdle runs 3 under its table, so the band
  // between them stays open, and knocked out stays ink, at every weight
  'display-case': {
    tags: ['vitrina', 'mostrador', 'exhibidor', 'display case', 'showcase', 'counter'],
    d: [
      sq(3.25, 2.75, 17.5, 12.5, 2.5, SQ),
      roundpoly([[10, 6], [14, 6], [16, 9], [12, 12.75], [8, 9]], 0.6),
      line([8.5, 9], [15.5, 9]),
      roundline([[6.25, 15.25], [6.25, 21.25], [17.75, 21.25], [17.75, 15.25]], [0, 2, 0, 0]),
    ],
  },
  // The two pedestals at a store's exit, a signal arc from each toward the other
  'anti-theft-gate': {
    tags: ['antenas antirrobo', 'seguridad', 'alarma', 'anti-theft gate', 'security gate', 'eas'],
    d: [sq(2.75, 3.25, 3.5, 18, 1.75), sq(17.75, 3.25, 3.5, 18, 1.75), arc(4.5, 12, 5.5, -30, 30).d, arc(19.5, 12, 5.5, 150, 210).d],
  },

  // ── Products ──
  // The bag twice at three quarters: the one in front clears the one behind, handle included, and its
  // clearance takes the back bag's corner well inside
  'shopping-bags': (() => {
    const back = bag().map((d) => transform(d, 0.75, -0.44, 0.31));
    const front = bag().map((d) => transform(d, 0.75, 6.44, 4.75));
    return {
      tags: ['compras', 'mis pedidos', 'bolsas', 'shopping', 'purchases', 'orders'],
      d: back,
      badge: own(front, `${front[0]}${shut(front[1])}`, { solid: [front[0]], wire: [front[1]] }),
    };
  })(),
  // Two boxes stacked (the smaller upper one standing on the lower) and the strap around both
  'product-bundle': {
    tags: ['paquete de productos', 'kit', 'combo', 'product bundle', 'bundle', 'kit'],
    d: [sq(3.25, 12.25, 17.5, 9, 2.5, SQ), roundline([[6.25, 12.25], [6.25, 4.5], [17.75, 4.5], [17.75, 12.25]], [0, 2, 2, 0]), line([10.5, 4.5], [10.5, 21.25]), line([13.5, 4.5], [13.5, 21.25])],
  },
  // The product (the core box) and its options beside it, three swatches in a column 2.95 apart and
  // 2.85 from the box: copies of the box, cascading or fanned, read as duplicate or as wings
  'product-variants': {
    tags: ['variantes', 'opciones de producto', 'versiones', 'product variants', 'options', 'sku'],
    d: [...cube(9, 4.5, 6.5, 7.5, 1.4), ...[6.25, 12, 17.75].map((y) => circ(19.75, y, 1.4))],
  },
  // The gift box with its lid lifted off above it (the gift's lid, ribbon and bow)
  'gift-open': {
    tags: ['abrir regalo', 'canjear', 'recompensa', 'open gift', 'redeem', 'unwrap'],
    d: [sq(4.5, 13, 15, 8.25, 2.5, SQ), line([12, 13], [12, 21.25]), sq(3, 6.25, 18, 3.75, 1.5), line([12, 6.25], [12, 10]), leaf([12, 6.25], [8.5, 3.25], 2.5), leaf([15.5, 3.25], [12, 6.25], 2.5)],
  },
  // The phone and the coin on the diagonal, two arc arrows trading their places
  'trade-in': {
    tags: ['plan renove', 'cambiar usado', 'crédito por equipo', 'trade-in', 'trade in'],
    d: [sq(3.25, 2.75, 7, 9.25, 2, SQ), ...coin([16.75, 16.75], 4.5, 2.25), 'M13.5 4.25H16.5a3 3 0 0 1 3 3V9.25', head([19.5, 9.25], [0, 1], 2.75), 'M9.75 19.75H7.25a2.75 2.75 0 0 1-2.75-2.75V15', head([4.5, 15], [0, -1], 2.75)],
  },
  // The core globe whole and, in front of its lower right, the dollar coin (the smallest that
  // carries its sign): a coin with only a ring read as a target on a ball
  'global-payment': {
    tags: ['pago internacional', 'vender al extranjero', 'divisas', 'global payment', 'cross-border', 'international'],
    d: NU.globe.d,
    badge: (() => {
      const c = coinDollar([15.5, 15.5], 6.25);
      return own(c, c[0], { solid: [c[0]], cut: c.slice(1) });
    })(),
  },
});

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index into d: `solid` is filled and keeps its stroke, `cut` is knocked out at the stroke
// width, `lines` stays a line with 1.5 of clearance and `wire` stays a line attached to the fill
// (handles, legs, wicks, stems, shelves). A number is a stroke of d; a string, a fill-only stroke
// (the bag's mouth, the hollow eyelet, the house body without the eave). Only closed shapes go in
// `solid`: `z(i)` closes an open body of the outline (the store's, the gift box, the boxes on the
// shelf) along an edge that is already solid or knocked out.
const HOLE = dot(...T.hole, 0.3);
const z = (i) => ({ z: i });
const FILL = {
  'cart-full': { solid: [4, 5] },
  'cart-plus': { cut: [4, 5] },
  'cart-minus': { cut: [4] },
  'cart-check': { cut: [4] },
  'cart-remove': { cut: [4, 5] },
  'cart-arrow-down': { cut: [4, 5] },
  bag: { solid: [0], lines: [1] },
  'bag-plus': { solid: [0], lines: [1], cut: [2, 3] },
  'bag-minus': { solid: [0], lines: [1], cut: [2] },
  'bag-check': { solid: [0], lines: [1], cut: [2] },
  'bag-remove': { solid: [0], lines: [1], cut: [2, 3] },
  'bag-heart': { solid: [0], lines: [1], cut: [2] },
  'bag-return': { solid: [0], lines: [1], cut: [2, 3] },
  basket: { solid: [0], lines: [1], cut: [2, 3, 4] },
  // The store: the awning and the body, which closes at the top (3 from the scallops, as in the
  // outline)
  store: { solid: [0, z(1)], cut: [2] },
  // The screen's base and the stall's posts stay lines
  'store-online': { solid: [0], cut: [1, 2], lines: [3] },
  'market-stall': { solid: [0], wire: [1, 2, 3] },
  receipt: { solid: [0], cut: [1, 2, 3] },
  'receipt-tax': { solid: [0], cut: [1, 2, 3] },
  invoice: { solid: [0], cut: [1, 2, 3] },
  'invoice-plus': { solid: [0], cut: [1, 2, 3] },
  'invoice-paid': { solid: [0], cut: [1, 2, 3] },
  'invoice-due': { solid: [0], cut: [1, 2, 3] },
  'price-quote': { solid: [0], cut: [1, 2, 3] },
  // The purchase order, like the clipboard in `archivos` and `edicion`: the board closes under the
  // clip and the lower half of the clip is separated from it by a knocked-out channel (its own
  // outline)
  'purchase-order': { solid: [z(0), 1], cut: [sqOpen(9.75, 2.75, 4.5, 3.25, 1.25, {}, [14.25, 4.25], 1, [9.75, 4.25], 3), 2, 3, 4, 5, 6, 7] },
  'contract-signed': { solid: [0], cut: [1, 2, 3] },
  deal: { solid: [0, 1] },
  // The filled eyelet is a hole: a knocked-out dot
  'price-tag': { solid: [0], cut: [HOLE] },
  'price-tag-percent': { solid: [0], cut: [HOLE, dot(...T.toWorld([13.5, 0]), 0.3), 3] },
  'price-tag-dollar': { solid: [0], cut: [HOLE, 2, 3, 4] },
  percent: { solid: [0, 1], lines: [2] },
  'percent-circle': { solid: [0], cut: [1, 2, 3] },
  discount: { solid: [0], cut: [1, 2, 3] },
  coupon: { solid: [0], cut: [1, 2, 3] },
  wallet: { solid: [0], cut: [1, 2] },
  'wallet-cards': { solid: [0] },
  'card-chip': { solid: [0], cut: [1, 2, 3] },
  'card-contactless': { solid: [0], cut: [1, 2, 3, 4] },
  'card-plus': { solid: [0], cut: [1, 2] },
  'card-check': { solid: [0], cut: [1, 2] },
  'card-declined': { solid: [0], cut: [1, 2] },
  cards: { solid: [0] },
  'loyalty-card': { solid: [0], cut: [1] },
  'gift-card': { solid: [0], cut: [1, 2, 3, 4, 5] },
  // The waves stay lines, with clearance from the phone
  'mobile-payment': { solid: [0], cut: [1], lines: [2, 3] },
  banknote: { solid: [0], cut: [1, 2, 3] },
  // The back bill is a line
  banknotes: { solid: [0], cut: [1, 2, 3], lines: [4] },
  coins: { solid: [0] },
  'currency-dollar': { solid: [0], cut: [1, 2, 3] },
  'currency-euro': { solid: [0], cut: [1, 2, 3] },
  'currency-pound': { solid: [0], cut: [1, 2] },
  'currency-yen': { solid: [0], cut: [1, 2, 3, 4] },
  'currency-bitcoin': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'currency-rupee': { solid: [0], cut: [1, 2, 3] },
  // The bank: the pediment filled; the columns and the base stay lines, with their clearance
  bank: { solid: [0], lines: [1, 2, 3, 4] },
  // The piggy bank: the ear closes against the back; the legs, attached to the body
  'piggy-bank': { solid: [0, z(1), 3], cut: [2], wire: [4, 5] },
  'safe-box': { solid: [0], cut: [1, 2, 3, 4, 5], wire: [6, 7] },
  atm: { solid: [0], cut: [1] },
  cheque: { solid: [0], cut: [1, 2, 3] },
  // The house: the whole body (covering the walls); the eave stays a line, attached to it
  mortgage: { solid: [HOUSE], wire: [0], cut: [2, 3, 4] },
  // The candles: the bodies filled and the wicks attached to them
  stocks: { solid: [0, 3, 6], wire: [1, 2, 4, 5, 7, 8] },
  'secure-payment': { solid: [0], cut: [1, 2, 3] },
  'tip-jar': { solid: [0], lines: [1], cut: [2, 3, 4] },
  // The hand closes along the edge of the cuff
  donation: { solid: [0, 1, z(2)] },
  'reward-points': { solid: [0], cut: [1] },
  'cash-register': { solid: [0, 1], wire: [2], cut: [3, 4, 5, 6, 7, 8] },
  // The terminal: the ticket closes along the top edge
  'payment-terminal': { solid: [0, z(1)], cut: [2, 3, 4, 5, 6, 7, 8] },
  calculator: { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] },
  'qr-code': { solid: [0, 1, 2, 3, 7], cut: [4, 5, 6] },
  'qr-scan': { solid: [0, 1, 2, 3], lines: [4, 5, 6, 7] },
  // The gift: the box closes under the lid and is separated from it by its knocked-out edge
  gift: { solid: [z(0), 1, 3, 4], cut: [2, 'M4.5 12.25H19.5'] },
  parcel: { solid: [0], cut: [1, 2, 3, 4] },
  'parcel-check': { solid: [0], cut: [1, 2] },
  'parcel-return': { solid: [0], cut: [1, 2] },
  'delivery-time': { solid: [0], cut: [1, 2] },
  // The truck: the cab closes against the cargo box and is separated from it by its knocked-out
  // edge; the speed lines stay lines
  truck: { solid: [0, z(1), 2, 3], cut: ['M14.5 7.5V14'] },
  'truck-fast': { solid: [0, z(1), 2, 3], cut: ['M16 7.5V14'], lines: [4, 5] },
  'home-delivery': { solid: [HOUSE], wire: [0], cut: [2, 3, 4] },
  'pickup-point': { solid: [0], cut: [1, 2, 3] },
  // The scale: the plate and its stem stay lines, attached to the body
  'weighing-scale': { solid: [0], wire: [1, 2], cut: [3, 4] },
  gem: { solid: [0], cut: [1, 2] },
  crown: { solid: [0, 2, 3, 4], cut: [1] },
  // The medal: the ribbons stay lines, attached to it
  medal: { solid: [0], cut: [1], wire: [2, 3] },
  gavel: { solid: [0, 2], wire: [1] },
  // The stamp: the neck is filled whole (covering its two lines); the base stays a line
  'rubber-stamp': { solid: [0, 'M10.5 7.25L10 11.75H14L13.5 7.25Z', 3], lines: [4] },
  // The shelving unit and the pallet: the boxes close over their shelf; the posts, the shelves and
  // the boards stay lines, attached to them
  inventory: { solid: [z(4), z(5), z(6)], wire: [0, 1, 2, 3] },
  pallet: { solid: [z(0), z(1)], wire: [2, 3, 4, 5, 6] },
  shirt: { solid: [0] },
  // ── Round 4 ──
  'payment-split': { solid: [0, 2], cut: [1, 3] },
  'card-clock': { solid: [0], cut: [1, 2] },
  'cash-in': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'cash-out': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  // The speed lines stay lines, with clearance from the coin
  'instant-payment': { solid: [0], cut: [1, 2, 3], lines: [4, 5, 6] },
  'cash-on-delivery': { solid: [0], cut: [1, 2] },
  // The card closes along the slot (its edge falls under the slot's clearance); the arrow stays a line
  'card-insert': { solid: [z(0)], cut: [1, 2], lines: [3, 4] },
  'card-swipe': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'card-lock': { solid: [0], cut: [1, 2] },
  'card-back': { solid: [0], cut: [1, 2, 3, 4] },
  'card-scan': { solid: [0], cut: [1], lines: [2, 3, 4, 5] },
  'card-alert': { solid: [0], cut: [1, 2] },
  'card-gear': { solid: [0], cut: [1, 2] },
  'card-pin': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'wallet-plus': { solid: [0], cut: [1, 2] },
  // The straps close against the watch's edge; the waves stay lines
  'watch-payment': { solid: [0, z(1), z(2)], lines: [3, 4] },
  'mobile-top-up': { solid: [0], cut: [1] },
  'express-checkout': { solid: [0], lines: [1], cut: [2] },
  'bag-sync': { solid: [0], lines: [1] },
  'bag-exchange': { solid: [0], lines: [1], cut: [2, 3, 4, 5] },
  'bag-clock': { solid: [0], lines: [1] },
  'cart-discount': { cut: [4, 5, 6] },
  'cart-clock': {},
  'pricing-plans': { solid: [0, 2], cut: [1, 3] },
  'price-tag-arrow-down': { solid: [0], cut: [HOLE] },
  cashback: { solid: [0, 1], lines: [2, 3, 4] },
  // The paddle: the plate and the handle (closed along the plate) filled, the chevron knocked out
  auction: { solid: [0, z(1)], cut: [2, 3, 4] },
  'invoice-recurring': { solid: [0], cut: [1, 2, 3] },
  'invoice-minus': { solid: [0], cut: [1, 2, 3] },
  'receipt-scan': { solid: [0], cut: [1, 2, 3], lines: [4, 5, 6, 7] },
  'receipt-clock': { solid: [0], cut: [1, 2] },
  // The cash box: the handle stays a line, attached to the lid
  'cash-box': { solid: [0], cut: [1, 3], wire: [2] },
  // The purse: the pouch and the frame close along their common chord; the knobs filled
  // The purse: the pouch (closed along the mouth), the frame and the knobs filled; the mouth knocked
  // out clean through, past both corners, so frame and pouch part the same way at every weight
  'coin-purse': { solid: [z(0), 2, 3], wire: [1] },
  // The wing closes along the bill's edge
  'money-wings': { solid: [0, z(2)], cut: [1] },
  // The vault: the door and its hinges (closed along the door) filled, the wheel knocked out
  vault: { solid: [0, z(8), z(9)], cut: [1, 2, 3, 4, 5, 6, 7] },
  // The bank: the pediment filled; the columns and the base stay lines
  'bank-transfer': { solid: [0], lines: [1, 2, 3] },
  'bank-plus': { solid: [0], lines: [1, 2, 3] },
  'bank-details': { solid: [0], lines: [1, 2, 3] },
  'account-statement': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'account-statement-check': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'cheque-scan': { solid: [0], cut: [1], lines: [2, 3, 4, 5] },
  'interest-rate': { solid: [0, 1], lines: [2, 3] },
  // The loan: the coin filled with its sign knocked out; the hand closes along the cuff
  loan: { solid: [0, 2, z(3)], cut: [1] },
  // The score: the pivot filled and the needle attached to it; the dial stays lines
  'credit-score': { solid: [4], wire: [5], lines: [0, 1, 2, 3] },
  portfolio: { solid: [0], lines: [1], cut: [2] },
  bond: { solid: [0], cut: [1, 2, 3] },
  // The bull: the head filled, the horns attached to it, the nostrils knocked out
  'bull-market': { solid: [0], wire: [1, 2], cut: [3, 4, 5] },
  // The bear: the head and the ears (closed through the head) filled; snout, nose and eyes cut
  'bear-market': { solid: [0, z(1), z(2)], cut: [3, 4, 5, 6] },
  // The blocks filled and the bars between them attached
  blockchain: { solid: [0, 1, 2], wire: [3, 4] },
  'crypto-token': { solid: [0], cut: [1, 2, 3] },
  'crypto-token-lock': { solid: [0], cut: [1, 2, 3] },
  'token-swap': { solid: [0, 2], cut: [1, 3], lines: [4, 5, 6, 7] },
  'key-crypto': { solid: [0], wire: [2, 3, 4], cut: [1] },
  // The pickaxe: its head filled, the handle attached; the coin's ring knocked out
  'crypto-mining': { solid: [0, 2], cut: [1], wire: [3] },
  insurance: { solid: [0, 1], cut: [2] },
  'insurance-life': { solid: [0, 1] },
  // The car: the body, the cabin and the tires filled (closed along the body)
  'insurance-car': { solid: [0, 1, z(2), z(3), z(4)], cut: ['M7.1 16.25H16.9'] },
  'insurance-pet': { solid: [0, 1, 2, 3, 4, 5] },
  'insurance-policy': { solid: [0], cut: [1, 2, 3] },
  'insurance-claim': { solid: [0], cut: [1, 2, 3] },
  ledger: { solid: [0, z(1)], cut: [2, 3, 'M7.75 2.75V21.25'] },
  'ledger-search': { solid: [0, z(1)], cut: [2, 3, 'M7.75 2.75V21.25'] },
  'balance-sheet': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'income-statement': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] },
  // The budget: the coin filled with its sign knocked out; the ring stays a line
  budget: { solid: [1], cut: [2, 3, 4], lines: [0] },
  'expense-report': { solid: [0], cut: [1] },
  'tax-return': { solid: [0], cut: [1, 2, 3] },
  // The dress form: the torso and the neck filled, the stand attached
  mannequin: { solid: [0, z(1)], wire: [2, 3] },
  // The curtain filled with its folds knocked out, hanging from the rail
  'fitting-room': { solid: [1], cut: [2, 3], wire: [0] },
  // The kiosk: the screen and the cabinet (closed along the ledge) filled; neck and ledge attached
  'self-checkout': { solid: [0, z(3)], wire: [1, 2] },
  'vending-machine': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'receipt-printer': { solid: [0] },
  'checkout-tablet': { solid: [0], wire: [1, 2], cut: [3] },
  // The tape: the roll and the band (closed through the roll) filled; the hub and ticks cut
  'size-guide': { solid: [0, z(2)], cut: [1, 3, 4] },
  'store-clock': { solid: [0, z(1)] },
  'store-closed': { solid: [0, z(1)], cut: [2, 3] },
  'store-search': { solid: [0, z(1)] },
  'store-mobile': { solid: [0], cut: [1, 2, 3] },
  // The mall: the awning and the body (closed along its top, as the store's) filled, the entrances cut
  'shopping-mall': { solid: [0, z(1)], cut: [2, 3] },
  marketplace: { solid: [0, 1, 2, 3, 4] },
  // The shelf: the brackets and the products (closed along the shelf) filled; shelf and neck attached
  'retail-shelf': { solid: [1, 2, z(3), z(5), z(6), 7], wire: [0, 4] },
  'clothing-rack': { solid: [1, 2, 4, 6], wire: [0, 3, 5] },
  // The case: the glass case and its counter (closed along the case) filled, the gem knocked out
  'display-case': { solid: [0, z(3)], cut: [1, 2] },
  'anti-theft-gate': { solid: [0, 1], lines: [2, 3] },
  'shopping-bags': { solid: [0], lines: [1] },
  // The boxes filled (the upper one closed along the lower) and separated; the strap knocked out
  'product-bundle': { solid: [0, z(1)], cut: [2, 3, 'M6.25 12.25H17.75'] },
  // The box filled with its edges knocked out, the swatches filled
  'product-variants': { solid: [0, 3, 4, 5], cut: [1, 2] },
  'gift-open': { solid: [0, 2, 4, 5], cut: [1, 3] },
  'trade-in': { solid: [0, 1], cut: [2], lines: [3, 4, 5, 6] },
  'global-payment': { solid: [0], cut: [1, 2] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : typeof i === 'object' ? shut(d[i.z]) : i));
  if (name.startsWith('cart-')) {
    icons[name].fill = cartFill(d, pick(spec.cut), pick(spec.solid));
    continue;
  }
  icons[name].fill = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}
icons.cart.fill = cartFill(icons.cart.d);
// The money bag: the neck closes along the mouth, which is knocked out so the knot reads
{
  const d = icons['money-bag'].d;
  const yo = Number(d[0].match(/^M[\d.]+ ([\d.]+)/)[1]);
  icons['money-bag'].fill = { solid: [d[0], shut(d[1])], cut: [`M9.6 ${N(yo)}H14.4`, d[2], d[3], d[4]] };
}
// The tags: the back one stays a line
{
  const d = icons['price-tags'].d;
  const hole = d[1].match(/^M([\d.]+) ([\d.]+)A([\d.]+)/);
  icons['price-tags'].fill = { solid: [d[0]], cut: [dot(Number(hole[1]) + Number(hole[3]), Number(hole[2]), 0.3)], lines: [d[2]] };
}
// The gold bars are separated by knocking out the bottom edge of the upper one
icons['gold-bars'].fill = { solid: icons['gold-bars'].d, cut: ['M8.75 13.25H15.25'] };
// The open package: the front faces and the flaps filled (closed along the edges of the opening);
// the opening and the edge, knocked out
{
  const d = icons['parcel-open'].d;
  icons['parcel-open'].fill = { solid: [shut(d[0]), d[1], shut(d[3]), shut(d[4])], cut: [d[1], d[2]] };
}
// Investment: the leaves filled; the sign stays a line, attached to them
{
  const d = icons.investment.d;
  icons.investment.fill = { solid: [d[3], d[4]], wire: [d[0], d[1], d[2]] };
}
// The balance: the pans filled; the post, the base, the beam and the strings stay lines
{
  const d = icons['balance-scale'].d;
  icons['balance-scale'].fill = { solid: [d[4], d[6]], wire: [d[0], d[1], d[2], d[3], d[5]] };
}
// The warehouse: the whole body (covering the walls); the eave stays a line, attached to it; the
// rolling door knocked out
{
  const d = icons.warehouse.d;
  const body = roundpoly(
    [
      [4.5, 8.34],
      [12, 4],
      [19.5, 8.34],
      [19.5, 20.75],
      [4.5, 20.75],
    ],
    [0, 1.25, 0, 0, 2.25],
  );
  icons.warehouse.fill = { solid: [body], wire: [d[0]], cut: [d[2], d[3], d[4]] };
}
// The hanger: the triangle filled and the hook, which stays a line attached to it
icons.hanger.fill = { solid: [icons.hanger.d[0]], wire: [icons.hanger.d[1]] };
// Only open lines: their fill is the outline itself
for (const name of ['contactless', 'dollar', 'currency-exchange', 'revenue-up', 'revenue-down', 'recurring-payment', 'refund', 'barcode', 'barcode-scan']) icons[name].fill = false;

// ── Named parts (emitted as data-part) ────────────────────────────────────────────────────────
const PARTS = {
  cart: { basket: [0], handle: [1], wheels: [2, 3] },
  'cart-full': { basket: [0], handle: [1], wheels: [2, 3], items: [4, 5] },
  'cart-plus': { basket: [0], handle: [1], wheels: [2, 3], mark: [4, 5] },
  'cart-minus': { basket: [0], handle: [1], wheels: [2, 3], mark: [4] },
  'cart-check': { basket: [0], handle: [1], wheels: [2, 3], mark: [4] },
  'cart-remove': { basket: [0], handle: [1], wheels: [2, 3], mark: [4, 5] },
  'cart-arrow-down': { basket: [0], handle: [1], wheels: [2, 3], arrow: [4, 5] },
  bag: { body: [0], handle: [1] },
  'bag-plus': { body: [0], handle: [1], mark: [2, 3] },
  'bag-minus': { body: [0], handle: [1], mark: [2] },
  'bag-check': { body: [0], handle: [1], mark: [2] },
  'bag-remove': { body: [0], handle: [1], mark: [2, 3] },
  'bag-heart': { body: [0], handle: [1], heart: [2] },
  'bag-return': { body: [0], handle: [1], arrow: [2, 3] },
  basket: { body: [0], handle: [1], slats: [2, 3, 4] },
  store: { awning: [0], body: [1], door: [2] },
  'store-online': { screen: [0], awning: [1], door: [2], base: [3] },
  'market-stall': { awning: [0], posts: [1, 2], counter: [3] },
  receipt: { body: [0], lines: [1, 2, 3] },
  'receipt-tax': { body: [0], mark: [1, 2, 3] },
  invoice: { body: [0], mark: [1, 2, 3] },
  'invoice-plus': { body: [0], mark: [1, 2, 3] },
  'invoice-paid': { body: [0], mark: [1, 2, 3] },
  'invoice-due': { body: [0], mark: [1, 2, 3] },
  'price-quote': { body: [0], mark: [1, 2, 3] },
  'purchase-order': { body: [0], clip: [1], lines: [2, 3, 4, 5, 6, 7] },
  'contract-signed': { body: [0], lines: [1, 2], signature: [3] },
  deal: { hand: [0], cuff: [1] },
  'price-tag': { body: [0], hole: [1] },
  'price-tags': { body: [0], hole: [1], back: [2] },
  'price-tag-percent': { body: [0], hole: [1], mark: [2, 3] },
  'price-tag-dollar': { body: [0], hole: [1], mark: [2, 3, 4] },
  discount: { seal: [0], mark: [1, 2, 3] },
  coupon: { body: [0], mark: [1, 2, 3] },
  wallet: { body: [0], flap: [1, 2] },
  'wallet-cards': { card: [0] },
  'card-chip': { body: [0], chip: [1, 2], number: [3] },
  'card-contactless': { body: [0], chip: [1, 2], level: [3, 4] },
  'card-plus': { body: [0], stripe: [1, 2] },
  'card-check': { body: [0], stripe: [1, 2] },
  'card-declined': { body: [0], stripe: [1, 2] },
  cards: { card: [0] },
  contactless: { level: [0, 1, 2, 3] },
  'mobile-payment': { body: [0], speaker: [1], level: [2, 3] },
  'money-bag': { body: [0], neck: [1], mark: [2, 3, 4] },
  coins: { coin: [0] },
  'currency-exchange': { from: [0, 1, 2], to: [3, 4, 5], arrows: [6, 7, 8, 9] },
  'piggy-bank': { body: [0, 1, 2, 4, 5], coin: [3] },
  'safe-box': { body: [0], wheel: [1, 2, 3, 4], handle: [5], feet: [6, 7] },
  atm: { body: [0], slot: [1] },
  mortgage: { roof: [0], walls: [1], mark: [2, 3, 4] },
  investment: { mark: [0, 1, 2], leaves: [3, 4] },
  'revenue-up': { mark: [0, 1, 2], arrow: [3, 4] },
  'revenue-down': { mark: [0, 1, 2], arrow: [3, 4] },
  'recurring-payment': { arrow: [0, 1, 2, 3], mark: [4, 5, 6] },
  refund: { arrow: [0, 1], mark: [2, 3, 4] },
  'secure-payment': { shield: [0], mark: [1, 2, 3] },
  'tip-jar': { body: [0], lid: [1], mark: [2, 3, 4] },
  donation: { heart: [0], cuff: [1], hand: [2] },
  'reward-points': { body: [0], star: [1] },
  gift: { body: [0], lid: [1], ribbon: [2], bow: [3, 4] },
  parcel: { body: [0], edges: [1, 2, 3], tape: [4] },
  'parcel-check': { body: [0], edges: [1, 2] },
  'parcel-return': { body: [0], edges: [1, 2] },
  'delivery-time': { body: [0], edges: [1, 2] },
  truck: { body: [0], cab: [1], wheels: [2, 3] },
  'truck-fast': { body: [0], cab: [1], wheels: [2, 3], speed: [4, 5] },
  'home-delivery': { roof: [0], walls: [1], box: [2, 3, 4] },
  'pickup-point': { pin: [0], box: [1, 2, 3] },
  'weighing-scale': { body: [0], platform: [1, 2], dial: [3], needle: [4] },
  'balance-scale': { post: [0, 1], beam: [2], pans: [3, 4, 5, 6] },
  gavel: { head: [0], handle: [1], block: [2] },
  'rubber-stamp': { handle: [0, 1, 2], pad: [3], base: [4] },
  hanger: { body: [0], hook: [1] },
  // ── Round 4 ──
  'payment-split': { top: [0, 1], bottom: [2, 3] },
  installments: { level: [0, 1, 2, 3], mark: [4, 5, 6] },
  'card-clock': { body: [0], stripe: [1, 2] },
  'cash-in': { coin: [0, 1, 2, 3], arrow: [4, 5] },
  'cash-out': { coin: [0, 1, 2, 3], arrow: [4, 5] },
  'instant-payment': { coin: [0, 1, 2, 3], speed: [4, 5, 6] },
  'payment-link': { link: [0, 1, 2] },
  'cash-on-delivery': { body: [0], edges: [1, 2] },
  'card-insert': { card: [0, 1, 2], arrow: [3, 4] },
  'card-swipe': { card: [0, 1], speed: [2, 3, 4] },
  'card-lock': { body: [0], stripe: [1, 2] },
  'card-back': { body: [0], stripe: [1, 2], panel: [3, 4] },
  'card-scan': { card: [0, 1], frame: [2, 3, 4, 5] },
  'card-alert': { body: [0], stripe: [1, 2] },
  'card-gear': { body: [0], stripe: [1, 2] },
  'card-virtual': { body: [0, 1, 2, 3, 4, 5], stripe: [6, 7, 8], number: [9] },
  'card-pin': { body: [0], stripe: [1], digits: [2, 3, 4, 5] },
  'wallet-plus': { body: [0], flap: [1, 2] },
  'watch-payment': { body: [0], straps: [1, 2], level: [3, 4] },
  'mobile-top-up': { body: [0, 1] },
  'express-checkout': { body: [0], handle: [1], bolt: [2] },
  'bag-sync': { body: [0], handle: [1] },
  'bag-exchange': { body: [0], handle: [1], arrows: [2, 3, 4, 5] },
  'bag-clock': { body: [0], handle: [1] },
  'cart-discount': { basket: [0], handle: [1], wheels: [2, 3], mark: [4, 5, 6] },
  'cart-clock': { basket: [0], handle: [1], wheels: [2, 3] },
  'pricing-plans': { plans: [0, 1, 2, 3] },
  'price-tag-arrow-down': { body: [0], hole: [1] },
  cashback: { mark: [0, 1, 2], arrow: [3, 4] },
  auction: { plate: [0], handle: [1], mark: [2, 3, 4] },
  'invoice-recurring': { body: [0], mark: [1, 2, 3] },
  'invoice-minus': { body: [0], mark: [1, 2, 3] },
  'receipt-scan': { body: [0], lines: [1, 2, 3], frame: [4, 5, 6, 7] },
  'receipt-clock': { body: [0], lines: [1, 2] },
  'coin-stack': { coins: [0, 1, 2] },
  'coin-stack-goal': { coins: [0, 1, 2], flag: [3, 4] },
  'coin-stack-dividend': { coins: [0, 1, 2], arrow: [3, 4], coin: [5] },
  'cash-box': { body: [0, 1], handle: [2], slot: [3] },
  'coin-purse': { pouch: [0], frame: [1], clasp: [2, 3] },
  'money-wings': { bill: [0, 1], wing: [2] },
  vault: { door: [0], wheel: [1, 2, 3, 4, 5, 6, 7], hinges: [8, 9] },
  'bank-transfer': { roof: [0], columns: [1, 2], base: [3] },
  'bank-plus': { roof: [0], columns: [1, 2], base: [3] },
  'bank-details': { roof: [0], columns: [1, 2], base: [3] },
  'account-statement': { body: [0], rows: [1, 2, 3, 4], total: [5, 6] },
  'account-statement-check': { body: [0], rows: [1, 2, 3, 4], total: [5, 6] },
  'cheque-scan': { cheque: [0, 1], frame: [2, 3, 4, 5] },
  'interest-rate': { rings: [0, 1], arrow: [2, 3] },
  loan: { coin: [0, 1], cuff: [2], hand: [3] },
  'credit-score': { dial: [0, 1, 2, 3], pivot: [4], needle: [5] },
  portfolio: { body: [0], handle: [1], line: [2] },
  bond: { body: [0], mark: [1, 2, 3] },
  'bull-market': { head: [0], horns: [1, 2], eyes: [3, 4], muzzle: [5] },
  'bear-market': { head: [0], ears: [1, 2], snout: [3, 4], eyes: [5, 6] },
  blockchain: { blocks: [0, 1, 2], links: [3, 4] },
  'crypto-token': { coin: [0], cube: [1, 2, 3] },
  'crypto-token-lock': { coin: [0], cube: [1, 2, 3] },
  'token-swap': { coins: [0, 1, 2, 3], arrows: [4, 5, 6, 7] },
  'key-crypto': { bow: [0, 1], shaft: [2, 3, 4] },
  'crypto-mining': { coin: [0, 1], pick: [2, 3] },
  insurance: { canopy: [0], coin: [1, 2] },
  'insurance-home': { canopy: [0], house: [1, 2] },
  'insurance-life': { canopy: [0], heart: [1] },
  'insurance-car': { canopy: [0], car: [1, 2, 3, 4] },
  'insurance-pet': { canopy: [0], paw: [1, 2, 3, 4, 5] },
  'insurance-policy': { body: [0], mark: [1], lines: [2, 3] },
  'insurance-claim': { body: [0], mark: [1], lines: [2, 3] },
  ledger: { cover: [0], spine: [1], columns: [2, 3] },
  'ledger-search': { cover: [0], spine: [1], columns: [2, 3] },
  'balance-sheet': { body: [0], rule: [1, 2], entries: [3, 4, 5, 6] },
  'income-statement': { body: [0], income: [1, 2, 3], expense: [4, 5], total: [6, 7] },
  budget: { ring: [0], coin: [1, 2, 3, 4] },
  'expense-report': { page: [0, 1] },
  'cash-flow': { mark: [0, 1, 2], in: [3, 4], out: [5, 6] },
  'break-even': { axis: [0], revenue: [1], cost: [2], point: [3] },
  'tax-return': { body: [0], mark: [1, 2, 3] },
  mannequin: { body: [0, 1], stand: [2, 3] },
  'fitting-room': { rail: [0], curtain: [1, 2, 3] },
  'self-checkout': { screen: [0], stand: [1, 3], ledge: [2] },
  'vending-machine': { body: [0], window: [1, 2, 3], flap: [4], slot: [5] },
  'receipt-printer': { body: [0] },
  'checkout-tablet': { screen: [0, 3], stand: [1, 2] },
  'size-guide': { roll: [0, 1], tape: [2, 3, 4] },
  'store-clock': { awning: [0], body: [1] },
  'store-closed': { awning: [0], body: [1], shutter: [2, 3] },
  'store-search': { awning: [0], body: [1] },
  'store-mobile': { body: [0], awning: [1, 2], door: [3] },
  'shopping-mall': { awning: [0], body: [1], doors: [2, 3] },
  marketplace: { awning: [0], stalls: [1, 2, 3, 4] },
  'retail-shelf': { shelf: [0, 1, 2], products: [3, 4, 5, 6, 7] },
  'clothing-rack': { rack: [0, 1, 2], hangers: [3, 4, 5, 6] },
  'display-case': { glass: [0], item: [1, 2], counter: [3] },
  'anti-theft-gate': { gates: [0, 1], wave: [2, 3] },
  'shopping-bags': { back: [0, 1] },
  'product-bundle': { boxes: [0, 1], strap: [2, 3] },
  'product-variants': { box: [0, 1, 2], options: [3, 4, 5] },
  'gift-open': { body: [0, 1], lid: [2, 3], bow: [4, 5] },
  'trade-in': { phone: [0], coin: [1, 2], arrows: [3, 4, 5, 6] },
  'global-payment': { globe: [0, 1, 2] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// Already enclosed in a circle or a frame: they aren't enclosed again
for (const name of ['currency-dollar', 'currency-euro', 'currency-pound', 'currency-yen', 'currency-bitcoin', 'currency-rupee', 'percent-circle', 'reward-points', 'discount', 'refund', 'recurring-payment'])
  icons[name].variants = { circle: false };
for (const name of ['barcode-scan', 'qr-scan', 'calculator']) icons[name].variants = { square: false };
// With a badge or a piece on top (as in `archivos`): the filled enclosure loses the piece on top,
// at 58 % the sign stops reading, and the slash would cross it with no clearance
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };

// ── Mirroring: whatever moves forward, goes back or emits toward one side ─────────────────────
for (const name of ['truck', 'truck-fast', 'contactless', 'card-contactless', 'mobile-payment', 'bag-return', 'parcel-return']) icons[name].mirror = true;

// ── Levels: the waves light up from the inside out (value 0–1) ────────────────────────────────
icons.contactless.levels = [[0], [1], [2], [3]];
icons['card-contactless'].levels = [[3], [4]];
icons['mobile-payment'].levels = [[2], [3]];

// ── Motion: each icon's own gesture ───────────────────────────────────────────────────────────
icons.cart.motion = { effect: 'slide', vector: [2, 0] };
icons['cart-arrow-down'].motion = { effect: 'bounce', parts: ['arrow'], vector: [0, 1.25] };
icons['bag-heart'].motion = { effect: 'beat', parts: ['heart'], origin: [12, 14.5] };
icons.deal.motion = { effect: 'wiggle', origin: [12, 12] };
icons['price-tag'].motion = { effect: 'wiggle', origin: T.hole };
icons.discount.motion = { effect: 'spin', parts: ['seal'], origin: [12, 12] };
icons['invoice-due'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['delivery-time'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['piggy-bank'].motion = { effect: 'bounce', parts: ['coin'], vector: [0, 1.5] };
icons['safe-box'].motion = { effect: 'spin', parts: ['wheel'], origin: [10.25, 11] };
icons['revenue-up'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -2] };
icons['revenue-down'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 2] };
icons['recurring-payment'].motion = { effect: 'spin', parts: ['arrow'], origin: [12, 12] };
icons.donation.motion = { effect: 'beat', parts: ['heart'], origin: [13.75, 9] };
icons['reward-points'].motion = { effect: 'beat', parts: ['star'], origin: [12, 12.35] };
icons.gift.motion = { effect: 'bounce', vector: [0, -2] };
icons.parcel.motion = { effect: 'bounce', vector: [0, -2] };
icons.truck.motion = { effect: 'slide', vector: [2, 0] };
icons['truck-fast'].motion = { effect: 'slide', vector: [2.5, 0] };
icons['home-delivery'].motion = { effect: 'bounce', parts: ['box'], vector: [0, -1.5] };
icons['pickup-point'].motion = { effect: 'bounce', vector: [0, -2.5] };
icons['weighing-scale'].motion = { effect: 'wiggle', parts: ['needle'], origin: [12, 14.5] };
icons['balance-scale'].motion = { effect: 'wiggle', parts: ['beam', 'pans'], origin: [12, 6.25] };
icons.gavel.motion = { effect: 'wiggle', parts: ['head', 'handle'], origin: add([14.5, 8], mul(unit([-1, 1]), 13)) };
icons['rubber-stamp'].motion = { effect: 'bounce', parts: ['handle', 'pad'], vector: [0, 1.5] };
icons.hanger.motion = { effect: 'wiggle', origin: [12, 4] };
icons.contactless.motion = { effect: 'beat', origin: [3.75, 12] };

// ── Round 4: fills drawn from their own strokes, variants, mirroring, levels, values and motion ──
// The coin stacks: the coins filled (each lower one closed along the coin above it) and separated by
// their seams, knocked out
{
  const seams = (x, y) => [line([x + 1.75, y + 3.5], [x - 1.5 + 14 - 1.75, y + 3.5]), line([x + 1 + 1.75, y + 7], [x - 1.5 + 14 - 1.75, y + 7])];
  const coins = (d) => [d[0], shut(d[1]), shut(d[2])];
  const S = icons['coin-stack'].d;
  icons['coin-stack'].fill = { solid: coins(S), cut: seams(5.25, 6.75) };
  const G = icons['coin-stack-goal'].d;
  icons['coin-stack-goal'].fill = { solid: [...coins(G), G[4]], cut: seams(5.25, 10.75), wire: [G[3]] };
  const V = icons['coin-stack-dividend'].d;
  icons['coin-stack-dividend'].fill = { solid: [...coins(V), V[5]], cut: seams(5.25, 10.75), wire: [V[3], V[4]] };
}
// The house under the umbrella: the whole body filled (covering the walls), the eaves attached
icons['insurance-home'].fill = {
  solid: [CANOPY, roundpoly([[8, 16.38], [12, 13.25], [16, 16.38], [16, 21.25], [8, 21.25]], [0, 1, 0, 0, 1.5])],
  wire: [icons['insurance-home'].d[1]],
};
// Only open lines: their fill is the outline itself
for (const name of ['installments', 'payment-link', 'card-virtual', 'cash-flow', 'break-even']) icons[name].fill = false;

// Already enclosed (a coin's rim, the viewfinder): they aren't enclosed again
for (const name of ['installments', 'budget', 'crypto-token']) icons[name].variants = { circle: false };
for (const name of ['card-scan', 'receipt-scan', 'cheque-scan']) icons[name].variants = { square: false };

// Mirroring: what moves forward, sends or grows
for (const name of ['instant-payment', 'card-swipe', 'watch-payment', 'cashback', 'money-wings', 'portfolio', 'break-even', 'bank-transfer']) icons[name].mirror = true;

// Levels: the payments made, the digits typed, the waves from the inside out
icons.installments.levels = [[0], [1], [2], [3]];
icons['card-pin'].levels = [[2], [3], [4], [5]];
icons['watch-payment'].levels = [[3], [4]];

// Values: the budget's ring drawn as far as it is spent; the score's needle from low to high
icons.budget.value = { draw: ['ring'] };
icons['credit-score'].value = { turn: { parts: ['needle'], origin: [12, 15.5], from: 180, to: 360, at: 340 } };

// Motion
icons['card-clock'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['cash-in'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
icons['cash-out'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons['instant-payment'].motion = { effect: 'slide', vector: [2, 0] };
icons['card-insert'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
icons['card-swipe'].motion = { effect: 'slide', parts: ['card'], vector: [1.5, 0] };
icons['card-gear'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['card-alert'].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };
icons['watch-payment'].motion = { effect: 'beat', parts: ['level'], origin: [11.5, 12] };
icons['mobile-top-up'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] };
icons['express-checkout'].motion = { effect: 'beat', parts: ['bolt'], origin: [12, 14.5] };
icons['bag-sync'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['bag-clock'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['cart-clock'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['price-tag-arrow-down'].motion = { effect: 'slide', parts: ['badge'], vector: [0, 1.5] };
icons.cashback.motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] };
icons.auction.motion = { effect: 'wiggle', origin: [14.25, 21.25] };
icons['invoice-recurring'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['receipt-clock'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['coin-stack-goal'].motion = { effect: 'wiggle', parts: ['flag'], origin: [12, 10.75] };
icons['coin-stack-dividend'].motion = { effect: 'bounce', parts: ['coin'], vector: [0, -1.5] };
icons['money-wings'].motion = { effect: 'float', vector: [0, -1.5] };
icons.vault.motion = { effect: 'spin', parts: ['wheel'], origin: [12.75, 12] };
icons['bank-transfer'].motion = { effect: 'slide', parts: ['badge'], vector: [1.5, 0] };
icons['interest-rate'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.25, -1.25] };
icons.loan.motion = { effect: 'bounce', parts: ['coin'], vector: [0, -1.5] };
icons['credit-score'].motion = { effect: 'wiggle', parts: ['needle'], origin: [12, 15.5] };
icons['token-swap'].motion = { effect: 'spin', parts: ['arrows'], origin: [12, 12] };
icons['key-crypto'].motion = { effect: 'wiggle', origin: [8.1, 15.9] };
icons['crypto-mining'].motion = { effect: 'wiggle', parts: ['pick'], origin: [20.5, 15.5] };
icons['insurance-claim'].motion = { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] };
icons['fitting-room'].motion = { effect: 'wiggle', parts: ['curtain'], origin: [8.5, 3.25] };
icons['clothing-rack'].motion = { effect: 'wiggle', parts: ['hangers'], origin: [12, 4.75] };
icons['gift-open'].motion = { effect: 'bounce', parts: ['lid', 'bow'], vector: [0, -1.5] };
icons['trade-in'].motion = { effect: 'spin', parts: ['arrows'], origin: [12, 12] };
icons['store-clock'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };

// ── 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough ──────────────
// The engine snaps each icon to the pixel grid with a single adjustment shared by all its strokes
// and swaps the standard badges for their pixel versions on its own (the cards with a badge, the
// delivered package and the delivery clock no longer need a custom drawing). Only the drawings that
// still don't read go here. The engine neither snaps a `small` nor swaps its badge: it is snapped
// here and, if it carries a badge, it gets the engine's pixel badge (`badge(kind, { size: 16 })`).
// At 16 px a pixel measures 1.5 canvas units: pixel centers fall at 0.75 + 1.5k; new glyphs run
// from pixel center to pixel center (their diagonals at 45°). g(column, row) is the center of a
// pixel.
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
const sharp = (list) => list.map((d) => snap(d));
/** The pixel peso sign: the 3 × 5 S and its one-pixel stem above and below. */
const dollar16 = (c, r) => [pl([c + 2, r + 1], [c, r + 1], [c, r + 3], [c + 2, r + 3], [c + 2, r + 5], [c, r + 5]), pl([c + 1, r], [c + 1, r + 1]), pl([c + 1, r + 5], [c + 1, r + 6])];

// The invoice at 16 px: the snapped document (columns 3–12, rows 1–14) and the pixel sign at the
// top left, outside the badge area.
{
  const doc = snap(icons['invoice-plus'].d[0]);
  const sign = dollar16(5, 3);
  for (const [name, kind] of [['invoice-plus', 'plus'], ['invoice-paid', 'check'], ['invoice-due', 'clock']])
    icons[name].small = { d: [doc, ...sign], fill: { solid: [doc], cut: sign }, badge: badge(kind, { size: 16 }) };
}
// The package return: its badge is custom (the left arrow), and the engine only swaps the standard
// ones on its own; snapped to the pixel grid, it kept its 5.7 px circle and clogged up. Like the
// engine's, at 16 px it drops the circle, with the pixel arrow centered on the badge's pixel
// (11, 11), and clears the same circle as at 24 px plus the arrow with its clearance. The base gets
// the same shared adjustment the engine would give it.
{
  const icon = icons['parcel-return'];
  const at = (dx, dy) => g(11 + dx, 11 + dy);
  const arrow = [line(at(2, 0), at(-2, 0)), line(at(0, -2), at(-2, 0), at(0, 2))];
  const sn = snapper([...icon.d, ...Object.values(icon.fill).flat()]);
  icon.small = {
    d: icon.d.map(sn),
    fill: Object.fromEntries(Object.entries(icon.fill).map(([k, v]) => [k, v.map(sn)])),
    badge: { d: arrow, knock: `${circ(...BC, 4.25)}${arrow.join('')}` },
  };
}
// The package: snapped, the tape and the edges became a gray mesh. At 16 px it uses the pixel box
// (2:1 edges through pixel centers, columns 1–13 and rows 2–13) with a single-line tape that
// crosses the lid and folds two pixels down the left face.
{
  const P = { T: g(7, 2), R: g(13, 5), C: g(7, 8), L: g(1, 5), Rb: g(13, 10), B: g(7, 13), Lb: g(1, 10) };
  const body = roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 1);
  const d = [body, line(P.L, P.C, P.R), line(P.C, P.B), pl([9, 3], [3, 6], [3, 8])];
  icons.parcel.small = { d, fill: { solid: [body], cut: d.slice(1) } };
}
// The terminal: the keypad dots, turned into 2 × 2 pixels, merged into a block. At 16 px, one-pixel
// keys with one pixel of clearance (3 × 2), a 7 × 3 screen and a 5-pixel ticket; everything
// centered on column 8 (with an odd number of columns it can't be centered on the canvas).
{
  const body = sq(px(3), px(4), 15, 15, 2.25, SQ);
  const ticket = roundline([g(6, 4), g(6, 2), g(10, 2), g(10, 4)], [0, 1.1, 1.1, 0]);
  const screen = sq(px(5), px(6), 9, 3, 0.6);
  const keys = [6, 8, 10].flatMap((c) => [10, 12].map((r) => circ(...g(c, r), 0.1)));
  const d = [body, ticket, screen, ...keys];
  icons['payment-terminal'].small = { d, fill: { solid: [body, shut(ticket)], cut: [screen, ...keys] } };
}
// The cash register: the keys, likewise, merged into a bar. At 16 px, three 2 × 1 keys with a pixel
// of clearance, the drawer with its handle and the screen with its post.
{
  const body = sq(px(2), px(6), 16.5, 12, 2.25, SQ);
  const screen = sq(px(3), px(1), 9, 3, 0.75);
  const post = pl([6, 3], [6, 6]);
  const keys = [3, 6, 9].map((c) => pl([c + 1, 8], [c + 2, 8]));
  const d = [body, screen, post, pl([2, 10], [13, 10]), pl([6, 12], [9, 12]), ...keys];
  icons['cash-register'].small = { d, fill: { solid: [body, screen], wire: [post], cut: d.slice(3) } };
}

// The tax receipt: the % made of rings and a diagonal was a smudge; at 16 px, two one-pixel dots
// and a 6-pixel diagonal, with a pixel of clearance.
{
  const d = [snap(icons['receipt-tax'].d[0]), circ(...g(6, 5), 0.1), circ(...g(9, 8), 0.1), pl([5, 9], [10, 4])];
  icons['receipt-tax'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
// The QR reader: 3 × 3 pixel modules with 2 pixels of clearance between them.
{
  const corners = sharp(icons['qr-scan'].d.slice(4));
  const d = [sq(px(4), px(4), 3, 3, 0.75), sq(px(9), px(4), 3, 3, 0.75), sq(px(4), px(9), 3, 3, 0.75), circ(...g(10, 10), 0.1), ...corners];
  icons['qr-scan'].small = { d, fill: { solid: d.slice(0, 4), lines: corners } };
}
// Currency exchange: pixel $ and € in opposite corners and the two arrows in the other two.
{
  const euro16 = [roundline([g(13, 8), g(10, 8), g(10, 14), g(13, 14)], [0, 1.5, 1.5, 0]), pl([9, 10], [12, 10]), pl([9, 12], [12, 12])];
  const d = [
    ...dollar16(2, 1),
    ...euro16,
    roundline([g(7, 2), g(12, 2), g(12, 6)], [0, 1.5, 0]),
    pl([11, 5], [12, 6], [13, 5]),
    roundline([g(8, 13), g(3, 13), g(3, 9)], [0, 1.5, 0]),
    pl([2, 10], [3, 9], [4, 10]),
  ];
  icons['currency-exchange'].small = { d };
}
// The waves (contactless, card and mobile payment): at 16 px the arcs were a gray smudge; here they
// are pixel brackets, straight with their ends at 45°. Contactless has three, 3 columns apart.
const wave16 = (c, r0, r1) => pl([c - 1, r0], [c, r0 + 1], [c, r1 - 1], [c - 1, r1]);
{
  const d = [wave16(5, 6, 9), wave16(8, 4, 11), wave16(11, 2, 13)];
  icons.contactless.small = { d };
}
{
  const card = sharp(icons['card-contactless'].d.slice(0, 3));
  const d = [...card, wave16(10, 6, 9), wave16(12, 5, 10)];
  icons['card-contactless'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
}
{
  const phone = sharp(icons['mobile-payment'].d.slice(0, 2));
  const d = [...phone, wave16(12, 6, 9), wave16(14, 4, 11)];
  icons['mobile-payment'].small = { d, fill: { solid: [d[0]], cut: [d[1]], lines: d.slice(2) } };
}
// Recurring payment: the two arrows on a pixel octagon (straight sides and 45° diagonals) and the
// pixel sign in the center.
{
  const d = [
    pl([2, 8], [2, 5], [5, 2], [10, 2], [12, 4]),
    pl([10, 4], [12, 4], [12, 2]),
    pl([13, 7], [13, 10], [10, 13], [5, 13], [3, 11]),
    pl([5, 11], [3, 11], [3, 13]),
    ...dollar16(6, 4),
  ];
  icons['recurring-payment'].small = { d };
}
// Investment: the pixel sign with its stalk and two leaves at 45°.
{
  const sign = [pl([7, 4], [7, 8], [8, 8]), pl([8, 8], [6, 8], [6, 10], [8, 10], [8, 12], [6, 12]), pl([7, 12], [7, 13])];
  const leaves = [leaf(g(7, 4), g(4, 1), 4.8), leaf(g(10, 1), g(7, 4), 4.8)];
  const d = [...sign, ...leaves];
  icons.investment.small = { d, fill: { solid: leaves, wire: sign } };
}
// The cart: the snapped basket and handle, wheels of exactly 2 × 2 pixels and the 3 × 3 pixel sign
// centered in the basket.
{
  const base = sharp(cart());
  const wheels = [sq(px(5), px(12), 1.5, 1.5, 0), sq(px(11), px(12), 1.5, 1.5, 0)];
  const d0 = [base[0], base[1], ...wheels];
  const fill0 = (extra = [], cut = []) => ({ solid: [d0[0], ...wheels, ...extra.map(shut)], wire: [d0[1]], ...(cut.length && { cut }) });
  const SIGN = {
    'cart-plus': [pl([9, 5], [9, 7]), pl([8, 6], [10, 6])],
    'cart-minus': [pl([8, 6], [10, 6])],
    'cart-check': [pl([7, 6], [8, 7], [10, 5])],
    'cart-remove': [pl([8, 5], [10, 7]), pl([10, 5], [8, 7])],
    'cart-arrow-down': [pl([9, 5], [9, 7]), pl([8, 6], [9, 7], [10, 6])],
  };
  icons.cart.small = { d: d0, fill: fill0() };
  const items = sharp(icons['cart-full'].d.slice(4));
  icons['cart-full'].small = { d: [...d0, ...items], fill: fill0(items) };
  for (const [name, sign] of Object.entries(SIGN)) icons[name].small = { d: [...d0, ...sign], fill: fill0([], sign) };
}

// ── Round 4 at 16 px: pixel drawings where snapping left a smudge ──────────────────────────────
{
  // A pixel coin: a circle of r 6 (4 pixels) on a pixel center with the pixel peso sign, its stems
  // meeting the rim
  const coin16 = (c, r) => [circ(...g(c, r), 6), ...dollar16(c - 1, r - 3)];
  // The card's PIN: the snapped card and stripe and four one-pixel digits, a pixel apart, three rows
  // under the stripe
  {
    const [card, stripe] = sharp(icons['card-pin'].d.slice(0, 2));
    const digits = [4, 6, 8, 10].map((c) => circ(...g(c, 9), 0.1));
    icons['card-pin'].small = { d: [card, stripe, ...digits], fill: { solid: [card], cut: [stripe, ...digits] } };
  }
  // The watch's waves as pixel brackets, as on mobile-payment
  {
    const [body, top, bottom] = sharp(icons['watch-payment'].d.slice(0, 3));
    const waves = [wave16(11, 6, 9), wave16(13, 4, 11)];
    icons['watch-payment'].small = { d: [body, top, bottom, ...waves], fill: { solid: [body, shut(top), shut(bottom)], lines: waves } };
  }
  // The exchange: two pixel arrows, offset as at 24 px
  {
    const [body, handle] = sharp(bag());
    const arrows = [pl([6, 8], [10, 8]), pl([9, 7], [10, 8], [9, 9]), pl([9, 11], [5, 11]), pl([6, 10], [5, 11], [6, 12])];
    icons['bag-exchange'].small = { d: [body, handle, ...arrows], fill: { solid: [body], lines: [handle], cut: arrows } };
  }
  // The cart's percent: two one-pixel dots and the slash, in the basket like the cart's other signs
  {
    const base = sharp(cart());
    const wheels = [sq(px(5), px(12), 1.5, 1.5, 0), sq(px(11), px(12), 1.5, 1.5, 0)];
    const sign = [circ(...g(7, 5), 0.1), pl([8, 7], [10, 5]), circ(...g(11, 7), 0.1)];
    icons['cart-discount'].small = { d: [base[0], base[1], ...wheels, ...sign], fill: { solid: [base[0], ...wheels], wire: [base[1]], cut: sign } };
  }
  // The invoices with a badge, as invoice-plus: the snapped document and the pixel sign
  {
    const doc = snap(INVOICE_B[0]);
    const sign = dollar16(5, 3);
    for (const [name, kind] of [['invoice-recurring', 'sync'], ['invoice-minus', 'minus']])
      icons[name].small = { d: [doc, ...sign], fill: { solid: [doc], cut: sign }, badge: badge(kind, { size: 16 }) };
  }
  // The swap: plain pixel coins (their rings clogged) and the arrows of currency-exchange
  {
    const coins = [circ(...g(4, 4), 4.5), circ(...g(11, 11), 4.5)];
    const arrows = [roundline([g(9, 2), g(12, 2), g(12, 5)], [0, 1.5, 0]), pl([11, 4], [12, 5], [13, 4]), roundline([g(6, 13), g(3, 13), g(3, 10)], [0, 1.5, 0]), pl([2, 11], [3, 10], [4, 11])];
    icons['token-swap'].small = { d: [...coins, ...arrows], fill: { solid: coins, lines: arrows } };
  }
  // The score: the dial as one half octagon (its four segments, a pixel apart, read as brackets)
  // and the needle at 45° toward the high end
  {
    const dial = pl([2, 10], [2, 7], [5, 4], [11, 4], [14, 7], [14, 10]);
    const needle = pl([8, 10], [11, 7]);
    icons['credit-score'].small = { d: [dial, needle] };
  }
  // Cash in and out: the pixel coin, the arrow beside it and the pixel slot on top
  {
    const slot = sq(px(2), px(10), 16.5, 3, 1.5);
    const coin = coin16(5, 5);
    const down = [pl([13, 2], [13, 7]), pl([12, 6], [13, 7], [14, 6])];
    const up = [pl([13, 7], [13, 2]), pl([12, 3], [13, 2], [14, 3])];
    for (const [name, arrow] of [['cash-in', down], ['cash-out', up]])
      icons[name].small = { d: [...coin, ...arrow], fill: { solid: [coin[0]], cut: coin.slice(1), lines: arrow }, badge: { d: [slot], knock: slot, fill: { solid: [slot] } } };
  }
  // The instant payment: the pixel coin and three one-row speed lines
  {
    const coin = coin16(9, 7);
    const speed = [pl([2, 5], [3, 5]), pl([1, 7], [3, 7]), pl([2, 9], [3, 9])];
    icons['instant-payment'].small = { d: [...coin, ...speed], fill: { solid: [coin[0]], cut: coin.slice(1), lines: speed } };
  }
  // The budget: the ring from the top round to the left and the pixel coin, half a pixel up and left
  // so both sit on pixel centers
  {
    const ring = arc(11.25, 11.25, 9, -90, 180).d;
    const coin = coin16(7, 7);
    icons.budget.small = { d: [ring, ...coin], fill: { solid: [coin[0]], cut: coin.slice(1), lines: [ring] } };
  }
  // The token: the coin half a pixel up and left and its cube on 2:1 pixel edges
  {
    const ring = circ(11.25, 11.25, 9);
    const P = { T: g(7, 3), R: g(11, 5), C: g(7, 7), L: g(3, 5), Rb: g(11, 9), B: g(7, 11), Lb: g(3, 9) };
    const cube16 = [roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 0.75), line(P.L, P.C, P.R), line(P.C, P.B)];
    icons['crypto-token'].small = { d: [ring, ...cube16], fill: { solid: [ring], cut: cube16 } };
  }
  // The top-up: the snapped phone and, as on global-payment, the pixel coin over its lower right
  {
    const phone = sharp(icons['mobile-top-up'].d);
    const c = coin16(10, 10);
    icons['mobile-top-up'].small = { d: phone, fill: { solid: [phone[0]], cut: [phone[1]] }, badge: { d: c, knock: c[0], fill: { solid: [c[0]], cut: c.slice(1) } } };
  }
  // The link with the pixel sign at its free corner, and the globe with the pixel coin
  {
    const link = sharp(NU.link.d);
    const sign = dollar16(11, 8);
    icons['payment-link'].small = { d: link, badge: { d: sign, knock: sq(16.5, 12, 4.5, 10.5, 1) } };
    const globe = sharp(icons['global-payment'].d);
    const c = coin16(10, 10);
    icons['global-payment'].small = { d: globe, fill: { solid: [globe[0]], cut: globe.slice(1) }, badge: { d: c, knock: c[0], fill: { solid: [c[0]], cut: c.slice(1) } } };
  }
  // The vault: the door on a pixel center, the wheel as three pixel spokes and the hinges as 2 × 2 tabs
  {
    const door = circ(...g(8, 7), 7.5);
    const wheel = [pl([8, 7], [8, 4]), pl([8, 7], [10, 9]), pl([8, 7], [6, 9])];
    const hinges = [sq(px(1), px(4), 1.5, 1.5, 0), sq(px(1), px(9), 1.5, 1.5, 0)];
    icons.vault.small = { d: [door, ...wheel, ...hinges], fill: { solid: [door, ...hinges], cut: wheel } };
  }
  // Break-even: the axes, revenue at 45° and a flat cost, crossing on a pixel
  {
    const d = [pl([2, 2], [2, 13], [14, 13]), pl([4, 11], [13, 2]), pl([4, 8], [13, 8])];
    icons['break-even'].small = { d };
  }
  // The tax return: the snapped document and the pixel percent of receipt-tax
  {
    const d = [snap(icons['tax-return'].d[0]), circ(...g(6, 5), 0.1), circ(...g(9, 8), 0.1), pl([5, 9], [10, 4])];
    icons['tax-return'].small = { d, fill: { solid: [d[0]], cut: d.slice(1) } };
  }
  // The loan: a plain pixel coin a pixel clear of the snapped hand (its inner ring clogged)
  {
    const [cuff, hand] = sharp([icons.loan.d[2], icons.loan.d[3]]);
    const coin = circ(...g(9, 4), 3);
    icons.loan.small = { d: [coin, cuff, hand], fill: { solid: [coin, cuff, shut(hand)] } };
  }
  // Cashback: the pixel percent (2 × 2 rings) over the pixel arrow that runs out and curls back
  {
    const rings = [sq(px(4), px(1), 1.5, 1.5, 0), sq(px(10), px(6), 1.5, 1.5, 0)];
    const slash = pl([5, 7], [10, 2]);
    const arrow = [pl([2, 10], [11, 10], [12, 11], [12, 12], [11, 13], [7, 13]), pl([3, 9], [2, 10], [3, 11])];
    icons.cashback.small = { d: [...rings, slash, ...arrow], fill: { solid: rings, lines: [slash, ...arrow] } };
  }
  // The bond: the certificate (columns 1–14, rows 2–11), the pixel percent of receipt-tax and the
  // rosette as a 5-pixel ring with two strips for its ribbon (file-certificate's at 16 px), 8 from
  // the lower dot (closer, the engine drops it)
  {
    const body = sq(px(1), px(2), 19.5, 13.5, 2.25, SQ);
    const mark = [circ(...g(4, 5), 0.1), circ(...g(7, 8), 0.1), pl([3, 9], [8, 4])];
    const seal = circ(...g(12, 10), 3);
    const tails = [line([17.25, 18.35], [17.25, 21.75]), line([20.25, 18.35], [20.25, 21.75])];
    icons.bond.small = { d: [body, ...mark], fill: { solid: [body], cut: mark }, badge: { d: [seal, ...tails], knock: `${seal}${sq(17.25, 18, 3, 3.75, 0)}`, fill: { solid: [seal], wire: tails } } };
  }
  // Trade-in: the arrows of token-swap on the pixel grid, the phone (columns 1–5, rows 1–6) and a
  // plain pixel coin (its inner ring clogged, and the arrows went gray)
  {
    const phone = sq(px(1), px(1), 6, 7.5, 1.2, SQ);
    const coin = circ(...g(11, 11), 4.5);
    const arrows = [roundline([g(8, 2), g(12, 2), g(12, 5)], [0, 1.5, 0]), pl([11, 4], [12, 5], [13, 4]), roundline([g(7, 13), g(3, 13), g(3, 10)], [0, 1.5, 0]), pl([2, 11], [3, 10], [4, 11])];
    icons['trade-in'].small = { d: [phone, coin, ...arrows], fill: { solid: [phone, coin], lines: arrows } };
  }
  // Insurance at 16 px: snapped, the canopy's scallops went gray and what it covers became a blob.
  // The pixel canopy (columns 1–13, rows 1–6) is a dome with three scallops a pixel deep, and what
  // it covers sits in rows 8–14, centered on column 7: a plain coin, the house, the heart, the
  // car's front and the paw
  {
    const canopy = `${pl([1, 6], [1, 4], [3, 2], [5, 1], [9, 1], [11, 2], [13, 4], [13, 6], [12, 5], [10, 5], [9, 6], [8, 5], [6, 5], [5, 6], [4, 5], [2, 5])}Z`;
    const coin = circ(...g(7, 11), 4.5);
    icons.insurance.small = { d: [canopy, coin], fill: { solid: [canopy, coin] } };
    const roof = pl([3, 12], [7, 8], [11, 12]);
    const walls = pl([5, 10], [5, 14], [9, 14], [9, 10]);
    icons['insurance-home'].small = { d: [canopy, roof, walls], fill: { solid: [canopy, `${pl([5, 10], [7, 8], [9, 10], [9, 14], [5, 14])}Z`], wire: [roof] } };
    const heart16 = roundpoly([g(5, 9), g(6, 9), g(7, 10), g(8, 9), g(9, 9), g(10, 10), g(10, 11), g(7, 14), g(4, 11), g(4, 10)], 0.35);
    icons['insurance-life'].small = { d: [canopy, heart16], fill: { solid: [canopy, heart16] } };
    const body = sq(px(3), px(11), 12, 3, 0.75);
    const cabin = pl([4, 11], [5, 9], [9, 9], [10, 11]);
    const wheels = [pl([4, 14], [5, 14]), pl([9, 14], [10, 14])];
    icons['insurance-car'].small = { d: [canopy, body, cabin, ...wheels], fill: { solid: [canopy, body, `${cabin}Z`], wire: wheels } };
    const pad = `${pl([6, 12], [8, 12], [10, 14], [4, 14])}Z`;
    const toes = [g(3, 11), g(5, 9), g(9, 9), g(11, 11)].map((p) => circ(...p, 0.1));
    icons['insurance-pet'].small = { d: [canopy, pad, ...toes], fill: { solid: [canopy, pad, ...toes] } };
    // The policy: the snapped document (columns 3–12), a 6-pixel dome for its letterhead and two
    // lines; the claim keeps only the dome, clear of the pixel pencil's clearance
    const doc = snap(icons['insurance-policy'].d[0]);
    const dome = `${pl([5, 5], [5, 4], [6, 3], [9, 3], [10, 4], [10, 5])}Z`;
    const lines = [pl([5, 8], [10, 8]), pl([5, 10], [8, 10])];
    icons['insurance-policy'].small = { d: [doc, dome, ...lines], fill: { solid: [doc], cut: [dome, ...lines] } };
    icons['insurance-claim'].small = { d: [doc, dome], fill: { solid: [doc], cut: [dome] }, badge: badge('edit', { size: 16 }) };
  }
  // The flying bill, level: turned, it fell between pixels. The bill (columns 5–13, rows 4–10) with
  // a one-pixel ring and the wing as a pixel swoosh from its left edge
  {
    const bill = sq(px(5), px(4), 12, 9, 1.5, SQ);
    const ring = circ(...g(9, 7), 1.5);
    const wing = pl([5, 6], [1, 2], [1, 4], [5, 8]);
    icons['money-wings'].small = { d: [bill, ring, wing], fill: { solid: [bill, shut(wing)], cut: [ring] } };
  }
  // The display case: the glass (columns 2–13, rows 1–9) on its counter and the gem as a pixel
  // pentagon, a pixel clear of the glass
  {
    const glass = sq(px(2), px(1), 16.5, 12, 1.5, SQ);
    const counter = pl([4, 9], [4, 13], [11, 13], [11, 9]);
    const gem = roundpoly([g(6, 3), g(9, 3), g(10, 5), g(8, 7), g(7, 7), g(5, 5)], 0.3);
    icons['display-case'].small = { d: [glass, gem, counter], fill: { solid: [glass, shut(counter)], cut: [gem] } };
  }
  // The paddle upright, its plate on pixel centers (columns 2–12, rows 1–11) with the pixel sign a
  // pixel clear of it, and the grip three pixels wide
  {
    const plate = sq(px(2), px(1), 15, 15, 2.25);
    const sign = dollar16(6, 3);
    const grip = pl([6, 11], [6, 14], [8, 14], [8, 11]);
    icons.auction.small = { d: [plate, grip, ...sign], fill: { solid: [plate, shut(grip)], cut: sign } };
  }
  // The plans: the two behind (columns 1–6 and 9–14, rows 1–9) with their headers on row 3, and the
  // featured one in front (columns 4–11, rows 4–14) with the pixel sign
  {
    const sides = [sq(px(1), px(1), 7.5, 12, 1.5, SQ), pl([1, 3], [6, 3]), sq(px(9), px(1), 7.5, 12, 1.5, SQ), pl([9, 3], [14, 3])];
    const card = sq(px(4), px(4), 10.5, 15, 2.25, SQ);
    const sign = dollar16(6, 6);
    icons['pricing-plans'].small = { d: sides, fill: { solid: [sides[0], sides[2]], cut: [sides[1], sides[3]] }, badge: { d: [card, ...sign], knock: card, fill: { solid: [card], cut: sign } } };
  }
  // The card going in: the card (columns 2–9) with its chip as a 4 × 4 pixel square, the arrow and
  // the slot of cash-in at 16 px
  {
    const card = pl([2, 11], [2, 1], [9, 1], [9, 11]);
    const chip = sq(px(4), px(3), 4.5, 4.5, 0.75);
    const arrow = [pl([13, 2], [13, 7]), pl([12, 6], [13, 7], [14, 6])];
    const slot = sq(px(2), px(10), 16.5, 3, 1.5);
    icons['card-insert'].small = { d: [card, chip, ...arrow], fill: { solid: [shut(card)], cut: [chip], lines: arrow }, badge: { d: [slot], knock: slot, fill: { solid: [slot] } } };
  }
  // The variants: the box on 2:1 pixel edges (columns 1–9) and the three swatches a pixel apart
  {
    const P = { T: g(5, 2), R: g(9, 4), C: g(5, 6), L: g(1, 4), Rb: g(9, 9), B: g(5, 11), Lb: g(1, 9) };
    const box = [roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 0.75), line(P.L, P.C, P.R), line(P.C, P.B)];
    const swatches = [3, 7, 11].map((r) => circ(...g(13, r), 1.5));
    icons['product-variants'].small = { d: [...box, ...swatches], fill: { solid: [box[0], ...swatches], cut: box.slice(1) } };
  }
}

export default { category: 'comercio', label: 'Comercio y finanzas', icons };
