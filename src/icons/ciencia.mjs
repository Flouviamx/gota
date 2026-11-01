// Ciencia y laboratorio (science and the lab): glassware, lab equipment, chemistry, the DNA family,
// the cell, physics diagrams, optics, the atom's nucleus and the earth sciences. Everything is
// computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines,
// continuous corners and a square bottom-right corner on containers. The category adopts datos'
// `flask`, `test-tube` and `atom` and sistema's `magnet` (drawn there, never redrawn): flask-* and
// test-tube-* are datos' own drawings with the engine's badges. The glassware shares one glass (an
// open stroke from rim to rim, its walls ending in the rim) and one liquid line (a level that runs
// from wall to wall); the physics diagrams share one ground line, one block and one arrow; the DNA
// family builds on one helix; research-paper is nucleo's document. Viruses as illness are salud's.
// One approved icon is not drawn: `fume-hood`, since every cabinet tried with its duct and its half
// lowered sash (the duct centered, off center, bent away, narrow or wide, the cabinet tall or wide) read
// as a jerrycan, a perfume bottle, a padlock or a radio.
import { arc, badge, circ, dot, f, flipPath, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import datos from './datos.mjs';
import nucleo from './nucleo.mjs';
import edicion from './edicion.mjs';
import ropa from './ropa.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rad = (d) => (d * Math.PI) / 180;
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rl(pts, radius = 0) {
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
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(add2(V, mul(u, t)))}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(add2(V, mul(v, t)))}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}
/** A capsule along the axis from `a` to `b`, `r` either side of it. */
function bar(a, b, r) {
  const u = unit(sub(b, a));
  const n = [-u[1] * r, u[0] * r];
  const R = halfChord(add2(b, n), sub(b, n));
  return `M${pt(add2(a, n))}L${pt(add2(b, n))}A${R} ${R} 0 0 0 ${pt(sub(b, n))}L${pt(sub(a, n))}A${R} ${R} 0 0 0 ${pt(add2(a, n))}Z`;
}
/** Ellipse of semi-axes rx, ry at c, as two half arcs. */
const ell = ([cx, cy], rx, ry) => `M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx - rx, cy])}Z`;

/**
 * A parametric curve `fn(t) → [x, y]` from t0 to t1 as n cubic segments (each one matched to the
 * curve's tangents at its ends). Sine waves, the helix, the parabola, the spiral, the decay.
 */
function curve(fn, t0, t1, n = 8, move = true) {
  const h = 1e-4;
  const der = (t) => {
    const a = fn(t - h);
    const b = fn(t + h);
    return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h)];
  };
  let s = move ? `M${pt(fn(t0))}` : '';
  for (let i = 0; i < n; i++) {
    const a = t0 + ((t1 - t0) * i) / n;
    const b = t0 + ((t1 - t0) * (i + 1)) / n;
    const k = (b - a) / 3;
    const [P0, P1, D0, D1] = [fn(a), fn(b), der(a), der(b)];
    s += `C${pt(add2(P0, mul(D0, k)))} ${pt(sub(P1, mul(D1, k)))} ${pt(P1)}`;
  }
  return s;
}
/** Arc length table of a parametric curve: t for a given length along it. */
function measure(fn, t0, t1, N = 600) {
  const T = [t0];
  const L = [0];
  let prev = fn(t0);
  for (let i = 1; i <= N; i++) {
    const t = t0 + ((t1 - t0) * i) / N;
    const p = fn(t);
    T.push(t);
    L.push(L[i - 1] + len(sub(p, prev)));
    prev = p;
  }
  const at = (l) => {
    let i = 1;
    while (i < N && L[i] < l) i++;
    const k = (l - L[i - 1]) / (L[i] - L[i - 1] || 1);
    return T[i - 1] + (T[i] - T[i - 1]) * k;
  };
  return { length: L[N], at };
}
/**
 * Dashes along a parametric curve: `n` dashes with a gap of 3 between their ends (so they never
 * merge, DESIGN.md › Detail), the first starting at t0 and the last ending at t1; without `n`, as many
 * as fit with dashes of at least 2.5.
 */
function dashes(fn, t0, t1, n = 0, gap = 3) {
  const m = measure(fn, t0, t1);
  if (!n) n = Math.max(1, Math.floor((m.length + gap) / (2.5 + gap)));
  const d = (m.length - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => curve(fn, m.at(i * (d + gap)), m.at(i * (d + gap) + d), 2));
}
/** Dashes on a straight segment, the same way. */
const dashLine = (a, b, n, gap = 3) => dashes((t) => lerp(a, b, t), 0, 1, n, gap).map((d) => d.replace(/C[^C]*$/, (c) => `L${c.trim().split(' ').slice(-2).join(' ')}`));

/** Smooth closed curve through points (Catmull-Rom as cubics): membranes, rocks. */
function smooth(pts, k = 1 / 6) {
  const n = pts.length;
  let s = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    s += `C${pt(add2(p1, mul(sub(p2, p0), k)))} ${pt(sub(p2, mul(sub(p3, p1), k)))} ${pt(p2)}`;
  }
  return `${s}Z`;
}

// ── The shared pieces ─────────────────────────────────────────────────────────────────────────
/** The physics diagrams' arrow: a straight shaft and a head of arms 3 at 45°. */
const HEAD = 3;
const arrow = (a, b, arm = HEAD) => [line(a, b), head(b, sub(b, a), arm)];
/** Their block: a square of 7 with corners of 1.5. */
const BLOCK = 7;
const block = (x, y, s = BLOCK) => sq(x, y, s, s, 1.5);
/** Their ground: a level line. */
const ground = (y, x0 = 2.75, x1 = 21.25) => hl(y, x0, x1);

/** Lugares' flame (the outer shape): a round base rising to a tilted tip. */
function flame(c, r, tip) {
  const L0 = polar(...c, r, 195);
  const R0 = polar(...c, r, -15);
  const tl = [Math.sin(rad(15)), -Math.cos(rad(15))];
  const tr = [Math.sin(rad(15)), Math.cos(rad(15))];
  const k = r * 0.62;
  return `M${pt(L0)}C${pt(add2(L0, mul(tl, k)))} ${pt(add2(tip, [-r * 0.42, r * 0.62]))} ${pt(tip)}C${pt(add2(tip, [r * 0.2, r * 0.5]))} ${pt(sub(R0, mul(tr, k)))} ${pt(R0)}A${f(r)} ${f(r)} 0 1 1 ${pt(L0)}Z`;
}

// Adopted drawings (never redrawn here)
const FLASK = datos.icons.flask.d;
const TUBE = datos.icons['test-tube'].d;
const DOC = nucleo.icons.document.d[0];

const icons = {};
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** The badges' center (DESIGN.md › Badges). */
const BC = [17.25, 17.25];
/** Each badge's gesture, as the rest of the set: signs beat, tools rock. */
const BADGE_MOTION = {
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  x: { effect: 'beat', parts: ['badge'], origin: BC },
  search: { effect: 'wiggle', parts: ['badge'], origin: BC },
};

// ── Glassware ─────────────────────────────────────────────────────────────────────────────────
// Beaker: straight walls, the pouring lip turned out at the top left, two scale ticks off the right
// wall and the liquid line across.
{
  const glass = rl([[4.5, 3.25], [6.25, 5.25], [6.25, 20.75], [17.75, 20.75], [17.75, 3.25]], [0, 1.25, 2, 2, 0]);
  add('beaker', ['vaso de precipitados', 'laboratorio', 'química', 'medir líquidos', 'beaker', 'lab', 'chemistry'], [glass, hl(8.5, 14.75, 17.75), hl(11.5, 14.75, 17.75), hl(14.75, 6.25, 17.75)]);
  FILL.beaker = { solid: [shut(glass)], cut: [1, 2, 3] };
  PARTS.beaker = { glass: [0], scale: [1, 2], level: [3] };
}
// Round-bottom flask: datos' neck and rim over a full bulb (r 7), the shoulder rounded as the flask's,
// the liquid line across the lower bulb.
{
  const [c, R, x0, rf] = [[12, 14.25], 7, 9.75, 1];
  // The fillet between the neck's wall and the bulb: tangent to both
  const fc = [x0 - rf, c[1] - Math.sqrt((R + rf) ** 2 - (c[0] - x0 + rf) ** 2)];
  const onBulb = add2(c, mul(unit(sub(fc, c)), R));
  const glass = `M${x0} 3.25V${f(fc[1])}A${rf} ${rf} 0 0 1 ${pt(onBulb)}A${R} ${R} 0 1 0 ${pt([24 - onBulb[0], onBulb[1]])}A${rf} ${rf} 0 0 1 ${f(24 - x0)} ${f(fc[1])}V3.25`;
  const y = 16.25;
  const hw = Math.sqrt(R * R - (y - c[1]) ** 2);
  add('flask-round', ['matraz de fondo redondo', 'balón', 'destilación', 'química orgánica', 'round-bottom flask', 'distillation', 'organic chemistry'], [glass, FLASK[1], hl(y, 12 - hw, 12 + hw)]);
  FILL['flask-round'] = { solid: [shut(glass)], wire: [1], cut: [2] };
  PARTS['flask-round'] = { body: [0, 1], level: [2] };
}
// Volumetric flask: a pear-shaped bulb on a flat base, a long thin neck with its calibration ring and
// the stopper on top.
{
  const glass = 'M10.5 5.75V10.25C10.5 12.25 5.25 13.25 5.25 17.25V18.75A2 2 0 0 0 7.25 20.75H16.75A2 2 0 0 0 18.75 18.75V17.25C18.75 13.25 13.5 12.25 13.5 10.25V5.75';
  const stopper = sq(9.75, 2.75, 4.5, 3, 1);
  add('flask-volumetric', ['matraz aforado', 'volumen exacto', 'dilución', 'solución patrón', 'volumetric flask', 'dilution', 'standard solution'], [glass, stopper, hl(8.75, 9.5, 14.5)]);
  FILL['flask-volumetric'] = { solid: [shut(glass), 1], cut: [2] };
  PARTS['flask-volumetric'] = { body: [0], stopper: [1], mark: [2] };
}
// Graduated cylinder: a tall narrow tube with its spout at the top left, standing on a wide foot, three
// ticks up its left wall.
{
  const tube = `${rl([[7.75, 3.25], [9.25, 4.75], [9.25, 18.25]], [0, 1, 0])}M14.75 18.25V3.25`;
  const foot = sq(5.75, 18.25, 12.5, 3, 1.25);
  add('graduated-cylinder', ['probeta', 'medir volumen', 'graduada', 'dosificar', 'graduated cylinder', 'measuring cylinder', 'volume'], [tube, foot, hl(8.25, 9.25, 11.75), hl(11.25, 9.25, 11.75), hl(14.25, 9.25, 11.75)]);
  FILL['graduated-cylinder'] = { solid: [`${rl([[7.75, 3.25], [9.25, 4.75], [9.25, 18.25], [14.75, 18.25], [14.75, 3.25]], [0, 1, 0, 0, 0])}Z`, 1], cut: [2, 3, 4] };
  PARTS['graduated-cylinder'] = { body: [0, 1], scale: [2, 3, 4] };
}
// Test-tube rack: two tubes (datos' test tube, upright) through the top of the rack's frame, which
// stands on its two legs. Three tubes and two legs don't fit side by side with the set's clearance:
// the legs crowded the outer tubes, and a row of tubes on a bar read as a comb, a fence or a radiator.
{
  const X = [8.75, 15.25];
  const tube = (x, hw = 1.75) => `M${f(x - hw)} 3.25V15.5A${hw} ${hw} 0 0 0 ${f(x + hw)} 15.5V3.25`;
  const frame = rl([[3.25, 20.75], [3.25, 10.25], [20.75, 10.25], [20.75, 20.75]], [0, 1, 1, 0]);
  add('test-tube-rack', ['gradilla', 'tubos de ensayo', 'muestras', 'lote', 'test tube rack', 'samples', 'batch'], [...X.map((x) => tube(x)), frame]);
  FILL['test-tube-rack'] = { solid: X.map((x) => shut(tube(x))), wire: [2] };
  PARTS['test-tube-rack'] = { tubes: [0, 1], rack: [2] };
}
// Microtube: a slim tube tapering to its point, the snap cap flipped open up and out from its hinge at
// the rim's left end.
{
  const body = rl([[12, 7.25], [12, 14.25], [14.75, 21.25], [17.5, 14.25], [17.5, 7.25]], [0, 2, 0.75, 2, 0]);
  const H = [11, 7.25];
  const a = unit([-1, -1.1]);
  const m = unit([a[1], -a[0]]);
  const q0 = add2(H, mul(a, 2));
  const q1 = add2(q0, mul(a, 4.25));
  const cap = roundpoly([q0, q1, add2(q1, mul(m, 3.25)), add2(q0, mul(m, 3.25))], [0, 1, 1, 1]);
  add('microtube', ['microtubo', 'tubo eppendorf', 'muestra', 'pcr', 'microtube', 'eppendorf', 'sample'], [body, hl(7.25, 11, 18.5), line(H, q0), cap]);
  FILL.microtube = { solid: [shut(body), 3], wire: [1, 2] };
  PARTS.microtube = { body: [0, 1], cap: [2, 3] };
}
// Micropipette: the plunger's button on top, the grip tapering down with its finger hook, the long
// conical tip below.
{
  const plunger = `M10.5 2.75H13.5M12 2.75V5.5`;
  const grip = roundpoly([[9, 5.5], [15, 5.5], [14.25, 15.25], [9.75, 15.25]], [2, 2, 1, 1]);
  const hook = rl([[14.83, 7.75], [18, 7.75], [18, 9.25]], [0, 1.25, 0]);
  const tip = rl([[10.75, 15.25], [12, 21.25], [13.25, 15.25]], [0, 0.4, 0]);
  add('micropipette', ['micropipeta', 'pipeta', 'dispensar', 'volumen exacto', 'micropipette', 'pipette', 'liquid handling'], [grip, plunger, hook, tip]);
  FILL.micropipette = { solid: [0, shut(tip)], wire: [1, 2] };
  PARTS.micropipette = { body: [0, 2], plunger: [1], tip: [3] };
  MOTION.micropipette = { effect: 'bounce', parts: ['plunger'], vector: [0, 1.25] };
}
// Multichannel pipette: the same grip, shorter, on a manifold that carries four tips.
{
  const plunger = `M10.5 2.75H13.5M12 2.75V5.5`;
  const grip = rl([[9.43, 12.25], [9, 5.5], [15, 5.5], [14.57, 12.25]], [0, 2, 2, 0]);
  const hook = rl([[14.83, 7.75], [18, 7.75], [18, 9.25]], [0, 1.25, 0]);
  const manifold = sq(3.75, 12.25, 16.5, 3.5, 1.25);
  add('multichannel-pipette', ['pipeta multicanal', 'placas de pocillos', 'ensayo', 'alto rendimiento', 'multichannel pipette', 'well plate', 'assay'], [grip, plunger, hook, manifold, ...[6, 10, 14, 18].map((x) => vl(x, 15.75, 20.75))]);
  FILL['multichannel-pipette'] = { solid: [shut(grip), 3], wire: [1, 2, 4, 5, 6, 7] };
  PARTS['multichannel-pipette'] = { body: [0, 2, 3], plunger: [1], tips: [4, 5, 6, 7] };
  MOTION['multichannel-pipette'] = { effect: 'bounce', parts: ['plunger'], vector: [0, 1.25] };
}
// Petri dish, three-quarter view: the rim's ellipse over a short wall, three colonies inside.
{
  const [cx, ty, rx, ry, t] = [12, 10.63, 9, 4.75, 2.75];
  const outline = `M${pt([cx - rx, ty])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([cx + rx, ty])}V${f(ty + t)}A${f(rx)} ${f(ry)} 0 0 1 ${pt([cx - rx, ty + t])}Z`;
  const rim = `M${pt([cx - rx, ty])}A${f(rx)} ${f(ry)} 0 0 0 ${pt([cx + rx, ty])}`;
  add('petri-dish', ['placa de petri', 'cultivo', 'colonias', 'microbiología', 'petri dish', 'culture', 'microbiology'], [outline, rim, dot(8.25, 11.5), dot(12, 9.5), dot(15.75, 11.5)]);
  FILL['petri-dish'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['petri-dish'] = { dish: [0, 1], colonies: [2, 3, 4] };
}
// Microplate: the landscape plate with its corner cut (well A1) and the signature corner, a 3 × 4 grid
// of wells (the calendar's small dots).
{
  const plate = roundpoly([[5.5, 5], [21.5, 5], [21.5, 19], [2.5, 19], [2.5, 8]], [0.75, 2.5, 0, 2.5, 0.75]);
  const wells = [];
  for (const y of [8.75, 12, 15.25]) for (const x of [6.38, 10.13, 13.88, 17.63]) wells.push(dot(x, y, 0.3));
  add('microplate', ['microplaca', 'placa de 96 pocillos', 'elisa', 'ensayo', 'microplate', 'well plate', 'assay'], [plate, ...wells]);
  FILL.microplate = { solid: [0], cut: wells.map((_, i) => i + 1) };
  PARTS.microplate = { plate: [0], wells: wells.map((_, i) => i + 1) };
}

// ── Lab equipment ─────────────────────────────────────────────────────────────────────────────
// Microscope, side view: the tube slanted with its eyepiece at the top, the arm curving from its back
// down to the base, the stage under the objective.
{
  const [A, B] = [[7.25, 4], [10.25, 11.25]];
  const tube = bar(A, B, 1.75);
  const u = unit(sub(B, A));
  const P = add2(lerp(A, B, 0.55), mul([u[1], -u[0]], 1.75));
  const C = [P, add2(P, [5, 0.4]), [19.25, 14.75], [16.25, 20.75]];
  const arm = `M${pt(C[0])}C${pt(C[1])} ${pt(C[2])} ${pt(C[3])}`;
  const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * C[0][k] + 3 * (1 - t) ** 2 * t * C[1][k] + 3 * (1 - t) * t * t * C[2][k] + t ** 3 * C[3][k]);
  let t = 0.5;
  for (let i = 0; i < 40; i++) t += (15.75 - at(t)[1]) / 20;
  const stage = hl(15.75, 5.25, at(t)[0]);
  const base = hl(20.75, 4.75, 19.25);
  add('microscope', ['microscopio', 'biología', 'investigación', 'muestra', 'microscope', 'biology', 'research'], [tube, arm, stage, base]);
  FILL.microscope = { solid: [0], wire: [1, 2, 3] };
  PARTS.microscope = { tube: [0], arm: [1], stage: [2], base: [3] };
}
// Microscope slide: the long thin glass, its frosted label end at the left, the square cover slip across
// it and the specimen under the slip. Round-ended and symmetric it read as a sticking plaster.
{
  const glass = sq(2.5, 8.25, 19, 7.5, 1.25);
  add('microscope-slide', ['portaobjetos', 'muestra', 'histología', 'preparación', 'microscope slide', 'specimen', 'histology'], [glass, vl(6.5, 8.25, 15.75), vl(11, 8.25, 15.75), vl(18.5, 8.25, 15.75), dot(14.75, 12)]);
  FILL['microscope-slide'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['microscope-slide'] = { slide: [0], label: [1], cover: [2, 3], specimen: [4] };
}
// Bunsen burner: the tube on its flat round base, the gas inlet at its side, the flame over its mouth.
{
  const base = roundpoly([[5.75, 20.75], [8, 17.75], [16, 17.75], [18.25, 20.75]], [0.75, 1, 1, 0.75]);
  const tube = `M10.5 17.75V10.75M13.5 10.75V17.75`;
  add('bunsen-burner', ['mechero bunsen', 'calentar', 'llama', 'experimento', 'bunsen burner', 'heat', 'flame'], [base, tube, hl(14.5, 13.5, 17.25), flame([12, 5.75], 2, [12.4, 2])]);
  FILL['bunsen-burner'] = { solid: [0, 'M10.5 17.75V10.75H13.5V17.75Z', 3], wire: [2] };
  PARTS['bunsen-burner'] = { base: [0], tube: [1, 2], flame: [3] };
  MOTION['bunsen-burner'] = { effect: 'wiggle', parts: ['flame'], origin: [12, 7.75] };
}
// Lab coat: ropa's coat (the same garment, its V neckline and long body), open down the front, a pen
// clipped in its breast pocket. Its lapels are left out: they leave the pocket no room.
{
  const body = ropa.icons.coat.d[0];
  add('lab-coat', ['bata de laboratorio', 'investigador', 'científico', 'personal', 'lab coat', 'researcher', 'scientist'], [body, vl(12, 11.25, 21.25), hl(12.25, 14.85, 17.25), vl(15.75, 10.25, 12.25)]);
  FILL['lab-coat'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['lab-coat'] = { coat: [0, 1], pocket: [2], pen: [3] };
}
// Separatory funnel: the stopper on its short neck, the bulb tapering to the stem (a teardrop upside
// down) with the interface between the two liquids, the stopcock's handle out to one side of the stem.
{
  const [c, R, tipY] = [[12, 9.25], 4.75, 17.25];
  const th = Math.asin(R / (tipY - c[1]));
  const tan = add2(c, [R * Math.cos(th), R * Math.sin(th)]);
  const neck = 10.75;
  const ny = c[1] - Math.sqrt(R * R - (12 - neck) ** 2);
  const bulb = `M${neck} 3.25V${f(ny)}A${R} ${R} 0 0 0 ${pt([24 - tan[0], tan[1]])}L12 ${tipY}L${pt(tan)}A${R} ${R} 0 0 0 ${f(24 - neck)} ${f(ny)}V3.25`;
  const y = 10.75;
  const hw = Math.sqrt(R * R - (y - c[1]) ** 2);
  add('separatory-funnel', ['embudo de decantación', 'extracción', 'separar fases', 'química', 'separatory funnel', 'extraction', 'separation'], [bulb, hl(3.25, 9.5, 14.5), vl(12, tipY, 21.25), rl([[12, 19], [15.75, 19], [15.75, 17.25]], [0, 0.75, 0]), hl(y, 12 - hw, 12 + hw)]);
  FILL['separatory-funnel'] = { solid: [shut(bulb)], wire: [1, 2, 3], cut: [4] };
  PARTS['separatory-funnel'] = { body: [0, 1], stem: [2], stopcock: [3], level: [4] };
}

// Wash bottle: a squeeze bottle under its cap, a thin tube rising from the cap and bending over and down
// into its nozzle.
{
  const body = sq(5.25, 10.5, 11, 10.75, 3);
  const cap = sq(7.75, 7.5, 6, 3, 1);
  const tube = rl([[10.75, 7.5], [10.75, 3.25], [15.75, 3.25], [20.25, 8.5]], [0, 1.5, 1.5, 0]);
  add('wash-bottle', ['piseta', 'frasco lavador', 'enjuagar', 'agua destilada', 'wash bottle', 'squeeze bottle', 'rinse'], [body, cap, tube]);
  FILL['wash-bottle'] = { solid: [0, 1], wire: [2] };
  PARTS['wash-bottle'] = { body: [0], cap: [1], nozzle: [2] };
}
// Reagent bottle: squat, round-shouldered, the glass stopper a mushroom over the neck and a blank label
// on the body.
{
  const stopper = 'M9 6.25A3 3 0 0 1 15 6.25Z';
  const glass = 'M10 6.25V8C10 10 5 10 5 13V18.75A2.5 2.5 0 0 0 7.5 21.25H16.5A2.5 2.5 0 0 0 19 18.75V13C19 10 14 10 14 8V6.25';
  const label = sq(8, 13.75, 8, 4.5, 1);
  add('reagent-bottle', ['frasco de reactivo', 'reactivo', 'químicos', 'inventario', 'reagent bottle', 'chemicals', 'stock solution'], [glass, stopper, label]);
  FILL['reagent-bottle'] = { solid: [shut(glass), 1], cut: [2] };
  PARTS['reagent-bottle'] = { body: [0], stopper: [1], label: [2] };
}
// Specimen jar: a wide jar under its lid, the liquid's level and a curled specimen floating below it.
{
  const lid = sq(4.25, 3.25, 15.5, 3, 1.25);
  const jar = rl([[5.5, 6.25], [5.5, 21.25], [18.5, 21.25], [18.5, 6.25]], [0, 3, 3, 0]);
  // The specimen: a body curled on itself, open on one side
  const larva = arc(12, 15.25, 2.75, -40, 230).d;
  add('specimen-jar', ['frasco de muestras', 'espécimen', 'colección', 'historia natural', 'specimen jar', 'specimen', 'natural history'], [jar, lid, hl(9.25, 5.5, 18.5), larva]);
  FILL['specimen-jar'] = { solid: [shut(jar), 1], cut: [2, 3] };
  PARTS['specimen-jar'] = { jar: [0], lid: [1], level: [2], specimen: [3] };
}

// Bell jar: a tall glass dome with straight sides, its knob on top and a highlight down the glass, on
// a plate with a short vacuum nozzle.
{
  const dome = 'M5.5 18.25V10.5A6.5 6.5 0 0 1 18.5 10.5V18.25';
  const shine = `M8.5 15.25V10.5${arc(12, 10.5, 3.5, 180, 235).d.replace(/^M[^A]*/, '')}`;
  add('bell-jar', ['campana de vacío', 'vacío', 'atmósfera controlada', 'aislar muestra', 'bell jar', 'vacuum', 'controlled atmosphere'], [dome, dot(12, 3.4), shine, sq(4, 18.25, 16, 3, 1.25), hl(19.75, 20, 22.25)]);
  FILL['bell-jar'] = { solid: [shut(dome), 1, 3], cut: [2], wire: [4] };
  PARTS['bell-jar'] = { dome: [0, 1, 2], plate: [3, 4] };
}
// Hydrometer: a tall cylinder with its liquid line and the float inside, its bulb under the surface and
// its long stem rising through it.
{
  const glass = rl([[6, 3.25], [6, 21.25], [18, 21.25], [18, 3.25]], [0, 2.5, 2.5, 0]);
  add('hydrometer', ['hidrómetro', 'densímetro', 'densidad', 'cervecería', 'hydrometer', 'density', 'specific gravity'], [glass, hl(9, 6, 18), vl(12, 5, 11.75), bar([12, 13.5], [12, 16.5], 1.75)]);
  FILL.hydrometer = { solid: [shut(glass)], cut: [1, 2, 3] };
  PARTS.hydrometer = { glass: [0], level: [1], float: [2, 3] };
  MOTION.hydrometer = { effect: 'float', parts: ['float'], vector: [0, -1] };
}
// Gel electrophoresis: the gel (the signature corner), its wells along the top and three lanes of bands
// run to different heights.
{
  const gel = sq(4.25, 2.75, 15.5, 18.5, 3.5, BR);
  const wells = [8.25, 12, 15.75].map((x) => dot(x, 6.25, 0.3));
  const bands = [[8.25, 10], [8.25, 15], [12, 12.5], [12, 17.75], [15.75, 9.5], [15.75, 15.25]].map(([x, y]) => hl(y, x - 1, x + 1));
  add('gel-electrophoresis', ['electroforesis', 'gel', 'bandas', 'adn', 'gel electrophoresis', 'dna bands', 'protein'], [gel, ...wells, ...bands]);
  FILL['gel-electrophoresis'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9] };
  PARTS['gel-electrophoresis'] = { gel: [0], wells: [1, 2, 3], bands: [4, 5, 6, 7, 8, 9] };
}
// Titration: the long thin burette narrowing to its tip, the stopcock's handle, and a drop that has
// fallen through the mouth of the flask below.
{
  const burette = 'M10.25 2.25V7L12 8.75V10.75M12 8.75L13.75 7V2.25';
  const flask = rl([[10.75, 13.75], [10.75, 15.25], [6, 21.25], [18, 21.25], [13.25, 15.25], [13.25, 13.75]], [0, 1, 1.25, 1.25, 1, 0]);
  add('titration', ['titulación', 'valoración', 'bureta', 'gota a gota', 'titration', 'burette', 'volumetric analysis'], [burette, hl(10.25, 12, 14.75), flask, hl(13.75, 9.75, 14.25), dot(12, 18)]);
  FILL.titration = { solid: [shut(flask)], wire: [0, 1, 3], cut: [4] };
  PARTS.titration = { burette: [0, 1], flask: [2, 3], drop: [4] };
  MOTION.titration = { effect: 'bounce', parts: ['drop'], vector: [0, 1] };
}
// Analytical balance: the glass draft shield over the weighing pan on its post, the base (the
// signature corner) with its display.
{
  const shield = rl([[3.75, 15.25], [3.75, 3.25], [20.25, 3.25], [20.25, 15.25]], [0, 3, 3, 0]);
  add('analytical-balance', ['balanza analítica', 'pesar', 'precisión', 'reactivos', 'analytical balance', 'lab scale', 'weighing'], [shield, sq(2.75, 15.25, 18.5, 6, 2, BR), hl(12, 8.5, 15.5), vl(12, 12, 15.25), hl(18.25, 6, 9.5), sq(10.25, 8.5, 3.5, 3.5, 1)]);
  FILL['analytical-balance'] = { solid: [shut(shield), 1], cut: [2, 3, 4, 5] };
  PARTS['analytical-balance'] = { shield: [0], base: [1], pan: [2, 3], display: [4], load: [5] };
}
// Magnetic stirrer: the low box (the signature corner) with its knob, the beaker's glass on it, the stir
// bar at its bottom and the shallow vortex it draws in the liquid's surface.
{
  const glass = rl([[4.5, 3.5], [6.25, 5.5], [6.25, 15.25]], [0, 1.25, 0]);
  const vortex = 'M6.25 8.25C9.75 8.25 10.5 9.5 12 9.5S14.25 8.25 17.75 8.25';
  add('magnetic-stirrer', ['agitador magnético', 'placa calefactora', 'mezclar', 'disolver', 'magnetic stirrer', 'hot plate', 'mixing'], [`${glass}M17.75 15.25V3.5`, sq(2.75, 15.25, 18.5, 6, 2, BR), dot(6.25, 18.25), hl(12.25, 10, 14), vortex]);
  FILL['magnetic-stirrer'] = { solid: [`${rl([[4.5, 3.5], [6.25, 5.5], [6.25, 15.25], [17.75, 15.25], [17.75, 3.5]], [0, 1.25, 0, 0, 0])}Z`, 1], cut: [2, 3, 4] };
  PARTS['magnetic-stirrer'] = { beaker: [0], base: [1, 2], stirrer: [3], level: [4] };
  MOTION['magnetic-stirrer'] = { effect: 'wiggle', parts: ['stirrer'], origin: [12, 12.25] };
}
// Ring stand: the heavy base, the rod, and the clamp's arm holding datos' test tube at its slant.
{
  const T = TUBE.map((d) => place(d, 0.65, [12, 12], [14.75, 10.5]));
  add('lab-stand', ['soporte universal', 'pinza', 'montaje', 'laboratorio escolar', 'ring stand', 'retort stand', 'clamp'], [sq(3.25, 18.25, 14.5, 3, 1.25), vl(6.25, 2.75, 18.25), hl(8, 6.25, 14.51), ...T]);
  FILL['lab-stand'] = { solid: [0, shut(T[0])], wire: [1, 2, 4], cut: [5] };
  PARTS['lab-stand'] = { base: [0], rod: [1], clamp: [2], tube: [3, 4, 5] };
}
// Spring scale: the capsule hanging from its ring, the scale's ticks inside and the hook under it.
{
  add('spring-scale', ['dinamómetro', 'fuerza', 'newtons', 'física', 'spring scale', 'force meter', 'newton'], [`${circ(12, 3.5, 1.25)}M12 4.75V6`, bar([12, 9], [12, 15], 3), hl(9, 9, 11.5), hl(12, 9, 11.5), hl(15, 9, 11.5), 'M12 18V20.5A1.25 1.25 0 0 0 14.5 20.5']);
  FILL['spring-scale'] = { solid: [1], wire: [0, 5], cut: [2, 3, 4] };
  PARTS['spring-scale'] = { ring: [0], body: [1], scale: [2, 3, 4], hook: [5] };
  MOTION['spring-scale'] = { effect: 'ring', origin: [12, 2.25] };
}
// Geiger counter: the handheld box (the signature corner) under its handle, the dial with its needle,
// and the cable to the wand probe.
{
  const dial = arc(9.25, 17.5, 3.5, 200, 340).d;
  add('geiger-counter', ['contador geiger', 'radiación', 'detector', 'medir radiactividad', 'geiger counter', 'radiation', 'detector'], [sq(2.75, 9.75, 13, 11.5, 3, BR), rl([[5.25, 9.75], [5.25, 6.25], [13.25, 6.25], [13.25, 9.75]], [0, 1.5, 1.5, 0]), dial, line([9.25, 17.5], polar(9.25, 17.5, 3.5, 300)), 'M15.75 18.5C19 18.5 20.25 16.5 20.25 12', bar([20.25, 5], [20.25, 10.5], 1.5)]);
  FILL['geiger-counter'] = { solid: [0, 5], wire: [1, 4], cut: [2, 3] };
  PARTS['geiger-counter'] = { body: [0, 1], dial: [2], needle: [3], probe: [4, 5] };
  MOTION['geiger-counter'] = { effect: 'wiggle', parts: ['needle'], origin: [9.25, 17.5] };
}
// Seismograph: the paper strip (the signature corner) with its jagged trace, and the pen's arm hanging
// from its pivot down to the trace.
{
  const trace = rl([[5.5, 15.5], [7.25, 15.5], [8.25, 13.25], [9.5, 18.25], [10.75, 12.75], [12, 17.25], [13, 15.5], [14.5, 15.5]], 0.3);
  const piv = [18.5, 4.75];
  const tip = [14.5, 15.5];
  add('seismograph', ['sismógrafo', 'sismo', 'terremoto', 'vibración', 'seismograph', 'earthquake', 'seismic'], [sq(2.5, 9.75, 19, 11.5, 2.5, BR), trace, line(tip, add2(piv, mul(unit(sub(tip, piv)), 1.5))), circ(...piv, 1.5)]);
  FILL.seismograph = { solid: [0, 3], cut: [1], lines: [2] };
  PARTS.seismograph = { paper: [0], trace: [1], pen: [2, 3] };
  MOTION.seismograph = { effect: 'wiggle', parts: ['pen'], origin: piv };
}

// ── Chemistry ─────────────────────────────────────────────────────────────────────────────────
/** Ball and stick: atoms (circles) and the sticks between their edges. */
const stick = (a, ra, b, rb) => {
  const u = unit(sub(b, a));
  return line(add2(a, mul(u, ra)), sub(b, mul(u, rb)));
};
// Molecule: a central atom bonded by short sticks to three smaller ones at uneven angles.
{
  const C = [12.5, 12.25];
  const atoms = [-50, 190, 70].map((a) => polar(...C, 7.5, a));
  add('molecule', ['molécula', 'compuesto', 'química', 'materiales', 'molecule', 'compound', 'chemistry'], [circ(...C, 3.25), ...atoms.map((p) => circ(...p, 2)), ...atoms.map((p) => stick(C, 3.25, p, 2))]);
  FILL.molecule = { solid: [0, 1, 2, 3], wire: [4, 5, 6] };
  PARTS.molecule = { atoms: [0, 1, 2, 3], bonds: [4, 5, 6] };
}
// Water molecule: the oxygen and its two hydrogens below it at water's bent angle (104.5°).
{
  const O = [12, 10];
  const H = [90 - 52.25, 90 + 52.25].map((a) => polar(...O, 9, a));
  add('water-molecule', ['molécula de agua', 'agua', 'h2o', 'hidratación', 'water molecule', 'water', 'h2o'], [circ(...O, 4), ...H.map((p) => circ(...p, 2.5)), ...H.map((p) => stick(O, 4, p, 2.5))]);
  FILL['water-molecule'] = { solid: [0, 1, 2], wire: [3, 4] };
  PARTS['water-molecule'] = { oxygen: [0], hydrogen: [1, 2], bonds: [3, 4] };
}
// Benzene ring: the hexagon with its three double bonds inside, on every other side (Kekulé's
// structure). The hexagon with a circle inside is sistema's hex-nut to the pixel.
{
  const V = [0, 1, 2, 3, 4, 5].map((k) => polar(12, 12, 9, -90 + 60 * k));
  const bonds = [0, 2, 4].map((i) => {
    const [a, b] = [V[i], V[(i + 1) % 6]];
    const n = unit(sub([12, 12], lerp(a, b, 0.5)));
    return line(add2(lerp(a, b, 0.25), mul(n, 3)), add2(lerp(a, b, 0.75), mul(n, 3)));
  });
  add('benzene-ring', ['anillo de benceno', 'aromático', 'química orgánica', 'estructura', 'benzene ring', 'aromatic', 'organic chemistry'], [roundpoly(V, 1), ...bonds]);
  FILL['benzene-ring'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['benzene-ring'] = { ring: [0], bonds: [1, 2, 3] };
}
// Chemical reaction: two separate atoms, the arrow, and the same two bonded.
{
  const atoms = (x) => [circ(x, 8.25, 2.25), circ(x, 15.75, 2.25)];
  add('chemical-reaction', ['reacción química', 'síntesis', 'reactivos', 'productos', 'chemical reaction', 'synthesis', 'reactants'], [...atoms(4.5), ...arrow([9.25, 12], [15, 12]), ...atoms(19.5), vl(19.5, 10.5, 13.5)]);
  FILL['chemical-reaction'] = { solid: [0, 1, 4, 5], wire: [2, 3, 6] };
  PARTS['chemical-reaction'] = { reactants: [0, 1], arrow: [2, 3], product: [4, 5, 6] };
  MOTION['chemical-reaction'] = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
}
// Reversible reaction: two harpoons, the upper one forward with its barb on top, the lower one the same
// turned around.
{
  const fwd = 'M3.75 9.75H20.25L16.25 5.75';
  add('reversible-reaction', ['reacción reversible', 'equilibrio químico', 'equilibrio', 'química', 'reversible reaction', 'equilibrium', 'chemistry'], [fwd, turnPath(fwd, 180)]);
  FILL['reversible-reaction'] = false;
  PARTS['reversible-reaction'] = { forward: [0], reverse: [1] };
}
// Periodic table: its stepped outline (the tall columns at both ends, the lower middle block) and the
// detached strip of two rows beneath.
{
  const P = [[2.75, 4.75], [5.5, 4.75], [5.5, 7.25], [8.25, 7.25], [8.25, 9.75], [15, 9.75], [15, 7.25], [18.5, 7.25], [18.5, 4.75], [21.25, 4.75], [21.25, 15], [2.75, 15]];
  const table = roundpoly(P, [1, 1, 0.5, 1, 0.5, 0.5, 1, 0.5, 1, 1, 1.5, 1.5]);
  add('periodic-table', ['tabla periódica', 'elementos', 'química', 'referencia', 'periodic table', 'elements', 'chemistry'], [table, sq(7.25, 18, 11.75, 3, 1.25), vl(8.25, 9.75, 15), vl(15, 9.75, 15)]);
  FILL['periodic-table'] = { solid: [0, 1], cut: [2, 3] };
  PARTS['periodic-table'] = { table: [0, 2, 3], series: [1] };
}
// Crystal lattice: a unit cell, a cube in perspective drawn by its visible edges between the atoms at
// its visible corners.
{
  const [x0, y0, s, o] = [4.25, 10.25, 9.5, 6];
  const F = { a: [x0, y0], b: [x0 + s, y0], c: [x0 + s, y0 + s], d: [x0, y0 + s] };
  const B = { a: [x0 + o, y0 - o], b: [x0 + s + o, y0 - o], c: [x0 + s + o, y0 + s - o] };
  const r = 1.25;
  const atoms = [F.a, F.b, F.c, F.d, B.a, B.b, B.c];
  const edges = [[F.a, F.b], [F.b, F.c], [F.c, F.d], [F.d, F.a], [F.a, B.a], [F.b, B.b], [F.c, B.c], [B.a, B.b], [B.b, B.c]].map(([p, q]) => stick(p, r, q, r));
  add('crystal-lattice', ['red cristalina', 'celda unitaria', 'cristal', 'materiales', 'crystal lattice', 'unit cell', 'materials science'], [...atoms.map((p) => circ(...p, r)), ...edges]);
  FILL['crystal-lattice'] = { solid: [0, 1, 2, 3, 4, 5, 6], wire: [7, 8, 9, 10, 11, 12, 13, 14, 15] };
  PARTS['crystal-lattice'] = { atoms: [0, 1, 2, 3, 4, 5, 6], bonds: [7, 8, 9, 10, 11, 12, 13, 14, 15] };
}

// Electron shells (the Bohr model): the nucleus, two shells around it and the electrons on them, each
// one in a gap of its shell (a dot sitting on a stroke read only as a bump, a target with lumps).
{
  const [ri, ro] = [5.25, 8.75];
  /** A shell as arcs between its electrons, each gap leaving the electron 1.5 of paper. */
  const shell = (r, at) => {
    const g = (2 * Math.asin((0.7 + 2.9) / (2 * r)) * 180) / Math.PI;
    return at.map((a, i) => arc(12, 12, r, a + g, (at[i + 1] ?? at[0] + 360) - g).d);
  };
  const [ai, ao] = [[-30, 150], [60, 240]];
  const shells = [...shell(ri, ai), ...shell(ro, ao)];
  const electrons = [...ai.map((a) => dot(...polar(12, 12, ri, a))), ...ao.map((a) => dot(...polar(12, 12, ro, a)))];
  const nucleus = circ(12, 12, 2.25);
  add('electron-shells', ['capas electrónicas', 'modelo de bohr', 'electrones', 'estructura atómica', 'electron shells', 'bohr model', 'electrons'], [nucleus, ...shells, ...electrons]);
  const ix = (from, n) => Array.from({ length: n }, (_, i) => from + i);
  FILL['electron-shells'] = { solid: [0, ...ix(1 + shells.length, electrons.length)], wire: ix(1, shells.length) };
  PARTS['electron-shells'] = { nucleus: [0], shells: ix(1, shells.length), electrons: ix(1 + shells.length, electrons.length) };
  MOTION['electron-shells'] = { effect: 'spin', parts: ['shells', 'electrons'], origin: [12, 12] };
}
// pH strip: a long narrow strip held at a slant, its three indicator pads stacked at its lower end.
{
  add('ph-strip', ['tira de ph', 'acidez', 'alcalinidad', 'prueba de agua', 'ph strip', 'acidity', 'water test'], [sq(9, 2.75, 6, 18.5, 2), hl(12.25, 9, 15), hl(15.25, 9, 15), hl(18.25, 9, 15)].map((d) => turnPath(d, 45)));
  FILL['ph-strip'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['ph-strip'] = { strip: [0], pads: [1, 2, 3] };
}

// ── The DNA family and the cell ───────────────────────────────────────────────────────────────
/**
 * The helix: two strands at ±A·cos(π(t − t0)/p) about the axis, crossing every p and widest halfway;
 * vertical, or horizontal (`h`). Every DNA icon draws its strands with it.
 */
const helixPt = (c, A, p, t0, s, h = false) => (t) => {
  const o = c + s * A * Math.cos((Math.PI * (t - t0)) / p);
  return h ? [t, o] : [o, t];
};
const helix = (c, A, p, t0, from, to, h = false) => [1, -1].map((s) => curve(helixPt(c, A, p, t0, s, h), from, to, Math.round((to - from) / 1.5)));
/** A rung across the helix at t. */
const rung = (c, A, p, t0, t, h = false) => {
  const [a, b] = [1, -1].map((s) => helixPt(c, A, p, t0, s, h)(t));
  return line(a, b);
};
// DNA: the double helix upright, two strands crossing twice, three rungs between them.
{
  const H = [12, 5, 9, 3];
  add('dna', ['adn', 'genética', 'genoma', 'biotecnología', 'dna', 'genetics', 'double helix'], [...helix(...H, 2.75, 21.25), ...[4.75, 12, 19.25].map((t) => rung(...H, t))]);
  FILL.dna = false;
  PARTS.dna = { strands: [0, 1], rungs: [2, 3, 4] };
}
// RNA: a single strand, its bases ticking out to one side only.
{
  const S = (y) => [9.25 + 2.25 * Math.sin((2 * Math.PI * (y - 3)) / 12), y];
  const ticks = [4.5, 8, 11.5, 15, 18.5].map((y) => line(S(y), [S(y)[0] + 4.75, y]));
  add('rna', ['arn', 'arn mensajero', 'transcripción', 'vacuna', 'rna', 'mrna', 'transcription'], [curve(S, 3, 21, 12), ...ticks]);
  FILL.rna = false;
  PARTS.rna = { strand: [0], bases: [1, 2, 3, 4, 5] };
}
// Chromosome: its X of four rounded arms, pinched where the two chromatids meet (the centromere).
{
  const C = [12, 12];
  const [L, h] = [7.75, 2.5];
  const A = [-125, -55, 55, 125];
  const pts = [];
  const radii = [];
  A.forEach((a, i) => {
    const T = polar(...C, L, a);
    pts.push(add2(T, mul([Math.cos(rad(a - 90)), Math.sin(rad(a - 90))], h)), add2(T, mul([Math.cos(rad(a + 90)), Math.sin(rad(a + 90))], h)));
    radii.push(h, h);
    const b = i === A.length - 1 ? A[0] + 360 : A[i + 1];
    pts.push(polar(...C, h / Math.sin(rad((b - a) / 2)), (a + b) / 2));
    radii.push(b - a > 90 ? 1.75 : 0.75);
  });
  add('chromosome', ['cromosoma', 'herencia', 'cariotipo', 'genética', 'chromosome', 'heredity', 'karyotype'], [roundpoly(pts, radii)]);
  FILL.chromosome = { solid: [0] };
  PARTS.chromosome = { chromatids: [0] };
}
// Gene editing (CRISPR): the dna icon's helix, smaller (its middle rung only), and edicion's scissors (its rings and blades,
// built the same way at this size, the blades simply crossing) open toward it from the right.
{
  const dna = [0, 1, 3].map((i) => place(icons.dna.d[i], 0.75, [12, 12], [6.25, 12]));
  const s = 0.575;
  const T = (p) => {
    const q = rot(p, [12, 12], -90);
    return [22.5 + (q[0] - 22.5) * s, 12 + (q[1] - 12) * s];
  };
  const [L, R, tR, tL] = [[6.75, 17.25], [17.25, 17.25], [16.5, 3.25], [7.5, 3.25]].map(T);
  const r = 1.5;
  const blade = (ring, tip) => line(add2(ring, mul(unit(sub(tip, ring)), r)), lerp(ring, tip, 0.82));
  add('gene-editing', ['edición genética', 'crispr', 'ingeniería genética', 'modificar adn', 'gene editing', 'crispr', 'genetic engineering'], [...dna, circ(...L, r), circ(...R, r), blade(L, tR), blade(R, tL)]);
  FILL['gene-editing'] = { solid: [3, 4], wire: [0, 1, 2, 5, 6] };
  PARTS['gene-editing'] = { strands: [0, 1], rung: [2], scissors: [3, 4, 5, 6] };
  MOTION['gene-editing'] = { effect: 'wiggle', parts: ['scissors'], origin: [18, 12] };
}
// DNA replication: the helix closed at the bottom, unzipping upward into a fork of two separate strands.
{
  const H = [12, 3.5, 5.75, 9.5];
  const [a, b] = helix(...H, 9.5, 21.25);
  const forkL = `M${pt(helixPt(...H, 1)(9.5))}C15.5 6.5 17.5 4.25 19.75 2.75`;
  const forkR = `M${pt(helixPt(...H, -1)(9.5))}C8.5 6.5 6.5 4.25 4.25 2.75`;
  add('dna-replication', ['replicación del adn', 'copia del genoma', 'horquilla', 'biología celular', 'dna replication', 'replication fork', 'cell biology'], [a, b, forkL, forkR, ...[9.5, 15.25, 21].map((t) => rung(...H, t))]);
  FILL['dna-replication'] = false;
  PARTS['dna-replication'] = { helix: [0, 1, 4, 5, 6], fork: [2, 3] };
}
// Animal cell: a soft, slightly irregular membrane, the nucleus off center with its nucleolus, and one
// small organelle.
{
  const C = [12, 12];
  const ring = Array.from({ length: 10 }, (_, i) => {
    const a = i * 36 - 90;
    return polar(...C, 9.1 + 0.3 * Math.sin(rad(3 * a + 40)), a);
  });
  const N = polar(...C, 3, -45);
  const O = polar(...C, 4.75, 135);
  const organelle = turnPath(ell(O, 2.25, 1.35), 45, O);
  add('animal-cell', ['célula animal', 'biología celular', 'núcleo', 'ciencias de la vida', 'animal cell', 'cell biology', 'nucleus'], [smooth(ring), circ(...N, 3.25), dot(...N), organelle]);
  FILL['animal-cell'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['animal-cell'] = { membrane: [0], nucleus: [1, 2], organelle: [3] };
}
// Plant cell: its wall an irregular five-sided polygon (as cells lie in a plant's tissue), the membrane
// running inside it and the nucleus. With six nearly even sides and the nucleus centered it read as a
// hex nut.
{
  const W = [[6, 3.25], [17.75, 3.75], [20.75, 12.5], [17.5, 20.75], [3.25, 19.25]];
  /** The polygon moved in by k on every side (each side shifted, consecutive sides intersected). */
  const inset = (P, k) => {
    const n = P.length;
    const sides = P.map((a, i) => {
      const b = P[(i + 1) % n];
      const u = unit(sub(b, a));
      const m = [-u[1], u[0]];
      return [add2(a, mul(m, k)), u];
    });
    return sides.map(([p1, u1], i) => {
      const [p0, u0] = sides[(i - 1 + n) % n];
      const t = ((p1[0] - p0[0]) * u1[1] - (p1[1] - p0[1]) * u1[0]) / (u0[0] * u1[1] - u0[1] * u1[0]);
      return add2(p0, mul(u0, t));
    });
  };
  add('plant-cell', ['célula vegetal', 'pared celular', 'botánica', 'biología vegetal', 'plant cell', 'cell wall', 'botany'], [roundpoly(W, 2.5), roundpoly(inset(W, 3), 1.25), circ(13.5, 13, 1.75)]);
  FILL['plant-cell'] = { solid: [0], cut: [1, 2] };
  PARTS['plant-cell'] = { wall: [0], membrane: [1], nucleus: [2] };
}
// Mitochondrion: the oval, tilted, and the inner membrane folded into its cristae, deep folds from
// side to side. A capsule with a sine wave in it was the electromagnetic spectrum's band.
{
  const [yt, yb] = [9.75, 14.5];
  const cristae = `M7.5 ${yb}V${yt}A1.5 1.5 0 0 1 10.5 ${yt}V${yb}A1.5 1.5 0 0 0 13.5 ${yb}V${yt}A1.5 1.5 0 0 1 16.5 ${yt}V${yb}`;
  add('mitochondrion', ['mitocondria', 'energía celular', 'metabolismo', 'biología celular', 'mitochondrion', 'cellular energy', 'metabolism'], [ell([12, 12], 9.5, 7), cristae].map((d) => turnPath(d, -25)));
  FILL.mitochondrion = { solid: [0], cut: [1] };
  PARTS.mitochondrion = { membrane: [0], cristae: [1] };
}
// Chloroplast: an oval with three small stacks of thylakoids (the grana) inside.
{
  const stack = (x, ys, hw = 1.13) => ys.map((y) => hl(y, x - hw, x + hw));
  const grana = [...stack(7, [10.5, 13.5], 1), ...stack(12, [9, 12, 15]), ...stack(17, [10.5, 13.5], 1)];
  add('chloroplast', ['cloroplasto', 'fotosíntesis', 'biología vegetal', 'clorofila', 'chloroplast', 'photosynthesis', 'plant biology'], [ell([12, 12], 9.75, 6.5), ...grana]);
  FILL.chloroplast = { solid: [0], cut: grana.map((_, i) => i + 1) };
  PARTS.chloroplast = { membrane: [0], grana: grana.map((_, i) => i + 1) };
}
// Photosynthesis: lugares' leaf (a lens and its midrib) and the sun at the upper left, three rays
// reaching from it toward the leaf.
{
  const [A, B, R] = [[10, 20], [21, 9], 11.5];
  const leaf = `M${pt(A)}A${R} ${R} 0 0 1 ${pt(B)}A${R} ${R} 0 0 1 ${pt(A)}Z`;
  const sun = [4.75, 4.75];
  const rays = [15, 45, 75].map((a) => line(polar(...sun, 5.75, a), polar(...sun, 8.25, a)));
  const rib = [[7.75, 22.25], [15.5, 14.5]];
  add('photosynthesis', ['fotosíntesis', 'luz', 'hoja', 'energía', 'photosynthesis', 'sunlight', 'leaf'], [leaf, line(...rib), circ(...sun, 2.25), ...rays]);
  FILL.photosynthesis = { solid: [0, 2], wire: [line(rib[0], A)], cut: [line(A, rib[1])], lines: [3, 4, 5] };
  PARTS.photosynthesis = { leaf: [0, 1], sun: [2], light: [3, 4, 5] };
}

// ── Physics ───────────────────────────────────────────────────────────────────────────────────
// Pendulum: the bob hanging at rest from the middle of its ceiling bar and the curved double arrow of
// its swing under it. Swung to one side, with its arc dashed or as one arrow, the bar, the slanted
// string and the round bob read as a kick scooter.
{
  const P = [12, 3.25];
  const [L, R, S] = [11.25, 2.5, 17.5];
  const swing = arc(...P, S, 66, 114);
  const back = arc(...P, S, 114, 66);
  add('pendulum', ['péndulo', 'oscilación', 'periodo', 'física', 'pendulum', 'oscillation', 'swing'], [hl(3.25, 5.75, 18.25), vl(12, 3.25, 3.25 + L - R), circ(12, 3.25 + L, R), swing.d, head(swing.end, swing.tangent, HEAD), head(back.end, back.tangent, HEAD)]);
  FILL.pendulum = { solid: [2], wire: [0, 1, 3, 4, 5] };
  PARTS.pendulum = { pivot: [0], bob: [1, 2], swing: [3, 4, 5] };
  MOTION.pendulum = { effect: 'ring', parts: ['bob'], origin: P };
}
// Spring and mass: the ceiling, the coil hanging from it and the physics diagrams' block.
{
  const coil = rl([[12, 3], [12, 4.5], [14.5, 5.25], [9.5, 6.75], [14.5, 8.25], [9.5, 9.75], [14.5, 11.25], [12, 12], [12, 13.25]], 0.4);
  add('spring-mass', ['resorte y masa', 'ley de hooke', 'oscilación', 'elasticidad', 'spring mass', 'hooke law', 'oscillation'], [hl(3, 6.5, 17.5), coil, block(8.75, 13.25, 6.5)]);
  FILL['spring-mass'] = { solid: [2], wire: [0, 1] };
  PARTS['spring-mass'] = { ceiling: [0], spring: [1], mass: [2] };
  MOTION['spring-mass'] = { effect: 'bounce', parts: ['mass'], vector: [0, 1.5] };
}
// Newton's cradle: the frame (a bar on two legs), two balls hanging at rest and touching, the third
// swung out on its string.
{
  const top = 4;
  const frame = rl([[2.75, 19.75], [2.75, top], [21.25, top], [21.25, 19.75]], [0, 1.25, 1.25, 0]);
  const r = 1.6;
  const rest = [13.6, 16.75].map((x) => [x, 15.5]);
  const a = 105;
  const swung = polar(10.45, top, 11.5, a);
  add('newtons-cradle', ['péndulo de newton', 'momento', 'energía', 'física', 'newtons cradle', 'momentum', 'energy transfer'], [frame, ...rest.map(([x, y]) => vl(x, top, y - r)), ...rest.map((c) => circ(...c, r)), line([10.45, top], polar(10.45, top, 11.5 - r, a)), circ(...swung, r)]);
  FILL['newtons-cradle'] = { solid: [3, 4, 6], wire: [0, 1, 2, 5] };
  PARTS['newtons-cradle'] = { frame: [0], balls: [1, 2, 3, 4], swing: [5, 6] };
  MOTION['newtons-cradle'] = { effect: 'ring', parts: ['swing'], origin: [10.45, top] };
}
// Inclined plane: the wedge, the block resting on its slope and the angle's arc at the low corner.
{
  const [A, B, C] = [[2.75, 19.25], [21.25, 19.25], [21.25, 8.25]];
  const th = Math.atan2(A[1] - C[1], C[0] - A[0]);
  const u = [Math.cos(th), -Math.sin(th)];
  const n = [-Math.sin(th), -Math.cos(th)];
  const P0 = add2(A, mul(u, 9.75));
  const P1 = add2(P0, mul(u, 6.5));
  const blk = roundpoly([P0, P1, add2(P1, mul(n, 6.5)), add2(P0, mul(n, 6.5))], 1.5);
  add('inclined-plane', ['plano inclinado', 'pendiente', 'fuerzas', 'máquina simple', 'inclined plane', 'slope', 'simple machine'], [roundpoly([A, B, C], 0.75), blk, arc(...A, 6.5, (-th * 180) / Math.PI, 0).d]);
  FILL['inclined-plane'] = { solid: [1], wire: [0, 2] };
  PARTS['inclined-plane'] = { wedge: [0], block: [1], angle: [2] };
  MOTION['inclined-plane'] = { effect: 'slide', parts: ['block'], vector: [-1.5, 0.9] };
}
// Projectile motion: the dashed parabola from the ground at the left down to the right, the ball on it
// just past its peak.
{
  const [x0, x1, yg, top] = [3.5, 20.5, 19.5, 6.25];
  const P = (x) => [x, yg - (yg - top) * (1 - ((x - (x0 + x1) / 2) / ((x1 - x0) / 2)) ** 2)];
  const xb = 13.75;
  const R = 2;
  // The dashes stop 3 clear of the ball
  const clear = (x) => len(sub(P(x), P(xb))) - R;
  let a = xb;
  while (clear(a) < 3) a -= 0.01;
  let b = xb;
  while (clear(b) < 3) b += 0.01;
  // …and 3 clear of the ground, so no dash ends on it
  let s0 = x0;
  while (P(s0)[1] > yg - 3) s0 += 0.01;
  let s1 = x1;
  while (P(s1)[1] > yg - 3) s1 -= 0.01;
  const path = [...dashes(P, s0, a), ...dashes(P, b, s1)];
  const ix = path.map((_, i) => i + 2);
  add('projectile-motion', ['tiro parabólico', 'trayectoria', 'proyectil', 'balística', 'projectile motion', 'trajectory', 'launch'], [ground(yg), circ(...P(xb), R), ...path]);
  FILL['projectile-motion'] = { solid: [1], wire: [0, ...ix] };
  PARTS['projectile-motion'] = { ground: [0], ball: [1], path: ix };
}
// Circular motion: the dashed circular path round its center, the string to the ball on it and the
// tangent arrow leaving the ball.
{
  const [C, R, r] = [[11, 13], 7.5, 1.75];
  const ball = [C[0] + R, C[1]];
  add('circular-motion', ['movimiento circular', 'fuerza centrípeta', 'rotación', 'órbita', 'circular motion', 'centripetal force', 'rotation'], [dot(...C), line(C, [ball[0] - r, C[1]]), circ(...ball, r), ...arrow([ball[0], C[1] - r], [ball[0], 4.5]), ...dashes((t) => polar(...C, R, t), 55, 280, 6)]);
  FILL['circular-motion'] = { solid: [2], wire: [0, 1, 3, 4], lines: [5, 6, 7, 8, 9, 10] };
  PARTS['circular-motion'] = { center: [0], string: [1], ball: [2], arrow: [3, 4], path: [5, 6, 7, 8, 9, 10] };
  MOTION['circular-motion'] = { effect: 'spin', parts: ['string', 'ball', 'arrow'], origin: C };
}
// Force: the block on its ground, pushed by the arrow from the left.
{
  add('force', ['fuerza', 'empujar', 'leyes de newton', 'física', 'force', 'push', 'newton'], [ground(19.25), block(13.5, 12.75, 6.5), ...arrow([3.25, 14.25], [13.5, 14.25])]);
  FILL.force = { solid: [1], wire: [0, 2, 3] };
  PARTS.force = { ground: [0], block: [1], arrow: [2, 3] };
  MOTION.force = { effect: 'slide', parts: ['block'], vector: [1.5, 0] };
}
// Friction: the block on a rough (sawtooth) ground, pulled by the arrow at its right, and the half
// arrow of friction pointing back from its other side, low along the ground.
{
  const teeth = [];
  for (let i = 0; i <= 12; i++) teeth.push([3 + i * 1.5, i % 2 ? 16 : 14.5]);
  add('friction', ['fricción', 'rozamiento', 'resistencia', 'agarre', 'friction', 'drag', 'grip'], [rl(teeth, 0.25), block(9.5, 8, 6.5), ...arrow([16, 9.5], [21.25, 9.5]), rl([[9.5, 11.5], [3.25, 11.5], [5.37, 9.38]], [0, 0, 0])]);
  FILL.friction = { solid: [1], wire: [0, 2, 3, 4] };
  PARTS.friction = { ground: [0], block: [1], force: [2, 3], friction: [4] };
}
// Velocity: a ball with three speed lines behind it and its vector arrow ahead.
{
  add('velocity', ['velocidad', 'rapidez', 'movimiento', 'vector', 'velocity', 'speed', 'motion'], [circ(11, 12, 3), hl(9, 2.75, 5.75), hl(12, 2.75, 5), hl(15, 2.75, 5.75), ...arrow([17, 12], [21.25, 12])]);
  FILL.velocity = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.velocity = { ball: [0], trail: [1, 2, 3], vector: [4, 5] };
  MOTION.velocity = { effect: 'slide', vector: [2, 0] };
}
// Heat transfer: a bar heated by the flame under its left end, heat rising in waves off its right end.
{
  const wave = (x) => curve((t) => [x + 0.4 * Math.sin(2 * Math.PI * t), 8 - 4.75 * t], 0, 1, 4);
  add('heat-transfer', ['transferencia de calor', 'conducción', 'térmica', 'calor', 'heat transfer', 'conduction', 'thermal'], [sq(2.75, 11, 18.5, 3.5, 1.5), flame([6.5, 19.25], 1.75, [6.75, 17.5]), wave(14), wave(17.25), wave(20.5)]);
  FILL['heat-transfer'] = { solid: [0, 1], lines: [2, 3, 4] };
  PARTS['heat-transfer'] = { bar: [0], flame: [1], heat: [2, 3, 4] };
  MOTION['heat-transfer'] = { effect: 'float', parts: ['heat'], vector: [0, -1.25] };
}
// Electric charge: a positive and a negative charge, and over them two arrows pointing toward each
// other (they attract).
{
  add('electric-charge', ['carga eléctrica', 'positivo', 'negativo', 'electrostática', 'electric charge', 'positive', 'negative'], [circ(6, 15, 4), circ(18, 15, 4), 'M6 14v2M5 15h2', hl(15, 17, 19), ...arrow([3, 5.75], [9.5, 5.75]), ...arrow([21, 5.75], [14.5, 5.75])]);
  FILL['electric-charge'] = { solid: [0, 1], cut: [2, 3], wire: [4, 5, 6, 7] };
  PARTS['electric-charge'] = { charges: [0, 1, 2, 3], arrows: [4, 5, 6, 7] };
}
// Wavelength: a sine wave with the dimension bracket over it, from one crest to the next.
{
  const W = (x) => [x, 15.25 - 3 * Math.cos((2 * Math.PI * (x - 7.25)) / 9)];
  add('wavelength', ['longitud de onda', 'frecuencia', 'onda', 'señal', 'wavelength', 'frequency', 'wave'], [curve(W, 2.75, 21.25, 12), `M7.25 5.75V8.75M7.25 7.25H16.25M16.25 5.75V8.75`]);
  FILL.wavelength = false;
  PARTS.wavelength = { wave: [0], measure: [1] };
}
// Converging lens: a tall biconvex lens, two parallel rays in from the left meeting at its focal point.
{
  const [s, half] = [2.5, 8.75];
  const R = (half * half + s * s) / (2 * s);
  const xAt = (y) => 12 - (s - (R - Math.sqrt(R * R - (y - 12) ** 2)));
  const lens = `M12 3.25A${f(R)} ${f(R)} 0 0 1 12 20.75A${f(R)} ${f(R)} 0 0 1 12 3.25Z`;
  add('convex-lens', ['lente convergente', 'lente convexa', 'óptica', 'foco', 'convex lens', 'converging lens', 'optics'], [lens, hl(8.5, 2.75, xAt(8.5)), hl(15.5, 2.75, xAt(15.5)), line([24 - xAt(8.5), 8.5], [21.25, 12], [24 - xAt(15.5), 15.5])]);
  FILL['convex-lens'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['convex-lens'] = { lens: [0], rays: [1, 2, 3] };
}
// Diverging lens: a biconcave lens, two parallel rays in from the left spreading apart behind it.
{
  const [s, half, w] = [1.75, 8.75, 3.25];
  const R = (half * half + s * s) / (2 * s);
  const xAt = (y) => 12 - w - (R - Math.sqrt(R * R - (y - 12) ** 2));
  const lens = `M${f(12 - w - s)} 3.25H${f(12 + w + s)}A${f(R)} ${f(R)} 0 0 0 ${f(12 + w + s)} 20.75H${f(12 - w - s)}A${f(R)} ${f(R)} 0 0 0 ${f(12 - w - s)} 3.25Z`;
  add('concave-lens', ['lente divergente', 'lente cóncava', 'óptica', 'dispersar luz', 'concave lens', 'diverging lens', 'optics'], [lens, hl(8.5, 2.75, xAt(8.5)), hl(15.5, 2.75, xAt(15.5)), line([24 - xAt(8.5), 8.5], [21.25, 5.75]), line([24 - xAt(15.5), 15.5], [21.25, 18.25])]);
  FILL['concave-lens'] = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS['concave-lens'] = { lens: [0], rays: [1, 2, 3, 4] };
}
// Reflection: the mirror's line and its dashed normal; the incoming ray meets it and leaves at the same
// angle.
{
  const M = [12, 18.5];
  const inc = [3.75, 10.25];
  const out = [20.25, 10.25];
  const d = unit(sub(M, inc));
  const mid = lerp(inc, M, 0.5);
  add('light-reflection', ['reflexión', 'espejo', 'ángulo de incidencia', 'óptica', 'light reflection', 'mirror', 'optics'], [hl(18.5, 2.75, 21.25), ...dashLine([12, 4.25], [12, 13.75], 2), line(inc, M, out), head(add2(mid, mul(d, 1.5)), d, HEAD), head(out, sub(out, M), HEAD)]);
  FILL['light-reflection'] = false;
  PARTS['light-reflection'] = { mirror: [0], normal: [1, 2], ray: [3, 4, 5] };
}
// Refraction: the boundary and its dashed normal; the ray crosses it and bends toward the normal.
{
  const O = [12, 12];
  const inc = [4.25, 4.25];
  const outEnd = [12 + 8.75 * Math.tan(rad(25)), 20.75];
  add('light-refraction', ['refracción', 'luz', 'agua', 'óptica', 'light refraction', 'bending light', 'optics'], [hl(12, 2.75, 21.25), vl(12, 3.25, 7.75), vl(12, 19.25, 21.25), line(inc, O, outEnd), head(lerp(inc, O, 0.6), sub(O, inc), HEAD)]);
  FILL['light-refraction'] = false;
  PARTS['light-refraction'] = { boundary: [0], normal: [1, 2], ray: [3, 4] };
}
// Dispersion: a prism, one ray of white light entering its left face and three fanning out of its right.
{
  const [T, BL, BRc] = [[11, 6], [4.5, 17.25], [17.5, 17.25]];
  const pin = lerp(BL, T, 0.55);
  const pout = lerp(BRc, T, 0.5);
  add('light-dispersion', ['dispersión', 'prisma', 'espectro', 'arcoíris', 'light dispersion', 'prism', 'spectrum'], [roundpoly([T, BRc, BL], 1), line([2, 13.25], pin), line(pin, pout), ...[9.75, 12.75, 15.75].map((y) => line(pout, [21.25, y]))]);
  FILL['light-dispersion'] = { solid: [0], wire: [1, 3, 4, 5], cut: [2] };
  PARTS['light-dispersion'] = { prism: [0], light: [1, 2], spectrum: [3, 4, 5] };
}
// Electromagnetic spectrum: a wide band with a wave in it, its wavelength shortening steadily from left
// to right.
{
  const [a, b] = [Math.PI / 4.5, (Math.PI / 2.75 - Math.PI / 4.5) / 26];
  const W = (x) => [x, 12 - 2 * Math.sin(a * (x - 5.5) + b * (x - 5.5) ** 2)];
  add('electromagnetic-spectrum', ['espectro electromagnético', 'longitudes de onda', 'radio', 'rayos gamma', 'electromagnetic spectrum', 'wavelengths', 'radiation'], [sq(2.5, 7, 19, 10, 3), curve(W, 5.5, 18.5, 20)]);
  FILL['electromagnetic-spectrum'] = { solid: [0], cut: [1] };
  PARTS['electromagnetic-spectrum'] = { band: [0], wave: [1] };
}

// ── The nucleus ───────────────────────────────────────────────────────────────────────────────
// Nuclear fusion: two small nuclei arriving on converging arrows and the larger one they make.
{
  const C = [17.5, 12];
  const sm = [[4, 6], [4, 18]];
  const tips = [[11, 8.5], [11, 15.5]];
  const arrows = sm.flatMap((c, i) => arrow(add2(c, mul(unit(sub(tips[i], c)), 1.75)), tips[i]));
  add('nuclear-fusion', ['fusión nuclear', 'unir núcleos', 'energía de fusión', 'estrellas', 'nuclear fusion', 'fusion energy', 'stellar'], [...sm.map((c) => circ(...c, 1.75)), ...arrows, circ(...C, 4.25)]);
  FILL['nuclear-fusion'] = { solid: [0, 1, 6], wire: [2, 3, 4, 5] };
  PARTS['nuclear-fusion'] = { nuclei: [0, 1], arrows: [2, 3, 4, 5], product: [6] };
  MOTION['nuclear-fusion'] = { effect: 'beat', parts: ['product'], origin: C };
}
// Radioactive decay: a small packed nucleus of three circles giving off a wavy ray and a particle.
{
  const nuc = [[6, 16.15], [10, 16.15], [8, 12.69]];
  const [a, b] = [[12.75, 11], [19.25, 4.75]];
  const d = unit(sub(b, a));
  const n = [-d[1], d[0]];
  const L = len(sub(b, a));
  const ray = curve((t) => add2(add2(a, mul(d, L * t)), mul(n, 0.75 * Math.sin(4 * Math.PI * t))), 0, 1, 8);
  add('radioactive-decay', ['desintegración radiactiva', 'radiación', 'núcleo inestable', 'física nuclear', 'radioactive decay', 'radiation', 'unstable nucleus'], [...nuc.map((c) => circ(...c, 2)), ray, head(b, d, HEAD), dot(15.5, 17.75), ...arrow([15.5, 17.75], [21.25, 17.75])]);
  FILL['radioactive-decay'] = { solid: [0, 1, 2], lines: [3, 4], wire: [5, 6, 7] };
  PARTS['radioactive-decay'] = { nucleus: [0, 1, 2], ray: [3, 4], particle: [5, 6, 7] };
  MOTION['radioactive-decay'] = { effect: 'beat', parts: ['nucleus'], origin: [8, 15] };
}
// Half-life: the axes, a curve falling steeply and flattening, and the dashed lines marking its half.
{
  const k = 0.1;
  const D = (x) => [x, 17.25 - 13 * Math.exp(-k * (x - 3.25))];
  const xh = 3.25 + Math.log(2) / k;
  add('half-life', ['vida media', 'decaimiento exponencial', 'datación', 'eliminación', 'half-life', 'exponential decay', 'radiometric dating'], [rl([[3.25, 3.25], [3.25, 20.75], [20.75, 20.75]], [0, 1, 0]), curve(D, 3.25, 20.75, 8), ...dashLine([3.25, 10.75], [xh, 10.75], 2, 2.9), ...dashLine([xh, 10.75], [xh, 20.75], 2)]);
  FILL['half-life'] = false;
  PARTS['half-life'] = { axes: [0], curve: [1], half: [2, 3, 4, 5] };
}

// ── Air and earth ─────────────────────────────────────────────────────────────────────────────
// Aerodynamics: a teardrop body in profile, the flow bending round it above and below and trailing off
// its tail.
{
  const [C, R, T] = [[9.25, 12], 3, [17, 12]];
  const a = Math.acos(R / (T[0] - C[0]));
  const up = [C[0] + R * Math.cos(a), C[1] - R * Math.sin(a)];
  const body = `M${pt(up)}A${R} ${R} 0 1 0 ${pt([up[0], 24 - up[1]])}L${pt(T)}Z`;
  const flow = 'M2.75 7.75C6.5 7.75 7.5 5.75 11 5.75S16.5 7.75 21.25 7.75';
  add('aerodynamics', ['aerodinámica', 'flujo de aire', 'arrastre', 'túnel de viento', 'aerodynamics', 'airflow', 'drag'], [body, flow, flipPath(flow, 'y'), hl(12, 17, 21.25)]);
  FILL.aerodynamics = { solid: [0], lines: [1, 2], wire: [3] };
  PARTS.aerodynamics = { body: [0], flow: [1, 2, 3] };
  MOTION.aerodynamics = { effect: 'slide', parts: ['flow'], vector: [1.5, 0] };
}
// Fossil: an ammonite, its shell coiled in a spiral with short ribs across the outer whorl.
{
  const [C, R1, gap, turns] = [[12, 12], 8.75, 3.25, 2.3];
  const r = (t) => R1 - (gap * -t) / (2 * Math.PI);
  const S = (t) => polar(...C, r(t), (t * 180) / Math.PI);
  const t0 = -turns * 2 * Math.PI;
  const ribs = [-0.55, -1.45, -2.35, -3.25, -4.15, -5.05].map((t) => line(polar(...C, r(t) - gap, (t * 180) / Math.PI), S(t)));
  add('fossil', ['fósil', 'amonita', 'paleontología', 'historia natural', 'fossil', 'ammonite', 'paleontology'], [curve(S, t0, 0, 24), line(S(0), polar(...C, r(0) - gap, 0)), ...ribs]);
  FILL.fossil = false;
  PARTS.fossil = { shell: [0, 1], ribs: [2, 3, 4, 5, 6, 7] };
}
// Crystal: a cluster of three pointed hexagonal columns rising from the base, the middle one tallest and
// in front with its facet line; the side columns show only what the middle one leaves, meeting its
// edges.
{
  const column = (b, w, h, tip, deg) => {
    const P = (x, y) => rot([b[0] + x, b[1] + y], b, deg);
    return { outline: [P(w / 2, 0), P(-w / 2, 0), P(-w / 2, -h), P(0, -h - tip), P(w / 2, -h)], facet: [P(0, -h - tip), P(0, 0)] };
  };
  const [x0, x1] = [9.5, 14.5];
  /** Where the segment a→b crosses the line x = X. */
  const cross = (a, b, X) => lerp(a, b, (X - a[0]) / (b[0] - a[0]));
  /** The part of a closed outline that lies outside the middle column (x < X, or x > X with side 1). */
  const behind = (pts, X, side) => {
    const out = (p) => side * (p[0] - X) > 0;
    const n = pts.length;
    const start = pts.findIndex((p, i) => !out(pts[(i - 1 + n) % n]) && out(p));
    const seq = [cross(pts[(start - 1 + n) % n], pts[start], X)];
    for (let k = 0; k < n; k++) {
      const p = pts[(start + k) % n];
      if (!out(p)) {
        seq.push(cross(pts[(start + k - 1 + n) % n], p, X));
        break;
      }
      seq.push(p);
    }
    return seq;
  };
  const side = (deg, X, s) => {
    const c = column([12 + s * 2.25, 20.25], 4.5, 8, 2.75, deg);
    return behind(c.outline, X, s);
  };
  const [L, R] = [side(-26, x0, -1), side(26, x1, 1)];
  const outline = (pts) => rl(pts, pts.map((_, i) => (i === 0 || i === pts.length - 1 ? 0 : 0.5)));
  const mid = column([12, 20.75], 5, 13, 3.5, 0);
  add('crystal', ['cristal', 'mineral', 'cuarzo', 'geología', 'crystal', 'quartz', 'mineral'], [roundpoly(mid.outline, [0, 0, 0.5, 0.75, 0.5]), line(...mid.facet), outline(L), outline(R)]);
  // Filled, the side columns part from the middle one along the edge they meet
  FILL.crystal = { solid: [0, shut(icons.crystal.d[2]), shut(icons.crystal.d[3])], cut: [1, line(L[0], L.at(-1)), line(R[0], R.at(-1))] };
  PARTS.crystal = { middle: [0, 1], sides: [2, 3] };
}
// Geode: a split rock in section, its rough rounded outline round a ring of crystal teeth of uneven
// sizes pointing into the hollow.
{
  const rock = [9, 8.25, 9.25, 8.5, 9.1, 8.3, 8.9].map((r, i) => polar(12, 12, r, i * (360 / 7) - 80));
  const tips = [3.5, 4, 3.25, 3.75, 3.5, 4.1, 3.4, 3.8, 3.3];
  const teeth = tips.flatMap((r, i) => {
    const a = i * 40 - 90;
    return [polar(12, 12, 5.6, a), polar(12, 12, r, a + 20)];
  });
  add('geode', ['geoda', 'roca', 'minerales', 'geología', 'geode', 'rock', 'minerals'], [smooth(rock), roundpoly(teeth, 0.35)]);
  FILL.geode = { solid: [0], cut: [1] };
  PARTS.geode = { rock: [0], crystals: [1] };
}
// Rock strata: a cut block of ground under its hill, the layers folded into the same arch (an
// anticline). Level wavy layers read as water in a tank; straight ones under a jagged top, as a cake.
{
  const top = (dy) => `C6.5 ${f(10.5 + dy)} 8.5 ${f(4.25 + dy)} 12 ${f(4.25 + dy)}S17.5 ${f(10.5 + dy)} 21.25 ${f(10.5 + dy)}`;
  const block = `M3.75 20.75A1 1 0 0 1 2.75 19.75V10.5${top(0)}V19.75A1 1 0 0 1 20.25 20.75Z`;
  add('rock-strata', ['estratos', 'capas de roca', 'sedimentos', 'geología', 'rock strata', 'sedimentary layers', 'geology'], [block, ...[3.5, 7].map((dy) => `M2.75 ${f(10.5 + dy)}${top(dy)}`)]);
  FILL['rock-strata'] = { solid: [0], cut: [1, 2] };
  PARTS['rock-strata'] = { block: [0], layers: [1, 2] };
}
// Tectonic plates: two slabs meeting along a jagged seam, arrows pushing them toward each other.
{
  add('tectonic-plates', ['placas tectónicas', 'falla', 'sismos', 'geología', 'tectonic plates', 'fault', 'earthquakes'], [sq(2.75, 12.25, 18.5, 7, 1.5), rl([[12, 12.25], [13.25, 14], [11.25, 15.75], [12.75, 17.5], [12, 19.25]], 0.3), ...arrow([3.5, 7.25], [9.5, 7.25]), ...arrow([20.5, 7.25], [14.5, 7.25])]);
  FILL['tectonic-plates'] = { solid: [0], cut: [1], wire: [2, 3, 4, 5] };
  PARTS['tectonic-plates'] = { plates: [0, 1], arrows: [2, 3, 4, 5] };
}

// ── Research and results ──────────────────────────────────────────────────────────────────────
// Research paper: nucleo's document with a full-width title, the authors' shorter line under it and
// two columns of text.
{
  const head = [hl(7.5, 8.25, 15.75), hl(10.5, 10.5, 13.5)];
  const cols = [13.75, 17].flatMap((y) => [hl(y, 8.25, 10.25), hl(y, 13.75, 15.75)]);
  add('research-paper', ['artículo científico', 'publicación', 'revista', 'preprint', 'research paper', 'journal article', 'publication'], [DOC, ...head, ...cols]);
  FILL['research-paper'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['research-paper'] = { page: [0], title: [1, 2], text: [3, 4, 5, 6] };
  // With the search badge: the lines the badge would clear are left out, so no stub remains
  add('research-paper-search', ['buscar artículos', 'búsqueda bibliográfica', 'referencias', 'literatura', 'literature search', 'find papers', 'references'], [DOC, ...head, cols[0]], { badge: badge('search') });
  FILL['research-paper-search'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['research-paper-search'] = { page: [0], title: [1, 2], text: [3] };
  MOTION['research-paper-search'] = BADGE_MOTION.search;
}
// Experiment passed, sample approved, sample rejected: datos' flask and test tube with the engine's
// badges.
for (const [name, base, kind, tags] of [
  ['flask-check', 'flask', 'check', ['experimento exitoso', 'resultado significativo', 'validado', 'laboratorio', 'experiment passed', 'validated', 'significant result']],
  ['test-tube-check', 'test-tube', 'check', ['muestra aprobada', 'control de calidad', 'aprobado', 'laboratorio', 'sample approved', 'quality control', 'passed']],
  ['test-tube-x', 'test-tube', 'x', ['muestra rechazada', 'no conforme', 'rechazado', 'laboratorio', 'sample rejected', 'failed test', 'rejected']],
]) {
  // The tube sits 1 left and 0.75 up, clear of the badge's corner (its round bottom cut cleanly at
  // every weight), as salud's pill-* do; the flask stays where it is
  const src = datos.icons[base];
  const T = base === 'test-tube' ? (d) => place(d, 1, [12, 12], [11, 11.25]) : (d) => d;
  const fill = Object.fromEntries(Object.entries(src.fill).map(([k, v]) => [k, v.map(T)]));
  add(name, tags, src.d.map(T), { badge: badge(kind), fill });
  PARTS[name] = { body: [0, 1], level: [2] };
  MOTION[name] = BADGE_MOTION[kind];
}

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing; these didn't read after it (wells, colonies and bands that ran
// together, curves that turned grey, ribs that made a mesh). Each keeps
// fewer pieces, at least a pixel
// apart, the new strokes on pixel centers (0.75 + 1.5k).
{
  const small = (name, d, fill) => {
    icons[name].small = { d, ...(fill && { fill }) };
  };
  // Microplate: the plate and a 3 × 4 grid of one-pixel wells, two pixels apart
  {
    const plate = roundpoly([[5.25, 5.25], [21.75, 5.25], [21.75, 18.75], [2.25, 18.75], [2.25, 8.25]], [0.5, 1.5, 0, 1.5, 0.5]);
    const wells = [];
    for (const y of [8.25, 11.25, 14.25]) for (const x of [8.25, 11.25, 14.25, 17.25]) wells.push(dot(x, y, 0.3));
    small('microplate', [plate, ...wells], { solid: [plate], cut: wells });
  }
  // Petri dish: the dish and two colonies, a pixel each
  {
    const d = [icons['petri-dish'].d[0], icons['petri-dish'].d[1], dot(8.25, 11.25, 0.3), dot(14.25, 9.75, 0.3)];
    small('petri-dish', d, { solid: [d[0]], cut: d.slice(1) });
  }
  // Gel: the wells and five bands of three pixels, never side by side in the same row
  {
    const gel = sq(3.75, 2.25, 16.5, 19.5, 3, BR);
    const wells = [6.75, 11.25, 15.75].map((x) => dot(x, 5.25, 0.3));
    const bands = [[6.75, 9.75], [6.75, 15.75], [11.25, 12.75], [11.25, 18.75], [15.75, 9.75]].map(([x, y]) => hl(y, x - 1.5, x + 1.5));
    small('gel-electrophoresis', [gel, ...wells, ...bands], { solid: [gel], cut: [...wells, ...bands] });
  }
  // Fossil: the coil as a rounded square spiral, its turns two pixels apart on the pixel grid, the
  // aperture closing its last turn
  {
    const P = [[12.75, 11.25], [14.25, 11.25], [14.25, 14.25], [9.75, 14.25], [9.75, 8.25], [17.25, 8.25], [17.25, 17.25], [6.75, 17.25], [6.75, 5.25], [20.25, 5.25], [20.25, 20.25], [3.75, 20.25], [3.75, 11.25]];
    const coil = rl(P, P.map((_, i) => [0, 0.75, 1, 1.25, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.25, 0][i]));
    small('fossil', [coil, hl(11.25, 3.75, 6.75)]);
  }
  // Rock strata: the hill and its two folded layers with 45° flanks, three pixels apart
  {
    const fold = (y) => rl([[2.25, y], [6.75, y], [11.25, y - 4.5], [12.75, y - 4.5], [17.25, y], [21.75, y]], [0, 0.5, 0.5, 0.5, 0.5, 0]);
    const block = `${rl([[3.25, 20.25], [2.25, 20.25], [2.25, 8.25], [6.75, 8.25], [11.25, 3.75], [12.75, 3.75], [17.25, 8.25], [21.75, 8.25], [21.75, 20.25], [3.25, 20.25]], [0, 0.75, 0, 0.5, 0.5, 0.5, 0.5, 0, 0.75, 0])}Z`;
    const d = [block, fold(12.75), fold(17.25)];
    small('rock-strata', d, { solid: [d[0]], cut: [d[1], d[2]] });
  }
  // Electron shells: the nucleus and one shell with its two electrons, each in its gap
  {
    const g = (2 * Math.asin(3.3 / 16.5) * 180) / Math.PI;
    const d = [circ(12, 12, 2.25), arc(12, 12, 8.25, -45 + g, 135 - g).d, arc(12, 12, 8.25, 135 + g, 315 - g).d, dot(...polar(12, 12, 8.25, -45), 0.3), dot(...polar(12, 12, 8.25, 135), 0.3)];
    small('electron-shells', d, { solid: [d[0], d[3], d[4]], wire: [d[1], d[2]] });
  }
  // Plant cell: the wall and the nucleus, without the membrane (two slanted lines a pixel apart turn
  // grey)
  {
    const d = [icons['plant-cell'].d[0], icons['plant-cell'].d[2]];
    small('plant-cell', d, { solid: [d[0]], cut: [d[1]] });
  }
  // Mitochondrion: level, its cristae a meander of three-pixel folds
  {
    const m = 'M6.75 14.25V9.75A1.5 1.5 0 0 1 9.75 9.75V14.25A1.5 1.5 0 0 0 12.75 14.25V9.75A1.5 1.5 0 0 1 15.75 9.75V14.25';
    const d = [sq(2.25, 6.75, 19.5, 10.5, 5.25), m];
    small('mitochondrion', d, { solid: [d[0]], cut: [d[1]] });
  }
  // Animal cell: the membrane and the nucleus with its nucleolus, without the organelle
  {
    const d = icons['animal-cell'].d.slice(0, 3);
    small('animal-cell', d, { solid: [d[0]], cut: [d[1], d[2]] });
  }
}

// ── Fill, parts, motion, mirror, levels, variants ─────────────────────────────────────────────
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

// Mirror: what moves one way flips in right-to-left languages (the motion diagrams); the glassware,
// the optics and the chemistry keep their sides
for (const name of ['force', 'friction', 'velocity', 'projectile-motion']) icons[name].mirror = true;

// Variants: a slash through lone lines says nothing; with a badge the enclosures lose the piece on top
for (const name of ['reversible-reaction', 'wavelength']) icons[name].variants = { slash: false };
// Round already (the shells, the rock, the shell, the cell): no circle around them
for (const name of ['electron-shells', 'geode', 'fossil', 'animal-cell']) icons[name].variants = { ...icons[name].variants, circle: false };
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };

export default { category: 'ciencia', label: 'Ciencia y laboratorio', icons };
