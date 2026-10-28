// Ropa y moda (clothing and fashion): tops, outerwear, bottoms, dresses, underwear and swimwear,
// footwear, hats, eyewear, accessories, jewelry, sewing and fabrics, uniforms and the wardrobe.
// Everything is computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md.
// Garments are drawn from the front, flat and symmetric as a product photo's outline (one half
// drawn, the other mirrored); footwear from the side, toe to the right. The shirt and the hanger are
// comercio's, adopted here: the shirt-* and hanger-* icons build on their drawings.
import { arc, badge, circ, dot, f, flipPath, halfChord, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** The point mirrored across the canvas's vertical axis. */
const M = (p) => [24 - p[0], p[1]];
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/**
 * A bow: two triangular wings `w` wide and `h` tall meeting at their points under a knot (a dot).
 * Each wing's incircle keeps a radius of at least 1.35, so its hole stays open at every weight.
 * Returns its strokes and the area it clears.
 */
function bow([cx, cy], w, h) {
  const wing = (s) => roundpoly([[cx, cy], [cx + s * w, cy - h / 2], [cx + s * w, cy + h / 2]], [0, 0.9, 0.9]);
  const knock = roundpoly([[cx - w, cy - h / 2], [cx, cy - 1.45], [cx + w, cy - h / 2], [cx + w, cy + h / 2], [cx, cy + 1.45], [cx - w, cy + h / 2]], [0.9, 0.5, 0.9, 0.9, 0.5, 0.9]);
  return { d: [wing(-1), wing(1), dot(cx, cy)], knock };
}
/** Ellipse with semi-axes rx, ry (four cubics), as hogar's. */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}
/** Water drop, its point up (lugares' droplet): the circle (c, r) and the point √2·r above it. */
function droplet([cx, cy], r) {
  const a = polar(cx, cy, r, -45);
  const b = polar(cx, cy, r, -135);
  return `M${pt(a)}A${f(r)} ${f(r)} 0 1 1 ${pt(b)}L${pt([cx, cy - r * Math.SQRT2])}Z`;
}
/** The points of a pinked (zigzag) edge from x0 to x1 at `y`, `n` teeth `h` deep (valleys up). */
function pinked(x0, x1, y, h, n) {
  const out = [];
  for (let i = 0; i <= 2 * n; i++) out.push([x0 + ((x1 - x0) * i) / (2 * n), i % 2 ? y : y - h]);
  return out;
}
/** A polygon (or polyline) as dashes `dash` long with gaps `gap` between their ends, each dash a polyline. */
function dashPoly(pts, dash, gap, closed = true) {
  const P = closed ? [...pts, pts[0]] : pts;
  const segs = [];
  let total = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const L = len(sub(P[i + 1], P[i]));
    segs.push({ a: P[i], b: P[i + 1], s: total, L });
    total += L;
  }
  const at = (s) => {
    const q = segs.find((g) => s <= g.s + g.L + 1e-9) ?? segs[segs.length - 1];
    return lerp(q.a, q.b, (s - q.s) / q.L);
  };
  const n = Math.max(1, Math.round(total / (dash + gap)));
  const step = total / n;
  const d = step - gap;
  const out = [];
  for (let i = 0; i < n; i++) {
    const [s0, s1] = [i * step, i * step + d];
    const pts2 = [at(s0), ...segs.filter((g) => g.s > s0 && g.s < s1).map((g) => g.a), at(s1)];
    out.push(line(...pts2));
  }
  return out;
}
/** The segment of the line through P and Q that lies inside a polygon (its first and last crossings). */
function clip(P, Q, poly) {
  const ts = [];
  for (let i = 0; i < poly.length; i++) {
    const [A, B] = [poly[i], poly[(i + 1) % poly.length]];
    const r = sub(Q, P);
    const s2 = sub(B, A);
    const den = r[0] * s2[1] - r[1] * s2[0];
    if (Math.abs(den) < 1e-9) continue;
    const AP = sub(A, P);
    const t = (AP[0] * s2[1] - AP[1] * s2[0]) / den;
    const u = (AP[0] * r[1] - AP[1] * r[0]) / den;
    if (u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  return line(lerp(P, Q, ts[0]), lerp(P, Q, ts[ts.length - 1]));
}
/** A band: two concentric circles, the inner one drawn the other way round so a fill keeps its hole. */
function annulus([cx, cy], R, r) {
  const inner = `M${pt([cx + r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx - r, cy])}A${f(r)} ${f(r)} 0 1 1 ${pt([cx + r, cy])}Z`;
  return `${circ(cx, cy, R)}${inner}`;
}
// ── Sampling a path ──
// Points along a path, one list per subpath: to find where a stroke meets an outline, and to carry a
// fill's cut that ends on the silhouette past it (DESIGN.md: a cut goes through or stops short).
function samplePath(d, step = 0.2) {
  const toks = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const subs = [];
  let [i, cmd, cur, start, ctrl, seg] = [0, '', [0, 0], [0, 0], null, null];
  const num = () => Number(toks[i++]);
  const curve = (at, L) => {
    const n = Math.max(2, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) seg.push(at(k / n));
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd !== cmd.toUpperCase();
    const P = () => {
      const p = [num(), num()];
      return rel ? add2(cur, p) : p;
    };
    const C = cmd.toUpperCase();
    if (C === 'M') {
      cur = start = P();
      seg = [cur];
      subs.push(seg);
      cmd = rel ? 'l' : 'L';
      ctrl = null;
    } else if (C === 'Z') {
      curve((t) => lerp(cur, start, t), len(sub(start, cur)));
      cur = start;
      ctrl = null;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      const q = C === 'L' ? P() : C === 'H' ? [rel ? cur[0] + num() : num(), cur[1]] : [cur[0], rel ? cur[1] + num() : num()];
      const a = cur;
      curve((t) => lerp(a, q, t), len(sub(q, a)));
      cur = q;
      ctrl = null;
    } else if (C === 'C' || C === 'S') {
      const a = cur;
      const c1 = C === 'C' ? P() : ctrl ? sub(mul(a, 2), ctrl) : a;
      const c2 = P();
      const b = P();
      const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * a[k] + 3 * t * (1 - t) ** 2 * c1[k] + 3 * t * t * (1 - t) * c2[k] + t ** 3 * b[k]);
      curve(at, len(sub(c1, a)) + len(sub(c2, c1)) + len(sub(b, c2)));
      cur = b;
      ctrl = c2;
    } else if (C === 'Q') {
      const a = cur;
      const c = P();
      const b = P();
      curve((t) => [0, 1].map((k) => (1 - t) ** 2 * a[k] + 2 * t * (1 - t) * c[k] + t * t * b[k]), len(sub(c, a)) + len(sub(b, c)));
      cur = b;
      ctrl = c;
    } else if (C === 'A') {
      let [rx, ry] = [num(), num()];
      num();
      const [large, sweep] = [num(), num()];
      const b = P();
      const [x1, y1] = cur;
      const [hx, hy] = [(x1 - b[0]) / 2, (y1 - b[1]) / 2];
      const lam = (hx * hx) / (rx * rx) + (hy * hy) / (ry * ry);
      if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
      const nm = rx * rx * ry * ry - rx * rx * hy * hy - ry * ry * hx * hx;
      const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, nm / (rx * rx * hy * hy + ry * ry * hx * hx)));
      const [cx, cy] = [co * ((rx * hy) / ry) + (x1 + b[0]) / 2, co * (-(ry * hx) / rx) + (y1 + b[1]) / 2];
      const t1 = Math.atan2((y1 - cy) / ry, (x1 - cx) / rx);
      let dt = Math.atan2((b[1] - cy) / ry, (b[0] - cx) / rx) - t1;
      if (sweep && dt < 0) dt += 2 * Math.PI;
      if (!sweep && dt > 0) dt -= 2 * Math.PI;
      curve((t) => [cx + rx * Math.cos(t1 + t * dt), cy + ry * Math.sin(t1 + t * dt)], Math.abs(dt) * Math.max(rx, ry));
      cur = b;
      ctrl = null;
    } else throw new Error(`samplePath: ${cmd}`);
  }
  return subs;
}
/** The y where a path crosses the vertical at x: the lowest crossing (`'max'`) or the highest. */
function yAt(d, x, pick = 'max') {
  const ys = [];
  for (const ps of samplePath(d, 0.05)) for (let k = 1; k < ps.length; k++) {
    const [a, b] = [ps[k - 1], ps[k]];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) ys.push(a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]));
  }
  return pick === 'max' ? Math.max(...ys) : Math.min(...ys);
}
/** The x where a path crosses the horizontal at y: the rightmost crossing (`'max'`) or the leftmost. */
function xAt(d, y, pick = 'max') {
  const xs = [];
  for (const ps of samplePath(d, 0.05)) for (let k = 1; k < ps.length; k++) {
    const [a, b] = [ps[k - 1], ps[k]];
    if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
  }
  return pick === 'max' ? Math.max(...xs) : Math.min(...xs);
}
/** An open stroke carried `e0` past its start and `e1` past its end, along its own direction. */
function extend(d, e0, e1) {
  const subs = samplePath(d, 0.05);
  if (subs.length !== 1 || (!e0 && !e1)) return d;
  const ps = subs[0];
  const [a, b] = [ps[0], ps[ps.length - 1]];
  const ta = unit(sub(ps[Math.min(4, ps.length - 1)], a));
  const tb = unit(sub(b, ps[Math.max(0, ps.length - 5)]));
  const rest = d.replace(/^M\s*-?[\d.]+[\s,]+-?[\d.]+/, '');
  return `M${pt(sub(a, mul(ta, e0)))}L${pt(a)}${rest}L${pt(add2(b, mul(tb, e1)))}`;
}
/** Is the point on (within 0.35 of) any of these outlines? */
const onEdge = (p, outlines) => outlines.some((o) => samplePath(o, 0.1).some((ps) => ps.some((q) => len(sub(q, p)) < 0.35)));
/** A fill's cuts, each carried 1 past any end that lies on the silhouette of its solid shapes. */
function throughCuts(cuts, solids, keep = []) {
  return cuts.map((c, i) => {
    if (/[zZ]\s*$/.test(c) || keep.includes(i)) return c;
    const subs = samplePath(c, 0.05);
    if (subs.length !== 1) return c;
    const ps = subs[0];
    return extend(c, onEdge(ps[0], solids) ? 1 : 0, onEdge(ps[ps.length - 1], solids) ? 1 : 0);
  });
}
/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as hogar's. */
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
    const S = add2(V, mul(u, t));
    const E = add2(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}
/**
 * A symmetric outline: the right half from its first point down and round to the hem (one radius
 * per point), the left half its mirror; `close` runs from the left half's last point back to the
 * first (the neckline), or nothing when the first point lies on the axis.
 */
function garment(right, radii, close = '') {
  const rr = Array.isArray(radii) ? radii : right.map(() => radii);
  return `${roundline([...right, ...right.map(M).reverse()], [...rr, ...[...rr].reverse()])}${close}Z`;
}
/**
 * A symmetric closed outline through the axis: `right` runs from a point on the axis down the right
 * side to another point on the axis (one radius per point); the left side mirrors its inner points.
 */
function sympoly(right, radii) {
  const inner = right.slice(1, -1);
  return roundpoly([...right, ...inner.map(M).reverse()], [...radii, ...radii.slice(1, -1).reverse()]);
}
/** A symmetric open stroke: the right half's points mirrored and joined through the axis. */
const symline = (right, radii = 0) => {
  const rr = Array.isArray(radii) ? radii : right.map(() => radii);
  return roundline([...right.map(M).reverse(), ...right], [...[...rr].reverse(), ...rr]);
};

// ── Tops ──────────────────────────────────────────────────────────────────────────────────────
// The tee is comercio's shirt: its neck 6.5 wide on a 4.5 arc, its body 11 wide and 17 tall. Short
// sleeves keep its points; long ones (knits and shirts) run its shoulder out to a sleeve angled 16°,
// 2.75 wide, down to a cuff 3.5 above the hem, over a body 8 wide, so the notch between sleeve and
// body stays open at every weight (2.95 across at the cuff).
const SHIRT = comercio.icons.shirt.d[0];
const HANGER = comercio.icons.hanger.d;
const NECK = 'A4.5 4.5 0 0 0 15.25 3.75';
const TEE = [[15.25, 3.75], [21.25, 7.25], [19.25, 11.5], [17.5, 10.5], [17.5, 20.75]];
const TEE_R = [0, 1.25, 0.9, 0.6, 1.5];
const LS = (() => {
  const S = [18.25, 5.5];
  const C1 = [21.6, 17.25];
  const u = unit(sub(C1, S));
  const n = [-u[1], u[0]];
  const C2 = add2(C1, mul(n, 2.75));
  const bx = 16;
  // The armpit low enough that the notch opens at 25°: a sharper one fills in unevenly at light weights
  const A = [bx, 11.5];
  return { N: [15.25, 3.75], S, C1, C2, A, u, n, bx, hem: 20.75 };
})();
/** A long-sleeved top: `top` is the right half above the shoulder (from the neckline's start). */
const longTop = (top = [LS.N], radii = [0], close = NECK, hem = LS.hem) =>
  garment([...top, LS.S, LS.C1, LS.C2, LS.A, [LS.bx, hem]], [...radii, 1.5, 0.75, 0.75, 1, 1.5], close);
/** A band across a long sleeve, `k` up from its cuff and parallel to it (the right one, then its mirror). */
const cuffBand = (k = 3) => {
  const a = sub(LS.C1, mul(LS.u, k));
  // From the outer edge across the sleeve, along the cuff's direction, to the inner edge (C2 → A)
  const e = unit(sub(LS.A, LS.C2));
  const d = sub(LS.C2, a);
  const det = e[0] * LS.n[1] - e[1] * LS.n[0];
  const t = (LS.n[0] * d[1] - LS.n[1] * d[0]) / det;
  const b = add2(LS.C2, mul(e, t));
  return [line(a, b), line(M(a), M(b))];
};
/** The neckline's lowest point (the arc of r 4.5 between the neck's corners). */
const NECK_Y = 3.75 + 4.5 - Math.sqrt(4.5 ** 2 - 3.25 ** 2);
// Outerwear: the sleeves hang over the body's sides (a coat on its hanger), so the body widens to
// 12.5 under them; the seam where each sleeve lies over it runs up from the cuff and stops short of
// the shoulder. Hip length (jackets): the cuffs reach the hem. Long (coats): the sleeves end 6.5
// above it, so the body visibly runs on below them, as in a coat's product photo.
const outer = (cuff) => {
  const S = [18.5, 5.5];
  const C1 = cuff;
  const u = unit(sub(C1, S));
  const n = [-u[1], u[0]];
  const C2 = add2(C1, mul(n, 3));
  return { N: [15.25, 3.75], S, C1, C2, u, n };
};
const OUT = outer([21.25, 17]);
const LONG = outer([20.75, 14.5]);
/** A coat's outline: `top` above the shoulder, `hem` its length, `flare` how far the hem opens. */
const coat = (top = [OUT.N], radii = [0], close = NECK, hem = 20.75, flare = 0, o = OUT) =>
  garment([...top, o.S, o.C1, o.C2, [o.C2[0] + flare, hem]], [...radii, 1.5, 0.75, 0, 1.5], close);
/** Where the right seam runs at height y. */
const seamX = (y, o = OUT) => o.C2[0] - (o.u[0] * (o.C2[1] - y)) / o.u[1];
/** The seams where the sleeves lie over the body: from the cuff up to `y`. */
const seams = (y = 9.75, o = OUT) => {
  const top = sub(o.C2, mul(o.u, (o.C2[1] - y) / o.u[1]));
  return [line(o.C2, top), line(M(o.C2), M(top))];
};

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};

add('shirt-long-sleeve', ['manga larga', 'playera manga larga', 'camiseta', 'long sleeve', 'long-sleeve tee', 'top'], [longTop()]);
FILL['shirt-long-sleeve'] = { solid: [0] };

// Polo: the tee with a collar: its two points turned down over the neck (the outline's neckline)
// and its band standing behind, and two buttons down the short placket
{
  const collar = [[12, 5.5], [13.6, 7.6], [15.25, 3.75]];
  const body = garment([...collar, ...TEE.slice(1)], [0, 0.5, 0, ...TEE_R.slice(1)]);
  const back = 'M8.75 3.75A4.85 4.85 0 0 1 15.25 3.75';
  add('shirt-polo', ['polo', 'playera tipo polo', 'golf', 'uniforme', 'polo shirt', 'golf shirt', 'staff shirt'], [body, back, dot(12, 10.75), dot(12, 15.25)]);
  FILL['shirt-polo'] = { solid: [0, `${back}${roundline([[15.25, 3.75], [13.6, 7.6], [12, 5.5], [10.4, 7.6], [8.75, 3.75]], [0, 0.5, 0, 0.5, 0])}Z`], cut: [symline(collar, [0, 0.5, 0]), 2, 3] };
}
// V-neck: the tee's neckline as a deep V
add('shirt-v-neck', ['cuello en v', 'playera cuello v', 'escote', 'v-neck', 'v-neck tee', 'neckline'], [garment([[12, 8.75], ...TEE], [0.6, ...TEE_R])]);
FILL['shirt-v-neck'] = { solid: [0] };

// Dress shirt: long sleeves, the collar's two points meeting at the top and the placket running from
// under them to the hem (buttons on it would read as beads on a string)
{
  const collar = [[12, 5.5], [13.6, 7.6], [15.25, 3.75]];
  const body = longTop(collar, [0, 0.5, 0], '');
  const back = 'M8.75 3.75A4.85 4.85 0 0 1 15.25 3.75';
  const placket = vl(12, 10.5, LS.hem);
  add('dress-shirt', ['camisa', 'camisa de vestir', 'formal', 'oficina', 'dress shirt', 'button-up', 'formal wear'], [body, back, placket]);
  FILL['dress-shirt'] = { solid: [0, `${back}${roundline([[15.25, 3.75], [13.6, 7.6], [12, 5.5], [10.4, 7.6], [8.75, 3.75]], [0, 0.5, 0, 0.5, 0])}Z`], cut: [symline(collar, [0, 0.5, 0]), 2] };
}
// Tank top: no sleeves, deep armholes on straps 2.75 wide, a scoop neck
add('tank-top', ['camiseta sin mangas', 'tirantes', 'gimnasio', 'verano', 'tank top', 'sleeveless', 'gym'], [garment([[14, 3.25], [16.75, 3.25], [16.75, 9], [18.75, 11.5], [18.75, 20.75]], [0, 0.6, 2.25, 0.6, 1.5], 'V6.25A2 2 0 0 0 14 6.25')]);
FILL['tank-top'] = { solid: [0] };
// Crop top: the tee cut short and boxy, its hem just under the sleeves
add('crop-top', ['top corto', 'crop top', 'ombliguera', 'ropa deportiva', 'cropped top', 'activewear'], [garment([[15, 6.25], [20.75, 9.5], [19.25, 13], [17.75, 12.25], [17.75, 17.75]], [0, 1.25, 0.9, 0.6, 1.5], 'A4.25 4.25 0 0 0 15 6.25')]);
FILL['crop-top'] = { solid: [0] };
// Camisole: a light top under a V edge, flaring to its hem, on two thin straps
{
  const body = garment([[12, 9.5], [16.25, 7], [16, 12.5], [18.5, 20.75]], [0.6, 0.75, 4, 1.5]);
  const strap = (x) => line([x, 7 + ((16.25 - x) * 2.5) / 4.25], [x + 0.25, 3]);
  add('camisole', ['camisola', 'top de tirantes', 'lencería', 'pijama', 'camisole', 'cami', 'lingerie'], [body, strap(15.25), flipPath(strap(15.25))]);
  FILL.camisole = { solid: [0], wire: [1, 2] };
}
// Blouse: loose, its sleeves puffed and gathered into a band, a bow tied at the neck
{
  // The shoulder runs out to 18.5 before the sleeve puffs, so the bow's clearance crosses it
  // squarely; the bow's wings are tall to keep their holes open
  const body = garment([[15.25, 3.75], [18.5, 5.25], [21.5, 8.5], [20, 12], [17.5, 10.75], [17.75, 20.75]], [0, 0.6, 2.75, 0.75, 0.6, 1.5], NECK);
  const b = bow([12, 7.25], 3.25, 7.25);
  add('blouse', ['blusa', 'blusa con moño', 'oficina', 'mujer', 'blouse', 'bow blouse', 'womenswear'], [body], { badge: { d: b.d, knock: b.knock, fill: { solid: b.d } } });
  FILL.blouse = { solid: [0] };
}
// The hood (hoodie, raincoat): a dome over the shoulders and its opening, 2.85 under its crown
const HOOD = [[12, 1.9], [16.5, 2.6], [17.25, 5.25]];
const HOOD_R = [0, 3, 0.5];
const FACE = 'M9.75 7A2.25 2.25 0 0 1 14.25 7V8A2.25 2.25 0 0 1 9.75 8Z';
// Sweater: the long-sleeved top with ribbed cuffs and hem and a cable down the front
{
  // Ribbed bands at the cuffs and the hem, 3 deep, and the neck's rib: an arc 3 under the neckline
  // (concentric with it) from shoulder to shoulder
  const hem = hl(LS.hem - 3, LS.bx, 24 - LS.bx);
  const c = [12, NECK_Y - 4.5];
  const meet = (() => {
    // Where the circle of r 7.5 round the neck's center crosses the shoulder (N → S)
    const [N, S] = [LS.N, LS.S];
    for (let t = 0; t <= 1; t += 0.0005) {
      const p = lerp(N, S, t);
      if (len(sub(p, c)) >= 7.5) return p;
    }
    return S;
  })();
  const rib = `M${pt(M(meet))}A7.5 7.5 0 0 0 ${pt(meet)}`;
  add('sweater', ['suéter', 'jersey', 'tejido', 'invierno', 'sweater', 'knitwear', 'jumper'], [longTop(), ...cuffBand(), hem, rib]);
  FILL.sweater = { solid: [0], cut: [1, 2, 3, 4] };
}
// Sweatshirt: raglan seams from the neck to the underarms, banded cuffs and hem
{
  const start = [14.25, 0.64 + Math.sqrt(4.5 ** 2 - 2.25 ** 2)];
  const raglan = [line(start, LS.A), line(M(start), M(LS.A))];
  add('sweatshirt', ['sudadera', 'cuello redondo', 'merch', 'casual', 'sweatshirt', 'crewneck', 'merch'], [longTop(), ...raglan, ...cuffBand(), hl(LS.hem - 3, LS.bx, 24 - LS.bx)]);
  FILL.sweatshirt = { solid: [0], cut: [1, 2, 3, 4, 5] };
}
// Turtleneck: slim, its tall collar standing up around the neck
{
  const body = longTop([[12, 1.9], [14.75, 1.9], [15.5, 5.25]], [0, 0.9, 0.5], '');
  add('turtleneck', ['cuello de tortuga', 'cuello alto', 'suéter', 'invierno', 'turtleneck', 'roll neck', 'knitwear'], [body, 'M8.5 5.25A6.63 6.63 0 0 0 15.5 5.25']);
  FILL.turtleneck = { solid: [0], cut: [1] };
}
// Cardigan: open down the front in a V, its buttons on the closing edge
{
  // The V down to mid-chest and two buttons under it, 3.75 apart so they stay apart at every weight
  const body = longTop([[12, 10.5], LS.N], [0.6, 0], '');
  add('cardigan', ['cárdigan', 'chaqueta tejida', 'suéter abierto', 'capas', 'cardigan', 'knit jacket', 'layering'], [body, dot(12, 14), dot(12, 17.75)]);
  FILL.cardigan = { solid: [0], cut: [1, 2] };
}
// Hoodie: the hood behind the neck, its opening, two drawstrings and the kangaroo pocket
{
  const body = longTop(HOOD, HOOD_R, '');
  const pocket = roundline([[LS.bx, 18.75], [13.5, 15.75], [10.5, 15.75], [24 - LS.bx, 18.75]], [0, 1.25, 1.25, 0]);
  // The drawstrings 3 apart, hanging from the opening's lower curve
  const string = (x) => vl(x, 8 + Math.sqrt(2.25 ** 2 - (x - 12) ** 2), 12.5);
  add('hoodie', ['sudadera con capucha', 'hoodie', 'capucha', 'merch', 'hooded sweatshirt', 'streetwear'], [body, FACE, string(10.5), string(13.5), pocket]);
  FILL.hoodie = { solid: [0], cut: [1, 2, 3, 4] };
}

// ── Outerwear ─────────────────────────────────────────────────────────────────────────────────
// Jacket: hip length, a stand collar, the zip down the middle and the waistband across
const STAND = [[12, 2.5], [15, 2.5], [15.25, 4.75]];
{
  const body = coat(STAND, [0, 0.6, 0], '', 19.75);
  add('jacket', ['chaqueta', 'chamarra', 'cierre', 'abrigo ligero', 'jacket', 'zip jacket', 'outerwear'], [body, ...seams(), vl(12, 2.5, 19.75), hl(16.75, 24 - seamX(16.75), seamX(16.75))]);
  FILL.jacket = { solid: [0], cut: [1, 2, 3, 4] };
}
/**
 * A notched lapel: from the neck's corner `top` out to its notch and back to the V's point `low`,
 * the notch `k` out from the middle of the V's edge, so the lapel keeps an open triangle at every
 * weight.
 */
const lapelOf = (low, top = LS.N, k = 3) => {
  const mid = lerp(top, low, 0.5);
  const u = unit(sub(low, top));
  return roundline([top, add2(mid, mul([-u[1], u[0]], -k)), low], [0, 0.5, 0]);
};
// Blazer: notched lapels open over an empty V and one button, 3.5 under the V
{
  const body = coat([[12, 13], LS.N], [0.5, 0], '');
  const lapel = lapelOf([12, 13]);
  add('blazer', ['saco', 'blazer', 'sastre', 'formal', 'sport coat', 'tailoring'], [body, ...seams(13.25), lapel, flipPath(lapel), dot(12, 16.5)]);
  FILL.blazer = { solid: [0], cut: [1, 2, 3, 4, 5] };
}
// Coat: long (the body runs on below the sleeves), notched lapels and two rows of buttons
{
  const body = coat([[12, 11.25], LS.N], [0.5, 0], '', 21.25, 0.75, LONG);
  const lapel = lapelOf([12, 11.25], LS.N, 2.85);
  add('coat', ['abrigo', 'gabán', 'invierno', 'guardarropa', 'coat', 'overcoat', 'coat check'], [body, lapel, flipPath(lapel), dot(10, 14.75), dot(14, 14.75), dot(10, 18.5), dot(14, 18.5)]);
  FILL.coat = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
}
// Leather jacket: short, wide lapels and the zip running across the front on a slant
{
  const body = coat([[12, 10.5], LS.N], [0.5, 0], '', 19.25);
  const lapel = lapelOf([12, 10.5], LS.N, 2.85);
  const zip = line([12, 10.5], [14.75, 19.25]);
  add('leather-jacket', ['chamarra de cuero', 'chaqueta biker', 'motociclista', 'piel', 'leather jacket', 'biker jacket', 'moto'], [body, ...seams(12.25), lapel, flipPath(lapel), zip]);
  // Filled, the zip runs out through the hem but stops at the V, where the lapels' cuts meet
  FILL['leather-jacket'] = { solid: [0], cut: [1, 2, 3, 4, extend(zip, 0, 1)], keep: [4] };
}
// Puffer: the jacket's stand collar, its sleeves on their seams and the body quilted into three
// baffles that bow down between them
{
  const body = coat(STAND, [0, 0.6, 0], '', 20.25);
  const baffle = (y) => {
    const x = seamX(y);
    return `M${pt([24 - x, y])}Q12 ${f(y + 1.5)} ${pt([x, y])}`;
  };
  add('puffer-jacket', ['chamarra acolchada', 'plumífero', 'invierno', 'frío', 'puffer jacket', 'down jacket', 'winter'], [body, ...seams(9.5), baffle(10.25), baffle(13.5)]);
  FILL['puffer-jacket'] = { solid: [0], cut: [1, 2, 3, 4] };
}
// Trench coat: long, V-necked, cinched by a belt between the sleeves and tied off center, its ends
// hanging
{
  const body = coat([[12, 9], LS.N], [0.5, 0], '', 21.25, 1, LONG);
  const y = 12;
  const bx = seamX(y, LONG);
  add('trench-coat', ['gabardina', 'trench', 'abrigo con cinturón', 'lluvia', 'trench coat', 'belted coat', 'raincoat'], [body, ...seams(10, LONG), hl(y, 24 - bx, bx), dot(13.5, y), line([13.5, y], [11.75, 16.5]), line([13.5, y], [14.75, 16.25])]);
  FILL['trench-coat'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
}
// Raincoat: long, the hood up and the zip from the hood's opening to the hem
{
  const body = coat(HOOD, HOOD_R, '', 21.25, 0.75, LONG);
  add('raincoat', ['impermeable', 'chubasquero', 'lluvia', 'capucha', 'raincoat', 'rain jacket', 'rain gear'], [body, FACE, vl(12, 10.25, 21.25)]);
  FILL.raincoat = { solid: [0], cut: [1, 2] };
}
// Vest: a sleeveless waistcoat, V-necked, its buttons down the front and two points at the hem
{
  const body = sympoly([[12, 10], [15.25, 3.75], [17.25, 4.25], [17.25, 8], [18.5, 10.5], [18.5, 17.75], [14.25, 21.25], [12, 20]], [0.5, 0, 0.6, 2, 0.6, 1, 0.75, 0.5]);
  add('vest', ['chaleco', 'chaleco de traje', 'boda', 'mesero', 'vest', 'waistcoat', 'formal wear'], [body, dot(12, 13.25), dot(12, 17)]);
  FILL.vest = { solid: [0], cut: [1, 2] };
}
// Suit: the jacket's lapels open wide from the shoulders down to its V, and the necktie hanging in
// front of them (a piece on top: it clears the V's point behind it), its knot at the top
{
  const low = [12, 14];
  const V = [16.5, 4.45];
  const body = coat([low, V], [0.5, 0], '');
  const knot = dot(12, 5.75);
  const blade = roundline([[11.4, 7.15], [10.6, 14.25], [12, 16], [13.4, 14.25], [12.6, 7.15]], [0, 0.6, 0.6, 0.6, 0]);
  const tie = `${blade}Z`;
  add('suit', ['traje', 'saco y corbata', 'formal', 'negocios', 'suit', 'business attire', 'tailoring'], [body, ...seams(13.5)], {
    badge: { d: [knot, tie], knock: `${circ(12, 5.75, 0.7)}${tie}`, fill: { solid: [knot, tie] } },
  });
  FILL.suit = { solid: [0], cut: [1, 2] };
}
// Robe: long, the wrap crossing over from the left shoulder to the sash, tied at the waist
{
  const body = coat([LS.N], [0], NECK, 21.25, 0.75, LONG);
  const y = 12.5;
  const sx = seamX(y, LONG);
  const wrap = 'M8.75 3.75C9.5 8.25 10.75 10.5 12.5 12.5';
  const inner = line([15.25, 3.75], [xAt(wrap, 8), 8]);
  add('robe', ['bata', 'albornoz', 'spa', 'hotel', 'robe', 'bathrobe', 'dressing gown'], [body, ...seams(10, LONG), wrap, inner, hl(y, 24 - sx, sx), dot(13.5, y), line([13.5, y], [11.75, 16.75]), line([13.5, y], [14.75, 16.5])]);
  FILL.robe = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] };
}

// ── Bottoms ───────────────────────────────────────────────────────────────────────────────────
// The pants: a waistband 2.75 deep across the top, the fly dropping from it to a sharp crotch 7 under
// the top (a third of the way down, as trousers are cut; lower, they read as shorts), and two legs
// down to hems 3 apart. The variants keep the band, the fly and the crotch and change only the legs;
// joggers and leggings are the same build, and the shorts, boxers and swim trunks share their own.
const BAND = 3.25;
const WAIST = 6;
const CROTCH = 10.25;
/** Pants: `leg` is the right leg's outer edge below the hip and its hem, outer then inner. */
// The crotch is a square corner rounded off: the legs' inner edges turn in at 45° just under it, so
// the gap between the legs is a slit 2.5 to 3 wide that stays open at every weight
const pants = (leg, radii, crotch = CROTCH, hip = 17.75) => sympoly([[12, BAND], [hip, BAND], ...leg, [13.25, crotch + 1.25], [12, crotch]], [0, 0.75, ...radii, 1, 0.5]);
/** The waistband across a pair of pants' outline, at height y. */
const band = (body, y = WAIST) => hl(y, xAt(body, y, 'min'), xAt(body, y));
/** The fly, from the waistband down to the crotch. */
const fly = (body) => vl(12, WAIST, yAt(body, 12));
const STRAIGHT = [[18.25, 20.75], [13.5, 20.75]];
/** A pair of pants with its waistband and fly. */
const withBand = (body, ...rest) => [body, band(body), fly(body), ...rest];
add('pants', ['pantalón', 'pantalones', 'recto', 'ropa', 'pants', 'trousers', 'straight leg'], withBand(pants(STRAIGHT, [0.75, 0.75])));
add('pants-skinny', ['pantalón entubado', 'skinny', 'ajustado', 'corte', 'skinny fit', 'slim pants', 'leg shape'], withBand(pants([[17.75, 8], [16.25, 20.75], [13.5, 20.75]], [3, 0.75, 0.75])));
add('pants-wide-leg', ['pantalón ancho', 'palazzo', 'pierna ancha', 'corte', 'wide leg', 'palazzo pants', 'wide trousers'], withBand(pants([[20.75, 20.75], [14, 20.75]], [0.75, 0.75])));
add('pants-flared', ['pantalón acampanado', 'bootcut', 'campana', 'corte', 'flared', 'bootcut', 'flares'], withBand(pants([[17, 14], [19.25, 20.75], [13.5, 20.75], [13.75, 14.25]], [4, 0.75, 0.75, 3])));
// Cargo: the straight pants, roomier in the leg, with a patch pocket on each thigh: its flap the top
// of a U that hangs from the outer seam
{
  const body = pants([[19, 20.75], [13.5, 20.75]], [0.75, 0.75]);
  const pocket = roundline([[xAt(body, 12.25) + 0.3, 12.25], [15.85, 12.25], [15.85, 16.5], [xAt(body, 16.5) + 0.3, 16.5]], [0, 0.6, 0.6, 0]);
  add('pants-cargo', ['pantalón cargo', 'bolsillos', 'trabajo', 'utilitario', 'cargo pants', 'utility', 'workwear'], withBand(body, pocket, flipPath(pocket)));
}
// Jeans: the straight pants with the scooped front pockets from the waistband to the sides
{
  const pocket = 'M8.75 6A3.25 3.25 0 0 1 5.9 9.25';
  const body = pants(STRAIGHT, [0.75, 0.75]);
  add('jeans', ['jeans', 'mezclilla', 'vaqueros', 'denim', 'jeans', 'denim pants', 'casual'], [...withBand(body), pocket, flipPath(pocket)]);
}
// Joggers: an elastic waist tied with a drawstring, relaxed legs (the crotch dropped) gathered into
// cuffs at the ankles
{
  const leg = [[18.75, 11], [17, 18], [17, 20.75], [13.5, 20.75], [13.5, 18]];
  const body = pants(leg, [5, 0, 0.6, 0.6, 0], 11.75);
  add('joggers', ['pants deportivos', 'joggers', 'pants', 'ropa cómoda', 'joggers', 'sweatpants', 'loungewear'], [body, band(body), hl(18, 13.5, 17), hl(18, 7, 10.5), dot(12, WAIST + 0.75), line([12, WAIST + 0.75], [10.4, 9.25]), line([12, WAIST + 0.75], [13.6, 9.25])]);
}
// Leggings: a high, wide waistband and two slim legs to the ankle, no fly
{
  const body = pants([[17.5, 9], [15.75, 20.75], [13.25, 20.75]], [3, 0.6, 0.6], 10.75, 17.5);
  add('leggings', ['leggings', 'mallas', 'yoga', 'deportivo', 'leggings', 'yoga pants', 'activewear'], [body, band(body, 7)]);
}
// The short bottoms (shorts, boxers, swim trunks): the pants' band and crotch 7 under the top, legs
// ending 5.5 below it
const SHORTS = sympoly([[12, 5.25], [17.75, 5.25], [19, 17.75], [13.75, 17.75], [12, 12.25]], [0, 0.75, 0.75, 0.75, 0]);
// Shorts: the waistband and fly over two short legs, the side pockets scooped in
{
  const pocket = 'M8.75 8A3.25 3.25 0 0 1 5.95 11.15';
  add('shorts', ['shorts', 'bermudas', 'pantalón corto', 'verano', 'shorts', 'summer', 'bermuda'], [SHORTS, hl(8, 6.25, 17.75), vl(12, 8, 12.25), pocket, flipPath(pocket)]);
}
// The skirt: a waistband over an A-line that flares to the knee
const SKIRT_BAND = [[12, 3.75], [16.25, 3.75], [16.25, 6.5]];
add('skirt', ['falda', 'falda corte A', 'mujer', 'ropa', 'skirt', 'a-line skirt', 'womenswear'], [sympoly([...SKIRT_BAND, [20, 19.5], [12, 19.5]], [0, 0.75, 0, 1.25, 0]), hl(6.5, 7.75, 16.25)]);
add('skirt-pleated', ['falda plisada', 'tableada', 'uniforme escolar', 'tenis', 'pleated skirt', 'school uniform', 'tennis skirt'], [sympoly([...SKIRT_BAND, [20, 19.5], [12, 19.5]], [0, 0.75, 0, 1.25, 0]), hl(6.5, 7.75, 16.25), line([12, 6.5], [12, 19.5]), line([14.25, 6.5], [16.25, 19.5]), line([9.75, 6.5], [7.75, 19.5])]);
// Pencil: the skirt's waistband over a straight column, rounding out at the hip and narrowing a
// little to the knee, the slit at the back of its hem
add('skirt-pencil', ['falda lápiz', 'falda recta', 'oficina', 'ejecutiva', 'pencil skirt', 'straight skirt', 'office wear'], [sympoly([...SKIRT_BAND, [17.25, 11.5], [16, 20.5], [12, 20.5]], [0, 0.75, 0, 4.5, 1, 0]), hl(6.5, 7.75, 16.25), vl(12, 17.25, 20.5)]);
{
  const hem = 'M20.5 20.25C19.25 21.75 17.5 21.75 16.25 20.75C14.75 21.75 13.25 21.75 12 20.75C10.75 21.75 9.25 21.75 7.75 20.75C6.5 21.75 4.75 21.75 3.5 20.25';
  const body = `M12 3.75H15.5A0.75 0.75 0 0 1 16.25 4.5V6.5L20.5 20.25${hem.slice(hem.indexOf('C'))}L7.75 6.5V4.5A0.75 0.75 0 0 1 8.5 3.75Z`;
  add('skirt-long', ['falda larga', 'maxi falda', 'boho', 'verano', 'maxi skirt', 'long skirt', 'boho'], [body, hl(6.5, 7.75, 16.25), line([14, 9.5], [16.25, 20.75]), line([10, 9.5], [7.75, 20.75])]);
}
// Overalls: the bib on two straps buckled at its corners, over the pants' legs
{
  const body = sympoly([[12, 7.25], [15, 7.25], [15, 11], [17.75, 11], [18.25, 20.75], [13.5, 20.75], [12, 15.5]], [0, 0.6, 0, 0.75, 0.75, 0.75, 0.5]);
  add('overalls', ['overol', 'peto', 'pantalón de peto', 'trabajo', 'overalls', 'dungarees', 'bib overalls'], [body, line([15, 7.25], [16.75, 2.75]), line([9, 7.25], [7.25, 2.75]), dot(15, 7.25), dot(9, 7.25), hl(11, 6.25, 17.75)]);
}

// ── Dresses ───────────────────────────────────────────────────────────────────────────────────
// Dress: a fitted bodice on thin straps, the waist seam, an A-line skirt to the knee
{
  const body = sympoly([[12, 6.5], [15, 6.5], [14.5, 11], [19, 20.75], [12, 20.75]], [0, 0.6, 0, 1.25, 0]);
  add('dress', ['vestido', 'vestido corto', 'fiesta', 'mujer', 'dress', 'occasion wear', 'womenswear'], [body, hl(11, 9.5, 14.5), line([14.5, 6.5], [15.25, 2.75]), line([9.5, 6.5], [8.75, 2.75])]);
}
// Gown: strapless, a sweetheart bodice and a full skirt to the floor, spreading into a train
{
  const body = 'M12 4.75C12.75 3.5 15 3.25 15 5V9.25C18 13 21.5 17.5 21.5 20A1.25 1.25 0 0 1 20.25 21.25H3.75A1.25 1.25 0 0 1 2.5 20C2.5 17.5 6 13 9 9.25V5C9 3.25 11.25 3.5 12 4.75Z';
  add('gown', ['vestido de gala', 'vestido de novia', 'boda', 'gala', 'gown', 'evening gown', 'wedding dress'], [body, hl(9.25, 9, 15)]);
}
// Jumpsuit: a sleeveless top and wide trousers in one piece, belted at the waist
{
  const body = sympoly([[12, 7.5], [14.25, 3], [16.5, 3], [16.5, 7], [17.25, 10.5], [19.25, 20.75], [13.5, 20.75], [12, 14.75]], [0.5, 0.5, 0.5, 2.5, 0, 0.75, 0.75, 0.5]);
  add('jumpsuit', ['enterizo', 'mono', 'jumpsuit', 'overol de mujer', 'jumpsuit', 'romper', 'one-piece'], [body, band(body, 10), band(body, 13)]);
}

// ── Underwear and swimwear ────────────────────────────────────────────────────────────────────
// Briefs: the waistband across the top, the leg openings curving up to the crotch
{
  const body = sympoly([[12, 6.5], [19.75, 6.5], [19.75, 10.5], [14, 17.5], [12, 17.5]], [0, 0.75, 0.6, 1.5, 0]);
  add('underwear', ['ropa interior', 'calzón', 'trusa', 'básicos', 'underwear', 'briefs', 'basics'], [body, hl(9.25, 4.25, 19.75)]);
}
// Boxers: the short bottoms on a deep elastic band, the front panel curving from it down to the
// crotch
{
  const panel = 'M9.5 9.25V10.5C9.5 11.75 10.5 12.25 12 12.25';
  add('boxers', ['bóxer', 'calzoncillo', 'ropa interior', 'hombre', 'boxers', 'boxer shorts', 'underwear'], [SHORTS, band(SHORTS, 9.25), panel, flipPath(panel)]);
}

// Bra: two rounded cups on the band beneath them, a strap rising from each
{
  const cup = 'M4.25 15C4.25 11.5 6.5 9 8.5 9C10.5 9 12 11.75 12 15';
  add('bra', ['brasier', 'sostén', 'lencería', 'talla de copa', 'bra', 'lingerie', 'bra size'], [sq(3.25, 15, 17.5, 3, 1.25), cup, flipPath(cup), line([8.25, 9.02], [7.5, 3]), line([15.75, 9.02], [16.5, 3])]);
}
// Sports bra: cropped and wide, on wide straps; through its scoop neck the racerback's straps meet
// behind in a V, and a wide band runs round its hem
add('sports-bra', ['top deportivo', 'brasier deportivo', 'gimnasio', 'yoga', 'sports bra', 'racerback', 'activewear'], [garment([[14.5, 4.5], [17, 4.5], [17, 8.5], [19, 10.75], [19, 18.5]], [0, 0.6, 2, 0.6, 1.5], 'V6.75A2.5 2.5 0 0 0 14.5 6.75'), roundline([[9.5, 4.5], [12, 6.25], [14.5, 4.5]], [0, 0.6, 0]), hl(15.5, 5, 19)]);
// Socks: a pair of crew socks, the one in front a piece on top; ribbed cuffs, heels and toes
{
  const sock = (x, y) => ({
    d: roundpoly([[x, y], [x + 6, y], [x + 6, y + 8.25], [x + 12.75, y + 8.25], [x + 12.75, y + 13.75], [x, y + 13.75]], [0.6, 0.6, 2, 2.75, 2.75, 3.75]),
    cuff: hl(y + 2.75, x, x + 6),
  });
  const back = sock(2.5, 2.75);
  const front = sock(8.25, 7.5);
  add('socks', ['calcetines', 'calcetas', 'par', 'básicos', 'socks', 'pair of socks', 'crew socks'], [back.d, back.cuff], { badge: { d: [front.d, front.cuff], knock: front.d, fill: { solid: [front.d], cut: [front.cuff] } } });
}
// Tights: the waistband and two long slim legs, each ending in a foot turned out
add('tights', ['medias', 'pantimedias', 'mallas', 'calcetería', 'tights', 'pantyhose', 'hosiery'], [sympoly([[12, 2.75], [17, 2.75], [16.25, 16.75], [19.75, 17.75], [20.5, 20.75], [14.25, 20.75], [13.5, 16.75], [12, 10.5]], [0, 0.6, 1, 1.25, 1, 1.75, 0.75, 0.5]), hl(5.5, 7.15, 16.85)]);
// Pajamas: the top folded with its notched collar and buttons, the matching pants folded beside it
{
  const k = 0.72;
  const top = transform(SHIRT, k, 2.25 - 2.75 * k, 2.75 - 3.75 * k);
  const nx = [8.75 * k + 2.25 - 2.75 * k, 15.25 * k + 2.25 - 2.75 * k];
  const collar = roundline([[nx[0], 2.75], [(nx[0] + nx[1]) / 2, 7.25], [nx[1], 2.75]], [0, 0.5, 0]);
  const cx = 17.25;
  const legs = roundpoly([[cx - 4.25, 9], [cx + 4.25, 9], [cx + 4.25, 21.25], [cx + 1.5, 21.25], [cx, 15.25], [cx - 1.5, 21.25], [cx - 4.25, 21.25]], [0.6, 0.6, 0.6, 0.6, 0.4, 0.6, 0.6]);
  add('pajamas', ['pijama', 'ropa de dormir', 'pijamada', 'descanso', 'pajamas', 'sleepwear', 'pyjamas'], [legs, hl(11.75, cx - 4.25, cx + 4.25)], {
    badge: { d: [top, collar, dot((nx[0] + nx[1]) / 2, 11)], knock: top, fill: { solid: [top], cut: [collar, dot((nx[0] + nx[1]) / 2, 11)] } },
  });
}
// Swimsuit: a one-piece with a scoop neck on thin straps and high-cut legs
add('swimsuit', ['traje de baño', 'bañador', 'completo', 'playa', 'swimsuit', 'one-piece', 'swimwear'], [sympoly([[12, 9], [15.5, 5.5], [15, 11.75], [17, 15], [13.25, 20.5], [12, 20.5]], [2.5, 0, 3.5, 1, 1.25, 0]), line([15.5, 5.5], [15.75, 2.5]), line([8.5, 5.5], [8.25, 2.5])]);
// Bikini: two triangle cups on the string tied across, above a bottom tied at the sides
{
  const cup = roundline([[4.25, 10], [7.75, 4], [10.75, 10]], [0, 0.75, 0]);
  const bottom = sympoly([[12, 14], [17.75, 14], [13, 20.25], [12, 20.25]], [0, 0, 1.25, 0]);
  add('bikini', ['bikini', 'traje de baño', 'dos piezas', 'playa', 'bikini', 'two-piece', 'swimwear'], [hl(10, 2.5, 21.5), cup, flipPath(cup), bottom, line([17.75, 14], [20, 16]), line([6.25, 14], [4, 16])]);
}
// Swim trunks: the short bottoms with no fly, the drawstring tied at the waist (its knot hangs just
// under the band, so it never closes the band off at heavy weights)
add('swim-trunks', ['traje de baño', 'short de baño', 'bermuda', 'playa', 'swim trunks', 'board shorts', 'swimwear'], [SHORTS, hl(8, 6.25, 17.75), dot(12, 8.75), line([12, 8.75], [9.25, 11]), line([12, 8.75], [14.75, 11])]);

// ── Footwear ──────────────────────────────────────────────────────────────────────────────────
// From the side, the toe to the right. The sneaker: its heel counter, the collar dipping to the
// tongue, the laces across the instep, the toe cap and a sole 3 thick.
const SNEAKER = roundpoly([[2.75, 19.25], [3.25, 10.75], [8, 12.25], [10.25, 9.25], [15.75, 13.25], [21.25, 15.5], [21.25, 19.25]], [1.5, 1.5, 1.75, 1, 2, 2.25, 1.5]);
const SOLE = hl(16.25, 2.92, 21.25);
/** The laces: short ticks across the instep's edge, half out over it like the crossings of a lace. */
const laces = (P, Q, at, k = 1.25) => {
  const u = unit(sub(Q, P));
  const n = [-u[1], u[0]];
  return at.map((t) => {
    const e = add2(P, mul(u, t));
    return line(sub(e, mul(n, k)), add2(e, mul(n, k)));
  });
};
const TOE = 'M18.25 13.95C17.25 14.5 16.75 15.25 16.75 16.25';
// The laces sit high on the instep, so the badges' clearance never leaves a crumb of one
const SNEAKER_D = [SNEAKER, SOLE, ...laces([10.25, 9.25], [15.75, 13.25], [1, 4]), TOE];
add('sneaker', ['tenis', 'zapatilla', 'calzado deportivo', 'zapatos', 'sneaker', 'trainers', 'shoes'], SNEAKER_D);
add('sneaker-check', ['tenis verificados', 'autenticado', 'original', 'reventa', 'verified sneaker', 'authentic', 'legit check'], SNEAKER_D, { badge: badge('check') });
add('sneaker-clock', ['lanzamiento', 'próximo drop', 'preventa', 'rifa', 'sneaker release', 'drop countdown', 'pre-order'], SNEAKER_D, { badge: badge('clock') });
// High-top: the sneaker's sole and laces, the collar rising over the ankle with a round patch
{
  const shoe = roundpoly([[2.75, 19.25], [3.25, 4.75], [8, 6], [10.25, 4.25], [10.75, 9.75], [15.75, 13.25], [21.25, 15.5], [21.25, 19.25]], [1.5, 1.5, 1.75, 1, 1.5, 2, 2.25, 1.5]);
  add('sneaker-high-top', ['tenis de bota', 'botines', 'básquetbol', 'streetwear', 'high-top sneaker', 'basketball shoe', 'high tops'], [shoe, SOLE, ...laces([10.75, 9.75], [15.75, 13.25], [1.5, 4.5]), TOE, circ(6.25, 10.25, 1.5)]);
}
// The low shoes are drawn on the sneaker's ground (19.25), the heel's back 3 from the left, and raised
// 1.5 so their low mass sits on the canvas's middle.
const LOW = (d) => transform(d, 1, 0, -1.5);
// Dress shoe: long and pointed, the topline dipping to the lacing, whose facing runs down the instep,
// and a block heel standing apart from the sole on a short arch
{
  const shoe = roundpoly([[3, 19.25], [3, 12.75], [9.75, 13.5], [13.75, 14.25], [20.25, 16], [21.75, 19.25], [12.25, 19.25], [9.5, 17.75], [8.25, 17.75], [8, 19.25]], [1, 1.5, 1.5, 2.5, 2.5, 1, 1, 0.75, 0.4, 0.4]);
  add('dress-shoe', ['zapato formal', 'oxford', 'zapato de vestir', 'etiqueta', 'dress shoe', 'oxford', 'formal shoe'], [shoe, line([10.5, yAt(shoe, 10.5, 'min')], [12.5, 16.25])].map(LOW));
}
// Loafer: lower and rounder, flat on the ground, the saddle strap across its vamp
{
  const shoe = roundpoly([[3, 19.25], [3, 13.75], [10, 14.5], [14.5, 14], [20.25, 15.5], [21.5, 19.25]], [1, 1.5, 2, 2.5, 2.5, 1]);
  add('loafer', ['mocasín', 'zapato sin agujetas', 'slip-on', 'casual', 'loafer', 'slip-on', 'moccasin'], [shoe, line([12, yAt(shoe, 12, 'min')], [12.75, 16.25])].map(LOW));
}
// High heel: a pump with a pointed toe, the sole arching up to the heel seat on a stiletto
add('high-heel', ['tacón', 'zapatilla de tacón', 'stiletto', 'noche', 'high heel', 'pump', 'stiletto'], [roundpoly([[21.6, 19], [14.5, 15.25], [4.25, 9.75], [4.25, 13], [14, 19.75], [20.5, 19.75]], [1, 2.5, 1.25, 1, 3, 0.5]), line([5, 13.4], [5.5, 20.75])]);
// Ballet flat: the lowest of the shoes, its topline shallow and its toe round, a small bow at the
// throat (a piece on top)
{
  const b = bow([12.75, 13.25], 4, 5.25);
  add('ballet-flat', ['bailarina', 'flats', 'zapato plano', 'balerina', 'ballet flat', 'flats', 'flat shoe'], [LOW(roundpoly([[3, 19.25], [3, 15.25], [11.5, 16], [15.75, 14.75], [19.5, 15.5], [21.5, 19.25]], [1, 1.25, 2.5, 2, 2.5, 1]))], { badge: { d: b.d, knock: b.knock, fill: { solid: b.d } } });
}
// The footbed of the open shoes: thicker at the heel, its top falling gently to the toe
const FOOTBED = roundpoly([[2.5, 16.25], [21.5, 17], [21.5, 20.25], [2.5, 20.25]], [1.5, 1.25, 1.25, 1.5]);
// Sandal: the footbed, a strap round the ankle and a wide one over the toes, the foot open between
{
  const top = (x) => yAt(FOOTBED, x, 'min');
  add('sandal', ['sandalia', 'huarache', 'verano', 'calzado', 'sandal', 'summer shoes', 'strappy'], [FOOTBED, `M${pt([3.75, top(3.75)])}C3.75 11.5 4.75 9.25 7 9.25S10.25 11.5 10.25 ${f(top(10.25))}`, `M${pt([13.5, top(13.5)])}C13.5 13.75 15 12.5 17 12.5S20.25 13.75 20.25 ${f(top(20.25))}`]);
}
// Flip-flop, from above: the sole and the Y of its strap from the toe post
{
  const sole = `M${pt([7, 7.5])}A5 5 0 0 1 17 7.5C17 11 16.25 13 16.25 17A4.25 4.25 0 0 1 7.75 17C7.75 13 7 11 7 7.5Z`;
  add('flip-flop', ['chancla', 'sandalia de playa', 'alberca', 'verano', 'flip-flop', 'thong sandal', 'beach'], [sole, dot(12, 6.25), line([12, 6.25], [7.6, 12.75]), line([12, 6.25], [16.4, 12.75])]);
}
// Chelsea boot: the elastic gore on the ankle, the pull tab at the back and a block heel
add('boot', ['botín', 'bota chelsea', 'otoño', 'invierno', 'boot', 'chelsea boot', 'ankle boot'], [roundpoly([[4.25, 21], [4, 5.5], [11, 5.5], [11.25, 11.5], [18.5, 14.25], [21.5, 17.75], [21.5, 21], [14, 21], [10.5, 19.25], [9.5, 21]], [0.5, 1, 1, 2.5, 2.5, 2, 1, 1, 1, 0.4]), roundline([[6.25, 5.5], [7.5, 11], [8.75, 5.5]], [0, 1, 0]), vl(5.5, 5.5, 2.5)]);
// Rain boot: a tall smooth shaft to mid-calf, the pull tab and a thick sole
add('rain-boot', ['bota de lluvia', 'bota de hule', 'jardín', 'lluvia', 'rain boot', 'wellington', 'rubber boot'], [roundpoly([[4.25, 21], [3.75, 4.25], [11.75, 4.25], [12, 12.5], [19.25, 14.75], [21.5, 17.5], [21.5, 21]], [0.75, 1, 1, 3, 2.5, 2, 1]), hl(18, 4.09, 21.5), vl(6, 4.25, 2), hl(7.25, 3.84, 11.84)]);
// Slipper: soft, closed over the toes down to the footbed's tip, open at the back, the plush cuff a
// band round its opening
{
  const top = (x) => yAt(FOOTBED, x, 'min');
  const upper = `M${pt([8.5, top(8.5)])}C8.5 13.25 9.75 11.5 12.5 11.5H16C19.5 11.5 21.5 13.5 21.5 ${f(top(21.25))}`;
  add('slipper', ['pantufla', 'zapatilla de casa', 'hotel', 'casa', 'slipper', 'house slipper', 'loungewear'], [FOOTBED, upper, `M${pt([11.5, top(11.5)])}C11.5 14.5 12.25 12.75 13.75 11.75`]);
}

for (const n of ['leggings', 'underwear', 'skirt', 'gown']) FILL[n] = { solid: [0], cut: icons[n].d.slice(1).map((_, i) => i + 1) };
// The pants' fly, filled, runs well out through the crotch (the rounded crotch's ink grows with the
// weight), so the two halves stay apart at every weight
for (const n of ['pants', 'pants-skinny', 'pants-wide-leg', 'pants-flared', 'pants-cargo', 'jeans']) {
  const d = icons[n].d;
  FILL[n] = { solid: [0], cut: [1, extend(d[2], 1, 2), ...d.slice(3).map((_, i) => i + 3)], keep: [1] };
}
Object.assign(FILL, {
  joggers: { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  shorts: { solid: [0], cut: [1, 2, 3, 4] },
  'skirt-pleated': { solid: [0], cut: [1, 2, 3, 4] },
  'skirt-pencil': { solid: [0], cut: [1, 2] },
  'skirt-long': { solid: [0], cut: [1, 2, 3] },
  overalls: { solid: [0, 3, 4], cut: [5], wire: [1, 2] },
  dress: { solid: [0], cut: [1], wire: [2, 3] },
  jumpsuit: { solid: [0], cut: [1, 2] },
  boxers: { solid: [0], cut: [1, 2, 3] },
});

// ── Hats ──────────────────────────────────────────────────────────────────────────────────────
// From the front, on a brim 2.5 deep at its middle.
// Fedora: a pinched crown dented on top, its band, a brim curling up at the edges
{
  const brim = 'M2.5 15Q12 17 21.5 15Q12 22 2.5 15Z';
  const crown = 'M6.5 15.66C6.5 12.5 6.75 9.5 7.75 7.5C8.5 6 9.75 5.75 10.75 6.25L12 7L13.25 6.25C14.25 5.75 15.5 6 16.25 7.5C17.25 9.5 17.5 12.5 17.5 15.66';
  add('hat', ['sombrero', 'fedora', 'accesorios', 'tribly', 'hat', 'fedora', 'trilby'], [brim, crown, hl(12.75, 6.6, 17.4)]);
}
// Cap, from the side: the crown with its button on top and the stiff visor reaching forward
add('baseball-cap', ['gorra', 'cachucha', 'merch', 'sol', 'baseball cap', 'cap', 'merch'], ['M3.25 15.75C3.25 9.75 6.75 6.5 11 6.5C15.25 6.5 17.75 9.75 17.75 15.75H20.25A1.25 1.25 0 0 1 20.25 18.25H14.5C12.75 18.25 11.75 17.25 11.25 15.75Z', hl(15.75, 11.25, 17.75), dot(11, 6.5)]);
// Beanie: a knit dome over its folded cuff, a pompom on top
add('beanie', ['gorro', 'gorro tejido', 'invierno', 'pompón', 'beanie', 'knit hat', 'winter hat'], ['M5 14C5 9 8 6.25 12 6.25S19 9 19 14', circ(12, 4.25, 2), sq(3.5, 14, 17, 6, 2), vl(8.75, 14, 20), vl(15.25, 14, 20)]);
// Sun hat: a low crown with a ribbon band over a wide brim drooping at its edges
{
  // The ribbon halfway up the crown, so both parts of the crown stay open at every weight
  const crown = 'M7.5 13.1C7.5 9 9.25 7 12 7S16.5 9 16.5 13.1';
  add('sun-hat', ['sombrero de sol', 'pamela', 'playa', 'verano', 'sun hat', 'wide brim', 'beach hat'], ['M2 16.75C5 13.5 8.5 12.75 12 12.75S19 13.5 22 16.75C19 15.75 15.5 15.25 12 15.25S5 15.75 2 16.75Z', crown, hl(9.875, xAt(crown, 9.875, 'min'), xAt(crown, 9.875))]);
}
// Bucket hat: a flat-topped crown on straight sides, its short brim sloping down all round
add('bucket-hat', ['sombrero de pescador', 'bucket hat', 'festival', 'pesca', 'bucket hat', 'fisherman hat', 'streetwear'], [roundpoly([[8.5, 6], [15.5, 6], [17, 13.25], [20.75, 17], [12, 18], [3.25, 17], [7, 13.25]], [1.5, 1.5, 0.5, 1, 6, 1, 0.5]), hl(13.25, 7, 17)]);
// Top hat: a tall cylinder crown, the band near its base and a narrow brim
add('top-hat', ['sombrero de copa', 'chistera', 'etiqueta', 'gala', 'top hat', 'black tie', 'formal'], [roundpoly([[7.25, 3], [16.75, 3], [16.25, 15.75], [20, 15.75], [21.5, 17.25], [20, 18.75], [4, 18.75], [2.5, 17.25], [4, 15.75], [7.75, 15.75]], [1, 1, 0, 0.75, 1.25, 0.75, 0.75, 1.25, 0.75, 0]), hl(15.75, 7.75, 16.25), hl(12.75, 7.63, 16.37)]);
// Cowboy hat: a creased crown on a wide brim curling up at both sides
{
  const brim = 'M2 10C3.5 14 7 15.5 12 15.5S20.5 14 22 10C21.75 15.5 17.5 18.75 12 18.75S2.25 15.5 2 10Z';
  const crown = 'M7.25 15.2C7.25 11 7.75 8 9 6.5C9.75 5.5 10.75 5.75 12 6.75C13.25 5.75 14.25 5.5 15 6.5C16.25 8 16.75 11 16.75 15.2';
  add('cowboy-hat', ['sombrero vaquero', 'texana', 'rodeo', 'country', 'cowboy hat', 'western', 'stetson'], [brim, crown]);
}
// Earmuffs: two fluffy muffs, scalloped round, joined by a thin arched band
{
  const muff = (c) => {
    const R = 3.1;
    const pts = Array.from({ length: 11 }, (_, i) => polar(...c, R, -90 + i * 36));
    return `M${pt(pts[0])}${pts.slice(1).map((p) => `A1.2 1.2 0 0 1 ${pt(p)}`).join('')}Z`;
  };
  add('earmuffs', ['orejeras', 'invierno', 'frío', 'accesorios', 'earmuffs', 'ear warmers', 'winter'], [muff([5.75, 15.75]), muff([18.25, 15.75]), 'M5.75 12.65A6.4 6.4 0 1 1 18.25 12.65']);
}

// ── Eyewear ───────────────────────────────────────────────────────────────────────────────────
// From the front: two lenses 7.5 wide either side of the bridge, the temples folded back from their
// outer edges. The variants keep the bridge's place and the temples, and change the lenses.
const TEMPLES = [line([4.5, 10], [2.25, 7.5]), line([19.5, 10], [21.75, 7.5])];
{
  const lens = sq(3, 10, 7.5, 6, 2.25);
  add('glasses', ['lentes', 'anteojos', 'óptica', 'graduados', 'glasses', 'eyeglasses', 'optician'], [lens, flipPath(lens), 'M10.5 11.75A1.5 1.5 0 0 1 13.5 11.75', ...TEMPLES]);
}
{
  const lens = roundpoly([[2.25, 9], [11, 9], [10.25, 16.5], [4, 17]], [0, 0, 1.75, 1.75]);
  add('sunglasses', ['lentes de sol', 'gafas de sol', 'verano', 'protección solar', 'sunglasses', 'shades', 'sun protection'], [hl(9, 2.25, 21.75), lens, flipPath(lens), line([6.25, 13.75], [7.75, 12]), line([16.5, 13.6], [18, 11.9])]);
}
{
  const p = polar(6.75, 12.75, 3.75, -10);
  add('glasses-round', ['lentes redondos', 'armazón redondo', 'óptica', 'vintage', 'round glasses', 'round frames', 'frame shape'], [circ(6.75, 12.75, 3.75), circ(17.25, 12.75, 3.75), `M${pt(p)}A1.6 1.6 0 0 1 ${pt(M(p))}`, line(polar(6.75, 12.75, 3.75, -125), [2.25, 7.5]), line(polar(17.25, 12.75, 3.75, -55), [21.75, 7.5])]);
}
{
  const lens = roundpoly([[2.5, 8.75], [10.5, 10.25], [10.5, 14], [7.75, 16.5], [3.75, 14.5]], [0.5, 1.25, 2, 2.5, 2]);
  add('glasses-cat-eye', ['lentes cat eye', 'ojo de gato', 'armazón', 'retro', 'cat-eye glasses', 'cat eye frames', 'frame shape'], [lens, flipPath(lens), 'M10.5 11.75A1.5 1.5 0 0 1 13.5 11.75']);
}
{
  const lens = roundpoly([[2.75, 9.25], [10.5, 9.25], [10.25, 13.25], [7.25, 17], [3.5, 15]], [1, 0, 3, 3, 3]);
  add('glasses-aviator', ['lentes de aviador', 'aviador', 'gafas', 'piloto', 'aviator glasses', 'aviators', 'frame shape'], [lens, flipPath(lens), hl(9.25, 10.5, 13.5), 'M10.38 13.25A1.65 1.65 0 0 1 13.62 13.25', ...TEMPLES.map((t) => t.replace('M4.5 10', 'M4.5 9.25').replace('M19.5 10', 'M19.5 9.25'))]);
}
// Virtual try-on: the shirt inside the four corner brackets of the camera's frame
{
  const corner = (a, b, c) => roundline([a, b, c], [0, 2.25, 0]);
  const brackets = [corner([2.75, 7.25], [2.75, 2.75], [7.25, 2.75]), corner([16.75, 2.75], [21.25, 2.75], [21.25, 7.25]), corner([21.25, 16.75], [21.25, 21.25], [16.75, 21.25]), corner([7.25, 21.25], [2.75, 21.25], [2.75, 16.75])];
  add('virtual-try-on', ['probador virtual', 'realidad aumentada', 'probar', 'cámara', 'virtual try-on', 'ar fitting', 'try on'], [transform(SHIRT, 0.56, 12 - 12 * 0.56, 12 - 12.25 * 0.56), ...brackets]);
}

// ── Accessories ───────────────────────────────────────────────────────────────────────────────
// Necktie: the knot at the top and the blade widening down to its point
add('necktie', ['corbata', 'formal', 'oficina', 'etiqueta', 'necktie', 'tie', 'business attire'], [roundpoly([[9.75, 2.75], [14.25, 2.75], [13.25, 6.5], [10.75, 6.5]], [0.75, 0.75, 0.5, 0.5]), roundline([[10.85, 6.5], [8.75, 17.25], [12, 21.25], [15.25, 17.25], [13.15, 6.5]], [0, 1, 1, 1, 0])]);
// Bow tie: two wings pinched at the knot in the middle
{
  const wing = roundline([[10.25, 10.5], [3, 7], [3, 17], [10.25, 13.5]], [0, 1.5, 1.5, 0]);
  add('bow-tie', ['moño', 'corbata de moño', 'pajarita', 'etiqueta', 'bow tie', 'black tie', 'formal'], [sq(10.25, 9.5, 3.5, 5, 1.25), wing, flipPath(wing)]);
}
// Scarf: looped once round an empty neck, a thick U, both ends hanging with a fringe at their tips
{
  const loop = 'M4.25 2.75V5.5C4.25 10.25 7.75 13 12 13S19.75 10.25 19.75 5.5V2.75H15.75V5.5C15.75 7.75 14.25 9 12 9S8.25 7.75 8.25 5.5V2.75Z';
  add('scarf', ['bufanda', 'invierno', 'frío', 'accesorios', 'scarf', 'winter', 'muffler'], [loop, roundline([[6.75, yAt(loop, 6.75)], [6.25, 18.5], [10, 18.5], [10.5, yAt(loop, 10.5)]], [0, 0.75, 0.75, 0]), roundline([[13.25, yAt(loop, 13.25)], [14.25, 17.25], [18.75, 16.5], [17.25, yAt(loop, 17.25)]], [0, 0.75, 0.75, 0]), vl(6.6, 18.5, 21), vl(9.65, 18.5, 21), line([14.93, 17.14], [15.3, 19.6]), line([18.07, 16.61], [18.44, 19.07])]);
}
// Gloves: a glove from the back, its four fingers rising to different heights and parted by slits
// down to the knuckles, the thumb out to the side and a cuff at the wrist
{
  const x = (v) => v + 0.5;
  const glove = roundpoly(
    [[x(7.25), 21.25], [x(7.25), 14.25], [x(3.5), 10.5], [x(4.75), 8.75], [x(7.25), 10.5], [x(7.25), 5.25], [x(10.25), 5.25], [x(10.25), 3.75], [x(13.25), 3.75], [x(13.25), 5.25], [x(16.25), 5.25], [x(16.25), 6.75], [x(19.25), 6.75], [x(19.25), 21.25]],
    [1.5, 0.75, 1.25, 1.25, 0.6, 1.25, 0, 1.25, 1.25, 0, 1.25, 0, 1.25, 1.5],
  );
  const slits = [vl(x(10.25), 5.25, 10.25), vl(x(13.25), 5.25, 10.25), vl(x(16.25), 6.75, 10.25)];
  add('gloves', ['guantes', 'invierno', 'par de guantes', 'accesorios', 'gloves', 'winter gloves', 'pair'], [glove, ...slits, hl(17.25, x(7.25), x(19.25))]);
}
// Belt: the buckle's frame and its prong at one end, the strap running from it to a pointed tip,
// two holes along it
{
  const strap = roundline([[9.5, 9], [19.25, 9], [22, 12], [19.25, 15], [9.5, 15]], [0, 1, 1, 1, 0]);
  add('belt', ['cinturón', 'cinto', 'accesorios', 'hebilla', 'belt', 'buckle', 'accessories'], [sq(2.75, 7, 6.75, 10, 2), strap, hl(12, 2.75, 9.5), dot(13.5, 12), dot(17.25, 12)]);
}

// ── Bags ──────────────────────────────────────────────────────────────────────────────────────
// Containers: the square corner at the bottom right, as comercio's bag
// Handbag: a structured trapezoid under an arched handle, its flap closed by a round clasp
{
  const body = roundpoly([[6, 9.25], [18, 9.25], [20.25, 20.75], [3.75, 20.75]], [1.75, 1.75, 0, 2.5]);
  add('handbag', ['bolso', 'bolsa de mano', 'cartera', 'moda', 'handbag', 'purse', 'tote'], [body, 'M8.5 9.25V8A3.5 3.5 0 0 1 15.5 8V9.25', 'M5.27 13C8.5 13 9.5 16 12 16S15.5 13 18.73 13', dot(12, 16)]);
}
// Crossbody: a small bag with its flap and clasp, the long strap rising from it to a point far
// above, as it hangs from a shoulder
{
  const body = sq(4.5, 11, 15, 9.75, 2.25, { square: ['br'] });
  add('crossbody-bag', ['bolso cruzado', 'bandolera', 'bolsa', 'moda', 'crossbody bag', 'shoulder bag', 'messenger'], [body, 'M4.5 13.75C8 13.75 9.5 16.25 12 16.25S16 13.75 19.5 13.75', dot(12, 16.25), roundline([[8.25, 11], [12, 2.75], [15.75, 11]], [0, 1, 0])]);
}
// Tote: an open canvas bag, two tall strap loops rising high above it
add('tote-bag', ['bolsa de tela', 'tote', 'bolsa reutilizable', 'merch', 'tote bag', 'canvas bag', 'reusable bag'], [sq(4, 10, 16, 10.75, 2.25, { square: ['br'] }), 'M7.5 10V5.25A3 3 0 0 1 13.5 5.25V10', 'M10.5 10V5.25A3 3 0 0 1 16.5 5.25V10']);
// Backpack: from the front, a rounded top with its grab loop, the zip's arc and a front pocket
add('backpack', ['mochila', 'morral', 'escuela', 'viaje', 'backpack', 'rucksack', 'everyday carry'], [roundpoly([[4.75, 5], [19.25, 5], [19.25, 20.75], [4.75, 20.75]], [5, 5, 0, 2.5]), 'M10 5V3.75A2 2 0 0 1 14 3.75V5', 'M4.75 12C7 10 9.5 9.25 12 9.25S17 10 19.25 12', roundline([[7.25, 20.75], [7.25, 15.25], [16.75, 15.25], [16.75, 20.75]], [0, 1.75, 1.75, 0])]);
// Clutch: wide and flat, no handle, a curved flap meeting a round clasp at its middle
add('clutch-bag', ['clutch', 'bolso de mano', 'bolso de noche', 'fiesta', 'clutch', 'evening bag', 'purse'], [sq(2.5, 7, 19, 10.5, 3.5, { square: ['br'] }), 'M6.5 7V8A5.5 5.5 0 0 0 17.5 8V7', dot(12, 13.5)]);
// Belt bag: a pouch flat along its top and round below, its zip across it, on a strap that runs
// out from both its sides
{
  const pouch = 'M7.25 8.5H16.75C18 8.5 18.75 9.5 18.5 10.75C17.75 15.25 15.25 18.75 12 18.75S6.25 15.25 5.5 10.75C5.25 9.5 6 8.5 7.25 8.5Z';
  const [l, r] = [xAt(pouch, 12, 'min'), xAt(pouch, 12)];
  const strap = (y) => [hl(y, 2, xAt(pouch, y, 'min')), hl(y, xAt(pouch, y), 22)];
  add('belt-bag', ['riñonera', 'cangurera', 'festival', 'viaje', 'belt bag', 'fanny pack', 'waist bag'], [pouch, `M${pt([l, 12])}Q12 13.5 ${pt([r, 12])}`, ...strap(9.75), ...strap(12.75)]);
}
// Duffel: a long barrel lying on its side, the seams of its round end caps and the carry handle
// arching over its middle
{
  const body = sq(2.25, 10.5, 19.5, 9, 4.5);
  const cap = (x) => {
    const [t, b] = [yAt(body, x, 'min'), yAt(body, x)];
    return `M${pt([x, t])}C${f(x - 1.75)} ${f(t + 2)} ${f(x - 1.75)} ${f(b - 2)} ${pt([x, b])}`;
  };
  add('duffel-bag', ['maleta deportiva', 'bolsa de viaje', 'gimnasio', 'fin de semana', 'duffel bag', 'gym bag', 'weekender'], [body, cap(7.5), flipPath(cap(7.5)), 'M9 10.5V8.5A3 3 0 0 1 15 8.5V10.5']);
}

// ── Jewelry ───────────────────────────────────────────────────────────────────────────────────
// Ring: the band from the front, a faceted gem set on top of it (a piece on top)
{
  const gem = roundpoly([[9.5, 2.75], [14.5, 2.75], [16.75, 5.5], [12, 10.75], [7.25, 5.5]], [0.6, 0.6, 0.6, 0.9, 0.6]);
  add('ring', ['anillo', 'sortija', 'compromiso', 'joyería', 'ring', 'engagement ring', 'jewelry'], [annulus([12, 14.75], 6.5, 3.75)], { badge: { d: [gem, hl(5.5, 7.4, 16.6)], knock: gem, fill: { solid: [gem], cut: [hl(5.5, 7.4, 16.6)] } } });
}
// Ring box: the box's lid open behind it, the ring seated in front
{
  const ringD = [circ(12, 10.75, 3), dot(12, 7.75)];
  add('ring-box', ['estuche de anillo', 'propuesta', 'compromiso', 'regalo', 'ring box', 'proposal', 'engagement'], [sq(3.25, 13, 17.5, 7.75, 2, { square: ['br'] }), sq(4.5, 3, 15, 10, 2)], { badge: { d: ringD, knock: circ(12, 10.5, 3.6), fill: { solid: [ringD[1]], wire: [ringD[0]] } } });
}
// Necklace: a chain falling in a U from the top, a drop pendant at its lowest point
add('necklace', ['collar', 'cadena', 'dije', 'joyería', 'necklace', 'pendant', 'jewelry'], ['M3.5 2.75C3.5 10 7.5 15 12 15S20.5 10 20.5 2.75', droplet([12, 18.25], 2.5)]);
// Earrings: a pair of drops, each on a small hook
{
  const one = ['M6.75 12V5.75A1.75 1.75 0 0 0 3.25 5.75', droplet([6.75, 16.25], 3)];
  add('earrings', ['aretes', 'pendientes', 'aretes largos', 'joyería', 'earrings', 'drop earrings', 'jewelry'], [...one, ...one.map((d) => flipPath(d))]);
}
// Bracelet: an oval of chain seen at an angle, its clasp and a small charm hanging
add('bracelet', ['pulsera', 'brazalete', 'dije', 'joyería', 'bracelet', 'charm bracelet', 'bangle'], [ell([12, 10], 8.75, 5.5), dot(20.75, 10), droplet([12, 18.5], 1.75)]);

// ── Sewing ────────────────────────────────────────────────────────────────────────────────────
// Needle: diagonal, its eye at the top, a thread through it falling in a loose loop
{
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  const T = [3.75, 20.25];
  const at = (s, o = 0) => add2(add2(T, mul(u, s)), mul(n, o));
  const w = 1.4;
  const R = halfChord(at(19.5, -w), at(19.5, w));
  const eye = `M${pt(at(14.5))}L${pt(at(16.25, -w))}L${pt(at(19.5, -w))}A${R} ${R} 0 0 1 ${pt(at(19.5, w))}L${pt(at(16.25, w))}Z`;
  add('sewing-needle', ['aguja', 'aguja con hilo', 'costura', 'arreglos', 'sewing needle', 'needle and thread', 'mending'], [line(T, at(14.5)), eye, `M${pt(at(18, w))}C21.75 9.5 20.75 14.25 17 14.25C13.75 14.25 13 17.25 15 20`]);
}
// Spool: its flanges top and bottom, the thread wound between and a loose end trailing
add('thread-spool', ['carrete de hilo', 'hilo', 'mercería', 'costura', 'thread spool', 'thread', 'notions'], [sq(5, 2.75, 14, 3, 1.5), sq(5, 18.25, 14, 3, 1.5), line([7.25, 5.75], [7.25, 18.25]), line([16.75, 5.75], [16.75, 18.25]), hl(12, 7.25, 16.75), 'M16.75 9C19.25 9 20.75 10.5 20.75 12.5']);
// Pincushion: a round tomato cushion, squat, its segments curving from top to bottom, and two pins
// stuck into it side by side, slanting the same way, their round heads out
{
  const cushion = ell([12, 15], 8.25, 5.75);
  const seg = 'M12 9.25C8.75 11.25 8.75 18.75 12 20.75';
  const top = (x) => yAt(cushion, x, 'min');
  add('pincushion', ['alfiletero', 'alfileres', 'costura', 'manualidades', 'pincushion', 'pins', 'sewing supplies'], [cushion, seg, flipPath(seg), line([12.75, top(12.75)], [16, 3.75]), dot(16, 3.75), line([16.75, top(16.75)], [19.75, 6.5]), dot(19.75, 6.5)]);
}
// Safety pin: closed, lying on the diagonal: the coil a loop wider than the two arms it joins, the
// arms running to the clasp's hood
{
  const rot45 = (d) => turnPath(d, -45);
  const cx = 5.5;
  const k = Math.sqrt(2.25 ** 2 - 1.5 ** 2);
  add('safety-pin', ['seguro', 'imperdible', 'alfiler de seguridad', 'costura', 'safety pin', 'clip', 'attach'], [rot45(circ(cx, 12, 2.25)), rot45(line([cx + k, 10.5], [16.25, 10.5])), rot45(line([cx + k, 13.5], [16.25, 13.5])), rot45(roundpoly([[16.25, 9.25], [19, 9.25], [20.75, 11], [20.75, 13], [19, 14.75], [16.25, 14.75]], [0.6, 1.25, 1, 1, 1.25, 0.6]))]);
}
// Button: its round face and four holes (a rim inside it as well would crowd the holes)
add('sewing-button', ['botón', 'mercería', 'costura', 'prenda', 'sewing button', 'button', 'notions'], [circ(12, 12, 9), dot(10, 10), dot(14, 10), dot(10, 14), dot(14, 14)]);
// Zipper: the slider at the top and its pull tab hanging from it in one piece, and the closed track
// below, its teeth meshing in turn from either side
{
  const pull = roundpoly([[8.75, 2.75], [15.25, 2.75], [14.25, 7], [13.5, 7], [13.5, 12.25], [10.5, 12.25], [10.5, 7], [9.75, 7]], [1, 1, 0.5, 0.4, 1.4, 1.4, 0.4, 0.5]);
  const teeth = [vl(12, 12.25, 21.25), ...[15.25, 18.75].map((y) => hl(y, 9.75, 12)), ...[17, 20.5].map((y) => hl(y, 12, 14.25))];
  add('zipper', ['cierre', 'cremallera', 'zíper', 'mercería', 'zipper', 'zip', 'fastener'], [pull, ...teeth]);
}
// Sewing machine: from the side, the arm over the bed, the needle down to it, the handwheel
// (a piece on top) at the right
{
  const body = roundpoly([[2.75, 20.25], [2.75, 16.75], [15, 16.75], [15, 9.25], [9.5, 9.25], [9.5, 12.5], [5, 12.5], [5, 4.75], [20.75, 4.75], [20.75, 20.25]], [1.25, 1, 1.5, 1.5, 1, 0.75, 0.75, 1.75, 1.75, 1.25]);
  const wheel = circ(19.5, 8, 2.5);
  add('sewing-machine', ['máquina de coser', 'costura', 'sastrería', 'arreglos', 'sewing machine', 'tailoring', 'alterations'], [body, vl(7.25, 12.5, 16.75)], { badge: { d: [wheel], knock: wheel, fill: { solid: [wheel] } } });
}
// Pattern: a sheet (the square corner) with a bodice piece on it in a dashed cutting line
{
  const k = 0.5;
  add('sewing-pattern', ['patrón de costura', 'molde', 'corte', 'a la medida', 'sewing pattern', 'pattern', 'made to measure'], [sq(4.75, 2.75, 14.5, 18.5, 3.5, { square: ['br'] }), transform(SHIRT, k, 12 - 12 * k, 12 - 12.25 * k)]);
}
// Bolt of fabric: the roll lying on its side, a length of cloth hanging from it to a pinked edge
{
  const roll = 'M6.75 3H18A2.5 4.5 0 0 1 18 12H6.75';
  const cloth = roundline([[6.75, 12], [4.5, 20.5], ...pinked(4.5, 20.25, 20.5, 1.25, 5).slice(1, -1), [20.25, 20.5], [18, 12]], 0);
  add('fabric-roll', ['rollo de tela', 'tela', 'textil', 'mercería', 'fabric roll', 'bolt of fabric', 'textile'], [ell([6.75, 7.5], 2.5, 4.5), roll, cloth]);
}
// The swatch: a square sample, its corners round at the top and its bottom edge pinked
const SWATCH_PTS = (top) => [[3.75, top], [20.25, top], ...pinked(20.25, 3.75, 20.5, 1.25, 6)];
const swatch = (top = 3.75) => roundpoly(SWATCH_PTS(top), [2.5, 2.5, ...pinked(20.25, 3.75, 20.5, 1.25, 6).map(() => 0.35)]);
const SWATCH = swatch();
/** A straight line across the swatch, clipped to its outline. */
const across = (P, Q, top = 3.75) => clip(P, Q, SWATCH_PTS(top));
add('fabric-swatch', ['muestra de tela', 'tela', 'material', 'color', 'fabric swatch', 'sample', 'material'], [SWATCH]);
// The stripes leave the pinked edge at its notches, where the line meets it cleanly
add('fabric-striped', ['tela a rayas', 'rayas', 'estampado', 'patrón', 'striped', 'stripes', 'pattern'], [SWATCH, ...[-3.75, 4.5].map((c) => across([-10, c - 10], [30, c + 30]))]);
add('fabric-polka-dot', ['lunares', 'tela de lunares', 'estampado', 'patrón', 'polka dot', 'dots', 'pattern'], [SWATCH, ...[[7.5, 8], [12, 8], [16.5, 8], [9.75, 12.25], [14.25, 12.25], [7.5, 16.25], [12, 16.25], [16.5, 16.25]].map(([x, y]) => dot(x, y))]);
add('fabric-plaid', ['cuadros', 'tela escocesa', 'franela', 'tartán', 'plaid', 'check', 'tartan'], [SWATCH, across([9.25, 0], [9.25, 30]), across([14.75, 0], [14.75, 30]), across([0, 11.5], [30, 11.5])]);
// The fabric as a low band, for its features
const BAND_TOP = 13.5;
const FABRIC = swatch(BAND_TOP);
add('fabric-waterproof', ['impermeable', 'repele el agua', 'tela técnica', 'lluvia', 'waterproof', 'water repellent', 'technical fabric'], [FABRIC, droplet([6.25, 7], 2), 'M10.25 13.5C11 9.75 13.75 8 17.5 8.25', head([17.5, 8.25], [1, 0.07], 2.4)]);
add('fabric-breathable', ['transpirable', 'ventilado', 'tela técnica', 'deportivo', 'breathable', 'moisture wicking', 'airflow'], [FABRIC, ...[7.5, 12, 16.5].map((x) => `M${f(x)} ${f(BAND_TOP)}C${f(x - 1.75)} 11.5 ${f(x + 1.75)} 9.25 ${f(x)} 7.25S${f(x + 1.75)} 3.5 ${f(x)} 2.5`)]);
{
  const band = roundpoly([[7.5, 8.5], [16.5, 8.5], ...pinked(16.5, 7.5, 17.5, 1.25, 3)], [2, 2, ...pinked(16.5, 7.5, 17.5, 1.25, 3).map(() => 0.35)]);
  add('fabric-stretch', ['elástico', 'stretch', 'tela técnica', 'flexible', 'stretch', 'elastane', 'flex'], [band, hl(12.5, 2.5, 7.5), head([2.5, 12.5], [-1, 0], 3), hl(12.5, 16.5, 21.5), head([21.5, 12.5], [1, 0], 3)]);
}
add('fabric-sun-protection', ['protección solar', 'upf', 'tela técnica', 'rayos uv', 'sun protection', 'upf', 'uv protection'], [FABRIC, arc(12, BAND_TOP, 4.25, 180, 360).d, ...[-150, -120, -90, -60, -30].map((a) => line(polar(12, BAND_TOP, 7.1, a), polar(12, BAND_TOP, 9.35, a)))]);
// Cotton: a fluffy boll over its star-shaped calyx, on a short stem
{
  const boll = 'M7.5 13.25A3 3 0 0 1 6.5 7.5A3.25 3.25 0 0 1 12 4.25A3.25 3.25 0 0 1 17.5 7.5A3 3 0 0 1 16.5 13.25';
  const calyx = roundline([[16.5, 13.25], [18.25, 17.5], [14.5, 16], [12, 19.5], [9.5, 16], [5.75, 17.5], [7.5, 13.25]], [0, 0.5, 0.6, 0, 0.6, 0.5, 0]);
  add('cotton', ['algodón', 'algodón orgánico', 'fibra natural', 'material', 'cotton', 'organic cotton', 'natural fiber'], [`${boll}${calyx.replace(/^M[^LA]*/, '')}Z`, hl(13.25, 7.5, 16.5), vl(12, 19.5, 21.75)]);
}
// Leather: a stretched hide, its four limbs reaching out to the corners, a stitch line inset 3
// along its edge in dashes; round each limb's tip, where the inset would fold over itself, it stops
{
  const hide = Array.from({ length: 240 }, (_, i) => {
    const a = i * 1.5;
    return polar(12, 12, 6.25 + 4.5 * ((1 + Math.cos((4 * (a - 45) * Math.PI) / 180)) / 2) ** 4, a);
  });
  const n = hide.length;
  // Each point moved 3 along its inward normal; kept only where it lies a full 3 from the whole edge
  const inset = hide.map((p, i) => {
    const t = unit(sub(hide[(i + 1) % n], hide[(i - 1 + n) % n]));
    return add2(p, mul([t[1], -t[0]], -3));
  });
  const far = (q) => hide.every((p) => len(sub(p, q)) >= 2.97);
  const runs = [];
  let run = [];
  inset.forEach((q, i) => {
    if (far(q)) run.push(q);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
    if (i === n - 1 && run.length) runs.length && !far(inset[0]) ? runs.push(run) : runs[0] ? (runs[0] = [...run, ...runs[0]]) : runs.push(run);
  });
  const stitch = runs.filter((r) => r.length > 4).flatMap((r) => dashPoly(r, 2.25, 3.25, false));
  add('leather', ['cuero', 'piel', 'piel vegana', 'material', 'leather', 'genuine leather', 'vegan leather'], [`M${hide.map(pt).join('L')}Z`, ...stitch]);
}

// ── Uniforms ──────────────────────────────────────────────────────────────────────────────────
// Scrubs: short sleeves and a V-neck on a boxy body, a pocket on the chest
add('scrubs', ['uniforme médico', 'pijama quirúrgica', 'enfermería', 'clínica', 'scrubs', 'medical uniform', 'nurse'], [garment([[12, 9], [15.25, 3.75], [21.25, 7.25], [19.5, 11.25], [18.25, 10.5], [18.25, 20.75]], [0.6, 0, 1.25, 0.9, 0.6, 1.25]), sq(13.25, 12, 3, 3, 0.75)]);
// Chef's jacket: double-breasted, a mandarin collar and two columns of buttons
add('chef-jacket', ['filipina', 'chaqueta de chef', 'cocina', 'restaurante', 'chef jacket', 'kitchen uniform', 'chef coat'], [coat([[12, 2.5], [15, 2.5], [15.25, 4.75]], [0, 0.6, 0], '', 20.75), ...[9, 13.25, 17.5].flatMap((y) => [dot(10, y), dot(14, y)])]);
// Coveralls: one piece, the jacket's stand collar and long sleeves on their seams over the pants'
// legs, the zip from the collar down to the crotch and the belt between the sleeves
{
  const right = [...STAND, OUT.S, [21.25, 14.5]];
  const u = unit(sub(right[4], OUT.S));
  const C2 = add2(right[4], mul([-u[1], u[0]], 3));
  const crotch = 14.75;
  const body = sympoly([...right, C2, [C2[0], 21.25], [13.5, 21.25], [13.25, crotch + 1.25], [12, crotch]], [0, 0.6, 0, 1.5, 0.75, 0, 1.5, 0.75, 1, 0.5]);
  const seam = line(C2, sub(C2, mul(u, (C2[1] - 9.75) / u[1])));
  const sx = xAt(seam, 12.25);
  add('coveralls', ['overol de trabajo', 'mono de trabajo', 'mecánico', 'fábrica', 'coveralls', 'boiler suit', 'workwear'], [body, seam, flipPath(seam), vl(12, 2.5, yAt(body, 12)), hl(12.25, 24 - sx, sx)]);
}
// Jersey: a V-neck, short sleeves with a stripe round each and a band across the chest
{
  const sleeve = [[15.25, 3.75], [21.5, 8], [19.5, 12.25], [17.5, 11]];
  const end = unit(sub(sleeve[2], sleeve[1]));
  const n = [-end[1], end[0]];
  const stripe = clip(add2(sleeve[1], mul(n, 2.75)), add2(sleeve[2], mul(n, 2.75)), sleeve);
  add('jersey', ['camiseta deportiva', 'jersey', 'uniforme', 'equipo', 'jersey', 'team kit', 'sports shirt'], [garment([[12, 8.5], ...sleeve, [17.5, 20.75]], [0.6, 0, 1.25, 0.9, 0.6, 1.5]), stripe, flipPath(stripe), hl(14, 6.5, 17.5), hl(17, 6.5, 17.5)]);
}

// ── The wardrobe ──────────────────────────────────────────────────────────────────────────────
// Outfit: the shirt over a pair of pants, top and bottom together (the pants too small for a band)
const OUTFIT = (() => {
  const k = 0.5;
  const top = transform(SHIRT, k, 12 - 12 * k, 2 - 3.75 * k);
  // The pants' hem at 21, so the plus badge's clearance takes the right leg's inner corner whole
  const bottom = roundpoly([[8, 13.5], [16, 13.5], [16.5, 21], [13.5, 21], [12, 16.75], [10.5, 21], [7.5, 21]], [0.6, 0.6, 0.6, 0.6, 0.4, 0.6, 0.6]);
  return [top, bottom];
})();
add('outfit', ['conjunto', 'look', 'atuendo', 'combinar', 'outfit', 'complete the look', 'wardrobe'], OUTFIT);
add('outfit-plus', ['crear conjunto', 'nuevo look', 'agregar atuendo', 'armario', 'create outfit', 'new look', 'add outfit'], OUTFIT, { badge: badge('plus') });
// Sizes: three shirts growing from small to large on one baseline, the middle one in front
{
  const tee = (k, cx) => transform(SHIRT, k, cx - 12 * k, 17.5 - 20.75 * k);
  const mid = tee(0.42, 10.75);
  add('shirt-sizes', ['tallas', 'guía de tallas', 'chica mediana grande', 'selector de talla', 'sizes', 'size guide', 'size range'], [tee(0.32, 4.75), tee(0.52, 16.75)], { badge: { d: [mid], knock: mid, fill: { solid: [mid] } } });
}
// Measurements: the shirt with a dimension line across its chest
add('shirt-measurements', ['medidas', 'medidas de la prenda', 'pecho', 'largo', 'measurements', 'garment size', 'flat measurements'], [SHIRT, hl(13.5, 6.5, 17.5), head([6.5, 13.5], [-1, 0], 2.4), head([17.5, 13.5], [1, 0], 2.4)]);
// Torn: the shirt with a jagged tear across its chest, clear of its edges
add('shirt-torn', ['prenda rota', 'roto', 'reparación', 'devolución dañada', 'torn shirt', 'damaged', 'repair'], [SHIRT, line([9.5, 12.5], [11.5, 14.25], [12.75, 12], [14.5, 13.5])]);
add('shirt-plus', ['agregar prenda', 'vender ropa', 'publicar', 'armario', 'add garment', 'list item', 'add to closet'], [SHIRT], { badge: badge('plus') });
add('shirt-search', ['buscar similares', 'búsqueda visual', 'comprar el look', 'moda', 'find similar', 'visual search', 'shop the look'], [SHIRT], { badge: badge('search') });
add('shirt-sync', ['intercambio de ropa', 'segunda mano', 'reventa', 'trueque', 'clothing swap', 'resell', 'secondhand'], [SHIRT], { badge: badge('sync') });
add('hanger-clock', ['renta de ropa', 'alquiler', 'fecha de devolución', 'préstamo', 'clothing rental', 'rental period', 'due back'], HANGER, { badge: badge('clock') });
// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// Each icon's own strokes: the garment, bag or shoe solid; its seams, bands, pockets and buttons
// knocked out; straps, strings, handles and pins kept as lines attached to it. Where two filled
// pieces meet (a crown on its brim, a strap's loop on its sole) the edge they share is knocked out
// so they stay two pieces.
{
  const D = (n) => icons[n].d;
  const z = (d) => shut(d);
  Object.assign(FILL, {
    bra: { solid: [0, z(D('bra')[1]), z(D('bra')[2])], cut: [hl(15, 4.25, 19.75)], wire: [3, 4] },
    'sports-bra': { solid: [0], cut: [2], wire: [1] },
    socks: { solid: [0], cut: [1] },
    tights: { solid: [0], cut: [1] },
    pajamas: { solid: [0], cut: [1] },
    swimsuit: { solid: [0], wire: [1, 2] },
    bikini: { solid: [z(D('bikini')[1]), z(D('bikini')[2]), 3], wire: [0, 4, 5] },
    'swim-trunks': { solid: [0], cut: [1, 2, 3, 4] },
    'sneaker-high-top': { solid: [0], cut: [1, 2, 3, 4, 5] },
    'dress-shoe': { solid: [0], cut: [1] },
    loafer: { solid: [0], cut: [1] },
    'high-heel': { solid: [0], wire: [1] },
    'ballet-flat': { solid: [0] },
    sandal: { solid: [0], wire: [1, 2] },
    'flip-flop': { solid: [0], cut: [1, 2, 3] },
    boot: { solid: [0], cut: [1], wire: [2] },
    'rain-boot': { solid: [0], cut: [1, 3], wire: [2] },
    slipper: { solid: [0, z(D('slipper')[1])], cut: [2, line([8.5, yAt(D('slipper')[0], 8.5, 'min')], [21.5, yAt(D('slipper')[0], 21.25, 'min')])] },
    hat: { solid: [0, z(D('hat')[1])], cut: [2] },
    'baseball-cap': { solid: [0, 2], cut: [1] },
    beanie: { solid: [z(D('beanie')[0]), 1, 2], cut: [3, 4, hl(14, 5, 19)] },
    'sun-hat': { solid: [0, z(D('sun-hat')[1])], cut: [2] },
    'bucket-hat': { solid: [0], cut: [1] },
    'top-hat': { solid: [0], cut: [1, 2] },
    'cowboy-hat': { solid: [0, z(D('cowboy-hat')[1])] },
    earmuffs: { solid: [0, 1], wire: [2] },
    glasses: { solid: [0, 1], wire: [2, 3, 4] },
    sunglasses: { solid: [1, 2], cut: [3, 4], wire: [0] },
    'glasses-round': { solid: [0, 1], wire: [2, 3, 4] },
    'glasses-cat-eye': { solid: [0, 1], wire: [2] },
    'glasses-aviator': { solid: [0, 1], wire: [2, 3, 4, 5] },
    'virtual-try-on': { solid: [0], lines: [1, 2, 3, 4] },
    necktie: { solid: [0, z(D('necktie')[1])], cut: [hl(6.5, 10.25, 13.75)] },
    'bow-tie': { solid: [0, z(D('bow-tie')[1]), z(D('bow-tie')[2])], cut: [vl(10.25, 10.25, 13.75), vl(13.75, 10.25, 13.75)] },
    scarf: { solid: [0, z(D('scarf')[1]), z(D('scarf')[2])], cut: [line([6.75, yAt(D('scarf')[0], 6.75)], [10.5, yAt(D('scarf')[0], 10.5)]), line([13.25, yAt(D('scarf')[0], 13.25)], [17.25, yAt(D('scarf')[0], 17.25)])], wire: [3, 4, 5, 6] },
    gloves: { solid: [0], cut: [1, 2, 3, 4] },
    belt: { solid: [0, z(D('belt')[1])], cut: [2, 3, 4, vl(9.5, 9, 15)] },
    handbag: { solid: [0], cut: [2, 3], wire: [1] },
    'crossbody-bag': { solid: [0], cut: [1, 2], wire: [3] },
    'tote-bag': { solid: [0], wire: [1, 2] },
    backpack: { solid: [0], cut: [2, 3], wire: [1] },
    'clutch-bag': { solid: [0], cut: [1, 2] },
    'belt-bag': { solid: [0], cut: [1], wire: [2, 3, 4, 5] },
    'duffel-bag': { solid: [0], cut: [1, 2], wire: [3] },
    ring: { solid: [0] },
    'ring-box': { solid: [0, 1], cut: [hl(13, 3.25, 20.75)] },
    necklace: { solid: [1], wire: [0] },
    earrings: { solid: [1, 3], wire: [0, 2] },
    bracelet: { solid: [1, 2], wire: [0] },
    'sewing-needle': { solid: [1], wire: [0, 2] },
    'thread-spool': { solid: [0, 1, 'M7.25 5.75H16.75V18.25H7.25Z'], cut: [4, hl(5.75, 7.25, 16.75), hl(18.25, 7.25, 16.75)], wire: [5] },
    pincushion: { solid: [0, 4, 6], cut: [1, 2], wire: [3, 5] },
    'safety-pin': { solid: [3], wire: [0, 1, 2] },
    'sewing-button': { solid: [0], cut: [1, 2, 3, 4] },
    zipper: { solid: [0], wire: D('zipper').slice(1).map((_, i) => i + 1) },
    'sewing-machine': { solid: [0], wire: [1] },
    'sewing-pattern': { solid: [0], cut: [1] },
    'fabric-roll': { solid: [0, z(D('fabric-roll')[1]), z(D('fabric-roll')[2])], cut: [hl(12, 6.75, 18), 'M6.75 3A2.5 4.5 0 0 1 6.75 12'], keep: [0, 1] },
    'fabric-swatch': { solid: [0] },
    'fabric-waterproof': { solid: [0, 1], wire: [2, 3] },
    'fabric-breathable': { solid: [0], wire: [1, 2, 3] },
    'fabric-stretch': { solid: [0], wire: [1, 2, 3, 4] },
    'fabric-sun-protection': { solid: [0, z(D('fabric-sun-protection')[1])], lines: [2, 3, 4, 5, 6] },
    cotton: { solid: [0], cut: [1], wire: [2] },
    scrubs: { solid: [0], cut: [1] },
    jersey: { solid: [0], cut: [1, 2, 3, 4] },
    outfit: { solid: [0, 1] },
    'outfit-plus': { solid: [0, 1] },
    'shirt-sizes': { solid: [0, 1] },
    'shirt-measurements': { solid: [0], cut: [1, 2, 3] },
    'shirt-torn': { solid: [0], cut: [1] },
    'hanger-clock': { solid: [0], wire: [1] },
  });
  // Filled, the laces stay ink: they cross the instep's edge, and half a lace cut out of it reads as a nick
  for (const n of ['sneaker', 'sneaker-check', 'sneaker-clock']) FILL[n] = { solid: [0], cut: [1, 4], wire: [2, 3] };
  for (const n of ['fabric-striped', 'fabric-polka-dot', 'fabric-plaid', 'leather', 'chef-jacket']) FILL[n] = { solid: [0], cut: D(n).slice(1).map((_, i) => i + 1) };
  for (const n of ['shirt-plus', 'shirt-search', 'shirt-sync']) FILL[n] = { solid: [0] };
  // The coveralls' zip runs well out through the crotch, as the pants' fly does
  FILL.coveralls = { solid: [0], cut: [1, 2, extend(D('coveralls')[3], 1, 2), 4], keep: [2] };
}

// ── Fill and parts ────────────────────────────────────────────────────────────────────────────
for (const [name, icon] of Object.entries(icons)) {
  const spec = FILL[name];
  if (!spec) {
    icon.fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icon.d[i]));
  const solid = pick(spec.solid);
  icon.fill = { solid, ...(spec.cut && { cut: throughCuts(pick(spec.cut), solid, spec.keep) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
// The custom pieces on top: their cuts too
for (const icon of Object.values(icons)) if (icon.badge && !icon.badge.kind && icon.badge.fill?.cut) icon.badge.fill.cut = throughCuts(icon.badge.fill.cut, icon.badge.fill.solid);
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Named parts ───────────────────────────────────────────────────────────────────────────────
// Every icon with a badge, a piece on top or a gesture names its pieces
Object.assign(PARTS, {
  blouse: { body: [0] },
  socks: { sock: [0], cuff: [1] },
  pajamas: { pants: [0], waistband: [1] },
  'ballet-flat': { shoe: [0] },
  gloves: { glove: [0, 1, 2, 3], cuff: [4] },
  ring: { band: [0] },
  'ring-box': { box: [0], lid: [1] },
  zipper: { slider: [0], teeth: icons.zipper.d.slice(1).map((_, i) => i + 1) },
  'sewing-machine': { body: [0], needle: [1] },
  'shirt-sizes': { small: [0], large: [1] },
  outfit: { top: [0], bottom: [1] },
  'outfit-plus': { top: [0], bottom: [1] },
  'hanger-clock': { body: [0], hook: [1] },
  necktie: { knot: [0], blade: [1] },
  'bow-tie': { knot: [0], wings: [1, 2] },
  necklace: { chain: [0], pendant: [1] },
  earrings: { hooks: [0, 2], drops: [1, 3] },
  bracelet: { chain: [0], clasp: [1], charm: [2] },
  handbag: { bag: [0, 2, 3], handle: [1] },
  'tote-bag': { bag: [0], handles: [1, 2] },
  'sewing-needle': { needle: [0, 1], thread: [2] },
  'safety-pin': { coil: [0], pin: [1, 2], head: [3] },
  'sewing-button': { button: [0], holes: [1, 2, 3, 4] },
  'fabric-waterproof': { fabric: [0], drop: [1], bounce: [2, 3] },
  'fabric-breathable': { fabric: [0], vapor: [1, 2, 3] },
  'fabric-stretch': { fabric: [0], arrows: [1, 2, 3, 4] },
  'fabric-sun-protection': { fabric: [0], sun: [1], rays: [2, 3, 4, 5, 6] },
  beanie: { hat: [0, 2, 3, 4], pompom: [1] },
  hat: { brim: [0], crown: [1, 2] },
  'cowboy-hat': { brim: [0], crown: [1] },
  scarf: { loop: [0], ends: [1, 2, 3, 4, 5, 6] },
});
for (const n of ['sneaker', 'sneaker-check', 'sneaker-clock']) PARTS[n] = { shoe: [0], sole: [1], laces: [2, 3], toe: [4] };
PARTS['sneaker-high-top'] = { shoe: [0], sole: [1], laces: [2, 3], toe: [4], patch: [5] };
for (const n of ['shirt-plus', 'shirt-search', 'shirt-sync']) PARTS[n] = { shirt: [0] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// Already round or framed: the button is its own circle, the try-on its own frame
icons['sewing-button'].variants = { circle: false };
icons['virtual-try-on'].variants = { square: false };
// With a badge or a piece on top (as in comercio): the filled enclosure loses the piece on top,
// at 58 % the sign stops reading, and the slash would cross it with no clearance
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// Rows of buttons 4 apart run together at 16 px: there they sit 4.5 apart, on pixel centers
{
  const dots = (pts) => pts.map(([x, y]) => dot(x, y));
  const quad = dots([[9.75, 9.75], [14.25, 9.75], [9.75, 14.25], [14.25, 14.25]]);
  icons['sewing-button'].small = { d: [icons['sewing-button'].d[0], ...quad], fill: { solid: [icons['sewing-button'].d[0]], cut: quad } };
  const coatDots = dots([[9.75, 15.75], [14.25, 15.75]]);
  const c = icons.coat;
  c.small = { d: [...c.d.slice(0, 3), ...coatDots], fill: { solid: [c.d[0]], cut: [...c.fill.cut.slice(0, 2), ...coatDots] } };
  const chefDots = dots([[9.75, 10.5], [14.25, 10.5], [9.75, 15], [14.25, 15]]);
  const ch = icons['chef-jacket'];
  ch.small = { d: [ch.d[0], ...chefDots], fill: { solid: [ch.d[0]], cut: chefDots } };
}

// ── Mirror ────────────────────────────────────────────────────────────────────────────────────
// Seen from the side, footwear and the cap face forward and flip in right-to-left languages, as
// bebes' strollers and booties do; so does the sewing machine. Garments seen from the front, the
// glasses and the jewelry are symmetric objects and stay as they are
for (const name of ['sneaker', 'sneaker-high-top', 'sneaker-check', 'sneaker-clock', 'dress-shoe', 'loafer', 'high-heel', 'ballet-flat', 'sandal', 'boot', 'rain-boot', 'slipper', 'baseball-cap', 'sewing-machine'])
  icons[name].mirror = true;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// Each one's own gesture: the sneakers step forward, the tie, the pendant, the charm and the bags
// swing from where they hang, the hats tip, the pompom hops, the needle stitches and the machine's
// needle drops, the zipper's slider runs down, vapor rises, the drop bounces off, the sun's rays
// pulse, stretch fabric pulses, and the badges' clock and sync turn
Object.assign(icons.sneaker, { motion: { effect: 'slide', vector: [1.5, 0] } });
Object.assign(icons['sneaker-high-top'], { motion: { effect: 'slide', vector: [1.5, 0] } });
Object.assign(icons.necktie, { motion: { effect: 'ring', origin: [12, 2.75] } });
Object.assign(icons['bow-tie'], { motion: { effect: 'wiggle', origin: [12, 12] } });
Object.assign(icons.necklace, { motion: { effect: 'ring', parts: ['pendant'], origin: [12, 14.75] } });
Object.assign(icons.bracelet, { motion: { effect: 'ring', parts: ['charm'], origin: [12, 15.5] } });
Object.assign(icons.handbag, { motion: { effect: 'ring', origin: [12, 4.5] } });
Object.assign(icons['tote-bag'], { motion: { effect: 'ring', origin: [12, 2.25] } });
Object.assign(icons.hat, { motion: { effect: 'wiggle', origin: [12, 16.5] } });
Object.assign(icons['cowboy-hat'], { motion: { effect: 'wiggle', origin: [12, 17] } });
Object.assign(icons.beanie, { motion: { effect: 'bounce', parts: ['pompom'], vector: [0, -1.25] } });
Object.assign(icons['sewing-needle'], { motion: { effect: 'bounce', parts: ['needle'], vector: [-1.25, 1.25] } });
Object.assign(icons['sewing-machine'], { motion: { effect: 'bounce', parts: ['needle'], vector: [0, 1] } });
Object.assign(icons.zipper, { motion: { effect: 'slide', parts: ['slider'], vector: [0, 2] } });
Object.assign(icons['fabric-breathable'], { motion: { effect: 'float', parts: ['vapor'], vector: [0, -1.25] } });
Object.assign(icons['fabric-waterproof'], { motion: { effect: 'bounce', parts: ['drop'], vector: [0, -1.5] } });
Object.assign(icons['fabric-sun-protection'], { motion: { effect: 'beat', parts: ['rays'], origin: [12, 13.5] } });
Object.assign(icons['fabric-stretch'], { motion: { effect: 'beat', origin: [12, 13] } });
Object.assign(icons['safety-pin'], { motion: { effect: 'wiggle', origin: [12, 12] } });
Object.assign(icons['sewing-button'], { motion: { effect: 'spin', parts: ['holes'], origin: [12, 12] } });
Object.assign(icons.scarf, { motion: { effect: 'wiggle', parts: ['ends'], origin: [12, 12.5] } });
for (const name of ['sneaker-clock', 'hanger-clock', 'shirt-sync']) icons[name].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };

export default { category: 'ropa', label: 'Ropa y moda', icons };
