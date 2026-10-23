// Variants of each icon without redrawing it: weight (continuous), enclosed in a circle or a
// square, slashed, mirrored for right-to-left languages, levels (0–1), a 16 px size snapped to
// the pixel and the extreme frame of its motion. The fill (`fill`) and the 16 px drawing (`small`)
// are drawn in the definition. Everything comes out as the content of an <svg viewBox="0 0 24 24">.
// See DESIGN.md › Fill, Variants and Motion.
import { badge, circ, f, halfChord, sq } from './geometry.mjs';

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
      return circ(E(dot.cx), E(dot.cy), 1);
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
        if (c === 'A') {
          const R = a[0] === a[1] && exactHalf(a[0], [x0, y0], [x1, y1]) ? halfChord([x0 + bx, y0 + by], [x1 + ex, y1 + ey]) : null;
          return `A${R ?? f(a[0])} ${R ?? f(a[1])} ${f(a[2])} ${a[3]} ${a[4]} ${f(x1 + ex)} ${f(y1 + ey)}`;
        }
        return 'Z';
      })
      .join('');
  };
}
// An arc written as an exact half circle (radius half its chord, as circ() and arc() write them)
// stays one when its ends move or scale: its radius is again half its new chord
const exactHalf = (r, [x0, y0], [x1, y1]) => Math.abs(Math.hypot(x1 - x0, y1 - y0) / 2 - r) <= 0.0015;

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
      const from = [x, y];
      x = ax(a[5]);
      y = ay(a[6]);
      const R = a[0] === a[1] && exactHalf(a[0], from, [x, y]) ? halfChord([from[0] * s + tx, from[1] * s + ty], [x * s + tx, y * s + ty]) : null;
      o.push(`A${R ?? f(a[0] * s)} ${R ?? f(a[1] * s)} ${f(a[2])} ${a[3]} ${a[4]} ${X(x)} ${Y(y)}`);
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

// Slash: from top left to bottom right, with a clearance of paper on each side
const SLASH = 'M3.6 3.6 20.4 20.4';

// Ink against paper: what a fill or an enclosure cuts out (dots, signs, the drawing itself) and the
// clearance around what sits on top (a fill's lines, a badge, the slash) are paper, and paper thins
// as the ink grows, like a letter's counters: 1.5 at regular, 1.25 at bold, 1.75 at light (never
// under 0.75). A stroke and its clearance take 4.5 at every weight
const paperOf = (weight) => Math.max(0.75, 1.5 + (1.5 - weight) / 2);

// ── Cuts that reach the silhouette ──
/**
 * Points along a path (absolute), at most a quarter of a unit apart along lines, curves and arcs,
 * to measure distances to it: sparser points miss where a cut ends partway along a long edge.
 */
const STEP = 0.25;
const steps = (len) => Math.max(4, Math.ceil(len / STEP));
function samplesOf(d) {
  const pts = [];
  let [x, y, sx, sy] = [0, 0, 0, 0];
  for (const [c, a] of parse(transform(d, 1, 0, 0))) {
    if (c === 'M') {
      // Where a path starts counts: a line that starts at the silhouette comes to it
      [x, y, sx, sy] = [a[0], a[1], a[0], a[1]];
      pts.push([x, y]);
    } else if (c === 'Z') {
      // The closing side is an edge like any other
      const n = steps(Math.hypot(sx - x, sy - y));
      for (let i = 1; i <= n; i++) pts.push([x + ((sx - x) * i) / n, y + ((sy - y) * i) / n]);
      [x, y] = [sx, sy];
    } else if (c === 'H' || c === 'V' || c === 'L' || c === 'T') {
      const [nx, ny] = c === 'H' ? [a[0], y] : c === 'V' ? [x, a[0]] : a;
      const n = steps(Math.hypot(nx - x, ny - y));
      for (let i = 1; i <= n; i++) pts.push([x + ((nx - x) * i) / n, y + ((ny - y) * i) / n]);
      [x, y] = [nx, ny];
    } else if (c === 'C' || c === 'S' || c === 'Q') {
      const end = a.slice(-2);
      const ctrl = c === 'Q' ? [a[0], a[1], a[0], a[1]] : c === 'S' ? [x, y, a[0], a[1]] : a.slice(0, 4);
      // The control polygon is never shorter than the curve
      const n = steps(Math.hypot(ctrl[0] - x, ctrl[1] - y) + Math.hypot(ctrl[2] - ctrl[0], ctrl[3] - ctrl[1]) + Math.hypot(end[0] - ctrl[2], end[1] - ctrl[3]));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
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
      const n = steps(Math.abs(da) * Math.max(rx, ry));
      for (let i = 1; i <= n; i++) pts.push([cx + rx * Math.cos(a0 + (da * i) / n), cy + ry * Math.sin(a0 + (da * i) / n)]);
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
  const halo = weight / 2 + paperOf(weight) + weight / 2;
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
  // A value (0–1, or 'live' to follow the CSS property --gota-value): the icon's levels, its `draw`
  // strokes and its `turn` parts show it (icon.value); an icon showing a value plays no effect
  const shows = value !== undefined && value !== null;
  const turn = shows && !enc ? (icon.value?.turn ?? null) : null;
  // Animation: the requested effect with its data (parts, pivot, offset)
  const spec = animate && !enc && !shows ? motionSpec(icon, animate) : null;
  const r = resolve(icon, { size, value, frame: frame && !shows, spec: spec ?? (turn ? { parts: turn.parts } : null) });
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
  // Showing a value: a level appears once the value passes it (live, as a step the property's
  // transition runs through); a `draw` stroke is drawn that far along its length
  const live = value === 'live';
  const amount = live ? 0 : Math.max(0, Math.min(1, Number(value)));
  const partOf = (d) => (r.tags.get(d) ?? '').match(/data-part="([^"]+)"/)?.[1];
  const drawing = new Set(shows && !enc ? (icon.value?.draw ?? []) : []);
  const levels = icon.levels?.length ?? 0;
  const show = (d) => {
    if (!shows) return '';
    // Shown from v × levels = n − 0.5 on, as the static value rounds (a half up)
    if (live && lvl(d)) return ` style="opacity:clamp(0, calc((var(--gota-value, 1) * ${levels} - ${Number(lvl(d)) - 0.5}) * 1000 + 1), 1)"`;
    if (!drawing.has(partOf(d))) return '';
    if (live) return ' pathLength="1" style="stroke-dasharray:var(--gota-value, 1) 2;opacity:min(1, calc(var(--gota-value, 1) * 1000))"';
    return ` pathLength="1" stroke-dasharray="${f(amount)} 2"${amount > 0 ? '' : ' opacity="0"'}`;
  };
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
        return c ? `<path d="${disc(c, weight)}" fill="currentColor" stroke="none"${r.tags.get(d) ?? ''}${anim(d)}${show(d)}/>` : `<path d="${d}"${r.tags.get(d) ?? ''}${anim(d)}${show(d)}/>`;
      })
      .join('');
  const k = enc ? enc.scale : 1;
  const fill = style === 'fill' && icon.fill ? icon.fill : null;
  const g = (ds) => (enc ? shrink(ds, k) : ds);
  const paper = paperOf(weight);
  // Cut-out dots are discs too: a ring of paper would leave an island of ink in its middle
  const black = (ds, w = weight) =>
    ds
      .map((d) => {
        const c = dotOf(d);
        return c ? `<path d="${disc(c, w)}" fill="black"${show(d)}/>` : `<path d="${d}" fill="none" stroke="black" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${show(d)}/>`;
      })
      .join('');
  const maskOf = (name, content) => `<mask id="${id}-${name}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><rect width="24" height="24" fill="white"/>${content}</mask>`;
  const defs = [];
  const body = [];
  // Extreme frame of the motion (review sheets): the parts that move and, if the badge moves,
  // its cutout too
  const t = frame && !shows && icon.motion ? motionTransform(icon.motion) : '';
  const mv = t ? icon.motion : spec;
  // A `turn` showing a value: from its `from` angle at 0 to its `to` at 1 (drawn at `at`)
  const turned = (tn) => {
    const [ox, oy] = tn.origin;
    if (live) return ` style="transform-box:view-box;transform-origin:${f(ox)}px ${f(oy)}px;transform:rotate(calc((${f(tn.from - tn.at)} + var(--gota-value, 1) * ${f(tn.to - tn.from)}) * 1deg))"`;
    return ` transform="rotate(${f(tn.from - tn.at + amount * (tn.to - tn.from))} ${f(ox)} ${f(oy)})"`;
  };
  // Whatever moves goes in a group: with the extreme frame (sheets), the animation class, or the value's turn
  const wrapAttr = t ? ` transform="${t}"` : spec ? ` class="gota-m" style="${motionStyle(spec)}"` : turn ? turned(turn) : '';
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
  const slashCut = drawn > 0 ? `<path d="${sl}" stroke="black" stroke-width="${f(weight + 2 * paper)}" stroke-linecap="round"/>` : '';
  const kn = r.badge ? g([r.badge.knock])[0] : null;
  // A zooming badge (transitions) scales as a whole, its strokes and cutout included
  const z = r.badge?.zoom;
  const zoomed = (html) => (z ? `<g transform="matrix(${f(z[0])} 0 0 ${f(z[0])} ${f(z[1] * (1 - z[0]))} ${f(z[2] * (1 - z[0]))})">${html}</g>` : html);
  const knockCut = kn ? (badgeMoves ? `<g${wrapAttr}>` : '') + zoomed(`<path d="${kn}" fill="black" stroke="black" stroke-width="${f(weight + 2 * paper)}" stroke-linejoin="round"/>`) + (badgeMoves ? '</g>' : '') : '';
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
      // solid: filled, keeping its stroke · cut: knocked out · lines: drawn on top with a clearance
      // of paper, so a line and its clearance take 4.5 at every weight and the ink around them grows
      // with the weight · wire: drawn on top, flush, with no clearance (a padlock's shackle, a needle)
      // A cut that comes to the silhouette (a stripe, a separator, a meridian) keeps the relation
      // to the edge it has at regular at every weight: it follows the ink's width, less a hair, so
      // what touches the edge at regular keeps a 0.05 rim and what runs past it still runs past.
      // Interior cuts (dots, signs, details) are paper and thin as the ink grows
      const cuts = fill.cut ?? [];
      const atEdge = cuts.filter((d) => edgeCut(d, fill.solid));
      const inner = cuts.filter((d) => !atEdge.includes(d));
      // A line that crosses, meets or lies on the fill (a calendar's rings) keeps its clearance of
      // paper; one that stands apart from it (1.5 or more at regular, as strokes stand 3 apart: a
      // sun's rays, the rain under a cloud) never cuts into it: its clearance stops at the fill's ink,
      // so at bold the fill keeps its edge instead of a bite
      const solids = g(fill.solid);
      const body = solids.flatMap(samplesOf);
      const rings = solids.flatMap((d) => transform(d, 1, 0, 0).split(/(?=M)/).map(samplesOf));
      const inside = ([px, py]) => {
        let hit = false;
        for (const ring of rings)
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
            if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
          }
        return hit;
      };
      const halo = (d) => {
        const pts = samplesOf(d);
        const gap = pts.some(inside) ? 0 : Math.min(...pts.map(([px, py]) => Math.min(...body.map(([qx, qy]) => Math.hypot(qx - px, qy - py)))));
        return gap < 1.5 * k ? weight + 2 * paper : Math.max(weight, Math.min(weight + 2 * paper, 2 * gap - weight));
      };
      const lineCuts = (ds) => ds.map((d) => black([d], halo(d))).join('');
      defs.push(maskOf('f', `${split(g(inner), (ds) => black(ds, paper))}${split(g(atEdge), (ds) => black(ds, weight - 0.1))}${split(g(fill.lines ?? []), lineCuts)}`));
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
        // The same rule as the base's fill: a cut that comes to the badge's edge (a pencil's band)
        // follows the ink less a hair, a sign inside it is paper
        const edge = (bf.cut ?? []).filter((d) => edgeCut(d, bf.solid));
        const inside = (bf.cut ?? []).filter((d) => !edge.includes(d));
        defs.push(maskOf('b', zoomed(`${black(g(inside), paper)}${black(g(edge), weight - 0.1)}`)));
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
