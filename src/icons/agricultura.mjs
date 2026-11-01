// Agricultura (farming), round 9: farm buildings, fields and land, fences, irrigation, field
// machines seen from the side, growing crops, crop care and soil, beekeeping, and farm tools and
// supplies. Drawn with the engine (engine/geometry.mjs) and the rules in DESIGN.md.
// - Buildings stand on lugares's ground line (GROUND, 2.75–21.25) and take the house's roof pitch;
//   the barn's gambrel is the house's gable broken at its knees.
// - Machines face right in profile on vehiculos's side view: full round wheels whose bottoms sit on
//   one line (20.75) and the construction machines' cab (5 wide, its front window raked at the top).
// - Growing crops share frutas-verduras's single 1.5 stem and its lens leaves; the sprout pieces are
//   lugares's sprout, the leaf pieces lugares's leaf, the map pin lugares's, the drone dispositivos's,
//   the calendar, clipboard, shield, seal and insurance umbrella their families'.
import { arc, badge, circ, dot, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import aviacion from './aviacion.mjs';
import comercio from './comercio.mjs';
import dispositivos from './dispositivos.mjs';
import formas from './formas.mjs';
import frutas from './frutas-verduras.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import personas from './personas.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const plus = (a, b) => [a[0] + b[0], a[1] + b[1]];
const scale = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => scale(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };
/** A path scaled by `s` about the origin and moved by (tx, ty), in absolute coordinates. */
const move = (d, s, tx, ty) => transform(d, s, tx, ty);
/** A path scaled by `s` about `c` and set down with `c` at `to`. */
const place = (d, s, c, to = c) => transform(d, s, to[0] - c[0] * s, to[1] - c[1] * s);
/** Closes an open stroke for `fill.solid` (it only takes closed shapes). */
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
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** A lens leaf from A to B, `w` wide at its middle (frutas-verduras's leaf). */
function leaf(A, B, w) {
  const c = len(sub(B, A));
  const s = w / 2;
  const R = N((s * s + (c * c) / 4) / (2 * s));
  return `M${pt(A)}A${R} ${R} 0 0 1 ${pt(B)}A${R} ${R} 0 0 1 ${pt(A)}Z`;
}

/**
 * An arching leaf from A to B, `w` wide: both edges bow `bend` to the left of A → B (negative: to
 * the right), so the leaf curves like a blade of corn or rice.
 */
function bladeLeaf(A, B, w, bend) {
  const M = lerp(A, B, 0.5);
  const u = unit(sub(B, A));
  const n = [u[1], -u[0]];
  const c1 = plus(M, scale(n, bend + w));
  const c2 = plus(M, scale(n, bend - w));
  return `M${pt(A)}Q${pt(c1)} ${pt(B)}Q${pt(c2)} ${pt(A)}Z`;
}

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

const angOf = ([cx, cy], [x, y]) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
/** The intersections of two circles [x, y, r]. */
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
/**
 * Leaves that overlap, listed front to back (frutas-verduras's construction): each lens (A, B, w)
 * keeps the parts of its two arcs that the lenses in front of it leave visible, and those arcs end
 * on them.
 */
function lenses(list) {
  const geo = list.map(([A, B, w]) => {
    const c = len(sub(B, A));
    const h = w / 2;
    const R = (h * h + (c * c) / 4) / (2 * h);
    const M = lerp(A, B, 0.5);
    const u = scale(sub(B, A), 1 / c);
    const n = [u[1], -u[0]];
    return { A, B, R, C1: sub(M, scale(n, R - h)), C2: plus(M, scale(n, R - h)) };
  });
  const inside = (g, p) => len(sub(p, g.C1)) < g.R - 1e-6 && len(sub(p, g.C2)) < g.R - 1e-6;
  return geo.map((g, i) => {
    const fronts = geo.slice(0, i);
    if (!fronts.length) return `M${pt(g.A)}A${N(g.R)} ${N(g.R)} 0 0 1 ${pt(g.B)}A${N(g.R)} ${N(g.R)} 0 0 1 ${pt(g.A)}Z`;
    const out = [];
    for (const [C, P, Q] of [[g.C1, g.A, g.B], [g.C2, g.B, g.A]]) {
      const a0 = angOf(C, P);
      let a1 = angOf(C, Q);
      while (a1 < a0) a1 += 360;
      const cuts = [a0, a1];
      for (const fg of fronts)
        for (const D of [fg.C1, fg.C2])
          if (len(sub(C, D)) < 2 * g.R)
            for (const p of meet([...C, g.R], [...D, fg.R])) {
              let a = angOf(C, p);
              while (a < a0) a += 360;
              if (a > a0 && a < a1) cuts.push(a);
            }
      cuts.sort((x, y) => x - y);
      for (let k = 0; k < cuts.length - 1; k++) {
        const m = polar(...C, g.R, (cuts[k] + cuts[k + 1]) / 2);
        if (cuts[k + 1] - cuts[k] > 0.5 && !fronts.some((fg) => inside(fg, m))) out.push(`M${pt(polar(...C, g.R, cuts[k]))}A${N(g.R)} ${N(g.R)} 0 0 1 ${pt(polar(...C, g.R, cuts[k + 1]))}`);
      }
    }
    return out.join('');
  });
}

/**
 * Round fruit touching each other (frutas-verduras's grapes and berries), listed front to back:
 * each circle keeps what the ones in front leave visible, its arcs ending on them.
 */
function cluster(cs) {
  return cs.flatMap(([x, y, r], i) => {
    const front = cs.slice(0, i).filter(([u, v, w]) => Math.hypot(u - x, v - y) < r + w);
    if (!front.length) return [circ(x, y, r)];
    const cuts = front.flatMap((c) => meet([x, y, r], c).map((p) => (angOf([x, y], p) + 360) % 360)).sort((a, b) => a - b);
    const seen = (a) => {
      const p = polar(x, y, r, a);
      return front.every(([u, v, w]) => Math.hypot(p[0] - u, p[1] - v) > w);
    };
    const spans = cuts.map((a, k) => [a, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + 360]).filter(([a, b]) => seen((a + b) / 2));
    return spans.map(([a, b]) => arc(x, y, r, a, b).d);
  });
}

/** The seams of a cluster: the arcs of each circle that run inside the ones behind it (its fill's cuts). */
function seams(cs) {
  return cs.flatMap(([x, y, r], i) => {
    const back = cs.slice(i + 1).filter(([u, v, w]) => Math.hypot(u - x, v - y) < r + w);
    if (!back.length) return [];
    const cuts = back.flatMap((c) => meet([x, y, r], c).map((p) => (angOf([x, y], p) + 360) % 360)).sort((a, b) => a - b);
    const spans = cuts.map((a, k) => [a, k + 1 < cuts.length ? cuts[k + 1] : cuts[0] + 360]);
    return spans
      .filter(([a, b]) => {
        const p = polar(x, y, r, (a + b) / 2);
        return back.some(([u, v, w]) => Math.hypot(p[0] - u, p[1] - v) < w) && cs.slice(0, i).every(([u, v, w]) => Math.hypot(p[0] - u, p[1] - v) > w);
      })
      .map(([a, b]) => arc(x, y, r, a, b).d);
  });
}

/** Points along a cubic from p0 through c1, c2 to p1. */
const cubicAt = (p0, c1, c2, p1, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p0[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * p1[k]);
};
/** Where a cubic that only rises (or only falls) crosses the height y. */
const cubicAtY = (p0, c1, c2, p1, y) => {
  let [a, b] = [0, 1];
  const up = cubicAt(p0, c1, c2, p1, 1)[1] > p0[1];
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (cubicAt(p0, c1, c2, p1, m)[1] < y === up) a = m;
    else b = m;
  }
  return cubicAt(p0, c1, c2, p1, (a + b) / 2);
};

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
// The ground line and the roof pitch of lugares's buildings
const GROUND = 20.75;
const PITCH = 7.75 / 9.25;
const ground = (x0 = 2.75, x1 = 21.25) => line([x0, GROUND], [x1, GROUND]);
/** A door standing on the ground: w wide, its top at y, corners of r. */
const doorway = (cx, w, y, r = 0.75) => roundline([[cx - w / 2, GROUND], [cx - w / 2, y], [cx + w / 2, y], [cx + w / 2, GROUND]], [0, r, r, 0]);
/**
 * A tuft of young blades (rice, a crop) from its foot, `h` tall: they rise together, nearly upright,
 * and only bend out near their tips, the tallest a little to the right, the right one shorter, like
 * grass. (Blades that fanned out straight from the foot met there in a V: the tufts read as arrows
 * pointing down.) One stroke.
 */
const blades = ([x, y], h, spread = 1) => {
  const k = h / 10.5;
  const q = (c, e) => `M${pt([x, y])}Q${pt([x + c[0] * k * spread, y + c[1] * k])} ${pt([x + e[0] * k * spread, y + e[1] * k])}`;
  return q([0, -6.5], [1.25, -10.5]) + q([-0.4, -6], [-3, -9]) + q([0.4, -4.25], [2.75, -6.75]);
};
/**
 * The barn's gambrel, on lugares's roof construction: the roof a line whose eaves run on 0.75 past
 * the walls, the walls standing under it from x0 to x1 (they start where they meet it). The lower
 * slopes rise steeply from the eaves at `eave` to the knees, the upper ones at the house's pitch to the
 * ridge at `top`. Returns the roof and the walls as strokes and the whole front as a closed shape.
 */
function gambrel(x0, x1, eave, top) {
  const cx = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  const kx = half * 0.62;
  const knee = top + kx * PITCH;
  const drop = ((eave - knee) / (cx - kx - x0)) * 0.75;
  const pts = [[x0 - 0.75, eave + drop], [cx - kx, knee], [cx, top], [cx + kx, knee], [x1 + 0.75, eave + drop]];
  const roof = roundline(pts, [0, 0.9, 1.1, 0.9, 0]);
  const walls = [line([x0, eave], [x0, GROUND]), line([x1, eave], [x1, GROUND])];
  const solid = `${roof}L${pt([x1, eave])}V${N(GROUND)}H${N(x0)}V${N(eave)}Z`;
  return { roof, walls, solid };
}
/** A braced barn door: the doorway and its X. */
const barnDoor = (cx, w, y) => [doorway(cx, w, y, 0.5), line([cx - w / 2, y], [cx + w / 2, GROUND]), line([cx + w / 2, y], [cx - w / 2, GROUND])];

// lugares's sprout: stem, left leaf, right leaf and its ground
const SPROUT = lugares.icons.sprout.d;
/**
 * lugares's sprout at a small size: its stem and two leaves scaled by s about its foot, set down at
 * `at`, but each leaf kept at least 2.6 wide (scaled with the rest, a leaf's inside closed up at
 * bold). `lift` raises the leaves on a longer stem, clear of the ground under them; `ground` adds
 * the sprout's own ground, scaled.
 */
function sprig(s, at, { lift = 0, ground: withGround = false } = {}) {
  const P = (p) => [at[0] + (p[0] - 12) * s, at[1] + (p[1] - 21) * s - lift];
  const w = Math.max(3.5 * s, 2.6);
  const d = [line(at, P([12, 10.5])), leaf(P([12, 14.75]), P([4.5, 10]), w), leaf(P([12, 10.25]), P([19.5, 5]), w)];
  return withGround ? [...d, line([at[0] - 4.5 * s, at[1]], [at[0] + 4.5 * s, at[1]])] : d;
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Farm buildings ────────────────────────────────────────────────────────────────────────────
{
  // Barn: the gambrel front, the braced double door and the hayloft window above it
  const g = gambrel(4.75, 19.25, 11, 3.25);
  add('barn', ['granero', 'establo', 'rancho', 'barn', 'farm building', 'stable'], [g.roof, ...g.walls, ground(), ...barnDoor(12, 8, 14.25), sq(10.38, 7.75, 3.25, 3.25, 0.75)]);
  icons.barn.fill = { solid: [g.solid], wire: [icons.barn.d[3]], cut: icons.barn.d.slice(4) };
  icons.barn.parts = { roof: [0], walls: [1, 2], ground: [3], door: [4, 5, 6], window: [7] };
}
{
  // Farm: a smaller barn with the domed silo beside it, on one ground line
  const g = gambrel(10.5, 20.5, 13.5, 7.5);
  const silo = `M3.25 ${GROUND}V5.5A1.75 1.75 0 0 1 6.75 5.5V${GROUND}`;
  add('farm', ['granja', 'finca', 'rancho', 'agricultura', 'farm', 'ranch', 'agriculture'], [g.roof, ...g.walls, silo, ground(), ...barnDoor(15.5, 5, 16)]);
  // Filled, the small door keeps its outline only: its brace's four slivers of ink closed up at bold
  icons.farm.fill = { solid: [g.solid, shut(silo)], wire: [icons.farm.d[4]], cut: [icons.farm.d[5]] };
  icons.farm.parts = { roof: [0], walls: [1, 2], silo: [3], ground: [4], door: [5, 6, 7] };
}
{
  // Silo: the cylinder under its dome, the dome's seam and a hoop band, and the ladder up its side
  // (a rail outside the wall, its rungs the bands carried across to it)
  const [x0, x1] = [5.75, 15.25];
  const r = (x1 - x0) / 2;
  const cy = 8.25;
  const body = `M${x0} ${GROUND}V${cy}A${N(r)} ${N(r)} 0 0 1 ${x1} ${cy}V${GROUND}`;
  const rail = 18.25;
  add('silo', ['silo', 'almacén de grano', 'granos', 'silo', 'grain storage', 'grain bin'], [
    body,
    ground(),
    line([x0, cy], [x1, cy]),
    line([x0, 13], [rail, 13]),
    line([x0, 17.25], [rail, 17.25]),
    line([rail, 10], [rail, GROUND]),
  ]);
  icons.silo.fill = { solid: [shut(body)], wire: [icons.silo.d[1], icons.silo.d[5], line([x1, 13], [rail, 13]), line([x1, 17.25], [rail, 17.25])], cut: [line([x0, cy], [x1, cy]), line([x0, 13], [x1, 13]), line([x0, 17.25], [x1, 17.25])] };
  icons.silo.parts = { silo: [0, 2], ground: [1], ladder: [3, 4, 5] };
}
{
  // Greenhouse: a house of glass, its gable at the house's pitch, two mullions up to the roof and
  // one transom across
  const apex = [12, 4.5];
  const [x0, x1] = [4.25, 19.75];
  const at = (x) => apex[1] + Math.abs(x - apex[0]) * PITCH;
  const house = roundpoly([[x0, GROUND], [x0, at(x0)], apex, [x1, at(x1)], [x1, GROUND]], [0, 0.6, 1.1, 0.6, 0]);
  add('greenhouse', ['invernadero', 'vivero', 'cultivo protegido', 'greenhouse', 'nursery', 'indoor growing'], [
    house,
    ground(),
    line([9.25, at(9.25)], [9.25, GROUND]),
    line([14.75, at(14.75)], [14.75, GROUND]),
    line([x0, 14], [x1, 14]),
  ]);
  icons.greenhouse.fill = { solid: [house], wire: [icons.greenhouse.d[1]], cut: icons.greenhouse.d.slice(2) };
  icons.greenhouse.parts = { house: [0], ground: [1], frame: [2, 3, 4] };
}
{
  // Polytunnel: a plastic tunnel seen from its front corner, on the ground line. The front arch is a
  // tall half ellipse with the door in it; the hoops behind it are the same arch stepped back up to
  // the right, each one showing from where it rises out of the one in front, their feet on the
  // tunnel's receding side. (The camping tunnel tent recedes level and keeps a pointed arch.)
  const F = [8.25, GROUND];
  const [rx, ry] = [5.5, 9.75];
  const k = rx / ry;
  const s = [3.5, -1.75];
  const C = [F, plus(F, s), plus(F, scale(s, 2))];
  const foot = (c) => [c[0] + rx, c[1]];
  const A = `A${N(rx)} ${N(ry)} 0 0 1`;
  // The upper point where a hoop rises out of the one in front of it (worked out with the arches
  // squeezed into circles)
  const rise = (a, b) => {
    const [p] = meet([a[0], a[1] * k, rx], [b[0], b[1] * k, rx]).sort((u, v) => u[1] - v[1]);
    return [p[0], p[1] / k];
  };
  const semi = (c) => `M${pt([c[0] - rx, c[1]])}${A} ${pt(foot(c))}Z`;
  const hoop = (i) => `M${pt(rise(C[i - 1], C[i]))}${A} ${pt(foot(C[i]))}`;
  const front = `M${pt([F[0] - rx, F[1]])}${A} ${pt(foot(F))}`;
  const side = line(foot(F), foot(C[2]));
  add('polytunnel', ['túnel de cultivo', 'macrotúnel', 'invernadero de plástico', 'polytunnel', 'high tunnel', 'hoop house'], [
    front,
    hoop(1),
    hoop(2),
    side,
    ground(),
    doorway(F[0], 3.5, 15.75),
  ]);
  const d = icons.polytunnel.d;
  // Filled: the three arches and the strip their feet sweep; the front arch's inner half (from where
  // the first hoop rises), that hoop and the door are cut out
  const sweep = `M${pt([F[0] - rx, F[1]])}L${pt(foot(F))}L${pt(foot(C[2]))}L${pt([C[2][0] - rx, C[2][1]])}Z`;
  const inner = `M${pt(rise(C[0], C[1]))}${A} ${pt(foot(F))}`;
  icons.polytunnel.fill = { solid: [...C.map(semi), sweep], cut: [inner, d[1], d[5]], wire: [d[3], d[4]] };
  icons.polytunnel.parts = { tunnel: [0, 1, 2, 3], ground: [4], door: [5] };
  // At 16 px the middle hoop runs into its neighbours: the front arch and the far one alone
  const far = `M${pt(rise(C[0], C[2]))}${A} ${pt(foot(C[2]))}`;
  const innerFar = `M${pt(rise(C[0], C[2]))}${A} ${pt(foot(F))}`;
  icons.polytunnel.small = {
    d: [front, far, side, ground(), doorway(F[0], 3.5, 15.75)],
    fill: { solid: [semi(C[0]), semi(C[2]), sweep], cut: [innerFar, doorway(F[0], 3.5, 15.75)], wire: [side, ground()] },
  };
}
{
  // Chicken coop: a gabled hut on legs, its round pop hole and the slatted ramp down to the ground
  const apex = [9.5, 4.25];
  const at = (x) => apex[1] + Math.abs(x - apex[0]) * PITCH;
  const [x0, x1, floor] = [4.25, 14.75, 14.75];
  const roof = roundline([[2.75, at(2.75)], apex, [16.25, at(16.25)]], [0, 1.1, 0]);
  const hut = roundline([[x0, at(x0)], [x0, floor], [x1, floor], [x1, at(x1)]], [0, 1, 0, 0]);
  const ramp = [x1, floor];
  const foot = [20.5, GROUND];
  const dir = unit(sub(foot, ramp));
  const nrm = [-dir[1], dir[0]];
  // Cleats stand on the ramp's upper side, away from the ground
  const slat = (t) => {
    const c = lerp(ramp, foot, t);
    return line(c, plus(c, scale(nrm, -2.1)));
  };
  add('chicken-coop', ['gallinero', 'aves de corral', 'huevos', 'gallinas', 'chicken coop', 'hen house', 'poultry'], [
    roof,
    hut,
    line([6, floor], [6, GROUND]),
    line([13, floor], [13, GROUND]),
    ground(),
    circ(10, 10.5, 1.25),
    line(ramp, foot),
    slat(0.28),
    slat(0.64),
  ]);
  icons['chicken-coop'].fill = { solid: [shut(`${roof}L${pt([x1, at(x1)])}L${pt([x1, floor])}L${pt([x0, floor])}L${pt([x0, at(x0)])}`)], wire: [icons['chicken-coop'].d[2], icons['chicken-coop'].d[3], icons['chicken-coop'].d[4], icons['chicken-coop'].d[6], icons['chicken-coop'].d[7], icons['chicken-coop'].d[8]], cut: [icons['chicken-coop'].d[5]] };
  icons['chicken-coop'].parts = { roof: [0], hut: [1], legs: [2, 3], ground: [4], door: [5], ramp: [6, 7, 8] };
}
{
  // Orchard: three round trees in a row, the middle one taller and in front (a custom badge: the
  // engine clears the ones behind it), a fruit in each crown
  const side = (x) => [circ(x, 13.75, 3.25), line([x, 17], [x, GROUND]), dot(x, 13.75)];
  const crown = circ(12, 7, 3.5);
  const trunk = line([12, 10.5], [12, GROUND]);
  const fruit = dot(12, 7);
  add('orchard', ['huerto', 'frutales', 'árboles frutales', 'orchard', 'fruit trees', 'fruit farm'], [...side(5.25), ...side(18.75), ground()], {
    badge: { d: [crown, trunk, fruit], knock: crown, fill: { solid: [crown], wire: [trunk], cut: [fruit] } },
  });
  const d = icons.orchard.d;
  icons.orchard.fill = { solid: [d[0], d[3]], wire: [d[1], d[4], d[6]], cut: [d[2], d[5]] };
  icons.orchard.parts = { trees: [0, 1, 2, 3, 4, 5], ground: [6] };
}
{
  // Vineyard: two trellis posts and the wire between them, the vine's leaf on the wire and
  // frutas-verduras's grape cluster hanging from it, smaller
  const wire = 7;
  const at = (d) => place(d, 0.6, [12, 7.75], [11.25, 9.25]);
  const grapes = frutas.icons.grapes.d.slice(0, 6).map(at);
  add('vineyard', ['viñedo', 'vid', 'uvas', 'vino', 'vineyard', 'vine', 'winery'], [
    line([4.25, 5.25], [4.25, GROUND]),
    line([19.75, 5.25], [19.75, GROUND]),
    line([4.25, wire], [19.75, wire]),
    leaf([13.25, wire], [16.25, 3.25], 3),
    line([11.25, wire], [11.25, 9.25]),
    ...grapes,
  ]);
  const d = icons.vineyard.d;
  icons.vineyard.fill = { solid: [d[3], ...frutas.icons.grapes.d.slice(0, 6).map((x) => shut(at(x)))], wire: [d[0], d[1], d[2], d[4]] };
  icons.vineyard.parts = { trellis: [0, 1, 2], leaf: [3], grapes: [4, 5, 6, 7, 8, 9, 10] };
}
{
  // Rice paddy: three tufts of shoots standing in water (two ripples)
  // The tufts stand on the crests of the upper ripple (5 half waves of 3.7 from 2.75)
  const yw = 16.5;
  const h = 18.5 / 5;
  const tuft = (x) => blades([x, yw - 1], 10, 0.85);
  add('rice-paddy', ['arrozal', 'campo de arroz', 'cultivo inundado', 'rice paddy', 'paddy field', 'rice field'], [
    ripple(yw, 2.75, 5, h),
    ripple(20.25, 2.75, 5, h),
    tuft(2.75 + h / 2),
    tuft(12),
    tuft(21.25 - h / 2),
  ]);
  icons['rice-paddy'].parts = { water: [0, 1], rice: [2, 3, 4] };
}
{
  // Terraced field: a hillside cut into three ledges, a tuft of crop on each
  const steps = [[2.75, GROUND], [2.75, 16.75], [8.5, 16.75], [9.25, 12.25], [14.75, 12.25], [15.5, 7.75], [21.25, 7.75], [21.25, GROUND]];
  const hill = roundpoly(steps, [0, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 0]);
  const tuft = (x, y) => blades([x, y], 4.5);
  add('terraced-field', ['terrazas', 'cultivo en terrazas', 'ladera', 'terraced field', 'terraces', 'hillside farming'], [hill, tuft(4.75, 16.75), tuft(10.75, 12.25), tuft(17, 7.75)]);
  icons['terraced-field'].fill = { solid: [hill], wire: [1, 2, 3].map((i) => icons['terraced-field'].d[i]) };
  icons['terraced-field'].parts = { hill: [0], crops: [1, 2, 3] };
}
{
  // Farmland: a square of land seen from above, split into four plots by a slanted lane and two
  // uneven boundaries; two of them are planted, their rows running different ways. (At the full
  // square the plots and their rows came to 32% ink: the land is 15.5 wide.)
  const [x0, x1] = [4.25, 19.75];
  const xAt = (y) => 13.5 + (y - x0) * (-0.75 / (x1 - x0));
  const [yl, yr] = [13.25, 10.75];
  add('farmland', ['tierras de cultivo', 'parcelas', 'uso de suelo', 'farmland', 'parcels', 'land use'], [
    sq(x0, x0, x1 - x0, x1 - x0, 3, BR),
    line([xAt(x0), x0], [xAt(x1), x1]),
    line([x0, yl], [xAt(yl), yl]),
    line([xAt(yr), yr], [x1, yr]),
    line([7.25, yl], [7.25, x0 + 3]),
    line([10.25, yl], [10.25, x0 + 3]),
    line([xAt(13.75), 13.75], [x1 - 3, 13.75]),
    line([xAt(16.75), 16.75], [x1 - 3, 16.75]),
  ]);
  icons.farmland.fill = { solid: [icons.farmland.d[0]], cut: icons.farmland.d.slice(1) };
  icons.farmland.parts = { land: [0], boundaries: [1, 2, 3], rows: [4, 5, 6, 7] };
}
{
  // Pasture: a rolling hill behind a wire fence of two posts and two strands, on the ground
  add('pasture', ['potrero', 'pastizal', 'pastoreo', 'pradera', 'pasture', 'grazing', 'paddock'], [
    'M2.75 10.25C5 8 7.5 6.75 9.75 6.75S13.75 8.75 16 8.75S19.5 7 21.25 6.25',
    line([7, 12.25], [7, GROUND]),
    line([17, 12.25], [17, GROUND]),
    line([2.75, 14.75], [21.25, 14.75]),
    line([2.75, 17.75], [21.25, 17.75]),
    ground(),
  ]);
  icons.pasture.parts = { hill: [0], fence: [1, 2, 3, 4], ground: [5] };
}
{
  // Water well: the round stone curb, two posts on it under
  // a gabled roof, the winch's axle between them and the rope down to the bucket. (A thin curb under
  // a tall roof made a house with a bucket in it.)
  const apex = [12, 2.75];
  const at = (x) => apex[1] + Math.abs(x - apex[0]) * PITCH;
  const roof = roundline([[3.75, at(3.75)], apex, [20.25, at(20.25)]], [0, 1.1, 0]);
  const curb = sq(4.75, 15.75, 14.5, 5, 2);
  const bucket = roundpoly([[10, 9.75], [14, 9.75], [13.4, 12.75], [10.6, 12.75]], [0.5, 0.5, 0.75, 0.75]);
  add('water-well', ['pozo', 'pozo de agua', 'agua subterránea', 'water well', 'well', 'groundwater'], [
    curb,
    roof,
    line([7, at(7)], [7, 15.75]),
    line([17, at(17)], [17, 15.75]),
    line([7, 7.75], [17, 7.75]),
    line([12, 7.75], [12, 9.75]),
    bucket,
  ]);
  const d = icons['water-well'].d;
  icons['water-well'].fill = { solid: [curb, shut(roof), bucket], wire: [d[2], d[3], d[4], d[5]] };
  icons['water-well'].parts = { curb: [0], roof: [1], posts: [2, 3], winch: [4], bucket: [5, 6] };
}
{
  // Vertical farm: a rack of two tiers on its shelf, lugares's sprout growing on each, one above the
  // other. (Three tiers left room only for forked stems, which read as chevrons.)
  const rack = sq(4.75, 2.75, 14.5, 18.5, 3.5, BR);
  const shelf = 12;
  add('vertical-farm', ['granja vertical', 'cultivo interior', 'agricultura urbana', 'vertical farm', 'indoor farm', 'controlled environment'], [
    rack,
    line([4.75, shelf], [19.25, shelf]),
    ...sprig(0.36, [12, shelf]),
    ...sprig(0.36, [12, 21.25]),
  ]);
  const d = icons['vertical-farm'].d;
  icons['vertical-farm'].fill = { solid: [rack], cut: d.slice(1) };
  icons['vertical-farm'].parts = { rack: [0, 1], plants: [2, 3, 4, 5, 6, 7] };
}
{
  // Hydroponics: lugares's sprout in a net cup set into the lid of a tank, its roots dangling into
  // the water inside
  const lid = 11;
  const tank = sq(3.25, lid, 17.5, GROUND - lid, 3, BR);
  const cup = roundline([[8.75, lid], [9.75, 13.5], [14.25, 13.5], [15.25, lid]], [0, 0.75, 0.75, 0]);
  const yw = 17;
  add('hydroponics', ['hidroponía', 'cultivo sin suelo', 'solución nutritiva', 'hydroponics', 'soilless', 'water culture'], [
    tank,
    cup,
    ...sprig(0.5, [12, lid]),
    ripple(yw, 3.25, 6, 17.5 / 6, 0.6),
    'M10.75 13.5C10.75 15.25 10.25 16.25 10.25 17.9',
    'M13.25 13.5C13.25 15.25 13.75 16.25 13.75 17.9',
  ]);
  const d = icons.hydroponics.d;
  icons.hydroponics.fill = { solid: [tank, d[3], d[4]], wire: [d[2]], cut: [d[1], d[5], d[6], d[7]] };
  icons.hydroponics.parts = { tank: [0], cup: [1], plant: [2, 3, 4], water: [5], roots: [6, 7] };
}

// ── Fences and gates ──────────────────────────────────────────────────────────────────────────
{
  // Farm gate: five bars and a diagonal brace in a frame, hung on its post
  const [x0, x1] = [4.75, 19.25];
  const ys = [6.5, 9.5, 12.5, 15.5, 18.5];
  add('farm-gate', ['portón', 'tranquera', 'puerta de campo', 'farm gate', 'field gate', 'ranch gate'], [
    line([x0, 3.25], [x0, GROUND]),
    roundline([[x0, ys[0]], [x1, ys[0]], [x1, ys[4]], [x0, ys[4]]], [0, 0.75, 0.75, 0]),
    ...ys.slice(1, 4).map((y) => line([x0, y], [x1, y])),
    line([x0, ys[4]], [x1, ys[0]]),
  ]);
  icons['farm-gate'].parts = { post: [0], gate: [1, 2, 3, 4, 5] };
}
{
  // Electric fence: two posts carrying two strands on their insulators, and the core bolt across the
  // strands (a custom badge: the engine clears them around it). The strands cross the bolt at its
  // tips: where they passed under its wings, the clearance shaved them into slivers.
  const bolt = place(nucleo.icons.bolt.d[0], 0.62, [12, 12]);
  add('electric-fence', ['cerco eléctrico', 'pastor eléctrico', 'electrificador', 'electric fence', 'energizer', 'fence voltage'], [
    line([5, 4.25], [5, GROUND]),
    line([19, 4.25], [19, GROUND]),
    line([2.75, 7], [21.25, 7]),
    line([2.75, 16.5], [21.25, 16.5]),
    dot(5, 7),
    dot(19, 7),
    dot(5, 16.5),
    dot(19, 16.5),
  ], { badge: { d: [bolt], knock: bolt, fill: { solid: [bolt] } } });
  const d = icons['electric-fence'].d;
  icons['electric-fence'].fill = { solid: d.slice(4), wire: d.slice(0, 4) };
  icons['electric-fence'].parts = { posts: [0, 1], wires: [2, 3], insulators: [4, 5, 6, 7] };
}
{
  // Barbed wire: one strand across and three barbs, each two short wires crossing on it
  const barb = (x) => [line([x - 1.75, 10], [x + 1.75, 14]), line([x + 1.75, 10], [x - 1.75, 14])];
  add('barbed-wire', ['alambre de púas', 'alambrado', 'cerca', 'barbed wire', 'fence wire', 'perimeter'], [line([2.75, 12], [21.25, 12]), ...barb(4.75), ...barb(12), ...barb(19.25)]);
  icons['barbed-wire'].parts = { strand: [0], barbs: [1, 2, 3, 4, 5, 6] };
}

// ── Places ────────────────────────────────────────────────────────────────────────────────────
{
  // A grower on the map: lugares's pin with a small sprout in its head, all of it 3 clear of the pin
  const pin = lugares.icons['map-pin'].d[0];
  const stem = line([12, 14.25], [12, 9.75]);
  add('map-pin-sprout', ['productor local', 'granja cercana', 'origen', 'local grower', 'farm nearby', 'farm locator'], [
    pin,
    stem,
    leaf([12, 12], [8.85, 9.75], 2.5),
    leaf([12, 10], [14.85, 7.5], 2.5),
  ]);
  const d = icons['map-pin-sprout'].d;
  icons['map-pin-sprout'].fill = { solid: [pin], cut: [d[1], d[2], d[3]] };
  icons['map-pin-sprout'].parts = { pin: [0], sprout: [1, 2, 3] };
}
{
  // Scarecrow: the farmer's wide-brimmed hat over a round head, its shirt hanging from the arms
  // stretched out along the crossbar, straw at the hands, on its post
  const yb = 6;
  const C = [12, 8];
  const r = 2.5;
  const arm = 12.5;
  const a = (Math.asin((yb - C[1]) / r) * 180) / Math.PI;
  const headD = arc(...C, r, a, 180 - a).d;
  const tuft = (x, s) => [line([x, arm], [x - s * 2.25, arm - 2]), line([x, arm], [x - s * 2.5, arm + 0.5]), line([x, arm], [x - s * 1.75, arm + 2.25])].join('');
  add('scarecrow', ['espantapájaros', 'espantajo', 'cosecha', 'scarecrow', 'harvest', 'bird deterrent'], [
    roundpoly([[9.5, yb], [10.1, 2.75], [13.9, 2.75], [14.5, yb]], [0, 1.25, 1.25, 0]),
    line([6.25, yb], [17.75, yb]),
    headD,
    line([12, C[1] + r], [12, arm]),
    line([5.25, arm], [18.75, arm]),
    roundline([[9, arm], [8.25, 17.5], [15.75, 17.5], [15, arm]], [0, 0.75, 0.75, 0]),
    line([12, 17.5], [12, 21.25]),
    tuft(5.25, 1),
    tuft(18.75, -1),
  ]);
  const d = icons.scarecrow.d;
  icons.scarecrow.fill = { solid: [d[0], shut(headD), shut(d[5])], wire: [d[1], d[3], d[4], d[6], d[7], d[8]] };
  icons.scarecrow.parts = { hat: [0, 1], head: [2, 3], arms: [4, 7, 8], shirt: [5], post: [6] };
}


// ── Beekeeping ────────────────────────────────────────────────────────────────────────────────
{
  // Beehive: a skep, a dome of stacked straw bands on its board, the arched entrance at its foot
  const L = [[4.5, GROUND], [4.5, 11.5], [7.25, 4], [12, 4]];
  const R = L.map(([x, y]) => [24 - x, y]);
  const dome = `M${pt(L[0])}C${pt(L[1])} ${pt(L[2])} ${pt(L[3])}C${pt(R[2])} ${pt(R[1])} ${pt(R[0])}`;
  const band = (y) => {
    const p = cubicAtY(...L, y);
    return line(p, [24 - p[0], y]);
  };
  const door = arc(12, GROUND, 2, 180, 360).d;
  add('beehive', ['colmena', 'apicultura', 'miel', 'abejas', 'beehive', 'beekeeping', 'honey'], [dome, ground(), band(8), band(11.75), band(15.75), door]);
  const d = icons.beehive.d;
  icons.beehive.fill = { solid: [shut(dome)], wire: [d[1]], cut: [d[2], d[3], d[4], door] };
  icons.beehive.parts = { hive: [0, 2, 3, 4], ground: [1], entrance: [5] };
}
{
  // Box hive: two stacked boxes under a gabled lid, the entrance slot in the lower one, on a short
  // stand
  const lid = roundpoly([[2.75, 8], [12, 4], [21.25, 8]], [0.4, 1, 0.4]);
  const boxes = roundline([[5, 8], [5, 18.75], [19, 18.75], [19, 8]], [0, 0.75, 0.75, 0]);
  add('beehive-box', ['caja de colmena', 'colmenar', 'apiario', 'beehive box', 'apiary', 'hive box'], [
    lid,
    boxes,
    line([5, 12.75], [19, 12.75]),
    line([10, 15.75], [14, 15.75]),
    line([7, 18.75], [7, GROUND]),
    line([17, 18.75], [17, GROUND]),
  ]);
  const d = icons['beehive-box'].d;
  icons['beehive-box'].fill = { solid: [lid, shut(boxes)], cut: [d[2], d[3]], wire: [d[4], d[5]] };
  icons['beehive-box'].parts = { lid: [0], boxes: [1, 2], entrance: [3], stand: [4, 5] };
}
{
  // Beekeeper: personas's farmer (the person under a wide-brimmed hat) with the veil falling from
  // the brim to the shoulders, 3 clear of the face
  const [headD, body, crown, brim] = personas.icons.farmer.d;
  // The veil falls from the brim 2.25 in from its ends and gathers onto the body's shoulders, where
  // its outline (from its top, 12 14.65, down its left side) reaches x 8.25
  const p0 = [12, 14.65];
  const c1 = [8.94, 14.65];
  const c2 = [6.48, 16.22];
  const p1 = [5.86, 18.97];
  let t = 0.5;
  for (let i = 0, [a, b] = [0, 1]; i < 50; i++) {
    t = (a + b) / 2;
    if (cubicAt(p0, c1, c2, p1, t)[0] > 8.25) a = t;
    else b = t;
  }
  const sh = cubicAt(p0, c1, c2, p1, t);
  const veilL = `M5 7.75C5 11.5 ${N(sh[0] - 2)} ${N(sh[1] - 1.5)} ${pt(sh)}`;
  const veilR = flipPath(veilL);
  add('beekeeper', ['apicultor', 'apicultora', 'colmenero', 'beekeeper', 'apiarist', 'bee farmer'], [headD, body, crown, brim, veilL, veilR]);
  icons.beekeeper.fill = { solid: [body, crown, `${veilL}L${pt([24 - sh[0], sh[1]])}C${N(26 - sh[0])} ${N(sh[1] - 1.5)} 19 11.5 19 7.75Z`], wire: [brim], cut: [headD] };
  icons.beekeeper.parts = { head: [0], body: [1], hat: [2, 3], veil: [4, 5] };
}

// ── Field machines ────────────────────────────────────────────────────────────────────────────
// The tractor faces right on vehiculos's side view: the big rear wheel in front of the body (a
// custom badge: the engine clears the body behind it) with its hub, the cab over the rear axle
// (vehiculos's construction cab), the hood ahead of it with its upright exhaust, and the small front
// wheel under the hood, 3 below it. `tractor(s, at)` scales it about its rear foot (2.75, 20.75)
// and sets that foot down at `at`.
const TRACTOR = (() => {
  const body = roundpoly([[5, 12.75], [5, 4.75], [8.5, 4.75], [10, 6.5], [10, 9.25], [20.75, 9.25], [20.75, 12.75]], [0.75, 1, 0.75, 0.75, 0, 1, 0.75]);
  return {
    body,
    exhaust: line([16.5, 9.25], [16.5, 5.75]),
    front: circ(18.25, 18.25, 2.5),
    tire: circ(7.5, 16.25, 4.5),
    hub: dot(7.5, 16.25),
  };
})();
function tractor(s = 1, at = [2.75, GROUND]) {
  const m = (d) => place(d, s, [2.75, GROUND], at);
  const t = Object.fromEntries(Object.entries(TRACTOR).map(([k, d]) => [k, m(d)]));
  return { ...t, badge: { d: [t.tire, t.hub], knock: t.tire, fill: { solid: [t.tire], cut: [t.hub] } } };
}
{
  const t = tractor();
  add('tractor', ['tractor', 'maquinaria agrícola', 'labranza', 'agro', 'tractor', 'farm machinery', 'agriculture'], [t.body, t.exhaust, t.front], { badge: t.badge });
  icons.tractor.fill = { solid: [t.body, t.front], wire: [t.exhaust] };
  icons.tractor.parts = { body: [0], exhaust: [1], wheels: [2] };
}
{
  // With a front loader: the tractor smaller, the loader arm from its cab out over the hood and down
  // to the bucket ahead of the front wheel
  const s = 0.72;
  const t = tractor(s, [2.75, GROUND]);
  const at = (x, y) => [2.75 + (x - 2.75) * s, GROUND + (y - GROUND) * s];
  const [ax, ay] = at(8.5, 4.75);
  const arm = roundline([[ax, ay], [17.25, ay], [19.25, 14.75]], [0, 1.25, 0]);
  const bucket = roundpoly([[18.25, 14.75], [21.5, 14.75], [21.5, GROUND], [19.25, GROUND]], [0.5, 0.75, 0, 0.75]);
  // (The loader's arm runs where the exhaust stood: it is left off.)
  add('tractor-loader', ['tractor con cargador', 'pala frontal', 'cargador frontal', 'tractor loader', 'front loader', 'loader'], [t.body, t.front, arm, bucket], { badge: t.badge });
  icons['tractor-loader'].fill = { solid: [t.body, t.front, bucket], wire: [arm] };
  icons['tractor-loader'].parts = { body: [0], wheels: [1], arm: [2], bucket: [3] };
}
{
  // Autonomous: the tractor smaller, two signal arcs rising from its cab roof
  const s = 0.72;
  const t = tractor(s, [4.25, GROUND]);
  const roof = [4.25 + (6.75 - 2.75) * s, GROUND + (4.75 - GROUND) * s];
  add('tractor-autonomous', ['tractor autónomo', 'autoguiado', 'telemetría', 'agricultura de precisión', 'autonomous tractor', 'auto-guidance', 'telematics'], [
    t.body,
    t.exhaust,
    t.front,
    arc(...roof, 3.5, -120, -60).d,
    arc(...roof, 6.5, -120, -60).d,
  ], { badge: t.badge });
  icons['tractor-autonomous'].fill = { solid: [t.body, t.front], wire: [t.exhaust], lines: [icons['tractor-autonomous'].d[3], icons['tractor-autonomous'].d[4]] };
  icons['tractor-autonomous'].parts = { body: [0], exhaust: [1], wheels: [2], signal: [3, 4] };
}
{
  // Crop duster: aviacion's propeller plane flying low, its trail of spray falling behind the wing
  const plane = aviacion.icons['propeller-plane'].d.slice(0, 4).map((d) => move(d, 1, 0.5, -2.25));
  const drop = ([x, y], l = 3) => line([x, y], [x - l * 0.36, y + l]);
  add('crop-duster', ['avioneta fumigadora', 'fumigación aérea', 'aspersión', 'crop duster', 'aerial application', 'crop spraying'], [...plane, ...[[6, 14.75], [9.5, 14.75], [13, 14.75]].map((p) => drop(p, 5))]);
  const d = icons['crop-duster'].d;
  icons['crop-duster'].fill = { solid: [d[0]], cut: [d[1]], wire: [d[2], d[3]], lines: d.slice(4) };
  icons['crop-duster'].parts = { plane: [0, 1, 2, 3], spray: [4, 5, 6] };
}
// Dispositivos's drone (body, arms, rotor posts and rotors) without its legs, 3.5 higher, as in
// logistica's drone delivery
const DRONE = dispositivos.icons.drone.d.slice(0, 7).map((d) => move(d, 1, 0, -3.5));
{
  // Spraying: three lines of spray falling under it
  const col = (x) => [line([x, 14.25], [x, 16.25]), line([x, 19.25], [x, 21.25])];
  add('drone-spraying', ['dron fumigador', 'aspersión con dron', 'aplicación de precisión', 'spraying drone', 'drone spraying', 'precision spraying'], [...DRONE, ...col(8.75), ...col(12), ...col(15.25)]);
  const d = icons['drone-spraying'].d;
  icons['drone-spraying'].fill = { solid: [d[0]], wire: d.slice(1, 7), lines: d.slice(7) };
  icons['drone-spraying'].parts = { body: [0], arms: [1, 2, 3, 4], rotors: [5, 6], spray: [7, 8, 9, 10, 11, 12] };
}
{
  // Mapping: over four corner brackets marking a plot on the ground
  const y0 = 13.25;
  const corner = (x, y, sx, sy) => roundline([[x, y + sy * 2.25], [x, y], [x + sx * 3, y]], [0, 1.25, 0]);
  add('drone-mapping', ['dron cartográfico', 'mapeo aéreo', 'ortofoto', 'drone mapping', 'aerial survey', 'field mapping'], [
    ...DRONE,
    corner(3.25, y0, 1, 1),
    corner(20.75, y0, -1, 1),
    corner(20.75, GROUND, -1, -1),
    corner(3.25, GROUND, 1, -1),
  ]);
  const d = icons['drone-mapping'].d;
  icons['drone-mapping'].fill = { solid: [d[0]], wire: d.slice(1, 7), lines: d.slice(7) };
  icons['drone-mapping'].parts = { body: [0], arms: [1, 2, 3, 4], rotors: [5, 6], frame: [7, 8, 9, 10] };
}

// ── Irrigation ────────────────────────────────────────────────────────────────────────────────
// The sprinkler: an impact head on its riser, its nozzle raked up to the right, throwing its jet in
// spurts along one arc that falls as drops. (A jet to each side made a face of the head and its
// drops: brows, eyes and a nose; a jet that started off the nozzle's tip, a loose arc.)
/** A point on the quadratic from p0 through c to p1, and the piece of it between t0 and t1. */
const qAt = (p0, c, p1, t) => [0, 1].map((k) => (1 - t) * (1 - t) * p0[k] + 2 * (1 - t) * t * c[k] + t * t * p1[k]);
const qPiece = (p0, c, p1, t0, t1) => {
  const a = qAt(p0, c, p1, t0);
  const v = [0, 1].map((k) => 2 * ((1 - t0) * (c[k] - p0[k]) + t0 * (p1[k] - c[k])));
  return `M${pt(a)}Q${pt(plus(a, scale(v, (t1 - t0) / 2)))} ${pt(qAt(p0, c, p1, t1))}`;
};
const SPRINKLER = (() => {
  // The jet leaves the nozzle along its rake
  const JET = [[11.25, 7.25], [15, 2.5], [19.75, 9]];
  return [
    line([6, 15.75], [6, GROUND]),
    sq(4, 12.25, 4, 3.5, 1.1),
    ground(),
    line([7.25, 12.25], [9.25, 9.75]),
    qPiece(...JET, 0, 0.27),
    qPiece(...JET, 0.66, 1),
    dot(20.5, 13),
    dot(19.5, 17.25),
  ];
})();
add('sprinkler', ['aspersor', 'riego', 'regar', 'zona de riego', 'sprinkler', 'irrigation', 'watering'], SPRINKLER);
icons.sprinkler.fill = { solid: [SPRINKLER[1], ...SPRINKLER.slice(6)], wire: [SPRINKLER[0], SPRINKLER[2], SPRINKLER[3]], lines: [SPRINKLER[4], SPRINKLER[5]] };
icons.sprinkler.parts = { riser: [0, 2], head: [1, 3], water: [4, 5, 6, 7] };
// The clock takes the drops' place: the jet's spurts alone stay
add('sprinkler-clock', ['horario de riego', 'temporizador de riego', 'programar riego', 'irrigation schedule', 'watering timer', 'run time'], SPRINKLER.slice(0, 6), { badge: badge('clock') });
icons['sprinkler-clock'].fill = { solid: [SPRINKLER[1]], wire: [SPRINKLER[0], SPRINKLER[2], SPRINKLER[3]], lines: [SPRINKLER[4], SPRINKLER[5]] };
icons['sprinkler-clock'].parts = { riser: [0, 2], head: [1, 3], water: [4, 5] };
{
  // Drip irrigation: the line with two drippers, a drop falling from each onto a sprout. (Emitters
  // drawn as little loops under the line held a hole that opened at light and closed at regular.)
  const drop = (x) => place(lugares.icons.droplet.d[0], 0.25, [12, 3.25], [x, 7.5]);
  add('drip-irrigation', ['riego por goteo', 'goteo', 'microrriego', 'ahorro de agua', 'drip irrigation', 'micro irrigation', 'water efficiency'], [
    line([2.75, 2.5], [21.25, 2.5]),
    line([7, 2.5], [7, 4.5]),
    line([17, 2.5], [17, 4.5]),
    drop(7),
    drop(17),
    ...sprig(0.36, [7, GROUND]),
    ...sprig(0.36, [17, GROUND]),
    ground(),
  ]);
  const d = icons['drip-irrigation'].d;
  icons['drip-irrigation'].fill = { solid: [d[3], d[4], d[6], d[7], d[9], d[10]], wire: [d[0], d[1], d[2], d[5], d[8], d[11]] };
  icons['drip-irrigation'].parts = { line: [0, 1, 2], drops: [3, 4], plants: [5, 6, 7, 8, 9, 10], ground: [11] };
}

// ── Crops ─────────────────────────────────────────────────────────────────────────────────────
// Growing crops stand on lugares's sprout ground (y 21, 7.5–16.5) with frutas-verduras's single
// stem and lens leaves.
const PLANT_GROUND = SPROUT[3];
{
  // Corn plant: the tall stalk with its tassel and long leaves, and the ear standing up at a leaf
  // joint, its silk at the tip
  const x = 11;
  const earTip = [15.75, 8.75];
  add('corn-stalk', ['milpa', 'planta de maíz', 'maizal', 'corn plant', 'maize', 'corn stalk'], [
    line([x, 21], [x, 2.75]),
    bladeLeaf([x, 15.25], [2.75, 13.75], 2.75, -3),
    bladeLeaf([x, 10], [3.75, 6.75], 2.6, -2.5),
    leaf([x, 16.75], earTip, 4),
    line(earTip, [19, 7.75]),
    line(earTip, [17.75, 5.5]),
    line([x, 4.75], [8.75, 2.75]),
    line([x, 4.75], [13.25, 2.75]),
    PLANT_GROUND,
  ]);
  const d = icons['corn-stalk'].d;
  icons['corn-stalk'].fill = { solid: [d[1], d[2], d[3]], wire: [d[0], d[4], d[5], d[6], d[7], d[8]] };
  icons['corn-stalk'].parts = { stalk: [0, 6, 7], leaves: [1, 2], ear: [3, 4, 5], ground: [8] };
}
{
  // Coffee plant: a branch with two pairs of opposite leaves and a cluster of round cherries
  // hanging at its lower node
  const x = 12;
  // Three cherries hanging in a bunch from the branch's end, the lowest in front
  const cs = [[x + 0.75, 18.5, 1.75], [x - 1.25, 17, 1.75], [x, 15, 1.75]];
  const cherries = cluster(cs);
  const top = [x, 15 - 1.75];
  add('coffee-plant', ['cafeto', 'planta de café', 'finca cafetalera', 'coffee plant', 'coffee farm', 'coffee cherries'], [
    line(top, [x, 3]),
    leaf([x, 12], [4.25, 8.5], 3.5),
    leaf([x, 12], [19.75, 8.5], 3.5),
    leaf([x, 6], [6.5, 3], 3),
    leaf([x, 6], [17.5, 3], 3),
    ...cherries,
  ]);
  const d = icons['coffee-plant'].d;
  icons['coffee-plant'].fill = { solid: [d[1], d[2], d[3], d[4], ...cs.map(([cx, cy, r]) => circ(cx, cy, r))], wire: [d[0]], cut: seams(cs) };
  icons['coffee-plant'].parts = { branch: [0], leaves: [1, 2, 3, 4], cherries: cherries.map((_, i) => 5 + i) };
}
{
  // Agave: a rosette of long pointed leaves fanning up from the ground, the tallest in the middle
  // and in front
  const leaves = lenses([
    [[12, 21], [12, 2.75], 4.5],
    [[11.25, 21], [5.25, 6.25], 4],
    [[12.75, 21], [18.75, 6.25], 4],
    [[10.75, 21], [2.75, 13.5], 3.5],
    [[13.25, 21], [21.25, 13.5], 3.5],
  ]);
  add('agave', ['agave', 'maguey', 'tequila', 'mezcal', 'agave', 'dryland crop'], [...leaves, line([2.75, 21], [21.25, 21])]);
  const shapes = [[[12, 21], [12, 2.75], 4.5], [[11.25, 21], [5.25, 6.25], 4], [[12.75, 21], [18.75, 6.25], 4], [[10.75, 21], [2.75, 13.5], 3.5], [[13.25, 21], [21.25, 13.5], 3.5]].map(([A, B, w]) => leaf(A, B, w));
  icons.agave.fill = { solid: shapes, wire: [icons.agave.d[5]] };
  icons.agave.parts = { leaves: [0, 1, 2, 3, 4], ground: [5] };
}
{
  // Germination: a seed lying tilted, the shoot breaking out of its top and curving up to two small
  // leaves, and the root curling down from its foot
  const C = [10.25, 15];
  const tilt = -18;
  const [rx, ry] = [4.5, 3];
  const at = (a) => plus(C, rot([rx * Math.cos((a * Math.PI) / 180), ry * Math.sin((a * Math.PI) / 180)], [0, 0], tilt));
  const seed = `M${pt(at(0))}A${rx} ${ry} ${tilt + 360} 1 1 ${pt(at(180))}A${rx} ${ry} ${tilt + 360} 1 1 ${pt(at(0))}Z`;
  const s0 = at(-55);
  const shoot = `M${pt(s0)}C${pt([s0[0] + 0.75, s0[1] - 2])} 13.25 9 13.25 6.75`;
  add('germination', ['germinación', 'semilla', 'emergencia', 'brote', 'germination', 'seed starting', 'emergence'], [
    seed,
    shoot,
    leaf([13.25, 7.25], [10, 4], 2.5),
    leaf([13.25, 7.25], [16.75, 4.5], 2.5),
    `M${pt(at(125))}C8 19.5 6.75 20.25 5 20.25`,
  ]);
  const d = icons.germination.d;
  icons.germination.fill = { solid: [seed, d[2], d[3]], wire: [d[1], d[4]] };
  icons.germination.parts = { seed: [0], shoot: [1, 2, 3], root: [4] };
}
{
  // Seedling tray: a shallow tray seen from the front, its two cells each holding a seedling
  // (lugares's sprout, small). (Three cells left room only for forked stems.)
  const tray = roundpoly([[2.75, 15], [21.25, 15], [20.25, GROUND], [3.75, GROUND]], [0.6, 0.6, 1, 1]);
  add('seedling-tray', ['charola de germinación', 'almácigo', 'plántulas', 'vivero', 'seedling tray', 'nursery', 'propagation'], [
    tray,
    line([12, 15], [12, GROUND]),
    ...sprig(0.42, [7.25, 15]),
    ...sprig(0.42, [16.75, 15]),
  ]);
  const d = icons['seedling-tray'].d;
  icons['seedling-tray'].fill = { solid: [tray, d[3], d[4], d[6], d[7]], cut: [d[1]], wire: [d[2], d[5]] };
  icons['seedling-tray'].parts = { tray: [0, 1], sprouts: [2, 3, 4, 5, 6, 7] };
}
{
  // Growth stages: on one ground line, a seed just sown (a dot set into the ground, so it stays one
  // piece with it at every weight), lugares's sprout and a taller plant with four leaves
  const x = 18;
  add('growth-stages', ['etapas de crecimiento', 'fenología', 'desarrollo del cultivo', 'growth stages', 'phenology', 'crop development'], [
    ground(),
    dot(4, 19.75),
    ...sprig(0.42, [9.5, GROUND], { lift: 0.75 }),
    line([x, GROUND], [x, 4]),
    leaf([x, 12.75], [15.25, 10.25], 2.6),
    leaf([x, 12.75], [20.75, 10.25], 2.6),
    leaf([x, 8], [15.25, 5.5], 2.6),
    leaf([x, 8], [20.75, 5.5], 2.6),
  ]);
  const d = icons['growth-stages'].d;
  icons['growth-stages'].fill = { solid: [d[1], d[3], d[4], d[6], d[7], d[8], d[9]], wire: [d[0], d[2], d[5]] };
  icons['growth-stages'].parts = { ground: [0], seed: [1], sprout: [2, 3, 4], plant: [5, 6, 7, 8, 9] };
}
{
  // Roots: a ground line set high, a short sprout above it and below it the subject: a root system that
  // spreads unevenly, a taproot wandering down and side roots of different lengths leaving it at
  // different depths, curving down as they go. (Paired, even side roots under a sprout read as an
  // insect, a figure or a jellyfish.)
  const gy = 8.5;
  const cubic = (c) => `M${pt(c[0])}C${pt(c[1])} ${pt(c[2])} ${pt(c[3])}`;
  const from = (c, t, ...rest) => {
    const p = cubicAt(...c, t);
    return [p, ...rest.map(([dx, dy]) => plus(p, [dx, dy]))];
  };
  const tap = [[12, gy], [12, 11], [11, 14.5], [12.25, 21.25]];
  const left = from(tap, 0.34, [-2.5, 0.75], [-5.75, 2.5], [-7.25, 5.75]);
  const right = from(tap, 0.6, [2.5, 0.75], [5.5, 2.25], [6.5, 4.75]);
  const low = from(tap, 0.82, [-1.75, 0.75], [-3, 1.75], [-3.5, 3.25]);
  // Each side root forks once, its fork leaving it halfway and turning down
  const forkL = from(left, 0.45, [0.5, 1], [0.5, 1.75], [0.1, 2.5]);
  const forkR = from(right, 0.45, [-0.25, 1.5], [0, 2.5], [0.75, 3.5]);
  // The stem runs on into the taproot: one stroke from the leaves down
  add('roots', ['raíces', 'zona radicular', 'causa raíz', 'roots', 'root zone', 'root cause'], [
    line([2.75, gy], [21.25, gy]),
    `M12 4.75L${cubic(tap).slice(1)}`,
    leaf([12, 5.5], [8.5, 2.75], 3),
    leaf([12, 5.5], [15.5, 2.75], 3),
    cubic(left),
    cubic(right),
    cubic(low),
    cubic(forkL),
    cubic(forkR),
  ]);
  const d = icons.roots.d;
  icons.roots.fill = { solid: [d[2], d[3]], wire: [d[0], d[1], ...d.slice(4)] };
  icons.roots.parts = { ground: [0], plant: [1, 2, 3], roots: [4, 5, 6, 7, 8] };
}
{
  // Grow light: the lamp bar shining three short rays down onto lugares's sprout
  const bar = sq(4.25, 2.75, 15.5, 3.25, 1.6);
  add('grow-light', ['luz de cultivo', 'lámpara de crecimiento', 'fotoperiodo', 'cultivo interior', 'grow light', 'grow lamp', 'photoperiod'], [
    bar,
    line([7.75, 9], [6.75, 11]),
    line([12, 9], [12, 11]),
    line([16.25, 9], [17.25, 11]),
    ...sprig(0.4, [12, 21], { lift: 0.75 }),
    PLANT_GROUND,
  ]);
  const d = icons['grow-light'].d;
  icons['grow-light'].fill = { solid: [bar, d[5], d[6]], lines: [d[1], d[2], d[3]], wire: [d[4], d[7]] };
  icons['grow-light'].parts = { lamp: [0], rays: [1, 2, 3], sprout: [4, 5, 6, 7] };
}
{
  // Wilted plant: lugares's sprout with its stem bent over like a hook and its leaves hanging down
  const stem = 'M12 21V11.5C12 8.25 13.75 6.5 16 6.5C18.25 6.5 19.25 8.25 19.25 10.5';
  add('wilted-plant', ['planta marchita', 'estrés hídrico', 'sequía', 'falta de riego', 'wilted plant', 'water stress', 'drought stress'], [
    stem,
    leaf([12, 14.25], [7.25, 17.5], 2.75),
    leaf([19.25, 10.5], [18.75, 16.25], 2.75),
    PLANT_GROUND,
  ]);
  const d = icons['wilted-plant'].d;
  icons['wilted-plant'].fill = { solid: [d[1], d[2]], wire: [d[0], d[3]] };
  icons['wilted-plant'].parts = { stem: [0], leaves: [1, 2], ground: [3] };
}
{
  // Plant genetics: a stem twisted as a double helix and two leaves at the top. (Rungs across the
  // helix split each of its loops into two holes that closed at bold.)
  const strand = (s) => `M12 21C${N(12 + s * 4)} 19.25 ${N(12 + s * 4)} 17.25 12 15.5C${N(12 - s * 4)} 13.75 ${N(12 - s * 4)} 11.75 12 10`;
  add('plant-genetics', ['genética vegetal', 'semilla mejorada', 'transgénico', 'variedades', 'plant genetics', 'plant breeding', 'gmo'], [
    strand(1),
    strand(-1),
    leaf([12, 10], [7.5, 5.5], 3),
    leaf([12, 10], [16.5, 5.5], 3),
  ]);
  const d = icons['plant-genetics'].d;
  icons['plant-genetics'].fill = { solid: [d[2], d[3]], wire: [d[0], d[1]] };
  icons['plant-genetics'].parts = { helix: [0, 1], leaves: [2, 3] };
}
{
  // Weed: a dandelion's rosette, two long leaves cut into backward teeth along their upper edge,
  // spreading low from the ground on each side of the crown, and the long taproot below it. (A seed
  // head on a stalk made it a flower; a third leaf between the two closed a hole with the ground that
  // opened and shut with the weight.)
  const gy = 13;
  const toothed = (A, B, w) => {
    const u = unit(sub(B, A));
    const L = len(sub(B, A));
    const up = u[0] < 0 ? 1 : -1;
    const n = scale([-u[1], u[0]], up);
    const at = (t, k) => plus(plus(A, scale(u, L * t)), scale(n, k * w));
    // Upper edge: three teeth whose points lean back toward the base, each notch cut halfway in
    const upper = [at(0.16, 0.6), at(0.3, 0.15), at(0.36, 1.05), at(0.5, 0.3), at(0.56, 1.1), at(0.7, 0.35), at(0.76, 0.9)];
    const lower = [at(0.75, -0.55), at(0.45, -0.75), at(0.2, -0.55)];
    const pts = [A, ...upper, B, ...lower];
    return roundpoly(pts, pts.map((_, i) => (i === 0 ? 0.3 : i === 8 ? 0.4 : 0.35)));
  };
  add('weed', ['maleza', 'mala hierba', 'deshierbe', 'herbicida', 'weed', 'weeding', 'herbicide'], [
    line([2.75, gy], [21.25, gy]),
    toothed([10.5, gy], [2.75, 5.25], 2.4),
    toothed([13.5, gy], [21.25, 5.25], 2.4),
    'M12 13C12 16 12.75 18.25 11.75 21.25',
    line([12.3, 16], [15.25, 17.75]),
    line([12.3, 18.25], [9.5, 20.25]),
  ]);
  const d = icons.weed.d;
  icons.weed.fill = { solid: [d[1], d[2]], wire: [d[0], d[3], d[4], d[5]] };
  icons.weed.parts = { ground: [0], leaves: [1, 2], root: [3, 4, 5] };
}
{
  // Harvest: a sheaf: three stalks of grain crossing at the waist, tied there, each with its head of
  // grain (frutas-verduras's lens, as on the crop-yield stalks), fanned at the top, and the outer
  // stalks' cut ends splayed below. (Three heads over a capsule for a band and three splayed feet
  // read as an insect; ears of three grains overlapped in slivers that closed at bold.)
  const X = [12, 15.25];
  const th = 38;
  const u = [Math.sin((th * Math.PI) / 180), Math.cos((th * Math.PI) / 180)];
  const L = 6.25;
  const H = 4.75;
  const feet = [[12, X[1] - L - 0.75], plus(X, [-u[0] * L, -u[1] * L]), plus(X, [u[0] * L, -u[1] * L])];
  const heads = [leaf(feet[0], [12, feet[0][1] - H], 2.75), leaf(feet[1], plus(feet[1], [-u[0] * H, -u[1] * H]), 2.75), leaf(feet[2], plus(feet[2], [u[0] * H, -u[1] * H]), 2.75)];
  const k = (21 - X[1]) / u[1];
  add('harvest', ['cosecha', 'gavilla', 'temporada de cosecha', 'harvest', 'sheaf', 'harvest season'], [
    line(feet[0], [12, 21]),
    line(feet[1], plus(X, [u[0] * k, u[1] * k])),
    line(feet[2], plus(X, [-u[0] * k, u[1] * k])),
    ...heads,
    line([X[0] - 2.25, X[1] - 0.25], [X[0] + 2.25, X[1] - 0.25]),
  ]);
  const d = icons.harvest.d;
  icons.harvest.fill = { solid: heads, wire: [d[0], d[1], d[2], d[6]] };
  icons.harvest.parts = { stalks: [0, 1, 2], heads: [3, 4, 5], band: [6] };
}
{
  // Crop yield: three stalks of grain of increasing height on a baseline, each with its head (the
  // sheaf's), a bar chart of the harvest
  const stalk = (x, top) => [leaf([x, top + 5], [x, top], 2.75), line([x, top + 5], [x, GROUND])];
  const st = [stalk(6, 11.25), stalk(12, 7), stalk(18, 2.75)];
  add('crop-yield', ['rendimiento', 'producción por hectárea', 'cosecha', 'crop yield', 'yield', 'production'], [line([2.75, GROUND], [21.25, GROUND]), ...st.flat()]);
  const d = icons['crop-yield'].d;
  icons['crop-yield'].fill = { solid: [d[1], d[3], d[5]], wire: [d[0], d[2], d[4], d[6]] };
  icons['crop-yield'].parts = { baseline: [0], low: [1, 2], mid: [3, 4], high: [5, 6] };
}
{
  // Crop rotation: two arc arrows chasing each other around lugares's sprout
  const a = arc(12, 12, 9, 205, 325);
  const b = arc(12, 12, 9, 25, 145);
  add('crop-rotation', ['rotación de cultivos', 'ciclo agrícola', 'planeación de temporadas', 'crop rotation', 'rotation plan', 'seasons'], [
    a.d,
    head(a.end, a.tangent, 3.4),
    b.d,
    head(b.end, b.tangent, 3.4),
    ...sprig(0.48, [12, 17]),
  ]);
  const d = icons['crop-rotation'].d;
  icons['crop-rotation'].fill = { solid: [d[5], d[6]], wire: [d[4]], lines: [d[0], d[1], d[2], d[3]] };
  icons['crop-rotation'].parts = { arrows: [0, 1, 2, 3], sprout: [4, 5, 6] };
}


// ── Crop care ─────────────────────────────────────────────────────────────────────────────────
// lugares's leaf: its blade (a lens) and the stem that runs on into its midrib. Leaves with damage
// on the blade keep the stem and lose the midrib, which would leave no room for the damage.
const LEAF = lugares.icons.leaf.d;
const LEAF_A = [5.5, 18.5];
const LEAF_B = [20.25, 3.75];
const LEAF_R = 15.5;
const LEAF_STEM = line([3.25, 20.75], LEAF_A);
/** A point on the leaf's blade: k along its axis from the middle (toward the tip), v across it. */
const onLeaf = (k, v) => {
  const M = lerp(LEAF_A, LEAF_B, 0.5);
  const u = unit(sub(LEAF_B, LEAF_A));
  return plus(plus(M, scale(u, k)), scale([-u[1], u[0]], v));
};
{
  // Disease: three spots along the blade
  const spots = [onLeaf(-4.25, 0.35), onLeaf(-0.5, -0.8), onLeaf(2.75, 0.75)].map((p) => dot(...p));
  add('leaf-disease', ['enfermedad de la hoja', 'hongo', 'tizón', 'plaga', 'leaf disease', 'blight', 'fungus'], [LEAF[0], LEAF_STEM, ...spots]);
  icons['leaf-disease'].fill = { solid: [LEAF[0]], wire: [LEAF_STEM], cut: spots };
  icons['leaf-disease'].parts = { leaf: [0, 1], spots: [2, 3, 4] };
}
{
  // Bitten: a round bite taken out of the blade's upper edge and a hole eaten through it
  const C1 = (() => {
    // The center of the arc on the upper-left edge (the lens's first arc)
    const M = lerp(LEAF_A, LEAF_B, 0.5);
    const u = unit(sub(LEAF_B, LEAF_A));
    const n = [-u[1], u[0]];
    const h = Math.sqrt(LEAF_R ** 2 - (len(sub(LEAF_B, LEAF_A)) / 2) ** 2);
    return plus(M, scale(n, h));
  })();
  const bc = plus(C1, scale(unit(sub(onLeaf(1.5, -4), C1)), LEAF_R + 0.5));
  const br = 2.5;
  const [p, q] = meet([...C1, LEAF_R], [...bc, br]).sort((a, b) => a[0] - b[0]);
  const blade = `M${pt(LEAF_A)}A${LEAF_R} ${LEAF_R} 0 0 1 ${pt(p)}A${br} ${br} 0 0 0 ${pt(q)}A${LEAF_R} ${LEAF_R} 0 0 1 ${pt(LEAF_B)}A${LEAF_R} ${LEAF_R} 0 0 1 ${pt(LEAF_A)}Z`;
  const hole = circ(...onLeaf(-3.75, 0.25), 1.25);
  add('leaf-bitten', ['hoja mordida', 'daño por plaga', 'insectos', 'plagas', 'leaf damage', 'pest damage', 'chewed leaf'], [blade, LEAF_STEM, hole]);
  icons['leaf-bitten'].fill = { solid: [blade], wire: [LEAF_STEM], cut: [hole] };
  icons['leaf-bitten'].parts = { leaf: [0, 1], hole: [2] };
}
{
  // Scan: the leaf inside comercio's four corner brackets
  const frame = comercio.icons['barcode-scan'].d.slice(0, 4);
  const leafD = LEAF.map((d) => place(d, 0.55, [11.75, 12.25], [12, 12]));
  add('leaf-scan', ['escanear hoja', 'identificar planta', 'diagnóstico', 'leaf scan', 'plant id', 'crop scan'], [...frame, ...leafD]);
  icons['leaf-scan'].fill = { solid: [leafD[0]], cut: [leafD[1]], lines: frame };
  icons['leaf-scan'].parts = { frame: [0, 1, 2, 3], leaf: [4, 5] };
}
{
  // Crop protection: the core shield with the leaf inside
  const shield = nucleo.icons.shield.d[0];
  const leafD = LEAF.map((d) => place(d, 0.44, [11.75, 12.25], [12.25, 11.25]));
  add('shield-leaf', ['protección de cultivos', 'plaguicida', 'fitosanitario', 'crop protection', 'pesticide', 'plant protection'], [shield, ...leafD]);
  icons['shield-leaf'].fill = { solid: [shield], cut: leafD };
  icons['shield-leaf'].parts = { shield: [0], leaf: [1, 2] };
}
{
  // Organic: formas's scalloped seal with the leaf's blade and midrib inside
  const seal = formas.icons.seal.d[0];
  const k = 0.43;
  const blade = place(LEAF[0], k, lerp(LEAF_A, LEAF_B, 0.5), [12, 12]);
  const rib = place(line(LEAF_A, [14.25, 9.75]), k, lerp(LEAF_A, LEAF_B, 0.5), [12, 12]);
  add('seal-leaf', ['orgánico', 'certificado orgánico', 'sello ecológico', 'organic', 'certified organic', 'eco label'], [seal, blade, rib]);
  icons['seal-leaf'].fill = { solid: [seal], cut: [blade, rib] };
  icons['seal-leaf'].parts = { seal: [0], leaf: [1, 2] };
}
{
  // Fertilizer: three granules falling onto lugares's sprout
  add('fertilizer', ['fertilizante', 'abono', 'nutrientes', 'fertilizar', 'fertilizer', 'nutrients', 'feed'], [
    ...sprig(0.65, [12, 21], { ground: true }),
    dot(8.5, 8),
    dot(12, 4.25),
    dot(14.25, 7.75),
  ]);
  const d = icons.fertilizer.d;
  icons.fertilizer.fill = { solid: [d[1], d[2], d[4], d[5], d[6]], wire: [d[0], d[3]] };
  icons.fertilizer.parts = { sprout: [0, 1, 2, 3], granules: [4, 5, 6] };
}

// ── Soil ──────────────────────────────────────────────────────────────────────────────────────
// A section of soil, one construction for the family, open at its sides: the surface a ground line
// with tufts of grass on it (the rice paddy's), the floor a second line below. The soil itself shows
// a rippled stratum between them and pebbles under it; the moisture and temperature icons put their
// sign between the lines instead. (Walls around it made a box: a water tank with a rippled top, a
// calendar or a planter with a flat one.)
const SOIL_TOP = 8.5;
const SOIL_FLOOR = 21;
const soilLines = () => [line([2.75, SOIL_TOP], [21.25, SOIL_TOP]), line([2.75, SOIL_FLOOR], [21.25, SOIL_FLOOR])];
const grass = (xs) => xs.map((x) => blades([x, SOIL_TOP], 4.5));
{
  const [top, floor] = soilLines();
  const stratum = ripple(13, 2.75, 4, 18.5 / 4, 0.6);
  add('soil', ['suelo', 'tierra', 'salud del suelo', 'perfil del suelo', 'soil', 'ground', 'soil health'], [top, ...grass([6.5, 12, 17.5]), stratum, dot(6, 17.25), dot(12, 18), dot(18, 17.25), floor]);
  icons.soil.parts = { surface: [0, 1, 2, 3], soil: [4, 5, 6, 7, 8] };
}
{
  // Moisture: a drop (lugares's) in the soil
  const [top, floor] = soilLines();
  const drop = place(lugares.icons.droplet.d[0], 0.36, [12, 3.25], [12, 11]);
  add('soil-moisture', ['humedad del suelo', 'riego', 'sensor de humedad', 'soil moisture', 'moisture reading', 'irrigation trigger'], [top, ...grass([5.75, 18.25]), drop, floor]);
  const d = icons['soil-moisture'].d;
  icons['soil-moisture'].fill = { solid: [drop], wire: [top, d[1], d[2], floor] };
  icons['soil-moisture'].parts = { surface: [0, 1, 2], drop: [3], soil: [4] };
}
{
  // Temperature: lugares's thermometer pushed through the surface into the soil, in front (a custom
  // badge: the engine clears the surface around it)
  const [top, floor] = soilLines();
  // At this size the mercury keeps its clearance inside the tube at bold (smaller, it filled it)
  const at = (d) => place(d, 0.85, [12, 16.75], [12, 14.1]);
  const tube = at(lugares.icons.thermometer.d[0]);
  const mercury = at('M12 16.75L12 8.75');
  add('soil-temperature', ['temperatura del suelo', 'sonda', 'ventana de siembra', 'soil temperature', 'soil probe', 'planting window'], [top, ...grass([5.25, 18.75]), floor], {
    badge: { d: [tube, mercury], knock: tube, fill: { solid: [tube], cut: [mercury] } },
  });
  icons['soil-temperature'].parts = { surface: [0, 1, 2], soil: [3] };
}

// ── Records ───────────────────────────────────────────────────────────────────────────────────
{
  // Planting calendar: the core calendar with lugares's sprout standing on its bottom edge
  const cal = nucleo.icons.calendar.d.slice(0, 4);
  const sp = sprig(0.42, [12, 21], { lift: 1.5 });
  add('calendar-sprout', ['calendario de siembra', 'temporada', 'fechas de cosecha', 'planting calendar', 'crop calendar', 'sowing dates'], [...cal, ...sp]);
  icons['calendar-sprout'].fill = { solid: [cal[0]], lines: [cal[1], cal[2]], cut: [cal[3], ...sp] };
  icons['calendar-sprout'].parts = { calendar: [0, 1, 2, 3], sprout: [4, 5, 6] };
}
{
  // Field record: archivos's clipboard with lugares's sprout on its sheet
  const clip = archivos.icons.clipboard;
  const sp = sprig(0.5, [12, 18.25], { lift: 0.75, ground: true });
  add('clipboard-sprout', ['bitácora de campo', 'registro agrícola', 'reporte de cultivo', 'field record', 'crop log', 'scouting report'], [...clip.d, ...sp]);
  icons['clipboard-sprout'].fill = { solid: clip.fill.solid, cut: [...clip.fill.cut, ...sp] };
  icons['clipboard-sprout'].parts = { board: [0, 1], sprout: [2, 3, 4, 5] };
}
{
  // Crop insurance: comercio's insurance umbrella over lugares's sprout
  const canopy = comercio.icons.insurance.d[0];
  const sp = sprig(0.45, [12, 21], { lift: 0.75, ground: true });
  add('insurance-crop', ['seguro agrícola', 'seguro de cosecha', 'cobertura climática', 'crop insurance', 'harvest coverage', 'farm insurance'], [canopy, ...sp]);
  icons['insurance-crop'].fill = { solid: [canopy, sp[1], sp[2]], wire: [sp[0], sp[3]] };
  icons['insurance-crop'].parts = { canopy: [0], sprout: [1, 2, 3, 4] };
}

// ── Livestock supplies ────────────────────────────────────────────────────────────────────────
{
  // Hay bale: a round bale lying on its side, its end a disc with the rolled hay as a spiral
  const C = [8, 12.5];
  const r = 5.5;
  const body = `M${pt([C[0], C[1] - r])}H17.5A2.75 ${r} 0 0 1 17.5 ${N(C[1] + r)}H${N(C[0])}`;
  const spiral = (() => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const th = 0.6 + (i / 40) * 5.4;
      const rr = 0.41 * th;
      pts.push([C[0] + rr * Math.cos(th), C[1] + rr * Math.sin(th)]);
    }
    return `M${pts.map(pt).join('L')}`;
  })();
  add('hay-bale', ['paca de heno', 'rollo de pasto', 'forraje', 'hay bale', 'round bale', 'forage'], [circ(...C, r), body, spiral]);
  const d = icons['hay-bale'].d;
  // Filled, the face's edge is cut where it meets the body, so the round end still shows
  icons['hay-bale'].fill = { solid: [d[0], shut(body)], cut: [spiral, arc(...C, r, -90, 90).d] };
  icons['hay-bale'].parts = { face: [0, 2], body: [1] };
}
{
  // Haystack: a rounded dome of hay on the ground, a few straws in it and the pole through its top
  // (Its pole, in the first drawing, turned the dome into a pendant lamp: the stack rises to a soft
  // peak of its own instead.)
  const dome = 'M2.75 20.75C2.75 14.5 6.25 8.5 10.75 5.25Q12 4.4 13.25 5.25C17.75 8.5 21.25 14.5 21.25 20.75';
  add('haystack', ['pajar', 'almiar', 'paja', 'aguja en un pajar', 'haystack', 'hay', 'needle in a haystack'], [
    dome,
    ground(),
    line([10.25, 9.5], [11.25, 12]),
    line([6.75, 15], [8, 17.5]),
    line([16.25, 14.25], [15, 16.75]),
    line([11.25, 17.5], [12.25, 15]),
  ]);
  const d = icons.haystack.d;
  icons.haystack.fill = { solid: [shut(dome)], wire: [d[1]], cut: [d[2], d[3], d[4], d[5]] };
  icons.haystack.parts = { stack: [0, 2, 3, 4, 5], ground: [1] };
}
{
  // Milk can: a tall churn, its shoulders sloping to the neck, the lid on top and a handle on each
  // shoulder
  const can = roundline([[9.5, 6], [9.5, 8.25], [6.25, 11.75], [6.25, 21], [17.75, 21], [17.75, 11.75], [14.5, 8.25], [14.5, 6]], [0, 1, 1.5, 1, 1, 1.5, 1, 0]);
  const lid = sq(8.25, 3, 7.5, 3, 1.25);
  const handle = 'M7.3 10.6C3.75 8.75 2.25 12.5 6.25 14.75';
  add('milk-can', ['cántaro de leche', 'lechería', 'acopio de leche', 'milk can', 'milk churn', 'dairy'], [can, lid, handle, flipPath(handle), line([6.25, 15.5], [17.75, 15.5])]);
  const d = icons['milk-can'].d;
  icons['milk-can'].fill = { solid: [shut(can), lid], wire: [d[2], d[3]], cut: [d[4]] };
  icons['milk-can'].parts = { can: [0, 4], lid: [1], handles: [2, 3] };
}
{
  // Horseshoe: a U opening upward, its band wide enough to carry the nail holes on both arms
  const C = [12, 10.5];
  const [ro, ri] = [8.75, 3.75];
  const top = 3.25;
  const shoe = `M${pt([C[0] - ro, top])}V${N(C[1])}A${ro} ${ro} 0 0 0 ${pt([C[0] + ro, C[1]])}V${N(top)}H${N(C[0] + ri)}V${N(C[1])}A${ri} ${ri} 0 0 1 ${pt([C[0] - ri, C[1]])}V${N(top)}Z`;
  const rm = (ro + ri) / 2;
  const holes = [[-rm, 5.75], [-rm, 9.25], [rm, 5.75], [rm, 9.25]].map(([dx, y]) => dot(C[0] + dx, y, 0.3)).concat([150, 30].map((a) => dot(...polar(...C, rm, a), 0.3)));
  add('horseshoe', ['herradura', 'herrero', 'caballos', 'suerte', 'horseshoe', 'farrier', 'luck'], [shoe, ...holes]);
  icons.horseshoe.fill = { solid: [shoe], cut: holes };
  icons.horseshoe.parts = { shoe: [0], holes: [1, 2, 3, 4, 5, 6] };
}

// ── Hand tools ────────────────────────────────────────────────────────────────────────────────
{
  // Pitchfork: three tines on a rounded head at the end of a long handle, drawn upright and turned
  // to lie on the diagonal
  const up = [
    line([12, 21.75], [12, 9.75]),
    roundline([[8.5, 2.25], [8.5, 9.75], [15.5, 9.75], [15.5, 2.25]], [0, 2.5, 2.5, 0]),
    line([12, 9.75], [12, 2.25]),
  ];
  const d = up.map((x) => turnPath(x, 40));
  add('pitchfork', ['horquilla', 'bieldo', 'heno', 'tareas del establo', 'pitchfork', 'hay fork', 'barn chores'], d);
  icons.pitchfork.parts = { handle: [0], fork: [1, 2] };
}
{
  // Sickle: a crescent blade, widest at its back, curving up and over from its short handle to the
  // tip that points back down to the left; drawn upright and turned so the handle leans
  const O = [13, 10];
  const RO = 7.75;
  const T = polar(...O, RO, 190);
  const bo = polar(...O, RO, 100);
  const bi = polar(...O, RO - 2.25, 100);
  // The inner edge: a circle through the tip and the blade's inner corner, centered on their
  // bisector 1.5 past where it passes nearest the outer circle's center (the blade swells at its
  // back)
  const m = lerp(T, bi, 0.5);
  const v = unit(sub(bi, T));
  const nb = [-v[1], v[0]];
  const I = plus(plus(m, scale(nb, (O[0] - m[0]) * nb[0] + (O[1] - m[1]) * nb[1])), scale(nb, 1.5));
  const RI = len(sub(I, T));
  const mid = lerp(bo, bi, 0.5);
  const up = [`M${pt(bo)}A${RO} ${RO} 0 1 0 ${pt(T)}A${N(RI)} ${N(RI)} 0 1 1 ${pt(bi)}Z`, line(mid, plus(mid, scale(unit(sub(mid, O)), 5.25)))];
  const [blade, handle] = up.map((d) => turnPath(d, 32, [12, 12]));
  add('sickle', ['hoz', 'segar', 'cosecha manual', 'sickle', 'reaping', 'hand harvest'], [blade, handle]);
  icons.sickle.fill = { solid: [blade], wire: [handle] };
  icons.sickle.parts = { blade: [0], handle: [1] };
}
{
  // Scythe: the long curved shaft with its grip, and the long curved blade at its top
  const shaft = 'M10.75 5.25C10 10.5 7.75 15.75 6.25 21.25';
  const blade = 'M10.5 2.75Q17.5 2.75 21.25 9.25Q16.75 5.25 10.75 5.25Z';
  add('scythe', ['guadaña', 'segar', 'cortar pasto', 'scythe', 'mowing', 'hay cutting'], [blade, shaft, line([8.9, 12.25], [11.75, 13.5])]);
  icons.scythe.fill = { solid: [blade], wire: [shaft, icons.scythe.d[2]] };
  icons.scythe.parts = { blade: [0], shaft: [1, 2] };
}

// ── Fill, parts and geometry live with each drawing above (they come from its own pieces); what
// follows is assigned in blocks, as in nucleo.mjs ──

// Line-only drawings: their filled version is the outline itself
for (const name of ['rice-paddy', 'pasture', 'farm-gate', 'barbed-wire', 'pitchfork', 'soil']) icons[name].fill = false;
// Lines under its badge: filled, only the thermometer (the badge) fills
icons['soil-temperature'].fill = false;

// Already enclosed: a frame of brackets, the seal's scallops
icons['leaf-scan'].variants = { square: false };
icons['seal-leaf'].variants = { circle: false };
// Enclosed, a lone strand reads as a no-entry sign and the horseshoe's U with its holes as a smile
icons['barbed-wire'].variants = { circle: false, square: false };
icons.horseshoe.variants = { circle: false, square: false };
// A slash through a lone strand or a fork says nothing
for (const name of ['barbed-wire', 'pitchfork']) icons[name].variants = { ...icons[name].variants, slash: false };

// Mirror: what moves forward (the machines in profile, the plane) and
// what grows from left to right
for (const name of ['tractor', 'tractor-loader', 'tractor-autonomous', 'crop-duster', 'growth-stages', 'crop-yield']) icons[name].mirror = true;

// Levels, from least to most
icons['tractor-autonomous'].levels = [[3], [4]];
icons['grow-light'].levels = [[2], [1, 3]];
icons['growth-stages'].levels = [[1], [2, 3, 4], [5, 6, 7, 8, 9]];
icons['crop-yield'].levels = [[1, 2], [3, 4], [5, 6]];

// Motion: each icon's own gesture (parts by name, pivots and offsets on the 24 canvas)
Object.assign(icons.tractor, { motion: { effect: 'slide', vector: [2, 0] } });
Object.assign(icons['tractor-loader'], { motion: { effect: 'slide', vector: [2, 0] } });
Object.assign(icons['tractor-autonomous'], { motion: { effect: 'slide', vector: [2, 0] } });
Object.assign(icons['crop-duster'], { motion: { effect: 'slide', parts: ['plane'], vector: [2, 0] } });
Object.assign(icons['drone-spraying'], { motion: { effect: 'float', parts: ['body', 'arms', 'rotors'], vector: [0, -1.5] } });
Object.assign(icons['drone-mapping'], { motion: { effect: 'float', parts: ['body', 'arms', 'rotors'], vector: [0, -1.5] } });
Object.assign(icons['map-pin-sprout'], { motion: { effect: 'bounce', vector: [0, -2] } });
Object.assign(icons.fertilizer, { motion: { effect: 'bounce', parts: ['granules'], vector: [0, 1.5] } });
Object.assign(icons['crop-rotation'], { motion: { effect: 'spin', parts: ['arrows'], origin: [12, 12] } });
Object.assign(icons.sprinkler, { motion: { effect: 'beat', parts: ['water'], origin: [8.75, 9.75] } });
Object.assign(icons.scarecrow, { motion: { effect: 'wiggle', origin: [12, 21.25] } });
Object.assign(icons['electric-fence'], { motion: { effect: 'beat', parts: ['badge'], origin: [12, 12] } });
Object.assign(icons.beehive, { motion: { effect: 'wiggle', origin: [12, GROUND] } });
Object.assign(icons.sickle, { motion: { effect: 'wiggle', origin: [5.5, 20.5] } });
Object.assign(icons.scythe, { motion: { effect: 'wiggle', origin: [6.25, 21.25] } });
Object.assign(icons['wilted-plant'], { motion: { effect: 'wiggle', origin: [12, 21] } });

export default { category: 'agricultura', label: 'Agricultura', icons };
