// Foto y video (photo and video): lenses, studio lights and their stand, rigs, film and tape, the
// set (director's chair, screenplay, boom, green screen), capture modes, metering and
// focus, photo adjustments and effects, the editing timeline (one clip bar, one playhead) and
// prints. Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a
// 1.5 stroke, keylines, continuous corners and a square bottom-right corner on containers. The
// camera, video camera, clapperboard, image, aperture and tripod stay in dispositivos (drawn there,
// never redrawn): camera-*, video-camera-* and image-* are those drawings with the engine's badges
// (image-* on the photo that edicion's image-plus already trims for a badge). Two approved icons are
// not drawn: `teleprompter`, since its slanted glass, the three lines on it, the hood and the lens
// behind would not fit legibly together (every arrangement read as a screen with lines), and
// `clapperboard-plus`, since dispositivos' clapperboard with the engine's badge has no clean
// interpolation between weights (the open clapper's hinge, untouched by the badge, changes structure).
import { arc, badge, circ, dot, f, flipPath, halfChord, head, line, polar, roundpoly, sq, turn, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import nucleo from './nucleo.mjs';

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
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** A straight line lengthened by k at both ends (a cut that reaches the outline goes all the way through). */
const longer = (a, b, k = 1) => {
  const u = unit(sub(b, a));
  return line(sub(a, mul(u, k)), add2(b, mul(u, k)));
};

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
 * curve's tangents at its ends).
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

// ── Paths as points ───────────────────────────────────────────────────────────────────────────
// The engine's paths read back as segments, to sample an outline (where a line meets it, what lies
// inside it) and to break a closed outline into dashes.
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
/** Points along a path, about `step` apart. */
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
/** Region: the inside of a closed shape. */
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
/** Where the line from `a` (inside shape `d`) to `b` (outside) crosses its outline. */
function toEdge(a, b, d) {
  const fn = inside(d);
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (fn(lerp(a, b, m))) lo = m;
    else hi = m;
  }
  return lerp(a, b, (lo + hi) / 2);
}
/** Distance from a point to a path. */
const distTo = (p, d) => Math.min(...samplePath(d, 0.05).map((q) => len(sub(p, q))));
/** The runs of the straight line a→b where `keep(p)` holds, as lines (runs shorter than `min` go). */
function keepLine(a, b, keepFn, min = 2) {
  const n = Math.ceil(len(sub(b, a)) / 0.02);
  const runs = [];
  let s = null;
  for (let i = 0; i <= n; i++) {
    const p = lerp(a, b, i / n);
    if (keepFn(p)) s ??= p;
    else if (s) {
      runs.push([s, lerp(a, b, (i - 1) / n)]);
      s = null;
    }
  }
  if (s) runs.push([s, b]);
  return runs.filter(([u, v]) => len(sub(v, u)) >= min).map(([u, v]) => line(u, v));
}
/**
 * A closed outline as dashes about `dash` long with gaps of `gap` between their ends (the 1.5 of
 * clearance); `center` is a point of the outline that falls in the middle of a dash (a corner).
 * Each dash follows the outline as a polyline.
 */
function dashed(d, { dash = 2.5, gap = 3, center, open = false } = {}) {
  const pts = samplePath(d, 0.1);
  const acc = [0];
  for (let k = 1; k < pts.length; k++) acc.push(acc[k - 1] + len(sub(pts[k], pts[k - 1])));
  const L = acc[acc.length - 1];
  const n = open ? Math.max(1, Math.round((L + gap) / (dash + gap))) : Math.max(1, Math.round(L / (dash + gap)));
  const per = open ? (L + gap) / n : L / n;
  let phase = 0;
  if (center && !open) {
    let best = 0;
    pts.forEach((p, k) => {
      if (len(sub(p, center)) < len(sub(pts[best], center))) best = k;
    });
    phase = acc[best] - (per - gap) / 2;
  }
  const atL = (s) => {
    const t = open ? Math.max(0, Math.min(L, s)) : ((s % L) + L) % L;
    let k = 1;
    while (k < acc.length - 1 && acc[k] < t) k++;
    const u = (t - acc[k - 1]) / (acc[k] - acc[k - 1] || 1);
    return lerp(pts[k - 1], pts[k], u);
  };
  const out = [];
  for (let q = 0; q < n; q++) {
    const s0 = phase + q * per;
    const s1 = s0 + per - gap;
    const run = [];
    for (let s = s0; s < s1; s += 0.1) run.push(atL(s));
    run.push(atL(s1));
    const kept = run.filter((p, j) => {
      if (j === 0 || j === run.length - 1) return true;
      const [a, b] = [run[j - 1], run[j + 1]];
      return Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) > 2e-3;
    });
    out.push(line(...kept.filter((p, j) => j === 0 || len(sub(p, kept[j - 1])) > 0.05)));
  }
  return out;
}

// ── The set ───────────────────────────────────────────────────────────────────────────────────
const icons = {};
const FILL = {};
const PARTS = {};
const MOTION = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** The badges' center (DESIGN.md › Badges). */
const BC = [17.25, 17.25];
/** Each badge's gesture, as the rest of the set: signs beat, tools rock, the clock and gear turn. */
const BADGE_MOTION = {
  plus: { effect: 'beat', parts: ['badge'], origin: BC },
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  heart: { effect: 'beat', parts: ['badge'], origin: BC },
  x: { effect: 'wiggle', parts: ['badge'], origin: BC },
  clock: { effect: 'spin', parts: ['badge'], origin: BC },
  gear: { effect: 'spin', parts: ['badge'], origin: BC },
  lock: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  edit: { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'arrow-down': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
  'arrow-up': { effect: 'slide', parts: ['badge'], vector: [0, -1.5] },
};
const D = dispositivos.icons;
/** A drawing from dispositivos with its fill, unchanged. */
const fillOf = (icon) => icon.fill;

// ── Lenses ────────────────────────────────────────────────────────────────────────────────────
// The lens in profile: the barrel (narrower at the back, a step up to the focus ring, its front the
// curved glass), the seam where the glass starts and the mount stub at the back. The glass bulges 2.75
// past its seam, so the crescent between them stays open at bold (at 2 it closed).
function lens({ x0, xs, x1, hb, hf, cy, r, bulge, mount }) {
  const h = 2 * hf;
  const R = (h * h) / 4 / (2 * bulge) + bulge / 2;
  const [top, bot] = [cy - hf, cy + hf];
  const outline = [[x1, bot], [xs, bot], [xs, cy + hb], [x0, cy + hb], [x0, cy - hb], [xs, cy - hb], [xs, top], [x1, top]];
  const body = `${rl(outline, [0, 0.6, 0.5, r, r, 0.5, 0.6, 0])}A${f(R)} ${f(R)} 0 0 1 ${pt([x1, bot])}Z`;
  const stub = rl([[x0, cy - mount.h], [mount.x, cy - mount.h], [mount.x, cy + mount.h], [x0, cy + mount.h]], [0, 0.9, 0.9, 0]);
  return { body, seam: vl(x1, top, bot), stub, seamCut: longer([x1, top], [x1, bot]), top, bot };
}
{
  const L = lens({ x0: 5.25, xs: 9.75, x1: 18.75, hb: 4.5, hf: 6, cy: 12, r: 1.5, bulge: 2.75, mount: { x: 2.25, h: 3 } });
  const ridges = [12.75, 15.75].map((x) => vl(x, 9.5, 14.5));
  add('lens', ['lente', 'objetivo', 'lente intercambiable', 'óptica', 'lens', 'camera lens', 'optics'], [L.body, L.seam, L.stub, ...ridges]);
  FILL.lens = { solid: [0], cut: [L.seamCut, 3, 4], wire: [2] };
  PARTS.lens = { barrel: [0, 1], mount: [2], ring: [3, 4] };
}
// Telephoto: the same lens long and slim, its tripod collar a ring around the middle and the collar's
// foot a low plate wider than the ring (a foot as tall as it was wide read as a pistol grip)
{
  const L = lens({ x0: 4.5, xs: 8.5, x1: 18.5, hb: 2.5, hf: 3.75, cy: 10.75, r: 1, bulge: 2.75, mount: { x: 2, h: 1.75 } });
  const collar = [vl(12, L.top, L.bot), vl(15, L.top, L.bot)];
  const foot = rl([[12, L.bot], [10.25, L.bot + 2.5], [16.75, L.bot + 2.5], [15, L.bot]], [0, 0.75, 0.75, 0]);
  add('lens-telephoto', ['teleobjetivo', 'zoom', 'lente larga', 'telefoto', 'telephoto lens', 'zoom lens', 'long lens'], [L.body, L.seam, L.stub, ...collar, foot]);
  FILL['lens-telephoto'] = { solid: [0, shut(foot)], cut: [L.seamCut], wire: [2] };
  PARTS['lens-telephoto'] = { barrel: [0, 1], mount: [2], collar: [3, 4, 5] };
}
// Lens flare: a starburst (four long rays and four short ones) and two ghosts down the diagonal
{
  const c = [7.25, 7.25];
  const rays = [0, 45, 90, 135].map((a) => {
    const r = a % 90 ? 3 : 5;
    return line(polar(...c, r, a + 180), polar(...c, r, a));
  });
  add('lens-flare', ['destello', 'flare', 'reflejo de lente', 'luz', 'lens flare', 'glare', 'light leak'], [...rays, circ(14.5, 14.5, 2.5), circ(19.5, 19.5, 1.5)]);
  FILL['lens-flare'] = { solid: [4, 5], wire: [0, 1, 2, 3] };
  PARTS['lens-flare'] = { burst: [0, 1, 2, 3], ghosts: [4, 5] };
  MOTION['lens-flare'] = { effect: 'beat', parts: ['burst'], origin: c };
}

// ── Lights on their stand ─────────────────────────────────────────────────────────────────────
// Every light stands on one stand: the pole down the middle and two legs splayed from the same joint
// (the third leg is the pole itself, seen from the front).
const stand = (top) => [vl(12, top, 21), line([12, 16.25], [7.5, 21]), line([12, 16.25], [16.5, 21])];
// Studio light (fresnel), from the side: the lamp housing, its two barn doors open at the front
{
  const housing = sq(6.5, 4, 8.75, 7.5, 2, { square: ['tr', 'br'] });
  add('studio-light', ['luz de estudio', 'foco', 'fresnel', 'iluminación', 'studio light', 'fresnel light', 'set lighting'], [housing, line([15.25, 4], [19.5, 2.25]), line([15.25, 11.5], [19.5, 13.25]), ...stand(11.5)]);
  FILL['studio-light'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['studio-light'] = { head: [0, 1, 2], stand: [3, 4, 5] };
  MOTION['studio-light'] = { effect: 'beat', parts: ['head'], origin: [12, 7.75] };
}
// Softbox, three-quarter: its wide front face square on and the box tapering back from the face's left
// side to its narrow back (from the side, a horn on a stand read as a megaphone or the core speaker;
// from the front, a framed panel on a stand read as datos' presentation board)
{
  const face = sq(9.75, 2.75, 10.75, 11.5, 2.5, { square: ['tl', 'bl'] });
  const body = rl([[9.75, 2.75], [3.75, 6], [3.75, 11], [9.75, 14.25]], [0, 0.75, 0.75, 0]);
  add('softbox', ['caja de luz', 'softbox', 'luz suave', 'difusor', 'softbox light', 'soft light', 'diffuser'], [face, body, ...stand(14.25)]);
  // Filled, the seam where the box meets its face is cut, so the face still reads; it stops 1.5 short
  // of the top and bottom (cut through the shared corner, the face's structure changed at bold)
  FILL.softbox = { solid: [0, shut(body)], cut: [vl(9.75, 4.25, 12.75)], wire: [2, 3, 4] };
  PARTS.softbox = { head: [0, 1], stand: [2, 3, 4] };
}
// Ring light: the ring on the pole, the phone clamped at its center (the pole runs up to it)
{
  const phone = sq(10.5, 6.25, 3, 4.5, 1, BR);
  add('ring-light', ['aro de luz', 'luz led', 'selfie', 'creador', 'ring light', 'selfie light', 'creator light'], [circ(12, 8.5, 5.75), phone, ...stand(10.75)]);
  FILL['ring-light'] = { solid: [1], wire: [0, 2, 3, 4] };
  PARTS['ring-light'] = { ring: [0], phone: [1], stand: [2, 3, 4] };
}
// Photo umbrella, tilted: the canopy (its shallow dome and the scalloped rim between the rib tips)
// opening toward the flash on the stand, the shaft through it to its tip. The canopy takes the whole
// upper left, so the umbrella is the subject and not a spot over the stand
{
  const F = [12, 11.25];
  const u = [-Math.SQRT1_2, -Math.SQRT1_2];
  const v = [Math.SQRT1_2, -Math.SQRT1_2];
  const [depth, half] = [4.75, 7.25];
  const Rc = add2(F, mul(u, 4.25));
  const [e1, e2] = [add2(Rc, mul(v, half)), sub(Rc, mul(v, half))];
  const apex = add2(Rc, mul(u, depth));
  const step = (2 * half) / 3;
  const sR = (step * step) / 4 / 2 + 1.2;
  let edge = '';
  for (let k = 1; k <= 3; k++) edge += `A${f(sR)} ${f(sR)} 0 0 1 ${pt(add2(e2, mul(v, step * k)))}`;
  const canopy = `M${pt(e1)}A${f(depth)} ${f(half)} 45 0 0 ${pt(e2)}${edge}Z`;
  const flash = sq(10.5, 9.75, 3, 3, 0.9);
  const shaft = line(add2(apex, mul(u, 1)), toEdge(F, add2(F, mul(u, 5)), flash));
  add('studio-umbrella', ['paraguas de estudio', 'sombrilla', 'luz rebotada', 'flash', 'photo umbrella', 'bounce umbrella', 'soft flash'], [canopy, shaft, flash, ...stand(12.75)]);
  FILL['studio-umbrella'] = { solid: [0, 2], wire: [1, 3, 4, 5] };
  PARTS['studio-umbrella'] = { umbrella: [0, 1], flash: [2], stand: [3, 4, 5] };
}
// Speedlight, from the front: the wide head with its flash window, the narrower body and the
// hot-shoe foot
{
  const P = [[5, 2.5], [19, 2.5], [19, 11.25], [15.5, 11.25], [15.5, 17.75], [8.5, 17.75], [8.5, 11.25], [5, 11.25]];
  const body = roundpoly(P, [2, 2, 1.75, 0.75, 1.5, 1.5, 0.75, 1.75]);
  const foot = rl([[10, 17.75], [9, 20.75], [15, 20.75], [14, 17.75]], [0, 0.75, 0.75, 0]);
  add('speedlight', ['flash', 'flash externo', 'speedlight', 'zapata', 'speedlight', 'camera flash', 'external flash'], [body, sq(8, 5.5, 8, 2.75, 1), foot]);
  FILL.speedlight = { solid: [0, shut(foot)], cut: [1] };
  PARTS.speedlight = { body: [0, 2], window: [1] };
  MOTION.speedlight = { effect: 'beat', parts: ['window'], origin: [12, 6.88] };
}

// ── Rigs ──────────────────────────────────────────────────────────────────────────────────────
// Gimbal: the grip, the arm up from it to the motor at its elbow and across to the phone, which it
// holds upright (an arm hung over a level phone read as a folder's tab, and a phone level on top of
// an arm round its end as edicion's paint roller); the motor ring is what says stabilizer
{
  const phone = sq(12, 2.75, 8, 12.25, 2.25, BR);
  // The notch 3 clear of the phone's top and sides, as on dispositivos' smartphone
  const notch = hl(5.75, 15, 17);
  const motor = circ(6, 8.75, 1.75);
  const grip = bar([6, 15.75], [6, 19.25], 2);
  add('gimbal', ['estabilizador', 'gimbal', 'video fluido', 'celular', 'gimbal', 'stabilizer', 'smooth video'], [grip, vl(6, 10.5, 13.75), motor, hl(8.75, 7.75, 12), phone, notch]);
  FILL.gimbal = { solid: [0, 2, 4], cut: [5], wire: [1, 3] };
  PARTS.gimbal = { grip: [0], arm: [1, 2, 3], phone: [4, 5] };
  MOTION.gimbal = { effect: 'wiggle', parts: ['arm', 'phone'], origin: [6, 13.75] };
}
// Slider: the rail on its two legs and, riding on it, dispositivos' camera made small (its body with
// the signature corner, the hump and the lens ring, 3 clear of the body all round). The hump stands
// 2.75 tall so its opening stays open at bold
{
  const body = sq(6.25, 6, 11.5, 9, 2.25, BR);
  const hump = rl([[9.25, 6], [10.25, 3.25], [13.75, 3.25], [14.75, 6]], [0, 0.6, 0.6, 0]);
  add('camera-slider', ['slider', 'riel de cámara', 'travelling', 'dolly', 'camera slider', 'rail', 'dolly shot'], [body, hump, circ(12, 10.5, 1.5), vl(12, 15, 17.25), hl(17.25, 2.75, 21.25), line([4.75, 17.25], [3.75, 21]), line([19.25, 17.25], [20.25, 21])]);
  FILL['camera-slider'] = { solid: [0, shut(hump)], cut: [2], wire: [3, 4, 5, 6] };
  PARTS['camera-slider'] = { camera: [0, 1, 2, 3], rail: [4, 5, 6] };
  MOTION['camera-slider'] = { effect: 'slide', parts: ['camera'], vector: [2.5, 0] };
}

// ── Film and tape ─────────────────────────────────────────────────────────────────────────────
// Movie camera: the box, its lens horn (the video camera's) and two reels on top: the front one sits
// on the box, the back one rests against it, clear of the box (three that touch would close a pocket)
{
  const box = sq(2.5, 11.5, 14.5, 8.5, 2, BR);
  const horn = rl([[17, 13.88], [21.5, 12], [21.5, 19.5], [17, 17.63]], [0, 1, 1, 0]);
  const front = [12.75, 8.25];
  const backY = 5.25;
  const back = [front[0] - Math.sqrt(6.5 ** 2 - (front[1] - backY) ** 2), backY];
  add('movie-camera', ['cámara de cine', 'filmadora', 'rodaje', 'cine', 'movie camera', 'film camera', 'cinema'], [box, horn, circ(...back, 3.25), circ(...front, 3.25)]);
  FILL['movie-camera'] = { solid: [0, shut(horn), 2, 3] };
  PARTS['movie-camera'] = { body: [0, 1], reels: [2, 3] };
}
// Film reel: five holes around the hub, the tail of film leaving along the bottom
{
  const holes = [0, 1, 2, 3, 4].map((i) => circ(...polar(12, 11.75, 4.6, -90 + 72 * i), 1.4));
  add('film-reel', ['carrete', 'rollo de película', 'cine', 'archivo', 'film reel', 'movie reel', 'footage'], [circ(12, 11.75, 8.75), ...holes, hl(20.5, 12, 21.5)]);
  FILL['film-reel'] = { solid: [0], cut: [1, 2, 3, 4, 5], wire: [6] };
  PARTS['film-reel'] = { reel: [0, 1, 2, 3, 4, 5], film: [6] };
  MOTION['film-reel'] = { effect: 'spin', parts: ['reel'], origin: [12, 11.75] };
}
// 35 mm film: the canister and its spool knob, the film pulled out to the side with its two rows of
// perforations (the film strip's own language: an inner line along each edge, the holes between)
{
  const can = sq(3.5, 6, 9, 14.5, 2.5);
  const knob = rl([[6.25, 6], [6.25, 3.25], [9.75, 3.25], [9.75, 6]], [0, 0.75, 0.75, 0]);
  const tongue = rl([[12.5, 8.75], [21, 8.75], [21, 17.75], [12.5, 17.75]], [0, 1.5, 1.5, 0]);
  const rows = [hl(11.75, 12.5, 21), hl(14.75, 12.5, 21)];
  const holes = [vl(16.75, 8.75, 11.75), vl(16.75, 14.75, 17.75)];
  add('film-roll', ['rollo de película', 'carrete 35 mm', 'fotografía analógica', 'film', 'film roll', '35mm film', 'analog photography'], [can, knob, tongue, ...rows, ...holes]);
  FILL['film-roll'] = { solid: [0, shut(knob), shut(tongue)], cut: [hl(11.75, 12.5, 22), hl(14.75, 12.5, 22), vl(16.75, 7.75, 11.75), vl(16.75, 14.75, 18.75)] };
  PARTS['film-roll'] = { canister: [0, 1], film: [2, 3, 4, 5, 6] };
}
// Videotape: the flat cartridge, its long window and the two hubs inside
{
  add('videotape', ['videocasete', 'vhs', 'cinta de video', 'archivo', 'videotape', 'vhs tape', 'home video'], [sq(2.5, 5, 19, 14, 3, BR), sq(5.75, 8.25, 12.5, 7.5, 2), dot(9.25, 12), dot(14.75, 12)]);
  FILL.videotape = { solid: [0], cut: [1, 2, 3] };
  PARTS.videotape = { cartridge: [0], window: [1, 2, 3] };
}

// ── On set ────────────────────────────────────────────────────────────────────────────────────
// Director's chair, from the front: the canvas back, the posts with their armrests, the seat and the
// crossed legs
{
  add('director-chair', ['silla de director', 'set', 'rodaje', 'producción', "director's chair", 'film set', 'production'], [
    sq(5.25, 2.75, 13.5, 4.5, 1.25),
    vl(7, 7.25, 13.75),
    vl(17, 7.25, 13.75),
    hl(10.5, 3.75, 7),
    hl(10.5, 17, 20.25),
    hl(13.75, 4.75, 19.25),
    line([7, 13.75], [17, 21]),
    line([17, 13.75], [7, 21]),
  ]);
  FILL['director-chair'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6, 7] };
  PARTS['director-chair'] = { back: [0], frame: [1, 2, 3, 4, 5], legs: [6, 7] };
}
// Screenplay: nucleo's document, two brads on its left margin and the dialogue centered (a name, its
// line, a name, its line)
{
  const DOC = nucleo.icons.document.d[0];
  add('screenplay', ['guion', 'guion de cine', 'libreto', 'escritura', 'screenplay', 'script', 'screenwriting'], [DOC, dot(8.5, 6.5), dot(8.5, 17.5), hl(9.25, 12.25, 15.25), hl(12.25, 10.75, 16.25), hl(15.25, 11.5, 15.5)]);
  FILL.screenplay = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS.screenplay = { page: [0], brads: [1, 2], text: [3, 4, 5] };
}
// Boom microphone: the long pole up to the furry windscreen hanging over the shot
{
  const C = [17.5, 9.75];
  const A = 0.4;
  const fur = curve((t) => [C[0] + (3.25 + A * Math.cos(14 * t)) * Math.cos(t), C[1] + (6.25 + A * Math.cos(14 * t)) * Math.sin(t)], 0, 2 * Math.PI, 28);
  const pole = line([3.25, 20.5], toEdge([17.5, 8.5], [3.25, 20.5], `${fur}Z`));
  add('microphone-boom', ['micrófono boom', 'pértiga', 'sonido directo', 'rodaje', 'boom microphone', 'boom pole', 'on-set sound'], [`${fur}Z`, pole]);
  FILL['microphone-boom'] = { solid: [0], wire: [1] };
  PARTS['microphone-boom'] = { microphone: [0], pole: [1] };
  MOTION['microphone-boom'] = { effect: 'wiggle', origin: [3.25, 20.5] };
}
// Green screen: the stand's two poles and crossbar, the backdrop hanging from it and sweeping forward
// onto the floor (its bottom edge curving toward us)
{
  const frame = rl([[3.5, 21], [3.5, 3.25], [20.5, 3.25], [20.5, 21]], [0, 1, 1, 0]);
  const drape = 'M7.25 3.25V13.25C7.25 15.25 7.1 16.6 6.85 17.75C10.5 20.25 13.5 20.25 17.15 17.75C16.9 16.6 16.75 15.25 16.75 13.25V3.25';
  add('green-screen', ['pantalla verde', 'chroma', 'croma', 'fondo de estudio', 'green screen', 'chroma key', 'backdrop'], [frame, drape]);
  FILL['green-screen'] = { solid: [shut(drape)], wire: [0] };
  PARTS['green-screen'] = { stand: [0], backdrop: [1] };
}
// Film projector: the body and lens, two reels on their arms above it and the beam fanning out
{
  const body = sq(2.5, 12.5, 12.5, 7.5, 2, BR);
  const lensStub = rl([[15, 14.5], [17.5, 14.5], [17.5, 18], [15, 18]], [0, 0.75, 0.75, 0]);
  const arms = line([5, 9.5], [9, 12.5], [13.5, 8.75]);
  add('film-projector', ['proyector de cine', 'proyección', 'función', 'cine', 'film projector', 'movie projector', 'screening'], [body, lensStub, circ(5, 6.75, 2.75), circ(13.5, 6, 2.75), arms, line([17.5, 14.5], [21.5, 12]), line([17.5, 18], [21.5, 20.5])]);
  FILL['film-projector'] = { solid: [0, shut(lensStub), 2, 3], wire: [4, 5, 6] };
  PARTS['film-projector'] = { body: [0, 1], reels: [2, 3, 4], beam: [5, 6] };
}

// ── Capture modes ─────────────────────────────────────────────────────────────────────────────
const FRAME = sq(2.5, 5, 19, 14, 3.5, BR);
const IMAGE_FRAME = D.image.d[0];
const BRACKETS = D['camera-focus'].d.slice(0, 4);
// Time-lapse: a dial of twelve ticks, fast-forward in its middle
{
  const ticks = Array.from({ length: 12 }, (_, i) => line(polar(12, 12, 7, i * 30 - 90), polar(12, 12, 9.25, i * 30 - 90)));
  const ff = [line([8.7, 9.5], [11.2, 12], [8.7, 14.5]), line([12.8, 9.5], [15.3, 12], [12.8, 14.5])];
  add('time-lapse', ['time-lapse', 'cámara rápida', 'intervalos', 'modo de captura', 'time-lapse', 'timelapse', 'capture mode'], [...ticks, ...ff]);
  FILL['time-lapse'] = false;
  PARTS['time-lapse'] = { dial: ticks.map((_, i) => i), arrows: [12, 13] };
  MOTION['time-lapse'] = { effect: 'spin', parts: ['dial'], origin: [12, 12] };
}
// Burst: the front frame and the edges of two more stepping off behind it
{
  add('burst-mode', ['ráfaga', 'disparo continuo', 'fotos en serie', 'modo ráfaga', 'burst mode', 'continuous shooting', 'burst'], [sq(2.5, 5, 12, 14, 3, BR), vl(17.5, 7, 17), vl(20.5, 9, 15)]);
  FILL['burst-mode'] = { solid: [0], wire: [1, 2] };
  PARTS['burst-mode'] = { frame: [0], sequence: [1, 2] };
}
// Macro: the tulip, its cup of three petals on a stem with one leaf
{
  const bloom = 'M7.25 4C6.75 9 9 12.5 12 12.5C15 12.5 17.25 9 16.75 4L14.4 6.5L12 3.25L9.6 6.5Z';
  const leaf = 'M12 19.5C9.5 19.5 7.25 17.5 6.75 14.25C9.75 14.5 11.75 16.5 12 19.5Z';
  add('macro-mode', ['macro', 'primer plano', 'enfoque cercano', 'tulipán', 'macro mode', 'close-up', 'macro focus'], [bloom, vl(12, 12.5, 21), leaf]);
  FILL['macro-mode'] = { solid: [0, 2], wire: [1] };
  PARTS['macro-mode'] = { bloom: [0], stem: [1, 2] };
}
// Rule of thirds: the viewfinder's corners and the grid that splits it in three each way
{
  const t = [3.25 + 17.5 / 3, 3.25 + (2 * 17.5) / 3];
  const grid = [...t.map((x) => vl(x, 6.25, 17.75)), ...t.map((y) => hl(y, 6.25, 17.75))];
  add('rule-of-thirds', ['regla de tercios', 'cuadrícula', 'composición', 'encuadre', 'rule of thirds', 'grid overlay', 'composition'], [...BRACKETS, ...grid]);
  FILL['rule-of-thirds'] = false;
  PARTS['rule-of-thirds'] = { corners: [0, 1, 2, 3], grid: [4, 5, 6, 7] };
}
// Metering: the frame with a grid of points (matrix) or a single spot at its center
{
  const pts = [];
  for (const y of [8.5, 12, 15.5]) for (const x of [7.5, 12, 16.5]) pts.push(dot(x, y, 0.3));
  add('metering-matrix', ['medición matricial', 'medición evaluativa', 'exposímetro', 'modo de medición', 'matrix metering', 'evaluative metering', 'metering mode'], [FRAME, ...pts]);
  FILL['metering-matrix'] = { solid: [0], cut: pts.map((_, i) => i + 1) };
  PARTS['metering-matrix'] = { frame: [0], points: pts.map((_, i) => i + 1) };
  add('metering-spot', ['medición puntual', 'spot', 'exposímetro', 'modo de medición', 'spot metering', 'metering mode', 'spot meter'], [FRAME, circ(12, 12, 2.25)]);
  FILL['metering-spot'] = { solid: [0], cut: [1] };
  PARTS['metering-spot'] = { frame: [0], spot: [1] };
}
// Focus point: the tap-to-focus square, a tick in from the middle of each side
{
  const ticks = [vl(12, 3.25, 6.25), vl(12, 17.75, 20.75), hl(12, 3.25, 6.25), hl(12, 17.75, 20.75)];
  add('focus-point', ['punto de enfoque', 'tocar para enfocar', 'autoenfoque', 'enfoque', 'focus point', 'tap to focus', 'autofocus'], [sq(3.25, 3.25, 17.5, 17.5, 3.5), ...ticks]);
  FILL['focus-point'] = false;
  PARTS['focus-point'] = { square: [0], ticks: [1, 2, 3, 4] };
  MOTION['focus-point'] = { effect: 'beat', origin: [12, 12] };
}
// Panorama: a very wide frame bowing out at the top and bottom, a mountain range across it
{
  const N = 14;
  const bow = (y0, s) => Array.from({ length: N - 1 }, (_, i) => {
    const x = 2.5 + (19 * (i + 1)) / N;
    const u = (x - 12) / 9.5;
    return [x, y0 - s * (1 - u * u)];
  });
  const P = [[2.5, 7.5], ...bow(7.5, 1.75), [21.5, 7.5], [21.5, 16.5], ...bow(16.5, -1.75).reverse(), [2.5, 16.5]];
  const frame = roundpoly(P, P.map((_, i) => (i === 0 || i === N || i === N + 1 || i === 2 * N + 1 ? 1.75 : 0)));
  const ridge = rl([[2.5, 14.25], [7.5, 10.75], [11, 13.25], [15.5, 9.75], [21.5, 14.25]], [0, 1, 1, 1, 0]);
  add('panorama', ['panorámica', 'foto panorámica', 'paisaje', 'gran angular', 'panorama', 'panoramic photo', 'wide shot'], [frame, ridge]);
  FILL.panorama = { solid: [0], cut: [rl([[1.5, 14.95], [7.5, 10.75], [11, 13.25], [15.5, 9.75], [22.5, 15]], [0, 1, 1, 1, 0])] };
  PARTS.panorama = { frame: [0], mountain: [1] };
}
// Stabilization: the frame holding a smaller frame knocked a few degrees off, shake marks either side
{
  const inner = turnPath(sq(9, 9, 6, 6, 1.5), -8);
  add('stabilization', ['estabilización', 'antivibración', 'imagen estable', 'video estable', 'stabilization', 'image stabilization', 'steady shot'], [FRAME, inner, vl(5.5, 10, 14), vl(18.5, 10, 14)]);
  FILL.stabilization = { solid: [0], cut: [1, 2, 3] };
  PARTS.stabilization = { frame: [0], image: [1], shake: [2, 3] };
  MOTION.stabilization = { effect: 'wiggle', parts: ['image'], origin: [12, 12] };
}
// Auto-framing: head and shoulders inside the viewfinder's corners
{
  const shoulders = place(nucleo.icons.person.d[1], 0.6, [12, 20.6], [12, 17.75]);
  add('auto-framing', ['encuadre automático', 'centrar encuadre', 'seguimiento', 'videollamada', 'auto framing', 'center stage', 'subject tracking'], [...BRACKETS, circ(12, 8.15, 2.4), shoulders]);
  FILL['auto-framing'] = { solid: [4, 5], wire: [0, 1, 2, 3] };
  PARTS['auto-framing'] = { corners: [0, 1, 2, 3], person: [4, 5] };
}
// Field of view: a small camera, the two edges of its view and the arc that joins them
{
  const o = [8, 12];
  const [a, b] = [polar(...o, 13, -32), polar(...o, 13, 32)];
  add('field-of-view', ['campo de visión', 'ángulo de visión', 'distancia focal', 'gran angular', 'field of view', 'angle of view', 'focal length'], [sq(2.5, 9.5, 5.5, 5, 1.25, BR), line(o, a), line(o, b), arc(...o, 13, -32, 32).d]);
  FILL['field-of-view'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['field-of-view'] = { camera: [0], view: [1, 2, 3] };
}
// Screen recording: the screen as a dashed frame and the record button at its center
{
  const dashes = dashed(sq(2.5, 5, 19, 14, 3.5), { center: [3.53, 6.03] });
  add('screen-recording', ['grabar pantalla', 'grabación de pantalla', 'captura de video', 'screencast', 'screen recording', 'record screen', 'screen capture'], [circ(12, 12, 3.75), dot(12, 12), ...dashes]);
  FILL['screen-recording'] = { solid: [0], cut: [1], wire: dashes.map((_, i) => i + 2) };
  PARTS['screen-recording'] = { record: [0, 1], screen: dashes.map((_, i) => i + 2) };
  MOTION['screen-recording'] = { effect: 'beat', parts: ['record'], origin: [12, 12] };
}
// Horizon level: the level line broken in the middle, where the camera's own line sits tilted
{
  const tilt = line(...turn([[9.5, 12], [14.5, 12]], -10));
  add('horizon-level', ['nivel', 'horizonte', 'nivelar cámara', 'inclinación', 'horizon level', 'camera level', 'tilt'], [hl(12, 2.75, 6.5), tilt, hl(12, 17.5, 21.25)]);
  FILL['horizon-level'] = false;
  PARTS['horizon-level'] = { level: [0, 2], camera: [1] };
  MOTION['horizon-level'] = { effect: 'wiggle', parts: ['camera'], origin: [12, 12] };
}
// Pan: the video camera with an arrow sweeping both ways over it
{
  const cam = D['video-camera'].d.map((d) => place(d, 0.85, [12, 18], [12, 20.75]));
  const [cx, half, y] = [11, 6, 5.75];
  const R = 16;
  const c = [cx, y + Math.sqrt(R * R - half * half)];
  const a = (Math.asin(half / R) * 180) / Math.PI;
  const sweep = arc(...c, R, -90 - a, -90 + a);
  const back = arc(...c, R, -90 + a, -90 - a);
  add('camera-pan', ['paneo', 'panorámica de cámara', 'girar cámara', 'ptz', 'camera pan', 'pan shot', 'ptz control'], [...cam, sweep.d, head(sweep.end, sweep.tangent, 3.4), head(back.end, back.tangent, 3.4)]);
  FILL['camera-pan'] = { solid: [cam[0], shut(cam[1])], wire: [2, 3, 4] };
  PARTS['camera-pan'] = { camera: [0, 1], arrow: [2, 3, 4] };
  MOTION['camera-pan'] = { effect: 'wiggle', parts: ['arrow'], origin: c };
}
// The camera and the video camera with the engine's badges
for (const [name, base, kind, tags] of [
  ['camera-plus', 'camera', 'plus', ['tomar foto', 'nueva foto', 'agregar foto', 'cámara', 'take photo', 'add photo', 'new photo']],
  ['camera-clock', 'camera', 'clock', ['temporizador', 'disparo retardado', 'autodisparador', 'cámara', 'self-timer', 'timer', 'delayed shot']],
  ['camera-gear', 'camera', 'gear', ['ajustes de cámara', 'configuración', 'opciones de cámara', 'cámara', 'camera settings', 'camera options', 'preferences']],
  ['video-camera-plus', 'video-camera', 'plus', ['grabar video', 'nuevo video', 'agregar video', 'cámara de video', 'record video', 'new video', 'add video']],
]) {
  add(name, tags, D[base].d, { badge: badge(kind), fill: fillOf(D[base]) });
  PARTS[name] = { ...D[base].parts };
  MOTION[name] = BADGE_MOTION[kind];
}

// ── Adjustments ───────────────────────────────────────────────────────────────────────────────
// Exposure: the square split corner to corner, plus in the light half and minus in the dark one
{
  const S = sq(3.25, 3.25, 17.5, 17.5, 4);
  const a = toEdge([12, 12], [1, 23], S);
  const b = toEdge([12, 12], [23, 1], S);
  const marks = [vl(8.5, 6.5, 10.5), hl(8.5, 6.5, 10.5), hl(15.5, 13.5, 17.5)];
  add('exposure', ['exposición', 'compensación de exposición', 'brillo', 'ajuste', 'exposure', 'exposure compensation', 'brightness'], [S, line(a, b), ...marks]);
  FILL.exposure = { solid: [0], cut: [longer(a, b), 2, 3, 4] };
  PARTS.exposure = { square: [0, 1], marks: [2, 3, 4] };
}
// Highlights and shadows: the circle with its upper (or lower) half hatched
for (const [name, dir, tags] of [
  ['highlights', -1, ['altas luces', 'luces', 'zonas claras', 'ajuste de foto', 'highlights', 'bright tones', 'photo adjustment']],
  ['shadows', 1, ['sombras', 'zonas oscuras', 'tonos oscuros', 'ajuste de foto', 'shadows', 'dark tones', 'photo adjustment']],
]) {
  const chords = [0, 3, 6].map((k) => {
    const y = 12 + dir * k;
    const w = Math.sqrt(81 - (y - 12) ** 2);
    return [[12 - w, y], [12 + w, y]];
  });
  add(name, tags, [circ(12, 12, 9), ...chords.map((c) => line(...c))]);
  FILL[name] = { solid: [0], cut: chords.map((c) => longer(...c)) };
  PARTS[name] = { circle: [0], tones: [1, 2, 3] };
}
// Tone curve: the graph and the S curve across it from its dark corner to its light one, a dot on
// each bend
{
  const S = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
  const a = toEdge([12, 12], [1, 23], S);
  const b = toEdge([12, 12], [23, 1], S);
  const n = unit([1, 1]);
  const P = (t) => add2(lerp(a, b, t), mul(n, 2 * Math.sin(2 * Math.PI * t)));
  add('tone-curve', ['curvas', 'curva de tonos', 'contraste', 'ajuste de foto', 'tone curve', 'curves', 'contrast'], [S, curve(P, 0, 1, 8), dot(...P(0.25)), dot(...P(0.75))]);
  FILL['tone-curve'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['tone-curve'] = { graph: [0], curve: [1, 2, 3] };
}
// Histogram and levels: the hill over its baseline, the black, gray and white points under it
{
  const hill = 'M4.25 14.25C6 10.75 7.75 4.5 10.75 4.5C13.75 4.5 15.75 10.75 19.75 14.25';
  const tri = (x) => roundpoly([[x - 2.13, 21.25], [x, 17.25], [x + 2.13, 21.25]], 0.5);
  add('histogram-levels', ['histograma', 'niveles', 'tonos', 'exposición', 'histogram', 'levels', 'tonal range'], [hill, hl(14.25, 2.75, 21.25), tri(4.88), tri(12), tri(19.13)]);
  FILL['histogram-levels'] = { solid: [shut(hill), 2, 3, 4], wire: [1] };
  PARTS['histogram-levels'] = { histogram: [0, 1], points: [2, 3, 4] };
}

// ── Effects ───────────────────────────────────────────────────────────────────────────────────
// Vignette: the frame with a quarter arc closing off each corner
{
  const V = sq(2.5, 5, 19, 14, 3, BR);
  const C = [[2.5, 5, 0], [21.5, 5, 90], [21.5, 19, 180], [2.5, 19, 270]];
  const arcs = C.map(([x, y, a]) => arc(x, y, 5, a, a + 90).d);
  add('vignette', ['viñeta', 'bordes oscuros', 'efecto', 'filtro', 'vignette', 'dark corners', 'photo effect'], [V, ...arcs]);
  FILL.vignette = { solid: [0], cut: C.map(([x, y, a]) => arc(x, y, 5, a - 14, a + 104).d) };
  PARTS.vignette = { frame: [0], corners: [1, 2, 3, 4] };
}
// Motion blur: a ball with three speed lines trailing behind it
{
  add('motion-blur', ['desenfoque de movimiento', 'barrido', 'velocidad', 'efecto', 'motion blur', 'speed', 'blur effect'], [circ(15.5, 12, 5), hl(8.5, 4.75, 8.25), hl(12, 2.75, 7.5), hl(15.5, 4.75, 8.25)]);
  FILL['motion-blur'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['motion-blur'] = { ball: [0], trail: [1, 2, 3] };
  MOTION['motion-blur'] = { effect: 'slide', vector: [1.5, 0] };
}
// Bokeh: the out-of-focus highlights, one large hexagon (the aperture's shape) in front and two smaller
// discs behind it, cleared by the engine where they pass behind (crossing outlines read as a molecule,
// and their fill merged into one blob)
{
  const hex = roundpoly([0, 1, 2, 3, 4, 5].map((i) => polar(9.5, 13.5, 6.5, 60 * i - 90)), 1.5);
  const discs = [circ(16, 7, 4), circ(17, 17.75, 3)];
  add('bokeh', ['bokeh', 'desenfoque', 'fondo borroso', 'retrato', 'bokeh', 'background blur', 'portrait mode'], discs, { badge: { d: [hex], knock: hex, fill: { solid: [hex] } } });
  FILL.bokeh = { solid: [0, 1] };
  PARTS.bokeh = { lights: [0, 1] };
}

// ── Edits ─────────────────────────────────────────────────────────────────────────────────────
// Straighten: the frame with its horizon tilted off the level, the angle between them marked (an arc
// at the tilted line's end, with no level to measure from, read as a seesaw)
{
  const [o, deg, L] = [[5.5, 15.25], -24, 13.75];
  const end = polar(...o, L, deg);
  add('straighten', ['enderezar', 'nivelar', 'ángulo', 'horizonte', 'straighten', 'level horizon', 'rotate'], [FRAME, hl(o[1], o[0], 18.5), line(o, end), arc(...o, 7, deg, 0).d]);
  FILL.straighten = { solid: [0], cut: [1, 2, 3] };
  PARTS.straighten = { frame: [0], level: [1], horizon: [2], angle: [3] };
}
// Crop and rotate: edicion's crop marks, smaller, with an arc arrow turning round their top right
// corner
{
  const crop = edicion.icons.crop.d.map((d) => place(d, 0.8, [2.75, 21.25]));
  const c = [2.75 + 14.75 * 0.8, 21.25 - 14.75 * 0.8];
  const a = arc(...c, 4.25, -110, 5);
  add('crop-rotate', ['recortar y rotar', 'girar', 'encuadre', 'editar foto', 'crop and rotate', 'rotate', 'reframe photo'], [...crop, a.d, head(a.end, a.tangent, 3.4)]);
  FILL['crop-rotate'] = false;
  PARTS['crop-rotate'] = { crop: [0, 1], arrow: [2, 3] };
  MOTION['crop-rotate'] = { effect: 'spin', parts: ['arrow'], origin: c };
}
// Before and after: the frame split by the divider and its round handle, the before half hatched
{
  const fIn = inside(FRAME);
  const keepFn = (p) => fIn(p) && p[0] < 12 && len(sub(p, [12, 12])) > 5.5;
  const hatch = [11.5, 15.74, 19.98, 24.22].flatMap((c) => keepLine([c - 3, 3], [c - 21, 21], keepFn, 2.5));
  add('before-after', ['antes y después', 'comparar', 'edición', 'diferencia', 'before and after', 'compare', 'split view'], [FRAME, vl(12, 5, 9.5), vl(12, 14.5, 19), circ(12, 12, 2.5), ...hatch]);
  // Filled, the hatch is cut through the frame's edge (a cut that ended on it would come and go with
  // the weight) and into the divider's own cut
  const out = inside(sq(1.25, 3.75, 21.5, 16.5, 4.75));
  const hatchCut = [11.5, 15.74, 19.98, 24.22].flatMap((c) => keepLine([c - 3, 3], [c - 21, 21], (p) => out(p) && p[0] <= 12 && len(sub(p, [12, 12])) > 5.5, 2.5));
  FILL['before-after'] = { solid: [0], cut: [vl(12, 4, 9.5), vl(12, 14.5, 20), 3, ...hatchCut] };
  PARTS['before-after'] = { frame: [0], divider: [1, 2, 3], before: hatch.map((_, i) => i + 4) };
}
// Background replace: a person in front of the photo behind them (the engine clears the photo around
// the figure)
{
  const ridge = rl([toEdge([6.5, 10], [1, 16], IMAGE_FRAME), [6.5, 10], [12, 12.5], [17, 8.5], toEdge([17, 8.5], [24, 14.1], IMAGE_FRAME)], [0, 1, 1, 1, 0]);
  const headC = circ(12, 11.5, 2.75);
  const shoulders = 'M8.35 21.25H15.65A1.2 1.2 0 0 0 16.82 19.8C16.25 18.25 14.35 17.25 12 17.25S7.75 18.25 7.18 19.8A1.2 1.2 0 0 0 8.35 21.25Z';
  add('background-replace', ['cambiar fondo', 'reemplazar fondo', 'fondo virtual', 'videollamada', 'background replace', 'virtual background', 'change background'], [IMAGE_FRAME, ridge], {
    badge: { d: [headC, shoulders], knock: `${headC}${shoulders}`, fill: { solid: [headC, shoulders] } },
  });
  FILL['background-replace'] = { solid: [0], cut: [rl([toEdge([6.5, 10], [1, 16], IMAGE_FRAME), [6.5, 10], [12, 12.5], [17, 8.5], toEdge([17, 8.5], [24, 14.1], IMAGE_FRAME)], [0, 1, 1, 1, 0])] };
  PARTS['background-replace'] = { photo: [0, 1] };
}
// Radial filter: the mask's ellipse, its feather as a dashed ellipse around it and the pin at its
// center, all tilted the way the mask is dragged
{
  const tilt = (d) => turnPath(d, -30);
  const outer = dashed(tilt(ell([12, 12], 9.25, 6.5)), { center: polar(12, 12, 9.25, -30) });
  add('radial-filter', ['filtro radial', 'máscara radial', 'ajuste local', 'edición', 'radial filter', 'radial mask', 'local adjustment'], [tilt(ell([12, 12], 5, 3.75)), dot(12, 12), ...outer]);
  FILL['radial-filter'] = { solid: [0], cut: [1], wire: outer.map((_, i) => i + 2) };
  PARTS['radial-filter'] = { mask: [0, 1], feather: outer.map((_, i) => i + 2) };
}
// Photo filters: three discs overlapping in a triangle
{
  const [c, d, r] = [[12, 12.75], 4.33, 5.75];
  const discs = [-90, 30, 150].map((a) => circ(...polar(...c, d, a), r));
  add('photo-filter', ['filtros', 'filtro de foto', 'estilos', 'preajustes', 'photo filters', 'presets', 'looks'], discs);
  // Filled, each disc's arc inside the other two is cut (as datos' venn), so the three still read and
  // don't merge into one blob: the arc toward the middle, out to where it meets each neighbor's edge
  const half = 30 + (Math.acos((d * Math.sqrt(3)) / (2 * r)) * 180) / Math.PI;
  FILL['photo-filter'] = { solid: [0, 1, 2], cut: [-90, 30, 150].map((a) => arc(...polar(...c, d, a), r, a + 180 - half, a + 180 + half).d) };
  PARTS['photo-filter'] = { filters: [0, 1, 2] };
}
// Color grading: the color wheel, its neutral cross at the center and the puck pulled toward an edge
{
  const puck = polar(12, 12, 5.25, -45);
  add('color-grading', ['corrección de color', 'etalonaje', 'rueda de color', 'tono', 'color grading', 'color wheels', 'color correction'], [circ(12, 12, 9), hl(12, 10.5, 13.5), vl(12, 10.5, 13.5), dot(...puck)]);
  FILL['color-grading'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['color-grading'] = { wheel: [0, 1, 2], puck: [3] };
  MOTION['color-grading'] = { effect: 'spin', parts: ['puck'], origin: [12, 12] };
}
// Pan and zoom: the frame, the small frame the move starts from in its corner (solid: dashed, a frame
// this small broke into specks) and the arrow toward the far corner
{
  const small = [sq(5.5, 7.5, 6.5, 4.5, 1.25)];
  const u = unit([13, 9]);
  const tail = add2([12, 12], mul(u, 3));
  const tip = add2(tail, mul(u, 3));
  add('pan-and-zoom', ['paneo y zoom', 'efecto ken burns', 'movimiento de foto', 'video', 'pan and zoom', 'ken burns', 'photo motion'], [FRAME, ...small, line(tail, tip), head(tip, u, 3.4)]);
  FILL['pan-and-zoom'] = { solid: [0], cut: [...small.map((_, i) => i + 1), small.length + 1, small.length + 2] };
  PARTS['pan-and-zoom'] = { frame: [0], view: small.map((_, i) => i + 1), arrow: [small.length + 1, small.length + 2] };
}
// Reframe: the tall crop in front of the landscape frame (the engine clears the frame around it, so it
// stands as two brackets either side), the subject at the crop's center. Two crop lines drawn inside
// the frame read as a cabinet with its knob
{
  const tall = sq(8.25, 2.75, 7.5, 18.5, 2.25, BR);
  const subject = dot(12, 12);
  add('reframe', ['reencuadrar', 'vertical', 'relación de aspecto', 'redes sociales', 'reframe', 'auto reframe', 'aspect ratio'], [FRAME], { badge: { d: [tall, subject], knock: tall, fill: { solid: [tall], cut: [subject] } } });
  FILL.reframe = { solid: [0] };
  PARTS.reframe = { frame: [0] };
}

// ── The timeline ──────────────────────────────────────────────────────────────────────────────
// One clip bar (a rounded bar 3.5 tall) and one playhead (a pentagon head on its line) for the whole
// family.
const clip = (x0, x1, cy) => sq(x0, cy - 1.75, x1 - x0, 3.5, 1.25);
/** Playhead head: the pentagon pointing down, `w` wide and `h` tall, its tip at (x, top + h). */
const playHead = (x, top, w, h) => roundpoly([[x - w / 2, top], [x + w / 2, top], [x + w / 2, top + h * 0.55], [x, top + h], [x - w / 2, top + h * 0.55]], [0.5, 0.5, 0.5, 0.35, 0.5]);
/** The tip of that head, where its line starts (the rounded point, measured). */
const tipOf = (x, top, w, h) => toEdge([x, top + h / 2], [x, top + h + 2], playHead(x, top, w, h));
// Timeline: three tracks of clips and the playhead over them, its line across the lower two. The first
// track ends before the playhead, so the head stands clear beside it (resting on the track, it merged
// into it at bold, and the three tracks hung off its line like the boards of lugares' signpost)
{
  const x = 16.5;
  const t = tipOf(x, 2.25, 4, 3.25);
  const [y1, y2, y3] = [t[1] + 1.75, t[1] + 8.25, t[1] + 14.75];
  const tracks = [clip(2.75, 10.5, y1), clip(9.5, 21.25, y2), clip(4.5, 19.25, y3)];
  add('video-timeline', ['línea de tiempo', 'edición de video', 'pistas', 'montaje', 'video timeline', 'editing', 'tracks'], [...tracks, playHead(x, 2.25, 4, 3.25), vl(x, t[1], y3 + 1.75)]);
  FILL['video-timeline'] = { solid: [0, 1, 2, 3], wire: [4] };
  PARTS['video-timeline'] = { tracks: [0, 1, 2], playhead: [3, 4] };
  MOTION['video-timeline'] = { effect: 'slide', parts: ['playhead'], vector: [2, 0] };
}
// Playhead: the head and its line over the ruler's ticks
{
  const t = tipOf(12, 3, 6, 5.25);
  const ticks = [[4, 16.5], [8, 18.5], [16, 18.5], [20, 16.5]].map(([x, y]) => vl(x, y, 21));
  add('playhead', ['cabezal', 'tiempo actual', 'reproducción', 'línea de tiempo', 'playhead', 'current time', 'scrubber'], [playHead(12, 3, 6, 5.25), vl(12, t[1], 21), ...ticks]);
  FILL.playhead = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.playhead = { playhead: [0, 1], ruler: [2, 3, 4, 5] };
  MOTION.playhead = { effect: 'slide', parts: ['playhead'], vector: [2.5, 0] };
}
// Split: the clip cut in two, its halves apart, the cut line through the gap
{
  add('clip-split', ['dividir clip', 'cortar', 'partir', 'edición de video', 'split clip', 'cut', 'razor'], [clip(2.5, 9, 12), clip(15, 21.5, 12), vl(12, 7.5, 16.5)]);
  FILL['clip-split'] = { solid: [0, 1], wire: [2] };
  PARTS['clip-split'] = { clip: [0, 1], cut: [2] };
}
// Trim: the clip, the trim bracket on its end and the arrow pushing it in
{
  const tip = [18, 12];
  add('clip-trim', ['recortar clip', 'ajustar duración', 'trim', 'edición de video', 'trim clip', 'shorten', 'edit point'], [clip(2.5, 12, 12), rl([[12.5, 7.25], [15, 7.25], [15, 16.75], [12.5, 16.75]], [0, 1, 1, 0]), hl(12, tip[0], 21.25), head(tip, [-1, 0], 3.4)]);
  FILL['clip-trim'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['clip-trim'] = { clip: [0], handle: [1], arrow: [2, 3] };
  MOTION['clip-trim'] = { effect: 'slide', parts: ['handle', 'arrow'], vector: [-1.5, 0] };
}
// Transition: two clips end to end and the bowtie over their joint (the engine clears the clips
// around it)
{
  const tie = roundpoly([[9, 7.5], [12, 12], [15, 7.5], [15, 16.5], [12, 12], [9, 16.5]], [0.6, 0, 0.6, 0.6, 0, 0.6]);
  add('clip-transition', ['transición', 'fundido', 'disolvencia', 'edición de video', 'transition', 'crossfade', 'dissolve'], [clip(2.5, 11, 12), clip(13, 21.5, 12)], { badge: { d: [tie], knock: tie, fill: { solid: [tie] } } });
  FILL['clip-transition'] = { solid: [0, 1] };
  PARTS['clip-transition'] = { clips: [0, 1] };
}
// Detach audio: the clip above, its waveform below and the arrow pulling them apart
{
  const wave = [[4, 3], [7, 6], [10, 8], [13, 5]].map(([x, h]) => vl(x, 16.25 - h / 2, 16.25 + h / 2));
  const tip = [19, 18.75];
  add('audio-detach', ['separar audio', 'extraer audio', 'desvincular', 'edición de video', 'detach audio', 'extract audio', 'split audio'], [clip(2.5, 21.5, 5.25), ...wave, vl(19, 10, tip[1]), head(tip, [0, 1], 3.4)]);
  FILL['audio-detach'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
  PARTS['audio-detach'] = { clip: [0], wave: [1, 2, 3, 4], arrow: [5, 6] };
  MOTION['audio-detach'] = { effect: 'bounce', parts: ['arrow'], vector: [0, 1.5] };
}
// In and out points: the tall bracket with the small triangle pointing into it, drawn once and
// mirrored
{
  const bracket = rl([[10, 3.25], [6.75, 3.25], [6.75, 20.75], [10, 20.75]], [0, 1.5, 1.5, 0]);
  const tri = roundpoly([[17.5, 7.5], [10, 12], [17.5, 16.5]], 1.25);
  add('mark-in', ['punto de entrada', 'marcar inicio', 'in', 'edición de video', 'mark in', 'in point', 'set start'], [bracket, tri]);
  add('mark-out', ['punto de salida', 'marcar final', 'out', 'edición de video', 'mark out', 'out point', 'set end'], [flipPath(bracket), flipPath(tri)]);
  for (const n of ['mark-in', 'mark-out']) {
    FILL[n] = { solid: [1], wire: [0] };
    PARTS[n] = { bracket: [0], marker: [1] };
  }
}
// Marker: the tag pointing down at the ruler (the playhead's ruler, its middle tick under the tag)
{
  const tag = roundpoly([[7.25, 3], [16.75, 3], [16.75, 9.5], [12, 13.75], [7.25, 9.5]], [1.5, 1.5, 1, 0.6, 1]);
  const ticks = [[4, 16.5], [8, 18.5], [12, 16.75], [16, 18.5], [20, 16.5]].map(([x, y]) => vl(x, y, 21));
  add('timeline-marker', ['marcador', 'capítulo', 'línea de tiempo', 'marca', 'timeline marker', 'chapter', 'marker'], [tag, ...ticks]);
  FILL['timeline-marker'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['timeline-marker'] = { marker: [0], ruler: [1, 2, 3, 4, 5] };
  MOTION['timeline-marker'] = { effect: 'bounce', parts: ['marker'], vector: [0, -1.5] };
}

// Blade: the double-edged razor at an angle, notched at both ends, its slot down the middle
{
  const [x0, x1, y0, y1, r, n] = [3.5, 20.5, 7.75, 16.25, 0.6, 1.5];
  const notch = (x, s) => `L${pt([x, 12 - n])}A${f(n)} ${f(n)} 0 0 ${s} ${pt([x, 12 + n])}`;
  const outline = `M${pt([x0 + r, y0])}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x1, y0 + r])}${notch(x1, 0)}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x1 - r, y1])}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x0, y1 - r])}L${pt([x0, 12 + n])}A${f(n)} ${f(n)} 0 0 0 ${pt([x0, 12 - n])}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 1 ${pt([x0 + r, y0])}Z`;
  const blade = turnPath(outline, -30);
  // The slot is the razor's own: a bar with a round hole at each end
  const slot = [turnPath(hl(12, 9, 15), -30), ...turn([[9, 12], [15, 12]], -30).map((p) => dot(...p))];
  add('blade-tool', ['cuchilla', 'herramienta de corte', 'cortar clips', 'edición de video', 'blade tool', 'razor tool', 'cut clips'], [blade, ...slot]);
  FILL['blade-tool'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['blade-tool'] = { blade: [0], slot: [1, 2, 3] };
}
// Keyframes: the rhombus on its track (linear) and the hourglass (eased), the track touching each
{
  const rh = roundpoly([[12, 6], [18, 12], [12, 18], [6, 12]], 1.25);
  const [l, r] = [toEdge([12, 12], [0, 12], rh), toEdge([12, 12], [24, 12], rh)];
  add('keyframe', ['fotograma clave', 'keyframe', 'animación', 'línea de tiempo', 'keyframe', 'animation', 'linear keyframe'], [rh, line([2.75, 12], l), line(r, [21.25, 12])]);
  FILL.keyframe = { solid: [0], wire: [1, 2] };
  PARTS.keyframe = { key: [0], track: [1, 2] };
  MOTION.keyframe = { effect: 'beat', parts: ['key'], origin: [12, 12] };
  const hg = roundpoly([[7.5, 5.5], [16.5, 5.5], [13.25, 12], [16.5, 18.5], [7.5, 18.5], [10.75, 12]], [1.25, 1.25, 3, 1.25, 1.25, 3]);
  const [hl0, hr0] = [toEdge([12, 12], [0, 12], hg), toEdge([12, 12], [24, 12], hg)];
  add('keyframe-ease', ['suavizado', 'easing', 'fotograma clave', 'animación', 'eased keyframe', 'ease in out', 'easing'], [hg, line([2.75, 12], hl0), line(hr0, [21.25, 12])]);
  FILL['keyframe-ease'] = { solid: [0], wire: [1, 2] };
  PARTS['keyframe-ease'] = { key: [0], track: [1, 2] };
  MOTION['keyframe-ease'] = { effect: 'beat', parts: ['key'], origin: [12, 12] };
}
// Motion path: the dotted curve from the start square through a keyframe to the end circle
{
  const S0 = [5.25, 18.75];
  const E0 = [18.75, 5.25];
  const C0 = [2.25, 2.25];
  const B = (t) => [0, 1].map((j) => (1 - t) ** 2 * S0[j] + 2 * t * (1 - t) * C0[j] + t * t * E0[j]);
  const start = sq(3, 16.5, 4.5, 4.5, 1.25);
  const end = circ(...E0, 2.25);
  const mid = B(0.5);
  const key = roundpoly([[mid[0], mid[1] - 2.5], [mid[0] + 2.5, mid[1]], [mid[0], mid[1] + 2.5], [mid[0] - 2.5, mid[1]]], 0.6);
  const shapes = [start, end, key];
  const N = 400;
  const acc = [0];
  for (let i = 1; i <= N; i++) acc.push(acc[i - 1] + len(sub(B(i / N), B((i - 1) / N))));
  const free = (p) => shapes.every((d) => distTo(p, d) >= 3.3);
  const dots = [];
  let last = null;
  for (let i = 0; i <= N; i++) {
    const p = B(i / N);
    if (!free(p)) continue;
    if (last && len(sub(p, last)) < 3.6) continue;
    if (!last || len(sub(p, last)) >= 3.6) {
      dots.push(p);
      last = p;
    }
  }
  const pts = dots.map((p) => dot(...p, 0.3));
  add('motion-path', ['trayectoria', 'ruta de movimiento', 'animación', 'recorrido', 'motion path', 'animation path', 'trajectory'], [start, key, end, ...pts]);
  FILL['motion-path'] = { solid: [0, 1, 2], wire: pts.map((_, i) => i + 3) };
  PARTS['motion-path'] = { start: [0], key: [1], end: [2], path: pts.map((_, i) => i + 3) };
}
// Onion skin: the current frame and, dashed behind it, the frames before
{
  const L1 = dashed(rl([[5.75, 17.75], [5.75, 5.75], [17.75, 5.75]], [0, 3, 0]), { open: true });
  const L2 = dashed(rl([[2.75, 14.75], [2.75, 2.75], [14.75, 2.75]], [0, 3, 0]), { open: true });
  add('onion-skin', ['papel cebolla', 'fotogramas anteriores', 'animación', 'cuadro a cuadro', 'onion skin', 'onion skinning', 'frame by frame'], [sq(8.75, 8.75, 12, 12, 3, BR), ...L1, ...L2]);
  FILL['onion-skin'] = { solid: [0], wire: [...L1, ...L2].map((_, i) => i + 1) };
  PARTS['onion-skin'] = { frame: [0], previous: [...L1, ...L2].map((_, i) => i + 1) };
}
// Render: the video frame and, under it, the export's progress bar half filled
{
  const frame = sq(2.5, 3, 19, 12, 3, BR);
  const play = roundpoly([[10, 6], [15, 9], [10, 12]], 1);
  add('render', ['renderizar', 'exportar video', 'procesar', 'progreso', 'render', 'export video', 'progress'], [frame, play, bar([4, 19.5], [10.5, 19.5], 1.5), hl(19.5, 12, 21.25)]);
  FILL.render = { solid: [0, 2], cut: [1], wire: [3] };
  PARTS.render = { video: [0, 1], progress: [2, 3] };
}
// Lower third: the frame with a title bar and a thinner line under it, in its lower left
{
  add('lower-third', ['tercio inferior', 'rótulo', 'título', 'gráfico de video', 'lower third', 'title graphic', 'name caption'], [FRAME, bar([7.5, 11.5], [13, 11.5], 1.5), hl(16, 6, 11.5)]);
  FILL['lower-third'] = { solid: [0], cut: [1, 2] };
  PARTS['lower-third'] = { frame: [0], title: [1, 2] };
}
// Credits: the frame, three centered lines getting shorter and the arrow rolling them up
{
  const tip = [16.75, 8.25];
  add('credits-roll', ['créditos', 'créditos finales', 'cierre', 'película', 'credits roll', 'end credits', 'rolling credits'], [FRAME, hl(8.75, 6.25, 12.25), hl(12, 7, 11.5), hl(15.25, 7.75, 10.75), vl(16.75, tip[1], 15.5), head(tip, [0, -1], 2.5)]);
  FILL['credits-roll'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['credits-roll'] = { frame: [0], credits: [1, 2, 3], arrow: [4, 5] };
  MOTION['credits-roll'] = { effect: 'slide', parts: ['credits', 'arrow'], vector: [0, -1.5] };
}

// ── Prints ────────────────────────────────────────────────────────────────────────────────────
// Photo print: the instant print, its square picture (a mountain) and the deeper bottom margin
{
  const card = sq(4.75, 2.75, 14.5, 18.5, 3.5, BR);
  const win = sq(7.75, 5.75, 8.5, 8.5, 1.5);
  const ridge = rl([toEdge([11.25, 9.25], [5, 15.5], win), [11.25, 9.25], toEdge([11.25, 9.25], [18, 16], win)], [0, 1, 0]);
  add('photo-print', ['foto impresa', 'foto instantánea', 'polaroid', 'impresión', 'photo print', 'instant photo', 'print'], [card, win, ridge]);
  FILL['photo-print'] = { solid: [0], cut: [1, 2] };
  PARTS['photo-print'] = { card: [0], picture: [1, 2] };
}
// Photo printer: the low printer and the print sliding out of its top, a mountain on it
{
  const print = rl([[6.5, 12.75], [6.5, 3], [17.5, 3], [17.5, 12.75]], [0, 1.25, 1.25, 0]);
  const ridge = rl([[6.5, 9.5], [9.75, 6.25], [12, 8.5], [14, 6.5], [17.5, 9.75]], [0, 0.8, 0.8, 0.8, 0]);
  add('photo-printer', ['impresora de fotos', 'imprimir fotos', 'impresora portátil', 'foto', 'photo printer', 'print photos', 'portable printer'], [sq(2.5, 12.75, 19, 8.5, 3, BR), print, ridge, dot(17.5, 17)]);
  FILL['photo-printer'] = { solid: [0, shut(print)], cut: [3, rl([[5.5, 10.5], [9.75, 6.25], [12, 8.5], [14, 6.5], [18.5, 10.75]], [0, 0.8, 0.8, 0.8, 0])] };
  PARTS['photo-printer'] = { printer: [0, 3], print: [1, 2] };
  MOTION['photo-printer'] = { effect: 'slide', parts: ['print'], vector: [0, -1.5] };
}
// Photo album: the book, its spine on the left and a photo (sun and mountains) on the cover
{
  const ridge = rl([[8.25, 16.5], [11.75, 13], [14, 15.25], [16, 13.25], [19.25, 16.5]], [0, 0.9, 0.9, 0.9, 0]);
  add('photo-album', ['álbum de fotos', 'recuerdos', 'libro de fotos', 'galería', 'photo album', 'photo book', 'memories'], [sq(4.75, 2.75, 14.5, 18.5, 3.5, BR), vl(8.25, 2.75, 21.25), dot(15.25, 7.5), ridge]);
  FILL['photo-album'] = { solid: [0], cut: [vl(8.25, 1.75, 22.25), 2, rl([[8.25, 16.5], [11.75, 13], [14, 15.25], [16, 13.25], [20.25, 17.5]], [0, 0.9, 0.9, 0.9, 0])] };
  PARTS['photo-album'] = { book: [0, 1], photo: [2, 3] };
}
// Hanging photos: the taut line and two prints hanging from it by their top edge, a mountain in each
// (prints on stems under a slung line, with a margin line, read as transito's cable cars)
{
  // Portrait prints 6.25 wide, 3.25 apart and the line running 2 past each (prints any closer merge at
  // bold; wider than tall, two under a bar read as glasses)
  const [cx, hw, y0, y1] = [[7.38, 16.62], 3.13, 5.75, 17.75];
  const prints = cx.map((x) => rl([[x - hw, y0], [x - hw, y1], [x + hw, y1], [x + hw, y0]], [0, 1.5, 1.5, 0]));
  const peak = (x, k = 0) => {
    const top = [x, y0 + 4.25];
    const out = (e) => add2(e, mul(unit(sub(e, top)), k));
    return rl([out([x - hw, y0 + 7.5]), top, out([x + hw, y0 + 7.5])], [0, 0.8, 0]);
  };
  add('hanging-photos', ['fotos colgadas', 'tendedero de fotos', 'cuarto oscuro', 'mural', 'hanging photos', 'photo wall', 'darkroom'], [hl(y0, 2.25, 21.75), ...prints, ...cx.map((x) => peak(x))]);
  // Filled, each print closes along the line and its mountain is cut through its sides
  FILL['hanging-photos'] = { solid: prints.map(shut), cut: cx.map((x) => peak(x, 1)), wire: [0] };
  PARTS['hanging-photos'] = { line: [0], prints: [1, 2, 3, 4] };
  MOTION['hanging-photos'] = { effect: 'ring', parts: ['prints'], origin: [12, y0] };
}
// Video library: the video and the edges of two more stacked behind it
{
  add('video-library', ['videoteca', 'biblioteca de video', 'colección', 'videos', 'video library', 'video collection', 'media library'], [sq(2.5, 8.25, 19, 13, 3, BR), roundpoly([[10, 11.75], [15, 14.75], [10, 17.75]], 1), hl(5.25, 5.5, 18.5), hl(2.25, 8.5, 15.5)]);
  FILL['video-library'] = { solid: [0], cut: [1], wire: [2, 3] };
  PARTS['video-library'] = { video: [0, 1], stack: [2, 3] };
}
// The photo with the engine's badges, on the drawing edicion's image-plus already trims for one
{
  const base = edicion.icons['image-plus'];
  for (const [name, kind, tags] of [
    ['image-edit', 'edit', ['editar foto', 'retocar', 'editar imagen', 'foto', 'edit photo', 'edit image', 'retouch']],
    ['image-heart', 'heart', ['foto favorita', 'me gusta', 'favoritos', 'foto', 'favorite photo', 'liked photo', 'favorites']],
    ['image-check', 'check', ['foto seleccionada', 'foto aprobada', 'elegida', 'foto', 'selected photo', 'approved photo', 'picked']],
    ['image-arrow-down', 'arrow-down', ['guardar foto', 'descargar imagen', 'bajar foto', 'foto', 'save photo', 'download image', 'download photo']],
    ['image-arrow-up', 'arrow-up', ['subir foto', 'cargar imagen', 'publicar foto', 'foto', 'upload photo', 'upload image', 'share photo']],
    ['image-lock', 'lock', ['foto privada', 'foto oculta', 'imagen protegida', 'foto', 'private photo', 'hidden photo', 'locked image']],
    ['image-x', 'x', ['quitar foto', 'eliminar imagen', 'borrar foto', 'foto', 'remove photo', 'delete image', 'discard photo']],
  ]) {
    add(name, tags, base.d, { badge: badge(kind), fill: base.fill });
    PARTS[name] = { frame: [0], sun: [1], landscape: [2] };
    MOTION[name] = BADGE_MOTION[kind];
  }
}

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing; these didn't read after it (a dial of ticks that turned into a
// sunburst, points that ran into bars, a slanted slot that smudged). Each keeps fewer pieces, at
// least a pixel apart, the new strokes on pixel centers (0.75 + 1.5k).
{
  const small = (name, d, fill) => {
    icons[name].small = { d, ...(fill && { fill }) };
  };
  // Matrix metering: the frame and a grid of four by two one-pixel points, two pixels apart
  {
    const pts = [];
    for (const y of [9.75, 14.25]) for (const x of [5.25, 9.75, 14.25, 18.75]) pts.push(circ(x, y, 0.1));
    small('metering-matrix', [FRAME, ...pts], { solid: [FRAME], cut: pts });
  }
  // Time-lapse: eight ticks instead of twelve, the fast-forward smaller
  {
    const ticks = Array.from({ length: 8 }, (_, i) => line(polar(12, 12, 6.75, i * 45 - 90), polar(12, 12, 9, i * 45 - 90)));
    small('time-lapse', [...ticks, line([9, 9.75], [11.25, 12], [9, 14.25]), line([12.75, 9.75], [15, 12], [12.75, 14.25])]);
  }
  // Blade: on the pixel diagonal, its slot a line
  {
    const blade = turnPath(sq(3.75, 8.25, 16.5, 7.5, 1.5), -45);
    small('blade-tool', [blade, turnPath(hl(12, 8.25, 15.75), -45)], { solid: [blade], cut: [turnPath(hl(12, 8.25, 15.75), -45)] });
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

// Mirror: the blur trails behind a ball moving one way; lenses, lights, cameras and the timeline keep
// their sides (playback controls aren't flipped)
icons['motion-blur'].mirror = true;

// Variants: round already (the reel, the dial, the wheel, the circles), no circle around them; square
// already (the graph, the focus square, the exposure square), no square
for (const name of ['film-reel', 'time-lapse', 'highlights', 'shadows', 'photo-filter', 'color-grading']) icons[name].variants = { circle: false };
for (const name of ['tone-curve', 'focus-point', 'exposure', 'rule-of-thirds', 'auto-framing']) icons[name].variants = { square: false };
// A slash through a broken line says nothing
icons['horizon-level'].variants = { slash: false };
// With a badge (or a piece in front) the enclosures lose the piece on top
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { circle: false, square: false, slash: false };

export default { category: 'foto-video', label: 'Foto y video', icons };
