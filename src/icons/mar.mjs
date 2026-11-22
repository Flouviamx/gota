// Sea life: fish by kind, sharks and rays, whales and dolphins, seals and walruses, octopus, squid and
// jellyfish, crabs and lobsters, shells, coral, seaweed and sea turtles. Everything is computed with
// the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, the keylines, and no
// piece closer than 2.85 to another it doesn't touch.
// The category adopts lugares's `fish` (drawn there, never redrawn here): fish-* stand on it at
// camping's fish-catch scale (0.82, the fish up and left, clear of a badge), the scale at which the
// hole in its tail stays open at every weight. Every fish kind is a profile facing left, like it, at
// one scale, its tail the base's triangle unless its kind has its own. The whales, dolphins and the
// orca share one fluke (`fluke`) and the narwhal is the whale's own body, the sharks share one body
// (`SHARK`), the corals one branching outline (`treeOutline`), the clam and the mussel one hinge
// (`valve`) and the hermit crab wears the seashell's conch (`CONCH`). Animals seen from above (rays,
// crabs, the lobster, the starfish, the turtle) stand centered on the canvas, head
// up. The water is lugares's wave (`ripple`: amplitude 1, half period 3).
import { badge, circ, dot, line, polar, roundpoly, rot, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import lugares from './lugares.mjs';

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
/** Closes every open subpath, for `fill.solid` (only closed shapes go there). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
/** A path scaled by `s` about `o` and moved so `o` lands on `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
const placePt = (p, s, o, to = o) => [to[0] + (p[0] - o[0]) * s, to[1] + (p[1] - o[1]) * s];

/**
 * A smooth curve through points (Catmull-Rom, written as cubics). A point [x, y, 1] is a corner:
 * the curve turns there, each side bending as the next point asks (a parabolic end). Closed by
 * default; `open` draws the ends as corners.
 */
function spline(P, { closed = true, samples = 0 } = {}) {
  const n = P.length;
  const at = (i) => P[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const corner = (i) => (!closed && (i <= 0 || i >= n - 1)) || at(i)[2] === 1;
  const m = P.map((_, i) => (corner(i) ? null : mul(sub(at(i + 1), at(i - 1)), 0.5)));
  const tan = (i) => m[closed ? (i + n) % n : i];
  const segs = closed ? n : n - 1;
  let d = `M${pt(P[0])}`;
  const curves = [];
  for (let i = 0; i < segs; i++) {
    const [p1, p2] = [at(i), at(i + 1)];
    const chord = sub(p2, p1);
    let m1 = tan(i);
    let m2 = tan(i + 1);
    if (!m1) m1 = m2 ? sub(mul(chord, 2), m2) : chord;
    if (!m2) m2 = tan(i) ? sub(mul(chord, 2), tan(i)) : chord;
    const c1 = add(p1, mul(m1, 1 / 3));
    const c2 = sub(p2, mul(m2, 1 / 3));
    curves.push([p1, c1, c2, p2]);
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  if (closed) d += 'Z';
  if (!samples) return d;
  // Points along it, `samples` per segment (for bands and clearances)
  const out = [];
  for (const [a, b, c, e] of curves)
    for (let k = 0; k < samples; k++) {
      const t = k / samples;
      const u = 1 - t;
      out.push([0, 1].map((j) => u * u * u * a[j] + 3 * u * u * t * b[j] + 3 * u * t * t * c[j] + t * t * t * e[j]));
    }
  out.push(curves.at(-1)[3]);
  return { d, pts: out };
}
const curve = (...P) => spline(P, { closed: false });

/** A spine: the smooth curve through its points, read by the fraction of its length. */
function spineOf(spinePts) {
  const { pts } = spline(spinePts, { closed: false, samples: 24 });
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len(sub(pts[i], pts[i - 1])));
  const total = L.at(-1);
  return (t) => {
    const s = Math.max(0, Math.min(1, t)) * total;
    const j = Math.max(1, L.findIndex((v) => v >= s - 1e-9));
    const u = (s - L[j - 1]) / (L[j] - L[j - 1] || 1);
    const dir = unit(sub(pts[j], pts[j - 1]));
    return { p: lerp(pts[j - 1], pts[j], u), dir, nrm: [-dir[1], dir[0]] };
  };
}
/**
 * A body along a spine: the spine's points (a smooth curve through them) and its half width at
 * each fraction of its length (`w(t)`, 0 at the head end). Each end is a round cap (`false`), a point
 * (`true`) or, at the head, an open jaw (`'jaw'`). `samples` returns { d, pts } (points along it).
 */
function band(spinePts, w, { k = 10, tip = [false, true], samples = false, jaw = 1.9 } = {}) {
  const at = spineOf(spinePts);
  const left = [];
  const right = [];
  for (let i = 0; i <= k; i++) {
    const { p, nrm } = at(i / k);
    left.push(add(p, mul(nrm, w(i / k))));
    right.push(sub(p, mul(nrm, w(i / k))));
  }
  const [a, b] = [at(0), at(1)];
  const out = [];
  if (tip[0] === 'mouth') {
    // An open mouth: the two jaws the same length, the corner `jaw` deep into the head
    const h = w(0);
    out.push([...sub(a.p, mul(a.nrm, h * 0.9)), 1], [...add(a.p, mul(a.dir, jaw)), 1], [...add(a.p, mul(a.nrm, h * 0.9)), 1]);
    left.shift();
    right.shift();
  } else if (tip[0] === 'jaw') {
    // The upper jaw (right of the spine), the corner of the mouth and the lower jaw
    const h = w(0);
    out.push([...add(sub(a.p, mul(a.nrm, h * 0.8)), mul(a.dir, -0.35)), 1], [...add(a.p, mul(a.dir, jaw)), 1], [...add(add(a.p, mul(a.nrm, h * 0.75)), mul(a.dir, 0.15)), 1]);
    left.shift();
    right.shift();
  } else if (tip[0]) out.push([...a.p, 1]);
  else out.push(sub(a.p, mul(a.dir, w(0))));
  out.push(...left);
  if (tip[1]) out.push([...b.p, 1]);
  else out.push(add(b.p, mul(b.dir, w(1))));
  out.push(...right.reverse());
  const P = out.filter((p, i, arr) => i === 0 || len(sub(p, arr[i - 1])) > 0.05);
  return samples ? spline(P, { samples: 24 }) : spline(P);
}
/** The sample point nearest to `p` (where a piece meets an outline). */
const nearest = (pts, p) => pts.reduce((best, q) => (len(sub(q, p)) < len(sub(best, p)) ? q : best), pts[0]);
/**
 * Bends a drawing laid out straight (x along it, y across it, down +) round an arch: x = 0 lands
 * at `a0` degrees on the circle of radius R about C and runs clockwise; y < 0 is the outside.
 */
const bender = (C, R, a0) => ([x, y, c]) => {
  const p = polar(...C, R - y, a0 + (x / R) * (180 / Math.PI));
  return c ? [...p, c] : p;
};

/** An ellipse (rx ≠ ry), optionally turned `tilt` degrees. */
function ell(c, rx, ry, tilt = 0) {
  const a = polar(0, 0, 1, tilt);
  const p0 = add(c, mul(a, -rx));
  const p1 = add(c, mul(a, rx));
  return `M${pt(p0)}A${N(rx)} ${N(ry)} ${N(tilt)} 1 0 ${pt(p1)}A${N(rx)} ${N(ry)} ${N(tilt)} 1 0 ${pt(p0)}Z`;
}

// ── Water ─────────────────────────────────────────────────────────────────────────────────────
// Lugares's wave: half periods of `h` whose crests rise `a` (cubics whose peak is exactly `a`).
// `phase` 1 starts it on a trough, so a stretch cut from a longer wave keeps its rhythm.
function ripple(y, x0 = 3, n = 6, h = 3, a = 1, phase = 0) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = (i + phase) % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
}
/** The same wave run backwards between two of its nodes (to close a fill along the water). */
function rippleBack(y, x0, xa, xb, h = 3, a = 1) {
  // From xb back to xa (xa < xb, both nodes of the wave that starts at x0)
  let d = '';
  for (let x = xb; x > xa + 0.01; x -= h) {
    const i = Math.round((x - h - x0) / h);
    const s = i % 2 ? 1 : -1;
    d += `C${pt([x - h / 3, y + (s * 4 * a) / 3])} ${pt([x - (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x - h, y])}`;
  }
  return d;
}

// ── Lugares's fish ────────────────────────────────────────────────────────────────────────────
const L = lugares.icons;
const FISH = L.fish.d;
/** The fish's tail: a triangle from the joint, its far corners rounded (the base's own). */
const tail = (J, x1, h) => roundpoly([J, [x1, J[1] - h], [x1, J[1] + h]], [0.3, 1, 1]);
// With a badge: camping's fish-catch placement (0.82, up and left, its eye moved in from the edge)
const FB_S = 0.82;
const FB = [...FISH.slice(0, 2).map((d) => place(d, FB_S, [3.25, 6.25], [2.75, 3.5])), dot(...placePt([7.4, 11.15], FB_S, [3.25, 6.25], [2.75, 3.5]))];

const icons = {};
const put = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill by index into `d` (or as a path): solid, cut, lines, wire; `false` for lines only. */
const FILL = {};
const PARTS = {};
const MOTION = {};
const BC = [17.25, 17.25];
const BADGE_MOTION = {
  plus: { effect: 'beat', parts: ['badge'], origin: BC },
  search: { effect: 'wiggle', parts: ['badge'], origin: BC },
  alert: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
};

// ── Fish ──────────────────────────────────────────────────────────────────────────────────────
{
  // School: two copies of the fish at camping's fish-catch scale (0.82, so the hole in each tail stays
  // open at every weight) on a diagonal, both heading left; the front one passes in front of the one
  // behind it (the engine clears it), the eyes moved in from the edge
  const s = 0.82;
  const eyeAt = (c) => add(c, mul(unit([-2.25, -1.25]), 5.75 * s - 3.1));
  const fishAt = (c) => [...FISH.slice(0, 2).map((p) => place(p, s, [9, 12], c)), dot(...eyeAt(c))];
  const back = fishAt([21.25 - 12.25 * s, 2.75 + 5.75 * s]);
  const front = fishAt([2.75 + 5.75 * s, 21.25 - 5.75 * s]);
  put('fish-school', ['banco de peces', 'cardumen', 'peces', 'avistamiento', 'school of fish', 'shoal', 'fish population'], back, { badge: { d: front, knock: shut(front.slice(0, 2).join('')), fill: { solid: front.slice(0, 2), cut: [front[2]] } } });
  FILL['fish-school'] = { solid: [0, 1], cut: [2] };
  PARTS['fish-school'] = { body: [0], tail: [1], eye: [2] };
  MOTION['fish-school'] = { effect: 'slide', vector: [-1.5, 0] };
}
for (const [name, kind, tags] of [
  ['fish-plus', 'plus', ['agregar especie', 'registrar avistamiento', 'bitácora de buceo', 'censo marino', 'add species', 'log sighting', 'dive log']],
  ['fish-search', 'search', ['identificar especie', 'guía de especies', 'buscar pez', 'catálogo marino', 'identify species', 'species guide', 'fish finder']],
  ['fish-alert', 'alert', ['especie venenosa', 'aviso de consumo', 'especie invasora', 'pez tóxico', 'toxic fish', 'consumption advisory', 'invasive species']],
]) {
  put(name, tags, FB, { badge: badge(kind) });
  FILL[name] = { solid: [0, 1], cut: [2] };
  PARTS[name] = { body: [0], tail: [1], eye: [2] };
  MOTION[name] = BADGE_MOTION[kind];
}
{
  // Tropical fish, the angelfish: a pointed snout, the tall dorsal and anal fins swept back into two
  // long points above and below the base's small tail, and one band bowed across the whole body
  // behind the eye (a round disc trailing a streamer, with the band broken by the eye, read as a
  // lemon with a curl)
  const J = [17.25, 12];
  const { d: body, pts } = spline([[2.75, 11.75, 1], [4, 9.25], [6.5, 7], [9.5, 5.25], [13.5, 3.75], [17.25, 2.75, 1], [15.5, 6.25], [16.25, 9.5], [...J, 1], [16.25, 14.5], [15.5, 17.75], [17.25, 21.25, 1], [13.5, 20.25], [9.5, 18.75], [6.5, 17], [4, 14.25]], { samples: 24 });
  const x = 10.75;
  const edge = (above) => pts.filter((p) => (above ? p[1] < 12 : p[1] > 12) && p[0] < 14).reduce((m, p) => (Math.abs(p[0] - x) < Math.abs(m[0] - x) ? p : m));
  put('tropical-fish', ['pez tropical', 'arrecife', 'buceo', 'aguas cálidas', 'tropical fish', 'reef fish', 'angelfish'], [body, tail(J, 21.25, 2.5), curve(edge(true), [x + 0.6, 12], edge(false)), dot(6.25, 10.75)]);
  FILL['tropical-fish'] = { solid: [0, 1], cut: [2, 3] };
  PARTS['tropical-fish'] = { body: [0], tail: [1], band: [2], eye: [3] };
  MOTION['tropical-fish'] = { effect: 'slide', vector: [-1.5, 0] };
}
{
  // Clownfish: a round oval, a rounded tail and three bands across it, each bowed toward the tail
  const c = [10.25, 12];
  const [rx, ry] = [7.25, 5.25];
  const yAt = (x) => ry * Math.sqrt(Math.max(0, 1 - ((x - c[0]) / rx) ** 2));
  const bandAt = (x, bow) => curve([x, c[1] - yAt(x)], [x + bow, c[1]], [x, c[1] + yAt(x)]);
  const J = [c[0] + rx, c[1]];
  const tl = spline([[...J, 1], [19.5, 9.25], [21.25, 9.75], [21.25, 14.25], [19.5, 14.75]]);
  put('clownfish', ['pez payaso', 'anémona', 'arrecife', 'niños', 'clownfish', 'anemonefish', 'reef'], [ell(c, rx, ry), tl, bandAt(8.5, 0.9), bandAt(12, 0.9), bandAt(15.4, 0.6), dot(6.25, 11.5)]);
  FILL.clownfish = { solid: [0, 1], cut: [2, 3, 4, 5] };
  PARTS.clownfish = { body: [0], tail: [1], bands: [2, 3, 4], eye: [5] };
  MOTION.clownfish = { effect: 'slide', vector: [-1.5, 0] };
}
{
  // Pufferfish: a round body puffed up, short spikes on its back and belly (they grow from its
  // skin), the fish's tail, the eye and a tiny round mouth (a bump on its front)
  const c = [10.5, 12];
  const r = 6.5;
  const [p1, p2] = [polar(...c, r, 192), polar(...c, r, 168)];
  const lip = N(len(sub(p1, p2)) / 2);
  const bodyD = `M${pt(p1)}A${N(r)} ${N(r)} 0 1 1 ${pt(p2)}A${lip} ${lip} 0 0 1 ${pt(p1)}Z`;
  const spikes = [-135, -100, -65, 65, 100, 135].map((a) => line(polar(...c, r, a), polar(...c, r + 2.25, a)));
  put('pufferfish', ['pez globo', 'tóxico', 'defensa', 'inflado', 'pufferfish', 'blowfish', 'puffed up'], [bodyD, tail([c[0] + r, c[1]], 21.25, 3.25), ...spikes, dot(7.75, 10.5)]);
  FILL.pufferfish = { solid: [0, 1], wire: [2, 3, 4, 5, 6, 7], cut: [8] };
  PARTS.pufferfish = { body: [0], tail: [1], spikes: [2, 3, 4, 5, 6, 7], eye: [8] };
  MOTION.pufferfish = { effect: 'beat', origin: c };
}
{
  // Swordfish: a torpedo body with a long straight bill, a high crescent dorsal fin and the crescent
  // of its tail
  const J = [17.5, 12];
  const body = spline([[6.25, 12, 1], [7.75, 9.75], [10.25, 8.6, 1], [12, 3.75, 1], [12.4, 6.5], [13.75, 8.75, 1], [16, 10.25], [...J, 1], [16, 13.75], [12.5, 15.75], [8.75, 15]]);
  const fork = spline([[...J, 1], [19.25, 9.75], [21.25, 6.25, 1], [20.25, 9.5], [20.1, 12], [20.25, 14.5], [21.25, 17.75, 1], [19.25, 14.25]]);
  put('swordfish', ['pez espada', 'marlín', 'pesca deportiva', 'velocidad', 'swordfish', 'marlin', 'billfish'], [body, fork, line([2.5, 12], [6.25, 12]), dot(9.5, 11.9)]);
  FILL.swordfish = { solid: [0, 1], wire: [2], cut: [3] };
  PARTS.swordfish = { body: [0], tail: [1], bill: [2], eye: [3] };
  MOTION.swordfish = { effect: 'slide', vector: [-2, 0] };
}
{
  // Anglerfish: a big round head with a wide open mouth, a fang up from its jaw and one down from its
  // lip, the lure's stalk curving from its forehead to a dot, and a small tail
  const J = [17.75, 13];
  const { d: body, pts } = spline([
    [4.5, 8.75, 1], [6.75, 6.5], [10.75, 5.5], [14.75, 7], [17, 10.5], [...J, 1], [16, 16.75], [11.5, 19.5], [6.25, 19.25], [3, 17.75, 1],
    [3.6, 17.45, 1], [4, 14.75, 1], [5.25, 16.85, 1], [11.75, 13.25, 1], [7.4, 10.55, 1], [6.75, 12.4, 1], [6, 9.7, 1],
  ], { samples: 24 });
  const stalk = curve(nearest(pts, [8.5, 5.9]), [7, 3.25], [4.5, 3.5]);
  put('anglerfish', ['rape', 'pez abisal', 'mar profundo', 'señuelo', 'anglerfish', 'deep sea', 'lure'], [body, tail(J, 21.25, 3), stalk, dot(4.5, 3.5), dot(12.25, 9.25)]);
  FILL.anglerfish = { solid: [0, 1, 3], wire: [2], cut: [4] };
  PARTS.anglerfish = { body: [0], tail: [1], lure: [2, 3], eye: [4] };
  MOTION.anglerfish = { effect: 'beat', parts: ['lure'], origin: [4.5, 3.5] };
}
{
  // Salmon: leaping out of a short wave, nose up and to the left, the fish laid out straight and bent
  // a little round an arch, its back to the outside, its tail notched
  const B = (p) => {
    const q = bender([0.25, 26.25], 20, 281)(p);
    return p[2] ? [...q, 1] : q;
  };
  const bodyD = spline([[0, 0.25, 1], [1.75, -1.9], [4.5, -3.3], [8, -3.4], [11.25, -2.1], [14, 0, 1], [11.25, 1.9], [8, 3.1], [4.5, 3.25], [1.75, 2]].map(B));
  const tl = roundpoly([B([14, 0]), B([18.25, -3.1]), B([17.4, 0]), B([18.25, 3.1])], [0.3, 1, 0.5, 1]);
  put('salmon', ['salmón', 'remontar el río', 'pesca', 'origen del pescado', 'salmon', 'salmon run', 'leaping fish'], [bodyD, tl, ripple(20.75, 3, 6), dot(...B([5, -0.05]))]);
  FILL.salmon = { solid: [0, 1], cut: [3], lines: [2] };
  PARTS.salmon = { body: [0], tail: [1], water: [2], eye: [3] };
  MOTION.salmon = { effect: 'bounce', parts: ['body', 'tail', 'eye'], vector: [-1, -1.5] };
}
{
  // Seahorse: upright, facing left: the horse's head with its tube snout and a small crest, the chest
  // out in front, the back down to a tail that curls into a spiral
  const bodyD = spline([
    [3.25, 7.75, 1], [6.5, 7], [8.5, 5], [10.25, 3, 1], [11.25, 4], [13.75, 4.25], [14.75, 6.75], [16.25, 10.5], [16.25, 14.25], [13.5, 18.25, 1],
    [11.25, 15.75], [9.25, 13], [9.5, 10.5], [6.5, 9], [3.5, 9.25, 1],
  ]);
  const tl = curve([13.5, 18.25], [12, 21], [8.75, 20.75], [8.25, 18.25], [10.25, 17.75]);
  put('seahorse', ['caballito de mar', 'hipocampo', 'arrecife', 'acuario', 'seahorse', 'sea horse', 'reef'], [bodyD, tl, dot(11.75, 6.75)]);
  FILL.seahorse = { solid: [0], wire: [1], cut: [2] };
  PARTS.seahorse = { body: [0], tail: [1], eye: [2] };
  MOTION.seahorse = { effect: 'float', vector: [0, -1.5] };
}
{
  // Catfish: a broad flat head, two long barbels sweeping back from its mouth, one over the head and
  // one under the body, and a tapering body
  const J = [17.5, 12.75];
  const { d: body, pts } = spline([[3.25, 12], [4.5, 9.75], [8.5, 9], [13.5, 10.5], [...J, 1], [13.5, 15], [8.5, 15.5], [4.75, 14.75]], { samples: 24 });
  const whiskers = [curve(nearest(pts, [3.5, 10.5]), [2.75, 7.75], [5.25, 5.75], [9.75, 5.5]), curve(nearest(pts, [3.75, 13.75]), [3.25, 16.75], [5.75, 18.75], [10, 18.75])];
  put('catfish', ['bagre', 'pez gato', 'pesca de río', 'agua dulce', 'catfish', 'freshwater fish', 'bottom feeder'], [body, tail(J, 21.25, 3.25), ...whiskers, dot(7, 12.1)]);
  FILL.catfish = { solid: [0, 1], wire: [2, 3], cut: [4] };
  PARTS.catfish = { body: [0], tail: [1], whiskers: [2, 3], eye: [4] };
  MOTION.catfish = { effect: 'slide', vector: [-1.5, 0] };
}
{
  // Piranha: a deep round body, the lower jaw jutting out and a zigzag row of teeth
  const J = [18, 11.5];
  const body = spline([[5.25, 12, 1], [6, 8], [11, 4.75], [16, 7.5], [...J, 1], [16, 15.25], [11, 18.25], [6.25, 17], [3.5, 14.5, 1]]);
  const teeth = line([4.5, 13.3], [5.6, 12.35], [6.7, 13.6], [7.8, 12.35], [8.9, 13.6]);
  put('piranha', ['piraña', 'peligro', 'agresivo', 'río', 'piranha', 'danger', 'aggressive'], [body, tail(J, 21.25, 3.25), teeth, dot(9.5, 9.25)]);
  FILL.piranha = { solid: [0, 1], cut: [2, 3] };
  PARTS.piranha = { body: [0], tail: [1], teeth: [2], eye: [3] };
  MOTION.piranha = { effect: 'slide', vector: [-1.5, 0] };
}
{
  // Koi from above: lying across the canvas, its body curving in a gentle S from the head at the top
  // left, the fins spread at its sides (open strokes on the body) and a flowing tail (its whiskers, a
  // cross over its head at 24 px, are left out)
  const spine = [[6.75, 6.25], [9.9, 9.1], [12.3, 12.6], [14.75, 15.4]];
  const w = (t) => (t < 0.2 ? 2.6 + 0.4 * Math.sin((t / 0.2) * (Math.PI / 2)) : 3 - 1.7 * ((t - 0.2) / 0.8) ** 1.2);
  const { d: bodyD, pts } = band(spine, w, { tip: [false, false], samples: true, k: 12 });
  const at = spineOf(spine);
  const fin = (side) => {
    const [a, b] = [at(0.24), at(0.42)];
    const p = add(a.p, mul(a.nrm, side * w(0.24)));
    return spline([[...nearest(pts, p), 1], add(p, add(mul(a.nrm, side * 2.4), mul(a.dir, 0.5))), add(p, add(mul(a.nrm, side * 2.9), mul(a.dir, 2.6))), [...nearest(pts, add(b.p, mul(b.nrm, side * w(0.42)))), 1]], { closed: false });
  };
  const fins = [fin(1), fin(-1)];
  const e = at(1);
  const end = add(e.p, mul(e.dir, w(1) * 0.5));
  const tl = spline([[...end, 1], add(end, [-0.75, 2.75]), [16, 21.25, 1], add(end, [2.6, 2.6]), [21.25, 16.25, 1], add(end, [2.75, -0.75])]);
  put('koi', ['koi', 'carpa', 'estanque', 'jardín japonés', 'koi', 'carp', 'pond'], [bodyD, ...fins, tl]);
  FILL.koi = { solid: [0, ...fins.map((f) => `${f}Z`), 3] };
  PARTS.koi = { body: [0], fins: [1, 2], tail: [3] };
  MOTION.koi = { effect: 'wiggle', parts: ['tail'], origin: end };
}

// ── Sharks ────────────────────────────────────────────────────────────────────────────────────
// One body: a pointed snout, the tall dorsal fin, the pectoral fin hanging under it and the tail's
// long upper lobe, all one outline; three gill slits rising from its belly, 2.9 apart
const SHARK_P = [
  [2.75, 12.25], [5.5, 9], [9, 7.5, 1], [12.5, 2.75, 1], [12.4, 5.5], [13.75, 7.75, 1], [17, 9.5], [19, 8, 1], [21.25, 3.75, 1], [20.5, 7.5], [19.5, 12, 1], [21, 15.5, 1],
  [18, 13.5, 1], [15, 15.25], [12.75, 16, 1], [13.75, 20, 1], [9.5, 16.25, 1], [5.75, 15.25],
];
const SHARK = spline(SHARK_P);
const SHARK_PTS = spline(SHARK_P, { samples: 24 }).pts;
/** Where a vertical through x meets the shark's belly. */
const lowSide = (pts, k) => {
  const ys = pts.map((p) => p[1]);
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  return pts.filter((p) => p[1] > y0 + k * (y1 - y0));
};
const belly = (pts, x) => lowSide(pts, 0.55).reduce((b, p) => (Math.abs(p[0] - x) < Math.abs(b[0] - x) ? p : b));
const GILLS = [6.5, 9.5, 12.5].map((x) => {
  const b = belly(SHARK_PTS, x);
  return line(b, [b[0], b[1] - 3]);
});
put('shark', ['tiburón', 'depredador', 'peligro', 'acuario', 'shark', 'predator', 'danger'], [SHARK, ...GILLS]);
FILL.shark = { solid: [0], cut: [1, 2, 3] };
PARTS.shark = { body: [0], gills: [1, 2, 3] };
MOTION.shark = { effect: 'slide', vector: [-2, 0] };
{
  // Shark fin: the dorsal fin cutting the surface, its base on two nodes of the wave
  const y = 17.5;
  const fin = curve([9, y], [11.75, 10], [16, 4.25], [14.75, 9.75], [15, y]);
  put('shark-fin', ['aleta de tiburón', 'peligro en el agua', 'amenaza oculta', 'avistamiento', 'shark fin', 'hidden threat', 'shark sighting'], [fin, ripple(y, 3, 6)]);
  FILL['shark-fin'] = { solid: [`${fin}${rippleBack(y, 3, 9, 15)}Z`], wire: [1] };
  PARTS['shark-fin'] = { fin: [0], water: [1] };
  MOTION['shark-fin'] = { effect: 'slide', parts: ['fin'], vector: [-1.5, 0] };
}
{
  // With its badge: the shark at 0.6, up and left (its tail clear of the badge), two gills 2.9
  // apart on the smaller belly
  const s = 0.6;
  const o = [2.75, 2.75];
  const body = place(SHARK, s, o);
  const pts = SHARK_PTS.map((p) => placePt(p, s, o));
  const gills = [5.4, 8.3].map((x) => {
    const b = belly(pts, x);
    return line(b, [b[0], b[1] - 2]);
  });
  const d = [body, ...gills];
  put('shark-alert', ['aviso de tiburón', 'playa cerrada', 'avistamiento de tiburón', 'peligro', 'shark warning', 'beach closed', 'shark sighting'], d, { badge: badge('alert') });
  FILL['shark-alert'] = { solid: [0], cut: [1, 2] };
  PARTS['shark-alert'] = { body: [0], gills: [1, 2] };
  MOTION['shark-alert'] = BADGE_MOTION.alert;
}


// ── Rays ──────────────────────────────────────────────────────────────────────────────────────
{
  // Manta ray from above: wide triangular wings swept back from its two horn-like head fins, and a
  // thin tail
  const outline = spline([
    [9.25, 4.5, 1], [10.25, 6.75], [12, 7.25], [13.75, 6.75], [14.75, 4.5, 1], [15.75, 7.5], [19.25, 9.5], [21.25, 12.25, 1], [17.5, 13.25], [14.25, 15.5], [12, 16.75, 1], [9.75, 15.5], [6.5, 13.25], [2.75, 12.25, 1], [4.75, 9.5], [8.25, 7.5],
  ]);
  put('manta-ray', ['mantarraya', 'manta', 'buceo', 'gigante marino', 'manta ray', 'devil ray', 'dive site'], [outline, curve([12, 16.75], [12.25, 19.25], [11.5, 21.25])]);
  FILL['manta-ray'] = { solid: [0], wire: [1] };
  PARTS['manta-ray'] = { body: [0], tail: [1] };
  MOTION['manta-ray'] = { effect: 'float', vector: [0, -1.5] };
}

// ── Coral ─────────────────────────────────────────────────────────────────────────────────────
/**
 * The outline round a branching skeleton: each branch a straight run `h` to either side, forks
 * meeting in a crotch, every tip a round end and the trunk standing on a flat foot.
 */
function treeOutline(root, h, { open = false } = {}) {
  const meet = (p, u, q, v) => {
    const den = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(den) < 1e-6) return lerp(p, q, 0.5);
    const t = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
    return add(p, mul(u, t));
  };
  const side = (b) => {
    const u = unit(sub(b.to, b.from));
    return { u, n: [u[1], -u[0]] };
  };
  const walk = (b) => {
    const { u, n } = side(b);
    if (!b.kids) return [add(b.to, mul(n, h)), add(b.to, mul(u, h)), sub(b.to, mul(n, h))];
    const out = [];
    b.kids.forEach((k, i) => {
      const s = side(k);
      if (i === 0) out.push(meet(add(b.from, mul(n, h)), u, add(k.from, mul(s.n, h)), s.u));
      out.push(...walk(k));
      if (i < b.kids.length - 1) {
        const k2 = b.kids[i + 1];
        const s2 = side(k2);
        // The crotch between two fingers is a corner: a smooth curve through it overshoots into a loop
        out.push([...meet(sub(k.from, mul(s.n, h)), s.u, add(k2.from, mul(s2.n, h)), s2.u), 1]);
      } else out.push(meet(sub(b.from, mul(n, h)), u, sub(k.from, mul(s.n, h)), s.u));
    });
    return out;
  };
  const { n } = side(root);
  return spline([[...add(root.from, mul(n, h)), 1], ...walk(root), [...sub(root.from, mul(n, h)), 1]], { closed: !open });
}
const branch = (from, to, kids) => ({ from, to, ...(kids && { kids: kids.map((k) => branch(to, k.to, k.kids)) }) });
/** A branching coral: its trunk forking twice into rounded fingers of uneven reach. */
const coralTree = (T = (p) => p) =>
  branch(T([11.75, 21.25]), T([11.75, 16.75]), [
    { to: T([7.75, 12.75]), kids: [{ to: T([4.25, 9.25]) }, { to: T([8.25, 5.25]) }] },
    { to: T([15.75, 12.25]), kids: [{ to: T([14, 4.25]) }, { to: T([19.75, 7.75]) }] },
  ]);
{
  // The coral stands on the seabed: its outline runs from one side of the trunk's foot round to the
  // other (open, so it never doubles the seabed line)
  const tree = treeOutline(coralTree(), 1.6, { open: true });
  put('coral', ['coral', 'arrecife', 'biología marina', 'conservación', 'coral', 'reef', 'marine biology'], [tree, line([7.5, 21.25], [16, 21.25])]);
  FILL.coral = { solid: [`${tree}Z`], wire: [1] };
  PARTS.coral = { coral: [0], seabed: [1] };
}
{
  // With its badge: a smaller coral of three fingers up and left, its tips far enough apart that the
  // gaps between them stay open at every weight, and all of it well outside the badge's clearance
  const tree = treeOutline(branch([7.75, 21.25], [7.75, 16.5], [{ to: [5.5, 12.75], kids: [{ to: [3.5, 9.25] }] }, { to: [10, 11.5], kids: [{ to: [9.25, 4] }, { to: [13.75, 7.25] }] }]), 1.4, { open: true });
  put('coral-alert', ['blanqueamiento de coral', 'arrecife en riesgo', 'monitoreo', 'calentamiento', 'coral bleaching', 'reef alert', 'reef monitoring'], [tree, line([4, 21.25], [10.25, 21.25])], { badge: badge('alert') });
  FILL['coral-alert'] = { solid: [`${tree}Z`], wire: [1] };
  PARTS['coral-alert'] = { coral: [0], seabed: [1] };
  MOTION['coral-alert'] = BADGE_MOTION.alert;
}

// ── Whales and dolphins ───────────────────────────────────────────────────────────────────────
/**
 * The fluke every whale, dolphin and the orca share: two lobes swept back from the tail stock to a
 * notch, laid out along +x (the stock's end at x 0, `h` its half width) and turned `deg` about `P`
 * at scale `s`. Returns the outline's points from the stock's upper side round to its lower side,
 * to splice into a body's outline.
 */
function fluke(P, deg, s = 1, h = 0.6, map = (p) => p) {
  const Q = [[0, -h], [0.85, -1.55], [1.85, -2.85], [3.25, -4, 1], [2.55, -2.5], [2.45, -1.1], [2.75, 0, 1], [2.45, 1.1], [2.55, 2.5], [3.25, 4, 1], [1.85, 2.85], [0.85, 1.55], [0, h]];
  return Q.map(([x, y, c]) => {
    const q = map(add(P, rot([x * s, y * s], [0, 0], deg)));
    return c ? [...q, 1] : q;
  });
}
{
  // Whale: a humpback in profile, facing left: the broad head, the line of its mouth running back into
  // its throat, the long pectoral flipper (an open stroke on the body) and the fluke raised at the end
  // of its tail, its stock wide enough to stay open at every weight
  const outline = spline([
    [2.75, 12.5], [3.5, 9.5], [6.5, 7.1], [10.5, 6.75], [14, 7.5],
    ...fluke([16.5, 8.75], -40, 0.9, 1.4),
    [16.25, 11.75], [13.5, 15], [9, 16.75], [5.25, 16.5], [3.25, 15],
  ], { samples: 24 });
  const mouth = curve(nearest(outline.pts, [2.9, 13.5]), [6, 13.75], [9.25, 13.5]);
  const flipper = spline([[...nearest(outline.pts, [7.75, 16.75]), 1], [9.5, 19.75], [12.75, 20.75], [12.75, 18.5], [...nearest(outline.pts, [11.75, 15.9]), 1]], { closed: false });
  put('whale', ['ballena', 'ballena jorobada', 'avistamiento de ballenas', 'enorme', 'whale', 'humpback', 'whale watching'], [outline.d, flipper, mouth, dot(6.75, 10.25)]);
  FILL.whale = { solid: [0, `${flipper}Z`], cut: [2, 3] };
  PARTS.whale = { body: [0], flipper: [1], mouth: [2], eye: [3] };
  MOTION.whale = { effect: 'float', vector: [0, -1.5] };
}
{
  // Whale tail: the fluke raised out of the water, its stock rising from two nodes of the wave
  const y = 19.5;
  const tailD = spline([[9, y, 1], [10, 16.25], [10.75, 13], ...fluke([12, 11.25], -90, 2.1, 0.62), [13.25, 13], [14, 16.25], [15, y, 1]], { closed: false });
  put('whale-tail', ['cola de ballena', 'ballena', 'inmersión', 'avistamiento de ballenas', 'whale tail', 'fluke', 'whale watching'], [tailD, ripple(y, 3, 6)]);
  FILL['whale-tail'] = { solid: [`${tailD}${rippleBack(y, 3, 9, 15)}Z`], wire: [1] };
  PARTS['whale-tail'] = { tail: [0], water: [1] };
  MOTION['whale-tail'] = { effect: 'wiggle', parts: ['tail'], origin: [12, y] };
}
{
  // Whale spout: the whale's head and back above the water, its steep round brow at the front with
  // the eye, and the blow rising from its blowhole in two jets that curl over (a symmetric arch with
  // no eye read as a hill on the water)
  const y = 19;
  const back = spline([[3, y, 1], [3.5, 15.25], [6, 12.5], [10, 11.75], [14.5, 13.25], [18, y, 1]], { closed: false });
  const b = [8.5, 9.25];
  const jets = [curve(b, [7.25, 6.25], [5, 4.5], [3, 5.25]), curve(b, [9.75, 6.25], [12, 4.5], [14, 5.25])];
  put('whale-spout', ['ballena', 'soplo', 'respiración', 'avistamiento', 'whale spout', 'blow', 'whale sighting'], [back, ripple(y, 3, 6), ...jets, dot(7, 15.25)]);
  FILL['whale-spout'] = { solid: [`${back}${rippleBack(y, 3, 3, 18)}Z`], wire: [1], lines: [2, 3], cut: [4] };
  PARTS['whale-spout'] = { back: [0], water: [1], spray: [2, 3], eye: [4] };
  MOTION['whale-spout'] = { effect: 'beat', parts: ['spray'], origin: b };
}
{
  // Orca: a stout body, its tall straight dorsal fin, the fluke and the white patch behind its eye (a
  // ring wide enough to stay open, cut out when filled)
  const outline = spline([
    [2.75, 13], [3.75, 10.25], [6.5, 8.5], [8.75, 7.9, 1], [10.75, 2.75, 1], [11.15, 5.5], [12.25, 8, 1], [14.5, 8.75],
    ...fluke([16.5, 10], -30, 0.9, 1.4),
    [16, 13.25], [13.25, 15.75], [9, 17], [5, 16.25], [3.25, 14.75],
  ]);
  put('orca', ['orca', 'ballena asesina', 'depredador', 'blanco y negro', 'orca', 'killer whale', 'apex predator'], [outline, ell([8, 12.6], 2.3, 1.45, -10)]);
  FILL.orca = { solid: [0], cut: [1] };
  PARTS.orca = { body: [0], patch: [1] };
  MOTION.orca = { effect: 'float', vector: [0, -1.5] };
}
{
  // Narwhal: the whale itself at 0.78, its mouth and flipper, down and right, and the long straight
  // tusk out of its head, forward and up: a whale with a tusk (a round body with a level fluke read
  // as a fish on a skewer, and with its fluke and flipper but no mouth, as a bird). Its fluke keeps
  // the whale's size: scaled down, the paper inside it opened at light and shut at regular. No eye:
  // at this size it would crowd the mouth
  const T = (p) => placePt(p, 0.78, [2.75, 12.5], [6.5, 13.5]);
  const outline = spline([...[[2.75, 12.5], [3.5, 9.5], [6.5, 7.1], [10.5, 6.75], [14, 7.5]].map(T), ...fluke(T([16.5, 8.75]), -40, 0.9, 1.4), ...[[16.25, 11.75], [13.5, 15], [9, 16.75], [5.25, 16.5], [3.25, 15]].map(T)], { samples: 24 });
  const flipper = spline([[...nearest(outline.pts, T([7.75, 16.75])), 1], T([9.5, 19.75]), T([12.75, 20.75]), T([12.75, 18.5]), [...nearest(outline.pts, T([11.75, 15.9])), 1]], { closed: false });
  const mouth = curve(nearest(outline.pts, T([2.9, 13.5])), T([6, 13.75]), T([9.25, 13.5]));
  const front = nearest(outline.pts, T([3.1, 10.75]));
  const tusk = line(front, add(front, mul(unit([-1, -0.42]), 4.6)));
  put('narwhal', ['narval', 'colmillo', 'ártico', 'mágico', 'narwhal', 'tusk', 'arctic'], [outline.d, flipper, mouth, tusk]);
  FILL.narwhal = { solid: [0, `${flipper}Z`], cut: [2], wire: [3] };
  PARTS.narwhal = { body: [0], flipper: [1], mouth: [2], tusk: [3] };
  MOTION.narwhal = { effect: 'float', vector: [0, -1.5] };
}
{
  // Dolphin: mid-leap, laid out straight and bent round an arch: the short beak, the curved dorsal fin
  // and the fluke, one silhouette (its head is too slim for an eye that stays apart at every weight)
  const B = bender([12, 20.25], 9.75, 200);
  const P = [
    [0, 0.2, 1], [1.6, -0.35], [2.6, -1.1], [4.25, -2.2], [6.75, -2.7], [8.25, -2.75, 1], [10.75, -6.25, 1], [10.1, -4.25], [10.6, -2.6, 1], [13.5, -1.4],
    ...fluke([15.75, 0], 0, 1, 0.55),
    [13.5, 1.4], [9, 2.6], [5, 2.4], [2.2, 1.3], [0.9, 0.75],
  ];
  put('dolphin', ['delfín', 'salto', 'inteligencia', 'tour marino', 'dolphin', 'porpoise', 'playful'], [spline(P.map(B))]);
  FILL.dolphin = { solid: [0] };
  PARTS.dolphin = { body: [0] };
  MOTION.dolphin = { effect: 'bounce', vector: [0, -2] };
}

// ── Seals and their kin ───────────────────────────────────────────────────────────────────────
{
  // Manatee: a plump body, its blunt snout with the cleft of its whisker pad, a small flipper under
  // its chest and the broad round paddle of its tail, taller than long on a narrow stock (never a
  // fish's fan; seen edge on it read as a bird's beak)
  const outline = spline([[3, 13.25], [3.75, 10.75], [6.25, 9.25], [10.25, 8.75], [13.5, 9.75], [16, 11.25, 1], [17.25, 8.75], [19.75, 7.75], [21.25, 9.5], [21.25, 14.5], [19.75, 16.25], [17.25, 15.25], [16, 12.75, 1], [13.5, 15.25], [9.5, 16.75], [5.75, 16.5], [3.5, 15]], { samples: 24 });
  const flipper = spline([[...nearest(outline.pts, [5.75, 16.5]), 1], [6, 19], [8.25, 20.25, 1], [8.75, 18.25], [...nearest(outline.pts, [9, 16.75]), 1]], { closed: false });
  const muzzle = curve(nearest(outline.pts, [3.1, 14.25]), [4.6, 13.9], nearest(outline.pts, [4.6, 16.25]));
  put('manatee', ['manatí', 'vaca marina', 'dugongo', 'conservación', 'manatee', 'sea cow', 'dugong'], [outline.d, flipper, muzzle, dot(7.75, 12)]);
  FILL.manatee = { solid: [0, `${flipper}Z`], cut: [2, 3] };
  PARTS.manatee = { body: [0], flipper: [1], muzzle: [2], eye: [3] };
  MOTION.manatee = { effect: 'float', vector: [0, -1] };
}
{
  // Walrus: a heavy body propped on its front flippers, its head raised and two long tusks hanging
  // from the muzzle
  const outline = spline([
    [3, 9.5], [4.5, 5.75], [8, 4.5], [11.5, 7.25], [15.5, 11.5], [19.75, 16], [21.25, 19.75, 1], [16.5, 20], [12.75, 20, 1], [8.5, 20.75, 1], [10.5, 17.25], [10.5, 13.75], [8.75, 11.5], [4.5, 11.75],
  ], { samples: 24 });
  // The tusks hang straight down, 3 apart, so they land on pixel columns at 16 px
  const tusks = [[4.75, 17.5], [7.75, 17]].map(([x, y]) => line([x, nearest(outline.pts, [x, 11.7])[1]], [x, y]));
  put('walrus', ['morsa', 'colmillos', 'ártico', 'vida polar', 'walrus', 'tusks', 'arctic'], [outline.d, ...tusks, dot(7.25, 7.75)]);
  FILL.walrus = { solid: [0], wire: [1, 2], cut: [3] };
  PARTS.walrus = { body: [0], tusks: [1, 2], eye: [3] };
}
{
  // Sea lion: upright on its front flippers, its head held high on a long neck, a small ear flap
  // behind the eye and the front flipper planted ahead of its chest
  const outline = spline([
    [2.75, 7, 1], [4.25, 4.25], [7.5, 2.75], [10.25, 4.5], [11.25, 8.5], [13.5, 13], [18.25, 16.75], [21.25, 20.25, 1], [15.5, 20.25], [10.5, 20.25, 1], [6, 20.75, 1], [8.25, 18], [8, 13], [6.5, 9.5], [4, 8.25],
  ], { samples: 24 });
  const ear = line(nearest(outline.pts, [10.1, 5]), [12.6, 3.9]);
  put('sea-lion', ['lobo marino', 'león marino', 'fauna costera', 'juguetón', 'sea lion', 'coastal wildlife', 'playful'], [outline.d, ear, dot(6.75, 6.25)]);
  FILL['sea-lion'] = { solid: [0], wire: [1], cut: [2] };
  PARTS['sea-lion'] = { body: [0], ear: [1], eye: [2] };
  MOTION['sea-lion'] = { effect: 'wiggle', origin: [12, 20.25] };
}
{
  // Harbor seal: lying on its belly, long and low, its round head lifted (no ear flap), a front
  // flipper at its side and the rear flippers raised together
  const outline = spline([
    [3.4, 12.5], [4, 9.75], [6.75, 8], [9.5, 9.25], [12.5, 12.75], [17, 14], [19.25, 13.25], [21.25, 11.5, 1], [20.5, 14.5, 1], [21.25, 17.25, 1], [17.5, 19], [10.5, 19.5], [6.25, 18], [4.75, 15], [3.6, 13.75],
  ], { samples: 24 });
  const flipper = spline([[...nearest(outline.pts, [7.5, 18.5]), 1], [8.75, 20.75], [11.25, 21.25, 1], [10.5, 19.6]], { closed: false });
  put('harbor-seal', ['foca', 'colonia de focas', 'fauna costera', 'playa', 'harbor seal', 'seal', 'coastal wildlife'], [outline.d, flipper, dot(6.75, 11.25)]);
  FILL['harbor-seal'] = { solid: [0, `${flipper}Z`], cut: [2] };
  PARTS['harbor-seal'] = { body: [0], flipper: [1], eye: [2] };
}

// ── Octopus, squid and jellyfish ──────────────────────────────────────────────────────────────
/** A wavy line hanging from (x, y0) to y1: `amp` its sway, `n` its half waves. */
function hang(x, y0, y1, amp = 0.75, n = 3, phase = 1) {
  const P = [];
  for (let i = 0; i <= n * 2; i++) P.push([x + (i % 2 ? phase * amp * (i % 4 === 1 ? 1 : -1) : 0), y0 + ((y1 - y0) * i) / (n * 2)]);
  return curve(...P);
}
{
  // Octopus: a round head with its two eyes over six short curling arms
  const { d: headD, pts } = spline([[5.25, 11.75], [6, 5.75], [12, 2.75], [18, 5.75], [18.75, 11.75], [16.5, 14, 1], [7.5, 14, 1]], { samples: 24 });
  const arms = [
    curve(nearest(pts, [5.3, 11]), [3.25, 13.5], [2.75, 16], [3.75, 17]),
    curve([7.5, 14], [6.75, 17.25], [5.75, 19.75], [4.5, 20.75]),
    curve([10.5, 14], [9.75, 17.75], [9.5, 21.25]),
    curve([13.5, 14], [14.25, 17.75], [14.5, 21.25]),
    curve([16.5, 14], [17.25, 17.25], [18.25, 19.75], [19.5, 20.75]),
    curve(nearest(pts, [18.7, 11]), [20.75, 13.5], [21.25, 16], [20.25, 17]),
  ];
  put('octopus', ['pulpo', 'inteligencia', 'muchos brazos', 'multitarea', 'octopus', 'tentacles', 'multitasking'], [headD, ...arms, dot(9.5, 9), dot(14.5, 9)]);
  FILL.octopus = { solid: [0], wire: [1, 2, 3, 4, 5, 6], cut: [7, 8] };
  PARTS.octopus = { head: [0], arms: [1, 2, 3, 4, 5, 6], eyes: [7, 8] };
  MOTION.octopus = { effect: 'float', vector: [0, -1.5] };
}
{
  // Squid: the mantle like an arrow, its two fins at the top, short arms under it and two long
  // tentacles hanging below
  const mantle = spline([[12, 2.75, 1], [13.25, 4.5], [17.25, 8.25, 1], [14.75, 8.75], [15, 14.25, 1], [9, 14.25, 1], [9.25, 8.75], [6.75, 8.25, 1], [10.75, 4.5]]);
  const arms = [curve([10.25, 14.25], [8, 15.75], [6.5, 18.5]), curve([13.75, 14.25], [16, 15.75], [17.5, 18.5])];
  const tentacles = [hang(10.25, 14.25, 21.25, 0.6, 2, 1), hang(13.75, 14.25, 21.25, 0.6, 2, 1)];
  put('squid', ['calamar', 'mar profundo', 'cefalópodo', 'mariscos', 'squid', 'calamari', 'deep sea'], [mantle, ...arms, ...tentacles]);
  FILL.squid = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS.squid = { mantle: [0], arms: [1, 2, 3, 4] };
  MOTION.squid = { effect: 'float', vector: [0, -1.5] };
}
{
  // Nautilus: the coiled shell on the circle's keyline, its opening a notch at the front, the coil
  // spiralling in and three bands across the outer whorl from the coil to the edge (two tentacles
  // out of the notch read as a fish's tail on a round body)
  const c = [12, 12];
  const R = 8.75;
  const spiral = (a) => 4.8 * Math.exp(-((a - 180) * Math.PI) / 180 / 4.2);
  const shell = `M${pt(polar(...c, R, 205))}A${N(R)} ${N(R)} 0 1 1 ${pt(polar(...c, R, 160))}L${pt(polar(...c, spiral(180), 180))}Z`;
  const coil = spline(Array.from({ length: 9 }, (_, i) => polar(...c, spiral(180 + i * 45), 180 + i * 45)), { closed: false });
  const bands = [260, 310, 360].map((a) => line(polar(...c, spiral(a), a), polar(...c, R, a)));
  put('nautilus', ['nautilo', 'fósil viviente', 'espiral', 'mar profundo', 'nautilus', 'living fossil', 'golden spiral'], [shell, coil, ...bands]);
  FILL.nautilus = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS.nautilus = { shell: [0], coil: [1], bands: [2, 3, 4] };
}
// Jellyfish: a dome bell over four wavy tentacles, 3 apart and in phase
const BELL_P = [[4.5, 11.75, 1], [5.25, 6.25], [12, 3], [18.75, 6.25], [19.5, 11.75, 1], [12, 11]];
const BELL = spline(BELL_P);
const BELL_PTS = spline(BELL_P, { samples: 24 }).pts;
/** Tentacles hanging from the bell's lower edge at each x. */
const tentacles = (pts, xs, y1, amp) => xs.map((x) => {
  const b = lowSide(pts, 0.85).reduce((m, p) => (Math.abs(p[0] - x) < Math.abs(m[0] - x) ? p : m));
  return hang(b[0], b[1], y1, amp, 3);
});
const TENTACLES = tentacles(BELL_PTS, [6.75, 10.25, 13.75, 17.25], 20.75, 0.55);
put('jellyfish', ['medusa', 'aguamala', 'picadura', 'flotar', 'jellyfish', 'sting', 'floating'], [BELL, ...TENTACLES]);
FILL.jellyfish = { solid: [0], wire: [1, 2, 3, 4] };
PARTS.jellyfish = { bell: [0], tentacles: [1, 2, 3, 4] };
MOTION.jellyfish = { effect: 'float', vector: [0, -2] };
{
  // With its badge: the bell at 0.75, up and left, over three tentacles 3.5 apart (four would crowd)
  const s = 0.75;
  const bell = place(BELL, s, [2.75, 2.75]);
  const pts = BELL_PTS.map((p) => placePt(p, s, [2.75, 2.75]));
  const d = [bell, ...tentacles(pts, [5.5, 9, 12.5], 16.75, 0.5)];
  put('jellyfish-alert', ['aviso de medusas', 'riesgo de picadura', 'playa', 'bandera morada', 'jellyfish warning', 'sting risk', 'beach warning'], d, { badge: badge('alert') });
  FILL['jellyfish-alert'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['jellyfish-alert'] = { bell: [0], tentacles: [1, 2, 3] };
  MOTION['jellyfish-alert'] = BADGE_MOTION.alert;
}

// ── Reef ──────────────────────────────────────────────────────────────────────────────────────
{
  // Coral reef: on one seabed line, a branching coral and the lumpy dome of a brain coral (each open
  // at its foot, so neither doubles the seabed). The coral's three fingers fan out from the fork like
  // coral-alert's: fingers rising side by side read as a saguaro
  const y = 20.75;
  const tree = treeOutline(branch([7.25, y], [7.25, 16.25], [{ to: [5, 12.5], kids: [{ to: [3.25, 8.5] }] }, { to: [9.5, 11.25], kids: [{ to: [8.75, 4] }, { to: [13.25, 7] }] }]), 1.4, { open: true });
  const C = [17.5, y];
  const dome = spline([[13.5, y, 1], ...[200, 225, 250, 270, 290, 315, 340].map((a, i) => (i % 2 ? [...polar(...C, 3.6, a), 1] : polar(...C, 4.05, a))), [21.5, y, 1]], { closed: false });
  put('coral-reef', ['arrecife de coral', 'ecosistema marino', 'buceo', 'hábitat', 'coral reef', 'reef', 'marine ecosystem'], [line([2.5, y], [21.5, y]), tree, dome]);
  FILL['coral-reef'] = { solid: [`${tree}Z`, `${dome}Z`], wire: [0] };
  PARTS['coral-reef'] = { seabed: [0], coral: [1], dome: [2] };
}
{
  // Sea anemone: a short column under a crown of wavy tentacles reaching up and out
  const col = spline([[9.5, 21.25, 1], [9.75, 18.5], [8.25, 15.75], [5.5, 14.25, 1], [18.5, 14.25, 1], [15.75, 15.75], [14.25, 18.5], [14.5, 21.25, 1]]);
  const tips = [[2.75, 9], [6.25, 4.5], [12, 2.75], [17.75, 4.5], [21.25, 9]];
  const bases = [[5.5, 14.25], [8.75, 14.25], [12, 14.25], [15.25, 14.25], [18.5, 14.25]];
  const tentacles = tips.map((t, i) => {
    const b = bases[i];
    const m = lerp(b, t, 0.5);
    const n = unit([-(t[1] - b[1]), t[0] - b[0]]);
    return curve(b, add(lerp(b, t, 0.3), mul(n, 0.6)), add(m, mul(n, 0)), add(lerp(b, t, 0.7), mul(n, -0.6)), t);
  });
  put('sea-anemone', ['anémona de mar', 'arrecife', 'tentáculos', 'pez payaso', 'sea anemone', 'anemone', 'reef'], [col, ...tentacles]);
  FILL['sea-anemone'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['sea-anemone'] = { column: [0], tentacles: [1, 2, 3, 4, 5] };
  MOTION['sea-anemone'] = { effect: 'wiggle', parts: ['tentacles'], origin: [12, 14.25] };
}

// ── Crabs and lobsters ────────────────────────────────────────────────────────────────────────
/** A pincer: a round claw with a notch opening at `deg` (its fingers), `r` its size. */
const pincer = (c, r, deg, gap = 26) => `M${pt(polar(...c, r, deg + gap))}A${N(r)} ${N(r)} 0 1 1 ${pt(polar(...c, r, deg - gap))}L${pt(add(c, mul(polar(0, 0, 1, deg), 0.4)))}Z`;
{
  // Crab from above: a wide shell, two claws raised in front on their arms and two legs at each side
  const shell = spline([[12, 9.75], [16.75, 10.5], [18.75, 13.5], [16.5, 17.5], [12, 18.5], [7.5, 17.5], [5.25, 13.5], [7.25, 10.5]], { samples: 24 });
  const claws = [pincer([5.5, 5.75], 2.5, -80), pincer([18.5, 5.75], 2.5, -100)];
  const arms = [line(nearest(shell.pts, [7.75, 10.25]), polar(5.5, 5.75, 2.5, 70)), line(nearest(shell.pts, [16.25, 10.25]), polar(18.5, 5.75, 2.5, 110))];
  const legs = [
    line(nearest(shell.pts, [5.5, 12.75]), [3, 13], [2.75, 15.25]),
    line(nearest(shell.pts, [6.5, 16.5]), [4.5, 18], [4.75, 20.5]),
    line(nearest(shell.pts, [18.5, 12.75]), [21, 13], [21.25, 15.25]),
    line(nearest(shell.pts, [17.5, 16.5]), [19.5, 18], [19.25, 20.5]),
  ];
  put('crab', ['cangrejo', 'jaiba', 'mariscos', 'playa', 'crab', 'seafood', 'sideways'], [shell.d, ...claws, ...arms, ...legs]);
  FILL.crab = { solid: [0, 1, 2], wire: [3, 4, 5, 6, 7, 8] };
  PARTS.crab = { shell: [0], claws: [1, 2, 3, 4], legs: [5, 6, 7, 8] };
  MOTION.crab = { effect: 'slide', vector: [1.5, 0] };
}
{
  // Lobster from above: the long body, its tail in segments ending in a fan, the two big claws on
  // their arms and two long antennae
  const body = spline([[12, 6.25], [14.25, 7.25], [14.25, 12.5], [13.75, 17.25, 1], [16.25, 20.75, 1], [12, 19.75, 1], [7.75, 20.75, 1], [10.25, 17.25, 1], [9.75, 12.5], [9.75, 7.25]], { samples: 24 });
  const segs = [line(nearest(body.pts, [9.75, 13.75]), nearest(body.pts, [14.25, 13.75]))];
  const claws = [pincer([5.25, 6.25], 2.4, -75, 22), pincer([18.75, 6.25], 2.4, -105, 22)];
  const arms = [line(nearest(body.pts, [9.75, 9.5]), [7.5, 9.25], polar(5.25, 6.25, 2.4, 60)), line(nearest(body.pts, [14.25, 9.5]), [16.5, 9.25], polar(18.75, 6.25, 2.4, 120))];
  const antennae = [curve([12, 6.25], [10.5, 4.75], [9.75, 2.25]), curve([12, 6.25], [13.5, 4.75], [14.25, 2.25])];
  put('lobster', ['langosta', 'bogavante', 'mariscos', 'alta cocina', 'lobster', 'seafood', 'fine dining'], [body.d, ...segs, ...claws, ...arms, ...antennae]);
  FILL.lobster = { solid: [0, 2, 3], cut: [1], wire: [4, 5, 6, 7] };
  PARTS.lobster = { body: [0, 1], claws: [2, 3, 4, 5], antennae: [6, 7] };
}

// ── Starfish, urchins and sand dollars ────────────────────────────────────────────────────────
{
  // Starfish: five plump arms with round tips, each bending a little the same way as it reaches out,
  // as a living one lies on the sand. Straight arms are edicion's star; a ring of dots read as a
  // flower and a dot at the middle as a flower's heart
  const c = [12, 12.25];
  const [R, half, curl] = [8.7, 1.55, 14];
  const star = spline(Array.from({ length: 5 }, (_, i) => {
    const a = -90 + i * 72;
    const at = (r, k) => {
      const ang = a + curl * (r / R) ** 2;
      return add(polar(...c, r, ang), mul(polar(0, 0, 1, ang + 90), k));
    };
    return [at(R * 0.55, -half * 1.1), at(R * 0.86, -half * 0.8), polar(...c, R + half * 0.3, a + curl * 1.02), at(R * 0.86, half * 0.8), at(R * 0.55, half * 1.1), polar(...c, 4, a + 36 + curl * 0.2)];
  }).flat());
  put('starfish', ['estrella de mar', 'playa', 'poza de marea', 'vida marina', 'starfish', 'sea star', 'tide pool'], [star]);
  FILL.starfish = { solid: [0] };
  PARTS.starfish = { star: [0] };
  MOTION.starfish = { effect: 'spin', origin: c };
}
{
  // Sand dollar: a flat disc with the five petals of its flower at the middle
  const c = [12, 12];
  const petal = (a) => {
    const [p, q] = [polar(...c, 2.6, a), polar(...c, 6.15, a)];
    const r = (len(sub(q, p)) ** 2 / 4 + 1.4 ** 2) / (2 * 1.4);
    return `M${pt(p)}A${N(r)} ${N(r)} 0 0 1 ${pt(q)}A${N(r)} ${N(r)} 0 0 1 ${pt(p)}Z`;
  };
  const petals = Array.from({ length: 5 }, (_, i) => petal(-90 + i * 72));
  put('sand-dollar', ['galleta de mar', 'dólar de arena', 'playa', 'hallazgo', 'sand dollar', 'beachcombing', 'beach find'], [circ(...c, 9), ...petals]);
  FILL['sand-dollar'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['sand-dollar'] = { disc: [0], petals: [1, 2, 3, 4, 5] };
}

// ── Shells ────────────────────────────────────────────────────────────────────────────────────
// A spiral shell, the conch: its spire pointing up and right, the flared lip of its opening at the
// lower left, the seams of its whorls across the spire and the edge of its opening inside
const CONCH_P = [[17.75, 2.75, 1], [19.25, 6.5], [19.75, 11.5], [17.5, 17], [13, 21.25, 1], [10.5, 19.5], [5.5, 19], [3, 15.75], [3.75, 11.75], [7, 8.75], [11.5, 6.5], [15, 4.5]];
const CONCH = [
  spline(CONCH_P),
  curve([14.75, 4.85], [16.25, 6.75], [19.6, 8.25]),
  curve([10.25, 7.25], [14.5, 10], [19.75, 12]),
];
CONCH.push(curve(nearest(spline(CONCH_P, { samples: 24 }).pts, [12, 19.9]), [9, 16], [9.5, 11.5]));
put('seashell', ['caracol de mar', 'concha', 'playa', 'recuerdo', 'seashell', 'conch', 'beachcombing'], CONCH);
FILL.seashell = { solid: [0], cut: [1, 2, 3] };
PARTS.seashell = { shell: [0], seams: [1, 2], lip: [3] };
{
  // Hermit crab: the seashell's conch at 0.74 on its back, up and right, and out of its opening the
  // claw on its arm and two legs down to the ground (a coiled shell with eye stalks, claw and legs
  // all leaving one notch read as a snail in a tangle)
  const s = 0.74;
  const o = [21.25, 2.75];
  const { d: shellD, pts } = spline(CONCH_P.map((p) => (p[2] ? [...placePt(p, s, o), 1] : placePt(p, s, o))), { samples: 24 });
  const seams = CONCH.slice(1, 3).map((d) => place(d, s, o));
  const claw = pincer([4.5, 14.25], 2.1, 185, 26);
  const arm = line(nearest(pts, [8.75, 13.75]), polar(4.5, 14.25, 2.1, 5));
  const legs = [line(nearest(pts, [10.5, 15.5]), [9, 18.25], [9.5, 21.25]), line(nearest(pts, [13.5, 16.5]), [12.75, 18.75], [13.25, 21.25])];
  put('hermit-crab', ['cangrejo ermitaño', 'casa prestada', 'mudanza', 'playa', 'hermit crab', 'moving house', 'borrowed home'], [shellD, ...seams, arm, claw, ...legs]);
  FILL['hermit-crab'] = { solid: [0, 4], cut: [1, 2], wire: [3, 5, 6] };
  PARTS['hermit-crab'] = { shell: [0, 1, 2], claw: [3, 4], legs: [5, 6] };
  MOTION['hermit-crab'] = { effect: 'slide', vector: [-1.5, 0] };
}
/**
 * The hinge every bivalve shares: its beak at H, the shell opening `deg` from straight down. Returns
 * the outline's points either side of the beak (the shell's edge runs from one to the other).
 */
const valve = (H, deg = 0, s = 1) => [add(H, rot([-1.75 * s, 1.25 * s], [0, 0], deg)), [...H, 1], add(H, rot([1.75 * s, 1.25 * s], [0, 0], deg))];
{
  // Scallop: the fan shell rising from its hinge, its ribs from the hinge out to the rim, and the two
  // ears, a bar across the hinge. Filled, the ribs are cut from short of the hinge (where they would
  // meet) to short of the rim
  const H = [12, 18.25];
  const fanS = spline([[...H, 1], [15.5, 15.75], [19.25, 12.5], [20.75, 9], [18.75, 5.75], [15.5, 4.5], [12, 4], [8.5, 4.5], [5.25, 5.75], [3.25, 9], [4.75, 12.5], [8.5, 15.75]], { samples: 24 });
  const ears = sq(8.25, 18.25, 7.5, 2.75, 1);
  const tips = [-63, -82, -98, -117].map((a) => nearest(fanS.pts, polar(...H, 14.5, a)));
  put('scallop', ['vieira', 'concha', 'mariscos', 'playa', 'scallop', 'shell', 'seafood'], [fanS.d, ears, ...tips.map((t) => line(H, t))]);
  FILL.scallop = { solid: [0, 1], cut: tips.map((t) => line(lerp(H, t, 0.55), sub(t, mul(unit(sub(t, H)), 1.75)))) };
  PARTS.scallop = { shell: [0], ears: [1], ribs: [2, 3, 4, 5] };
}
{
  // Clam: closed, a rounded triangle under its beak, two growth lines following its lower edge
  const [l, h, r] = valve([12, 5]);
  const shell = spline([l, h, r, [17.5, 7.75], [20.75, 12], [20.5, 16.25], [16.75, 19.25], [12, 19.75], [7.25, 19.25], [3.5, 16.25], [3.25, 12], [6.5, 7.75]], { samples: 24 });
  const growth = [curve(nearest(shell.pts, [3.6, 13.5]), [12, 16.75], nearest(shell.pts, [20.4, 13.5])), curve(nearest(shell.pts, [5.5, 9]), [12, 13.75], nearest(shell.pts, [18.5, 9]))];
  put('clam', ['almeja', 'concha', 'mariscos', 'cerrado', 'clam', 'shellfish', 'closed'], [shell.d, ...growth]);
  FILL.clam = { solid: [0], cut: [1, 2] };
  PARTS.clam = { shell: [0], lines: [1, 2] };
}
{
  // Mussel: one valve from the side, a long teardrop lying across the canvas, narrow at its hinge at
  // the top left, its back humped and its belly straight, and two growth lines bowed toward its broad
  // end, as the clam's follow its rim (the seam down its middle read as plantas' leaf or a bean)
  const [l, h, r] = valve([4.25, 4.25], -45, 0.85);
  const { d: shell, pts } = spline([l, h, r, [9.25, 5.5], [14.25, 8.5], [18.75, 12.75], [21, 17.5], [19.75, 20.75], [15.75, 20.75], [11.25, 17.75], [7.25, 12.5]], { samples: 24 });
  const growth = (a, m, b) => curve(nearest(pts, a), m, nearest(pts, b));
  put('mussel', ['mejillón', 'concha', 'mariscos', 'cultivo', 'mussel', 'moules', 'shellfish'], [shell, growth([9.75, 15.25], [14.25, 15.5], [15.75, 9.75]), growth([13.25, 18.75], [18, 18.25], [19.5, 13.75])]);
  FILL.mussel = { solid: [0], cut: [1, 2] };
  PARTS.mussel = { shell: [0], lines: [1, 2] };
}

// ── Sea turtles ───────────────────────────────────────────────────────────────────────────────
/** A sea turtle from above, head up: the oval shell with its central plate, the head and four flippers. */
function seaTurtle(T = (p) => p) {
  const c = [12, 12.75];
  const shellD = ell(T(c), 5.25 * T.k, 6.25 * T.k);
  const plate = roundpoly(Array.from({ length: 6 }, (_, i) => T(polar(...c, 2.6, -90 + i * 60))), 0.5 * T.k);
  const head = ell(T([12, 4.75]), 1.9 * T.k, 2.1 * T.k);
  // Each flipper an open stroke from the shell and back to it (closed, it would leave a sliver of
  // paper along the shell that shuts at heavy weights)
  const flip = (a, b, tip, out) => spline([[...T(a), 1], T(out), [...T(tip), 1], [...T(b), 1]], { closed: false });
  const flippers = [
    flip([8.25, 8.4], [7, 10.5], [2.75, 9.75], [4, 6.5]),
    flip([15.75, 8.4], [17, 10.5], [21.25, 9.75], [20, 6.5]),
    flip([7.75, 16.75], [9.25, 18.25], [5.25, 21], [5.5, 18.5]),
    flip([16.25, 16.75], [14.75, 18.25], [18.75, 21], [18.5, 18.5]),
  ];
  return { d: [shellD, plate, head, ...flippers], fill: { solid: [0, 2, ...flippers.map((f) => `${f}Z`)], cut: [1] } };
}
const ident = (p) => p;
ident.k = 1;
{
  const t = seaTurtle(ident);
  put('sea-turtle', ['tortuga marina', 'conservación', 'arrecife', 'migración', 'sea turtle', 'turtle', 'ocean conservation'], t.d);
  FILL['sea-turtle'] = t.fill;
  PARTS['sea-turtle'] = { shell: [0, 1], head: [2], flippers: [3, 4, 5, 6] };
  MOTION['sea-turtle'] = { effect: 'float', vector: [0, -1.5] };
}

// ── Seaweed ───────────────────────────────────────────────────────────────────────────────────
/** A wavy blade from its base to its tip: `w` its half width, `sway` its waves, `taper` how much it
 * narrows (1: to a point at both ends, 0: a strap of even width with round ends). */
function blade(base, tip, w = 1.6, sway = 1, n = 2, taper = 1) {
  const spine = Array.from({ length: n * 2 + 1 }, (_, i) => {
    const t = i / (n * 2);
    const p = lerp(base, tip, t);
    const u = unit(sub(tip, base));
    const s = i === 0 || i === n * 2 ? 0 : (i % 2 ? 1 : -1) * sway;
    return add(p, mul([-u[1], u[0]], s));
  });
  if (!taper) return band(spine, () => w, { tip: [false, false], k: 16 });
  return band(spine, (t) => w * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.8 + 0.01, { tip: [true, true], k: 12 });
}
{
  // Seaweed: three wavy ribbons rising from one holdfast on the seabed, their feet apart so the gaps
  // between them stay open; the holdfast in front (the engine clears the ribbons round it)
  const hold = `M${pt([7, 21.25])}C7 18.25 9.5 17.75 12 17.75C14.5 17.75 17 18.25 17 21.25Z`;
  const ribbons = [blade([7.25, 19.5], [3.5, 8.25], 1.25, 0.7, 2, 0), blade([12, 18.5], [12, 4], 1.25, 0.85, 2, 0), blade([16.75, 19.5], [20.5, 8.25], 1.25, 0.7, 2, 0)];
  put('seaweed', ['alga', 'algas marinas', 'nori', 'planta marina', 'seaweed', 'algae', 'nori'], ribbons, { badge: { d: [hold], knock: hold, fill: { solid: [hold] } } });
  FILL.seaweed = { solid: [0, 1, 2] };
  PARTS.seaweed = { ribbons: [0, 1, 2] };
  MOTION.seaweed = { effect: 'wiggle', parts: ['ribbons'], origin: [12, 19] };
}

// ── Under the surface ─────────────────────────────────────────────────────────────────────────
{
  // Underwater: the wave across the top, lugares's fish below it at fish-catch's scale (its eye moved
  // in from the edge) and two bubbles rising to the surface
  const s = 0.82;
  const at = [21.25 - 9.25 * s, 21.25 - 5.75 * s];
  const fish = FISH.map((d) => place(d, s, [12, 12], at));
  const c = placePt([9, 12], s, [12, 12], at);
  const eye = dot(...add(c, mul(unit([-2.25, -1.25]), 5.75 * s - 3.1)));
  put('underwater', ['bajo el agua', 'submarino', 'hábitat marino', 'fondo del mar', 'underwater', 'under the sea', 'marine habitat'], [ripple(3.25, 3, 6), ...fish, eye, circ(4.25, 9.25, 1.5), circ(10.5, 7.5, 1.5)]);
  FILL.underwater = { solid: [1, 2, 4, 5], cut: [3], lines: [0] };
  PARTS.underwater = { water: [0], fish: [1, 2, 3], bubbles: [4, 5] };
  MOTION.underwater = { effect: 'float', parts: ['bubbles'], vector: [0, -1.5] };
}

// ── Round 11, second pass ─────────────────────────────────────────────────────────────────────
{
  // Lionfish: a small body facing left with the base's tail, and its venomous rays swept back from it
  // like a mane blown by the water: four up and back from its back, three down and back from its
  // belly, their tips well apart (rays fanning straight out read as a sun or an eye with lashes)
  const c = [8.25, 12.25];
  const r = 4.5;
  const J = [c[0] + r * Math.SQRT2, c[1]];
  const body = `M${pt(polar(...c, r, -45))}A${N(r)} ${N(r)} 0 1 0 ${pt(polar(...c, r, 45))}L${pt(J)}Z`;
  const ray = (a, t, bow) => {
    const root = polar(...c, r, a);
    const n = unit([-(t[1] - root[1]), t[0] - root[0]]);
    return curve(root, add(lerp(root, t, 0.5), mul(n, bow)), t);
  };
  const up = [ray(-155, [5.75, 2.75], 0.5), ray(-120, [9.75, 2.75], 0.5), ray(-85, [13.75, 3.25], 0.5), ray(-50, [17.25, 5.5], 0.4)];
  const down = [ray(145, [6.75, 21.25], -0.5), ray(105, [10.75, 21], -0.5), ray(65, [14.75, 19.25], -0.4)];
  put('lionfish', ['pez león', 'venenoso', 'especie invasora', 'arrecife', 'lionfish', 'venomous fish', 'invasive species'], [body, tail(J, 20.5, 2.75), ...up, ...down, dot(7, 11.5)]);
  FILL.lionfish = { solid: [0, 1], wire: [2, 3, 4, 5, 6, 7, 8], cut: [9] };
  PARTS.lionfish = { body: [0], tail: [1], spines: [2, 3, 4, 5, 6, 7, 8], eye: [9] };
  MOTION.lionfish = { effect: 'slide', vector: [-1.5, 0] };
}
{
  // Eel: a long body in an S, its open mouth and eye at the head (top left), narrowing to the round
  // end of its tail (wide enough inside to stay open at every weight)
  const spine = [[3, 6.5], [7.25, 6.25], [11.5, 8.25], [11.75, 12.75], [12.75, 17], [17.5, 19.25], [20.25, 17.75]];
  const w = (t) => (t < 0.1 ? 2.2 - t * 4 : t < 0.55 ? 1.8 : 1.8 - 0.5 * Math.sin(((t - 0.55) / 0.45) * (Math.PI / 2)));
  const bodyD = band(spine, w, { tip: ['mouth', false], k: 20, jaw: 1.5 });
  put('eel', ['anguila', 'morena', 'escurridizo', 'arrecife', 'eel', 'moray', 'slippery'], [bodyD, dot(6.5, 5.1)]);
  FILL.eel = { solid: [0], cut: [1] };
  PARTS.eel = { body: [0], eye: [1] };
  MOTION.eel = { effect: 'wiggle', origin: [12, 12] };
}
{
  // Stingray from above: a wide disc with its wings rounded at the tips and its two eyes at the
  // front, and the long thin tail with the barb near its base
  const half = [[12, 3], [14.25, 3.5], [18.25, 6.25], [21.25, 9.25], [19.5, 11.5], [15.75, 13.75], [13.25, 15.25], [12, 15.75, 1]];
  const mirror = half.slice(1, -1).reverse().map(([x, y, k]) => (k ? [24 - x, y, 1] : [24 - x, y]));
  const disc = spline([...half, ...mirror]);
  const tl = curve([12, 15.75], [12.4, 18.5], [13.5, 21.25]);
  const barb = line([12.3, 17.5], [15.25, 18.25]);
  put('stingray', ['raya', 'pastinaca', 'peligro en la playa', 'púa', 'stingray', 'ray', 'beach hazard'], [disc, tl, barb, dot(10.2, 7), dot(13.8, 7)]);
  FILL.stingray = { solid: [0], wire: [1, 2], cut: [3, 4] };
  PARTS.stingray = { body: [0], tail: [1, 2], eyes: [3, 4] };
  MOTION.stingray = { effect: 'float', vector: [0, -1.5] };
}

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// Where the snap to the pixel grid leaves a smudge, a drawing for ≤ 18 px with fewer pieces: the
// details that run together are dropped (a band, two ribs, the turtle's plate, a few rays, the
// bubbles), and what stays is the icon's own strokes. `fill` indexes the small drawing (or takes a
// path: the turtle keeps its plate cut out when filled, where without it the shell and its four
// flippers read as a star).
const SMALL = {};
const keep = (name, ix, fill) => {
  SMALL[name] = { d: ix.map((i) => icons[name].d[i]), fill };
};
const closedOf = (name, i) => `${icons[name].d[i]}Z`;
keep('clownfish', [0, 1, 2, 4, 5], { solid: [0, 1], cut: [2, 3, 4] });
keep('whale', [0, 1, 3], { solid: [0, closedOf('whale', 1)], cut: [2] });
keep('lionfish', [0, 1, 2, 4, 5, 6, 8, 9], { solid: [0, 1], wire: [2, 3, 4, 5, 6], cut: [7] });
keep('stingray', [0, 1, 2], { solid: [0], wire: [1, 2] });
keep('sea-turtle', [0, 2, 3, 4, 5, 6], { solid: [0, 1, ...[3, 4, 5, 6].map((i) => closedOf('sea-turtle', i))], cut: [icons['sea-turtle'].d[1]] });
keep('clam', [0, 1], { solid: [0], cut: [1] });
keep('scallop', [0, 1, 3, 4], { solid: [0, 1], cut: [FILL.scallop.cut[1], FILL.scallop.cut[2]] });
keep('underwater', [0, 1, 2, 3], { solid: [1, 2], cut: [3], lines: [0] });
{
  // Sand dollar: the disc and the five points of its flower, as dots
  const dots = Array.from({ length: 5 }, (_, i) => dot(...polar(12, 12, 4.25, -90 + i * 72)));
  SMALL['sand-dollar'] = { d: [circ(12, 12, 9), ...dots], fill: { solid: [0], cut: [1, 2, 3, 4, 5] } };
}
{
  // Seaweed: the three ribbons as single wavy strokes (the holdfast stays the badge)
  const d = [curve([7.5, 19], [5.5, 15.5], [6, 12], [3.75, 8.25]), curve([12, 18], [12.75, 14], [11.25, 10], [12, 5]), curve([16.5, 19], [18.5, 15.5], [18, 12], [20.25, 8.25])];
  SMALL.seaweed = { d };
}
// Shark alert: the shark larger and without its gills (the 16 px badge is smaller)
SMALL['shark-alert'] = { d: [place(SHARK, 0.75, [2.75, 2.75])], fill: { solid: [0] } };
{
  // Coral alert: a coral of two fingers
  const tree = treeOutline(branch([8, 21.25], [8, 16.5], [{ to: [4.25, 9.25] }, { to: [11.5, 8.5] }]), 1.4, { open: true });
  SMALL['coral-alert'] = { d: [tree, line([4.5, 21.25], [10.25, 21.25])], fill: { solid: [`${tree}Z`], wire: [1] } };
}

// ── Fill, parts, motion, mirror, variants ─────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (!icons[name]) continue;
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
for (const [name, parts] of Object.entries(PARTS)) if (icons[name]) icons[name].parts = parts;
// The sand dollar and the nautilus are already discs: they don't get a circle round them
for (const name of ['sand-dollar', 'nautilus']) icons[name].variants = { circle: false };
for (const [name, motion] of Object.entries(MOTION)) if (icons[name]) icons[name].motion = motion;
// The small drawings are snapped to the pixel grid as the engine snaps the others (it leaves a small
// drawing as it is), and carry their badge: an engine badge in its pixel version, a custom one snapped
for (const [name, { d, fill }] of Object.entries(SMALL)) {
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? d[i] : i));
  const f = fill && { solid: pick(fill.solid) };
  if (fill) for (const k of ['cut', 'lines', 'wire']) if (fill[k]?.length) f[k] = pick(fill[k]);
  const sn = snapper([...d, ...(f ? Object.values(f).flat() : [])]);
  const small = { d: d.map(sn), ...(f && { fill: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.map(sn)])) }) };
  const b = icons[name].badge;
  if (b?.kind) small.badge = badge(b.kind, { size: 16 });
  else if (b) {
    const bs = snapper([...b.d, b.knock]);
    small.badge = { d: b.d.map(bs), knock: bs(b.knock), ...(b.fill && { fill: Object.fromEntries(Object.entries(b.fill).map(([k, v]) => [k, v.map(bs)])) }) };
  }
  icons[name].small = small;
}

export default { category: 'mar', label: 'Vida marina', icons };
