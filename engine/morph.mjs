// Gota · transitions between icons, drawn frame by frame by the engine itself (masks, fill,
// enclosures and weight included), so no frame is ever an approximation of the set's rules.
//   · Two icons with the same base and a different badge (bell ↔ bell-off, file ↔ file-check): the
//     base stays still and the badge draws itself in or out, its cutout with it (open badges along
//     their stroke, closed ones growing from their center).
//   · A curated pair (menu ↔ close, lock ↔ lock-open…): the strokes transform into each other.
//     Both icons become cubic Bézier segments; paired strokes correspond segment by segment when
//     they share a structure, otherwise by length; a straight line turns (center, angle and
//     length) instead of folding; a stroke left over is erased along its own length and a new one
//     is drawn the same way, one after another, never grown from a point.
//   · Any other pair is not forced: it swaps in ({ replace }) or turns ({ rotate }).
//   · One icon, outline ↔ fill: the fill rises through the outline like a liquid, or drains out of it
//     ({ liquid: 'rise' | 'drain' }).
//   const way = transitionOf('bell', 'bell-off', icons)
//   const frame = frames(icons.bell, icons['bell-off'], way, { weight: 1.5, id: 'a' })
//   frame(0.5)  // → the inner SVG halfway
import { render, transform } from './variants.mjs';

// ── Path → subpaths of cubic segments [x0, y0, c1x, c1y, c2x, c2y, x1, y1] ──
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;
function tokens(d) {
  const out = [];
  for (const m of transform(d, 1, 0, 0).matchAll(/([MLHVCSQTAZ])([^MLHVCSQTAZ]*)/g)) out.push([m[1], (m[2].match(NUM) ?? []).map(Number)]);
  return out;
}
const line = (x0, y0, x1, y1) => [x0, y0, x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + (2 * (x1 - x0)) / 3, y0 + (2 * (y1 - y0)) / 3, x1, y1];

// Elliptical arc → cubic segments of at most 90° (SVG implementation notes, F.6)
function arcToCubics(x0, y0, rx, ry, phi, large, sweep, x1, y1) {
  if (!rx || !ry) return [line(x0, y0, x1, y1)];
  const sin = Math.sin((phi * Math.PI) / 180);
  const cos = Math.cos((phi * Math.PI) / 180);
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const x = cos * dx + sin * dy;
  const y = -sin * dx + cos * dy;
  let rx2 = rx * rx;
  let ry2 = ry * ry;
  const lambda = (x * x) / rx2 + (y * y) / ry2;
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
    rx2 = rx * rx;
    ry2 = ry * ry;
  }
  const sign = large === sweep ? -1 : 1;
  const k = sign * Math.sqrt(Math.max(0, (rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x)));
  const cx1 = (k * rx * y) / ry;
  const cy1 = (-k * ry * x) / rx;
  const cx = cos * cx1 - sin * cy1 + (x0 + x1) / 2;
  const cy = sin * cx1 + cos * cy1 + (y0 + y1) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x - cx1) / rx, (y - cy1) / ry);
  let dt = ang((x - cx1) / rx, (y - cy1) / ry, (-x - cx1) / rx, (-y - cy1) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / n;
  const kappa = (4 / 3) * Math.tan(step / 4);
  const pt = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const dpt = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  const segs = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + i * step;
    const b = a + step;
    const [ax, ay] = i === 0 ? [x0, y0] : pt(a);
    const [bx, by] = i === n - 1 ? [x1, y1] : pt(b);
    const [dax, day] = dpt(a);
    const [dbx, dby] = dpt(b);
    segs.push([ax, ay, ax + kappa * dax, ay + kappa * day, bx - kappa * dbx, by - kappa * dby, bx, by]);
  }
  return segs;
}

/** One `d` → subpaths: { closed, segs: [[x0,y0,c1x,c1y,c2x,c2y,x1,y1], …] }. */
export function toCubics(d) {
  const subs = [];
  let cur = null;
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let lastC = null;
  let lastQ = null;
  for (const [c, a] of tokens(d)) {
    if (c === 'M') {
      for (let i = 0; i < a.length; i += 2) {
        if (i === 0) {
          [x, y, sx, sy] = [a[0], a[1], a[0], a[1]];
          cur = { closed: false, segs: [] };
          subs.push(cur);
        } else {
          cur.segs.push(line(x, y, a[i], a[i + 1]));
          [x, y] = [a[i], a[i + 1]];
        }
      }
      lastC = lastQ = null;
      continue;
    }
    if (!cur) continue;
    if (c === 'L' || c === 'T') {
      for (let i = 0; i < a.length; i += 2) {
        cur.segs.push(line(x, y, a[i], a[i + 1]));
        [x, y] = [a[i], a[i + 1]];
      }
      lastC = lastQ = null;
    } else if (c === 'H' || c === 'V') {
      for (const v of a) {
        const [nx, ny] = c === 'H' ? [v, y] : [x, v];
        cur.segs.push(line(x, y, nx, ny));
        [x, y] = [nx, ny];
      }
      lastC = lastQ = null;
    } else if (c === 'C' || c === 'S') {
      const n = c === 'C' ? 6 : 4;
      for (let i = 0; i < a.length; i += n) {
        const [c1x, c1y] = c === 'C' ? [a[i], a[i + 1]] : lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y];
        const [c2x, c2y, ex, ey] = c === 'C' ? a.slice(i + 2, i + 6) : a.slice(i, i + 4);
        cur.segs.push([x, y, c1x, c1y, c2x, c2y, ex, ey]);
        lastC = [c2x, c2y];
        [x, y] = [ex, ey];
      }
      lastQ = null;
    } else if (c === 'Q') {
      for (let i = 0; i < a.length; i += 4) {
        const [qx, qy, ex, ey] = a.slice(i, i + 4);
        cur.segs.push([x, y, x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey]);
        lastQ = [qx, qy];
        [x, y] = [ex, ey];
      }
      lastC = null;
    } else if (c === 'A') {
      for (let i = 0; i < a.length; i += 7) {
        cur.segs.push(...arcToCubics(x, y, a[i], a[i + 1], a[i + 2], a[i + 3], a[i + 4], a[i + 5], a[i + 6]));
        [x, y] = [a[i + 5], a[i + 6]];
      }
      lastC = lastQ = null;
    } else if (c === 'Z') {
      if (Math.hypot(x - sx, y - sy) > 1e-3) cur.segs.push(line(x, y, sx, sy));
      cur.closed = true;
      [x, y] = [sx, sy];
      lastC = lastQ = null;
    }
  }
  // A dot or a zero-length stroke still needs one segment to morph from
  for (const s of subs) if (!s.segs.length) s.segs.push(line(sx, sy, sx, sy));
  return subs;
}

// Split a cubic at t (de Casteljau)
function split([x0, y0, a, b, c, d, x1, y1], t = 0.5) {
  const L = (p, q) => p + (q - p) * t;
  const [ab, bb] = [L(x0, a), L(y0, b)];
  const [bc, bcy] = [L(a, c), L(b, d)];
  const [cd, cdy] = [L(c, x1), L(d, y1)];
  const [abc, abcy] = [L(ab, bc), L(bb, bcy)];
  const [bcd, bcdy] = [L(bc, cd), L(bcy, cdy)];
  const [m, my] = [L(abc, bcd), L(abcy, bcdy)];
  return [
    [x0, y0, ab, bb, abc, abcy, m, my],
    [m, my, bcd, bcdy, cd, cdy, x1, y1],
  ];
}
const centroid = (sub) => {
  const xs = sub.segs.flatMap((s) => [s[0], s[6]]);
  const ys = sub.segs.flatMap((s) => [s[1], s[7]]);
  return [xs.reduce((p, v) => p + v, 0) / xs.length, ys.reduce((p, v) => p + v, 0) / ys.length];
};
const out = (segs, closed) => {
  const f = (v) => Math.round(v * 100) / 100;
  return `M${f(segs[0][0])} ${f(segs[0][1])}${segs.map((s) => `C${f(s[2])} ${f(s[3])} ${f(s[4])} ${f(s[5])} ${f(s[6])} ${f(s[7])}`).join('')}${closed ? 'Z' : ''}`;
};

// Reverse an open stroke (so a line can morph into another drawn the other way)
const reverse = (sub) => ({ closed: sub.closed, segs: sub.segs.slice().reverse().map(([x0, y0, a, b, c, d, x1, y1]) => [x1, y1, c, d, a, b, x0, y0]) });
const ends = (sub) => [sub.segs[0][0], sub.segs[0][1], sub.segs.at(-1)[6], sub.segs.at(-1)[7]];
/** How far two strokes are: their ends (an open one may be read backwards) and their centers. */
function cost(a, b) {
  const [ax0, ay0, ax1, ay1] = ends(a);
  const [bx0, by0, bx1, by1] = ends(b);
  const direct = Math.hypot(ax0 - bx0, ay0 - by0) + Math.hypot(ax1 - bx1, ay1 - by1);
  const back = a.closed || b.closed ? Infinity : Math.hypot(ax0 - bx1, ay0 - by1) + Math.hypot(ax1 - bx0, ay1 - by0);
  const [ca, cb] = [centroid(a), centroid(b)];
  return { cost: Math.min(direct, back) + Math.hypot(ca[0] - cb[0], ca[1] - cb[1]), flip: back < direct };
}
/**
 * Pair the strokes: the curated pairs [[i, j], …] (indices into each icon's strokes), or by
 * nearness, greedy on the cheapest pairs. Returns the pairs and the strokes left on each side.
 */
function pair(A, B, forced) {
  const candidates = forced
    ? forced.map(([i, j]) => ({ i, j, ...cost(A[i], B[j]) }))
    : A.flatMap((a, i) => B.map((b, j) => ({ i, j, ...cost(a, b) }))).sort((p, q) => p.cost - q.cost);
  const usedA = new Set();
  const usedB = new Set();
  const matched = [];
  for (const p of candidates) {
    // A curated pair may reuse a stroke: the minus line becomes both bars of the plus
    if (!forced && (usedA.has(p.i) || usedB.has(p.j))) continue;
    usedA.add(p.i);
    usedB.add(p.j);
    matched.push([p.flip ? reverse(A[p.i]) : A[p.i], B[p.j]]);
  }
  return { matched, gone: A.filter((_, i) => !usedA.has(i)), born: B.filter((_, j) => !usedB.has(j)) };
}

// ── Timing ──
const span = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const inOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const outCubic = (t) => 1 - (1 - t) ** 3;
const outBack = (t) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

// ── Strokes drawn in part ──
const at = ([x0, y0, a, b, c, d, x1, y1], t) => {
  const u = 1 - t;
  return [u * u * u * x0 + 3 * u * u * t * a + 3 * u * t * t * c + t * t * t * x1, u * u * u * y0 + 3 * u * u * t * b + 3 * u * t * t * d + t * t * t * y1];
};
function arcLen(s) {
  let len = 0;
  let p = [s[0], s[1]];
  for (let i = 1; i <= 16; i++) {
    const q = at(s, i / 16);
    len += Math.hypot(q[0] - p[0], q[1] - p[1]);
    p = q;
  }
  return len;
}
/** The part of a stroke between fractions a and b of its length, as segments. */
function trim(segs, a, b) {
  if (b - a < 1e-4) return [];
  const lens = segs.map(arcLen);
  const total = lens.reduce((p, v) => p + v, 0);
  const [from, to] = [a * total, b * total];
  const kept = [];
  let s0 = 0;
  segs.forEach((seg, i) => {
    const s1 = s0 + lens[i];
    if (lens[i] && s1 > from && s0 < to) {
      const u1 = Math.min(1, (to - s0) / lens[i]);
      const u0 = Math.max(0, (from - s0) / lens[i]);
      let part = u1 < 1 ? split(seg, u1)[0] : seg;
      if (u0 > 0) part = split(part, u0 / u1)[1];
      kept.push(part);
    }
    s0 = s1;
  });
  return kept;
}
/** A stroke drawn up to `p` of its length: from its start, or from its middle outward. */
function partial(sub, p, origin) {
  if (p <= 0.002) return null;
  if (p >= 0.998) return out(sub.segs, sub.closed);
  const segs = origin === 'middle' ? trim(sub.segs, (1 - p) / 2, (1 + p) / 2) : trim(sub.segs, 0, p);
  return segs.length ? out(segs, false) : null;
}

// ── Strokes that correspond by length ──
const area = (segs) => segs.reduce((sum, g) => sum + g[0] * g[7] - g[6] * g[1], 0) / 2;
const reversed = (segs) => reverse({ segs }).segs;
/** Points at n even steps along a stroke's length. */
function samples(segs, n) {
  const lens = segs.map(arcLen);
  const total = lens.reduce((p, v) => p + v, 0);
  const pts = [];
  let i = 0;
  let s0 = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (i < segs.length - 1 && s0 + lens[i] < target) s0 += lens[i++];
    pts.push(at(segs[i], lens[i] ? Math.min(1, (target - s0) / lens[i]) : 0));
  }
  return pts;
}
/** Where each segment ends, as a fraction of the stroke's length. */
function breaks(segs) {
  const lens = segs.map(arcLen);
  const total = lens.reduce((p, v) => p + v, 0) || 1;
  let acc = 0;
  return lens.slice(0, -1).map((l) => (acc += l) / total);
}
/**
 * Make two strokes correspond point by point. Closed ones turn the same way and start where they
 * twist least. With the same structure, segment into segment; otherwise each is cut where the other
 * has a corner, so both have the same segments at the same fractions of their length.
 */
function correspond(a, b) {
  let A = a.segs;
  const B = b.segs;
  if (a.closed && b.closed && Math.sign(area(A)) !== Math.sign(area(B))) A = reversed(A);
  // The same structure (as many segments): each segment into its own, closed ones from the segment
  // where they twist least (a padlock's shackle stays an arc all the way)
  if (A.length === B.length) {
    if (!a.closed || !b.closed) return [A, B];
    let best = 0;
    let min = Infinity;
    for (let k = 0; k < A.length; k++) {
      let dist = 0;
      for (let i = 0; i < A.length; i++) dist += Math.hypot(A[(i + k) % A.length][0] - B[i][0], A[(i + k) % A.length][1] - B[i][1]);
      if (dist < min) [min, best] = [dist, k];
    }
    return [[...A.slice(best), ...A.slice(0, best)], B];
  }
  if (a.closed) {
    const N = 48;
    const [pa, pb] = [samples(A, N), samples(B, N)];
    let best = 0;
    let min = Infinity;
    for (let k = 0; k < N; k++) {
      let dist = 0;
      for (let i = 0; i < N; i++) dist += Math.hypot(pa[(i + k) % N][0] - pb[i][0], pa[(i + k) % N][1] - pb[i][1]);
      if (dist < min) [min, best] = [dist, k];
    }
    if (best) A = [...trim(A, best / N, 1), ...trim(A, 0, best / N)];
  }
  const cuts = [...new Set([...breaks(A), ...breaks(B)].map((v) => Math.round(v * 1e4) / 1e4))].filter((v) => v > 1e-3 && v < 1 - 1e-3).sort((x, y) => x - y);
  const at = [0, ...cuts, 1];
  const pieces = (segs) => at.slice(0, -1).flatMap((v, i) => trim(segs, v, at[i + 1]).slice(0, 1));
  return [pieces(A), pieces(B)];
}

// ── Straight lines turn ──
function straight(sub) {
  if (sub.segs.length !== 1) return false;
  const [x0, y0, a, b, c, d, x1, y1] = sub.segs[0];
  const len = Math.hypot(x1 - x0, y1 - y0);
  const off = (px, py) => Math.abs((x1 - x0) * (y0 - py) - (x0 - px) * (y1 - y0)) / len;
  return len > 1e-3 && off(a, b) < 0.01 && off(c, d) < 0.01;
}
/**
 * One line into another by its center, angle (the shortest way) and length. A line that both moves
 * and turns first moves, then turns (a menu's lines meet in the middle, then cross).
 */
function turn([ax0, ay0, , , , , ax1, ay1], [bx0, by0, , , , , bx1, by1]) {
  const [cax, cay, cbx, cby] = [(ax0 + ax1) / 2, (ay0 + ay1) / 2, (bx0 + bx1) / 2, (by0 + by1) / 2];
  const [la, lb] = [Math.hypot(ax1 - ax0, ay1 - ay0), Math.hypot(bx1 - bx0, by1 - by0)];
  const a0 = Math.atan2(ay1 - ay0, ax1 - ax0);
  const a1 = Math.atan2(by1 - by0, bx1 - bx0);
  const delta = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0));
  const both = Math.hypot(cbx - cax, cby - cay) > 0.01 && (Math.abs(delta) > 0.01 || Math.abs(lb - la) > 0.01);
  return (t) => {
    const [m, r] = both ? [inOut(span(t, 0, 0.5)), inOut(span(t, 0.5, 1))] : [inOut(t), inOut(t)];
    const [ang, half] = [a0 + delta * r, (la + (lb - la) * r) / 2];
    const [cx, cy] = [cax + (cbx - cax) * m, cay + (cby - cay) * m];
    return [line(cx - Math.cos(ang) * half, cy - Math.sin(ang) * half, cx + Math.cos(ang) * half, cy + Math.sin(ang) * half)];
  };
}

/** Each of n strokes gets its turn within [w0, w1], one after another, overlapping. */
const stagger = (t, w0, w1, k, n) => {
  const len = (w1 - w0) / (1 + 0.35 * (n - 1));
  const start = w0 + k * 0.35 * len;
  return span(t, start, start + len);
};

/**
 * Morph one icon's strokes into another's: t (0–1, linear) ⇒ array of `d`. Paired strokes transform
 * into each other; a stroke left over is erased along its length and a new one is drawn, one after
 * another (when both happen, what leaves goes first). `pairs` forces which strokes pair; `origin:
 * 'middle'` draws and erases from the stroke's middle (a menu's middle line) instead of its start.
 */
export function morpher(from, to, { pairs: forced, origin = 'start' } = {}) {
  const strokes = (icon) => icon.d.flatMap(toCubics);
  const { matched, gone, born } = pair(strokes(from), strokes(to), forced);
  const tweens = matched.map(([a, b]) => {
    if (straight(a) && straight(b)) {
      const turning = turn(a.segs[0], b.segs[0]);
      return (t) => out(turning(t), false);
    }
    const [sa, sb] = correspond(a, b);
    return (t) => {
      const e = inOut(t);
      return out(sa.map((s, i) => s.map((v, k) => v + (sb[i][k] - v) * e)), a.closed && b.closed);
    };
  });
  const [leave, arrive] = gone.length && born.length ? [0.55, 0.45] : [1, 0];
  return (t) =>
    [
      ...tweens.map((f) => f(t)),
      ...gone.map((s, k) => partial(s, 1 - inOut(stagger(t, 0, leave, gone.length - 1 - k, gone.length)), origin)),
      ...born.map((s, k) => partial(s, inOut(stagger(t, arrive, 1, k, born.length)), origin)),
    ].filter(Boolean);
}

// ── Badges ──
const sameStrokes = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
const sameBase = (a, b) => sameStrokes(a.d, b.d);
const sameBadge = (a, b) => JSON.stringify(a.badge ?? null) === JSON.stringify(b.badge ?? null);
const isOpen = (d) => !/z\s*$/i.test(d.trim());
// A cutout that is a stroke and not an area: open, or there and back (a slash's, a check's)
const strokeLike = (d) => isOpen(d) || toCubics(d).every((s) => Math.abs(area(s.segs)) < 0.05);
function boxCenter(d) {
  const pts = toCubics(d).flatMap((s) => s.segs.flatMap((g) => [g.slice(0, 2), g.slice(6, 8)]));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
/**
 * A badge at `t` of its entrance (0 absent, 1 in place), for render(). A stroke badge (a slash, a
 * second check: open strokes with a cutout that is a stroke too) is drawn along its length and its
 * cutout follows it there and back (no area to fill); any other zooms in from its center with a
 * slight overshoot, strokes and cutout scaling with it (its cutout is an area: a circle, a disc).
 */
function badgeAt(bdg, t) {
  if (t <= 0) return null;
  if (t >= 1) return bdg;
  if (!bdg.kind && bdg.d.every(isOpen) && strokeLike(bdg.knock)) {
    const p = outCubic(t);
    const subs = bdg.d.flatMap(toCubics).map((s) => trim(s.segs, 0, p)).filter((s) => s.length);
    if (!subs.length) return null;
    return { d: subs.map((s) => out(s, false)), knock: subs.map((s) => out([...s, ...reverse({ segs: s }).segs], true)).join('') };
  }
  return { ...bdg, zoom: [outBack(t), ...boxCenter(bdg.knock)] };
}

/**
 * The frames of a transition: t (0–1, linear) ⇒ the inner SVG, drawn by render() with `options`
 * (style, weight, enclosure, size, rtl, id…). `way` comes from transitionOf(). With the base still,
 * the badge takes the whole time; a badge that changes leaves first and the new one arrives after.
 */
export function frames(from, to, way = {}, options = {}) {
  const base = sameBase(from, to) ? null : morpher(from, to, way);
  const swap = Boolean(from.badge && to.badge) && !sameBadge(from, to);
  const [leave, arrive] = swap ? [0.5, 0.5] : base ? [0.6, 0.4] : [1, 0];
  const still = sameBadge(from, to);
  const opts = { ...options, animate: null };
  return (t) => {
    if (t >= 1) return render(to, options);
    let badge = still ? (to.badge ?? null) : null;
    if (!still && to.badge && t >= arrive) badge = badgeAt(to.badge, span(t, arrive, 1));
    if (!still && !badge && from.badge && t < leave) badge = badgeAt(from.badge, 1 - span(t, 0, leave));
    // The morph is drawn in outline (fill pairs swap in, see transitionOf); at 16 px the frame is
    // snapped to the pixel like any icon without its own small drawing
    const icon = base ? { d: base(t), mirror: to.mirror, badge } : { ...to, small: undefined, badge };
    return render(icon, base ? { ...opts, style: 'outline' } : opts);
  };
}

// ── Curated pairs ──
// The common state changes whose strokes transform cleanly into each other, checked frame by frame
// on a sheet (play ↔ pause, sun ↔ moon, heart ↔ star, folder ↔ open, eye ↔ closed, maximize ↔
// minimize were tried and swap in instead: no clean shape halfway). `pairs` fixes which strokes pair when nearness alone would pick wrong; `rotate`: the icon
// turns (a plus is a close turned 45°; a chevron that flips turns 180°). Any other pair swaps in.
export const PAIRS = {
  'menu>close': { morph: true, pairs: [[0, 0], [2, 1]], origin: 'middle' },
  'minus>plus': { morph: true, pairs: [[0, 1]], origin: 'middle' },
  'lock>lock-open': { morph: true },
  'mail>mail-open': { morph: true },
  'toggle-off>toggle-on': { morph: true },
  'volume-off>volume-low': { morph: true, pairs: [[0, 0]] },
  'volume-low>volume-high': { morph: true },
  'volume-high>volume-off': { morph: true, pairs: [[0, 0]] },
  'wifi-low>wifi-medium': { morph: true, origin: 'middle' },
  'wifi-medium>wifi': { morph: true, origin: 'middle' },
  'wifi-low>wifi': { morph: true, origin: 'middle' },
  'flashlight>flashlight-on': { morph: true },
  'expand-vertical>collapse-vertical': { morph: true },
  'expand-horizontal>collapse-horizontal': { morph: true },
  'sidebar-collapse>sidebar-expand': { morph: true },
  'align-left>align-center': { morph: true },
  'align-center>align-right': { morph: true },
  'align-left>align-right': { morph: true },
  'sort-ascending>sort-descending': { morph: true },
  'text-larger>text-smaller': { morph: true },
  'plus>close': { rotate: 45 },
  'chevron-down>chevron-up': { rotate: 180 },
  'chevron-right>chevron-left': { rotate: 180 },
  'chevron-up>chevron-down': { rotate: 180 },
  'chevron-left>chevron-right': { rotate: 180 },
  'arrow-down>arrow-up': { rotate: 180 },
  'arrow-left>arrow-right': { rotate: 180 },
};

/**
 * How to go from one icon to another: { morph, pairs?, origin? }, { rotate } or { replace }.
 * Curated turns first; then two icons with the same base and a different badge (pass `icons` to
 * detect them), in any style; then the curated morphs, in outline only (a fill morph swaps in).
 */
export function transitionOf(from, to, icons, { variant = 'outline' } = {}) {
  const fwd = PAIRS[`${from}>${to}`];
  const way = fwd ?? PAIRS[`${to}>${from}`];
  if (way?.rotate) return { rotate: fwd ? way.rotate : -way.rotate };
  const [a, b] = [icons?.[from], icons?.[to]];
  if (a && b && sameBase(a, b) && !sameBadge(a, b)) return { morph: true };
  if (way?.morph && variant !== 'fill') {
    const pairs = way.pairs && (fwd ? way.pairs : way.pairs.map(([i, j]) => [j, i]));
    return { morph: true, ...(pairs && { pairs }), ...(way.origin && { origin: way.origin }) };
  }
  return { replace: true };
}

// ── Outline ↔ fill ──
// The ink's vertical extent, for where the liquid starts and ends: the strokes and the badge, with
// half the weight; an enclosure spans the canvas
function inkSpan(icon, { weight, enclosure }) {
  if (enclosure) return [2, 22];
  const half = (typeof weight === 'number' ? weight : 1.5) / 2;
  const ys = [...icon.d, ...(icon.badge?.d ?? [])].flatMap(toCubics).flatMap((s) => s.segs.flatMap((g) => [g[1], g[3], g[5], g[7]]));
  return ys.length ? [Math.min(...ys) - half, Math.max(...ys) + half] : [2, 22];
}
const WAVE = 9; // wavelength on the 24 grid: two and a half crests across it
const RISE = 0.6; // the wave's height halfway; flat at the start and at the end
// Where the surface sits at x, for a level (y) and a time
const surface = (level, t, x) => level + RISE * Math.sin(Math.PI * Math.min(1, t * 1.15)) * Math.sin((2 * Math.PI * x) / WAVE + 2 * Math.PI * 1.25 * t);
const fmt = (v) => Math.round(v * 100) / 100;

/**
 * Outline ↔ fill of one icon, t (0–1) ⇒ the inner SVG. The fill rises through the outline like a
 * liquid (or drains out of it), its surface a gentle wave that settles flat as it ends. Each frame is
 * the two drawings render() makes, the outline above the surface and the fill below it (clipped,
 * one color): the fill's cutouts and paper stay exact, and the last frame is the drawing itself. The
 * outline reaches 0.12 below the surface, under the fill, so the seam never shows a lighter line.
 */
export function liquid(icon, rise, options = {}) {
  const id = options.id ?? 'i';
  const opts = { ...options, animate: null };
  const outline = render(icon, { ...opts, style: 'outline', id: `${id}-lo` });
  const fill = render(icon, { ...opts, style: 'fill', id: `${id}-lf` });
  const [top, bottom] = inkSpan(icon, options);
  return (t) => {
    if (t >= 1) return render(icon, { ...options, style: rise ? 'fill' : 'outline' });
    // Sine in and out: it starts at once and settles (the wave is flat at both ends, so the level
    // runs exactly from the ink's bottom to its top)
    const e = (1 - Math.cos(Math.PI * t)) / 2;
    const level = bottom + (top - bottom) * (rise ? e : 1 - e);
    const wave = Array.from({ length: 53 }, (_, k) => [k / 2 - 1, surface(level, t, k / 2 - 1)]);
    const path = (pts) => pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L');
    const below = `M${path(wave)}L25 25L-1 25Z`;
    const above = `M-1 -1L25 -1L${path(wave.map(([x, y]) => [x, y + 0.12]).reverse())}Z`;
    return `<defs><clipPath id="${id}-la"><path d="${above}"/></clipPath><clipPath id="${id}-lb"><path d="${below}"/></clipPath></defs><g clip-path="url(#${id}-la)">${outline}</g><g clip-path="url(#${id}-lb)">${fill}</g>`;
  };
}

/**
 * The transition between two states of a component, { name, slash, style } before and after, drawn
 * with the new state's render `options`. `transition`: 'auto' (transitionOf decides), 'morph' or
 * 'replace'. Returns { way, frame } (frame is null for a turn or a swap), or null if nothing changed.
 * Same icon with the automatic slash toggled: the slash draws itself in, or erases back to the corner;
 * with its style changed, the liquid (an icon without a fill has nothing to change).
 */
export function changeOf(icons, before, after, options = {}, transition = 'auto') {
  const opts = { ...options, animate: null, id: `${options.id ?? 'i'}t` };
  if (before.name === after.name) {
    const icon = icons[after.name];
    if (Boolean(before.slash) !== Boolean(after.slash)) {
      const on = Boolean(after.slash);
      return { way: { morph: true }, frame: (t) => render(icon, { ...opts, slash: on ? outCubic(t) : 1 - outCubic(t) }) };
    }
    const [was, now] = [before.style ?? 'outline', after.style ?? options.style ?? 'outline'];
    if (was === now || icon.fill === false) return null;
    if (transition === 'replace') return { way: { replace: true }, frame: null };
    const rise = now === 'fill';
    return { way: { liquid: rise ? 'rise' : 'drain' }, frame: liquid(icon, rise, { ...opts, style: now, slash: Boolean(after.slash) }) };
  }
  const way = transition === 'morph' ? { morph: true } : transition === 'replace' ? { replace: true } : transitionOf(before.name, after.name, icons, { variant: options.style });
  return { way, frame: way.morph ? frames(icons[before.name], icons[after.name], way, opts) : null };
}

// ── Playing it (browser only) ──
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const running = new WeakMap();
/**
 * Play a change on an <svg> that already shows its final drawing (any framework, or none). A morph
 * hides that drawing, draws the frames in a layer of its own and removes it at the end, so the
 * nodes a framework manages are never rewritten; a turn or a swap animates the <svg> itself. The
 * liquid takes a little longer (560 ms) to settle. Under reduced motion the final drawing just stays.
 */
export function playTransition(svg, { way, frame }, duration = way.liquid ? 560 : 420) {
  running.get(svg)?.();
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!frame) {
    const turn = way.rotate !== undefined;
    const keys = turn ? [{ transform: `rotate(${-way.rotate}deg)` }, { transform: 'rotate(0)' }] : [{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
    svg.animate(keys, { duration: turn ? 380 : 320, easing: EASE });
    return;
  }
  const shown = [...svg.children];
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    layer.remove();
    for (const node of shown) node.style.removeProperty('display');
    running.delete(svg);
  };
  for (const node of shown) node.style.display = 'none';
  layer.innerHTML = frame(0);
  svg.appendChild(layer);
  running.set(svg, stop);
  const start = performance.now();
  const step = (now) => {
    const t = (now - start) / duration;
    if (t >= 1) return stop();
    layer.innerHTML = frame(t);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
