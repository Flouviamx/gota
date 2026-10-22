// Commerce and finance: shopping, payment, money, shipping and inventory. Everything is computed
// with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines,
// continuous corners and a square bottom-right corner on containers. The badges are the engine's
// (`badge`): the base is drawn whole and the engine clears it with 1.5 of clearance; a piece on top
// of another (the front coin, the front card, the wallet, the ATM's bill) works the same way.
import { arc, badge, circ, dot, drop, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snap, snapper } from '../../engine/variants.mjs';

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
function receipt(x = 4.75, y = 2.75, w = 14.5, h = 18.5, teeth = 5, depth = 1.5) {
  const k = corners(x, y, w, h, 3.5);
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
  'receipt-tax': { tags: ['impuestos', 'IVA', 'retención', 'tax', 'vat', 'tax receipt'], d: [receipt(), ...percent(12, 11.25, 2.8, 1.05, 3.25)] },
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
      const n = 8.5;
      const nr = 1.75;
      return [
        `M${pt(k[0].p)}${k[0].c}L${pt(k[1].p)}${k[1].c}L${pt([n + nr, y + h])}A${nr} ${nr} 0 0 0 ${pt([n - nr, y + h])}L${pt(k[2].p)}${k[2].c}L${pt(k[3].p)}${k[3].c}L${pt([n - nr, y])}A${nr} ${nr} 0 0 0 ${pt([n + nr, y])}Z`,
        ...percentDots(15, 12, 2.75, 3.25),
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
    const bill = roundline(
      [
        [7.25, 6.25],
        [7.25, 21.25],
        [16.75, 21.25],
        [16.75, 6.25],
      ],
      [0, 2, 0, 0],
    );
    const sign = dollar(12, 13.75, 6.75, 4.5, 1.25);
    const knock = roundpoly(
      [
        [7.25, 9.25],
        [16.75, 9.25],
        [16.75, 21.25],
        [7.25, 21.25],
      ],
      [0, 0, 0, 2],
    );
    return {
      tags: ['cajero automático', 'retiro', 'efectivo', 'atm', 'cash machine'],
      d: [sq(2.75, 2.75, 18.5, 7.5, 2.5, SQ), line([5.75, 6.25], [18.25, 6.25])],
      // Filled, the bill closes along the slot
      badge: own([bill, ...sign], knock, { solid: [`${bill}Z`], cut: sign }),
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
  // The tallest drawer: the handle sits 3 from its edge and from the bottom
  'cash-register': {
    tags: ['caja registradora', 'punto de venta', 'caja', 'cash register', 'checkout'],
    d: [
      sq(3.25, 9, 17.5, 12.25, 3, SQ),
      sq(4.25, 2.75, 8.5, 3.25, 1),
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

export default { category: 'comercio', label: 'Comercio y finanzas', icons };
