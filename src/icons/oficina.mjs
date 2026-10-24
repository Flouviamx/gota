// Office and productivity: tasks and kanban, notes and boards, meetings, presentations, the
// spreadsheet's rows, columns and cells, desk supplies, office furniture, printing and approvals.
// Everything is computed with the engine (engine/geometry.mjs) on the rules in DESIGN.md: a 1.5
// stroke, keylines, continuous corners and a square bottom-right corner on containers. The badges
// are the engine's (`badge`): it clears the base with exact clearance, nothing is trimmed by hand.
// The rubber stamp, the printer, the sticky note and the kanban board are the set's own drawings,
// read from their categories, so a `-check` or a `-plus` only adds its badge.
import { arc, badge, circ, dot, drop, flipPath, head, line, polar, rot, roundpoly, sq, turn, turnPath } from '../../engine/geometry.mjs';
import { snapper } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import datos from './datos.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });
/** Capsule (semicircular ends) along its longer side. */
const pill = (x, y, w, h) => sq(x, y, w, h, Math.min(w, h) / 2);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Points turned `deg` degrees around `c`. */
const turnAround = (pts, c, deg) => pts.map((p) => rot(p, c, deg));

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
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

// ── Directions ────────────────────────────────────────────────────────────────────────────────
// A family that points several ways (insert a row above or below, a column left or right) is
// drawn once and turned around the canvas's center. A container is turned as a box (its corners
// turned, then drawn again with the signature at the bottom right), every other stroke with
// `turnPath`, so all the members share their measurements.
function turnBox([x, y, w, h, r], deg) {
  const [a, b] = turn([[x, y], [x + w, y + h]], deg);
  return box(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), r);
}
/** Draws a list of pieces ({ box: [x, y, w, h, r] } or a path) turned `deg` degrees. */
const turned = (pieces, deg = 0) => pieces.map((p) => (typeof p === 'string' ? (deg ? turnPath(p, deg) : p) : turnBox(p.box, deg)));

// ── Shared glyphs and pieces ──────────────────────────────────────────────────────────────────
const plusAt = ([x, y], a = 2.75) => [line([x, y - a], [x, y + a]), line([x - a, y], [x + a, y])];
const xAt = ([x, y], a = 2) => [line([x - a, y - a], [x + a, y + a]), line([x + a, y - a], [x - a, y + a])];
/** Straight arrow from `tail` to `tip` with arms of `arm` at 45°. */
const arrow = (tail, tip, arm = 3) => [line(tail, tip), head(tip, [tip[0] - tail[0], tip[1] - tail[1]], arm)];
/** Double-headed arrow. */
const arrow2 = (a, b, arm = 2.5) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], arm), head(a, [a[0] - b[0], a[1] - b[1]], arm)];
/**
 * A custom piece on top of the base (a selection band, a fill handle, a card lifted off its
 * column): the engine clears the base around it with the paper's clearance, as with a badge.
 */
const piece = (d, fill = { solid: d }) => ({ d, knock: d.join(''), ...(fill && { fill }) });
/**
 * A bust behind something (a table, a counter): the head and the shoulders' arch, open at `base`
 * (the edge in front stands 3 below it). Head and shoulders stay 2.45 apart, as in the core
 * `person`.
 */
const bust = (x, headY, hr, base, sw, top) => {
  const s = base - top;
  const r = (sw * sw + s * s) / (2 * s);
  return [circ(x, headY, hr), `M${pt([x - sw, base])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + sw, base])}`];
};
// Badges at the engine's spot (center 17.25, 17.25)
const BC = [17.25, 17.25];
const RING = circ(...BC, 4.25);
// The person peeking in from the corner (archivos' `file-person` badge): head and shoulders 2.45
// apart, clearing the badge circle so no piece of the base is left between them.
const PERSON = (() => {
  const h = circ(BC[0], 14.45, 1.6);
  const s = `M${pt([BC[0] - 3.25, 21.75])}A3.25 3.25 0 0 1 ${pt([BC[0] + 3.25, 21.75])}Z`;
  return { d: [h, s], knock: `${RING}${h}${s}`, fill: { solid: [h, s] } };
})();
// Reopen: one counterclockwise arc arrow inside the badge circle, a glyph badge like the engine's
// `sync` (it keeps the icon's style) that clears the same circle as the status badges.
const REOPEN = (() => {
  const a = arc(...BC, 3, 150, -150);
  return { d: [a.d, head(a.end, a.tangent, 1.75)], knock: RING };
})();

const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Tasks ─────────────────────────────────────────────────────────────────────────────────────
// The task card: the empty round checkbox, its title beside it and a line below, in the upper
// part of the card so a badge only shortens that line.
const CARD = [3.25, 3.25, 17.5, 17.5, 4];
const TASK = [box(...CARD), circ(8, 9.5, 1.75), hl(9.5, 12.75, 17.75), hl(14.75, 6.25, 14.25)];
add('task', ['tarea', 'pendiente', 'por hacer', 'task', 'to-do'], TASK);
add('task-plus', ['nueva tarea', 'agregar tarea', 'crear', 'add task', 'new task'], TASK, { badge: badge('plus') });
add('task-blocked', ['tarea bloqueada', 'en espera', 'dependencia', 'blocked task', 'waiting'], TASK, { badge: badge('block') });
add('task-star', ['tarea importante', 'destacada', 'prioridad', 'starred task', 'important task'], TASK, { badge: badge('star') });
add('task-assign', ['asignar tarea', 'responsable', 'encargado', 'assign task', 'assignee'], TASK, { badge: PERSON });
add('task-reopen', ['reabrir tarea', 'marcar pendiente', 'deshacer', 'reopen task', 'mark undone'], TASK, { badge: REOPEN });
// Finish-to-start: the first card done (its check), the elbow arrow from its side to the top of
// the next one.
add('task-dependency', ['dependencia', 'tarea previa', 'bloquea a', 'task dependency', 'finish to start'], [
  box(3.25, 3.25, 9, 8, 2.25),
  box(11.75, 13.25, 9, 7.5, 2.25),
  roundline([[12.25, 7.25], [16.75, 7.25], [16.75, 10.25]], 2),
  head([16.75, 10.25], [0, 1], 2.25),
  line([6.25, 7.5], [7.4, 8.65], [9.25, 6.5]),
]);
// The parent row and, indented below, its child, joined by the elbow from one checkbox to the other.
add('subtask', ['subtarea', 'tarea hija', 'jerarquía', 'subtask', 'child task'], [
  circ(5, 6.25, 1.75),
  hl(6.25, 9.75, 20.75),
  roundline([[5, 8], [5, 17.25], [9.25, 17.25]], 2.25),
  circ(11, 17.25, 1.75),
  hl(17.25, 15.75, 20.75),
]);

// ── Kanban ────────────────────────────────────────────────────────────────────────────────────
// The board is the set's `kanban` (three column pills, 3.75 wide).
const KANBAN = datos.icons.kanban;
add('kanban-card', ['tarjeta kanban', 'ficha', 'incidencia', 'kanban card', 'issue card'], [box(2.5, 5, 19, 14, 3.5), pill(6, 8, 6.5, 3), dot(6.75, 15.25), hl(15.25, 10.5, 17.75)]);
add('kanban-column', ['columna kanban', 'lista', 'etapa', 'kanban column', 'stage'], [box(4.75, 2.75, 14.5, 18.5, 3.5), hl(6, 7.75, 11.75), sq(7.75, 9, 8.5, 3.25, 1.2), sq(7.75, 15.25, 6.5, 3, 1.2)]);
// Swimlanes: the board's pills, full height, cut by the lane that runs across it.
{
  const lane = line([2, 10.5], [22, 10.5]);
  add('kanban-swimlane', ['carriles', 'swimlanes', 'tablero por equipos', 'kanban swimlane', 'lanes'], [[3.25, 16], [10.125, 13.5], [17, 15]].map(([x, h]) => sq(x, 3.25, 3.75, h, 1.15)), {
    badge: { d: [lane], knock: `${lane}L2 10.5Z` },
  });
}
// Moving a card: the two columns, the card lifted off the first one (tilted, on top of it) and the
// arrow toward the other.
{
  const c = [10.75, 10.5];
  const card = roundpoly(turnAround([[c[0] - 3.25, c[1] - 2.25], [c[0] + 3.25, c[1] - 2.25], [c[0] + 3.25, c[1] + 2.25], [c[0] - 3.25, c[1] + 2.25]], c, -12), 1.1);
  add('kanban-move', ['mover tarjeta', 'cambiar de etapa', 'arrastrar', 'move card', 'change stage'], [sq(3.25, 3.25, 3.75, 17.5, 1.15), sq(17, 3.25, 3.75, 17.5, 1.15), ...arrow([10, 17.5], [14, 17.5], 2.25)], {
    badge: piece([card]),
  });
}
add('kanban-plus', ['nueva columna', 'nuevo tablero', 'agregar', 'add column', 'new board'], KANBAN.d, { badge: badge('plus') });

// ── Notes and boards ──────────────────────────────────────────────────────────────────────────
// The notepad, bound at the top: three binding loops cross its top edge.
const NOTEPAD = [box(4.75, 4.75, 14.5, 16.5, 3.5), ...[8.25, 12, 15.75].map((x) => vl(x, 2.75, 6.75)), hl(10.25, 8.25, 15.75), hl(13.75, 8.25, 15.75), hl(17.25, 8.25, 12.75)];
add('notepad', ['bloc de notas', 'libreta', 'apuntes', 'notepad', 'memo pad'], NOTEPAD);
add('notepad-lock', ['nota bloqueada', 'nota privada', 'protegida', 'locked note', 'private note'], NOTEPAD, { badge: badge('lock') });
// Meeting notes: the notepad and the speech drop in the corner. Its first line stops short: at full
// length its end fell on the edge of the drop's clearance, cut at some weights and not at others.
add('meeting-notes', ['minuta', 'notas de reunión', 'acta', 'meeting notes', 'minutes'], [...NOTEPAD.slice(0, 4), hl(10.25, 8.25, 13.5), ...NOTEPAD.slice(5)], {
  badge: piece([drop(17.25, 17, 4)]),
});
const STICKY = edicion.icons['sticky-note'];
add('sticky-note-plus', ['nueva nota adhesiva', 'agregar nota', 'post-it', 'add sticky note', 'new sticky'], STICKY.d, { badge: badge('plus') });
// The pin: its head on the note's top edge, the needle going into the note.
{
  const h = circ(12, 5.25, 2.5);
  const needle = vl(12, 7.75, 10.25);
  add('sticky-note-pin', ['nota fijada', 'fijar arriba', 'anclar', 'pinned note', 'pin note'], STICKY.d, {
    badge: { d: [h, needle], knock: `${h}${needle}L12 7.75Z`, fill: { solid: [h], wire: [needle] } },
  });
}
// The pad: the note in front with its folded corner, and the edges of two more behind it, 3 apart.
{
  const [f, e, fold] = [8.25, 20.75, 4.75];
  add('sticky-note-pad', ['taco de notas', 'notas adhesivas', 'post-its', 'sticky notes', 'sticky pad'], [
    roundpoly([[f, f], [e, f], [e, e - fold], [e - fold, e], [f, e]], [3, 3, 0.6, 0.6, 3]),
    roundline([[e - fold, e], [e - fold, e - fold], [e, e - fold]], [0, 1.25, 0]),
    roundline([[5.25, 17.75], [5.25, 5.25], [17.75, 5.25]], 3),
    roundline([[2.25, 14.75], [2.25, 2.25], [14.75, 2.25]], 3),
  ]);
}
// Corkboard: two notes, each held by its pin (a dot on its top edge), the second one tilted.
{
  const c = [16, 12.75];
  const note = roundpoly(turnAround([[13.75, 10], [18.25, 10], [18.25, 15.5], [13.75, 15.5]], c, 8), 1.25);
  add('pinboard', ['tablero de corcho', 'avisos', 'anuncios', 'pinboard', 'bulletin board'], [box(2.5, 4.5, 19, 15, 3.5), sq(5.75, 8.5, 4.5, 5.5, 1.25), note, dot(8, 8.5), dot(...rot([16, 10], c, 8))]);
}
// Thumbtack, from the side: the wide flat head, its neck and the short needle.
add('thumbtack', ['tachuela', 'chincheta', 'chinche', 'thumbtack', 'drawing pin'], [pill(4.75, 5.5, 14.5, 3.5), roundpoly([[8.5, 9], [15.5, 9], [14, 12.25], [10, 12.25]], 0.8), vl(12, 12.25, 19.75)]);
// Round-headed pin: the ball and the long needle, stuck in the surface it ends on (a magnifier's
// handle ends in the air).
add('pin-round', ['alfiler', 'marcador', 'pin de mapa', 'round pin', 'map pin'], [circ(8.25, 7, 3.75), line([10.3, 10.14], [16.25, 19.25]), hl(19.25, 11.75, 20.75)]);
// Whiteboard: the board, a handwritten loop of marker on it, and the tray's ledge under it (a
// stand under a wave read as a monitor with a chart).
add('whiteboard', ['pizarrón', 'pizarra blanca', 'lluvia de ideas', 'whiteboard', 'board'], [
  box(2.5, 3.25, 19, 13.5, 3.25),
  'M5.75 12.5C8 12.5 10.25 10.5 10.25 8.5S7.5 6 6.75 8.25 8.5 12.5 11 12.5C13.5 12.5 13.25 8.75 14.75 8.75S15.5 12.5 18.25 11',
  hl(19.75, 4.75, 19.25),
]);
// Flip chart: the pad hanging from the easel's top bar (and its hook), the legs, two lines written.
add('flipchart', ['rotafolio', 'papelógrafo', 'taller', 'flip chart', 'easel pad'], [
  hl(4.75, 3.25, 20.75),
  roundline([[6, 4.75], [6, 16], [18, 16], [18, 4.75]], [0, 2, 2, 0]),
  vl(12, 2.5, 4.75),
  line([8.5, 19], [7.25, 21.25]),
  line([15.5, 19], [16.75, 21.25]),
  hl(9.5, 9, 15),
  hl(12.5, 9, 12.75),
]);
// Mind map: the central idea and four branches curving out to their ideas.
add('mind-map', ['mapa mental', 'ideas', 'lluvia de ideas', 'mind map', 'brainstorm'], [
  pill(8.5, 9.75, 7, 4.5),
  'M8.5 11.25C6.25 11.25 4.25 9.5 4.25 6.75',
  'M15.5 11.25C17.75 11.25 19.75 9.5 19.75 6.75',
  'M8.5 12.75C6.25 12.75 4.25 14.5 4.25 17.25',
  'M15.5 12.75C17.75 12.75 19.75 14.5 19.75 17.25',
  ...[[4.25, 5], [19.75, 5], [4.25, 19], [19.75, 19]].map(([x, y]) => circ(x, y, 1.75)),
]);

// ── Meetings ──────────────────────────────────────────────────────────────────────────────────
add('meeting', ['reunión', 'junta', 'presencial', 'meeting', 'in person'], [
  hl(16.5, 2.5, 21.5),
  vl(5, 16.5, 20.5),
  vl(19, 16.5, 20.5),
  ...bust(7.25, 6.25, 2, 13.5, 3.25, 10.75),
  ...bust(16.75, 6.25, 2, 13.5, 3.25, 10.75),
]);
// Meeting room, from above: the table and two chairs on each long side.
{
  const chair = (x, y) => pill(x - 1.75, y - 1.5, 3.5, 3);
  add('meeting-room', ['sala de juntas', 'reservar sala', 'conferencias', 'meeting room', 'conference room'], [sq(4.75, 8.5, 14.5, 7, 2.5), chair(8.5, 4), chair(15.5, 4), chair(8.5, 20), chair(15.5, 20)]);
}
// One-on-one: two armchairs facing each other across a small round table.
{
  const chair = roundpoly([[3, 6.75], [5.75, 6.75], [5.75, 13], [8.75, 13], [8.75, 17], [3, 17]], [1.25, 1.25, 0.6, 1, 1, 1.25]);
  add('one-on-one', ['uno a uno', 'reunión individual', 'conversación', 'one-on-one', '1:1'], [chair, vl(4.5, 17, 20), flipPath(chair), vl(19.5, 17, 20), hl(10.5, 10.5, 13.5), vl(12, 10.5, 20), hl(20, 10.75, 13.25)]);
}
// Agenda: the heading and the items in order, three points on a line.
add('meeting-agenda', ['orden del día', 'agenda', 'temas', 'meeting agenda', 'agenda items'], [
  box(4.75, 2.75, 14.5, 18.5, 3.75),
  hl(7, 8.25, 12.75),
  vl(8.5, 11, 18),
  dot(8.5, 11),
  dot(8.5, 14.5),
  dot(8.5, 18),
  hl(11, 12.25, 16),
  hl(14.5, 12.25, 16),
  hl(18, 12.25, 14.75),
]);
// Presenter: the board at the top right and the person in front of it.
add('presenter', ['presentador', 'exponer', 'ponente', 'presenter', 'speaker'], [box(11, 3.25, 9.75, 7.5, 2.5), hl(7, 14, 17.75), circ(6.75, 12.25, 2), 'M2.75 20.75A4 4 0 0 1 10.75 20.75Z']);
// Lectern: the slanted top, the column and its base, and the microphone on its gooseneck.
add('lectern', ['atril', 'podio', 'conferencia', 'lectern', 'podium'], [
  roundpoly([[4.75, 8.25], [19.25, 8.25], [17.5, 12.25], [6.5, 12.25]], [1, 1, 0.75, 0.75]),
  sq(10, 12.25, 4, 7.25, 0.75),
  hl(19.5, 6.5, 17.5),
  'M15.75 8.25C15.75 6 14.5 4.5 12.25 4',
  dot(11.25, 3.75),
]);
// Name tent: the folded card standing on the table, its name on the front.
add('name-tent', ['gafete de mesa', 'tarjeta con nombre', 'evento', 'name tent', 'table card'], [
  hl(19.25, 2.5, 21.5),
  roundpoly([[3.5, 19.25], [6.5, 6.75], [16.5, 6.75], [13.5, 19.25]], [0.5, 1, 1, 0.5]),
  line([15.5, 6.75], [19.25, 19.25]),
  hl(13, 8, 12),
]);
// Conference phone, from above: three lobes joined by concave sides, and the grill.
{
  const C = [12, 12.75];
  const [D, r, E] = [6.75, 2.75, 11.5];
  const lobes = [-90, 30, 150].map((a) => polar(C[0], C[1], D, a));
  const mids = [-30, 90, 210].map((a) => polar(C[0], C[1], E, a));
  const R = Math.hypot(mids[0][0] - lobes[0][0], mids[0][1] - lobes[0][1]) - r;
  const ang = (p, q) => (Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI;
  let s = '';
  for (let i = 0; i < 3; i++) {
    const L = lobes[i];
    if (i === 0) s += `M${pt(polar(L[0], L[1], r, ang(L, mids[2])))}`;
    s += `A${N(r)} ${N(r)} 0 1 1 ${pt(polar(L[0], L[1], r, ang(L, mids[i])))}`;
    const next = lobes[(i + 1) % 3];
    s += `A${N(R)} ${N(R)} 0 0 0 ${pt(polar(next[0], next[1], r, ang(next, mids[i])))}`;
  }
  add('conference-phone', ['teléfono de conferencia', 'altavoz', 'llamada grupal', 'conference phone', 'speakerphone'], [`${s}Z`, circ(...C, 2.5)]);
}

// ── Presentations ─────────────────────────────────────────────────────────────────────────────
// The slide: a landscape frame (19 × 11.5) with the screen's signature.
const SLIDE = [2.5, 6.25, 19, 11.5, 3];
const SLIDE_D = [box(...SLIDE), hl(9.5, 6, 13), sq(6, 12.25, 5.5, 3, 0.9), hl(13.75, 14.5, 18)];
add('slide', ['diapositiva', 'lámina', 'presentación', 'slide', 'presentation'], SLIDE_D);
add('slide-plus', ['nueva diapositiva', 'agregar diapositiva', 'insertar', 'new slide', 'add slide'], SLIDE_D, { badge: badge('plus') });
add('slide-layout', ['diseño de diapositiva', 'plantilla', 'marcadores', 'slide layout', 'layout'], [box(...SLIDE), hl(9.25, 6, 18), sq(6, 12.25, 5, 2.5, 0.9), sq(13, 12.25, 5, 2.5, 0.9)]);
// The deck: the front slide and the back one's top and right edges, 3 away.
const DECK = [box(2.5, 8.75, 16, 10.25, 2.75), roundline([[8.5, 5.25], [21.5, 5.25], [21.5, 15.75]], [0, 2.75, 0])];
add('slide-deck', ['presentación', 'diapositivas', 'conjunto', 'slide deck', 'deck'], DECK);
add('slideshow', ['iniciar presentación', 'reproducir', 'presentar', 'slideshow', 'present'], [...DECK, roundpoly([[8.75, 11], [13.25, 13.875], [8.75, 16.75]], 0.9)]);
// Transition: the front slide coming in from the right over the previous one, its motion behind it.
add('slide-transition', ['transición', 'cambio de diapositiva', 'efecto', 'slide transition', 'transition'], [
  box(5.75, 8.25, 11.5, 8.5, 2.5),
  roundline([[2.75, 14.25], [2.75, 5.25], [13.75, 5.25]], [0, 2.5, 0]),
  hl(10.75, 20.25, 22.25),
  hl(14.25, 20.25, 22.25),
]);
// Animation: the object flies out through the slide's right edge (on top of it, cleared by the
// engine), its two speed lines behind it.
add('slide-animation', ['animación', 'animar objeto', 'efecto', 'slide animation', 'animate'], [box(...SLIDE), hl(10.5, 6, 12.25), hl(13.5, 8, 12.25)], {
  badge: piece([sq(15.75, 8.75, 6.5, 6.5, 1.75)]),
});
add('speaker-notes', ['notas del orador', 'guion', 'apuntes', 'speaker notes', 'notes'], [box(4.75, 2.75, 14.5, 9, 2.75), hl(14.75, 4.75, 19.25), hl(17.75, 4.75, 19.25), hl(20.75, 4.75, 13.25)]);
add('presenter-view', ['vista del presentador', 'siguiente diapositiva', 'notas', 'presenter view', 'presenter mode'], [box(2.5, 6.25, 11.5, 8.5, 2.5), sq(17, 6.25, 4.5, 3.5, 1.1), hl(12.75, 17, 21.5), hl(15.75, 17, 19.75)]);
// Handout: the printed page with two landscape slides on it, 3 from its edges and from each other
// (three small ones with notes beside them read as a checklist).
add('handout', ['folleto', 'impresión de diapositivas', 'repartible', 'handout', 'printout'], [
  box(4.75, 2.75, 14.5, 18.5, 3.5),
  sq(8, 6, 8, 4.5, 1.1),
  sq(8, 13.5, 8, 4.5, 1.1),
]);
// Projection screen: the roller, the screen hanging from it and its pull tab.
add('projector-screen', ['pantalla de proyección', 'proyectar', 'sala', 'projector screen', 'projection'], [
  pill(2.5, 3, 19, 3),
  roundline([[4.25, 6], [4.25, 17], [19.75, 17], [19.75, 6]], [0, 1.5, 1.5, 0]),
  vl(12, 17, 19.75),
  dot(12, 20.25),
]);
// Laser pointer: the slim body, its beam (3 from the tip) and the dot with its rays.
{
  const c = [6.75, 17.25];
  const [len, hw] = [8, 1.5];
  const at = (s, o) => [c[0] + (s + o) * Math.SQRT1_2, c[1] + (o - s) * Math.SQRT1_2];
  const D = [16.25, 7.75];
  add('laser-pointer', ['puntero láser', 'señalar', 'presentar', 'laser pointer', 'pointer'], [
    roundpoly([at(-len / 2, -hw), at(len / 2, -hw), at(len / 2, hw), at(-len / 2, hw)], hw - 0.01),
    line(at(len / 2 + 3, 0), [D[0] - 2.6, D[1] + 2.6]),
    dot(...D),
    ...[-90, -45, 0].map((a) => line(polar(...D, 3.75, a), polar(...D, 5.95, a))),
  ]);
}

// ── The spreadsheet ───────────────────────────────────────────────────────────────────────────
// One grid for the whole family: the square card (3.25–20.75) with its lines at 9.25 and 14.75, so
// a row or a column is 6 high or wide. A row on its own is the strip of three cells (17.5 × 6) with
// the same dividers; the row or column that changes is always that strip, and what happens to it
// (insert, delete, move) is a glyph centered 3 away from it. A shorter strip keeps the cells' size
// with two of them.
const K0 = 3.25;
const K1 = 20.75;
const G1 = 9.25;
const G2 = 14.75;
const GRID = { box: CARD };
const ghl = (y, x0 = K0, x1 = K1) => hl(y, x0, x1);
const gvl = (x, y0 = K0, y1 = K1) => vl(x, y0, y1);
const STRIP_H = 6;
/** The row strip: three cells, its top at `y`. */
const strip = (y) => [{ box: [K0, y, 17.5, STRIP_H, 2] }, gvl(G1, y, y + STRIP_H), gvl(G2, y, y + STRIP_H)];
/** A shorter strip (room at its right end for an arrow): two cells of the same size. */
const shortStrip = (x1, y = 9) => [{ box: [K0, y, x1 - K0, STRIP_H, 2] }, gvl((K0 + x1) / 2, y, y + STRIP_H)];
/** The strip with a glyph above it: the strip at 13.5–19.5, the glyph centered at 7.75. */
const [SY, GY] = [13.5, 7.75];

// Insert, delete and move: drawn for the row (the glyph above it), turned for the rest.
{
  const insert = [...strip(SY), ...plusAt([12, GY])];
  const remove = [...strip(SY), ...xAt([12, GY])];
  const move = [...strip(SY), ...arrow([12, 10.5], [12, 4.25])];
  add('row-insert-above', ['insertar fila arriba', 'fila nueva', 'hoja de cálculo', 'insert row above', 'add row'], turned(insert));
  add('row-insert-below', ['insertar fila abajo', 'fila nueva', 'hoja de cálculo', 'insert row below', 'add row'], turned(insert, 180));
  add('column-insert-left', ['insertar columna a la izquierda', 'columna nueva', 'tabla', 'insert column left', 'add column'], turned(insert, -90));
  add('column-insert-right', ['insertar columna a la derecha', 'columna nueva', 'tabla', 'insert column right', 'add column'], turned(insert, 90));
  add('row-delete', ['eliminar fila', 'borrar fila', 'quitar', 'delete row', 'remove row'], turned(remove));
  add('column-delete', ['eliminar columna', 'borrar columna', 'quitar', 'delete column', 'remove column'], turned(remove, -90));
  add('row-move-up', ['subir fila', 'mover fila', 'reordenar', 'move row up', 'reorder'], turned(move));
  add('row-move-down', ['bajar fila', 'mover fila', 'reordenar', 'move row down', 'reorder'], turned(move, 180));
  add('column-move-left', ['mover columna a la izquierda', 'reordenar columnas', 'tabla', 'move column left', 'reorder'], turned(move, -90));
  add('column-move-right', ['mover columna a la derecha', 'reordenar columnas', 'tabla', 'move column right', 'reorder'], turned(move, 90));
}
// Height and width: the shorter strip and a double-headed arrow along its end, longer than the
// row is high.
{
  const height = [...shortStrip(14.25), ...arrow2([18.5, 5.5], [18.5, 18.5])];
  add('row-height', ['alto de fila', 'altura', 'redimensionar', 'row height', 'resize row'], turned(height));
  add('column-width', ['ancho de columna', 'anchura', 'redimensionar', 'column width', 'resize column'], turned(height, -90));
}
// Open a row as a record: the shorter strip and the diagonal expand arrow at its end.
{
  const [a, b] = [[16, 14.5], [21, 9.5]];
  const arm = 2.75;
  add('row-expand', ['abrir registro', 'expandir fila', 'detalle', 'expand row', 'open record'], [
    ...turned(shortStrip(13)),
    line(a, b),
    line([b[0] - arm, b[1]], b, [b[0], b[1] + arm]),
    line([a[0], a[1] - arm], a, [a[0] + arm, a[1]]),
  ]);
}
// The table: the card with its header row and its first column (the set's `table`). Freezing
// doubles a line 3 below or beside it; the header and the bands write inside a row.
const TABLE = [GRID, ghl(G1), gvl(G1)];
{
  const rowFreeze = [GRID, ghl(G1), ghl(G1 + 3), gvl(G1, G1 + 3)];
  add('row-freeze', ['inmovilizar fila', 'fijar encabezado', 'congelar', 'freeze row', 'freeze top row'], turned(rowFreeze));
  add('column-freeze', ['inmovilizar columna', 'fijar columna', 'congelar', 'freeze column', 'freeze first column'], turned(rowFreeze, -90).map((d, i) => (i ? flipPath(d, 'y') : d)));
  const L = (k) => roundline([[K1, k], [k, k], [k, K1]], 1.5);
  add('table-freeze', ['inmovilizar paneles', 'fijar filas y columnas', 'congelar', 'freeze panes', 'freeze'], turned([GRID, L(G1), L(G1 + 3)]));
  const header = [GRID, ghl(G1), gvl(G1, G1), ghl(6.25, 7, 12.5)];
  add('row-header', ['fila de encabezado', 'títulos', 'primera fila', 'header row', 'first row'], turned(header));
  add('column-header', ['columna de encabezado', 'títulos', 'primera columna', 'header column', 'first column'], turned(header, -90));
  add('row-banded', ['filas con bandas', 'filas alternas', 'cebra', 'banded rows', 'striped rows'], turned([GRID, ghl(G1), ghl(G2), ghl(6.25, 7, 11), ghl(17.75, 7, 11)]));
}
// Select a whole row: the shorter strip (two cells of the grid's size) inside the set's selection
// frame (edicion's `selection`: rounded corners of 4 and a dash of 2.5 in the middle of each long
// side, 3 from the strip). Drawn for the row and turned for the column.
{
  const [x0, x1, y0, y1] = [3.5, 20.5, 6, 18];
  const marquee = [
    roundline([[x0, y0 + 3.75], [x0, y0], [x0 + 4, y0]], 2),
    roundline([[x1 - 4, y0], [x1, y0], [x1, y0 + 3.75]], 2),
    roundline([[x1, y1 - 3.75], [x1, y1], [x1 - 4, y1]], 2),
    roundline([[x0 + 4, y1], [x0, y1], [x0, y1 - 3.75]], 2),
    hl(y0, 10.75, 13.25),
    hl(y1, 10.75, 13.25),
  ];
  const selected = [{ box: [6.5, 9, 11, STRIP_H, 2] }, gvl(12, 9, 9 + STRIP_H), ...marquee];
  add('row-select', ['seleccionar fila', 'fila completa', 'selección', 'select row', 'whole row'], turned(selected));
  add('column-select', ['seleccionar columna', 'columna completa', 'selección', 'select column', 'whole column'], turned(selected, -90));
}
// Total row: the row strip with the sum sign above it, the family's glyph in the insert's place.
{
  const sigma = roundline([[14.5, 4.5], [9.5, 4.5], [12.25, 7.5], [9.5, 10.5], [14.5, 10.5]], [0, 0.6, 0.6, 0.6, 0]);
  add('row-total', ['fila de totales', 'suma', 'total', 'total row', 'sum'], [...turned(strip(SY)), sigma]);
}
// Pivot: a table with its header row and first column, and the arc arrow around its corner that
// swings one into the other (one head along the header, the other down the column).
{
  const t = 8.75;
  const c = [t + 1.5, t + 1.5];
  const a = arc(...c, 6, 155, 295);
  const b = arc(...c, 6, 295, 155);
  add('table-pivot', ['tabla dinámica', 'pivote', 'resumen', 'pivot table', 'pivot'], [
    box(t, t, K1 - t, K1 - t, 3.25),
    ghl(t + 4.5, t),
    gvl(t + 4.5, t),
    a.d,
    head(a.end, a.tangent, 2.5),
    head(b.end, b.tangent, 2.5),
  ]);
}
add('table-lock', ['proteger hoja', 'bloquear rango', 'tabla protegida', 'protect sheet', 'lock table'], turned(TABLE), { badge: badge('lock') });
// Transpose: the row strip and the column strip, and the arc arrow that turns one into the other.
{
  const [w, n] = [4.5, 11.5];
  const row = [{ box: [K0, K0, n, w, 1.6] }, gvl(K0 + n / 3, K0, K0 + w), gvl(K0 + (2 * n) / 3, K0, K0 + w)];
  const col = [{ box: [K1 - w, K1 - n, w, n, 1.6] }, ghl(K1 - n + n / 3, K1 - w, K1), ghl(K1 - n + (2 * n) / 3, K1 - w, K1)];
  const a = arc(16.5, 7.25, 8, 150, 105);
  add('table-transpose', ['transponer', 'intercambiar filas y columnas', 'girar tabla', 'transpose', 'swap rows and columns'], [...turned([...row, ...col]), a.d, head(a.end, a.tangent, 3)]);
}
// Two cells in a strip, their shared border at the center. Merging pushes them together,
// splitting pulls them apart.
{
  const cells = [{ box: [K0, 7.25, 17.5, 9.5, 2.5] }, gvl(12, 7.25, 16.75)];
  add('cell-merge', ['combinar celdas', 'unir celdas', 'fusionar', 'merge cells', 'merge'], [...turned(cells), ...arrow([6.25, 12], [9, 12], 2.5), ...arrow([17.75, 12], [15, 12], 2.5)]);
  add('cell-split', ['dividir celda', 'separar celdas', 'partir', 'split cell', 'unmerge'], [...turned(cells), ...arrow([9, 12], [6.25, 12], 2.5), ...arrow([15, 12], [17.75, 12], 2.5)]);
}
// A range: the selected block of four cells (its lines running on into the sheet) and the fill
// handle at its corner, a custom piece the engine clears the grid around.
const handle = (x, y, s = 3.25) => piece([sq(x - s / 2, y - s / 2, s, s, 0.75)]);
{
  const [a, b] = [9.75, 16.25];
  add('cell-range', ['rango de celdas', 'selección', 'celdas', 'cell range', 'selected cells'], [box(K0, K0, b - K0, b - K0, 2.5), gvl(a, K0, b), ghl(a, K0, b), gvl(a, b), ghl(a, b)], { badge: handle(b, b) });
}
// Autofill: the column of cells (the strip, turned), the source cell's handle and the arrow that
// drags it down.
add('cell-autofill', ['autorrellenar', 'rellenar hacia abajo', 'serie', 'autofill', 'fill down'], [...turned(strip(12), 90), ...arrow([17.25, 11], [17.25, 19.5], 2.75)], { badge: handle(12, G1) });
// A comment on a cell: the table (its header row and first column) and the speech drop on its
// corner, cleared by the engine.
add('cell-comment', ['comentario en celda', 'nota', 'anotación', 'cell comment', 'cell note'], turned(TABLE), {
  badge: piece([drop(17, 17, 4.25)]),
});
// Formula bar: the input field, the equals sign behind its divider, and the formula.
add('formula-bar', ['barra de fórmulas', 'fórmula', 'función', 'formula bar', 'formula'], [box(2.5, 7, 19, 10, 3), vl(11, 7, 17), hl(10.5, 5.5, 8), hl(13.5, 5.5, 8), hl(12, 14, 18.5)]);
// Group rows: the bracket that holds them, with its minus in the gap at its middle.
{
  const group = [ghl(6, 10.5), ghl(12, 10.5), ghl(18, 10.5), roundline([[7.5, 6], [4.75, 6], [4.75, 9]], 1.25), roundline([[4.75, 15], [4.75, 18], [7.5, 18]], 1.25), hl(12, 3.25, 6.25)];
  add('row-group', ['agrupar filas', 'esquema', 'contraer filas', 'group rows', 'outline'], turned(group));
  add('column-group', ['agrupar columnas', 'esquema', 'contraer columnas', 'group columns', 'outline'], turned(group, 90));
}
// Worksheet: the grid and the two sheet tabs hanging from its bottom edge, at the left.
{
  const tab = (x) => roundline([[x, 16.5], [x, 20.25], [x + 4.5, 20.25], [x + 4.5, 16.5]], [0, 1.25, 1.25, 0]);
  add('worksheet', ['hoja de trabajo', 'pestañas', 'libro', 'worksheet', 'sheet tabs'], [box(K0, K0, 17.5, 13.25, 3.5), ghl(G1), gvl(G1, K0, 16.5), tab(4.75), tab(12.25)]);
}

// ── Desk supplies ─────────────────────────────────────────────────────────────────────────────
// Stapler, from the side: the arm with its nose, slightly open at the front, its hinge post at
// the back, and the base.
add('stapler', ['engrapadora', 'grapar', 'unir hojas', 'stapler', 'staple'], [
  roundpoly([[2.75, 17.25], [21.25, 17.25], [21.25, 20.25], [2.75, 20.25]], 1.5),
  roundpoly([[3.25, 9], [20.25, 7.75], [21.25, 9], [21.25, 14.25], [6, 13.5], [5.25, 14.25], [3.25, 14]], [1.75, 1.25, 1, 1, 0.5, 0.5, 1]),
  vl(19.25, 14.25, 17.25),
]);
// Binder: its spine (the label window and the finger hole) and the cover beside it.
add('binder', ['carpeta de palanca', 'archivador', 'expediente', 'binder', 'lever arch file'], [
  box(4.75, 2.75, 7.5, 18.5, 2.25),
  roundline([[12.25, 2.75], [19.25, 2.75], [19.25, 21.25], [12.25, 21.25]], [0, 2.25, 0, 0]),
  sq(6.75, 5.75, 3.5, 6, 1),
  circ(8.5, 16.5, 1.25),
]);
// Binder clip, from the front: the body, wider at its jaws, and its two wire handles opened out in a
// V like wings (the "butterfly"), each a narrow loop 3 wide where it meets the body.
{
  const body = roundpoly([[6.5, 12.75], [17.5, 12.75], [19, 20.75], [5, 20.75]], [1, 1, 1.25, 1.25]);
  const handle = (s) => roundline([[12 + s * 1.5, 12.75], [12 + s * 6.25, 3.25], [12 + s * 9.25, 4.75], [12 + s * 4.5, 12.75]], [0, 1.4, 1.4, 0]);
  add('binder-clip', ['pinza sujetapapeles', 'clip mariposa', 'sujetar', 'binder clip', 'paper clamp'], [body, handle(-1), handle(1)]);
}
// Tape dispenser, from the side: the snail's shell around the roll, the tape running to its nose.
add('tape-dispenser', ['despachador de cinta', 'cinta adhesiva', 'diurex', 'tape dispenser', 'tape'], ['M3 19.75H20.25V12.25A6.5 6.5 0 0 0 7.75 9.75L3 19.75Z', circ(13.75, 12.25, 3), line([10.9, 13.2], [4.5, 16.25])]);
// Rubber band: a loose loop with one twist, a belt crossed between two circles; the strand that
// passes under stops 3 from the one on top.
{
  const [A, ra, B, rb] = [[6.25, 8.25], 3, [16, 15], 4.75];
  const base = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const phi = Math.acos((ra + rb) / Math.hypot(B[0] - A[0], B[1] - A[1]));
  const deg = (r) => (r * 180) / Math.PI;
  const [a1, a2] = [deg(base + phi), deg(base - phi)];
  const [pA1, pB1, pA2, pB2] = [polar(...A, ra, a1), polar(...B, rb, a1 + 180), polar(...A, ra, a2), polar(...B, rb, a2 + 180)];
  const X = [(A[0] * rb + B[0] * ra) / (ra + rb), (A[1] * rb + B[1] * ra) / (ra + rb)];
  const u = [pA2[0] - pB2[0], pA2[1] - pB2[1]];
  const v = [pA1[0] - pB1[0], pA1[1] - pB1[1]];
  const [lu, lv] = [Math.hypot(...u), Math.hypot(...v)];
  const g = 3 / Math.sin(Math.acos(Math.abs((v[0] * u[0] + v[1] * u[1]) / (lv * lu))));
  const e1 = [X[0] - (u[0] / lu) * g, X[1] - (u[1] / lu) * g];
  const e2 = [X[0] + (u[0] / lu) * g, X[1] + (u[1] / lu) * g];
  add('rubber-band', ['liga', 'goma elástica', 'agrupar', 'rubber band', 'elastic'], [`M${pt(e2)}L${pt(pA2)}A${N(ra)} ${N(ra)} 0 1 0 ${pt(pA1)}L${pt(pB1)}A${N(rb)} ${N(rb)} 0 1 1 ${pt(pB2)}L${pt(e1)}`]);
}
// Letter opener: the envelope, and the opener's blade slipped under its flap (it crosses the
// envelope's edge and stops 3 from the flap).
{
  const c = [19, 5];
  const at = (s, o) => [c[0] + (s + o) * Math.SQRT1_2, c[1] + (o - s) * Math.SQRT1_2];
  const enter = [13.75, 10.25];
  add('letter-opener', ['abrecartas', 'abrir correo', 'correspondencia', 'letter opener', 'open mail'], [
    box(2.5, 9.5, 15, 11, 2.75),
    roundline([[2.5, 12.5], [10, 16.75], [17.5, 12.5]], [0, 1.5, 0]),
    roundpoly([at(-2.5, -1.4), at(2.75, -1.4), at(2.75, 1.4), at(-2.5, 1.4)], 1.39),
    line(at(-2.5, 0), enter),
    line(enter, [11.6, 12.4]),
  ]);
}
// Hole punch, from the side: the body, its curved lever, and the punched sheet coming out from
// under it (its top edge hidden, 3 below the body), its two holes showing.
add('hole-punch', ['perforadora', 'perforar', 'agujeros', 'hole punch', 'punch'], [
  roundpoly([[3.25, 8.75], [20.75, 8.75], [20.75, 12.25], [3.25, 12.25]], 1.25),
  'M5 8.75V7.75C5 5 11.5 3 20.25 3.75',
  roundline([[5.75, 15.25], [5.75, 21], [18.25, 21], [18.25, 15.25]], [0, 1.5, 1.5, 0]),
  dot(9.5, 18),
  dot(14.5, 18),
]);
// Pencil cup: two pencils and a ruler, fanned out of the cup (they stop 3 above its rim).
{
  const pencil = (bx, ang, len) => {
    const u = [Math.sin((ang * Math.PI) / 180), -Math.cos((ang * Math.PI) / 180)];
    // The base runs level, 3 above the rim, so a tilted pencil ends at the same height on both sides
    const at = (s, o) => [bx + u[0] * s - u[1] * o, 10.25 + u[1] * s + u[0] * o];
    const k = (o) => (-u[0] * o) / u[1];
    return line(at(k(-1.5), -1.5), at(len - 2.75, -1.5), at(len, 0), at(len - 2.75, 1.5), at(k(1.5), 1.5));
  };
  add('pencil-cup', ['portalápices', 'organizador', 'escritorio', 'pencil cup', 'pen holder'], [
    box(4.75, 13.25, 14.5, 8, 2.5),
    pencil(6, -12, 7.5),
    roundline([[10.5, 10.25], [10.5, 2.75], [13.5, 2.75], [13.5, 10.25]], [0, 0.6, 0.6, 0]),
    pencil(18, 12, 7.5),
  ]);
}
// Pencil sharpener: the block with its cone hole, and the pencil going into it (on top of the block).
{
  const c = [15, 10];
  const at = (s, o) => [c[0] + (o - s) * Math.SQRT1_2, c[1] + (s + o) * Math.SQRT1_2];
  const pencil = roundpoly([at(2, -1.75), at(5, -1.75), at(16, -1.75), at(16, 1.75), at(5, 1.75), at(2, 1.75)], [0.01, 0.01, 1.74, 1.74, 0.01, 0.01]);
  const band = line(at(5, -1.75), at(5, 1.75));
  add('pencil-sharpener', ['sacapuntas', 'afilar', 'lápiz', 'pencil sharpener', 'sharpener'], [box(9.25, 4.25, 11.5, 11.5, 3), circ(15, 10, 2.75)], {
    badge: { d: [pencil, band], knock: pencil, fill: { solid: [pencil], cut: [band] } },
  });
}
// Paper trimmer, from the side: the board, the blade arm raised from its hinge, the knob at its end.
add('paper-trimmer', ['guillotina', 'cortadora de papel', 'recortar', 'paper trimmer', 'paper cutter'], [pill(2.75, 17.5, 18.5, 3), line([18.25, 15.25], [6.25, 6.25]), circ(19.5, 16, 1.25), circ(4.75, 5.25, 1.75)]);
// Stationery: the ruler (its ticks along one edge) and the pencil across it, on top.
{
  const ruler = roundpoly(turnAround([[3.5, 9.5], [20.5, 9.5], [20.5, 14.5], [3.5, 14.5]], [12, 12], -45), 1.2);
  const ticks = [-5.5, 5.5].map((s) => line(rot([12 + s, 9.5], [12, 12], -45), rot([12 + s, 11.75], [12, 12], -45)));
  const pencil = roundpoly(turnAround([[3.75, 12], [6.5, 10.5], [20.5, 10.5], [20.5, 13.5], [6.5, 13.5]], [12, 12], 45), [0.3, 0.3, 1, 1, 0.3]);
  add('stationery', ['papelería', 'útiles', 'artículos de oficina', 'stationery', 'office supplies'], [ruler, ...ticks], { badge: piece([pencil]) });
}
// Letter trays: two trays stacked on their posts, a sheet's edge in each.
add('letter-tray', ['charola de documentos', 'bandeja de entrada', 'bandeja de salida', 'letter tray', 'in tray'], [
  box(3.75, 7.25, 16.5, 3.5, 1.5),
  hl(4.25, 8, 16),
  box(3.75, 16.75, 16.5, 3.5, 1.5),
  hl(13.75, 8.5, 15.5),
  vl(5.5, 10.75, 16.75),
  vl(18.5, 10.75, 16.75),
]);
// Label maker: the handheld body, its screen and keys, the label coming out of the top.
add('label-maker', ['rotuladora', 'etiquetadora', 'etiquetas', 'label maker', 'labeler'], [
  box(6.25, 8, 11.5, 13.25, 3),
  sq(9, 10.75, 6, 3.25, 1),
  ...[9, 12, 15].map((x) => circ(x, 17.5, 0.3)),
  roundline([[9.25, 8], [9.25, 2.75], [14.75, 2.75], [14.75, 8]], [0, 0.6, 0.6, 0]),
]);
// Typewriter, from the front: the body with its keys, the roller, the sheet standing out of it.
add('typewriter', ['máquina de escribir', 'escritura', 'clásico', 'typewriter', 'typewriter mode'], [
  box(2.5, 11.5, 19, 9.25, 2.5),
  pill(3.75, 8.5, 16.5, 3),
  roundline([[7, 8.5], [7, 3], [17, 3], [17, 8.5]], [0, 1, 1, 0]),
  dot(7.5, 16),
  dot(12, 16),
  dot(16.5, 16),
]);
// Laminator: the low machine with its rollers, and the sealed sheet half inside it.
add('laminator', ['enmicadora', 'plastificadora', 'enmicar', 'laminator', 'laminate'], [
  box(2.5, 12.5, 19, 8, 3),
  hl(16.5, 6.5, 17.5),
  roundline([[6.5, 9.5], [6.5, 3.25], [17.5, 3.25], [17.5, 9.5]], [0, 2, 2, 0]),
  roundline([[9.5, 9.5], [9.5, 6.25], [14.5, 6.25], [14.5, 9.5]], [0, 0.75, 0.75, 0]),
]);
// Ream: the wrapped package, its top seen a little, and the wrapper's band around the middle.
add('paper-ream', ['paquete de hojas', 'resma', 'papel', 'paper ream', 'paper supply'], [
  box(3.25, 9.25, 17.5, 10.5, 2),
  roundpoly([[3.25, 9.25], [6.75, 5], [20.75, 5], [20.75, 9.25]], [0.5, 1.25, 1.25, 0.5]),
  vl(10.25, 9.25, 19.75),
  vl(13.75, 9.25, 19.75),
  line([10.25, 9.25], [12.5, 5]),
  line([13.75, 9.25], [16, 5]),
]);

// ── Furniture ─────────────────────────────────────────────────────────────────────────────────
add('desk', ['escritorio', 'mesa de trabajo', 'oficina', 'desk', 'office desk'], [
  hl(6.75, 2.5, 21.5),
  vl(4.75, 6.75, 20.5),
  roundline([[12, 6.75], [12, 20.5], [20, 20.5], [20, 6.75]], [0, 1, 1, 0]),
  hl(13.5, 12, 20),
  hl(10.25, 15, 17),
  hl(17, 15, 17),
]);
add('workstation', ['estación de trabajo', 'puesto', 'espacio de trabajo', 'workstation', 'workspace'], [hl(16.25, 2.5, 21.5), vl(4.5, 16.25, 20.75), vl(19.5, 16.25, 20.75), box(6, 3.25, 12, 8.25, 2), vl(12, 11.5, 16.25)]);
// Office chair: the backrest, the seat, the gas column and the five-star base on its casters.
add('office-chair', ['silla de oficina', 'silla giratoria', 'asiento', 'office chair', 'desk chair'], [
  sq(7.25, 2.75, 9.5, 6.75, 2.75),
  pill(4.75, 12.5, 14.5, 3),
  vl(12, 15.5, 17.75),
  roundline([[5.75, 19.75], [12, 17.75], [18.25, 19.75]], [0, 0.75, 0]),
  vl(12, 17.75, 19.75),
  dot(5.75, 19.75),
  dot(18.25, 19.75),
  dot(12, 19.75),
]);
// Standing desk: the top on its two legs and their feet, the arrow of its height between them (a
// top on a single column read as a text cursor).
add('standing-desk', ['escritorio de pie', 'altura ajustable', 'ergonomía', 'standing desk', 'sit-stand desk'], [
  pill(2.5, 4.75, 19, 3),
  vl(6, 7.75, 20.25),
  vl(18, 7.75, 20.25),
  hl(20.25, 3.75, 8.25),
  hl(20.25, 15.75, 20.25),
  ...arrow2([12, 10.75], [12, 18.25]),
]);
// Cubicle: the partitions around the desk and its monitor.
add('cubicle', ['cubículo', 'módulo', 'puesto de trabajo', 'cubicle', 'office cubicle'], [roundline([[3.25, 20.75], [3.25, 3.25], [20.75, 3.25], [20.75, 20.75]], [0, 3, 3, 0]), hl(14.5, 3.25, 20.75), box(8.5, 7, 7, 4.5, 1.25), vl(12, 11.5, 14.5)]);
// Desk lamp: the base, two arms meeting at a joint, and the shade aimed down.
// The shade is a dome turned 35° toward the desk.
{
  const [c, r, tilt] = [[15.25, 12], 4.25, -35];
  const shade = `M${pt(polar(...c, r, 180 + tilt))}A${r} ${r} 0 0 1 ${pt(polar(...c, r, 360 + tilt))}Z`;
  // The upper arm meets the dome square to its curve (along its radius), the elbow above it
  const top = polar(...c, r, 270 + tilt);
  add('desk-lamp', ['lámpara de escritorio', 'flexo', 'iluminación', 'desk lamp', 'lamp'], [pill(3.25, 18.25, 8.5, 3), roundline([[7.5, 18.25], polar(...c, r + 4.5, 270 + tilt), top], 0.75), shade]);
}
// Reception: the person behind the counter, its top a ledge wider than its front.
add('reception-desk', ['recepción', 'mostrador', 'registro de visitas', 'reception desk', 'front desk'], [...bust(12, 5, 2, 12.5, 4, 9.5), hl(15.5, 2.5, 21.5), box(4, 15.5, 16, 5.25, 1.5)]);
// Desk phone: the body with its keypad and the handset resting across the top.
add('desk-phone', ['teléfono de escritorio', 'fijo', 'extensión', 'desk phone', 'landline'], [
  roundpoly([[4.25, 9.5], [19.75, 9.5], [20.75, 20.75], [3.25, 20.75]], [1.5, 1.5, 0.01, 1.5]),
  'M3.75 6.5C3.75 3.75 7 2.75 12 2.75S20.25 3.75 20.25 6.5',
  ...[13.5, 17].flatMap((y) => [9, 12, 15].map((x) => circ(x, y, 0.3))),
]);
// Water cooler: the jug upside down on the dispenser, the niche for the cup and its tap.
add('water-cooler', ['garrafón', 'despachador de agua', 'cafetería', 'water cooler', 'break room'], [
  roundpoly([[7.75, 2.75], [16.25, 2.75], [16.25, 7.25], [13.25, 9.25], [13.25, 10.5], [10.75, 10.5], [10.75, 9.25], [7.75, 7.25]], [1.75, 1.75, 1.25, 0.6, 0.01, 0.01, 0.6, 1.25]),
  box(5.75, 10.5, 12.5, 10.75, 2.5),
  sq(8.75, 14, 6.5, 5, 1),
  vl(12, 14, 16),
]);

// ── Printing ──────────────────────────────────────────────────────────────────────────────────
const PRINTER = dispositivos.icons.printer;
add('printer-check', ['impresión lista', 'impreso', 'completado', 'printing done', 'printed'], PRINTER.d, { badge: badge('check') });
add('printer-alert', ['error de impresora', 'atasco', 'sin papel', 'printer error', 'paper jam'], PRINTER.d, { badge: badge('alert') });
// Print queue: three sheets stepped like a queue, the first one going into the feed slot.
add('print-queue', ['cola de impresión', 'trabajos pendientes', 'imprimir', 'print queue', 'print jobs'], [
  box(2.5, 13.25, 19, 7.5, 2.5),
  hl(17, 6.5, 17.5),
  roundline([[8, 13.25], [8, 9.25], [17.5, 9.25], [17.5, 13.25]], [0, 1.25, 1.25, 0]),
  roundline([[5, 10.25], [5, 6.25], [14.5, 6.25]], [0, 1.25, 0]),
  roundline([[2, 7.25], [2, 3.25], [11.5, 3.25]], [0, 1.25, 0]),
]);
// Duplex: the page turning its corner over, and the arrow around it to the other side.
{
  const a = arc(11.25, 12, 9.25, -55, 52);
  add('print-duplex', ['doble cara', 'ambas caras', 'dúplex', 'print duplex', 'two-sided'], [
    roundpoly([[4.25, 3.25], [10.25, 3.25], [14.25, 7.25], [14.25, 20.75], [4.25, 20.75]], [2.25, 0.5, 0.5, 0.01, 2.25]),
    roundline([[10.25, 3.25], [10.25, 7.25], [14.25, 7.25]], [0, 1, 0]),
    a.d,
    head(a.end, a.tangent, 3),
  ]);
}
// Photocopier: the set's scanner (its lid raised) on a tall body, the paper drawer below with its
// handle; the lid stands 3 above the body at its hinge.
add('photocopier', ['fotocopiadora', 'copias', 'sala de copiado', 'photocopier', 'copier'], [line([3.25, 6.75], [20.25, 3.25]), box(3.25, 9.75, 17.5, 11.5, 2.5), hl(15, 3.25, 20.75), hl(18.25, 9.75, 14.25)]);

// ── Approvals ─────────────────────────────────────────────────────────────────────────────────
// Sign-off: the check's long stroke runs on into the signature, over its line.
add('sign-off', ['visto bueno', 'aprobación final', 'firma', 'sign off', 'final approval'], ['M3.25 12.75L6.5 16L11.5 7.75C12.5 6 14 7 13 9.25C12 11.5 11.5 14.5 13.25 14.25C15 14 15.75 11 17.25 11.25C18.75 11.5 18 14 19.75 13.5', hl(19.75, 3.25, 20.75)]);
{
  const person = (x) => [circ(x, 8.75, 2), `M${pt([x - 3.5, 17.25])}A3.5 3.5 0 0 1 ${pt([x + 3.5, 17.25])}Z`];
  add('approval-chain', ['cadena de aprobación', 'aprobadores', 'flujo de firmas', 'approval chain', 'approvers'], [...person(5.25), ...person(17.75), ...arrow([10.1, 8.75], [12.9, 8.75], 2)], { badge: badge('check') });
}
const STAMP = comercio.icons['rubber-stamp'];
add('rubber-stamp-check', ['aprobado', 'sello aprobado', 'autorizado', 'approved', 'stamp approved'], STAMP.d, { badge: badge('check') });
add('rubber-stamp-clock', ['en espera de aprobación', 'pendiente', 'por autorizar', 'awaiting approval', 'pending'], STAMP.d, { badge: badge('clock') });
add('rubber-stamp-x', ['rechazado', 'sello rechazado', 'denegado', 'rejected', 'stamp rejected'], STAMP.d, { badge: badge('x') });
// Date stamp: the stamp's handle over a taller body, crossed by the band of its two date wheels.
add('date-stamp', ['fechador', 'sello de fecha', 'recibido', 'date stamp', 'dater'], [
  circ(12, 4.5, 2.25),
  line([10.5, 6.5], [10.25, 9.25]),
  line([13.5, 6.5], [13.75, 9.25]),
  sq(4.25, 9.25, 15.5, 9, 1.75),
  hl(12.25, 4.25, 19.75),
  hl(15.25, 4.25, 19.75),
  vl(12, 12.25, 15.25),
  hl(21.25, 6.25, 17.75),
]);

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index into d: `solid` is filled (only closed shapes: `close` closes the open outlines along
// an edge that is already solid), `cut` is knocked out, `lines` stays a line with clearance and
// `wire` a line attached to the fill.
const FILL = {
  task: { solid: [0], cut: [1, 2, 3] },
  'task-dependency': { solid: [0, 1], cut: [4], wire: [2, 3] },
  subtask: { solid: [0, 3], wire: [2], lines: [1, 4] },
  'kanban-card': { solid: [0], cut: [1, 2, 3] },
  'kanban-column': { solid: [0], cut: [1, 2, 3] },
  'kanban-swimlane': { solid: [0, 1, 2] },
  'kanban-move': { solid: [0, 1], lines: [2, 3] },
  notepad: { solid: [0], wire: [1, 2, 3], cut: [4, 5, 6] },
  'sticky-note-pad': { solid: [0], cut: [1], lines: [2, 3] },
  pinboard: { solid: [0], cut: [1, 2, 3, 4] },
  thumbtack: { solid: [0, 1], wire: [2] },
  'pin-round': { solid: [0], wire: [1, 2] },
  whiteboard: { solid: [0], cut: [1], lines: [2] },
  flipchart: { solid: [1], close: [1], wire: [0, 2], lines: [3, 4], cut: [5, 6] },
  'mind-map': { solid: [0, 5, 6, 7, 8], wire: [1, 2, 3, 4] },
  meeting: { solid: [3, 4, 5, 6], close: [4, 6], wire: [0, 1, 2] },
  'meeting-room': { solid: [0, 1, 2, 3, 4] },
  'one-on-one': { solid: [0, 2], wire: [1, 3, 4, 5, 6] },
  'meeting-agenda': { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] },
  presenter: { solid: [0, 2, 3], cut: [1] },
  lectern: { solid: [0, 1, 4], wire: [2, 3] },
  'name-tent': { solid: [1], wire: [0, 2], cut: [3] },
  'conference-phone': { solid: [0], cut: [1] },
  slide: { solid: [0], cut: [1, 2, 3] },
  'slide-layout': { solid: [0], cut: [1, 2, 3] },
  'slide-deck': { solid: [0], lines: [1] },
  slideshow: { solid: [0], lines: [1], cut: [2] },
  'slide-transition': { solid: [0], lines: [1, 2, 3] },
  'slide-animation': { solid: [0], cut: [1, 2] },
  'speaker-notes': { solid: [0], lines: [1, 2, 3] },
  'presenter-view': { solid: [0, 1], lines: [2, 3] },
  handout: { solid: [0], cut: [1, 2] },
  'projector-screen': { solid: [0, 1, 3], close: [1], wire: [2] },
  'laser-pointer': { solid: [0, 2], lines: [1, 3, 4, 5] },
  'row-height': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'column-width': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'row-expand': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'row-select': { solid: [0], cut: [1], lines: [2, 3, 4, 5, 6, 7] },
  'column-select': { solid: [0], cut: [1], lines: [2, 3, 4, 5, 6, 7] },
  'row-total': { solid: [0], cut: [1, 2], lines: [3] },
  'cell-comment': { solid: [0], cut: [1, 2] },
  'table-pivot': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
  'table-transpose': { solid: [0, 3], cut: [1, 2, 4, 5], lines: [6, 7] },
  'cell-range': { solid: [0], cut: [1, 2], wire: [3, 4] },
  'cell-autofill': { solid: [0], cut: [1, 2], lines: [3, 4] },
  worksheet: { solid: [0, 3, 4], close: [3, 4], cut: [1, 2] },
  stapler: { solid: [0, 1], wire: [2] },
  binder: { solid: [0, 1], close: [1], cut: [2, 3] },
  'binder-clip': { solid: [0], wire: [1, 2] },
  'tape-dispenser': { solid: [0], cut: [1, 2] },
  'letter-opener': { solid: [0, 2], cut: [1, 4], wire: [3] },
  'hole-punch': { solid: [0, 2], close: [2], wire: [1], cut: [3, 4] },
  'pencil-cup': { solid: [0, 1, 2, 3], close: [1, 2, 3] },
  'pencil-sharpener': { solid: [0], cut: [1] },
  'paper-trimmer': { solid: [0, 2, 3], wire: [1] },
  stationery: { solid: [0], cut: [1, 2] },
  'letter-tray': { solid: [0, 2], lines: [1, 3], wire: [4, 5] },
  'label-maker': { solid: [0, 5], close: [5], cut: [1, 2, 3, 4] },
  typewriter: { solid: [0, 1, 2], close: [2], cut: [3, 4, 5] },
  laminator: { solid: [0, 2], close: [2], cut: [1, 3] },
  'paper-ream': { solid: [0, 1], cut: [2, 3, 4, 5] },
  desk: { solid: [2], close: [2], wire: [0, 1], cut: [3, 4, 5] },
  workstation: { solid: [3], wire: [0, 1, 2, 4] },
  'office-chair': { solid: [0, 1, 5, 6, 7], wire: [2, 3, 4] },
  'standing-desk': { solid: [0], wire: [1, 2, 3, 4], lines: [5, 6, 7] },
  cubicle: { solid: [2], wire: [0, 1, 3] },
  'desk-lamp': { solid: [0, 2], wire: [1] },
  'reception-desk': { solid: [0, 1, 3], close: [1], wire: [2] },
  'desk-phone': { solid: [0], lines: [1], cut: [2, 3, 4, 5, 6, 7] },
  'water-cooler': { solid: [0, 1], cut: [2, 3] },
  'print-queue': { solid: [0, 2], close: [2], cut: [1], lines: [3, 4] },
  'print-duplex': { solid: [0], cut: [1], lines: [2, 3] },
  photocopier: { solid: [1], cut: [2, 3], lines: [0] },
  'approval-chain': { solid: [0, 1, 2, 3], lines: [4, 5] },
  'date-stamp': { solid: [0, 3], wire: [1, 2], cut: [4, 5, 6], lines: [7] },
};
// The spreadsheet's families share their fill: the strip or the card is filled, its dividers
// knocked out, and the glyph beside it stays a line.
for (const name of ['row-insert-above', 'row-insert-below', 'column-insert-left', 'column-insert-right', 'row-delete', 'column-delete', 'row-move-up', 'row-move-down', 'column-move-left', 'column-move-right'])
  FILL[name] = { solid: [0], cut: [1, 2], lines: [3, 4] };
for (const name of ['row-freeze', 'column-freeze', 'table-freeze', 'row-header', 'column-header', 'row-banded', 'table-lock', 'cell-merge', 'cell-split', 'formula-bar'])
  FILL[name] = { solid: [0], cut: icons[name].d.map((_, i) => i).slice(1) };
for (const name of ['task-plus', 'task-blocked', 'task-star', 'task-assign', 'task-reopen']) FILL[name] = FILL.task;
for (const name of ['notepad-lock', 'meeting-notes']) FILL[name] = FILL.notepad;
FILL['slide-plus'] = FILL.slide;
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => ix.map((i) => (spec.close?.includes(i) ? shut(d[i]) : d[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
// The reused drawings keep their own fill
icons['kanban-plus'].fill = KANBAN.fill;
for (const name of ['sticky-note-plus', 'sticky-note-pin']) icons[name].fill = STICKY.fill;
for (const name of ['printer-check', 'printer-alert']) icons[name].fill = PRINTER.fill;
// The stamp's own fill meets its knob with the stem's corners on the circle; with a badge that seam
// changed between weights, so here the knob and its stem are one outline (same silhouette).
for (const name of ['rubber-stamp-check', 'rubber-stamp-clock', 'rubber-stamp-x'])
  icons[name].fill = { ...STAMP.fill, solid: ['M10 12.5L10.5 7.25A2.5 2.5 0 1 1 13.5 7.25L14 12.5Z', STAMP.fill.solid[2]] };
// The binder: its spine's edge cut right through the solid (past the silhouette at both ends)
icons.binder.fill.cut.push(vl(12.25, 1.5, 22.5));
// Lines only: the group brackets, the rubber band and the signature
for (const name of ['row-group', 'column-group', 'rubber-band', 'sign-off']) icons[name].fill = false;

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
const PARTS = {
  task: { card: [0], checkbox: [1], lines: [2, 3] },
  'task-dependency': { first: [0, 4], second: [1], arrow: [2, 3] },
  subtask: { parent: [0, 1], connector: [2], child: [3, 4] },
  'kanban-card': { card: [0], label: [1], avatar: [2], line: [3] },
  'kanban-column': { column: [0], title: [1], cards: [2, 3] },
  'kanban-swimlane': { columns: [0, 1, 2] },
  'kanban-move': { columns: [0, 1], arrow: [2, 3] },
  notepad: { pad: [0], rings: [1, 2, 3], lines: [4, 5, 6] },
  'sticky-note-pad': { front: [0, 1], back: [2, 3] },
  pinboard: { board: [0], notes: [1, 2], pins: [3, 4] },
  thumbtack: { head: [0, 1], needle: [2] },
  'pin-round': { head: [0], needle: [1], surface: [2] },
  whiteboard: { board: [0], scribble: [1], tray: [2] },
  flipchart: { bar: [0, 2], pad: [1, 5, 6], legs: [3, 4] },
  'mind-map': { center: [0], branches: [1, 2, 3, 4], nodes: [5, 6, 7, 8] },
  meeting: { table: [0, 1, 2], people: [3, 4, 5, 6] },
  'meeting-room': { table: [0], chairs: [1, 2, 3, 4] },
  'one-on-one': { chairs: [0, 1, 2, 3], table: [4, 5, 6] },
  'meeting-agenda': { page: [0], heading: [1], timeline: [2, 3, 4, 5], items: [6, 7, 8] },
  presenter: { board: [0, 1], person: [2, 3] },
  lectern: { stand: [0, 1, 2], microphone: [3, 4] },
  'name-tent': { table: [0], card: [1, 3], leg: [2] },
  'conference-phone': { body: [0], grill: [1] },
  slide: { slide: [0], content: [1, 2, 3] },
  'slide-layout': { slide: [0], placeholders: [1, 2, 3] },
  'slide-deck': { front: [0], back: [1] },
  slideshow: { front: [0], back: [1], play: [2] },
  'slide-transition': { front: [0], back: [1], motion: [2, 3] },
  'slide-animation': { slide: [0], motion: [1, 2] },
  'speaker-notes': { slide: [0], notes: [1, 2, 3] },
  'presenter-view': { current: [0], next: [1], notes: [2, 3] },
  handout: { page: [0], slides: [1, 2] },
  'projector-screen': { roller: [0], screen: [1], handle: [2, 3] },
  'laser-pointer': { body: [0], beam: [1], dot: [2], rays: [3, 4, 5] },
  'row-height': { row: [0, 1], arrow: [2, 3, 4] },
  'column-width': { column: [0, 1], arrow: [2, 3, 4] },
  'row-expand': { row: [0, 1], arrow: [2, 3, 4] },
  'row-freeze': { table: [0, 1, 3], freeze: [2] },
  'column-freeze': { table: [0, 1, 3], freeze: [2] },
  'table-freeze': { table: [0, 1], freeze: [2] },
  'row-header': { table: [0, 1, 2], label: [3] },
  'column-header': { table: [0, 1, 2], label: [3] },
  'row-banded': { table: [0, 1, 2], bands: [3, 4] },
  'row-select': { row: [0, 1], selection: [2, 3, 4, 5, 6, 7] },
  'column-select': { column: [0, 1], selection: [2, 3, 4, 5, 6, 7] },
  'row-total': { row: [0, 1, 2], sum: [3] },
  'table-pivot': { table: [0, 1, 2], arrow: [3, 4, 5] },
  'table-lock': { table: [0, 1, 2] },
  'table-transpose': { row: [0, 1, 2], column: [3, 4, 5], arrow: [6, 7] },
  'cell-merge': { cells: [0, 1], arrows: [2, 3, 4, 5] },
  'cell-split': { cells: [0, 1], arrows: [2, 3, 4, 5] },
  'cell-range': { range: [0, 1, 2], grid: [3, 4] },
  'cell-autofill': { column: [0, 1, 2], arrow: [3, 4] },
  'cell-comment': { table: [0, 1, 2] },
  'formula-bar': { field: [0, 1], equals: [2, 3], formula: [4] },
  'row-group': { rows: [0, 1, 2], bracket: [3, 4], toggle: [5] },
  'column-group': { columns: [0, 1, 2], bracket: [3, 4], toggle: [5] },
  worksheet: { sheet: [0, 1, 2], tabs: [3, 4] },
  stapler: { base: [0], arm: [1], hinge: [2] },
  binder: { spine: [0], cover: [1], label: [2], hole: [3] },
  'binder-clip': { body: [0], handles: [1, 2] },
  'tape-dispenser': { body: [0], roll: [1], tape: [2] },
  'rubber-band': { band: [0] },
  'letter-opener': { envelope: [0, 1], opener: [2, 3, 4] },
  'hole-punch': { body: [0], lever: [1], sheet: [2, 3, 4] },
  'pencil-cup': { cup: [0], pencils: [1, 3], ruler: [2] },
  'pencil-sharpener': { block: [0], hole: [1] },
  'paper-trimmer': { board: [0], arm: [1, 3], hinge: [2] },
  stationery: { ruler: [0, 1, 2] },
  'letter-tray': { trays: [0, 2, 4, 5], sheets: [1, 3] },
  'label-maker': { body: [0], screen: [1], keys: [2, 3, 4], label: [5] },
  typewriter: { body: [0], roller: [1], sheet: [2], keys: [3, 4, 5] },
  laminator: { machine: [0, 1], sheet: [2, 3] },
  'paper-ream': { ream: [0, 1], band: [2, 3, 4, 5] },
  desk: { top: [0], leg: [1], drawers: [2, 3, 4, 5] },
  workstation: { desk: [0, 1, 2], monitor: [3, 4] },
  'office-chair': { back: [0], seat: [1], base: [2, 3, 4, 5, 6, 7] },
  'standing-desk': { top: [0], legs: [1, 2, 3, 4], arrow: [5, 6, 7] },
  cubicle: { partitions: [0], desk: [1], monitor: [2, 3] },
  'desk-lamp': { base: [0], arm: [1], shade: [2] },
  'reception-desk': { person: [0, 1], counter: [2, 3] },
  'desk-phone': { body: [0, 2, 3, 4, 5, 6, 7], handset: [1] },
  'water-cooler': { jug: [0], body: [1, 2, 3] },
  'print-queue': { printer: [0, 1], sheets: [2, 3, 4] },
  'print-duplex': { page: [0, 1], arrow: [2, 3] },
  photocopier: { lid: [0], body: [1, 2, 3] },
  'sign-off': { signature: [0], line: [1] },
  'approval-chain': { first: [0, 1], second: [2, 3], arrow: [4, 5] },
  'date-stamp': { handle: [0, 1, 2], body: [3], wheels: [4, 5, 6], base: [7] },
};
const famPart = (names, spec) => {
  for (const n of names) PARTS[n] = spec;
};
famPart(['row-insert-above', 'row-insert-below', 'row-delete'], { row: [0, 1, 2], mark: [3, 4] });
famPart(['column-insert-left', 'column-insert-right', 'column-delete'], { column: [0, 1, 2], mark: [3, 4] });
famPart(['row-move-up', 'row-move-down'], { row: [0, 1, 2], arrow: [3, 4] });
famPart(['column-move-left', 'column-move-right'], { column: [0, 1, 2], arrow: [3, 4] });
famPart(['task-plus', 'task-blocked', 'task-star', 'task-assign', 'task-reopen'], PARTS.task);
famPart(['notepad-lock', 'meeting-notes'], PARTS.notepad);
famPart(['slide-plus'], PARTS.slide);
famPart(['kanban-plus'], { columns: [0, 1, 2] });
famPart(['sticky-note-plus', 'sticky-note-pin'], { note: [0], fold: [1] });
famPart(['printer-check', 'printer-alert'], PRINTER.parts);
famPart(['rubber-stamp-check', 'rubber-stamp-clock', 'rubber-stamp-x'], STAMP.parts);
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
const MOTION = {
  'task-plus': { effect: 'beat', parts: ['badge'], origin: BC },
  'task-star': { effect: 'beat', parts: ['badge'], origin: BC },
  'task-reopen': { effect: 'spin', parts: ['badge'], origin: BC },
  'task-dependency': { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  'kanban-move': { effect: 'slide', parts: ['badge'], vector: [2, 0] },
  'kanban-plus': { effect: 'beat', parts: ['badge'], origin: BC },
  'sticky-note-plus': { effect: 'beat', parts: ['badge'], origin: BC },
  'sticky-note-pin': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  thumbtack: { effect: 'bounce', vector: [0, -2] },
  'pin-round': { effect: 'bounce', parts: ['head', 'needle'], vector: [-1.5, -1.5] },
  'notepad-lock': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 16] },
  'conference-phone': { effect: 'ring', origin: [12, 12.75] },
  'desk-phone': { effect: 'ring', parts: ['handset'], origin: [12, 9.5] },
  slideshow: { effect: 'beat', parts: ['play'], origin: [10.25, 13.875] },
  'slide-plus': { effect: 'beat', parts: ['badge'], origin: BC },
  'slide-transition': { effect: 'slide', parts: ['front'], vector: [-1.5, 0] },
  'slide-animation': { effect: 'slide', parts: ['badge'], vector: [1.5, 0] },
  'laser-pointer': { effect: 'beat', parts: ['dot', 'rays'], origin: [17.25, 6.75] },
  'row-insert-above': { effect: 'beat', parts: ['mark'], origin: [12, GY] },
  'row-insert-below': { effect: 'beat', parts: ['mark'], origin: [12, 24 - GY] },
  'column-insert-left': { effect: 'beat', parts: ['mark'], origin: [GY, 12] },
  'column-insert-right': { effect: 'beat', parts: ['mark'], origin: [24 - GY, 12] },
  'row-move-up': { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] },
  'row-move-down': { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  'column-move-left': { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] },
  'column-move-right': { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] },
  'row-expand': { effect: 'beat', parts: ['arrow'], origin: [18.5, 12] },
  'cell-autofill': { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] },
  'table-pivot': { effect: 'wiggle', parts: ['arrow'], origin: [9.75, 9.75] },
  'table-lock': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 16] },
  stapler: { effect: 'wiggle', parts: ['arm'], origin: [20, 12] },
  'paper-trimmer': { effect: 'wiggle', parts: ['arm'], origin: [19.5, 16] },
  'hole-punch': { effect: 'wiggle', parts: ['lever'], origin: [20.25, 11.5] },
  'desk-lamp': { effect: 'wiggle', parts: ['shade'], origin: [10.5, 6.25] },
  'standing-desk': { effect: 'bounce', parts: ['top'], vector: [0, -1.5] },
  'office-chair': { effect: 'bounce', vector: [0, -1.5] },
  'printer-check': { effect: 'beat', parts: ['badge'], origin: BC },
  'printer-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'print-queue': { effect: 'slide', parts: ['sheets'], vector: [1, 1] },
  'print-duplex': { effect: 'spin', parts: ['arrow'], origin: [11, 12] },
  'approval-chain': { effect: 'beat', parts: ['badge'], origin: BC },
  'rubber-stamp-check': { effect: 'bounce', parts: ['handle', 'pad'], vector: [0, 1.5] },
  'rubber-stamp-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'rubber-stamp-x': { effect: 'bounce', parts: ['handle', 'pad'], vector: [0, 1.5] },
  'date-stamp': { effect: 'bounce', parts: ['handle', 'body', 'wheels'], vector: [0, 1.5] },
  'sign-off': { effect: 'wiggle', origin: [12, 19.75] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Mirroring (DESIGN.md › Mirroring) ─────────────────────────────────────────────────────────
// What reads in a direction: the arrows that lead from one thing to the next, indented and
// bulleted lists, the first column and the formula's equals sign, the sheet tabs, the signature.
// Named directions (move or insert a column left or right) are not mirrored: their name is the side.
for (const name of [
  'task-dependency', 'subtask', 'kanban-move', 'meeting-agenda', 'slide-transition', 'slide-animation', 'speaker-notes',
  'row-height', 'row-expand', 'row-group', 'column-freeze', 'column-header', 'table-freeze', 'table-pivot', 'table-transpose',
  'formula-bar', 'worksheet', 'cell-autofill', 'cell-range', 'sign-off', 'approval-chain', 'presenter-view',
])
  icons[name].mirror = true;

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps each drawing to the pixel grid and swaps the standard badges for their pixel
// versions; only what still doesn't read is drawn again here, from pixel center to pixel center
// (a pixel is 1.5 of the canvas, its centers at 0.75 + 1.5k): a custom badge (it would only be
// snapped), a tilted card, a small × or arrows inside a cell, keys and pins that run together.
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
/** A dot of one pixel, at the center of its pixel. */
const dot16 = (c, r) => circ(...g(c, r), 0.1);
/** The 24 px drawing with the engine's own adjustment, plus a pixel badge. */
const snapped16 = (name, badge16) => {
  const { d, fill } = icons[name];
  const sn = snapper([...d, ...Object.values(fill || {}).flat()]);
  icons[name].small = { d: d.map(sn), ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)])) }), badge: badge16 };
};
const small = (name, d, fill) => {
  icons[name].small = { d, ...(fill && { fill }) };
};
// Reopen: the counterclockwise arc of two pixels around the badge's pixel, its head at the top
{
  const a = `M${pt(g(9, 11))}A3 3 0 1 0 ${pt(g(11, 9))}`;
  const h = pl([12, 8], [11, 9], [12, 10]);
  snapped16('task-reopen', { d: [a, h], knock: `${RING}${a}${h}` });
}
// Moving a card: the card upright between the columns, the arrow under it
{
  const d = [sq(...g(2, 2), 3, 16.5, 1.2), sq(...g(11, 2), 3, 16.5, 1.2), sq(...g(6, 4), 4.5, 4.5, 1), pl([6, 10], [9, 10]), pl([8, 9], [9, 10], [8, 11])];
  small('kanban-move', d, { solid: d.slice(0, 3), lines: d.slice(3) });
}
// Delete a row or a column: the strip of three cells and an × of four pixels
{
  const strip16 = [{ box: [px(2), px(10), 16.5, 4.5, 1.2] }, pl([6, 10], [6, 13]), pl([9, 10], [9, 13])];
  const x16 = [pl([6, 3], [9, 6]), pl([9, 3], [6, 6])];
  for (const [name, deg] of [['row-delete', 0], ['column-delete', -90]]) {
    const d = turned([...strip16, ...x16], deg);
    small(name, d, { solid: [d[0]], cut: [d[1], d[2]], lines: [d[3], d[4]] });
  }
}
// Merge and split: two cells of six pixels, a chevron in each (an arrow of three pixels read as a +)
{
  const cells = [box(...g(1, 3), 18, 12, 1.5), pl([7, 3], [7, 11])];
  const merge = [pl([3, 5], [5, 7], [3, 9]), pl([11, 5], [9, 7], [11, 9])];
  const split = [pl([5, 5], [3, 7], [5, 9]), pl([9, 5], [11, 7], [9, 9])];
  for (const [name, arrows] of [['cell-merge', merge], ['cell-split', split]]) small(name, [...cells, ...arrows], { solid: [cells[0]], cut: [cells[1], ...arrows] });
}
// Desk phone: the keypad's keys a pixel each, two apart
{
  const { d, fill } = icons['desk-phone'];
  const sn = snapper([d[0], d[1]]);
  const keys = [9, 11].flatMap((r) => [5, 7, 9].map((c) => dot16(c, r)));
  small('desk-phone', [sn(d[0]), sn(d[1]), ...keys], { solid: [sn(fill.solid[0])], lines: [sn(fill.lines[0])], cut: keys });
}
// Corkboard: the board and its two notes, upright (the pins ran into their edges)
{
  const d = [box(...g(1, 3), 19.5, 13.5, 2.25), sq(...g(3, 6), 4.5, 6, 1), sq(...g(9, 6), 4.5, 6, 1)];
  small('pinboard', d, { solid: [d[0]], cut: [d[1], d[2]] });
}

// The fill handle: a block of three pixels; a range of four cells, the grid running on past it
{
  const handle16 = (c, r) => {
    const d = sq(...g(c - 1, r - 1), 3, 3, 0.4);
    return { d: [d], knock: d, fill: { solid: [d] } };
  };
  const range = [box(...g(2, 2), 12, 12, 2), pl([6, 2], [6, 10]), pl([2, 6], [10, 6]), pl([6, 10], [6, 14]), pl([10, 6], [14, 6])];
  icons['cell-range'].small = { d: range, fill: { solid: [range[0]], cut: [range[1], range[2]], wire: [range[3], range[4]] }, badge: handle16(10, 10) };
  const column = [box(...g(4, 1), 4.5, 19.5, 1.2), pl([4, 5], [7, 5]), pl([4, 10], [7, 10]), pl([11, 6], [11, 13]), pl([9, 11], [11, 13], [13, 11])];
  icons['cell-autofill'].small = { d: column, fill: { solid: [column[0]], cut: [column[1], column[2]], lines: [column[3], column[4]] }, badge: handle16(7, 5) };
}
// Label maker: two keys of a pixel (three ran together)
{
  const { d, fill } = icons['label-maker'];
  const sn = snapper([...d, ...Object.values(fill).flat()]);
  const keys = [dot16(6, 11), dot16(9, 11)];
  small('label-maker', [sn(d[0]), sn(d[1]), ...keys, sn(d[5])], { solid: [sn(fill.solid[0]), sn(fill.solid[1])], cut: [sn(d[1]), ...keys] });
}

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
const off = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// With a badge or a piece on top: at 58 % it stops reading, and a slash would cut through it
off(Object.keys(icons).filter((n) => icons[n].badge), { circle: false, square: false, slash: false });
// Lines only, or a mark on its own: a slash through them says nothing
off(['row-group', 'column-group', 'rubber-band', 'sign-off'], { slash: false });
// The sticky note's fold is the square enclosure's corner (as in `sticky-note`)
off(['sticky-note-pad'], { square: false });
// The selection frame already encloses the strip: another enclosure around it says nothing
off(['row-select', 'column-select'], { circle: false, square: false });
// Already a square card (the core `columns`): a square around it says nothing
off(['task', 'row-freeze', 'column-freeze', 'table-freeze', 'row-header', 'column-header', 'row-banded'], { square: false });

export default { category: 'oficina', label: 'Oficina y productividad', icons };
