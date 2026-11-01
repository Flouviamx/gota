// Educación (education): schools and campus places, the classroom, school
// supplies, early learning, exercises and exams, homework and grades, courses and online learning,
// students and teachers, and credentials. Everything is computed with the engine
// (engine/geometry.mjs) on the rules in DESIGN.md. The category adopts lugares' `graduation-cap`
// and `school` (drawn there, never redrawn): every mortarboard here is graduation-cap's own, placed
// at one of two sizes (MB_IN inside a container, MB_ON resting on an object), its board and cap
// without the tassel where the tassel would hang closer than 3 to the cap (inside the laurel, where
// the cap's hollow closed up, its board and tassel, as rrhh's job-training). The people are personas'
// bust, Núcleo's person: centered when the attribute is worn, 2.5 to the left when it carries an
// object at the bottom right (a custom badge the engine clears). The documents (exam, homework,
// essay, permission slip) are Núcleo's document, the books archivos' book and open book, the roofs
// bebes' daycare roof and lugares' gable. Badges are the engine's, and any piece
// that sits on top of another is a custom badge the engine clears with exact clearance: nothing is
// trimmed by hand.
//
// One approved icon is not drawn: `class-schedule`, since a weekly grid of five day columns leaves
// cells 3.5 wide, where nothing can mark a filled cell in outline (a dot needs 4.4 between the grid's
// lines); every version read as a plain table or as calendario's calendar-week.
import { arc, badge, circ, dot, f, halfChord, line, polar, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import bebes from './bebes.mjs';
import comunicacion from './comunicacion.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import frutas from './frutas-verduras.mjs';
import gestos from './gestos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import oficina from './oficina.mjs';
import social from './social.mjs';

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
/** Moves a path. */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** A custom piece on top of the drawing: the engine clears `knock` around it. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

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
/** A horizontal capsule (both ends round) from x to x + w, y to y + h: exact half circles (sq's at full
 *  radius left a sliver its outline couldn't follow). */
const pill = (x, y, w, h) => bar([x + h / 2, y + h / 2], [x + w - h / 2, y + h / 2], h / 2);
/**
 * Comercio's dollar sign (its function, which the category doesn't export): the S with its stubs, and
 * the two tails, each stretched to at least 2.1 long.
 */
function dollar(cx, cy, h, w = h * 0.68, stub = 1.5, top = stub) {
  const ry = h / 4;
  const rx = w / 2;
  const at = (c, deg) => [c[0] + rx * Math.cos((deg * Math.PI) / 180), c[1] + ry * Math.sin((deg * Math.PI) / 180)];
  const up = [cx, cy - ry];
  const lo = [cx, cy + ry];
  const T0 = [cx, cy - h / 2];
  const B0 = [cx, cy + h / 2];
  const R = `${f(rx)} ${f(ry)}`;
  let tail = -28;
  const arcLen = (t) => {
    let L = 0;
    for (let a = -90; a < t; a += 1) L += len(sub(at(up, a + 1), at(up, a)));
    return L;
  };
  while (arcLen(tail) < 2.1 && tail < -5) tail += 1;
  return [
    `M${pt([cx, T0[1] - top])}L${pt(T0)}A${R} 0 0 0 ${pt([cx, cy])}A${R} 0 0 1 ${pt(B0)}L${pt([cx, B0[1] + stub])}`,
    `M${pt(T0)}A${R} 0 0 1 ${pt(at(up, tail))}`,
    `M${pt(B0)}A${R} 0 0 1 ${pt(at(lo, tail + 180))}`,
  ];
}

const icons = {};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
// Lugares' mortarboard: [board, cap, tassel], its board centered on (12, 9.75), 18.5 by 9.5; the cap
// hangs 9.25 below that center and the tassel 7.75 to its right.
const GC = lugares.icons['graduation-cap'].d;
const GC_O = [12, 9.75];
/** The mortarboard at scale s with its board's center at `to`: { board, cap, tassel }. */
const mortar = (s, to) => {
  const [board, cap, tassel] = GC.map((d) => place(d, s, GC_O, to));
  return { board, cap, tassel, top: to[1] - 4.75 * s, bottom: to[1] + 9.25 * s, half: 9.25 * s };
};
/** The two sizes of the piece: inside a container, and resting on an object. */
const MB_IN = 0.39;
const MB_ON = 0.55;
/** Board and cap as one piece on top of another: drawn, cleared, filled. */
const capPiece = (m) => own([m.board, m.cap], `${m.board}${shut(m.cap)}`, { solid: [m.board, shut(m.cap)] });

const DOC = nucleo.icons.document.d[0];
const PERSON = nucleo.icons.person.d;
const PERSON_L = PERSON.map((d) => move(d, -2.5, 0));
const BUST_FILL = { solid: [0, 1] };
const BUST_PARTS = { head: [0], body: [1] };
/**
 * Núcleo's person scaled from the feet (personas' personAt): the head moves up to keep its gap from
 * the shoulders, never less than 2.35 between them.
 */
const personAt = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};
const BOOK = archivos.icons.book.d;
const BOOK_OPEN = archivos.icons['book-open'].d;
const APPLE = frutas.icons.apple.d;
/**
 * The apple at a small size: its fruit and stem, and the leaf as one curved stroke from the stem's tip
 * (scaled down, the leaf's lens closed up at weight 2.1).
 */
const APPLE_SMALL = [APPLE[0], APPLE[1], 'M12.9 4.5Q15.75 4.75 17.75 2.75'];

// ── Places ────────────────────────────────────────────────────────────────────────────────────
// University: three columns on a wide step under the mortarboard's board as the roof, its tassel
// hanging at the right corner (no pediment: the cap names it). The columns stand 3 clear of the
// tassel's end and of the board's lower point.
{
  const m = mortar(0.8, [12, 6.55]);
  const cols = [8, 12, 16].map((x) => vl(x, 13.5, 17.5));
  add('university', ['universidad', 'facultad', 'campus', 'educación superior', 'university', 'college', 'campus'], [m.board, m.tassel, ...cols, hl(20.5, 3.25, 20.75)]);
  FILL.university = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS.university = { roof: [0], tassel: [1], columns: [2, 3, 4], step: [5] };
}
// Kindergarten: daycare's pitched roof over one toy block standing on the ground: datos' cube (a
// square front face with its top and side 2.5 deep, open at weight 2.1), a letter A across its face.
const cube = (x0, yb, w, dp) => {
  const yt = yb - w;
  const [dx, dy] = dp;
  return [
    roundpoly([[x0, yb], [x0, yt], [x0 + dx, yt + dy], [x0 + w + dx, yt + dy], [x0 + w + dx, yb + dy], [x0 + w, yb]], [0.6, 0.6, 0.6, 0.6, 0.6, 0.6]),
    line([x0, yt], [x0 + w, yt], [x0 + w + dx, yt + dy]),
    vl(x0 + w, yt, yb),
  ];
};
/**
 * A capital A standing on y = yb, apex at (cx, ya), legs ending at cx ± hw. It spans its block's whole
 * face, from the middle of its top edge to its bottom corners: smaller, its counter closed up at weight
 * 2.1, and its feet left slivers of the face that came and went.
 */
const letterA = (cx, ya, yb, hw) => {
  const L = [cx - hw, yb];
  const R = [cx + hw, yb];
  const t = 0.6;
  return [line(L, [cx, ya], R), line(lerp([cx, ya], L, t), lerp([cx, ya], R, t))];
};
{
  const roof = bebes.icons.daycare.d[0];
  const block = cube(6.5, 20.75, 8, [2.5, -2.5]);
  add('kindergarten', ['kínder', 'preescolar', 'jardín de niños', 'educación inicial', 'kindergarten', 'preschool', 'nursery school'], [roof, ...block, ...letterA(10.5, 12.75, 20.75, 4), hl(20.75, 2.75, 21.25)]);
  FILL.kindergarten = { solid: [1], cut: [2, 3, 4, 5], wire: [6], lines: [0] };
  PARTS.kindergarten = { roof: [0], block: [1, 2, 3], letter: [4, 5], ground: [6] };
}
// Dormitory: lugares' gable over hogar's bunk bed, standing on the ground: its posts, its two decks,
// each with its pillow (a dot resting on the deck) and the ladder leaning on the foot.
{
  const apex = [12, 2.75];
  const PITCH = 7.75 / 9.25;
  const gable = rl([[2.75, apex[1] + 9.25 * PITCH], apex, [21.25, apex[1] + 9.25 * PITCH]], [0, 1.25, 0]);
  const [x0, x1] = [6.75, 15.25];
  const decks = [13, 17.75];
  add('dormitory', ['residencia estudiantil', 'dormitorio', 'internado', 'alojamiento', 'dormitory', 'dorm', 'student housing'], [
    gable,
    hl(20.75, 2.75, 21.25),
    vl(x0, 11, 20.75),
    vl(x1, 11, 20.75),
    hl(decks[0], x0, x1),
    hl(decks[1], x0, x1),
    dot(10.75, decks[0] - 1.4, 1),
    dot(10.75, decks[1] - 1.4, 1),
    line([x1, decks[0]], [18.25, 20.75]),
  ]);
  FILL.dormitory = false;
  PARTS.dormitory = { roof: [0], ground: [1], bed: [2, 3, 4, 5], pillows: [6, 7], ladder: [8] };
}
// Homeschool: the house's walls and door under the mortarboard's board as its roof, the tassel hanging
// at the eave, 3 clear of the wall.
{
  const m = mortar(1, [12, 7.5]);
  const eave = (x) => 12.25 - Math.abs(x - 12) * (4.75 / 9.25);
  const walls = rl([[7.25, eave(7.25)], [7.25, 20.75], [16.75, 20.75], [16.75, eave(16.75)]], [0, 2.5, 0, 0]);
  const door = rl([[10.25, 20.75], [10.25, 16.25], [13.75, 16.25], [13.75, 20.75]], [0, 1.25, 1.25, 0]);
  add('homeschool', ['educación en casa', 'escuela en casa', 'homeschool', 'aprender en casa', 'homeschooling', 'home school', 'learning at home'], [m.board, walls, door, m.tassel]);
  FILL.homeschool = { solid: [0, shut(walls)], cut: [2], wire: [3] };
  PARTS.homeschool = { roof: [0], walls: [1], door: [2], tassel: [3] };
}
// School on the map: lugares' map pin with the mortarboard in its head, as transito's map-pin-bus.
{
  const pin = lugares.icons['map-pin'].d[0];
  const m = mortar(MB_IN, [12, 9.3]);
  add('map-pin-school', ['escuela en el mapa', 'escuelas cercanas', 'ubicación del campus', 'school location', 'schools nearby', 'campus map'], [pin, m.board, m.cap]);
  FILL['map-pin-school'] = { solid: [0], cut: [1, 2] };
  PARTS['map-pin-school'] = { pin: [0], cap: [1, 2] };
  icons['map-pin-school'].motion = { effect: 'bounce', vector: [0, -2] };
}

// ── The classroom ─────────────────────────────────────────────────────────────────────────────
// Chalkboard: the framed board (a container: the drop's corner) with a short sum in chalk, a plus over
// its rule; its tray runs along the bottom edge past both sides, the felt eraser resting on it. (A stick
// of chalk beside the eraser, or a tray hanging below the board, read as a monitor and its stand.)
const BOARD = sq(3.75, 3.25, 16.5, 15, 2.5, BR);
const TRAY = [hl(18.25, 2.25, 21.75), rl([[13.25, 18.25], [13.25, 15.25], [17.75, 15.25], [17.75, 18.25]], [0, 0.75, 0.75, 0])];
add('chalkboard', ['pizarrón', 'pizarra', 'gis', 'lección', 'chalkboard', 'blackboard', 'lesson'], [BOARD, vl(10.5, 6.25, 9.25), hl(7.75, 9, 12), hl(12.25, 7.25, 16.75), ...TRAY]);
FILL.chalkboard = { solid: [0], cut: [1, 2, 3, 5], wire: [4] };
PARTS.chalkboard = { board: [0], sum: [1, 2, 3], tray: [4], eraser: [5] };
add('chalkboard-play', ['clase en video', 'lección grabada', 'video educativo', 'video lesson', 'recorded class', 'lesson video'], [BOARD, roundpoly([[9.75, 6.5], [14.25, 9.25], [9.75, 12]], 0.75), ...TRAY]);
FILL['chalkboard-play'] = { solid: [0], cut: [1, 3], wire: [2] };
PARTS['chalkboard-play'] = { board: [0], play: [1], tray: [2], eraser: [3] };

// School bell: a hand bell, its long handle rising from the crown, the bell flaring to its rim and the
// clapper showing below it.
{
  const handle = rl([[10.5, 9.75], [10.5, 2.75], [13.5, 2.75], [13.5, 9.75]], [0, 1.5, 1.5, 0]);
  const bell = 'M4.5 17.5C6.75 17 8 15.25 8.25 12.5L8.4 11.1A1.5 1.5 0 0 1 9.9 9.75H14.1A1.5 1.5 0 0 1 15.6 11.1L15.75 12.5C16 15.25 17.25 17 19.5 17.5Z';
  const clapper = 'M9.85 20.5a2.35 2.35 0 0 0 4.3 0';
  add('school-bell', ['campana escolar', 'timbre', 'cambio de clase', 'recreo', 'school bell', 'class bell', 'bell schedule'], [bell, clapper, handle]);
  FILL['school-bell'] = { solid: [0, shut(clapper)], wire: [2] };
  PARTS['school-bell'] = { body: [0], clapper: [1], handle: [2] };
  icons['school-bell'].motion = { effect: 'ring', origin: [12, 2.75] };
}
// Satchel: a boxy bag (the drop's corner) with its curved flap, the two straps that close it running
// down from its edge, and the handle on top.
{
  const body = sq(3.25, 7.25, 17.5, 14, 3, BR);
  const flap = 'M3.25 11.75C7 14.5 17 14.5 20.75 11.75';
  const flapY = (x) => {
    // The flap's curve at x (a cubic symmetric about 12, sampled)
    const B = (t) => [(1 - t) ** 3 * 3.25 + 3 * (1 - t) ** 2 * t * 7 + 3 * (1 - t) * t * t * 17 + t ** 3 * 20.75, (1 - t) ** 3 * 11.75 + 3 * (1 - t) ** 2 * t * 14.5 + 3 * (1 - t) * t * t * 14.5 + t ** 3 * 11.75];
    let [lo, hi] = [0, 1];
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (B(m)[0] < x) lo = m;
      else hi = m;
    }
    return B(lo)[1];
  };
  const straps = [8.25, 15.75].map((x) => vl(x, flapY(x), 17.75));
  add('satchel', ['cartera escolar', 'portafolio escolar', 'bolsa de libros', 'mochila', 'satchel', 'bookbag', 'school bag'], [body, flap, ...straps, rl([[8.75, 7.25], [8.75, 3.75], [15.25, 3.75], [15.25, 7.25]], [0, 1.5, 1.5, 0])]);
  FILL.satchel = { solid: [0], cut: [1, 2, 3], lines: [4] };
  PARTS.satchel = { bag: [0], flap: [1], straps: [2, 3], handle: [4] };
}
// Graphing calculator: tall, its wide screen showing a curve over a short grid of keys.
{
  const body = sq(5.25, 2.75, 13.5, 18.5, 3.25, BR);
  const screen = sq(7.75, 5.25, 8.5, 6.75, 1.25);
  const curve = 'M9.5 12C10.5 9.75 12.75 8 16.25 8';
  const keys = [];
  for (const y of [15.25, 18.25]) for (const x of [9, 12, 15]) keys.push(dot(x, y, 0.3));
  add('calculator-graphing', ['calculadora graficadora', 'calculadora científica', 'matemáticas', 'graphing calculator', 'scientific calculator', 'math'], [body, screen, curve, ...keys]);
  FILL['calculator-graphing'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] };
  PARTS['calculator-graphing'] = { body: [0], screen: [1, 2], keys: [3, 4, 5, 6, 7, 8] };
}
// Abacus: the frame and its wires, each holding its beads (dots, overlapping where they are pushed
// together, so they stay one piece at every weight), some to the left and some to the right. Two wires:
// with three, the frame, wires and beads came to over a third of the canvas in ink.
{
  const frame = sq(4, 4, 16, 16, 2.5);
  const wires = [9.25, 14.75].map((y) => hl(y, 4, 20));
  const beads = [
    [9.25, [7, 9.1, 17]],
    [14.75, [7, 14.9, 17]],
  ].flatMap(([y, xs]) => xs.map((x) => dot(x, y, 0.85)));
  add('abacus', ['ábaco', 'contar', 'aritmética', 'matemáticas', 'abacus', 'counting', 'arithmetic'], [frame, ...wires, ...beads]);
  FILL.abacus = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] };
  PARTS.abacus = { frame: [0], wires: [1, 2], beads: [3, 4, 5, 6, 7, 8] };
}
// Alphabet blocks: two toy cubes side by side and one on top, flush with their front, the cube's
// language of kindergarten's block; the left one has the A on its face. One silhouette, the edges
// between the cubes drawn inside it.
{
  const [w, k] = [6.5, 2.25];
  const [x0, yb] = [4.125, 20.125];
  const yt = yb - w;
  const [c0, c1] = [x0 + w / 2, x0 + w * 1.5];
  const outline = roundpoly([
    [x0, yb], [x0, yt], [x0 + k, yt - k], [c0, yt - k], [c0, yt - w], [c0 + k, yt - w - k], [c1 + k, yt - w - k], [c1 + k, yt - k],
    [x0 + 2 * w + k, yt - k], [x0 + 2 * w + k, yb - k], [x0 + 2 * w, yb],
  ], [0.6, 0.6, 0.6, 0, 0.6, 0.6, 0.6, 0, 0.6, 0.6, 0.6]);
  add('alphabet-blocks', ['cubos con letras', 'abc', 'bloques', 'preescolar', 'alphabet blocks', 'abc blocks', 'toy blocks'], [
    outline,
    line([x0, yt], [x0 + 2 * w, yt], [x0 + 2 * w + k, yt - k]),
    vl(x0 + w, yt, yb),
    vl(x0 + 2 * w, yt, yb),
    line([c0, yt - w], [c1, yt - w], [c1 + k, yt - w - k]),
    vl(c1, yt - w, yt),
    ...letterA(x0 + w / 2, yt, yb, w / 2 - 0.5),
  ]);
  FILL['alphabet-blocks'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS['alphabet-blocks'] = { blocks: [0, 1, 2, 3, 4, 5], letter: [6, 7] };
}

// ── Early learning ────────────────────────────────────────────────────────────────────────────
// Times tables: a 3 × 3 table (the drop's corner) whose top-left cell is left open, the times sign
// standing free in it where the table's corner would be, as a printed times table puts it. (The sign
// drawn across a closed corner cell, edge to edge, read as a crossed-out cell.)
{
  const [g, h] = [11, 15.5];
  // The frame without its top-left corner: from the header row's top to the header column's side
  const [o, e] = [4.25, 19.75];
  const frame = sq(o, o, e - o, e - o, 3, { square: ['tl', 'br'] }).replace(/^M/, `M${g} ${o}L`).replace(new RegExp(`L${o} ${o}Z$`), `L${o} ${g}`);
  add('multiplication-table', ['tablas de multiplicar', 'multiplicación', 'matemáticas', 'aritmética', 'multiplication table', 'times tables', 'math'], [
    frame,
    vl(g, o, e),
    hl(g, o, e),
    vl(h, o, e),
    hl(h, o, e),
    line([5.25, 5.25], [8, 8]),
    line([8, 5.25], [5.25, 8]),
  ]);
  // Filled: the L of the table, closed around the open cell, its inner lines cut out
  FILL['multiplication-table'] = { solid: [`${frame}L${g} ${g}Z`], cut: [vl(g, g, e), hl(g, g, e), 3, 4], wire: [5, 6] };
  PARTS['multiplication-table'] = { table: [0, 1, 2, 3, 4], sign: [5, 6] };
}

// ── Exercises and exams ───────────────────────────────────────────────────────────────────────
// Exam: an answer sheet, Núcleo's document with three rows of bubbles, one filled in each (the empty
// ones rings, the filled one a dot, as controles' survey). Two to a row: three rings in a row would
// stand under 1 apart on the page. The bubbles under the badges' corner are a dot or a whole ring, so
// a badge never leaves a sliver.
const RING = (x, y) => circ(x, y, 1.5);
const EXAM = [DOC, RING(9.25, 6.75), dot(14.75, 6.75, 1), RING(9.25, 12), dot(14.75, 12, 1), dot(9.25, 17.25, 1), RING(14.75, 17.25)];
const EXAM_FILL = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
const EXAM_PARTS = { page: [0], options: [1, 3, 6], chosen: [2, 4, 5] };
add('exam', ['examen', 'prueba', 'evaluación', 'opción múltiple', 'exam', 'test', 'assessment'], EXAM);
add('exam-check', ['examen aprobado', 'calificado', 'evaluado', 'exam passed', 'graded', 'test passed'], EXAM, { badge: badge('check') });
// Answer key and proctoring: the sheet with a piece of its own at the corner, inside the badges' circle
// and clearing all of it, as the engine's glyph badges do (the bubbles there go the same way under
// the check): a key on the diagonal, its bow, shaft and bit; Núcleo's key at that size lost its teeth.
const BADGE_RING = circ(17.25, 17.25, 4.25);
{
  const u = unit([1, -1]);
  const n = [-u[1], u[0]];
  const bowC = [15, 19.5];
  const r = 1.85;
  const at = (s, o = 0) => add2(bowC, add2(mul(u, s), mul(n, o)));
  const bow = circ(...bowC, r);
  const shaft = line(at(r), at(7.75));
  const bit = line(at(6.25), at(6.25, 2.25));
  add('answer-key', ['clave de respuestas', 'solucionario', 'respuestas correctas', 'answer key', 'solutions', 'answers'], EXAM, { badge: own([bow, shaft, bit], `${BADGE_RING}${shaft}${bit}`, { solid: [bow], wire: [shaft, bit] }) });
}
// Proctoring: an eye (edicion's) at the corner, its pupil a dot
{
  const eye = place(edicion.icons.eye.d[0], 9 / 18.5, [12, 12], [17.25, 17.25]);
  const pupil = dot(17.25, 17.25);
  add('proctoring', ['supervisión de examen', 'examen vigilado', 'proctor', 'monitoreo', 'proctoring', 'proctored exam', 'invigilation'], EXAM, { badge: own([eye, pupil], BADGE_RING, { solid: [eye], cut: [pupil] }) });
}
for (const name of ['exam', 'exam-check', 'answer-key', 'proctoring']) {
  FILL[name] = EXAM_FILL;
  PARTS[name] = EXAM_PARTS;
}
// Plagiarism: archivos' two pages (the one behind as its open corner) with lines on the front one,
// and the engine's magnifier.
{
  const F = archivos.icons.files.d;
  add('plagiarism', ['plagio', 'originalidad', 'copia', 'detector de plagio', 'plagiarism', 'originality check', 'copied work'], [F[0], F[1], hl(10.25, 11, 17), hl(13.75, 11, 17), hl(17.25, 11, 13.5)], { badge: badge('search') });
  FILL.plagiarism = { solid: [0], cut: [2, 3, 4], lines: [1] };
  PARTS.plagiarism = { front: [0, 2, 3, 4], back: [1] };
}
// Quiz: a large question mark over two answer pills side by side, the left one filled (dots that
// overlap at every weight: a solid pill), the right one an outline of the same size.
{
  const c = [12, 6];
  const r = 3.25;
  const qm = `M${pt([c[0] - r, c[1]])}${arc(...c, r, 180, 400).d.replace(/^M[^A]*/, '')}L${pt([c[0], c[1] + r + 0.4])}`;
  const chosen = Array.from({ length: 9 }, (_, i) => dot(5.25 + i * 0.5625, 18.5, 1));
  add('quiz', ['cuestionario', 'pregunta', 'trivia', 'repaso', 'quiz', 'question', 'knowledge check'], [qm, dot(12, 13.25), ...chosen, pill(13.25, 17.125, 7.5, 2.75)]);
  FILL.quiz = false;
  PARTS.quiz = { question: [0, 1], chosen: chosen.map((_, i) => i + 2), option: [11] };
}
// Fill in the blank: three lines of text, the middle one broken by the blank, an empty slot where its
// word goes. (The blank as an underline set below its line read as dashes out of step.)
{
  const slot = sq(11.25, 10, 9.5, 4, 1.5);
  add('fill-in-the-blank', ['completar espacios', 'rellenar', 'ejercicio', 'llenar huecos', 'fill in the blank', 'cloze', 'gap fill'], [hl(6.5, 3.25, 20.75), hl(12, 3.25, 8.25), slot, hl(17.5, 3.25, 14.75)]);
  FILL['fill-in-the-blank'] = { solid: [2], wire: [0, 1, 3] };
  PARTS['fill-in-the-blank'] = { text: [0, 1, 3], blank: [2] };
}
// Essay: the page with a short centered title over a paragraph whose first line is indented.
add('essay', ['ensayo', 'redacción', 'composición', 'trabajo escrito', 'essay', 'composition', 'written assignment'], [DOC, hl(7.25, 10.25, 13.75), hl(11, 11.25, 15.25), hl(14.5, 8.75, 15.25), hl(18, 8.75, 13)]);
FILL.essay = { solid: [0], cut: [1, 2, 3, 4] };
PARTS.essay = { page: [0], title: [1], text: [2, 3, 4] };

// ── Homework and grades ───────────────────────────────────────────────────────────────────────
// Homework: a loose-leaf sheet (Núcleo's document) punched down its left edge, its margin line and
// three ruled lines running from the margin.
const HOMEWORK = [DOC, dot(7.75, 7.25), dot(7.75, 12), dot(7.75, 16.75), vl(10.75, 2.75, 21.25), hl(8.75, 10.75, 16.25), hl(12.5, 10.75, 16.25), hl(16.25, 10.75, 16.25)];
for (const [name, tags, kind] of [
  ['homework', ['tarea', 'deberes', 'trabajo escolar', 'actividad', 'homework', 'assignment', 'coursework'], null],
  ['homework-check', ['tarea entregada', 'tarea hecha', 'actividad completa', 'assignment done', 'turned in', 'homework done'], 'check'],
  ['homework-clock', ['tarea por entregar', 'fecha de entrega', 'tarea atrasada', 'assignment due', 'due soon', 'late homework'], 'clock'],
  ['homework-arrow-up', ['entregar tarea', 'subir tarea', 'enviar trabajo', 'turn in', 'submit assignment', 'upload homework'], 'arrow-up'],
]) {
  add(name, tags, HOMEWORK, kind ? { badge: badge(kind) } : {});
  FILL[name] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
  PARTS[name] = { sheet: [0], holes: [1, 2, 3], margin: [4], lines: [5, 6, 7] };
}
// Report card: a landscape card (the drop's corner) with three rows, each a subject line and its grade
// box, the boxes a column split in three. (Its header band brought the card over the ink the set allows.)
add('report-card', ['boleta de calificaciones', 'boleta', 'calificaciones', 'historial académico', 'report card', 'grades', 'transcript'], [
  sq(2.5, 5, 19, 14, 3, BR),
  vl(16.5, 5, 19),
  hl(10.25, 16.5, 21.5),
  hl(13.75, 16.5, 21.5),
  hl(8.5, 5.5, 13.5),
  hl(12, 5.5, 13.5),
  hl(15.5, 5.5, 11),
]);
FILL['report-card'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
PARTS['report-card'] = { card: [0], grades: [1, 2, 3], subjects: [4, 5, 6] };
// Attendance: a roster of three rows, each a small head and shoulders (the head resting on them: one
// piece at every weight) and its tick, the last row's tick an x.
{
  const who = (a) => [dot(5.5, a - 1.4, 1), arc(5.5, a + 2, 2, 180, 360).d];
  const rows = [5.25, 11.95, 18.65];
  const tick = (m) => line([12.75, m], [14.75, m + 1.75], [18.75, m - 1.75]);
  const cross = (m) => [line([14.25, m - 1.6], [17.45, m + 1.6]), line([17.45, m - 1.6], [14.25, m + 1.6])];
  add('attendance', ['asistencia', 'pase de lista', 'presentes', 'faltas', 'attendance', 'roll call', 'present'], [...rows.flatMap(who), tick(rows[0]), tick(rows[1]), ...cross(rows[2])]);
  FILL.attendance = false;
  PARTS.attendance = { students: [0, 1, 2, 3, 4, 5], marks: [6, 7, 8, 9] };
}

// ── Study tools ───────────────────────────────────────────────────────────────────────────────
// Dictionary: archivos' book, its spine band, and the thumb index: three half-moon bites stepping down
// its fore-edge (the cover's own outline, so the bites hold at every weight, filled too).
{
  const bites = [8.75, 13.25, 17.75].map((y) => `L19.25 ${f(y - 1.5)}A1.5 1.5 0 0 0 19.25 ${f(y + 1.5)}`).join('');
  const cover = transform(BOOK[0], 1, 0, 0).replace('L19.25 21.25', `${bites}L19.25 21.25`);
  add('dictionary', ['diccionario', 'vocabulario', 'definiciones', 'idiomas', 'dictionary', 'definitions', 'vocabulary'], [cover, BOOK[1]]);
  FILL.dictionary = { solid: [0], cut: [1] };
  PARTS.dictionary = { cover: [0], spine: [1] };
}

// ── Courses and learning ──────────────────────────────────────────────────────────────────────
// Course: archivos' open book with the mortarboard resting in the fold of its pages.
{
  const book = BOOK_OPEN.map((d) => place(d, 0.85, [12, 19.75], [12, 20.75]));
  const m = mortar(MB_ON, [12, 11.25 - 9.25 * MB_ON]);
  add('course', ['curso', 'materia', 'mis cursos', 'catálogo de cursos', 'course', 'class', 'subject'], book, { badge: capPiece(m) });
  FILL.course = { solid: [0], cut: [1] };
  PARTS.course = { book: [0, 1] };
}
// Course progress: a ring drawn as far as the value (from the top, clockwise) around the mortarboard.
{
  const ring = 'M12 3A9 9 0 1 1 12 21A9 9 0 1 1 12 3';
  const m = mortar(MB_ON, [12, 12 - (9.25 - 4.75) * MB_ON / 2]);
  add('course-progress', ['progreso del curso', 'avance', 'completado', 'porcentaje', 'course progress', 'completion', 'progress'], [ring, m.board, m.cap]);
  FILL['course-progress'] = { solid: [shut(ring)], cut: [1, 2] };
  PARTS['course-progress'] = { ring: [0], cap: [1, 2] };
  icons['course-progress'].value = { draw: ['ring'] };
  icons['course-progress'].variants = { circle: false };
}
// Graduated: lugares' graduation cap with the engine's check.
add('graduation-cap-check', ['graduado', 'curso completado', 'titulado', 'egresado', 'graduated', 'course completed', 'graduation'], GC, { badge: badge('check') });
FILL['graduation-cap-check'] = { solid: [0, shut(GC[1])], wire: [2] };
PARTS['graduation-cap-check'] = { board: [0], cap: [1], tassel: [2] };
// Online learning: dispositivos' laptop with the mortarboard on its screen, at the inside size, as the
// calendar carries it. (Sitting on the lid's top edge, the cap and the lid read as a graduate's bust.)
{
  const L = dispositivos.icons.laptop.d;
  const m = mortar(MB_IN, [12, 9.25]);
  add('online-learning', ['aprendizaje en línea', 'educación a distancia', 'clases en línea', 'e-learning', 'online learning', 'online class', 'distance learning'], [...L, m.board, m.cap]);
  FILL['online-learning'] = { solid: [0], wire: [1], cut: [2, 3] };
  PARTS['online-learning'] = { screen: [0], base: [1], cap: [2, 3] };
}
// AI tutor: datos' robot head (its eyes, no antenna) wearing the mortarboard.
{
  const head = sq(5.5, 10.25, 13, 11, 3.5, BR);
  const eyes = [vl(9.75, 14.25, 16.75), vl(14.25, 14.25, 16.75)];
  const m = mortar(MB_ON, [12, 11 - 9.25 * MB_ON]);
  add('ai-tutor', ['tutor con ia', 'asistente de estudio', 'tutor virtual', 'bot educativo', 'ai tutor', 'study assistant', 'learning bot'], [head, ...eyes], { badge: capPiece(m) });
  FILL['ai-tutor'] = { solid: [0], cut: [1, 2] };
  PARTS['ai-tutor'] = { head: [0], eyes: [1, 2] };
}
// Academic calendar: Núcleo's calendar with the mortarboard on its page, as mascotas' calendar-paw.
{
  const C = nucleo.icons.calendar.d.slice(0, 4);
  const m = mortar(MB_IN, [12, 14.75]);
  add('calendar-graduation-cap', ['calendario escolar', 'ciclo escolar', 'periodo de exámenes', 'semestre', 'academic calendar', 'school year', 'term dates'], [...C, m.board, m.cap]);
  FILL['calendar-graduation-cap'] = { solid: [0], lines: [1, 2], cut: [3, 4, 5] };
  PARTS['calendar-graduation-cap'] = { body: [0], rings: [1, 2], header: [3], cap: [4, 5] };
}
// Study: oficina's desk lamp (at 85 %, on the same floor) with its shade turned over a stack of two
// closed books lying on the desk, the top one shorter, flush with the lower one's end. (A shade floating
// over an open book, its cone of light two lines from the rim, read as a stool on a book; under the desk
// lamp an open book stands too tall for its shade, and one book lying flat read as a battery.)
{
  const lamp = oficina.icons['desk-lamp'].d.map((d) => place(d, 0.85, [3.25, 21.25], [3.25, 21.25]));
  // The stack is one outline, stepped, and the line between the two books runs from its step to its end
  const stack = roundpoly([[13.75, 21.25], [13.75, 18.25], [15.25, 18.25], [15.25, 15.25], [21.25, 15.25], [21.25, 21.25]], [1, 1, 0, 1, 1, 0]);
  add('study', ['estudiar', 'hora de estudio', 'concentración', 'repasar', 'study', 'study time', 'focus'], [...lamp, stack, hl(18.25, 15.25, 21.25)]);
  FILL.study = { solid: [0, 2, 3], wire: [1], cut: [hl(18.25, 15.25, 22)] };
  PARTS.study = { lamp: [0, 1, 2], books: [3, 4] };
}

// ── People ────────────────────────────────────────────────────────────────────────────────────
// Student: the bust wearing a backpack: a strap down each side of the chest and the pack's top showing
// over the left shoulder (an arc that starts and ends on the shoulder's outline).
const STUDENT = (() => {
  // The left shoulder: Núcleo's right one mirrored, sampled
  const [p0, p1, p2, p3] = [[12, 13.6], [8.4, 13.6], [5.5, 15.45], [4.78, 18.68]];
  const bez = (t) => [0, 1].map((i) => (1 - t) ** 3 * p0[i] + 3 * (1 - t) ** 2 * t * p1[i] + 3 * (1 - t) * t * t * p2[i] + t ** 3 * p3[i]);
  const yAt = (x, [q0, q1, q2, q3] = [p0, p1, p2, p3]) => {
    let [lo, hi] = [0, 1];
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (bez(m)[0] > x) lo = m;
      else hi = m;
    }
    return bez((lo + hi) / 2)[1];
  };
  const C = [5.75, 14.75];
  const r = 2.25;
  const hits = [];
  let prev = null;
  for (let i = 0; i <= 400; i++) {
    const q = bez(i / 400);
    const out = len(sub(q, C)) > r;
    if (prev !== null && out !== prev) hits.push(q);
    prev = out;
  }
  const ang = (q) => (Math.atan2(q[1] - C[1], q[0] - C[0]) * 180) / Math.PI;
  const [a0, a1] = hits.map(ang).sort((u, v) => u - v);
  const pack = arc(...C, r, a1 - 360, a0).d;
  return [...PERSON, vl(9, yAt(9), 20.6), vl(15, yAt(9), 20.6), pack];
})();
const STUDENT_FILL = { solid: [0, 1, shut(STUDENT[4])], cut: [2, 3] };
const STUDENT_PARTS = { head: [0], body: [1], straps: [2, 3], pack: [4] };
for (const [name, tags, kind] of [
  ['student', ['estudiante', 'alumno', 'aprendiz', 'perfil del alumno', 'student', 'learner', 'pupil'], null],
  ['student-plus', ['agregar alumno', 'inscribir estudiante', 'nuevo alumno', 'add student', 'enroll student', 'new student'], 'plus'],
  ['student-check', ['alumno verificado', 'estudiante presente', 'credencial válida', 'verified student', 'student present', 'student status'], 'check'],
]) {
  add(name, tags, STUDENT, kind ? { badge: badge(kind) } : {});
  FILL[name] = STUDENT_FILL;
  PARTS[name] = STUDENT_PARTS;
}
// The professions: personas' bust 2.5 to the left with its object at the bottom right, on top of the
// shoulder (a custom piece the engine clears), inside the same box from (12.75, 12.25) to (21.25, 21.25).
const TOOL = {};
// An apple: frutas-verduras' own, 9 tall (its leaf a stroke)
TOOL.apple = (() => {
  const d = APPLE_SMALL.map((p) => place(p, 9 / 18.5, [12, 21.25], [17, 21.25]));
  return own(d, d.join(''), { solid: [d[0]], wire: [d[1], d[2]] });
})();
// An open book: archivos' own, 8.5 wide
TOOL.book = (() => {
  const d = BOOK_OPEN.map((p) => place(p, 8.5 / 18.5, [12, 12.625], [17, 17.25]));
  return own(d, d[0], { solid: [d[0]], cut: [d[1]] });
})();
for (const [name, kind, tags] of [
  ['teacher', 'apple', ['maestro', 'profesor', 'docente', 'instructor', 'teacher', 'instructor', 'educator']],
  ['tutor', 'book', ['tutor', 'asesor', 'clases particulares', 'regularización', 'tutor', 'private lessons', 'tutoring']],
]) {
  add(name, tags, PERSON_L, { badge: TOOL[kind] });
  FILL[name] = BUST_FILL;
  PARTS[name] = BUST_PARTS;
}
// Study group: two busts side by side, 3 apart, over the open book they share.
{
  const L = personAt(0.48, -5, -8);
  const R = personAt(0.48, 5, -8);
  const book = BOOK_OPEN.map((d) => place(d, 0.4, [12, 19.75], [12, 21.25]));
  add('study-group', ['grupo de estudio', 'trabajo en equipo', 'compañeros', 'estudiar juntos', 'study group', 'group work', 'classmates'], [...L, ...R, ...book]);
  FILL['study-group'] = { solid: [0, 1, 2, 3, 4], cut: [5] };
  PARTS['study-group'] = { left: [0, 1], right: [2, 3], book: [4, 5] };
}

// ── Credentials and the school year ───────────────────────────────────────────────────────────
// Diploma: a rolled scroll on the diagonal, tied around its middle (the ribbon a line across the roll)
// and bowed on its upper edge: two loops that open out from the knot, clear of the roll, so nothing sits
// on top of anything and the check's corner stays free. Its curled ends drawn as the roll's core, a dot
// at each end, read as a bandage; the bow hanging over the lower edge had to give way to the check,
// and the bare roll with a check read as a pill taken.
const DIPLOMA = (() => {
  const [P0, P1] = [[4.75, 19.25], [19.25, 4.75]];
  const u = unit(sub(P1, P0));
  const n = [-u[1], u[0]];
  const knot = sub([12, 12], mul(n, 2.5));
  const tie = line(knot, add2([12, 12], mul(n, 2.5)));
  // A ribbon's loop: pointed at the knot and round at its far end (two tangents to a circle); as lenses,
  // pointed at both ends, the loops read as two leaves on a stalk
  const loop = (deg, dist = 3.6, r = 1.8) => {
    const c = polar(...knot, dist, deg);
    const phi = (Math.acos(r / dist) * 180) / Math.PI;
    const [t1, t2] = [polar(...c, r, deg + 180 + phi), polar(...c, r, deg + 180 - phi)];
    return `M${pt(knot)}L${pt(t1)}A${f(r)} ${f(r)} 0 1 1 ${pt(t2)}Z`;
  };
  return [bar(P0, P1, 2.5), tie, loop(193), loop(257)];
})();
for (const [name, tags, kind] of [
  ['diploma', ['diploma', 'título', 'graduación', 'certificado de estudios', 'diploma', 'degree', 'credential'], null],
  ['diploma-check', ['título verificado', 'validar diploma', 'credencial académica', 'verified degree', 'diploma verification', 'credential check'], 'check'],
]) {
  add(name, tags, DIPLOMA, kind ? { badge: badge(kind) } : {});
  // Filled, the ribbon's line across the roll is cut out; beside the check, whose clearance reaches its
  // lower end and took it at some weights and not at others, the bow alone says it
  FILL[name] = kind ? { solid: [0, 2, 3] } : { solid: [0, 2, 3], cut: [1] };
  PARTS[name] = { roll: [0], ribbon: [1, 2, 3] };
}
// Student ID: comunicacion's id card with the mortarboard in the photo spot, as mascotas' id-card-paw.
{
  const m = mortar(MB_IN, [8.75, 11.05]);
  add('id-card-student', ['credencial de estudiante', 'identificación escolar', 'carnet', 'student id', 'student card', 'school id'], [comunicacion.icons['id-card'].d[0], m.board, m.cap, hl(10.5, 16.25, 18.5), hl(14, 16.25, 18.5)]);
  FILL['id-card-student'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['id-card-student'] = { card: [0], cap: [1, 2], lines: [3, 4] };
  icons['id-card-student'].mirror = true;
}
// Library card: archivos' book standing upright (the card takes its ribbon's place) and, in front of its
// lower right corner, the card from the pocket inside its cover, with its line (a piece on top: the
// engine clears the book behind it). The card rising out of the book's top read as a suitcase's handle.
{
  const card = sq(11.25, 12.75, 10, 7.5, 1.75, BR);
  add('library-card', ['credencial de biblioteca', 'préstamo de libros', 'tarjeta de biblioteca', 'library card', 'borrowing', 'library membership'], BOOK.slice(0, 2), {
    badge: own([card, hl(16.5, 14.25, 18.25)], card, { solid: [card], cut: [hl(16.5, 14.25, 18.25)] }),
  });
  FILL['library-card'] = { solid: [0], cut: [1] };
  PARTS['library-card'] = { book: [0, 1] };
}
// Honors: social's laurel wreath around the mortarboard.
{
  const W = social.icons['laurel-wreath'].d;
  // The mortarboard at the wreath's center (the inside size)
  const m = mortar(MB_IN, [12, 11.5]);
  // Its board and tassel, as rrhh's job-training carries it: inside the wreath the cap's hollow closed up
  // at weight 2.1
  add('honors', ['mención honorífica', 'cuadro de honor', 'distinción', 'excelencia', 'honors', 'with honors', "dean's list"], [...W, m.board, m.tassel]);
  FILL.honors = { solid: [1, 2, 3, 5, 6, 7, 8], wire: [0, 4, 9] };
  PARTS.honors = { wreath: [0, 1, 2, 3, 4, 5, 6, 7], cap: [8, 9] };
  icons.honors.variants = { circle: false };
}
// Tuition: comercio's coin and its sign, at their own size, with the mortarboard resting on its shoulder
// (a piece in front: the engine clears the coin's rim around its cap). Centered on the coin, the cap's
// clearance reached the sign's top at weight 2.1; at the inside size, the cap's hollow closed up.
{
  const c = [10, 14.75];
  const D = [circ(...c, 6.75), ...dollar(...c, 5.5, 3.75, 1.1)];
  const m = mortar(MB_ON, [15.75, 7]);
  add('tuition', ['colegiatura', 'cuota escolar', 'pago de inscripción', 'crédito educativo', 'tuition', 'school fees', 'student loan'], D, { badge: capPiece(m) });
  FILL.tuition = { solid: [0], cut: [1, 2, 3] };
  PARTS.tuition = { coin: [0, 1, 2, 3] };
}
// Scholarship: gestos' palm-up hand holding the mortarboard, as hand-gift holds its gift.
{
  const PALM = gestos.icons['hand-gift'].d.slice(0, 2);
  const m = mortar(MB_ON, [12.5, 12.25 - 9.25 * MB_ON]);
  add('scholarship', ['beca', 'apoyo económico', 'ayuda financiera', 'subsidio', 'scholarship', 'grant', 'financial aid'], [...PALM, m.board, m.cap]);
  FILL.scholarship = { solid: [0, shut(PALM[1]), 2, shut(m.cap)] };
  PARTS.scholarship = { cuff: [0], hand: [1], cap: [2, 3] };
  icons.scholarship.motion = { effect: 'bounce', parts: ['cap'], vector: [0, -1.5] };
}
// Back to school: frutas-verduras' apple resting on a closed book lying flat (archivos' books, one).
{
  const book = [sq(3.25, 16.25, 17.5, 4.5, 1.4, BR), line([17.25, 16.25], [17.25, 20.75])];
  const apple = APPLE_SMALL.map((d) => place(d, 0.6, [12, 21.25], [12, 16.25]));
  add('back-to-school', ['regreso a clases', 'inicio de clases', 'útiles escolares', 'primer día', 'back to school', 'first day', 'school season'], [...book, ...apple]);
  FILL['back-to-school'] = { solid: [0, 2], cut: [1], wire: [3, 4] };
  PARTS['back-to-school'] = { book: [0, 1], apple: [2, 3, 4] };
}
// Permission slip: a half sheet (the drop's corner) cut from a letter, its top edge the dashed cut line,
// with a checkbox and its line, and the signature line.
add('permission-slip', ['permiso', 'autorización', 'consentimiento', 'excursión', 'permission slip', 'parent consent', 'field trip'], [
  rl([[5, 6.5], [2.5, 6.5], [2.5, 19], [21.5, 19], [21.5, 6.5], [19, 6.5]], [0, 2.5, 2.5, 0, 2.5, 0]),
  hl(6.5, 8, 10.5),
  hl(6.5, 13.5, 16),
  sq(5.5, 9.75, 3.25, 3.25, 0.9),
  hl(11.375, 11.75, 18.5),
  hl(16, 5.5, 18.5),
]);
FILL['permission-slip'] = { solid: [shut(icons['permission-slip'].d[0])], cut: [3, 4, 5], wire: [1, 2] };
PARTS['permission-slip'] = { slip: [0, 1, 2], checkbox: [3], lines: [4, 5] };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every icon to the pixel grid and swaps the standard badges for their pixel version.
// Only the drawings that still don't read get their own here, through pixel centers (0.75 + 1.5k).
const PXc = (k) => 0.75 + 1.5 * k;
/**
 * The mortarboard at 16 px: its board a diamond 7 pixels across and 3 high (5 across when `narrow`)
 * centered on pixel (k, j), and the cap a 1-pixel-deep U under it.
 */
const pixelCap = (k, j, narrow = false) => {
  const h = narrow ? 2 : 3;
  const c = narrow ? 1 : 2;
  return [
    `M${pt([PXc(k - h), PXc(j)])}L${pt([PXc(k), PXc(j - 1)])}L${pt([PXc(k + h), PXc(j)])}L${pt([PXc(k), PXc(j + 1)])}Z`,
    `M${pt([PXc(k - c), PXc(j + 1)])}V${f(PXc(j + 2))}H${f(PXc(k + c))}V${f(PXc(j + 1))}`,
  ];
};
// Exam: the bubbles' rows ran together. A sheet 12 pixels wide with two rows of two 3-pixel bubbles,
// a pixel apart from everything.
{
  const sheet = sq(PXc(2), PXc(1), 16.5, 19.5, 3, BR);
  const marks = [circ(PXc(5), PXc(4), 1.5), dot(PXc(10), PXc(4), 1), dot(PXc(5), PXc(9), 1), circ(PXc(10), PXc(9), 1.5)];
  const small = { d: [sheet, ...marks], fill: { solid: [sheet], cut: marks } };
  icons.exam.small = small;
  icons['exam-check'].small = { ...small, badge: badge('check', { size: 16 }) };
  for (const name of ['answer-key', 'proctoring']) icons[name].small = { ...small, badge: icons[name].badge };
}
// The mortarboard inside a container: the 16 px cap, centered in its pin, page, photo spot or ring.
{
  const pin = snapper([icons['map-pin-school'].d[0]])(icons['map-pin-school'].d[0]);
  const cap = pixelCap(7.5 - 0.5, 6, true);
  icons['map-pin-school'].small = { d: [pin, ...cap], fill: { solid: [pin], cut: cap } };
}
{
  const body = sq(3.75, 5.25, 16.5, 15, 3.5, BR);
  const rings = [line([8.25, 2.25], [8.25, 6.75]), line([15.75, 2.25], [15.75, 6.75])];
  const header = line([3.75, 9.75], [20.25, 9.75]);
  const cap = pixelCap(7, 9);
  icons['calendar-graduation-cap'].small = { d: [body, ...rings, header, ...cap], fill: { solid: [body], lines: rings, cut: [header, ...cap] } };
}
// The laptop: its screen on the pixel grid and the narrow cap in it, as the pin carries it
{
  const [screen, base] = icons['online-learning'].d;
  const lid = snapper([screen])(screen);
  const cap = pixelCap(7, 6, true);
  icons['online-learning'].small = { d: [lid, base, ...cap], fill: { solid: [lid], wire: [base], cut: cap } };
}
{
  const card = sq(PXc(1), PXc(3), 19.5, 13.5, 3, BR);
  const cap = pixelCap(5, 7);
  const lines = [hl(PXc(6), PXc(10), PXc(12)), hl(PXc(9), PXc(10), PXc(12))];
  icons['id-card-student'].small = { d: [card, ...cap, ...lines], fill: { solid: [card], cut: [...cap, ...lines] } };
}
{
  const ring = 'M11.25 2.25A9 9 0 1 1 11.25 20.25A9 9 0 1 1 11.25 2.25';
  const cap = pixelCap(7, 7);
  icons['course-progress'].small = { d: [ring, ...cap], fill: { solid: [shut(ring)], cut: cap } };
}
// ── Motion and mirroring ──────────────────────────────────────────────────────────────────────
// The gestures of their own: the question mark rocks, the beads slide along their wires, the badge's
// arrow turns the work in.
icons.quiz.motion = { effect: 'wiggle', parts: ['question'], origin: [12, 13.25] };
icons.abacus.motion = { effect: 'slide', parts: ['beads'], vector: [1.5, 0] };
icons['homework-arrow-up'].motion = { effect: 'slide', parts: ['badge'], vector: [0, -1.5] };
// Anything that follows the reading direction flips in right-to-left languages: indented or written
// text, a roster read from the person to the mark, a form read from the box to its line. The punched
// sheet and the objects keep their side.
for (const name of ['essay', 'fill-in-the-blank', 'report-card', 'attendance', 'permission-slip']) icons[name].mirror = true;

// ── Variants (DESIGN.md › Automatic variants) ─────────────────────────────────────────────────
// With a badge (the engine's or a piece on top) the enclosures stop reading at 58 % and the slash would
// cut through it, as in personas; a slash through lines alone says nothing.
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
for (const name of ['fill-in-the-blank']) icons[name].variants = { ...icons[name].variants, slash: false };

// ── Fill and parts, by index ──────────────────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = { solid: pick(spec.solid).map((d) => d) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

export default { category: 'educacion', label: 'Educación', icons };
