// Caras y emociones (faces and emotions): the expressions comunicacion's eight faces leave out, the
// mood check-ins, the mood scale and calendar, and the heart's emotions. Every face is comunicacion's
// round face (r 9) and says its emotion with the eyes and the mouth only; its pieces keep the
// faces' measurements (dot eyes at 9.75, the smile, the frown, face-laugh's arched eyes and open
// mouth), so the family reads as one. Whatever lies on top of the face (a tear, a thermometer, a
// party horn) is a custom badge: the engine clears the face around it, never a hand cut. At 16 px
// every face is drawn again on the pixel grid with comunicacion's 16 px pieces. The hearts are
// edicion's heart, the mood faces reaction-add's, the calendar Núcleo's, the flame lugares' (with
// the engine's heart beside it) and the bandage sistema's patch. See DESIGN.md.
import { arc, badge, circ, dot, f, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import comunicacion from './comunicacion.mjs';
import edicion from './edicion.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Tools ─────────────────────────────────────────────────────────────────────────────────
const P = ([x, y]) => `${f(x)} ${f(y)}`;
/** Just the `A…` segment of an arc, to chain it inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');
/** Scales a path by `s` and moves its point `from` to `to`. */
const place = (d, s, from, to) => transform(d, s, to[0] - from[0] * s, to[1] - from[1] * s);
/** Ellipse with semi-axes rx, ry (four cubics), as anatomia's. */
function ell([cx, cy], rx, ry) {
  const k = 0.5523;
  const Q = (x, y) => P([cx + x, cy + y]);
  return `M${Q(rx, 0)}C${Q(rx, k * ry)} ${Q(k * rx, ry)} ${Q(0, ry)}C${Q(-k * rx, ry)} ${Q(-rx, k * ry)} ${Q(-rx, 0)}C${Q(-rx, -k * ry)} ${Q(-k * rx, -ry)} ${Q(0, -ry)}C${Q(k * rx, -ry)} ${Q(rx, -k * ry)} ${Q(rx, 0)}Z`;
}
/** Smooth curve through points (Catmull-Rom → Bézier), as comunicacion's confused mouth. */
function smooth(pts, k = 1 / 6) {
  let o = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const [p1, p2] = [pts[i], pts[i + 1]];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    o += `C${P([p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k])} ${P([p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k])} ${P(p2)}`;
  }
  return o;
}
/**
 * A teardrop: the round end (radius r) at `c`, the point h from its center, turned `deg` degrees
 * from straight up (clockwise), and the two tangents that run from the point to the circle.
 */
function tear(c, r, h, deg = 0) {
  const tip = rot([c[0], c[1] - h], c, deg);
  const a = (Math.atan2(tip[1] - c[1], tip[0] - c[0]) * 180) / Math.PI;
  const w = (Math.acos(r / h) * 180) / Math.PI;
  return `M${P(tip)}L${P(polar(...c, r, a + w))}A${f(r)} ${f(r)} 0 1 1 ${P(polar(...c, r, a - w + 360))}Z`;
}
/**
 * A capsule along a line, as a closed outline: from `a` to `b` (the centers of its round ends),
 * radius `ra` at `a` and `rb` at `b` (a bulb at one end when ra > rb).
 */
function capsule(a, b, ra, rb) {
  const deg = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const at = ([x, y]) => rot([a[0] + x, a[1] + y], a, deg);
  if (ra > rb) {
    const xj = Math.sqrt(ra * ra - rb * rb);
    return `M${P(at([xj, -rb]))}L${P(at([L, -rb]))}A${f(rb)} ${f(rb)} 0 0 1 ${P(at([L, rb]))}L${P(at([xj, rb]))}A${f(ra)} ${f(ra)} 0 1 1 ${P(at([xj, -rb]))}Z`;
  }
  return `M${P(at([0, -ra]))}L${P(at([L, -ra]))}A${f(ra)} ${f(ra)} 0 0 1 ${P(at([L, ra]))}L${P(at([0, ra]))}A${f(ra)} ${f(ra)} 0 0 1 ${P(at([0, -ra]))}Z`;
}
/** A custom piece on top: drawn, cleared with a clearance of paper by the engine, solid when filled. */
const piece = (d, cut = []) => ({ d: [...d, ...cut], knock: d.join(''), fill: { solid: d, ...(cut.length && { cut }) } });

// ── The face (comunicacion's) ───────────────────────────────────────────────────────────────
const FACE = circ(12, 12, 9);
const EYES = [dot(9, 9.75), dot(15, 9.75)];
const SMILE = arc(12, 12, 4.25, 30, 150).d;
const FROWN = arc(12, 19.25, 4.25, 215, 325).d;
/** face-laugh's eyes: arches closed in a smile. */
const ARCHES = [arc(9, 10.25, 1.5, 180, 360).d, arc(15, 10.25, 1.5, 180, 360).d];
/** Closed eyes: the arches turned over, lids resting on the eye line. */
const LIDS = [arc(9, 9.25, 1.5, 180, 0).d, arc(15, 9.25, 1.5, 180, 0).d];
/** face-laugh's open mouth: flat on top, round below. */
const GRIN = `M7.75 13.25H16.25${arcTo(12, 13.25, 4.25, 0, 180)}`;
/** The smaller open mouth, for faces whose eyes or tears need the room. */
const GRIN_S = `M9 14.75H15${arcTo(12, 14.75, 3, 0, 180)}`;
/** A tear on the right cheek, over the face's edge: 5.3 from the eye, so its clearance never takes the dot at 2.1. */
const TEAR_R = tear([20.2, 14.25], 1.35, 3.1);
/** Eyes as short flat lines (face-wink's closed eye, both sides). */
const FLAT = [line([7.75, 9.75], [10.25, 9.75]), line([13.75, 9.75], [16.25, 9.75])];
/** Eyes squeezed shut, > and <. */
const SQUEEZED = [line([7.75, 8.5], [10.25, 9.75], [7.75, 11]), line([16.25, 8.5], [13.75, 9.75], [16.25, 11])];
/** Wide eyes: rings the size of the dot eyes opened up. */
const RINGS = [circ(9, 9.75, 1.5), circ(15, 9.75, 1.5)];
/** face-neutral's mouth. */
const FLAT_MOUTH = line([8.75, 15], [15.25, 15]);
/** Gritted teeth: a tight zigzag. */
const ZIGZAG = line([8.5, 15.5], [10.25, 14.25], [12, 15.5], [13.75, 14.25], [15.5, 15.5]);
/** The set's heart (edicion), its box 2.75–21.25 × 4–20.5. */
const HEART = edicion.icons.heart.d[0];
const heartAt = (cx, top, w) => place(HEART, w / 18.5, [12, 4], [cx, top]);
/**
 * The heart split from its cleft to its point: the left half closed along the split (the one that
 * fills, as edicion's star-half) and the right half, open, or closed along the split for a crack.
 */
function halves(crack = [], { closed = false } = {}) {
  const [start, lobeL, lobeR] = HEART.replace(/Z$/, '').split('A');
  const [tip, cleft] = [start.replace(/^M/, '').split('L')[0], lobeL.split(' ').slice(-2).join(' ')];
  const down = crack.map((q) => `L${P(q)}`).join('');
  const up = [...crack].reverse().map((q) => `L${P(q)}`).join('');
  return [`${start}A${lobeL}${down}Z`, `M${cleft}A${lobeR}L${tip}${closed ? `${up}Z` : ''}`];
}
/** reaction-add's face (comunicacion): moved up and left, its smile smaller, so a badge fits beside it. */
const MOOD = comunicacion.icons['reaction-add'].d;
/**
 * A face of r 6 (the slider's knob): the dot eyes 4.3 apart and the smile 2.85 clear of them and of
 * the ring, so nothing merges at 2.1.
 */
const faceR6 = ([cx, cy]) => [circ(cx, cy, 6), dot(cx - 2.15, cy - 1.35), dot(cx + 2.15, cy - 1.35), arc(cx, cy + 0.95, 2.2, 35, 145).d];
/** Núcleo's calendar: the body, its two rings and the header line. */
const CAL = nucleo.icons.calendar.d.slice(0, 4);
/** sistema's patch (the adhesive bandage): its strip and the two edges of its pad. */
const PATCH = sistema.icons.patch.d.slice(0, 3);

const icons = {
  // ── Happy ──
  'face-grin': {
    tags: ['sonrisa amplia', 'muy feliz', 'emocionado', 'grin', 'big smile', 'excited'],
    // Dot eyes over face-laugh's open mouth
    d: [FACE, ...EYES, GRIN],
  },
  'face-happy': {
    tags: ['feliz', 'contento', 'alegre', 'happy', 'pleased', 'glad'],
    // face-laugh's arched eyes over face-smile's closed smile
    d: [FACE, ...ARCHES, SMILE],
  },
  'face-tears-of-joy': {
    tags: ['llorar de risa', 'muy gracioso', 'jaja', 'tears of joy', 'lol', 'funny'],
    // face-laugh's arched eyes over the smaller open mouth (face-star-struck's), and a tear springing
    // from the outer corner of each eye on the face's edge: the full mouth left the tears no room,
    // and at 2.1 their clearance bit into it
    d: [FACE, ...ARCHES, GRIN_S],
    badge: piece([tear([3.3, 13.75], 1.35, 3.1, 10), tear([20.7, 13.75], 1.35, 3.1, -10)]),
  },
  'face-love': {
    tags: ['enamorado', 'amor', 'me encanta', 'love', 'in love', 'crush'],
    // The set's heart as eyes, 2.85 apart and 2.85 inside the face; the smile below them
    d: [FACE, heartAt(8.45, 8.75, 4.25), heartAt(15.55, 8.75, 4.25), arc(12, 13.5, 3, 40, 140).d],
  },
  'face-kiss': {
    tags: ['beso', 'cariño', 'mandar un beso', 'kiss', 'kissing', 'affection'],
    // Arched closed eyes and the lips puckered into a small 3
    d: [FACE, ...ARCHES, `M11.5 13.75A1.05 1.05 0 0 1 11.5 15.85A1.05 1.05 0 0 1 11.5 17.95`],
  },
  'face-star-struck': {
    tags: ['asombrado', 'fan', 'deslumbrado', 'star-struck', 'amazed', 'wow'],
    // Five-point stars as eyes, ink at every weight as the dot eyes are: valleys 0.5 from the center,
    // so the stroke closes the middle even at 0.9 and the star it leaves has the set's proportions
    // (inner 0.42 of the outer at regular). With rounder, fuller points (1.2 of 2.2) they read as
    // flowers, and a star with a hole closed it somewhere between 0.9 and 2.1
    d: [FACE, ...[8.48, 15.52].map((x) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(x, 10.25, i % 2 ? 0.5 : 2.2, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0 : 0.1)))), GRIN_S],
  },
  'face-cool': {
    tags: ['genial', 'lentes de sol', 'seguro', 'cool', 'sunglasses', 'confident'],
    // Sunglasses: two D lenses hung from one bar that runs from edge to edge of the face
    d: [FACE, line([3.71, 8.5], [20.29, 8.5]), `M5.75 8.5H11${arcTo(8.375, 8.5, 2.625, 0, 180)}Z`, `M13 8.5H18.25${arcTo(15.625, 8.5, 2.625, 0, 180)}Z`, SMILE],
  },
  'face-nerd': {
    tags: ['nerd', 'geek', 'estudioso', 'lentes', 'smart', 'glasses'],
    // Round glasses (two rings and a short bridge) and a smaller open grin
    d: [FACE, circ(8.6, 10, 2.2), circ(15.4, 10, 2.2), line([10.8, 10], [13.2, 10]), `M9.25 15.25H14.75${arcTo(12, 15.25, 2.75, 0, 180)}`],
  },

  // ── Thinking and doubting ──
  'face-thinking': {
    tags: ['pensando', 'pensativo', 'hmm', 'thinking', 'pondering', 'considering'],
    // The eyes raised to the upper left and a short mouth tilted off to the right
    d: [FACE, dot(8.25, 8.75), dot(14.25, 8.75), line([11.75, 15.75], [15.75, 14.5])],
  },
  'face-skeptical': {
    tags: ['escéptico', 'dudoso', 'sospecha', 'ceja levantada', 'skeptical', 'suspicious'],
    // One brow raised over its eye (3.55 from it, 2.85 inside the face) and a straight diagonal mouth
    d: [FACE, dot(9.25, 11), dot(14.75, 11), arc(14.75, 11, 3.55, 238, 302).d, line([9.25, 16], [14.75, 15])],
  },
  'face-annoyed': {
    tags: ['fastidiado', 'molesto', 'inexpresivo', 'annoyed', 'unimpressed', 'deadpan'],
    d: [FACE, ...FLAT, FLAT_MOUTH],
  },
  'face-eye-roll': {
    tags: ['ojos en blanco', 'harto', 'sarcasmo', 'eye roll', 'whatever', 'exasperated'],
    // Ring eyes with their pupils pressed against the top of each ring (they overlap it at every weight)
    d: [FACE, circ(8.375, 10.5, 2.2), circ(15.625, 10.5, 2.2), dot(8.375, 9.5), dot(15.625, 9.5), line([9, 15.75], [15, 15.75])],
  },
  'face-smirk': {
    tags: ['sonrisa pícara', 'pícaro', 'presumido', 'smirk', 'smug', 'sly'],
    // A smile that rises on one side only
    d: [FACE, ...EYES, `M8.5 15.5H12.25${arcTo(12.25, 12.5, 3, 90, 20)}`],
  },
  'face-upside-down': {
    tags: ['al revés', 'ironía', 'todo bien', 'upside down', 'irony', 'silly'],
    // face-smile turned half a turn
    d: [FACE, dot(15, 14.25), dot(9, 14.25), arc(12, 12, 4.25, 210, 330).d],
  },

  // ── Calm and tired ──
  'face-relieved': {
    tags: ['aliviado', 'tranquilo', 'en paz', 'relieved', 'calm', 'serene'],
    d: [FACE, ...LIDS, arc(12, 11.75, 4, 40, 140).d],
  },
  'face-sleeping': {
    tags: ['dormido', 'durmiendo', 'ausente', 'sleeping', 'asleep', 'idle'],
    // Closed lids and the mouth a small dot, as bebes' baby-sleep: with a small ring for a mouth it was
    // face-yawning with a smaller oval
    d: [FACE, ...LIDS, dot(12, 15.75)],
  },
  'face-yawning': {
    tags: ['bostezo', 'sueño', 'aburrido', 'yawning', 'sleepy', 'bored'],
    d: [FACE, ...LIDS, ell([12, 15.85], 1.75, 2.25)],
  },
  'face-tired': {
    tags: ['agotado', 'cansado', 'exhausto', 'tired', 'exhausted', 'weary'],
    // Eyes squeezed into > and <, and the mouth open in a wail: face-laugh's mouth turned over
    d: [FACE, ...SQUEEZED, `M8.75 17H15.25${arcTo(12, 17, 3.25, 0, -180)}`],
  },
  'face-frustrated': {
    tags: ['frustrado', 'estresado', 'aguantando', 'frustrated', 'stressed', 'struggling'],
    d: [FACE, ...SQUEEZED, ZIGZAG],
  },
  'face-sick': {
    tags: ['enfermo', 'fiebre', 'termómetro', 'sick', 'fever', 'unwell'],
    // A thermometer in the mouth: its bulb at the lips and the tube out past the jaw
    d: [FACE, ...EYES],
    badge: piece([capsule([11.75, 15.5], [19.75, 19.25], 1.85, 1.2)]),
  },
  'face-disgusted': {
    tags: ['asco', 'náuseas', 'qué asco', 'disgusted', 'grossed out', 'yuck'],
    // Narrowed eyes and a queasy mouth, two waves
    d: [FACE, ...FLAT, smooth([[8.25, 15.5], [10.13, 14.5], [12, 15.5], [13.88, 14.5], [15.75, 15.5]])],
  },
  'face-masked': {
    tags: ['cubrebocas', 'mascarilla', 'contagio', 'gripe', 'face mask', 'flu'],
    // A mask over the lower face (2.85 inside it) and its two loops running out to the edge
    d: [FACE, ...EYES, sq(8, 13.3, 8, 4.2, 2), line([3.67, 15.4], [8, 15.4]), line([16, 15.4], [20.33, 15.4])],
  },
  'face-hot': {
    tags: ['calor', 'acalorado', 'sofocado', 'hot', 'overheated', 'sweltering'],
    // Heavy eyes and an open mouth with the tongue hanging over the lower lip: one outline
    d: [FACE, ...FLAT, `M8.75 12.75H15.25${arcTo(12, 12.75, 3.25, 0, 62.51)}V16.5${arcTo(12, 16.5, 1.5, 0, 180)}V${f(12.75 + 3.25 * Math.sin((62.51 * Math.PI) / 180))}${arcTo(12, 12.75, 3.25, 117.49, 180)}Z`],
  },
  'face-cold': {
    tags: ['frío', 'congelado', 'temblando', 'cold', 'freezing', 'shivering'],
    // Wide eyes and chattering teeth
    d: [FACE, ...RINGS, ZIGZAG],
  },

  // ── Worried and scared ──
  'face-scared': {
    tags: ['miedo', 'asustado', 'horror', 'scared', 'afraid', 'screaming'],
    d: [FACE, ...RINGS, ell([12, 16.1], 1.6, 2)],
  },
  'face-worried': {
    tags: ['preocupado', 'ansioso', 'inquieto', 'worried', 'anxious', 'concerned'],
    // face-angry's eyes turned the other way, and a small frown
    d: [FACE, line([7.75, 10], [10.25, 8.75]), line([16.25, 10], [13.75, 8.75]), arc(12, 19, 3.25, 220, 320).d],
  },
  'face-nervous': {
    tags: ['nervioso', 'incómodo', 'tenso', 'nervous', 'awkward', 'grimacing'],
    // A wide clenched mouth crossed by two teeth
    d: [FACE, ...EYES, sq(7.75, 13.75, 8.5, 3.5, 1.5), line([10.58, 13.75], [10.58, 17.25]), line([13.42, 13.75], [13.42, 17.25])],
  },

  // ── Sad ──
  'face-crying': {
    tags: ['llorando', 'triste', 'lágrima', 'crying', 'tear', 'hurt'],
    // face-sad with a tear on the cheek, over the face's edge
    d: [FACE, ...EYES, FROWN],
    badge: piece([TEAR_R]),
  },
  'face-smile-tear': {
    tags: ['sonrisa con lágrima', 'conmovido', 'agradecido', 'smiling through tears', 'touched', 'bittersweet'],
    // face-smile, its smile a little shorter so the tear on the cheek clears it
    d: [FACE, ...EYES, arc(12, 12, 4.25, 40, 140).d],
    badge: piece([TEAR_R]),
  },
  'face-pleading': {
    tags: ['suplicando', 'por favor', 'ojos de cachorro', 'pleading', 'please', 'puppy eyes'],
    // face-eye-roll's rings, wide open, over a small pouting frown. (A wobbly frown, an M of two waves,
    // read as a moustache under those eyes.)
    d: [FACE, circ(8.375, 10.5, 2.2), circ(15.625, 10.5, 2.2), arc(12, 19, 3, 225, 315).d],
  },
  'face-shy': {
    tags: ['tímido', 'apenado', 'sonrojado', 'shy', 'bashful', 'blushing'],
    // The face looking down and away: the eyes lowered 2 and moved 1.75 to one side, 5 apart, and a
    // small smile under them (2.85 clear of each). Moved by 1 they read as face-smile drawn off-center.
    d: [FACE, dot(7.75, 11.75), dot(12.75, 11.75), arc(10.25, 13.75, 2.5, 40, 140).d],
  },

  // ── Silent ──
  'face-zipped': {
    tags: ['boca cerrada', 'secreto', 'sin comentarios', 'zipper mouth', 'secret', 'keep quiet'],
    // The mouth zipped: a line crossed by three teeth 3 apart, its pull tab (a dot) at the left end,
    // the first tooth 2.85 clear of it
    d: [FACE, ...EYES, dot(7.05, 14.75), line([7.75, 14.75], [17.25, 14.75]), ...[10.5, 13.5, 16.5].map((x) => line([x, 13.5], [x, 16]))],
  },
  'face-speechless': {
    tags: ['sin palabras', 'sin boca', 'callado', 'speechless', 'no words', 'silent'],
    d: [FACE, ...EYES],
  },
  'face-dashed': {
    tags: ['cara punteada', 'invisible', 'elegir emoji', 'dashed face', 'hidden', 'placeholder'],
    // The face's circle as ten dashes 3 apart (1.5 of paper), one centered at the top
    d: [Array.from({ length: 10 }, (_, k) => arc(12, 12, 9, -90 + k * 36 - 8.45, -90 + k * 36 + 8.45).d).join(''), ...EYES, FLAT_MOUTH],
  },
  'face-dizzy': {
    tags: ['mareado', 'aturdido', 'noqueado', 'dizzy', 'knocked out', 'overwhelmed'],
    d: [
      FACE,
      line([7.75, 8.5], [10.25, 11]),
      line([10.25, 8.5], [7.75, 11]),
      line([13.75, 8.5], [16.25, 11]),
      line([16.25, 8.5], [13.75, 11]),
      circ(12, 15.5, 1.5),
    ],
  },

  // ── Playful ──
  'face-partying': {
    tags: ['fiesta', 'celebrar', 'cumpleaños', 'partying', 'party', 'celebrate'],
    // A party horn blown from the mouth, crossing the jaw: a slim cone
    d: [FACE, ...ARCHES],
    badge: (() => {
      const [a, dir] = [[12.6, 15.25], [Math.cos((155 * Math.PI) / 180), Math.sin((155 * Math.PI) / 180)]];
      const b = [a[0] + 9 * dir[0], a[1] + 9 * dir[1]];
      const n = [-dir[1], dir[0]];
      const at = (p, k) => [p[0] + k * n[0], p[1] + k * n[1]];
      return piece([roundpoly([at(a, -0.6), at(b, -2.2), at(b, 2.2), at(a, 0.6)], [0.5, 0.6, 0.6, 0.5])]);
    })(),
  },
  'face-tongue': {
    tags: ['lengua', 'broma', 'travieso', 'tongue out', 'playful', 'silly'],
    // A smile with the tongue hanging from its middle
    d: [FACE, ...EYES, arc(12, 11, 4.25, 35, 145).d, `M10.5 ${f(11 + Math.sqrt(4.25 ** 2 - 1.5 ** 2))}V16.65${arcTo(12, 16.65, 1.5, 180, 0)}V${f(11 + Math.sqrt(4.25 ** 2 - 1.5 ** 2))}`],
  },
  'face-yum': {
    tags: ['delicioso', 'rico', 'antojo', 'yum', 'delicious', 'tasty'],
    // Happy eyes and a smile with the tongue licking out of one corner
    d: [FACE, ...ARCHES, arc(12, 11, 4.25, 35, 145).d, `M12.5 ${f(11 + Math.sqrt(4.25 ** 2 - 0.5 ** 2))}V16.5${arcTo(13.75, 16.5, 1.25, 180, 0)}V${f(11 + Math.sqrt(4.25 ** 2 - 3 ** 2))}`],
  },
  'face-disappointed': {
    tags: ['decepcionado', 'desanimado', 'pensativo', 'disappointed', 'let down', 'dejected'],
    // Lids lowered half a stroke and face-sad's frown
    d: [FACE, arc(9, 9.75, 1.5, 180, 0).d, arc(15, 9.75, 1.5, 180, 0).d, FROWN],
  },

  // ── Mood check-ins: reaction-add's face with the engine's status badges ──
  'mood-up': {
    tags: ['ánimo mejora', 'me siento mejor', 'tendencia', 'mood up', 'feeling better', 'mood trend'],
    d: MOOD,
    badge: badge('arrow-up'),
  },
  'mood-down': {
    tags: ['ánimo empeora', 'me siento peor', 'bajón', 'mood down', 'feeling worse', 'mood drop'],
    d: MOOD,
    badge: badge('arrow-down'),
  },
  'mood-check': {
    tags: ['ánimo registrado', 'check-in hecho', 'estado de ánimo', 'mood logged', 'check-in done', 'mood tracker'],
    d: MOOD,
    badge: badge('check'),
  },
  'mood-clock': {
    tags: ['recordatorio de ánimo', 'historial de ánimo', 'check-in programado', 'mood reminder', 'mood history', 'scheduled check-in'],
    d: MOOD,
    badge: badge('clock'),
  },
  'mood-alert': {
    tags: ['ánimo bajo', 'alerta de bienestar', 'atención', 'low mood', 'wellbeing alert', 'needs attention'],
    d: MOOD,
    badge: badge('alert'),
  },
  'mood-question': {
    tags: ['cómo te sientes', 'pregunta de ánimo', 'encuesta de pulso', 'how are you feeling', 'mood check-in', 'pulse survey'],
    d: MOOD,
    badge: badge('question'),
  },
  'mood-edit': {
    tags: ['editar ánimo', 'cambiar reacción', 'reacción personalizada', 'edit mood', 'edit reaction', 'custom reaction'],
    d: MOOD,
    badge: badge('edit'),
  },

  // ── Scales and logs ──
  'slider-mood': {
    tags: ['escala de ánimo', 'cómo te sientes', 'calificar', 'mood slider', 'mood scale', 'rate your mood'],
    // controles' slider-single with a smiling face for its knob: the track meets the face on both sides
    d: [line([2.75, 12], [7, 12]), line([19, 12], [21.25, 12]), ...faceR6([13, 12])],
  },
  'calendar-smile': {
    tags: ['calendario de ánimo', 'diario de ánimo', 'ánimo por día', 'mood calendar', 'mood log', 'daily mood'],
    // Núcleo's calendar with message-smile's face on its page: the eyes 2.85 under the header, the
    // smile 2.85 under the eyes and over the bottom edge
    d: [...CAL, dot(9.5, 13.25), dot(14.5, 13.25), arc(12, 15.18, 3, 35, 145).d],
  },

  // ── The heart's emotions (edicion's heart) ──
  'heart-broken': {
    tags: ['corazón roto', 'desamor', 'ruptura', 'duelo', 'broken heart', 'heartbreak', 'breakup'],
    // The heart at 0.8 split by a zigzag from the cleft to the point, its halves 3.8 apart: 1.5 of
    // paper on the steepest leg of the crack
    d: (() => {
      const [l, r] = halves([[10.5, 10.5], [13, 13.75], [11, 17]], { closed: true });
      return [place(l, 0.8, [12, 12.25], [10.1, 12.25]), place(r, 0.8, [12, 12.25], [13.9, 12.25])];
    })(),
  },
  'heart-mended': {
    tags: ['corazón sanado', 'sanar', 'recuperación', 'apoyo emocional', 'mending heart', 'healing', 'recovery'],
    // sistema's patch across the heart's left side, as a bandage wraps a wound; the engine clears the
    // heart around it
    d: [HEART],
    badge: piece([place(PATCH[0], 0.6, [12, 12], [7.25, 15.5])], PATCH.slice(1).map((d) => place(d, 0.6, [12, 12], [7.25, 15.5]))),
  },
  'heart-half': {
    tags: ['medio corazón', 'calificación', 'media puntuación', 'half heart', 'rating', 'half point'],
    // Split along its axis, as edicion's star-half: the left half closed (it fills), the right one open
    d: halves(),
  },
  'heart-exclamation': {
    tags: ['corazón exclamación', 'me encanta', 'amor', 'heart exclamation', 'love this', 'emphatic love'],
    // A smaller heart standing as the stroke of an exclamation mark, its dot 3.7 under the point (the
    // gap of Núcleo's `important`)
    d: [heartAt(12, 3.75, 13.5), dot(12, 19.5)],
  },
  'heart-smile': {
    tags: ['corazón feliz', 'amabilidad', 'cuidado', 'amor propio', 'happy heart', 'kindness', 'self-love'],
    // Dot eyes in the lobes and a smile 2.85 clear of them and of the heart's sides
    d: [HEART, dot(9.25, 10.25), dot(14.75, 10.25), arc(12, 12.25, 2.75, 35, 145).d],
  },

  // ── Signs ──
  'eyes-glance': {
    tags: ['ojos', 'mirando', 'de reojo', 'lo estoy viendo', 'eyes', 'looking', 'side eye'],
    // Two tall ovals 3 apart, each pupil pressed against its right side (it overlaps the oval at
    // every weight, as face-eye-roll's)
    d: [ell([7, 12], 3.5, 5.75), ell([17, 12], 3.5, 5.75), dot(9.25, 12.5, 0.9), dot(19.25, 12.5, 0.9)],
  },
  'anger-symbol': {
    tags: ['símbolo de enojo', 'vena', 'furia', 'irritación', 'anger symbol', 'rage', 'popping vein'],
    // The manga vein: four arcs on the diagonals bulging toward the center, their ends 3 apart across
    // the axes (quarter circles closed into a four-point sparkle); drawn once and turned
    d: [0, 90, 180, 270].map((deg) => turnPath(arc(4.5, 4.5, 6, 12, 78).d, deg)),
  },
};

// ── Fill (DESIGN.md › Fill) ────────────────────────────────────────────────────────────────
const rest = (name, from = 1) => icons[name].d.map((_, i) => i).slice(from);
const FILL = {};
// Faces: the circle filled and the features knocked out (comunicacion's)
const FACES = Object.keys(icons).filter((n) => n.startsWith('face-'));
for (const name of FACES) FILL[name] = { solid: [0], cut: rest(name) };
// reaction-add's: the face filled, its features cut out; the badge brings its own fill
for (const name of Object.keys(icons).filter((n) => n.startsWith('mood-'))) FILL[name] = { solid: [0], cut: [1, 2, 3] };
Object.assign(FILL, {
  // slider-single's: the knob filled, the track attached to it
  'slider-mood': { solid: [2], wire: [0, 1], cut: [3, 4, 5] },
  // Núcleo's calendar: the rings stand apart, the header and the face are cut out
  'calendar-smile': { solid: [0], lines: [1, 2], cut: [3, 4, 5, 6] },
  'heart-broken': { solid: [0, 1] },
  'heart-mended': { solid: [0] },
  // star-half's: the left half fills, the right one stays its outline
  'heart-half': { solid: [0], wire: [1] },
  'heart-exclamation': { solid: [0, 1] },
  'heart-smile': { solid: [0], cut: [1, 2, 3] },
  'eyes-glance': { solid: [0, 1], cut: [2, 3] },
});
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}

// Lines only: the dashed face (its ring is ten dashes) and the anger mark
icons['face-dashed'].fill = false;
icons['anger-symbol'].fill = false;

// ── Named parts (DESIGN.md › Named parts) ─────────────────────────────────────────────────────
// Faces: the face, its eyes (or glasses) and its mouth; what lies on top of one is its badge
const facePart = (eyes, mouth) => ({ face: [0], ...(eyes.length && { eyes }), ...(mouth.length && { mouth }) });
const PARTS = {};
for (const name of FACES) PARTS[name] = facePart([1, 2], rest(name, 3));
Object.assign(PARTS, {
  'face-cool': { face: [0], glasses: [1, 2, 3], mouth: [4] },
  'face-nerd': { face: [0], glasses: [1, 2, 3], mouth: [4] },
  'face-skeptical': { face: [0], eyes: [1, 2], brow: [3], mouth: [4] },
  'face-eye-roll': facePart([1, 2, 3, 4], [5]),
  'face-dizzy': facePart([1, 2, 3, 4], [5]),
  'face-masked': { face: [0], eyes: [1, 2], mask: [3, 4, 5] },
});
for (const name of Object.keys(icons).filter((n) => n.startsWith('mood-'))) PARTS[name] = { face: [0, 1, 2, 3] };
Object.assign(PARTS, {
  'slider-mood': { track: [0, 1], knob: [2, 3, 4, 5] },
  'calendar-smile': { body: [0], rings: [1, 2], header: [3], face: [4, 5, 6] },
  'heart-broken': { left: [0], right: [1] },
  'heart-mended': { heart: [0] },
  'heart-half': { half: [0], outline: [1] },
  'heart-exclamation': { heart: [0], mark: [1] },
  'heart-smile': { heart: [0], face: [1, 2, 3] },
  'eyes-glance': { eyes: [0, 1], pupils: [2, 3] },
  'anger-symbol': { mark: [0, 1, 2, 3] },
});
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion) ───────────────────────────────────────────────────────────────
const BC = [17.25, 17.25];
const MOTION = {
  // Laughing and shivering shake the face; the party horn toots; the hearts in the eyes beat
  'face-tears-of-joy': { effect: 'wiggle', origin: [12, 21] },
  'face-cold': { effect: 'wiggle', origin: [12, 21] },
  'face-partying': { effect: 'wiggle', parts: ['badge'], origin: [12.6, 15.25] },
  'face-love': { effect: 'beat', parts: ['eyes'], origin: [12, 10.75] },
  // The mood badges move as archivos' do
  'mood-up': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'mood-down': { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] },
  'mood-clock': { effect: 'spin', parts: ['badge'], origin: BC },
  'mood-alert': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'mood-question': { effect: 'wiggle', parts: ['badge'], origin: BC },
  'mood-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  // edicion's heart beats; the flame flickers from its base (lugares'), the heart beside it still
  'heart-mended': { effect: 'beat', origin: [12, 12.5] },
  'heart-smile': { effect: 'beat', origin: [12, 12.5] },
  'heart-exclamation': { effect: 'beat', parts: ['heart'], origin: [12, 9.75] },
  'anger-symbol': { effect: 'beat', origin: [12, 12] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── 16 px (DESIGN.md › 16 px) ─────────────────────────────────────────────────────────────────
// comunicacion's faces at 16 px, piece for piece: the r 8.25 circle (its extremes on pixel centers;
// the r 9 one falls between two pixels and reads as a gray ring), the dot eyes on 2 × 2 pixels, and
// each mouth with its straight runs and its ends on the grid (a pixel is 1.5, its centers at
// 0.75 + 1.5k). Eyes take rows 8.25–11.25, mouths 12.75–17.25, with a clear row between them. What a
// pixel can't hold is simplified: the star eyes are 3 × 3 crosses, the heart eyes 3 × 3 hearts.
{
  const C16 = circ(12, 12, 8.25);
  const E16 = [dot(9, 9, 0.8), dot(15, 9, 0.8)];
  const ARCH16 = [arc(9, 9.75, 1.5, 180, 360).d, arc(15, 9.75, 1.5, 180, 360).d];
  const LIDS16 = (y = 8.25) => [arc(9, y, 1.5, 180, 0).d, arc(15, y, 1.5, 180, 0).d];
  const FLAT16 = [line([7.5, 9.75], [10.5, 9.75]), line([13.5, 9.75], [16.5, 9.75])];
  const SQZ16 = [line([8.25, 8.25], [9.75, 9.75], [8.25, 11.25]), line([15.75, 8.25], [14.25, 9.75], [15.75, 11.25])];
  const RINGS16 = [circ(8.25, 9.75, 1.5), circ(15.75, 9.75, 1.5)];
  const SMILE16 = arc(12, 11.25, 4.5, 35, 145).d;
  const FROWN16 = arc(12, 20.25, 4.5, 215, 325).d;
  const LAUGH16 = `M7.5 12.75H16.5${arcTo(12, 12.75, 4.5, 0, 180)}`;
  const GRIN16 = `M9 14.25H15${arcTo(12, 14.25, 3, 0, 180)}`;
  const FLATM16 = line([8.25, 15.75], [15.75, 15.75]);
  const O16 = circ(12, 15, 2.25);
  const ZIG16 = line([8.25, 15.75], [9.75, 14.25], [11.25, 15.75], [12.75, 14.25], [14.25, 15.75], [15.75, 14.25]);
  const plus16 = (cx, cy) => [line([cx - 1.5, cy], [cx + 1.5, cy]), line([cx, cy - 1.5], [cx, cy + 1.5])];
  const heart16 = (cx, cy) => `M${f(cx - 1.5)} ${f(cy - 1.5)}L${f(cx - 1.5)} ${f(cy)}L${f(cx)} ${f(cy + 1.5)}L${f(cx + 1.5)} ${f(cy)}L${f(cx + 1.5)} ${f(cy - 1.5)}L${f(cx)} ${f(cy)}Z`;
  const rolled16 = (cx) => [`M${f(cx - 1.5)} 11.25V8.25H${f(cx + 1.5)}V11.25`, line([cx - 1.5, 9.75], [cx + 1.5, 9.75])];
  const ex16 = (cx) => [line([cx - 1.5, 8.25], [cx + 1.5, 11.25]), line([cx + 1.5, 8.25], [cx - 1.5, 11.25])];
  // Whatever lies on top (a tear, the thermometer, the horn) comes in with the circle
  const k = 8.25 / 9;
  const inward = (d) => transform(d, k, 12 - 12 * k, 12 - 12 * k);
  const ringAt = (y) => 12 - Math.sqrt(8.25 ** 2 - (y - 12) ** 2);
  const SMALL = {
    'face-grin': [...E16, LAUGH16],
    'face-happy': [...ARCH16, SMILE16],
    'face-tears-of-joy': [...ARCH16, GRIN16],
    'face-love': [heart16(8.25, 9.75), heart16(15.75, 9.75), SMILE16],
    'face-kiss': [...ARCH16, 'M11.25 12.75A1.125 1.125 0 0 1 11.25 15A1.125 1.125 0 0 1 11.25 17.25'],
    'face-star-struck': [...plus16(8.25, 9.75), ...plus16(15.75, 9.75), GRIN16],
    'face-cool': [line([ringAt(8.25), 8.25], [24 - ringAt(8.25), 8.25]), sq(6.75, 8.25, 3, 1.5, 0.75), sq(14.25, 8.25, 3, 1.5, 0.75), SMILE16],
    'face-nerd': [...RINGS16, line([9.75, 9.75], [14.25, 9.75]), GRIN16],
    'face-thinking': [dot(9, 7.5, 0.8), dot(13.5, 7.5, 0.8), line([11.25, 15.75], [15.75, 14.25])],
    'face-skeptical': [dot(9, 10.5, 0.8), dot(15, 10.5, 0.8), line([13.5, 6.75], [16.5, 6.75]), line([9, 15.75], [15, 14.25])],
    'face-annoyed': [...FLAT16, FLATM16],
    'face-eye-roll': [...rolled16(8.25), ...rolled16(15.75), FLATM16],
    'face-smirk': [...E16, `M8.25 15.75H12.75${arcTo(12.75, 12.75, 3, 90, 20)}`],
    'face-upside-down': [dot(15, 15, 0.8), dot(9, 15, 0.8), arc(12, 12.75, 4.5, 215, 325).d],
    'face-relieved': [...LIDS16(), SMILE16],
    'face-sleeping': [...LIDS16(), dot(12, 15, 0.8)],
    'face-yawning': [...LIDS16(), O16],
    'face-tired': [...SQZ16, `M9 17.25H15${arcTo(12, 17.25, 3, 0, -180)}`],
    'face-frustrated': [...SQZ16, ZIG16],
    'face-sick': [...E16],
    'face-disgusted': [...FLAT16, smooth([[8.25, 15.75], [10.5, 14.25], [13.5, 15.75], [15.75, 14.25]])],
    'face-masked': [...E16, sq(8.25, 12.75, 7.5, 4.5, 1.5), line([ringAt(14.25), 14.25], [8.25, 14.25]), line([15.75, 14.25], [24 - ringAt(14.25), 14.25])],
    'face-hot': [...FLAT16, line([8.25, 12.75], [15.75, 12.75]), 'M11.25 12.75V15.75A0.75 0.75 0 0 0 12.75 15.75V12.75'],
    'face-cold': [...RINGS16, ZIG16],
    'face-scared': [...RINGS16, O16],
    'face-worried': [line([7.5, 9.75], [10.5, 8.25]), line([16.5, 9.75], [13.5, 8.25]), FROWN16],
    'face-nervous': [...E16, sq(6.75, 12.75, 10.5, 3, 1), line([9.75, 12.75], [9.75, 15.75]), line([14.25, 12.75], [14.25, 15.75])],
    'face-crying': [...E16, FROWN16],
    'face-smile-tear': [...E16, SMILE16],
    'face-pleading': [...RINGS16, arc(12, 18.75, 3, 220, 320).d],
    'face-shy': [dot(7.5, 12, 0.8), dot(12, 12, 0.8), arc(9.75, 14.25, 3, 35, 145).d],
    'face-zipped': [...E16, dot(7.5, 15, 0.8), line([8.25, 14.25], [16.5, 14.25]), line([11.25, 12.75], [11.25, 15.75]), line([14.25, 12.75], [14.25, 15.75])],
    'face-speechless': [...E16],
    'face-dashed': [...E16, FLATM16],
    'face-dizzy': [...ex16(8.25), ...ex16(15.75), circ(12, 15.75, 1.5)],
    'face-partying': [...ARCH16],
    'face-tongue': [...E16, SMILE16, `M11.25 ${f(11.25 + Math.sqrt(4.5 ** 2 - 0.75 ** 2))}V17.25A0.75 0.75 0 0 0 12.75 17.25V${f(11.25 + Math.sqrt(4.5 ** 2 - 0.75 ** 2))}`],
    'face-yum': [...ARCH16, SMILE16, `M12.75 ${f(11.25 + Math.sqrt(4.5 ** 2 - 0.75 ** 2))}V17.25A0.75 0.75 0 0 0 14.25 17.25V${f(11.25 + Math.sqrt(4.5 ** 2 - 2.25 ** 2))}`],
    'face-disappointed': [...LIDS16(9.75), FROWN16],
  };
  for (const [name, feats] of Object.entries(SMALL)) {
    const icon = icons[name];
    const ring = name === 'face-dashed' ? Array.from({ length: 10 }, (_, j) => arc(12, 12, 8.25, -90 + j * 36 - 8, -90 + j * 36 + 8).d).join('') : C16;
    const d = [ring, ...feats];
    const top = icon.badge ? icon.badge.d.map(inward) : [];
    icon.small = { d, ...(icon.fill && { fill: { solid: [ring], cut: feats } }), ...(top.length && { badge: piece(top) }) };
  }
}

// The rest at 16 px, on the same grid
{
  // controles' slider with the knob face on pixel centers: the circle r 4.5, one-pixel eyes, the track
  // on row 12.75
  const knob = circ(12.75, 12.75, 4.5);
  const sliderFace = [circ(11.25, 11.25, 0.1), circ(14.25, 11.25, 0.1), arc(12.75, 12, 2.25, 40, 140).d];
  const track = [line([2.25, 12.75], [8.25, 12.75]), line([17.25, 12.75], [21.75, 12.75])];
  icons['slider-mood'].small = { d: [...track, knob, ...sliderFace], fill: { solid: [knob], wire: track, cut: sliderFace } };
  // lugares' calendar at 16 px (calendar-day's) with one-pixel eyes and the smile on rows 15.75–17.25
  const cal = lugares.icons['calendar-day'].small.d.slice(0, 4);
  const calFace = [circ(9.75, 12.75, 0.1), circ(14.25, 12.75, 0.1), arc(12, 14.25, 3, 35, 145).d];
  icons['calendar-smile'].small = { d: [...cal, ...calFace], fill: { solid: [cal[0]], lines: cal.slice(1, 3), cut: [cal[3], ...calFace] } };
  // The patch without its pad: at 16 px the pad's edges clog the strip
  icons['heart-mended'].small = { d: [HEART], fill: { solid: [HEART] }, badge: piece([icons['heart-mended'].badge.d[0]]) };
  // The eyes as tall rounded boxes, each pupil a 2 × 2 dot pressed against its right side
  const eyes16 = [sq(3.75, 6.75, 6, 10.5, 3), sq(14.25, 6.75, 6, 10.5, 3)];
  const pupils16 = [dot(9, 12, 0.8), dot(19.5, 12, 0.8)];
  icons['eyes-glance'].small = { d: [...eyes16, ...pupils16], fill: { solid: eyes16, cut: pupils16 } };
  // The vein as four bent strokes on pixel centers: two pixels up, two on the diagonal, two across
  icons['anger-symbol'].small = { d: [0, 90, 180, 270].map((deg) => turnPath(line([9.75, 5.25], [9.75, 6.75], [6.75, 9.75], [5.25, 9.75]), deg)) };
}

// ── Mirror and variants ───────────────────────────────────────────────────────────────────────
// The slider runs in the reading direction (controles'); the half heart fills where reading starts (star-half's)
for (const name of ['slider-mood', 'heart-half']) icons[name].mirror = true;
// Already enclosed: the faces are circles
for (const name of [...FACES, ...Object.keys(icons).filter((n) => n.startsWith('mood-'))]) icons[name].variants = { circle: false };
// A slash through loose strokes says nothing
icons['anger-symbol'].variants = { slash: false };

export default { category: 'emociones', label: 'Caras y emociones', icons };
