// Space and astronomy: small bodies, deep-sky objects, systems and orbits, the moon's phases,
// eclipses, telescopes and observatories, satellites, spacecraft, launches, crew and sci-fi.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5
// stroke, keylines, continuous corners and a square bottom-right corner on containers.
// The category adopts lugares's `planet` and `shooting-star` and datos's `rocket` (drawn there, never
// redrawn here): every rocket-* stands on datos's rocket itself, turned upright where it stands on a
// pad. The sun is lugares's (a disc and short rays 3 clear of it); the four-point star is datos's
// sparkle. The moon's phases are one disc construction (r 9): the lit part a solid outline, the dark
// part the same circle dashed (dashes of about 3, gaps of 3), never mirrored. The satellite is one
// drawing (a square body, a panel of two cells on each side, a short antenna), on the diagonal and
// turned or made smaller where it rides; the crew capsule is one drawing too, upright or hanging
// (tilted or nose to nose, its cone read as a bell).
// Whatever passes in front of another piece is a custom piece and the engine clears what is behind
// it; open strokes that stop short of a body stop 3 from it, center to center.
import { arc, badge, circ, dot, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import datos from './datos.mjs';

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
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

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
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/**
 * Closes every open subpath, for `fill.solid` (only closed shapes go there). The closing segment
 * runs along an edge that is already solid, so the silhouette doesn't change.
 */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** A smooth curve through points (Catmull-Rom as cubics); `closed` joins the last back to the first. */
function smooth(P, { closed = false, k = 1 } = {}) {
  const n = P.length;
  const get = (i) => (closed ? P[(i + n) % n] : P[Math.max(0, Math.min(n - 1, i))]);
  const tan = (i) => mul(sub(get(i + 1), get(i - 1)), k / 2);
  let d = `M${pt(P[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [a, b] = [get(i), get(i + 1)];
    d += `C${pt(add(a, mul(tan(i), 1 / 3)))} ${pt(sub(b, mul(tan(i + 1), 1 / 3)))} ${pt(b)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Intersections of two circles [x, y, r] (both, or null). */
function meet([x1, y1, r1], [x2, y2, r2]) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h2 = r1 * r1 - a * a;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  return [
    [m[0] + (h * (y2 - y1)) / d, m[1] - (h * (x2 - x1)) / d],
    [m[0] - (h * (y2 - y1)) / d, m[1] + (h * (x2 - x1)) / d],
  ];
}
const angOf = (c, p) => deg(Math.atan2(p[1] - c[1], p[0] - c[0]));

// ── Ellipses ──────────────────────────────────────────────────────────────────────────────────
// An ellipse is its center, its semi-axes and its tilt in degrees (clockwise on screen); a point on
// it is read by its parameter t in degrees (0 at the end of the major axis, growing clockwise).
const onEllipse = (c, rx, ry, tilt, t) => add(c, rot([rx * Math.cos(rad(t)), ry * Math.sin(rad(t))], [0, 0], tilt));
/** Arc of an ellipse from parameter t0 to t1 (clockwise when t1 > t0). */
function ellArc(c, rx, ry, tilt, t0, t1) {
  const large = Math.abs(t1 - t0) > 180 ? 1 : 0;
  return `M${pt(onEllipse(c, rx, ry, tilt, t0))}A${N(rx)} ${N(ry)} ${N(tilt)} ${large} ${t1 > t0 ? 1 : 0} ${pt(onEllipse(c, rx, ry, tilt, t1))}`;
}
/** A whole ellipse, drawn clockwise (an area the engine clears is filled nonzero). */
const ellipse = (c, rx, ry, tilt = 0) => `${ellArc(c, rx, ry, tilt, 0, 180)}${ellArc(c, rx, ry, tilt, 180, 360).replace(/^M[^A]+/, '')}Z`;
/** Arc length along an ellipse, as a table to read the parameter at a given length. */
function ellLength(c, rx, ry, tilt, t0, t1, steps = 720) {
  const ts = [t0];
  const ls = [0];
  let p = onEllipse(c, rx, ry, tilt, t0);
  for (let i = 1; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    const q = onEllipse(c, rx, ry, tilt, t);
    ts.push(t);
    ls.push(ls[i - 1] + len(sub(q, p)));
    p = q;
  }
  const at = (l) => {
    const i = Math.max(1, ls.findIndex((v) => v >= l));
    const f = (l - ls[i - 1]) / (ls[i] - ls[i - 1] || 1);
    return ts[i - 1] + (ts[i] - ts[i - 1]) * f;
  };
  return { total: ls[ls.length - 1], at };
}

// ── Dashes ────────────────────────────────────────────────────────────────────────────────────
// A dashed stroke is the stroke broken: gaps of 3 along it (1.5 of paper between the round caps),
// dashes of about 3. One path (several subpaths) per dashed stroke.
const GAP = 3;
/** How many dashes of about `D` fit in a length L with gaps between them. */
const fit = (L, D = 3, closed = false) => Math.max(1, Math.round((L + (closed ? 0 : GAP)) / (D + GAP)));
/** A dashed circular arc from a0 to a1 degrees, its first and last dash on the ends. */
function dashArc(c, r, a0, a1, k = fit((rad(a1 - a0) * r))) {
  const g = deg(GAP / r);
  const D = (a1 - a0 - (k - 1) * g) / k;
  return Array.from({ length: k }, (_, i) => arc(...c, r, a0 + i * (D + g), a0 + i * (D + g) + D).d).join('');
}
/** A whole circle dashed, `k` dashes starting at angle a0. */
function dashCircle(c, r, k = fit(2 * Math.PI * r, 3, true), a0 = -90) {
  const g = deg(GAP / r);
  const D = 360 / k - g;
  return Array.from({ length: k }, (_, i) => arc(...c, r, a0 + g / 2 + (i * 360) / k, a0 + g / 2 + (i * 360) / k + D).d).join('');
}

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
const D = datos.icons;
/** Datos's four-point sparkle (r 9.25 at the center), moved to `c` with radius R. */
const sparkle = (c, R) => transform(D.sparkle.d[0], R / 9.25, c[0] - (12 * R) / 9.25, c[1] - (12 * R) / 9.25);
/** Lugares's sun rays: from r + 3 to r + 5.1 (1.5 of clearance and just over 2 long). */
const ray = (c, r, a) => line(polar(...c, r + 3, a), polar(...c, r + 5.1, a));
/** A custom piece on top: drawn, and the area the engine clears around it. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
// `extra`: fields besides tags and d (the badge, a fill, parts…).
const put = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
const FILL = {};
const PARTS = {};
const LEVELS = {};

// ── Small bodies ──
{
  // Comet: the nucleus at the upper right and three tails that stream from it to the lower left,
  // fanning out along lines through its center: they start 3 clear of it, the middle one longest
  const c = [16.5, 7.5];
  const R = 3.5;
  // The outer two start farther out, where they stand 3 from the middle one
  const tail = (a, r0, r1) => line(polar(...c, r0, a), polar(...c, r1, a));
  const d = [circ(...c, R), tail(135, R + 3, 18.25), tail(115, 9, 15), tail(155, 9, 15)];
  put('comet', ['cometa', 'cola', 'astronomía', 'comet', 'tail', 'sky event'], d);
  FILL.comet = { solid: [d[0]], lines: d.slice(1) };
  PARTS.comet = { nucleus: [0], tail: [1, 2, 3] };
}
{
  // Asteroid: a lumpy rock, longer than it is tall and tilted, a dent in its right side, and two
  // craters of different sizes on a slant (not side by side, where they read as eyes)
  const P = [
    [3.5, 15],
    [3.5, 10.25],
    [6.5, 6.25],
    [11, 4.75],
    [16, 4.5],
    [20, 6.5],
    [21, 10.5],
    [18.5, 13.25],
    [17.75, 16.5],
    [14, 19.25],
    [9.5, 20],
    [5.75, 18.75],
  ];
  const d = [smooth(P, { closed: true }), circ(9.25, 10.5, 2.5), circ(13, 15.5, 1.75)];
  put('asteroid', ['asteroide', 'roca espacial', 'cuerpo menor', 'asteroid', 'space rock', 'minor body'], d);
  FILL.asteroid = { solid: [d[0]], cut: [d[1], d[2]] };
  PARTS.asteroid = { rock: [0], craters: [1, 2] };
}
{
  // Asteroid belt: a small sun and, around it, a tilted ellipse broken into dashes and rocks (dots),
  // a dash, then a rock 3.8 past its end (1.5 of paper from the dot's edge, and a little more)
  const c = [12, 12];
  const [rx, ry, tilt] = [9.6, 5.5, -20];
  const L = ellLength(c, rx, ry, tilt, -60, 300);
  const step = 3.8;
  const k = 5;
  const dash = L.total / k - 2 * step;
  const belt = [];
  const rocks = [];
  for (let i = 0; i < k; i++) {
    const s = (i * L.total) / k;
    belt.push(ellArc(c, rx, ry, tilt, L.at(s), L.at(s + dash)));
    rocks.push(dot(...onEllipse(c, rx, ry, tilt, L.at(s + dash + step)), 0.85));
  }
  const d = [circ(...c, 2.25), belt.join(''), ...rocks];
  put('asteroid-belt', ['cinturón de asteroides', 'cinturón de kuiper', 'sistema solar', 'asteroid belt', 'kuiper belt', 'solar system'], d);
  FILL['asteroid-belt'] = { solid: [d[0], ...rocks], wire: [d[1]] };
  // At 16 px the rocks and short dashes snap into noise: the belt as five long dashes
  const sk = 5;
  const sDash = L.total / sk - GAP;
  const sBelt = Array.from({ length: sk }, (_, i) => ellArc(c, rx, ry, tilt, L.at((i * L.total) / sk), L.at((i * L.total) / sk + sDash))).join('');
  icons['asteroid-belt'].small = { d: [d[0], sBelt], fill: { solid: [d[0]], wire: [sBelt] } };
  PARTS['asteroid-belt'] = { sun: [0], belt: [1, ...rocks.map((_, i) => i + 2)] };
}
{
  // Meteor: the rock at the lower left and its flame, open at the front: it wraps the rock 3 clear of
  // it (center to center) from just ahead of its sides and tapers to a point at the upper right
  const c = [7.25, 16.75];
  const r = 2.75;
  const rho = r + 3;
  const u = unit([1, -1]);
  const n = [-u[1], u[0]];
  const at = (a, rr) => add(c, add(mul(u, rr * Math.cos(rad(a))), mul(n, rr * Math.sin(rad(a)))));
  const tip = add(c, mul(u, 18));
  // The flame: from one side, along the circle to 55° off the axis, then on to the tip along the
  // circle's tangent; back the same way on the other side
  const A = 55;
  const back = (s) => at(s * A, rho);
  const tang = (s) => add(mul(u, Math.sin(rad(A))), mul(n, -s * Math.cos(rad(A))));
  const toTip = (s) => `C${pt(add(back(s), mul(tang(s), 4.5)))} ${pt(add(tip, add(mul(u, -4.5), mul(n, s * 1.6))))} ${pt(tip)}`;
  const fromTip = (s) => `C${pt(add(tip, add(mul(u, -4.5), mul(n, s * 1.6))))} ${pt(add(back(s), mul(tang(s), 4.5)))} ${pt(back(s))}`;
  const flame = `M${pt(at(105, rho))}A${N(rho)} ${N(rho)} 0 0 0 ${pt(back(1))}${toTip(1)}${fromTip(-1)}A${N(rho)} ${N(rho)} 0 0 0 ${pt(at(-105, rho))}`;
  const d = [circ(...c, r), flame];
  put('meteor', ['meteoro', 'bólido', 'bola de fuego', 'meteor', 'fireball', 'space rock'], d);
  FILL.meteor = { solid: [d[0]], wire: [d[1]] };
  PARTS.meteor = { rock: [0], flame: [1] };
}
{
  // Meteor shower: three parallel streaks falling to the lower left, each led by its head (a dot of
  // r 1 at the streak's end), 5 apart and of three lengths
  const u = unit([1, -1]);
  const n = [-u[1], u[0]];
  const streak = (o, s, l) => {
    const h = add([12, 12], add(mul(n, o), mul(u, s)));
    return [line(h, add(h, mul(u, l))), dot(...h, 1)];
  };
  const d = [...streak(-5, -2.25, 11), ...streak(0, -7.25, 8), ...streak(5, -3, 7)].map((p) => transform(p, 1, -0.25, 0.75));
  put('meteor-shower', ['lluvia de meteoros', 'estrellas fugaces', 'evento astronómico', 'meteor shower', 'shooting stars', 'sky event'], d);
  FILL['meteor-shower'] = false;
  PARTS['meteor-shower'] = { trails: [0, 2, 4], heads: [1, 3, 5] };
}

// ── Deep sky ──
{
  // Galaxy: a small oval core and two arms, logarithmic spirals that leave the core's two ends along
  // its edge and sweep out in a tilted S
  const c = [12, 12];
  const [rx, ry, tilt] = [3.5, 2, -25];
  const sweep = 190;
  const b = Math.log(9 / rx) / rad(sweep);
  const arm = (a0) =>
    smooth(
      Array.from({ length: 12 }, (_, i) => {
        const s = (sweep * i) / 11;
        const rr = rx * Math.exp(b * rad(s));
        // A squashed spiral, tilted like the core: the galaxy is seen at an angle
        const local = [rr * Math.cos(rad(-s)), rr * Math.sin(rad(-s)) * (0.57 + (0.25 * (rr - rx)) / (9 - rx))];
        return add(c, rot(local, [0, 0], tilt + a0));
      }),
    );
  const d = [ellipse(c, rx, ry, tilt), arm(0), arm(180)];
  put('galaxy', ['galaxia', 'espiral', 'universo', 'galaxy', 'spiral', 'universe'], d);
  FILL.galaxy = { solid: [d[0]], wire: [d[1], d[2]] };
  PARTS.galaxy = { core: [0], arms: [1, 2] };
}
{
  // Nebula: a cloud of uneven lobes on every side (no flat base) and the sparkle inside it. The lobes
  // are of very different sizes and sit off any ring: evenly spread around a center they read as a
  // rosette or a flower. The sparkle is small (r 3): the notch under it is the cloud's nearest point
  const c = [12, 12];
  const lobes = [
    [7.5, 9.5, 4.25],
    [13, 7.5, 3.5],
    [18, 9.25, 3],
    [19, 14.25, 2.5],
    [14.75, 16.25, 3.5],
    [8.5, 16, 3],
    [4.5, 13, 2.25],
  ];
  const n = lobes.length;
  // Each lobe's arc runs between its outer meeting points with its neighbors
  const outer = (A, B) => meet(A, B).sort((p, q) => len(sub(q, c)) - len(sub(p, c)))[0];
  const pts = lobes.map((L, i) => outer(L, lobes[(i + 1) % n]));
  let cloud = `M${pt(pts[n - 1])}`;
  lobes.forEach((L, i) => {
    const from = pts[(i - 1 + n) % n];
    const to = pts[i];
    let span = angOf(L, to) - angOf(L, from);
    span = ((span % 360) + 360) % 360;
    cloud += `A${N(L[2])} ${N(L[2])} 0 ${span > 180 ? 1 : 0} 1 ${pt(to)}`;
  });
  const d = [`${cloud}Z`, sparkle(c, 3)];
  put('nebula', ['nebulosa', 'nube de gas', 'cielo profundo', 'nebula', 'gas cloud', 'deep sky'], d);
  FILL.nebula = { solid: [d[0]], cut: [d[1]] };
  PARTS.nebula = { cloud: [0], star: [1] };
}
{
  // Supernova: a jagged burst of eight uneven points around a small core, 3 clear of its inner corners
  const c = [12, 12];
  const outerR = [9.5, 6.75, 9, 7.25, 9.75, 6.5, 8.75, 7.5];
  const turnA = [0, 6, -4, 7, -3, 5, -6, 3];
  const pts = [];
  for (let i = 0; i < 8; i++) {
    pts.push(polar(...c, outerR[i], -90 + i * 45 + turnA[i]));
    pts.push(polar(...c, 4.5, -90 + i * 45 + 22.5 + (turnA[i] + turnA[(i + 1) % 8]) / 2));
  }
  const d = [roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.7 : 0.45))), circ(...c, 1.5)];
  put('supernova', ['supernova', 'explosión estelar', 'estallido', 'supernova', 'stellar explosion', 'burst'], d);
  FILL.supernova = { solid: [d[0]], cut: [d[1]] };
  PARTS.supernova = { burst: [0], core: [1] };
}
{
  // Binary star: two sparkles of different sizes at the ends of a shared tilted ellipse; they sit on
  // top as a custom piece and the engine clears the ellipse around them
  const c = [12, 12];
  const [rx, ry, tilt] = [6.75, 3.25, -25];
  const big = sparkle(onEllipse(c, rx, ry, tilt, 180), 3.75);
  const small = sparkle(onEllipse(c, rx, ry, tilt, 0), 2.75);
  const d = [ellipse(c, rx, ry, tilt)];
  put('binary-star', ['estrella binaria', 'estrella doble', 'sistema estelar', 'binary star', 'double star', 'star system'], d, {
    badge: own([big, small], `${big}${small}`, { solid: [big, small] }),
  });
  FILL['binary-star'] = false;
  PARTS['binary-star'] = { orbit: [0] };
}
{
  // Star cluster: seven equal dots in a rough round swarm, closer together toward its middle
  const d = [
    [12, 12],
    [8.25, 9.75],
    [15.5, 9],
    [9.75, 15.75],
    [15.75, 14.75],
    [5, 14.25],
    [18.75, 5.75],
  ].map((p) => dot(...p, 1));
  put('star-cluster', ['cúmulo estelar', 'cúmulo globular', 'cielo profundo', 'star cluster', 'globular cluster', 'deep sky'], d);
  FILL['star-cluster'] = false;
}
{
  // Constellation: five stars joined in an irregular zigzag with one short branch
  const S = [
    [3.75, 12.5],
    [8.75, 6.25],
    [13.5, 11],
    [20.25, 8.25],
    [16, 19],
  ];
  const d = [line(S[0], S[1], S[2], S[3]), line(S[2], S[4]), ...S.map((p) => dot(...p, 1))];
  put('constellation', ['constelación', 'mapa estelar', 'estrellas', 'constellation', 'star map', 'star pattern'], d);
  FILL.constellation = false;
  PARTS.constellation = { lines: [0, 1], stars: [2, 3, 4, 5, 6] };
}

// ── Systems and orbits ──
{
  // Solar system: a small sun and two circular orbits, each with its planet (a dot) riding on
  // it; the planets sit on top as a custom piece, so each orbit breaks around its planet
  const c = [12, 12];
  const planets = [dot(...polar(...c, 5.5, -50), 0.85), dot(...polar(...c, 9.4, 140), 0.85)];
  const d = [circ(...c, 1.5), circ(...c, 5.5), circ(...c, 9.4)];
  const extra = { badge: own(planets, planets.join(''), { solid: planets }) };
  put('solar-system', ['sistema solar', 'planetas', 'órbitas', 'solar system', 'planets', 'orbits'], d, extra);
  FILL['solar-system'] = { solid: [d[0]], wire: [d[1], d[2]] };
  PARTS['solar-system'] = { sun: [0], orbits: [1, 2] };
}
{
  // Orbit: a body, a large tilted ellipse around it that passes behind it (it stops 3 from the body
  // on both crossings) and a small body riding on the ellipse
  const c = [12, 12];
  const R = 3;
  const [rx, ry, tilt] = [9.25, 4.5, -25];
  const dist = (t) => len(sub(onEllipse(c, rx, ry, tilt, t), c));
  let tb = 0;
  while (dist(tb + 0.25) >= R + 3) tb += 0.25;
  const d = [circ(...c, R), ellArc(c, rx, ry, tilt, -tb, tb), ellArc(c, rx, ry, tilt, 180 - tb, 180 + tb), dot(...onEllipse(c, rx, ry, tilt, 28), 1)];
  put('orbit', ['órbita', 'trayectoria', 'ecosistema', 'orbit', 'ecosystem', 'revolve'], d);
  FILL.orbit = { solid: [d[0], d[3]], wire: [d[1], d[2]] };
  PARTS.orbit = { body: [0], orbit: [1, 2], satellite: [3] };
}
{
  // Trajectory: a dashed transfer arc from a small planet at the lower left to a larger one at the
  // upper right, starting 3 clear of the first and ending in an arrowhead 3 clear of the second
  const A = [4.75, 19.25];
  const rA = 1.75;
  const B = [17.75, 6.25];
  const rB = 3.25;
  const M = lerp(A, B, 0.5);
  const half = len(sub(B, A)) / 2;
  const s = 6;
  const h = (half * half - s * s) / (2 * s);
  const O = add(M, mul(unit([1, 1]), h));
  const r = h + s;
  // Angles of the planets seen from the arc's center, and where the arc leaves and arrives
  const aA = angOf(O, A) + deg((rA + 3) / r);
  const aB = angOf(O, B) + 360 - deg((rB + 3.25) / r);
  const a0 = aA;
  const a1 = aB > aA ? aB : aB + 360;
  const end = arc(...O, r, a0, a1);
  const k = fit(rad(a1 - a0) * r - 1, 3);
  const d = [circ(...A, rA), circ(...B, rB), dashArc(O, r, a0, a1, k), head(end.end, end.tangent, 3.4)];
  put('trajectory', ['trayectoria', 'transferencia', 'plan de vuelo', 'trajectory', 'transfer orbit', 'flight plan'], d);
  FILL.trajectory = { solid: [d[0], d[1]], lines: [d[2], d[3]] };
  PARTS.trajectory = { origin: [0], destination: [1], path: [2], arrow: [3] };
}
{
  // Planet and moon: a large planet with one band across it and a small moon, apart, at its upper
  // right (no orbit and no ring)
  const c = [10.25, 13.75];
  const R = 7;
  const y = c[1] + 0.5;
  const hx = Math.sqrt(R * R - 0.25);
  const band = `M${pt([c[0] - hx, y])}A${N(hx)} 2 0 0 0 ${pt([c[0] + hx, y])}`;
  const d = [circ(...c, R), band, circ(19, 5, 2.25)];
  put('planet-moon', ['planeta y luna', 'satélite natural', 'luna', 'planet moon', 'natural satellite', 'moon'], d);
  FILL['planet-moon'] = { solid: [d[0], d[2]], cut: [d[1]] };
  PARTS['planet-moon'] = { planet: [0, 1], moon: [2] };
}
{
  // Gas giant: a banded planet, three bands that follow its curve and a storm (an oval) between
  // them, 3 clear of every band
  const c = [12, 12];
  const R = 9;
  const band = (y, sag = 1) => {
    const hx = Math.sqrt(R * R - (y - c[1]) ** 2);
    return `M${pt([c[0] - hx, y])}A${N(hx)} ${N(sag)} 0 0 0 ${pt([c[0] + hx, y])}`;
  };
  const d = [circ(...c, R), band(5.75, 0.75), band(9.25, 0.75), band(18.25, 0.5), ellipse([14, 14.4], 2.5, 1.4)];
  put('gas-giant', ['gigante gaseoso', 'júpiter', 'planeta', 'gas giant', 'jupiter', 'banded planet'], d);
  FILL['gas-giant'] = { solid: [d[0]], cut: [d[1], d[2], d[3], d[4]] };
  PARTS['gas-giant'] = { planet: [0], bands: [1, 2, 3], storm: [4] };
}

// ── Stars and sky events ──
{
  // Solar eclipse: two equal discs on a diagonal; the moon in front, a custom piece the engine clears
  // the sun around, and the sun's rays (lugares's) on its visible side only
  const sun = [11.5, 11.5];
  const R = 4.5;
  const moonC = add(sun, [2.75, 2.75]);
  const moon = circ(...moonC, R);
  const d = [circ(...sun, R), ...[135, 180, -135, -90, -45].map((a) => ray(sun, R, a))];
  put('eclipse', ['eclipse solar', 'eclipse', 'sol y luna', 'solar eclipse', 'eclipse', 'sun and moon'], d, { badge: own([moon], moon, { solid: [moon] }) });
  FILL.eclipse = { solid: [d[0]], lines: d.slice(1) };
  PARTS.eclipse = { sun: [0], rays: [1, 2, 3, 4, 5] };
}

// ── The moon's phases ──
// One disc (r 9 at the center): the lit part a solid outline, the dark part the same circle dashed.
// The terminator is half an ellipse as tall as the disc (a = its half width); the dashes stop where
// they stand 3 from the lit outline.
const MC = [12, 12];
const MR = 9;
/** The lit part: the right half and the terminator bulging right (a > 0, a crescent) or left (a < 0). */
const lit = (a) => (a === 0 ? `${arc(...MC, MR, -90, 90).d}Z` : `${arc(...MC, MR, -90, 90).d}A${N(Math.abs(a))} ${MR} 0 0 ${a > 0 ? 0 : 1} 12 3Z`);
/** The dashes along the dark left arc, from where they stand 3 clear of the lit outline. */
function darkArc(a, D = 3) {
  const term = Array.from({ length: 181 }, (_, i) => {
    const t = -90 + i;
    return [MC[0] - a * Math.cos(rad(t)) * -1, MC[1] + MR * Math.sin(rad(t))];
  });
  const lim = [...term, [12, 3], [12, 21]];
  const clear = (ang) => {
    const p = polar(...MC, MR, ang);
    return Math.min(...lim.map((q) => len(sub(p, q)))) >= GAP;
  };
  let a0 = 90;
  while (!clear(a0)) a0 += 0.25;
  return dashArc(MC, MR, a0, 360 - a0, fit(rad(360 - 2 * a0) * MR, D));
}
const PHASES = [
  ['moon-waxing-crescent', 4.5, ['luna creciente', 'fase lunar', 'calendario lunar', 'waxing crescent', 'moon phase', 'lunar calendar']],
  ['moon-first-quarter', 0, ['cuarto creciente', 'media luna', 'fase lunar', 'first quarter', 'half moon', 'moon phase']],
  ['moon-waxing-gibbous', -4.5, ['luna gibosa creciente', 'fase lunar', 'calendario lunar', 'waxing gibbous', 'moon phase', 'lunar calendar']],
];
put('moon-new', ['luna nueva', 'fase lunar', 'calendario lunar', 'new moon', 'moon phase', 'lunar calendar'], [dashCircle(MC, MR)], { small: { d: [dashCircle(MC, MR, 6)] } });
FILL['moon-new'] = false;
PARTS['moon-new'] = { dark: [0] };
for (const [name, a, tags] of PHASES) {
  const d = [lit(a), darkArc(a)];
  put(name, tags, d);
  FILL[name] = { solid: [d[0]], wire: [d[1]] };
  PARTS[name] = { lit: [0], dark: [1] };
  // At 16 px: fewer, longer dashes (dashes of about 3 snap into a string of pixels)
  const sd = [lit(a), darkArc(a, 5.5)];
  icons[name].small = { d: sd, fill: { solid: [sd[0]], wire: [sd[1]] } };
}
{
  const d = [circ(...MC, MR), circ(8.75, 9.25, 2), circ(14.5, 14.75, 1.6)];
  put('moon-full', ['luna llena', 'fase lunar', 'luna', 'full moon', 'moon phase', 'moon'], d);
  FILL['moon-full'] = { solid: [d[0]], cut: [d[1], d[2]] };
  PARTS['moon-full'] = { lit: [0], craters: [1, 2] };
}
// The waning phases are the waxing ones flipped (the lit side moves to the left)
for (const [from, name, tags] of [
  ['moon-waxing-gibbous', 'moon-waning-gibbous', ['luna gibosa menguante', 'fase lunar', 'calendario lunar', 'waning gibbous', 'moon phase', 'lunar calendar']],
  ['moon-first-quarter', 'moon-last-quarter', ['cuarto menguante', 'media luna', 'fase lunar', 'last quarter', 'third quarter', 'moon phase']],
  ['moon-waxing-crescent', 'moon-waning-crescent', ['luna menguante', 'fase lunar', 'calendario lunar', 'waning crescent', 'moon phase', 'lunar calendar']],
]) {
  const d = icons[from].d.map((p) => flipPath(p));
  const sd = icons[from].small.d.map((p) => flipPath(p));
  put(name, tags, d, { small: { d: sd, fill: { solid: [sd[0]], wire: [sd[1]] } } });
  FILL[name] = { solid: [d[0]], wire: [d[1]] };
  PARTS[name] = { lit: [0], dark: [1] };
}
{
  // Moonrise and moonset: lugares's crescent moon (its inner disc 0.873 R off toward the upper right,
  // 0.794 R across) standing on the sunrise's horizon with only the bottom of its belly behind it, so
  // both horns show, and the arrow in the crescent's opening, above its right horn (beside the horn,
  // the set arrow's head met it). Half sunk, with one horn left, it read as lugares's wave
  const H = 19.5;
  const c = [9.75, 13.75];
  const R = 6.5;
  const ic = add(c, mul(unit([1, -1]), R * 0.873));
  const r = R * 0.794;
  const [top, tip] = meet([...c, R], [...ic, r]).sort((u, v) => u[1] - v[1]);
  const hx = Math.sqrt(R * R - (H - c[1]) ** 2);
  const moon = `M${pt([c[0] - hx, H])}A${N(R)} ${N(R)} 0 0 1 ${pt(top)}A${N(r)} ${N(r)} 0 0 0 ${pt(tip)}A${N(R)} ${N(R)} 0 0 1 ${pt([c[0] + hx, H])}`;
  const horizon = line([2.75, H], [21.25, H]);
  const ax = 19;
  const up = [line([ax, 10.75], [ax, 3]), head([ax, 3], [0, -1], 3)];
  const down = [line([ax, 3], [ax, 10.75]), head([ax, 10.75], [0, 1], 3)];
  for (const [name, arrow, tags] of [
    ['moonrise', up, ['salida de la luna', 'luna', 'astronomía', 'moonrise', 'moon rising', 'night']],
    ['moonset', down, ['puesta de la luna', 'luna', 'astronomía', 'moonset', 'moon setting', 'night']],
  ]) {
    const d = [horizon, moon, ...arrow];
    put(name, tags, d);
    FILL[name] = { solid: [shut(moon)], wire: [horizon], lines: arrow };
    PARTS[name] = { horizon: [0], moon: [1], arrow: [2, 3] };
  }
}

// ── Telescopes and observatories ──
/** A box of half sizes (hl along u, hw across) around c, turned to the angle a, with rounded corners. */
const tube = (c, a, hl, hw, r) => {
  const u = [Math.cos(rad(a)), Math.sin(rad(a))];
  const n = [-u[1], u[0]];
  const at = (s, t) => add(c, add(mul(u, s), mul(n, t)));
  return { d: roundpoly([at(hl, -hw), at(hl, hw), at(-hl, hw), at(-hl, -hw)], r), at, u, n };
};
{
  // Telescope: a long tube angled up to the right, a finder scope above it on a short stem, and a
  // mount below it: a post and three legs to the ground
  const T = tube([11.75, 8.75], -27, 7.5, 2.15, 1);
  const finder = line(T.at(-4, -5.15), T.at(0.25, -5.15));
  const stem = line(T.at(-1.75, -2.15), T.at(-1.75, -5.15));
  const hub = T.at(0.75, 2.15);
  const J = [hub[0], 14];
  const d = [T.d, finder, stem, line(hub, [hub[0], 21]), line(J, [6.25, 21]), line(J, [hub[0] * 2 - 6.25, 21])];
  put('telescope', ['telescopio', 'astronomía', 'explorar', 'telescope', 'stargazing', 'discover'], d);
  FILL.telescope = { solid: [d[0]], wire: d.slice(1) };
  icons.telescope.small = { d: [d[0], d[3], d[4], d[5]], fill: { solid: [d[0]], wire: [d[3], d[4], d[5]] } };
  PARTS.telescope = { tube: [0], finder: [1, 2], mount: [3, 4, 5] };
}
{
  // Radio telescope: comunicacion's satellite dish (a half disc and the feed's arm from the middle of
  // its rim to a dot it touches), larger and facing up and to the right, raised on a tall A-frame that
  // leaves the back of the bowl. On three struts over a shallow dish it read as an umbrella
  const C = [12, 9];
  const r = 6.25;
  const f = -55;
  const dish = `${arc(...C, r, f + 90, f + 270).d}Z`;
  const back = polar(...C, r, f + 180);
  const feed = polar(...C, 4.75, f);
  const d = [dish, line(C, polar(...C, 4.05, f)), dot(...feed), line([4.5, 21], back, [13, 21])];
  put('radio-telescope', ['radiotelescopio', 'antena', 'estación terrena', 'radio telescope', 'ground station', 'deep space network'], d);
  FILL['radio-telescope'] = { solid: [d[0], d[2]], wire: [d[1], d[3]] };
  PARTS['radio-telescope'] = { dish: [0], feed: [1, 2], mount: [3] };
}

{
  // Observatory: a dome on a short drum, its slit open from the top down to the drum (the dome in two
  // halves), and the telescope's tube poking out of the slit: the slit's edges run on up into the
  // tube's sides, which end in a round cap
  const c = [12, 14.75];
  const R = 7.5;
  const half = 1.75;
  const yS = (x) => c[1] - Math.sqrt(R * R - (x - c[0]) ** 2);
  const [xL, xR] = [c[0] - half, c[0] + half];
  const [PL, PR] = [[xL, yS(xL)], [xR, yS(xR)]];
  const domeL = arc(...c, R, 180, 360 + angOf(c, PL)).d;
  const domeR = arc(...c, R, 360 + angOf(c, PR), 360).d;
  const u = [Math.cos(rad(-65)), Math.sin(rad(-65))];
  const L = 4.75;
  const eL = add(PL, mul(u, L));
  const eR = add(PR, mul(u, L - 2 * half * Math.cos(rad(65))));
  const w = len(sub(eR, eL)) / 2;
  const tube = `M${pt([xL, c[1]])}L${pt(PL)}L${pt(eL)}A${N(w)} ${N(w)} 0 0 1 ${pt(eR)}L${pt(PR)}L${pt([xR, c[1]])}`;
  const base = sq(4.5, c[1], 15, 6.5, 1.5, { square: ['tl', 'tr'] });
  const d = [base, domeL, domeR, tube];
  put('observatory', ['observatorio', 'cúpula', 'astronomía', 'observatory', 'dome', 'stargazing'], d);
  FILL.observatory = { solid: [base, `${domeL}L${pt([xL, c[1]])}Z`, `${domeR.replace(/^M/, `M${pt([xR, c[1]])}L`)}Z`, `M${pt(PL)}L${pt(eL)}A${N(w)} ${N(w)} 0 0 1 ${pt(eR)}L${pt(PR)}Z`], wire: [tube] };
  PARTS.observatory = { building: [0], dome: [1, 2], telescope: [3] };
}
{
  // Planetarium: a low dome on a short drum, standing on a base line, and inside it the night sky:
  // a sparkle and two stars (dots), 3 or more clear of everything
  const c = [12, 16.5];
  const R = 8.75;
  const G = 20.5;
  const hall = `M${pt([c[0] - R, G])}V${N(c[1])}${arc(...c, R, 180, 360).d.replace(/^M[^A]+/, '')}V${N(G)}`;
  const d = [line([2, G], [22, G]), hall, sparkle([12, 13.5], 2.5), dot(7.25, 16.5), dot(16.75, 16.5)];
  put('planetarium', ['planetario', 'cúpula', 'cielo nocturno', 'planetarium', 'dome', 'night sky'], d);
  FILL.planetarium = { solid: [shut(hall)], wire: [d[0]], cut: [d[2], d[3], d[4]] };
  PARTS.planetarium = { ground: [0], dome: [1], sky: [2, 3, 4] };
}

// ── Satellites ──
/**
 * The satellite: a square body, a panel on each side on a short strut, each panel divided across
 * into two cells (3 wide), and a short antenna with a ball at its tip. `c` is the body's center;
 * `deg` turns it (0: panels level, the antenna up). Every satellite in the set is this one, smaller
 * or turned.
 */
function satellite(c, { b = 4, w = 6, h = 6, gap = 2, ant = 3, deg: a = 0 } = {}) {
  const T = (d) => (a ? turnPath(d, a, c) : d);
  const px = b / 2 + gap;
  const [x, y] = c;
  const body = T(sq(x - b / 2, y - b / 2, b, b, 1.1));
  const left = T(sq(x - px - w, y - h / 2, w, h, 1));
  const right = T(sq(x + px, y - h / 2, w, h, 1));
  const divL = T(line([x - px - w / 2, y - h / 2], [x - px - w / 2, y + h / 2]));
  const divR = T(line([x + px + w / 2, y - h / 2], [x + px + w / 2, y + h / 2]));
  const strutL = T(line([x - px, y], [x - b / 2, y]));
  const strutR = T(line([x + b / 2, y], [x + px, y]));
  const mast = T(line([x, y - b / 2], [x, y - b / 2 - ant]));
  const tipC = rot([x, y - b / 2 - ant], c, a);
  const tip = dot(...tipC, 0.85);
  const d = [body, left, right, divL, divR, strutL, strutR, mast, tip];
  return {
    d,
    fill: { solid: [body, left, right, tip], cut: [divL, divR], wire: [strutL, strutR, mast] },
    parts: { body: [0], panels: [1, 2, 3, 4, 5, 6], antenna: [7, 8] },
  };
}
// The satellite itself lies on the diagonal, the antenna to the upper left: that is the only way its
// panels are long (6.75 by 5; at 4.75 the fill lost its clean weights). Level, the panels came out as
// wide as they were tall and, with the body and the antenna's ball, read as letters (ıoıo) or a
// dumbbell
const SAT_ARGS = { b: 4.5, w: 6.75, h: 5, gap: 2, ant: 2.75, deg: -45 };
const SAT = satellite([12, 12], SAT_ARGS);
put('satellite', ['satélite', 'órbita', 'conectividad', 'satellite', 'orbit', 'connectivity'], SAT.d);
FILL.satellite = SAT.fill;
PARTS.satellite = SAT.parts;
/** At 16 px the turned panels' dividers clog (as satellite-signal's do): the panels plain. */
const plainSat = (S) => ({ d: S.d.filter((_, i) => i !== 3 && i !== 4), fill: { solid: S.fill.solid, wire: S.fill.wire } });
icons.satellite.small = plainSat(SAT);
// With the badge it moves 1 up and left, square to its own axis, so the badge clears its body whole
const SAT_UP = satellite([11, 11], SAT_ARGS);
put('satellite-alert', ['falla de satélite', 'sin contacto', 'anomalía', 'satellite alert', 'lost contact', 'anomaly'], SAT_UP.d, { badge: badge('alert') });
icons['satellite-alert'].small = plainSat(SAT_UP);
FILL['satellite-alert'] = SAT_UP.fill;
PARTS['satellite-alert'] = SAT_UP.parts;
{
  // Satellite link: the satellite, smaller and turned 45° at the upper right, and two signal arcs
  // from its body toward the lower left, clear of its panels
  const c = [13.5, 10.5];
  const S = satellite(c, { b: 3, w: 5.75, gap: 2.25, ant: 2.25, deg: 45 });
  const waves = [arc(...c, 5.25, 116, 154).d, arc(...c, 8.25, 112, 158).d];
  const d = [...S.d, ...waves];
  put('satellite-signal', ['enlace satelital', 'señal', 'transmisión', 'satellite link', 'signal', 'uplink'], d);
  FILL['satellite-signal'] = { ...S.fill, lines: waves };
  // At 16 px the turned panels' dividers clog: the panels plain
  const sd = [...S.d.filter((_, i) => i !== 3 && i !== 4), ...waves];
  icons['satellite-signal'].small = { d: sd, fill: { solid: S.fill.solid, wire: S.fill.wire, lines: waves } };
  PARTS['satellite-signal'] = { ...S.parts, signal: [9, 10] };
  LEVELS['satellite-signal'] = [[9], [10]];
}
{
  // Space station: the truss across, at each end an array above it and one below (long and narrow,
  // each split into two cells, 3 clear of the truss), and the module stack at the middle. A tall panel
  // crossed by the truss at each end read as fitness's barbell
  const y = 12;
  const [pw, ph] = [3.25, 6];
  const xs = [3.25, 17.5];
  const top = (up) => (up ? y - 3 - ph : y + 3);
  const panels = xs.flatMap((x) => [sq(x, top(true), pw, ph, 0.9), sq(x, top(false), pw, ph, 0.9)]);
  const cells = xs.flatMap((x) => [true, false].map((up) => line([x, top(up) + ph / 2], [x + pw, top(up) + ph / 2])));
  const module = sq(9.75, 9.5, 4.5, 5, 1.25);
  const truss = [line([2.5, y], [9.75, y]), line([14.25, y], [21.5, y])];
  const d = [...truss, module, ...panels, ...cells];
  put('space-station', ['estación espacial', 'puesto orbital', 'centro', 'space station', 'orbital outpost', 'hub'], d);
  FILL['space-station'] = { solid: [module, ...panels], cut: cells, wire: truss };
  PARTS['space-station'] = { truss: [0, 1], module: [2], panels: [3, 4, 5, 6, 7, 8, 9, 10] };
}

// ── Spacecraft ──
{
  // Space shuttle: the orbiter in profile, nose right: a long body with a blunt round nose, its
  // windshield a line across the nose's top, the tall fin at the back, the delta wing below the rear
  // of the body and the engines' bells at the tail
  const nose = [[15.75, 10.5], [19, 10.5], [21.5, 11.5], [21.75, 13]];
  const body = `M4.5 10.5H15.75C19 10.5 21.5 11.5 21.75 13C21.5 14.25 20 15 18.25 15H4.5Z`;
  const bez = (P, t) => [0, 1].map((j) => (1 - t) ** 3 * P[0][j] + 3 * (1 - t) ** 2 * t * P[1][j] + 3 * (1 - t) * t * t * P[2][j] + t ** 3 * P[3][j]);
  const fin = roundline([[7.5, 10.5], [5.75, 4.25], [4.25, 4.25], [4.5, 10.5]], [0, 0.6, 0.6, 0]);
  const wing = roundline([[15, 15], [8, 19.25], [5, 19.25], [5, 15]], [0, 1, 0.75, 0]);
  const window = line([15.25, 10.5], bez(nose, 0.62));
  const engines = line([4.5, 12.75], [2.25, 12.75]);
  const d = [body, fin, wing, window, engines];
  put('space-shuttle', ['transbordador espacial', 'avión espacial', 'viaje espacial', 'space shuttle', 'spaceplane', 'orbiter'], d);
  FILL['space-shuttle'] = { solid: [body, shut(fin), shut(wing)], cut: [window], wire: [engines] };
  PARTS['space-shuttle'] = { body: [0, 3], fin: [1], wing: [2], engines: [4] };
}
/**
 * The crew capsule, upright: a truncated cone, its docking ring on top and its heat shield (a shallow
 * arc) at the base, the seam between them, and one window off its middle. Returns its strokes; `place` moves,
 * scales and turns it (around the capsule's own center, 12, 11).
 */
function capsule(k = 1, to = [12, 11], a = 0) {
  const cone = roundline([[4, 15.5], [9, 5.5], [15, 5.5], [20, 15.5]], [0, 1, 1, 0]);
  const shell = `${cone}A16 16 0 0 1 4 15.5Z`;
  const seam = line([4, 15.5], [20, 15.5]);
  const ring = 'M10.25 5.5V4.6A0.85 0.85 0 0 1 11.1 3.75H12.9A0.85 0.85 0 0 1 13.75 4.6V5.5';
  // The window off the middle, toward the right side (in the middle it read as an eye)
  const win = circ(13.5, 11.25, 1.25);
  const place = (d) => {
    const m = transform(d, k, to[0] - 12 * k, to[1] - 11 * k);
    return a ? turnPath(m, a, to) : m;
  };
  return [shell, seam, ring, win].map(place);
}
/** The capsule drawn small (under 0.7): the shell alone; the seam, ring and window would clog. */
const smallCapsule = (k, to, a = 0) => [capsule(k, to, a)[0]];
{
  const d = capsule();
  put('space-capsule', ['cápsula espacial', 'misión tripulada', 'turismo espacial', 'space capsule', 'crew capsule', 'crewed mission'], d);
  FILL['space-capsule'] = { solid: [d[0], shut(d[2])], cut: [d[1], d[3]] };
  PARTS['space-capsule'] = { capsule: [0, 1, 3], hatch: [2] };
}
{
  // Splashdown: the capsule (drawn small) hanging by two lines from a parachute canopy (scalloped at
  // its hem), over one wave line
  const canopy = `M4 8A8 5.5 0 0 1 20 8${[0, 1, 2].map((i) => `A3 1.25 0 0 0 ${N(20 - (i + 1) * (16 / 3))} 8`).join('')}Z`;
  const k = 0.42;
  const at = (x, y) => [12 + (x - 12) * k, 15.75 + (y - 11) * k];
  const cap = smallCapsule(k, [12, 15.75]);
  const d = [canopy, line([4, 8], at(9.75, 5.5)), line([20, 8], at(14.25, 5.5)), cap[0], 'M3 20.75C5.25 19.25 7.5 19.25 9.75 20.75S14.25 22.25 16.5 20.75 19.5 19.75 21 20.25'];
  put('splashdown', ['amerizaje', 'paracaídas', 'recuperación', 'splashdown', 'parachute', 'recovery'], d);
  FILL.splashdown = { solid: [canopy, d[3]], wire: [d[1], d[2]], lines: [d[4]] };
  PARTS.splashdown = { parachute: [0, 1, 2], capsule: [3], wave: [4] };
}
{
  // Lander: an angular descent stage, a small dish on a short stem above it, and its legs in profile
  // (the two outer ones splayed, the front one straight down; the fourth hides behind it), each on a
  // round footpad seen edge-on
  const stage = roundpoly([[7.5, 9.25], [16.5, 9.25], [18.5, 11.75], [16.5, 14.25], [7.5, 14.25], [5.5, 11.75]], 0.75);
  // The dish: a half disc (r 2.75, so its hole stays open at every weight) facing up and to the right
  // on a short stem from the stage's top
  const dc = [12.5, 4.5];
  const da = -35;
  const dish = `M${pt(add(dc, rot([-2.75, 0], [0, 0], da)))}A2.75 2.75 0 0 0 ${pt(add(dc, rot([2.75, 0], [0, 0], da)))}Z`;
  const bottom = add(dc, rot([0, 2.75], [0, 0], da));
  const stem = line(bottom, [bottom[0], 9.25]);
  const foot = (x) => line([x - 1.4, 19.75], [x + 1.4, 19.75]);
  const d = [stage, dish, stem, `${line([6.5, 13], [3.75, 19.75])}${foot(3.75)}`, `${line([17.5, 13], [20.25, 19.75])}${foot(20.25)}`, `${line([12, 14.25], [12, 19.75])}${foot(12)}`];
  put('lander', ['módulo de aterrizaje', 'alunizaje', 'misión lunar', 'lander', 'moon landing', 'mars lander'], d);
  FILL.lander = { solid: [stage, dish], wire: [stem, d[3], d[4], d[5]] };
  PARTS.lander = { stage: [0], dish: [1, 2], legs: [3, 4, 5] };
}
{
  // Rover: in profile, a flat deck on wheels (three seen, the far three behind them) joined by its
  // rocker-bogie arms, and a camera mast rising at its front
  const deck = sq(3.75, 9.75, 14, 3.5, 1);
  const mast = line([15.25, 9.75], [15.25, 6]);
  const head = sq(13.25, 3.25, 5.5, 2.75, 1);
  const wheels = [5, 11.5, 18].map((x) => circ(x, 19, 1.75));
  const B = [8.25, 15];
  const arms = `M${pt([5, 17.25])}L${pt(B)}L${pt([11.5, 17.25])}M${pt(B)}L${pt([12.75, 13.25])}L${pt([18, 17.25])}`;
  const d = [deck, mast, head, ...wheels, arms];
  put('rover', ['rover', 'vehículo explorador', 'exploración de marte', 'rover', 'mars rover', 'planetary rover'], d);
  FILL.rover = { solid: [deck, head, ...wheels], wire: [mast, arms] };
  PARTS.rover = { deck: [0], mast: [1, 2], wheels: [3, 4, 5], arms: [6] };
}

// ── Launch ──
// Datos's rocket turned upright (it flies at 45° there, 1.08 times its drawn size): body, fins,
// window and flame.
const UP = D.rocket.d.map((p) => turnPath(p, -45));
/** The upright rocket scaled by k around its body's middle and moved to (x, y). */
const rocketAt = (k, x, y, parts = [0, 1, 2, 3]) => parts.map((i) => transform(UP[i], k, x - 12 * k, y - 12 * k));
{
  // Launch pad: the rocket standing on its fins beside its tower (a ladder of rungs), the ground
  // running from its fin under the tower (under the rocket it would crowd its base), and the access
  // arm reaching from the tower to the rocket's nose
  // At the rocket's full size: any smaller, its window clogs against its walls at bold
  const k = 1;
  const G = 20.25;
  const y0 = G - (17.94 - 12) * k;
  const R = rocketAt(k, 7.75, y0);
  const tower = sq(16.75, 4.5, 3.75, G - 4.5, 0.75, { square: ['bl', 'br'] });
  const rungs = [12.5].map((y) => line([16.75, y], [20.5, y]));
  // The arm reaches the nose's right edge above the window (datos's ogive, found where it crosses the
  // arm's height)
  const armY = 9.5;
  const toWorld = ([x, y]) => [7.75 + (x - 12) * 1.08 * k, y0 + (y - 12) * 1.08 * k];
  const ogiveR = (t) => {
    const P = [[12, 2.75], [13.75, 4.25], [15, 6.5], [15, 9.5]];
    return [0, 1].map((j) => (1 - t) ** 3 * P[0][j] + 3 * (1 - t) ** 2 * t * P[1][j] + 3 * (1 - t) * t * t * P[2][j] + t ** 3 * P[3][j]);
  };
  let tA = 0;
  while (toWorld(ogiveR(tA))[1] < armY) tA += 0.001;
  const armX = toWorld(ogiveR(tA))[0];
  const finTip = 7.75 + (17.94 - 12) * k;
  const d = [...R, line([finTip, G], [21.5, G]), tower, ...rungs, line([armX, armY], [16.75, armY])];
  put('launch-pad', ['plataforma de lanzamiento', 'puerto espacial', 'torre', 'launch pad', 'spaceport', 'launch site'], d);
  FILL['launch-pad'] = { solid: [R[0], shut(R[1]), shut(R[2]), tower], cut: [R[3], ...rungs], wire: [d[4], d[7]] };
  icons['launch-pad'].small = { d: [...R, d[4], tower, d[7]], fill: { solid: [R[0], shut(R[1]), shut(R[2]), tower], cut: [R[3]], wire: [d[4], d[7]] } };
  PARTS['launch-pad'] = { rocket: [0, 1, 2, 3], ground: [4], tower: [5, 6], arm: [7] };
}
/** The rocket's body as an ogive of half width hw, its nose `top` and its base `bottom` (datos's curve). */
function ogive(cx, top, hw, bottom) {
  const k = hw / 3;
  const shoulder = top + 6.75 * k;
  return `M${pt([cx - hw, bottom])}L${pt([cx - hw, shoulder])}C${pt([cx - hw, shoulder - 3 * k])} ${pt([cx - 1.75 * k, top + 1.5 * k])} ${pt([cx, top])}C${pt([cx + 1.75 * k, top + 1.5 * k])} ${pt([cx + hw, shoulder - 3 * k])} ${pt([cx + hw, shoulder])}L${pt([cx + hw, bottom])}Z`;
}
/** A nozzle under a body: an open bell from (cx ± top) at y down to (cx ± bottom) at y + h. */
const bell = (cx, y, t, b, h) => roundline([[cx - t, y], [cx - b, y + h], [cx + b, y + h], [cx + t, y]], [0, 0.5, 0.5, 0]);
{
  // Heavy lift: the core and two shorter strap-on boosters 3 clear of it, a nozzle under each, no
  // flame
  const core = ogive(12, 2.5, 2.75, 16.25);
  const bL = ogive(4.5, 7.5, 1.75, 16.25);
  const bR = ogive(19.5, 7.5, 1.75, 16.25);
  const d = [core, bL, bR, dot(12, 9.5), bell(12, 16.25, 1.5, 2.25, 2.75), bell(4.5, 16.25, 1, 1.5, 2.25), bell(19.5, 16.25, 1, 1.5, 2.25)];
  put('rocket-heavy', ['cohete pesado', 'propulsores laterales', 'lanzador', 'heavy rocket', 'boosters', 'launch vehicle'], d);
  FILL['rocket-heavy'] = { solid: [core, bL, bR, shut(d[4]), shut(d[5]), shut(d[6])], cut: [d[3]] };
  PARTS['rocket-heavy'] = { core: [0, 3, 4], boosters: [1, 2, 5, 6] };
}

{
  // Booster landing: an upright booster (the rocket's body, narrower) on two splayed legs that leave
  // its lower end (seen from the side; the other two behind them), a flame under it touching the pad
  const G = 20.5;
  const body = ogive(12, 2.25, 2.25, 15);
  const legs = [line([9.75, 12.75], [5.5, G]), line([14.25, 12.75], [18.5, G])];
  const flame = `M12 ${G}C10.9 ${G - 0.9} 10.5 ${N(G - 1.75)} 10.5 19.25A1.5 1.5 0 0 1 13.5 19.25C13.5 ${N(G - 1.75)} 13.1 ${N(G - 0.9)} 12 ${G}Z`;
  const d = [body, ...legs, flame, line([2.75, G], [21.25, G])];
  put('rocket-landing', ['aterrizaje de cohete', 'cohete reutilizable', 'propulsor', 'rocket landing', 'reusable rocket', 'booster landing'], d);
  FILL['rocket-landing'] = { solid: [body, flame], wire: [d[1], d[2], d[4]] };
  PARTS['rocket-landing'] = { booster: [0, 1, 2], flame: [3], pad: [4] };
}
{
  // Successful launch: datos's rocket itself and the engine's check badge
  const R = D.rocket;
  put('rocket-check', ['lanzamiento exitoso', 'misión cumplida', 'despegue', 'launch success', 'mission complete', 'liftoff'], R.d, { badge: badge('check') });
  FILL['rocket-check'] = { solid: [R.d[0], shut(R.d[1]), shut(R.d[2])], cut: [R.d[3]], lines: [R.d[4]] };
  PARTS['rocket-check'] = { body: [0, 1, 2], window: [3], flame: [4] };
}

// ── Crew ──
{
  // Astronaut: a bust; the round helmet and its wide visor in front (a custom piece the engine clears
  // the shoulders around), the bulky shoulders, and the chest's control box rising from their base
  const helmet = circ(12, 8.75, 6.25);
  const visor = sq(8.75, 7.25, 6.5, 3.5, 1.75);
  const shoulders = 'M5 21.25H19A1.6 1.6 0 0 0 20.55 19.3C19.9 16.05 16.9 14 12 14S4.1 16.05 3.45 19.3A1.6 1.6 0 0 0 5 21.25Z';
  const box = 'M9.75 21.25V18.75H14.25V21.25';
  const d = [shoulders, box];
  put('astronaut', ['astronauta', 'tripulación', 'explorador', 'astronaut', 'crew', 'space explorer'], d, { badge: own([helmet, visor], helmet, { solid: [helmet], cut: [visor] }) });
  FILL.astronaut = { solid: [shoulders], cut: [box] };
  PARTS.astronaut = { suit: [0, 1] };
}
{
  // Space suit: the empty suit standing front-on: a domed helmet, the bulky body (torso, arms held a
  // little out and legs in one outline, every notch 3 wide where it opens) and the chest pack
  const right = [
    [15.25, 10.5],
    [17.5, 11.25],
    [20.25, 15],
    [18.75, 16.75],
    [16, 14],
    [16, 17],
    [17, 21.25],
    [13.75, 21.25],
  ];
  const mirror = right.map(([x, y]) => [24 - x, y]).reverse();
  const body = roundpoly([...right, [12, 18], ...mirror], [0.75, 1.25, 0.8, 0.8, 0.5, 0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.5, 0.8, 0.8, 1.25, 0.75]);
  const d = [circ(12, 5, 3), body, sq(10.5, 13.5, 3, 2.75, 0.6)];
  put('spacesuit', ['traje espacial', 'caminata espacial', 'equipo', 'space suit', 'spacesuit', 'eva suit'], d);
  FILL.spacesuit = { solid: [d[0], d[1]], cut: [d[2]] };
  icons.spacesuit.small = { d: d.slice(0, 2), fill: { solid: d.slice(0, 2) } };
  PARTS.spacesuit = { helmet: [0], suit: [1, 2] };
}
{
  // Space helmet: the astronaut's helmet alone, on its neck ring: the dome and its wide visor (on top as
  // a custom piece, so the ring behind it shows only below and beside it)
  const helmet = circ(12, 9.75, 7.25);
  const visor = sq(7.75, 8, 8.5, 4.5, 2.25);
  const ring = sq(4.75, 16, 14.5, 4.5, 2.25);
  const d = [ring];
  put('space-helmet', ['casco espacial', 'casco de astronauta', 'ciencia ficción', 'space helmet', 'astronaut helmet', 'sci-fi'], d, { badge: own([helmet, visor], helmet, { solid: [helmet], cut: [visor] }) });
  FILL['space-helmet'] = { solid: [ring] };
  PARTS['space-helmet'] = { ring: [0] };
}
{
  // Jetpack: two thruster tubes side by side, 3 apart, their tops pointed like the rocket's, a strap
  // across between them, and a short flame under each tube (in place of the shoulder straps, which
  // read as headphones' band or binoculars' bridge). Each flame is a narrow leaf, pointed at both
  // ends, 3 below its tube: a drop with a round top read as a map pin
  const [a, b] = [8.25, 15.75];
  const strap = line([a + 2.25, 10.5], [b - 2.25, 10.5]);
  const flame = (x, y0 = 18, y1 = 22, w = 1.6) => {
    const at = (k, s) => pt([x + s * w * (k ? 0.6 : 1.3), y0 + (y1 - y0) * (k ? 0.8 : 0.35)]);
    return `M${pt([x, y0])}C${at(0, 1)} ${at(1, 1)} ${pt([x, y1])}C${at(1, -1)} ${at(0, -1)} ${pt([x, y0])}Z`;
  };
  const d = [ogive(a, 3, 2.25, 15), ogive(b, 3, 2.25, 15), strap, flame(a), flame(b)];
  put('jetpack', ['mochila propulsora', 'vuelo personal', 'propulsor', 'jetpack', 'jet pack', 'personal flight'], d);
  FILL.jetpack = { solid: [d[0], d[1], d[3], d[4]], wire: [strap] };
  PARTS.jetpack = { pack: [0, 1, 2], flame: [3, 4] };
}

// ── Sci-fi ──
{
  // Alien: a head with a wide domed cranium tapering to a small chin and two large almond eyes,
  // slanted up toward the outside; no mouth
  const head = smooth(
    [
      [12, 21.25],
      [7, 17.5],
      [3.25, 11],
      [5, 5],
      [12, 2.5],
      [19, 5],
      [20.75, 11],
      [17, 17.5],
    ],
    { closed: true },
  );
  const almond = (c, a, L = 5, h = 1.45) => {
    const r = (L * L / 4 + h * h) / (2 * h);
    const p = add(c, rot([-L / 2, 0], [0, 0], a));
    const q = add(c, rot([L / 2, 0], [0, 0], a));
    return `M${pt(p)}A${N(r)} ${N(r)} 0 0 1 ${pt(q)}A${N(r)} ${N(r)} 0 0 1 ${pt(p)}Z`;
  };
  const d = [head, almond([8.25, 12], 25), almond([15.75, 12], -25)];
  put('alien', ['extraterrestre', 'alienígena', 'usuario desconocido', 'alien', 'extraterrestrial', 'unknown user'], d);
  FILL.alien = { solid: [head], cut: [d[1], d[2]] };
  PARTS.alien = { head: [0], eyes: [1, 2] };
}
/** The flying saucer: a lens-shaped hull and a dome on it; `k` scales it around its middle, at c. */
function saucer(c = [12, 12.5], k = 1) {
  const [hx, up, down] = [9.5, 2.5, 2.25];
  const rU = (hx * hx + up * up) / (2 * up);
  const rD = (hx * hx + down * down) / (2 * down);
  const hull = `M${pt([12 - hx, 12])}A${N(rU)} ${N(rU)} 0 0 1 ${pt([12 + hx, 12])}A${N(rD)} ${N(rD)} 0 0 1 ${pt([12 - hx, 12])}Z`;
  const topC = [12, 12 - up + rU];
  const domeR = 4;
  const domeC = [12, 9.5 + 0.35];
  const [p, q] = meet([...domeC, domeR], [...topC, rU]).sort((u, v) => u[0] - v[0]);
  const dome = `M${pt(p)}A${domeR} ${domeR} 0 0 1 ${pt(q)}`;
  const place = (d) => transform(d, k, c[0] - 12 * k, c[1] - 12 * k);
  const bottom = (x) => 12 + Math.sqrt(rD * rD - (x - 12) ** 2) - (rD - down);
  return { hull: place(hull), dome: place(dome), domeShut: place(`${dome}A${N(rU)} ${N(rU)} 0 0 0 ${pt(p)}Z`), bottom };
}
{
  // Flying saucer: the hull, the dome on it and three lights beneath
  const S = saucer();
  const d = [S.hull, S.dome, ...[7.25, 12, 16.75].map((x) => dot(x, x === 12 ? 18.5 : 18, 0.85))];
  put('flying-saucer', ['platillo volador', 'ovni', 'ciencia ficción', 'flying saucer', 'ufo', 'sci-fi'], d);
  FILL['flying-saucer'] = { solid: [S.hull, S.domeShut, d[2], d[3], d[4]] };
  PARTS['flying-saucer'] = { saucer: [0, 1], lights: [2, 3, 4] };
}
{
  // Beaming down: the saucer, smaller and higher, and a cone of light (two lines) widening from its
  // belly to a short ground line
  const k = 0.78;
  const S = saucer([12, 7.25], k);
  const G = 20.25;
  const belly = (x) => [12 + (x - 12) * k, 7.25 + (S.bottom(x) - 12) * k];
  const d = [S.hull, S.dome, line(belly(9), [5.5, G]), line(belly(15), [18.5, G]), line([3.5, G], [20.5, G])];
  put('flying-saucer-beam', ['abducción', 'teletransporte', 'ovni', 'tractor beam', 'abduction', 'teleport'], d);
  FILL['flying-saucer-beam'] = { solid: [S.hull, S.domeShut], wire: [d[2], d[3], d[4]] };
  PARTS['flying-saucer-beam'] = { saucer: [0, 1], beam: [2, 3], ground: [4] };
}

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
for (const [name, fill] of Object.entries(FILL)) icons[name].fill = fill;

// ── Named parts (emitted as data-part) ────────────────────────────────────────────────────────
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Levels: the signal's arcs light up from the inside out ──────────────────────────────────────
for (const [name, levels] of Object.entries(LEVELS)) icons[name].levels = levels;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// With a piece on top: the slash would cross it and at 58 % it stops reading
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Already round, the whole circle: not enclosed in another one
for (const name of ['gas-giant', 'solar-system']) icons[name].variants = { ...icons[name].variants, circle: false };
// The moon's phases are the disc itself: no circle around them, and a slash through a phase says nothing
for (const name of [...PHASES.map(([n]) => n), 'moon-new', 'moon-full', 'moon-waning-gibbous', 'moon-last-quarter', 'moon-waning-crescent'])
  icons[name].variants = { ...icons[name].variants, circle: false, slash: false };
// Lone lines and dots: a slash through them says nothing
for (const name of ['star-cluster', 'meteor-shower']) icons[name].variants = { ...icons[name].variants, slash: false };

// ── Mirroring: what is seen from the side faces one way and travels that way (aviacion's rule) ─────
for (const name of ['space-shuttle', 'rover', 'trajectory']) icons[name].mirror = true;

// ── Motion: each icon's own gesture ───────────────────────────────────────────────────────────
const MOTION = {
  comet: { effect: 'slide', vector: [1.5, -1.5] },
  asteroid: { effect: 'float', vector: [0, -1.5] },
  'asteroid-belt': { effect: 'spin', parts: ['belt'], origin: [12, 12] },
  meteor: { effect: 'slide', vector: [-1.5, 1.5] },
  'meteor-shower': { effect: 'slide', vector: [-1.5, 1.5] },
  galaxy: { effect: 'spin', origin: [12, 12] },
  nebula: { effect: 'beat', parts: ['star'], origin: [12, 12] },
  supernova: { effect: 'beat', origin: [12, 12] },
  'star-cluster': { effect: 'beat', origin: [12, 12] },
  'solar-system': { effect: 'spin', parts: ['badge'], origin: [12, 12] },
  orbit: { effect: 'spin', parts: ['satellite'], origin: [12, 12] },
  trajectory: { effect: 'slide', parts: ['arrow'], vector: [1, -1] },
  'planet-moon': { effect: 'float', parts: ['moon'], vector: [0, -1.25] },
  eclipse: { effect: 'slide', parts: ['badge'], vector: [1.25, 1.25] },
  moonrise: { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] },
  moonset: { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  telescope: { effect: 'wiggle', parts: ['tube'], origin: [12.5, 11] },
  'radio-telescope': { effect: 'wiggle', parts: ['dish', 'feed'], origin: [8.4, 14.1] },
  planetarium: { effect: 'beat', parts: ['sky'], origin: [12, 14] },
  satellite: { effect: 'float', vector: [0, -1.5] },
  'satellite-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'satellite-signal': { effect: 'beat', parts: ['signal'], origin: [13.5, 10.5] },
  'space-station': { effect: 'float', vector: [0, -1.5] },
  'space-shuttle': { effect: 'slide', vector: [2, 0] },
  splashdown: { effect: 'float', parts: ['parachute', 'capsule'], vector: [0, 1.25] },
  lander: { effect: 'bounce', vector: [0, -2] },
  rover: { effect: 'slide', vector: [1.5, 0] },
  'launch-pad': { effect: 'slide', parts: ['rocket'], vector: [0, -2] },
  'rocket-heavy': { effect: 'slide', vector: [0, -2] },
  'rocket-landing': { effect: 'bounce', parts: ['booster', 'flame'], vector: [0, -2] },
  'rocket-check': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.25] },
  astronaut: { effect: 'float', vector: [0, -1.25] },
  jetpack: { effect: 'slide', vector: [0, -1.5] },
  alien: { effect: 'wiggle', origin: [12, 21] },
  'flying-saucer': { effect: 'float', vector: [0, -1.5] },
  'flying-saucer-beam': { effect: 'float', parts: ['saucer'], vector: [0, -1] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

export default { category: 'espacio', label: 'Espacio y astronomía', icons };
