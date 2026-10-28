// Manos y gestos (hands and gestures), round 7: touch gestures, hand signs, pointing, an open hand
// offering something, thumbs and two hands together. Drawn with the engine (engine/geometry.mjs) and
// the rules in DESIGN.md. Every hand shares one construction: fingers 3 wide with round tips, the
// palm, the thumb leaving its heel, and on the side views the shirt cuff of comunicacion's thumbs-up.
// - The touch hand is navegacion's hand-pointer (`pointer`) with a shorter index, so its ripples,
//   arrows and rays fit above it; two and three fingers up (`fingers`) and the thumb out in a V
//   (`vhand`) are the same hand. Taps ripple from the fingertip 3 apart; swipes sit under or beside
//   the arrow of their direction.
// - Front hands (`openHand`) generalize comunicacion's raised hand; the open hand palm up is
//   comercio's donation, its cuff and palm, carrying what it offers above it.
// - Pointing is drawn once, upright (the pointer with a longer index, its wrist on the cuff), and
//   turned; the left one is mirrored so the thumb stays on top. The knocking fist is hand-fist's
//   construction turned to face its door (`fist`).
// - A hand in front of another piece (the finger on a card, the palm under a phone, the second thumb
//   or palm) is a custom badge: the engine clears what it covers. The touch hands with a status take
//   the engine's clock, gear and lock badges.
// - Hand-stop is comunicacion's raised hand itself. No thumb is turned sideways: every turn of the
//   thumbs-up reads as a mitten.
// It adopts thumbs-up, thumbs-down and hand-raised from comunicacion; no religious or offensive gestures.
import { arc, badge, circ, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import nucleo from './nucleo.mjs';

const P = ([x, y]) => `${f(x)} ${f(y)}`;
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const unit = (a, b) => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
};
/** Where lines a1a2 and b1b2 meet. */
function meet(a1, a2, b1, b2) {
  const d = (a2[0] - a1[0]) * (b2[1] - b1[1]) - (a2[1] - a1[1]) * (b2[0] - b1[0]);
  const t = ((b1[0] - a1[0]) * (b2[1] - b1[1]) - (b1[1] - a1[1]) * (b2[0] - b1[0])) / d;
  return [a1[0] + (a2[0] - a1[0]) * t, a1[1] + (a2[1] - a1[1]) * t];
}
/** Polygon with rounded corners, each given as [x, y, radius]. */
const rp = (pts) =>
  roundpoly(
    pts.map(([x, y]) => [x, y]),
    pts.map((p) => p[2] ?? 0),
  );
/** Closes an open outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
const move = (ds, dx, dy) => ds.map((d) => transform(d, 1, dx, dy));
const flipY = (ds, c = 12) => ds.map((d) => flipPath(d, 'y', c));

// ── Hands ─────────────────────────────────────────────────────────────────────────────────────
/**
 * The touch hand: navegacion's hand-pointer with its measurements (the index 3 wide from `o`, the
 * curled fingers as one knuckle, the palm, the thumb back to the base of the index), its index `L`
 * long to the tip's center. Upright, at L 11, it is hand-pointer itself.
 */
function pointer([ox, oy], { L = 6.75, kn = 3, rk = 2.4 } = {}) {
  const R = ox + 3 + 2 * rk;
  const bx = ox + 2.55;
  let d = `M${P([ox, oy])}V${f(oy - L)}A1.5 1.5 0 0 1 ${P([ox + 3, oy - L])}`;
  d += `V${f(oy - kn)}A${f(rk)} ${f(rk)} 0 0 1 ${P([R, oy - kn])}`;
  d += `V${f(oy - 1.5)}C${P([R, oy + 2.1])} ${P([R - 2.4, oy + 4.75])} ${P([bx, oy + 4.75])}`;
  d += `H${f(bx - 1)}C${P([bx - 2.95, oy + 4.75])} ${P([bx - 4.3, oy + 3.85])} ${P([ox - 2.75, oy + 2.3])}`;
  d += `L${P([ox - 4.15, oy - 0.6])}A1.4 1.4 0 0 1 ${P([ox - 1.85, oy - 2.2])}Z`;
  return d;
}
/** The center of the touch hand's fingertip. */
const tipOf = ([ox, oy], L = 6.75) => [ox + 1.5, oy - L];
/** Two or three fingers up together (the touch hand's), the folded ones as one smaller knuckle, and the lines between them. */
function fingers([ox, oy], tops, { kn = 3, rk = 1.5 } = {}) {
  const n = tops.length;
  const R = ox + 3 * n + 2 * rk;
  const bx = ox + 2.55 + 0.3 * (R - ox - 7.8);
  let d = `M${P([ox, oy])}`;
  tops.forEach((t, i) => {
    d += `V${f(oy - t)}A1.5 1.5 0 0 1 ${P([ox + 3 * (i + 1), oy - t])}`;
  });
  d += `V${f(oy - kn)}A${f(rk)} ${f(rk)} 0 0 1 ${P([R, oy - kn])}`;
  d += `V${f(oy - 1.5)}C${P([R, oy + 2.1])} ${P([R - 2.6, oy + 4.75])} ${P([bx, oy + 4.75])}`;
  d += `H${f(bx - 1)}C${P([bx - 2.95, oy + 4.75])} ${P([bx - 4.3, oy + 3.85])} ${P([ox - 2.75, oy + 2.3])}`;
  d += `L${P([ox - 4.15, oy - 0.6])}A1.4 1.4 0 0 1 ${P([ox - 1.85, oy - 2.2])}Z`;
  const lines = tops.slice(1).map((t, i) => line([ox + 3 * (i + 1), oy - Math.min(t, tops[i])], [ox + 3 * (i + 1), oy - kn + 0.25]));
  return [d, ...lines];
}
/** The touch hand with its thumb out in a V, from the heel to the center of its tip (2.8 wide, as the pointer's). */
function vhand([ox, oy], tip, { L = 6.75, kn = 3, rk = 2.4 } = {}) {
  const R = ox + 3 + 2 * rk;
  const bx = ox + 2.55;
  const outB = [ox - 2.75, oy + 2.3];
  const u0 = unit(outB, tip);
  const base = add(outB, [u0[1], -u0[0]], -1.4);
  const u = unit(base, tip);
  const n = [u[1], -u[0]];
  const [oB, oT, iT, iB] = [add(base, n, 1.4), add(tip, n, 1.4), add(tip, n, -1.4), add(base, n, -1.4)];
  const J = meet(iT, iB, [ox, 0], [ox, 24]);
  let d = `M${P(J)}V${f(oy - L)}A1.5 1.5 0 0 1 ${P([ox + 3, oy - L])}`;
  d += `V${f(oy - kn)}A${f(rk)} ${f(rk)} 0 0 1 ${P([R, oy - kn])}`;
  d += `V${f(oy - 1.5)}C${P([R, oy + 2.1])} ${P([R - 2.4, oy + 4.75])} ${P([bx, oy + 4.75])}`;
  d += `H${f(bx - 1)}C${P([bx - 2.95, oy + 4.75])} ${P([bx - 4.3, oy + 3.85])} ${P(oB)}`;
  d += `L${P(oT)}A1.4 1.4 0 0 1 ${P(iT)}Z`;
  return d;
}
/**
 * Front hand, comunicacion's raised hand generalized: `fingers` side by side from `x0` ({ w, top }:
 * width, where the round tip starts), the palm's right side down to `side` and round to `bottom` at
 * `bx`, the thumb 3 wide from `base` to `tip`.
 */
function openHand({ x0, fingers: fs, side, bottom, bx, base, tip }) {
  const L = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
  const n = [(tip[1] - base[1]) / L, -(tip[0] - base[0]) / L];
  const at = (p, k) => [p[0] + n[0] * k, p[1] + n[1] * k];
  const [outB, outT, inT, inB] = [at(base, 1.5), at(tip, 1.5), at(tip, -1.5), at(base, -1.5)];
  const J = [x0, inT[1] + ((x0 - inT[0]) / (inB[0] - inT[0])) * (inB[1] - inT[1])];
  let d = `M${P(J)}`;
  let x = x0;
  for (const g of fs) {
    const w = g.w ?? 3;
    d += `V${f(g.top)}A${f(w / 2)} ${f(w / 2)} 0 0 1 ${f(x + w)} ${f(g.top)}`;
    x += w;
  }
  d += `V${f(side)}C${P([x, side + 0.576 * (bottom - side)])} ${P([bx + 0.55 * (x - bx), bottom])} ${P([bx, bottom])}`;
  d += `C${P([bx - 2.85, bottom])} ${P([outB[0] + 0.9, outB[1] + 1.1])} ${P(outB)}`;
  d += `L${P(outT)}A1.5 1.5 0 0 1 ${P(inT)}Z`;
  return d;
}
/** The lines between an open hand's fingers, down to `split`. */
function seams(x0, fs, split) {
  const out = [];
  let x = x0;
  fs.forEach((g, i) => {
    x += g.w ?? 3;
    const h = fs[i + 1];
    if (h && (g.w ?? 3) === 3 && (h.w ?? 3) === 3) out.push(line([x, Math.max(g.top, h.top)], [x, split]));
  });
  return out;
}
/**
 * Thumbs-up from comunicacion's measurements (at 13 × 11.25 with a 5.85 thumb and a 4 cuff it is
 * thumbs-up itself), so a smaller one keeps its thumb 2.8 wide: the fist's bottom left at `x0, y0`.
 */
function thumbsUp(x0, y0, fw, fh, tl, cw) {
  const B = [x0, y0 - fh * 0.87];
  const C = [x0 + 0.384 * (B[1] - (y0 - fh - tl)), y0 - fh - tl];
  const D = [C[0] + 2.8, C[1] + 0.95];
  const E = [D[0] - 0.1 * (y0 - fh - D[1]), y0 - fh];
  const k = fw / 13;
  const fist = rp([[x0, y0], [...B, 0.6], [...C, 1.5], [...D, 1.3], [...E, 0.9], [x0 + fw, y0 - fh, 2.25 * k + 0.5], [x0 + fw - 1.5 * k, y0, 1.75 * k + 0.25]]);
  const r = Math.min(1.25, cw / 2.5);
  return [fist, `M${P(B)}H${f(x0 - cw + r)}A${f(r)} ${f(r)} 0 0 0 ${P([x0 - cw, B[1] + r])}V${f(y0 - r)}A${f(r)} ${f(r)} 0 0 0 ${P([x0 - cw + r, y0])}H${f(x0)}`, line(B, [x0, y0])];
}

// ── Marks ─────────────────────────────────────────────────────────────────────────────────────
const HEAD = 3.9;
const arrow = (a, b) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], HEAD)];
const arrow2 = (a, b) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], HEAD), head(a, [a[0] - b[0], a[1] - b[1]], HEAD)];
/** The k-th ripple around a fingertip: 3 apart, from the tip's own arc out. */
const ripple = (c, k) => arc(c[0], c[1], 1.5 + 3 * k, 200 + 2.5 * (k - 1), 340 - 2.5 * (k - 1)).d;
/** Four-pointed sparkle with concave sides (datos' sparkle). */
function sparkle([cx, cy], R) {
  const [a, b] = [0.065, 0.389];
  const Q = (x, y) => P([cx + x * R, cy + y * R]);
  return `M${Q(0, -1)}C${Q(a, -b)} ${Q(b, -a)} ${Q(1, 0)}C${Q(b, a)} ${Q(a, b)} ${Q(0, 1)}C${Q(-a, b)} ${Q(-b, a)} ${Q(-1, 0)}C${Q(-b, -a)} ${Q(-a, -b)} ${Q(0, -1)}Z`;
}
/** A bow's loop: a teardrop from the knot `k` round a circle of radius `r` at `c`. */
function loop(k, c, r) {
  const phi = (Math.atan2(k[1] - c[1], k[0] - c[0]) * 180) / Math.PI;
  const a = (Math.acos(r / Math.hypot(k[0] - c[0], k[1] - c[1])) * 180) / Math.PI;
  return `M${P(k)}L${P(polar(...c, r, phi + a))}${arc(...c, r, phi + a, phi - a + 360).d.replace(/^M[^A]*/, '')}Z`;
}
/** A custom badge: a piece in front that the engine clears the base around. */
const front = (d, extra = []) => ({ d: [d, ...extra], knock: d, fill: { solid: [d], ...(extra.length && { cut: extra }) } });

// ── Placements ────────────────────────────────────────────────────────────────────────────────
const O_TAP = [10.5, 15];
const O_TAP2 = [10.5, 16.5];
const O_BADGE = [9.25, 14.5];
const O_SWIPE = [10.5, 16];
const O_SIDE = [7, 16.5];
const O_V = [11.5, 16.5];
const V_TIP = [6, 12.25];
const tap = (o) => [pointer(o), ripple(tipOf(o), 1)];
const SWIPE_RIGHT = [pointer(O_SWIPE), ...arrow([4.25, 4.75], [19.75, 4.75])];

// Pointing, drawn upright: the pointer with a longer index, its wrist flat on the cuff below.
function upright(L) {
  const [ox, oy, kn, rk] = [10, 14.25, 4.5, 2.5];
  const R = ox + 3 + 2 * rk;
  const w = oy + 2.5;
  let d = `M${P([ox, oy])}V${f(oy - L)}A1.5 1.5 0 0 1 ${P([ox + 3, oy - L])}V${f(oy - kn)}A${f(rk)} ${f(rk)} 0 0 1 ${P([R, oy - kn])}`;
  d += `V${f(w)}H${f(ox - 2.75)}V${f(oy + 2.3)}L${P([ox - 4.15, oy - 0.6])}A1.4 1.4 0 0 1 ${P([ox - 1.85, oy - 2.2])}Z`;
  const c = `M${P([ox - 2.75, w])}V${f(w + 2.5)}A1.25 1.25 0 0 0 ${P([ox - 1.5, w + 3.75])}H${f(R - 1.25)}A1.25 1.25 0 0 0 ${P([R, w + 2.5])}V${f(w)}`;
  return [d, c, line([ox - 2.75, w], [R, w])];
}
const POINT_UP = upright(10);
const POINT_RIGHT = POINT_UP.map((d) => turnPath(d, 90));

/**
 * The fist from the front (hand-fist's construction: four knuckles 3 wide, the thumb across the
 * first two, the lines between them down to it), its palm ending at `b`, the thumb's top at `ty`.
 * Shallower than hand-fist, the line between the last two fingers would end next to the thumb's
 * tip: their knuckles alone part them.
 */
function fist(b, ty) {
  const body = `M6 ${f(b - 3)}V8.25A1.5 1.5 0 0 1 9 8.25V7.5A1.5 1.5 0 0 1 12 7.5V7.75A1.5 1.5 0 0 1 15 7.75V8.75A1.5 1.5 0 0 1 18 8.75V${f(b - 3.5)}C18 ${f(b - 1.6)} 16.6 ${f(b)} 14.75 ${f(b)}H9C7.35 ${f(b)} 6 ${f(b - 1.35)} 6 ${f(b - 3)}Z`;
  const thumb = `M6 ${f(ty)}H11.75A1.5 1.5 0 0 1 11.75 ${f(ty + 3)}H6`;
  return [body, thumb, line([9, 8.25], [9, ty]), line([12, 7.75], [12, ty + 0.02])];
}
// Knocking: that fist, 10.75 deep (the thumb 3 off the palm's end), turned so its knuckles face right,
// at the left of the canvas
const FIST_RIGHT = fist(16.75, 10.75).map((d) => transform(turnPath(d, 90), 1, -5, 0));

// The open hand palm up (comercio's donation: its cuff and palm), what it offers above it
const PALM = [comercio.icons.donation.d[1], comercio.icons.donation.d[2]];
const RAISED = comunicacion.icons['hand-raised'].d;

const icons = {
  // ── Touch: tap, press and drag ──────────────────────────────────────────────────────────────
  'hand-tap': { tags: ['tocar', 'toque', 'pulsar', 'tap', 'touch', 'press'], d: tap(O_TAP) },
  'hand-double-tap': { tags: ['doble toque', 'tocar dos veces', 'ampliar', 'double tap', 'zoom', 'like'], d: [pointer(O_TAP2), ripple(tipOf(O_TAP2), 1), ripple(tipOf(O_TAP2), 2)] },
  // The tap with the engine's clock: touch and hold
  'hand-long-press': { tags: ['mantener presionado', 'presión larga', 'menú contextual', 'long press', 'touch and hold', 'hold'], d: tap(O_BADGE), badge: badge('clock') },
  // A firm press: three rays off the fingertip instead of a ripple
  'hand-deep-press': {
    tags: ['presión firme', 'presionar fuerte', 'vista previa', 'firm press', 'force touch', 'peek'],
    d: (() => {
      const [cx, cy] = tipOf(O_TAP2);
      return [pointer(O_TAP2), ...[225, 270, 315].map((a) => line(polar(cx, cy, 4.5, a), polar(cx, cy, 7.25, a)))];
    })(),
  },
  // The finger on a card, two speed lines behind it
  'hand-drag': {
    tags: ['arrastrar', 'mover', 'reordenar', 'drag', 'move', 'touch and drag'],
    d: [sq(7.25, 3.5, 7.5, 7.5, 2.25), line([2.25, 5.5], [4.4, 5.5]), line([2.25, 9], [4.4, 9])],
    badge: front(pointer([11.5, 16.75])),
  },
  'hand-tap-gear': { tags: ['ajustes táctiles', 'sensibilidad', 'atajos de gestos', 'touch settings', 'gesture settings', 'sensitivity'], d: tap(O_BADGE), badge: badge('gear') },
  'hand-tap-lock': { tags: ['bloqueo táctil', 'fijar pantalla', 'bloqueo infantil', 'touch lock', 'screen pinning', 'child lock'], d: tap(O_BADGE), badge: badge('lock') },
  // Vibration on each side of the fingertip
  'hand-haptic': {
    tags: ['háptica', 'vibración', 'respuesta táctil', 'haptic', 'haptics', 'vibration'],
    d: (() => {
      const zz = (x, s) => line(...[2.75, 4.25, 5.75, 7.25, 8.75].map((y, i) => [x + s * (i % 2 ? 1.5 : 0), y]));
      return [pointer([10.5, 17]), zz(7.5, -1), zz(16.5, 1)];
    })(),
  },
  // Hover: the tap's ripple dashed, the finger not yet touching (three dots in an arc over the
  // fingertip read as a paw print)
  'hand-hover': {
    tags: ['flotar', 'sin tocar', 'proximidad', 'hover', 'air view', 'proximity'],
    d: (() => {
      const [cx, cy] = tipOf(O_TAP2);
      return [pointer(O_TAP2), ...[[203, 228], [257.5, 282.5], [312, 337]].map(([a0, a1]) => arc(cx, cy, 6, a0, a1).d)];
    })(),
  },
  // The trace it has drawn, ending at the fingertip
  'hand-draw': {
    tags: ['dibujar con el dedo', 'trazo', 'gesto personalizado', 'finger draw', 'draw', 'custom gesture'],
    d: [pointer([12, 16.75]), 'M3 14C5.5 13.25 8.75 9.25 8.75 6C8.75 4.25 7.75 3.25 6.75 3.25C5.5 3.25 4.75 4.5 5.25 6C6 8.25 9.75 9.75 13.5 8.5'],
  },

  // ── Touch: swipes ───────────────────────────────────────────────────────────────────────────
  'hand-swipe-right': { tags: ['deslizar a la derecha', 'anterior', 'aceptar', 'swipe right', 'go back', 'accept'], d: SWIPE_RIGHT },
  'hand-swipe-left': { tags: ['deslizar a la izquierda', 'siguiente', 'descartar', 'swipe left', 'next', 'dismiss'], d: SWIPE_RIGHT.map((d) => flipPath(d)) },
  'hand-swipe-up': { tags: ['deslizar hacia arriba', 'abrir', 'ver más', 'swipe up', 'go home', 'see more'], d: [pointer(O_SIDE), ...arrow([19, 12], [19, 2.75])] },
  'hand-swipe-down': { tags: ['deslizar hacia abajo', 'cerrar hoja', 'notificaciones', 'swipe down', 'dismiss', 'close sheet'], d: [pointer(O_SIDE), ...arrow([19, 2.75], [19, 12])] },
  'hand-swipe-horizontal': { tags: ['deslizar', 'carrusel', 'cambiar de página', 'swipe', 'carousel', 'browse'], d: [pointer(O_SWIPE), ...arrow2([4.25, 4.75], [19.75, 4.75])] },
  'hand-swipe-vertical': { tags: ['desplazar', 'deslizar arriba y abajo', 'feed', 'scroll', 'swipe up and down', 'touch scroll'], d: [pointer(O_SIDE), ...arrow2([19, 2.75], [19, 12])] },
  // From the screen's edge: the edge at the left, the hand leaving it under the arrow
  'hand-edge-swipe': { tags: ['deslizar desde el borde', 'atrás', 'abrir cajón', 'edge swipe', 'back gesture', 'drawer'], d: [line([3.25, 3.25], [3.25, 20.75]), pointer([11.5, 16]), ...arrow([6.25, 4.75], [19.75, 4.75])] },
  // Pull to refresh: the core refresh arrow (three quarters, its head up and to the right) beside the
  // hand, large enough to read as one; 3 clear of the knuckle
  'hand-pull-refresh': {
    tags: ['jalar para actualizar', 'recargar', 'actualizar lista', 'pull to refresh', 'reload', 'refresh'],
    d: (() => {
      const a = arc(17.75, 6, 3.75, -30, 240);
      return [pointer(O_SIDE), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  // A flick: three speed lines behind the fingertip, and no arrow
  'hand-flick': {
    tags: ['lanzar', 'deslizar rápido', 'desplazamiento rápido', 'flick', 'fling', 'fast scroll'],
    d: [pointer([12.25, 16.25]), line([3, 6], [9, 6]), line([3.5, 9], [9.25, 9]), line([3.5, 12], [6, 12])],
  },

  // ── Touch: more fingers ─────────────────────────────────────────────────────────────────────
  'hand-two-finger-tap': {
    tags: ['toque con dos dedos', 'clic secundario', 'trackpad', 'two finger tap', 'secondary click', 'right click'],
    d: (() => {
      const o = [7.75, 16.5];
      return [...fingers(o, [6.75, 7.5]), arc(o[0] + 3, o[1] - 7.1, 6, 200, 340).d];
    })(),
  },
  'hand-two-finger-scroll': { tags: ['desplazar con dos dedos', 'trackpad', 'scroll', 'two finger scroll', 'touchpad'], d: [...fingers([6.75, 16.5], [6.75, 7.5]), ...arrow2([19.25, 2.75], [19.25, 11.5])] },
  'hand-two-finger-swipe': { tags: ['deslizar con dos dedos', 'atrás y adelante', 'trackpad', 'two finger swipe', 'back and forward', 'touchpad'], d: [...fingers([9.25, 17], [6.75, 7.5]), ...arrow2([3, 4.75], [21, 4.75])] },
  'hand-three-finger-swipe': { tags: ['deslizar con tres dedos', 'cambiar de app', 'escritorios', 'three finger swipe', 'switch apps', 'desktops'], d: [...fingers([7.25, 17], [6.75, 7.5, 7]), ...arrow2([2.5, 4.75], [21.5, 4.75])] },
  // Thumb and index apart in a V, the arrows over them
  'hand-pinch': { tags: ['pellizcar', 'alejar', 'reducir', 'pinch', 'zoom out', 'shrink'], d: [vhand(O_V, V_TIP), ...arrow([3.25, 4.75], [9.25, 4.75]), ...arrow([20.75, 4.75], [14.75, 4.75])] },
  'hand-spread': { tags: ['separar los dedos', 'acercar', 'ampliar', 'spread', 'zoom in', 'enlarge'], d: [vhand(O_V, V_TIP), ...arrow([10, 4.75], [3.25, 4.75]), ...arrow([14, 4.75], [20.75, 4.75])] },
  'hand-rotate': {
    tags: ['girar con dos dedos', 'rotar', 'girar imagen', 'rotate', 'two finger rotate', 'turn'],
    d: (() => {
      const a = arc(9.5, 11, 8.25, 215, 320);
      return [vhand(O_V, V_TIP), a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  // ── Hand signs ──────────────────────────────────────────────────────────────────────────────
  'hand-wave': {
    tags: ['saludar', 'hola', 'adiós', 'wave', 'hello', 'goodbye'],
    d: (() => {
      const fs = [{ top: 9.25 }, { top: 7.75 }, { top: 8.5 }, { top: 11.25 }];
      const h = openHand({ x0: 7.5, fingers: fs, side: 16, bottom: 21.25, bx: 13.75, base: [9.75, 18.75], tip: [5.75, 14.75] });
      const c = [13.5, 21.25];
      return [turnPath(h, 16, c), ...seams(7.5, fs, 13.5).map((s) => turnPath(s, 16, c)), arc(13.5, 13.75, 9.5, 212, 246).d, arc(13.5, 13.75, 12.5, 218, 240).d];
    })(),
  },
  // Stop: comunicacion's raised hand itself (moved 0.5 left), pushed out, a short line 3 off each
  // side of its fingers
  'hand-stop': {
    tags: ['alto', 'detener', 'espera', 'stop', 'halt', 'wait'],
    d: [...move(RAISED, -0.5, 0.25), line([3.75, 4.25], [3.75, 8.75]), line([21.75, 6.5], [21.75, 11])],
  },
  // Thumb and index close a ring (as wide as a finger), the other three up
  'hand-ok': {
    tags: ['ok', 'perfecto', 'todo bien', 'okay', 'perfect', 'all good'],
    d: ['M10.25 9.6V5A1.5 1.5 0 0 1 13.25 5V5.75A1.5 1.5 0 0 1 16.25 5.75V8.25A1.5 1.5 0 0 1 19.25 8.25V14.5C19.25 18.1 16.65 20.75 13.5 20.75C11.25 20.75 9.75 19.75 8.75 17.8A4.75 4.75 0 1 1 10.25 9.6Z', circ(7.25, 13.25, 1.75), line([13.25, 5.75], [13.25, 11]), line([16.25, 8.25], [16.25, 11])],
  },
  // Index and middle in a V, the others folded under the thumb
  'hand-peace': {
    tags: ['paz', 'victoria', 'amor y paz', 'peace', 'victory', 'v sign'],
    d: (() => {
      const fin = (b, t) => {
        const u = unit(b, t);
        const n = [u[1], -u[0]];
        return [add(b, n, 1.5), add(t, n, 1.5), add(t, n, -1.5), add(b, n, -1.5)];
      };
      const [a, b] = [fin([9.25, 13], [6.75, 4.25]), fin([12.25, 13], [15.75, 4.25])];
      const out = rp([[6.5, 16], [...meet(a[0], a[1], [6.5, 0], [6.5, 24]), 0.6], [...a[1], 1.5], [...a[2], 1.5], [...meet(a[2], a[3], b[0], b[1]), 0.6], [...b[1], 1.5], [...b[2], 1.5], [...meet(b[2], b[3], [14, 11.25], [18, 11.25]), 0.75], [18, 11.25, 2.5], [18, 21, 4.5], [6.5, 21, 4.5]]);
      return [out, 'M6.5 14.25H13A1.5 1.5 0 0 1 13 17.25H6.5'];
    })(),
  },
  // The fist from the front: four folded fingers side by side, the thumb across them
  'hand-fist': {
    tags: ['puño', 'fuerza', 'poder', 'fist', 'strength', 'power'],
    d: ['M6 17V8.25A1.5 1.5 0 0 1 9 8.25V7.5A1.5 1.5 0 0 1 12 7.5V7.75A1.5 1.5 0 0 1 15 7.75V8.75A1.5 1.5 0 0 1 18 8.75V15.5C18 18.75 15.5 21 12.5 21C9.75 21 7.5 19.5 6 17Z', 'M6 12.25H11.75A1.5 1.5 0 0 1 11.75 15.25H6', line([9, 8.25], [9, 12.25]), line([12, 7.75], [12, 12.27]), line([15, 8.75], [15, 10.85])],
  },
  // I love you in sign language: thumb, index and little finger out, middle and ring folded
  'hand-love-you': {
    tags: ['te quiero', 'lengua de señas', 'te amo', 'i love you', 'sign language', 'ily'],
    d: [openHand({ x0: 7.25, fingers: [{ top: 5 }, { w: 6, top: 12 }, { top: 7 }], side: 14.5, bottom: 20.75, bx: 13.5, base: [9.5, 18.25], tip: [3.5, 11.75] })],
  },
  // Clean hands (or a magic touch): the open hand, three sparkles over its fingers
  'hand-sparkles': {
    tags: ['manos limpias', 'desinfectado', 'magia', 'clean hands', 'sanitized', 'magic touch'],
    d: (() => {
      const fs = [{ top: 10.75 }, { top: 9.25 }, { top: 10 }, { top: 12.75 }];
      return [openHand({ x0: 7.25, fingers: fs, side: 16, bottom: 21.5, bx: 13.5, base: [9.5, 19], tip: [5.25, 15] }), ...seams(7.25, fs, 15), sparkle([4.75, 5.5], 2.5), sparkle([12.25, 3.5], 1.5), sparkle([19.5, 5.5], 2.5)];
    })(),
  },

  // ── Pointing ────────────────────────────────────────────────────────────────────────────────
  'hand-point-up': { tags: ['señalar arriba', 'arriba', 'mira arriba', 'point up', 'above', 'look up'], d: POINT_UP },
  'hand-point-right': { tags: ['señalar a la derecha', 'aquí', 'por aquí', 'point right', 'this way', 'look here'], d: POINT_RIGHT },
  'hand-point-down': { tags: ['señalar abajo', 'debajo', 'ver más abajo', 'point down', 'below', 'scroll for more'], d: POINT_UP.map((d) => turnPath(d, 180)) },
  'hand-point-left': { tags: ['señalar a la izquierda', 'atrás', 'por allá', 'point left', 'previous', 'over there'], d: POINT_RIGHT.map((d) => flipPath(d)) },

  // ── The open hand, palm up ──────────────────────────────────────────────────────────────────
  'hand-give': { tags: ['dar', 'enviar', 'pagar a alguien', 'give', 'send', 'hand out'], d: [...PALM, ...arrow([13.25, 13.5], [13.25, 3])] },
  'hand-receive': { tags: ['recibir', 'cobrar', 'solicitar', 'receive', 'collect', 'get paid'], d: [...PALM, ...arrow([13.25, 3], [13.25, 13.5])] },
  'hand-sprout': {
    tags: ['cuidar el crecimiento', 'sostenibilidad', 'iniciativa verde', 'nurture', 'sustainability', 'growth'],
    d: [...PALM, line([13.25, 16.5], [13.25, 9]), 'M13.25 12.75A4.5 4.5 0 0 1 8 9.5A4.5 4.5 0 0 1 13.25 12.75Z', 'M13.25 9.25A5 5 0 0 1 18.5 5.5A5 5 0 0 1 13.25 9.25Z'],
  },
  'hand-lightbulb': {
    tags: ['compartir una idea', 'sugerencia', 'proponer', 'share idea', 'suggestion', 'propose'],
    d: [...PALM, place('M7.76 12.74A6 6 0 1 1 16.24 12.74C15.39 13.59 14.25 14.4 14.25 15.25H9.75C9.75 14.4 8.61 13.59 7.76 12.74Z', 0.62, [12, 8.5], [13.25, 5.75]), line([12, 12.9], [14.5, 12.9])],
  },
  'hand-gift': {
    tags: ['dar un regalo', 'obsequio', 'beneficios', 'give a gift', 'giveaway', 'perks'],
    d: [...PALM, rp([[8.25, 5.75, 0.75], [16.75, 5.75, 0.75], [16.75, 8, 0.5], [16, 8], [16, 12.25], [9, 12.25, 1.25], [9, 8], [8.25, 8, 0.5]]), line([9, 8], [16, 8]), line([12.5, 5.75], [12.5, 12.25]), loop([12.5, 5.75], [10.5, 3.75], 1.6), loop([12.5, 5.75], [14.5, 3.75], 1.6)],
  },
  'hand-person': { tags: ['cuidar a las personas', 'atención al cliente', 'bienestar', 'care for people', 'caregiving', 'wellbeing'], d: [...PALM, circ(12.5, 3.7, 1.85), arc(12.5, 11.5, 3.5, 180, 360).d] },
  'hand-shield': { tags: ['garantía', 'protección', 'plan de protección', 'warranty', 'guarantee', 'protection plan'], d: [...PALM, place(nucleo.icons.shield.d[0], 0.55, [12, 12], [13.25, 7.5])] },
  'hand-clock': { tags: ['donar tiempo', 'voluntariado', 'horas', 'give time', 'volunteer', 'time donated'], d: [...PALM, circ(13.25, 7.5, 5.25), line([13.25, 5.25], [13.25, 7.5], [15.25, 8.6])] },
  'hand-recycle': {
    tags: ['programa de reciclaje', 'devolución', 'reciclar', 'take back', 'recycling program', 'recycle'],
    d: [
      ...PALM,
      ...[0, 180].flatMap((k) => {
        const a = arc(13.25, 7.75, 4, k, 95 + k);
        return [a.d, head(a.end, a.tangent, 2.4)];
      }),
    ],
  },
  // The phone resting in the open palm, its foot behind the fingers (the hand gripping it from below
  // read as a blob at 24 px): the palm is a custom badge, so the engine clears the phone around it
  'hand-smartphone': {
    tags: ['celular en mano', 'móvil', 'pedir por teléfono', 'phone in hand', 'mobile', 'mobile first'],
    d: [sq(9.25, 2.25, 8, 13.25, 2.25, { square: ['br'] }), line([12.125, 5.25], [14.375, 5.25])],
    badge: { d: PALM, knock: `${PALM[0]}${shut(PALM[1])}`, fill: { solid: [PALM[0], shut(PALM[1])] } },
  },

  // ── Thumbs ──────────────────────────────────────────────────────────────────────────────────
  'thumbs-up-down': { tags: ['calificar', 'me gusta o no', 'fue útil', 'rate', 'feedback', 'was this helpful'], d: [...thumbsUp(4.75, 13, 5.5, 6, 4, 2.5), ...flipY(thumbsUp(15.75, 13, 5.5, 6, 4, 2.5), 12.25)] },
  'thumbs-up-double': {
    tags: ['me encanta', 'muy recomendado', 'excelente', 'two thumbs up', 'love it', 'highly recommended'],
    d: thumbsUp(5.25, 14.25, 9.5, 8, 4.5, 3),
    badge: (() => {
      const [fist, c, seam] = thumbsUp(12.25, 21.25, 9.5, 8, 4.5, 3);
      return { d: [fist, c, seam], knock: `${fist}${shut(c)}`, fill: { solid: [fist, shut(c)], cut: [seam] } };
    })(),
  },

  // ── Two hands ───────────────────────────────────────────────────────────────────────────────
  // Two palms raised side by side, the right one in front, three sparks over them
  'hands-celebrate': {
    tags: ['celebrar', 'hurra', 'festejar', 'celebrate', 'hooray', 'praise'],
    d: (() => {
      const fs = [{ top: 10.5 }, { top: 9.5 }, { top: 10.25 }];
      const h = openHand({ x0: 6.25, fingers: fs, side: 16.5, bottom: 21.25, bx: 11, base: [8, 18.75], tip: [3.75, 14.25] });
      return [h, ...seams(6.25, fs, 14.5), line([12, 2.25], [12, 5]), line([7, 3.25], [8, 5.5]), line([17, 3.25], [16, 5.5])];
    })(),
    badge: (() => {
      const fs = [{ top: 10.25 }, { top: 9.5 }, { top: 10.5 }];
      const h = flipPath(openHand({ x0: 6.25, fingers: fs, side: 16.5, bottom: 21.25, bx: 11, base: [8, 18.75], tip: [3.75, 14.25] }), 'x', 12.25);
      return front(
        h,
        seams(6.25, fs, 14.5).map((d) => flipPath(d, 'x', 12.25)),
      );
    })(),
  },
};

// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// By path index: `solid` filled (closed shapes), `cut` knocked out, `lines` on top with a clearance,
// `wire` on top and attached. A string is a fill-only path (a cuff or an outline closed with Z, a
// shape with its hole wound the other way so it stays paper).
const FILL = {
  'hand-tap': { solid: [0], lines: [1] },
  'hand-double-tap': { solid: [0], lines: [1, 2] },
  'hand-long-press': { solid: [0], lines: [1] },
  'hand-deep-press': { solid: [0], lines: [1, 2, 3] },
  'hand-drag': { solid: [0], lines: [1, 2] },
  'hand-tap-gear': { solid: [0], lines: [1] },
  'hand-tap-lock': { solid: [0], lines: [1] },
  'hand-haptic': { solid: [0], lines: [1, 2] },
  'hand-hover': { solid: [0], lines: [1, 2, 3] },
  'hand-draw': { solid: [0], wire: [1] },
  'hand-swipe-right': { solid: [0], lines: [1, 2] },
  'hand-swipe-left': { solid: [0], lines: [1, 2] },
  'hand-swipe-up': { solid: [0], lines: [1, 2] },
  'hand-swipe-down': { solid: [0], lines: [1, 2] },
  'hand-swipe-horizontal': { solid: [0], lines: [1, 2, 3] },
  'hand-swipe-vertical': { solid: [0], lines: [1, 2, 3] },
  'hand-edge-swipe': { solid: [1], lines: [0, 2, 3] },
  'hand-pull-refresh': { solid: [0], lines: [1, 2] },
  'hand-flick': { solid: [0], lines: [1, 2, 3] },
  'hand-two-finger-tap': { solid: [0], cut: [1], lines: [2] },
  'hand-two-finger-scroll': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'hand-two-finger-swipe': { solid: [0], cut: [1], lines: [2, 3, 4] },
  'hand-three-finger-swipe': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
  'hand-pinch': { solid: [0], lines: [1, 2, 3, 4] },
  'hand-spread': { solid: [0], lines: [1, 2, 3, 4] },
  'hand-rotate': { solid: [0], lines: [1, 2] },
  'hand-wave': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'hand-stop': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'hand-ok': { solid: [`${icons['hand-ok'].d[0]}${icons['hand-ok'].d[1]}`], cut: [2, 3] },
  'hand-peace': { solid: [0], cut: [1] },
  'hand-fist': { solid: [0], cut: [1, 2, 3, 4] },
  'hand-love-you': { solid: [0] },
  'hand-sparkles': { solid: [0, 4, 5, 6], cut: [1, 2, 3] },
  'hand-point-up': { solid: [0, shut(POINT_UP[1])], cut: [2] },
  'hand-point-right': { solid: [0, shut(POINT_RIGHT[1])], cut: [2] },
  'hand-point-down': { solid: [0, shut(icons['hand-point-down'].d[1])], cut: [2] },
  'hand-point-left': { solid: [0, shut(icons['hand-point-left'].d[1])], cut: [2] },
  'hand-give': { solid: [0, shut(PALM[1])], lines: [2, 3] },
  'hand-receive': { solid: [0, shut(PALM[1])], lines: [2, 3] },
  'hand-sprout': { solid: [0, shut(PALM[1]), 3, 4], wire: [2] },
  'hand-lightbulb': { solid: [0, shut(PALM[1]), 2], lines: [3] },
  // The gift: its ribbon stops short of the edges in the fill, so the box stays one piece at every weight
  'hand-gift': { solid: [0, shut(PALM[1]), 2, 5, 6], cut: [line([12.5, 7], [12.5, 11])] },
  'hand-person': { solid: [0, shut(PALM[1]), 2, shut(icons['hand-person'].d[3])] },
  'hand-shield': { solid: [0, shut(PALM[1]), 2] },
  'hand-clock': { solid: [0, shut(PALM[1]), 2], cut: [3] },
  'hand-recycle': { solid: [0, shut(PALM[1])], lines: [2, 3, 4, 5] },
  'hand-smartphone': { solid: [0], cut: [1] },
  'thumbs-up-down': { solid: [0, shut(icons['thumbs-up-down'].d[1]), 3, shut(icons['thumbs-up-down'].d[4])], cut: [2, 5] },
  'thumbs-up-double': { solid: [0, shut(icons['thumbs-up-double'].d[1])], cut: [2] },
  'hands-celebrate': { solid: [0], cut: [1, 2], lines: [3, 4, 5] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? icons[name].d[i] : i));
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, pick(v)]));
}

// ── Parts ─────────────────────────────────────────────────────────────────────────────────────
const PARTS = {
  'hand-tap': { hand: [0], ripple: [1] },
  'hand-double-tap': { hand: [0], ripple: [1, 2] },
  'hand-long-press': { hand: [0], ripple: [1] },
  'hand-deep-press': { hand: [0], rays: [1, 2, 3] },
  'hand-drag': { card: [0], trail: [1, 2] },
  'hand-tap-gear': { hand: [0], ripple: [1] },
  'hand-tap-lock': { hand: [0], ripple: [1] },
  'hand-haptic': { hand: [0], wave: [1, 2] },
  'hand-hover': { hand: [0], ripple: [1, 2, 3] },
  'hand-draw': { hand: [0], trace: [1] },
  'hand-swipe-right': { hand: [0], arrow: [1, 2] },
  'hand-swipe-left': { hand: [0], arrow: [1, 2] },
  'hand-swipe-up': { hand: [0], arrow: [1, 2] },
  'hand-swipe-down': { hand: [0], arrow: [1, 2] },
  'hand-swipe-horizontal': { hand: [0], arrow: [1, 2, 3] },
  'hand-swipe-vertical': { hand: [0], arrow: [1, 2, 3] },
  'hand-edge-swipe': { edge: [0], hand: [1], arrow: [2, 3] },
  'hand-pull-refresh': { hand: [0], arrow: [1, 2] },
  'hand-flick': { hand: [0], trail: [1, 2, 3] },
  'hand-two-finger-tap': { hand: [0], fingers: [1], ripple: [2] },
  'hand-two-finger-scroll': { hand: [0], fingers: [1], arrow: [2, 3, 4] },
  'hand-two-finger-swipe': { hand: [0], fingers: [1], arrow: [2, 3, 4] },
  'hand-three-finger-swipe': { hand: [0], fingers: [1, 2], arrow: [3, 4, 5] },
  'hand-pinch': { hand: [0], arrow: [1, 2, 3, 4] },
  'hand-spread': { hand: [0], arrow: [1, 2, 3, 4] },
  'hand-rotate': { hand: [0], arrow: [1, 2] },
  'hand-wave': { hand: [0, 1, 2, 3], wave: [4, 5] },
  'hand-stop': { hand: [0, 1, 2, 3], mark: [4, 5] },
  'hand-ok': { hand: [0, 1], fingers: [2, 3] },
  'hand-peace': { hand: [0], thumb: [1] },
  'hand-fist': { hand: [0], thumb: [1], fingers: [2, 3, 4] },
  'hand-sparkles': { hand: [0, 1, 2, 3], sparkles: [4, 5, 6] },
  'hand-point-up': { hand: [0], cuff: [1, 2] },
  'hand-point-right': { hand: [0], cuff: [1, 2] },
  'hand-point-down': { hand: [0], cuff: [1, 2] },
  'hand-point-left': { hand: [0], cuff: [1, 2] },
  'hand-give': { cuff: [0], hand: [1], arrow: [2, 3] },
  'hand-receive': { cuff: [0], hand: [1], arrow: [2, 3] },
  'hand-sprout': { cuff: [0], hand: [1], sprout: [2, 3, 4] },
  'hand-lightbulb': { cuff: [0], hand: [1], bulb: [2, 3] },
  'hand-gift': { cuff: [0], hand: [1], gift: [2, 3, 4, 5, 6] },
  'hand-person': { cuff: [0], hand: [1], person: [2, 3] },
  'hand-shield': { cuff: [0], hand: [1], shield: [2] },
  'hand-clock': { cuff: [0], hand: [1], face: [2], hands: [3] },
  'hand-recycle': { cuff: [0], hand: [1], arrows: [2, 3, 4, 5] },
  'hand-smartphone': { phone: [0, 1] },
  'thumbs-up-down': { up: [0, 1, 2], down: [3, 4, 5] },
  'thumbs-up-double': { hand: [0], cuff: [1, 2] },
  'hands-celebrate': { hand: [0, 1, 2], sparks: [3, 4, 5] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
// The touch hands tap upward (like hand-pointer); swipes slide their hand along the arrow; the wave
// rocks from the wrist; spinners spin about their center.
const MOTION = {
  'hand-tap': { effect: 'bounce', parts: ['hand'], vector: [0, -1.5] },
  'hand-double-tap': { effect: 'bounce', parts: ['hand'], vector: [0, -1.5] },
  'hand-long-press': { effect: 'bounce', parts: ['hand'], vector: [0, -1] },
  'hand-deep-press': { effect: 'bounce', parts: ['hand'], vector: [0, -1] },
  'hand-drag': { effect: 'slide', parts: ['badge'], vector: [2, 0] },
  'hand-tap-gear': { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] },
  'hand-haptic': { effect: 'wiggle', origin: [12, 21.75] },
  'hand-hover': { effect: 'float', parts: ['hand'], vector: [0, -1.5] },
  'hand-swipe-right': { effect: 'slide', parts: ['hand'], vector: [2.5, 0] },
  'hand-swipe-left': { effect: 'slide', parts: ['hand'], vector: [-2.5, 0] },
  'hand-swipe-up': { effect: 'slide', parts: ['hand'], vector: [0, -2] },
  'hand-swipe-down': { effect: 'slide', parts: ['hand'], vector: [0, 2] },
  'hand-edge-swipe': { effect: 'slide', parts: ['hand'], vector: [2.5, 0] },
  'hand-pull-refresh': { effect: 'spin', parts: ['arrow'], origin: [17.25, 7.25] },
  'hand-flick': { effect: 'slide', vector: [2.5, 0] },
  'hand-two-finger-tap': { effect: 'bounce', parts: ['hand', 'fingers'], vector: [0, -1.5] },
  'hand-pinch': { effect: 'beat', parts: ['arrow'], origin: [12, 4.75] },
  'hand-spread': { effect: 'beat', parts: ['arrow'], origin: [12, 4.75] },
  'hand-rotate': { effect: 'spin', parts: ['arrow'], origin: [9.5, 11] },
  'hand-wave': { effect: 'wiggle', parts: ['hand'], origin: [13.5, 21.25] },
  'hand-stop': { effect: 'beat', origin: [12, 13] },
  'hand-fist': { effect: 'beat', origin: [12, 14] },
  'hand-peace': { effect: 'wiggle', origin: [12, 21] },
  'hand-sparkles': { effect: 'beat', parts: ['sparkles'], origin: [12, 5] },
  'hand-point-up': { effect: 'slide', vector: [0, -2] },
  'hand-point-right': { effect: 'slide', vector: [2, 0] },
  'hand-point-down': { effect: 'slide', vector: [0, 2] },
  'hand-point-left': { effect: 'slide', vector: [-2, 0] },
  'hand-give': { effect: 'slide', parts: ['arrow'], vector: [0, -2] },
  'hand-receive': { effect: 'slide', parts: ['arrow'], vector: [0, 2] },
  'hand-sprout': { effect: 'bounce', parts: ['sprout'], vector: [0, -1.5] },
  'hand-lightbulb': { effect: 'beat', parts: ['bulb'], origin: [13.25, 7.5] },
  'hand-gift': { effect: 'bounce', parts: ['gift'], vector: [0, -1.5] },
  'hand-person': { effect: 'bounce', parts: ['person'], vector: [0, -1] },
  'hand-shield': { effect: 'beat', parts: ['shield'], origin: [13.25, 7.5] },
  'hand-clock': { effect: 'spin', parts: ['hands'], origin: [13.25, 7.5] },
  'hand-recycle': { effect: 'spin', parts: ['arrows'], origin: [13.25, 7.75] },
  'thumbs-up-double': { effect: 'bounce', vector: [0, -2] },
  'hands-celebrate': { effect: 'bounce', vector: [0, -1.5] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Mirror ────────────────────────────────────────────────────────────────────────────────────
// What moves or points to one side flips in right-to-left languages
for (const name of ['hand-swipe-right', 'hand-swipe-left', 'hand-edge-swipe', 'hand-drag', 'hand-flick', 'hand-point-right', 'hand-point-left']) icons[name].mirror = true;

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────
// The wave tilted smudges at 16 px: upright on the pixel grid (as hand-raised reads there), its two
// motion marks as short strokes off its upper left
{
  const fs = [{ top: 9.75 }, { top: 8.25 }, { top: 8.25 }, { top: 11.25 }];
  const hand = openHand({ x0: 8.25, fingers: fs, side: 16.5, bottom: 21, bx: 15, base: [10.5, 19], tip: [6.75, 15] });
  const marks = [line([3, 7.5], [5.25, 9.75]), line([5.25, 3.75], [7.5, 6])];
  const lines = seams(8.25, fs, 13.5);
  const sn = snapper([hand, ...lines, ...marks]);
  const d = [hand, ...lines, ...marks].map(sn);
  icons['hand-wave'].small = { d, fill: { solid: [d[0]], cut: d.slice(1, 4), lines: d.slice(4) } };
}
// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// A slash would cut a badge or a second hand in front: no slashed variant
for (const name of ['hand-long-press', 'hand-tap-gear', 'hand-tap-lock', 'hand-drag', 'hand-smartphone', 'thumbs-up-double', 'hands-celebrate'])
  icons[name].variants = { slash: false };

export default { category: 'gestos', label: 'Manos y gestos', icons };
