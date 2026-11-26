// Medio ambiente (environment), round 11: waste sorting, compost and reuse, the carbon and water
// footprints, emissions, pollution of air, water, noise and light, the planet and its climate, the
// forest, saving water, and the natural disasters. Drawn with the engine (engine/geometry.mjs) and
// the rules in DESIGN.md.
// - It adopts lugares's recycle; bin-recycling and the cycles build on its looping arrow.
// - The bin-* share one sorting bin (an open tapered body under an overhanging rim) with the object
//   falling into its mouth, at least 8 wide.
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
import gestos from './gestos.mjs';
import industria from './industria.mjs';
import lugares from './lugares.mjs';
import plantas from './plantas.mjs';
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
/** A stroke that rises in two gentle S-bends from `a`, the rising smoke and steam of the set. */
const plume = ([x, y], h = 6.5, w = 1.25) => `M${pt([x, y])}C${pt([x - w, y - h * 0.2])} ${pt([x + w, y - h * 0.4])} ${pt([x, y - h * 0.6])}C${pt([x - w * 0.8, y - h * 0.75])} ${pt([x + w * 0.4, y - h * 0.9])} ${pt([x, y - h])}`;
/**
 * A gust of wind: a line that ends in a half turn down, its end 2r under the line (a full curl would
 * close on its own line at bold).
 */
const gust = (x0, x1, y, r = 1.5) => `M${pt([x0, y])}H${f(x1)}A${f(r)} ${f(r)} 0 0 1 ${pt([x1, y + 2 * r])}`;

// ── Badges and pieces in the badge's place ────────────────────────────────────────────────────
// Center (17.25, 17.25), circle of r 4.25, as the engine's badges; `knock` is the area the engine
// clears with a clearance of paper. A piece that isn't a status keeps the icon's style.
const BC = [17.25, 17.25];
/** The ring drawn clockwise, for cleared areas (filled nonzero, as logistica's). */
const clockwise = ([cx, cy], r) => `M${pt([cx - r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx + r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx - r, cy])}Z`;
const RING_K = clockwise(BC, 4.25);
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

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
  const west = [polar(12, 12, 9, 197), [6.75, 8.75], [9.5, 9.25], [9, 12.25], [10.25, 13.5], [9.25, 17], polar(12, 12, 9, 113)];
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
  // A crushed can on its side: its lid (an end seen as an ellipse) and the body pinched at the middle
  // (standing, a can under 8 wide read as the jar of bin-glass)
  metal: () => {
    const [l, r, t, b, m] = [6.5, 17.75, 2.75, 9.4, 12.5];
    const [cy, ry] = [(t + b) / 2, (b - t) / 2];
    return [
      ellipse(l, cy, 1.5, ry),
      roundline(
        [
          [l, t],
          [m - 2, t],
          [m, t + 1.5],
          [m + 2, t],
          [r, t],
          [r, b],
          [m + 2, b],
          [m, b - 1.5],
          [m - 2, b],
          [l, b],
        ],
        [0, 0.75, 1, 0.75, 1.25, 1.25, 0.75, 1, 0.75, 0],
      ),
    ];
  },
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
  // Filled: the lid and the body solid, the lid's near edge cut out
  'bin-metal': bin(['metales', 'latas', 'chatarra', 'metal recycling', 'cans'], ITEM.metal(), { solid: [0, shut(ITEM.metal()[1])], cut: ['M6.5 2.75A1.5 3.325 0 0 1 6.5 9.4'] }),
  'bin-electronics': bin(['electrónicos', 'residuos electrónicos', 'cables', 'e-waste', 'electronics recycling'], ITEM.electronics(), { solid: [0], wire: [1, 2, 3] }),
  'bin-batteries': bin(['pilas', 'baterías', 'acopio', 'battery recycling', 'batteries'], ITEM.batteries(), { solid: [0], wire: [1], cut: [2] }),
  'bin-hazardous': bin(['residuos peligrosos', 'pintura', 'químicos', 'hazardous waste', 'chemicals'], ITEM.hazardous(), { solid: [0, 2], wire: [1] }),
  'bin-general': bin(['basura', 'residuos', 'relleno sanitario', 'general waste', 'landfill bin'], ITEM.general(), { solid: [0], wire: [1] }),
};

// ── Sorting, compost and waste sites ──────────────────────────────────────────────────────────
{
  // Compost: a heap with lugares's sprout on its top and two curls of steam
  const heap = 'M2.75 21C3.25 16.5 7 14.25 12 14.25C17 14.25 20.75 16.5 21.25 21Z';
  const sp = L.sprout.d.slice(0, 3).map((d) => place(d, 0.75, [12, 21], [12, 14.25]));
  icons.compost = { tags: ['composta', 'compostaje', 'abono', 'compost', 'composting'], d: [heap, ...sp, plume([3.5, 12], 6.5, 1), plume([20.5, 12], 6.5, 1)] };
}
{
  // Landfill: a round hill of waste on the ground, one buried layer through it, and bin-general's bag
  // dropping onto its top (a flat-topped mound with straight strata read as a layered cake)
  const [rx, ry] = [9.25, 8.75];
  const mound = `M2.75 21.25A${f(rx)} ${f(ry)} 0 0 1 21.25 21.25Z`;
  const at = (y) => rx * Math.sqrt(1 - ((21.25 - y) / ry) ** 2);
  const layer = `M${pt([12 - at(17), 17])}C${pt([8, 15.5])} ${pt([10.5, 18.5])} ${pt([13.5, 17])}S${pt([17.5, 16.25])} ${pt([12 + at(17), 17])}`;
  icons.landfill = {
    tags: ['relleno sanitario', 'vertedero', 'basurero', 'landfill', 'dump site'],
    d: [mound, layer, ...ITEM.general()],
  };
}
{
  // Garbage pile: three of bin-general's bags heaped, the two below leaning out and one on top
  icons['garbage-pile'] = {
    tags: ['basura acumulada', 'tiradero', 'reportar basura', 'garbage pile', 'illegal dumping'],
    d: [...bagAt(0.78, [6.5, 21.25], -10), ...bagAt(0.78, [17.5, 21.25], 10), ...bagAt(0.78, [12, 12.75])],
  };
}
{
  // Toxic waste: a drum on its side (its lid toward us, one hoop round its middle), leaking a drop into
  // a puddle. The hoop keeps 3 from the lid and from the drum's far end, so nothing merges at bold
  const [fx, fy, rx, ry] = [14.75, 8.25, 1.75, 4.5];
  const face = ellipse(fx, fy, rx, ry);
  const body = `M${pt([fx, fy - ry])}H4.5A${f(rx)} ${f(ry)} 0 0 0 ${pt([4.5, fy + ry])}H${f(fx)}`;
  const hoop = `M${pt([8.25, fy - ry])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([8.25, fy + ry])}`;
  icons['toxic-waste'] = {
    tags: ['residuos tóxicos', 'contaminación', 'químicos', 'toxic waste', 'hazardous spill'],
    d: [face, body, hoop, droplet([19, 14.75], 1.25), ellipse(16, 20.5, 5, 1.5)],
  };
}
{
  // Plastic bag: the single-use T-shirt bag, its two loop handles over the body and a crease
  const body = 'M5.25 8.25H9C9 10 10.25 11.25 12 11.25C13.75 11.25 15 10 15 8.25H18.75V21.25H7.25A2 2 0 0 1 5.25 19.25Z';
  const handles = ['M5.25 8.25V5A2 2 0 0 1 9 5V8.25', 'M15 8.25V5A2 2 0 0 1 18.75 5V8.25'];
  icons['plastic-bag'] = { tags: ['bolsa de plástico', 'un solo uso', 'sin bolsas', 'plastic bag', 'single-use'], d: [body, ...handles, line([8.5, 15], [10.25, 17.75])] };
}
{
  // Ocean plastic: a plastic bottle (its body, its neck 3 wide, a cap 3 tall over a line, and a rib)
  // tipped over and half sunk; a narrower neck or a cap stepped out from it closed up at bold.
  // The water passes in front of it as a piece on top (the engine's knockout, as lugares's mountains):
  // everything under the first wave is cleared with a clearance of paper, so nothing is cut by hand
  const C = [11.75, 7.25];
  const T = (pts) => pts.map(([x, y]) => rot([C[0] + x, C[1] + y], C, 60));
  const body = roundpoly(
    T([
      [-2.75, 5],
      [-2.75, -0.5],
      [-1.5, -2.25],
      [-1.5, -6.5],
      [1.5, -6.5],
      [1.5, -2.25],
      [2.75, -0.5],
      [2.75, 5],
    ]),
    [1.25, 1, 0.5, 0.5, 0.5, 0.5, 1, 1.25],
  );
  const cap = line(...T([[-1.5, -3.5], [1.5, -3.5]]));
  const rib = line(...T([[-2.75, 1.25], [2.75, 1.25]]));
  const waves = [12.5, 16.5, 20.5].map((y) => wave(2.75, 21.25, y));
  const sea = `${waves[0]}L21.25 22.25L2.75 22.25Z`;
  icons['ocean-plastic'] = {
    tags: ['plástico en el mar', 'basura marina', 'océanos', 'ocean plastic', 'marine litter'],
    d: [body, cap, rib],
    badge: own(waves, sea),
  };
}
{
  // Storm drain: a grate of bars in the street and the rain falling into it
  icons['storm-drain'] = {
    tags: ['alcantarilla', 'coladera', 'drenaje pluvial', 'storm drain', 'sewer grate'],
    d: [sq(3.25, 13.25, 17.5, 8, 2.25, { square: ['br'] }), ...[7.25, 10.25, 13.25, 16.25].map((x) => line([x + 0.5, 13.25], [x + 0.5, 21.25])), droplet([8.5, 6.25], 2), droplet([15.5, 8.25], 2)],
  };
}

// ── Zero waste ────────────────────────────────────────────────────────────────────────────────
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
const SCORE_LEAF = leafOf([5, 12], [11.5, 5.5]);
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
  // The footprints: lugares's two steps, smaller, toward the upper left, and what they leave at the
  // lower right. One print alone read as two eggs, or upright as an exclamation mark
  const steps = L.footprints.d.map((d) => place(d, 0.8, [4.7, 2.98], [2.75, 2.75]));
  icons['footprint-carbon'] = { tags: ['huella de carbono', 'emisiones', 'CO2', 'carbon footprint', 'emissions'], d: [...steps, cloud(0.42, [15.25, 21])] };
  icons['footprint-water'] = { tags: ['huella hídrica', 'consumo de agua', 'agua', 'water footprint', 'water use'], d: [...steps, droplet([17.5, 17], 3)] };
}
// Carbon credit: a coin turned a little (its face and its edge) with a leaf on the face
const CREDIT_LEAF = leafOf([9.6, 15.05], [13.4, 7.45]);
icons['carbon-credit'] = {
  tags: ['crédito de carbono', 'compensación', 'bonos verdes', 'carbon credit', 'offset'],
  d: [ellipse(10.75, 12, 6.5, 9), 'M10.75 3H13.25A6.5 9 0 0 1 13.25 21H10.75', CREDIT_LEAF.leaf, CREDIT_LEAF.stem],
};
// Carbon neutral: a level beam on its fulcrum, a puff of smoke on one end and a leaf on the other.
// The leaf stands on its stalk, which rises from the beam: its blade keeps 3 above the beam (a blade
// resting 0.75 over it left slivers that came and went with the weight). At this size it has no rib:
// the two halves of its blade closed up at bold
const NEUTRAL_LEAF = (() => {
  const [B, T] = [
    [16.5, 11],
    [20.75, 6.75],
  ];
  const l = leafOf(B, T);
  const foot = [B[0] - 3, B[1] + 3];
  return { leaf: l.leaf, stem: line(foot, B), out: line(foot, B) };
})();
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
  // One plume at the exhaust and one higher, over the car's tail, 4 apart so they never run together
  icons['car-emissions'] = { tags: ['emisiones del auto', 'escape', 'contaminación', 'car emissions', 'exhaust'], d: [...car.d.map(P), plume([4.5, 20], 7, 1), plume([8.25, 11], 6.5, 1)] };
  icons['car-emissions'].fill = { solid: car.fill.solid.map(P), cut: car.fill.cut.map(P), lines: icons['car-emissions'].d.slice(5) };
}
{
  // Plane emissions: aviacion's plane in profile, smaller and climbing, and the puff of exhaust it
  // leaves behind its tail. Its wing is one stroke: the outlined wing closes up at this size
  const plane = aviacion.icons['plane-side'];
  const P = (d) => turnPath(place(d, 0.62, [21.25, 12], [20.75, 9.5]), -14, [15, 9.5]);
  const body = P(plane.d[0]);
  const wing = P(line([13.75, 14.75], [10.75, 18.25]));
  const puff = cloud(0.34, [4.25, 18.25]);
  icons['plane-emissions'] = {
    tags: ['emisiones de vuelo', 'aviación', 'huella de carbono', 'flight emissions', 'aviation'],
    d: [body, wing, puff],
  };
  icons['plane-emissions'].fill = { solid: [body, puff], wire: [wing] };
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
  // Glacier melt: lugares's snowy peak with its meltwater, a drop, in the badge's place: the engine
  // clears the peak under it (two peaks around an ice tongue read as a crown, or a tooth)
  const F = [
    [2.5, 20.5],
    [11, 3.5],
    [19.5, 20.5],
  ];
  const k = (F[1][0] - F[0][0]) / (F[0][1] - F[1][1]);
  const snow = line([F[1][0] - (9.5 - F[1][1]) * k, 9.5], [9.5, 11], [11, 9.5], [12.5, 11], [F[1][0] + (9.5 - F[1][1]) * k, 9.5]);
  const melt = droplet([17.25, 17.5], 3);
  icons['glacier-melt'] = {
    tags: ['deshielo', 'glaciar', 'cambio climático', 'glacier melt', 'melting ice'],
    d: [roundpoly(F, [1, 1.5, 1]), snow],
    badge: own([melt], melt, { solid: [melt] }),
  };
}
{
  // Sea level rise: the coast in section, a house on its top, and the sea at its foot with an arrow up
  // over the water. The land is a closed shape: drawn as one sloping line it read as a chart
  const land = roundpoly(
    [
      [21.25, 13.25],
      [14.25, 13.25],
      [8.75, 21.25],
      [21.25, 21.25],
    ],
    [0, 1, 0, 0],
  );
  const shore = (y) => 14.25 - ((y - 13.25) * 5.5) / 8;
  const house = L.house.d.slice(0, 2).map((d) => place(d, 0.38, [12, 20.75], [17.75, 13.25]));
  icons['sea-level-rise'] = {
    tags: ['aumento del nivel del mar', 'costa', 'cambio climático', 'sea level rise', 'coastal flooding'],
    d: [land, ...house, wave(2.75, shore(16.25), 16.25), wave(2.75, shore(20.25), 20.25), line([6.25, 12], [6.25, 4.25]), line([3.5, 7], [6.25, 4.25], [9, 7])],
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
    d: [...segs, line(c, polar(c[0], c[1], 5.25, -55)), dot(...c), gust(3.75, 15, 17.75)],
  };
}
{
  // The skyline smog and light pollution share: three buildings on one base, their windows. The middle
  // tower stands 3 under the haze and the rays
  const SKY = [
    roundpoly(
      [
        [3.25, 21.25],
        [3.25, 14.5],
        [9.25, 14.5],
        [9.25, 11.5],
        [14.75, 11.5],
        [14.75, 15.25],
        [20.75, 15.25],
        [20.75, 21.25],
      ],
      [0, 1.25, 0, 1.25, 1.25, 0, 1.25, 0],
    ),
    ...[
      [6.25, 17.75],
      [12, 14.75],
      [12, 18],
      [17.75, 18.25],
    ].map((p) => dot(...p, 0.3)),
  ];
  // Smog: two lines of haze over the skyline (a closed band pinched shut at bold and read as a cloud)
  icons.smog = { tags: ['smog', 'contaminación del aire', 'ciudad', 'smog', 'air pollution'], d: [...SKY, wave(3.25, 20.75, 3.75), wave(3.25, 20.75, 7.5)] };
  // Light pollution: a dome of rays over the skyline and one faint star, a dot
  const rays = [-140, -115, -90, -65, -40].map((a) => line(polar(12, 18, 10.25, a), polar(12, 18, 12.5, a)));
  icons['light-pollution'] = { tags: ['contaminación lumínica', 'cielo nocturno', 'luz', 'light pollution', 'night sky'], d: [...SKY, ...rays, dot(20.25, 3.5)] };
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
    for (let i = 0; i <= 6; i++) pts.push(polar(-3.5, 15.25, r + (i % 2 ? 0.75 : -0.75), -27.5 + (55 * i) / 6));
    return line(...pts);
  };
  icons['noise-pollution'] = { tags: ['contaminación acústica', 'ruido', 'molestia', 'noise pollution', 'noise'], d: [...house, front(7.25), front(11.25)] };
}
{
  // Deforestation: one pine still standing beside a felled one, plantas's tree-stump (two stumps under
  // 5 wide read as the feet of a table)
  const stump = plantas.icons['tree-stump'].d.slice(0, 2).map((d) => place(d, 0.46, [12, 20.75], [7.25, 21.25]));
  const P = (d) => place(d, 0.64, [12, 21.25], [17.41, 21.25]);
  const tree = L['tree-pine'];
  icons.deforestation = {
    tags: ['deforestación', 'tala', 'pérdida de bosque', 'deforestation', 'logging'],
    d: [...stump, ...tree.d.slice(0, 2).map(P)],
  };
  icons.deforestation.fill = {
    solid: [stump[0], shut(stump[1]), P(tree.d[0])],
    cut: [place(`M4.75 7.75A7.25 4.25 0 0 0 19.25 7.75`, 0.46, [12, 20.75], [7.25, 21.25]), P(tree.fill.cut[0])],
    wire: [P(tree.fill.wire[0])],
  };
}
{
  // Tree planting: lugares's sprout in a mound, a spade stuck in the ground beside it. At 0.75 the
  // sprout's leaves keep their hole at bold (at 0.62 they closed up)
  const sp = L.sprout.d.slice(0, 3).map((d) => place(d, 0.75, [12, 21], [8.25, 18.25]));
  icons['tree-planting'] = {
    tags: ['reforestación', 'plantar árboles', 'siembra', 'tree planting', 'reforestation'],
    d: ['M2.75 21.25H21.25', 'M3.75 21.25C4.5 19 6.25 18.25 8.25 18.25C10.25 18.25 12 19 12.75 21.25', ...sp, 'M16.25 21.25V17A1.5 1.5 0 0 1 17.75 15.5H18.75A1.5 1.5 0 0 1 20.25 17V21.25', line([18.25, 15.5], [18.25, 4]), line([16.25, 4], [20.25, 4])],
  };
}
{
  // Wildfire: a tall pine (lugares's) and the fire at its foot, the set's fire (vehiculos's car-fire);
  // lugares's round flame read as a drop beside a tree. With an alert badge the pine's crown stands
  // whole above the clearance, its trunk stopping well inside the crown, and the fire keeps clear of it
  const T = (d) => place(d, 0.78, [12, 21.25], [16.95, 21.25]);
  const fire = place(vehiculos.icons['car-fire'].badge.d[0], 1, [18.025, 11.875], [5.875, 21.25]);
  icons.wildfire = {
    tags: ['incendio forestal', 'fuego', 'bosque', 'wildfire', 'forest fire'],
    d: [T(L['tree-pine'].d[0]), T('M12 21.25V12.5'), fire],
  };
  icons.wildfire.fill = { solid: [T(L['tree-pine'].d[0]), fire], wire: [T('M12 21.25V17.75')], cut: [T('M12 16.25V12.5')] };
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
  // Drought: a blazing sun over a slab of cracked ground. The rays stand 3 off the disc (at 1.75 they
  // ran into it at bold) and only above and beside it, so the ground can be a slab and not a plank
  const [c, r] = [[12, 9.25], 2.25];
  const sun = [circ(...c, r), ...[180, 225, 270, 315, 0].map((a) => line(polar(...c, 5.25, a), polar(...c, 7.5, a)))];
  icons.drought = {
    tags: ['sequía', 'escasez de agua', 'calor', 'drought', 'water scarcity'],
    d: [sq(2.75, 14.5, 18.5, 6.75, 2), line([8, 14.5], [9.25, 16.75], [7.75, 18.75], [8.5, 21.25]), line([15.75, 14.5], [14.75, 16.5], [16.25, 18.5], [15.5, 21.25]), ...sun],
  };
}
{
  // Flood: a house's roof and the tops of its walls above three lines of water. The water stops 1.25
  // short of the right edge, so flood-alert's badge clears the lines' ends whole (at full width their
  // tips peeked out of the clearance at bold)
  icons.flood = {
    tags: ['inundación', 'crecida', 'desastre', 'flood', 'flooding'],
    d: ['M3.75 8.5L11.15 2.97A1.25 1.25 0 0 1 12.85 2.97L20.25 8.5', 'M6.5 6.75V9.5M17.5 6.75V9.5', wave(3.25, 20.75, 13.5), wave(3.25, 20.75, 17.25), wave(3.25, 20.75, 21)],
  };
}
{
  // Earthquake: the ground split by a fissure, the tremor's arcs on both sides. The fissure's foot and
  // the arcs' ends stand clear of an alert badge's clearance, so earthquake-alert keeps them whole
  const cx = 10.75;
  const arcs = [
    [5, 155, 205],
    [8, 164, 196],
  ].flatMap(([r, a0, a1]) => [arc(cx, 7.5, r, a0, a1).d, arc(cx, 7.5, r, -(a1 - 180), -(a0 - 180)).d]);
  icons.earthquake = {
    tags: ['sismo', 'terremoto', 'temblor', 'earthquake', 'seismic'],
    d: ['M2.75 14.5H9L10.5 16.75L9.5 18.5L10.5 21.25', 'M21.25 14.5H12.5L13.25 16.75L12 18.75L10.5 21.25', ...arcs],
  };
}
{
  // Landslide: a slope with three rocks tumbling down to its foot, each 2.85 clear of the slope
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
    d: ['M2.75 5.75C7.75 6.5 9.75 15 14.5 21.25H2.75Z', 'M14.5 21.25H21.25', rock([11.25, 6], 1, 15), rock([15, 12.75], 1.05, -20), rock([19.25, 19.5], 1, 10)],
  };
}
{
  // Tsunami: a towering wave curling over a small house on the shore. The wave leaves the ground
  // steeply: rising at a shallow angle it left a sliver against the shore that closed at bold
  icons.tsunami = {
    tags: ['tsunami', 'maremoto', 'ola gigante', 'tsunami', 'tidal wave'],
    d: [
      'M2.75 21.25C4.5 17.5 6 3.5 13 3.5A5.5 5.5 0 0 1 18.5 9A2.75 2.75 0 0 1 13 9C11 11 10.25 15.5 10.5 21.25',
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
  // Avalanche: a snowy peak with two slabs of snow sliding off down its right side, square to the
  // slope, 3 off it and 3 apart (three slabs ran together)
  const [top, lf, rt] = [
    [9, 4.25],
    [2.75, 20.5],
    [21.25, 20.5],
  ];
  const peak = roundpoly([lf, top, rt], [0.5, 1.25, 0.5]);
  const v = unit(sub(rt, top));
  const n = [v[1], -v[0]];
  const tilt = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  const slab = (t, deg) => {
    const c = add(add(top, mul(v, t)), mul(n, 4.5));
    return roundpoly(
      [
        [-1.5, -1.5],
        [1.5, -1.5],
        [1.5, 1.5],
        [-1.5, 1.5],
      ].map(([x, y]) => rot([c[0] + x, c[1] + y], c, tilt + deg)),
      0.6,
    );
  };
  icons.avalanche = { tags: ['avalancha', 'alud', 'nieve', 'avalanche', 'snow slide'], d: [peak, 'M6.6 10.25L8.25 11.5L9.75 10L11.25 11.5L12.85 10.25', slab(4, -4), slab(10, 4)] };
}
{
  // Storm damage: lugares's house with its roof peeling up in the wind. The peeled roof lifts 3 clear
  // of the wall it left, and the gust ends in a half turn
  icons['storm-damage'] = {
    tags: ['daños por tormenta', 'viento', 'siniestro', 'storm damage', 'wind damage'],
    d: ['M2.75 11.25L11.2 4.17A1.25 1.25 0 0 1 12.8 4.17L14.6 5.68C16.5 7 18.75 6 20.5 3', L.house.d[1], L.house.d[2], gust(2.75, 6, 2.5, 1.1)],
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
  compost: { solid: [0, 2, 3], wire: [1], lines: [4, 5] },
  landfill: { solid: [0, 2], cut: [1], wire: [3] },
  'garbage-pile': { solid: [0, 2, 4], wire: [1, 3, 5] },
  // The drum's lid stays a face: its near edge is cut out of the solid drum
  'toxic-waste': { solid: [0, { z: 1 }, 3, 4], cut: [2, 'M14.75 3.75A1.75 4.5 0 0 0 14.75 12.75'] },
  'plastic-bag': { solid: [0], wire: [1, 2], cut: [3] },
  'ocean-plastic': { solid: [0], cut: [1, 2] },
  'storm-drain': { solid: [0, 5, 6], cut: [1, 2, 3, 4] },
  'zero-waste': { solid: [{ z: 0 }, 1], cut: [2] },
  'leaf-cycle': { solid: [2], wire: [0, 1, CYCLE_LEAF.out], cut: [CYCLE_LEAF.rib] },
  'water-recycling': { solid: [2], wire: [0, 1] },
  'eco-score': { solid: [0, 1, 2, 3], wire: [SCORE_LEAF.out], cut: [SCORE_LEAF.rib] },
  'bag-leaf': { solid: [0], lines: [1] },
  'route-leaf': { solid: [1], wire: [0] },
  'footprint-carbon': { solid: [0, 1, 2, 3, 4] },
  'footprint-water': { solid: [0, 1, 2, 3, 4] },
  'carbon-credit': { solid: [0, { z: 1 }], cut: [2, 3] },
  'carbon-neutral': { solid: [0, 2, 3], wire: [1, 4] },
  'smokestack-arrow-down': { solid: [{ z: 0 }, 3], cut: [1, 2] },
  earth: { solid: [0], cut: [1, 2] },
  'earth-warming': { solid: [0], cut: [1, 2] },
  'earth-heart': { solid: [0], cut: [1, 2] },
  'hand-earth': { solid: [0, { z: 1 }, 2], cut: [3, 4] },
  'hand-droplet': { solid: [0, { z: 1 }, 2] },
  'glacier-melt': { solid: [0], cut: [1] },
  'sea-level-rise': { solid: [0, { z: 1 }, { z: 2 }], wire: [3, 4], lines: [5, 6] },
  'green-city': { solid: [0, { z: 1 }], cut: [2, 3, 4, 5, 6, 7] },
  'air-quality': false,
  smog: { solid: [0], cut: [1, 2, 3, 4], lines: [5, 6] },
  'light-pollution': { solid: [0, 10], cut: [1, 2, 3, 4], lines: [5, 6, 7, 8, 9] },
  'water-pollution': { solid: [{ z: 0 }, 'M9.25 4C13 4 15.25 7.5 15.25 12.5H12.25C12.25 9.5 11 7.5 9.25 7.5Z'], wire: [3, 4] },
  'oil-spill': { solid: [0], wire: [1, 2] },
  'noise-pollution': { solid: [{ z: 0 }, { z: 1 }], lines: [2, 3] },
  'tree-planting': { solid: [{ z: 1 }, 3, 4, { z: 5 }], wire: [0, 2, 6, 7] },
  'wildlife-crossing': { solid: [0, 2], wire: [1, 3] },
  'rain-barrel': { solid: [0, 2, 3], cut: [1] },
  drought: { solid: [0, 3], cut: [1, 2], lines: [4, 5, 6, 7, 8] },
  flood: { solid: [{ z: 0 }], wire: [1, 2, 3, 4] },
  earthquake: false,
  landslide: { solid: [0, 2, 3, 4], wire: [1] },
  tsunami: { solid: [{ z: 0 }, 1], wire: [2] },
  avalanche: { solid: [0, 2, 3], cut: [1] },
  'storm-damage': { solid: [{ z: 1 }], wire: [0, 3], cut: [2] },
};
FILL_SPEC['air-quality-alert'] = FILL_SPEC['air-quality'];
FILL_SPEC['flood-alert'] = FILL_SPEC.flood;
FILL_SPEC['earthquake-alert'] = FILL_SPEC.earthquake;
// The wildfire's fill is drawn with it; its alert takes the same
icons['wildfire-alert'].fill = icons.wildfire.fill;
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
  compost: { heap: [0], sprout: [1, 2, 3], steam: [4, 5] },
  landfill: { mound: [0], strata: [1], bag: [2, 3] },
  'garbage-pile': { bags: [0, 1, 2, 3, 4, 5] },
  'toxic-waste': { drum: [0, 1, 2], drop: [3], puddle: [4] },
  'plastic-bag': { bag: [0], handle: [1, 2], crease: [3] },
  'ocean-plastic': { bottle: [0], cap: [1], rib: [2] },
  'storm-drain': { grate: [0, 1, 2, 3, 4], drops: [5, 6] },
  'zero-waste': { jar: [0, 1], scrap: [2] },
  'leaf-cycle': { arrow: [0, 1], leaf: [2, 3] },
  'water-recycling': { arrow: [0, 1], drop: [2] },
  'eco-score': { level: [0, 1, 2], leaf: [3, 4] },
  'bag-leaf': { body: [0], handle: [1] },
  'route-leaf': { path: [0], end: [1] },
  'footprint-carbon': { footprints: [0, 1, 2, 3], smoke: [4] },
  'footprint-water': { footprints: [0, 1, 2, 3], drop: [4] },
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
  'glacier-melt': { mountain: [0], snow: [1] },
  'sea-level-rise': { shore: [0], house: [1, 2], wave: [3, 4], arrow: [5, 6] },
  'green-city': { tower: [0], building: [1], windows: [2, 3, 4, 5, 6, 7] },
  'air-quality': { level: [0, 1, 2], needle: [3, 4], wind: [5] },
  smog: { city: [0, 1, 2, 3, 4], smog: [5, 6] },
  'light-pollution': { city: [0, 1, 2, 3, 4], rays: [5, 6, 7, 8, 9], star: [10] },
  'water-pollution': { pipe: [0], stream: [1, 2], wave: [3, 4] },
  'oil-spill': { drop: [0], slick: [1], wave: [2] },
  'noise-pollution': { house: [0, 1], noise: [2, 3] },
  deforestation: { stump: [0, 1], tree: [2, 3] },
  'tree-planting': { ground: [0, 1], sprout: [2, 3, 4], spade: [5, 6, 7] },
  wildfire: { tree: [0, 1], flame: [2] },
  'wildlife-crossing': { bridge: [0], road: [1], tree: [2, 3] },
  'rain-barrel': { barrel: [0, 1], spout: [2], drop: [3] },
  drought: { ground: [0, 1, 2], sun: [3], rays: [4, 5, 6, 7, 8] },
  flood: { house: [0, 1], wave: [2, 3, 4] },
  earthquake: { ground: [0, 1], tremor: [2, 3, 4, 5] },
  landslide: { slope: [0, 1], rocks: [2, 3, 4] },
  tsunami: { wave: [0], house: [1], shore: [2] },
  avalanche: { peak: [0, 1], slabs: [2, 3] },
  'storm-damage': { roof: [0], walls: [1], door: [2], wind: [3] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = { ...icons[name].parts, ...parts };
for (const name of Object.keys(ALERT_TAGS)) icons[name].parts = { ...icons[name.replace(/-alert$/, '')].parts };

// Motion: each icon's own gesture
const MOTION = {
  compost: { effect: 'float', parts: ['steam'], vector: [0, -1.5] },
  'toxic-waste': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'storm-drain': { effect: 'bounce', parts: ['drops'], vector: [0, 1.5] },
  'ocean-plastic': { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
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
  'glacier-melt': { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] },
  'sea-level-rise': { effect: 'float', parts: ['wave'], vector: [0, -1] },
  'air-quality': { effect: 'wiggle', parts: ['needle'], origin: [12, 13] },
  smog: { effect: 'float', parts: ['smog'], vector: [1.5, 0] },
  'water-pollution': { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  'oil-spill': { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  'noise-pollution': { effect: 'slide', parts: ['noise'], vector: [1.5, 0] },
  'tree-planting': { effect: 'bounce', parts: ['sprout'], vector: [0, -1.5] },
  wildfire: { effect: 'wiggle', parts: ['flame'], origin: [5.875, 21.25] },
  'rain-barrel': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  drought: { effect: 'beat', parts: ['sun', 'rays'], origin: [12, 9.25] },
  flood: { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  earthquake: { effect: 'wiggle', origin: [10.5, 21.25] },
  landslide: { effect: 'slide', parts: ['rocks'], vector: [1, 1] },
  tsunami: { effect: 'float', parts: ['wave'], vector: [1, 0] },
  avalanche: { effect: 'slide', parts: ['slabs'], vector: [1, 1.25] },
  'storm-damage': { effect: 'wiggle', parts: ['roof'], origin: [12, 4] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;
for (const name of Object.keys(ALERT_TAGS)) icons[name].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };
// Something dropping into each bin
for (const name of Object.keys(icons).filter((n) => n.startsWith('bin-'))) icons[name].motion = { effect: 'bounce', parts: ['item'], vector: [0, 1.5] };

// Mirror: the vehicles that move one way, their emissions trailing behind
for (const name of ['car-emissions', 'plane-emissions']) icons[name].mirror = true;

// Levels: the air-quality dial's segments go from good to bad; the eco score's bars rise
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
