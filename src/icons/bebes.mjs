// Bebés y niños (babies and kids): the baby, feeding, sleep and the nursery, diapers and the bath,
// outings (strollers, car seats, carriers), child safety, pregnancy and growth. Everything is
// computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md. One baby for the whole
// family: a round head with a curl falling from its crown, its features set low as a baby's are
// (comunicacion's faces, the same dots), in two sizes; the figures that crawl, walk or lie on their
// tummy are comunicacion's person's proportions with a larger, plain head. The stroller, the car
// seat and the diaper are one base each, and every badge is the engine's.
import { arc, badge, circ, dot, f, flipPath, halfChord, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper } from '../../engine/variants.mjs';

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
/** Just the `A…` segment of an arc, to chain it inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');
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


/**
 * Two circles and the tangents between them, the hull of both (c1 the larger): the swaddle's
 * cocoon. Returns its path and the tangent points (A on the right of the axis c1 → c2, B on the left).
 */
function hull(c1, r1, c2, r2) {
  const th = (Math.atan2(c2[1] - c1[1], c2[0] - c1[0]) * 180) / Math.PI;
  const b = (Math.acos((r1 - r2) / len(sub(c2, c1))) * 180) / Math.PI;
  const [A1, B1, A2, B2] = [polar(...c1, r1, th - b), polar(...c1, r1, th + b), polar(...c2, r2, th - b), polar(...c2, r2, th + b)];
  return { d: `M${pt(B1)}A${f(r1)} ${f(r1)} 0 1 1 ${pt(A1)}L${pt(A2)}A${f(r2)} ${f(r2)} 0 0 1 ${pt(B2)}Z`, A1, B1, A2, B2 };
}

/** Crescent moon: the disc (c, R) minus the one (ic, r), as lugares' moon. */
function moon(c, R, ic, r) {
  const [dx, dy] = sub(ic, c);
  const D = Math.hypot(dx, dy);
  const a = (D * D + R * R - r * r) / (2 * D);
  const h = Math.sqrt(R * R - a * a);
  const m = [c[0] + (a * dx) / D, c[1] + (a * dy) / D];
  const p = [m[0] + (h * dy) / D, m[1] - (h * dx) / D];
  const q = [m[0] - (h * dy) / D, m[1] + (h * dx) / D];
  return `M${pt(p)}A${f(R)} ${f(R)} 0 1 0 ${pt(q)}A${f(r)} ${f(r)} 0 0 1 ${pt(p)}Z`;
}

// ── The baby ──────────────────────────────────────────────────────────────────────────────────
// The head is the circle keyline; the curl falls from the crown, swings right and turns back on
// itself (in the r 9 head's units, from its center); the eyes are comunicacion's dots, set at the
// middle of the face, and the smile below them. The dots keep their size at every scale, so the
// face is placed rather than scaled: every point of the curl stands 3.65 from the eyes' centers
// and the smile's ends 3.6 from them (2.85 between the strokes, apart at every weight), the ends
// 2.95 inside the head, and the curl leaves the head steadily from the crown and stays 2.5 inside
// it (so it never welds to the head at bold). It comes in two sizes, each solved for those
// clearances: the full face (r 9) and the small one (r 7: beside a badge, even the padlock, whose
// cutout reaches farther; two at once; under a roof).
const CURL = [[0, -9], [3, -8.5], [3.75, -4.75], [1.25, -3.75], [0.25, -3.25], [-1, -3.75], [-0.9, -5.1]];
const FACE = { 9: { ex: 3.25, ey: 0.25, sr: 2.75 }, 7: { ex: 3.2, ey: -0.2, sr: 2.5 } };
/** The baby's face at `c`, radius 9 or 7: { head, curl, eyes, smile, d }. */
function baby([cx, cy] = [12, 12], r = 9) {
  const { ex, ey, sr } = FACE[r];
  const k = (r / 9) * 0.95;
  const c = CURL.map(([x, y]) => [cx + x * k, cy - r + (y + 9) * k]);
  const curl = `M${pt(c[0])}C${pt(c[1])} ${pt(c[2])} ${pt(c[3])}C${pt(c[4])} ${pt(c[5])} ${pt(c[6])}`;
  const head = circ(cx, cy, r);
  const eyes = [dot(cx - ex, cy + ey), dot(cx + ex, cy + ey)];
  const sy = ey + Math.sqrt(3.6 ** 2 - (ex - sr * Math.cos(Math.PI / 6)) ** 2) - sr / 2;
  const smile = arc(cx, cy + sy, sr, 30, 150).d;
  return { head, curl, eyes, smile, d: [head, curl, ...eyes, smile] };
}
// One face for the whole family, in these two sizes: under r 7 the curl welds to the head at heavy
// weights and the features crowd, so a smaller face isn't drawn (a face reduced to a ring and a
// smile, in the draft's swaddle and carrier, read as a pin and a tub). A figure's head, in profile or
// beside an adult, is the plain circle, as the core person's.

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const FACE_PARTS = { head: [0], curl: [1], eyes: [2, 3], mouth: [4] };

const BABY = baby();
add('baby', ['bebé', 'niño', 'infante', 'recién nacido', 'baby', 'infant', 'child'], BABY.d);
// With a badge: the small face, moved up and to the left as comunicacion's reaction-add, so its right
// eye and its smile stay clear of the badge's cutout (the padlock's too) at every weight
const BABY_S = baby([8.75, 8.75], 7);
add('baby-plus', ['agregar bebé', 'nuevo perfil', 'agregar hijo', 'add baby', 'add child', 'new profile'], BABY_S.d, { badge: badge('plus') });
add('baby-lock', ['bloqueo infantil', 'seguro para niños', 'protección infantil', 'child lock', 'child safety', 'kid lock'], BABY_S.d, { badge: badge('lock') });
for (const name of ['baby', 'baby-plus', 'baby-lock']) {
  FILL[name] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS[name] = FACE_PARTS;
}

// Crying: the same head and curl, the eyes squeezed shut in two chevrons and the mouth open in a
// wail, round on top and flat below. (A tear under one eye, beside an oval mouth, read as the
// letters "o a"; the squeezed eyes and the wail say it on their own.)
{
  const eyes = [line([7.5, 10.25], [9.75, 11.75], [7.5, 13.25]), line([16.5, 10.25], [14.25, 11.75], [16.5, 13.25])];
  const mouth = `M9.5 18.25A2.5 2.5 0 0 1 14.5 18.25Z`;
  add('baby-crying', ['bebé llorando', 'llanto', 'detección de llanto', 'baby crying', 'cry', 'fussy'], [BABY.head, BABY.curl, ...eyes, mouth]);
  FILL['baby-crying'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['baby-crying'] = FACE_PARTS;
}

// Swaddled: the small face in front (a piece on top: the engine clears the wrap behind its head) and
// the bundle leaving it toward the bottom right, tapering to a round foot, one fold of the blanket
// across it. (Upright, a face inside a hood that narrowed to a point read as a map pin.)
/** The face as a piece on top of what lies behind it. */
const faceOnTop = (fc) => ({ d: fc.d, knock: fc.head, fill: { solid: [fc.head], cut: [fc.curl, ...fc.eyes, fc.smile] } });
{
  const wrap = hull([11, 11], 6.5, [16, 16], 5.25);
  const fold = line(lerp(wrap.A1, wrap.A2, 0.75), lerp(wrap.B1, wrap.B2, 1.05));
  add('baby-swaddled', ['bebé envuelto', 'recién nacido', 'nacimiento', 'cobija', 'swaddled baby', 'newborn', 'birth'], [wrap.d, fold], { badge: faceOnTop(BABY_S) });
  FILL['baby-swaddled'] = { solid: [0], cut: [1] };
  PARTS['baby-swaddled'] = { wrap: [0, 1] };
}
// Asleep: the small face with its eyes closed in two low arcs and its mouth a small open dot, as a
// sleeping face's, under a crescent moon. Closed eyes leave no room for the smile: their ends keep
// 2.9 from the curl, the head and the mouth. (The swaddle lying on its side, its face a ring, read
// as a snail.)
{
  const [cx, cy] = [9.25, 14.75];
  const fc = baby([cx, cy], 7);
  const eyes = [-1, 1].map((s) => arc(cx + s * 2.9, cy - 0.5, 1.2, 15, 165).d);
  const moonD = moon([18.25, 5.5], 3.25, [20.1, 3.85], 2.7);
  add('baby-sleep', ['bebé dormido', 'siesta', 'sueño', 'modo noche', 'baby asleep', 'nap', 'sleep'], [fc.head, fc.curl, ...eyes, dot(cx, cy + 3.4), moonD]);
  FILL['baby-sleep'] = { solid: [0, 5], cut: [1, 2, 3, 4] };
  PARTS['baby-sleep'] = { ...FACE_PARTS, moon: [5] };
}

// ── Figures: the baby's head on a small body, in profile, facing right ────────────────────────
// The head is the plain circle, as the core person's, 2.5 to 2.6 from the body; the limbs are single
// strokes that start on the body's outline.
// Crawling: the torso level on all fours, the big head held up ahead of the shoulders (2.6 apart,
// near the core person's 2.45 from head to shoulders, so it reads as one figure), the arm straight
// down to the hand and the leg folded under it, the knee on the floor and the shin back along it.
// (A dome on straight legs read as a table; the head far from it, as a ball.)
{
  const [hip, sh] = [[5, 13.5], [10.75, 12.75]];
  const body = hull(sh, 2.75, hip, 2.25).d;
  const head = circ(...polar(...sh, 2.75 + 2.6 + 3.5, -35), 3.5);
  const arm = line(polar(...sh, 2.75, 75), [12.75, 20.75]);
  const leg = roundline([polar(...hip, 2.25, 90), [6.25, 20.75], [2.75, 20.75]], [0, 0.75, 0]);
  add('baby-crawling', ['gatear', 'bebé gateando', 'hito', 'desarrollo', 'crawling', 'milestone', 'crawl'], [head, body, arm, leg]);
  FILL['baby-crawling'] = { solid: [0, 1], wire: [2, 3] };
  PARTS['baby-crawling'] = { head: [0], body: [1], limbs: [2, 3] };
}

// Tummy time: the floor, the body lying along it, the chest propped up on the arm and the big head
// raised ahead of it, 2.6 from the chest as the crawling baby's. (The head far from a tilted body,
// the legs kicked up, read as a seesaw and a ball.)
{
  const floor = hl(20.75, 2.75, 21.25);
  const chest = [11.5, 15];
  const body = hull(chest, 2.75, [4.75, 18.25], 2.25).d;
  const head = circ(...polar(...chest, 2.75 + 2.6 + 3.5, -45), 3.5);
  const arm = line(polar(...chest, 2.75, 60), [14, 20.75]);
  add('tummy-time', ['tiempo boca abajo', 'boca abajo', 'actividad', 'estimulación', 'tummy time', 'prone', 'activity'], [floor, body, head, arm]);
  FILL['tummy-time'] = { solid: [1, 2], wire: [0, 3] };
  PARTS['tummy-time'] = { floor: [0], body: [1], head: [2], arm: [3] };
}

// First steps: the head big and high, the body upright under it, both arms held out and up for
// balance and the front knee bent in the step
{
  const head = circ(12, 6.5, 3.5);
  const [c1, c2] = [[11.75, 14.75], [11.5, 15.5]];
  const body = hull(c1, 2.25, c2, 2.25);
  const arms = [line(polar(...c1, 2.25, -20), [17.75, 11.5]), line(polar(...c1, 2.25, 200), [5.75, 11.5])];
  const legs = [roundline([polar(...c2, 2.25, 55), [14.75, 19.25], [14.5, 21.25]], [0, 0.6, 0]), line(polar(...c2, 2.25, 125), [8.75, 21.25])];
  add('baby-walking', ['primeros pasos', 'caminar', 'bebé caminando', 'hito', 'first steps', 'walking', 'toddler'], [head, body.d, ...arms, ...legs]);
  FILL['baby-walking'] = { solid: [0, 1], wire: [2, 3, 4, 5] };
  PARTS['baby-walking'] = { head: [0], body: [1], arms: [2, 3], legs: [4, 5] };
}

// Footprints: two small soles side by side, the ball wide, the arch drawn in on the inner side and
// the heel round, and three toes in an arc above each
{
  // The left foot (its arch to the right); the right one is its mirror
  const sole = (cx, m = 1) => {
    const P = (x, y) => pt([cx + m * x, y]);
    return `M${P(0.5, 10)}C${P(3.25, 10)} ${P(3.25, 13)} ${P(2, 15)}C${P(1.25, 16.25)} ${P(1.75, 17.5)} ${P(1.5, 19)}C${P(1.25, 21.25)} ${P(-2.5, 21.25)} ${P(-2.5, 18.5)}C${P(-2.5, 16)} ${P(-3.25, 14.5)} ${P(-3.25, 12.5)}C${P(-3.25, 11)} ${P(-2, 10)} ${P(0.5, 10)}Z`;
  };
  const toes = (cx, m = 1) => [[1.75, 6.75], [-1.25, 6.5], [-3.75, 8]].map(([x, y]) => dot(cx + m * x, y, 0.3));
  add('baby-feet', ['pies de bebé', 'huellas', 'recién nacido', 'nacimiento', 'baby feet', 'footprints', 'newborn'], [sole(7.25), sole(16.75, -1), ...toes(7.25), ...toes(16.75, -1)]);
  FILL['baby-feet'] = { solid: [0, 1, 2, 3, 4, 5, 6, 7] };
  PARTS['baby-feet'] = { soles: [0, 1], toes: [2, 3, 4, 5, 6, 7] };
}

// Twins: two small faces on the diagonal, the one in front (bottom right) a piece on top that the
// engine clears the one behind around; the one behind shows its head and its curl (its eyes and its
// smile fall under the front face, or within its cutout at heavy weights)
{
  const back = baby([8.75, 8.75], 7);
  const front = baby([15.25, 15.25], 7);
  add('twins', ['gemelos', 'mellizos', 'múltiples', 'hermanos', 'twins', 'multiples', 'siblings'], [back.head, back.curl], {
    badge: { d: front.d, knock: front.head, fill: { solid: [front.head], cut: [front.curl, ...front.eyes, front.smile] } },
  });
  FILL.twins = { solid: [0], cut: [1] };
  PARTS.twins = { back: [0, 1] };
}

// Monitor: the baby's small face at the center and a wave on each side (the canvas holds one: a
// second would need the face under r 6, too small for its features)
const MON = baby([12, 12], 7);
const MONITOR = [...MON.d, arc(12, 12, 10, -35, 35).d, arc(12, 12, 10, 145, 215).d];
add('baby-monitor', ['monitor de bebé', 'vigilabebés', 'escuchar al bebé', 'baby monitor', 'nursery monitor', 'listen'], MONITOR);
add('baby-monitor-alert', ['alerta del monitor', 'bebé llorando', 'fuera de alcance', 'monitor alert', 'crying alert', 'out of range'], MONITOR, { badge: badge('alert') });
for (const name of ['baby-monitor', 'baby-monitor-alert']) {
  FILL[name] = { solid: [0], cut: [1, 2, 3, 4], lines: [5, 6] };
  PARTS[name] = { ...FACE_PARTS, wave: [5, 6] };
}

// Baby on board: the diamond sign is the face itself and hangs from a suction cup by a short cord.
// Its top corner is too narrow for the curl, so the face is the eyes and the smile, set where they
// stay 2.85 inside the sign's edges
{
  const [top, bottom] = [5, 21.5];
  const h = (bottom - top) / 2;
  const cy = top + h;
  const sign = roundpoly([[12, top], [12 + h, cy], [12, bottom], [12 - h, cy]], 2.5);
  const apex = top + 2.5 * (Math.SQRT2 - 1);
  const eyes = [dot(9.75, cy - 0.85), dot(14.25, cy - 0.85)];
  const smile = arc(12, cy + 1.8, 1.75, 30, 150).d;
  const cup = hl(3, 10, 14);
  add('baby-on-board', ['bebé a bordo', 'letrero', 'auto', 'precaución', 'baby on board', 'car sign', 'caution'], [sign, ...eyes, smile, cup, vl(12, 3, apex)]);
  FILL['baby-on-board'] = { solid: [0], cut: [1, 2, 3], wire: [4, 5] };
  PARTS['baby-on-board'] = { sign: [0], eyes: [1, 2], mouth: [3], cup: [4, 5] };
}

// Daycare: a pitched roof over the baby's face
{
  const roof = line([2.75, 10], [12, 2.25], [21.25, 10]);
  const face = baby([12, 14.75], 7);
  add('daycare', ['guardería', 'estancia infantil', 'cuidado infantil', 'kínder', 'daycare', 'childcare', 'nursery school'], [roof, ...face.d]);
  FILL.daycare = { solid: [1], cut: [2, 3, 4, 5], lines: [0] };
  PARTS.daycare = { roof: [0], head: [1], curl: [2], eyes: [3, 4], mouth: [5] };
}

// Carrier, worn: an adult in profile facing right (breastfeeding's adult) with the carrier's pouch on
// the chest, a piece on top (the engine clears the chest behind it), the baby's head peeking over its
// top and the carrier's strap running across the back to it. (From the front, the baby's head under
// the adult's read as one figure with a badge.)
{
  const headD = circ(8.5, 5.25, 3.25);
  const bust = 'M3.25 21.25V15.75A4.5 4.5 0 0 1 7.75 11.25H9.25C11.5 11.25 12.75 12.75 12.75 14.75V21.25';
  const pouch = sq(12.5, 13.5, 8, 7.75, 2.5, BR);
  const strap = line([3.25, 18.75], [13, 14.5]);
  add('baby-carrier', ['portabebés', 'canguro', 'rebozo', 'fular', 'baby carrier', 'sling', 'wrap'], [headD, bust, circ(16.75, 10, 2.5), strap], {
    badge: { d: [pouch], knock: pouch, fill: { solid: [pouch] } },
  });
  FILL['baby-carrier'] = { solid: [0, `${bust}Z`, 2], cut: [3] };
  PARTS['baby-carrier'] = { adult: [0, 1], baby: [2], strap: [3] };
}

// Pregnancy: a standing figure in profile, facing right: the head, and the body's front curving out
// over a round belly
{
  const headD = circ(11.25, 4.75, 2.75);
  const body = 'M9 21.25V12.25A2.5 2.5 0 0 1 11.5 9.75H12.5C14 9.75 14.75 10.75 14.75 12C17.75 12.75 18.5 17.25 14.25 18.25L13.75 21.25Z';
  add('pregnancy', ['embarazo', 'embarazada', 'maternidad', 'gestación', 'pregnancy', 'pregnant', 'maternity'], [headD, body]);
  FILL.pregnancy = { solid: [0, 1] };
  PARTS.pregnancy = { head: [0], body: [1] };
}

/** A band along an arc (center c, outer and inner radii, from a0 to a1 clockwise) with round ends. */
function band(c, ro, ri, a0, a1) {
  const p = (r, a) => polar(...c, r, a);
  const [e1, e0] = [halfChord(p(ro, a1), p(ri, a1)), halfChord(p(ri, a0), p(ro, a0))];
  return `M${pt(p(ro, a0))}A${ro} ${ro} 0 0 1 ${pt(p(ro, a1))}A${e1} ${e1} 0 0 1 ${pt(p(ri, a1))}A${ri} ${ri} 0 0 0 ${pt(p(ri, a0))}A${e0} ${e0} 0 0 1 ${pt(p(ro, a0))}Z`;
}
// Fetus: curled up in the figures' language, facing left: the large head bowed over the knees, the
// back a thick curve from the nape round to the rump, and the leg folded up under the chin and back
// down. (A circle with the body looping from its nape to its chin read as "&".)
{
  const C = [10.75, 13.75];
  const leg = roundline([polar(...C, 4.25, 20), [4.5, 14.25], [7.75, 20]], [0, 1.25, 0]);
  add('fetus', ['feto', 'embarazo semana a semana', 'desarrollo fetal', 'gestación', 'fetus', 'fetal development', 'pregnancy week'], [circ(7, 6.25, 3.75), band(C, 8.5, 4.25, -50, 70), leg]);
  FILL.fetus = { solid: [0, 1], wire: [2] };
  PARTS.fetus = { head: [0], body: [1, 2] };
}

// Sonogram: the scan's fan, narrow at the top and wide at the bottom, and inside it the fetus at the
// size the fan leaves: its head and its curled back (the folded leg has no room)
{
  const [apex, R0, R1, a0, a1] = [[12, -2], 5.5, 23.25, 64, 116];
  const fan = `M${pt(polar(...apex, R0, a1))}A${R0} ${R0} 0 0 0 ${pt(polar(...apex, R0, a0))}L${pt(polar(...apex, R1, a0))}A${R1} ${R1} 0 0 1 ${pt(polar(...apex, R1, a1))}Z`;
  add('sonogram', ['ecografía', 'ultrasonido', 'ultrasonido prenatal', 'cita', 'sonogram', 'ultrasound', 'scan'], [fan, circ(11, 10.75, 2), band([12.75, 14.5], 4, 1.5, 0, 120)]);
  FILL.sonogram = { solid: [0], cut: [1, 2] };
  PARTS.sonogram = { screen: [0], head: [1], body: [2] };
}

// Breastfeeding: an adult in profile, facing right (the head 2.75 above the shoulders, as the core
// person's), and in front of the chest, cradled in the arm, the baby's head (a piece on top)
{
  const headD = circ(8.5, 5.25, 3.25);
  const bust = 'M3.25 21.25V15.75A4.5 4.5 0 0 1 7.75 11.25H9.25C11.5 11.25 12.75 12.75 12.75 14.75V21.25';
  const bh = [circ(16, 14.5, 3.25)];
  const arm = 'M8.5 21C11.25 21.75 17.5 21.5 20.75 18.75';
  add('breastfeeding', ['lactancia', 'amamantar', 'sala de lactancia', 'pecho', 'breastfeeding', 'nursing', 'lactation'], [headD, bust], {
    badge: { d: [...bh, arm], knock: `${bh[0]}${shut(arm)}`, fill: { solid: [bh[0]], wire: [arm] } },
  });
  FILL.breastfeeding = { solid: [0, `${bust}Z`] };
  PARTS.breastfeeding = { head: [0], body: [1] };
}

// ── Feeding ───────────────────────────────────────────────────────────────────────────────────
// The bottle: the nipple (a narrow tip widening to its base), the screw collar and the body (the
// signature's corner), drawn upright from the nipple's tip down; its parts keep their own sizes at
// every scale, so a small bottle stays open (a scaled one shut its collar).
function bottle(cx, top, { nip = 4.75, nw = 4.5, col = 2.75, cw = 7, body = 11.25, w = 9.5, r = 3, tip = 1.25 } = {}) {
  const [y1, y2, y3] = [top + nip, top + nip + col, top + nip + col + body];
  const t = top + tip;
  const nipple = `M${pt([cx - nw / 2, y1])}C${pt([cx - nw / 2, t + 2])} ${pt([cx - tip, t + 1.25])} ${pt([cx - tip, t])}A${f(tip)} ${f(tip)} 0 0 1 ${pt([cx + tip, t])}C${pt([cx + tip, t + 1.25])} ${pt([cx + nw / 2, t + 2])} ${pt([cx + nw / 2, y1])}`;
  const collar = sq(cx - cw / 2, y1, cw, col, 1);
  const bodyD = sq(cx - w / 2, y2, w, body, r, BR);
  return { nipple, collar, body: bodyD, seam: hl(y2, cx - cw / 2 + 0.75, cx + cw / 2 - 0.75), x0: cx - w / 2, y2, y3 };
}
const BOTTLE = bottle(12, 2.5);
const BOTTLE_D = [BOTTLE.body, BOTTLE.collar, BOTTLE.nipple, hl(13.75, BOTTLE.x0, BOTTLE.x0 + 2.5), hl(17, BOTTLE.x0, BOTTLE.x0 + 2.5)];
const BOTTLE_FILL = { solid: [0, 1, `${BOTTLE.nipple}Z`], cut: [3, 4, BOTTLE.seam] };
add('baby-bottle', ['biberón', 'mamila', 'toma', 'fórmula', 'baby bottle', 'feeding bottle', 'feed'], BOTTLE_D);
add('baby-bottle-clock', ['próxima toma', 'horario de tomas', 'última toma', 'next feed', 'feeding schedule', 'feed timer'], BOTTLE_D, { badge: badge('clock') });
add('baby-bottle-plus', ['registrar toma', 'agregar toma', 'nueva toma', 'log feed', 'add feed', 'new feeding'], BOTTLE_D, { badge: badge('plus') });
for (const name of ['baby-bottle', 'baby-bottle-clock', 'baby-bottle-plus']) {
  FILL[name] = BOTTLE_FILL;
  PARTS[name] = { body: [0], collar: [1], nipple: [2], ticks: [3, 4] };
}

// Bottle feeding: the baby's small face in front (a piece on top: the engine clears the bottle behind
// it) and a bottle standing at its side, its nipple level with the baby's head. Tilted toward the
// mouth, the bottle either hid behind the face or covered it; upright beside it, both read
{
  const b = bottle(18, 2.25, { nip: 3.75, nw: 3.75, col: 2.25, cw: 5.5, body: 10, w: 7.5, r: 2.5, tip: 1.1 });
  const face = baby([8.75, 15.25], 7);
  add('bottle-feeding', ['alimentación con biberón', 'dar biberón', 'toma', 'mamila', 'bottle feeding', 'formula feeding', 'feed'], [b.body, b.collar, b.nipple], {
    badge: { d: face.d, knock: face.head, fill: { solid: [face.head], cut: [face.curl, ...face.eyes, face.smile] } },
  });
  FILL['bottle-feeding'] = { solid: [0, 1, `${b.nipple}Z`] };
  PARTS['bottle-feeding'] = { body: [0], collar: [1], nipple: [2] };
}

// Breast pump: the flange, a funnel on its side opening to the left, joined to the connector that
// sits on a short bottle (the bottle's body, the signature's corner)
{
  const connector = sq(13, 4, 6, 7.5, 1.5);
  const body = sq(11.75, 11.5, 8.5, 9.75, 2.75, BR);
  const flange = roundpoly([[3, 2.75], [13, 5.5], [13, 8], [3, 12.75]], [1, 0, 0, 1]);
  add('breast-pump', ['extractor de leche', 'sacaleches', 'extracción', 'lactancia', 'breast pump', 'pumping', 'expressing'], [body, connector, flange]);
  FILL['breast-pump'] = { solid: [0, 1, 2], cut: [hl(11.5, 13, 19), vl(13, 5.5, 8)] };
  PARTS['breast-pump'] = { bottle: [0], connector: [1], flange: [2] };
}

/** A wisp of steam rising from y0 to y1 at x (cocina's). */
const wisp = (x, y0, y1) => {
  const k = (y0 - y1) / 4;
  return `M${f(x)} ${f(y0)}C${f(x - 0.85)} ${f(y0 - k)} ${f(x - 0.85)} ${f(y0 - 2 * k)} ${f(x)} ${f(y0 - 2 * k)}S${f(x + 0.85)} ${f(y1 + k)} ${f(x)} ${f(y1)}`;
};

// Bottle warmer: a short cup with the warm water's wave across it, the bottle's collar and nipple
// rising out of it, a wisp of steam on each side of the nipple. (Its light, a dot in the middle of
// the cup, made it a padlock.)
{
  const b = bottle(12, 3.75, { cw: 6.5 });
  const cup = sq(5, 11.25, 14, 10, 3.5, BR);
  const water = 'M8 15.75C9 15 10 15 11 15.75S13 16.5 14 15.75S15 15 16 15.75';
  add('bottle-warmer', ['calentador de biberones', 'calentar leche', 'temperatura', 'biberón', 'bottle warmer', 'warm milk', 'heat'], [cup, b.collar, b.nipple, water, wisp(5.75, 7.75, 3.25), wisp(18.25, 7.75, 3.25)]);
  FILL['bottle-warmer'] = { solid: [0, 1, `${b.nipple}Z`], cut: [3, hl(11.25, 8.75, 15.25)], lines: [4, 5] };
  PARTS['bottle-warmer'] = { body: [0], bottle: [1, 2], water: [3], steam: [4, 5] };
}

// Sterilizer: a domed lid on a flat tray, two short bottles standing under it (each one outline:
// body, shoulders, neck and the round tip of the nipple) and three wisps of steam over the dome
{
  const tray = hl(20.25, 2.75, 21.25);
  const dome = arc(12, 20.25, 8.75, 180, 360).d;
  const small = (cx) => roundpoly([[cx - 1.75, 20.25], [cx - 1.75, 17], [cx - 0.75, 16], [cx - 0.75, 14.75], [cx + 0.75, 14.75], [cx + 0.75, 16], [cx + 1.75, 17], [cx + 1.75, 20.25]], [0, 0.75, 0.5, 0.7, 0.7, 0.5, 0.75, 0]);
  add('bottle-sterilizer', ['esterilizador', 'esterilizar biberones', 'vapor', 'higiene', 'bottle sterilizer', 'sterilize', 'steam'], [tray, dome, small(8.75), small(15.25), wisp(7.5, 8, 3.75), wisp(12, 8, 2.75), wisp(16.5, 8, 3.75)]);
  FILL['bottle-sterilizer'] = { solid: [`${dome}Z`], cut: [2, 3], wire: [0], lines: [4, 5, 6] };
  PARTS['bottle-sterilizer'] = { tray: [0], lid: [1], bottles: [2, 3], steam: [4, 5, 6] };
}

// Formula: a short wide tin under its lid rim, the scoop lying on the lid
{
  const tin = sq(4.5, 10.75, 15, 10.5, 3, BR);
  const lid = sq(3.75, 8, 16.5, 2.75, 1.25);
  const scoop = 'M5.75 5.75A2.25 2.25 0 0 0 10.25 5.75Z';
  add('baby-formula', ['fórmula infantil', 'leche en polvo', 'lata', 'medidor', 'baby formula', 'infant formula', 'powdered milk'], [tin, lid, scoop, line([10.25, 5.75], [19.25, 4.5])]);
  FILL['baby-formula'] = { solid: [0, 1, 2], cut: [hl(10.75, 3.75, 20.25)], wire: [3] };
  PARTS['baby-formula'] = { tin: [0], lid: [1], scoop: [2, 3] };
}

// Baby food: a small squat jar under a wide ridged lid, a spoon standing beside it
{
  const jar = sq(3.25, 10, 11.5, 11.25, 3, BR);
  const lid = sq(2.75, 6, 12.5, 4, 1.25);
  const ridges = [6, 9, 12].map((x) => vl(x, 6, 10));
  const bowl = ell([19.5, 7.5], 1.75, 2.75);
  const handle = line([19.5, 10.25], [19, 21.25]);
  add('baby-food-jar', ['papilla', 'comida de bebé', 'puré', 'frasco', 'baby food', 'puree', 'solids'], [jar, lid, ...ridges, bowl, handle]);
  FILL['baby-food-jar'] = { solid: [0, 1, 5], cut: [hl(10, 4.5, 13.5)], wire: [6] };
  PARTS['baby-food-jar'] = { jar: [0], lid: [1, 2, 3, 4], spoon: [5, 6] };
}

// Pouch: a soft pouch tapering at its top into a short spout under a round cap, its sealed hem at the
// bottom
{
  const pouch = roundpoly([[10.5, 8.25], [13.5, 8.25], [18.25, 11], [18.5, 21.25], [5.5, 21.25], [5.75, 11]], [0.5, 0.5, 2.75, 0, 1.75, 2.75]);
  const neck = sq(10.5, 6, 3, 2.25, 0.5);
  const cap = capsule(9.25, 2.75, 5.5, 3.25);
  add('baby-food-pouch', ['bolsita de puré', 'pouch', 'colación', 'papilla', 'food pouch', 'squeeze pouch', 'snack'], [pouch, neck, cap, hl(18, 5.55, 18.45)]);
  FILL['baby-food-pouch'] = { solid: [0, 1, 2], cut: [hl(18, 4.5, 19.5), hl(8.25, 10.5, 13.5), hl(6, 10.5, 13.5)] };
  PARTS['baby-food-pouch'] = { pouch: [0, 3], spout: [1], cap: [2] };
}

// Sippy cup: the cup with a handle on each side, the lid and its short spout
{
  const cup = sq(6.25, 10.75, 11.5, 10.5, 3.5, BR);
  const lid = sq(5.5, 8, 13, 2.75, 1.25);
  const spout = roundpoly([[10, 8], [10.75, 3.25], [13.25, 3.25], [14, 8]], [0, 1, 1, 0]);
  const handle = 'M6.25 12.75H4.75A1.5 1.5 0 0 0 3.25 14.25V16.25A1.5 1.5 0 0 0 4.75 17.75H6.25';
  add('sippy-cup', ['vaso entrenador', 'vaso con asas', 'transición', 'beber', 'sippy cup', 'training cup', 'toddler cup'], [cup, lid, spout, handle, flipPath(handle)]);
  FILL['sippy-cup'] = { solid: [0, 1, 2], cut: [hl(10.75, 5.5, 18.5)], wire: [3, 4] };
  PARTS['sippy-cup'] = { cup: [0], lid: [1], spout: [2], handles: [3, 4] };
}

// High chair, in profile: the back and the seat, the tray jutting forward from the back at the
// arms' height, two long splayed legs and the footrest between them
{
  const seat = roundline([[7.25, 3.25], [7.25, 12.5], [13.5, 12.5]], [0, 1.5, 0]);
  const tray = hl(9.25, 7.25, 19.75);
  const legs = [line([8.25, 12.5], [4.75, 21.25]), line([12.75, 12.5], [16.5, 21.25])];
  const at = (L, y) => L[0][0] + ((L[1][0] - L[0][0]) * (y - L[0][1])) / (L[1][1] - L[0][1]);
  const rest = hl(17.5, at([[8.25, 12.5], [4.75, 21.25]], 17.5), at([[12.75, 12.5], [16.5, 21.25]], 17.5));
  add('high-chair', ['silla alta', 'periquera', 'silla para comer', 'comedor', 'high chair', 'feeding chair', 'booster'], [seat, tray, ...legs, rest]);
  FILL['high-chair'] = false;
  PARTS['high-chair'] = { seat: [0], tray: [1], legs: [2, 3], footrest: [4] };
}

// Bib: rounded below, the neck cut out at the top between the two tabs that tie it
{
  const bib = `M6.25 4.75C6.25 7.5 4.75 9.5 4.75 13.5A7.25 7.25 0 0 0 19.25 13.5C19.25 9.5 17.75 7.5 17.75 4.75A1.5 1.5 0 0 0 14.75 4.75V6.5A2.75 2.75 0 0 1 9.25 6.5V4.75A1.5 1.5 0 0 0 6.25 4.75Z`;
  add('bib', ['babero', 'comer', 'ropa de bebé', 'bib', 'feeding', 'baby clothes'], [bib, hl(16.25, 5.3, 18.7)]);
  FILL.bib = { solid: [0], cut: [1] };
  PARTS.bib = { bib: [0], pocket: [1] };
}

// Pacifier: the wide shield, the nipple's bulb rising behind it and the ring hanging below
{
  const shield = ell([12, 11.25], 8.75, 3.5);
  const top = 11.25 - 3.5 * Math.sqrt(1 - (1.75 / 8.75) ** 2);
  const nipple = `M10.25 ${f(top)}C10.25 6.75 9.5 6.25 9.5 5A2.5 2.5 0 0 1 14.5 5C14.5 6.25 13.75 6.75 13.75 ${f(top)}`;
  const ring = circ(12, 18, 3.25);
  add('pacifier', ['chupón', 'chupete', 'tranquilizar', 'dormir', 'pacifier', 'dummy', 'soother'], [shield, nipple, ring, dot(12, 11.25)]);
  FILL.pacifier = { solid: [0, `${nipple}Z`], cut: [3], wire: [2] };
  PARTS.pacifier = { shield: [0], nipple: [1], ring: [2], button: [3] };
}

// Teether: a thick ring, three small nubs on its outer edge and a short tab to hold it by
{
  const [C, R, rb] = [[11.25, 11], 7.25, 1.25];
  const d = (2 * Math.asin(rb / (2 * R)) * 180) / Math.PI;
  const w = 1.75;
  const dt = (Math.asin(w / R) * 180) / Math.PI;
  const tab = 45;
  const u = polar(0, 0, 1, tab);
  const v = [-u[1], u[0]];
  const end = R + 2.25;
  const side = (k, t) => add2(add2(C, mul(u, t)), mul(v, k * w));
  // Clockwise from the tab: the rim, a nub at each angle, back to the tab
  const nubs = [165, 225, 285];
  let o = `M${pt(polar(...C, R, tab + dt))}`;
  let from = tab + dt;
  for (const a of nubs) {
    o += arcTo(...C, R, from, a - d);
    o += `A${f(rb)} ${f(rb)} 0 1 1 ${pt(polar(...C, R, a + d))}`;
    from = a + d;
  }
  o += arcTo(...C, R, from, 360 + tab - dt);
  o += `L${pt(side(-1, end - w))}A${f(w)} ${f(w)} 0 0 1 ${pt(side(1, end - w))}Z`;
  const hole = circ(...C, 3.75);
  add('teether', ['mordedera', 'dentición', 'encías', 'aro', 'teether', 'teething ring', 'teething'], [o, hole]);
  FILL.teether = { solid: [`${o}${hole}`] };
  PARTS.teether = { ring: [0, 1] };
}

// Rattle, upright: a round head on a straight handle that ends in a ring to hold it by, a shake line
// on each side of the head. (Its head on a diagonal handle, the shake lines on one side, read as the
// magnifier.)
{
  const [hc, hr, rc, rr] = [[12, 7.75], 4.75, [12, 18.5], 2.5];
  const shake = [arc(...hc, 7.75, -165, -135).d, arc(...hc, 7.75, -45, -15).d];
  add('rattle', ['sonaja', 'sonajero', 'recién nacido', 'juguete sensorial', 'rattle', 'newborn', 'sensory'], [circ(...hc, hr), vl(12, hc[1] + hr, rc[1] - rr), circ(...rc, rr), ...shake]);
  FILL.rattle = { solid: [0], wire: [1, 2], lines: [3, 4] };
  PARTS.rattle = { head: [0], handle: [1, 2], shake: [3, 4] };
}

// ── Sleep and the nursery ─────────────────────────────────────────────────────────────────────
// Crib, in profile: two tall posts, the top rail between them, three slats down to the mattress
// and the posts running on below it as short legs
const CRIB = [vl(4, 3.25, 20.75), vl(20, 3.25, 20.75), hl(6.75, 4, 20), 'M4 14.25H20V17.25H4Z', ...[8, 12, 16].map((x) => vl(x, 6.75, 14.25))];
add('crib', ['cuna', 'cama de bebé', 'cuarto del bebé', 'dormir', 'crib', 'cot', 'nursery'], CRIB);
add('crib-clock', ['hora de la siesta', 'horario de sueño', 'rutina de dormir', 'nap time', 'sleep schedule', 'bedtime'], CRIB, { badge: badge('clock') });
for (const name of ['crib', 'crib-clock']) {
  FILL[name] = { solid: [3], wire: [0, 1, 2, 4, 5, 6] };
  PARTS[name] = { posts: [0, 1], rail: [2], mattress: [3], slats: [4, 5, 6] };
}

// Bassinet: a shallow basket, its hood a half dome over the head end, on an X-shaped stand
{
  const basket = 'M3 10H21C21 12.75 18.75 14.25 16 14.25H8C5.25 14.25 3 12.75 3 10Z';
  const hood = arc(8, 10, 5, 180, 360).d;
  const legs = [line([8, 14.25], [16.5, 21.25]), line([16, 14.25], [7.5, 21.25])];
  add('bassinet', ['moisés', 'cuna de recién nacido', 'colecho', 'dormir', 'bassinet', 'bedside sleeper', 'newborn bed'], [basket, hood, ...legs]);
  FILL.bassinet = { solid: [0, `${hood}Z`], cut: [hl(10, 3, 13)], wire: [2, 3] };
  PARTS.bassinet = { basket: [0], hood: [1], stand: [2, 3] };
}

// Cradle: a small open bed (its two ends rising above the side rail) on a curved rocker, two short
// legs between them
{
  const bed = roundline([[4.5, 7], [4.5, 15], [19.5, 15], [19.5, 7]], [0, 2.5, 2.5, 0]);
  const [C, R] = [[12, 3.3], 17.45];
  const rocker = arc(...C, R, 58.95, 121.05).d;
  const foot = (x) => [x, C[1] + Math.sqrt(R * R - (x - C[0]) ** 2)];
  add('cradle', ['cuna mecedora', 'mecer', 'arrullar', 'dormir', 'cradle', 'rocking', 'rock to sleep'], [bed, hl(10, 4.5, 19.5), vl(8, 15, foot(8)[1]), vl(16, 15, foot(16)[1]), rocker]);
  FILL.cradle = { solid: [roundline([[4.5, 10], [4.5, 15], [19.5, 15], [19.5, 10]], [0, 2.5, 2.5, 0]) + 'Z'], wire: [vl(4.5, 7, 10.5), vl(19.5, 7, 10.5), 2, 3, 4] };
  PARTS.cradle = { bed: [0, 1], legs: [2, 3], rocker: [4] };
}

// Mobile: a ring to hang it by, an arched bar, and three strings ending in a crescent, a star and a
// dot, each at its own height (the middle string runs on from the ring's)
{
  const ring = circ(12, 3.25, 1.5);
  const [C, R] = [[12, 22.64], 15.89];
  const bar = `M4.75 ${f(C[1] - Math.sqrt(R * R - 7.25 ** 2))}A${R} ${R} 0 0 1 19.25 ${f(C[1] - Math.sqrt(R * R - 7.25 ** 2))}`;
  const end = C[1] - Math.sqrt(R * R - 7.25 ** 2);
  const crescent = moon([4.75, 13.5], 2.75, [6.75, 13.5], 2.4);
  const starPts = Array.from({ length: 10 }, (_, i) => polar(12, 17, i % 2 ? 1.45 : 2.85, -90 + i * 36));
  const starTop = 17 - 2.85 + 0.35 / Math.sin((18 * Math.PI) / 180) - 0.35;
  add('crib-mobile', ['móvil de cuna', 'móvil', 'decoración', 'calmar', 'crib mobile', 'nursery mobile', 'soothe'], [ring, bar, vl(12, 4.75, starTop), vl(4.75, end, 10.75), vl(19.25, end, 11.8), crescent, roundpoly(starPts, 0.35), dot(19.25, 12.5)]);
  FILL['crib-mobile'] = { solid: [5, 6, 7], wire: [0, 1, 2, 3, 4] };
  PARTS['crib-mobile'] = { hanger: [0, 1], strings: [2, 3, 4], toys: [5, 6, 7] };
}

// Sound machine: a low dome on a flat base, its grille a row of dots, and two arcs of sound over it
{
  const base = sq(3.5, 18, 17, 3.25, 1.6);
  const dome = arc(12, 18, 7.75, 180, 360).d;
  const waves = [10.75, 13.75].map((r) => arc(12, 18, r, -115, -65).d);
  add('sound-machine', ['ruido blanco', 'máquina de sonidos', 'sonidos para dormir', 'arrullo', 'sound machine', 'white noise', 'sleep sounds'], [base, dome, ...[8.4, 12, 15.6].map((x) => dot(x, 15.1)), ...waves]);
  FILL['sound-machine'] = { solid: [0, `${dome}Z`], cut: [2, 3, 4, hl(18, 4.25, 19.75)], lines: [5, 6] };
  PARTS['sound-machine'] = { base: [0], dome: [1], grille: [2, 3, 4], wave: [5, 6] };
}

// Lullaby: a crescent moon at the bottom left, open to the top right, and a note in its lap (the
// tilted oval head of musical notation, its stem and its flag)
function noteHead(cx, cy, rx, ry, deg) {
  const a = [cx + rx * Math.cos((deg * Math.PI) / 180), cy + rx * Math.sin((deg * Math.PI) / 180)];
  const b = [2 * cx - a[0], 2 * cy - a[1]];
  const fi = (deg * Math.PI) / 180;
  const t = Math.atan2(-ry * Math.sin(fi), rx * Math.cos(fi));
  const right = [cx + rx * Math.cos(t) * Math.cos(fi) - ry * Math.sin(t) * Math.sin(fi), cy + rx * Math.cos(t) * Math.sin(fi) + ry * Math.sin(t) * Math.cos(fi)];
  return { d: `M${pt(a)}A${f(rx)} ${f(ry)} ${f(deg)} 1 1 ${pt(b)}A${f(rx)} ${f(ry)} ${f(deg)} 1 1 ${pt(a)}Z`, right };
}
{
  const crescent = moon([8.5, 14], 6.5, [11.5, 11], 5.5);
  const head = noteHead(15.5, 10.5, 2.3, 1.65, -24);
  const x = head.right[0];
  add('lullaby', ['canción de cuna', 'arrullo', 'música para dormir', 'nana', 'lullaby', 'sleep music', 'sleep sounds'], [crescent, head.d, line(head.right, [x, 2.75]), `M${f(x)} 2.75C${f(x)} 5 ${f(x + 3.25)} 5.25 ${f(x + 3.25)} 8.25`]);
  FILL.lullaby = { solid: [0, 1], wire: [2, 3] };
  PARTS.lullaby = { moon: [0], note: [1, 2, 3] };
}

// Night light: the small plate that plugs into the wall and a crescent moon standing out of its top
// corner (a piece on top), two short rays of its glow on its far side
{
  const plate = sq(4, 11.5, 9.5, 9.75, 3, BR);
  const crescent = moon([14.25, 9.25], 6, [16.75, 6.75], 5);
  const rays = [-170, -140].map((a) => line(polar(14.25, 9.25, 7.5, a), polar(14.25, 9.25, 9.75, a)));
  add('nursery-light', ['luz de noche', 'lámpara de noche', 'luz tenue', 'cuarto del bebé', 'night light', 'nightlight', 'nursery lamp'], [plate, ...rays], {
    badge: { d: [crescent], knock: crescent, fill: { solid: [crescent] } },
  });
  FILL['nursery-light'] = { solid: [0], lines: [1, 2] };
  PARTS['nursery-light'] = { plate: [0], glow: [1, 2] };
}

// Playpen: the baby standing in it, its face over the padded rail (the pen is the piece on top: the
// engine clears the face below the rail) and the pen's mesh, short bars on the floor. As in the
// bath, the smile goes under the rail (its ends at the rail's clearance came and went with the
// weight), and the rail stays 5.45 below the eyes, so the engine never takes them at bold. (The pen
// alone, a rail over bars, read as a fence.)
{
  const rail = capsule(2.75, 14, 18.5, 2.75);
  const bars = [6.75, 10.25, 13.75, 17.25].map((x) => vl(x, 16.75, 21.25));
  const floor = hl(21.25, 2.75, 21.25);
  const face = baby([12, 8.75], 7);
  add('playpen', ['corral', 'cuna de viaje', 'corralito', 'área de juego', 'playpen', 'play yard', 'travel cot'], [face.head, face.curl, ...face.eyes], {
    badge: { d: [rail, ...bars, floor], knock: sq(2.75, 14, 18.5, 7.25, 1.375), fill: { solid: [rail], wire: [...bars, floor] } },
  });
  FILL.playpen = { solid: [0], cut: [1, 2, 3] };
  PARTS.playpen = { head: [0], curl: [1], eyes: [2, 3] };
}

// Swing, from the front: the swing's frame (its top bar on two splayed legs) and, hanging from the bar
// on two ropes, the deep bucket seat of a baby swing. (In profile, an A-frame over a seat that closed
// into a drop with its ropes read as the letter A.)
{
  const frame = roundline([[2.75, 21.25], [6.25, 3.25], [17.75, 3.25], [21.25, 21.25]], [0, 1.5, 1.5, 0]);
  const seat = 'M7.5 13H16.5C16.5 16.5 14.5 18.5 12 18.5S7.5 16.5 7.5 13Z';
  add('baby-swing', ['columpio para bebé', 'mecedora', 'arrullar', 'calmar', 'baby swing', 'infant swing', 'soothe'], [frame, vl(9, 3.25, 13), vl(15, 3.25, 13), seat]);
  FILL['baby-swing'] = { solid: [3], wire: [0, 1, 2] };
  PARTS['baby-swing'] = { frame: [0], ropes: [1, 2], seat: [3] };
}

// Play gym: the mat, an arch standing over it and two toys hanging from its top, a ring and a star
{
  const R = 8.5;
  const arch = `M3.5 20.25V11A${R} ${R} 0 0 1 20.5 11V20.25`;
  const archY = (x) => 11 - Math.sqrt(R * R - (x - 12) ** 2);
  const starPts = Array.from({ length: 10 }, (_, i) => polar(15.5, 13.25, i % 2 ? 1.4 : 2.7, -90 + i * 36));
  const starTop = 13.25 - 2.7 + 0.3 / Math.sin((18 * Math.PI) / 180) - 0.3;
  add('play-gym', ['gimnasio para bebé', 'tapete de juego', 'arco de juego', 'estimulación', 'play gym', 'activity gym', 'play mat'], [hl(20.25, 2, 22), arch, vl(8.25, archY(8.25), 10.25), vl(15.5, archY(15.5), starTop), circ(8.25, 12, 1.75), roundpoly(starPts, 0.3)]);
  FILL['play-gym'] = { solid: [4, 5], wire: [0, 1, 2, 3] };
  PARTS['play-gym'] = { mat: [0], arch: [1], strings: [2, 3], toys: [4, 5] };
}

// ── Diapers and the bath ──────────────────────────────────────────────────────────────────────
// The diaper, from the front, one silhouette: the waistband across the top, its ends standing out as
// the side tabs, and below them the two leg openings curving in to the rounded crotch; the band's
// seam runs between the tabs. Drawn low, to leave room for a drop or a smell above it; alone or with
// a badge it rises 3.75. (A body that bulged out to a round bottom read as a flower pot, and under
// steam as a cooking pot; a separate band over a narrow body, as a sink. Wide and low, as a diaper is.)
function diaper(t) {
  const [b, e] = [t + 3.25, t + 8.75];
  const Y = f;
  const outline = `M3.75 ${Y(t)}H20.25A1 1 0 0 1 21.25 ${Y(t + 1)}V${Y(b - 1)}A1 1 0 0 1 20.25 ${Y(b)}H18.75A5.5 5.5 0 0 0 15 ${Y(e)}Q12 ${Y(e + 1.25)} 9 ${Y(e)}A5.5 5.5 0 0 0 5.25 ${Y(b)}H3.75A1 1 0 0 1 2.75 ${Y(b - 1)}V${Y(t + 1)}A1 1 0 0 1 3.75 ${Y(t)}Z`;
  return { outline, seam: hl(b, 5.25, 18.75) };
}
{
  const up = diaper(7.25);
  const low = diaper(11);
  add('diaper', ['pañal', 'cambiar pañal', 'tallas de pañal', 'bebé', 'diaper', 'nappy', 'diapering'], [up.outline, up.seam]);
  add('diaper-plus', ['registrar cambio', 'cambio de pañal', 'agregar pañal', 'log diaper', 'diaper change', 'add diaper'], [up.outline, up.seam], { badge: badge('plus') });
  add('diaper-wet', ['pañal mojado', 'pipí', 'orina', 'registro', 'wet diaper', 'pee', 'wet'], [low.outline, low.seam, droplet([12, 5.4], 1.5)]);
  add('diaper-dirty', ['pañal sucio', 'popó', 'evacuación', 'registro', 'dirty diaper', 'poop', 'soiled'], [low.outline, low.seam, ...[8, 12, 16].map((x) => wisp(x, 7.5, 3.5))]);
  for (const name of ['diaper', 'diaper-plus', 'diaper-wet', 'diaper-dirty']) {
    FILL[name] = { solid: [0], cut: [1] };
    PARTS[name] = { diaper: [0], band: [1] };
  }
  FILL['diaper-wet'].solid.push(2);
  PARTS['diaper-wet'].drop = [2];
  FILL['diaper-dirty'].lines = [2, 3, 4];
  PARTS['diaper-dirty'].smell = [2, 3, 4];
}

// Wipes: a soft pack, the flip lid on its top and one wipe pulled out of it, its edge in a wave
{
  const pack = sq(2.75, 12.25, 18.5, 9, 4, BR);
  const lid = sq(5.75, 9.25, 12.5, 3, 1.4);
  const wipe = 'M7.75 9.25C7.75 7 6.75 5.75 7.25 3.5C9.25 4.75 10.5 2.5 12.5 3C14.25 3.4 15.25 2.25 16.75 3C16.25 5 16.25 7 16.25 9.25';
  add('baby-wipes', ['toallitas húmedas', 'toallitas', 'limpiar', 'pañal', 'baby wipes', 'wet wipes', 'wipes'], [pack, lid, wipe]);
  FILL['baby-wipes'] = { solid: [0, 1, `${wipe}Z`], cut: [hl(12.25, 4.25, 19.75), hl(9.25, 7.75, 16.25)] };
  PARTS['baby-wipes'] = { pack: [0], lid: [1], wipe: [2] };
}

// Diaper bag: a wide bag with its handle, and a side pocket in front (a piece on top) with a bottle's
// nipple peeking out of it
{
  const bag = sq(2.75, 9, 15.75, 12.25, 3.5, BR);
  const handle = roundline([[5.75, 9], [5.75, 4.75], [12.5, 4.75], [12.5, 9]], [0, 2.5, 2.5, 0]);
  const pocket = sq(14, 13.25, 7.25, 8, 2.5, BR);
  const nip = bottle(17.6, 8.5, { nip: 4.75, nw: 3.25, tip: 0.95 }).nipple;
  add('diaper-bag', ['pañalera', 'bolsa de pañales', 'salida', 'qué llevar', 'diaper bag', 'nappy bag', 'baby bag'], [bag, handle], {
    badge: { d: [pocket, nip], knock: `${pocket}${shut(nip)}`, fill: { solid: [pocket, shut(nip)], cut: [hl(13.25, 15.98, 19.22)] } },
  });
  FILL['diaper-bag'] = { solid: [0], wire: [1] };
  PARTS['diaper-bag'] = { bag: [0], handle: [1] };
}

// Changing table: the padded changing pad on a table with a shelf below, and the baby lying on the pad
// as on the changing station's shelf (the big head, the small swaddled body). (A dresser with tall
// rims at its ends read as a box with ears; under a pad and a baby, as a stack.)
{
  const pad = capsule(2.75, 10, 18.5, 3.25);
  const head = circ(7, 7.5, 2.25);
  const body = hull([14, 8], 1.75, [17.5, 8.5], 1.25).d;
  add('changing-table', ['cambiador', 'mesa para cambiar', 'cómoda', 'cuarto del bebé', 'changing table', 'changing pad', 'nursery dresser'], [pad, head, body, vl(5, 13.25, 21.25), vl(19, 13.25, 21.25), hl(17.75, 5, 19)]);
  FILL['changing-table'] = { solid: [0, 1, 2], wire: [3, 4, 5] };
  PARTS['changing-table'] = { pad: [0], baby: [1, 2], table: [3, 4, 5] };
}

// Baby changing station (the restroom sign): a standing adult beside a shelf folded down from the
// wall on its brace, the baby lying swaddled on it
const ADULT = [circ(5.5, 4.75, 2.75), roundpoly([[3, 10], [8, 10], [8, 21.25], [3, 21.25]], [2.5, 2.5, 0.75, 0.75])];
{
  const shelf = line([11.25, 13], [21.25, 13], [21.25, 20.25]);
  const brace = line([21.25, 18.5], [15.75, 13]);
  const baby = hull([13.5, 10.75], 2.25, [18.25, 11.75], 1.25).d;
  add('baby-changing-station', ['cambiador de pañales', 'sala de cambio', 'baño familiar', 'cambiador público', 'baby changing station', 'changing facility', 'family restroom'], [...ADULT, shelf, brace, baby]);
  FILL['baby-changing-station'] = { solid: [0, 1, 4], wire: [2, 3] };
  PARTS['baby-changing-station'] = { adult: [0, 1], shelf: [2, 3], baby: [4] };
}

// Bath: a small tub in profile (a piece on top) with the baby's small face peeking over its rim (its
// curl and its eyes; its smile goes under the rim) and two bubbles above
{
  const tub = 'M2.75 14.5H21.25C21.25 18.25 18.5 20.75 14.5 20.75H9.5C5.5 20.75 2.75 18.25 2.75 14.5Z';
  const face = baby([9.25, 9.25], 7);
  add('baby-bath', ['baño del bebé', 'tina', 'hora del baño', 'bañera', 'baby bath', 'bath time', 'tub'], [face.head, face.curl, ...face.eyes, circ(19.5, 3.25, 1.5), circ(20.25, 9.75, 1.5)], {
    badge: { d: [tub], knock: tub, fill: { solid: [tub] } },
  });
  FILL['baby-bath'] = { solid: [0], cut: [1, 2, 3], lines: [4, 5] };
  PARTS['baby-bath'] = { head: [0], curl: [1], eyes: [2, 3], bubbles: [4, 5] };
}


// Potty, in profile: a round bowl, the seat's rim over it and a low back rising from the rim
{
  const bowl = 'M5.25 13.25H18.75C18.75 18 16.25 20.75 12 20.75S5.25 18 5.25 13.25Z';
  const rim = capsule(3.25, 10.5, 17.5, 2.75);
  const back = roundpoly([[3.75, 10.5], [3.25, 5.75], [8.25, 5.75], [8.25, 10.5]], [0, 2, 2, 0]);
  add('potty', ['bacinica', 'orinal', 'entrenamiento para ir al baño', 'dejar el pañal', 'potty', 'potty training', 'potty chair'], [bowl, rim, back]);
  FILL.potty = { solid: [0, 1, 2], cut: [hl(13.25, 5.25, 18.75), hl(10.5, 3.5, 8.25)] };
  PARTS.potty = { bowl: [0], seat: [1], back: [2] };
}

// Baby powder: a short bottle under its shaker cap and the powder shaken out of it, grains flying up
// and away from the cap. (A cloud of it beside the bottle read as the weather, and the grains over
// the cap left the live area.)
{
  const body = sq(3.25, 11.25, 8.5, 10, 3, BR);
  const cap = sq(4.5, 7.75, 6, 3.5, 1.4);
  const grains = [[13.75, 7.75], [17, 5.75], [17.25, 9.75], [20.5, 7.75]].map((p) => dot(...p));
  add('baby-powder', ['talco', 'polvo para bebé', 'talquera', 'pañal', 'baby powder', 'talc', 'powder'], [body, cap, ...grains]);
  FILL['baby-powder'] = { solid: [0, 1, 2, 3, 4, 5] };
  PARTS['baby-powder'] = { bottle: [0], cap: [1], powder: [2, 3, 4, 5] };
}

// ── Outings ───────────────────────────────────────────────────────────────────────────────────
// The stroller (the pram everyone draws): a round basket, its hood a quarter of the circle over the
// front, the handle sweeping up and back from the basket's rim, a small front wheel and a large rear
// one standing free below it. Double: a longer basket with two hoods in a row
const pram = ({ x0 = 5, hoods = [5], r = 5.5, len = 11 } = {}) => {
  const y = 9.25;
  const basket = `M${f(x0)} ${y}H${f(x0 + len)}${arcTo(x0 + len - r, y, r, 0, 90)}H${f(x0 + r)}${arcTo(x0 + r, y, r, 90, 180)}Z`;
  const hd = hoods.map((hx) => `M${f(hx)} ${y}${arcTo(hx + r, y, r, 180, 270)}V${y}Z`);
  return { basket, hoods: hd, end: [x0 + len, y] };
};
{
  const p = pram();
  const handle = roundline([p.end, [19.75, 3.5], [21.25, 3.5]], [0, 0.75, 0]);
  const wheels = [circ(6.5, 19.5, 1.75), circ(15, 18.75, 2.5)];
  add('stroller', ['carriola', 'cochecito', 'paseo', 'apto para carriolas', 'stroller', 'pram', 'buggy'], [p.basket, ...p.hoods, handle, ...wheels]);
  FILL.stroller = { solid: [0, 1, 3, 4], cut: [line([5, 9.25], [10.5, 9.25], [10.5, 3.75])], wire: [2] };
  PARTS.stroller = { basket: [0], hood: [1], handle: [2], wheels: [3, 4] };
}
{
  const p = pram({ x0: 2.25, hoods: [2.25, 7.25], r: 5, len: 16.5 });
  const handle = roundline([p.end, [20.25, 4.25], [21.5, 4.25]], [0, 0.6, 0]);
  const wheels = [circ(5.5, 19.5, 1.75), circ(16, 19, 2.25)];
  add('stroller-double', ['carriola doble', 'carriola para gemelos', 'hermanos', 'gemelos', 'double stroller', 'twin stroller', 'tandem stroller'], [p.basket, ...p.hoods, handle, ...wheels]);
  FILL['stroller-double'] = { solid: [0, 1, 2, 4, 5], cut: [line([2.25, 9.25], [12.25, 9.25], [12.25, 4.25]), vl(7.25, 4.25, 9.25)], wire: [3] };
  PARTS['stroller-double'] = { basket: [0], hoods: [1, 2], handle: [3], wheels: [4, 5] };
}

// The car seat, in profile, facing left: the tall shell, its headrest wing reaching forward at the
// top, the seat and its base below, and the harness strap running down from the shoulder to the
// buckle (facing left, its detail stays clear of a badge's corner)
const CAR_SEAT = [roundpoly([[18.75, 21.25], [19.75, 3.25], [11.5, 3.25], [11.5, 8], [14.25, 9.5], [14.25, 14.25], [5, 14.25], [4.75, 21.25]], [0, 2.5, 1.5, 1.5, 1, 1.5, 1.5, 0]), hl(17.75, 4.85, 18.95), line([14.25, 10.25], [8, 14.25])];
add('car-seat', ['silla para auto', 'autoasiento', 'portabebé de auto', 'seguridad', 'car seat', 'child seat', 'auto seat'], CAR_SEAT);
add('car-seat-check', ['silla instalada', 'silla revisada', 'instalación correcta', 'car seat installed', 'car seat check', 'inspected'], CAR_SEAT, { badge: badge('check') });
add('car-seat-alert', ['recordatorio asiento trasero', 'niño en el auto', 'silla sin anclar', 'rear seat reminder', 'child left in car', 'unlatched'], CAR_SEAT, { badge: badge('alert') });
for (const name of ['car-seat', 'car-seat-check', 'car-seat-alert']) {
  FILL[name] = { solid: [0], cut: [hl(17.75, 3.5, 20.25), 2] };
  PARTS[name] = { shell: [0], base: [1], harness: [2] };
}

// Infant car seat: the bucket (its rim sloping down from the head to the feet, its bottom round),
// the tall carry handle arching over it from rim to rim, and the base it clicks into
{
  const bucket = 'M3.75 10.5L20.25 12.75C20.25 17.25 16.75 19.5 12.5 19.25C7.25 19 3.75 15.75 3.75 10.5Z';
  const handle = 'M6.25 10.85C6.25 6.5 8.75 4.75 12 4.75S17.75 6.5 17.75 12.4';
  const base = line([8.5, 19.1], [7, 21.25], [18, 21.25], [16.5, 18.6]);
  add('car-seat-infant', ['portabebé', 'huevito', 'silla de bebé para auto', 'cargar', 'infant car seat', 'infant carrier', 'baby seat'], [bucket, handle, base]);
  FILL['car-seat-infant'] = { solid: [0], wire: [1, 2] };
  PARTS['car-seat-infant'] = { shell: [0], handle: [1], base: [2] };
}

// ── Child safety ──────────────────────────────────────────────────────────────────────────────
// Gate: the doorway, and standing low in it, clear of the jambs, the gate: its two posts and top rail
// and the bars between them down to the floor. (Posts and rails around a row of bars read as the
// crib; a closed tube frame on four pressure mounts made it too dense.)
{
  const doorway = roundline([[2.75, 21.25], [2.75, 4], [21.25, 4], [21.25, 21.25]], [0, 2.5, 2.5, 0]);
  add('baby-gate', ['reja de seguridad', 'puerta de seguridad', 'escaleras', 'protección', 'baby gate', 'safety gate', 'stair gate'], [doorway, roundline([[5.75, 21.25], [5.75, 12], [18.25, 12], [18.25, 21.25]], [0, 1.5, 1.5, 0]), ...[9.92, 14.08].map((x) => vl(x, 12, 21.25))]);
  FILL['baby-gate'] = false;
  PARTS['baby-gate'] = { doorway: [0], gate: [1, 2, 3] };
}

// Outlet cover: dispositivos' outlet plate with a round cap plugged over its slots, the ridge across
// the cap to grip it by
{
  const plate = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
  add('outlet-cover', ['protector de contacto', 'tapa de enchufe', 'seguridad infantil', 'a prueba de niños', 'outlet cover', 'outlet plug', 'childproofing'], [plate, circ(12, 12, 5), capsule(10.13, 10.75, 3.75, 2.5)]);
  FILL['outlet-cover'] = { solid: [0], cut: [1, 2] };
  PARTS['outlet-cover'] = { plate: [0], cap: [1, 2] };
}

// Cabinet lock: two cabinet doors side by side and the U-shaped lock looping their knobs together (a
// piece on top: the engine clears the doors' seam around it)
{
  const cabinet = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
  const knobs = [dot(9.5, 8.75), dot(14.5, 8.75)];
  const u = `M9.5 8.75V14${arcTo(12, 14, 2.5, 180, 0).replace('A', 'A')}V8.75`;
  add('cabinet-lock', ['seguro de gabinete', 'seguro de cajón', 'a prueba de niños', 'seguridad infantil', 'cabinet lock', 'drawer lock', 'childproof lock'], [cabinet, vl(12, 3.25, 20.75)], {
    badge: { d: [u, ...knobs], knock: `${shut(u)}${knobs.join('')}`, fill: { solid: knobs, wire: [u] } },
  });
  FILL['cabinet-lock'] = { solid: [0], cut: [1] };
  PARTS['cabinet-lock'] = { cabinet: [0], seam: [1] };
}

// ── Pregnancy and growth ──────────────────────────────────────────────────────────────────────
// Pregnancy test: the stick on the diagonal, its narrow absorbent tip, and the result window with its
// two lines (drawn level, then turned)
{
  const T = (d) => turnPath(d, -45);
  const stick = roundpoly([[2.75, 10.25], [8.5, 10.25], [8.5, 8.25], [21.25, 8.25], [21.25, 15.75], [8.5, 15.75], [8.5, 13.75], [2.75, 13.75]], [1.75, 0.5, 0.75, 3.75, 3.75, 0.75, 0.5, 1.75]);
  const win = sq(11, 10.75, 8, 2.5, 1.25);
  add('pregnancy-test', ['prueba de embarazo', 'test de embarazo', 'resultado', 'positivo', 'pregnancy test', 'test result', 'positive'], [stick, win, vl(13.5, 10.75, 13.25), vl(16.5, 10.75, 13.25)].map(T));
  FILL['pregnancy-test'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['pregnancy-test'] = { stick: [0], window: [1], result: [2, 3] };
}

// Growth chart: two axes and three percentile curves fanning up from a point near the origin, a dot
// on the middle one (the child's measurement)
{
  const o = [6.25, 17.75];
  const curves = [
    [[6.75, 9.5], [12.5, 4.5], [20.75, 4.25]],
    [[10.5, 12.75], [14.5, 10], [20.75, 9.75]],
    [[12, 16.25], [16, 14.75], [20.75, 15]],
  ].map(([a, b, c]) => `M${pt(o)}C${pt(a)} ${pt(b)} ${pt(c)}`);
  const at = (t) => [0, 1].map((i) => (1 - t) ** 3 * o[i] + 3 * (1 - t) ** 2 * t * [10.5, 12.75][i] + 3 * (1 - t) * t * t * [14.5, 10][i] + t ** 3 * [20.75, 9.75][i]);
  add('growth-chart', ['curva de crecimiento', 'percentiles', 'peso y talla', 'desarrollo', 'growth chart', 'percentile', 'height and weight'], [line([3.25, 3.25], [3.25, 20.75], [20.75, 20.75]), ...curves, dot(...at(0.55))]);
  FILL['growth-chart'] = false;
  PARTS['growth-chart'] = { axes: [0], curves: [1, 2, 3], mark: [4] };
}

// Height chart: a ruler with its ticks, a child standing beside it and the flat marker resting on the
// child's head
{
  const ruler = sq(2.75, 2.75, 6.5, 18.5, 1.75);
  const ticks = [6.5, 10, 13.5, 17].map((y, i) => hl(y, i % 2 ? 7 : 5.75, 9.25));
  const head = circ(16, 10.25, 2.5);
  const body = roundpoly([[13.5, 15.25], [18.5, 15.25], [18.5, 21.25], [13.5, 21.25]], [2.25, 2.25, 0.75, 0.75]);
  add('height-chart', ['medir estatura', 'tabla de estatura', 'altura mínima', 'crecimiento', 'height chart', 'height measure', 'minimum height'], [ruler, ...ticks, hl(5.25, 9.25, 19), head, body]);
  FILL['height-chart'] = { solid: [0, 6, 7], cut: [1, 2, 3, 4], wire: [5] };
  PARTS['height-chart'] = { ruler: [0, 1, 2, 3, 4], marker: [5], child: [6, 7] };
}

// Baby scale: a curved cradle tray on a short stem over a flat base, the display on the base's front
{
  const tray = 'M2.75 7.25H21.25C21.25 9.5 17.5 11.25 12 11.25C6.5 11.25 2.75 9.5 2.75 7.25Z';
  const base = sq(3.25, 13.5, 17.5, 7.75, 3, BR);
  const display = sq(9, 15.75, 6, 3.25, 1.25);
  add('baby-scale', ['báscula para bebé', 'pesar al bebé', 'peso al nacer', 'control de peso', 'baby scale', 'infant scale', 'birth weight'], [tray, vl(12, 11.25, 13.5), base, display]);
  FILL['baby-scale'] = { solid: [0, 2], wire: [1], cut: [3] };
  PARTS['baby-scale'] = { tray: [0], stem: [1], base: [2], display: [3] };
}

// ── Clothes ───────────────────────────────────────────────────────────────────────────────────
// Onesie, from the front: short sleeves (each cuff square to its sleeve, the underside running up to
// the armpit), the neckline with its envelope shoulders folded over, the body narrowing at the legs
// to the snap tab at the crotch. (A sleeve hem that doubled back on itself left a knot at each armpit.)
{
  const half = [[9.25, 3.25], [6, 4.25], [2.75, 7.75], [5, 10.25], [7.25, 9.25], [7.25, 14.75], [10, 18.5], [10, 21.25]];
  const pts = [...half, ...half.slice().reverse().map(([x, y]) => [24 - x, y])];
  const r = [0.5, 1.5, 1, 1, 0.6, 2.5, 1.5, 0.5];
  const outline = roundpoly(pts, [...r, ...r.slice().reverse()]);
  const neck = 'M9.25 3.25C9.75 5.25 14.25 5.25 14.75 3.25';
  add('onesie', ['pañalero', 'body', 'mameluco', 'ropa de bebé', 'onesie', 'bodysuit', 'baby clothes'], [outline, neck, hl(19.5, 10, 14)]);
  FILL.onesie = { solid: [0], cut: [1, 2] };
  PARTS.onesie = { body: [0], neck: [1], snap: [2] };
}

// Booties, in profile: a soft bootie with a round toe, its cuff folded over at the top, wider than the
// ankle, and a bow tied at the front of the cuff (a piece on top: the engine clears the bootie under
// its loops)
{
  const bootie = roundpoly([[4.75, 8.5], [12.25, 8.5], [12.25, 12], [20.5, 14.5], [20.5, 20.75], [4.75, 20.75]], [0, 0, 2.5, 3.5, 2.5, 2.5]);
  const cuff = sq(3.5, 4, 10, 4.5, 2);
  const lobes = ['M13.75 8.75C12.75 6.5 10.5 6.75 10.75 8.5C11 10.25 13 9.75 13.75 8.75Z', 'M13.75 8.75C14.75 6.5 17 6.75 16.75 8.5C16.5 10.25 14.5 9.75 13.75 8.75Z'];
  add('baby-booties', ['zapatitos', 'botitas', 'calcetines de bebé', 'ropa de bebé', 'baby booties', 'baby shoes', 'booties'], [bootie, cuff], {
    badge: { d: lobes, knock: lobes.join(''), fill: { solid: lobes } },
  });
  FILL['baby-booties'] = { solid: [0, 1], cut: [hl(8.5, 4.75, 12.25)] };
  PARTS['baby-booties'] = { bootie: [0], cuff: [1] };
}

// ── Fill, parts, motion, mirror and variants, in blocks ───────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (!spec) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// The head is already a circle: no circle around it. The outlet's plate and the cabinet are already
// squares (dispositivos' outlet turns its square off too)
for (const name of ['baby', 'baby-plus', 'baby-lock', 'baby-crying']) icons[name].variants = { circle: false };
for (const name of ['outlet-cover', 'cabinet-lock']) icons[name].variants = { square: false };

// ── Mirror ────────────────────────────────────────────────────────────────────────────────────
// Directional: the figures and everything seen from the side face one way and flip in right-to-left
// languages (the strollers roll, the seats face forward, the chart grows); the restroom sign, the
// faces and the objects seen from the front stay as they are
for (const name of ['baby-crawling', 'tummy-time', 'baby-walking', 'pregnancy', 'fetus', 'breastfeeding', 'baby-carrier', 'high-chair', 'potty', 'stroller', 'stroller-double', 'car-seat', 'car-seat-check', 'car-seat-alert', 'car-seat-infant', 'baby-booties', 'growth-chart'])
  icons[name].mirror = true;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// Each one's own gesture: the cradle and the swaddle rock, the swing and the mobile swing from where
// they hang, the rattle shakes from its handle, the strollers and the figures move the way they
// face, the monitors and the sound machine pulse their waves, steam, powder, bubbles and smells
// float up, the scale's tray sinks, the height marker settles on the head
Object.assign(icons['baby-crying'], { motion: { effect: 'wiggle', origin: [12, 21] } });
Object.assign(icons['baby-swaddled'], { motion: { effect: 'wiggle', origin: [13, 13] } });
Object.assign(icons['baby-sleep'], { motion: { effect: 'float', parts: ['moon'], vector: [0, -1.25] } });
Object.assign(icons['baby-crawling'], { motion: { effect: 'slide', vector: [1.5, 0] } });
Object.assign(icons['baby-walking'], { motion: { effect: 'slide', vector: [1.5, 0] } });
Object.assign(icons['baby-monitor'], { motion: { effect: 'beat', parts: ['wave'], origin: [12, 12] } });
Object.assign(icons['baby-monitor-alert'], { motion: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] } });
Object.assign(icons['car-seat-alert'], { motion: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] } });
Object.assign(icons['baby-on-board'], { motion: { effect: 'ring', origin: [12, 3] } });
Object.assign(icons.cradle, { motion: { effect: 'wiggle', origin: [12, 20.75] } });
Object.assign(icons['crib-mobile'], { motion: { effect: 'ring', origin: [12, 1.75] } });
Object.assign(icons['baby-swing'], { motion: { effect: 'ring', parts: ['ropes', 'seat'], origin: [12, 3.25] } });
Object.assign(icons.rattle, { motion: { effect: 'wiggle', origin: [12, 18.5] } });
Object.assign(icons['sound-machine'], { motion: { effect: 'beat', parts: ['wave'], origin: [12, 18] } });
Object.assign(icons.lullaby, { motion: { effect: 'float', parts: ['note'], vector: [0, -1.5] } });
Object.assign(icons['nursery-light'], { motion: { effect: 'beat', parts: ['glow'], origin: [14.25, 9.25] } });
for (const [name, part] of [['bottle-warmer', 'steam'], ['bottle-sterilizer', 'steam'], ['diaper-dirty', 'smell'], ['diaper-wet', 'drop'], ['baby-powder', 'powder'], ['baby-bath', 'bubbles']])
  icons[name].motion = { effect: 'float', parts: [part], vector: [0, -1.25] };
Object.assign(icons['baby-wipes'], { motion: { effect: 'bounce', parts: ['wipe'], vector: [0, -1.5] } });
for (const name of ['stroller', 'stroller-double']) icons[name].motion = { effect: 'slide', vector: [-1.5, 0] };
Object.assign(icons['baby-scale'], { motion: { effect: 'bounce', parts: ['tray', 'stem'], vector: [0, 1] } });
Object.assign(icons['height-chart'], { motion: { effect: 'bounce', parts: ['marker'], vector: [0, -1.5] } });
Object.assign(icons['play-gym'], { motion: { effect: 'ring', parts: ['strings', 'toys'], origin: [12, 3.25] } });

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these still turned to mush. Their own drawings
// run through pixel centers (0.75 + 1.5k) and keep a pixel of paper between pieces: the face on the
// r 8.25 circle (comunicacion's small faces), its curl a three-pixel hook, its eyes 2 × 2 pixels and
// its smile a run of four; a smaller face keeps a two-step curl and a v of a smile. Parts that read
// as they are keep the engine's snap, and a badge is the engine's pixel badge.
const PX = (k) => 0.75 + 1.5 * k;
{
  const head = circ(12, 12, 8.25);
  const curl = `M${f(PX(8))} ${f(PX(2))}L${f(PX(9))} ${f(PX(3))}V${f(PX(4))}L${f(PX(8))} ${f(PX(5))}H${f(PX(7))}`;
  const eyes = [dot(9, 12, 0.8), dot(15, 12, 0.8)];
  const smile = line([PX(6), PX(10)], [PX(7), PX(11)], [PX(8), PX(11)], [PX(9), PX(10)]);
  icons.baby.small = { d: [head, curl, ...eyes, smile], fill: { solid: [head], cut: [curl, ...eyes, smile] } };
  // Crying: the chevrons three pixels tall, the wail a round 2 × 2 mouth
  const squint = [line([PX(5), PX(6)], [PX(6), PX(7)], [PX(5), PX(8)]), line([PX(10), PX(6)], [PX(9), PX(7)], [PX(10), PX(8)])];
  const mouth = dot(12, 16.5, 0.8);
  icons['baby-crying'].small = { d: [head, curl, ...squint, mouth], fill: { solid: [head], cut: [curl, ...squint, mouth] } };
}
// The small face: the r 7.5 circle with its extremes on pixel centers, a two-step curl, 2 × 2 eyes
// and a v smile, each a pixel of paper from the next
const smallFace = (cx, cy) => {
  const head = circ(cx, cy, 7.5);
  const curl = line([cx, cy - 7.5], [cx + 1.5, cy - 6], [cx, cy - 4.5]);
  const eyes = [dot(cx - 2.25, cy - 0.75, 0.8), dot(cx + 2.25, cy - 0.75, 0.8)];
  const smile = line([cx - 1.5, cy + 3], [cx, cy + 4.5], [cx + 1.5, cy + 3]);
  return { head, curl, eyes, smile, d: [head, curl, ...eyes, smile] };
};
{
  const s = smallFace(PX(6), PX(6));
  for (const name of ['baby-plus', 'baby-lock'])
    icons[name].small = { d: s.d, fill: { solid: [s.head], cut: [s.curl, ...s.eyes, s.smile] }, badge: badge(icons[name].badge.kind, { size: 16 }) };
  // Twins: the back head keeps its curl; the front face, the piece on top, is the small face
  const back = circ(PX(5), PX(5), 6);
  const backCurl = line([PX(5), PX(1)], [PX(6), PX(2)], [PX(5), PX(3)]);
  const front = smallFace(PX(10), PX(10));
  icons.twins.small = {
    d: [back, backCurl],
    fill: { solid: [back], cut: [backCurl] },
    badge: { d: front.d, knock: front.head, fill: { solid: [front.head], cut: [front.curl, ...front.eyes, front.smile] } },
  };
}
// Swaddled and asleep: the small face (the swaddle's, in front of the wrap, its piece on top), the
// wrap's tail on pixel centers without its fold; asleep, the eyes two-pixel dashes and the mouth one
// pixel, the moon keeping the engine's snap
{
  const s = smallFace(PX(6), PX(6));
  const wrap = hull([PX(7), PX(7)], 6, [PX(10), PX(10)], 4.5).d;
  icons['baby-swaddled'].small = { d: [wrap], fill: { solid: [wrap] }, badge: { d: s.d, knock: s.head, fill: { solid: [s.head], cut: [s.curl, ...s.eyes, s.smile] } } };
  const z = smallFace(PX(6), PX(9));
  const shut = [hl(PX(9), PX(4), PX(5)), hl(PX(9), PX(7), PX(8))];
  const mouth = circ(PX(6), PX(11), 0.1);
  const moonD = snapper([icons['baby-sleep'].d[5]])(icons['baby-sleep'].d[5]);
  icons['baby-sleep'].small = { d: [z.head, z.curl, ...shut, mouth, moonD], fill: { solid: [z.head, moonD], cut: [z.curl, ...shut, mouth] } };
}
// Footprints: each sole a four-pixel capsule and two one-pixel toes a pixel of paper above it (the
// snapped arc of three dense toes ran into the sole as a T)
{
  const soles = [capsule(PX(3), PX(6), 4.5, 10.5), capsule(PX(9), PX(6), 4.5, 10.5)];
  const toes = [PX(3), PX(5), PX(10), PX(12)].map((x) => circ(x, PX(4), 0.1));
  icons['baby-feet'].small = { d: [...soles, ...toes], fill: { solid: [...soles, ...toes] } };
}
// The car seat under a badge: a compact seat facing left, its headrest wing, seat and back on pixel
// rows, kept up and to the left out of the pixel badge's reach (the snapped one broke into crumbs)
{
  const seat = roundpoly([[PX(7), PX(1)], [PX(7), PX(8)], [PX(2), PX(8)], [PX(2), PX(6)], [PX(5), PX(6)], [PX(5), PX(4)], [PX(4), PX(4)], [PX(4), PX(1)]], 0.4);
  for (const name of ['car-seat-check', 'car-seat-alert']) icons[name].small = { d: [seat, hl(PX(10), PX(2), PX(7))], fill: { solid: [seat], wire: [hl(PX(10), PX(2), PX(7))] }, badge: badge(icons[name].badge.kind, { size: 16 }) };
}

export default { category: 'bebes', label: 'Bebés y niños', icons };
