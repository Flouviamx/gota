// Clima y cielo (weather and sky), round 11: the conditions lugares didn't draw (thunder by day and
// night, showers, sleet, freezing rain, heavy rain and snow, wind with rain, hurricanes, sand, smoke,
// heat and cold waves, mist and haze, frost and ice), wind speed and direction, humidity, pressure,
// UV, visibility, the seasons, forecasts, weather stations and the weather map's fronts. Drawn with
// the engine (engine/geometry.mjs) and the rules in DESIGN.md.
// - It builds on lugares's weather: the same cloud (three circles and a flat base, `cloud(k, o)`),
//   the same sun (a disc and rays from r + 3 to r + 5.1), the same moon, and one set of
//   precipitation marks for the whole family: lugares's rain streak, drizzle dash, six-armed flake,
//   hailstone dot and storm bolt. Whatever sits behind a cloud goes under it as a custom piece and
//   the engine clears it (lugares's `cloudBadge`).
// - thermometer-* builds on lugares's thermometer (its glass, moved left), umbrella-* on its umbrella,
//   calendar-cloud-sun on calendario's calendar-sun, map-weather on lugares's map, weather-radar on
//   sistema's radar, frost on lugares's snowflake, sandstorm on lugares's desert and wind, snow-depth
//   on nautica's wave-height arrow, season-winter on plantas's bare tree; the droplets are lugares's
//   droplet.
import { arc, badge, circ, dot, f, halfChord, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import calendario from './calendario.mjs';
import edicion from './edicion.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import personas from './personas.mjs';
import plantas from './plantas.mjs';
import sistema from './sistema.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => scale(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const L = lugares.icons;
/** A path scaled by `s` about `c` and set down with `c` at `to`. */
const place = (d, s, c, to = c) => transform(d, s, to[0] - c[0] * s, to[1] - c[1] * s);
/** Just the `A…` of an arc, to chain it after a line. */
const arcOn = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]+/, '');
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
    const S = plus(V, scale(u, t));
    const E = plus(V, scale(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Intersections of two circles [x, y, r]. */
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
const angOf = ([cx, cy], [x, y]) => deg(Math.atan2(y - cy, x - cx));

/** Ellipse from four cubics (lugares's). */
function ellipse(cx, cy, rx, ry) {
  const k = 0.5523;
  return `M${pt([cx + rx, cy])}C${pt([cx + rx, cy + k * ry])} ${pt([cx + k * rx, cy + ry])} ${pt([cx, cy + ry])}C${pt([cx - k * rx, cy + ry])} ${pt([cx - rx, cy + k * ry])} ${pt([cx - rx, cy])}C${pt([cx - rx, cy - k * ry])} ${pt([cx - k * rx, cy - ry])} ${pt([cx, cy - ry])}C${pt([cx + k * rx, cy - ry])} ${pt([cx + rx, cy - k * ry])} ${pt([cx + rx, cy])}Z`;
}

// ── Measuring paths (to fit pieces with the set's clearance) ──────────────────────────────────
/** Points every ~0.1 along a path (any engine path: absolute after `transform`). */
function samples(d) {
  const toks = transform(d, 1, 0, 0).match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const out = [];
  let cur = [0, 0];
  let start = [0, 0];
  let cmd = '';
  let i = 0;
  const num = () => Number(toks[i++]);
  const seg = (a, b) => {
    const n = Math.max(1, Math.ceil(len(sub(b, a)) / 0.1));
    for (let k = 1; k <= n; k++) out.push(lerp(a, b, k / n));
  };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'M') {
      cur = start = [num(), num()];
      out.push(cur);
    } else if (cmd === 'L' || cmd === 'T') {
      const p = [num(), num()];
      seg(cur, p);
      cur = p;
    } else if (cmd === 'H') {
      const p = [num(), cur[1]];
      seg(cur, p);
      cur = p;
    } else if (cmd === 'V') {
      const p = [cur[0], num()];
      seg(cur, p);
      cur = p;
    } else if (cmd === 'C' || cmd === 'S' || cmd === 'Q') {
      const k = cmd === 'C' ? 3 : 2;
      const pts = Array.from({ length: k }, () => [num(), num()]);
      const [c1, c2, p] = k === 3 ? pts : [pts[0], pts[0], pts[1]];
      for (let q = 1; q <= 64; q++) {
        const t = q / 64;
        const u = 1 - t;
        out.push([0, 1].map((j) => u * u * u * cur[j] + 3 * u * u * t * c1[j] + 3 * u * t * t * c2[j] + t * t * t * p[j]));
      }
      cur = p;
    } else if (cmd === 'A') {
      const [rx0, ry0, phi, fa, fs] = [num(), num(), num(), num(), num()];
      const p = [num(), num()];
      const r = rad(phi);
      const [cs, sn] = [Math.cos(r), Math.sin(r)];
      const dx = (cur[0] - p[0]) / 2;
      const dy = (cur[1] - p[1]) / 2;
      const x1 = cs * dx + sn * dy;
      const y1 = -sn * dx + cs * dy;
      let [rx, ry] = [Math.abs(rx0), Math.abs(ry0)];
      const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
      if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
      const n2 = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
      const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, n2 / (rx * rx * y1 * y1 + ry * ry * x1 * x1)));
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
        out.push([cs * ex - sn * ey + c[0], sn * ex + cs * ey + c[1]]);
      }
      cur = p;
    } else if (cmd === 'Z' || cmd === 'z') {
      seg(cur, start);
      cur = start;
    } else i++;
  }
  return out;
}
/** The shortest distance between two paths (centerlines). */
const gap = (a, b) => {
  const B = samples(b);
  return Math.min(...samples(a).map((p) => Math.min(...B.map((q) => len(sub(p, q))))));
};
/** Does the stroke stay `D` clear of every path in `others` (centerline to centerline)? */
const clearAll = (d, others, D = 3) => others.every((o) => gap(d, o) >= D);
/** Does the stroke stay inside the live area (1.75–22.25)? */
const inArea = (d) => samples(d).every(([x, y]) => x >= 1.75 && x <= 22.25 && y >= 1.75 && y <= 22.25);

// ── The weather pieces (lugares's) ────────────────────────────────────────────────────────────
// The cloud: three circles and a flat base, `k` scales it around (12, 12) and `o` moves it.
const CLOUD = [[7.25, 14.25, 4], [12.5, 10.75, 5.5], [17.25, 14.5, 3.75]];
const cloudCircles = (k = 1, o = [0, 0]) => CLOUD.map(([x, y, r]) => [o[0] + 12 + (x - 12) * k, o[1] + 12 + (y - 12) * k, r * k]);
function cloud(k = 1, o = [0, 0]) {
  const [A, B, C] = cloudCircles(k, o);
  const top = (P, Q) => meet(P, Q).sort((p, q) => p[1] - q[1])[0];
  const ab = top(A, B);
  const bc = top(B, C);
  const base = A[1] + A[2];
  const ccw = (P, a0, a1, to) => {
    const span = (((a0 - a1) % 360) + 360) % 360;
    return `A${f(P[2])} ${f(P[2])} 0 ${span > 180 ? 1 : 0} 0 ${pt(to)}`;
  };
  return `M${pt([C[0], base])}${ccw(C, 90, angOf(C, bc), bc)}${ccw(B, angOf(B, bc), angOf(B, ab), ab)}${ccw(A, angOf(A, ab), 90, [A[0], base])}Z`;
}
/** Is the point inside the cloud (k, o)? */
function inCloud(p, k = 1, o = [0, 0]) {
  const [A, B, C] = cloudCircles(k, o);
  const base = A[1] + A[2];
  if ([A, B, C].some(([x, y, r]) => len(sub(p, [x, y])) < r)) return true;
  return p[0] > A[0] && p[0] < C[0] && p[1] < base && p[1] > Math.min(A[1], C[1]);
}
/** Does the stroke stay D clear of the cloud (3 center to center, on the outside)? */
function clearOf(d, k, o, D = 3) {
  const edge = samples(cloud(k, o));
  return samples(d).every((p) => !inCloud(p, k, o) && Math.min(...edge.map((q) => len(sub(p, q)))) >= D);
}
/** A cloud on top of another piece: the engine clears what's behind with 1.5 of clearance. */
const cloudBadge = (d) => ({ d: [d], knock: d, fill: { solid: [d] } });
// Rain cloud: lugares's, a bit smaller and higher, leaving 5 of sky below (its base at 14.4).
const RK = 0.88;
const RO = [0, -3.1];
const RAIN_CLOUD = cloud(RK, RO);
// A higher cloud for what needs more sky under it (freezing rain, rain blown by the wind): base 12.6.
const HK = 0.8;
const HO = [0, -4.4];
const HIGH_CLOUD = cloud(HK, HO);

// The precipitation marks, one set for the whole family (lugares's): the rain streak, the drizzle
// dash, the six-armed flake, the hailstone and the storm's bolt.
const streak = ([x, y], h = 4) => line([x, y], [x - (1.5 * h) / 4, y + h]);
const dash = ([x, y]) => line([x, y], [x - 0.7, y + 2]);
const flake = ([x, y], r = 2) => [90, 150, 210].map((a) => line(polar(x, y, r, a), polar(x, y, r, a + 180)));
const hail = ([x, y]) => dot(x, y);
const BOLT_PTS = [[13, 17.25], [10.75, 19.5], [13.5, 19.5], [11.5, 21.75]];
const bolt = ([dx, dy] = [0, 0], k = 1) => {
  const c = [12.125, 19.5];
  return roundline(BOLT_PTS.map((p) => plus(plus(c, scale(sub(p, c), k)), [dx, dy])), [0, 0.4 * k, 0.4 * k, 0]);
};

/** Sun: a disc of radius r and rays from r + 3 to r + 5.1 (lugares's). */
const sunRays = (c, r, n = 8, a0 = 0, l0 = 3, l1 = 5.1) => Array.from({ length: n }, (_, i) => line(polar(...c, r + l0, a0 + (i * 360) / n), polar(...c, r + l1, a0 + (i * 360) / n)));
/** Crescent moon: the disc of radius R minus the one of radius r centered at `ic` (lugares's). */
function moon(c, R, ic, r) {
  const [p, q] = meet([...c, R], [...ic, r]);
  return `M${pt(p)}A${f(R)} ${f(R)} 0 1 0 ${pt(q)}A${f(r)} ${f(r)} 0 0 1 ${pt(p)}Z`;
}
/**
 * The bigger snowflake (frost's): lugares's six arms, here
 * through the center (its hollow doesn't fit at this size), each with a V that opens outward at 0.63
 * of the arm. At 30° its ends keep 3 from the next arm's.
 */
function bigFlake(c, R) {
  const arms = [-90, -30, 30].map((a) => line(polar(...c, R, a), polar(...c, R, a + 180)));
  const vees = [-90, -30, 30, 90, 150, 210].map((a) => {
    const p = polar(...c, R * 0.63, a);
    return line(polar(...p, R * 0.37, a - 30), p, polar(...p, R * 0.37, a + 30));
  });
  return [...arms, ...vees];
}
/**
 * A wave that starts and ends on a crest, level there (so stacked waves keep 3 between their ends):
 * n half waves of width h and amplitude a from x0, each a cubic close to a cosine.
 */
function swell(y, x0, n, h = 3, a = 0.6) {
  let s = -1;
  let d = `M${pt([x0, y + s * a])}`;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * h;
    d += `C${pt([x + h * 0.36, y + s * a])} ${pt([x + h * 0.64, y - s * a])} ${pt([x + h, y - s * a])}`;
    s = -s;
  }
  return d;
}
/** A gust: a straight run to `x1` that curls up (or down) at its end, lugares's wind. */
const gust = (x0, y, x1, r = 2.25, up = true) => (up ? `M${pt([x0, y])}H${f(x1)}${arcOn(x1, y - r, r, 90, -180)}` : `M${pt([x0, y])}H${f(x1)}${arcOn(x1, y + r, r, -90, 180)}`);
/** The same gust running to the left (its curl at the left end). */
const gustLeft = (x0, y, x1, r = 2.25, up = true) => (up ? `M${pt([x0, y])}H${f(x1)}${arcOn(x1, y - r, r, 90, 360)}` : `M${pt([x0, y])}H${f(x1)}${arcOn(x1, y + r, r, 270, 0)}`);

// lugares's droplet (the logomark's drop, corner up) and its drawing at any size.
const drop2 = ([cx, cy], r) => {
  const a = polar(cx, cy, r, -45);
  const b = polar(cx, cy, r, -135);
  return `M${pt(a)}A${f(r)} ${f(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
};
const DROP = drop2([12, 13.5], 7.25);
// lugares's thermometer glass (a 5.8 tube on a bulb of 4.5 centered at 16.75), moved to `x`.
const glass = (x) => place(L.thermometer.d[0], 1, [12, 0], [x, 0]);
const mercury = (x, top) => line([x, top], [x, 16.75]);

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Thunder, rain and snow under one cloud ────────────────────────────────────────────────────
add('cloud-lightning', ['rayos', 'tormenta seca', 'relámpagos', 'truenos', 'lightning', 'dry thunderstorm', 'thunder'], [RAIN_CLOUD, bolt()]);
// Hail instead of the storm's drops: two hailstones beside the bolt, 2.9 clear of it.
add('storm-hail', ['tormenta con granizo', 'granizada', 'tormenta severa', 'hailstorm', 'severe thunderstorm', 'hail'], [RAIN_CLOUD, bolt(), hail([7.25, 18.5]), hail([17, 18.5])]);
// The bolt moves left, out of the badge's clearance (7.25 from its center), and one drop stays.
add('storm-alert', ['alerta de tormenta', 'aviso meteorológico', 'tiempo severo', 'storm warning', 'severe weather', 'weather alert'], [RAIN_CLOUD, bolt([-3.25, 0]), line([4.75, 17.25], [3.85, 19.75])], { badge: badge('alert') });
// Heavy rain: four streaks 3.25 apart (3 across their slant), longer, down to 22.
add('cloud-rain-heavy', ['lluvia intensa', 'aguacero', 'chaparrón', 'diluvio', 'heavy rain', 'downpour', 'torrential rain'], [RAIN_CLOUD, ...[7.25, 10.5, 13.75, 17].map((x) => streak([x, 17.25], 4.75))]);
// Heavy snow: three flakes in a row under the rain cloud (cloud-snow has two), 6.4 apart so their
// side arms keep 2.85 between them.
add('cloud-snow-heavy', ['nevada intensa', 'tormenta de nieve', 'mucha nieve', 'heavy snow', 'snowstorm', 'snowfall'], [RAIN_CLOUD, ...[5.6, 12, 18.4].flatMap((x) => flake([x, 19.25]))]);
// Flurries: a single flake under the rain cloud, where cloud-snow has two and cloud-snow-heavy three (a
// flake and a dot read as hail: the dot is the family's hailstone).
add('cloud-flurries', ['nieve ligera', 'aguanieve ligera', 'copos', 'flurries', 'light snow', 'snow showers'], [RAIN_CLOUD, ...flake([12, 19.25])]);
// Sleet: a streak on each side of a flake, 3.2 clear of its arms.
add('cloud-sleet', ['aguanieve', 'lluvia y nieve', 'mezcla invernal', 'sleet', 'wintry mix', 'rain and snow'], [RAIN_CLOUD, streak([7.25, 17.25]), ...flake([12, 19.25]), streak([18.5, 17.25])]);
{
  // Freezing rain: two drops land on the ground and the ground hangs two icicles beside them, the
  // icicles' own wedges (4 wide: their hole stays open at every weight). Thin spikes read as lines, and
  // with the drops crossing the ground the whole read as a fence or a hash. Each drop starts 2.9 clear
  // of the icicles' corners and lands between them.
  const G = 17.75;
  const icicle = (x, h) => roundpoly([[x - 2, G], [x + 2, G], [x, G + h]], [0, 0, 0.6]);
  const h = G - 15.5;
  add('cloud-freezing-rain', ['lluvia helada', 'lluvia engelante', 'tormenta de hielo', 'freezing rain', 'ice storm', 'glaze'], [
    HIGH_CLOUD,
    streak([7.65, 15.5], h),
    streak([15.4, 15.5], h),
    line([2.75, G], [21.25, G]),
    icicle(11.5, 4),
    icicle(19.25, 3.5),
  ]);
}
{
  // Wind-driven rain: steep streaks blown to the left, 3 apart across their slant, and under them
  // one gust flowing the same way that curls up at its end, clear of them.
  const o = [0.75, -4.4];
  const sl = ([x, y], h) => line([x, y], [x - h * 0.75, y + h]);
  add('cloud-rain-wind', ['lluvia con viento', 'chubasco', 'turbonada', 'temporal', 'wind-driven rain', 'rain squall', 'storm'], [
    cloud(HK, o),
    sl([12.75, 15.5], 3),
    sl([16.5, 15.5], 3),
    sl([20.25, 15.5], 3),
    `M21.25 21.5H7.25${arcOn(7.25, 19.25, 2.25, 90, 270)}`,
  ]);
}
// Windy and cloudy: lugares's wind under the rain cloud, a gust that curls down and a short one.
add('cloud-wind', ['nublado y ventoso', 'viento', 'brisa', 'cloudy and windy', 'breezy', 'windy'], [RAIN_CLOUD, gust(3.5, 17.25, 15.75, 2.25, false), line([3.5, 21], [10.25, 21])]);

// ── The sky over the weather: sun or moon behind a cloud, precipitation under it ──────────────
// lugares's cloud-sun and cloud-moon with their cloud smaller (0.66) and higher, up and to the
// right, so the marks fit under it: the sun stays where cloud-sun has it (9.75, 9.75; its top ray
// reaches the live area) with the rays that keep 1.5 clear of the cloud, and the moon moves up
// 0.25. The marks keep their shapes, shortened to the sky left under the base (15.5).
const SKY_K = 0.66;
const SKY_O = [3.8, -0.6];
const SKY_CLOUD = cloud(SKY_K, SKY_O);
const SUN_C = [9.75, 9.75];
const SKY_SUN = [circ(...SUN_C, 2.5), ...sunRays(SUN_C, 2.5).filter((r) => clearOf(r, SKY_K, SKY_O))];
const SKY_MOON = [moon([8.75, 8.75], 6, [13.75, 6.75], 5.25)];
const SKY_Y = 18.55;
const SKY_MARKS = {
  lightning: [bolt([3.875, 0.8], 0.8)],
  rain: [13.2, 16.5, 19.8].map((x) => streak([x, SKY_Y], 2.9)),
  // lugares's drizzle stagger, 3.75 apart: the low dash keeps 3 from the high ones' ends
  drizzle: [[13.25, SKY_Y], [17, 20.1], [20.75, SKY_Y]].map(dash),
  snow: [...flake([13.25, 20.15], 1.6), ...flake([19, 20.15], 1.6)],
  // A hailstone the cloud's clearance reaches is removed whole: at 20.75 they stay clear of it at
  // every weight
  hail: [hail([13.75, 20.75]), hail([18.75, 20.75])],
};
const SKY_TAGS = {
  lightning: [['tormentas aisladas', 'tormenta eléctrica', 'rayos', 'isolated thunderstorms', 'scattered thunderstorms'], ['tormenta nocturna', 'rayos de noche', 'thunderstorms at night', 'night storm']],
  rain: [['chubascos', 'lluvia con sol', 'lluvia dispersa', 'sun showers', 'scattered showers'], ['lluvia nocturna', 'chubascos de noche', 'night rain', 'showers at night']],
  drizzle: [['llovizna', 'lluvia ligera', 'sol y llovizna', 'drizzle', 'light rain'], ['llovizna nocturna', 'lluvia ligera de noche', 'night drizzle', 'light rain at night']],
  snow: [['nevada con sol', 'chubascos de nieve', 'copos', 'snow showers', 'sun flurries'], ['nieve de noche', 'nevada nocturna', 'night snow', 'snow at night']],
  hail: [['granizo', 'granizada de día', 'tormenta de granizo', 'hail', 'daytime hail'], ['granizo de noche', 'granizada nocturna', 'night hail', 'hail at night']],
};
for (const [kind, marks] of Object.entries(SKY_MARKS)) {
  add(`cloud-sun-${kind}`, SKY_TAGS[kind][0], [...SKY_SUN, ...marks], { badge: cloudBadge(SKY_CLOUD) });
  add(`cloud-moon-${kind}`, SKY_TAGS[kind][1], [...SKY_MOON, ...marks], { badge: cloudBadge(SKY_CLOUD) });
}

// ── Wind, storms and air ──────────────────────────────────────────────────────────────────────
// lugares's wind: its top gust whole, the middle one straight and ending clear of the badge.
add('wind-alert', ['alerta de viento', 'vendaval', 'aviso de viento', 'wind advisory', 'gale warning', 'high wind'], [L.wind.d[0], line([2.75, 12.75], [11.25, 12.75]), L.wind.d[2]], { badge: badge('alert') });
// Hurricane: the tropical cyclone's map symbol, an eye and two arms that leave it on opposite sides
// and hook away from it, turned 30° as the symbol is drawn. Long, gentle arms read as a bead on a
// string; arms wrapped round the eye, as espacio's galaxy.
const hurricaneSymbol = (c, r, R, sweep = 120, tilt = 30) => {
  const arm = turnPath(arc(c[0], c[1] - r - R, R, 90, 90 + sweep).d, tilt, c);
  return [circ(...c, r), arm, turnPath(arm, 180, c)];
};
add('hurricane', ['huracán', 'tifón', 'ciclón tropical', 'tormenta tropical', 'hurricane', 'typhoon', 'tropical cyclone'], hurricaneSymbol([12, 12], 3.25, 4.25, 115));
let HT_TRACK;
{
  // Forecast track: the hurricane at the bottom left and, ahead of it, the forecast's dashed track,
  // an arc arrow curving from up and right to the right (a closed cone read as a pizza slice, a flag
  // or an ice-cream cone). The dashes are 3.1 apart, so their ends never meet at bold.
  const c = [6.25, 15.75];
  const Rt = 10.5;
  const start = polar(...c, 5.75, -22);
  // Clockwise from heading -60° to heading 0°: the center sits 90° to the right of the heading
  const O = plus(start, scale([Math.cos(rad(30)), Math.sin(rad(30))], Rt));
  const [a0, a1] = [-150, -90];
  const n = 2;
  const g = 3.1;
  const dl = (((a1 - a0) * Math.PI * Rt) / 180 - (n - 1) * g) / n;
  const [da, ga] = [dl, g].map((s) => (s / (Math.PI * Rt)) * 180);
  const dashes = Array.from({ length: n }, (_, i) => arc(...O, Rt, a0 + i * (da + ga), a0 + i * (da + ga) + da));
  const last = dashes[n - 1];
  HT_TRACK = arc(...O, Rt, a0, a1);
  add('hurricane-track', ['trayectoria del huracán', 'cono de incertidumbre', 'pronóstico de huracán', 'hurricane track', 'forecast cone', 'storm path'], [
    ...hurricaneSymbol(c, 1.75, 2.5),
    ...dashes.map((x) => x.d),
    head(last.end, last.tangent, 3.4),
  ]);
}
// Sandstorm: lugares's wind (its top gust and a straight one) blowing over lugares's desert, its two
// dunes lower; the front dune and the ground go on top as a custom piece, as in the desert. Gusts with
// grains between them read as a set of sliders or a list.
const DUNE_BACK = 'M2.75 20.75C5.5 19 8 15.25 10.5 15.25C12.25 15.25 13.25 18 15 20.75';
const DUNE_FRONT = 'M9.75 20.75C12.5 19.5 14.5 17 16.75 17C18.5 17 19.75 19 21.25 20.75';
add('sandstorm', ['tormenta de arena', 'tolvanera', 'polvo', 'haboob', 'sandstorm', 'dust storm', 'dust'], [gust(2.75, 7.5, 14.5), line([2.75, 11.25], [18.5, 11.25]), DUNE_BACK], {
  badge: { d: [DUNE_FRONT, line([2.75, 20.75], [21.25, 20.75])], knock: `${DUNE_FRONT}Z`, fill: { solid: [`${DUNE_FRONT}Z`], wire: [line([2.75, 20.75], [21.25, 20.75])] } },
});
// Blizzard: two flakes driven sideways by long gusts, no cloud.
add('blizzard', ['ventisca', 'tormenta de nieve', 'nieve y viento', 'blizzard', 'blowing snow', 'snowstorm'], [
  line([10.5, 5.5], [21.25, 5.5]),
  gust(2.75, 11, 16.5, 2.25, false),
  line([2.75, 17.5], [11, 17.5]),
  ...flake([5.75, 5.75]),
  ...flake([18.5, 20]),
]);
// Smoke: two plumes rising from the ground in an S, their tops bent over to the right.
add('smoke', ['humo', 'humareda', 'incendio', 'calidad del aire', 'smoke', 'smoky', 'wildfire smoke'], [
  'M7 21.25C4.5 17.75 9.75 15 7.5 11.25C5.75 8.25 7.5 4.25 12.75 3.75',
  'M15 21.25C13 18.5 17.75 16.5 15.75 13.25C14.5 11.25 16.25 8.75 20.5 8.75',
]);
{
  // Lightning strike: a jagged bolt that hits the ground, two short sparks beside the hit.
  const G = 20.5;
  const P = [[15.5, 2.75], [8.75, 12], [14.25, 12], [11.5, G]];
  const hit = P[3];
  const spark = (a) => line(polar(...hit, 5, a), polar(...hit, 7.25, a));
  add('lightning-strike', ['caída de rayo', 'impacto de rayo', 'rayo cercano', 'descarga', 'lightning strike', 'lightning nearby'], [roundline(P, [0, 0.6, 0.6, 0]), line([2.75, G], [21.25, G]), spark(-145), spark(-35)]);
}

// ── Heat, cold, haze and sun ──────────────────────────────────────────────────────────────────
// Heat shimmer: three waves 3.1 apart that start and end on a crest.
const SHIMMER = [15.3, 18.4, 21.5].map((y) => swell(y, 3, 6));
{
  // Heat wave: the sun (a little smaller, r 2.25) above the shimmer; its lower rays give way to it.
  const c = [12, 9.25];
  const rays = sunRays(c, 2.25).filter((r) => clearAll(r, SHIMMER));
  add('heat-wave', ['ola de calor', 'calor extremo', 'canícula', 'bochorno', 'heat wave', 'extreme heat'], [circ(...c, 2.25), ...rays, ...SHIMMER]);
}
// Cold wave: its pair, the flake (the precipitation's, larger) above the same three waves.
add('cold-wave', ['ola de frío', 'frío extremo', 'aire polar', 'helada', 'cold wave', 'cold snap', 'polar air'], [...flake([12, 7.1], 4.75), ...SHIMMER]);
// Mist: three rows of mist, each broken in two and staggered (three whole lines read as text or a menu).
add('mist', ['neblina', 'bruma', 'calima', 'niebla ligera', 'mist', 'haze', 'light fog'], [
  line([4.5, 7.5], [13.75, 7.5]),
  line([17.25, 7.5], [21.25, 7.5]),
  line([2.75, 12], [6.25, 12]),
  line([9.75, 12], [19.5, 12]),
  line([5.25, 16.5], [14.5, 16.5]),
  line([18, 16.5], [21.25, 16.5]),
]);
{
  // Haze by day: the upper half of the sun with its rays, sinking behind three horizontal lines.
  const C = [12, 13];
  const rays = [180, 225, 270, 315, 360].map((a) => line(polar(...C, 7, a), polar(...C, 9.1, a)));
  add('sun-haze', ['calima', 'bruma de día', 'niebla con sol', 'sol tenue', 'sun haze', 'hazy', 'fog by day'], [arc(...C, 4, 180, 360).d, ...rays, line([2.75, 13], [21.25, 13]), line([5.5, 16.75], [18.5, 16.75]), line([8.25, 20.5], [15.75, 20.5])]);
}
{
  // Sunny and windy: cloud-sun's sun and, under it, lugares's lower gusts; the rays that would
  // run into them give way.
  const g1 = gust(2.75, 16.25, 16.75, 2.25, false);
  const g2 = line([2.75, 20.75], [11.25, 20.75]);
  const rays = sunRays(SUN_C, 2.5).filter((r) => clearAll(r, [g1, g2]));
  add('sun-wind', ['sol y viento', 'soleado y ventoso', 'brisa', 'sunny and windy', 'breezy', 'windy'], [circ(...SUN_C, 2.5), ...rays, g1, g2]);
}
{
  // Day and night: cloud-sun's sun at the top left and, where cloud-sun has its cloud, lugares's crescent
  // (0.66) in front of it, its lit back toward the sun and its horns away from it. A custom piece: the
  // engine clears the sun behind it, and the rays it would reach are left out whole. A half sun fitted
  // against a crescent read as a speaker sending out its sound.
  const k = 0.66;
  const mc = [15.25, 15.25];
  const R = 8.5 * k;
  const crescent = moon(mc, R, [mc[0] + 5.25 * k, mc[1] + 5.25 * k], 6.75 * k);
  const rays = sunRays(SUN_C, 2.5).filter((r) => samples(r).every((p) => len(sub(p, mc)) >= R + 3));
  add('sun-moon', ['día y noche', '24 horas', 'tema automático', 'claro y oscuro', 'day and night', 'auto theme', '24 hours'], [circ(...SUN_C, 2.5), ...rays], {
    badge: { d: [crescent], knock: crescent, fill: { solid: [crescent] } },
  });
}
{
  // UV index: the upper half of a sun above three bars rising in height (its levels).
  const C = [12, 10.25];
  const r = 3;
  const rays = [180, 225, 270, 315, 360].map((a) => line(polar(...C, r + 3, a), polar(...C, r + 5.1, a)));
  add('uv-index', ['índice uv', 'radiación solar', 'rayos uv', 'protector solar', 'uv index', 'sun intensity', 'uv'], [
    `${arc(...C, r, 180, 360).d}Z`,
    ...rays,
    line([7, 21.25], [7, 18.75]),
    line([12, 21.25], [12, 16]),
    line([17, 21.25], [17, 13.25]),
  ]);
}
{
  // Aurora: three curtains of light hanging in the night sky, swaying, over a ridge of mountains, and
  // lugares's sparkle for a star. Rising from a flat horizon they read as steam or smoke; hanging
  // from the sky over a landscape they are light.
  const curtain = (x, top, bot, a) => `M${pt([x, top])}C${pt([x + a, top + (bot - top) * 0.33])} ${pt([x - a, top + (bot - top) * 0.66])} ${pt([x, bot])}`;
  const sparkle = ([cx, cy], R, k = 0.3) => {
    const P = [0, 1, 2, 3].map((i) => polar(cx, cy, R, -90 + i * 90));
    let d = `M${pt(P[0])}`;
    for (let i = 0; i < 4; i++) {
      const a = P[i];
      const b = P[(i + 1) % 4];
      d += `C${pt(lerp(a, lerp(a, [cx, cy], 1 - k), 0.75))} ${pt(lerp(b, lerp(b, [cx, cy], 1 - k), 0.75))} ${pt(b)}`;
    }
    return `${d}Z`;
  };
  add('aurora', ['aurora boreal', 'luces del norte', 'aurora austral', 'cielo nocturno', 'aurora', 'northern lights', 'aurora borealis'], [
    roundline([[2.75, 20.25], [8, 15], [11.25, 18.25], [15, 14.5], [21.25, 20.25]], [0, 1, 0.75, 1, 0]),
    curtain(5, 3.25, 11, 1.75),
    curtain(9.25, 2.75, 12, 1.75),
    curtain(13.5, 3.25, 10.25, 1.75),
    sparkle([18.75, 5.75], 3),
  ]);
}
// sundial is not drawn: a flat dial with its gnomon read as a sailboat on a pond, a hat on a plate or a
// wedge of cheese at 18 px, with the gnomon on the noon line or centered, its shadow and its hour ticks
// on either rim.

// ── Frost, ice and snow ───────────────────────────────────────────────────────────────────────
// Frost: the bigger snowflake (lugares's six arms and their Vs) settled over the ground, 3.5 above it.
// Half a flake growing from the ground, its branches as Vs, read as a fern or a bush at 18 px; fans of
// plain lines, as grass; lugares's snowflake shrunk to fit brought its arms' ends within 2.55 of its Vs.
const FROST_G = 19.25;
add('frost', ['escarcha', 'helada', 'hielo', 'frost', 'ground frost', 'hoarfrost'], [...bigFlake([12, 9.75], 6), line([2.75, FROST_G], [21.25, FROST_G])]);
{
  // Icicles hanging from an eave, three lengths.
  const E = 5;
  const icicle = (x, h, w = 1.6) => roundpoly([[x - w, E], [x + w, E], [x, E + h]], [0, 0, 0.6]);
  add('icicles', ['carámbanos', 'hielo', 'congelado', 'superficie helada', 'icicles', 'ice', 'icy'], [line([2.75, E], [21.25, E]), icicle(6.5, 14), icicle(12, 9), icicle(17.5, 12)]);
}
{
  // Snow depth: a snow drift, round where the wind piled it and cut short on its lee side, nautica's
  // wave-height arrow beside it measuring it from the ground to its crest, and the family's flake falling
  // above (a round dome read as an igloo or a bell). A ruler stuck in a mound read as a gravestone (fiestas
  // has one); a narrower stake with even ticks, as a lighthouse or a tower on a hill.
  const top = 13;
  const ax = 20;
  add('snow-depth', ['espesor de nieve', 'acumulación de nieve', 'nieve acumulada', 'snow depth', 'snowfall', 'snow accumulation'], [
    `M2.75 20.75C3 17.5 5 ${f(top)} 7.5 ${f(top)}C10.5 ${f(top)} 12 15.5 14.75 16C15 17.75 15 19.5 14.75 20.75Z`,
    line([ax, top + 0.25], [ax, 20.5]),
    head([ax, top], [0, -1], 3),
    head([ax, 20.75], [0, 1], 3),
    ...flake([12.5, 6.5], 2.25),
  ]);
}

// ── Forecast ──────────────────────────────────────────────────────────────────────────────────
// The forecast for a date: calendario's calendar-sun (a sun rising from the body's bottom edge) with
// a cloud in front of the sun's right half and the body's corner, a custom piece: as in cloud-sun,
// the sun shows beside it, and the rays the cloud would reach are left out whole.
const CAL_SUN = calendario.icons['calendar-sun'].d;
let CAL_CLOUD;
{
  const k = 0.42;
  const o = [5.675, 5.625];
  const keep = CAL_SUN.filter((d, i) => i < 5 || clearOf(d, k, o, 3.6));
  CAL_CLOUD = cloud(k, o);
  add('calendar-cloud-sun', ['pronóstico', 'clima del día', 'pronóstico de 10 días', 'forecast', 'daily forecast', 'weather for a date'], keep, { badge: cloudBadge(CAL_CLOUD) });
}

// ── Wind instruments ──────────────────────────────────────────────────────────────────────────
{
  // Windsock: a cone of cloth tied to the top of a pole, blowing right and drooping a little, with
  // two bands across it.
  const X = 4.5;
  const T = 3.25;
  const P = [[X, T], [19.75, 5.75], [19.75, 9.75], [X, 11.25]];
  const top = (x) => T + ((x - X) * (P[1][1] - T)) / (P[1][0] - X);
  const bottom = (x) => P[3][1] + ((x - X) * (P[2][1] - P[3][1])) / (P[2][0] - X);
  const band = (x) => line([x, top(x)], [x, bottom(x)]);
  add('windsock', ['manga de viento', 'catavientos', 'dirección del viento', 'aeródromo', 'windsock', 'wind cone', 'wind direction'], [
    roundpoly(P, [0, 0.9, 0.9, 0]),
    line([X, 21.25], [X, T]),
    band(9.75),
    band(14.75),
  ]);
}
// weathervane is not drawn: the arrow on its post with the cardinal bar under it read as the glyph 午
// or as a cross on a grave at 18 px; on a roof, as a clothes hanger or an easel; alone on its post, as a
// signpost. anemometer neither: its cups on an arm atop a pole read as a T, lugares's street lamp, a
// table or a dumbbell on a stick, with the cups opening up and down, sideways, or larger; a rotor seen
// from above is juegos's pinwheel.
// Wind direction: an arrow pointing right and two gusts trailing from its tail, curling away.
add('wind-direction', ['dirección del viento', 'rumbo del viento', 'viento', 'wind direction', 'wind heading', 'wind'], [
  line([8.5, 12], [20.5, 12]),
  line([16.25, 7.75], [20.5, 12], [16.25, 16.25]),
  gustLeft(12, 8.25, 6.5, 2.25, true),
  gustLeft(12, 15.75, 6.5, 2.25, false),
]);
// umbrella-inside-out is not drawn: its canopy flipped up on the shaft read as a crown, a bowl or a
// goblet at 18 px, and tipped by the wind as a fan or a shell.

// ── Humidity and pressure ─────────────────────────────────────────────────────────────────────
// The droplet with a level line across it: high near its top, low near its bottom. Filled, the water
// under the line is solid and the drop above it stays a line.
const levelAt = (y) => {
  const w = Math.sqrt(7.25 ** 2 - (y - 13.5) ** 2);
  return { line: line([12 - w, y], [12 + w, y]), water: `M${pt([12 - w, y])}H${f(12 + w)}A7.25 7.25 0 ${y < 13.5 ? 1 : 0} 1 ${pt([12 - w, y])}Z` };
};
const HUMID = { high: levelAt(9.5), low: levelAt(17.5) };
add('humidity-high', ['humedad alta', 'bochorno', 'húmedo', 'humidity high', 'muggy', 'humid'], [DROP, HUMID.high.line]);
add('humidity-low', ['humedad baja', 'aire seco', 'seco', 'humidity low', 'dry air', 'dry'], [DROP, HUMID.low.line]);
// Relative humidity: the droplet with comercio's compact percent sign (dots for its rings: rings small
// enough to fit closed up at bold), on the center of the drop's round part.
add('droplet-percent', ['humedad relativa', 'porcentaje de humedad', 'humedad', 'relative humidity', 'humidity percent', 'moisture'], [
  DROP,
  dot(9.5, 11.25),
  dot(14.5, 16.25),
  line([9.25, 16.5], [14.75, 11]),
]);
// Dew: lugares's leaf hanging from its stem, tip down, and a drop falling from its tip, 3 below it
// (a bent grass blade read as a horn or an arc).
const DEW_LEAF = (d) => place(turnPath(d, 90), 0.65, [5.5, 5.5], [5.25, 5.25]);
const DEW_TIP = DEW_LEAF('M20.25 3.75').match(/[\d.]+/g).map(Number);
add('dew', ['rocío', 'sereno', 'humedad de la hoja', 'dew', 'morning dew', 'leaf wetness'], [
  ...L.leaf.d.map(DEW_LEAF),
  drop2([DEW_TIP[0], DEW_TIP[1] + 3 + 1.75 * Math.SQRT2], 1.75),
]);
// Hygrometer: a dial with its needle on a pivot above the center and a droplet in its lower half.
add('hygrometer', ['higrómetro', 'medidor de humedad', 'humedad', 'hygrometer', 'humidity meter', 'humidity gauge'], [
  circ(12, 12, 9),
  line([12, 10.25], [15.5, 7]),
  dot(12, 10.25),
  drop2([12, 16.5], 2),
]);
{
  // Barometer: a dial with an arc of ticks across the top (touching the rim), the needle on the
  // pivot pointing between two of them (a wave under the pivot made a face of it). With a badge, like
  // lugares's clock, the needle's pivot moves up and left (11.25, 11.25) and loses its dot, which the
  // badge's clearance would take at bold.
  const ticks = [-150, -120, -90, -60, -30].map((a) => line(polar(12, 12, 6.9, a), polar(12, 12, 9, a)));
  const BARO = [circ(12, 12, 9), ...ticks, line([12, 12], polar(12, 12, 4, -135)), dot(12, 12)];
  const BARO_BADGE = [circ(12, 12, 9), ...ticks, line([11.25, 11.25], polar(11.25, 11.25, 3.3, -135))];
  add('barometer', ['barómetro', 'presión atmosférica', 'presión del aire', 'barometer', 'air pressure', 'atmospheric pressure'], BARO);
  add('barometer-arrow-up', ['presión en aumento', 'sube la presión', 'mejora el tiempo', 'rising pressure', 'pressure up', 'improving weather'], BARO_BADGE, { badge: badge('arrow-up') });
  add('barometer-arrow-down', ['presión en descenso', 'baja la presión', 'empeora el tiempo', 'falling pressure', 'pressure down', 'worsening weather'], BARO_BADGE, { badge: badge('arrow-down') });
}

// ── Temperature ───────────────────────────────────────────────────────────────────────────────
// lugares's thermometer moved left (x 6.5), what it says on its right.
const TX = 6.5;
const GLASS = glass(TX);
{
  // Hot: the mercury high and a small sun, its rays that would reach the glass left out.
  const c = [15, 8.9];
  const rays = sunRays(c, 2).filter((r) => clearAll(r, [GLASS]) && inArea(r));
  add('thermometer-sun', ['calor', 'temperatura máxima', 'índice de calor', 'día caluroso', 'hot weather', 'heat index', 'high temperature'], [GLASS, mercury(TX, 8.25), circ(...c, 2), ...rays]);
}
// Freezing: the mercury low and cold-wave's flake.
add('thermometer-snowflake', ['bajo cero', 'helada', 'temperatura de congelación', 'frío', 'freezing', 'below zero', 'frost'], [GLASS, mercury(TX, 12.5), ...flake([16.75, 7.5], 4.75)]);
// Wind chill: two gusts flowing past the bulb, lugares's wind.
add('thermometer-wind', ['sensación térmica', 'viento frío', 'enfriamiento por viento', 'wind chill', 'cold wind', 'feels colder'], [GLASS, mercury(TX, 10.5), gust(14, 13.5, 17.25), gust(14, 17.25, 18.25, 2.25, false)]);
{
  // Feels like: the thermometer beside personas's standing figure.
  const fig = personas.icons['figure-standing'].d.map((d) => place(d, 1, [0, 0], [5.25, 0]));
  add('thermometer-person', ['sensación térmica', 'temperatura aparente', 'se siente como', 'feels like', 'apparent temperature', 'real feel'], [GLASS, mercury(TX, 10.5), ...fig]);
}

// ── Umbrellas and rain ────────────────────────────────────────────────────────────────────────
// Furled: lugares's umbrella closed, its shaft and hook handle exactly as the open one has them, the
// canopy wrapped round the shaft as a slim cone, straight from its tip to the folds that round off into
// the shaft. A fat spindle with a strap read as an onion or a drop on a hook; turned over, handle up, as
// a carrot or a quill.
add('umbrella-closed', ['paraguas cerrado', 'sin lluvia', 'seco', 'no hace falta paraguas', 'closed umbrella', 'no rain', 'dry'], [
  'M12 2.75L14.75 12.5C15 13.9 13.65 15.25 12 15.25C10.35 15.25 9 13.9 9.25 12.5Z',
  'M12 15.25V19a1.75 1.75 0 0 1-3.5 0',
]);
// Rain gauge: a cup open to the sky (a container: its bottom right corner square), the level of the
// rain it caught across it, and three of the rain's streaks falling into it. A funnel on a narrow tube
// read as a flashlight, a torch or a figure with its arms up; ticks on the cup's wall made an E of it.
// Filled, the water under the level is solid, as in the humidity droplets.
const GAUGE = { cup: sq(7.25, 10, 9.5, 11.25, 2, { square: ['tl', 'tr', 'br'] }).replace(/Z$/, ''), water: sq(7.25, 15.5, 9.5, 5.75, 2, { square: ['tl', 'tr', 'br'] }) };
add('rain-gauge', ['pluviómetro', 'lluvia acumulada', 'precipitación', 'milímetros de lluvia', 'rain gauge', 'rainfall', 'precipitation'], [
  // The squircle without its top edge (its top corners square, so it opens straight up)
  GAUGE.cup,
  line([7.25, 15.5], [16.75, 15.5]),
  ...[9.75, 13.25, 16.75].map((x) => streak([x, 2.75], 3.75)),
]);
// Puddle: a flat pool, a drop falling into its middle and the ring it makes.
add('puddle', ['charco', 'suelo mojado', 'después de la lluvia', 'puddle', 'wet ground', 'after rain'], [ellipse(12, 17.5, 9.25, 4.25), ellipse(12, 17.5, 4.5, 1.25), drop2([12, 7.75], 2.5)]);
{
  // Weatherproof: nucleo's shield, smaller, under three streaks of rain.
  const shield = place(nucleo.icons.shield.d[0], 0.72, [12, 21.3], [12, 21.25]);
  add('shield-rain', ['resistente a la lluvia', 'impermeable', 'todo clima', 'protección', 'weatherproof', 'waterproof', 'all weather'], [shield, ...[9, 12.5, 16].map((x) => streak([x, 2.75], 2.5))]);
}

// ── Visibility and the seasons ────────────────────────────────────────────────────────────────
add('visibility-range', ['visibilidad', 'distancia visible', 'alcance visual', 'visibility', 'visual range', 'visibility distance'], [
  place(edicion.icons.eye.d[0], 0.8, [12, 12], [12, 8.25]),
  circ(12, 8.25, 2.6),
  line([3.25, 18.5], [20.75, 18.5]),
  line([6.25, 15.5], [3.25, 18.5], [6.25, 21.5]),
  line([17.75, 15.5], [20.75, 18.5], [17.75, 21.5]),
]);
// Spring: lugares's sprout, smaller and to the right, and a raindrop falling at its left.
add('season-spring', ['primavera', 'brote', 'lluvia de primavera', 'estación', 'spring', 'springtime', 'season'], [...L.sprout.d.map((d) => place(d, 0.8, [12, 21], [14.5, 21])), drop2([6, 7.25], 2.25)]);
{
  // Summer: the sun above a wave; its lowest ray gives way to the wave.
  const c = [12, 10.5];
  const wave = swell(20.5, 3, 6, 3, 0.75);
  add('season-summer', ['verano', 'sol y playa', 'vacaciones', 'estación', 'summer', 'summertime', 'season'], [circ(...c, 3.5), ...sunRays(c, 3.5).filter((r) => clearAll(r, [wave])), wave]);
}
// Autumn: lugares's leaf, smaller, falling along the path it came down, two dashes of an arc (an S read
// as a worm; a whole curve, as the twig the leaf hangs from).
{
  const trail = [[174, 152], [134, 110]].map(([a0, a1]) => arc(12.5, 3, 9.3, a0, a1).d);
  add('season-autumn', ['otoño', 'hoja que cae', 'caída de hojas', 'estación', 'autumn', 'fall', 'season'], [...L.leaf.d.map((d) => place(d, 0.55, [12, 12], [15.75, 15.75])), ...trail]);
}
// Winter: plantas's bare tree (0.8), its leaves gone after autumn's, and the family's flakes falling
// beside it, 3 clear of its branches. A snowflake over a snowy hill read as a frowning face, and as frost.
add('season-winter', ['invierno', 'nieve', 'temporada de frío', 'estación', 'winter', 'wintertime', 'season'], [
  ...plantas.icons['tree-bare'].d.map((d) => place(d, 0.8, [12, 21.25], [10.25, 21.25])),
  ...flake([18.75, 5.25]),
  ...flake([19, 14.25]),
]);

// ── Stations and maps ─────────────────────────────────────────────────────────────────────────
// weather-station is not drawn: its mast carries the anemometer's cups (a T at 18 px) or the vane (a
// signpost), and the louvered box on legs at its foot reads as a radiator or a battery.
// Weather balloon: a big round balloon rising past a cloud, its line swaying down to the small box of
// its instruments (alone on the axis, balloon, line and box made a Venus sign).
add('weather-balloon', ['globo meteorológico', 'radiosonda', 'sondeo', 'weather balloon', 'radiosonde', 'sounding'], [
  circ(15.5, 7.25, 5.25),
  'M15.5 12.5C17 13.75 14 15 15.5 16.25',
  sq(13.5, 16.25, 4, 3.75, 1),
  cloud(0.45, [-5.31, 3.19]),
]);
// Weather radar: sistema's radar with a cloud on its lower right, a custom piece as on map-weather (the
// engine clears the scope around it). A radome on a lattice tower read as a water tower.
const RADAR_CLOUD = cloud(0.46, [5.1, 6.1]);
add('weather-radar', ['radar meteorológico', 'radomo', 'radar de lluvia', 'weather radar', 'radome', 'doppler radar'], [...sistema.icons.radar.d], { badge: cloudBadge(RADAR_CLOUD) });
{
  // Weather satellite: lugares's satellite-view, its satellite (tilted along its orbit, its arms
  // still 2 long) above a cloud instead of the Earth.
  const sat = L['satellite-view'].d.slice(0, 7).map((d) => place(d, 0.82, [12, 9], [12, 7.6]));
  add('satellite-cloud', ['satélite meteorológico', 'imagen satelital', 'nubes desde el espacio', 'weather satellite', 'satellite imagery', 'cloud cover'], [...sat, cloud(0.58, [-0.07, 5.625])]);
}
// Weather map: lugares's folded map with a cloud over its top right corner (a custom piece: the
// engine clears the map around it).
add('map-weather', ['mapa del tiempo', 'mapa meteorológico', 'pronóstico regional', 'weather map', 'forecast map', 'regional weather'], [...L.map.d], { badge: cloudBadge(cloud(0.46, [6.025, -5.875])) });
// map-pin-sun is not drawn: lugares's pin leaves 4.15 of room around the center of its head, and the
// family's sun needs 6.6 at least (a disc, 1.5 of clearance and rays of 2); with its rays touching
// the disc it reads as a gear or a flower.

// ── Fronts and water ──────────────────────────────────────────────────────────────────────────
// The weather map's fronts: a gently curved line with three symbols on its side, triangles for the
// cold front and half discs for the warm one. Each symbol's base is the line itself.
// The line rises 3 over 20 (radius 18.17): flat enough that a half disc of 2.6 keeps its hole at bold.
const FR = 18.17;
const FC = [12, 15.5 - 3 + FR];
const FRONT = `M2 15.5A${f(FR)} ${f(FR)} 0 0 1 22 15.5`;
const FRONT_AT = [-90 - deg(7.5 / FR), -90, -90 + deg(7.5 / FR)];
const frontBase = (a) => [polar(...FC, FR, a - deg(2.6 / FR)), polar(...FC, FR, a + deg(2.6 / FR))];
add('cold-front', ['frente frío', 'mapa del tiempo', 'masa de aire frío', 'cold front', 'weather front', 'cold air'], [
  FRONT,
  ...FRONT_AT.map((a) => {
    const [p, q] = frontBase(a);
    return `M${pt(p)}A${f(FR)} ${f(FR)} 0 0 1 ${pt(q)}L${pt(polar(...FC, FR + 3.75, a))}Z`;
  }),
]);
add('warm-front', ['frente cálido', 'mapa del tiempo', 'masa de aire cálido', 'warm front', 'weather front', 'warm air'], [
  FRONT,
  ...FRONT_AT.map((a) => {
    const [p, q] = frontBase(a);
    const r = halfChord(p, q);
    return `M${pt(p)}A${f(FR)} ${f(FR)} 0 0 1 ${pt(q)}A${r} ${r} 0 0 0 ${pt(p)}Z`;
  }),
]);
{
  // Water cycle: a cloud raining on the left and, on the right, the water's wave turning up into an
  // arrow that goes back to the cloud. On so tight an arc the head turns 12° outward, or its inner arm
  // runs along the arc and closes a sliver of paper with it at light weights.
  const ox = -3.75;
  const oy = -5.2;
  const wave = swell(19.5, 3, 4, 3, 0.6);
  const r = 5.5;
  const C = [15, 18.9 - r];
  const a = arc(...C, r, 90, -55);
  const out = rad(12);
  const [tx, ty] = a.tangent;
  add('water-cycle', ['ciclo del agua', 'evaporación', 'precipitación', 'condensación', 'water cycle', 'hydrologic cycle', 'evaporation'], [
    cloud(0.6, [ox, oy]),
    streak([6.5, 13.45], 2.6),
    streak([10, 13.45], 2.6),
    `${wave}${a.d.replace(/^M[^A]+/, '')}`,
    head(a.end, [tx * Math.cos(out) - ty * Math.sin(out), tx * Math.sin(out) + ty * Math.cos(out)], 3.4),
  ]);
}
{
  // Evaporation: three wavy lines rising from the water, ending in arrowheads (the middle one higher).
  const rise = (x, b, t) => {
    const d = `M${pt([x, b])}C${pt([x - 1.25, b - (b - t) / 3])} ${pt([x + 1.25, b - (2 * (b - t)) / 3])} ${pt([x, t])}`;
    return [d, head([x, t], [-1.25, -(b - t) / 3], 2.75)];
  };
  add('evaporation', ['evaporación', 'evapotranspiración', 'vapor', 'evaporation', 'evapotranspiration', 'vapor'], [swell(20.25, 3, 6), ...rise(5.5, 16.5, 8.5), ...rise(12, 16.5, 5.5), ...rise(18.5, 16.5, 8.5)]);
}

if (L.cloud.d[0] !== cloud() || L['cloud-rain'].d[0] !== RAIN_CLOUD) throw new Error("clima: the cloud is no longer lugares's");

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d` (or a path): `solid` is filled and keeps its stroke, `cut` is knocked out, `lines`
// stays a line with 1.5 of clearance, `wire` stays a line attached to the fill. As in lugares, the
// weather's bodies (clouds, suns, moons, the hail) are filled and the rays, drops, flakes and gusts
// stay lines; what sits behind a cloud badge is filled whole and the engine clears it. Icons made
// only of lines take `false`.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const rest = (name, from) => range(from, icons[name].d.length);
const FILL = {
  'cloud-lightning': { solid: [0], lines: [1] },
  'storm-hail': { solid: [0, 2, 3], lines: [1] },
  'storm-alert': { solid: [0], lines: [1, 2] },
  'cloud-rain-heavy': { solid: [0], lines: rest('cloud-rain-heavy', 1) },
  'cloud-snow-heavy': { solid: [0], lines: rest('cloud-snow-heavy', 1) },
  'cloud-flurries': { solid: [0], lines: [1, 2, 3] },
  'cloud-sleet': { solid: [0], lines: rest('cloud-sleet', 1) },
  // The icicles hang from the ground, attached to it; the drops land on it.
  'cloud-freezing-rain': { solid: [0, 4, 5], wire: [3], lines: [1, 2] },
  'cloud-rain-wind': { solid: [0], lines: rest('cloud-rain-wind', 1) },
  'cloud-wind': { solid: [0], lines: [1, 2] },
  'wind-alert': false,
  hurricane: { solid: [0], wire: [1, 2] },
  'hurricane-track': { solid: [0], wire: [1, 2], lines: [3, 4, 5] },
  // The back dune is solid and the gusts stay lines; the front dune is the custom piece's own fill.
  sandstorm: { solid: [shut(DUNE_BACK)], lines: [0, 1] },
  blizzard: false,
  smoke: false,
  'lightning-strike': false,
  'heat-wave': { solid: [0], lines: rest('heat-wave', 1) },
  'cold-wave': false,
  mist: false,
  // The half sun closes along the horizon, which stays attached to it.
  'sun-haze': { solid: [shut(icons['sun-haze'].d[0])], wire: [6], lines: [1, 2, 3, 4, 5, 7, 8] },
  'sun-wind': { solid: [0], lines: rest('sun-wind', 1) },
  // The moon in front is the badge's own fill
  'sun-moon': { solid: [0], lines: rest('sun-moon', 1) },
  'uv-index': { solid: [0], lines: rest('uv-index', 1) },
  aurora: { solid: [4], lines: [0, 1, 2, 3] },
  frost: false,
  icicles: { solid: [1, 2, 3], wire: [0] },
  'snow-depth': { solid: [0], lines: [1, 2, 3, 4, 5, 6] },
  // calendario's calendar-sun, the header and the sun knocked out; its rings are attached to the body
  // here: kept apart, the sliver of fill under them at light weights split away once the cloud opens
  // the body's corner, and the weights no longer matched.
  'calendar-cloud-sun': { solid: [0], wire: [1, 2], cut: rest('calendar-cloud-sun', 3) },
  windsock: { solid: [0], wire: [1], cut: [2, 3] },
  // The vane's fin and the arms' balls are solid; the arrow, the post and the bar stay attached to them.
  'wind-direction': false,
  // The water under the level line is solid; the drop above it stays a line.
  'humidity-high': { solid: [HUMID.high.water], wire: [0] },
  'humidity-low': { solid: [HUMID.low.water], wire: [0] },
  'droplet-percent': { solid: [0], cut: [1, 2, 3] },
  // lugares's leaf: the stem outside the leaf attached to it, the rib inside knocked out.
  dew: { solid: [0, 2], wire: [DEW_LEAF(line([3.25, 20.75], [5.5, 18.5]))], cut: [DEW_LEAF(line([7.5, 16.5], [14.25, 9.75]))] },
  hygrometer: { solid: [0], cut: [1, 2, 3] },
  barometer: { solid: [0], cut: rest('barometer', 1) },
  'barometer-arrow-up': { solid: [0], cut: rest('barometer-arrow-up', 1) },
  'barometer-arrow-down': { solid: [0], cut: rest('barometer-arrow-down', 1) },
  // lugares's thermometer: the glass filled, the mercury knocked out.
  'thermometer-sun': { solid: [0, 2], cut: [1], lines: rest('thermometer-sun', 3) },
  'thermometer-snowflake': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'thermometer-wind': { solid: [0], cut: [1], lines: [2, 3] },
  // personas's figure: its head filled, its body attached to it.
  'thermometer-person': { solid: [0, 2], cut: [1], wire: [3, 4, 5] },
  'umbrella-closed': { solid: [0], wire: [1] },
  'rain-gauge': { solid: [GAUGE.water], wire: [0, 1], lines: [2, 3, 4] },
  puddle: { solid: [0, 2], cut: [1] },
  'shield-rain': { solid: [0], lines: [1, 2, 3] },
  'visibility-range': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'season-spring': { solid: [1, 2, 4], wire: [0, 3] },
  'season-summer': { solid: [0], lines: rest('season-summer', 1) },
  // lugares's leaf: the stem outside the leaf attached to it, the rib inside knocked out.
  'season-autumn': { solid: [0], wire: [place(line([3.25, 20.75], [5.5, 18.5]), 0.55, [12, 12], [15.75, 15.75])], cut: [place(line([7.5, 16.5], [14.25, 9.75]), 0.55, [12, 12], [15.75, 15.75])], lines: [2, 3] },
  'season-winter': false,
  'weather-balloon': { solid: [0, 2, 3], wire: [1] },
  // sistema's radar: the scope filled, its hub, sweep and echo knocked out
  'weather-radar': { solid: [0], cut: [1, 2, 3] },
  // lugares's satellite: body and panels filled, the arms attached, the cells knocked out.
  'satellite-cloud': { solid: [0, 1, 2, 7], wire: [3, 4], cut: [5, 6] },
  'map-weather': { solid: [0], cut: [1, 2] },
  'cold-front': { solid: [1, 2, 3], wire: [0] },
  'warm-front': { solid: [1, 2, 3], wire: [0] },
  'water-cycle': { solid: [0], lines: [1, 2], wire: [3, 4] },
  evaporation: false,
};
for (const kind of Object.keys(SKY_MARKS)) {
  const sun = `cloud-sun-${kind}`;
  const nightly = `cloud-moon-${kind}`;
  const marks = SKY_MARKS[kind].length;
  const rays = icons[sun].d.length - 1 - marks;
  // The hailstones are dots: solid; every other mark stays a line
  FILL[sun] = kind === 'hail' ? { solid: [0, ...rest(sun, 1 + rays)], lines: range(1, 1 + rays) } : { solid: [0], lines: rest(sun, 1) };
  FILL[nightly] = kind === 'hail' ? { solid: rest(nightly, 0) } : { solid: [0], lines: rest(nightly, 1) };
}

// ── Named parts and motion ────────────────────────────────────────────────────────────────────
const tail = (name, n) => rest(name, icons[name].d.length - n);
const PARTS = {
  'cloud-lightning': { cloud: [0], bolt: [1] },
  'storm-hail': { cloud: [0], bolt: [1], hail: [2, 3] },
  'storm-alert': { cloud: [0], bolt: [1], drops: [2] },
  'cloud-rain-heavy': { cloud: [0], drops: rest('cloud-rain-heavy', 1) },
  'cloud-snow-heavy': { cloud: [0], flakes: rest('cloud-snow-heavy', 1) },
  'cloud-flurries': { cloud: [0], flakes: [1, 2, 3] },
  'cloud-sleet': { cloud: [0], drops: [1, 5], flakes: [2, 3, 4] },
  'cloud-freezing-rain': { cloud: [0], drops: [1, 2], ground: [3], icicles: [4, 5] },
  'cloud-rain-wind': { cloud: [0], drops: [1, 2, 3], gusts: [4] },
  'cloud-wind': { cloud: [0], gusts: [1, 2] },
  'wind-alert': { gusts: [0, 1, 2] },
  hurricane: { eye: [0], arms: [1, 2] },
  'hurricane-track': { storm: [0, 1, 2], track: [3, 4, 5] },
  sandstorm: { gusts: [0, 1], dunes: [2] },
  blizzard: { gusts: [0, 1, 2], flakes: range(3, 9) },
  smoke: { plumes: [0, 1] },
  'lightning-strike': { bolt: [0], ground: [1], sparks: [2, 3] },
  'heat-wave': { sun: [0], rays: range(1, icons['heat-wave'].d.length - 3), waves: tail('heat-wave', 3) },
  'cold-wave': { flake: [0, 1, 2], waves: [3, 4, 5] },
  mist: { mist: range(0, 6) },
  'sun-haze': { sun: [0], rays: [1, 2, 3, 4, 5], haze: [6, 7, 8] },
  'sun-wind': { sun: [0], rays: range(1, icons['sun-wind'].d.length - 2), gusts: tail('sun-wind', 2) },
  'sun-moon': { sun: [0], rays: rest('sun-moon', 1) },
  'uv-index': { sun: [0], rays: [1, 2, 3, 4, 5], level: [6, 7, 8] },
  aurora: { ridge: [0], curtains: [1, 2, 3], star: [4] },
  frost: { crystal: range(0, 9), ground: [9] },
  icicles: { eave: [0], icicles: [1, 2, 3] },
  'snow-depth': { drift: [0], arrow: [1, 2, 3], flake: [4, 5, 6] },
  'calendar-cloud-sun': { body: [0], rings: [1, 2], header: [3], sun: rest('calendar-cloud-sun', 4) },
  windsock: { sock: [0, 2, 3], pole: [1] },
  'wind-direction': { arrow: [0, 1], gusts: [2, 3] },
  'humidity-high': { drop: [0], level: [1] },
  'humidity-low': { drop: [0], level: [1] },
  'droplet-percent': { drop: [0], mark: [1, 2, 3] },
  dew: { leaf: [0, 1], drop: [2] },
  hygrometer: { dial: [0], needle: [1, 2], drop: [3] },
  barometer: { dial: [0], ticks: [1, 2, 3, 4, 5], needle: [6, 7] },
  'barometer-arrow-up': { dial: [0], ticks: [1, 2, 3, 4, 5], needle: [6] },
  'barometer-arrow-down': { dial: [0], ticks: [1, 2, 3, 4, 5], needle: [6] },
  'thermometer-sun': { body: [0], level: [1], sun: [2], rays: rest('thermometer-sun', 3) },
  'thermometer-snowflake': { body: [0], level: [1], flake: [2, 3, 4] },
  'thermometer-wind': { body: [0], level: [1], gusts: [2, 3] },
  'thermometer-person': { body: [0], level: [1], person: [2, 3, 4, 5] },
  'umbrella-closed': { canopy: [0], handle: [1] },
  'rain-gauge': { gauge: [0], level: [1], drops: [2, 3, 4] },
  puddle: { puddle: [0], ripple: [1], drop: [2] },
  'shield-rain': { shield: [0], drops: [1, 2, 3] },
  'visibility-range': { eye: [0], pupil: [1], arrow: [2, 3, 4] },
  'season-spring': { stem: [0], leaves: [1, 2], ground: [3], drop: [4] },
  'season-summer': { sun: [0], rays: range(1, icons['season-summer'].d.length - 1), wave: tail('season-summer', 1) },
  'season-autumn': { leaf: [0, 1], trail: [2, 3] },
  'season-winter': { tree: [0, 1, 2, 3, 4], flakes: range(5, 11) },
  'weather-balloon': { balloon: [0], line: [1], box: [2], cloud: [3] },
  'weather-radar': { face: [0, 1], sweep: [2], blip: [3] },
  'satellite-cloud': { satellite: range(0, 7), cloud: [7] },
  'map-weather': { map: [0], folds: [1, 2] },
  'cold-front': { front: [0], symbols: [1, 2, 3] },
  'warm-front': { front: [0], symbols: [1, 2, 3] },
  'water-cycle': { cloud: [0], drops: [1, 2], cycle: [3, 4] },
  evaporation: { water: [0], vapor: range(1, 7) },
};
const SKY_PART = { lightning: 'bolt', rain: 'drops', drizzle: 'drops', snow: 'flakes', hail: 'hail' };
const MOTION = {
  'cloud-lightning': { effect: 'beat', parts: ['bolt'], origin: [12.125, 19.5] },
  'storm-hail': { effect: 'beat', parts: ['bolt'], origin: [12.125, 19.5] },
  'storm-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'cloud-rain-heavy': { effect: 'slide', parts: ['drops'], vector: [-0.5, 1.5] },
  'cloud-snow-heavy': { effect: 'float', parts: ['flakes'], vector: [0, 1.5] },
  'cloud-flurries': { effect: 'float', parts: ['flakes'], vector: [0, 1.5] },
  'cloud-sleet': { effect: 'slide', parts: ['drops', 'flakes'], vector: [-0.5, 1.5] },
  'cloud-freezing-rain': { effect: 'slide', parts: ['drops'], vector: [-0.35, 1] },
  'cloud-rain-wind': { effect: 'slide', parts: ['drops'], vector: [-1, 1.25] },
  'cloud-wind': { effect: 'slide', parts: ['gusts'], vector: [2, 0] },
  'wind-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  hurricane: { effect: 'spin', origin: [12, 12] },
  'hurricane-track': { effect: 'spin', parts: ['storm'], origin: [6.25, 15.75] },
  sandstorm: { effect: 'slide', parts: ['gusts'], vector: [2, 0] },
  blizzard: { effect: 'slide', vector: [2, 0] },
  smoke: { effect: 'float', vector: [0, -1.5] },
  'lightning-strike': { effect: 'beat', parts: ['bolt'], origin: [11.5, 20.5] },
  'heat-wave': { effect: 'float', parts: ['waves'], vector: [1.5, 0] },
  'cold-wave': { effect: 'float', parts: ['waves'], vector: [1.5, 0] },
  mist: { effect: 'float', vector: [1.5, 0] },
  'sun-moon': { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
  frost: { effect: 'spin', parts: ['crystal'], origin: [12, 9.75] },
  'snow-depth': { effect: 'float', parts: ['flake'], vector: [0, 1.5] },
  'sun-haze': { effect: 'float', parts: ['haze'], vector: [1.5, 0] },
  'sun-wind': { effect: 'slide', parts: ['gusts'], vector: [2, 0] },
  aurora: { effect: 'float', parts: ['curtains'], vector: [0, -1] },
  'calendar-cloud-sun': { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
  windsock: { effect: 'wiggle', parts: ['sock'], origin: [4.5, 7.25] },
  'wind-direction': { effect: 'slide', vector: [2, 0] },
  'humidity-high': { effect: 'bounce', vector: [0, 1.5] },
  'humidity-low': { effect: 'bounce', vector: [0, 1.5] },
  'droplet-percent': { effect: 'bounce', vector: [0, 1.5] },
  dew: { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  hygrometer: { effect: 'wiggle', parts: ['needle'], origin: [12, 10.25] },
  barometer: { effect: 'wiggle', parts: ['needle'], origin: [12, 12] },
  'barometer-arrow-up': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'barometer-arrow-down': { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] },
  'thermometer-sun': { effect: 'beat', parts: ['sun', 'rays'], origin: [15, 8.9] },
  'thermometer-snowflake': { effect: 'spin', parts: ['flake'], origin: [16.75, 7.5] },
  'thermometer-wind': { effect: 'slide', parts: ['gusts'], vector: [1.5, 0] },
  'umbrella-closed': { effect: 'wiggle', origin: [10.25, 20.75] },
  'rain-gauge': { effect: 'slide', parts: ['drops'], vector: [-0.5, 1.5] },
  puddle: { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'shield-rain': { effect: 'slide', parts: ['drops'], vector: [-0.35, 1] },
  'season-spring': { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] },
  'season-summer': { effect: 'float', parts: ['wave'], vector: [1.5, 0] },
  'season-autumn': { effect: 'float', parts: ['leaf'], vector: [1, 1.5] },
  'weather-radar': { effect: 'spin', parts: ['sweep'], origin: [12, 12] },
  'season-winter': { effect: 'float', parts: ['flakes'], vector: [0, 1.5] },
  'weather-balloon': { effect: 'float', parts: ['balloon', 'line', 'box'], vector: [0, -1.5] },
  'satellite-cloud': { effect: 'float', parts: ['satellite'], vector: [1.5, -0.75] },
  'map-weather': { effect: 'float', parts: ['badge'], vector: [1.5, 0] },
  'cold-front': { effect: 'slide', vector: [0, -1.5] },
  'warm-front': { effect: 'slide', vector: [0, -1.5] },
  'water-cycle': { effect: 'slide', parts: ['drops'], vector: [-0.5, 1.5] },
  evaporation: { effect: 'float', parts: ['vapor'], vector: [0, -1.5] },
};
const SKY_MOTION = {
  // The bolt's center: the storm's (12.125, 19.5), moved as the bolt moves under the sky's cloud
  lightning: () => ({ effect: 'beat', parts: ['bolt'], origin: [16, 20.3] }),
  rain: () => ({ effect: 'slide', parts: ['drops'], vector: [-0.5, 1.5] }),
  drizzle: () => ({ effect: 'slide', parts: ['drops'], vector: [-0.35, 1] }),
  snow: () => ({ effect: 'float', parts: ['flakes'], vector: [0, 1.5] }),
  hail: () => ({ effect: 'bounce', parts: ['hail'], vector: [0, 1.5] }),
};
for (const kind of Object.keys(SKY_MARKS)) {
  const sun = `cloud-sun-${kind}`;
  const nightly = `cloud-moon-${kind}`;
  const marks = SKY_MARKS[kind].length;
  PARTS[sun] = { sun: [0], rays: range(1, icons[sun].d.length - marks), [SKY_PART[kind]]: tail(sun, marks) };
  PARTS[nightly] = { moon: [0], [SKY_PART[kind]]: tail(nightly, marks) };
  MOTION[sun] = SKY_MOTION[kind]();
  MOTION[nightly] = SKY_MOTION[kind]();
}

// ── Assigned in blocks: fill, parts, motion, mirror, levels, variants ─────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;
// Mirror: the wind's direction reads with the text
icons['wind-direction'].mirror = true;
// Levels: the UV index's bars light up from the lowest
icons['uv-index'].levels = [[6], [7], [8]];
const offV = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge (lugares's rule): the filled enclosure doesn't draw it and at 58 % it stops reading;
// the slash would cut through it
offV(
  Object.keys(icons).filter((n) => icons[n].badge),
  { circle: false, square: false, slash: false },
);
// Already a dial: no circle round it
offV(['hygrometer', 'barometer'], { circle: false });
// A slash through an arrow says nothing
offV(['wind-direction'], { slash: false });

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// Where the snap to the pixel grid leaves a smudge, a drawing with fewer pieces: two waves 4.5 apart
// and half as tight (a crest every 9) under the heat and cold waves (three, 3 apart, ran into one gray
// block), and the hurricane's track as one stroke (its dashes broke into stray pixels). They are
// snapped as the engine snaps the others.
const SMALL = {};
{
  const waves = [16.5, 21].map((y) => swell(y, 3, 4, 4.5, 0.75));
  const sunC = [12, 9.25];
  const sun = [circ(...sunC, 2.25), ...sunRays(sunC, 2.25).filter((r) => clearAll(r, waves))];
  SMALL['heat-wave'] = { d: [...sun, ...waves], fill: { solid: [0], lines: range(1, sun.length + 2) } };
  SMALL['cold-wave'] = { d: [...flake([12, 7.6], 4.75), ...waves] };
  const ht = icons['hurricane-track'].d;
  SMALL['hurricane-track'] = { d: [ht[0], ht[1], ht[2], HT_TRACK.d, head(HT_TRACK.end, HT_TRACK.tangent, 3.4)], fill: { solid: [0], wire: [1, 2], lines: [3, 4] } };
  // Frost: the bigger snowflake's Vs closed up into a blob; the family's six-armed flake, larger, over
  // the ground.
  SMALL.frost = { d: [...flake([12, 9.75], 5.25), line([2.75, FROST_G], [21.25, FROST_G])] };
  // The fronts: their gentle curve stepped into gray pixels. Straight, on a pixel row, with the same
  // symbols at the same places.
  const FY = 15.75;
  const fx = [4.5, 12, 19.5];
  const straight = line([2.25, FY], [21.75, FY]);
  const tri = (x) => `M${f(x - 2.6)} ${f(FY)}H${f(x + 2.6)}L${f(x)} ${f(FY - 3.75)}Z`;
  const halfDisc = (x) => `M${f(x - 2.6)} ${f(FY)}H${f(x + 2.6)}A2.6 2.6 0 0 0 ${f(x - 2.6)} ${f(FY)}Z`;
  SMALL['cold-front'] = { d: [straight, ...fx.map(tri)], fill: { solid: [1, 2, 3], wire: [0] } };
  SMALL['warm-front'] = { d: [straight, ...fx.map(halfDisc)], fill: { solid: [1, 2, 3], wire: [0] } };
  // Aurora: its swaying curtains ran to gray; straight, on pixel columns, with the ridge and the star.
  const au = icons.aurora.d;
  SMALL.aurora = { d: [au[0], line([5.25, 3.75], [5.25, 10.5]), line([9.75, 2.25], [9.75, 12]), line([14.25, 3.75], [14.25, 9.75]), au[4]], fill: { solid: [4], lines: [0, 1, 2, 3] } };
  // The forecast's calendar: the sun's two short rays broke into stray pixels beside the cloud.
  const cal = icons['calendar-cloud-sun'].d;
  SMALL['calendar-cloud-sun'] = { d: cal.slice(0, 5), fill: { solid: [0], wire: [1, 2], cut: [3, 4] }, badge: CAL_CLOUD };
}
// The furled umbrella: its slanted sides ran to a gray spike. A cone with 45° shoulders and straight
// sides on pixel centers, and the hook on its pixels.
{
  const canopy = roundpoly([[12.75, 2.25], [15.75, 6.75], [15.75, 12.75], [12.75, 15.75], [9.75, 12.75], [9.75, 6.75]], [0.3, 0.75, 1.5, 0.3, 1.5, 0.75]);
  const hook = 'M12.75 15.75V18.75a1.5 1.5 0 0 1-3 0';
  SMALL['umbrella-closed'] = { d: [canopy, hook], fill: { solid: [0], wire: [1] } };
}
// Weather radar: sistema's radar as it draws itself at 16 px (its rings on pixel centers, no echo).
SMALL['weather-radar'] = { d: sistema.icons.radar.small.d, fill: sistema.icons.radar.small.fill, badge: RADAR_CLOUD };
// A cloud in front (a custom piece) is snapped on its own, as the engine snaps one at 16 px.
for (const [name, { d, fill, badge: cl }] of Object.entries(SMALL)) {
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? d[i] : i));
  const f2 = fill && { solid: pick(fill.solid) };
  if (fill) for (const k of ['cut', 'lines', 'wire']) if (fill[k]?.length) f2[k] = pick(fill[k]);
  const sn = snapper([...d, ...(f2 ? Object.values(f2).flat() : [])]);
  icons[name].small = { d: d.map(sn), ...(f2 && { fill: Object.fromEntries(Object.entries(f2).map(([k, v]) => [k, v.map(sn)])) }) };
  if (cl) icons[name].small.badge = cloudBadge(snapper([cl])(cl));
}

export default { category: 'clima', label: 'Clima y cielo', icons };
