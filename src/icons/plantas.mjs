// Plantas y jardín (plants and gardening), round 11: trees by kind, leaves by kind, flowers,
// succulents and houseplants, seeds, wild plants, the garden's tools and machines, and the garden
// itself. Drawn with the engine (engine/geometry.mjs) and the rules in DESIGN.md.
// - It adopts lugares's leaf, tree, tree-pine, palm-tree, flower, sprout and cactus (drawn there,
//   never again): every tree-* stands on the tree's trunk, which enters its crown; every leaf-* lies
//   on the leaf's diagonal, its stem the leaf's; the flowers on a stem carry the flower's stem.
// - The potted plants share one pot (potted-plant's), drawn at the sizes they need.
// - The machines face right in profile on round wheels; the tools are drawn whole, never held.
import { arc, badge, circ, dot, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import lugares from './lugares.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
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
const angOf = ([cx, cy], [x, y]) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
/** A path scaled by `s` about `c` and set down with `c` at `to`. */
const place = (d, s, c, to = c) => transform(d, s, to[0] - c[0] * s, to[1] - c[1] * s);
/** A point scaled by `s` about `c` and set down with `c` at `to`. */
const placePt = (p, s, c, to = c) => [to[0] + (p[0] - c[0]) * s, to[1] + (p[1] - c[1]) * s];
/** Closes an open stroke for `fill.solid` (it only takes closed shapes). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

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

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w, y + r])}V${N(y + h - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${N(x + w - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w - r, y + h])}H${N(x + r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** An open arc of an upright ellipse from a0 to a1 degrees (clockwise when a1 > a0). */
function ringArc(c, rx, ry, a0, a1) {
  const P = (a) => [c[0] + rx * Math.cos((a * Math.PI) / 180), c[1] + ry * Math.sin((a * Math.PI) / 180)];
  return `M${pt(P(a0))}A${N(rx)} ${N(ry)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${pt(P(a1))}`;
}

/** Ellipse with semi-axes rx, ry rotated `tilt` degrees, as four cubics. */
function ell(c, rx, ry, tilt = 0) {
  const k = 0.5523;
  const P = (x, y) => plus(c, rot([x, y], [0, 0], tilt));
  return `M${pt(P(rx, 0))}C${pt(P(rx, k * ry))} ${pt(P(k * rx, ry))} ${pt(P(0, ry))}C${pt(P(-k * rx, ry))} ${pt(P(-rx, k * ry))} ${pt(P(-rx, 0))}C${pt(P(-rx, -k * ry))} ${pt(P(-k * rx, -ry))} ${pt(P(0, -ry))}C${pt(P(k * rx, -ry))} ${pt(P(rx, -k * ry))} ${pt(P(rx, 0))}Z`;
}

/** A lens leaf from A to B, `w` wide at its middle (frutas-verduras's and agricultura's leaf). */
function leaf(A, B, w) {
  const c = len(sub(B, A));
  const s = w / 2;
  const R = N((s * s + (c * c) / 4) / (2 * s));
  return `M${pt(A)}A${R} ${R} 0 0 1 ${pt(B)}A${R} ${R} 0 0 1 ${pt(A)}Z`;
}

/** The intersections of two circles [x, y, r]. */
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

/**
 * Outline of the union of several circles [x, y, r] ordered clockwise around `c` (lugares's
 * construction for the tree's crown and the flower's petals): on each, the outer arc between its
 * crossings with the previous and the next.
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

/** Where a ray from `c` toward `dir` leaves a union of circles (the farthest crossing). */
function rayOut(cs, c, dir) {
  const u = unit(dir);
  let best = 0;
  for (const [x, y, r] of cs) {
    const o = sub(c, [x, y]);
    const b = o[0] * u[0] + o[1] * u[1];
    const q = b * b - (o[0] * o[0] + o[1] * o[1] - r * r);
    if (q >= 0) best = Math.max(best, -b + Math.sqrt(q));
  }
  return plus(c, scale(u, best));
}

/** Five round petals around `c` (lugares's flower), `k` its size (1 = the flower's petals). */
const petals = (c, k = 1, a0 = -90) => [0, 1, 2, 3, 4].map((i) => [...polar(...c, 3.6 * k, a0 + i * 72), 2.9 * k]);

/**
 * A flat pad of foliage (a bonsai's): a flat underside from x0 to x1 at yb, its top two round bumps
 * that meet at a notch half its height `h` down.
 */
function pad(x0, x1, yb, h) {
  const xm = (x0 + x1) / 2;
  const bump = (a, b) => {
    const c = len(sub(b, a));
    const s = Math.min(h * 0.55, c / 2);
    const R = (s * s + (c * c) / 4) / (2 * s);
    return `A${N(R)} ${N(R)} 0 0 0 ${pt(b)}`;
  };
  const r = 1;
  const A = [x1, yb - r];
  const M = [xm, yb - h / 2];
  const B = [x0, yb - r];
  return `M${pt([x0 + r, yb])}H${N(x1 - r)}A${r} ${r} 0 0 0 ${pt(A)}${bump(A, M)}${bump(M, B)}A${r} ${r} 0 0 0 ${pt([x0 + r, yb])}Z`;
}

/**
 * A mound of round lobes standing on the ground (a bush): the union of circles [x, y, r] ordered
 * left to right, from where the first leaves the ground to where the last meets it again; open
 * along the ground, which is its own line.
 */
function mound(cs, yg) {
  const foot = ([x, y, r], side) => [x + side * Math.sqrt(Math.max(0, r * r - (yg - y) ** 2)), yg];
  const up = (P, Q) => meet(P, Q).sort((p, q) => p[1] - q[1])[0];
  let d = `M${pt(foot(cs[0], -1))}`;
  cs.forEach((P, i) => {
    const to = i < cs.length - 1 ? up(P, cs[i + 1]) : foot(P, 1);
    const from = i ? up(cs[i - 1], P) : foot(P, -1);
    const span = (((angOf(P, to) - angOf(P, from)) % 360) + 360) % 360;
    d += `A${N(P[2])} ${N(P[2])} 0 ${span > 180 ? 1 : 0} 1 ${pt(to)}`;
  });
  return d;
}

/**
 * A round outline of `n` scallops (a pompom, a ruffle): valleys on a circle of radius r about c,
 * each scallop bulging `depth` past it.
 */
function scallops(c, r, n, depth, a0 = -90) {
  const step = 360 / n;
  const chord = 2 * r * Math.sin((step * Math.PI) / 360);
  const R = N((depth * depth + (chord * chord) / 4) / (2 * depth));
  let d = `M${pt(polar(...c, r, a0))}`;
  for (let i = 1; i <= n; i++) d += `A${R} ${R} 0 0 1 ${pt(polar(...c, r, a0 + i * step))}`;
  return `${d}Z`;
}

/**
 * Smooth closed curve through points (a Catmull-Rom spline as cubics): the wobble of a trunk's
 * cross-section.
 */
function smooth(pts, t = 1 / 6) {
  const n = pts.length;
  let d = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    const c1 = plus(p1, scale(sub(p2, p0), t));
    const c2 = sub(p2, scale(sub(p3, p1), t));
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return `${d}Z`;
}

/**
 * A heart-shaped leaflet (the engine's heart: two lobes of radius r, `a` apart from its axis, and the
 * tangents that run to its point), its point at `tip` and its lobes `h` away along `deg`.
 */
function heartLeaf(tip, deg, { r = 2.25, a = 1.6, h = 6 } = {}) {
  const cx = 12;
  const cy = 12 - h;
  const T = [12, 12];
  const lobe = (c, side) => angOf(c, T) + (side * Math.acos(r / len(sub(T, c))) * 180) / Math.PI;
  const cl = [cx - a, cy];
  const cr = [cx + a, cy];
  const top = [cx, cy - Math.sqrt(r * r - a * a)];
  const [t1, t2] = [lobe(cl, 1), lobe(cr, -1)];
  const arcTo = (c, a0, a1) => arc(...c, r, a0, a1).d.replace(/^M[^A]*/, '');
  const up = `M${pt(T)}L${pt(polar(...cl, r, t1))}${arcTo(cl, t1, angOf(cl, top) + 360)}${arcTo(cr, angOf(cr, top), t2 + 360)}Z`;
  return transform(turnPath(up, deg + 90, T), 1, tip[0] - 12, tip[1] - 12);
}

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
const GROUND = 20.75;
const L = lugares.icons;
// lugares's tree: its crown (three circles), its trunk (entering the crown up to 10.25) and branch
const TREE = L.tree.d;
const CROWN = [[7.5, 11, 4.25], [12, 6.75, 4.75], [16.5, 11, 4.25]];
// lugares's leaf: the lens along the diagonal and its stem, which runs into it as the midrib
const LEAF = L.leaf.d;
const STEM_FOOT = [3.25, 20.75];
/** A drawing made upright (stem down, along x = 12) laid on the leaf's diagonal. */
const onLeaf = (d) => turnPath(d, 45, [12, 12]);
const onLeafPt = (p) => rot(p, [12, 12], 45);

/**
 * potted-plant's pot: a rim band `w` wide on top of a tapered body, `h` tall in all from `top`.
 * Every potted plant stands in it, at the size it needs; what grows from it starts on the rim.
 */
function pot(cx, top, w, h, rim = 2.75) {
  const wb = w * 0.7;
  return [
    sq(cx - w / 2, top, w, rim, Math.min(1, rim / 2.75)),
    roundline([[cx - w / 2 + 0.75, top + rim], [cx - wb / 2, top + h], [cx + wb / 2, top + h], [cx + w / 2 - 0.75, top + rim]], [0, 1.25, 1.25, 0]),
  ];
}

/**
 * lugares's sprout at a small size (agricultura's sprig): its stem and two leaves scaled by s about
 * its foot and set down at `at`, each leaf kept at least 2.6 wide (scaled with the rest, a leaf's
 * inside closed up at bold); `ground` adds the sprout's own ground, scaled.
 */
function sprig(s, at, { lift = 0, ground: withGround = false } = {}) {
  const P = (p) => [at[0] + (p[0] - 12) * s, at[1] + (p[1] - 21) * s - lift];
  const w = Math.max(3.5 * s, 2.6);
  const d = [line(at, P([12, 10.5])), leaf(P([12, 14.75]), P([4.5, 10]), w), leaf(P([12, 10.25]), P([19.5, 5]), w)];
  return withGround ? [...d, line([at[0] - 4.5 * s, at[1]], [at[0] + 4.5 * s, at[1]])] : d;
}

/**
 * mascotas's paw inside a container: the same pad and its toes as a dense group of four dots
 * (r 0.3), spread so they stay apart at 2.1; centered on c, `k` scales it.
 */
function miniPaw([cx, cy], k = 1, r = 0.3) {
  const P = ([x, y]) => [cx + x * k, cy + y * k];
  const padD = roundpoly([[-1.1, 0.25], [1.1, 0.25], [2.6, 2.85], [-2.6, 2.85]].map(P), [0.9 * k, 0.9 * k, 1 * k, 1 * k]);
  return [padD, ...[[-4, -0.55], [-1.55, -2.85], [1.55, -2.85], [4, -0.55]].map((p) => dot(...P(p), r))];
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Trees ─────────────────────────────────────────────────────────────────────────────────────
{
  // Oak: a crown wider than the tree's and bumpier, of seven lobes, on a short trunk that forks
  // into two limbs under it.
  const cs = [[5.25, 10.25, 2.75], [7.25, 6.25, 3], [12, 5.5, 3], [16.75, 6.25, 3], [18.75, 10.25, 2.75], [15, 12.25, 2.75], [9, 12.25, 2.75]];
  add('tree-oak', ['roble', 'encino', 'árbol', 'madera', 'oak', 'oak tree', 'hardwood'], [
    union(cs, [12, 9.25]).d,
    line([12, 21.25], [12, 17.5]),
    line([9.25, 12], [12, 17.5], [14.75, 12]),
  ]);
}
{
  // Weeping willow: the trunk splits at its top into strands that arch over and fall straight
  // down like a curtain, each a little shorter than the one outside it.
  const T = [12, 12];
  const strand = (x, top, foot) => {
    const ax = (12 + x) / 2;
    const k = Math.abs(ax - x);
    return `M${pt(T)}C${pt([12, top + (T[1] - top) * 0.35])} ${pt([ax + (12 - ax) * 0.55, top])} ${pt([ax, top])}C${pt([ax - (ax - x) * 0.55, top])} ${pt([x, top + k * 0.45])} ${pt([x, top + k])}V${N(foot)}`;
  };
  add('tree-willow', ['sauce llorón', 'sauce', 'árbol', 'estanque', 'willow', 'weeping willow', 'pond'], [
    line([12, 21.25], T),
    strand(3, 3, 18.25),
    strand(6.5, 6.5, 15.5),
    strand(21, 3, 17.5),
    strand(17.5, 6.5, 14.75),
  ]);
}
// Bare tree: a trunk that forks twice, its limbs bare, one reaching up and one out.
add('tree-bare', ['árbol sin hojas', 'invierno', 'árbol seco', 'latente', 'bare tree', 'winter', 'dormant'], [
  line([12, 21.25], [12, 14.25]),
  roundline([[12, 14.25], [8.5, 10], [7.75, 3.75]], [0, 1, 0]),
  line([8.5, 10], [4.25, 7.75]),
  roundline([[12, 14.25], [16, 9.25], [20, 7.25]], [0, 1, 0]),
  line([16, 9.25], [15.25, 3.75]),
]);
// Fruit tree: the tree's crown and trunk, a fruit hanging in each lobe.
add('tree-fruit', ['árbol frutal', 'huerto', 'frutas', 'jardín comestible', 'fruit tree', 'orchard', 'backyard'], [TREE[0], TREE[1], dot(7.5, 11.25, 1), dot(12, 6, 1), dot(16.5, 11.25, 1)]);
// Cypress: a tall narrow crown like a flame on a very short trunk (tree-pine's construction).
add('tree-cypress', ['ciprés', 'árbol', 'jardín formal', 'mediterráneo', 'cypress', 'columnar tree'], [
  'M12 2.5C14.25 5.25 16.5 9.5 16.5 13.75C16.5 16.5 14.5 18.25 12 18.25C9.5 18.25 7.5 16.5 7.5 13.75C7.5 9.5 9.75 5.25 12 2.5Z',
  line([12, 21.25], [12, 9.5]),
  line([12, 15], [13.5, 13.5]),
]);
// Baobab: a fat bottle of a trunk, short stubby branches spread flat from its top.
add('tree-baobab', ['baobab', 'sabana', 'árbol', 'África', 'baobab', 'savanna', 'ancient tree'], [
  'M7 21.25C7 16.5 10 15 10 10.75H14C14 15 17 16.5 17 21.25Z',
  roundline([[10, 10.75], [7, 8.25], [3, 8.25]], [0, 1.25, 0]),
  line([7, 8.25], [5.75, 4.75]),
  line([12, 10.75], [12, 4.25]),
  roundline([[14, 10.75], [17, 8.25], [21, 8.25]], [0, 1.25, 0]),
  line([17, 8.25], [18.25, 4.75]),
]);
// Umbrella acacia: a thin trunk leaning up into a fork, under a wide crown flat on top and bumpy
// underneath.
add('tree-acacia', ['acacia', 'sabana', 'safari', 'árbol', 'acacia', 'savanna', 'umbrella tree'], [
  'M5 3.75H19A2.25 2.25 0 0 1 19 8.25A3 3 0 0 1 14 8.75A3 3 0 0 1 10 8.75A3 3 0 0 1 5 8.25A2.25 2.25 0 0 1 5 3.75Z',
  'M13.25 21.25C13 19 12.25 17 11 15',
  line([7.25, 6.75], [11, 15], [15.75, 6.75]),
]);
{
  // Tree in bloom: the trunk carries three blossoms (the flower's five petals) instead of a crown.
  const B = [[12, 5.75], [6, 11.25], [18, 11.25]];
  const blossoms = B.map((c) => petals(c, 0.45));
  const hit = (i, from) => rayOut(blossoms[i], B[i], sub(from, B[i]));
  const fork = [12, 16.75];
  add('tree-blossom', ['árbol en flor', 'primavera', 'cerezo', 'floración', 'blossom tree', 'spring', 'bloom'], [
    ...blossoms.map((cs, i) => union(cs, B[i]).d),
    line([12, 21.25], hit(0, [12, 21])),
    line(fork, hit(1, fork)),
    line(fork, hit(2, fork)),
  ]);
}
{
  // Stump: a short trunk cut across (its top an ellipse with a growth ring), its roots flaring at
  // its foot.
  const C = [12, 7.75];
  add('tree-stump', ['tocón', 'árbol talado', 'tala', 'retiro de árboles', 'tree stump', 'felled tree', 'logging'], [
    ell(C, 7.25, 4.25),
    `M${pt([4.75, C[1]])}V15.5C4.75 18.25 4 19.75 2.75 20.75H21.25C20 19.75 19.25 18.25 19.25 15.5V${N(C[1])}`,
    ringArc(C, 3.5, 1.4, 200, 500),
  ]);
}
{
  // Rings: a trunk's cross-section, a little uneven, two growth rings inside, and a crack from its
  // edge to its heart.
  const C = [12, 12];
  const wob = [9, 8.6, 9.05, 8.75, 9, 8.55, 8.95, 8.7, 9.05, 8.6];
  const ring = (k) => smooth(wob.map((r, i) => polar(...C, r * k, -90 + i * 36)));
  add('tree-rings', ['anillos de árbol', 'tronco', 'madera', 'edad', 'historial', 'tree rings', 'wood', 'growth'], [
    ring(1),
    ring(0.62),
    ring(0.3),
    line(polar(...C, 8.9, -60), polar(...C, 4.5, -44), C),
  ]);
}
// Branch: a diagonal twig with a side shoot, and three leaves along it.
add('tree-branch', ['rama', 'ramita', 'naturaleza', 'decoración', 'branch', 'twig', 'nature'], [
  line([3.25, 20.75], [14.25, 9.75]),
  line([8.5, 15.5], [8.5, 10]),
  leaf([14.25, 9.75], [20.75, 3.25], 4.25),
  leaf([8.5, 10], [5.25, 3.25], 3.75),
  leaf([11.5, 12.5], [19.75, 14], 3.75),
]);
{
  // Plant a tree: the tree, moved up and left and a little smaller, with the engine's plus (as
  // mascotas's paw under a badge); its trunk still reaches the ground.
  const k = 0.82;
  const T = TREE.map((d) => place(d, k, [12, 2], [9.75, 2.25]));
  add('tree-plus', ['plantar árbol', 'reforestar', 'donar árbol', 'compensar', 'plant a tree', 'reforestation', 'offset'], [T[0], line([9.75, 21.25], placePt([12, 10.25], k, [12, 2], [9.75, 2.25])), T[2]], { badge: badge('plus') });
}
{
  // Bonsai: a shallow tray under an S-shaped trunk carrying two flat pads of foliage.
  add('bonsai', ['bonsái', 'árbol miniatura', 'paciencia', 'jardín japonés', 'bonsai', 'miniature tree'], [
    roundpoly([[3.75, 17.25], [20.25, 17.25], [18.75, GROUND], [5.25, GROUND]], [0.6, 0.6, 1, 1]),
    'M12.5 17.25C12.5 15 9 14.75 9 12.5C9 10 14.75 10.25 14.75 7',
    pad(2.75, 9, 12.75, 3.75),
    pad(11, 21, 7, 4),
  ]);
}
{
  // Sapling: a young tree (the tree's crown, small) tied to a straight stake on the ground; the
  // stake rises behind the crown.
  const s = 0.55;
  const at = [10.5, 11.25];
  const right = placePt(CROWN[2], s, [12, 11], at);
  const r = CROWN[2][2] * s;
  const xs = 14;
  const ys = right[1] + Math.sqrt(r * r - (xs - right[0]) ** 2);
  add('sapling', ['árbol joven', 'plantón', 'reforestación', 'tutor', 'sapling', 'young tree', 'reforestation'], [
    place(TREE[0], s, [12, 11], at),
    line([at[0], GROUND], [at[0], at[1] - 0.4]),
    line([xs, GROUND], [xs, ys]),
    ell([(at[0] + xs) / 2, 16.75], (xs - at[0]) / 2 + 1.25, 1.25),
    line([5.75, GROUND], [18.25, GROUND]),
  ]);
}
{
  // Evergreen branch: a twig whose tip bursts into a spray of needles, and a side shoot with a
  // smaller one.
  const burst = (p, deg, n, spread, l) => Array.from({ length: n }, (_, i) => line(p, polar(...p, l, deg - spread + (2 * spread * i) / (n - 1))));
  const tip = [12.75, 11.25];
  const side = [7.75, 9.5];
  add('pine-branch', ['rama de pino', 'abeto', 'conífera', 'invierno', 'pine branch', 'evergreen', 'fir'], [
    line([3.75, 20.25], tip),
    line([7.5, 16.5], side),
    ...burst(tip, -45, 5, 64, 7.75),
    ...burst(side, -100, 3, 40, 5.5),
  ]);
}

// ── Leaves ────────────────────────────────────────────────────────────────────────────────────
// Every leaf lies on the leaf's diagonal, drawn upright here (stem down along x = 12) and turned;
// its stem is the leaf's, running into the blade as its midrib.
{
  // Maple: a palmate leaf, three pointed lobes above and two below, each with its teeth.
  const half = [[1.25, 5.25], [3.25, 4], [2.75, 8.5], [5.75, 6.75], [6.25, 8.5], [9, 7.5], [7, 11.25], [8.25, 13], [4.25, 12.75], [5.5, 16.5], [1.5, 15], [0, 17]];
  const R = [0.4, 0.7, 0.35, 0.7, 0.35, 0.7, 0.35, 0.4, 0.7, 0.35, 0.7, 0.4];
  const pts = [[12, 2.25], ...half.map(([x, y]) => [12 + x, y]), ...half.slice(0, -1).reverse().map(([x, y]) => [12 - x, y])];
  const rr = [0.35, ...R, ...R.slice(0, -1).reverse()];
  add('leaf-maple', ['hoja de maple', 'arce', 'otoño', 'hoja', 'maple leaf', 'autumn', 'fall'], [onLeaf(roundpoly(pts, rr)), line(STEM_FOOT, onLeafPt([12, 11]))]);
}
{
  // Oak leaf: an elongated leaf whose edges ripple in round lobes, its midrib the leaf's stem.
  const right = [[12, 19.5], [15, 16.75], [15.5, 12.75], [15, 8.75]];
  const left = right.map(([x, y]) => [24 - x, y]).reverse();
  let d = `M${pt(right[0])}`;
  const lobe = (a, b, k = 1) => {
    const R = (len(sub(b, a)) / 2) * k;
    return `A${N(R)} ${N(R)} 0 0 0 ${pt(b)}`;
  };
  d += lobe(right[0], right[1], 1.3) + lobe(right[1], right[2]) + lobe(right[2], right[3]);
  d += lobe(right[3], left[0]);
  d += lobe(left[0], left[1]) + lobe(left[1], left[2]) + lobe(left[2], left[3], 1.3);
  add('leaf-oak', ['hoja de roble', 'roble', 'bosque', 'otoño', 'oak leaf', 'woodland', 'autumn'], [onLeaf(`${d}Z`), line(STEM_FOOT, onLeafPt([12, 10.5]))]);
}
{
  // Ginkgo: a fan narrowing to its stem, two lobes on its wide edge with a notch between them, on
  // a long thin stem.
  const F = [12, 16.75];
  const R = [20.5, 8.5];
  const Lf = [3.5, 8.5];
  const notch = [12, 6.5];
  const fan = `M${pt(F)}Q15.75 13.5 ${pt(R)}A6.5 6.5 0 0 0 ${pt(notch)}A6.5 6.5 0 0 0 ${pt(Lf)}Q8.25 13.5 ${pt(F)}Z`;
  add('leaf-ginkgo', ['ginkgo', 'hoja de ginkgo', 'memoria', 'herbolaria', 'ginkgo', 'ginkgo leaf', 'ancient'], [onLeaf(fan), line(STEM_FOOT, onLeafPt(F))]);
}
{
  // Monstera: a broad heart-shaped leaf, three slits cutting in from its edge.
  const slit = (E, toward, D = 3.75) => {
    const u = unit(sub(toward, E));
    const n = [-u[1], u[0]];
    const e1 = plus(E, scale(n, 1.5));
    const e2 = sub(E, scale(n, 1.5));
    return [e1, plus(e1, scale(u, D)), plus(e2, scale(u, D)), e2];
  };
  const pts = [
    [12, 2.5],
    [16.75, 3.75],
    ...slit([19.75, 8.75], [12, 10]),
    ...slit([19.5, 14.5], [12, 13.75]),
    [17.75, 18.5],
    [15, 19.5],
    [12, 17.25],
    [9, 19.5],
    [6.25, 18.5],
    [4, 14.5],
    ...slit([4.25, 10], [12, 11.5], 4.25),
    [7.25, 3.75],
  ];
  const rr = [0.6, 3, 0.6, 1.5, 1.5, 0.6, 0.6, 1.5, 1.5, 0.6, 2.5, 2, 0.5, 2, 2.5, 3, 0.6, 1.5, 1.5, 0.6, 3];
  add('leaf-monstera', ['monstera', 'costilla de Adán', 'planta tropical', 'decoración', 'monstera', 'houseplant', 'tropical'], [onLeaf(roundpoly(pts, rr)), line(STEM_FOOT, onLeafPt([12, 8.5]))]);
}
{
  // Fan palm leaf: pleated pointed segments fanning from the top of the stem, a pleat down each
  // fold.
  const F = [12, 15];
  const tips = [-162, -126, -90, -54, -18];
  const notches = [-144, -108, -72, -36];
  const pts = [F, polar(...F, 6.25, -180)];
  tips.forEach((a, i) => {
    pts.push(polar(...F, 9.5, a));
    if (i < notches.length) pts.push(polar(...F, 6.75, notches[i]));
  });
  pts.push(polar(...F, 6.25, 0));
  const rr = pts.map((_, i) => (i === 0 ? 1 : i === 1 || i === pts.length - 1 ? 1.5 : i % 2 ? 0.75 : 0.35));
  add('leaf-palm', ['hoja de palma', 'palmera', 'trópico', 'sombra', 'palm leaf', 'fan palm', 'tropical'], [
    onLeaf(roundpoly(pts, rr)),
    line(STEM_FOOT, onLeafPt(F)),
    ...notches.map((a) => onLeaf(line(F, polar(...F, 6.75, a)))),
  ]);
}
{
  // Fern: a frond on a curved midrib, its paired leaflets pointed and shrinking toward the tip.
  const right = [[3, 19.25], [8.75, 15.5], [3, 15], [8, 11], [3, 10.75], [6.75, 7], [2.75, 7], [4.5, 4.25]];
  const pts = [[12, 2.25], ...right.slice().reverse().map(([x, y]) => [12 + x, y]), [12, 19.5], ...right.map(([x, y]) => [12 - x, y])];
  // reorder: tip, right side from top down, base, left side from bottom up
  const ordered = [[12, 2.25], ...right.slice().reverse().map(([x, y]) => [12 + x, y]), ...right.map(([x, y]) => [12 - x, y])];
  void pts;
  const bend = (d) => turnPath(d, 12, [12, 21.25]);
  add('fern', ['helecho', 'fronda', 'sombra', 'bosque', 'fern', 'frond', 'forest'], [
    bend(roundpoly(ordered, ordered.map((_, i) => (i === 0 ? 0.5 : i % 2 ? 0.6 : 0.9)))),
    bend(line([12, 21.25], [12, 9.5])),
  ]);
}
{
  // Clover: three heart-shaped leaflets meeting at a point, on a short curved stem.
  const C = [12, 10.5];
  const opt = { r: 2.6, a: 1.85, h: 5.75 };
  add('clover', ['trébol', 'pasto', 'pradera', 'planta silvestre', 'clover', 'shamrock', 'meadow'], [
    heartLeaf(C, -90, opt),
    heartLeaf(C, 30, opt),
    heartLeaf(C, 150, opt),
    `M${pt(C)}C12 15 11.25 18.5 9 21.25`,
  ]);
}
{
  // Four-leaf clover: four heart-shaped leaflets in a cross, on a short curved stem.
  const C = [12, 11];
  const opt = { r: 2.4, a: 1.7, h: 5.25 };
  add('four-leaf-clover', ['trébol de cuatro hojas', 'suerte', 'sorteo', 'rifa', 'four-leaf clover', 'luck', 'giveaway'], [
    heartLeaf(C, -135, opt),
    heartLeaf(C, -45, opt),
    heartLeaf(C, 45, opt),
    heartLeaf(C, 135, opt),
    `M${pt(C)}C12 15.5 12.75 19 15 21.25`,
  ]);
}
{
  // Eucalyptus: a gently curved stem with round leaves like coins, alternating along it, each on
  // its own short stalk.
  const sx = (y) => 12 + 1.25 * Math.sin(((21.25 - y) / 18) * Math.PI);
  const stem = `M12 21.25C13.25 17 13.25 10 ${N(sx(4.5))} 4.5`;
  const coins = [[-1, 16.5, 2.35], [1, 12.5, 2.35], [-1, 8.5, 2.1], [1, 5, 1.9]];
  const coin = ([side, y, r]) => circ(sx(y) + side * (r + 2), y - 1, r);
  const stalk = ([side, y, r], i) => line(i === 3 ? [sx(4.5), 4.5] : [sx(y + 0.5), y + 0.5], [sx(y) + side * 2, y - 1]);
  add('eucalyptus', ['eucalipto', 'aromaterapia', 'spa', 'ramita', 'eucalyptus', 'aromatherapy', 'spa'], [stem, ...coins.map(coin), ...coins.map((c, i) => stalk(c, i))]);
}
{
  // Bamboo: two segmented stalks, their nodes across them, and two narrow leaves from a node.
  const A = [5.25, 2.75, 4, 18.5];
  const B = [12.25, 6.5, 4, 14.75];
  add('bamboo', ['bambú', 'zen', 'spa', 'sustentable', 'bamboo', 'zen', 'sustainable'], [
    sq(...A, 1.25),
    sq(...B, 1.25),
    line([5.25, 8.75], [9.25, 8.75]),
    line([5.25, 14.75], [9.25, 14.75]),
    line([12.25, 11.75], [16.25, 11.75]),
    leaf([16.25, 11.75], [20.5, 4.25], 3),
    leaf([16.25, 11.75], [21.25, 12.75], 2.75),
  ]);
}
{
  // Aloe vera: a thick fleshy leaf on the diagonal, its edges finely toothed, cut flat at its foot,
  // and a drop of gel falling from the cut.
  const up = [[9, 17.5], [9, 12.5], [8.25, 11.75], [9.25, 11.25], [9.75, 8], [9.25, 7.25], [10.25, 6.75], [12, 1.75], [13.75, 6.75], [14.75, 7.25], [14.25, 8], [14.75, 11.25], [15.75, 11.75], [15, 12.5], [15, 17.5]];
  const rr = [0.6, 0.4, 0.15, 0.4, 0.5, 0.15, 0.4, 0.3, 0.4, 0.15, 0.5, 0.4, 0.15, 0.4, 0.6];
  const T = (d) => transform(turnPath(d, 40, [12, 17.5]), 1, -3.5, 0);
  add('aloe-vera', ['sábila', 'aloe vera', 'gel', 'cuidado de la piel', 'aloe vera', 'skincare', 'after sun'], [
    T(roundpoly(up, rr)),
    place(L.droplet.d[0], 0.28, [12, 13.5], [6, 18.5]),
  ]);
}
{
  // Succulent: an echeveria seen from above, two rings of pointed fleshy leaves.
  const rosette = (c, n, rt, rn, a0) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * 360) / n;
      const n0 = polar(...c, rn, a - 180 / n);
      const t = polar(...c, rt, a);
      const n1 = polar(...c, rn, a + 180 / n);
      const R0 = len(sub(t, n0)) * 0.85;
      d += `${i ? '' : `M${pt(n0)}`}A${N(R0)} ${N(R0)} 0 0 1 ${pt(t)}A${N(R0)} ${N(R0)} 0 0 1 ${pt(n1)}`;
    }
    return `${d}Z`;
  };
  add('succulent', ['suculenta', 'echeveria', 'planta de poco riego', 'roseta', 'succulent', 'echeveria', 'low water'], [rosette([12, 12], 8, 9.25, 6.75, -90), rosette([12, 12], 5, 4.75, 2.5, -90)]);
}
{
  // Barrel cactus: a squat round ribbed body in a small pot, a small flower on its top.
  const P = pot(12, 16, 11, 5.25);
  const bloom = [12, 5.1];
  const cs = petals(bloom, 0.32);
  add('cactus-barrel', ['cactus', 'biznaga', 'planta de interior', 'desierto', 'barrel cactus', 'cacti', 'houseplant'], [
    ...P,
    `M7.5 16A6.75 5.25 0 1 1 16.5 16`,
    'M10 16C9.5 14 9.5 12.25 10.25 10.75',
    'M14 16C14.5 14 14.5 12.25 13.75 10.75',
    union(cs, bloom).d,
  ]);
}
{
  // Snake plant: tall sword-shaped leaves of different heights rising from the pot.
  const P = pot(12, 13.5, 12, 7.75);
  const sword = (x0, x1, tip, lean) => `M${pt([x0, 13.5])}C${pt([x0 + lean * 0.2, 10])} ${pt([tip[0] - 0.75, tip[1] + 3])} ${pt(tip)}C${pt([tip[0] + 0.75, tip[1] + 3])} ${pt([x1 + lean * 0.2, 10])} ${pt([x1, 13.5])}`;
  add('snake-plant', ['lengua de suegra', 'sansevieria', 'planta de interior', 'purifica el aire', 'snake plant', 'sansevieria', 'houseplant'], [
    ...P,
    sword(7.25, 10.25, [6.5, 5], -1),
    sword(10.25, 13.75, [12, 2.5], 0),
    sword(13.75, 16.75, [17.75, 6.5], 1),
  ]);
}
{
  // Venus flytrap: a stem ending in a trap of two lobes hinged at its top and opened wide, a row of
  // teeth along each rim.
  const H = [12, 14.5];
  const A = [4, 7.25];
  const B = [20, 7.25];
  const lobe = (E, sweep) => `M${pt(H)}L${pt(E)}A6 6 0 0 ${sweep} ${pt(H)}Z`;
  const teeth = (E, side) => {
    const u = unit(sub(E, H));
    const n = side > 0 ? [u[1], -u[0]] : [-u[1], u[0]];
    return [0.46, 0.73, 1].map((t) => {
      const p = lerp(H, E, t);
      return line(p, plus(p, scale(n, 2.25)));
    });
  };
  add('venus-flytrap', ['planta carnívora', 'venus atrapamoscas', 'trampa', 'atrapar', 'venus flytrap', 'carnivorous plant', 'trap'], [
    line([12, 21.25], H),
    lobe(A, 0),
    lobe(B, 1),
    ...teeth(A, -1),
    ...teeth(B, 1),
  ]);
}
// Grass: a tuft of five pointed blades of different heights rising from the ground.
add('grass', ['pasto', 'césped', 'jardín', 'cuidado del pasto', 'grass', 'lawn', 'turf'], [
  'M6 20.75C6 16.25 5.25 12.25 3.25 9.5',
  'M9 20.75C9 14.5 8.75 9.5 7 5.5',
  'M12 20.75C12 13.5 12.25 7.25 13.25 3',
  'M15 20.75C15 15 15.5 10.5 17.5 7',
  'M18 20.75C18 17 18.75 14 20.75 12',
  line([2.75, GROUND], [21.25, GROUND]),
]);
{
  // Wildflowers: three small flowers of different heights on thin stems, rising from the ground.
  const heads = [[5.5, 11.75], [12, 5.25], [18.5, 9.75]];
  const k = 0.4;
  const cs = heads.map((c) => petals(c, k));
  add('wildflowers', ['flores silvestres', 'pradera', 'polinizadores', 'plantas nativas', 'wildflowers', 'meadow', 'pollinators'], [
    ...cs.map((c, i) => union(c, heads[i]).d),
    ...heads.map((h, i) => line([h[0], GROUND], rayOut(cs[i], h, [0, 1]))),
    line([2.75, GROUND], [21.25, GROUND]),
  ]);
}
// Cattails: two tall stems topped by their sausage-shaped heads, a long narrow leaf curving beside
// them.
add('cattail', ['tule', 'espadaña', 'humedal', 'estanque', 'cattail', 'reeds', 'wetland'], [
  capsule(6.5, 5, 3, 7.5),
  capsule(12.75, 8, 3, 6.5),
  line([8, GROUND], [8, 12.5]),
  line([8, 5], [8, 2.75]),
  line([14.25, GROUND], [14.25, 14.5]),
  line([14.25, 8], [14.25, 5.75]),
  'M17.5 20.75C17.5 14 18.25 9 20.75 4.5C19.75 9.5 19.75 15 20.5 20.75',
  line([2.75, GROUND], [21.25, GROUND]),
]);
{
  // Vine: a curving stem ending in a spiral tendril, three leaves along it.
  const curl = (c, r0, r1, a0, a1, steps = 6) => {
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p = polar(...c, r0 + (r1 - r0) * t, a0 + (a1 - a0) * t);
      d += `${i ? 'L' : 'M'}${pt(p)}`;
    }
    return d;
  };
  void curl;
  add('vine', ['enredadera', 'trepadora', 'crecimiento', 'planta', 'vine', 'climber', 'creeper'], [
    'M3.25 20.75C7 18.5 8.5 14.5 10.75 11C12.75 8 16 7.5 17.25 9.25A2.25 2.25 0 0 1 13.75 11.5A1.25 1.25 0 0 1 15.25 9.75',
    leaf([6.75, 17.5], [3.25, 12.5], 3.5),
    leaf([9.25, 13.25], [15.75, 15.25], 3.5),
    leaf([12, 9.5], [9.75, 3.25], 3.5),
  ]);
}
{
  // Ivy: a strand hanging from a top line and curving down, pointed three-lobed leaves hanging
  // along it.
  const ivy = (base, deg, s = 1) => {
    const up = roundpoly([[0, 0], [-2.75, 0.25], [-4.25, -2.75], [-1.5, -3], [0, -6.5], [1.5, -3], [4.25, -2.75], [2.75, 0.25]].map(([x, y]) => [12 + x * s, 12 + y * s]), [0.4, 0.75, 0.4, 0.5, 0.4, 0.5, 0.4, 0.75]);
    return transform(turnPath(up, deg + 90, [12, 12]), 1, base[0] - 12, base[1] - 12);
  };
  add('ivy', ['hiedra', 'enredadera', 'colgante', 'muro verde', 'ivy', 'trailing plant', 'climbing'], [
    line([3.25, 3.25], [20.75, 3.25]),
    'M11.5 3.25C11.5 7.5 13.25 9.25 13.25 12.5C13.25 15 12.25 16.5 11.25 17.5',
    ivy([12.25, 7.25], 145, 0.85),
    ivy([13.25, 12.5], 40, 0.85),
    ivy([11.25, 17.5], 125, 0.65),
  ]);
}
// Bush: three rounded lobes merged into one mound, sitting on the ground.
add('bush', ['arbusto', 'matorral', 'jardinería', 'paisajismo', 'bush', 'shrub', 'landscaping'], [mound([[7, 16.75, 4.25], [12, 11.25, 5.25], [17, 16.75, 4.25]], GROUND), line([2.75, GROUND], [21.25, GROUND])]);
// Hedge: a long trimmed block, straight sides and a softly bumpy top, on the ground.
add('hedge', ['seto', 'cerco vivo', 'privacidad', 'poda de setos', 'hedge', 'privacy hedge', 'hedge trimming'], [
  'M3.75 20.75V11.25A2 2 0 0 1 5.75 9A2.1 2.1 0 0 1 9.25 8.5A2.1 2.1 0 0 1 12.75 8.5A2.1 2.1 0 0 1 16.25 8.5A2.1 2.1 0 0 1 18.25 9A2 2 0 0 1 20.25 11.25V20.75',
  line([2.75, GROUND], [21.25, GROUND]),
]);
// Topiary: a clipped ball on a straight thin stem, standing in a square planter.
add('topiary', ['topiario', 'planta podada', 'jardín formal', 'entrada', 'topiary', 'clipped plant', 'formal garden'], [
  circ(12, 6.75, 4.25),
  line([12, 11], [12, 15.75]),
  sq(7.75, 15.75, 8.5, 5.5, 1.25, { square: ['br'] }),
  line([6.75, 15.75], [17.25, 15.75]),
]);
{
  // Trellis: a diamond lattice in its frame, a vine with two leaves climbing up through it (on
  // top, so the engine clears the lattice around it).
  const lat = [line([6.25, 3.25], [19.25, 16.25]), line([17.75, 3.25], [4.75, 16.25])];
  const vine = 'M12 21.25C12 17.25 8.5 15.25 8.5 11.5C8.5 8.25 11.5 6.5 14.25 6';
  const lv = [leaf([8.75, 13.25], [3.75, 10.75], 3.5), leaf([10.75, 7.5], [15.25, 11.25], 3.5)];
  add('trellis', ['enrejado', 'celosía', 'trepadoras', 'jardín vertical', 'trellis', 'lattice', 'climbing plants'], [sq(4.75, 3.25, 14.5, 17.5, 1.5, { square: ['br'] }), ...lat], {
    badge: { d: [vine, ...lv], knock: `${vine}${lv.join('')}`, fill: { solid: lv, wire: [vine] } },
  });
}
// Leaf pile: a low mound on the ground with three leaves sticking out of it at odd angles.
add('leaf-pile', ['montón de hojas', 'hojarasca', 'otoño', 'limpieza de jardín', 'leaf pile', 'fall cleanup', 'yard waste'], [
  'M3.5 20.75C4.25 17 7.75 14.75 12 14.75C16.25 14.75 19.75 17 20.5 20.75',
  leaf([6.5, 16.75], [2.75, 12.75], 3.5),
  leaf([10.5, 14.75], [16, 6.25], 4),
  leaf([17.25, 16.5], [21.25, 11.5], 3.25),
  line([2.75, GROUND], [21.25, GROUND]),
]);

// ── Flowers ───────────────────────────────────────────────────────────────────────────────────
// The flowers on a stem stand on the flower's: a 1.5 stem down to 21.25 and, at its foot, the
// flower's leaf (lugares's flower).
const STEM_LEAF = L.flower.d[3];
const stem = (top) => line(top, [12, 21.25]);
{
  // Rose: a cupped bloom, its petals curling in to a spiral at its heart, on a stem with a thorn
  // and the leaf.
  const cup = 'M12 13.5C8.5 13.5 6.25 11 6.25 7.5C6.25 5.75 7 4.5 8.25 3.5C9.25 5 10.5 5.75 12 5.75C13.5 5.75 14.75 5 15.75 3.5C17 4.5 17.75 5.75 17.75 7.5C17.75 11 15.5 13.5 12 13.5Z';
  add('rose', ['rosa', 'amor', 'regalo', 'florería', 'rose', 'love', 'florist'], [
    cup,
    'M6.35 9C8 10.75 10.75 10.75 12.25 9.25C13.25 8.25 13 6.75 12 5.75',
    stem([12, 13.5]),
    STEM_LEAF,
    line([12, 17.25], [9.75, 16]),
  ]);
}
// Tulip: a cup of three pointed petals on a straight stem, a long leaf curving up beside it.
add('tulip', ['tulipán', 'primavera', 'bulbos', 'florería', 'tulip', 'spring', 'bulbs'], [
  roundpoly([[7, 4], [9.75, 6.5], [12, 2.75], [14.25, 6.5], [17, 4], [17, 8.5], [15, 12.75], [9, 12.75], [7, 8.5]], [0.5, 0.75, 0.5, 0.75, 0.5, 2.5, 2.5, 2.5, 2.5]),
  stem([12, 12.75]),
  'M12 20.25C9 19.5 6.5 17.25 6.25 13.75C8.75 14.5 10.5 16 12 17.75',
]);
{
  // Sunflower: a ring of short pointed petals around a large round center, on the stem with a leaf
  // on each side.
  const C = [12, 8.25];
  const n = 14;
  const pts = Array.from({ length: 2 * n }, (_, i) => polar(...C, i % 2 ? 4.85 : 6.5, -90 + (i * 180) / n));
  add('sunflower', ['girasol', 'verano', 'sol', 'alegría', 'sunflower', 'summer', 'sunshine'], [
    roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.5 : 0.3))),
    circ(...C, 2),
    stem([12, C[1] + 4.85]),
    STEM_LEAF,
    transform(flipPath(STEM_LEAF), 1, 0, -2),
  ]);
}
{
  // Daisy: head-on, eight long rounded petals around a small round center.
  const C = [12, 12];
  const n = 8;
  const half = 180 / n;
  const r = 1.75;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = -90 + (i * 360) / n;
    const tc = polar(...C, 7.25, a);
    d += `${i ? 'L' : 'M'}${pt(polar(...C, 4, a - half))}L${pt(polar(...tc, r, a - 90))}A${r} ${r} 0 0 1 ${pt(polar(...tc, r, a + 90))}`;
  }
  add('daisy', ['margarita', 'manzanilla', 'flor', 'frescura', 'daisy', 'chamomile', 'flower'], [`${d}Z`, dot(...C, 1)]);
}
{
  // Cherry blossom: five round petals, each with a small notch at its tip, around a ring of
  // stamens.
  const C = [12, 12.25];
  const k = 1.2;
  const cs = petals(C, k);
  const u = union(cs, C);
  // Split each petal's outer arc at its tip and cut a small V into it
  const n = cs.length;
  let d = `M${pt(u.X[n - 1])}`;
  cs.forEach((P, i) => {
    const a = angOf(C, P);
    const r = P[2];
    const t0 = polar(P[0], P[1], r, a - 16);
    const t1 = polar(P[0], P[1], r, a + 16);
    const v = polar(P[0], P[1], r - 1.75, a);
    d += `A${N(r)} ${N(r)} 0 0 1 ${pt(t0)}L${pt(v)}L${pt(t1)}A${N(r)} ${N(r)} 0 0 1 ${pt(u.X[i])}`;
  });
  add('cherry-blossom', ['flor de cerezo', 'sakura', 'primavera', 'hanami', 'cherry blossom', 'sakura', 'spring'], [`${d}Z`, ...[0, 1, 2, 3, 4].map((i) => dot(...polar(...C, 2.5, -54 + i * 72), 0.4))]);
}
{
  // Hibiscus: five broad petals, and the long stamen column reaching out past them from the center.
  const C = [11, 13];
  const cs = petals(C, 1.25, -72);
  add('hibiscus', ['hibisco', 'jamaica', 'trópico', 'isla', 'hibiscus', 'tropical', 'island'], [union(cs, C).d, line(C, [18.75, 5.25]), dot(19.25, 4.75, 1)]);
}
{
  // Orchid: wide side petals around a narrow top and two narrow lower sepals, the pouched lip at
  // its heart, on an arching stem.
  const C = [13.25, 10];
  const cs = [[13.25, 5.25, 2.5], [17.25, 9.25, 3.25], [15.25, 14, 2.5], [11.25, 14, 2.5], [9.25, 9.25, 3.25]];
  add('orchid', ['orquídea', 'florería', 'spa', 'lujo', 'orchid', 'florist', 'luxury'], [
    union(cs, C).d,
    leaf([13.25, 8.5], [13.25, 13.75], 3),
    'M3.25 21.25C3.25 15.25 5 12.5 7.25 11.5',
  ]);
}
{
  // Lily: a trumpet of pointed petals curling back at their tips, three stamens out of its throat,
  // on the stem.
  add('lily', ['lirio', 'azucena', 'elegancia', 'condolencias', 'lily', 'sympathy', 'florist'], [
    'M12 14C9.75 12.25 8.5 9.75 8.25 7.25C6.75 6.25 5 6.25 3.5 7C4.5 4.5 6.5 3.5 8.75 4C9.75 3 10.75 2.5 12 2.5C13.25 2.5 14.25 3 15.25 4C17.5 3.5 19.5 4.5 20.5 7C19 6.25 17.25 6.25 15.75 7.25C15.5 9.75 14.25 12.25 12 14Z',
    stem([12, 14]),
    STEM_LEAF,
  ]);
}
{
  // Water lily: a round floating pad with a wedge cut into it, a pointed bloom standing on it.
  const C = [12, 16.75];
  const rx = 9;
  const ry = 3.25;
  const P = (a) => [C[0] + rx * Math.cos((a * Math.PI) / 180), C[1] + ry * Math.sin((a * Math.PI) / 180)];
  const padD = `M${pt(P(65))}A${rx} ${ry} 0 1 1 ${pt(P(40))}L${pt([C[0] + 1.5, C[1] + 0.25])}Z`;
  add('water-lily', ['nenúfar', 'estanque', 'planta acuática', 'jardín acuático', 'water lily', 'pond', 'aquatic plant'], [
    padD,
    leaf([12, 13.5], [12, 4], 5),
    leaf([11.25, 13.5], [5.5, 7.25], 3.75),
    leaf([12.75, 13.5], [18.5, 7.25], 3.75),
  ]);
}
{
  // Dandelion: a seed head of rays with a seed at each tip, on a thin stem.
  const C = [12, 9.75];
  const rays = [162, -162, -126, -90, -54, -18, 18];
  add('dandelion', ['diente de león', 'pide un deseo', 'semillas', 'fragilidad', 'dandelion', 'make a wish', 'seeds'], [
    ...rays.map((a) => line(C, polar(...C, 6.25, a))),
    ...rays.map((a) => dot(...polar(...C, 6.25, a), 0.7)),
    `M${pt(C)}C12 14 12.5 17.5 13.5 21.25`,
  ]);
}
{
  // Daffodil: a star of six pointed petals, the trumpet cup in front of it, on the stem.
  const C = [12, 8.5];
  const pts = Array.from({ length: 12 }, (_, i) => polar(...C, i % 2 ? 4 : 6.75, -90 + i * 30));
  const cup = scallops(C, 3, 8, 0.6);
  add('daffodil', ['narciso', 'primavera', 'floración temprana', 'jardín', 'daffodil', 'narcissus', 'spring'], [roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.75 : 0.4))), stem([12, C[1] + 6.75]), STEM_LEAF], {
    badge: { d: [cup], knock: cup, fill: { solid: [cup] } },
  });
}
{
  // Poppy: four round petals around a dark center, on a thin curving stem.
  const C = [12, 8.75];
  const cs = [45, 135, 225, 315].map((a) => [...polar(...C, 3.5, a - 90 + 90), 3.35]);
  const ordered = [cs[2], cs[3], cs[0], cs[1]];
  add('poppy', ['amapola', 'flor silvestre', 'campo', 'verano', 'poppy', 'wildflower', 'meadow'], [
    union(ordered, C).d,
    circ(...C, 1.5),
    `M${pt(rayOut(ordered, C, [0, 1]))}C12 16 10.5 18.5 9.75 21.25`,
  ]);
}
{
  // Marigold: a dense round pompom of short ruffled petals around its round heart, on the stem
  // with the leaf.
  const C = [12, 9];
  add('marigold', ['cempasúchil', 'caléndula', 'Día de Muertos', 'guirnalda', 'marigold', 'cempasuchil', 'garland'], [scallops(C, 5.75, 12, 1.25), circ(...C, 2.25), stem([12, C[1] + 5.75]), STEM_LEAF]);
}
// Flower bud: a closed teardrop held by two small pointed sepals (one outline), on the stem with
// the leaf.
add('flower-bud', ['capullo', 'botón', 'próximamente', 'por florecer', 'flower bud', 'coming soon', 'bloom'], [
  'M12 15C10 14.5 8.25 12.75 7.25 10.25C8.25 10.5 8.75 10.75 9.25 11.25C8.75 8.25 10 5.25 12 2.75C14 5.25 15.25 8.25 14.75 11.25C15.25 10.75 15.75 10.5 16.75 10.25C15.75 12.75 14 14.5 12 15Z',
  stem([12, 15]),
  STEM_LEAF,
]);
{
  // Wilted flower: the flower on a stem that bends over, its head hanging down, a petal falling.
  const head = [16.75, 12.5];
  const cs = petals(head, 0.55, 90);
  add('flower-wilted', ['flor marchita', 'vencido', 'pasado', 'tristeza', 'wilted flower', 'expired', 'fading'], [
    union(cs, head).d,
    `M7.75 21.25C7.75 14 8.75 6 13.25 5C15.5 4.5 16.75 6.25 ${pt(rayOut(cs, head, [0, -1]))}`,
    leaf([17, 19.25], [20.25, 20.75], 2.6),
  ]);
}
{
  // Flowers in a vase: a narrow-necked vase holding two stems with small blooms and a leaf.
  const b1 = [7.5, 6];
  const b2 = [16, 4.75];
  const c1 = petals(b1, 0.42);
  const c2 = petals(b2, 0.42);
  add('flower-vase', ['flores en jarrón', 'florero', 'decoración', 'envío de flores', 'flower vase', 'bouquet', 'flower delivery'], [
    'M10.25 12.5H13.75V13.5C13.75 14.25 17 15 17 17.75C17 19.75 16.25 21.25 14.5 21.25H9.5C7.75 21.25 7 19.75 7 17.75C7 15 10.25 14.25 10.25 13.5Z',
    `M11.25 12.5C11.25 10.5 ${pt([b1[0] + 0.5, 11])} ${pt(rayOut(c1, b1, [0.3, 1]))}`,
    `M12.75 12.5C12.75 10 15.5 10.5 ${pt(rayOut(c2, b2, [0, 1]))}`,
    union(c1, b1).d,
    union(c2, b2).d,
    leaf([12.75, 11], [19.5, 10.5], 3),
  ]);
}

// ── Potted plants ─────────────────────────────────────────────────────────────────────────────
// potted-plant: three leaves on stems rising from the pot; its badge siblings move it up and left,
// a little smaller, so the badge takes only the pot's corner.
const POTTED = [
  ...pot(12, 13.25, 12, 8),
  line([12, 13.25], [12, 9.25]),
  leaf([12, 9.25], [12, 2.75], 4),
  'M10.25 13.25C10.25 11.5 9.25 10.25 7.75 10',
  leaf([7.75, 10], [3.25, 5.25], 3.75),
  'M13.75 13.25C13.75 11.5 14.75 10.25 16.25 10',
  leaf([16.25, 10], [20.75, 5.25], 3.75),
];
add('potted-plant', ['planta en maceta', 'planta de interior', 'mis plantas', 'vivero', 'potted plant', 'houseplant', 'plant shop'], POTTED);
const POTTED_B = POTTED.map((d) => place(d, 0.84, [12, 2.75], [10, 2.5]));
add('potted-plant-plus', ['agregar planta', 'nueva planta', 'colección', 'mis plantas', 'add plant', 'new plant', 'collection'], POTTED_B, { badge: badge('plus') });
add('potted-plant-alert', ['planta necesita atención', 'cuidado atrasado', 'problema', 'alerta de planta', 'plant alert', 'needs attention', 'care overdue'], POTTED_B, { badge: badge('alert') });
// Seedling in a small pot: lugares's sprout rising from the pot's rim.
add('potted-sprout', ['plántula en maceta', 'principiante', 'plan inicial', 'nutrir', 'potted sprout', 'seedling', 'starter'], [...pot(12, 14.25, 10, 7), ...sprig(0.7, [12, 14.25])]);
// Plant pot: the pot, empty, its rim thicker, sitting on a saucer.
add('plant-pot', ['maceta', 'macetero', 'trasplante', 'tamaño de maceta', 'plant pot', 'planter', 'flowerpot'], [
  ...pot(12, 4.25, 14, 14, 3.25),
  roundpoly([[4.5, 18.25], [19.5, 18.25], [18.25, 21], [5.75, 21]], [0.5, 0.5, 0.75, 0.75]),
]);
{
  // Hanging plant: a round pot held by three cords that meet at a hook, two leafy strands trailing
  // from it.
  const K = [12, 5.5];
  add('hanging-plant', ['planta colgante', 'macramé', 'maceta colgante', 'colgante', 'hanging plant', 'hanging basket', 'macrame'], [
    `M${pt(K)}V3.5A1.5 1.5 0 1 1 15 3.5`,
    line(K, [6.5, 11.5]),
    line(K, [12, 11.5]),
    line(K, [17.5, 11.5]),
    'M6.5 11.5H17.5A5.5 5.5 0 0 1 6.5 11.5Z',
    'M6.5 11.5C4.5 12.5 3.5 14.75 3.5 17',
    leaf([3.5, 17], [3.75, 21.25], 2.6),
    'M17.5 11.5C19.5 12.5 20.5 14.75 20.5 17',
    leaf([20.5, 17], [20.25, 21.25], 2.6),
  ]);
}
// Plant cutting: a stem with two leaves standing in a glass of water, short roots under it.
add('plant-cutting', ['esqueje', 'propagación', 'enraizar', 'compartir planta', 'plant cutting', 'propagation', 'rooting'], [
  roundline([[6.75, 9.75], [7.75, 21.25], [16.25, 21.25], [17.25, 9.75]], [0, 1.5, 1.5, 0]),
  line([7.05, 13.25], [16.95, 13.25]),
  line([12, 17.25], [12, 5.75]),
  leaf([12, 5.75], [7.25, 2.75], 3),
  leaf([12, 7.25], [17.5, 5], 3),
  'M12 17.25C11.75 17.75 11.25 18 10.5 18.25',
  'M12 17.25C12.25 17.75 12.75 18 13.5 18.25',
]);
{
  // Repotting: the plant lifted out with its root ball above an empty pot, a short arc arrow
  // showing the move down into it.
  const a = arc(13.5, 13, 5.25, -60, 40);
  add('repotting', ['trasplantar', 'cambiar de maceta', 'cuidado de plantas', 'maceta más grande', 'repotting', 'repot', 'plant care'], [
    ...pot(9.5, 15.5, 11, 5.75),
    ell([9.5, 10.25], 3, 2.25),
    ...sprig(0.34, [9.5, 8]),
    a.d,
    head(a.end, a.tangent, 3),
  ]);
}
{
  // Window box: a long planter resting on the window's sill, three small flowers growing in it.
  const heads = [[6.75, 9.5], [12, 5.25], [17.25, 9.5]];
  const cs = heads.map((c) => petals(c, 0.32));
  add('window-box', ['jardinera de ventana', 'balcón', 'alféizar', 'jardín pequeño', 'window box', 'balcony garden', 'window sill'], [
    roundline([[4.25, GROUND], [4.25, 14.75], [19.75, 14.75], [19.75, GROUND]], [0, 1, 1, 0]),
    line([2.75, GROUND], [21.25, GROUND]),
    ...cs.map((c, i) => union(c, heads[i]).d),
    ...heads.map((h, i) => line([h[0], 14.75], rayOut(cs[i], h, [0, 1]))),
  ]);
}
// Terrarium: a rounded glass jar under its lid, a layer of soil and a small plant growing in it.
add('plant-terrarium', ['terrario', 'jardín de vidrio', 'ecosistema', 'decoración', 'terrarium', 'glass garden', 'ecosystem'], [
  sq(4.75, 7, 14.5, 14.25, 4.5, { square: ['br'] }),
  sq(7.25, 3.75, 9.5, 3.25, 1),
  line([4.75, 16.75], [19.25, 16.75]),
  ...sprig(0.55, [12, 16.75]),
]);
// Seed: a plump seed, its seam curving along one side, its tip pointed.
add('seed', ['semilla', 'origen', 'potencial', 'ronda semilla', 'seed', 'origin', 'seed round'], [
  'M17.75 4.25C19.25 9.5 18.25 16 13.75 19.25C10.25 21.75 5.5 20.5 4.75 16.25C4 12 7.5 8.25 11.25 6.5C13.5 5.5 15.75 4.75 17.75 4.25Z',
  'M17.75 4.25C16.75 9.25 14.75 13.25 11 15.75',
]);
// Acorn: an oval nut under its textured cap, a short stem on top.
add('acorn', ['bellota', 'otoño', 'roble', 'ahorro', 'acorn', 'autumn', 'saving'], [
  'M6.75 11.25C6.75 16.25 9 19.75 12 21.25C15 19.75 17.25 16.25 17.25 11.25',
  `M4.75 11.25C4.75 7.5 8 5.25 12 5.25C16 5.25 19.25 7.5 19.25 11.25Z`,
  line([12, 5.25], [13.5, 2.75]),
  line([8.75, 6], [11.75, 11.25]),
  line([15.25, 6], [12.25, 11.25]),
]);
{
  // Pine cone: an egg-shaped cone of overlapping scales in rows, a short stem on top.
  const C = [12, 13];
  const rx = 5.5;
  const ry = 8;
  const at = (y) => rx * Math.sqrt(Math.max(0, 1 - ((y - C[1]) / ry) ** 2));
  const row = (y, n) => {
    const w = at(y);
    const x0 = C[0] - w;
    const step = (2 * w) / n;
    let d = `M${pt([x0, y])}`;
    for (let i = 1; i <= n; i++) d += `A${N(step / 2)} ${N(step / 2)} 0 0 0 ${pt([x0 + i * step, y])}`;
    return d;
  };
  add('pinecone', ['piña de pino', 'bosque', 'invierno', 'conífera', 'pine cone', 'forest', 'conifer'], [ell(C, rx, ry), line([12, 5], [12, 2.5]), row(9.25, 2), row(13.25, 3), row(17.25, 2)]);
}
// Seed packet: a paper packet, its top folded over, a sprout drawn on its face.
add('seed-packet', ['sobre de semillas', 'sembrar', 'semillas', 'vivero', 'seed packet', 'sowing', 'seeds'], [
  sq(5.25, 2.75, 13.5, 18.5, 2, { square: ['br'] }),
  line([5.25, 7], [18.75, 7]),
  ...sprig(0.5, [12, 18.25]),
]);
// Flower bulb: a teardrop bulb with a pointed shoot at its top and short roots at its foot.
add('flower-bulb', ['bulbo', 'plantar bulbos', 'tulipanes', 'otoño', 'flower bulb', 'bulbs', 'planting'], [
  'M12 6.25C14.25 8.5 17.25 11 17.25 14.5C17.25 17.25 15 18.75 12 18.75C9 18.75 6.75 17.25 6.75 14.5C6.75 11 9.75 8.5 12 6.25Z',
  leaf([12, 6.25], [13.25, 2], 2.6),
  'M10.25 18.6C9.75 19.75 9 20.5 8 21.25',
  line([12, 18.75], [12, 21.25]),
  'M13.75 18.6C14.25 19.75 15 20.5 16 21.25',
]);
// Toadstool: a domed cap with round spots, on a stem with a skirt ring.
add('toadstool', ['hongo silvestre', 'amanita', 'venenoso', 'cuento de hadas', 'toadstool', 'wild mushroom', 'poisonous'], [
  'M3.25 12C3.25 7 7.25 3.5 12 3.5C16.75 3.5 20.75 7 20.75 12Z',
  'M9.75 12V19.25C9.75 20.5 10.75 21.25 12 21.25C13.25 21.25 14.25 20.5 14.25 19.25V12',
  'M9.75 14.5C8.5 15 8 15.75 8 16.5H16C16 15.75 15.5 15 14.25 14.5',
  dot(8, 8.25, 1),
  dot(12.5, 6.5, 1),
  dot(16, 9, 1),
]);
{
  // Plant light: a sprout under a sun whose rays light up as levels (low, medium, bright).
  const S = [12, 8.5];
  const ray = (a) => line(polar(...S, 4.6, a), polar(...S, 6.6, a));
  add('plant-light', ['luz para plantas', 'necesidad de luz', 'sol', 'sombra', 'plant light', 'light needs', 'sunlight'], [
    circ(...S, 1.75),
    ray(-90),
    ray(-135),
    ray(-45),
    ray(180),
    ray(0),
    ...sprig(0.48, [12, 21.25], { ground: true }),
  ]);
}
{
  // Plant water: a sprout under three drops that light up as levels.
  const drop = (x) => place(L.droplet.d[0], 0.25, [12, 13.5], [x, 7]);
  add('plant-water', ['riego', 'necesidad de agua', 'gotas', 'cuidado de plantas', 'plant water', 'water needs', 'watering'], [drop(5.5), drop(12), drop(18.5), ...sprig(0.5, [12, 21], { ground: true })]);
}
{
  // Plant humidity: an upright leaf with three short wavy lines of vapor beside it that light up as
  // levels.
  const wave = (x) => `M${pt([x, 17])}C${pt([x - 1, 15.25])} ${pt([x + 1, 13.5])} ${pt([x, 11.75])}C${pt([x - 1, 10])} ${pt([x + 1, 8.25])} ${pt([x, 6.5])}`;
  add('plant-humidity', ['humedad', 'ambiente húmedo', 'vapor', 'cuidado de plantas', 'plant humidity', 'humidity', 'misting'], [
    leaf([7.75, 18.5], [7.75, 2.75], 5.5),
    line([7.75, 21.25], [7.75, 9.5]),
    wave(14.25),
    wave(17.85),
    wave(21.45),
  ]);
}
// Pet-safe plant: a broad pointed leaf on a short stem, a paw inside it (the slash says toxic to
// pets).
add('pet-safe-plant', ['planta segura para mascotas', 'no tóxica', 'gatos', 'perros', 'pet-safe plant', 'non-toxic', 'pet friendly'], [
  'M12 19C5.75 16.75 3.75 12.75 3.75 10C3.75 6.25 7.25 3.75 12 2.25C16.75 3.75 20.25 6.25 20.25 10C20.25 12.75 18.25 16.75 12 19Z',
  line([12, 19], [12, 21.5]),
  ...miniPaw([12, 10.5], 0.95),
]);
// Plant label: a pointed stake pushed into the ground at a slant, a blank rounded label on its
// top, a seedling beside it.
{
  const T = (d) => turnPath(d, -12, [10.25, GROUND]);
  add('plant-label', ['etiqueta de planta', 'marcador', 'nombre de planta', 'jardín', 'plant label', 'plant marker', 'tag'], [
    T(sq(5.5, 3.25, 9.5, 7.5, 2.25, { square: ['br'] })),
    T(line([10.25, 10.75], [10.25, 21.5])),
    line([2.75, GROUND], [21.25, GROUND]),
    ...sprig(0.45, [17, GROUND]),
  ]);
}
// Potting mix: a soft bag folded over at its top, a sprout on its face, a mound of soil beside it.
add('potting-mix', ['sustrato', 'tierra para macetas', 'abono', 'insumos de jardín', 'potting mix', 'potting soil', 'garden supplies'], [
  'M4.75 6.5L5.5 3.25H14.5L15.25 6.5C16 10 16 17.5 15.25 21.25H4.75C4 17.5 4 10 4.75 6.5Z',
  line([4.75, 6.5], [15.25, 6.5]),
  ...sprig(0.4, [10, 17.75]),
  'M15.25 21.25C16.75 18.75 18 17.75 19 17.75C20 17.75 20.75 19.5 21.25 21.25',
]);
{
  // Garden: a short picket fence, a bush and a flower rising behind it (the fence goes on top,
  // so the engine clears what is behind it).
  const pk = (x) => roundpoly([[x - 1.5, 21.25], [x - 1.5, 14], [x, 12.25], [x + 1.5, 14], [x + 1.5, 21.25]], [0, 0.5, 0.5, 0.5, 0]);
  const pickets = [pk(6), pk(12), pk(18)];
  const rails = [line([7.5, 16.5], [10.5, 16.5]), line([13.5, 16.5], [16.5, 16.5])];
  const fence = `M4.5 21.25V14L6 12.25L7.5 14V15.5H10.5V14L12 12.25L13.5 14V15.5H16.5V14L18 12.25L19.5 14V21.25Z`;
  const flower = [17.25, 5.5];
  const fc = petals(flower, 0.45);
  add('garden', ['jardín', 'jardinería', 'amenidad', 'patio', 'garden', 'gardening', 'backyard'], [
    mound([[6.5, 12.25, 3.5], [10, 9.25, 3.25], [12.75, 12.25, 2.75]], 14.5).replace(/^M/, 'M'),
    union(fc, flower).d,
    line(rayOut(fc, flower, [0, 1]), [17.25, 18]),
  ], { badge: { d: [...pickets, ...rails], knock: fence, fill: { solid: pickets, wire: rails } } });
}
{
  // Raised bed: a box of planks seen a little from the side, sprouts in a row on top.
  add('raised-bed', ['cama elevada', 'huerto urbano', 'hortalizas', 'huerto en casa', 'raised bed', 'vegetable garden', 'kitchen garden'], [
    sq(2.75, 14, 14.5, 7.25, 1, { square: ['br'] }),
    'M17.25 14L21.25 11.25V18.5L17.25 21.25',
    line([2.75, 17.5], [17.25, 17.5]),
    ...sprig(0.45, [5.75, 14]),
    ...sprig(0.45, [15, 14]),
  ]);
}

// ── Tools ─────────────────────────────────────────────────────────────────────────────────────
// Drawn whole and upright here, their working end down, and leaned 45° so it points to the bottom
// left (herramientas's shovel leans the same way); the hand tools share one round handle.
const lean = (d) => turnPath(d, 45, [12, 12]);
const GRIP = capsule(10.5, 1.75, 3, 6.25);
// Garden trowel: a pointed, scooped blade on a short round handle, its crease down the middle.
add('garden-trowel', ['desplantador', 'pala de mano', 'plantar', 'jardinería', 'garden trowel', 'hand trowel', 'planting'], [
  lean('M8.5 11.5Q12 9.75 15.5 11.5C15.75 15.75 14 19.5 12 22C10 19.5 8.25 15.75 8.5 11.5Z'),
  lean(GRIP),
  lean(line([12, 8], [12, 10.5])),
  lean(line([12, 13.5], [12, 16.75])),
]);
// Hand fork: three short tines curving from a yoke, on the same round handle.
add('hand-fork', ['bieldo de mano', 'tenedor de jardín', 'escardar', 'aflojar tierra', 'hand fork', 'weeding', 'cultivator'], [
  lean('M8.5 21.5V14.25Q8.5 11.5 12 11.5Q15.5 11.5 15.5 14.25V21.5'),
  lean(line([12, 11.5], [12, 21.5])),
  lean(GRIP),
  lean(line([12, 8], [12, 11.5])),
]);
// Rake: a long handle ending in a straight crossbar, short tines pointing down from it.
add('rake', ['rastrillo', 'nivelar tierra', 'jardín', 'trabajo de patio', 'rake', 'garden rake', 'yard work'], [
  lean(line([12, -1.5], [12, 16.25])),
  lean(line([5.25, 16.25], [18.75, 16.25])),
  ...[5.25, 8.6, 12, 15.4, 18.75].map((x) => lean(line([x, 16.25], [x, 19.75]))),
]);
{
  // Leaf rake: a long handle ending in a wide fan of springy tines, a brace across them.
  const H = [12, 10.5];
  const tine = (a) => lean(line(H, polar(...H, 9.5, 90 + a)));
  add('leaf-rake', ['rastrillo de hojas', 'escoba de jardín', 'otoño', 'recoger hojas', 'leaf rake', 'lawn rake', 'fall cleanup'], [
    lean(line([12, -2], H)),
    ...[-50, -30, -10, 10, 30, 50].map(tine),
    lean(arc(...H, 5, 90 - 52, 90 + 52).d),
  ]);
}
// Hoe: a long handle, its flat blade bent at a right angle at its end.
add('hoe', ['azadón', 'azada', 'escardar', 'labrar', 'hoe', 'weeding', 'tilling'], [
  lean(line([12, -1], [12, 16.5])),
  lean(roundpoly([[10.5, 16.5], [18.75, 16.5], [18, 20.25], [11.25, 20.25]], [0.6, 0.6, 0.75, 0.75])),
]);
// Spade: a flat rectangular blade with a straight edge, on a shaft with a D-shaped grip.
add('spade', ['pala recta', 'cavar', 'bordear', 'remover tierra', 'spade', 'digging', 'edging'], [
  lean(sq(8.25, 12, 7.5, 9.5, 1)),
  lean(line([12, 6.25], [12, 12])),
  lean(roundpoly([[8.75, 1.5], [15.25, 1.5], [13.75, 6.25], [10.25, 6.25]], [0.75, 0.75, 1.25, 1.25])),
]);
{
  // Watering can: a rounded can with a handle arching over its top, a long spout ending in a rose.
  const S0 = [14.5, 16];
  const S1 = [18.5, 9.5];
  const u = unit(sub(S1, S0));
  const n = [-u[1], u[0]];
  const rose = roundpoly([plus(S1, scale(n, 0.9)), plus(plus(S1, scale(u, 2.5)), scale(n, 2.5)), sub(plus(S1, scale(u, 2.5)), scale(n, 2.5)), sub(S1, scale(n, 0.9))], [0.3, 0.6, 0.6, 0.3]);
  const can = [sq(3.25, 10, 11.25, 10.75, 2.5), 'M5.5 10V9C5.5 5.5 12.25 5.5 12.25 9V10', line(S0, S1), rose];
  add('watering-can', ['regadera', 'regar', 'riego', 'cuidado de plantas', 'watering can', 'water plants', 'plant care'], can);
  add('watering-can-clock', ['hora de regar', 'recordatorio de riego', 'próximo riego', 'regadera', 'watering reminder', 'watering due', 'schedule'], can, { badge: badge('clock') });
}
{
  // Garden hose: a coil of hose, its end running out to a straight spray nozzle.
  const C = [9.25, 13.5];
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const a = -90 + t * 540;
    pts.push(polar(...C, 2.25 + t * 4.75, a));
  }
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length; i++) d += `L${pt(pts[i])}`;
  add('garden-hose', ['manguera', 'regar', 'llave de jardín', 'lavar', 'garden hose', 'hose', 'watering'], [
    `${d}C14 6.5 15.25 6 16.5 6`,
    capsule(16.5, 4.5, 5, 3),
  ]);
}
// Pruning shears: the two short curved blades closed together into one hooked beak, the two
// handles spreading below it, a small spring between them.
add('pruning-shears', ['tijeras de podar', 'podar', 'recortar', 'jardinería', 'pruning shears', 'secateurs', 'pruning'], [
  'M10 11.25C9.25 8 10.25 4.75 12.75 2.5C13.5 4.75 14.25 7.5 14 11.25Z',
  'M10 11.25C9.25 14.5 8 17.75 6.5 21',
  'M14 11.25C14.75 14.5 16 17.75 17.5 21',
  line([9.15, 15.5], [11, 14.75], [13, 16.25], [14.85, 15.5]),
]);

// ── Machines (in profile, facing right, their wheels on the ground) ───────────────────────────
/** A wheel under a sill: the arc of its circle below `sill`, its ends on the sill (vehiculos's). */
const wheelUnder = (x, r, sill) => {
  const y = GROUND - r;
  const a = (Math.asin(Math.max(-1, Math.min(1, (sill - y) / r))) * 180) / Math.PI;
  return arc(x, y, r, a, 180 - a).d;
};
// Lawn mower: a low deck under its motor cover, two wheels, the handle rising behind it.
add('lawn-mower', ['podadora', 'cortacésped', 'cortar el pasto', 'jardinería', 'lawn mower', 'mowing', 'lawn care'], [
  'M8.75 17.75V15.5C8.75 14.5 9.5 13.75 10.5 13.75H12C12.25 11.75 13.75 10.75 15.5 10.75C17.25 10.75 18.75 11.75 19 13.75H19.5C20.5 13.75 21.25 14.5 21.25 15.5V17.75Z',
  wheelUnder(11.5, 2.25, 17.75),
  wheelUnder(18.25, 2.25, 17.75),
  line([9.75, 13.75], [4.5, 3.75]),
  line([3, 4.75], [6, 2.75]),
]);
// Riding mower: a small lawn tractor, the seat with its back, the steering wheel, the deck under
// it and its two wheels.
add('riding-mower', ['tractor podador', 'podadora de montar', 'jardines grandes', 'mantenimiento', 'riding mower', 'lawn tractor', 'groundskeeping'], [
  roundpoly([[3, 15], [3, 7.25], [5, 7.25], [5, 11.5], [10.25, 11.5], [11, 12.75], [17.75, 12.75], [21.25, 15], [21.25, 17], [3, 17]], [0.75, 0.75, 0.75, 0.75, 0.6, 0.6, 1, 1, 0.75, 0]),
  wheelUnder(6.5, 3.25, 17),
  wheelUnder(18.25, 2.25, 17),
  line([13.75, 12.75], [13, 8]),
  line([11.25, 8.5], [14.75, 7.5]),
  roundline([[10.75, 17], [10.75, 19.5], [14.75, 19.5], [14.75, 17]], [0, 0.6, 0.6, 0]),
]);
{
  // Robot mower: a low dome on two wheels, a small sensor bump on top. It docks on a base plate
  // with a post at its back.
  const robot = (x0, x1, sill = 17.25, top = 9.75) => {
    const cx = (x0 + x1) / 2;
    const rx = (x1 - x0) / 2;
    const ry = sill - top;
    const dome = `M${pt([x0, sill])}A${N(rx)} ${N(ry)} 0 0 1 ${pt([x1, sill])}Z`;
    const bump = `M${pt([cx - 1.75, top + 0.1])}A1.75 1.75 0 0 1 ${pt([cx + 1.75, top + 0.1])}`;
    return [dome, bump, wheelUnder(x0 + rx * 0.45, 2.25, sill), wheelUnder(x1 - rx * 0.45, 2.25, sill)];
  };
  const R = robot(3.25, 20.75);
  add('robot-mower', ['podadora robot', 'jardín inteligente', 'corte automático', 'robot', 'robot mower', 'robotic lawn mower', 'smart garden'], R);
  add('robot-mower-dock', ['base de carga', 'acoplado', 'cargando', 'volver a la base', 'mower dock', 'charging base', 'docked'], [...robot(7.75, 21.25, 17), line([2.75, GROUND], [21.25, GROUND]), capsule(2.75, 9.75, 2.75, 11)]);
  // Under its badge the mower moves up and left, a little smaller (as potted-plant's siblings)
  add('robot-mower-alert', ['podadora atascada', 'falla de cuchilla', 'levantada', 'robot', 'mower alert', 'mower stuck', 'blade fault'], R.map((d) => place(d, 0.8, [3.25, 9.75], [3.25, 7.5])), { badge: badge('alert') });
}
// String trimmer: a long diagonal shaft with a handle at its middle, its round head spinning at the
// bottom under a guard.
add('string-trimmer', ['desbrozadora', 'orilladora', 'bordes de pasto', 'recortar maleza', 'string trimmer', 'weed eater', 'edging'], [
  line([20.5, 3.5], [8.32, 16.74]),
  capsule(18.25, 1.75, 3.5, 3.5).replace(/^/, ''),
  roundline([[13.5, 11.1], [16.5, 13.75], [17.75, 12.5], [15.1, 9.4]], [0, 0.75, 0.75, 0]),
  circ(7, 18.25, 2),
  arc(7, 18.25, 4.85, 150, 320).d,
]);
{
  // Garden glove: one glove, its fingers spread, its long cuff flaring out below a seam.
  const P = [12, 13.25];
  const fing = [[-46, 6.25], [-15, 7], [15, 6.75], [46, 5.75]];
  const thumbA = -100;
  const w = 1.5;
  const side = (a, s) => {
    const u = polar(0, 0, 1, a - 90);
    const n = [-u[1], u[0]];
    return { u, n, off: (d) => plus(plus(P, scale(u, d)), scale(n, s * w)) };
  };
  const notch = (a0, a1) => {
    const half = ((a1 - a0) / 2) * (Math.PI / 180);
    const d = w / Math.sin(half);
    return polar(...P, d, (a0 + a1) / 2 - 90);
  };
  const tip = (a, l) => {
    const { off } = side(a, 1);
    const t0 = side(a, -1).off(3 + l);
    const t1 = off(3 + l);
    return `L${pt(t0)}A${w} ${w} 0 0 1 ${pt(t1)}`;
  };
  const all = [[thumbA, 4.75], ...fing];
  let d = `M${pt([P[0] - 6, 21.25])}L${pt([P[0] - 3.75, P[1] + 3.5])}`;
  all.forEach(([a, l], i) => {
    d += tip(a, l);
    if (i < all.length - 1) d += `L${pt(notch(a, all[i + 1][0]))}`;
  });
  d += `L${pt([P[0] + 3.75, P[1] + 3.5])}L${pt([P[0] + 6, 21.25])}Z`;
  add('garden-glove', ['guante de jardín', 'guante de jardinería', 'protección', 'insumos de jardín', 'garden glove', 'gardening glove', 'garden supplies'], [d, line(lerp([P[0] - 3.75, P[1] + 3.5], [P[0] - 6, 21.25], (17.25 - P[1] - 3.5) / (21.25 - P[1] - 3.5)), lerp([P[0] + 3.75, P[1] + 3.5], [P[0] + 6, 21.25], (17.25 - P[1] - 3.5) / (21.25 - P[1] - 3.5)))]);
}
{
  // Plant mister: a slim bottle under its pump head, a fan of fine mist leaving the nozzle.
  add('plant-mister', ['atomizador', 'pulverizador', 'humedad', 'cuidado de plantas', 'plant mister', 'spray bottle', 'misting'], [
    sq(6.25, 10.5, 7.5, 10.75, 2),
    line([8.5, 10.5], [8.5, 7.5], [11.5, 7.5], [11.5, 10.5]),
    roundline([[8.5, 7.5], [8.5, 5], [14.25, 5]], [0, 1, 0]),
    dot(17.75, 5, 0.5),
    dot(20.5, 2.75, 0.5),
    dot(20.5, 7.25, 0.5),
  ]);
}
// Compost bin: a slatted box, a heap of matter on top of it and a leaf sticking out of the heap.
add('compost-bin', ['composta', 'compostero', 'residuos de jardín', 'abono', 'compost bin', 'composting', 'garden waste'], [
  sq(4, 12, 16, 9.25, 1.5, { square: ['br'] }),
  line([8, 12], [8, 21.25]),
  line([12, 12], [12, 21.25]),
  line([16, 12], [16, 21.25]),
  'M5 12C5.75 9 8.5 7.25 12 7.25C15.5 7.25 18.25 9 19 12',
  leaf([12.5, 7.25], [16.5, 2.75], 3),
]);
{
  // Garden arch: a rounded arch on two posts, leaves of a climbing vine on it (on top, so the engine
  // clears the arch under them).
  const C = [12, 11.25];
  const at = (r, a) => polar(...C, r, a);
  const lv = [-150, -75, -15].map((a) => {
    const m = at(6.25, a);
    const t = polar(0, 0, 1, a + 90);
    return leaf(plus(m, scale(t, -3.25)), plus(m, scale(t, 3.25)), 2.9);
  });
  add('garden-arch', ['arco de jardín', 'pérgola', 'entrada', 'bodas', 'garden arch', 'rose arch', 'arbor'], [
    `M4.25 ${N(GROUND)}V${N(C[1])}A7.75 7.75 0 0 1 19.75 ${N(C[1])}V${N(GROUND)}`,
    `M7.25 ${N(GROUND)}V${N(C[1])}A4.75 4.75 0 0 1 16.75 ${N(C[1])}V${N(GROUND)}`,
    line([2.75, GROUND], [21.25, GROUND]),
  ], { badge: { d: lv, knock: lv.join(''), fill: { solid: lv } } });
}
// Stepping stones: three oval stones, smaller as they go back along a curving path.
add('stepping-stones', ['pasos japoneses', 'sendero', 'camino', 'paisajismo', 'stepping stones', 'garden path', 'pavers'], [ell([8.25, 17.75], 5, 2.5, -8), ell([15.25, 11.5], 3.75, 1.9, 8), ell([9.75, 5.5], 2.75, 1.55, -6)]);

// ── Fill, parts and the rest, in blocks (as in nucleo.mjs) ────────────────────────────────────
// Each icon's fill by path index: `solid` closed shapes (an index written 's3' closes that open
// stroke along its chord first), `cut` knocked out, `lines` apart with a clearance, `wire` attached.
// Stems and trunks are attached to what they hold up; a pot's rim stays apart from its body with a
// cut along its foot.
const rimCut = (d) => {
  const v = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map(Number);
  const xs = v.filter((_, i) => i % 2 === 0);
  const ys = v.filter((_, i) => i % 2 === 1);
  return line([Math.min(...xs), Math.max(...ys)], [Math.max(...xs), Math.max(...ys)]);
};
const FILL = {
  'tree-oak': { solid: [0], wire: [1, 2] },
  'tree-fruit': { solid: [0], wire: [1], cut: [2, 3, 4] },
  'tree-baobab': { solid: [0], wire: [1, 2, 3, 4, 5] },
  'tree-acacia': { solid: [0], wire: [1, 2] },
  'tree-blossom': { solid: [0, 1, 2], wire: [3, 4, 5] },
  'tree-rings': { solid: [0], cut: [1, 2, 3] },
  'tree-branch': { solid: [2, 3, 4], wire: [0, 1] },
  'tree-plus': { solid: [0], wire: [1] },
  bonsai: { solid: [0, 2, 3], wire: [1] },
  sapling: { solid: [0], wire: [1, 2, 3, 4] },
  'leaf-palm': { solid: [0], wire: [1], cut: [2, 3, 4, 5] },
  clover: { solid: [0, 1, 2], wire: [3] },
  'four-leaf-clover': { solid: [0, 1, 2, 3], wire: [4] },
  eucalyptus: { solid: [1, 2, 3, 4], wire: [0, 5, 6, 7, 8] },
  bamboo: { solid: [0, 1, 5, 6], cut: [2, 3, 4] },
  'aloe-vera': { solid: [0, 1] },
  succulent: { solid: [0], cut: [1] },
  'cactus-barrel': { solid: [0, 's1', 's2', 5], cut: [3, 4] },
  'snake-plant': { solid: [0, 's1', 's2', 's3', 's4'] },
  'venus-flytrap': { solid: [1, 2], wire: [0, 3, 4, 5, 6, 7, 8] },
  wildflowers: { solid: [0, 1, 2], wire: [3, 4, 5, 6] },
  cattail: { solid: [0, 1, 's6'], wire: [2, 3, 4, 5, 7] },
  vine: { solid: [1, 2, 3], wire: [0] },
  ivy: { solid: [2, 3, 4], wire: [0, 1] },
  bush: { solid: ['s0'], wire: [1] },
  hedge: { solid: ['s0'], wire: [1] },
  topiary: { solid: [0, 2], wire: [1, 3] },
  trellis: { solid: [0], cut: [1, 2] },
  'leaf-pile': { solid: ['s0', 1, 2, 3], wire: [4] },
  rose: { solid: [0, 3], cut: [1], wire: [2, 4] },
  tulip: { solid: [0, 's2'], wire: [1] },
  sunflower: { solid: [0, 3, 4], cut: [1], wire: [2] },
  daisy: { solid: [0], cut: [1] },
  'cherry-blossom': { solid: [0], cut: [1, 2, 3, 4, 5] },
  orchid: { solid: [0], cut: [1], wire: [2] },
  lily: { solid: [0, 2], wire: [1] },
  'water-lily': { solid: [0, 1, 2, 3] },
  daffodil: { solid: [0, 2], wire: [1] },
  poppy: { solid: [0], cut: [1], wire: [2] },
  marigold: { solid: [0, 3], cut: [1], wire: [2] },
  'flower-bud': { solid: [0, 2], wire: [1] },
  'flower-wilted': { solid: [0, 2], wire: [1] },
  'flower-vase': { solid: [0, 3, 4, 5], wire: [1, 2] },
  'potted-plant': { solid: [0, 's1', 3, 5, 7], wire: [2, 4, 6] },
  'potted-plant-plus': { solid: [0, 's1', 3, 5, 7], wire: [2, 4, 6] },
  'potted-plant-alert': { solid: [0, 's1', 3, 5, 7], wire: [2, 4, 6] },
  'potted-sprout': { solid: [0, 's1', 3, 4], wire: [2] },
  'plant-pot': { solid: [0, 's1', 2] },
  'hanging-plant': { solid: [4, 6, 8], wire: [0, 1, 2, 3, 5, 7] },
  repotting: { solid: [0, 's1', 2, 4, 5], wire: [3], lines: [6, 7] },
  'window-box': { solid: ['s0', 2, 3, 4], wire: [1, 5, 6, 7] },
  'plant-terrarium': { solid: [0, 1], cut: [2, 3, 4, 5] },
  seed: { solid: [0], cut: [1] },
  acorn: { solid: ['s0', 1], wire: [2], cut: [3, 4] },
  pinecone: { solid: [0], wire: [1], cut: [2, 3, 4] },
  'seed-packet': { solid: [0], cut: [1, 2, 3, 4] },
  'flower-bulb': { solid: [0, 1], wire: [2, 3, 4] },
  toadstool: { solid: [0, 's1', 's2'], cut: [3, 4, 5] },
  'plant-light': { solid: [0, 7, 8], lines: [1, 2, 3, 4, 5], wire: [6, 9] },
  'plant-water': { solid: [0, 1, 2, 4, 5], wire: [3, 6] },
  'plant-humidity': { solid: [0], wire: [1], lines: [2, 3, 4] },
  'pet-safe-plant': { solid: [0], wire: [1], cut: [2, 3, 4, 5, 6] },
  'plant-label': { solid: [0, 4, 5], wire: [1, 2, 3] },
  'potting-mix': { solid: [0, 's5'], cut: [1, 2, 3, 4] },
  garden: { solid: ['s0', 1], wire: [2] },
  'raised-bed': { solid: [0, 's1', 4, 5, 7, 8], cut: [2], wire: [3, 6] },
  'garden-trowel': { solid: [0, 1], wire: [2], cut: [3] },
  'hand-fork': { solid: [2], wire: [0, 1, 3] },
  hoe: { solid: [1], wire: [0] },
  spade: { solid: [0, 2], wire: [1] },
  'watering-can': { solid: [0, 3], wire: [1, 2] },
  'watering-can-clock': { solid: [0, 3], wire: [1, 2] },
  'garden-hose': { solid: [1], wire: [0] },
  'pruning-shears': { solid: [0], wire: [1, 2, 3] },
  'lawn-mower': { solid: [0, 's1', 's2'], wire: [3, 4] },
  'riding-mower': { solid: [0, 's1', 's2', 's5'], wire: [3, 4] },
  'robot-mower': { solid: [0, 's1', 's2', 's3'] },
  'robot-mower-dock': { solid: [0, 's1', 's2', 's3', 5], wire: [4] },
  'robot-mower-alert': { solid: [0, 's1', 's2', 's3'] },
  'string-trimmer': { solid: [1, 3], wire: [0, 2], lines: [4] },
  'garden-glove': { solid: [0], cut: [1] },
  'plant-mister': { solid: [0, 's1', 3, 4, 5], wire: [2] },
  'compost-bin': { solid: [0, 's4', 5], cut: [1, 2, 3] },
  'stepping-stones': { solid: [0, 1, 2] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? shut(d[Number(i.slice(1))]) : d[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
// A pot's rim and its body stay apart in the fill: a cut along the rim's foot
for (const name of ['cactus-barrel', 'snake-plant', 'potted-plant', 'potted-plant-plus', 'potted-plant-alert', 'potted-sprout', 'plant-pot', 'repotting']) {
  const f = icons[name].fill;
  f.cut = [...(f.cut ?? []), rimCut(icons[name].d[0])];
}
// The plant pot's foot stays apart from its saucer; the glove's cuff from its hand
icons['plant-pot'].fill.cut.push(line([4.5, 18.25], [19.5, 18.25]));
icons['garden-glove'].fill.cut = [line([5.5, 17.25], [18.5, 17.25])];
{
  // Cypress (as tree-pine): the trunk a wire under the crown, a cut inside it with its branch
  const d = icons['tree-cypress'].d;
  icons['tree-cypress'].fill = { solid: [d[0]], wire: [line([12, 21.25], [12, 18.25])], cut: [line([12, 16.75], [12, 9.5]), d[2]] };
}
{
  // Stump: its top face apart from its body (a cut along the top's front edge), the ring cut out
  const d = icons['tree-stump'].d;
  icons['tree-stump'].fill = { solid: [d[0], shut(d[1])], cut: [d[2], ringArc([12, 7.75], 7.25, 4, 0, 180)] };
}
{
  // The leaves: the blade solid, the stem a wire up to it and a cut inside it (lugares's leaf)
  const stems = { 'leaf-maple': [17, 11], 'leaf-oak': [19.5, 10.5], 'leaf-monstera': [17.25, 8.5] };
  for (const [name, [base, end]] of Object.entries(stems))
    icons[name].fill = { solid: [icons[name].d[0]], wire: [line(STEM_FOOT, onLeafPt([12, base]))], cut: [line(onLeafPt([12, base - 2.5]), onLeafPt([12, end]))] };
  icons['leaf-ginkgo'].fill = { solid: [icons['leaf-ginkgo'].d[0]], wire: [icons['leaf-ginkgo'].d[1]] };
  // Fern: its midrib a wire below the frond and a cut up it
  const bend = (d) => turnPath(d, 12, [12, 21.25]);
  icons.fern.fill = { solid: [icons.fern.d[0]], wire: [bend(line([12, 21.25], [12, 19.25]))], cut: [bend(line([12, 16.75], [12, 9.5]))] };
}
{
  // Hibiscus: the stamen a cut inside the petals and a wire beyond them, its tip solid
  const d = icons.hibiscus.d;
  const C = [11, 13];
  const exit = rayOut(petals(C, 1.25, -72), C, sub([18.75, 5.25], C));
  icons.hibiscus.fill = { solid: [d[0], d[2]], cut: [line(C, exit)], wire: [line(exit, [18.75, 5.25])] };
}
{
  // Plant cutting: the glass solid with its water line, the stem and the roots cut out under the
  // rim, the stem a wire above it
  const d = icons['plant-cutting'].d;
  icons['plant-cutting'].fill = { solid: [shut(d[0]), d[3], d[4]], cut: [d[1], line([12, 17.25], [12, 9.75]), d[5], d[6]], wire: [line([12, 9.75], [12, 5.75])] };
}
// The cap apart from what it covers (a cut along its foot): the acorn, the toadstool and its ring,
// and the compost's heap on its bin
icons.acorn.fill.cut.push(line([4.75, 11.25], [19.25, 11.25]));
icons.toadstool.fill.cut.push(line([3.25, 12], [20.75, 12]), line([8, 16.5], [16, 16.5]));
icons['compost-bin'].fill.cut.push(line([4, 12], [20, 12]));
{
  // Garden arch: the band between its two outlines solid, the ground a wire
  const C = [12, 11.25];
  const band = `M4.25 ${N(GROUND)}V${N(C[1])}A7.75 7.75 0 0 1 19.75 ${N(C[1])}V${N(GROUND)}H16.75V${N(C[1])}A4.75 4.75 0 0 0 7.25 ${N(C[1])}V${N(GROUND)}Z`;
  icons['garden-arch'].fill = { solid: [band], wire: [icons['garden-arch'].d[2]] };
}
// Open lines only: their filled version is the outline itself
for (const name of ['tree-willow', 'tree-bare', 'pine-branch', 'grass', 'dandelion', 'rake', 'leaf-rake']) icons[name].fill = false;

// Named parts
const PARTS = {
  'tree-oak': { crown: [0], trunk: [1, 2] },
  'tree-willow': { trunk: [0], strands: [1, 2, 3, 4] },
  'tree-bare': { trunk: [0], branches: [1, 2, 3, 4] },
  'tree-fruit': { crown: [0], trunk: [1], fruit: [2, 3, 4] },
  'tree-cypress': { crown: [0], trunk: [1], branch: [2] },
  'tree-baobab': { trunk: [0], branches: [1, 2, 3, 4, 5] },
  'tree-acacia': { crown: [0], trunk: [1, 2] },
  'tree-blossom': { blossoms: [0, 1, 2], trunk: [3, 4, 5] },
  'tree-stump': { top: [0], trunk: [1], ring: [2] },
  'tree-rings': { bark: [0], rings: [1, 2], crack: [3] },
  'tree-branch': { twig: [0, 1], leaves: [2, 3, 4] },
  'tree-plus': { crown: [0], trunk: [1], branch: [2] },
  bonsai: { tray: [0], trunk: [1], pads: [2, 3] },
  sapling: { crown: [0], trunk: [1], stake: [2, 3], ground: [4] },
  'pine-branch': { twig: [0, 1], needles: [2, 3, 4, 5, 6, 7, 8, 9] },
  'leaf-maple': { leaf: [0], stem: [1] },
  'leaf-oak': { leaf: [0], stem: [1] },
  'leaf-ginkgo': { leaf: [0], stem: [1] },
  'leaf-monstera': { leaf: [0], stem: [1] },
  'leaf-palm': { leaf: [0], stem: [1], pleats: [2, 3, 4, 5] },
  fern: { frond: [0], stem: [1] },
  clover: { leaves: [0, 1, 2], stem: [3] },
  'four-leaf-clover': { leaves: [0, 1, 2, 3], stem: [4] },
  eucalyptus: { stem: [0, 5, 6, 7, 8], leaves: [1, 2, 3, 4] },
  bamboo: { stalks: [0, 1], nodes: [2, 3, 4], leaves: [5, 6] },
  'aloe-vera': { leaf: [0], drop: [1] },
  succulent: { outer: [0], inner: [1] },
  'cactus-barrel': { pot: [0, 1], cactus: [2, 3, 4], flower: [5] },
  'snake-plant': { pot: [0, 1], leaves: [2, 3, 4] },
  'venus-flytrap': { stem: [0], trap: [1, 2], teeth: [3, 4, 5, 6, 7, 8] },
  grass: { blades: [0, 1, 2, 3, 4], ground: [5] },
  wildflowers: { flowers: [0, 1, 2], stems: [3, 4, 5], ground: [6] },
  cattail: { heads: [0, 1], stems: [2, 3, 4, 5], leaf: [6], ground: [7] },
  vine: { stem: [0], leaves: [1, 2, 3] },
  ivy: { support: [0], strand: [1], leaves: [2, 3, 4] },
  bush: { bush: [0], ground: [1] },
  hedge: { hedge: [0], ground: [1] },
  topiary: { ball: [0], stem: [1], planter: [2, 3] },
  trellis: { frame: [0], lattice: [1, 2] },
  'leaf-pile': { pile: [0], leaves: [1, 2, 3], ground: [4] },
  rose: { bloom: [0, 1], stem: [2, 4], leaf: [3] },
  tulip: { bloom: [0], stem: [1], leaf: [2] },
  sunflower: { petals: [0], center: [1], stem: [2], leaves: [3, 4] },
  daisy: { petals: [0], center: [1] },
  'cherry-blossom': { petals: [0], stamens: [1, 2, 3, 4, 5] },
  hibiscus: { petals: [0], stamen: [1, 2] },
  orchid: { petals: [0], lip: [1], stem: [2] },
  lily: { bloom: [0], stem: [1], leaf: [2] },
  'water-lily': { pad: [0], bloom: [1, 2, 3] },
  dandelion: { rays: [0, 1, 2, 3, 4, 5, 6], seeds: [7, 8, 9, 10, 11, 12, 13], stem: [14] },
  daffodil: { petals: [0], stem: [1], leaf: [2] },
  poppy: { petals: [0], center: [1], stem: [2] },
  marigold: { petals: [0, 1], stem: [2], leaf: [3] },
  'flower-bud': { bud: [0], stem: [1], leaf: [2] },
  'flower-wilted': { bloom: [0], stem: [1], petal: [2] },
  'flower-vase': { vase: [0], stems: [1, 2], flowers: [3, 4], leaf: [5] },
  'potted-plant': { pot: [0, 1], plant: [2, 3, 4, 5, 6, 7] },
  'potted-plant-plus': { pot: [0, 1], plant: [2, 3, 4, 5, 6, 7] },
  'potted-plant-alert': { pot: [0, 1], plant: [2, 3, 4, 5, 6, 7] },
  'potted-sprout': { pot: [0, 1], sprout: [2, 3, 4] },
  'plant-pot': { pot: [0, 1], saucer: [2] },
  'hanging-plant': { hook: [0], cords: [1, 2, 3], pot: [4], strands: [5, 6, 7, 8] },
  'plant-cutting': { glass: [0], water: [1], cutting: [2, 3, 4], roots: [5, 6] },
  repotting: { pot: [0, 1], plant: [2, 3, 4, 5], arrow: [6, 7] },
  'window-box': { box: [0], sill: [1], flowers: [2, 3, 4], stems: [5, 6, 7] },
  'plant-terrarium': { jar: [0], lid: [1], soil: [2], plant: [3, 4, 5] },
  seed: { seed: [0], seam: [1] },
  acorn: { nut: [0], cap: [1, 3, 4], stem: [2] },
  pinecone: { cone: [0], stem: [1], scales: [2, 3, 4] },
  'seed-packet': { packet: [0, 1], sprout: [2, 3, 4] },
  'flower-bulb': { bulb: [0], shoot: [1], roots: [2, 3, 4] },
  toadstool: { cap: [0], stem: [1], ring: [2], spots: [3, 4, 5] },
  'plant-light': { sun: [0], rays: [1, 2, 3, 4, 5], sprout: [6, 7, 8], ground: [9] },
  'plant-water': { drops: [0, 1, 2], sprout: [3, 4, 5], ground: [6] },
  'plant-humidity': { leaf: [0, 1], vapor: [2, 3, 4] },
  'pet-safe-plant': { leaf: [0, 1], paw: [2, 3, 4, 5, 6] },
  'plant-label': { label: [0, 1], ground: [2], sprout: [3, 4, 5] },
  'potting-mix': { bag: [0, 1], sprout: [2, 3, 4], soil: [5] },
  garden: { bush: [0], flower: [1, 2] },
  'raised-bed': { bed: [0, 1, 2], sprouts: [3, 4, 5, 6, 7, 8] },
  'garden-trowel': { blade: [0, 3], handle: [1, 2] },
  'hand-fork': { tines: [0, 1], handle: [2, 3] },
  rake: { handle: [0], head: [1, 2, 3, 4, 5, 6] },
  'leaf-rake': { handle: [0], tines: [1, 2, 3, 4, 5, 6, 7] },
  hoe: { handle: [0], blade: [1] },
  spade: { blade: [0], handle: [1, 2] },
  'watering-can': { can: [0, 1], spout: [2, 3] },
  'watering-can-clock': { can: [0, 1], spout: [2, 3] },
  'garden-hose': { hose: [0], nozzle: [1] },
  'pruning-shears': { blades: [0], handles: [1, 2], spring: [3] },
  'lawn-mower': { body: [0], wheels: [1, 2], handle: [3, 4] },
  'riding-mower': { body: [0], wheels: [1, 2], steering: [3, 4], deck: [5] },
  'robot-mower': { body: [0, 1], wheels: [2, 3] },
  'robot-mower-dock': { body: [0, 1], wheels: [2, 3], dock: [4, 5] },
  'robot-mower-alert': { body: [0, 1], wheels: [2, 3] },
  'string-trimmer': { shaft: [0, 1, 2], head: [3, 4] },
  'garden-glove': { glove: [0], seam: [1] },
  'plant-mister': { bottle: [0, 1, 2], mist: [3, 4, 5] },
  'compost-bin': { bin: [0, 1, 2, 3], heap: [4, 5] },
  'garden-arch': { arch: [0, 1], ground: [2] },
  'stepping-stones': { stones: [0, 1, 2] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// Motion: each icon's own gesture (parts by name, pivots and offsets on the 24 canvas)
const sway = (origin, parts) => ({ effect: 'wiggle', origin, ...(parts && { parts }) });
const MOTION = {
  'tree-oak': sway([12, 21.25]),
  'tree-willow': sway([12, 12], ['strands']),
  'tree-bare': sway([12, 21.25]),
  'tree-fruit': sway([12, 21.25]),
  'tree-cypress': sway([12, 21.25]),
  'tree-baobab': sway([12, 21.25]),
  'tree-acacia': sway([13.25, 21.25]),
  'tree-blossom': sway([12, 21.25]),
  'tree-plus': sway([9.75, 21.25], ['crown', 'trunk', 'branch']),
  sapling: sway([10.5, 16.75], ['crown']),
  'pine-branch': sway([3.75, 20.25]),
  'tree-branch': sway([3.25, 20.75]),
  'leaf-maple': sway([3.25, 20.75]),
  'leaf-oak': sway([3.25, 20.75]),
  'leaf-ginkgo': sway([3.25, 20.75]),
  'leaf-monstera': sway([3.25, 20.75]),
  'leaf-palm': sway([3.25, 20.75]),
  fern: sway([12, 21.25]),
  clover: sway([9, 21.25]),
  'four-leaf-clover': sway([15, 21.25]),
  eucalyptus: sway([12, 21.25]),
  'aloe-vera': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'snake-plant': sway([12, 13.5], ['leaves']),
  'venus-flytrap': { effect: 'beat', parts: ['trap', 'teeth'], origin: [12, 14.5] },
  grass: sway([12, 20.75], ['blades']),
  wildflowers: sway([12, 20.75], ['flowers', 'stems']),
  cattail: sway([12, 20.75], ['heads', 'stems', 'leaf']),
  vine: sway([3.25, 20.75]),
  ivy: sway([11.5, 3.25], ['strand', 'leaves']),
  rose: sway([12, 21.25]),
  tulip: sway([12, 21.25]),
  sunflower: sway([12, 21.25]),
  daisy: { effect: 'spin', parts: ['petals'], origin: [12, 12] },
  'cherry-blossom': { effect: 'spin', parts: ['petals'], origin: [12, 12.25] },
  hibiscus: { effect: 'beat', origin: [11, 13] },
  orchid: sway([3.25, 21.25]),
  lily: sway([12, 21.25]),
  'water-lily': { effect: 'float', vector: [0, -1] },
  dandelion: { effect: 'float', parts: ['seeds'], vector: [1.5, -1] },
  daffodil: sway([12, 21.25]),
  poppy: sway([9.75, 21.25]),
  marigold: sway([12, 21.25]),
  'flower-bud': { effect: 'beat', parts: ['bud'], origin: [12, 13] },
  'flower-wilted': { effect: 'bounce', parts: ['petal'], vector: [0, 1.5] },
  'potted-plant': sway([12, 13.25], ['plant']),
  'potted-sprout': { effect: 'beat', parts: ['sprout'], origin: [12, 14.25] },
  'hanging-plant': { effect: 'ring', origin: [12, 3.5] },
  repotting: { effect: 'bounce', parts: ['plant'], vector: [0, 2] },
  'plant-mister': { effect: 'beat', parts: ['mist'], origin: [17.25, 5] },
  'watering-can': { effect: 'wiggle', origin: [9, 20.75] },
  'garden-hose': { effect: 'wiggle', parts: ['nozzle'], origin: [16.5, 6] },
  'pruning-shears': { effect: 'wiggle', parts: ['blades'], origin: [12, 11.25] },
  'lawn-mower': { effect: 'slide', vector: [2, 0] },
  'riding-mower': { effect: 'slide', vector: [2, 0] },
  'robot-mower': { effect: 'slide', vector: [2, 0] },
  'robot-mower-dock': { effect: 'slide', parts: ['body', 'wheels'], vector: [1.5, 0] },
  'string-trimmer': { effect: 'spin', parts: ['head'], origin: [7, 18.25] },
  rake: sway([3.05, 20.95]),
  'leaf-rake': sway([3.05, 20.95]),
  hoe: sway([3.05, 20.95]),
  spade: sway([3.05, 20.95]),
  'garden-trowel': sway([3.05, 20.95]),
  'hand-fork': sway([3.05, 20.95]),
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// Mirror: the machines move forward, facing right (agricultura's tractors flip the same way)
for (const name of ['lawn-mower', 'riding-mower', 'robot-mower', 'robot-mower-dock', 'robot-mower-alert']) icons[name].mirror = true;

// Levels, from least to most: the sun's rays, the drops, the lines of vapor
icons['plant-light'].levels = [[1], [2, 3], [4, 5]];
icons['plant-water'].levels = [[0], [1], [2]];
icons['plant-humidity'].levels = [[2], [3], [4]];

// 16 px: the cross-section keeps one ring and its crack, its edge a plain circle
icons['tree-rings'].small = { d: [circ(12, 12, 9), circ(12, 12, 4.5), line(polar(12, 12, 9, -60), [12, 12])] };
icons['tree-rings'].small.fill = { solid: [icons['tree-rings'].small.d[0]], cut: icons['tree-rings'].small.d.slice(1) };

// Already enclosed: a cross-section is its own circle, a framed trellis its own square
icons['tree-rings'].variants = { circle: false };
icons.trellis.variants = { square: false };

export default { category: 'plantas', label: 'Plantas y jardín', icons };
