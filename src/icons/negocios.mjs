// Negocios y gestión (business and management): strategy and decisions, goals and OKRs, growth,
// organization, risk, partnerships and deals, offices, suppliers, quality and lean. Everything is
// computed with the engine (engine/geometry.mjs) on the rules in DESIGN.md: a 1.5 stroke, keylines,
// continuous corners and a square bottom-right corner on containers. Every object the set already
// draws is reused, never redrawn: the target and the bars are datos', the tower, the factory and the
// mountain lugares', the storefront and the handshake comercio's, the open book archivos', the person
// and the document Núcleo's. Badges are the engine's; a piece that sits on top of another (a front
// storefront, a pie wedge) is a custom badge the engine clears; when the badge is taken or a piece
// in front needs the badge's place (the deal under a status badge, the front peak under the flag's
// pole, the benchmark's reference line), the piece in front clears the one behind exactly on the
// curve (clip(), as legal's clipAway): nothing is trimmed by hand.
import { arc, badge, circ, dot, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snap, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import comercio from './comercio.mjs';
import datos from './datos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** A path scaled by `s` about `o` and placed so that `o` lands on `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Custom badge: the piece on top, the area the engine clears around it, and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/** Open polyline with rounded interior corners (one radius per vertex, or one for all). */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const u = unit(sub(A, V));
    const v = unit(sub(B, V));
    const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    if (!rr[i] || th > Math.PI - 1e-6) {
      d += `L${P(V)}`;
      continue;
    }
    const t = rr[i] / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${P(add(V, mul(u, t)))}A${f(rr[i])} ${f(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${P(add(V, mul(v, t)))}`;
  }
  return `${d}L${P(pts[pts.length - 1])}`;
}

/** Capsule (semicircular ends), horizontal or vertical depending on the longer side. */
function pill(x, y, w, h) {
  if (w >= h) {
    const r = h / 2;
    return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
  }
  const r = w / 2;
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
}

/** Cubic Bézier from p0 to p3; also returns its end and the tangent there (for an arrowhead). */
const cubic = (p0, p1, p2, p3) => ({ d: `M${P(p0)}C${P(p1)} ${P(p2)} ${P(p3)}`, end: p3, tangent: sub(p3, p2), at: (t) => [0, 1].map((k) => (1 - t) ** 3 * p0[k] + 3 * t * (1 - t) ** 2 * p1[k] + 3 * t * t * (1 - t) * p2[k] + t ** 3 * p3[k]) });
/** A straight arrow from `a` to `b` with arms of `arm` at 45° (shaft and head as two strokes). */
const arrow = (a, b, arm = 4.5) => [line(a, b), head(b, sub(b, a), arm)];

// ── Measuring and dashing a path (bienes-raices' construction: a dashed line is the line, broken) ──
function pieces(d) {
  const out = [];
  let p = [0, 0];
  let start = p;
  for (const [, c, args] of transform(d, 1, 0, 0).matchAll(/([MLHVCAZ])([^MLHVCAZ]*)/g)) {
    const a = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (c === 'M') {
      p = start = [a[0], a[1]];
      continue;
    }
    let seg;
    if (c === 'C') seg = cubicPiece(p, [a[0], a[1]], [a[2], a[3]], [a[4], a[5]]);
    else if (c === 'A') seg = arcPiece(p, a);
    else seg = linePiece(p, c === 'H' ? [a[0], p[1]] : c === 'V' ? [p[0], a[0]] : c === 'Z' ? start : [a[0], a[1]]);
    if (seg.len > 1e-6) out.push(seg);
    p = seg.end;
  }
  let s = 0;
  for (const q of out) {
    q.s = s;
    s += q.len;
  }
  out.total = s;
  return out;
}
function linePiece(a, b) {
  return { len: len(sub(b, a)), end: b, at: (t) => lerp(a, b, t), t: (s, L) => s / L, cmd: (t0, t1) => `L${P(lerp(a, b, t1))}` };
}
function cubicPiece(P0, P1, P2, P3) {
  const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * P0[k] + 3 * t * (1 - t) ** 2 * P1[k] + 3 * t * t * (1 - t) * P2[k] + t ** 3 * P3[k]);
  const M = 200;
  const acc = [0];
  for (let i = 1; i <= M; i++) acc.push(acc[i - 1] + len(sub(at(i / M), at((i - 1) / M))));
  const split = (Q, t) => {
    const m = (a, b) => lerp(a, b, t);
    const [a, b, c] = [m(Q[0], Q[1]), m(Q[1], Q[2]), m(Q[2], Q[3])];
    const [d, e] = [m(a, b), m(b, c)];
    const g = m(d, e);
    return [
      [Q[0], a, d, g],
      [g, e, c, Q[3]],
    ];
  };
  return {
    len: acc[M],
    end: P3,
    at,
    t: (s) => {
      let i = 1;
      while (i < M && acc[i] < s) i++;
      return (i - 1 + (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / M;
    },
    cmd: (t0, t1) => {
      const left = split([P0, P1, P2, P3], t1)[0];
      const q = t1 > 0 ? split(left, t0 / t1)[1] : left;
      return `C${P(q[1])} ${P(q[2])} ${P(q[3])}`;
    },
  };
}
function arcPiece(from, [rx0, ry0, , large, sweep, x2, y2]) {
  const [x1, y1] = from;
  const [hx, hy] = [(x1 - x2) / 2, (y1 - y2) / 2];
  let [rx, ry] = [rx0, ry0];
  const lam = (hx * hx) / (rx * rx) + (hy * hy) / (ry * ry);
  if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
  const num = rx * rx * ry * ry - rx * rx * hy * hy - ry * ry * hx * hx;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * hy * hy + ry * ry * hx * hx)));
  const [cx, cy] = [co * ((rx * hy) / ry) + (x1 + x2) / 2, co * (-(ry * hx) / rx) + (y1 + y2) / 2];
  const t1 = Math.atan2((y1 - cy) / ry, (x1 - cx) / rx);
  let dt = Math.atan2((y2 - cy) / ry, (x2 - cx) / rx) - t1;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  const at = (t) => [cx + rx * Math.cos(t1 + t * dt), cy + ry * Math.sin(t1 + t * dt)];
  const M = 120;
  const acc = [0];
  for (let i = 1; i <= M; i++) acc.push(acc[i - 1] + len(sub(at(i / M), at((i - 1) / M))));
  return {
    len: acc[M],
    end: [x2, y2],
    at,
    t: (s) => {
      let i = 1;
      while (i < M && acc[i] < s) i++;
      return (i - 1 + (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / M;
    },
    cmd: (ta, tb) => `A${f(rx0)} ${f(ry0)} 0 ${Math.abs((tb - ta) * dt) > Math.PI ? 1 : 0} ${sweep} ${P(at(tb))}`,
  };
}
/** The stretch of a path between arc lengths s0 and s1. */
function stretch(d, s0, s1, ps = pieces(d)) {
  let out = '';
  for (const q of ps) {
    const lo = Math.max(s0, q.s);
    const hi = Math.min(s1, q.s + q.len);
    if (hi <= lo + 1e-6) continue;
    const [ta, tb] = [q.t(lo - q.s, q.len), q.t(hi - q.s, q.len)];
    if (!out) out = `M${P(q.at(ta))}`;
    out += q.cmd(ta, tb);
  }
  return out;
}
/** `n` dashes along an open path, `gap` apart, from end to end (dashes touch both ends). */
function run(d, n, gap = 3) {
  const ps = pieces(d);
  const dash = (ps.total - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => stretch(d, i * (dash + gap), i * (dash + gap) + dash, ps));
}

// ── Sampling a path: a piece behind another, and where a line meets an outline ──
/** The point at arc length s along measured pieces. */
const pointAt = (ps, s) => {
  for (const q of ps) if (s <= q.s + q.len + 1e-9) return q.at(q.t(Math.min(Math.max(0, s - q.s), q.len), q.len));
  return ps[ps.length - 1].at(1);
};
/** Points along a path, `step` apart. */
const outline = (d, step = 0.1) => {
  const ps = pieces(d);
  const n = Math.max(2, Math.ceil(ps.total / step));
  return Array.from({ length: n + 1 }, (_, k) => pointAt(ps, (k * ps.total) / n));
};
const within = (poly, [x, y]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) if (poly[i][1] > y !== poly[j][1] > y && x < ((poly[j][0] - poly[i][0]) * (y - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) hit = !hit;
  return hit;
};
/**
 * What a piece in front clears behind it when both belong to the base (the engine's badge clears one
 * piece per icon, and the badge is taken): its inside and 3 around its stroke, the knockout's
 * clearance at regular (1.5 of paper between the two inks).
 */
function front(ds, clear = 3) {
  const polys = ds.map((d) => outline(d));
  const pts = polys.flat();
  const nearest = (p) => pts.reduce((b, q) => (len(sub(p, q)) < len(sub(p, b)) ? q : b), pts[0]);
  return { cleared: (p) => polys.some((poly) => within(poly, p)) || len(sub(p, nearest(p))) < clear, nearest, clear };
}
/**
 * The runs of a path that stay outside a cleared region, each at least `min` long (legal's
 * clipAway): the cut is exact on the curve, never a redrawn piece. A closed path cut once stays one
 * run, through its start.
 */
function clip(d, cleared, min = 2) {
  const ps = pieces(d);
  const T = ps.total;
  const n = Math.ceil(T / 0.05);
  const at = (k) => (k * T) / n;
  const keep = Array.from({ length: n + 1 }, (_, k) => !cleared(pointAt(ps, at(k))));
  const edge = (s0, s1) => {
    const k0 = !cleared(pointAt(ps, s0));
    for (let i = 0; i < 30; i++) {
      const m = (s0 + s1) / 2;
      if (!cleared(pointAt(ps, m)) === k0) s0 = m;
      else s1 = m;
    }
    return (s0 + s1) / 2;
  };
  const runs = [];
  for (let k = 0; k <= n; ) {
    if (!keep[k]) {
      k++;
      continue;
    }
    const a = k;
    while (k <= n && keep[k]) k++;
    runs.push([a === 0 ? 0 : edge(at(a - 1), at(a)), k > n ? T : edge(at(k - 1), at(k))]);
  }
  const out = [];
  if (/Z\s*$/i.test(d) && runs.length > 1 && runs[0][0] === 0 && runs.at(-1)[1] === T) {
    const [first, last] = [runs.shift(), runs.pop()];
    out.push(`${stretch(d, last[0], T, ps)}${stretch(d, 0, first[1], ps).replace(/^M[^A-Z]*/i, '')}`);
  }
  return [...out, ...runs.filter(([a, b]) => b - a >= min).map(([a, b]) => stretch(d, a, b, ps))];
}
/** A run clipped behind a front piece, closed back along the edge of what it cleared (its fill). */
function closeBehind(run, fr, step = 0.25) {
  const ps = pieces(run);
  const [a, b] = [pointAt(ps, 0), pointAt(ps, ps.total)];
  const n = Math.max(2, Math.ceil(len(sub(a, b)) / step));
  const edge = Array.from({ length: n - 1 }, (_, k) => {
    let p = lerp(b, a, (k + 1) / n);
    for (let i = 0; i < 4; i++) {
      const q = fr.nearest(p);
      p = add(q, mul(unit(sub(p, q)), fr.clear));
    }
    return p;
  });
  return `${run}${edge.map((p) => `L${P(p)}`).join('')}Z`;
}
/** Where an outline crosses x = v (axis 'x') or y = v (axis 'y'): the crossing nearest `from`. */
function meet(d, axis, v, from) {
  const pts = outline(d, 0.02);
  const [k, o] = axis === 'x' ? [0, 1] : [1, 0];
  let best = null;
  for (let i = 1; i < pts.length; i++) {
    const [p, q] = [pts[i - 1], pts[i]];
    if ((p[k] - v) * (q[k] - v) > 0 || p[k] === q[k]) continue;
    const c = p[o] + ((v - p[k]) / (q[k] - p[k])) * (q[o] - p[o]);
    if (best === null || Math.abs(c - from) < Math.abs(best - from)) best = c;
  }
  return best;
}

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
const NU = nucleo.icons;
/** datos' target: its ring, its inner ring and its center. */
const TARGET = datos.icons.target.d;
/** datos' bars: 3.75 wide, radius 1.15, square feet on 20.75 (bar(x, top)). */
const BW = 3.75;
const BX = [3.25, 10.125, 17];
const bar = (x, top, bottom = 20.75) => sq(x, top, BW, bottom - top, 1.15, { square: ['bl', 'br'] });
/** lugares' tower: its body, six r 0.3 windows and the door. */
const OFFICE = lugares.icons['office-building'].d;
/** lugares' factory: its sawtooth body and its door. */
const FACTORY = lugares.icons.factory.d;
/** comercio's storefront: the awning, the walls and the door. */
const STORE = comercio.icons.store.d;
/** Núcleo's person: its head and shoulders. */
const PERSON = NU.person.d;
/** Núcleo's document: the portrait page with its signature corner. */
const DOC = NU.document.d[0];
/** The badges' center (DESIGN.md › Badges): pivots for the badge motions. */
const BC = [17.25, 17.25];

/**
 * Núcleo's person scaled from the feet (social's personAt): the head moves up to keep its gap from
 * the shoulders, never less than 2.35 between them, so a small person keeps its head apart at 2.1.
 */
const personAt = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};
/** A small target: the ring and its center (datos' target without the inner ring, which needs room). */
const bullseye = (c, r) => [circ(c[0], c[1], r), dot(c[0], c[1])];

/**
 * lugares' tower scaled by `s` about `o` and placed at `to`: its body and door scale, its windows
 * keep their r 0.3 (a dense group) at their scaled places.
 */
const officeAt = (s, o, to = o) => {
  const [body, ...rest] = OFFICE;
  const door = rest.pop();
  const win = rest.map((d) => {
    const c = d.match(/^M([\d.]+) ([\d.]+)/).slice(1).map(Number);
    const p = [to[0] + (c[0] + 0.3 - o[0]) * s, to[1] + (c[1] - o[1]) * s];
    return dot(p[0], p[1], 0.3);
  });
  return [place(body, s, o, to), ...win, place(door, s, o, to)];
};
// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const addIcon = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Strategy and decisions ──
// The play: the player (a ring) bottom left, its route dashed up and to the right, and the
// opponent's x it runs past. The arrowhead stands 3.25 from the x.
{
  const route = cubic([5.5, 16.25], [5.5, 9.25], [8.25, 5.5], [13.75, 5.5]);
  addIcon('strategy', ['estrategia', 'plan de juego', 'táctica', 'strategy', 'game plan', 'tactics'], [
    circ(5.5, 18.5, 2.25),
    ...run(route.d, 3),
    head(route.end, route.tangent, 3.4),
    line([17, 3.75], [20.5, 7.25]),
    line([20.5, 3.75], [17, 7.25]),
  ]);
}
// Pivot: the line rises to the pin (a ring) and turns sharply back down to the right.
{
  const pin = [7.5, 8.25];
  const r = 2.25;
  const tip = [20, 15.5];
  const u = unit(sub(tip, pin));
  addIcon('pivot', ['pivote', 'cambio de rumbo', 'giro estratégico', 'pivot', 'change of direction', 'startup pivot'], [
    line([pin[0], 21.25], [pin[0], pin[1] + r]),
    circ(pin[0], pin[1], r),
    line(add(pin, mul(u, r)), tip),
    head(tip, u, 4.5),
  ]);
}
// North star: a compass star with four rays, the bottom one twice as long, floating 3 above a
// short horizon.
{
  const c = [12, 8];
  const k = 2.1;
  const pts = [[12, 2.75], polar(c[0], c[1], k, -45), [17.5, 8], polar(c[0], c[1], k, 45), [12, 18.25], polar(c[0], c[1], k, 135), [6.5, 8], polar(c[0], c[1], k, 225)];
  addIcon('north-star', ['estrella polar', 'métrica guía', 'rumbo', 'north star', 'guiding metric', 'long-term direction'], [
    roundpoly(pts, [0.55, 0.6, 0.55, 0.6, 0.55, 0.6, 0.55, 0.6]),
    line([7, 21.25], [17, 21.25]),
  ]);
}
// Scenarios: the solid present forks into three futures: one runs straight on, the other two curve
// up and down into lanes 6.25 away; past the fork all three go on dashed.
{
  const F = [6.75, 12];
  const x1 = 10.25;
  const lane = (y) => cubic(F, [8.25, F[1] + Math.sign(y - F[1]) * 1.5], [8.25, y], [x1, y]).d;
  const dashes = (y) => [line([13.25, y], [15.75, y]), line([18.75, y], [21.25, y])];
  addIcon('scenarios', ['escenarios', 'qué pasaría si', 'planeación de escenarios', 'scenarios', 'what-if analysis', 'scenario planning'], [
    line([2.75, 12], [x1, 12]),
    lane(5.75),
    lane(18.25),
    ...[5.75, 12, 18.25].flatMap(dashes),
  ]);
}
// Market size: TAM, SAM and SOM, three circles nested and touching at the bottom.
addIcon('market-size', ['tamaño de mercado', 'mercado total', 'tam sam som', 'market size', 'addressable market', 'tam'], [circ(12, 12, 9), circ(12, 15, 6), circ(12, 18, 3)]);
// Gap analysis: datos' bars, a short one and a tall one; over the short one, the double arrow
// spans what it lacks (from the tall one's top to 3 above its own).
addIcon('gap-analysis', ['análisis de brechas', 'brecha', 'estado actual y deseado', 'gap analysis', 'gap', 'current vs target'], [
  bar(4.5, 14.25),
  bar(15.75, 3.75),
  line([6.375, 3.75], [6.375, 11.25]),
  head([6.375, 3.75], [0, -1], 3),
  head([6.375, 11.25], [0, 1], 3),
]);
// Competitive edge: three arrows from one start line, the middle one well ahead.
addIcon('competitive-edge', ['ventaja competitiva', 'competencia', 'posicionamiento', 'competitive edge', 'competitive advantage', 'competition'], [
  line([3.25, 3.75], [3.25, 20.25]),
  ...arrow([3.25, 6], [13, 6], 4),
  ...arrow([3.25, 12], [20.75, 12], 4),
  ...arrow([3.25, 18], [13, 18], 4),
]);
// Leverage: a lever on a triangular fulcrum near its right end; the long end down to the left, the
// block lifted on the short end (it rests on the lever, its foot on the lever's line).
{
  const A = [2.75, 18];
  const B = [21.25, 11];
  const u = unit(sub(B, A));
  const deg = (Math.atan2(u[1], u[0]) * 180) / Math.PI;
  const yAt = (x) => A[1] + ((x - A[0]) * (B[1] - A[1])) / (B[0] - A[0]);
  const fx = 14;
  // The fulcrum's apex, rounded (r 0.8), touches the lever's line from below
  const half = 3.25;
  const base = 20.75;
  const apexY = yAt(fx);
  const tri = roundpoly([[fx, apexY - 0.9], [fx + half, base], [fx - half, base]], [0.8, 1, 1]);
  // The block: 5 square, its foot on the lever from 15.75 to 20.75 along it, turned with it
  const s0 = 13.4;
  const foot = add(A, mul(u, s0));
  const block = turnPath(sq(foot[0], foot[1] - 5, 5, 5, 1.25), deg, foot);
  addIcon('leverage', ['apalancamiento', 'palanca', 'multiplicar', 'leverage', 'lever', 'force multiplier'], [line(A, B), tri, block]);
}
// Decision tree, drawn as decision analysis draws it, left to right with square elbows: the choice (a
// square) splits into two chance nodes (rings), and the upper one splits again into two outcomes.
const tree = ({ y = 12.75, sx = 2.75, s = 4.5, bx = 9.75, cx = 13.75, r = 2.25, dy = 5.5, fx = 18, fdy = 3.5, end = 21, rr = 1.25 }) => {
  const [up, dn] = [y - dy, y + dy];
  return [
    sq(sx, y - s / 2, s, s, 1.25),
    line([sx + s, y], [bx, y]),
    rline([[cx - r, up], [bx, up], [bx, dn], [cx - r, dn]], [0, rr, rr, 0]),
    circ(cx, up, r),
    circ(cx, dn, r),
    line([cx + r, up], [fx, up]),
    rline([[end, up - fdy], [fx, up - fdy], [fx, up + fdy], [end, up + fdy]], [0, rr, rr, 0]),
  ];
};
addIcon('decision-tree', ['árbol de decisión', 'opciones', 'resultados', 'decision tree', 'decision analysis', 'options'], tree({}));
// Pros and cons: the T-chart, a plus over the left column and a minus over the right.
addIcon('pros-cons', ['pros y contras', 'ventajas y desventajas', 'a favor y en contra', 'pros and cons', 'pros cons', 'trade-offs'], [
  line([7.25, 3.25], [7.25, 7.25]),
  line([5.25, 5.25], [9.25, 5.25]),
  line([14.75, 5.25], [18.75, 5.25]),
  line([3.25, 10.25], [20.75, 10.25]),
  line([12, 10.25], [12, 20.75]),
  line([5, 15], [9.1, 15]),
  line([14.9, 15], [19, 15]),
]);

// ── Growth ──
// Growth: datos' bars rising, and an arrow climbing over their tops (its lower arm 3 above the
// last bar). Decline is the same drawing mirrored, its arrowhead at the lower end.
const GROW_BARS = [bar(BX[0], 16.5), bar(BX[1], 14), bar(BX[2], 11.5)];
const GROW = [[3.25, 12], [20.5, 4.25]];
addIcon('growth', ['crecimiento', 'ventas al alza', 'resultados', 'growth', 'revenue growth', 'increase'], [...GROW_BARS, ...arrow(GROW[0], GROW[1])]);
{
  const bars = GROW_BARS.map((d) => flipPath(d));
  const [a, b] = GROW.map(([x, y]) => [24 - x, y]).reverse();
  addIcon('decline', ['caída', 'declive', 'ventas a la baja', 'decline', 'downturn', 'decrease'], [...bars, ...arrow(a, b)]);
}
// Growth curve: the hockey stick, flat 3 above the baseline and bending sharply up.
{
  const c = cubic([3.25, 17.75], [11.5, 17.75], [16.25, 14.5], [19, 4.75]);
  addIcon('growth-curve', ['curva de crecimiento', 'crecimiento exponencial', 'palo de hockey', 'growth curve', 'hockey stick', 'exponential growth'], [
    c.d,
    head(c.end, c.tangent, 4.5),
    line([3.25, 20.75], [20.75, 20.75]),
  ]);
}
// Flywheel: the wheel (rim, hub, three spokes) and one arc arrow around its upper right, 5 out, so
// the arrowhead's inner arm stays 2.85 clear of the rim.
const WHEEL = [9.5, 13.5];
{
  const [c, R] = [WHEEL, 5];
  const hub = 1.5;
  const a = arc(c[0], c[1], 10, -115, -5);
  addIcon('flywheel', ['volante de inercia', 'círculo virtuoso', 'ciclo de crecimiento', 'flywheel', 'growth loop', 'momentum'], [
    circ(c[0], c[1], R),
    circ(c[0], c[1], hub),
    ...[-90, 30, 150].map((g) => line(polar(c[0], c[1], hub, g), polar(c[0], c[1], R, g))),
    a.d,
    head(a.end, a.tangent, 3),
  ]);
}
// Breakthrough: the barrier, torn where the arrow goes through, its two ends bent the way the arrow
// travels and 3 clear of it.
{
  const end = rline([[10.5, 2.75], [10.5, 6.75], [13.5, 9]], [0, 2.5, 0]);
  addIcon('breakthrough', ['avance', 'romper barreras', 'disrupción', 'breakthrough', 'disruption', 'overcome'], [end, flipPath(end, 'y'), ...arrow([2.75, 12], [21.25, 12])]);
}
// Turnaround: the V rebound, falling steeply to its low point and climbing back past where it started.
addIcon('turnaround', ['recuperación', 'rebote', 'reestructura', 'turnaround', 'recovery', 'rebound'], [
  rline([[2.75, 6.5], [10.25, 18.25], [20.5, 4.25]], [0, 2.5, 0]),
  head([20.5, 4.25], [10.25, -14], 4.5),
]);

// ── Goals and OKRs ──
// The target small (its ring and center) over a progress capsule of 6, two thirds done.
addIcon('target-progress', ['avance de objetivo', 'resultados clave', 'okr', 'goal progress', 'key results', 'okr tracking'], [
  ...bullseye([12, 7.5], 4.75),
  pill(2.75, 15.25, 18.5, 6),
  line([5.75, 18.25], [14.08, 18.25]),
]);
// Cascade: the target at the top; its stem drops to the line that joins the teams' two smaller
// targets, below at either side.
addIcon('target-cascade', ['objetivos en cascada', 'alineación', 'okr de equipos', 'goal cascade', 'okr alignment', 'cascading goals'], [
  ...bullseye([12, 7.75], 5),
  line([12, 12.75], [12, 17.75]),
  line([9.75, 17.75], [14.25, 17.75]),
  ...bullseye([6.25, 17.75], 3.5),
  ...bullseye([17.75, 17.75], 3.5),
]);
// The target with a badge: datos' target at 90%, its center 1.5 up and left (the visual center of what
// the badge leaves, as the set's clock moves its pivot), so its center stays clear of the badge's
// clearance at every weight (9.55 from the badge's center; it needs 9.35 at bold) and it still reads
// as a target. In place, the center fell inside the clearance and two bitten rings were left.
const TARGET_B = [...TARGET.slice(0, 2).map((d) => place(d, 0.9, [12, 12], [10.5, 10.5])), dot(10.5, 10.5)];
addIcon('target-plus', ['nuevo objetivo', 'crear meta', 'agregar okr', 'new goal', 'add objective', 'create target'], TARGET_B, { badge: badge('plus') });
addIcon('target-alert', ['objetivo en riesgo', 'meta atrasada', 'fuera de ruta', 'goal at risk', 'off track', 'target alert'], TARGET_B, { badge: badge('alert') });

// A summit: lugares' mountain, 1.25 lower, and a swallowtail flag planted on the front summit. The
// front peak clears the one behind exactly as lugares' does (its clearance at regular), here by
// front() and clip(), as the pole needs the badge's place in front.
const SUMMIT = (() => {
  const LM = lugares.icons.mountain;
  const [behind, peak] = [LM.d[0], LM.badge.d[0]].map((d) => transform(d, 1, 0, 1.25));
  const fr = front([peak]);
  const [back] = clip(behind, fr.cleared);
  const top = Math.min(...outline(peak, 0.05).map((p) => p[1]));
  const x = 9.5;
  const pole = line([x, top], [x, 2.75]);
  const flag = rline([[x, 2.75], [x + 4.25, 2.75], [x + 3.1, 4.25], [x + 4.25, 5.75], [x, 5.75]], [0, 0.3, 0.3, 0.3, 0]);
  return { d: [peak, back, pole, flag], fill: { solid: [peak, closeBehind(back, fr), shut(flag)], wire: [pole] } };
})();
addIcon('mountain-flag', ['cumbre', 'meta a largo plazo', 'misión', 'mountain flag', 'summit', 'ambition'], SUMMIT.d);
// Scorecard: Núcleo's document with three measures, each a short line and its status dot (2.85 or
// more from the line's end and from the edge).
addIcon('scorecard', ['tablero de indicadores', 'kpi', 'cuadro de mando', 'scorecard', 'balanced scorecard', 'kpi card'], [
  DOC,
  ...[8.25, 12, 15.75].flatMap((y) => [line([8.75, y], [11.75, y]), dot(15.5, y)]),
]);
// Benchmark: datos' bars and the reference line across them, at the height the tall one passes: the
// line is in front, and the tall bar is cut 1.5 of paper clear of it on each side (front(), clip()).
const BENCH = (() => {
  const y = 10.25;
  const ref = line([2.75, y], [21.25, y]);
  const fr = front([ref]);
  const [cap, body] = clip(bar(BX[2], 3.75), fr.cleared).sort((p, q) => outline(p)[0][1] - outline(q)[0][1]);
  const d = [bar(BX[0], 13.25), bar(BX[1], 15.75), body, cap, ref];
  return { d, fill: { solid: [d[0], d[1], closeBehind(body, fr), closeBehind(cap, fr)], wire: [ref] } };
})();
addIcon('benchmark', ['punto de referencia', 'comparativa', 'estándar', 'benchmark', 'benchmarking', 'industry standard'], BENCH.d);
// Priority: three chevrons stacked up, 4.1 apart; they light up from the bottom.
addIcon('priority', ['prioridad', 'urgencia', 'nivel de prioridad', 'priority', 'high priority', 'importance'], [14.75, 9.75, 4.75].map((y) => line([5.5, y + 4.5], [12, y], [18.5, y + 4.5])));
// Milestone: the diamond on the timeline, the line meeting its side corners.
{
  const r = 1;
  const k = r * (Math.SQRT2 - 1);
  addIcon('milestone', ['hito', 'entregable', 'meta intermedia', 'milestone', 'gantt', 'checkpoint'], [
    roundpoly([[12, 6.5], [17.5, 12], [12, 17.5], [6.5, 12]], r),
    line([2.75, 12], [6.5 + k, 12]),
    line([17.5 - k, 12], [21.25, 12]),
  ]);
}
// Org chart: Núcleo's person at the top; its stem drops to the line that joins the heads of two
// smaller people below (the line 3 under its shoulders).
{
  const top = personAt(0.45, 0, -9.02);
  const low = [-6.25, 6.25].map((dx) => personAt(0.4, dx, 0.65));
  const hy = 14.62;
  const hr = 3.7 * 0.4;
  const ORG = [...top, line([12, 11.58], [12, hy]), line([5.75 + hr, hy], [18.25 - hr, hy]), ...low.flat()];
  addIcon('org-chart', ['organigrama', 'estructura', 'jerarquía', 'org chart', 'organization chart', 'reporting lines'], ORG);
  // The pencil crosses the lower right person and would leave a wedge of its shoulders beyond its
  // tip: its knockout takes the corner past the pencil's lower edge too (the engine's pencil, the
  // engine's cut)
  const pen = badge('edit');
  const corner = 'M15.4 20.22L20.99 14.64H24V24H15.4Z';
  addIcon('org-chart-edit', ['reestructura', 'editar organigrama', 'reorganización', 'edit org chart', 'reorg', 'restructuring'], ORG, { badge: { ...pen, knock: `${pen.knock}${corner}` } });
}
// Risk matrix: likelihood against impact, the 3 × 3 grid on its two axes (open at the top and right,
// so the hot cell has room) and the risk in the top right cell.
{
  const a = 3.25;
  const b = 20.75;
  const g = [a + 17.5 / 3, a + (2 * 17.5) / 3];
  addIcon('risk-matrix', ['matriz de riesgos', 'probabilidad e impacto', 'evaluación de riesgos', 'risk matrix', 'risk assessment', 'heat map'], [
    rline([[a, a], [a, b], [b, b]], 0),
    ...g.map((x) => line([x, a], [x, b])),
    ...g.map((y) => line([a, y], [b, y])),
    dot(18.5, 5.5),
  ]);
}
// Contingency: plan A runs straight into the x; plan B leaves from the same start, climbs over the
// block and comes down onto the far side, where it runs on to its arrowhead. (Dashed, plan B broke into
// pieces that no longer read as one route at 18 px.)
{
  const y = 16.5;
  const S = [2.75, y];
  const up = cubic(S, [5.25, 11], [7.25, 6.75], [11.5, 6.75]);
  const down = cubic([11.5, 6.75], [15.5, 6.75], [16, y], [18.5, y]);
  addIcon('contingency', ['plan de contingencia', 'plan b', 'alternativa', 'contingency plan', 'fallback', 'workaround'], [
    line(S, [7.25, y]),
    line([9.5, y - 1.75], [13, y + 1.75]),
    line([13, y - 1.75], [9.5, y + 1.75]),
    `${up.d}${down.d.replace(/^M[^C]*/, '')}L21.25 ${y}`,
    head([21.25, y], [1, 0], 3.4),
  ]);
}
// Domino effect: three tiles, each with the domino's bar across its middle; the first tipped onto the
// second, which leans on the upright third. Each turns about its bottom right corner until it
// touches the next.
const dominoes = ({ w, h, r = 1.25, x3, g2, g1, y }) => {
  const tile = (B, deg) => turnPath(sq(B[0] - w, B[1] - h, w, h, r), deg, B);
  const bar = (B, deg) => turnPath(line([B[0] - w, B[1] - h / 2], [B[0], B[1] - h / 2]), deg, B);
  const xs = (d) => pieces(d).flatMap((q) => Array.from({ length: 81 }, (_, i) => q.at(i / 80)));
  // The angle at which a tile turned about B first reaches the other tile's outline: halved down to
  // a twentieth of a degree (the tile only leans further in, so reaching it is monotonic)
  const lean = (B, other) => {
    const o = xs(other);
    const inside = ([x, y]) => {
      let hit = false;
      for (let i = 0, j = o.length - 1; i < o.length; j = i++) if (o[i][1] > y !== o[j][1] > y && x < ((o[j][0] - o[i][0]) * (y - o[i][1])) / (o[j][1] - o[i][1]) + o[i][0]) hit = !hit;
      return hit;
    };
    const touches = (deg) => xs(tile(B, deg)).some((p) => o.some((q) => len(sub(p, q)) < 0.2));
    let [lo, hi] = [0, 80];
    while (hi - lo > 0.05) {
      const mid = (lo + hi) / 2;
      if (xs(tile(B, mid)).some((p) => inside(p)) || touches(mid)) hi = mid;
      else lo = mid;
    }
    let deg = 0;
    while (deg < lo - 0.5) deg += 0.05;
    for (; deg < 80; deg += 0.05) if (touches(deg)) return deg;
    return 0;
  };
  const B3 = [x3 + w, y];
  const B2 = [x3 - g2, y];
  const a2 = lean(B2, tile(B3, 0));
  const B1 = [B2[0] - w - g1, y];
  const a1 = lean(B1, tile(B2, a2));
  const ds = [tile(B1, a1), bar(B1, a1), tile(B2, a2), bar(B2, a2), tile(B3, 0), bar(B3, 0)];
  // Centered across the canvas: the chain's leftmost and rightmost points sit as far from 12
  const pts = ds.flatMap((d) => outline(d, 0.1));
  const [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const dx = Math.round((12 - (x0 + x1) / 2) * 4) / 4;
  return ds.map((d) => transform(d, 1, dx, 0));
};
addIcon('domino-effect', ['efecto dominó', 'reacción en cadena', 'riesgo en cascada', 'domino effect', 'chain reaction', 'knock-on effect'], dominoes({ w: 4.5, h: 10, x3: 15, g2: 3, g1: 3.5, y: 19.75 }));
// Bottleneck: the pipe on its side narrows to a neck (its walls 3 apart) and widens again; two dots
// queue at the wide left end and one, through, goes on at the right.
{
  const top = `M2.75 4.75H5.25C8.5 4.75 9.5 10.5 12 10.5C14.5 10.5 15.5 4.75 18.75 4.75H21.25`;
  addIcon('bottleneck', ['cuello de botella', 'restricción', 'obstáculo', 'bottleneck', 'constraint', 'choke point'], [top, flipPath(top, 'y'), dot(3.75, 12), dot(7.75, 12), dot(18.25, 12)]);
}

// ── Partnerships and companies ──
// Partnership: two companies side by side and the double arrow between their tops. Each is a small
// building with the signature corner: a window over a door (its legs 2.25 from the walls, apart at
// every weight; two windows side by side or a pair over a door ran into the walls at bold, and two
// windows in a column read as a remote).
{
  const bldg = (x, y = 10.75, w = 7, h = 10.5) => [box(x, y, w, h, 2), dot(x + w / 2, y + 3.25, 0.3), rline([[x + w / 2 - 1.25, y + h], [x + w / 2 - 1.25, y + 6.75], [x + w / 2 + 1.25, y + 6.75], [x + w / 2 + 1.25, y + h]], [0, 1, 1, 0])];
  const y = 5.5;
  addIcon('partnership', ['alianza', 'socios', 'colaboración b2b', 'partnership', 'alliance', 'b2b'], [...bldg(2.75), ...bldg(14.25), line([6.25, y], [17.75, y]), head([6.25, y], [-1, 0], 3), head([17.75, y], [1, 0], 3)]);
}
// Puzzle pieces: two pieces in one frame; their shared edge carries datos' puzzle knob, the tab of
// the left one fitting the slot of the right one.
addIcon('puzzle-pieces', ['piezas de rompecabezas', 'encaje', 'complemento', 'puzzle pieces', 'product-market fit', 'fit'], [
  box(3.25, 5.25, 17.5, 13.5, 3.5),
  'M12 5.25V10.32A2.25 2.25 0 1 1 12 13.68V18.75',
]);
// Merger: two small companies converge on one larger one; the converging lines meet 3 short of it.
addIcon('merger', ['fusión', 'unir empresas', 'consolidación', 'merger', 'merge companies', 'consolidation'], [
  sq(2.75, 3.25, 4.5, 4.5, 1.25),
  sq(2.75, 16.25, 4.5, 4.5, 1.25),
  line([7.25, 5.5], [10.75, 12], [7.25, 18.5]),
  box(13.75, 8.25, 7.5, 7.5, 2.25),
]);
// ── Offices ──
// Headquarters: the tower at 78% and, on its roof, a pennant.
{
  const T = officeAt(0.78, [12, 21.25]);
  const roof = 21.25 - 18.5 * 0.78;
  addIcon('headquarters', ['sede', 'oficinas centrales', 'corporativo', 'headquarters', 'head office', 'hq'], [
    ...T,
    line([12, roof], [12, 2.75]),
    rline([[12, 2.75], [15.75, 3.9], [12, 5.05]], [0, 0.4, 0]),
  ]);
}
// Branches: the tower at 75% on the left and two small offices (the signature squares) joined to it.
addIcon('office-branches', ['sucursales', 'filiales', 'subsidiarias', 'branch offices', 'branches', 'subsidiaries'], [
  ...officeAt(0.75, [5.25, 21.25], [2.75, 21.25]),
  line([12.875, 10.125], [16, 10.125]),
  line([12.875, 18.625], [16, 18.625]),
  box(16, 7.5, 5.25, 5.25, 1.5),
  box(16, 16, 5.25, 5.25, 1.5),
]);
const OFFICE_BADGES = {
  'office-building-plus': [['agregar empresa', 'nueva organización', 'nueva sede', 'add company', 'new organization', 'add location'], 'plus'],
  'office-building-search': [['buscar empresa', 'debida diligencia', 'consulta de empresas', 'company lookup', 'find company', 'due diligence'], 'search'],
  'office-building-check': [['empresa verificada', 'verificación de negocio', 'kyb', 'verified business', 'business verification', 'verified organization'], 'check'],
  'office-building-gear': [['ajustes de la empresa', 'configuración de organización', 'administrar empresa', 'company settings', 'organization settings', 'workspace settings'], 'gear'],
};
// Under a badge the tower keeps its body and the three windows the badge's clearance never reaches.
// The one beside them it takes at every weight, the bottom row only from regular up (lugares' windows
// are dots, removed whole, so they would come and go with the weight), and the door it cut into a
// hook: all four go, rather than be trimmed by hand
const OFFICE_B = OFFICE.slice(0, 4);
// The gear's teeth turn against the tower's right wall: 0.5 to the left, as comercio's card-gear, the
// outline interpolates cleanly from 0.9 to 2.1
for (const [name, [tags, kind]] of Object.entries(OFFICE_BADGES)) addIcon(name, tags, kind === 'gear' ? OFFICE_B.map((d) => transform(d, 1, -0.5, 0)) : OFFICE_B, { badge: badge(kind) });

// ── Stores and openings ──
// Franchise: comercio's storefront at 72% and, behind it, a copy shown as its silhouette (the
// awning's top and the walls), 5.9 to the right and 4.5 up, as a stack of copies shows the one
// behind; the store in front is a custom piece the engine clears from it. The offsets keep every
// edge of the copy either well inside that clearance or well clear of it (its scallops, under the
// front awning's edge, left slivers).
{
  const s = 0.72;
  const [awning, walls, door] = STORE;
  const at = (d, dx, dy) => place(d, s, [3.25, 20.75], [2.75 + dx, 21.25 + dy]);
  // The awning's top (up to its right foot) and the walls closed up to it
  const foot = awning.indexOf('L20.75 8.25');
  if (foot < 0) throw new Error("franchise: comercio's awning no longer ends at 20.75 8.25");
  const hull = `${awning.slice(0, foot + 11)}H19.25V20.75H7A2.25 2.25 0 0 1 4.75 18.5V8.25Z`;
  const fr = [awning, walls, door].map((d) => at(d, 0, 0));
  addIcon('franchise', ['franquicia', 'cadena de tiendas', 'tiendas iguales', 'franchise', 'chain store', 'retail chain'], [at(hull, 5.9, -4.5)], {
    badge: own(fr, at(hull, 0, 0), { solid: [fr[0], shut(fr[1])], cut: [fr[2]] }),
  });
}
// ── Suppliers and procurement ──
// Supplier: lugares' factory at 72% from its foot, and the arrow its goods leave by, to the right
// over the roof (clear of the badges' corner). At this size the factory goes without its door: under
// a badge its clearance took the door's corner and left a stub.
const SUPPLIER = [place(FACTORY[0], 0.72, [2.75, 21.25]), ...arrow([9.5, 5.25], [21.25, 5.25])];
addIcon('supplier', ['proveedor', 'fabricante', 'abastecimiento', 'supplier', 'vendor', 'manufacturer'], SUPPLIER);
addIcon('supplier-check', ['proveedor aprobado', 'proveedor verificado', 'lista de proveedores', 'approved supplier', 'verified vendor', 'approved vendor list'], SUPPLIER, { badge: badge('check') });
addIcon('supplier-search', ['buscar proveedor', 'abastecimiento', 'evaluar proveedores', 'sourcing', 'find supplier', 'vendor search'], SUPPLIER, { badge: badge('search') });
// Deal won and lost: comercio's deal 3 higher, with a status badge. The badge takes the engine's
// single cleared piece, so the hand in front clears the one behind here (front(), clip()), exactly
// as the deal's own knockout does; the badge clears the right cuff's foot and the last fingers.
const DEAL_UP = (() => {
  const up = (d) => transform(d, 1, 0, -3);
  const [backHand, backCuff] = comercio.icons.deal.d.map(up);
  const [hand, cuff] = comercio.icons.deal.badge.d.map(up);
  const fr = front([`${hand}Z`, cuff]);
  const [back] = clip(backHand, fr.cleared);
  return { d: [back, backCuff, hand, cuff], fill: { solid: [closeBehind(back, fr), backCuff, `${hand}Z`, cuff] } };
})();
addIcon('deal-check', ['trato cerrado', 'venta ganada', 'acuerdo cerrado', 'deal won', 'closed won', 'deal closed'], DEAL_UP.d, { badge: badge('check') });
addIcon('deal-x', ['trato perdido', 'venta perdida', 'acuerdo cancelado', 'deal lost', 'closed lost', 'lost deal'], DEAL_UP.d, { badge: badge('x') });

// ── Quality and lean ──
// PDCA wheel: the wheel (four quadrants square to the page, its rim an arc arrow turning clockwise,
// uphill) rests on a 12° slope; the wedge behind it, its face tangent to the rim, stops it from
// rolling back. The rim's arrowhead stands at the top left, `gap` degrees short of the spoke it turns
// toward, so the quadrants and the arrow read apart (with the quadrants turned to the slope and the
// arrowhead between two spokes, the wheel read as a ball).
const pdca = ({ slope, A, R, sc = 12, x0, h, end = 19, gap = 27, arm, lag = 4 }) => {
  const a = (slope * Math.PI) / 180;
  const u = [Math.cos(a), -Math.sin(a)];
  const n = [-Math.sin(a), -Math.cos(a)];
  const at = (x, y) => add(add(A, mul(u, x)), mul(n, y));
  const c = at(sc, R);
  const dist = (x1) => {
    const [p, q] = [at(x0, h), at(x1, 0)];
    const v = unit(sub(q, p));
    const w = sub(c, p);
    return Math.abs(w[0] * v[1] - w[1] * v[0]) - R;
  };
  let [lo, hi] = [x0 + 0.5, sc];
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (dist(m) > 0) lo = m;
    else hi = m;
  }
  const wedge = roundpoly([at(x0, 0), at(x0, h), at(lo, 0)], [0.6, 0.6, 0.4]);
  // The rim runs from the right spoke round to `gap` short of the top one; the arrowhead follows the
  // rim's last 4° (a hair outside its tangent), so the rim never curves into its inner arm
  const tip = 270 - gap;
  const rim = arc(c[0], c[1], R, -90, tip);
  const aim = sub(rim.end, polar(...c, R, tip - lag));
  return {
    c,
    d: [line(A, at(end, 0)), rim.d, head(rim.end, aim, arm), line(polar(...c, R, 90), polar(...c, R, 270)), line(polar(...c, R, 0), polar(...c, R, 180)), wedge],
  };
};
const PDCA = pdca({ slope: 12, R: 6.75, h: 5, x0: 3.25, arm: 3, A: [2.75, 20.5] });
addIcon('pdca-wheel', ['mejora continua', 'ciclo pdca', 'kaizen', 'continuous improvement', 'pdca cycle', 'plan do check act'], PDCA.d);
// Fishbone: the spine runs into the effect (a box with the signature corner, the problem the diagram
// explains); two ribs join it from above and two from below, slanting toward it.
addIcon('fishbone', ['espina de pescado', 'causa raíz', 'diagrama de ishikawa', 'fishbone', 'root cause analysis', 'ishikawa diagram'], [
  line([2.75, 12], [15.25, 12]),
  box(15.25, 8.75, 6, 6.5, 2),
  ...[3.5, 9].flatMap((x) => [line([x, 5], [x + 3.75, 12]), line([x, 19], [x + 3.75, 12])]),
]);
// Audit: Núcleo's document with two checked rows (legal's compliance rows), under the engine's
// magnifier. The rows stay clear of its clearance at every weight (the second line ends 7.45 from the
// badge's center) and of each other and the page (2.85 or more).
{
  const tick = (cx, cy, w = 2) => line([cx - w * 0.5, cy + w * 0.04], [cx - w * 0.15, cy + w * 0.38], [cx + w * 0.5, cy - w * 0.34]);
  addIcon('audit', ['auditoría', 'revisión de controles', 'inspección', 'audit', 'review', 'controls check'], [DOC, tick(8.75, 6.3), line([12.55, 6.3], [15.5, 6.3]), tick(8.75, 10.3), line([12.55, 10.3], [14.55, 10.3])], {
    badge: badge('search'),
  });
}

// ── Charts ──
// Pareto: datos' bars falling, and the cumulative curve that rises from the first one's top and
// flattens toward the top right.
{
  const c = cubic([BX[0] + BW / 2, 9.25], [8, 5.5], [12.5, 3.75], [20.75, 3.25]);
  addIcon('chart-pareto', ['diagrama de pareto', 'regla 80/20', 'análisis de pareto', 'pareto chart', '80/20 rule', 'pareto analysis'], [bar(BX[0], 9.25), bar(BX[1], 13.25), bar(BX[2], 16.75), c.d]);
}
// Break-even: datos' axes; revenue climbs steeply from the origin, cost starts higher and climbs
// gently; where they cross, a ring, the lines meeting its edge.
const BREAK_EVEN = (() => {
  const O = [3.25, 20.75];
  const rev = [O, [17.25, 4.25]];
  const cost = [[3.25, 13.25], [20.75, 8.25]];
  // Where the two lines cross
  const [[x1, y1], [x2, y2]] = rev;
  const [[x3, y3], [x4, y4]] = cost;
  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const X = lerp(rev[0], rev[1], t);
  const r = 2.25;
  const to = (p) => add(X, mul(unit(sub(p, X)), r));
  addIcon('chart-break-even', ['punto de equilibrio', 'ingresos y costos', 'análisis de equilibrio', 'break-even', 'break-even point', 'cost volume profit'], [
    rline([[3.25, 3.25], O, [20.75, 20.75]], 0),
    line(rev[0], to(rev[0])),
    line(to(rev[1]), rev[1]),
    line(cost[0], to(cost[0])),
    line(to(cost[1]), cost[1]),
    circ(X[0], X[1], r),
  ]);
  return X;
})();
// Pyramid: a flat triangle split into three tiers of equal height.
{
  const [T, L, Rt] = [[12, 2.75], [2.4, 20.75], [21.6, 20.75]];
  const xAt = (y, side) => T[0] + (side * (y - T[1]) * (Rt[0] - T[0])) / (Rt[1] - T[1]);
  addIcon('chart-pyramid', ['pirámide', 'jerarquía', 'niveles', 'pyramid chart', 'hierarchy', 'tiers'], [
    roundpoly([T, Rt, L], [1.25, 1, 1]),
    ...[8.75, 14.75].map((y) => line([xAt(y, -1), y], [xAt(y, 1), y])),
  ]);
}

// ── Processes ──
// Process: three chevron blocks in a row, each one's point nesting in the next one's notch, their
// slanted edges 3 apart.
{
  const [y0, y1] = [6.5, 17.5];
  const p = 2.25;
  const sin = (y1 - y0) / 2 / Math.hypot(p, (y1 - y0) / 2);
  const dx = 3 / sin;
  const W = (21.5 - 2.5 - 2 * dx - p) / 3;
  const ym = (y0 + y1) / 2;
  const block = (L, notch) => {
    const R = L + W;
    return roundpoly([[L, y0], [R, y0], [R + p, ym], [R, y1], [L, y1], ...(notch ? [[L + p, ym]] : [])], [0.75, 0.75, 0.75, 0.75, 0.75, 0.5]);
  };
  addIcon('process', ['proceso', 'etapas', 'flujo de trabajo', 'process', 'stages', 'pipeline stages'], [0, 1, 2].map((i) => block(2.5 + i * (W + dx), i > 0)));
}
// Value stream: two process boxes joined by an arrow (its arms and its tip 3 clear of the boxes),
// above the timeline that steps down under each process and up between them.
addIcon('value-stream', ['flujo de valor', 'mapa de flujo de valor', 'lean', 'value stream', 'value stream mapping', 'lean management'], [
  box(2.75, 4.25, 5, 5, 1.5),
  box(16.25, 4.25, 5, 5, 1.5),
  ...arrow([7.75, 6.75], [13.1, 6.75], 3),
  rline([[2.75, 19.5], [7.75, 19.5], [7.75, 14.5], [16.25, 14.5], [16.25, 19.5], [21.25, 19.5]], [0, 1, 1, 1, 1, 0]),
]);

// ── Ownership and models ──
// Shareholder: Núcleo's person 2.25 to the left and, where a badge would go, datos' pie slice (turned
// to face them): a custom piece the engine clears.
{
  const slice = turnPath(datos.icons['chart-pie'].d[1], 180);
  addIcon('shareholder', ['accionista', 'socio capitalista', 'participación', 'shareholder', 'equity', 'equity owner'], PERSON.map((d) => transform(d, 1, -2.25, 0)), {
    badge: own([slice], slice, { solid: [slice] }),
  });
}
// Business canvas: the landscape frame, 17.5 × 12.5 (at 19 × 14 its eleven cells passed the set's
// density); its upper two thirds split into the canvas's five columns, the second and fourth halved,
// its lower third in two. The lines end on the frame, where its corners curve.
{
  const frame = box(3.25, 5.75, 17.5, 12.5, 3.5);
  const [yb, ym] = [14.25, 10];
  const cols = [6.75, 10.25, 13.75, 17.25];
  addIcon('business-canvas', ['modelo de negocio', 'lienzo de negocio', 'lean canvas', 'business model canvas', 'business canvas', 'business model'], [
    frame,
    ...cols.map((x) => line([x, meet(frame, 'x', x, 5.75)], [x, yb])),
    line([meet(frame, 'y', yb, 3.25), yb], [20.75, yb]),
    line([12, yb], [12, 18.25]),
    // Activities and resources, relationships and channels
    line([cols[0], ym], [cols[1], ym]),
    line([cols[2], ym], [cols[3], ym]),
  ]);
}
// Playbook: archivos' open book with a play drawn on it: the player's x on the left page and, past
// the spine, the route it runs on the right one, rising to its arrowhead, both 2.85 or more clear of
// the spine and the pages' edges (a dashed route across both pages read as a dash and an arrow).
{
  const [pages, spine] = archivos.icons['book-open'].d;
  const route = cubic([15, 14.5], [15.75, 12.5], [16.75, 11.25], [18.25, 10.25]);
  addIcon('playbook', ['manual de jugadas', 'guía de procedimientos', 'estrategia comercial', 'playbook', 'runbook', 'sales playbook'], [
    pages,
    spine,
    line([5.85, 11.25], [8.85, 14.25]),
    line([8.85, 11.25], [5.85, 14.25]),
    route.d,
    head(route.end, route.tangent, 2.75),
  ]);
}

// Maze: five by five cells, 3.4 apart (1.9 of paper between walls at regular, 1.3 at bold); the way in
// at the top, the way out at the bottom, and every wall joined to the outer one, so the path winds
// through all the cells. Its outer corners are the set's large radius; inside, 0.75.
{
  const G = (i) => 3.5 + 3.4 * i;
  const wall = (...pts) => rline(pts.map(([i, j]) => [G(i), G(j)]), pts.map(([i, j]) => ((i === 0 || i === 5) && (j === 0 || j === 5) ? 2.5 : 0.75)));
  addIcon('maze', ['laberinto', 'problema complejo', 'encontrar el camino', 'maze', 'labyrinth', 'complex problem'], [
    wall([1, 0], [0, 0], [0, 5], [3, 5]),
    wall([2, 0], [5, 0], [5, 5], [4, 5]),
    wall([2, 0], [2, 1], [1, 1], [1, 2]),
    wall([0, 3], [1, 3], [1, 4], [2, 4], [2, 2], [3, 2], [3, 1], [4, 1]),
    wall([5, 2], [4, 2], [4, 4], [3, 4]),
  ]);
}

// ── Fill, parts, motion, mirror, levels and variants ──────────────────────────────────────────
const pick = (name, ix) => ix.map((i) => icons[name].d[i]);
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
// Each icon's fill from its own strokes (DESIGN.md › Fill): `solid` closed shapes, `cut` knocked out,
// `lines` on top with a clearance, `wire` on top and attached
const FILL = {
  strategy: { solid: [0], wire: [1, 2, 3, 4, 5, 6] },
  pivot: { solid: [1], wire: [0, 2, 3] },
  'north-star': { solid: [0], lines: [1] },
  'market-size': { solid: [0], cut: [1, 2] },
  'gap-analysis': { solid: [0, 1], lines: [2, 3, 4] },
  leverage: { solid: [1, 2], wire: [0] },
  'decision-tree': { solid: [0, 3, 4], wire: [1, 2, 5, 6] },
  growth: { solid: [0, 1, 2], lines: [3, 4] },
  decline: { solid: [0, 1, 2], lines: [3, 4] },
  flywheel: { solid: [0], cut: [1, 2, 3, 4], lines: [5, 6] },
  'target-progress': { solid: [0, 2], cut: [1, 3] },
  'target-cascade': { solid: [0, 4, 6], cut: [1, 5, 7], wire: [2, 3] },
  'target-plus': { solid: [0], cut: [1, 2] },
  'target-alert': { solid: [0], cut: [1, 2] },
  scorecard: { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  milestone: { solid: [0], wire: [1, 2] },
  'org-chart': { solid: [0, 1, 4, 5, 6, 7], wire: [2, 3] },
  'org-chart-edit': { solid: [0, 1, 4, 5, 6, 7], wire: [2, 3] },
  // The tile that starts the chain filled; the two it knocks stay lines (touching solids left a
  // sliver of paper between them that came and went with the weight)
  'domino-effect': { solid: [0], cut: [1], lines: [2, 3, 4, 5] },
  partnership: { solid: [0, 3], cut: [1, 2, 4, 5], wire: [6, 7, 8] },
  'puzzle-pieces': { solid: [0], cut: [1] },
  merger: { solid: [0, 1, 3], wire: [2] },
  headquarters: { solid: [0], cut: range(1, 8), wire: [8] },
  'office-branches': { solid: [0, 10, 11], cut: range(1, 8), wire: [8, 9] },
  'office-building-plus': { solid: [0], cut: [1, 2, 3] },
  'office-building-search': { solid: [0], cut: [1, 2, 3] },
  'office-building-check': { solid: [0], cut: [1, 2, 3] },
  'office-building-gear': { solid: [0], cut: [1, 2, 3] },
  franchise: { solid: [0] },
  supplier: { solid: [0], lines: [1, 2] },
  'supplier-check': { solid: [0], lines: [1, 2] },
  'supplier-search': { solid: [0], lines: [1, 2] },
  'pdca-wheel': { solid: [5], wire: [0, 1, 2, 3, 4] },
  fishbone: { solid: [1], wire: [0, 2, 3, 4, 5] },
  audit: { solid: [0], cut: [1, 2, 3, 4] },
  'chart-pareto': { solid: [0, 1, 2], wire: [3] },
  'chart-break-even': { solid: [5], wire: [0, 1, 2, 3, 4] },
  'chart-pyramid': { solid: [0], cut: [1, 2] },
  process: { solid: [0, 1, 2] },
  'value-stream': { solid: [0, 1], wire: [2, 3], lines: [4] },
  shareholder: { solid: [0, 1] },
  'business-canvas': { solid: [0], cut: range(1, 9) },
  playbook: { solid: [0], cut: [1, 2, 3, 4, 5] },
};
for (const [name, spec] of Object.entries(FILL)) {
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, ix]) => [k, pick(name, ix)]));
}
// Open outlines that fill closed: the flag and the pennant along their pole
const closing = { headquarters: [9] };
for (const [name, ix] of Object.entries(closing)) icons[name].fill.solid.push(...ix.map((i) => shut(icons[name].d[i])));
// The deal family: both hands filled, the one behind closed along what the front one clears
for (const name of ['deal-check', 'deal-x']) icons[name].fill = DEAL_UP.fill;
icons.benchmark.fill = BENCH.fill;
icons['mountain-flag'].fill = SUMMIT.fill;
// Open lines only: their filled version is the outline itself
for (const name of ['scenarios', 'competitive-edge', 'pros-cons', 'growth-curve', 'turnaround', 'priority', 'risk-matrix', 'contingency', 'breakthrough', 'bottleneck', 'maze']) icons[name].fill = false;

const PARTS = {
  strategy: { player: [0], route: [1, 2, 3, 4], opponent: [5, 6] },
  pivot: { line: [0, 2, 3], pin: [1] },
  'north-star': { star: [0], horizon: [1] },
  scenarios: { line: [0], paths: range(1, 9) },
  'market-size': { total: [0], serviceable: [1], obtainable: [2] },
  'gap-analysis': { bars: [0, 1], arrow: [2, 3, 4] },
  'competitive-edge': { start: [0], arrows: [1, 2, 5, 6], leader: [3, 4] },
  leverage: { lever: [0], fulcrum: [1], block: [2] },
  'decision-tree': { choice: [0], branches: [1, 2, 5, 6], outcomes: [3, 4] },
  'pros-cons': { plus: [0, 1], minus: [2], chart: [3, 4, 5, 6] },
  growth: { bars: [0, 1, 2], arrow: [3, 4] },
  decline: { bars: [0, 1, 2], arrow: [3, 4] },
  'growth-curve': { line: [0], arrow: [1], axis: [2] },
  flywheel: { wheel: [0, 1, 2, 3, 4], arrow: [5, 6] },
  breakthrough: { wall: [0, 1], arrow: [2, 3] },
  turnaround: { line: [0], arrow: [1] },
  'target-progress': { target: [0, 1], bar: [2], progress: [3] },
  'target-cascade': { target: [0, 1], connector: [2, 3], teams: [4, 5, 6, 7] },
  'target-plus': { rings: [0, 1], center: [2] },
  'target-alert': { rings: [0, 1], center: [2] },
  'mountain-flag': { mountain: [0, 1], pole: [2], flag: [3] },
  scorecard: { card: [0], measures: range(1, 7) },
  benchmark: { bars: [0, 1, 2, 3], reference: [4] },
  priority: { level: [0, 1, 2] },
  milestone: { milestone: [0], timeline: [1, 2] },
  'org-chart': { head: [0, 1], connector: [2, 3], reports: [4, 5, 6, 7] },
  'org-chart-edit': { head: [0, 1], connector: [2, 3], reports: [4, 5, 6, 7] },
  'risk-matrix': { grid: [0, 1, 2, 3, 4], risk: [5] },
  contingency: { path: [0], block: [1, 2], detour: [3, 4] },
  'domino-effect': { tiles: [0, 1, 2, 3, 4, 5] },
  bottleneck: { pipe: [0, 1], queue: [2, 3], through: [4] },
  partnership: { companies: range(0, 6), link: [6, 7, 8] },
  'puzzle-pieces': { frame: [0], seam: [1] },
  merger: { companies: [0, 1], paths: [2], merged: [3] },
  headquarters: { building: range(0, 8), pole: [8], flag: [9] },
  'office-branches': { headquarters: range(0, 8), links: [8, 9], branches: [10, 11] },
  franchise: { copy: [0] },
  supplier: { factory: [0], arrow: [1, 2] },
  'supplier-check': { factory: [0], arrow: [1, 2] },
  'supplier-search': { factory: [0], arrow: [1, 2] },
  'deal-check': { hands: [0, 2], cuffs: [1, 3] },
  'deal-x': { hands: [0, 2], cuffs: [1, 3] },
  'pdca-wheel': { slope: [0], wheel: [1, 2, 3, 4], wedge: [5] },
  fishbone: { spine: [0], effect: [1], causes: [2, 3, 4, 5] },
  audit: { page: [0], checks: [1, 2, 3, 4] },
  'chart-pareto': { bars: [0, 1, 2], curve: [3] },
  'chart-break-even': { axis: [0], revenue: [1, 2], cost: [3, 4], point: [5] },
  'chart-pyramid': { pyramid: [0], tiers: [1, 2] },
  process: { stages: [0, 1, 2] },
  'value-stream': { processes: [0, 1], flow: [2, 3], timeline: [4] },
  shareholder: { person: [0, 1] },
  'business-canvas': { frame: [0], blocks: range(1, 9) },
  playbook: { book: [0, 1], player: [2, 3], play: [4, 5] },
  maze: { walls: [0, 1, 2, 3, 4] },
};
for (const name of ['office-building-plus', 'office-building-search', 'office-building-check', 'office-building-gear']) PARTS[name] = { body: [0], windows: [1, 2, 3] };
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// Badges move as the set's do: a plus or a check beats, an alert, an x, a magnifier or a pencil
// wiggles, a gear spins
const BADGE_MOTION = {
  plus: { effect: 'beat', parts: ['badge'], origin: BC },
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  alert: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  x: { effect: 'wiggle', parts: ['badge'], origin: BC },
  search: { effect: 'wiggle', parts: ['badge'], origin: BC },
  edit: { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  gear: { effect: 'spin', parts: ['badge'], origin: BC },
};
const MOTION = {
  strategy: { effect: 'slide', parts: ['route'], vector: [1.5, -1] },
  pivot: { effect: 'wiggle', parts: ['line'], origin: [7.5, 8.25] },
  'north-star': { effect: 'beat', parts: ['star'], origin: [12, 8.25] },
  'competitive-edge': { effect: 'slide', parts: ['leader'], vector: [1.5, 0] },
  leverage: { effect: 'wiggle', parts: ['lever', 'block'], origin: [14, 13.5] },
  growth: { effect: 'slide', parts: ['arrow'], vector: [1.5, -0.75] },
  decline: { effect: 'slide', parts: ['arrow'], vector: [1.5, 0.75] },
  'growth-curve': { effect: 'slide', parts: ['line', 'arrow'], vector: [0.5, -1.5] },
  flywheel: { effect: 'spin', parts: ['wheel'], origin: WHEEL },
  breakthrough: { effect: 'slide', parts: ['arrow'], vector: [2, 0] },
  turnaround: { effect: 'slide', parts: ['arrow'], vector: [1, -1.25] },
  'mountain-flag': { effect: 'wiggle', parts: ['flag'], origin: [9.5, 2.75] },
  priority: { effect: 'slide', vector: [0, -1.5] },
  milestone: { effect: 'beat', parts: ['milestone'], origin: [12, 12] },
  'risk-matrix': { effect: 'beat', parts: ['risk'], origin: [18.5, 5.5] },
  'domino-effect': { effect: 'wiggle', parts: ['tiles'], origin: [12, 19.75] },
  bottleneck: { effect: 'slide', parts: ['queue'], vector: [1.5, 0] },
  headquarters: { effect: 'wiggle', parts: ['flag'], origin: [12, 2.75] },
  supplier: { effect: 'slide', parts: ['arrow'], vector: [2, 0] },
  'pdca-wheel': { effect: 'spin', parts: ['wheel'], origin: PDCA.c },
  'chart-break-even': { effect: 'beat', parts: ['point'], origin: BREAK_EVEN },
  'value-stream': { effect: 'slide', parts: ['flow'], vector: [1.5, 0] },
};
for (const [name, icon] of Object.entries(icons)) if (icon.badge?.kind && !MOTION[name]) MOTION[name] = BADGE_MOTION[icon.badge.kind];
MOTION.shareholder = { effect: 'beat', parts: ['badge'], origin: [17.25, 17.25] };
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// Levels: priority lights its chevrons from the bottom up (value 0–1)
icons.priority.levels = [[0], [1], [2]];

// Mirror: what reads left to right (routes, arrows, flows, charts that grow) flips in right-to-left
// languages; the objects themselves (a store, a building, a wheel that turns clockwise) do not
for (const name of [
  'strategy', 'pivot', 'scenarios', 'competitive-edge', 'growth', 'decline', 'growth-curve', 'breakthrough', 'turnaround', 'decision-tree',
  'contingency', 'domino-effect', 'bottleneck', 'merger', 'supplier', 'supplier-check', 'supplier-search',
  'fishbone', 'chart-pareto', 'chart-break-even', 'process', 'value-stream', 'playbook',
])
  icons[name].mirror = true;

// A slash through loose lines says nothing; enclosing an icon already enclosed neither
for (const name of ['scenarios', 'competitive-edge', 'pros-cons', 'turnaround', 'contingency']) icons[name].variants = { ...icons[name].variants, slash: false };
icons.maze.variants = { ...icons.maze.variants, circle: false, square: false };
// Already round: nested rings and the target don't get enclosed in another circle
for (const name of ['market-size', 'target-plus', 'target-alert']) icons[name].variants = { ...icons[name].variants, circle: false };

// ── 16 px (DESIGN.md › 16 px): own drawings where snapping leaves a smudge ──
// At 16 px a pixel is 1.5 of the canvas and pixel centers fall at 0.75 + 1.5k; g(column, row) is the
// center of a pixel. New marks run from center to center, square, at 45° or at 1:3, every gap at
// least a pixel. The engine doesn't snap a `small` nor swap its badge: borrowed outlines are snapped
// here and a badge comes in its pixel version (comercio's convention).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
const poly = (...pts) => roundpoly(pts.map(([c, r]) => g(c, r)), 0);
/** Small drawings go through the engine's snap too: their dots become crisp 2 × 2 pixels. */
const crisp = (sm) => ({ ...sm, d: sm.d.map((d) => snap(d)), ...(sm.fill && { fill: Object.fromEntries(Object.entries(sm.fill).map(([k, v]) => [k, v.map((d) => snap(d))])) }) });
// Process: the first block and the two stages after it as chevrons, two pixels apart along their
// slants (blocks a pixel apart turned the slants into a checkerboard).
{
  const b1 = poly([2, 4], [4, 4], [7, 7], [4, 10], [2, 10]);
  const chevrons = [pl([7, 4], [10, 7], [7, 10]), pl([10, 4], [13, 7], [10, 10])];
  icons.process.small = { d: [b1, ...chevrons], fill: { solid: [b1], wire: chevrons } };
}
// Maze: four by four cells, 3 pixels apart (a pixel of paper between walls would be a checkerboard
// at five), the way in at the top and out at the bottom, the path winding through every row.
{
  const W = (...pts) => pl(...pts.map(([i, j]) => [1 + 3 * i, 1 + 3 * j]));
  icons.maze.small = { d: [W([1, 0], [0, 0], [0, 4], [2, 4], [2, 2], [3, 2], [3, 1]), W([2, 0], [4, 0], [4, 4], [3, 4], [3, 3]), W([2, 0], [2, 1], [1, 1], [1, 3])] };
}
// Contingency: the stub and the block on one row; plan B climbs at 1:3 and 45°, crosses over and drops
// onto the row two pixels clear of the block, then runs on to its pixel arrowhead.
icons.contingency.small = {
  d: [pl([1, 10], [3, 10]), pl([5, 9], [7, 11]), pl([7, 9], [5, 11]), pl([1, 10], [2, 7], [5, 4], [7, 4], [9, 6], [9, 9], [10, 10], [14, 10]), pl([12, 8], [14, 10], [12, 12])],
};
// Offices under a badge: lugares' own 16 px tower and the windows its pixel badge never reaches (the
// same three as at 24), with the badge in its pixel version.
{
  const T = lugares.icons['office-building'].small.d;
  const body = T[0];
  const windows = [T[1], T[2], T[4]];
  for (const [name, [, kind]] of Object.entries(OFFICE_BADGES)) icons[name].small = { d: [body, ...windows], fill: { solid: [body], cut: windows }, badge: badge(kind, { size: 16 }) };
}
// Decision tree: the pixel square, its elbow to two rings, and the upper ring's elbow to two outcomes.
{
  const d = [poly([1, 6], [3, 6], [3, 8], [1, 8]), pl([3, 7], [5, 7]), pl([6, 3], [5, 3], [5, 11], [6, 11]), circ(...g(8, 3), 2.25), circ(...g(8, 11), 2.25), pl([10, 3], [11, 3]), pl([14, 1], [11, 1], [11, 5], [14, 5])];
  icons['decision-tree'].small = { d, fill: { solid: [d[0], d[3], d[4]], wire: [d[1], d[2], d[5], d[6]] } };
}
// Break-even: the axes, revenue at 45° from the origin, cost at 1:3 from higher up, and the point where
// they cross.
{
  const d = [pl([1, 1], [1, 14], [14, 14]), pl([1, 14], [12, 3]), pl([1, 10], [13, 6]), dot(px(7.5), px(8.5))];
  icons['chart-break-even'].small = { d, fill: { solid: [d[3]], wire: d.slice(0, 3) } };
}
// Audit: the snapped page, two pixel checks with their lines above the badge's clearance, and the
// pixel magnifier.
{
  const page = snap(DOC);
  // Two pixel checks, the rows' lines left out: the second one's would fall in the badge's clearance
  const rows = [4, 8].map((r) => pl([4, r], [5, r + 1], [7, r - 1]));
  icons.audit.small = { d: [page, ...rows], fill: { solid: [page], cut: rows }, badge: badge('search', { size: 16 }) };
}
// Playbook: the book in pixels (its pages' edges at 1:3, the spine between them) and the play: the
// player's x on the left page and, past the spine, the arrow on the right one.
{
  const pages = poly([1, 3], [4, 3], [7, 4], [10, 3], [13, 3], [13, 12], [10, 12], [7, 13], [4, 12], [1, 12]);
  const spine = pl([7, 4], [7, 13]);
  const play = [pl([3, 7], [5, 9]), pl([5, 7], [3, 9]), pl([9, 9], [11, 7]), pl([9, 7], [11, 7], [11, 9])];
  icons.playbook.small = { d: [pages, spine, ...play], fill: { solid: [pages], cut: [spine, ...play] } };
}
// Bottleneck: the walls at 45° into a neck two pixels wide; two dots queue at the left, one is through.
{
  const walls = [pl([1, 3], [3, 3], [6, 6], [9, 6], [12, 3], [14, 3]), pl([1, 12], [3, 12], [6, 9], [9, 9], [12, 12], [14, 12])];
  icons.bottleneck.small = { d: [...walls, dot(...g(1.5, 7.5)), dot(...g(4.5, 7.5)), dot(...g(12.5, 7.5))] };
}
// Breakthrough: the arrow on its row, the two ends of the barrier bent at 45° the way it goes.
icons.breakthrough.small = { d: [pl([6, 0], [6, 2], [8, 4]), pl([6, 14], [6, 12], [8, 10]), pl([1, 7], [14, 7]), pl([11, 4], [14, 7], [11, 10])] };
// Fishbone: the spine into the effect's box and two ribs above and two below at 45°, two pixels apart.
{
  const d = [pl([1, 7], [10, 7]), poly([10, 5], [14, 5], [14, 9], [10, 9]), pl([1, 4], [4, 7]), pl([1, 10], [4, 7]), pl([4, 4], [7, 7]), pl([4, 10], [7, 7])];
  icons.fishbone.small = { d, fill: { solid: [d[1]], wire: [d[0], d[2], d[3], d[4], d[5]] } };
}
// Org chart: pixel people (a 2 × 2 head over 4 × 2 shoulders), the top one joined by a 2 × 2 stem to
// the bar that runs over the two lower heads (into them, the heads read as the bar's ends). Edited: the lower right person goes (the pixel pencil
// would cut it to a sliver) and the bar runs on under the pencil's clearance.
{
  const who = (c, r) => [poly([c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]), poly([c - 1, r + 3], [c + 2, r + 3], [c + 2, r + 4], [c - 1, r + 4])];
  const [top, left, right] = [who(6, 0), who(2, 9), who(10, 9)];
  const link = [poly([6, 5], [7, 5], [7, 6], [6, 6]), pl([2, 7], [11, 7])];
  const d = [...top, ...link, ...left, ...right];
  icons['org-chart'].small = { d, fill: { solid: [...top, link[0], ...left, ...right], wire: [link[1]] } };
  const e = [...top, ...link, ...left];
  icons['org-chart-edit'].small = { d: e, fill: { solid: [...top, link[0], ...left], wire: [link[1]] }, badge: badge('edit', { size: 16 }) };
}
// PDCA wheel: the wheel's rim and quadrants square to the pixels, the slope at 1:3 under it and the
// wedge behind it (the arrowhead goes: at this size it clogged the rim).
{
  const rim = circ(...g(8, 7), 4.5);
  const d = [pl([2, 13], [14, 9]), rim, pl([8, 4], [8, 10]), pl([5, 7], [11, 7]), poly([3, 12], [3, 10], [5, 12])];
  icons['pdca-wheel'].small = { d, fill: { solid: [d[4]], wire: d.slice(0, 4) } };
}
// Market size: the three rings at whole pixels from a pixel center, 6, 4 and 2 pixels, touching at the
// bottom.
{
  const d = [circ(...g(7, 8), 9), circ(...g(7, 10), 6), circ(...g(7, 12), 3)];
  icons['market-size'].small = { d, fill: { solid: [d[0]], cut: [d[1], d[2]] } };
}
// Leverage: the lever at 1:3 resting on the fulcrum's apex, and the block standing on its short end.
{
  const d = [pl([1, 12], [13, 8]), poly([10, 10], [12, 13], [8, 13]), poly([11, 4], [13, 4], [13, 7], [11, 7])];
  icons.leverage.small = { d, fill: { solid: [d[1], d[2]], wire: [d[0]] } };
}
// Domino effect: two tiles, the first tipped at 45° onto the upright second, each with its bar.
{
  const t1 = poly([1, 11], [6, 6], [8, 8], [3, 13]);
  const t2 = poly([9, 3], [12, 3], [12, 13], [9, 13]);
  const bars = [pl([4, 8], [6, 10]), pl([9, 8], [12, 8])];
  icons['domino-effect'].small = { d: [t1, bars[0], t2, bars[1]], fill: { solid: [t1], cut: [bars[0]], lines: [t2, bars[1]] } };
}
// Strategy: the player's ring, the route in two dashes and a shaft with its arrowhead, and the x a
// pixel clear of it.
icons.strategy.small = {
  d: [circ(...g(2, 12), 1.5), pl([2, 10], [2, 8]), pl([3, 6], [5, 4]), pl([7, 3], [10, 3]), pl([8, 1], [10, 3], [8, 5]), pl([12, 2], [14, 4]), pl([14, 2], [12, 4])],
};
// Pivot: the line up to the pin, then at 45° down to its arrowhead.
{
  const d = [pl([3, 14], [3, 7]), circ(...g(3, 5), 1.5), pl([4, 6], [11, 13]), pl([7, 13], [11, 13], [11, 9])];
  icons.pivot.small = { d, fill: { solid: [d[1]], wire: [d[0], d[2], d[3]] } };
}
for (const icon of Object.values(icons)) if (icon.small) icon.small = crisp(icon.small);

// Drawn after the snap: their windows and centers are single pixels (the snap makes a dot 2 × 2)
// Target under a badge: two rings a pixel apart and the one-pixel center, with the pixel badge.
for (const name of ['target-plus', 'target-alert']) {
  const d = [circ(...g(6, 6), 6), circ(...g(6, 6), 3), dot(...g(6, 6), 0.1)];
  icons[name].small = { d, fill: { solid: [d[0]], cut: [d[1], d[2]] }, badge: badge(icons[name].badge.kind, { size: 16 }) };
}
// Flywheel: the rim and its hub (the spokes clog at this size) and the arc arrow around it.
{
  const c = g(5, 10);
  const a = arc(...c, 9, -105, -5);
  const d = [circ(...c, 4.5), dot(...c, 0.1), a.d, head(a.end, a.tangent, 2.5)];
  icons.flywheel.small = { d, fill: { solid: [d[0]], cut: [d[1]], lines: [d[2], d[3]] } };
}
// Partnership: two pixel buildings, each with its window and its one-pixel door, under the double
// arrow.
{
  const b = (c) => [poly([c, 6], [c + 4, 6], [c + 4, 14], [c, 14]), dot(...g(c + 2, 8), 0.1), pl([c + 2, 12], [c + 2, 14])];
  const [L, R] = [b(1), b(9)];
  const arrows = [pl([3, 3], [11, 3]), pl([5, 1], [3, 3], [5, 5]), pl([9, 1], [11, 3], [9, 5])];
  icons.partnership.small = { d: [...L, ...R, ...arrows], fill: { solid: [L[0], R[0]], cut: [L[1], L[2], R[1], R[2]], wire: arrows } };
}
// Headquarters: a shorter pixel tower (two rows of windows and the door) and the pennant on its pole.
{
  const body = poly([3, 5], [11, 5], [11, 14], [3, 14]);
  const windows = [g(5, 7), g(9, 7), g(5, 10), g(9, 10)].map((c) => dot(...c, 0.1));
  const door = pl([6, 14], [6, 12], [8, 12], [8, 14]);
  const pole = pl([7, 5], [7, 0]);
  const pennant = pl([7, 0], [10, 1], [7, 2]);
  icons.headquarters.small = { d: [body, ...windows, door, pole, pennant], fill: { solid: [body, `${pennant}Z`], cut: [...windows, door], wire: [pole] } };
}
// Branches: the pixel tower on the left, joined at two heights to the two small offices.
{
  const body = poly([1, 1], [7, 1], [7, 14], [1, 14]);
  const windows = [g(3, 4), g(5, 4), g(3, 7), g(5, 7)].map((c) => dot(...c, 0.1));
  const door = pl([4, 14], [4, 11]);
  const links = [pl([7, 4], [9, 4]), pl([7, 11], [9, 11])];
  const branches = [poly([9, 2], [13, 2], [13, 6], [9, 6]), poly([9, 9], [13, 9], [13, 13], [9, 13])];
  icons['office-branches'].small = { d: [body, ...windows, door, ...links, ...branches], fill: { solid: [body, ...branches], cut: [...windows, door], wire: links } };
}
// Cascade: the large target (a ring of 3 pixels and its center), its stem to the bar between the two
// teams' rings of 2.
{
  const d = [circ(...g(7, 4), 4.5), dot(...g(7, 4), 0.1), pl([7, 7], [7, 12]), pl([5, 12], [9, 12]), circ(...g(3, 12), 3), circ(...g(11, 12), 3)];
  icons['target-cascade'].small = { d, fill: { solid: [d[0], d[4], d[5]], cut: [d[1]], wire: [d[2], d[3]] } };
}


export default { category: 'negocios', label: 'Negocios y gestión', icons };
