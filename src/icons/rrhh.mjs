// Recursos humanos (people operations): hiring and candidates, the people on a team and their
// status, leave and time off, where and how people work, desks, reviews and recognition, growth,
// pay and benefits. Everything is computed with the engine (engine/geometry.mjs) on the rules in
// DESIGN.md. The people are the set's: Núcleo's person (scaled from its feet as comunicacion and
// social do, never a new one) and comunicacion's group; the briefcase is Núcleo's, the desk is
// oficina's, the document, the envelope and the banknote are the set's own. Badges are the
// engine's, and any piece that sits on top of another (the person in front of a page, a laptop's
// screen in front of a body, a plane over a briefcase) is a custom badge the engine clears with
// exact clearance: nothing is trimmed by hand.
import { arc, badge, circ, dot, f, flipPath, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import calendario from './calendario.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import datos from './datos.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import oficina from './oficina.mjs';

// ── Paths as segments ─────────────────────────────────────────────────────────────────────────
// parse() turns an engine `d` into absolute segments (L, C, A) and ser() turns them back. clip()
// keeps the parts of a path where a rule holds: that's how a shape behind another stops at exactly
// 3 center to center from it (behind()), as social draws its groups, and how a stroke becomes the
// dashes of a placeholder (dashes()).
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;

function arcSeg(p0, p1, r, large, sweep) {
  const x1 = (p0[0] - p1[0]) / 2;
  const y1 = (p0[1] - p1[1]) / 2;
  const lam = (x1 * x1 + y1 * y1) / (r * r);
  if (lam > 1) r *= Math.sqrt(lam);
  const num = r * r * r * r - r * r * y1 * y1 - r * r * x1 * x1;
  const den = r * r * y1 * y1 + r * r * x1 * x1;
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const c = [k * y1 + (p0[0] + p1[0]) / 2, -k * x1 + (p0[1] + p1[1]) / 2];
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let da = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  if (sweep && da < 0) da += 2 * Math.PI;
  if (!sweep && da > 0) da -= 2 * Math.PI;
  if (Math.abs(da) < 1e-9 && large) da = sweep ? 2 * Math.PI : -2 * Math.PI;
  return { t: 'A', c, r, a0, da };
}

function parse(d) {
  const tk = transform(d, 1, 0, 0).match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const subs = [];
  let [sp, i, cmd, x, y, sx, sy, lc] = [null, 0, '', 0, 0, 0, 0, null];
  const n = () => Number.parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    if (C === 'Z') {
      if (sp) {
        if (!near([x, y], [sx, sy], 1e-6)) sp.segs.push({ t: 'L', a: [x, y], b: [sx, sy] });
        sp.closed = true;
      }
      [x, y, lc, sp] = [sx, sy, null, null];
      continue;
    }
    if (C === 'M') {
      x = ox + n();
      y = oy + n();
      [sx, sy] = [x, y];
      sp = { segs: [], closed: false };
      subs.push(sp);
      cmd = rel ? 'l' : 'L';
      lc = null;
      continue;
    }
    if (!sp) {
      sp = { segs: [], closed: false };
      subs.push(sp);
      [sx, sy] = [x, y];
    }
    const a = [x, y];
    if (C === 'L' || C === 'H' || C === 'V') {
      if (C === 'L') {
        x = ox + n();
        y = oy + n();
      } else if (C === 'H') x = ox + n();
      else y = oy + n();
      sp.segs.push({ t: 'L', a, b: [x, y] });
      lc = null;
    } else if (C === 'C' || C === 'S') {
      const p1 = C === 'C' ? [ox + n(), oy + n()] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
      const p2 = [ox + n(), oy + n()];
      const p3 = [ox + n(), oy + n()];
      sp.segs.push({ t: 'C', p: [a, p1, p2, p3] });
      lc = p2;
      [x, y] = p3;
    } else if (C === 'A') {
      const r = n();
      n();
      n();
      const large = n();
      const sweep = n();
      const b = [ox + n(), oy + n()];
      sp.segs.push(arcSeg(a, b, r, large, sweep));
      [x, y] = b;
      lc = null;
    }
  }
  return subs;
}

function pt(s, t) {
  if (s.t === 'L') return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
  if (s.t === 'A') {
    const g = s.a0 + s.da * t;
    return [s.c[0] + s.r * Math.cos(g), s.c[1] + s.r * Math.sin(g)];
  }
  const [p0, p1, p2, p3] = s.p;
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0], w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1]];
}

function splitC(p, t) {
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [a, b, c] = [L(p[0], p[1]), L(p[1], p[2]), L(p[2], p[3])];
  const [d, e] = [L(a, b), L(b, c)];
  const m = L(d, e);
  return [
    [p[0], a, d, m],
    [m, e, c, p[3]],
  ];
}

function sub(s, t0, t1) {
  if (s.t === 'L') return { t: 'L', a: pt(s, t0), b: pt(s, t1) };
  if (s.t === 'A') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}

const segLen = (s) => {
  let [n, a] = [0, pt(s, 0)];
  for (let k = 1; k <= 32; k++) {
    const b = pt(s, k / 32);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
};

function segD(s) {
  if (s.t === 'L') return `L${P(s.b)}`;
  if (s.t === 'C') return `C${P(s.p[1])} ${P(s.p[2])} ${P(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(sub(s, 0, 0.5)) + segD(sub(s, 0.5, 1));
  return `A${f(s.r)} ${f(s.r)} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${P(pt(s, 1))}`;
}

function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = pt(sp.segs[0], 0);
    o += `M${P(last)}`;
    for (const s of sp.segs) {
      if (!near(pt(s, 0), last)) o += `M${P(pt(s, 0))}`;
      o += segD(s);
      last = pt(s, 1);
    }
    if (sp.closed) o += 'Z';
  }
  return o;
}

/** Keeps only the parts of `d` where keep(p) holds; pieces shorter than `min` are dropped. */
function clip(d, keep, min = 0.3) {
  const out = [];
  for (const sp of parse(d)) {
    const pieces = [];
    sp.segs.forEach((s, i) => {
      const N = 96;
      let prev = keep(pt(s, 0));
      let start = prev ? 0 : null;
      for (let k = 1; k <= N; k++) {
        const now = keep(pt(s, k / N));
        if (now === prev) continue;
        let [lo, hi] = [(k - 1) / N, k / N];
        for (let j = 0; j < 30; j++) {
          const m = (lo + hi) / 2;
          if (keep(pt(s, m)) === prev) lo = m;
          else hi = m;
        }
        if (prev) pieces.push({ i, t0: start, t1: lo });
        else start = hi;
        prev = now;
      }
      if (prev) pieces.push({ i, t0: start, t1: 1 });
    });
    if (pieces.length === sp.segs.length && pieces.every((p) => p.t0 === 0 && p.t1 === 1)) {
      out.push(sp);
      continue;
    }
    const chains = [];
    for (const pc of pieces) {
      const last = chains.at(-1)?.at(-1);
      if (last && last.t1 === 1 && pc.t0 === 0 && pc.i === last.i + 1) chains.at(-1).push(pc);
      else chains.push([pc]);
    }
    if (sp.closed && chains.length > 1) {
      const a = chains[0][0];
      const z = chains.at(-1).at(-1);
      if (a.i === 0 && a.t0 === 0 && z.i === sp.segs.length - 1 && z.t1 === 1) chains[0] = [...chains.pop(), ...chains[0]];
    }
    for (const ch of chains) {
      const segs = ch.map((pc) => sub(sp.segs[pc.i], pc.t0, pc.t1));
      if (segs.reduce((n, s) => n + segLen(s), 0) >= min) out.push({ segs, closed: false });
    }
  }
  return ser(out);
}

/** Points along a path, every ~0.1 (to measure distances and test insides). */
const samples = (d) =>
  parse(d).map((sp) =>
    sp.segs.flatMap((s) => {
      const n = Math.max(2, Math.ceil(segLen(s) / 0.1));
      return Array.from({ length: n + 1 }, (_, k) => pt(s, k / n));
    }),
  );
const inPoly = (ring, [px, py]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
/**
 * The part of `d` that shows behind the closed shapes `fronts`: whatever lies inside them or
 * closer than `gap` (center to center) to their outline is dropped, and so is any piece left
 * shorter than `min`. 3 center to center is the set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3, min = 2) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep, min);
}
/** The length of a path's first subpath and the point at a length along it. */
const along = (d) => {
  const segs = parse(d)[0].segs;
  const lens = segs.map(segLen);
  const total = lens.reduce((a, b) => a + b, 0);
  /** The run of the subpath from length s0 to s1 (s1 may wrap past the end of a closed one). */
  const run = (s0, s1) => {
    const out = [];
    const take = (a, b) => {
      let acc = 0;
      segs.forEach((s, i) => {
        const [x0, x1] = [Math.max(a, acc), Math.min(b, acc + lens[i])];
        if (x1 > x0 + 1e-6) out.push(sub(s, (x0 - acc) / lens[i], (x1 - acc) / lens[i]));
        acc += lens[i];
      });
    };
    if (s1 <= total + 1e-9) take(s0, s1);
    else {
      take(s0, total);
      take(0, s1 - total);
    }
    return ser([{ segs: out, closed: false }]);
  };
  return { total, run };
};
/**
 * `n` dashes along a closed path, `gap` apart along it (3: the dashes' ends stand 1.5 of paper apart),
 * starting at length `phase`: a placeholder's dashed outline.
 */
function dashes(d, n, gap = 3, phase = 0) {
  const { total, run } = along(d);
  const dash = total / n - gap;
  return Array.from({ length: n }, (_, i) => {
    const s0 = (((phase + i * (dash + gap)) % total) + total) % total;
    return run(s0, s0 + dash);
  });
}

// ── Small tools ───────────────────────────────────────────────────────────────────────────────
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });
/** Just the `A…` segment of an engine arc, to chain it inside a path. */
const arcTo = (...a) => arc(...a).d.replace(/^M[^A]+/, '');
/** Open polyline with rounded corners. */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let o = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = rr[i];
    if (!r) {
      o += `L${P(V)}`;
      continue;
    }
    const u = [A[0] - V[0], A[1] - V[1]];
    const w = [B[0] - V[0], B[1] - V[1]];
    const [lu, lw] = [Math.hypot(...u), Math.hypot(...w)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (w[0] / lw) * t, V[1] + (w[1] / lw) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** Smooth open curve through points (Catmull-Rom as cubics). */
function smooth(pts, k = 1 / 6) {
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    o += `C${P([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${P([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${P(p2)}`;
  }
  return o;
}
/**
 * The area a custom badge clears: closed shapes whole, each segment of an open line on its own (a
 * whole open line would also clear the area between it and its chord), with a speck at each end of a
 * segment: the engine strokes the area with butt caps, and the specks round its ends and joints as
 * the line's own caps are, so no sliver of the base is left where two segments meet.
 */
const knockOf = (...ds) =>
  ds
    .flatMap((d) =>
      parse(d).flatMap((sp) => {
        if (sp.closed) return [ser([sp])];
        return sp.segs.flatMap((s) => [ser([{ segs: [s], closed: false }]), circ(...pt(s, 0), 0.15), circ(...pt(s, 1), 0.15)]);
      }),
    )
    .join('');
/** A custom badge: `d` drawn on top, `knock` cleared with the engine's clearance. */
const own = (d, knock = knockOf(...d), fill) => ({ d, knock, ...(fill && { fill }) });
/** A closed piece on top of the base (a person in front, a screen): it clears its own outline. */
const front = (ds, fill = { solid: ds.map(shut) }) => own(ds, ds.map(shut).join(''), fill);
/** A lens (a leaf): two arcs of radius R between p0 and p1, bulging `w` at the middle. */
const lens = (p0, p1, w) => {
  const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2;
  const R = (c * c + (w / 2) ** 2) / w;
  return `M${P(p0)}A${f(R)} ${f(R)} 0 0 1 ${P(p1)}A${f(R)} ${f(R)} 0 0 1 ${P(p0)}Z`;
};
/** datos' four-point sparkle (concave sides), R from its center to each point. */
function star4(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const Q = (x, y) => P([cx + x * R, cy + y * R]);
  return `M${Q(0, -1)}C${Q(a, -b)} ${Q(b, -a)} ${Q(1, 0)}C${Q(b, a)} ${Q(a, b)} ${Q(0, 1)}C${Q(-a, b)} ${Q(-b, a)} ${Q(-1, 0)}C${Q(-b, -a)} ${Q(-a, -b)} ${Q(0, -1)}Z`;
}

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const C = comunicacion.icons;
const BC = [17.25, 17.25];
const RING = circ(...BC, 4.25);
/** Núcleo's person, and shifted to make room for a corner badge (comunicacion's person-plus…). */
const PERSON = N.person.d;
const PERSON_L = C['person-plus'].d;
/**
 * Núcleo's person scaled from its feet; the head moves up to keep its gap from the shoulders,
 * never less than 2.35 between them (social's personAt), so a small person keeps its head apart at
 * 2.1.
 */
const personAt = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};
/** A bust resting on an edge (comunicacion's id-badge): the head, and the shoulders an arc open on the edge. */
const bust = (cx, headY, hr, baseY, sr) => [circ(cx, headY, hr), arc(cx, baseY, sr, 180, 360).d];
/** Núcleo's briefcase: body, handle and band. */
const BRIEFCASE = N.briefcase.d;
/**
 * Núcleo's briefcase scaled by s about its bottom-left corner, put at `to`. Between half size and
 * 0.82 its handle keeps 2.85 between its top and the body, its legs longer (scaled, the hole would
 * close at 2.1); smaller, the handle is ink from regular up and is left as it scales (longer legs
 * would turn it into a padlock).
 */
const briefcaseAt = (s, to) => {
  const [body, handle, band] = BRIEFCASE.map((d) => place(d, s, [2.75, 20.25], to));
  if (3.5 * s >= 2.85 || s < 0.45) return [body, handle, band];
  const [top, x0, x1, r] = [to[1] - 13 * s, to[0] + 5.85 * s, to[0] + 12.65 * s, 1.85 * s];
  return [body, rline([[x0, top], [x0, top - 2.85], [x1, top - 2.85], [x1, top]], [0, r, r, 0]), band];
};
/**
 * Time off: a beach umbrella (lugares' canopy, tilted along its pole) planted in the sand. The pole
 * lands far enough left that a corner badge's clearance never reaches it, so the whole family shares
 * one base.
 */
const TIME_OFF = (() => {
  const [ground, top] = [[8.5, 20.75], [11.5, 9.5]];
  const tilt = (Math.atan2(top[0] - ground[0], ground[1] - top[1]) * 180) / Math.PI;
  const canopy = turnPath(place(lugares.icons.umbrella.d[0], 0.8, [12, 12.5], top), tilt, top);
  // The pole leaves the canopy where lugares' handle does: the crest of its middle scallop
  return [canopy, line(rot([12, top[1] - 3 * 0.8], top, tilt), ground), hl(2.75, 21.25, 20.75)];
})();
/**
 * An open cardboard box seen from the front: the body (square at its rim, where the flaps fold out, and
 * at the signature corner) and its two flaps leaning out from the rim. What it holds stands up from
 * inside and ends on the rim, so nothing behind it is cut. (comercio's isometric open parcel had its
 * back flaps in the way: anything rising out of it cut them into fragments that changed with the weight.)
 */
const RIM = 14.25;
// Each flap 3 across between its edges, so it stays open at 2.1
const FLAP = roundpoly([[4.25, RIM], [2.75, 10.25], [6, 10.25], [7.5, RIM]], [0, 0.6, 0.6, 0]);
const OPEN_BOX = [sq(4.25, RIM, 15.5, 7, 2.25, { square: ['tl', 'tr', 'br'] }), FLAP, flipPath(FLAP)];

/** A wave across the canvas: y0 at its center, `amp` up and down, `period` long, a trough at x0. */
const wave = (x0, x1, y0, amp, period, phase = 0) => {
  const pts = [];
  for (let x = x0; x <= x1 + 1e-6; x += period / 4) pts.push([x, y0 + amp * Math.cos((2 * Math.PI * (x - phase)) / period)]);
  return smooth(pts);
};

/** The set's heart (edicion's `heart`), w wide, its top at `top`. */
const HEART = 'M12 20.5L4.03 12A4.75 4.75 0 1 1 12 7.23A4.75 4.75 0 1 1 19.97 12Z';
const heartAt = (cx, top, w) => place(HEART, w / 18.42, [12, 2.5], [cx, top]);
/** social's five-point star: valleys at half its radius, points rounded by 0.55. */
const star = (cx, cy, R, r = R * 0.49) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? r : R, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.35 : 0.55)));
/**
 * social's laurel branch and its mirror: the stem an arc (radius R about c, from `from` to `to`
 * degrees) and each leaf a lens W wide and L long, leaving the stem at the angles `at` turned out
 * by `a` (0 runs along the stem, 1 straight out); one more leaf continues the stem at its tip.
 */
function laurel({ R, c, from, to, at, L, W, a }) {
  const leaf = (B, u) => lens(B, [B[0] + L * u[0], B[1] + L * u[1]], W);
  const dir = (deg, k) => {
    const n = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const t = [-n[1], n[0]];
    const b = Math.sqrt(1 - k * k);
    return [k * n[0] + b * t[0], k * n[1] + b * t[1]];
  };
  const left = [arc(c[0], c[1], R, from, to).d, ...at.map((deg) => leaf(polar(c[0], c[1], R, deg), dir(deg, a))), leaf(polar(c[0], c[1], R, to), dir(to, 0))];
  return [...left, ...left.map((d) => flipPath(d))];
}
/**
 * dispositivos' laptop at scale s, the middle of its base at `to`: the screen scales, the base keeps
 * its width in proportion and its 3.25 below the screen (a gap scaled down would merge at 2.1).
 */
const laptopAt = (s, to) => {
  const [screen] = dispositivos.icons.laptop.d;
  return [place(screen, s, [12, 15.5], [to[0], to[1] - 3.25]), hl(to[0] - 9.5 * s, to[0] + 9.5 * s, to[1])];
};
/** lugares' map pin scaled by s about its tip, put at `to`; under half size its hole would close at 2.1, so it goes. */
const pinAt = (s, to) => lugares.icons['map-pin'].d.slice(0, s < 0.45 ? 1 : 2).map((d) => place(d, s, [12, 20.15], to));

/**
 * Núcleo's document as a pay stub: the perforation across its top (three dashes, edge to edge, where its
 * corners end) and two lines of pay below. A corner badge's clearance crosses the lines and never
 * reaches a dash: a perforation in the lower third left a sliver of a dash at one weight and not at
 * another.
 */
const PAYSLIP = [N.document.d[0], hl(4.75, 7.58, 8.75), hl(10.58, 13.42, 8.75), hl(16.42, 19.25, 8.75), hl(8.75, 15.25, 12), hl(8.75, 12.75, 15.25)];
/**
 * The salary envelope: comunicacion's mail-letter envelope, and comercio's banknote rising out of it,
 * cut 3 short of the envelope's front (behind it).
 */
const SALARY = (() => {
  const env = C['mail-letter'].badge.d[0];
  const note = box(4.25, 3.25, 15.5, 10.5, 2.5);
  return [env, behind(note, [env]), circ(12, 7.5, 1.75), dot(7.6, 7.5), dot(16.4, 7.5)];
})();
/** A stack of three coins edge-on, 7 wide, its top at y 10.75 (comercio's coin stack, straight). */
const coins = (x) => [
  sq(x, 10.75, 7, 3.5, 1.75),
  `M${f(x + 1.75)} 14.25A1.75 1.75 0 0 0 ${f(x + 1.75)} 17.75H${f(x + 5.25)}A1.75 1.75 0 0 0 ${f(x + 5.25)} 14.25`,
  `M${f(x + 1.75)} 17.75A1.75 1.75 0 0 0 ${f(x + 1.75)} 21.25H${f(x + 5.25)}A1.75 1.75 0 0 0 ${f(x + 5.25)} 17.75`,
];

/** A horseshoe magnet facing right: outer radius R about c, arms w thick reaching `arm` past c, pole caps `cap` long. */
const magnetU = (c, R, w, arm, cap) => {
  const [x, y] = c;
  const r = R - w;
  const body = `M${P([x + arm, y - R])}H${f(x)}A${f(R)} ${f(R)} 0 0 0 ${P([x, y + R])}H${f(x + arm)}V${f(y + r)}H${f(x)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y - r])}H${f(x + arm)}Z`;
  return [body, vl(x + arm - cap, y - R, y - r), vl(x + arm - cap, y + r, y + R)];
};
/** `n` dashes along an open path, from its start to its end, `gap` apart along it. */
const dashOpen = (d, n, gap = 3.25) => {
  const { total, run } = along(d);
  const dash = (total - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => run(i * (dash + gap), i * (dash + gap) + dash));
};
/**
 * oficina's desk turned around, its cabinet on the left: the same top and leg, the cabinet 6 wide so a
 * corner badge sits in the knee space, clears only the end of the free leg and never reaches the
 * cabinet at any weight. At that width a drawer's pull would stand 2.25 from the sides: each drawer
 * has a knob.
 */
const DESK_B = [
  hl(2.5, 21.5, 6.75),
  vl(19.25, 6.75, 20.5),
  rline([[3.25, 6.75], [3.25, 20.5], [9.25, 20.5], [9.25, 6.75]], [0, 1, 1, 0]),
  hl(3.25, 9.25, 13.5),
  dot(6.25, 10.13),
  dot(6.25, 17),
];

const icons = {
  // ── Hiring ──
  'now-hiring': {
    tags: ['estamos contratando', 'vacantes abiertas', 'empleo', 'now hiring', "we're hiring", 'careers'],
    // The sign on its two strings, and the person it's looking for, large on the board
    d: [box(2.5, 7.25, 19, 13.5, 3.5), rline([[7.5, 7.25], [12, 2.75], [16.5, 7.25]], [0, 0.9, 0]), ...bust(12, 12.35, 2.25, 20.75, 3.7)],
  },
  'briefcase-plus': {
    tags: ['nueva vacante', 'abrir puesto', 'publicar empleo', 'new job opening', 'add position'],
    d: BRIEFCASE,
    badge: badge('plus'),
  },
  'briefcase-search': {
    tags: ['buscar empleo', 'bolsa de trabajo', 'vacantes', 'job search', 'find jobs'],
    d: BRIEFCASE,
    badge: badge('search'),
  },
  'briefcase-check': {
    tags: ['puesto cubierto', 'contratado', 'empleado', 'position filled', 'hired'],
    d: BRIEFCASE,
    badge: badge('check'),
  },
  'briefcase-clock': {
    tags: ['experiencia laboral', 'antigüedad', 'historial', 'work history', 'tenure'],
    d: BRIEFCASE,
    badge: badge('clock'),
  },
  'briefcase-x': {
    tags: ['vacante cerrada', 'puesto cancelado', 'sin vacante', 'position closed', 'job canceled'],
    d: BRIEFCASE,
    badge: badge('x'),
  },

  'candidate': {
    tags: ['candidato', 'postulante', 'solicitante', 'candidate', 'applicant', 'ats'],
    // The résumé behind, its top-right corner and two lines over the person's shoulder; the person in
    // front, a badge the engine clears
    d: [box(9.75, 2.75, 11.5, 14.5, 3), hl(15.5, 18.25, 6.75), hl(15.5, 18.25, 10)],
    badge: front(personAt(0.82, -3.25, 0.65)),
  },
  'candidate-pipeline': {
    tags: ['etapas de contratación', 'embudo de candidatos', 'seguimiento', 'hiring pipeline', 'applicant tracking'],
    // The applicants over the stages of a process arrow, each stage a chevron
    d: [
      ...[5.5, 12, 18.5].map((x) => circ(x, 6, 1.75)),
      roundpoly([[2.75, 11], [17.75, 11], [21.25, 15], [17.75, 19], [2.75, 19]], [1.5, 0.6, 0.8, 0.6, 1.5]),
      rline([[7, 11], [9.75, 15], [7, 19]], [0, 0.6, 0]),
      rline([[13.5, 11], [16.25, 15], [13.5, 19]], [0, 0.6, 0]),
    ],
  },
  'candidate-screening': {
    tags: ['filtrar candidatos', 'preselección', 'evaluación', 'screening', 'filter applicants'],
    // Two people go into the funnel and one comes out of its spout
    d: [
      roundpoly([[3.5, 8.75], [20.5, 8.75], [13.6, 14.25], [13.6, 15.6], [10.4, 15.6], [10.4, 14.25]], [1.25, 1.25, 0.9, 0.6, 0.6, 0.9]),
      circ(8.25, 4.15, 1.75),
      circ(15.75, 4.15, 1.75),
      circ(12, 20.15, 1.6),
    ],
  },
  'talent-pool': {
    tags: ['bolsa de talento', 'cartera de candidatos', 'banco de talento', 'talent pool', 'talent crm'],
    // Three swimmers: their heads above the waterline (the water in front of them hides the rest) and
    // the pool's second wave below
    d: (() => {
      const w1 = wave(2.75, 21.25, 15.5, 0.75, 7, 1.5);
      const heads = [5, 12, 19].map((x) => behind(circ(x, 10.5, 2.25), [`${w1}L21.25 22L2.75 22Z`]));
      return [...heads, w1, wave(2.75, 21.25, 19.5, 0.75, 7, 1.5)];
    })(),
  },
  'vacancy': {
    tags: ['vacante', 'puesto libre', 'por cubrir', 'vacancy', 'open role', 'unfilled'],
    // Núcleo's person as a dashed placeholder: the seat no one fills yet
    d: [...dashes(PERSON[0], 4, 3.5, 1.75), ...dashes(PERSON[1], 6, 3.5, 1.56)],
  },
  'headcount': {
    tags: ['plantilla', 'número de empleados', 'dotación', 'headcount', 'workforce planning'],
    // Three people (comunicacion's people, spread so the two in back keep their heads), and the
    // bracket that counts them
    d: [...[-6.25, 6.25].flatMap((x) => personAt(0.5, x, -5)), rline([[2.75, 18.75], [2.75, 20.75], [21.25, 20.75], [21.25, 18.75]], [0, 1.25, 1.25, 0])],
    badge: front(personAt(0.62, 0, -3.25)),
  },
  'interview-panel': {
    tags: ['entrevista en panel', 'comité', 'entrevistadores', 'panel interview', 'interview'],
    // The panel behind the table, and the candidate in front of it, seen from behind
    d: [circ(5.25, 5.25, 1.75), circ(12, 5.25, 1.75), circ(18.75, 5.25, 1.75), hl(2.75, 21.25, 10)],
    badge: front(personAt(0.55, 0, 0.65)),
  },
  'job-offer': {
    tags: ['oferta de trabajo', 'propuesta laboral', 'ofrecer empleo', 'job offer', 'offer letter'],
    // comercio's open hand (donation: the cuff and the palm) holding up Núcleo's briefcase
    d: [...comercio.icons.donation.d.slice(1), ...briefcaseAt(0.5, [8.5, 11.25])],
  },
  'talent-magnet': {
    tags: ['atraer talento', 'marca empleadora', 'retención', 'talent attraction', 'employer brand'],
    // A horseshoe magnet, its poles facing the person it pulls
    d: [...magnetU([7.25, 12], 4.75, 3, 3.25, 2), ...personAt(0.55, 5.5, -1)],
  },
  'global-hiring': {
    tags: ['contratación internacional', 'empleador de registro', 'contratistas globales', 'global hiring', 'eor'],
    // The globe behind, its right half showing; Núcleo's briefcase in front
    d: N.globe.d.map((d) => place(d, 0.6, [12, 12], [15.5, 8])),
    badge: (() => {
      const [body, handle, band] = briefcaseAt(0.6, [2.75, 21]);
      return own([body, handle, band], `${body}${shut(handle)}`, { solid: [body], cut: [band], wire: [handle] });
    })(),
  },
  'hiring-freeze': {
    tags: ['congelar contrataciones', 'contratación en pausa', 'sin vacantes', 'hiring freeze', 'hiring paused'],
    d: BRIEFCASE,
    badge: (() => {
      // Six arms, each with a pair of barbs opening toward its tip (lugares' snowflake, at the badge's size)
      const arms = [90, 30, 150].map((a) => line(polar(...BC, 4.75, a), polar(...BC, 4.75, a + 180)));
      const barbs = [-90, -30, 30, 90, 150, 210].map((a) => {
        const m = polar(...BC, 3, a);
        return line(polar(...m, 1.6, a - 45), m, polar(...m, 1.6, a + 45));
      });
      return own([...arms, ...barbs], RING);
    })(),
  },

  'offboarding': {
    tags: ['baja', 'salida de la empresa', 'desvinculación', 'offboarding', 'leaving'],
    // The doorway, the arrow pointing out through it, and the person stepping into it (in front of
    // the door's post: the engine clears it)
    d: [rline([[10.25, 21.25], [10.25, 3.25], [20.75, 3.25], [20.75, 21.25]], [0, 2.25, 2.25, 0]), hl(14, 18.25, 12.25), head([18.25, 12.25], [1, 0], 3.4)],
    badge: front(personAt(0.62, -4, 0.65)),
  },
  'welcome-kit': {
    tags: ['kit de bienvenida', 'onboarding', 'equipo de ingreso', 'welcome kit', 'swag'],
    // The open box, and an id-badge dropped in it, leaning (comunicacion's: its slot and the head of its
    // portrait, 3 apart; the shoulders are inside the box)
    d: (() => {
      const t = (d) => turnPath(d, -12, [12, RIM]);
      return [...OPEN_BOX, clip(t(box(8, 2.75, 8, 16, 2.5)), (p) => p[1] <= RIM), t(hl(11, 13, 5.75)), t(circ(12, 10.1, 1.5))];
    })(),
  },
  'resignation': {
    tags: ['renuncia', 'dimisión', 'dejar el trabajo', 'resignation', 'quitting'],
    // The open box, and the desk plant sticking up out of it (lugares' sprout, its stem on the rim)
    d: [...OPEN_BOX, ...lugares.icons.sprout.d.slice(0, 3).map((d) => place(d, 0.66, [12, 21], [12, RIM]))],
  },
  'rehire': {
    tags: ['recontratar', 'reingreso', 'empleado que regresa', 'rehire', 'boomerang'],
    // The person, and an arrow that goes out to the right and comes back to them
    d: (() => {
      const a = arc(12, 12.25, 7.5, -50, 40);
      return [...personAt(0.92, -3.25, 0), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  'mentorship': {
    tags: ['mentoría', 'mentor', 'acompañamiento', 'mentorship', 'buddy program'],
    // The mentor, the mentee in front of them, and the arrow arching from one head to the other
    d: (() => {
      const a = arc(13.25, 12, 7, 245, 320);
      return [...personAt(0.74, -3.75, 0.65), a.d, head(a.end, a.tangent, 3.4)];
    })(),
    badge: front(personAt(0.5, 5.75, 0.65)),
  },
  'succession-plan': {
    tags: ['plan de sucesión', 'sucesor', 'relevo', 'succession plan', 'successor'],
    // The person in front, and their successor behind them, dashed: the role's next holder. The
    // successor is cut where the front person passes, and only then dashed, so no dash is left short
    d: (() => {
      const me = personAt(0.8, -3.5, 0.65);
      const next = personAt(0.8, 3.75, -2.25);
      const fronts = me.map(shut);
      const head = dashes(next[0], 3, 3.25, 0.5).map((d) => behind(d, fronts)).filter(Boolean);
      const shoulders = parse(behind(next[1], fronts)).map((sp) => ser([sp]));
      return [...me, ...head, ...shoulders.flatMap((d) => dashOpen(d, Math.max(1, Math.round((along(d).total + 3.75) / 6.25)), 3.75))];
    })(),
  },
  'career-growth': {
    tags: ['crecimiento profesional', 'ascenso', 'plan de carrera', 'career growth', 'promotion'],
    // Three steps rising to the right, and the person on the top one
    d: [
      roundpoly([[2.75, 20.75], [2.75, 17.75], [8.75, 17.75], [8.75, 14.75], [14.75, 14.75], [14.75, 11.75], [21.25, 11.75], [21.25, 20.75]], [0.75, 0.75, 0.6, 0.75, 0.6, 0.75, 0.75, 0]),
      ...bust(18, 4.95, 1.6, 11.75, 2.75),
    ],
  },
  'team-lead': {
    tags: ['líder de equipo', 'jefe de equipo', 'responsable', 'team lead', 'leader'],
    // The person, and a pennant on a pole rising behind their shoulder
    d: (() => {
      const me = personAt(0.88, -2.25, 0.65);
      return [...me, behind(vl(16.75, 3, 21), me.map(shut)), roundpoly([[16.75, 3], [21, 5.1], [16.75, 7.2]], [0, 0.6, 0])];
    })(),
  },
  'direct-reports': {
    tags: ['reportes directos', 'equipo a cargo', 'organigrama', 'direct reports', 'manager'],
    // The manager on top, and the line branching down to their two reports
    d: [...personAt(0.42, 0, -10.25), vl(12, 13.25, 15.25), rline([[6, 17.5], [6, 15.25], [18, 15.25], [18, 17.5]], [0, 1.5, 1.5, 0]), circ(6, 19.4, 1.9), circ(18, 19.4, 1.9)],
  },
  'internal-mobility': {
    tags: ['movilidad interna', 'cambio de puesto', 'transferencia', 'internal mobility', 'transfer'],
    // Two briefcases, and the arrow arching from one job to the other
    d: (() => {
      const a = arc(12, 13.5, 6.25, 205, 335);
      return [...briefcaseAt(0.42, [2.75, 20.75]), ...briefcaseAt(0.42, [13.48, 20.75]), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  'job-sharing': {
    tags: ['puesto compartido', 'trabajo compartido', 'dos personas un puesto', 'job sharing', 'shared role'],
    // Two people, and the one briefcase they share in front of them
    d: [...personAt(0.58, -5.25, -2.75), ...personAt(0.58, 5.25, -2.75)],
    badge: (() => {
      const [body, handle, band] = briefcaseAt(0.5, [7.375, 21.25]);
      return own([body, handle, band], `${body}${shut(handle)}`, { solid: [body], cut: [band], wire: [handle] });
    })(),
  },
  'job-description': {
    tags: ['descripción de puesto', 'perfil del puesto', 'vacante', 'job description', 'job profile'],
    // Núcleo's document headed by a briefcase, with two lines of text under it
    d: [N.document.d[0], box(7.25, 7.75, 9.5, 4, 1.5), rline([[10, 7.75], [10, 5.75], [14, 5.75], [14, 7.75]], [0, 0.9, 0.9, 0]), hl(8.75, 15.25, 14.75), hl(8.75, 12.5, 17.75)],
  },

  // ── Time off and leave ──
  'time-off': {
    tags: ['vacaciones', 'días libres', 'tiempo libre', 'time off', 'pto', 'vacation'],
    d: TIME_OFF,
  },
  'time-off-plus': {
    tags: ['solicitar vacaciones', 'pedir días', 'nueva ausencia', 'request time off', 'leave request'],
    d: TIME_OFF,
    badge: badge('plus'),
  },
  'time-off-check': {
    tags: ['vacaciones aprobadas', 'ausencia autorizada', 'aprobado', 'time off approved', 'leave approved'],
    d: TIME_OFF,
    badge: badge('check'),
  },
  'time-off-x': {
    tags: ['vacaciones rechazadas', 'ausencia denegada', 'rechazado', 'time off declined', 'leave declined'],
    d: TIME_OFF,
    badge: badge('x'),
  },
  'time-off-clock': {
    tags: ['vacaciones pendientes', 'por aprobar', 'en revisión', 'time off pending', 'pending approval'],
    d: TIME_OFF,
    badge: badge('clock'),
  },
  'sick-leave': {
    tags: ['incapacidad', 'baja por enfermedad', 'día de enfermedad', 'sick leave', 'sick day'],
    // A bed in profile, the head resting on it at the headboard's end (3 from the headboard) and the
    // blanket over the body, 3 from the head
    d: [vl(3.25, 6.25, 20.75), rline([[3.25, 14.75], [20.75, 14.75], [20.75, 20.75]], [0, 2, 0]), hl(3.25, 20.75, 17.75), circ(8.25, 12.75, 2), sq(13.25, 10.75, 7.5, 4, 2)],
  },
  'parental-leave': {
    tags: ['licencia de maternidad', 'licencia de paternidad', 'permiso parental', 'parental leave', 'maternity leave'],
    // A pram: its hood, the basket and the two wheels
    d: ['M12 10.75V2.75A8.75 8 0 0 1 20.75 10.75', 'M3.25 10.75H20.75C20.75 13.5 18.5 15.25 15.75 15.25H8.25C5.5 15.25 3.25 13.5 3.25 10.75Z', circ(7.75, 19.85, 1.6), circ(16.25, 19.85, 1.6)],
  },
  'on-leave': {
    tags: ['de permiso', 'ausente', 'licencia', 'on leave', 'away'],
    // The person, and the status badge with the pause sign cut out of it
    d: PERSON_L,
    badge: (() => {
      const bars = [vl(16.1, 15.5, 19), vl(18.4, 15.5, 19)];
      return { d: [RING, ...bars], knock: RING, fill: { solid: [RING], cut: bars } };
    })(),
  },
  'badge-tap': {
    tags: ['checar entrada', 'tarjeta de acceso', 'asistencia', 'badge in', 'access card', 'attendance'],
    // comunicacion's id-badge, narrower (its slot, head and shoulders 3 apart), and the contactless
    // waves rising from its upper right
    d: [box(3.25, 6.25, 10.5, 15, 3), hl(7, 10, 9.25), ...bust(8.5, 14, 1.75, 21.25, 2.6), arc(13.75, 10.5, 4.25, -45, 35).d, arc(13.75, 10.5, 7.25, -45, 35).d],
  },

  // ── Where people work ──
  'work-from-home': {
    tags: ['trabajo desde casa', 'home office', 'remoto', 'work from home', 'remote work'],
    // dispositivos' laptop under a roof
    d: [rline([[2.75, 9.75], [12, 2.75], [21.25, 9.75]], [0, 1.5, 0]), ...laptopAt(0.62, [12, 20.5])],
  },
  'hybrid-work': {
    tags: ['trabajo híbrido', 'casa y oficina', 'esquema mixto', 'hybrid work', 'hybrid schedule'],
    // One building split down the middle: half a gabled house on the left, the taller office block
    // with its windows on the right
    d: [
      roundpoly([[3.25, 20.75], [3.25, 11.25], [12, 4.5], [12, 3.25], [20.75, 3.25], [20.75, 20.75]], [1.75, 0.6, 0, 1.75, 1.75, 0]),
      vl(12, 4.5, 20.75),
      rline([[6.25, 20.75], [6.25, 17.25], [9, 17.25], [9, 20.75]], [0, 1, 1, 0]),
      ...[7, 10.5, 14].flatMap((y) => [circ(14.75, y, 0.3), circ(18, y, 0.3)]),
    ],
  },
  'work-from-anywhere': {
    tags: ['trabajo desde cualquier lugar', 'nómada digital', 'remoto', 'work from anywhere', 'digital nomad'],
    // The laptop, and lugares' map pin standing on top of its screen
    d: (() => {
      const lap = laptopAt(0.66, [12, 21]);
      return [...lap, ...pinAt(0.46, [12, 21 - 3.25 - 11 * 0.66])];
    })(),
  },
  'commute': {
    tags: ['traslado', 'trayecto al trabajo', 'transporte', 'commute', 'commuter benefit'],
    // lugares' house (its roof and walls: at half size its door would close up) and Núcleo's briefcase
    // joined by Núcleo's roadmap path, leaving the house's wall 3 under the eave: from home to the job
    d: [
      ...lugares.icons.house.d.slice(0, 2).map((d) => place(d, 0.5, [12, 20.75], [7.5, 21.25])),
      `M10.88 19.5H14.5${arcTo(14.5, 16.5, 3, 90, 0)}V12.25`,
      ...briefcaseAt(0.5, [12, 12.25]),
    ],
  },
  'right-to-disconnect': {
    tags: ['derecho a la desconexión', 'fuera de horario', 'no molestar', 'right to disconnect', 'after hours'],
    // The laptop, and the moon risen over its corner (in front of it: the engine clears the screen)
    d: laptopAt(0.78, [10.5, 21]),
    badge: front([place(lugares.icons.moon.d[0], 0.48, [12, 12], [17.25, 6.25])]),
  },
  'hot-desk': {
    tags: ['escritorio compartido', 'puesto flexible', 'hot desking', 'hot desk', 'flexible seating'],
    // A desk, and the map pin hovering over its middle: any free one
    d: [hl(2.5, 21.5, 13.25), vl(4.75, 13.25, 20.75), vl(19.25, 13.25, 20.75), ...pinAt(0.48, [12, 10.4])],
  },
  'desk-check': {
    tags: ['escritorio reservado', 'reserva confirmada', 'puesto asignado', 'desk booked', 'desk reserved'],
    d: DESK_B,
    badge: badge('check'),
  },
  'desk-plus': {
    tags: ['reservar escritorio', 'apartar puesto', 'nueva reserva', 'book a desk', 'reserve desk'],
    d: DESK_B,
    badge: badge('plus'),
  },
  'desk-x': {
    tags: ['cancelar reserva', 'liberar escritorio', 'puesto libre', 'cancel desk booking', 'release desk'],
    d: DESK_B,
    badge: badge('x'),
  },
  'locker': {
    tags: ['casillero', 'locker', 'guardarropa', 'locker booking', 'storage'],
    // Two lockers side by side: the vents at the top of each door and the handles beside the seam
    d: [box(3.25, 2.75, 17.5, 18.5, 3), vl(12, 2.75, 21.25), hl(6.25, 9, 6.25), hl(15, 17.75, 6.25), hl(6.25, 9, 9.25), hl(15, 17.75, 9.25), vl(9, 12.5, 15), vl(15, 12.5, 15)],
  },

  // ── Reviews and recognition ──
  'performance-review': {
    tags: ['evaluación de desempeño', 'rendimiento', 'revisión anual', 'performance review', 'appraisal'],
    // The person, and a rising trend line passing their shoulder (datos' trend-up, in front, its
    // clearance 2.3 short of the head at 2.1)
    d: personAt(0.9, -3.5, 0.65),
    badge: own(datos.icons['trend-up'].d.map((d) => place(d, 0.62, [20.25, 7.25], [21.25, 11.5]))),
  },
  'feedback-360': {
    tags: ['evaluación 360', 'retroalimentación 360', 'evaluación integral', '360 feedback', '360 review'],
    // The person inside an arrow that runs almost all the way around them
    d: (() => {
      const a = arc(12, 12, 9, -45, 240);
      return [...personAt(0.55, 0, -3.25), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  'peer-feedback': {
    tags: ['retroalimentación entre pares', 'feedback', 'compañeros', 'peer feedback', 'peer review'],
    // Two equals, and the two-headed arrow between them
    d: [...personAt(0.55, -6, 0.65), ...personAt(0.55, 6, 0.65), hl(6.25, 17.75, 5.5), head([17.75, 5.5], [1, 0], 2.75), head([6.25, 5.5], [-1, 0], 2.75)],
  },
  'peer-recognition': {
    tags: ['reconocimiento entre pares', 'felicitación', 'kudos', 'peer recognition', 'praise'],
    d: [...personAt(0.55, -6, 0.65), ...personAt(0.55, 6, 0.65), star(12, 6.5, 3.25)],
  },
  'thank-you-card': {
    tags: ['tarjeta de agradecimiento', 'gracias', 'aprecio', 'thank you card', 'appreciation'],
    // oficina's name tent as a folded card standing open, a heart on its front
    d: [...oficina.icons['name-tent'].d.slice(1, 3).map((d) => place(d, 1.08, [11.5, 13], [11.25, 12.25])), heartAt(9.6, 9.6, 5.25)],
  },
  'nine-box': {
    tags: ['matriz nine box', 'desempeño y potencial', 'revisión de talento', 'nine box', '9-box grid'],
    // The talent review's nine boxes (a closed card, not a risk matrix's open axes; 15 across, as at
    // the square keyline its lines were too much ink), and the star that stands in the top-right one,
    // high performance and high potential: it clears the corner around it as a circle, so the grid's
    // lines end the same at every weight
    d: [box(4.5, 4.5, 15, 15, 3.5), vl(9.5, 4.5, 19.5), vl(14.5, 4.5, 19.5), hl(4.5, 19.5, 9.5), hl(4.5, 19.5, 14.5)],
    badge: (() => {
      const s = star(17, 7.3, 3.75);
      return own([s], circ(17, 7, 3.25), { solid: [s] });
    })(),
  },
  'top-performer': {
    tags: ['mejor desempeño', 'empleado estrella', 'alto rendimiento', 'top performer', 'star employee'],
    // The person framed by two laurel branches (social's laurel)
    d: [...personAt(0.55, 0, -1.75), ...laurel({ R: 7.75, c: [12, 11.75], from: 110, to: 195, at: [150], L: 3.5, W: 2.25, a: 0.5 })],
  },
  'employee-of-the-month': {
    tags: ['empleado del mes', 'reconocimiento', 'destacado', 'employee of the month', 'featured employee'],
    // The portrait on the wall, and the ribbon hanging from its frame
    d: [box(5.25, 2.75, 13.5, 15.5, 3), ...bust(12, 8.5, 2.25, 18.25, 4), roundpoly([[10.25, 18.25], [13.75, 18.25], [13.75, 21.75], [12, 20.6], [10.25, 21.75]], [0, 0, 0.4, 0.3, 0.4])],
  },
  'work-anniversary': {
    tags: ['aniversario laboral', 'cumpleaños', 'celebración', 'work anniversary', 'birthday'],
    // The person in a party hat, tilted, its brim resting on the head and the pom on its tip
    d: (() => {
      const [h, body] = personAt(0.72, -0.5, 0.65);
      const [c, r] = [[11.5, 11.2], 2.664];
      const tilt = 18;
      const u = [Math.sin((tilt * Math.PI) / 180), -Math.cos((tilt * Math.PI) / 180)];
      const v = [-u[1], u[0]];
      const mid = [c[0] + r * u[0], c[1] + r * u[1]];
      const at = (s, t) => [mid[0] + s * v[0] + t * u[0], mid[1] + s * v[1] + t * u[1]];
      const hat = roundpoly([at(-3, 0), at(0, 4.5), at(3, 0)], [0.6, 0.6, 0.6]);
      return [h, body, hat, dot(...at(0, 5.6))];
    })(),
  },

  // ── Growth ──
  'personal-growth': {
    tags: ['desarrollo personal', 'plan de desarrollo', 'crecimiento', 'personal growth', 'development plan'],
    // The person, and a sprout growing out of their head: lugares' sprout, its leaves drawn 3 across
    // (scaled down, they closed up from regular on)
    d: [...personAt(0.66, 0, 0.65), line([12, 9.4], [12, 6.5]), lens([12, 8], [7.5, 5.5], 3), lens([12, 6.5], [16.5, 3.75], 3)],
  },
  'job-training': {
    tags: ['capacitación', 'formación laboral', 'entrenamiento', 'job training', 'upskilling'],
    // Núcleo's briefcase with lugares' mortarboard resting on it
    d: briefcaseAt(0.8, [2.75, 21.25]),
    badge: (() => {
      const [board, , tassel] = lugares.icons['graduation-cap'].d.map((d) => place(d, 0.6, [12, 9.75], [16.75, 6.75]));
      return own([board, tassel], `${board}${knockOf(tassel)}`, { solid: [board], wire: [tassel] });
    })(),
  },
  'learning-path': {
    tags: ['ruta de aprendizaje', 'plan de formación', 'currícula', 'learning path', 'curriculum'],
    // The start, the dotted way climbing to the right, and the mortarboard at its end (lugares': its
    // board and cap; at this size its tassel would hang 1.8 from the cap)
    d: [circ(4.5, 19.5, 1.75), dot(8.25, 16.25), dot(11.25, 13.75), ...lugares.icons['graduation-cap'].d.slice(0, 2).map((d) => place(d, 0.6, [12, 9.75], [16.5, 6.25]))],
  },
  'belonging': {
    tags: ['pertenencia', 'inclusión', 'cuidado', 'belonging', 'inclusion', 'employee care'],
    // The heart, and the person in front of it
    d: [HEART],
    badge: front(personAt(0.6, 0, 0.65)),
  },
  'workplace-conflict': {
    tags: ['conflicto laboral', 'relaciones laborales', 'disputa', 'workplace conflict', 'employee relations'],
    // Two people facing each other, and a spark between them
    d: [...personAt(0.52, -6.25, 0.65), ...personAt(0.52, 6.25, 0.65), line([13.25, 5.5], [10.75, 9], [13.25, 9], [10.75, 12.5])],
  },
  'burnout': {
    tags: ['agotamiento', 'desgaste', 'estrés laboral', 'burnout', 'exhaustion'],
    // A burnt-out match: the stick, its spent head, and the wisp of smoke rising from it
    d: (() => {
      const c = [14.25, 12.75];
      const u = [Math.SQRT1_2, -Math.SQRT1_2];
      return [line([4.25, 20.75], [c[0] - 2.75 * u[0], c[1] - 2.75 * u[1]]), turnPath(sq(c[0] - 2.75, c[1] - 1.9, 5.5, 3.8, 1.9), -45, c), smooth([[16.75, 7.5], [15.75, 5.75], [17, 4.25], [16.25, 2.75]])];
    })(),
  },
  'people-analytics': {
    tags: ['analítica de personas', 'métricas de rrhh', 'indicadores', 'people analytics', 'workforce metrics'],
    // datos' bars rising to the right, each one topped by a person's head
    d: [[3.25, 15.25], [10.13, 12.25], [17, 9.25]].flatMap(([x, y]) => [sq(x, y, 3.75, 20.75 - y, 1.15, { square: ['br'] }), circ(x + 1.875, y - 4.45, 1.6)]),
  },
  'workload': {
    tags: ['carga de trabajo', 'capacidad', 'sobrecarga', 'workload', 'capacity'],
    // The person beside the pile of work assigned to them, three boxes high, 3 from their shoulder
    d: [...personAt(0.55, -5.75, 0.65), sq(13.25, 15.25, 8, 6, 1.5, { square: ['br'] }), sq(13.25, 9.25, 8, 6, 1.5), sq(13.25, 3.25, 8, 6, 1.5)],
  },
  'work-life-balance': {
    tags: ['equilibrio vida trabajo', 'balance', 'bienestar', 'work-life balance', 'wellbeing'],
    // A seesaw, level: the briefcase on one end, the heart on the other
    d: [roundpoly([[12, 14.75], [15, 20.75], [9, 20.75]], [0.6, 0.9, 0.9]), hl(2.75, 21.25, 14.75), ...briefcaseAt(0.45, [2.75, 14.75]), heartAt(17.5, 7.95, 7)],
  },
  'turnover': {
    tags: ['rotación de personal', 'tasa de rotación', 'bajas', 'turnover', 'attrition'],
    // lugares' door inside an arrow that turns all the way around it: people going round through the
    // door. Its knob is a small dot (at the door's size the set's one merged with the frame at 2.1; a
    // revolving door's middle post made it read as an m)
    d: (() => {
      const a = arc(12, 12, 9, -45, 225);
      const door = place(lugares.icons.door.d[0], 0.58, [12, 21.25], [12, 16.75]);
      return [door, dot(12.75, 12.25, 0.3), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },

  // ── Pay ──
  'payslip': {
    tags: ['recibo de nómina', 'talón de pago', 'comprobante', 'payslip', 'pay stub'],
    // Núcleo's document, the stub torn along its perforation at the top
    d: PAYSLIP,
  },
  'payslip-check': {
    tags: ['nómina pagada', 'recibo emitido', 'pago confirmado', 'payroll paid', 'payslip issued'],
    d: PAYSLIP,
    badge: badge('check'),
  },
  'salary': {
    tags: ['salario', 'sueldo', 'pago', 'salary', 'wages'],
    // The envelope (comunicacion's mail-letter), and a banknote sliding out of it
    d: SALARY,
  },
  'payroll': {
    tags: ['nómina', 'correr nómina', 'costo de personal', 'payroll', 'run payroll'],
    // The person, and calendario's coin in front of them
    d: PERSON_L,
    badge: calendario.icons['calendar-coin'].badge,
  },
  'pay-advance': {
    tags: ['adelanto de sueldo', 'anticipo de nómina', 'salario bajo demanda', 'pay advance', 'earned wage access'],
    // comercio's banknote, high on the left, and a status badge with a double forward chevron cut out
    // of it: paid ahead. (On the salary envelope the badge left a sliver of the envelope's corner.) The
    // chevrons are steep and 3.4 apart, so the ink between them holds at 2.1
    d: comercio.icons.banknote.d.map((d) => place(d, 0.8, [2.5, 5.5], [2.5, 2.75])),
    badge: (() => {
      const chev = (x) => line([x - 1.3, BC[1] - 2.2], [x, BC[1]], [x - 1.3, BC[1] + 2.2]);
      const marks = [chev(16.2), chev(19.6)];
      return { d: [RING, ...marks], knock: RING, fill: { solid: [RING], cut: marks } };
    })(),
  },
  'pay-raise': {
    tags: ['aumento de sueldo', 'incremento salarial', 'mérito', 'pay raise', 'merit increase'],
    // A stack of coins, and the arrow rising beside it
    d: [...coins(4.25), vl(17.25, 3.25, 21.25), head([17.25, 3.25], [0, -1], 4.25)],
  },
  'bonus': {
    tags: ['bono', 'incentivo', 'gratificación', 'bonus', 'incentive'],
    // comercio's banknote, low on the left, and a sparkle over its corner, clear of it (on the corner,
    // its clearance cut the note open at one weight and not at another)
    d: [...comercio.icons.banknote.d.map((d) => place(d, 0.8, [2.5, 18.5], [2.5, 20.75])), star4(18.5, 5.25, 3.25)],
  },
  'salary-band': {
    tags: ['banda salarial', 'rango de sueldo', 'tabulador', 'salary band', 'pay range'],
    // The range, cut into three, and the pin marking where the pay sits
    d: [sq(2.75, 13, 18.5, 4.75, 2.375), vl(8.92, 13, 17.75), vl(15.08, 13, 17.75), ...pinAt(0.4, [12, 10.1])],
  },
  'pay-equity': {
    tags: ['equidad salarial', 'igualdad de pago', 'transparencia salarial', 'pay equity', 'equal pay'],
    // Two stacks of coins the same height, and the level across their tops
    d: [...coins(3.25), ...coins(13.75), hl(2.75, 21.25, 7.85)],
  },
  'profit-sharing': {
    tags: ['reparto de utilidades', 'ptu', 'participación', 'profit sharing', 'shared earnings'],
    // The profit cut into three equal shares; one share pulled out of it, and the line between the two
    // left. (A dollar sign in the shares left stood 2.4 from their edges: there is no room for one.)
    d: (() => {
      const c = [11, 13];
      const r = 8;
      const out = polar(0, 0, 2.5, -60);
      const wedge = `M${P([c[0] + out[0], c[1] + out[1]])}L${P(polar(c[0] + out[0], c[1] + out[1], r, -120))}A${r} ${r} 0 0 1 ${P(polar(c[0] + out[0], c[1] + out[1], r, 0))}Z`;
      return [`M${P(polar(...c, r, 0))}A${r} ${r} 0 1 1 ${P(polar(...c, r, -120))}L${P(c)}Z`, wedge, line(c, polar(...c, r, 120))];
    })(),
  },
  'benefits': {
    tags: ['prestaciones', 'beneficios', 'cobertura', 'benefits', 'employee benefits'],
    // lugares' umbrella canopy over the person
    d: [place(lugares.icons.umbrella.d[0], 0.68, [12, 3.5], [12, 2.75]), ...personAt(0.5, 0, 0.65)],
  },
  'retirement': {
    tags: ['retiro', 'pensión', 'ahorro para el retiro', 'retirement', 'pension', 'nest egg'],
    // The nest egg: an egg sitting in a nest, its lower half inside it, and one woven strand across
    // the nest. (comercio's piggy bank with a clock lost half its body to the badge, and its ear closed
    // up at 2.1.)
    d: [
      'M3.25 13.25H20.75C20.75 17.75 16.75 20.75 12 20.75S3.25 17.75 3.25 13.25Z',
      smooth([[8, 16.5], [12, 17.4], [16, 16.5]]),
      clip('M12 3.25C14.75 3.25 16.5 7.25 16.5 10.25C16.5 12.9 14.5 14.75 12 14.75S7.5 12.9 7.5 10.25C7.5 7.25 9.25 3.25 12 3.25Z', (p) => p[1] <= 13.25),
    ],
  },
  'business-trip': {
    tags: ['viaje de negocios', 'viáticos', 'solicitud de viaje', 'business trip', 'travel request'],
    // Núcleo's briefcase, and the set's small plane taking off above its corner, clear of it: lugares'
    // plane in a single line, as calendario and logistica draw it at this size (an outline closed up
    // at 2.1). Its tail fins leave the fuselage's end, so no pocket between them closes up
    d: (() => {
      const T = (pts) => line(...pts.map(([x, y]) => [18.25 + (x - y) * Math.SQRT1_2, 5.5 + (x + y) * Math.SQRT1_2]));
      return [...briefcaseAt(0.7, [2.75, 21.25]), T([[0, -4], [0, 3.75]]), T([[-3.75, 1.5], [0, -0.75], [3.75, 1.5]]), T([[-1.75, 4.75], [0, 3.75], [1.75, 4.75]])];
    })(),
  },

  // ── The team ──
  'employee': {
    tags: ['empleado', 'colaborador', 'expediente', 'employee', 'staff member', 'hris'],
    // Núcleo's person with a lanyard: the cord from the neck down to the badge on the chest
    d: (() => {
      const top = (x) => Math.min(...samples(PERSON[1]).flat().filter((p) => Math.abs(p[0] - x) < 0.06).map((p) => p[1]));
      return [...PERSON, line([9.5, top(9.5)], [12, 16.75], [14.5, top(14.5)]), dot(12, 17.45)];
    })(),
  },
  'freelancer': {
    tags: ['freelance', 'independiente', 'contratista', 'freelancer', 'contractor'],
    // The person behind the laptop's screen, their shoulders resting on its top edge
    d: (() => {
      const top = 12.25;
      const [h, body] = personAt(0.7, 0, -6);
      return [h, clip(body, (p) => p[1] <= top), box(5.5, top, 13, 6, 2), hl(3, 21, 21.25)];
    })(),
  },
  'temp-worker': {
    tags: ['temporal', 'contrato por tiempo determinado', 'periodo de prueba', 'temporary worker', 'fixed-term'],
    d: PERSON_L,
    badge: calendario.icons['calendar-hourglass'].badge,
  },
  'new-hire': {
    tags: ['nuevo ingreso', 'recién contratado', 'nuevo empleado', 'new hire', 'new joiner'],
    d: [...personAt(1, -2.75, 0), star4(18.75, 5.25, 3)],
  },
};


// ── Fill (DESIGN.md › Fill), by index into d ──────────────────────────────────────────────────
// `solid` fills (and keeps its stroke); `closed` is an open outline that encloses a body and fills
// closed with Z without changing the silhouette; `cut` is knocked out at stroke width; `lines` stays a
// line with a 1.5 gap; `wire` stays a line, attached to the fill. Custom badges bring their own fill.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
// Núcleo's briefcase, its handle attached: with a badge or scaled down, a handle standing off the body
// by a clearance doesn't interpolate between weights
const BRIEFCASE_FILL = { solid: [0], wire: [1], cut: [2] };
const PERSON_FILL = { solid: [0, 1] };
const FILL = {
  'now-hiring': { solid: [0], wire: [1], cut: [2, 3] },
  candidate: { solid: [0], cut: [1, 2] },
  'candidate-pipeline': { solid: [0, 1, 2, 3], cut: [4, 5] },
  'candidate-screening': { solid: [0, 1, 2, 3] },
  headcount: { solid: [0, 1, 2, 3], lines: [4] },
  'interview-panel': { solid: [0, 1, 2], lines: [3] },
  // comercio's donation hand (the cuff and the palm, closed along the wrist) and the briefcase on it
  'job-offer': { solid: [0, 2], closed: [1], wire: [3], cut: [4] },
  'talent-magnet': { solid: [0, 3, 4], cut: [1, 2] },
  'global-hiring': { solid: [0], cut: [1, 2] },
  // The doorway closes along the floor; the arrow is knocked out of it
  offboarding: { closed: [0], cut: [1, 2] },
  rehire: { solid: [0, 1], lines: [2, 3] },
  mentorship: { solid: [0, 1], lines: [2, 3] },
  'succession-plan': { solid: [0, 1], lines: range(2, 7) },
  // The bust's shoulders close along the top step
  'career-growth': { solid: [0, 1], closed: [2] },
  'team-lead': { solid: [0, 1, 3], wire: [2] },
  'direct-reports': { solid: [0, 1, 4, 5], wire: [2, 3] },
  'internal-mobility': { solid: [0, 3], wire: [1, 4], lines: [6, 7], cut: [2, 5] },
  'job-sharing': { solid: [0, 1, 2, 3] },
  'job-description': { solid: [0], cut: [1, 2, 3, 4] },
  'nine-box': { solid: [0], cut: [1, 2, 3, 4] },
  'sick-leave': { solid: [3, 4], wire: [0, 1, 2] },
  // The hood closes along the basket's rim
  'parental-leave': { solid: [1, 2, 3], closed: [0] },
  'badge-tap': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'work-from-home': { solid: [1], lines: [0, 2] },
  'hybrid-work': { solid: [0], cut: range(1, 9) },
  'work-from-anywhere': { solid: [0, 2], lines: [1], cut: [3] },
  // lugares' house (its roof and walls close), the road joined to both ends, Núcleo's briefcase
  commute: { closed: [0, 1], wire: [2, 4], solid: [3], cut: [5] },
  'right-to-disconnect': { solid: [0], lines: [1] },
  'hot-desk': { solid: [3], cut: [4], wire: [0, 1, 2] },
  locker: { solid: [0], cut: range(1, 8) },
  'feedback-360': { solid: [0, 1], lines: [2, 3] },
  'peer-feedback': { solid: [0, 1, 2, 3], lines: [4, 5, 6] },
  'peer-recognition': { solid: [0, 1, 2, 3, 4] },
  'thank-you-card': { solid: [0], wire: [1], cut: [2] },
  // The laurel's leaves filled, their stems attached to them
  'top-performer': { solid: [0, 1, 3, 4, 6, 7], wire: [2, 5] },
  'employee-of-the-month': { solid: [0, 3], cut: [1, 2] },
  'work-anniversary': { solid: [0, 1, 2, 3] },
  'personal-growth': { solid: [0, 1, 3, 4], wire: [2] },
  // The start, the steps and the mortarboard (its cap closes along the board)
  'learning-path': { solid: [0, 1, 2, 3], closed: [4] },
  belonging: { solid: [0] },
  'workplace-conflict': { solid: [0, 1, 2, 3], lines: [4] },
  burnout: { solid: [1], wire: [0], lines: [2] },
  'people-analytics': { solid: range(0, 6) },
  'work-life-balance': { solid: [0, 2, 5], wire: [1, 3], cut: [4] },
  turnover: { closed: [0], cut: [1], lines: [2, 3] },
  payslip: { solid: [0], cut: range(1, 6) },
  'payslip-check': { solid: [0], cut: range(1, 6) },
  // The banknote behind the envelope closes 3 above it; its marks are knocked out
  salary: { solid: [0], closed: [1], cut: [2, 3, 4] },
  'pay-advance': { solid: [0], cut: [1, 2, 3] },
  bonus: { solid: [0, 4], cut: [1, 2, 3] },
  'salary-band': { solid: [0, 3], cut: [1, 2] },
  'profit-sharing': { solid: [0, 1], cut: [2] },
  benefits: { solid: [0, 1, 2] },
  // The nest and the egg (closed along the nest's rim) filled, the strand knocked out
  retirement: { solid: [0], closed: [2], cut: [1] },
  employee: { solid: [0, 1], cut: [2, 3] },
  // The shoulders close along the top of the screen in front of them
  freelancer: { solid: [0, 2], closed: [1], lines: [3] },
  'new-hire': { solid: [0, 1, 2] },
};
for (const name of ['briefcase-plus', 'briefcase-search', 'briefcase-check', 'briefcase-clock', 'briefcase-x', 'hiring-freeze', 'job-training']) FILL[name] = BRIEFCASE_FILL;
// The briefcase as Núcleo's fills, the plane over it a line apart
FILL['business-trip'] = { ...BRIEFCASE_FILL, lines: [3, 4, 5] };
for (const name of ['on-leave', 'payroll', 'temp-worker', 'performance-review']) FILL[name] = PERSON_FILL;
// The beach umbrella: the canopy filled, the pole and the sand attached to it
for (const name of ['time-off', 'time-off-plus', 'time-off-check', 'time-off-x', 'time-off-clock']) FILL[name] = { solid: [0], wire: [1, 2] };
// oficina's desk: the cabinet closes along the top, its drawers knocked out, the top and the leg attached
for (const name of ['desk-check', 'desk-plus', 'desk-x']) FILL[name] = { closed: [2], cut: [3, 4, 5], wire: [0, 1] };
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? `${d[i]}Z` : d[i]));
  const pick = (ix) => (ix ?? []).map((i) => d[i]);
  const cut = pick(spec.cut);
  icons[name].fill = { solid, ...(cut.length && { cut }), ...(spec.lines?.length && { lines: pick(spec.lines) }), ...(spec.wire?.length && { wire: pick(spec.wire) }) };
}
// The open box: its body and flaps filled, the rim knocked out so the flaps and what stands in the box
// stay apart from it. The badge fills down to the rim; the plant's leaves fill, its stem stays a line
{
  const rim = hl(4.25, 19.75, RIM);
  const [body, f1, f2, card, slot, face] = icons['welcome-kit'].d;
  icons['welcome-kit'].fill = { solid: [body, f1, f2, `${card}Z`], cut: [rim, slot, face] };
  const [, , , stem, l1, l2] = icons.resignation.d;
  icons.resignation.fill = { solid: [body, f1, f2, l1, l2], cut: [rim], wire: [stem] };
}
// A stack of coins: each coin closes along the one above it, and the seams between them are knocked out
const coinFill = (d, x) => ({ solid: [d[0], `${d[1]}Z`, `${d[2]}Z`], cut: [hl(x, x + 7, 14.25), hl(x, x + 7, 17.75)] });
{
  const { d } = icons['pay-raise'];
  icons['pay-raise'].fill = { ...coinFill(d, 4.25), lines: [d[3], d[4]] };
  const e = icons['pay-equity'].d;
  const [a, b] = [coinFill(e, 3.25), coinFill(e.slice(3), 13.75)];
  icons['pay-equity'].fill = { solid: [...a.solid, ...b.solid], cut: [...a.cut, ...b.cut], lines: [e[6]] };
}
// The pile of work: three boxes, the seams between them knocked out
icons.workload.fill = { solid: icons.workload.d, cut: [hl(11.75, 22.75, 9.25), hl(11.75, 22.75, 15.25)] };
// Lines only (dashes, clipped heads over the water, the grid): their filled version is the outline
for (const name of ['talent-pool', 'vacancy']) icons[name].fill = false;

// ── Named parts (DESIGN.md › Named parts): what animates, changes level or sits under a badge ──
const PARTS = {
  'now-hiring': { sign: [0], strings: [1], person: [2, 3] },
  candidate: { resume: [0, 1, 2] },
  headcount: { back: [0, 1, 2, 3], bracket: [4] },
  'interview-panel': { panel: [0, 1, 2], table: [3] },
  'job-offer': { hand: [0, 1], briefcase: [2, 3, 4] },
  'talent-magnet': { magnet: [0, 1, 2], person: [3, 4] },
  'global-hiring': { globe: [0, 1, 2] },
  offboarding: { door: [0], arrow: [1, 2] },
  'welcome-kit': { box: [0, 1, 2], card: [3, 4, 5] },
  resignation: { box: [0, 1, 2], plant: [3, 4, 5] },
  rehire: { person: [0, 1], arrow: [2, 3] },
  mentorship: { mentor: [0, 1], arrow: [2, 3] },
  'career-growth': { steps: [0], person: [1, 2] },
  'team-lead': { person: [0, 1], flag: [2, 3] },
  'internal-mobility': { from: [0, 1, 2], to: [3, 4, 5], arrow: [6, 7] },
  'job-sharing': { people: [0, 1, 2, 3] },
  'nine-box': { grid: [0, 1, 2, 3, 4] },
  'on-leave': { head: [0], body: [1] },
  'badge-tap': { card: [0, 1, 2, 3], waves: [4, 5] },
  'work-from-anywhere': { laptop: [0, 1], pin: [2, 3] },
  'right-to-disconnect': { laptop: [0, 1] },
  'hot-desk': { desk: [0, 1, 2], pin: [3, 4] },
  'performance-review': { head: [0], body: [1] },
  'feedback-360': { person: [0, 1], arrow: [2, 3] },
  'peer-recognition': { people: [0, 1, 2, 3], star: [4] },
  'thank-you-card': { card: [0, 1], heart: [2] },
  'work-anniversary': { person: [0, 1], hat: [2, 3] },
  'personal-growth': { person: [0, 1], sprout: [2, 3, 4] },
  'learning-path': { path: [0, 1, 2], cap: [3, 4] },
  belonging: { heart: [0] },
  'workplace-conflict': { people: [0, 1, 2, 3], spark: [4] },
  burnout: { match: [0, 1], smoke: [2] },
  'people-analytics': { bars: [0, 2, 4], heads: [1, 3, 5] },
  workload: { person: [0, 1], level: [2, 3, 4] },
  'work-life-balance': { pivot: [0], beam: [1], briefcase: [2, 3, 4], heart: [5] },
  turnover: { door: [0, 1], arrow: [2, 3] },
  salary: { envelope: [0], note: [1, 2, 3, 4] },
  'pay-advance': { note: [0, 1, 2, 3] },
  payroll: { head: [0], body: [1] },
  'pay-raise': { coins: [0, 1, 2], arrow: [3, 4] },
  bonus: { note: [0, 1, 2, 3], sparkle: [4] },
  'salary-band': { band: [0, 1, 2], pin: [3] },
  retirement: { nest: [0, 1], egg: [2] },
  'job-training': { briefcase: [0, 1, 2] },
  'business-trip': { briefcase: [0, 1, 2], plane: [3, 4, 5] },
  'temp-worker': { head: [0], body: [1] },
  'new-hire': { person: [0, 1], sparkle: [2] },
  'parental-leave': { hood: [0], basket: [1], wheels: [2, 3] },
};
for (const name of ['briefcase-plus', 'briefcase-search', 'briefcase-check', 'briefcase-clock', 'briefcase-x', 'hiring-freeze']) PARTS[name] = { body: [0], handle: [1], band: [2] };
for (const name of ['time-off', 'time-off-plus', 'time-off-check', 'time-off-x', 'time-off-clock']) PARTS[name] = { canopy: [0], pole: [1], sand: [2] };
for (const name of ['desk-check', 'desk-plus', 'desk-x']) PARTS[name] = { top: [0], leg: [1], drawers: [2, 3, 4, 5] };
PARTS['payslip-check'] = { slip: [0, 4, 5], perforation: [1, 2, 3] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Levels (DESIGN.md › Levels and values): the pile grows box by box, the bars from short to tall ──
icons.workload.levels = [[2], [3], [4]];
icons['people-analytics'].levels = [[0, 1], [2, 3], [4, 5]];

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
const off = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge or a piece on top: at 58 % it stops reading, and a slash would cut through it
off(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });
// Already inside a circular arrow
off(['feedback-360', 'turnover'], { circle: false });

// ── Mirroring (DESIGN.md › Mirroring): what reads in a direction ──────────────────────────────
// The stages and the steps that advance to the right, the arrows that lead out, back or across, the
// charts and paths that grow, and the pay that comes forward
for (const name of ['candidate-pipeline', 'offboarding', 'rehire', 'mentorship', 'career-growth', 'internal-mobility', 'performance-review', 'learning-path', 'people-analytics', 'pay-advance'])
  icons[name].mirror = true;

// ── Motion (DESIGN.md › Motion): each icon's own gesture ──────────────────────────────────────
const MOTION = {
  'now-hiring': { effect: 'ring', origin: [12, 2.75] },
  'job-offer': { effect: 'bounce', parts: ['briefcase'], vector: [0, -1.5] },
  'talent-magnet': { effect: 'slide', parts: ['person'], vector: [-1.5, 0] },
  'hiring-freeze': { effect: 'spin', parts: ['badge'], origin: BC },
  offboarding: { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'career-growth': { effect: 'bounce', parts: ['person'], vector: [0, -1.5] },
  'team-lead': { effect: 'wiggle', parts: ['flag'], origin: [16.75, 21] },
  'internal-mobility': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'time-off': { effect: 'wiggle', parts: ['canopy', 'pole'], origin: [8.5, 20.75] },
  'time-off-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'briefcase-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'parental-leave': { effect: 'wiggle', origin: [12, 21.45] },
  'badge-tap': { effect: 'beat', parts: ['waves'], origin: [13.75, 10.5] },
  'work-from-anywhere': { effect: 'bounce', parts: ['pin'], vector: [0, -1.5] },
  'hot-desk': { effect: 'bounce', parts: ['pin'], vector: [0, -1.5] },
  'feedback-360': { effect: 'spin', parts: ['arrow'], origin: [12, 12] },
  'peer-recognition': { effect: 'beat', parts: ['star'], origin: [12, 6.5] },
  'nine-box': { effect: 'beat', parts: ['badge'], origin: [17, 7] },
  'thank-you-card': { effect: 'beat', parts: ['heart'], origin: [9.6, 12.25] },
  'work-anniversary': { effect: 'wiggle', parts: ['hat'], origin: [12.32, 8.67] },
  'personal-growth': { effect: 'wiggle', parts: ['sprout'], origin: [12, 9.4] },
  'learning-path': { effect: 'bounce', parts: ['cap'], vector: [0, -1.5] },
  belonging: { effect: 'beat', parts: ['heart'], origin: [12, 12] },
  'workplace-conflict': { effect: 'beat', parts: ['spark'], origin: [12, 9] },
  burnout: { effect: 'float', parts: ['smoke'], vector: [0, -1.5] },
  'work-life-balance': { effect: 'wiggle', parts: ['beam', 'briefcase', 'heart'], origin: [12, 14.75] },
  turnover: { effect: 'spin', parts: ['arrow'], origin: [12, 12] },
  salary: { effect: 'slide', parts: ['note'], vector: [0, -1.5] },
  'pay-advance': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'pay-raise': { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] },
  bonus: { effect: 'beat', parts: ['sparkle'], origin: [18.5, 5.25] },
  'salary-band': { effect: 'bounce', parts: ['pin'], vector: [0, -1.5] },
  retirement: { effect: 'bounce', parts: ['egg'], vector: [0, -1.5] },
  'business-trip': { effect: 'slide', parts: ['plane'], vector: [1.5, -1.5] },
  'temp-worker': { effect: 'spin', parts: ['badge'], origin: BC },
  'new-hire': { effect: 'beat', parts: ['sparkle'], origin: [18.75, 5.25] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

export default { category: 'rrhh', label: 'Recursos humanos', icons };
