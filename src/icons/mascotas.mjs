// Pets: dogs and cats, small pets and fish, their food, toys, gear, homes and care. Everything is
// computed with the engine (engine/geometry.mjs) and the rules in DESIGN.md: a 1.5 stroke, keylines,
// continuous corners and a square bottom-right corner on containers. The category adopts lugares'
// `cat` and `paw` (drawn there, never redrawn): the cat's head is the one in cat-meow, pets, kitten
// and cat-sleeping, and every paw-* badge and *-paw icon is lugares' paw (in a container, its pad
// with the toes as a dense group of dots, so they stay apart at 2.1). The dog is one head for every
// dog-* icon, built to sit beside the cat at its size: a broad skull, floppy ears that answer the
// cat's pointed ones, eyes, a nose and a short muzzle; the rabbit is the third head, its long ears
// upright. Badges are the engine's; a piece on top of another (a tub, a bowl, the dog in front of
// the cat, the cat's head in front of its back) is a custom badge and the engine clears what it covers.
import { arc, badge, circ, dot, f, flipPath, halfChord, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

const L = lugares.icons;

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
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

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

/** Ellipse with semi-axes rx, ry (four cubics), as lugares'. */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const P = (x, y) => pt([cx + x, cy + y]);
  return `M${P(rx, 0)}C${P(rx, k * ry)} ${P(k * rx, ry)} ${P(0, ry)}C${P(-k * rx, ry)} ${P(-rx, k * ry)} ${P(-rx, 0)}C${P(-rx, -k * ry)} ${P(-k * rx, -ry)} ${P(0, -ry)}C${P(k * rx, -ry)} ${P(rx, -k * ry)} ${P(rx, 0)}Z`;
}

/** Intersections of two circles [x, y, r]: the two points, the first counterclockwise of the line between centers. */
function meet2([x1, y1, r1], [x2, y2, r2]) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  return [
    [m[0] - (h * (y2 - y1)) / d, m[1] + (h * (x2 - x1)) / d],
    [m[0] + (h * (y2 - y1)) / d, m[1] - (h * (x2 - x1)) / d],
  ];
}

/** Closes every open subpath, for `fill.solid` (only closed shapes are filled). */
const shut = (d) =>
  d
    .split(/(?=M)/)
    .map((s) => (/Z\s*$/i.test(s) ? s : `${s}Z`))
    .join('');

/** A path scaled by `s` around `o` and moved so that `o` lands on `at`. */
const xf = (d, s, o, at = o) => transform(d, s, at[0] - o[0] * s, at[1] - o[1] * s);
/** The same for a point. */
const xp = (p, s, o, at = o) => [at[0] + (p[0] - o[0]) * s, at[1] + (p[1] - o[1]) * s];

// ── The heads ─────────────────────────────────────────────────────────────────────────────────
// The dog: a broad skull narrowing to the muzzle, the floppy ears hanging from its top corners
// down the sides, flaring as they fall (open strokes that leave the skull and come back to its
// side), two eyes, the nose (a dot, as the eyes: a small closed shape would keep a sliver of a hole
// at some weights) and the mouth hanging from it. Drawn at 1 around HEAD_O; `dogHead(at, s)` scales
// it, the dots keep their size and the nose its paper from the eyes. Its smallest is 0.7.
const HEAD_O = [12, 12.4];
const DOG = (() => {
  // The skull: a flat top with round corners (r 4 about [10, 8] and [14, 8]), straight sides and a
  // muzzle that narrows to the chin
  const face = 'M6 8A4 4 0 0 1 10 4H14A4 4 0 0 1 18 8V13.5C18 18 15.5 20.75 12 20.75S6 18 6 13.5Z';
  // The ear leaves the corner's arc and comes back to the straight side, so its hole is closed by
  // the skull itself at every weight
  const A = polar(10, 8, 4, -150);
  const ear = roundline([A, [3.5, 6.25], [2.25, 16.5], [6, 13]], [0, 2.25, 1.6, 0]);
  return { face, ear, eyes: [[9.7, 10.25], [14.3, 10.25]], nose: [12, 13.25], mouth: 'M12 13.25V15.5A1.4 1.4 0 0 1 9.2 15.5M12 15.5A1.4 1.4 0 0 0 14.8 15.5' };
})();
function dogHead(at = HEAD_O, s = 1) {
  const g = (d) => xf(d, s, HEAD_O, at);
  // A small head is a dense group: its eyes and nose take the r 0.3 dots, and the nose drops so the
  // three keep their paper at 2.1
  const r = s < 0.82 ? 0.3 : 0.7;
  const eyes = DOG.eyes.map((p) => xp(p, s, HEAD_O, at));
  const nose = xp(DOG.nose, s, HEAD_O, at);
  const need = 2 * (r + 1.05) + 0.25;
  nose[1] = Math.max(nose[1], eyes[0][1] + Math.sqrt(Math.max(0, need ** 2 - (nose[0] - eyes[0][0]) ** 2)));
  const face = [g(DOG.face), g(DOG.ear), g(flipPath(DOG.ear)), ...[...eyes, nose].map((p) => dot(...p, r))];
  // Under 0.9 the mouth would clog the muzzle: the nose says it alone
  return s < 0.9 ? face : [...face, g(DOG.mouth)];
}
/** The dog's silhouette (the skull and both ears, closed): what it clears when it sits in front. */
const dogKnock = (at, s) => {
  const h = dogHead(at, s);
  return `${h[0]}${shut(h[1])}${shut(h[2])}`;
};
// The cat is lugares' (its outline and mouth scaled; the eyes stay the set's dots). Its smallest is 0.6.
const CAT_O = [12, 12.75];
function catHead(at = CAT_O, s = 1) {
  const g = (d) => xf(d, s, CAT_O, at);
  // As the dog's: a small head takes the r 0.3 dots, and under 0.75 the mouth would clog its eyes
  const eyes = [[9, 13], [15, 13]].map((p) => dot(...xp(p, s, CAT_O, at), s < 0.7 ? 0.3 : 0.7));
  return { face: g(L.cat.d[0]), eyes, mouth: s < 0.75 ? null : g(L.cat.d[3]) };
}
/** Sound: two arcs like the speaker's waves, around `c`. */
const sound = (c, r1 = 3.75, r2 = 6.75, a = 40) => [arc(...c, r1, -a, a).d, arc(...c, r2, -a, a).d];

// ── The paw ───────────────────────────────────────────────────────────────────────────────────
// lugares' paw: a pad and four ring toes. Scaled down, its toes would merge at 2.1 (they keep
// 1 of paper at regular, 0.4 at bold), so a smaller paw keeps their gaps instead of their size.
const PAW_O = [12, 12];
/**
 * lugares' paw at `s` about PAW_O, moved to `at`: the toes keep the radius `tr` and the inner pair
 * stands `spread` apart (6 in lugares), so they keep their paper and their holes at every weight.
 */
function pawAt(at, s = 1, { tr = 1.75 * s, spread = 6 } = {}) {
  const P = (x, y) => xp([x, y], s, PAW_O, at);
  const toes = [[4.75, 11.25], [12 - spread / 2, 6], [12 + spread / 2, 6], [19.25, 11.25]].map((p) => circ(...P(...p), tr));
  return [xf(L.paw.d[0], s, PAW_O, at), ...toes];
}
/**
 * The paw inside a container (a pin, a house, a page): the same pad, its corners as round as
 * lugares', and the toes as dots, a dense group of four (r 0.3, `r` to change it) spread so they
 * stay apart at 2.1. Centered on its box (10 × 7.8 at regular); `k` scales it.
 */
function miniPaw([cx, cy], k = 1, r = 0.3) {
  const P = ([x, y]) => [cx + x * k, cy + y * k];
  const pad = roundpoly([[-1.1, 0.25], [1.1, 0.25], [2.6, 2.85], [-2.6, 2.85]].map(P), [0.9 * k, 0.9 * k, 1 * k, 1 * k]);
  return [pad, ...[[-4, -0.55], [-1.55, -2.85], [1.55, -2.85], [4, -0.55]].map((p) => dot(...P(p), r))];
}
/**
 * A small fish (an aquarium's, a bowl's): a lens of a body, pointed at the nose, and a triangle of a
 * tail from its back end, 13 long at `k` 1 and centered on `c`. Small, an oval with its tail open in
 * a V read as the letter α, and lugares' drop of a body with its tail as ∞; a notch in the tail
 * pinched its hole in two at 2.1.
 */
function smallFish([cx, cy], k = 1) {
  const P = (x, y) => [cx + x * k, cy + y * k];
  const body = `M${pt(P(-6.5, 0))}C${pt(P(-4.5, -3.5))} ${pt(P(0, -3.5))} ${pt(P(2, 0))}C${pt(P(0, 3.5))} ${pt(P(-4.5, 3.5))} ${pt(P(-6.5, 0))}Z`;
  const tail = roundpoly([P(2, 0), P(6.5, -3), P(6.5, 3)], [0.3, 0.6, 0.6]);
  return [body, tail];
}
// Under a badge the paw moves up and left at 0.82, its inner toes a little wider apart, so its four
// toes stay whole and the badge takes only the pad's corner (as Núcleo's person moves aside).
const PAW_B = pawAt([9.7, 8.7], 0.82, { tr: 1.45, spread: 6.5 });

// ── Bones ─────────────────────────────────────────────────────────────────────────────────────
/**
 * Bone: a shaft between two knobs of two lobes each, drawn along x and turned `deg` about its
 * center. `a` is each lobe's distance from the center along the bone, `b` across it, `r` its
 * radius and `h` half the shaft's width (1.5 or more, so the shaft keeps its paper at 2.1).
 */
function bone([cx, cy], { a, b, r, h, deg = 0 }) {
  const x1 = a - Math.sqrt(r * r - (b - h) ** 2);
  const n = a + Math.sqrt(r * r - b * b);
  const P = (x, y) => pt(rot([cx + x, cy + y], [cx, cy], deg));
  const R = f(r);
  return `M${P(-x1, -h)}L${P(x1, -h)}A${R} ${R} 0 1 1 ${P(n, 0)}A${R} ${R} 0 1 1 ${P(x1, h)}L${P(-x1, h)}A${R} ${R} 0 1 1 ${P(-n, 0)}A${R} ${R} 0 1 1 ${P(-x1, -h)}Z`;
}
/**
 * A small bone, solid at every weight: a line with two dots at each end, close enough to merge
 * with it at 0.9 (a knob, a logo on a bag, a tag's charm).
 */
function smallBone([cx, cy], a, deg = 0) {
  const P = (x, y) => rot([cx + x, cy + y], [cx, cy], deg);
  return [line(P(-a, 0), P(a, 0)), ...[[-a, -0.9], [-a, 0.9], [a, -0.9], [a, 0.9]].map(([x, y]) => dot(...P(x, y)))];
}

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};
/** Fill specs collected as the icons are drawn (by index of `d`; `close` shuts the solid ones). */
const FILL = {};

// ── Dogs and cats: the heads ──────────────────────────────────────────────────────────────────
// By index: 0 skull, 1–2 ears, 3–4 eyes, 5 nose, 6 mouth (when the head carries it).
const DOG_FILL = (n) => ({ solid: [0], wire: [1, 2], cut: range(3, n) });
{
  const h = dogHead();
  add('dog', ['perro', 'mascota', 'canino', 'dog', 'pet', 'canine'], h);
  FILL.dog = DOG_FILL(7);
  // With the badge the head moves up and left at 0.78, so the badge takes only the cheek and ear
  add('dog-alert', ['perro bravo', 'cuidado con el perro', 'perro en casa', 'beware of dog', 'dog alert', 'reactive dog'], dogHead([9.5, 9.6], 0.78), { badge: badge('alert') });
  FILL['dog-alert'] = DOG_FILL(6);
}
{
  // Barking and meowing: the head on the left and two waves at its right, flatter than the
  // speaker's (±30°) so they clear the dog's ear
  const waves = sound([14.1, 12.9], 5, 8, 30);
  const h = dogHead([8.6, 12.4], 0.7);
  add('dog-bark', ['ladrido', 'perro ladrando', 'ruido', 'bark', 'barking', 'dog noise'], [...h, ...waves]);
  FILL['dog-bark'] = { solid: [0], wire: [1, 2], cut: [3, 4, 5], lines: [6, 7] };
  const c = catHead([9, 12.75], 0.74);
  add('cat-meow', ['maullido', 'gato maullando', 'sonido', 'meow', 'meowing', 'cat sound'], [c.face, ...c.eyes, ...waves]);
  FILL['cat-meow'] = { solid: [0], cut: [1, 2], lines: [3, 4] };
}
{
  // Dog and cat: the cat behind, up and left, the dog in front, down and right (a custom badge). They
  // overlap only at the cat's cheek and the dog's ear, so both faces keep their eyes at every weight
  // (the dog no smaller than 0.66: its eyes stay 3 apart, apart at 2.1)
  const [dAt, ds] = [[15.75, 15.75], 0.66];
  const c = catHead([6.6, 7.1], 0.62);
  const h = dogHead(dAt, ds);
  add('pets', ['mascotas', 'perro y gato', 'mis mascotas', 'pets', 'my pets', 'dog and cat'], [c.face, ...c.eyes], {
    badge: { d: h, knock: dogKnock(dAt, ds), fill: { solid: [h[0]], wire: [h[1], h[2]], cut: h.slice(3) } },
  });
  FILL.pets = { solid: [0], cut: [1, 2] };
}
{
  // Pet detection: ia's focus corners around the dog's head
  const frame = 'M16.25 3.29C17.13 3.35 17.76 3.47 18.29 3.74A4.5 4.5 0 0 1 20.26 5.71C20.53 6.24 20.65 6.87 20.71 7.75M20.71 16.25C20.65 17.13 20.53 17.76 20.26 18.29A4.5 4.5 0 0 1 18.29 20.26C17.76 20.53 17.13 20.65 16.25 20.71M7.75 20.71C6.87 20.65 6.24 20.53 5.71 20.26A4.5 4.5 0 0 1 3.74 18.29C3.47 17.76 3.35 17.13 3.29 16.25M3.29 7.75C3.35 6.87 3.47 6.24 3.74 5.71A4.5 4.5 0 0 1 5.71 3.74C6.24 3.47 6.87 3.35 7.75 3.29';
  add('pet-detection', ['detección de mascota', 'animal detectado', 'cámara', 'pet detection', 'animal alert', 'camera'], [frame, ...dogHead([12, 12.5], 0.72)]);
  FILL['pet-detection'] = { solid: [1], wire: [2, 3], cut: [4, 5, 6], lines: [0] };
}

// ── The paw with the engine's badges ──────────────────────────────────────────────────────────
for (const [name, kind, tags] of [
  ['paw-plus', 'plus', ['agregar mascota', 'nueva mascota', 'perfil de mascota', 'add pet', 'new pet']],
  ['paw-check', 'check', ['mascotas permitidas', 'pet friendly', 'mascota verificada', 'pets allowed', 'verified pet']],
  ['paw-heart', 'heart', ['adoptar', 'mascota favorita', 'amo a mi mascota', 'adopt', 'favorite pet', 'pet lover']],
  ['paw-search', 'search', ['buscar mascota', 'mascota perdida', 'adopción', 'find a pet', 'lost pet', 'adoption search']],
  ['paw-alert', 'alert', ['mascota perdida', 'emergencia', 'alerta de mascota', 'lost pet alert', 'pet emergency']],
  ['paw-edit', 'edit', ['editar mascota', 'datos de mascota', 'perfil', 'edit pet', 'pet details', 'pet profile']],
]) {
  add(name, tags, PAW_B, { badge: badge(kind) });
  FILL[name] = { solid: [0, 1, 2, 3, 4] };
}

// ── Bones ─────────────────────────────────────────────────────────────────────────────────────
add('bone', ['hueso', 'premio', 'golosina', 'bone', 'dog treat', 'chew'], [bone([12, 12], { a: 5.25, b: 1.75, r: 2.25, h: 1.5, deg: -45 })]);
FILL.bone = { solid: [0] };
{
  // Fish skeleton facing left: the head (a half disc), the spine, three ribs that shorten toward
  // the tail, and the forked tail
  const head = 'M7.5 7.25A4.75 4.75 0 0 0 7.5 16.75Z';
  add('fish-bone', ['espina de pescado', 'comida de gato', 'sobras', 'fish bone', 'cat food', 'leftovers'], [
    head,
    hl(12, 7.5, 18.5),
    vl(10.5, 8.5, 15.5),
    vl(13.5, 9, 15),
    vl(16.5, 9.75, 14.25),
    roundline([[21.25, 8.75], [18.5, 12], [21.25, 15.25]], [0, 0.6, 0]),
  ]);
  FILL['fish-bone'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
}

// ── Food and water ────────────────────────────────────────────────────────────────────────────
// The bowl, from the side: low, and wider at the base than at the rim (taller, it read as a bag).
// Kibble heaps over the rim as three rounded lumps; water is a wave inside, from side to side.
const BOWL = roundpoly([[6.25, 13.25], [17.75, 13.25], [20.75, 20], [3.25, 20]], [1, 1, 1.5, 1.5]);
/** Lumps: the tops of three circles, from where the first meets `y` to where the last does. */
function lumps(cs, y) {
  const meetC = ([x1, y1, r1], [x2, y2, r2]) => {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const m = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
    const p = [m[0] + (hh * (y2 - y1)) / d, m[1] - (hh * (x2 - x1)) / d];
    const q = [m[0] - (hh * (y2 - y1)) / d, m[1] + (hh * (x2 - x1)) / d];
    return p[1] < q[1] ? p : q;
  };
  const [first, last] = [cs[0], cs[cs.length - 1]];
  let d = `M${pt([first[0] - Math.sqrt(first[2] ** 2 - (y - first[1]) ** 2), y])}`;
  for (let i = 0; i < cs.length; i++) {
    const to = i < cs.length - 1 ? meetC(cs[i], cs[i + 1]) : [last[0] + Math.sqrt(last[2] ** 2 - (y - last[1]) ** 2), y];
    d += `A${f(cs[i][2])} ${f(cs[i][2])} 0 0 1 ${pt(to)}`;
  }
  return d;
}
const KIBBLE = lumps([[9.25, 12.5, 2], [12, 10.75, 2.25], [14.75, 12.5, 2]], 13.25);
const RIM = hl(13.25, 5.5, 18.5);
{
  add('pet-bowl', ['comedero', 'plato de comida', 'croquetas', 'pet bowl', 'food bowl', 'feeding'], [BOWL, KIBBLE]);
  FILL['pet-bowl'] = { solid: [0, 1], cut: [RIM], close: true };
  // With the clock the bowl moves up and left at 0.85: the badge takes its base, never the heap
  add('pet-bowl-clock', ['horario de comida', 'próxima comida', 'recordatorio', 'feeding schedule', 'next meal', 'reminder'], [BOWL, KIBBLE].map((d) => xf(d, 0.85, [12, 16], [10.25, 13.25])), { badge: badge('clock') });
  FILL['pet-bowl-clock'] = { ...FILL['pet-bowl'], cut: [xf(RIM, 0.85, [12, 16], [10.25, 13.25])] };
  // Water: a wave of four crests (amplitude 0.6, halfway down: 2.78 from the rim and the base) that
  // meets both walls
  const y = 16.63;
  const xl = 6.25 - (3 * (y - 13.25)) / 6.75;
  const xr = 24 - xl;
  const n = 4;
  const w = (xr - xl) / n;
  let wave = `M${pt([xl, y])}`;
  for (let i = 0; i < n; i++) wave += `C${pt([xl + i * w + w / 3, y + (i % 2 ? 0.8 : -0.8)])} ${pt([xl + i * w + (2 * w) / 3, y + (i % 2 ? 0.8 : -0.8)])} ${pt([xl + (i + 1) * w, y])}`;
  add('pet-bowl-water', ['bebedero', 'plato de agua', 'hidratación', 'water bowl', 'hydration', 'drinking'], [BOWL, wave]);
  FILL['pet-bowl-water'] = { solid: [0], cut: [1] };
}
{
  // Food bag: a standing bag (a container: square bottom-right corner) with its top folded over
  // and a bone on its face
  const bag = sq(5.25, 3.25, 13.5, 18, 3, BR);
  const fold = hl(7.25, 5.25, 18.75);
  const b = smallBone([12, 13.25], 2.5);
  add('pet-food', ['comida para mascota', 'bulto de croquetas', 'alimento', 'pet food', 'dog food', 'food bag'], [bag, fold, ...b]);
  FILL['pet-food'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  // With the sync badge the bag is smaller, up and left, and its bone stays clear of the badge
  const bag2 = sq(3.25, 3.25, 11.5, 15.5, 3, BR);
  const b2 = smallBone([9, 10.5], 2.25);
  add('pet-food-sync', ['envío recurrente', 'suscripción', 'autoenvío', 'autoship', 'subscribe and save', 'recurring delivery'], [bag2, hl(6.25, 3.25, 14.75), ...b2], { badge: badge('sync') });
  FILL['pet-food-sync'] = FILL['pet-food'];
}

// ── Dogs and cats: whole ──────────────────────────────────────────────────────────────────────
// The dog in profile, facing right: one outline for the body, the neck and the head with its snout
// (straight back, deep chest), the dropped ear inside the head, the legs and the tail as strokes,
// as the set draws its figures. The legs stand 3 apart in pairs.
const SIDE = roundpoly(
  [[5, 9.75], [13.5, 9.75], [15, 4.5], [18.25, 4.5], [21.25, 7.25], [21.25, 8.75], [18.75, 9.25], [18, 11.25], [17.75, 15], [9.5, 14.25], [5, 14.75]],
  [2.25, 1, 1.75, 1.25, 0.75, 0.75, 0.6, 1, 2.25, 2, 2.5],
);
// The ear hangs from the top of the head, a short flap clear of its back edge
const SIDE_EAR = vl(16.75, 4.5, 7.5);
{
  const legs = [vl(6.5, 14.6, 20), vl(9.5, 14.25, 20), vl(13.25, 14.6, 20), vl(16.25, 14.95, 20)];
  const tail = 'M5.66 10.4C4.4 9.5 3.5 8 3.25 5.5';
  add('dog-side', ['perro', 'sección de perros', 'se admiten perros', 'dog', 'dogs allowed', 'dog section'], [SIDE, SIDE_EAR, ...legs, tail]);
  FILL['dog-side'] = { solid: [0], cut: [1], wire: [2, 3, 4, 5, 6] };
  // Running: the same body and ear, the front legs reaching forward and the hind legs back, the tail
  // straight out behind (an ear blown back over the neck floated there like a horse's mane)
  const run = [line([12.75, 14.5], [16.25, 19.75]), line([16.25, 14.75], [21, 18]), line([9.5, 14.25], [6, 19.75]), line([6.25, 14.5], [2.75, 17.5])];
  add('dog-running', ['perro corriendo', 'actividad', 'ejercicio', 'dog running', 'activity', 'exercise'], [SIDE, SIDE_EAR, ...run, 'M5.25 11.5C4.25 10.75 3.5 10.5 2.75 10.5'].map((d) => xf(d, 1, [12, 12], [12, 11])));
  FILL['dog-running'] = { solid: [0], cut: [1], wire: [2, 3, 4, 5, 6] };
}
{
  // Dog sitting, in profile: the head and neck of the standing dog, the chest straight down to the
  // front legs, the haunch a round curve on the ground; the tail lies on the floor behind
  const body = roundpoly(
    [[11.75, 9.75], [13.25, 4.75], [16.25, 4.75], [19.25, 7.5], [19.25, 9], [16.5, 9.5], [15.75, 11.25], [16.25, 20.25], [6.25, 20.25], [5.75, 14.5]],
    [1, 1.5, 1.25, 0.75, 0.75, 0.6, 1, 0.75, 1.5, 4],
  );
  add('dog-seated', ['perro sentado', 'sentado', 'adiestramiento', 'sit', 'dog sitting', 'training'], [body, 'M14.75 5C13.75 6.25 13.75 8 14.5 9.25', vl(13.25, 13.25, 20.25), 'M8.25 20.25H2.75']);
  FILL['dog-seated'] = { solid: [0], cut: [1, 2], wire: [3] };
}
{
  // Cat sitting, in profile: two pointed ears, the chest upright down to the front paws, the round
  // haunch behind, and the tail running on from the paws and curling up in front of them
  const body = roundpoly(
    [[16.25, 20.25], [15.75, 11.75], [17.75, 8.25], [17.25, 2.75], [15.25, 4.5], [12.75, 2.75], [11.75, 8.25], [5, 16.5], [7, 20.25]],
    [0.75, 2, 1.5, 0.4, 0.6, 0.4, 2, 4, 2],
  );
  add('cat-seated', ['gato sentado', 'sección de gatos', 'gato', 'cat sitting', 'cat section', 'cat friendly'], [body, 'M15 20.25H18.5A2 2 0 0 0 20.5 18.25V17.5']);
  FILL['cat-seated'] = { solid: [0], wire: [1] };
}

{
  // Puppy, sitting, from the front: the dog's head, oversized (two thirds of its height), on a small
  // body that tucks under the cheeks, two short front legs and a stubby tail at its side
  const h = dogHead([12, 8.25], 0.72);
  const body = roundline([[7.5, 13.25], [5.5, 21], [18.5, 21], [16.5, 13.25]], [0, 2.25, 2.25, 0]);
  add('puppy', ['cachorro', 'perrito', 'adopción', 'puppy', 'young dog', 'puppy food'], [body, vl(10.5, 16.5, 21), vl(13.5, 16.5, 21), line([17.25, 17.75], [20.5, 16])], {
    badge: { d: h, knock: dogKnock([12, 8.25], 0.72), fill: { solid: [h[0]], wire: [h[1], h[2]], cut: h.slice(3) } },
  });
  FILL.puppy = { solid: [0], cut: [1, 2], wire: [3], close: true };
}
{
  // Kitten crouched in profile: lugares' cat head, big, in front of a low body; one front paw
  // reaches out to a small ball, and the short tail rises behind
  const at = [12.75, 8.25];
  const s = 0.6;
  const c = catHead(at, s);
  const body = roundpoly([[4.75, 12.75], [12.5, 12.75], [14.75, 19.75], [3, 19.75]], [2.5, 2, 1, 2.25]);
  add('kitten', ['gatito', 'cría de gato', 'jugar', 'kitten', 'young cat', 'kitten care'], [body, line([13.5, 16.75], [16.75, 14]), circ(19.25, 18.5, 1.75), line([4.25, 16.25], [2.75, 12.75])], {
    badge: { d: [c.face, ...c.eyes], knock: c.face, fill: { solid: [c.face], cut: c.eyes } },
  });
  FILL.kitten = { solid: [0, 2], wire: [1, 3] };
}
{
  // Cat asleep, lying down: its back a long low loaf with the haunch drawn on it (the line runs on
  // behind the head), and lugares' cat head resting in front at the right (a custom badge: it clears
  // the loaf) with its eyes closed, two flat arcs. A short hump with no haunch read as a block
  const [at, s] = [[16.25, 14], 0.74];
  const c = catHead(at, s);
  const eyes = [[9, 13], [15, 13]].map((p) => xp(p, s, CAT_O, at)).map(([x, y]) => arc(x, y - 1.1, 1.5, 50, 130).d);
  const body = 'M2.75 20.25V17.25C2.75 13.75 5.25 11.75 8.75 11.75H15V20.25Z';
  const haunch = 'M5.75 20.25C5.75 17.75 7.25 16.25 9.5 16.25H12.5';
  add('cat-sleeping', ['gato dormido', 'siesta', 'descanso', 'sleeping cat', 'nap', 'idle'], [body, haunch], {
    badge: { d: [c.face, ...eyes], knock: c.face, fill: { solid: [c.face], cut: eyes } },
  });
  FILL['cat-sleeping'] = { solid: [0], cut: [1] };
}

// ── Small pets and fish ───────────────────────────────────────────────────────────────────────
{
  // Rabbit, from the front, one of the pet heads beside the dog's and the cat's: a broad head and
  // two long upright ears that lean out a little, leaving its top edge and coming back to it (their
  // inner edges 3 apart, so the notch holds at 2.1), the eyes and the nose
  const [C, rx, ry] = [[12, 15], 6.75, 5.75];
  const head = ell(C, rx, ry);
  /** Where the line from `p`, inside the head, leaves it along `v`. */
  const meet = (p, v) => {
    const [dx, dy] = [(p[0] - C[0]) / rx, (p[1] - C[1]) / ry];
    const [ux, uy] = [v[0] / rx, v[1] / ry];
    const [a, b, c] = [ux * ux + uy * uy, 2 * (dx * ux + dy * uy), dx * dx + dy * dy - 1];
    const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    return add2(p, mul(v, t));
  };
  const ear = (B, T, w = 1.75) => {
    const ax = unit(sub(T, B));
    const n = [-ax[1], ax[0]];
    const [l, r] = [add2(T, mul(n, -w)), add2(T, mul(n, w))];
    const R = f(w);
    return `M${pt(meet(add2(B, mul(n, -w)), ax))}L${pt(l)}A${R} ${R} 0 0 1 ${pt(r)}L${pt(meet(add2(B, mul(n, w)), ax))}`;
  };
  const ears = [ear([8.75, 11], [7.75, 4.5]), ear([15.25, 11], [16.25, 4.5])];
  add('rabbit', ['conejo', 'mascota pequeña', 'adopción', 'rabbit', 'bunny', 'small pet'], [head, ...ears, dot(9.25, 14.75), dot(14.75, 14.75), dot(12, 17.75)]);
  FILL.rabbit = { solid: [0, `${ears[0]}Z`, `${ears[1]}Z`], cut: [3, 4, 5] };
}
{
  // Goldfish: lugares' fish body (the drop, its corner at the tail), a big double tail that fans out
  // behind it (its notch stands 2.9 from the joint, so the tail stays one shape at 2.1) and a small
  // fin on its back
  const c = [9, 12.25];
  const r = 5.75;
  const J = [c[0] + r * Math.SQRT2, c[1]];
  const body = `M${pt(polar(...c, r, -45))}A${f(r)} ${f(r)} 0 1 0 ${pt(polar(...c, r, 45))}L${pt(J)}Z`;
  const tail = `M${pt(J)}C17.9 9.4 19.4 5.9 21.25 5.25C21.1 8 20.75 10.25 20 12.25C20.75 14.25 21.1 16.5 21.25 19.25C19.4 18.6 17.9 15.1 ${pt(J)}Z`;
  const fin = `M${pt(polar(...c, r, -95))}C9.75 5 11.75 4 14 4C13.25 5 12.75 6.25 ${pt(polar(...c, r, -50))}`;
  add('goldfish', ['pez dorado', 'pecera', 'mascota', 'goldfish', 'pet fish', 'aquarium'], [body, tail, fin, dot(6.75, 11)]);
  FILL.goldfish = { solid: [0, 1], wire: [2], cut: [3] };
}
// ── The paw in the set's containers ───────────────────────────────────────────────────────────
// Each base is the one the set already draws (its own file's path, never redrawn) with the paw,
// as a dense group of dots, in place of its detail: the door, the hole, the globe, the person.
const N = nucleo.icons;
const CM = comercio.icons;
{
  const paw = miniPaw([12, 15]);
  add('house-paw', ['mascotas en casa', 'cuidado en casa', 'acepta mascotas', 'pet sitting', 'pet friendly home', 'pets allowed'], [L.house.d[0], L.house.d[1], ...paw]);
  FILL['house-paw'] = { solid: [0, 1], cut: [2, 3, 4, 5, 6], close: true };
}
{
  const paw = miniPaw([12, 15.25]);
  add('store-paw', ['tienda de mascotas', 'veterinaria', 'tienda', 'pet store', 'pet shop', 'store finder'], [CM.store.d[0], CM.store.d[1], ...paw]);
  FILL['store-paw'] = { solid: [0, CM.store.fill.solid[1]], cut: [2, 3, 4, 5, 6] };
}
{
  const paw = miniPaw([12, 10.25]);
  add('map-pin-paw', ['lugar pet friendly', 'veterinaria cercana', 'parque', 'pet friendly place', 'vet nearby', 'pet map'], [L['map-pin'].d[0], ...paw]);
  FILL['map-pin-paw'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
}
{
  const paw = miniPaw([12, 10.75]);
  add('passport-paw', ['pasaporte de mascota', 'viajar con mascota', 'vacunas', 'pet passport', 'pet travel', 'travel documents'], [L.passport.d[0], ...paw, L.passport.d[3]]);
  FILL['passport-paw'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
}
{
  // The card from comunicacion's id-card; the paw takes the person's half and the two data lines
  // move right, so they keep their paper from the toes
  const paw = miniPaw([9, 12]);
  add('id-card-paw', ['identificación de mascota', 'perfil de mascota', 'credencial', 'pet id', 'pet profile', 'pet card'], [comunicacion.icons['id-card'].d[0], ...paw, hl(10.5, 16.25, 18.5), hl(14, 16.25, 18.5)]);
  FILL['id-card-paw'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7] };
}
{
  const paw = miniPaw([12, 15.25]);
  add('calendar-paw', ['cita veterinaria', 'agenda de mascota', 'estética', 'pet appointment', 'vet visit', 'grooming'], [...N.calendar.d.slice(0, 4), ...paw]);
  FILL['calendar-paw'] = { solid: [0], lines: [1, 2], cut: [3, 4, 5, 6, 7, 8] };
}
{
  const C = archivos.icons.clipboard;
  const paw = miniPaw([12, 13.75], 1.1);
  add('clipboard-paw', ['expediente de mascota', 'historial médico', 'vacunas', 'pet record', 'medical history', 'vaccination record'], [...C.d, ...paw]);
  icons['clipboard-paw'].fill = { solid: C.fill.solid, cut: [...C.fill.cut, ...paw] };
}
{
  const paw = miniPaw([12, 12], 1.1);
  add('shield-paw', ['protección de mascota', 'antipulgas', 'vacunada', 'pet protection', 'flea prevention', 'pet safety'], [N.shield.d[0], ...paw]);
  FILL['shield-paw'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
}
{
  // Veterinary: lugares' paw whose pad is a medical cross, its arms 4 wide
  const [cx, cy, a, h] = [12, 16.5, 2, 4.25];
  const cross = roundpoly(
    [[cx - a, cy - h], [cx + a, cy - h], [cx + a, cy - a], [cx + h, cy - a], [cx + h, cy + a], [cx + a, cy + a], [cx + a, cy + h], [cx - a, cy + h], [cx - a, cy + a], [cx - h, cy + a], [cx - h, cy - a], [cx - a, cy - a]],
    [1, 1, 0.6, 1, 1, 0.6, 1, 1, 0.6, 1, 1, 0.6],
  );
  add('vet', ['veterinario', 'clínica veterinaria', 'consulta', 'vet', 'veterinary', 'animal clinic'], [cross, ...L.paw.d.slice(1)]);
  FILL.vet = { solid: [0, 1, 2, 3, 4] };
}
{
  // Pet care: comercio's open hand (the donation hand, with its cuff) cradling a paw
  const paw = miniPaw([13.75, 7.25], 1.3, 0.7);
  add('pet-care', ['cuidado de mascotas', 'rescate', 'adopción', 'pet care', 'rescue', 'animal welfare'], [...paw, CM.donation.d[1], CM.donation.d[2]]);
  FILL['pet-care'] = { solid: [0, 1, 2, 3, 4, 5, `${CM.donation.d[2]}Z`] };
}
{
  // Pet scale: dog-side's dog standing on a low platform scale with its readout (from above, a paw
  // under a readout read as a face). The readout stands 2.88 from both edges
  add('pet-scale', ['báscula', 'peso de mascota', 'control de peso', 'pet scale', 'pet weight', 'weigh-in'], [sq(2.75, 15.5, 18.5, 5.75, 2, BR), hl(18.38, 9.5, 14.5), ...smallDog([8, 15.5], 0.62)]);
  FILL['pet-scale'] = { solid: [0, 2], cut: [1], wire: [3, 4, 5] };
}
{
  // A trail: two prints climbing to the right, both turned the way they go. Each print is a broad
  // pad under four toe dots in an arc, 3.8 or more apart so they stay apart at 2.1
  const print = (c, deg = 20) => {
    const P = ([x, y]) => rot([c[0] + x, c[1] + y], c, deg);
    const pad = roundpoly([[-1.25, -0.5], [1.25, -0.5], [3, 2.75], [-3, 2.75]].map(P), [1.1, 1.1, 1.2, 1.2]);
    return [pad, ...[[-4.1, -1.6], [-1.9, -4.6], [1.9, -4.6], [4.1, -1.6]].map((p) => dot(...P(p)))];
  };
  add('paw-trail', ['huellas', 'ruta de paseo', 'rastro', 'paw prints', 'walk route', 'tracks'], [...print([7.25, 16.25]), ...print([16.25, 8.25])]);
  FILL['paw-trail'] = { solid: range(0, 10) };
}
// ── Dogs out and about ────────────────────────────────────────────────────────────────────────
/**
 * The standing dog of dog-side, small: its outline and tail scaled about its feet, and two legs
 * instead of four (at this size four would run together). `at` is where its back foot stands.
 */
function smallDog(at, s, { tail = true } = {}) {
  const g = (d) => xf(d, s, [6.5, 20], at);
  return [g(SIDE), ...(tail ? [g('M5.66 10.4C4.4 9.5 3.5 8 3.25 5.5')] : []), g(vl(6.5, 14.6, 20)), g(vl(16.25, 14.95, 20))];
}
{
  // Walking the dog: lugares' walker at the left, at its own size (smaller, its limbs would run
  // together), and the small dog ahead, the leash running down from the hand to the harness on its
  // back (its tail left out: it would rise into the leash)
  const W = L.walking.d.map((d) => xf(d, 1, [12, 21], [7, 21]));
  const at = [13.6, 21];
  const dog = smallDog(at, 0.55, { tail: false });
  const hand = [17.25 - 5, 12.25];
  const back = xp([10.5, 9.75], 0.55, [6.5, 20], at);
  add('dog-walking', ['paseo de perros', 'pasear al perro', 'correa', 'dog walking', 'dog walker', 'leashed dog'], [...W, ...dog, line(hand, back)]);
  FILL['dog-walking'] = { solid: [0, 5], wire: [1, 2, 3, 4, 6, 7, 8] };
}
{
  // Pet relief area: the small dog beside a fire hydrant, squat as hydrants are: a dome cap with its
  // nut over a flange, a body as wide as the dome, two side outlets and the foot on the ground. The
  // dog's snout stands 3 from the outlet
  const dog = smallDog([3.75, 20.75], 0.5);
  const hydrant = roundpoly(
    [[15.5, 20.75], [15.5, 16.75], [14.25, 16.75], [14.25, 13.75], [15.5, 13.75], [15.5, 11.75], [14.75, 11.75], [14.75, 10.25], [20.75, 10.25], [20.75, 11.75], [20, 11.75], [20, 13.75], [21.25, 13.75], [21.25, 16.75], [20, 16.75], [20, 20.75]],
    [0, 0.5, 0.5, 0.5, 0.5, 0, 0.4, 0.4, 0.4, 0.4, 0, 0.5, 0.5, 0.5, 0.5, 0],
  );
  const dome = arc(17.75, 10.25, 2.25, 180, 360).d;
  add('pet-relief-area', ['área para mascotas', 'zona de necesidades', 'hidrante', 'pet relief area', 'dog toilet', 'pet area'], [hydrant, dome, vl(17.75, 8, 6), hl(20.75, 14, 21.5), ...dog]);
  FILL['pet-relief-area'] = { solid: [0, `${dome}Z`, 4], wire: [2, 3, 5, 6, 7] };
}

// ── Food, treats and toys ─────────────────────────────────────────────────────────────────────
{
  // Automatic feeder: the tall hopper (a container: the square corner) with its food level, and
  // pet-bowl's bowl and kibble at its foot, in front of it and to the right (they clear the hopper's
  // corner, so the hopper keeps its whole height)
  const g = (d) => xf(d, 0.6, [12, 20], [15.75, 21.25]);
  const bowl = [BOWL, KIBBLE].map(g);
  const knock = `${shut(bowl[1])}${bowl[0]}`;
  add('pet-feeder', ['comedero automático', 'dispensador', 'porciones', 'pet feeder', 'automatic feeder', 'food dispenser'], [sq(3.25, 2.75, 11, 15.5, 3.5, BR), hl(8.5, 3.25, 14.25)], {
    badge: { d: bowl, knock, fill: { solid: [bowl[0], shut(bowl[1])], cut: [g(RIM)] } },
  });
  FILL['pet-feeder'] = { solid: [0], cut: [1] };
}
{
  // Drinking fountain: a low basin, the dome on top and the water springing from it, falling to
  // either side
  const basin = roundpoly([[3.25, 13.5], [20.75, 13.5], [19.25, 20.75], [4.75, 20.75]], [1, 1, 2.25, 2.25]);
  const dome = arc(12, 13.5, 2.75, 180, 360).d;
  const jet = 'M12 10.75V8C12 5.75 15.75 4.75 17.75 9.5';
  add('pet-fountain', ['fuente de agua', 'bebedero', 'filtro', 'pet fountain', 'water fountain', 'drinking fountain'], [basin, dome, jet, flipPath(jet)]);
  FILL['pet-fountain'] = { solid: [0, `${dome}Z`], wire: [2, 3] };
}
{
  // Treat jar: a squat jar, its lid, and a small bone for a knob
  const b = smallBone([12, 4.25], 2.25);
  add('treat-jar', ['premios', 'golosinas', 'frasco', 'treat jar', 'treats', 'rewards'], [sq(5.25, 10.75, 13.5, 10.5, 3.5, BR), sq(4.25, 8, 15.5, 2.75, 1.25), vl(12, 4.25, 8), ...b]);
  FILL['treat-jar'] = { solid: [0, 1, 4, 5, 6, 7], cut: [hl(10.75, 4.25, 19.75)], wire: [2, 3] };
}
{
  // Rope toy: the rope a band with its twist (two diagonals across it) between two knots, each frayed
  // into three ends; drawn level and turned -45°
  const [A, B, r] = [[5.5, 12], [18.5, 12], 2.75];
  const x0 = A[0] + Math.sqrt(r * r - 1.5 ** 2);
  const x1 = B[0] - Math.sqrt(r * r - 1.5 ** 2);
  const fray = (c, a) => line(polar(...c, r, a), polar(...c, r + 2.25, a));
  const d = [hl(10.5, x0, x1), hl(13.5, x0, x1), line([10.25, 13.5], [11.75, 10.5]), line([13.25, 13.5], [14.75, 10.5]), circ(...A, r), circ(...B, r), fray(A, 140), fray(A, 180), fray(A, 220), fray(B, -40), fray(B, 0), fray(B, 40)];
  add('rope-toy', ['juguete de cuerda', 'cuerda', 'jalar', 'rope toy', 'tug toy', 'dog toy'], d.map((p) => turnPath(p, -45)));
  FILL['rope-toy'] = { solid: [4, 5, turnPath(`M${f(x0)} 10.5H${f(x1)}V13.5H${f(x0)}Z`, -45)], cut: [2, 3], wire: [6, 7, 8, 9, 10, 11] };
}
{
  // Chew toy: three lobes, narrower as they rise, and the small hole at the top
  const lobes = [[12, 16.25, 4.75], [12, 9.75, 3.75], [12, 5.25, 3]];
  const [p1, q1] = meet2(lobes[0], lobes[1]);
  const [p2, q2] = meet2(lobes[1], lobes[2]);
  const A = (c, to, big = 0) => `A${f(c[2])} ${f(c[2])} 0 ${big} 0 ${pt(to)}`;
  const body = `M${pt(q1)}${A(lobes[0], p1, 1)}${A(lobes[1], p2)}${A(lobes[2], q2, 1)}${A(lobes[1], q1)}Z`;
  add('chew-toy', ['juguete para morder', 'mordedera', 'enriquecimiento', 'chew toy', 'rubber toy', 'enrichment'], [body, dot(12, 5.25)]);
  FILL['chew-toy'] = { solid: [0], cut: [1] };
}
{
  // Feather wand: a short stick, the string hanging from its tip, and the feather, the largest piece,
  // hanging from the string (a vane fullest a third of the way down, in two halves either side of its
  // quill). With the feather small and the string arching over, it read as a letter
  const [T, Bt] = [[16.5, 10], [19.5, 21.25]];
  const ax = unit(sub(Bt, T));
  const n = [-ax[1], ax[0]];
  const side = (k) => [add2(lerp(T, Bt, 0.35), mul(n, 3 * k)), add2(lerp(T, Bt, 0.75), mul(n, 2.5 * k))];
  const [[m1, m3], [m2, m4]] = [side(1), side(-1)];
  const vane = `M${pt(T)}C${pt(m1)} ${pt(m3)} ${pt(Bt)}C${pt(m4)} ${pt(m2)} ${pt(T)}Z`;
  add('feather-wand', ['varita con pluma', 'juguete para gato', 'jugar', 'feather wand', 'cat toy', 'teaser'], [line([2.75, 16.75], [11.25, 3.75]), `M11.25 3.75C14.5 4 16.25 6.5 ${pt(T)}`, vane, line(T, Bt)]);
  FILL['feather-wand'] = { solid: [2], wire: [0, 1], cut: [3] };
}
{
  // Toy mouse: a long teardrop of a body (a round back, its point the nose, to the right), the
  // string tail curling from its back, and the round ear standing in front of it (it clears the
  // body's edge)
  const C = [8.75, 13.5];
  const r = 4.25;
  const N = [19.75, 15.5];
  const d = Math.hypot(N[0] - C[0], N[1] - C[1]);
  const base = (Math.atan2(N[1] - C[1], N[0] - C[0]) * 180) / Math.PI;
  const off = (Math.acos(r / d) * 180) / Math.PI;
  const [up, down] = [polar(...C, r, base - off), polar(...C, r, base + off)];
  const body = `M${pt(down)}A${r} ${r} 0 1 1 ${pt(up)}L${pt(N)}Z`;
  const ear = circ(12.75, 9.5, 2.1);
  add('toy-mouse', ['ratón de juguete', 'juguete para gato', 'ratoncito', 'toy mouse', 'cat toy', 'mouse toy'], [body, `M${pt(polar(...C, r, 165))}C2 15 4.25 18.75 2.25 21`], { badge: { d: [ear], knock: ear, fill: { solid: [ear] } } });
  FILL['toy-mouse'] = { solid: [0], wire: [1] };
}
// ── Cat furniture and small-pet gear ──────────────────────────────────────────────────────────
{
  // Scratching post: the top platform, the post wrapped in rope (diagonals 3 apart) and the base
  const rope = [10, 13.25, 16.5].map((y) => line([9.25, y], [14.75, y - 2]));
  add('scratching-post', ['rascador', 'poste rascador', 'gato', 'scratching post', 'cat scratcher', 'cat furniture'], [sq(6.25, 2.75, 11.5, 3.5, 1.5), vl(9.25, 6.25, 17.75), vl(14.75, 6.25, 17.75), sq(3.25, 17.75, 17.5, 3.5, 1.5), ...rope]);
  FILL['scratching-post'] = { solid: [0, 3, `M9.25 6.25V17.75H14.75V6.25Z`], cut: [4, 5, 6] };
}
{
  // Cat tree: a cubby with its round door at the bottom, a post up to a low platform, and a taller
  // post from the floor to the high one
  add('cat-tree', ['árbol para gatos', 'torre', 'rascador', 'cat tree', 'cat tower', 'cat condo'], [sq(3.25, 12.25, 11, 9, 2.25, BR), circ(8.75, 16.75, 1.6), vl(6.25, 12.25, 8.75), sq(2.75, 6.25, 8, 2.5, 1.25), vl(18, 21.25, 5.75), sq(13.75, 3.25, 7.5, 2.5, 1.25)]);
  FILL['cat-tree'] = { solid: [0, 3, 5], cut: [1], wire: [2, 4] };
}

// ── Walking gear ──────────────────────────────────────────────────────────────────────────────
/** Pet waste: three tiers stacked, narrower as they rise, the top one ending in a curl (poop, poop-bag). */
const POOP = 'M6 20.75A2.75 2.75 0 0 1 6 15.25H7.75A2.25 2.25 0 0 1 7.75 10.75H9.75C9.25 7.75 11 5.25 13.25 3.25C14 5.5 14.5 6.5 14.25 7.5C15.5 8 16.25 9.25 16 10.75H16.25A2.25 2.25 0 0 1 16.25 15.25H18A2.75 2.75 0 0 1 18 20.75Z';
/** The leash's snap clip: its swivel ring and the clip's body below it, hanging at `c` (the ring's top). */
const clip = ([x, y]) => [circ(x, y + 1.4, 1.4), capsule(x - 1.75, y + 2.8, 3.5, 6.25)];
{
  // Leash: the handle loop (the strap folded back on itself, a long narrow loop: lugares' pin
  // read as a balloon), the slack strap and the clip
  const handle = turnPath(capsule(3.75, 4.25, 3.5, 8.5), -45, [5.5, 8.5]);
  const tip = rot([5.5, 12.75], [5.5, 8.5], -45);
  // The strap meets the clip where its ring and its body touch
  const c = clip([18, 9.5]);
  add('leash', ['correa', 'paseo', 'traílla', 'leash', 'dog leash', 'walking gear'], [handle, `M${pt(tip)}C11 17.5 16 18.25 18 12.3`, ...c]);
  // Filled, the handle stays a loop (a hand goes through it) and the clip is solid
  FILL.leash = { solid: [2, 3], wire: [0, 1] };
}
{
  // Retractable leash: the handle's rounded body with its grip slot, the cord running out of its front
  // to the clip (a slot and a button dot inside it read as a face)
  const body = sq(3.25, 5, 13, 10, 5);
  const c = clip([19, 12.25]);
  add('leash-retractable', ['correa retráctil', 'correa extensible', 'paseo', 'retractable leash', 'extendable leash', 'walking gear'], [body, capsule(6, 7.6, 7.5, 2.75), 'M16.25 10C18.25 10 19 10.75 19 12.25', ...c]);
  FILL['leash-retractable'] = { solid: [0, 3, 4], cut: [1], wire: [2] };
}
{
  // Harness, on dog-side's dog: the neck strap and the chest strap across the body, joined along the
  // back by a short strap that carries the D-ring
  const neck = line([13.95, 8.15], [17.75, 10.75]);
  add('harness', ['arnés', 'pechera', 'paseo', 'harness', 'dog harness', 'no-pull'], [SIDE, vl(6.5, 14.6, 20), vl(9.5, 14.25, 20), vl(13.25, 14.6, 20), vl(16.25, 14.95, 20), 'M5.66 10.4C4.4 9.5 3.5 8 3.25 5.5', neck, line([11.25, 9.75], [11.75, 14.5]), dot(11.25, 8.9)]);
  FILL.harness = { solid: [0], cut: [6, 7], wire: [1, 2, 3, 4, 5, 8] };
}
{
  // Collar in three-quarter: the band's top and front edges, its buckle and the round tag
  const top = ell([12, 9.25], 8.75, 4.75);
  const front = 'M3.25 9.25V12A8.75 4.75 0 0 0 20.75 12V9.25';
  add('collar', ['collar', 'placa', 'accesorio', 'collar', 'dog collar', 'pet tag'], [top, front, sq(5.5, 12.75, 3, 4.25, 0.9), circ(12, 19, 2.25)]);
  // Filled: the band between the top edge's front half and the front edge (the ring stays open)
  const band = 'M3.25 9.25A8.75 4.75 0 0 0 20.75 9.25V12A8.75 4.75 0 0 1 3.25 12Z';
  FILL.collar = { solid: [band, 3], wire: [0], lines: [2] };
}
{
  // Basket muzzle, on the dog's head: the basket over its muzzle, below its eyes (they stay), two
  // straps across it 3 apart (it clears the face behind it)
  const h = dogHead([12, 9.75], 0.9).slice(0, 5);
  const basket = sq(7.5, 13.25, 9, 8, 3);
  const straps = [vl(10.5, 13.25, 21.25), vl(13.5, 13.25, 21.25)];
  add('muzzle', ['bozal', 'seguridad', 'veterinario', 'muzzle', 'basket muzzle', 'safety'], h, {
    badge: { d: [basket, ...straps], knock: basket, fill: { solid: [basket], cut: straps } },
  });
  FILL.muzzle = { solid: [0], wire: [1, 2], cut: [3, 4] };
}
{
  // ID tag: a bone-shaped tag hanging from its ring
  add('pet-tag', ['placa de identificación', 'placa', 'perdido', 'pet tag', 'id tag', 'dog tag'], [bone([12, 15], { a: 7, b: 2, r: 2.5, h: 2 }), circ(12, 11, 2)]);
  FILL['pet-tag'] = { solid: [0], wire: [1] };
}
{
  // Waste bag: a bag tied at the top, its two ends standing up, and poop's pile in it as big as the
  // bag lets it (3 from the neck and the floor). With the paw under its two ends it read as a face with
  // ears; beside the bag, the pile clipped the bag into a letter
  const bag = 'M10 7.5H14C18.75 9.5 21 13 21 16.5A4.75 4.75 0 0 1 16.25 21.25H7.75A4.75 4.75 0 0 1 3 16.5C3 13 5.25 9.5 10 7.5Z';
  const tie = 'M9 2.75L12 7.5L15 2.75';
  add('poop-bag', ['bolsas para desechos', 'recoger', 'bolsa', 'poop bags', 'waste bags', 'pick up after pet'], [bag, tie, xf(POOP, 0.44, [12, 20.75], [12, 18.25])]);
  FILL['poop-bag'] = { solid: [0], wire: [1], cut: [2] };
}
{
  // Pet waste: three tiers stacked, narrower as they rise, the top one ending in a curl
  add('poop', ['popó', 'desechos', 'baño', 'poop', 'pet waste', 'potty'], [POOP]);
  FILL.poop = { solid: [0] };
}
{
  // Training pad: the square pad, its quilted border (a seam on each side, open at the corners) and
  // lugares' droplet at the center
  const seam = [hl(6.75, 9, 15), vl(17.25, 9, 15), hl(17.25, 9, 15), vl(6.75, 9, 15)];
  add('puppy-pad', ['tapete entrenador', 'pañal de piso', 'entrenamiento', 'puppy pad', 'pee pad', 'potty training'], [sq(3.75, 3.75, 16.5, 16.5, 4), xf(L.droplet.d[0], 0.32, [12, 12], [12, 12.2]), ...seam]);
  FILL['puppy-pad'] = { solid: [0], cut: [1, 2, 3, 4, 5] };
}

// ── Places and homes ──────────────────────────────────────────────────────────────────────────
{
  // Dog park: a bone-shaped sign on its post above a short fence (pickets and a rail)
  add('dog-park', ['parque para perros', 'área sin correa', 'jugar', 'dog park', 'off-leash area', 'park'], [bone([12, 5.75], { a: 5, b: 1.5, r: 1.9, h: 1.5 }), vl(12, 7.25, 21.25), ...[4.5, 8, 16, 19.5].map((x) => vl(x, 13.5, 21.25)), hl(17, 3, 21)]);
  FILL['dog-park'] = { solid: [0], wire: [1, 2, 3, 4, 5, 6] };
}
{
  // Dog house: lugares' roof and walls and a big arched doorway, 3 from each wall, that says it alone
  // (a bone above it read as two eyes over a mouth; a name plate, as a head over shoulders)
  const door = 'M8.25 20.75V15.75A3.75 3.75 0 0 1 15.75 15.75V20.75';
  add('doghouse', ['casa de perro', 'caseta', 'refugio', 'doghouse', 'dog kennel', 'dog shelter'], [L.house.d[0], L.house.d[1], door]);
  FILL.doghouse = { solid: [0, 1], cut: [2], close: true };
}
{
  // Wire crate, from the front: the frame (a container: the square corner), its bars from top to
  // bottom 3.25 apart, and the door they leave at the right with its latch (an inner frame for the
  // door read as a battery)
  add('dog-crate', ['jaula', 'transportadora', 'entrenamiento en jaula', 'dog crate', 'kennel', 'crate training'], [sq(2.75, 5.5, 18.5, 13.5, 2.75, BR), vl(7.25, 5.5, 19), vl(10.5, 5.5, 19), vl(13.75, 5.5, 19), dot(17.25, 12.25)]);
  FILL['dog-crate'] = { solid: [0], cut: [1, 2, 3, 4] };
}
{
  // Pet door: lugares' door with its knob higher, and the flap at the bottom swinging out
  const flap = roundpoly([[9.25, 13.25], [14.75, 13.25], [15.5, 18.25], [8.5, 18.25]], 1);
  const d = [L.door.d[0], L.door.d[1], dot(14.75, 10), flap];
  add('pet-door', ['puerta para mascotas', 'gatera', 'acceso', 'pet door', 'cat flap', 'dog door'], d);
  FILL['pet-door'] = { solid: [0], wire: [1], cut: [2, 3], close: true };
  add('pet-door-lock', ['bloquear puerta', 'gatera cerrada', 'modo de bloqueo', 'lock pet door', 'locked cat flap', 'lock mode'], d, { badge: badge('lock') });
  FILL['pet-door-lock'] = FILL['pet-door'];
}
{
  // Bolster bed in three-quarter: the rim's outline, its front edge and the cushion inside
  const outer = 'M2.75 11A9.25 5 0 0 1 21.25 11V14.25A9.25 5 0 0 1 2.75 14.25Z';
  add('pet-bed', ['cama para mascota', 'camita', 'descanso', 'pet bed', 'dog bed', 'cat bed'], [outer, 'M2.75 11A9.25 5 0 0 0 21.25 11', ell([12, 11], 5.5, 2)]);
  FILL['pet-bed'] = { solid: [0], cut: [1, 2] };
}
{
  // Bird cage: the dome, the bars (the middle one runs up into the hook), the perch and the base
  const C = [12, 10.75];
  const R = 6.5;
  const top = (x) => C[1] - Math.sqrt(R * R - (x - C[0]) ** 2);
  const cage = `M5.5 19V${f(C[1])}${arc(...C, R, 180, 360).d.replace(/^M[^A]*/, '')}V19`;
  add('bird-cage', ['jaula de pájaro', 'ave', 'perico', 'bird cage', 'birdcage', 'pet bird'], [cage, hl(19, 3.75, 20.25), vl(9, top(9), 19), vl(12, 4.25, 19), vl(15, top(15), 19), hl(15, 5.5, 18.5), vl(12, 2.25, 4.25)]);
  FILL['bird-cage'] = { solid: [`${cage}Z`], wire: [1, 6], cut: [2, 3, 4, 5] };
}
{
  // Aquarium: the tank (a container: the square corner), its water line and lugares' fish
  add('aquarium', ['acuario', 'pecera', 'peces', 'aquarium', 'fish tank', 'aquarium care'], [sq(2.5, 5.5, 19, 13.5, 3, BR), hl(8.5, 2.5, 21.5), ...smallFish([12, 13.75], 0.85)]);
  FILL.aquarium = { solid: [0], cut: [1, 2, 3] };
}
{
  // Fishbowl: the round bowl, open at its wide mouth and flat at its foot, the water line and a fish
  const C = [12, 12.5];
  const R = 8.75;
  const xAt = (y) => Math.sqrt(R * R - (y - C[1]) ** 2);
  const bowl = `M${pt([C[0] - xAt(5.25), 5.25])}A${R} ${R} 0 0 0 ${pt([C[0] - xAt(20.25), 20.25])}H${f(C[0] + xAt(20.25))}A${R} ${R} 0 0 0 ${pt([C[0] + xAt(5.25), 5.25])}`;
  add('fishbowl', ['pecera', 'pez', 'acuario pequeño', 'fishbowl', 'goldfish bowl', 'pet fish'], [bowl, hl(9.25, C[0] - xAt(9.25), C[0] + xAt(9.25)), ...smallFish([12, 14.75], 0.9)]);
  FILL.fishbowl = { solid: [`${bowl}Z`], cut: [1, 2, 3] };
}
{
  // Terrarium: the glass box, the heat lamp's dome resting on it with its hanger, and a sprout growing
  // from its floor (a branch read as a crack in a frame)
  const dome = arc(12, 8.75, 3.5, 180, 360).d;
  const leaves = ['M12 17.25C12 15 10.5 13.75 8.25 13.75C8.25 16 9.75 17.25 12 17.25Z', 'M12 16.25C12 14 13.5 12.75 15.75 12.75C15.75 15 14.25 16.25 12 16.25Z'];
  add('terrarium', ['terrario', 'reptiles', 'lámpara de calor', 'terrarium', 'reptile tank', 'heat lamp'], [sq(2.75, 8.75, 18.5, 12.5, 2.5, BR), dome, vl(12, 5.25, 2.75), vl(12, 21.25, 16.25), ...leaves]);
  FILL.terrarium = { solid: [0, `${dome}Z`], wire: [2], cut: [3, 4, 5] };
}
{
  // Litter box in three-quarter: the tray, its front rim, and the litter in it
  const tray = roundpoly([[5.25, 7.5], [18.75, 7.5], [20.75, 13.5], [19.75, 19.75], [4.25, 19.75], [3.25, 13.5]], [1, 1, 0.75, 2, 2, 0.75]);
  add('litter-box', ['arenero', 'arena para gato', 'limpieza', 'litter box', 'cat litter', 'litter tray'], [tray, hl(13.5, 3.25, 20.75), dot(8.1, 10.5), dot(12, 10.5), dot(15.9, 10.5)]);
  FILL['litter-box'] = { solid: [0], cut: [1, 2, 3, 4] };
}

// ── Health, tech and grooming ─────────────────────────────────────────────────────────────────
{
  // Microchip: the capsule transponder, its coil, and two signal arcs from its end
  let coil = 'M6.75 12';
  for (let i = 0; i < 4; i++) coil += `C${pt([6.75 + i * 1.25 + 0.42, 12 + (i % 2 ? 0.8 : -0.8)])} ${pt([6.75 + i * 1.25 + 0.83, 12 + (i % 2 ? 0.8 : -0.8)])} ${pt([6.75 + (i + 1) * 1.25, 12])}`;
  add('pet-microchip', ['microchip', 'registro', 'lector de chip', 'pet microchip', 'microchip scan', 'chip registration'], [capsule(3.25, 8.5, 12, 7), coil, ...sound([11.75, 12], 6.5, 9.5, 35)]);
  FILL['pet-microchip'] = { solid: [0], cut: [1], lines: [2, 3] };
}
{
  // GPS tracker: the pod hanging from a short arc of collar, signal arcs on either side
  const C = [12, 14];
  const arcs = [...sound(C, 6.4, 9.4, 30), ...sound(C, 6.4, 9.4, 30).map((d) => flipPath(d))];
  add('pet-tracker', ['localizador gps', 'rastreador', 'ubicación en vivo', 'pet tracker', 'gps tracker', 'geofence'], [sq(9.25, 10, 5.5, 8, 2.25), 'M4.25 4.25C8 7.5 16 7.5 19.75 4.25', vl(12, 6.69, 10), ...arcs]);
  FILL['pet-tracker'] = { solid: [0], wire: [1, 2], lines: [3, 4, 5, 6] };
}
{
  // Slicker brush: the head with its pins, the handle running up and right
  const head = sq(3.25, 12.75, 11, 4.75, 2);
  add('pet-brush', ['cepillo', 'cepillado', 'aseo', 'pet brush', 'slicker brush', 'grooming'], [head, ...[5.75, 8.75, 11.75].map((x) => vl(x, 17.5, 20.25)), line([12.25, 12.75], [20.25, 3.25])]);
  FILL['pet-brush'] = { solid: [0], wire: [1, 2, 3, 4] };
}
{
  // Claw clippers: two arms crossing at the pivot, their jaws a ring open at the tip (the half-moon
  // blades), the long handles below
  const O = [7, 7];
  const r = 2.75;
  const P = [11.25, 11.25];
  const tangent = (side) => {
    const d = Math.hypot(P[0] - O[0], P[1] - O[1]);
    const a = Math.atan2(P[1] - O[1], P[0] - O[0]) + side * Math.acos(r / d);
    return [O[0] + r * Math.cos(a), O[1] + r * Math.sin(a)];
  };
  const [t1, t2] = [tangent(1), tangent(-1)];
  const ext = (t, k) => add2(P, mul(unit(sub(P, t)), k));
  const a1 = (Math.atan2(t1[1] - O[1], t1[0] - O[0]) * 180) / Math.PI;
  const a2 = (Math.atan2(t2[1] - O[1], t2[0] - O[0]) * 180) / Math.PI;
  // Each jaw runs from its arm round the ring to the gap at the tip (225°)
  const jaw1 = `M${pt(ext(t1, 10))}L${pt(t1)}${arc(...O, r, a1, 197).d.replace(/^M[^A]*/, '')}`;
  const jaw2 = `M${pt(ext(t2, 10))}L${pt(t2)}${arc(...O, r, a2 + 360, 253).d.replace(/^M[^A]*/, '')}`;
  add('claw-clipper', ['cortaúñas', 'corte de uñas', 'aseo', 'claw clipper', 'nail trimmer', 'grooming'], [jaw1, jaw2, dot(...P)]);
  FILL['claw-clipper'] = false;
}
{
  // Pet bath: the dog's head above the rim of the tub, which stands in front and clears it
  const h = dogHead([12, 8.4], 0.7);
  const rim = hl(14.5, 2.75, 21.25);
  const tub = roundline([[3.75, 14.5], [4.75, 19.5], [19.25, 19.5], [20.25, 14.5]], [0, 2.25, 2.25, 0]);
  const feet = [line([6.75, 19.5], [6.25, 21.5]), line([17.25, 19.5], [17.75, 21.5])];
  add('pet-bath', ['baño de mascota', 'bañar', 'estética', 'pet bath', 'dog wash', 'bath day'], h, {
    badge: { d: [tub, rim, ...feet], knock: `${tub}Z`, fill: { solid: [`${tub}Z`], wire: [rim, ...feet] } },
  });
  FILL['pet-bath'] = { solid: [0], wire: [1, 2], cut: [3, 4, 5] };
}
{
  // Cone collar: the cone's rim, its edge in shallow pleats, behind the dog's head: the head stands
  // in front (it clears the rim where its ears cross it)
  const C = [12, 12];
  const n = 12;
  const R = 9.25;
  let rim = `M${pt(polar(...C, R, -90))}`;
  for (let i = 0; i < n; i++) rim += `A4.5 4.5 0 0 1 ${pt(polar(...C, R, -90 + (360 / n) * (i + 1)))}`;
  const [at, k] = [[12, 12.5], 0.76];
  const h = dogHead(at, k);
  add('cone-collar', ['collar isabelino', 'cono', 'recuperación', 'cone collar', 'e-collar', 'recovery cone'], [`${rim}Z`], {
    badge: { d: h, knock: dogKnock(at, k), fill: { solid: [h[0]], wire: [h[1], h[2]], cut: h.slice(3) } },
  });
  FILL['cone-collar'] = { solid: [0] };
}
{
  // Training clicker: the teardrop body (lugares' pin turned to point right), its round button, and
  // the wrist loop through its narrow end
  const body = turnPath(xf(L['map-pin'].d[0], 0.95, [12, 10.25], [9.5, 12]), -90, [9.5, 12]);
  const tip = [9.5 + 7 * 0.95 * Math.SQRT2, 12];
  add('training-clicker', ['clicker', 'adiestramiento', 'refuerzo positivo', 'training clicker', 'clicker training', 'positive reinforcement'], [body, circ(9.5, 12, 2.75), `M${pt(tip)}C20.5 9.25 22 13.25 19.5 15.25C18.5 16.25 17 15.25 ${pt(tip)}`]);
  FILL['training-clicker'] = { solid: [0], cut: [1], wire: [2] };
}
{
  // Pet carrier: the hard shell (a container: square corner), the handle on top and the barred door
  add('pet-carrier', ['transportadora', 'viaje', 'visita al veterinario', 'pet carrier', 'travel crate', 'vet trip'], [sq(3.25, 8.5, 17.5, 12, 3, BR), roundline([[8.75, 8.5], [8.75, 4.75], [15.25, 4.75], [15.25, 8.5]], [0, 1.5, 1.5, 0]), sq(7.5, 11.25, 9, 6.75, 2), vl(10.5, 11.25, 18), vl(13.5, 11.25, 18)]);
  FILL['pet-carrier'] = { solid: [0], wire: [1], cut: [2, 3, 4] };
}
{
  // Pet camera: the upright rounded body on its base, the lens near the top and the wide chute
  add('pet-camera', ['cámara para mascotas', 'lanzador de premios', 'vigilar', 'pet camera', 'treat camera', 'pet cam'], [sq(6, 2.75, 12, 15.25, 5), sq(4.25, 18, 15.5, 3.25, 1.25), circ(12, 7.75, 2.25), arc(12, 9.75, 4.25, 45, 135).d]);
  FILL['pet-camera'] = { solid: [0, 1], cut: [2, 3, hl(18, 6, 18)] };
}
{
  // Flying disc in flight: a thin disc in three-quarter, tilted up to the right (its top and the rim's
  // thickness), and two trails behind it along its plane, 3 apart (level and with an inner ring, it
  // read as pet-bed)
  const C = [14.5, 9.25];
  const [rx, ry, lipH, tilt] = [7, 3.25, 1.75, -18];
  const t = (d) => turnPath(d, tilt, C);
  const [L0, R0] = [[C[0] - rx, C[1]], [C[0] + rx, C[1]]];
  const lip = `M${pt(L0)}V${f(C[1] + lipH)}A${rx} ${ry} 0 0 0 ${pt([R0[0], C[1] + lipH])}V${f(C[1])}`;
  const dir = [Math.cos((tilt * Math.PI) / 180), Math.sin((tilt * Math.PI) / 180)];
  const nrm = [-dir[1], dir[0]];
  const A = [2.75, 18.25];
  const B = add2(A, add2(mul(nrm, 3), mul(dir, 1.5)));
  add('flying-disc', ['disco volador', 'frisbee', 'buscar', 'flying disc', 'frisbee', 'fetch'], [t(ell(C, rx, ry)), t(lip), line(A, add2(A, mul(dir, 4.5))), line(B, add2(B, mul(dir, 5.5)))]);
  FILL['flying-disc'] = { solid: [0, t(`${lip}Z`)], cut: [t(`M${pt(L0)}A${rx} ${ry} 0 0 0 ${pt(R0)}`)], lines: [2, 3] };
}
// ── Fill (DESIGN.md › Fill) ───────────────────────────────────────────────────────────────────
// By index of `d` (or a stroke of its own, such as a cut along a shared edge): `solid` is filled
// (closed shapes only; `close` shuts the open outlines along their chord), `cut` is knocked out at
// stroke width, `lines` stays a line with a clearance of paper, `wire` stays a line attached to it.
// `false`: open lines only, the filled version is the outline itself.
for (const [name, spec] of Object.entries(FILL)) {
  if (icons[name].fill !== undefined) continue;
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  const solid = pick(spec.solid);
  icons[name].fill = { solid: spec.close ? solid.map(shut) : solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]) icons[name].fill[k] = pick(spec[k]);
}

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
const HEAD = { head: [0], ears: [1, 2], eyes: [3, 4], nose: [5] };
const PAW_PARTS = { pad: [0], toes: [1, 2, 3, 4] };
const PARTS = {
  dog: { ...HEAD, mouth: [6] },
  'dog-alert': HEAD,
  'dog-bark': { ...HEAD, wave: [6, 7] },
  'cat-meow': { head: [0], eyes: [1, 2], wave: [3, 4] },
  pets: { cat: [0], eyes: [1, 2] },
  'pet-detection': { frame: [0], head: [1], ears: [2, 3], eyes: [4, 5], nose: [6] },
  ...Object.fromEntries(['paw-plus', 'paw-check', 'paw-heart', 'paw-search', 'paw-alert', 'paw-edit'].map((n) => [n, PAW_PARTS])),
  'fish-bone': { head: [0], spine: [1], ribs: [2, 3, 4], tail: [5] },
  'pet-bowl': { bowl: [0], food: [1] },
  'pet-bowl-clock': { bowl: [0], food: [1] },
  'pet-bowl-water': { bowl: [0], water: [1] },
  'pet-food': { bag: [0], fold: [1], bone: [2, 3, 4, 5, 6] },
  'pet-food-sync': { bag: [0], fold: [1], bone: [2, 3, 4, 5, 6] },
  'dog-side': { body: [0], ear: [1], legs: [2, 3, 4, 5], tail: [6] },
  'dog-running': { body: [0], ear: [1], legs: [2, 3, 4, 5], tail: [6] },
  'dog-seated': { body: [0], ear: [1], leg: [2], tail: [3] },
  'cat-seated': { body: [0], tail: [1] },
  puppy: { body: [0], legs: [1, 2], tail: [3] },
  kitten: { body: [0], paw: [1], ball: [2], tail: [3] },
  'cat-sleeping': { body: [0], haunch: [1] },
  rabbit: { head: [0], ears: [1, 2], eyes: [3, 4], nose: [5] },
  goldfish: { body: [0], tail: [1], fin: [2], eye: [3] },
  'house-paw': { roof: [0], walls: [1], paw: [2, 3, 4, 5, 6] },
  'store-paw': { awning: [0], body: [1], paw: [2, 3, 4, 5, 6] },
  'map-pin-paw': { pin: [0], paw: [1, 2, 3, 4, 5] },
  'passport-paw': { booklet: [0], paw: [1, 2, 3, 4, 5], line: [6] },
  'id-card-paw': { card: [0], paw: [1, 2, 3, 4, 5], lines: [6, 7] },
  'calendar-paw': { body: [0], rings: [1, 2], header: [3], paw: [4, 5, 6, 7, 8] },
  'clipboard-paw': { board: [0], clip: [1], paw: [2, 3, 4, 5, 6] },
  'shield-paw': { shield: [0], paw: [1, 2, 3, 4, 5] },
  vet: { cross: [0], toes: [1, 2, 3, 4] },
  'pet-care': { paw: [0, 1, 2, 3, 4], cuff: [5], hand: [6] },
  'pet-scale': { platform: [0], screen: [1], dog: [2, 3, 4, 5] },
  'paw-trail': { back: [0, 1, 2, 3, 4], front: [5, 6, 7, 8, 9] },
  'dog-walking': { person: [0, 1, 2, 3, 4], dog: [5, 6, 7], leash: [8] },
  'pet-relief-area': { hydrant: [0, 1, 2, 3], dog: [4, 5, 6, 7] },
  'pet-feeder': { body: [0], screen: [1] },
  'pet-fountain': { basin: [0], dome: [1], water: [2, 3] },
  'treat-jar': { jar: [0], lid: [1], knob: [2, 3, 4, 5, 6, 7] },
  'rope-toy': { rope: [0, 1, 2, 3], knots: [4, 5], fray: [6, 7, 8, 9, 10, 11] },
  'chew-toy': { body: [0], hole: [1] },
  'feather-wand': { stick: [0], string: [1], feather: [2, 3] },
  'toy-mouse': { body: [0], tail: [1] },
  'scratching-post': { platform: [0], post: [1, 2], base: [3], rope: [4, 5, 6] },
  'cat-tree': { cubby: [0, 1], posts: [2, 4], platforms: [3, 5] },
  leash: { handle: [0], strap: [1], clip: [2, 3] },
  'leash-retractable': { body: [0], grip: [1], cord: [2], clip: [3, 4] },
  harness: { body: [0], legs: [1, 2, 3, 4], tail: [5], straps: [6, 7, 8] },
  collar: { band: [0, 1], buckle: [2], tag: [3] },
  muzzle: { head: [0], ears: [1, 2], eyes: [3, 4] },
  'pet-tag': { tag: [0], ring: [1] },
  'poop-bag': { bag: [0], tie: [1], waste: [2] },
  poop: { pile: [0] },
  'puppy-pad': { pad: [0], drop: [1], seam: [2, 3, 4, 5] },
  'dog-park': { sign: [0], post: [1], fence: [2, 3, 4, 5, 6] },
  doghouse: { roof: [0], walls: [1], door: [2] },
  'dog-crate': { frame: [0], bars: [1, 2, 3], latch: [4] },
  'pet-door': { door: [0], floor: [1], knob: [2], flap: [3] },
  'pet-door-lock': { door: [0], floor: [1], knob: [2], flap: [3] },
  'pet-bed': { bed: [0], rim: [1], cushion: [2] },
  'bird-cage': { cage: [0], base: [1], bars: [2, 3, 4], perch: [5], hook: [6] },
  aquarium: { tank: [0], water: [1], fish: [2, 3] },
  fishbowl: { bowl: [0], water: [1], fish: [2, 3] },
  terrarium: { box: [0], lamp: [1, 2], plant: [3, 4, 5] },
  'litter-box': { tray: [0], rim: [1], litter: [2, 3, 4] },
  'pet-microchip': { chip: [0], coil: [1], signal: [2, 3] },
  'pet-tracker': { pod: [0], collar: [1], link: [2], signal: [3, 4, 5, 6] },
  'pet-brush': { head: [0], pins: [1, 2, 3], handle: [4] },
  'claw-clipper': { arms: [0, 1], pivot: [2] },
  'pet-bath': HEAD,
  'cone-collar': { cone: [0] },
  'training-clicker': { body: [0], button: [1], loop: [2] },
  'pet-carrier': { body: [0], handle: [1], door: [2], bars: [3, 4] },
  'pet-camera': { body: [0], base: [1], lens: [2], chute: [3] },
  'flying-disc': { disc: [0], rim: [1], trail: [2, 3] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
// Tails wag from where they meet the body, sounds pulse, things that hang swing from their hook,
// the badges move as the engine's do elsewhere (the clock and the sync turn in place).
const BC = [17.25, 17.25];
const MOTION = {
  dog: { effect: 'wiggle', origin: [12, 20.75] },
  'dog-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'dog-bark': { effect: 'beat', parts: ['wave'], origin: [14.1, 12.9] },
  'cat-meow': { effect: 'beat', parts: ['wave'], origin: [14.1, 12.9] },
  'pet-detection': { effect: 'beat', parts: ['frame'], origin: [12, 12] },
  'paw-heart': { effect: 'beat', parts: ['badge'], origin: BC },
  'paw-search': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'paw-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'paw-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'pet-bowl': { effect: 'bounce', parts: ['food'], vector: [0, -1.5] },
  'pet-bowl-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'pet-bowl-water': { effect: 'float', parts: ['water'], vector: [1, 0] },
  'pet-food-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'dog-side': { effect: 'wiggle', parts: ['tail'], origin: [5.66, 10.4] },
  'dog-running': { effect: 'slide', vector: [1.5, 0] },
  'dog-seated': { effect: 'wiggle', parts: ['tail'], origin: [8.25, 20.25] },
  'cat-seated': { effect: 'wiggle', parts: ['tail'], origin: [15, 20.25] },
  puppy: { effect: 'wiggle', parts: ['tail'], origin: [17.25, 17.75] },
  kitten: { effect: 'wiggle', parts: ['paw'], origin: [13.5, 16.75] },
  'cat-sleeping': { effect: 'beat', parts: ['body'], origin: [9, 20.25] },
  rabbit: { effect: 'bounce', vector: [0, -2] },
  goldfish: { effect: 'wiggle', parts: ['tail'], origin: [17.13, 12.25] },
  'map-pin-paw': { effect: 'bounce', vector: [0, -2] },
  vet: { effect: 'beat', parts: ['cross'], origin: [12, 16.5] },
  'pet-care': { effect: 'beat', parts: ['paw'], origin: [13.75, 7.25] },
  'paw-trail': { effect: 'slide', vector: [1.5, -1.5] },
  'dog-walking': { effect: 'slide', vector: [1.5, 0] },
  'pet-fountain': { effect: 'beat', parts: ['water'], origin: [12, 8] },
  'treat-jar': { effect: 'wiggle', parts: ['lid', 'knob'], origin: [12, 10.75] },
  'rope-toy': { effect: 'wiggle', origin: [12, 12] },
  'chew-toy': { effect: 'bounce', vector: [0, -2] },
  'feather-wand': { effect: 'ring', parts: ['string', 'feather'], origin: [11.25, 3.75] },
  'toy-mouse': { effect: 'slide', vector: [1.5, 0] },
  leash: { effect: 'ring', origin: [5.5, 8.5] },
  collar: { effect: 'ring', parts: ['tag'], origin: [12, 16.75] },
  'pet-tag': { effect: 'ring', origin: [12, 9] },
  'poop-bag': { effect: 'wiggle', origin: [12, 21.25] },
  'pet-door': { effect: 'ring', parts: ['flap'], origin: [12, 13.25] },
  'bird-cage': { effect: 'ring', origin: [12, 2.25] },
  aquarium: { effect: 'float', parts: ['fish'], vector: [1.5, 0] },
  fishbowl: { effect: 'float', parts: ['fish'], vector: [1.5, 0] },
  'pet-microchip': { effect: 'beat', parts: ['signal'], origin: [11.75, 12] },
  'pet-tracker': { effect: 'beat', parts: ['signal'], origin: [12, 14] },
  'pet-brush': { effect: 'wiggle', origin: [20.25, 3.25] },
  'pet-bath': { effect: 'wiggle', parts: ['head', 'ears', 'eyes', 'nose'], origin: [12, 14.5] },
  'training-clicker': { effect: 'beat', parts: ['button'], origin: [9.5, 12] },
  'flying-disc': { effect: 'float', vector: [1.5, -1] },
};
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Mirror (DESIGN.md › Mirroring) ────────────────────────────────────────────────────────────
// The sounds read like the speaker's waves and the card like comunicacion's id-card; the animals
// and objects keep the side they face.
for (const name of ['dog-bark', 'cat-meow', 'id-card-paw']) icons[name].mirror = true;

// ── Automatic variants (DESIGN.md › Automatic variants) ───────────────────────────────────────
// Already enclosed: the focus frame, the cone's round rim and the square pad.
for (const [names, v] of [
  [['pet-detection', 'puppy-pad'], { square: false }],
  [['cone-collar'], { circle: false }],
])
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// The engine snaps every drawing to the pixel grid; these are the ones that still turned to mush.
// A `small` is not snapped: its own pieces run through pixel centers (0.75 + 1.5k), and the base
// it keeps is snapped here with the engine's snapper.
/**
 * The paw at 16 px: three-and-four pixel rows, the toes single pixels (two inner, a pixel apart;
 * two outer, lower) and a pad of 2 over 4 pixels. `cx` is a pixel edge (its center), `y` the row of
 * the inner toes (a pixel center).
 */
const pixelPaw = (cx, y) => [
  ...[-2.25, 2.25].map((dx) => circ(cx + dx, y, 0.1)),
  ...[-3.75, 3.75].map((dx) => circ(cx + dx, y + 3, 0.1)),
  hl(y + 4.5, cx - 0.75, cx + 0.75),
  hl(y + 6, cx - 2.25, cx + 2.25),
];
/** A small that keeps the icon's base, snapped, and swaps the pieces of `part` for `pieces`. */
function smallSwap(name, part, pieces, cut = true) {
  const icon = icons[name];
  const gone = new Set((icon.parts[part] ?? []).map((i) => icon.d[i]));
  const keep = icon.d.filter((d) => !gone.has(d));
  const filled = icon.fill ? Object.values(icon.fill).flat().filter((d) => !gone.has(d)) : [];
  const sn = snapper([...keep, ...filled]);
  const small = { d: [...keep.map(sn), ...pieces] };
  if (icon.fill) {
    small.fill = {};
    for (const [k, v] of Object.entries(icon.fill)) {
      const rest = v.filter((d) => !gone.has(d)).map(sn);
      if (rest.length) small.fill[k] = rest;
    }
    if (cut) small.fill.cut = [...(small.fill.cut ?? []), ...pieces];
  }
  icon.small = small;
}
// The paw in a container: the mini paw's dots ran into a smudge
for (const [name, cx, y] of [
  ['house-paw', 12, 11.25],
  ['store-paw', 12, 12.75],
  ['map-pin-paw', 12, 6.75],
  ['passport-paw', 12, 6.75],
  ['id-card-paw', 9, 8.25],
  ['calendar-paw', 12, 12.75],
  ['clipboard-paw', 12, 9.75],
  ['shield-paw', 12, 8.25],
])
  smallSwap(name, 'paw', pixelPaw(cx, y));
// The trail: two pixel paws on the diagonal
{
  const d = [...pixelPaw(7.5, 12.75), ...pixelPaw(16.5, 3.75)];
  icons['paw-trail'].small = { d, fill: { solid: d.filter((p) => /Z$/.test(p)), wire: d.filter((p) => !/Z$/.test(p)) } };
}
// The tracker and the chip: one arc a side, the coil a straight line
{
  const t = icons['pet-tracker'];
  const keep = [t.d[0], t.d[1], t.d[2], t.d[3], t.d[5]];
  const sn = snapper(keep);
  t.small = { d: keep.map(sn), fill: { solid: [sn(t.d[0])], wire: [sn(t.d[1]), sn(t.d[2])], lines: [sn(t.d[3]), sn(t.d[5])] } };
  const c = icons['pet-microchip'];
  const coil = hl(12, 6.75, 11.75);
  const keepC = [c.d[0], coil, c.d[3]];
  const sc = snapper(keepC);
  c.small = { d: keepC.map(sc), fill: { solid: [sc(c.d[0])], cut: [sc(coil)], lines: [sc(c.d[3])] } };
}
// The bed: its rim and cushion ran together. Level, on pixel centers, 2 pixels apart
{
  const bed = 'M2.25 11.25A9.75 5.25 0 0 1 21.75 11.25V14.25A9.75 5.25 0 0 1 2.25 14.25Z';
  const cushion = ell([12, 11.25], 5.25, 1.5);
  icons['pet-bed'].small = { d: [bed, cushion], fill: { solid: [bed], cut: [cushion] } };
}
// The small fish read as two letters: its body a 5 × 4 pixel ring and the tail joined to it
const pixelFish = (cx, cy) => [ell([cx, cy], 3, 2.25), roundpoly([[cx + 3, cy - 0.75], [cx + 6, cy - 2.25], [cx + 6, cy + 2.25], [cx + 3, cy + 0.75]], 0.3)];
for (const [name, at] of [['aquarium', [10.5, 13.5]], ['fishbowl', [9.75, 14.25]]]) smallSwap(name, 'fish', pixelFish(...at));
// The pile in the bag ran into a dot: three rows of 2, 4 and 6 pixels stacked, a pixel above the floor
smallSwap('poop-bag', 'waste', [hl(15.75, 11.25, 12.75), hl(17.25, 9.75, 14.25), hl(18.75, 8.25, 15.75)]);

export default { category: 'mascotas', label: 'Mascotas', icons };
