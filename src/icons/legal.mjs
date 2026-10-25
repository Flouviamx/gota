// Law and government: contracts and clauses, seals and signatures, votes and elections, the
// buildings of the state, courts, justice, privacy and data rights, intellectual property,
// borders, licenses and permits. Everything is computed with the engine (engine/geometry.mjs) and
// the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a square bottom-right
// corner on containers. The law family is built on the two icons this category adopts from
// comercio, the gavel and the balance scale; the badges are the engine's, and a piece on top of
// another (the gavel on a page, the shield on a policy) is a custom badge the engine clears.
import { arc, badge, circ, dot, drop, f, flipPath, halfChord, head, line, polar, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import producto from './producto.mjs';
import simbolos from './simbolos.mjs';
import sistema from './sistema.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const SQ = { square: ['br'] };

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
    const u = sub(A, V);
    const v = sub(B, V);
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (len(u) * len(v)))));
    const t = r / Math.tan(th / 2);
    const S = add(V, mul(unit(u), t));
    const E = add(V, mul(unit(v), t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** A smooth open curve through the points (Catmull-Rom as cubics). */
function smooth(pts, k = 1 / 6) {
  let o = `M${pt(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    o += `C${pt(add(p1, mul(sub(p2, p0), k)))} ${pt(sub(p2, mul(sub(p3, p1), k)))} ${pt(p2)}`;
  }
  return o;
}

/** A smooth closed curve through the points. */
function smoothClosed(pts, k = 1 / 6) {
  const n = pts.length;
  let o = `M${pt(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i - 1 + n) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    o += `C${pt(add(p1, mul(sub(p2, p0), k)))} ${pt(sub(p2, mul(sub(p3, p1), k)))} ${pt(p2)}`;
  }
  return `${o}Z`;
}

/** A path scaled by `s` around `o` and moved by (dx, dy). */
const xf = (d, s, o = [12, 12], dx = 0, dy = 0) => transform(d, s, o[0] * (1 - s) + dx, o[1] * (1 - s) + dy);
/** A cross (×) of half-size h. */
const cross = ([cx, cy], h) => [line([cx - h, cy - h], [cx + h, cy + h]), line([cx + h, cy - h], [cx - h, cy + h])];
/** A check `w` wide, its corner low and left of center (the proportions of the engine's check). */
const check = (cx, cy, w) => line([cx - w * 0.5, cy + w * 0.04], [cx - w * 0.15, cy + w * 0.38], [cx + w * 0.5, cy - w * 0.34]);
/** Custom badge: the piece on top, the area the engine clears around it, and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** A piece on top whose cleared area is its own outline (a second sheet, a shield, a person in front). */
const front = (ds, fill = { solid: ds }) => own(ds, ds.join(''), fill);

/** Leaf (a lens): two arcs of radius R between p0 and p1. */
const leaf = (p0, p1, R1, R2 = R1) => `M${pt(p0)}A${f(R1)} ${f(R1)} 0 0 1 ${pt(p1)}A${f(R2)} ${f(R2)} 0 0 1 ${pt(p0)}Z`;

/**
 * A seal with its ribbon, archivos' certificate rosette at any size: the disc of radius r and the
 * notched tail hanging from it (at r 3.25 the tail is 4 wide and ends 6.75 below the center).
 */
function rosette([cx, cy], r = 3.25) {
  const a = r * 0.615;
  const top = cy + Math.sqrt(r * r - a * a);
  const end = cy + r * 2.08;
  return [
    circ(cx, cy, r),
    roundline(
      [
        [cx - a, top],
        [cx - a, end],
        [cx, end - r * 0.385],
        [cx + a, end],
        [cx + a, top],
      ],
      [0, 0.4, 0.4, 0.4, 0],
    ),
  ];
}

// ── Paths as segments: exact clipping and dashing ─────────────────────────────────────────────
// A path is read into its segments (lines, cubics, circular or elliptical arcs), each able to
// write any piece of itself exactly, so a piece of a curve is still that curve.
/** Endpoint arc → center form (no rotation), as the SVG spec does it. */
function arcCenter([x1, y1], rx, ry, fa, fs, [x2, y2]) {
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const lam = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
  if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
  const num = Math.max(0, rx * rx * ry * ry - rx * rx * dy * dy - ry * ry * dx * dx);
  let k = Math.sqrt(num / (rx * rx * dy * dy + ry * ry * dx * dx));
  if (fa === fs) k = -k;
  const [cxp, cyp] = [(k * rx * dy) / ry, (-k * ry * dx) / rx];
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const th1 = ang(1, 0, (dx - cxp) / rx, (dy - cyp) / ry);
  let dth = ang((dx - cxp) / rx, (dy - cyp) / ry, (-dx - cxp) / rx, (-dy - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI;
  if (fs && dth < 0) dth += 2 * Math.PI;
  return { c: [cxp + (x1 + x2) / 2, cyp + (y1 + y2) / 2], rx, ry, th1, dth };
}
const lerp = (a, b, t) => add(a, mul(sub(b, a), t));
/** The piece of a cubic between t0 and t1. */
function subCubic(P, t0, t1) {
  const split = ([a, b, c, d], t) => {
    const [ab, bc, cd] = [lerp(a, b, t), lerp(b, c, t), lerp(c, d, t)];
    const [abc, bcd] = [lerp(ab, bc, t), lerp(bc, cd, t)];
    const m = lerp(abc, bcd, t);
    return [
      [a, ab, abc, m],
      [m, bcd, cd, d],
    ];
  };
  const left = split(P, t1)[0];
  return t1 > 0 ? split(left, t0 / t1)[1] : left;
}
/** The subpaths of a path, each a list of segments with `len`, `at(t)` and `piece(t0, t1)`. */
function segmentsOf(d) {
  const tok = transform(d, 1, 0, 0).match(/[MLHVCSAZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const subs = [];
  let [i, cur, start, cmd, prevC] = [0, [0, 0], [0, 0], '', null];
  const num = () => Number(tok[i++]);
  const P = () => [num(), num()];
  const lineSeg = (a, b) => ({ at: (t) => lerp(a, b, t), piece: (t0, t1) => `L${pt(lerp(a, b, t1))}` });
  const put = (seg) => {
    let L = 0;
    for (let k = 1; k <= 48; k++) L += len(sub(seg.at(k / 48), seg.at((k - 1) / 48)));
    subs[subs.length - 1].push({ ...seg, len: L });
  };
  while (i < tok.length) {
    if (/[A-Z]/i.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      cur = start = P();
      subs.push([]);
      cmd = 'L';
      prevC = null;
      continue;
    }
    if (cmd === 'Z') {
      if (len(sub(cur, start)) > 1e-6) put(lineSeg(cur, start));
      cur = start;
      prevC = null;
      continue;
    }
    let end;
    if (cmd === 'L' || cmd === 'H' || cmd === 'V') {
      end = cmd === 'L' ? P() : cmd === 'H' ? [num(), cur[1]] : [cur[0], num()];
      put(lineSeg(cur, end));
      prevC = null;
    } else if (cmd === 'C' || cmd === 'S') {
      const c1 = cmd === 'C' ? P() : prevC ? sub(mul(cur, 2), prevC) : cur;
      const [c2, e] = [P(), P()];
      const Q = [cur, c1, c2, e];
      end = e;
      prevC = c2;
      put({
        at: (t) => subCubic(Q, 0, t)[3],
        piece: (t0, t1) => {
          const s = subCubic(Q, t0, t1);
          return `C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`;
        },
      });
    } else if (cmd === 'A') {
      const [rx, ry] = [num(), num()];
      num();
      const [fa, fs] = [num(), num()];
      end = P();
      const A = arcCenter(cur, rx, ry, fa, fs, end);
      const at = (t) => [A.c[0] + A.rx * Math.cos(A.th1 + t * A.dth), A.c[1] + A.ry * Math.sin(A.th1 + t * A.dth)];
      put({ at, piece: (t0, t1) => `A${f(A.rx)} ${f(A.ry)} 0 ${Math.abs((t1 - t0) * A.dth) > Math.PI ? 1 : 0} ${A.dth > 0 ? 1 : 0} ${pt(at(t1))}` });
      prevC = null;
    } else throw new Error(`segmentsOf: ${cmd}`);
    cur = end;
  }
  return subs;
}
/** A run along a subpath, from length s0 to s1, written as a path. */
function runOf(segs, s0, s1) {
  let acc = 0;
  let out = '';
  for (const g of segs) {
    const [a, b] = [Math.max(s0, acc), Math.min(s1, acc + g.len)];
    if (b > a + 1e-6) {
      const [t0, t1] = [(a - acc) / g.len, (b - acc) / g.len];
      if (!out) out = `M${pt(g.at(t0))}`;
      out += g.piece(t0, t1);
    }
    acc += g.len;
  }
  return out;
}
/** The point at length s along a subpath. */
function pointAt(segs, s) {
  let acc = 0;
  for (const g of segs) {
    if (s <= acc + g.len + 1e-9) return g.at(Math.max(0, Math.min(1, (s - acc) / g.len)));
    acc += g.len;
  }
  return segs[segs.length - 1].at(1);
}
const totalOf = (segs) => segs.reduce((s, g) => s + g.len, 0);
const isClosed = (segs) => len(sub(pointAt(segs, 0), pointAt(segs, totalOf(segs)))) < 1e-3;
/**
 * The pieces of a path that stay outside a region (`cleared(p)` is true inside it), each at least
 * `min` long. For a shape that passes behind another when both belong to the base (the engine's
 * badge clears only one piece per icon): the cut is exact on the curve, never a redrawn piece.
 */
function clipAway(d, cleared, min = 2) {
  const out = [];
  for (const segs of segmentsOf(d)) {
    const total = totalOf(segs);
    const n = Math.ceil(total / 0.05);
    const at = (k) => (k * total) / n;
    const keep = Array.from({ length: n + 1 }, (_, k) => !cleared(pointAt(segs, at(k))));
    // The edge between a kept and a cleared sample, refined by halves
    const edge = (s0, s1) => {
      const k0 = !cleared(pointAt(segs, s0));
      for (let it = 0; it < 30; it++) {
        const m = (s0 + s1) / 2;
        if (!cleared(pointAt(segs, m)) === k0) s0 = m;
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
      runs.push([a === 0 ? 0 : edge(at(a - 1), at(a)), k > n ? total : edge(at(k - 1), at(k))]);
    }
    // A closed subpath left whole stays closed; otherwise its last run and its first meet at its start
    if (isClosed(segs) && runs.length === 1 && runs[0][0] === 0 && runs[0][1] === total) {
      out.push(`${runOf(segs, 0, total)}Z`);
      continue;
    }
    if (isClosed(segs) && runs.length > 1 && runs[0][0] === 0 && runs.at(-1)[1] === total) {
      const [first, last] = [runs.shift(), runs.pop()];
      if (total - last[0] + first[1] >= min) out.push(`${runOf(segs, last[0], total)}${runOf(segs, 0, first[1]).replace(/^M[^A-Z]*/i, '')}`);
    }
    for (const [s0, s1] of runs) if (s1 - s0 >= min) out.push(runOf(segs, s0, s1));
  }
  return out;
}
/** `n` dashes along a path's first subpath with gaps of `gap` (`phase` slides them along a closed one). */
function dashesOf(d, n, gap = 3, phase = 0) {
  const segs = segmentsOf(d)[0];
  const total = totalOf(segs);
  const dash = (total - (isClosed(segs) ? n : n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => {
    const s0 = (phase + i * (dash + gap) + total) % total;
    const s1 = s0 + dash;
    if (s1 <= total + 1e-9) return runOf(segs, s0, Math.min(s1, total));
    return `${runOf(segs, s0, total)}${runOf(segs, 0, s1 - total).replace(/^M[^A-Z]*/i, '')}`;
  });
}

/**
 * A balance scale drawn as comercio's (the post, its base, the beam and two pans, each a Λ of
 * strings and a bowl), at any size: `cx` the post, `y` the beam, `B` half the beam, `a` half a pan,
 * `h` the strings' height, `top` and `bottom` the post's ends, `foot` half the base. `tilt` turns
 * the beam (degrees, the left end down) and the pans hang from its ends.
 */
function scales({ cx = 12, y = 6.25, B = 6.25, a = 2.75, h = 7, top = 3.25, bottom = 20.5, foot = 4, tilt = 0, cup = false } = {}) {
  const t = (tilt * Math.PI) / 180;
  const L = [cx - B * Math.cos(t), y + B * Math.sin(t)];
  const R = [cx + B * Math.cos(t), y - B * Math.sin(t)];
  const pan = ([x, py]) => {
    const [l, r] = [[x - a, py + h], [x + a, py + h]];
    const k = halfChord(l, r);
    // Small pans are one closed shape, strings and bowl, so no hole between them closes at bold
    if (cup) return [`M${pt(l)}L${pt([x, py])}L${pt(r)}A${k} ${k} 0 0 1 ${pt(l)}Z`];
    return [line(l, [x, py], r), `M${pt(r)}H${f(l[0])}A${k} ${k} 0 0 0 ${pt(r)}Z`];
  };
  return [line([cx, top], [cx, bottom]), line([cx - foot, bottom], [cx + foot, bottom]), line(L, R), ...pan(L), ...pan(R)];
}
/** A five-point star: `ro` to its tips, `ri` to its inner corners, rounded. */
const star = (cx, cy, ro, ri) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? ri : ro, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.3 : 0.45)));
/**
 * The law book standing, seen from its spine: two bands that stand out past it, near its ends, and
 * a label plate under the upper one. At x 9 (the badges' version) the plate stays 7.55 from the
 * badges' center.
 */
const LAW_BANDS = [7, 17.25];
const lawBook = (cx) => [sq(cx - 5.25, 2.75, 10.5, 18.5, 1.5, SQ), ...LAW_BANDS.map((y) => line([cx - 6.25, y], [cx + 6.25, y])), sq(cx - 2, 9.85, 4, 3, 0.9)];

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
const NU = nucleo.icons;
const CO = comercio.icons;
/** The core document: 14.5 × 18.5, radius 3.75, the signature corner. */
const DOC = NU.document.d[0];
/**
 * The contract: two text lines at the top and, set apart at the foot, the signature rule with its
 * cross. The cross and the lines stay 7.55 from the badges' center, so every badge of the family
 * clears the rule only, at every weight, and leaves it 2.75 long.
 */
const CONTRACT = [DOC, line([8, 6.25], [16, 6.25]), line([8, 9.5], [13, 9.5]), ...cross([9, 13.5], 1), line([8, 17.75], [16, 17.75])];
/** The ballot box: a lid wider than the body, and the ticked slip going in through the slot on top. */
const BALLOT_BOX = [
  sq(4.25, 14.25, 15.5, 7, 2.25, SQ),
  sq(2.75, 11, 18.5, 3.25, 1.25),
  roundline(
    [
      [7.25, 11],
      [7.25, 2.75],
      [16.75, 2.75],
      [16.75, 11],
    ],
    [0, 1.75, 1.75, 0],
  ),
  check(12, 6.75, 3.25),
];
const PERSON = NU.person.d;
/** The core person moved 2.5 to the left, as comunicacion's, to make room for a badge. */
const PERSON_L = PERSON.map((d) => transform(d, 1, -2.5, 0));
/** The core person scaled from its feet (the head moves up to keep its gap from the shoulders), as comunicacion's. */
const personAt = (s, dx = 0, dy = 0) => [xf(PERSON[0], s, [12, 20.6], dx, dy - 1.95 * (1 - s)), xf(PERSON[1], s, [12, 20.6], dx, dy)];
/** The head and shoulders of personAt() as a region, for clipAway: inside or within `clear` of their strokes. */
function personRegion(s, dx, dy, clear = 3) {
  const hc = [12 + dx, 20.6 + (7.45 - 20.6) * s + dy - 1.95 * (1 - s)];
  const hr = 3.7 * s;
  const segs = segmentsOf(personAt(s, dx, dy)[1])[0];
  const total = totalOf(segs);
  const poly = Array.from({ length: 400 }, (_, k) => pointAt(segs, (k * total) / 400));
  const inside = ([x, y]) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [a, b] = [poly[i], poly[j]];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  const near = (p) => poly.some((q) => len(sub(p, q)) < clear);
  return (p) => len(sub(p, hc)) < hr + clear || inside(p) || near(p);
}

/** Rectangle turned along `a` with rounded corners (comercio's gavel head). */
function rrect(c, a, hw, hh, r) {
  const u = unit(a);
  const n = [-u[1], u[0]];
  const P = (i, j) => add(c, add(mul(u, i * hw), mul(n, j * hh)));
  return roundpoly([P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], r);
}
/**
 * Personal data: the person in front of a database (core's, smaller, at the top right), which is cut
 * around them with the knockout's clearance. The database keeps its top whole and its middle band
 * clear of the badges, so every badge of the family clears only its foot.
 */
const PERSONAL_DATA = (() => {
  const [cx, rx, ry, yt, ym, yb] = [15.5, 5.25, 1.75, 4.5, 7.75, 11];
  const [l, r] = [f(cx - rx), f(cx + rx)];
  const top = `M${l} ${yt}A${rx} ${ry} 0 1 0 ${r} ${yt}A${rx} ${ry} 0 1 0 ${l} ${yt}Z`;
  const mid = `M${r} ${ym}A${rx} ${ry} 0 0 1 ${l} ${ym}`;
  const body = `M${l} ${yt}V${yb}A${rx} ${ry} 0 0 0 ${r} ${yb}V${yt}`;
  const person = personAt(0.78, -4.25, 0.65);
  const away = personRegion(0.78, -4.25, 0.65);
  return [...person, ...[top, mid, body].flatMap((d) => clipAway(d, away))];
})();
/**
 * Sistema's cookie under a badge: 0.25 up and to the left, so the badge's clearance cuts its rim the
 * same way at every weight, and without the chip at its lower left, which that clearance would take
 * at some weights and not at others (the one under the badge it takes at every weight).
 */
const COOKIE_KEEP = sistema.icons.cookie.d.filter((d) => d !== dot(8.75, 15.75));
const cookieB = (d) => transform(d, 1, -0.25, -0.25);
const COOKIE_B = COOKIE_KEEP.map(cookieB);
/** Producto's lightbulb, whole and 1.75 to the left, as its badged lightbulbs carry it. */
const BULB_L = producto.icons['lightbulb-check'].d;
/** A small seal: a disc with `n` soft lobes. */
const lobed = (c, r, amp, n = 8) => smoothClosed(Array.from({ length: n * 4 }, (_, i) => polar(...c, r + amp * Math.cos((i * Math.PI) / 2), (i * 360) / (n * 4) - 90)));
/** The license: the frame, its string up to the nail, and the seal. */
const LICENSE = [sq(2.75, 8.25, 18.5, 13, 2.75, SQ), line([7.25, 8.25], [12, 3.5], [16.75, 8.25]), dot(12, 3.5), lobed([12, 14.75], 2.7, 0.3)];
/**
 * The adopted gavel at badge size: its head and handle, turned the same way, in the corner. It
 * clears the elbow between handle and head too, so no piece of the base is left between them.
 */
const GAVEL_PIECE = (() => {
  const c = [18.75, 16.5];
  const head = rrect(c, [1, 1], 2.75, 1.6, 0.9);
  const nn = unit([-1, 1]);
  const [h0, h1] = [add(c, mul(nn, 1.6)), add(c, mul(nn, 6.75))];
  const handle = line(h0, h1);
  // The elbow runs past the canvas's foot, so a base stroke below the gavel is cut cleanly
  const corner = add(c, add(mul(unit([1, 1]), 2.75), mul(nn, 1.6)));
  const elbow = roundpoly([h0, corner, [corner[0], 24], [h1[0], 24], h1], 0.4);
  return own([head, handle], `${head}${handle}${elbow}`, { solid: [head], wire: [handle] });
})();
/** A ballot slip at badge size, ticked. */
const SLIP_PIECE = (() => {
  const slip = sq(14, 12.75, 6.5, 8.5, 1.75, SQ);
  const tick = check(17.25, 17, 3);
  return own([slip, tick], slip, { solid: [slip], cut: [tick] });
})();

const icons = {
  // ── Contracts and documents ──
  contract: {
    tags: ['contrato', 'acuerdo', 'firmar', 'documento legal', 'contract', 'agreement', 'sign here'],
    d: CONTRACT,
  },
  'contract-plus': {
    tags: ['nuevo contrato', 'crear acuerdo', 'redactar', 'new contract', 'create agreement'],
    d: CONTRACT,
    badge: badge('plus'),
  },
  'contract-clock': {
    tags: ['firma pendiente', 'por vencer', 'contrato', 'awaiting signature', 'expiring contract'],
    d: CONTRACT,
    badge: badge('clock'),
  },
  'contract-x': {
    tags: ['contrato anulado', 'rescindir', 'rechazado', 'void contract', 'terminated', 'declined'],
    d: CONTRACT,
    badge: badge('x'),
  },
  'contract-lock': {
    tags: ['confidencialidad', 'acuerdo de confidencialidad', 'nda', 'non-disclosure', 'confidential agreement'],
    d: CONTRACT,
    badge: badge('lock'),
  },
  'contract-renewal': {
    tags: ['renovación', 'renovar contrato', 'renovación automática', 'contract renewal', 'auto renew'],
    d: CONTRACT,
    badge: badge('sync'),
  },
  // The back page whole; the front contract sits on top and the engine clears the back one around it
  'contract-stack': (() => {
    const page = sq(3.25, 6, 12.5, 15.25, 3, SQ);
    const marks = [line([6.25, 9.5], [12.75, 9.5]), ...cross([7.25, 13.5], 1), line([6.25, 17.75], [12.75, 17.75])];
    return {
      tags: ['contratos', 'repositorio', 'todos los acuerdos', 'contracts', 'agreements', 'bulk contracts'],
      d: [sq(7.25, 2.75, 12.5, 15.25, 3, SQ)],
      badge: own([page, ...marks], page, { solid: [page], cut: marks }),
    };
  })(),
  // The annex: a sheet behind the contract's top-right corner; a clip on top holds the two, over the
  // annex (its back leg ends on the contract's top edge, its front leg crosses it, 3.5 clear of the
  // contract's side so the two never run together). The annex's left side lies under the back leg,
  // so the clip's clearance takes its corner whole at every weight
  addendum: (() => {
    const page = sq(3.25, 6.75, 13.5, 14.5, 3, SQ);
    const clip = `M10.25 6.75V4.75${arc(11.75, 4.75, 1.5, 180, 360).d.replace(/^M[^A]*/, '')}V11.25`;
    const marks = [...cross([7.25, 13.75], 1), line([6.25, 17.75], [13.25, 17.75])];
    return {
      tags: ['anexo', 'adenda', 'enmienda', 'addendum', 'annex', 'amendment'],
      d: [sq(10.25, 2.75, 11, 13, 2.5, SQ)],
      badge: own([page, clip, ...marks], `${page}${clip}`, { solid: [page], wire: [clip], cut: marks }),
    };
  })(),
  // Three blocks of text; the middle one marked by a bracket in the margin
  clause: {
    tags: ['cláusula', 'sección', 'artículo', 'clause', 'section', 'contract term'],
    d: [
      DOC,
      line([8.75, 6.5], [15.25, 6.5]),
      roundline(
        [
          [9, 9.5],
          [7.75, 9.5],
          [7.75, 15],
          [9, 15],
        ],
        [0, 0.75, 0.75, 0],
      ),
      line([11.75, 10.75], [15.25, 10.75]),
      line([11.75, 13.75], [14.25, 13.75]),
      line([8.75, 18], [13.25, 18]),
    ],
  },
  // The open scroll: a roll at the top and at the bottom, the sheet between them
  parchment: {
    tags: ['pergamino', 'términos y condiciones', 'decreto', 'constitución', 'parchment', 'charter', 'terms'],
    d: [
      sq(3.75, 2.75, 16.5, 3.5, 1.75),
      sq(3.75, 17.75, 16.5, 3.5, 1.75),
      line([6.25, 6.25], [6.25, 17.75]),
      line([17.75, 6.25], [17.75, 17.75]),
      line([9.25, 10.25], [14.75, 10.25]),
      line([9.25, 13.75], [12.75, 13.75]),
    ],
  },
  // The page and the core shield at half size on its corner
  policy: (() => {
    const shield = transform(NU.shield.d[0], 0.5, 17.25 - 6, 12.5 - 1.575);
    return {
      tags: ['política', 'aviso de privacidad', 'privacidad', 'policy', 'privacy policy', 'company policy'],
      d: [DOC, line([8.75, 7], [15.25, 7]), line([8.75, 10.25], [12.5, 10.25])],
      badge: front([shield]),
    };
  })(),
  'legal-document': {
    tags: ['texto legal', 'artículo de ley', 'aviso legal', 'legal document', 'legal notice', 'imprint'],
    d: [DOC, ...simbolos.icons['section-sign'].d.map((d) => xf(d, 0.6))],
  },
  // The core shield with a two-row checklist
  compliance: {
    tags: ['cumplimiento', 'normativa', 'controles', 'compliance', 'regulation', 'audit passed'],
    d: [NU.shield.d[0], check(9.5, 9.25, 2.5), line([13.5, 9.25], [16.5, 9.25]), check(9.5, 13.75, 2.5), line([13.5, 13.75], [15.75, 13.75])],
  },
  'tax-form': {
    tags: ['declaración de impuestos', 'formulario fiscal', 'hacienda', 'tax return', 'tax form', 'filing'],
    d: [DOC, dot(9.4, 6.3), dot(14.6, 11.5), line([9.15, 11.75], [14.85, 6.05]), line([8.75, 15.25], [15.25, 15.25]), line([8.75, 18.35], [15.25, 18.35])],
  },
  petition: {
    tags: ['petición', 'firmas', 'recolección de firmas', 'petition', 'signatures', 'campaign'],
    d: [
      DOC,
      smooth([
        [8.25, 7.75],
        [9.5, 5.75],
        [10.25, 7.75],
        [11.75, 6.5],
        [13, 7.5],
        [15.25, 6.75],
      ]),
      smooth([
        [8.25, 12.5],
        [9.25, 11],
        [10.5, 12.75],
        [12, 11.25],
        [13.75, 12.25],
      ]),
      smooth([
        [8.25, 17.25],
        [9.75, 15.75],
        [10.5, 17.5],
        [12.25, 16.25],
        [13.25, 17.25],
        [15, 16.5],
      ]),
    ],
  },
  // Dispositivos' tablet with the contract's "sign here", its cross and rule, and the engine's pencil
  // signing on the corner. A scribble small enough for the screen closes its loops at bold, and with
  // the camera dot over it the screen reads as a picture
  'e-signature': {
    tags: ['firma electrónica', 'firma digital', 'firmar en pantalla', 'e-signature', 'digital signature', 'sign'],
    d: [...dispositivos.icons.tablet.d, ...cross([8, 11.5], 1), line([7, 15.5], [11, 15.5])],
    badge: badge('edit'),
  },

  // ── Writing and seals ──
  // On the diagonal: the nib, a spade with round shoulders split from its tip to the grip, and the
  // body (barrel and cap, a band between them). Each half of the nib stays open at bold
  'fountain-pen': (() => {
    const T = [4, 20];
    const u = unit([1, -1]);
    const n = [-u[1], u[0]];
    const at = (s, o) => add(T, add(mul(u, s), mul(n, o)));
    const [hn, hb, g] = [3, 2.1, 7];
    const d = [
      roundpoly([at(0, 0), at(4.5, -hn), at(g, -hn + 0.5), at(g, hn - 0.5), at(4.5, hn)], [0.3, 1.75, 0, 0, 1.75]),
      line(at(0, 0), at(g, 0)),
      roundpoly([at(g, -hb), at(21, -hb), at(21, hb), at(g, hb)], [0.5, hb, hb, 0.5]),
      line(at(14, -hb), at(14, hb)),
    ];
    return {
      tags: ['pluma fuente', 'firmar', 'escritura formal', 'fountain pen', 'signing pen', 'pen'],
      d,
      // Filled, the nib and the body are cut apart along the grip
      fill: { solid: [d[0], d[2]], cut: [d[1], d[3], line(at(g, -hb), at(g, hb))] },
    };
  })(),
  // The feather leans out of a squat inkwell: its shaft starts at the mouth and runs through the vane
  quill: (() => {
    const B = [12, 13.25];
    const u = unit([6, -10]);
    const P1 = add(B, mul(u, 12.75));
    return {
      tags: ['pluma de ave', 'tintero', 'redactar', 'quill', 'inkwell', 'drafting'],
      d: [
        sq(6.5, 15.5, 11, 5.75, 2.25, SQ),
        roundline(
          [
            [9.5, 15.5],
            [9.5, 13.25],
            [14.5, 13.25],
            [14.5, 15.5],
          ],
          [0, 0.6, 0.6, 0],
        ),
        leaf(add(B, mul(u, 3.5)), P1, 6, 8),
        line(B, P1),
      ],
    };
  })(),
  // A disc of wax with seven soft, uneven lobes and the ring the seal pressed into it
  'wax-seal': (() => {
    const amp = [0.6, 0.45, 0.6, 0.5, 0.65, 0.45, 0.55];
    const pts = Array.from({ length: 28 }, (_, i) => polar(12, 12, 8.6 + amp[Math.floor(i / 4)] * Math.cos((i * Math.PI) / 2), (i * 360) / 28 - 90));
    return {
      tags: ['sello de lacre', 'lacre', 'auténtico', 'oficial', 'wax seal', 'sealed', 'authentic'],
      d: [smoothClosed(pts), circ(12, 12, 5)],
    };
  })(),
  // The desk embosser from the side: the C of its body on the base plate, the round die under its
  // jaw and the lever above
  embosser: {
    tags: ['sello notarial', 'gofradora', 'certificar', 'embosser', 'notary seal', 'notarize'],
    d: [
      sq(3.25, 18.25, 17.5, 2.75, 1.25),
      roundpoly(
        [
          [4.25, 18.25],
          [4.25, 8],
          [17.75, 8],
          [17.75, 11.25],
          [8, 11.25],
          [8, 18.25],
        ],
        [0, 2.25, 1, 1, 1, 0],
      ),
      sq(13.25, 11.25, 4.25, 3, 1),
      line([8.5, 8], [20, 4.25]),
    ],
  },

  // ── Votes and elections ──
  // A ticked box on the slip (controles' checked box: the tick runs out past its corner and goes on
  // top, and the engine clears the box around it) and the line of the choice below
  ballot: (() => {
    const [x, y, s] = [7.25, 7.5, 7];
    const tick = line([x + 2, y + s / 2], [x + s / 2, y + s - 2], [x + s + 1, y - 1.25]);
    return {
      tags: ['boleta', 'papeleta', 'votar', 'ballot', 'voting slip', 'sample ballot'],
      d: [sq(4.75, 2.75, 14.5, 18.5, 3, SQ), sq(x, y, s, s, 2), line([7.75, 17.75], [16.25, 17.75])],
      badge: own([tick], tick),
    };
  })(),
  'ballot-box': {
    tags: ['urna', 'votar', 'elecciones', 'ballot box', 'vote', 'elections'],
    d: BALLOT_BOX,
  },
  'ballot-box-check': {
    tags: ['ya voté', 'voto emitido', 'voto contado', 'vote cast', 'voted', 'ballot counted'],
    d: BALLOT_BOX,
    badge: badge('check'),
  },
  // Three panels on the table line, the side ones angled toward the voter (nearer, so taller), a
  // tick on the back one
  'voting-booth': {
    tags: ['casilla', 'cabina de votación', 'voto secreto', 'voting booth', 'polling booth', 'secret ballot'],
    d: [
      roundpoly(
        [
          [2.75, 5.25],
          [7.5, 3.25],
          [16.5, 3.25],
          [21.25, 5.25],
          [21.25, 18.25],
          [16.5, 15.25],
          [7.5, 15.25],
          [2.75, 18.25],
        ],
        [0.9, 0, 0, 0.9, 0, 0, 0, 0],
      ),
      line([7.5, 3.25], [7.5, 15.25]),
      line([16.5, 3.25], [16.5, 15.25]),
      check(12, 9, 3.25),
      line([2.75, 18.25], [21.25, 18.25]),
    ],
  },
  // The screen tilts back on its post (narrower at the top), a large tick on its face
  'voting-machine': {
    tags: ['voto electrónico', 'urna electrónica', 'votar', 'voting machine', 'electronic voting', 'e-voting'],
    d: [
      roundpoly(
        [
          [5.75, 3.25],
          [18.25, 3.25],
          [20.75, 14.25],
          [3.25, 14.25],
        ],
        [1.75, 1.75, 0, 1.75],
      ),
      check(12, 8.5, 7),
      line([12, 14.25], [12, 20.75]),
      line([8, 20.75], [16, 20.75]),
    ],
  },
  // The ballot rises out of the envelope's pocket; its sides end on the pocket's V
  'postal-vote': {
    tags: ['voto por correo', 'voto postal', 'voto en el extranjero', 'postal vote', 'vote by mail', 'absentee ballot'],
    d: [
      roundpoly(
        [
          [2.75, 10.75],
          [12, 16.25],
          [21.25, 10.75],
          [21.25, 20.75],
          [2.75, 20.75],
        ],
        [0.6, 1.2, 0.6, 0, 3],
      ),
      roundline(
        [
          [7.25, 13.43],
          [7.25, 3.25],
          [16.75, 3.25],
          [16.75, 13.43],
        ],
        [0, 2, 2, 0],
      ),
      check(12.1, 7.6, 3.5),
    ],
  },
  // The seats of a chamber: dots on three half circles, open at the bottom; the middle row sits
  // between the seats of the others so every seat keeps its clearance
  hemicycle: {
    tags: ['hemiciclo', 'escaños', 'parlamento', 'resultados electorales', 'hemicycle', 'parliament seats'],
    d: [
      ...[180, 360].map((a) => dot(...polar(12, 16.5, 2.1, a), 0.3)),
      ...Array.from({ length: 5 }, (_, i) => dot(...polar(12, 16.5, 5.55, 198 + i * 36), 0.3)),
      ...Array.from({ length: 9 }, (_, i) => dot(...polar(12, 16.5, 9, 180 + i * 22.5), 0.3)),
    ],
  },
  // Two people, each behind a lectern: a board sloping toward the other on a post; the lecterns go
  // on top and the engine clears the people behind them
  debate: (() => {
    const bust = (cx) => [circ(cx, 5.5, 2.25), arc(cx, 14.25, 4, 180, 360).d];
    const board = roundpoly(
      [
        [2.75, 11.75],
        [10.25, 13.25],
        [10.25, 15.75],
        [2.75, 14.25],
      ],
      0.75,
    );
    const post = line([6.5, 15], [6.5, 20.75]);
    const foot = line([4.25, 20.75], [8.75, 20.75]);
    const L = [board, post, foot];
    const R = L.map((d) => flipPath(d));
    return {
      tags: ['debate', 'candidatos', 'foro', 'atriles', 'debate', 'candidates forum', 'lecterns'],
      d: [...bust(6.5), ...bust(17.5)],
      badge: own([...L, ...R], [...L, ...R].join(''), { solid: [board, R[0]], wire: [post, foot, R[1], R[2]] }),
    };
  })(),
  voter: {
    tags: ['votante', 'elector', 'padrón', 'registro electoral', 'voter', 'voter registration', 'electorate'],
    d: PERSON_L,
    badge: SLIP_PIECE,
  },

  // ── The state and its buildings ──
  // A dome on its drum with a short lantern, over a portico of three columns
  capitol: {
    tags: ['capitolio', 'congreso', 'parlamento', 'gobierno', 'capitol', 'legislature', 'parliament'],
    d: [
      line([3.25, 20.75], [20.75, 20.75]),
      line([3.25, 13], [20.75, 13]),
      `M7.5 13V10.5${arc(12, 10.5, 4.5, 180, 360).d.replace(/^M[^A]*/, '')}V13`,
      line([12, 6], [12, 3.25]),
      ...[6.75, 12, 17.25].map((x) => line([x, 13], [x, 20.75])),
    ],
  },
  // Two low wings and the central tower with its clock face and the door below
  'city-hall': {
    tags: ['ayuntamiento', 'municipio', 'alcaldía', 'gobierno local', 'city hall', 'town hall', 'municipality'],
    d: [
      roundpoly(
        [
          [3.25, 20.75],
          [3.25, 11.75],
          [7.5, 11.75],
          [7.5, 7],
          [12, 3],
          [16.5, 7],
          [16.5, 11.75],
          [20.75, 11.75],
          [20.75, 20.75],
        ],
        [2, 1, 0, 0.6, 1, 0.6, 0, 1, 0],
      ),
      circ(12, 10.25, 1.65),
      roundline(
        [
          [10.25, 20.75],
          [10.25, 17.25],
          [13.75, 17.25],
          [13.75, 20.75],
        ],
        [0, 1, 1, 0],
      ),
    ],
  },
  // Comercio's bank with the gavel on its corner
  // Comercio's bank front with the gavel where its third column stands
  courthouse: {
    tags: ['tribunal', 'juzgado', 'poder judicial', 'corte', 'courthouse', 'court of law', 'judiciary'],
    d: [CO.bank.d[0], CO.bank.d[1], CO.bank.d[2], CO.bank.d[4]],
    badge: GAVEL_PIECE,
  },
  // A flat roof and its base, three columns standing between them, a flagpole on top with a blank
  // pennant
  embassy: {
    tags: ['embajada', 'consulado', 'misión diplomática', 'embassy', 'consulate', 'diplomatic mission'],
    d: [
      sq(3.25, 8.75, 17.5, 3, 1),
      ...[6.75, 12, 17.25].map((x) => line([x, 11.75], [x, 17.75])),
      sq(3.25, 17.75, 17.5, 3, 1),
      line([12, 8.75], [12, 2.75]),
      roundline(
        [
          [12, 2.75],
          [17.75, 4.5],
          [12, 6.25],
        ],
        [0, 0.75, 0],
      ),
    ],
  },
  // One classical column: the slab on top, the fluted shaft and a stepped base
  pillar: {
    tags: ['pilar', 'columna', 'institución', 'fundamentos', 'pillar', 'column', 'institution'],
    d: [
      sq(5.25, 2.75, 13.5, 3.25, 1),
      line([7.25, 6], [7.25, 17.75]),
      line([16.75, 6], [16.75, 17.75]),
      line([10.4, 9], [10.4, 14.75]),
      line([13.6, 9], [13.6, 14.75]),
      roundpoly(
        [
          [6.25, 17.75],
          [17.75, 17.75],
          [17.75, 19.25],
          [19.25, 19.25],
          [19.25, 21.25],
          [4.75, 21.25],
          [4.75, 19.25],
          [6.25, 19.25],
        ],
        [0.4, 0.4, 0, 0.4, 0.4, 0.4, 0.4, 0],
      ),
    ],
  },

  // ── Courts and justice ──
  prison: {
    tags: ['prisión', 'cárcel', 'reja', 'detención', 'prison', 'jail', 'detention'],
    d: [sq(4.75, 4.75, 14.5, 14.5, 2.5, SQ), ...[8.375, 12, 15.625].map((x) => line([x, 4.75], [x, 19.25])), line([4.75, 12], [19.25, 12])],
  },
  // The person family (judge, notary, voter) with the prison's barred window on the corner: a frame
  // with two bars, 3 apart, which the engine clears from the person
  inmate: (() => {
    const frame = sq(12.25, 12.25, 9, 9, 2, SQ);
    const bars = [15.25, 18.25].map((x) => line([x, 12.25], [x, 21.25]));
    return {
      tags: ['recluso', 'preso', 'detenido', 'inmate', 'prisoner', 'detainee'],
      d: PERSON_L,
      badge: own([frame, ...bars], frame, { solid: [frame], cut: bars }),
    };
  })(),
  // Two cuffs, each a ring under the square block of its lock, and a chain of two links between the
  // blocks: each link a capsule with an open eye at every weight, touching the next and, with its
  // round end, the block's side. Small blocks and a visible chain, not binoculars' wide barrels
  // and bridge; cut open below the blocks, the rings read as a swimsuit top
  handcuffs: (() => {
    const blocks = [sq(4.5, 8.75, 4, 4.25, 1), sq(15.5, 8.75, 4, 4.25, 1)];
    const links = [sq(8.5, 9.6, 3.5, 2.6, 1.3), sq(12, 9.6, 3.5, 2.6, 1.3)];
    const rings = [circ(6.5, 16.75, 3.75), circ(17.5, 16.75, 3.75)];
    return {
      tags: ['esposas', 'arresto', 'detención', 'derecho penal', 'handcuffs', 'arrest', 'custody'],
      d: [...rings, ...blocks, ...links],
      fill: { solid: blocks, wire: [...rings, ...links] },
    };
  })(),
  // A crest with a notched top and the star on its face
  'police-badge': {
    tags: ['placa de policía', 'policía', 'autoridad', 'police badge', 'law enforcement', 'sheriff'],
    d: [
      roundpoly(
        [
          [12, 4.5],
          [17.25, 2.75],
          [20.25, 6.75],
          [19.25, 14],
          [12, 21.25],
          [4.75, 14],
          [3.75, 6.75],
          [6.75, 2.75],
        ],
        [1, 0.9, 1.5, 3, 1.25, 3, 1.5, 0.9],
      ),
      star(12, 11.25, 3.75, 1.6),
    ],
  },
  // The core folder closed by its flap: a button on the flap's edge, another below it, and the
  // string wound between them in a figure eight
  'case-file': {
    tags: ['expediente', 'caso', 'dossier', 'asunto legal', 'case file', 'legal matter', 'dossier'],
    d: [
      NU.folder.d[0],
      line([2.75, 10.25], [10.5, 10.25]),
      line([13.5, 10.25], [21.25, 10.25]),
      circ(12, 10.25, 1.5),
      circ(12, 16.75, 1.5),
      line(polar(12, 10.25, 1.5, 135), polar(12, 16.75, 1.5, -45)),
      line(polar(12, 10.25, 1.5, 45), polar(12, 16.75, 1.5, -135)),
    ],
  },
  lawsuit: {
    tags: ['demanda', 'litigio', 'juicio', 'sentencia', 'lawsuit', 'litigation', 'court filing'],
    d: [DOC, line([8.75, 7.25], [15.25, 7.25]), line([8.75, 10.75], [12.75, 10.75])],
    badge: GAVEL_PIECE,
  },
  // The judge's bench from the front, its middle raised; the gavel rests on it at an angle, the end
  // of its handle on the bench
  courtroom: (() => {
    const c = [16, 5.25];
    const nn = unit([-1, 1]);
    return {
      tags: ['sala de audiencias', 'juicio', 'estrado', 'audiencia', 'courtroom', 'trial', 'hearing'],
      d: [
        roundpoly(
          [
            [2.75, 20.75],
            [2.75, 15.25],
            [7.5, 15.25],
            [7.5, 12],
            [16.5, 12],
            [16.5, 15.25],
            [21.25, 15.25],
            [21.25, 20.75],
          ],
          [0, 1, 0.5, 1, 1, 0.5, 1, 0],
        ),
        rrect(c, [1, 1], 3, 1.6, 0.9),
        line(add(c, mul(nn, 1.6)), add(c, mul(nn, 6.75 * Math.SQRT2))),
      ],
    };
  })(),
  // Three jurors behind a rail on posts: their shoulders meet on the rail
  jury: {
    tags: ['jurado', 'jurados', 'tribunal', 'jury', 'jurors', 'panel'],
    d: [
      line([2.75, 14.25], [21.25, 14.25]),
      ...[6, 12, 18].flatMap((x) => [circ(x, 7.25, 1.55), arc(x, 14.25, 3, 180, 360).d]),
      ...[4.75, 12, 19.25].map((x) => line([x, 14.25], [x, 20.75])),
    ],
  },
  judge: {
    tags: ['juez', 'magistrado', 'autoridad judicial', 'judge', 'magistrate', 'justice'],
    d: PERSON_L,
    badge: GAVEL_PIECE,
  },
  // A hanging pair of plates on a post: at badge size the pans are plates, so nothing closes at bold
  lawyer: (() => {
    const s = [line([17, 12.25], [17, 21.25]), line([15, 21.25], [19, 21.25]), line([13.25, 14], [20.75, 14]), line([13.25, 14], [13.25, 17]), line([12, 17], [14.5, 17]), line([20.75, 14], [20.75, 17]), line([19.5, 17], [22, 17])];
    return {
      tags: ['abogado', 'licenciado', 'asesor legal', 'lawyer', 'attorney', 'legal counsel'],
      d: PERSON_L,
      badge: own(s, s.join('')),
    };
  })(),
  // Comercio's rubber stamp at badge size: the knob, its stem and the pad
  notary: (() => {
    const knob = circ(17.25, 13.75, 1.5);
    const stem = line([17.25, 15.25], [17.25, 17.25]);
    const pad = sq(13.5, 17.25, 7.5, 3.5, 1.25);
    return {
      tags: ['notario', 'notaría', 'fedatario', 'notary', 'notary public', 'notarization'],
      d: PERSON_L,
      badge: own([knob, stem, pad], `${knob}${stem}${pad}`, { solid: [knob, pad], wire: [stem] }),
    };
  })(),
  // The open hand of comercio's donation, palm up, under a balance scale
  'legal-aid': {
    tags: ['asistencia legal', 'defensoría', 'pro bono', 'ayuda legal', 'legal aid', 'legal help'],
    d: [...scales({ cx: 13, y: 4.25, B: 4.75, a: 1.75, h: 3.75, top: 2.75, bottom: 12, foot: 2, cup: true }), CO.donation.d[1], CO.donation.d[2]],
  },
  // The balance scale, smaller and to the top left, with a speech drop on its corner
  'legal-advice': (() => {
    const bubble = drop(17.75, 17.75, 3.25);
    return {
      tags: ['asesoría legal', 'consulta', 'preguntar a un abogado', 'legal advice', 'consultation', 'ask a lawyer'],
      d: scales({ cx: 9.6, y: 5.25, B: 4.85, a: 2, h: 5, top: 2.75, bottom: 15.75, foot: 3, cup: true }),
      badge: front([bubble]),
    };
  })(),
  // Two people facing each other, a level beam on its post standing between them
  mediation: {
    tags: ['mediación', 'arbitraje', 'resolución de conflictos', 'mediation', 'arbitration', 'dispute resolution'],
    d: [...[5.5, 18.5].flatMap((x) => [circ(x, 12.25, 2), arc(x, 20.75, 3.5, 180, 360).d]), line([12, 7.5], [12, 20.75]), line([8.75, 7.5], [15.25, 7.5])],
  },
  // The same two people with a jagged bolt between their heads
  dispute: {
    tags: ['disputa', 'conflicto', 'pleito', 'partes contrarias', 'dispute', 'conflict', 'opposing parties'],
    d: [
      ...[5.5, 18.5].flatMap((x) => [circ(x, 12.25, 2), arc(x, 20.75, 3.5, 180, 360).d]),
      line([13.25, 3.5], [10.75, 9], [13.25, 10], [10.75, 15.5]),
    ],
  },
  // The adopted scale with its beam tipped: the left pan hangs lower
  'balance-scale-tilted': {
    tags: ['desigualdad', 'injusto', 'sesgo', 'parcialidad', 'unfair', 'bias', 'unequal'],
    d: scales({ tilt: 12 }),
  },
  // Comunicacion's raised hand with the law book on its corner
  oath: (() => {
    const book = sq(14, 12.75, 6.75, 8.5, 1.5, SQ);
    const bands = [line([14, 15.6], [20.75, 15.6]), line([14, 18.4], [20.75, 18.4])];
    return {
      tags: ['juramento', 'jurar', 'testimonio', 'toma de protesta', 'oath', 'sworn statement', 'swearing in'],
      d: comunicacion.icons['hand-raised'].d,
      badge: own([book, ...bands], book, { solid: [book], cut: bands }),
    };
  })(),
  'law-book': {
    tags: ['ley', 'código', 'reglamento', 'estatutos', 'law book', 'statutes', 'legal code'],
    d: lawBook(12),
  },
  'law-book-check': {
    tags: ['conforme a la ley', 'cumple la norma', 'legal', 'compliant', 'lawful', 'regulation met'],
    d: lawBook(9),
    badge: badge('check'),
  },
  'law-book-search': {
    tags: ['investigación jurídica', 'jurisprudencia', 'buscar ley', 'legal research', 'case law', 'search law'],
    d: lawBook(9),
    badge: badge('search'),
  },

  // ── Privacy and data rights ──
  'personal-data': {
    tags: ['datos personales', 'titular de datos', 'información personal', 'personal data', 'data subject', 'pii'],
    d: PERSONAL_DATA,
  },
  'personal-data-download': {
    tags: ['solicitud de acceso', 'derecho de acceso', 'portabilidad', 'data access request', 'dsar', 'data export'],
    d: PERSONAL_DATA,
    badge: badge('arrow-down'),
  },
  'personal-data-x': {
    tags: ['derecho al olvido', 'borrar mis datos', 'cancelación', 'erasure request', 'right to be forgotten', 'delete data'],
    d: PERSONAL_DATA,
    badge: badge('x'),
  },
  'personal-data-edit': {
    tags: ['rectificación', 'corregir mis datos', 'actualizar datos', 'rectification', 'correct my data', 'edit data'],
    d: PERSONAL_DATA,
    badge: badge('edit'),
  },
  // The core person in dashes: a dash of the head at its chin and one of the shoulders at their top,
  // where the two come closest, so no dash ends next to the other piece
  anonymize: (() => {
    const head = dashesOf(PERSON[0], 3, 3, (Math.PI * 3.7) / 2 - (2 * Math.PI * 3.7 - 9) / 6);
    const segs = segmentsOf(PERSON[1])[0];
    const total = totalOf(segs);
    let top = 0;
    for (let k = 0; k <= 400; k++) if (pointAt(segs, (k * total) / 400)[1] < pointAt(segs, top)[1]) top = (k * total) / 400;
    // Four dashes on the shoulders, 3.25 apart: across their tight corners a gap of 3 measured less
    const [n, gap] = [4, 3.25];
    const dash = (total - n * gap) / n;
    return {
      tags: ['anónimo', 'anonimizar', 'seudónimo', 'anonymize', 'anonymous', 'pseudonymized'],
      d: [...head, ...dashesOf(PERSON[1], n, gap, top - dash / 2)],
    };
  })(),
  // Comercio's open hand, palm up, under a check
  consent: {
    tags: ['consentimiento', 'autorización', 'permiso otorgado', 'consent', 'permission', 'opt-in'],
    d: [check(13.25, 7.5, 8), CO.donation.d[1], CO.donation.d[2]],
  },
  // The core database with lugares' map pin, at half size, on its corner
  'data-residency': (() => {
    const pin = [xf(lugares.icons['map-pin'].d[0], 0.5, [12, 10.25], 5.5, 5.5), dot(17.5, 15.75)];
    return {
      tags: ['residencia de datos', 'soberanía de datos', 'ubicación de datos', 'data residency', 'data sovereignty', 'data location'],
      d: NU.database.d,
      badge: own(pin, pin[0], { solid: [pin[0]], cut: [pin[1]] }),
    };
  })(),
  'cookie-gear': {
    tags: ['configurar cookies', 'preferencias de cookies', 'consentimiento', 'cookie settings', 'cookie preferences'],
    d: COOKIE_B,
    badge: badge('gear'),
  },
  'cookie-check': {
    tags: ['cookies aceptadas', 'aceptar cookies', 'consentimiento', 'cookies accepted', 'accept cookies'],
    d: COOKIE_B,
    badge: badge('check'),
  },
  'archive-lock': {
    tags: ['retención legal', 'conservación', 'archivo protegido', 'legal hold', 'records retention', 'preserved'],
    d: edicion.icons.archive.d,
    badge: badge('lock'),
  },

  // ── Intellectual property ──
  // Producto's lightbulb, whole and to the left, with archivos' rosette on its corner
  patent: (() => {
    const r = rosette([17.25, 15.25], 3.25);
    return {
      tags: ['patente', 'invención', 'propiedad intelectual', 'patent', 'invention', 'intellectual property'],
      d: BULB_L,
      badge: own(r, `${r[0]}${r[1]}Z`, { solid: [r[0], `${r[1]}Z`] }),
    };
  })(),
  'lightbulb-lock': {
    tags: ['secreto industrial', 'know-how', 'confidencial', 'trade secret', 'confidential', 'know-how'],
    d: BULB_L,
    badge: badge('lock'),
  },
  // Edicion's copyright with its C turned to open on the left
  copyleft: {
    tags: ['copyleft', 'compartir igual', 'licencia libre', 'copyleft', 'share-alike', 'open license'],
    d: [edicion.icons.copyright.d[0], flipPath(edicion.icons.copyright.d[1])],
  },

  // ── Borders and permits ──
  // A person and, beside them, a dashed border crossed by an arrow
  immigration: {
    tags: ['inmigración', 'migración', 'cruzar la frontera', 'immigration', 'migration', 'border crossing'],
    d: [...personAt(0.65, -5.25, 0.65), ...dashesOf(line([14.5, 2.75], [14.5, 21.25]), 4), line([11.25, 9.25], [20.75, 9.25]), head([20.75, 9.25], [1, 0], 3.5)],
  },
  // A person under comercio's house roof, with no walls
  asylum: {
    tags: ['asilo', 'refugio', 'refugiado', 'protección', 'asylum', 'refuge', 'refugee'],
    d: [
      roundline(
        [
          [2.75, 11],
          [12, 3.25],
          [21.25, 11],
        ],
        [0, 1.5, 0],
      ),
      ...personAt(0.75, 0, 0.65),
    ],
  },
  // The boom barrier, without the guard's booth (bienes-raices' gatehouse is the booth and its arm):
  // the striped arm runs across the way from the hub it turns on, the hub on its post. The arm's
  // round end and the hub touch, and the stripes cross the arm from edge to edge
  checkpoint: {
    tags: ['control fronterizo', 'aduana', 'retén', 'checkpoint', 'border control', 'barrier'],
    d: [
      sq(8.25, 8.75, 13, 3, 1.5),
      circ(6.25, 10.25, 2),
      line([6.25, 12.25], [6.25, 20.75]),
      line([3.25, 20.75], [9.25, 20.75]),
      line([12, 11.75], [13.25, 8.75]),
      line([16.5, 11.75], [17.75, 8.75]),
    ],
  },
  // A framed certificate hanging from a nail by its string, a round seal at its center
  license: {
    tags: ['licencia', 'permiso', 'autorización', 'licencia de funcionamiento', 'license', 'permit', 'business license'],
    d: LICENSE,
  },
  // The license smaller and to the top left, so the badge clears only its frame
  'license-clock': {
    tags: ['permiso en trámite', 'licencia por vencer', 'renovar permiso', 'permit pending', 'license expiring'],
    d: LICENSE.map((d) => xf(d, 0.7, [2.75, 2.75])),
    badge: badge('clock'),
  },
};

// ── Fill (DESIGN.md › Fill) ──────────────────────────────────────────────────────────────────
// By index into d (or a path of its own): `solid` is filled and keeps its stroke (closed shapes
// only), `cut` is knocked out, `lines` sit on top with a clearance of paper, `wire` on top and
// attached. Where two solids meet along a shared edge (a lid on its box, a nib on its pen), that
// edge is knocked out so they read as two pieces.
const z = (name, i) => `${icons[name].d[i]}Z`;
const FILL = {
  contract: { solid: [0], cut: [1, 2, 3, 4, 5] },
  'contract-stack': { solid: [0] },
  addendum: { solid: [0] },
  clause: { solid: [0], cut: [1, 2, 3, 4, 5] },
  parchment: { solid: [0, 1, 'M6.25 6.25H17.75V17.75H6.25Z'], cut: [4, 5, line([6.25, 6.25], [17.75, 6.25]), line([6.25, 17.75], [17.75, 17.75])] },
  policy: { solid: [0], cut: [1, 2] },
  'legal-document': { solid: [0], cut: [1, 2] },
  compliance: { solid: [0], cut: [1, 2, 3, 4] },
  'tax-form': { solid: [0], cut: [1, 2, 3, 4, 5] },
  petition: { solid: [0], cut: [1, 2, 3] },
  'e-signature': { solid: [0], cut: [1, 2, 3, 4] },
  'wax-seal': { solid: [0], cut: [1] },
  quill: { solid: [0, z('quill', 1), 2], wire: [3] },
  embosser: { solid: [0, 1, 2], wire: [3] },
  ballot: { solid: [1], lines: [0, 2] },
  'ballot-box': { solid: [0, 1, z('ballot-box', 2)], cut: [3, line([7.25, 11], [16.75, 11])] },
  'voting-booth': { solid: [0], cut: [1, 2, 3], wire: [4] },
  'voting-machine': { solid: [0], cut: [1], wire: [2, 3] },
  'postal-vote': { solid: [0, `${icons['postal-vote'].d[1]}L12 16.25Z`], cut: [2, line([7.25, 13.43], [12, 16.25], [16.75, 13.43])] },
  debate: { solid: [0, z('debate', 1), 2, z('debate', 3)] },
  capitol: { solid: [z('capitol', 2)], wire: [0, 1, 3, 4, 5, 6] },
  'city-hall': { solid: [0], cut: [1, 2] },
  courthouse: { solid: [0], lines: [1, 2, 3] },
  embassy: { solid: [0, 4, z('embassy', 6)], wire: [1, 2, 3, 5] },
  pillar: { solid: [0, 'M7.25 6V17.75H16.75V6Z', 5], cut: [3, 4, line([7.25, 6], [16.75, 6]), line([7.25, 17.75], [16.75, 17.75])] },
  prison: { solid: [0], cut: [1, 2, 3, 4] },
  'police-badge': { solid: [0], cut: [1] },
  'case-file': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  lawsuit: { solid: [0], cut: [1, 2] },
  courtroom: { solid: [0, 1], wire: [2] },
  jury: { solid: [1, z('jury', 2), 3, z('jury', 4), 5, z('jury', 6)], wire: [0, 7, 8, 9] },
  'legal-aid': { solid: [3, 4, 5, z('legal-aid', 6)], wire: [0, 1, 2] },
  'legal-advice': { solid: [3, 4], wire: [0, 1, 2] },
  'balance-scale-tilted': { solid: [4, 6], wire: [0, 1, 2, 3, 5] },
  mediation: { solid: [0, z('mediation', 1), 2, z('mediation', 3)], wire: [4, 5] },
  dispute: { solid: [0, z('dispute', 1), 2, z('dispute', 3)], lines: [4] },
  oath: { solid: [0], cut: [1, 2, 3] },
  consent: { solid: [1, z('consent', 2)], lines: [0] },
  copyleft: { solid: [0], cut: [1] },
  asylum: { solid: [1, 2], lines: [0] },
  checkpoint: { solid: [0, 1], wire: [2, 3], cut: [4, 5] },
  license: { solid: [0, 2], wire: [1], cut: [3] },
  'license-clock': { solid: [0, 2], wire: [1], cut: [3] },
  immigration: { solid: [0, 1], lines: [2, 3, 4, 5, 6, 7] },
};
// The same fill on every member of a family
for (const name of ['contract-plus', 'contract-clock', 'contract-x', 'contract-lock', 'contract-renewal']) FILL[name] = FILL.contract;
FILL['ballot-box-check'] = FILL['ballot-box'];
for (const name of ['judge', 'lawyer', 'notary', 'voter', 'inmate']) FILL[name] = { solid: [0, 1] };
// The law book: its bands stand out past the spine, so on the fill they are knocked out across
// it and stay attached as lines beyond it
for (const name of ['law-book', 'law-book-check', 'law-book-search']) {
  const cx = name === 'law-book' ? 12 : 9;
  const stubs = LAW_BANDS.flatMap((y) => [line([cx - 6.25, y], [cx - 5.25, y]), line([cx + 5.25, y], [cx + 6.25, y])]);
  FILL[name] = { solid: [0], cut: [1, 2, 3], wire: stubs };
}
// The person in front of the database: the person filled, the database's top filled, the rest of
// it lines (they already stand 1.5 apart from the person)
for (const name of ['personal-data', 'personal-data-download', 'personal-data-x', 'personal-data-edit']) FILL[name] = { solid: [0, 1, 2], lines: [3, 4] };
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, v.map((x) => (typeof x === 'number' ? d[x] : x))]));
}
// Shapes reused whole keep their own fill
icons['data-residency'].fill = NU.database.fill;
for (const name of ['cookie-gear', 'cookie-check']) icons[name].fill = { solid: sistema.icons.cookie.fill.solid.map(cookieB), cut: sistema.icons.cookie.fill.cut.filter((d) => COOKIE_KEEP.includes(d)).map(cookieB) };
icons['archive-lock'].fill = edicion.icons.archive.fill;
for (const name of ['patent', 'lightbulb-lock']) icons[name].fill = producto.icons['lightbulb-check'].fill;
// Open lines only: the filled version is the outline itself
for (const name of ['anonymize', 'hemicycle']) icons[name].fill = false;

// ── Named parts (DESIGN.md › Named parts) ────────────────────────────────────────────────────
const CONTRACT_PARTS = { page: [0], text: [1, 2], cross: [3, 4], rule: [5] };
const PARTS = {
  contract: CONTRACT_PARTS,
  'contract-stack': { back: [0] },
  addendum: { annex: [0] },
  clause: { page: [0], text: [1, 3, 4, 5], bracket: [2] },
  parchment: { rolls: [0, 1], sheet: [2, 3], text: [4, 5] },
  policy: { page: [0], text: [1, 2] },
  'e-signature': { tablet: [0, 1], signature: [2, 3, 4] },
  'fountain-pen': { nib: [0, 1], body: [2, 3] },
  quill: { inkwell: [0, 1], quill: [2, 3] },
  embosser: { base: [0], body: [1], die: [2], lever: [3] },
  ballot: { slip: [0], box: [1], line: [2] },
  'ballot-box': { body: [0], lid: [1], slip: [2, 3] },
  'voting-booth': { screen: [0, 1, 2], tick: [3], table: [4] },
  'postal-vote': { envelope: [0], slip: [1, 2] },
  hemicycle: { inner: [0, 1], middle: [2, 3, 4, 5, 6], outer: [7, 8, 9, 10, 11, 12, 13, 14, 15] },
  debate: { people: [0, 1, 2, 3] },
  voter: { person: [0, 1] },
  courthouse: { roof: [0], columns: [1, 2], base: [3] },
  embassy: { roof: [0], columns: [1, 2, 3], base: [4], flag: [5, 6] },
  inmate: { person: [0, 1] },
  handcuffs: { cuffs: [0, 1, 2, 3], chain: [4, 5] },
  lawsuit: { page: [0], text: [1, 2] },
  courtroom: { bench: [0], gavel: [1, 2] },
  jury: { rail: [0, 7, 8, 9], jurors: [1, 2, 3, 4, 5, 6] },
  judge: { person: [0, 1] },
  lawyer: { person: [0, 1] },
  notary: { person: [0, 1] },
  'legal-aid': { post: [0, 1], beam: [2], pans: [3, 4], hand: [5, 6] },
  'legal-advice': { post: [0, 1], beam: [2], pans: [3, 4] },
  'balance-scale-tilted': { post: [0, 1], beam: [2], pans: [3, 4, 5, 6] },
  mediation: { people: [0, 1, 2, 3], beam: [4, 5] },
  dispute: { people: [0, 1, 2, 3], bolt: [4] },
  oath: { hand: [0], fingers: [1, 2, 3] },
  'law-book': { cover: [0], bands: [1, 2], label: [3] },
  'personal-data': { person: [0, 1], database: [2, 3, 4] },
  consent: { check: [0], hand: [1, 2] },
  'data-residency': { band: [0], body: [1], lid: [2] },
  'cookie-gear': { cookie: [0], chips: [1, 2, 3] },
  'archive-lock': { lid: [0], body: [1, 2] },
  patent: { bulb: [0], base: [1, 2] },
  immigration: { person: [0, 1], border: [2, 3, 4, 5], arrow: [6, 7] },
  checkpoint: { arm: [0, 4, 5], post: [1, 2, 3] },
  license: { frame: [0], string: [1], nail: [2], seal: [3] },
};
for (const name of ['contract-plus', 'contract-clock', 'contract-x', 'contract-lock', 'contract-renewal']) PARTS[name] = CONTRACT_PARTS;
PARTS['ballot-box-check'] = PARTS['ballot-box'];
for (const name of ['law-book-check', 'law-book-search']) PARTS[name] = PARTS['law-book'];
for (const name of ['personal-data-download', 'personal-data-x', 'personal-data-edit']) PARTS[name] = PARTS['personal-data'];
PARTS['cookie-check'] = PARTS['cookie-gear'];
PARTS['lightbulb-lock'] = PARTS.patent;
PARTS['license-clock'] = PARTS.license;
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Variants, mirroring and motion ───────────────────────────────────────────────────────────
// Already round or framed: no enclosure of the same shape
for (const name of ['copyleft', 'wax-seal', 'cookie-gear', 'cookie-check']) icons[name].variants = { circle: false };
icons.prison.variants = { square: false };
// Writing runs to the right, and the arrow crosses the border to the right
for (const name of ['fountain-pen', 'quill', 'e-signature', 'immigration']) icons[name].mirror = true;

icons['contract-renewal'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['cookie-gear'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['fountain-pen'].motion = { effect: 'wiggle', origin: [4, 20] };
icons.quill.motion = { effect: 'wiggle', parts: ['quill'], origin: [12, 13.25] };
icons.embosser.motion = { effect: 'bounce', parts: ['lever'], vector: [0, 1.25] };
icons['ballot-box'].motion = { effect: 'slide', parts: ['slip'], vector: [0, 2] };
icons['ballot-box-check'].motion = { effect: 'slide', parts: ['slip'], vector: [0, 2] };
icons['postal-vote'].motion = { effect: 'slide', parts: ['slip'], vector: [0, -2] };
icons.courtroom.motion = { effect: 'wiggle', parts: ['gavel'], origin: [9.25, 12] };
for (const name of ['courthouse', 'lawsuit', 'judge']) icons[name].motion = { effect: 'wiggle', parts: ['badge'], origin: [13.98, 21.27] };
icons['balance-scale-tilted'].motion = { effect: 'wiggle', parts: ['beam', 'pans'], origin: [12, 6.25] };
icons['legal-advice'].motion = { effect: 'wiggle', parts: ['beam', 'pans'], origin: [9.6, 5.25] };
icons['legal-aid'].motion = { effect: 'wiggle', parts: ['beam', 'pans'], origin: [13, 4.25] };
icons.mediation.motion = { effect: 'wiggle', parts: ['beam'], origin: [12, 7.5] };
icons.dispute.motion = { effect: 'beat', parts: ['bolt'], origin: [12, 9.5] };
icons.oath.motion = { effect: 'wiggle', parts: ['hand', 'fingers'], origin: [12, 20.75] };
icons.immigration.motion = { effect: 'slide', parts: ['arrow'], vector: [2, 0] };
icons.checkpoint.motion = { effect: 'wiggle', parts: ['arm'], origin: [6.25, 10.25] };
icons.license.motion = { effect: 'ring', origin: [12, 3.5] };
icons['data-residency'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -2] };
icons['personal-data-download'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, 2] };
icons.handcuffs.motion = { effect: 'wiggle', origin: [12, 10.9] };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// At 16 px a pixel is 1.5 of the canvas and pixel centers fall on 0.75 + 1.5k: g(column, row) is
// one. The engine doesn't snap a `small`, so set16 gives its base the shared adjustment the engine
// would; the new pieces already run from pixel center to pixel center (straight or at 45°). Only the
// drawings whose detail turns to a smudge get one. A badge goes in `small` as its pixel version.
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
/** A one-pixel dot at the center of its pixel (the snap would make it 2 × 2). */
const DOT16 = new Set();
const dot16 = (c, r) => {
  const d = circ(...g(c, r), 0.1);
  DOT16.add(d);
  return d;
};
const set16 = (name, d, fill) => {
  const sn = snapper([...d, ...Object.values(fill ?? {}).flat()]);
  const S = (p) => (DOT16.has(p) ? p : sn(p));
  const kind = icons[name].badge?.kind;
  icons[name].small = {
    d: d.map(S),
    ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(S)])) }),
    ...(kind && { badge: badge(kind, { size: 16 }) }),
  };
};
/** Like the 24 px fill: the first stroke is filled and the rest is knocked out. */
const body16 = (name, d) => set16(name, d, { solid: [d[0]], cut: d.slice(1) });

/** Single pixels: short diagonals at 1 px antialias to gray, so the small glyphs are set pixel by pixel. */
const dots16 = (...cr) => cr.map(([c, r]) => dot16(c, r));
/** A tick four pixels wide, its corner at (c + 1, r + 1). */
const tick16 = (c, r) => dots16([c, r], [c + 1, r + 1], [c + 2, r], [c + 3, r - 1]);
/** A signature as a zigzag of pixels from column c, five steps long. */
const zig16 = (c, r, n = 6) => dots16(...Array.from({ length: n }, (_, i) => [c + i, i % 2 ? r - 1 : r]));

// The contract: one line of text, the cross (3 × 3 pixels, clear of every badge) and the rule
const CONTRACT16 = [DOC, pl([5, 3], [10, 3]), ...dots16([5, 5], [7, 5], [6, 6], [5, 7], [7, 7]), pl([5, 10], [10, 10])];
for (const name of ['contract', 'contract-plus', 'contract-clock', 'contract-x', 'contract-lock', 'contract-renewal']) body16(name, CONTRACT16);
// The section sign in pixels: top bar, the hook down to the loop, the loop, the hook to the foot
body16('legal-document', [DOC, pl([7, 5], [9, 5]), pl([7, 7], [8, 7]), pl([7, 9], [8, 9]), pl([6, 11], [8, 11]), ...dots16([6, 6], [6, 8], [9, 8], [9, 10])]);
// Two rows, each a tick and a line
body16('compliance', [NU.shield.d[0], ...tick16(5, 5), pl([10, 5], [11, 5]), ...tick16(5, 9), pl([10, 9], [11, 9])]);
// The percent: two pixels and the diagonal between them, then the two field lines
body16('tax-form', [DOC, ...dots16([5, 3], [9, 7], [5, 7], [6, 6], [7, 5], [8, 4], [9, 3]), pl([5, 10], [10, 10]), pl([5, 12], [10, 12])]);
// Three signatures, each a zigzag
body16('petition', [DOC, ...[4, 8, 12].flatMap((r) => zig16(5, r))]);
// The tablet (its camera dropped), the cross and its rule, clear of the pencil
body16('e-signature', [dispositivos.icons.tablet.d[0], ...dots16([3, 6], [5, 6], [4, 7], [3, 8], [5, 8]), pl([3, 10], [6, 10])]);
// The seats: dots on three half circles around (7, 11), none touching another
set16('hemicycle', dots16([5, 11], [7, 9], [9, 11], [3, 11], [4, 8], [7, 7], [10, 8], [11, 11], [1, 11], [2, 8], [4, 6], [7, 5], [10, 6], [12, 8], [13, 11]));
// The ballot: the box with its tick inside, and the line
{
  const box = sq(px(5), px(5), 7.5, 7.5, 1.2);
  const tick = tick16(6, 7);
  const rule = pl([5, 12], [10, 12]);
  set16('ballot', [icons.ballot.d[0], box, ...tick, rule], { solid: [box], lines: [icons.ballot.d[0], rule], cut: tick });
}

export default { category: 'legal', label: 'Legal y gobierno', icons };
