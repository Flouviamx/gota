// Drawing engine for Gota, Flouvia's icons. Everything lives on the 24 × 24 canvas and returns
// the `d` of a path. The usage rules are in DESIGN.md.

/** A number with at most two decimals and no trailing zeros. */
export const f = (n) => {
  const s = (Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const P = (x, y) => `${f(x)} ${f(y)}`;
/**
 * The radius of a half circle between two endpoints that are written rounded: exactly half the
 * chord as written. A half circle whose radius comes out a hair longer than half its chord swings
 * its center off the chord (by 0.12 for a 0.005 excess at r 1.5, by 0.3 at r 9) and two such halves
 * draw a circle as a stadium, in every renderer.
 */
export const halfChord = ([x0, y0], [x1, y1]) => String(Math.round((Math.hypot(Number(f(x1)) - Number(f(x0)), Number(f(y1)) - Number(f(y0))) / 2) * 1000) / 1000);

// Apple-style continuous corner (squircle): Figma's corner smoothing algorithm with a smoothing
// of 0.6. Returns the measurements of a corner of radius r.
function corner(r, s = 0.6) {
  if (r <= 0) return null;
  const p = (1 + s) * r;
  const arc = 90 * (1 - s);
  const L = Math.sin(((arc / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - arc) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L, r };
}

/**
 * Rectangle with continuous corners. `square`: square corners, e.g. ['br'] (the signature: a
 * square bottom-right corner, like the drop in the logomark). Each corner fits its sides: along a
 * side it may take half of it (all of it next to a square corner); when the smoothed corner
 * doesn't fit, the smoothing gives way first and then the radius, as in Figma, so a side never
 * runs backwards (min(w, h) / 3.2 keeps the full smoothing).
 */
export function sq(x, y, w, h, r, { square = [], smoothing = 0.6 } = {}) {
  const k = {};
  const round = (n) => !square.includes(n);
  // Room for each corner along its horizontal and vertical side
  const SIDES = { tl: ['tr', 'bl'], tr: ['tl', 'br'], br: ['bl', 'tr'], bl: ['br', 'tl'] };
  for (const n of ['tl', 'tr', 'br', 'bl']) {
    if (!round(n) || r <= 0) continue;
    const [across, down] = SIDES[n];
    const room = Math.min(round(across) ? w / 2 : w, round(down) ? h / 2 : h);
    k[n] = r >= room ? corner(room, 0) : corner(r, Math.min(smoothing, room / r - 1));
  }
  const p = (n) => (k[n] ? k[n].p : 0);
  const o = [`M${P(x + w - p('tr'), y)}`];
  let t = k.tr;
  if (t) o.push(`c${f(t.a)} 0 ${f(t.a + t.b)} 0 ${f(t.a + t.b + t.c)} ${f(t.d)}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(t.L)} ${f(t.L)}c${f(t.d)} ${f(t.c)} ${f(t.d)} ${f(t.b + t.c)} ${f(t.d)} ${f(t.a + t.b + t.c)}`);
  o.push(`L${P(x + w, y + h - p('br'))}`);
  t = k.br;
  if (t) o.push(`c0 ${f(t.a)} 0 ${f(t.a + t.b)} ${f(-t.d)} ${f(t.a + t.b + t.c)}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(-t.L)} ${f(t.L)}c${f(-t.c)} ${f(t.d)} ${f(-(t.b + t.c))} ${f(t.d)} ${f(-(t.a + t.b + t.c))} ${f(t.d)}`);
  o.push(`L${P(x + p('bl'), y + h)}`);
  t = k.bl;
  if (t) o.push(`c${f(-t.a)} 0 ${f(-(t.a + t.b))} 0 ${f(-(t.a + t.b + t.c))} ${f(-t.d)}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(-t.L)} ${f(-t.L)}c${f(-t.d)} ${f(-t.c)} ${f(-t.d)} ${f(-(t.b + t.c))} ${f(-t.d)} ${f(-(t.a + t.b + t.c))}`);
  o.push(`L${P(x, y + p('tl'))}`);
  t = k.tl;
  if (t) o.push(`c0 ${f(-t.a)} 0 ${f(-(t.a + t.b))} ${f(t.d)} ${f(-(t.a + t.b + t.c))}a${f(t.r)} ${f(t.r)} 0 0 1 ${f(t.L)} ${f(-t.L)}c${f(t.c)} ${f(-t.d)} ${f(t.b + t.c)} ${f(-t.d)} ${f(t.a + t.b + t.c)} ${f(-t.d)}`);
  return `${o.join('')}Z`;
}

/** Circle. */
export const circ = (cx, cy, r) => {
  const R = halfChord([cx - r, cy], [cx + r, cy]);
  return `M${P(cx - r, cy)}A${R} ${R} 0 1 0 ${P(cx + r, cy)}A${R} ${R} 0 1 0 ${P(cx - r, cy)}Z`;
};

/** Dot: a tiny circle that looks solid with the 1.5 stroke (diameter ≈ 2.9). */
export const dot = (x, y, r = 0.7) => circ(x, y, r);

/** The logomark's drop: a circle with a square bottom-right corner (speech bubbles). */
export const drop = (cx, cy, r) =>
  `M${P(cx + r, cy)}V${f(cy + r)}H${f(cx)}A${f(r)} ${f(r)} 0 0 1 ${P(cx - r, cy)}A${f(r)} ${f(r)} 0 0 1 ${P(cx, cy - r)}A${f(r)} ${f(r)} 0 0 1 ${P(cx + r, cy)}Z`;

/** Point on a circle at `deg` degrees (0 = right, 90 = down: clockwise on screen). */
export const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

/** Arc from a0 to a1 degrees (clockwise if a1 > a0). Returns { d, end, tangent }. */
export function arc(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  const rad = (a1 * Math.PI) / 180;
  const dir = sweep ? 1 : -1;
  const R = Math.abs(a1 - a0) === 180 ? halfChord([x0, y0], [x1, y1]) : f(r);
  return { d: `M${P(x0, y0)}A${R} ${R} 0 ${large} ${sweep} ${P(x1, y1)}`, end: [x1, y1], tangent: [-Math.sin(rad) * dir, Math.cos(rad) * dir] };
}

/**
 * Arrowhead at `tip` pointing along `dir` (a vector). `len` = length of each arm (6 on
 * straight arrows, 3.4 on arc arrows), `spread` = half the opening angle in degrees (45).
 */
export function head(tip, dir, len = 6, spread = 45) {
  const n = Math.hypot(dir[0], dir[1]);
  const [ux, uy] = [dir[0] / n, dir[1] / n];
  const armTo = (k) => {
    const c = Math.cos((k * Math.PI) / 180);
    const s = Math.sin((k * Math.PI) / 180);
    return [tip[0] - len * (ux * c - uy * s), tip[1] - len * (ux * s + uy * c)];
  };
  return line(armTo(spread), tip, armTo(-spread));
}

/** Polygon with rounded corners (one radius per corner, or one for all of them). */
export function roundpoly(pts, radius) {
  const n = pts.length;
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = pts[(i - 1 + n) % n];
    const V = pts[i];
    const B = pts[(i + 1) % n];
    const r = rr[i];
    let ux = A[0] - V[0];
    let uy = A[1] - V[1];
    const lu = Math.hypot(ux, uy);
    ux /= lu;
    uy /= lu;
    let vx = B[0] - V[0];
    let vy = B[1] - V[1];
    const lv = Math.hypot(vx, vy);
    vx /= lv;
    vy /= lv;
    const th = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    const t = r ? r / Math.tan(th / 2) : 0;
    const S = [V[0] + ux * t, V[1] + uy * t];
    const E = [V[0] + vx * t, V[1] + vy * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    let seg = `${i === 0 ? 'M' : 'L'}${P(...S)}`;
    if (r) seg += `A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(...E)}`;
    out.push(seg);
  }
  return `${out.join('')}Z`;
}

/** Open polyline through the given points. */
export const line = (...pts) => `M${pts.map((p) => P(...p)).join('L')}`;

/** Rotates a point `deg` degrees around `c`. */
export function rot(p, c, deg) {
  const a = (deg * Math.PI) / 180;
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
}

// ── Directions ──
// A family that points four ways (arrow-up, -down, -left, -right) is drawn once and turned or
// flipped here, so its members share every measurement. Paths come back absolute; arcs stay arcs.
/** Rotates a list of points `deg` degrees around `c` (the center of the canvas by default). */
export const turn = (pts, deg, c = [12, 12]) => pts.map((p) => rot(p, c, deg));

/** Rewrites a path with `map` applied to every point; `arc` adjusts an arc's rotation and sweep. */
function remap(d, map, arc) {
  const out = [];
  let i = 0;
  const space = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const num = () => {
    space();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i.exec(d.slice(i));
    if (!m) throw new Error(`Unreadable path at ${i}: ${d}`);
    i += m[0].length;
    return Number(m[0]);
  };
  // Arc flags are single digits and may be written together ("011")
  const flag = () => {
    space();
    return d[i++];
  };
  let [cur, start, cmd] = [[0, 0], [0, 0], ''];
  for (space(); i < d.length; space()) {
    if (/[a-z]/i.test(d[i])) cmd = d[i++];
    const rel = cmd !== cmd.toUpperCase();
    const at = (x, y) => (rel ? [cur[0] + x, cur[1] + y] : [x, y]);
    const pt = () => at(num(), num());
    const put = (c, ...ps) => out.push(`${c}${ps.map((p) => P(...map(p))).join(' ')}`);
    switch (cmd.toUpperCase()) {
      case 'Z':
        out.push('Z');
        cur = start;
        break;
      case 'M':
        cur = start = pt();
        put('M', cur);
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        cur = pt();
        put('L', cur);
        break;
      case 'H':
        cur = [rel ? cur[0] + num() : num(), cur[1]];
        put('L', cur);
        break;
      case 'V':
        cur = [cur[0], rel ? cur[1] + num() : num()];
        put('L', cur);
        break;
      case 'C': {
        const [a, b, e] = [pt(), pt(), pt()];
        put('C', a, b, e);
        cur = e;
        break;
      }
      case 'S':
      case 'Q': {
        const [a, e] = [pt(), pt()];
        put(cmd.toUpperCase(), a, e);
        cur = e;
        break;
      }
      case 'T':
        cur = pt();
        put('T', cur);
        break;
      case 'A': {
        const [rx, ry, xr, large, sweep] = [num(), num(), num(), flag(), flag()];
        const [r, sw] = arc(xr, sweep);
        cur = pt();
        // A circular arc has no rotation of its own
        out.push(`A${f(rx)} ${f(ry)} ${f(rx === ry ? 0 : r)} ${large} ${sw} ${P(...map(cur))}`);
        break;
      }
      default:
        throw new Error(`Unknown path command ${cmd}: ${d}`);
    }
  }
  return out.join('');
}

/** Rotates a path `deg` degrees around `c` (the center of the canvas by default). */
export const turnPath = (d, deg, c = [12, 12]) => remap(d, (p) => rot(p, c, deg), (r, sweep) => [(((r + deg) % 360) + 360) % 360, sweep]);

/**
 * Mirrors a path across the canvas's vertical axis (`'x'`: left ↔ right) or its horizontal one
 * (`'y'`: up ↔ down); a mirror reverses every arc's sweep.
 */
export const flipPath = (d, axis = 'x', c = 12) =>
  remap(d, ([x, y]) => (axis === 'x' ? [2 * c - x, y] : [x, 2 * c - y]), (r, sweep) => [(360 - r) % 360, sweep === '1' ? '0' : '1']);

/**
 * Pointer (mouse cursor): tip at the top left, a vertical left edge, a 45° diagonal out to the
 * wing and the tail leaving the base toward the bottom right. `tip` is the tip and `s` the scale
 * (1 ≈ 11.4 × 19 of the canvas). Every pointer in the set comes from here.
 */
export function cursor(tip, s = 1) {
  const L = [0, 16.2];
  const W = [11.4, 11.4];
  const u = [W[0] - L[0], W[1] - L[1]];
  const lu = Math.hypot(u[0], u[1]);
  const ub = [u[0] / lu, u[1] / lu];
  const C = [L[0] + u[0] * 0.46, L[1] + u[1] * 0.46];
  const d = [0.38, 0.925];
  // The tail keeps at least 0.8 of inner clearance even when the pointer is scaled down
  const h = Math.max(2.9, 2.3 / s) / 2;
  const N1 = [C[0] - ub[0] * h, C[1] - ub[1] * h];
  const N2 = [C[0] + ub[0] * h, C[1] + ub[1] * h];
  const T1 = [N1[0] + d[0] * 4.8, N1[1] + d[1] * 4.8];
  const T2 = [N2[0] + d[0] * 4.8, N2[1] + d[1] * 4.8];
  const pts = [[0, 0], L, N1, T1, T2, N2, W].map(([x, y]) => [tip[0] + x * s, tip[1] + y * s]);
  // A nearly sharp tip (at a 45° angle a large radius makes it blunt)
  return roundpoly(pts, [0.55, 1, 0.35, 0.8, 0.8, 0.35, 0.9].map((r) => r * s));
}

/**
 * Gear: `n` teeth between radii `ri` and `ro`, its tips and roots rounded (`tip`, `root`). Settings
 * and the `gear` badge.
 */
export function gear(cx, cy, ro, ri, n, tip = 0.7, root = 0.9) {
  const step = 360 / n;
  const dt = step * 0.2;
  const db = step * 0.31;
  const pts = [];
  const rr = [];
  for (let i = 0; i < n; i++) {
    const a = -90 + i * step;
    pts.push(polar(cx, cy, ri, a - db), polar(cx, cy, ro, a - dt), polar(cx, cy, ro, a + dt), polar(cx, cy, ri, a + db));
    rr.push(root, tip, tip, root);
  }
  return roundpoly(pts, rr);
}

// ── Badges ──
// Drawn once, here, and always placed in the same spot: bottom right (center 17.25, 17.25,
// r 4.25) or, for the notification dot, top right. `knock` is the area the engine clears from
// the base icon with a clearance of paper, 1.5 at regular (the base is never trimmed by hand).
const BC = [17.25, 17.25];
const BR = 4.25;
const RING = circ(BC[0], BC[1], BR);
/** Just the `A…` segment of an arc, to chain it inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');
const angle = ([cx, cy], [x, y]) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
const signs = {
  plus: () => [`M${f(BC[0])} ${f(BC[1] - 2)}v4`, `M${f(BC[0] - 2)} ${f(BC[1])}h4`],
  minus: () => [`M${f(BC[0] - 2)} ${f(BC[1])}h4`],
  check: () => [line([BC[0] - 1.9, BC[1] + 0.15], [BC[0] - 0.55, BC[1] + 1.45], [BC[0] + 1.95, BC[1] - 1.3])],
  x: () => [line([BC[0] - 1.45, BC[1] - 1.45], [BC[0] + 1.45, BC[1] + 1.45]), line([BC[0] + 1.45, BC[1] - 1.45], [BC[0] - 1.45, BC[1] + 1.45])],
  // The point is a disc of r + paper/2, a little heavier than the stem, and stands 1 apart at
  // regular (0.7 at light, 1.3 at bold, as the paper thins)
  alert: () => [`M${f(BC[0])} ${f(BC[1] - 2.4)}v2`, circ(BC[0], BC[1] + 2.25, 0.15)],
  info: () => [`M${f(BC[0])} ${f(BC[1] + 0.4)}v2`, circ(BC[0], BC[1] - 2.25, 0.15)],
  // The hook (an arc of r 1.3 that turns down into a short stem) and its point
  question: () => [`M${P(BC[0] - 1.3, BC[1] - 1.3)}${arcTo(BC[0], BC[1] - 1.3, 1.3, 180, 400)}L${P(BC[0], BC[1] - 0.05)}`, circ(BC[0], BC[1] + 2.15, 0.35)],
  clock: () => [line([BC[0], BC[1] - 2.1], [BC[0], BC[1]], [BC[0] + 1.45, BC[1] + 0.85])],
  // Blocked: the diagonal crosses the whole disc, from edge to edge
  block: () => [line(polar(BC[0], BC[1], BR, 225), polar(BC[0], BC[1], BR, 45))],
  'arrow-up': () => [`M${f(BC[0])} ${f(BC[1] + 2.1)}V${f(BC[1] - 2)}`, line([BC[0] - 1.75, BC[1] - 0.25], [BC[0], BC[1] - 2], [BC[0] + 1.75, BC[1] - 0.25])],
  'arrow-down': () => [`M${f(BC[0])} ${f(BC[1] - 2.1)}V${f(BC[1] + 2)}`, line([BC[0] - 1.75, BC[1] + 0.25], [BC[0], BC[1] + 2], [BC[0] + 1.75, BC[1] + 0.25])],
  'arrow-right': () => [`M${f(BC[0] - 2.1)} ${f(BC[1])}H${f(BC[0] + 2)}`, line([BC[0] + 0.25, BC[1] - 1.75], [BC[0] + 2, BC[1]], [BC[0] + 0.25, BC[1] + 1.75])],
  'arrow-left': () => [`M${f(BC[0] + 2.1)} ${f(BC[1])}H${f(BC[0] - 2)}`, line([BC[0] - 0.25, BC[1] - 1.75], [BC[0] - 2, BC[1]], [BC[0] - 0.25, BC[1] + 1.75])],
  star: () => [roundpoly(Array.from({ length: 10 }, (_, i) => polar(BC[0], BC[1] + 0.25, i % 2 ? 1.05 : 2.55, -90 + i * 36)), 0.2)],
};

// Glyph badges: the drawing itself is the badge, with no ring (a magnifier, a heart, the sync
// arrows, a pencil, a gear). Unlike the status badges they keep the icon's style, outline or fill.
// All but the pencil clear the status badges' circle, so the base is cut the same under any of
// them and a pair like file-plus ↔ file-search only swaps the badge. First drawn in rounds 1 and 2
// (archivos, comunicación, datos, sistema) and moved here for the whole set.
/** Heart: two lobes that cross at the top and two tangents that run down to the point. */
function heart([cx, cy], r = 2.25, a = 1.6, h = 4.25) {
  const tipPt = [cx, cy + h];
  const lobe = (c, side) => angle(c, tipPt) + (side * Math.acos(r / Math.hypot(tipPt[0] - c[0], tipPt[1] - c[1])) * 180) / Math.PI;
  const cl = [cx - a, cy];
  const cr = [cx + a, cy];
  const top = [cx, cy - Math.sqrt(r * r - a * a)];
  const [t1, t2] = [lobe(cl, 1), lobe(cr, -1)];
  return `M${P(...tipPt)}L${P(...polar(...cl, r, t1))}${arcTo(...cl, r, t1, angle(cl, top) + 360)}${arcTo(...cr, r, angle(cr, top), t2 + 360)}Z`;
}
/**
 * The area the sync badge clears: its arrowheads reach past the ring, so it is the ring's hull
 * with them (the ring and their corners beyond it, joined by tangents). The base keeps a clearance
 * of paper from the whole glyph at every weight and its cut edge stays one smooth curve.
 */
function ringHull(ds) {
  const out = ds
    .flatMap((d) => d.match(/-?[\d.]+/g).map(Number).flatMap((v, i, a) => (i % 2 ? [] : [[v, a[i + 1]]])))
    .filter((p) => Math.hypot(p[0] - BC[0], p[1] - BC[1]) > BR)
    .map((p) => ({ p, a: angle(BC, p), w: (Math.acos(BR / Math.hypot(p[0] - BC[0], p[1] - BC[1])) * 180) / Math.PI }))
    .sort((u, v) => u.a - v.a);
  let s = `M${P(...polar(...BC, BR, out[0].a - out[0].w))}`;
  out.forEach((q, i) => {
    const next = out[(i + 1) % out.length];
    s += `L${P(...q.p)}L${P(...polar(...BC, BR, q.a + q.w))}${arcTo(...BC, BR, q.a + q.w, next.a - next.w + (i === out.length - 1 ? 360 : 0))}`;
  });
  return `${s}Z`;
}
const glyphs = {
  // Magnifier: the lens on the badge circle (r 3.25) and the handle toward the corner; filled, the
  // lens is solid and the handle stays a line, attached to it
  search: () => {
    const lens = circ(BC[0], BC[1], 3.25);
    const [p, end] = [polar(BC[0], BC[1], 3.25, 45), [21.25, 21.25]];
    const handle = line(p, end);
    return { d: [lens, handle], knock: `${RING}M${P(...p)}L${P(...end)}Z`, fill: { solid: [lens], wire: [handle] } };
  },
  // It clears the whole circle, so no bits of the base are left next to its point
  heart: () => {
    const h = heart([BC[0], 16.25]);
    return { d: [h], knock: RING, fill: { solid: [h] } };
  },
  // Two arc arrows on a circle of r 3.75, turned 6° so the upper arrowhead lies level with the
  // top of the ring; in the fill they stay lines
  sync: () => {
    const a = arc(BC[0], BC[1], 3.75, 211, 331);
    const b = arc(BC[0], BC[1], 3.75, 31, 151);
    const heads = [head(a.end, a.tangent, 2.4), head(b.end, b.tangent, 2.4)];
    return { d: [a.d, heads[0], b.d, heads[1]], knock: ringHull(heads) };
  },
  // Pencil at 45°, its tip at the bottom left and its band 2.4 from the rounded end; it clears its
  // own body. Filled: the body is solid and the band is cut out
  edit: () => {
    const [tip, len, hw] = [[12.5, 21], 10.5, 1.5];
    const at = (s, o) => [tip[0] + (s + o) * Math.SQRT1_2, tip[1] + (o - s) * Math.SQRT1_2];
    const R = halfChord(at(len, -hw), at(len, hw));
    const body = `M${P(...tip)}L${P(...at(2.6, -hw))}L${P(...at(len, -hw))}A${R} ${R} 0 0 1 ${P(...at(len, hw))}L${P(...at(2.6, hw))}Z`;
    const band = line(at(len - 2.4, -hw), at(len - 2.4, hw));
    return { d: [body, band], knock: body, fill: { solid: [body], cut: [band] } };
  },
  // Six teeth the size of the ring, the hole a dot
  gear: () => {
    const g = gear(BC[0], BC[1], BR, 3.05, 6, 0.45, 0.55);
    const hole = dot(BC[0], BC[1]);
    return { d: [g, hole], knock: RING, fill: { solid: [g], cut: [hole] } };
  },
};
/** A glyph badge keeps the icon's style; any other standard badge is solid in every style. */
export const glyphBadge = (kind) => Object.hasOwn(glyphs, kind);

/**
 * Standard badge. In a circle at the bottom right: plus, minus, check, x, alert, info, question,
 * clock, block, arrow-up, arrow-down, arrow-right, arrow-left, star. Glyphs without a circle,
 * bottom right: search, heart, sync, edit, gear. Also lock (a padlock, bottom right) and dot
 * (notification dot, top right). Returns { kind, d, knock, fill }; with { size: 16 } (or
 * automatically when rendering at ≤ 18 px) it returns its pixel version: no ring, a larger sign.
 */
export function badge(kind, { size } = {}) {
  if (size && size <= 18) return badge16(kind);
  return { kind, ...badge24(kind) };
}

function badge24(kind) {
  if (kind === 'dot') {
    // A solid disc at every weight (render fills it): a ring around a dot would open at light weights
    const d = [circ(18.75, 5.25, 2)];
    return { d, knock: d[0], fill: { solid: d } };
  }
  if (kind === 'lock') {
    const d = [sq(13.5, 16.25, 7.5, 5.5, 1.6, { square: ['br'] }), 'M15.1 16.25v-1.4a2.15 2.15 0 0 1 4.3 0v1.4'];
    return { d, knock: sq(13.5, 12.7, 7.5, 9.05, 2.4, { square: ['br'] }), fill: { solid: [d[0]], wire: [d[1]] } };
  }
  if (glyphs[kind]) return glyphs[kind]();
  if (!signs[kind]) throw new Error(`Unknown badge: ${kind}`);
  const marks = signs[kind]();
  // Filled: a solid circle with the sign knocked out
  return { d: [RING, ...marks], knock: RING, fill: { solid: [RING], cut: marks } };
}

// ── Badges at 16 px ──
// At 16 px the r 4.25 ring measures 5.7 px and the sign clogs up: as in SF Symbols, the badge
// drops the ring and keeps the sign, larger and on the pixel grid (at 16 px one pixel is 1.5 of
// the canvas and pixel centers fall on 0.75 + 1.5k). The cleared area is still the ring's, plus
// the sign's. Designed for the round 2 categories (archivos, comercio, datos), then moved into the
// engine for the whole set.
const PX = (k) => 0.75 + 1.5 * k;
const AT = (dx, dy) => [PX(11 + dx), PX(11 + dy)];
const SIGN16 = {
  plus: () => [line(AT(0, -2), AT(0, 2)), line(AT(-2, 0), AT(2, 0))],
  minus: () => [line(AT(-2, 0), AT(2, 0))],
  check: () => [line(AT(-2, 0), AT(0, 2), AT(3, -1))],
  x: () => [line(AT(-2, -2), AT(2, 2)), line(AT(2, -2), AT(-2, 2))],
  alert: () => [line(AT(0, -3), AT(0, 0)), circ(...AT(0, 2), 0.1)],
  info: () => [line(AT(0, 0), AT(0, 3)), circ(...AT(0, -2), 0.1)],
  // The hook through pixel centers and a one-pixel point
  question: () => [line(AT(-2, -2), AT(-1, -3), AT(1, -3), AT(2, -2), AT(0, 0), AT(0, 1)), circ(...AT(0, 3), 0.1)],
  'arrow-up': () => [line(AT(0, 2), AT(0, -2)), line(AT(-2, 0), AT(0, -2), AT(2, 0))],
  'arrow-down': () => [line(AT(0, -2), AT(0, 2)), line(AT(-2, 0), AT(0, 2), AT(2, 0))],
  'arrow-right': () => [line(AT(-2, 0), AT(2, 0)), line(AT(0, -2), AT(2, 0), AT(0, 2))],
  'arrow-left': () => [line(AT(2, 0), AT(-2, 0)), line(AT(0, -2), AT(-2, 0), AT(0, 2))],
  star: () => [roundpoly([AT(0, -3), AT(1, -1), AT(3, -1), AT(1.5, 0.5), AT(2, 3), AT(0, 1.5), AT(-2, 3), AT(-1.5, 0.5), AT(-3, -1), AT(-1, -1)], 0.3)],
  heart: () => [roundpoly([AT(-2, -1), AT(-1, -2), AT(0, -1), AT(1, -2), AT(2, -1), AT(2, 0), AT(0, 2), AT(-2, 0)], 0.35)],
  // The lens of r 3 at the badge's pixel, crisp on all four sides
  search: () => [circ(BC[0], BC[1], 3), line(polar(BC[0], BC[1], 3, 45), AT(3, 3))],
  sync: () => [
    `M${P(...AT(-3, 0))}A3 3 0 0 1 ${P(...AT(0, -2))}H${f(PX(13))}`,
    line(AT(1, -3), AT(2, -2), AT(1, -1)),
    `M${P(...AT(3, 0))}A3 3 0 0 1 ${P(...AT(0, 2))}H${f(PX(9))}`,
    line(AT(-1, 3), AT(-2, 2), AT(-1, 1)),
  ],
  // The pencil on the pixel diagonal: tip, 2-pixel cone, body and band
  edit: () => [roundpoly([AT(-3, 3), AT(-3, 1), AT(1, -3), AT(3, -1), AT(-1, 3)], [0.3, 0.3, 0.6, 0.6, 0.3]), line(AT(0, -2), AT(2, 0))],
  // Eight teeth, not six: on the pixel grid they fall symmetric and the gear reads in both styles
  gear: () => [gear(BC[0], BC[1], 4.6, 3.45, 8, 0.2, 0.3), circ(BC[0], BC[1], 0.1)],
};
// Filled at 16 px: the closed shapes go solid with their inner marks cut out; line signs stay lines
const FILL16 = {
  star: (d) => ({ solid: d }),
  heart: (d) => ({ solid: d }),
  search: (d) => ({ solid: [d[0]], wire: [d[1]] }),
  edit: (d) => ({ solid: [d[0]], cut: [d[1]] }),
  gear: (d) => ({ solid: [d[0]], cut: [d[1]] }),
};
function badge16(kind) {
  if (kind === 'clock' || kind === 'block') {
    // Their sign is the circle itself: a face of 6 pixels, its hands or its bar cut out
    const face = circ(BC[0], BC[1], 4.5);
    const marks = kind === 'clock' ? [line(AT(0, -2), AT(0, 0), AT(1, 1))] : [line(AT(-2, -2), AT(2, 2))];
    return { kind, d: [face, ...marks], knock: face, fill: { solid: [face], cut: marks } };
  }
  if (kind === 'dot') return { kind, ...badge24(kind) };
  if (kind === 'lock') {
    // The pixel padlock: a 4 × 3 pixel body with the signature corner and a 2 pixel shackle
    const body = sq(PX(9), PX(11), 6, 4.5, 1.2, { square: ['br'] });
    const shackle = `M${f(PX(10))} ${f(PX(11))}V${f(PX(10))}A1.5 1.5 0 0 1 ${f(PX(12))} ${f(PX(10))}V${f(PX(11))}`;
    return { kind, d: [body, shackle], knock: sq(13.5, 12.7, 7.5, 9.05, 2.4, { square: ['br'] }), fill: { solid: [body], wire: [shackle] } };
  }
  if (!SIGN16[kind]) throw new Error(`Unknown badge: ${kind}`);
  const d = SIGN16[kind]();
  return { kind, d, knock: `${RING}${d.join('')}`, ...(FILL16[kind] && { fill: FILL16[kind](d) }) };
}
