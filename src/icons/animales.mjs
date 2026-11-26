// Animales (animals), round 11: mammals, wild and on the farm, as full silhouettes, their faces,
// their tracks and a few things of the ranch. Drawn with the engine (engine/geometry.mjs) and the
// rules in DESIGN.md.
// - The whole animals stand in profile facing right on one ground line (GROUND, 20.25: mascotas'
//   cat-seated and dog-seated sit on it) and at one scale. A body is one closed outline (back,
//   head, chest and belly), as mascotas' dog-side: the lean animals stand on stroke legs, 3 apart in
//   pairs; the heavy ones (bears, elephants, hippos, rhinos, apes) on legs drawn into the outline,
//   at least 3 wide so their paper holds at 2.1. Families share one body: the big cats one, the
//   bears one, the bovines one, the horses one (zebra, donkey and unicorn build on the horse), the
//   deer one, the goats one, the camels one. Every outline corner is 0.6 or rounder (MIN_R): a
//   tighter one left a sliver of paper that opened and closed between 0.9 and 2.1. A horn's, a
//   bristle's or a spine's point (`tip`) keeps its own radius: a convex point is ink, and rounded to
//   0.6 a narrow one was cut down to a bump (the rhino read as a bear, the hedgehog as a cloud).
// - A tail that runs in behind its body (the red panda's) is cut by the body as a piece on top, so
//   the engine clears it; a tail drawn into the outline (the wolf's, the fox's) keeps its rings as
//   cuts from edge to edge.
// - The faces are front-on heads built like emociones' faces: dot eyes, a dot or oval nose, and the
//   ears and the one feature that tells the animal (mane, stripes, patches) at least 8 wide.
// - The tracks follow mascotas' paw: a broad pad under its toes, here the bear's five as solid dots
//   in an arc (rings that size merged at 2.1); the hoof is its own two halves.
// - mascotas' rabbit, dog and cat and juegos' teddy-bear are not drawn again here.
import { arc, badge, circ, dot, f, flipPath, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
/** The ground every standing animal stands on. */
const G = 20.25;

/**
 * The radii of a rounded polygon, cut down where two corners would not fit on the side between
 * them (each corner keeps its share of the side), so a tight corner never runs backwards.
 */
function fitRadii(pts, rr, closed) {
  const n = pts.length;
  const th = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) {
      th.push(0);
      continue;
    }
    const u = unit(sub(pts[(i - 1 + n) % n], pts[i]));
    const v = unit(sub(pts[(i + 1) % n], pts[i]));
    th.push(Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))));
  }
  const t = rr.map((r, i) => (r && th[i] ? r / Math.tan(th[i] / 2) : 0));
  const k = t.map(() => 1);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    const L = len(sub(pts[j], pts[i]));
    if (t[i] + t[j] > L) {
      const s = L / (t[i] + t[j]);
      k[i] = Math.min(k[i], s);
      k[j] = Math.min(k[j], s);
    }
  }
  return rr.map((r, i) => (th[i] ? t[i] * k[i] * Math.tan(th[i] / 2) : 0));
}
/** Closed outline with rounded corners: [[x, y, r], …] (the engine's roundpoly, radii fitted). */
function rp(spec) {
  const pts = spec.map(([x, y]) => [x, y]);
  return roundpoly(pts, fitRadii(pts, minRadii(pts, spec, true), true));
}
/**
 * The tightest corner the outlines take: a corner rounder than 0.6 leaves no sliver of paper to open
 * and close between weights. On an open stroke a point sharper than 50° (a horn's tip) keeps its
 * radius: rounded more, it would be cut back to a stub.
 */
const MIN_R = 0.6;
function minRadii(pts, spec, closed) {
  const n = pts.length;
  // The outline's turn (its signed area): a corner that turns the other way is a notch
  let area = 0;
  for (let i = 0; i < n; i++) area += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
  return spec.map((p, i) => {
    if (!p[2]) return 0;
    if (!closed && (i === 0 || i === n - 1)) return p[2];
    // A horn's or a quill's point (`tip`): a convex corner is ink, it leaves no paper to close, and
    // rounded to 0.6 a narrow one is cut back by half its height
    if (p[3] === 'tip') return p[2];
    const [A, V, B] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n]];
    const u = unit(sub(A, V));
    const v = unit(sub(B, V));
    const deg = (Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) * 180) / Math.PI;
    const turn = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    const notch = closed && Math.sign(turn) !== Math.sign(area);
    return deg < 50 && !notch && !closed ? p[2] : Math.max(p[2], MIN_R);
  });
}
/** Open stroke with rounded interior corners: [[x, y, r], …], as mascotas' roundline. */
function rl(spec) {
  const pts = spec.map(([x, y]) => [x, y]);
  const rr = fitRadii(pts, minRadii(pts, spec, false), false);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${pt(V)}`;
      continue;
    }
    const u = unit(sub(A, V));
    const v = unit(sub(B, V));
    const a = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const tt = r / Math.tan(a / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(add2(V, mul(u, tt)))}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(add2(V, mul(v, tt)))}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}
/** Ellipse with semi-axes rx, ry (four cubics), as mascotas'. */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}
/** Smooth curve through points (Catmull-Rom → Bézier), as emociones'. `closed` joins it back. */
function smooth(pts, closed = false, k = 1 / 6) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let o = `M${pt(pts[0])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    o += `C${pt([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${pt([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${pt(p2)}`;
  }
  return closed ? `${o}Z` : o;
}
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');
/** A path scaled by `s` around `o` and moved so that `o` lands on `at`. */
const xf = (d, s, o, at = o) => transform(d, s, at[0] - o[0] * s, at[1] - o[1] * s);
/** The same for a point. */
const xp = (p, s, o, at = o) => [at[0] + (p[0] - o[0]) * s, at[1] + (p[1] - o[1]) * s];
/** A custom piece on top: drawn, cleared with a clearance of paper by the engine, solid when filled. */
const piece = (d, { knock = d.map(shut).join(''), solid = d, cut = [], wire = [] } = {}) => ({
  d: [...d, ...cut, ...wire],
  knock,
  fill: { solid, ...(cut.length && { cut }), ...(wire.length && { wire }) },
});

// ── Sampling a path (to stand legs on a body and find where strokes meet) ────────────────────
/** Points along a path every ~0.1 (absolute and relative M L H V C A Z, as the engine writes them). */
function samples(d) {
  const out = [];
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g);
  let i = 0;
  let cmd = '';
  let cur = [0, 0];
  let start = [0, 0];
  const num = () => Number(tok[i++]);
  const push = (p) => out.push(p);
  const seg = (a, b) => {
    const n = Math.max(1, Math.ceil(len(sub(b, a)) / 0.1));
    for (let k = 1; k <= n; k++) push(lerp(a, b, k / n));
  };
  while (i < tok.length) {
    if (/[a-zA-Z]/.test(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const P = () => {
      const x = num();
      const y = num();
      return rel ? [cur[0] + x, cur[1] + y] : [x, y];
    };
    switch (cmd.toUpperCase()) {
      case 'M':
        cur = start = P();
        push(cur);
        cmd = rel ? 'l' : 'L';
        break;
      case 'L': {
        const p = P();
        seg(cur, p);
        cur = p;
        break;
      }
      case 'H': {
        const x = num();
        const p = [rel ? cur[0] + x : x, cur[1]];
        seg(cur, p);
        cur = p;
        break;
      }
      case 'V': {
        const y = num();
        const p = [cur[0], rel ? cur[1] + y : y];
        seg(cur, p);
        cur = p;
        break;
      }
      case 'C': {
        const [a, b, e] = [P(), P(), P()];
        const p0 = cur;
        for (let k = 1; k <= 24; k++) {
          const t = k / 24;
          const m = 1 - t;
          push([m * m * m * p0[0] + 3 * m * m * t * a[0] + 3 * m * t * t * b[0] + t * t * t * e[0], m * m * m * p0[1] + 3 * m * m * t * a[1] + 3 * m * t * t * b[1] + t * t * t * e[1]]);
        }
        cur = e;
        break;
      }
      case 'S': {
        P();
        const e = P();
        seg(cur, e);
        cur = e;
        break;
      }
      case 'A': {
        const [rx, ry] = [num(), num()];
        num();
        const large = num();
        const sweep = num();
        const e = P();
        // Endpoint to center parameterization (circular arcs only, as the set draws them)
        const r0 = Math.max(rx, ry);
        const mid = lerp(cur, e, 0.5);
        const half = len(sub(e, cur)) / 2;
        const r = Math.max(r0, half);
        const h = Math.sqrt(Math.max(0, r * r - half * half));
        const u = unit(sub(e, cur));
        const nrm = [-u[1], u[0]];
        const sgn = large !== sweep ? 1 : -1;
        const c = add2(mid, mul(nrm, sgn * h));
        let a0 = Math.atan2(cur[1] - c[1], cur[0] - c[0]);
        let a1 = Math.atan2(e[1] - c[1], e[0] - c[0]);
        if (sweep && a1 < a0) a1 += 2 * Math.PI;
        if (!sweep && a1 > a0) a1 -= 2 * Math.PI;
        const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / 0.1));
        for (let k = 1; k <= n; k++) {
          const a = a0 + ((a1 - a0) * k) / n;
          push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
        }
        cur = e;
        break;
      }
      case 'Z':
        seg(cur, start);
        cur = start;
        break;
      default:
        throw new Error(`samples: unknown command ${cmd}`);
    }
  }
  return out;
}
/** Where the vertical line at `x` crosses a path: its lowest crossing (`low`) or its highest. */
function yAt(d, x, low = true) {
  const s = samples(d);
  let best = null;
  for (let k = 1; k < s.length; k++) {
    const [a, b] = [s[k - 1], s[k]];
    if ((a[0] - x) * (b[0] - x) > 0 || a[0] === b[0]) continue;
    const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    if (best === null || (low ? y > best : y < best)) best = y;
  }
  if (best === null) throw new Error(`yAt: no crossing at ${x}`);
  return best;
}
/** Where the horizontal line at `y` crosses a path: its leftmost crossing (`left`) or its rightmost. */
function yAt2(d, y, left = true) {
  const s = samples(d);
  let best = null;
  for (let k = 1; k < s.length; k++) {
    const [a, b] = [s[k - 1], s[k]];
    if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
    const x = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
    if (best === null || (left ? x < best : x > best)) best = x;
  }
  if (best === null) throw new Error(`yAt2: no crossing at ${y}`);
  return best;
}
/** Where a stroke from `p` along `dir` first meets a path. */
function hit(d, p, dir) {
  const s = samples(d);
  const u = unit(dir);
  let best = null;
  for (let k = 1; k < s.length; k++) {
    const [a, b] = [s[k - 1], s[k]];
    const e = sub(b, a);
    const den = u[0] * e[1] - u[1] * e[0];
    if (Math.abs(den) < 1e-9) continue;
    const w = sub(a, p);
    const t = (w[0] * e[1] - w[1] * e[0]) / den;
    const v = (w[0] * u[1] - w[1] * u[0]) / den;
    if (t > 1e-6 && v >= 0 && v <= 1 && (best === null || t < best)) best = t;
  }
  if (best === null) throw new Error('hit: no crossing');
  return add2(p, mul(u, best));
}
/** The point of a path nearest to `p` (to start a tail or a horn on the outline it leaves). */
function onPath(d, p) {
  let best = null;
  for (const q of samples(d)) if (!best || len(sub(q, p)) < len(sub(best, p))) best = q;
  return best;
}
/** The same points with the first moved onto the path `d`. */
const from = (d, pts) => [onPath(d, pts[0]).concat(pts[0].slice(2)), ...pts.slice(1)];
/**
 * A tail that ends in a tuft: the stroke stops on the edge of the dot (r 0.7) at its last point, so
 * it touches it, and the dot.
 */
function tuft(pts, smoothIt = false) {
  const c = pts[pts.length - 1];
  return [smoothIt ? smooth(pts) : rl(pts), dot(c[0], c[1])];
}
/** Four straight legs from the body's underside to the ground: the hind pair at h, the front pair at fr, each 3 apart. */
const legs4 = (body, h, fr, ground = G) => [h, h + 3, fr, fr + 3].map((x) => leg(body, x, [x, ground]));
/** A leg: a stroke from the body's underside at `x` straight down to the ground (or to `foot`). */
const leg = (body, x, foot = [x, G]) => line([x, yAt(body, x)], foot);
/** A slanted leg: from the body's underside at `x`, out to `foot`. */
const legTo = (body, x, foot) => line([x, yAt(body, x)], foot);

/**
 * Scallops: arcs of radius `rb` bulging out of a circle (c, R) between the angles a0 and a1 (degrees,
 * clockwise on screen), `n` of them; the chain starts with an M at its first point unless `cont`.
 */
function scallops(c, R, a0, a1, n, rb, cont = false) {
  let s = cont ? '' : `M${pt(polar(...c, R, a0))}`;
  for (let k = 1; k <= n; k++) {
    const p = polar(...c, R, a0 + ((a1 - a0) * k) / n);
    s += `A${f(rb)} ${f(rb)} 0 0 ${a1 > a0 ? 1 : 0} ${pt(p)}`;
  }
  return s;
}
/** Scallops on an ellipse (c, rx, ry) between the angles a0 and a1, n of them, each of radius rb. */
function scallopsE(c, rx, ry, a0, a1, n, rb, cont = false) {
  const P = (a) => [c[0] + rx * Math.cos((a * Math.PI) / 180), c[1] + ry * Math.sin((a * Math.PI) / 180)];
  let s = cont ? '' : `M${pt(P(a0))}`;
  for (let k = 1; k <= n; k++) s += `A${f(rb)} ${f(rb)} 0 0 ${a1 > a0 ? 1 : 0} ${pt(P(a0 + ((a1 - a0) * k) / n))}`;
  return s;
}
/** The point at angle `a` on an ellipse. */
const onE = (c, rx, ry, a) => [c[0] + rx * Math.cos((a * Math.PI) / 180), c[1] + ry * Math.sin((a * Math.PI) / 180)];
/**
 * A tube along a smooth center line (Catmull-Rom through `pts`) of width `w`, closed with round
 * ends: a thick tail. Returns { d, at(t) } where at(t) gives the two edge points across the tube at
 * t (0–1 along the line), for the bands cut across it.
 */
function tube(pts, w, { start = true, end = true } = {}) {
  const c = samples(smooth(pts));
  const L = [0];
  for (let i = 1; i < c.length; i++) L.push(L[i - 1] + len(sub(c[i], c[i - 1])));
  const total = L[L.length - 1];
  const at = (t) => {
    const x = t * total;
    let i = L.findIndex((v) => v >= x);
    i = Math.max(1, i);
    const tan = unit(sub(c[Math.min(c.length - 1, i)], c[i - 1]));
    const p = lerp(c[i - 1], c[i], (x - L[i - 1]) / (L[i] - L[i - 1] || 1));
    const n = [-tan[1], tan[0]];
    return [add2(p, mul(n, w / 2)), add2(p, mul(n, -w / 2))];
  };
  const N = 16;
  const left = [];
  const right = [];
  for (let k = 0; k <= N; k++) {
    const [a, b] = at(k / N);
    left.push(a);
    right.push(b);
  }
  const R = f(w / 2);
  const side = (ps) => smooth(ps).replace(/^M[^C]*/, '');
  let d = `M${pt(left[0])}${side(left)}`;
  d += end ? `A${R} ${R} 0 0 1 ${pt(right[N])}` : `L${pt(right[N])}`;
  d += side(right.slice().reverse());
  d += start ? `A${R} ${R} 0 0 1 ${pt(left[0])}Z` : 'Z';
  return { d, at };
}
/** Crescent moon: a disc of radius r at c with a disc of the same radius taken out at `off`. */
function crescent(c, r, off) {
  const dd = len(off);
  const a = dd / 2;
  const h = Math.sqrt(r * r - a * a);
  const u = unit(off);
  const m = add2(c, mul(u, a));
  const p = add2(m, mul([-u[1], u[0]], h));
  const q = add2(m, mul([u[1], -u[0]], h));
  return `M${pt(p)}A${f(r)} ${f(r)} 0 1 1 ${pt(q)}A${f(r)} ${f(r)} 0 0 0 ${pt(p)}Z`;
}

/**
 * An ear outside a round head: the arc of the circle (cB, rB) that lies outside the head (cA, rA),
 * from where it leaves the head to where it comes back (as comercio's bear-market).
 */
function outerArc(cA, rA, cB, rB) {
  const d = len(sub(cB, cA));
  const a = (rA * rA - rB * rB + d * d) / (2 * d);
  const h = Math.sqrt(rA * rA - a * a);
  const u = unit(sub(cB, cA));
  const P = add2(cA, mul(u, a));
  const [p, q] = [add2(P, mul([-u[1], u[0]], h)), add2(P, mul([u[1], -u[0]], h))];
  const ang = (x) => (Math.atan2(x[1] - cB[1], x[0] - cB[0]) * 180) / Math.PI;
  const span = (((ang(q) - ang(p)) % 360) + 360) % 360;
  const [from, to] = span > 180 ? [p, q] : [q, p];
  return `M${pt(from)}A${f(rB)} ${f(rB)} 0 1 1 ${pt(to)}`;
}

/** Intersections of two circles [x, y, r]: the two points, the first counterclockwise of the line between centers. */
function meet2([x1, y1, r1], [x2, y2, r2]) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  return [
    [m[0] - (h * (y2 - y1)) / d, m[1] + (h * (x2 - x1)) / d],
    [m[0] + (h * (y2 - y1)) / d, m[1] - (h * (x2 - x1)) / d],
  ];
}
/** The `A…` segment from p to q along the circle (c, r), clockwise on screen (or counterclockwise). */
function arcSeg(c, r, p, q, cw = true) {
  const a = (x) => Math.atan2(x[1] - c[1], x[0] - c[0]);
  let span = a(q) - a(p);
  if (cw) span = ((span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  else span = ((-span % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return `A${f(r)} ${f(r)} 0 ${span > Math.PI ? 1 : 0} ${cw ? 1 : 0} ${pt(q)}`;
}
/**
 * A round ear on any outline `d`: the arc of the circle (c, r) outside it, from where the circle
 * leaves the outline to where it comes back (the points of `d` at distance r from c).
 */
function earOn(d, c, r, inside) {
  const s = samples(d);
  const hits = [];
  for (let k = 1; k < s.length; k++) if ((len(sub(s[k - 1], c)) - r) * (len(sub(s[k], c)) - r) <= 0) hits.push(s[k]);
  const [p, q] = [hits[0], hits[hits.length - 1]];
  const mid = (cw) => {
    const a0 = Math.atan2(p[1] - c[1], p[0] - c[0]);
    let a1 = Math.atan2(q[1] - c[1], q[0] - c[0]);
    if (cw && a1 < a0) a1 += 2 * Math.PI;
    if (!cw && a1 > a0) a1 -= 2 * Math.PI;
    const a = (a0 + a1) / 2;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  };
  const cw = len(sub(mid(true), inside)) > len(sub(mid(false), inside));
  return `M${pt(p)}${arcSeg(c, r, p, q, cw)}`;
}
/** An ellipse turned `deg` degrees about its center. */
const tilted = (c, rx, ry, deg) => turnPath(ell(c, rx, ry), deg, c);

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  // A word that is the same in both languages (llama, koala, panda) is listed once
  icons[name] = { tags: [...new Set(tags)], d, ...extra };
};
/** Fill specs collected as the icons are drawn (by index of `d`, or a stroke of its own). */
const FILL = {};
/** Named parts, by index of `d`. */
const PARTS = {};

// ── The big cats ──────────────────────────────────────────────────────────────────────────────
// One body for the four: a long low torso, the shoulders a little over the rump and the waist tucked
// up before the hind legs, a round head carried level with the back, a small round ear; the lion
// wears its mane over the head, the leopard lies the same body along a branch and the cheetah
// stretches it out to a sprint.
const CAT = [
  [4.5, 10.25, 2.5],
  [10.5, 9.75, 3],
  [14.75, 9.5, 2],
  [16.5, 8.5, 1],
  [17, 7.25, 0.6],
  [18.25, 7, 0.8],
  [18.75, 7.75, 0.5],
  [19.75, 8, 1.5],
  [21.25, 10.75, 1],
  [20.75, 12.5, 0.75],
  [18.5, 13, 1],
  [17.5, 15.75, 1.5],
  [12.75, 15.75, 2.5],
  [9.5, 15.25, 2],
  [4.5, 16, 2.5],
];
/** The cat's walk: the legs in pairs, the near ones forward and back. */
const catLegs = (body) => [legTo(body, 6.25, [5.5, G]), legTo(body, 8.75, [9.5, G]), legTo(body, 13.75, [13, G]), legTo(body, 16.25, [17, G])];
{
  const body = rp(CAT);
  const tail = smooth(from(body, [[4.25, 11.25], [2.75, 12], [2.25, 15], [2.5, 18.25]]));
  const stripes = [7.5, 10.5, 13.5].map((x) => {
    const top = [x, yAt(body, x, false)];
    return line(top, add2(top, [0.6, 2.1]));
  });
  add('tiger', ['tigre', 'felino', 'selva', 'tiger', 'big cat', 'wildlife'], [body, ...catLegs(body), tail, ...stripes]);
  FILL.tiger = { solid: [0], wire: [1, 2, 3, 4, 5], cut: [6, 7, 8] };
  PARTS.tiger = { body: [0], legs: [1, 2, 3, 4], tail: [5], stripes: [6, 7, 8] };
}
{
  // The lion: the cat's body running into a mane, a ring of scallops around the head, open at the
  // front where the face looks out of it (the line inside is the face's edge); the tail ends in its
  // tuft
  const c = [16, 10.25];
  const R = 4;
  const n = 8;
  const [a0, a1] = [-48, -312];
  const cusp = (k) => polar(...c, R, a0 + ((a1 - a0) * k) / n);
  const F0 = polar(...c, R, a0);
  const F1 = polar(...c, R, a1);
  const mane = `${scallops(c, R, a0, a1, n, 1.3)}${rl([F1, [19.75, 14.25, 1], [21.25, 12.75, 1], [21.75, 10.5, 1], [20, 7.5, 1], F0]).replace(/^M[^L]*/, '')}Z`;
  const face = smooth([onPath(mane, add2(F0, [0.75, 0.1])), [17.75, 10.5], onPath(mane, add2(F1, [0.6, -0.1]))]);
  // The body leaves the mane at its lower cusp and comes back at its leftmost one
  const body = rl([cusp(6), [12.75, 15.75, 2], [9.5, 15.25, 2], [4.5, 16, 2.5], [4.5, 10.5, 2.5], [10.5, 10.25, 2], cusp(4)]);
  const B = shut(body);
  const legs = [legTo(B, 6.75, [6, G]), legTo(B, 9.25, [10, G]), legTo(B, 13, [13, G]), line([16.25, yAt(mane, 16.25)], [16.75, G])];
  const tail = tuft(from(B, [[4.25, 11.25], [2.75, 12], [2.5, 15], [3.25, 17.5]]), true);
  add('lion', ['león', 'felino', 'rey de la selva', 'lion', 'big cat', 'courage'], [mane, face, body, ...legs, ...tail]);
  FILL.lion = { solid: [0, B], cut: [1], wire: [3, 4, 5, 6, 7, 8] };
  PARTS.lion = { mane: [0], face: [1], body: [2], legs: [3, 4, 5, 6], tail: [7, 8] };
}

{
  // The leopard asleep on a branch: the big cats' body (the tiger's) lying flat along it, the branch
  // running on under its belly and out in front, the near legs and the tail hanging down, and four
  // spots scattered over its flank in two offset rows (the body lies deeper on the branch, its belly
  // flattened, to give them room at 2.1). A body of its own with spots of 0.3, or three spots in a
  // row, read as a bus and its windows
  const body = rp([...CAT.slice(0, 11), [17.5, 17.75, 1.5], [4.5, 17.75, 2.5]]);
  const branch = hl(17.75, 6.25, 21.75);
  const legs = [line([16.25, 17.75], [16.5, 20.75]), line([9.25, 17.75], [9.5, 20.75])];
  const tail = smooth(from(body, [[4.35, 13], [3.25, 16], [3.5, 20.75]]));
  const spots = [[6.75, 12.9], [9.5, 14.75], [12.25, 12.9], [15, 14.75]].map((p) => dot(...p, 0.5));
  add('leopard', ['leopardo', 'pantera', 'felino', 'leopard', 'panther', 'safari'], [body, branch, ...legs, tail, ...spots]);
  FILL.leopard = { solid: [0], wire: [1, 2, 3, 4], cut: [5, 6, 7, 8] };
  PARTS.leopard = { body: [0], branch: [1], legs: [2, 3], tail: [4], spots: [5, 6, 7, 8] };
}
{
  // The cheetah at full stretch: the cat's body, leaner, the front legs reaching forward and the hind
  // legs back, the tail out behind; the tear line runs down its face from the eye to the jaw
  const body = rp([
    [4.75, 10.75, 2],
    [9.5, 11, 3],
    [14, 10, 2],
    [16.5, 9.25, 1],
    [17, 8.25, 0.5],
    [18, 8, 0.6],
    [18.5, 8.5, 0.4],
    [19.5, 8.75, 1.25],
    [21.25, 10.75, 0.75],
    [20.75, 12, 0.6],
    [18.25, 12.5, 0.8],
    [16.75, 15, 1.5],
    [12, 15, 2.5],
    [8.25, 13.75, 1.5],
    [4.75, 14.5, 2],
  ]);
  const legs = [legTo(body, 13.75, [17.75, 19.75]), legTo(body, 16.25, [21, 17.75]), legTo(body, 6, [2.5, 18]), legTo(body, 8.5, [5.5, 19.75])];
  const tail = smooth(from(body, [[4.5, 11.5], [2.75, 11], [2.25, 8.75]]));
  const tear = line([19.25, yAt(body, 19.25, false)], [19.75, yAt(body, 19.75)]);
  add('cheetah', ['guepardo', 'velocidad', 'felino', 'cheetah', 'speed', 'fast'], [body, ...legs, tail, tear]);
  FILL.cheetah = { solid: [0], wire: [1, 2, 3, 4, 5], cut: [6] };
  PARTS.cheetah = { body: [0], legs: [1, 2, 3, 4], tail: [5], tear: [6] };
}

// ── The wild dogs ─────────────────────────────────────────────────────────────────────────────
// The wolf: a lean body on long legs, trotting (the legs in diagonal pairs), the head carried
// forward, level with the back, a tall pointed ear, a long muzzle and the bushy tail held low,
// drawn into the outline. The fox is the same family smaller and lower, its brush tail held out.
{
  const body = rp([
    [6, 10, 2],
    [13, 9.75, 2],
    [15.25, 8.5, 1],
    [15.75, 7, 0.3],
    [16.5, 3.75, 0.5],
    [18, 6.75, 0.4],
    [18.75, 7, 0.75],
    [21.5, 9, 0.6],
    [21.25, 10.25, 0.5],
    [18.5, 11, 0.75],
    [17.25, 11.75, 1],
    [16.5, 14.25, 1.5],
    [11, 14.25, 2],
    [8.5, 13.5, 1.5],
    [6.5, 14, 1],
    [4.75, 15.75, 1],
    [2.25, 16.5, 0.75],
    [3, 13, 2],
  ]);
  const legs = [legTo(body, 7.75, [6.5, G]), legTo(body, 10.25, [11, G]), legTo(body, 13.25, [14, G]), legTo(body, 15.75, [17.25, G])];
  add('wolf', ['lobo', 'manada', 'bosque', 'wolf', 'pack', 'wild'], [body, ...legs]);
  FILL.wolf = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS.wolf = { body: [0], legs: [1, 2, 3, 4] };
}
{
  // Howling: the wolf sitting, its chest upright, the haunch round on the ground and the muzzle
  // raised straight up to a crescent moon
  const body = rp([
    [11.25, 2.75, 0.5],
    [12.75, 3, 0.4],
    [13, 7, 1],
    [14.5, 11.5, 2.5],
    [15, G, 0.75],
    [6.5, G, 1.5],
    [4, 15.5, 3.5],
    [7, 10.5, 2],
    [8.5, 8.75, 0.4],
    [6, 5.5, 0.5],
    [9.25, 6.5, 0.3],
    [10, 5.25, 0.6],
  ]);
  const legLine = vl(12.5, 14.25, G);
  const tail = rl([[6.5, G], [2.5, G]]);
  const moon = crescent([18.75, 6], 3, [-1.75, 1.25]);
  add('wolf-howling', ['lobo aullando', 'aullido', 'noche', 'wolf howling', 'howl', 'full moon'], [body, legLine, tail, moon]);
  FILL['wolf-howling'] = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS['wolf-howling'] = { body: [0], leg: [1], tail: [2], moon: [3] };
}
{
  // The fox: smaller and lower than the wolf, a narrow snout and a big brush tail held out behind,
  // its tip marked off
  const body = rp([
    [7, 11.5, 2],
    [13.75, 11.25, 2],
    [15.5, 10.25, 0.75],
    [15.75, 9.5, 0.3],
    [16.5, 6.5, 0.5],
    [18, 9.25, 0.3],
    [18.75, 9.5, 0.75],
    [21.5, 11.75, 0.5],
    [21.25, 12.5, 0.4],
    [18.5, 13.25, 0.75],
    [17.25, 15.75, 1.25],
    [7.5, 15.75, 2],
    [5.5, 16.5, 1.5],
    [2.25, 16.25, 0.75],
    [3.25, 12.5, 2],
  ]);
  const tip = line(hit(body, [4.75, 13.5], [-1, -1.25]), hit(body, [4.75, 13.5], [1, 1.25]));
  const legs = [legTo(body, 8.75, [7.75, G]), legTo(body, 11, [11.25, G]), legTo(body, 14, [14.25, G]), legTo(body, 16.25, [17.5, G])];
  add('fox', ['zorro', 'astuto', 'bosque', 'fox', 'clever', 'forest'], [body, ...legs, tip]);
  FILL.fox = { solid: [0], wire: [1, 2, 3, 4], cut: [5] };
  PARTS.fox = { body: [0], legs: [1, 2, 3, 4], tip: [5] };
}
{
  // The fennec, sitting, from the front: a small fox face under two ears nearly as tall as its body,
  // the body below and the tail curled at its side
  const head = rp([
    [12, 9.25, 1.25],
    [16.75, 10.25, 1.5],
    [16.5, 13.5, 1.75],
    [12, 17, 1],
    [7.5, 13.5, 1.75],
    [7.25, 10.25, 1.5],
  ]);
  const earL = rl([[7.5, 11.25], [2.75, 3, 1.1], [11, 9.4]]);
  const earR = flipPath(earL);
  const body = rl([onPath(head, [9.25, 15.25]), [8.5, 17, 1], [9, G, 1], [15, G, 1], [15.5, 17, 1], onPath(head, [14.75, 15.25])]);
  const tail = rl([[14.75, G], [19.5, G, 1.75], [20, 16.75]]);
  add('fennec-fox', ['fénec', 'zorro del desierto', 'orejas grandes', 'fennec fox', 'desert fox', 'big ears'], [head, earL, earR, body, tail, dot(10.25, 12.25, 0.3), dot(13.75, 12.25, 0.3)]);
  FILL['fennec-fox'] = { solid: [0, shut(earL), shut(earR), shut(body)], wire: [4], cut: [5, 6] };
  PARTS['fennec-fox'] = { head: [0], ears: [1, 2], body: [3], tail: [4], eyes: [5, 6] };
}

// ── The bears ─────────────────────────────────────────────────────────────────────────────────
// One body: heavy, the shoulders raised in a hump, the head carried low and forward with a small
// round ear and a short snout, the legs drawn into the outline (3 or more wide), no tail to see.
const BEAR = [
  [4.25, 11.25, 3],
  [11.75, 7.5, 3.5],
  [15.5, 8.75, 1.5],
  [16, 8.25, 0.4],
  [16.5, 7.25, 0.75],
  [17.75, 7.5, 0.75],
  [18, 8.75, 0.4],
  [19, 9.25, 1.5],
  [21.5, 11.5, 0.75],
  [21.25, 12.75, 0.5],
  [18.5, 13.25, 1],
  [17.25, 14.5, 1],
  [17.75, G, 0.6],
  [14.25, G, 0.6],
  [14, 15.75, 1],
  [8.25, 15.75, 1],
  [8, G, 0.6],
  [4.25, G, 0.6],
  [3.25, 14.5, 2],
];
{
  const body = rp(BEAR);
  add('bear', ['oso', 'oso pardo', 'grizzly', 'bear', 'grizzly bear', 'wildlife'], [body]);
  FILL.bear = { solid: [0] };
  PARTS.bear = { body: [0] };
  // With the alert the bear steps back up and left, smaller: the badge takes its front foot
  const small = xf(body, 0.8, [12, G], [10.25, 17]);
  add('bear-alert', ['zona de osos', 'aviso de osos', 'precaución', 'bear warning', 'bear country', 'trail advisory'], [small], { badge: badge('alert') });
  FILL['bear-alert'] = { solid: [0] };
  PARTS['bear-alert'] = { body: [0] };
}
{
  // The polar bear: no hump, the rump the highest point, a long neck carrying a small head low, on a
  // floe of ice (its edge breaks off at the right)
  const body = rp([
    [4, 11.25, 3],
    [9.5, 9, 3],
    [14, 10, 2],
    [17.5, 11.5, 1],
    [18, 11, 0.4],
    [18.75, 10.75, 0.6],
    [19.25, 11.5, 0.4],
    [21.5, 13.25, 0.6],
    [21.25, 14.5, 0.5],
    [18.25, 14.75, 0.75],
    [16.25, 14.75, 0.75],
    [16, G, 0.6],
    [13, G, 0.6],
    [12.75, 16.25, 1],
    [8.25, 16.25, 1],
    [8, G, 0.6],
    [4.25, G, 0.6],
    [3, 14.5, 2],
  ]);
  const floe = hl(G, 2.25, 21.75);
  add('polar-bear', ['oso polar', 'ártico', 'cambio climático', 'polar bear', 'arctic', 'climate change'], [body, floe]);
  FILL['polar-bear'] = { solid: [0], wire: [1] };
  PARTS['polar-bear'] = { body: [0], ice: [1] };
}
{
  // Standing: the bear up on its hind legs, in profile, the bear's round ear and short snout on a
  // head as big as its on all fours, the foreleg reaching out from the chest at shoulder height, the
  // belly round over the hind leg and its long foot flat on the ground. A small head over a long
  // body read as a dog sitting, its foreleg as a beak
  const body = rp([
    [5.5, G, 0.6],
    [3.75, 15.25, 3],
    [5, 9.75, 3],
    [7.25, 6.75, 1.25],
    [7.75, 5, 0.6],
    [8.25, 3, 1],
    [10.25, 3.5, 0.6],
    [12.5, 3.25, 1.5],
    [16.75, 5.5, 0.6],
    [17, 7.25, 0.6],
    [13.75, 8, 1],
    [13.5, 10, 1],
    [19.25, 10.25, 1],
    [19.25, 12.75, 0.75],
    [14, 13.25, 1],
    [14.5, 15.5, 2],
    [12.5, 17.5, 1],
    [15.5, 18.25, 0.75],
    [15.5, G, 0.5],
  ]);
  add('bear-standing', ['oso de pie', 'oso erguido', 'encuentro', 'standing bear', 'bear encounter', 'strength'], [body]);
  FILL['bear-standing'] = { solid: [0] };
  PARTS['bear-standing'] = { body: [0] };
}
{
  // Asleep: the bear lying down, its eye a closed arc, under the low dome of its den. The bear's own
  // lying silhouette: the hump over the round back, the dip of the neck, the round ear and the head
  // laid on the ground with its snout forward, 2.85 or more inside the dome. In an arch with straight
  // walls there was room only for a blob with a dimple, and it read as a mouse hole
  const den = `M2.25 ${f(G)}A9.75 12.75 0 0 1 21.75 ${f(G)}`;
  const body = rp([
    [6, G, 0.75],
    [5.25, 16.5, 2.75],
    [9.5, 12, 3.5],
    [13, 12.75, 1.25],
    [13.5, 11.5, 0.75],
    [15.25, 11.75, 0.75],
    [15.5, 13.25, 0.6],
    [18.75, 17.75, 1],
    [18.5, G, 0.6],
  ]);
  const eye = arc(15.75, 14.75, 1.4, 25, 155).d;
  add('bear-sleeping', ['oso dormido', 'hibernación', 'modo reposo', 'hibernating bear', 'hibernation', 'sleep mode'], [den, body, eye]);
  FILL['bear-sleeping'] = { solid: [`${body}`], cut: [2], lines: [0] };
  PARTS['bear-sleeping'] = { den: [0], body: [1], eye: [2] };
}

// ── The faces ─────────────────────────────────────────────────────────────────────────────────
// Front-on heads built like emociones' faces: a round head (r 7.75 at 12, 13, comercio's bear-market
// head) whenever the animal's is round, the eyes dots of r 0.5 (the faces' muzzles take the room an
// r 0.7 needs), the ears outside the head (an arc that leaves it and comes back) and the feature that
// tells the animal drawn at least 8 wide.
const FC = [12, 13];
const FR = 7.75;
const HEAD = circ(...FC, FR);
const EYES = [dot(8.75, 10.75, 0.5), dot(15.25, 10.75, 0.5)];
/** Round ears on the head: the arcs of two circles of radius r at `x` from the middle, at height y. */
const roundEars = (dx, y, r) => [outerArc(FC, FR, [12 - dx, y], r), outerArc(FC, FR, [12 + dx, y], r)];
{
  // Bear: two round ears on top and an oval muzzle with its nose
  add('bear-face', ['cara de oso', 'oso', 'avatar', 'bear face', 'bear', 'mascot'], [HEAD, ...roundEars(6, 6.25, 2.75), ell([12, 15.25], 3.25, 2.75), dot(12, 15.25, 0.5), ...EYES]);
  FILL['bear-face'] = { solid: [0, shut(icons['bear-face'].d[1]), shut(icons['bear-face'].d[2])], cut: [3, 4, 5, 6] };
  PARTS['bear-face'] = { head: [0], ears: [1, 2], muzzle: [3, 4], eyes: [5, 6] };
}
{
  // Panda: round ears and the two slanted patches around the eyes, a small nose under them
  const patches = [tilted([8.75, 12], 1.75, 2.5, 35), tilted([15.25, 12], 1.75, 2.5, -35)];
  add('panda-face', ['cara de panda', 'panda', 'avatar', 'panda face', 'panda', 'sticker'], [HEAD, ...roundEars(6, 6.25, 2.75), ...patches, dot(12, 16.25, 0.5)]);
  FILL['panda-face'] = { solid: [0, shut(icons['panda-face'].d[1]), shut(icons['panda-face'].d[2])], cut: [3, 4, 5] };
  PARTS['panda-face'] = { head: [0], ears: [1, 2], patches: [3, 4], nose: [5] };
}
{
  // Koala: wide round ears set out to the sides of a broad head, a big oval nose down its middle
  const head = ell([12, 13.75], 6.5, 6.5);
  const ears = [outerArc([12, 13.75], 6.5, [5.25, 8.75], 3.25), outerArc([12, 13.75], 6.5, [18.75, 8.75], 3.25)];
  add('koala-face', ['cara de koala', 'koala', 'avatar', 'koala face', 'koala', 'kids'], [head, ...ears, ell([12, 15.75], 1.4, 2.25), dot(9.25, 11.25, 0.5), dot(14.75, 11.25, 0.5)]);
  FILL['koala-face'] = { solid: [0, shut(ears[0]), shut(ears[1])], cut: [3, 4, 5] };
  PARTS['koala-face'] = { head: [0], ears: [1, 2], nose: [3], eyes: [4, 5] };
}
{
  // Monkey: a round head with big round ears at its sides, the face inside it a heart (the two
  // circles around the eyes running into the muzzle)
  const head = circ(12, 12.75, 7);
  const ears = [outerArc([12, 12.75], 7, [4.5, 12.75], 2.5), outerArc([12, 12.75], 7, [19.5, 12.75], 2.5)];
  const [Lc, Rc, Mc] = [[9.75, 11, 2.6], [14.25, 11, 2.6], [12, 15, 3.6]];
  const top = meet2(Lc, Rc).sort((a, b) => a[1] - b[1])[0];
  const right = meet2(Rc, Mc).sort((a, b) => b[0] - a[0])[0];
  const left = meet2(Lc, Mc).sort((a, b) => a[0] - b[0])[0];
  const mask = `M${pt(top)}${arcSeg(Rc, Rc[2], top, right)}${arcSeg(Mc, Mc[2], right, left)}${arcSeg(Lc, Lc[2], left, top)}Z`;
  add('monkey-face', ['cara de mono', 'mono', 'travesura', 'monkey face', 'monkey', 'mischief'], [head, ...ears, mask, dot(9.75, 11.25, 0.5), dot(14.25, 11.25, 0.5), dot(11, 15, 0.5), dot(13, 15, 0.5)]);
  FILL['monkey-face'] = { solid: [0, shut(ears[0]), shut(ears[1])], cut: [3, 4, 5, 6, 7] };
  PARTS['monkey-face'] = { head: [0], ears: [1, 2], face: [3], eyes: [4, 5], nose: [6, 7] };
}
{
  // Elephant: a domed head running down into the trunk, the wide ear flaps at its sides
  const head = rp([
    [12, 4, 0],
    [16.75, 4.75, 3.5],
    [16.75, 11.25, 2],
    [13.5, 14, 1.25],
    [13.5, 21.25, 1.5],
    [10.5, 21.25, 1.5],
    [10.5, 14, 1.25],
    [7.25, 11.25, 2],
    [7.25, 4.75, 3.5],
  ]);
  const earL = rl([[7.25, 6.5], [2.5, 6.5, 2], [2.75, 15, 2.5], [8.25, 12.5]]);
  const earR = flipPath(earL);
  add('elephant-face', ['cara de elefante', 'elefante', 'avatar', 'elephant face', 'elephant', 'kids'], [head, earL, earR, dot(10, 9.25, 0.5), dot(14, 9.25, 0.5)]);
  FILL['elephant-face'] = { solid: [0, shut(earL), shut(earR)], cut: [3, 4] };
  PARTS['elephant-face'] = { head: [0], ears: [1, 2], eyes: [3, 4] };
}
{
  // Pig: a round head, the ears folded over at its top and the big oval snout with two nostrils
  const ear = (x, s) => { const q = from(HEAD, [[x - s * 1, 9], [x - s * 2.75, 2.75, 1], [x + s * 3.5, 5.25]]); q[2] = onPath(HEAD, q[2]); return rl(q); };
  const earL = ear(7.25, 1);
  const earR = flipPath(earL);
  add('pig-face', ['cara de cerdo', 'cerdo', 'cochino', 'pig face', 'pork', 'farm'], [HEAD, earL, earR, ell([12, 15.25], 4.25, 3), dot(10.5, 15.25, 0.3), dot(13.5, 15.25, 0.3), dot(8.75, 10.5, 0.3), dot(15.25, 10.5, 0.3)]);
  FILL['pig-face'] = { solid: [0, shut(earL), shut(earR)], cut: [3, 4, 5, 6, 7] };
  PARTS['pig-face'] = { head: [0], ears: [1, 2], snout: [3, 4, 5], eyes: [6, 7] };
}
{
  // Cow: a long head with short horns, the ears out to its sides and a broad muzzle with two nostrils
  const face = rp([
    [12, 4.75, 0],
    [16.75, 5.25, 2.5],
    [16, 12.75, 1.25],
    [17.5, 15, 2.75],
    [16.75, 20.75, 2.75],
    [7.25, 20.75, 2.75],
    [6.5, 15, 2.75],
    [8, 12.75, 1.25],
    [7.25, 5.25, 2.5],
  ]);
  const muzzleLine = hl(15.25, yAt2(face, 15.25, true), yAt2(face, 15.25, false));
  const earL = rl([onPath(face, [7.5, 7]), [2.25, 8.5, 1.75], onPath(face, [7.75, 12])]);
  const earR = flipPath(earL);
  const hornL = smooth(from(face, [[8.5, 5.25], [7.25, 3.75], [7.75, 2.25]]));
  const hornR = flipPath(hornL);
  add('cow-face', ['cara de vaca', 'res', 'carne de res', 'cow face', 'beef', 'cattle'], [face, earL, earR, hornL, hornR, muzzleLine, dot(10, 18, 0.5), dot(14, 18, 0.5), dot(10.25, 9.75, 0.5), dot(13.75, 9.75, 0.5)]);
  FILL['cow-face'] = { solid: [0, shut(earL), shut(earR)], wire: [3, 4], cut: [5, 6, 7, 8, 9] };
  PARTS['cow-face'] = { head: [0], ears: [1, 2], horns: [3, 4], muzzle: [5, 6, 7], eyes: [8, 9] };
}
{
  // Lion: a round face with its two round ears, its eyes and its nose, framed by the mane, a ring of
  // shallow waves set out far enough for the ears to keep their paper. A face of three dots in a
  // ring of round petals read as a flower or a bowling ball: the ears make it an animal's face
  // The mane's waves are set out at 9.1 and shallow (1 deep) so the ears keep 2.85 from them
  const c = [12, 12.1];
  const mane = `${scallops(c, 9.1, -90, 270, 10, 4.45)}Z`;
  // The face and its ears are one outline, the circle with the two round ears joined to it: an ear
  // drawn on the face as an arc closed a hole of its own at 2.1, and drawn small enough to stay ink
  // it was lost
  const fr = 5;
  const er = 1.1;
  const E = [-128, -52].map((a) => polar(...c, fr + 0.15, a));
  const ang = (p) => (Math.atan2(p[1] - c[1], p[0] - c[0]) * 180) / Math.PI;
  // Each ear meets the face at two points: the outer one (away from the top) and the inner one
  const cut = E.map((e) => meet2([...c, fr], [...e, er]).sort((p, q) => Math.abs(ang(q) + 90) - Math.abs(ang(p) + 90)));
  const [[lo, li], [ro, ri]] = cut;
  const face = `M${pt(ro)}${arcSeg(c, fr, ro, lo, true)}${arcSeg(E[0], er, lo, li, true)}${arcSeg(c, fr, li, ri, true)}${arcSeg(E[1], er, ri, ro, true)}Z`;
  add('lion-face', ['cara de león', 'león', 'melena', 'lion face', 'lion', 'mascot'], [mane, face, dot(10.35, 10.6, 0.5), dot(13.65, 10.6, 0.5), dot(12, 13.5, 0.5)]);
  FILL['lion-face'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['lion-face'] = { mane: [0], face: [1], eyes: [2, 3], nose: [4] };
}
{
  // Tiger: the round cat head with small round ears, a stripe down the forehead and two on each
  // cheek running in from the edge toward the muzzle, eyes and nose. Its stripes of 2.5 were lost at
  // 24 px and the face read as a bowling ball; at 3 long they say tiger
  const ears = roundEars(5.5, 6, 2.25);
  const fore = [12].map((x) => line([x, yAt(HEAD, x, false)], [x, yAt(HEAD, x, false) + 3]));
  // Level and 3 apart, so their ends stay clear of each other at 2.1
  const cheek = [14, 17].flatMap((y) => [line([yAt2(HEAD, y, true), y], [yAt2(HEAD, y, true) + 3, y]), line([yAt2(HEAD, y, false), y], [yAt2(HEAD, y, false) - 3, y])]);
  // The nose is a dot as the eyes are: a small triangle opened and shut a hole between weights
  const nose = dot(12, 14.25, 0.5);
  add('tiger-face', ['cara de tigre', 'tigre', 'rayas', 'tiger face', 'tiger', 'stripes'], [HEAD, ...ears, ...fore, ...cheek, dot(9, 11, 0.5), dot(15, 11, 0.5), nose]);
  FILL['tiger-face'] = { solid: [0, shut(ears[0]), shut(ears[1])], cut: range(3, 11) };
  PARTS['tiger-face'] = { head: [0], ears: [1, 2], stripes: [3, 4, 5, 6, 7], eyes: [8, 9], nose: [10] };
}
{
  // Wolf: tall pointed ears, the cheek fur flaring in a ruff and the face narrowing to a long muzzle
  const head = rp([
    [12, 7.5, 0],
    [15.75, 7, 0.9],
    [18.5, 2.75, 0.6],
    [18.75, 9.5, 1],
    [20.75, 13, 0.4],
    [17.5, 13.5, 0.9],
    [14.25, 19.25, 1.5],
    [9.75, 19.25, 1.5],
    [6.5, 13.5, 0.9],
    [3.25, 13, 0.4],
    [5.25, 9.5, 1],
    [5.5, 2.75, 0.6],
    [8.25, 7, 0.9],
  ]);
  add('wolf-face', ['cara de lobo', 'lobo', 'equipo', 'wolf face', 'wolf', 'team'], [head, dot(9.5, 11.25, 0.5), dot(14.5, 11.25, 0.5), dot(12, 16.75, 0.5)]);
  FILL['wolf-face'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['wolf-face'] = { head: [0], eyes: [1, 2], nose: [3] };
}
{
  // Fox: a triangular face with tall pointed ears, the two cheek tufts sweeping in to meet at the nose
  const head = rp([
    [12, 8.25, 0],
    [15.5, 8, 0.5],
    [19.25, 3.25, 0.6],
    [19, 10, 1],
    [21, 12.75, 0.4],
    [12, 20, 1],
    [3, 12.75, 0.4],
    [5, 10, 1],
    [4.75, 3.25, 0.6],
    [8.5, 8, 0.5],
  ]);
  const tufts = rl([onPath(head, [4, 13]), [9.25, 14, 3], onPath(head, [12, 19.5])]);
  add('fox-face', ['cara de zorro', 'zorro', 'usuario anónimo', 'fox face', 'fox', 'anonymous'], [head, tufts, flipPath(tufts), dot(9.25, 11.25, 0.5), dot(14.75, 11.25, 0.5)]);
  FILL['fox-face'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['fox-face'] = { head: [0], cheeks: [1, 2], eyes: [3, 4] };
}
{
  // Unicorn: the horse's long face from the front, its ears, eyes and nostrils, and the horn rising
  // from the forelock, a slim spike (wider, its hole closed at 2.1)
  const face = rp([
    [12, 7.25, 0],
    [16.75, 7.75, 2.75],
    [16, 13.75, 2],
    [16.75, 21, 2.75],
    [7.25, 21, 2.75],
    [8, 13.75, 2],
    [7.25, 7.75, 2.75],
  ]);
  const horn = rl([onPath(face, [11.4, 7.3]), [12, 1.75, 0.15], onPath(face, [12.6, 7.3])]);
  const bands = [];
  const earL = rl([onPath(face, [7.75, 11.5]), [3.25, 5, 0.6], onPath(face, [10, 7.4])]);
  add('unicorn-face', ['unicornio', 'magia', 'fantasía', 'unicorn face', 'unicorn', 'magic'], [face, horn, ...bands, earL, flipPath(earL), dot(10, 11, 0.5), dot(14, 11, 0.5), dot(10.5, 17.75, 0.5), dot(13.5, 17.75, 0.5)]);
  FILL['unicorn-face'] = { solid: [0, shut(horn), shut(earL), shut(flipPath(earL))], cut: [4, 5, 6, 7] };
  PARTS['unicorn-face'] = { head: [0], horn: [1], ears: [2, 3], eyes: [4, 5], nostrils: [6, 7] };
}

// ── The horses ────────────────────────────────────────────────────────────────────────────────
// One body: a deep barrel on long stroke legs, the neck arched up from the withers to a long head
// carried down at the muzzle, a pointed ear; the mane flows down the neck in two locks and the tail
// falls from the rump. The zebra trims the mane to an upright brush and wears three stripes, the
// donkey is the same horse smaller and stockier with its long ears, the unicorn lifts its head and
// takes the horn.
const HORSE_BACK = [
  [5, 9.5, 2.25],
  [12.5, 9.5, 1.25],
];
const HORSE_FRONT = [
  [15.25, 4.75, 0.5],
  [15.75, 2.75, 0.3],
  [16.75, 4.25, 0.4],
  [17.5, 4.5, 0.6],
  [21.25, 8.25, 0.9],
  [20.5, 9.75, 0.75],
  [18, 8.75, 0.75],
  [16.75, 9.5, 1],
  [16.25, 13.25, 1.75],
  [5.25, 13.5, 2.25],
];
/** The flowing mane: two locks down the back of the neck, from the poll to the withers. */
const MANE = [
  [12.75, 6, 0.4],
  [14, 6.75, 0.5],
  [11, 8.5, 0.4],
];
const HORSE = [...HORSE_BACK.slice(0, 1), [12.5, 9.5, 0.75], ...MANE.slice().reverse(), ...HORSE_FRONT];
const horseLegs = (body) => legs4(body, 6.25, 13);
{
  const body = rp(HORSE);
  const tail = smooth(from(body, [[4.75, 10], [3, 11], [2.5, 14], [3.25, 17.5]]));
  add('horse', ['caballo', 'establo', 'equitación', 'horse', 'stable', 'equestrian'], [body, ...horseLegs(body), tail]);
  FILL.horse = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.horse = { body: [0], legs: [1, 2, 3, 4], tail: [5] };
}
{
  // Galloping: the same horse raised off the ground, the legs stretched fore and aft, the mane and
  // the tail streaming back
  const body = rp(HORSE);
  const legs = [legTo(body, 13.5, [17.75, 19.75]), legTo(body, 15.75, [21.25, 16.5]), legTo(body, 6.25, [2.75, 18]), legTo(body, 9, [6, G])];
  const tail = smooth(from(body, [[4.75, 10], [3, 9.75], [2.25, 8]]));
  add('horse-running', ['caballo galopando', 'carreras', 'velocidad', 'galloping horse', 'horse racing', 'speed'], [body, ...legs, tail]);
  FILL['horse-running'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['horse-running'] = { body: [0], legs: [1, 2, 3, 4], tail: [5] };
}
{
  // The zebra: the horse with its mane cut to an upright brush along the neck and three stripes
  // across the neck and the body
  const body = rp([[5, 9.5, 2.25], [12.5, 9.5, 0.75], [11.25, 8.5, 0.4], [14.25, 3.75, 0.4], ...HORSE_FRONT]);
  const across = (x0, x1) => line([x0, yAt(body, x0, false)], [x1, yAt(body, x1)]);
  const stripes = [across(7.5, 8), across(10.75, 11.25), line([hit(body, [14.5, 7.5], [-1, -0.45])[0], hit(body, [14.5, 7.5], [-1, -0.45])[1]], hit(body, [14.5, 7.5], [1, 0.45]))];
  const tail = smooth(from(body, [[4.75, 10], [3, 11], [2.5, 14], [3.25, 17.5]]));
  add('zebra', ['cebra', 'rayas', 'sabana', 'zebra', 'stripes', 'savanna'], [body, ...horseLegs(body), tail, ...stripes]);
  FILL.zebra = { solid: [0], wire: [1, 2, 3, 4, 5], cut: [6, 7, 8] };
  PARTS.zebra = { body: [0], legs: [1, 2, 3, 4], tail: [5], stripes: [6, 7, 8] };
}
{
  // The donkey: smaller and stockier, its two long ears upright, a short brush mane and a thin tail
  const body = rp([
    [5, 10.75, 2.25],
    [12.25, 10.75, 0.75],
    [11.75, 9.75, 0.6],
    [14.25, 6.75, 0.9],
    [13.75, 2.75, 0.4],
    [15.5, 5.75, 0.9],
    [16.25, 2.75, 0.4],
    [16.75, 6.25, 0.4],
    [17.5, 6.75, 0.6],
    [21.25, 10.25, 1],
    [20.5, 12, 0.75],
    [18, 11, 0.75],
    [16.75, 11.75, 1],
    [16.5, 15.5, 1.75],
    [5.25, 15.5, 2.25],
  ]);
  const legs = legs4(body, 6.5, 12.5);
  const tail = rl(from(body, [[4.75, 11.5], [2.5, 12.5, 1], [2.5, 15.25]]));
  add('donkey', ['burro', 'mula', 'animal de carga', 'donkey', 'mule', 'burro'], [body, ...legs, tail]);
  FILL.donkey = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.donkey = { body: [0], legs: [1, 2, 3, 4], tail: [5] };
}
{
  // The unicorn: the horse with its head raised high on an upright neck and the horn rising from
  // its forehead, a slim spike
  const body = rp([
    [5, 10.25, 2.25],
    [12.75, 10.25, 0.75],
    [11.75, 8.25, 0.4],
    [13, 7.5, 0.5],
    [12, 5.75, 0.4],
    [14, 3.75, 0.5],
    [14.25, 2.25, 0.3],
    [15.25, 3.25, 0.4],
    [16, 3.5, 0.6],
    [19.75, 6.75, 0.9],
    [19, 8.25, 0.75],
    [16.75, 7.5, 0.75],
    [16, 10, 1],
    [16.5, 14, 1.75],
    [5.25, 14.25, 2.25],
  ]);
  const base = [17.25, 4.5];
  const dir = unit([1.6, -1]);
  const nrm = [-dir[1], dir[0]];
  const horn = rl([onPath(body, add2(base, mul(nrm, 0.4))), [...add2(base, mul(dir, 5.5)), 0.15], onPath(body, add2(base, mul(nrm, -0.4)))]);
  const legs = legs4(body, 6.25, 13);
  const tail = smooth(from(body, [[4.75, 10.75], [3, 11.75], [2.5, 14.75], [3.25, 18]]));
  add('unicorn', ['unicornio', 'fantasía', 'magia', 'unicorn', 'fantasy', 'magic'], [body, horn, ...legs, tail]);
  FILL.unicorn = { solid: [0, shut(horn)], wire: [2, 3, 4, 5, 6] };
  PARTS.unicorn = { body: [0], horn: [1], legs: [2, 3, 4, 5], tail: [6] };
}
{
  // The saddle, from the side: the seat dipping between the high cantle and the pommel with its horn,
  // and the stirrup hanging from its leather, slanted forward as it hangs from the seat's side: the
  // iron an arch over its flat tread. A flap under the seat made it a face, and the leather straight
  // down the middle to a trapezoid read as a bar stool on its foot
  const seat = rp([
    [3.25, 4.5, 0.75],
    [5.5, 5.5, 1.5],
    [11, 9, 3.5],
    [16.25, 8.25, 1.25],
    [17.25, 6.5, 0.4],
    [19.5, 6.5, 0.6],
    [18.75, 8, 0.4],
    [20.25, 9.5, 1],
    [19.25, 12, 1],
    [5.5, 12, 1.5],
    [3.5, 8.5, 1.5],
  ]);
  const strap = line([9.75, 12], [12.25, 16.25]);
  // The iron: a round arch of r 2.5 standing on the tread, the leather hanging from its top
  const ic = [12.25, 18.75];
  const stirrup = `M${pt([ic[0] - 2.5, 21])}V${f(ic[1])}${arc(...ic, 2.5, 180, 360).d.replace(/^M[^A]*/, '')}V21Z`;
  add('saddle', ['silla de montar', 'montura', 'equitación', 'saddle', 'riding', 'tack'], [seat, strap, stirrup]);
  FILL.saddle = { solid: [0], wire: [1], lines: [2] };
  PARTS.saddle = { seat: [0], strap: [1], stirrup: [2] };
}

// ── The bovines ───────────────────────────────────────────────────────────────────────────────
// One body: a long box with a straight back, the head carried low and forward with a short horn
// and an ear behind it, the legs short strokes. The cow adds its udder and patches; the bull raises
// a hump and lowers its head under wide horns; the bison and the yak grow their hair.
const COW = [
  [3.75, 8.75, 1.25],
  [14.5, 8.75, 1.5],
  [16.25, 9.25, 0.9],
  [15.75, 7.5, 0.75],
  [17.75, 8.25, 0.9],
  [18.75, 8.25, 1],
  [21.5, 12.25, 1],
  [21.25, 14, 0.75],
  [18.75, 14.25, 1],
  [17.25, 14, 1],
  [17.25, 15.25, 1],
  [12.5, 15.25, 0.6],
  [12, 16.75, 0.6],
  [10.5, 16.75, 0.6],
  [10, 15.25, 0.6],
  [4, 15.25, 1.25],
];
const COW_HORN = smooth([[18.5, 8.5], [19.25, 7.5], [19.75, 5.75]]);
const cowLegs = (body) => legs4(body, 4.75, 14);
{
  const body = rp(COW);
  const patch = rl([[6.75, 8.75], [6.5, 12, 1.5], [10.5, 13, 1.75], [12.5, 8.75]]);
  const tail = rl(from(body, [[3.5, 10.25], [2.5, 11, 0.75], [2.5, 12.75]]));
  const d = [body, COW_HORN, ...cowLegs(body), tail, patch];
  add('cow', ['vaca', 'lechería', 'ganado', 'cow', 'dairy', 'cattle'], d);
  FILL.cow = { solid: [0], wire: [1, 2, 3, 4, 5, 6], cut: [7] };
  PARTS.cow = { body: [0], horn: [1], legs: [2, 3, 4, 5], tail: [6], patch: [7] };
  // With a badge the cow steps back up and left, smaller, so the badge takes only its front feet
  const k = 0.84;
  const A = [10.5, 17.75];
  const X = (q) => xp(q, k, [12, G], A);
  const s = (q) => xf(q, k, [12, G], A);
  const small = rp(COW.map(([x, y, r]) => [...X([x, y]), Math.max(r * k, 0.75)]));
  const sd = [small, s(COW_HORN), ...legs4(small, 4.75, 12, 17.75), line(onPath(small, X([3.5, 10.5])), X([2.25, 13])), s(patch)];
  for (const [name, kind, tags] of [
    ['cow-plus', 'plus', ['agregar animal', 'alta en el hato', 'registro de ganado', 'add animal', 'add to herd', 'livestock register']],
    ['cow-alert', 'alert', ['animal enfermo', 'revisión veterinaria', 'alerta de ganado', 'sick animal', 'animal health alert', 'missed check']],
  ]) {
    add(name, tags, sd, { badge: badge(kind) });
    FILL[name] = FILL.cow;
    PARTS[name] = PARTS.cow;
  }
}
{
  // The bull: the bovine body heavier in front, a hump over the shoulders, the head lowered and the
  // wide horns pointing forward; no udder
  // (on the cow's rump, belly, legs and tail), the head dropped below the belly to charge. A tail
  // raised behind answered the horn and read as a cat's ears
  const body = rp([
    [3.75, 8.75, 1.25],
    [10.5, 8.5, 2],
    [14, 6.25, 2],
    [17.5, 9.5, 0.75],
    [21.25, 15.25, 0.75],
    [20.5, 16.75, 0.6],
    [18.5, 16.75, 0.75],
    [16.75, 15.25, 0.75],
    [4, 15.25, 1.25],
  ]);
  const horns = smooth(from(body, [[17.6, 9.6], [20.25, 9.25], [21.5, 7.25]]));
  const legs = cowLegs(body);
  const tail = rl(from(body, [[3.5, 10.25], [2.5, 11, 0.75], [2.5, 12.75]]));
  add('bull', ['toro', 'rodeo', 'fuerza', 'bull', 'rodeo', 'strength'], [body, horns, ...legs, tail]);
  FILL.bull = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS.bull = { body: [0], horns: [1], legs: [2, 3, 4, 5], tail: [6] };
}

{
  // The bison: the cow's hindquarters and belly, the back climbing from them in a straight slope to
  // a huge hump over the shoulders that falls sheer in front, the head hanging below it, its face
  // near upright, and the beard under the chin; the horn hooks up from the brow. Heavy, it stands on
  // legs drawn into the outline, as the bears and the rhino do. A rounded hump on a level belly over
  // stroke legs read as a cloud raining, and the stroke legs still did at 18 px: the slope, the sheer
  // front, the low head and the solid legs are what say bison
  const body = rp([
    [3.75, 11.25, 1.25],
    [10.75, 6.25, 2],
    [13.25, 4.25, 1.75],
    [15.75, 5.75, 1.25],
    [17.25, 9.5, 0.75],
    [20.25, 11, 0.75],
    [21.5, 15.75, 0.75],
    [20.5, 16.75, 0.6],
    [19.5, 16.75, 0.6],
    [18.25, 18.75, 0.6],
    [15.75, 15.75, 0.75],
    [15.5, G, 0.5],
    [12.5, G, 0.5],
    [12.25, 15.75, 0.75],
    [7.75, 15.75, 0.75],
    [7.5, G, 0.5],
    [4.25, G, 0.5],
    [3.25, 14.5, 1.5],
  ]);
  const horn = smooth(from(body, [[18.6, 10.15], [19.5, 8.75], [19.25, 7.25]]));
  add('bison', ['bisonte', 'búfalo', 'pradera', 'bison', 'buffalo', 'prairie'], [body, horn]);
  FILL.bison = { solid: [0], wire: [1] };
  PARTS.bison = { body: [0], horn: [1] };
}
{
  // The yak: the cow's body and legs under a hump and a long skirt of hair that hangs nearly to its
  // knees, its hem cut in pointed locks, the legs running on down from the tips of four of them, the
  // horn hooking up and forward. A hem of round scallops read as a tub on its feet; strands cut up
  // into a level hem read as more legs inside the body; legs out of the notches between the locks
  // left their outline no clean way between weights
  const locks = [];
  for (let x = 18.55; x > 4; x -= 3.1) locks.push([x, 16.75, 0.75], [x - 1.55, 18.25, 0.3, 'tip']);
  const body = rp([
    [3.75, 8.75, 1.25],
    [10.5, 8.5, 2],
    [14, 6.5, 2],
    [17.25, 8.75, 0.75],
    [21.25, 12.75, 0.75],
    [20.75, 14.25, 0.6],
    [18.75, 14.5, 0.75],
    ...locks,
    [3, 16.75, 0.75],
    [2.75, 12.5, 1.25],
  ]);
  const horn = smooth(from(body, [[17.9, 9.4], [19.25, 7.75], [18.75, 5.75]]));
  const legs = [17, 13.9, 7.7, 4.6].map((x) => vl(x, 18.25, G));
  add('yak', ['yak', 'himalaya', 'altura', 'yak', 'himalayas', 'yak shaving'], [body, horn, ...legs]);
  FILL.yak = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.yak = { body: [0], horn: [1], legs: [2, 3, 4, 5] };
}
{
  // The cattle skull, from the front: a long face tapering to the snout, two eye holes, the nose
  // holes, and the horns sweeping out and up from its brow
  const skull = rp([
    [12, 6, 0],
    [17.25, 6.25, 1.5],
    [17.25, 10.5, 1.5],
    [14.25, 13.75, 1.75],
    [14, 20.75, 1.5],
    [10, 20.75, 1.5],
    [9.75, 13.75, 1.75],
    [6.75, 10.5, 1.5],
    [6.75, 6.25, 1.5],
  ]);
  const eye = dot(9.75, 9.25);
  const eyeR = dot(14.25, 9.25);
  const hornL = rl([onPath(skull, [6.75, 7.5]), [4.25, 7.25, 2], [2.75, 3.25]]);
  add('cow-skull', ['calavera de vaca', 'cráneo', 'desierto', 'cow skull', 'cattle skull', 'old west'], [skull, eye, eyeR, hornL, flipPath(hornL)]);
  FILL['cow-skull'] = { solid: [0], cut: [1, 2], wire: [3, 4] };
  PARTS['cow-skull'] = { skull: [0], eyes: [1, 2], horns: [3, 4] };
}

// ── Sheep and goats ───────────────────────────────────────────────────────────────────────────
// The sheep is a cloud of wool, its outline in scallops, with a small smooth head at the front and
// thin legs. The goats share a lean body on thin legs, a beard and horns that sweep back.
const WOOL = { c: [10.25, 11.25], rx: 6.75, ry: 4.25 };
/** The sheep's outline: the wool from the top of the head around the back to under the chin, then the head. */
function sheep(head = [[18.25, 7.25, 1.25], [21.5, 10.75, 1], [20.75, 12.75, 0.75], [18.5, 13, 0.5]]) {
  const { c, rx, ry } = WOOL;
  const [a0, a1] = [-40, -330];
  const A = onE(c, rx, ry, a0);
  const B = onE(c, rx, ry, a1);
  return `${scallopsE(c, rx, ry, a0, a1, 11, 1.6)}${rl([B, ...head, A]).replace(/^M[^L]*/, '')}Z`;
}
const sheepLegs = (body) => legs4(body, 6.25, 12.25);
{
  const body = sheep();
  add('sheep', ['oveja', 'lana', 'rebaño', 'sheep', 'wool', 'flock'], [body, ...sheepLegs(body)]);
  FILL.sheep = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS.sheep = { body: [0], legs: [1, 2, 3, 4] };
}
{
  // Jumping: the sheep in the air over a short fence of two posts and two rails, its legs tucked
  const at = [11.5, 6.75];
  const s = 0.72;
  const body = xf(sheep(), s, [12, 11.25], at);
  const legs = [[7, [4.75, 11.75]], [9.25, [7.5, 13.25]], [13.25, [15.25, 13]], [15.25, [18.25, 11.75]]].map(([x, b]) => line([x, yAt(body, x)], b));
  // The rails run on past the posts, as a fence's do: closed between them they read as a box
  const fence = [vl(8.5, 16.25, 21.25), vl(15.5, 16.25, 21.25), hl(17.25, 4.75, 19.25), hl(20.25, 4.75, 19.25)];
  add('sheep-jumping', ['contar ovejas', 'dormir', 'insomnio', 'counting sheep', 'bedtime', 'insomnia'], [body, ...legs, ...fence]);
  FILL['sheep-jumping'] = { solid: [0], wire: [1, 2, 3, 4], lines: [5, 6, 7, 8] };
  PARTS['sheep-jumping'] = { body: [0], legs: [1, 2, 3, 4], fence: [5, 6, 7, 8] };
}
const GOAT = [
  [4.75, 10.5, 1.25],
  [13.5, 10.25, 1.5],
  [15.25, 8.25, 0.75],
  [16.75, 6.25, 0.75],
  [18, 6.25, 0.6],
  [21, 9.75, 0.75],
  [20.25, 10.75, 0.5],
  [18.75, 10.75, 0.4],
  [18.5, 13.25, 0.3],
  [17.25, 11.5, 0.5],
  [16.5, 14.5, 1.25],
  [5, 14.5, 1.25],
];
const GOAT_HORN = smooth([[16.75, 6.5], [15.75, 4], [13.25, 3.25]]);
{
  const body = rp(GOAT);
  const legs = legs4(body, 6.25, 12.75);
  const tail = line(onPath(body, [4.75, 11]), [3, 8.75]);
  add('goat', ['cabra', 'chivo', 'granja', 'goat', 'dairy goat', 'farm'], [body, GOAT_HORN, ...legs, tail]);
  FILL.goat = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS.goat = { body: [0], horn: [1], legs: [2, 3, 4, 5], tail: [6] };
}

// ── Pigs ──────────────────────────────────────────────────────────────────────────────────────
// A round barrel of a body running into the head, the snout ending flat in its disc, the ear
// folded forward, short legs and the tail curled; the boar is the same family lean and bristled.
{
  const body = rp([
    [3.25, 12.5, 4],
    [9.5, 8, 5],
    [15, 8.5, 2],
    [15.5, 7.5, 0.3],
    [18, 6, 0.3],
    [17.75, 9.25, 0.4],
    [19, 11, 0.4],
    [21.5, 11, 0.4],
    [21.5, 13.75, 0.4],
    [19, 14, 0.5],
    [17.5, 15.25, 1.25],
    [11, 16.5, 3.5],
    [3.75, 15.75, 2.5],
  ]);
  const legs = legs4(body, 6, 13.5);
  const t0 = onPath(body, [3.5, 11.25]);
  const tail = `M${pt(t0)}C1.75 10.75 2 7.75 3.5 8S3.75 9.75 2.75 9.25`;
  add('pig', ['cerdo', 'cochino', 'granja', 'pig', 'pork', 'farm'], [body, ...legs, tail]);
  FILL.pig = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.pig = { body: [0], legs: [1, 2, 3, 4], tail: [5] };
}
{
  // The boar: the pig's family made front-heavy and angular, as the wild boar stands: the back a
  // straight slope from the shoulders down to a small rump, two bristles on the ridge, the pointed
  // ear, and the long head running straight down to the snout's flat disc below the belly line,
  // a tusk curving forward under it; the pig's legs, the tail straight. A ridge of bristles from the
  // neck to the rump over a level belly read as a cloud, with or without the pig's round head
  const body = rp([
    [3.25, 12.75, 2],
    [8.5, 10, 2],
    [9.75, 7.25, 0.3, 'tip'],
    [11.25, 9, 0.6],
    [12.5, 6.25, 0.3, 'tip'],
    [13.75, 8.5, 0.6],
    [15, 6.5, 0.3, 'tip'],
    [15.75, 8.75, 0.6],
    [17.75, 6.25, 0.3, 'tip'],
    [17.75, 9.75, 0.4],
    [19, 11.25, 0.4],
    [21.5, 11.25, 0.4],
    [21.5, 13.75, 0.4],
    [19, 14, 0.5],
    [17.5, 15.25, 1.25],
    [11, 16.25, 3],
    [3.75, 15.75, 2],
  ]);
  const tusk = smooth(from(body, [[19.75, 14], [20.25, 15.5], [21.75, 16.25]]));
  const legs = legs4(body, 6, 13.5);
  const tail = line(onPath(body, [3.4, 13.25]), [2.25, 15.75]);
  add('boar', ['jabalí', 'cerdo salvaje', 'bosque', 'wild boar', 'boar', 'wildlife'], [body, tusk, ...legs, tail]);
  FILL.boar = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS.boar = { body: [0], tusk: [1], legs: [2, 3, 4, 5], tail: [6] };
}

// ── Deer and antelopes ────────────────────────────────────────────────────────────────────────
// One body: lean and long-legged, the head raised on a slim neck, a big ear laid back and a short
// tail. The stag carries branched antlers (a beam and its tines), the moose broad palms, the
// reindeer tall sweeping antlers with a brow tine; the fawn has none and wears its spots.
const DEER = [
  [5, 10.25, 1.75],
  [13, 10, 1.5],
  [15, 7.5, 0.6],
  [13.25, 5.75, 0.3],
  [15.75, 6, 0.5],
  [16.75, 5.5, 0.6],
  [20.5, 7.75, 0.6],
  [20, 8.75, 0.5],
  [17.25, 8.5, 0.6],
  [16.75, 10.25, 0.75],
  [16.25, 13.75, 1.5],
  [5.5, 13.75, 1.75],
];
const deerLegs = (body) => legs4(body, 6.5, 12.75);
/** The stag's antlers: a beam sweeping up and back from the head and a tine off it. */
function antlers(base, s = 1) {
  const P = (x, y) => [base[0] + x * s, base[1] + y * s];
  const beam = smooth([P(0, 0), P(-0.5, -2.25), P(-2.25, -3.75), P(-4.5, -4)]);
  const tine = line(P(-0.45, -1.9), P(1.5, -3.75));
  return [beam, tine];
}
{
  const body = rp(DEER);
  const tail = line(onPath(body, [5, 10.75]), [3, 9.25]);
  add('deer', ['venado', 'ciervo', 'bosque', 'deer', 'stag', 'forest'], [body, ...antlers([16.75, 5.75], 0.8), ...deerLegs(body), tail]);
  FILL.deer = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7] };
  PARTS.deer = { body: [0], antlers: [1, 2], legs: [3, 4, 5, 6], tail: [7] };
}
{
  // The fawn: a young deer, its legs long for its body, big ears and no antlers, spots on its back
  const body = rp([
    [6.25, 9.25, 1.75],
    [13.25, 9, 1.75],
    [15.25, 7, 0.6],
    [13.25, 4.25, 0.4],
    [16, 5.5, 0.9],
    [17, 4.75, 0.6],
    [20.5, 7.25, 0.6],
    [20, 8.25, 0.5],
    [17.5, 8.25, 0.6],
    [17, 10, 0.75],
    [16.5, 14.75, 1.75],
    [6.5, 14.75, 1.75],
  ]);
  const legs = legs4(body, 7, 13.25);
  const tail = line(onPath(body, [6.25, 10.5]), [4, 9]);
  const spots = [9, 12].map((x) => dot(x, (yAt(body, x, false) + yAt(body, x)) / 2, 0.3));
  add('fawn', ['cervatillo', 'cría de venado', 'primavera', 'fawn', 'baby deer', 'spring'], [body, ...legs, tail, ...spots]);
  FILL.fawn = { solid: [0], wire: [1, 2, 3, 4, 5], cut: [6, 7] };
  PARTS.fawn = { body: [0], legs: [1, 2, 3, 4], tail: [5], spots: [6, 7] };
}
{
  // The moose: the deer heavier, a hump over the shoulders, a long drooping muzzle with the bell
  // hanging under the throat, and a broad palm of antler with its points
  const body = rp([
    [4.75, 11.25, 1.75],
    [9.5, 10.25, 2.5],
    [13, 8.25, 2.5],
    [15.75, 9.25, 0.75],
    [17, 8.75, 0.6],
    [20.25, 10.25, 0.75],
    [21.25, 13.25, 0.6],
    [20, 13.75, 0.5],
    [18.25, 12.75, 0.4],
    [17.5, 15.75, 0.4],
    [16.5, 13.5, 0.4],
    [16.25, 15.25, 1],
    [5, 15, 1.75],
  ]);
  const palm = rl([
    [15.5, yAt(body, 15.5, false)],
    [11.75, 7.25, 1],
    [10.5, 4.25, 0.3],
    [12.25, 5.25, 0.3],
    [12.75, 3, 0.3],
    [14, 5, 0.3],
    [15, 2.75, 0.3],
    [15.75, 5, 0.3],
    [17.25, 3.5, 0.3],
    [17.5, yAt(body, 17.5, false)],
  ]);
  const legs = legs4(body, 6.25, 12.75);
  add('moose', ['alce', 'bosque boreal', 'canadá', 'moose', 'elk', 'northern forest'], [body, palm, ...legs]);
  FILL.moose = { solid: [0, shut(palm)], wire: [2, 3, 4, 5] };
  PARTS.moose = { body: [0], antlers: [1], legs: [2, 3, 4, 5] };
}
{
  // The reindeer: a stockier deer with a shaggy ruff down its throat, its tall antlers sweeping back
  // with a brow tine reaching forward over the face
  const body = rp([
    [5, 10.75, 1.75],
    [13, 10.25, 1.5],
    [15, 8, 0.6],
    [13.5, 6.75, 0.3],
    [15.75, 6.75, 0.5],
    [16.75, 6.25, 0.6],
    [20.5, 8.25, 0.6],
    [20, 9.25, 0.5],
    [17.5, 9.25, 0.6],
    [17.75, 11.75, 0.6],
    [16.5, 12, 0.9],
    [16.25, 14.25, 1.25],
    [5.5, 14.25, 1.75],
  ]);
  const beam = smooth([[16.5, 6.5], [15, 4.25], [12.5, 3], [10.5, 3.75]]);
  const brow = rl([onPath(beam, [16.1, 5.85]), [18.25, 4.25, 0.5], [19.75, 4.25]]);
  const tines = [line(onPath(beam, [14.6, 3.95]), [15.75, 2.25])];
  const legs = legs4(body, 6.5, 12.75);
  const tail = line(onPath(body, [5, 11.25]), [3, 9.75]);
  add('reindeer', ['reno', 'caribú', 'navidad', 'reindeer', 'caribou', 'christmas'], [body, beam, brow, ...tines, ...legs, tail]);
  FILL.reindeer = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7, 8] };
  PARTS.reindeer = { body: [0], antlers: [1, 2, 3], legs: [4, 5, 6, 7], tail: [8] };
}
{
  // The gazelle in mid-leap: a slim antelope off the ground, its legs tucked under it and its
  // lyre-shaped horns curving back
  const body = rp([
    [5.25, 9.75, 1.5],
    [13, 9.25, 1.5],
    [15.25, 6.75, 0.6],
    [16.75, 5, 0.6],
    [20.75, 7, 0.6],
    [20.5, 8.75, 0.5],
    [18, 8.75, 0.6],
    [17.25, 10.25, 0.75],
    [16.25, 13, 1.25],
    [5.75, 13, 1.5],
  ]);
  const horns = smooth([[16.75, 5.25], [16, 2.75], [14, 2.25], [13.25, 3.25]]);
  // The hind pair stretched straight back and the front pair folded, knees forward and shins hanging
  // straight down, each pair 3 apart: four legs bent every which way tangled into a knot, and a hoof
  // folded back under the other leg's knee ran into it at 2.1
  const legs = [
    line([6.5, yAt(body, 6.5)], [2.75, 17.25]),
    line([9.5, yAt(body, 9.5)], [5.75, 18.25]),
    rl([[12.75, yAt(body, 12.75)], [14.75, 15.75, 0.75], [14.75, 17.75]]),
    rl([[15.75, yAt(body, 15.75)], [17.75, 15.75, 0.75], [17.75, 17.75]]),
  ];
  const tail = line(onPath(body, [5.25, 10.25]), [3.25, 9]);
  add('gazelle', ['gacela', 'antílope', 'salto', 'gazelle', 'antelope', 'leap'], [body, horns, ...legs, tail]);
  FILL.gazelle = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS.gazelle = { body: [0], horns: [1], legs: [2, 3, 4, 5], tail: [6] };
}

// ── Camels and llamas ─────────────────────────────────────────────────────────────────────────
// One body on long legs, its neck curving down from the shoulders and up again to the head; the
// dromedary has one hump, the Bactrian two. The llama stands its neck upright.
const camelBody = (humps) =>
  rp([
    [4.5, 11.25, 1.5],
    ...humps,
    [13.75, 10.25, 1],
    [15.75, 11.25, 1],
    [17.25, 7.5, 1],
    [18.5, 6.75, 0.6],
    [21.25, 7.75, 0.6],
    [21.25, 9.25, 0.5],
    [19, 9.5, 0.6],
    [18.25, 11.5, 0.75],
    [17, 14.5, 1],
    [5, 14.5, 1.5],
  ]);
const camelLegs = (body) => legs4(body, 6, 13.25);
{
  const body = camelBody([[9.75, 4.5, 3.75]]);
  const tail = line(onPath(body, [4.5, 11.75]), [2.75, 14.5]);
  add('camel', ['camello', 'dromedario', 'desierto', 'camel', 'dromedary', 'desert'], [body, ...camelLegs(body), tail]);
  FILL.camel = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.camel = { body: [0], legs: [1, 2, 3, 4], tail: [5] };
}
{
  const body = camelBody([[7, 6, 2], [9.25, 10, 0.75], [11.75, 6, 2]]);
  const tail = line(onPath(body, [4.5, 11.75]), [2.75, 14.5]);
  add('camel-bactrian', ['camello bactriano', 'dos jorobas', 'estepa', 'bactrian camel', 'two humps', 'steppe'], [body, ...camelLegs(body), tail]);
  FILL['camel-bactrian'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['camel-bactrian'] = { body: [0], legs: [1, 2, 3, 4], tail: [5] };
}
{
  // The llama: a woolly body, its long neck held upright and two tall ears curved like bananas
  const body = rp([
    [5, 10.5, 2],
    [12.75, 10.5, 1],
    [13.25, 6.25, 0.6],
    [12.5, 2.75, 0.4],
    [14.25, 4.5, 0.3],
    [15, 2.5, 0.4],
    [15.75, 4.75, 0.5],
    [19.25, 6, 0.6],
    [19, 7.5, 0.5],
    [16.5, 7.75, 0.5],
    [16.25, 11, 1],
    [16.25, 15.25, 1.75],
    [5.25, 15.25, 2],
  ]);
  const legs = legs4(body, 6.25, 12.25);
  const tail = line(onPath(body, [5, 11]), [3.25, 10]);
  add('llama', ['llama', 'alpaca', 'andes', 'lana', 'wool', 'pack animal'], [body, ...legs, tail]);
  FILL.llama = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.llama = { body: [0], legs: [1, 2, 3, 4], tail: [5] };
}

// ── The giants ────────────────────────────────────────────────────────────────────────────────
{
  // The giraffe: its back sloping from the withers to the rump, the long neck up to the head with its
  // two ossicones, long legs, and two patches on the body
  const body = rp([
    [4.5, 12.25, 1.5],
    [12.25, 10.25, 1.5],
    [16.25, 4, 0.6],
    [16.5, 2.75, 0.4],
    [17.75, 3.25, 0.4],
    [20.75, 4.75, 0.6],
    [20.5, 6, 0.5],
    [18.25, 6, 0.5],
    [15.25, 11, 1],
    [15, 15.75, 1.5],
    [4.75, 15.75, 1.5],
  ]);
  const legs = legs4(body, 5.75, 11.75);
  const net = (x0, n, x1) => rl([[x0, yAt(body, x0, false)], [n[0], n[1], 0], [x1, yAt(body, x1)]]);
  const patches = [net(8.25, [8.75, 13.5], 7.75), net(11, [10.75, 13.25], 11.25)];
  const tail = line(onPath(body, [4.5, 12.75]), [2.5, 15]);
  add('giraffe', ['jirafa', 'sabana', 'zoológico', 'giraffe', 'savanna', 'zoo'], [body, ...legs, tail, ...patches]);
  FILL.giraffe = { solid: [0], wire: [1, 2, 3, 4, 5], cut: [6, 7] };
  PARTS.giraffe = { body: [0], legs: [1, 2, 3, 4], tail: [5], patches: [6, 7] };
}
{
  // The elephant: a domed back and head, the trunk curling down at the front, the ear flap laid on the
  // head and its legs drawn into the outline (a tusk had no room between the trunk and the leg)
  const body = rp([
    [4, 10, 3],
    [10, 5.75, 4],
    [15.75, 5.5, 2.5],
    [18.75, 7.5, 1.5],
    [19.75, 10.75, 1],
    [20.5, 16.25, 1],
    [21.75, 18.25, 0.5],
    [19.75, 18.75, 0.5],
    [18.5, 15.5, 0.9],
    [17.25, 13.25, 0.9],
    [16.25, 13.75, 0.75],
    [16.25, G, 0.5],
    [13, G, 0.5],
    [13, 15.75, 0.75],
    [8.25, 15.75, 0.75],
    [8.25, G, 0.5],
    [4.75, G, 0.5],
    [3.25, 14, 2],
  ]);
  const ear = rl([[12.5, yAt(body, 12.5, false)], [12, 11.25, 2], [13.75, 13, 1.25], [16.25, 12.75]]);
  add('elephant', ['elefante', 'memoria', 'carga pesada', 'elephant', 'memory', 'heavy load'], [body, ear]);
  FILL.elephant = { solid: [0], cut: [1] };
  PARTS.elephant = { body: [0], ear: [1] };
}

{
  // The mammoth: the elephant with a domed head over a back that slopes down from a hump, a shaggy
  // fringe along its belly and long tusks curving forward and up (a piece on top: the trunk is
  // cleared under them)
  const body = rp([
    [4, 11.5, 2.5],
    [9, 7.75, 3],
    [12.5, 5.75, 2.5],
    [14.25, 6.75, 1.5],
    [16.25, 3.75, 2],
    [19, 5.75, 1.5],
    [19.75, 9.75, 1],
    [20.5, 16.5, 1],
    [18.25, 16.5, 1],
    [17.75, 13.75, 0.75],
    [16.75, 13.75, 0.6],
    [16.75, G, 0.5],
    [13.5, G, 0.5],
    [13.5, 16.75, 0.3],
    [12.25, 15.5, 0.3],
    [11, 16.75, 0.3],
    [9.75, 15.5, 0.3],
    [8.5, 16.75, 0.3],
    [8.5, G, 0.5],
    [4.75, G, 0.5],
    [3.25, 14.5, 2],
  ]);
  const tusk = tube([[17.75, 12.75], [18.25, 16.75], [20.25, 18], [21.5, 15.25]], 0.5).d;
  add('mammoth', ['mamut', 'prehistoria', 'extinción', 'mammoth', 'woolly mammoth', 'prehistoric'], [body], { badge: piece([tusk]) });
  FILL.mammoth = { solid: [0] };
  PARTS.mammoth = { body: [0] };
}
{
  // The hippo: a barrel of a body on short legs, a huge square muzzle and tiny ears, standing in the
  // water to its knees (the water line runs on past it)
  const body = rp([
    [4, 11.25, 3],
    [10, 7.75, 4],
    [14.75, 8.25, 2],
    [15.25, 8, 0.6],
    [16.25, 6, 0.6],
    [17.5, 7.75, 0.6],
    [18.25, 8.25, 0.6],
    [19, 9.75, 0.5],
    [21.5, 10, 0.75],
    [21.5, 14.75, 1],
    [18, 15, 1],
    [16.75, 15.5, 0.5],
    [16.75, 17.75, 0.5],
    [13.75, 17.75, 0.5],
    [13.75, 14.75, 0.75],
    [8.25, 14.75, 0.75],
    [8.25, 17.75, 0.5],
    [4.75, 17.75, 0.5],
    [3.25, 14.25, 2],
  ]);
  const water = `M2.25 17.75H21.75`;
  add('hippo', ['hipopótamo', 'río', 'áfrica', 'hippo', 'hippopotamus', 'river'], [body, water]);
  FILL.hippo = { solid: [0], wire: [1] };
  PARTS.hippo = { body: [0], water: [1] };
}
{
  // The rhino: heavy and low, its legs drawn in, a small ear, the head carried low, and the two horns
  // rising from the snout, the front one tall and curving back (as spikes rounded to 0.6 they were
  // cut down to bumps and the rhino read as a bear)
  const body = rp([
    [4, 10.75, 3],
    [10, 7.75, 3.5],
    [14.25, 8, 2],
    [15.25, 7.75, 0.3],
    [15.5, 6, 0.4],
    [16.5, 7.75, 0.3],
    [17.5, 9, 0.75],
    [17.75, 9.25, 0.6],
    [18.25, 7.5, 0.3, 'tip'],
    [19.25, 9.75, 1],
    [20.75, 4.25, 0.3, 'tip'],
    [21.75, 11.75, 0.6],
    [21.25, 13.5, 0.5],
    [18.5, 14, 1],
    [17, 14.75, 0.6],
    [17, G, 0.5],
    [14, G, 0.5],
    [14, 16, 0.75],
    [8.25, 16, 0.75],
    [8.25, G, 0.5],
    [4.5, G, 0.5],
    [3.25, 14, 2],
  ]);
  add('rhino', ['rinoceronte', 'especie en peligro', 'sabana', 'rhino', 'rhinoceros', 'endangered'], [body]);
  FILL.rhino = { solid: [0] };
  PARTS.rhino = { body: [0] };
}
{
  // The kangaroo standing up on its big hind leg and long foot, the thick tail curving out behind
  // it to the ground as a third leg, small forelegs at the chest, the tall ear up. The back rises
  // upright from a corner at the rump where the tail leaves it: run from the ear to the tail's tip
  // in one straight edge, it read as a triangle
  const body = rp([
    [12.25, 2.5, 0.4, 'tip'],
    [14.5, 4.75, 0.6],
    [16.5, 4.5, 1],
    [19.25, 6.25, 0.6],
    [18.75, 7.5, 0.5],
    [16.5, 8, 0.6],
    [16.5, 9.75, 0.6],
    [18.75, 10.75, 0.4, 'tip'],
    [16.5, 11.75, 0.6],
    [16.5, 14.5, 2],
    [14.25, 17.25, 1],
    [19, 18.5, 0.6],
    [19.25, G, 0.5],
    [10.75, G, 1],
    [6.5, 19.5, 2],
    [2.25, 19.75, 0.4, 'tip'],
    [6.5, 17.25, 2],
    [9.5, 15, 1.5],
    [10, 9.75, 3],
    [12.75, 6.25, 0.6],
  ]);
  add('kangaroo', ['canguro', 'australia', 'salto', 'kangaroo', 'wallaby', 'hop'], [body]);
  FILL.kangaroo = { solid: [0] };
  PARTS.kangaroo = { body: [0] };
}

// ── Monkeys and apes ──────────────────────────────────────────────────────────────────────────
{
  // The monkey, sitting in profile: a round head with its ear standing out behind and its muzzle,
  // the knees drawn up, and the long tail curled into a spiral on the ground
  const body = rp([
    [10.75, 8.5, 1],
    [9, 7.25, 0.3],
    [8.75, 5, 1],
    [10.5, 4.5, 0.3],
    [12, 2.75, 2],
    [16, 3.25, 2],
    [17.5, 5.75, 0.75],
    [19.25, 6.75, 0.75],
    [18.5, 8.75, 0.75],
    [15.75, 9.25, 0.75],
    [16.5, 12, 1.5],
    [18.25, 15.5, 1.25],
    [16.75, G, 0.75],
    [9, G, 1.5],
    [7.75, 14.5, 3],
  ]);
  const tail = smooth(from(body, [[8.5, 19.75], [4.75, 19.75], [2.75, 17], [3.75, 14.25], [6, 14.5]]));
  add('monkey', ['mono', 'chango', 'travesura', 'monkey', 'mischief', 'zoo'], [body, tail]);
  FILL.monkey = { solid: [0], wire: [1] };
  PARTS.monkey = { body: [0], tail: [1] };
}

// ── Bears of the bamboo and the eucalyptus ───────────────────────────────────────────────────────
{
  // The panda sitting up, from the front: a round head with its ears and its dark eye patches (solid,
  // as dots: outlined they closed at 2.1 in a head this size) over a round body, the bamboo beside it
  const head = circ(11, 7.75, 5);
  const ears = [outerArc([11, 7.75], 5, [6.75, 4.25], 2.25), outerArc([11, 7.75], 5, [15.25, 4.25], 2.25)];
  const patches = [dot(9, 8.25), dot(13, 8.25)];
  const [b0, b1] = [polar(11, 7.75, 5, 140), polar(11, 7.75, 5, 40)];
  const body = rl([b0, [5.25, 14.5, 3], [5.75, G, 1.5], [16.25, G, 1.5], [16.75, 14.5, 3], b1]);
  const stalk = vl(19.75, 7.5, 21.25);
  add('panda', ['panda', 'bambú', 'conservación', 'panda', 'bamboo', 'giant panda'], [head, ...ears, body, stalk, ...patches]);
  FILL.panda = { solid: [0, shut(ears[0]), shut(ears[1]), shut(body)], lines: [4], cut: [5, 6] };
  PARTS.panda = { head: [0], ears: [1, 2], body: [3], bamboo: [4], patches: [5, 6] };
}

{
  // The koala clinging to a trunk: its big round ear, a large oval nose, the body hugging the trunk
  // and its arm reaching round it
  const trunk = [vl(18.75, 2.25, 21.75), vl(21.75, 2.25, 21.75)];
  const head = circ(12.25, 8, 4);
  const ear = outerArc([12.25, 8], 4, [8.5, 5.25], 2.5);
  const nose = dot(15.5, 9, 1);
  const [b0, b1] = [polar(12.25, 8, 4, 115), polar(12.25, 8, 4, 70)];
  const body = rl([b0, [7.5, 15.5, 3.5], [10.75, 19.75, 2], [15.5, 18.25, 1.5], [18.75, 18.25]]);
  const arm = line(onPath(body, [13.75, 13.75]), [18.75, 12.75]);
  add('koala', ['koala', 'australia', 'eucalipto', 'koala', 'australia', 'eucalyptus'], [...trunk, head, ear, nose, body, arm, dot(12, 7.25)]);
  FILL.koala = { solid: [2, shut(ear), shut(body)], wire: [0, 1, 6], cut: [4, 7] };
  PARTS.koala = { trunk: [0, 1], head: [2], ear: [3], nose: [4], body: [5], arm: [6], eye: [7] };
}
{
  // The platypus: a flat body between a broad paddle tail and the duck bill, webbed feet under it
  const body = rp([
    [6.75, 12.25, 2],
    [11.75, 10.25, 3],
    [15.75, 11, 1.5],
    [17, 11.75, 0.9],
    [21.5, 11, 0.9],
    [21.5, 14.25, 0.9],
    [17, 13.75, 0.9],
    [15.75, 15, 0.75],
    [15.75, 17.25, 0.3],
    [12.75, 17.25, 0.3],
    [13, 15.75, 0.4],
    [10.5, 15.75, 0.4],
    [10.75, 17.25, 0.3],
    [7.75, 17.25, 0.3],
    [7.25, 15.25, 1],
    [6.25, 15, 0.3],
    [2.25, 16, 1.5],
    [2.25, 12, 1.5],
    [6.25, 13, 0.3],
  ]);
  const bill = line([17.25, yAt(body, 17.25, false)], [17.25, yAt(body, 17.25)]);
  const billCut = line([17.25, yAt(body, 17.25, false) - 0.75], [17.25, yAt(body, 17.25) + 0.75]);
  add('platypus', ['ornitorrinco', 'australia', 'pico de pato', 'platypus', 'duck-billed', 'australia'], [body, bill, dot(15, 12, 0.5)]);
  FILL.platypus = { solid: [0], cut: [billCut, 2] };
  PARTS.platypus = { body: [0], bill: [1], eye: [2] };
}
{
  // The armadillo: a domed shell banded across, a small pointed head and the tapering tail
  const shell = rp([
    [5, 15.5, 1],
    [6.75, 9.75, 3.5],
    [12, 7.75, 4],
    [17, 9.75, 3],
    [18.5, 15.5, 1],
  ]);
  const head = rl(from(shell, [[17.5, 11.5], [19.75, 11.5, 0.6], [21.75, 15.25, 0.5], onPath(shell, [18.5, 15.5])]));
  const tail = rl([[5.25, 14.25], [2.25, 17]]);
  const bands = [9.5, 12, 14.5].map((x) => line([x, yAt(shell, x, false)], [x, yAt(shell, x)]));
  const legs = [vl(7.5, 15.5, G), vl(16, 15.5, G)];
  add('armadillo', ['armadillo', 'caparazón', 'protección', 'armadillo', 'armor', 'protection'], [shell, head, tail, ...bands, ...legs]);
  FILL.armadillo = { solid: [0, shut(head)], wire: [2, 6, 7], cut: [3, 4, 5] };
  PARTS.armadillo = { shell: [0, 3, 4, 5], head: [1], tail: [2], legs: [6, 7] };
}

// ── Small mammals ─────────────────────────────────────────────────────────────────────────────
{
  // The squirrel sitting up, holding an acorn to its chest, the bushy tail curled up behind it in an S
  const body = rp([
    [13.5, 9.25, 0.6],
    [12.75, 6.5, 0.3],
    [13.75, 4.75, 0.4],
    [15, 6, 0.3],
    [16, 6.25, 0.75],
    [18.5, 8, 0.6],
    [18, 9.25, 0.5],
    [16, 9.75, 0.6],
    [16.5, 12.5, 1.5],
    [17.25, 15.75, 1],
    [16.5, G, 0.75],
    [10.25, G, 1.5],
    [10, 13.5, 2.5],
  ]);
  const t = tube([[10.75, 18.5], [6.25, 17.5], [5, 12.5], [7.25, 8.5], [6.75, 4.75], [4.25, 4.25]], 3.25, { start: false });
  const acornNut = ell([19.5, 14.25], 1.75, 2.25);
  const capLine = hl(13.5, yAt2(acornNut, 13.5, true), yAt2(acornNut, 13.5, false));
  add('squirrel', ['ardilla', 'ahorrar', 'otoño', 'squirrel', 'stash', 'autumn'], [t.d, body, capLine, acornNut]);
  FILL.squirrel = { solid: [0, 1, 3], cut: [2] };
  PARTS.squirrel = { tail: [0], body: [1], acorn: [2, 3] };
}
{
  // The porcupine: a low body with its long quills fanned back from the head to the tail
  const body = rp([
    [4.75, 15.25, 1.5],
    [6.75, 11.5, 3],
    [12.5, 10.25, 3],
    [17, 11.75, 1],
    [21.25, 15, 0.6],
    [20.25, 16.25, 0.5],
    [16.75, 16.75, 1],
    [5.75, 17, 1.25],
  ]);
  const quills = [
    [[6.25, 11.85], [2.5, 9.25]],
    [[8.25, 10.85], [5.5, 6.25]],
    [[10.75, 10.4], [9.25, 4.75]],
    [[13.5, 10.45], [13.75, 4.75]],
    [[15.75, 11.2], [17.75, 6.75]],
  ].map(([a, b]) => line(hit(body, [a[0], a[1] + 1], [0, -1]), b));
  const legs = [leg(body, 8.5), leg(body, 15)];
  add('porcupine', ['puercoespín', 'púas', 'defensa', 'porcupine', 'quills', 'defense'], [body, ...quills, ...legs, dot(17.75, 13.5, 0.5)]);
  FILL.porcupine = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7], cut: [8] };
  PARTS.porcupine = { body: [0], quills: [1, 2, 3, 4, 5], legs: [6, 7], eye: [8] };
}
{
  // The field mouse sitting up on its hind legs: a big round ear drawn into the outline, the snout
  // forward, a seed held to its chest (a solid dot on its edge) and the thin tail curling on the ground
  const body = rp([
    [12.5, 9.75, 0.6],
    [11, 6.75, 2],
    [13.75, 4, 2],
    [14.75, 6.25, 0.4],
    [16.5, 6.5, 0.6],
    [19.25, 8.75, 0.5],
    [18.5, 9.75, 0.4],
    [16.25, 10.25, 0.6],
    [16.75, 13.75, 1.5],
    [17, 16.75, 1.25],
    [15.75, G, 0.75],
    [10.75, G, 1.5],
    [9.75, 14.25, 2.75],
  ]);
  const seed = dot(17.25, 13.25, 1);
  const tail = smooth(from(body, [[10.75, G], [6.25, G], [3.75, 18.75], [3.5, 16.25]]));
  add('field-mouse', ['ratón de campo', 'cosecha', 'roedor', 'field mouse', 'wild mouse', 'harvest'], [body, seed, tail]);
  FILL['field-mouse'] = { solid: [0], wire: [1, 2] };
  PARTS['field-mouse'] = { body: [0], seed: [1], tail: [2] };
}
{
  // The hedgehog: a domed back edged with short spines, a small pointed snout and tiny feet
  const spines = [];
  const c = [11, 16];
  const R = 7.25;
  const n = 9;
  for (let k = 0; k <= n; k++) {
    const a = 180 + (k * 120) / n;
    spines.push(polar(...c, k % 2 ? R + 1.5 : R, a));
  }
  const body = rp([
    [3.25, 17.25, 0.6],
    // The spines' points keep their 0.3 (tips): rounded to 0.6 they were scallops, and it read as a
    // cloud
    ...spines.map((p, k) => (k % 2 ? [...p, 0.3, 'tip'] : [...p, 0.6])),
    [17, 10.75, 0.6],
    [21.5, 16, 0.5],
    [20.5, 17.25, 0.5],
    [16.5, 17.75, 1],
  ]);
  const feet = [vl(6.75, yAt(body, 6.75), G), vl(15, yAt(body, 15), G)];
  add('hedgehog', ['erizo', 'jardín', 'púas', 'hedgehog', 'prickly', 'garden'], [body, ...feet, dot(16.75, 14.5, 0.5)]);
  FILL.hedgehog = { solid: [0], wire: [1, 2], cut: [3] };
  PARTS.hedgehog = { body: [0], feet: [1, 2], eye: [3] };
}
{
  // The raccoon walking: an arched back, a pointed ear and snout, the mask a band cut along the face
  // through the eye, and the thick bushy tail held out low behind, drawn into the outline and long
  // enough for two rings cut across it from edge to edge, 3 apart. One ring and a cut slanting down
  // the neck read as nothing in particular; the tail as a piece apart, cleared by the body, fell to
  // bits in outline: the rings and the mask say raccoon
  const body = rp([
    [8.25, 11.25, 2],
    [11.75, 9, 2.5],
    [15, 10.25, 1.25],
    [15.75, 7.75, 0.3, 'tip'],
    [17, 9.25, 0.6],
    [18.25, 9.75, 1],
    [21.5, 12.75, 0.4, 'tip'],
    [21, 13.75, 0.4],
    [18.75, 14.75, 0.75],
    [17.25, 15.75, 1],
    [9.25, 15.75, 1.25],
    [8, 15, 0.75],
    [2.75, 17.75, 1.25],
    [2.25, 14.75, 1.5],
  ]);
  const root = [8, 13.25];
  const u = unit(sub([2.5, 16.25], root));
  const nrm = [-u[1], u[0]];
  const rings = [1.9, 4.9].map((k) => {
    const c = add2(root, mul(u, k));
    return line(hit(body, c, nrm), hit(body, c, mul(nrm, -1)));
  });
  // The mask runs from the eye to the snout's edge (a cut that reaches the silhouette); the head is
  // tall enough to keep it 2.85 from the rest of the outline. Three legs, 3 apart, fit under it
  const mask = line([17.25, 12.25], hit(body, [17.25, 12.25], [1, 0]));
  const legs = [9.75, 12.75, 15.75].map((x) => leg(body, x));
  add('raccoon', ['mapache', 'nocturno', 'ciudad', 'raccoon', 'night', 'scavenger'], [body, ...legs, mask, ...rings]);
  FILL.raccoon = { solid: [0], wire: [1, 2, 3], cut: [4, 5, 6] };
  PARTS.raccoon = { body: [0], legs: [1, 2, 3], mask: [4], rings: [5, 6] };
}
{
  // The skunk: a low body and its bushy tail raised over its back in a tall plume (a stripe along it
  // cut the plume into slivers at 2.1: the plume says it)
  const body = rp([
    [8.25, 13, 2],
    [13, 11, 2.5],
    [16.25, 11.75, 0.75],
    [17, 10.75, 0.4],
    [17.75, 12, 0.5],
    [21.5, 15, 0.5],
    [20.75, 16.25, 0.4],
    [17.75, 16.5, 1],
    [8.5, 16.75, 2],
  ]);
  const t = tube([[8.75, 13.75], [5, 12.75], [3.75, 8], [6.25, 4], [10.75, 4.25]], 3.75, { start: false });
  const legs = legs4(body, 9.25, 15.25);
  add('skunk', ['zorrillo', 'mal olor', 'nocturno', 'skunk', 'stink', 'bad smell'], [t.d, body, ...legs]);
  FILL.skunk = { solid: [0, 1], wire: [2, 3, 4, 5] };
  PARTS.skunk = { tail: [0], body: [1], legs: [2, 3, 4, 5] };
}
{
  // The meerkat on lookout: standing upright on the ground, slim, its paws held in front and its
  // head turned to look
  const body = rp([
    [11.5, 6.75, 0.6],
    [12, 3.75, 1.25],
    [14.5, 3.5, 0.75],
    [17.25, 5, 0.5],
    [16.75, 6, 0.4],
    [14.5, 6.75, 0.6],
    [14.5, 9.75, 1],
    [16.25, 10.5, 0.4],
    [14.75, 11.5, 0.4],
    [15.25, 16.25, 1.5],
    [14.75, G, 0.6],
    [10, G, 1.25],
    [10, 11.5, 2],
  ]);
  const ground = hl(G, 2.25, 21.75);
  add('meerkat', ['suricata', 'vigilancia', 'monitoreo', 'meerkat', 'lookout', 'monitoring'], [body, ground]);
  FILL.meerkat = { solid: [0], wire: [1] };
  PARTS.meerkat = { body: [0], ground: [1] };
}
{
  // The bat in flight, from the front: one outline, the small head with its two pointed ears, the
  // wings' leading edge arching up from the shoulders to their points and the trailing edge in three
  // concave scallops between the fingers, down to the body. Straight trailing edges meeting low in
  // the middle read as a moustache: the scallops say bat
  // The right half, from the notch between the ears: the ear, the shoulder, the arch out to the
  // wing's point and the scallops back in to the body; the left half is its mirror, run back
  const right = [[13.25, 6], [14, 8.75], [16.5, 7.25, 19.5, 6, 21.75, 6.5], [3.25, 19.5, 12.25], [2.25, 16, 12.5], [3.5, 12, 16.75]];
  const X = (x) => 24 - x;
  const shape = [
    'M12 7.75',
    `L${pt(right[0])}L${pt(right[1])}`,
    `C${pt(right[2].slice(0, 2))} ${pt(right[2].slice(2, 4))} ${pt(right[2].slice(4))}`,
    ...right.slice(3).map(([r, x, y]) => `A${f(r)} ${f(r)} 0 0 0 ${pt([x, y])}`),
    // Back out along the left wing: each scallop ends where the right one began, mirrored
    `A3.5 3.5 0 0 0 ${pt([X(16), 12.5])}`,
    `A2.25 2.25 0 0 0 ${pt([X(19.5), 12.25])}`,
    `A3.25 3.25 0 0 0 ${pt([X(21.75), 6.5])}`,
    `C${pt([X(19.5), 6])} ${pt([X(16.5), 7.25])} ${pt([X(14), 8.75])}`,
    `L${pt([X(13.25), 6])}Z`,
  ].join('');
  add('bat', ['murciélago', 'noche', 'cueva', 'bat', 'night', 'nocturnal'], [shape]);
  FILL.bat = { solid: [0] };
  PARTS.bat = { body: [0] };
}
{
  // Roosting: the bat hanging upside down from a line by its feet, its wings folded round its body
  // in a long drop, the ears pointing down
  const perch = hl(3.5, 6.5, 17.5);
  const feet = [line([10.75, 3.5], [10.75, 6.5]), line([13.25, 3.5], [13.25, 6.5])];
  const body = rp([
    [12, 6, 0],
    [16, 8.5, 3.5],
    [16, 15, 2.5],
    [14.25, 18.25, 0.5],
    [13.75, 20.75, 0.3],
    [12, 19, 0.4],
    [10.25, 20.75, 0.3],
    [9.75, 18.25, 0.5],
    [8, 15, 2.5],
    [8, 8.5, 3.5],
  ]);
  const fold = line([12, yAt(body, 12, false)], [12, 15.5]);
  add('bat-hanging', ['murciélago colgado', 'descanso', 'horas tranquilas', 'roosting bat', 'quiet hours', 'sleeping'], [perch, ...feet, body, fold]);
  FILL['bat-hanging'] = { solid: [3], wire: [0, 1, 2], cut: [4] };
  PARTS['bat-hanging'] = { perch: [0], feet: [1, 2], body: [3], wings: [4] };
}

// ── Tracks ────────────────────────────────────────────────────────────────────────────────────
{
  // A cloven hoof: two halves side by side, straight inside and round outside, pointed forward
  const half = rp([
    [10.75, 3.25, 0.6],
    [10.75, 20.75, 1.5],
    [6.5, 20.75, 3],
    [4.75, 13.5, 3.5],
  ]);
  add('hoof-print', ['huella de pezuña', 'rastreo', 'venado', 'hoof print', 'track', 'tracking'], [half, flipPath(half)]);
  FILL['hoof-print'] = { solid: [0, 1] };
  PARTS['hoof-print'] = { hoof: [0, 1] };
}
{
  // A bear's track: mascotas' paw pad (lugares' paw: a rounded trapezoid, its corners 2.75 and 2.25)
  // widened for a bear, under five toes in an arc, solid dots (r 1)
  const pad = roundpoly([[8, 13], [16, 13], [20, 20.25], [4, 20.25]], [2.75, 2.75, 2.25, 2.25]);
  const toes = [-56, -28, 0, 28, 56].map((a) => polar(12, 15.5, 9, a - 90)).map((p) => dot(...p, 1));
  add('bear-print', ['huella de oso', 'rastreo', 'zona de osos', 'bear print', 'bear track', 'tracking'], [pad, ...toes]);
  FILL['bear-print'] = { solid: [0, 1, 2, 3, 4, 5] };
  PARTS['bear-print'] = { pad: [0], toes: [1, 2, 3, 4, 5] };
}
{
  // Claw marks: three slashes side by side, curved, tapering to a point at both ends (two arcs each)
  const slash = (dx) => {
    const a = [6 + dx, 18.5];
    const b = [11 + dx, 4];
    return `M${pt(a)}Q${pt([10.5 + dx, 12.5])} ${pt(b)}Q${pt([8 + dx, 12])} ${pt(a)}Z`;
  };
  add('claw-marks', ['arañazo', 'garras', 'daño', 'claw marks', 'scratch', 'claws'], [slash(-0.5), slash(4.5), slash(9.5)]);
  FILL['claw-marks'] = { solid: [0, 1, 2] };
  PARTS['claw-marks'] = { marks: [0, 1, 2] };
}

// ── The ranch ─────────────────────────────────────────────────────────────────────────────────
{
  // An ear tag: the rounded tag hanging from its round stud, the hole at the top of the tag
  const stud = circ(12, 4.75, 2);
  const tag = rp([
    [10.25, 7.25, 0.75],
    [13.75, 7.25, 0.75],
    [18.75, 12.5, 2.5],
    [18.75, 21, 0],
    [5.25, 21, 2.5],
    [5.25, 12.5, 2.5],
  ]);
  add('livestock-tag', ['arete de ganado', 'trazabilidad', 'identificación', 'ear tag', 'livestock id', 'traceability'], [stud, tag, circ(12, 10.75, 1.5), hl(16.75, 8.75, 15.25)]);
  FILL['livestock-tag'] = { solid: [0, 1], cut: [2, 3] };
  PARTS['livestock-tag'] = { stud: [0], tag: [1, 2, 3] };
}
{
  // A trail camera: a small upright camera, its round lens over the motion sensor, mounted on the
  // front of a tree trunk to its left, the trunk's near edge running down to the camera and on from
  // under it, as legs meet a body. Set in front of a trunk as wide as the canvas, its strap running
  // out to both edges, it read as a spaceship between its wings
  const cam = sq(9, 6, 10, 12.5, 2.5, BR);
  const trunk = [vl(4.75, 2.25, 21.75), vl(10.25, 2.25, yAt(cam, 10.25, false)), vl(10.25, yAt(cam, 10.25), 21.75)];
  const lens = circ(14, 10.5, 2.25);
  // The sensor clears the lens and the camera's bottom edge by 2.85 or more
  const sensor = hl(15.6, 12.5, 15.5);
  add('trail-camera', ['cámara trampa', 'fototrampeo', 'monitoreo de fauna', 'trail camera', 'camera trap', 'wildlife monitoring'], [cam, ...trunk, lens, sensor]);
  FILL['trail-camera'] = { solid: [0], wire: [1, 2, 3], cut: [4, 5] };
  PARTS['trail-camera'] = { camera: [0], trunk: [1, 2, 3], lens: [4], sensor: [5] };
}
// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d` (or a stroke of its own): `solid` is filled (closed shapes only; `close` shuts the
// open outlines along their chord), `cut` is knocked out at stroke width, `lines` stays a line with
// a clearance of paper, `wire` stays a line attached to it. `false`: open lines only.
for (const [name, spec] of Object.entries(FILL)) {
  if (icons[name].fill !== undefined) continue;
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  const solid = pick(spec.solid);
  icons[name].fill = { solid: spec.close ? solid.map(shut) : solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
// The tails wag from where they leave the body, the runners run, the leapers leap, whatever hangs
// swings from where it hangs, the sleeper breathes, and the badges wiggle as mascotas' dog-alert.
const MOTION = {
  tiger: { effect: 'wiggle', parts: ['tail'], origin: [4.25, 11.75] },
  lion: { effect: 'wiggle', parts: ['tail'], origin: [4.25, 11.75] },
  cheetah: { effect: 'slide', vector: [2, 0] },
  'horse-running': { effect: 'slide', vector: [2, 0] },
  gazelle: { effect: 'bounce', vector: [1, -2] },
  kangaroo: { effect: 'bounce', vector: [0, -2] },
  'sheep-jumping': { effect: 'bounce', parts: ['body', 'legs'], vector: [0, -1.5] },
  horse: { effect: 'wiggle', parts: ['tail'], origin: [4.75, 10] },
  zebra: { effect: 'wiggle', parts: ['tail'], origin: [4.75, 10] },
  unicorn: { effect: 'wiggle', parts: ['tail'], origin: [4.75, 10.75] },
  donkey: { effect: 'wiggle', parts: ['tail'], origin: [4.75, 11.25] },
  cow: { effect: 'wiggle', parts: ['tail'], origin: [3.75, 9.5] },
  goat: { effect: 'wiggle', parts: ['tail'], origin: [4.75, 11] },
  deer: { effect: 'wiggle', parts: ['tail'], origin: [5, 10.75] },
  fawn: { effect: 'wiggle', parts: ['tail'], origin: [6.25, 10.5] },
  pig: { effect: 'wiggle', parts: ['tail'], origin: [3.6, 11.5] },
  squirrel: { effect: 'wiggle', parts: ['tail'], origin: [10.75, 18.5] },
  'fennec-fox': { effect: 'wiggle', parts: ['tail'], origin: [14.75, G] },
  monkey: { effect: 'wiggle', parts: ['tail'], origin: [8.25, 19.25] },
  'bear-sleeping': { effect: 'beat', parts: ['body'], origin: [12, G] },
  'bat-hanging': { effect: 'ring', parts: ['feet', 'body', 'wings'], origin: [12, 3.5] },
  bat: { effect: 'float', vector: [0, -1.5] },
  'livestock-tag': { effect: 'ring', origin: [12, 4.75] },
  'bear-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'cow-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'wolf-howling': { effect: 'beat', parts: ['moon'], origin: [18.75, 6] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Mirror (DESIGN.md › Mirroring) ────────────────────────────────────────────────────────────
// None: every animal depicts a creature with a fixed side, as mascotas' dog-side and cat-seated.

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
// None: every icon here is an open figure, and each reads at 58 % in its circle and its square.

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these are the ones that still ran together. A
// `small` is not snapped: its pieces run through pixel centers (0.75 + 1.5k).
{
  // The hoof: its two halves three pixels apart, so the filled track keeps its cleft
  const half = rp([[9.75, 3.75, 0.6], [9.75, 20.25, 1.5], [6, 20.25, 2.5], [3.75, 13.5, 3]]);
  const d = [half, flipPath(half)];
  icons['hoof-print'].small = { d, fill: { solid: d } };
}
{
  // The lion's face: eight scallops round the face, its eyes and nose a pixel each
  const mane = `${scallops([12, 12], 8.25, -90, 270, 8, 3.5)}Z`;
  const face = circ(12, 12.75, 4.5);
  const dots = [dot(9.75, 11.25, 0.3), dot(14.25, 11.25, 0.3), dot(12, 14.25, 0.3)];
  icons['lion-face'].small = { d: [mane, face, ...dots], fill: { solid: [mane], cut: [face, ...dots] } };
}

export default { category: 'animales', label: 'Animales', icons };
