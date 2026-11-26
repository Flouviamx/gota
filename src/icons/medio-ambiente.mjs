// Medio ambiente (environment), round 11: waste sorting, compost and reuse, the carbon and water
// footprints, emissions, pollution of air, water, noise and light, the planet and its climate, the
// forest, saving water, and the natural disasters. Drawn with the engine (engine/geometry.mjs) and
// the rules in DESIGN.md.
// - It adopts lugares's recycle; every *-recycle carries its three chasing arrows made small
//   (`recycleMark`: arcs of one circle, so the heads keep their clearance), in the badge's place.
// - The bin-* share one sorting bin (an open tapered body under an overhanging rim) with the object
//   falling into its mouth, at least 8 wide; bin-level marks its fill with two levels inside it.
// - The *-leaf put lugares's leaf in the badge's place (as logistica's parcel-leaf); the emissions
//   build on vehiculos's car-side and aviacion's plane-side; the hands are gestos's open hand; earth
//   is a planet with two landmasses, never nucleo's globe; the waves are lugares's water; the trees
//   are lugares's; smog and light-pollution share one skyline; the disasters say what they do to a
//   place.
import { arc, badge, circ, dot, f, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import aviacion from './aviacion.mjs';
import cocina from './cocina.mjs';
import comercio from './comercio.mjs';
import dispositivos from './dispositivos.mjs';
import gestos from './gestos.mjs';
import industria from './industria.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import vehiculos from './vehiculos.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const L = lugares.icons;
/** A path scaled by `s` about `c` and set down with `c` at `to`. */
const place = (d, s, c, to = c) => transform(d, s, to[0] - c[0] * s, to[1] - c[1] * s);
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((x) => (/Z\s*$/i.test(x) ? x : `${x}Z`))
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
    const S = add(V, mul(u, t));
    const E = add(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** A smooth curve through the points (Catmull-Rom as cubics), open or closed. */
function spline(pts, closed = false) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let s = `M${pt(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    s += `C${pt(add(p1, mul(sub(p2, p0), 1 / 6)))} ${pt(sub(p2, mul(sub(p3, p1), 1 / 6)))} ${pt(p2)}`;
  }
  return closed ? `${s}Z` : s;
}

/** The set's liquid drop (lugares's droplet): a circle of r with its point straight up. */
function droplet([cx, cy], r) {
  const a = polar(cx, cy, r, -45);
  const b = polar(cx, cy, r, -135);
  return `M${pt(a)}A${f(r)} ${f(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
}

/** Lugares's water line: half waves of about 3, starting upward from y. */
function wave(x0, x1, y, amp = 1.33) {
  const n = Math.max(1, Math.round(Math.abs(x1 - x0) / 3));
  const h = (x1 - x0) / n;
  let s = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const k = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    s += `C${pt([x + h / 3, y + k * amp])} ${pt([x + (2 * h) / 3, y + k * amp])} ${pt([x + h, y])}`;
  }
  return s;
}

/** An ellipse. */
const ellipse = (cx, cy, rx, ry) => `M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx - rx, cy])}Z`;

/** A lens from A to B, its two edges arcs of radius r. */
const lens = (A, B, r) => `M${pt(A)}A${f(r)} ${f(r)} 0 0 1 ${pt(B)}A${f(r)} ${f(r)} 0 0 1 ${pt(A)}Z`;

/**
 * Lugares's leaf from base B to tip T: the lens (its edges arcs of 0.743 × the length) and the stem,
 * which starts 0.15 behind the base and runs 0.59 into the leaf. Returns the two strokes and, for
 * the fill, the stem's part outside the lens (`out`) and the rib it cuts inside it (`rib`).
 */
function leafOf(B, T) {
  const c = len(sub(T, B));
  const u = unit(sub(T, B));
  const s0 = add(B, mul(u, -0.152 * c));
  return {
    leaf: lens(B, T, 0.743 * c),
    stem: line(s0, add(B, mul(u, 0.593 * c))),
    out: line(s0, B),
    rib: line(add(B, mul(u, 0.136 * c)), add(B, mul(u, 0.593 * c))),
  };
}

/** Lugares's cloud (three lobes on a flat base) scaled by k, its base's left end set at `o`. */
const cloud = (k, o) => place(L.cloud.d[0], k, [7.25, 18.25], o);
/** Lugares's pine (crown, trunk, branch) scaled by k, the trunk's foot set at `o`. */
const pine = (k, o, n = 3) => L['tree-pine'].d.slice(0, n).map((d) => place(d, k, [12, 21.25], o));
/** A stroke that rises in two gentle S-bends from `a`, the rising smoke and steam of the set. */
const plume = ([x, y], h = 6.5, w = 1.25) => `M${pt([x, y])}C${pt([x - w, y - h * 0.2])} ${pt([x + w, y - h * 0.4])} ${pt([x, y - h * 0.6])}C${pt([x - w * 0.8, y - h * 0.75])} ${pt([x + w * 0.4, y - h * 0.9])} ${pt([x, y - h])}`;

// ── Badges and pieces in the badge's place ────────────────────────────────────────────────────
// Center (17.25, 17.25), circle of r 4.25, as the engine's badges; `knock` is the area the engine
// clears with a clearance of paper. A piece that isn't a status keeps the icon's style.
const BC = [17.25, 17.25];
/** The ring drawn clockwise, for cleared areas (filled nonzero, as logistica's). */
const clockwise = ([cx, cy], r) => `M${pt([cx - r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx + r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx - r, cy])}Z`;
const RING_K = clockwise(BC, 4.25);
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/**
 * Lugares's recycle made small: its three chasing arrows, each wrapping one corner of the triangle
 * (at -90°, 30° and 150°), drawn as arcs of one circle of radius r. Under r 8 the triangle's arrows
 * can't keep 3 between a head and the next tail; on the circle each gap is a chord of 3.
 */
function recycleMark(c, r, h = 2) {
  const gap = (2 * Math.asin(1.55 / r) * 180) / Math.PI;
  const half = (120 - gap) / 2;
  return [-90, 30, 150].flatMap((v) => {
    const a = arc(c[0], c[1], r, v - half, v + half);
    return [a.d, head(a.end, a.tangent, h)];
  });
}
/** The chasing arrows in the badge's place. */
const RECYCLE = (() => {
  const d = recycleMark(BC, 4);
  return own(d, `${RING_K}${d.join('')}`);
})();

// Lugares's leaf, small, at the badge's place (as logistica's parcel-leaf and limpieza's
// spray-bottle-leaf): a lens at 45° and its stalk toward the upper right.
const LEAF = (() => {
  const [A, B] = [
    [14.25, 20.25],
    [20.25, 14.25],
  ];
  const l = lens(A, B, 5.12);
  const stalk = line(B, [21.5, 13]);
  return own([l, stalk], `${RING_K}${stalk}`, { solid: [l], wire: [stalk] });
})();

// ── The planet ────────────────────────────────────────────────────────────────────────────────
// A circle and two landmasses, each a coast that leaves the rim and comes back to it (the Americas
// on the left, Eurasia and Africa on the upper right), at least 2.85 inside the rim so they never
// merge with it. Drawn at r 9 and scaled.
function earth([cx, cy] = [12, 12], r = 9) {
  const P = (p) => [cx + ((p[0] - 12) * r) / 9, cy + ((p[1] - 12) * r) / 9];
  const west = [polar(12, 12, 9, 197), [6.75, 8.75], [9.5, 9.25], [9, 12.25], [10.5, 14.75], [9.5, 17.25], polar(12, 12, 9, 113)];
  const east = [polar(12, 12, 9, -72), [14, 6.25], [16.5, 7.25], [15.5, 10], [17.75, 12.25], polar(12, 12, 9, 12)];
  return [circ(cx, cy, r), spline(west.map(P)), spline(east.map(P))];
}
const EARTH = earth();

// ── The sorting bin ───────────────────────────────────────────────────────────────────────────
// An open body tapering to its foot (the signature's square corner at the bottom right) under a rim
// that overhangs it; whatever falls in hangs over the mouth, 2.85 clear of the rim, at least 8
// wide. The body leaves room for two levels 3 apart.
const RIM = 12.25;
const BIN_BODY = roundline(
  [
    [5.5, RIM],
    [6.75, 21.25],
    [17.25, 21.25],
    [18.5, RIM],
  ],
  [0, 1.75, 0, 0],
);
const BIN_RIM = line([3.75, RIM], [20.25, RIM]);
/** A bin-* icon: the bin, then what falls in (`item`, with its own fill spec by index into it). */
function bin(tags, item, itemFill = {}) {
  const d = [BIN_BODY, BIN_RIM, ...item];
  const pick = (k) => (itemFill[k] ?? []).map((x) => (typeof x === 'number' ? item[x] : x));
  return {
    tags,
    d,
    fill: { solid: [shut(BIN_BODY), ...pick('solid')], wire: [BIN_RIM, ...pick('wire')], ...(itemFill.cut && { cut: pick('cut') }), ...(itemFill.lines && { lines: pick('lines') }) },
    parts: { bin: [0, 1], item: item.map((_, i) => i + 2) },
  };
}

// The garbage bag of bin-general, landfill and garbage-pile: a sack gathered to its neck at
// (12, 4), its bottom at y 9.4, and the two ends of its knot
const BAG = ['M11 4C7.75 4.75 6.75 6.75 6.75 7.9C6.75 8.9 7.5 9.4 9 9.4H15C16.5 9.4 17.25 8.9 17.25 7.9C17.25 6.75 16.25 4.75 13 4Z', 'M11 4L9.5 2.25M13 4L14.5 2.25'];
/** The bag scaled by k and turned by deg about its foot, its foot set at `o`. */
const bagAt = (k, o, deg = 0) => BAG.map((d) => turnPath(place(d, k, [12, 9.4], o), deg, o));

// What falls into each bin, over the mouth (y 2 to 9.4)
const ITEM = {
  // An arrow looping up out of the mouth and back into it
  recycling: () => ['M8.25 9.4V6.25A3.75 3.75 0 0 1 15.75 6.25V9.4', line([13.75, 7.4], [15.75, 9.4], [17.75, 7.4])],
  // A sheet with its corner folded over (the document's square corner at the bottom right)
  paper: () => [
    roundpoly(
      [
        [7, 2.25],
        [14, 2.25],
        [17, 5.25],
        [17, 9.25],
        [7, 9.25],
      ],
      [1.25, 0, 0, 0, 1.25],
    ),
    line([14, 2.25], [14, 5.25], [17, 5.25]),
  ],
  // A bottle on its side, cap to the left, two ribs round its body
  plastic: () => [
    roundpoly(
      [
        [7.75, 4.75],
        [10.25, 3.25],
        [18.75, 3.25],
        [18.75, 9.25],
        [10.25, 9.25],
        [7.75, 7.75],
      ],
      [0.4, 1.25, 1.75, 1.75, 1.25, 0.4],
    ),
    sq(5.25, 4.5, 2.5, 3.5, 0.75),
    line([13.25, 3.25], [13.25, 9.25]),
    line([16, 3.25], [16, 9.25]),
  ],
  // A jam jar: its lid and the body that widens from under it
  glass: () => [
    sq(8.5, 2, 7, 3, 1),
    roundline(
      [
        [9.5, 5],
        [7.5, 6.75],
        [7.5, 9.4],
        [16.5, 9.4],
        [16.5, 6.75],
        [14.5, 5],
      ],
      [0, 0.75, 1.25, 0, 0.75, 0],
    ),
  ],
  // Food scraps: a fish picked to the bone, its head, spine, two ribs and tail (an apple core
  // squeezed into 7 of height read as a star)
  organic: () => [
    roundpoly(
      [
        [4.25, 6.25],
        [8.25, 3.5],
        [8.25, 9],
      ],
      [1.5, 0.75, 0.75],
    ),
    line([8.25, 6.25], [17.25, 6.25]),
    line([11.25, 3.75], [11.25, 8.75]),
    line([14.25, 3.75], [14.25, 8.75]),
    line([19.75, 3.75], [17.25, 6.25], [19.75, 8.75]),
  ],
  // A can standing (bebidas's soda can, small): its chamfered rims, the lid's line and the tab
  metal: () => [
    roundpoly(
      [
        [9.75, 3.25],
        [14.25, 3.25],
        [15.25, 4.5],
        [15.25, 8.25],
        [14.25, 9.4],
        [9.75, 9.4],
        [8.75, 8.25],
        [8.75, 4.5],
      ],
      [0.3, 0.3, 0.5, 0.5, 0.3, 0.3, 0.5, 0.5],
    ),
    line([8.75, 4.5], [15.25, 4.5]),
    sq(10.75, 1.75, 2.5, 1.5, 0.6),
  ],
  // A plug lying on its side, prongs to the right, its cord trailing left
  electronics: () => [
    roundpoly(
      [
        [10.25, 4.25],
        [15, 2.75],
        [15, 9.25],
        [10.25, 7.75],
      ],
      [0.75, 1, 1, 0.75],
    ),
    line([15, 4.5], [18.5, 4.5]),
    line([15, 7.5], [18.5, 7.5]),
    'M10.25 6H8.25C6.5 6 5.5 7 5.5 8.75',
  ],
  // A cell on its side, its terminal to the right and the band of its positive end
  batteries: () => [sq(5.5, 3.25, 11.25, 6, 1.75), line([16.75, 6.25], [18.75, 6.25]), line([14, 3.25], [14, 9.25])],
  // A paint tin with its handle, a drop of paint falling beside it
  hazardous: () => [sq(5.75, 4.25, 9.5, 5.15, 1.25, { square: ['br'] }), 'M6.75 4.25A3.75 2.25 0 0 1 14.25 4.25', droplet([19.6, 7.4], 1.5)],
  // A tied bag: its sack gathered to the neck and the two ends of its knot
  general: () => BAG,
};

const icons = {
  'bin-recycling': bin(['reciclaje', 'contenedor', 'separación', 'recycling bin', 'sorting'], ITEM.recycling(), { wire: [0, 1] }),
  'bin-paper': bin(['papel y cartón', 'contenedor azul', 'reciclar papel', 'paper recycling', 'cardboard'], ITEM.paper(), { solid: [0], cut: [1] }),
  'bin-plastic': bin(['plásticos', 'envases', 'contenedor amarillo', 'plastic recycling', 'packaging'], ITEM.plastic(), { solid: [0, 1], cut: [2, 3] }),
  'bin-glass': bin(['vidrio', 'frascos', 'contenedor verde', 'glass recycling', 'bottle bank'], ITEM.glass(), { solid: [0, shut(ITEM.glass()[1])] }),
  'bin-organic': bin(['orgánicos', 'restos de comida', 'composta', 'organic waste', 'food scraps'], ITEM.organic(), { solid: [0], wire: [1, 2, 3, 4] }),
  'bin-metal': bin(['metales', 'latas', 'chatarra', 'metal recycling', 'cans'], ITEM.metal(), { solid: [0, 2], cut: [1] }),
  'bin-electronics': bin(['electrónicos', 'residuos electrónicos', 'cables', 'e-waste', 'electronics recycling'], ITEM.electronics(), { solid: [0], wire: [1, 2, 3] }),
  'bin-batteries': bin(['pilas', 'baterías', 'acopio', 'battery recycling', 'batteries'], ITEM.batteries(), { solid: [0], wire: [1], cut: [2] }),
  'bin-hazardous': bin(['residuos peligrosos', 'pintura', 'químicos', 'hazardous waste', 'chemicals'], ITEM.hazardous(), { solid: [0, 2], wire: [1] }),
  'bin-general': bin(['basura', 'residuos', 'relleno sanitario', 'general waste', 'landfill bin'], ITEM.general(), { solid: [0], wire: [1] }),
  'bin-level': {
    tags: ['nivel de llenado', 'contenedor inteligente', 'sensor', 'fill level', 'smart bin'],
    d: [BIN_BODY, BIN_RIM, line([9.25, 18.25], [14.75, 18.25]), line([9.25, 15.25], [14.75, 15.25])],
  },
};

// ── Sorting, compost and waste sites ──────────────────────────────────────────────────────────
{
  // Three small bins on one baseline, each a tapering body with its lid swung open behind it
  const bins = [4.875, 12, 19.125].flatMap((cx) => [
    roundpoly(
      [
        [cx - 2.125, 14.25],
        [cx + 2.125, 14.25],
        [cx + 1.6, 21.25],
        [cx - 1.6, 21.25],
      ],
      [0.6, 0.6, 0, 0.6],
    ),
    line([cx + 2.125, 14.25], polar(cx + 2.125, 14.25, 4.25, -120)),
  ]);
  icons['waste-sorting'] = { tags: ['separación de residuos', 'clasificar', 'contenedores', 'waste sorting', 'separate collection'], d: [...bins, line([2.75, 21.25], [21.25, 21.25])] };
}
{
  // Compost: a heap with lugares's sprout on its top and two curls of steam
  const heap = 'M2.75 21C3.25 16.5 7 14.25 12 14.25C17 14.25 20.75 16.5 21.25 21Z';
  const sp = L.sprout.d.slice(0, 3).map((d) => place(d, 0.6, [12, 21], [12, 14.25]));
  icons.compost = { tags: ['composta', 'compostaje', 'abono', 'compost', 'composting'], d: [heap, ...sp, plume([4.25, 12], 6.5), plume([19.75, 12], 6.5)] };
}
{
  // Landfill: a broad mound in section, two strata through it, and bin-general's bag on its top
  const mound = roundpoly(
    [
      [2.75, 21.25],
      [7.75, RIM],
      [16.25, RIM],
      [21.25, 21.25],
    ],
    [0.5, 2.5, 2.5, 0.5],
  );
  const x = (y) => 7.75 - ((y - RIM) * 5) / 9;
  icons.landfill = {
    tags: ['relleno sanitario', 'vertedero', 'basurero', 'landfill', 'dump site'],
    d: [mound, line([x(15.25), 15.25], [24 - x(15.25), 15.25]), line([x(18.25), 18.25], [24 - x(18.25), 18.25]), ...ITEM.general()],
  };
}
{
  // Garbage pile: three of bin-general's bags heaped, the two below leaning out and one on top
  icons['garbage-pile'] = {
    tags: ['basura acumulada', 'tiradero', 'reportar basura', 'garbage pile', 'illegal dumping'],
    d: [...bagAt(0.78, [6.5, 21.25], -10), ...bagAt(0.78, [17.5, 21.25], 10), ...bagAt(0.78, [12, 13.25])],
  };
}
{
  // Toxic waste: a drum on its side (its lid toward us), leaking a drop into a puddle
  const [fx, fy, rx, ry] = [13.5, 9.25, 2, 4.5];
  const face = ellipse(fx, fy, rx, ry);
  const body = `M${pt([fx, fy - ry])}H4.75A${f(rx)} ${f(ry)} 0 0 0 ${pt([4.75, fy + ry])}H${f(fx)}`;
  const ribs = [7.75, 10.75].map((x) => `M${pt([x, fy - ry])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([x, fy + ry])}`);
  icons['toxic-waste'] = {
    tags: ['residuos tóxicos', 'contaminación', 'químicos', 'toxic waste', 'hazardous spill'],
    d: [face, body, ...ribs, droplet([19.25, 13], 1.5), ellipse(16.5, 19.25, 4.75, 1.75)],
  };
}
{
  // Plastic bag: the single-use T-shirt bag, its two loop handles over the body and a crease
  const body = 'M5.25 8.25H9C9 10 10.25 11.25 12 11.25C13.75 11.25 15 10 15 8.25H18.75V21.25H7.25A2 2 0 0 1 5.25 19.25Z';
  const handles = ['M5.25 8.25V5A2 2 0 0 1 9 5V8.25', 'M15 8.25V5A2 2 0 0 1 18.75 5V8.25'];
  icons['plastic-bag'] = { tags: ['bolsa de plástico', 'un solo uso', 'sin bolsas', 'plastic bag', 'single-use'], d: [body, ...handles, line([8.5, 15], [10.25, 17.75])] };
}
{
  // Ocean plastic: a bottle and a scrap half sunk, the water line in front of them
  const clip = (pts, y) => {
    // The part of a closed polygon above y, as an open run from the cut's right end around to its left
    const n = pts.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const [a, b] = [pts[i], pts[(i + 1) % n]];
      if (a[1] <= y) out.push(a);
      if (a[1] <= y !== b[1] <= y) out.push([a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), y]);
    }
    const k = out.findIndex((p, i) => Math.abs(p[1] - y) < 1e-9 && Math.abs(out[(i + 1) % out.length][1] - y) < 1e-9);
    return k < 0 ? out : [...out.slice(k + 1), ...out.slice(0, k + 1)];
  };
  // bin-plastic's bottle, a little smaller and tipped up, its cap to the upper left
  const B = (p) => rot([10 + (p[0] - 12) * 0.85, 10.5 + (p[1] - 6.25) * 0.85], [10, 10.5], 20);
  const bottlePts = [
    [5.25, 4.75],
    [7.75, 4.75],
    [10.25, 3.25],
    [18.75, 3.25],
    [18.75, 9.25],
    [10.25, 9.25],
    [7.75, 7.75],
    [5.25, 7.75],
  ].map(B);
  const scrap = [
    [16.75, 12],
    [17.5, 8.75],
    [19, 9.5],
    [20.75, 8.25],
    [20.5, 12.5],
  ];
  const cut = 11.25;
  const radii = (pts) => pts.map((p, i) => (i === 0 || i === pts.length - 1 ? 0 : 0.6));
  const b = clip(bottlePts, cut);
  const s = clip(scrap, cut);
  icons['ocean-plastic'] = {
    tags: ['plástico en el mar', 'basura marina', 'océanos', 'ocean plastic', 'marine litter'],
    d: [roundline(b, radii(b)), line(B([7.75, 4.75]), B([7.75, 7.75])), roundline(s, radii(s)), wave(2.75, 21.25, 15.25), wave(2.75, 21.25, 19.5)],
  };
}
{
  // Storm drain: a grate of bars in the street and the rain falling into it
  icons['storm-drain'] = {
    tags: ['alcantarilla', 'coladera', 'drenaje pluvial', 'storm drain', 'sewer grate'],
    d: [sq(3.25, 13.25, 17.5, 8, 2.25, { square: ['br'] }), ...[7.25, 10.25, 13.25, 16.25].map((x) => line([x + 0.5, 13.25], [x + 0.5, 21.25])), droplet([8.5, 6.25], 2), droplet([15.5, 8.25], 2)],
  };
}

// ── Recycling points, refill and zero waste ───────────────────────────────────────────────────
icons['map-pin-recycle'] = { tags: ['punto de reciclaje', 'centro de acopio', 'mapa', 'recycling point', 'drop-off'], d: L['map-pin-star'].d, badge: RECYCLE };
icons['calendar-recycle'] = { tags: ['día de recolección', 'calendario de reciclaje', 'basura', 'collection day', 'pickup schedule'], d: nucleo.icons.calendar.d.slice(0, 4), badge: RECYCLE };
icons['smartphone-recycle'] = { tags: ['reciclar celular', 'canje', 'reacondicionado', 'device recycling', 'trade-in'], d: dispositivos.icons.smartphone.d, badge: RECYCLE };
{
  // Refill pouch: a stand-up pouch (straight top, the gusset rounding its foot) tipped over so its
  // spout points down at a bottle's neck, 3.75 below it
  const c = [7.75, 7.5];
  const T = (p) => rot([c[0] + p[0], c[1] + p[1]], c, 135);
  const pouch = roundpoly([T([-2.75, -3.5]), T([2.75, -3.5]), T([3.25, 3.5]), T([-3.25, 3.5])], [0.5, 0.5, 1.75, 1.75]);
  const spout = roundpoly([T([0.5, -3.5]), T([0.5, -5.25]), T([2.5, -5.25]), T([2.5, -3.5])], 0.4);
  const tip = T([1.5, -5.25]);
  const nx = tip[0] + 3.5;
  const bottle = roundline(
    [
      [nx - 1.25, 15.5],
      [nx - 1.25, 16.5],
      [nx - 3.5, 17.75],
      [nx - 3.5, 21.25],
      [nx + 3.5, 21.25],
      [nx + 3.5, 17.75],
      [nx + 1.25, 16.5],
      [nx + 1.25, 15.5],
    ],
    [0, 0.6, 1.25, 1.5, 0, 1.25, 0.6, 0],
  );
  icons['refill-pouch'] = { tags: ['recarga', 'repuesto', 'doypack', 'refill pack', 'pouch'], d: [pouch, spout, bottle] };
}
{
  // Zero waste: cocina's canning jar holding one crumpled scrap
  const jar = cocina.icons['canning-jar'].d;
  const scrap = roundpoly(
    Array.from({ length: 9 }, (_, i) => polar(12, 15.75, [3, 2.3, 3.1, 2.4, 2.9, 2.2, 3.1, 2.5, 2.8][i], -90 + i * 40)),
    0.45,
  );
  icons['zero-waste'] = { tags: ['basura cero', 'residuo cero', 'frasco', 'zero waste', 'low waste'], d: [...jar, scrap] };
}

// ── The cycle, eco labels and footprints ──────────────────────────────────────────────────────
// One arrow round a ring of r 8.5, clockwise, its head of 3.4 along the tangent (nucleo's refresh)
const CYCLE = (() => {
  const a = arc(12, 12, 8.5, -40, 250);
  return [a.d, head(a.end, a.tangent, 3.4)];
})();
const CYCLE_LEAF = leafOf([9.25, 14.75], [15.75, 8.25]);
icons['leaf-cycle'] = { tags: ['sostenibilidad', 'renovable', 'ciclo', 'sustainability', 'renewable'], d: [...CYCLE, CYCLE_LEAF.leaf, CYCLE_LEAF.stem] };
icons['water-recycling'] = { tags: ['reúso de agua', 'agua tratada', 'reciclar agua', 'water reuse', 'water recycling'], d: [...CYCLE, droplet([12, 13], 3.25)] };
{
  // Biodegradable: lugares's leaf breaking at half its length, the tip gone to three dots
  const [B, T] = [
    [5.5, 18.5],
    [20.25, 3.75],
  ];
  const c = len(sub(T, B));
  const u = unit(sub(T, B));
  const nrm = [u[1], -u[0]];
  const r = 0.743 * c;
  // Where a line across the axis at distance a from B meets either edge
  const edge = (a, side) => {
    const cc = add(add(B, mul(u, c / 2)), mul(nrm, side * Math.sqrt(r * r - (c / 2) ** 2)));
    const along = (B[0] + u[0] * a - cc[0]) * u[0] + (B[1] + u[1] * a - cc[1]) * u[1];
    return add(add(cc, mul(u, along)), mul(nrm, -side * Math.sqrt(r * r - along * along)));
  };
  const at = 0.5 * c;
  const [P1, P2] = [edge(at, -1), edge(at, 1)];
  const mid = add(B, mul(u, at));
  const jag = [add(mid, add(mul(nrm, 1.2), mul(u, 0.9))), add(mid, add(mul(nrm, -1.2), mul(u, -0.6)))];
  const shape = `M${pt(B)}A${f(r)} ${f(r)} 0 0 1 ${pt(P1)}L${pt(jag[1])}L${pt(jag[0])}L${pt(P2)}A${f(r)} ${f(r)} 0 0 1 ${pt(B)}Z`;
  const D = (a, o) => add(add(B, mul(u, a)), mul(nrm, o));
  icons.biodegradable = {
    tags: ['biodegradable', 'compostable', 'se degrada', 'biodegradable', 'compostable'],
    d: [shape, line(add(B, mul(u, -3.18)), add(B, mul(u, 0.4 * c))), dot(...D(0.68 * c, 2)), dot(...D(0.68 * c, -2)), dot(...D(0.86 * c, 0))],
  };
}
const SCORE_LEAF = leafOf([4.75, 12.25], [12.25, 4.75]);
icons['eco-score'] = {
  tags: ['puntuación ecológica', 'calificación', 'sostenibilidad', 'eco score', 'eco rating'],
  d: [
    ...[
      [4, 16.25],
      [10.25, 12.75],
      [16.5, 9.25],
    ].map(([x, y]) => sq(x, y, 3.5, 20.75 - y, 1.25)),
    SCORE_LEAF.leaf,
    SCORE_LEAF.stem,
  ],
};
icons['bag-leaf'] = { tags: ['compra sostenible', 'producto ecológico', 'filtro eco', 'eco product', 'sustainable shopping'], d: comercio.icons.bag.d, badge: LEAF };
icons['route-leaf'] = { tags: ['ruta ecológica', 'menos emisiones', 'navegación', 'eco route', 'green route'], d: L['route-plus'].d, badge: LEAF };
{
  // The footprint: lugares's left print, larger, its sole and its heel
  const [sole, heel] = L.footprints.d.slice(0, 2).map((d) => place(d, 1.45, [7.83, 12.25], [8.5, 12.25]));
  icons['footprint-carbon'] = { tags: ['huella de carbono', 'emisiones', 'CO2', 'carbon footprint', 'emissions'], d: [sole, heel, cloud(0.42, [14.25, 18.25])] };
  icons['footprint-water'] = { tags: ['huella hídrica', 'consumo de agua', 'agua', 'water footprint', 'water use'], d: [sole, heel, droplet([17.5, 15], 3.25)] };
}
// Carbon credit: a coin turned a little (its face and its edge) with a leaf on the face
const CREDIT_LEAF = leafOf([8.75, 15.25], [13.75, 8.75]);
icons['carbon-credit'] = {
  tags: ['crédito de carbono', 'compensación', 'bonos verdes', 'carbon credit', 'offset'],
  d: [ellipse(10.75, 12, 6.5, 9), 'M10.75 3H13.25A6.5 9 0 0 1 13.25 21H10.75', CREDIT_LEAF.leaf, CREDIT_LEAF.stem],
};
// Carbon neutral: a level beam on its fulcrum, a puff of smoke on one end and a leaf on the other
const NEUTRAL_LEAF = leafOf([15.75, 13.25], [20.75, 8.25]);
icons['carbon-neutral'] = {
  tags: ['carbono neutral', 'cero neto', 'equilibrio', 'carbon neutral', 'net zero'],
  d: [
    roundpoly(
      [
        [12, 14],
        [16, 20.75],
        [8, 20.75],
      ],
      [0.6, 1, 1],
    ),
    line([2.75, 14], [21.25, 14]),
    cloud(0.45, [4.5, 14]),
    NEUTRAL_LEAF.leaf,
    NEUTRAL_LEAF.stem,
  ],
};
icons['smokestack-arrow-down'] = { tags: ['menos emisiones', 'reducción', 'meta climática', 'emissions reduced', 'reduction target'], d: industria.icons.smokestack.d, badge: badge('arrow-down') };
{
  // Car emissions: vehiculos's car in profile, smaller, and two plumes rising from its exhaust
  const car = vehiculos.icons['car-side'];
  const P = (d) => place(d, 0.68, [21.5, 19.77], [21.25, 20.75]);
  icons['car-emissions'] = { tags: ['emisiones del auto', 'escape', 'contaminación', 'car emissions', 'exhaust'], d: [...car.d.map(P), plume([5.5, 18.75], 7, 1.1), plume([7, 12.25], 6.5, 1.1)] };
  icons['car-emissions'].fill = { solid: car.fill.solid.map(P), cut: car.fill.cut.map(P), lines: icons['car-emissions'].d.slice(5) };
}
{
  // Plane emissions: aviacion's plane in profile, smaller, and a cloud trailing below its tail
  const plane = aviacion.icons['plane-side'];
  const P = (d) => place(d, 0.64, [21.25, 12], [21.25, 9.25]);
  icons['plane-emissions'] = {
    tags: ['emisiones de vuelo', 'aviación', 'huella de carbono', 'flight emissions', 'aviation'],
    d: [...plane.d.map(P), cloud(0.36, [4.5, 18.5])],
  };
  icons['plane-emissions'].fill = { solid: [...plane.fill.solid.map(P), cloud(0.36, [4.5, 18.5])] };
}

// ── The planet and its climate ────────────────────────────────────────────────────────────────
icons.earth = { tags: ['tierra', 'planeta', 'día de la tierra', 'earth', 'planet'], d: EARTH };
{
  // Earth warming: the planet with lugares's thermometer standing in front of it, at its right
  const th = place(L.thermometer.d[0], 0.72, [12, 16.75], [17.75, 17.75]);
  icons['earth-warming'] = { tags: ['calentamiento global', 'cambio climático', 'temperatura', 'global warming', 'climate change'], d: EARTH, badge: own([th], th, { solid: [th] }) };
}
icons['earth-heart'] = { tags: ['amor al planeta', 'día de la tierra', 'cuidar', 'love the planet', 'earth day'], d: EARTH, badge: badge('heart') };
{
  // The hands: gestos's open hand, palm up, holding the planet or a drop
  const hand = gestos.icons['hand-sprout'].d.slice(0, 2);
  icons['hand-earth'] = { tags: ['cuidar el planeta', 'compromiso', 'ecología', 'care for the planet', 'pledge'], d: [...hand, ...earth([13.25, 7.6], 5.4)] };
  icons['hand-droplet'] = { tags: ['ahorrar agua', 'cuidar el agua', 'gota', 'save water', 'water conservation'], d: [...hand, droplet([13.25, 8.75], 3.5)] };
}
{
  // Glacier melt: two peaks with the ice tongue between them ending in a cliff of ice, cracked down
  // its face, and drops falling below it
  const peaks = 'M2.5 13.5L6.75 4.5L9.75 8.5M14.25 8.5L17.25 4.5L21.5 13.5';
  const tongue = roundline(
    [
      [9.75, 8.5],
      [8.5, 14.75],
      [15.5, 14.75],
      [14.25, 8.5],
    ],
    [0, 0.75, 0.75, 0],
  );
  icons['glacier-melt'] = { tags: ['deshielo', 'glaciar', 'cambio climático', 'glacier melt', 'melting ice'], d: [peaks, tongue, line([12, 14.75], [12, 11.75]), droplet([12, 20.25], 1.6)] };
}
{
  // Sea level rise: water rising up a shore toward the house on top, an arrow up over it
  icons['sea-level-rise'] = {
    tags: ['aumento del nivel del mar', 'costa', 'cambio climático', 'sea level rise', 'coastal flooding'],
    d: [
      'M8.25 21.25L15 13.5H21.25',
      wave(2.75, 12.85, 16, 1.33),
      wave(2.75, 9.5, 19.75, 1.33),
      line([6, 12.75], [6, 5]),
      line([3.25, 7.75], [6, 5], [8.75, 7.75]),
      roundpoly(
        [
          [15.75, 13.5],
          [15.75, 9.75],
          [18.25, 7.25],
          [20.75, 9.75],
          [20.75, 13.5],
        ],
        [0, 0.5, 0.75, 0.5, 0],
      ),
    ],
  };
}
{
  // Green city: lugares's city with lugares's tree standing in front of it
  const [crown, trunk] = L.tree.d.slice(0, 2).map((d) => place(d, 0.45, [12, 21.25], [17, 21.25]));
  icons['green-city'] = { tags: ['ciudad verde', 'ciudad sostenible', 'áreas verdes', 'green city', 'urban greening'], d: L.city.d, badge: own([crown, trunk], `${crown}${trunk}`, { solid: [crown], wire: [trunk] }) };
}
{
  // Air quality: a half dial in three segments with its needle, and a gust of wind under it
  const [c, r] = [[12, 13], 8.25];
  const gap = (2 * Math.asin(1.5 / r) * 180) / Math.PI;
  const seg = (180 - 2 * gap) / 3;
  const segs = [0, 1, 2].map((i) => arc(c[0], c[1], r, 180 + i * (seg + gap), 180 + i * (seg + gap) + seg).d);
  icons['air-quality'] = {
    tags: ['calidad del aire', 'índice', 'contaminación', 'air quality', 'AQI'],
    d: [...segs, line(c, polar(c[0], c[1], 5.25, -55)), dot(...c), 'M3.75 17.75H15.25A2 2 0 1 1 13.25 19.75'],
  };
}
{
  // The skyline smog and light pollution share: three buildings on one base, a column of windows each
  const SKY = [
    roundpoly(
      [
        [3.25, 21.25],
        [3.25, 14],
        [8.75, 14],
        [8.75, 10.5],
        [14.25, 10.5],
        [14.25, 14.75],
        [20.75, 14.75],
        [20.75, 21.25],
      ],
      [0, 1.25, 0, 1.25, 1.25, 0, 1.25, 0],
    ),
    ...[
      [6, 17],
      [6, 19.5],
      [11.5, 13.75],
      [11.5, 16.75],
      [11.5, 19.5],
      [17.5, 18.25],
    ].map((p) => dot(...p, 0.3)),
  ];
  // Smog: a thick wavy band over the skyline
  const top = wave(3.75, 20.25, 3.75, 1.33);
  const bottom = wave(20.25, 3.75, 6.75, -1.33).replace(/^M[^C]+/, '');
  const band = `${top}A1.5 1.5 0 0 1 ${pt([20.25, 6.75])}${bottom}A1.5 1.5 0 0 1 ${pt([3.75, 3.75])}Z`;
  icons.smog = { tags: ['smog', 'contaminación del aire', 'ciudad', 'smog', 'air pollution'], d: [...SKY, band] };
  // Light pollution: a dome of rays over the skyline and one faint star
  const rays = [-135, -112.5, -90, -67.5, -45].map((a) => line(polar(11.5, 15.5, 7.75, a), polar(11.5, 15.5, 9.75, a)));
  const star = roundpoly(
    [
      [19.25, 2.75],
      [19.85, 3.85],
      [20.75, 4.25],
      [19.85, 4.65],
      [19.25, 5.75],
      [18.65, 4.65],
      [17.75, 4.25],
      [18.65, 3.85],
    ],
    0.15,
  );
  icons['light-pollution'] = { tags: ['contaminación lumínica', 'cielo nocturno', 'luz', 'light pollution', 'night sky'], d: [...SKY, ...rays, star] };
}
{
  // Water pollution: a pipe from the left pouring a stream into the water
  icons['water-pollution'] = {
    tags: ['contaminación del agua', 'descarga', 'aguas residuales', 'water pollution', 'discharge'],
    d: ['M2.75 4H9.25V7.5H2.75', 'M9.25 4C13 4 15.25 7.5 15.25 12.5', 'M9.25 7.5C11 7.5 12.25 9.5 12.25 12.5', wave(2.75, 21.25, 16.5), wave(2.75, 21.25, 20.5)],
  };
}
{
  // Oil spill: a large drop on the water, its slick a ring spreading round it
  const [c, r] = [[12, 10.75], 4.5];
  const [ex, ey, rx, ry] = [12, 15.25, 9, 3];
  // The ring passes behind the drop: it stops 3 from the drop's edge on either side
  let t0 = 180;
  for (let t = 180; t <= 270; t += 0.25) {
    const p = [ex + rx * Math.cos((t * Math.PI) / 180), ey + ry * Math.sin((t * Math.PI) / 180)];
    if (len(sub(p, c)) < r + 3) break;
    t0 = t;
  }
  const A = [ex + rx * Math.cos((t0 * Math.PI) / 180), ey + ry * Math.sin((t0 * Math.PI) / 180)];
  const B = [2 * ex - A[0], A[1]];
  icons['oil-spill'] = {
    tags: ['derrame de petróleo', 'mancha', 'marea negra', 'oil spill', 'oil slick'],
    d: [droplet(c, r), `M${pt(A)}A${f(rx)} ${f(ry)} 0 1 0 ${pt(B)}`, wave(4.25, 19.75, 20.75)],
  };
}
{
  // Noise pollution: jagged wave fronts arriving at a house from the left
  const house = L.house.d.slice(0, 2).map((d) => place(d, 0.52, [21.25, 20.75]));
  const front = (r) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(polar(-3.5, 15.25, r + (i % 2 ? 0.75 : -0.75), -28 + (56 * i) / 6));
    return line(...pts);
  };
  icons['noise-pollution'] = { tags: ['contaminación acústica', 'ruido', 'molestia', 'noise pollution', 'noise'], d: [...house, front(7.75), front(11.75)] };
}
{
  // Deforestation: lugares's pine standing between two felled stumps
  const crown = place(L['tree-pine'].d[0], 0.75, [12, 17.75], [12, 14.5]);
  const branch = place(L['tree-pine'].d[2], 0.75, [12, 17.75], [12, 14.5]);
  const trunk = line([12, 21.25], [12, 14.5 - (17.75 - 9.75) * 0.75]);
  const stump = (cx) =>
    roundline(
      [
        [cx - 2.25, 21.25],
        [cx - 1.5, 20.25],
        [cx - 1.5, 18.25],
        [cx + 1.5, 17.5],
        [cx + 1.5, 20.25],
        [cx + 2.25, 21.25],
      ],
      [0, 0.6, 0.4, 0.4, 0.6, 0],
    );
  icons.deforestation = { tags: ['deforestación', 'tala', 'pérdida de bosque', 'deforestation', 'logging'], d: [crown, trunk, branch, stump(4.75), stump(19.25), line([2.75, 21.25], [21.25, 21.25])] };
}
{
  // Tree planting: lugares's sprout in a mound, a spade stuck in the ground beside it
  const sp = L.sprout.d.slice(0, 3).map((d) => place(d, 0.62, [12, 21], [8.25, 18.25]));
  icons['tree-planting'] = {
    tags: ['reforestación', 'plantar árboles', 'siembra', 'tree planting', 'reforestation'],
    d: ['M2.75 21.25H21.25', 'M3.75 21.25C4.5 19 6.25 18.25 8.25 18.25C10.25 18.25 12 19 12.75 21.25', ...sp, 'M16.25 21.25V17A1.5 1.5 0 0 1 17.75 15.5H18.75A1.5 1.5 0 0 1 20.25 17V21.25', line([18.25, 15.5], [18.25, 4]), line([16.25, 4], [20.25, 4])],
  };
}
{
  // Wildfire: lugares's flame rising beside lugares's pine
  const flame = L.flame.d.map((d) => place(d, 0.5, [12, 20.85], [6, 20.85]));
  icons.wildfire = { tags: ['incendio forestal', 'fuego', 'bosque', 'wildfire', 'forest fire'], d: [...pine(0.75, [16.75, 21.25]), ...flame] };
}
{
  // Wildlife crossing: an arched overpass with lugares's pine on top and the road running under it
  icons['wildlife-crossing'] = {
    tags: ['paso de fauna', 'ecoducto', 'vida silvestre', 'wildlife crossing', 'ecoduct'],
    d: ['M2.75 10.25H21.25V21.25H17.5A5.5 8 0 0 0 6.5 21.25H2.75Z', 'M9.75 21.25L12 16.5L14.25 21.25', ...L.tree.d.slice(0, 2).map((d) => place(d, 0.42, [12, 21.25], [12, 10.25]))],
  };
}
{
  // Rain barrel: a barrel under a downspout, a drop falling into it
  const barrel = 'M7 14.25H17C17.9 16.25 17.9 19.25 17 21.25H7C6.1 19.25 6.1 16.25 7 14.25Z';
  const spout = roundpoly(
    [
      [2.75, 2.75],
      [12.5, 2.75],
      [12.5, 6.75],
      [9.5, 6.75],
      [9.5, 5.75],
      [2.75, 5.75],
    ],
    [0, 1.25, 0.4, 0.4, 0.6, 0],
  );
  icons['rain-barrel'] = { tags: ['captación de lluvia', 'barril', 'agua de lluvia', 'rain barrel', 'rainwater harvesting'], d: [barrel, line([6.35, 17.75], [17.65, 17.75]), spout, droplet([11, 10.75], 1.25)] };
}
{
  // Drought: cracked ground under a blazing sun
  const sun = [circ(12, 8.25, 2.5), ...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => line(polar(12, 8.25, 4.25, a), polar(12, 8.25, 5.75, a)))];
  icons.drought = {
    tags: ['sequía', 'escasez de agua', 'calor', 'drought', 'water scarcity'],
    d: [sq(2.75, 17, 18.5, 4.25, 1.5), line([8, 17], [9, 18.5], [7.75, 19.75], [8.5, 21.25]), line([15.75, 17], [14.75, 18.75], [16.25, 19.75], [15.5, 21.25]), ...sun],
  };
}
{
  // Flood: a house's roof poking above three lines of water
  icons.flood = {
    tags: ['inundación', 'crecida', 'desastre', 'flood', 'flooding'],
    d: ['M3.75 8.5L11.15 2.97A1.25 1.25 0 0 1 12.85 2.97L20.25 8.5', 'M6.5 6.75V8.75M17.5 6.75V8.75', wave(2.75, 21.25, 12.5), wave(2.75, 21.25, 16.5), wave(2.75, 21.25, 20.5)],
  };
}
{
  // Earthquake: the ground split by a fissure, the tremor's arcs on both sides
  const arcs = [
    [5, 155, 205],
    [8, 164, 196],
  ].flatMap(([r, a0, a1]) => [arc(12, 9, r, a0, a1).d, arc(12, 9, r, -(a1 - 180), -(a0 - 180)).d]);
  icons.earthquake = {
    tags: ['sismo', 'terremoto', 'temblor', 'earthquake', 'seismic'],
    d: ['M2.75 14.5H10.25L11.75 16.75L10.75 18.5L12 21.25', 'M21.25 14.5H13.75L14.5 16.75L13.25 18.75L12 21.25', ...arcs],
  };
}
{
  // Landslide: a slope with three rocks tumbling down to its foot
  const rock = ([cx, cy], s, deg) =>
    roundpoly(
      [
        [-1.9, 0.6],
        [-1, -1.6],
        [1.2, -1.8],
        [2, 0.2],
        [0.8, 1.7],
        [-1.2, 1.6],
      ].map(([x, y]) => rot([cx + x * s, cy + y * s], [cx, cy], deg)),
      0.8 * s,
    );
  icons.landslide = {
    tags: ['deslave', 'deslizamiento', 'derrumbe', 'landslide', 'mudslide'],
    d: ['M2.75 5.75C8.25 6.5 10.5 15 16 21.25H2.75Z', 'M16 21.25H21.25', rock([10.75, 6.75], 1, 15), rock([15.25, 12.5], 1.1, -20), rock([19, 18.75], 1.15, 10)],
  };
}
{
  // Tsunami: a towering wave curling over a small house on the shore
  icons.tsunami = {
    tags: ['tsunami', 'maremoto', 'ola gigante', 'tsunami', 'tidal wave'],
    d: [
      'M2.75 21.25C5.75 20 6 3 12.75 3A5.5 5.5 0 0 1 18.25 8.5A2.75 2.75 0 0 1 12.75 8.5C10.75 10.5 10 15 10.25 21.25',
      roundpoly(
        [
          [14.5, 21.25],
          [14.5, 17],
          [17.25, 14.25],
          [20, 17],
          [20, 21.25],
        ],
        [0, 0.5, 0.75, 0.5, 0],
      ),
      line([2.75, 21.25], [21.25, 21.25]),
    ],
  };
}
{
  // Avalanche: a snowy peak with slabs of snow breaking off down its right side
  const [top, lf, rt] = [
    [9, 4.25],
    [2.75, 20.5],
    [21.25, 20.5],
  ];
  const peak = roundpoly([lf, top, rt], [0.5, 1.25, 0.5]);
  const v = unit(sub(rt, top));
  const n = [v[1], -v[0]];
  const slab = (t, deg) => {
    const c = add(add(top, mul(v, t)), mul(n, 4));
    return roundpoly(
      [
        [-1.5, -1.5],
        [1.5, -1.5],
        [1.5, 1.5],
        [-1.5, 1.5],
      ].map(([x, y]) => rot([c[0] + x, c[1] + y], c, deg)),
      0.6,
    );
  };
  icons.avalanche = { tags: ['avalancha', 'alud', 'nieve', 'avalanche', 'snow slide'], d: [peak, 'M6.6 10.25L8.25 11.5L9.75 10L11.25 11.5L12.85 10.25', slab(3.5, 20), slab(8, 50), slab(12.25, 10)] };
}
{
  // Sandbags: two pillow-shaped bags below and one on top, their corners pinched
  const pillow = (x0, y0, x1, y1, b = 1.25) => {
    const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
    return `M${pt([x0, y0])}Q${pt([cx, y0 - b])} ${pt([x1, y0])}Q${pt([x1 + b, cy])} ${pt([x1, y1])}Q${pt([cx, y1 + b])} ${pt([x0, y1])}Q${pt([x0 - b, cy])} ${pt([x0, y0])}Z`;
  };
  icons.sandbags = {
    tags: ['costales de arena', 'barrera', 'contención', 'sandbags', 'flood barrier'],
    d: [pillow(3.75, 15.5, 10.5, 20.25), pillow(13.5, 15.5, 20.25, 20.25), pillow(8.5, 6.75, 15.5, 11.5)],
  };
}
{
  // Storm damage: lugares's house with its roof peeling up in the wind
  icons['storm-damage'] = {
    tags: ['daños por tormenta', 'viento', 'siniestro', 'storm damage', 'wind damage'],
    d: ['M2.75 11.25L11.2 4.17A1.25 1.25 0 0 1 12.8 4.17L15 6C16.75 7.25 18.75 6.75 20.75 4.75', L.house.d[1], L.house.d[2], 'M2.75 2.75H8.5A1.75 1.75 0 1 1 6.75 4.5'],
  };
}

// The alerts: the engine's alert badge on their base
const ALERT_TAGS = {
  'air-quality-alert': ['alerta de calidad del aire', 'contingencia', 'aire', 'air quality alert', 'pollution warning'],
  'wildfire-alert': ['alerta de incendio', 'evacuación', 'humo', 'wildfire alert', 'fire warning'],
  'flood-alert': ['alerta de inundación', 'aviso', 'lluvias', 'flood alert', 'flood warning'],
  'earthquake-alert': ['alerta sísmica', 'aviso de sismo', 'temblor', 'earthquake alert', 'seismic alert'],
};
for (const name of Object.keys(ALERT_TAGS)) icons[name] = { tags: ALERT_TAGS[name], d: icons[name.replace(/-alert$/, '')].d, badge: badge('alert') };

// ── Blocks: fill, parts, motion, mirror, levels, value and variants ───────────────────────────
// Fill by index into d (DESIGN.md › Fill): `solid` closed shapes ({ z: i } closes an open stroke),
// `cut` knocked out, `lines` apart with a clearance, `wire` attached; a string is a path of its own.
const FILL_SPEC = {
  'bin-level': { solid: [{ z: 0 }], wire: [1], cut: [2, 3] },
  'waste-sorting': { solid: [0, 2, 4], wire: [1, 3, 5, 6] },
  compost: { solid: [0, 2, 3], wire: [1], lines: [4, 5] },
  landfill: { solid: [0, 3], cut: [1, 2], wire: [4] },
  'garbage-pile': { solid: [0, 2, 4], wire: [1, 3, 5] },
  'toxic-waste': { solid: [0, { z: 1 }, 4, 5], cut: [2, 3] },
  'plastic-bag': { solid: [0], wire: [1, 2], cut: [3] },
  'ocean-plastic': { solid: [{ z: 0 }, { z: 2 }], cut: [1], wire: [3, 4] },
  'storm-drain': { solid: [0, 5, 6], cut: [1, 2, 3, 4] },
  'map-pin-recycle': { solid: [0], cut: [1] },
  'calendar-recycle': { solid: [0], lines: [1, 2], cut: [3] },
  'smartphone-recycle': { solid: [0], cut: [1] },
  'refill-pouch': { solid: [0, 1, { z: 2 }] },
  'zero-waste': { solid: [{ z: 0 }, 1], cut: [2] },
  'leaf-cycle': { solid: [2], wire: [0, 1, CYCLE_LEAF.out], cut: [CYCLE_LEAF.rib] },
  'water-recycling': { solid: [2], wire: [0, 1] },
  biodegradable: { solid: [0, 2, 3, 4], wire: [1] },
  'eco-score': { solid: [0, 1, 2, 3], wire: [SCORE_LEAF.out], cut: [SCORE_LEAF.rib] },
  'bag-leaf': { solid: [0], lines: [1] },
  'route-leaf': { solid: [1], wire: [0] },
  'footprint-carbon': { solid: [0, 1, 2] },
  'footprint-water': { solid: [0, 1, 2] },
  'carbon-credit': { solid: [0, { z: 1 }], cut: [2, 3] },
  'carbon-neutral': { solid: [0, 2, 3], wire: [1, NEUTRAL_LEAF.out], cut: [NEUTRAL_LEAF.rib] },
  'smokestack-arrow-down': { solid: [{ z: 0 }, 3], cut: [1, 2] },
  earth: { solid: [0], cut: [1, 2] },
  'earth-warming': { solid: [0], cut: [1, 2] },
  'earth-heart': { solid: [0], cut: [1, 2] },
  'hand-earth': { solid: [0, { z: 1 }, 2], cut: [3, 4] },
  'hand-droplet': { solid: [0, { z: 1 }, 2] },
  'glacier-melt': { solid: [{ z: 1 }, 3], cut: [2], wire: [0] },
  'sea-level-rise': { solid: [5], wire: [0, 1, 2, 3, 4] },
  'green-city': { solid: [0, 1], cut: [2, 3, 4, 5, 6, 7] },
  'air-quality': false,
  smog: { solid: [0, 7], cut: [1, 2, 3, 4, 5, 6] },
  'light-pollution': { solid: [0, 12], cut: [1, 2, 3, 4, 5, 6], lines: [7, 8, 9, 10, 11] },
  'water-pollution': { solid: [{ z: 0 }, 'M9.25 4C13 4 15.25 7.5 15.25 12.5H12.25C12.25 9.5 11 7.5 9.25 7.5Z'], wire: [3, 4] },
  'oil-spill': { solid: [0], wire: [1, 2] },
  'noise-pollution': { solid: [{ z: 0 }, { z: 1 }], lines: [2, 3] },
  deforestation: { solid: [0, { z: 3 }, { z: 4 }], wire: ['M12 21.25L12 14.5', 5], cut: [place(L['tree-pine'].fill.cut[0], 0.75, [12, 17.75], [12, 14.5]), 2] },
  'tree-planting': { solid: [{ z: 1 }, 3, 4, { z: 5 }], wire: [0, 2, 6, 7] },
  wildfire: { solid: [0, 3], wire: ['M16.75 21.25L16.75 18.63'], cut: [place(L['tree-pine'].fill.cut[0], 0.75, [12, 21.25], [16.75, 21.25]), 2, 4] },
  'wildlife-crossing': { solid: [0, 2], wire: [1, 3] },
  'rain-barrel': { solid: [0, 2, 3], cut: [1] },
  drought: { solid: [0, 3], cut: [1, 2], lines: [4, 5, 6, 7, 8, 9, 10, 11] },
  flood: { solid: [{ z: 0 }], wire: [1, 2, 3, 4] },
  earthquake: false,
  landslide: { solid: [0, 2, 3, 4], wire: [1] },
  tsunami: { solid: [{ z: 0 }, 1], wire: [2] },
  avalanche: { solid: [0, 2, 3, 4], cut: [1] },
  sandbags: { solid: [0, 1, 2] },
  'storm-damage': { solid: [{ z: 1 }], wire: [0, 3], cut: [2] },
};
FILL_SPEC['air-quality-alert'] = FILL_SPEC['air-quality'];
FILL_SPEC['wildfire-alert'] = FILL_SPEC.wildfire;
FILL_SPEC['flood-alert'] = FILL_SPEC.flood;
FILL_SPEC['earthquake-alert'] = FILL_SPEC.earthquake;
for (const [name, spec] of Object.entries(FILL_SPEC)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const d = icons[name].d;
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'string' ? i : typeof i === 'number' ? d[i] : shut(d[i.z])));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}

// Named parts: what animates, changes state, or carries a badge
const PARTS = {
  'bin-level': { bin: [0, 1], level: [2, 3] },
  'waste-sorting': { bins: [0, 1, 2, 3, 4, 5], ground: [6] },
  compost: { heap: [0], sprout: [1, 2, 3], steam: [4, 5] },
  landfill: { mound: [0], strata: [1, 2], bag: [3, 4] },
  'garbage-pile': { bags: [0, 1, 2, 3, 4, 5] },
  'toxic-waste': { drum: [0, 1, 2, 3], drop: [4], puddle: [5] },
  'plastic-bag': { bag: [0], handle: [1, 2], crease: [3] },
  'ocean-plastic': { litter: [0, 1, 2], wave: [3, 4] },
  'storm-drain': { grate: [0, 1, 2, 3, 4], drops: [5, 6] },
  'map-pin-recycle': { pin: [0], hole: [1] },
  'calendar-recycle': { calendar: [0, 1, 2, 3] },
  'smartphone-recycle': { phone: [0, 1] },
  'refill-pouch': { pouch: [0, 1], bottle: [2] },
  'zero-waste': { jar: [0, 1], scrap: [2] },
  'leaf-cycle': { arrow: [0, 1], leaf: [2, 3] },
  'water-recycling': { arrow: [0, 1], drop: [2] },
  biodegradable: { leaf: [0, 1], dots: [2, 3, 4] },
  'eco-score': { level: [0, 1, 2], leaf: [3, 4] },
  'bag-leaf': { body: [0], handle: [1] },
  'route-leaf': { path: [0], end: [1] },
  'footprint-carbon': { footprint: [0, 1], smoke: [2] },
  'footprint-water': { footprint: [0, 1], drop: [2] },
  'carbon-credit': { coin: [0, 1], leaf: [2, 3] },
  'carbon-neutral': { fulcrum: [0], beam: [1, 2, 3, 4] },
  'smokestack-arrow-down': { body: [0, 1, 2], smoke: [3] },
  'car-emissions': { body: [0], wheels: [1, 2], windows: [3, 4], smoke: [5, 6] },
  'plane-emissions': { fuselage: [0], wing: [1], smoke: [2] },
  earth: { planet: [0], land: [1, 2] },
  'earth-warming': { planet: [0], land: [1, 2] },
  'earth-heart': { planet: [0], land: [1, 2] },
  'hand-earth': { cuff: [0], hand: [1], planet: [2, 3, 4] },
  'hand-droplet': { cuff: [0], hand: [1], drop: [2] },
  'glacier-melt': { mountains: [0], ice: [1, 2], drop: [3] },
  'sea-level-rise': { shore: [0], wave: [1, 2], arrow: [3, 4], house: [5] },
  'green-city': { tower: [0], building: [1], windows: [2, 3, 4, 5, 6, 7] },
  'air-quality': { level: [0, 1, 2], needle: [3, 4], wind: [5] },
  smog: { city: [0, 1, 2, 3, 4, 5, 6], smog: [7] },
  'light-pollution': { city: [0, 1, 2, 3, 4, 5, 6], rays: [7, 8, 9, 10, 11], star: [12] },
  'water-pollution': { pipe: [0], stream: [1, 2], wave: [3, 4] },
  'oil-spill': { drop: [0], slick: [1], wave: [2] },
  'noise-pollution': { house: [0, 1], noise: [2, 3] },
  deforestation: { tree: [0, 1, 2], stumps: [3, 4], ground: [5] },
  'tree-planting': { ground: [0, 1], sprout: [2, 3, 4], spade: [5, 6, 7] },
  wildfire: { tree: [0, 1, 2], flame: [3, 4] },
  'wildlife-crossing': { bridge: [0], road: [1], tree: [2, 3] },
  'rain-barrel': { barrel: [0, 1], spout: [2], drop: [3] },
  drought: { ground: [0, 1, 2], sun: [3], rays: [4, 5, 6, 7, 8, 9, 10, 11] },
  flood: { house: [0, 1], wave: [2, 3, 4] },
  earthquake: { ground: [0, 1], tremor: [2, 3, 4, 5] },
  landslide: { slope: [0, 1], rocks: [2, 3, 4] },
  tsunami: { wave: [0], house: [1], shore: [2] },
  avalanche: { peak: [0, 1], slabs: [2, 3, 4] },
  sandbags: { bags: [0, 1, 2] },
  'storm-damage': { roof: [0], walls: [1], door: [2], wind: [3] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = { ...icons[name].parts, ...parts };
for (const name of Object.keys(ALERT_TAGS)) icons[name].parts = { ...icons[name.replace(/-alert$/, '')].parts };

// Motion: each icon's own gesture
const MOTION = {
  compost: { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  'toxic-waste': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'storm-drain': { effect: 'bounce', parts: ['drops'], vector: [0, 1.5] },
  'map-pin-recycle': { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] },
  'calendar-recycle': { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] },
  'smartphone-recycle': { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] },
  'leaf-cycle': { effect: 'spin', parts: ['arrow'], origin: [12, 12] },
  'water-recycling': { effect: 'spin', parts: ['arrow'], origin: [12, 12] },
  'footprint-carbon': { effect: 'float', parts: ['smoke'], vector: [0, -1.5] },
  'footprint-water': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'carbon-neutral': { effect: 'wiggle', parts: ['beam'], origin: [12, 14] },
  'smokestack-arrow-down': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
  'car-emissions': { effect: 'float', parts: ['smoke'], vector: [-1, -1.5] },
  'plane-emissions': { effect: 'slide', vector: [1.5, 0] },
  earth: { effect: 'float', vector: [0, -1.5] },
  'earth-heart': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.25] },
  'hand-earth': { effect: 'bounce', parts: ['planet'], vector: [0, -1.5] },
  'hand-droplet': { effect: 'bounce', parts: ['drop'], vector: [0, -1.5] },
  'glacier-melt': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'sea-level-rise': { effect: 'float', parts: ['wave'], vector: [0, -1] },
  'air-quality': { effect: 'wiggle', parts: ['needle'], origin: [12, 13] },
  smog: { effect: 'float', parts: ['smog'], vector: [1.5, 0] },
  'water-pollution': { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  'oil-spill': { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  'noise-pollution': { effect: 'slide', parts: ['noise'], vector: [1.5, 0] },
  'tree-planting': { effect: 'bounce', parts: ['sprout'], vector: [0, -1.5] },
  wildfire: { effect: 'wiggle', parts: ['flame'], origin: [6, 20.85] },
  'rain-barrel': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  drought: { effect: 'spin', parts: ['rays'], origin: [12, 8.25] },
  flood: { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  earthquake: { effect: 'wiggle', origin: [12, 21.25] },
  landslide: { effect: 'slide', parts: ['rocks'], vector: [1, 1] },
  tsunami: { effect: 'float', parts: ['wave'], vector: [1, 0] },
  avalanche: { effect: 'slide', parts: ['slabs'], vector: [1, 1.25] },
  'storm-damage': { effect: 'wiggle', parts: ['roof'], origin: [12, 4] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;
for (const name of Object.keys(ALERT_TAGS)) icons[name].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };
// Something dropping into each bin
for (const name of Object.keys(icons).filter((n) => n.startsWith('bin-') && n !== 'bin-level')) icons[name].motion = { effect: 'bounce', parts: ['item'], vector: [0, 1.5] };

// Mirror: the vehicles that move one way, their emissions trailing behind
for (const name of ['car-emissions', 'plane-emissions']) icons[name].mirror = true;

// Levels: the bin fills from its lower level; the air-quality dial's segments go from good to bad;
// the eco score's bars rise
icons['bin-level'].levels = [[2], [3]];
icons['air-quality'].levels = [[0], [1], [2]];
icons['eco-score'].levels = [[0], [1], [2]];

// Value: the dial's needle sweeps from the left (0) to the right (1)
icons['air-quality'].value = { turn: { parts: ['needle'], origin: [12, 13], from: 190, to: 350, at: 305 } };

// Variants
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// Already round: the planet and the arrows that circle
offV(['earth', 'leaf-cycle', 'water-recycling'], { circle: false });
// With a badge or a piece on top: the filled enclosure doesn't draw it, at 58 % it stops reading and
// the slash would cut through it
offV(
  Object.keys(icons).filter((n) => icons[n].badge),
  { circle: false, square: false, slash: false },
);

export default { category: 'medio-ambiente', label: 'Medio ambiente', icons };
