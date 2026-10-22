// Files and cloud: the file and its types, folders, cloud, storage, attachments, clipboards, books
// and publications, versions and backup. Everything is computed with the engine
// (engine/geometry.mjs) on the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a
// square bottom-right corner on containers. The base file is the core `document` without its text
// lines; the folder repeats the core one. The badges (plus, check, clock…) are the engine's:
// `badge` clears the base with exact clearance; nothing is ever trimmed by hand.
import { arc, badge, circ, dot, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper } from '../../engine/variants.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const deg = (v) => (v * 180) / Math.PI;

/** Just the `A…` segment of an engine arc, so it can be chained inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');

/** Polyline with rounded interior vertices (one radius per vertex, or one for all). */
function roundline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${pt(V)}`;
      continue;
    }
    const u = [A[0] - V[0], A[1] - V[1]];
    const v = [B[0] - V[0], B[1] - V[1]];
    const lu = Math.hypot(...u);
    const lv = Math.hypot(...v);
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (v[0] / lv) * t, V[1] + (v[1] / lv) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/**
 * Closes every open subpath, for `fill.solid`: an outline with a gap (the board under its clip, the
 * cloud under its arrow) is filled whole, and the closing segment falls inside what is already
 * solid or inside the area the arrow clears.
 */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/**
 * Outline of a sq() with gaps. Each gap runs clockwise from `from` to `to`, and each end is [edge,
 * coordinate] on a straight run: 't' top (x), 'r' right (y), 'b' bottom (x), 'l' left (y). Without
 * gaps it returns the closed sq().
 */
function box(x, y, w, h, r, { square = [], gaps = [] } = {}) {
  const d = sq(x, y, w, h, r, { square });
  if (!gaps.length) return d;
  const k = d
    .slice(1, -1)
    .split('L')
    .map((s) => (s.includes('c') ? s.slice(s.indexOf('c')) : '')); // [tr, br, bl, tl]
  const p = (c) => (square.includes(c) ? 0 : 1.6 * r);
  const E = [
    { at: (c) => [c, y], end: [x + w - p('tr'), y], dir: 1 },
    { at: (c) => [x + w, c], end: [x + w, y + h - p('br')], dir: 1 },
    { at: (c) => [c, y + h], end: [x + p('bl'), y + h], dir: -1 },
    { at: (c) => [x, c], end: [x, y + p('tl')], dir: -1 },
  ];
  const idx = { t: 0, r: 1, b: 2, l: 3 };
  const piece = ([ea, ca], [eb, cb]) => {
    let e = idx[ea];
    const target = idx[eb];
    let s = `M${pt(E[e].at(ca))}`;
    if (e === target && (cb - ca) * E[e].dir > 0) return `${s}L${pt(E[e].at(cb))}`;
    do {
      s += `L${pt(E[e].end)}${k[e]}`;
      e = (e + 1) % 4;
    } while (e !== target);
    return `${s}L${pt(E[target].at(cb))}`;
  };
  return gaps.map((g, i) => piece(g.to, gaps[(i + 1) % gaps.length].from)).join('');
}


/**
 * Capsule clipping of an outline made of arcs and lines: removes whatever lies closer than `rad` to
 * each segment (the 1.5 gap when one shape passes in front of another) and returns the rest as a
 * single `d`. Primitives: { a: [cx, cy, r, a0, a1] } or { l: [p0, p1] }.
 */
function clip(prims, caps, closed = true) {
  const at = (q, t) =>
    q.a ? polar(q.a[0], q.a[1], q.a[2], q.a[3] + t * (q.a[4] - q.a[3])) : [q.l[0][0] + t * (q.l[1][0] - q.l[0][0]), q.l[0][1] + t * (q.l[1][1] - q.l[0][1])];
  const dist = (p, [a, b]) => {
    const v = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / (v[0] ** 2 + v[1] ** 2 || 1)));
    return Math.hypot(p[0] - a[0] - t * v[0], p[1] - a[1] - t * v[1]);
  };
  const hidden = (p) => caps.some((c) => dist(p, c.seg) < c.rad);
  const runs = [];
  let cur = null;
  prims.forEach((q, qi) => {
    const S = 400;
    let prev = hidden(at(q, 0));
    let start = prev ? null : 0;
    const edges = [];
    for (let i = 1; i <= S; i++) {
      const t = i / S;
      const now = hidden(at(q, t));
      if (now !== prev) {
        let lo = (i - 1) / S;
        let hi = t;
        for (let k = 0; k < 40; k++) {
          const m = (lo + hi) / 2;
          if (hidden(at(q, m)) === prev) lo = m;
          else hi = m;
        }
        const e = (lo + hi) / 2;
        if (now) edges.push([start, e]);
        else start = e;
      }
      prev = now;
    }
    if (start !== null) edges.push([start, 1]);
    for (const [t0, t1] of edges) {
      if (cur && t0 === 0 && cur.endQ === qi - 1 && cur.endT === 1) cur.segs.push({ q, t0, t1 });
      else {
        cur = { segs: [{ q, t0, t1 }] };
        runs.push(cur);
      }
      cur.endQ = qi;
      cur.endT = t1;
    }
    if (!edges.length || edges[edges.length - 1][1] !== 1) cur = null;
  });
  // A closed outline that wasn't cut at its start is joined to its last run.
  const whole = closed && runs.length === 1 && runs[0].segs.length === prims.length && runs[0].segs.every((s) => s.t0 === 0 && s.t1 === 1);
  if (closed && !whole && runs.length > 1) {
    const first = runs[0];
    const last = runs[runs.length - 1];
    if (first.segs[0].t0 === 0 && first.segs[0].q === prims[0] && last.endQ === prims.length - 1 && last.endT === 1) {
      last.segs.push(...first.segs);
      runs.shift();
    }
  }
  const out = runs.map((run) => {
    let s = `M${pt(at(run.segs[0].q, run.segs[0].t0))}`;
    for (const { q, t0, t1 } of run.segs) {
      const e = at(q, t1);
      if (q.a) {
        const span = (t1 - t0) * (q.a[4] - q.a[3]);
        s += `A${N(q.a[2])} ${N(q.a[2])} 0 ${Math.abs(span) > 180 ? 1 : 0} ${span > 0 ? 1 : 0} ${pt(e)}`;
      } else s += `L${pt(e)}`;
    }
    return s;
  });
  return out.join('') + (whole ? 'Z' : '');
}

/** Almond (eye) made of two arcs: a 2·hc chord with sagitta `sag` above and below `c`. */
function lens([cx, cy], hc, sag) {
  const r = (hc * hc + sag * sag) / (2 * sag);
  const a = deg(Math.asin(hc / r));
  return `M${pt([cx - hc, cy])}${arcTo(cx, cy - sag + r, r, -90 - a, -90 + a)}${arcTo(cx, cy + sag - r, r, 90 - a, 90 + a)}Z`;
}

// ── Base pieces ───────────────────────────────────────────────────────────────────────────────
// The file: the core `document` (14.5 × 18.5, radius 3.75, square bottom-right corner).
const F = [4.75, 2.75, 14.5, 18.5, 3.75];
const file = () => sq(...F, { square: ['br'] });

// Custom badges (the ones the engine doesn't provide), in the same place as the engine's: center
// (17.25, 17.25), circle of r 4.25; `knock` is the area the engine clears with 1.5 of clearance.
const BC = [17.25, 17.25];
const BR = 4.25;
const RING = circ(...BC, BR);
// The 16 px grid: a pixel measures 1.5 canvas units and pixel centers fall at 0.75 + 1.5k.
// g(column, row) is the center of a pixel; at(dx, dy) counts from the badge's pixel (11, 11).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const at = (dx, dy) => g(11 + dx, 11 + dy);
/**
 * Custom badge, with its 16 px version (`d16`, `fill16`). The engine only swaps the standard badges
 * for their pixel versions; a custom badge snapped to the pixel grid keeps its 5.7 px circle and
 * clogs up (the question mark and the arrows became a gray smudge). Like the engine's, at 16 px it
 * drops the circle, puts the glyph on the pixel grid, and clears the same circle as at 24 px plus
 * the glyph with its clearance. See "16 px".
 */
const PIXEL = new Map();
const own = (d, knock, fill, d16, fill16) => {
  const b = { d, knock, ...(fill && { fill }) };
  PIXEL.set(b, { d: d16, knock: `${RING}${d16.join('')}`, ...(fill16 && { fill: fill16 }) });
  return b;
};

/**
 * Pencil: tip at `tip`, body pointing at `a` degrees, length `len` to the center of the end cap.
 * Its band is 2.4 from the end, as on Comunicación's badge pencil: a line across the tip would
 * close a triangle too small to stay open at bold.
 */
function pencil(tip, a, len, hw = 1.5, tipLen = 3) {
  const u = [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)];
  const n = [-u[1], u[0]];
  const at = (s, o) => [tip[0] + u[0] * s + n[0] * o, tip[1] + u[1] * s + n[1] * o];
  const outline = `M${pt(tip)}L${pt(at(tipLen, -hw))}L${pt(at(len, -hw))}A${N(hw)} ${N(hw)} 0 0 1 ${pt(at(len, hw))}L${pt(at(tipLen, hw))}Z`;
  return [outline, line(at(len - 2.4, -hw), at(len - 2.4, hw))];
}

/**
 * Sync: two arc arrows; `s0` and `s1` open the gap before and after each arrowhead, and `t` rotates
 * the pair (to move the arrowheads away from a nearby edge).
 */
function syncGlyph([cx, cy], r, len = 2.6, s0 = 20, s1 = 30, t = 0) {
  const a = arc(cx, cy, r, 180 + s0 + t, 360 - s1 + t);
  const b = arc(cx, cy, r, s0 + t, 180 - s1 + t);
  return [a.d, head(a.end, a.tangent, len), b.d, head(b.end, b.tangent, len)];
}

/** Heart: two lobes that cross at the top and two tangents that run down to the point. */
function heart([cx, cy], r = 2.25, a = 1.6, h = 4.25) {
  const P = [cx, cy + h];
  const lobe = (C, side) => {
    const L = Math.hypot(P[0] - C[0], P[1] - C[1]);
    return ang(C, P) + side * deg(Math.acos(r / L));
  };
  const Cl = [cx - a, cy];
  const Cr = [cx + a, cy];
  const top = [cx, cy - Math.sqrt(r * r - a * a)];
  const t1 = lobe(Cl, 1);
  const t2 = lobe(Cr, -1);
  const c1 = ang(Cl, top);
  const c2 = ang(Cr, top);
  return `M${pt(P)}L${pt(polar(...Cl, r, t1))}${arcTo(...Cl, r, t1, c1 + 360)}${arcTo(...Cr, r, c2, t2 + 360)}Z`;
}

const OWN = {
  // Question: the hook and its dot inside the circle. At 16 px, the hook runs through pixel centers
  // and the dot is a single pixel.
  question() {
    const [cx, cy] = BC;
    const hook = `M${pt([cx - 1.3, cy - 1.3])}${arcTo(cx, cy - 1.3, 1.3, 180, 400)}L${pt([cx, cy - 0.05])}`;
    const mark = circ(cx, cy + 2.15, 0.35);
    return own([RING, hook, mark], RING, { solid: [RING], cut: [hook, mark] }, [
      line(at(-2, -2), at(-1, -3), at(1, -3), at(2, -2), at(0, 0), at(0, 1)),
      circ(...at(0, 3), 0.1),
    ]);
  },
  // Heart, without a circle: the shape itself is the badge; it clears the whole circle (so no bits
  // of the base are left next to its point).
  heart() {
    const h = heart([BC[0], 16.25]);
    const h16 = roundpoly([at(-2, -1), at(-1, -2), at(0, -1), at(1, -2), at(2, -1), at(2, 0), at(0, 2), at(-2, 0)], 0.35);
    return own([h], RING, { solid: [h] }, [h16], { solid: [h16] });
  },
  // Magnifier: the lens is the badge circle (r 3.25) and the handle runs toward the corner. Filled:
  // the lens is solid and the handle stays a line, attached to it.
  search() {
    const r = 3.25;
    const lensC = circ(...BC, r);
    const p = polar(...BC, r, 45);
    const end = [21.25, 21.25];
    const handle = line(p, end);
    const lens16 = circ(16.5, 16.5, 3);
    const handle16 = line(at(1, 1), at(3, 3));
    return own([lensC, handle], `${RING}M${pt(p)}L${pt(end)}Z`, { solid: [lensC], wire: [handle] }, [lens16, handle16], { solid: [lens16], wire: [handle16] });
  },
  // Sync: the arc arrows fill the badge circle (in the fill they stay lines).
  sync() {
    return own(syncGlyph(BC, 3.75, 2.4, 25, 35), RING, null, [
      `M${pt(at(-3, 0))}A3 3 0 0 1 ${pt(at(0, -2))}H${N(px(13))}`,
      line(at(1, -3), at(2, -2), at(1, -1)),
      `M${pt(at(3, 0))}A3 3 0 0 1 ${pt(at(0, 2))}H${N(px(9))}`,
      line(at(-1, 3), at(-2, 2), at(-1, 1)),
    ]);
  },
  // Person peeking in from the corner (share). It also clears the badge circle: with only the head
  // and shoulders, a piece of the base's edge was left between the two.
  person() {
    const h = circ(BC[0], 14.75, 1.85);
    const s = `M${pt([BC[0] - 3.25, 21.75])}${arcTo(BC[0], 21.75, 3.25, 180, 360)}Z`;
    const d16 = [circ(17.25, 14.25, 1.5), 'M14.25 21.75A3 3 0 0 1 20.25 21.75Z'];
    return own([h, s], `${RING}${h}${s}`, { solid: [h, s] }, d16, { solid: d16 });
  },
  // The set's cloud, scaled down and sitting in the corner.
  cloud() {
    const c = clip(cloudPrims(5.6, 0.45, 5.2), []);
    const c16 = clip(cloudPrims(5.125, 0.5, 5.125), []);
    return own([c], c, { solid: [c] }, [c16], { solid: [c16] });
  },
  // Seal with its ribbon: the certificate. Filled: the ribbon closes against the seal (the closing
  // segment falls inside the solid seal). At 16 px the ribbon is two strips, attached to the seal
  // in the fill.
  seal() {
    const c = [BC[0], 15.25];
    const s = circ(...c, 3.25);
    const tail = roundline([[c[0] - 2, 17.8], [c[0] - 2, 22], [c[0], 20.75], [c[0] + 2, 22], [c[0] + 2, 17.8]], [0, 0.4, 0.4, 0.4, 0]);
    const s16 = circ(17.25, 15.75, 3);
    const tails16 = [line([15.75, 18.35], [15.75, 21.75]), line([18.75, 18.35], [18.75, 21.75])];
    return own([s, tail], `${s}${tail}Z`, { solid: [s, `${tail}Z`] }, [s16, ...tails16], { solid: [s16], wire: tails16 });
  },
};

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
/** Fills that don't come straight from the strokes (assigned after the default fill). */
const FILL_EXTRA = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
const withBadge = (name, tags, base, b) => add(name, tags, base, { badge: b });

// ── File ──────────────────────────────────────────────────────────────────────────────────────
// The text file isn't repeated here: it is the core `document` (the file with text lines).
add('file', ['archivo', 'en blanco', 'hoja', 'file', 'blank file'], [file()]);
withBadge('file-plus', ['archivo nuevo', 'agregar archivo', 'crear', 'new file', 'add file'], [file()], badge('plus'));
withBadge('file-minus', ['quitar archivo', 'eliminar', 'menos', 'remove file', 'delete file'], [file()], badge('minus'));
withBadge('file-check', ['archivo aprobado', 'listo', 'verificado', 'file approved', 'file done'], [file()], badge('check'));
withBadge('file-x', ['archivo rechazado', 'error', 'cancelar', 'file error', 'file rejected'], [file()], badge('x'));
withBadge('file-alert', ['archivo con aviso', 'advertencia', 'problema', 'file warning', 'file issue'], [file()], badge('alert'));
withBadge('file-clock', ['archivo reciente', 'reloj', 'pendiente', 'recent file', 'pending file'], [file()], badge('clock'));
withBadge('file-star', ['archivo destacado', 'estrella', 'favorito', 'starred file', 'favorite'], [file()], badge('star'));
withBadge('file-move', ['mover archivo', 'trasladar', 'cambiar de lugar', 'move file', 'relocate'], [file()], badge('arrow-right'));
withBadge('file-question', ['archivo desconocido', 'pregunta', 'formato no reconocido', 'unknown file', 'file help'], [file()], OWN.question());
withBadge('file-heart', ['me gusta', 'archivo guardado', 'colección', 'liked file', 'saved file'], [file()], OWN.heart());
withBadge('file-search', ['buscar archivo', 'lupa', 'encontrar', 'find file', 'search file'], [file()], OWN.search());

// Lock inside the file: the core `lock` scaled down, centered in the file.
const miniLock = sq(8.5, 11.25, 7, 5.5, 1.6, { square: ['br'] });
add('file-lock', ['archivo protegido', 'candado', 'privado', 'locked file', 'private file'], [file(), miniLock, `M10 11.25V9.75${arcTo(12, 9.75, 2, 180, 360)}V11.25`]);
// Unlocked: the shackle lifts 3.25 and releases its right leg.
add('file-unlock', ['archivo desbloqueado', 'abierto', 'sin candado', 'unlocked file', 'unlock file'], [file(), miniLock, `M10 11.25V8${arcTo(12, 8, 2, 180, 360)}`]);
// Pencil writing inside the file.
add('file-edit', ['editar archivo', 'lápiz', 'modificar', 'edit file', 'write'], [file(), ...pencil([8.5, 16.25], -45, 10, 1.5, 3)]);
// Bookmark: the book's ribbon, hanging from the top edge.
add('file-bookmark', ['archivo marcado', 'separador', 'guardado', 'bookmarked file', 'saved document'], [
  file(),
  roundline([[11, 2.75], [11, 9.75], [12.5, 8.5], [14, 9.75], [14, 2.75]], [0, 0.4, 0.4, 0.4, 0]),
]);

// ── File types: the glyph sits at the file's optical center (12, 12) ────────────────────────
add('file-code', ['archivo de código', 'código fuente', 'programación', 'code file', 'source code'], [file(), line([10.25, 9.5], [7.75, 12], [10.25, 14.5]), line([13.75, 9.5], [16.25, 12], [13.75, 14.5])]);
add('file-image', ['archivo de imagen', 'foto', 'fotografía', 'image file', 'photo'], [file(), dot(14.75, 8.5), roundline([[7.75, 16.75], [10.75, 12.5], [13, 15.25], [14.5, 13.75], [16.25, 16.25]], [0, 0.75, 0.6, 0.6, 0])]);
add('file-video', ['archivo de video', 'película', 'grabación', 'video file', 'movie'], [file(), roundpoly([[9.75, 8.5], [16.25, 12], [9.75, 15.5]], 1.3)]);
add('file-audio', ['archivo de audio', 'música', 'canción', 'audio file', 'music'], [file(), circ(10.75, 15.75, 1.75), `M12.5 15.75V7.75${arcTo(12.5, 11.25, 3.5, -90, 0)}`]);
// PDF, without letters: the printed page, with its headline at the top and the figure at the
// bottom, margin to margin (the figure at the bottom keeps the page from reading as a face).
add('file-pdf', ['pdf', 'documento portátil', 'documento impreso', 'pdf file', 'portable document'], [
  file(),
  line([8.25, 7], [15.75, 7]),
  line([8.25, 10], [12.75, 10]),
  sq(8.25, 13, 7.5, 4.25, 1.3),
]);
// ZIP: three teeth that alternate at 3 (their tips 3 apart) and the zipper pull.
add('file-zip', ['archivo comprimido', 'zip', 'cremallera', 'compressed file', 'archive file'], [
  file(),
  line([9.75, 5.75], [12, 5.75]),
  line([12, 8.75], [14.25, 8.75]),
  line([9.75, 11.75], [12, 11.75]),
  sq(10.25, 14.75, 3.5, 3.5, 1.05),
]);
// Spreadsheet: header row and label column, edge to edge.
add('file-spreadsheet', ['hoja de cálculo', 'tabla', 'excel', 'spreadsheet', 'sheet'], [file(), line([4.75, 8.75], [19.25, 8.75]), line([4.75, 15], [19.25, 15]), line([10.75, 8.75], [10.75, 21.25])]);
// Presentation: three quarters of a pie and the slice coming out, 3 away on the diagonal.
{
  const r = 3;
  const c = [10.5, 13.5];
  const q = [c[0] + 3, c[1] - 3];
  add('file-presentation', ['presentación', 'diapositivas', 'gráfica de pastel', 'presentation file', 'slides'], [
    file(),
    `M${pt(c)}L${pt([c[0] + r, c[1]])}${arcTo(...c, r, 0, 270)}Z`,
    `M${pt(q)}L${pt([q[0], q[1] - r])}${arcTo(...q, r, -90, 0)}Z`,
  ]);
}
// Font: the A is the concept.
{
  const top = [12, 7.5];
  const L = [8.75, 16.5];
  const R = [15.25, 16.5];
  const y = 13.5;
  const xl = top[0] + ((L[0] - top[0]) * (y - top[1])) / (L[1] - top[1]);
  add('file-font', ['fuente', 'tipografía', 'tipo de letra', 'font file', 'typeface'], [file(), roundline([L, top, R], [0, 0.6, 0]), line([xl, y], [24 - xl, y])]);
}
// JSON: two braces.
{
  const brace = (x, s) => roundline([[x + 1.25 * s, 7.75], [x, 7.75], [x, 11], [x - 1.25 * s, 12], [x, 13], [x, 16.25], [x + 1.25 * s, 16.25]], [0, 1, 0.8, 0, 0.8, 1, 0]);
  add('file-json', ['json', 'datos', 'configuración', 'json file', 'data file'], [file(), brace(9.25, 1), brace(14.75, -1)]);
}
// Terminal: the prompt and the cursor.
add('file-terminal', ['script', 'terminal', 'comandos', 'script file', 'shell'], [file(), line([8.75, 9.25], [11.5, 12], [8.75, 14.75]), line([13, 15], [15.5, 15])]);
// 3D model: the core cube, scaled down.
{
  const c = [12, 12];
  const s = 4.1;
  const P = (a, r = s) => polar(c[0], c[1], r, a);
  add('file-3d', ['modelo 3d', 'cubo', 'objeto', '3d file', '3d model'], [
    file(),
    roundpoly([-90, -30, 30, 90, 150, 210].map((a) => P(a)), 0.7),
    line(P(210), c, P(-30)),
    line(c, P(90)),
  ]);
}
// Person inside the file: record, résumé.
add('file-person', ['expediente', 'currículum', 'perfil', 'profile file', 'resume'], [file(), circ(12, 9.25, 2.5), `M8.25 17.75${arcTo(12, 17.75, 3.75, 180, 360)}Z`]);
// Signature: the signature stroke on its line, at the bottom, where a page gets signed.
add('file-signature', ['firma', 'firmar', 'contrato', 'signature', 'sign document'], [
  file(),
  `M8.25 14.25${arcTo(9.75, 14.25, 1.5, 180, 360)}${arcTo(12.75, 14.25, 1.5, 180, 0)}${arcTo(15.75, 14.25, 1.5, 180, 270)}`,
  line([8.25, 17.75], [15.75, 17.75]),
]);
// Certificate: two lines of text and the seal with its ribbon in the corner.
withBadge('file-certificate', ['certificado', 'diploma', 'constancia', 'certificate file', 'credential'], [file(), line([8.5, 7.5], [13.5, 7.5]), line([8.5, 10.5], [11.5, 10.5])], OWN.seal());

// ── Content and actions inside the file ───────────────────────────────────────────────────────
// Download and upload: the arrow inside the file.
add('file-download', ['descargar archivo', 'bajar', 'guardar', 'download file', 'save file'], [file(), line([12, 7.5], [12, 16.5]), head([12, 16.5], [0, 1], 4.25)]);
add('file-upload', ['subir archivo', 'cargar', 'adjuntar', 'upload file', 'attach file'], [file(), line([12, 16.5], [12, 7.5]), head([12, 7.5], [0, -1], 4.25)]);
// Transfer: one arrow goes up and the other goes down; their heads 3 from the edge and from the
// other arrow.
add('file-transfer', ['transferir archivo', 'subir y bajar', 'intercambio', 'file transfer', 'exchange'], [
  file(),
  line([9.6, 16.75], [9.6, 7.75]),
  head([9.6, 7.75], [0, -1], 2.75),
  line([14.4, 7.75], [14.4, 16.75]),
  head([14.4, 16.75], [0, 1], 2.75),
]);
// Import and export: the arrow enters or exits across the edge; the file opens where it passes and
// stays 3 from the arrowheads.
{
  const y = 12;
  const imp = [8.75, 3.5, 12.5, 17, 3.25];
  add('file-import', ['importar', 'entrada', 'cargar datos', 'import', 'file input'], [
    box(...imp, { square: ['br'], gaps: [{ from: ['l', y + 3], to: ['l', y - 3] }] }),
    line([2.75, y], [15.5, y]),
    head([15.5, y], [1, 0], 4.25),
  ]);
  const exp = [2.75, 3.5, 12.5, 17, 3.25];
  add('file-export', ['exportar', 'salida', 'sacar datos', 'export', 'file output'], [
    box(...exp, { square: ['br'], gaps: [{ from: ['r', y - 3], to: ['r', y + 3] }] }),
    line([8.5, y], [21.25, y]),
    head([21.25, y], [1, 0], 4.25),
  ]);
}
// Share: the forward arrow, inside the file.
add('file-share', ['compartir archivo', 'reenviar', 'enviar', 'share file', 'forward file'], [file(), `M8.75 16.5V14${arcTo(12, 14, 3.25, 180, 270)}H15.75`, head([15.75, 10.75], [1, 0], 3.4)]);
// Compare: plus on top, minus below.
add('file-diff', ['comparar', 'diferencias', 'cambios', 'diff', 'compare files'], [file(), line([12, 7.5], [12, 12.5]), line([9.5, 10], [14.5, 10]), line([9.5, 16.5], [14.5, 16.5])]);
// Bar chart: report.
add('file-chart', ['reporte', 'gráfica', 'informe', 'report', 'chart file'], [file(), line([9, 16.5], [9, 12.75]), line([12, 16.5], [12, 7.75]), line([15, 16.5], [15, 10.5])]);
// Analytics: the rising trend.
add('file-analytics', ['analítica', 'tendencia', 'métricas', 'analytics file', 'trend report'], [file(), roundline([[8.25, 16.25], [10.75, 12.5], [13, 14.5], [15.75, 9]], [0, 0.75, 0.75, 0])]);
// Preview: the eye.
add('file-preview', ['vista previa', 'ver archivo', 'visualizar', 'preview', 'view file'], [file(), lens([12, 12], 4.5, 3.25), dot(12, 12)]);
// AI-generated: the four-pointed sparkle.
{
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(polar(12, 12, i % 2 ? 1.5 : 4.75, -90 + i * 45));
  add('file-sparkle', ['generado con ia', 'inteligencia artificial', 'resumen automático', 'ai file', 'ai generated'], [file(), roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.5 : 0.6)))]);
}
add('file-sync', ['sincronizar archivo', 'actualizar', 'al día', 'sync file', 'update file'], [file(), ...syncGlyph([12, 12], 3.75)]);

// Multiple files: the one behind peeks out as an L-shape 3.5 from the one in front.
const FRONT = [7.75, 6.25, 12.5, 15, 3.5];
const BACK = [4.25, 2.75, 12.5, 15, 3.5];
add('files', ['archivos', 'varios documentos', 'copias', 'files', 'documents'], [box(...FRONT, { square: ['br'] }), box(...BACK, { square: ['br'], gaps: [{ from: ['t', 14.65], to: ['l', 14.5] }] })]);

// Scan: the viewfinder's four corner brackets around a sheet.
{
  const k = (a, b, c) => roundline([a, b, c], [0, 2.25, 0]);
  add('file-scan', ['escanear', 'digitalizar', 'escáner', 'scan document', 'scanner'], [
    sq(8.25, 6.75, 7.5, 10.5, 2.25, { square: ['br'] }),
    k([3, 7.75], [3, 3], [7.75, 3]),
    k([16.25, 3], [21, 3], [21, 7.75]),
    k([21, 16.25], [21, 21], [16.25, 21]),
    k([7.75, 21], [3, 21], [3, 16.25]),
  ]);
}
// Shred: the sheet goes into the shredder's mouth and comes out as four strips aligned with its
// edges.
{
  const mouth = 9.25;
  const base = 14.5;
  add('file-shredder', ['triturar', 'destruir archivo', 'borrado seguro', 'shred', 'shredder'], [
    box(7.25, 2.75, 9.5, 14, 2.5, { square: ['br'], gaps: [{ from: ['r', mouth], to: ['l', mouth] }] }),
    sq(2.75, mouth, 18.5, base - mouth, 1.6, { square: ['br'] }),
    ...[7.25, 10.4, 13.6, 16.75].map((x) => line([x, base], [x, 20.75])),
  ]);
}

// ── Folders ───────────────────────────────────────────────────────────────────────────────────
// The core folder (radius 2.85, the tab with its 2.4 drop, square bottom-right corner); `s` scales
// it.
function folder({ x = 2.75, y = 4.5, w = 18.5, h = 15, s = 1 } = {}) {
  const r = 2.85 * s;
  const k = (v) => N(v * s);
  const R = N(r);
  const tab = `h${k(2.83)}c${k(0.66)} 0 ${k(1.3)} ${k(0.27)} ${k(1.77)} ${k(0.74)}l${k(0.93)} ${k(0.93)}c${k(0.47)} ${k(0.47)} ${k(1.1)} ${k(0.73)} ${k(1.77)} ${k(0.73)}`;
  return `M${pt([x, y + r])}a${R} ${R} 0 0 1 ${R} -${R}${tab}H${N(x + w - r)}a${R} ${R} 0 0 1 ${R} ${R}V${N(y + h)}H${N(x + r)}a${R} ${R} 0 0 1 -${R} -${R}Z`;
}
const DIV = line([2.75, 10.25], [21.25, 10.25]); // the front fold, as in the core
// With a badge, the folder moves up 0.75: the fold sits 3.25 from the circle and the badge doesn't
// bite into it.
const FOLDER = [folder({ y: 3.75 }), line([2.75, 9.5], [21.25, 9.5])];

withBadge('folder-plus', ['carpeta nueva', 'agregar carpeta', 'crear', 'new folder', 'add folder'], FOLDER, badge('plus'));
withBadge('folder-minus', ['quitar carpeta', 'eliminar carpeta', 'menos', 'remove folder', 'delete folder'], FOLDER, badge('minus'));
withBadge('folder-check', ['carpeta aprobada', 'lista', 'completa', 'folder approved', 'folder done'], FOLDER, badge('check'));
withBadge('folder-x', ['carpeta con error', 'rechazada', 'cancelar', 'folder error', 'folder rejected'], FOLDER, badge('x'));
withBadge('folder-alert', ['carpeta con aviso', 'advertencia', 'problema', 'folder warning', 'folder issue'], FOLDER, badge('alert'));
withBadge('folder-download', ['descargar carpeta', 'bajar', 'guardar', 'download folder', 'save folder'], FOLDER, badge('arrow-down'));
withBadge('folder-upload', ['subir carpeta', 'cargar', 'enviar carpeta', 'upload folder', 'send folder'], FOLDER, badge('arrow-up'));
withBadge('folder-clock', ['carpeta reciente', 'reloj', 'historial', 'recent folder', 'folder history'], FOLDER, badge('clock'));
withBadge('folder-move', ['mover carpeta', 'trasladar', 'reubicar', 'move folder', 'relocate folder'], FOLDER, badge('arrow-right'));
withBadge('folder-star', ['carpeta destacada', 'estrella', 'favorita', 'starred folder', 'favorite folder'], FOLDER, badge('star'));
withBadge('folder-lock', ['carpeta protegida', 'candado', 'privada', 'locked folder', 'private folder'], FOLDER, badge('lock'));
withBadge('folder-heart', ['me gusta', 'carpeta guardada', 'colección', 'liked folder', 'saved folder'], FOLDER, OWN.heart());
withBadge('folder-search', ['buscar carpeta', 'lupa', 'explorar', 'find folder', 'search folder'], FOLDER, OWN.search());
withBadge('folder-sync', ['sincronizar carpeta', 'actualizar', 'respaldo continuo', 'sync folder', 'update folder'], FOLDER, OWN.sync());
withBadge('folder-shared', ['carpeta compartida', 'equipo', 'colaborar', 'shared folder', 'team folder'], FOLDER, OWN.person());
withBadge('folder-cloud', ['carpeta en la nube', 'en línea', 'carpeta remota', 'cloud folder', 'online folder'], FOLDER, OWN.cloud());

// Open: the front flap tilts forward and its left side ends at the corner.
{
  const r = 2.85;
  const T1 = [6.75, 12.75];
  const T2 = [21.6, 12.75];
  const B2 = [18.5, 19.5];
  const dir = [B2[0] - T2[0], B2[1] - T2[1]];
  // Where the left side (parallel to the right one) meets the bottom-left corner.
  const C = [2.75 + r, 19.5 - r];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    const q = [T1[0] + dir[0] * m, T1[1] + dir[1] * m];
    if (Math.hypot(q[0] - C[0], q[1] - C[1]) > r && !(q[0] < C[0] && q[1] > C[1])) lo = m;
    else hi = m;
  }
  const S = [T1[0] + dir[0] * lo, T1[1] + dir[1] * lo];
  const tab = 'h2.83c.66 0 1.3.27 1.77.74l.93.93c.47.47 1.1.73 1.77.73';
  const back = `H${N(2.75 + r)}a${r} ${r} 0 0 1 -${r} -${r}V7.35a${r} ${r} 0 0 1 ${r} -${r}${tab}H16.4a${r} ${r} 0 0 1 ${r} ${r}`;
  // A single stroke: the back ends 3 from the flap (1.5 of clearance).
  add('folder-open', ['carpeta abierta', 'abrir', 'explorar', 'open folder', 'browse'], [`${roundline([S, T1, T2, B2], [0, 1.6, 1.6, 0])}${back}`]);
  // Filled: the whole silhouette (the back comes down to the flap) and a knocked-out channel that
  // draws the flap's edge; it ends 1.5 from the side of the back, which stays joined to the flap as
  // in the outline.
  FILL_EXTRA['folder-open'] = {
    solid: [`${roundline([[19.25, 9.75], [19.25, 12.75], T2, B2], [0, 0, 1.6, 0])}${back}Z`],
    cut: [roundline([S, T1, [17.75, 12.75]], [0, 1.6, 0])],
  };
}
// Multiple folders: the one behind peeks out as an L-shape 3 from the one in front, with its two
// sides running up to where its corners would start (like `files`).
add('folders', ['carpetas', 'varias carpetas', 'directorios', 'folders', 'directories'], [
  folder({ x: 5.75, y: 7.5, w: 15.5, h: 13 }),
  line([5.75, 13.25], [21.25, 13.25]),
  `M2.75 14.65V7.35a2.85 2.85 0 0 1 2.85-2.85H15.4`,
]);
// Tree: a root folder and two child folders hanging from its trunk.
{
  const s = 0.5;
  const small = (x, y) => folder({ x, y, w: 9, h: 4.75, s });
  add('folder-tree', ['árbol de carpetas', 'jerarquía', 'estructura', 'folder tree', 'directory tree'], [
    small(2.75, 2.75),
    small(12.25, 8.75),
    small(12.25, 16.5),
    roundline([[5.75, 7.5], [5.75, 19.5], [12.25, 19.5]], [0, 2.25, 0]),
    line([5.75, 11.75], [12.25, 11.75]),
  ]);
}

// ── Cloud ─────────────────────────────────────────────────────────────────────────────────────
// Three circles and a flat base: the big puff in the middle and two smaller ones at the sides (the
// same cloud as `cloud` in `lugares`). It is computed as exact arcs (with their intersections) so
// it can be clipped with clip(). The widest open space inside is at (12.4, 12.45), 5.8 from the
// outline: glyphs are centered there, 3 or more from the edge.
function meet([x1, y1, r1], [x2, y2, r2]) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  const p = [m[0] + (h * (y2 - y1)) / d, m[1] - (h * (x2 - x1)) / d];
  const q = [m[0] - (h * (y2 - y1)) / d, m[1] + (h * (x2 - x1)) / d];
  return p[1] < q[1] ? p : q; // the upper one
}
function ang([cx, cy], [x, y]) {
  return deg(Math.atan2(y - cy, x - cx));
}
function cloudPrims(oy = 0, k = 1, ox = 0) {
  const T = ([x, y, r]) => [ox + 12 + (x - 12) * k, oy + 12 + (y - 12) * k, r * k];
  const A = T([7.25, 14.25, 4]);
  const B = T([12.5, 10.75, 5.5]);
  const C = T([17.25, 14.5, 3.75]);
  const ab = meet(A, B);
  const bc = meet(B, C);
  const base = A[1] + A[2];
  return [
    { a: [...C, 90, ang(C, bc)] },
    { a: [...B, ang(B, bc), ang(B, ab)] },
    { a: [...A, ang(A, ab), -270] },
    { l: [[A[0], base], [C[0], base]] },
  ];
}
const cloud = (oy = 0, caps = []) => clip(cloudPrims(oy), caps);
const cap = (p0, p1, rad = 3) => ({ seg: [p0, p1], rad });
const CX = 12.4; // axis of the glyphs inside the cloud

// Upload and download: the arrow crosses the cloud's base, which opens where it passes.
add('cloud-upload', ['subir a la nube', 'cargar', 'respaldar', 'cloud upload', 'backup to cloud'], [cloud(-2.5, [cap([12, 8.75], [12, 21.5])]), line([12, 21.5], [12, 8.75]), head([12, 8.75], [0, -1], 3.75)]);
add('cloud-download', ['bajar de la nube', 'descargar', 'recuperar', 'cloud download', 'restore from cloud'], [cloud(-2.5, [cap([12, 9], [12, 21.75])]), line([12, 9], [12, 21.75]), head([12, 21.75], [0, 1], 3.75)]);

// States inside the cloud.
add('cloud-check', ['guardado en la nube', 'sincronizado', 'respaldado', 'cloud saved', 'synced'], [cloud(), line([9.25, 13.25], [11.25, 15.25], [15, 11.5])]);
add('cloud-x', ['error de nube', 'no se subió', 'falló', 'cloud error', 'upload failed'], [cloud(), line([CX - 2.1, 10.65], [CX + 2.1, 14.85]), line([CX + 2.1, 10.65], [CX - 2.1, 14.85])]);
add('cloud-plus', ['agregar a la nube', 'nuevo', 'subir más', 'cloud add', 'add to cloud'], [cloud(), line([CX, 10.25], [CX, 15.25]), line([CX - 2.5, 12.75], [CX + 2.5, 12.75])]);
add('cloud-minus', ['quitar de la nube', 'eliminar', 'liberar espacio', 'cloud remove', 'remove from cloud'], [cloud(), line([CX - 2.5, 12.75], [CX + 2.5, 12.75])]);
add('cloud-alert', ['aviso de nube', 'problema de sincronización', 'atención', 'cloud warning', 'sync issue'], [cloud(), line([CX, 8.25], [CX, 11.2]), dot(CX, 14.75)]);
{
  const c = [11.75, 12];
  const r = 2.5;
  add('cloud-search', ['buscar en la nube', 'lupa', 'encontrar', 'cloud search', 'find in cloud'], [cloud(), circ(...c, r), line(polar(...c, r, 45), [15, 15.25])]);
}
// Sync: inside the cloud the arrows don't fit with 1.5 of clearance to its dips (they ended up as
// 2.5 scribbles); they go as a badge, the same arrows as `folder-sync`, and the cloud moves up 2.5
// so the badge only takes its base and the lower half of the right puff.
withBadge('cloud-sync', ['sincronizar', 'nube', 'al día', 'cloud sync', 'syncing'], [cloud(-2.5)], OWN.sync());
// Lock: the core one scaled down, in the cloud's open space.
add('cloud-lock', ['nube privada', 'candado', 'cifrado', 'cloud lock', 'secure cloud'], [
  cloud(),
  sq(CX - 3, 11, 6, 4.25, 1.4, { square: ['br'] }),
  `M${N(CX - 1.5)} 11V9.75${arcTo(CX, 9.75, 1.5, 180, 360)}V11`,
]);
{
  // The core bolt scaled down: a six-vertex zigzag with soft corners.
  const V = [[13.1, 4.25], [5.4, 12.85], [11.35, 12.85], [10.9, 19.75], [18.6, 11.15], [12.65, 11.15]];
  const k = 0.5;
  const P = V.map(([x, y]) => [CX + (x - 12) * k, 12.2 + (y - 12) * k]);
  add('cloud-bolt', ['nube rápida', 'rayo', 'instantáneo', 'cloud fast', 'edge'], [cloud(), roundpoly(P, [0.5, 0.6, 0.3, 0.5, 0.6, 0.3])]);
}
// Offline: the diagonal cuts the cloud with 1.5 of clearance.
add('cloud-off', ['sin nube', 'sin conexión', 'desconectado', 'cloud off', 'offline'], [cloud(0, [cap([3.75, 4.25], [20.25, 20.75])]), line([3.75, 4.25], [20.25, 20.75])]);
// The set's cloud inside the file (the largest that fits with 1.5 of clearance).
add('file-cloud', ['archivo en la nube', 'en línea', 'almacenado en la nube', 'cloud file', 'online file'], [file(), clip(cloudPrims(0.75, 0.45), [])]);

// ── Storage ───────────────────────────────────────────────────────────────────────────────────
// Hard drive: the open drive, with its platter, spindle and read arm; the platter is cut under the
// arm with 1.5 of clearance and sits 3 from the case and from the arm's pivot.
{
  const c = [12, 10];
  const r = 4.25;
  const pivot = [15.75, 17.75];
  const pr = 1.1;
  const tip = [14.25, 12.75];
  const from = polar(...pivot, pr, deg(Math.atan2(tip[1] - pivot[1], tip[0] - pivot[0])));
  add('hard-drive', ['disco duro', 'almacenamiento', 'disco', 'hard drive', 'storage'], [
    sq(4.75, 2.75, 14.5, 18.5, 3.75, { square: ['br'] }),
    clip([{ a: [...c, r, 0, 360] }], [cap(from, tip, 3.05)]),
    dot(...c),
    circ(...pivot, pr),
    line(from, tip),
  ]);
}
// The drive unit (external drive, server, backup): the slot on the left and the light on the right.
const unit = (y, h, r) => [sq(2.75, y, 18.5, h, r, { square: ['br'] }), line([6.25, y + h / 2], [10.25, y + h / 2]), dot(17.25, y + h / 2)];
add('external-drive', ['disco externo', 'unidad', 'almacenamiento', 'external drive', 'drive'], unit(7.5, 9, 2.75));
// File server: a folder sitting on top of the drive unit.
add('file-server', ['servidor de archivos', 'nas', 'red', 'file server', 'network storage'], [folder({ x: 2.75, y: 2.75, w: 18.5, h: 8 }), ...unit(13.75, 6.75, 2.1)]);
// Backup: the arrow loops around and goes back into the drive unit.
{
  const a = arc(12, 11, 6.5, 0, -180);
  add('backup', ['respaldo', 'copia de seguridad', 'restaurar', 'backup', 'time machine'], [...unit(14, 7.25, 2.25), a.d, head(a.end, a.tangent, 3.4)]);
}
// Filing cabinet: three drawers with their handles.
add('filing-cabinet', ['archivero', 'cajones', 'expedientes', 'filing cabinet', 'records'], [
  sq(4.75, 2.75, 14.5, 18.5, 3.75, { square: ['br'] }),
  line([4.75, 8.75], [19.25, 8.75]),
  line([4.75, 15.25], [19.25, 15.25]),
  line([10.5, 5.75], [13.5, 5.75]),
  line([10.5, 12], [13.5, 12]),
  line([10.5, 18.25], [13.5, 18.25]),
]);
// Trash, restore: the `trash` can from `edicion` with the arrow that takes the file back out.
add('trash-restore', ['restaurar', 'recuperar de la papelera', 'deshacer borrado', 'restore', 'undelete'], [
  line([3.5, 6], [20.5, 6]),
  roundline([[9.25, 6], [9.25, 3.25], [14.75, 3.25], [14.75, 6]], [0, 1.25, 1.25, 0]),
  sq(5.25, 9, 13.5, 12.25, 3.25, { square: ['br'] }),
  line([12, 18.25], [12, 12.25]),
  head([12, 12.25], [0, -1], 3.25),
]);

// ── Attachments ───────────────────────────────────────────────────────────────────────────────
// Paperclip: three parallel lines 3 apart and three half-turns, rotated 45°.
{
  const c = [12, 12.25];
  const R = (p) => rot(p, c, 45);
  const A = (o, r, a0, a1) => arcTo(...R(o), r, a0 + 45, a1 + 45);
  add('paperclip', ['clip', 'adjunto', 'adjuntar', 'attachment', 'attach'], [
    `M${pt(R([13.5, 8]))}L${pt(R([13.5, 15]))}${A([12, 15], 1.5, 0, 180)}L${pt(R([10.5, 6]))}${A([13.5, 6], 3, 180, 360)}L${pt(R([16.5, 17]))}${A([12, 17], 4.5, 0, 180)}L${pt(R([7.5, 9]))}`,
  ]);
}

// ── Clipboard ─────────────────────────────────────────────────────────────────────────────────
// The board opens at the top and its corners end right at the sides of the clip; same board and
// same clip (5.7 × 3.5) as `paste` and `clipboard-check` in `edicion`. `side` also opens a gap on
// one side (where the copy arrow comes in).
function clipboard(x = 4.75, w = 14.5, side) {
  const r = 2.75;
  const p = 1.6 * r;
  const [a, b] = [x + p, x + w - p];
  const top = { from: ['t', a], to: ['t', b] };
  const board = (gaps) => box(x, 4.5, w, 16.75, r, { square: ['br'], gaps });
  return {
    d: [board(side ? [side, top] : [top]), sq(a, 2.75, b - a, 3.5, 1.05)],
    // Fill, as in `edicion`: the whole board (closed under the clip; the side gap is cleared by the
    // arrow's clearance) and the clip, both solid, plus a knocked-out channel that separates the
    // lower half of the clip from the board: that way it reads as a separate piece and not as a
    // jar.
    solid: shut(board([top])),
    channel: roundline([[a, 4.5], [a, 6.25], [b, 6.25], [b, 4.5]], [0, 1.05, 1.05, 0]),
  };
}
const CLIP = clipboard();
/** The clipboard for each icon (the copy one is narrower and opens its side). */
const BOARD = {};
add('clipboard', ['portapapeles', 'tabla', 'notas', 'clipboard', 'board'], CLIP.d);
// List: bullet and line with 1.5 of clearance between them (so they don't merge at 18 px).
add('clipboard-list', ['lista', 'pendientes', 'tareas', 'checklist', 'to-do'], [
  ...CLIP.d,
  ...[10.5, 14, 17.5].flatMap((y) => [dot(8.5, y), line([12.25, y], [16.25, y])]),
]);
add('clipboard-plus', ['agregar', 'nueva lista', 'nueva nota', 'clipboard add', 'new list'], [...CLIP.d, line([12, 11], [12, 16.5]), line([9.25, 13.75], [14.75, 13.75])]);
add('clipboard-x', ['quitar', 'rechazado', 'vaciar', 'clipboard remove', 'rejected'], [...CLIP.d, line([9.9, 11.65], [14.1, 15.85]), line([14.1, 11.65], [9.9, 15.85])]);
// Copy to clipboard: the arrow comes in from the side.
{
  const y = 13.25;
  BOARD['clipboard-copy'] = clipboard(8.25, 13, { from: ['l', y + 3], to: ['l', y - 3] });
  add('clipboard-copy', ['copiar', 'al portapapeles', 'guardar copia', 'copy to clipboard', 'copy'], [
    ...BOARD['clipboard-copy'].d,
    line([2.75, y], [15.25, y]),
    head([15.25, y], [1, 0], 3.75),
  ]);
}
// Timesheet: the clock as big as it fits; the hands 3 from the face.
add('clipboard-clock', ['hoja de horas', 'tiempo', 'registro de horas', 'timesheet', 'time log'], [...CLIP.d, circ(12, 13.75, 4.25), line([12, 12.35], [12, 13.75], [13.2, 14.45])]);
add('clipboard-person', ['expediente', 'ficha', 'registro', 'record', 'patient chart'], [...CLIP.d, circ(12, 10.6, 2), `M8.25 18.25${arcTo(12, 18.25, 3.75, 180, 360)}Z`]);
add('clipboard-edit', ['editar lista', 'lápiz', 'llenar formulario', 'edit clipboard', 'fill form'], [...CLIP.d, ...pencil([8.75, 17.75], -45, 9.5, 1.5, 3)]);

// ── Books and publications ────────────────────────────────────────────────────────────────────
// Arc over a chord with sagitta `sag`: sweep 1 curves to the left of the on-screen direction of
// travel.
function bow(p0, p1, sag, sweep) {
  const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const r = (c * c) / (8 * sag) + sag / 2;
  return `A${N(r)} ${N(r)} 0 0 ${sweep} ${pt(p1)}`;
}
// Notebook: the cover and the spiral rings that cross it along the spine.
add('notebook', ['cuaderno', 'libreta', 'apuntes', 'notebook', 'notes'], [
  sq(6.25, 2.75, 13, 18.5, 3, { square: ['br'] }),
  line([3.75, 8.5], [8.75, 8.5]),
  line([3.75, 12], [8.75, 12]),
  line([3.75, 15.5], [8.75, 15.5]),
]);
// Book: the cover, the spine (right where the corner ends) and the bookmark ribbon.
add('book', ['libro', 'lectura', 'manual', 'book', 'guide'], [
  sq(4.75, 2.75, 14.5, 18.5, 2.5, { square: ['br'] }),
  line([8.75, 2.75], [8.75, 21.25]),
  roundline([[12.25, 2.75], [12.25, 9.75], [13.75, 8.5], [15.25, 9.75], [15.25, 2.75]], [0, 0.4, 0.4, 0.4, 0]),
]);
// Open book: two pages in a gull-wing shape over the spine.
{
  const sT = [12, 7.25];
  const sB = [12, 19.75];
  const L = [[2.75, 5.5], [2.75, 18]];
  const R = [[21.25, 5.5], [21.25, 18]];
  add('book-open', ['libro abierto', 'leer', 'documentación', 'open book', 'read'], [
    `M${pt(sT)}${bow(sT, L[0], 1.1, 0)}L${pt(L[1])}${bow(L[1], sB, 1.1, 1)}${bow(sB, R[1], 1.1, 1)}L${pt(R[0])}${bow(R[0], sT, 1.1, 0)}Z`,
    line(sT, sB),
  ]);
}
// Bookshelf: two upright books, one leaning, and the shelf.
{
  const pivot = [16.1, 20.25];
  const t = -18;
  const C = [[0, 0], [0, -14], [4, -14], [4, 0]].map(([x, y]) => rot([pivot[0] + x, pivot[1] + y], pivot, t));
  add('bookshelf', ['librero', 'biblioteca', 'colección', 'library', 'bookshelf'], [
    roundline([[3.25, 20.25], [3.25, 8.25], [7.25, 8.25], [7.25, 4.75], [11.75, 4.75], [11.75, 20.25]], [0, 1.25, 0, 1.25, 1.25, 0]),
    line([7.25, 8.25], [7.25, 20.25]),
    roundpoly(C, 1.1),
    line([2.5, 20.25], [21.5, 20.25]),
  ]);
}
// Stack of books lying flat: each spine with its page edge.
add('books', ['libros', 'pila de libros', 'estudio', 'books', 'reading list'], [
  sq(3.25, 16.75, 17.5, 4.5, 1.4, { square: ['br'] }),
  sq(5.25, 12.25, 14.5, 4.5, 1.4, { square: ['br'] }),
  sq(4.25, 7.75, 13, 4.5, 1.4, { square: ['br'] }),
  line([17.25, 16.75], [17.25, 21.25]),
  line([16.25, 12.25], [16.25, 16.75]),
  line([14.25, 7.75], [14.25, 12.25]),
]);
// Newspaper: the page (continuous corners at the top; square at the bottom, where the fold rests),
// the fold on the left, the headline, the photo and two lines.
add('newspaper', ['periódico', 'noticias', 'prensa', 'revista', 'newspaper', 'news'], [
  sq(6.25, 4.25, 15, 15.5, 3.5, { square: ['br', 'bl'] }),
  roundline([[6.25, 9.25], [2.75, 9.25], [2.75, 19.75], [6.25, 19.75]], [0, 1.25, 2.5, 0]),
  line([9.75, 8], [18.25, 8]),
  sq(9.75, 11, 3.25, 5.25, 1),
  line([16, 12], [18.25, 12]),
  line([16, 15.25], [18.25, 15.25]),
]);

// ── Versions ──────────────────────────────────────────────────────────────────────────────────
// Versions: three staggered sheets; the ones behind peek out as L-shapes 3 from the next one.
{
  const r = 3;
  const p = 1.6 * r;
  const sheets = [[3.75, 2.75], [6.75, 5.75], [9.75, 8.75]].map(([x, y]) => [x, y, 11, 12.5, r]);
  const behind = (b, n) => box(...b, { square: ['br'], gaps: [{ from: ['t', n[0] + n[2] - p], to: ['l', n[1] + n[3] - p] }] });
  add('versions', ['historial de versiones', 'versiones', 'revisiones', 'version history', 'revisions'], [
    sq(...sheets[2], { square: ['br'] }),
    behind(sheets[1], sheets[2]),
    behind(sheets[0], sheets[1]),
  ]);
}

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index into d: by default the body (the first stroke) is filled and the details are knocked
// out; the exceptions go here. Only closed shapes go in `solid`: `close` closes the outlines that
// have a gap (the arrow crossing the cloud or the file, the sheet going into the mouth, the books
// on their shelf, the newspaper's fold); the closing segment falls inside the solid area or the
// arrow's clearance, so the silhouette doesn't change. `lines` stays a line with 1.5 of clearance
// around it; `wire`, a line attached to the fill (the strips coming out of the shredder, the tree's
// trunk, the trash can's lid, which, as in `trash` from `edicion`, has its handle closed and
// solid).
const all = (name) => icons[name].d.map((_, i) => i);
const FILL = {
  files: { solid: [0], lines: [1] },
  'file-scan': { solid: [0], lines: [1, 2, 3, 4] },
  'file-shredder': { solid: [0, 1], wire: [2, 3, 4, 5], close: true },
  'file-import': { solid: [0], lines: [1, 2], close: true },
  'file-export': { solid: [0], lines: [1, 2], close: true },
  folders: { solid: [0], cut: [1], lines: [2] },
  'folder-tree': { solid: [0, 1, 2], wire: [3, 4] },
  'cloud-upload': { solid: [0], lines: [1, 2], close: true },
  'cloud-download': { solid: [0], lines: [1, 2], close: true },
  'cloud-off': { solid: [0], lines: [1], close: true },
  'file-server': { solid: [0, 1], cut: [2, 3] },
  backup: { solid: [0], cut: [1, 2], lines: [3, 4] },
  'trash-restore': { solid: [1, 2], wire: [0], cut: [3, 4], close: true },
  'clipboard-copy': { solid: [0, 1], lines: [2, 3] },
  notebook: { solid: [0], wire: [1, 2, 3] },
  bookshelf: { solid: [0, 2], cut: [1], wire: [3], close: true },
  books: { solid: [0, 1, 2], cut: [3, 4, 5] },
  newspaper: { solid: [0, 1], cut: [2, 3, 4, 5], close: true },
  versions: { solid: [0], lines: [1, 2] },
};
for (const [name, icon] of Object.entries(icons)) {
  // The clipboard fills the board and the clip (its first two strokes)
  const n = name.startsWith('clipboard') ? 2 : 1;
  const spec = FILL[name] ?? { solid: all(name).slice(0, n), cut: all(name).slice(n) };
  const pick = (ix) => ix.map((i) => icon.d[i]);
  icon.fill = { solid: pick(spec.solid).map(spec.close ? shut : (d) => d) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icon.fill[k] = pick(spec[k]);
}
Object.assign(icons['folder-open'], { fill: FILL_EXTRA['folder-open'] });
// The shredder: the sheet and the machine are separated by the edge of the mouth; the stacked
// books, by the edges they share (their pages don't fit knocked out within a 4.5 thickness).
icons['file-shredder'].fill.cut = [line([4.75, 9.25], [19.25, 9.25])];
icons.books.fill = { solid: icons.books.fill.solid, cut: [line([7.5, 12.25], [16.5, 12.25]), line([7.5, 16.75], [19, 16.75])] };
// The newspaper: the fold and the page are separated by the edge they share, as in the outline.
icons.newspaper.fill.cut.unshift(line([6.25, 9.25], [6.25, 21]));
// The clipboard: the whole board and the clip, solid, with the channel that separates the clip (see
// `clipboard()`); whatever is inside is knocked out.
for (const name of Object.keys(icons))
  if (name.startsWith('clipboard')) {
    const { fill } = icons[name];
    const c = BOARD[name] ?? CLIP;
    fill.solid[0] = c.solid;
    fill.cut = [c.channel, ...(fill.cut ?? [])];
  }
// Just an open line: its fill is the outline itself.
icons.paperclip.fill = false;

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
// `body` is the container (file, folder, cloud, drive unit); the badge comes out on its own as
// `badge`.
const PARTS = {
  'file-lock': { body: [0], lock: [1], shackle: [2] },
  'file-unlock': { body: [0], lock: [1], shackle: [2] },
  'file-edit': { body: [0], pencil: [1, 2] },
  'file-bookmark': { body: [0], ribbon: [1] },
  'file-code': { body: [0], code: [1, 2] },
  'file-image': { body: [0], sun: [1], landscape: [2] },
  'file-video': { body: [0], play: [1] },
  'file-audio': { body: [0], note: [1, 2] },
  'file-pdf': { body: [0], lines: [1, 2], figure: [3] },
  'file-zip': { body: [0], teeth: [1, 2, 3], pull: [4] },
  'file-spreadsheet': { body: [0], grid: [1, 2, 3] },
  'file-presentation': { body: [0], chart: [1], slice: [2] },
  'file-font': { body: [0], letter: [1, 2] },
  'file-json': { body: [0], braces: [1, 2] },
  'file-terminal': { body: [0], prompt: [1], cursor: [2] },
  'file-3d': { body: [0], cube: [1, 2, 3] },
  'file-person': { body: [0], head: [1], shoulders: [2] },
  'file-signature': { body: [0], signature: [1], line: [2] },
  'file-certificate': { body: [0], lines: [1, 2] },
  'file-download': { body: [0], arrow: [1, 2] },
  'file-upload': { body: [0], arrow: [1, 2] },
  'file-transfer': { body: [0], up: [1, 2], down: [3, 4] },
  'file-import': { body: [0], arrow: [1, 2] },
  'file-export': { body: [0], arrow: [1, 2] },
  'file-share': { body: [0], arrow: [1, 2] },
  'file-diff': { body: [0], plus: [1, 2], minus: [3] },
  'file-chart': { body: [0], bars: [1, 2, 3] },
  'file-analytics': { body: [0], trend: [1] },
  'file-preview': { body: [0], eye: [1], pupil: [2] },
  'file-sparkle': { body: [0], sparkle: [1] },
  'file-sync': { body: [0], arrows: [1, 2, 3, 4] },
  files: { front: [0], back: [1] },
  'file-scan': { page: [0], frame: [1, 2, 3, 4] },
  'file-shredder': { page: [0], body: [1], strips: [2, 3, 4, 5] },
  folders: { front: [0, 1], back: [2] },
  'folder-tree': { root: [0], children: [1, 2], branches: [3, 4] },
  'cloud-upload': { body: [0], arrow: [1, 2] },
  'cloud-download': { body: [0], arrow: [1, 2] },
  'cloud-check': { body: [0], mark: [1] },
  'cloud-x': { body: [0], mark: [1, 2] },
  'cloud-plus': { body: [0], mark: [1, 2] },
  'cloud-minus': { body: [0], mark: [1] },
  'cloud-alert': { body: [0], mark: [1, 2] },
  'cloud-search': { body: [0], lens: [1], handle: [2] },
  'cloud-lock': { body: [0], lock: [1], shackle: [2] },
  'cloud-bolt': { body: [0], bolt: [1] },
  'cloud-off': { body: [0], slash: [1] },
  'file-cloud': { body: [0], cloud: [1] },
  'hard-drive': { body: [0], platter: [1, 2], arm: [3, 4] },
  'external-drive': { body: [0], slot: [1], light: [2] },
  'file-server': { folder: [0], body: [1], slot: [2], light: [3] },
  backup: { body: [0], slot: [1], light: [2], arrow: [3, 4] },
  'filing-cabinet': { body: [0], drawers: [1, 2], handles: [3, 4, 5] },
  'trash-restore': { lid: [0, 1], body: [2], arrow: [3, 4] },
  paperclip: { clip: [0] },
  clipboard: { board: [0], clip: [1] },
  'clipboard-list': { board: [0], clip: [1], bullets: [2, 4, 6], lines: [3, 5, 7] },
  'clipboard-plus': { board: [0], clip: [1], mark: [2, 3] },
  'clipboard-x': { board: [0], clip: [1], mark: [2, 3] },
  'clipboard-copy': { board: [0], clip: [1], arrow: [2, 3] },
  'clipboard-clock': { board: [0], clip: [1], face: [2], hands: [3] },
  'clipboard-person': { board: [0], clip: [1], head: [2], shoulders: [3] },
  'clipboard-edit': { board: [0], clip: [1], pencil: [2, 3] },
  notebook: { cover: [0], rings: [1, 2, 3] },
  book: { cover: [0], spine: [1], ribbon: [2] },
  'book-open': { pages: [0], spine: [1] },
  bookshelf: { books: [0, 1], leaning: [2], shelf: [3] },
  books: { books: [0, 1, 2], edges: [3, 4, 5] },
  newspaper: { page: [0], fold: [1], headline: [2], photo: [3], lines: [4, 5] },
  versions: { front: [0], back: [1, 2] },
};
for (const [name, icon] of Object.entries(icons)) {
  if (PARTS[name]) icon.parts = PARTS[name];
  // With a badge: the container (and the folder's fold)
  else if (icon.badge) icon.parts = name.startsWith('folder') ? { body: [0], fold: [1] } : { body: [0] };
}

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
// The badge moves on its own (`parts: ['badge']`): the clock turns its hands inside the ring, the
// arrow slides, the heart and the star beat, and the alert and the question mark sway.
const MOTION = {
  'file-download': { effect: 'bounce', parts: ['arrow'], vector: [0, 2] },
  'file-upload': { effect: 'bounce', parts: ['arrow'], vector: [0, -2] },
  'cloud-download': { effect: 'bounce', parts: ['arrow'], vector: [0, 2] },
  'cloud-upload': { effect: 'bounce', parts: ['arrow'], vector: [0, -2] },
  'trash-restore': { effect: 'bounce', parts: ['arrow'], vector: [0, -2] },
  'folder-download': { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] },
  'folder-upload': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'file-shredder': { effect: 'bounce', parts: ['strips'], vector: [0, 1.5] },
  'file-import': { effect: 'slide', parts: ['arrow'], vector: [2, 0] },
  'file-export': { effect: 'slide', parts: ['arrow'], vector: [2, 0] },
  'clipboard-copy': { effect: 'slide', parts: ['arrow'], vector: [2, 0] },
  'file-share': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'file-move': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'folder-move': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'file-sync': { effect: 'spin', parts: ['arrows'], origin: [12, 12] },
  'folder-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'cloud-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'file-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'folder-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'clipboard-clock': { effect: 'spin', parts: ['hands'], origin: [12, 13.75] },
  'file-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'folder-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'file-question': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'cloud-alert': { effect: 'wiggle', parts: ['mark'], origin: [CX, 15.5] },
  'file-edit': { effect: 'wiggle', parts: ['pencil'], origin: [8.5, 16.25] },
  'clipboard-edit': { effect: 'wiggle', parts: ['pencil'], origin: [8.75, 17.75] },
  paperclip: { effect: 'wiggle', parts: ['clip'], origin: [12, 12.25] },
  'file-heart': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.5] },
  'folder-heart': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.5] },
  'file-star': { effect: 'beat', parts: ['badge'], origin: BC },
  'folder-star': { effect: 'beat', parts: ['badge'], origin: BC },
  'file-sparkle': { effect: 'beat', parts: ['sparkle'], origin: [12, 12] },
  'cloud-bolt': { effect: 'beat', parts: ['bolt'], origin: [CX, 12.2] },
  'file-scan': { effect: 'beat', parts: ['frame'], origin: [12, 12] },
  'file-cloud': { effect: 'float', parts: ['cloud'], vector: [0, -1.5] },
  'folder-cloud': { effect: 'float', parts: ['badge'], vector: [0, -1.5] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Mirroring (DESIGN.md › Mirroring) ─────────────────────────────────────────────────────────
// Whatever goes in, goes out, is forwarded or grows toward one side; the pencils; the signature,
// the list, the newspaper page and the indented tree, which follow the reading direction.
for (const name of [
  'file-import', 'file-export', 'file-share', 'file-move', 'folder-move', 'clipboard-copy', 'file-analytics',
  'file-edit', 'clipboard-edit', 'file-signature', 'clipboard-list', 'newspaper', 'folder-tree',
])
  icons[name].mirror = true;

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
const off = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge: at 58 % its glyph stops reading (and the filled enclosure loses it); the slash
// would cut through it.
off(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });
// The viewfinder already encloses it.
off(['file-scan'], { circle: false, square: false });
// Already slashed, or they already say "no": slashing them adds nothing.
off(['cloud-off', 'cloud-x', 'clipboard-x'], { slash: false });

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps each icon to the pixel grid with a single adjustment shared by all its strokes
// (the folder's fold and the clipboard's edge already reach their sides) and swaps only the
// standard badges for their pixel versions. Only the drawings that still don't read go here. The
// engine doesn't snap a `small`: `set16` applies the same shared adjustment to it. New glyphs run
// from pixel center to pixel center (g, in "Base pieces") with their diagonals at 45°, so they come
// out crisp.
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
// A one-pixel dot, at the center of its pixel: the adjustment leaves it alone (it turns 24 px dots
// into 2 × 2 pixels, which leave no clearance in a list or a small glyph).
const DOT16 = new Set();
const dot16 = (c, r) => {
  const d = circ(...g(c, r), 0.1);
  DOT16.add(d);
  return d;
};
const set16 = (name, d, fill, badge16) => {
  const sn = snapper([...d, ...Object.values(fill ?? {}).flat()]);
  const S = (p) => (DOT16.has(p) ? p : sn(p));
  icons[name].small = {
    d: d.map(S),
    ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(S)])) }),
    ...(badge16 && { badge: badge16 }),
  };
};
// With a custom badge: the base with the same adjustment the engine would give it, plus the pixel
// badge.
for (const [name, icon] of Object.entries(icons)) if (PIXEL.has(icon.badge)) set16(name, icon.d, icon.fill, PIXEL.get(icon.badge));
/** Like the 24 px fill: the first stroke is filled and the rest is knocked out. */
const body16 = (name, d) => set16(name, d, { solid: [d[0]], cut: d.slice(1) });
const plus16 = (c, r, n = 2) => [pl([c, r - n], [c, r + n]), pl([c - n, r], [c + n, r])];
const cross16 = (c, r, n = 2) => [pl([c - n, r - n], [c + n, r + n]), pl([c + n, r - n], [c - n, r + n])];
const arrowV = (c, from, to, n = 2) => {
  const s = Math.sign(to - from);
  return [pl([c, from], [c, to]), pl([c - n, to - s * n], [c, to], [c + n, to - s * n])];
};
const arrowH = (r, from, to, n = 2) => {
  const s = Math.sign(to - from);
  return [pl([from, r], [to, r]), pl([to - s * n, r - n], [to, r], [to - s * n, r + n])];
};
/** The 24 px pencil with its edges on pixel diagonals (half-width 1.59: x + y a multiple of 1.5). */
const pencil16 = (tip) => pencil(tip, -45, 8.5, 1.59, 2.25);

// File: the snapped file takes columns 3–12 and rows 1–14; its glyph lives in columns 5–10 and rows
// 3–12 (1 px of clearance from the edge). Arrows keep shaft and head in the same column (when
// snapped, the 24 px shaft fell on one pixel and the head on another), and check marks and X marks
// are 4 and 5 pixels, as in `edicion`. Pencil, video, zip (3 px teeth that cross at column 8 and a
// 5 × 4 pull with its hole), presentation, 3D, person (head and shoulders 1 px apart), signature,
// analytics, sync, share, download, upload and compare. The preview no longer needs it: with the
// shared adjustment its eye keeps the gap and the pupil.
const FILE16 = file();
body16('file-edit', [FILE16, ...pencil16([8.25, 16.5])]);
body16('file-video', [FILE16, roundpoly([g(6, 5), g(10, 8), g(6, 11)], 0.6)]);
body16('file-zip', [FILE16, pl([6, 3], [8, 3]), pl([8, 5], [10, 5]), pl([6, 7], [8, 7]), sq(px(6), px(9), 6, 4.5, 1.2)]);
// Presentation: the loose slice doesn't fit with 1 px of clearance; the pie with the missing
// quarter.
body16('file-presentation', [FILE16, `M12 ${N(px(8))}H${N(px(10))}${arcTo(12, px(8), 3.75, 0, 270)}Z`]);
// The cube: its 30° edges turned into a smudge (or a barrel, in pixel isometric); at 16 px it is
// drawn in cavalier projection, with a square front and the top and side at 45°.
body16('file-3d', [FILE16, roundpoly([g(5, 7), g(7, 5), g(10, 5), g(10, 8), g(8, 10), g(5, 10)], 0.3), pl([5, 7], [8, 7], [10, 5]), pl([8, 7], [8, 10])]);
body16('file-person', [FILE16, circ(12, 8.25, 2.25), 'M9 17.25A3 3 0 0 1 15 17.25Z']);
body16('file-signature', [FILE16, pl([5, 9], [7, 7], [9, 9], [10, 8]), pl([5, 11], [10, 11])]);
body16('file-analytics', [FILE16, pl([5, 11], [7, 9], [8, 10], [10, 8])]);
body16('file-sync', [
  FILE16,
  `M${pt(g(5, 7))}A3 3 0 0 1 ${pt(g(7, 5))}H${N(px(9))}`,
  pl([8, 4], [9, 5], [8, 6]),
  `M${pt(g(10, 8))}A3 3 0 0 1 ${pt(g(8, 10))}H${N(px(6))}`,
  pl([7, 11], [6, 10], [7, 9]),
]);
body16('file-share', [FILE16, `M${pt(g(5, 11))}V${N(px(9))}A3 3 0 0 1 ${pt(g(7, 7))}H${N(px(10))}`, pl([8, 5], [10, 7], [8, 9])]);
body16('file-download', [FILE16, ...arrowV(8, 4, 11)]);
body16('file-upload', [FILE16, ...arrowV(8, 11, 4)]);
body16('file-diff', [FILE16, ...plus16(8, 6), pl([6, 11], [10, 11])]);
// Import and export: the gap in the edge is centered on the arrow (row 8).
{
  const imp = box(8.25, 3.75, 13.5, 16.5, 3.25, { square: ['br'], gaps: [{ from: ['l', 15.75], to: ['l', 9.75] }] });
  const exp = box(2.25, 3.75, 13.5, 16.5, 3.25, { square: ['br'], gaps: [{ from: ['r', 9.75], to: ['r', 15.75] }] });
  set16('file-import', [imp, ...arrowH(8, 1, 10)], { solid: [shut(imp)], lines: arrowH(8, 1, 10) });
  set16('file-export', [exp, ...arrowH(8, 5, 14)], { solid: [shut(exp)], lines: arrowH(8, 5, 14) });
}

// Cloud: the pixel glyphs at the center of its open space, 3 or more from its outline (the 3 × 3 X,
// like the 24 px one scaled down); the arrows, with the base open and centered on them.
{
  const c = cloud();
  body16('cloud-check', [c, pl([5, 9], [6, 10], [9, 7])]);
  body16('cloud-x', [c, ...cross16(8, 8, 1)]);
  body16('cloud-plus', [c, ...plus16(8, 8)]);
  body16('cloud-alert', [c, pl([8, 5], [8, 8]), dot16(8, 10)]);
  body16('cloud-search', [c, circ(12, 12, 2.25), line([13.5, 13.5], g(10, 10))]);
  body16('cloud-bolt', [c, pl([9, 6], [7, 8], [9, 8], [7, 10])]);
  const up = arrowV(8, 14, 5);
  const upCloud = cloud(-2.5, [cap(g(8, 5), g(8, 14))]);
  set16('cloud-upload', [upCloud, ...up], { solid: [shut(upCloud)], lines: up });
  const down = arrowV(8, 6, 14);
  const downCloud = cloud(-2.5, [cap(g(8, 6), g(8, 14))]);
  set16('cloud-download', [downCloud, ...down], { solid: [shut(downCloud)], lines: down });
}

// Clipboard: the board and the clip are the 24 px ones (the shared adjustment brings the edge to
// the sides of the clip); X, plus, list, person and pencil through pixel centers; copy, with the
// side gap centered on the arrow.
const clip16 = (name, glyph, c = CLIP) => set16(name, [...c.d, ...glyph], { solid: [c.solid, c.d[1]], cut: [c.channel, ...glyph] });
clip16('clipboard-x', cross16(8, 9));
clip16('clipboard-plus', plus16(8, 9));
clip16('clipboard-list', [6, 9, 12].flatMap((r) => [dot16(5, r), pl([7, r], [10, r])]));
clip16('clipboard-person', [circ(12, 11.5, 1.5), 'M9.5 18.75A2.5 2.5 0 0 1 14.5 18.75Z']);
clip16('clipboard-edit', pencil16([8.25, 18]));
{
  const c = clipboard(8.25, 13, { from: ['l', 15.75], to: ['l', 9.75] });
  const arrow = arrowH(8, 1, 10);
  set16('clipboard-copy', [...c.d, ...arrow], { solid: [c.solid, c.d[1]], cut: [c.channel], lines: arrow });
}

// Trash: the restore arrow at column 8, shaft and head together.
{
  const [lid, handle, body] = icons['trash-restore'].d;
  const arrow = arrowV(8, 12, 8);
  set16('trash-restore', [lid, handle, body, ...arrow], { solid: [shut(handle), body], wire: [lid], cut: arrow });
}
// Paperclip: at 45° its three parallel lines (3 apart) merged into a smudge; at 16 px it stands
// upright, with the lines in alternating columns (1 px of clearance) and the same three half-turns.
{
  const d = `M${pt(g(9, 5))}V${N(px(10))}A1.5 1.5 0 0 1 ${pt(g(7, 10))}V${N(px(4))}A3 3 0 0 1 ${pt(g(11, 4))}V${N(px(11))}A4.5 4.5 0 0 1 ${pt(g(5, 11))}V${N(px(6))}`;
  set16('paperclip', [d]);
}

export default { category: 'archivos', label: 'Archivos y nube', icons };
