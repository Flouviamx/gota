// Logistics and the supply chain: handling equipment, racks, containers, packing, labels,
// shipments by state, freight modes, routes, fleets and inventory. Everything is computed with the
// engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on containers. The parcel, the truck, the warehouse and
// the inventory shelf are comercio's own drawings, read from its icons, so both families are one;
// the container is datos's (redrawn at each size, with its ribs), the folded map, the umbrella and
// the thermometer are lugares's, the calendar is the core one. Badges are the engine's (`badge`); a
// piece cut out of the lower right (a snowflake, a leaf, a truck) is a custom badge in the same
// place, and the engine clears the base around it.
import { arc, badge, circ, dot, flipPath, head, line, polar, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import comercio from './comercio.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** Moves `d` from a toward b. */
const toward = (a, b, d) => add(a, mul(unit(sub(b, a)), d));
const SQ = { square: ['br'] };

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
 * Closes every open subpath, for `fill.solid` (only closed shapes go there). The closing segment
 * runs along an edge that is already solid or knocked out, so the silhouette doesn't change.
 */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/**
 * A container from `sq` (its bottom-right corner square) left open along its bottom between x0 and
 * x1, where something comes out of it (the label printer's label, as dispositivos's printer).
 */
function openBottom(d, x0, x1) {
  const m = /^M([^c]+)(c.*?)L([^L]+)L([^c]+)(c.*?)L([^c]+)(c.*?)Z$/.exec(d);
  const yb = m[3].trim().split(/\s+/)[1];
  return `M${N(x0)} ${yb}L${m[4]}${m[5]}L${m[6]}${m[7]}L${m[1]}${m[2]}L${m[3]}L${N(x1)} ${yb}`;
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

/** An open box standing on a line: its sides come down to `base` (the shelf, the deck). */
const crate = (x0, x1, top, base, r = 1.25) =>
  roundline(
    [
      [x0, base],
      [x0, top],
      [x1, top],
      [x1, base],
    ],
    [0, r, r, 0],
  );

/** A closed box seen from the front (the boxes, the sizes, the supply chain). */
const front = (x, y, w, h, r = 1.5) => sq(x, y, w, h, r);

// ── Comercio's isometric box, the same parcel ─────────────────────────────────────────────────
// Core isometric box (`box`): same proportions, 28.4° slope (as comercio's `iso`).
function iso(cx, top, w, h, k = 0.541) {
  const wk = w * k;
  return { T: [cx, top], R: [cx + w, top + wk], C: [cx, top + 2 * wk], L: [cx - w, top + wk], Rb: [cx + w, top + wk + h], B: [cx, top + 2 * wk + h], Lb: [cx - w, top + wk + h] };
}
/** Small isometric box: outline and inner edges (comercio's `cube`, the box inside the house). */
function cube(cx, top, w, h, r) {
  const P = iso(cx, top, w, h);
  return [roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], r), line(toward(P.L, P.C, 0.3), P.C, toward(P.R, P.C, 0.3)), line(P.C, toward(P.B, P.C, 0.3))];
}
/** The package without its tape (comercio's `parcel` with `tape: false`), anywhere. */
function box3(cx, top, w, h) {
  const P = iso(cx, top, w, h);
  return [roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], 1.6), line(toward(P.L, P.C, 0.4), P.C, toward(P.R, P.C, 0.4)), line(P.C, toward(P.B, P.C, 0.4))];
}

// ── Shared pieces from the other categories ───────────────────────────────────────────────────
const C = comercio.icons;
/** Comercio's small package, shifted left, that carries a badge. */
const PARCEL_B = C['parcel-check'].d;
const TRUCK = C.truck;
/** The edge between the truck's box and its cab, knocked out in the fill (comercio's). */
const SEAM = 'M14.5 7.5V14';
const WAREHOUSE = C.warehouse;
const INVENTORY = C.inventory;

// ── Custom pieces in the badge's place ────────────────────────────────────────────────────────
// Center (17.25, 17.25), circle of r 4.25, as the engine's badges; `knock` is the area the engine
// clears with a clearance of paper. A piece that isn't a status keeps the icon's style.
const BC = [17.25, 17.25];
const RING = circ(...BC, 4.25);
/**
 * The same ring drawn clockwise, for the areas the engine clears: they are filled nonzero, so a
 * counterclockwise ring under a clockwise piece (a box, a body, a polygon) cancels out where they
 * overlap and leaves a hole in the cleared area that lets the base show through (a parcel's edge
 * across a camera's lens).
 */
const clockwise = ([cx, cy], r) => `M${pt([cx - r, cy])}A${N(r)} ${N(r)} 0 1 1 ${pt([cx + r, cy])}A${N(r)} ${N(r)} 0 1 1 ${pt([cx - r, cy])}Z`;
const RING_K = clockwise(BC, 4.25);
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/** The pin of lugares: the logomark's drop turned 45°, its square corner pointing at the ground. */
function pin([cx, cy], r) {
  const a = polar(cx, cy, r, 45);
  const b = polar(cx, cy, r, 135);
  return `M${pt(a)}A${N(r)} ${N(r)} 0 1 0 ${pt(b)}L${pt([cx, cy + r * Math.SQRT2])}Z`;
}
/** A pallet's deck on its two feet, standing on `base`: 3 tall, so the gap under it stays open. */
const deck = (x0, x1, y, base) =>
  roundline(
    [
      [x0 + 0.75, base],
      [x0 + 0.75, y],
      [x1 - 0.75, y],
      [x1 - 0.75, base],
    ],
    [0, 0.6, 0.6, 0],
  );

// The shipping label: the card's landscape at 14.5 tall, so the address and the barcode below it
// keep their clearances.
const LABEL = sq(2.5, 4.75, 19, 14.5, 3.75, SQ);

// Dispositivos's drone (body, arms, rotor posts and rotors) without its legs, 3.5 higher.
const DRONE = dispositivos.icons.drone.d.slice(0, 7).map((d) => transform(d, 1, 0, -3.5));

// Two of comercio's trucks at 0.7: the front one at the bottom left, whole, and the one behind it
// 5.75 to the right and 6 up, its box and cab only (its wheels would sit behind the front one's
// cab and come out as stubs). The front one is a piece on top: the engine clears the one behind
// around it, so what is left of it is its roof and its whole cab, standing clear of the front
// one's cab. (At 0.78 and 4.25 over, the back cab rose out of the front one's and the pair read as
// a heap.)
const FLEET = (() => {
  const k = 0.7;
  const [tx, ty] = [2.5 - 2.5 * k, 21 - 20.5 * k];
  const [dx, dy] = [5.75, -6];
  const at = (x, y) => TRUCK.d.map((d) => transform(d, k, x, y));
  // The front wheels drop 0.75 so they stay 3 below the body, as on the full-size truck (scaled,
  // they came 2.1 under it and merged with it at bold)
  const front = at(tx, ty).map((d, i) => (i > 1 ? transform(d, 1, 0, 0.75) : d));
  const back = at(tx + dx, ty + dy).slice(0, 2);
  const solid = [front[0], shut(front[1]), front[2], front[3]];
  return { front, back, solid, knock: solid.join(''), seam: transform(SEAM, k, tx, ty), backSeam: transform(SEAM, k, tx + dx, ty + dy) };
})();

// The courier's backpack seen from behind: a soft cube (the signature at its bottom right), the
// grab handle on top and the two shoulder straps, straight down its back and curving out to its
// lower corners, where they are sewn on: the left one on the middle of the round corner (the 45°
// point of its continuous curve, 4.7, 19.8), the right one on the edge beside the square corner.
// (Straps that broke into a diagonal halfway down drew a tent on the bag.)
const BAG = (() => {
  const body = sq(3.75, 5.25, 16.5, 15.5, 3.25, SQ);
  const handle = roundline(
    [
      [10.25, 5.25],
      [10.25, 2.75],
      [13.75, 2.75],
      [13.75, 5.25],
    ],
    [0, 1, 1, 0],
  );
  const strap = (x, s, end) => `M${pt([x, 5.25])}V12.5C${pt([x, 16])} ${pt([x + s, 18.25])} ${pt(end)}`;
  return [body, handle, strap(8.25, -1, [4.7, 19.8]), strap(15.75, 1, [20.25, 19.8])];
})();

/**
 * A kettlebell, the set's weight: a round body on a flat base (`c`, `r`, the base at `base`) and the
 * handle rising from its shoulders, `hb` either side of the axis there and `ht` at its top, `top`,
 * with corners of `tr`. (A trapezoid with a ring on top, the drawing first approved, read as a
 * handbag at 18 px; the handle splays out to the shoulders so the bell doesn't read as a padlock.)
 */
function kettlebell([cx, cy], r, base, hb, ht, top, tr) {
  const hw = Math.sqrt(r * r - (base - cy) ** 2);
  const body = `M${pt([cx - hw, base])}A${N(r)} ${N(r)} 0 1 1 ${pt([cx + hw, base])}Z`;
  const ys = cy - Math.sqrt(r * r - hb * hb);
  const handle = roundline(
    [
      [cx - hb, ys],
      [cx - ht, top],
      [cx + ht, top],
      [cx + hb, ys],
    ],
    [0, tr, tr, 0],
  );
  return [body, handle];
}

/** A piece in the badge's place: drawn whole, its cleared area the badge's ring plus itself. */
const piece = (d, fill, extra = d) => own(d, `${RING_K}${extra.join('')}`, fill);
const PIECE = {
  // Six arms with the branches opening outward near their tips (lugares's snowflake, small)
  snowflake: () => {
    const arms = [90, 30, 150].map((a) => line(polar(...BC, 3.75, a), polar(...BC, 3.75, a + 180)));
    const tips = [-90, -30, 30, 90, 150, 210].map((a) => head(polar(...BC, 3, a), [-Math.cos((a * Math.PI) / 180), -Math.sin((a * Math.PI) / 180)], 1.5, 45));
    return own([...arms, ...tips], RING);
  },
  // Lugares's leaf: a lens at 45° and its stalk, hanging from the upper right
  leaf: () => {
    const [A, B] = [
      [14.25, 20.25],
      [20.25, 14.25],
    ];
    const lens = `M${pt(A)}A5.12 5.12 0 0 1 ${pt(B)}A5.12 5.12 0 0 1 ${pt(A)}Z`;
    const stalk = line(B, [21.5, 13]);
    return own([lens, stalk], `${RING}${stalk}`, { solid: [lens], wire: [stalk] });
  },
  // The core shield at 0.45
  shield: () => {
    const d = transform(nucleo.icons.shield.d[0], 0.45, BC[0] - 12 * 0.45, 21.4 - 21.33 * 0.45);
    return piece([d], { solid: [d] });
  },
  // A coin: a status disc with the dollar sign cut out (the stem stops short of the edge)
  coin: () => {
    const [c1, c2, r] = [[17.25, 16.1], [17.25, 18.6], 1.25];
    const S = `M${pt(polar(...c1, r, -30))}A${r} ${r} 0 1 0 ${pt([17.25, 17.35])}A${r} ${r} 0 1 1 ${pt(polar(...c2, r, 150))}`;
    const stem = line([17.25, 14], [17.25, 20.5]);
    return own([RING, S, stem], RING, { solid: [RING], cut: [S, stem] });
  },
  // The core globe at the size of the ring
  globe: () => {
    const k = 4.25 / 9;
    const d = nucleo.icons.globe.d.map((p) => transform(p, k, BC[0] - 12 * k, BC[1] - 12 * k));
    return piece(d, { solid: [d[0]], cut: d.slice(1) }, []);
  },
  // A camera (dispositivos's, small): the body with the signature corner, the hump on top and the
  // lens ring, clearing the badges' ring too so no sliver of the parcel's corner is left beside it.
  // (Cut out of a status disc, body and lens clogged into a sign that read as a target.)
  camera: () => {
    const body = sq(12.75, 15, 9, 6.25, 1.75, SQ);
    const hump = 'M15.25 15L15.85 13.75A0.9 0.9 0 0 1 16.65 13.25H17.85A0.9 0.9 0 0 1 18.65 13.75L19.25 15';
    const lens = circ(17.25, 18.1, 1.4);
    return own([body, hump, lens], `${body}${hump}Z${RING_K}`, { solid: [body, `${hump}Z`], cut: [lens] });
  },
  // The weight, small: a kettlebell whose body is the status disc, solid in every style, and its
  // handle over it, splayed as `weight`'s (drawn in lines at this size, the bell read as a padlock).
  // It stands in front of the parcel: the cleared area runs from its handle to the right edge, so no
  // splinter of the parcel's corner is left beside the handle
  weight: () => {
    const handle = kettlebell(BC, 4.25, 21.5, 3.2, 2.5, 10.25, 1.5)[1];
    return own([RING, handle], `${RING_K}M14.05 14.46L14.75 9.75H22.75V17.25Z`, { solid: [RING], wire: [handle] });
  },
  // A small truck: its box with the signature corner, the cab, and its wheels as dots under them
  truck: () => {
    const box = sq(12.75, 13.25, 5.5, 4.75, 1.25, SQ);
    const cab = roundline(
      [
        [18.25, 15],
        [19.6, 15],
        [21.5, 16.6],
        [21.5, 18],
        [18.25, 18],
      ],
      [0, 0.6, 0.6, 0, 0],
    );
    const wheels = [dot(15, 19.25), dot(19.75, 19.25)];
    return piece([box, cab, ...wheels], { solid: [box, shut(cab), ...wheels] }, [box, shut(cab)]);
  },
  // A small parcel (comercio's cube)
  parcel: () => {
    const d = cube(17.25, 13.25, 4, 3.5, 0.9);
    return piece(d, { solid: [d[0]], cut: d.slice(1) }, [d[0]]);
  },
};

// Water: a run of half waves 3 wide and 1 high, from x 3 to 21 (lugares's waves, flatter).
const wave = (y, x0 = 3, x1 = 21, a = 1.33) => {
  let d = `M${pt([x0, y])}`;
  for (let x = x0, i = 0; x < x1 - 0.01; x += 3, i++) d += `C${pt([x + 1, y + (i % 2 ? a : -a)])} ${pt([x + 2, y + (i % 2 ? a : -a)])} ${pt([x + 3, y])}`;
  return d;
};

// The rack of picking and putaway: two shelves standing out from a post, open on the right (the
// box on the move hangs a little past their end), and the boxes on them taped (the seam down from the middle of the top), so they read as boxes and
// not as the bars of a chart.
const RACK = [line([3.25, 2.75], [3.25, 21.25]), line([3.25, 10.5], [14, 10.5]), line([3.25, 19], [14, 19])];
const taped = (x0, x1, top, base) => [crate(x0, x1, top, base, 1.1), line([(x0 + x1) / 2, top], [(x0 + x1) / 2, top + 2])];

// Archivos's clipboard (the board and its clip).
const CLIP = archivos.icons.clipboard;

/** Lugares's thermometer: a 5.8 tube on a bulb of r 4.5, the mercury down to the bulb's center. */
const thermo = (x = 12, top = 8.75) => {
  const [w, R, yb] = [2.9, 4.5, 16.75];
  const yi = yb - Math.sqrt(R * R - w * w);
  return [`M${N(x - w)} ${N(yi)}V${N(2.75 + w)}A${N(w)} ${N(w)} 0 0 1 ${N(x + w)} ${N(2.75 + w)}V${N(yi)}A${N(R)} ${N(R)} 0 1 1 ${N(x - w)} ${N(yi)}Z`, line([x, top], [x, yb])];
};

// The dock door's shutter, for the fill: the frame down to its bottom slat.
const SHUTTER = `${roundline(
  [
    [3.25, 12.25],
    [3.25, 3.25],
    [20.75, 3.25],
    [20.75, 12.25],
  ],
  [0, 2.25, 2.25, 0],
)}Z`;
// The moped's seat, for the fill: the body under the box, down to the rear wheel's clearance.
const COWL = roundpoly(
  [
    [2.75, 9.25],
    [11.75, 9.25],
    [11.75, 12.75],
    [2.75, 12.75],
  ],
  [0, 0, 1, 0],
);

/**
 * Archivos's chain link, level: two U-shaped halves 3 apart and the bar between them, 3 from their
 * arms (the core link's measurements, shortened).
 */
function chain(c, w = 3) {
  const half = (s) => `M${pt([c[0] + 1.5 * s, c[1] + w * s])}L${pt([c[0] + 3 * s, c[1] + w * s])}A${w} ${w} 0 0 ${s > 0 ? 0 : 0} ${pt([c[0] + 3 * s, c[1] - w * s])}L${pt([c[0] + 1.5 * s, c[1] - w * s])}`;
  return [half(-1), half(1), line([c[0] - 3, c[1]], [c[0] + 3, c[1]])];
}

// The calendar of calendar-truck: the core one without the days the truck covers.
const CAL_TRUCK = nucleo.icons.calendar.d.filter((d, i) => i < 4 || [0, 3].includes(i - 4));

// A small plane in a single line (at this size an outline closed up at bold): fuselage, swept
// wings and tail, pointing up and to the right over the parcel.
const PLANE = (() => {
  const T = (pts) => line(...pts.map(([x, y]) => add([17.25, 6.5], [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2])));
  return [
    T([
      [0, -4],
      [0, 4.25],
    ]),
    T([
      [-3.75, 1.5],
      [0, -0.75],
      [3.75, 1.5],
    ]),
    T([
      [-1.75, 4.25],
      [0, 3.25],
      [1.75, 4.25],
    ]),
  ];
})();

// Comercio's warehouse at 0.75, standing on the same ground, moved to `x` (in/outbound).
const WH = (x) => WAREHOUSE.d.map((d) => transform(d, 0.75, x, 20.75 - 20.75 * 0.75));

// The keep-dry umbrella: lugares's canopy at 0.75 with two scallops, so its points stay clear of
// the handle, which starts where they meet.
const UMBRELLA = 'M5.25 14.63A6.75 6.75 0 0 1 18.75 14.63A3.375 3.375 0 0 0 12 14.63A3.375 3.375 0 0 0 5.25 14.63Z';

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {
  // ── Handling equipment ──
  // Side view, facing forward: the counterweight body under the cage roof, the mast and its fork
  // at the front, linked to the body; the wheels hang below the body, as on the truck, 3.3 apart
  // (at 2.5 they all but touched at bold).
  'forklift': {
    tags: ['montacargas', 'carretilla elevadora', 'almacén', 'forklift', 'lift truck'],
    d: [
      sq(2.75, 9.5, 11.5, 4, 1.5),
      roundline(
        [
          [4.75, 9.5],
          [4.75, 3.25],
          [10.75, 3.25],
          [13.25, 9.5],
        ],
        [0, 1.25, 1.25, 0],
      ),
      line([14.25, 11.5], [17.25, 11.5]),
      roundline(
        [
          [17.25, 2.75],
          [17.25, 21],
          [21.5, 21],
        ],
        [0, 0.75, 0],
      ),
      circ(5.5, 19, 1.85),
      circ(12.5, 19, 1.85),
    ],
  },
  // The pump on its wheel, the fork running forward along the floor and the tiller rising back to
  // its loop
  'pallet-jack': {
    tags: ['patín hidráulico', 'transpaleta', 'mover tarimas', 'pallet jack', 'pallet truck'],
    d: [
      roundline(
        [
          [21.25, 17.5],
          [4.75, 17.5],
          [4.75, 13],
          [10, 13],
          [10, 17.5],
        ],
        [0, 1, 1.25, 1.25, 0],
      ),
      line([6.5, 13], [4.9, 6.85]),
      circ(4.35, 4.75, 2.15),
      circ(7.5, 19.25, 1.75),
    ],
  },
  // An L frame with its grip curling back on top, the wheel at its heel and two boxes on its toe
  'hand-truck': {
    tags: ['diablito', 'carretilla de mano', 'mensajería', 'hand truck', 'dolly'],
    d: [
      roundline(
        [
          [4.75, 3.25],
          [8, 3.25],
          [8, 20.75],
          [20, 20.75],
        ],
        [0, 1.75, 0.75, 0],
      ),
      circ(5.5, 18.25, 2.5),
      crate(11, 19.5, 14.25, 20.75),
      crate(12.25, 18.25, 8.25, 14.25),
    ],
  },
  // A flat deck on two casters, the push handle rising at its back, one box on the deck
  'platform-trolley': {
    tags: ['carrito de plataforma', 'plataforma', 'mover cajas', 'platform trolley', 'flatbed cart'],
    d: [
      roundline(
        [
          [2.75, 3.75],
          [5, 3.75],
          [5, 16.75],
          [21.25, 16.75],
        ],
        [0, 1.25, 1, 0],
      ),
      crate(9, 17.75, 9.25, 16.75, 1.4),
      circ(8.5, 18.5, 1.75),
      circ(18, 18.5, 1.75),
    ],
  },
  // The wire container: a tall frame, its bars and a cross bar, on two casters
  'roll-cage': {
    tags: ['jaula rodante', 'roll container', 'clasificación', 'roll cage', 'cage trolley'],
    d: [
      sq(5.5, 2.75, 13, 15.5, 2),
      line([9.83, 2.75], [9.83, 18.25]),
      line([14.17, 2.75], [14.17, 18.25]),
      line([5.5, 10.5], [18.5, 10.5]),
      circ(8.5, 19.75, 1.5),
      circ(15.5, 19.75, 1.5),
    ],
  },
  // Two shelves with a straight-sided tote standing on each, the handle post rising at the back,
  // two casters (totes that flared toward their rims made a shopping cart's basket)
  'pick-cart': {
    tags: ['carrito de surtido', 'picking', 'surtir pedidos', 'pick cart', 'order picking'],
    d: [
      roundline(
        [
          [2.75, 3.25],
          [5.25, 3.25],
          [5.25, 17.5],
          [19.75, 17.5],
          [19.75, 10.25],
          [5.25, 10.25],
        ],
        [0, 1.25, 0, 0.75, 0.75, 0],
      ),
      crate(8.25, 16.75, 6, 10.25, 1),
      crate(8.25, 16.75, 13.25, 17.5, 1),
      circ(8.5, 19.5, 1.5),
      circ(17, 19.5, 1.5),
    ],
  },
  // A belt on three rollers and two taped boxes riding on its top run, one ahead of the other (on
  // a stand of two legs, with two rollers, it read as a sofa)
  'conveyor-belt': {
    tags: ['banda transportadora', 'transportador', 'línea de clasificación', 'conveyor belt', 'sortation'],
    d: [capsule(2.75, 12.5, 18.5, 7), ...[6.25, 12, 17.75].map((x) => dot(x, 16)), ...taped(4.75, 10.75, 5.5, 12.5), ...taped(13.25, 19.25, 7, 12.5)],
  },

  // The gantry on its two legs, the boom reaching out over the water, held by its stay, and a
  // container on its cable
  'port-crane': {
    tags: ['grúa portuaria', 'puerto', 'terminal', 'port crane', 'ship to shore'],
    d: [
      line([4.5, 21.25], [4.5, 7.25]),
      line([10.5, 21.25], [10.5, 7.25]),
      line([4.5, 14.25], [10.5, 14.25]),
      line([2.75, 7.25], [21.25, 7.25]),
      roundline(
        [
          [4.5, 7.25],
          [7.5, 2.75],
          [10.5, 7.25],
        ],
        [0, 0, 0],
      ),
      line([7.5, 2.75], [19.5, 7.25]),
      line([17, 7.25], [17, 11.5]),
      sq(14, 11.5, 6, 4.5, 1.25, SQ),
    ],
  },

  // ── Containers and racks ──
  // Three of datos's containers: two side by side and one on top, each with its two ribs
  'container-stack': {
    tags: ['contenedores apilados', 'patio de contenedores', 'carga marítima', 'container stack', 'container yard'],
    d: [
      ...[
        [2.5, 14.75],
        [13.5, 14.75],
        [8, 5.5],
      ].flatMap(([x, y]) => [sq(x, y, 8, 6.25, 1.6, SQ), line([x + 8 / 3, y], [x + 8 / 3, y + 6.25]), line([x + 16 / 3, y], [x + 16 / 3, y + 6.25])]),
    ],
  },
  // Datos's container with a map pin standing on its upper right, cut out of it
  'container-location': {
    tags: ['rastreo de contenedor', 'ubicación', 'visibilidad', 'container tracking', 'container location'],
    d: [sq(2.5, 8, 17.5, 12, 3.5, SQ), ...[6.75, 11.25, 15.75].map((x) => line([x, 11.5], [x, 16.5]))],
    badge: (() => {
      const p = pin([17.75, 6], 3.5);
      return own([p, dot(17.75, 6)], p, { solid: [p], cut: [dot(17.75, 6)] });
    })(),
  },
  // High-bay racking: two uprights and the beam between them, a pallet on the beam and another on
  // the floor (each load on a deck with two feet)
  'pallet-rack': {
    tags: ['rack de tarimas', 'estantería industrial', 'almacenaje', 'pallet rack', 'racking'],
    d: [
      line([3.25, 4], [3.25, 21.25]),
      line([20.75, 4], [20.75, 21.25]),
      line([3.25, 12.25], [20.75, 12.25]),
      deck(6.75, 17.25, 9.25, 12.25),
      crate(7.75, 16.25, 6, 9.25, 1),
      deck(6.75, 17.25, 18.25, 21.25),
      crate(7.75, 16.25, 15.25, 18.25, 1),
    ],
  },
  // The face of a rack: two rows by three columns of locations, one of them taken
  'bin-location': {
    tags: ['ubicación', 'posición', 'slot', 'bin location', 'storage location', 'slotting'],
    d: [sq(2.5, 5, 19, 14, 3.75, SQ), line([2.5, 12], [21.5, 12]), line([8.83, 5], [8.83, 19]), line([15.17, 5], [15.17, 19]), dot(12, 8.5)],
  },
  // A stackable tote from the front: wider at its rim, the rim's edge and the hand hole under it
  // (the hopper front, seen square on, read as an archive box with its lid)
  'storage-bin': {
    tags: ['contenedor', 'gaveta', 'caja de picking', 'storage bin', 'tote', 'picking bin'],
    d: [
      roundpoly(
        [
          [3.25, 5.5],
          [20.75, 5.5],
          [19, 20.75],
          [5, 20.75],
        ],
        [1.25, 1.25, 0, 2.25],
      ),
      line([3.65, 9], [20.35, 9]),
      capsule(9, 12, 6, 2.75),
    ],
  },
  // Three boxes from the front in a pyramid, the seam of the tape at the top of each
  'boxes': {
    tags: ['cajas', 'bultos', 'no apilar', 'boxes', 'packages', 'stack'],
    d: [
      ...[
        [2.5, 14],
        [13.5, 14],
        [8, 4],
      ].flatMap(([x, y]) => [front(x, y, 8, 7), line([x + 4, y], [x + 4, y + 2.5])]),
    ],
  },
  // Wooden crate: the frame of planks and the diagonal brace (a middle slat as well made it too
  // dense)
  'crate': {
    tags: ['caja de madera', 'huacal', 'embalaje de exportación', 'crate', 'wooden crate'],
    d: [sq(4.25, 4.25, 15.5, 15.5, 2.25), sq(7.25, 7.25, 9.5, 9.5, 0.75), line([7.25, 16.75], [16.75, 7.25])],
  },
  // Side view: the raised platform with a box on it and the trailer backed against it, its floor
  // level with the platform; both stand on the ground line
  'loading-dock': {
    tags: ['andén de carga', 'muelle', 'recepción de camiones', 'loading dock', 'dock'],
    d: [
      sq(10.25, 4.5, 11, 8, 2, { square: ['bl', 'br'] }),
      roundline(
        [
          [2.75, 12.5],
          [10.25, 12.5],
          [10.25, 20.75],
        ],
        [0, 0, 0],
      ),
      line([2.75, 20.75], [21.25, 20.75]),
      crate(3.75, 7.25, 8.5, 12.5, 1),
      circ(14.75, 19.25, 1.5),
      circ(19.75, 19.25, 1.5),
    ],
  },
  // The dock door: its frame, the sectional shutter rolled half up (a seam and its bottom edge)
  // and a taped box passing under it (the bumpers under the frame read as the wheels of a bus)
  'dock-door': {
    tags: ['puerta de andén', 'cortina', 'asignar puerta', 'dock door', 'roll-up door'],
    d: [
      roundline(
        [
          [3.25, 20.75],
          [3.25, 3.25],
          [20.75, 3.25],
          [20.75, 20.75],
        ],
        [0, 2.25, 2.25, 0],
      ),
      line([3.25, 7.75], [20.75, 7.75]),
      line([3.25, 12.25], [20.75, 12.25]),
      sq(8.5, 16.25, 7, 4.5, 1.25),
      line([12, 16.25], [12, 18.25]),
    ],
  },

  // ── Packing ──
  // Held like a pistol: the roll on top, the grip slanting back under it, and the frame running
  // forward to the toothed nose, where the tape comes down from the roll
  'tape-gun': {
    tags: ['despachador de cinta', 'cinta canela', 'empacar', 'tape gun', 'tape dispenser'],
    d: [
      circ(13, 8, 5.25),
      circ(13, 8, 1.75),
      roundline(
        [
          [16, 16.25],
          [4.25, 16.25],
          [3, 15.25],
          [4.25, 14.25],
          [3, 13.25],
          [4.25, 12.25],
        ],
        [0, 0.4, 0.3, 0.3, 0.3, 0],
      ),
      line([13, 13.25], [13, 16.25]),
      roundpoly(
        [
          [15.25, 16.25],
          [19.25, 16.25],
          [21, 21.25],
          [17, 21.25],
        ],
        [0.6, 0.6, 1.4, 1.4],
      ),
      line(polar(13, 8, 5.25, 180 + 35), [4.25, 12.25]),
    ],
  },
  // The poly mailer: a soft envelope standing up, its sealed flap a shallow point across its top
  // (a flat flap with a seal line read as a jar with its lid)
  'poly-mailer': {
    tags: ['bolsa de envío', 'sobre de plástico', 'empaque flexible', 'poly mailer', 'mailer bag'],
    d: [
      sq(4.75, 2.75, 14.5, 18.5, 3, SQ),
      roundline(
        [
          [4.75, 5.75],
          [12, 9.75],
          [19.25, 5.75],
        ],
        [0, 1.5, 0],
      ),
    ],
  },
  // ── Labels and scanning ──
  // The label (the card's landscape, with the signature corner), the address and the barcode
  'shipping-label': {
    tags: ['guía de envío', 'etiqueta', 'imprimir guía', 'shipping label', 'label'],
    d: [LABEL, line([7.5, 8], [13.5, 8]), ...[7.5, 10.5, 13.5, 16.5].map((x) => line([x, 11], [x, 16.25]))],
  },
  // The same label with a U-turn in place of the barcode
  'return-label': {
    tags: ['guía de devolución', 'devolución prepagada', 'portal de devoluciones', 'return label', 'prepaid return'],
    d: [LABEL, line([7.5, 8], [13.5, 8]), `M7.5 12.75H14.75A1.75 1.75 0 0 1 14.75 16.25H11.25`, head([7.5, 12.75], [-1, 0], 2.4)],
  },
  // A desktop label printer, as dispositivos's printer: the body and its lid's seam, open at the
  // bottom where the label comes out, and the label below it, long, with its address line and a
  // short barcode. (A domed lid over a label of tall bars read as a shop's awning, and a box over
  // tall bars as a trash can or a temple: the bars have to be short.)
  'label-printer': {
    tags: ['impresora de etiquetas', 'impresora térmica', 'estación de empaque', 'label printer', 'thermal printer'],
    d: [
      openBottom(sq(2.75, 3.25, 18.5, 7.5, 2, SQ), 6, 18),
      line([2.75, 7.25], [21.25, 7.25]),
      roundline(
        [
          [6, 7.25],
          [6, 21.25],
          [18, 21.25],
          [18, 7.25],
        ],
        [0, 3, 0, 0],
      ),
      line([9, 13.25], [14.25, 13.25]),
      ...[9, 12, 15].map((x) => line([x, 16.25], [x, 18.25])),
    ],
  },
  // The scanner gun with its head pointing left and the two beams leaving its window
  'handheld-scanner': {
    tags: ['lector de mano', 'escáner de código', 'pistola lectora', 'handheld scanner', 'barcode gun'],
    d: [
      roundpoly(
        [
          [6.25, 4.5],
          [20, 4.5],
          [20, 10],
          [16.75, 10],
          [18.25, 20.75],
          [14, 20.75],
          [12.25, 10],
          [6.25, 10],
        ],
        [1.5, 2, 1.5, 0.5, 1.25, 1.25, 0.5, 1.5],
      ),
      line([6.25, 5.75], [2.75, 4.5]),
      line([6.25, 8.75], [2.75, 10]),
    ],
  },
  // The tag with its hole and the two loops of its antenna
  'rfid-tag': {
    tags: ['etiqueta rfid', 'rfid', 'rastreo de activos', 'rfid tag', 'nfc tag'],
    d: [
      sq(2.5, 5, 19, 14, 3.5, SQ),
      dot(5.75, 12),
      roundline(
        [
          [9.25, 16],
          [9.25, 8],
          [18.5, 8],
          [18.5, 16],
          [12.25, 16],
          [12.25, 11],
          [15.5, 11],
          [15.5, 13],
        ],
        [0, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0],
      ),
    ],
  },
  // A kettlebell: its round body on a flat base and the handle rising from its shoulders, the hole
  // under the handle wide open (a trapezoid with a ring on top read as a handbag, wide or narrow)
  'weight': {
    tags: ['peso', 'kilos', 'límite de peso', 'weight', 'mass'],
    d: kettlebell([12, 14.25], 7.25, 20.75, 5.5, 4.5, 2.75, 3),
  },

  // ── Robots and the last mile ──
  // A low robot with its two sensors, carrying a two-shelf pod on its back
  'warehouse-robot': {
    tags: ['robot de almacén', 'amr', 'robótica', 'warehouse robot', 'goods to person'],
    d: [
      sq(3.25, 13.75, 17.5, 7, 2.5),
      roundline(
        [
          [6.25, 13.75],
          [6.25, 3.25],
          [17.75, 3.25],
          [17.75, 13.75],
        ],
        [0, 1.25, 1.25, 0],
      ),
      line([6.25, 8.5], [17.75, 8.5]),
      dot(8.5, 17.25),
      dot(15.5, 17.25),
    ],
  },
  // The sidewalk robot: a box on three wheels, its lid and the flag on its back
  'delivery-robot': {
    tags: ['robot repartidor', 'entrega autónoma', 'última milla', 'delivery robot', 'autonomous delivery'],
    d: [
      sq(3.75, 7, 16.5, 10.25, 3, SQ),
      line([3.75, 10.25], [20.25, 10.25]),
      roundline(
        [
          [6.75, 7],
          [6.75, 2.75],
          [9.75, 4],
        ],
        [0, 0.4, 0],
      ),
      circ(6, 18.75, 1.5),
      circ(12, 18.75, 1.5),
      circ(18, 18.75, 1.5),
    ],
  },
  // Dispositivos's drone, its landing legs swapped for a parcel hanging on a short line
  'drone-delivery': {
    tags: ['entrega con dron', 'dron', 'envío aéreo', 'drone delivery', 'aerial delivery'],
    d: [...DRONE, line([12, 11.25], [12, 13.75]), ...cube(12, 13.75, 3.75, 3.5, 0.9)],
  },
  // Side view of a moped: lugares's scooter (wheels, deck, stem and bar) with the seat over the
  // rear wheel and the delivery box on its rack
  'delivery-moped': {
    tags: ['moto de reparto', 'repartidor', 'comida a domicilio', 'delivery moped', 'courier scooter'],
    d: [
      crate(2.75, 9.75, 3.25, 9.25, 1.5),
      roundline(
        [
          [11.75, 18.25],
          [11.75, 12.75],
          [2.75, 12.75],
          [2.75, 9.25],
          [12.25, 9.25],
        ],
        [0, 1, 1, 0, 0],
      ),
      line([8, 18.25], [16, 18.25]),
      line([16.25, 6.75], toward([18.5, 18.25], [16.25, 6.75], 2.5)),
      line([14.25, 6.75], [17.75, 6.75]),
      circ(5.5, 18.25, 2.5),
      circ(18.5, 18.25, 2.5),
    ],
  },
  // The long-john cargo bike: lugares's bicycle frame, saddle and handlebar, with the long tube
  // running forward under the box to the small front wheel
  'cargo-bike': {
    tags: ['bicicleta de carga', 'última milla urbana', 'reparto verde', 'cargo bike', 'cargo bicycle'],
    d: [
      sq(12.5, 10.25, 7.5, 4.25, 1.25, SQ),
      roundpoly(
        [
          [5, 17],
          [9.5, 17],
          [10.75, 11],
          [7.25, 11],
        ],
        [0.4, 0.6, 0, 0],
      ),
      line([9.5, 17], [19.25, 18.25]),
      line([7.25, 11], [6, 7.75]),
      line([4.25, 7.75], [7, 7.75]),
      roundline(
        [
          [10.75, 11],
          [10, 7],
          [12.5, 7],
        ],
        [0, 0.6, 0],
      ),
      circ(5, 17, 3),
      circ(19.25, 18.25, 2.25),
    ],
  },
  // The courier's insulated backpack from behind: the boxy bag, its grab handle and the two
  // shoulder straps (a cube in three quarters with a zip read as a cake)
  'delivery-bag': {
    tags: ['mochila de repartidor', 'bolsa térmica', 'kit de repartidor', 'delivery bag', 'courier backpack'],
    d: BAG,
  },
  // The locker bank: two columns of doors, each with a bar handle by the edge where it opens (a
  // dot in the middle of each door read as the four of a die; with three rows there is no room
  // for the handles)
  'parcel-locker': {
    tags: ['casillero de paquetes', 'locker', 'recoger con código', 'parcel locker', 'pickup locker'],
    d: [
      sq(5.5, 3.25, 13, 17.5, 3, SQ),
      line([12, 3.25], [12, 20.75]),
      line([5.5, 12], [18.5, 12]),
      ...[
        [6.25, 9],
        [15, 17.75],
      ].flatMap(([a, b]) => [line([9, a], [9, b]), line([15, a], [15, b])]),
    ],
  },
  // A car from the side with a parcel floating over its trunk; the wheels sit over the body and
  // the engine clears it around them
  'curbside-pickup': {
    tags: ['recoger en auto', 'pickup en tienda', 'drive', 'curbside pickup', 'drive-up'],
    d: [
      sq(2.5, 12.5, 19, 4.75, 2),
      roundline(
        [
          [9.5, 12.5],
          [11.5, 8.75],
          [15.75, 8.75],
          [18.25, 12.5],
        ],
        [0, 1, 1, 0],
      ),
      ...cube(5.5, 3, 2.75, 2.5, 0.75),
    ],
    badge: (() => {
      const w = [circ(8, 17.5, 2.25), circ(16, 17.5, 2.25)];
      return own(w, w.join(''), { solid: w });
    })(),
  },
  // A parcel at the upper left and the recipient's signature on its line
  'proof-of-delivery': {
    tags: ['prueba de entrega', 'firma de recibido', 'confirmación de entrega', 'proof of delivery', 'signature'],
    d: [
      ...cube(8, 2.75, 4.5, 4.25, 1.1),
      `M4.25 17.25C5.5 15 7 14.25 7.75 15.5C8.4 16.6 7.75 18 8.75 17.75C10 17.4 10.5 14.75 12 15C13.25 15.2 12.5 17.25 13.75 17.25C15 17.25 15.5 15.25 17 15.5C18 15.67 18.5 16.75 19.75 16.25`,
      line([3.25, 20.75], [20.75, 20.75]),
    ],
  },
  // Comercio's open hand (the donation's), holding a parcel over its palm
  'parcel-handover': {
    tags: ['entrega en mano', 'entregar paquete', 'manejar con cuidado', 'hand delivery', 'handover'],
    d: [...cube(13.75, 3.25, 3.75, 3.5, 0.9), C.donation.d[1], C.donation.d[2]],
  },

  // ── Trucks and fleet ──
  // Two of comercio's trucks: the front one whole, the one behind it up and to the right, its roof
  // and cab showing over the front one (offset up and to the left, its box's lower corner came out
  // as a stray hook)
  'fleet': {
    tags: ['flotilla', 'flota', 'transportistas', 'fleet', 'fleet management', 'carriers'],
    d: FLEET.back,
    badge: own(FLEET.front, FLEET.knock, { solid: FLEET.solid, cut: [FLEET.seam] }),
  },
  // The truck with a map pin standing over its cargo box, cut out of it
  'truck-location': {
    tags: ['rastreo de vehículo', 'gps', 'ubicación del conductor', 'vehicle tracking', 'live tracking'],
    d: TRUCK.d,
    badge: (() => {
      const p = pin([8.5, 6.25], 3.5);
      return own([p, dot(8.5, 6.25)], p, { solid: [p], cut: [dot(8.5, 6.25)] });
    })(),
  },
  'truck-capacity': {
    tags: ['capacidad del camión', 'carga completa', 'carga parcial', 'load factor', 'truck capacity', 'ftl'],
    // The truck with three bars in its box, 3 apart and 3 from its walls: they light up as levels
    d: [...TRUCK.d, ...[5.5, 8.5, 11.5].map((x) => line([x, 7], [x, 11]))],
  },
  // The truck at 0.75 with the back of its box open, a parcel on its floor and the arrow pointing
  // in through the opening
  'truck-loading': {
    tags: ['carga y descarga', 'cargar camión', 'recolección', 'truck loading', 'loading'],
    d: (() => {
      const k = 0.75;
      const [tx, ty] = [21.5 - 21.5 * k, 20.75 - 20.5 * k];
      const T = (d) => transform(d, k, tx, ty);
      const [x0, y0, x1, y1] = [2.5 * k + tx, 4 * k + ty, 14.5 * k + tx, 14 * k + ty];
      const box = roundline(
        [
          [x0, y1],
          [x1, y1],
          [x1, y0],
          [x0, y0],
        ],
        [0, 0, 1.9, 0],
      );
      return [box, ...TRUCK.d.slice(1).map(T), ...cube(x0 + 4.75, y1 - 4.93, 2.25, 2.5, 0.7), line([2.5, 12.13], [5.75, 12.13]), head([5.75, 12.13], [1, 0], 2.4)];
    })(),
  },
  // The truck at 0.75 facing left, and the arrow turning back over its box
  'truck-return': {
    tags: ['viaje de regreso', 'logística inversa', 'retorno', 'return trip', 'backhaul'],
    d: (() => {
      const k = 0.75;
      const t = TRUCK.d.map((d) => transform(flipPath(d), k, 12 - 12 * k, 20.75 - 20.5 * k));
      const a = arc(15, 5.5, 3, 0, -180);
      return [...t, a.d, head(a.end, a.tangent, 2.4)];
    })(),
  },
  'truck-alert': { tags: ['incidencia', 'retraso', 'avería', 'truck delay', 'vehicle alert'], d: TRUCK.d, badge: badge('alert') },
  // The core calendar with a small truck cut out of its lower right
  'calendar-truck': {
    tags: ['fecha de entrega', 'cita de andén', 'entrega programada', 'delivery date', 'dock appointment'],
    d: CAL_TRUCK,
    badge: PIECE.truck(),
  },

  // ── Freight modes ──
  // A container afloat over two waves
  'freight-sea': {
    tags: ['flete marítimo', 'carga marítima', 'envío por barco', 'ocean freight', 'sea freight'],
    d: [sq(3.25, 2.75, 17.5, 8.5, 3, SQ), ...[7.63, 12, 16.38].map((x) => line([x, 5.75], [x, 8.25])), wave(15.25), wave(19.5)],
  },
  // A parcel with a small plane flying over its upper right
  'freight-air': {
    tags: ['carga aérea', 'flete aéreo', 'envío por avión', 'air freight', 'air cargo'],
    d: box3(10.5, 6.5, 7.5, 6.5),
    badge: own(PLANE, PLANE.join('')),
  },
  // A container on a flatcar: the deck, two bogies of two wheels each, the rail
  'freight-rail': {
    tags: ['flete ferroviario', 'tren de carga', 'intermodal', 'rail freight', 'freight train'],
    d: [
      sq(3.5, 5.75, 17, 9, 3, SQ),
      ...[9.17, 14.83].map((x) => line([x, 8.75], [x, 11.75])),
      line([2.75, 14.75], [21.25, 14.75]),
      ...[5.5, 8.5, 15.5, 18.5].map((x) => circ(x, 19.25, 1.5)),
      line([2.75, 20.75], [21.25, 20.75]),
    ],
  },
  // A container on a trailer chassis: its two rear wheels and the kingpin at the front, no cab
  'freight-road': {
    tags: ['autotransporte', 'flete terrestre', 'carga por carretera', 'road freight', 'trucking'],
    d: [
      sq(3.5, 5.25, 17, 9.5, 3, SQ),
      ...[7.75, 12, 16.25].map((x) => line([x, 8.25], [x, 11.75])),
      line([2.75, 14.75], [21.25, 14.75]),
      circ(5.5, 19.25, 1.5),
      circ(8.5, 19.25, 1.5),
      line([18.25, 14.75], [18.25, 17.25]),
    ],
  },

  // ── Routes ──
  // Lugares's folded map with a route across its panels, from a dot to the pin
  'map-route': {
    tags: ['plan de ruta', 'mapa de reparto', 'despacho', 'route map', 'dispatch map'],
    d: [...lugares.icons.map.d, dot(6, 15.5), `M6 15.5C8.5 15.5 9 12.5 11.5 12.5S15.75 11 17.75 9.25`],
    badge: (() => {
      const p = pin([17.75, 5.5], 2.75);
      return own([p], p, { solid: [p] });
    })(),
  },
  // The direct route between two stops, and the detour it replaces as a dotted path behind it
  'route-optimize': {
    tags: ['optimizar ruta', 'ruta más corta', 'secuencia de paradas', 'route optimization', 'shortest route'],
    d: [
      circ(4.75, 19.25, 2),
      circ(19.25, 4.75, 2),
      `M${pt(polar(4.75, 19.25, 2, -60))}C7 12 12 7 ${pt(polar(19.25, 4.75, 2, 150))}`,
      ...[
        [9.75, 19.25],
        [14.5, 19.25],
        [19.25, 19.25],
        [19.25, 14.5],
        [19.25, 9.75],
      ].map(([x, y]) => dot(x, y)),
    ],
  },
  // A delivery run: out of the depot and snaking back and forth, row by row, through its stops
  // to the last one (a zigzag up through the stops read as a line chart); the route breaks at
  // each stop, touching it
  'route-stops': {
    tags: ['ruta con paradas', 'reparto', 'secuencia de entregas', 'multi-stop route', 'delivery run'],
    d: [
      sq(2.75, 16.25, 5, 5, 1.25),
      circ(13, 18.75, 1.75),
      circ(11, 11.75, 1.75),
      circ(19.25, 4.75, 1.75),
      line([7.75, 18.75], [11.25, 18.75]),
      `M14.75 18.75H17.25${arc(17.25, 15.25, 3.5, 90, -90).d.replace(/^M[^A]*/, '')}H12.75`,
      `M9.25 11.75H6.75${arc(6.75, 8.25, 3.5, 90, 270).d.replace(/^M[^A]*/, '')}H17.5`,
    ],
  },
  // Two boxes and the chain link that joins them (archivos's link, level), over the gap between them
  'supply-chain': {
    tags: ['cadena de suministro', 'abastecimiento', 'red de suministro', 'supply chain', 'sourcing'],
    d: [front(2.75, 13.25, 7.5, 7.5), line([6.5, 13.25], [6.5, 15.25]), front(13.75, 13.25, 7.5, 7.5), line([17.5, 13.25], [17.5, 15.25]), ...chain([12, 7.25])],
  },
  // A building in plan, open at both sides, and the goods passing straight through it
  'cross-dock': {
    tags: ['cross docking', 'transbordo', 'flujo directo', 'cross-dock', 'flow-through'],
    d: [
      roundline(
        [
          [7, 5.25],
          [7, 3.25],
          [17, 3.25],
          [17, 5.25],
        ],
        [0, 1.25, 1.25, 0],
      ),
      roundline(
        [
          [7, 18.75],
          [7, 20.75],
          [17, 20.75],
          [17, 18.75],
        ],
        [0, 1.25, 1.25, 0],
      ),
      line([2.75, 8.75], [21.25, 8.75]),
      head([21.25, 8.75], [1, 0], 2.5),
      line([2.75, 15.25], [21.25, 15.25]),
      head([21.25, 15.25], [1, 0], 2.5),
    ],
  },

  // ── Warehouse ──
  // Comercio's warehouse at 0.75 and the arrow coming to it from the left
  'warehouse-inbound': {
    tags: ['recepción', 'entrada de mercancía', 'recibo', 'inbound', 'receiving', 'goods receipt'],
    d: [...WH(5.38), line([2.5, 17.25], [8.75, 17.25]), head([8.75, 17.25], [1, 0], 2.4)],
  },
  // The same warehouse and the arrow leaving it to the right
  'warehouse-outbound': {
    tags: ['despacho', 'salida de mercancía', 'envío', 'outbound', 'shipping out', 'dispatch'],
    d: [...WH(0.63), line([15.25, 17.25], [21.5, 17.25]), head([21.5, 17.25], [1, 0], 2.4)],
  },
  'warehouse-snowflake': {
    tags: ['almacén frío', 'cámara de congelación', 'refrigerado', 'cold storage', 'freezer warehouse'],
    d: WAREHOUSE.d,
    badge: PIECE.snowflake(),
  },
  'warehouse-plus': { tags: ['agregar almacén', 'nueva ubicación', 'centro de distribución', 'add warehouse', 'new location'], d: WAREHOUSE.d, badge: badge('plus') },
  // A two-shelf rack standing out from its post, a box on the lower shelf and another leaving the
  // upper one at its open end, on an arrow
  'picking': {
    tags: ['surtido', 'picking', 'tomar del estante', 'order picking', 'pick'],
    d: [...RACK, ...taped(6.25, 11.75, 13.5, 19), ...taped(9, 15, 5, 10.5), line([15, 7.75], [21.25, 7.75]), head([21.25, 7.75], [1, 0], 2.4)],
  },
  // The same rack, a box on the upper shelf and another pushed into the lower one by an arrow
  'putaway': {
    tags: ['acomodo', 'ubicar mercancía', 'guardar en ubicación', 'putaway', 'store'],
    d: [...RACK, ...taped(6.25, 11.75, 5, 10.5), ...taped(9, 15, 13.5, 19), line([21.25, 15.25], [15, 15.25]), head([15, 15.25], [-1, 0], 2.4)],
  },

  // ── Parcels by state ──
  // Comercio's open parcel (without its flaps, which left no room for the arrow) and an arrow
  // coming down into its opening
  'parcel-pack': {
    tags: ['empacar', 'preparar pedido', 'embalar', 'pack', 'packing'],
    d: [...C['parcel-open'].d.slice(0, 3), line([12, 2], [12, 7.65]), head([12, 7.65], [0, 1], 2.4)],
  },
  // A parcel at the top and its flow splitting into three arrows
  'parcel-sort': {
    tags: ['clasificación', 'separar envío', 'enrutar paquetes', 'sortation', 'sort'],
    d: (() => {
      const P = iso(12, 2.75, 4.75, 4);
      const fork = [12, 14];
      const ends = [
        [3.75, 19],
        [12, 21.25],
        [20.25, 19],
      ];
      return [...box3(12, 2.75, 4.75, 4), line(P.B, fork), ...ends.flatMap((e) => [line(fork, e), head(e, sub(e, fork), 2.75)])];
    })(),
  },
  // Three arrows converging on a parcel: one from above and one from each side
  'parcel-merge': {
    tags: ['consolidación', 'unir pedidos', 'un solo envío', 'consolidation', 'merge'],
    d: (() => {
      const P = iso(12, 12.5, 5, 3.25);
      const out = unit(sub(P.T, P.L));
      const tip = add(add(P.L, mul(sub(P.T, P.L), 1 / 3)), mul([out[1], -out[0]], 3));
      const left = [line(sub(tip, [4.6, 4.6]), tip), head(tip, [1, 1], 2.4)];
      const right = left.map((d) => flipPath(d));
      return [...box3(12, 12.5, 5, 3.25), line([12, 2.75], [12, 9.5]), head([12, 9.5], [0, 1], 2.4), ...left, ...right];
    })(),
  },
  // A parcel on its way, three speed lines trailing behind it
  'parcel-transit': {
    tags: ['en tránsito', 'en camino', 'enviado', 'in transit', 'on the way'],
    d: [...box3(15, 3.5, 6.5, 7.5), line([2.5, 9], [5.5, 9]), line([3.5, 12], [5.5, 12]), line([2.5, 15], [5.5, 15])],
  },
  // A parcel with its right corner crushed in and a crack running down its side
  'parcel-damaged': {
    tags: ['paquete dañado', 'reclamo', 'mercancía rota', 'damaged package', 'damage claim'],
    d: (() => {
      const P = iso(12, 3.1, 9.5, 7.5);
      const [R1, Rd, R2] = [toward(P.R, P.T, 3.25), [18, 10.25], add(P.R, [0, 3.5])];
      return [
        roundpoly([P.T, R1, Rd, R2, P.Rb, P.B, P.Lb, P.L], [1.6, 0.6, 0.6, 0.6, 1.6, 1.6, 1.6, 1.6]),
        line(toward(P.L, P.C, 0.4), P.C, toward(Rd, P.C, 0.4)),
        line(P.C, toward(P.B, P.C, 0.4)),
        line(mid(P.L, P.C), [8.5, 12.75], [6.25, 13.75], [7.25, 15]),
      ];
    })(),
  },
  // A parcel inside the four corners of a scan
  'parcel-scan': {
    tags: ['escanear paquete', 'lectura', 'registrar envío', 'package scan', 'scan parcel'],
    d: [...C['qr-scan'].d.slice(4), ...cube(12, 7.45, 4.5, 4.25, 1.1)],
  },
  // A parcel with its dimensions along its front edge and its height, arrowheads at their ends
  'parcel-dimensions': {
    tags: ['medidas del paquete', 'dimensiones', 'peso volumétrico', 'package dimensions', 'measurements'],
    d: (() => {
      const P = iso(10.5, 3, 6, 6);
      const u = unit(sub(P.B, P.Lb));
      const n = [-u[1], u[0]];
      const [a, b] = [add(P.Lb, mul(n, 4.25)), add(P.B, mul(n, 4.25))];
      const x = P.R[0] + 4.25;
      const [c, e] = [
        [x, P.R[1]],
        [x, P.Rb[1]],
      ];
      return [...box3(10.5, 3, 6, 6), line(a, b), head(a, sub(a, b), 1.75), head(b, sub(b, a), 1.75), line(c, e), head(c, [0, -1], 1.75), head(e, [0, 1], 1.75)];
    })(),
  },
  // Three boxes of three sizes, each with the seam of its tape: the large one lying at the bottom,
  // the medium and the small standing on it. (Side by side on one line, the width only left room
  // for narrow boxes of growing height, and they read as a bar chart.)
  'parcel-sizes': {
    tags: ['tamaños de caja', 'chica mediana grande', 'medidas de empaque', 'package sizes', 'box sizes'],
    d: [
      [3.25, 12.75, 17.5, 7.5, 1.5, 2.25],
      [3.25, 3.75, 8.75, 6, 1.5, 2.25],
      [15, 4.75, 5.75, 5, 1.25, 2],
    ].flatMap(([x, y, w, h, r, t]) => [front(x, y, w, h, r), line([x + w / 2, y], [x + w / 2, y + t])]),
  },
  'parcel-shield': { tags: ['envío asegurado', 'protección de envío', 'seguro', 'shipping protection', 'insured'], d: PARCEL_B, badge: PIECE.shield() },
  'parcel-leaf': { tags: ['envío ecológico', 'carbono neutral', 'empaque sustentable', 'eco shipping', 'carbon neutral'], d: PARCEL_B, badge: PIECE.leaf() },
  'parcel-snowflake': { tags: ['cadena de frío', 'refrigerado', 'temperatura controlada', 'cold chain', 'refrigerated'], d: PARCEL_B, badge: PIECE.snowflake() },
  'parcel-coin': { tags: ['costo de envío', 'tarifa', 'cargo por envío', 'shipping cost', 'shipping rate'], d: PARCEL_B, badge: PIECE.coin() },
  'parcel-globe': { tags: ['envío internacional', 'transfronterizo', 'a todo el mundo', 'international shipping', 'cross-border'], d: PARCEL_B, badge: PIECE.globe() },
  'parcel-x': { tags: ['entrega fallida', 'envío cancelado', 'no entregado', 'delivery failed', 'cancelled'], d: PARCEL_B, badge: badge('x') },
  'parcel-alert': { tags: ['incidencia de entrega', 'excepción', 'retenido', 'delivery exception', 'held'], d: PARCEL_B, badge: badge('alert') },
  'parcel-search': { tags: ['rastrear paquete', 'buscar envío', 'seguimiento', 'track package', 'tracking'], d: PARCEL_B, badge: badge('search') },
  'parcel-plus': { tags: ['crear envío', 'nuevo paquete', 'agregar paquete', 'create shipment', 'add package'], d: PARCEL_B, badge: badge('plus') },

  // ── Inventory ──
  'inventory-level': {
    tags: ['nivel de inventario', 'existencias', 'stock bajo', 'stock level', 'inventory level'],
    // Comercio's shelving; its three boxes light up as levels, the lower one first
    d: INVENTORY.d,
  },
  // Stock moving between locations: two taped boxes (the boxes' own) and the arrow arcing from one
  // to the other (two narrow cabinets with shelves read as server racks)
  'stock-transfer': {
    tags: ['traspaso', 'transferencia de inventario', 'mover existencias', 'stock transfer', 'transfer'],
    d: (() => {
      const box = (x) => [front(x, 13.5, 7.25, 7.25), line([x + 3.63, 13.5], [x + 3.63, 16])];
      const a = arc(12, 13, 7.25, 205, 335);
      return [...box(2.75), ...box(14), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  'inventory-x': { tags: ['agotado', 'sin existencias', 'fuera de stock', 'out of stock', 'sold out'], d: INVENTORY.d, badge: badge('x') },
  'inventory-alert': { tags: ['stock bajo', 'alerta de inventario', 'por agotarse', 'low stock', 'stock alert'], d: INVENTORY.d, badge: badge('alert') },
  'inventory-plus': { tags: ['reabastecer', 'recibir stock', 'agregar existencias', 'restock', 'add stock'], d: INVENTORY.d, badge: badge('plus') },
  'inventory-sync': { tags: ['sincronizar inventario', 'multicanal', 'actualizar existencias', 'inventory sync', 'stock sync'], d: INVENTORY.d, badge: badge('sync') },
  'inventory-search': { tags: ['buscar existencias', 'disponibilidad', 'consultar stock', 'find stock', 'availability'], d: INVENTORY.d, badge: badge('search') },
  'inventory-clock': { tags: ['pedido pendiente', 'stock por llegar', 'backorder', 'incoming stock', 'backorder'], d: INVENTORY.d, badge: badge('clock') },
  'inventory-check': { tags: ['conteo cíclico', 'inventario verificado', 'en existencia', 'stock counted', 'in stock'], d: INVENTORY.d, badge: badge('check') },
  // Archivos's clipboard with two list lines and a parcel cut out of its lower right
  'packing-list': {
    tags: ['lista de empaque', 'manifiesto', 'carta porte', 'remisión', 'packing list', 'manifest'],
    d: [...CLIP.d, line([8.25, 10], [15.75, 10]), line([8.25, 13.25], [12, 13.25])],
    badge: PIECE.parcel(),
  },
  // Comercio's rubber stamp pressing down on the top of a parcel
  'customs-clearance': {
    tags: ['despacho aduanal', 'aduana', 'liberación', 'customs clearance', 'customs'],
    d: [circ(12, 4.5, 1.75), line([11, 6], [10.75, 8.25]), line([13, 6], [13.25, 8.25]), sq(7.75, 8.25, 8.5, 3, 1), ...box3(12, 11.25, 6, 3.5)],
  },

  // ── Handling marks ──
  // The fragile mark: a wine glass, a crack running down its bowl
  'fragile': {
    tags: ['frágil', 'manejar con cuidado', 'quebradizo', 'fragile', 'handle with care'],
    d: [
      'M6.25 3.25H17.75C17.75 9.5 15.5 12.5 12 12.5C8.5 12.5 6.25 9.5 6.25 3.25Z',
      line([13.25, 3.25], [11, 5.75], [13, 7.5], [11.75, 9]),
      line([12, 12.5], [12, 20.75]),
      line([8, 20.75], [16, 20.75]),
    ],
  },
  // This side up: two arrows standing on a line
  'this-side-up': {
    tags: ['este lado arriba', 'mantener vertical', 'no voltear', 'this side up', 'keep upright'],
    d: [line([4.25, 20.75], [19.75, 20.75]), line([8, 20.75], [8, 3.5]), head([8, 3.5], [0, -1], 3.4), line([16, 20.75], [16, 3.5]), head([16, 3.5], [0, -1], 3.4)],
  },
  // Keep dry: lugares's umbrella, smaller (its canopy with two scallops: three left their points
  // too close to the handle at bold), and the rain falling on it
  'keep-dry': {
    tags: ['mantener seco', 'proteger de la lluvia', 'no mojar', 'keep dry', 'protect from rain'],
    d: [UMBRELLA, 'M12 14.63V19.5A1.31 1.31 0 0 1 9.38 19.5', line([7.75, 3.5], [7, 6.25]), line([12.75, 2.25], [12.1, 4.75]), line([17.75, 3.5], [17, 6.25])],
  },
  // Keep away from heat (the ISO handling mark): the whole sun at the top, its rays coming down at
  // its sides and below it, the shelter between them and the taped box. (The half sun hanging from
  // the top edge, its rays all downward, read as a ceiling lamp over a drawer.)
  'keep-from-heat': {
    tags: ['proteger del calor', 'evitar el sol', 'lugar fresco', 'keep from heat', 'avoid sunlight'],
    d: [
      circ(12, 4, 1.75),
      ...[0, 45, 90, 135, 180].map((a) => line(polar(12, 4, 4.7, a), polar(12, 4, 6.7, a))),
      roundline(
        [
          [3.75, 15.25],
          [3.75, 13.75],
          [20.25, 13.75],
          [20.25, 15.25],
        ],
        [0, 1, 1, 0],
      ),
      front(7, 16.5, 10, 4.25, 1.5),
      line([12, 16.5], [12, 18.5]),
    ],
  },
  // Lugares's thermometer, its mercury between the two limits marked on its right
  'thermometer-range': {
    tags: ['rango de temperatura', 'límites', 'cadena de frío', 'temperature range', 'temperature limits'],
    d: [...thermo(9.5, 10.25), line([12.4, 6.25], [16.75, 6.25]), line([12.4, 12.75], [16.75, 12.75])],
  },
  // A crane hook on its block, hanging from a short cable
  'cargo-hook': {
    tags: ['gancho de grúa', 'izaje', 'punto de carga', 'cargo hook', 'crane hook'],
    d: [line([12, 2.75], [12, 5.5]), sq(9.25, 5.5, 5.5, 4.5, 1.25), `M12 10V15.25A3.25 3.25 0 1 1 5.5 15.25V14`],
  },
  // Datos's container from the rear: the left door shut with its lock rod, the right one swung
  // open on its hinge
  'container-open': {
    tags: ['contenedor abierto', 'desconsolidar', 'inspección', 'open container', 'devanning'],
    d: [
      sq(2.75, 4.5, 12.25, 15, 2.25, { square: ['tr', 'br'] }),
      line([8.88, 4.5], [8.88, 19.5]),
      line([5.81, 7.5], [5.81, 16.5]),
      roundline(
        [
          [15, 4.5],
          [21.25, 3],
          [21.25, 21],
          [15, 19.5],
        ],
        [0, 1, 1, 0],
      ),
    ],
  },
  // The air cargo container: its lower left corner cut on a slope to fit the hull, and its door
  'air-container': {
    tags: ['contenedor aéreo', 'uld', 'carga aérea', 'air container', 'unit load device'],
    d: [
      roundpoly(
        [
          [2.75, 5],
          [21.25, 5],
          [21.25, 19.25],
          [8.5, 19.25],
          [2.75, 13.25],
        ],
        [2.75, 2.75, 0, 1.25, 1.25],
      ),
      line([15.5, 5], [15.5, 19.25]),
    ],
  },
  // A trade lane: the origin and the destination, and the arc that lands on the second one (with
  // a base line under them it read as a dome)
  'shipping-lane': {
    tags: ['ruta comercial', 'origen y destino', 'carril', 'trade lane', 'shipping lane'],
    d: [circ(4.75, 18.25, 1.75), circ(19.25, 18.25, 1.75), 'M4.75 16.5C4.75 7.75 14.5 5.5 19.25 16.5', head([19.25, 16.5], [0.4, 1], 3)],
  },
  'parcel-camera': { tags: ['foto de entrega', 'evidencia fotográfica', 'prueba con foto', 'delivery photo', 'photo proof'], d: PARCEL_B, badge: PIECE.camera() },
  'parcel-heavy': { tags: ['paquete pesado', 'sobrepeso', 'entrega a dos personas', 'heavy package', 'oversized'], d: PARCEL_B, badge: PIECE.weight() },
  // A tracker puck with its strap hole and the signal rising from its upper right
  'asset-tracker': {
    tags: ['rastreador gps', 'localizador', 'rastreo de activos', 'asset tracker', 'gps tracker'],
    d: [sq(3.25, 9.75, 11, 11, 3.5, SQ), dot(6.75, 13.25), arc(14.25, 9.75, 3.25, -85, -5).d, arc(14.25, 9.75, 6.25, -85, -5).d],
  },
};

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index into d: `solid` is filled and keeps its stroke, `cut` is knocked out, `lines` stays a
// line with a clearance of paper and `wire` stays a line attached to the fill. A number is a stroke
// of d; a string, a fill-only stroke; `z(i)` closes an open stroke of d along an edge that is
// already solid or knocked out (a box on its shelf, a cab against its box).
const z = (i) => ({ z: i });
const TRUCK_FILL = { solid: [0, z(1), 2, 3], cut: [SEAM] };
// The small parcel's edges knocked out through to its silhouette (cut 0.4 short, they joined the
// edge at some weights and not at others)
const PARCEL_FILL = (() => {
  const P = iso(10.5, 3.1, 8, 8.5);
  return { solid: [0], cut: [line(toward(P.L, P.C, -1), P.C, toward(P.R, P.C, -1)), line(P.C, toward(P.B, P.C, -1))] };
})();
const INVENTORY_FILL = { solid: [z(4), z(5), z(6)], wire: [0, 1, 2, 3] };
const WAREHOUSE_FILL = { solid: [WAREHOUSE.fill.solid[0]], wire: [0], cut: [2, 3, 4] };
const FILL = {
  forklift: { solid: [0, 4, 5], wire: [1, 2, 3] },
  'pallet-jack': { solid: [z(0), 3], wire: [1, 2] },
  // The boxes on the toe plate: the edge between them knocked out
  'hand-truck': { solid: [1, z(2), z(3)], wire: [0], cut: ['M11 14.25H19.5'] },
  'platform-trolley': { solid: [z(1), 2, 3], wire: [0] },
  // A cage is see-through: its frame and bars stay lines, the casters fill
  'roll-cage': { solid: [4, 5], wire: [0, 1, 2, 3] },
  'pick-cart': { solid: [z(1), z(2), 3, 4], wire: [0] },
  // The boxes stand on the belt's top run, which is knocked out under them so they don't merge
  'conveyor-belt': { solid: [0, z(4), z(6)], cut: [1, 2, 3, 5, 7, 'M4.75 12.5H10.75', 'M13.25 12.5H19.25'] },
  'port-crane': { solid: [7], wire: [0, 1, 2, 3, 4, 5, 6] },
  'container-stack': { solid: [0, 3, 6], cut: [1, 2, 4, 5, 7, 8] },
  'container-location': { solid: [0], cut: [1, 2, 3] },
  'pallet-rack': { solid: [z(4), z(6)], wire: [0, 1, 2, 3, 5] },
  'bin-location': { solid: [0], cut: [1, 2, 3, 4] },
  'storage-bin': { solid: [0], cut: [1, 2] },
  boxes: { solid: [0, 2, 4], cut: [1, 3, 5] },
  crate: { solid: [0], cut: [1, 2] },
  // The platform and the ground stay lines; the box on the platform, the trailer and its wheels fill
  'loading-dock': { solid: [0, z(3), 4, 5], wire: [1, 2] },
  // The shutter fills down to its bottom edge, its seam knocked out; the frame's legs stay lines
  // and the box under the shutter fills with its tape knocked out
  'dock-door': { solid: [SHUTTER, 3], cut: [1, 4], wire: [0] },
  'tape-gun': { solid: [0, 4], cut: [1], wire: [2, 3, 5] },
  'poly-mailer': { solid: [0], cut: [1] },
  'shipping-label': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'return-label': { solid: [0], cut: [1, 2, 3] },
  // The body and the label fill (the body closed across the label, the label along the seam); the
  // seam and the label's marks are cut
  'label-printer': { solid: [z(0), z(2)], cut: [1, 3, 4, 5, 6] },
  'handheld-scanner': { solid: [0], wire: [1, 2] },
  'rfid-tag': { solid: [0], cut: [1, 2] },
  // The ring stays a line, attached to the body
  weight: { solid: [0], wire: [1] },
  // The pod closes along the robot's back, which is knocked out between them
  'warehouse-robot': { solid: [0, z(1)], cut: [2, 3, 4, 'M6.25 13.75H17.75'] },
  'delivery-robot': { solid: [0, 3, 4, 5], cut: [1], wire: [2] },
  'drone-delivery': { solid: [0, 8], cut: [9, 10], wire: [1, 2, 3, 4, 5, 6, 7] },
  // The seat fills under the box, separated from it by the box's bottom edge
  'delivery-moped': { solid: [z(0), COWL, 5, 6], wire: [1, 2, 3, 4], cut: ['M2.75 9.25H9.75'] },
  'cargo-bike': { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7] },
  'delivery-bag': { solid: [0], wire: [1], cut: [2, 3] },
  'parcel-locker': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'curbside-pickup': { solid: [0, z(1), 2], cut: [3, 4] },
  'proof-of-delivery': { solid: [0], cut: [1, 2], lines: [3, 4] },
  'parcel-handover': { solid: [0, 3, z(4)], cut: [1, 2] },
  fleet: { solid: [0, z(1)], cut: [FLEET.backSeam] },
  'truck-location': TRUCK_FILL,
  'truck-capacity': { solid: [0, z(1), 2, 3], cut: [SEAM, 4, 5, 6] },
  // The open box stays a line; the cab, the wheels and the parcel inside fill
  'truck-loading': { solid: [z(1), 2, 3, 4], cut: [5, 6], wire: [0, 7, 8] },
  'truck-return': { solid: [0, z(1), 2, 3], cut: [transform(flipPath(SEAM), 0.75, 3, 20.75 - 20.5 * 0.75)], wire: [4, 5] },
  'truck-alert': TRUCK_FILL,
  'calendar-truck': { solid: [0], lines: [1, 2], cut: [3, 4, 5] },
  'freight-sea': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'freight-air': PARCEL_FILL,
  'freight-rail': { solid: [0, 4, 5, 6, 7], cut: [1, 2], wire: [3, 8] },
  'freight-road': { solid: [0, 5, 6], cut: [1, 2, 3], wire: [4, 7] },
  // The folds knocked out through the edges: with the route, a fold that stopped at the edge joined
  // the panels at some weights and not at others
  'map-route': { solid: [0], cut: ['M9 2.75V19', 'M15 5V21.25', 3, 4] },
  'route-stops': { solid: [0, 1, 2, 3], wire: [4, 5, 6] },
  'supply-chain': { solid: [0, 2], cut: [1, 3], lines: [4, 5, 6] },
  'warehouse-inbound': { solid: [transform(WAREHOUSE.fill.solid[0], 0.75, 5.38, 5.19)], wire: [0, 5, 6], cut: [2, 3, 4] },
  'warehouse-outbound': { solid: [transform(WAREHOUSE.fill.solid[0], 0.75, 0.63, 5.19)], wire: [0, 5, 6], cut: [2, 3, 4] },
  'warehouse-snowflake': WAREHOUSE_FILL,
  'warehouse-plus': WAREHOUSE_FILL,
  picking: { solid: [z(3), z(5)], cut: [4, 6], wire: [0, 1, 2, 7, 8] },
  putaway: { solid: [z(3), z(5)], cut: [4, 6], wire: [0, 1, 2, 7, 8] },
  'parcel-sort': { solid: [0], cut: [1, 2], wire: [3, 4, 5, 6, 7, 8, 9] },
  'parcel-merge': { solid: [0], cut: [1, 2], lines: [3, 4, 5, 6, 7, 8] },
  'parcel-transit': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
  'parcel-damaged': { solid: [0], cut: [1, 2, 3] },
  'parcel-scan': { solid: [4], cut: [5, 6], lines: [0, 1, 2, 3] },
  'parcel-dimensions': { solid: [0], cut: [1, 2], lines: [3, 4, 5, 6, 7, 8] },
  'parcel-sizes': { solid: [0, 2, 4], cut: [1, 3, 5] },
  'parcel-shield': PARCEL_FILL,
  'parcel-leaf': PARCEL_FILL,
  'parcel-snowflake': PARCEL_FILL,
  'parcel-coin': PARCEL_FILL,
  'parcel-globe': PARCEL_FILL,
  'parcel-x': PARCEL_FILL,
  'parcel-alert': PARCEL_FILL,
  'parcel-search': PARCEL_FILL,
  'parcel-plus': PARCEL_FILL,
  'parcel-camera': PARCEL_FILL,
  'parcel-heavy': PARCEL_FILL,
  'inventory-level': INVENTORY_FILL,
  'stock-transfer': { solid: [0, 2], cut: [1, 3], lines: [4, 5] },
  'inventory-x': INVENTORY_FILL,
  'inventory-alert': INVENTORY_FILL,
  'inventory-plus': INVENTORY_FILL,
  'inventory-sync': INVENTORY_FILL,
  'inventory-search': INVENTORY_FILL,
  'inventory-clock': INVENTORY_FILL,
  'inventory-check': INVENTORY_FILL,
  // The clipboard as in archivos: the board and its clip, the channel under the clip knocked out
  'packing-list': { solid: CLIP.fill.solid, cut: [...CLIP.fill.cut, 2, 3] },
  // The stamp as in comercio: the neck filled whole
  'customs-clearance': { solid: [0, 'M11 6L10.75 8.25H13.25L13 6Z', 3, 4], cut: [5, 6] },
  fragile: { solid: [0], cut: [1], wire: [2, 3] },
  'keep-dry': { solid: [0], wire: [1], lines: [2, 3, 4] },
  // The sun's disc fills; its rays and the canopy stay lines, apart from the box
  'keep-from-heat': { solid: [0, 7], cut: [8], lines: [1, 2, 3, 4, 5, 6] },
  'thermometer-range': { solid: [0], cut: [1], wire: [2, 3] },
  'cargo-hook': { solid: [1], wire: [0, 2] },
  // The swung door fills against the frame, separated from it by the hinge
  'container-open': { solid: [0, z(3)], cut: [1, 2, 'M15 4.5V19.5'] },
  'air-container': { solid: [0], cut: [1] },
  'shipping-lane': { solid: [0, 1], wire: [2, 3] },
  'asset-tracker': { solid: [0], cut: [1], lines: [2, 3] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : typeof i === 'object' ? shut(d[i.z]) : i));
  icons[name].fill = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
// The open parcel: the walls and the opening filled, the front rim and the edge knocked out
// through to the silhouette
{
  const d = icons['parcel-pack'].d;
  const P = iso(12, 7.5, 8, 5);
  icons['parcel-pack'].fill = { solid: [shut(d[0]), d[1]], cut: [line(toward(P.L, P.C, -1), P.C, toward(P.R, P.C, -1)), line(P.C, toward(P.B, P.C, -1))], wire: [d[3], d[4]] };
}
// Only lines: their fill is the outline itself
for (const name of ['route-optimize', 'cross-dock', 'this-side-up']) icons[name].fill = false;

// ── Named parts (emitted as data-part) ────────────────────────────────────────────────────────
const TRUCK_PARTS = { body: [0], cab: [1], wheels: [2, 3] };
const PARCEL_PARTS = { body: [0], edges: [1, 2] };
const INVENTORY_PARTS = { frame: [0, 1, 2, 3], boxes: [4, 5, 6] };
const WAREHOUSE_PARTS = { roof: [0], walls: [1], door: [2, 3, 4] };
const PARTS = {
  forklift: { body: [0], cage: [1], mast: [2, 3], wheels: [4, 5] },
  'pallet-jack': { body: [0], handle: [1, 2], wheel: [3] },
  'hand-truck': { frame: [0], wheel: [1], boxes: [2, 3] },
  'platform-trolley': { frame: [0], box: [1], wheels: [2, 3] },
  'roll-cage': { frame: [0], bars: [1, 2, 3], wheels: [4, 5] },
  'pick-cart': { frame: [0], totes: [1, 2], wheels: [3, 4] },
  'conveyor-belt': { belt: [0], rollers: [1, 2, 3], boxes: [4, 5, 6, 7] },
  'port-crane': { frame: [0, 1, 2, 3, 4, 5], cable: [6], container: [7] },
  'container-stack': { containers: [0, 3, 6], ribs: [1, 2, 4, 5, 7, 8] },
  'container-location': { body: [0], ribs: [1, 2, 3] },
  'pallet-rack': { frame: [0, 1, 2], pallets: [3, 4, 5, 6] },
  'bin-location': { frame: [0], grid: [1, 2, 3], mark: [4] },
  'loading-dock': { trailer: [0, 4, 5], dock: [1, 2], box: [3] },
  'dock-door': { frame: [0], shutter: [1, 2], box: [3, 4] },
  'tape-gun': { roll: [0, 1], body: [2, 3, 4], tape: [5] },
  'shipping-label': { body: [0], address: [1], barcode: [2, 3, 4, 5] },
  'return-label': { body: [0], address: [1], arrow: [2, 3] },
  'label-printer': { body: [0], seam: [1], label: [2, 3, 4, 5, 6] },
  'handheld-scanner': { body: [0], beam: [1, 2] },
  'rfid-tag': { body: [0], hole: [1], antenna: [2] },
  weight: { body: [0], handle: [1] },
  'warehouse-robot': { body: [0, 3, 4], pod: [1, 2] },
  'delivery-robot': { body: [0], lid: [1], flag: [2], wheels: [3, 4, 5] },
  'drone-delivery': { body: [0], arms: [1, 2, 3, 4], rotors: [5, 6], parcel: [7, 8, 9, 10] },
  'delivery-moped': { box: [0], body: [1, 2, 3, 4], wheels: [5, 6] },
  'cargo-bike': { box: [0], frame: [1, 2, 3, 4, 5], wheels: [6, 7] },
  'delivery-bag': { body: [0], handle: [1], straps: [2, 3] },
  'parcel-locker': { body: [0], doors: [1, 2], handles: [3, 4, 5, 6] },
  'curbside-pickup': { car: [0, 1], parcel: [2, 3, 4] },
  'proof-of-delivery': { parcel: [0, 1, 2], signature: [3], line: [4] },
  'parcel-handover': { parcel: [0, 1, 2], cuff: [3], hand: [4] },
  fleet: { back: [0, 1] },
  'truck-location': TRUCK_PARTS,
  'truck-capacity': { ...TRUCK_PARTS, level: [4, 5, 6] },
  'truck-loading': { body: [0], cab: [1], wheels: [2, 3], parcel: [4, 5, 6], arrow: [7, 8] },
  'truck-return': { ...TRUCK_PARTS, arrow: [4, 5] },
  'truck-alert': TRUCK_PARTS,
  'calendar-truck': { body: [0], rings: [1, 2], days: [4, 5] },
  'freight-sea': { container: [0, 1, 2, 3], waves: [4, 5] },
  'freight-air': PARCEL_PARTS,
  'freight-rail': { container: [0, 1, 2], car: [3], wheels: [4, 5, 6, 7], rail: [8] },
  'freight-road': { container: [0, 1, 2, 3], trailer: [4, 7], wheels: [5, 6] },
  'map-route': { map: [0], folds: [1, 2], route: [3, 4] },
  'route-optimize': { stops: [0, 1], route: [2], detour: [3, 4, 5, 6, 7] },
  'route-stops': { depot: [0], stops: [1, 2, 3], route: [4, 5, 6] },
  'supply-chain': { boxes: [0, 1, 2, 3], link: [4, 5, 6] },
  'cross-dock': { building: [0, 1], arrows: [2, 3, 4, 5] },
  'warehouse-inbound': { ...WAREHOUSE_PARTS, arrow: [5, 6] },
  'warehouse-outbound': { ...WAREHOUSE_PARTS, arrow: [5, 6] },
  'warehouse-snowflake': WAREHOUSE_PARTS,
  'warehouse-plus': WAREHOUSE_PARTS,
  picking: { rack: [0, 1, 2], stock: [3, 4], box: [5, 6], arrow: [7, 8] },
  putaway: { rack: [0, 1, 2], stock: [3, 4], box: [5, 6], arrow: [7, 8] },
  'parcel-pack': { body: [0], rim: [1], edge: [2], arrow: [3, 4] },
  'parcel-sort': { parcel: [0, 1, 2], arrows: [3, 4, 5, 6, 7, 8, 9] },
  'parcel-merge': { parcel: [0, 1, 2], arrows: [3, 4, 5, 6, 7, 8] },
  'parcel-transit': { parcel: [0, 1, 2], speed: [3, 4, 5] },
  'parcel-damaged': { body: [0], edges: [1, 2], crack: [3] },
  'parcel-scan': { frame: [0, 1, 2, 3], parcel: [4, 5, 6] },
  'parcel-dimensions': { parcel: [0, 1, 2], dimensions: [3, 4, 5, 6, 7, 8] },
  'parcel-sizes': { large: [0, 1], medium: [2, 3], small: [4, 5] },
  'parcel-shield': PARCEL_PARTS,
  'parcel-leaf': PARCEL_PARTS,
  'parcel-snowflake': PARCEL_PARTS,
  'parcel-coin': PARCEL_PARTS,
  'parcel-globe': PARCEL_PARTS,
  'parcel-x': PARCEL_PARTS,
  'parcel-alert': PARCEL_PARTS,
  'parcel-search': PARCEL_PARTS,
  'parcel-plus': PARCEL_PARTS,
  'parcel-camera': PARCEL_PARTS,
  'parcel-heavy': PARCEL_PARTS,
  'inventory-level': { frame: [0, 1, 2, 3], level: [4, 5, 6] },
  'stock-transfer': { from: [0, 1], to: [2, 3], arrow: [4, 5] },
  'storage-bin': { body: [0], rim: [1], handle: [2] },
  'poly-mailer': { body: [0], flap: [1] },
  'inventory-x': INVENTORY_PARTS,
  'inventory-alert': INVENTORY_PARTS,
  'inventory-plus': INVENTORY_PARTS,
  'inventory-sync': INVENTORY_PARTS,
  'inventory-search': INVENTORY_PARTS,
  'inventory-clock': INVENTORY_PARTS,
  'inventory-check': INVENTORY_PARTS,
  'packing-list': { board: [0], clip: [1], lines: [2, 3] },
  'customs-clearance': { stamp: [0, 1, 2, 3], parcel: [4, 5, 6] },
  fragile: { glass: [0, 2, 3], crack: [1] },
  'this-side-up': { base: [0], arrows: [1, 2, 3, 4] },
  'keep-dry': { umbrella: [0, 1], rain: [2, 3, 4] },
  'keep-from-heat': { sun: [0, 1, 2, 3, 4, 5], canopy: [6], box: [7, 8] },
  'thermometer-range': { glass: [0], level: [1], limits: [2, 3] },
  'cargo-hook': { cable: [0], block: [1], hook: [2] },
  'container-open': { body: [0, 1, 2], door: [3] },
  'shipping-lane': { stops: [0, 1], arc: [2, 3] },
  'asset-tracker': { body: [0], hole: [1], level: [2, 3] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// With a badge or a piece on top (as in comercio): the filled enclosure loses the piece on top, at
// 58 % the sign stops reading, and the slash would cross it with no clearance
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// A slash through lone arrows says nothing
for (const name of ['this-side-up', 'cross-dock']) icons[name].variants = { ...icons[name].variants, slash: false };

// ── Mirroring: whatever moves forward, goes back or points to one side ────────────────────────
for (const name of ['forklift', 'delivery-robot', 'delivery-moped', 'cargo-bike', 'curbside-pickup', 'fleet', 'truck-location', 'truck-capacity', 'truck-loading', 'truck-return', 'truck-alert', 'freight-air', 'freight-road', 'parcel-transit', 'cross-dock', 'warehouse-inbound', 'warehouse-outbound', 'picking', 'putaway', 'stock-transfer', 'shipping-lane', 'return-label'])
  icons[name].mirror = true;

// ── Levels (value 0–1) ────────────────────────────────────────────────────────────────────────
// The truck's load, the shelf's boxes (the lower one first) and the tracker's signal
icons['truck-capacity'].levels = [[4], [5], [6]];
icons['inventory-level'].levels = [[6], [4], [5]];
icons['asset-tracker'].levels = [[2], [3]];

// ── Motion: each icon's own gesture ───────────────────────────────────────────────────────────
const MOTION = {
  forklift: { effect: 'slide', vector: [2, 0] },
  'pallet-jack': { effect: 'slide', vector: [2, 0] },
  'hand-truck': { effect: 'wiggle', origin: [5.5, 18.25] },
  'platform-trolley': { effect: 'slide', vector: [2, 0] },
  'roll-cage': { effect: 'slide', vector: [1.5, 0] },
  'pick-cart': { effect: 'slide', vector: [2, 0] },
  'conveyor-belt': { effect: 'slide', parts: ['boxes'], vector: [2, 0] },
  'port-crane': { effect: 'wiggle', parts: ['cable', 'container'], origin: [17, 7.25] },
  'container-location': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'dock-door': { effect: 'slide', parts: ['shutter'], vector: [0, -1.5] },
  'label-printer': { effect: 'slide', parts: ['label'], vector: [0, 1.5] },
  'delivery-robot': { effect: 'slide', vector: [2, 0] },
  'warehouse-robot': { effect: 'slide', vector: [2, 0] },
  'drone-delivery': { effect: 'float', vector: [0, -1.5] },
  'delivery-moped': { effect: 'slide', vector: [2, 0] },
  'cargo-bike': { effect: 'slide', vector: [2, 0] },
  'curbside-pickup': { effect: 'bounce', parts: ['parcel'], vector: [0, -1.5] },
  'parcel-handover': { effect: 'bounce', parts: ['parcel'], vector: [0, -1.5] },
  fleet: { effect: 'slide', vector: [2, 0] },
  'truck-location': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'truck-loading': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'truck-return': { effect: 'slide', vector: [-2, 0] },
  'truck-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'freight-sea': { effect: 'float', parts: ['container'], vector: [0, -1] },
  'freight-air': { effect: 'slide', parts: ['badge'], vector: [1.5, -1.5] },
  'freight-rail': { effect: 'slide', parts: ['container', 'car', 'wheels'], vector: [2, 0] },
  'freight-road': { effect: 'slide', vector: [2, 0] },
  'map-route': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'cross-dock': { effect: 'slide', parts: ['arrows'], vector: [2, 0] },
  'warehouse-inbound': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'warehouse-outbound': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'warehouse-snowflake': { effect: 'spin', parts: ['badge'], origin: BC },
  picking: { effect: 'slide', parts: ['box', 'arrow'], vector: [1.5, 0] },
  putaway: { effect: 'slide', parts: ['box', 'arrow'], vector: [-1.5, 0] },
  'parcel-pack': { effect: 'bounce', parts: ['arrow'], vector: [0, 1.5] },
  'parcel-sort': { effect: 'slide', parts: ['arrows'], vector: [0, 1.5] },
  'parcel-merge': { effect: 'slide', parts: ['arrows'], vector: [0, 1.5] },
  'parcel-transit': { effect: 'slide', vector: [2, 0] },
  'parcel-damaged': { effect: 'wiggle', origin: [12, 20.88] },
  'parcel-scan': { effect: 'beat', parts: ['parcel'], origin: [12, 12] },
  'parcel-snowflake': { effect: 'spin', parts: ['badge'], origin: BC },
  'parcel-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'parcel-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'inventory-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'inventory-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'inventory-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'inventory-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'stock-transfer': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'customs-clearance': { effect: 'bounce', parts: ['stamp'], vector: [0, 1.5] },
  fragile: { effect: 'wiggle', origin: [12, 20.75] },
  'this-side-up': { effect: 'slide', parts: ['arrows'], vector: [0, -1.5] },
  'cargo-hook': { effect: 'wiggle', origin: [12, 2.75] },
  'shipping-lane': { effect: 'slide', parts: ['arc'], vector: [1.5, 0] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── 16 px (DESIGN.md › 16 px): drawings made for the pixel grid where snapping isn't enough ──
// At 16 px a pixel measures 1.5 canvas units and pixel centers fall at 0.75 + 1.5k; g(column, row)
// is the center of a pixel and pl() a polyline through pixel centers. The engine neither snaps a
// `small` nor swaps its badge: a small with a standard badge carries the engine's pixel badge
// (`badge(kind, { size: 16 })`), and a custom piece carries its own pixel drawing, clearing the
// same circle as at 24 px plus itself (as in archivos).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
/** A pixel badge glyph around the badge's pixel (11, 11). */
const at = (...pts) => pl(...pts.map(([c, r]) => [11 + c, 11 + r]));
const AT = (c, r) => g(11 + c, 11 + r);
const pixelPiece = (d, fill, extra = d) => ({ d, knock: `${RING_K}${extra.join('')}`, ...(fill && { fill }) });
const PIECE16 = {
  snowflake: () => pixelPiece([at([0, -3], [0, 3]), at([-2, -2], [2, 2]), at([2, -2], [-2, 2])]),
  leaf: () => {
    const l = `M${pt(AT(-3, 3))}C${pt(AT(-3, -1))} ${pt(AT(-1, -3))} ${pt(AT(3, -3))}C${pt(AT(3, 1))} ${pt(AT(1, 3))} ${pt(AT(-3, 3))}Z`;
    return pixelPiece([l], { solid: [l] });
  },
  shield: () => {
    const s = roundpoly([AT(-3, -3), AT(3, -3), AT(3, 0), AT(0, 3), AT(-3, 0)], 0.6);
    return pixelPiece([s], { solid: [s] });
  },
  // As the engine's status badges at 16 px: no disc, the sign larger (comercio's pixel peso sign).
  // It clears just the ring: the S's own loops, filled, would cancel parts of it out
  coin: () => pixelPiece([pl([12, 9], [10, 9], [10, 11], [12, 11], [12, 13], [10, 13]), pl([11, 8], [11, 9]), pl([11, 13], [11, 14])], undefined, []),
  globe: () => {
    const c = circ(...AT(0, 0), 4.5);
    const m = `M${pt(AT(0, -3))}Q${pt(AT(-2.5, 0))} ${pt(AT(0, 3))}Q${pt(AT(2.5, 0))} ${pt(AT(0, -3))}Z`;
    return pixelPiece([c, at([-3, 0], [3, 0]), m], { solid: [c], cut: [at([-3, 0], [3, 0]), m] }, [clockwise(AT(0, 0), 4.5)]);
  },
  camera: () => {
    const body = sq(px(8), px(9), 9, 6, 1.2);
    const lens = circ(...AT(0, 0.5), 1.5);
    return pixelPiece([body, pl([10, 9], [10, 8], [12, 8], [12, 9]), lens], { solid: [body], cut: [lens], wire: [pl([10, 9], [10, 8], [12, 8], [12, 9])] });
  },
  // The kettlebell: the status disc and its handle on pixel centers, two pixels of hole under it
  weight: () => {
    const handle = pl([9, 9], [9, 6], [13, 6], [13, 9]);
    return pixelPiece([RING, handle], { solid: [RING], wire: [handle] }, [handle]);
  },
  truck: () => {
    const box = sq(px(8), px(8), 6, 6, 1, SQ);
    const cab = pl([12, 10], [13, 10], [14, 11], [14, 12], [12, 12]);
    const wheels = [circ(...g(9, 14), 0.1), circ(...g(13, 14), 0.1)];
    return pixelPiece([box, cab, ...wheels], { solid: [box, shut(cab), ...wheels] });
  },
  parcel: () => {
    const body = roundpoly([g(11, 8), g(13, 9), g(13, 12), g(11, 13), g(9, 12), g(9, 9)], 0.6);
    const edges = [pl([9, 9], [11, 10], [13, 9]), pl([11, 10], [11, 13])];
    return pixelPiece([body, ...edges], { solid: [body], cut: edges });
  },
};
/** The icon's own drawing snapped as the engine would (one shared adjustment), and a pixel badge. */
function snapped16(name, badge16) {
  const icon = icons[name];
  const sn = snapper([...icon.d, ...Object.values(icon.fill || {}).flat()]);
  icon.small = {
    d: icon.d.map(sn),
    ...(icon.fill && { fill: Object.fromEntries(Object.entries(icon.fill).map(([k, v]) => [k, v.map(sn)])) }),
    ...(badge16 && { badge: badge16 }),
  };
}
for (const [name, kind] of [
  ['warehouse-snowflake', 'snowflake'],
  ['calendar-truck', 'truck'],
  ['packing-list', 'parcel'],
])
  snapped16(name, PIECE16[kind]());
// The small parcel that carries a badge: snapped, its edges became a gray mesh. At 16 px it is the
// pixel box (2:1 edges through pixel centers, as comercio's parcel at 16 px), up and to the left so
// the badge clears its corner and not its bottom
{
  const body = roundpoly([g(6, 1), g(10, 3), g(10, 9), g(6, 11), g(2, 9), g(2, 3)], 0.6);
  const edges = [pl([2, 3], [6, 5], [10, 3]), pl([6, 5], [6, 11])];
  const base = { d: [body, ...edges], fill: { solid: [body], cut: edges } };
  for (const [name, kind] of [
    ['parcel-shield', 'shield'],
    ['parcel-leaf', 'leaf'],
    ['parcel-snowflake', 'snowflake'],
    ['parcel-coin', 'coin'],
    ['parcel-globe', 'globe'],
    ['parcel-camera', 'camera'],
    ['parcel-heavy', 'weight'],
    ['parcel-x', 'x'],
    ['parcel-alert', 'alert'],
    ['parcel-search', 'search'],
    ['parcel-plus', 'plus'],
  ])
    icons[name].small = { ...base, badge: PIECE16[kind] ? PIECE16[kind]() : badge(kind, { size: 16 }) };
}

/** A small drawing and its fill (outline only when `fill` is false). */
const small = (name, d, fill) => {
  icons[name].small = { d, ...(fill && { fill }) };
};
// The tape gun on the pixel grid: the roll and its hub, the arm down to the frame, the frame with
// its nose, the grip, and the tape running from the roll to the nose on a pixel diagonal
{
  const roll = circ(...g(8, 5), 4.5);
  const hub = circ(...g(8, 5), 0.1);
  const grip = sq(px(10), px(10), 3, 6, 0.75);
  const frame = pl([10, 10], [2, 10], [2, 8]);
  const d = [roll, hub, frame, pl([8, 8], [8, 10]), grip, pl([5, 5], [2, 8])];
  small('tape-gun', d, { solid: [roll, grip], cut: [hub], wire: [frame, d[3], d[5]] });
}
// The trade lane: the two stops and the arc between them as straight and 45° runs, its head on
// the second stop
{
  const d = [circ(...g(2, 12), 1.5), circ(...g(12, 12), 1.5), pl([2, 10], [2, 7], [5, 4], [9, 4], [12, 7], [12, 10]), pl([10, 8], [12, 10], [14, 8])];
  small('shipping-lane', d, { solid: d.slice(0, 2), wire: d.slice(2) });
}
// The container over the sea: its ribs, and the waves stepped on the pixel grid
{
  const box = sq(px(2), px(1), 18, 9, 1.5, SQ);
  // Each wave: a pixel up, a pixel across, a pixel down, a pixel across
  const zig = (r) => pl(...Array.from({ length: 13 }, (_, i) => [1 + i, r + [1, 0, 0, 1][i % 4]]));
  const d = [box, ...[5, 8, 11].map((c) => pl([c, 3], [c, 5])), zig(9), zig(12)];
  small('freight-sea', d, { solid: [box], cut: d.slice(1, 4), lines: d.slice(4) });
}
// The forklift: body, cage, link, mast and fork, and two wheels a pixel apart
{
  const body = sq(px(1), px(6), 10.5, 3, 0.9);
  const wheels = [circ(...g(3, 12), 1.5), circ(...g(7, 12), 1.5)];
  const d = [body, pl([2, 6], [2, 1], [6, 1], [7, 6]), pl([8, 7], [11, 7]), pl([11, 1], [11, 13], [14, 13]), ...wheels];
  small('forklift', d, { solid: [body, ...wheels], wire: d.slice(1, 4) });
}
// The cargo bike: the rear wheel, the frame through to the small front wheel, the box over it
// and the saddle on its post
{
  const wheels = [circ(...g(3, 12), 3), circ(...g(13, 12), 1.5)];
  const box = sq(px(7), px(7), 7.5, 4.5, 0.9, SQ);
  const d = [box, pl([3, 12], [13, 12]), pl([6, 12], [6, 6]), pl([4, 6], [7, 6]), ...wheels];
  small('cargo-bike', d, { solid: [box], wire: d.slice(1) });
}
// The car with the parcel over its trunk: body, cabin, wheels under it
{
  const body = sq(px(1), px(8), 19.5, 3, 1);
  const cabin = pl([6, 8], [7, 6], [11, 6], [12, 8]);
  const wheels = [circ(...g(4, 12), 1.5), circ(...g(11, 12), 1.5)];
  const cube16 = [sq(px(1), px(1), 6, 4.5, 0.75), pl([3, 1], [3, 2])];
  const d = [body, cabin, ...cube16, ...wheels];
  icons['curbside-pickup'].small = { d, fill: { solid: [body, shut(cabin), cube16[0], ...wheels], cut: cube16.slice(1) } };
}
// The truck taking a parcel in: its box open at the back, the parcel inside and the arrow
{
  const box = pl([5, 9], [11, 9], [11, 4], [5, 4]);
  const cab = pl([11, 6], [13, 6], [15, 8], [15, 9], [11, 9]);
  const wheels = [circ(...g(7, 11), 1.5), circ(...g(13, 11), 1.5)];
  const parcel16 = sq(px(7), px(6), 3, 3, 0.6);
  const d = [box, cab, ...wheels, parcel16, pl([1, 6], [3, 6]), pl([2, 5], [3, 6], [2, 7])];
  small('truck-loading', d, { solid: [shut(cab), ...wheels, parcel16], wire: [box, d[5], d[6]] });
}
// The stamp over a box
{
  const pad = sq(px(5), px(5), 9, 3, 0.8);
  const box = sq(px(4), px(10), 13.5, 6, 1);
  const d = [circ(...g(8, 2), 1.5), pl([8, 3], [8, 5]), pad, box, pl([8, 10], [8, 12])];
  small('customs-clearance', d, { solid: [d[0], pad, box], wire: [d[1]], cut: [d[4]] });
}
// The poly mailer: its flap a point of two-to-one steps (snapped, the shallow V went gray)
{
  const body = sq(px(3), px(1), 13.5, 19.5, 2, SQ);
  const flap = pl([3, 3], [5, 4], [7, 5], [8, 5], [10, 4], [12, 3]);
  small('poly-mailer', [body, flap], { solid: [body], cut: [flap] });
}
// The fleet: the front truck (its box, the cab's slope and a pixel for each wheel) and, a pixel
// clear of it, the roof and cab of the one behind as a single line
{
  const box = sq(px(1), px(6), 9, 7.5, 1, SQ);
  const cab = pl([7, 8], [9, 8], [11, 10], [11, 11], [7, 11]);
  const wheels = [circ(...g(3, 13), 0.1), circ(...g(9, 13), 0.1)];
  const back = pl([4, 4], [4, 1], [10, 1], [10, 3], [12, 3], [14, 5], [14, 6], [11, 6]);
  small('fleet', [back, box, cab, ...wheels], { solid: [box, shut(cab), ...wheels], wire: [back] });
}
// The courier's backpack: the bag, its handle and the straps running down to its sides, a pixel
// clear of the handle (snapped, the straps went gray)
{
  const body = sq(px(2), px(3), 16.5, 15, 2, SQ);
  const handle = pl([6, 3], [6, 1], [9, 1], [9, 3]);
  const straps = [pl([4, 3], [4, 9], [2, 11]), pl([11, 3], [11, 9], [13, 11])];
  small('delivery-bag', [body, handle, ...straps], { solid: [body], wire: [handle], cut: straps });
}
/**
 * comercio's parcel on the pixel grid: its edges run two pixels across for one down, from its top
 * corner (c, top), `hw` pixels either side (even) and `h` pixels tall at its sides.
 */
function pixelCube(c, top, hw, h) {
  const k = hw / 2;
  const body = roundpoly([g(c, top), g(c + hw, top + k), g(c + hw, top + k + h), g(c, top + hw + h), g(c - hw, top + k + h), g(c - hw, top + k)], 0.6);
  return [body, pl([c - hw, top + k], [c, top + hw], [c + hw, top + k]), pl([c, top + hw], [c, top + hw + h])];
}
// The container stack: three containers of five pixels with one rib each, the top one over the gap
// between the other two; filled, they are three solid blocks (snapped, and with their ribs cut out
// at this size, the filled containers became a row of bars)
{
  const box = (c, r) => [sq(px(c), px(r), 6, 6, 1, SQ), pl([c + 2, r], [c + 2, r + 4])];
  const d = [...box(2, 9), ...box(8, 9), ...box(5, 3)];
  small('container-stack', d, { solid: [d[0], d[2], d[4]] });
}
// The conveyor: the belt on three rollers of a pixel and the two taped boxes on its top run
{
  const belt = capsule(px(1), px(9), 18, 6);
  const rollers = [4, 7, 10].map((c) => circ(...g(c, 11), 0.1));
  const boxes = [pl([2, 9], [2, 4], [6, 4], [6, 9]), pl([8, 9], [8, 5], [12, 5], [12, 9])];
  const seams = [pl([4, 4], [4, 5]), pl([10, 5], [10, 6])];
  const d = [belt, ...rollers, boxes[0], seams[0], boxes[1], seams[1]];
  small('conveyor-belt', d, { solid: [belt, shut(boxes[0]), shut(boxes[1])], cut: [...rollers, ...seams, pl([2, 9], [6, 9]), pl([8, 9], [12, 9])] });
}
// Keep from heat: the sun of a pixel's radius and its five rays, the shelter and the taped box
{
  const sun = circ(...g(7, 2), 1.5);
  const rays = [pl([2, 2], [3, 2]), pl([4, 6], [5, 5]), pl([7, 5], [7, 6]), pl([9, 5], [10, 6]), pl([11, 2], [12, 2])];
  const roof = pl([2, 10], [2, 8], [12, 8], [12, 10]);
  const box = sq(px(4), px(10), 9, 4.5, 0.8);
  const seam = pl([7, 10], [7, 11]);
  small('keep-from-heat', [sun, ...rays, roof, box, seam], { solid: [sun, box], cut: [seam], lines: [...rays, roof] });
}
// The truck going back, flipped as at 24 px: its box (the signature corner now at its bottom
// left), the cab facing left, the wheels clear under it, and the U-turn over the box
{
  const box = sq(px(6), px(6), 10.5, 6, 1, { square: ['bl'] });
  const cab = pl([6, 8], [4, 8], [2, 10], [6, 10]);
  const wheels = [circ(...g(4, 12.5), 1.5), circ(...g(11, 12.5), 1.5)];
  const arrow = pl([12, 4], [12, 2], [11, 1], [9, 1], [8, 2], [8, 4]);
  const tip = pl([7, 3], [8, 4], [9, 3]);
  small('truck-return', [box, cab, ...wheels, arrow, tip], { solid: [box, shut(cab), ...wheels], wire: [arrow, tip] });
}
// Packing: the pixel parcel and the arrow coming down onto its top corner
{
  const cube = pixelCube(7, 6, 4, 4);
  const arrow = [pl([7, 1], [7, 4]), pl([5, 2], [7, 4], [9, 2])];
  small('parcel-pack', [...cube, ...arrow], { solid: [cube[0]], cut: cube.slice(1), wire: arrow });
}
// Sortation: the pixel parcel at the top and its three arrows fanning out on pixel diagonals
{
  const cube = pixelCube(7, 1, 4, 2);
  const arrows = [pl([7, 7], [7, 14]), pl([6, 13], [7, 14], [8, 13]), pl([7, 9], [2, 14]), pl([2, 12], [2, 14], [4, 14]), pl([7, 9], [12, 14]), pl([10, 14], [12, 14], [12, 12])];
  small('parcel-sort', [...cube, ...arrows], { solid: [cube[0]], cut: cube.slice(1), wire: arrows });
}
// Consolidation: the three arrows coming down onto the pixel parcel
{
  const cube = pixelCube(7, 8, 4, 2);
  const arrows = [pl([7, 1], [7, 6]), pl([6, 5], [7, 6], [8, 5]), pl([1, 2], [4, 5]), pl([2, 5], [4, 5], [4, 3]), pl([13, 2], [10, 5]), pl([12, 5], [10, 5], [10, 3])];
  small('parcel-merge', [...cube, ...arrows], { solid: [cube[0]], cut: cube.slice(1), lines: arrows });
}
// The scan: comercio's scan corners at 16 px around the pixel parcel
{
  const cube = pixelCube(7, 3, 4, 3);
  const corners = C['qr-scan'].small.d.slice(4);
  small('parcel-scan', [...corners, ...cube], { solid: [cube[0]], cut: cube.slice(1), lines: corners });
}
// Proof of delivery: the pixel parcel, the signature as a run of pixel diagonals and its line
{
  const cube = pixelCube(5, 1, 4, 2);
  const signature = pl([2, 11], [3, 10], [5, 12], [7, 10], [9, 12], [11, 10], [12, 11]);
  const base = pl([1, 14], [14, 14]);
  small('proof-of-delivery', [...cube, signature, base], { solid: [cube[0]], cut: cube.slice(1), lines: [signature, base] });
}
// The truck with its alert at 16 px: the engine's pixel badge clears its corner, so the truck is
// drawn up and to the left of it, its two wheels under the box (snapped whole, the badge took the
// cab's nose and the front wheel)
{
  const box = sq(px(1), px(1), 9, 7.5, 1.2, SQ);
  const cab = pl([7, 3], [9, 3], [11, 5], [11, 6], [7, 6]);
  const wheels = [circ(...g(2, 8), 0.1), circ(...g(6, 8), 0.1)];
  icons['truck-alert'].small = { d: [box, cab, ...wheels], fill: { solid: [box, shut(cab), ...wheels] }, badge: badge('alert', { size: 16 }) };
}

export default { category: 'logistica', label: 'Logística', icons };
