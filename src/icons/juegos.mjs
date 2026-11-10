// Juegos y juguetes (games and toys): dice, chess, board and table games, cards, arcade machines,
// the language of video games (levels, health, power-ups, quests) and toys, from the nursery to the
// playground. Everything is computed with the engine (engine/geometry.mjs) and the rules in
// DESIGN.md. Families share one base each: the dice faces one rounded square and one set of pips,
// the chess pieces one foot and one height, the card suits one size (the heart is edicion's, never
// redrawn), every playing card one card with the signature corner, and every badge is the engine's.
// The playground, the swing set and the seesaw are lugares'; the gamepad and the joystick are
// dispositivos'.
import { arc, badge, circ, dot, f, flipPath, halfChord, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import legal from './legal.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

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
/** Scales a path by `s` about `o` and moves `o` to `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);

/** The fillet at V between the edges toward A and toward B: its start, end and sweep. */
function fillet(A, V, B, r) {
  const u = unit(sub(A, V));
  const v = unit(sub(B, V));
  const th = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
  const t = r / Math.tan(th / 2);
  const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
  return { S: add2(V, mul(u, t)), E: add2(V, mul(v, t)), sweep: cz > 0 ? 1 : 0 };
}

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function roundline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    if (!rr[i]) {
      s += `L${pt(pts[i])}`;
      continue;
    }
    const { S, E, sweep } = fillet(pts[i - 1], pts[i], pts[i + 1], rr[i]);
    s += `L${pt(S)}A${f(rr[i])} ${f(rr[i])} 0 0 ${sweep} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/**
 * A closed silhouette symmetric about x = 12, from its right half: nodes from the top of the axis
 * down to its bottom, each `[x, y, r]` (a corner rounded by r) or `{ to: [x, y], arc: [r, large,
 * sweep] }` (a circular arc from the node before). The left half is the right one mirrored.
 */
function profile(right) {
  const nodes = right.map((n) => (Array.isArray(n) ? { p: [n[0], n[1]], r: n[2] ?? 0, arc: null } : { p: n.to, r: 0, arc: n.arc ?? null, c: n.c ?? null }));
  const n = nodes.length - 1;
  const mirror = ([x, y]) => [24 - x, y];
  // The loop: the right half down, then the left half back up; `arc` is the edge arriving there
  // (a cubic arriving at node i, reversed and mirrored, arrives at node i - 1 with its handles swapped)
  const back = (q) => (q.c ? { c: [mirror(q.c[1]), mirror(q.c[0])] } : { c: null });
  const loop = nodes.map((q, i) => (i === 0 ? { ...q, arc: nodes[1].arc, ...back(nodes[1]) } : q));
  for (let i = n - 1; i >= 1; i--) loop.push({ p: mirror(nodes[i].p), r: nodes[i].r, arc: nodes[i + 1].arc, ...back(nodes[i + 1]) });
  const L = loop.length;
  const at = (k) => loop[((k % L) + L) % L];
  let s = `M${pt(loop[0].p)}`;
  for (let k = 1; k <= L; k++) {
    const q = at(k);
    if (q.arc) {
      const [r, large, sweep] = q.arc;
      s += `A${f(r)} ${f(r)} 0 ${large} ${sweep} ${pt(q.p)}`;
    } else if (q.c) s += `C${pt(q.c[0])} ${pt(q.c[1])} ${pt(q.p)}`;
    else if (q.r && !at(k + 1).arc && !at(k + 1).c && k < L) {
      const { S, E, sweep } = fillet(at(k - 1).p, q.p, at(k + 1).p, q.r);
      s += `L${pt(S)}A${f(q.r)} ${f(q.r)} 0 0 ${sweep} ${pt(E)}`;
    } else s += `L${pt(q.p)}`;
  }
  return `${s}Z`;
}

/** Where two circles cross: [left of the line c1 → c2, right of it]. */
function circX(c1, r1, c2, r2) {
  const d = len(sub(c2, c1));
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const u = unit(sub(c2, c1));
  const m = add2(c1, mul(u, a));
  return [add2(m, mul([u[1], -u[0]], h)), add2(m, mul([-u[1], u[0]], h))];
}

/** Capsule (stadium): a rectangle whose short ends are half circles. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    const R = halfChord([x, y + r], [x + w, y + r]);
    return `M${pt([x, y + r])}A${R} ${R} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${R} ${R} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  const R = halfChord([x + r, y], [x + r, y + h]);
  return `M${pt([x + r, y])}H${f(x + w - r)}A${R} ${R} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${R} ${R} 0 0 1 ${pt([x + r, y])}Z`;
}

/** Ellipse with semi-axes rx, ry (four cubics). */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs, named parts and motion collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const MOTION = {};

// ── Dice ──────────────────────────────────────────────────────────────────────────────────────
// One face for all six: the square keyline with continuous corners (a die is an object, not a
// container: no signature corner) and pips of r 0.9, larger than the set's dots so they read as
// pips; the corner pips 4.75 from the center, 1.5 of paper from the edge and from each other.
const DIE = sq(3.25, 3.25, 17.5, 17.5, 4);
const PIP = 4.75;
const pip = (i, j) => dot(12 + i * PIP, 12 + j * PIP, 0.9);
const FACES = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
const WORDS = { 1: ['uno', 'one'], 2: ['dos', 'two'], 3: ['tres', 'three'], 4: ['cuatro', 'four'], 5: ['cinco', 'five'], 6: ['seis', 'six'] };
for (const [k, pips] of Object.entries(FACES)) {
  const name = `dice-${k}`;
  add(name, [`dado ${WORDS[k][0]}`, 'cara del dado', 'tirada', `die ${WORDS[k][1]}`, 'die face', 'roll'], [DIE, ...pips.map(([i, j]) => pip(i, j))]);
  FILL[name] = { solid: [0], cut: pips.map((_, i) => i + 1) };
  PARTS[name] = { face: [0], pips: pips.map((_, i) => i + 1) };
}

// The die in three-quarter view: the circle keyline's hexagon, its three faces met at the center,
// a pip in the middle of each (a face of a cube this size holds one pip with its paper)
{
  const R = 9.5;
  const V = [-90, -30, 30, 90, 150, 210].map((a) => polar(12, 12, R, a));
  const cube = roundpoly(V, 1.25);
  const edges = [line(V[5], [12, 12], V[1]), line([12, 12], V[3])];
  const top = [12, (V[0][1] + 12) / 2];
  const left = [(V[5][0] + 12) / 2, (V[5][1] + V[3][1]) / 2];
  const right = [24 - left[0], left[1]];
  add('dice', ['dado', 'tirar', 'al azar', 'juegos de mesa', 'dice', 'roll', 'random'], [cube, ...edges, dot(...top, 0.9), dot(...left, 0.9), dot(...right, 0.9)]);
  FILL.dice = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS.dice = { body: [0, 1, 2], pips: [3, 4, 5] };
  MOTION.dice = { effect: 'wiggle', origin: [12, 21.5] };
}

// A pair: the back face square and upright at the top left showing a four, its lower pips hidden
// behind the front face, which is turned 20° at the bottom right showing a three (a piece on top:
// the engine clears the back die under it)
{
  const back = sq(2.5, 2.5, 11.5, 11.5, 3);
  const bc = [8.25, 8.25];
  const bo = 2.6;
  const backPips = [[-1, -1], [1, -1]].map(([i, j]) => dot(bc[0] + i * bo, bc[1] + j * bo, 0.7));
  const fc = [15.5, 15.5];
  const front = turnPath(sq(fc[0] - 5.75, fc[1] - 5.75, 11.5, 11.5, 3), -20, fc);
  const fo = 2.7;
  const frontPips = [[-1, -1], [0, 0], [1, 1]].map(([i, j]) => dot(...rot([fc[0] + i * fo, fc[1] + j * fo], fc, -20), 0.7));
  add('dice-pair', ['dados', 'par de dados', 'noche de juegos', 'dice pair', 'two dice', 'game night'], [back, ...backPips], {
    badge: { d: [front, ...frontPips], knock: front, fill: { solid: [front], cut: frontPips } },
  });
  FILL['dice-pair'] = { solid: [0], cut: [1, 2] };
  PARTS['dice-pair'] = { back: [0, 1, 2] };
  MOTION['dice-pair'] = { effect: 'wiggle', parts: ['badge'], origin: [15.5, 15.5] };
}

// ── Chess ─────────────────────────────────────────────────────────────────────────────────────
// Every piece stands on the same foot (a slab 12 wide, 2.5 tall, its shoulders sloping in to the
// body) and reaches the same top; each is one silhouette, symmetric but for the knight.
const FOOT = [[15.25, 17.25, 1.25], [18, 18.25, 0.6], [18, 20.75, 1.25], [12, 20.75]];
const TOP = 2.75;
// Pawn: a ball on a collar over a bell
{
  const hc = [12, TOP + 3.75];
  const neckY = 10;
  const nx = 12 + Math.sqrt(3.75 ** 2 - (neckY - hc[1]) ** 2);
  const pawn = profile([[12, TOP], { to: [nx, neckY], arc: [3.75, 0, 1] }, [15.25, neckY, 0.6], [15.25, 11.75, 0.6], [13.5, 11.75, 0.5], ...FOOT]);
  add('chess-pawn', ['peón', 'ajedrez', 'primer movimiento', 'chess pawn', 'pawn', 'chess'], [pawn]);
  FILL['chess-pawn'] = { solid: [0] };
}
// The king, the queen and the bishop wear a collar between the head and the body, as the pawn does
const COLLAR = (y) => [[14, y, 0.5], [15.5, y, 0.5], [15.5, y + 1.5, 0.5], [13.6, y + 1.5, 0.4]];
// King: a crown band, wider at the top, a small ball on it
{
  const [bc, br, crownY] = [[12, TOP + 1.6], 1.6, 5.75];
  const nx = 12 + Math.sqrt(br ** 2 - (crownY - bc[1]) ** 2);
  const king = profile([[12, TOP], { to: [nx, crownY], arc: [br, 0, 1] }, [15.75, crownY, 0.6], [15.25, 8.75, 0.5], [13.25, 8.75, 0.4], ...COLLAR(10.25), ...FOOT]);
  add('chess-king', ['rey', 'ajedrez', 'jaque mate', 'chess king', 'king', 'checkmate'], [king]);
  FILL['chess-king'] = { solid: [0] };
}
// Queen: a coronet of three points, a ball over each (set clear of its point: a ball joined to a
// point this sharp left a sliver of a hole beside it at some weights)
{
  const tips = [[12, 6.35], [16.25, 6.65]];
  const queen = profile([tips[0], [14.1, 8.85, 0.6], [...tips[1], 0.5], ...COLLAR(11.25), ...FOOT]);
  const balls = [dot(12, 3.2, 0.7), dot(16.25, 3.5, 0.7), dot(7.75, 3.5, 0.7)];
  add('chess-queen', ['reina', 'dama', 'ajedrez', 'chess queen', 'queen', 'chess'], [queen, ...balls]);
  FILL['chess-queen'] = { solid: [0, 1, 2, 3] };
}
// Rook: a column under a crenellated top of three merlons
{
  const rook = profile([[12, TOP], [13.25, TOP, 0.4], [13.25, 5.25, 0.4], [15.75, 5.25, 0.4], [15.75, TOP, 0.4], [18.25, TOP, 0.6], [18.25, 7.5, 0.6], [15, 8.75, 0.6], ...FOOT]);
  add('chess-rook', ['torre', 'ajedrez', 'enroque', 'chess rook', 'rook', 'castling'], [rook]);
  FILL['chess-rook'] = { solid: [0] };
}
// Bishop: a mitre with one slanted notch, a ball on its point, on the collar
{
  const [tip, c1, c2, end] = [[12, 4.75], [13.75, 5.75], [17, 8.5], [13.6, 10.75]];
  const bez = (t) => [0, 1].map((k) => (1 - t) ** 3 * tip[k] + 3 * (1 - t) ** 2 * t * c1[k] + 3 * (1 - t) * t * t * c2[k] + t ** 3 * end[k]);
  const mitre = profile([tip, { to: end, c: [c1, c2] }, [15.5, 10.75, 0.5], [15.5, 12.25, 0.5], [13.6, 12.25, 0.4], ...FOOT]);
  const from = bez(0.32);
  const to = add2(from, mul(unit([-1.15, 1]), 3));
  add('chess-bishop', ['alfil', 'ajedrez', 'diagonal', 'chess bishop', 'bishop', 'chess'], [mitre, dot(12, 3.6, 0.9), line(from, to)]);
  // Filled, the notch opens through the edge
  FILL['chess-bishop'] = { solid: [0, 1], cut: [line(add2(from, mul(unit([1.15, -1]), 1.5)), to)] };
}
// Knight: a horse's head and neck facing left, its ear up and a notch in its mane, on the foot
{
  const head = [
    [16.5, 11.25, 2.5],
    [15.25, 5.25, 2],
    [13.5, 2.75, 0.5],
    [12.25, 4.25, 0.5],
    [10.5, 4.25, 1.5],
    [5.5, 9.25, 1],
    [6.5, 11.75, 1],
    [10.25, 11, 0.75],
  ];
  // Down the chest to the foot's left shoulder, round the foot, and back up its right shoulder
  const foot = [[8.75, 17.25, 1.25], [6, 18.25, 0.6], [6, 20.75, 1.25], [18, 20.75, 1.25], [18, 18.25, 0.6], [15.25, 17.25, 1.25]];
  const loop = [...head, ...foot];
  const knight = roundpoly(loop.map(([x, y]) => [x, y]), loop.map((p) => p[2]));
  add('chess-knight', ['caballo', 'ajedrez', 'estrategia', 'chess knight', 'knight', 'strategy'], [knight, dot(11.5, 7.25)]);
  FILL['chess-knight'] = { solid: [0], cut: [1] };
}
for (const name of ['chess-pawn', 'chess-king', 'chess-queen', 'chess-rook', 'chess-bishop', 'chess-knight']) PARTS[name] = { piece: [0] };

// ── Board and table games ─────────────────────────────────────────────────────────────────────
// The player token: a meeple, flat and chunky, its head round, its arms out, its legs apart
{
  const [hc, hr, neckY] = [[12, 6.25], 3.5, 9.5];
  const nx = 12 + Math.sqrt(hr ** 2 - (neckY - hc[1]) ** 2);
  const meeple = profile([[12, 2.75], { to: [nx, neckY], arc: [hr, 0, 1] }, [19.5, 10.25, 1.75], [20.75, 13.25, 1.25], [16.5, 13.75, 1], [18.75, 20.75, 1.25], [14.25, 20.75, 0.75], [12, 17.25, 1.25]]);
  add('game-piece', ['ficha', 'jugador', 'turno', 'game piece', 'player token', 'meeple'], [meeple]);
  FILL['game-piece'] = { solid: [0] };
  MOTION['game-piece'] = { effect: 'bounce', vector: [0, -2] };
}
// The spinner: a disc in four quarters and its pointer, an arrow across the disc pivoting on a pin
// at the center (a piece on top: the engine clears the quarters under it, round the arrow's hull, so
// the cut ends the same at every weight). A needle of two points read as lugares' compass.
{
  const axis = -140;
  const u = [Math.cos((axis * Math.PI) / 180), Math.sin((axis * Math.PI) / 180)];
  const n = [-u[1], u[0]];
  const tip = polar(12, 12, 5.75, axis);
  const tail = polar(12, 12, 4.5, axis + 180);
  const arms = head(tip, u, 2.75);
  // The arrowhead's two arm ends, for the hull the engine clears
  const ends = arms.match(/-?[\d.]+/g).map(Number);
  const [A, B] = [ends.slice(0, 2), ends.slice(4, 6)];
  const hull = `M${pt(tip)}L${pt(A)}L${pt(add2([12, 12], mul(n, -1.5)))}L${pt(tail)}L${pt(add2([12, 12], mul(n, 1.5)))}L${pt(B)}Z`;
  add('game-spinner', ['ruleta de juego', 'girar', 'al azar', 'game spinner', 'spin', 'random choice'], [circ(12, 12, 9), vl(12, 3, 21), hl(12, 3, 21)], {
    badge: { d: [line(tail, tip), arms, dot(12, 12, 0.75)], knock: hull },
  });
  FILL['game-spinner'] = { solid: [0], cut: [1, 2] };
  PARTS['game-spinner'] = { disc: [0], quarters: [1, 2] };
  MOTION['game-spinner'] = { effect: 'spin', parts: ['badge'], origin: [12, 12] };
}
// Go: three lines each way running a little past the edge, a black stone (a dot) sitting on the middle
// point and a white one (a ring) on a corner point, a piece on top that clears the lines under it; the
// two lines that run past it end well inside its clearance, at every weight (a white stone in the
// middle, its lines cut short all round, read as a gear)
{
  const L = [6.5, 12, 17.5];
  const grid = [...L.map((x) => vl(x, 4.75, 19.25)), ...L.map((y) => hl(y, 4.75, 19.25))];
  const white = circ(17.5, 6.5, 2);
  add('go-board', ['go', 'juego de go', 'estrategia', 'go game', 'baduk', 'weiqi'], [...grid, dot(12, 12, 0.9)], { badge: { d: [white], knock: white } });
  FILL['go-board'] = false;
  PARTS['go-board'] = { grid: [0, 1, 2, 3, 4, 5], stones: [6] };
}
// Tic-tac-toe: the hash and, in two corner cells, an X and an O, each 2.85 clear of the lines
{
  const hash = [vl(9, 3, 21), vl(15, 3, 21), hl(9, 3, 21), hl(15, 3, 21)];
  const x = [line([2.4, 2.4], [6.15, 6.15]), line([6.15, 2.4], [2.4, 6.15])];
  add('tic-tac-toe', ['gato', 'tres en raya', 'juego rápido', 'tic-tac-toe', 'noughts and crosses', 'xo'], [...hash, ...x, circ(19.7, 19.7, 1.85)]);
  FILL['tic-tac-toe'] = false;
  PARTS['tic-tac-toe'] = { grid: [0, 1, 2, 3], x: [4, 5], o: [6] };
}
// Domino: an upright tile split across the middle, two pips above and one below (a half this size
// holds two pips with their paper, not three)
{
  const tile = sq(6.25, 2.75, 11.5, 18.5, 3.25);
  add('domino', ['dominó', 'ficha', 'juego de fichas', 'domino', 'tile', 'dominoes'], [tile, hl(12, 6.25, 17.75), dot(9.65, 6.2, 0.9), dot(14.35, 8.55, 0.9), dot(12, 16.6, 0.9)]);
  FILL.domino = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS.domino = { tile: [0, 1], pips: [2, 3, 4] };
  MOTION.domino = { effect: 'wiggle', origin: [12, 21.25] };
}

// Darts: the board's rim, its inner ring, the bull and four spokes between the rings; a dart stuck
// in the bull, coming from the top right, its flight a V (a piece on top: the engine clears the board
// and the bull under it; a closed flight this small closed up at bold)
{
  const c = [11, 13];
  const spokes = [45, 135, 225, 315].map((a) => line(polar(...c, 4.5, a), polar(...c, 8.25, a)));
  const tip = [11.25, 12.75];
  const dir = unit([1, -1]);
  const tail = add2(tip, mul(dir, 8.5));
  const n = [dir[1], -dir[0]];
  const flight = line(add2(add2(tail, mul(dir, 2.25)), mul(n, 1.75)), tail, add2(add2(tail, mul(dir, 2.25)), mul(n, -1.75)));
  const shaft = line(tip, tail);
  add('dartboard', ['dardos', 'diana', 'puntería', 'dartboard', 'darts', 'aim'], [circ(...c, 8.25), circ(...c, 4.5), dot(...c, 0.9), ...spokes], {
    badge: { d: [shaft, flight], knock: `${shaft}Z${flight}Z` },
  });
  FILL.dartboard = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS.dartboard = { board: [0, 1, 2, 3, 4, 5, 6] };
}

// ── Cards ─────────────────────────────────────────────────────────────────────────────────────
// The suits share one size, edicion's heart's (18.5 wide): the spade is that heart upside down,
// scaled to leave room for its stem; the club three lobes of the same weight; the diamond a rhombus
// with slightly hollow sides. Each stem's neck is 2.6 wide, so it stays open at every weight.
const SUIT_TOP = 2.75;
const SUIT_FOOT = 20.75;
/**
 * The spade: edicion's heart upside down at scale k, its point at (cx, top), and its stem, the neck
 * 2.6 wide at every size (so it stays open at every weight) flaring to a foot below the lobes.
 */
function spade(cx, top, k) {
  const T = [cx, top];
  const C = [cx + 4.5 * k, top + 11.75 * k];
  const r = 4.75 * k;
  const base = (Math.atan2(C[1] - T[1], C[0] - T[0]) * 180) / Math.PI;
  const phi = (Math.acos(r / Math.hypot(C[0] - T[0], C[1] - T[1])) * 180) / Math.PI;
  const tan = polar(...C, r, base + 180 + phi);
  const J = [cx + 1.3, C[1] + Math.sqrt(r * r - (cx + 1.3 - C[0]) ** 2)];
  const foot = top + (18 * k) / 0.94;
  const fx = cx + Math.max(2.6 * (k / 0.94), 2.2);
  const P = (p) => [p[0] - cx + 12, p[1]];
  const d = profile([P(T), P(tan), { to: P(J), arc: [r, 1, 1] }, { to: P([fx, foot]), c: [P([J[0] - 0.15, J[1] + (foot - J[1]) * 0.9]), P([cx + 1, foot - 0.1])] }, P([cx, foot])]);
  return transform(d, 1, cx - 12, 0);
}
const SPADE = spade(12, SUIT_TOP, 0.94);
const stem = (J) => ({ to: [14.6, SUIT_FOOT], c: [[J[0] - 0.15, J[1] + 2.25], [13, SUIT_FOOT - 0.1]] });
const CLUB = (() => {
  const r = 4.25;
  const T = [12, SUIT_TOP + r];
  const R = [16.25, 13.25];
  // Where the top lobe meets the right one, on the outside
  const d = len(sub(R, T));
  const a = d / 2;
  const h = Math.sqrt(r * r - a * a);
  const m = lerp(T, R, 0.5);
  const u = unit(sub(R, T));
  const X = [m[0] + h * -u[1] * -1, m[1] + h * u[0] * -1];
  const outer = X[1] < m[1] - 0 ? X : [m[0] - h * -u[1] * -1, m[1] - h * u[0] * -1];
  const jy = R[1] + Math.sqrt(r * r - (13.3 - R[0]) ** 2);
  const J = [13.3, jy];
  return profile([[12, SUIT_TOP], { to: outer, arc: [r, 0, 1] }, { to: J, arc: [r, 1, 1] }, stem(J), [12, SUIT_FOOT]]);
})();
const DIAMOND = (() => {
  const P = [[12, SUIT_TOP], [19.25, 12], [12, 21.25], [4.75, 12]];
  const side = (a, b) => `A16 16 0 0 0 ${pt(b)}`;
  return `M${pt(P[0])}${side(P[0], P[1])}${side(P[1], P[2])}${side(P[2], P[3])}${side(P[3], P[0])}Z`;
})();
add('spade-suit', ['picas', 'espadas', 'palo de cartas', 'spades', 'spade suit', 'card suit'], [SPADE]);
add('club-suit', ['tréboles', 'bastos', 'palo de cartas', 'clubs', 'club suit', 'card suit'], [CLUB]);
add('diamond-suit', ['diamantes', 'rombos', 'palo de cartas', 'diamonds', 'diamond suit', 'card suit'], [DIAMOND]);
for (const name of ['spade-suit', 'club-suit', 'diamond-suit']) {
  FILL[name] = { solid: [0] };
  PARTS[name] = { suit: [0] };
}

// The playing card: the portrait keyline with the signature corner, the spade at its middle
const CARD = sq(4.75, 2.75, 14.5, 18.5, 3, BR);
/** The spade w wide, centered on c (its neck stays 2.6 wide). */
const spadeAt = (c, w) => {
  const k = (w / 17.4) * 0.94;
  return spade(c[0], c[1] - ((18 * k) / 0.94) / 2, k);
};
add('playing-card', ['carta', 'naipe', 'juego de cartas', 'playing card', 'card game', 'card'], [CARD, spadeAt([12, 12], 8.25)]);
FILL['playing-card'] = { solid: [0], cut: [1] };
PARTS['playing-card'] = { card: [0], suit: [1] };
// A hand: the same card, smaller, three times, fanned 15° each way from a point far below them (a
// wider fan round a nearer point left only the backs' outer corners showing, like wings); the middle
// one in front with its spade (a piece on top: the engine clears the two behind it)
{
  const small = sq(8, 6.75, 8, 13.5, 2, BR);
  const back = [turnPath(small, -15, [12, 30]), turnPath(small, 15, [12, 30])];
  const sp = spadeAt([12, 12.75], 5);
  add('playing-card-fan', ['mano de cartas', 'póker', 'juego de cartas', 'card hand', 'poker hand', 'card games'], back, {
    badge: { d: [small, sp], knock: small, fill: { solid: [small], cut: [sp] } },
  });
  FILL['playing-card-fan'] = { solid: [0, 1] };
  PARTS['playing-card-fan'] = { cards: [0, 1] };
}
// The trading card: the card, its art window across the top, its name line, and the engine's star for
// its rarity (a window over two short stats read as a handheld console; a round window as a contact
// card)
add('trading-card', ['carta coleccionable', 'colección', 'tcg', 'trading card', 'collectible card', 'card value'], [CARD, sq(7.75, 5.75, 8.5, 4, 1.25), hl(12.75, 7.75, 10.25)], { badge: badge('star') });
FILL['trading-card'] = { solid: [0], cut: [1, 2] };
PARTS['trading-card'] = { card: [0], art: [1], name: [2] };
// The poker chip: the rim, its inner ring and eight edge spots between them
{
  const spots = Array.from({ length: 8 }, (_, i) => line(polar(12, 12, 5.75, i * 45 + 22.5), polar(12, 12, 9, i * 45 + 22.5)));
  add('poker-chip', ['ficha de póker', 'apuesta', 'ficha', 'poker chip', 'bet', 'chip'], [circ(12, 12, 9), circ(12, 12, 5.75), ...spots]);
  FILL['poker-chip'] = { solid: [0], cut: [1, ...spots.map((_, i) => i + 2)] };
  PARTS['poker-chip'] = { rim: [0], ring: [1], spots: spots.map((_, i) => i + 2) };
  MOTION['poker-chip'] = { effect: 'spin', origin: [12, 12] };
}

// ── Puzzles ───────────────────────────────────────────────────────────────────────────────────
// The jigsaw: a square of four pieces 7 wide with the top right one lifted out and set up and to the
// right (the three left as one outline: their inner seams crowded it). The socket's two sides have
// blanks and the lifted piece the two tabs that fit them, each a circle of r 1.45 on a neck 2.6 wide
// (open at every weight), set off-center toward the socket's inner corner so every blank keeps 3 of
// clearance from the outer edges (a blank in the middle of a side this short pinched it at bold).
{
  const T = { r: 1.45, half: 1.3 };
  const r = 1.25;
  // The three pieces left, clockwise from the top left corner; the socket's sides bite into them
  const L = `M3 ${f(7 + r)}A${r} ${r} 0 0 1 ${f(3 + r)} 7H10V${f(11.75 - T.half)}A${T.r} ${T.r} 0 1 1 10 ${f(11.75 + T.half)}V14H${f(12.25 - T.half)}A${T.r} ${T.r} 0 1 0 ${f(12.25 + T.half)} 14H17V${f(21 - r)}A${r} ${r} 0 0 1 ${f(17 - r)} 21H${f(3 + r)}A${r} ${r} 0 0 1 3 ${f(21 - r)}Z`;
  // The lifted piece, 5 up and 5 to the right, its tabs on its left and bottom sides
  const [x0, y0, x1, y1] = [15, 2, 22, 9];
  const lifted = `M${f(x0 + r)} ${y0}H${f(x1 - r)}A${r} ${r} 0 0 1 ${x1} ${f(y0 + r)}V${f(y1 - r)}A${r} ${r} 0 0 1 ${f(x1 - r)} ${y1}H${f(17.25 + T.half)}A${T.r} ${T.r} 0 1 1 ${f(17.25 - T.half)} ${y1}H${f(x0 + r)}A${r} ${r} 0 0 1 ${x0} ${f(y1 - r)}V${f(6.75 + T.half)}A${T.r} ${T.r} 0 1 1 ${x0} ${f(6.75 - T.half)}V${f(y0 + r)}A${r} ${r} 0 0 1 ${f(x0 + r)} ${y0}Z`;
  add('jigsaw-puzzle', ['rompecabezas', 'puzle', 'pieza que falta', 'jigsaw puzzle', 'puzzle', 'missing piece'], [L], {
    badge: { d: [lifted], knock: lifted, fill: { solid: [lifted] } },
  });
  FILL['jigsaw-puzzle'] = { solid: [0] };
  PARTS['jigsaw-puzzle'] = { pieces: [0] };
  MOTION['jigsaw-puzzle'] = { effect: 'bounce', parts: ['badge'], vector: [1, -1] };
}
// The puzzle cube: the die's hexagon, smaller, each face split in four (a face this size takes one
// line each way: three would sit closer than the strokes allow)
{
  const R = 8.25;
  const V = [-90, -30, 30, 90, 150, 210].map((a) => polar(12, 12, R, a));
  const C = [12, 12];
  const mid = (a, b) => lerp(a, b, 0.5);
  const cube = roundpoly(V, 1);
  const edges = [line(V[5], C, V[1]), line(C, V[3])];
  const grid = [
    line(mid(V[0], V[1]), mid(V[5], C)),
    line(mid(V[0], V[5]), mid(V[1], C)),
    line(mid(V[5], C), mid(V[4], V[3])),
    line(mid(V[5], V[4]), mid(C, V[3])),
    line(mid(C, V[1]), mid(V[3], V[2])),
    line(mid(V[1], V[2]), mid(C, V[3])),
  ];
  add('puzzle-cube', ['cubo de rubik', 'cubo mágico', 'acertijo', 'puzzle cube', 'twisty puzzle', 'brain game'], [cube, ...edges, ...grid]);
  FILL['puzzle-cube'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8] };
  PARTS['puzzle-cube'] = { cube: [0, 1, 2], grid: [3, 4, 5, 6, 7, 8] };
}
// The crossword: a word across and a word down, four cells each, sharing their second cell
{
  const [a, b] = [7.5, 12];
  const cross = roundpoly([[a, 3], [b, 3], [b, a], [21, a], [21, b], [b, b], [b, 21], [a, 21], [a, b], [3, b], [3, a], [a, a]], [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0]);
  add('crossword', ['crucigrama', 'palabras', 'pasatiempo', 'crossword', 'word puzzle', 'daily puzzle'], [cross, sq(a, a, 4.5, 4.5, 0), vl(16.5, a, b), hl(16.5, a, b)]);
  FILL.crossword = { solid: [0], cut: [1, 2, 3] };
  PARTS.crossword = { grid: [0, 1, 2, 3] };
}

// ── Arcade and consoles ───────────────────────────────────────────────────────────────────────
// The arcade cabinet, from the front: the marquee overhanging at the top, the screen with the
// signature corner, the control deck sloping out below it, the stick standing on it and a button.
// The stick's ball keeps clear of the screen and of the deck at every weight.
{
  const cab = profile([[12, 2.75], [19.25, 2.75, 1], [19.25, 4.75, 0.5], [18.25, 4.75, 0.4], [18.25, 16.25, 0], [20.75, 18.5, 0.5], [20.75, 19.75, 0.5], [18.25, 19.75, 0.4], [18.25, 21.25, 0.6], [12, 21.25]]);
  const screen = sq(8.5, 7.25, 7, 3, 1.25, BR);
  add('arcade-cabinet', ['arcade', 'maquinita', 'videojuego retro', 'arcade machine', 'arcade cabinet', 'retro gaming'], [cab, screen, hl(16.25, 5.75, 18.25), vl(9.25, 16.25, 13.25), dot(9.25, 13.25, 0.7), dot(14.75, 16.25, 0.7)]);
  FILL['arcade-cabinet'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['arcade-cabinet'] = { cabinet: [0], screen: [1], deck: [2], stick: [3, 4], button: [5] };
}
// The claw machine: the glass box over its base, the claw hanging on its cable over a low mound of
// prizes, the prize chute a slot in the base
{
  const box = sq(4.75, 2.75, 14.5, 18.5, 3, BR);
  // Two fingers splayed out from the cable's end, their tips hooked in (an arch read as a magnet)
  const finger = roundline([[12, 6.75], [9, 9.25], [9.75, 11.5]], [0, 0.75, 0]);
  add('claw-machine', ['máquina de peluches', 'garra', 'premios', 'claw machine', 'crane game', 'prize'], [box, hl(15.5, 4.75, 19.25), vl(12, 2.75, 6.75), finger, flipPath(finger), 'M7.75 15.5Q12 13.5 16.25 15.5', hl(18.4, 9.5, 14.5)]);
  FILL['claw-machine'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['claw-machine'] = { machine: [0, 1], claw: [2, 3, 4], prizes: [5], chute: [6] };
  MOTION['claw-machine'] = { effect: 'bounce', parts: ['claw'], vector: [0, 1.5] };
}
// The gumball machine: a round glass globe holding three gumballs, on a squat base with its knob and
// its chute
{
  const g = [12, 8.25];
  const balls = [-90, 30, 150].map((a) => dot(...polar(...g, 2.45, a), 0.6));
  const base = roundpoly([[8.25, 14.25], [15.75, 14.25], [17.75, 21.25], [6.25, 21.25]], [1, 1, 1.25, 1.25]);
  add('gumball-machine', ['máquina de chicles', 'gachapón', 'premio', 'gumball machine', 'capsule toy', 'gacha'], [circ(...g, 6), base, ...balls, dot(12, 17.5, 0.6)]);
  FILL['gumball-machine'] = { solid: [0, 1], cut: [2, 3, 4, 5] };
  PARTS['gumball-machine'] = { globe: [0], base: [1], gumballs: [2, 3, 4], knob: [5] };
}
// The cartridge, from the front: a wide shell with its grip ridges along the top, its label with the
// signature corner and the contact edge, a narrower tab below (a portrait shell with ridges read as
// dispositivos' sd-card; contacts on the tab read as a skull's teeth)
{
  const shell = profile([[12, 3.25], [20.75, 3.25, 2.5], [20.75, 15.75, 1], [17.25, 15.75, 0.75], [17.25, 20.75, 1], [12, 20.75]]);
  const ridges = [7.5, 10.5, 13.5, 16.5].map((x) => vl(x, 3.25, 5.5));
  add('game-cartridge', ['cartucho', 'juego retro', 'biblioteca de juegos', 'game cartridge', 'retro game', 'cartridge'], [shell, sq(6.25, 8.5, 11.5, 4.25, 1.25, BR), ...ridges]);
  FILL['game-cartridge'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
  PARTS['game-cartridge'] = { shell: [0], label: [1], ridges: [2, 3, 4, 5] };
}
// Playtime: dispositivos' gamepad, smaller and up to the left, with the engine's clock
{
  const pad = dispositivos.icons.gamepad.d.map((d) => place(d, 0.98, [12, 12.375], [11, 10.85]));
  add('gamepad-clock', ['tiempo de juego', 'límite de tiempo', 'control parental', 'playtime', 'game time', 'screen time'], pad, { badge: badge('clock') });
  FILL['gamepad-clock'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['gamepad-clock'] = { body: [0], dpad: [1, 2], stick: [3] };
}
// The directional pad: a thick plus, each arm with a small arrowhead pointing out (drawn once, for
// the right arm, and turned; a closed triangle this small opened and closed with the weight)
{
  const [a, b] = [7.75, 16.25];
  const plus = roundpoly([[a, 2.25], [b, 2.25], [b, a], [21.75, a], [21.75, b], [b, b], [b, 21.75], [a, 21.75], [a, b], [2.25, b], [2.25, a], [a, a]], [1.25, 1.25, 1, 1.25, 1.25, 1, 1.25, 1.25, 1, 1.25, 1.25, 1]);
  const tri = head([19, 12], [1, 0], 2, 40);
  add('directional-pad', ['cruceta', 'control', 'mover', 'd-pad', 'directional pad', 'game controls'], [plus, ...[0, 90, 180, 270].map((deg) => turnPath(tri, deg))]);
  FILL['directional-pad'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['directional-pad'] = { pad: [0], arrows: [1, 2, 3, 4] };
}

// ── Video game language ──────────────────────────────────────────────────────────────────────
// edicion's heart (lobes of r 4.75, 18.5 wide from 2.75, its tip at 20.5) and núcleo's bolt, placed
const HEART = edicion.icons.heart.d[0];
const heartAt = (c, w) => place(HEART, w / 18.5, [12, 12.25], c);
const BOLT = nucleo.icons.bolt.d[0];
const boltAt = (c, h) => place(BOLT, h / 14.6, [12, 12], c);
/** Points along a path of segments, every `step`, for dashes. */
function dashes(pts, dash, gap) {
  const segs = [];
  let carry = 0;
  let on = true;
  let cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    let [a, b] = [pts[i - 1], pts[i]];
    let L = len(sub(b, a));
    while (L > 0) {
      const need = (on ? dash : gap) - carry;
      if (L >= need) {
        const p = add2(a, mul(unit(sub(b, a)), need));
        if (on) {
          cur.push(p);
          segs.push(cur);
        } else cur = [p];
        on = !on;
        carry = 0;
        L -= need;
        a = p;
      } else {
        if (on) cur.push(b);
        carry += L;
        L = 0;
      }
    }
  }
  if (on && carry > 1.99) segs.push(cur);
  return segs.map((s) => line(...s));
}
/** A quadratic curve sampled into points. */
const quad = (a, c, b, n = 24) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n;
  return [0, 1].map((k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * c[k] + t * t * b[k]);
});

// The achievement: a hexagonal medallion with an inner hexagon, on two ribbon tails fanning down from
// behind it, each 3 wide and notched
{
  const c = [12, 9];
  const hex = (r) => roundpoly([-90, -30, 30, 90, 150, 210].map((a) => polar(...c, r, a)), r > 4 ? 1.25 : 0.75);
  const outer = hex(6.25);
  const tail = line([7.6, 12.6], [5.75, 20.75], [7.6, 19.6], [8.9, 21], [10.6, 14.45]);
  const ACH = [outer, hex(3.25), tail, flipPath(tail)];
  add('achievement', ['logro', 'insignia', 'meta cumplida', 'achievement', 'badge earned', 'unlocked'], ACH);
  add('achievement-lock', ['logro bloqueado', 'logro oculto', 'por desbloquear', 'locked achievement', 'hidden achievement', 'not earned'], ACH, { badge: badge('lock') });
  for (const name of ['achievement', 'achievement-lock']) {
    FILL[name] = { solid: [0], cut: [1], lines: [2, 3] };
    PARTS[name] = { medal: [0, 1], ribbon: [2, 3] };
  }
  MOTION.achievement = { effect: 'beat', origin: [12, 9] };
}
// Level up: a thick arrow rising out of a bar, a short spark at each side of its head
{
  const arrow = roundline([[9.5, 19.5], [9.5, 12], [5.75, 12], [12, 4.25], [18.25, 12], [14.5, 12], [14.5, 19.5]], [0, 0.6, 1, 1.25, 1, 0.6, 0]);
  const spark = line([2.75, 7.75], [4.75, 6.9]);
  add('level-up', ['subir de nivel', 'nuevo nivel', 'progreso', 'level up', 'rank up', 'progression'], [arrow, hl(19.5, 3.25, 20.75), spark, flipPath(spark)]);
  FILL['level-up'] = { solid: [`${arrow}Z`], wire: [hl(19.5, 3.25, 20.75)], lines: [spark, flipPath(spark)] };
  PARTS['level-up'] = { arrow: [0], bar: [1], sparks: [2, 3] };
  MOTION['level-up'] = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
}
// The level map: three stages up the canvas linked by a winding path, a flag planted on the last
{
  const nodes = [[6.5, 18.5], [17.25, 13.75], [7.5, 8.25]];
  const R = 1.75;
  const ring = (c) => circ(...c, R);
  const paths = ['M8.25 18.5C12.5 18.5 15.75 18.25 17.25 15.5', 'M15.5 13.75C12.25 13.75 8 12.5 7.5 10'];
  const flag = sq(7.5, 2.25, 4.75, 3.25, 0.6, { square: ['tl', 'bl'] });
  add('level-map', ['mapa de niveles', 'selección de nivel', 'siguiente nivel', 'level map', 'level select', 'stages'], [...nodes.map(ring), ...paths, vl(7.5, 6.5, 2.25), flag]);
  FILL['level-map'] = { solid: [0, 1, 2, 6], wire: [3, 4, 5] };
  PARTS['level-map'] = { stages: [0, 1, 2], path: [3, 4], flag: [5, 6] };
}
// The skill tree: hexagonal nodes in three rows, one at the bottom branching up into two and then
// three, joined by lines that end on them
{
  const hexAt = (c) => roundpoly([0, 60, 120, 180, 240, 300].map((a) => polar(...c, 2, a)), 0.5);
  const N = { b: [12, 19.25], l: [7.75, 12], r: [16.25, 12], tl: [4, 4.75], tc: [12, 4.75], tr: [20, 4.75] };
  const join = (a, b) => {
    const u = unit(sub(b, a));
    return line(add2(a, mul(u, 1.85)), add2(b, mul(u, -1.85)));
  };
  add('skill-tree', ['árbol de habilidades', 'mejoras', 'desbloquear', 'skill tree', 'upgrades', 'abilities'], [
    ...Object.values(N).map(hexAt),
    join(N.b, N.l), join(N.b, N.r), join(N.l, N.tl), join(N.l, N.tc), join(N.r, N.tr),
  ]);
  FILL['skill-tree'] = { solid: [0, 1, 2, 3, 4, 5], wire: [6, 7, 8, 9, 10] };
  PARTS['skill-tree'] = { nodes: [0, 1, 2, 3, 4, 5], branches: [6, 7, 8, 9, 10] };
}
// Health: a small heart and a long bar in four segments, three of them full (filled, the last stays
// empty)
{
  const bar = sq(10, 9, 11.75, 6, 2);
  const xs = [12.94, 15.88, 18.81];
  add('health-bar', ['salud', 'puntos de vida', 'vida', 'health bar', 'hit points', 'hp'], [heartAt([4.75, 12], 5.5), bar, ...xs.map((x) => vl(x, 9, 15))]);
  FILL['health-bar'] = { solid: [0, sq(10, 9, 8.81, 6, 2, { square: ['tr', 'br'] })], cut: [2, 3], wire: [1, 4] };
  PARTS['health-bar'] = { heart: [0], bar: [1], segments: [2, 3, 4] };
}
// The power-up: an item block with the bolt in it and three short rays above
{
  const block = sq(4.5, 8, 15, 13.25, 3.5);
  const rays = [vl(12, 2.25, 4.9), line([5.35, 3.4], [7.1, 5.15]), line([18.65, 3.4], [16.9, 5.15])];
  add('power-up', ['potenciador', 'bonificación', 'habilidad especial', 'power-up', 'boost', 'bonus'], [block, boltAt([12, 14.6], 9), ...rays]);
  FILL['power-up'] = { solid: [0], cut: [1], lines: [2, 3, 4] };
  PARTS['power-up'] = { block: [0], bolt: [1], rays: [2, 3, 4] };
  MOTION['power-up'] = { effect: 'beat', origin: [12, 14.5] };
}
// The potion: a round-bellied bottle, a short neck and a cork, the liquid's wavy surface and one
// bubble in it
{
  const [c, r] = [[12, 14.5], 6.25];
  const nx = 13.25;
  const ny = c[1] - Math.sqrt(r * r - (nx - 12) ** 2);
  const bottle = profile([[12, 2.75], [14, 2.75, 0.5], [14, 5.25, 0.4], [nx, 5.25, 0], { to: [nx, ny], arc: null }, { to: [12, c[1] + r], arc: [r, 0, 1] }]);
  const w = c[1] - 1;
  const wx = Math.sqrt(r * r - (w - c[1]) ** 2);
  const wave = `M${pt([c[0] - wx, w])}C${pt([9, w - 1.5])} ${pt([10.5, w + 1.5])} ${pt([12, w])}C${pt([13.5, w - 1.5])} ${pt([15, w + 1.5])} ${pt([c[0] + wx, w])}`;
  add('potion', ['poción', 'elixir', 'pócima', 'potion', 'elixir', 'consumable'], [bottle, hl(5.25, 10.75, 13.25), wave, dot(13, 17.25, 0.9)]);
  FILL.potion = { solid: [0], cut: [1, 2, 3] };
  PARTS.potion = { bottle: [0], cork: [1], liquid: [2], bubble: [3] };
  MOTION.potion = { effect: 'wiggle', origin: [12, 20.75] };
}
// Cooldown: the ability tile, a bolt of lightning up and to the left, and the engine's clock: the
// ability is on a timer (a wipe of two hands across the tile read as a square clock or a pie chart;
// núcleo's bolt, small enough to clear the clock, closed up at bold, so here it is one zigzag stroke)
{
  add('cooldown', ['enfriamiento', 'recarga', 'tiempo de espera', 'cooldown', 'recharge', 'ability timer'], [sq(3.25, 3.25, 17.5, 17.5, 4), line([12.75, 6.25], [8.5, 11.5], [12, 11.5], [8, 16.5])], { badge: badge('clock') });
  FILL.cooldown = { solid: [0], cut: [1] };
  PARTS.cooldown = { tile: [0], bolt: [1] };
}
// The treasure chest: the box, its domed lid as wide as it, the latch hanging from the seam and three
// gleams above (a lid narrower than the box, over a band down the front, read as a bun over two drawers)
{
  const body = roundpoly([[3.75, 12.25], [20.25, 12.25], [20.25, 20.75], [3.75, 20.75]], [0, 0, 0, 2]);
  const lid = 'M3.75 12.25V10.75C3.75 8.5 7.25 6.75 12 6.75S20.25 8.5 20.25 10.75V12.25';
  const latch = roundline([[10.75, 12.25], [10.75, 15.25], [13.25, 15.25], [13.25, 12.25]], [0, 0.75, 0.75, 0]);
  const ray = line([4.75, 3.25], [6.25, 4.75]);
  add('treasure-chest', ['cofre', 'tesoro', 'botín', 'treasure chest', 'loot', 'reward'], [body, lid, latch, vl(12, 1.75, 3.75), ray, flipPath(ray)]);
  // Filled, the seam between the lid and the box is cut through, as hogar's storage chest
  FILL['treasure-chest'] = { solid: [0, `${lid}Z`], cut: [hl(12.25, 2.75, 21.25), 2], lines: [3, 4, 5] };
  PARTS['treasure-chest'] = { chest: [0, 2], lid: [1], gleam: [3, 4, 5] };
}
// The treasure map: lugares' folded map, its trail dashed from the bottom left to an X
{
  const MAP = lugares.icons.map.d[0];
  const trail = dashes(quad([6, 15.75], [8, 10.25], [12.75, 11.5]), 2.25, 2.9);
  const x = [line([15.25, 9.5], [18.25, 12.5]), line([18.25, 9.5], [15.25, 12.5])];
  add('treasure-map', ['mapa del tesoro', 'búsqueda', 'aventura', 'treasure map', 'treasure hunt', 'quest'], [MAP, ...trail, ...x]);
  FILL['treasure-map'] = { solid: [0], cut: trail.map((_, i) => i + 1).concat([trail.length + 1, trail.length + 2]) };
  PARTS['treasure-map'] = { map: [0], trail: trail.map((_, i) => i + 1), x: [trail.length + 1, trail.length + 2] };
}
// The quest: legal's parchment, its two rolls and its sheet, with the engine's alert, the quest
// marker; once done, its check (a scroll drawn apart from the set's parchment broke the family, and
// the sheet between its rolls is too short for an exclamation mark of its own with its clearances)
{
  const QUEST = legal.icons.parchment.d.slice(0, 4);
  add('quest', ['misión', 'búsqueda', 'reto', 'quest', 'mission', 'challenge'], QUEST, { badge: badge('alert') });
  add('quest-check', ['misión cumplida', 'reto superado', 'completado', 'quest completed', 'mission done', 'challenge cleared'], QUEST, { badge: badge('check') });
  // Filled as the parchment: the rolls and the sheet solid, the seams between them cut out
  for (const name of ['quest', 'quest-check']) {
    FILL[name] = { solid: [0, 1, 'M6.25 6.25H17.75V17.75H6.25Z'], cut: [hl(6.25, 6.25, 17.75), hl(17.75, 6.25, 17.75)] };
    PARTS[name] = { rolls: [0, 1], sheet: [2, 3] };
  }
  MOTION.quest = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };
}
// The leaderboard: three rows, each a player and a bar, the bars shorter as they go down, the first
// player a crown (a crown over the first player's dot was too small to read)
{
  const rows = [6.5, 12, 17.5];
  const crown = roundpoly([[2.5, 8.75], [2.5, 4.5], [3.95, 5.9], [5, 4], [6.05, 5.9], [7.5, 4.5], [7.5, 8.75]], [0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.5]);
  add('leaderboard', ['clasificación', 'ranking', 'mejores jugadores', 'leaderboard', 'rankings', 'top players'], [crown, dot(5, rows[1], 1), dot(5, rows[2], 1), hl(rows[0], 10.5, 21), hl(rows[1], 10.5, 18), hl(rows[2], 10.5, 15)]);
  FILL.leaderboard = { solid: [0, 1, 2], wire: [3, 4, 5] };
  PARTS.leaderboard = { crown: [0], players: [1, 2], scores: [3, 4, 5] };
}
// The coin toss: the coin in midair, tilted, its edge a thin rim under its face (ink at every weight),
// and an arrow arcing over it (a coin with no edge read as a flying ring)
{
  const c = [12, 15.25];
  const coin = turnPath(ell(c, 5.5, 2.5), -15, c);
  const edge = turnPath(`M${pt([c[0] - 5.5, c[1]])}C${pt([c[0] - 5.5, c[1] + 2.25])} ${pt([c[0] - 3, c[1] + 3.3])} ${pt([c[0], c[1] + 3.3])}C${pt([c[0] + 3, c[1] + 3.3])} ${pt([c[0] + 5.5, c[1] + 2.25])} ${pt([c[0] + 5.5, c[1]])}`, -15, c);
  const a = arc(12, 13.25, 8, 200, 335);
  add('coin-flip', ['lanzar moneda', 'cara o cruz', 'volado', 'coin flip', 'heads or tails', 'coin toss'], [coin, edge, a.d, head(a.end, a.tangent, 3.4)]);
  // Filled, one silhouette: the face's top half and the rim under it
  const face = ell(c, 5.5, 2.5);
  const top = face.slice(face.indexOf('C', face.indexOf('C', face.indexOf('C') + 1) + 1)).replace(/Z$/, '');
  const rim = `C${pt([c[0] + 5.5, c[1] + 2.25])} ${pt([c[0] + 3, c[1] + 3.3])} ${pt([c[0], c[1] + 3.3])}C${pt([c[0] - 3, c[1] + 3.3])} ${pt([c[0] - 5.5, c[1] + 2.25])} ${pt([c[0] - 5.5, c[1]])}`;
  FILL['coin-flip'] = { solid: [turnPath(`M${pt([c[0] - 5.5, c[1]])}${top}${rim}Z`, -15, c)], lines: [2, 3] };
  PARTS['coin-flip'] = { coin: [0, 1], arrow: [2, 3] };
  MOTION['coin-flip'] = { effect: 'bounce', parts: ['coin'], vector: [0, -2] };
}
// The minimap: the HUD's frame with the signature corner, a coastline across its lower part and the
// player, an arrowhead pointing up at the middle (two strokes across its corners read as page curls)
{
  const player = roundpoly([[12, 6.75], [15, 13.25], [12, 11.5], [9, 13.25]], [0.5, 0.6, 0.4, 0.6]);
  add('minimap', ['minimapa', 'mapa del juego', 'jugador', 'minimap', 'game map', 'hud'], [sq(3.25, 3.25, 17.5, 17.5, 4, BR), 'M3.25 16.75C6.5 15 8.75 17.75 12 17C15 16.25 17.25 14.25 20.75 15.25', player]);
  FILL.minimap = { solid: [0], cut: [1, 2] };
  PARTS.minimap = { frame: [0], terrain: [1], player: [2] };
}
// The monster: a round blob with two small horns on its crown, two eyes, a mouth of jagged teeth and
// two short legs (one large eye under two horns is a known film character's)
{
  const C = [12, 12.5];
  const R = 7;
  const horn = (a0, a1, tip) => [{ to: polar(...C, R, a0), arc: [R, 0, 1] }, [...tip, 0.4], [...polar(...C, R, a1), 0]];
  const foot = polar(...C, R, 62);
  const blob = profile([[12, C[1] - R], ...horn(-80, -64, [15.25, 2]), { to: foot, arc: [R, 0, 1] }, [foot[0], 21, 0.6], [13.25, 21, 0.6], [13.25, 19.25, 0.4], [12, 19.25]]);
  add('monster', ['monstruo', 'criatura', 'enemigo', 'monster', 'creature', 'enemy'], [blob, dot(9.5, 10.75), dot(14.5, 10.75), line([8.5, 14.25], [10.25, 16], [12, 14.25], [13.75, 16], [15.5, 14.25])]);
  FILL.monster = { solid: [0], cut: [1, 2, 3] };
  PARTS.monster = { body: [0], eyes: [1, 2], mouth: [3] };
  MOTION.monster = { effect: 'wiggle', origin: [12, 21] };
}
// The knight's helm, from the front: a domed helm, its T opening a notch in the silhouette (the eye
// slit across, the face open below it) and a plume curving back from its crown (a T drawn inside a
// dome, under a plume, read as a computer mouse on its cable)
{
  const helm = profile([[12, 4], { to: [18, 10.5], arc: [6.5, 0, 1] }, [18, 17.5, 2], [17, 21, 0.75], [13.5, 21, 0.6], [13.5, 13.5, 0.6], [16, 13.5, 0.75], [16, 10.75, 0.75], [12, 10.75]]);
  add('knight-helmet', ['yelmo', 'caballero', 'guerrero', 'knight helmet', 'helm', 'warrior'], [helm, 'M12 4C12.25 2.5 14.5 1.9 17 2.6']);
  FILL['knight-helmet'] = { solid: [0], wire: [1] };
  PARTS['knight-helmet'] = { helm: [0], plume: [1] };
}

// ── Toys ──────────────────────────────────────────────────────────────────────────────────────
// Whole toys at one scale: the soft toys and dolls seen from the front, the vehicles in profile
// facing left, the rest as they stand.
// The teddy bear, seated: a round head with its ears, the body behind it and two round feet in front
// (a piece on top: the engine clears the body under them); button eyes and a nose, dots of r 0.5
{
  const H = [12, 8];
  const hr = 5.25;
  const E = [16.6, 4.35];
  const er = 1.85;
  const [p, q] = circX(H, hr, E, er).sort((a, b) => a[1] - b[1]);
  const mir = ([x, y]) => [24 - x, y];
  const head = `M12 ${f(H[1] - hr)}A${hr} ${hr} 0 0 1 ${pt(p)}A${er} ${er} 0 1 1 ${pt(q)}A${hr} ${hr} 0 1 1 ${pt(mir(q))}A${er} ${er} 0 1 1 ${pt(mir(p))}A${hr} ${hr} 0 0 1 12 ${f(H[1] - hr)}Z`;
  const B = [12, 15.75];
  const br = 5.5;
  const [bl, bR] = circX(H, hr, B, br).sort((a, b) => a[0] - b[0]);
  const body = `M${pt(bR)}A${br} ${br} 0 1 1 ${pt(bl)}`;
  const feet = [circ(8, 19.5, 2), circ(16, 19.5, 2)];
  add('teddy-bear', ['osito de peluche', 'peluche', 'juguete', 'teddy bear', 'plush', 'soft toy'], [head, body, dot(10, 7.25, 0.5), dot(14, 7.25, 0.5), dot(12, 10.25, 0.5)], {
    badge: { d: feet, knock: feet.join(''), fill: { solid: feet } },
  });
  FILL['teddy-bear'] = { solid: [0, `${body}Z`], cut: [2, 3, 4] };
  PARTS['teddy-bear'] = { head: [0, 2, 3, 4], body: [1] };
}
// The doll: a rag doll from the front, a big round head with two pigtails and button eyes, a
// triangular dress, arms out and two short legs
{
  const H = [12, 7.25];
  const head = circ(...H, 5);
  const tails = [circ(...polar(...H, 6.6, 160), 1.6), circ(...polar(...H, 6.6, 20), 1.6)];
  const dress = roundpoly([[12, 12.25], [17, 18.75], [7, 18.75]], [0.6, 1, 1]);
  const arm = line([9.4, 15.25], [6.25, 14.25]);
  add('doll', ['muñeca', 'muñeca de trapo', 'juego de roles', 'doll', 'rag doll', 'pretend play'], [head, ...tails, dot(10, 7.5), dot(14, 7.5), dress, arm, flipPath(arm), vl(10.25, 18.75, 21.25), vl(13.75, 18.75, 21.25)]);
  FILL.doll = { solid: [0, 1, 2, 5], cut: [3, 4], wire: [6, 7, 8, 9] };
  PARTS.doll = { head: [0, 1, 2, 3, 4], body: [5, 6, 7, 8, 9] };
}
// The nesting doll: a small round head on a wider body, met at a slight waist, a round face and a
// band across the middle
{
  const [Hc, hr, Bc, brr] = [[12, 7.25], 4.75, [12, 14.5], 6.25];
  const [w] = circX(Hc, hr, Bc, brr);
  const foot = [12 + Math.sqrt(brr * brr - (20.75 - Bc[1]) ** 2), 20.75];
  const doll = profile([[12, Hc[1] - hr], { to: w, arc: [hr, 0, 1] }, { to: foot, arc: [brr, 0, 1] }, [12, 20.75]]);
  add('nesting-doll', ['matrioska', 'muñeca rusa', 'anidado', 'nesting doll', 'matryoshka', 'nested'], [doll, circ(12, 7.5, 2), hl(17, 5.75, 18.25)]);
  FILL['nesting-doll'] = { solid: [0], cut: [1, 2] };
  PARTS['nesting-doll'] = { doll: [0], face: [1], band: [2] };
  MOTION['nesting-doll'] = { effect: 'wiggle', origin: [12, 20.75] };
}
// The dollhouse: the house's front opened, its roof over two floors, two rooms on the lower one
{
  const house = roundpoly([[12, 2.75], [20.75, 10], [20.75, 21.25], [3.25, 21.25], [3.25, 10]], [1, 0.75, 1, 1, 0.75]);
  add('dollhouse', ['casa de muñecas', 'juego de roles', 'casita', 'dollhouse', 'pretend play', 'miniature house'], [house, hl(10, 3.25, 20.75), hl(15.5, 3.25, 20.75), vl(12, 15.5, 21.25)]);
  FILL.dollhouse = { solid: [0], cut: [1, 2, 3] };
  PARTS.dollhouse = { house: [0], floors: [1, 2, 3] };
}
// The rocking horse, in profile facing left: its head, ear and mane, a body and two legs standing on
// the long curved rocker
{
  const horse = roundpoly([[18.75, 9.5], [9.5, 9.5], [8.25, 4.5], [7.25, 2.75], [5.5, 4.25], [2.75, 7.75], [3.75, 9.25], [6.25, 8.75], [6.75, 12.75], [18.75, 12.75]], [1.25, 0.75, 0.75, 0.4, 0.75, 0.75, 0.6, 0.6, 1, 1.25]);
  const rocker = 'M2.75 17.25Q12 22.75 21.25 17.25';
  add('rocking-horse', ['caballito mecedor', 'caballo de madera', 'juguete clásico', 'rocking horse', 'toddler', 'nursery'], [horse, line([8.5, 12.75], [7.25, 19.27]), line([17, 12.75], [18, 18.85]), rocker, 'M18.75 10.25C20.5 10.5 21.25 12 21.25 13.5']);
  FILL['rocking-horse'] = { solid: [0], wire: [1, 2, 3, 4] };
  PARTS['rocking-horse'] = { horse: [0, 1, 2, 4], rocker: [3] };
  MOTION['rocking-horse'] = { effect: 'wiggle', origin: [12, 20] };
}
// The toy car, in profile facing left: a short rounded body on two big wheels (a piece on top) and a
// wind-up key out of its roof
{
  const body = roundpoly([[3, 16.5], [3, 13.25], [7, 12.25], [9, 8.75], [15, 8.75], [17.5, 12.25], [21, 13.25], [21, 16.5]], [1, 1.5, 0.75, 1, 1, 0.75, 1.5, 1]);
  const wheels = [circ(7.5, 16.75, 2.5), circ(16.5, 16.75, 2.5)];
  add('toy-car', ['carrito', 'coche de juguete', 'cuerda', 'toy car', 'wind-up car', 'toy vehicle'], [body, vl(12, 8.75, 4.25), circ(10.5, 4.25, 1.4), circ(13.5, 4.25, 1.4)], {
    badge: { d: wheels, knock: wheels.join(''), fill: { solid: wheels } },
  });
  FILL['toy-car'] = { solid: [0, 2, 3], wire: [1] };
  PARTS['toy-car'] = { body: [0], key: [1, 2, 3] };
  MOTION['toy-car'] = { effect: 'slide', vector: [-1.5, 0] };
}
// The remote-control car: a low buggy in profile facing left, a wedge with its spoiler, on oversized
// wheels (a piece on top), its thin antenna standing straight up from the rear
{
  const body = roundpoly([[2.75, 15], [4.5, 12], [10.25, 11.25], [12.5, 9.25], [16.25, 9.25], [17.5, 11], [21.25, 10.5], [21.25, 15]], [1, 0.75, 0.6, 0.75, 0.6, 0.4, 0.6, 1]);
  const wheels = [circ(7.5, 17, 3.25), circ(16.5, 17, 3.25)];
  add('remote-control-car', ['carro a control remoto', 'rc', 'radiocontrol', 'remote-control car', 'rc car', 'hobby car'], [body, vl(19.25, 10.75, 3.25), dot(19.25, 3.25, 0.6)], {
    badge: { d: wheels, knock: wheels.join(''), fill: { solid: wheels } },
  });
  FILL['remote-control-car'] = { solid: [0, 2], wire: [1] };
  PARTS['remote-control-car'] = { body: [0], antenna: [1, 2] };
  MOTION['remote-control-car'] = { effect: 'slide', vector: [-1.5, 0] };
}
// The toy robot: a square head with its antenna and eyes, a body on two block feet, arms bent down
// to their clamps
{
  const head = sq(6.75, 4.25, 10.5, 6.5, 2);
  const body = profile([[12, 10.75], [17.25, 10.75, 1.25], [17.25, 18.25, 1], [16.5, 18.25, 0], [16.5, 21, 0.6], [13.5, 21, 0.6], [13.5, 18.25, 0], [12, 18.25]]);
  const arm = roundline([[17.25, 13], [20.25, 13], [20.25, 16.25]], [0, 0.75, 0]);
  add('toy-robot', ['robot de juguete', 'robot de cuerda', 'juguete stem', 'toy robot', 'tin robot', 'wind-up robot'], [head, vl(12, 4.25, 2), dot(10, 7.5), dot(14, 7.5), body, arm, flipPath(arm)]);
  FILL['toy-robot'] = { solid: [0, 4], cut: [2, 3], wire: [1, 5, 6] };
  PARTS['toy-robot'] = { head: [0, 1, 2, 3], body: [4], arms: [5, 6] };
  MOTION['toy-robot'] = { effect: 'wiggle', origin: [12, 21] };
}
// The toy train: a short steam engine in profile facing left, its tall funnel, the cab and its
// window, three wheels (a piece on top)
{
  const engine = roundpoly([[2.75, 18], [2.75, 11.25], [5, 11.25], [4.25, 6], [9, 6], [8.25, 11.25], [13, 11.25], [13, 5.5], [21, 5.5], [21, 18]], [1, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.75, 1, 1]);
  const wheels = [circ(5.5, 18.75, 1.75), circ(11.75, 18.75, 1.75), circ(18, 18.75, 1.75)];
  add('toy-train', ['tren de juguete', 'trenecito', 'locomotora', 'toy train', 'wooden train', 'steam engine'], [engine, sq(15.5, 8.5, 3, 3, 0.75)], {
    badge: { d: wheels, knock: wheels.join(''), fill: { solid: wheels } },
  });
  FILL['toy-train'] = { solid: [0], cut: [1] };
  PARTS['toy-train'] = { engine: [0, 1] };
  MOTION['toy-train'] = { effect: 'slide', vector: [-1.5, 0] };
}
// The rubber duck, in profile facing left, floating on a short wave: its round head and flat beak,
// the round body with an upturned tail, an eye
{
  const H = [9, 7];
  const head = circ(...H, 3.75);
  const beak = roundline([polar(9, 7, 3.75, 172), [2.75, 8], [3, 9.5], polar(9, 7, 3.75, 148)], [0, 0.6, 0.6, 0]);
  const a = polar(...H, 3.75, 125);
  const b = polar(...H, 3.75, 25);
  const body = `M${pt(a)}C${pt([4.5, 12.5])} ${pt([5, 17.75])} ${pt([11.5, 17.75])}C${pt([17, 17.75])} ${pt([20.5, 15])} ${pt([20.5, 9.25])}C${pt([18.5, 11.5])} ${pt([15.5, 12])} ${pt(b)}`;
  add('rubber-duck', ['patito de hule', 'juguete de baño', 'depuración', 'rubber duck', 'bath toy', 'rubber duck debugging'], [head, beak, body, dot(9.4, 6.6), 'M3 21C5 20.25 7 21.75 9 21S13 20.25 15 21S19 21.75 21 21']);
  FILL['rubber-duck'] = { solid: [0, `${beak}Z`, `${body}Z`], cut: [3], lines: [4] };
  PARTS['rubber-duck'] = { duck: [0, 1, 2, 3], water: [4] };
  MOTION['rubber-duck'] = { effect: 'float', parts: ['duck'], vector: [0, -1] };
}
// The building brick, from the side: a block with two round studs on top
{
  const brick = profile([[12, 10.25], [13.75, 10.25, 0], [13.75, 7.75, 0.6], [18.25, 7.75, 0.6], [18.25, 10.25, 0], [20.75, 10.25, 1.5], [20.75, 18.75, 1.5], [12, 18.75]]);
  add('toy-brick', ['bloque de construcción', 'ladrillo de juguete', 'construir', 'toy brick', 'building brick', 'construction toy'], [brick]);
  FILL['toy-brick'] = { solid: [0] };
  PARTS['toy-brick'] = { brick: [0] };
}
// Building blocks, from the front: a cube with a triangular block on it, beside a short cylinder
{
  const cube = sq(3, 11.75, 9.5, 9.5, 1.5);
  const tri = roundpoly([[7.75, 4.75], [11.75, 11.75], [3.75, 11.75]], [0.75, 0.5, 0.5]);
  const cyl = `M15.5 14.75A2.875 1.25 0 0 1 21.25 14.75V20A2.875 1.25 0 0 1 15.5 20Z`;
  add('building-blocks', ['bloques', 'cubos de madera', 'aprendizaje', 'building blocks', 'toy blocks', 'early learning'], [cube, tri, cyl, 'M15.5 14.75A2.875 1.25 0 0 0 21.25 14.75']);
  FILL['building-blocks'] = { solid: [0, 1, 2], cut: [3] };
  PARTS['building-blocks'] = { cube: [0], triangle: [1], cylinder: [2, 3] };
}
// Marbles: three of the same size in a loose cluster, each with its swirl from edge to edge
{
  const r = 3.5;
  const C = [[7.1, 16.25], [16.9, 16.25], [12, 7.75]];
  const swirl = (c, a) => {
    const p1 = polar(...c, r, a + 180);
    const p2 = polar(...c, r, a);
    const k1 = add2(c, rot([-0.5, -2.75], [0, 0], a));
    const k2 = add2(c, rot([0.5, 2.75], [0, 0], a));
    return `M${pt(p1)}C${pt(k1)} ${pt(k2)} ${pt(p2)}`;
  };
  add('marbles', ['canicas', 'canica', 'coleccionar', 'marbles', 'marble', 'glass toys'], [...C.map((c) => circ(...c, r)), swirl(C[0], 20), swirl(C[1], -35), swirl(C[2], 70)]);
  FILL.marbles = { solid: [0, 1, 2], cut: [3, 4, 5] };
  PARTS.marbles = { marbles: [0, 1, 2], swirls: [3, 4, 5] };
}
// The kite: a diamond with its two crossing spars, a wavy tail with two bows tied across it
{
  const kite = roundpoly([[13, 2.5], [18.75, 7.5], [13, 14.25], [7.25, 7.5]], 0.75);
  const tail = 'M13 14.25C11 15.75 13 17.5 11 19L5.5 21';
  add('kite', ['papalote', 'cometa', 'viento', 'kite', 'flying a kite', 'wind'], [kite, vl(13, 2.5, 14.25), hl(7.5, 7.25, 18.75), tail, hl(18.07, 10.5, 13.06), line([7.33, 19.08], [8.17, 21.42])]);
  FILL.kite = { solid: [0], cut: [1, 2], wire: [3, 4, 5] };
  PARTS.kite = { kite: [0, 1, 2], tail: [3, 4, 5] };
  MOTION.kite = { effect: 'float', vector: [0.75, -1.25] };
}
// The yo-yo: its disc and inner ring, hanging on a string from a finger loop
{
  add('yo-yo', ['yoyo', 'trucos', 'juguete clásico', 'yo-yo', 'yoyo', 'tricks'], [circ(12, 15, 5.75), circ(12, 15, 2.5), vl(12, 5.5, 12.5), circ(12, 4, 1.5)]);
  FILL['yo-yo'] = { solid: [0, 3], cut: [1], wire: [vl(12, 5.5, 9.25)] };
  PARTS['yo-yo'] = { yoyo: [0, 1], string: [2, 3] };
  MOTION['yo-yo'] = { effect: 'bounce', parts: ['yoyo'], vector: [0, 1.5] };
}
// Cup and ball: a short stick, its cup at the top, the ball on a string hanging beside it
{
  const cup = 'M5.25 6.75H12.75A3.75 3.75 0 0 1 5.25 6.75Z';
  add('cup-and-ball', ['balero', 'kendama', 'juguete tradicional', 'cup and ball', 'kendama', 'catch the ball'], [cup, vl(9, 10.5, 21), 'M9 13.75C12 13.75 15.5 11 17.25 12.75', circ(17.25, 15.25, 2.5)]);
  FILL['cup-and-ball'] = { solid: [0, 3], wire: [1, 2] };
  PARTS['cup-and-ball'] = { cup: [0, 1], string: [2], ball: [3] };
  MOTION['cup-and-ball'] = { effect: 'ring', parts: ['string', 'ball'], origin: [9, 13.75] };
}
// The spinning top, in profile on its point: a short handle, the wide rounded body, a curved stroke
// of motion at each side
{
  const top = profile([[12, 6.75], [14.5, 6.75, 1.5], [17.25, 9, 2], { to: [12, 20.75], c: [[17.25, 13.5], [13.5, 17]] }]);
  const swoosh = 'M3.25 9.75C3 12.5 4 15 6.25 16.75';
  add('spinning-top', ['trompo', 'perinola', 'girar', 'spinning top', 'top', 'spin'], [top, vl(12, 2.75, 6.75), swoosh, flipPath(swoosh)]);
  FILL['spinning-top'] = { solid: [0], wire: [1], lines: [2, 3] };
  PARTS['spinning-top'] = { top: [0, 1], motion: [2, 3] };
  MOTION['spinning-top'] = { effect: 'wiggle', parts: ['top'], origin: [12, 20.75] };
}
// The pinwheel: four curled blades round a pin (drawn once and turned), on its stick (the blades are
// a piece on top that clears the stick behind them)
{
  const C = [12, 9.25];
  const blade = `M${pt(C)}L${pt(polar(...C, 6.25, -90))}Q${pt(polar(...C, 6.5, -35))} ${pt(polar(...C, 2.5, 0))}Z`;
  const blades = [0, 90, 180, 270].map((d) => turnPath(blade, d, C));
  add('pinwheel', ['rehilete', 'molinete', 'viento', 'pinwheel', 'wind toy', 'outdoor toy'], [vl(12, 9.25, 21.25)], {
    badge: { d: [...blades, dot(...C, 0.6)], knock: blades.join(''), fill: { solid: blades, cut: [dot(...C, 0.6)] } },
  });
  FILL.pinwheel = false;
  PARTS.pinwheel = { stick: [0] };
  MOTION.pinwheel = { effect: 'spin', parts: ['badge'], origin: C };
}

// The fidget spinner: three round lobes round the central bearing, joined by hollow curves, each lobe
// holding a smaller ring
{
  const C = [12, 12];
  const [D, R, F] = [5.5, 4, 2.5];
  const lobes = [-90, 30, 150].map((a) => polar(...C, D, a));
  // The fillet between two lobes: a circle tangent to both, outside, on their bisector
  const fil = (a) => {
    const d = D * Math.cos((60 * Math.PI) / 180) + Math.sqrt((R + F) ** 2 - (D * Math.sin((60 * Math.PI) / 180)) ** 2);
    return polar(...C, d, a);
  };
  const fils = [-30, 90, 210].map(fil);
  const touch = (L, Fc) => add2(L, mul(unit(sub(Fc, L)), R));
  let path = '';
  for (let i = 0; i < 3; i++) {
    const L = lobes[i];
    const f0 = fils[(i + 2) % 3];
    const f1 = fils[i];
    const s0 = touch(L, f0);
    const s1 = touch(L, f1);
    const n = lobes[(i + 1) % 3];
    const e1 = touch(n, f1);
    path += `${i === 0 ? `M${pt(s0)}` : ''}A${R} ${R} 0 1 1 ${pt(s1)}A${F} ${F} 0 0 0 ${pt(e1)}`;
  }
  add('fidget-spinner', ['spinner', 'juguete antiestrés', 'concentración', 'fidget spinner', 'fidget toy', 'stress relief'], [`${path}Z`, circ(...C, 1.6), ...lobes.map((c) => circ(...c, 1.25))]);
  FILL['fidget-spinner'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['fidget-spinner'] = { spinner: [0, 1, 2, 3, 4] };
  MOTION['fidget-spinner'] = { effect: 'spin', origin: C };
}
// The spring toy: a coil arched over like a rainbow from a higher step to a lower one, drawn as a band
// with the turns of its coil across it
{
  const steps = roundline([[2.5, 14.25], [8.75, 14.25], [8.75, 20.25], [21.5, 20.25]], [0, 0.75, 0.75, 0]);
  const O = [[3.5, 14.25], [3.25, 1.75], [19.75, 3.5], [19.25, 20.25]];
  const I = [[6.75, 14.25], [6.75, 5.75], [16.25, 7], [16, 20.25]];
  const cub = (P) => `M${pt(P[0])}C${pt(P[1])} ${pt(P[2])} ${pt(P[3])}`;
  const at = (P, t) => [0, 1].map((k) => (1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k]);
  const ribs = [0.15, 0.29, 0.43, 0.57, 0.71, 0.85].map((t) => line(at(O, t), at(I, t)));
  add('spring-toy', ['resorte', 'resorte de juguete', 'juguete de escritorio', 'spring toy', 'coil toy', 'desk toy'], [steps, cub(O), cub(I), ...ribs]);
  FILL['spring-toy'] = false;
  PARTS['spring-toy'] = { steps: [0], spring: [1, 2, 3, 4, 5, 6, 7, 8] };
}
// Soap bubbles: the wand's round loop at the top of its stick, two bubbles of different sizes
// floating up to the right
{
  const loop = [7.5, 10.5];
  add('bubble-wand', ['burbujas', 'pompas de jabón', 'jugar afuera', 'bubble wand', 'soap bubbles', 'bubbles'], [circ(...loop, 3.25), line(polar(...loop, 3.25, 115), [4, 21]), circ(16, 11.75, 2.75), circ(18.5, 4.75, 1.75)]);
  FILL['bubble-wand'] = { solid: [0], wire: [1], lines: [2, 3] };
  PARTS['bubble-wand'] = { wand: [0, 1], bubbles: [2, 3] };
  MOTION['bubble-wand'] = { effect: 'float', parts: ['bubbles'], vector: [0.75, -1.5] };
}
// The jack-in-the-box: the box from the front, its two flaps swung open, a spring rising from it to a
// round head (one lid raised at the side read as a laptop, a crank as a mug's handle)
{
  const spring = line([12, 12.75], [14.5, 11.5], [9.5, 9.75], [12, 8.5]);
  const flap = line([5.25, 12.75], [2.75, 8.75]);
  const box = roundpoly([[5.25, 12.75], [18.75, 12.75], [18.75, 21.25], [5.25, 21.25]], [0, 0, 0, 1.5]);
  add('jack-in-the-box', ['caja sorpresa', 'sorpresa', 'juguete', 'jack-in-the-box', 'surprise', 'surprise toy'], [box, flap, flipPath(flap), spring, circ(12, 5.5, 2.75)]);
  FILL['jack-in-the-box'] = { solid: [0, 4], wire: [1, 2, 3] };
  PARTS['jack-in-the-box'] = { box: [0, 1, 2], spring: [3], head: [4] };
  MOTION['jack-in-the-box'] = { effect: 'bounce', parts: ['spring', 'head'], vector: [0, -1.5] };
}
// The ring stacker: three rings of decreasing width stacked on their base, a ball on top
{
  const rings = [capsule(5.5, 15.25, 13, 3.5), capsule(7, 11.75, 10, 3.5), capsule(8.5, 8.25, 7, 3.5)];
  add('stacking-rings', ['torre de aros', 'apilar', 'juguete de bebé', 'ring stacker', 'stacking toy', 'toddler toy'], [hl(18.75, 3.75, 20.25), ...rings, circ(12, 6.5, 1.75)]);
  FILL['stacking-rings'] = { solid: [1, 2, 3, 4], wire: [0] };
  PARTS['stacking-rings'] = { base: [0], rings: [1, 2, 3], ball: [4] };
}
// The shape sorter: a block from the front, its face cut with a circle, a square below it and a triangle
// beside that (two holes over one read as a face)
{
  add('shape-sorter', ['encaja figuras', 'figuras', 'aprendizaje', 'shape sorter', 'matching shapes', 'toddler toy'], [sq(3.25, 3.25, 17.5, 17.5, 3), circ(8.75, 8.5, 2.25), roundpoly([[15.5, 12.75], [17.75, 17.25], [13.25, 17.25]], 0.5), sq(6.75, 13.75, 4, 4, 0.75)]);
  FILL['shape-sorter'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['shape-sorter'] = { block: [0], holes: [1, 2, 3] };
}
// The boomerang: a wide rounded V tilted on its side, its two even arms 3.5 wide round at the ends (a
// return arrow round its tip left the live area or crowded the elbow; the spin says it returns)
{
  const E = [8.25, 9.75];
  const A = [19.75, 13.5];
  const B = [11.75, 19.75];
  const w = 1.75;
  const u1 = unit(sub(A, E));
  const u2 = unit(sub(B, E));
  const n1 = [u1[1], -u1[0]];
  const n2 = [-u2[1], u2[0]];
  // The outer and inner edges meet where their offsets cross
  const meet = (p, d1, q, d2) => {
    const det = d1[0] * -d2[1] - d1[1] * -d2[0];
    const t = ((q[0] - p[0]) * -d2[1] - (q[1] - p[1]) * -d2[0]) / det;
    return add2(p, mul(d1, t));
  };
  const outer = meet(add2(E, mul(n1, w)), u1, add2(E, mul(n2, w)), u2);
  const inner = meet(add2(E, mul(n1, -w)), u1, add2(E, mul(n2, -w)), u2);
  const fo = fillet(add2(A, mul(n1, w)), outer, add2(B, mul(n2, w)), 2.5);
  const fi = fillet(add2(A, mul(n1, -w)), inner, add2(B, mul(n2, -w)), 1.25);
  const boom = `M${pt(fo.E)}L${pt(add2(B, mul(n2, w)))}A${w} ${w} 0 0 ${fo.sweep} ${pt(add2(B, mul(n2, -w)))}L${pt(fi.E)}A1.25 1.25 0 0 ${1 - fo.sweep} ${pt(fi.S)}L${pt(add2(A, mul(n1, -w)))}A${w} ${w} 0 0 ${fo.sweep} ${pt(add2(A, mul(n1, w)))}L${pt(fo.S)}A2.5 2.5 0 0 ${fo.sweep} ${pt(fo.E)}Z`;
  add('boomerang', ['bumerán', 'lanzar', 'regresa', 'boomerang', 'throwing toy', 'come back'], [boom]);
  FILL.boomerang = { solid: [0] };
  PARTS.boomerang = { boomerang: [0] };
  MOTION.boomerang = { effect: 'spin', parts: ['boomerang'], origin: [11, 13] };
}
// The toy spade, its handle and its blade up: in the pail and in the sandbox
const SPADE_TOY = [line([13.75, 10.5], [17.25, 6.5]), roundpoly([[17.25, 2.5], [21.25, 4.75], [19.75, 8.25], [16, 7.25]], [1.25, 0.75, 0.6, 1.25])];
// The sand pail: a small tapered pail, its looped handle folded down across its front, and a toy
// spade standing in it, its blade up
{
  const pail = roundpoly([[4.5, 10.5], [17, 10.5], [15.5, 21], [6, 21]], [0.75, 0.75, 1.25, 1.25]);
  const handle = 'M4.86 13A5.89 4.25 0 0 0 16.64 13';
  add('sand-pail', ['cubeta de arena', 'pala', 'playa', 'sand pail', 'beach toys', 'sandbox toys'], [pail, handle, ...SPADE_TOY]);
  FILL['sand-pail'] = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS['sand-pail'] = { pail: [0, 1], spade: [2, 3] };
}
// The bounce house: an inflatable castle, two puffy towers round at the top, the puffy wall between
// them and an arched entry
{
  const house = profile([[12, 9.25], { to: [13.75, 9.25], arc: [0.9, 0, 1] }, { to: [15.5, 9.25], arc: [0.9, 0, 1] }, [15.5, 5.75, 0], { to: [20.75, 5.75], arc: [2.625, 0, 1] }, [20.75, 21, 1.25], [12, 21]]);
  add('bounce-house', ['brincolín', 'castillo inflable', 'fiesta infantil', 'bounce house', 'bouncy castle', 'inflatable'], [house, 'M9.25 21V17.25A2.75 2.75 0 0 1 14.75 17.25V21', vl(8.5, 9.25, 12.25), vl(15.5, 9.25, 12.25)]);
  FILL['bounce-house'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['bounce-house'] = { castle: [0, 2, 3], entry: [1] };
  MOTION['bounce-house'] = { effect: 'bounce', vector: [0, -1.5] };
}
// The sandbox: its low frame from the front, a mound of sand over it and the sand pail's toy spade
// stuck in it, its blade up (a T-handle in the mound read as a plunger)
{
  add('sandbox', ['arenero', 'caja de arena', 'parque infantil', 'sandbox', 'sandpit', 'play area'], [sq(2.75, 14.25, 18.5, 6.75, 1.5), 'M5 14.25C7.5 9.25 15.5 9.25 18.5 14.25', SPADE_TOY[0], SPADE_TOY[1]]);
  FILL.sandbox = { solid: [0, 'M5 14.25C7.5 9.25 15.5 9.25 18.5 14.25Z', 3], wire: [2] };
  PARTS.sandbox = { frame: [0], sand: [1], spade: [2, 3] };
}
// The ball pit: an open box from the front with a heap of balls rising over its rim, six in three rows
// (five in two rows read as a face); the box is a piece on top that clears the balls behind it
{
  const box = sq(3.25, 15, 17.5, 6, 2.5, BR);
  const balls = [[6.6, 12.75], [12, 12.75], [17.4, 12.75], [9.3, 8.07], [14.7, 8.07], [12, 3.39]].map((c) => circ(...c, 1.4));
  add('ball-pit', ['alberca de pelotas', 'piscina de pelotas', 'área de juegos', 'ball pit', 'play center', 'toddler play'], balls, {
    badge: { d: [box], knock: box, fill: { solid: [box] } },
  });
  FILL['ball-pit'] = { solid: [0, 1, 2, 3, 4, 5] };
  PARTS['ball-pit'] = { balls: [0, 1, 2, 3, 4, 5] };
}
// The tire swing: a tire hanging from a branch, three ropes meeting at a knot above it (one up to the
// branch, two down to the tire)
{
  const T = [12, 15.25];
  const R = 5.25;
  const knot = [12, 6.25];
  const ropes = [line(knot, polar(...T, R, -150)), vl(12, 3.5, knot[1]), line(knot, polar(...T, R, -30))];
  add('tire-swing', ['columpio de llanta', 'llanta', 'jardín', 'tire swing', 'swing', 'backyard play'], ['M2.5 3.5C8 2.75 16 4.25 21.5 3.25', ...ropes, circ(...T, R), circ(...T, 2.5)]);
  FILL['tire-swing'] = { solid: [4], cut: [5], wire: [0, 1, 2, 3] };
  PARTS['tire-swing'] = { branch: [0], ropes: [1, 2, 3], tire: [4, 5] };
  MOTION['tire-swing'] = { effect: 'ring', parts: ['ropes', 'tire'], origin: [12, 3.5] };
}
// Hopscotch: a column of squares 3.75 wide, single and paired by turns, up to a half circle
{
  const s = 3.75;
  const [a, b, c, d] = [12 - s / 2, 12 + s / 2, 12 - s, 12 + s];
  const ys = [21, 17.25, 13.5, 9.75, 6];
  const outline = roundpoly([[a, 21], [a, ys[1]], [c, ys[1]], [c, ys[2]], [a, ys[2]], [a, ys[3]], [c, ys[3]], [c, ys[4]], [d, ys[4]], [d, ys[3]], [b, ys[3]], [b, ys[2]], [d, ys[2]], [d, ys[1]], [b, ys[1]], [b, 21]], [0.75, 0, 0.6, 0.6, 0, 0, 0.6, 0, 0, 0.6, 0, 0, 0.6, 0.6, 0, 0.75]);
  const top = `M${pt([c, ys[4]])}A${s} ${s} 0 0 1 ${pt([d, ys[4]])}`;
  add('hopscotch', ['avioncito', 'rayuela', 'juego de patio', 'hopscotch', 'playground game', 'chalk game'], [outline, top, hl(ys[1], a, b), hl(ys[2], a, b), hl(ys[3], a, b), vl(12, ys[1], ys[2]), vl(12, ys[3], ys[4])]);
  FILL.hopscotch = false;
  PARTS.hopscotch = { court: [0, 1, 2, 3, 4, 5, 6] };
}
// The trampoline: a shallow ellipse of a mat on four short legs, a ball above it on its bounce
{
  const mat = ell([12, 13.25], 8.75, 2.5);
  add('trampoline', ['trampolín', 'brincar', 'parque de trampolines', 'trampoline', 'bounce', 'backyard play'], [mat, vl(4.75, 14.6, 19.75), vl(9, 15.65, 20.75), vl(15, 15.65, 20.75), vl(19.25, 14.6, 19.75), circ(16.25, 4.5, 1.75), 'M6.25 7.75C7 5.75 9 4.5 11.6 4.4']);
  FILL.trampoline = { solid: [0, 5], wire: [1, 2, 3, 4], lines: [6] };
  PARTS.trampoline = { trampoline: [0, 1, 2, 3, 4], ball: [5], bounce: [6] };
  MOTION.trampoline = { effect: 'bounce', parts: ['ball'], vector: [0, -1.5] };
}
// Ring toss: a peg standing on its round base with a ring on it, a second ring in midair tilting
// toward it
{
  const ring2 = turnPath(ell([16.75, 6.25], 3.25, 1.25), -25, [16.75, 6.25]);
  add('ring-toss', ['lanzar aros', 'juego de feria', 'puntería', 'ring toss', 'fair game', 'party game'], [ell([9.5, 19.5], 6, 1.75), vl(9.5, 6.5, 19.5), ell([9.5, 14.5], 3.5, 1.25), ring2]);
  FILL['ring-toss'] = { solid: [0, 2, 3], wire: [1] };
  PARTS['ring-toss'] = { base: [0], peg: [1], rings: [2, 3] };
  MOTION['ring-toss'] = { effect: 'float', parts: [3], vector: [-1, 1] };
}

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these still turned to mush. Their own drawings
// run through pixel centers (0.75 + 1.5k) and keep a pixel of paper between pieces; 2 × 2 pixel
// dots sit on pixel corners (1.5k).
const PX = (k) => 0.75 + 1.5 * k;
const CX = (k) => 1.5 * k;
const SMALL = {};
// Two dice: both upright, the front one 8 pixels with two pips, the back one showing its top pip
{
  const back = sq(PX(1), PX(1), 12, 12, 2);
  const front = sq(PX(6), PX(6), 12, 12, 2);
  const pips = [dot(CX(9), CX(9), 0.8), dot(CX(12), CX(12), 0.8)];
  SMALL['dice-pair'] = { d: [back, dot(CX(4), CX(4), 0.8)], fill: { solid: [back], cut: [dot(CX(4), CX(4), 0.8)] }, badge: { d: [front, ...pips], knock: front, fill: { solid: [front], cut: pips } } };
}
// The spinner: the disc in its quarters and the arrow in the top left quarter, from the pin to a
// one-pixel head, a pixel clear of the quarter lines
{
  const c = PX(7);
  const disc = circ(c, c, 7.5);
  const marks = [vl(c, PX(2), PX(12)), hl(c, PX(2), PX(12)), line([c, c], [PX(4), PX(4)]), line([PX(4), PX(5)], [PX(4), PX(4)], [PX(5), PX(4)])];
  SMALL['game-spinner'] = { d: [disc, ...marks], fill: { solid: [disc], cut: marks } };
}
// Tic-tac-toe: the hash on pixel columns 5 and 10, a 3-pixel X and O in opposite corner cells
SMALL['tic-tac-toe'] = { d: [vl(PX(5), PX(1), PX(14)), vl(PX(10), PX(1), PX(14)), hl(PX(5), PX(1), PX(14)), hl(PX(10), PX(1), PX(14)), line([PX(1), PX(1)], [PX(3), PX(3)]), line([PX(3), PX(1)], [PX(1), PX(3)]), circ(PX(13), PX(13), 1.5)] };
// Darts: the board's rim and one ring, the dart's shaft across them to the middle
{
  const c = PX(7);
  SMALL.dartboard = { d: [circ(c, c, 7.5), circ(c, c, 3), line([c, c], [PX(13), PX(1)])], fill: { solid: [circ(c, c, 7.5)], cut: [circ(c, c, 3), line([c, c], [PX(11), PX(3)])], wire: [line([PX(11), PX(3)], [PX(13), PX(1)])] } };
}
// The card's spade on pixels: a four-pixel point, its stem two pixels wide and a foot
const SPADE16 = (top) => [roundpoly([[12, top], [PX(9), top + 4.5], [PX(9), top + 6], [PX(6), top + 6], [PX(6), top + 4.5]], [0.3, 0.4, 0.3, 0.3, 0.4]), hl(top + 9, PX(6), PX(9)), vl(12, top + 6, top + 9)];
{
  const card = sq(PX(3), PX(1), 13.5, 19.5, 2.25, BR);
  const sp = SPADE16(PX(4));
  SMALL['playing-card'] = { d: [card, ...sp], fill: { solid: [card], cut: sp } };
  const front = sq(PX(4), PX(2), 10.5, 18, 1.5, BR);
  const sp2 = SPADE16(PX(5));
  SMALL['playing-card-fan'] = {
    d: [line([PX(2), PX(3)], [PX(1), PX(4)], [PX(1), PX(11)]), line([PX(13), PX(3)], [PX(14), PX(4)], [PX(14), PX(11)])],
    fill: { solid: [`${line([PX(2), PX(3)], [PX(1), PX(4)], [PX(1), PX(11)])}Z`, `${line([PX(13), PX(3)], [PX(14), PX(4)], [PX(14), PX(11)])}Z`] },
    badge: { d: [front, ...sp2], knock: front, fill: { solid: [front], cut: sp2 } },
  };
}
// The poker chip: the rim and the inner ring, four spots bridging them
{
  const spots = [dot(12, CX(4), 0.8), dot(12, CX(12), 0.8), dot(CX(4), 12, 0.8), dot(CX(12), 12, 0.8)];
  SMALL['poker-chip'] = { d: [circ(12, 12, 8.25), circ(12, 12, 3.75), ...spots], fill: { solid: [circ(12, 12, 8.25)], cut: [circ(12, 12, 3.75), ...spots] } };
}
// The achievement: a round medallion with its inner ring, two ribbons straight down
{
  const medal = circ(PX(7), PX(5), 4.5);
  const ribbons = [vl(PX(5), PX(9), PX(13)), vl(PX(9), PX(9), PX(13))];
  SMALL.achievement = { d: [medal, circ(PX(7), PX(5), 1.5), ...ribbons], fill: { solid: [medal], cut: [circ(PX(7), PX(5), 1.5)], lines: ribbons } };
  SMALL['achievement-lock'] = { ...SMALL.achievement, badge: badge('lock', { size: 16 }) };
}
// The skill tree: five 3-pixel rings, one at the bottom branching up into two at 45° and each of
// those into one above it
{
  const N = [[PX(7), PX(12)], [PX(3), PX(8)], [PX(11), PX(8)], [PX(3), PX(3)], [PX(11), PX(3)]];
  const nodes = N.map((c) => circ(...c, 1.5));
  const links = [line([PX(6), PX(11)], [PX(4), PX(9)]), line([PX(8), PX(11)], [PX(10), PX(9)]), vl(PX(3), PX(4), PX(7)), vl(PX(11), PX(4), PX(7))];
  SMALL['skill-tree'] = { d: [...nodes, ...links], fill: { solid: nodes, wire: links } };
}
// The power-up: the block, a pixel bolt in it and three short rays
{
  const block = sq(PX(2), PX(4), 16.5, 15, 2);
  const bolt = line([PX(8), PX(6)], [PX(6), PX(9)], [PX(9), PX(9)], [PX(7), PX(12)]);
  const rays = [vl(PX(7), PX(1), PX(2)), line([PX(3), PX(1)], [PX(4), PX(2)]), line([PX(11), PX(1)], [PX(10), PX(2)])];
  SMALL['power-up'] = { d: [block, bolt, ...rays], fill: { solid: [block], cut: [bolt], lines: rays } };
}
// The treasure map: the folded map and its X, no trail
{
  const MAP = snapper([lugares.icons.map.d[0]])(lugares.icons.map.d[0]);
  const x = [line([PX(9), PX(5)], [PX(11), PX(7)]), line([PX(11), PX(5)], [PX(9), PX(7)])];
  SMALL['treasure-map'] = { d: [MAP, ...x], fill: { solid: [MAP], cut: x } };
}
// The coin toss: the coin flat in midair, the arrow over it
{
  const coin = ell([PX(7), PX(11)], 4.5, 1.5);
  const a = arc(PX(7), PX(11), 6, 200, 335);
  SMALL['coin-flip'] = { d: [coin, a.d, head(a.end, a.tangent, 2.5)], fill: { solid: [coin], lines: [a.d, head(a.end, a.tangent, 2.5)] } };
}
// The minimap: the frame and the player only
{
  const frame = sq(PX(1), PX(1), 19.5, 19.5, 3, BR);
  const player = roundpoly([[12, PX(4)], [PX(10), PX(10)], [12, PX(8)], [PX(5), PX(10)]], 0.3);
  SMALL.minimap = { d: [frame, player], fill: { solid: [frame], cut: [player] } };
}
// The monster: its round body, two horns, two 2 × 2 eyes and a zigzag of teeth a pixel under them
{
  const c = [PX(7), PX(8)];
  const body = circ(...c, 6);
  const horns = [line([PX(5), PX(4)], [PX(3), PX(2)]), line([PX(9), PX(4)], [PX(11), PX(2)])];
  const face = [dot(CX(6), CX(7), 0.8), dot(CX(9), CX(7), 0.8), line([PX(5), PX(9)], [PX(6), PX(10)], [PX(7), PX(9)], [PX(8), PX(10)], [PX(9), PX(9)])];
  SMALL.monster = { d: [body, ...horns, ...face], fill: { solid: [body], wire: horns, cut: face } };
}
// The doll: the head with its two pigtails, the dress and two legs
{
  const head = circ(PX(7), PX(4), 3);
  const tails = [circ(PX(3), PX(4), 0.1), circ(PX(11), PX(4), 0.1)];
  const dress = roundpoly([[PX(7), PX(7)], [PX(11), PX(12)], [PX(3), PX(12)]], [0.3, 0.4, 0.4]);
  const legs = [vl(PX(5), PX(13), PX(14)), vl(PX(9), PX(13), PX(14))];
  SMALL.doll = { d: [head, ...tails, dress, ...legs], fill: { solid: [head, ...tails, dress], wire: legs } };
}
// Marbles: three rings of 5 pixels, each with a stripe across
{
  const C = [[PX(4), PX(10)], [PX(10), PX(10)], [PX(7), PX(4)]];
  const rings = C.map((c) => circ(...c, 3));
  const stripes = C.map(([x, y]) => line([x - 1.5, y + 1.5], [x + 1.5, y - 1.5]));
  SMALL.marbles = { d: [...rings, ...stripes], fill: { solid: rings, cut: stripes } };
}
// The kite: the diamond and its spars, the tail a zigzag of pixels
{
  const kite = roundpoly([[PX(7), PX(1)], [PX(11), PX(5)], [PX(7), PX(10)], [PX(3), PX(5)]], 0.4);
  const tail = line([PX(7), PX(10)], [PX(6), PX(11)], [PX(7), PX(12)], [PX(6), PX(13)], [PX(5), PX(14)]);
  SMALL.kite = { d: [kite, vl(PX(7), PX(1), PX(10)), hl(PX(5), PX(3), PX(11)), tail], fill: { solid: [kite], cut: [vl(PX(7), PX(1), PX(10)), hl(PX(5), PX(3), PX(11))], wire: [tail] } };
}
// The pinwheel: four triangular blades round the pin on 45° pixel edges, the stick below them
{
  const c = [PX(7), PX(6)];
  const blade = `M${pt(c)}L${pt([c[0], c[1] - 6])}L${pt([c[0] + 3, c[1] - 3])}Z`;
  const blades = [0, 90, 180, 270].map((d) => turnPath(blade, d, c));
  SMALL.pinwheel = { d: [vl(PX(7), PX(11), PX(14)), ...blades], fill: { solid: blades, wire: [vl(PX(7), PX(11), PX(14))] } };
}
// The ball pit: the box and a pyramid of six 2 × 2 balls on its rim
{
  const box = sq(PX(1), PX(9), 19.5, 7.5, 2, BR);
  const balls = [[6, 12], [12, 12], [18, 12], [9, 7.5], [15, 7.5], [12, 3]].map((c) => dot(...c, 0.8));
  SMALL['ball-pit'] = { d: [box, ...balls], fill: { solid: [box, ...balls] } };
}
for (const [name, sm] of Object.entries(SMALL)) icons[name].small = sm;

// ── Fill, parts and motion, in blocks ────────────────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (!spec) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// Already enclosed: the dice faces, the ability tile, the minimap, the item block and
// the shape sorter are squares; the dartboard, the poker chip and the spinner are circles
for (const name of ['dice-1', 'dice-2', 'dice-3', 'dice-4', 'dice-5', 'dice-6', 'cooldown', 'minimap', 'power-up', 'shape-sorter']) icons[name].variants = { ...icons[name].variants, square: false };
for (const name of ['dartboard', 'poker-chip', 'game-spinner']) icons[name].variants = { ...icons[name].variants, circle: false };

// ── Mirror ────────────────────────────────────────────────────────────────────────────────────
// Directional: the vehicles seen from the side travel one way, as the set's (vehicles' car-side,
// transito's locomotive), and the bars that grow from the left (health, the leaderboard) flip in
// right-to-left languages. What faces a side without going anywhere stays, as mascotas' dog and cat:
// the knight, the rocking horse, the duck; so do symmetrical pieces and fronts
for (const name of ['toy-car', 'remote-control-car', 'toy-train', 'health-bar', 'leaderboard'])
  icons[name].mirror = true;

export default { category: 'juegos', label: 'Juegos y juguetes', icons };
