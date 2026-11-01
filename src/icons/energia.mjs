// Energía y servicios (energy and utilities), round 9: solar, wind, water and heat; fuels and
// thermal plants; the grid (pylons, poles and storage); meters,
// bills and tariffs; saving and efficiency; water supply and treatment; heating; bulbs; and the
// world's outlets. Drawn with the engine (engine/geometry.mjs) and the rules in DESIGN.md.
// - The bolt is nucleo's, at one size (0.6: smaller, its waist pinches shut at bold wherever the
//   rounding of its placement falls badly; at 0.6 it keeps one hole at every offset and turn).
//   Where it has no room inside its subject with clearance (a price tag, a plant's low hall, a
//   clock, a leaf) it is a glyph badge at the bottom right, its knock a circle (boltBadge).
// - house-* are lugares's house; receipt-* comercio's receipt; price-tag-* comercio's tag; the
//   drops lugares's droplet; the flames electrodomesticos's fire (two tips: lugares's flame without
//   its inner tongue reads as a drop); the steam lugares's hot-spring wisps and its cloud; the bulbs
//   sistema's lightbulb (its glass and its two base lines); the outlets dispositivos's faceplate,
//   only their slots changing.
// - The meters share one box (the portrait keyline's width, radius 3.5 and the signature corner):
//   tall for electricity, squat for the smart meter, and one counter window.
// - The wind turbines share one rotor: a round hub and three long thin blades, one stroke each.
import { arc, badge, circ, dot, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => scale(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };
/** A path scaled by `s` about `c` and set down with `c` at `to`. */
const place = (d, s, c, to = c) => transform(d, s, to[0] - c[0] * s, to[1] - c[1] * s);
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
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
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** A lens leaf from A to B, `w` wide at its middle (lugares's leaf, without its midrib). */
function leaf(A, B, w) {
  const c = len(sub(B, A));
  const s = w / 2;
  const R = f((s * s + (c * c) / 4) / (2 * s));
  return `M${pt(A)}A${R} ${R} 0 0 1 ${pt(B)}A${R} ${R} 0 0 1 ${pt(A)}Z`;
}

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** A rising wisp of steam or heat from (x, y0) up `h`, swaying `a`: lugares's hot-spring steam. */
const steam = (x, y0, h, a = 1.25) =>
  `M${pt([x, y0])}C${pt([x - a, y0 - h / 6])} ${pt([x - a, y0 - h / 3])} ${pt([x, y0 - h / 2])}S${pt([x + a, y0 - (5 * h) / 6])} ${pt([x, y0 - h])}`;

/** A ripple: n half waves of width h and amplitude a from (x0, y), up first (lugares's water). */
function ripple(y, x0, n, h = 3, a = 1) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
}

/**
 * A small flame standing on (cx, by), `w` wide and `h` tall: a round foot, its main tip leaning right
 * and a second, smaller tip on its left (electrodomesticos's fire: at this size lugares's flame
 * reads as a drop).
 */
const fire = (cx, by, w, h) => {
  const r = w / 2;
  const T = [cx + 0.12 * w, by - h];
  const S = [cx - 0.36 * w, by - 0.68 * h];
  const N = [cx - 0.1 * w, by - 0.5 * h];
  return `M${pt(T)}C${pt([cx + 0.2 * w, by - 0.72 * h])} ${pt([cx + r, by - 0.62 * h])} ${pt([cx + r, by - r])}A${f(r)} ${f(r)} 0 0 1 ${pt([cx - r, by - r])}C${pt([cx - r, by - 0.45 * h])} ${pt([cx - 0.45 * w, by - 0.58 * h])} ${pt(S)}C${pt([cx - 0.25 * w, by - 0.6 * h])} ${pt([cx - 0.18 * w, by - 0.55 * h])} ${pt(N)}C${pt([cx - 0.12 * w, by - 0.75 * h])} ${pt([cx, by - 0.85 * h])} ${pt(T)}Z`;
};

// ── Measuring paths (to fit pieces with the set's clearance) ──────────────────────────────────
/** Points every ~0.1 along a path (any engine path: absolute M, L, H, V, C, S, Q, A, Z). */
function samples(d) {
  const abs = transform(d, 1, 0, 0);
  const toks = abs.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const out = [];
  let cur = [0, 0];
  let start = [0, 0];
  let last = null;
  let cmd = '';
  let i = 0;
  const num = () => Number(toks[i++]);
  const push = (p) => out.push(p);
  const seg = (a, b) => {
    const n = Math.max(1, Math.ceil(len(sub(b, a)) / 0.1));
    for (let k = 1; k <= n; k++) push(lerp(a, b, k / n));
  };
  const cubic = (p0, c1, c2, p1) => {
    const n = 64;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      push([0, 1].map((j) => u * u * u * p0[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p1[j]));
    }
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'M') {
      cur = start = [num(), num()];
      push(cur);
      last = null;
    } else if (cmd === 'L') {
      const p = [num(), num()];
      seg(cur, p);
      cur = p;
      last = null;
    } else if (cmd === 'H') {
      const p = [num(), cur[1]];
      seg(cur, p);
      cur = p;
    } else if (cmd === 'V') {
      const p = [cur[0], num()];
      seg(cur, p);
      cur = p;
    } else if (cmd === 'C') {
      const [c1, c2, p] = [[num(), num()], [num(), num()], [num(), num()]];
      cubic(cur, c1, c2, p);
      last = c2;
      cur = p;
    } else if (cmd === 'S') {
      const c1 = last ? sub(scale(cur, 2), last) : cur;
      const [c2, p] = [[num(), num()], [num(), num()]];
      cubic(cur, c1, c2, p);
      last = c2;
      cur = p;
    } else if (cmd === 'Q') {
      const [c, p] = [[num(), num()], [num(), num()]];
      cubic(cur, lerp(cur, c, 2 / 3), lerp(p, c, 2 / 3), p);
      cur = p;
    } else if (cmd === 'A') {
      const [rx0, ry0, phi, fa, fs] = [num(), num(), num(), num(), num()];
      const p = [num(), num()];
      // Endpoint to center parameterization (SVG implementation notes, F.6.5)
      const r = (phi * Math.PI) / 180;
      const [cs, sn] = [Math.cos(r), Math.sin(r)];
      const dx = (cur[0] - p[0]) / 2;
      const dy = (cur[1] - p[1]) / 2;
      const x1 = cs * dx + sn * dy;
      const y1 = -sn * dx + cs * dy;
      let [rx, ry] = [Math.abs(rx0), Math.abs(ry0)];
      const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
      if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
      const num2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
      const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, num2 / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
      const cx1 = (k * rx * y1) / ry;
      const cy1 = (-k * ry * x1) / rx;
      const c = [cs * cx1 - sn * cy1 + (cur[0] + p[0]) / 2, sn * cx1 + cs * cy1 + (cur[1] + p[1]) / 2];
      const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
      let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
      if (!fs && dt > 0) dt -= 2 * Math.PI;
      if (fs && dt < 0) dt += 2 * Math.PI;
      const n = Math.max(8, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / 0.1));
      for (let q = 1; q <= n; q++) {
        const t = t0 + (dt * q) / n;
        const [ex, ey] = [rx * Math.cos(t), ry * Math.sin(t)];
        push([cs * ex - sn * ey + c[0], sn * ex + cs * ey + c[1]]);
      }
      cur = p;
      last = null;
    } else if (cmd === 'Z') {
      seg(cur, start);
      cur = start;
      last = null;
    } else throw new Error(`samples: unsupported command ${cmd}`);
  }
  return out;
}
/** The point of a path nearest to the line x + y = k (where a diagonal meets it), on one side of x = 12. */
function onDiagonal(d, k, left) {
  return samples(d)
    .filter((p) => (left ? p[0] < 12 : p[0] > 12))
    .sort((p, q) => Math.abs(p[0] + p[1] - k) - Math.abs(q[0] + q[1] - k))[0];
}
/** The highest point of a path above the abscissa x. */
const topAt = (d, x) => Math.min(...samples(d).filter((p) => Math.abs(p[0] - x) < 0.06).map((p) => p[1]));

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
const GROUND = 20.75;
const ground = (x0 = 2.75, x1 = 21.25) => line([x0, GROUND], [x1, GROUND]);
/** nucleo's bolt at the category's one size, centered on `at` (turned `deg` about it). */
const BOLT_S = 0.6;
const bolt = (at, deg = 0) => {
  const d = place(nucleo.icons.bolt.d[0], BOLT_S, [12, 12], at);
  return deg ? turnPath(d, deg, at) : d;
};
/**
 * The bolt as a glyph badge, for a subject with no room for it inside. Its knock is a circle that
 * just holds it (r 4.4: its tips reach 4.39), so the base is cut in one clean arc, as under the
 * engine's badges; a knock of the bolt's own shape cut the base in arbitrary curves and left
 * fragments. It sits a hair off the badges' spot, at (17.375, 17.5): there the bolt's waist and the
 * cut hold their structure from 0.9 to 2.1 under every base here; at (17.25, 17.25) they did not.
 */
const BADGE_AT = [17.375, 17.5];
const boltBadge = () => {
  const d = bolt(BADGE_AT);
  return { d: [d], knock: circ(...BADGE_AT, 4.4), fill: { solid: [d] } };
};
/** lugares's droplet: its circle centered at (12, 13.5), r 7.25, its tip at (12, 3.25). */
const [DROP] = lugares.icons.droplet.d;
/** The droplet scaled by s with the middle of its box (12, 12) at `to`. */
const drop = (s, to) => place(DROP, s, [12, 12], to);
/** lugares's cloud (3.25–21 × 5.25–18.25), scaled by s with the middle of its flat base at `to`. */
const CLOUD = lugares.icons.cloud.d[0];
const cloud = (s, to) => place(CLOUD, s, [12.25, 18.25], to);
/** lugares's house: roof, walls, door and window. */
const HOUSE = lugares.icons.house.d;
/** comercio's receipt (4.75–19.25 × 2.75–21.25, its zigzag foot rising to 19.75). */
const RECEIPT = comercio.icons.receipt.d[0];
/** comercio's price tag and its hole. */
const TAG = comercio.icons['price-tag'].d;
/** sistema's lightbulb: the glass (a circle of r 6 at (12, 8.5) on its neck down to 15.25) and the base's two lines. */
const BULB = sistema.icons.lightbulb.d;
/** dispositivos's outlet faceplate (the square keyline with the signature corner). */
const PLATE = dispositivos.icons.outlet.d[0];
/** lugares's sun rays (from r 7.25 to 9.35 around (12, 12)), half a unit further out around the bolt. */
const RAYS = lugares.icons.sun.d.slice(1).map((d, i) => line(polar(12, 12, 7.75, i * 45), polar(12, 12, 9.85, i * 45)));

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
const FILL = {};
const PARTS = {};
const MOTION = {};

// ── Solar ─────────────────────────────────────────────────────────────────────────────────────
/** A panel tilted back: a parallelogram w wide and h tall, its top shifted `s` to the right. */
const panelPts = (x, yb, w, h, s) => [[x, yb], [x + w, yb], [x + w + s, yb - h], [x + s, yb - h]];
{
  // Solar panel: the 3 × 2 grid of cells, on one short leg and its foot
  const [x, yb, w, h, s] = [2.75, 14.25, 14.5, 10, 4];
  const at = (u, v) => [x + u * w + v * s, yb - v * h];
  const legX = at(0.5, 0)[0];
  add('solar-panel', ['panel solar', 'fotovoltaico', 'energía solar', 'solar panel', 'photovoltaic', 'pv'], [
    roundpoly(panelPts(x, yb, w, h, s), 1),
    line(at(1 / 3, 0), at(1 / 3, 1)),
    line(at(2 / 3, 0), at(2 / 3, 1)),
    line(at(0, 0.5), at(1, 0.5)),
    line([legX, yb], [legX, GROUND]),
    line([legX - 3.25, GROUND], [legX + 3.25, GROUND]),
  ]);
  FILL['solar-panel'] = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
  PARTS['solar-panel'] = { panel: [0, 1, 2, 3], stand: [4, 5] };
}
{
  // House with solar: lugares's house and a panel lying on its right slope, split into two cells
  const E = [12.8, 4.17];
  const u = unit([8.45, 7.08]);
  const n = [u[1], -u[0]];
  const at = (s, t = 0) => plus(E, plus(scale(u, s), scale(n, t)));
  const [s0, s1, t] = [2.5, 9.5, 3];
  const panel = line(at(s0), at(s0, t), at(s1, t), at(s1));
  add('house-solar', ['casa solar', 'paneles en el techo', 'autoconsumo', 'solar home', 'rooftop solar', 'residential solar'], [
    ...HOUSE,
    panel,
    line(at((s0 + s1) / 2), at((s0 + s1) / 2, t)),
  ]);
  // Filled, the roof's edge under the panel is cut too: without it the panel merged into the roof
  // and only its divider was left, a slash
  FILL['house-solar'] = { solid: ['shut:0', 'shut:1', 'shut:4'], cut: [2, 3, 5, line(at(s0), at(s1))] };
  PARTS['house-solar'] = { roof: [0], walls: [1], door: [2], window: [3], panel: [4, 5] };
}
{
  // Solar energy: the sun whose disc is the bolt, lugares's rays around it
  add('solar-energy', ['energía solar', 'electricidad solar', 'fuente solar', 'solar energy', 'solar power', 'solar electricity'], [bolt([12, 12]), ...RAYS]);
  FILL['solar-energy'] = { solid: [0], lines: [1, 2, 3, 4, 5, 6, 7, 8] };
  PARTS['solar-energy'] = { bolt: [0], rays: [1, 2, 3, 4, 5, 6, 7, 8] };
  MOTION['solar-energy'] = { effect: 'spin', parts: ['rays'], origin: [12, 12] };
}
{
  // Solar water heater: solar-panel's tilted panel, its cells turned into tubes, with the tank
  // lying across its top edge, on the panel's leg and foot
  const tank = capsule(4.75, 2.75, 16.5, 4.5);
  const [top, bot] = [7.25, 15.75];
  const [a0, a1, b0, b1] = [7.5, 19, 3.75, 15.25];
  const rack = line([a0, top], [b0, bot], [b1, bot], [a1, top]);
  const tube = (t) => line([a0 + (a1 - a0) * t, top], [b0 + (b1 - b0) * t, bot]);
  const legX = (b0 + b1) / 2;
  add('solar-water-heater', ['calentador solar', 'agua caliente solar', 'colector solar', 'solar water heater', 'solar thermal', 'solar collector'], [
    tank,
    rack,
    tube(1 / 3),
    tube(2 / 3),
    line([legX, bot], [legX, GROUND]),
    line([legX - 3.25, GROUND], [legX + 3.25, GROUND]),
  ]);
  // Filled, the tank's foot over the rack is cut, so the tank stays a tank on the merged silhouette
  FILL['solar-water-heater'] = { solid: [0, 'shut:1'], cut: [2, 3, line([a0, top], [a1, top])], wire: [4, 5] };
  PARTS['solar-water-heater'] = { tank: [0], collector: [1, 2, 3], stand: [4, 5] };
}
{
  // Inverter: the converter's box split by its diagonal, DC (=) above it and AC (~) below. The
  // sine is a full period 5 wide, down in the square corner where there is room (3.5 wide, it was a
  // squiggle at 18 px): 3.9 from the diagonal, 3 from the right side and 2.9 above the foot
  const box = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
  const k = 24;
  const diag = line(onDiagonal(box, k, true), onDiagonal(box, k, false));
  const [x0, y, w, a] = [12.75, 16.75, 5, 1.1];
  const sine = `M${pt([x0, y])}C${pt([x0 + w / 6, y - a * 1.33])} ${pt([x0 + w / 3, y - a * 1.33])} ${pt([x0 + w / 2, y])}S${pt([x0 + (5 * w) / 6, y + a * 1.33])} ${pt([x0 + w, y])}`;
  add('inverter', ['inversor', 'corriente alterna', 'corriente directa', 'inverter', 'dc to ac', 'solar inverter'], [
    box,
    diag,
    line([6.25, 7.25], [9.7, 7.25]),
    line([6.25, 10.25], [9.7, 10.25]),
    sine,
  ]);
  FILL.inverter = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS.inverter = { box: [0], divider: [1], dc: [2, 3], ac: [4] };
}

// ── Wind ──────────────────────────────────────────────────────────────────────────────────────
/**
 * The rotor: a round hub of radius 1.5 at H and three long thin blades, one straight stroke each,
 * reaching R from H, one straight up. (Blades drawn as outlines had to be 2.6 wide at the root to
 * stay open at bold: three fins around the mast read as a rocket. Bowed blades read as arms: filled,
 * the turbine was a figure waving.)
 */
const HUB = 1.5;
function rotor(H, R) {
  return [circ(...H, HUB), ...[-90, 30, 150].map((a) => line(polar(...H, HUB, a), polar(...H, R, a)))];
}
/** The mast: a slim tapered tower from the hub's foot (1.5 wide) down to `base` (3.5 wide). */
function mast(H, base, tw = 0.75, bw = 1.75) {
  const hr = HUB;
  const yTop = H[1] + Math.sqrt(hr * hr - tw * tw);
  return `M${pt([H[0] - bw, base])}L${pt([H[0] - tw, yTop])}A${f(hr)} ${f(hr)} 0 0 0 ${pt([H[0] + tw, yTop])}L${pt([H[0] + bw, base])}`;
}
{
  const H = [12, 8.75];
  const R = rotor(H, 7);
  add('wind-turbine', ['aerogenerador', 'turbina eólica', 'energía eólica', 'wind turbine', 'wind power', 'wind energy'], [...R, mast(H, GROUND), ground()]);
  FILL['wind-turbine'] = { solid: [0, 'shut:4'], wire: [1, 2, 3, 5] };
  PARTS['wind-turbine'] = { rotor: [0, 1, 2, 3], mast: [4], ground: [5] };
  MOTION['wind-turbine'] = { effect: 'spin', parts: ['rotor'], origin: H };
}
{
  // Offshore: the same turbine, its mast standing in the sea between two waves
  const H = [12, 8.75];
  const R = rotor(H, 7);
  // The mast tapers down to the near wave and stands straight in the water below it, down to the
  // far wave, which closes it (open, its inside filled in unevenly as the weight grew); the near
  // wave stops at it, the far one runs under it, both in step and 4.5 apart as lugares's water (3
  // apart, their steep flanks met at bold)
  const m = mast(H, 16.25, 0.75, 1.5).replace(/^M[\d.]+ [\d.]+/, `M10.5 ${GROUND}V16.25`) + `V${GROUND}`;
  add('wind-turbine-offshore', ['eólica marina', 'aerogenerador en el mar', 'parque eólico marino', 'offshore wind', 'offshore turbine', 'sea wind'], [
    ...R,
    m,
    ripple(16.25, 4.5, 2),
    flipPath(ripple(16.25, 4.5, 2)),
    ripple(20.75, 4.5, 5),
  ]);
  FILL['wind-turbine-offshore'] = { solid: [0, 'shut:4'], wire: [1, 2, 3, 5, 6, 7] };
  PARTS['wind-turbine-offshore'] = { rotor: [0, 1, 2, 3], mast: [4], water: [5, 6, 7] };
  MOTION['wind-turbine-offshore'] = { effect: 'spin', parts: ['rotor'], origin: H };
}
{
  // Wind farm: two turbines on the ground, the one behind smaller and lower, clear of the first
  const H1 = [8.25, 8.25];
  const H2 = [18, 13.25];
  add('wind-farm', ['parque eólico', 'granja eólica', 'aerogeneradores', 'wind farm', 'wind park', 'wind turbines'], [
    ...rotor(H1, 6.25),
    mast(H1, GROUND),
    ...rotor(H2, 4.5),
    mast(H2, GROUND, 0.75, 1.5),
    ground(),
  ]);
  FILL['wind-farm'] = { solid: [0, 'shut:4', 5, 'shut:9'], wire: [1, 2, 3, 6, 7, 8, 10] };
  PARTS['wind-farm'] = { front: [0, 1, 2, 3, 4], back: [5, 6, 7, 8, 9], ground: [10] };
  MOTION['wind-farm'] = { effect: 'spin', parts: [0, 1, 2, 3], origin: H1 };
}

// ── Water and heat ────────────────────────────────────────────────────────────────────────────
{
  // Dam: the wall's section, upright upstream and sloping downstream, and the reservoir against it
  // (lugares's water, two rows 4.5 apart). (A jet leaving its foot closed a heel with the ground:
  // the wall read as a boot.)
  const wall = roundpoly([[9.25, GROUND], [9.25, 4.25], [12.75, 4.25], [18.25, GROUND]], [0, 0.75, 0.75, 0]);
  add('dam', ['presa', 'represa', 'hidroeléctrica', 'dam', 'reservoir', 'hydro plant'], [wall, ripple(7.25, 3.25, 2), ripple(11.75, 3.25, 2), ground()]);
  FILL.dam = { solid: [0], wire: [1, 2, 3] };
  PARTS.dam = { wall: [0], water: [1, 2], ground: [3] };
}
{
  // Hydropower: lugares's droplet with the bolt in it
  add('hydropower', ['energía hidroeléctrica', 'hidroelectricidad', 'energía del agua', 'hydropower', 'hydroelectric', 'hydro'], [DROP, bolt([12, 13.25])]);
  FILL.hydropower = { solid: [0], cut: [1] };
  PARTS.hydropower = { drop: [0], bolt: [1] };
  MOTION.hydropower = { effect: 'beat', parts: ['bolt'], origin: [12, 13.25] };
}
{
  // Geothermal: the heat under the ground (the flame, 3 under the ground line) and the steam it
  // sends up over it (lugares's hot-spring wisps, 3.25 over the line). (A U of pipe through the
  // ground with steam at its ends read as a plug, or a test tube in its rack.)
  add('geothermal', ['geotermia', 'energía geotérmica', 'calor de la tierra', 'geothermal', 'ground source', 'earth heat'], [
    line([2.75, 11.25], [21.25, 11.25]),
    fire(12, GROUND, 6, 6.5),
    steam(7.75, 8, 5.25, 1),
    steam(12, 8, 5.25, 1),
    steam(16.25, 8, 5.25, 1),
  ]);
  FILL.geothermal = { solid: [1], wire: [0], lines: [2, 3, 4] };
  PARTS.geothermal = { ground: [0], heat: [1], steam: [2, 3, 4] };
  MOTION.geothermal = { effect: 'float', parts: ['steam'], vector: [0, -1.5] };
}
{
  // Biomass: the two-tipped flame, full size, and a leaf on its stem in its round foot (lugares's
  // flame with the leaf where its tongue was read as a drop: the same icon as biofuel). The leaf and
  // its stem are one stroke, centered on the foot (r 7) so both ends stay 3.6 inside it
  const C = [12, 14.25];
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const at = (s) => plus(C, scale(u, s));
  const [S, A, B] = [at(-3.375), at(-1.625), at(3.375)];
  const R = f((1.5 * 1.5 + 6.25) / 3);
  add('biomass', ['biomasa', 'leña', 'pellets', 'biomass', 'bioenergy', 'wood fuel'], [
    fire(12, 21.25, 14, 18.5),
    `M${pt(S)}L${pt(A)}A${R} ${R} 0 0 1 ${pt(B)}A${R} ${R} 0 0 1 ${pt(A)}`,
  ]);
  FILL.biomass = { solid: [0], cut: [1] };
  PARTS.biomass = { flame: [0], leaf: [1] };
  MOTION.biomass = { effect: 'wiggle', parts: ['flame'], origin: [12, 21.25] };
}
{
  // Biofuel: lugares's droplet with a leaf in it
  add('biofuel', ['biocombustible', 'biodiésel', 'etanol', 'biofuel', 'biodiesel', 'ethanol'], [DROP, leaf([10.75, 15.25], [15, 10.5], 3.25), line([10.75, 15.25], [9.35, 16.81])]);
  FILL.biofuel = { solid: [0], cut: [1, 2] };
  PARTS.biofuel = { drop: [0], leaf: [1, 2] };
}

// ── Plants ────────────────────────────────────────────────────────────────────────────────────
{
  // Power plant: a low hall with two slim stacks on its roof, tapering and of two heights, and the
  // bolt as its badge. (Two equal stacks with round tops, filled, read as two raised fingers.) The
  // roof stands at 12.25 so the badge's clearance crosses it cleanly (at 11.25 it grazed the roof
  // and left a sliver of its ink along the cut); the stacks, 3 wide, stand 2.85 apart and clear of it.
  const hall = sq(2.75, 12.25, 18.5, 8.5, 2.5, BR);
  const stack = (x, top) => roundline([[x, 12.25], [x + 0.25, top], [x + 2.75, top], [x + 3, 12.25]], [0, 0.4, 0.4, 0]);
  add('power-plant', ['central eléctrica', 'planta de energía', 'termoeléctrica', 'power plant', 'power station', 'generation'], [hall, stack(3.25, 2.75), stack(9.1, 5.75)], {
    badge: boltBadge(),
  });
  FILL['power-plant'] = { solid: [0, 'shut:1', 'shut:2'] };
  PARTS['power-plant'] = { hall: [0], stacks: [1, 2] };
}
/**
 * A cooling tower's shell: its sides curve in to a waist two thirds up and flare out a little at
 * the top. From (cx ± wb/2, yb) to (cx ± wt/2, yt); open at the bottom when it stands on the ground.
 */
function tower(cx, yb, yt, wb, wt, closed = true) {
  const h = yb - yt;
  const L = [
    [cx - wb / 2, yb],
    [cx - wb / 2 + 0.55 * (wb - wt) + 0.06 * h, yb - 0.45 * h],
    [cx - wt / 2 + 0.16 * h, yt + 0.12 * h],
    [cx - wt / 2, yt],
  ];
  const Rt = L.map(([x, y]) => [2 * cx - x, y]);
  const left = `M${pt(L[0])}C${pt(L[1])} ${pt(L[2])} ${pt(L[3])}`;
  return `${left}L${pt(Rt[3])}C${pt(Rt[2])} ${pt(Rt[1])} ${pt(Rt[0])}${closed ? 'Z' : ''}`;
}
{
  // Nuclear plant: the cooling tower and its steam, beside the domed reactor building
  const shell = tower(7.75, GROUND, 11, 10, 5.5, false);
  const dome = `M14.75 ${GROUND}V14.5A3.25 3.25 0 0 1 21.25 14.5V${GROUND}`;
  add('nuclear-plant', ['central nuclear', 'planta nuclear', 'reactor', 'nuclear plant', 'nuclear power', 'reactor'], [shell, cloud(0.42, [7.75, 8]), dome, ground()]);
  FILL['nuclear-plant'] = { solid: ['shut:0', 1, 'shut:2'], wire: [3] };
  PARTS['nuclear-plant'] = { tower: [0], steam: [1], reactor: [2], ground: [3] };
  MOTION['nuclear-plant'] = { effect: 'float', parts: ['steam'], vector: [0, -1.5] };
}
{
  // Cooling tower: one hyperbolic shell, its mouth wide, and the rounded steam drifting off it. (A
  // narrow mouth under a centered cloud read as a chess pawn.)
  add('cooling-tower', ['torre de enfriamiento', 'torre de refrigeración', 'vapor', 'cooling tower', 'steam', 'thermal plant'], [tower(12, 21.25, 12.25, 14, 10), cloud(0.55, [12.75, 9.25])]);
  FILL['cooling-tower'] = { solid: [0, 1] };
  PARTS['cooling-tower'] = { tower: [0], steam: [1] };
  MOTION['cooling-tower'] = { effect: 'float', parts: ['steam'], vector: [0, -1.5] };
}
{
  // Generator: the engine inside its frame, the bolt on its face, the fuel cap on top and two feet
  const frame = sq(3.25, 3.75, 17.5, 15.25, 3.5);
  add('generator', ['generador', 'planta de luz', 'respaldo', 'generator', 'genset', 'backup power'], [
    frame,
    bolt([12, 11.375]),
    'M14.25 3.75A1.75 1.75 0 0 1 17.75 3.75',
    line([6.5, 19], [6.5, 21.25]),
    line([17.5, 19], [17.5, 21.25]),
  ]);
  FILL.generator = { solid: [0, 'shut:2'], cut: [1], wire: [3, 4] };
  PARTS.generator = { frame: [0], bolt: [1], cap: [2], feet: [3, 4] };
  MOTION.generator = { effect: 'wiggle', origin: [12, 21.25] };
}

// ── The grid ──────────────────────────────────────────────────────────────────────────────────
{
  // Pylon: the tapered tower under its top crossarm, a second crossarm lower down, an X brace in its
  // legs, and the insulators hanging from the arms' ends (a peak over the top arm closed up at bold)
  const top = 4.25;
  const leg = (y) => [10.5 - ((y - top) * 3.75) / (GROUND - top), y];
  const legR = (y) => [24 - leg(y)[0], y];
  const arm = (y, x0, x1) => line([x0, y + 2], [x0, y], [x1, y], [x1, y + 2]);
  add('pylon', ['torre eléctrica', 'alta tensión', 'red eléctrica', 'pylon', 'transmission tower', 'power grid'], [
    line(leg(GROUND), leg(top)),
    line(legR(GROUND), legR(top)),
    arm(top, 4.75, 19.25),
    arm(10, 3.25, 20.75),
    line(leg(13.75), legR(GROUND)),
    line(legR(13.75), leg(GROUND)),
  ]);
  FILL.pylon = false;
  PARTS.pylon = { tower: [0, 1, 4, 5], arms: [2, 3] };
}
/** The utility pole: the pole, its crossarm with an insulator rising at each end, the wires. */
const POLE = {
  pole: line([12, 3.25], [12, GROUND]),
  arm: line([6.25, 4.75], [6.25, 7.25], [17.75, 7.25], [17.75, 4.75]),
  left: 'M6.25 4.75Q4.25 4.75 2.75 7.75',
  right: 'M17.75 4.75Q19.75 4.75 21.25 7.75',
};
{
  add('utility-pole', ['poste de luz', 'poste eléctrico', 'red de distribución', 'utility pole', 'power pole', 'distribution line'], [POLE.pole, POLE.arm, POLE.left, POLE.right]);
  FILL['utility-pole'] = false;
  PARTS['utility-pole'] = { pole: [0], arm: [1], wires: [2, 3] };
  add('utility-pole-alert', ['apagón', 'corte de luz', 'reportar falla', 'power outage', 'blackout', 'outage report'], [POLE.pole, POLE.arm, POLE.left, POLE.right], {
    badge: badge('alert'),
  });
  FILL['utility-pole-alert'] = false;
  PARTS['utility-pole-alert'] = { pole: [0], arm: [1], wires: [2, 3] };
  MOTION['utility-pole-alert'] = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };
}

// ── Storage ───────────────────────────────────────────────────────────────────────────────────
{
  // Home battery: the wall unit standing as a battery, its terminal nub on top (dispositivos's
  // power-bank's, attached) and three charge bars (its levels). (A slab with a status line and bars
  // read as a document; a terminal floating over it, as a document and a dash.)
  add('home-battery', ['batería doméstica', 'almacenamiento', 'respaldo solar', 'home battery', 'energy storage', 'powerwall'], [
    sq(5.75, 5.25, 12.5, 16, 3, BR),
    'M10 5.25V3.5A0.75 0.75 0 0 1 10.75 2.75H13.25A0.75 0.75 0 0 1 14 3.5V5.25',
    line([9, 17.25], [15, 17.25]),
    line([9, 13.25], [15, 13.25]),
    line([9, 9.25], [15, 9.25]),
  ]);
  FILL['home-battery'] = { solid: [0, 'shut:1'], cut: [2, 3, 4] };
  PARTS['home-battery'] = { body: [0, 1], level: [2, 3, 4] };
  icons['home-battery'].levels = [[2], [3], [4]];
}
{
  // Grid battery: a long container, two terminals on its roof and the bolt on its side (its door
  // line made it too dense)
  add('grid-battery', ['batería de red', 'almacenamiento a gran escala', 'contenedor de baterías', 'grid battery', 'battery storage', 'bess'], [
    sq(2.5, 6.25, 19, 15, 3, BR),
    roundline([[5.5, 6.25], [5.5, 3.75], [8.5, 3.75], [8.5, 6.25]], [0, 0.75, 0.75, 0]),
    roundline([[15.5, 6.25], [15.5, 3.75], [18.5, 3.75], [18.5, 6.25]], [0, 0.75, 0.75, 0]),
    bolt([12, 13.75]),
  ]);
  FILL['grid-battery'] = { solid: [0, 'shut:1', 'shut:2'], cut: [3] };
  PARTS['grid-battery'] = { body: [0], terminals: [1, 2], bolt: [3] };
}

// ── Meters ────────────────────────────────────────────────────────────────────────────────────
/** The meters' box: 14.5 wide (the portrait keyline's), radius 3.5, the signature corner. */
const meterBox = (y0) => sq(4.75, y0, 14.5, 21.25 - y0, 3.5, BR);
/** The counter window, 3 clear of the box's foot. */
const WINDOW = sq(8.5, 15.6, 7, 2.8, 1.25);
const ELECTRIC = [meterBox(2.75), circ(12, 9.25, 3.5), line([8.5, 9.25], [15.5, 9.25]), WINDOW];
const GAS_BOX = meterBox(9.25);
{
  add('electric-meter', ['medidor de luz', 'contador eléctrico', 'consumo', 'electric meter', 'electricity meter', 'meter reading'], ELECTRIC);
  FILL['electric-meter'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['electric-meter'] = { box: [0], dial: [1, 2], counter: [3] };
  // Under the pencil the meter keeps its glass only: the counter window was cut into a scrap
  add('electric-meter-edit', ['capturar lectura', 'lectura de luz', 'reportar consumo', 'submit meter reading', 'meter reading', 'electricity reading'], ELECTRIC.slice(0, 3), { badge: badge('edit') });
  FILL['electric-meter-edit'] = { solid: [0], cut: [1, 2] };
  PARTS['electric-meter-edit'] = { box: [0], dial: [1, 2] };
  MOTION['electric-meter-edit'] = { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] };
}
{
  // Smart meter: the squat box with a digital display, its signal rising from the corner
  add('smart-meter', ['medidor inteligente', 'medición remota', 'lectura a distancia', 'smart meter', 'remote reading', 'connected meter'], [
    GAS_BOX,
    sq(7.75, 12.25, 8.5, 4.5, 1.5),
    arc(16.25, 7.5, 2.75, -90, -20).d,
    arc(16.25, 7.5, 5.75, -90, -20).d,
  ]);
  FILL['smart-meter'] = { solid: [0], cut: [1], lines: [2, 3] };
  PARTS['smart-meter'] = { box: [0], display: [1], signal: [2, 3] };
}
/** The water meter: the round body on its pipe, the dial's needle and its pivot. */
const WATER_METER = (() => {
  const r = 6.25;
  const x = 12 - Math.sqrt(r * r - 2.25 * 2.25);
  return [
    circ(12, 12, r),
    `M${pt([x, 9.75])}H3.25V14.25H${f(x)}`,
    `M${pt([24 - x, 9.75])}H20.75V14.25H${f(24 - x)}`,
    line([12, 12], polar(12, 12, 3.25, -45)),
    dot(12, 12),
  ];
})();
{
  add('water-meter', ['medidor de agua', 'contador de agua', 'consumo de agua', 'water meter', 'water reading', 'water usage'], WATER_METER);
  FILL['water-meter'] = { solid: [0, 'shut:1', 'shut:2'], cut: [3, 4] };
  PARTS['water-meter'] = { body: [0], pipe: [1, 2], needle: [3], pivot: [4] };
  icons['water-meter'].value = { turn: { parts: ['needle'], origin: [12, 12], from: -225, to: 45, at: -45 } };
  add('water-meter-edit', ['capturar lectura de agua', 'lectura de agua', 'reportar consumo', 'submit water reading', 'water reading', 'meter reading'], WATER_METER, { badge: badge('edit') });
  FILL['water-meter-edit'] = { solid: [0, 'shut:1', 'shut:2'], cut: [3, 4] };
  PARTS['water-meter-edit'] = { body: [0], pipe: [1, 2], needle: [3], pivot: [4] };
  MOTION['water-meter-edit'] = { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] };
}

// ── Bills and tariffs ─────────────────────────────────────────────────────────────────────────
{
  const C = [12, 11.25];
  add('receipt-electricity', ['recibo de luz', 'factura eléctrica', 'pagar luz', 'electricity bill', 'power bill', 'energy bill'], [RECEIPT, bolt(C)]);
  add('receipt-water', ['recibo de agua', 'factura de agua', 'pagar agua', 'water bill', 'water invoice', 'utility bill'], [RECEIPT, drop(0.5, C)]);
  add('receipt-gas', ['recibo de gas', 'factura de gas', 'pagar gas', 'gas bill', 'gas invoice', 'utility bill'], [RECEIPT, fire(12, 15.75, 7, 9.5)]);
  for (const n of ['receipt-electricity', 'receipt-water', 'receipt-gas']) {
    FILL[n] = { solid: [0], cut: [1] };
    PARTS[n] = { body: [0], mark: [1] };
  }
  // Energy tariff: the price tag and the bolt as its badge (inside, where the dollar is, it had no
  // room: 7.4 wide, it needs 13.4 across the tag)
  add('price-tag-bolt', ['tarifa eléctrica', 'precio de la luz', 'tarifa horaria', 'energy tariff', 'electricity price', 'time of use rate'], [...TAG], { badge: boltBadge() });
  FILL['price-tag-bolt'] = { solid: [0], cut: [1] };
  PARTS['price-tag-bolt'] = { body: [0], hole: [1] };
}
{
  // Home energy: lugares's house, the bolt where its door and window were (as house-temperature)
  add('house-energy', ['energía del hogar', 'consumo de la casa', 'electricidad', 'home energy', 'household power', 'home consumption'], [HOUSE[0], HOUSE[1], bolt([12, 13.4])]);
  FILL['house-energy'] = { solid: ['shut:0', 'shut:1'], cut: [2] };
  PARTS['house-energy'] = { roof: [0], walls: [1], bolt: [2] };
}
{
  // Heat loss: the house (at 78%, from its foot) and three waves of heat rising clear of its roof:
  // over the apex 3 above it, over the slopes 3.75 above them (2.85 square to the slope). (Rising
  // from the roof itself, they read as flames: a house on fire.)
  const k = 0.78;
  const at = [12, GROUND];
  const roof = place(HOUSE[0], k, at);
  const walls = place(HOUSE[1], k, at);
  const door = place(HOUSE[2], k, at);
  const wave = (x, gap, top) => steam(x, topAt(roof, x) - gap, topAt(roof, x) - gap - top, 1);
  add('house-heat-loss', ['pérdida de calor', 'aislamiento', 'eficiencia de la casa', 'heat loss', 'insulation', 'home efficiency'], [roof, walls, door, wave(7.75, 3.75, 3), wave(12, 3, 2.5), wave(16.25, 3.75, 3)]);
  FILL['house-heat-loss'] = { solid: ['shut:0', 'shut:1'], cut: [2], lines: [3, 4, 5] };
  PARTS['house-heat-loss'] = { roof: [0], walls: [1], door: [2], heat: [3, 4, 5] };
  MOTION['house-heat-loss'] = { effect: 'float', parts: ['heat'], vector: [0, -1.5] };
}

// ── Use, saving and rates ─────────────────────────────────────────────────────────────────────
{
  // Power usage: a half dial with five ticks, the bolt at its pivot pointing like a needle
  const O = [12, 15.5];
  const ticks = [180, 225, 270, 315, 360].map((a) => line(polar(...O, 9, a), polar(...O, 6.9, a)));
  add('power-usage', ['consumo eléctrico', 'demanda', 'potencia', 'power usage', 'power draw', 'consumption'], [arc(...O, 9, 180, 360).d, ...ticks, bolt(O, 22.5)]);
  FILL['power-usage'] = false;
  PARTS['power-usage'] = { dial: [0, 1, 2, 3, 4, 5], needle: [6] };
  icons['power-usage'].value = { turn: { parts: ['needle'], origin: O, from: -180, to: 0, at: -67.5 } };
}
{
  // Energy saving: lugares's leaf with the bolt as its badge. (A midrib zigzagging as a bolt read as
  // an N, or a feather: the leaf is 8 across, too narrow for a bolt's jog.)
  const { d, fill } = lugares.icons.leaf;
  add('energy-saving', ['ahorro de energía', 'modo eco', 'eficiencia', 'energy saving', 'eco mode', 'efficiency'], [...d], { badge: boltBadge() });
  FILL['energy-saving'] = { solid: [0], wire: fill.wire, cut: fill.cut };
  PARTS['energy-saving'] = { leaf: [0], vein: [1] };
}
{
  // Renewable energy: two arc arrows chasing each other around the bolt
  const a = arc(12, 12, 8.75, 200, 325);
  const b = arc(12, 12, 8.75, 20, 145);
  add('renewable-energy', ['energía renovable', 'energía limpia', 'energía verde', 'renewable energy', 'clean energy', 'green energy'], [
    a.d,
    head(a.end, a.tangent, 3.4),
    b.d,
    head(b.end, b.tangent, 3.4),
    bolt([12, 11.9]),
  ]);
  FILL['renewable-energy'] = { solid: [4], lines: [0, 1, 2, 3] };
  PARTS['renewable-energy'] = { arrows: [0, 1, 2, 3], bolt: [4] };
  MOTION['renewable-energy'] = { effect: 'spin', parts: ['arrows'], origin: [12, 12] };
}
{
  // Energy rating: the efficiency label's five classes, each longer and ending in a point, and
  // the pointer on the right at the second one
  const H = 3.5;
  const y0 = 3.25;
  const xs = [8.25, 10, 11.75, 13.5, 15.25];
  const pts = [[3.25, y0]];
  const rr = [1];
  xs.forEach((x, i) => {
    const y = y0 + i * H;
    pts.push([x, y], [x + H / 2, y + H / 2], [x, y + H]);
    rr.push(i ? 0 : 0.6, 0.5, 0);
  });
  pts.push([3.25, y0 + 5 * H]);
  rr.push(1);
  const label = roundpoly(pts, rr);
  const dividers = xs.slice(0, 4).map((x, i) => line([3.25, y0 + (i + 1) * H], [x, y0 + (i + 1) * H]));
  const py = y0 + 1.5 * H;
  const pointer = roundpoly([[21.25, py - H / 2], [21.25, py + H / 2], [17.5, py + H / 2], [15.75, py], [17.5, py - H / 2]], [0.6, 0.6, 0.4, 0.5, 0.4]);
  add('energy-rating', ['etiqueta energética', 'clase de eficiencia', 'calificación energética', 'energy rating', 'energy label', 'efficiency class'], [label, ...dividers, pointer]);
  FILL['energy-rating'] = { solid: [0, 5], cut: [1, 2, 3, 4] };
  PARTS['energy-rating'] = { label: [0, 1, 2, 3, 4], pointer: [5] };
}
{
  // Peak hours: the core clock with the bolt as its badge, its hands at 10 and their pivot at (11.5,
  // 11.5) as calendario's clock under a piece. (The bolt turned in place of the hands read as an S,
  // and the four hour marks as a crosshair.)
  add('peak-hours', ['horas pico', 'horario punta', 'tarifa horaria', 'peak hours', 'time of use', 'peak pricing'], [circ(12, 12, 9), line([11.5, 6.35], [11.5, 11.5], [8.2, 9.45])], {
    badge: boltBadge(),
  });
  FILL['peak-hours'] = { solid: [0], cut: [1] };
  PARTS['peak-hours'] = { face: [0], hands: [1] };
  MOTION['peak-hours'] = { effect: 'spin', parts: ['hands'], origin: [11.5, 11.5] };
}
{
  // Off-peak: lugares's moon and a bolt in its hollow
  add('off-peak', ['horario valle', 'tarifa nocturna', 'energía barata', 'off-peak', 'night rate', 'cheap energy'], [lugares.icons.moon.d[0], bolt([17.75, 6.5])]);
  FILL['off-peak'] = { solid: [0, 1] };
  PARTS['off-peak'] = { moon: [0], bolt: [1] };
}

// ── Fuels ─────────────────────────────────────────────────────────────────────────────────────
{
  // Oil barrel: the steel drum, its two rolling hoops and the drop on its front between them
  add('oil-barrel', ['barril de petróleo', 'tambo', 'crudo', 'oil barrel', 'crude oil', 'oil drum'], [
    sq(4.75, 2.75, 14.5, 18.5, 2),
    line([4.75, 6], [19.25, 6]),
    line([4.75, 18], [19.25, 18]),
    drop(0.38, [12, 12]),
  ]);
  FILL['oil-barrel'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['oil-barrel'] = { drum: [0], hoops: [1, 2], drop: [3] };
}
{
  // Oil drop: lugares's droplet (with its shine) over a short pool
  const s = 0.82;
  const to = [12, 3.25 + (17.5 * s) / 2];
  // lugares's shine, at the same angles, kept 3 inside the drop (scaled with it, it came too close)
  const c = [12, to[1] + (13.5 - 12) * s];
  const shine = arc(...c, 7.25 * s - 3, 100, 165);
  add('oil-drop', ['petróleo', 'gota de aceite', 'combustible fósil', 'oil', 'crude', 'fossil fuel'], [
    place(DROP, s, [12, 12], to),
    shine.d,
    line([7.5, GROUND], [16.5, GROUND]),
  ]);
  FILL['oil-drop'] = { solid: [0], cut: [1], wire: [2] };
  PARTS['oil-drop'] = { drop: [0], shine: [1], pool: [2] };
}
{
  // Pumpjack: the walking beam rocking on its A-frame, the horsehead over the well's rod and the
  // counterweight hanging from the other end
  const pivot = [12, 9.5];
  add('pumpjack', ['bomba de petróleo', 'pozo petrolero', 'balancín', 'pumpjack', 'oil well', 'oil pump'], [
    line([8.75, GROUND], pivot, [15.25, GROUND]),
    line([6.5, 8.25], [18.25, 10.5]),
    'M6.5 4.75V12.25A3.75 3.75 0 0 1 6.5 4.75Z',
    line([2.75, 8.5], [2.75, GROUND]),
    sq(16.5, 10.5, 3.5, 4.5, 1),
    ground(),
  ]);
  FILL.pumpjack = { solid: [2, 4], wire: [0, 1, 3, 5] };
  PARTS.pumpjack = { frame: [0], beam: [1, 2, 4], rod: [3], ground: [5] };
  MOTION.pumpjack = { effect: 'wiggle', parts: ['beam'], origin: pivot };
}
{
  // Coal: three faceted lumps in a pile
  add('coal', ['carbón', 'mineral', 'combustible fósil', 'coal', 'fossil fuel', 'mining'], [
    roundpoly([[2.75, 17.25], [5.25, 12.25], [10.25, 11.75], [11.25, 17], [8.25, 20.75], [3.75, 20.5]], 0.7),
    roundpoly([[14.25, 12.25], [19.5, 12.75], [21.25, 17.75], [18.25, 20.75], [13.25, 19.25]], 0.7),
    roundpoly([[7.25, 6.75], [10.5, 3.25], [16, 3.5], [17.25, 7.5], [13.75, 9.5], [8.5, 9.5]], 0.7),
  ]);
  FILL.coal = { solid: [0, 1, 2] };
  PARTS.coal = { lumps: [0, 1, 2] };
}
{
  // Gas cylinder: the bottle with its domed shoulders and its weld band, the collar standing short
  // and square on top and the foot ring under it. (A tall collar with round corners over a valve
  // read as a padlock's shackle.)
  add('gas-cylinder', ['cilindro de gas', 'tanque de gas', 'gas lp', 'gas cylinder', 'lpg', 'propane bottle'], [
    'M6.5 18.25V11.75A5 5 0 0 1 11.5 6.75H12.5A5 5 0 0 1 17.5 11.75V18.25Z',
    roundline([[9.5, 7.3], [9.5, 3.75], [14.5, 3.75], [14.5, 7.3]], [0, 0.75, 0.75, 0]),
    line([7.5, 18.25], [7.5, 21.25], [16.5, 21.25], [16.5, 18.25]),
    line([6.5, 12.75], [17.5, 12.75]),
  ]);
  FILL['gas-cylinder'] = { solid: [0, 'shut:2'], wire: [1], cut: [3] };
  PARTS['gas-cylinder'] = { body: [0, 2, 3], collar: [1] };
}

// ── Water ─────────────────────────────────────────────────────────────────────────────────────
{
  // Water tower: the tank under its conical roof, on four splayed legs with a cross brace
  add('water-tower', ['tanque elevado', 'torre de agua', 'suministro de agua', 'water tower', 'water supply', 'water storage'], [
    roundpoly([[4.75, 7.75], [12, 2.75], [19.25, 7.75]], [0.5, 1, 0.5]),
    sq(5.75, 7.75, 12.5, 5.5, 1.25),
    line([7, 13.25], [4.25, GROUND]),
    line([10.5, 13.25], [9.5, GROUND]),
    line([13.5, 13.25], [14.5, GROUND]),
    line([17, 13.25], [19.75, GROUND]),
    line([5.68, 17], [18.32, 17]),
  ]);
  FILL['water-tower'] = { solid: [0, 1], wire: [2, 3, 4, 5, 6] };
  PARTS['water-tower'] = { roof: [0], tank: [1], legs: [2, 3, 4, 5, 6] };
}
{
  // Water tap: the tap on its wall pipe, the spout turning down, the handle on top, one drop
  add('water-tap', ['llave de agua', 'grifo', 'suministro de agua', 'water tap', 'faucet', 'water supply'], [
    'M2.75 6.75H13.5A5 5 0 0 1 18.5 11.75V13.5H14.5V11.75A1 1 0 0 0 13.5 10.75H2.75',
    line([8.25, 6.75], [8.25, 3.75]),
    line([5.75, 3.75], [10.75, 3.75]),
    drop(0.3, [16.5, 18.5]),
  ]);
  FILL['water-tap'] = { solid: ['shut:0', 3], wire: [1, 2] };
  PARTS['water-tap'] = { tap: [0], handle: [1, 2], drop: [3] };
  MOTION['water-tap'] = { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] };
}
{
  // Hot water: a drop with three waves of heat rising over it
  add('hot-water', ['agua caliente', 'calentar agua', 'temperatura del agua', 'hot water', 'water heating', 'heated water'], [
    drop(0.66, [12, 15.25]),
    steam(7.75, 9.25, 6.5, 1.1),
    steam(12, 6.5, 4.5, 1),
    steam(16.25, 9.25, 6.5, 1.1),
  ]);
  FILL['hot-water'] = { solid: [0], lines: [1, 2, 3] };
  PARTS['hot-water'] = { drop: [0], heat: [1, 2, 3] };
  MOTION['hot-water'] = { effect: 'float', parts: ['heat'], vector: [0, -1.5] };
}
{
  // Water treatment: a wide open tank with two filter beds (dashed) and the drop going in, 3.2 over
  // its rim (closer, filled, the drop merged with the tank into a candle on a cake)
  add('water-treatment', ['planta potabilizadora', 'tratamiento de agua', 'aguas residuales', 'water treatment', 'wastewater', 'filtration'], [
    roundline([[3.25, 11.25], [3.25, GROUND], [20.75, GROUND], [20.75, 11.25]], [0, 2.5, 2.5, 0]),
    line([3.25, 14.75], [6.5, 14.75]),
    line([9.5, 14.75], [14.5, 14.75]),
    line([17.5, 14.75], [20.75, 14.75]),
    line([6.25, 17.75], [11, 17.75]),
    line([14, 17.75], [17.75, 17.75]),
    drop(0.32, [12, 5.25]),
  ]);
  FILL['water-treatment'] = { solid: ['shut:0', 6], cut: [1, 2, 3, 4, 5] };
  PARTS['water-treatment'] = { tank: [0], filters: [1, 2, 3, 4, 5], drop: [6] };
  MOTION['water-treatment'] = { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] };
}

// ── Heating ───────────────────────────────────────────────────────────────────────────────────
{
  // Heating radiator: a wide panel of four rounded columns, a pipe and its valve at each corner below
  const [x0, x1, y0, y1] = [3.25, 20.75, 4.25, 16.75];
  const w = (x1 - x0) / 4;
  const r = w / 2;
  let panel = `M${pt([x0, y1 - r])}V${f(y0 + r)}`;
  for (let i = 0; i < 4; i++) panel += `A${f(r)} ${f(r)} 0 0 1 ${pt([x0 + (i + 1) * w, y0 + r])}`;
  panel += `V${f(y1 - r)}`;
  for (let i = 3; i >= 0; i--) panel += `A${f(r)} ${f(r)} 0 0 1 ${pt([x0 + i * w, y1 - r])}`;
  panel += 'Z';
  const cols = [1, 2, 3].map((i) => line([x0 + i * w, y0 + r], [x0 + i * w, y1 - r]));
  add('heating-radiator', ['radiador', 'calefacción', 'calefacción central', 'radiator', 'heating', 'central heating'], [
    panel,
    ...cols,
    line([x0 + r, y1], [x0 + r, 21.25]),
    line([x1 - r, y1], [x1 - r, 21.25]),
    line([x0 + r - 1.5, 19.75], [x0 + r + 1.5, 19.75]),
    line([x1 - r - 1.5, 19.75], [x1 - r + 1.5, 19.75]),
  ]);
  FILL['heating-radiator'] = { solid: [0], cut: [1, 2, 3], wire: [4, 5, 6, 7] };
  PARTS['heating-radiator'] = { panel: [0, 1, 2, 3], pipes: [4, 5, 6, 7] };
}
{
  // Boiler: the wall-hung box, its display, the flame in its window and three pipes below
  add('boiler', ['caldera', 'calefacción', 'agua caliente', 'boiler', 'heating', 'combi boiler'], [
    sq(4.75, 2.75, 14.5, 14, 3.5, BR),
    line([9.5, 5.75], [14.5, 5.75]),
    fire(12, 13.75, 4.75, 5),
    line([8.75, 16.75], [8.75, 21.25]),
    line([12, 16.75], [12, 21.25]),
    line([15.25, 16.75], [15.25, 21.25]),
  ]);
  FILL.boiler = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
  PARTS.boiler = { body: [0], display: [1], flame: [2], pipes: [3, 4, 5] };
}
{
  // Furnace: the tall cabinet, the burner's flame large on its upper front and the return grille's
  // three upright slots low, everything 3 from the next. No duct: a flue bending off its top read
  // as a juice box's straw, a duct box as a jar's lid or a clipboard's clip, two duct walls as a
  // plug's prongs. Level louvers made the cabinet a page of text (a gas bill).
  add('furnace', ['calefactor', 'horno de calefacción', 'climatización', 'furnace', 'forced air', 'hvac'], [
    sq(4.75, 2.75, 14.5, 18.5, 3.5, BR),
    fire(12, 12.25, 6, 6.5),
    ...[9, 12, 15].map((x) => line([x, 15.25], [x, 18.25])),
  ]);
  FILL.furnace = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS.furnace = { cabinet: [0], flame: [1], grille: [2, 3, 4] };
}

// ── Lighting ──────────────────────────────────────────────────────────────────────────────────
{
  // Compact fluorescent: the tube coiling up from the collar, over sistema's base
  const coil = 'M9 15.25L15.25 13.75A1.5 1.5 0 0 0 15.25 10.75L8.75 12.25A1.5 1.5 0 0 1 8.75 9.25L15.25 7.75A1.5 1.5 0 0 0 15.25 4.75L9 6.25';
  add('lightbulb-spiral', ['foco ahorrador', 'lámpara fluorescente compacta', 'cfl', 'cfl bulb', 'energy saving bulb', 'compact fluorescent'], [coil, line([7.75, 15.25], [16.25, 15.25]), BULB[1], BULB[2]]);
  FILL['lightbulb-spiral'] = false;
  PARTS['lightbulb-spiral'] = { tube: [0], base: [1, 2, 3] };
}
{
  // LED bulb: the flat-topped dome on its tapered heat sink, one fin around it, over sistema's base.
  // (Ribbed upright, the heat sink was a cupcake's wrapper under its frosting.)
  add('lightbulb-led', ['foco led', 'lámpara led', 'iluminación eficiente', 'led bulb', 'led lamp', 'efficient lighting'], [
    'M6 10.25V8.5C6 4.5 8.5 2.75 12 2.75S18 4.5 18 8.5V10.25Z',
    line([6.5, 10.25], [8.25, 15.25], [15.75, 15.25], [17.5, 10.25]),
    line([7.37, 12.75], [16.63, 12.75]),
    BULB[1],
    BULB[2],
  ]);
  FILL['lightbulb-led'] = { solid: [0, 'shut:1'], cut: [2], lines: [3, 4] };
  PARTS['lightbulb-led'] = { dome: [0], heatsink: [1, 2], base: [3, 4] };
}
{
  // Filament bulb: sistema's lightbulb with the filament zigzagging between its two posts
  add('lightbulb-filament', ['foco incandescente', 'foco vintage', 'filamento', 'filament bulb', 'edison bulb', 'incandescent'], [
    BULB[0],
    line([10.5, 15.25], [9.25, 9.5], [10.63, 7.5], [12, 9.5], [13.38, 7.5], [14.75, 9.5], [13.5, 15.25]),
    BULB[1],
    BULB[2],
  ]);
  FILL['lightbulb-filament'] = { solid: [0], cut: [1], lines: [2, 3] };
  PARTS['lightbulb-filament'] = { bulb: [0], filament: [1], base: [2, 3] };
}

// ── Outlets of the world ──────────────────────────────────────────────────────────────────────
// The flat slots are outlined (2.6 wide, open at every weight): as single strokes two of them read
// as pause. The round holes are dispositivos's dots, a larger one a ring. Filled, each hole is cut
// out whole: a slot along its centerline, a ring as a disc.
/** A flat slot centered at (cx, cy), `l` long, turned `deg` from upright. */
function slot(cx, cy, l, deg = 0) {
  const d = capsule(cx - 1.3, cy - l / 2, 2.6, l);
  return deg ? turnPath(d, deg, [cx, cy]) : d;
}
const slotCut = (cx, cy, l, deg = 0) => {
  const d = line([cx, cy - l / 2 + 1.3], [cx, cy + l / 2 - 1.3]);
  return deg ? turnPath(d, deg, [cx, cy]) : d;
};
{
  const outlet = (name, tags, holes) => {
    add(name, tags, [PLATE, ...holes.map((h) => h[0])]);
    FILL[name] = { solid: [0], cut: holes.map((h) => h[1]) };
    PARTS[name] = { plate: [0], holes: holes.map((_, i) => i + 1) };
  };
  const flat = (cx, cy, l, deg = 0) => [slot(cx, cy, l, deg), slotCut(cx, cy, l, deg)];
  const round = (cx, cy) => [dot(cx, cy), dot(cx, cy)];
  const ring = (cx, cy, r) => [circ(cx, cy, r), dot(cx, cy, r - 0.65)];
  outlet('outlet-type-a', ['contacto tipo a', 'enchufe americano', 'méxico', 'type a outlet', 'us socket', 'travel adapter'], [flat(9.25, 12, 5.5), flat(14.75, 12, 4.5)]);
  outlet('outlet-type-b', ['contacto tipo b', 'enchufe con tierra', 'tres patas', 'type b outlet', 'grounded socket', 'travel adapter'], [
    flat(9.25, 9.25, 5),
    flat(14.75, 9.25, 4),
    ['M10.5 18V16.5A1.5 1.5 0 0 1 13.5 16.5V18Z', dot(12, 16.75, 0.75)],
  ]);
  outlet('outlet-type-d', ['contacto tipo d', 'enchufe de india', 'tres orificios', 'type d outlet', 'india socket', 'travel adapter'], [ring(12, 8.75, 1.75), round(8.5, 15.25), round(15.5, 15.25)]);
  outlet('outlet-type-g', ['contacto tipo g', 'enchufe británico', 'reino unido', 'type g outlet', 'uk socket', 'travel adapter'], [flat(12, 8.25, 5), flat(8.5, 15.25, 4, 90), flat(15.5, 15.25, 4, 90)]);
  outlet('outlet-type-i', ['contacto tipo i', 'enchufe australiano', 'china', 'type i outlet', 'australia socket', 'travel adapter'], [flat(8.5, 9.25, 5, 30), flat(15.5, 9.25, 5, -30), flat(12, 16, 4.5)]);
}

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// Own drawings where the snap left a smudge, on the pixel grid (pixel centers at 0.75 + 1.5k):
// fewer pieces, straight where the drawing curved.
{
  // The rotor: a 3-pixel hub, its blades straight (up, and two on 2:1 slopes), a one-pixel mast
  const rotor16 = (H, up, side) => [
    circ(...H, 1.5),
    line([H[0], H[1] - 1.5], [H[0], H[1] - 1.5 - up]),
    line([H[0] - 1.5, H[1] + 0.75], [H[0] - 1.5 - side, H[1] + 0.75 + side / 2]),
    line([H[0] + 1.5, H[1] + 0.75], [H[0] + 1.5 + side, H[1] + 0.75 + side / 2]),
  ];
  const H = [11.25, 8.25];
  const R = rotor16(H, 4.5, 4.5);
  const ground16 = line([3.75, 20.25], [18.75, 20.25]);
  const mast16 = line([H[0], 9.75], [H[0], 20.25]);
  icons['wind-turbine'].small = { d: [...R, mast16, ground16], fill: { solid: [R[0]], wire: [...R.slice(1), mast16, ground16] } };
  // The sea: two rows of half waves 3 pixels wide and 1 pixel high, a pixel apart (2 wide, they
  // snapped to a checkerboard); the mast stands on the near row where it crosses its middle
  const wave16 = (y) => {
    let d = `M2.25 ${f(y)}`;
    for (let i = 0; i < 4; i++) {
      const [x, s] = [2.25 + 4.5 * i, i % 2 ? 2 : -2];
      d += `C${f(x + 1.5)} ${f(y + s)} ${f(x + 3)} ${f(y + s)} ${f(x + 4.5)} ${f(y)}`;
    }
    return d;
  };
  const sea = [line([H[0], 9.75], [H[0], 15.75]), wave16(15.75), wave16(20.25)];
  icons['wind-turbine-offshore'].small = { d: [...R, ...sea], fill: { solid: [R[0]], wire: [...R.slice(1), ...sea] } };
  const F = rotor16([6.75, 6.75], 3, 3);
  const B = rotor16([15.75, 12.75], 3, 3);
  const farm = [line([6.75, 8.25], [6.75, 20.25]), line([15.75, 14.25], [15.75, 20.25]), line([2.25, 20.25], [21.75, 20.25])];
  icons['wind-farm'].small = { d: [...F, ...B, ...farm], fill: { solid: [F[0], B[0]], wire: [...F.slice(1), ...B.slice(1), ...farm] } };
}
{
  // Meters: the electric meter's glass and counter on the pixels; the water meter's body, its pipe
  // as two stubs and a short needle
  const box = sq(5.25, 2.25, 13.5, 19.5, 3, BR);
  const glass = circ(12, 9, 3.75);
  const disc = line([8.25, 9.75], [15.75, 9.75]);
  const counter = sq(8.25, 15.75, 7.5, 3, 0.75);
  icons['electric-meter'].small = { d: [box, glass, disc, counter], fill: { solid: [box], cut: [glass, disc, counter] } };
  icons['electric-meter-edit'].small = { d: [box, glass, disc], fill: { solid: [box], cut: [glass, disc] } };
  const body = circ(12, 12, 5.25);
  const stub = (x0, x1) => `M${f(x0)} 9.75H${f(x1)}V14.25H${f(x0)}`;
  const water = [body, stub(7.25, 2.25), stub(16.75, 21.75), line([11.25, 12.75], [14.25, 9.75])];
  const waterFill = { solid: [body, shut(water[1]), shut(water[2])], cut: [water[3]] };
  icons['water-meter'].small = { d: water, fill: waterFill };
  icons['water-meter-edit'].small = { d: water, fill: waterFill };
}
{
  // Outlets: dispositivos's 16 px plate; the slots one pixel wide, the round holes its dots
  const plate = dispositivos.icons.outlet.small.d[0];
  const outlet16 = (name, holes) => {
    icons[name].small = { d: [plate, ...holes], fill: { solid: [plate], cut: holes } };
  };
  outlet16('outlet-type-a', [line([9.75, 9.75], [9.75, 14.25]), line([14.25, 11.25], [14.25, 14.25])]);
  // A round hole is a 2 × 2 pixel block
  const hole = (x, y) => `M${f(x)} ${f(y)}H${f(x + 1.5)}V${f(y + 1.5)}H${f(x)}Z`;
  outlet16('outlet-type-b', [line([9.75, 6.75], [9.75, 11.25]), line([14.25, 8.25], [14.25, 11.25]), hole(11.25, 14.25)]);
  outlet16('outlet-type-d', [hole(11.25, 6.75), hole(6.75, 14.25), hole(15.75, 14.25)]);
  outlet16('outlet-type-g', [line([11.25, 6.75], [11.25, 9.75]), line([6.75, 15.75], [8.25, 15.75]), line([14.25, 15.75], [15.75, 15.75])]);
  outlet16('outlet-type-i', [line([8.25, 6.75], [6.75, 9.75]), line([14.25, 6.75], [15.75, 9.75]), line([11.25, 14.25], [11.25, 17.25])]);
}
{
  // Bulbs: the coil in three level turns, the LED's heat sink without its fin, the filament a
  // single peak on its posts; over sistema's base on the pixels
  const base = [line([9.75, 18.75], [14.25, 18.75]), line([10.5, 21.75], [13.5, 21.75])];
  const coil = 'M8.25 12.75H15.75A2.25 2.25 0 0 0 15.75 8.25H8.25A2.25 2.25 0 0 1 8.25 3.75H15.75';
  icons['lightbulb-spiral'].small = { d: [coil, line([7.5, 15.75], [16.5, 15.75]), ...base] };
  const dome = 'M6.75 9.75V8.25C6.75 4.5 9 2.25 12 2.25S17.25 4.5 17.25 8.25V9.75Z';
  const sink = line([7.5, 9.75], [9, 15.75], [15, 15.75], [16.5, 9.75]);
  icons['lightbulb-led'].small = { d: [dome, sink, ...base], fill: { solid: [dome, shut(sink)], lines: base } };
  icons['lightbulb-filament'].small = {
    d: [BULB[0], line([10.5, 15.25], [9.75, 9.75], [12, 7.5], [14.25, 9.75], [13.5, 15.25]), BULB[1], BULB[2]],
    fill: { solid: [BULB[0]], cut: [line([10.5, 15.25], [9.75, 9.75], [12, 7.5], [14.25, 9.75], [13.5, 15.25])], lines: [BULB[1], BULB[2]] },
  };
}

// ── Fill, parts, motion and variants ──────────────────────────────────────────────────────────
// FILL entries are indices into d, 'shut:i' (that stroke closed, for `solid`) or paths of their own
const pick = (name, list) => list.map((x) => (typeof x === 'number' ? icons[name].d[x] : typeof x === 'string' && x.startsWith('shut:') ? shut(icons[name].d[Number(x.slice(5))]) : x));
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, pick(name, v)]));
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// Badges: the drawing under them is not enclosed again, nor slashed
for (const name of Object.keys(icons)) if (icons[name].badge) icons[name].variants = { circle: false, square: false, slash: false };
// Already enclosed: a square plate or box, a round face
for (const name of ['inverter', 'outlet-type-a', 'outlet-type-b', 'outlet-type-d', 'outlet-type-g', 'outlet-type-i']) icons[name].variants = { ...icons[name].variants, square: false };
for (const name of ['peak-hours', 'renewable-energy']) icons[name].variants = { ...icons[name].variants, circle: false };

export default { category: 'energia', label: 'Energía y servicios', icons };
