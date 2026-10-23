// Outlines: an icon as filled shapes, exactly as render() draws it (fill, badges, cutouts,
// enclosures, slash, 16 px), for the formats that can't hold strokes and masks: Android vector
// drawables, Xcode symbols, icon fonts. Instead of a second copy of the drawing rules, render()'s
// own SVG is evaluated with Skia's path operations (canvaskit-wasm, a dev dependency):
//   · every fill and every stroke is a region (strokes with their width, caps and joins);
//   · paint covers what was painted before it; inside a mask, white keeps and black clears;
//   · a group is painted on a layer of its own, cut by its mask, moved by its transform, and laid
//     over its parent.
// Path operations can go wrong without saying so where two shapes only touch (a line whose round
// ends meet a frame's stroke). So every outline is checked: the SVG and the outline are both
// rasterized by Skia (masks by luminance, like a browser) and compared; on a mismatch the pieces are
// joined another way, then nudged by thousandths of a unit (invisible at any size), and if it still
// doesn't match, it's an error naming the icon, never a wrong outline.
//   const { outline } = await import('./outline.mjs');
//   outline(icon, { style: 'fill', weight: 1.5 })   // → one `d`, nonzero, in the 24 canvas
import CanvasKitInit from 'canvaskit-wasm';
import { render } from '../engine/variants.mjs';

const CK = await CanvasKitInit();
const { Path, PathOp } = CK;
// Every Skia object lives in the WebAssembly heap: the ones an outline makes are freed when it ends
let made = [];
const keep = (p) => {
  if (p) made.push(p);
  return p;
};
const free = () => {
  for (const p of made) p.delete();
  made = [];
};
const fromSvg = (d) => keep(Path.MakeFromSVGString(d));
const empty = () => {
  const b = new CK.PathBuilder();
  const p = keep(b.snapshot());
  b.delete();
  return p;
};
// A path operation that fails is an error, never an empty result
// A path that fills right with the nonzero rule: every result is rewound (see wound) at once, so
// any piece can be laid with any other and read the same way
const op = (a, b, kind) => {
  const out = keep(Path.MakeFromOp(a, b, kind));
  if (!out) throw new Error(`Skia path operation ${kind.value} failed`);
  return fromSvg(wound(out.toSVGString()));
};
const union = (a, b) => op(a, b, PathOp.Union);
const minus = (a, b) => op(a, b, PathOp.Difference);
const within = (a, b) => op(a, b, PathOp.Intersect);

// ── A small parser for render()'s own SVG: elements, attributes, children ──
function parse(svg) {
  const root = { tag: 'g', attrs: {}, children: [] };
  const stack = [root];
  for (const [, close, tag, attrs, self] of svg.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    if (close) {
      stack.pop();
      continue;
    }
    const node = { tag, attrs: Object.fromEntries([...attrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]])), children: [] };
    stack.at(-1).children.push(node);
    if (!self) stack.push(node);
  }
  const masks = new Map();
  const collect = (n) => {
    if (n.tag === 'mask' && n.attrs.id) masks.set(n.attrs.id, n);
    n.children.forEach(collect);
  };
  collect(root);
  return { root, masks };
}

const CAPS = { butt: CK.StrokeCap.Butt, round: CK.StrokeCap.Round, square: CK.StrokeCap.Square };
const JOINS = { miter: CK.StrokeJoin.Miter, round: CK.StrokeJoin.Round, bevel: CK.StrokeJoin.Bevel };
// Paint that inherits, as in SVG (fill defaults to black, stroke to none, caps to butt, joins to miter)
const INHERIT = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule'];
const DEFAULTS = { fill: 'black', stroke: 'none', 'stroke-width': '1', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', 'fill-rule': 'nonzero' };
const styleOf = (node, inherited) => ({ ...inherited, ...Object.fromEntries(INHERIT.filter((k) => node.attrs[k] !== undefined).map((k) => [k, node.attrs[k]])) });
const isBlack = (color) => color === 'black' || color === '#000' || color === '#000000';
const strokeOpts = (style) => ({ width: Number(style['stroke-width']), cap: CAPS[style['stroke-linecap']], join: JOINS[style['stroke-linejoin']], miter_limit: 4, precision: 40 });
const matrixOf = (value) => {
  const m = value?.match(/matrix\(([^)]+)\)/);
  if (!m) return null;
  const [a, b, c, d, e, f] = m[1].split(/[\s,]+/).map(Number);
  return [a, c, e, b, d, f, 0, 0, 1];
};
/** The shape of a path or rect element, nudged by `shift` (a retry after a mismatch). */
function shapeOf(node, style, shift) {
  let d = node.attrs.d;
  if (node.tag === 'rect') {
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => Number(node.attrs[k] ?? 0));
    d = `M${x} ${y}h${w}v${h}h${-w}Z`;
  }
  let shape = fromSvg(d);
  if (shift) {
    const b = new CK.PathBuilder(shape);
    shape = keep(b.transform([1, 0, shift[0], 0, 1, shift[1], 0, 0, 1]).snapshot());
    b.delete();
  }
  if (style['fill-rule'] === 'evenodd') shape.setFillType(CK.FillType.EvenOdd);
  return shape;
}

// ── Vector: each element's regions, laid over each other ──
// A layer is { ink, clear }: what is painted (any color, or white inside a mask) and what is
// painted black inside a mask. A later layer covers both.
const over = (below, above) => ({ ink: union(minus(below.ink, above.clear), above.ink), clear: union(minus(below.clear, above.ink), above.clear) });

function paint(node, inherited, ctx, inMask) {
  const style = styleOf(node, inherited);
  let layer = { ink: empty(), clear: empty() };
  const lay = (region, color) => {
    if (color === 'none' || !region) return;
    if (ctx.mode === 'overlap' && !inMask) {
      // Laid together, no union: a fill made nonzero and a stroke (nonzero already) add up right
      const all = new CK.PathBuilder();
      all.addPath(layer.ink);
      all.addPath(region);
      layer = { ink: keep(all.snapshot()), clear: layer.clear };
      all.delete();
      return;
    }
    layer = inMask && isBlack(color) ? { ink: minus(layer.ink, region), clear: union(layer.clear, region) } : { ink: union(layer.ink, region), clear: minus(layer.clear, region) };
  };
  if (node.tag === 'path' || node.tag === 'rect') {
    const shift = ctx.mode === 'nudged' ? [((ctx.n * 37) % 11) * 3e-4, ((ctx.n * 53) % 13) * 3e-4] : null;
    ctx.n++;
    const shape = shapeOf(node, style, shift);
    lay(keep(shape.makeAsWinding()) ?? shape, style.fill);
    if (style.stroke !== 'none') lay(keep(shape.makeStroked(strokeOpts(style))), style.stroke);
  } else if (['defs', 'mask', 'symbol'].includes(node.tag)) return layer;
  else {
    const subs = node.children.map((child) => paint(child, style, ctx, inMask));
    const order = ctx.mode === 'reverse' ? [...subs].reverse() : subs;
    if (ctx.mode !== 'sequential' && ctx.mode !== 'reverse' && subs.every((sub) => sub.clear.isEmpty())) {
      // Ink alone: every piece at once and one union, which keeps holes that a chain of unions can
      // lose where two pieces only touch (a line whose round ends meet a frame's stroke)
      // (each piece rewound first: an operation's result may be wound for even-odd, and pieces laid
      // together are read with the nonzero rule)
      // In `overlap`, the pieces are only laid together: each one already fills right with the
      // nonzero rule, so together they do too, with no union where two pieces only touch
      const all = new CK.PathBuilder();
      for (const sub of subs) all.addPath(sub.ink);
      const joined = keep(all.snapshot());
      all.delete();
      layer = { ink: ctx.mode === 'overlap' ? joined : union(joined, empty()), clear: empty() };
    } else for (const sub of order) layer = over(layer, sub);
  }
  // A mask or a transform applies to any element, a lone path as much as a group
  const ref = node.attrs.mask?.match(/url\(#([^)]+)\)/)?.[1];
  if (ref) {
    const content = ctx.masks.get(ref).children;
    let keepIn;
    if (ctx.mode === 'overlap' && content[0]?.tag === 'rect' && content.slice(1).every((c) => c.tag !== 'rect')) {
      // render()'s masks are a white box with black on top: the box minus every black piece laid
      // together, one difference and no unions
      const all = new CK.PathBuilder();
      for (const child of content.slice(1)) all.addPath(paint(child, DEFAULTS, ctx, false).ink);
      const black = keep(all.snapshot());
      all.delete();
      keepIn = minus(paint(content[0], DEFAULTS, ctx, false).ink, black);
    } else {
      let cover = { ink: empty(), clear: empty() };
      for (const child of content) cover = over(cover, paint(child, DEFAULTS, ctx, true));
      keepIn = cover.ink;
    }
    layer = { ink: within(layer.ink, keepIn), clear: within(layer.clear, keepIn) };
  }
  const m = matrixOf(node.attrs.transform);
  if (m) {
    const moved = (p) => {
      const b = new CK.PathBuilder(p);
      const out = keep(b.transform(m).snapshot());
      b.delete();
      return out;
    };
    layer = { ink: moved(layer.ink), clear: moved(layer.clear) };
  }
  return layer;
}

// ── Raster: the same SVG drawn by Skia, as a browser draws it, to check the vector result ──
const SIZE = 96;
const surface = CK.MakeSurface(SIZE, SIZE);
const canvas = surface.getCanvas();
const ink = new CK.Paint();
ink.setAntiAlias(true);
function draw(node, inherited, masks, inMask) {
  const style = styleOf(node, inherited);
  if (['defs', 'mask', 'symbol'].includes(node.tag)) return;
  const ref = node.attrs.mask?.match(/url\(#([^)]+)\)/)?.[1];
  const m = matrixOf(node.attrs.transform);
  canvas.save();
  if (m) canvas.concat(m);
  if (ref) canvas.saveLayer();
  if (node.tag === 'path' || node.tag === 'rect') {
    const shape = shapeOf(node, style);
    const color = (c) => (inMask && isBlack(c) ? CK.BLACK : CK.WHITE);
    if (style.fill !== 'none') {
      ink.setStyle(CK.PaintStyle.Fill);
      ink.setColor(color(style.fill));
      canvas.drawPath(shape, ink);
    }
    if (style.stroke !== 'none') {
      const s = strokeOpts(style);
      ink.setStyle(CK.PaintStyle.Stroke);
      ink.setStrokeWidth(s.width);
      ink.setStrokeCap(s.cap);
      ink.setStrokeJoin(s.join);
      ink.setColor(color(style.stroke));
      canvas.drawPath(shape, ink);
    }
  } else for (const child of node.children) draw(child, style, masks, inMask);
  if (ref) {
    // The mask's content, by luminance, keeps the layer where it is white
    const lumen = new CK.Paint();
    const luma = CK.ColorFilter.MakeLuma();
    lumen.setBlendMode(CK.BlendMode.DstIn);
    lumen.setColorFilter(luma);
    canvas.saveLayer(lumen);
    for (const child of masks.get(ref).children) draw(child, DEFAULTS, masks, true);
    canvas.restore();
    lumen.delete();
    luma.delete();
    canvas.restore();
  }
  canvas.restore();
}
/** Coverage (0–255 per pixel) of an SVG fragment, or of a filled path. */
function coverage(paintIt) {
  canvas.clear(CK.TRANSPARENT);
  canvas.save();
  canvas.scale(SIZE / 24, SIZE / 24);
  paintIt();
  canvas.restore();
  const img = surface.makeImageSnapshot();
  const rgba = img.readPixels(0, 0, { width: SIZE, height: SIZE, colorType: CK.ColorType.RGBA_8888, alphaType: CK.AlphaType.Premul, colorSpace: CK.ColorSpace.SRGB });
  img.delete();
  return rgba.filter((_, i) => i % 4 === 3);
}
/**
 * How two coverages differ: pixels that differ clearly, the largest clump of them, and the ink.
 * Antialiasing and curve approximation flip scattered edge pixels; a real loss (a hole, a dot, a
 * piece) is a clump.
 */
function compare(a, b) {
  const off = new Uint8Array(a.length);
  let diff = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += a[i] > 127;
    if (Math.abs(a[i] - b[i]) > 96) {
      off[i] = 1;
      diff++;
    }
  }
  let clump = 0;
  // Where the largest clump is, in canvas units (x0, y0, x1, y1): what a failed check points at
  let where = null;
  for (let i = 0; i < off.length; i++) {
    if (off[i] !== 1) continue;
    let size = 0;
    const box = [SIZE, SIZE, 0, 0];
    const stack = [i];
    off[i] = 2;
    while (stack.length) {
      const k = stack.pop();
      size++;
      const x = k % SIZE;
      const y = (k - x) / SIZE;
      [box[0], box[1], box[2], box[3]] = [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + 1), Math.max(box[3], y + 1)];
      for (const n of [k - SIZE, k + SIZE, x > 0 ? k - 1 : -1, x < SIZE - 1 ? k + 1 : -1])
        if (n >= 0 && n < off.length && off[n] === 1) {
          off[n] = 2;
          stack.push(n);
        }
    }
    if (size > clump) [clump, where] = [size, box.map((v) => (v * 24) / SIZE)];
  }
  return { diff, clump, total, where };
}

// ── Winding: holes turn against their outline ──
// Path operations leave contours that fill right with the even-odd rule; fonts (and nonzero) need
// each contour to turn by its depth: one inside an even number of others turns one way, an odd
// number the other. Skia's output is absolute M, L, Q, C, Z, with contours that never cross.
function contoursOf(d) {
  const list = [];
  for (const [, c, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []).map(Number);
    if (c === 'M') list.push({ start: n, segs: [] });
    else if (c !== 'Z') list.at(-1).segs.push({ c, pts: n });
  }
  return list;
}
function polygon({ start, segs }) {
  const pts = [start];
  let [x, y] = start;
  for (const { c, pts: p } of segs) {
    const end = p.slice(-2);
    if (c === 'L') pts.push(end);
    else
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        pts.push(
          c === 'Q'
            ? [u * u * x + 2 * u * t * p[0] + t * t * p[2], u * u * y + 2 * u * t * p[1] + t * t * p[3]]
            : [u * u * u * x + 3 * u * u * t * p[0] + 3 * u * t * t * p[2] + t * t * t * p[4], u * u * u * y + 3 * u * u * t * p[1] + 3 * u * t * t * p[3] + t * t * t * p[5]],
        );
      }
    [x, y] = end;
  }
  return pts;
}
const areaOf = (poly) => poly.reduce((sum, [x, y], i) => sum + x * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * y, 0) / 2;
const inside = ([px, py], poly) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
function reversed({ start, segs }) {
  const points = [start, ...segs.map((s) => s.pts.slice(-2))];
  const out = [];
  for (let i = segs.length - 1; i >= 0; i--) {
    const { c, pts } = segs[i];
    const to = points[i];
    out.push({ c, pts: c === 'L' ? to : c === 'Q' ? [pts[0], pts[1], ...to] : [pts[2], pts[3], pts[0], pts[1], ...to] });
  }
  return { start: points.at(-1), segs: out };
}
/** The same shape, with each contour turning by its depth: right under nonzero and even-odd alike. */
function wound(d) {
  const contours = contoursOf(d).filter((k) => k.segs.length);
  const polys = contours.map(polygon);
  const r = (v) => String(Math.round(v * 1000) / 1000);
  return contours
    .map((k, i) => {
      // A point just inside the first segment's middle, never a vertex another contour may share
      const probe = polys[i][Math.min(1, polys[i].length - 1)].map((v, j) => (v + polys[i][0][j]) / 2);
      const depth = polys.filter((p, j) => j !== i && inside(probe, p)).length;
      const turn = areaOf(polys[i]) > 0 === (depth % 2 === 0) ? k : reversed(k);
      return `M${turn.start.map(r).join(' ')}${turn.segs.map(({ c, pts }) => `${c}${pts.map(r).join(' ')}`).join('')}Z`;
    })
    .join('');
}

// ── Compact path data ──
// Absolute coordinates rounded to hundredths first (0.005 at most: 0.02 px at 96 px), then written
// relative to the previous rounded point, so the rounding never adds up along a contour; lowercase
// commands, repeated ones implied, h/v for straight lines, no leading zeros or spare separators.
const num = (v) => {
  const t = String(Math.round(v * 100) / 100);
  return t === '-0' ? '0' : t.replace(/^(-?)0\./, '$1.');
};
function compact(d) {
  const r2 = (v) => Math.round(v * 100) / 100;
  let out = '';
  let last = '';
  let prev = '';
  // A number touches the previous one without a space only where it can't be misread: a minus
  // sign, or a leading dot after a number that already has one ("1.5.5" is 1.5 and .5)
  const put = (cmd, values) => {
    const implied = cmd === last && cmd !== 'm';
    let text = implied ? '' : cmd;
    let before = implied ? prev : '';
    for (const v of values) {
      const t = num(v);
      const space = before !== '' && !(t.startsWith('-') || (t.startsWith('.') && before.includes('.')));
      text += (space ? ' ' : '') + t;
      before = t;
    }
    out += text;
    prev = before;
    last = cmd;
  };
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  for (const [, c, args] of d.matchAll(/([MLQCZ])([^MLQCZ]*)/g)) {
    const n = (args.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []).map(Number).map(r2);
    if (c === 'M') {
      put('m', [n[0] - x, n[1] - y]);
      [x, y, sx, sy] = [n[0], n[1], n[0], n[1]];
    } else if (c === 'L') {
      const [dx, dy] = [r2(n[0] - x), r2(n[1] - y)];
      if (dx || dy) put(dx && dy ? 'l' : dx ? 'h' : 'v', dx && dy ? [dx, dy] : [dx || dy]);
      [x, y] = n;
    } else if (c === 'Q' || c === 'C') {
      const rel = n.map((v, i) => r2(v - (i % 2 ? y : x)));
      if (rel.some(Boolean)) put(c.toLowerCase(), rel);
      [x, y] = n.slice(-2);
    } else {
      out += 'z';
      last = 'z';
      prev = '';
      [x, y] = [sx, sy];
    }
  }
  return out;
}

/**
 * Compact path data (above) as absolute M, L, Q, C and Z with one space between every command and
 * number: the only syntax Figma's vector paths take. Each point comes back to the hundredth it was
 * rounded to.
 */
export function absolute(d) {
  const tokens = d.match(/[mlhvqcz]|-?(?:\d+\.?\d*|\.\d+)/gi) ?? [];
  const full = (v) => {
    const t = String(Math.round(v * 100) / 100);
    return t === '-0' ? '0' : t;
  };
  const out = [];
  let [x, y, sx, sy, i, cmd] = [0, 0, 0, 0, 0, ''];
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error(`absolute: a number with no command in "${d.slice(0, 40)}"`);
    const rel = cmd === cmd.toLowerCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    const c = cmd.toLowerCase();
    if (c === 'z') {
      out.push('Z');
      [x, y, cmd] = [sx, sy, ''];
    } else if (c === 'm' || c === 'l') {
      [x, y] = [ox + next(), oy + next()];
      if (c === 'm') [sx, sy, cmd] = [x, y, rel ? 'l' : 'L']; // numbers after a move are lines
      out.push(c === 'm' ? 'M' : 'L', full(x), full(y));
    } else if (c === 'h' || c === 'v') {
      if (c === 'h') x = ox + next();
      else y = oy + next();
      out.push('L', full(x), full(y));
    } else if (c === 'q' || c === 'c') {
      const pts = Array.from({ length: c === 'q' ? 4 : 6 }, (_, k) => (k % 2 ? oy : ox) + next());
      out.push(c.toUpperCase(), ...pts.map(full));
      [x, y] = pts.slice(-2);
    } else throw new Error(`absolute: unexpected command "${cmd}"`);
  }
  return out.join(' ');
}

// Every piece at once first; then chains of unions in order and in reverse; then the pieces laid
// over each other without a union (fills the same under nonzero, contours may overlap); then the
// pieces nudged by thousandths of a unit, so no two of them share an exact point
const MODES = ['joined', 'sequential', 'reverse', 'overlap', 'nudged'];

/** Does a filled path (nonzero) draw what an SVG from render() draws? Same test as every outline. */
export function matches(svg, d) {
  const { root, masks } = parse(svg);
  try {
    const want = coverage(() => draw(root, DEFAULTS, masks, false));
    const got = coverage(() => {
      ink.setStyle(CK.PaintStyle.Fill);
      ink.setColor(CK.WHITE);
      canvas.drawPath(fromSvg(d), ink);
    });
    const r = compare(want, got);
    return { ...r, ok: r.clump < 6 && r.diff <= Math.max(8, r.total * 0.02) };
  } finally {
    free();
  }
}

/** The ink of any SVG that render() produced, as one filled path (`d`, nonzero), checked. */
export function inkOf(svg, label = 'svg', { strict = true, modes = MODES } = {}) {
  const { root, masks } = parse(svg);
  const want = coverage(() => draw(root, DEFAULTS, masks, false));
  free();
  let last = null;
  for (const mode of modes) {
    try {
      const d = compact(paint(root, DEFAULTS, { masks, mode, n: 0 }, false).ink.toSVGString());
      // Checked as it will be used: the final `d`, filled with the default nonzero rule
      const got = coverage(() => {
        ink.setStyle(CK.PaintStyle.Fill);
        ink.setColor(CK.WHITE);
        canvas.drawPath(fromSvg(d), ink);
      });
      const now = { ...compare(want, got), d, mode };
      if (!last || last.error || now.clump < last.clump || (now.clump === last.clump && now.diff < last.diff)) last = now;
      // Scattered edge pixels are antialiasing; a clump of 6 or more (a dot at 96 px is ~28) is not
      if (now.clump < 6 && now.diff <= Math.max(8, now.total * 0.02)) return d;
    } catch (error) {
      last ??= { error: error.message };
    } finally {
      free();
    }
  }
  if (!strict && last?.d) return last.d;
  throw new Error(`The outline of ${label} doesn't match its drawing: ${JSON.stringify({ diff: last.diff, clump: last.clump, total: last.total, mode: last.mode, error: last.error })}`);
}

/** Diagnosis: the outline each way of joining gives, with how it compares to the drawing. */
export function attempts(svg) {
  const { root, masks } = parse(svg);
  const want = coverage(() => draw(root, DEFAULTS, masks, false));
  free();
  return MODES.map((mode) => {
    try {
      const d = paint(root, DEFAULTS, { masks, mode, n: 0 }, false).ink.toSVGString();
      const got = coverage(() => {
        ink.setStyle(CK.PaintStyle.Fill);
        ink.setColor(CK.WHITE);
        canvas.drawPath(fromSvg(d), ink);
      });
      return { mode, d, ...compare(want, got) };
    } catch (error) {
      return { mode, error: error.message };
    } finally {
      free();
    }
  });
}

/** An icon as one filled path (`d`, nonzero) in the 24 canvas, for any of render()'s options. */
export function outline(icon, options = {}, check = {}) {
  return inkOf(render(icon, { ...options, animate: null, id: 'o' }), `${icon.name ?? 'an icon'} ${JSON.stringify(options)}`, check);
}
