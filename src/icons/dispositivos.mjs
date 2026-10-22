// Devices and media: screens, peripherals, power, connectivity, playback, audio and imaging.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5
// stroke, keylines, continuous corners and a square bottom-right corner on screens.
import { arc, circ, dot, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snap } from '../../engine/variants.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };

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
    const [lu, lv] = [len(u), len(v)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (v[0] / lv) * t, V[1] + (v[1] / lv) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Capsule (stadium): a rectangle whose short ends are semicircles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w, y + r])}V${N(y + h - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${N(x + w - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w - r, y + h])}H${N(x + r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** The four corners of sq() in [tr, br, bl, tl] order: start point and relative path. */
function corners(x, y, w, h, r, opts) {
  return sq(x, y, w, h, r, opts)
    .match(/[ML][^MLZ]*/g)
    .map((t) => {
      const m = t.slice(1).match(/^(-?[\d.]+) (-?[\d.]+)(.*)$/);
      return { p: [+m[1], +m[2]], c: m[3] };
    });
}

/**
 * Open run of an sq(): from `A` (on edge `eA`) to `B` (on edge `eB`), clockwise. Edges: 0 top, 1
 * right, 2 bottom, 3 left.
 */
function sqOpen(x, y, w, h, r, opts, A, eA, B, eB) {
  const k = corners(x, y, w, h, r, opts);
  // A and B must land on the straight part of their edge: inside a corner's curve the stroke
  // doubles back and leaves a notch.
  const pc = (n) => (opts?.square?.includes(n) ? 0 : 1.6 * r);
  const DIR = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const START = [
    [x + pc('tl'), y],
    [x + w, y + pc('tr')],
    [x + w - pc('br'), y + h],
    [x, y + h - pc('bl')],
  ];
  const along = (u, e) => u[0] * DIR[e][0] + u[1] * DIR[e][1];
  if (along(sub(k[eA].p, A), eA) < -0.01 || along(sub(B, START[eB]), eB) < -0.01) throw new Error('sqOpen: el corte cae dentro de una esquina');
  let s = `M${pt(A)}`;
  let e = eA;
  do {
    s += `L${pt(k[e].p)}${k[e].c}`;
    e = (e + 1) % 4;
  } while (e !== eB);
  return `${s}L${pt(B)}`;
}

// ── Paths as segments ─────────────────────────────────────────────────────────────────────────
// The engine's path is read as segments (line, cubic, circular arc) to clip it to a region (the
// film's perforations, the viewfinder corners), reverse it or measure its area. Anything that
// passes over another piece is NOT clipped here: it goes in as a badge (`badge`) and the engine
// clears the base with exactly 1.5 of clearance (DESIGN.md › Detail).

function arcSeg(a, b, r, fa, fs) {
  const dx = (a[0] - b[0]) / 2;
  const dy = (a[1] - b[1]) / 2;
  const d2 = dx * dx + dy * dy;
  const R = Math.max(r, Math.sqrt(d2));
  const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (R * R - d2) / d2));
  const c = [k * dy + (a[0] + b[0]) / 2, -k * dx + (a[1] + b[1]) / 2];
  const t0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let dt = Math.atan2(b[1] - c[1], b[0] - c[0]) - t0;
  if (fs && dt < 1e-9) dt += 2 * Math.PI;
  if (!fs && dt > -1e-9) dt -= 2 * Math.PI;
  return { k: 'A', a, b, c, r: R, t0, dt };
}

function parse(d) {
  const toks = d.match(/[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)/g).map((t) => (/[a-z]/i.test(t) ? t : +t));
  const subs = [];
  let cur;
  let p = [0, 0];
  let cmd;
  let i = 0;
  const n = () => toks[i++];
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++];
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const o = rel ? p : [0, 0];
    if (C === 'M') {
      p = [o[0] + n(), o[1] + n()];
      cur = { segs: [], closed: false, start: p };
      subs.push(cur);
    } else if (C === 'Z') {
      if (len(sub(p, cur.start)) > 1e-6) cur.segs.push({ k: 'L', a: p, b: cur.start });
      cur.closed = true;
      p = cur.start;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      const q = C === 'L' ? [o[0] + n(), o[1] + n()] : C === 'H' ? [o[0] + n(), p[1]] : [p[0], o[1] + n()];
      cur.segs.push({ k: 'L', a: p, b: q });
      p = q;
    } else if (C === 'C') {
      const c1 = [o[0] + n(), o[1] + n()];
      const c2 = [o[0] + n(), o[1] + n()];
      const q = [o[0] + n(), o[1] + n()];
      cur.segs.push({ k: 'C', a: p, c1, c2, b: q });
      p = q;
    } else if (C === 'A') {
      const r = n();
      n();
      n();
      const fa = n();
      const fs = n();
      const q = [o[0] + n(), o[1] + n()];
      cur.segs.push(arcSeg(p, q, r, fa, fs));
      p = q;
    }
  }
  return subs;
}

function at(s, t) {
  if (s.k === 'L') return lerp(s.a, s.b, t);
  if (s.k === 'A') {
    const th = s.t0 + s.dt * t;
    return [s.c[0] + s.r * Math.cos(th), s.c[1] + s.r * Math.sin(th)];
  }
  const m = 1 - t;
  return [0, 1].map((j) => m * m * m * s.a[j] + 3 * m * m * t * s.c1[j] + 3 * m * t * t * s.c2[j] + t * t * t * s.b[j]);
}

function piece(s, t0, t1) {
  if (s.k === 'L') return { k: 'L', a: at(s, t0), b: at(s, t1) };
  if (s.k === 'A') return { ...s, a: at(s, t0), b: at(s, t1), t0: s.t0 + s.dt * t0, dt: s.dt * (t1 - t0) };
  const split = (c, t) => {
    const p01 = lerp(c.a, c.c1, t);
    const p12 = lerp(c.c1, c.c2, t);
    const p23 = lerp(c.c2, c.b, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const m = lerp(p012, p123, t);
    return [
      { k: 'C', a: c.a, c1: p01, c2: p012, b: m },
      { k: 'C', a: m, c1: p123, c2: p23, b: c.b },
    ];
  };
  const right = t0 > 0 ? split(s, t0)[1] : s;
  return t1 < 1 ? split(right, (t1 - t0) / (1 - t0))[0] : right;
}

function write(segs, closed) {
  let o = `M${pt(segs[0].a)}`;
  for (const s of segs) {
    if (s.k === 'L') o += `L${pt(s.b)}`;
    else if (s.k === 'C') o += `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.b)}`;
    else o += `A${N(s.r)} ${N(s.r)} 0 ${Math.abs(s.dt) > Math.PI ? 1 : 0} ${s.dt > 0 ? 1 : 0} ${pt(s.b)}`;
  }
  return closed ? `${o}Z` : o;
}

/** Runs [t0, t1] of a segment that fall outside every region. */
function keep(s, out) {
  const n = 160;
  const inside = (t) => out.some((f) => f(at(s, t)));
  const res = [];
  let prev = inside(0);
  let start = prev ? null : 0;
  for (let j = 1; j <= n; j++) {
    const t = j / n;
    const now = inside(t);
    if (now !== prev) {
      let lo = (j - 1) / n;
      let hi = t;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (inside(mid) === prev) lo = mid;
        else hi = mid;
      }
      const edge = (lo + hi) / 2;
      if (now) res.push([start, edge]);
      else start = edge;
      prev = now;
    }
  }
  if (!prev) res.push([start, 1]);
  return res.filter(([a, b]) => b - a > 1e-4);
}

/** Cuts the paths `ds` wherever they fall inside a region; drops leftovers shorter than `min`. */
function cut(ds, out, min = 1.2) {
  const res = [];
  for (const d of [].concat(ds)) {
    for (const sp of parse(d)) {
      const runs = [];
      let run = null;
      let cutAny = false;
      sp.segs.forEach((s, j) => {
        const iv = keep(s, out);
        if (iv.length !== 1 || iv[0][0] > 0 || iv[0][1] < 1) cutAny = true;
        iv.forEach(([t0, t1], k) => {
          const p = piece(s, t0, t1);
          if (k === 0 && t0 === 0 && run && run.end === j - 1) run.segs.push(p);
          else {
            run = { segs: [p], first: j === 0 && t0 === 0 };
            runs.push(run);
          }
          run.end = t1 === 1 ? j : -9;
        });
        if (!iv.length) run = null;
      });
      if (!cutAny) {
        res.push(write(sp.segs, sp.closed));
        continue;
      }
      if (sp.closed && runs.length > 1 && runs[0].first && runs.at(-1).end === sp.segs.length - 1) {
        runs[0].segs = runs.pop().segs.concat(runs[0].segs);
      }
      for (const r of runs) {
        const L = r.segs.reduce((n, s) => n + len(sub(s.b, s.a)), 0);
        if (L > min) res.push(write(r.segs, false));
      }
    }
  }
  return res;
}

/** A segment traversed backwards (to reverse a path). */
function back(s) {
  if (s.k === 'L') return { k: 'L', a: s.b, b: s.a };
  if (s.k === 'C') return { k: 'C', a: s.b, c1: s.c2, c2: s.c1, b: s.a };
  return { ...s, a: s.b, b: s.a, t0: s.t0 + s.dt, dt: -s.dt };
}

/** An open path and its return along the same route (closed, it is the `knock` of an open piece: knockOf). */
const twin = (d) =>
  parse(d)
    .map((sp) => write([...sp.segs, ...sp.segs.toReversed().map(back)], false))
    .join('');

/**
 * An open path extended by `k0` at the start and `k1` at the end (along its straight end runs). For
 * `fill.cut`: a detail that reaches the outline (the flashlight's slot, the photo's mountain range)
 * is knocked out all the way through; if it ended exactly at the outline, its round cap would leave
 * a notch with hairline edges in the silhouette.
 */
function extend(d, k0 = 1, k1 = 1) {
  const [sp] = parse(d);
  const segs = sp.segs.map((g) => ({ ...g }));
  const push = (g, end, k) => {
    const [from, to] = end ? [g.a, g.b] : [g.b, g.a];
    const u = sub(to, from).map((v) => v / len(sub(to, from)));
    const q = [to[0] + u[0] * k, to[1] + u[1] * k];
    if (end) g.b = q;
    else g.a = q;
  };
  if (segs[0].k !== 'L' || segs.at(-1).k !== 'L') throw new Error('extend: los extremos deben ser rectos');
  push(segs[0], false, k0);
  push(segs.at(-1), true, k1);
  return write(segs, false);
}

/** Signed area of a closed shape (its winding direction). */
function area(d) {
  const p = samplePath(d, 0.2);
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return a / 2;
}

/**
 * A shape with holes, for `fill.solid`: the inner contours run opposite to the outer one, so the
 * fill rule leaves them empty (the play triangle inside the circle, the disc's hole).
 */
function withHoles(outer, ...holes) {
  const s = Math.sign(area(outer));
  const rev = (d) =>
    parse(d)
      .map((sp) => write(sp.segs.toReversed().map(back), true))
      .join('');
  return outer + holes.map((h) => (Math.sign(area(h)) === s ? rev(h) : h)).join('');
}

/**
 * Area cleared by an open piece (the slash, the turntable's tonearm): the path out and back,
 * closed. The engine's mask has no round cap; closed, the turn at each end is a round join and the
 * 1.5 clearance also wraps around the tips (without the cap, the camera's bottom corner stayed
 * stuck to the tip of the slash).
 */
const knockOf = (d) => `${twin(d)}Z`;

/**
 * "Off" version: the full icon with the slash on top as a badge; the engine clears the base with
 * exactly 1.5 of clearance on each side and removes any dot it touches entirely. The slash runs
 * from top left to bottom right at 45°; where the default one grazes a piece (leaving it as a
 * parallel sliver or cutting it at a very sharp angle), it shifts onto a parallel line so it
 * crosses the piece head-on.
 */
const slashOver = (a = [3.5, 3.5], b = [20.5, 20.5]) => {
  const s = line(a, b);
  return { d: [s], knock: knockOf(s) };
};

/** A closed shape on top of another (the phone in front of the monitor, the front photo). */
const front = (ds, knock = ds[0], fill = { solid: [ds[0]], ...(ds.length > 1 && { cut: ds.slice(1) }) }) => ({ d: ds, knock, fill });

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────

const SPEAKER = nucleo.icons.speaker.d[0];

const smartphone = () => [sq(6.25, 2.75, 11.5, 18.5, 3.25, BR), line([10.5, 5.75], [13.5, 5.75])];

const camera = () => [
  sq(2.5, 6.5, 19, 13.75, 3.5, BR),
  roundline(
    [
      [8.25, 6.5],
      [9.5, 4],
      [14.5, 4],
      [15.75, 6.5],
    ],
    [0, 0.9, 0.9, 0],
  ),
  circ(12, 13.25, 3.75),
];

const videoCamera = () => [
  sq(2.5, 6, 13, 12, 3.25, BR),
  roundline(
    [
      [15.5, 10.25],
      [21.5, 6.75],
      [21.5, 17.25],
      [15.5, 13.75],
    ],
    [0, 1.25, 1.25, 0],
  ),
];

/** Earbud: round head with the stem flush with one side (`side` 1 right, -1 left). */
function earbud(cx, cy, r, side, stem = 12) {
  const x = cx + r * side;
  return [`M${pt([x, cy + stem])}V${N(cy)}A${N(r)} ${N(r)} 0 1 ${side > 0 ? 0 : 1} ${pt([cx, cy + r])}H${N(x)}`];
}

/**
 * Handheld microphone: round head and a tapered handle at 45° that starts at the head's edge. The
 * grille band, on the side opposite the handle, is what sets it apart from a magnifying glass.
 */
function handMic() {
  const C = [15.25, 8.75];
  const R = 4.5;
  const a = [-Math.SQRT1_2, Math.SQRT1_2];
  const nn = [Math.SQRT1_2, Math.SQRT1_2];
  const P = (u, v) => [C[0] + u * a[0] + v * nn[0], C[1] + u * a[1] + v * nn[1]];
  const u0 = Math.sqrt(R * R - 2.25 * 2.25);
  const band = Math.sqrt(R * R - 1.5 * 1.5);
  return [
    circ(...C, R),
    roundline([P(u0, 2.25), P(14, 1.4), P(14, -1.4), P(u0, -2.25)], [0, 1.2, 1.2, 0]),
    line(P(-1.5, -band), P(-1.5, band)),
  ];
}

/**
 * Flashlight: head, cone and handle; `t` is the height of the head (lower leaves room for the
 * light). The switch is a dot 3 from the neck and from the bottom, the same in both versions.
 */
const flashlight = (t = 2.75) => [
  roundpoly(
    [
      [6.25, t],
      [17.75, t],
      [17.75, t + 3.75],
      [15, t + 7.5],
      [15, 21.25],
      [9, 21.25],
      [9, t + 7.5],
      [6.25, t + 3.75],
    ],
    [1.5, 1.5, 1, 1, 1.5, 1.5, 1, 1],
  ),
  line([6.25, t + 3.75], [17.75, t + 3.75]),
  dot(12, Math.min(t + 11.25, 18.25)),
];

/** Horizontal battery with `n` charge bars (0–4); the terminal stands apart, 3 from the body. */
const battery = (n) => [
  sq(2.5, 6.5, 16, 11, 3, BR),
  line([21.5, 10.5], [21.5, 13.5]),
  ...[6, 9, 12, 15].slice(0, n).map((x) => line([x, 9.5], [x, 14.5])),
];

/** Wi-Fi: a dot and up to three concentric arcs (opening 90° upward). */
const WIFI_C = [12, 18.5];
const wifi = (n) => [dot(...WIFI_C), ...[4.5, 9, 13.5].slice(0, n).map((r) => arc(...WIFI_C, r, 225, 315).d)];

/** Cellular signal: four bars; the ones without signal remain as a dot on the baseline. */
const signal = (n) =>
  [4.5, 9.5, 14.5, 19.5].map((x, i) => (i < n ? line([x, 20], [x, [16.5, 12.5, 8.5, 4.25][i]]) : dot(x, 20)));

/** Vertices of the play triangle with its tip at `tipX` (dir 1 right, -1 left). */
function triPts(tipX, cy, w, h, dir = 1) {
  const bx = tipX - w * dir;
  return dir > 0
    ? [
        [bx, cy - h / 2],
        [tipX, cy],
        [bx, cy + h / 2],
      ]
    : [
        [bx, cy + h / 2],
        [tipX, cy],
        [bx, cy - h / 2],
      ];
}
/** Play triangle with its tip at `tipX` and corners of radius r. */
const tri = (tipX, cy, w, h, r, dir = 1) => roundpoly(triPts(tipX, cy, w, h, dir), r);

/**
 * Rounded polygon grown outward by `k` (its sides move by k; convex corners grow their radius by k
 * and concave ones lose it). For holes in the fill: the hole's contour runs slightly outside the
 * line being knocked out, so the edge comes from the mask alone.
 */
function grown(pts, radius, k) {
  const n = pts.length;
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let S = 0;
  for (let i = 0; i < n; i++) S += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const L = len(sub(q, p));
    const u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    const o = S > 0 ? [u[1], -u[0]] : [-u[1], u[0]];
    return { p: [p[0] + o[0] * k, p[1] + o[1] * k], u };
  });
  const out = pts.map((_, i) => {
    const A = lines[(i - 1 + n) % n];
    const B = lines[i];
    const den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
    const t = ((B.p[0] - A.p[0]) * B.u[1] - (B.p[1] - A.p[1]) * B.u[0]) / den;
    return [A.p[0] + A.u[0] * t, A.p[1] + A.u[1] * t];
  });
  const r = pts.map((V, i) => {
    const A = pts[(i - 1 + n) % n];
    const B = pts[(i + 1) % n];
    const convex = Math.sign((V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0])) === Math.sign(S);
    return convex ? rr[i] + k : Math.max(0, rr[i] - k);
  });
  return roundpoly(out, r);
}

const bluetooth = () => [
  roundline(
    [
      [6.75, 7.75],
      [17, 16.5],
      [12, 21],
      [12, 3],
      [17, 7.5],
      [6.75, 16.25],
    ],
    [0, 0.9, 0.6, 0.6, 0.9, 0],
  ),
];

/** Points along a path (every ~0.2): the inside of a shape and its winding direction. */
function samplePath(d, step = 0.2) {
  const pts = [];
  for (const sp of parse(d))
    for (const s of sp.segs) {
      let L = 0;
      for (let i = 1; i <= 16; i++) L += len(sub(at(s, i / 16), at(s, (i - 1) / 16)));
      const n = Math.max(2, Math.ceil(L / step));
      for (let i = 0; i <= n; i++) pts.push(at(s, i / n));
    }
  return pts;
}

const SPEAKER_WAVES = nucleo.icons.waves.d;
const MUTE = nucleo.icons.mute.d;

/** Repeat: two L-shaped runs chasing each other, with arc arrowheads (3.4). */
const repeat = () => [
  roundline(
    [
      [3.75, 12.5],
      [3.75, 7],
      [19.75, 7],
    ],
    [0, 3, 0],
  ),
  head([19.75, 7], [1, 0], 3.4),
  roundline(
    [
      [20.25, 11.5],
      [20.25, 17],
      [4.25, 17],
    ],
    [0, 3, 0],
  ),
  head([4.25, 17], [-1, 0], 3.4),
];

/** Dome: half an ellipse from `x0` to `x1` on baseline `y`, `h` tall, closed along the base. */
const dome = (x0, x1, y, h) => `M${pt([x0, y])}A${N((x1 - x0) / 2)} ${N(h)} 0 0 1 ${pt([x1, y])}Z`;

/** Region: the inside of a closed shape (a polygon sampled from its path). */
function inside(d) {
  const poly = samplePath(d, 0.1);
  return (p) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
const outside = (d) => {
  const f = inside(d);
  return (p) => !f(p);
};

/**
 * Point where the line from `inner` (inside shape `d`) to `outer` (outside) crosses its outline: a
 * line that ends there stays buried in the stroke, without poking out past a curved corner.
 */
function toEdge(inner, outer, d) {
  const f = inside(d);
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (f(lerp(inner, outer, m))) lo = m;
    else hi = m;
  }
  return lerp(inner, outer, (lo + hi) / 2);
}

/** Ellipse rotated `deg` degrees (a music note head). */
function ellipse(cx, cy, rx, ry, deg) {
  const a = [cx + rx * Math.cos((deg * Math.PI) / 180), cy + rx * Math.sin((deg * Math.PI) / 180)];
  const b = [2 * cx - a[0], 2 * cy - a[1]];
  return `M${pt(a)}A${N(rx)} ${N(ry)} ${N(deg)} 1 1 ${pt(b)}A${N(rx)} ${N(ry)} ${N(deg)} 1 1 ${pt(a)}Z`;
}

/** The rightmost point of that ellipse: the stem starts there, tangent to the oval. */
function ellipseRight(cx, cy, rx, ry, deg) {
  const f = (deg * Math.PI) / 180;
  const t = Math.atan2(-ry * Math.sin(f), rx * Math.cos(f));
  return [cx + rx * Math.cos(t) * Math.cos(f) - ry * Math.sin(t) * Math.sin(f), cy + rx * Math.cos(t) * Math.sin(f) + ry * Math.sin(t) * Math.cos(f)];
}

/** Note: tilted oval head and a stem rising from its right side to `top`. */
function note(cx, cy, top, rx = 3, ry = 2.1, deg = -24) {
  const s = ellipseRight(cx, cy, rx, ry, deg);
  return { head: ellipse(cx, cy, rx, ry, deg), stem: line(s, [s[0], top]), x: s[0], y: s[1] };
}

/** Horizontal mirror of an absolute path (M, L, H, V, C, A, Z): turns fast-forward into rewind. */
function mirrorPath(d) {
  return d.replace(/([MLHVCA])([^MLHVCAZ]*)/g, (_, c, args) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (c === 'H') return `H${N(24 - n[0])}`;
    if (c === 'V') return `V${N(n[0])}`;
    if (c === 'A') return `A${N(n[0])} ${N(n[1])} ${N(-n[2])} ${n[3]} ${n[4] ? 0 : 1} ${N(24 - n[5])} ${N(n[6])}`;
    const o = [];
    for (let i = 0; i < n.length; i += 2) o.push(`${N(24 - n[i])} ${N(n[i + 1])}`);
    return `${c}${o.join(c === 'C' ? ' ' : 'L')}`;
  });
}

/**
 * Fast-forward: two triangles with a true 3 between the first one's rounded tip (the r 1.5 corner
 * pulls it back by 1.1) and the second one's base.
 */
const FAST_FORWARD = [tri(11, 12, 8.25, 11.5, 1.5), tri(21.25, 12, 8.25, 11.5, 1.5)];

/**
 * Photo: a landscape frame, a sun and a two-peak mountain range running edge to edge, with 45°
 * slopes. The range starts right on the outline (toEdge), not beside the curved corner. The
 * descending slopes are parallel to the `image-off` slash: they sit more than 3 from it (one used
 * to sit 2.5 away and the slash shaved it lengthwise), and the slash crosses the rising slopes
 * head-on, 4.25 from the valley and from the peak (leaving runs of 2, not loose hooks).
 */
const IMAGE_FRAME = sq(2.5, 5, 19, 14, 3.5, BR);
const image = () => [
  IMAGE_FRAME,
  dot(10.5, 8.75),
  roundline(
    [
      toEdge([7, 13], [1, 19], IMAGE_FRAME),
      [7, 13],
      [10, 16],
      [16, 10],
      [21.5, 15.5],
    ],
    [0, 1, 1, 1, 0],
  ),
];

/** AI spark: the one in datos/sparkle (four points, concave sides), with radius R. */
function aiSpark(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const P = (x, y) => pt([cx + x * R, cy + y * R]);
  return `M${P(0, -1)}C${P(a, -b)} ${P(b, -a)} ${P(1, 0)}C${P(b, a)} ${P(a, b)} ${P(0, 1)}C${P(-a, b)} ${P(-b, a)} ${P(-1, 0)}C${P(-b, -a)} ${P(-a, -b)} ${P(0, -1)}Z`;
}

/**
 * Clapperboard arm: the clapstick open 15° on its hinge (any wider and it leaves the live area).
 * The stripes start away from the hinge, where the arm has already separated from the body.
 */
function clapper() {
  const H = [3.25, 9.5];
  const L = 17.5;
  const T = 3.25;
  const P = (u, v) => rot([H[0] + u, H[1] + v], H, -15);
  return [
    roundpoly([P(0, 0), P(L, 0), P(L, -T), P(0, -T)], [0.4, 1, 1, 1]),
    ...[6, 10.5, 15].map((u) => line(P(u - 1, 0), P(u + 1, -T))),
  ];
}

/**
 * Aperture: five curved blades turning the same way (with six it was the densest icon in the set).
 * Each blade is an arc of radius 18 that passes through two consecutive vertices of the opening
 * (r 4.25) and continues out to radius R (the ring): the opening becomes a pentagon with curved
 * sides, like an iris.
 * With radius-12 blades and a 4.75 opening they were longer and the icon went over 28% ink.
 */
function aperture(R = 9) {
  const C = [12, 12];
  const Rb = 18;
  const OPEN = 4.25;
  return [
    circ(...C, 9),
    ...[0, 1, 2, 3, 4].map((i) => {
      const A = polar(...C, OPEN, 72 * i - 90);
      const B = polar(...C, OPEN, 72 * i - 18);
      const M = lerp(A, B, 0.5);
      const n = sub(M, C).map((v) => v / len(sub(M, C)));
      const h = Math.sqrt(Rb * Rb - (len(sub(B, A)) / 2) ** 2);
      const Cb = [M[0] - n[0] * h, M[1] - n[1] * h];
      const ang = (p) => Math.atan2(p[1] - Cb[1], p[0] - Cb[0]);
      const dir = Math.sign(((ang(B) - ang(A) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      // Walk along the blade's arc until it touches the ring
      let [lo, hi] = [0, Math.PI / 2];
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        const t = ang(A) + dir * m;
        if (len(sub([Cb[0] + Rb * Math.cos(t), Cb[1] + Rb * Math.sin(t)], C)) < R) lo = m;
        else hi = m;
      }
      const t = ang(A) + dir * lo;
      return `M${pt(A)}A${Rb} ${Rb} 0 0 ${dir > 0 ? 1 : 0} ${pt([Cb[0] + Rb * Math.cos(t), Cb[1] + Rb * Math.sin(t)])}`;
    }),
  ];
}

/** Mouth of the network port (RJ45): the rectangle with the tab at the bottom. */
const PORT = [
  [7, 8],
  [17, 8],
  [17, 14],
  [14.5, 14],
  [14.5, 16.25],
  [9.5, 16.25],
  [9.5, 14],
  [7, 14],
];
const PORT_R = [1, 1, 1, 0.5, 0.75, 0.75, 0.5, 1];

const icons = {
  // ── Screens and hardware ──────────────────────────────────────────────────────────────────
  smartphone: {
    tags: ['celular', 'teléfono móvil', 'app', 'smartphone', 'mobile', 'phone'],
    d: smartphone(),
  },
  'smartphone-vibrate': {
    tags: ['vibrar', 'celular', 'modo silencio', 'vibrate', 'mobile', 'haptic'],
    d: [
      sq(8, 2.75, 8, 18.5, 2.5, BR),
      line([11, 5.75], [13, 5.75]),
      line([5, 8.5], [5, 15.5]),
      line([2, 10.25], [2, 13.75]),
      line([19, 8.5], [19, 15.5]),
      line([22, 10.25], [22, 13.75]),
    ],
  },
  tablet: {
    tags: ['tableta', 'pantalla táctil', 'tablet', 'touchscreen'],
    d: [sq(4, 2.75, 16, 18.5, 3.5, BR), dot(12, 6.25)],
  },
  laptop: {
    tags: ['laptop', 'computadora portátil', 'notebook', 'computer'],
    d: [sq(4.25, 4.5, 15.5, 11, 2.75, BR), line([2.5, 18.75], [21.5, 18.75])],
  },
  desktop: {
    tags: ['computadora', 'monitor', 'pantalla', 'desktop', 'computer', 'display'],
    d: [sq(2.5, 3.5, 19, 13.25, 3, BR), line([12, 16.75], [12, 20.5]), line([8.25, 20.5], [15.75, 20.5])],
  },
  devices: {
    tags: ['dispositivos', 'multiplataforma', 'responsivo', 'devices', 'responsive', 'cross-platform'],
    // The full monitor; the phone sits in front as a badge and the engine clears the monitor with
    // 1.5 of clearance
    d: [sq(2.25, 3.25, 17.5, 12, 2.75, BR), line([9, 15.25], [9, 19.5]), line([5.75, 19.5], [12.25, 19.5])],
    badge: front([sq(15.25, 9.25, 6.5, 12, 2, BR)]),
  },
  watch: {
    tags: ['reloj inteligente', 'wearable', 'smartwatch', 'watch'],
    d: [
      sq(6, 6.25, 11, 11.5, 3, BR),
      roundline(
        [
          [8.5, 6.25],
          [9, 2.75],
          [14, 2.75],
          [14.5, 6.25],
        ],
        [0, 0.75, 0.75, 0],
      ),
      roundline(
        [
          [8.5, 17.75],
          [9, 21.25],
          [14, 21.25],
          [14.5, 17.75],
        ],
        [0, 0.75, 0.75, 0],
      ),
      line([17, 10], [19, 10]),
    ],
  },
  tv: {
    tags: ['televisión', 'tele', 'pantalla', 'tv', 'television', 'screen'],
    d: [sq(2.5, 4, 19, 13, 3.25, BR), line([6.75, 17], [5.5, 20.25]), line([17.25, 17], [18.5, 20.25])],
  },
  'tv-retro': {
    tags: ['televisión antigua', 'antena', 'tele', 'retro tv', 'vintage', 'television'],
    d: [sq(2.5, 7, 19, 13.25, 3.25, BR), line([8, 2.75], [12, 7], [16, 2.75]), sq(5.5, 10, 9, 7.25, 2.25, BR), dot(18, 13.75)],
  },
  keyboard: {
    tags: ['teclado', 'teclas', 'escribir', 'keyboard', 'typing', 'keys'],
    // The second-row keys are staggered by half a key, as on a real keyboard
    d: [
      sq(2.5, 5.5, 19, 13, 3.25, BR),
      ...[6, 9, 12, 15, 18].map((x) => dot(x, 9.25, 0.3)),
      ...[7.5, 10.5, 13.5, 16.5].map((x) => dot(x, 12.25, 0.3)),
      line([8.5, 15.25], [15.5, 15.25]),
    ],
  },
  mouse: {
    tags: ['ratón', 'puntero', 'clic', 'mouse', 'pointer', 'click'],
    d: [capsule(6.5, 3, 11, 18), line([12, 6.75], [12, 9.25])],
  },
  printer: {
    tags: ['impresora', 'imprimir', 'printer', 'print'],
    // The input sheet rests on the body; the output sheet comes out of the slot, and the body opens
    // where it passes in front. Both sheets, like documents, carry the drop's corner.
    d: [
      sqOpen(2.5, 7.5, 19, 10, 3, BR, [7.5, 17.5], 2, [16.5, 17.5], 2),
      roundline(
        [
          [7.5, 7.5],
          [7.5, 2.75],
          [16.5, 2.75],
          [16.5, 7.5],
        ],
        [0, 1.5, 1.5, 0],
      ),
      line([5.5, 14], [18.5, 14]),
      roundline(
        [
          [7.5, 14],
          [7.5, 21.25],
          [16.5, 21.25],
          [16.5, 14],
        ],
        [0, 1.5, 0, 0],
      ),
    ],
  },
  camera: {
    tags: ['cámara', 'foto', 'fotografía', 'camera', 'photo', 'photography'],
    d: camera(),
  },
  'camera-off': {
    tags: ['cámara apagada', 'sin cámara', 'camera off', 'no camera'],
    // The slash goes through the center of the lens (the default one left the lens as a sliver next
    // to it)
    d: camera(),
    badge: slashOver([3.75, 5], [20.25, 21.5]),
  },
  'video-camera': {
    tags: ['cámara de video', 'grabar video', 'video', 'camcorder', 'record video'],
    d: videoCamera(),
  },
  'video-camera-off': {
    tags: ['video apagado', 'sin video', 'video off', 'camera off'],
    // The slash crosses the body corner to corner and leaves the lens horn whole: the default one
    // cut the horn's lower arm at a 15° angle and left it as a spike
    d: videoCamera(),
    badge: slashOver([2.75, 5.75], [16.25, 19.25]),
  },
  webcam: {
    tags: ['cámara web', 'videollamada', 'webcam', 'video call'],
    d: [circ(12, 9.5, 6.75), circ(12, 9.5, 2.5), line([12, 16.25], [12, 20.75]), line([7.75, 20.75], [16.25, 20.75])],
  },
  headphones: {
    tags: ['audífonos', 'auriculares', 'escuchar', 'headphones', 'audio', 'listen'],
    d: [arc(12, 12, 8.25, 180, 360).d, sq(3.75, 12, 5, 8.75, 1.5, { square: ['tl'] }), sq(15.25, 12, 5, 8.75, 1.5, { square: ['tr'] })],
  },
  earbuds: {
    tags: ['audífonos inalámbricos', 'auriculares', 'earbuds', 'in-ear', 'wireless earphones'],
    d: [...earbud(7, 7.75, 3.5, 1), ...earbud(17, 7.75, 3.5, -1)],
  },
  'speaker-box': {
    tags: ['bocina', 'altavoz', 'sonido', 'speaker', 'woofer', 'audio'],
    // Tweeter and woofer as two cones of different sizes, 3 apart from each other and from the cabinet
    d: [sq(5, 2.75, 14, 18.5, 3.5, BR), circ(12, 7, 1.25), circ(12, 14.75, 3.5)],
  },
  'smart-speaker': {
    tags: ['bocina inteligente', 'asistente de voz', 'smart speaker', 'voice assistant'],
    d: [sq(5.5, 3.25, 13, 17.5, 4), line([9, 10.5], [9, 13.5]), line([12, 8.75], [12, 15.25]), line([15, 10.5], [15, 13.5])],
  },
  'microphone-handheld': {
    tags: ['micrófono de mano', 'karaoke', 'cantar', 'handheld mic', 'sing', 'microphone'],
    d: handMic(),
  },
  'microphone-studio': {
    tags: ['micrófono de estudio', 'grabar voz', 'studio mic', 'podcast', 'microphone'],
    d: [
      capsule(7.75, 2.75, 8.5, 12),
      line([7.75, 7.75], [16.25, 7.75]),
      line([7.75, 10.75], [16.25, 10.75]),
      line([12, 14.75], [12, 18.25]),
      capsule(7.5, 18.25, 9, 3),
    ],
  },
  'remote-control': {
    tags: ['control remoto', 'mando', 'remote', 'tv remote'],
    d: [
      sq(6.75, 2.75, 10.5, 18.5, 3, BR),
      circ(12, 8, 2.25),
      ...[14, 17.5].flatMap((y) => [10.25, 13.75].map((x) => dot(x, y, 0.3))),
    ],
  },
  gamepad: {
    tags: ['control de juego', 'videojuego', 'gamepad', 'controller', 'gaming'],
    // D-pad on the left and analog stick on the right, symmetric about the center and more than 3
    // from the body's slanted sides.
    d: [
      roundpoly(
        [
          [6, 5.75],
          [18, 5.75],
          [21.5, 16.25],
          [18.25, 19],
          [15.25, 15.75],
          [8.75, 15.75],
          [5.75, 19],
          [2.5, 16.25],
        ],
        [3.25, 3.25, 2.25, 1.5, 1.5, 1.5, 1.5, 2.25],
      ),
      line([7.5, 10.5], [10.5, 10.5]),
      line([9, 9], [9, 12]),
      circ(15, 10.5, 1.5),
    ],
  },
  'vr-headset': {
    tags: ['realidad virtual', 'visor', 'vr', 'headset', 'virtual reality'],
    // A single closed outline: the visor and the nose bridge (so the fill respects the notch)
    d: [`${sqOpen(2.5, 7, 19, 10.5, 3.25, {}, [9.5, 17.5], 2, [14.5, 17.5], 2)}${arc(12, 17.5, 2.5, 360, 180).d.replace(/^M[^A]*/, '')}Z`],
  },
  flashlight: {
    tags: ['linterna', 'lámpara', 'flashlight', 'torch'],
    d: flashlight(),
  },
  'flashlight-on': {
    tags: ['linterna encendida', 'luz', 'flashlight on', 'torch', 'light'],
    d: [...flashlight(7), line([12, 2], [12, 4]), line([6.5, 4], [5.25, 2.25]), line([17.5, 4], [18.75, 2.25])],
  },
  'sd-card': {
    tags: ['tarjeta de memoria', 'tarjeta sd', 'almacenamiento', 'sd card', 'memory card', 'storage'],
    // Back view, where the contacts are: there the chamfer sits at the top left. The first contact
    // starts lower to keep 3 from the chamfer.
    d: [
      roundpoly(
        [
          [5.25, 6.75],
          [9.25, 2.75],
          [18.75, 2.75],
          [18.75, 21.25],
          [5.25, 21.25],
        ],
        [1, 1, 2.5, 0, 2.5],
      ),
      line([9.5, 6.75], [9.5, 10]),
      line([12.5, 6], [12.5, 10]),
      line([15.5, 6], [15.5, 10]),
    ],
  },
  'usb-drive': {
    tags: ['memoria usb', 'pendrive', 'usb drive', 'flash drive', 'thumb drive'],
    d: [
      sq(7.25, 8.25, 9.5, 13, 2.75, BR),
      roundline(
        [
          [9.25, 8.25],
          [9.25, 2.75],
          [14.75, 2.75],
          [14.75, 8.25],
        ],
        [0, 1, 1, 0],
      ),
      dot(12, 17.25),
    ],
  },
  router: {
    tags: ['módem', 'router', 'red', 'internet', 'wifi', 'network'],
    d: [
      sq(2.5, 12.5, 19, 8, 2.5, BR),
      line([7, 12.5], [5.75, 4.25]),
      line([17, 12.5], [18.25, 4.25]),
      ...[6.5, 10, 13.5].map((x) => dot(x, 16.5, 0.3)),
    ],
  },
  projector: {
    tags: ['proyector', 'presentación', 'projector', 'presentation'],
    d: [
      sq(2.5, 7, 19, 11, 3, BR),
      circ(15.5, 12.5, 2.5),
      line([6, 11], [9.25, 11]),
      line([6, 14], [9.25, 14]),
      line([6, 18], [6, 20]),
      line([18, 18], [18, 20]),
    ],
  },
  // ── Power ─────────────────────────────────────────────────────────────────────────────────
  'battery-full': {
    tags: ['batería llena', 'carga completa', 'battery full', 'charged'],
    d: battery(4),
  },
  'battery-half': {
    tags: ['batería media', 'media carga', 'battery half', 'battery medium'],
    d: battery(2),
  },
  'battery-low': {
    tags: ['batería baja', 'poca carga', 'battery low', 'low power'],
    d: battery(1),
  },
  'battery-empty': {
    tags: ['batería vacía', 'sin carga', 'battery empty', 'dead battery'],
    d: battery(0),
  },
  'battery-charging': {
    tags: ['cargando', 'batería', 'carga', 'charging', 'battery charging'],
    // A 5-tall bolt centered in the body, with 3 of clearance above and below
    d: [...battery(0), roundline([[11.75, 9.5], [8.75, 12], [12.25, 12], [9.25, 14.5]], [0, 0.4, 0.4, 0])],
  },
  'power-plug': {
    tags: ['enchufe', 'clavija', 'corriente', 'plug', 'power', 'electricity'],
    d: [
      roundpoly(
        [
          [6, 6.5],
          [18, 6.5],
          [18, 11],
          [14.5, 15],
          [9.5, 15],
          [6, 11],
        ],
        [1.25, 1.25, 2, 1.5, 1.5, 2],
      ),
      line([9.5, 2.75], [9.5, 6.5]),
      line([14.5, 2.75], [14.5, 6.5]),
      line([12, 15], [12, 21.25]),
    ],
  },
  outlet: {
    tags: ['contacto', 'toma de corriente', 'enchufe de pared', 'outlet', 'socket', 'power'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, BR), circ(12, 12, 5), dot(10, 12), dot(14, 12)],
  },
  power: {
    tags: ['encender', 'apagar', 'energía', 'power', 'on off', 'shutdown'],
    d: [arc(12, 12.75, 8.25, -60, 240).d, line([12, 2.75], [12, 11])],
  },
  // ── Connectivity ──────────────────────────────────────────────────────────────────────────
  wifi: {
    tags: ['wifi', 'internet', 'inalámbrico', 'conexión', 'wireless', 'connection'],
    d: wifi(3),
  },
  'wifi-medium': {
    tags: ['wifi media', 'señal media', 'wifi medium', 'connection'],
    d: wifi(2),
  },
  'wifi-low': {
    tags: ['wifi débil', 'señal baja', 'wifi low', 'weak signal'],
    d: wifi(1),
  },
  'wifi-off': {
    tags: ['sin wifi', 'desconectado', 'sin internet', 'wifi off', 'offline', 'no connection'],
    // The engine clears the arcs with 1.5 of clearance. The slash sits 1.06 up and to the right of
    // the default one (it still runs through pixel centers at 16 px): the dot stays 5.66 from it
    // and survives in all three weights (with the default one, at 4.6, the bold weight removed it),
    // and no remaining arc run is shorter than 3.4 (previously 2.4)
    d: wifi(3),
    badge: slashOver([4.25, 2.75], [21.25, 19.75]),
  },
  bluetooth: {
    tags: ['bluetooth', 'inalámbrico', 'emparejar', 'wireless', 'pairing'],
    d: bluetooth(),
  },
  'bluetooth-connected': {
    tags: ['bluetooth conectado', 'emparejado', 'bluetooth connected', 'paired'],
    d: [...bluetooth(), dot(3.5, 12), dot(20.5, 12)],
  },
  signal: {
    tags: ['señal', 'cobertura', 'barras', 'signal', 'cellular', 'reception'],
    d: signal(4),
  },
  'signal-high': {
    tags: ['señal alta', 'buena cobertura', 'signal high', 'strong signal'],
    d: signal(3),
  },
  'signal-medium': {
    tags: ['señal media', 'cobertura media', 'signal medium', 'fair signal'],
    d: signal(2),
  },
  'signal-low': {
    tags: ['señal baja', 'poca cobertura', 'signal low', 'weak signal'],
    d: signal(1),
  },
  cast: {
    tags: ['transmitir', 'enviar a pantalla', 'cast', 'stream to tv'],
    // The screen opens right where its top corner's curve ends; the waves keep 3 from it
    // (previously the edge started inside the curve and sat 1.2 from the wave).
    d: [
      sqOpen(2.5, 4.5, 19, 15, 3, BR, [2.5, 9.3], 3, [12.75, 19.5], 2),
      dot(2.75, 19.25),
      arc(2.5, 19.5, 4, 270, 360).d,
      arc(2.5, 19.5, 7.25, 270, 360).d,
    ],
  },
  usb: {
    tags: ['usb', 'conector', 'puerto', 'cable', 'port', 'connector'],
    // The trident with fewer pieces and more room: open tip, stem, base, and one arm per side
    // ending in a circle and a square. Everything 3 apart so it doesn't clog up at 18 px.
    d: [
      line([12, 2.75], [12, 17.75]),
      line([10.4, 4.35], [12, 2.75], [13.6, 4.35]),
      circ(12, 19.5, 1.75),
      roundline(
        [
          [12, 14.75],
          [6.5, 12.5],
          [6.5, 10.75],
        ],
        [0, 1.25, 0],
      ),
      circ(6.5, 9, 1.75),
      roundline(
        [
          [12, 11.75],
          [18, 10],
          [18, 9.25],
        ],
        [0, 0.5, 0],
      ),
      sq(16.25, 5.75, 3.5, 3.5, 1),
    ],
  },
  // ── Playback ──────────────────────────────────────────────────────────────────────────────
  play: {
    tags: ['reproducir', 'iniciar', 'play', 'start'],
    d: [tri(20, 12, 12.5, 15.5, 2.25)],
  },
  'play-circle': {
    tags: ['reproducir', 'ver video', 'play circle', 'play video'],
    d: [circ(12, 12, 9), tri(16.25, 12, 6.25, 8, 1.25)],
  },
  pause: {
    tags: ['pausa', 'pausar', 'pause', 'hold'],
    d: [sq(6.25, 4.75, 4, 14.5, 1.25), sq(13.75, 4.75, 4, 14.5, 1.25)],
  },
  'pause-circle': {
    tags: ['pausa', 'pausar', 'pause circle', 'pause'],
    d: [circ(12, 12, 9), line([10, 8.75], [10, 15.25]), line([14, 8.75], [14, 15.25])],
  },
  stop: {
    tags: ['detener', 'parar', 'stop', 'halt'],
    d: [sq(5.25, 5.25, 13.5, 13.5, 3.5)],
  },
  'stop-circle': {
    tags: ['detener', 'parar', 'stop circle', 'stop'],
    d: [circ(12, 12, 9), sq(8.75, 8.75, 6.5, 6.5, 1.75)],
  },
  record: {
    tags: ['grabar', 'grabación', 'record', 'rec'],
    d: [circ(12, 12, 9), circ(12, 12, 4.75)],
  },
  'play-pause': {
    tags: ['reproducir o pausar', 'alternar', 'play pause', 'toggle'],
    d: [tri(11.25, 12, 8.25, 12, 1.5), line([15.5, 6.5], [15.5, 17.5]), line([20, 6.5], [20, 17.5])],
  },
  eject: {
    tags: ['expulsar', 'sacar', 'eject', 'remove disk'],
    d: [
      roundpoly(
        [
          [12, 4.25],
          [19.75, 13.25],
          [4.25, 13.25],
        ],
        1.75,
      ),
      line([4.25, 18], [19.75, 18]),
    ],
  },
  'skip-forward': {
    tags: ['siguiente', 'siguiente pista', 'saltar', 'next', 'skip', 'next track'],
    d: [tri(15.5, 12, 10.5, 14, 1.75), line([19, 5], [19, 19])],
  },
  'skip-back': {
    tags: ['anterior', 'pista anterior', 'regresar', 'previous', 'skip back', 'previous track'],
    d: [tri(8.5, 12, 10.5, 14, 1.75, -1), line([5, 5], [5, 19])],
  },
  // Previously one triangle's tip sat 0.7 from the other's base: they neither touched nor separated
  'fast-forward': {
    tags: ['adelantar', 'avanzar rápido', 'fast forward', 'seek forward'],
    d: FAST_FORWARD,
  },
  rewind: {
    tags: ['retroceder', 'regresar rápido', 'rewind', 'seek back'],
    d: FAST_FORWARD.map(mirrorPath),
  },
  repeat: {
    tags: ['repetir', 'bucle', 'repetir todo', 'repeat', 'loop'],
    d: repeat(),
  },
  'repeat-one': {
    tags: ['repetir una', 'repetir canción', 'repeat one', 'loop track'],
    d: [...repeat(), line([10.75, 11.25], [12.25, 10], [12.25, 14])],
  },
  shuffle: {
    tags: ['aleatorio', 'mezclar', 'shuffle', 'random'],
    // The descending one passes over: it goes in as a badge and the engine clears the other one
    // with 1.5 of clearance
    d: ['M3.25 17H6.5C11 17 12 7 16.5 7H20.75', head([20.75, 7], [1, 0], 3.4)],
    badge: (() => {
      const A = 'M3.25 7H6.5C11 7 12 17 16.5 17H20.75';
      return { d: [A, head([20.75, 17], [1, 0], 3.4)], knock: knockOf(A) };
    })(),
  },
  // ── Volume ────────────────────────────────────────────────────────────────────────────────
  'volume-low': {
    tags: ['volumen bajo', 'sonido', 'audio', 'volume low', 'sound'],
    d: [SPEAKER, SPEAKER_WAVES[0]],
  },
  'volume-high': {
    tags: ['volumen alto', 'sonido', 'audio', 'volume high', 'loud'],
    d: [SPEAKER, ...SPEAKER_WAVES],
  },
  'volume-off': {
    tags: ['sin volumen', 'silencio', 'silenciar', 'volume off', 'mute', 'muted'],
    d: [SPEAKER, ...MUTE],
  },
  'volume-plus': {
    tags: ['subir volumen', 'más volumen', 'volume up', 'louder'],
    d: [SPEAKER, line([16.4, 12], [21.2, 12]), line([18.8, 9.6], [18.8, 14.4])],
  },
  'volume-minus': {
    tags: ['bajar volumen', 'menos volumen', 'volume down', 'quieter'],
    d: [SPEAKER, line([16.4, 12], [21.2, 12])],
  },
  // ── Music and audio ───────────────────────────────────────────────────────────────────────
  // Notes use the tilted oval head of musical notation, with the stem tangent to its side: it's the
  // engraved note, not a circle on a stick.
  'music-note': {
    tags: ['nota musical', 'música', 'canción', 'music', 'song'],
    d: (() => {
      const n = note(9, 17.75, 3, 3.25, 2.3);
      return [n.head, n.stem, `M${N(n.x)} 3C${N(n.x)} 6.25 ${N(n.x + 5)} 6.5 ${N(n.x + 5)} 10.75`];
    })(),
  },
  'music-notes': {
    tags: ['notas', 'música', 'melodía', 'music', 'melody'],
    d: (() => {
      const a = note(6.75, 17.75, 6);
      const b = note(16.75, 15.75, 4);
      return [
        a.head,
        b.head,
        roundline(
          [
            [a.x, a.y],
            [a.x, 6],
            [b.x, 4],
            [b.x, b.y],
          ],
          [0, 0.75, 0.75, 0],
        ),
      ];
    })(),
  },
  playlist: {
    tags: ['lista de reproducción', 'canciones', 'playlist', 'queue'],
    d: (() => {
      const n = note(15.25, 18.5, 9.25, 2.75, 1.95);
      return [
        line([3.5, 5.5], [20.5, 5.5]),
        line([3.5, 10], [12.5, 10]),
        line([3.5, 14.5], [9.5, 14.5]),
        n.head,
        n.stem,
        line([n.x, 9.25], [n.x + 3, 10.5]),
      ];
    })(),
  },
  'playlist-play': {
    tags: ['reproducir lista', 'cola', 'a continuación', 'queue', 'playlist play', 'up next'],
    d: [
      line([3.5, 5.5], [20.5, 5.5]),
      line([3.5, 10], [11.5, 10]),
      line([3.5, 14.5], [11.5, 14.5]),
      line([3.5, 19], [11.5, 19]),
      tri(21, 14.5, 6.25, 8.5, 1.25),
    ],
  },
  // Bands of a spectrum analyzer rising from a shared baseline: lows, mids and highs with their
  // typical shape (previously they were lines with a dot on top and read as the letter «i»).
  equalizer: {
    tags: ['ecualizador', 'niveles', 'espectro', 'equalizer', 'audio levels'],
    d: [4.5, 8.25, 12, 15.75, 19.5].map((x, i) => line([x, 20], [x, [11.5, 5.5, 9, 4, 13][i]])),
  },
  'audio-waveform': {
    tags: ['onda de audio', 'forma de onda', 'voz', 'waveform', 'audio', 'voice'],
    d: [3, 6, 9, 12, 15, 18, 21].map((x, i) => {
      const h = [1.5, 4.25, 8, 5, 7, 3.5, 1.5][i];
      return line([x, 12 - h], [x, 12 + h]);
    }),
  },
  radio: {
    tags: ['radio', 'estación', 'fm', 'am', 'radio station'],
    d: [
      sq(2.5, 7.5, 19, 13, 3, BR),
      line([7, 7.5], [17.25, 3.25]),
      circ(8.5, 14, 3),
      line([14.5, 12.25], [18, 12.25]),
      line([14.5, 15.75], [18, 15.75]),
    ],
  },
  disc: {
    tags: ['disco', 'cd', 'dvd', 'disc', 'compact disc'],
    d: [circ(12, 12, 9), circ(12, 12, 2.25), arc(12, 12, 5.75, 195, 255).d],
  },
  // An r 3 label and r 6 grooves: 3 of clearance from the edge and from the label (previously 2.75)
  vinyl: {
    tags: ['vinil', 'acetato', 'tocadiscos', 'vinyl', 'record'],
    d: [circ(12, 12, 9), circ(12, 12, 3), dot(12, 12, 0.3), arc(12, 12, 6, 200, 250).d, arc(12, 12, 6, 20, 70).d],
  },
  podcast: {
    tags: ['podcast', 'episodio', 'programa', 'audio', 'episode', 'show'],
    d: [
      capsule(10.25, 8.25, 3.5, 6),
      line([12, 14.25], [12, 21.25]),
      arc(12, 11, 5.75, 130, 410).d,
      arc(12, 11, 9, 130, 410).d,
    ],
  },
  live: {
    tags: ['en vivo', 'transmisión', 'directo', 'live', 'streaming', 'broadcast'],
    d: [
      sq(2.5, 5, 19, 14, 3.5, BR),
      dot(12, 12),
      arc(12, 12, 4, -45, 45).d,
      arc(12, 12, 4, 135, 225).d,
    ],
  },
  // The square cover with the set's engraved note (previously it was a square with a circle and
  // read as a speaker or a lens; a disc peeking out from behind couldn't be made out at 18 px).
  album: {
    tags: ['álbum', 'portada', 'disco', 'album', 'cover', 'music library'],
    d: (() => {
      const n = note(10.75, 15.5, 7.25, 2.5, 1.75);
      return [sq(3.25, 3.25, 17.5, 17.5, 4, BR), n.head, n.stem, `M${N(n.x)} 7.25C${N(n.x)} 9.25 ${N(n.x + 3.5)} 9.5 ${N(n.x + 3.5)} 12.25`];
    })(),
  },
  // ── Image and video ───────────────────────────────────────────────────────────────────────
  image: {
    tags: ['imagen', 'foto', 'fotografía', 'image', 'photo', 'picture'],
    d: image(),
  },
  images: {
    tags: ['galería', 'fotos', 'álbum de fotos', 'gallery', 'images', 'photos'],
    // The back photo in full; the front one (with its sun and mountain range) goes in as a badge
    // and the engine clears the back one with 1.5 of clearance. Offset 4.25 horizontally: the back
    // photo's bottom corner peeks out with a run of 2 (at 3.5 it left a loose 1.25 foot)
    d: [sq(6.75, 3.25, 14.75, 13.5, 3, BR)],
    badge: (() => {
      const frame = sq(2.5, 7.25, 14.75, 13.5, 3, BR);
      const sun = dot(13.5, 10.75);
      const ridge = roundline([toEdge([10, 12.25], [0, 20.17], frame), [10, 12.25], [17.25, 17.91]], [0, 1.25, 0]);
      return front([frame, sun, ridge], frame, { solid: [frame], cut: [sun, extend(ridge)] });
    })(),
  },
  'image-off': {
    tags: ['sin imagen', 'imagen rota', 'image off', 'no image', 'broken image'],
    d: image(),
    badge: slashOver(),
  },
  film: {
    tags: ['película', 'cinta', 'cine', 'film', 'movie', 'video'],
    d: (() => {
      const box = sq(4.75, 2.75, 14.5, 18.5, 3.5, BR);
      const inner = [line([8.5, 1], [8.5, 23]), line([15.5, 1], [15.5, 23])];
      // Two crossbars per side split each edge into three perforations (with three it was dense)
      const ticks = [9, 15].flatMap((y) => [line([4.75, y], [8.5, y]), line([15.5, y], [19.25, y])]);
      return [box, ...cut(inner, [outside(box)]), ...ticks];
    })(),
  },
  clapperboard: {
    tags: ['claqueta', 'cine', 'rodaje', 'clapperboard', 'movie', 'film'],
    d: [sq(3.25, 9.5, 17.5, 11.25, 3, { square: ['tl', 'br'] }), ...clapper()],
  },
  'slow-motion': {
    tags: ['cámara lenta', 'velocidad', 'slow motion', 'slowmo'],
    d: [arc(12, 12, 9, -90, 180).d, dot(...polar(12, 12, 9, 210)), dot(...polar(12, 12, 9, 240)), tri(15.5, 12, 5.75, 7, 1.1)],
  },
  // Two centered lines at the bottom of the image, the way subtitles appear on screen
  captions: {
    tags: ['subtítulos', 'texto en pantalla', 'subtitles', 'captions', 'cc'],
    d: [sq(2.5, 5, 19, 14, 3.5, BR), line([6.5, 12.75], [17.5, 12.75]), line([8.75, 15.75], [15.25, 15.75])],
  },
  aperture: {
    tags: ['apertura', 'diafragma', 'lente', 'aperture', 'lens'],
    d: aperture(),
  },
  'camera-focus': {
    tags: ['enfocar', 'visor', 'escanear', 'focus', 'viewfinder', 'scan'],
    d: [
      ...cut(sq(3.25, 3.25, 17.5, 17.5, 4, BR), [(p) => (p[0] > 8.75 && p[0] < 15.25) || (p[1] > 8.75 && p[1] < 15.25)]),
      circ(12, 12, 3.25),
    ],
  },
  'camera-flip': {
    tags: ['cambiar cámara', 'cámara frontal', 'flip camera', 'switch camera'],
    d: (() => {
      // The arrows turn where the lens is; their tips sit at the sides, away from the edge
      const [body, hump] = camera();
      const a = arc(12, 13.5, 3.5, 205, 335);
      const b = arc(12, 13.5, 3.5, 25, 155);
      return [body, hump, a.d, head(a.end, a.tangent, 2.5), b.d, head(b.end, b.tangent, 2.5)];
    })(),
  },
  'picture-in-picture': {
    tags: ['imagen en imagen', 'ventana flotante', 'picture in picture', 'pip'],
    d: [sq(2.5, 5, 19, 14, 3.5, BR), sq(11.5, 11, 7, 5, 1.5, BR)],
  },
  'video-player': {
    tags: ['reproductor', 'video', 'progreso', 'player', 'media', 'video player'],
    d: [sq(2.5, 5, 19, 14, 3.5, BR), tri(14.75, 10.25, 4.5, 5.5, 1), line([6, 15.75], [18, 15.75]), dot(8, 15.75)],
  },
  'screen-mirror': {
    tags: ['duplicar pantalla', 'proyectar', 'transmitir', 'screen mirroring', 'mirror', 'stream'],
    // The full screen; the triangle sits in front as a badge and the engine clears the screen with
    // 1.5 of clearance
    d: [sq(2.5, 4, 19, 13, 3, BR)],
    badge: front([
      roundpoly(
        [
          [12, 13.25],
          [16.75, 20.5],
          [7.25, 20.5],
        ],
        1.25,
      ),
    ]),
  },
  // The label on top and the two reels as rings below; without the tangent between the reels or the
  // trapezoidal window, which, with the reels on top, turned it into a face.
  cassette: {
    tags: ['casete', 'cinta', 'mixtape', 'cassette', 'tape'],
    d: [sq(2.5, 5, 19, 14, 3, BR), line([6.5, 8.25], [17.5, 8.25]), circ(8.25, 13.5, 2.25), circ(15.75, 13.5, 2.25)],
  },
  // ── Ports, charging and more hardware ─────────────────────────────────────────────────────
  'wireless-charging': {
    tags: ['carga inalámbrica', 'cargador', 'base de carga', 'wireless charging', 'charger', 'qi'],
    d: [
      capsule(3.25, 16.5, 17.5, 3.75),
      line([12.75, 3.75], [9.75, 8.75], [14.25, 8.75], [11.25, 13.25]),
      arc(12, 8.5, 6.75, 140, 220).d,
      arc(12, 8.5, 6.75, -40, 40).d,
    ],
  },
  ethernet: {
    tags: ['ethernet', 'red', 'cable de red', 'lan', 'network', 'port'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, BR), roundpoly(PORT, PORT_R)],
  },
  joystick: {
    tags: ['palanca', 'arcade', 'videojuego', 'joystick', 'game', 'retro'],
    // Arcade stick: a ball on a shaft rising from a domed base
    d: [dome(3.25, 20.75, 20.75, 5.25), line([12, 15.5], [12, 9.5]), circ(12, 6.25, 3.25)],
  },
  scanner: {
    tags: ['escáner', 'escanear', 'digitalizar', 'scanner', 'scan', 'document'],
    d: [sq(2.5, 11.75, 19, 8.5, 2.5, BR), line([3, 8.75], [20.75, 4.25]), line([6, 16], [18, 16])],
  },
  turntable: {
    tags: ['tocadiscos', 'tornamesa', 'vinilo', 'turntable', 'dj', 'record player'],
    // Landscape cabinet (it was square and too heavy) and a full platter with its spindle; the
    // tonearm, from the pivot to the record, passes over as a badge and the engine clears the
    // platter with 1.5 of clearance.
    d: [sq(2.5, 5, 19, 14, 3.5, BR), circ(9.5, 12, 4), dot(9.5, 12)],
    badge: (() => {
      const tone = roundline(
        [
          [17.5, 8.25],
          [17.5, 12.75],
          [13.25, 14.75],
        ],
        [0, 1, 0],
      );
      return { d: [dot(17.5, 8.25), tone], knock: knockOf(tone) };
    })(),
  },
  tripod: {
    tags: ['tripié', 'trípode', 'soporte', 'tripod', 'stand', 'camera stand'],
    d: [
      sq(7.5, 3, 9, 4.75, 1.45, BR),
      line([12, 7.75], [12, 21]),
      line([12, 10.75], [5.5, 21]),
      line([12, 10.75], [18.5, 21]),
    ],
  },
  drone: {
    tags: ['dron', 'cuadricóptero', 'vuelo', 'drone', 'quadcopter', 'aerial'],
    d: [
      sq(8.75, 9.5, 6.5, 5.25, 1.6),
      line([3.25, 12], [8.75, 12]),
      line([15.25, 12], [20.75, 12]),
      line([5.25, 12], [5.25, 6.25]),
      line([18.75, 12], [18.75, 6.25]),
      line([2.75, 6.25], [7.75, 6.25]),
      line([16.25, 6.25], [21.25, 6.25]),
      line([10.25, 14.75], [9, 18.25]),
      line([13.75, 14.75], [15, 18.25]),
    ],
  },

  // ── Coverage (round 2) ────────────────────────────────────────────────────────────────────────
  'sim-card': {
    tags: ['tarjeta sim', 'chip', 'línea móvil', 'plan de datos', 'sim card', 'esim', 'mobile plan'],
    // The card (like `sd-card`, but seen from the front: the chamfer at the top right) with a
    // four-contact chip.
    d: [
      roundpoly(
        [
          [5.25, 2.75],
          [14.75, 2.75],
          [18.75, 6.75],
          [18.75, 21.25],
          [5.25, 21.25],
        ],
        [2.5, 1, 1, 0, 2.5],
      ),
      sq(8.5, 11.25, 7, 7, 1.5),
      line([8.5, 14.75], [15.5, 14.75]),
      line([12, 11.25], [12, 18.25]),
    ],
  },
  'image-sparkle': {
    tags: ['imagen con ia', 'generar imagen', 'foto generada', 'editar con ia', 'ai image', 'generate image', 'ai photo'],
    // The photo and, in the top corner, the AI spark (the one in datos/sparkle) as a custom piece:
    // the engine clears the frame with 1.5 of clearance. No sun: the spark takes its place, 3 from
    // the mountain peak (any closer and the clearing bit into it).
    d: [IMAGE_FRAME, image()[2]],
    badge: (() => {
      const spark = aiSpark(18.75, 5.5, 3);
      return { d: [spark], knock: spark, fill: { solid: [spark] } };
    })(),
  },
};

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of d: `solid` is filled (and keeps its stroke, so the silhouette is identical); `close`
// marks bodies that the outline leaves open against another piece (the camera's hump, the watch
// straps) and that are filled closed (`${stroke}Z`: the closing edge runs along that piece's edge);
// `cut` is knocked out at stroke width; `lines` stays a line, with 1.5 of clearance from the fill,
// and `wire` stays a line attached to the fill, with no clearance (a monitor's stand, an antenna, a
// note stem).
const FILL = {
  smartphone: { solid: [0], cut: [1] },
  'smartphone-vibrate': { solid: [0], cut: [1], lines: [2, 3, 4, 5] },
  tablet: { solid: [0], cut: [1] },
  laptop: { solid: [0], lines: [1] },
  desktop: { solid: [0], wire: [1, 2] },
  devices: { solid: [0], wire: [1, 2] },
  // The straps are filled up to the edge of the case: the whole watch is one silhouette; the crown
  // is attached to the case
  watch: { solid: [0], close: [1, 2], wire: [3] },
  tv: { solid: [0], wire: [1, 2] },
  keyboard: { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  mouse: { solid: [0], cut: [1] },
  // Body, input sheet and output sheet form one silhouette; the slot is knocked out
  printer: { close: [0, 1, 3], cut: [2] },
  camera: { solid: [0], close: [1], cut: [2] },
  'camera-off': { solid: [0], close: [1], cut: [2] },
  'video-camera': { solid: [0], close: [1] },
  'video-camera-off': { solid: [0], close: [1] },
  webcam: { solid: [0], wire: [2, 3], cut: [1] },
  // The head closes over its stem: the closing edge runs along the stem itself
  earbuds: { close: [0, 1] },
  'speaker-box': { solid: [0], cut: [1, 2] },
  'smart-speaker': { solid: [0], cut: [1, 2, 3] },
  'remote-control': { solid: [0], cut: [1, 2, 3, 4, 5] },
  gamepad: { solid: [0], cut: [1, 2, 3] },
  'vr-headset': { solid: [0] },
  'sd-card': { solid: [0], cut: [1, 2, 3] },
  'usb-drive': { solid: [0], close: [1], cut: [2] },
  router: { solid: [0], wire: [1, 2], cut: [3, 4, 5] },
  projector: { solid: [0], wire: [4, 5], cut: [1, 2, 3] },
  'battery-charging': { solid: [0], lines: [1], cut: [2] },
  'power-plug': { solid: [0], wire: [1, 2, 3] },
  outlet: { solid: [0], cut: [1, 2, 3] },
  play: { solid: [0] },
  pause: { solid: [0, 1] },
  'pause-circle': { solid: [0], cut: [1, 2] },
  stop: { solid: [0] },
  // The record button: the dot is filled and the ring stays a line
  record: { solid: [1], lines: [0] },
  // The loose bars next to the triangle stay lines
  'play-pause': { solid: [0], lines: [1, 2] },
  eject: { solid: [0], lines: [1] },
  'skip-forward': { solid: [0], lines: [1] },
  'skip-back': { solid: [0], lines: [1] },
  'fast-forward': { solid: [0, 1] },
  rewind: { solid: [0, 1] },
  'volume-low': { solid: [0], lines: [1] },
  'volume-high': { solid: [0], lines: [1, 2] },
  'volume-off': { solid: [0], lines: [1, 2] },
  'volume-plus': { solid: [0], lines: [1, 2] },
  'volume-minus': { solid: [0], lines: [1] },
  // The note head is filled; the rows stay lines, and the stem and its flag are attached to the head
  playlist: { solid: [3], lines: [0, 1, 2], wire: [4, 5] },
  // The rows don't touch the triangle, but they go with no clearance: with the `lines` clearance,
  // the bold weight bit into its base
  'playlist-play': { solid: [4], wire: [0, 1, 2, 3] },
  radio: { solid: [0], wire: [1], cut: [2, 3, 4] },
  vinyl: { solid: [0], cut: [1, 2, 3, 4] },
  podcast: { solid: [0], wire: [1], lines: [2, 3] },
  live: { solid: [0], cut: [1, 2, 3] },
  images: { solid: [0] },
  'slow-motion': { solid: [1, 2, 3], lines: [0] },
  captions: { solid: [0], cut: [1, 2] },
  'camera-focus': { solid: [4], lines: [0, 1, 2, 3] },
  'camera-flip': { solid: [0], close: [1], cut: [2, 3, 4, 5] },
  // Picture-in-picture: the floating window is filled, since it's what the icon points to
  'picture-in-picture': { solid: [1], lines: [0] },
  'screen-mirror': { solid: [0] },
  cassette: { solid: [0], cut: [1, 2, 3] },
  'wireless-charging': { solid: [0], lines: [1, 2, 3] },
  joystick: { solid: [0, 2], wire: [1] },
  scanner: { solid: [0], lines: [1], cut: [2] },
  turntable: { solid: [0], cut: [1, 2] },
  tripod: { solid: [0], wire: [1, 2, 3] },
  drone: { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7, 8] },
  'sim-card': { solid: [0], cut: [1, 2, 3] },
};
/** An open body from the outline, closed for `fill.solid` (solid only takes closed shapes). */
const shut = (d) => `${d}Z`;
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = {
    solid: [...pick(spec.solid ?? []), ...pick(spec.close ?? []).map(shut)],
    ...(spec.cut && { cut: pick(spec.cut) }),
    ...(spec.lines && { lines: pick(spec.lines) }),
    ...(spec.wire && { wire: pick(spec.wire) }),
  };
}
// Open pieces that touch the body (antenna, headband, arms, note stem, beam) stay lines, attached
// to the fill (`wire`): they are neither filled up to their chord nor bite into the body with the
// `lines` clearance.
{
  const d = (n) => icons[n].d;
  icons['tv-retro'].fill = { solid: [d('tv-retro')[0]], wire: [d('tv-retro')[1]], cut: [d('tv-retro')[2], d('tv-retro')[3]] };
  icons.headphones.fill = { solid: [d('headphones')[1], d('headphones')[2]], wire: [d('headphones')[0]] };
  // The filled USB: the tip becomes a solid triangle; the stem and the bent arms, attached
  const u = d('usb');
  icons.usb.fill = { solid: [shut(u[1]), u[2], u[4], u[6]], wire: [u[0], u[3], u[5]] };
  icons['music-note'].fill = { solid: [d('music-note')[0]], wire: [d('music-note')[1], d('music-note')[2]] };
  icons['music-notes'].fill = { solid: [d('music-notes')[0], d('music-notes')[1]], wire: [d('music-notes')[2]] };
  // The cast screen closes with an arc concentric with the waves, 3 from the largest one: the fill
  // reaches where the open outline ends without covering the waves
  const c = d('cast');
  icons.cast.fill = { solid: [`${c[0]}A10.25 10.25 0 0 0 2.5 9.3Z`, c[1]], lines: [c[2], c[3]] };
  // Details that reach the outline (the flashlight's slot, the microphone's band, the mountain
  // range, the perforations, the clapperboard's stripes) are knocked out all the way through, with
  // no notch in the silhouette
  const x = (name, i, k0 = 1, k1 = 1) => extend(d(name)[i], k0, k1);
  icons.flashlight.fill = { solid: [d('flashlight')[0]], cut: [x('flashlight', 1), d('flashlight')[2]] };
  icons['flashlight-on'].fill = { solid: [d('flashlight-on')[0]], cut: [x('flashlight-on', 1), d('flashlight-on')[2]], lines: d('flashlight-on').slice(3) };
  // The handle closes along the chord that crosses the head (it stays inside the head's fill)
  icons['microphone-handheld'].fill = { solid: [d('microphone-handheld')[0], shut(d('microphone-handheld')[1])], cut: [x('microphone-handheld', 2)] };
  icons['microphone-studio'].fill = {
    solid: [d('microphone-studio')[0], d('microphone-studio')[4]],
    wire: [d('microphone-studio')[3]],
    cut: [x('microphone-studio', 1), x('microphone-studio', 2)],
  };
  for (const name of ['image', 'image-off']) icons[name].fill = { solid: [d(name)[0]], cut: [d(name)[1], x(name, 2)] };
  icons['image-sparkle'].fill = { solid: [d('image-sparkle')[0]], cut: [x('image-sparkle', 1)] };
  // The film: the perforations stay as blocks; only the outer end of each crossbar is extended (the
  // inner end touches the rail and must not bite into the center strip)
  icons.film.fill = { solid: [d('film')[0]], cut: [x('film', 1), x('film', 2), x('film', 3, 1, 0), x('film', 4, 0, 1), x('film', 5, 1, 0), x('film', 6, 0, 1)] };
  icons.clapperboard.fill = { solid: d('clapperboard').slice(0, 2), cut: [2, 3, 4].map((i) => x('clapperboard', i)) };
  // The aperture: the ring stays whole; the blades are knocked out up to 0.75 short of its line
  icons.aperture.fill = { solid: [d('aperture')[0]], cut: aperture(8.25).slice(1) };
  // Whatever is a hole in the outline (the play triangle, the stop square, the disc's hole, the
  // note head, the port) is emptied in the fill. The hole sits 0.75 outside the shape and the shape
  // is knocked out: the mask gives the hole its edge, at the line's outer edge, without the seam
  // left by two antialiased edges in the same place.
  for (const [name, hole, cut] of [
    ['play-circle', grown(triPts(16.25, 12, 6.25, 8), 1.25, 0.75), [1]],
    ['stop-circle', sq(8, 8, 8, 8, 2.5), [1]],
    ['disc', circ(12, 12, 3), [1, 2]],
    ['album', ellipse(10.75, 15.5, 3.25, 2.5, -24), [1, 2, 3]],
    ['video-player', grown(triPts(14.75, 10.25, 4.5, 5.5), 1, 0.75), [1, 2, 3]],
    ['ethernet', grown(PORT, PORT_R, 0.75), [1]],
  ])
    icons[name].fill = { solid: [withHoles(d(name)[0], hole)], cut: cut.map((i) => d(name)[i]) };
}
// Only open lines (waves, bars, arrows, the Bluetooth rune): their filled version is the outline
// itself. The battery levels don't get one either: a solid body reads as a full battery, no matter
// how many bars it has.
for (const name of [
  'power', 'wifi', 'wifi-medium', 'wifi-low', 'wifi-off', 'bluetooth', 'bluetooth-connected',
  'signal', 'signal-high', 'signal-medium', 'signal-low', 'repeat', 'repeat-one', 'shuffle', 'equalizer', 'audio-waveform',
  'battery-full', 'battery-half', 'battery-low', 'battery-empty',
])
  icons[name].fill = false;

// ── 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough ──────────────
// At 16 px a pixel is 1.5 canvas units: straight runs go on pixel centers (0.75 + 1.5k), 45°
// diagonals pass through pixel centers (x ± y a multiple of 1.5), circles touch pixel centers at
// their four cardinal points, and 2 × 2 pixel dots are centered on a pixel corner. At least 1 px of
// space between pieces. A drawing centered on x 12 with a vertical stroke in the middle shifts half
// a pixel to the right (12.75): a stroke at 12 would render 2 px wide and gray.
const small = (name, d, fill, badge) => {
  icons[name].small = { d, ...(fill && { fill }), ...(badge && { badge }) };
};
const sdot = (x, y) => dot(x, y, 1);
{
  // Keyboard: two rows of three 2 px keys and the space bar, with 1 px between rows (the 0.3 dots
  // turned into gray bands)
  const body = sq(2.25, 6.75, 19.5, 12, 3, BR);
  const keys = [9.75, 12.75].flatMap((y) => [6.75, 11.25, 15.75].map((x) => line([x, y], [x + 1.5, y])));
  const bar = line([8.25, 15.75], [15.75, 15.75]);
  small('keyboard', [body, ...keys, bar], { solid: [body], cut: [...keys, bar] });
}
{
  // Remote control: the big button as a hollow 4 px square (a 4 px ring filled in gray) and four
  // 1 px buttons
  const body = sq(6.75, 2.25, 10.5, 19.5, 3, BR);
  const ring = sq(9.75, 5.25, 4.5, 4.5, 1.2);
  const keys = [14.25, 17.25].flatMap((y) => [9.75, 14.25].map((x) => dot(x, y, 0.3)));
  small('remote-control', [body, ring, ...keys], { solid: [body], cut: [ring, ...keys] });
}
{
  // Gamepad: a 3 px D-pad and the stick as a 3 px disc, 2 px apart
  const body = roundpoly(
    [
      [6, 5.25],
      [18, 5.25],
      [21.5, 16.25],
      [18.25, 19],
      [15.25, 15.75],
      [8.75, 15.75],
      [5.75, 19],
      [2.5, 16.25],
    ],
    [3.25, 3.25, 2.25, 1.5, 1.5, 1.5, 1.5, 2.25],
  );
  const dpad = [line([6.75, 9.75], [9.75, 9.75]), line([8.25, 8.25], [8.25, 11.25])];
  const stick = dot(15.75, 9.75, 0.75);
  small('gamepad', [body, ...dpad, stick], { solid: [body], cut: [...dpad, stick] });
}
{
  // Outlet: the plate, the socket ring and two 1 × 2 px slots (the two round holes turned into a
  // gray smudge)
  const plate = sq(2.25, 2.25, 19.5, 19.5, 4, BR);
  const ring = circ(12, 12, 5.25);
  const slots = [9.75, 14.25].map((x) => line([x, 11.25], [x, 12.75]));
  small('outlet', [plate, ring, ...slots], { solid: [plate], cut: [ring, ...slots] });
}
{
  // Projector: the lens as a 5 px ring with a hollow center and two lines at its height
  const body = sq(2.25, 5.25, 19.5, 12, 3, BR);
  const lens = circ(15.75, 11.25, 3);
  const rows = [9.75, 12.75].map((y) => line([5.25, y], [8.25, y]));
  const feet = [5.25, 18.75].map((x) => line([x, 17.25], [x, 20.25]));
  small('projector', [body, lens, ...rows, ...feet], { solid: [body], wire: feet, cut: [lens, ...rows] });
}
{
  // Charging battery: a taller bolt with no rounded corners (the 5-tall one became a blur; one with
  // 45° diagonals read as a cross); the body grows 1 px downward to leave it room above and below
  const body = sq(2.25, 6.75, 16.5, 12, 3, BR);
  const tip = line([21.75, 11.25], [21.75, 14.25]);
  const bolt = line([12.25, 9.5], [8.75, 12.75], [12.75, 12.75], [9.25, 16]);
  small('battery-charging', [body, tip, bolt], { solid: [body], lines: [tip], cut: [bolt] });
}
{
  // Switch camera: at 16 px the circular arrows clogged up; two opposing arrows (⇄)
  const body = sq(2.25, 6.75, 19.5, 13.5, 3, BR);
  const hump = roundline(
    [
      [8.25, 6.75],
      [9.75, 3.75],
      [14.25, 3.75],
      [15.75, 6.75],
    ],
    [0, 0.75, 0.75, 0],
  );
  const arrows = [line([8.25, 11.25], [15.75, 11.25]), head([15.75, 11.25], [1, 0], 1.5 * Math.SQRT2), line([15.75, 15.75], [8.25, 15.75]), head([8.25, 15.75], [-1, 0], 1.5 * Math.SQRT2)];
  small('camera-flip', [body, hump, ...arrows], { solid: [body, shut(hump)], cut: arrows });
}
{
  // Wireless charging: the bolt (the battery's, larger) over the pad; without the waves, which at
  // 16 px wrapped it in gray parentheses
  const pad = capsule(3.75, 17.25, 16.5, 3);
  const bolt = line([13.87, 4.94], [9.5, 9], [14.5, 9], [10.12, 13.06]);
  small('wireless-charging', [pad, bolt], { solid: [pad], lines: [bolt] });
}
{
  // SIM: the 45° chamfer through pixel centers and the chip with a single line
  const card = roundpoly(
    [
      [5.25, 2.25],
      [14.25, 2.25],
      [18.75, 6.75],
      [18.75, 21.75],
      [5.25, 21.75],
    ],
    [2.25, 1, 1, 0, 2.25],
  );
  const chip = sq(8.25, 12.75, 7.5, 6, 1.25);
  const contact = line([8.25, 15.75], [15.75, 15.75]);
  small('sim-card', [card, chip, contact], { solid: [card], cut: [chip, contact] });
}
{
  // Turntable: a clean ring for the platter and the tonearm on top, cleared by the engine
  const cabinet = sq(2.25, 5.25, 19.5, 13.5, 3, BR);
  const platter = circ(9, 12, 3.75);
  const tone = line([17.25, 6.75], [17.25, 12.75], [14.25, 15.75]);
  small('turntable', [cabinet, platter], { solid: [cabinet], cut: [platter] }, { d: [tone], knock: knockOf(tone) });
}
{
  // USB: the trident with its stem on a pixel center, 45° arms and 3 px ends
  const stem = line([12.75, 2.25], [12.75, 17.25]);
  const tip = line([11.25, 3.75], [12.75, 2.25], [14.25, 3.75]);
  const base = circ(12.75, 18.75, 1.5);
  const left = line([12.75, 15.75], [6.75, 9.75], [6.75, 8.25]);
  const bead = circ(6.75, 6.75, 1.5);
  const right = line([12.75, 14.25], [17.25, 9.75]);
  const block = sq(15.75, 6.75, 3, 3, 0.6);
  small('usb', [stem, tip, base, left, bead, right, block], { solid: [shut(tip), base, bead, block], wire: [stem, left, right] });
}
{
  // Podcast: shifted half a pixel to the right so the stem is 1 px; the microphone and a single
  // wave (with two, the arcs became a gray fan)
  const mic = capsule(11.25, 6.75, 3, 6);
  const stem = line([12.75, 12.75], [12.75, 20.25]);
  const wave = arc(12.75, 9.75, 6, 140, 400).d;
  small('podcast', [mic, stem, wave], { solid: [mic], wire: [stem], lines: [wave] });
}
{
  // Live: the 2 × 2 px dot and a pair of arcs touching pixel centers, 2 px from the dot (at 1 px
  // they merged with it into a bow tie)
  const frame = sq(2.25, 5.25, 19.5, 13.5, 3.5, BR);
  const signal = [sdot(12, 12), arc(12, 12, 5.25, -40, 40).d, arc(12, 12, 5.25, 140, 220).d];
  small('live', [frame, ...signal], { solid: [frame], cut: signal });
}
{
  // Bluetooth: the rune with its four 45° diagonals through pixel centers, crossing the stem at a
  // single point (the large drawing's fell between pixels)
  const rune = line([8.25, 8.25], [17.25, 17.25], [12.75, 21.75], [12.75, 3.75], [17.25, 8.25], [8.25, 17.25]);
  small('bluetooth', [rune]);
  small('bluetooth-connected', [rune, sdot(4.5, 12), sdot(21, 12)]);
}
{
  // Volume off: the speaker snapped to the pixel grid and a 5 px × with a single pixel at the center
  const speaker = snap(SPEAKER);
  const x = [line([15.75, 9.75], [21.75, 15.75]), line([21.75, 9.75], [15.75, 15.75])];
  small('volume-off', [speaker, ...x], { solid: [speaker], lines: x });
}
{
  // Webcam: shifted half a pixel to the right (the 1 px stand); an r 6 ring and a 3 px lens
  const ring = circ(12.75, 9.75, 6);
  const lens = circ(12.75, 9.75, 1.5);
  const stand = [line([12.75, 15.75], [12.75, 20.25]), line([8.25, 20.25], [17.25, 20.25])];
  small('webcam', [ring, lens, ...stand], { solid: [ring], wire: stand, cut: [lens] });
}
{
  // Speaker: a 14 px tall cabinet, the tweeter as a 2 × 2 px dot and the woofer as a clean ring
  const cabinet = sq(5.25, 2.25, 13.5, 19.5, 3.5, BR);
  const tweeter = sdot(12, 7.5);
  const woofer = circ(12, 15, 3.75);
  small('speaker-box', [cabinet, tweeter, woofer], { solid: [cabinet], cut: [tweeter, woofer] });
}
{
  // Cassette: the reels as 3 px rings centered on a pixel (hollow; 4 px ones filled in gray)
  const body = sq(2.25, 5.25, 19.5, 13.5, 3, BR);
  const label = line([6.75, 8.25], [17.25, 8.25]);
  const reels = [circ(8.25, 14.25, 1.5), circ(15.75, 14.25, 1.5)];
  small('cassette', [body, label, ...reels], { solid: [body], cut: [label, ...reels] });
}
{
  // Radio: the speaker as a 5 px ring centered on a pixel and the lines at its height
  const body = sq(2.25, 8.25, 19.5, 12, 3, BR);
  const antenna = line([6.75, 8.25], [17.25, 3.75]);
  const speaker = circ(8.25, 14.25, 3);
  const rows = [12.75, 15.75].map((y) => line([15.75, y], [18.75, y]));
  small('radio', [body, antenna, speaker, ...rows], { solid: [body], wire: [antenna], cut: [speaker, ...rows] });
}
{
  // Vinyl: the disc touching pixel centers, the label as a 2 × 2 px dot and two longer grooves
  // (with the label as a 4 px ring it became a smudge)
  const disc = circ(12, 12, 8.25);
  const label = sdot(12, 12);
  const grooves = [arc(12, 12, 5.25, 190, 260).d, arc(12, 12, 5.25, 10, 80).d];
  small('vinyl', [disc, label, ...grooves], { solid: [disc], cut: [label, ...grooves] });
}
{
  // Slow motion: the arc touching pixel centers, two 1 px dots and the triangle at 45°
  const ring = arc(12, 12, 8.25, -90, 180).d;
  const dots = [dot(5.25, 8.25, 0.3), dot(8.25, 5.25, 0.3)];
  const play = roundpoly(
    [
      [9.75, 8.25],
      [13.5, 12],
      [9.75, 15.75],
    ],
    0.75,
  );
  small('slow-motion', [ring, ...dots, play], { solid: [...dots, play], lines: [ring] });
}

// ── Levels (DESIGN.md › Levels): from least to most; the Wi-Fi dot and the body always stay ──
icons.wifi.levels = [[1], [2], [3]];
icons.signal.levels = [[0], [1], [2], [3]];
icons['battery-full'].levels = [[2], [3], [4], [5]];
icons['volume-high'].levels = [[1], [2]];

// ── Mirroring (DESIGN.md › Mirroring): speakers and indented lists flip in right-to-left layouts.
// Playback controls don't: they describe the direction of the tape, not the reading direction.
for (const name of ['volume-low', 'volume-high', 'volume-off', 'volume-plus', 'volume-minus', 'playlist', 'playlist-play']) icons[name].mirror = true;

// ── Named parts (DESIGN.md › Named parts): what moves, changes state or is a badge ──
const parts = {
  'smartphone-vibrate': { body: [0, 1], wave: [2, 3, 4, 5] },
  devices: { screen: [0], stand: [1, 2] },
  camera: { body: [0, 1], lens: [2] },
  'camera-off': { body: [0, 1], lens: [2] },
  'video-camera': { body: [0], lens: [1] },
  'video-camera-off': { body: [0], lens: [1] },
  printer: { body: [0], paper: [1], slot: [2], sheet: [3] },
  'speaker-box': { cabinet: [0], tweeter: [1], woofer: [2] },
  'smart-speaker': { body: [0], wave: [1, 2, 3] },
  gamepad: { body: [0], dpad: [1, 2], stick: [3] },
  'flashlight-on': { body: [0, 1, 2], rays: [3, 4, 5] },
  'battery-full': { body: [0, 1], level: [2, 3, 4, 5] },
  'battery-half': { body: [0, 1], level: [2, 3] },
  'battery-low': { body: [0, 1], level: [2] },
  'battery-empty': { body: [0, 1] },
  'battery-charging': { body: [0, 1], bolt: [2] },
  'power-plug': { plug: [0, 1, 2], cable: [3] },
  wifi: { dot: [0], level: [1, 2, 3] },
  'wifi-medium': { dot: [0], level: [1, 2] },
  'wifi-low': { dot: [0], level: [1] },
  'wifi-off': { dot: [0], level: [1, 2, 3] },
  signal: { level: [0, 1, 2, 3] },
  'signal-high': { level: [0, 1, 2], empty: [3] },
  'signal-medium': { level: [0, 1], empty: [2, 3] },
  'signal-low': { level: [0], empty: [1, 2, 3] },
  cast: { screen: [0], signal: [1, 2, 3] },
  'play-circle': { shape: [0], play: [1] },
  'pause-circle': { shape: [0], pause: [1, 2] },
  'stop-circle': { shape: [0], stop: [1] },
  record: { ring: [0], dot: [1] },
  eject: { arrow: [0], bar: [1] },
  // The back triangle and the front one (the one that points), so they can light up one after the other
  'fast-forward': { back: [0], front: [1] },
  rewind: { back: [0], front: [1] },
  'skip-forward': { arrow: [0], bar: [1] },
  'skip-back': { arrow: [0], bar: [1] },
  repeat: { arrow: [0, 1, 2, 3] },
  'repeat-one': { arrow: [0, 1, 2, 3], one: [4] },
  shuffle: { arrow: [0, 1] },
  'volume-low': { speaker: [0], level: [1] },
  'volume-high': { speaker: [0], level: [1, 2] },
  'volume-off': { speaker: [0], mark: [1, 2] },
  'volume-plus': { speaker: [0], mark: [1, 2] },
  'volume-minus': { speaker: [0], mark: [1] },
  'music-note': { head: [0], stem: [1, 2] },
  'music-notes': { head: [0, 1], stem: [2] },
  equalizer: { bars: [0, 1, 2, 3, 4] },
  'audio-waveform': { wave: [0, 1, 2, 3, 4, 5, 6] },
  disc: { disc: [0, 1], shine: [2] },
  vinyl: { record: [0], label: [1, 2], grooves: [3, 4] },
  podcast: { mic: [0, 1], wave: [2, 3] },
  live: { screen: [0], signal: [1, 2, 3] },
  image: { frame: [0], sun: [1], mountain: [2] },
  images: { photo: [0] },
  'image-off': { frame: [0], sun: [1], mountain: [2] },
  clapperboard: { body: [0], clapper: [1, 2, 3, 4] },
  'slow-motion': { ring: [0, 1, 2], play: [3] },
  aperture: { ring: [0], blades: [1, 2, 3, 4, 5] },
  'camera-focus': { corners: [0, 1, 2, 3], lens: [4] },
  'camera-flip': { body: [0, 1], arrow: [2, 3, 4, 5] },
  'picture-in-picture': { screen: [0], window: [1] },
  'video-player': { screen: [0], play: [1], track: [2], progress: [3] },
  'screen-mirror': { screen: [0] },
  'wireless-charging': { pad: [0], bolt: [1], wave: [2, 3] },
  joystick: { base: [0], stick: [1, 2] },
  turntable: { cabinet: [0], platter: [1, 2] },
  tripod: { head: [0], legs: [1, 2, 3] },
  drone: { body: [0], arms: [1, 2, 3, 4], rotors: [5, 6], legs: [7, 8] },
  'image-sparkle': { frame: [0], mountain: [1] },
};
for (const [name, p] of Object.entries(parts)) icons[name].parts = p;

// ── Automatic variants (DESIGN.md › Automatic variants) ──
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// With a badge: the engine doesn't carry it into the filled circle or onto the slash; the front
// piece would get lost or collide with the slash
variants(
  Object.keys(icons).filter((n) => icons[n].badge),
  { circle: false, square: false, slash: false },
);
// They already have a hand-drawn -off version
variants(['camera', 'video-camera', 'wifi', 'wifi-medium', 'wifi-low', 'image'], { slash: false });
variants(['volume-low', 'volume-high', 'volume-off', 'volume-plus', 'volume-minus'], { slash: false });
// Loose lines and arrows: slashing them says nothing
variants(['repeat', 'repeat-one', 'audio-waveform', 'equalizer', 'signal', 'signal-high', 'signal-medium', 'signal-low'], { slash: false });
// Already enclosed in a circle: neither circle nor square (a circle inside a square says nothing more)
variants(['play-circle', 'pause-circle', 'stop-circle', 'record', 'disc', 'vinyl', 'slow-motion', 'aperture'], { circle: false, square: false });
variants(['power', 'podcast'], { circle: false });
// Already in a square
variants(['outlet', 'ethernet', 'camera-focus', 'album'], { square: false });

// ── Motion (DESIGN.md › Motion): parts = pieces that move; origin = pivot; vector = offset ──
icons['smartphone-vibrate'].motion = { effect: 'wiggle', parts: ['body'], origin: [12, 12] };
icons.gamepad.motion = { effect: 'wiggle', origin: [12, 12] };
icons.joystick.motion = { effect: 'wiggle', parts: ['stick'], origin: [12, 15.5] };
icons.clapperboard.motion = { effect: 'wiggle', parts: ['clapper'], origin: [3.25, 9.5] };
icons.disc.motion = { effect: 'spin', parts: ['shine'], origin: [12, 12] };
icons.vinyl.motion = { effect: 'spin', parts: ['grooves'], origin: [12, 12] };
icons.aperture.motion = { effect: 'spin', parts: ['blades'], origin: [12, 12] };
icons['slow-motion'].motion = { effect: 'spin', parts: ['ring'], origin: [12, 12] };
icons['camera-flip'].motion = { effect: 'spin', parts: ['arrow'], origin: [12, 13.5] };
icons.repeat.motion = { effect: 'spin', origin: [12, 12] };
icons['repeat-one'].motion = { effect: 'spin', parts: ['arrow'], origin: [12, 12] };
icons['battery-charging'].motion = { effect: 'beat', parts: ['bolt'], origin: [10.5, 12] };
icons['flashlight-on'].motion = { effect: 'beat', parts: ['rays'], origin: [12, 4] };
icons['smart-speaker'].motion = { effect: 'beat', parts: ['wave'], origin: [12, 12] };
icons['speaker-box'].motion = { effect: 'beat', parts: ['woofer'], origin: [12, 14.75] };
icons.record.motion = { effect: 'beat', parts: ['dot'], origin: [12, 12] };
icons.cast.motion = { effect: 'beat', parts: ['signal'], origin: [2.5, 19.5] };
icons.live.motion = { effect: 'beat', parts: ['signal'], origin: [12, 12] };
icons.podcast.motion = { effect: 'beat', parts: ['wave'], origin: [12, 11] };
icons['wireless-charging'].motion = { effect: 'beat', parts: ['bolt', 'wave'], origin: [12, 8.5] };
icons.equalizer.motion = { effect: 'beat', origin: [12, 20] };
icons['audio-waveform'].motion = { effect: 'beat', origin: [12, 12] };
icons['camera-focus'].motion = { effect: 'beat', parts: ['lens'], origin: [12, 12] };
icons['image-sparkle'].motion = { effect: 'beat', parts: ['badge'], origin: [18.75, 5.5] };
icons['fast-forward'].motion = { effect: 'slide', vector: [2, 0] };
icons.rewind.motion = { effect: 'slide', vector: [-2, 0] };
icons['skip-forward'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['skip-back'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] };
icons.eject.motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons.shuffle.motion = { effect: 'slide', vector: [1.5, 0] };
icons.printer.motion = { effect: 'slide', parts: ['sheet'], vector: [0, 1] };
icons['power-plug'].motion = { effect: 'slide', vector: [0, -1.5] };
icons['video-player'].motion = { effect: 'slide', parts: ['progress'], vector: [3, 0] };
icons['music-note'].motion = { effect: 'float', vector: [0, -1.5] };
icons['music-notes'].motion = { effect: 'float', vector: [0, -1.5] };
icons.drone.motion = { effect: 'float', vector: [0, -1.5] };

export default { category: 'dispositivos', label: 'Dispositivos y multimedia', icons };
