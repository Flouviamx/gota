// Marketing y publicidad (marketing and advertising): campaigns, audiences and targeting, leads and
// conversion, search and links, ads on every surface (web, video, apps, the street), the metrics
// and models that measure them, email, brand, promotions, referrals, press and events. Everything
// is computed with the engine (engine/geometry.mjs) on the rules in DESIGN.md. The megaphone and
// the people are comunicacion's, the person is Núcleo's (social's personAt), and every object the
// set already draws (the browser, the phone, the pin, the building, the coin, the eye) is reused,
// never redrawn. Badges are the engine's; a piece that sits on top of another (the pointer, the
// front coin) is a custom badge the engine clears with exact clearance: nothing is trimmed by hand.
import { arc, badge, circ, cursor, dot, drop, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import social from './social.mjs';

// ── Paths as segments ─────────────────────────────────────────────────────────────────────────
// parse() turns an engine `d` into absolute segments (L, C, A) and ser() turns them back. clip()
// keeps the parts of a path where a rule holds: that's how a shape behind another stops at exactly
// 3 center to center from it (behind()), the way the core `clients` draws its second person; and
// dashedAt() breaks an outline into dashes along its true geometry (a dashed copy of a person).
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
  const tk = d.match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
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

const segLen = (s, n = 32) => {
  if (s.t === 'L') return Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  if (s.t === 'A') return Math.abs(s.da) * s.r;
  let [len, a] = [0, pt(s, 0)];
  for (let k = 1; k <= n; k++) {
    const b = pt(s, k / n);
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return len;
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

/** Keeps only the parts of `d` where keep(p) holds (pieces shorter than 0.3 are dropped). */
function clip(d, keep) {
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
      if (segs.reduce((n, s) => n + segLen(s), 0) > 0.3) out.push({ segs, closed: false });
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
 * closer than `gap` (center to center) to their outline is dropped. 3 center to center is the
 * set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep);
}

/**
 * Shortens the open pieces of `ds` whose ends stop near another piece (closer than `min` center to
 * center without touching it), until they stand `min` clear.
 */
function settle(ds, min = 2.9) {
  ds = ds.filter(Boolean);
  const pts = ds.map((d) => samples(d).flat());
  const dist = (p, i) => Math.min(...pts.flatMap((q, j) => (j === i ? [] : q.map((r) => Math.hypot(r[0] - p[0], r[1] - p[1])))));
  return ds
    .map((d, i) => {
      const out = parse(d).map((sp) => {
        if (sp.closed) return sp;
        const bad = (p) => {
          const m = dist(p, i);
          return m > 0.35 && m < min;
        };
        const at = [];
        sp.segs.forEach((s, k) => {
          for (let j = 0; j <= 48; j++) at.push({ k, t: j / 48 });
        });
        const ok = at.map(({ k, t }) => !bad(pt(sp.segs[k], t)));
        let [a, b] = [0, at.length - 1];
        if (!ok[a]) while (a < b && !ok[a]) a++;
        if (!ok[b]) while (b > a && !ok[b]) b--;
        if (a === 0 && b === at.length - 1) return sp;
        const segs = [];
        for (let k = at[a].k; k <= at[b].k; k++) segs.push(sub(sp.segs[k], k === at[a].k ? at[a].t : 0, k === at[b].k ? at[b].t : 1));
        return { segs: segs.filter((s) => segLen(s) > 0.01), closed: false };
      });
      return ser(out);
    })
    .filter(Boolean);
}

/** The t at which a segment has run `len` of its length (linear for lines and arcs). */
function tAt(s, len) {
  const L = segLen(s, 64);
  if (s.t !== 'C') return Math.min(1, Math.max(0, len / L));
  let [lo, hi] = [0, 1];
  for (let j = 0; j < 30; j++) {
    const m = (lo + hi) / 2;
    if (segLen(sub(s, 0, m), 48) < len) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
/**
 * A closed outline broken into dashes at the gaps centered on the outline's points nearest to
 * `gaps` ([x, y] each), each `gap` long: dashes placed where the outline is open enough that the
 * ends across each gap stay 3 apart.
 */
function dashedAt(d, gaps, gap = 3.25) {
  const sp = parse(d)[0];
  const lens = sp.segs.map((s) => segLen(s, 64));
  const total = lens.reduce((a, b) => a + b, 0);
  const posOf = (g) => {
    let [best, at, acc] = [Infinity, 0, 0];
    sp.segs.forEach((s, i) => {
      for (let k = 0; k <= 64; k++) {
        const q = pt(s, k / 64);
        const m = Math.hypot(q[0] - g[0], q[1] - g[1]);
        if (m < best) [best, at] = [m, acc + (lens[i] * k) / 64];
      }
      acc += lens[i];
    });
    return at;
  };
  const cuts = gaps.map(posOf).sort((a, b) => a - b);
  const piece = (s0, s1) => {
    const segs = [];
    let acc = 0;
    for (let k = 0; k < sp.segs.length * 2; k++) {
      const i = k % sp.segs.length;
      const [a, b] = [acc, acc + lens[i]];
      acc = b;
      if (b <= s0 || a >= s1) continue;
      const t0 = s0 > a ? tAt(sp.segs[i], s0 - a) : 0;
      const t1 = s1 < b ? tAt(sp.segs[i], s1 - a) : 1;
      if (t1 - t0 > 1e-6) segs.push(sub(sp.segs[i], t0, t1));
    }
    return ser([{ segs, closed: false }]);
  };
  return cuts.map((c, i) => {
    const next = i + 1 < cuts.length ? cuts[i + 1] : cuts[0] + total;
    return piece(c + gap / 2, next - gap / 2);
  });
}
/**
 * A person's shoulders dashed (a copy, a visitor not yet a customer): gaps at the middle of each
 * side and (on a person large enough for three dashes) at the bottom, where the outline runs
 * straight enough for a clean gap.
 */
const dashedBody = (body, bottom = true, gap = 3.25) => {
  const pts = samples(body).flat();
  const [x0, x1] = [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))];
  const [y0, y1] = [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))];
  const ym = y0 + (y1 - y0) * 0.55;
  return dashedAt(body, [[x0, ym], [x1, ym], ...(bottom ? [[(x0 + x1) / 2, y1]] : [])], gap);
};

/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
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
/** Smooth curve through points (Catmull-Rom → Bézier), for organic lines (comunicacion's). */
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
/** The area a custom badge clears: closed shapes whole, each segment of an open line on its own. */
const knockOf = (...ds) => ser(ds.flatMap((d) => parse(d).flatMap((sp) => (sp.closed ? [sp] : sp.segs.map((s) => ({ segs: [s], closed: false }))))));
/** A custom badge: `d` drawn on top, `knock` cleared with the engine's clearance. */
const own = (d, knock = knockOf(...d), fill) => ({ d, knock, ...(fill && { fill }) });
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });
/** An arc arrow (3.4 arms, DESIGN.md › Arrows): the arc about c of radius r from a0 to a1, and its head. */
const arcArrow = (c, r, a0, a1, arm = 3.4) => {
  const a = arc(c[0], c[1], r, a0, a1);
  return [a.d, head(a.end, a.tangent, arm)];
};
/** A straight arrow from `a` to `b` with arms of `arm` at 45°. */
const arrow = (a, b, arm = 3.4) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], arm)];

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const C = comunicacion.icons;
const BC = [17.25, 17.25];
const RING = circ(BC[0], BC[1], 4.25);
/** Núcleo's person. */
const PERSON = N.person.d;
/**
 * Núcleo's person scaled from the feet (social's personAt): the head moves up to keep its gap
 * from the shoulders, never less than 2.35 between them, so a small person keeps its head apart at 2.1.
 */
const personAt = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};
/** The top of the head of the person at scale s standing on 20.6 (personAt's). */
const headTop = (s) => Math.min(...samples(personAt(s)[0]).flat().map((p) => p[1]));
/** The person at scale s with the middle of its height on (cx, cy). */
const personMid = (s, cx, cy) => personAt(s, cx - 12, cy - (headTop(s) + 20.6) / 2);
/** The person at scale s standing on `foot`, centered on x = cx. */
const personOn = (s, cx, foot) => personAt(s, cx - 12, foot - 20.6);
/** comunicacion's megaphone: the body and the handle (its sound line is left out under a badge). */
const [MEGA, MEGA_HANDLE] = C.megaphone.d;

// ── Campaigns: comunicacion's megaphone and a badge ───────────────────────────────────────────
// The sound line would be left a stub beside the badge's clearance: the badge says the rest.
const MEGA_B = [MEGA, MEGA_HANDLE];
/** Paused: two bars cut out of the badge's solid disc (a status badge of the set's own). */
const PAUSE_B = (() => {
  const bars = [vl(16, 15.5, 19), vl(18.5, 15.5, 19)];
  return own([RING, ...bars], RING, { solid: [RING], cut: bars });
})();

// ── Audiences: three people in a row, seen from behind, facing the screen line ─────────────────
// Núcleo's person at half size, 6.6 apart (their heads 2.9 clear); the shoulders of the two at the
// sides pass behind the one in the middle and stop 3 short of it.
const audience = ({ s = 0.5, gap = 6.6, cx = 12, foot = 19.75, top = 5, x0 = 3.25, x1 = 20.75 } = {}) => {
  const mid = personOn(s, cx, foot);
  const sides = [-gap, gap].map((x) => personOn(s, cx + x, foot));
  return [hl(x0, x1, top), ...settle([...sides.map(([hd]) => hd), ...sides.map(([, body]) => behind(body, mid.map(shut))), ...mid])];
};
const AUDIENCE = audience();
/**
 * Under a corner badge: the row at 0.44 and up, so every head stays clear of the badge at every weight
 * (the right one 9.4 from its center) and the badge takes the place of the right person's shoulders.
 */
const AUDIENCE_B = audience({ s: 0.44, gap: 6.15, cx: 11.1, foot: 14.9, top: 3.25, x0: 2.75, x1: 19.5 });

// ── Targeting: a reticle and what it aims at ─────────────────────────────────────────────────
// A ring of r 8 and four ticks from it out to r 10.25: what sits inside keeps 2.85 from the ring,
// in a circle of r 5.15 (a person, a pin, a phone, a heart, an hourglass, lines of text).
const RETICLE = [circ(12, 12, 8), ...[0, 90, 180, 270].map((a) => line(polar(12, 12, 8, a), polar(12, 12, 10.25, a)))];

// ── Links: Núcleo's link, and a compact one ───────────────────────────────────────────────────
const LINK = N.link.d;
/**
 * calendario's compact link: two hooks of r 3 whose open ends stand 3 apart, and the bar between
 * their centers, on an axis through c at `deg` (-45: Núcleo's diagonal).
 */
const linkAt = (c, deg = -45, r = 3, g = 1.5, cc = 2.25) => {
  const u = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const at = (s, t) => [c[0] + s * u[0] - t * u[1], c[1] + s * u[1] + t * u[0]];
  const loop = (k) => `M${P(at(k * g, -k * r))}L${P(at(k * cc, -k * r))}A${f(r)} ${f(r)} 0 0 1 ${P(at(k * cc, k * r))}L${P(at(k * g, k * r))}`;
  return [loop(-1), loop(1), line(at(-cc, 0), at(cc, 0))];
};

// ── Browser: navegacion's window and its header ───────────────────────────────────────────────
const WINDOW = box(3.25, 3.25, 17.5, 17.5, 4);
const HEADER = hl(3.25, 20.75, 7.75);

// ── Search: the search row (a magnifier and the query), as ventanas' command palette draws it ───
const searchRow = (y = 5) => [circ(4.75, y, 1.75), line(polar(4.75, y, 1.75, 45), [7.5, y + 2.75]), hl(10.75, 21.25, y)];

// ── Bars: a horizontal bar chart of three (datos' chart-bar-horizontal) ────────────────────────
const bars = (x0, widths, ys, h = 3.75) => widths.map((w, i) => sq(x0, ys[i] - h / 2, w, h, 1.15, { square: ['tl', 'bl'] }));

/**
 * sistema's magnet built small: the same outlined arms with rounded caps and pole bands, the arms
 * 2.8 wide (hollow at every weight) and shorter, its gap 2.9. Opening up, its middle on `to`, then
 * turned `deg` about it.
 */
const magnetAt = (deg, to, R = 4.25, r = 1.45, arm = 3.75, cap = 0.6, band = 2.75) => {
  const [x, top] = [to[0], to[1] - (arm + R) / 2];
  const yc = top + arm;
  const body = `M${P([x - R, top + cap])}A${cap} ${cap} 0 0 1 ${P([x - R + cap, top])}H${f(x - r - cap)}A${cap} ${cap} 0 0 1 ${P([x - r, top + cap])}V${f(yc)}A${f(r)} ${f(r)} 0 0 0 ${P([x + r, yc])}V${f(top + cap)}A${cap} ${cap} 0 0 1 ${P([x + r + cap, top])}H${f(x + R - cap)}A${cap} ${cap} 0 0 1 ${P([x + R, top + cap])}V${f(yc)}A${f(R)} ${f(R)} 0 0 1 ${P([x - R, yc])}Z`;
  return [body, hl(x - R, x - r, top + band), hl(x + r, x + R, top + band)].map((d) => turnPath(d, deg, to));
};

// ── Ads: the board, the video frame, the phone, the post and the story ────────────────────────
/** A billboard: the board (a screen, with the signature corner) on two posts, and its catwalk. */
const BILLBOARD = [box(2.5, 3.25, 19, 10.75, 3), vl(7.5, 14, 21.25), vl(16.5, 14, 21.25), hl(4.5, 19.5, 17)];
const VIDEO = box(2.5, 5, 19, 14, 3.5);
/** dispositivos' play triangle. */
const playAt = (cx, cy, s) => place(dispositivos.icons.play.d[0], s, [12.2, 12], [cx, cy]);
const PHONE = dispositivos.icons.smartphone.d;
const POST = social.icons.post.d;
const STORY = social.icons.story.d;
/** comercio's coin: the front coin of `coins` and its sign, scaled by s and centered on c. */
const COIN = (s, c) => comercio.icons.coins.badge.d.map((d) => place(d, s, [9.5, 14.5], c));
const EYE = edicion.icons.eye.d[0];

// ── Metrics: reach's rings and attribution's touchpoints ───────────────────────────────────────
/** The outer ring of reach: four arcs with a person reached, a dot, in each gap. */
const REACH = [45, 135, 225, 315].flatMap((a) => [arc(12, 12, 8.75, a - 90 + 24.5, a - 24.5).d, dot(...polar(12, 12, 8.75, a))]);
/** Three touchpoints on the journey, each under a bar as tall as its credit. */
const attribution = (h) => [
  ...[5, 12, 19].map((x) => circ(x, 19, 1.75)),
  hl(6.75, 10.25, 19),
  hl(13.75, 17.25, 19),
  ...[5, 12, 19].map((x, i) => sq(x - 1.875, 14.4 - h[i], 3.75, h[i], 1.15)),
];

// ── Email, brand, promotions, press and events ────────────────────────────────────────────────
/**
 * The middle of a continuous corner of radius r (sq's smoothing, 0.6), measured from the corner
 * point along each side: a stroke that starts there touches the outline (calendario's).
 */
function cornerMid(r, s = 0.6) {
  const a90 = 90 * (1 - s);
  const L = Math.sin(((a90 / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - a90) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const sag = r - Math.sqrt(r * r - (L * L) / 2);
  return d + L / 2 - sag / Math.SQRT2;
}
/** calendario's small envelope (9 × 6.5): its flap starts at the corners' middles, touching the outline. */
const envelope = (x, y, w = 9, h = 6.5, r = 2) => {
  const u = cornerMid(r);
  return [box(x, y, w, h, r), line([x + u, y + u], [x + w / 2, y + h * 0.55], [x + w - u, y + u])];
};
/** `n` dashes along an open path, `gap` apart, from end to end. */
function dashOpen(d, n, gap = 3) {
  const sp = parse(d)[0];
  const lens = sp.segs.map((s) => segLen(s, 64));
  const total = lens.reduce((a, b) => a + b, 0);
  const dash = (total - (n - 1) * gap) / n;
  const out = [];
  for (let q = 0; q < n; q++) {
    const [s0, s1] = [q * (dash + gap), q * (dash + gap) + dash];
    const segs = [];
    let acc = 0;
    sp.segs.forEach((s, i) => {
      const [a, b] = [acc, acc + lens[i]];
      acc = b;
      if (b <= s0 || a >= s1) return;
      const t0 = s0 > a ? tAt(s, s0 - a) : 0;
      const t1 = s1 < b ? tAt(s, s1 - a) : 1;
      if (t1 - t0 > 1e-6) segs.push(sub(s, t0, t1));
    });
    out.push(ser([{ segs, closed: false }]));
  }
  return out;
}
/** mail-sequence's route: down from the first envelope and across to the second, dashed. */
const dashRoute = (() => {
  const tip = [9.6, 18];
  return [...dashOpen(rline([[5.25, 12.4], [5.25, 18], tip], [0, 2, 0]), 2, 3.4), head(tip, [1, 0], 2.25)];
})();
/** The mirrored drop: a bubble whose corner points to the left. */
const dropL = (cx, cy, r) => flipPath(drop(cx, cy, r), 'x', cx);
/** Star with five points, its valleys at half its radius and its points rounded (social's). */
const star = (cx, cy, R, r = R * 0.49) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? r : R, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.35 : 0.55)));
/** Viral: one arrow that splits in two, and each of those in two again. */
const VIRAL = (() => {
  const [a, b, c] = [[2.75, 12], [6.5, 12], [[12.5, 6.17], [12.5, 17.83]]];
  const tips = [[20.75, 3.25], [20.75, 9.08], [20.75, 14.92], [20.75, 20.75]];
  const out = [line(a, b), ...c.map((n) => line(b, n))];
  tips.forEach((t, i) => {
    const n = c[i < 2 ? 0 : 1];
    out.push(line(n, t), head(t, [t[0] - n[0], t[1] - n[1]], 1.6));
  });
  return out;
})();
/** The press release: a page with its headline and two lines, broadcasting from its corner. */
const PRESS = [box(2.75, 7, 12.5, 14.25, 3), sq(5.6, 9.85, 6.8, 2.5, 1.25), hl(5.75, 12.25, 15.3), hl(5.75, 9.75, 18.25), arc(15.25, 7, 3, -75, -10).d, arc(15.25, 7, 5.85, -62, -10).d];
/** The clipping: a piece of newspaper torn at the bottom (an uneven tear, not a receipt's teeth), a little turned. */
const CLIPPING = turnPath(
  roundpoly(
    [[5, 3.25], [19, 3.25], [19, 18.5], [16.75, 20.25], [14.25, 18.75], [11.5, 20.75], [9, 18.75], [7, 20.25], [5, 18.75]],
    [2.25, 2.25, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4],
  ),
  -8,
  [12, 12],
);
/**
 * The sponsor's banner: a band with swallowtail ends. Its fold lines near each end made it Núcleo's
 * ticket (a band with notched sides and two perforations).
 */
const RIBBON = [roundpoly([[2.25, 7], [21.75, 7], [19.25, 11.75], [21.75, 16.5], [2.25, 16.5], [4.75, 11.75]], 0.75)];
/** An ear seen from the side, open to the left: the helix down to the lobe, and the antihelix. */
const EAR = 'M9.75 9.5C9.75 5.75 12.5 3.25 15.5 3.25C18.75 3.25 21 5.75 21 9C21 12.25 18.5 13.5 17.75 15.5C17 18 16.5 20.75 13.5 20.75C11.75 20.75 10.75 19.75 10.25 18.5';
const EAR_IN = 'M13 9.75C13 7.75 14.25 6.5 15.75 6.5C17.25 6.5 18 7.75 18 9C18 10.5 16.25 11 15.75 12.5';

/**
 * The lead: the person low on the left and the magnet above, open toward it; both stay clear of a
 * corner badge at every weight.
 */
const LEAD = [...personOn(0.46, 5.25, 21), ...magnetAt(225, [11.5, 5.85])];

const icons = {
  // ── Campaigns ──
  'megaphone-plus': {
    tags: ['nueva campaña', 'crear campaña', 'anuncio', 'new campaign', 'create campaign'],
    d: MEGA_B,
    badge: badge('plus'),
  },
  'megaphone-edit': {
    tags: ['borrador de campaña', 'editar campaña', 'campaña', 'draft campaign', 'edit campaign'],
    d: MEGA_B,
    badge: badge('edit'),
  },
  'megaphone-clock': {
    tags: ['campaña programada', 'programar envío', 'campaña', 'scheduled campaign', 'schedule'],
    d: MEGA_B,
    badge: badge('clock'),
  },
  'megaphone-pause': {
    tags: ['campaña en pausa', 'pausar campaña', 'detenida', 'paused campaign', 'pause'],
    d: MEGA_B,
    badge: PAUSE_B,
  },
  'megaphone-check': {
    tags: ['campaña enviada', 'campaña completada', 'publicada', 'campaign sent', 'completed campaign'],
    d: MEGA_B,
    badge: badge('check'),
  },
  'megaphone-sync': {
    tags: ['campaña automatizada', 'campaña recurrente', 'flujo', 'automated campaign', 'recurring campaign'],
    d: MEGA_B,
    badge: badge('sync'),
  },

  // ── Audiences ──
  'audience': {
    tags: ['audiencia', 'público', 'espectadores', 'audience', 'viewers', 'target audience'],
    d: AUDIENCE,
  },
  'audience-segment': {
    tags: ['segmento', 'segmentar audiencia', 'subconjunto', 'segment', 'audience segment'],
    // The audience and a pie with one slice cut out, on the badge's disc: a dashed frame around one
    // person of the row needs 12 across and left no room for the other two
    d: AUDIENCE_B,
    badge: (() => {
      const cut = rline([[17.25, 12.25], [17.25, 17.25], [22.25, 17.25]], [0, 0.4, 0]);
      return own([RING, cut], RING, { solid: [RING], cut: [cut] });
    })(),
  },
  'audience-plus': {
    tags: ['crear audiencia', 'agregar a audiencia', 'audiencia personalizada', 'create audience', 'custom audience'],
    d: AUDIENCE_B,
    badge: badge('plus'),
  },
  'audience-minus': {
    tags: ['excluir audiencia', 'exclusiones', 'quitar audiencia', 'exclude audience', 'exclusions'],
    d: AUDIENCE_B,
    badge: badge('minus'),
  },
  'audience-search': {
    tags: ['investigación de audiencia', 'estudio de mercado', 'buscar audiencia', 'audience research', 'market research'],
    d: AUDIENCE_B,
    badge: badge('search'),
  },
  'audience-sync': {
    tags: ['sincronizar audiencia', 'enviar audiencia', 'crm', 'audience sync', 'sync audience'],
    d: AUDIENCE_B,
    badge: badge('sync'),
  },
  'lookalike': {
    tags: ['audiencia similar', 'público parecido', 'clientes similares', 'lookalike audience', 'similar audience'],
    // The person ≈ its copy: the sign between their heads says "alike". Dashed, the copy's shoulders
    // broke into a face (two cheeks and a chin) at half size, never into a dashed outline. Filled,
    // the copy stays an outline beside the person it copies
    d: (() => {
      const me = personOn(0.5, 5.4, 18.75);
      const ys = samples(me[0]).flat().map((p) => p[1]);
      const hy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const wave = (y) => `M10.1 ${f(y)}C11.1 ${f(y - 0.9)} 12.9 ${f(y + 0.9)} 13.9 ${f(y)}`;
      return [...me, ...personOn(0.5, 18.6, 18.75), wave(hy - 1.625), wave(hy + 1.625)];
    })(),
  },

  // ── Targeting ──
  'targeting-person': {
    tags: ['segmentación', 'público objetivo', 'cliente ideal', 'targeting', 'ideal customer'],
    d: [...RETICLE, ...personMid(0.38, 12, 12)],
  },
  'targeting-location': {
    tags: ['segmentación geográfica', 'ubicación', 'geolocalización', 'geotargeting', 'location targeting'],
    d: [...RETICLE, place(lugares.icons['map-pin'].d[0], 0.5, [12, 11.7], [12, 12]), dot(12, 12 + (10.25 - 11.7) * 0.5)],
  },
  'targeting-device': {
    tags: ['segmentación por dispositivo', 'móvil', 'escritorio', 'device targeting', 'mobile'],
    d: [...RETICLE, place(dispositivos.icons.smartphone.d[0], 0.44, [12, 12], [12, 12])],
  },
  'targeting-interest': {
    tags: ['segmentación por intereses', 'gustos', 'afinidad', 'interest targeting', 'interests'],
    d: [...RETICLE, place('M12 20.5L4.03 12A4.75 4.75 0 1 1 12 7.23A4.75 4.75 0 1 1 19.97 12Z', 0.44, [12, 13.75], [12, 12.4])],
  },
  'targeting-company': {
    tags: ['marketing basado en cuentas', 'empresas objetivo', 'b2b', 'account based marketing', 'abm'],
    // Núcleo's briefcase, drawn small with its proportions (the body half again as wide as it is tall,
    // the handle low and narrow): nearly square, it read as a padlock. A building's windows don't fit
    // the reticle (two columns of them need 9.5)
    d: [...RETICLE, box(7.75, 9.35, 8.5, 5.5, 1.75), rline([[10.38, 9.35], [10.38, 6.85], [13.63, 6.85], [13.63, 9.35]], [0, 0.9, 0.9, 0]), hl(7.75, 16.25, 11.95)],
  },
  'targeting-time': {
    tags: ['programación de anuncios', 'horario', 'franjas horarias', 'dayparting', 'ad schedule'],
    // lugares' hourglass, drawn small with its neck open (2.5) at every weight
    d: [...RETICLE, roundpoly([[9.5, 8], [14.5, 8], [13.25, 12], [14.5, 16], [9.5, 16], [10.75, 12]], [0.75, 0.75, 1, 0.75, 0.75, 1]), hl(9, 15, 8), hl(9, 15, 16)],
  },

  'targeting-content': {
    tags: ['segmentación contextual', 'contenido', 'página', 'contextual targeting', 'content targeting'],
    d: [...RETICLE, hl(8.5, 15.5, 9.15), hl(8.5, 15.5, 12), hl(8.5, 13, 14.85)],
  },
  'retargeting': {
    tags: ['retargeting', 'remarketing', 'volver a impactar', 'retarget', 'remarketing'],
    // The target's outer ring comes back on itself: an arc arrow around the inner ring and the center
    d: [...arcArrow([12, 12], 8.75, -50, 250, 2.75), circ(12, 12, 3.75), dot(12, 12)],
  },

  // ── People and companies ──
  'demographics': {
    tags: ['demografía', 'datos demográficos', 'edad', 'demographics', 'age', 'income'],
    d: [...personOn(0.6, 7, 19.25), ...bars(14.75, [6.5, 4.5, 2.75], [5.13, 12, 18.88])],
  },
  'firmographics': {
    tags: ['firmografía', 'datos de empresa', 'industria', 'firmographics', 'company size', 'industry'],
    // lugares' office building (two rows of windows and the door) beside the bar chart
    d: [box(2.25, 7.25, 9.5, 12.5, 2.75), dot(5.25, 10.5, 0.3), dot(8.75, 10.5, 0.3), dot(5.25, 14, 0.3), dot(8.75, 14, 0.3), rline([[5.5, 19.75], [5.5, 17], [8.5, 17], [8.5, 19.75]], [0, 0.75, 0.75, 0]), ...bars(14.75, [6.5, 4.5, 2.75], [5.13, 12, 18.88])],
  },


  // ── Leads ──
  'lead': {
    tags: ['lead', 'prospecto', 'captación', 'lead magnet', 'lead generation'],
    // sistema's magnet pulling the person toward it
    d: LEAD,
  },
  'lead-plus': {
    tags: ['nuevo lead', 'capturar lead', 'agregar prospecto', 'add lead', 'capture lead'],
    d: LEAD,
    badge: badge('plus'),
  },
  'lead-check': {
    tags: ['lead calificado', 'prospecto calificado', 'mql', 'qualified lead', 'sql'],
    d: LEAD,
    badge: badge('check'),
  },
  'lead-x': {
    tags: ['lead descartado', 'prospecto perdido', 'descalificado', 'lost lead', 'disqualified lead'],
    d: LEAD,
    badge: badge('x'),
  },
  'lead-score': {
    tags: ['puntuación de lead', 'calificación', 'lead scoring', 'lead score', 'score'],
    // The person and a gauge beside its head: the needle shows the score
    d: [...personOn(0.56, 6.3, 20.5), arc(16.75, 10.5, 5.25, 180, 360).d, dot(16.75, 10.5), line([16.75, 10.5], polar(16.75, 10.5, 2.3, -45))],
  },
  'conversion': {
    tags: ['conversión', 'convertir', 'cliente', 'conversion', 'convert', 'goal'],
    // The visitor dashed, the customer whole, and the arrow between their heads
    d: (() => {
      const [hd, body] = personOn(0.5, 5.4, 18.75);
      return [hd, ...dashedBody(body, false, 3.75), ...personOn(0.5, 18.6, 18.75), ...arrow([10.1, 11.05], [13.9, 11.05], 2.25)];
    })(),
  },
  'conversion-path': {
    tags: ['ruta de conversión', 'recorrido del cliente', 'embudo', 'conversion path', 'customer journey'],
    // The start, the winding path, and the path rising into the goal's flag (edicion's flag)
    d: [circ(5.75, 18, 2.5), rline([[5.75, 15.5], [5.75, 11.25], [16, 11.25], [16, 3.25]], [0, 3.25, 3.25, 0]), roundpoly([[16, 3.25], [21.25, 3.25], [19.6, 5.75], [21.25, 8.25], [16, 8.25]], [0, 0.6, 0.4, 0.6, 0])],
  },

  // ── Pages and traffic ──
  'landing-page': {
    tags: ['página de aterrizaje', 'landing', 'página de campaña', 'landing page', 'campaign page'],
    // navegacion's browser with the hero across its top and the call to action under it
    d: [WINDOW, HEADER, sq(7.25, 10.6, 9.5, 2.9, 1.45), hl(10.75, 13.25, 16.4)],
  },
  'web-traffic': {
    tags: ['tráfico web', 'visitas', 'sesiones', 'web traffic', 'visits', 'sessions'],
    // navegacion's browser at 0.72 (a tall window with a header read as a jar) and the visits
    // converging on it from the left
    d: [box(9.25, 5.88, 12.25, 12.25, 3), hl(9.25, 21.5, 9.03), ...arrow([2.5, 12], [6.25, 12], 2.25), ...arrow([2.75, 4.25], [6, 7.5], 2.25), ...arrow([2.75, 19.75], [6, 16.5], 2.25)],
  },
  'exit-intent': {
    tags: ['intención de salida', 'abandono', 'popup de salida', 'exit intent', 'bounce'],
    // The pointer leaving the window across its top edge, the arrow beside it: only the edge is
    // cleared, the header stays whole under the pointer's tail (cut too, it left the window in pieces)
    d: [box(2.5, 11.75, 19, 9.5, 3), hl(2.5, 21.5, 16.25), ...arrow([19.75, 8.25], [19.75, 2.75], 2.25)],
    badge: (() => {
      // Only its tail crosses the edge: the wing stands 3.8 above it and the header 4.3 below the
      // tail, so what the clearance cuts is the same at every weight (between 2.65 and 3.35 it isn't)
      const p = cursor([10.25, 2.25], 0.5);
      return own([p], p, { solid: [p] });
    })(),
  },
  'click-through': {
    tags: ['clics', 'tasa de clics', 'ctr', 'click through', 'clicks'],
    // The pointer's tip on the center of two rings that open where the pointer is: a hit
    d: [arc(9, 9, 3, 100, 380).d, arc(9, 9, 6, 100, 380).d],
    badge: (() => {
      const p = cursor([9, 9], 0.62);
      return own([p], p, { solid: [p] });
    })(),
  },

  // ── Search ──
  'seo': {
    tags: ['seo', 'posicionamiento', 'búsqueda orgánica', 'search engine optimization', 'ranking'],
    d: [N.search.d[0], N.search.d[1], ...arrow([10.6, 14.1], [10.6, 7.35], 2.75)],
  },
  'keyword': {
    tags: ['palabra clave', 'término de búsqueda', 'keywords', 'keyword', 'search term'],
    // The magnifier's handle carries a key's teeth (Núcleo's key)
    d: [circ(9.25, 9.25, 5.75), line(polar(9.25, 9.25, 5.75, 45), [20.75, 20.75]), line([16.5, 16.5], [14.91, 18.09]), line([19.25, 19.25], [17.66, 20.84])],
  },
  'search-results': {
    tags: ['resultados de búsqueda', 'serp', 'buscador', 'search results', 'results page'],
    d: [...searchRow(5), hl(2.75, 19.25, 10.65), hl(2.75, 12.25, 13.5), hl(2.75, 19.25, 17.05), hl(2.75, 12.25, 19.9)],
  },
  'search-ad': {
    tags: ['anuncio de búsqueda', 'resultado patrocinado', 'sem', 'search ad', 'sponsored result'],
    d: [...searchRow(5), box(2.5, 10.6, 19, 10.65, 3.25), sq(5.5, 14.43, 4.5, 3, 1.5), hl(13, 18.5, 15.93)],
  },

  // ── Links ──
  'backlink': {
    tags: ['backlink', 'enlace entrante', 'link building', 'inbound link', 'enlace externo'],
    // The link and an arrow arching from its upper end back over it to the lower one
    d: [...linkAt([12, 12], -45, 3, 1.5, 2.25), ...arcArrow([12, 12], 8.25, -71, -185, 2)],
  },
  'link-shortener': {
    tags: ['acortador de enlaces', 'enlace corto', 'url corta', 'link shortener', 'short link'],
    d: [...linkAt([12, 12]), ...arrow([2.75, 21.25], [6, 18], 2.5), ...arrow([21.25, 2.75], [18, 6], 2.5)],
  },
  'link-tracking': {
    tags: ['enlace rastreado', 'utm', 'seguimiento de clics', 'tracked link', 'link tracking'],
    d: LINK.map((d) => place(d, 1, [12, 12], [10.25, 10.25])),
    badge: (() => {
      const p = cursor([14.25, 13.25], 0.44);
      return own([p], p, { solid: [p] });
    })(),
  },
  'tracking-pixel': {
    tags: ['píxel de seguimiento', 'píxel de conversión', 'etiqueta', 'tracking pixel', 'conversion pixel'],
    // The pixel a sharp square, larger than comunicacion's broadcast point, so the two never read alike
    d: [sq(9.25, 9.25, 5.5, 5.5, 0.6), arc(12, 12, 6.5, -33, 33).d, arc(12, 12, 6.5, 147, 213).d, arc(12, 12, 9.5, -30, 30).d, arc(12, 12, 9.5, 150, 210).d],
  },

  // ── Ads ──
  'billboard': {
    tags: ['valla publicitaria', 'publicidad', 'anuncio', 'billboard', 'advertising', 'out of home'],
    d: BILLBOARD,
  },
  'billboard-plus': {
    tags: ['crear anuncio', 'nuevo anuncio', 'publicidad', 'create ad', 'new ad'],
    d: BILLBOARD,
    badge: badge('plus'),
  },
  'billboard-check': {
    tags: ['anuncio aprobado', 'anuncio activo', 'publicado', 'ad approved', 'ad live'],
    d: BILLBOARD,
    badge: badge('check'),
  },
  'billboard-x': {
    tags: ['anuncio rechazado', 'desaprobado', 'anuncio', 'ad rejected', 'disapproved ad'],
    d: BILLBOARD,
    badge: badge('x'),
  },
  'billboard-clock': {
    tags: ['anuncio programado', 'en revisión', 'anuncio', 'scheduled ad', 'ad in review'],
    d: BILLBOARD,
    badge: badge('clock'),
  },
  'display-ad': {
    tags: ['anuncio display', 'banner', 'anuncio web', 'display ad', 'banner ad'],
    // The page's text at the left, the ad at the right with its marker folded into the corner
    d: [WINDOW, HEADER, hl(6.25, 8.25, 11.5), hl(6.25, 8.25, 14.35), sq(12.6, 10.6, 5.3, 5.3, 1.5), line([15.15, 10.6], [17.9, 13.35])],
  },
  'video-ad': {
    tags: ['anuncio en video', 'pre-roll', 'saltar anuncio', 'video ad', 'skippable ad'],
    // The video and the skip button in its corner (the engine's arrow)
    d: [VIDEO, playAt(9.5, 10.5, 0.55)],
    badge: badge('arrow-right'),
  },

  'interstitial-ad': {
    tags: ['anuncio intersticial', 'pantalla completa', 'anuncio en app', 'interstitial ad', 'full screen ad'],
    // dispositivos' phone with the ad filling its screen and the ad's close mark over the phone's
    // corner, the engine clearing the phone around it. A card wider than the phone over it read as a
    // padlock, the phone its shackle; a close button in a ring (off the status badges' circle it is
    // drawn, not solid) closed its four holes at bold
    d: [PHONE[0], box(9.1, 11, 5.8, 7.4, 1.5)],
    badge: own([line([15.25, 3.25], [20.25, 8.25]), line([20.25, 3.25], [15.25, 8.25])]),
  },
  'rewarded-ad': {
    tags: ['anuncio con recompensa', 'ver para ganar', 'premio', 'rewarded ad', 'reward'],
    // The video with a gift where its play triangle would be (comercio's gift, small: the bow two open loops)
    d: [VIDEO, sq(8.5, 12.15, 7, 4, 1), sq(7.75, 9.65, 8.5, 2.5, 1), vl(12, 9.65, 16.15), arc(10.25, 9.65, 1.75, 180, 360).d, arc(13.75, 9.65, 1.75, 180, 360).d],
  },

  'post-boost': {
    tags: ['promocionar publicación', 'impulsar', 'publicación pagada', 'boost post', 'promote'],
    // social's post and a double chevron rising out of its corner
    d: POST,
    badge: (() => {
      const d = [line([14.5, 17.4], [17.25, 14.65], [20, 17.4]), line([14.5, 20.4], [17.25, 17.65], [20, 20.4])];
      return own(d, `${RING}${knockOf(...d)}`);
    })(),
  },
  'swipe-up': {
    tags: ['deslizar hacia arriba', 'enlace en historia', 'llamada a la acción', 'swipe up', 'story link'],
    // social's story with the chevron over a short bar near its bottom edge
    d: [...STORY, line([9.25, 14.25], [12, 11.5], [14.75, 14.25]), hl(10, 14, 17.85)],
  },
  'pay-per-click': {
    tags: ['pago por clic', 'ppc', 'costo por clic', 'pay per click', 'cpc'],
    d: COIN(1.05, [10.5, 10.5]),
    badge: (() => {
      const p = cursor([14.5, 13.25], 0.44);
      return own([p], p, { solid: [p] });
    })(),
  },
  'acquisition-cost': {
    tags: ['costo de adquisición', 'cac', 'costo por cliente', 'acquisition cost', 'cost per acquisition'],
    // The coin and the customer standing in front of its lower half
    d: COIN(1, [14.25, 9.5]),
    badge: (() => {
      const d = personOn(0.62, 8.25, 21.25);
      return own(d, d.map(shut).join(''), { solid: d.map(shut) });
    })(),
  },

  // ── Out of home ──
  'digital-signage': {
    tags: ['señalización digital', 'pantalla publicitaria', 'tótem', 'digital signage', 'dooh'],
    d: [box(6.25, 2.75, 11.5, 14, 3), playAt(12.3, 9.75, 0.55), vl(12, 16.75, 21), hl(8.5, 15.5, 21)],
  },
  'sidewalk-sign': {
    tags: ['caballete', 'pizarra de banqueta', 'letrero', 'sidewalk sign', 'a-frame sign'],
    // The frame runs on down as its legs; the board sits inside it
    d: [line([2.75, 21.25], [4.5, 2.75], [19.5, 2.75], [21.25, 21.25]), roundpoly([[7.1, 5.6], [16.9, 5.6], [17.85, 15.75], [6.15, 15.75]], 1), hl(10, 14, 8.45), hl(10, 14, 11.3)],
  },

  'roll-up-banner': {
    tags: ['roll up', 'banner de pie', 'display', 'roll-up banner', 'pull-up banner'],
    // The banner hanging from its top rail, standing on the cassette
    d: [hl(5.75, 18.25, 2.75), sq(7.5, 2.75, 9, 15.5, 0.75, { square: ['tl', 'tr'] }), circ(12, 8.25, 1.75), hl(10.4, 13.6, 13.25), sq(4.25, 18.25, 15.5, 3, 1.5)],
  },

  'pole-banner': {
    tags: ['pendones', 'banner de poste', 'publicidad urbana', 'pole banner', 'street banner'],
    d: [vl(12, 2.5, 21.25), hl(4, 20, 4.75), hl(4, 20, 15.75), sq(4, 4.75, 5.15, 11, 1, { square: ['tl', 'tr'] }), sq(14.85, 4.75, 5.15, 11, 1, { square: ['tl', 'tr'] })],
  },
  'mobile-billboard': {
    tags: ['valla móvil', 'camión publicitario', 'publicidad en movimiento', 'mobile billboard', 'ad truck'],
    d: [...comercio.icons.truck.d, sq(5.35, 6.85, 6.3, 4.3, 1)],
  },

  // ── Metrics and models ──
  'impressions': {
    tags: ['impresiones', 'vistas', 'alcance', 'impressions', 'views'],
    // edicion's eye and two echoes of its outline behind it
    d: [place(EYE, 0.72, [12, 12], [9.25, 12]), circ(9.25, 12, 2.35), arc(9.25, 12, 9.9, -28, 28).d, arc(9.25, 12, 12.75, -24, 24).d],
  },
  'reach': {
    tags: ['alcance', 'personas alcanzadas', 'audiencia única', 'reach', 'unique users'],
    d: [dot(12, 12), circ(12, 12, 4.5), ...REACH],
  },
  'attribution': {
    tags: ['atribución', 'modelo de atribución', 'puntos de contacto', 'attribution', 'multi-touch'],
    d: attribution([7, 10, 4.75]),
  },
  'attribution-first-touch': {
    tags: ['primer contacto', 'atribución', 'primer clic', 'first touch', 'first click'],
    d: attribution([11, 3.75, 3.75]),
  },
  'attribution-last-touch': {
    tags: ['último contacto', 'atribución', 'último clic', 'last touch', 'last click'],
    d: attribution([3.75, 3.75, 11]),
  },

  // ── Email ──
  'newsletter': {
    tags: ['boletín', 'newsletter', 'suscriptores', 'email marketing', 'issue'],
    // comunicacion's mail-letter: the issue rising out of the envelope, its masthead and first line
    d: [C['mail-letter'].d[0], sq(9.35, 5.85, 5.3, 2.75, 1.25), hl(9.35, 14.65, 11.45)],
    badge: C['mail-letter'].badge,
  },

  'mail-sequence': {
    tags: ['secuencia de correos', 'campaña de goteo', 'automatización', 'email sequence', 'drip campaign'],
    // Two envelopes on the diagonal; the dashed route from one down and across to the other
    d: [...envelope(2.5, 3), ...envelope(12.5, 14.75), ...dashRoute],
  },

  // ── Brand ──
  'ambassador': {
    tags: ['embajador de marca', 'promotor', 'influencer', 'brand ambassador', 'advocate'],
    // The person and the sash across its chest, from the shoulder to the hip
    d: (() => {
      const [hd, body] = PERSON;
      const poly = samples(body)[0];
      const inside = (p) => inPoly(poly, p);
      const sash = (k) => clip(line([3 + k, 12.25 - k], [17 + k, 26.25 - k]), inside);
      return [hd, body, sash(0), sash(4.25)];
    })(),
  },
  'branding': {
    tags: ['branding', 'marca', 'identidad de marca', 'brand', 'brand identity'],
    // A branding iron: the T handle, the long rod down to the stamp, its face a star, and the heat rising off it
    d: [circ(7.5, 16.5, 4.75), star(7.5, 16.75, 2.35), line(polar(7.5, 16.5, 4.75, -45), [18.75, 5.25]), line([16.75, 3.25], [20.75, 7.25]), smooth([[2.75, 9.25], [3.5, 7.5], [2.75, 5.75], [3.5, 4]]), smooth([[6.5, 8], [7.25, 6.25], [6.5, 4.5], [7.25, 2.75]])],
  },


  'positioning-map': {
    tags: ['mapa de posicionamiento', 'mapa perceptual', 'competencia', 'positioning map', 'perceptual map'],
    d: [hl(2.75, 21.25, 12), vl(12, 2.75, 21.25), dot(6.5, 6.5), dot(17.5, 17.5), place(lugares.icons['map-pin'].d[0], 0.38, [12, 11.7], [17.5, 6.25]), dot(17.5, 6.25 + (10.25 - 11.7) * 0.38, 0.3)],
  },
  'differentiation': {
    tags: ['diferenciación', 'destacar', 'propuesta de valor', 'differentiation', 'stand out'],
    d: [...[4.5, 12, 19.5].flatMap((y) => [4.5, 12, 19.5].map((x) => (x === 12 && y === 12 ? circ(12, 12, 3) : dot(x, y))))],
  },

  // ── Promotions ──
  'flash-sale': {
    tags: ['venta relámpago', 'oferta flash', 'tiempo limitado', 'flash sale', 'limited time'],
    // comercio's price tag with a bolt through its body
    d: [comercio.icons['price-tag'].d[0], comercio.icons['price-tag'].d[1], line([15.25, 11.75], [13.25, 14.75], [15.5, 14.25], [13.5, 17.25])],
  },
  'prize-wheel': {
    tags: ['ruleta de premios', 'gira y gana', 'sorteo', 'spin to win', 'prize wheel'],
    d: [circ(12, 13.25, 8), dot(12, 13.25), ...[0, 60, 120, 180, 240, 300].map((a) => line(polar(12, 13.25, 3.6, a), polar(12, 13.25, 8, a)))],
    badge: (() => {
      const t = roundpoly([[10.25, 2.25], [13.75, 2.25], [12, 6.5]], [0.7, 0.7, 0.5]);
      return own([t], t, { solid: [t] });
    })(),
  },
  'scratch-card': {
    tags: ['raspadito', 'rasca y gana', 'premio instantáneo', 'scratch card', 'instant win'],
    // The card, the scratched zigzag and the coin's edge scraping at its corner
    d: [box(2.5, 4.5, 19, 13, 3.5), line([6.25, 13.25], [8.25, 8.25], [10.25, 13.25], [12.25, 8.25], [14.25, 13.25])],
    badge: (() => {
      const coin = circ(17.25, 17.25, 4.25);
      const rim = circ(17.25, 17.25, 2);
      return own([coin, rim], coin, { solid: [coin], cut: [rim] });
    })(),
  },

  'raffle': {
    tags: ['rifa', 'sorteo', 'tómbola', 'raffle', 'giveaway', 'sweepstakes'],
    // The hexagonal drum on its legs, the crank on its axle
    d: [roundpoly([0, 60, 120, 180, 240, 300].map((a) => polar(10.75, 10, 7.25, a)), 1.25), dot(10.75, 10), rline([[17.81, 10], [21.25, 10], [21.25, 13.25]], [0, 0.75, 0]), line([8.5, 16.28], [6.25, 21.25]), line([13, 16.28], [15.25, 21.25])],
  },
  'sneak-peek': {
    tags: ['adelanto', 'avance', 'próximamente', 'sneak peek', 'teaser', 'coming soon'],
    // The top half of edicion's eye rising over a wall, its pupil resting on the wall's edge
    d: ['M5.75 15.5C7.5 10.25 9.5 7.75 12 7.75S16.5 10.25 18.25 15.5', circ(12, 13, 2.5), box(2.5, 15.5, 19, 5.75, 2)],
  },


  // ── Referrals ──
  'referral': {
    tags: ['referido', 'recomendar', 'programa de referidos', 'referral', 'refer a friend'],
    d: [...personOn(0.5, 5.4, 21), ...personOn(0.5, 18.6, 21), ...arcArrow([12, 12.25], 7, 218, 322, 2.75)],
  },
  'affiliate-link': {
    tags: ['enlace de afiliado', 'comisión', 'afiliados', 'affiliate link', 'commission'],
    // The link hooked into a coin (comercio's): the commission it earns
    d: [...linkAt([17.2, 6.8]), ...COIN(1, [8.75, 15.25])],
  },

  'word-of-mouth': {
    tags: ['boca a boca', 'recomendación', 'recomendar', 'word of mouth', 'recommendation'],
    // Two people and the word passing between their heads, its corner toward the one who says it
    // (with the bubble above them it was social's `discussion`)
    d: (() => {
      const me = personOn(0.44, 4.95, 20.6);
      const ys = samples(me[0]).flat().map((p) => p[1]);
      return [...me, ...personOn(0.44, 19.05, 20.6), dropL(12, (Math.min(...ys) + Math.max(...ys)) / 2 - 0.5, 2.75)];
    })(),
  },

  'viral': {
    tags: ['viral', 'compartido', 'difusión', 'viral', 'spread', 'shares'],
    d: VIRAL,
  },

  // ── Press ──
  'press-release': {
    tags: ['comunicado de prensa', 'boletín de prensa', 'anuncio', 'press release', 'announcement'],
    d: PRESS,
  },
  'press-release-clock': {
    tags: ['embargo', 'comunicado programado', 'prensa', 'embargoed release', 'scheduled release'],
    d: PRESS,
    badge: badge('clock'),
  },
  'press-conference': {
    tags: ['conferencia de prensa', 'declaración', 'medios', 'press conference', 'media statement'],
    // Three microphones on the lectern (a head over its grille band, as dispositivos' handheld), the
    // middle one taller
    d: [box(4.25, 16.75, 15.5, 4.5, 1.5), ...[[6.25, 5.25], [12, 3.25], [17.75, 5.25]].flatMap(([x, y]) => [sq(x - 1.625, y, 3.25, 6.25, 1.625), hl(x - 1.625, x + 1.625, y + 3.5), vl(x, y + 6.25, 16.75)])],
  },


  'press-clipping': {
    tags: ['recorte de prensa', 'cobertura', 'mención en medios', 'press clipping', 'media coverage'],
    // A piece torn out of the newspaper, a little turned: archivos' newspaper content (the headline,
    // the photo and its lines) over a torn bottom edge. Lines alone over a zigzag were comercio's receipt
    d: [CLIPPING, ...[hl(8, 16, 7.25), sq(7.75, 10.25, 3, 5, 1), hl(13.75, 16, 11), hl(13.75, 16, 14.25)].map((d) => turnPath(d, -8, [12, 12]))],
  },

  // ── Events ──
  'sponsorship': {
    tags: ['patrocinio', 'patrocinador', 'evento patrocinado', 'sponsorship', 'sponsor'],
    d: RIBBON,
  },
  'webinar': {
    tags: ['webinar', 'seminario en línea', 'presentación', 'webinar', 'online event'],
    d: [box(2.5, 3, 19, 13, 3.5), ...personMid(0.34, 12, 9.5), dot(6.75, 19.75), dot(12, 19.75), dot(17.25, 19.75)],
  },
  'trade-show-booth': {
    tags: ['stand de feria', 'expo', 'feria comercial', 'trade show booth', 'expo booth'],
    d: [box(3.25, 2.75, 17.5, 5, 2), vl(4.75, 7.75, 21.25), vl(19.25, 7.75, 21.25), box(7.75, 12.75, 8.5, 8.5, 1.75), hl(7.75, 16.25, 15.6)],
  },
  'social-listening': {
    tags: ['escucha social', 'monitoreo de marca', 'menciones', 'social listening', 'brand monitoring'],
    d: [EAR, EAR_IN, drop(4.75, 13.25, 3)],
  },
};

// ── Fill (DESIGN.md › Fill), by index into d ──
// `solid` is filled (and keeps its stroke); `closed` is an open outline that encloses a body and is
// filled closed with Z (the megaphone's handle, the eye over the wall); `cut` is knocked out at
// stroke width; `lines` stays a line with a gap of paper; `wire` stays a line flush with the body.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const MEGAPHONES = ['megaphone-plus', 'megaphone-edit', 'megaphone-clock', 'megaphone-pause', 'megaphone-check', 'megaphone-sync'];
const AUDIENCES = ['audience', 'audience-segment', 'audience-plus', 'audience-minus', 'audience-search', 'audience-sync'];
const TARGETING = ['targeting-person', 'targeting-location', 'targeting-device', 'targeting-interest', 'targeting-company', 'targeting-time', 'targeting-content'];
const LEADS = ['lead', 'lead-plus', 'lead-check', 'lead-x'];
const BILLBOARDS = ['billboard', 'billboard-plus', 'billboard-check', 'billboard-x', 'billboard-clock'];
const ATTRIBUTION = ['attribution', 'attribution-first-touch', 'attribution-last-touch'];
const FILL = {
  // The megaphone as comunicacion fills it: the body solid, the handle closed along the body's edge
  ...Object.fromEntries(MEGAPHONES.map((n) => [n, { solid: [0], closed: [1] }])),
  // The heads and the person in the middle filled; the shoulders behind stay lines, as social's people
  ...Object.fromEntries(AUDIENCES.map((n) => [n, { solid: [1, 2, 5, 6], lines: [0, 3, 4] }])),
  // The copy stays dashed: lines beside the person filled
  lookalike: { solid: [0, 1], lines: [2, 3, 4, 5] },
  // The reticle's ring filled (its ticks flush with it) and what it aims at knocked out
  ...Object.fromEntries(TARGETING.map((n) => [n, { solid: [0], wire: [1, 2, 3, 4], cut: range(5, icons[n].d.length - 1) }])),
  retargeting: { solid: [2], cut: [3], lines: [0, 1] },
  demographics: { solid: [0, 1, 2, 3, 4] },
  firmographics: { solid: [0, 6, 7, 8], cut: [1, 2, 3, 4, 5] },
  ...Object.fromEntries(LEADS.map((n) => [n, { solid: [0, 1, 2], cut: [3, 4] }])),
  // The gauge as datos fills it: the hub solid, the dial a line, the needle flush with the hub
  'lead-score': { solid: [0, 1, 3], lines: [2], wire: [4] },
  // The visitor stays an outline, dashed; the customer is filled
  conversion: { solid: [3, 4], lines: [0, 1, 2, 5, 6] },
  'conversion-path': { solid: [0, 2], wire: [1] },
  'landing-page': { solid: [0], cut: [1, 2, 3] },
  'web-traffic': { solid: [0], cut: [1], lines: [2, 3, 4, 5, 6, 7] },
  'exit-intent': { solid: [0], cut: [1], lines: [2, 3] },
  // The lens filled, its handle flush with it (the engine's search glyph)
  seo: { solid: [0], wire: [1], cut: [2, 3] },
  keyword: { solid: [0], wire: [1, 2, 3] },
  'search-results': { solid: [0], wire: [1], lines: [2, 3, 4, 5, 6] },
  'search-ad': { solid: [0, 3], wire: [1], lines: [2], cut: [4, 5] },
  'tracking-pixel': { solid: [0], lines: [1, 2, 3, 4] },
  ...Object.fromEntries(BILLBOARDS.map((n) => [n, { solid: [0], wire: [1, 2, 3] }])),
  // The ad's corner marker stays out of the fill: cut, it left an island of ink that came and went
  'display-ad': { solid: [0], cut: [1, 2, 3, 4] },
  'video-ad': { solid: [0], cut: [1] },
  'interstitial-ad': { solid: [0], cut: [1] },
  // The gift filled inside the frame's outline (see below): cut out of a filled frame, the bow's loops
  // closed into islands of ink that came and went with the weight, and without them it was an archive box
  'rewarded-ad': { solid: [1, 2], wire: [4, 5], lines: [0] },
  'post-boost': { solid: [0], cut: [1, 2, 3] },
  'swipe-up': { solid: [0], lines: [1, 2, 3], cut: [4, 5] },
  'pay-per-click': { solid: [0], cut: [1, 2, 3] },
  'acquisition-cost': { solid: [0], cut: [1, 2, 3] },
  'digital-signage': { solid: [0], cut: [1], wire: [2, 3] },
  'sidewalk-sign': { solid: [1], cut: [2, 3], lines: [0] },
  'roll-up-banner': { solid: [1, 4], cut: [2, 3], wire: [0] },
  'pole-banner': { solid: [3, 4], wire: [0, 1, 2] },
  'mobile-billboard': { solid: [0, 2, 3], closed: [1], cut: [4] },
  impressions: { solid: [0], cut: [1], lines: [2, 3] },
  reach: { solid: [1], cut: [0], lines: range(2, 9) },
  ...Object.fromEntries(ATTRIBUTION.map((n) => [n, { solid: [0, 1, 2, 5, 6, 7], wire: [3, 4] }])),
  newsletter: { solid: [0], cut: [1, 2] },
  'mail-sequence': { solid: [0, 2], cut: [1, 3], lines: [4, 5, 6] },
  ambassador: { solid: [0, 1], cut: [2, 3] },
  branding: { solid: [0], cut: [1], wire: [2, 3], lines: [4, 5] },
  'positioning-map': { solid: [2, 3, 4], cut: [5], lines: [0, 1] },
  differentiation: { solid: range(0, 8) },
  'flash-sale': { solid: [0], cut: [1, 2] },
  'prize-wheel': { solid: [0], cut: range(1, 7) },
  'scratch-card': { solid: [0], cut: [1] },
  raffle: { solid: [0], cut: [1], wire: [2, 3, 4] },
  'sneak-peek': { solid: [2], closed: [0], cut: [1] },
  referral: { solid: [0, 1, 2, 3], lines: [4, 5] },
  'affiliate-link': { solid: [3], cut: [4, 5, 6], wire: [0, 1, 2] },
  'word-of-mouth': { solid: [0, 1, 2, 3, 4] },
  'press-release': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'press-release-clock': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'press-conference': { solid: [0, 1, 4, 7], cut: [2, 5, 8], wire: [3, 6, 9] },
  'press-clipping': { solid: [0], cut: [1, 2, 3, 4] },
  sponsorship: { solid: [0] },
  webinar: { solid: [0, 3, 4, 5], cut: [1, 2] },
  'trade-show-booth': { solid: [0, 3], wire: [1, 2], cut: [4] },
  // The ear closes along its front edge; the antihelix is knocked out
  'social-listening': { solid: [2], closed: [0], cut: [1] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? shut(d[i]) : d[i]));
  const pick = (ix) => ix.map((i) => d[i]);
  icons[name].fill = { solid, ...(spec.cut?.length && { cut: pick(spec.cut) }), ...(spec.lines?.length && { lines: pick(spec.lines) }), ...(spec.wire?.length && { wire: pick(spec.wire) }) };
}
// The truck's sliding door, as comercio cuts it
icons['mobile-billboard'].fill.cut.unshift('M14.5 7.5V14');
// The ribbon runs through the whole gift, lid, bow knot and all, and the lid is parted from the box:
// cuts that go through at every weight
icons['rewarded-ad'].fill.cut = [vl(12, 7.25, 17), hl(7, 17, 12.15)];
// Lines only: links, the clicks around the pointer, the spreading arrows
for (const name of ['backlink', 'link-shortener', 'link-tracking', 'click-through', 'viral']) icons[name].fill = false;

// ── 16 px (DESIGN.md › 16 px): drawings of their own where the snap leaves a smudge ──
// One pixel is 1.5 of the canvas: pixel centers fall on 0.75 + 1.5k, edges on 1.5k. Small people
// (social's person16), the magnet, the reticle's contents and the links keep fewer pieces, one
// pixel apart; standard badges are passed at their pixel size, as a drawing of its own skips them.
/**
 * social's person at 16 px: the head a 2 × 2 pixel dot on a pixel corner (x, y), the shoulders a half
 * disc 3 pixels across whose base falls on a pixel center.
 */
const person16 = (x, y) => [dot(x, y, 1), `M${f(x - 2.25)} ${f(y + 6.75)}A2.25 2.25 0 0 1 ${f(x + 2.25)} ${f(y + 6.75)}Z`];
const small = (name, d, fill, badge_) => {
  icons[name].small = { d, ...(fill && { fill }), ...(badge_ && { badge: badge_ }) };
};
const badgeOf = (name) => {
  const b = icons[name].badge;
  return b.kind ? badge(b.kind, { size: 16 }) : b;
};
{
  // The row a pixel apart (spaced 5), under the screen; under a badge, the row goes up without its
  // screen and the badge takes the place of the third one's shoulders
  const row = (y) => [4.5, 12, 19.5].flatMap((x) => person16(x, y));
  const people = row(12);
  const screen = hl(2.25, 21.75, 6.75);
  small('audience', [screen, ...people], { solid: people, lines: [screen] });
  const up = row(3);
  for (const name of ['audience-plus', 'audience-minus', 'audience-search', 'audience-sync']) small(name, up, { solid: up }, badgeOf(name));
  // The pie as the engine's pixel badges are drawn: a face of 6 pixels, its slice cut out
  const face = circ(17.25, 17.25, 4.5);
  const slice = line([17.25, 12.75], [17.25, 17.25], [21.75, 17.25]);
  small('audience-segment', up, { solid: up }, { d: [face, slice], knock: face, fill: { solid: [face], cut: [slice] } });
}
{
  // The person, its copy and the sign between their heads, its waves flattened to two pixel rows
  const me = person16(4.5, 9);
  const copy = person16(19.5, 9);
  const sign = [hl(9.75, 14.25, 8.25), hl(9.75, 14.25, 11.25)];
  small('lookalike', [...me, ...copy, ...sign], { solid: me, lines: [...copy, ...sign] });
  // Word of mouth: the two people a row apart and the bubble between their heads, 3 pixels across
  const pair = [...person16(4.5, 12), ...person16(19.5, 12)];
  const word = dropL(12, 10.5, 2.25);
  small('word-of-mouth', [...pair, word], { solid: [...pair, word] });
}
{
  // The reticle snapped, and what it aims at drawn on the grid
  const person = person16(12, 9);
  const pin = `M${P(polar(12, 10.5, 2.25, 45))}A2.25 2.25 0 1 0 ${P(polar(12, 10.5, 2.25, 135))}L12 15.75Z`;
  const glass = roundpoly([[9.75, 8.25], [14.25, 8.25], [12.75, 12], [14.25, 15.75], [9.75, 15.75], [11.25, 12]], 0.3);
  const sn = snapper(RETICLE);
  const reticle = RETICLE.map(sn);
  const aim = (name, inner) => small(name, [...reticle, ...inner], { solid: [reticle[0]], wire: reticle.slice(1), cut: inner });
  aim('targeting-person', person);
  aim('targeting-location', [pin]);
  aim('targeting-time', [glass]);
}
{
  // The magnet upright over the person: arms 2 pixels wide, 2 apart, the bands cut across them
  const magnet = roundpoly([[11.25, 9.75], [11.25, 5.25], [12.75, 3.75], [17.25, 3.75], [18.75, 5.25], [18.75, 9.75], [17.25, 9.75], [17.25, 5.25], [12.75, 5.25], [12.75, 9.75]], 0);
  const bands = [hl(11.25, 12.75, 8.25), hl(17.25, 18.75, 8.25)];
  const me = person16(6, 13.5);
  for (const name of LEADS) small(name, [...me, magnet, ...bands], { solid: [...me, magnet], cut: bands }, icons[name].badge && badgeOf(name));
}
{
  // The link laid flat (two hooks two pixels apart and the bar through them) and the arrow over it
  const link = ['M9.75 14.25H6.75A3 3 0 0 0 6.75 20.25H9.75', 'M14.25 14.25H17.25A3 3 0 0 1 17.25 20.25H14.25', hl(8.25, 15.75, 17.25)];
  small('backlink', [...link, arc(12, 11.25, 6.75, 0, -180).d, line([3.75, 9.75], [5.25, 11.25], [6.75, 9.75])]);
}
{
  // One ring around the pointer's tip, the pointer on a pixel center
  const p = cursor([9.75, 9.75], 0.62);
  small('click-through', [arc(9.75, 9.75, 4.5, 100, 380).d], null, { d: [p], knock: p, fill: { solid: [p] } });
}
{
  // The pixel 4 pixels square and one wave at each side
  const px = sq(9.75, 9.75, 4.5, 4.5, 0.75);
  const waves = [arc(12, 12, 7.5, -32, 32).d, arc(12, 12, 7.5, 148, 212).d];
  small('tracking-pixel', [px, ...waves], { solid: [px], lines: waves });
}
{
  // Web traffic: the browser 8 pixels wide and two arrows into it, level, their heads 2 pixels a side
  // and a pixel apart (three, slanted, ran together; three level, with 1 pixel heads, read as plus signs)
  const win = box(9.75, 5.25, 10.5, 12, 2.25);
  const header = hl(9.75, 20.25, 8.25);
  const arrows = [6.75, 15.75].flatMap((y) => [hl(2.25, 6.75, y), line([3.75, y - 3], [6.75, y], [3.75, y + 3])]);
  small('web-traffic', [win, header, ...arrows], { solid: [win], cut: [header], lines: arrows });
  // Exit intent: the window low and wide, the pointer's tail through its top edge, the arrow beside it
  const frame = box(2.25, 12.75, 19.5, 7.5, 2.25);
  const bar = hl(2.25, 21.75, 17.25);
  const up = [vl(18.75, 9.75, 3.75), line([17.25, 5.25], [18.75, 3.75], [20.25, 5.25])];
  const p = cursor([9.75, 2.25], 0.55);
  small('exit-intent', [frame, bar, ...up], { solid: [frame], cut: [bar], lines: up }, { d: [p], knock: p, fill: { solid: [p] } });
  // Interstitial: the phone 8 pixels wide, the ad 4 pixels inside it and the close mark on its corner
  const phone = box(6.75, 3.75, 10.5, 16.5, 2.25);
  const ad = box(9.75, 9.75, 4.5, 7.5, 1.2);
  const close = [line([15.75, 2.25], [21.75, 8.25]), line([21.75, 2.25], [15.75, 8.25])];
  small('interstitial-ad', [phone, ad], { solid: [phone], cut: [ad] }, own(close));
}
{
  // The clipping upright (turned, its edges stair-step): 10 pixels wide, two teeth torn at the bottom,
  // the headline, the photo and two lines beside it
  const clip = roundpoly([[5.25, 3.75], [18.75, 3.75], [18.75, 17.25], [15.75, 20.25], [12.75, 17.25], [9.75, 20.25], [6.75, 17.25], [5.25, 18.75]], [1.2, 1.2, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3]);
  const news = [hl(8.25, 15.75, 6.75), sq(8.25, 9.75, 3, 4.5, 0.5), hl(14.25, 15.75, 9.75), hl(14.25, 15.75, 12.75)];
  small('press-clipping', [clip, ...news], { solid: [clip], cut: news });
}

// ── Named parts (DESIGN.md › Named parts): what animates, changes or sits under a badge ──
const PARTS = {
  ...Object.fromEntries(MEGAPHONES.map((n) => [n, { body: [0], handle: [1] }])),
  ...Object.fromEntries(AUDIENCES.map((n) => [n, { screen: [0], heads: [1, 2, 5], shoulders: [3, 4, 6] }])),
  lookalike: { person: [0, 1], copy: [2, 3], sign: [4, 5] },
  ...Object.fromEntries(TARGETING.map((n) => [n, { reticle: [0, 1, 2, 3, 4], target: range(5, icons[n].d.length - 1) }])),
  retargeting: { arrow: [0, 1], target: [2, 3] },
  demographics: { person: [0, 1], bars: [2, 3, 4] },
  firmographics: { building: [0, 1, 2, 3, 4, 5], bars: [6, 7, 8] },
  ...Object.fromEntries(LEADS.map((n) => [n, { person: [0, 1], magnet: [2, 3, 4] }])),
  'lead-score': { person: [0, 1], dial: [2], needle: [3, 4] },
  conversion: { visitor: [0, 1, 2], customer: [3, 4], arrow: [5, 6] },
  'conversion-path': { start: [0], path: [1], goal: [2] },
  'landing-page': { window: [0], header: [1], hero: [2], button: [3] },
  'web-traffic': { window: [0, 1], arrows: [2, 3, 4, 5, 6, 7] },
  'exit-intent': { window: [0, 1], arrow: [2, 3] },
  'click-through': { clicks: [0, 1] },
  seo: { lens: [0], handle: [1], arrow: [2, 3] },
  keyword: { lens: [0], handle: [1], teeth: [2, 3] },
  'search-results': { search: [0, 1, 2], results: [3, 4, 5, 6] },
  'search-ad': { search: [0, 1, 2], ad: [3], tag: [4], title: [5] },
  backlink: { link: [0, 1, 2], arrow: [3, 4] },
  'link-shortener': { link: [0, 1, 2], arrows: [3, 4, 5, 6] },
  'link-tracking': { link: [0, 1, 2] },
  'tracking-pixel': { pixel: [0], wave: [1, 2, 3, 4] },
  ...Object.fromEntries(BILLBOARDS.map((n) => [n, { board: [0], posts: [1, 2], catwalk: [3] }])),
  'display-ad': { window: [0, 1], text: [2, 3], ad: [4, 5] },
  'video-ad': { frame: [0], play: [1] },
  'interstitial-ad': { phone: [0], ad: [1] },
  'rewarded-ad': { frame: [0], gift: [1, 2, 3, 4, 5] },
  'post-boost': { card: [0], author: [1, 2], content: [3] },
  'swipe-up': { frame: [0], progress: [1, 2, 3], chevron: [4], bar: [5] },
  'pay-per-click': { coin: [0, 1, 2, 3] },
  'acquisition-cost': { coin: [0, 1, 2, 3] },
  'digital-signage': { screen: [0], play: [1], stand: [2, 3] },
  'sidewalk-sign': { frame: [0], board: [1], text: [2, 3] },
  'roll-up-banner': { rail: [0], banner: [1, 2, 3], base: [4] },
  'pole-banner': { pole: [0], arms: [1, 2], banners: [3, 4] },
  'mobile-billboard': { body: [0], cab: [1], wheels: [2, 3], panel: [4] },
  impressions: { eye: [0, 1], echo: [2, 3] },
  reach: { center: [0, 1], ring: range(2, 9) },
  ...Object.fromEntries(ATTRIBUTION.map((n) => [n, { touchpoints: [0, 1, 2], journey: [3, 4], bars: [5, 6, 7] }])),
  newsletter: { issue: [0, 1, 2] },
  'mail-sequence': { first: [0, 1], second: [2, 3], route: [4, 5, 6] },
  ambassador: { head: [0], body: [1], sash: [2, 3] },
  branding: { stamp: [0, 1], rod: [2, 3], heat: [4, 5] },
  'positioning-map': { axes: [0, 1], rivals: [2, 3], pin: [4, 5] },
  differentiation: { dots: [0, 1, 2, 3, 5, 6, 7, 8], mark: [4] },
  'flash-sale': { tag: [0, 1], bolt: [2] },
  'prize-wheel': { wheel: range(0, 7) },
  'scratch-card': { card: [0], scratch: [1] },
  raffle: { drum: [0, 1], crank: [2], stand: [3, 4] },
  'sneak-peek': { eye: [0, 1], wall: [2] },
  referral: { referrer: [0, 1], friend: [2, 3], arrow: [4, 5] },
  'affiliate-link': { link: [0, 1, 2], coin: [3, 4, 5, 6] },
  'word-of-mouth': { people: [0, 1, 2, 3], bubble: [4] },
  viral: { arrows: range(0, 10) },
  'press-release': { page: [0, 1, 2, 3] },
  'press-release-clock': { page: [0, 1, 2, 3] },
  'press-conference': { lectern: [0], microphones: range(1, 9) },
  'press-clipping': { clipping: [0], headline: [1], photo: [2], text: [3, 4] },
  sponsorship: { ribbon: [0] },
  webinar: { screen: [0], presenter: [1, 2], audience: [3, 4, 5] },
  'trade-show-booth': { header: [0], posts: [1, 2], counter: [3, 4] },
  'social-listening': { ear: [0, 1], bubble: [2] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Levels (DESIGN.md › Levels): the press release's waves light up from the inside out ──
for (const name of ['press-release', 'press-release-clock']) {
  icons[name].levels = [[4], [5]];
  icons[name].parts.level = [4, 5];
}
// ── Values: the lead score's needle turns over its dial, from the left (0) to the right (1) ──
icons['lead-score'].value = { turn: { parts: ['needle'], origin: [16.75, 10.5], from: -180, to: 0, at: -45 } };

// ── Automatic variants that make no sense ──
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already in a circle: the reticle, the target, the rings of reach, the wheel
variants([...TARGETING, 'retargeting', 'reach', 'prize-wheel'], { circle: false });
// Already the square: the browser and the post (as navegacion and social)
variants(['landing-page', 'display-ad', 'post-boost'], { square: false });
// No slashed variant on a badge (the slash would cut through it) nor on loose arrows
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, slash: false };
variants(['viral'], { slash: false });

// ── Mirroring (DESIGN.md › Mirroring): what points or reads one way ──
// The megaphone points ahead (not under a check, a clock or a sync, which never flip); charts and
// lists read from the start of the line; journeys, arrows and copies run in the reading direction.
for (const name of [
  'megaphone-plus',
  'megaphone-edit',
  'megaphone-pause',
  'lookalike',
  'demographics',
  'firmographics',
  'conversion',
  'conversion-path',
  'web-traffic',
  'search-results',
  'search-ad',
  'display-ad',
  ...ATTRIBUTION,
  'mail-sequence',
  'referral',
  'word-of-mouth',
  'viral',
])
  icons[name].mirror = true;

// ── Motion (DESIGN.md › Motion): each icon's own gesture ──
icons['megaphone-edit'].motion = { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] };
for (const name of ['megaphone-sync', 'audience-sync']) icons[name].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons.retargeting.motion = { effect: 'spin', parts: ['arrow'], origin: [12, 12] };
icons.lead.motion = { effect: 'wiggle', parts: ['magnet'], origin: [11.5, 5.85] };
icons['lead-score'].motion = { effect: 'wiggle', parts: ['needle'], origin: [16.75, 10.5] };
icons.conversion.motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['web-traffic'].motion = { effect: 'slide', parts: ['arrows'], vector: [1.5, 0] };
icons['exit-intent'].motion = { effect: 'slide', parts: ['arrow', 'badge'], vector: [0, -1.5] };
icons['click-through'].motion = { effect: 'beat', parts: ['clicks'], origin: [9, 9] };
icons.seo.motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons['video-ad'].motion = { effect: 'slide', parts: ['badge'], vector: [1.5, 0] };
icons['post-boost'].motion = { effect: 'slide', parts: ['badge'], vector: [0, -1.5] };
icons['swipe-up'].motion = { effect: 'slide', parts: ['chevron'], vector: [0, -1.5] };
icons.reach.motion = { effect: 'spin', parts: ['ring'], origin: [12, 12] };
icons['flash-sale'].motion = { effect: 'beat', parts: ['bolt'], origin: [14.4, 14.5] };
icons['prize-wheel'].motion = { effect: 'spin', parts: ['wheel'], origin: [12, 13.25] };
icons.raffle.motion = { effect: 'spin', parts: ['drum'], origin: [10.75, 10] };
icons['sneak-peek'].motion = { effect: 'float', parts: ['eye'], vector: [0, -1.5] };
icons.viral.motion = { effect: 'slide', vector: [1.5, 0] };
icons['press-release'].motion = { effect: 'beat', parts: ['level'], origin: [15.25, 7] };
icons['social-listening'].motion = { effect: 'beat', parts: ['bubble'], origin: [4.75, 13.25] };

export default { category: 'marketing', label: 'Marketing y publicidad', icons };
