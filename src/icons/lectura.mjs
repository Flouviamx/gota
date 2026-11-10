// Lectura y publicaciones (reading and publishing): books by kind and by genre, reading lists and
// progress, libraries and bookstores, bookmarks, reading lights and glasses, newspapers' sections,
// comics, authors and publishers. Everything is computed with the engine (engine/geometry.mjs) on the
// rules in DESIGN.md. Three bases, adopted from archivos and never redrawn:
// - the book (its cover, its spine and its ribbon): the badges sit on it whole, and so does every glyph
//   that says a kind or a genre (headphones, bars, quotation marks, a globe, a rosette, a wand, a rocket,
//   a keyhole), at the badges' corner. Beside the spine a glyph on the cover can't be more than 6 wide
//   and turns to mush at 18 px (DESIGN.md › 'A tiny pictogram inside a container'); only the cover's
//   own image spans it, from the spine to the edge;
// - the open book (its gull-wing pages over the spine), scaled whole when something stands on it;
// - the newspaper (its page, its fold and its headline), a section's glyph in its body.
// Comics are archivos' magazine, stapled with no spine. The people are personas' bust, 2.5 to the
// left, with the object at the bottom right, as its professions carry theirs. Badges are the engine's;
// a piece on top of another (a corner glyph, a bubble, a house) is a custom badge and the engine
// clears what lies behind it.
import { arc, badge, circ, dot, drop, f, flipPath, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import comercio from './comercio.mjs';
import edicion from './edicion.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add2 = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Moves a path. */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Just the `A…` segment of an engine arc, to chain it inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rl(pts, radius = 0.6) {
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

/** A custom badge: the strokes drawn on top, the area the engine clears and their fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** Points along a path (absolute after `transform`): its vertices, its curves and arcs sampled. */
function samples(d) {
  const out = [];
  const toks = transform(d, 1, 0, 0).match(/[A-Za-z]|-?[\d.]+(?:e-?\d+)?/g);
  let [i, cur, start] = [0, [0, 0], [0, 0]];
  const n = () => Number(toks[i++]);
  while (i < toks.length) {
    const c = toks[i++];
    if (c === 'Z') {
      cur = start;
      continue;
    }
    if (c === 'M' || c === 'L') {
      cur = [n(), n()];
      if (c === 'M') start = cur;
      out.push(cur);
    } else if (c === 'H') out.push((cur = [n(), cur[1]]));
    else if (c === 'V') out.push((cur = [cur[0], n()]));
    else if (c === 'C' || c === 'Q') {
      const ps = c === 'C' ? [cur, [n(), n()], [n(), n()], [n(), n()]] : [cur, [n(), n()], [n(), n()]];
      for (let k = 1; k <= 12; k++) {
        let q = ps;
        while (q.length > 1) q = q.slice(1).map((p, j) => [q[j][0] + (p[0] - q[j][0]) * (k / 12), q[j][1] + (p[1] - q[j][1]) * (k / 12)]);
        out.push(q[0]);
      }
      cur = ps[ps.length - 1];
    } else if (c === 'A') {
      const [r, , , large, sweep, x, y] = [n(), n(), n(), n(), n(), n(), n()];
      // Endpoint to center (circular arcs only)
      const [mx, my] = [(cur[0] + x) / 2, (cur[1] + y) / 2];
      const [dx, dy] = [(x - cur[0]) / 2, (y - cur[1]) / 2];
      const h = Math.sqrt(Math.max(0, r * r - dx * dx - dy * dy)) / Math.hypot(dx, dy);
      const sgn = large === sweep ? -1 : 1;
      const ctr = [mx - sgn * h * dy, my + sgn * h * dx];
      let [a0, a1] = [Math.atan2(cur[1] - ctr[1], cur[0] - ctr[0]), Math.atan2(y - ctr[1], x - ctr[0])];
      if (sweep && a1 < a0) a1 += 2 * Math.PI;
      if (!sweep && a1 > a0) a1 -= 2 * Math.PI;
      const R = Math.hypot(cur[0] - ctr[0], cur[1] - ctr[1]);
      for (let k = 1; k <= 16; k++) {
        const a = a0 + ((a1 - a0) * k) / 16;
        out.push([ctr[0] + R * Math.cos(a), ctr[1] + R * Math.sin(a)]);
      }
      cur = [x, y];
    }
  }
  return out;
}
/** The convex hull of some paths (their points, arcs sampled), as one closed path: a badge's knock. */
function hull(ds, extra = []) {
  const pts = [...extra];
  for (const d of ds) pts.push(...samples(d));
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const p of pts) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (const p of [...pts].reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return `${line(...lo.slice(0, -1), ...up.slice(0, -1))}Z`;
}

const icons = {};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Adopted bases ─────────────────────────────────────────────────────────────────────────────
const BOOK = archivos.icons.book.d;
const [COVER, SPINE] = BOOK;
/** The spine nearer the edge, as cocina's cookbook: the cover then holds an image from it to the edge. */
const SPINE_E = vl(7.25, 2.75, 21.25);
/** Where the badges sit (their ring's center, r 4.25): the corner glyphs stay inside the ring. */
const BC = [17.25, 17.25];
const OPEN = archivos.icons['book-open'].d;
/** The open book scaled by s with its spine's foot at `foot`. */
const openAt = (s, foot) => OPEN.map((d) => place(d, s, [12, 19.75], foot));
const NEWS = archivos.icons.newspaper.d;
const PERSON = nucleo.icons.person.d;
const PERSON_L = PERSON.map((d) => move(d, -2.5, 0));
const BUST_FILL = { solid: [0, 1] };
const BUST_PARTS = { head: [0], body: [1] };

// ── The book with a badge ─────────────────────────────────────────────────────────────────────
// archivos' book whole (cover, spine and ribbon) and the engine's badge at the corner.
for (const [name, kind, tags] of [
  ['book-plus', 'plus', ['agregar libro', 'quiero leer', 'nuevo libro', 'add book', 'want to read', 'new book']],
  ['book-check', 'check', ['libro leído', 'préstamo hecho', 'terminado', 'book read', 'checked out', 'finished']],
  ['book-clock', 'clock', ['fecha de devolución', 'apartado', 'tiempo de lectura', 'due date', 'hold', 'reading time']],
  ['book-heart', 'heart', ['libro favorito', 'favoritos', 'me encanta', 'favorite book', 'favorites', 'loved']],
  ['book-search', 'search', ['buscar libro', 'catálogo', 'librería', 'find a book', 'catalog search', 'bookstore']],
  ['book-lock', 'lock', ['libro protegido', 'solo miembros', 'drm', 'locked book', 'members only', 'protected']],
  ['book-download', 'arrow-down', ['descargar libro', 'leer sin conexión', 'préstamo digital', 'download book', 'offline reading', 'borrow ebook']],
  ['book-edit', 'edit', ['escribir libro', 'anotar', 'subrayar', 'write a book', 'annotate', 'highlights']],
]) {
  add(name, tags, BOOK, { badge: badge(kind) });
  FILL[name] = { solid: [0], cut: [1, 2] };
  PARTS[name] = { cover: [0], spine: [1], ribbon: [2] };
}

// ── The glyph at the corner ───────────────────────────────────────────────────────────────────
// archivos' book whole (cover, spine and ribbon) and a glyph where the badges sit, on top: the engine
// clears the book behind it. Each glyph stays inside the badges' ring, so its clearance never reaches
// the ribbon's foot, as with the engine's own badges.
const cornerBook = (name, tags, glyph, knock, fill) => {
  add(name, tags, BOOK, { badge: own(glyph, knock, fill) });
  FILL[name] = { solid: [0], cut: [1, 2] };
  PARTS[name] = { cover: [0], spine: [1], ribbon: [2] };
};
// Barcode: the ISBN's bars, comercio's barcode: four bars 3 apart with the outer ones longer at the
// foot. On the cover, beside the spine, only three bars fit and they read as a chart.
{
  const bars = [12.75, 15.75, 18.75, 21.75].map((x, i) => vl(x, 13.75, i === 0 || i === 3 ? 21.25 : 19.75));
  cornerBook('book-barcode', ['isbn', 'código de barras', 'escanear libro', 'book barcode', 'scan book', 'isbn number'], bars, roundpoly([[12.75, 13.75], [21.75, 13.75], [21.75, 21.25], [12.75, 21.25]], 0));
}
// ── Editions ──────────────────────────────────────────────────────────────────────────────────
// Hardcover: the book standing at three quarters: the front board with its hinge, as archivos' book has
// its spine, the square spine beside it and the head above them, its thickness as deep as the boards
// are stiff.
{
  const sil = roundpoly([[4.25, 2.75], [16.25, 2.75], [19.25, 5.5], [19.25, 21.25], [7.25, 21.25], [4.25, 18.5]], [1, 1, 1, 0, 1, 1]);
  add('hardcover', ['tapa dura', 'pasta dura', 'edición de lujo', 'hardcover', 'hardback', 'edition'], [sil, line([7.25, 21.25], [7.25, 5.5], [19.25, 5.5]), line([4.25, 2.75], [7.25, 5.5]), vl(10.25, 5.5, 21.25)]);
  FILL.hardcover = { solid: [0], cut: [1, 2, 3] };
  PARTS.hardcover = { book: [0], board: [1], edge: [2], hinge: [3] };
}
// Paperback: the soft cover's top outer corner curling open over the pages: the flap rolls toward
// the middle and the pages' square corner shows behind it.
{
  const P1 = [12.75, 2.75];
  const P2 = [19.25, 9.25];
  const C = [19.25, 2.75];
  const cover = sq(4.75, 2.75, 14.5, 18.5, 2.5, { square: ['tr', 'br'] }).replace('M19.25 2.75L19.25 21.25', `M${pt(P2)}L19.25 21.25`).replace(/Z$/, `L${pt(P1)}`);
  const flap = `M${pt(P1)}Q13.25 7.25 14.75 9Q17 10.25 ${pt(P2)}Q15.25 6.75 ${pt(P1)}Z`;
  add('paperback', ['tapa blanda', 'rústica', 'edición de bolsillo', 'paperback', 'softcover', 'pocket book'], [cover, SPINE, line(P1, C, P2), flap]);
  FILL.paperback = { solid: [`${cover}L${pt(C)}Z`], cut: [1, 3] };
  PARTS.paperback = { cover: [0], spine: [1], pages: [2], curl: [3] };
}
// E-book: dispositivos' landscape tablet (its camera on the left) with the open book on its screen.
const TABLET = [sq(2.75, 4, 18.5, 16, 3.5, BR), dot(6.25, 12)];
{
  const book = OPEN.map((d) => place(d, 0.44, [12, 12.625], [14, 12]));
  add('ebook', ['libro electrónico', 'libro digital', 'edición digital', 'ebook', 'digital edition', 'e-book'], [...TABLET, ...book]);
  FILL.ebook = { solid: [0], cut: [1, 2, 3] };
  PARTS.ebook = { device: [0], camera: [1], book: [2, 3] };
}
// Audiobook: a pair of headphones, the band arched over two cups. Worn by a smaller book, with the cups
// against its sides, the headphones covered it and the pair read as a scale.
{
  const cups = [sq(12.75, 16.25, 3, 5, 1.25), sq(18.75, 16.25, 3, 5, 1.25)];
  const band = `M14.25 16.25V15.5${arcTo(17.25, 15.5, 3, 180, 360)}V16.25`;
  cornerBook('audiobook', ['audiolibro', 'escuchar libro', 'narración', 'audiobook', 'listen', 'narrated book'], [band, ...cups], `${shut(band)}${cups.join('')}`, { solid: cups, wire: [band] });
}
// Atlas: nucleo's globe at the badges' size (r 4.25), its circle, equator and the lens of its meridians.
{
  const g = nucleo.icons.globe.d.map((d) => place(d, 4.25 / 9, [12, 12], BC));
  cornerBook('atlas', ['atlas', 'geografía', 'mapas', 'atlas', 'geography', 'world maps'], g, g[0], { solid: [g[0]], cut: [g[1], g[2]] });
}
/** legal's rosette: the disc of radius r and the notched tail hanging from it. */
function rosette([cx, cy], r) {
  const a = r * 0.615;
  const top = cy + Math.sqrt(r * r - a * a);
  const end = cy + r * 2.08;
  return [circ(cx, cy, r), rl([[cx - a, top], [cx - a, end], [cx, end - r * 0.385], [cx + a, end], [cx + a, top]], [0, 0.4, 0.4, 0.4, 0])];
}
// Award: the rosette, its disc over its notched tail, the tail's notch at the foot of the ring.
{
  const r = rosette([BC[0], 15.75], 2.75);
  cornerBook('book-award', ['libro premiado', 'premio literario', 'galardón', 'award-winning book', 'literary prize', 'prize'], r, hull(r), { solid: [r[0], shut(r[1])] });
}
/** A four-pointed spark with concave sides, edicion's (its controls at k of the radius). */
const spark = (cx, cy, R, k = 0.225) => {
  const P = [[cx, cy - R], [cx + R, cy], [cx, cy + R], [cx - R, cy]];
  const c = [[1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, y]) => [cx + x * k * R, cy + y * k * R]);
  return `M${pt(P[0])}${P.map((_, i) => `Q${pt(c[i])} ${pt(P[(i + 1) % 4])}`).join('')}Z`;
};
// Fantasy: a wand pointing up at its spark. The wand's tip stands 3 from the spark's two nearest points.
{
  const c = [18.5, 14.5];
  const down = unit([-1, 1]);
  const tip = add2(c, mul(down, 4.3));
  const wand = line(tip, add2(tip, mul(down, 3.8)));
  const star = spark(...c, 2.75);
  cornerBook('book-fantasy', ['libros de fantasía', 'fantasía', 'magia', 'fantasy books', 'fantasy', 'magic'], [wand, star], hull([wand, star]), { solid: [star], wire: [wand] });
}
// Science fiction: a rocket flying up and to the right, its pointed body and a fin closed against each
// side of its foot. (Upright on the cover, 6 wide beside the spine, it read as the letter A; with its
// fins as single strokes at the corner, as a paper plane.)
{
  const at = (p) => add2(rot(p, [0, 0], 45), [18.1, 16.4]);
  const body = roundpoly([[-1.75, 3], [-1.75, -1], [0, -5], [1.75, -1], [1.75, 3]].map(at), [0.5, 2.25, 0.5, 2.25, 0.5]);
  const fins = [-1, 1].map((s) => rl([[1.75 * s, 0], [3.5 * s, 2], [3.5 * s, 4], [1.75 * s, 3]].map(at), [0, 0.5, 0.5, 0]));
  cornerBook('book-sci-fi', ['ciencia ficción', 'libros de ciencia ficción', 'espacio', 'science fiction', 'sci-fi', 'space'], [body, ...fins], hull([body, ...fins]), { solid: [body, ...fins.map(shut)] });
}
// Mystery: sistema's keyhole, a circle over a slot that widens to its foot, at 0.95 with its foot on
// the badges' ring.
{
  const k = place(sistema.icons.keyhole.d[1], 0.95, [12, 16.25], [BC[0], 21.25]);
  cornerBook('book-mystery', ['novela de misterio', 'misterio', 'suspenso', 'mystery books', 'mystery', 'thriller'], [k], k, { solid: [k] });
}

// ── Covers ────────────────────────────────────────────────────────────────────────────────────
// Cover art: dispositivos' image on the cover, the spine nearer the edge so the image runs from it to the
// edge: the sun a dot and the mountains across.
add('book-cover', ['portada', 'diseño de portada', 'arte de portada', 'book cover', 'cover art', 'cover design'], [COVER, SPINE_E, dot(11.5, 8.5), rl([[7.25, 17.5], [10.75, 14], [12.75, 16], [16, 12.75], [19.25, 16]], [0, 0.9, 0.9, 0.9, 0])]);
FILL['book-cover'] = { solid: [0], cut: [1, 2, 3] };
PARTS['book-cover'] = { cover: [0], spine: [1], image: [2, 3] };
// Antique book: archivos' cover and spine, a triangular guard over each outer corner and the clasp's
// strap fastened across the fore-edge.
{
  const strap = rl([[19.25, 10.5], [15.75, 10.5], [15.75, 13.5], [19.25, 13.5]], [0, 1, 1, 0]);
  add('antique-book', ['libro antiguo', 'libro raro', 'clásico', 'antique book', 'rare book', 'classic'], [COVER, SPINE, line([14.5, 2.75], [19.25, 7.5]), line([19.25, 16.5], [14.5, 21.25]), strap]);
  FILL['antique-book'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['antique-book'] = { cover: [0], spine: [1], guards: [2, 3], clasp: [4] };
}
// Picture book: a landscape book on the landscape keyline, its spine on the left, with a big round sun
// on its cover rising over the horizon and its rays above it, 2.9 clear of it
{
  const c = [13.5, 15.75];
  const rays = [-125, -90, -55].map((a) => line(polar(...c, 5.4, a), polar(...c, 7.5, a)));
  add('picture-book', ['libro ilustrado', 'cuento infantil', 'álbum ilustrado', 'picture book', "children's book", 'illustrated book'], [sq(2.5, 5, 19, 14, 3, BR), vl(5.5, 5, 19), hl(15.75, 5.5, 21.5), arc(...c, 2.5, 180, 360).d, ...rays]);
  FILL['picture-book'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['picture-book'] = { cover: [0], spine: [1], horizon: [2], sun: [3], rays: [4, 5, 6] };
}
/**
 * A jagged burst: spikes at the given angles (degrees, 0 = right, clockwise) reaching `reach` of the
 * ellipse's radii, with notches between them at `inner`, rounded a little.
 */
const burst = (c, rx, ry, spikes, inner = 0.55) => {
  const pts = [];
  spikes.forEach(([a, k], i) => {
    const next = spikes[(i + 1) % spikes.length][0] + (i === spikes.length - 1 ? 360 : 0);
    for (const [deg, r] of [[a, k], [(a + next) / 2, inner]]) pts.push([c[0] + rx * r * Math.cos((deg * Math.PI) / 180), c[1] + ry * r * Math.sin((deg * Math.PI) / 180)]);
  });
  return roundpoly(pts, 0.25);
};
/** The shout balloon: the burst at full size, its tail the longest spike, out to the bottom right. */
const SHOUT = burst([11.5, 11], 8.5, 7.25, [[-90, 1], [-50, 0.96], [-12, 1], [45, 1.55], [82, 0.96], [118, 1], [155, 0.95], [195, 1], [232, 0.95]], 0.8);
// Comic book: archivos' magazine (a comic is stapled, with no spine), its cover and masthead, and the
// shout balloon at half size below, its tail turned to the bottom left. (A burst on the book's cover,
// 6 wide beside the spine, read as a flower; with its tail to the right, the balloon read as a
// magnifier.)
{
  const [cover, masthead] = archivos.icons.magazine.d;
  add('comic-book', ['cómic', 'historieta', 'novela gráfica', 'comic book', 'graphic novel', 'comics'], [cover, masthead, place(flipPath(SHOUT), 0.5, [11.6, 12.2], [12, 14.1])]);
  FILL['comic-book'] = { solid: [0], cut: [1, 2] };
  PARTS['comic-book'] = { cover: [0], masthead: [1], balloon: [2] };
}

// ── Open books ────────────────────────────────────────────────────────────────────────────────
// Pop-up book: the open book with a small house standing up from its fold, in front of the pages.
{
  const book = openAt(0.85, [12, 21]);
  const house = roundpoly([[8.25, 15], [8.25, 8.75], [12, 4.75], [15.75, 8.75], [15.75, 15]], [0.8, 0.8, 1, 0.8, 0.8]);
  add('pop-up-book', ['libro desplegable', 'libro pop-up', 'cuentos', 'pop-up book', "children's stories", 'storybook'], book, { badge: own([house], house, { solid: [house] }) });
  FILL['pop-up-book'] = { solid: [0], cut: [1] };
  PARTS['pop-up-book'] = { pages: [0], spine: [1] };
}
// Bedtime story: the open book, smaller, with lugares' crescent moon rising above its fold.
{
  const book = openAt(0.75, [12, 21.25]);
  const moon = place(lugares.icons.moon.d[0], 0.38, [11.5, 12.5], [12, 5.25]);
  add('bedtime-story', ['cuento para dormir', 'hora del cuento', 'cuento infantil', 'bedtime story', 'story time', 'goodnight'], [...book, moon]);
  FILL['bedtime-story'] = { solid: [0, 2], cut: [1] };
  PARTS['bedtime-story'] = { pages: [0], spine: [1], moon: [2] };
}

// ── Around the cover ──────────────────────────────────────────────────────────────────────────
/**
 * edicion's quotation marks scaled by s about `at`, each mark moved apart so the gap between them is
 * 2.25 center to center (at edicion's spacing, scaled down, they ran together at bold).
 */
const quotes = (s, at) => {
  const shift = (2.25 - 2.3 * s) / 2;
  return edicion.icons.quote.d.map((d, i) => move(place(d, s, [11.7, 12.3], at), i ? shift : -shift, 0));
};
// Quote: the quotation marks at the corner. On the cover, beside the spine, the pair fits only with the
// marks touching.
{
  const marks = quotes(0.5, [17.1, 16.75]);
  cornerBook('book-quote', ['cita', 'frase', 'subrayado', 'book quote', 'quotation', 'highlight'], marks, hull(marks), { solid: marks });
}
// Tabs: page flags sticking out of the fore-edge (the book moves 1.5 left to make room)
{
  const tab = (y0, y1) => rl([[17.75, y0], [20.75, y0], [20.75, y1], [17.75, y1]], [0, 1, 1, 0]);
  add('book-tabs', ['marcadores de página', 'banderitas', 'pasajes', 'page flags', 'book tabs', 'sticky tabs'], [move(COVER, -1.5, 0), move(SPINE, -1.5, 0), tab(6.75, 9.25), tab(12, 14.5), tab(17.25, 19.75)]);
  FILL['book-tabs'] = { solid: [0, `${tab(6.75, 9.25)}Z`, `${tab(12, 14.5)}Z`, `${tab(17.25, 19.75)}Z`], cut: [1] };
  PARTS['book-tabs'] = { cover: [0], spine: [1], tabs: [2, 3, 4] };
}
// Review: the cover and spine with comunicacion's bubble, the drop, in front of the top right corner
{
  const bubble = drop(17, 7, 4);
  add('book-review', ['reseña', 'opinión del libro', 'crítica', 'book review', 'review', 'rating'], [COVER, SPINE], { badge: own([bubble], bubble, { solid: [bubble] }) });
  FILL['book-review'] = { solid: [0], cut: [1] };
  PARTS['book-review'] = { cover: [0], spine: [1] };
}

// ── The open book's pages ─────────────────────────────────────────────────────────────────────
// The right page's top edge is an arc (archivos' bow, sag 1.1 from the outer corner to the spine):
// its circle, to cut the edge at any point of it.
const RIGHT_TOP = (() => {
  const [p0, p1, sag] = [[21.25, 5.5], [12, 7.25], 1.1];
  const c = len(sub(p1, p0));
  const r = (c * c) / (8 * sag) + sag / 2;
  const m = mul(add2(p0, p1), 0.5);
  const t = unit(sub(p1, p0));
  // sweep 0 bulges to the right of the direction of travel (y down)
  const right = [-t[1], t[0]];
  const center = add2(m, mul(right, -(r - sag)));
  const at = (x) => [x, center[1] - Math.sqrt(r * r - (x - center[0]) ** 2)];
  return { r, center, at };
})();
// Turning a page: one page lifted from the spine in a curve, its top edge rising out of the book and
// its outer edge coming back down onto the right page's top edge
{
  const land = RIGHT_TOP.at(17.75);
  const flip = `M12 7.25Q13.25 3.5 16.75 2.75Q17.75 3.75 ${pt(land)}`;
  add('book-open-flip', ['pasar página', 'hojear', 'voltear página', 'turn the page', 'flip', 'browse'], [...OPEN, flip]);
  FILL['book-open-flip'] = { solid: [0, `${flip}${arcTo(...RIGHT_TOP.center, RIGHT_TOP.r, Math.atan2(land[1] - RIGHT_TOP.center[1], land[0] - RIGHT_TOP.center[0]) * 180 / Math.PI, Math.atan2(7.25 - RIGHT_TOP.center[1], 12 - RIGHT_TOP.center[0]) * 180 / Math.PI)}Z`], cut: [1] };
  PARTS['book-open-flip'] = { pages: [0], spine: [1], page: [2] };
}
// Dog-ear: the right page's top outer corner folded down onto it: the page cut along the fold and the
// folded flap, its tip the corner reflected across the fold
{
  const P1 = RIGHT_TOP.at(17.25);
  const P2 = [21.25, 9.75];
  const C = [21.25, 5.5];
  const u = unit(sub(P2, P1));
  const v = sub(C, P1);
  const proj = add2(P1, mul(u, v[0] * u[0] + v[1] * u[1]));
  const T = sub(mul(proj, 2), C);
  const bowTo = (p0, p1, sag, sweep) => {
    const c = len(sub(p1, p0));
    const r = (c * c) / (8 * sag) + sag / 2;
    return `A${f(r)} ${f(r)} 0 0 ${sweep} ${pt(p1)}`;
  };
  const [sT, sB, L0, L1, R1] = [[12, 7.25], [12, 19.75], [2.75, 5.5], [2.75, 18], [21.25, 18]];
  const pages = `M${pt(sT)}${bowTo(sT, L0, 1.1, 0)}L${pt(L1)}${bowTo(L1, sB, 1.1, 1)}${bowTo(sB, R1, 1.1, 1)}L${pt(P2)}L${pt(P1)}A${f(RIGHT_TOP.r)} ${f(RIGHT_TOP.r)} 0 0 0 ${pt(sT)}Z`;
  const flap = rl([P1, T, P2], [0, 0.6, 0]);
  add('book-open-dog-ear', ['doblar esquina', 'marcar página', 'oreja', 'dog-ear', 'mark page', 'folded corner'], [pages, OPEN[1], flap]);
  FILL['book-open-dog-ear'] = { solid: [0], cut: [1, 2] };
  PARTS['book-open-dog-ear'] = { pages: [0], spine: [1], fold: [2] };
}
// Reading progress: the open book, smaller, over a track with its knob two thirds along. The track is
// an arc of a wide circle (its sag under half a unit), so the knob takes a value by turning along it.
const TRACK = { c: [12, -60], r: 80 };
{
  const ang = (x) => (Math.acos((x - TRACK.c[0]) / TRACK.r) * 180) / Math.PI;
  const [a0, a1] = [ang(3.25), ang(20.75)];
  const at = a0 + (a1 - a0) * (2 / 3);
  const knob = dot(...polar(...TRACK.c, TRACK.r, at));
  add('book-open-progress', ['progreso de lectura', 'avance', 'porcentaje leído', 'reading progress', 'progress', 'how far'], [...openAt(0.75, [12, 15.75]), arc(...TRACK.c, TRACK.r, a0, a1).d, knob]);
  FILL['book-open-progress'] = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS['book-open-progress'] = { pages: [0], spine: [1], track: [2], knob: [3] };
  icons['book-open-progress'].value = { turn: { parts: ['knob'], origin: TRACK.c, from: Number(f(a0)), to: Number(f(a1)), at: Number(f(at)) } };
}

// ── Lists, readers and the people of books ────────────────────────────────────────────────────
// Reading list: the closed book (cover and spine, at 0.62) and three list lines beside it
{
  const book = [COVER, SPINE].map((d) => place(d, 0.62, [4.75, 12], [2.75, 12]));
  add('book-list', ['lista de lectura', 'por leer', 'pendientes', 'reading list', 'to read', 'book list'], [...book, hl(7, 15, 21.25), hl(12, 15, 21.25), hl(17, 15, 21.25)]);
  FILL['book-list'] = { solid: [0], cut: [1], lines: [2, 3, 4] };
  PARTS['book-list'] = { book: [0, 1], lines: [2, 3, 4] };
}
// Person reading: nucleo's person holding the open book in front of the chest: the book covers the
// shoulders whole, so only the head shows above it
add('person-reading', ['persona leyendo', 'lector', 'hora de leer', 'person reading', 'reader', 'reading time'], [PERSON[0], ...openAt(0.6, [12, 21.5])]);
FILL['person-reading'] = { solid: [0, 1], cut: [2] };
PARTS['person-reading'] = { head: [0], book: [1, 2] };

/** The objects the readers carry, at the bottom right on top of the bust, as personas' professions. */
const TOOL = {};
// A quill: the feather's vane a leaf on the diagonal, its bare barrel running on to the nib
TOOL.quill = (() => {
  const N = [13.25, 21];
  const T = [20.75, 12.5];
  const u = unit(sub(T, N));
  const S = add2(N, mul(u, 3));
  const vane = `M${pt(S)}A5.5 5.5 0 0 1 ${pt(T)}A5.5 5.5 0 0 1 ${pt(S)}Z`;
  const barrel = line(N, S);
  // It clears its hull and the corner under it, so no sliver of the bust's shoulder is left between
  // the barrel and the vane
  return own([vane, barrel], hull([vane, barrel], [[21.25, 21.25]]), { solid: [vane], wire: [barrel] });
})();
// A closed book: the cover (the signature corner) and its spine
TOOL.book = (() => {
  const cover = sq(13.75, 12.25, 7.5, 9, 1.75, BR);
  const spine = vl(16.25, 12.25, 21.25);
  return own([cover, spine], cover, { solid: [cover], cut: [spine] });
})();
for (const [name, kind, tags] of [
  ['author', 'quill', ['autor', 'escritor', 'novelista', 'author', 'writer', 'novelist']],
  ['librarian', 'book', ['bibliotecario', 'biblioteca', 'préstamos', 'librarian', 'library staff', 'archivist']],
]) {
  add(name, tags, PERSON_L, { badge: TOOL[kind] });
  FILL[name] = BUST_FILL;
  PARTS[name] = BUST_PARTS;
}

// ── Around the book ───────────────────────────────────────────────────────────────────────────
// Tassel bookmark: a tall bookmark, its foot notched as a ribbon's, with its hole and the cord leaving its
// top edge over the hole, arching over and down to the tassel hanging beside it. (A plain card with a
// hole and a cord read as a price tag.)
{
  const card = roundpoly([[4.75, 6.25], [12.75, 6.25], [12.75, 21.25], [8.75, 18.5], [4.75, 21.25]], [2, 2, 0.6, 0.75, 0.6]);
  const cord = 'M8.75 6.25C8.75 2 18 1.5 18 10.5';
  const tassel = roundpoly([[17.25, 10.5], [18.75, 10.5], [20.25, 18], [15.75, 18]], [0.4, 0.4, 0.75, 0.75]);
  add('tassel-bookmark', ['separador', 'marcapáginas', 'borla', 'bookmark', 'tassel', 'page marker'], [card, dot(8.75, 9.75), cord, tassel]);
  FILL['tassel-bookmark'] = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS['tassel-bookmark'] = { card: [0], hole: [1], cord: [2], tassel: [3] };
}
// Reading glasses: ropa's glasses (its lenses 7.5 wide, its bridge and its temples) with half-moon
// lenses, flat along their tops and shallower than ropa's. (As two half circles joined at their tops,
// with the temples rising from their ends, the pair read as a bra.)
{
  const lens = sq(3, 11, 7.5, 4.25, 2.5, { square: ['tl', 'tr'] });
  add('glasses-reading', ['lentes de lectura', 'anteojos', 'media luna', 'reading glasses', 'half-moon glasses', 'readers'], [lens, move(lens, 10.5, 0), 'M10.5 12.25A1.5 1.5 0 0 1 13.5 12.25', line([4.5, 11], [2.25, 8.5]), line([19.5, 11], [21.75, 8.5])]);
  FILL['glasses-reading'] = { solid: [0, 1], wire: [2, 3, 4] };
  PARTS['glasses-reading'] = { lenses: [0, 1], bridge: [2], temples: [3, 4] };
}

// ── Shops ─────────────────────────────────────────────────────────────────────────────────────
// Bookstore: comercio's scalloped awning over a large open book.
add('bookstore', ['librería', 'tienda de libros', 'venta de libros', 'bookstore', 'bookshop', 'book shop'], [comercio.icons.store.d[0], ...openAt(0.6, [12, 21.25])]);
FILL.bookstore = { solid: [0, 1], cut: [2] };
PARTS.bookstore = { awning: [0], book: [1, 2] };
// Newsstand: the same awning over a newspaper, as the bookstore's is over its book: archivos' newspaper
// redrawn at 0.6, its page with the square foot, the fold 2.5 out on the left, and the headline and one
// line 3 clear of the page's edges (archivos' own lines and photo, scaled, fall under the clearance). (A
// kiosk's roof over three magazines on a counter read as a birdcage; the magazines, as a small chart.)
{
  const page = sq(8.5, 12.25, 9.5, 9, 2, { square: ['br', 'bl'] });
  const fold = rl([[8.5, 15.25], [6, 15.25], [6, 21.25], [8.5, 21.25]], [0, 1, 1.25, 0]);
  add('newsstand', ['puesto de periódicos', 'kiosco', 'revistas', 'newsstand', 'kiosk', 'magazines'], [comercio.icons.store.d[0], page, fold, hl(15.25, 11.5, 15), hl(18.25, 11.5, 15)]);
  FILL.newsstand = { solid: [0, 1, 2], cut: [vl(8.5, 15.25, 22.5), 3, 4] };
  PARTS.newsstand = { awning: [0], newspaper: [1, 2], lines: [3, 4] };
}

// ── Newspapers ────────────────────────────────────────────────────────────────────────────────
// The digital edition: the tablet, its screen holding the newspaper's page: the headline, the photo and
// two lines (archivos' newspaper inside, its page the screen).
add('newspaper-digital', ['periódico digital', 'edición digital', 'noticias en línea', 'digital newspaper', 'e-paper', 'online news'], [...TABLET, ...NEWS.slice(2)]);
FILL['newspaper-digital'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
PARTS['newspaper-digital'] = { device: [0], camera: [1], headline: [2], photo: [3], lines: [4, 5] };
// The sections: the newspaper (page, fold and headline) with the section's glyph in its body.
const BODY = [14, 13.75];
const section = (name, tags, glyph) => {
  add(name, tags, [...NEWS.slice(0, 3), ...glyph]);
  FILL[name] = { solid: [0, 1], cut: [line([6.25, 9.25], [6.25, 21]), 2, ...glyph.map((_, i) => i + 3)] };
  PARTS[name] = { page: [0], fold: [1], headline: [2], glyph: glyph.map((_, i) => i + 3) };
};
/**
 * A globe: its circle, the equator and one meridian bowed to the right, on a circle of 1.9 r (at 1.6 r
 * the sliver between the meridian and the rim was too thin to survive a filled icon's cuts; nucleo's
 * lens of two meridians closes up at this size).
 */
const globe = (cx, cy, r) => [circ(cx, cy, r), hl(cy, cx - r, cx + r), `M${pt([cx, cy - r])}A${f(r * 1.9)} ${f(r * 1.9)} 0 0 1 ${pt([cx, cy + r])}`];
// World: the globe under the headline, r 3 (as big as the sports section's ball, r 3.25, the page goes
// over QA's density).
section('newspaper-world', ['internacional', 'noticias del mundo', 'sección mundo', 'world news', 'international', 'foreign news'], globe(...BODY, 3));
section('newspaper-business', ['negocios', 'economía', 'mercados', 'business news', 'markets', 'finance section'], [rl([[9.75, 16.75], [12.25, 13.75], [14.5, 15.5], [18.25, 11]], [0, 0.6, 0.6, 0])]);
section('newspaper-opinion', ['opinión', 'editorial', 'columnas', 'opinion', 'editorial', 'op-ed'], quotes(0.47, [13.6, BODY[1]]));
{
  const R = 3.25;
  const C = BODY;
  const k = R / 9;
  const rim = (a) => polar(...C, R, a);
  const ctl = (dx, dy) => [C[0] + dx * k, C[1] + dy * k];
  section('newspaper-sports', ['deportes', 'sección deportiva', 'resultados', 'sports news', 'sports section', 'scores'], [circ(...C, R), `M${pt(rim(-120))}C${pt(ctl(7.5, -5.5))} ${pt(ctl(-7.5, 5.5))} ${pt(rim(60))}`]);
}

// ── Comics ────────────────────────────────────────────────────────────────────────────────────
// Comic bubble: the shout balloon at full size, its tail the longest spike, out to the bottom right as
// the drop's corner (the comic book carries it at half size).
add('comic-bubble', ['globo de cómic', 'grito', 'onomatopeya', 'comic bubble', 'shout', 'sound effect'], [SHOUT]);
FILL['comic-bubble'] = { solid: [0] };
PARTS['comic-bubble'] = { balloon: [0] };

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : i));
  icons[name].fill = { solid: pick(spec.solid).map(shut), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Mirroring (DESIGN.md › Mirroring) ─────────────────────────────────────────────────────────
// What follows the reading direction: the page turning and the progress along the book, the list beside
// it, archivos' newspaper and its sections (mirrored there), and the pencil. The books themselves keep
// their side, as archivos' book does.
for (const name of [
  'book-open-flip', 'book-open-progress', 'book-list', 'book-edit',
  'newspaper-digital', 'newspaper-world', 'newspaper-business', 'newspaper-opinion', 'newspaper-sports',
])
  icons[name].mirror = true;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
// The badges as in archivos (the heart beats, the clock turns, the magnifier and the pencil rock, the
// arrow drops); the quill writes, the wand waves, the tassel and the lamp's chain swing, the moon
// floats, the house pops up, the rocket flies off, the ball spins and the shout and the burst go off.
const MOTION = {
  'book-heart': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.5] },
  'book-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'book-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'book-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'book-download': { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] },
  author: { effect: 'wiggle', parts: ['badge'], origin: [13.25, 21] },
  'tassel-bookmark': { effect: 'ring', parts: ['cord', 'tassel'], origin: [8.75, 6.25] },
  'bedtime-story': { effect: 'float', parts: ['moon'], vector: [0, -1.5] },
  'pop-up-book': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'book-sci-fi': { effect: 'slide', parts: ['badge'], vector: [1, -1] },
  'book-fantasy': { effect: 'wiggle', parts: ['badge'], origin: [12.77, 20.23] },
  'newspaper-sports': { effect: 'spin', parts: ['glyph'], origin: BODY },
  'comic-bubble': { effect: 'beat', parts: ['balloon'], origin: [11.5, 11] },
  'comic-book': { effect: 'beat', parts: ['balloon'], origin: [12, 14] },
  'book-open-flip': { effect: 'wiggle', parts: ['page'], origin: [12, 7.25] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
// With a badge (the engine's, or a piece on top: the corner glyphs, the house, the bubbles, the
// professions' objects): at 58 % it stops reading and the slash would cut through it, as in archivos
// and personas.
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps each icon to the pixel grid and swaps the standard badges for their pixel
// versions; only the drawings that still smudge go here. At 16 px one pixel is 1.5 of the canvas and
// pixel centers fall on 0.75 + 1.5k: the new glyphs run from pixel center to pixel center (g), with
// their diagonals at 45°, and the bases they sit on take the engine's shared adjustment (set16).
const P16 = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [P16(c), P16(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
const set16 = (name, d, fill, badge16) => {
  const sn = snapper([...d, ...Object.values(fill ?? {}).flat()]);
  icons[name].small = {
    d: d.map(sn),
    ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)])) }),
    ...(badge16 && { badge: badge16 }),
  };
};
const globe16 = (c, r) => [circ(...g(c, r), 3), pl([c - 2, r], [c + 2, r]), `M${pt(g(c, r - 2))}A3.75 3.75 0 0 1 ${pt(g(c, r + 2))}`];
// The newspaper's sections: the snapped page leaves its body in columns 6–12 and rows 7–11; the globe
// and the ball of 5 px, and the quotation marks as two 2 × 2 blobs with their tails at 45°.
const section16 = (name, glyph) => set16(name, [...NEWS.slice(0, 3), ...glyph], { solid: [NEWS[0], shut(NEWS[1])], cut: [line([6.25, 9.25], [6.25, 21]), NEWS[2], ...glyph] });
section16('newspaper-world', globe16(9, 9));
section16('newspaper-opinion', [dot(12, 15, 0.75), pl([8, 8], [9, 7]), dot(16.5, 15, 0.75), pl([11, 8], [12, 7])]);
{
  const [C, R] = [g(9, 9), 3];
  const k = R / 9;
  section16('newspaper-sports', [circ(...C, R), `M${pt(polar(...C, R, -120))}C${pt([C[0] + 7.5 * k, C[1] - 5.5 * k])} ${pt([C[0] - 7.5 * k, C[1] + 5.5 * k])} ${pt(polar(...C, R, 60))}`]);
}
// Audiobook: the pixel headphones at the badges' corner: two solid cups 2 px wide and the band over
// them, its shoulders at 45°.
{
  const cups = [sq(P16(9), P16(11), 1.5, 4.5, 0.4), sq(P16(13), P16(11), 1.5, 4.5, 0.4)];
  const band = pl([10, 11], [10, 9], [11, 8], [12, 8], [13, 9], [13, 11]);
  set16('audiobook', BOOK, icons.audiobook.fill, { d: [band, ...cups], knock: roundpoly([g(9, 8), g(14, 8), g(14, 14), g(9, 14)], 0), fill: { solid: cups, wire: [band] } });
}
// Quote: the marks as two 2 × 2 blobs at the badges' corner, their tails at 45°.
{
  const marks = [dot(15, 18, 0.75), pl([10, 10], [11, 9]), dot(19.5, 18, 0.75), pl([13, 10], [14, 9])];
  set16('book-quote', BOOK, icons['book-quote'].fill, { d: marks, knock: roundpoly([g(9, 9), g(14, 9), g(14, 12), g(9, 12)], 0), fill: { solid: [marks[0], marks[2]], wire: [marks[1], marks[3]] } });
}
// Paperback: the curl, its two curves a grey smudge at 16 px, as a straight fold: the corner cut on the
// diagonal and its flap a triangle turned onto the cover, the corner reflected across the fold.
{
  const [P1, P2] = [[12.75, 2.75], [19.25, 9.25]];
  const cover = `${icons.paperback.d[0]}Z`;
  const flap = roundpoly([P1, P2, [12.75, 9.25]], [0.3, 0.3, 0.6]);
  set16('paperback', [cover, SPINE, flap], { solid: [cover], cut: [SPINE, flap] });
}
// The genres' glyphs at the badges' pixel (11, 11), as the engine's pixel badges: a globe of 5 px with
// one meridian (nucleo's lens closes up at this size), the rosette's disc over its notched tails, the
// keyhole as a dot over its stem, and the wand at 45° under a smaller spark.
{
  const corner16 = (name, d, fill) => set16(name, BOOK, icons[name].fill, { d, knock: hull(d), fill });
  const world = globe16(11, 11);
  corner16('atlas', world, { solid: [world[0]], cut: [world[1], world[2]] });
  const seal = [circ(...g(11, 9), 3), pl([10, 12], [10, 14], [11, 13], [12, 14], [12, 12])];
  corner16('book-award', seal, { solid: [seal[0], shut(seal[1])] });
  const key = [circ(...g(11, 10), 1.5), pl([11, 11], [11, 13])];
  corner16('book-mystery', key, { solid: [key[0]], wire: [key[1]] });
  const wand = [pl([8, 14], [10, 12]), spark(...g(12, 9), 2.25, 0.2)];
  corner16('book-fantasy', wand, { solid: [wand[1]], wire: [wand[0]] });
}

export default { category: 'lectura', label: 'Lectura y publicaciones', icons };
