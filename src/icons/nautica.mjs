// Sea and river travel: boats by kind, ships, gear on board, safety, ports, navigation marks, the
// sea's state, knots. Everything is computed with the engine (engine/geometry.mjs) and the rules in
// DESIGN.md: a 1.5 stroke, keylines, continuous corners and a square bottom-right corner on
// containers. The category adopts lugares's `ship`, `sailboat` and `anchor` (drawn there, never
// redrawn here): ship-* and anchor-* stand on lugares's drawings themselves.
// Every boat seen from the side faces right and is built on one hull (`hull`): a deck line, a raked
// bow and a near-upright transom, rounded where they meet; what stands on the deck touches it. Boats
// seen from above (rowboat, marina, berth, ship-top) share `topBoat`, and the kayak lies across the
// canvas with its paddle. The water is lugares's wave (`ripple`: amplitude 1, half period 3), and a
// hull floating on it keeps 3 of clearance above its crests (at 16 px the water is redrawn:
// `small16`). A piece in front of another (a hull before its paddle, a paddle over a kayak, the sea
// over a wreck, a rope crossing itself) is a custom badge and the engine clears what it hides; the
// knot is one rope, one stroke wide.
import { arc, badge, circ, dot, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
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
/** Points along a path (after `transform` makes it absolute): lines, cubics, quadratics and arcs. */
function samples(d) {
  const out = [];
  const nums = (t) => (t.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  let cur = [0, 0];
  let start = [0, 0];
  for (const [, c, a] of transform(d, 1, 0, 0).matchAll(/([MLHVCQAZ])([^MLHVCQAZ]*)/g)) {
    const v = nums(a);
    if (c === 'M') [cur, start] = [[v[0], v[1]], [v[0], v[1]]];
    else if (c === 'L' || c === 'H' || c === 'V' || c === 'Z') {
      const to = c === 'L' ? [v[0], v[1]] : c === 'H' ? [v[0], cur[1]] : c === 'V' ? [cur[0], v[0]] : start;
      for (let k = 1; k <= 20; k++) out.push(lerp(cur, to, k / 20));
      cur = to;
    } else if (c === 'C' || c === 'Q') {
      const P = c === 'C' ? [cur, [v[0], v[1]], [v[2], v[3]], [v[4], v[5]]] : [cur, [v[0], v[1]], [v[2], v[3]]];
      for (let k = 1; k <= 30; k++) {
        let q = P;
        while (q.length > 1) q = q.slice(1).map((p, i) => lerp(q[i], p, k / 30));
        out.push(q[0]);
      }
      cur = P[P.length - 1];
    } else if (c === 'A') {
      // A circular arc: its center from the two ends, the radius and the flags
      const [r, , , large, sweep, x, y] = v;
      const to = [x, y];
      const m = lerp(cur, to, 0.5);
      const h = len(sub(to, cur)) / 2;
      const k = Math.sqrt(Math.max(0, r * r - h * h));
      const n = unit([cur[1] - to[1], to[0] - cur[0]]);
      const c0 = add(m, mul(n, large === sweep ? -k : k));
      let [a0, a1] = [Math.atan2(cur[1] - c0[1], cur[0] - c0[0]), Math.atan2(y - c0[1], x - c0[0])];
      if (sweep && a1 < a0) a1 += 2 * Math.PI;
      if (!sweep && a1 > a0) a1 -= 2 * Math.PI;
      for (let j = 1; j <= 30; j++) out.push(add(c0, mul([Math.cos(a0 + ((a1 - a0) * j) / 30), Math.sin(a0 + ((a1 - a0) * j) / 30)], Math.max(r, h))));
      cur = to;
    }
  }
  return out;
}
/** Exactly half the chord as written: a half circle that never bulges (DESIGN.md › Circles). */
const half = (a, b) => N(Math.round((Math.hypot(Number(N(b[0])) - Number(N(a[0])), Number(N(b[1])) - Number(N(a[1]))) / 2) * 1000) / 1000);

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

/** Closes every open subpath, for `fill.solid` (only closed shapes go there). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w, y + r])}V${N(y + h - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${N(x + w - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w - r, y + h])}H${N(x + r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** A rod between two points (the centers of its round ends), `r` its half width: blades, tubes. */
/** A blade on the end of a shaft: its round end's apex sits on the shaft's end, `end` its far tip. */
const blade = (from, end, r) => rod(add(from, mul(unit(sub(end, from)), r)), sub(end, mul(unit(sub(end, from)), r)), r);
function rod(p0, p1, r) {
  const u = unit(sub(p1, p0));
  const n = [-u[1] * r, u[0] * r];
  const [a, b, c, d] = [add(p0, n), add(p1, n), sub(p1, n), sub(p0, n)];
  return `M${pt(a)}L${pt(b)}A${half(b, c)} ${half(b, c)} 0 0 0 ${pt(c)}L${pt(d)}A${half(d, a)} ${half(d, a)} 0 0 0 ${pt(a)}Z`;
}

/** A boat from above, bow up: a pointed bow and a square transom (marina, berth, ship-top). */
const topBoat = (cx, top, bot, hw) => {
  const L = bot - top;
  return `M${pt([cx, top])}C${pt([cx + hw * 1.05, top + L * 0.22])} ${pt([cx + hw, top + L * 0.5])} ${pt([cx + hw, bot])}H${N(cx - hw)}C${pt([cx - hw, top + L * 0.5])} ${pt([cx - hw * 1.05, top + L * 0.22])} ${pt([cx, top])}Z`;
};
/** The area a polyline clears when it goes on top: out along it and back (no area of its own). */
const trace = (...pts) => `${line(...pts, ...pts.slice(0, -1).reverse())}Z`;

// ── Water ─────────────────────────────────────────────────────────────────────────────────────
// Lugares's wave: half periods of `h` whose crests rise `a` (cubics whose peak is exactly `a`).
// Every wave is remembered, so its 16 px drawing can redraw it (`small16`).
const WAVES = new Map();
function ripple(y, x0 = 3, n = 6, h = 3, a = 1) {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (s * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (s * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  WAVES.set(d, [y, x0, n]);
  return d;
}
/** The wave's height at `x` (the cubic is linear in x, so this is exact). */
function rippleY(y, x0, x, h = 3, a = 1) {
  const i = Math.floor((x - x0) / h);
  const t = (x - x0) / h - i;
  return y + (i % 2 ? 1 : -1) * 4 * a * t * (1 - t);
}
/** The sea under a floating hull: its crests 3 below the keel. */
const SEA = 21;
const sea = (x0 = 3, n = 6) => ripple(SEA, x0, n);

// ── The hull (side view, bow to the right) ────────────────────────────────────────────────────
/**
 * One hull for every boat: the deck from the transom (`x0`) to the bow (`x1`, raised `lift` above
 * the deck at the stern), a bow raked back `rake` to the keel and a transom raked `stern`. `r`: the
 * radii at the stern's top, the bow, the forefoot and the stern's foot.
 */
function hull({ x0 = 2.75, x1 = 21.25, top = 13.25, bot = 19.25, rake = 4, stern = 0.75, lift = 0, r = [0.75, 0.75, 2.5, 1.25] } = {}) {
  const d = roundpoly([[x0, top], [x1, top - lift], [x1 - rake, bot], [x0 + stern, bot]], r);
  return { d, deck: (x) => top - (lift * (x - x0)) / (x1 - x0), x0, x1, top, bot };
}
/** A deckhouse standing on the deck between x0 and x1: its back upright, its front raked `rake`. */
const house = (H, x0, x1, y, rake = 0, r = 1) => roundline([[x0, H.deck(x0)], [x0, y], [x1 - rake, y], [x1, H.deck(x1)]], [0, r, r, 0]);

// ── Rope (the knots) ─────────────────────────────────────────────────────────────────────────
// One rope, one stroke wide: a smooth curve through its points (uniform Catmull-Rom, written as
// cubics). Where it crosses itself, the strand on top alternates along the rope (over, under, over…)
// and goes in as a custom piece: a short stretch of it is the area the engine clears (so the strand
// below breaks 1.5 clear of it) and a longer one is drawn on top, covering what that clearance
// takes from the strand itself. Crossings stand 7 or more apart along the rope.
function rope(P, flip = false) {
  const segs = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? sub(mul(P[i], 2), P[i + 1]);
    const [p1, p2] = [P[i], P[i + 1]];
    const p3 = P[i + 2] ?? sub(mul(P[i + 1], 2), P[i]);
    segs.push([p1, add(p1, mul(sub(p2, p0), 1 / 6)), sub(p2, mul(sub(p3, p1), 1 / 6)), p2]);
  }
  const bez = ([a, b, c, d], t) => {
    const m = 1 - t;
    return [0, 1].map((k) => m * m * m * a[k] + 3 * m * m * t * b[k] + 3 * m * t * t * c[k] + t * t * t * d[k]);
  };
  // The part of a cubic between t0 and t1 (de Casteljau)
  const cut = (seg, t0, t1) => {
    const split = ([a, b, c, d], t) => {
      const [ab, bc, cd] = [lerp(a, b, t), lerp(b, c, t), lerp(c, d, t)];
      const [abc, bcd] = [lerp(ab, bc, t), lerp(bc, cd, t)];
      const m = lerp(abc, bcd, t);
      return [[a, ab, abc, m], [m, bcd, cd, d]];
    };
    const right = split(seg, t0)[1];
    return split(right, t0 < 1 ? (t1 - t0) / (1 - t0) : 0)[0];
  };
  const draw = (cs) => `M${pt(cs[0][0])}${cs.map(([, b, c, d]) => `C${pt(b)} ${pt(c)} ${pt(d)}`).join('')}`;
  // Arc length along u (u = segment index + t)
  const K = 60;
  const table = [];
  let acc = 0;
  let prev = segs[0][0];
  for (let i = 0; i < segs.length; i++)
    for (let k = i ? 1 : 0; k <= K; k++) {
      const q = bez(segs[i], k / K);
      acc += len(sub(q, prev));
      prev = q;
      table.push({ u: i + k / K, s: acc, q });
    }
  const total = acc;
  const uAt = (sv) => {
    const x = Math.max(0, Math.min(total, sv));
    let j = table.findIndex((r) => r.s >= x);
    if (j <= 0) j = 1;
    const [a, b] = [table[j - 1], table[j]];
    return a.u + ((b.u - a.u) * (x - a.s)) / (b.s - a.s || 1);
  };
  const piece = (u0, u1) => {
    const out = [];
    for (let i = Math.floor(u0); i < Math.min(segs.length, Math.ceil(u1)); i++) {
      const [t0, t1] = [Math.max(0, u0 - i), Math.min(1, u1 - i)];
      if (t1 > t0) out.push(cut(segs[i], t0, t1));
    }
    return draw(out);
  };
  // Crossings: pairs of polyline steps that intersect, far apart along the rope
  const hits = [];
  for (let i = 0; i < table.length - 1; i++)
    for (let j = i + 8; j < table.length - 1; j++) {
      const [a, b, c, d] = [table[i].q, table[i + 1].q, table[j].q, table[j + 1].q];
      const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
      if (!den) continue;
      const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
      const v = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
      if (t >= 0 && t < 1 && v >= 0 && v < 1) hits.push([table[i].s + t * (table[i + 1].s - table[i].s), table[j].s + v * (table[j + 1].s - table[j].s)]);
    }
  // Along the rope, the passes alternate over and under; each crossing takes one of each (when a
  // curl breaks the alternation, its first pass goes over). `flip` swaps every crossing.
  const order = hits.flatMap(([a, b]) => [a, b]).sort((x, y) => x - y);
  const even = (sv) => order.indexOf(sv) % 2 === 0;
  const over = hits.map(([a, b]) => ((even(a) || !even(b)) !== flip ? a : b));
  const d = draw(segs);
  const top = over.map((sv) => piece(uAt(sv - 3.25), uAt(sv + 3.25)));
  const knock = over.map((sv) => `${piece(uAt(sv - 0.5), uAt(sv + 0.5))}Z`).join('');
  return { d, badge: over.length ? { d: top, knock } : undefined, crossings: hits.length };
}

// ── Lugares's drawings ───────────────────────────────────────────────────────────────────────
const L = lugares.icons;
const SHIP = L.ship.d;
const ANCHOR = L.anchor.d;

const icons = {};
const put = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill by index into `d` (or as a path): solid, cut, lines, wire. */
const FILL = {};
const PARTS = {};
const MOTION = {};
/** 16 px: paths replaced by index (already in place, on pixel centers), see `small16`. */
const EDIT16 = {};

// ── Boats ─────────────────────────────────────────────────────────────────────────────────────
// The motorboat: a low planing hull whose deck rises to the bow, and one cabin on it, its back
// upright under a flat canopy and its windshield raked down to the deck. The base of boat-*.
const BOAT_HULL = hull({ top: 14, bot: 18.5, rake: 5, lift: 1.25 });
const BOAT = [BOAT_HULL.d, house(BOAT_HULL, 6.5, 14.75, 9.75, 3.5)];
put('boat', ['lancha', 'bote', 'renta de lanchas', 'paseo en lancha', 'motorboat', 'boat', 'speedboat'], BOAT);
FILL.boat = { solid: [0, `${BOAT[1]}Z`] };
PARTS.boat = { hull: [0], cabin: [1] };

{
  // Rowboat, from above: an open hull, bow up, its seat across it, and the two oars out from the
  // gunwales, swept back to their blades (they rest on the gunwales: they touch the hull)
  const hullD = 'M12 2.75C14.25 3.25 15.25 7 15.25 11.5C15.25 15.25 15 18.5 14.5 21.25H9.5C9 18.5 8.75 15.25 8.75 11.5C8.75 7 9.75 3.25 12 2.75Z';
  const yo = 11.25;
  const side = samples(hullD).filter((q) => q[0] > 12).sort((p, q) => Math.abs(p[1] - yo) - Math.abs(q[1] - yo))[0];
  const g = [side[0], yo];
  const seat = line([24 - g[0], yo], g);
  const tip = [21.25, 15.25];
  const oar = (k) => {
    const T = (p) => (k > 0 ? p : [24 - p[0], p[1]]);
    const neck = sub(tip, mul(unit(sub(tip, g)), 3.6));
    return [line(T(g), T(neck)), blade(T(neck), T(tip), 1.4)];
  };
  const [R, Lf] = [oar(1), oar(-1)];
  put('rowboat', ['bote de remos', 'remar', 'lago', 'renta de botes', 'rowboat', 'rowing', 'dinghy'], [hullD, seat, Lf[0], Lf[1], R[0], R[1]]);
  FILL.rowboat = { solid: [0, 3, 5], cut: [line([26 - g[0], yo], [g[0] - 2, yo])], wire: [2, 4] };
  PARTS.rowboat = { hull: [0, 1], oars: [2, 3, 4, 5] };
}
{
  // Kayak, from above: a long hull pointed at both ends, lying across the canvas, its cockpit a slot
  // behind the middle, and the double-bladed paddle held across it in front of the cockpit (on top:
  // the engine clears the hull under it)
  const c = [12, 12];
  const ax = unit([1, -1]);
  const nx = [-ax[1], ax[0]];
  const P = (s, t) => add(c, add(mul(ax, s), mul(nx, t)));
  const [Lh, hw] = [12.25, 3.75];
  const k = (4 / 3) * hw;
  const hullD = `M${pt(P(-Lh, 0))}C${pt(P(-Lh * 0.45, -k))} ${pt(P(Lh * 0.45, -k))} ${pt(P(Lh, 0))}C${pt(P(Lh * 0.45, k))} ${pt(P(-Lh * 0.45, k))} ${pt(P(-Lh, 0))}Z`;
  const cockpit = line(P(-5.25, 0), P(-1.25, 0));
  const s0 = 2.5;
  const [a, b] = [P(s0, -11), P(s0, 11)];
  const [n0, n1] = [P(s0, -6.75), P(s0, 6.75)];
  const paddle = [line(n0, n1), blade(n0, a, 1.3), blade(n1, b, 1.3)];
  put('kayak', ['kayak', 'remo doble', 'mar', 'renta de kayaks', 'kayak', 'kayaking', 'paddle'], [hullD, cockpit], {
    badge: { d: paddle, knock: `${trace(n0, n1)}${paddle[1]}${paddle[2]}`, fill: { solid: [paddle[1], paddle[2]], wire: [paddle[0]] } },
  });
  FILL.kayak = { solid: [0], cut: [1] };
  PARTS.kayak = { hull: [0, 1] };
}
{
  // Motor yacht: a long sleek hull and two decks stepping up toward the stern, their fronts raked
  const H = hull({ top: 14, bot: 18.75, rake: 5.5, lift: 0.75 });
  const lower = house(H, 4.25, 18.25, 10.75, 3.75);
  const upper = roundline([[6.5, 10.75], [6.5, 7.5], [11, 7.5], [14, 10.75]], [0, 1, 1, 0]);
  put('yacht', ['yate', 'lujo', 'charter', 'superyate', 'yacht', 'motor yacht', 'luxury'], [H.d, lower, upper]);
  FILL.yacht = { solid: [0, shut(lower), shut(upper)] };
  PARTS.yacht = { hull: [0], decks: [1, 2] };
}
{
  // Catamaran, head-on: two round hulls hanging under one deck beam, and the mast standing on its
  // middle through a triangular sail (seen head-on, the main and the jib either side of it)
  const beam = 13.5;
  const pod = (x) => `M${N(x)} ${N(beam)}V17A3.25 3.25 0 0 0 ${N(x + 6.5)} 17V${N(beam)}`;
  const sail = roundpoly([[12, 2.75], [17.75, 10.5], [6.25, 10.5]], [0.6, 0.75, 0.75]);
  put('catamaran', ['catamarán', 'velero', 'charter', 'multicasco', 'catamaran', 'sailing', 'multihull'], [line([2.75, beam], [21.25, beam]), pod(2.75), pod(14.75), sail, line([12, 2.75], [12, beam])]);
  FILL.catamaran = { solid: [shut(pod(2.75)), shut(pod(14.75)), 3], wire: [0, line([12, 10.5], [12, beam])], cut: [line([12, 4.5], [12, 10.5])] };
  PARTS.catamaran = { deck: [0], hulls: [1, 2], sail: [3], mast: [4] };
}
{
  // Jet ski: a short hull whose deck rises to a pointed bow, a long saddle on it, the steering
  // column rising in front of the saddle to its handlebar, afloat on the sea
  const H = hull({ x0: 3.25, x1: 21.25, top: 14.25, bot: 17.75, rake: 4, stern: 0.5, lift: 1, r: [0.75, 0.75, 2, 1] });
  const seat = roundline([[5.25, H.deck(5.25)], [5.25, 11.75], [12.25, 11.75], [12.25, H.deck(12.25)]], [0, 1.5, 1.5, 0]);
  const bars = roundline([[17.5, H.deck(17.5)], [16, 7.25], [13.5, 7.25]], [0, 0.75, 0]);
  put('jet-ski', ['moto acuática', 'jet ski', 'deportes acuáticos', 'playa', 'jet ski', 'personal watercraft', 'water sports'], [H.d, seat, bars, sea()]);
  FILL['jet-ski'] = { solid: [0, shut(seat)], wire: [2], lines: [3] };
  PARTS['jet-ski'] = { hull: [0, 1, 2], water: [3] };
}
{
  // Houseboat: a small gabled house with its door, on a flat hull floating on the water
  const H = hull({ top: 13.75, bot: 17, rake: 2, stern: 1.25, r: [0.75, 0.75, 1, 1] });
  const home = roundline([[6, 13.75], [6, 8.5], [12, 3.75], [18, 8.5], [18, 13.75]], [0, 0.75, 1, 0.75, 0]);
  const door = roundline([[10.5, 13.75], [10.5, 10.25], [13.5, 10.25], [13.5, 13.75]], [0, 1, 1, 0]);
  put('houseboat', ['casa flotante', 'casa bote', 'canal', 'hospedaje', 'houseboat', 'floating home', 'canal boat'], [H.d, home, door, sea()]);
  FILL.houseboat = { solid: [0, shut(home)], cut: [2], lines: [3] };
  PARTS.houseboat = { hull: [0], house: [1, 2], water: [3] };
}
{
  // Fishing boat: a wheelhouse at the bow end, and a tall boom angled back over the stern with
  // its line hanging into the water
  const H = hull({ x0: 7.25, top: 13, bot: 17, rake: 3.5, r: [0.75, 0.75, 2, 1] });
  const wheelhouse = house(H, 14, 18.75, 8.5, 0, 1);
  const tipB = [4.25, 3.5];
  const boom = line([12, 13], tipB);
  const water = sea();
  const hang = line(tipB, [4.25, rippleY(SEA, 3, 4.25)]);
  put('fishing-boat', ['barco pesquero', 'pesca', 'arrastrero', 'flota pesquera', 'fishing boat', 'trawler', 'fishing'], [H.d, wheelhouse, boom, hang, water]);
  FILL['fishing-boat'] = { solid: [0, shut(wheelhouse)], wire: [2, 3], lines: [4] };
  PARTS['fishing-boat'] = { hull: [0], wheelhouse: [1], boom: [2, 3], water: [4] };
}
{
  // Cruise ship: a long hull, three decks stepping back from the bow, and one wide funnel near
  // the stern
  const H = hull({ top: 13.75, bot: 19.5, rake: 4.5 });
  const decks = roundline([[4.25, 13.75], [4.25, 6], [10.75, 6], [10.75, 8.75], [14.25, 8.75], [14.25, 11.25], [17.75, 11.25], [17.75, 13.75]], [0, 0.75, 0.75, 0.5, 0.75, 0.5, 0.75, 0]);
  const funnel = roundline([[5.75, 6], [6.25, 2.75], [9.75, 2.75], [9.5, 6]], [0, 0.6, 0.6, 0]);
  put('cruise-ship', ['crucero', 'naviera', 'vacaciones', 'escala', 'cruise ship', 'cruise', 'ocean liner'], [H.d, decks, funnel]);
  FILL['cruise-ship'] = { solid: [0, shut(decks), shut(funnel)] };
  PARTS['cruise-ship'] = { hull: [0], decks: [1], funnel: [2] };
}
{
  // Ferry: a boxy hull with a long passenger cabin and its bridge on top, and the vehicle ramp
  // lowered from the bow toward the water
  const H = hull({ x0: 2.75, x1: 17.75, top: 13.5, bot: 17.5, rake: 1.25, stern: 0.75, r: [0.75, 0.6, 1, 1] });
  const cabin = house(H, 4.25, 15.75, 9.5, 0, 1.25);
  const bridge = roundline([[7.25, 9.5], [7.25, 6.25], [12.25, 6.25], [12.25, 9.5]], [0, 1, 1, 0]);
  const ramp = line(lerp([17.75, 13.5], [16.5, 17.5], 0.3), [21.25, 17.75]);
  put('ferry', ['ferry', 'transbordador', 'cruce', 'autos', 'ferry', 'car ferry', 'crossing'], [H.d, cabin, bridge, ramp, sea()]);
  FILL.ferry = { solid: [0, shut(cabin), shut(bridge)], wire: [3], lines: [4] };
  PARTS.ferry = { hull: [0], cabin: [1, 2], ramp: [3], water: [4] };
}
{
  // Container ship: a long low hull, two tiers of containers on the deck (their seams offset tier by
  // tier; filled, the stack is one stepped block) and the bridge tower at the stern
  const H = hull({ top: 14, bot: 19.25, rake: 4.5 });
  const bridge = house(H, 4.25, 7.25, 4.75, 0, 0.75);
  const stack = roundline([[10.25, 14], [10.25, 8], [16, 8], [16, 11], [20.25, 11], [20.25, 14]], [0, 0.6, 0.6, 0.4, 0.6, 0]);
  const tier = line([10.25, 11], [16, 11]);
  const cols = [line([13.1, 8], [13.1, 11]), line([16, 11], [16, 14])];
  put('cargo-ship', ['buque de carga', 'portacontenedores', 'naviera', 'flete marítimo', 'container ship', 'cargo ship', 'freighter'], [H.d, bridge, stack, tier, ...cols]);
  FILL['cargo-ship'] = { solid: [0, shut(bridge), shut(stack)] };
  PARTS['cargo-ship'] = { hull: [0], bridge: [1], containers: [2, 3, 4, 5] };
}
{
  // Tugboat: a short hull whose deck sweeps up to a high bow, and a stepped deckhouse with the tall
  // wheelhouse on its front end, over the low towing deck aft
  const H = hull({ x0: 2.75, x1: 21.25, top: 15.75, bot: 20, rake: 3.25, stern: 0.75, lift: 3, r: [0.75, 1, 2, 1.25] });
  const house = roundline([[6, H.deck(6)], [6, 11.25], [10.25, 11.25], [10.25, 4.75], [15.75, 4.75], [15.75, H.deck(15.75)]], [0, 0.75, 0.5, 1, 1, 0]);
  put('tugboat', ['remolcador', 'remolque', 'puerto', 'servicios portuarios', 'tugboat', 'tug', 'towing'], [H.d, house]);
  FILL.tugboat = { solid: [0, shut(house)] };
  PARTS.tugboat = { hull: [0], cabin: [1] };
}
{
  // Water taxi: the motorboat with a taxi sign on its canopy
  const sign = roundline([[6.75, 9.75], [6.75, 7], [11.25, 7], [11.25, 9.75]], [0, 0.75, 0.75, 0]);
  put('water-taxi', ['taxi acuático', 'vaporetto', 'traslado', 'canal', 'water taxi', 'water bus', 'boat ride'], [...BOAT, sign]);
  FILL['water-taxi'] = { solid: [0, `${BOAT[1]}Z`, shut(sign)] };
  PARTS['water-taxi'] = { hull: [0], cabin: [1], sign: [2] };
}
{
  // Lifeboat: a stubby hull fully closed by a long rounded canopy, its band of windows along its side,
  // afloat
  const H = hull({ x0: 3, x1: 21, top: 13.75, bot: 17, rake: 3, stern: 1, r: [0.75, 0.75, 1.5, 1.25] });
  const canopy = roundline([[4.75, 13.75], [5.5, 7.5], [18.5, 7.5], [19.25, 13.75]], [0, 3, 3, 0]);
  const band = line([8.25, 10.6], [15.75, 10.6]);
  put('lifeboat', ['bote salvavidas', 'evacuación', 'rescate', 'seguridad a bordo', 'lifeboat', 'rescue boat', 'abandon ship'], [H.d, canopy, band, sea()]);
  FILL.lifeboat = { solid: [0, shut(canopy)], cut: [2], lines: [3] };
  PARTS.lifeboat = { hull: [0], canopy: [1, 2], water: [3] };
}
{
  // Tall ship: a hull and two masts, each carrying its square sails stacked in one tall shape, the
  // yard between them across it; both sails belly forward, toward the bow
  const H = hull({ x0: 3.25, x1: 20.75, top: 17.5, bot: 20.75, rake: 3, stern: 0.75, lift: 0.5, r: [0.75, 0.75, 1.5, 1.25] });
  const [t, b, belly] = [4.5, 14.25, 1.5];
  const m = (t + b) / 2;
  const sails = (c, w) => `M${pt([c - w, t])}H${N(c + w)}Q${pt([c + w + 2 * belly, (t + b) / 2])} ${pt([c + w, b])}H${N(c - w)}Q${pt([c - w + 2 * belly, (t + b) / 2])} ${pt([c - w, t])}Z`;
  const [c1, c2, w] = [6.75, 15.25, 2.35];
  const yard = (c) => line([c - w + belly - 1, m], [c + w + belly + 1, m]);
  const mast = (c) => line([c, b], [c, H.deck(c)]);
  const across = (c) => line([c - w + belly, m], [c + w + belly, m]);
  const d = [H.d, sails(c1, w), sails(c2, w), across(c1), across(c2), mast(c1), mast(c2)];
  put('tall-ship', ['velero histórico', 'bergantín', 'barco de vela', 'aventura', 'tall ship', 'sailing ship', 'brig'], d);
  FILL['tall-ship'] = { solid: [0, 1, 2], cut: [yard(c1), yard(c2)], wire: [5, 6] };
  PARTS['tall-ship'] = { hull: [0], sails: [1, 2, 3, 4], masts: [5, 6] };
}
{
  // Submarine: a capsule hull under the waterline, its conning tower on top and a small propeller at
  // the tail
  const body = capsule(5.5, 12, 15.75, 6);
  const tower = roundline([[10.75, 12], [11.25, 8.75], [14.75, 8.75], [15.5, 12]], [0, 0.75, 0.75, 0]);
  put('submarine', ['submarino', 'submarino turístico', 'profundidad', 'naval', 'submarine', 'underwater', 'deep sea'], [body, tower, line([5.5, 15], [2.75, 15]), line([2.75, 12.5], [2.75, 17.5]), ripple(4.75)]);
  FILL.submarine = { solid: [0, shut(tower)], wire: [2, 3], lines: [4] };
  PARTS.submarine = { hull: [0, 1], propeller: [2, 3], water: [4] };
}
{
  // Shipwreck: lugares's ship tilted steeply, bow up, half sunk: the sea goes on top as a custom
  // piece and clears everything under its surface
  const tilt = (d) => transform(turnPath(d, -28, [12, 12]), 1.05, 0.25, -0.75);
  const ship = SHIP.map(tilt);
  const surface = ripple(15.75);
  const below = ripple(19.75, 6, 4);
  const sea0 = `${surface}V22H3Z`;
  put('shipwreck', ['naufragio', 'barco hundido', 'buceo', 'fracaso', 'shipwreck', 'sunken ship', 'wreck'], ship, {
    badge: { d: [surface, below], knock: sea0 },
  });
  FILL.shipwreck = { solid: ship.map(shut) };
  PARTS.shipwreck = { ship: [0, 1, 2] };
}
{
  // Captain's hat, head-on: a wide crown whose top is a shallow arc, its band and the glossy visor
  // below, a round badge on the crown
  const crown = `${roundline([[17.25, 16.25], [17.25, 12.5], [21, 8.5]], [0, 0.6, 0])}A9 4 0 0 0 3 8.5${roundline([[3, 8.5], [6.75, 12.5], [6.75, 16.25]], [0, 0.6, 0]).replace(/^M[^L]+/, '')}Z`;
  const band = line([6.75, 12.5], [17.25, 12.5]);
  const visor = 'M6.75 16.25C8 19.5 16 19.5 17.25 16.25';
  put('captain-hat', ['gorra de capitán', 'patrón', 'con capitán', 'tripulación', 'captain hat', 'skipper', 'crew'], [crown, band, visor, dot(12, 8.25)]);
  FILL['captain-hat'] = { solid: [0, shut(visor)], cut: [line([5.75, 12.5], [18.25, 12.5]), 3] };
  PARTS['captain-hat'] = { crown: [0, 1, 3], visor: [2] };
}
{
  // Ship's wheel: the rim, the hub, and eight spokes that run out past the rim into handles
  const spokes = Array.from({ length: 8 }, (_, i) => line(polar(12, 12, 2, i * 45 - 90), polar(12, 12, 9.25, i * 45 - 90)));
  put('ship-wheel', ['timón', 'rueda de timón', 'navegar', 'capitán', 'ship wheel', 'helm', 'steering'], [circ(12, 12, 6.25), circ(12, 12, 2), ...spokes]);
  FILL['ship-wheel'] = { solid: [1], wire: [0, ...spokes.map((_, i) => i + 2)] };
  PARTS['ship-wheel'] = { wheel: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
  MOTION['ship-wheel'] = { effect: 'spin', origin: [12, 12] };
}
{
  // Boat propeller, head-on: three broad skewed blades around the hub
  const c = [12, 12];
  const blade = (a) => roundline([polar(...c, 2.25, a - 22), polar(...c, 8.25, a - 34), polar(...c, 9, a - 4), polar(...c, 7.5, a + 26), polar(...c, 2.25, a + 22)], [0, 2.5, 2.75, 2.25, 0]);
  const blades = [-90, 30, 150].map(blade);
  put('boat-propeller', ['hélice', 'hélice de barco', 'propulsión', 'motor', 'boat propeller', 'marine propeller', 'screw'], [circ(...c, 2.25), ...blades]);
  FILL['boat-propeller'] = { solid: [0, ...blades.map(shut)] };
  PARTS['boat-propeller'] = { hub: [0], blades: [1, 2, 3] };
  MOTION['boat-propeller'] = { effect: 'spin', origin: c };
}
{
  // Sail: a mainsail on its mast, its leech curving from the masthead out to the end of the boom
  const [x, top, foot] = [7.5, 2.75, 16.5];
  const leech = `M${N(x)} ${N(top)}Q17.5 8 18.5 ${N(foot)}`;
  put('sail', ['vela', 'navegar', 'zarpar', 'clases de vela', 'sail', 'sailing', 'set sail'], [line([x, top], [x, 20.5]), leech, line([x, foot], [20.25, foot])]);
  FILL.sail = { solid: [`${leech}H${N(x)}Z`], wire: [0, 2] };
  PARTS.sail = { mast: [0], sail: [1], boom: [2] };
  MOTION.sail = { effect: 'wiggle', parts: ['sail', 'boom'], origin: [x, foot] };
}
{
  // Porthole: the thick frame (the rim and the glass 3.25 inside it), four bolts on the rim and a
  // glint across the glass
  const bolts = [45, 135, 225, 315].map((a) => dot(...polar(12, 12, 9, a)));
  put('porthole', ['ojo de buey', 'escotilla', 'camarote', 'vista al mar', 'porthole', 'cabin window', 'ocean view'], [circ(12, 12, 9), circ(12, 12, 5.75), arc(12, 12, 2.75, 195, 255).d, ...bolts]);
  FILL.porthole = { solid: [0, ...bolts.map((_, i) => i + 3)], cut: [1, 2] };
  PARTS.porthole = { frame: [0, 3, 4, 5, 6], glass: [1, 2] };
}
{
  // Spyglass: one tube widening from the eyepiece to the lens, rising to the right, the joints of
  // its three sections two bands across it
  const ang = -32;
  const c = [12, 12.25];
  const P = (s, t) => add(c, rot([s - 8.5, t], [0, 0], ang));
  const [len0, w0, w1] = [17, 1.75, 3.75];
  const half = (s) => w0 + ((w1 - w0) * s) / len0;
  const scope = roundpoly([P(0, -w0), P(len0, -w1), P(len0, w1), P(0, w0)], [1, 1.5, 1.5, 1]);
  const joint = (s, k = 0) => line(P(s, -half(s) - k), P(s, half(s) + k));
  put('spyglass', ['catalejo', 'telescopio', 'explorar', 'en el horizonte', 'spyglass', 'telescope', 'look out'], [scope, joint(5.5), joint(11)]);
  FILL.spyglass = { solid: [0], cut: [joint(5.5, 1.25), joint(11, 1.25)] };
  PARTS.spyglass = { scope: [0, 1, 2] };
}
{
  // Life jacket: a vest seen from the front (its V neck and armholes), the seam down its middle and
  // the strap buckled across it
  const vest = roundpoly([[6.5, 3], [9.5, 3], [12, 10.25], [14.5, 3], [17.5, 3], [19.75, 9.5], [19.75, 20.75], [4.25, 20.75], [4.25, 9.5]], [1, 0.75, 0.75, 0.75, 1, 2, 2, 2, 2]);
  const buckle = sq(10, 13.75, 4, 3.25, 1);
  const d = [vest, line([12, 8.7], [12, 13.75]), line([12, 17], [12, 20.75]), line([4.25, 15.375], [10, 15.375]), line([14, 15.375], [19.75, 15.375]), buckle];
  put('life-jacket', ['chaleco salvavidas', 'seguridad a bordo', 'equipo obligatorio', 'flotación', 'life jacket', 'life vest', 'safety'], d);
  FILL['life-jacket'] = { solid: [0], cut: [line([12, 9], [12, 13.75]), line([12, 17], [12, 22]), line([3, 15.375], [10, 15.375]), line([14, 15.375], [21, 15.375]), 5] };
  PARTS['life-jacket'] = { vest: [0, 1, 2], strap: [3, 4, 5] };
}
{
  // Man overboard: a head above the sea and both arms raised, calling for help (the sea on top, as
  // in shipwreck: it clears what is under its surface)
  const surface = ripple(14.25);
  put('man-overboard', ['hombre al agua', 'rescate', 'emergencia', 'alarma', 'man overboard', 'MOB', 'person in water'], [circ(12, 10.75, 2.75), line([7.25, 14.5], [4, 4]), line([16.75, 14.5], [20, 4])], {
    badge: { d: [surface, ripple(18.5)], knock: `${surface}V22H3Z` },
  });
  FILL['man-overboard'] = { solid: [0], wire: [1, 2] };
  PARTS['man-overboard'] = { person: [0, 1, 2] };
  MOTION['man-overboard'] = { effect: 'wiggle', parts: ['person'], origin: [12, 15] };
}
{
  // Diving mask: one wide lens with the nose pocket at its foot, and the snorkel rising from its
  // side
  const mask = roundpoly([[2.75, 7.75], [16.75, 7.75], [16.75, 16.25], [11.75, 16.25], [9.75, 13.75], [7.75, 16.25], [2.75, 16.25]], [3.25, 3.25, 3.25, 0.75, 1, 0.75, 3.25]);
  const snorkel = roundline([[16.75, 13.5], [20.25, 13.5], [20.25, 2.75]], [0, 1.5, 0]);
  put('scuba-mask', ['visor de buceo', 'snorkel', 'esnórquel', 'buceo', 'diving mask', 'snorkeling', 'scuba'], [mask, snorkel]);
  FILL['scuba-mask'] = { solid: [0], wire: [1] };
  PARTS['scuba-mask'] = { mask: [0], snorkel: [1] };
}
{
  // Swim fins, a pair from above, splayed: each blade fans out from its heel to a concave edge, the
  // foot pocket's edge across it
  const one = (k) => {
    const T = (d) => turnPath(transform(d, 1, k * 4.5, 0), k * 7, [12 + k * 4.5, 21]);
    const fin = 'M10.75 19.25L8.75 4.5Q12 6.25 15.25 4.5L13.25 19.25A1.25 1.25 0 0 1 10.75 19.25Z';
    const side = (y, s) => [12 + s * (1.25 + (2 * (19.25 - y)) / 14.75), y];
    return [T(fin), T(`M${pt(side(13.25, -1))}Q12 11 ${pt(side(13.25, 1))}`), T(`M${pt(side(13.25, -1.3))}Q12 11 ${pt(side(13.25, 1.3))}`)];
  };
  const [Lf, Rf] = [one(-1), one(1)];
  put('swim-fins', ['aletas', 'buceo', 'esnórquel', 'renta de equipo', 'swim fins', 'flippers', 'snorkel gear'], [Lf[0], Lf[1], Rf[0], Rf[1]]);
  FILL['swim-fins'] = { solid: [0, 2], cut: [Lf[2], Rf[2]] };
  PARTS['swim-fins'] = { fins: [0, 1, 2, 3] };
}
{
  // Pier: a flat deck resting on three posts that go down into the sea (the sea on top clears them
  // under its surface)
  const surface = ripple(15.75);
  put('pier', ['muelle', 'embarcadero', 'malecón', 'atracadero', 'pier', 'dock', 'jetty'], [line([2.75, 8.5], [21.25, 8.5]), line([5.5, 8.5], [5.5, 21]), line([12, 8.5], [12, 21]), line([18.5, 8.5], [18.5, 21])], {
    badge: { d: [surface, ripple(19.75)], knock: `${surface}V22H3Z` },
  });
  FILL.pier = false;
  PARTS.pier = { deck: [0], posts: [1, 2, 3] };
}

// ── Ports and berths (from above) ────────────────────────────────────────────────────────────
{
  // Marina, from above: the main walkway and three finger piers, a boat in each of two slips
  const fingers = [3, 12, 21].map((x) => line([x, 20.25], [x, 6.75]));
  const boats = [topBoat(7.5, 7.25, 16.5, 1.5), topBoat(16.5, 7.25, 16.5, 1.5)];
  put('marina', ['marina', 'amarres', 'puerto deportivo', 'atracar', 'marina', 'slips', 'boat parking'], [line([2.75, 20.25], [21.25, 20.25]), ...fingers, ...boats]);
  FILL.marina = { solid: [4, 5], wire: [0, 1, 2, 3] };
  PARTS.marina = { walkway: [0, 1, 2, 3], boats: [4, 5] };
}
{
  // Berth, from above: one slip (the U of its pier) and a boat moored in it
  const slip = roundline([[4.75, 3.25], [4.75, 20.75], [19.25, 20.75], [19.25, 3.25]], [0, 2, 2, 0]);
  put('berth', ['amarre', 'atraque', 'reservar amarre', 'eslora', 'berth', 'slip', 'mooring'], [slip, topBoat(12, 5.5, 17.5, 3.25)]);
  FILL.berth = { solid: [1], wire: [0] };
  PARTS.berth = { slip: [0], boat: [1] };
}
{
  // Boat trailer: the motorboat resting on two bunks of a low frame, its one wheel under it and the
  // tongue reaching forward to the hitch
  const boat = BOAT.map((d) => transform(d, 1, 0, -4));
  const frame = line([3.25, 17.5], [21.25, 17.5]);
  put('boat-trailer', ['remolque de lancha', 'tráiler', 'transportar lancha', 'carretera', 'boat trailer', 'trailer', 'towing'], [...boat, frame, line([6.5, 14.5], [6.5, 17.5]), line([13.5, 14.5], [13.5, 17.5]), circ(10, 19.5, 2)]);
  FILL['boat-trailer'] = { solid: [0, `${boat[1]}Z`, 5], wire: [2, 3, 4] };
  PARTS['boat-trailer'] = { boat: [0, 1], trailer: [2, 3, 4, 5] };
}

// ── Navigation marks ────────────────────────────────────────────────────────────────────────
{
  // Lighthouse: a tapered tower with its band, the lantern room and its roof on top, and the light
  // reaching out to each side
  const tower = roundpoly([[9.5, 11], [14.5, 11], [16.25, 20.75], [7.75, 20.75]], [0.4, 0.4, 0.6, 0.6]);
  const xl = (y) => 9.5 - (1.75 * (y - 11)) / 9.75;
  const band = line([xl(15.75), 15.75], [24 - xl(15.75), 15.75]);
  const lantern = sq(10, 7.75, 4, 3.25, 0.4);
  const roof = roundpoly([[9.25, 7.75], [12, 4.25], [14.75, 7.75]], [0.4, 0.75, 0.4]);
  const c = [12, 9.4];
  const rays = [162, 198, 18, -18].map((a) => line(polar(...c, 6, a), polar(...c, 9.25, a)));
  put('lighthouse', ['faro', 'costa', 'guía', 'paso seguro', 'lighthouse', 'coast', 'beacon'], [tower, band, lantern, roof, ...rays]);
  FILL.lighthouse = { solid: [0, 2, 3], cut: [line([xl(15.75) - 1, 15.75], [25 - xl(15.75), 15.75])], lines: [4, 5, 6, 7] };
  PARTS.lighthouse = { tower: [0, 1], lantern: [2, 3], light: [4, 5, 6, 7] };
  MOTION.lighthouse = { effect: 'beat', parts: ['light'], origin: c };
}
{
  // Buoy: a float on the water, its lattice tower narrowing upward and the light on top
  const float = roundpoly([[6.25, 13.5], [17.75, 13.5], [16.25, 17.25], [7.75, 17.25]], [0.75, 0.75, 1.5, 1.5]);
  const tower = roundline([[8, 13.5], [9.75, 5.5], [14.25, 5.5], [16, 13.5]], [0, 0.6, 0.6, 0]);
  const brace = [line([8, 13.5], [14.25, 5.5]), line([16, 13.5], [9.75, 5.5])];
  put('buoy', ['boya', 'baliza', 'canal de navegación', 'carta náutica', 'buoy', 'channel marker', 'navigation mark'], [float, tower, ...brace, circ(12, 4.25, 1.25), sea()]);
  FILL.buoy = { solid: [0, 4, shut(tower)], cut: [line([7.2, 14.52], [15.05, 4.48]), line([16.8, 14.52], [8.95, 4.48])], lines: [5] };
  PARTS.buoy = { float: [0], tower: [1, 2, 3], light: [4], water: [5] };
  MOTION.buoy = { effect: 'wiggle', parts: ['float', 'tower', 'light'], origin: [12, 17.25] };
}

// ── The sea's state ───────────────────────────────────────────────────────────────────────────
// The tide gauge: a staff with its marks standing in the water, the waterline high or low beside it
// (1.5 clear of the staff) and an arrow saying which way. Filled, the staff is solid and its marks
// are cut from its edge.
const MARKS = [6.5, 10.25, 14, 17.75];
const STAFF = [sq(4.75, 2.75, 5.5, 18.5, 1.75), ...MARKS.map((y) => line([4.75, y], [7.25, y]))];
const level = (y) => ripple(y, 13.25, 3, 8 / 3);
put('tide-high', ['marea alta', 'pleamar', 'tabla de mareas', 'inundación', 'high tide', 'tide table', 'flood'], [...STAFF, level(8.25), line([17.25, 20.5], [17.25, 12.25]), head([17.25, 12.25], [0, -1], 3)]);
put('tide-low', ['marea baja', 'bajamar', 'tabla de mareas', 'aguas someras', 'low tide', 'tide table', 'shallow water'], [...STAFF, level(16.75), line([17.25, 3.5], [17.25, 11.75]), head([17.25, 11.75], [0, 1], 3)]);
for (const [name, dy] of [['tide-high', -1.5], ['tide-low', 1.5]]) {
  FILL[name] = { solid: [0], cut: MARKS.map((y) => line([3.5, y], [7.25, y])), lines: [5], wire: [6, 7] };
  PARTS[name] = { gauge: [0, 1, 2, 3, 4], water: [5], arrow: [6, 7] };
  MOTION[name] = { effect: 'slide', parts: ['arrow'], vector: [0, dy] };
}
{
  // Wave height: lugares's curling wave, smaller, and a double-headed arrow from its trough to its
  // crest
  const k = 0.7;
  const wave = transform(L.wave.d[0], k, 2.75 - 2.75 * k, 19.25 - 19.25 * k);
  const top = 5 * k + 19.25 - 19.25 * k;
  put('wave-height', ['altura de ola', 'oleaje', 'pronóstico marino', 'surf', 'wave height', 'swell', 'marine forecast'], [wave, line([20, top + 0.25], [20, 19]), head([20, top], [0, -1], 3), head([20, 19.25], [0, 1], 3)]);
  FILL['wave-height'] = { solid: [`${wave}Z`], wire: [1, 2, 3] };
  PARTS['wave-height'] = { wave: [0], arrow: [1, 2, 3] };
  MOTION['wave-height'] = { effect: 'beat', parts: ['arrow'], origin: [20, 14] };
}
{
  // Sea current: two waterlines and a wavy arrow running between them, to the right
  const shaft = `${ripple(12, 2.75, 4)}C15.75 10.67 16.75 12 18 12H20.75`;
  put('sea-current', ['corriente marina', 'deriva', 'pronóstico marino', 'carta náutica', 'sea current', 'drift', 'ocean current'], [ripple(5.25), shaft, head([20.75, 12], [1, 0], 3.4), ripple(18.75)]);
  FILL['sea-current'] = false;
  PARTS['sea-current'] = { water: [0, 3], arrow: [1, 2] };
  MOTION['sea-current'] = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
}
{
  // Water depth: a small boat afloat and an arrow down from its keel to the seabed
  const H = hull({ x0: 6.25, x1: 17.75, top: 6.25, bot: 9.25, rake: 2.75, stern: 0.5, r: [0.6, 0.6, 1.25, 1] });
  const cabin = house(H, 8, 12.75, 3.25, 1.75, 0.75);
  const bed = line([2.75, 20], [6.5, 17.5], [10, 20.25], [14.5, 18.5], [18, 20.75], [21.25, 18.25]);
  put('water-depth', ['profundidad', 'sonda', 'sonar', 'calado', 'water depth', 'depth sounder', 'sonar'], [H.d, cabin, line([12, 9.25], [12, 16]), head([12, 16], [0, 1], 3), bed]);
  FILL['water-depth'] = { solid: [0, shut(cabin)], wire: [2, 3, 4] };
  PARTS['water-depth'] = { boat: [0, 1], arrow: [2, 3], seabed: [4] };
  MOTION['water-depth'] = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
}
{
  // Sea route: two ports joined by a dashed curve across the water (its first and last dashes
  // leave the ports' rims), a wave in each free corner
  const [A, B] = [[5, 17.5], [19, 6.5]];
  const P = [add(A, [1.6, -1.2]), [12, 17.5], [12, 6.5], add(B, [-1.6, 1.2])];
  const at = (t) => {
    const m = 1 - t;
    return [0, 1].map((k) => m * m * m * P[0][k] + 3 * m * m * t * P[1][k] + 3 * m * t * t * P[2][k] + t * t * t * P[3][k]);
  };
  const S = Array.from({ length: 201 }, (_, i) => at(i / 200));
  const acc = [0];
  for (let i = 1; i < S.length; i++) acc.push(acc[i - 1] + len(sub(S[i], S[i - 1])));
  const total = acc[200];
  const [n, gap] = [3, 3.25];
  const dash = (total - (n - 1) * gap) / n;
  const dashes = Array.from({ length: n }, (_, i) => {
    const [s0, s1] = [i * (dash + gap), i * (dash + gap) + dash];
    return line(...S.filter((_, j) => acc[j] >= s0 - 1e-9 && acc[j] <= s1 + 1e-9).filter((_, j, arr) => j % 8 === 0 || j === arr.length - 1));
  });
  put('sea-route', ['ruta marítima', 'travesía', 'línea de ferry', 'ruta de navegación', 'sea route', 'crossing', 'shipping lane'], [circ(...A, 2), circ(...B, 2), ...dashes, ripple(6.5, 3, 2), ripple(17.5, 15, 2)]);
  FILL['sea-route'] = { solid: [0, 1], wire: [2, 3, 4], lines: [5, 6] };
  PARTS['sea-route'] = { ports: [0, 1], route: [2, 3, 4], water: [5, 6] };
}

// ── The ship (lugares's) ─────────────────────────────────────────────────────────────────────
// Moving: the ship at 0.75 (smaller, its funnel closes at bold), its motion lines behind it and a
// quay: left behind, or ahead under its bow
const MOVING = SHIP.map((d) => transform(d, 0.75, 5.8125, 0.9375));
const WAKE = [line([2.75, 7.25], [6.25, 7.25]), line([2.75, 10.25], [5, 10.25])];
put('ship-departure', ['salida', 'zarpar', 'tablero de salidas', 'dejar puerto', 'departure', 'sailing out', 'leave port'], [...MOVING, ...WAKE, roundline([[2.75, 15.5], [5.5, 15.5], [5.5, 21.25]], [0, 0.6, 0])]);
put('ship-arrival', ['llegada', 'arribo', 'tablero de llegadas', 'entrar a puerto', 'arrival', 'arriving', 'enter port'], [...MOVING, ...WAKE, roundline([[21.25, 18.75], [15.25, 18.75], [15.25, 21.25]], [0, 0.6, 0])]);
for (const name of ['ship-departure', 'ship-arrival']) {
  FILL[name] = { solid: [0, `${MOVING[1]}Z`, `${MOVING[2]}Z`], lines: [3, 4], wire: [5] };
  PARTS[name] = { ship: [0, 1, 2], wake: [3, 4], quay: [5] };
  MOTION[name] = { effect: 'slide', parts: ['ship'], vector: [1.5, 0] };
}
{
  // Vessel tracking: the ship with two broadcast arcs rising over its funnel
  const ship = SHIP.map((d) => transform(d, 0.75, 3, 6.25));
  const c = [12, 9.5];
  const arcs = [3.5, 6.5].map((r) => arc(...c, r, 235, 305).d);
  put('ship-tracking', ['rastreo de buques', 'AIS', 'posición en vivo', 'localizar barco', 'vessel tracking', 'ship finder', 'AIS'], [...ship, ...arcs]);
  FILL['ship-tracking'] = { solid: [0, `${ship[1]}Z`, `${ship[2]}Z`], lines: [3, 4] };
  PARTS['ship-tracking'] = { ship: [0, 1, 2], signal: [3, 4] };
  icons['ship-tracking'].levels = [[3], [4]];
  MOTION['ship-tracking'] = { effect: 'beat', parts: ['signal'], origin: c };
}
{
  // Vessel from above: the marina's boat turned bow to the right and drawn out long, under way: its
  // wake spreading back from the corners of its stern
  const hullD = turnPath(topBoat(12, 2.75, 16.25, 3), 90);
  const u = unit([-1, -0.8]);
  const from = add([7.75, 9], mul(u, 3));
  const wake = [line(from, [2.75, from[1] + (2.75 - from[0]) * (u[1] / u[0])]), line([from[0], 24 - from[1]], [2.75, 24 - (from[1] + (2.75 - from[0]) * (u[1] / u[0]))])];
  put('ship-top', ['barco visto desde arriba', 'marcador de buque', 'flota', 'mapa', 'vessel from above', 'ship marker', 'fleet'], [hullD, ...wake]);
  FILL['ship-top'] = { solid: [0], lines: [1, 2] };
  PARTS['ship-top'] = { hull: [0], wake: [1, 2] };
}
// The ship's states: lugares's ship itself with the engine's badges
for (const [name, kind, tags] of [
  ['ship-clock', 'clock', ['horario de salida', 'travesía retrasada', 'itinerario', 'ferry', 'sailing schedule', 'delayed crossing', 'timetable']],
  ['ship-x', 'x', ['salida cancelada', 'travesía cancelada', 'puerto cerrado', 'mal tiempo', 'cancelled sailing', 'port closed', 'cancelled crossing']],
  ['ship-check', 'check', ['salida a tiempo', 'reserva confirmada', 'travesía confirmada', 'llegó', 'sailing on time', 'booking confirmed', 'arrived']],
  ['ship-search', 'search', ['buscar barco', 'localizar buque', 'consulta de buques', 'flota', 'find vessel', 'vessel lookup', 'ship finder']],
]) {
  put(name, tags, SHIP, { badge: badge(kind) });
  FILL[name] = { solid: [0, `${SHIP[1]}Z`, `${SHIP[2]}Z`] };
  PARTS[name] = { hull: [0], cabin: [1], funnel: [2] };
  MOTION[name] = kind === 'clock' ? { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] } : kind === 'check' ? { effect: 'beat', parts: ['badge'], origin: [17.25, 17.25] } : { effect: 'wiggle', parts: ['badge'], origin: [17.25, 17.25] };
}
put('anchor-alert', ['alarma de ancla', 'ancla garreando', 'guardia de ancla', 'fondeo', 'anchor alarm', 'dragging anchor', 'anchor watch'], ANCHOR, { badge: badge('alert') });
FILL['anchor-alert'] = { solid: [0, `${ANCHOR[4]}Z`, `${ANCHOR[5]}Z`], wire: [1, 2, 3] };
PARTS['anchor-alert'] = { ring: [0], shank: [1], stock: [2], arms: [3, 4, 5] };
MOTION['anchor-alert'] = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };

// ── At sea ────────────────────────────────────────────────────────────────────────────────────
{
  // Message in a bottle: a corked bottle lying on the water, the rolled note inside it
  const bottle = roundpoly([[2.75, 7], [13.75, 7], [16.25, 10.25], [18.5, 10.25], [18.5, 13.25], [16.25, 13.25], [13.75, 16.5], [2.75, 16.5]], [2.5, 1.5, 0.5, 0, 0, 0.5, 1.5, 2.5]);
  const cork = sq(18.5, 10.25, 2.75, 3, 0.75);
  const note = capsule(5.5, 10.25, 6.25, 3);
  put('message-bottle', ['mensaje en una botella', 'nota anónima', 'mensaje al futuro', 'objetos perdidos', 'message in a bottle', 'anonymous note', 'time capsule'], [bottle, cork, note, ripple(20.25)]);
  FILL['message-bottle'] = { solid: [0, 1], cut: [2], lines: [3] };
  PARTS['message-bottle'] = { bottle: [0, 1], note: [2], water: [3] };
  MOTION['message-bottle'] = { effect: 'float', parts: ['bottle', 'note'], vector: [0, -1] };
}
{
  // Water temperature: the thermometer standing in two waves, its bulb under the water (it goes in
  // front: the engine clears the waves behind it)
  const T = L.thermometer.d[0];
  const body = transform(T, 1, -3.75, 0);
  const level = line([8.25, 8.25], [8.25, 16.75]);
  put('water-temperature', ['temperatura del agua', 'temperatura del mar', 'pronóstico de playa', 'nadar', 'water temperature', 'sea temperature', 'swimming conditions'], [ripple(11.5, 6.75, 5), ripple(16, 6.75, 5)], {
    badge: { d: [body, level], knock: body, fill: { solid: [body], cut: [level] } },
  });
  FILL['water-temperature'] = false;
  PARTS['water-temperature'] = { water: [0, 1] };
}

// ── Knots ─────────────────────────────────────────────────────────────────────────────────────
{
  // Overhand knot: a trefoil opened at its lowest lobe, its two ends running out to each side
  const tre = (t) => [Math.sin(t) + 2 * Math.sin(2 * t), 2 * Math.cos(2 * t) - Math.cos(t)];
  const [k, gap, cy, foot] = [2.75, 0.5, 10, 19.5];
  const body = Array.from({ length: 31 }, (_, i) => {
    const [x, y] = tre(Math.PI + gap + ((2 * Math.PI - 2 * gap) * i) / 30);
    return [12 + x * k, cy + y * k];
  });
  if (body[0][0] > body[30][0]) body.reverse();
  const mid = (foot + body[0][1]) / 2 + 0.5;
  const r = rope([[2.75, foot], [7, mid], ...body, [17, mid], [21.25, foot]]);
  put('knot', ['nudo', 'atar', 'amarrar', 'cuerda', 'knot', 'tie', 'rope'], [r.d], { badge: r.badge });
  FILL.knot = false;
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

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// At 16 px a wave of amplitude 1 snaps to a dotted gray line. These redraw their water as lugares's
// 16 px wave (amplitude 1.5, its nodes and crests on pixel centers: 0.75 + 1.5k), move what floats
// on it `dy` clear of its crests, and let the engine's snap place the rest; a piece too fine for
// 16 px is dropped, and a piece that must meet the new wave is replaced (EDIT16).
const PX = (v, dir = 0) => {
  const k = (v - 0.75) / 1.5;
  return 0.75 + 1.5 * (dir > 0 ? Math.ceil(k - 1e-6) : dir < 0 ? Math.floor(k + 1e-6) : Math.round(k));
};
function small16(name, { dy = 0, wy = (y) => PX(y, -1), drop = [], edit = EDIT16[name] ?? {} } = {}) {
  const icon = icons[name];
  const conv = (p) => {
    const w = WAVES.get(p);
    if (!w) return dy ? transform(p, 1, 0, dy) : p;
    const [y, x0, n] = w;
    let x = PX(x0);
    while (x + 3 * n > 22.3) x -= 1.5;
    return ripple(wy(y), x, n, 3, 1.5);
  };
  const map = new Map(icon.d.map((p, i) => [p, edit[i] ?? conv(p)]));
  const gone = new Set(drop.map((i) => icon.d[i]));
  const keep = (list) => list.filter((p) => !gone.has(p)).map((p) => map.get(p) ?? conv(p));
  const d = keep(icon.d);
  const fill = icon.fill ? Object.fromEntries(Object.entries(icon.fill).map(([k, v]) => [k, keep(v)])) : null;
  const bd = icon.badge ? icon.badge.d.filter((p) => !gone.has(p)).map(conv) : [];
  const sn = snapper([...d, ...Object.values(fill ?? {}).flat(), ...bd]);
  const out = { d: d.map(sn), ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)])) }) };
  if (icon.badge) {
    // The piece on top moves with the rest, onto the same pixels
    let knock = icon.badge.knock;
    for (const p of icon.badge.d) if (WAVES.has(p)) knock = knock.split(p).join(conv(p));
    if (dy && !icon.badge.d.some((p) => WAVES.has(p))) knock = transform(knock, 1, 0, dy);
    const bf = icon.badge.fill && Object.fromEntries(Object.entries(icon.badge.fill).map(([k, v]) => [k, v.map((p) => sn(conv(p)))]));
    out.badge = { d: bd.map(sn), knock: sn(knock), ...(bf && { fill: bf }) };
  }
  icon.small = out;
}
{
  // What floats on the sea moves up a pixel and a half, clear of the 16 px wave's crests
  const SEA16 = PX(SEA, -1);
  EDIT16['fishing-boat'] = { 3: line([4.25, 2], [4.25, SEA16]) };
  for (const name of ['jet-ski', 'houseboat', 'fishing-boat', 'ferry', 'lifeboat', 'message-bottle']) small16(name, { dy: -1.5 });
  EDIT16.buoy = { 4: circ(12, 3, 1) };
  small16('buoy', { dy: -1.5, drop: [2, 3] });
  small16('submarine', { dy: 1.5, wy: () => 3.75 });
  EDIT16['sea-current'] = { 1: `${ripple(12.75, 3.75, 4, 3, 1.5)}L20.25 12.75`, 2: head([20.25, 12.75], [1, 0], 3) };
  small16('sea-current');
  small16('water-temperature', { wy: (y) => (y < 13 ? 11.25 : 17.25) });
  small16('pier', { drop: [], wy: (y) => (y < 17 ? 15.75 : 21.75) });
  small16('man-overboard', { wy: (y) => (y < 16 ? 14.25 : 20.25) });
  small16('shipwreck', { wy: (y) => (y < 17 ? 15.75 : 20.25) });
  small16('tide-high');
  small16('tide-low', { wy: () => 17.25 });
  small16('sea-route');
  // The tall ship's sails as two shapes: their yards clog at 16 px
  small16('tall-ship', { drop: [3, 4] });
  delete icons['tall-ship'].small.fill.cut;
}

// Every boat seen from the side faces right and sails that way
const SIDE = ['boat', 'yacht', 'jet-ski', 'houseboat', 'fishing-boat', 'cruise-ship', 'ferry', 'cargo-ship', 'tugboat', 'water-taxi', 'lifeboat', 'tall-ship', 'submarine'];
for (const name of SIDE) icons[name].mirror = true;
// So do the ship's moves, the current's arrow and the ship seen from above
for (const name of ['ship-departure', 'ship-arrival', 'ship-top', 'sea-current', 'shipwreck']) icons[name].mirror = true;

// Already round: not enclosed again
for (const name of ['porthole', 'ship-wheel', 'boat-propeller']) icons[name].variants = { ...icons[name].variants, circle: false };

// Motion: a boat rides the swell (its water stays put); so do the rowboat and the kayak, seen from
// above (symmetric, or lying across the canvas: not mirrored)
for (const name of [...SIDE, 'rowboat', 'kayak']) {
  if (!icons[name]) continue;
  // The hull in front of an oar or a paddle is a custom piece: it floats too
  const parts = [...Object.keys(icons[name].parts ?? {}).filter((p) => !['water', 'surface', 'spray'].includes(p)), ...(icons[name].badge ? ['badge'] : [])];
  icons[name].motion = { effect: 'float', parts, vector: [0, -1] };
}
for (const [name, motion] of Object.entries(MOTION)) if (icons[name]) icons[name].motion = motion;

export default { category: 'nautica', label: 'Náutica', icons };
