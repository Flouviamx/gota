// Ciberseguridad (cybersecurity): threats and defense. Malware and its kinds, phishing and the
// attacks on people, intrusions and vulnerabilities, encryption and hashing, access and secrets,
// and the defense side: audits, response, hunting, backups and isolation. Everything is computed
// with the engine (engine/geometry.mjs) on the rules in DESIGN.md.
//
// The family is built on adopted bases, read from their categories and never redrawn: datos' bug
// (all malware), sistema's locks, keyhole, shield, wall, radar, gear, fingerprint and scan corners,
// the core's envelope, bubble, phone, person, document, database, link, key and globe, and the
// objects of dispositivos, archivos, comercio, comunicacion, navegacion, edicion, logistica and
// lugares. A few pieces are drawn here, once, and used by every icon that needs them: the bug badge
// (datos' bug, small, in the badge's place: "this, infected"), the fishhook ("this, hooked": phishing,
// theft and the con), the mask ("this, faked": spoofing), the bolt ("this, attacked"), the crack
// ("this, broken"), the syringe ("this, injected") and the shield ("this, protected"). Whatever sits
// on top of another shape is a badge the engine clears with its clearance of paper; the base is never
// trimmed by hand, and a base that a badge's clearance would cut differently from one weight to the
// next, or leave a stub of, is the one its category prepared for badges or is moved clear of it.
import { arc, badge, circ, cursor, dot, drop, f, flipPath, halfChord, line, polar, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import calendario from './calendario.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import datos from './datos.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import logistica from './logistica.mjs';
import lugares from './lugares.mjs';
import navegacion from './navegacion.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────────
const P = (p) => `${f(p[0])} ${f(p[1])}`;
/** A piece scaled by `s` about `o` and moved by (dx, dy). */
const move = (d, s = 1, o = [12, 12], dx = 0, dy = 0) => transform(d, s, o[0] * (1 - s) + dx, o[1] * (1 - s) + dy);
/** Several strokes scaled by `s` about `from`, which lands on `to`. */
const place = (ds, s, from, to) => ds.map((d) => move(d, s, from, to[0] - from[0], to[1] - from[1]));
/** A custom piece on top of the base: the engine clears the base around `knock`. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** Just the A command of an engine arc, to chain it after another path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]+/, '');
/** A point `s` along the unit vector `u` from `p`, and `o` across it (to its right on screen). */
const along = (p, u, s, o = 0) => [p[0] + u[0] * s - u[1] * o, p[1] + u[1] * s + u[0] * o];

/**
 * The same open path out and back: it looks identical but encloses no area, so in a badge's knock
 * it is the area of the line with round caps. Reads the absolute M, L, H, V and A commands the
 * engine writes (line, arc, polylines).
 */
function trace(d) {
  const tk = d.match(/[MLHVAZ]|-?(?:\d+\.?\d*|\.\d+)/g);
  const segs = [];
  let i = 0;
  let cmd = '';
  let cur = [0, 0];
  const n = () => Number(tk[i++]);
  while (i < tk.length) {
    if (/[A-Z]/.test(tk[i])) cmd = tk[i++];
    if (cmd === 'Z') continue;
    if (cmd === 'M') {
      cur = [n(), n()];
      segs.push({ t: 'M', to: cur });
      cmd = 'L';
    } else if (cmd === 'L') {
      const to = [n(), n()];
      segs.push({ t: 'L', from: cur, to });
      cur = to;
    } else if (cmd === 'H') {
      const to = [n(), cur[1]];
      segs.push({ t: 'L', from: cur, to });
      cur = to;
    } else if (cmd === 'V') {
      const to = [cur[0], n()];
      segs.push({ t: 'L', from: cur, to });
      cur = to;
    } else if (cmd === 'A') {
      const a = [n(), n(), n(), n(), n()];
      const to = [n(), n()];
      segs.push({ t: 'A', a, from: cur, to });
      cur = to;
    }
  }
  let back = '';
  for (const s of segs.toReversed()) {
    if (s.t === 'M') break;
    back += s.t === 'L' ? `L${P(s.from)}` : `A${s.a[0]} ${s.a[1]} ${s.a[2]} ${s.a[3]} ${s.a[4] ? 0 : 1} ${P(s.from)}`;
  }
  return `${d}${back}Z`;
}

/** Points along a path (made absolute by the engine): its corners, with curves and arcs sampled. */
function samples(d) {
  const tk = transform(d, 1, 0, 0).match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g);
  const pts = [];
  let [i, cmd, cur, start] = [0, '', [0, 0], [0, 0]];
  const n = () => Number(tk[i++]);
  const bez = (a, t) => [0, 1].map((k) => (1 - t) ** 3 * a[0][k] + 3 * (1 - t) ** 2 * t * a[1][k] + 3 * (1 - t) * t ** 2 * a[2][k] + t ** 3 * a[3][k]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    if (cmd === 'Z') {
      cur = start;
      continue;
    }
    if (cmd === 'M') {
      cur = start = [n(), n()];
      pts.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      cur = [n(), n()];
      pts.push(cur);
    } else if (cmd === 'H') {
      cur = [n(), cur[1]];
      pts.push(cur);
    } else if (cmd === 'V') {
      cur = [cur[0], n()];
      pts.push(cur);
    } else if (cmd === 'C') {
      const a = [cur, [n(), n()], [n(), n()], [n(), n()]];
      for (let t = 1; t <= 12; t++) pts.push(bez(a, t / 12));
      cur = a[3];
    } else if (cmd === 'A') {
      const [r0, , , large, sweep, x, y] = [n(), n(), n(), n(), n(), n(), n()];
      // The arc's center, from its ends, radius and flags (as the SVG spec does)
      const [hx, hy] = [(cur[0] - x) / 2, (cur[1] - y) / 2];
      const r = Math.max(r0, Math.hypot(hx, hy));
      const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, (r * r - hx * hx - hy * hy) / (hx * hx + hy * hy)));
      const c = [k * hy + (cur[0] + x) / 2, -k * hx + (cur[1] + y) / 2];
      const a0 = Math.atan2(cur[1] - c[1], cur[0] - c[0]);
      let da = Math.atan2(y - c[1], x - c[0]) - a0;
      if (sweep && da < 0) da += 2 * Math.PI;
      if (!sweep && da > 0) da -= 2 * Math.PI;
      for (let t = 1; t <= 16; t++) pts.push([c[0] + r * Math.cos(a0 + (da * t) / 16), c[1] + r * Math.sin(a0 + (da * t) / 16)]);
      cur = [x, y];
    } else throw new Error(`samples: unexpected ${cmd} in ${d}`);
  }
  return pts;
}
/**
 * The convex hull of a piece: what a custom piece on top of the base clears. Like the engine's
 * badges (a ring, the sync arrows' hull), it cuts the base along one smooth line, so no bits of the
 * base are left between its legs or in its notches, at any weight.
 */
function hull(ds) {
  const pts = ds.flatMap(samples).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const chain = (list) => {
    const out = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out.at(-2), out.at(-1), p) <= 1e-9) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return `M${[...chain(pts), ...chain(pts.toReversed())].map(P).join('L')}Z`;
}

// ── Adopted bases ─────────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const S = sistema.icons;
const D = datos.icons;
const BUG = D.bug.d;
// The bug under a status badge, as desarrollo puts it under its badges (bug-check, bug-plus): the
// right legs, wholly behind the badge, left out (the tip of the upper one peeked out of the
// clearance at bold) and the seam ending inside the clearance at every weight
const BUG_B = [BUG[0], BUG[1], line([12, 8.5], [12, 14.5]), BUG[3], BUG[4]];
const MAIL = N.mail.d;
const DOC = N.document.d;
const PERSON = N.person.d;
const DB = D['database-plus'].d; // the database as datos puts it under a badge: body, lid, middle curve
const LOCK_B = S['lock-clock'].d; // the core padlock moved up and left, clear of a badge
const CAL = calendario.icons['calendar-coin'].d; // the calendar without its days, as under a badge
const COIN = calendario.icons['calendar-coin'].badge; // the coin badge: a disc with its sign cut out
const KEYBOARD = dispositivos.icons.keyboard.d;
const USB = dispositivos.icons['usb-drive'].d;
const MEGAPHONE = comunicacion.icons.megaphone.d;
const SUPPLY = logistica.icons['supply-chain'].d.filter((_, i) => i !== 2 && i !== 3); // without its right box: the bug takes its place
const PARCEL = comercio.icons['parcel-check'].d; // the parcel as comercio puts it under a badge
// The core layers, their top and one more layer, at 80 % from the top: the bug goes under them
const LAYERS = [N.layers.d[2], N.layers.d[0]].map((d) => move(d, 0.8, [12, 2.75], 0, -0.6));
const EYE_B = S['eye-lock'].d; // the eye at 90 %, up and left, clear of a badge
const PASSWORD = S.password.d;
// The field up, under a padlock badge: two of its dots and its caret (the third dot sat where the open
// padlock's clearance takes it at some weights only)
const PASSWORD_UP = PASSWORD.filter((_, i) => i !== 3).map((d) => move(d, 1, [12, 12], 0, -4.75));
const COOKIE = S.cookie.d;
const TARGET = D.target.d;
const WALL = S.firewall.d;
// The wall under a badge: without the two joints the badge's clearance left as stubs
const WALL_B = WALL.filter((_, i) => i !== 8 && i !== 10);
const SHIELD = S['shield-empty'].d;
const KEYHOLE = S.keyhole.d[1]; // the keyhole on its own, without its ring
const SCAN = S.scan.d[0]; // the four scan corners
const NETWORK = D.network.d.filter((_, i) => i !== 2 && i !== 5); // datos' network without its lower right node and its spoke
// edicion's list without its plus, its lower rows ending short of a badge's clearance at every weight
const LIST = [edicion.icons['list-plus'].d[0], line([3.75, 12], [11.5, 12]), line([3.75, 18], [9.5, 18])];

// ── The bug badge ─────────────────────────────────────────────────────────────────────────────
/**
 * datos' bug, small, rebuilt on its own construction (shoulders, a round bottom, the seam and two
 * legs a side) with the legs kept at 2 or more: scaled as a whole, they came out as fragments. Its
 * head is a dot: at this size the half-disc head's hole opened and closed with the weight. (cx, cy)
 * is the center of its round bottom; `k` scales it (the dot stays a dot).
 */
function smallBug(cx, cy, k = 1) {
  const [hw, sh] = [2.75 * k, 1.25 * k];
  const top = cy - 3.25 * k;
  const body = `M${P([cx - hw, cy])}V${f(top + sh)}A${f(sh)} ${f(sh)} 0 0 1 ${P([cx - hw + sh, top])}H${f(cx + hw - sh)}A${f(sh)} ${f(sh)} 0 0 1 ${P([cx + hw, top + sh])}V${f(cy)}A${f(hw)} ${f(hw)} 0 0 1 ${P([cx - hw, cy])}Z`;
  const headDot = dot(cx, top - 0.7);
  const seam = line([cx, top], [cx, cy + hw]);
  // The lower legs leave the bottom arc where datos' do (141.5°, 38.5°) and run its way
  const foot = (side) => {
    const a = polar(cx, cy, hw, side < 0 ? 141.5 : 38.5);
    return line(a, [a[0] + side * 0.807 * 2.4 * k, a[1] + 0.59 * 2.4 * k]);
  };
  const legs = [line([cx - hw, cy - 1.25 * k], [cx - hw - 2 * k, cy - 1.25 * k]), foot(-1), line([cx + hw, cy - 1.25 * k], [cx + hw + 2 * k, cy - 1.25 * k]), foot(1)];
  return { body, headDot, seam, legs, d: [body, headDot, seam, ...legs], fill: { solid: [body, headDot], cut: [seam], wire: legs } };
}
const BUG_BADGE = (() => {
  const b = smallBug(17.25, 18);
  return own(b.d, hull(b.d), b.fill);
})();
/** The small bug as a subject: inside scan corners, larger; inside the dashed ring, as is. */
const BUG_C = smallBug(12, 13.25, 1.2);
const BUG_Q = smallBug(12, 12.75);

// ── The fishhook ──────────────────────────────────────────────────────────────────────────────
// One hook for the whole family: its eye at the top right, the shank down the right side, a round
// bend and the point rising to the left with its barb. It sits on top of whatever it hooks (a
// custom badge) and the engine clears the bait along it.
const HOOK = (() => {
  const [x, eyeY, bendY, r] = [19.25, 4.25, 16.75, 3.5];
  const eye = circ(x, eyeY, 1.5);
  const tipY = 12.25;
  const j = `M${P([x, eyeY + 1.5])}V${f(bendY)}${arcTo(x - r, bendY, r, 0, 180)}V${f(tipY)}L${P([x - 2 * r - 1.6, tipY + 1.75])}`;
  return [eye, j];
})();
const hooked = own(HOOK, [HOOK[0], trace(HOOK[1])].join(''), { solid: [HOOK[0]], wire: [HOOK[1]] });

// ── The mask ──────────────────────────────────────────────────────────────────────────────────
/** A closed path symmetric about x = cx: the right half as cubic segments from the top of the axis down to its bottom. */
function mirrored(cx, cy, s, start, half) {
  const p = ([x, y]) => [cx + x * s, cy + y * s];
  const q = ([x, y]) => [cx - x * s, cy + y * s];
  let d = `M${P(p(start))}`;
  const pts = [start];
  for (const [c1, c2, e] of half) {
    d += `C${P(p(c1))} ${P(p(c2))} ${P(p(e))}`;
    pts.push(e);
  }
  for (let k = half.length - 1; k >= 0; k--) d += `C${P(q(half[k][1]))} ${P(q(half[k][0]))} ${P(q(pts[k]))}`;
  return `${d}Z`;
}
/** An almond (a lens of two arcs) centered at (cx, cy), rx wide and ry tall on each side. */
function almond(cx, cy, rx, ry) {
  const R = f((rx * rx + ry * ry) / (2 * ry));
  return `M${P([cx - rx, cy])}A${R} ${R} 0 0 1 ${P([cx + rx, cy])}A${R} ${R} 0 0 1 ${P([cx - rx, cy])}Z`;
}
// A masquerade mask: the top swept up into a point at each side, the lobes round below and the
// notch over the bridge of the nose; its eyes are almonds. It is drawn at one size only (19.5 wide):
// any smaller and its eyes either close up at bold or run into its edge, so wherever it goes it goes
// whole, in front of the lower half of what it disguises.
const MASK = [
  mirrored(12, 12, 1, [0, -3], [[[2.5, -3.1], [6.25, -5.25], [9.5, -5.5]], [[10, -2], [9.5, 2], [7.25, 3.9]], [[5.6, 5.1], [3, 4.75], [1.6, 3.25]], [[1, 2.6], [0.6, 2.4], [0, 2.4]]]),
  almond(7.6, 12.1, 2.4, 1.4),
  almond(16.4, 12.1, 2.4, 1.4),
];
/** The mask moved so its center (the bridge between its eyes) sits at y. */
const maskAt = (y) => MASK.map((d) => move(d, 1, [12, 12], 0, y - 12));
/** The mask in front of the base: filled, it is solid with its eyes cut out. */
const masked = (y) => {
  const m = maskAt(y);
  return own(m, m[0], { solid: [m[0]], cut: m.slice(1) });
};
const MASK_UP = maskAt(8.25);
/** A piece in front of the mask: its strokes, the area the engine clears and its fill. */
const front = (d, solid, cut = []) => own(d, solid.join(''), { solid, ...(cut.length && { cut }) });

// ── Pieces in the badge's place ───────────────────────────────────────────────────────────────
// Each is an adopted drawing at badge size, centered where the engine's badges sit (17.25, 17.25),
// and keeps the icon's style. Only their outer shapes: inner details under ~2 would be fragments.
// Those that fit inside the badges' circle clear that circle, as the engine's glyph badges do (the
// heart, the gear): the base is cut the same under any of them, so the bases the set already
// prepared for its badges (datos' database, the desktop, the laptop) work under them too.
const BC = [17.25, 17.25];
const RING = circ(17.25, 17.25, 4.25);
/** sistema's shield, inside the circle: protected. */
const SHIELD_P = (() => {
  const d = place(SHIELD, 0.44, [12, 12.24], BC);
  return own(d, RING, { solid: d });
})();
/**
 * A bolt of lightning: attacked. A status badge, a solid disc with the bolt's zigzag cut out (the
 * core bolt's outline at this size pinched shut at bold, its two halves closing into pockets).
 */
const BOLT_P = (() => {
  const at = (x, y) => [BC[0] + x, BC[1] + y];
  const sign = line(at(1.15, -2.5), at(-1.25, 0.4), at(1.25, -0.4), at(-1.15, 2.5));
  return own([RING, sign], RING, { solid: [RING], cut: [sign] });
})();
/** lugares' droplet: leaking. */
const DROP_P = (() => {
  const d = place([lugares.icons.droplet.d[0]], 0.45, [12, 12], BC);
  return own(d, RING, { solid: d });
})();
/**
 * A hammer striking up and to the left: forced. A status badge, a solid disc with the hammer cut out,
 * its head a bar across the end of its handle (sistema's hammer at this size closed up: its head and
 * its handle are outlines narrower than a stroke and a half).
 */
const HAMMER_P = (() => {
  const at = (x, y) => [BC[0] + x, BC[1] + y];
  const handle = line(at(2, 2), at(-0.55, -0.55));
  const head = line(at(-2.4, 0.6), at(0.6, -2.4));
  return own([RING, handle, head], RING, { solid: [RING], cut: [handle, head] });
})();
/** sistema's patch (the bandage), inside the circle: mended. */
const PATCH_P = (() => {
  const d = place(S.patch.d.slice(0, 3), 0.44, [12, 12], BC);
  return own(d, RING, { solid: [d[0]], cut: d.slice(1) });
})();
/** edicion's eraser without its baseline, inside the circle: wiped. */
const ERASER_P = (() => {
  const d = place(edicion.icons.eraser.d.slice(0, 2), 0.54, [11.75, 10.25], BC);
  return own(d, RING, { solid: [d[0]], cut: [d[1]] });
})();
/** An eye (edicion's, at badge size) as wide as the circle: watched. The pupil is a dot. */
const EYE_P = (() => {
  const d = [almond(17.25, 17.25, 4.25, 3), dot(17.25, 17.25)];
  return own(d, RING, { solid: [d[0]], cut: [d[1]] });
})();
/** The engine's padlock badge with its shackle lifted off the left: unlocked. */
const UNLOCK_P = (() => {
  const body = sq(13.5, 16.25, 7.5, 5.5, 1.6, { square: ['br'] });
  const shackle = 'M19.4 16.25V13.35A2.15 2.15 0 0 0 15.1 13.35';
  return own([body, shackle], sq(13.5, 11.2, 7.5, 10.55, 2.4, { square: ['br'] }), { solid: [body], wire: [shackle] });
})();
/** A status badge on the engine's ring with a hash sign cut out: hashed. */
const HASH_P = (() => {
  const ring = circ(17.25, 17.25, 4.25);
  const [a, h, t] = [1.35, 2.4, 0.35];
  const marks = [
    line([17.25 - a + t, 17.25 - h], [17.25 - a - t, 17.25 + h]),
    line([17.25 + a + t, 17.25 - h], [17.25 + a - t, 17.25 + h]),
    line([17.25 - h, 17.25 - a + 0.1], [17.25 + h, 17.25 - a + 0.1]),
    line([17.25 - h, 17.25 + a - 0.1], [17.25 + h, 17.25 + a - 0.1]),
  ];
  return own([ring, ...marks], ring, { solid: [ring], cut: marks });
})();
/** The syringe, its needle up and to the left into the base: injected. */
const SYRINGE_P = (() => {
  const u = [-Math.SQRT1_2, -Math.SQRT1_2];
  const B = [20.5, 20.5];
  const hw = 1.5;
  const thumb = line(along(B, u, 0, -1.6), along(B, u, 0, 1.6));
  const rod = line(B, along(B, u, 3));
  const barrel = roundpoly([along(B, u, 3, -hw), along(B, u, 3, hw), along(B, u, 8.25, hw), along(B, u, 8.25, -hw)], 0.6);
  const needle = line(along(B, u, 8.25), along(B, u, 10.75));
  const d = [barrel, needle, rod, thumb];
  return own(d, hull(d), { solid: [barrel], wire: [needle, rod, thumb] });
})();
/** A zigzag crack laid over the base, `pts` its corners: broken. */
const crack = (pts) => {
  const d = line(...pts);
  return own([d], trace(d));
};
/**
 * The outline of a tube of half width `hw` along a path of arcs ({ c, r, a0, a1 }) and lines
 * ({ p0, p1 }), with round ends: a worm's body.
 */
function tube(segs, hw) {
  const left = [];
  const right = [];
  for (const g of segs) {
    if (g.c) {
      const cw = g.a1 > g.a0;
      const [rl, rr] = cw ? [g.r + hw, g.r - hw] : [g.r - hw, g.r + hw];
      left.push({ from: polar(...g.c, rl, g.a0), d: arcTo(...g.c, rl, g.a0, g.a1) });
      right.unshift({ from: polar(...g.c, rr, g.a1), d: arcTo(...g.c, rr, g.a1, g.a0) });
    } else {
      const L = Math.hypot(g.p1[0] - g.p0[0], g.p1[1] - g.p0[1]);
      const n = [(g.p1[1] - g.p0[1]) / L, -(g.p1[0] - g.p0[0]) / L];
      const off = (p, k) => [p[0] + n[0] * hw * k, p[1] + n[1] * hw * k];
      left.push({ from: off(g.p0, 1), d: `L${P(off(g.p1, 1))}` });
      right.unshift({ from: off(g.p1, -1), d: `L${P(off(g.p0, -1))}` });
    }
  }
  const cap = (a, b) => {
    const R = halfChord(a, b);
    return `A${R} ${R} 0 0 1 ${P(b)}`;
  };
  const end = (side) => {
    const last = side.at(-1);
    const m = last.d.match(/(-?[\d.]+) (-?[\d.]+)$/);
    return [Number(m[1]), Number(m[2])];
  };
  return `M${P(left[0].from)}${left.map((x) => x.d).join('')}${cap(end(left), right[0].from)}${right.map((x) => x.d).join('')}${cap(end(right), left[0].from)}Z`;
}
/** A lockpick reaching into the padlock's keyhole from the bottom right: picked. */
const PICK_P = (() => {
  const tip = [10.25, 14.5];
  const H = [21.25, 20.75];
  const v = [tip[0] - H[0], tip[1] - H[1]];
  const L = Math.hypot(...v);
  const u = [v[0] / L, v[1] / L];
  const handle = roundpoly([along(H, u, 0, -1.25), along(H, u, 0, 1.25), along(H, u, 4.5, 1.25), along(H, u, 4.5, -1.25)], 1.1);
  const shaft = line(along(H, u, 4.5), along(H, u, L - 0.9), along(H, u, L, -0.9));
  return own([handle, shaft], hull([handle, shaft]), { solid: [handle], wire: [shaft] });
})();

const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// ── Malware ───────────────────────────────────────────────────────────────────────────────────
// datos' bug is the malware; what happens to it is its badge
add('malware', ['malware', 'software malicioso', 'código malicioso', 'amenaza', 'malicious software', 'threat'], BUG_B, { badge: badge('alert') });
add('malware-blocked', ['malware bloqueado', 'amenaza detenida', 'bloqueado', 'malware blocked', 'threat blocked'], BUG_B, { badge: badge('block') });
add('bug-bounty', ['recompensa', 'caza de errores', 'programa de recompensas', 'bug bounty', 'reward', 'vulnerability reward'], BUG_B, { badge: COIN });
// Scanned and quarantined: the small bug as the subject, inside sistema's scan corners or a dashed ring
add('malware-scan', ['escanear malware', 'análisis', 'buscar amenazas', 'escaneo', 'malware scan', 'threat scan'], [SCAN, ...BUG_C.d]);
add('quarantine', ['cuarentena', 'aislar', 'aislamiento', 'contener', 'quarantine', 'isolate'], [...S['status-pending'].d, ...BUG_Q.d]);
// The padlock asks for the coin: pay to unlock
add('ransomware', ['ransomware', 'secuestro de datos', 'rescate', 'cifrado malicioso', 'ransom', 'extortion'], LOCK_B, { badge: COIN });
// An object with the bug badge: that object, infected (or, for a phone, bugged)
add('spyware', ['spyware', 'software espía', 'espionaje', 'vigilancia', 'spy', 'stalkerware'], EYE_B, { badge: BUG_BADGE });
add('adware', ['adware', 'anuncios maliciosos', 'publicidad invasiva', 'ventanas emergentes', 'ads', 'popups'], MEGAPHONE, { badge: BUG_BADGE });
// dispositivos' keyboard with its keys half a row up, only those clear of the bug at every weight (a
// key its clearance reached at bold only came and went) and no space bar: the bug takes that row
add('keylogger', ['keylogger', 'registro de teclas', 'teclado espiado', 'pulsaciones', 'keystroke logging', 'keyboard'], [
  KEYBOARD[0],
  ...[6, 9, 12, 15].map((x) => dot(x, 8.75, 0.3)),
  ...[7.5, 10.5].map((x) => dot(x, 11.75, 0.3)),
], { badge: BUG_BADGE });
add('malicious-usb', ['usb malicioso', 'memoria infectada', 'ataque usb', 'pendrive', 'malicious usb', 'usb drop'], USB, { badge: BUG_BADGE });
add('zero-day', ['día cero', 'vulnerabilidad desconocida', 'sin parche', 'exploit nuevo', 'zero-day', '0-day'], CAL, { badge: BUG_BADGE });
// The parcel without its front edge: the bug's clearance cut that edge short of the bottom corner,
// leaving a stub on it
add('payload', ['carga útil', 'carga maliciosa', 'entrega', 'paquete', 'payload', 'malicious cargo'], PARCEL.slice(0, 2), { badge: BUG_BADGE });
add('supply-chain-attack', ['ataque a la cadena de suministro', 'dependencia comprometida', 'proveedor', 'supply chain attack', 'dependency'], SUPPLY, { badge: BUG_BADGE });
// The bug beneath the system's layers: the lower layer runs behind it
{
  const b = smallBug(12, 18.3);
  add('rootkit', ['rootkit', 'malware oculto', 'nivel del sistema', 'capas', 'hidden malware', 'kernel'], LAYERS, { badge: own(b.d, hull(b.d), b.fill) });
}
add('cryptojacking', ['criptosecuestro', 'minería oculta', 'minado no autorizado', 'cryptojacking', 'hidden mining', 'cryptominer'], comercio.icons['crypto-mining'].d, { badge: BUG_BADGE });
// lugares' open door, 3 to the left and without its floor: its leaf stands clear of the bug and its
// frame runs into it (the floor ran along the bug's feet, cut at a different place at each weight)
const DOOR_OPEN = lugares.icons['door-open'].d.filter((_, i) => i !== 1).map((d) => move(d, 1, [12, 12], -3, 0));
add('backdoor', ['puerta trasera', 'acceso oculto', 'entrada secreta', 'backdoor', 'hidden access', 'trapdoor'], DOOR_OPEN, { badge: BUG_BADGE });
add('eavesdropping', ['escucha', 'intervención telefónica', 'micrófono oculto', 'eavesdropping', 'wiretap', 'bugged phone'], comunicacion.icons['phone-plus'].d.slice(0, 1), { badge: BUG_BADGE });
add('honeypot', ['honeypot', 'señuelo', 'trampa', 'tarro de miel', 'decoy', 'lure'], [
  sq(5.5, 3.75, 13, 3.5, 1.6),
  'M7 7.25C4.5 9 3.5 11.5 3.5 14C3.5 18.5 6.5 21 9.5 21L14.5 21C17.5 21 20.5 18.5 20.5 14C20.5 11.5 19.5 9 17 7.25Z',
  'M8.5 7.25V10A1.5 1.5 0 0 0 11.5 10V7.25',
], { badge: BUG_BADGE });
add('antivirus', ['antivirus', 'protección', 'antimalware', 'escudo', 'antivirus', 'malware protection'], SHIELD, { badge: BUG_BADGE });
// The worm: a body in segments that loops over and under and raises its head at the right
{
  const [c1, c2, r, hw] = [[8, 14.75], [16, 14.75], 4, 1.75];
  const body = tube([{ c: c1, r, a0: 180, a1: 360 }, { c: c2, r, a0: 180, a1: 0 }, { p0: [20, 14.75], p1: [20, 9.25] }], hw);
  const seg = (c, deg) => line(polar(...c, r - hw, deg), polar(...c, r + hw, deg));
  // Its rings evenly spaced along it (every 6.3, a twelfth of a turn's length short of each arch's ends)
  add('worm', ['gusano', 'gusano informático', 'autorreplicante', 'propagación', 'worm', 'self-replicating malware'], [body, seg(c1, 225), seg(c1, 315), seg(c2, 135), seg(c2, 45), line([20 - hw, 11.6], [20 + hw, 11.6])]);
}
// The wooden horse on its wheeled board: body, neck and head in one outline (a round barrel of a body,
// the neck rising to the poll and the head turned down to the muzzle), two legs down to the board and a
// wheel under each. (A boxier body with a raised tail read as a shopping cart.)
{
  const horse = roundpoly([[3.75, 9], [11.25, 9], [13.5, 3.75], [14.5, 2.75], [15.75, 3.5], [20.5, 8], [19.5, 9.75], [16.5, 9], [15.75, 12.75], [3.75, 12.75]], [1.85, 0.8, 0.4, 0.4, 0.6, 1, 0.8, 0.8, 1.85, 1.85]);
  const legs = [7, 13.25].map((x) => line([x, 12.75], [x, 17.25]));
  const board = line([3.5, 17.25], [17, 17.25]);
  const wheels = [7, 13.25].map((x) => circ(x, 19.1, 1.6));
  add('trojan-horse', ['troyano', 'caballo de troya', 'malware disfrazado', 'trojan', 'trojan horse', 'disguised malware'], [horse, ...legs, board, ...wheels]);
}

// Botnet: datos' network, its nodes taken over: the bug sits where its lower right node was
add('botnet', ['botnet', 'red de bots', 'equipos zombi', 'red infectada', 'zombie network', 'hijacked devices'], NETWORK, { badge: BUG_BADGE });

// ── Phishing and theft: the hook ──────────────────────────────────────────────────────────────
// The bait at the top left, at its own drawing scaled down; the hook comes down the right side and
// its point pierces the bait from below
const bait = (d, s, o, dx = 0, dy = 0) => d.map((p) => move(p, s, o, dx, dy));
// Each bait at the size that keeps its details clear of the hook at every weight (3.3 or more from it):
// the envelope's flap and the handset's earpiece came and went at 72 % (and at 70 % the flap ended 2.85
// from the envelope's edge)
add('phishing', ['phishing', 'suplantación', 'correo fraudulento', 'anzuelo', 'email scam', 'lure'], bait(MAIL, 0.71, [2.5, 3.25]), { badge: hooked });
add('smishing', ['smishing', 'sms fraudulento', 'mensaje falso', 'anzuelo', 'text scam', 'sms phishing'], [drop(9.25, 9.75, 6.75)], { badge: hooked });
add('vishing', ['vishing', 'llamada fraudulenta', 'estafa telefónica', 'anzuelo', 'voice phishing', 'phone scam'], bait(N.phone.d, 0.68, [3.25, 3.25]), { badge: hooked });
add('spear-phishing', ['phishing dirigido', 'ataque dirigido', 'objetivo', 'anzuelo', 'spear phishing', 'targeted attack'], bait(TARGET, 0.72, [3, 3]), { badge: hooked });
// The ID card at bait size: comunicacion's card and its portrait (a head over the shoulders), rebuilt
// at this size with the spacing of the full one (scaled, head and shoulders ran together at bold
// and the text lines ended too close to the edge); its lines are left out, the hook takes their side
{
  const [cx, sh, hr] = [7.75, 2.6, 1.6];
  const card = sq(2.5, 2.75, 13, 11, 3, { square: ['br'] });
  const head = circ(cx, 13.75 - sh - 2.45 - hr, hr);
  const shoulders = `M${f(cx - sh)} 13.75A${sh} ${sh} 0 0 1 ${f(cx + sh)} 13.75`;
  add('identity-theft', ['robo de identidad', 'identidad robada', 'credencial', 'fraude', 'identity theft', 'stolen identity'], [card, head, shoulders], { badge: hooked });
}
// The person on the hook: the people a con works on. The core person at bait size, its head and shoulders
// as far apart as the core's (scaled whole, they ran together at bold)
{
  const bust = place([PERSON[1]], 0.7, [12, 20.6], [8, 16.5])[0];
  add('social-engineering', ['ingeniería social', 'manipulación', 'engaño', 'persona engañada', 'social engineering', 'manipulation'], [circ(8, 6.4, 2.75), bust], { badge: hooked });
}
// The core key, turned to hang from the hook by its bow (a password field's dots sat where the hook's
// clearance takes them at some weights only)
add('credential-theft', ['robo de credenciales', 'contraseña robada', 'acceso robado', 'llave robada', 'credential theft', 'stolen password'],
  [N.key.d[0], N.key.d[2], N.key.d[3], N.key.d[4]].map((d) => move(flipPath(d, 'x'), 0.82, [15.9, 15.9], -3.65, -4.1)), { badge: hooked });
add('clickjacking', ['clickjacking', 'clic secuestrado', 'capa oculta', 'secuestro de clic', 'ui redress', 'hijacked click'], [cursor([4.25, 2.75], 0.66)], { badge: hooked });
add('session-hijack', ['secuestro de sesión', 'cookie robada', 'sesión robada', 'session hijacking', 'stolen cookie'], bait(COOKIE, 0.72, [3, 3]), { badge: hooked });
// ── Spoofing: the mask ────────────────────────────────────────────────────────────────────────
add('spoofing', ['suplantación', 'identidad falsa', 'disfraz', 'máscara', 'spoofing', 'impersonation'], MASK);
// The mask is the subject, up top; what it fakes is a smaller piece in front of its right lobe, standing
// on the bottom of the canvas so its clearance stops 3.5 or more below the mask's eye (closer, the eye
// was clipped at every weight)
{
  const env = place(MAIL, 0.55, [21.5, 19], [21.25, 21.25]);
  add('email-spoofing', ['correo suplantado', 'remitente falso', 'falsificación de correo', 'email spoofing', 'forged sender'], MASK_UP, { badge: front(env, [env[0]], [env[1]]) });
  // A small browser window: navegacion's, in landscape, its title bar at the same depth as the envelope's flap
  const win = [sq(11.5, 13.5, 9.75, 7.75, 2.25, { square: ['br'] }), line([11.5, 16.25], [21.25, 16.25])];
  add('website-spoofing', ['sitio falso', 'página suplantada', 'web clonada', 'website spoofing', 'fake site', 'clone site'], MASK_UP, { badge: front(win, [win[0]], [win[1]]) });
  const globe = place(N.globe.d, 4 / 9, [12, 12], BC);
  add('dark-web', ['dark web', 'web oscura', 'internet oculto', 'mercado ilegal', 'deep web', 'hidden internet'], MASK_UP, { badge: front(globe, [globe[0]], globe.slice(1)) });
}
// The mask plugged into the line between two ends: someone in the middle of the conversation
add('man-in-the-middle', ['intermediario', 'interceptación', 'ataque de intermediario', 'man in the middle', 'mitm', 'interception'], [circ(4.25, 19, 1.5), line([5.75, 19], [18.25, 19]), circ(19.75, 19, 1.5), line([12, 19], [12, 11])], { badge: masked(8.25) });
// A Wi-Fi fan in front of the mask: a rogue access point. dispositivos' wifi, its point and two arcs at
// 70 % (at 65 % its arcs ran together at bold), the point a dot of the set's size
{
  const arcs = place(dispositivos.icons.wifi.d.slice(1, 3), 0.7, [12, 18.5], [17, 20.25]);
  const wifi = [dot(17, 20.25), ...arcs];
  add('evil-twin', ['gemelo malvado', 'wifi falso', 'punto de acceso falso', 'evil twin', 'rogue access point', 'fake wifi'], MASK_UP, { badge: own(wifi, hull(wifi), { solid: [wifi[0]], wire: arcs }) });
}

// ── Attacks ───────────────────────────────────────────────────────────────────────────────────
// The bolt strikes: the system, the wall, the map
add('cyberattack', ['ciberataque', 'ataque', 'ataque informático', 'golpe', 'cyberattack', 'attack'], dispositivos.icons.desktop.d, { badge: BOLT_P });
add('exploit', ['exploit', 'explotar vulnerabilidad', 'aprovechar falla', 'código de ataque', 'attack code', 'weakness'], WALL_B, { badge: BOLT_P });
add('threat-map', ['mapa de amenazas', 'ataques en vivo', 'regiones', 'threat map', 'attack map', 'live attacks'], lugares.icons.map.d, { badge: BOLT_P });
// The crack: the wall, the database, the seal
add('vulnerability', ['vulnerabilidad', 'debilidad', 'grieta', 'falla de seguridad', 'vulnerability', 'weakness'], SHIELD, { badge: crack([[12.5, 3.1], [10.5, 8.5], [13.5, 13], [11.25, 17], [12, 21.35]]) });
// The crack runs down from the top of the store and stops inside it: right through, it split the fill in
// two halves too alike to tell apart from one weight to the next
add('data-breach', ['filtración de datos', 'brecha de datos', 'datos expuestos', 'data breach', 'breach', 'leak'], DB, { badge: crack([[13.25, 2.25], [10.5, 7], [13.5, 11.25], [11, 16.25]]) });
// A wax seal split in two along a zigzag, its halves pulled apart: legal's wax seal built on ten even
// lobes (its own seven, uneven, made a pair of halves that read as a brain), at 90 %, each half its own
// smooth run, and the ring it was stamped with cut in two with it. (A crack drawn across formas' seal
// read as a pair of braces.)
{
  const pts = Array.from({ length: 40 }, (_, i) => polar(12, 12, (8.6 + 0.55 * Math.cos((i * Math.PI) / 2)) * 0.9, i * 9 - 90));
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const run = (a, b) => {
    let o = '';
    for (let i = a; i < b; i++) {
      const [p0, p1, p2, p3] = [pts[(i + 39) % 40], pts[i % 40], pts[(i + 1) % 40], pts[(i + 2) % 40]];
      const [t1, t2] = [sub(p2, p0), sub(p3, p1)];
      o += `C${P([p1[0] + t1[0] / 6, p1[1] + t1[1] / 6])} ${P([p2[0] - t2[0] / 6, p2[1] - t2[1] / 6])} ${P(p2)}`;
    }
    return o;
  };
  const zig = [pts[0], [10.88, 7.95], [13.13, 12.0], [11.1, 15.83], pts[20]];
  const right = `M${P(pts[0])}${run(0, 20)}${zig.slice(0, -1).reverse().map((p) => `L${P(p)}`).join('')}Z`;
  const left = `M${P(pts[20])}${run(20, 40)}${zig.slice(1).map((p) => `L${P(p)}`).join('')}Z`;
  // The ring (r 4.6) meets the zigzag where it crosses its first and last legs
  const meet = (a, b) => {
    const [d, m] = [sub(b, a), sub(a, [12, 12])];
    const [A, B, C] = [d[0] ** 2 + d[1] ** 2, 2 * (m[0] * d[0] + m[1] * d[1]), m[0] ** 2 + m[1] ** 2 - 4.25 ** 2];
    const u = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
    return [a[0] + d[0] * u, a[1] + d[1] * u];
  };
  const [h1, h2] = [meet(zig[1], zig[0]), meet(zig[3], zig[4])];
  const ringR = `M${P(h1)}A4.25 4.25 0 0 1 ${P(h2)}`;
  const ringL = `M${P(h2)}A4.25 4.25 0 0 1 ${P(h1)}`;
  const [L, R] = [[left, ringL].map((d) => move(d, 1, [12, 12], -1.75, 0.6)), [right, ringR].map((d) => move(d, 1, [12, 12], 1.75, -0.6))];
  add('tamper-seal', ['sello de seguridad', 'sello roto', 'manipulación', 'evidencia', 'tamper seal', 'tamper evident'], [L[0], R[0], L[1], R[1]]);
  // At 16 px the ring's halves ran into the lobes: the two halves alone, on the pixel grid
  const sn = snapper([L[0], R[0]]);
  icons['tamper-seal'].small = { d: [sn(L[0]), sn(R[0])], fill: { solid: [sn(L[0]), sn(R[0])] } };
}
// The syringe: into the database, into the page
add('injection', ['inyección', 'inyección sql', 'consulta maliciosa', 'injection', 'sql injection', 'malicious query'], DB, { badge: SYRINGE_P });
add('script-injection', ['inyección de scripts', 'xss', 'script malicioso', 'cross-site scripting', 'script injection', 'malicious script'], navegacion.icons.browser.d, { badge: SYRINGE_P });
// Forced, picked, escalated
add('brute-force', ['fuerza bruta', 'adivinar contraseña', 'intentos', 'brute force', 'password guessing', 'cracking'], LOCK_B, { badge: HAMMER_P });
// The pick takes the keyhole's place: the padlock without it, so no stub of it is left beside the pick
add('penetration-test', ['prueba de penetración', 'pentest', 'hackeo ético', 'ganzúa', 'penetration test', 'ethical hacking'], LOCK_B.slice(0, 2), { badge: PICK_P });
add('privilege-escalation', ['escalada de privilegios', 'elevar permisos', 'acceso de administrador', 'privilege escalation', 'elevation', 'root access'], S['key-plus'].d, { badge: badge('arrow-up') });
// The hooded figure behind a laptop
{
  // The hood's lower half goes wholly behind the lid's clearance
  const hood = mirrored(12, 12, 1, [0, -9.5], [[[1.75, -9.25], [6, -7.25], [6.75, -3]], [[7.25, 0], [7.25, 4], [7.25, 8.75]], [[4.85, 8.75], [2.4, 8.75], [0, 8.75]]]);
  const lid = sq(6, 14.5, 12, 6.25, 2, { square: ['br'] });
  const base = line([3.75, 20.75], [20.25, 20.75]);
  add('hacker', ['hacker', 'atacante', 'ciberdelincuente', 'encapuchado', 'threat actor', 'attacker'], [hood, circ(12, 9, 3)], { badge: own([lid, base], hull([lid, base]), { solid: [lid], wire: [base] }) });
}
add('compromised-account', ['cuenta comprometida', 'cuenta robada', 'usuario hackeado', 'compromised account', 'account takeover'], comunicacion.icons['person-plus'].d, { badge: badge('alert') });
add('insider-threat', ['amenaza interna', 'empleado malicioso', 'riesgo interno', 'insider threat', 'malicious insider', 'internal risk'], comunicacion.icons['id-badge'].d, { badge: badge('alert') });
// Many requests at once: three arrows into one server. datos' server, narrowed to make room for them
// (its two racks keep their height, corners and spacing, so the slot and the light keep 3 from the
// edges; scaled as a whole, the slot ended 2.4 from them)
{
  const rack = (y) => [sq(9.25, y, 12, 6.5, 2, { square: ['br'] }), line([12.25, y + 3.25], [14.5, y + 3.25]), dot(18.25, y + 3.25)];
  const [r1, r2] = [rack(4), rack(13.5)];
  const server = [r1[0], r2[0], r1[1], r1[2], r2[1], r2[2]];
  const arrow = (y) => [line([2.75, y], [6.25, y]), line([4.75, y - 1.5], [6.25, y], [4.75, y + 1.5])];
  add('traffic-flood', ['inundación de tráfico', 'ddos', 'denegación de servicio', 'saturación', 'traffic flood', 'denial of service'], [...server, ...arrow(6), ...arrow(12), ...arrow(18)]);
}
add('port-scan', ['escaneo de puertos', 'puertos abiertos', 'sondeo', 'reconocimiento', 'port scan', 'probe'], [SCAN, move(dispositivos.icons.ethernet.d[1], 1, [12, 12], 0, -0.1)]);

// ── Data ──────────────────────────────────────────────────────────────────────────────────────
add('data-leak', ['fuga de datos', 'filtración', 'goteo', 'pérdida de datos', 'data leak', 'leakage'], DB, { badge: DROP_P });
add('data-loss-prevention', ['prevención de pérdida de datos', 'dlp', 'proteger datos', 'data loss prevention', 'data protection'], DB, { badge: SHIELD_P });
// The data's hash, the proof it is unaltered: the database with the hash badge of hashing (database-check,
// datos', already says "verified")
add('data-integrity', ['integridad de datos', 'datos inalterados', 'verificación de datos', 'hash', 'data integrity', 'unaltered data'], DB, { badge: HASH_P });
// datos' braces around sistema's asterisk, at 90 % up and left: the right brace's point stood just
// outside the badge's clearance, an island of it left beside the badge
add('exposed-secret', ['secreto expuesto', 'clave filtrada', 'credencial en código', 'exposed secret', 'leaked key', 'hardcoded secret'],
  [D.variable.d[0], D.variable.d[1], ...S.asterisk.d.map((d) => move(d, 0.5, [12, 12]))].map((d) => move(d, 0.9, [2.5, 4.75], 0, -1.5)), { badge: badge('alert') });

// ── Encryption and integrity ──────────────────────────────────────────────────────────────────
// Ciphertext is the hidden field (sistema's password): locked, it is encrypted; unlocked, decrypted
add('encryption', ['cifrado', 'encriptar', 'cifrar', 'texto cifrado', 'encryption', 'encrypt'], PASSWORD_UP, { badge: badge('lock') });
add('decryption', ['descifrado', 'desencriptar', 'descifrar', 'texto claro', 'decryption', 'decrypt'], PASSWORD_UP, { badge: UNLOCK_P });
add('hashing', ['hash', 'función hash', 'huella digital', 'resumen', 'hashing', 'digest'], DOC.slice(0, 3), { badge: HASH_P });
// comunicacion's hash sign, checked: a hash that matches
add('checksum', ['suma de verificación', 'verificar hash', 'integridad de archivo', 'checksum', 'hash check', 'verify file'], comunicacion.icons.hashtag.d, { badge: badge('check') });
add('digital-signature', ['firma digital', 'firma electrónica', 'autenticidad', 'firma criptográfica', 'digital signature', 'signing'], edicion.icons['signature-line'].d, { badge: badge('lock') });
add('chain-of-trust', ['cadena de confianza', 'cadena de certificados', 'confianza', 'chain of trust', 'certificate chain', 'trust'], N.link.d, { badge: badge('check') });
add('secure-transfer', ['transferencia segura', 'envío cifrado', 'intercambio seguro', 'secure transfer', 'encrypted transfer', 'sftp'], navegacion.icons['swap-horizontal'].d, { badge: badge('lock') });

// ── Access and secrets ────────────────────────────────────────────────────────────────────────
// The keyhole means access: on a ticket, a card, a document
add('access-token', ['token de acceso', 'pase', 'credencial', 'portador', 'access token', 'bearer token'], [N.ticket.d[0], N.ticket.d[1], N.ticket.d[2], move(KEYHOLE, 1, [12, 12], -3, 0)]);
add('access-card', ['tarjeta de acceso', 'tarjeta llave', 'credencial de entrada', 'access card', 'key card', 'badge'], [N.card.d[0], N.card.d[2], move(KEYHOLE, 1, [12, 12], 4.5, 0)]);
add('security-policy', ['política de seguridad', 'normas', 'reglas de seguridad', 'security policy', 'rules', 'governance'], [DOC[0], KEYHOLE]);
// dispositivos' USB drive with a keyhole on its face: a hardware security key. The keyhole is the
// solid one (a dot over a stem, cut out when filled): sistema's outlined keyhole, at the size the
// drive's face allows, closed up inside at some weights and ran into the drive's sides at bold
add('security-key', ['llave de seguridad', 'llave física', 'fido', 'u2f', 'security key', 'hardware key'], [USB[0], USB[1], dot(12, 13.75), line([12, 14.45], [12, 17])]);
// comercio's safe with the password's dots on its door
{
  const safe = comercio.icons['safe-box'].d;
  add('credential-vault', ['bóveda de credenciales', 'gestor de contraseñas', 'secretos', 'credential vault', 'password manager', 'secrets'], [safe[0], dot(6.25, 11), dot(10, 11), dot(13.75, 11), safe[5], safe[6], safe[7]]);
}
add('secure-boot', ['arranque seguro', 'inicio verificado', 'firmware firmado', 'secure boot', 'verified boot', 'trusted boot'], dispositivos.icons.power.d, { badge: badge('lock') });
add('zero-trust', ['confianza cero', 'nunca confiar', 'verificar siempre', 'zero trust', 'never trust', 'verify'], comunicacion.icons.handshake.d, { badge: badge('block') });
// The door, locked: who may come in
add('access-control', ['control de acceso', 'puerta cerrada', 'entrada', 'permisos', 'access control', 'gatekeeping'], lugares.icons.door.d, { badge: badge('lock') });
add('allowlist', ['lista permitida', 'lista blanca', 'aprobados', 'allowlist', 'whitelist', 'approved'], LIST, { badge: badge('check') });
add('blocklist', ['lista de bloqueo', 'lista negra', 'denegados', 'blocklist', 'blacklist', 'denied'], LIST, { badge: badge('block') });
add('watchlist', ['lista de vigilancia', 'en observación', 'seguimiento', 'watchlist', 'monitored', 'watch'], LIST, { badge: EYE_P });

// ── Defense ───────────────────────────────────────────────────────────────────────────────────
add('endpoint-security', ['seguridad de endpoints', 'equipo protegido', 'protección del dispositivo', 'endpoint security', 'device protection'], dispositivos.icons.laptop.d, { badge: SHIELD_P });
add('hardening', ['endurecimiento', 'reforzar', 'blindaje', 'fortalecer', 'hardening', 'strengthen'], WALL_B, { badge: SHIELD_P });
// archivos' clipboard, bare: the list's rows ran into the shield's clearance, leaving stubs and caps
// The shield clears its own outline here: under the circle's cut, the clipboard's board split differently
// from one weight to the next
add('security-audit', ['auditoría de seguridad', 'revisión', 'controles', 'cumplimiento', 'security audit', 'review'], archivos.icons.clipboard.d, { badge: own(SHIELD_P.d, hull(SHIELD_P.d), SHIELD_P.fill) });
add('security-update', ['actualización de seguridad', 'parche', 'actualizar', 'security update', 'patch', 'update'], SHIELD, { badge: badge('sync') });
add('remediation', ['remediación', 'corrección', 'reparar vulnerabilidad', 'parchear', 'remediation', 'fix'], WALL_B, { badge: PATCH_P });
// The hard drive as archivos puts it under a badge (hard-drive-alert): its body and its platter
add('secure-erase', ['borrado seguro', 'eliminar datos', 'formatear', 'limpiar disco', 'secure erase', 'wipe'], archivos.icons['hard-drive-alert'].d, { badge: ERASER_P });
// Air gap: datos' network (its hub and nodes) with one node cut off: the spoke toward it stops short,
// a gap of air between them
{
  const [hub, top, left, cut] = [[11, 12.75], [11, 5], [4.25, 17], [19.5, 18.25]];
  const unit = (a, b) => {
    const [x, y] = [b[0] - a[0], b[1] - a[1]];
    const L = Math.hypot(x, y);
    return [x / L, y / L];
  };
  const spoke = (b, rb, len) => {
    const u = unit(hub, b);
    return line([hub[0] + u[0] * 2.5, hub[1] + u[1] * 2.5], len ? [hub[0] + u[0] * (2.5 + len), hub[1] + u[1] * (2.5 + len)] : [b[0] - u[0] * rb, b[1] - u[1] * rb]);
  };
  add('air-gap', ['brecha de aire', 'aislamiento físico', 'equipo desconectado', 'red aislada', 'air gap', 'isolated network', 'offline system'],
    [circ(...hub, 2.5), circ(...top, 2.25), circ(...left, 2.25), circ(...cut, 2.25), spoke(top, 2.25), spoke(left, 2.25), spoke(cut, 0, 2.5)]);
}
// navegacion's sign-in at 80 % up and left: its arrow ends clear of the badge at every weight
// (its frame without the bottom edge, which ran into the badge and left the cap of its end beside it)
add('suspicious-login', ['inicio de sesión sospechoso', 'acceso extraño', 'alerta de acceso', 'suspicious login', 'unusual sign-in'],
  [navegacion.icons['log-in'].d[0].replace(/L13\.25 20\.75$/, ''), ...navegacion.icons['log-in'].d.slice(1)].map((d) => move(d, 0.8, [2.5, 2.5])), { badge: badge('alert') });
// sistema's open padlock moved up and left as its padlock is under a badge (lock-clock, lock-alert)
const LOCK_OPEN_B = S['lock-open'].d.map((d) => move(d, 1, [12, 12], -0.25, -1));
add('insecure-connection', ['conexión insegura', 'no seguro', 'sin cifrar', 'http', 'insecure connection', 'not secure'], LOCK_OPEN_B, { badge: badge('alert') });
add('misconfiguration', ['mala configuración', 'configuración insegura', 'ajuste incorrecto', 'misconfiguration', 'wrong setting'], S.gear.d, { badge: badge('alert') });
// sistema's radar 1 up and left: its pivot clear of the badge (at the center it sat 3.2 from it)
const RADAR_B = S.radar.d.map((d) => move(d, 1, [12, 12], -1, -1));
add('intrusion-detection', ['detección de intrusos', 'ids', 'alerta de intrusión', 'radar', 'intrusion detection', 'detect'], RADAR_B, { badge: badge('alert') });
// lugares' footprints at 90 %, up and left, the magnifier in the place of the last heel (cut by it, a
// sliver of the heel was left beside the lens)
add('threat-hunting', ['caza de amenazas', 'rastreo', 'búsqueda proactiva', 'huellas', 'threat hunting', 'tracking'], lugares.icons.footprints.d.slice(0, 3).map((d) => move(d, 0.9, [2.75, 2.75], -0.5, -0.5)), { badge: badge('search') });
// The fingerprint as sistema puts it under a badge (fingerprint-plus)
add('digital-forensics', ['análisis forense', 'forense digital', 'investigación', 'evidencia', 'digital forensics', 'investigation'], S['fingerprint-plus'].d, { badge: badge('search') });
// datos' log with the lines of its lower rows left out: the padlock covers them, all but a stub
add('audit-log', ['registro de auditoría', 'bitácora', 'eventos de seguridad', 'audit log', 'event log', 'trail'], D.log.d.filter((_, i) => i !== 4 && i !== 6), { badge: badge('lock') });
add('immutable-backup', ['respaldo inmutable', 'copia protegida', 'respaldo inalterable', 'immutable backup', 'locked backup'], archivos.icons.backup.d, { badge: badge('lock') });
add('incident-response', ['respuesta a incidentes', 'emergencia', 'alarma', 'atender incidente', 'incident response', 'alert'], S.siren.d, { badge: badge('check') });

// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// Each icon's fill, from its own strokes (see DESIGN.md › Fill). Numbers are indices into `d`;
// `n + 'Z'` closes an open stroke that encloses a body (a bug's head, a handle's loop).
const FILL = {
  'malware-scan': { solid: [1, 2], cut: [3], wire: [4, 5, 6, 7], lines: [0] },
  quarantine: { solid: [8, 9], cut: [10], wire: [11, 12, 13, 14], lines: [0, 1, 2, 3, 4, 5, 6, 7] },
  rootkit: { solid: [0], lines: [1] },
  keylogger: { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  backdoor: { solid: ['1Z'], wire: [0] },
  'penetration-test': { solid: [0], wire: [1] },
  payload: { solid: [0], cut: [1] },
  'audit-log': { solid: [0], cut: [1, 2, 3, 4] },
  'insecure-connection': { solid: [0], wire: [1], cut: [2] },
  'intrusion-detection': { solid: [0], cut: [1, 2, 3] },
  'threat-hunting': { solid: [0, 1, 2] },
  eavesdropping: { solid: [0] },
  honeypot: { solid: [0, 1], cut: [2, 'M5 7.25L19 7.25'] },
  antivirus: { solid: [0] },
  worm: { solid: [0], cut: [1, 2, 3, 4, 5] },
  'trojan-horse': { solid: [0, 4, 5], wire: [1, 2, 3] },
  'air-gap': { solid: [0, 1, 2, 3], wire: [4, 5, 6] },
  phishing: { solid: [0], cut: [1] },
  smishing: { solid: [0] },
  vishing: { solid: [0] },
  'spear-phishing': { solid: [0], cut: [1, 2] },
  'social-engineering': { solid: [0, 1] },
  'identity-theft': { solid: [0], cut: [1, 2] },
  'credential-theft': { solid: [0], wire: [1, 2, 3] },
  clickjacking: { solid: [0] },
  'session-hijack': { solid: [0], cut: [1, 2, 3, 4] },
  spoofing: { solid: [0], cut: [1, 2] },
  'email-spoofing': { solid: [0], cut: [1, 2] },
  'website-spoofing': { solid: [0], cut: [1, 2] },
  'dark-web': { solid: [0], cut: [1, 2] },
  'man-in-the-middle': { solid: [0, 2], wire: [1, 3] },
  'evil-twin': { solid: [0], cut: [1, 2] },
  vulnerability: { solid: [0] },
  'tamper-seal': { solid: [0, 1], cut: [2, 3] },
  encryption: { solid: [0], cut: [1, 2, 3] },
  decryption: { solid: [0], cut: [1, 2, 3] },
  'security-update': { solid: [0] },
  hacker: { solid: [0], cut: [1] },
  'traffic-flood': { solid: [0, 1], cut: [2, 3, 4, 5], lines: [6, 7, 8, 9, 10, 11] },
  'port-scan': { solid: [1], lines: [0] },
  hashing: { solid: [0], cut: [1, 2] },
  'access-token': { solid: [0], cut: [1, 2, 3] },
  'access-card': { solid: [0], cut: [1, 2] },
  'security-policy': { solid: [0], cut: [1] },
  'security-key': { solid: [0, '1Z'], cut: [2, 3] },
  'credential-vault': { solid: [0], cut: [1, 2, 3, 4], wire: [5, 6] },
  'supply-chain-attack': { solid: [0], cut: [1], lines: [2, 3, 4] },
  botnet: { solid: [0, 3, 4], wire: [1, 2] },
};
for (const name of ['malware', 'malware-blocked', 'bug-bounty']) FILL[name] = { solid: [0, '1Z'], cut: [2], wire: [3, 4] };
for (const [name, spec] of Object.entries(FILL)) {
  const at = (x) => (typeof x === 'number' ? icons[name].d[x] : /^\d+Z$/.test(x) ? `${icons[name].d[Number.parseInt(x, 10)]}Z` : x);
  icons[name].fill = Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, v.map(at)]));
}
// Bases adopted whole keep their own fill
const SAME = {
  ransomware: S['lock-clock'],
  spyware: S['eye-lock'],
  adware: comunicacion.icons.megaphone,
  'malicious-usb': dispositivos.icons['usb-drive'],
  'zero-day': calendario.icons['calendar-coin'],
  cryptojacking: comercio.icons['crypto-mining'],
  cyberattack: dispositivos.icons.desktop,
  'threat-map': lugares.icons.map,
  'script-injection': navegacion.icons.browser,
  'brute-force': S['lock-clock'],
  'privilege-escalation': S['key-plus'],
  'compromised-account': comunicacion.icons['person-plus'],
  'insider-threat': comunicacion.icons['id-badge'],
  'zero-trust': comunicacion.icons.handshake,
  'access-control': lugares.icons.door,
  'endpoint-security': dispositivos.icons.laptop,
  'security-audit': archivos.icons.clipboard,
  'secure-erase': archivos.icons['hard-drive-alert'],
  misconfiguration: S.gear,
  'immutable-backup': archivos.icons.backup,
  'incident-response': S.siren,
};
for (const name of ['data-breach', 'injection', 'data-leak', 'data-loss-prevention', 'data-integrity']) SAME[name] = D['database-plus'];
for (const [name, from] of Object.entries(SAME)) icons[name].fill = from.fill;
// Open lines only, or a base that is all lines: the filled version is the outline
for (const name of ['exploit', 'hardening', 'remediation', 'exposed-secret', 'digital-signature', 'chain-of-trust', 'secure-transfer', 'secure-boot', 'allowlist', 'blocklist', 'watchlist', 'suspicious-login', 'digital-forensics', 'checksum'])
  icons[name].fill = false;

// ── Parts ─────────────────────────────────────────────────────────────────────────────────────
// What animates or carries a badge gets a name; the badge itself is always `badge`
const PARTS = {
  'malware-scan': { frame: [0], body: [1, 2, 3], legs: [4, 5, 6, 7] },
  quarantine: { ring: [0, 1, 2, 3, 4, 5, 6, 7], body: [8, 9, 10], legs: [11, 12, 13, 14] },
  worm: { body: [0, 1, 2, 3, 4, 5] },
  'trojan-horse': { body: [0, 1, 2, 3], wheels: [4, 5] },
  'traffic-flood': { server: [0, 1, 2, 3, 4, 5], arrows: [6, 7, 8, 9, 10, 11] },
  'intrusion-detection': { face: [0, 1, 3], needle: [2] },
  misconfiguration: { gear: [0, 1] },
  'incident-response': { siren: [0, 1], rays: [2, 3, 4] },
};
for (const name of ['malware', 'malware-blocked', 'bug-bounty']) PARTS[name] = { body: [0, 1, 2], legs: [3, 4] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;
// Any other icon with a badge names its base as a whole
for (const icon of Object.values(icons)) if (icon.badge && !icon.parts) icon.parts = { body: icon.d.map((_, i) => i) };

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
for (const name of ['malware', 'malware-blocked', 'bug-bounty']) icons[name].motion = { effect: 'wiggle', parts: ['body', 'legs'], origin: [12, 14] };
// The hook tugs at its bait
for (const name of ['phishing', 'smishing', 'vishing', 'spear-phishing', 'identity-theft', 'credential-theft', 'clickjacking', 'session-hijack', 'social-engineering'])
  icons[name].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -2] };
// The bolt strikes
for (const name of ['cyberattack', 'exploit', 'threat-map']) icons[name].motion = { effect: 'beat', parts: ['badge'], origin: [17.25, 17.25] };
icons.worm.motion = { effect: 'wiggle', origin: [12, 19] };
icons['trojan-horse'].motion = { effect: 'slide', vector: [2, 0] };
icons.quarantine.motion = { effect: 'spin', parts: ['ring'], origin: [12, 12] };
icons['traffic-flood'].motion = { effect: 'slide', parts: ['arrows'], vector: [1.5, 0] };
icons['intrusion-detection'].motion = { effect: 'spin', parts: ['needle'], origin: [11, 11] };
icons.misconfiguration.motion = { effect: 'spin', parts: ['gear'], origin: [12, 12] };
icons['security-update'].motion = { effect: 'spin', parts: ['badge'], origin: [17.25, 17.25] };
icons['incident-response'].motion = { effect: 'beat', parts: ['siren', 'rays'], origin: [12, 17] };
icons.injection.motion = { effect: 'slide', parts: ['badge'], vector: [-1.5, -1.5] };
icons['script-injection'].motion = { effect: 'slide', parts: ['badge'], vector: [-1.5, -1.5] };
icons['brute-force'].motion = { effect: 'wiggle', parts: ['badge'], origin: [21, 21] };
icons['secure-erase'].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 17.25] };
icons['data-leak'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, 2] };
icons['privilege-escalation'].motion = { effect: 'slide', parts: ['badge'], vector: [0, -1.5] };
icons.antivirus.motion = { effect: 'beat', origin: [12, 12] };
icons.eavesdropping.motion = { effect: 'ring', parts: ['body'], origin: [8.5, 3.5] };

// ── 16 px ─────────────────────────────────────────────────────────────────────────────────────
// The keylogger as dispositivos' keyboard draws itself at 16 px (its keys short dashes: its dots ran into
// a block there), only the keys clear of the bug, with the bug badge on the pixel grid as the engine
// snaps a custom badge
{
  const k = dispositivos.icons.keyboard.small.d;
  const d = [k[0], k[1], k[2], k[3], k[4]];
  const sn = snapper([...BUG_BADGE.d, BUG_BADGE.knock]);
  const bug = { d: BUG_BADGE.d.map(sn), knock: sn(BUG_BADGE.knock), fill: Object.fromEntries(Object.entries(BUG_BADGE.fill).map(([key, v]) => [key, v.map(sn)])) };
  icons.keylogger.small = { d, fill: { solid: [d[0]], cut: d.slice(1) }, badge: bug };
}

// ── Mirror ────────────────────────────────────────────────────────────────────────────────────
// Read in a direction: the megaphone, the signature, signing in, the arrows into the server
for (const name of ['adware', 'digital-signature', 'suspicious-login', 'traffic-flood']) icons[name].mirror = true;

// ── Variants ──────────────────────────────────────────────────────────────────────────────────
// Already enclosed: a ring, a dial, scan corners, a seal
for (const name of ['quarantine', 'intrusion-detection', 'tamper-seal', 'spear-phishing']) icons[name].variants = { circle: false };
for (const name of ['malware-scan', 'port-scan']) icons[name].variants = { square: false };
// Already blocked: a slash on top says nothing
for (const name of ['malware-blocked', 'blocklist', 'zero-trust']) icons[name].variants = { ...icons[name].variants, slash: false };

export default { category: 'ciberseguridad', label: 'Ciberseguridad', icons };
