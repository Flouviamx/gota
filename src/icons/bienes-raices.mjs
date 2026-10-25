// Real estate: property types, listings, keys and viewings, agents and tenants, leases and rent,
// moving, and amenities. Everything is computed with the engine (engine/geometry.mjs) and the rules
// in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a square bottom-right corner on
// containers. Every home is lugares' `house` (the gabled roof with eaves, the walls with the square
// bottom-right corner, the door and the round gable window) or built with its construction (its
// roof pitch, its eaves, its door); towers are lugares' `office-building`, keys are the core `key`,
// people the core `person`. Badges are the engine's; a custom piece on top of another (a front
// house, a fence, coins, a seal) goes in `badge` and the engine clears what it covers.
import { arc, badge, circ, dot, f, flipPath, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import formas from './formas.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

// ── Local utilities ───────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (v, k) => [v[0] * k, v[1] * k];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => mul(v, 1 / len(v));
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };
/** The badges' center (DESIGN.md › Badges): pivots for the badge motions. */
const BC = [17.25, 17.25];
/** The status badges' circle: a glyph at the corner clears it too, so the house is cut the same under any badge (as the engine's glyphs). */
const RING = circ(...BC, 4.25);

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all), as lugares'. */
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
    const S = add(V, mul(u, t));
    const E = add(V, mul(v, t));
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** A path scaled by `s` around `o` and moved by (dx, dy). */
const xf = (d, s, o = [12, 12], dx = 0, dy = 0) => transform(d, s, o[0] * (1 - s) + dx, o[1] * (1 - s) + dy);

// ── Measuring and dashing a path (as formas' dashed shapes: a dashed outline is the outline, broken) ──
function pieces(d) {
  const out = [];
  let p = [0, 0];
  let start = p;
  for (const [, c, args] of transform(d, 1, 0, 0).matchAll(/([MLHVCAZ])([^MLHVCAZ]*)/g)) {
    const a = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    if (c === 'M') {
      p = start = [a[0], a[1]];
      continue;
    }
    let seg;
    if (c === 'C') seg = cubicPiece(p, [a[0], a[1]], [a[2], a[3]], [a[4], a[5]]);
    else if (c === 'A') seg = arcPiece(p, a);
    else seg = linePiece(p, c === 'H' ? [a[0], p[1]] : c === 'V' ? [p[0], a[0]] : c === 'Z' ? start : [a[0], a[1]]);
    if (seg.len > 1e-6) out.push(seg);
    p = seg.end;
  }
  let s = 0;
  for (const q of out) {
    q.s = s;
    s += q.len;
  }
  out.total = s;
  return out;
}
function linePiece(a, b) {
  return { len: len(sub(b, a)), end: b, at: (t) => lerp(a, b, t), t: (s, L) => s / L, cmd: (t0, t1) => `L${pt(lerp(a, b, t1))}` };
}
function cubicPiece(P0, P1, P2, P3) {
  const at = (t) => [0, 1].map((k) => (1 - t) ** 3 * P0[k] + 3 * t * (1 - t) ** 2 * P1[k] + 3 * t * t * (1 - t) * P2[k] + t ** 3 * P3[k]);
  const M = 200;
  const acc = [0];
  for (let i = 1; i <= M; i++) acc.push(acc[i - 1] + len(sub(at(i / M), at((i - 1) / M))));
  const split = (P, t) => {
    const m = (a, b) => lerp(a, b, t);
    const [a, b, c] = [m(P[0], P[1]), m(P[1], P[2]), m(P[2], P[3])];
    const [d, e] = [m(a, b), m(b, c)];
    const g = m(d, e);
    return [
      [P[0], a, d, g],
      [g, e, c, P[3]],
    ];
  };
  return {
    len: acc[M],
    end: P3,
    at,
    t: (s) => {
      let i = 1;
      while (i < M && acc[i] < s) i++;
      return (i - 1 + (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / M;
    },
    cmd: (t0, t1) => {
      const left = split([P0, P1, P2, P3], t1)[0];
      const q = t1 > 0 ? split(left, t0 / t1)[1] : left;
      return `C${pt(q[1])} ${pt(q[2])} ${pt(q[3])}`;
    },
  };
}
function arcPiece(from, [rx0, ry0, , large, sweep, x2, y2]) {
  const [x1, y1] = from;
  const [hx, hy] = [(x1 - x2) / 2, (y1 - y2) / 2];
  let [rx, ry] = [rx0, ry0];
  const lam = (hx * hx) / (rx * rx) + (hy * hy) / (ry * ry);
  if (lam > 1) [rx, ry] = [rx * Math.sqrt(lam), ry * Math.sqrt(lam)];
  const num = rx * rx * ry * ry - rx * rx * hy * hy - ry * ry * hx * hx;
  const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / (rx * rx * hy * hy + ry * ry * hx * hx)));
  const [cx, cy] = [co * ((rx * hy) / ry) + (x1 + x2) / 2, co * (-(ry * hx) / rx) + (y1 + y2) / 2];
  const t1 = Math.atan2((y1 - cy) / ry, (x1 - cx) / rx);
  let dt = Math.atan2((y2 - cy) / ry, (x2 - cx) / rx) - t1;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  const at = (t) => [cx + rx * Math.cos(t1 + t * dt), cy + ry * Math.sin(t1 + t * dt)];
  const M = 120;
  const acc = [0];
  for (let i = 1; i <= M; i++) acc.push(acc[i - 1] + len(sub(at(i / M), at((i - 1) / M))));
  return {
    len: acc[M],
    end: [x2, y2],
    at,
    t: (s) => {
      let i = 1;
      while (i < M && acc[i] < s) i++;
      return (i - 1 + (s - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)) / M;
    },
    cmd: (ta, tb) => `A${f(rx0)} ${f(ry0)} 0 ${Math.abs((tb - ta) * dt) > Math.PI ? 1 : 0} ${sweep} ${pt(at(tb))}`,
  };
}
/** The stretch of a path between arc lengths s0 and s1. */
function stretch(d, s0, s1, ps = pieces(d)) {
  let out = '';
  for (const q of ps) {
    const lo = Math.max(s0, q.s);
    const hi = Math.min(s1, q.s + q.len);
    if (hi <= lo + 1e-6) continue;
    const [ta, tb] = [q.t(lo - q.s, q.len), q.t(hi - q.s, q.len)];
    if (!out) out = `M${pt(q.at(ta))}`;
    out += q.cmd(ta, tb);
  }
  return out;
}
/** The dashes of an open path between gaps, each gap [center, width] in arc length. */
function gapped(d, gaps) {
  const ps = pieces(d);
  const cuts = gaps.map(([c, w]) => [c - w / 2, c + w / 2]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let from = 0;
  for (const [a, b] of cuts) {
    if (a > from + 1e-6) out.push(stretch(d, from, a, ps));
    from = b;
  }
  if (ps.total > from + 1e-6) out.push(stretch(d, from, ps.total, ps));
  return out;
}
/** Arc length of a path. */
const lengthOf = (d) => pieces(d).total;
/** `n` dashes along an open path, `gap` apart, from end to end (dashes touch both ends). */
function run(d, n, gap) {
  const ps = pieces(d);
  const dash = (ps.total - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => stretch(d, i * (dash + gap), i * (dash + gap) + dash, ps));
}

// ── The house (lugares) ───────────────────────────────────────────────────────────────────────
// lugares' `house` is built here with its own construction: the roof at its pitch (7.75 over
// 9.25), eaves 2.5 past the walls, the walls with a 2.5 bottom-left corner and the square
// bottom-right one, the door standing on the floor and the round gable window. `house()` with no
// arguments is lugares' house, stroke for stroke (checked below); the smaller homes of the
// category keep its pitch, its eaves and its corners.
const PITCH = 7.75 / 9.25;
function house({ apex = [12, 3.5], half = 9.25, eaves = 2.5, base = 20.75, rb = 2.5, ra = 1.25, door = [3.5, 4.5, 1.25], window = [9.75, 1.25] } = {}) {
  const roofAt = (x) => apex[1] + Math.abs(x - apex[0]) * PITCH;
  const [x0, x1] = [apex[0] - half, apex[0] + half];
  const [xl, xr] = [x0 + eaves, x1 - eaves];
  const roof = roundline([[x0, roofAt(x0)], apex, [x1, roofAt(x1)]], [0, ra, 0]);
  const walls = roundline([[xl, roofAt(xl)], [xl, base], [xr, base], [xr, roofAt(xr)]], [0, rb, 0, 0]);
  const out = { roof, walls, roofAt, xl, xr, x0, x1, apex, base };
  if (door) {
    const [w, h, r] = door;
    out.door = roundline([[apex[0] - w / 2, base], [apex[0] - w / 2, base - h], [apex[0] + w / 2, base - h], [apex[0] + w / 2, base]], [0, r, r, 0]);
  }
  if (window) out.window = circ(apex[0], window[0], window[1]);
  // The silhouette, closed: what a house in front clears from whatever stands behind it
  out.hull = roundpoly([[x0, roofAt(x0)], apex, [x1, roofAt(x1)], [xr, roofAt(xr)], [xr, base], [xl, base], [xl, roofAt(xl)]], [0, ra, 0, 0, 0, rb, 0]);
  return out;
}
const H = house();
const HOUSE = [H.roof, H.walls, H.door, H.window];
{
  const ref = lugares.icons.house.d;
  if (HOUSE.some((d, i) => d !== ref[i])) throw new Error('bienes-raices: house() no longer matches lugares/house');
}
/** The house filled as lugares fills it: roof and walls solid (closed along their chords), door and window knocked out. */
const HOUSE_FILL = { solid: [shut(H.roof), shut(H.walls)], cut: [H.door, H.window] };
/**
 * Filled under a badge: the badge's clearance takes the door's right half, and what was left of its
 * cut (the left jamb's top) crossed in and out of the clearance as the weight changed. The door is
 * left solid; the window stays knocked out.
 */
const HOUSE_BADGED_FILL = { solid: [shut(H.roof), shut(H.walls)], cut: [H.window] };
const HOUSE_PARTS = { roof: [0], walls: [1], door: [2], window: [3] };

// ── The core key ──────────────────────────────────────────────────────────────────────────────
// bow (circle and its hole), shaft at 45° and two teeth
const KEY = nucleo.icons.key.d;

/**
 * The core key, smaller: its bow (r 4.6), shaft and two teeth, scaled by `s`, its bow centered on
 * `at` and its shaft pointing `deg` clockwise from the core key's 45° (`flip`: the teeth on the other
 * side). Scaled, the teeth keep the set's minimums (2 long, 3 apart along the shaft) and the hole
 * moves to the bow's center: off-center, it reached the ring at bold.
 */
function keyAt(at, s = 1, deg = 0, flip = false) {
  const a = ((-45 + deg) * Math.PI) / 180;
  const u = [Math.cos(a), Math.sin(a)];
  const n = flip ? [u[1], -u[0]] : [-u[1], u[0]];
  const P = (t, o = 0) => add(at, add(mul(u, t), mul(n, o)));
  const r = 4.6 * s;
  const tip = 17.18 * s;
  const [lA, lB] = [Math.max(3.25 * s, 2.25), Math.max(2.62 * s, 2.1)];
  // The inner tooth's end keeps 3 from the bow (center to center): under 0.7 it moves toward the tip,
  // and the outer tooth with it
  const tB = Math.max(tip - 4.17 * s - Math.max(3.54 * s, 3), Math.sqrt((r + 3) ** 2 - lB ** 2));
  const tA = Math.max(tip - 4.17 * s, tB + 3);
  return [circ(...at, r), dot(...at, 0.55), line(P(r), P(tip)), line(P(tA), P(tA, lA)), line(P(tB), P(tB, lB))];
}
/** The core person: head and shoulders. */
const PERSON = nucleo.icons.person.d;
/** The core person moved 2.5 to the left, as comunicacion's and legal's, to make room for a badge. */
const PERSON_L = PERSON.map((d) => transform(d, 1, -2.5, 0));
/** The core person scaled from its feet (the head moves up to keep its gap from the shoulders), as comunicacion's. */
const personAt = (s, dx = 0, dy = 0) => [xf(PERSON[0], s, [12, 20.6], dx, dy - 1.95 * (1 - s)), xf(PERSON[1], s, [12, 20.6], dx, dy)];

/**
 * Two coins stacked, as comercio's coin stack: the top coin a capsule seen edge-on, the one under it
 * shifted 1.5 to the left and drawn from under the top one; `mirror` shifts it to the right. Filled,
 * the lower coin closes along the top one and their shared edge, the seam, is knocked out (as
 * comercio's stack).
 */
function coins(x, y, w = 9.5, h = 3.25, mirror = false) {
  const r = h / 2;
  const m = x - 1.5;
  const A = (to) => `A${f(r)} ${f(r)} 0 0 0 ${pt(to)}`;
  const top = sq(x, y, w, h, r);
  const lower = `M${pt([x + r, y + h])}H${f(m + r)}${A([m + r, y + 2 * h])}H${f(m + w - r)}${A([m + w - r, y + h])}`;
  const seam = line([x + r, y + h], [m + w - r, y + h]);
  const c = x + w / 2 - 0.75;
  const [T, Lw, S] = mirror ? [top, lower, seam].map((d) => flipPath(d, 'x', c)) : [top, lower, seam];
  return { top: T, lower: Lw, seam: S, d: [T, Lw], area: `${T}${Lw}Z`, fill: { solid: [T, shut(Lw)], cut: [S] } };
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const addIcon = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── The house with the engine's badges ──
const HOUSE_BADGES = {
  'house-plus': [['agregar propiedad', 'nueva publicación', 'publicar', 'add property', 'new listing'], 'plus'],
  'house-search': [['buscar casa', 'buscar propiedades', 'inspección', 'home search', 'find homes'], 'search'],
  'house-heart': [['casas guardadas', 'favoritos', 'me gusta', 'saved homes', 'favorite home'], 'heart'],
  'house-check': [['propiedad verificada', 'publicación aprobada', 'lista para habitar', 'verified property', 'move-in ready'], 'check'],
  'house-star': [['propiedad destacada', 'premium', 'anuncio destacado', 'featured listing', 'premium home'], 'star'],
  'house-gear': [['administración de propiedades', 'ajustes de la propiedad', 'gestión', 'property settings', 'property management'], 'gear'],
  'house-clock': [['agendar visita', 'cita para ver', 'recorrido', 'schedule viewing', 'showing'], 'clock'],
  'house-block': [['fuera del mercado', 'no disponible', 'retirada', 'off market', 'unavailable property'], 'block'],
  'house-question': [['preguntar por la propiedad', 'consulta', 'informes', 'property inquiry', 'ask agent'], 'question'],
  'house-edit': [['editar publicación', 'editar propiedad', 'datos del inmueble', 'edit listing', 'edit property'], 'edit'],
  'house-alert': [['problema en la propiedad', 'reporte', 'infracción', 'property issue', 'property alert'], 'alert'],
};
for (const [name, [tags, kind]] of Object.entries(HOUSE_BADGES)) addIcon(name, tags, HOUSE, { badge: badge(kind) });

// Vacant: the house's roof and walls dashed, without door or window. The dashes cover every corner
// (the eaves where the walls meet the roof, the ridge, the floor's corners) and the gaps fall on
// straight runs, 3 wide: a gap across a corner brings its ends closer than 3.
{
  const R = lengthOf(H.roof);
  const legL = H.base - H.roofAt(H.xl) - 2.5;
  const arcL = (Math.PI / 2) * 2.5;
  const bottom = H.xr - H.xl - 2.5;
  const W = lengthOf(H.walls);
  const roofGaps = [R / 2 - 4.5, R / 2 + 4.5].map((c) => [c, 3]);
  const wallGaps = [legL / 2, legL + arcL + bottom / 2, W - (H.base - H.roofAt(H.xr)) / 2].map((c) => [c, 3]);
  addIcon('house-vacant', ['casa desocupada', 'vacante', 'disponible', 'sin habitar', 'vacant', 'empty home'], [...gapped(H.roof, roofGaps), ...gapped(H.walls, wallGaps)]);
}

// Pin: lugares' roof over walls that narrow into the pin's point; the gable window, larger, is the
// pin's hole.
{
  const walls = roundline([[H.xl, H.roofAt(H.xl)], [H.xl, 12.5], [12, 21.25], [H.xr, 12.5], [H.xr, H.roofAt(H.xr)]], [0, 3.5, 0.75, 3.5, 0]);
  addIcon('house-pin', ['ubicación de la propiedad', 'dirección', 'mapa', 'property location', 'home address'], [H.roof, walls, circ(12, 12.25, 2.25)]);
}

// House key: the core key's shaft and teeth leave the corner of a bow drawn as a small house
// (the house's pitch, square bottom-right corner); the core key's hole in the middle.
{
  const [xl, xr] = [3.75, 12];
  const apex = [(xl + xr) / 2, 12 - ((xr - xl) / 2) * PITCH];
  const bow = roundpoly([[xl, 20.25], [xl, 12], apex, [xr, 12], [xr, 20.25]], [2, 1, 1, 0, 0]);
  addIcon('house-key', ['llave de la casa', 'entrega de llaves', 'mudanza', 'rentar', 'house key', 'home keys'], [bow, dot(apex[0], 15.75, 0.55), line([xr, 12], [20.25, 3.75]), KEY[3], KEY[4]]);
}

// Open house: the doorway empty and the leaf swung out toward the street, in perspective (its free
// edge, nearer, is taller); it passes in front of the wall and the engine clears it.
{
  const leaf = roundpoly([[10.25, 16.25], [6.25, 15], [6.25, 22], [10.25, 20.75]], [0.4, 0.75, 0.75, 0.4]);
  addIcon('open-house', ['casa abierta', 'puertas abiertas', 'visita libre', 'open house', 'viewing'], HOUSE, { badge: { d: [leaf], knock: leaf, fill: { solid: [leaf] } } });
}

// Two stories: the house a story taller (the same pitch and eaves, the apex at 2.75 and the floor at
// 21.25), its walls split by the floor between the stories: the gable window upstairs, the door
// downstairs.
{
  const T = house({ apex: [12, 2.75], base: 21.25, door: [3.5, 3.75, 1.25], window: [8.75, 1.25] });
  addIcon('two-story-house', ['casa de dos pisos', 'dos plantas', 'pisos', 'two-story house', 'stories'], [T.roof, T.walls, line([T.xl, 14], [T.xr, 14]), T.door, T.window]);
}

// Duplex: one wide house (the roof's pitch, 1.25 of eaves) split in two by the party wall that
// drops from the ridge; a door on each side, 2.85 from every wall.
{
  const W = house({ eaves: 1.25, door: null, window: null });
  const ridge = 3.5 + 1.25 / Math.sin(Math.atan(1 / PITCH)) - 1.25;
  const door = (cx) => roundline([[cx - 1.15, 20.75], [cx - 1.15, 16.25], [cx + 1.15, 16.25], [cx + 1.15, 20.75]], [0, 1, 1, 0]);
  // Filled, the party wall is knocked out from inside the gable (well clear of the roof's edge, so it
  // never reaches it at any weight) down through the floor: two homes in one body
  addIcon('duplex', ['dúplex', 'casa dúplex', 'dos viviendas', 'pareada', 'duplex', 'semi-detached'], [W.roof, W.walls, line([12, ridge], [12, 20.75]), door(8), door(16)], {
    fill: { solid: [shut(W.roof), shut(W.walls)], cut: [line([12, 7.5], [12, 22]), door(8), door(16)] },
  });
}

// Cabin: an A-frame. The roof comes down to the ground; the front wall, recessed under it, is the
// same triangle 3 inside, with a door small enough to keep 3 from its slopes. (With eave kicks at
// its feet it read as a rocket; with the house's round window, as a letter A.)
{
  const k = 9.25 / 18;
  const off = 3 / Math.sin(Math.atan(1 / k));
  const innerApex = 2.75 + 3 / Math.sin(Math.atan(k));
  const frame = roundline([[2.75, 20.75], [12, 2.75], [21.25, 20.75]], [0, 1.25, 0]);
  const front = [[12, innerApex], [21.25 - off, 20.75], [2.75 + off, 20.75]];
  const door = roundline([[10.75, 20.75], [10.75, 17.75], [13.25, 17.75], [13.25, 20.75]], [0, 0.75, 0.75, 0]);
  // Filled, the A is solid and the front wall's slopes are knocked out, run on 1.5 past the ground so
  // they go through it: the frame's legs stand apart from the wall, and the door is cut out of it
  const past = (p) => sub(p, mul(unit(sub(front[0], p)), 1.5));
  addIcon('cabin', ['cabaña', 'casa de campo', 'chalet', 'a-frame', 'cabin', 'retreat'], [frame, roundpoly(front, [1, 0, 0.75]), door], {
    fill: { solid: [shut(frame)], cut: [roundline([past(front[2]), front[0], past(front[1])], [0, 1, 0]), door] },
  });
  // At 16 px the front wall, 2 pixels inside the frame on a slope, ran into it as a gray smudge: the
  // pixel cabin is the frame alone (two rows down per column, through pixel centers) and the door
  const px = (c, r) => [0.75 + 1.5 * c, 0.75 + 1.5 * r];
  const frame16 = roundline([px(1, 13), px(7, 1), px(13, 13)], [0, 0.6, 0]);
  const door16 = roundline([px(6, 13), px(6, 10), px(8, 10), px(8, 13)], [0, 0.4, 0.4, 0]);
  icons.cabin.small = { d: [frame16, door16], fill: { solid: [shut(frame16)], cut: [door16] } };
}

// Villa: a tall gabled center (the house's pitch) between two lower flat-roofed wings; its walls
// come down to the ground between the volumes. Door and round window on the center.
{
  const yE = 8.5;
  const apexY = yE - 4.5 * PITCH;
  addIcon('villa', ['villa', 'residencia', 'casa de lujo', 'mansión', 'villa', 'luxury home'], [
    roundpoly(
      [[2.75, 20.75], [2.75, 12.75], [7.5, 12.75], [7.5, yE], [12, apexY], [16.5, yE], [16.5, 12.75], [21.25, 12.75], [21.25, 20.75]],
      [2, 1, 0, 0.75, 1.25, 0.75, 0, 1, 0],
    ),
    line([7.5, 12.75], [7.5, 20.75]),
    line([16.5, 12.75], [16.5, 20.75]),
    roundline([[10.5, 20.75], [10.5, 16.5], [13.5, 16.5], [13.5, 20.75]], [0, 1.25, 1.25, 0]),
    circ(12, 9.75, 1.25),
  ]);
  // Filled, the center's walls are knocked out from 0.75 under the wings' roofs (they stop clearly
  // short of the corner) down through the floor
  const v = icons.villa.d;
  icons.villa.fill = { solid: [v[0]], cut: [line([7.5, 13.5], [7.5, 22]), line([16.5, 13.5], [16.5, 22]), v[3], v[4]] };
}

// Modern house: one low volume under a shed roof, the single shallow slope of contemporary homes,
// running 1.5 past both walls (the house's eaves); a door and a tall window, 3 from the walls, the
// roof and each other. (Drawn as stacked flat-roofed boxes, cantilevered or set back, with or
// without a ribbon window, it read as a card on a box, a sign on a post, a printer or a monitor.)
// Filled, the body is solid (closed along the roof), the roof stays a line on it and the door and
// window are knocked out.
const MODERN = (() => {
  const [r0, r1] = [[2.25, 10.25], [21.75, 4.75]];
  const roofY = (x) => r0[1] + ((x - r0[0]) * (r1[1] - r0[1])) / (r1[0] - r0[0]);
  const roof = line(r0, r1);
  const walls = roundline([[3.75, roofY(3.75)], [3.75, 20.75], [20.25, 20.75], [20.25, roofY(20.25)]], [0, 2, 0, 0]);
  const door = roundline([[6.75, 20.75], [6.75, 16], [9.75, 16], [9.75, 20.75]], [0, 1, 1, 0]);
  const win = sq(12.75, 10.25, 4.5, 6.5, 1, BR);
  return { d: [roof, walls, door, win], fill: { solid: [shut(walls)], wire: [roof], cut: [door, win] } };
})();
addIcon('modern-house', ['casa moderna', 'contemporánea', 'minimalista', 'arquitectura moderna', 'modern house', 'contemporary home'], MODERN.d, { fill: MODERN.fill });

// Apartment: the office building's body and windows (r 0.3 dots, a dense group) under a shallow
// gable, and the door. The gable is what makes it a home: the office's top is flat.
const APT_BODY = roundpoly([[5.25, 21.25], [5.25, 6.5], [12, 2.75], [18.75, 6.5], [18.75, 21.25]], [3.25, 1, 1.25, 1, 0]);
const APT_WINDOWS = [8.25, 11.75, 15.25].flatMap((y) => [9.5, 14.5].map((x) => dot(x, y, 0.3)));
const APT_DOOR = roundline([[10.25, 21.25], [10.25, 18], [13.75, 18], [13.75, 21.25]], [0, 1, 1, 0]);
addIcon('apartment', ['departamento', 'condominio', 'edificio de departamentos', 'apartment', 'condo', 'flat'], [APT_BODY, ...APT_WINDOWS, APT_DOOR]);

// Townhouses: three narrow houses wall to wall, each gable a step higher (the house's pitch); the
// party walls drop from where the roofs meet, and each house has its window.
{
  const w = 18.5 / 3;
  const rise = (w / 2) * PITCH;
  const eaves = [13.5, 11, 8.5];
  const P = [[2.75, 21.25]];
  eaves.forEach((y, i) => {
    const x0 = 2.75 + i * w;
    P.push([x0, y], [x0 + w / 2, y - rise], [x0 + w, y]);
  });
  P.push([21.25, 21.25]);
  // The steps between houses: the corner where a lower roof meets the next wall is concave (no radius)
  const outline = roundpoly(P, [2, 0.75, 1, 0, 1, 0, 0.75, 1, 0.75, 0].slice(0, P.length));
  addIcon('townhouse', ['casas adosadas', 'casa en hilera', 'townhouse', 'row house', 'casas en serie'], [
    outline,
    line([2.75 + w, eaves[1]], [2.75 + w, 21.25]),
    line([2.75 + 2 * w, eaves[2]], [2.75 + 2 * w, 21.25]),
    ...eaves.map((y, i) => dot(2.75 + i * w + w / 2, y + 2.25)),
  ]);
  // Filled, each party wall is knocked out from 2.1 under the lower eave (the step between the roofs
  // stays ink) down through the floor
  const t = icons.townhouse.d;
  icons.townhouse.fill = { solid: [t[0]], cut: [line([2.75 + w, eaves[0] + 2.1], [2.75 + w, 22]), line([2.75 + 2 * w, eaves[1] + 2.1], [2.75 + 2 * w, 22]), ...t.slice(3)] };
}

// ── Small homes and scenes ──
/** A small home with the house's construction (pitch, eaves): its roof and its two walls standing on `ground`. */
function hut(apex, half, eaves, ground) {
  const h = house({ apex, half, eaves, base: ground, door: null, window: null });
  return { ...h, walls: [line([h.xl, h.roofAt(h.xl)], [h.xl, ground]), line([h.xr, ground], [h.xr, h.roofAt(h.xr)])] };
}
/** A path as a zero-area there-and-back polyline: the knock of an open stroke (filled, an open arc would clear its chord's lens). */
function trace(d, step = 0.25) {
  const ps = pieces(d);
  const pts = [];
  for (let s = 0; s <= ps.total; s += step) {
    const q = ps.find((p) => s <= p.s + p.len + 1e-9) ?? ps.at(-1);
    pts.push(q.at(q.t(Math.max(0, s - q.s), q.len)));
  }
  pts.push(ps.at(-1).end);
  return `M${[...pts, ...pts.slice(0, -1).reverse()].map(pt).join('L')}`;
}

// Tiny house: a small house (the house's pitch and eaves) standing on a trailer bed, with its hitch
// at the front and two wheels 3 below the bed, as the truck's.
{
  const T = house({ apex: [12.5, 3.75], half: 6.75, eaves: 1.75, base: 15, door: [2.5, 3.25, 1], window: null });
  const bed = roundline([[2.75, 17.75], [5.5, 15], [20.75, 15]], [0, 0.6, 0]);
  addIcon('tiny-house', ['casa pequeña', 'casa rodante', 'minicasa', 'tiny house', 'house on wheels'], [
    T.roof,
    line([T.xl, T.roofAt(T.xl)], [T.xl, 15]),
    line([T.xr, 15], [T.xr, T.roofAt(T.xr)]),
    T.door,
    bed,
    circ(9.5, 19.75, 1.75),
    circ(15.75, 19.75, 1.75),
  ]);
  // Filled: the roof and the body (closed along its walls and the bed) solid, the door cut out, the
  // bed and hitch a line and the wheels solid
  const d = icons['tiny-house'].d;
  icons['tiny-house'].fill = { solid: [shut(T.roof), `M${pt([T.xl, T.roofAt(T.xl)])}V15H${f(T.xr)}V${f(T.roofAt(T.xr))}Z`, d[5], d[6]], wire: [bed], cut: [T.door] };
}

// Mixed use: the office building behind (its body narrowed, its r 0.3 windows) and a small house in
// front of it on the same ground; the house clears the tower where it covers it.
{
  const F = house({ apex: [7.75, 10.25], half: 5, eaves: 1.5, base: 21.25, door: [2.5, 3.25, 1], window: null });
  addIcon('mixed-use', ['uso mixto', 'comercial', 'residencial y comercial', 'mixed use', 'commercial property'], [
    sq(10.75, 2.75, 10, 18.5, 3, BR),
    ...[[14, 6.5], [17.5, 6.5], [17.5, 10], [17.5, 13.5], [17.5, 17]].map(([x, y]) => dot(x, y, 0.3)),
  ], { badge: { d: [F.roof, F.walls, F.door], knock: F.hull, fill: { solid: [shut(F.roof), shut(F.walls)], cut: [F.door] } } });
}

// Land plot: a parcel seen in perspective (a diamond at the box's slope) and a surveyor's flag (the
// notched banner of edicion's flag) planted at its far corner.
const PLOT = [[12, 11.25], [21.25, 15.75], [12, 20.25], [2.75, 15.75]];
const PARCEL = roundpoly(PLOT, [1, 1.25, 1, 1.25]);
// The stake ends on the far corner's rounded tip
const STAKE = line([12, 11.25 + 1 / Math.sin(Math.atan2(9.25, 4.5)) - 1], [12, 2.75]);
const FLAG = roundpoly([[12, 2.75], [17.25, 2.75], [15.6, 4.88], [17.25, 7], [12, 7]], [0, 0.6, 0.4, 0.6, 0]);
addIcon('land-plot', ['terreno', 'lote', 'parcela', 'predio', 'land', 'lot', 'plot'], [PARCEL, STAKE, FLAG], { fill: { solid: [PARCEL, FLAG], wire: [STAKE] } });

// Subdivision: the land plot's parcel divided into four lots and a home (the house's construction,
// with its door) standing on the far lot, in front of the parcel's far corner (the engine clears
// what it covers): land cut up into lots to build on. (As a top-down plan, a road beside a 2 × 2
// block, it read as a window; with the land plot's flag on the divided parcel, as a golf green or a
// checkered kite, and a near double of the land plot; three lots in a row read as a crossing.)
// Filled, the lot lines are knocked out of the parcel and the door out of the home.
{
  const mid = (a, b) => lerp(a, b, 0.5);
  const lots = [line(mid(PLOT[0], PLOT[1]), mid(PLOT[2], PLOT[3])), line(mid(PLOT[1], PLOT[2]), mid(PLOT[3], PLOT[0]))];
  const S = house({ apex: [12, 3.5], half: 5, eaves: 1.25, base: 13.25, rb: 1.25, ra: 0.75, door: [2.5, 3, 0.9], window: null });
  addIcon('subdivision', ['fraccionamiento', 'lotificación', 'plano de lotes', 'desarrollo', 'subdivision', 'site plan'], [PARCEL, ...lots], {
    badge: { d: [S.roof, S.walls, S.door], knock: S.hull, fill: { solid: [shut(S.roof), shut(S.walls)], cut: [S.door] } },
    fill: { solid: [PARCEL], cut: lots },
  });
}

// Off plan: the apartment block (its outline, its two columns of r 0.3 windows and its door), built
// up to the first floor and planned above it: the walls break 3 under the floors still to come and
// the outline goes on dashed, broken once more on each slope, so its dashes cover the eaves and the
// ridge. (A short closed block with a slab, under a dashed gable, read as a basket or a die; one row
// of windows over the door read as a face.) The upper windows stand 3 above the built block and the
// lower ones 2.5 under it, so filled they keep apart from its edge at every weight; the top row
// stands 3 under the slopes' dash ends. Filled, the built floors are solid (closed along their top)
// with the door knocked out, and the plan stays lines with its windows; the built floor's two
// windows stay under the fill (knocked out over the door, they made a face).
{
  const ys = 13.25;
  const built = roundline([[18.75, ys], [18.75, 21.25], [5.25, 21.25], [5.25, ys]], [0, 0, 3.25, 0]);
  const upper = roundline([[18.75, ys - 3], [18.75, 6.5], [12, 2.75], [5.25, 6.5], [5.25, ys - 3]], [0, 1, 1.25, 1, 0]);
  const U = lengthOf(upper);
  const wall = ys - 3 - 6.5;
  const slope = (U - 2 * wall) / 2;
  const plan = gapped(upper, [[wall + slope / 2, 3], [U - wall - slope / 2, 3]]);
  const up = [7.25, 10.25].flatMap((y) => [10, 14].map((x) => dot(x, y, 0.3)));
  const low = [10, 14].map((x) => dot(x, 15.75, 0.3));
  const door = roundline([[10.25, 21.25], [10.25, 18.5], [13.75, 18.5], [13.75, 21.25]], [0, 1, 1, 0]);
  addIcon('off-plan', ['preventa', 'en construcción', 'sobre plano', 'off-plan', 'pre-construction', 'presale'], [built, ...plan, ...up, ...low, door], {
    fill: { solid: [shut(built)], lines: plan, wire: up, cut: [door] },
  });
}

// Storage unit: a flat-roofed unit standing on the ground (no floor line: the door opens onto it),
// its roll-up door raised partway: the slats above, the opening below.
addIcon('storage-unit', ['bodega', 'trastero', 'minibodega', 'almacenaje', 'storage unit', 'self storage'], [
  roundline([[3.25, 20.75], [3.25, 3.75], [20.75, 3.75], [20.75, 20.75]], [0, 3, 3, 0]),
  roundline([[7, 20.75], [7, 7.5], [17, 7.5], [17, 20.75]], [0, 1, 1, 0]),
  line([7, 10.5], [17, 10.5]),
  line([7, 13.5], [17, 13.5]),
]);

// Properties: two homes (the house's construction), the front one clearing the one behind it, up
// and to the right, as a file in front of another.
{
  const back = house({ apex: [15.5, 2.75], half: 5.75, eaves: 1.75, base: 14.5, door: null, window: null });
  const front = house({ apex: [8.5, 9], half: 5.75, eaves: 1.75, base: 21.25, door: [2.5, 3, 1], window: null });
  addIcon('properties', ['propiedades', 'portafolio inmobiliario', 'inmuebles', 'properties', 'real estate portfolio'], [back.roof, back.walls], {
    badge: { d: [front.roof, front.walls, front.door], knock: front.hull, fill: { solid: [shut(front.roof), shut(front.walls)], cut: [front.door] } },
  });
}

// Neighborhood: two small houses and a round tree between them, on one ground line. The houses are
// low and the tree rises over them (houses as tall as the tree, without doors, read as columns).
{
  const A = hut([5.9, 12], 3.15, 1, 20.75);
  const B = hut([18.1, 12], 3.15, 1, 20.75);
  addIcon('neighborhood', ['vecindario', 'colonia', 'barrio', 'zona', 'neighborhood', 'area guide'], [
    line([2.75, 20.75], [21.25, 20.75]),
    A.roof,
    ...A.walls,
    B.roof,
    ...B.walls,
    circ(12, 8.5, 3),
    line([12, 11.5], [12, 20.75]),
  ]);
  // Filled: each house's roof and body (closed along its walls and the ground) and the crown solid;
  // the ground and the trunk stay lines
  const body = (h) => `M${pt([h.xl, h.roofAt(h.xl)])}V20.75H${f(h.xr)}V${f(h.roofAt(h.xr))}Z`;
  const d = icons.neighborhood.d;
  icons.neighborhood.fill = { solid: [shut(A.roof), body(A), shut(B.roof), body(B), d[7]], wire: [d[0], d[8]] };
}

// Gated community: two roofs behind a picket fence; the fence passes in front and the engine clears
// the walls behind it. Four pickets rise 3.5 over the top rail (five pickets flush with it made a
// grid, a hash sign).
{
  const A = house({ apex: [6.5, 4.25], half: 3.75, eaves: 1.25, base: 14, door: null, window: null });
  const B = house({ apex: [17.5, 5.75], half: 3.75, eaves: 1.25, base: 14, door: null, window: null });
  const pickets = [4.25, 9.5, 14.5, 19.75].map((x) => line([x, 12.75], [x, 21.25]));
  const rails = [16.25, 19.25].map((y) => line([2.75, y], [21.25, y]));
  addIcon('gated-community', ['privada', 'fraccionamiento cerrado', 'coto', 'comunidad cerrada', 'gated community'], [A.roof, A.walls, B.roof, B.walls], {
    badge: { d: [...pickets, ...rails], knock: sq(2.75, 12.75, 18.5, 8.5, 0) },
  });
}

// Gatehouse: a booth under a flat roof slab, with its window, and the barrier arm reaching out level
// from its wall: a capsule 3 deep with two stripes at 60°, 3 apart, clear of its round end. (As a
// single line, level, the boom read as a handle; raised on its own post and pivot, the whole read
// as a phone and a lever; with upright dividers, as a ruler.) Filled, the booth and the boom are
// solid and the stripes are knocked out through the boom, so it stands in three pieces at every
// weight; the slab stays a line on the booth.
const GATE = (() => {
  const roof = line([2.25, 6.25], [13.25, 6.25]);
  const booth = roundline([[3.25, 6.25], [3.25, 21.25], [12.25, 21.25], [12.25, 6.25]], [0, 2, 0, 0]);
  const win = sq(6.25, 9.25, 3, 3.5, 1, BR);
  const [y0, y1] = [14, 17];
  const boom = `M12.25 ${y0}H19.75A1.5 1.5 0 0 1 19.75 ${y1}H12.25`;
  const [dx, a] = [3 / Math.tan(Math.PI / 3), Math.PI / 3];
  const xs = [14.25, 14.25 + 3 / Math.sin(a)];
  const stripes = xs.map((x) => line([x, y1], [x + dx, y0]));
  // Filled, each stripe runs on 1.25 past both edges of the boom
  const through = (x) => line([x - 1.25 * Math.cos(a), y1 + 1.25 * Math.sin(a)], [x + dx + 1.25 * Math.cos(a), y0 - 1.25 * Math.sin(a)]);
  return { d: [roof, booth, win, boom, ...stripes], fill: { solid: [shut(booth), `${boom}Z`], wire: [roof], cut: [win, ...xs.map(through)] } };
})();
addIcon('gatehouse', ['caseta de vigilancia', 'acceso controlado', 'pluma', 'garita', 'gatehouse', 'guard booth'], GATE.d, { fill: GATE.fill });

// Waterfront: a house (the house's construction) standing on two of lugares' waves.
{
  const W = house({ apex: [12, 2.75], half: 6.5, eaves: 2, base: 13, door: [3, 3.25, 1], window: null });
  const wave = (y, x0 = 3, n = 6, h = 3, a = 1) => {
    let d = `M${pt([x0, y])}`;
    for (let i = 0; i < n; i++) {
      const sg = i % 2 ? 1 : -1;
      const x = x0 + i * h;
      d += `C${pt([x + h / 3, y + (sg * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (sg * 4 * a) / 3])} ${pt([x + h, y])}`;
    }
    return d;
  };
  addIcon('waterfront', ['frente al mar', 'frente a la playa', 'orilla del lago', 'waterfront', 'beachfront', 'lakefront'], [W.roof, W.walls, W.door, wave(17), wave(21)]);
}

// Sun exposure: a half sun with short rays (lugares' sun: rays 3 to 5.1 out) rising behind a house's
// roof; the house is in front and clears the sun's lower half.
{
  const S = house({ apex: [12, 11.75], half: 9.25, eaves: 2.5, base: 21.25, door: [3, 3, 1], window: null });
  const c = [12, 11.25];
  const r = 3.25;
  const rays = [180, 225, 270, 315, 360].map((a) => line(polar(...c, r + 3, a), polar(...c, r + 5.1, a)));
  addIcon('sun-exposure', ['orientación', 'luz natural', 'asoleamiento', 'sol', 'sun exposure', 'natural light'], [circ(...c, r), ...rays], {
    badge: { d: [S.roof, S.walls, S.door], knock: S.hull, fill: { solid: [shut(S.roof), shut(S.walls)], cut: [S.door] } },
  });
}

// Yard: a house with its door and a round tree beside it, on the ground line that runs on from the
// house's floor.
{
  const Y = house({ apex: [7.75, 8.5], half: 5, eaves: 1.5, base: 20.75, door: [3, 4, 1], window: null });
  addIcon('yard', ['jardín', 'patio', 'áreas verdes', 'exterior', 'yard', 'garden'], [Y.roof, Y.walls, Y.door, line([Y.xr, 20.75], [21.25, 20.75]), circ(18.25, 10.5, 2.75), line([18.25, 13.25], [18.25, 20.75])]);
}

// For-sale sign: an L post and a blank board hanging from its arm by two chains.
const SIGN = [roundline([[5.25, 21.25], [5.25, 3.25], [19.25, 3.25]], [0, 1.5, 0]), line([10.75, 3.25], [10.75, 7.25]), line([16.75, 3.25], [16.75, 7.25]), sq(8.25, 7.25, 11, 7.5, 2, BR)];
addIcon('for-sale-sign', ['se vende', 'se renta', 'letrero', 'en venta', 'for sale', 'for rent', 'yard sign'], SIGN);
addIcon('for-sale-sign-check', ['vendida', 'rentada', 'operación cerrada', 'sold', 'rented', 'closed deal'], SIGN, { badge: badge('check') });
addIcon('for-sale-sign-clock', ['venta pendiente', 'en trato', 'próximamente', 'pending sale', 'under contract', 'coming soon'], SIGN, { badge: badge('clock') });

// Listing: a portrait card whose photo is a gable roof (the house's pitch) running wall to wall, and
// two lines of text under it.
addIcon('listing', ['anuncio', 'ficha de propiedad', 'publicación', 'inmueble', 'listing', 'property card'], [
  sq(4.75, 2.75, 14.5, 18.5, 3.5, BR),
  roundline([[4.75, 12], [12, 12 - 7.25 * PITCH], [19.25, 12]], [0, 1.25, 0]),
  line([8.25, 15.25], [15.75, 15.25]),
  line([8.25, 18.25], [12.75, 18.25]),
]);

// House price: a house (the house's construction, raised to the right) and a price tag hanging
// upright from its left eave on a short string, with its eyelet. (Narrow and without the eyelet,
// the tag's pointed top read as a second, smaller house.) The tag is 6.5 wide with a blunt point, so
// the eyelet keeps its clearance from the sides and the slopes; it hangs 3 clear of the wall, so the
// arrow badges only bite the house.
const PRICE = (() => {
  const P = house({ apex: [16.25, 3.5], half: 5.75, eaves: 1.5, base: 16.5, door: null, window: [9.25, 1.25] });
  const top = [5.75, 10.25];
  const [hw, nose, bottom] = [3.25, 2.5, 21];
  const tag = roundpoly([top, [top[0] + hw, top[1] + nose], [top[0] + hw, bottom], [top[0] - hw, bottom], [top[0] - hw, top[1] + nose]], [0.9, 0.9, 1.5, 1.5, 0.9]);
  // The string ends on the tag's rounded point (radius 0.9)
  const tipIn = 0.9 / Math.cos(Math.atan2(nose, hw)) - 0.9;
  return [P.roof, P.walls, P.window, line([P.x0, P.roofAt(P.x0)], [top[0], top[1] + tipIn]), tag, dot(top[0], top[1] + 4.25)];
})();
addIcon('house-price', ['precio', 'valor de la casa', 'avalúo', 'house price', 'home value', 'listing price'], PRICE);
addIcon('house-price-up', ['plusvalía', 'sube el precio', 'valorización', 'price increase', 'appreciation'], PRICE, { badge: badge('arrow-up') });
addIcon('house-price-down', ['rebaja', 'baja de precio', 'precio reducido', 'price cut', 'price reduced'], PRICE, { badge: badge('arrow-down') });

// Virtual tour: a house ringed by a tall orbit, low in front of its base and high behind its roof:
// the near side passes in front of the walls and the floor (the engine clears them), the far side
// hides behind the roof, and the orbit ends in an arc arrow (arms 3). The house has no door: the
// orbit's clearance took its lower half and left its top as a loose arch. The eaves run 1.25 past
// the walls and the orbit stops at 318°: with eaves of 1.5 and the orbit stopping at 316°, the
// arrow's lower arm came within 1.9 of the right eave, and the eave's cut end joined the arrow at
// bold (stopping later instead took the arrow out of the live area).
{
  const V = house({ apex: [12, 6.25], half: 4.75, eaves: 1.25, base: 18.75, door: null, window: null });
  const [cx, cy, rx, ry] = [12, 12, 9.5, 6.75];
  const E = (t) => [cx + rx * Math.cos((t * Math.PI) / 180), cy + ry * Math.sin((t * Math.PI) / 180)];
  const A = (t) => `A${f(rx)} ${f(ry)} 0 0 0 ${pt(E(t))}`;
  const [t0, t1] = [238, 318];
  const orbit = `M${pt(E(t0))}${A(180)}${A(90)}${A(0)}${A(t1)}`;
  // The head turned 8° off the tangent, as relocation's: along the tangent its inner arm closed a sliver with the orbit
  const arrow = head(E(t1), rot([rx * Math.sin((t1 * Math.PI) / 180), -ry * Math.cos((t1 * Math.PI) / 180)], [0, 0], 8), 3);
  addIcon('virtual-tour', ['recorrido virtual', 'tour 360', 'vista 3d', 'virtual tour', '360 tour'], [V.roof, V.walls], {
    badge: { d: [orbit, arrow], knock: `${trace(orbit)}${trace(arrow)}` },
  });
}

// Floor plan: the outer walls, a wall splitting the top into two rooms and one across the plan with
// a door: its gap, its leaf and its quarter-circle swing.
addIcon('floor-plan', ['plano', 'planta arquitectónica', 'distribución', 'floor plan', 'layout'], [
  sq(3.25, 3.25, 17.5, 17.5, 2.5, BR),
  line([13, 3.25], [13, 12]),
  line([3.25, 12], [6.25, 12]),
  line([10.25, 12], [20.75, 12]),
  line([10.25, 12], [10.25, 16]),
  arc(10.25, 12, 4, 180, 90).d,
]);

// Compare: two small houses (the house's construction) either side of a dashed divider; the divider
// steps aside where the eaves come close.
{
  const A = house({ apex: [6.5, 8], half: 4, eaves: 1.5, base: 16, door: null, window: null });
  const B = house({ apex: [17.5, 8], half: 4, eaves: 1.5, base: 16, door: null, window: null });
  addIcon('house-compare', ['comparar propiedades', 'comparativa', 'lado a lado', 'compare homes', 'side by side'], [A.roof, A.walls, B.roof, B.walls, line([12, 2.75], [12, 5.25]), ...run(line([12, 14.25], [12, 21.25]), 2, 3)]);
}

// ── Keys ──
// Key ring: a split ring at the upper left and two keys threaded on it, fanned almost a right angle
// apart, their shafts pointing out and their two teeth (3 apart, the inner one 3 from the bow) on
// the outer side. The bows sit on the ring, 3 apart, and the ring passes behind them: it stops a
// clearance of paper short of each bow, so only its outer arc shows. (Fanned from one pivot with
// the ring threaded through their middles, the bows piled up into a knot; hung on the ring's
// outside, ring and bows read as a chain of beads.) Filled, the bows are solid and the ring stays
// a line.
const KEYRING = (() => {
  const c = [7.25, 7.25];
  const R = 4.5;
  const r = 2.1;
  const key = (at, deg, side) => {
    const u = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const n = mul([-u[1], u[0]], side);
    const P = (t, o = 0) => add(at, add(mul(u, t), mul(n, o)));
    const tip = 9.25;
    return [circ(...at, r), line(P(r), P(tip)), line(P(tip - 0.75), P(tip - 0.75, 2.25)), line(P(tip - 3.75), P(tip - 3.75, 2.1))];
  };
  const [ta, tb] = [-8, 98];
  // The ring's ends stand 1.5 of paper from each bow: 3 from its stroke, center to center
  const gap = (2 * Math.asin((r + 3) / (2 * R)) * 180) / Math.PI;
  return { ring: arc(...c, R, tb + gap, ta - gap + 360).d, a: key(polar(...c, R, ta), 8, -1), b: key(polar(...c, R, tb), 82, 1) };
})();
addIcon('key-ring', ['llavero', 'juego de llaves', 'duplicados', 'key ring', 'keys', 'key set'], [KEYRING.ring, ...KEYRING.a, ...KEYRING.b], {
  fill: { solid: [KEYRING.a[0], KEYRING.b[0]], wire: [KEYRING.ring, ...KEYRING.a.slice(1), ...KEYRING.b.slice(1)] },
});

// Key tag: the core key lying level at the top (0.6; its hole left out, it closed against the bow at
// bold) and its tag hanging under the bow on a string tied to the tag's top edge, its hole below.
// The tag is a small card, with the signature corner. (Leaning along the key's line, the tag and the
// key read as one long link; run into the hole, the string ended 0.75 short of it, and filled it
// covered the hole.)
{
  const k = keyAt([6.75, 6.25], 0.6, 45);
  const hole = dot(6.75, 15.75);
  const string = line([6.75, 6.25 + 4.6 * 0.6], [6.75, 12.25]);
  const tag = sq(3.25, 12.25, 7, 9, 2, BR);
  addIcon('key-tag', ['llave con etiqueta', 'llavero etiquetado', 'control de llaves', 'key tag', 'labeled key'], [k[0], ...k.slice(2), string, tag, hole], {
    fill: { solid: [k[0], tag], wire: [...k.slice(2), string], cut: [hole] },
  });
}

// Key handover: comercio's open hand (the donation hand, with its cuff), palm up, and a core key
// lying just above it.
const HAND = [sq(2.75, 13.25, 3, 7.75, 0.9), 'M5.75 14.5H8.5C9.5 14.5 10.25 15 10.75 15.75L11.25 16.5H15.5L18.75 13.75a1.4 1.4 0 0 1 2 2L17.25 19.5C16.6 20.15 15.9 20.25 15 20.25H5.75'];
addIcon('key-handover', ['entrega de llaves', 'cierre', 'mudanza', 'recibir llaves', 'key handover', 'move-in'], [...keyAt([7.5, 7.5], 0.62, 45), ...HAND]);

// Key return: the core key lying flat and a U-turn arrow curling back from its tip (an arc arrow,
// arms 3.4).
{
  const k = keyAt([6.5, 16.25], 0.66, 45);
  const tip = [6.5 + 17.18 * 0.66, 16.25];
  void 0;
  const r = 3.5;
  const back = `M${pt(tip)}A${r} ${r} 0 0 0 ${pt([tip[0], tip[1] - 2 * r])}H9.5`;
  addIcon('key-return', ['devolver llaves', 'entrega del inmueble', 'fin de renta', 'return keys', 'move-out'], [...k, back, head([9.5, tip[1] - 2 * r], [-1, 0], 3.4)]);
}

// Key fob: a teardrop leaning up and to the left, its point a 60° wedge (with a square corner it was
// the speech bubble's drop turned around), the ring hole near its point and two contactless arcs
// spreading from the hole into its wide end. The hole is a dot, as the core key's.
const FOB = (() => {
  const c = [14, 14];
  const r = 6.75;
  const D = 12.75;
  const u = [-Math.SQRT1_2, -Math.SQRT1_2];
  const tip = add(c, mul(u, D));
  const half = (Math.asin(r / D) * 180) / Math.PI;
  const [a, b] = [polar(...c, r, 135 + half), polar(...c, r, 315 - half)];
  // The point rounded with r 0.9: its arc meets each side 0.9 / tan(half) from the tip
  const rt = 0.9;
  const t = rt / Math.tan((half * Math.PI) / 180);
  const drop = `M${pt(a)}L${pt(add(tip, mul(unit(sub(a, tip)), t)))}A${rt} ${rt} 0 0 1 ${pt(add(tip, mul(unit(sub(b, tip)), t)))}L${pt(b)}A${f(r)} ${f(r)} 0 1 1 ${pt(a)}Z`;
  const o = add(tip, mul(u, -6.75));
  return [drop, dot(...o), arc(...o, 4, 15, 75).d, arc(...o, 7, 20, 70).d];
})();
addIcon('key-fob', ['llavero de acceso', 'tarjeta de proximidad', 'control de acceso', 'key fob', 'access fob'], FOB, { fill: { solid: [FOB[0]], cut: FOB.slice(1) } });

// Lockbox: a box hanging from a padlock's shackle, its keypad a 2 × 2 grid of dots.
addIcon('lockbox', ['caja de llaves', 'caja de seguridad', 'autoacceso', 'lockbox', 'key safe', 'self check-in'], [
  sq(5.75, 9.25, 12.5, 12, 3, BR),
  roundline([[9, 9.25], [9, 3.25], [15, 3.25], [15, 9.25]], [0, 2.25, 2.25, 0]),
  ...[13.25, 17.25].flatMap((y) => [10, 14].map((x) => dot(x, y))),
]);

// ── People ──
// Agent: the core person, moved left, with a small for-sale sign at their right: the board on its
// stake, in front of them (it clears them).
{
  const board = sq(13.25, 10.75, 8, 5.5, 1.5, BR);
  const stake = line([17.25, 16.25], [17.25, 21.25]);
  addIcon('real-estate-agent', ['agente inmobiliario', 'corredor', 'asesor', 'real estate agent', 'realtor', 'broker'], PERSON_L, {
    badge: { d: [board, stake], knock: `${board}${trace(stake)}`, fill: { solid: [board], wire: [stake] } },
  });
}
// Landlord: the core person, moved left, and a small house (the house's construction) at their side.
const MINI = house({ apex: [17.25, 12.25], half: 4.25, eaves: 1.25, base: 21.25, rb: 1.25, ra: 0.75, door: null, window: null });
addIcon('landlord', ['propietario', 'arrendador', 'casero', 'dueño', 'landlord', 'property owner'], PERSON_L, {
  badge: { d: [MINI.roof, MINI.walls], knock: MINI.hull, fill: { solid: [shut(MINI.roof), shut(MINI.walls)] } },
});
// Tenant: the house's roof over a person (0.72), no walls: who lives under it.
const TENANT_ROOF = roundline([[2.75, 2.75 + 9.25 * PITCH], [12, 2.75], [21.25, 2.75 + 9.25 * PITCH]], [0, 1.25, 0]);
addIcon('tenant', ['inquilino', 'arrendatario', 'residente', 'tenant', 'renter', 'resident'], [TENANT_ROOF, ...personAt(0.72)]);
// Residents: the same roof over two people, the one in front clearing the one behind. The one behind
// stands close enough that the clearance takes a wide bite of its head, as the core clients' back
// person: 1.25 further right, the bite was narrow and the head's cut ends met again at regular, so
// it closed into a ring from light to bold.
addIcon('residents', ['residentes', 'inquilinos', 'hogar', 'roomies', 'residents', 'household', 'co-living'], [TENANT_ROOF, ...personAt(0.56, 2.5, -0.75)], {
  badge: { d: personAt(0.66, -2.5, 0.25), knock: personAt(0.66, -2.5, 0.25).join(''), fill: { solid: personAt(0.66, -2.5, 0.25) } },
});

// ── Leases ──
// Lease: a page whose top rises into a gable (the house's pitch), with three lines of text.
const LEASE_PAGE = roundpoly([[4.75, 21.25], [4.75, 2.75 + 7.25 * PITCH], [12, 2.75], [19.25, 2.75 + 7.25 * PITCH], [19.25, 21.25]], [3.5, 1.5, 1.25, 1.5, 0]);
const LEASE = [LEASE_PAGE, line([8.25, 12.25], [15.75, 12.25]), line([8.25, 15.25], [15.75, 15.25]), line([8.25, 18.25], [12.75, 18.25])];
addIcon('lease', ['contrato de arrendamiento', 'contrato de renta', 'arrendamiento', 'lease', 'rental agreement'], LEASE);
addIcon('lease-renewal', ['renovar contrato', 'renovación', 'prórroga', 'lease renewal', 'renew lease'], LEASE, { badge: badge('sync') });
addIcon('lease-expiring', ['contrato por vencer', 'vencimiento', 'fin de contrato', 'lease expiring', 'lease end'], LEASE, { badge: badge('clock') });
addIcon('lease-application', ['solicitud de renta', 'aplicar para rentar', 'formato', 'rental application', 'apply to rent'], LEASE, { badge: badge('edit') });
// Title deed: the gable-topped page with two lines and sistema's certificate seal (a disc and its
// two ribbon tails) in front of its lower right corner: the disc covers the wall and the right tail
// runs down over the corner, so the page is cleared there whole at every weight.
{
  const c = [16.75, 15.5];
  const seal = circ(...c, 2.75);
  const tails = [line(polar(...c, 2.75, 115), [15.5, 21.75]), line(polar(...c, 2.75, 65), [19.25, 21.75])];
  addIcon('title-deed', ['escrituras', 'título de propiedad', 'escritura', 'title deed', 'deed', 'proof of ownership'], [LEASE_PAGE, line([8.25, 9.75], [13.5, 9.75]), line([8.25, 12.75], [10.75, 12.75])], {
    badge: { d: [seal, ...tails], knock: `${seal}${tails.map((t) => trace(t)).join('')}`, fill: { solid: [seal], wire: tails } },
  });
}

// ── Money ──
// Rent: a house (the house's construction) at upper left and two coins at lower right, in front of it.
{
  const R = house({ apex: [9.5, 2.75], half: 6.75, eaves: 1.75, base: 16.5, door: null, window: [8.3, 1.25] });
  const C = coins(11.75, 14.75, 9.5);
  addIcon('rent-payment', ['pagar renta', 'cobrar renta', 'mensualidad', 'rent', 'rent payment', 'pay rent'], [R.roof, R.walls, R.window], {
    badge: { d: C.d, knock: C.area, fill: C.fill },
    fill: { solid: [shut(R.roof), shut(R.walls)], cut: [R.window] },
  });
}
// Security deposit: the core key at the upper left and the two coins at the lower right, as rent's
// house and coins; the bow stands 3 clear of the coins. (Upright over the coins, the key left the
// canvas.)
{
  const K = keyAt([6.5, 11.25], 0.72);
  const C = coins(11.25, 14.75, 9.5);
  addIcon('security-deposit', ['depósito en garantía', 'depósito', 'garantía', 'security deposit', 'deposit'], [...K, ...C.d], {
    fill: { solid: [K[0], ...C.fill.solid], cut: [K[1], ...C.fill.cut], wire: K.slice(2) },
  });
}
// Condo fee: a smaller apartment block (its gable's slope, its r 0.3 windows) at the upper left and
// the two coins at its lower right, in front of it, as rent's house and coins. (The full-size block
// with the coins over its door read as a face.)
{
  const [x0, x1, base] = [3.25, 14.75, 18.75];
  const ax = (x0 + x1) / 2;
  const eave = 2.75 + ((x1 - x0) / 2) * (3.75 / 6.75);
  const body = roundpoly([[x0, base], [x0, eave], [ax, 2.75], [x1, eave], [x1, base]], [2.5, 1, 1.25, 1, 0]);
  const windows = [[6.75, 9], [11.25, 9], [6.75, 12.5], [11.25, 12.5], [6.75, 16]].map(([x, y]) => dot(x, y, 0.3));
  const C = coins(11.75, 14.75, 9.5);
  addIcon('condo-fee', ['cuota de mantenimiento', 'mantenimiento', 'cuota del condominio', 'condo fee', 'hoa fee'], [body, ...windows], {
    badge: { d: C.d, knock: C.area, fill: C.fill },
    fill: { solid: [body], cut: windows },
  });
}
// Price per area: formas' area mark (the L-shaped floor and its hatch) with a small price tag tied by
// a short string to the side of its tall arm, lying in the notch. (6.75 long on a 3 string, it took
// the drawing past QA's ink limit.)
{
  const A = formas.icons.area.d;
  const p0 = [13.25, 6.5];
  const [L, Hh, nose] = [5.75, 1.75, 1.75];
  const tag = roundpoly([p0, [p0[0] + nose, p0[1] - Hh], [p0[0] + L, p0[1] - Hh], [p0[0] + L, p0[1] + Hh], [p0[0] + nose, p0[1] + Hh]], [0.6, 0.6, 1, 1, 0.6]);
  const point = [p0[0] + 0.6 * Math.SQRT2 - 0.6, p0[1]];
  addIcon('area-price', ['precio por metro cuadrado', 'precio por m²', 'costo por superficie', 'price per square meter', 'price per area'], [...A, line([11, p0[1]], point), tag]);
}

// ── Property care ──
/** Wrench glyph at badge size: an open jaw (an arc whose opening faces up and right) and its handle. */
const WRENCH = (() => {
  const C = [18.25, 15.75];
  const jaw = arc(...C, 2.75, 5, 265).d;
  const handle = line(polar(...C, 2.75, 135), [14, 21]);
  return { d: [jaw, handle], knock: `${circ(...C, 2.75)}${trace(handle)}` };
})();
addIcon('maintenance-request', ['solicitud de mantenimiento', 'reparación', 'orden de trabajo', 'maintenance request', 'work order', 'repair'], HOUSE, { badge: { d: WRENCH.d, knock: WRENCH.knock } });
// Managed property: a small house resting over comercio's open hand.
{
  const M = house({ apex: [12, 3], half: 4.75, eaves: 1.25, base: 12.5, door: null, window: null });
  addIcon('managed-property', ['administración de inmuebles', 'cuidado de la propiedad', 'gestión', 'managed property', 'property care'], [M.roof, M.walls, ...HAND]);
}
// Utilities: the core bolt and lugares' droplet, side by side.
{
  const bolt = xf(nucleo.icons.bolt.d[0], 0.62, [12, 12], -5.1, 0);
  const drop = xf(lugares.icons.droplet.d[0], 0.6, [12, 12], 5.4, -0.9);
  addIcon('utilities', ['servicios', 'luz y agua', 'servicios incluidos', 'utilities', 'power and water'], [bolt, drop]);
}
/**
 * A leaf glyph for the corner: lugares' leaf (its lens, without the midrib that would close up),
 * scaled to lie along the badge's diagonal from (14, 20.5) to (20, 14.5), and a stem out of its foot.
 * It clears the status badges' circle as well (larger and reaching past it, it left a scrap of the
 * house's corner under it that came and went with the weight) and stays 3.5 from the roof's eave.
 */
const LEAF = (() => {
  const [lens] = lugares.icons.leaf.d;
  const L = xf(lens, 6 / 14.75, [5.5, 18.5], 8.5, 2);
  const stem = line([14, 20.5], [12.5, 22]);
  return { d: [L, stem], knock: `${RING}${L}${trace(stem)}`, fill: { solid: [L], wire: [stem] } };
})();
addIcon('eco-home', ['casa ecológica', 'sustentable', 'eficiencia energética', 'eco home', 'green home'], HOUSE, { badge: LEAF });
/**
 * A suitcase glyph for the corner: lugares' luggage (body and wheels, without its stripes) with a
 * trolley's pull handle, a T on top. (With a U handle on top, box and handle read as a padlock; and a
 * U wide and tall enough to keep its hole at bold ran into the round window or the roof.) It clears
 * the status badges' circle as well, so the house is cut as under any badge, and the T keeps 3.4
 * from the roof.
 */
const SUITCASE = (() => {
  const body = sq(14, 15.25, 5.5, 4.75, 1.5, BR);
  const handle = 'M16 13.25H18.5M17.25 13.25V15.25';
  const wheels = [line([15.5, 20], [15.5, 22]), line([18, 20], [18, 22])];
  const knock = `${RING}${body}${[line([16, 13.25], [18.5, 13.25]), line([17.25, 13.25], [17.25, 15.25]), ...wheels].map((d) => trace(d)).join('')}`;
  return { d: [body, handle, ...wheels], knock, fill: { solid: [body], wire: [handle, ...wheels] } };
})();
addIcon('vacation-rental', ['renta vacacional', 'renta temporal', 'airbnb', 'vacation rental', 'short-term rental'], HOUSE, { badge: SUITCASE });
/** A key glyph at badge size: a bow, the shaft at 45° and one tooth (5.3 clear of the door's knob, so the knob stays at every weight). */
const KEY_GLYPH = (() => {
  const c = [17, 19.25];
  const bow = circ(...c, 2);
  const shaft = line(polar(...c, 2, -45), [21.5, 14.75]);
  const tooth = line([20.25, 16], [21.67, 17.42]);
  return { d: [bow, shaft, tooth], knock: `${bow}${trace(shaft)}${trace(tooth)}`, fill: { solid: [bow], wire: [shaft, tooth] } };
})();
{
  const D = lugares.icons.door.d;
  addIcon('room-rental', ['renta de cuarto', 'habitación', 'cuarto en renta', 'room for rent', 'room rental'], D, { badge: KEY_GLYPH });
}

// ── Moving ──
// Moving boxes: two of comercio's isometric boxes (the core box's slope), a smaller one standing on
// the lid of the larger one; the top box is in front and the engine clears the lid's edges behind it. (Seen from the front, two stacked boxes were comercio's product bundle, and
// read as a lunch box.)
{
  const iso = (cx, top, w, h, k = 0.541) => {
    const wk = w * k;
    return { T: [cx, top], R: [cx + w, top + wk], C: [cx, top + 2 * wk], L: [cx - w, top + wk], Rb: [cx + w, top + wk + h], B: [cx, top + 2 * wk + h], Lb: [cx - w, top + wk + h] };
  };
  const toward = (a, b, k) => add(a, mul(unit(sub(b, a)), k));
  const cube = (P, r) => [roundpoly([P.T, P.R, P.Rb, P.B, P.Lb, P.L], r), line(toward(P.L, P.C, 0.3), P.C, toward(P.R, P.C, 0.3)), line(P.C, toward(P.B, P.C, 0.3))];
  // The lower box stands on 21.25. The upper one stands in the middle of its lid, its side corners on
  // the lid's back edges (so its clearance crosses them, at every weight) and its front corner 3.8 above
  // the lid's (its edges keep 3.35 from the lid's front edges: clear at bold)
  const lower = cube(iso(12, 21.25 - (2 * 8.5 * 0.541 + 5), 8.5, 5), 1.5);
  const upper = cube(iso(12, 12.45 - (2 * 5 * 0.541 + 4), 5, 4), 1.2);
  addIcon('moving-boxes', ['cajas de mudanza', 'mudanza', 'empacar', 'moving boxes', 'packing', 'moving'], lower, {
    badge: { d: upper, knock: upper[0], fill: { solid: [upper[0]], cut: upper.slice(1) } },
    fill: { solid: [lower[0]], cut: lower.slice(1) },
  });
}

// Moving truck: a pickup facing right, its cab and hood, the wheels 3 below the body (as the
// truck's), and two boxes stacked in its open bed, standing on the bed rail.
addIcon('moving-truck', ['camión de mudanza', 'mudanceros', 'flete', 'moving truck', 'movers'], [
  roundpoly([[2.75, 15.25], [2.75, 11], [12.25, 11], [12.25, 6.75], [16, 6.75], [18.75, 10.25], [21.25, 11.25], [21.25, 15.25]], [1.5, 0.75, 0, 1, 1, 0.75, 1, 0]),
  circ(6.75, 20, 1.75),
  circ(17.25, 20, 1.75),
  roundline([[3.75, 11], [3.75, 7.75], [9.25, 7.75], [9.25, 11]], [0, 1, 1, 0]),
  roundline([[4.75, 7.75], [4.75, 3.75], [8.75, 3.75], [8.75, 7.75]], [0, 1, 1, 0]),
]);

// Move in, move out: the house and navegacion's thick arrow (half size) passing in front of its
// lower left wall into the doorway, or out of it through the lower right wall.
const THICK = [[3.25, 9.25], [11.75, 9.25], [11.75, 4.5], [20.75, 12], [11.75, 19.5], [11.75, 14.75], [3.25, 14.75]];
const thickAt = (tip, s) => roundpoly(THICK.map(([x, y]) => [tip[0] + (x - 20.75) * s, tip[1] + (y - 12) * s]), [1.25, 0.75, 1.25, 1.75, 1.25, 0.75, 1.25].map((r) => r * Math.max(s, 0.6)));
{
  const inArrow = thickAt([14.25, 17.5], 0.5);
  // Leaving, the tail lies over the doorway: 1 lower than the way in, its clearance takes the door and
  // the floor under it whole at every weight (higher, it left a hairline of floor under the tail)
  const outArrow = thickAt([20, 18.5], 0.5);
  addIcon('move-in', ['mudarse', 'entrar a vivir', 'llegada', 'move in', 'moving in'], HOUSE, { badge: { d: [inArrow], knock: inArrow, fill: { solid: [inArrow] } } });
  addIcon('move-out', ['salir de la casa', 'desocupar', 'entrega del inmueble', 'move out', 'moving out'], HOUSE, { badge: { d: [outArrow], knock: outArrow, fill: { solid: [outArrow] } } });
}

// Relocation: two small homes (the house's construction) and an arc arrow from the first to the second.
{
  const A = house({ apex: [6.25, 13], half: 3.75, eaves: 1, base: 20.75, door: null, window: null });
  const B = house({ apex: [17.75, 13], half: 3.75, eaves: 1, base: 20.75, door: null, window: null });
  const [p, q] = [[6.25, 9.75], [17.75, 9.75]];
  const sag = 5.5;
  const r = ((q[0] - p[0]) ** 2 / 4 + sag * sag) / (2 * sag);
  const c = [12, p[1] - sag + r];
  const a1 = (Math.atan2(q[1] - c[1], q[0] - c[0]) * 180) / Math.PI;
  const a0 = 180 - a1;
  const path = arc(...c, r, a0, a1 + 360);
  // The head turned 8° off the tangent, as the engine's sync arrows: on so tight an arc its inner arm
  // ran along the arc and the sliver between them closed at bold
  addIcon('relocation', ['cambio de domicilio', 'reubicación', 'mudanza', 'relocation', 'change of address'], [A.roof, A.walls, B.roof, B.walls, path.d, head(path.end, rot(path.tangent, [0, 0], -8), 3.4)]);
}

// ── Amenities ──
const WAVE = (y, x0 = 3, n = 6, h = 3, a = 1) => {
  let d = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const sg = i % 2 ? 1 : -1;
    const x = x0 + i * h;
    d += `C${pt([x + h / 3, y + (sg * 4 * a) / 3])} ${pt([x + (2 * h) / 3, y + (sg * 4 * a) / 3])} ${pt([x + h, y])}`;
  }
  return d;
};
// Pool: a pool ladder, its two rails curving over the deck, a rung, dipping into two of lugares' waves.
addIcon('swimming-pool', ['alberca', 'piscina', 'amenidades', 'swimming pool', 'pool'], [
  'M5.75 9V7.25A2.25 2.25 0 0 1 10.25 7.25V12.75',
  'M18.25 9V7.25A2.25 2.25 0 0 0 13.75 7.25V12.75',
  line([10.25, 10], [13.75, 10]),
  WAVE(16.75),
  WAVE(20.75),
]);
// Elevator: the cabin (square bottom-right corner) split by its door seam, the call arrows above it.
addIcon('elevator', ['elevador', 'ascensor', 'amenidades', 'elevator', 'lift'], [
  sq(5.25, 9.25, 13.5, 12, 3, BR),
  line([12, 9.25], [12, 21.25]),
  roundpoly([[8.5, 2.75], [10.75, 6], [6.25, 6]], 0.6),
  roundpoly([[13.25, 2.75], [17.75, 2.75], [15.5, 6]], 0.6),
]);
// Laundry: a washer's front, its control strip with a display and the round door.
addIcon('laundry', ['lavandería', 'lavadora', 'cuarto de lavado', 'laundry', 'washer'], [
  sq(4.75, 2.75, 14.5, 18.5, 3.5, BR),
  line([4.75, 8.75], [19.25, 8.75]),
  line([11.75, 5.75], [15.75, 5.75]),
  circ(12, 15.25, 3.5),
]);
// Balcony: a French door (two leaves, their meeting line down the middle) behind a railing of
// balusters on its slab; the railing is in front and clears the door behind it. (A narrow doorway
// with a round top read as a padlock's shackle over the railing, or a basket's handle.) Filled, the
// leaves are solid and the line between them is knocked out through the top, so they stand apart
// at every weight.
{
  const rail = line([3.25, 12.75], [20.75, 12.75]);
  const balusters = [3.25, 7.625, 12, 16.375, 20.75].map((x) => line([x, 12.75], [x, 18.75]));
  const slab = line([2.75, 18.75], [21.25, 18.75]);
  const door = roundline([[6.25, 18.75], [6.25, 2.75], [17.75, 2.75], [17.75, 18.75]], [0, 1.5, 1.5, 0]);
  addIcon('balcony', ['balcón', 'terraza', 'barandal', 'balcony', 'railing'], [door, line([12, 2.75], [12, 12.75])], {
    badge: { d: [rail, ...balusters, slab], knock: sq(3.25, 12.75, 17.5, 6, 0) },
    fill: { solid: [shut(door)], cut: [line([12, 1.25], [12, 14])] },
  });
}
// Terrace: a patio umbrella, its shallow canopy scalloped along the hem as lugares' umbrella, over a
// small table (its top and two legs) on the deck; the pole runs through the table. (With a flat
// triangle for a canopy it read as a roof, and with a bare bar for a table, as a character.)
const TERRACE = (() => {
  const canopy = 'M2.75 9.75A10.5 10.5 0 0 1 21.25 9.75A3.08 3.08 0 0 0 15.08 9.75A3.08 3.08 0 0 0 8.92 9.75A3.08 3.08 0 0 0 2.75 9.75Z';
  const pole = line([12, 9.75], [12, 21]);
  const table = roundline([[7.75, 21], [7.75, 15.75], [16.25, 15.75], [16.25, 21]], [0, 0.75, 0.75, 0]);
  const deck = line([2.75, 21], [21.25, 21]);
  return { d: [canopy, pole, table, deck], fill: { solid: [canopy], wire: [pole, table, deck] } };
})();
addIcon('terrace', ['terraza', 'patio', 'sombrilla', 'área social', 'terrace', 'patio'], TERRACE.d, { fill: TERRACE.fill });
// Roof garden: a building (the office building's body, its r 0.3 windows and door, wider and lower)
// with lugares' tree (its crown and trunk: the branch is under 2 at this size) growing on its flat
// roof. (Narrower, it read as a test tube; with a railing on the roof, as a cup or a keyboard.)
{
  const roof = 10.25;
  const body = sq(4.75, roof, 14.5, 11, 2.5, BR);
  const windows = [13.5, 16.75].flatMap((y) => [8.5, 12, 15.5].map((x) => dot(x, y, 0.3)));
  const door = roundline([[10.25, 21.25], [10.25, 19.25], [13.75, 19.25], [13.75, 21.25]], [0, 1, 1, 0]);
  const [crown, trunk] = lugares.icons.tree.d.slice(0, 2).map((d) => xf(d, 0.42, [12, 21.25], 0, roof - 21.25));
  addIcon('roof-garden', ['roof garden', 'azotea verde', 'jardín en la azotea', 'roof terrace', 'rooftop garden'], [body, ...windows, door, crown, trunk], {
    fill: { solid: [body, crown], cut: [...windows, door], wire: [trunk] },
  });
}
// Carport: a car seen from the front under a flat roof on two posts.
addIcon('carport', ['cochera', 'estacionamiento techado', 'garaje', 'carport', 'covered parking'], [
  roundline([[4.25, 21.25], [4.25, 4.75], [19.75, 4.75], [19.75, 21.25]], [0, 0, 0, 0]),
  line([2.75, 4.75], [21.25, 4.75]),
  sq(7, 13.25, 10, 6, 1.75),
  roundline([[8.25, 13.25], [9.5, 9.75], [14.5, 9.75], [15.75, 13.25]], [0, 1, 1, 0]),
  line([8.75, 19.25], [8.75, 21.25]),
  line([15.25, 19.25], [15.25, 21.25]),
  dot(10, 16.25),
  dot(14, 16.25),
]);
// Parking space: from above, a car between the two lines of its stall.
addIcon('parking-space', ['cajón de estacionamiento', 'estacionamiento', 'lugar de estacionamiento', 'parking space', 'parking spot'], [
  line([3.75, 3.25], [3.75, 20.75]),
  line([20.25, 3.25], [20.25, 20.75]),
  sq(7.5, 3.25, 9, 17.5, 3.5),
  'M7.5 9.25Q12 7.25 16.5 9.25',
  line([7.5, 16], [16.5, 16]),
]);

// ── Parts of a home ──
// Basement: a small house on the ground line and a room outline under the ground.
{
  const B = hut([12, 3], 6.25, 1.75, 13.5);
  addIcon('basement', ['sótano', 'bodega subterránea', 'planta baja', 'basement', 'cellar'], [
    line([2.75, 13.5], [21.25, 13.5]),
    B.roof,
    ...B.walls,
    roundline([[10.75, 13.5], [10.75, 10.75], [13.25, 10.75], [13.25, 13.5]], [0, 1, 1, 0]),
    sq(7.5, 16.5, 9, 4.75, 1.5, BR),
  ]);
  // Filled: the house (its roof, and its body closed along the ground) and the room below solid, the
  // door cut out, the ground a line
  const d = icons.basement.d;
  icons.basement.fill = { solid: [shut(B.roof), `M${pt([B.xl, B.roofAt(B.xl)])}V13.5H${f(B.xr)}V${f(B.roofAt(B.xr))}Z`, d[5]], cut: [d[4]], wire: [d[0]] };
}
// Attic: the house with its gable closed off by a floor, the window up in it, and a pull-down
// ladder (two rails, two rungs) dropping from the floor into the house.
{
  const rails = [line([10, 13.25], [12.75, 20.75]), line([13.25, 13.25], [16, 20.75])];
  const at = (y) => 10 + ((y - 13.25) * 2.75) / 7.5;
  addIcon('attic', ['ático', 'buhardilla', 'desván', 'tapanco', 'attic', 'loft'], [H.roof, H.walls, line([H.xl, 13.25], [H.xr, 13.25]), circ(12, 9, 1.25), ...rails, ...[15.75, 18.5].map((y) => line([at(y), y], [at(y) + 3.25, y]))]);
}
// Floor level: a building's section, its floors divided by two floor lines, and a chevron at its
// left pointing at the middle floor.
addIcon('floor-level', ['piso', 'nivel', 'planta', 'número de piso', 'floor', 'floor level'], [
  sq(8.75, 2.75, 12, 18.5, 2.5, BR),
  line([8.75, 8.9], [20.75, 8.9]),
  line([8.75, 15.1], [20.75, 15.1]),
  line([3, 9.25], [5.75, 12], [3, 14.75]),
]);
// Room: one room from above, a gap in its wall for the door, its leaf and its quarter-circle swing.
addIcon('room', ['habitación', 'cuarto', 'ambientes', 'recámara', 'room', 'rooms'], [
  roundline([[13.25, 20.75], [20.75, 20.75], [20.75, 3.25], [3.25, 3.25], [3.25, 20.75], [7.25, 20.75]], [0, 0, 2.5, 2.5, 2.5, 0]),
  line([13.25, 20.75], [13.25, 14.75]),
  arc(13.25, 20.75, 6, 180, 270).d,
]);
// Dollhouse view: the whole house as a model, in isometric (30°): its long front wall, the gable end
// and the front slope of the roof, the ridge running back. (Cut open, back walls, floor and slab read
// as an open crate: the gable was lost among the edges.) Filled, the edges are knocked out.
{
  const iso3 = (X, Y, Z) => [10.5 + (X - Y) * 0.866, 11.4 + (X + Y) * 0.5 - Z];
  const [a, b, h, g] = [11, 7.5, 6, 4];
  const hull = roundpoly([iso3(0, b, 0), iso3(a, b, 0), iso3(a, 0, 0), iso3(a, 0, h), iso3(a, b / 2, h + g), iso3(0, b / 2, h + g), iso3(0, b, h)], 0.75);
  const eaves = line(iso3(0, b, h), iso3(a, b, h), iso3(a, b / 2, h + g));
  const corner = line(iso3(a, b, 0), iso3(a, b, h));
  addIcon('dollhouse-view', ['vista de casa de muñecas', 'modelo 3d', 'corte', 'dollhouse view', '3d model'], [hull, eaves, corner], { fill: { solid: [hull], cut: [eaves, corner] } });
}

// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d`: `solid` is filled (closed shapes only; `close` closes the open outlines along
// their chord, which lands under a roof or on a floor, a ground or a cuff), `cut` knocked out at
// stroke width, `lines` stays a line with a clearance of paper, `wire` stays a line attached to the
// fill. Icons whose fill needs shapes of their own (a body closed along its walls, a cut that runs
// past the floor) set it where they are drawn.
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const FILL = {
  'house-pin': { solid: [0, 1], cut: [2], close: true },
  'house-key': { solid: [0], cut: [1], wire: [2, 3, 4] },
  'two-story-house': { solid: [0, 1], cut: [2, 3, 4], close: true },
  apartment: { solid: [0], cut: range(1, 8) },
  'mixed-use': { solid: [0], cut: range(1, 6) },
  // The unit closes along the ground; the door's outline and its slats are knocked out, so the
  // opening under the door is solid: dark, as in the drawing
  'storage-unit': { solid: [0], cut: [1, 2, 3], close: true },
  properties: { solid: [0, 1], close: true },
  'gated-community': { solid: [0, 1, 2, 3], close: true },
  waterfront: { solid: [0, 1], cut: [2], lines: [3, 4], close: true },
  'sun-exposure': { solid: [0], lines: range(1, 6) },
  yard: { solid: [0, 1, 4], cut: [2], wire: [3, 5], close: true },
  listing: { solid: [0], cut: [1, 2, 3] },
  'virtual-tour': { solid: [0, 1], close: true },
  'floor-plan': { solid: [0], cut: range(1, 6) },
  'house-compare': { solid: [0, 1, 2, 3], lines: [4, 5, 6], close: true },
  // The hand closes along the edge of its cuff, as comercio's
  'key-handover': { solid: [0, 5, 6], cut: [1], wire: [2, 3, 4], close: true },
  'key-return': { solid: [0], cut: [1], wire: [2, 3, 4, 5, 6] },
  lockbox: { solid: [0], wire: [1], cut: [2, 3, 4, 5] },
  'real-estate-agent': { solid: [0, 1] },
  landlord: { solid: [0, 1] },
  // The roof over the person stays a line, apart from the fill
  tenant: { solid: [1, 2], lines: [0] },
  residents: { solid: [1, 2], lines: [0] },
  'title-deed': { solid: [0], cut: [1, 2] },
  // formas' area fill (the floor solid, its hatch knocked out) and the tag solid on its string
  'area-price': { solid: [0, 5], cut: [1, 2, 3], wire: [4] },
  'managed-property': { solid: [0, 1, 2, 3], close: true },
  utilities: { solid: [0, 1] },
  // lugares' door: the leaf closes along the floor
  'room-rental': { solid: [0], wire: [1], cut: [2], close: true },
  // The arrow stands apart from the homes; attached to each other, its arc and head are one line
  relocation: { solid: [0, 1, 2, 3], wire: [4, 5], close: true },
  elevator: { solid: [0, 2, 3], cut: [1] },
  laundry: { solid: [0], cut: [1, 2, 3] },
  'parking-space': { solid: [2], cut: [3, 4], lines: [0, 1] },
  attic: { solid: [0, 1], cut: range(2, 8), close: true },
  'floor-level': { solid: [0], cut: [1, 2], lines: [3] },
};
for (const name of ['for-sale-sign', 'for-sale-sign-check', 'for-sale-sign-clock']) FILL[name] = { solid: [3], wire: [0, 1, 2] };
for (const name of ['lease', 'lease-expiring', 'lease-application']) FILL[name] = { solid: [0], cut: [1, 2, 3] };
// Under the sync badge, whose arrowheads reach past its circle, the last line's stub sat in the
// clearance's crook and the fill had no clean interpolation between weights: the fill keeps the
// two lines that run into the clearance whole
FILL['lease-renewal'] = { solid: [0], cut: [1, 2] };
for (const name of ['house-price', 'house-price-up', 'house-price-down']) FILL[name] = { solid: [0, 1, 4], cut: [2, 5], wire: [3], close: true };
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid).map(spec.close ? shut : (d) => d) };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}
// The house under a badge (see HOUSE_BADGED_FILL), and with its door open
for (const name of [...Object.keys(HOUSE_BADGES), 'maintenance-request', 'eco-home', 'vacation-rental', 'move-in', 'move-out']) icons[name].fill = HOUSE_BADGED_FILL;
icons['open-house'].fill = HOUSE_FILL;
// Carport: the car filled as lugares' (the cabin closed against the body and separated from it by a
// knocked-out roofline, 1.75 inside its corners; the lights knocked out); the carport and the tires
// stay lines
{
  const d = icons.carport.d;
  icons.carport.fill = { solid: [d[2], shut(d[3])], cut: [line([10, 13.25], [14, 13.25]), d[6], d[7]], wire: [d[0], d[1], d[4], d[5]] };
}
// Moving truck: the body, the wheels and the boxes filled (each box closed along what it stands on),
// the boxes separated from the bed and from each other by their bottoms, knocked out from leg to leg
// (as comercio's product bundle)
{
  const d = icons['moving-truck'].d;
  icons['moving-truck'].fill = { solid: [d[0], d[1], d[2], shut(d[3]), shut(d[4])], cut: [line([3.75, 11], [9.25, 11]), line([4.75, 7.75], [8.75, 7.75])] };
}
// Only open lines (or a dashed outline): their filled version is the outline itself
for (const name of ['house-vacant', 'swimming-pool', 'room']) icons[name].fill = false;

// ── Named parts ───────────────────────────────────────────────────────────────────────────────
// Every icon with a badge or a motion of its own, and those whose pieces have a meaning of their own
for (const name of [...Object.keys(HOUSE_BADGES), 'open-house', 'maintenance-request', 'eco-home', 'vacation-rental', 'move-in', 'move-out']) icons[name].parts = HOUSE_PARTS;
const SIGN_PARTS = { post: [0], chains: [1, 2], sign: [3] };
const LEASE_PARTS = { page: [0], text: [1, 2, 3] };
const PRICE_PARTS = { roof: [0], walls: [1], window: [2], tag: [3, 4, 5] };
const PARTS = {
  'house-pin': { roof: [0], walls: [1], hole: [2] },
  'house-key': { bow: [0, 1], shaft: [2, 3, 4] },
  'two-story-house': { roof: [0], walls: [1], floor: [2], door: [3], window: [4] },
  'mixed-use': { tower: [0], windows: range(1, 6) },
  properties: { back: [0, 1] },
  'gated-community': { homes: [0, 1, 2, 3] },
  'modern-house': { roof: [0], walls: [1], door: [2], window: [3] },
  subdivision: { parcel: [0], lots: [1, 2] },
  'off-plan': { built: [0, 8, 9, 10], plan: range(1, 8) },
  gatehouse: { booth: [0, 1, 2], boom: [3, 4, 5] },
  'sun-exposure': { sun: [0], rays: range(1, 6) },
  'for-sale-sign': SIGN_PARTS,
  'for-sale-sign-check': SIGN_PARTS,
  'for-sale-sign-clock': SIGN_PARTS,
  'house-price': PRICE_PARTS,
  'house-price-up': PRICE_PARTS,
  'house-price-down': PRICE_PARTS,
  'virtual-tour': { roof: [0], walls: [1] },
  'key-ring': { ring: [0], keys: range(1, 9) },
  'key-tag': { key: [0, 1, 2, 3], string: [4], tag: [5, 6] },
  'key-handover': { key: [0, 1, 2, 3, 4], cuff: [5], hand: [6] },
  'key-return': { key: [0, 1, 2, 3, 4], arrow: [5, 6] },
  'key-fob': { fob: [0], hole: [1], waves: [2, 3] },
  lockbox: { box: [0], shackle: [1], keypad: [2, 3, 4, 5] },
  'real-estate-agent': { person: [0, 1] },
  landlord: { person: [0, 1] },
  tenant: { roof: [0], person: [1, 2] },
  residents: { roof: [0], back: [1, 2] },
  lease: LEASE_PARTS,
  'lease-renewal': LEASE_PARTS,
  'lease-expiring': LEASE_PARTS,
  'lease-application': LEASE_PARTS,
  'title-deed': { page: [0], text: [1, 2] },
  'rent-payment': { roof: [0], walls: [1], window: [2] },
  'security-deposit': { key: [0, 1, 2, 3, 4], coins: [5, 6] },
  'condo-fee': { building: [0], windows: range(1, 6) },
  'area-price': { area: [0, 1, 2, 3], tag: [4, 5] },
  'managed-property': { roof: [0], walls: [1], cuff: [2], hand: [3] },
  utilities: { bolt: [0], drop: [1] },
  'room-rental': { door: [0], floor: [1], knob: [2] },
  'moving-boxes': { box: [0, 1, 2] },
  'moving-truck': { body: [0], wheels: [1, 2], boxes: [3, 4] },
  relocation: { homes: [0, 1, 2, 3], arrow: [4, 5] },
  'swimming-pool': { ladder: [0, 1, 2], water: [3, 4] },
  elevator: { cabin: [0], seam: [1], arrows: [2, 3] },
  laundry: { body: [0], panel: [1, 2], door: [3] },
  balcony: { door: [0, 1] },
  terrace: { canopy: [0], pole: [1], table: [2], deck: [3] },
  'floor-level': { building: [0], floors: [1, 2], pointer: [3] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
const MOTION = {
  'house-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'house-heart': { effect: 'beat', parts: ['badge'], origin: [17.25, 17.5] },
  'house-star': { effect: 'beat', parts: ['badge'], origin: BC },
  'house-gear': { effect: 'spin', parts: ['badge'], origin: BC },
  'house-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'house-question': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'house-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'house-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'house-pin': { effect: 'bounce', vector: [0, -2.5] },
  // The key turns on its bow, as the core key
  'house-key': { effect: 'wiggle', origin: [7.88, 15.75] },
  'key-ring': { effect: 'wiggle', origin: [7.25, 7.25] },
  // The board swings from the post's arm; the tag from the bow; the price tag from the eave
  'for-sale-sign': { effect: 'ring', parts: ['chains', 'sign'], origin: [13.75, 3.25] },
  'key-tag': { effect: 'ring', parts: ['string', 'tag'], origin: [6.75, 9.01] },
  'house-price': { effect: 'ring', parts: ['tag'], origin: [10.5, 8.32] },
  // The boom lifts from its root on the booth's wall
  gatehouse: { effect: 'wiggle', parts: ['boom'], origin: [12.25, 15.5] },
  'key-handover': { effect: 'bounce', parts: ['key'], vector: [0, -1.5] },
  'for-sale-sign-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'lease-renewal': { effect: 'spin', parts: ['badge'], origin: BC },
  'lease-expiring': { effect: 'spin', parts: ['badge'], origin: BC },
  'lease-application': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'move-in': { effect: 'slide', parts: ['badge'], vector: [2, 0] },
  'move-out': { effect: 'slide', parts: ['badge'], vector: [2, 0] },
  'moving-truck': { effect: 'slide', vector: [2.5, 0] },
  'floor-level': { effect: 'slide', parts: ['pointer'], vector: [1.5, 0] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Mirroring (right to left) ─────────────────────────────────────────────────────────────────
// What moves one way: in and out of the house, from one home to the next, the keys handed back, the
// truck (as comercio's), the pointer at a floor
for (const name of ['move-in', 'move-out', 'relocation', 'key-return', 'moving-truck', 'floor-level']) icons[name].mirror = true;

export default { category: 'bienes-raices', label: 'Bienes raíces', icons };
