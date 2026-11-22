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
import { arc, badge, circ, dot, f, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import lugares from './lugares.mjs';

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
const BR = { square: ['br'] };
const L = lugares.icons;
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
/** Does the stroke stay 1.5 clear of the cloud (3 center to center, on the outside)? */
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
add('cloud-flurries', ['nieve ligera', 'aguanieve ligera', 'copos', 'flurries', 'light snow', 'snow showers'], [RAIN_CLOUD, ...flake([8.75, 19], 1.5), hail([15, 20])]);
add('cloud-sleet', ['aguanieve', 'lluvia y nieve', 'mezcla invernal', 'sleet', 'wintry mix', 'rain and snow'], [RAIN_CLOUD, streak([8, 17.25]), ...flake([12.25, 19.25]), streak([17.75, 17.25])]);
// A higher cloud for what needs more sky under it (freezing rain, rain blown by the wind).
const HK = 0.8;
const HO = [0, -4.4];
const HIGH_CLOUD = cloud(HK, HO);
{
  // Freezing rain: two drops land on the ground and, beside where they land, the ground hangs two
  // icicles.
  const G = 18.25;
  const icicle = (x, h) => roundpoly([[x - 1.3, G], [x + 1.3, G], [x, G + h]], [0, 0, 0.5]);
  const h = G - 15.45;
  add('cloud-freezing-rain', ['lluvia helada', 'lluvia engelante', 'tormenta de hielo', 'freezing rain', 'ice storm', 'glaze'], [
    HIGH_CLOUD,
    streak([8.05, 15.45], h),
    streak([14.55, 15.45], h),
    line([3.5, G], [20.5, G]),
    icicle(11.25, 3.5),
    icicle(17.75, 2.75),
  ]);
}
{
  // Wind-driven rain: steep streaks blown to the left and, under them, one gust flowing the same
  // way that curls up at its end, clear of them.
  const o = [0.75, -4.4];
  const sl = ([x, y], h) => line([x, y], [x - h * 0.75, y + h]);
  add('cloud-rain-wind', ['lluvia con viento', 'chubasco', 'turbonada', 'temporal', 'wind-driven rain', 'rain squall', 'storm'], [
    cloud(HK, o),
    sl([13.25, 15.45], 3),
    sl([16.75, 15.45], 3),
    sl([20.25, 15.45], 3),
    `M21.25 21.25H7.25${arc(7.25, 19, 2.25, 90, 270).d.replace(/^M[^A]+/, '')}`,
  ]);
}
// Windy and cloudy: lugares's wind under the rain cloud, a gust that curls down and a short one.
add('cloud-wind', ['nublado y ventoso', 'viento', 'brisa', 'cloudy and windy', 'breezy', 'windy'], [
  RAIN_CLOUD,
  `M3.5 17.25H15.75${arc(15.75, 19.5, 2.25, -90, 180).d.replace(/^M[^A]+/, '')}`,
  line([3.5, 21], [10.25, 21]),
]);

// ── The sky over the weather: sun or moon behind a cloud, precipitation under it ──────────────
// lugares's cloud-sun and cloud-moon with their cloud smaller (0.66) and higher, up and to the
// right, so the marks fit under it: the sun stays where cloud-sun has it (9.75, 9.75; its top ray
// reaches the live area) with the rays that keep 1.5 clear of the cloud, and the moon moves up
// 0.25. The marks keep their shapes, shortened to the 2.85 of sky left under the base.
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
  drizzle: [[13.4, SKY_Y], [16.6, 20.1], [19.8, SKY_Y]].map(dash),
  snow: [...flake([13.25, 20.15], 1.6), ...flake([19, 20.15], 1.6)],
  // A hailstone is removed whole if it comes within 4.45 of the cloud: both sit at 20.25
  hail: [hail([13.75, 20.25]), hail([18.75, 20.25])],
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
{
  // Hurricane: the tropical cyclone's map symbol, an eye and two arms that leave it on opposite
  // sides (the top one to the left, the bottom one to the right) and curve away from it.
  const r = 3;
  const R = 6.5;
  const arm = arc(12, 12 - r - R, R, 90, 180).d;
  add('hurricane', ['huracán', 'tifón', 'ciclón tropical', 'tormenta tropical', 'hurricane', 'typhoon', 'tropical cyclone'], [circ(12, 12, r), arm, turnPath(arm, 180)]);
}
{
  // Forecast track: a small hurricane at the start of a dashed path that widens into the cone (two
  // dashed edges that leave one point and the round end where the forecast stops).
  const c = [6.25, 17.25];
  const r = 1.6;
  const R = 3.25;
  const arm = arc(c[0], c[1] - r - R, R, 90, 180).d;
  const ax = -45;
  const A = polar(...c, 4.6, ax);
  const h = 20;
  const Lc = 11;
  const on = (s, t) => polar(...A, t, ax + s * h);
  add('hurricane-track', ['trayectoria del huracán', 'cono de incertidumbre', 'pronóstico de huracán', 'hurricane track', 'forecast cone', 'storm path'], [
    circ(...c, r),
    arm,
    turnPath(arm, 180, c),
    line(on(-1, 2.25), A, on(1, 2.25)),
    line(on(-1, 4.75), on(-1, 6.75)),
    line(on(1, 4.75), on(1, 6.75)),
    `M${pt(on(-1, 9.25))}L${pt(on(-1, Lc))}${arc(...A, Lc, ax - h, ax + h).d.replace(/^M[^A]+/, '')}L${pt(on(1, 9.25))}`,
  ]);
}
{
  // Sandstorm: three long gusts, the middle one curling, with grains in the gaps between them.
  add('sandstorm', ['tormenta de arena', 'tolvanera', 'polvo', 'haboob', 'sandstorm', 'dust storm', 'dust'], [
    line([2.75, 5], [15.5, 5]),
    `M2.75 12.25H16.5${arc(16.5, 9.75, 2.5, 90, -180).d.replace(/^M[^A]+/, '')}`,
    line([6.5, 19.5], [21.25, 19.5]),
    hail([8, 8.6]),
    hail([12, 15.9]),
    hail([19.25, 15.9]),
  ]);
}
// Blizzard: two flakes driven sideways by long gusts, no cloud.
add('blizzard', ['ventisca', 'tormenta de nieve', 'nieve y viento', 'blizzard', 'blowing snow', 'snowstorm'], [
  line([11, 6], [21.25, 6]),
  `M2.75 12H17.25${arc(17.25, 14.25, 2.25, -90, 180).d.replace(/^M[^A]+/, '')}`,
  line([2.75, 18], [11.75, 18]),
  ...flake([5.75, 6.25]),
  ...flake([18.25, 19.75]),
]);
{
  // Smoke: two plumes rising in an S whose tops bend to the right and curl down.
  const plume = (x, y0, top, a, r) => {
    const h = y0 - top;
    const e = [x + a + r, top + r];
    return `M${pt([x, y0])}C${pt([x - a, y0 - h * 0.25])} ${pt([x + a, y0 - h * 0.5])} ${pt([x, y0 - h * 0.7])}C${pt([x - a * 0.5, y0 - h * 0.85])} ${pt([x + a * 0.2, top])} ${pt([x + a, top])}H${f(x + a + 0.01)}${arc(e[0] - r, e[1], r, -90, 90).d.replace(/^M[^A]+/, '')}`;
  };
  add('smoke', ['humo', 'humareda', 'incendio', 'calidad del aire', 'smoke', 'smoky', 'wildfire smoke'], [plume(6.5, 21.25, 3.5, 3, 2.5), plume(14.5, 21.25, 9.75, 2.25, 2)]);
}
{
  // Lightning strike: a jagged bolt that hits the ground, two short sparks beside the hit.
  const G = 20.5;
  const P = [[15.5, 2.75], [8.75, 12], [14.25, 12], [11.5, G]];
  const hit = P[3];
  const up = angOf(hit, P[2]);
  const spark = (a) => line(polar(...hit, 4.5, a), polar(...hit, 6.75, a));
  add('lightning-strike', ['caída de rayo', 'impacto de rayo', 'rayo cercano', 'descarga', 'lightning strike', 'lightning nearby'], [roundline(P, [0, 0.6, 0.6, 0]), line([2.75, G], [21.25, G]), spark(-140), spark(-40)]);
}

// ── Heat, cold, haze and sun ──────────────────────────────────────────────────────────────────
/** A wavy line: n half waves of width h and amplitude a from (x0, y), up first (lugares's water). */
function ripple(y, x0, n, h = 3, a = 0.75) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const sg = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (sg * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (sg * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
}
const SHIMMER = [ripple(15.25, 3, 6), ripple(18.25, 3, 6), ripple(21.25, 3, 6)];
{
  // Heat wave: the sun (a little smaller, r 2.25) above three wavy lines of heat shimmer; its lower
  // rays give way to them.
  const c = [12, 9.4];
  const rays = sunRays(c, 2.25).filter((r) => SHIMMER.every((w) => gap(r, w) >= 3));
  add('heat-wave', ['ola de calor', 'calor extremo', 'canícula', 'bochorno', 'heat wave', 'extreme heat'], [circ(...c, 2.25), ...rays, ...SHIMMER]);
}
{
  // Cold wave: its pair, a flake (lugares's snowflake, smaller: three arms through the center and
  // a branch on each) above the same three lines.
  const c = [12, 6.75];
  const R = 4.6;
  const SIX = [-90, -30, 30, 90, 150, 210];
  add('cold-wave', ['ola de frío', 'frío extremo', 'aire polar', 'helada', 'cold wave', 'cold snap', 'polar air'], [
    ...[-90, -30, 30].map((a) => line(polar(...c, R, a), polar(...c, R, a + 180))),
    ...SIX.map((a) => head(polar(...c, R - 0.35, a), [Math.cos(rad(a)), Math.sin(rad(a))], 1.75, 40)),
    ...SHIMMER,
  ]);
}
add('mist', ['neblina', 'bruma', 'calima', 'niebla ligera', 'mist', 'haze', 'light fog'], [line([2.75, 7.5], [14.5, 7.5]), line([7, 12], [21.25, 12]), line([4.5, 16.5], [17, 16.5])]);
{
  // Haze by day: the upper half of the sun with its rays, sinking behind three horizontal lines.
  const C = [12, 13];
  const rays = [180, 225, 270, 315, 360].map((a) => line(polar(...C, 7, a), polar(...C, 9.1, a)));
  add('sun-haze', ['calima', 'bruma de día', 'niebla con sol', 'sol tenue', 'sun haze', 'hazy', 'fog by day'], [arc(...C, 4, 180, 360).d, ...rays, line([2.75, 13], [21.25, 13]), line([5.5, 16.75], [18.5, 16.75]), line([8.25, 20.5], [15.75, 20.5])]);
}
{
  // Sunny and windy: cloud-sun's sun and, under it, lugares's lower gusts; the rays that would
  // run into them give way.
  const g1 = `M2.75 16.25H16.75${arc(16.75, 18.5, 2.25, -90, 180).d.replace(/^M[^A]+/, '')}`;
  const g2 = line([2.75, 20.75], [11.25, 20.75]);
  const rays = sunRays(SUN_C, 2.5).filter((r) => [g1, g2].every((g) => gap(r, g) >= 3));
  add('sun-wind', ['sol y viento', 'soleado y ventoso', 'brisa', 'sunny and windy', 'breezy', 'windy'], [circ(...SUN_C, 2.5), ...rays, g1, g2]);
}
{
  // Day and night: the left half of the sun with its rays fitted against a crescent on the right.
  const r = 4;
  const R = 8.5;
  const half = `M12 ${f(12 - r)}A${r} ${r} 0 0 0 12 ${f(12 + r)}Z`;
  const rays = [135, 180, 225].map((a) => line(polar(12, 12, r + 3, a), polar(12, 12, r + 5.1, a)));
  const bulge = 4.25;
  const Ri = (R * R + bulge * bulge) / (2 * bulge);
  const crescent = `M12 ${f(12 - R)}A${R} ${R} 0 0 1 12 ${f(12 + R)}A${f(Ri)} ${f(Ri)} 0 0 0 12 ${f(12 - R)}Z`;
  add('sun-moon', ['día y noche', '24 horas', 'tema automático', 'claro y oscuro', 'day and night', 'auto theme', '24 hours'], [half, ...rays, crescent]);
}
{
  // UV index: the upper half of a sun above three bars rising in height.
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
  // Aurora: three curtains of light rising from the horizon, swaying, and one star.
  const curtain = (x, top, a) => `M${pt([x, 19.5])}C${pt([x + a, 19.5 - (19.5 - top) * 0.33])} ${pt([x - a, 19.5 - (19.5 - top) * 0.66])} ${pt([x, top])}`;
  const star = (c, R) => {
    const P = [0, 1, 2, 3].map((i) => polar(...c, R, -90 + i * 90));
    let d = `M${pt(P[0])}`;
    for (let i = 0; i < 4; i++) {
      const a = P[i];
      const b = P[(i + 1) % 4];
      d += `C${pt(lerp(a, c, 0.175))} ${pt(lerp(b, c, 0.175))} ${pt(b)}`;
    }
    return `${d}Z`;
  };
  add('aurora', ['aurora boreal', 'luces del norte', 'aurora austral', 'cielo nocturno', 'aurora', 'northern lights', 'aurora borealis'], [
    line([2.75, 19.5], [21.25, 19.5]),
    curtain(6, 9.5, 2.5),
    curtain(10.75, 5.5, 2.5),
    curtain(15.5, 9, 2.5),
    star([19, 4.75], 2.75),
  ]);
}
{
  // Sundial: a flat elliptical dial with hour marks along its near rim and its triangular gnomon
  // standing on it (a custom piece on top: the engine clears the dial's far edge around it).
  const C = [12, 15.25];
  const [rx, ry] = [9.25, 4.5];
  const dial = `M${f(C[0] - rx)} ${f(C[1])}A${rx} ${ry} 0 0 0 ${f(C[0] + rx)} ${f(C[1])}A${rx} ${ry} 0 0 0 ${f(C[0] - rx)} ${f(C[1])}Z`;
  const gnomon = roundpoly([[7.5, 15.25], [17, 15.25], [7.5, 6]], [0.6, 0.6, 0.8]);
  const mark = (t) => {
    const p = [C[0] + rx * 0.72 * Math.cos(rad(t)), C[1] + ry * 0.72 * Math.sin(rad(t))];
    return dot(...p);
  };
  add('sundial', ['reloj de sol', 'hora solar', 'gnomon', 'sundial', 'sun time', 'solar clock'], [dial, mark(40), mark(90), mark(140)], { badge: { d: [gnomon], knock: gnomon, fill: { solid: [gnomon] } } });
}
{
  // Frost: half flakes (the flake's three upper arms) growing from the ground.
  const G = 20;
  const crystal = (x, r) => [-150, -90, -30].map((a) => line([x, G], polar(x, G, r, a)));
  add('frost', ['escarcha', 'helada', 'hielo', 'frost', 'ground frost', 'hoarfrost'], [line([2.75, G], [21.25, G]), ...crystal(6.75, 4.5), ...crystal(12.75, 6.5), ...crystal(18.25, 3.75)]);
}
{
  // Icicles hanging from an eave, three lengths.
  const E = 5;
  const icicle = (x, h, w = 1.6) => roundpoly([[x - w, E], [x + w, E], [x, E + h]], [0, 0, 0.6]);
  add('icicles', ['carámbanos', 'hielo', 'congelado', 'superficie helada', 'icicles', 'ice', 'icy'], [line([2.75, E], [21.25, E]), icicle(6.5, 14), icicle(12, 9), icicle(17.5, 12)]);
}
{
  // Snow depth: a measuring stake standing in a snow mound, its ticks above the snow.
  const G = 20.5;
  const mound = `M2.75 ${G}C5.5 15.25 18.5 15.25 21.25 ${G}`;
  add('snow-depth', ['espesor de nieve', 'acumulación de nieve', 'nieve acumulada', 'snow depth', 'snowfall', 'snow accumulation'], [
    `${mound}Z`,
    line([11, 3], [11, 16.6]),
    line([11, 4.5], [14.75, 4.5]),
    line([11, 7.75], [13.5, 7.75]),
    line([11, 11], [14.75, 11]),
  ]);
}
{
  // The forecast for a date: calendario's calendar-sun (a sun rising from the body's bottom edge)
  // with a cloud in front of it, a custom piece in the badge's place.
  const CAL = [sq(3, 4.75, 18, 16.25, 4, BR), line([8, 2.9], [8, 6.5]), line([16, 2.9], [16, 6.5]), line([3, 9.75], [21, 9.75])];
  const k = 0.52;
  const o = [5.1, 4.9];
  const c = [10, 21];
  const rays = [-140, -105, -75, -40].map((a) => line(polar(...c, 5.6, a), polar(...c, 7.7, a))).filter((r) => clearOf(r, k, o));
  add('calendar-cloud-sun', ['pronóstico', 'clima del día', 'pronóstico de 10 días', 'forecast', 'daily forecast', 'weather for a date'], [...CAL, arc(...c, 2.75, 180, 360).d, ...rays], { badge: cloudBadge(cloud(k, o)) });
}

if (cloud() !== L.cloud.d[0] || RAIN_CLOUD !== L['cloud-rain'].d[0]) throw new Error('clima: the cloud is no longer lugares\'s');

export default { category: 'clima', label: 'Clima y cielo', icons };
