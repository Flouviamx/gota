// Seguridad y emergencias (safety and emergencies): protective equipment, the GHS hazard
// pictograms and the hazard signs, fire safety, evacuation and the emergency equipment. Drawn with
// the engine (engine/geometry.mjs) and the rules in DESIGN.md:
// - the hard hat, the traffic cone and the barrier are sistema's (adopted): hard-hat-* builds on
//   sistema's hard hat;
// - protective equipment says what protects (the toe cap, the reflective bands, the filters), never
//   ropa's garment again;
// - the GHS pictograms are the pictogram alone, never their red diamond, each on one base line;
// - the hazard signs are nucleo's alert triangle with their glyph in place of the exclamation;
// - every flame is vehiculos' car-fire flame, two tongues over a round base: lugares' flame without
//   its inner drop (which closes up at these sizes) reads as a drop of water, beside ropa's
//   fabric-waterproof and hogar's roof-leak above all;
// - the figures are personas' (the head of r 1.9 standing 2.35 clear of the shoulders, one stroke
//   for the torso and one per limb), the doorway personas' and senales', the house lugares', the
//   phone and the document nucleo's and the skull anatomia's;
// - badges and pieces in front of another are the engine's (`badge`, a custom badge's knock).
// Dropped from the approved list: respirator and dust-mask (the half mask between its two filters read
// as a face or an owl, and the molded cup with its valve as an eye, a fish or a bug, in every view
// tried; gas-mask carries the breathing protection), safety-harness (the straps alone read as a robot
// or a rocket), hazard-laser, hazard-hot-surface and hazard-falling-objects (inside nucleo's triangle a
// glyph keeps 2.85 from the edges only in a 5 by 7 space: a burst and its ray, three heat waves or a
// falling block shrink there to under 8 wide and clog at 18 px), emergency-broadcast (nucleo's alert
// keeps its exclamation only at full size, scaled down its stem and point run together at heavy
// weights, and at full size there is no room for the arcs) and defibrillator-search (the magnifier's
// clearance reaches the middle of the heart, where its bolt is, and the heart broke into scraps that
// changed with the weight). Dropped in review: carbon-monoxide-alarm (with no
// letters it is a box with slots and a button, comunicacion's intercom over again, and nothing in it
// says carbon monoxide), emergency-light (the two spot heads on the box read as a crab's eyes or a
// frog's, on top of it, at its sides or under it) and sandbags (three sacks read as an org chart
// apart, as an armchair or a stack of buns together, and as pillows when pinched).
import { arc, badge, circ, dot, f, flipPath, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import accesibilidad from './accesibilidad.mjs';
import anatomia from './anatomia.mjs';
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
const rad = (d) => (d * Math.PI) / 180;
/** The point `l` from `p` at `deg` degrees (0 = right, 90 = down). */
const go = (p, deg, l) => [p[0] + l * Math.cos(rad(deg)), p[1] + l * Math.sin(rad(deg))];
const BR = { square: ['br'] };
const hl = (y, x0, x1) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Moves a path. */
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Scales a path by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Open polyline with rounded interior vertices (one radius per vertex, or one for all): lugares' roundline. */
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
/** A closed polygon symmetric about x = 12 from its right half, top to bottom (ropa's sympoly). */
function sympoly(half, radii) {
  const back = half.map((p, i) => [p, radii[i]]).filter(([p]) => p[0] !== 12).reverse();
  return roundpoly([...half, ...back.map(([[x, y]]) => [24 - x, y])], [...radii, ...back.map(([, r]) => r)]);
}
/** The area a piece clears: closed shapes whole, open strokes one segment at a time (personas'). */
const knockOf = (closed, polylines = []) => [...closed, ...polylines.flatMap((pts) => pts.slice(1).map((p, i) => line(pts[i], p)))].join('');
/** A custom badge: the piece in front, the area it clears and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/**
 * A 16 px drawing: fewer pieces, snapped to the pixel grid together as the engine snaps (`fill` by
 * index into them; `badge`, a custom piece, snapped with them).
 */
function small16(d, fill, badge) {
  const sn = snapper([...d, ...(badge ? [...badge.d, badge.knock] : [])]);
  const s = d.map(sn);
  const pick = (ix) => ix.map((i) => (typeof i === 'number' ? s[i] : sn(i)));
  const out = { d: s, fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, pick(v)])) };
  if (badge) out.badge = { d: badge.d.map(sn), knock: sn(badge.knock), ...(badge.fill && { fill: Object.fromEntries(Object.entries(badge.fill).map(([k, v]) => [k, v.map(sn)])) }) };
  return out;
}

/** vehiculos' car-fire flame: two tongues over a round base (r 3.125), drawn once. */
const FIRE = 'M15.5 8.75C15.5 6.25 17.25 4.75 17.5 1.75C18.75 3 19.5 4.5 19.5 5.75C20 5.25 20.5 4.5 20.75 3.75C21.5 5.25 21.75 6.75 21.75 8.75A3.125 3.125 0 0 1 15.5 8.75Z';
/** The flame standing with the bottom of its base at `bottom`, `h` tall (0.62 h wide). */
const fire = (bottom, h) => place(FIRE, h / 10.125, [18.625, 11.875], bottom);
/** A drop with its tip up: lugares' droplet, the circle of radius r at c and its tip r√2 above. */
const dropUp = ([cx, cy], r) => `M${pt(polar(cx, cy, r, -45))}A${f(r)} ${f(r)} 0 1 1 ${pt(polar(cx, cy, r, 225))}L${pt([cx, cy - r * Math.SQRT2])}Z`;
/** A star of n points between radii ro and ri, the first point at `deg`, its corners rounded. */
const star = (c, n, ro, ri, deg = -90, r = 0.35) => roundpoly(Array.from({ length: 2 * n }, (_, i) => polar(...c, i % 2 ? ri : ro, deg + (i * 180) / n)), r);

// ── The whole figure (personas') ──────────────────────────────────────────────────────────────
// personas' construction as fitness poses it: the head a circle of r 1.9 standing 2.35 clear of the
// shoulders, the torso one stroke from the shoulders to the hips (5.5), each limb one stroke rounded
// at its joint (thigh and shin about 4, upper arm 3.5, forearm 3).
const HR = 1.9;
const GAP = 2.35;
/** A limb from `start` as [length, degrees] segments: its joints, start included. */
const chain = (start, segs, k = 1) => segs.reduce((pts, [l, a]) => [...pts, go(pts[pts.length - 1], a, l * k)], [start]);
/** A figure from its joints: [head, torso, ...legs, ...arms]; the limbs meet the torso unrounded. */
function figure({ H, hr = HR, S, P, legs, arms }) {
  const sharp = (pts, at) => rl(pts, pts.map((p) => (p[0] === at[0] && p[1] === at[1] ? 0 : 0.6)));
  return [circ(...H, hr), line(S, P), ...legs.map((l) => sharp(l, P)), ...arms.map((a) => sharp(a, S))];
}
/** A pose from the hip: the torso's [length, degrees], the head's direction, and each limb's segments. */
function pose({ P, torso, head: ha = torso[1], legs = [], arms = [], k = 1 }) {
  const S = go(P, torso[1], torso[0] * k);
  return { P, S, H: go(S, ha, HR * k + GAP), hr: HR * k, legs: legs.map((l) => chain(P, l, k)), arms: arms.map((a) => chain(S, a, k)) };
}
/** Fill and parts of a figure at the start of `d`: the head filled, the limbs lines attached to it. */
const figWire = (n, at = 0) => Array.from({ length: n - 1 }, (_, i) => at + i + 1);
const figParts = (nLegs, nArms, at = 0) => ({
  head: [at],
  body: [at + 1],
  legs: Array.from({ length: nLegs }, (_, i) => at + 2 + i),
  arms: Array.from({ length: nArms }, (_, i) => at + 2 + nLegs + i),
});

const icons = {};
/** Fill specs and named parts collected as the icons are drawn (by index of `d`, or a path). */
const FILL = {};
const PARTS = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Eyes and face ─────────────────────────────────────────────────────────────────────────────
// Safety glasses: one wraparound lens across the face (no bridge between two lenses, the nose notch
// in its lower edge) and the side shields folding back from its ends
{
  const lens = 'M6.75 8.75H17.25A1.5 1.5 0 0 1 18.75 10.25V11.5C18.75 13.75 17.25 15.25 15.25 15.25C13.9 15.25 13 14.25 12 12.75C11 14.25 10.1 15.25 8.75 15.25C6.75 15.25 5.25 13.75 5.25 11.5V10.25A1.5 1.5 0 0 1 6.75 8.75Z';
  const shield = rl([[5.25, 9.75], [2.75, 10.5], [2.75, 13.25], [5.6, 13.9]], [0, 0.75, 0.75, 0]);
  add('safety-glasses', ['gafas de seguridad', 'lentes de protección', 'protección ocular', 'safety glasses', 'eye protection', 'protective eyewear'], [lens, shield, flipPath(shield)]);
  FILL['safety-glasses'] = { solid: [0], wire: [1, 2] };
  PARTS['safety-glasses'] = { lens: [0], shields: [1, 2] };
}
// Safety goggles: one sealed frame, the nose notch in its lower edge, a row of vents along its top
// and the strap leaving both sides. The vents are a dense row of small dots (three full dots read as
// an ellipsis, a chat's typing mark)
{
  const frame = 'M8.25 6.25H15.75A3.5 3.5 0 0 1 19.25 9.75V14.25A3.5 3.5 0 0 1 15.75 17.75C14 17.75 13.5 14.75 12 14.75C10.5 14.75 10 17.75 8.25 17.75A3.5 3.5 0 0 1 4.75 14.25V9.75A3.5 3.5 0 0 1 8.25 6.25Z';
  const vents = [9, 10.5, 12, 13.5, 15].map((x) => dot(x, 9.25, 0.3));
  add('safety-goggles', ['goggles de seguridad', 'gafas selladas', 'laboratorio', 'safety goggles', 'splash goggles', 'chemical goggles'], [frame, ...vents, hl(12, 2.25, 4.75), hl(12, 19.25, 21.75)]);
  FILL['safety-goggles'] = { solid: [0], cut: [1, 2, 3, 4, 5], wire: [6, 7] };
  PARTS['safety-goggles'] = { frame: [0], vents: [1, 2, 3, 4, 5], strap: [6, 7] };
  // At 16 px the vents run into the frame: the frame and its strap
  icons['safety-goggles'].small = small16([frame, hl(12, 2.25, 4.75), hl(12, 19.25, 21.75)], { solid: [0], wire: [1, 2] });
}
// Face shield: anatomia's head in profile, the brow guard on its forehead and the tall curved visor
// hanging from it in front of the face
{
  const headSide = place(anatomia.icons['head-side'].d[0], 0.8, [4.1, 21.75], [2.75, 21.75]);
  const guard = sq(12.5, 5.5, 6.5, 3, 1.25);
  const visor = 'M17.75 8.25C19.75 10.5 20.75 13.25 20.75 16.25C20.75 18 20.25 19.75 19.25 21.25';
  add('face-shield', ['careta', 'protector facial', 'esmerilado', 'salpicaduras', 'face shield', 'visor', 'face protection'], [headSide, visor], { badge: own([guard], guard, { solid: [guard] }) });
  FILL['face-shield'] = { solid: [shut(headSide)], wire: [1] };
  PARTS['face-shield'] = { head: [0], visor: [1] };
}
// Welding mask: the shell over the whole face down to its chin, the dark viewing window and the
// pivot knobs at its sides
{
  const shell = 'M12 2.75C16.75 2.75 19.25 5.75 19.25 9.75V12.5C19.25 15.25 17.5 18 15.25 20.25C14.25 21.25 9.75 21.25 8.75 20.25C6.5 18 4.75 15.25 4.75 12.5V9.75C4.75 5.75 7.25 2.75 12 2.75Z';
  const knobs = [arc(4.75, 12, 1.75, 90, 270).d, arc(19.25, 12, 1.75, -90, 90).d];
  add('welding-mask', ['careta de soldar', 'soldadura', 'trabajo en caliente', 'welding mask', 'welding helmet', 'hot work'], [shell, sq(7.75, 8, 8.5, 3.75, 1.25), ...knobs]);
  FILL['welding-mask'] = { solid: [0, shut(knobs[0]), shut(knobs[1])], cut: [1] };
  PARTS['welding-mask'] = { shell: [0], window: [1], knobs: [2, 3] };
}

// ── Breathing ─────────────────────────────────────────────────────────────────────────────────
// Gas mask: the full face, two round eyepieces and one canister under the chin (in front of it)
{
  const face = 'M12 2.75C16.75 2.75 20.25 6 20.25 10.25C20.25 14.25 17.25 17.25 12 17.25S3.75 14.25 3.75 10.25C3.75 6 7.25 2.75 12 2.75Z';
  const can = circ(12, 18, 3.25);
  add('gas-mask', ['máscara antigás', 'gas tóxico', 'emergencia química', 'gas mask', 'toxic gas', 'hazmat'], [face, circ(8.5, 9.25, 2), circ(15.5, 9.25, 2)], { badge: own([can, dot(12, 18)], can, { solid: [can], cut: [dot(12, 18)] }) });
  FILL['gas-mask'] = { solid: [0], cut: [1, 2] };
  PARTS['gas-mask'] = { face: [0], eyepieces: [1, 2] };
  // At 16 px the canister's dot clogs: the canister plain
  icons['gas-mask'].small = small16([face, circ(8.5, 9.25, 2), circ(15.5, 9.25, 2)], { solid: [0], cut: [1, 2] }, own([can], can, { solid: [can] }));
}
// ── Hands, body and feet ──────────────────────────────────────────────────────────────────────
// Safety glove: a gauntlet, four fingers parted by slits, a reinforced band across the knuckles from
// the thumb's crotch and the long flared cuff
{
  const hand = roundpoly(
    [[6.5, 13.75], [3.5, 10.75], [4.75, 9], [6.5, 10], [6.5, 4.75], [9.5, 4.75], [9.5, 3.25], [12.5, 3.25], [12.5, 4.25], [15.5, 4.25], [15.5, 5], [18.5, 5], [18.5, 13.75]],
    [0, 1.25, 1.25, 0, 1.25, 0, 1.25, 1.25, 0, 0.6, 0, 1.25, 0],
  );
  const cuff = roundpoly([[6, 13.75], [19, 13.75], [20.75, 21.25], [4.25, 21.25]], [0.75, 0.75, 1.25, 1.25]);
  const slits = [vl(9.5, 4.75, 7), vl(12.5, 4.25, 7), vl(15.5, 5, 7)];
  add('safety-glove', ['guante de seguridad', 'protección de manos', 'guante anticorte', 'safety glove', 'work glove', 'hand protection'], [hand, cuff, ...slits, hl(10, 6.5, 18.5)]);
  // Filled, the band cuts on past the glove's side so it parts the same at every weight
  FILL['safety-glove'] = { solid: [0, 1], cut: [...slits.map((_, i) => i + 2), hl(10, 6.5, 19.75)] };
  PARTS['safety-glove'] = { glove: [0, 2, 3, 4], cuff: [1], band: [5] };
}
// High-visibility vest: open down the front, two reflective bands round the body, and the narrow
// shoulder straps, the bands over the shoulders, running down to them
{
  const body = sympoly([[12, 11.25], [14, 3.25], [17, 3.25], [17.25, 7.25], [19.5, 10], [19.5, 20.75]], [0.4, 0.75, 0.75, 2.5, 1.25, 1.25]);
  const bands = [hl(14, 4.5, 19.5), hl(17.5, 4.5, 19.5)];
  add('safety-vest', ['chaleco reflejante', 'alta visibilidad', 'chaleco de seguridad', 'hi-vis vest', 'high visibility', 'safety vest'], [body, vl(12, 11.25, 20.75), ...bands]);
  FILL['safety-vest'] = { solid: [0], cut: [vl(12, 11.25, 22), hl(14, 3, 21), hl(17.5, 3, 21)] };
  PARTS['safety-vest'] = { vest: [0, 1], bands: [2, 3] };
}
// Safety boot: a work boot in profile, the steel toe cap its own arc over the toe and a thick
// cleated sole
{
  const upper = rl([[4.5, 16.5], [4.5, 3], [11.25, 3], [11.25, 9.25], [16.5, 10.5], [20.25, 12.75], [21.25, 16.5]], [0, 1, 1, 2.5, 2.5, 2.5, 0]);
  const sole = roundpoly([[3.75, 16.5], [21.5, 16.5], [21.5, 21.25], [17.5, 21.25], [17.5, 20], [14.5, 20], [14.5, 21.25], [9, 21.25], [9, 20], [6, 20], [6, 21.25], [3.75, 21.25]], [0.75, 0.75, 0.75, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.75]);
  add('safety-boot', ['bota de seguridad', 'casquillo', 'protección de pies', 'safety boot', 'steel toe', 'foot protection'], [upper, sole, 'M15 10.25C17.5 11 18.5 13.5 18.25 16.5']);
  FILL['safety-boot'] = { solid: [shut(upper), 1], cut: [2] };
  PARTS['safety-boot'] = { boot: [0], sole: [1], cap: [2] };
}

// ── Heads ─────────────────────────────────────────────────────────────────────────────────────
// Hard hat with a headlamp: sistema's dome and brim, the lamp mounted on the front of the dome where
// the ridges were, resting on the brim. On the crown, with rays, the lamp made the hat a siren
// (sistema's); inside the dome there is no room for rays clear of it
{
  const H = sistema.icons['hard-hat'].d;
  add('hard-hat-lamp', ['casco con lámpara', 'minería', 'túnel', 'trabajo subterráneo', 'hard hat lamp', 'mining helmet', 'headlamp'], [H[0], H[1], circ(12, 12, 2.5)]);
  FILL['hard-hat-lamp'] = { solid: [shut(H[0]), 1], cut: [2] };
  PARTS['hard-hat-lamp'] = { dome: [0], brim: [1], lamp: [2] };
}
// PPE compliant: sistema's hard hat with the check
{
  const H = sistema.icons['hard-hat'].d;
  add('hard-hat-check', ['epp completo', 'inducción aprobada', 'acceso a obra', 'ppe compliant', 'site induction', 'cleared for site'], H, { badge: badge('check') });
  FILL['hard-hat-check'] = { solid: [shut(H[0]), 1], cut: [2, 3] };
  PARTS['hard-hat-check'] = { dome: [0], brim: [1], ridges: [2, 3] };
}

// ── Hazard pictograms (GHS) ───────────────────────────────────────────────────────────────────
// The pictogram alone, without its red diamond, each standing on one base line
const BASE = (y = 21.25) => hl(y, 3.25, 20.75);
// Flammable: the flame over the base line, the GHS flame (the oxidizer's)
const GHS_FLAME = fire([12, 18.25], 15.5);
{
  add('flammable', ['inflamable', 'líquido inflamable', 'peligro de fuego', 'ghs', 'flammable', 'flammable liquid', 'fire hazard'], [GHS_FLAME, BASE()]);
  FILL.flammable = { solid: [0], wire: [1] };
  PARTS.flammable = { flame: [0], base: [1] };
}
// Oxidizer: the same flame rising out of a ring (in front of its base), over the base line
{
  const ring = circ(12, 14.75, 3.5);
  add('oxidizer', ['comburente', 'oxidante', 'peróxidos', 'ghs', 'oxidizer', 'oxidizing', 'peroxide'], [GHS_FLAME, BASE()], { badge: own([ring], ring, { solid: [ring] }) });
  FILL.oxidizer = { solid: [0], wire: [1] };
  PARTS.oxidizer = { flame: [0], base: [1] };
}
// Explosive: a jagged burst of nine uneven spikes low and to one side, its fragments flying up and
// away from it, over the base line (the GHS bomb's burst without the bomb). A round, even burst in
// the middle read as a sun, a gear or a flower, with the base line under it as a sunrise, and six
// spikes as a star
// The burst stands 2.85 over the base line and each fragment 3.4 clear of the spikes beside it
const BLAST = [10, 13];
{
  const R = [6, 5, 6, 4.75, 6, 4.75, 6, 4.5, 6.25];
  const pts = R.flatMap((r, i) => [polar(...BLAST, r, -100 + i * 40), polar(...BLAST, 3.1, -80 + i * 40)]);
  const burst = roundpoly(pts, pts.map((_, i) => (i % 2 ? 0.45 : 0.3)));
  // The fragments are streaks along their flight: a shard drawn as a closed shape that small had its
  // inside close up from regular on
  const streak = (deg) => line(polar(...BLAST, 8.75, deg), polar(...BLAST, 11, deg));
  add('explosive', ['explosivo', 'explosión', 'voladura', 'ghs', 'explosive', 'explosion', 'blasting'], [burst, streak(-80), streak(-40), BASE()]);
  FILL.explosive = { solid: [0], lines: [1, 2], wire: [3] };
  PARTS.explosive = { burst: [0], fragments: [1, 2], base: [3] };
}
// Corrosive: two drops falling from a tilted tube onto a bar whose top edge they have eaten into
{
  const at = (x, y) => add2([3.5, 5], rot([x, y], [0, 0], 25));
  const tube = `M${pt(at(8.75, -1.75))}L${pt(at(1.75, -1.75))}A1.75 1.75 0 0 0 ${pt(at(1.75, 1.75))}L${pt(at(8.75, 1.75))}`;
  const bar = `M3.25 17.75H11.75A1.75 1.75 0 0 0 14.75 17.75H15.25A1.75 1.75 0 0 0 18.25 17.75H20.75V21.25H3.25Z`;
  add('corrosive', ['corrosivo', 'ácido', 'quemadura química', 'ghs', 'corrosive', 'acid', 'chemical burn'], [tube, dropUp([13.25, 13.75], 1.2), dropUp([17.25, 10.5], 1.2), bar]);
  FILL.corrosive = { solid: [shut(tube), 1, 2, 3] };
  PARTS.corrosive = { tube: [0], drops: [1, 2], bar: [3] };
  // At 16 px: one larger drop over one bite
  const bar16 = 'M3.25 17.75H12A1.75 1.75 0 0 0 15.5 17.75H20.75V21.25H3.25Z';
  icons.corrosive.small = small16([tube, dropUp([13.75, 13.25], 1.5), bar16], { solid: [shut(tube), 1, 2] });
}
// Skull and crossbones: anatomia's skull in front of two crossed bones below it; at this size its
// eye sockets are dots and its teeth are left out (their gaps closed up at heavy weights)
{
  const at = (x, y) => [12 + (x - 12) * 0.64, 2 + (y - 2.6) * 0.64];
  const S = anatomia.icons.skull.d.map((d) => place(d, 0.64, [12, 2.6], [12, 2]));
  const eyes = [dot(...at(8.6, 9.75), 1), dot(...at(15.4, 9.75), 1)];
  const skull = [S[0], ...eyes, S[3]];
  const bone = (a, b) => {
    const u = unit(sub(b, a));
    const n = [-u[1], u[0]];
    const knobs = (p) => [dot(...add2(p, mul(n, 0.95))), dot(...add2(p, mul(n, -0.95)))];
    return [line(a, b), ...knobs(a), ...knobs(b)];
  };
  // The bones' ends lie 3 apart, so the knobs at each side run together at every weight
  const bones = [...bone([4.25, 16.25], [19.75, 19.25]), ...bone([19.75, 16.25], [4.25, 19.25])];
  add('skull-crossbones', ['calavera', 'tóxico', 'veneno', 'toxicidad aguda', 'ghs', 'skull and crossbones', 'poison', 'toxic'], bones, { badge: own(skull, S[0], { solid: [S[0]], cut: [...eyes, S[3]] }) });
  FILL['skull-crossbones'] = { solid: [1, 2, 3, 4, 6, 7, 8, 9], wire: [0, 5] };
  PARTS['skull-crossbones'] = { bones: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] };
  // At 16 px the nose clogs between the eyes: the cranium and its eyes
  icons['skull-crossbones'].small = small16(bones, { solid: [1, 2, 3, 4, 6, 7, 8, 9], wire: [0, 5] }, own([S[0], ...eyes], S[0], { solid: [S[0]], cut: eyes }));
}
// Health hazard: a head-and-shoulders bust with a four-point starburst on its chest
{
  const body = 'M5 21.25H19A1.75 1.75 0 0 0 20.72 19.2C19.75 14 16.25 10.75 12 10.75S4.25 14 3.28 19.2A1.75 1.75 0 0 0 5 21.25Z';
  add('health-hazard', ['peligro para la salud', 'cancerígeno', 'sensibilizante', 'ghs', 'health hazard', 'carcinogen', 'organ toxicity'], [circ(12, 5.5, 2.75), body, star([12, 16.25], 4, 2.9, 1.6, -45, 0.3)]);
  FILL['health-hazard'] = { solid: [0, 1], cut: [2] };
  PARTS['health-hazard'] = { head: [0], body: [1], burst: [2] };
  // At 16 px the burst is a dot
  icons['health-hazard'].small = small16([circ(12, 5.5, 2.75), body, dot(12, 16.25, 1)], { solid: [0, 1], cut: [2] });
}
// Radioactive: the trefoil, a center dot and three blades at 120°
{
  const blade = (a) => `M${pt(polar(12, 12, 4, a - 30))}${arc(12, 12, 4, a - 30, a + 30).d.replace(/^M[^A]*/, '')}L${pt(polar(12, 12, 9, a + 30))}${arc(12, 12, 9, a + 30, a - 30).d.replace(/^M[^A]*/, '')}Z`;
  add('radioactive', ['radiactivo', 'radiación', 'rayos x', 'nuclear', 'radioactive', 'radiation', 'trefoil'], [dot(12, 12, 1), blade(-150), blade(-30), blade(90)]);
  FILL.radioactive = { solid: [0, 1, 2, 3] };
  PARTS.radioactive = { center: [0], blades: [1, 2, 3] };
}
// Biohazard: three open crescents round a small ring
{
  const crescent = (a) => {
    const c = polar(12, 12, 5, a);
    return arc(...c, 4, a + 55, a + 305).d;
  };
  add('biohazard', ['riesgo biológico', 'residuos infecciosos', 'bioseguridad', 'laboratorio', 'biohazard', 'biological hazard', 'infectious waste'], [circ(12, 12, 3), crescent(-90), crescent(30), crescent(150)]);
  FILL.biohazard = false;
  PARTS.biohazard = { ring: [0], crescents: [1, 2, 3] };
}

// ── Hazard signs ──────────────────────────────────────────────────────────────────────────────
// nucleo's alert triangle with the hazard's glyph in place of the exclamation; inside it a glyph
// stands 2.85 clear of the edges, so only the narrow vertical ones fit (a bolt, like the exclamation)
const TRIANGLE = nucleo.icons.alert.d[0];
// Electrical hazard: a zigzag bolt as large as the triangle's inside allows (4.5 wide, 7 tall, its
// corners 2.85 clear of the edges). An arrowhead at its tip shrank the bolt to under 4 wide and its
// arms clogged at 18 px; the bolt alone reads as electricity
{
  add('hazard-electric', ['riesgo eléctrico', 'alto voltaje', 'peligro eléctrico', 'high voltage', 'electrical hazard', 'electric shock'], [TRIANGLE, line([12.5, 9.85], [9.75, 13.5], [14.25, 13.5], [11, 16.9])]);
  FILL['hazard-electric'] = { solid: [0], cut: [1] };
  PARTS['hazard-electric'] = { shape: [0], mark: [1] };
}

// ── Hazards and incidents ─────────────────────────────────────────────────────────────────────
// Electrical fire: dispositivos' power plug upright and the flame climbing its side in front of it
// (turned on its side with the flame at its back, the plug read as a rocket)
{
  const P = [roundpoly([[6, 6.5], [18, 6.5], [18, 11], [14.5, 15], [9.5, 15], [6, 11]], [1.25, 1.25, 2, 1.5, 1.5, 2]), vl(9.5, 2.75, 6.5), vl(14.5, 2.75, 6.5), vl(12, 15, 21.25)].map((d) => move(d, -1.75, 0));
  const fl = fire([17.5, 21.25], 10.5);
  add('electrical-fire', ['incendio eléctrico', 'contacto sobrecargado', 'cortocircuito', 'fuego clase c', 'electrical fire', 'overloaded outlet', 'short circuit'], P, { badge: own([fl], fl, { solid: [fl] }) });
  FILL['electrical-fire'] = { solid: [0], wire: [1, 2, 3] };
  PARTS['electrical-fire'] = { plug: [0, 1, 2], cable: [3] };
}
// Suspended load: a crane hook carrying a box on two slings
{
  const hook = 'M13.5 2.25V6A1.5 1.5 0 0 1 10.5 6V5';
  add('suspended-load', ['carga suspendida', 'grúa', 'no pasar debajo', 'izaje', 'suspended load', 'crane hook', 'overhead lifting'], [hook, line([12, 7.5], [6.5, 13]), line([12, 7.5], [17.5, 13]), sq(4.25, 13, 15.5, 8.25, 2, BR)]);
  FILL['suspended-load'] = { solid: [3], wire: [0, 1, 2] };
  PARTS['suspended-load'] = { hook: [0], slings: [1, 2], load: [3] };
}

// ── Fire safety ───────────────────────────────────────────────────────────────────────────────
// Fire extinguisher: the upright cylinder, the valve's head with its lever on top and the hose curving
// down to the nozzle
const EXT = [
  'M6 21.25V13.5A4 4 0 0 1 14 13.5V21.25Z',
  sq(8.25, 4.75, 3.5, 2.75, 0.75),
  vl(10, 7.5, 9.5),
  line([9, 5], [15.75, 3]),
  'M11.75 6.25C16.75 6.25 18.5 7.75 18.5 11.25V15',
  roundpoly([[17.25, 15], [19.75, 15], [19.25, 19], [17.75, 19]], [0.5, 0.5, 0.6, 0.6]),
];
{
  add('fire-extinguisher', ['extintor', 'equipo contra incendios', 'ubicación de extintores', 'fire extinguisher', 'extinguisher', 'fire equipment'], EXT);
  FILL['fire-extinguisher'] = { solid: [0, 1, 5], wire: [2, 3, 4] };
  PARTS['fire-extinguisher'] = { cylinder: [0], valve: [1, 2, 3], hose: [4, 5] };
  // The hose stops short of the badge's clearance, so it ends the same at every weight
  add('fire-extinguisher-clock', ['revisión de extintor', 'recarga de extintor', 'inspección vencida', 'extinguisher inspection', 'recharge due', 'extinguisher service'], [...EXT.slice(0, 4), 'M11.75 6.25C16.75 6.25 18.5 7.25 18.5 9'], { badge: badge('clock') });
  FILL['fire-extinguisher-clock'] = { solid: [0, 1], wire: [2, 3, 4] };
  PARTS['fire-extinguisher-clock'] = { cylinder: [0], valve: [1, 2, 3], hose: [4] };
}
// Fire hydrant: a pillar hydrant, the dome cap and its nut, the body with an outlet each side and the
// flange at its base
{
  const cap = 'M7.25 9.25A4.75 4.75 0 0 1 16.75 9.25Z';
  const nut = dot(12, 3.5);
  const body = 'M7.75 9.25V18.25H16.25V9.25';
  add('fire-hydrant', ['hidrante', 'toma de agua', 'bomberos', 'fire hydrant', 'hydrant', 'firefighting water'], [cap, nut, body, rl([[7.75, 11.25], [4, 11.25], [4, 15], [7.75, 15]], 1), rl([[16.25, 11.25], [20, 11.25], [20, 15], [16.25, 15]], 1), sq(5.25, 18.25, 13.5, 3, 1)]);
  FILL['fire-hydrant'] = { solid: [0, nut, shut(body), shut(rl([[7.75, 11.25], [4, 11.25], [4, 15], [7.75, 15]], 1)), shut(rl([[16.25, 11.25], [20, 11.25], [20, 15], [16.25, 15]], 1)), 5] };
  PARTS['fire-hydrant'] = { cap: [0, 1], body: [2], outlets: [3, 4], base: [5] };
}
// Fire hose reel: the round reel with the hose coiled on it as a spiral and its end leaving the rim,
// hanging down to the nozzle (two concentric rings and a hub read as a target)
{
  const c = [10.5, 10.25];
  // The coil: half circles turning clockwise, each 1.5 wider than the last, from inside the hub out
  const xs = [c[0] - 1.5, c[0] + 2.75, c[0] - 4.25];
  const coil = xs.slice(1).reduce((s, x, i) => {
    const r = Math.abs(x - xs[i]) / 2;
    return `${s}A${f(r)} ${f(r)} 0 0 1 ${pt([x, c[1]])}`;
  }, `M${pt([xs[0], c[1]])}`);
  add('fire-hose', ['manguera contra incendios', 'gabinete', 'carrete', 'fire hose', 'hose reel', 'fire cabinet'], [
    circ(...c, 7.5),
    coil,
    `M${pt(polar(...c, 7.5, 28))}C17.75 15 18.5 15.25 18.5 16.25`,
    roundpoly([[17.25, 16.25], [19.75, 16.25], [19.25, 20.5], [17.75, 20.5]], [0.5, 0.5, 0.6, 0.6]),
  ]);
  FILL['fire-hose'] = { solid: [0, 3], cut: [1], wire: [2] };
  PARTS['fire-hose'] = { reel: [0, 1], hose: [2, 3] };
}
// Manual fire alarm: the wall box, the flame in its upper half and the T-handle pulled down out of
// its slot
{
  add('fire-alarm', ['alarma contra incendios', 'estación manual', 'palanca de alarma', 'pull station', 'fire alarm', 'call point'], [sq(4.25, 2.75, 15.5, 18.5, 3.5, BR), fire([12, 12.35], 6.6), hl(15.25, 9, 15), vl(12, 15.25, 18.25), hl(18.25, 8.75, 15.25)]);
  FILL['fire-alarm'] = { solid: [0], cut: [1, 2, 3, 4] };
  PARTS['fire-alarm'] = { box: [0], flame: [1], slot: [2], handle: [3, 4] };
}
// Fire sprinkler: the head hanging from the ceiling, its frame and deflector, the spray fanning down
// as a short jet and a drop on each line (whole rays made it hogar's ceiling lamp; two dashes a line
// left the gap between them under 2.85)
{
  // The whole head sits 0.75 higher than a ceiling at 3, so the lowest drop stays in the live area
  const c = [12, 10.5];
  add('fire-sprinkler', ['rociador', 'sprinkler contra incendios', 'sistema de rociadores', 'fire sprinkler', 'sprinkler head', 'sprinkler system'], [
    hl(2.25, 3.25, 20.75),
    roundpoly([[9.5, 5.25], [14.5, 5.25], [12, 10.5]], [0.75, 0.75, 0.5]),
    vl(12, 2.25, 5.25),
    hl(10.5, 8.75, 15.25),
    ...[135, 90, 45].map((a) => line(polar(...c, 4.25, a), polar(...c, 6.5, a))),
    ...[135, 90, 45].map((a) => dot(...polar(...c, 10.1, a))),
  ]);
  FILL['fire-sprinkler'] = { solid: [1, 7, 8, 9], wire: [0, 2, 3], lines: [4, 5, 6] };
  PARTS['fire-sprinkler'] = { ceiling: [0, 2], head: [1, 3], spray: [4, 5, 6, 7, 8, 9] };
}
// House fire: lugares' house and the flame rising from the right of its roof (in front: the engine
// clears the roof and the top of the wall behind it). The flame keeps 3.5 from the round window, so
// its clearance never bites the window at any weight
{
  const H = lugares.icons.house.d;
  const fl = fire([19.25, 12.25], 8);
  add('house-fire', ['incendio en casa', 'emergencia', 'siniestro', 'house fire', 'home fire', 'fire emergency'], H, { badge: own([fl], fl, { solid: [fl] }) });
  FILL['house-fire'] = { solid: [shut(H[0]), shut(H[1])], cut: [2, 3] };
  PARTS['house-fire'] = { roof: [0], walls: [1], door: [2], window: [3] };
}

// ── Evacuation ────────────────────────────────────────────────────────────────────────────────
// personas' doorway, 5 wide on the floor line, at the right
const DOOR = rl([[16.25, 21.25], [16.25, 3], [21.25, 3], [21.25, 21.25]], 1.5);
const FLOOR = hl(21.25, 2.75, 21.25);
// Emergency exit: fitness' runner heading into the doorway
{
  const g = pose({ P: [7.5, 14.75], torso: [5.5, -72], legs: [[[4, 35], [4.25, 100]], [[4, 115], [4, 200]]], arms: [[[3.5, 60], [3, -40]], [[3.5, 145], [3, 215]]] });
  const fig = figure(g);
  add('emergency-exit', ['salida de emergencia', 'salida', 'evacuación', 'emergency exit', 'fire exit', 'exit sign'], [...fig, DOOR, FLOOR]);
  FILL['emergency-exit'] = { solid: [0], wire: [...figWire(fig.length), fig.length, fig.length + 1] };
  PARTS['emergency-exit'] = { ...figParts(2, 2), door: [fig.length], floor: [fig.length + 1] };
}
// Accessible emergency exit: accesibilidad's rider (the one door-accessible fits through a door, its
// gaps kept) heading into the same doorway
{
  const rider = accesibilidad.icons['door-accessible'].d.slice(2).map((d) => move(d, -4.4, 0));
  add('emergency-exit-accessible', ['salida accesible', 'evacuación en silla de ruedas', 'salida de emergencia', 'accessible exit', 'accessible emergency exit', 'wheelchair evacuation'], [...rider, DOOR, FLOOR]);
  FILL['emergency-exit-accessible'] = { solid: [0], wire: [1, 2, 3, 4, 5] };
  PARTS['emergency-exit-accessible'] = { head: [0], body: [1, 2], wheel: [3], door: [4], floor: [5] };
}
// Evacuation route: a dashed path from a dot that turns twice and ends as an arrow into the doorway
{
  const route = [line([7.05, 5.25], [7.75, 5.25], [7.75, 6.75]), vl(7.75, 9.75, 11.75)];
  const arrow = [line([7.75, 14.75], [13.25, 14.75]), head([13.25, 14.75], [1, 0], 3)];
  add('evacuation-route', ['ruta de evacuación', 'plan de evacuación', 'salida', 'evacuation route', 'escape route', 'evacuation plan'], [DOOR, FLOOR, dot(3.5, 5.25), ...route, ...arrow]);
  FILL['evacuation-route'] = false;
  PARTS['evacuation-route'] = { door: [0], floor: [1], route: [2, 3, 4], arrow: [5, 6] };
}
// Assembly point: personas' standing figure and four short arrows at the corners pointing in at it
{
  const k = 0.7;
  const S = [12, 19.25 - 12.5 * k];
  const fig = figure({ H: go(S, -90, HR * k + GAP), hr: HR * k, S, P: [12, 19.25 - 7 * k], legs: [[[12 - 2.25 * k, 19.25], [12, 19.25 - 7 * k], [12 + 2.25 * k, 19.25]]], arms: [[[12 - 3.05, S[1] + 5.65 * k], [12 - 2.5 * k, S[1] + 1.65 * k], S, [12 + 2.5 * k, S[1] + 1.65 * k], [12 + 3.05, S[1] + 5.65 * k]]] });
  const arrows = [[3.25, 3.25], [20.75, 3.25], [20.75, 20.75], [3.25, 20.75]].flatMap((a) => {
    const tip = add2(a, mul(unit(sub([12, 12], a)), 5.25));
    return [line(a, tip), head(tip, sub(tip, a), 3.25)];
  });
  add('assembly-point', ['punto de reunión', 'punto de encuentro', 'evacuación', 'assembly point', 'muster point', 'meeting point'], [...fig, ...arrows]);
  FILL['assembly-point'] = { solid: [0], wire: [...figWire(fig.length), ...arrows.map((_, i) => fig.length + i)] };
  PARTS['assembly-point'] = { ...figParts(1, 1), arrows: arrows.map((_, i) => fig.length + i) };
}

// ── Emergencies ───────────────────────────────────────────────────────────────────────────────
/** The six-armed emergency star: three bars of half-width w crossing, their arms reaching L, its corners rounded. */
function emergencyStar(c, L, w, r = 0.6) {
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = -90 + 60 * k;
    const d = (Math.atan(w / L) * 180) / Math.PI;
    const R = Math.hypot(L, w);
    pts.push(polar(...c, R, a - d), polar(...c, R, a + d), polar(...c, 2 * w, a + 30));
  }
  return roundpoly(pts, pts.map((_, i) => (i % 3 === 2 ? 0.4 : r)));
}
// Emergency medical services: the six-armed star of three crossing bars, no staff or snake
const STAR = emergencyStar([12, 12], 9, 2.4);
{
  add('medical-emergency', ['emergencia médica', 'paramédicos', 'servicios médicos de urgencia', 'ems', 'medical emergency', 'paramedic', 'emergency care'], [STAR]);
  FILL['medical-emergency'] = { solid: [0] };
}
// Emergency call: nucleo's phone and the emergency star as a corner piece (three crossing strokes)
{
  const c = [17.5, 6.5];
  const bars = [90, 30, -30].map((a) => line(polar(...c, 3.5, a), polar(...c, 3.5, a + 180)));
  add('phone-emergency', ['llamada de emergencia', 'número de emergencia', 'sos', 'emergency call', 'call 911', 'sos call'], [nucleo.icons.phone.d[0], ...bars]);
  FILL['phone-emergency'] = { solid: [0], lines: [1, 2, 3] };
  PARTS['phone-emergency'] = { handset: [0], star: [1, 2, 3] };
}
// Emergency shower: the tall pipe, the wide shower head on its arm and the pull rod ending in a
// triangular handle
{
  add('emergency-shower', ['regadera de emergencia', 'ducha de seguridad', 'descontaminación', 'emergency shower', 'safety shower', 'deluge shower'], [rl([[6.5, 21.25], [6.5, 3.5], [14, 3.5], [14, 5.5]], [0, 1.5, 1.5, 0]), roundpoly([[11.75, 5.5], [16.25, 5.5], [19.25, 8.5], [8.75, 8.5]], [0.75, 0.75, 0.75, 0.75]), vl(17, 8.5, 14.5), roundpoly([[17, 13.75], [19.5, 18], [14.5, 18]], 0.75), hl(21.25, 3.75, 9.25)]);
  FILL['emergency-shower'] = { solid: [1], wire: [0, 2, 4], lines: [3] };
  PARTS['emergency-shower'] = { pipe: [0, 4], head: [1], handle: [2, 3] };
}
// Defibrillator: the heart with a zigzag bolt inside it, hazard-electric's stroke, 3.2 clear of
// the heart (the bolt across the heart, in front of it, split it in two: a broken heart; nucleo's
// solid bolt inside it closed up at bold)
const HEART = 'M12 20.5L4.03 12A4.75 4.75 0 1 1 12 7.23A4.75 4.75 0 1 1 19.97 12Z';
{
  add('defibrillator', ['desfibrilador', 'dea', 'paro cardiaco', 'emergencia cardiaca', 'defibrillator', 'aed', 'cardiac arrest'], [HEART, line([13.62, 10.06], [9.95, 13.14], [14.05, 13.14], [12, 15.84])]);
  FILL.defibrillator = { solid: [0], cut: [1] };
  PARTS.defibrillator = { heart: [0], bolt: [1] };
}
// Lone worker: personas' standing figure with two signal arcs over its head
{
  const k = 0.65;
  const S = [12, 21.25 - 12.5 * k];
  const H = go(S, -90, HR * k + GAP);
  const fig = figure({ H, hr: HR * k, S, P: [12, 21.25 - 7 * k], legs: [[[12 - 2.25 * k, 21.25], [12, 21.25 - 7 * k], [12 + 2.25 * k, 21.25]]], arms: [[[12 - 3.05, S[1] + 5.65 * k], [12 - 2.5 * k, S[1] + 1.65 * k], S, [12 + 2.5 * k, S[1] + 1.65 * k], [12 + 3.05, S[1] + 5.65 * k]]] });
  const waves = [4.15, 7].map((r) => arc(...H, r, -135, -45).d);
  add('lone-worker', ['trabajador aislado', 'trabajo en solitario', 'hombre caído', 'lone worker', 'man down', 'check-in'], [...fig, ...waves]);
  FILL['lone-worker'] = { solid: [0], wire: figWire(fig.length), lines: [fig.length, fig.length + 1] };
  PARTS['lone-worker'] = { ...figParts(1, 1), signal: [fig.length, fig.length + 1] };
  // At 16 px one arc, clear of the head
  icons['lone-worker'].small = small16([...fig, arc(...H, 6, -135, -45).d], { solid: [0], wire: figWire(fig.length), lines: [fig.length] });
}
// Break glass: sistema's hammer, smaller, its face striking a pane and cracks radiating from the hit
// (the hammer in front: the engine clears the pane under it)
{
  const hit = [12, 11.5];
  const pane = sq(7.25, 4.25, 14, 17, 2.5, BR);
  const cracks = [-30, 25, 80].map((a) => line(polar(...hit, 4.85, a), polar(...hit, a === -30 ? 7.25 : 7, a)));
  const HM = sistema.icons.hammer.d.map((d) => place(d, 0.55, [18.9, 14.1], hit));
  add('break-glass', ['romper el vidrio', 'martillo de emergencia', 'rompa en caso de emergencia', 'break glass', 'emergency hammer', 'glass break'], [pane, ...cracks], { badge: own(HM, `${HM[0]}${HM[1]}`, { solid: [HM[0]], wire: [HM[1]] }) });
  FILL['break-glass'] = { solid: [0], cut: [1, 2, 3] };
  PARTS['break-glass'] = { pane: [0], cracks: [1, 2, 3] };
}
// Lockout: nucleo's padlock and a tag hanging from its shackle on a short loop (in front of the body)
{
  const L = nucleo.icons.lock.d;
  const tag = roundpoly([[14.5, 14.5], [17.5, 11.5], [20.5, 14.5], [20.5, 21.25], [14.5, 21.25]], [0.75, 0.6, 0.75, 1, 1]);
  const loop = line([17.5, 11.25], [15.9, 8.25]);
  add('lockout', ['bloqueo y etiquetado', 'loto', 'aislar energía', 'lockout', 'tagout', 'energy isolation'], [L[0], L[1]], { badge: own([tag, loop, dot(17.5, 15.25)], knockOf([tag], [[[17.5, 11.25], [15.9, 8.25]]]), { solid: [tag], cut: [dot(17.5, 15.25)], wire: [loop] }) });
  FILL.lockout = { solid: [0], wire: [1] };
  PARTS.lockout = { body: [0], shackle: [1] };
}
// Caution tape: the striped tape sagging between two short posts
{
  const yTop = (x) => {
    const t = (x - 5) / 14;
    return 8.75 + 11 * t * (1 - t);
  };
  const stripes = [9, 12, 15].map((x) => line([x - 0.9, yTop(x - 0.9) + 3.5], [x + 0.9, yTop(x + 0.9)]));
  add('caution-tape', ['cinta de precaución', 'acordonado', 'zona restringida', 'caution tape', 'barrier tape', 'cordon'], [vl(5, 6.25, 21.25), vl(19, 6.25, 21.25), 'M5 8.75Q12 14.25 19 8.75', 'M5 12.25Q12 17.75 19 12.25', ...stripes, hl(21.25, 3, 7), hl(21.25, 17, 21)]);
  FILL['caution-tape'] = false;
  PARTS['caution-tape'] = { posts: [0, 1, 7, 8], tape: [2, 3, 4, 5, 6] };
}
// Wheel chock: a wedge pressed against the bottom of a wheel's arc
{
  const c = [10, 13.25];
  add('wheel-chock', ['calza', 'cuña para llanta', 'andén de carga', 'wheel chock', 'loading dock', 'parked trailer'], [circ(...c, 8), circ(...c, 4.75), ...[-90, -18, 54, 126, 198].map((a) => line(polar(...c, 2.6, a), polar(...c, 4.75, a)))], { badge: own([roundpoly([[13.25, 21.25], [21.25, 21.25], [21.25, 13.75]], [0.5, 0.75, 0.75])], roundpoly([[13.25, 21.25], [21.25, 21.25], [21.25, 13.75]], [0.5, 0.75, 0.75]), { solid: [roundpoly([[13.25, 21.25], [21.25, 21.25], [21.25, 13.75]], [0.5, 0.75, 0.75])] }) });
  FILL['wheel-chock'] = { solid: [0], cut: [1, 2, 3, 4, 5, 6] };
  PARTS['wheel-chock'] = { wheel: [0, 1, 2, 3, 4, 5, 6] };
  // At 16 px the spokes clog: the tire and its hub
  const chock = roundpoly([[13.25, 21.25], [21.25, 21.25], [21.25, 13.75]], [0.5, 0.75, 0.75]);
  icons['wheel-chock'].small = small16([circ(...c, 8), dot(...c, 1)], { solid: [0], cut: [1] }, own([chock], chock, { solid: [chock] }));
}

// ── Documents ─────────────────────────────────────────────────────────────────────────────────
// nucleo's document with its first two lines, the second shortened: the corner piece takes the rest
const DOC = [nucleo.icons.document.d[0], nucleo.icons.document.d[1], hl(12, 8.75, 12.75)];
// Safety data sheet: nucleo's document with the fire diamond as a corner piece
{
  const c = [17.25, 17.25];
  const D = roundpoly([polar(...c, 4.75, -90), polar(...c, 4.75, 0), polar(...c, 4.75, 90), polar(...c, 4.75, 180)], 0.75);
  const cross = [line(polar(...c, 2.375 * Math.SQRT2, -135), polar(...c, 2.375 * Math.SQRT2, 45)), line(polar(...c, 2.375 * Math.SQRT2, -45), polar(...c, 2.375 * Math.SQRT2, 135))];
  add('safety-data-sheet', ['hoja de datos de seguridad', 'hds', 'ficha de seguridad', 'sds', 'safety data sheet', 'msds'], DOC, { badge: own([D, ...cross], D, { solid: [D], cut: cross }) });
  FILL['safety-data-sheet'] = { solid: [0], cut: [1, 2] };
  PARTS['safety-data-sheet'] = { document: [0], lines: [1, 2] };
}
// Permit to work: nucleo's document with a small hard hat (sistema's dome over its brim) as a corner piece
{
  // At corner size the hat's brim is a line (a brim of 2 would close up at heavy weights)
  const dome = arc(16.75, 18.25, 4, 180, 360).d;
  const brim = hl(18.25, 11.75, 21.75);
  add('work-permit', ['permiso de trabajo', 'trabajo en caliente', 'espacio confinado', 'permit to work', 'hot work permit', 'work permit'], DOC, { badge: own([dome, brim], knockOf([shut(dome)], [[[11.75, 18.25], [21.75, 18.25]]]), { solid: [shut(dome)], wire: [brim] }) });
  FILL['work-permit'] = { solid: [0], cut: [1, 2] };
  PARTS['work-permit'] = { document: [0], lines: [1, 2] };
}

// ── Fill, parts, variants, mirroring and motion ──────────────────────────────────────────────
for (const [name, spec] of Object.entries(FILL)) {
  if (spec === false) {
    icons[name].fill = false;
    continue;
  }
  const { d } = icons[name];
  const pick = (ix) => (ix ?? []).map((i) => (typeof i === 'number' ? d[i] : i));
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }), ...(spec.wire && { wire: pick(spec.wire) }) };
}
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// With the engine's badge in the corner the enclosures stop reading at 58 % and the slash would cut
// through it; the same for the documents' corner pieces
for (const name of ['hard-hat-check', 'fire-extinguisher-clock', 'safety-data-sheet', 'work-permit'])
  icons[name].variants = { circle: false, square: false, slash: false };
// A slash says nothing on a route or on the arrows that gather people
for (const name of ['evacuation-route', 'assembly-point']) icons[name].variants = { ...icons[name].variants, slash: false };

// Directional: the figures that run or roll one way and the route flip in right-to-left languages;
// the objects in profile (the boot, the head) keep their side
for (const name of ['emergency-exit', 'emergency-exit-accessible', 'evacuation-route']) icons[name].mirror = true;

// Motion: the flames flicker, the bursts and hearts beat, the trefoil turns, the hanging things
// swing, the handles are pulled and the figures move on their way
const FIGURE = ['head', 'body', 'legs', 'arms'];
const MOTION = {
  flammable: { effect: 'wiggle', parts: ['flame'], origin: [12, 18.25] },
  oxidizer: { effect: 'wiggle', parts: ['flame'], origin: [12, 18.25] },
  'house-fire': { effect: 'wiggle', parts: ['badge'], origin: [19.25, 12.25] },
  'electrical-fire': { effect: 'wiggle', parts: ['badge'], origin: [17.5, 21.25] },
  explosive: { effect: 'beat', parts: ['burst', 'fragments'], origin: BLAST },
  radioactive: { effect: 'spin', parts: ['blades'], origin: [12, 12] },
  'hazard-electric': { effect: 'wiggle', origin: [12, 20] },
  corrosive: { effect: 'slide', parts: ['drops'], vector: [0, 1.25] },
  'suspended-load': { effect: 'ring', origin: [12, 2.25] },
  'fire-alarm': { effect: 'slide', parts: ['handle'], vector: [0, 1.25] },
  'fire-sprinkler': { effect: 'slide', parts: ['spray'], vector: [0, 1.25] },
  'fire-hose': { effect: 'spin', parts: ['reel'], origin: [10.5, 10.25] },
  'emergency-exit': { effect: 'slide', parts: FIGURE, vector: [1.5, 0] },
  'emergency-exit-accessible': { effect: 'slide', parts: ['head', 'body', 'wheel'], vector: [1.5, 0] },
  'evacuation-route': { effect: 'slide', parts: ['arrow'], vector: [1.25, 0] },
  'assembly-point': { effect: 'beat', parts: ['arrows'], origin: [12, 12] },
  'phone-emergency': { effect: 'ring', origin: [12, 12] },
  'medical-emergency': { effect: 'beat', origin: [12, 12] },
  'emergency-shower': { effect: 'slide', parts: ['handle'], vector: [0, 1.25] },
  defibrillator: { effect: 'beat', origin: [12, 13] },
  'lone-worker': { effect: 'beat', parts: ['signal'], origin: [12, 9.5] },
  'hard-hat-lamp': { effect: 'beat', parts: ['lamp'], origin: [12, 12] },
  lockout: { effect: 'ring', parts: ['badge'], origin: [15.9, 8.75] },
  'break-glass': { effect: 'wiggle', parts: ['badge'], origin: [17.5, 5] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

export default { category: 'seguridad-laboral', label: 'Seguridad y emergencias', icons };
