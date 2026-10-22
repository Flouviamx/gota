// Compatible masters: an icon's outline at several weights with the same structure point for point,
// so a variable font or an Xcode variable symbol can interpolate between them.
//   masters(icon, options, [0.9, 1.5, 2.1])   // → { weights, ds: [d, d, d], checks } or throws
// How:
//   · each weight's outline, checked, with the pieces laid over each other and no unions: every
//     stroke stays a contour of its own, so the structure holds from the lightest weight to the
//     heaviest (a union would merge pieces differently at each weight);
//   · contours paired across weights (same turn, nearest center), corners paired along each contour
//     (the same count, the cyclic shift that lands them closest);
//   · each span between corners cut at the same fractions of its length in every weight and drawn
//     with quadratic curves (TrueType's own), split further in all weights at once wherever one of
//     them doesn't fit within a hundredth of a unit;
//   · every master checked against its drawing, and the weights halfway between masters, drawn by
//     interpolating, checked against theirs.
import { render } from '../engine/variants.mjs';
import { matches, outline } from './outline.mjs';

// ── Path data → contours of segments (absolute) ──
function contoursOf(d) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const list = [];
  let cur = null;
  let [x, y, sx, sy] = [0, 0, 0, 0];
  let cmd = '';
  let i = 0;
  const n = () => Number(tokens[i++]);
  const close = () => {
    if (cur && (Math.abs(x - sx) > 1e-9 || Math.abs(y - sy) > 1e-9)) cur.push({ t: 'L', p: [x, y, sx, sy] });
    [x, y] = [sx, sy];
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === 'z' || cmd === 'Z') {
        close();
        continue;
      }
    } else if (cmd === 'm') cmd = 'l';
    else if (cmd === 'M') cmd = 'L';
    const rel = cmd === cmd.toLowerCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    switch (cmd.toUpperCase()) {
      case 'M': {
        const [px, py] = [n() + ox, n() + oy];
        cur = [];
        list.push(cur);
        [x, y, sx, sy] = [px, py, px, py];
        break;
      }
      case 'L': {
        const [px, py] = [n() + ox, n() + oy];
        cur.push({ t: 'L', p: [x, y, px, py] });
        [x, y] = [px, py];
        break;
      }
      case 'H': {
        const px = n() + (rel ? x : 0);
        cur.push({ t: 'L', p: [x, y, px, y] });
        x = px;
        break;
      }
      case 'V': {
        const py = n() + (rel ? y : 0);
        cur.push({ t: 'L', p: [x, y, x, py] });
        y = py;
        break;
      }
      case 'Q': {
        const [cx, cy, px, py] = [n() + ox, n() + oy, n() + ox, n() + oy];
        cur.push({ t: 'Q', p: [x, y, cx, cy, px, py] });
        [x, y] = [px, py];
        break;
      }
      case 'C': {
        const [ax, ay, bx, by, px, py] = [n() + ox, n() + oy, n() + ox, n() + oy, n() + ox, n() + oy];
        cur.push({ t: 'C', p: [x, y, ax, ay, bx, by, px, py] });
        [x, y] = [px, py];
        break;
      }
      default:
        throw new Error(`Unexpected path command ${cmd}`);
    }
  }
  return list.filter((c) => c.length);
}

// ── Points, tangents and lengths along a contour ──
function at({ t, p }, u) {
  const v = 1 - u;
  if (t === 'L') return [p[0] + (p[2] - p[0]) * u, p[1] + (p[3] - p[1]) * u];
  if (t === 'Q') return [v * v * p[0] + 2 * v * u * p[2] + u * u * p[4], v * v * p[1] + 2 * v * u * p[3] + u * u * p[5]];
  return [v * v * v * p[0] + 3 * v * v * u * p[2] + 3 * v * u * u * p[4] + u * u * u * p[6], v * v * v * p[1] + 3 * v * v * u * p[3] + 3 * v * u * u * p[5] + u * u * u * p[7]];
}
const norm = ([x, y]) => {
  const l = Math.hypot(x, y);
  return l < 1e-12 ? [0, 0] : [x / l, y / l];
};
/** Direction leaving the segment's start (head) or arriving at its end (tail). */
function tangent({ t, p }, end) {
  const pts = [];
  for (let k = 0; k < p.length; k += 2) pts.push([p[k], p[k + 1]]);
  if (end) {
    for (let k = pts.length - 2; k >= 0; k--) {
      const v = norm([pts.at(-1)[0] - pts[k][0], pts.at(-1)[1] - pts[k][1]]);
      if (v[0] || v[1]) return v;
    }
  } else
    for (let k = 1; k < pts.length; k++) {
      const v = norm([pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]]);
      if (v[0] || v[1]) return v;
    }
  return [0, 0];
}
const STEPS = 24;
function measure(segs) {
  const lens = segs.map((s) => {
    let len = 0;
    let prev = at(s, 0);
    for (let k = 1; k <= STEPS; k++) {
      const q = at(s, k / STEPS);
      len += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
      prev = q;
    }
    return len;
  });
  const starts = [];
  let acc = 0;
  for (const l of lens) {
    starts.push(acc);
    acc += l;
  }
  return { segs, lens, starts, length: acc };
}
/** The point and the segment parameter at arc length `s` (wrapping around the contour). */
function locate(c, s) {
  const L = c.length;
  let sx = ((s % L) + L) % L;
  if (s >= L - 1e-9 && s <= L + 1e-9) sx = L;
  let i = c.starts.findLastIndex((st) => st <= sx + 1e-12);
  if (i < 0) i = 0;
  const u = c.lens[i] ? Math.min(1, Math.max(0, (sx - c.starts[i]) / c.lens[i])) : 0;
  return { i, u, pt: at(c.segs[i], u) };
}
/** Direction of travel at arc length s, from just after it (ahead) or just before it. */
function direction(c, s, ahead) {
  const e = Math.min(0.002, c.length / 1000);
  const a = locate(c, ahead ? s : s - e).pt;
  const b = locate(c, ahead ? s + e : s).pt;
  return norm([b[0] - a[0], b[1] - a[1]]);
}
function areaOf(c) {
  let a = 0;
  const pts = [];
  for (let k = 0; k < 64; k++) pts.push(locate(c, (c.length * k) / 64).pt);
  for (let k = 0; k < pts.length; k++) {
    const [x0, y0] = pts[k];
    const [x1, y1] = pts[(k + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2;
}
function centerOf(c) {
  let [x, y] = [0, 0];
  for (let k = 0; k < 32; k++) {
    const p = locate(c, (c.length * k) / 32).pt;
    x += p[0] / 32;
    y += p[1] / 32;
  }
  return [x, y];
}
/** Curvature at a segment's start (head) or end (tail): 0 on a straight one. */
function bend({ t, p }, end) {
  if (t === 'L') return 0;
  // A cubic is read through its end handles, like a quadratic near that end
  const [x0, y0, x1, y1, x2, y2] = t === 'Q' ? (end ? [p[4], p[5], p[2], p[3], p[0], p[1]] : p) : end ? [p[6], p[7], p[4], p[5], p[2], p[3]] : p.slice(0, 6);
  const [dx, dy] = [2 * (x1 - x0), 2 * (y1 - y0)];
  const [ex, ey] = [2 * (x2 - 2 * x1 + x0), 2 * (y2 - 2 * y1 + y0)];
  const speed = Math.hypot(dx, dy);
  return speed < 1e-9 ? 0 : Math.abs(dx * ey - dy * ex) / speed ** 3;
}
/**
 * Arc positions every weight shares: joints where the direction turns sharply, and the ends of a
 * stroke's round caps and joins, which are arcs of radius exactly half the weight (curvature 2/w)
 * and move along the contour as the stroke widens.
 */
function cornersOf(c, degrees, weight) {
  const out = [];
  const cos = Math.cos((degrees * Math.PI) / 180);
  const cap = (k) => Math.abs(k - 2 / weight) < 0.3 * (2 / weight);
  for (let i = 0; i < c.segs.length; i++) {
    const prev = c.segs[(i - 1 + c.segs.length) % c.segs.length];
    const before = tangent(prev, true);
    const after = tangent(c.segs[i], false);
    const edge = cap(bend(prev, true)) !== cap(bend(c.segs[i], false));
    if (before[0] * after[0] + before[1] * after[1] < cos || edge) out.push(c.starts[i]);
  }
  return out;
}

// ── Pairing across weights ──
function boxOf(c) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 64; k++) {
    const [x, y] = locate(c, (c.length * k) / 64).pt;
    [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  }
  return [x0, y0, x1, y1];
}
/** How the contour spreads around its center (second moments): tells apart shapes turned differently. */
function spreadOf(c, [mx, my]) {
  let [xx, xy, yy] = [0, 0, 0];
  for (let k = 0; k < 64; k++) {
    const [x, y] = locate(c, (c.length * k) / 64).pt;
    xx += ((x - mx) * (x - mx)) / 64;
    xy += ((x - mx) * (y - my)) / 64;
    yy += ((y - my) * (y - my)) / 64;
  }
  return [xx, xy, yy];
}
function inside([px, py], c) {
  let hit = false;
  const pts = [];
  for (let k = 0; k < 64; k++) pts.push(locate(c, (c.length * k) / 64).pt);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
/**
 * Pair each weight's contours with the first weight's: the same turn, then the nearest by depth
 * (how many contours hold it), center, box and spread (orbits that share a center and a box turn
 * differently); strokes grow by half a unit at most between masters, two different contours more.
 */
function pairContours(sets) {
  const info = (set) =>
    set.map((c) => {
      const probe = locate(c, 0).pt;
      const center = centerOf(c);
      return { c, area: areaOf(c), center, box: boxOf(c), spread: spreadOf(c, center), depth: set.filter((o) => o !== c && inside(probe, o)).length };
    });
  const R = info(sets[0]);
  const paired = R.map((r) => [r.c]);
  for (const set of sets.slice(1)) {
    if (set.length !== sets[0].length) throw new Error(`contours differ: ${sets[0].length} and ${set.length}`);
    const S = info(set);
    const pairs = [];
    R.forEach((r, i) =>
      S.forEach((q, j) => {
        if (Math.sign(r.area) !== Math.sign(q.area)) return;
        const cost =
          Math.abs(r.depth - q.depth) * 10 +
          Math.hypot(r.center[0] - q.center[0], r.center[1] - q.center[1]) +
          r.box.reduce((sum, v, k) => sum + Math.abs(v - q.box[k]), 0) +
          r.spread.reduce((sum, v, k) => sum + Math.abs(v - q.spread[k]), 0) * 0.5;
        pairs.push({ i, j, cost });
      }),
    );
    pairs.sort((a, b) => a.cost - b.cost);
    const got = new Map();
    const used = new Set();
    for (const p of pairs) {
      if (got.has(p.i) || used.has(p.j)) continue;
      got.set(p.i, p.j);
      used.add(p.j);
    }
    if (got.size !== R.length) throw new Error('contours turn differently across weights');
    R.forEach((_, i) => paired[i].push(S[got.get(i)].c));
  }
  return paired;
}
/** Corners of each weight's contour, the same count, aligned; or the start points for a smooth one. */
function pairCorners(group, weights) {
  for (const degrees of [30, 22, 40, 55, 15, 70]) {
    const sets = group.map((c, k) => cornersOf(c, degrees, weights[k]));
    if (sets.some((s) => s.length !== sets[0].length)) continue;
    if (!sets[0].length) break;
    const ref = sets[0].map((s) => locate(group[0], s).pt);
    return sets.map((set, k) => {
      if (k === 0) return set;
      const pts = set.map((s) => locate(group[k], s).pt);
      let best = 0;
      let min = Infinity;
      for (let shift = 0; shift < set.length; shift++) {
        let dist = 0;
        for (let q = 0; q < set.length; q++) dist += Math.hypot(ref[q][0] - pts[(q + shift) % set.length][0], ref[q][1] - pts[(q + shift) % set.length][1]);
        if (dist < min) [min, best] = [dist, shift];
      }
      return set.map((_, q) => set[(q + best) % set.length]);
    });
  }
  // Smooth (no corner every weight agrees on): start where each weight comes nearest the
  // reference's topmost point, then share fractions of the whole length
  const top = (() => {
    let best = null;
    for (let k = 0; k < 96; k++) {
      const s = (group[0].length * k) / 96;
      const p = locate(group[0], s).pt;
      if (!best || p[1] < best.p[1] - 1e-6 || (Math.abs(p[1] - best.p[1]) <= 1e-6 && p[0] < best.p[0])) best = { s, p };
    }
    return best;
  })();
  return group.map((c, k) => {
    if (k === 0) return [top.s];
    let best = { s: 0, d: Infinity };
    for (let q = 0; q < 192; q++) {
      const s = (c.length * q) / 192;
      const p = locate(c, s).pt;
      const d = Math.hypot(p[0] - top.p[0], p[1] - top.p[1]);
      if (d < best.d) best = { s, d };
    }
    return [best.s];
  });
}

// ── Fitting quadratic pieces in every weight at once ──
const TOL = 0.01;
function quadFor(c, s0, s1) {
  const p0 = locate(c, s0).pt;
  const p1 = locate(c, s1).pt;
  const t0 = direction(c, s0, true);
  const t1 = direction(c, s1, false);
  const chord = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  // A straight piece: every sample on the chord
  let straight = true;
  for (let k = 1; k < 8; k++) {
    const q = locate(c, s0 + ((s1 - s0) * k) / 8).pt;
    const off = chord < 1e-9 ? Math.hypot(q[0] - p0[0], q[1] - p0[1]) : Math.abs((p1[0] - p0[0]) * (p0[1] - q[1]) - (p0[0] - q[0]) * (p1[1] - p0[1])) / chord;
    if (off > TOL / 2) straight = false;
  }
  if (straight) return { p0, p1, ctrl: [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], straight: true };
  // The control point where the end tangents meet
  const den = t0[0] * t1[1] - t0[1] * t1[0];
  if (Math.abs(den) < 1e-6) return null;
  const a = ((p1[0] - p0[0]) * t1[1] - (p1[1] - p0[1]) * t1[0]) / den;
  if (a <= 0 || a > chord * 2) return null;
  const ctrl = [p0[0] + t0[0] * a, p0[1] + t0[1] * a];
  // Farthest sample of the real curve from the quadratic
  const quad = [];
  for (let k = 0; k <= 32; k++) quad.push(at({ t: 'Q', p: [...p0, ...ctrl, ...p1] }, k / 32));
  for (let k = 1; k < 10; k++) {
    const q = locate(c, s0 + ((s1 - s0) * k) / 10).pt;
    let min = Infinity;
    for (let m = 0; m < quad.length - 1; m++) {
      const [ax, ay] = quad[m];
      const [bx, by] = quad[m + 1];
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2;
      const u = L2 ? Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - ay) * (by - ay)) / L2)) : 0;
      min = Math.min(min, Math.hypot(q[0] - ax - u * (bx - ax), q[1] - ay - u * (by - ay)));
    }
    if (min > TOL) return null;
  }
  return { p0, p1, ctrl, straight: false };
}
/** One contour in every weight as pieces of the same fractions: [[piece per weight], …]. */
function fit(group, corners) {
  const spans = corners[0].map((_, i) => group.map((c, k) => {
    const a = corners[k][i];
    let b = corners[k][(i + 1) % corners[k].length];
    if (corners[k].length === 1 || b <= a) b += c.length;
    return [a, b];
  }));
  const pieces = [];
  const walk = (span, f0, f1, depth) => {
    const fits = group.map((c, k) => {
      const [a, b] = span[k];
      return quadFor(c, a + (b - a) * f0, a + (b - a) * f1);
    });
    const tiny = group.every((c, k) => (span[k][1] - span[k][0]) * (f1 - f0) < 0.02);
    if (fits.every(Boolean) || depth > 9 || tiny) {
      const all = fits.map((q, k) => q ?? { p0: locate(group[k], span[k][0] + (span[k][1] - span[k][0]) * f0).pt, p1: locate(group[k], span[k][0] + (span[k][1] - span[k][0]) * f1).pt, straight: true });
      pieces.push(all.map((q) => (all.every((x) => x.straight) ? { t: 'L', to: q.p1 } : { t: 'Q', ctrl: q.ctrl ?? [(q.p0[0] + q.p1[0]) / 2, (q.p0[1] + q.p1[1]) / 2], to: q.p1 })));
      return;
    }
    const mid = (f0 + f1) / 2;
    walk(span, f0, mid, depth + 1);
    walk(span, mid, f1, depth + 1);
  };
  for (const span of spans) {
    // Start with pieces that turn 90° at most in every weight
    const turns = Math.max(
      ...group.map((c, k) => {
        let total = 0;
        let prev = direction(c, span[k][0], true);
        for (let q = 1; q <= 16; q++) {
          const d = direction(c, span[k][0] + ((span[k][1] - span[k][0]) * q) / 16, false);
          total += Math.acos(Math.max(-1, Math.min(1, prev[0] * d[0] + prev[1] * d[1])));
          prev = d;
        }
        return total;
      }),
    );
    const n = Math.max(1, Math.ceil(turns / (Math.PI / 2)));
    for (let q = 0; q < n; q++) walk(span, q / n, (q + 1) / n, 0);
  }
  const starts = group.map((c, k) => locate(c, corners[k][0]).pt);
  return { starts, pieces };
}

// ── Following the regular master ──
// The masters are, in essence, one outline moved out or in by half the change of weight: a point
// of the regular master corresponds to the nearest point of each other master (a cap's arc maps
// radially onto the wider or narrower cap). Stations along the regular master, its sharp corners
// among them, are carried to every master by nearest point, searching forward so the order holds.
function sampler(c, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const s = (c.length * k) / n;
    pts.push({ s, p: locate(c, s).pt });
  }
  return pts;
}
function follow(group, weights) {
  const R = weights.indexOf(1.5) >= 0 ? weights.indexOf(1.5) : 1;
  const ref = group[R];
  const closed = true;
  const fine = group.map((c) => sampler(c, Math.max(256, Math.ceil(c.length / 0.03))));
  // Sharp corners of the regular master, and of each master, to land corners on corners
  const sharp = group.map((c, k) => cornersOf(c, 30, 0).filter(() => true));
  const nearestCorner = (k, p, reach) => {
    let best = null;
    for (const s of sharp[k]) {
      const q = locate(group[k], s).pt;
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < reach && (!best || d < best.d)) best = { s, d };
    }
    return best?.s;
  };
  // Where a point of the regular master lands on master k, searching forward from `from`
  const land = (k, s, from, span) => {
    const p = locate(ref, s).pt;
    const c = group[k];
    const pts = fine[k];
    const L = c.length;
    let best = null;
    for (const q of pts) {
      let ahead = q.s - from;
      if (ahead < -1e-9) ahead += L;
      if (ahead > span) continue;
      const d = Math.hypot(q.p[0] - p[0], q.p[1] - p[1]);
      if (!best || d < best.d - 1e-12) best = { s: from + ahead, d };
    }
    return best ? best.s : from;
  };
  // Stations: the regular master's sharp corners plus even steps, carried to every master
  const step = 1.2;
  const marks = [...new Set([...sharp[R], ...Array.from({ length: Math.ceil(ref.length / step) }, (_, i) => (ref.length * i) / Math.ceil(ref.length / step))].map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
  const startRef = sharp[R].length ? sharp[R][0] : marks[0];
  const order = [...marks.filter((m) => m >= startRef), ...marks.filter((m) => m < startRef).map((m) => m + ref.length)];
  const delta = weights.map((w) => Math.abs(w - weights[R]) / 2 + 0.3);
  const starts = group.map((c, k) => {
    if (k === R) return startRef;
    const near = land(k, startRef, 0, c.length);
    return nearestCorner(k, locate(ref, startRef).pt, delta[k] * 2) ?? near;
  });
  const at = group.map((c, k) => [starts[k]]);
  for (let i = 1; i < order.length; i++) {
    group.forEach((c, k) => {
      if (k === R) return at[k].push(order[i]);
      const prev = at[k].at(-1);
      let s = land(k, order[i], prev, c.length * 0.3);
      const isCorner = sharp[R].some((v) => Math.abs(v - (order[i] % ref.length)) < 1e-6);
      if (isCorner) {
        const cs = nearestCorner(k, locate(ref, order[i]).pt, delta[k] * 2);
        if (cs !== undefined) {
          let ahead = cs - prev;
          if (ahead < 0) ahead += c.length;
          s = prev + ahead;
        }
      }
      at[k].push(Math.max(s, prev));
    });
  }
  group.forEach((c, k) => at[k].push(starts[k] + c.length));
  // Pieces between consecutive stations, split at the middle (of the regular master, carried)
  // wherever one master doesn't fit
  const pieces = [];
  const walk = (a, b, depth) => {
    const fits = group.map((c, k) => quadFor(c, a[k], b[k]));
    if (fits.every(Boolean) || depth > 8 || group.every((c, k) => b[k] - a[k] < 0.02)) {
      const all = fits.map((q, k) => q ?? { p0: locate(group[k], a[k]).pt, p1: locate(group[k], b[k]).pt, straight: true });
      pieces.push(all.map((q) => (all.every((x) => x.straight) ? { t: 'L', to: q.p1 } : { t: 'Q', ctrl: q.ctrl ?? [(q.p0[0] + q.p1[0]) / 2, (q.p0[1] + q.p1[1]) / 2], to: q.p1 })));
      return;
    }
    const midRef = (a[R] + b[R]) / 2;
    const mid = group.map((c, k) => {
      if (k === R) return midRef;
      const s = land(k, midRef % ref.length, a[k], Math.max(0.001, b[k] - a[k]));
      return Math.min(b[k], Math.max(a[k], s));
    });
    walk(a, mid, depth + 1);
    walk(mid, b, depth + 1);
  };
  for (let i = 0; i < at[R].length - 1; i++) walk(group.map((_, k) => at[k][i]), group.map((_, k) => at[k][i + 1]), 0);
  return { starts: group.map((c, k) => locate(c, starts[k]).pt), pieces, closed };
}

const r3 = (v) => String(Math.round(v * 1000) / 1000);
function pathOf(contours, k, mix) {
  const pt = (p) => (mix ? mix(p) : p[k]);
  return contours
    .map(({ starts, pieces }) => {
      const s = pt(starts);
      return `M${r3(s[0])} ${r3(s[1])}${pieces
        .map((w) => {
          const piece = mix ? w : w[k];
          const t = mix ? w[0].t : piece.t;
          const to = pt(w.map((x) => x.to));
          if (t === 'L') return `L${r3(to[0])} ${r3(to[1])}`;
          const c = pt(w.map((x) => x.ctrl));
          return `Q${r3(c[0])} ${r3(c[1])} ${r3(to[0])} ${r3(to[1])}`;
        })
        .join('')}Z`;
    })
    .join('');
}

/**
 * The icon's outline at each weight (ascending), compatible point for point. Throws if the
 * structure can't be shared (contours that appear or merge between weights) or a check fails.
 */
export function masters(icon, options = {}, weights = [0.9, 1.5, 2.1]) {
  const svgAt = (w) => render(icon, { ...options, weight: w, animate: null, id: 'o' });
  const errors = [];
  // Joined first: the union of a QA-clean icon keeps its structure across weights (pieces either
  // cross or stand 2.85 apart) and its contours turn canonically; then each piece on its own
  for (const modes of [
    ['joined', 'sequential', 'reverse', 'nudged'],
    ['overlap', 'nudged'],
  ]) {
    let sets;
    try {
      const ds = weights.map((w) => outline(icon, { ...options, weight: w }, { modes }));
      // Slivers a path operation leaves (under 0.02 of area) are invisible and don't hold across weights
      sets = ds.map((d) => contoursOf(d).map(measure).filter((c) => Math.abs(areaOf(c)) >= 0.02));
    } catch (error) {
      errors.push(`${modes[0]}: ${error.message}`);
      continue;
    }
    // Two ways to make points correspond: following the regular master by nearest point (caps map
    // radially), then corners and fractions of length (where nearest points jump between close
    // branches); each one checked
    for (const [way, make] of [
      ['follow', (group) => follow(group, weights)],
      ['corners', (group) => fit(group, pairCorners(group, weights))],
    ]) {
      try {
        const contours = pairContours(sets).map(make);
        const out = weights.map((_, k) => pathOf(contours, k));
        const checks = out.map((d, k) => ({ weight: weights[k], ...matches(svgAt(weights[k]), d) }));
        for (let k = 0; k < weights.length - 1; k++) {
          const w = (weights[k] + weights[k + 1]) / 2;
          const d = pathOf(contours, 0, (values) => values[k].map((v, i) => (v + values[k + 1][i]) / 2));
          checks.push({ weight: w, between: true, ...matches(svgAt(w), d) });
        }
        const bad = checks.filter((c) => !c.ok);
        if (!bad.length) return { weights, ds: out, contours, checks, mode: `${modes[0]}/${way}` };
        errors.push(`${modes[0]}/${way}: ${JSON.stringify(bad.map(({ weight, between, diff, clump }) => ({ weight, between, diff, clump })))}`);
      } catch (error) {
        errors.push(`${modes[0]}/${way}: ${error.message}`);
      }
    }
  }
  throw new Error(`${icon.name ?? 'icon'} ${JSON.stringify(options)}: no compatible masters (${errors.join(' · ')})`);
}

/** Diagnosis: each weight's contours with their turn, depth, center and box. */
export function describe(icon, options = {}, weights = [0.9, 1.5, 2.1], modes = ['joined', 'sequential', 'reverse', 'nudged']) {
  return weights.map((w) => {
    const set = contoursOf(outline(icon, { ...options, weight: w }, { modes })).map(measure);
    return set.map((c) => {
      const probe = locate(c, 0).pt;
      return { turn: Math.sign(areaOf(c)), depth: set.filter((o) => o !== c && inside(probe, o)).length, center: centerOf(c).map((v) => Math.round(v * 10) / 10), box: boxOf(c).map((v) => Math.round(v * 10) / 10) };
    });
  });
}

/** Diagnosis: the outline interpolated at `t` between masters k and k + 1 (same modes as masters()). */
export function between(icon, options = {}, weights = [0.9, 1.5, 2.1], k = 1, t = 0.5, modes = ['joined', 'sequential', 'reverse', 'nudged']) {
  const ds = weights.map((w) => outline(icon, { ...options, weight: w }, { modes }));
  const sets = ds.map((d) => contoursOf(d).map(measure).filter((c) => Math.abs(areaOf(c)) >= 0.02));
  const contours = pairContours(sets).map((group) => follow(group, weights));
  return { d: pathOf(contours, 0, (values) => values[k].map((v, i) => v + (values[k + 1][i] - v) * t)), masters: weights.map((_, q) => pathOf(contours, q)) };
}
