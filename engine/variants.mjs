// Variants of each icon without redrawing it: weight (continuous), enclosed in a circle or a
// square, slashed, mirrored for right-to-left languages, levels (0–1), a 16 px size snapped to
// the pixel and the extreme frame of its motion. The fill (`fill`) and the 16 px drawing (`small`)
// are drawn in the definition. Everything comes out as the content of an <svg viewBox="0 0 24 24">.
// See DESIGN.md › Fill, Variants and Motion.
import { badge, circ, f, sq } from './geometry.mjs';

/** The set's weights: the drawing is designed for regular. */
export const WEIGHTS = { light: 1, regular: 1.5, bold: 2 };

// ── Transforming a path (uniform scale + translation) ──
const NUMS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function parse(d) {
  const out = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|(-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/g;
  let cmd = null;
  let args = [];
  const flush = () => {
    if (!cmd) return;
    const n = NUMS[cmd.toUpperCase()];
    if (n === 0) out.push([cmd, []]);
    else
      for (let i = 0; i < args.length; i += n) {
        // after M, the following pairs are implicit L commands
        const c = i > 0 && cmd === 'M' ? 'L' : i > 0 && cmd === 'm' ? 'l' : cmd;
        out.push([c, args.slice(i, i + n)]);
      }
    args = [];
  };
  for (const m of d.matchAll(re)) {
    if (m[1]) {
      flush();
      cmd = m[1];
    } else args.push(Number(m[2]));
  }
  flush();
  return out;
}

/**
 * Pixel snapping for 16 px: there the 1.5 stroke is exactly 1 px wide and pixel centers fall on
 * 0.75 + 1.5k of the 24 canvas. Horizontal and vertical segments move to those centers so they
 * look crisp; curves just follow their endpoints.
 */
export function snap(d, step = 1.5, offset = 0.75) {
  return snapper([d], step, offset)(d);
}

/**
 * Pixel snapping for a whole icon: the coordinates that move come from ALL of its paths, and
 * every path moves by the same offsets. That way an arrowhead follows its shaft even when they
 * are separate paths. Dots (circles with r < 1) move to a pixel corner with r 1: they cover
 * 2 × 2 crisp pixels instead of a gray smudge.
 */
export function snapper(list, step = 1.5, offset = 0.75) {
  const S = (v) => Math.round((v - offset) / step) * step + offset;
  const EPS = 0.06;
  const segsOf = (d) => {
    const segs = [];
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    for (const [c, a] of parse(transform(d, 1, 0, 0))) {
      const g = { c, a: [...a], x0: x, y0: y };
      if (c === 'M') [x, y, sx, sy] = [a[0], a[1], a[0], a[1]];
      else if (c === 'L' || c === 'T') [x, y] = a;
      else if (c === 'H') x = a[0];
      else if (c === 'V') y = a[0];
      else if (c === 'C') [x, y] = [a[4], a[5]];
      else if (c === 'S' || c === 'Q') [x, y] = [a[2], a[3]];
      else if (c === 'A') [x, y] = [a[5], a[6]];
      else if (c === 'Z') [x, y] = [sx, sy];
      g.x1 = x;
      g.y1 = y;
      segs.push(g);
    }
    return segs;
  };
  // Coordinates of the axis-aligned straight segments, across all paths
  const xs = [];
  const ys = [];
  for (const d of list) {
    if (asCircle(d)?.r < 1) continue;
    for (const g of segsOf(d)) {
      if (!['L', 'H', 'V', 'Z'].includes(g.c)) continue;
      // A zero-length segment (a circle's closing segment) is neither horizontal nor vertical
      if (Math.hypot(g.x1 - g.x0, g.y1 - g.y0) < EPS) continue;
      if (Math.abs(g.x0 - g.x1) < EPS) xs.push((g.x0 + g.x1) / 2);
      if (Math.abs(g.y0 - g.y1) < EPS) ys.push((g.y0 + g.y1) / 2);
    }
  }
  const dx = (v) => {
    const u = xs.find((k) => Math.abs(k - v) < EPS);
    return u === undefined ? 0 : S(u) - v;
  };
  const dy = (v) => {
    const u = ys.find((k) => Math.abs(k - v) < EPS);
    return u === undefined ? 0 : S(u) - v;
  };
  return (d) => {
    const dot = asCircle(d);
    if (dot && dot.r < 1) {
      const E = (v) => Math.round(v / step) * step;
      return circleD(E(dot.cx), E(dot.cy), 1);
    }
    // Each point moves with its endpoint; a curve's control points move with the endpoint they touch
    return segsOf(d)
      .map(({ c, a, x0, y0, x1, y1 }) => {
        const [ex, ey] = [dx(x1), dy(y1)];
        const [bx, by] = [dx(x0), dy(y0)];
        if (c === 'M' || c === 'L' || c === 'T') return `${c}${f(x1 + ex)} ${f(y1 + ey)}`;
        if (c === 'H') return `H${f(x1 + ex)}`;
        if (c === 'V') return `V${f(y1 + ey)}`;
        if (c === 'C') return `C${f(a[0] + bx)} ${f(a[1] + by)} ${f(a[2] + ex)} ${f(a[3] + ey)} ${f(x1 + ex)} ${f(y1 + ey)}`;
        if (c === 'S' || c === 'Q') return `${c}${f(a[0] + ex)} ${f(a[1] + ey)} ${f(x1 + ex)} ${f(y1 + ey)}`;
        if (c === 'A') return `A${f(a[0])} ${f(a[1])} ${f(a[2])} ${a[3]} ${a[4]} ${f(x1 + ex)} ${f(y1 + ey)}`;
        return 'Z';
      })
      .join('');
  };
}
const circleD = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}Z`;

/** Path converted to absolute coordinates and transformed: p' = p · s + (tx, ty). */
export function transform(d, s, tx, ty) {
  const o = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const X = (v) => f(v * s + tx);
  const Y = (v) => f(v * s + ty);
  for (const [c, a] of parse(d)) {
    const rel = c === c.toLowerCase() && c !== 'z';
    const C = c.toUpperCase();
    const ax = (v) => (rel ? x + v : v);
    const ay = (v) => (rel ? y + v : v);
    if (C === 'M') {
      x = ax(a[0]);
      y = ay(a[1]);
      sx = x;
      sy = y;
      o.push(`M${X(x)} ${Y(y)}`);
    } else if (C === 'L' || C === 'T') {
      x = ax(a[0]);
      y = ay(a[1]);
      o.push(`${C}${X(x)} ${Y(y)}`);
    } else if (C === 'H') {
      x = rel ? x + a[0] : a[0];
      o.push(`H${X(x)}`);
    } else if (C === 'V') {
      y = rel ? y + a[0] : a[0];
      o.push(`V${Y(y)}`);
    } else if (C === 'C') {
      const p = [ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3]), ax(a[4]), ay(a[5])];
      x = p[4];
      y = p[5];
      o.push(`C${X(p[0])} ${Y(p[1])} ${X(p[2])} ${Y(p[3])} ${X(p[4])} ${Y(p[5])}`);
    } else if (C === 'S' || C === 'Q') {
      const p = [ax(a[0]), ay(a[1]), ax(a[2]), ay(a[3])];
      x = p[2];
      y = p[3];
      o.push(`${C}${X(p[0])} ${Y(p[1])} ${X(p[2])} ${Y(p[3])}`);
    } else if (C === 'A') {
      x = ax(a[5]);
      y = ay(a[6]);
      o.push(`A${f(a[0] * s)} ${f(a[1] * s)} ${f(a[2])} ${a[3]} ${a[4]} ${X(x)} ${Y(y)}`);
    } else if (C === 'Z') {
      x = sx;
      y = sy;
      o.push('Z');
    }
  }
  return o.join('');
}

// ── SVG pieces ──
const strokeAttrs = (w) => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

/** Enclosure: the drawing shrinks to the center, surrounded by a circle (r 9) or a square with the signature corner. */
export const ENCLOSURES = {
  circle: { shape: circ(12, 12, 9), scale: 0.58 },
  square: { shape: sq(3.25, 3.25, 17.5, 17.5, 4.25, { square: ['br'] }), scale: 0.6 },
};
const shrink = (ds, scale) => ds.map((d) => transform(d, scale, 12 * (1 - scale), 12 * (1 - scale)));

// Slash: from top left to bottom right, with 1.5 of clearance on each side
const SLASH = 'M3.6 3.6 20.4 20.4';

// ── Cuts that reach the silhouette ──
/** Points along a path (absolute), curves and arcs sampled, to measure distances to it. */
function samplesOf(d) {
  const pts = [];
  let [x, y, sx, sy] = [0, 0, 0, 0];
  for (const [c, a] of parse(transform(d, 1, 0, 0))) {
    if (c === 'M') [x, y, sx, sy] = [a[0], a[1], a[0], a[1]];
    else if (c === 'Z') {
      // The closing side is an edge like any other
      for (let i = 1; i <= 4; i++) pts.push([x + ((sx - x) * i) / 4, y + ((sy - y) * i) / 4]);
      [x, y] = [sx, sy];
    } else if (c === 'H' || c === 'V' || c === 'L' || c === 'T') {
      const [nx, ny] = c === 'H' ? [a[0], y] : c === 'V' ? [x, a[0]] : a;
      for (let i = 1; i <= 4; i++) pts.push([x + ((nx - x) * i) / 4, y + ((ny - y) * i) / 4]);
      [x, y] = [nx, ny];
    } else if (c === 'C' || c === 'S' || c === 'Q') {
      const end = a.slice(-2);
      const ctrl = c === 'Q' ? [a[0], a[1], a[0], a[1]] : c === 'S' ? [x, y, a[0], a[1]] : a.slice(0, 4);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        pts.push([u * u * u * x + 3 * u * u * t * ctrl[0] + 3 * u * t * t * ctrl[2] + t * t * t * end[0], u * u * u * y + 3 * u * u * t * ctrl[1] + 3 * u * t * t * ctrl[3] + t * t * t * end[1]]);
      }
      [x, y] = end;
    } else if (c === 'A') {
      // Endpoint arc to center form (SVG implementation notes), sampled
      const [rx0, ry0, , large, sweep, ex, ey] = a;
      const [mx, my] = [(x - ex) / 2, (y - ey) / 2];
      let [rx, ry] = [Math.abs(rx0), Math.abs(ry0)];
      const lam = (mx * mx) / (rx * rx || 1) + (my * my) / (ry * ry || 1);
      if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
      const num = Math.max(0, rx * rx * ry * ry - rx * rx * my * my - ry * ry * mx * mx);
      const den = rx * rx * my * my + ry * ry * mx * mx || 1;
      const k = (large === sweep ? -1 : 1) * Math.sqrt(num / den);
      const [cx, cy] = [(k * rx * my) / ry + (x + ex) / 2, (-k * ry * mx) / rx + (y + ey) / 2];
      const a0 = Math.atan2((y - cy) / ry, (x - cx) / rx);
      let da = Math.atan2((ey - cy) / ry, (ex - cx) / rx) - a0;
      if (sweep && da < 0) da += 2 * Math.PI;
      if (!sweep && da > 0) da -= 2 * Math.PI;
      for (let i = 1; i <= 12; i++) pts.push([cx + rx * Math.cos(a0 + (da * i) / 12), cy + ry * Math.sin(a0 + (da * i) / 12)]);
      [x, y] = [ex, ey];
    }
  }
  return pts;
}
/**
 * Does a cut come to a solid's silhouette (within 0.75 of its outline, anywhere along it)? Such a
 * cut keeps, at every weight, the relation to the edge it has at regular (see render).
 */
function edgeCut(d, solids) {
  const edge = solids.flatMap(samplesOf);
  return samplesOf(d).some(([px, py]) => edge.some(([ex, ey]) => Math.hypot(ex - px, ey - py) <= 0.75));
}

/**
 * SVG content of an icon in a given variant.
 * icon: { d, fill?: { solid, cut?, lines? } } · style: 'outline' | 'fill'
 * enclosure: null | 'circle' | 'square' · slash: boolean, or 0–1 drawn so far (a transition) · weight: stroke width · id: unique per SVG (masks)
 */
// ── Dots and cleared areas ──
// A dot (a circle with r < 1, like the ones from dot()) that touches a badge's area is removed
// whole: half a dot is a fragment, not a detail.
const CIRCLE = /^M(-?[\d.]+) (-?[\d.]+)A([\d.]+) [\d.]+ 0 1 0 (-?[\d.]+) (-?[\d.]+)A/;
function asCircle(d) {
  const m = d.trim().match(CIRCLE);
  if (!m) return null;
  const r = Number(m[3]);
  return { cx: Number(m[1]) + r, cy: Number(m[2]), r };
}
/** A path's points in absolute coordinates (each segment's endpoints and its curves' control points). */
function pointsOf(d) {
  const pts = [];
  for (const [c, a] of parse(transform(d, 1, 0, 0))) {
    if (c === 'H' || c === 'V' || c === 'Z') continue;
    for (let i = 0; i + 1 < a.length; i += 2) if (c !== 'A' || i === 5) pts.push([a[i], a[i + 1]]);
    if (c === 'A') pts.push([a[5], a[6]]);
  }
  return pts;
}
/** Does the dot `dot` touch the area cleared by `knock` (clearance included)? By true distance to the shape. */
function dotInKnock(dot, knock, weight) {
  const halo = weight / 2 + 1.5 + weight / 2;
  const reach = halo + dot.r + weight / 2;
  const c = asCircle(knock);
  if (c) return Math.hypot(dot.cx - c.cx, dot.cy - c.cy) < c.r + reach;
  // Distance to the shape's polyline and, if the shape is closed, whether the dot falls inside
  const pts = pointsOf(knock);
  let min = Infinity;
  let inside = false;
  for (let k = 0; k < pts.length; k++) {
    const [ax, ay] = pts[k];
    const [bx, by] = pts[(k + 1) % pts.length];
    const L = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-9;
    const t = Math.max(0, Math.min(1, ((dot.cx - ax) * (bx - ax) + (dot.cy - ay) * (by - ay)) / L));
    min = Math.min(min, Math.hypot(dot.cx - (ax + t * (bx - ax)), dot.cy - (ay + t * (by - ay))));
    if (ay > dot.cy !== by > dot.cy && dot.cx < ((bx - ax) * (dot.cy - ay)) / (by - ay) + ax) inside = !inside;
  }
  return min < reach || (/[zZ]\s*$/.test(knock) && inside);
}

/** Indices into d for a list of parts, by name (icon.parts) or by number. */
const indices = (icon, list) => (list ?? []).flatMap((p) => (Number.isInteger(p) ? [p] : (icon.parts?.[p] ?? [])));

/** Attributes of each path in d: its part (data-part) and its level (data-level, starting at 1). */
function tagsOf(icon) {
  const t = new Map();
  const add = (i, attr) => t.set(icon.d[i], `${t.get(icon.d[i]) ?? ''} ${attr}`);
  for (const [name, ix] of Object.entries(icon.parts ?? {})) for (const i of ix) add(i, `data-part="${name}"`);
  (icon.levels ?? []).forEach((ix, n) => ix.forEach((i) => add(i, `data-level="${n + 1}"`)));
  return t;
}

/** The drawing that applies: the 16 px one (`small`) or the pixel-snapped one, plus levels and motion. */
function resolve(icon, { size, value, frame, spec }) {
  const small = size && size <= 18 ? icon.small : null;
  let d = small ? small.d : icon.d;
  let fill = small ? (small.fill ?? null) : (icon.fill ?? null);
  // Levels (wifi, battery, volume…): with value < 1 the levels it does not reach are hidden
  if (icon.levels && value !== undefined && value < 1 && !small) {
    const shown = Math.round(Math.max(0, Math.min(1, value)) * icon.levels.length);
    const hide = new Set(icon.levels.slice(shown).flat().map((i) => icon.d[i]));
    d = d.filter((p) => !hide.has(p));
    if (fill) fill = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.filter((p) => !hide.has(p))]));
  }
  // Extreme frame of the motion (to review parts and pivot on the sheets)
  let moved = null;
  const mv = spec ?? (frame ? icon.motion : null);
  if (mv) moved = new Set((mv.parts ? indices(icon, mv.parts) : icon.d.map((_, i) => i)).map((i) => icon.d[i]));
  const tags = small ? new Map() : tagsOf(icon);
  let bdg = small ? (small.badge ?? null) : (icon.badge ?? null);
  const tiny = size && size <= 18;
  if (tiny && bdg) {
    // At 16 px: a standard badge uses its pixel version; a custom one is snapped to the pixel
    if (bdg.kind && !small) bdg = badge(bdg.kind, { size });
    else if (!small) {
      const sn = snapper([...bdg.d, bdg.knock]);
      bdg = { d: bdg.d.map(sn), knock: sn(bdg.knock), ...(bdg.fill && { fill: Object.fromEntries(Object.entries(bdg.fill).map(([k, v]) => [k, v.map(sn)])) }) };
    }
  }
  if (tiny && !small) {
    const sn = snapper([...d, ...Object.values(fill ?? {}).flat()]);
    for (const [p, t] of [...tags]) tags.set(sn(p), t);
    d = d.map(sn);
    if (fill) fill = Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)]));
    moved = moved && new Set([...moved].map(sn));
  }
  // A badge zooming in or out (transitions) keeps its zoom at any size
  const badgeOut = bdg && icon.badge?.zoom && !small ? { ...bdg, zoom: icon.badge.zoom } : bdg;
  return { d, fill, moved, tags, badge: badgeOut };
}

/**
 * The effect to animate and its data. `effect`: 'auto' (the icon's own gesture; if it has none,
 * levels if it has them, otherwise bounce), one of MOTION ('ring', 'wiggle', 'spin', 'beat',
 * 'slide', 'float', 'bounce') or a generic one: 'draw' (drawn path by path) or 'levels'.
 */
export function effectOf(icon, effect = 'auto') {
  if (effect && effect !== 'auto') return effect;
  return icon.motion?.effect ?? (icon.levels ? 'levels' : 'bounce');
}
function motionSpec(icon, effect) {
  const e = effectOf(icon, effect);
  if (icon.motion?.effect === e) return { ...icon.motion };
  // Generic effects: the whole icon, pivot at the center and a short hop upward
  return { effect: e, origin: [12, 12], vector: e === 'slide' ? [2, 0] : [0, -2] };
}
/** Pivot and offset of an animated group, as CSS variables (see engine/motion.css). */
const motionStyle = ({ origin = [12, 12], vector = [0, -2] }) => `transform-origin:${f(origin[0])}px ${f(origin[1])}px;--dx:${f(vector[0])}px;--dy:${f(vector[1])}px`;

/** SVG transform for the extreme frame of each effect (see DESIGN.md › Motion). */
export function motionTransform({ effect, origin = [12, 12], vector = [0, -2] }) {
  const [ox, oy] = origin;
  if (effect === 'ring' || effect === 'wiggle') return `rotate(${effect === 'ring' ? 18 : 10} ${ox} ${oy})`;
  if (effect === 'spin') return `rotate(90 ${ox} ${oy})`;
  if (effect === 'beat') return `translate(${ox} ${oy}) scale(1.18) translate(${-ox} ${-oy})`;
  if (effect === 'slide' || effect === 'float' || effect === 'bounce') return `translate(${vector[0]} ${vector[1]})`;
  return '';
}

export function render(icon, { style = 'outline', enclosure = null, slash = false, weight = 1.5, id = 'i', size, rtl = false, value, frame = false, animate = null } = {}) {
  const enc = enclosure ? ENCLOSURES[enclosure] : null;
  // Animation: the requested effect with its data (parts, pivot, offset)
  const spec = animate && !enc ? motionSpec(icon, animate) : null;
  const r = resolve(icon, { size, value, frame, spec });
  if (r.badge) {
    // Dots that touch the badge's area are removed whole (outline and fill)
    const z = r.badge.zoom;
    const area = z ? transform(r.badge.knock, z[0], z[1] * (1 - z[0]), z[2] * (1 - z[0])) : r.badge.knock;
    const gone = new Set(r.d.filter((d) => { const c = asCircle(d); return c && c.r < 1 && dotInKnock(c, area, weight); }));
    if (gone.size) {
      r.d = r.d.filter((d) => !gone.has(d));
      if (r.fill) r.fill = Object.fromEntries(Object.entries(r.fill).map(([k, v]) => [k, v.filter((d) => !gone.has(d))]));
    }
  }
  icon = { ...icon, d: r.d, fill: r.fill ?? undefined };
  // When animating, each visible path gets pathLength=1 plus its drawing order (--i) and level (--l)
  const order = new Map(icon.d.map((d, i) => [d, i]));
  const lvl = (d) => (r.tags.get(d) ?? '').match(/data-level="(\d+)"/)?.[1];
  const anim = (d) => (spec ? ` pathLength="1" style="--i:${order.get(d) ?? 0}${lvl(d) ? `;--l:${lvl(d)}` : ''}"` : '');
  // A dot (a circle of radius 1 at most, measured at the drawing's own size: inside an enclosure
  // a small ring is shrunk, not a dot) is drawn as the disc its stroke would cover, radius r + w/2,
  // filled and unstroked. A stroke alone opens it into a ring at light weights, and a stroke wider
  // than the dot leaves a hole in its middle (Skia's stroker, and so Chrome)
  const dotOf = (d) => {
    const c = asCircle(d);
    return c && c.r <= (enc ? enc.scale : 1) + 1e-6 ? c : null;
  };
  const disc = (c, w) => circ(c.cx, c.cy, c.r + w / 2);
  const paths = (ds) =>
    ds
      .map((d) => {
        const c = dotOf(d);
        return c ? `<path d="${disc(c, weight)}" fill="currentColor" stroke="none"${r.tags.get(d) ?? ''}${anim(d)}/>` : `<path d="${d}"${r.tags.get(d) ?? ''}${anim(d)}/>`;
      })
      .join('');
  const k = enc ? enc.scale : 1;
  const fill = style === 'fill' && icon.fill ? icon.fill : null;
  const g = (ds) => (enc ? shrink(ds, k) : ds);
  // Ink against paper: what a fill or an enclosure cuts out (dots, signs, the drawing itself) is
  // paper, and paper thins as the ink grows, like a letter's counters: 1.5 at regular, 1.25 at
  // bold, 1.75 at light (never under 0.75)
  const paper = Math.max(0.75, 1.5 + (1.5 - weight) / 2);
  // Cut-out dots are discs too: a ring of paper would leave an island of ink in its middle
  const black = (ds, w = weight) =>
    ds
      .map((d) => {
        const c = dotOf(d);
        return c ? `<path d="${disc(c, w)}" fill="black"/>` : `<path d="${d}" fill="none" stroke="black" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      })
      .join('');
  const maskOf = (name, content) => `<mask id="${id}-${name}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/>${content}</mask>`;
  const defs = [];
  const body = [];
  // Extreme frame of the motion (review sheets): the parts that move and, if the badge moves,
  // its cutout too
  const t = frame && icon.motion ? motionTransform(icon.motion) : '';
  const mv = t ? icon.motion : spec;
  // Whatever moves goes in a group: with the extreme frame (sheets) or with the animation class
  const wrapAttr = t ? ` transform="${t}"` : spec ? ` class="gota-m" style="${motionStyle(spec)}"` : '';
  const badgeMoves = Boolean(wrapAttr) && (mv?.parts ?? []).includes('badge');
  const moving = (ds) => (wrapAttr && r.moved?.size ? [ds.filter((p) => !r.moved.has(p)), ds.filter((p) => r.moved.has(p))] : [ds, []]);
  const split = (ds, draw) => {
    const [still, go] = moving(ds);
    return `${draw(still)}${go.length ? `<g${wrapAttr}>${draw(go)}</g>` : ''}`;
  };
  // Cutouts: the slash (applies to everything) and the badge area (applies to the base). A slash
  // given as 0–1 is drawn that far from the top left, its cutout with it
  const drawn = slash === true ? 1 : Math.max(0, Math.min(1, Number(slash) || 0));
  const sl = drawn >= 1 ? SLASH : `M3.6 3.6 ${f(3.6 + 16.8 * drawn)} ${f(3.6 + 16.8 * drawn)}`;
  const slashCut = drawn > 0 ? `<path d="${sl}" stroke="black" stroke-width="${f(weight + 3)}" stroke-linecap="round"/>` : '';
  const kn = r.badge ? g([r.badge.knock])[0] : null;
  // A zooming badge (transitions) scales as a whole, its strokes and cutout included
  const z = r.badge?.zoom;
  const zoomed = (html) => (z ? `<g transform="matrix(${f(z[0])} 0 0 ${f(z[0])} ${f(z[1] * (1 - z[0]))} ${f(z[2] * (1 - z[0]))})">${html}</g>` : html);
  const knockCut = kn ? (badgeMoves ? `<g${wrapAttr}>` : '') + zoomed(`<path d="${kn}" fill="black" stroke="black" stroke-width="${f(weight + 3)}" stroke-linejoin="round"/>`) + (badgeMoves ? '</g>' : '') : '';
  if (kn) defs.push(maskOf('k', knockCut));

  if (enc && style === 'fill') {
    // Enclosed and filled: a solid container with the drawing knocked out; near the badge the base
    // is not knocked out (the badge cutout already clears it) and the badge is knocked out in full
    const base = black(g(icon.d), paper);
    const badge = r.badge ? zoomed(black(g(r.badge.d), paper)) : '';
    defs.push(maskOf('e', `${kn ? `<g mask="url(#${id}-k)">${base}</g>` : base}${badge}${slashCut}`));
    body.push(`<path d="${enc.shape}" fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linejoin="round" mask="url(#${id}-e)"/>`);
  } else {
    const content = [];
    if (enc) content.push(`<path d="${enc.shape}" ${strokeAttrs(weight)}/>`);
    if (fill) {
      // solid: filled, keeping its stroke · cut: knocked out at stroke width · lines: drawn on top
      // with 1.5 of clearance · wire: drawn on top, flush, with no clearance (a padlock's shackle, a needle)
      // A cut that comes to the silhouette (a stripe, a separator, a meridian) keeps the relation
      // to the edge it has at regular at every weight: it follows the ink's width, less a hair, so
      // what touches the edge at regular keeps a 0.05 rim and what runs past it still runs past.
      // Interior cuts (dots, signs, details) are paper and thin as the ink grows
      const cuts = fill.cut ?? [];
      const atEdge = cuts.filter((d) => edgeCut(d, fill.solid));
      const inner = cuts.filter((d) => !atEdge.includes(d));
      defs.push(maskOf('f', `${split(g(inner), (ds) => black(ds, paper))}${split(g(atEdge), (ds) => black(ds, weight - 0.1))}${split(g(fill.lines ?? []), (ds) => black(ds, weight + 3))}`));
      content.push(`<g fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id}-f)">${split(g(fill.solid), paths)}</g>`);
      const over = [...(fill.lines ?? []), ...(fill.wire ?? [])];
      if (over.length) content.push(`<g ${strokeAttrs(weight)}>${split(g(over), paths)}</g>`);
    } else content.push(`<g ${strokeAttrs(weight)}>${split(g(icon.d), paths)}</g>`);
    const base = content.join('');
    // The base sits under the badge cutout; everything sits under the slash cutout
    let layer = kn ? `<g mask="url(#${id}-k)">${base}</g>` : base;
    if (r.badge) {
      // A status badge (a standard one, or a custom one on the standard ring: r 4.25 at 17.25) is
      // solid in every style, its sign cut out of it, as Apple's badges are: it reads at every weight
      // and at 24 px. Any other badge (a lens, a second card, a sun behind a cloud) keeps the style
      const ring = r.badge.fill?.solid?.[0] && asCircle(r.badge.fill.solid[0]);
      const status = r.badge.kind || (ring && Math.abs(ring.cx - 17.25) < 0.05 && Math.abs(ring.cy - 17.25) < 0.05 && Math.abs(ring.r - 4.25) < 0.05);
      const bf = style === 'fill' || status ? r.badge.fill : null;
      const move = badgeMoves ? wrapAttr : '';
      if (bf) {
        defs.push(maskOf('b', zoomed(black(g(bf.cut ?? []), paper))));
        layer += zoomed(`<g data-part="badge"${move} fill="currentColor" stroke="currentColor" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" mask="url(#${id}-b)">${g(bf.solid).map((d) => `<path d="${d}"/>`).join('')}</g>`);
        if (bf.wire?.length) layer += zoomed(`<g${move} ${strokeAttrs(weight)}>${g(bf.wire).map((d) => `<path d="${d}"/>`).join('')}</g>`);
      } else {
        // The notification dot is a solid disc; any other badge is drawn, its dots filled
        const solid = r.badge.kind === 'dot' ? ' fill="currentColor"' : '';
        layer += zoomed(`<g data-part="badge"${move} ${strokeAttrs(weight)}>${g(r.badge.d).map((d) => (dotOf(d) ? `<path d="${disc(dotOf(d), weight)}" fill="currentColor" stroke="none"/>` : `<path d="${d}"${solid}/>`)).join('')}</g>`);
      }
    }
    if (slashCut) {
      defs.push(maskOf('s', slashCut));
      layer = `<g mask="url(#${id}-s)">${layer}</g>`;
    }
    body.push(layer);
  }
  if (drawn > 0) body.push(`<path d="${sl}" ${strokeAttrs(weight)}/>`);
  let inner = body.join('');
  // Mirror for right-to-left languages (directional icons only)
  if (rtl && icon.mirror) inner = `<g transform="matrix(-1 0 0 1 24 0)">${inner}</g>`;
  return `${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${inner}`;
}

/** The SVG file; directional icons carry data-rtl="mirror" so they flip in Arabic or Hebrew. */
export const svgFile = (inner, icon, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"${icon?.mirror ? ' data-rtl="mirror"' : ''}${extra}>${inner}</svg>\n`;
/** Attributes of the animated <svg>: Gota's class, the effect and when it plays (hover, loop, once). */
export const motionAttrs = (icon, effect = 'auto', play = 'hover') => ` class="gota" data-effect="${effectOf(icon, effect)}" data-play="${play}"`;
