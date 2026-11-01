// Construction and architecture: cranes and the site, earthworks and foundations, the building
// stages (framing, roofing, renovation, demolition), structural pieces and materials, drawings,
// plumbing and electrical work. Everything is computed with the engine (engine/geometry.mjs) and
// the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a square bottom-right
// corner on containers. Shared constructions:
// - Buildings stand on lugares' ground line (GROUND, 20.75) and take the house's roof pitch (PITCH:
//   7.75 down for 9.25 across); house-* is lugares' `house`, stroke for stroke (checked below).
// - The tower crane, the scaffolding and the building frame share one lattice (LAT): chords 4 apart
//   joined by a zigzag whose triangles keep a hole at every weight.
// - The plumbing shares one household pipe (PIPE): walls 4.5 apart, sockets 7.5 wide; industria's
//   pipeline is heavier on purpose (6).
// - The electrical pieces share one box: the square bottom-right corner, r 2.5.
// Whatever passes in front of another piece goes in `badge` and the engine clears it.
import { arc, badge, circ, dot, f, halfChord, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import lugares from './lugares.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as lugares'. */
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

/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** An ellipse (rotated `deg` around its center). */
const ellipse = (cx, cy, rx, ry, deg = 0) => {
  const d = `M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx - rx, cy])}Z`;
  return deg ? turnPath(d, deg, [cx, cy]) : d;
};

/**
 * A polyline run on past its ends by `e`: a cut that reaches the silhouette goes through it at every
 * weight (DESIGN.md › Every weight, one structure).
 */
const beyond = (pts, e = 1.5) => {
  const a = add(pts[0], mul(unit(sub(pts[0], pts[1])), e));
  const n = pts.length;
  const b = add(pts[n - 1], mul(unit(sub(pts[n - 1], pts[n - 2])), e));
  return line(a, ...pts.slice(1, -1), b);
};

/**
 * A dashed polyline: each straight run gets its gaps (3 wide, so the dash ends keep 1.5 of
 * clearance) in its middle and the dashes cover every corner, as bienes-raices' dashed house.
 */
function dashed(pts, { closed = false, dash = 3, gap = 3, r = 0.75 } = {}) {
  const P = closed ? [...pts, pts[0]] : pts;
  const runs = [];
  let cur = [P[0]];
  for (let i = 0; i < P.length - 1; i++) {
    const [A, B] = [P[i], P[i + 1]];
    const L = len(sub(B, A));
    let m = Math.max(0, Math.round((L - dash) / (dash + gap)));
    while (m && (L - m * gap) / (m + 1) < 2) m--;
    const dl = (L - m * gap) / (m + 1);
    for (let k = 0; k < m; k++) {
      const s0 = (k + 1) * dl + k * gap;
      cur.push(lerp(A, B, s0 / L));
      runs.push(cur);
      cur = [lerp(A, B, (s0 + gap) / L)];
    }
    cur.push(B);
  }
  if (closed && runs.length) runs[0] = [...cur, ...runs[0].slice(1)];
  else runs.push(cur);
  return runs.map((run) => roundline(run, run.map((_, i) => (i && i < run.length - 1 ? r : 0))));
}

// ── The ground and the house (lugares) ────────────────────────────────────────────────────────
// lugares' buildings stand on one ground line (GROUND, from 2.75 to 21.25) and gabled roofs take
// the house's pitch. `house()` with no arguments is lugares' house, stroke for stroke.
const GROUND = 20.75;
const PITCH = 7.75 / 9.25;
const ground = (x0 = 2.75, x1 = 21.25, y = GROUND) => line([x0, y], [x1, y]);
function house({ apex = [12, 3.5], half = 9.25, eaves = 2.5, base = 20.75, rb = 2.5, ra = 1.25 } = {}) {
  const roofAt = (x) => apex[1] + Math.abs(x - apex[0]) * PITCH;
  const [x0, x1] = [apex[0] - half, apex[0] + half];
  const [xl, xr] = [x0 + eaves, x1 - eaves];
  const roof = roundline([[x0, roofAt(x0)], apex, [x1, roofAt(x1)]], [0, ra, 0]);
  const walls = roundline([[xl, roofAt(xl)], [xl, base], [xr, base], [xr, roofAt(xr)]], [0, rb, 0, 0]);
  const door = roundline([[apex[0] - 1.75, base], [apex[0] - 1.75, base - 4.5], [apex[0] + 1.75, base - 4.5], [apex[0] + 1.75, base]], [0, 1.25, 1.25, 0]);
  return { roof, walls, door, window: circ(apex[0], 9.75, 1.25), roofAt, xl, xr, x0, x1, apex, base };
}
const H = house();
{
  const ref = lugares.icons.house.d;
  if ([H.roof, H.walls, H.door, H.window].some((d, i) => d !== ref[i])) throw new Error('construccion: house() no longer matches lugares/house');
}

// ── The lattice ───────────────────────────────────────────────────────────────────────────────
// One lattice for the crane's mast, the scaffolding's bracing and the building frame: chords LAT
// apart and a zigzag that meets them every 2 × step, so each triangle (7.75 × 4 at most) keeps a
// hole of r ≥ 1.6 (0.55 clear at 2.1).
const LAT = 4;
/** A zigzag between two vertical chords xl and xr, from y0 (at xl) to y1, in n diagonals. */
const zigzag = (xl, xr, y0, y1, n) => line(...Array.from({ length: n + 1 }, (_, i) => [i % 2 ? xr : xl, y0 + ((y1 - y0) * i) / n]));

// ── The crane's hook ──────────────────────────────────────────────────────────────────────────
/** A crane hook: the shank at cx + r from y0 down to y1, the bowl round under it and a short tip up. */
const hook = (cx, y0, y1, r = 1.5) => `M${pt([cx + r, y0])}V${f(y1)}A${halfChord([cx + r, y1], [cx - r, y1])} ${halfChord([cx + r, y1], [cx - r, y1])} 0 0 1 ${pt([cx - r, y1])}V${f(y1 - 0.75)}`;

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};

// ── Cranes and the site ──
// Tower crane: the lattice mast standing on its base, the jib to the right, the counter-jib to the
// left with the counterweight hanging under it, and the hook on its line.
{
  const [xl, xr, top] = [8.5, 8.5 + LAT, 5.25];
  icons['tower-crane'] = {
    tags: ['grúa torre', 'grúa', 'obra', 'construcción', 'tower crane', 'crane', 'construction'],
    d: [
      line([xl, GROUND], [xl, top]),
      line([xr, GROUND], [xr, top]),
      zigzag(xl, xr, GROUND, top, 4),
      line([2.75, top], [21.25, top]),
      sq(2.75, top, 2.75, 4, 0.75),
      ground(4.75, 16.25),
      hook(17.75, top, 11.25),
    ],
  };
}
// Crane lift: the hook on its line, two slings fanning down to a steel beam seen in perspective.
{
  const beam = roundpoly([[2.75, 15.75], [5.75, 13.25], [21.25, 13.25], [21.25, 17], [18.25, 19.5], [2.75, 19.5]], [0.75, 0.75, 0.75, 0.75, 0.75, 0.75]);
  const edges = line([2.75, 15.75], [18.25, 15.75], [21.25, 13.25]);
  icons['crane-lift'] = {
    tags: ['izaje', 'maniobra', 'carga', 'grúa', 'crane lift', 'hoisting', 'lifting'],
    d: [beam, edges, line([18.25, 15.75], [18.25, 19.5]), hook(12, 1.75, 6, 1.75), line([12, 7.75], [7, 13.25]), line([12, 7.75], [17, 13.25])],
  };
}
// Scaffolding: two bays two levels high: the standards on their base plates, a ledger (the plank's
// level) at each level and a brace in each, crossing the bays the other way on each level.
{
  const xs = [5, 12, 19];
  icons.scaffolding = {
    tags: ['andamio', 'andamiaje', 'trabajo en altura', 'scaffolding', 'scaffold', 'access'],
    d: [
      xs.map((x) => `M${pt([x, 3.25])}V${f(GROUND)}`).join(''),
      line([5, 3.25], [19, 3.25]),
      line([5, 12], [19, 12]),
      line([5, GROUND], [12, 12]),
      line([12, 12], [19, 3.25]),
      xs.map((x) => `M${pt([x - 1.5, GROUND])}H${f(x + 1.5)}`).join(''),
    ],
  };
}
// Construction site: the hoarding's panels across the bottom and the tower crane rising behind it.
{
  const [xl, xr, top, low] = [8.5, 8.5 + LAT, 4.25, 12.75];
  icons['construction-site'] = {
    tags: ['obra', 'sitio de obra', 'proyecto', 'construcción', 'construction site', 'job site', 'project'],
    d: [
      sq(4.25, 16.25, 15.5, 4.5, 1.25),
      'M9.42 16.25V20.75M14.58 16.25V20.75',
      line([xl, low], [xl, top]),
      line([xr, low], [xr, top]),
      zigzag(xl, xr, low, top, 2),
      line([2.75, top], [21.25, top]),
      sq(2.75, top, 2.75, 3.25, 0.75),
      hook(17.75, top, 9.25),
    ],
  };
}
// Wheelbarrow: the tub over its front wheel (a fork to the axle), the handle back to the right and
// the leg under the tub.
icons.wheelbarrow = {
  tags: ['carretilla', 'acarreo', 'obra', 'jardinería', 'wheelbarrow', 'barrow', 'landscaping'],
  d: [
    roundpoly([[2.75, 6.5], [16.75, 6.5], [13.5, 11.75], [7.5, 11.75]], [1, 1, 1.25, 1.25]),
    line([16.75 - (3 / 5.25) * 3.25, 9.5], [21.25, 9.5]),
    circ(6.75, 17.75, 3),
    line([9, 11.75], [6.75, 17.75]),
    line([12.75, 11.75], [14, GROUND]),
  ],
};
// Plumb bob: the bar, the line and the bob, a short cylinder tapering to its point.
icons['plumb-bob'] = {
  tags: ['plomada', 'plomo', 'vertical', 'nivelación', 'plumb bob', 'plumb line', 'setting out'],
  d: [line([8.5, 2.75], [15.5, 2.75]), line([12, 2.75], [12, 10]), roundpoly([[9, 10], [15, 10], [15, 14], [12, 21.5], [9, 14]], [0.9, 0.9, 0.75, 0.5, 0.75])],
};
// Trowel: the diamond blade from above, the tang and the round handle, laid on the diagonal.
{
  const up = (d) => turnPath(d, -45, [12, 12]);
  icons.trowel = {
    tags: ['llana', 'cuchara de albañil', 'albañilería', 'mezcla', 'trowel', 'masonry', 'bricklaying'],
    d: [up(roundpoly([[0.75, 12], [9.5, 7.25], [11.75, 12], [9.5, 16.75]], [0.6, 1.25, 0.75, 1.25])), up(line([11.75, 12], [14.5, 12])), up(sq(14.5, 10.25, 8, 3.5, 1.75))],
  };
}
// Groundbreaking: a shovel planted at an angle in a mound of earth; the mound passes in front of
// the blade and the engine clears it.
{
  const lean = (d) => turnPath(d, 20, [12, 18]);
  const mound = 'M4.25 20.75C5.25 16.75 8.5 15.25 12 15.25S18.75 16.75 19.75 20.75';
  icons.groundbreaking = {
    tags: ['inicio de obra', 'primera piedra', 'arranque', 'groundbreaking', 'kickoff', 'first milestone'],
    d: [lean(roundpoly([[8.75, 11.75], [15.25, 11.75], [15.25, 16.5], [12, 20.5], [8.75, 16.5]], [0.75, 0.75, 1.5, 1, 1.5])), lean(line([12, 11.75], [12, 5.75])), lean(sq(9.5, 2.75, 5, 3, 1.25))],
    badge: { d: [mound, ground()], knock: `${mound}Z`, fill: { solid: [`${mound}Z`], wire: [ground()] } },
  };
}
// Gravel: a low heap on the ground with two pebbles and a few grains in it.
icons.gravel = {
  tags: ['grava', 'arena', 'agregados', 'material a granel', 'gravel', 'aggregate', 'sand'],
  d: [
    ground(),
    'M3.25 20.75C4.75 13.75 8.25 9.75 12 9.75S19.25 13.75 20.75 20.75',
    ellipse(9.5, 16.75, 2, 1.4, -10),
    dot(15, 17.25),
    dot(13.25, 13),
  ],
};
// Wrecking ball: the cable from the top left and the ball swinging into a wall whose top corner
// has broken into loose blocks.
{
  const pivot = [3.25, 2.75];
  const C = [7.25, 14.25];
  const R = 3.5;
  const u = unit(sub(pivot, C));
  icons['wrecking-ball'] = {
    tags: ['demolición', 'bola de demolición', 'derribo', 'wrecking ball', 'demolition', 'tear down'],
    d: [
      roundline([[14.25, GROUND], [14.25, 13], [17, 13], [17, 10], [21.25, 10], [21.25, GROUND], [14.25, GROUND]], [0, 0.75, 0.75, 0.75, 0.75, 0, 0]),
      `M14.25 16.75H21.25M17.75 16.75V${f(GROUND)}`,
      roundpoly([[11.75, 5.75], [14.5, 5], [15.25, 7.75], [12.5, 8.5]], 0.6),
      roundpoly([[18.5, 3.5], [21, 4.75], [19.75, 7.25], [17.25, 6]], 0.6),
      circ(...C, R),
      line(pivot, add(C, mul(u, R))),
    ],
  };
}

// ── Foundations and the stages of a building ──
// Foundation: lugares' house (its pitch) standing on the ground and, under the ground in section,
// its foundation: the slab and a footing at each end.
const FOUNDATION = (() => {
  const y = 13.75;
  const h = house({ apex: [12, 3.25], half: 7.75, eaves: 2, base: y });
  const walls = `M${pt([h.xl, h.roofAt(h.xl)])}V${f(y)}M${pt([h.xr, h.roofAt(h.xr)])}V${f(y)}`;
  // Every run of the outline is at least 3 long, so its corners stay apart at 2.1
  const slab = roundline([[4.75, y], [4.75, GROUND], [9.75, GROUND], [9.75, 17.75], [14.25, 17.75], [14.25, GROUND], [19.25, GROUND], [19.25, y]], [0, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0]);
  // Filled: the house down to the ground
  const body = roundpoly([[h.xl, y], [h.xl, h.roofAt(h.xl)], [h.x0, h.roofAt(h.x0)], h.apex, [h.x1, h.roofAt(h.x1)], [h.xr, h.roofAt(h.xr)], [h.xr, y]], [0, 0, 0, 1.25, 0, 0, 0]);
  return { d: [h.roof, walls, ground(2.75, 21.25, y), slab], body };
})();
icons['building-foundation'] = {
  tags: ['cimentación', 'cimientos', 'zapatas', 'losa', 'foundation', 'footings', 'foundation repair'],
  d: FOUNDATION.d,
};
// House frame: lugares' roof and walls, the top plate at the eaves, the studs under it (bays of 4.5),
// one brace, and the king post up to the ridge.
{
  const plate = 12.75;
  // Where the ridge's rounding crosses the house's axis
  const ridge = H.apex[1] + 1.25 / Math.sin(Math.PI / 2 - Math.atan(PITCH)) - 1.25;
  const studs = [9.75, 14.25].map((x) => `M${pt([x, plate])}V${f(GROUND)}`).join('');
  icons['house-frame'] = {
    tags: ['estructura de casa', 'armazón', 'obra negra', 'vivienda nueva', 'house frame', 'framing', 'new home'],
    d: [H.roof, H.walls, line([H.xl, plate], [H.xr, plate]), studs, line([9.75, GROUND], [14.25, plate]), line([12, plate], [12, ridge])],
  };
}
// Building frame: four columns on the ground and three floor slabs, the top bay unfinished (its
// slab stops at the third column and the last column falls short).
{
  const xs = [5, 9.67, 14.33, 19];
  icons['building-frame'] = {
    tags: ['estructura', 'esqueleto', 'obra gris', 'edificio en obra', 'building frame', 'structure', 'steel frame'],
    d: [
      ground(3.5, 20.5),
      xs.map((x, i) => `M${pt([x, GROUND])}V${f(i === 3 ? 7.25 : 4.25)}`).join(''),
      line([5, 15.25], [19, 15.25]),
      line([5, 9.75], [19, 9.75]),
      line([5, 4.25], [14.33, 4.25]),
    ],
  };
}

// House renovation: lugares' roof and walls, the left half finished (lugares' round window in it)
// and the right half bare: the studs at the house's axis and in the right bay, and one brace.
{
  const ridge = H.apex[1] + 1.25 / Math.sin(Math.PI / 2 - Math.atan(PITCH)) - 1.25;
  icons['house-renovation'] = {
    tags: ['remodelación', 'renovación', 'reforma', 'obra en casa', 'house renovation', 'remodel', 'home improvement'],
    d: [H.roof, H.walls, `M12 ${f(ridge)}V${f(GROUND)}M15.38 ${f(H.roofAt(15.38))}V${f(GROUND)}`, line([12, GROUND], [15.38, 11]), circ(8.5, 13, 1.25)],
  };
}
// House extension: a smaller house of lugares' pitch and eaves to the left, the lower addition to its
// right dashed.
{
  const h = house({ apex: [9.5, 3.5], half: 6.75 });
  icons['house-extension'] = {
    tags: ['ampliación', 'extensión', 'anexo', 'licencia de obra', 'house extension', 'home addition', 'extension'],
    d: [h.roof, h.walls, h.window, ...dashed([[h.xr, 13.5], [20.75, 13.5], [20.75, GROUND], [h.xr + 3, GROUND]])],
  };
}
// Modular building: the bottom module on the ground and the top one hanging just above it from the
// crane's hook on two slings.
icons['modular-building'] = {
  tags: ['construcción modular', 'prefabricado', 'módulos', 'modular building', 'prefab', 'modular construction'],
  d: [sq(3.75, 15.25, 16.5, 5.5, 0.75), sq(3.75, 8.25, 16.5, 4, 0.75), hook(12, 1.75, 4, 1.5), line([12, 5.5], [5.75, 8.25]), line([12, 5.5], [18.25, 8.25])],
};
// Bricklaying: courses of bricks stepping down to the right, unfinished, and one brick being laid
// above the top step.
{
  const L = 6.17;
  const wall = roundpoly([[2.75, GROUND], [2.75, 11.75], [9.5, 11.75], [9.5, 14.75], [15.5, 14.75], [15.5, 17.75], [21.25, 17.75], [21.25, GROUND]], [0.75, 0.75, 0.75, 0.4, 0.75, 0.4, 0.75, 0.75]);
  const beds = `M2.75 14.75H9.5M2.75 17.75H15.5`;
  const heads = `M6.13 11.75V14.75M${f(2.75 + L)} 14.75V17.75M${f(2.75 + L / 2)} 17.75V${f(GROUND)}M${f(2.75 + 1.5 * L)} 17.75V${f(GROUND)}`;
  icons.bricklaying = {
    tags: ['albañilería', 'pegar ladrillo', 'muro en obra', 'mampostería', 'bricklaying', 'masonry', 'wall building'],
    d: [wall, beds, heads, sq(12.5, 7, 6.25, 3, 0.75)],
  };
}
// Roofing: lugares' roof as the roof covering, a band 3 thick at the house's pitch, its lower
// courses of tiles laid (the joints across it) and its upper part still bare; the walls under it,
// with lugares' corners.
{
  const [A, apex] = [[2.75, 11.25], H.apex];
  const u = unit(sub(apex, A));
  // Down and inward, square to each slope
  const n = [-u[1], u[0]].map(Math.abs);
  const A2 = add(A, mul(n, 3));
  const inner = [12, apex[1] + 3 / Math.cos(Math.atan(PITCH))];
  const band = roundpoly([A, apex, [24 - A[0], A[1]], [24 - A2[0], A2[1]], inner, A2], [0.6, 1.25, 0.6, 0.6, 0.6, 0.6]);
  // `e`: run on past the band's outer edge (the silhouette), for the fill
  const joint = (s, e = 0) => {
    const [p, q] = [add(A, add(mul(u, s), mul(n, -e))), add(A, add(mul(u, s), mul(n, 3)))];
    return `M${pt(p)}L${pt(q)}M${pt([24 - p[0], p[1]])}L${pt([24 - q[0], q[1]])}`;
  };
  const wy = inner[1] + (12 - 6.25) * PITCH;
  const walls = roundline([[6.25, wy], [6.25, GROUND], [17.75, GROUND], [17.75, wy]], [0, 2.5, 0, 0]);
  icons.roofing = {
    tags: ['techado', 'techumbre', 'tejas', 'impermeabilizar techo', 'roofing', 'roofer', 'shingles'],
    d: [band, [3.25, 6.5].map((s) => joint(s)).join(''), walls],
  };
  // Filled: the house solid under its roof, the band's inner edge and the joints cut through (past
  // the silhouette), so the roof stands apart from the walls and its laid tiles show
  const body = roundpoly([[6.25, GROUND], [6.25, wy], inner, [17.75, wy], [17.75, GROUND]], [2.5, 0, 0, 0, 0]);
  icons.roofing.fill = { solid: [band, body], cut: [beyond([A2, inner, [24 - A2[0], A2[1]]]), [3.25, 6.5].map((s) => joint(s, 1.5)).join('')] };
}
// I-beam: the I-shaped end facing out (flanges and web 3 thick) and its length running back up to
// the right: the top flange's face and the flanges' right faces.
{
  const [x0, x1, y0, y1, t] = [2.75, 10.75, 10.75, 20.75, 3];
  const xm = (x0 + x1) / 2;
  const v = [8.5, -6.5];
  const I = roundpoly(
    [[x0, y0], [x1, y0], [x1, y0 + t], [xm + t / 2, y0 + t], [xm + t / 2, y1 - t], [x1, y1 - t], [x1, y1], [x0, y1], [x0, y1 - t], [xm - t / 2, y1 - t], [xm - t / 2, y0 + t], [x0, y0 + t]],
    [0.6, 0.6, 0.4, 0.4, 0.4, 0.4, 0.6, 0.6, 0.4, 0.4, 0.4, 0.4],
  );
  const b = (p) => add(p, v);
  icons['i-beam'] = {
    tags: ['viga', 'viga i', 'perfil de acero', 'acero estructural', 'i-beam', 'steel beam', 'structural steel'],
    d: [I, line([x0, y0], b([x0, y0]), b([x1, y0]), [x1, y0]), line(b([x1, y0]), b([x1, y0 + t]), [x1, y0 + t]), line([x1, y1 - t], b([x1, y1 - t]), b([x1, y1]), [x1, y1])],
  };
}
// Truss: two chords joined at their ends and a zigzag of web members between them.
{
  const [y0, y1] = [8.5, 15.5];
  icons.truss = {
    tags: ['armadura', 'cercha', 'celosía', 'claro largo', 'truss', 'girder', 'bridge truss'],
    d: [sq(2.75, y0, 18.5, y1 - y0, 0), line(...Array.from({ length: 7 }, (_, i) => [2.75 + (18.5 * i) / 6, i % 2 ? y0 : y1]))],
  };
}
// Roof truss: a triangle at the house's pitch, its bottom chord, and a W of web members inside.
{
  const [b, x0, x1] = [16, 2.75, 21.25];
  const top = b - 9.25 * PITCH;
  const q = (x) => [x, b - (x < 12 ? x - x0 : x1 - x) * PITCH];
  icons['roof-truss'] = {
    tags: ['armadura de techo', 'cercha', 'estructura de techo', 'roof truss', 'rafters', 'roof framing'],
    d: [roundpoly([[x0, b], [12, top], [x1, b]], [0.6, 0.6, 0.6]), line(q(7.38), [8.92, b], [12, top + 0.01], [15.08, b], q(16.62))],
  };
  // Filled, the W is cut through the chords at every weight
  const out = (p, from) => add(p, mul(unit(sub(p, from)), 1.5));
  icons['roof-truss'].fill = { solid: [icons['roof-truss'].d[0]], cut: [line(out(q(7.38), [8.92, b]), [8.92, b + 1.5], [12, top - 1.5], [15.08, b + 1.5], out(q(16.62), [15.08, b]))] };
}
// Arch: a semicircular arch of voussoirs with its keystone standing out at the top, on two piers.
{
  const [c, R, r] = [[12, 12.5], 8.5, 4.5];
  const P = (rad, deg) => polar(c[0], c[1], rad, deg);
  const k = 13;
  const outline = `M${pt([c[0] - R, GROUND])}V${f(c[1])}A${R} ${R} 0 0 1 ${pt(P(R, 270 - k))}L${pt(P(R + 1.5, 270 - k))}A${R + 1.5} ${R + 1.5} 0 0 1 ${pt(P(R + 1.5, 270 + k))}L${pt(P(R, 270 + k))}A${R} ${R} 0 0 1 ${pt([c[0] + R, c[1]])}V${f(GROUND)}H${f(c[0] + r)}V${f(c[1])}A${r} ${r} 0 0 0 ${pt([c[0] - r, c[1]])}V${f(GROUND)}Z`;
  const joints = [215, 270 - k, 270 + k, 325].map((a) => line(P(r, a), P(R, a))).join('');
  icons.arch = {
    tags: ['arco', 'dovelas', 'clave', 'arquitectura', 'arch', 'keystone', 'masonry arch'],
    d: [outline, joints, `M${pt([c[0] - R, c[1]])}H${f(c[0] - r)}M${pt([c[0] + r, c[1]])}H${f(c[0] + R)}`],
  };
}
// Dome: a hemisphere on its drum, the cornice between them, one rib, and the lantern on top.
icons.dome = {
  tags: ['cúpula', 'domo', 'bóveda', 'arquitectura', 'dome', 'cupola', 'architecture'],
  d: [
    roundline([[5.25, 15], [5.25, GROUND], [18.75, GROUND], [18.75, 15]], [0, 1, 1, 0]),
    line([3.75, 15], [20.25, 15]),
    `M5 15A7 7 0 0 1 19 15`,
    `M12 8C10 10 9.25 12.5 9.25 15M12 8C14 10 14.75 12.5 14.75 15`,
    roundline([[10.75, 8], [10.75, 4.75], [13.25, 4.75], [13.25, 8]], [0, 0.6, 0.6, 0]),
    line([12, 4.75], [12, 2.75]),
  ],
};

// ── Materials ──
/** Each box's edges cut through its silhouette, for its fill (by icon). */
const BOXCUT = {};
/** A box seen from the front and a little from above: its front face and the depth `v` (up, right). */
function box(x0, y0, x1, y1, v, r = 0.75) {
  const b = (p) => add(p, v);
  return {
    outline: roundpoly([[x0, y1], [x0, y0], b([x0, y0]), b([x1, y0]), b([x1, y1]), [x1, y1]], r),
    edges: line([x0, y0], [x1, y0], b([x1, y0])),
    corner: line([x1, y0], [x1, y1]),
    // Filled, the edges are cut through the silhouette
    cuts: [beyond([[x0, y0], [x1, y0], b([x1, y0])]), line([x1, y0], [x1, y1 + 1.5])],
  };
}
// Brick: one brick in perspective, three holes (dots) on its top face.
{
  const B = box(2.75, 14.75, 16.75, 20, [4.5, -6.5]);
  BOXCUT.brick = B.cuts;
  icons.brick = {
    tags: ['ladrillo', 'tabique', 'material', 'mampostería', 'brick', 'building material', 'masonry'],
    d: [B.outline, B.edges, B.corner, dot(8.35, 11.5), dot(12, 11.5), dot(15.65, 11.5)],
  };
}
// Concrete block: a hollow block seen from above, its two square cores through the top face.
{
  const v = [3.5, -9.5];
  const B = box(2.75, 14.75, 17.75, 19, v);
  BOXCUT['concrete-block'] = B.cuts;
  const at = (u, w) => [2.75 + u + (v[0] * w) / -v[1], 14.75 - w];
  const core = (u0, u1) => roundpoly([at(u0, 3), at(u1, 3), at(u1, 6.5), at(u0, 6.5)], 0.6);
  icons['concrete-block'] = {
    tags: ['block', 'bloque de concreto', 'tabicón', 'material', 'concrete block', 'cinder block', 'blockwork'],
    d: [B.outline, B.edges, B.corner, core(3, 6), core(9, 12)],
  };
}
// Cement bag: a stout sack standing upright, its top pulled into two ears at the corners and the
// sewn seam running under them (with a straight top lip and stitch ticks it read as a flowerpot).
icons['cement-bag'] = {
  tags: ['bulto de cemento', 'saco', 'mortero', 'yeso', 'cement bag', 'sack', 'dry mix'],
  d: [
    'M4.25 3.25Q12 7.25 19.75 3.25L18.75 6.75C20.25 9.75 20.5 15.5 19.25 19.25C19 20.1 18.4 20.75 17.5 20.75H6.5C5.6 20.75 5 20.1 4.75 19.25C3.5 15.5 3.75 9.75 5.25 6.75Z',
    // The seam runs from side to side (it meets them at 9.25)
    'M4.4 9.25Q12 12.5 19.6 9.25',
  ],
};
// Lumber: two sawn boards stacked, seen from their ends (each with an arc of its growth rings) and
// running back to the right.
{
  const [x0, x1, y0, ym, y1] = [2.75, 10.25, 10.25, 15.5, GROUND];
  const v = [9.5, -4.75];
  const B = box(x0, y0, x1, y1, v);
  BOXCUT.lumber = [...B.cuts, beyond([[x0, ym], [x1, ym], add([x1, ym], v)]), `M${pt([x0 - 1.5, y1 - 3.25])}H${f(x0)}A3.25 3.25 0 0 1 ${pt([x0 + 3.25, y1])}V${f(y1 + 1.5)}`];
  icons.lumber = {
    tags: ['madera', 'tablas', 'tablones', 'carpintería', 'lumber', 'timber', 'boards'],
    d: [B.outline, B.edges, B.corner, `M${pt([x0, ym])}H${f(x1)}L${pt(add([x1, ym], v))}`, `M${pt([x0, y1 - 3.25])}A3.25 3.25 0 0 1 ${pt([x0 + 3.25, y1])}`, `M${pt([x1 - 3.25, y0])}A3.25 3.25 0 0 0 ${pt([x1, y0 + 3.25])}`],
  };
}

/** A water drop as lugares' droplet: a circle of r drawn up into its point, r√2 above the center. */
const waterDrop = ([cx, cy], r) => {
  const a = polar(cx, cy, r, -45);
  const b = polar(cx, cy, r, -135);
  return `M${pt(a)}A${f(r)} ${f(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
};
/** A sine wave from x0 along y in n half periods of h (amplitude a), the first one up (lugares' small wave). */
const wave = (x0, y, n, h, a, up = true) => {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const sg = (i % 2 === 0) === up ? -1 : 1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (sg * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (sg * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
};

// Insulation: the panel between two boards (its faces) filled with the drafting symbol for
// insulation, a continuous row of loops.
{
  // A prolate cycloid: it loops back on itself once per turn, from the top face to the bottom one
  // Three loops, 3 clear of both faces (touching them, the gaps between the loops and the faces
  // closed up at 2.1)
  const [x0, yc, adv, R, kx, turns] = [3.5, 12, 0.9, 3, 2.5, 3];
  const pts = Array.from({ length: 161 }, (_, i) => {
    const t = (i / 160) * turns * 2 * Math.PI;
    return [x0 + adv * t + kx * Math.sin(t), yc - R * Math.cos(t)];
  });
  icons.insulation = {
    tags: ['aislamiento', 'aislante térmico', 'colchoneta', 'insulation', 'thermal insulation', 'batt'],
    d: [line([2.75, yc - R - 3], [21.25, yc - R - 3]), line([2.75, yc + R + 3], [21.25, yc + R + 3]), `M${pts.map(pt).join('L')}`],
  };
}
// Soundproofing: the sound's waves on the left stopping at a thick wall in the middle; nothing on
// the right.
icons.soundproofing = {
  tags: ['aislamiento acústico', 'insonorización', 'ruido', 'soundproofing', 'acoustic insulation', 'noise'],
  d: [sq(13.25, 3.25, 4.5, 17.5, 1), arc(3.5, 12, 3.5, -50, 50).d, arc(3.5, 12, 6.75, -50, 50).d],
};
// Wall crack: a plain wall panel and a crack running from its top edge down and across.
icons['wall-crack'] = {
  tags: ['grieta', 'fisura', 'muro dañado', 'reparación', 'wall crack', 'crack', 'defect'],
  d: [sq(3.25, 3.25, 17.5, 17.5, 2.5), line([10.25, 3.25], [9, 7.5], [12.5, 10.25], [10.5, 13.75], [15, 16.5])],
};
// House crack: lugares' house split from the ridge to the ground by a zigzag crack, the right half
// dropped and pulled a little away from the left.
{
  const z = [[12, H.apex[1]], [11.25, 8], [13, 12], [11.25, 16], [12.25, GROUND]];
  const side = (dx) => z.map(([x, y]) => [x + dx, y]);
  const L = side(-1.6);
  const R = side(1.6);
  const roofY = (x) => H.roofAt(x);
  L[0] = [L[0][0], roofY(L[0][0])];
  R[0] = [R[0][0], roofY(R[0][0])];
  const left = roundline([[H.xl, roofY(H.xl)], [H.xl, GROUND], ...L.slice().reverse(), [2.75, roofY(2.75)]], [0, 2.5, 0, 0.4, 0.4, 0.4, 0, 0]);
  const right = roundline([[H.xr, roofY(H.xr)], [H.xr, GROUND], ...R.slice().reverse(), [21.25, roofY(21.25)]], [0, 0, 0, 0.4, 0.4, 0.4, 0, 0]);
  icons['house-crack'] = {
    tags: ['daño estructural', 'casa agrietada', 'sismo', 'hundimiento', 'house crack', 'structural damage', 'earthquake'],
    d: [left, transform(right, 1, 0.4, 0.9)],
  };
}
// Roof pitch: the roof's slope at the house's pitch, the rise and the run under it, and the arc of
// its angle.
{
  const yAt = (x) => 20 - (x - 2.75) * PITCH;
  const A = [6, yAt(6)];
  const B = [17.25, A[1]];
  const C = [17.25, yAt(17.25)];
  const ang = (Math.atan(PITCH) * 180) / Math.PI;
  icons['roof-pitch'] = {
    tags: ['pendiente del techo', 'inclinación', 'ángulo', 'roof pitch', 'slope', 'rise over run'],
    d: [line([2.75, 20], [21.25, yAt(21.25)]), line(A, B, C), arc(A[0], A[1], 5.5, -ang, 0).d],
  };
}

// ── Drawings ──
// Blueprint: the sheet (the signature's square corner) unrolled from the roll on its left, the walls
// of a plan in an L on it.
const BLUEPRINT = [
  sq(2.75, 3.25, 3.5, 17.5, 1.75),
  roundline([[6.25, 5.25], [21.25, 5.25], [21.25, 18.75], [6.25, 18.75]], [0, 2.5, 0, 0]),
  roundline([[11.5, 15.25], [9.5, 15.25], [9.5, 8.5], [17, 8.5], [17, 15.25], [14.5, 15.25]], [0, 0.5, 0.5, 0.5, 0.5, 0]),
];
icons.blueprint = { tags: ['plano', 'planos', 'proyecto ejecutivo', 'blueprint', 'drawings', 'plans'], d: BLUEPRINT };
icons['blueprint-check'] = { tags: ['planos aprobados', 'para construcción', 'as-built', 'approved drawings', 'approved for construction'], d: BLUEPRINT, badge: badge('check') };
icons['blueprint-edit'] = { tags: ['revisión de planos', 'marcar plano', 'orden de cambio', 'markup', 'revision', 'change order'], d: BLUEPRINT, badge: badge('edit') };
// Site plan: the plot's dashed boundary from above, the building's footprint in it and the driveway
// running from it to the boundary's opening.
icons['site-plan'] = {
  tags: ['plano de conjunto', 'terreno', 'lote', 'implantación', 'site plan', 'plot plan', 'site layout'],
  d: [
    ...dashed([[21.25, 14], [21.25, GROUND], [2.75, GROUND], [2.75, 3.25], [21.25, 3.25], [21.25, 5]]),
    roundpoly([[6.25, 6.75], [15.25, 6.75], [15.25, 12], [11.25, 12], [11.25, 16.75], [6.25, 16.75]], 0.75),
    `M15.25 8H21.25M15.25 11H21.25`,
  ],
};
// Drafting table: the board from the front, tilted back (narrower at its far edge), the parallel
// rule across it and a set square standing on the rule, on two splayed legs. (From the side, a
// thick board on a tripod read as a telescope.)
{
  const board = roundpoly([[5.5, 3.25], [18.5, 3.25], [21.25, 13.75], [2.75, 13.75]], 1);
  // The rule runs from side to side of the board
  const side = (y) => 2.75 + ((13.75 - y) * 2.75) / 10.5;
  const rule = line([side(10.75), 10.75], [24 - side(10.75), 10.75]);
  icons['drafting-table'] = {
    tags: ['restirador', 'mesa de dibujo', 'arquitecto', 'drafting table', 'drawing board', 'architect'],
    d: [board, rule, line([8, 10.75], [8, 6.25], [13, 10.75]), `M8 13.75L5.5 ${f(GROUND)}M16 13.75L18.5 ${f(GROUND)}`],
  };
  icons['drafting-table'].fill = { solid: [board], cut: [beyond([[side(10.75), 10.75], [24 - side(10.75), 10.75]]), icons['drafting-table'].d[2]], wire: [icons['drafting-table'].d[3]] };
}
// Building model: an isometric block with its floors marked around it and a lower wing to one side.
{
  const k = 1.2;
  const O = [10.1, 11.4];
  const P = (x, y, z) => [O[0] + (x - y) * 0.866 * k, O[1] + ((x + y) * 0.5 - z) * k];
  const [h, f1] = [8, 8 / 3];
  icons['building-model'] = {
    tags: ['maqueta', 'modelo 3d', 'bim', 'volumetría', 'building model', '3d model', 'massing'],
    d: [
      roundpoly([P(0, 0, h), P(5, 0, h), P(5, 0, f1), P(9, 0, f1), P(9, 0, 0), P(9, 5, 0), P(0, 5, 0), P(0, 5, h)], 0.5),
      line(P(0, 5, h), P(5, 5, h), P(5, 0, h)),
      line(P(5, 5, h), P(5, 5, f1)),
      line(P(0, 5, f1), P(9, 5, f1), P(9, 0, f1)),
      line(P(9, 5, f1), P(9, 5, 0)),
      line(P(5, 0, f1), P(5, 5, f1)),
      line(P(0, 5, 2 * f1), P(5, 5, 2 * f1), P(5, 0, 2 * f1)),
    ],
  };
}

// ── Plumbing ──
// The household pipe: walls PIPE apart and sockets 7.5 wide, 3 long (industria's pipeline is 6).
const PIPE = 4.5;
const SOCKET = [7.5, 3];
/** A socket ring across a pipe whose axis runs through c, along x ('h') or y ('v'). */
const socket = ([cx, cy], dir) => (dir === 'h' ? sq(cx - SOCKET[1] / 2, cy - SOCKET[0] / 2, SOCKET[1], SOCKET[0], 0.75) : sq(cx - SOCKET[0] / 2, cy - SOCKET[1] / 2, SOCKET[0], SOCKET[1], 0.75));
// Pipe elbow: the pipe turning 90° (its axis on a radius of 4), a socket at each end.
{
  const [c, R, w] = [[11.5, 11.5], 4, PIPE / 2];
  const outer = `M5.75 ${f(c[1] + R + w)}H${f(c[0])}A${f(R + w)} ${f(R + w)} 0 0 0 ${pt([c[0] + R + w, c[1]])}V5.75`;
  const inner = `M5.75 ${f(c[1] + R - w)}H${f(c[0])}A${f(R - w)} ${f(R - w)} 0 0 0 ${pt([c[0] + R - w, c[1]])}V5.75`;
  icons['pipe-elbow'] = {
    tags: ['codo', 'tubería', 'plomería', 'conexión', 'pipe elbow', 'pipe fitting', 'plumbing'],
    d: [outer, inner, socket([4.25, c[1] + R], 'h'), socket([c[0] + R, 4.25], 'v')],
  };
}
// Pipe tee: the run across and the branch up from its middle, a socket at each of the three ends.
{
  const [y, w] = [16, PIPE / 2];
  icons['pipe-tee'] = {
    tags: ['te', 'tee', 'tubería', 'derivación', 'pipe tee', 'tee fitting', 'branch'],
    d: [
      line([5.75, y + w], [18.25, y + w]),
      roundline([[5.75, y - w], [12 - w, y - w], [12 - w, 5.75]], [0, 1, 0]),
      roundline([[12 + w, 5.75], [12 + w, y - w], [18.25, y - w]], [0, 1, 0]),
      socket([4.25, y], 'h'),
      socket([19.75, y], 'h'),
      socket([12, 4.25], 'v'),
    ],
  };
}
// Pipe leak: the pipe between two sockets, its bottom wall broken by a jagged crack, and two drops
// falling from it.
{
  const [y, w] = [8, PIPE / 2];
  icons['pipe-leak'] = {
    tags: ['fuga', 'tubería rota', 'goteo', 'plomero urgente', 'pipe leak', 'leak', 'burst pipe'],
    d: [
      line([5.75, y - w], [18.25, y - w]),
      line([5.75, y + w], [10.25, y + w], [11, y + w - 1.25]),
      line([14, y + w - 1], [14.25, y + w], [18.25, y + w]),
      socket([4.25, y], 'h'),
      socket([19.75, y], 'h'),
      waterDrop([12.25, 15.5], 1.75),
      waterDrop([15.75, 19.75], 1.5),
    ],
  };
}
// Sink trap: the pipe coming down from the drain's flange, the U bend, and up and round into the
// wall on the right.
const TRAP = (() => {
  const [c, R, w] = [[11, 14], 3.75, PIPE / 2];
  const [e, r] = [[c[0] + R + 3.75, 12], 3.75];
  const yTop = 5.25;
  const outer = `M${pt([c[0] - R - w, yTop])}V${f(c[1])}A${f(R + w)} ${f(R + w)} 0 0 0 ${pt([c[0] + R + w, c[1]])}V${f(e[1])}A${f(r - w)} ${f(r - w)} 0 0 1 ${pt([e[0], e[1] - r + w])}H21.25`;
  const inner = `M${pt([c[0] - R + w, yTop])}V${f(c[1])}A${f(R - w)} ${f(R - w)} 0 0 0 ${pt([c[0] + R - w, c[1]])}V${f(e[1])}A${f(r + w)} ${f(r + w)} 0 0 1 ${pt([e[0], e[1] - r - w])}H21.25`;
  return { d: [outer, inner, sq(c[0] - R - 3.75, 2.75, 7.5, 2.5, 0.75)], c, R, w };
})();
icons['sink-trap'] = { tags: ['sifón', 'trampa', 'desagüe', 'drenaje', 'sink trap', 'p-trap', 'drain'], d: TRAP.d };
// Sink trap, clogged: a lump stuck in the bottom of the U bend, touching both of its walls.
icons['sink-trap-clog'] = {
  tags: ['drenaje tapado', 'atasco', 'destapar', 'desazolve', 'clogged drain', 'blocked drain', 'drain cleaning'],
  d: [...TRAP.d, circ(TRAP.c[0], TRAP.c[1] + TRAP.R, TRAP.w)],
};
// Faucet: a single-lever mixer in profile: the round base, the body, the arched spout and the lever.
const FAUCET = (() => {
  const c = [10.75, 14.25];
  const spout = `M${pt([c[0], c[1] - 7])}A7 7 0 0 1 ${pt([c[0] + 7, c[1]])}H${f(c[0] + 4)}A4 4 0 0 0 ${pt([c[0], c[1] - 4])}`;
  return [sq(3.75, 18.25, 8.75, 2.5, 1.25), roundline([[5.5, 18.25], [5.5, 6.25], [10.75, 6.25], [10.75, 18.25]], [0, 1.25, 1.25, 0]), spout, line([8.25, 6.25], [5.25, 3.25])];
})();
icons.faucet = { tags: ['llave', 'grifo', 'mezcladora', 'plomería', 'faucet', 'tap', 'mixer'], d: FAUCET };
icons['faucet-drip'] = { tags: ['llave que gotea', 'goteo', 'fuga', 'desperdicio de agua', 'dripping faucet', 'leak', 'water waste'], d: [...FAUCET, waterDrop([16.25, 19.75], 1.25)] };
// Spigot: the plate on the wall, a short pipe, the valve with its round cross handle on top and the
// downturned spout, threaded.
icons.spigot = {
  tags: ['llave de jardín', 'toma de agua', 'manguera', 'exterior', 'spigot', 'hose bib', 'outdoor faucet'],
  d: [
    sq(2.75, 6.5, 3, 11.5, 1),
    `M5.75 10H9M5.75 14.5H9`,
    sq(9, 8.5, 6.5, 8, 1.75),
    line([12.25, 8.5], [12.25, 5.75]),
    ellipse(12.25, 4.25, 3.75, 1.5),
    `M15.5 9.75H16.25A4.5 4.5 0 0 1 ${pt([20.75, 14.25])}V20.5H17.75V14.25A1.5 1.5 0 0 0 16.25 12.75H15.5`,
    `M17.75 17.25H20.75`,
  ],
};
// Ductwork: a rectangular duct running in from the left, its 90° elbow turning it down, a seam at
// its joint and the grille on its open end.
{
  const [c, r0, r1] = [[12.25, 10.25], 1.5, 6.5];
  icons.ductwork = {
    tags: ['ductos', 'ventilación', 'aire acondicionado', 'hvac', 'ductwork', 'air duct', 'ventilation'],
    d: [
      `M2.75 ${f(c[1] - r1)}H${f(c[0])}A${r1} ${r1} 0 0 1 ${pt([c[0] + r1, c[1]])}V14.25`,
      `M2.75 ${f(c[1] - r0)}H${f(c[0])}A${r0} ${r0} 0 0 1 ${pt([c[0] + r0, c[1]])}V14.25`,
      line([7.5, c[1] - r1], [7.5, c[1] - r0]),
      sq(11.25, 14.25, 10, 6.5, 1),
      `M14.58 14.25V${f(GROUND)}M17.92 14.25V${f(GROUND)}`,
    ],
  };
  const d = icons.ductwork.d;
  icons.ductwork.fill = {
    solid: [`${d[0]}H${f(c[0] + r0)}V${f(c[1])}A${r0} ${r0} 0 0 0 ${pt([c[0], c[1] - r0])}H2.75Z`, d[3]],
    cut: [line([7.5, c[1] - r1 - 1.5], [7.5, c[1] - r0 + 1.5]), beyond([[11.25, 14.25], [21.25, 14.25]]), 'M14.58 14.25V22.25M17.92 14.25V22.25'],
  };
}

// ── Electrical ──
// One box for the electrical pieces: the square bottom-right corner, r 2.5.
// Breaker panel: the tall box and, inside, two bus bars back to back with the breakers coming off
// them to each side. (A main breaker over rows of toggles read as a calculator, and as
// electrodomesticos' alarm-panel; two strips of breakers were too dense.)
icons['breaker-panel'] = {
  tags: ['centro de carga', 'tablero eléctrico', 'pastillas', 'fusibles', 'breaker panel', 'electrical panel', 'fuse box'],
  d: [sq(4.75, 2.75, 14.5, 18.5, 2.5, BR), 'M10.25 6.25V17.75M13.75 6.25V17.75', [7.75, 12, 16.25].map((y) => `M7.75 ${f(y)}H10.25M13.75 ${f(y)}H16.25`).join('')],
};
// Circuit breaker: a single module, its toggle in a slot: up when it's on, down when it has tripped.
// The module: its terminal screws at the top and bottom, the window in the middle and the toggle, a
// lever from its pivot to the window's edge.
const BREAKER = [sq(6, 2.75, 12, 18.5, 2.5, BR), dot(12, 5.75), dot(12, 18.25), sq(9, 8.75, 6, 6.5, 1), dot(12, 12)];
icons['circuit-breaker'] = { tags: ['pastilla', 'interruptor termomagnético', 'protección', 'encendido', 'circuit breaker', 'breaker', 'switched on'], d: [...BREAKER, line([12, 12], [12, 8.75])] };
icons['circuit-breaker-tripped'] = { tags: ['pastilla botada', 'sin luz', 'corto circuito', 'falla eléctrica', 'tripped breaker', 'power outage', 'electrical fault'], d: [...BREAKER, line([12, 12], [12, 15.25])] };

// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// By index into d, or a closed path of its own; see DESIGN.md › Fill.
const FILL = {
  'tower-crane': { solid: [4], wire: [0, 1, 2, 3, 5, 6] },
  'crane-lift': { solid: [0], cut: [beyond([[2.75, 15.75], [18.25, 15.75], [21.25, 13.25]]), line([18.25, 15.75], [18.25, 21])], wire: [3, 4, 5] },
  scaffolding: false,
  'construction-site': { solid: [0, 6], cut: ['M9.42 14.75V22.25M14.58 14.75V22.25'], wire: [2, 3, 4, 5, 7] },
  wheelbarrow: { solid: [0, 2], wire: [1, 3, 4] },
  'plumb-bob': { solid: [2], wire: [0, 1] },
  trowel: { solid: [0, 2], wire: [1] },
  groundbreaking: { solid: [0, 2], wire: [1] },
  gravel: { solid: [], wire: [0] },
  'wrecking-ball': { solid: [shut(icons['wrecking-ball'].d[0]), 2, 3, 4], cut: [beyond([[14.25, 16.75], [21.25, 16.75]]), line([17.75, 16.75], [17.75, GROUND + 1.5])], wire: [5] },
  'building-foundation': { solid: [FOUNDATION.body, shut(FOUNDATION.d[3])], wire: [2] },
  'house-frame': { solid: [], cut: [2, 3] },
  'building-frame': false,
  'house-renovation': { solid: [], cut: [] },
  'house-extension': { solid: [], cut: [2] },
  'modular-building': { solid: [0, 1], wire: [2, 3, 4] },
  bricklaying: { solid: [0, 3], cut: [1, 2] },

  'i-beam': { solid: [0], wire: [1, 2, 3] },
  truss: { solid: [0], cut: [1] },
  arch: { solid: [0], cut: [1, 2] },
  dome: { solid: [], wire: [5] },
  brick: { solid: [0], cut: [3, 4, 5] },
  'concrete-block': { solid: [0], cut: [3, 4] },
  'cement-bag': { solid: [0], cut: [] },
  lumber: { solid: [0], cut: [5] },
  insulation: false,
  soundproofing: { solid: [0], wire: [1, 2] },
  'wall-crack': { solid: [0], cut: [1] },
  'house-crack': { solid: [] },
  'roof-pitch': false,
  blueprint: { solid: [0, shut(BLUEPRINT[1])], cut: [2] },
  'blueprint-check': { solid: [0, shut(BLUEPRINT[1])], cut: [2] },
  'blueprint-edit': { solid: [0, shut(BLUEPRINT[1])], cut: [2] },
  'site-plan': { solid: [] },
  'building-model': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  'pipe-elbow': { solid: [] },
  'pipe-tee': { solid: [] },
  'pipe-leak': { solid: [] },
  'sink-trap': { solid: [] },
  'sink-trap-clog': { solid: [] },
  faucet: { solid: [] },
  'faucet-drip': { solid: [] },
  spigot: { solid: [] },
  'breaker-panel': { solid: [0], cut: [1, 2] },
  'circuit-breaker': { solid: [] },
  'circuit-breaker-tripped': { solid: [] },
};
// Closed shapes made from open strokes (a heap)
{
  // The household pipe's bodies: walls joined along the wall's edge
  const { c, R, w } = TRAP;
  const [e, r, yTop] = [[c[0] + R + 3.75, 12], 3.75, 5.25];
  const body = `${TRAP.d[0]}V${f(e[1] - r - w)}H${f(e[0])}A${f(r + w)} ${f(r + w)} 0 0 0 ${pt([c[0] + R - w, e[1]])}V${f(c[1])}A${f(R - w)} ${f(R - w)} 0 0 1 ${pt([c[0] - R + w, c[1]])}V${f(yTop)}Z`;
  FILL['sink-trap'] = { solid: [body, 2] };
  FILL['sink-trap-clog'] = { solid: [body, 2], cut: [3] };
  FILL.faucet = { solid: [0, shut(FAUCET[1]), shut(FAUCET[2])], wire: [3] };
  FILL['faucet-drip'] = { solid: [0, shut(FAUCET[1]), shut(FAUCET[2]), 4], wire: [3] };
  const sp = icons.spigot.d;
  FILL.spigot = { solid: [0, 'M5.75 10H9V14.5H5.75Z', 2, 4, shut(sp[5])], cut: [6], wire: [3] };
  FILL['circuit-breaker'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  FILL['circuit-breaker-tripped'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
}
FILL['house-crack'] = { solid: icons['house-crack'].d.map(shut) };
{
  const d = icons['site-plan'].d;
  FILL['site-plan'] = { solid: [d.length - 2], wire: d.map((_, i) => i).filter((i) => i !== d.length - 2) };
}
{
  // The pipes' bodies: their walls joined along the sockets' edges
  const e = icons['pipe-elbow'].d;
  const [c0, R, w] = [[11.5, 11.5], 4, PIPE / 2];
  const elbow = `${e[0]}H${f(c0[0] + R - w)}V${f(c0[1])}A${f(R - w)} ${f(R - w)} 0 0 1 ${pt([c0[0], c0[1] + R - w])}H5.75Z`;
  FILL['pipe-elbow'] = { solid: [elbow, 2, 3] };
  const y = 16;
  const tee = roundpoly([[5.75, y + w], [18.25, y + w], [18.25, y - w], [12 + w, y - w], [12 + w, 5.75], [12 - w, 5.75], [12 - w, y - w], [5.75, y - w]], [0, 0, 0, 1, 0, 0, 1, 0]);
  FILL['pipe-tee'] = { solid: [tee, 3, 4, 5] };
  const yl = 8;
  FILL['pipe-leak'] = { solid: [`M5.75 ${f(yl - w)}H18.25V${f(yl + w)}H14.25L14 ${f(yl + w - 1)}L11 ${f(yl + w - 1.25)}L10.25 ${f(yl + w)}H5.75Z`, 3, 4, 5, 6] };
}
FILL['house-renovation'] = { solid: [roundpoly([[2.75, 11.25], H.apex, [12, GROUND], [H.xl, GROUND], [H.xl, 11.25]], [0, 0.5, 0, 2.5, 0])], cut: [4], wire: [0, 1, 2, 3] };
{
  const d = icons['house-extension'].d;
  FILL['house-extension'] = { solid: [shut(d[0]), shut(d[1])], cut: [2], wire: d.slice(3).map((_, i) => i + 3) };
}
FILL.dome = { solid: [shut(icons.dome.d[0]), shut(icons.dome.d[2]), shut(icons.dome.d[4])], cut: [3], lines: [1], wire: [5] };
FILL['cement-bag'] = { solid: [0], cut: icons['cement-bag'].d.slice(1).map((_, i) => i + 1) };
// The boxes' edges, cut through their silhouettes
for (const [name, cuts] of Object.entries(BOXCUT)) FILL[name].cut = [...cuts, ...FILL[name].cut];
FILL.gravel = { solid: [`${icons.gravel.d[1]}Z`], cut: [2, 3, 4], wire: [0] };
{
  // The frame's cuts run through the walls and the floor; the king post stops inside the roof
  const plate = 12.75;
  const ridge = H.apex[1] + 1.25 / Math.sin(Math.PI / 2 - Math.atan(PITCH)) - 1.25;
  FILL['house-frame'] = {
    solid: [shut(H.roof), shut(H.walls)],
    cut: [beyond([[H.xl, plate], [H.xr, plate]]), beyond([[9.75, plate], [9.75, GROUND]]), beyond([[14.25, plate], [14.25, GROUND]]), beyond([[14.25, plate], [9.75, GROUND]]), line([12, plate], [12, ridge + 1.75])],
  };
}
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = { solid: pick(spec.solid) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}

// ── Named parts ───────────────────────────────────────────────────────────────────────────────
// What animates, changes state or is a badge, and the pieces with a meaning of their own.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const PARTS = {
  'tower-crane': { mast: [0, 1, 2], jib: [3], counterweight: [4], ground: [5], hook: [6] },
  'crane-lift': { load: [0, 1, 2], hook: [3], slings: [4, 5] },
  scaffolding: { standards: [0], ledgers: [1, 2], braces: [3, 4], plates: [5] },
  'construction-site': { hoarding: [0, 1], crane: [2, 3, 4, 5, 6], hook: [7] },
  wheelbarrow: { tub: [0], handle: [1], wheel: [2], frame: [3, 4] },
  'plumb-bob': { bar: [0], line: [1], bob: [2] },
  trowel: { blade: [0], handle: [1, 2] },
  groundbreaking: { shovel: [0, 1, 2] },
  gravel: { ground: [0], heap: [1], aggregate: [2, 3, 4] },
  'wrecking-ball': { wall: [0, 1], debris: [2, 3], ball: [4], cable: [5] },
  'building-foundation': { roof: [0], walls: [1], ground: [2], foundation: [3] },
  'house-frame': { roof: [0], walls: [1], frame: [2, 3, 4, 5] },
  'building-frame': { ground: [0], columns: [1], floors: [2, 3, 4] },
  'house-renovation': { roof: [0], walls: [1], frame: [2, 3], window: [4] },
  'house-extension': { house: [0, 1, 2], extension: [3, 4, 5] },
  'modular-building': { module: [0], load: [1], hook: [2], slings: [3, 4] },
  bricklaying: { wall: [0, 1, 2], brick: [3] },
  roofing: { roof: [0], tiles: [1], walls: [2] },
  'i-beam': { end: [0], length: [1, 2, 3] },
  truss: { chords: [0], web: [1] },
  'roof-truss': { chords: [0], web: [1] },
  arch: { arch: [0], joints: [1, 2] },
  dome: { drum: [0], cornice: [1], dome: [2, 3], lantern: [4, 5] },
  brick: { brick: [0, 1, 2], holes: [3, 4, 5] },
  'concrete-block': { block: [0, 1, 2], cores: [3, 4] },
  'cement-bag': { bag: [0], seam: [1] },
  lumber: { boards: [0, 1, 2, 3], rings: [4, 5] },
  insulation: { boards: [0, 1], insulation: [2] },
  soundproofing: { wall: [0], wave: [1, 2] },
  'wall-crack': { wall: [0], crack: [1] },
  'house-crack': { left: [0], right: [1] },
  'roof-pitch': { slope: [0], rise: [1], angle: [2] },
  blueprint: { roll: [0], sheet: [1], plan: [2] },
  'blueprint-check': { roll: [0], sheet: [1], plan: [2] },
  'blueprint-edit': { roll: [0], sheet: [1], plan: [2] },
  'site-plan': { boundary: range(0, 9), building: [9], driveway: [10] },
  'drafting-table': { board: [0], rule: [1], square: [2], legs: [3] },
  'pipe-elbow': { pipe: [0, 1], sockets: [2, 3] },
  'pipe-tee': { pipe: [0, 1, 2], sockets: [3, 4, 5] },
  'pipe-leak': { pipe: [0, 1, 2, 3, 4], drop: [5, 6] },
  'sink-trap': { trap: [0, 1], drain: [2] },
  'sink-trap-clog': { trap: [0, 1], drain: [2], clog: [3] },
  faucet: { base: [0], body: [1], spout: [2], lever: [3] },
  'faucet-drip': { base: [0], body: [1], spout: [2], lever: [3], drop: [4] },
  spigot: { plate: [0], pipe: [1], body: [2], handle: [3, 4], spout: [5, 6] },
  ductwork: { duct: [0, 1, 2], grille: [3, 4] },
  'breaker-panel': { panel: [0], bus: [1], breakers: [2] },
  'circuit-breaker': { body: [0], screws: [1, 2], window: [3], toggle: [4, 5] },
  'circuit-breaker-tripped': { body: [0], screws: [1, 2], window: [3], toggle: [4, 5] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// Things that hang swing from where they hang; loads float up; drops fall; tools rock in the hand.
const MOTION = {
  'tower-crane': { effect: 'ring', parts: ['hook'], origin: [19.25, 5.25] },
  'construction-site': { effect: 'ring', parts: ['hook'], origin: [19.25, 4.25] },
  'crane-lift': { effect: 'float', vector: [0, -1.5] },
  'modular-building': { effect: 'float', parts: ['load', 'hook', 'slings'], vector: [0, -1.5] },
  'plumb-bob': { effect: 'ring', parts: ['line', 'bob'], origin: [12, 2.75] },
  'wrecking-ball': { effect: 'ring', parts: ['ball', 'cable'], origin: [3.25, 2.75] },
  trowel: { effect: 'wiggle', origin: [17.75, 6.25] },
  groundbreaking: { effect: 'wiggle', parts: ['shovel'], origin: [12, 18] },
  bricklaying: { effect: 'bounce', parts: ['brick'], vector: [0, 1.5] },
  'blueprint-check': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.25] },
  'blueprint-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'pipe-leak': { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
  'faucet-drip': { effect: 'slide', parts: ['drop'], vector: [0, 1.5] },
  faucet: { effect: 'wiggle', parts: ['lever'], origin: [8.25, 6.25] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// Drawings of their own where the snapped one turns to a smudge: fewer pieces, on the pixel grid
// (pixel centers at 0.75 + 1.5k), at least one pixel of clearance.
{
  // Cranes: the mast's zigzag clogged; its chords 3 pixels apart with rungs
  const cw = (y) => sq(2.25, y, 3, 3, 0.5);
  const crane = [line([8.25, 5.25], [8.25, 20.25]), line([12.75, 5.25], [12.75, 20.25]), 'M8.25 9.75H12.75M8.25 14.25H12.75', line([2.25, 5.25], [21.75, 5.25]), cw(5.25), line([5.25, 20.25], [15.75, 20.25]), 'M18.75 5.25V9.75A1.5 1.5 0 0 1 15.75 9.75V9'];
  icons['tower-crane'].small = { d: crane, fill: { solid: [crane[4]], wire: crane.filter((_, i) => i !== 4) } };
  // The hoarding in three panels
  const site = [sq(3.75, 15.75, 16.5, 4.5, 1), 'M9.75 15.75V20.25M14.25 15.75V20.25', line([8.25, 3.75], [8.25, 12.75]), line([12.75, 3.75], [12.75, 12.75]), 'M8.25 8.25H12.75', line([2.25, 3.75], [21.75, 3.75]), cw(3.75), 'M18.75 3.75V8.25A1.5 1.5 0 0 1 15.75 8.25V7.5'];
  icons['construction-site'].small = { d: site, fill: { solid: [site[0], site[6]], cut: ['M9.75 14.25V21.75M14.25 14.25V21.75'], wire: [site[2], site[3], site[4], site[5], site[7]] } };
  // House frame: the plate and two studs, without the brace and the king post
  const hf = [H.roof, H.walls, 'M5.25 12.75H18.75', 'M9.75 12.75V20.75M14.25 12.75V20.75'];
  icons['house-frame'].small = { d: hf, fill: { solid: [shut(H.roof), shut(H.walls)], cut: ['M3.75 12.75H20.25', 'M9.75 12.75V22.25M14.25 12.75V22.25'] } };
  // I-beam: the I and its top face only
  const I = roundpoly([[2.25, 11.25], [11.25, 11.25], [11.25, 14.25], [8.25, 14.25], [8.25, 17.25], [11.25, 17.25], [11.25, 20.25], [2.25, 20.25], [2.25, 17.25], [5.25, 17.25], [5.25, 14.25], [2.25, 14.25]], 0.4);
  const top = line([2.25, 11.25], [9.75, 3.75], [18.75, 3.75], [11.25, 11.25]);
  const side = line([18.75, 3.75], [18.75, 6.75], [11.25, 14.25]);
  icons['i-beam'].small = { d: [I, top, side], fill: { solid: [I], wire: [top, side] } };
  // Truss: its web at 45° on the pixel diagonals, the chords four pixels apart (three smudged)
  const tr = [sq(2.25, 9.75, 18, 6, 0), line([2.25, 15.75], [8.25, 9.75], [14.25, 15.75], [20.25, 9.75])];
  icons.truss.small = { d: tr, fill: { solid: [tr[0]], cut: [line([0.75, 17.25], [8.25, 8.25], [14.25, 17.25], [21.75, 8.25])] } };
  // Roof truss: the triangle on the pixel grid, a king post and two struts in place of the W
  const rt = [roundpoly([[2.25, 17.25], [12.75, 6.75], [23.25 - 1.5, 17.25]], 0.4), 'M12.75 6.75V17.25', line([7.5, 12], [12.75, 17.25], [17.25, 12.75])];
  icons['roof-truss'].small = { d: rt };
  // Concrete block: the cores square on the pixel grid
  const cb = box(2.25, 14.25, 17.25, 18.75, [3, -9]);
  const cores = [sq(6.75, 8.25, 3, 3, 0.5), sq(12.75, 8.25, 3, 3, 0.5)];
  icons['concrete-block'].small = { d: [cb.outline, cb.edges, cb.corner, ...cores], fill: { solid: [cb.outline], cut: [...cb.cuts, ...cores] } };
  // Circuit breaker: the toggle a lever from the window's middle (its pivot clogged)
  const cbBody = [sq(6.75, 2.25, 12, 19.5, 2.25, BR), dot(12.75, 5.25, 0.75), dot(12.75, 18.75, 0.75), sq(9.75, 8.25, 6, 7.5, 1)];
  for (const [name, y] of [['circuit-breaker', 8.25], ['circuit-breaker-tripped', 15.75]]) {
    const lever = line([12.75, 12], [12.75, y]);
    icons[name].small = { d: [...cbBody, lever], fill: { solid: [cbBody[0]], cut: [cbBody[1], cbBody[2], cbBody[3], lever] } };
  }
  // Breaker panel: the bus bars two pixels apart, the breakers two pixels long, on the grid
  const bp = [sq(3.75, 2.25, 16.5, 18, 2.25, BR), 'M9.75 5.25V17.25M14.25 5.25V17.25', [6.75, 11.25, 15.75].map((y) => `M6.75 ${f(y)}H9.75M14.25 ${f(y)}H17.25`).join('')];
  icons['breaker-panel'].small = { d: bp, fill: { solid: [bp[0]], cut: bp.slice(1) } };
  // Building model: the blocks and the tower's top, without the floors
  const bm = icons['building-model'].d;
  icons['building-model'].small = { d: [bm[0], bm[1]], fill: { solid: [bm[0]], cut: [bm[1]] } };
  // Sink trap, clogged: the clog a solid lump filling the bend (its ring merged with the walls)
  const clog = dot(TRAP.c[0], TRAP.c[1] + TRAP.R, 0.75);
  icons['sink-trap-clog'].small = { d: [...TRAP.d, clog], fill: { solid: icons['sink-trap'].fill.solid, cut: [clog] } };
  // Insulation: the loops become a wave between the faces
  icons.insulation.small = { d: [line([2.25, 5.25], [21.75, 5.25]), line([2.25, 18.75], [21.75, 18.75]), wave(2.25, 12, 6, 3.25, 3)] };
  // Faucet drip: a larger drop
  const fd = [...FAUCET, waterDrop([16.25, 19.5], 1.5)];
  icons['faucet-drip'].small = { d: fd, fill: { solid: [fd[0], shut(fd[1]), shut(fd[2]), fd[4]], wire: [fd[3]] } };
}

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// Already enclosed in a square: they don't get enclosed again
for (const name of ['wall-crack', 'site-plan']) icons[name].variants = { square: false };
// A slash through a lone construction line says nothing
icons['roof-pitch'].variants = { slash: false };

export default { category: 'construccion', label: 'Construcción y arquitectura', icons };
