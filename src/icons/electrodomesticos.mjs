// Appliances and the smart home: refrigeration, cooking, small kitchen appliances, laundry and
// cleaning, climate, and the smart home's switches, sensors and locks. Everything is computed with
// the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on containers.
//
// The big appliances share one cabinet: bienes-raices' `laundry` body (the portrait keyline with
// the signature corner). The fridge, the oven, the dishwasher, the dryer and the stacked pair
// differ only by their doors and marks. The smart-home pieces (the light switches, the smart lock,
// the alarm panel, the keypad lock) share one wall plate. Badges are the engine's; a piece in front
// of another (the washer in front of the fridge, the robot on its dock) goes in `badge` and the
// engine clears what it covers.
import { arc, badge, circ, dot, f, flipPath, head, line, polar, rot, roundpoly, sq, turn, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import bienes from './bienes-raices.mjs';
import lugares from './lugares.mjs';
import producto from './producto.mjs';
import sistema from './sistema.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const dir = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
const BR = { square: ['br'] };
/** The badges' center (DESIGN.md › Badges): pivots for the badge motions. */
const BC = [17.25, 17.25];

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${pt(V)}`;
      continue;
    }
    const u = [A[0] - V[0], A[1] - V[1]];
    const v = [B[0] - V[0], B[1] - V[1]];
    const [lu, lv] = [Math.hypot(...u), Math.hypot(...v)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (v[0] / lv) * t, V[1] + (v[1] / lv) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');


/**
 * Where a path's edge crosses the abscissa `x` (its topmost crossing, or its lowest with
 * `bottom`): a piece that stands on a continuous corner (the pan on the stove's top) ends
 * exactly on its curve, so it touches the edge at every weight.
 */
function edgeY(d, x, bottom = false) {
  const ys = [];
  let cur = [0, 0];
  let start = [0, 0];
  const seg = (a, b) => {
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) ys.push(a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
  };
  for (const [, c, args] of transform(d, 1, 0, 0).matchAll(/([MLHVCAZ])([^MLHVCAZ]*)/g)) {
    const a = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (c === 'M') {
      cur = start = [a[0], a[1]];
      continue;
    }
    let pts = [];
    if (c === 'L') pts = [[a[0], a[1]]];
    else if (c === 'H') pts = [[a[0], cur[1]]];
    else if (c === 'V') pts = [[cur[0], a[0]]];
    else if (c === 'Z') pts = [start];
    else if (c === 'C') {
      const [p1, p2, p3] = [[a[0], a[1]], [a[2], a[3]], [a[4], a[5]]];
      for (let k = 1; k <= 64; k++) {
        const t = k / 64;
        const u = 1 - t;
        pts.push([0, 1].map((i) => u * u * u * cur[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]));
      }
    } else if (c === 'A') {
      // Circular arcs only (sq's corners): center from the endpoints, radius and sweep
      const [r, , , large, sweep] = a;
      const e = [a[5], a[6]];
      const m = [(cur[0] + e[0]) / 2, (cur[1] + e[1]) / 2];
      const half = Math.hypot(e[0] - cur[0], e[1] - cur[1]) / 2;
      const h = Math.sqrt(Math.max(0, r * r - half * half));
      const n = [-(e[1] - cur[1]) / (2 * half), (e[0] - cur[0]) / (2 * half)];
      const sg = large === sweep ? -1 : 1;
      const cc = [m[0] + sg * h * n[0], m[1] + sg * h * n[1]];
      const a0 = Math.atan2(cur[1] - cc[1], cur[0] - cc[0]);
      let da = Math.atan2(e[1] - cc[1], e[0] - cc[0]) - a0;
      if (sweep && da < 0) da += 2 * Math.PI;
      if (!sweep && da > 0) da -= 2 * Math.PI;
      for (let k = 1; k <= 32; k++) pts.push([cc[0] + r * Math.cos(a0 + (da * k) / 32), cc[1] + r * Math.sin(a0 + (da * k) / 32)]);
    }
    for (const p of pts) {
      seg(cur, p);
      cur = p;
    }
  }
  return bottom ? Math.max(...ys) : Math.min(...ys);
}

/** Capsule (stadium): a rectangle whose short ends are semicircles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** A rising wisp (steam, heat, mist): lugares' coffee steam, `h` tall from (x, y0) up, swaying `a`. */
const wisp = (x, y0, h, a = 0.8) => {
  const k = h / 4.25;
  return `M${pt([x, y0])}C${pt([x - a, y0 - 0.75 * k])} ${pt([x - a, y0 - 1.5 * k])} ${pt([x, y0 - 2.15 * k])}S${pt([x + a, y0 - 3.5 * k])} ${pt([x, y0 - h])}`;
};

/** A water drop, point up, on a circle of radius r centered at (cx, cy): lugares' droplet. */
function droplet(cx, cy, r) {
  const tip = [cx, cy - r * Math.SQRT2];
  return `M${pt(polar(cx, cy, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${pt(polar(cx, cy, r, -135))}L${pt(tip)}Z`;
}

/** Lugares' flame, scaled by `s` and standing with its base (its lowest point) at (cx, by). */
const FLAME = lugares.icons.flame.d[0];
const flame = (cx, by, s) => transform(FLAME, s, cx - 12 * s, by - 20.5 * s);

/**
 * The fan's rotor: a round hub and three blades swept clockwise, each a paddle that leaves the hub
 * on its rim and ends in a round tip (a circle of `wk` × R). `start` is the first blade's
 * direction; the others are the same blade turned 120° and 240°.
 */
function rotor(cx, cy, R, hub, { sweep = 26, half = 30, wk = 0.38, k = 0.42, start = -90 } = {}) {
  const w = R * wk;
  const ax = start + sweep;
  const C = polar(cx, cy, R - w, ax);
  const [Tl, Tr] = [add(C, mul(dir(ax - 90), w)), add(C, mul(dir(ax + 90), w))];
  const [P0, P1] = [polar(cx, cy, hub, start - half), polar(cx, cy, hub, start + half)];
  const [L0, L1] = [Math.hypot(Tl[0] - P0[0], Tl[1] - P0[1]) * k, Math.hypot(Tr[0] - P1[0], Tr[1] - P1[1]) * k];
  const blade = `M${pt(P0)}C${pt(add(P0, mul(dir(start - half), L0)))} ${pt(add(Tl, mul(dir(ax), -L0)))} ${pt(Tl)}A${f(w)} ${f(w)} 0 0 1 ${pt(Tr)}C${pt(add(Tr, mul(dir(ax), -L1)))} ${pt(add(P1, mul(dir(start + half), L1)))} ${pt(P1)}A${f(hub)} ${f(hub)} 0 0 0 ${pt(P0)}Z`;
  return [circ(cx, cy, hub), blade, turnPath(blade, 120, [cx, cy]), turnPath(blade, 240, [cx, cy])];
}

/**
 * The rotor as seen through a fan's guard: the hub and three curved vanes, one stroke each (closed
 * blades at this size fill in at heavy weights).
 */
function vanes(cx, cy, R, hub) {
  const vane = (a) => `M${pt(polar(cx, cy, hub, a))}A${f(R * 0.75)} ${f(R * 0.75)} 0 0 1 ${pt(polar(cx, cy, R, a + 55))}`;
  return [circ(cx, cy, hub), vane(-90), vane(30), vane(150)];
}

/**
 * Spiral of `halves` half turns, `s` apart, from radius r0: half circles around two centers s/2
 * apart, starting on the right and going over the top (an induction coil).
 */
function spiral(cx, cy, r0, s, halves) {
  let d = `M${pt([cx + r0, cy])}`;
  let r = r0;
  for (let k = 0; k < halves; k++) {
    const c = k % 2 ? [cx + s / 2, cy] : [cx, cy];
    d += `A${f(r)} ${f(r)} 0 0 0 ${pt(k % 2 ? [c[0] + r, c[1]] : [c[0] - r, c[1]])}`;
    r += s / 2;
  }
  return d;
}

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
/** bienes-raices' washer: the cabinet, its control band and slot, and the round door. */
const LAUNDRY = bienes.icons.laundry.d;
/** The big appliances' cabinet (4.75–19.25 × 2.75–21.25, radius 3.5, the signature corner). */
const CAB = LAUNDRY[0];
/** The control band across the cabinet's top, as the washer's. */
const BAND = LAUNDRY[1];
/** A door handle: a short vertical bar. */
const bar = (x, y0, y1) => line([x, y0], [x, y1]);
/** The fridge: the freezer door over the fridge door, a handle on each. */
const FRIDGE = [CAB, line([4.75, 10.75], [19.25, 10.75]), bar(8, 5.75, 7.75), bar(8, 13.75, 17.75)];
/**
 * A row of three knobs (the dense dots, r 0.3: two large ones read as a pair of eyes), 3.5 apart:
 * as solid discs of r + w/2 they stay apart at 2.1 (2.75 apart they touched).
 */
const knobs = (y) => [dot(8.5, y, 0.3), dot(12, y, 0.3), dot(15.5, y, 0.3)];
/** The oven: three knobs over the band, the handle bar and a wide window. */
const OVEN = [CAB, ...knobs(5.75), BAND, line([9, 11.75], [15, 11.75]), sq(8.25, 15, 7.5, 3.25, 1.25)];
/**
 * The dishwasher: the control band with its recessed handle (a short bar where the washer has its
 * slot) and three drops sprayed in an arc on the plain door. (A handle hanging under the band left
 * no room for three drops 3 apart.)
 */
const DISHWASHER = [CAB, BAND, line([10, 5.75], [14, 5.75]), droplet(12, 13.4, 1.2), droplet(8.85, 17.1, 1.2), droplet(15.15, 17.1, 1.2)];
/** Under a badge: one drop, clear of the badge's area (the others would be cut into slivers). */
const DISHWASHER_B = [...DISHWASHER.slice(0, 3), DISHWASHER[4]];
/** A drop knocked out of a fill: small enough that no island of ink is left inside it at any weight. */
const cutDrop = (d) => {
  const [, x, y] = /^M([\d.]+) ([\d.]+)/.exec(d).map(Number);
  return droplet(x - 1.2 * Math.SQRT1_2, y + 1.2 * Math.SQRT1_2, 0.6);
};
/** The dryer: the washer's body and door, its slot turned into three heat waves rising from the band. */
const DRYER = [CAB, BAND, LAUNDRY[3], wisp(8.7, 8.75, 3, 0.5), wisp(12, 8.75, 3, 0.5), wisp(15.3, 8.75, 3, 0.5)];
/**
 * The stove: a squat body (the cabinet's width and radius) with the oven's handle and window, and a
 * frying pan on its top, its sides ending on the body's curve and its handle reaching past the
 * edge. (Burner caps or grates standing on the top read as ears, a backpack or a loaf, and knobs
 * over the window as a face: the pan is what says a cooktop.)
 */
const STOVE_BODY = sq(4.75, 9.25, 14.5, 12, 3.5, BR);
/** The pan: its far corner square, where the handle leaves it (a rounded one left the handle 0.4 short). */
const PAN = rline([[6.75, edgeY(STOVE_BODY, 6.75)], [6.75, 6.25], [14.75, 6.25], [14.75, edgeY(STOVE_BODY, 14.75)]], [0, 1, 0, 0]);
/** The cooktop's plate (the square keyline). */
const PLATE = sq(3.25, 3.25, 17.5, 17.5, 4, BR);

/** Radius of a dome (an arc) of chord `w` and height `h`. */
const domeR = (w, h) => (w * w) / (8 * h) + h / 2;
/** A dome from x0 to x1 standing on `body`'s top edge (its ends on the body's curve), `h` high. */
const dome = (body, x0, x1, h) => {
  const r = domeR(x1 - x0, h);
  return `M${pt([x0, edgeY(body, x0)])}A${f(r)} ${f(r)} 0 0 1 ${pt([x1, edgeY(body, x1)])}`;
};
/** A cup or jug: a flat rim and a body with rounded bottom corners. */
const cup = (x, y, w, h, r = 1.75) => `M${pt([x, y])}H${f(x + w)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
/** A cup's handle on its right side, from y0 to y1 (a half loop). */
const cupHandle = (x, y0, y1) => {
  const r = (y1 - y0) / 2;
  return `M${pt([x, y0])}H${f(x + 0.5)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + 0.5, y1])}H${f(x)}`;
};
/**
 * A flame standing on (cx, by), `w` wide and `h` tall: a round foot, its main tip leaning right and a
 * second, smaller tip on its left. (A single tongue, or lugares' flame at this size, read as a drop.)
 */
const fire = (cx, by, w, h) => {
  const r = w / 2;
  const T = [cx + 0.12 * w, by - h];
  const S = [cx - 0.36 * w, by - 0.68 * h];
  const N = [cx - 0.1 * w, by - 0.5 * h];
  return `M${pt(T)}C${pt([cx + 0.2 * w, by - 0.72 * h])} ${pt([cx + r, by - 0.62 * h])} ${pt([cx + r, by - r])}A${f(r)} ${f(r)} 0 0 1 ${pt([cx - r, by - r])}C${pt([cx - r, by - 0.45 * h])} ${pt([cx - 0.45 * w, by - 0.58 * h])} ${pt(S)}C${pt([cx - 0.25 * w, by - 0.6 * h])} ${pt([cx - 0.18 * w, by - 0.55 * h])} ${pt(N)}C${pt([cx - 0.12 * w, by - 0.75 * h])} ${pt([cx, by - 0.85 * h])} ${pt(T)}Z`;
};
/**
 * A snowflake of three crossing arms (six ends), each end with a fork opening outward, as
 * dispositivos' hibernate snowflake; the forks keep 2.85 between them from R 4.5 up.
 */
const snowflake = (cx, cy, R) => [
  ...[90, 30, 150].map((a) => line(polar(cx, cy, R, a), polar(cx, cy, R, a + 180))),
  ...[0, 60, 120, 180, 240, 300].map((a) => {
    const v = polar(cx, cy, R * 0.62, a - 90);
    return line(polar(...v, R * 0.3, a - 118), v, polar(...v, R * 0.3, a - 62));
  }),
];
/** A rounded ice cube of side s centered at c, turned deg degrees. */
const cube = (c, s, deg) =>
  roundpoly(
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => rot([c[0] + (x * s) / 2, c[1] + (y * s) / 2], c, deg)),
    1.1,
  );
/** Where a path's left (or right, with `right`) edge crosses the ordinate `y`. */
const edgeX = (d, y, right = false) => edgeY(turnPath(d, 90), 24 - y, right);
/** The top of a dome (as `dome`) at abscissa x. */
const domeTop = (body, x0, x1, h, x) => {
  const r = domeR(x1 - x0, h);
  const cy = edgeY(body, x0) - h + r;
  return cy - Math.sqrt(r * r - (x - (x0 + x1) / 2) ** 2);
};

// ── Small appliances' bodies ──
const TOASTER = sq(2.75, 10.25, 16.5, 10.5, 3.5);
/** A slice of bread rising from the toaster: a rounded crown, its sides ending on the body. */
const slice = (x0, x1) => `M${pt([x0, edgeY(TOASTER, x0)])}V6A1.75 1.75 0 0 1 ${pt([x0 + 1.75, 4.25])}H${f(x1 - 1.75)}A1.75 1.75 0 0 1 ${pt([x1, 6])}V${f(edgeY(TOASTER, x1))}`;
const AIR_FRYER = roundpoly([[7.5, 2.75], [16.5, 2.75], [19, 21.25], [5, 21.25]], [3, 3, 2.5, 2.5]);
/** The rice cooker: a wide pot and its dome. (Narrower, with a loop on top and a slit on its front, it read as a padlock.) */
const RICE = sq(3.25, 11.25, 17.5, 10, 4);
const CROCK = sq(4.75, 10.75, 14.5, 10.5, 3.5);
const KETTLE = rline([[6, 20.25], [7.75, 7.75], [15.25, 7.75], [17, 20.25]], [0, 1.5, 1.5, 0]);
/** A point on the kettle's left (0) or right (1) side at height y. */
const kettleSide = (side, y) => [side ? 17 - ((20.25 - y) * 1.75) / 12.5 : 6 + ((20.25 - y) * 1.75) / 12.5, y];
const CAPSULE_BODY = sq(5.75, 5.25, 12.5, 16, 3.5, BR);
const MUG = cup(8.75, 13.5, 5, 7.75, 2);
const MUG_HANDLE = cupHandle(13.75, 15, 18.5);
/**
 * The ice maker's bin, open at the top, and its ice heaped in it, the top cube over the rim. (Two
 * cubes side by side in the bin, under a lid, read as a face; upright cubes, as stacked boxes.)
 */
const ICE_BIN = rline([[2.5, 9.25], [2.5, 21.25], [21.5, 21.25], [21.5, 9.25]], [0, 3, 0, 0]);
const ICE = [cube([8, 15.6], 4.25, -10), cube([16, 15.6], 4.25, -12), cube([12, 8.25], 4.25, 20)];
/**
 * The water filter: navegacion's funnel (the set's filter) on a short stem, the filtered drop under
 * it. (A cartridge read as a bottle, a can or a battery whatever its bands and neck.)
 */
const FUNNEL = roundpoly([[4.75, 2.75], [19.25, 2.75], [14, 9], [14, 12], [10, 12], [10, 9]], [1.75, 1.75, 1, 1, 1, 1]);

// ── Laundry care and cleaning ──
/**
 * The iron: limpieza's care-label iron (its nose curving up from the sole, the handle arching over
 * its back), copied as drawn there so both are the same iron, and the soleplate's seam across it.
 * (A trapezoid body under a box handle read as a hat.)
 */
const IRON = [
  'M9.5 10.25H19A1.75 1.75 0 0 1 20.75 12V17A1.25 1.25 0 0 1 19.5 18.25H3.75A1 1 0 0 1 2.95 17.1C3.5 13.75 6 10.25 9.5 10.25Z',
  'M11 10.25L11.92 7.3A1.5 1.5 0 0 1 13.35 6.25L17.75 6.25A1.5 1.5 0 0 1 19.25 7.75L19.25 10.25',
];
/** The handheld steamer: its tank flaring into the flat head, tilted up toward the front. */
const STEAMER = roundpoly([[9.5, 21.25], [9.5, 12.5], [6.25, 10], [15.75, 6], [17.25, 8.75], [14.5, 12.5], [14.5, 21.25]], [2, 1.5, 1, 1, 1.5, 1.5, 2]);
/** A point on the steam head's face, a fraction t along it. */
const steamFace = (t) => [6.25 + 9.5 * t, 10 - 4 * t];
const CANISTER = sq(12.25, 12.75, 9, 6.75, 3);
/** The stick vacuum's grip, motor and pole, drawn upright and leaned 18° on the floor head. */
const STICK = [rline([[10.75, 6.25], [10.75, 3.25], [13.25, 3.25], [13.25, 6.25]], [0, 1, 1, 0]), capsule(9.75, 6.25, 4.5, 7), line([12, 13.25], [12, 18.75])].map((d) =>
  turnPath(d, 18, [12, 18.75]),
);
const HANDHELD = capsule(9.25, 10.75, 11.5, 6.5);
/** The robot vacuum seen from above: its body, the bumper across its front third and the sensor turret. */
const robot = (cx, cy, r) => {
  const y = cy - r * 0.555;
  const dx = Math.sqrt(r * r - (y - cy) ** 2);
  return [circ(cx, cy, r), line([cx - dx, y], [cx + dx, y]), circ(cx, cy, r * 0.222)];
};
const ROBOT = robot(12, 12, 9);
/** Under a badge: the body and bumper (the badge's clearance cut the central turret into a hook). */
const ROBOT_B = ROBOT.slice(0, 2);
const DOCKED = robot(12, 13.75, 7.5);

// ── Climate ──
const AC = sq(2.5, 4.75, 19, 7.5, 3, BR);
/** Air slanting down out of the split unit's louver. */
const draft = (x) => line([x, 15.25], [x - 1.5, 19.75]);
const WATER_TANK = sq(6.5, 5.25, 11, 16, 4);
/**
 * The air filter: water-filter's funnel (the set's filter) over the air it cleans, lugares' wind
 * without its top line and turned to blow left, so a badge on the right takes the short line and
 * leaves the curl. (A frame with a mesh read as a crate and was too dense; a frame with a zigzag of
 * pleats read as the letters M or W; a round cartridge as a tin can.)
 */
const AIR = lugares.icons.wind.d.slice(1).map((d) => flipPath(transform(d, 1, 0, 2.75)));
const HOUSE = lugares.icons.house.d;
const THERMOMETER = lugares.icons.thermometer.d[0];

// ── The smart home ──
/** The smart home's wall plate: the switches, the lock and the alarm panel share it. */
const WALL = sq(5.75, 2.75, 12.5, 18.5, 3.5, BR);
/** The dimmer's knob on its track (in front: the engine clears the track around it). */
const DIMMER_KNOB = capsule(9.25, 9, 5.5, 3);
const DOOR = lugares.icons.door.d;
const DOOR_OPEN = lugares.icons['door-open'].d;
/** The contact sensor's two halves, one on each side of an edge at x, from y down. */
const halfBlock = (x, y, side) => rline([[x, y], [x + 3 * side, y], [x + 3 * side, y + 3.5], [x, y + 3.5]], [0, 1, 1, 0]);
const PLUG = sq(8.75, 6.75, 12, 12, 3.5);
const SMOKE_DOME = 'M6.5 3.25A5.5 3.5 0 0 0 17.5 3.25';
/**
 * The floodlight: the wall plate, its arm, and the lamp head flaring from the arm to its wide face,
 * turned 35° so the face looks down to the right; three beams fan out of the face's center, 45°
 * apart. (A level head with three parallel beams under it read as a shower.)
 */
const FLOOD = (() => {
  const pivot = [9.5, 9];
  const head_ = roundpoly(turn([[9.5, 6.75], [14.5, 4.75], [14.5, 13.25], [9.5, 11.25]], 35, pivot), [1, 0.75, 0.75, 1]);
  const [face] = turn([[14.5, 9]], 35, pivot);
  const beam = (deg) => line(polar(...face, 4.25, deg), polar(...face, 7.25, deg));
  return [sq(2.5, 6, 2.75, 6, 1.25), line([5.25, 9], pivot), head_, beam(-10), beam(35), beam(80)];
})();
const BULB_ON = sistema.icons['lightbulb-on'].d;
const APPLIANCE_FRIDGE = sq(3.25, 2.75, 10.5, 18.5, 3, BR);
const APPLIANCE_WASHER = [sq(10.25, 9.75, 10.5, 11.5, 3, BR), circ(15.5, 16, 2.75)];
/** A small wave, `w` wide, centered at (cx, y) (a water line). */
const wave = (cx, y, w = 7.5, a = 1) => {
  const q = w / 6;
  return `M${pt([cx - w / 2, y])}C${pt([cx - w / 2 + q, y - a])} ${pt([cx - q, y - a])} ${pt([cx, y])}S${pt([cx + w / 2 - q, y + a])} ${pt([cx + w / 2, y])}`;
};

const icons = {
  // ── Refrigeration ──
  fridge: {
    tags: ['refrigerador', 'nevera', 'congelador arriba', 'fridge', 'refrigerator', 'appliance'],
    d: FRIDGE,
  },
  'fridge-side-by-side': {
    tags: ['refrigerador dúplex', 'dos puertas', 'side by side', 'fridge', 'french door', 'refrigerator'],
    d: [CAB, line([12, 2.75], [12, 21.25]), bar(9, 8.5, 13), bar(15, 8.5, 13)],
  },
  'fridge-open': {
    tags: ['refrigerador abierto', 'puerta abierta', 'inventario', 'fridge open', 'door open', 'fridge inventory'],
    // The cabinet seen open: its door swung past the front, hinged on the left edge (which is
    // straight, as the hinge), and two shelves inside
    d: [
      sq(8.25, 2.75, 11, 18.5, 3.5, { square: ['br', 'tl', 'bl'] }),
      roundpoly([[8.25, 2.75], [3.5, 5.25], [3.5, 18.75], [8.25, 21.25]], [0, 1.25, 1.25, 0]),
      line([8.25, 9], [19.25, 9]),
      line([8.25, 15], [19.25, 15]),
    ],
  },
  'mini-fridge': {
    tags: ['frigobar', 'minibar', 'refrigerador pequeño', 'mini fridge', 'minibar', 'bar fridge'],
    // Squat and low on two feet, one door with its handle on the left near the top, where the
    // fridge has its own (on the right it read as a television on legs)
    d: [sq(5.5, 6.75, 13, 12.25, 3, BR), line([8.5, 19], [8.5, 21.25]), line([15.5, 19], [15.5, 21.25]), bar(8.75, 9.75, 13.75)],
  },
  freezer: {
    tags: ['congelador', 'arcón', 'congelados', 'freezer', 'chest freezer', 'frozen'],
    // A chest: the lid along the top and a grip recessed under its front edge
    d: [sq(2.5, 7.75, 19, 11, 3, BR), line([2.5, 10.75], [21.5, 10.75]), rline([[10, 10.75], [10, 13.75], [14, 13.75], [14, 10.75]], [0, 1, 1, 0])],
  },
  'wine-cooler': {
    tags: ['cava de vinos', 'enfriador de vino', 'vinoteca', 'wine cooler', 'wine fridge', 'bar'],
    // A narrow cabinet with a wine glass on its door and a drawer under it. (Rack lines ending in
    // bottle bases read as a bulleted list at 18 px.)
    d: [sq(5.75, 2.75, 12.5, 18.5, 3.5, BR), 'M9.5 6.25H14.5A2.5 2.5 0 0 1 9.5 6.25Z', line([12, 8.75], [12, 12.75]), line([10, 12.75], [14, 12.75]), line([5.75, 15.75], [18.25, 15.75])],
  },

  // ── Cooking ──
  oven: {
    tags: ['horno', 'hornear', 'cocina', 'oven', 'bake', 'kitchen'],
    d: OVEN,
  },
  'oven-convection': {
    tags: ['horno de convección', 'aire caliente', 'ventilador', 'convection', 'fan oven', 'hot air'],
    // The window and its handle give way to the fan's rotor, one blade up
    d: [...OVEN.slice(0, 5), ...rotor(12, 15.25, 3.75, 0.8)],
  },
  stove: {
    tags: ['estufa', 'cocina', 'quemadores', 'stove', 'range', 'cooker'],
    // The pan on the cooktop, its handle past the edge; the oven's handle and window below
    d: [STOVE_BODY, PAN, line([14.75, 6.25], [21.5, 4.75]), line([8.5, 12.25], [15.5, 12.25]), sq(8.25, 15.25, 7.5, 3, 1.25)],
  },
  cooktop: {
    tags: ['parrilla', 'cubierta', 'quemadores', 'cooktop', 'hob', 'burners'],
    // Two large and two small rings, diagonally opposed, 3 from the plate and from each other
    d: [PLATE, circ(8.5, 8.5, 1.9), circ(15.75, 8.25, 1.25), circ(8.25, 15.75, 1.25), circ(15.5, 15.5, 1.9)],
  },
  'induction-cooktop': {
    tags: ['parrilla de inducción', 'inducción', 'vitrocerámica', 'induction', 'induction hob', 'cooktop'],
    // One large zone drawn as its coil (a spiral, 3 between turns) and a touch slider along the front
    d: [PLATE, spiral(12, 11, 1.5, 3, 3), line([8, 17.5], [16, 17.5])],
  },
  microwave: {
    tags: ['microondas', 'calentar', 'cocina', 'microwave', 'reheat', 'kitchen'],
    // The door's window on the left; the control column on the right, a keypad of three dots
    d: [sq(2.5, 5, 19, 14, 3.5, BR), line([15.75, 5], [15.75, 19]), sq(5.5, 8, 7.25, 8, 1.75), dot(18.63, 8.5, 0.3), dot(18.63, 11.85, 0.3), dot(18.63, 15.2, 0.3)],
  },
  'gas-burner': {
    tags: ['quemador de gas', 'flama', 'gas', 'gas burner', 'flame', 'gas stove'],
    // A flat cap on a short base, three flames rising from it; they light up as levels, the tall
    // one first
    d: [
      capsule(3.75, 13.75, 16.5, 3.25),
      line([8.5, 20], [15.5, 20]),
      fire(12, 13.75, 4, 8),
      turnPath(fire(6.5, 13.75, 3.25, 6), -8, [6.5, 13.75]),
      turnPath(fire(17.5, 13.75, 3.25, 6), 8, [17.5, 13.75]),
    ],
  },
  'range-hood': {
    tags: ['campana', 'extractor', 'ventilación', 'range hood', 'extractor hood', 'vent hood'],
    d: [
      roundpoly([[9, 9.25], [15, 9.25], [20.75, 14.75], [20.75, 17.25], [3.25, 17.25], [3.25, 14.75]], [1, 1, 1.5, 1, 1, 1.5]),
      rline([[9.75, 9.25], [9.75, 2.75], [14.25, 2.75], [14.25, 9.25]], [0, 1, 1, 0]),
      line([10, 20.25], [14, 20.25]),
    ],
  },
  toaster: {
    tags: ['tostador', 'pan tostado', 'desayuno', 'toaster', 'toast', 'breakfast'],
    // Two slices rising from the slots (their sides end on the body's curve) and the lever on the side
    d: [TOASTER, slice(5.5, 10), slice(13.25, 17.75), line([19.25, 15.5], [21.75, 15.5])],
  },
  'toaster-oven': {
    tags: ['horno eléctrico', 'horno tostador', 'hornito', 'toaster oven', 'countertop oven', 'electric oven'],
    d: [sq(2.5, 6, 19, 12, 3, BR), line([7.5, 18], [7.5, 20.25]), line([16.5, 18], [16.5, 20.25]), sq(5.5, 9, 9.5, 6, 1.5), line([5.5, 12], [15, 12]), dot(18.25, 9.75), dot(18.25, 14.25)],
  },
  'air-fryer': {
    tags: ['freidora de aire', 'freír sin aceite', 'cocina', 'air fryer', 'fryer', 'kitchen'],
    // Wider at its base; the lower half is the basket drawer with its handle, the dial on top
    d: [AIR_FRYER, line([edgeX(AIR_FRYER, 11.75), 11.75], [edgeX(AIR_FRYER, 11.75, true), 11.75]), line([9.5, 15.75], [14.5, 15.75]), circ(12, 7.25, 1.5)],
  },
  'rice-cooker': {
    tags: ['olla arrocera', 'arrocera', 'arroz', 'rice cooker', 'rice', 'cooker'],
    // The wide pot, its dome lid with a small grip on top, the switch a slot across its front
    d: [RICE, dome(RICE, 4.25, 19.75, 4), rline([[10.5, domeTop(RICE, 4.25, 19.75, 4, 10.5)], [10.5, 4.25], [13.5, 4.25], [13.5, domeTop(RICE, 4.25, 19.75, 4, 13.5)]], [0, 0.75, 0.75, 0]), line([9.5, 16.25], [14.5, 16.25])],
  },
  multicooker: {
    tags: ['olla de presión eléctrica', 'olla multifunción', 'instant pot', 'multicooker', 'pressure cooker', 'instant pot'],
    // A straight pot under an overhanging lid with its steam valve, the control panel on the front
    d: [
      sq(3.75, 6.75, 16.5, 3.5, 1.75),
      rline([[5.25, 10.25], [5.25, 21.25], [18.75, 21.25], [18.75, 10.25]], [0, 3, 3, 0]),
      rline([[13.75, 6.75], [13.75, 4.25], [16.25, 4.25], [16.25, 6.75]], [0, 0.75, 0.75, 0]),
      sq(9, 13.25, 6, 4.5, 1.25),
    ],
  },
  'slow-cooker': {
    tags: ['olla de cocción lenta', 'crock pot', 'guisos', 'slow cooker', 'crockpot', 'stew'],
    d: [
      CROCK,
      `M${pt([edgeX(CROCK, 13.75), 13.75])}H3.25A1.25 1.25 0 0 0 3.25 16.25H${f(edgeX(CROCK, 16.25))}`,
      `M${pt([edgeX(CROCK, 13.75, true), 13.75])}H20.75A1.25 1.25 0 0 1 20.75 16.25H${f(edgeX(CROCK, 16.25, true))}`,
      dome(CROCK, 6.25, 17.75, 4),
      dot(12, 3.75),
      circ(12, 16, 1.5),
    ],
  },
  blender: {
    tags: ['licuadora', 'licuar', 'batidos', 'blender', 'smoothie', 'blend'],
    d: [
      roundpoly([[6.25, 5.75], [17.75, 5.75], [15.25, 14.25], [8.75, 14.25]], [1, 1, 1, 1]),
      rline([[10, 5.75], [10, 2.75], [14, 2.75], [14, 5.75]], [0, 1, 1, 0]),
      sq(6.75, 14.25, 10.5, 7, 2.5, BR),
      dot(12, 17.75),
      line([11, 9.85], [13, 11.35]),
      line([13, 9.85], [11, 11.35]),
    ],
  },
  'food-processor': {
    tags: ['procesador de alimentos', 'picadora', 'triturar', 'food processor', 'chopper', 'chop'],
    d: [
      roundpoly([[4.75, 8.25], [19.25, 8.25], [16.25, 15.25], [7.75, 15.25]], [1.5, 1.5, 0.5, 0.5]),
      sq(4.75, 15.25, 14.5, 6, 1.75, BR),
      rline([[13.25, 8.25], [13.25, 3.25], [16.75, 3.25], [16.75, 8.25]], [0, 1, 1, 0]),
      'M10 12.25C11 12.25 11.25 11.75 12 11.75S13 11.25 14 11.25',
    ],
  },
  'stand-mixer': {
    tags: ['batidora de pedestal', 'amasadora', 'repostería', 'stand mixer', 'mixer', 'baking'],
    // In profile: the head over the column and base, its beater hanging into the bowl
    d: [
      capsule(3.75, 2.75, 17, 6.25),
      line([5.75, edgeY(capsule(3.75, 2.75, 17, 6.25), 5.75, true)], [5.75, 20.75]),
      line([9.25, 9], [9.25, 20.75]),
      line([3.75, 20.75], [19.75, 20.75]),
      'M10.75 12.25H20.25A4.75 4.75 0 0 1 10.75 12.25Z',
      line([15.5, 9], [15.5, 14]),
    ],
  },
  'hand-mixer': {
    tags: ['batidora de mano', 'batir', 'repostería', 'hand mixer', 'whisk', 'baking'],
    d: [
      sq(3.25, 8, 17.5, 5.25, 2.6),
      rline([[7.25, 8], [7.25, 3.25], [16.75, 3.25], [16.75, 8]], [0, 2, 2, 0]),
      line([9, 13.25], [9, 16.25]),
      line([15, 13.25], [15, 16.25]),
      'M9 16.25A1.5 2.25 0 1 0 9 20.75A1.5 2.25 0 1 0 9 16.25Z',
      'M15 16.25A1.5 2.25 0 1 0 15 20.75A1.5 2.25 0 1 0 15 16.25Z',
    ],
  },
  'coffee-grinder': {
    tags: ['molino de café', 'moler café', 'café', 'coffee grinder', 'grind', 'coffee'],
    d: [
      roundpoly([[3.75, 2.75], [12.75, 2.75], [10.75, 8.25], [5.75, 8.25]], [1, 1, 0.5, 0.5]),
      sq(3.25, 8.25, 10, 13, 1.5, BR),
      rline([[13.25, 13], [17.25, 13], [17.25, 14.5]], [0, 1, 0]),
      rline([[16.25, 17.5], [16.25, 21.25], [21.25, 21.25], [21.25, 17.5]], [0, 1.5, 1.5, 0]),
    ],
  },
  kettle: {
    tags: ['hervidor', 'tetera eléctrica', 'agua caliente', 'kettle', 'electric kettle', 'boil'],
    // The jug on its base plate, the spout on one side and the tall handle on the other
    d: [KETTLE, line([4.25, 20.25], [19.75, 20.25]), line(kettleSide(0, 12.5), [3.25, 9.25]), rline([kettleSide(1, 9.75), [19.75, 9.75], [19.75, 16.5], kettleSide(1, 16.5)], [0, 1.5, 1.5, 0]), dot(11.5, 4.75)],
  },
  'coffee-maker': {
    tags: ['cafetera', 'cafetera de goteo', 'café', 'coffee maker', 'drip coffee', 'coffee'],
    // The machine as an upside-down L (the tank's column and the overhanging head), the carafe under it
    d: [
      roundpoly([[3.75, 21.25], [3.75, 2.75], [19.75, 2.75], [19.75, 7.75], [9.25, 7.75], [9.25, 21.25]], [1.5, 2, 2, 1, 1, 1.5]),
      roundpoly([[13.5, 10.75], [17.5, 10.75], [18.75, 14], [18.75, 21.25], [12.25, 21.25], [12.25, 14]], [0.75, 0.75, 1.5, 1.5, 1.5, 1.5]),
      'M18.75 14.75H19.25A1.5 1.5 0 0 1 20.75 16.25V17.25A1.5 1.5 0 0 1 19.25 18.75H18.75',
    ],
  },
  'espresso-machine': {
    tags: ['máquina de espresso', 'cafetera espresso', 'barista', 'espresso machine', 'espresso', 'barista'],
    // In profile: the group head with its portafilter's handle sticking out, a cup on the drip tray
    d: [
      roundpoly([[3.25, 2.75], [15.75, 2.75], [15.75, 8.75], [9.75, 8.75], [9.75, 18.25], [20.75, 18.25], [20.75, 21.25], [3.25, 21.25]], [2, 2, 1, 1, 1, 1, 1, 2]),
      rline([[11.25, 8.75], [11.25, 11.25], [21, 11.25]], [0, 1, 0]),
      line([14.75, 8.75], [14.75, 11.25]),
      cup(12.75, 14.75, 4.25, 3.5, 1.5),
      cupHandle(17, 15.25, 17.75),
    ],
  },
  'capsule-coffee-machine': {
    tags: ['cafetera de cápsulas', 'cápsulas', 'café', 'capsule coffee machine', 'pod coffee', 'coffee pods'],
    // Slim and tall, its lever along the top; the mug stands in front of its foot (on top: the
    // engine clears the body's whole foot around it, so no sliver of a corner is left)
    d: [CAPSULE_BODY, rline([[8.75, edgeY(CAPSULE_BODY, 8.75)], [8.75, 2.75], [15.75, 2.75]], [0, 1, 0])],
    badge: { d: [MUG, MUG_HANDLE], knock: `${MUG}M4.5 18H19.5V22.5H4.5Z`, fill: { solid: [MUG], wire: [MUG_HANDLE] } },
  },
  'ice-maker': {
    tags: ['máquina de hielo', 'hielera', 'cubos de hielo', 'ice maker', 'ice', 'ice cubes'],
    // The open bin and the ice it made, heaped in it
    d: [ICE_BIN, ...ICE],
  },
  'water-filter': {
    tags: ['filtro de agua', 'cartucho', 'cambiar filtro', 'water filter', 'filter cartridge', 'replace filter'],
    // The filter and the filtered drop under it
    d: [FUNNEL, droplet(12, 18.5, 2.5)],
  },
  'water-tank': {
    tags: ['tanque de agua', 'depósito', 'nivel de agua', 'water tank', 'reservoir', 'refill'],
    // Three waves inside light up as levels, from the bottom
    d: [sq(5.25, 6.25, 13.5, 15, 3.5, BR), rline([[9, 6.25], [9, 3], [15, 3], [15, 6.25]], [0, 1.5, 1.5, 0]), wave(12, 17.75), wave(12, 14.25), wave(12, 10.75)],
  },

  // ── Dishwashing and laundry ──
  dishwasher: {
    tags: ['lavavajillas', 'lavaplatos', 'trastes', 'dishwasher', 'dishes', 'appliance'],
    d: DISHWASHER,
  },
  dryer: {
    tags: ['secadora', 'secar ropa', 'lavandería', 'dryer', 'tumble dryer', 'laundry'],
    // The washer's body and door; three heat waves rise from the band where its slot was (the
    // door, r 3.5, has no room for them with the set's clearance)
    d: DRYER,
  },
  'washer-dryer': {
    tags: ['lavadora y secadora', 'torre de lavado', 'apiladas', 'washer dryer', 'stacked laundry', 'laundry'],
    d: [CAB, line([4.75, 12], [19.25, 12]), circ(12, 7.38, 2.25), circ(12, 16.63, 2.25)],
  },
  iron: {
    tags: ['plancha', 'planchar', 'ropa', 'iron', 'ironing', 'clothes'],
    // In profile: the body, the handle over its back and the soleplate's seam, from nose to heel
    d: [...IRON, line([edgeX(IRON[0], 15.25), 15.25], [20.75, 15.25])],
  },
  'garment-steamer': {
    tags: ['vaporizador de ropa', 'vaporera', 'desarrugar', 'garment steamer', 'steamer', 'clothes'],
    // The tank, its water line, flaring into the head; the steam rises off its face
    d: [STEAMER, line([9.5, 15.5], [14.5, 15.5]), ...[0.25, 0.62].map((t) => turnPath(wisp(...steamFace(t), 3.75, 0.6), -23, steamFace(t)))],
  },
  'vacuum-cleaner': {
    tags: ['aspiradora', 'aspirar', 'limpieza', 'vacuum cleaner', 'vacuum', 'cleaning'],
    // The canister on its wheel, the hose arching up into the wand and down to the floor nozzle
    d: [
      CANISTER,
      circ(18.25, 19.75, 1.5),
      `M${pt([13.75, edgeY(CANISTER, 13.75)])}C13.75 6.5 9.5 4 7.25 4.75L4.75 18.75`,
      roundpoly([[2.75, 18.75], [8.25, 18.75], [8.25, 21.25], [2.75, 21.25]], 1),
    ],
  },
  'upright-vacuum': {
    tags: ['aspiradora vertical', 'aspirar', 'alfombra', 'upright vacuum', 'vacuum', 'carpet'],
    // The bag standing on the wide floor head, its handle rising from the top and hooking forward
    d: [rline([[12, 9.25], [12, 2.75], [15.5, 2.75]], [0, 1, 0]), sq(8.75, 9.25, 6.5, 8.5, 2.5), sq(4.75, 17.75, 14.5, 3.5, 1.75)],
  },
  'stick-vacuum': {
    tags: ['aspiradora de bastón', 'inalámbrica', 'aspirar', 'stick vacuum', 'cordless vacuum', 'vacuum'],
    d: [...STICK, sq(5.75, 18.75, 12.5, 2.5, 1.25)],
  },
  'handheld-vacuum': {
    tags: ['aspiradora de mano', 'aspiradora portátil', 'migajas', 'handheld vacuum', 'dustbuster', 'car vacuum'],
    d: [
      HANDHELD,
      rline([[13, 10.75], [13, 6.5], [19.5, 6.5], [19.5, edgeY(HANDHELD, 19.5)]], [0, 1.5, 1.5, 0]),
      rline([[edgeX(HANDHELD, 11.5), 11.5], [3.25, 12.75], [3.25, 15.25], [edgeX(HANDHELD, 16.5), 16.5]], [0, 0.75, 0.75, 0]),
    ],
  },
  'robot-vacuum': {
    tags: ['robot aspirador', 'aspiradora robot', 'limpieza automática', 'robot vacuum', 'roomba', 'robot cleaner'],
    d: ROBOT,
  },
  'robot-vacuum-dock': {
    tags: ['base de carga', 'robot en su base', 'cargando', 'robot dock', 'charging base', 'return to base'],
    // The dock behind the robot's top edge (the robot in front: the engine clears the dock around it)
    d: [sq(3.25, 3.25, 17.5, 5.5, 2.75)],
    badge: { d: DOCKED, knock: DOCKED[0], fill: { solid: [DOCKED[0]], cut: DOCKED.slice(1) } },
  },
  'robot-vacuum-route': {
    tags: ['ruta de limpieza', 'mapa de limpieza', 'zonas', 'cleaning route', 'cleaning map', 'zone cleaning'],
    // The room, the robot's back-and-forth path and the robot at its end
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, BR), 'M7.25 7.75H14.5A2.25 2.25 0 0 1 14.5 12.25H9.5A2.25 2.25 0 0 0 9.5 16.75H13', circ(14.75, 16.75, 1.75)],
  },

  // ── Climate ──
  'air-conditioner': {
    tags: ['aire acondicionado', 'minisplit', 'clima', 'air conditioner', 'ac', 'cooling'],
    // The split unit with its louver, the air slanting down out of it
    d: [AC, line([2.5, 9.25], [21.5, 9.25]), draft(8), draft(12.75), draft(17.5)],
  },
  'portable-air-conditioner': {
    tags: ['aire acondicionado portátil', 'clima portátil', 'enfriar', 'portable air conditioner', 'portable ac', 'cooling'],
    // On casters, its grille at the top and the exhaust duct bending up from its back
    d: [
      sq(3.25, 4.25, 10.5, 15.5, 3, BR),
      line([6.25, 7.75], [10.75, 7.75]),
      line([6.25, 10.75], [10.75, 10.75]),
      line([6, 19.75], [6, 21.75]),
      line([11, 19.75], [11, 21.75]),
      'M13.75 9.75A3 3 0 0 0 16.75 6.75V2.5',
      'M13.75 12.75A6 6 0 0 0 19.75 6.75V2.5',
    ],
  },
  'window-air-conditioner': {
    tags: ['aire de ventana', 'clima de ventana', 'enfriar', 'window air conditioner', 'window ac', 'cooling'],
    // Seated on the sill: the grille's slats on the left, two knobs on the right
    d: [sq(3.75, 5.75, 16.5, 12, 3, BR), line([2.25, 17.75], [21.75, 17.75]), line([7.25, 8.75], [12.75, 8.75]), line([7.25, 11.75], [12.75, 11.75]), line([7.25, 14.75], [12.75, 14.75]), dot(16.5, 9.25), dot(16.5, 14.25)],
  },
  'heat-pump': {
    tags: ['bomba de calor', 'condensador', 'unidad exterior', 'heat pump', 'condenser', 'outdoor unit'],
    // On two feet: the fan's round grille with its hub, and two fins (a third had no room 3 apart)
    d: [sq(2.5, 5, 19, 12.5, 3, BR), line([6.5, 17.5], [6.5, 19.75]), line([17.5, 17.5], [17.5, 19.75]), circ(8.25, 11.25, 3.25), dot(8.25, 11.25), line([14.75, 8], [14.75, 14.5]), line([17.75, 8], [17.75, 14.5])],
  },
  fan: {
    tags: ['ventilador', 'aspas', 'ventilación', 'fan', 'ventilation', 'fan mode'],
    d: rotor(12, 12, 9, 1.75),
  },
  'fan-speed': {
    tags: ['velocidad del ventilador', 'potencia', 'nivel', 'fan speed', 'fan level', 'airflow'],
    // The rotor and three bars rising beside it, lit as levels
    d: [...rotor(7.25, 12, 5.25, 1.25, { wk: 0.4 }), line([15.25, 17.5], [15.25, 14.5]), line([18.25, 17.5], [18.25, 11.5]), line([21.25, 17.5], [21.25, 8.5])],
  },
  'fan-oscillate': {
    tags: ['oscilación', 'girar ventilador', 'vaivén', 'oscillate', 'swing', 'fan'],
    // The rotor over a two-headed arc: it swings side to side
    d: (() => {
      const [a, b] = [arc(12, 9, 10.5, 55, 125), arc(12, 9, 10.5, 125, 55)];
      return [...rotor(12, 8.75, 6.25, 1.25), a.d, head(a.end, a.tangent, 3.4), head(b.end, b.tangent, 3.4)];
    })(),
  },
  'desk-fan': {
    tags: ['ventilador de escritorio', 'ventilador de mesa', 'aire', 'desk fan', 'table fan', 'fan'],
    d: [circ(12, 9.25, 6.75), ...vanes(12, 9.25, 3.75, 0.8), line([12, 16], [12, 18.75]), capsule(7, 18.75, 10, 2.5)],
  },
  'pedestal-fan': {
    tags: ['ventilador de pedestal', 'ventilador de pie', 'aire', 'pedestal fan', 'standing fan', 'fan'],
    d: [circ(12, 8.25, 6.25), ...vanes(12, 8.25, 3.25, 0.75), line([12, 14.5], [12, 18.75]), 'M7.25 21.25A4.75 2.5 0 0 1 16.75 21.25Z'],
  },
  'ceiling-fan': {
    tags: ['ventilador de techo', 'abanico de techo', 'lámpara', 'ceiling fan', 'fan', 'ceiling'],
    // Hanging from the ceiling: the rod, the motor and its two long blades level (one outline), and
    // the light under it
    d: [
      line([8.5, 3.25], [15.5, 3.25]),
      line([12, 3.25], [12, 7.75]),
      roundpoly(
        [[10.5, 7.75], [13.5, 7.75], [14.5, 8.25], [20.5, 8], [21.25, 9.75], [14.5, 10.25], [13.5, 10.75], [10.5, 10.75], [9.5, 10.25], [2.75, 9.75], [3.5, 8], [9.5, 8.25]],
        [1, 1, 0.5, 0.75, 0.75, 0.5, 1, 1, 0.5, 0.75, 0.75, 0.5],
      ),
      'M9.25 13.75A2.75 2.75 0 0 0 14.75 13.75Z',
    ],
  },
  'tower-fan': {
    tags: ['ventilador de torre', 'columna', 'aire', 'tower fan', 'column fan', 'fan'],
    d: ['M8.75 18.25V6A3.25 3.25 0 0 1 15.25 6V18.25', sq(6.25, 18.25, 11.5, 3, 1.5), line([12, 8.75], [12, 15.25])],
  },
  'space-heater': {
    tags: ['calentador', 'calefactor', 'estufa eléctrica', 'space heater', 'heater', 'heating'],
    d: [sq(5.75, 9.75, 12.5, 11.5, 3, BR), line([8.75, 12.75], [8.75, 18.25]), line([12, 12.75], [12, 18.25]), line([15.25, 12.75], [15.25, 18.25]), wisp(8.5, 6.75, 4, 0.5), wisp(12, 6.75, 4, 0.5), wisp(15.5, 6.75, 4, 0.5)],
  },
  'heated-floor': {
    tags: ['piso radiante', 'calefacción de piso', 'suelo radiante', 'heated floor', 'underfloor heating', 'radiant floor'],
    // Heat rising from the floor, the pipe winding under it
    d: [
      line([2.75, 13.25], [21.25, 13.25]),
      wisp(7, 13.25, 7, 0.7),
      wisp(12, 13.25, 7, 0.7),
      wisp(17, 13.25, 7, 0.7),
      'M4.5 16.5V19A1.5 1.5 0 0 0 7.5 19V18A1.5 1.5 0 0 1 10.5 18V19A1.5 1.5 0 0 0 13.5 19V18A1.5 1.5 0 0 1 16.5 18V19A1.5 1.5 0 0 0 19.5 19V16.5',
    ],
  },
  humidifier: {
    tags: ['humidificador', 'vapor', 'humedad', 'humidifier', 'mist', 'humidity'],
    // A rounded body with its water, a drop, and the mist rising over it. (A drop-shaped body with
    // mist read as a bomb's fuse.)
    d: [sq(6.5, 9.5, 11, 11.75, 4), droplet(12, 15.75, 2), wisp(10.25, 6.5, 4, 0.6), wisp(13.75, 6.5, 4, 0.6)],
  },
  dehumidifier: {
    tags: ['deshumidificador', 'humedad', 'secar aire', 'dehumidifier', 'humidity', 'damp'],
    // The grille on top and the tank, a drop, on its front
    d: [sq(5.25, 3.25, 13.5, 18, 3.5, BR), line([9, 6.25], [9, 8.5]), line([12, 6.25], [12, 8.5]), line([15, 6.25], [15, 8.5]), droplet(12, 15.75, 2.75)],
  },
  'air-purifier': {
    tags: ['purificador de aire', 'aire limpio', 'filtrar aire', 'air purifier', 'clean air', 'purifier'],
    // Tall and rounded: the intake low on its front, clean air rising straight out of its top.
    // (Fanned out, the air read as sistema's siren.)
    d: [
      'M7.5 13.5A4.5 4.5 0 0 1 16.5 13.5V19.25A2 2 0 0 1 14.5 21.25H9.5A2 2 0 0 1 7.5 19.25Z',
      line([10.5, 15.25], [13.5, 15.25]),
      line([10.5, 18.25], [13.5, 18.25]),
      line([9, 6], [9, 3]),
      line([12, 6], [12, 2.25]),
      line([15, 6], [15, 3]),
    ],
  },
  'air-filter': {
    tags: ['filtro de aire', 'cambiar filtro', 'hvac', 'air filter', 'replace filter', 'hvac'],
    // The filter and the air under it
    d: [FUNNEL, ...AIR],
  },
  'air-vent': {
    tags: ['rejilla de ventilación', 'ventila', 'flujo de aire', 'air vent', 'register', 'airflow'],
    d: [sq(3.25, 9.25, 17.5, 12, 3, BR), line([6.75, 12.25], [17.25, 12.25]), line([6.75, 15.25], [17.25, 15.25]), line([6.75, 18.25], [17.25, 18.25]), wisp(7.75, 6.25, 3.25, 0.5), wisp(12, 6.25, 3.25, 0.5), wisp(16.25, 6.25, 3.25, 0.5)],
  },
  'heat-cool': {
    tags: ['calor y frío', 'modo automático', 'clima', 'heat cool', 'auto mode', 'climate'],
    d: [fire(6.75, 17, 6.5, 10.5), ...snowflake(17, 12, 4.75)],
  },
  defrost: {
    tags: ['descongelar', 'deshielo', 'congelador', 'defrost', 'thaw', 'freezer'],
    // The snowflake melting into a drop
    d: [...snowflake(12, 6.75, 4.75), droplet(12, 18.25, 2.5)],
  },
  thermostat: {
    tags: ['termostato', 'temperatura', 'calefacción', 'thermostat', 'temperature', 'climate'],
    // The face, its dial open at the bottom and the set point on it (a value turns it)
    d: [circ(12, 12, 9), arc(12, 12, 5.5, 135, 405).d, dot(...polar(12, 12, 5.5, 320))],
  },
  'water-heater': {
    tags: ['calentador de agua', 'boiler', 'agua caliente', 'water heater', 'boiler', 'hot water'],
    // The tank, its two pipes and the burner's flame at its base
    d: [WATER_TANK, line([10, edgeY(WATER_TANK, 10)], [10, 2.75]), line([14, edgeY(WATER_TANK, 14)], [14, 2.75]), fire(12, 18.25, 4, 6.5)],
  },
  'house-temperature': {
    tags: ['temperatura interior', 'temperatura de la casa', 'termómetro', 'indoor temperature', 'home temperature', 'thermometer'],
    // Lugares' house, its door and window giving way to lugares' thermometer at half size
    d: [HOUSE[0], HOUSE[1], transform(THERMOMETER, 0.5, 6, 19.25 - 21.75 * 0.5)],
  },
  'hand-dryer': {
    tags: ['secador de manos', 'baño', 'secar manos', 'hand dryer', 'restroom', 'dry hands'],
    d: [sq(4.25, 3.75, 15.5, 9.5, 3, BR), rline([[10, 13.25], [10.5, 15.25], [13.5, 15.25], [14, 13.25]], [0, 0.5, 0.5, 0]), line([9, 18.25], [9, 21]), line([12, 18.25], [12, 21]), line([15, 18.25], [15, 21])],
  },
  // ── The smart home ──
  'smart-plug': {
    tags: ['enchufe inteligente', 'contacto inteligente', 'domótica', 'smart plug', 'smart outlet', 'home automation'],
    // In profile: the prongs from its left side and the button on its top
    d: [PLUG, line([3.25, 10.25], [8.75, 10.25]), line([3.25, 15.25], [8.75, 15.25]), dome(PLUG, 12.25, 17.25, 2.75)],
  },
  'light-switch': {
    tags: ['apagador', 'interruptor', 'luz', 'light switch', 'switch', 'lights'],
    // The rocker on the wall plate, split where it pivots
    d: [WALL, sq(9, 7, 6, 10, 2), line([9, 12], [15, 12])],
  },
  'light-switch-double': {
    tags: ['apagador doble', 'interruptor doble', 'dos luces', 'double switch', 'two-gang switch', 'lights'],
    // Two rockers side by side in the same opening. (Each split as well, they read as a window.)
    d: [WALL, sq(8.75, 7, 6.5, 10, 2), line([12, 7], [12, 17])],
  },
  'light-switch-dimmer': {
    tags: ['atenuador', 'regulador de luz', 'dimmer', 'dimmer switch', 'brightness', 'lights'],
    d: [WALL, line([12, 6.25], [12, 17.75])],
    badge: { d: [DIMMER_KNOB], knock: DIMMER_KNOB, fill: { solid: [DIMMER_KNOB] } },
  },
  'smart-lock': {
    tags: ['cerradura inteligente', 'chapa inteligente', 'domótica', 'smart lock', 'deadbolt', 'door lock'],
    // The thumb-turn in the plate's upper half: the rose and the bar across it (a value turns the
    // bar), small and high enough that a badge leaves it whole
    d: [WALL, circ(12, 9, 2.75), line([12, 5.6], [12, 12.4])],
  },
  'keypad-lock': {
    tags: ['cerradura con teclado', 'chapa digital', 'código', 'keypad lock', 'code lock', 'door lock'],
    // The keypad over the lever handle (the plate moved left so the lever has room)
    d: [sq(3.25, 2.75, 12.5, 18.5, 3.5, BR), ...[6.5, 9.75, 13].flatMap((y) => [7.5, 11.5].map((x) => dot(x, y, 0.3))), circ(9.5, 17.25, 1.5), line([11, 17.25], [20.75, 17.25])],
  },
  'alarm-panel': {
    tags: ['panel de alarma', 'teclado de alarma', 'armar', 'alarm panel', 'alarm keypad', 'security system'],
    d: [WALL, sq(8.75, 5.5, 6.5, 3, 1.25), ...[11.5, 14.75, 18].flatMap((y) => [9, 12, 15].map((x) => dot(x, y, 0.3)))],
  },
  'video-doorbell': {
    tags: ['timbre con cámara', 'videoportero', 'timbre inteligente', 'video doorbell', 'smart doorbell', 'doorbell'],
    d: [capsule(6.75, 2.75, 10.5, 18.5), circ(12, 8, 1.25), circ(12, 15.5, 2.5)],
  },
  'smart-home-hub': {
    tags: ['hub domótico', 'puente', 'casa inteligente', 'smart home hub', 'bridge', 'home automation'],
    d: [sq(4.25, 15.25, 15.5, 5.5, 2.75), arc(12, 14.5, 3, 225, 315).d, arc(12, 14.5, 6, 225, 315).d, arc(12, 14.5, 9, 230, 310).d],
  },
  appliances: {
    tags: ['electrodomésticos', 'línea blanca', 'aparatos', 'appliances', 'home appliances', 'white goods'],
    // The fridge behind, the washer in front (the engine clears the fridge around it)
    d: [APPLIANCE_FRIDGE, line([3.25, 10.75], [10.25, 10.75]), line([6.5, 5.75], [6.5, 7.75]), line([6.5, 13.75], [6.5, 17.25])],
    badge: { d: APPLIANCE_WASHER, knock: APPLIANCE_WASHER[0], fill: { solid: [APPLIANCE_WASHER[0]], cut: [APPLIANCE_WASHER[1]] } },
  },
  'lightbulb-smart': {
    tags: ['foco inteligente', 'bombilla inteligente', 'luz conectada', 'smart bulb', 'smart light', 'connected light'],
    // Sistema's lit bulb, a little lower, with two signal arcs over its glass instead of rays
    d: [transform(BULB_ON[0], 1, 0, 1.25), transform(BULB_ON[1], 1, 0, 1.25), arc(12, 12.75, 7.25, 235, 305).d, arc(12, 12.75, 10.25, 240, 300).d],
  },
  floodlight: {
    tags: ['reflector', 'lámpara exterior', 'seguridad', 'floodlight', 'security light', 'outdoor light'],
    // The wall plate, the arm and the head tilted down, its beams spreading
    d: FLOOD,
  },
  'motion-sensor': {
    tags: ['sensor de movimiento', 'presencia', 'detector', 'motion sensor', 'presence', 'occupancy'],
    // The dome on the wall, sensing outward
    d: [line([4.5, 4.5], [4.5, 19.5]), 'M4.5 8A4 4 0 0 1 4.5 16', arc(4.5, 12, 7, -40, 40).d, arc(4.5, 12, 10, -40, 40).d, arc(4.5, 12, 13, -35, 35).d],
  },
  'door-sensor': {
    tags: ['sensor de puerta', 'sensor de contacto', 'abierto cerrado', 'door sensor', 'contact sensor', 'window sensor'],
    // Lugares' door, its knob a little lower, and the sensor's two halves across its edge
    d: [DOOR[0], DOOR[1], dot(14.25, 13.5), halfBlock(18, 6.75, -1), halfBlock(18, 6.75, 1)],
  },
  'door-sensor-open': {
    tags: ['puerta abierta', 'sensor abierto', 'contacto abierto', 'door open', 'sensor open', 'window open'],
    // Lugares' open door: one half stays on the frame, the other went with the door
    d: [DOOR_OPEN[0], DOOR_OPEN[1], DOOR_OPEN[2], halfBlock(18, 9, 1), halfBlock(11.75, 9.5, -1)],
  },
  'leak-sensor': {
    tags: ['sensor de fugas', 'detector de agua', 'inundación', 'leak sensor', 'water sensor', 'flood sensor'],
    // A flat puck on the floor and two drops falling on it. (One drop centered over a domed puck
    // read as the person icon.)
    d: [line([2.75, 20.75], [21.25, 20.75]), rline([[5.75, 20.75], [5.75, 17.75], [18.25, 17.75], [18.25, 20.75]], [0, 1.5, 1.5, 0]), droplet(9.75, 11.75, 2.5), droplet(15.5, 8, 1.75)],
  },
  'smoke-detector': {
    tags: ['detector de humo', 'alarma de humo', 'incendio', 'smoke detector', 'smoke alarm', 'fire safety'],
    // The dome on the ceiling, the smoke rising toward it
    d: [line([3, 3.25], [21, 3.25]), SMOKE_DOME, wisp(9.25, 20.5, 9.5, 1), wisp(14.75, 20.5, 9.5, 1)],
  },
  'smart-valve': {
    tags: ['válvula inteligente', 'corte de agua', 'llave de paso', 'smart valve', 'water shutoff', 'leak protection'],
    // The pipe with its two joints, the motor on top and its lever
    d: [sq(2.5, 14, 19, 4.5, 1), line([5.5, 12.5], [5.5, 20]), line([18.5, 12.5], [18.5, 20]), sq(8.5, 7, 7, 7, 2), rline([[12, 7], [12, 3.75], [18.5, 3.75]], [0, 1, 0])],
  },
  blinds: {
    tags: ['persianas', 'cortinas', 'cerradas', 'blinds', 'window blinds', 'shades'],
    d: [sq(2.75, 3.25, 18.5, 3, 1.5), ...[9.25, 12.25, 15.25, 18.25].map((y) => line([4.25, y], [17, y])), line([20, 6.25], [20, 16.5])],
  },
  'blinds-open': {
    tags: ['persianas abiertas', 'subir persianas', 'abrir', 'blinds open', 'raise blinds', 'shades up'],
    // The slats gathered tight under the headrail, the cord hanging long
    d: [sq(2.75, 3.25, 18.5, 3, 1.5), sq(4.25, 6.25, 12.75, 3, 1), line([20, 6.25], [20, 20.5])],
  },
  'roller-shade': {
    tags: ['cortina enrollable', 'estor', 'persiana enrollable', 'roller shade', 'roller blind', 'shade'],
    // The roll, the sheet down to mid-height on its bar, and the pull
    d: [capsule(2.75, 3.25, 18.5, 3), rline([[4.75, 6.25], [4.75, 13.25], [19.25, 13.25], [19.25, 6.25]]), line([3.75, 13.25], [20.25, 13.25]), line([12, 13.25], [12, 16.25])],
  },

};

// ── Badged icons: the base's drawing with the engine's badge ──
const badged = (d, kind, tags) => ({ tags, d, badge: badge(kind) });
Object.assign(icons, {
  'fridge-alert': badged(FRIDGE, 'alert', ['alerta del refrigerador', 'temperatura alta', 'falla', 'fridge alert', 'temperature alarm', 'fridge fault']),
  'oven-clock': badged(OVEN, 'clock', ['temporizador del horno', 'horneado programado', 'horno', 'oven timer', 'delayed bake', 'oven']),
  'oven-check': badged(OVEN, 'check', ['horno precalentado', 'listo', 'horno', 'oven ready', 'preheated', 'oven']),
  'dishwasher-check': badged(DISHWASHER_B, 'check', ['lavado terminado', 'trastes limpios', 'lavavajillas', 'dishes clean', 'cycle done', 'dishwasher']),
  'dryer-clock': badged(DRYER, 'clock', ['tiempo de secado', 'temporizador', 'secadora', 'dryer timer', 'drying time', 'dryer']),
  'laundry-check': badged(LAUNDRY, 'check', ['lavado terminado', 'ropa lista', 'lavadora', 'wash done', 'laundry done', 'washer']),
  'air-conditioner-clock': badged([AC, line([2.5, 9.25], [21.5, 9.25]), draft(6.5), draft(10.5)], 'clock', ['temporizador del clima', 'modo dormir', 'aire acondicionado', 'ac timer', 'sleep timer', 'air conditioner']),
  // Without the mesh line the badge would cut in two (it left a stub in the bottom left corner)
  'air-filter-alert': badged([FUNNEL, ...AIR], 'alert', ['cambiar filtro', 'filtro sucio', 'filtro de aire', 'replace filter', 'dirty filter', 'air filter']),
  'thermostat-clock': badged([icons.thermostat.d[0], arc(12, 12, 5.5, 135, 330).d, dot(...polar(12, 12, 5.5, 300))], 'clock', ['horario del termostato', 'programación', 'termostato', 'thermostat schedule', 'schedule', 'thermostat']),
  'smart-plug-clock': badged(icons['smart-plug'].d, 'clock', ['enchufe programado', 'encender y apagar', 'horario', 'scheduled plug', 'plug timer', 'schedule']),
  'lightbulb-clock': badged(producto.icons['lightbulb-check'].d, 'clock', ['horario de luz', 'temporizador', 'foco', 'light schedule', 'light timer', 'lightbulb']),
  'motion-sensor-alert': badged(icons['motion-sensor'].d, 'alert', ['movimiento detectado', 'intruso', 'sensor', 'motion detected', 'intruder', 'presence alert']),
  'leak-sensor-alert': badged(icons['leak-sensor'].d, 'alert', ['fuga detectada', 'agua', 'inundación', 'leak detected', 'water alert', 'flood alert']),
  'smoke-detector-alert': badged([...icons['smoke-detector'].d.slice(0, 3)], 'alert', ['humo detectado', 'alarma de incendio', 'humo', 'smoke detected', 'fire alarm', 'smoke alert']),
  'smart-lock-alert': badged(icons['smart-lock'].d, 'alert', ['cerradura atascada', 'manipulación', 'cerradura', 'lock jammed', 'tamper alert', 'lock alert']),
  'smart-lock-clock': badged(icons['smart-lock'].d, 'clock', ['acceso temporal', 'código de invitado', 'cerradura', 'temporary access', 'guest code', 'scheduled access']),
  'robot-vacuum-alert': badged(ROBOT_B, 'alert', ['robot atascado', 'depósito lleno', 'robot aspirador', 'robot stuck', 'bin full', 'robot vacuum']),
  'robot-vacuum-clock': badged(ROBOT_B, 'clock', ['limpieza programada', 'horario', 'robot aspirador', 'scheduled cleaning', 'cleaning schedule', 'robot vacuum']),
  'laundry-clock': badged(LAUNDRY, 'clock', ['tiempo de lavado', 'inicio diferido', 'lavadora', 'wash timer', 'delayed start', 'washer']),
});

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index into d: `solid` is filled (and keeps its stroke); 'shut:i' closes an open piece along
// the edge it stands on; `cut` is knocked out at stroke width; `lines` stays a line with a
// clearance of paper; `wire` stays a line attached to the fill.
const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
const FILL = {
  fridge: { solid: [0], cut: [1, 2, 3] },
  'fridge-side-by-side': { solid: [0], cut: [1, 2, 3] },
  'fridge-open': { solid: [0, 1], cut: [2, 3] },
  'mini-fridge': { solid: [0], wire: [1, 2], cut: [3] },
  freezer: { solid: [0], cut: [1, 2] },
  'wine-cooler': { solid: [0], cut: [1, 2, 3, 4] },
  oven: { solid: [0], cut: range(1, 7) },
  'oven-convection': { solid: [0], cut: range(1, 9) },
  stove: { solid: [0, 'shut:1'], wire: [2], cut: [3, 4] },
  cooktop: { solid: [0], cut: [1, 2, 3, 4] },
  'induction-cooktop': { solid: [0], cut: [1, 2] },
  microwave: { solid: [0], cut: range(1, 6) },
  dishwasher: { solid: [0], cut: [1, 2, ...DISHWASHER.slice(3).map(cutDrop)] },
  'dishwasher-check': { solid: [0], cut: [1, 2, cutDrop(DISHWASHER[4])] },
  dryer: { solid: [0], cut: range(1, 6) },
  'washer-dryer': { solid: [0], cut: [1, 2, 3] },
  'gas-burner': { solid: [0, 2, 3, 4], lines: [1] },
  'range-hood': { solid: [0, 'shut:1'], lines: [2] },
  toaster: { solid: [0, 'shut:1', 'shut:2'], wire: [3] },
  'toaster-oven': { solid: [0], wire: [1, 2], cut: [3, 4, 5, 6] },
  'air-fryer': { solid: [0], cut: [1, 2, 3] },
  'rice-cooker': { solid: [0, 'shut:1'], wire: [2], cut: [3, 'M2.5 11.25H21.5'] },
  multicooker: { solid: [0, 'shut:1', 'shut:2'], cut: [3, 'M2.5 10.25H21.5'] },
  'slow-cooker': { solid: [0, 'shut:3', 4], wire: [1, 2], cut: [5, 'M3.5 10.75H20.5'] },
  blender: { solid: [0, 'shut:1', 2], cut: [3, 4, 5, 'M5.5 14.25H18.5'] },
  'food-processor': { solid: [0, 1, 'shut:2'], cut: [3, 'M3.5 15.25H20.5'] },
  'stand-mixer': { solid: [0, 4], wire: [1, 2, 3, 5] },
  'hand-mixer': { solid: [0, 4, 5], wire: [1, 2, 3] },
  'coffee-grinder': { solid: [0, 1, 'shut:3'], wire: [2], cut: ['M2.5 8.25H14'] },
  kettle: { solid: ['shut:0', 4], wire: [1, 2, 3] },
  'coffee-maker': { solid: [0, 1], wire: [2] },
  'espresso-machine': { solid: [0, 3], wire: [1, 2, 4] },
  'capsule-coffee-machine': { solid: [0], wire: [1] },
  // The ice is solid in its bin, which stays a line
  'ice-maker': { solid: [1, 2, 3], wire: [0] },
  'water-filter': { solid: [0, 1] },
  'water-tank': { solid: [0], wire: [1], cut: [2, 3, 4] },
  iron: { solid: [0], wire: [1], cut: [2] },
  'garment-steamer': { solid: [0], cut: [1], lines: [2, 3] },
  'vacuum-cleaner': { solid: [0, 1, 3], wire: [2] },
  'upright-vacuum': { solid: [1, 2], wire: [0] },
  'stick-vacuum': { solid: [1, 3], wire: [0, 2] },
  'handheld-vacuum': { solid: [0, 'shut:2'], wire: [1] },
  'robot-vacuum': { solid: [0], cut: [1, 2] },
  'robot-vacuum-b': { solid: [0], cut: [1] },
  'robot-vacuum-dock': { solid: [0] },
  'robot-vacuum-route': { solid: [0], cut: [1, 2] },
  'air-conditioner': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'air-conditioner-clock': { solid: [0], cut: [1], lines: [2, 3] },
  'portable-air-conditioner': { solid: [0, 'M13.75 9.75A3 3 0 0 0 16.75 6.75V2.5H19.75V6.75A6 6 0 0 1 13.75 12.75Z'], cut: [1, 2], wire: [3, 4] },
  'window-air-conditioner': { solid: [0], wire: [1], cut: [2, 3, 4, 5, 6] },
  'heat-pump': { solid: [0], wire: [1, 2], cut: [3, 4, 5, 6] },
  fan: { solid: [0, 1, 2, 3] },
  'fan-speed': { solid: [0, 1, 2, 3], lines: [4, 5, 6] },
  'fan-oscillate': { solid: [0, 1, 2, 3], lines: [4, 5, 6] },
  'desk-fan': { solid: [0, 6], cut: [1, 2, 3, 4], wire: [5] },
  'pedestal-fan': { solid: [0, 6], cut: [1, 2, 3, 4], wire: [5] },
  'ceiling-fan': { solid: [2, 3], wire: [0, 1] },
  'tower-fan': { solid: ['shut:0', 1], cut: [2] },
  'space-heater': { solid: [0], cut: [1, 2, 3], lines: [4, 5, 6] },
  humidifier: { solid: [0], cut: [1], lines: [2, 3] },
  dehumidifier: { solid: [0], cut: [1, 2, 3, 4] },
  'air-purifier': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
  'air-filter': { solid: [0], lines: [1, 2] },
  'air-vent': { solid: [0], cut: [1, 2, 3], lines: [4, 5, 6] },
  'heat-cool': { solid: [0], lines: range(1, 10) },
  defrost: { solid: [9], lines: range(0, 9) },
  thermostat: { solid: [0], cut: [1, 2] },
  'water-heater': { solid: [0], wire: [1, 2], cut: [3] },
  'house-temperature': { solid: ['shut:0', 'shut:1'], cut: [2] },
  'hand-dryer': { solid: [0, 'shut:1'], lines: [2, 3, 4] },
  'smart-plug': { solid: [0, 'shut:3'], wire: [1, 2] },
  'light-switch': { solid: [0], cut: [1, 2] },
  'light-switch-double': { solid: [0], cut: [1, 2] },
  'light-switch-dimmer': { solid: [0], cut: ['M12 4.5V19.5'] },
  'smart-lock': { solid: [0], cut: [1, 2] },
  'keypad-lock': { solid: [0], cut: range(1, 8), wire: [8] },
  'alarm-panel': { solid: [0], cut: range(1, 11) },
  'video-doorbell': { solid: [0], cut: [1, 2] },
  'smart-home-hub': { solid: [0], lines: [1, 2, 3] },
  appliances: { solid: [0], cut: [1, 2, 3] },
  'lightbulb-smart': { solid: [0], lines: [1, 2, 3] },
  lightbulb: { solid: [0], lines: [1, 2] },
  floodlight: { solid: [0, 2], wire: [1], lines: [3, 4, 5] },
  'motion-sensor': { solid: ['shut:1'], wire: [0], lines: [2, 3, 4] },
  'door-sensor': { solid: [shut(DOOR[0]), 'shut:3', 'shut:4'], wire: [1], cut: [2] },
  'door-sensor-open': { solid: ['shut:2'], wire: [0, 1, 3, 4] },
  'leak-sensor': { solid: ['shut:1', 2, 3], wire: [0] },
  'smoke-detector': { solid: ['shut:1'], wire: [0], lines: [2, 3] },
  'smoke-detector-alert': { solid: ['shut:1'], wire: [0], lines: [2] },
  'smart-valve': { solid: [0, 3], wire: [1, 2, 4] },
  blinds: { solid: [0], wire: [5], lines: [1, 2, 3, 4] },
  'blinds-open': { solid: [0, 1], wire: [2] },
  'roller-shade': { solid: [0, 'M4.75 6.25V13.25H19.25V6.25Z'], wire: [2, 3] },
};
/** Which base each badged icon draws (its fill and parts follow the base's). */
const BASE = {
  'fridge-alert': 'fridge',
  'oven-clock': 'oven',
  'oven-check': 'oven',
  'dishwasher-check': 'dishwasher-check',
  'dryer-clock': 'dryer',
  'laundry-check': 'laundry',
  'laundry-clock': 'laundry',
  'air-filter-alert': 'air-filter',
  'thermostat-clock': 'thermostat',
  'smart-plug-clock': 'smart-plug',
  'lightbulb-clock': 'lightbulb',
  'motion-sensor-alert': 'motion-sensor',
  'leak-sensor-alert': 'leak-sensor',
  'smoke-detector-alert': 'smoke-detector-alert',
  'smart-lock-alert': 'smart-lock',
  'smart-lock-clock': 'smart-lock',
  'robot-vacuum-alert': 'robot-vacuum-b',
  'robot-vacuum-clock': 'robot-vacuum-b',
};
FILL.laundry = { solid: [0], cut: [1, 2, 3] };
const piece = (name, k) => {
  const d = icons[name].d;
  if (typeof k === 'number') return d[k];
  const [op, i] = k.split(':');
  if (op === 'shut') return shut(d[Number(i)]);
  throw new Error(`Unknown fill piece ${k} in ${name}`);
};
const fillOf = (name, spec) => Object.fromEntries(Object.entries(spec).map(([kind, ks]) => [kind, ks.map((k) => (typeof k === 'string' && k.startsWith('M') ? k : piece(name, k)))]));
for (const [name, spec] of Object.entries(FILL)) if (icons[name]) icons[name].fill = fillOf(name, spec);
for (const [name, base] of Object.entries(BASE)) icons[name].fill = fillOf(name, FILL[base]);
// Open lines only (the floor, its heat and its pipe): the filled version is the outline itself
for (const name of ['heated-floor']) icons[name].fill = false;

// ── Parts: what moves or has a meaning of its own (DESIGN.md › Named parts) ─────────────────────
const PARTS = {
  fridge: { body: [0], doors: [1], handle: [2, 3] },
  'fridge-side-by-side': { body: [0], doors: [1], handle: [2, 3] },
  'fridge-open': { body: [0], door: [1], shelves: [2, 3] },
  'mini-fridge': { body: [0], feet: [1, 2], handle: [3] },
  freezer: { body: [0], lid: [1], handle: [2] },
  'wine-cooler': { body: [0], glass: [1, 2, 3], drawer: [4] },
  oven: { body: [0], knobs: [1, 2, 3], panel: [4], handle: [5], window: [6] },
  'oven-convection': { body: [0], knobs: [1, 2, 3], panel: [4], fan: [5, 6, 7, 8] },
  stove: { body: [0], pan: [1, 2], handle: [3], window: [4] },
  cooktop: { plate: [0], burners: [1, 2, 3, 4] },
  'induction-cooktop': { plate: [0], coil: [1], slider: [2] },
  microwave: { body: [0], door: [1, 2], keypad: [3, 4, 5] },
  dishwasher: { body: [0], panel: [1], handle: [2], drops: [3, 4, 5] },
  'dishwasher-check': { body: [0], panel: [1], handle: [2], drops: [3] },
  dryer: { body: [0], panel: [1], door: [2], heat: [3, 4, 5] },
  'washer-dryer': { body: [0], split: [1], door: [2, 3] },
  laundry: { body: [0], panel: [1, 2], door: [3] },
  'gas-burner': { burner: [0], base: [1], flames: [2, 3, 4] },
  'range-hood': { hood: [0], duct: [1], light: [2] },
  toaster: { body: [0], toast: [1, 2], lever: [3] },
  'toaster-oven': { body: [0], feet: [1, 2], window: [3, 4], knobs: [5, 6] },
  'air-fryer': { body: [0], drawer: [1, 2], dial: [3] },
  'rice-cooker': { body: [0], lid: [1], handle: [2], switch: [3] },
  multicooker: { lid: [0], body: [1], valve: [2], panel: [3] },
  'slow-cooker': { body: [0], handles: [1, 2], lid: [3, 4], dial: [5] },
  blender: { jar: [0, 1], base: [2, 3], blades: [4, 5] },
  'food-processor': { bowl: [0], base: [1], chute: [2], blade: [3] },
  'stand-mixer': { head: [0], column: [1, 2], base: [3], bowl: [4], beater: [5] },
  'hand-mixer': { body: [0], handle: [1], beaters: [2, 3, 4, 5] },
  'coffee-grinder': { hopper: [0], body: [1], chute: [2], cup: [3] },
  kettle: { body: [0], base: [1], spout: [2], handle: [3], lid: [4] },
  'coffee-maker': { machine: [0], carafe: [1, 2] },
  'espresso-machine': { machine: [0], portafilter: [1, 2], cup: [3, 4] },
  'capsule-coffee-machine': { body: [0], lever: [1] },
  'ice-maker': { bin: [0], ice: [1, 2, 3] },
  'water-filter': { filter: [0], drop: [1] },
  'water-tank': { tank: [0], handle: [1], level: [2, 3, 4] },
  iron: { body: [0], handle: [1], soleplate: [2] },
  'garment-steamer': { body: [0], water: [1], steam: [2, 3] },
  'vacuum-cleaner': { body: [0, 1], hose: [2], nozzle: [3] },
  'upright-vacuum': { handle: [0], body: [1], head: [2] },
  'stick-vacuum': { handle: [0], motor: [1], pole: [2], head: [3] },
  'handheld-vacuum': { body: [0], handle: [1], nozzle: [2] },
  'robot-vacuum': { body: [0], bumper: [1], sensor: [2] },
  'robot-vacuum-b': { body: [0], bumper: [1] },
  'robot-vacuum-dock': { dock: [0] },
  'robot-vacuum-route': { room: [0], route: [1], robot: [2] },
  'air-conditioner': { body: [0], louver: [1], air: [2, 3, 4] },
  'air-conditioner-clock': { body: [0], louver: [1], air: [2, 3] },
  'portable-air-conditioner': { body: [0], grille: [1, 2], wheels: [3, 4], duct: [5, 6] },
  'window-air-conditioner': { body: [0], sill: [1], grille: [2, 3, 4], knobs: [5, 6] },
  'heat-pump': { body: [0], feet: [1, 2], fan: [3, 4], fins: [5, 6] },
  fan: { rotor: [0, 1, 2, 3] },
  'fan-speed': { rotor: [0, 1, 2, 3], level: [4, 5, 6] },
  'fan-oscillate': { rotor: [0, 1, 2, 3], arrow: [4, 5, 6] },
  'desk-fan': { guard: [0], rotor: [1, 2, 3, 4], stand: [5, 6] },
  'pedestal-fan': { guard: [0], rotor: [1, 2, 3, 4], stand: [5, 6] },
  'ceiling-fan': { rod: [0, 1], blades: [2], light: [3] },
  'tower-fan': { body: [0], base: [1], vent: [2] },
  'space-heater': { body: [0], grille: [1, 2, 3], heat: [4, 5, 6] },
  'heated-floor': { floor: [0], heat: [1, 2, 3], pipe: [4] },
  humidifier: { body: [0], drop: [1], mist: [2, 3] },
  dehumidifier: { body: [0], grille: [1, 2, 3], drop: [4] },
  'air-purifier': { body: [0], intake: [1, 2], air: [3, 4, 5] },
  'air-filter': { filter: [0], air: [1, 2] },
  'air-vent': { frame: [0], slats: [1, 2, 3], air: [4, 5, 6] },
  'heat-cool': { flame: [0], snowflake: range(1, 10) },
  defrost: { snowflake: range(0, 9), drop: [9] },
  thermostat: { face: [0], dial: [1], setpoint: [2] },
  'water-heater': { tank: [0], pipes: [1, 2], flame: [3] },
  'house-temperature': { roof: [0], walls: [1], thermometer: [2] },
  'hand-dryer': { body: [0], nozzle: [1], air: [2, 3, 4] },
  'smart-plug': { body: [0], prongs: [1, 2], button: [3] },
  'light-switch': { plate: [0], rocker: [1, 2] },
  'light-switch-double': { plate: [0], rockers: [1, 2] },
  'light-switch-dimmer': { plate: [0], track: [1] },
  'smart-lock': { plate: [0], rose: [1], bar: [2] },
  'keypad-lock': { plate: [0], keypad: range(1, 7), handle: [7, 8] },
  'alarm-panel': { plate: [0], display: [1], keypad: range(2, 11) },
  'video-doorbell': { body: [0], camera: [1], button: [2] },
  'smart-home-hub': { hub: [0], wave: [1, 2, 3] },
  appliances: { fridge: [0, 1, 2, 3] },
  'lightbulb-smart': { bulb: [0], base: [1], wave: [2, 3] },
  lightbulb: { bulb: [0], base: [1, 2] },
  floodlight: { mount: [0, 1], head: [2], beams: [3, 4, 5] },
  'motion-sensor': { wall: [0], sensor: [1], wave: [2, 3, 4] },
  'door-sensor': { door: [0], floor: [1], knob: [2], sensor: [3, 4] },
  'door-sensor-open': { frame: [0], floor: [1], door: [2], sensor: [3, 4] },
  'leak-sensor': { floor: [0], sensor: [1], drops: [2, 3] },
  'smoke-detector': { ceiling: [0], detector: [1], smoke: [2, 3] },
  'smoke-detector-alert': { ceiling: [0], detector: [1], smoke: [2] },
  'smart-valve': { pipe: [0, 1, 2], motor: [3], lever: [4] },
  blinds: { headrail: [0], slats: [1, 2, 3, 4], cord: [5] },
  'blinds-open': { headrail: [0], slats: [1], cord: [2] },
  'roller-shade': { roll: [0], shade: [1, 2], pull: [3] },
};
for (const [name, base] of Object.entries(BASE)) PARTS[name] = PARTS[base];
for (const [name, p] of Object.entries(PARTS)) if (icons[name]) icons[name].parts = p;

// ── Motion (DESIGN.md › Motion) ─────────────────────────────────────────────────────────────────
const BADGE_MOTION = {
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  alert: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  clock: { effect: 'spin', parts: ['badge'], origin: BC },
};
const MOTION = {
  'oven-convection': { effect: 'spin', parts: ['fan'], origin: [12, 15.25] },
  dryer: { effect: 'float', parts: ['heat'], vector: [0, -1] },
  dishwasher: { effect: 'float', parts: ['drops'], vector: [0, 1] },
  'fridge-open': { effect: 'wiggle', parts: ['door'], origin: [8.25, 12] },
  'gas-burner': { effect: 'beat', parts: ['flames'], origin: [12, 13.75] },
  toaster: { effect: 'bounce', parts: ['toast'], vector: [0, -1.5] },
  'rice-cooker': { effect: 'wiggle', parts: ['lid'], origin: [12, 11.5] },
  multicooker: { effect: 'beat', parts: ['valve'], origin: [15, 6.75] },
  blender: { effect: 'spin', parts: ['blades'], origin: [12, 10.6] },
  'food-processor': { effect: 'spin', parts: ['blade'], origin: [12, 11.75] },
  'hand-mixer': { effect: 'wiggle', parts: ['beaters'], origin: [12, 13.25] },
  kettle: { effect: 'wiggle', origin: [11.5, 20.25] },
  'range-hood': { effect: 'beat', parts: ['light'], origin: [12, 20.25] },
  'garment-steamer': { effect: 'float', parts: ['steam'], vector: [0, -1] },
  'robot-vacuum': { effect: 'spin', origin: [12, 12] },
  'robot-vacuum-dock': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
  'robot-vacuum-route': { effect: 'slide', parts: ['robot'], vector: [1, 0] },
  iron: { effect: 'slide', vector: [-1.5, 0] },
  'air-conditioner': { effect: 'float', parts: ['air'], vector: [-0.5, 1.5] },
  'air-conditioner-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  fan: { effect: 'spin', parts: ['rotor'], origin: [12, 12] },
  'fan-speed': { effect: 'spin', parts: ['rotor'], origin: [7.25, 12] },
  'fan-oscillate': { effect: 'wiggle', parts: ['rotor'], origin: [12, 14] },
  'desk-fan': { effect: 'spin', parts: ['rotor'], origin: [12, 9.25] },
  'pedestal-fan': { effect: 'spin', parts: ['rotor'], origin: [12, 8.25] },
  'ceiling-fan': { effect: 'beat', parts: ['light'], origin: [12, 14.5] },
  'space-heater': { effect: 'float', parts: ['heat'], vector: [0, -1] },
  'heated-floor': { effect: 'float', parts: ['heat'], vector: [0, -1] },
  humidifier: { effect: 'float', parts: ['mist'], vector: [0, -1] },
  'air-purifier': { effect: 'float', parts: ['air'], vector: [0, -1] },
  'air-vent': { effect: 'float', parts: ['air'], vector: [0, -1] },
  defrost: { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
  'water-heater': { effect: 'wiggle', parts: ['flame'], origin: [12, 18.25] },
  'hand-dryer': { effect: 'float', parts: ['air'], vector: [0, 1] },
  'smart-home-hub': { effect: 'beat', parts: ['wave'], origin: [12, 14.5] },
  'lightbulb-smart': { effect: 'beat', parts: ['wave'], origin: [12, 12.75] },
  'motion-sensor': { effect: 'beat', parts: ['wave'], origin: [4.5, 12] },
  'smoke-detector': { effect: 'float', parts: ['smoke'], vector: [0, -1.5] },
  'smoke-detector-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'leak-sensor': { effect: 'bounce', parts: ['drops'], vector: [0, 1.5] },
  'door-sensor-open': { effect: 'wiggle', parts: ['door'], origin: [6, 13] },
  floodlight: { effect: 'beat', parts: ['beams'], origin: [13.5, 11.75] },
  'water-filter': { effect: 'slide', parts: ['drop'], vector: [0, 1] },
  'smart-lock': { effect: 'spin', parts: ['bar'], origin: [12, 9] },
  'smart-valve': { effect: 'wiggle', parts: ['lever'], origin: [12, 7] },
  'blinds-open': { effect: 'slide', parts: ['slats'], vector: [0, -1] },
  'roller-shade': { effect: 'slide', parts: ['shade'], vector: [0, -1.5] },
  'video-doorbell': { effect: 'beat', parts: ['button'], origin: [12, 15.5] },
};
for (const [name, icon] of Object.entries(icons)) if (icon.badge && !MOTION[name]) MOTION[name] = BADGE_MOTION[icon.badge.kind];
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Levels (DESIGN.md › Levels and values): from least to most ──────────────────────────────────
const LEVELS = {
  'gas-burner': [[2], [3], [4]],
  'water-tank': [[2], [3], [4]],
  'fan-speed': [[4], [5], [6]],
};
for (const [name, l] of Object.entries(LEVELS)) icons[name].levels = l;
// The thermostat's set point turns along its dial, from its open end at 7:30 round to 4:30
icons.thermostat.value = { turn: { parts: ['setpoint'], origin: [12, 12], from: 135, to: 405, at: 320 } };
// The smart lock's bar turns a quarter: upright (unlocked) to level (locked)
icons['smart-lock'].value = { turn: { parts: ['bar'], origin: [12, 9], from: 90, to: 0, at: 90 } };

// ── Mirroring (DESIGN.md › Mirroring): the bars that grow ──
icons['fan-speed'].mirror = true;

// ── Automatic variants (DESIGN.md › Automatic variants) ─────────────────────────────────────────
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// With a badge (the engine's or a piece in front): the engine carries it neither into an enclosure
// nor onto the slash
variants(
  Object.keys(icons).filter((n) => icons[n].badge),
  { circle: false, square: false, slash: false },
);
// Already a square plate: not enclosed in a square again
variants(['cooktop', 'induction-cooktop', 'robot-vacuum-route'], { square: false });
// Already round: not enclosed in a circle again
variants(['robot-vacuum', 'thermostat'], { circle: false });

// ── 16 px (DESIGN.md › 16 px): drawings made for the pixel grid where snapping leaves a smudge ──
// At 16 px a pixel is 1.5 canvas units and pixel centers fall at 0.75 + 1.5k; g(column, row) is a
// pixel's center, pl() a polyline through pixel centers, pd() a one-pixel point and pd2() a 2 × 2 one
// on a pixel corner. Pieces stand at least a pixel apart: a rotor becomes its guard and hub, a coil
// its ring, drops and keys become points, and arcs keep 2 px between them (as dispositivos' Wi-Fi).
// A badged icon carries the engine's pixel badge.
{
  const PX = (k) => 0.75 + 1.5 * k;
  const g = (c, r) => [PX(c), PX(r)];
  const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
  const pd = (c, r) => dot(PX(c), PX(r), 0.1);
  const pd2 = (x, y) => dot(x, y, 1);
  const small = (name, d, fill, kind) => {
    icons[name].small = { d, ...(fill && { fill }), ...(kind && { badge: badge(kind, { size: 16 }) }) };
  };
  /** The big appliances' cabinet on the pixel grid: 10 × 14 px, its corner square. */
  const cab = sq(PX(3), PX(1), 13.5, 19.5, 3, BR);
  {
    // Convection: two knobs, the band, and the fan as its guard ring and hub
    const d = [cab, pd(5, 3), pd(10, 3), pl([3, 5], [12, 5]), circ(12, 15, 3.75), pd2(12, 15)];
    small('oven-convection', d, { solid: [cab], cut: d.slice(1) });
  }
  {
    // The dishwasher: the handle in the band, the band, three drops as points
    const d = [cab, pl([6, 3], [9, 3]), pl([3, 5], [12, 5]), pd2(12, 12), pd2(9, 16.5), pd2(15, 16.5)];
    small('dishwasher', d, { solid: [cab], cut: d.slice(1) });
    const b = d.slice(0, 3).concat(pd2(9, 16.5));
    small('dishwasher-check', b, { solid: [cab], cut: b.slice(1) }, 'check');
  }
  {
    // The stove: the pan standing on the body's straight top, its handle level with its rim, and
    // the oven's handle and window
    const body = sq(PX(3), PX(6), 13.5, 12, 1.5, BR);
    const pan = pl([4, 6], [4, 4], [9, 4], [9, 6]);
    const handle = pl([9, 4], [14, 4]);
    const rest = [pl([5, 8], [10, 8]), sq(PX(5), PX(10), 7.5, 3, 0.75)];
    small('stove', [body, pan, handle, ...rest], { solid: [body, shut(pan)], wire: [handle], cut: rest });
  }
  {
    // Induction: the coil as one ring and its center, the slider under it
    const plate = sq(PX(2), PX(2), 16.5, 16.5, 3.5, BR);
    const d = [plate, circ(12, 10.5, 3.75), pd2(12, 10.5), pl([5, 11], [10, 11])];
    small('induction-cooktop', d, { solid: [plate], cut: d.slice(1) });
  }
  {
    // Heat and cool: a pixel flame, and the snowflake as a six-armed star through pixel centers
    const flame16 = roundpoly([g(5, 3), g(6, 6), g(6, 10), g(5, 11), g(3, 11), g(2, 10), g(2, 8), g(3, 6)], [0.3, 0.75, 1, 0.75, 0.75, 1, 0.75, 0.75]);
    const star = [pl([11, 5], [11, 11]), pl([9, 6], [13, 10]), pl([13, 6], [9, 10])];
    small('heat-cool', [flame16, ...star], { solid: [flame16], lines: star });
  }
  {
    // The motion sensor: the dome and two arcs 2 px apart, on a pixel row (three became a gray fan)
    const c = [PX(4), PX(7)];
    const d = [pl([4, 2], [4, 13]), `M${pt([c[0], c[1] - 3])}A3 3 0 0 1 ${pt([c[0], c[1] + 3])}`, arc(...c, 6, -40, 40).d, arc(...c, 9, -35, 35).d];
    small('motion-sensor', d, { solid: [shut(d[1])], wire: [d[0]], lines: d.slice(2) });
    small('motion-sensor-alert', d.slice(0, 4), { solid: [shut(d[1])], wire: [d[0]], lines: d.slice(2, 4) }, 'alert');
  }
  {
    // The water tank: its levels as three straight lines (the waves zigzagged)
    const tank = sq(PX(3), PX(4), 13.5, 15, 3, BR);
    const handle = rline([g(5, 4), g(5, 2), g(10, 2), g(10, 4)], [0, 0.75, 0.75, 0]);
    const levels = [11, 9, 7].map((r) => pl([5, r], [10, r]));
    small('water-tank', [tank, handle, ...levels], { solid: [tank], wire: [handle], cut: levels });
  }
  {
    // The smart bulb: the glass on a pixel corner, the base, and two arcs 2 px apart
    const glass = circ(12, 13.5, 3.75);
    const d = [glass, pl([6, 13], [9, 13]), arc(12, 13.5, 6.75, 235, 305).d, arc(12, 13.5, 9.75, 240, 300).d];
    small('lightbulb-smart', d, { solid: [glass], lines: d.slice(1) });
  }
  {
    // The hub: two arcs 2 px apart over the puck
    const puck = sq(PX(3), PX(10), 13.5, 4.5, 2.25);
    const d = [puck, arc(12, 15, 5.25, 225, 315).d, arc(12, 15, 8.25, 225, 315).d];
    small('smart-home-hub', d, { solid: [puck], lines: d.slice(1) });
  }
  {
    // The keypad lock: keys as one-pixel points two apart, the rose a 2 × 2 point and the lever
    const plate = sq(PX(2), PX(1), 10.5, 19.5, 3, BR);
    const keys = [3, 5, 7].flatMap((r) => [4, 7].map((c) => pd(c, r)));
    const rose = pd2(7.5, 16.5);
    const lever = pl([5, 11], [13, 11]);
    small('keypad-lock', [plate, ...keys, rose, lever], { solid: [plate], cut: [...keys, rose], wire: [lever] });
  }
  {
    // The alarm panel: the display a line, the keypad three by three one-pixel points
    const plate = sq(PX(3), PX(1), 12, 19.5, 3, BR);
    const keys = [6, 8, 10].flatMap((r) => [5, 7, 9].map((c) => pd(c, r)));
    small('alarm-panel', [plate, pl([5, 3], [9, 3]), ...keys], { solid: [plate], cut: [pl([5, 3], [9, 3]), ...keys] });
  }
  {
    // The fans: the rotor's closed blades turn to gray rings, so at 16 px the rotor is what the desk
    // fan shows through its guard, a 2 × 2 hub and three curved vanes (the same four pieces, so the
    // spin and the levels keep their indices)
    const rotor16 = (cx, cy, R) => [pd2(cx, cy), ...vanes(cx, cy, R, 2.25).slice(1)];
    const fan = rotor16(12, 12, 8.25);
    small('fan', fan, { solid: [fan[0]], wire: fan.slice(1) });
    const speed = [...rotor16(PX(4.5), 12, 5.5), pl([10, 11], [10, 9]), pl([12, 11], [12, 7]), pl([14, 11], [14, 5])];
    small('fan-speed', speed, { solid: [speed[0]], wire: speed.slice(1, 4), lines: speed.slice(4) });
    // Oscillation: the rotor over a straight two-headed arrow (the arc zigzagged on the grid)
    const osc = [...rotor16(12, 7.5, 5.25), pl([2, 12], [13, 12]), pl([4, 10], [2, 12], [4, 14]), pl([11, 10], [13, 12], [11, 14])];
    small('fan-oscillate', osc, { solid: [osc[0]], wire: osc.slice(1, 4), lines: osc.slice(4) });
  }
  {
    // The floodlight: the plate, the arm, the head flaring down to the right and its beams
    const plate = sq(PX(0), PX(3), 3, 6, 0.75);
    const head16 = roundpoly([g(5, 3), g(8, 2), g(10, 8), g(5, 7)], 0.5);
    const beams = [pl([12, 7], [14, 7]), pl([11, 10], [13, 12]), pl([8, 11], [8, 13])];
    small('floodlight', [plate, pl([2, 5], [5, 5]), head16, ...beams], { solid: [plate, head16], wire: [pl([2, 5], [5, 5])], lines: beams });
  }
  {
    // The smoke detector: the ceiling, the dome and the smoke in pixel steps (the curves went gray)
    const ceiling = pl([1, 1], [14, 1]);
    const dome16 = rline([g(4, 1), g(4, 2), g(5, 3), g(10, 3), g(11, 2), g(11, 1)], [0, 0.5, 0.5, 0.5, 0.5, 0]);
    const smoke = (c) => pl([c, 14], [c, 13], [c - 1, 12], [c - 1, 11], [c, 10], [c, 9], [c - 1, 8], [c - 1, 7]);
    small('smoke-detector', [ceiling, dome16, smoke(6), smoke(10)], { solid: [shut(dome16)], wire: [ceiling], lines: [smoke(6), smoke(10)] });
    small('smoke-detector-alert', [ceiling, dome16, smoke(6)], { solid: [shut(dome16)], wire: [ceiling], lines: [smoke(6)] }, 'alert');
  }
}

export default { category: 'electrodomesticos', label: 'Electrodomésticos y casa inteligente', icons };
