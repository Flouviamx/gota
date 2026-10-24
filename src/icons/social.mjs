// Social y comunidad (social and community): posts and feeds, stories and short video, reactions
// beyond the thumbs, profiles and people, groups and communities, polls, votes, reviews and the
// moderation around them. Everything is computed with the engine (engine/geometry.mjs) on the rules
// in DESIGN.md. The people are comunicacion's (Núcleo's person and the `people` group, never a new
// one); the post is the set's card with the signature corner, an avatar and a name line; badges are
// the engine's, and any piece that sits on top of another (a pin, a sparkle, the front card) is a
// custom badge the engine clears with exact clearance: nothing is trimmed by hand.
import { arc, badge, circ, dot, drop, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import comercio from './comercio.mjs';
import comunicacion from './comunicacion.mjs';
import datos from './datos.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';

// ── Paths as segments ─────────────────────────────────────────────────────────────────────────
// parse() turns an engine `d` into absolute segments (L, C, A) and ser() turns them back. clip()
// keeps the parts of a path where a rule holds: that's how a shape behind another stops at exactly
// 3 center to center from it (behind()), the way the core `clients` draws its second person.
const P = (p) => `${f(p[0])} ${f(p[1])}`;
const near = (a, b, e = 0.02) => Math.hypot(a[0] - b[0], a[1] - b[1]) < e;

function arcSeg(p0, p1, r, large, sweep) {
  const x1 = (p0[0] - p1[0]) / 2;
  const y1 = (p0[1] - p1[1]) / 2;
  const lam = (x1 * x1 + y1 * y1) / (r * r);
  if (lam > 1) r *= Math.sqrt(lam);
  const num = r * r * r * r - r * r * y1 * y1 - r * r * x1 * x1;
  const den = r * r * y1 * y1 + r * r * x1 * x1;
  const k = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den));
  const c = [k * y1 + (p0[0] + p1[0]) / 2, -k * x1 + (p0[1] + p1[1]) / 2];
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let da = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  if (sweep && da < 0) da += 2 * Math.PI;
  if (!sweep && da > 0) da -= 2 * Math.PI;
  if (Math.abs(da) < 1e-9 && large) da = sweep ? 2 * Math.PI : -2 * Math.PI;
  return { t: 'A', c, r, a0, da };
}

function parse(d) {
  const tk = d.match(/[MmLlHhVvCcSsAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const subs = [];
  let [sp, i, cmd, x, y, sx, sy, lc] = [null, 0, '', 0, 0, 0, 0, null];
  const n = () => Number.parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd !== cmd.toUpperCase();
    const C = cmd.toUpperCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    if (C === 'Z') {
      if (sp) {
        if (!near([x, y], [sx, sy], 1e-6)) sp.segs.push({ t: 'L', a: [x, y], b: [sx, sy] });
        sp.closed = true;
      }
      [x, y, lc, sp] = [sx, sy, null, null];
      continue;
    }
    if (C === 'M') {
      x = ox + n();
      y = oy + n();
      [sx, sy] = [x, y];
      sp = { segs: [], closed: false };
      subs.push(sp);
      cmd = rel ? 'l' : 'L';
      lc = null;
      continue;
    }
    if (!sp) {
      sp = { segs: [], closed: false };
      subs.push(sp);
      [sx, sy] = [x, y];
    }
    const a = [x, y];
    if (C === 'L' || C === 'H' || C === 'V') {
      if (C === 'L') {
        x = ox + n();
        y = oy + n();
      } else if (C === 'H') x = ox + n();
      else y = oy + n();
      sp.segs.push({ t: 'L', a, b: [x, y] });
      lc = null;
    } else if (C === 'C' || C === 'S') {
      const p1 = C === 'C' ? [ox + n(), oy + n()] : lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
      const p2 = [ox + n(), oy + n()];
      const p3 = [ox + n(), oy + n()];
      sp.segs.push({ t: 'C', p: [a, p1, p2, p3] });
      lc = p2;
      [x, y] = p3;
    } else if (C === 'A') {
      const r = n();
      n();
      n();
      const large = n();
      const sweep = n();
      const b = [ox + n(), oy + n()];
      sp.segs.push(arcSeg(a, b, r, large, sweep));
      [x, y] = b;
      lc = null;
    }
  }
  return subs;
}

function pt(s, t) {
  if (s.t === 'L') return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t];
  if (s.t === 'A') {
    const g = s.a0 + s.da * t;
    return [s.c[0] + s.r * Math.cos(g), s.c[1] + s.r * Math.sin(g)];
  }
  const [p0, p1, p2, p3] = s.p;
  const u = 1 - t;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return [w[0] * p0[0] + w[1] * p1[0] + w[2] * p2[0] + w[3] * p3[0], w[0] * p0[1] + w[1] * p1[1] + w[2] * p2[1] + w[3] * p3[1]];
}

function splitC(p, t) {
  const L = (a, b) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const [a, b, c] = [L(p[0], p[1]), L(p[1], p[2]), L(p[2], p[3])];
  const [d, e] = [L(a, b), L(b, c)];
  const m = L(d, e);
  return [
    [p[0], a, d, m],
    [m, e, c, p[3]],
  ];
}

function sub(s, t0, t1) {
  if (s.t === 'L') return { t: 'L', a: pt(s, t0), b: pt(s, t1) };
  if (s.t === 'A') return { ...s, a0: s.a0 + s.da * t0, da: s.da * (t1 - t0) };
  let p = s.p;
  if (t1 < 1) p = splitC(p, t1)[0];
  if (t0 > 0) p = splitC(p, t0 / t1)[1];
  return { t: 'C', p };
}

const segLen = (s) => {
  let [n, a] = [0, pt(s, 0)];
  for (let k = 1; k <= 16; k++) {
    const b = pt(s, k / 16);
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
    a = b;
  }
  return n;
};

function segD(s) {
  if (s.t === 'L') return `L${P(s.b)}`;
  if (s.t === 'C') return `C${P(s.p[1])} ${P(s.p[2])} ${P(s.p[3])}`;
  if (Math.abs(s.da) > Math.PI * 1.98) return segD(sub(s, 0, 0.5)) + segD(sub(s, 0.5, 1));
  return `A${f(s.r)} ${f(s.r)} 0 ${Math.abs(s.da) > Math.PI ? 1 : 0} ${s.da > 0 ? 1 : 0} ${P(pt(s, 1))}`;
}

function ser(subs) {
  let o = '';
  for (const sp of subs) {
    if (!sp.segs.length) continue;
    let last = pt(sp.segs[0], 0);
    o += `M${P(last)}`;
    for (const s of sp.segs) {
      if (!near(pt(s, 0), last)) o += `M${P(pt(s, 0))}`;
      o += segD(s);
      last = pt(s, 1);
    }
    if (sp.closed) o += 'Z';
  }
  return o;
}

/** Keeps only the parts of `d` where keep(p) holds (pieces shorter than 0.3 are dropped). */
function clip(d, keep) {
  const out = [];
  for (const sp of parse(d)) {
    const pieces = [];
    sp.segs.forEach((s, i) => {
      const N = 96;
      let prev = keep(pt(s, 0));
      let start = prev ? 0 : null;
      for (let k = 1; k <= N; k++) {
        const now = keep(pt(s, k / N));
        if (now === prev) continue;
        let [lo, hi] = [(k - 1) / N, k / N];
        for (let j = 0; j < 30; j++) {
          const m = (lo + hi) / 2;
          if (keep(pt(s, m)) === prev) lo = m;
          else hi = m;
        }
        if (prev) pieces.push({ i, t0: start, t1: lo });
        else start = hi;
        prev = now;
      }
      if (prev) pieces.push({ i, t0: start, t1: 1 });
    });
    if (pieces.length === sp.segs.length && pieces.every((p) => p.t0 === 0 && p.t1 === 1)) {
      out.push(sp);
      continue;
    }
    const chains = [];
    for (const pc of pieces) {
      const last = chains.at(-1)?.at(-1);
      if (last && last.t1 === 1 && pc.t0 === 0 && pc.i === last.i + 1) chains.at(-1).push(pc);
      else chains.push([pc]);
    }
    if (sp.closed && chains.length > 1) {
      const a = chains[0][0];
      const z = chains.at(-1).at(-1);
      if (a.i === 0 && a.t0 === 0 && z.i === sp.segs.length - 1 && z.t1 === 1) chains[0] = [...chains.pop(), ...chains[0]];
    }
    for (const ch of chains) {
      const segs = ch.map((pc) => sub(sp.segs[pc.i], pc.t0, pc.t1));
      if (segs.reduce((n, s) => n + segLen(s), 0) > 0.3) out.push({ segs, closed: false });
    }
  }
  return ser(out);
}

/** Points along a path, every ~0.1 (to measure distances and test insides). */
const samples = (d) =>
  parse(d).map((sp) =>
    sp.segs.flatMap((s) => {
      const n = Math.max(2, Math.ceil(segLen(s) / 0.1));
      return Array.from({ length: n + 1 }, (_, k) => pt(s, k / n));
    }),
  );
const inPoly = (ring, [px, py]) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [[xi, yi], [xj, yj]] = [ring[i], ring[j]];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};
/**
 * The part of `d` that shows behind the closed shapes `fronts`: whatever lies inside them or
 * closer than `gap` (center to center) to their outline is dropped. 3 center to center is the
 * set's knockout: 1.5 of paper between the strokes.
 */
function behind(d, fronts, gap = 3) {
  const rings = fronts.flatMap(samples);
  const pts = rings.flat();
  const keep = (p) => !rings.some((r) => inPoly(r, p)) && pts.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) >= gap - 0.005);
  return clip(d, keep);
}

/**
 * Shortens the open pieces of `ds` whose ends stop near another piece (closer than `min` center to
 * center without touching it), until they stand `min` clear: a piece cut behind another can end
 * near a third one (a shoulder cut by the person in front ends next to its own head).
 */
function settle(ds, min = 2.9) {
  ds = ds.filter(Boolean);
  const pts = ds.map((d) => samples(d).flat());
  const dist = (p, i) => Math.min(...pts.flatMap((q, j) => (j === i ? [] : q.map((r) => Math.hypot(r[0] - p[0], r[1] - p[1])))));
  return ds.map((d, i) => {
    const out = parse(d).map((sp) => {
      if (sp.closed) return sp;
      const bad = (p) => {
        const m = dist(p, i);
        return m > 0.35 && m < min;
      };
      const at = [];
      sp.segs.forEach((s, k) => {
        for (let j = 0; j <= 48; j++) at.push({ k, t: j / 48 });
      });
      const ok = at.map(({ k, t }) => !bad(pt(sp.segs[k], t)));
      let [a, b] = [0, at.length - 1];
      if (!ok[a]) while (a < b && !ok[a]) a++;
      if (!ok[b]) while (b > a && !ok[b]) b--;
      if (a === 0 && b === at.length - 1) return sp;
      const segs = [];
      for (let k = at[a].k; k <= at[b].k; k++) segs.push(sub(sp.segs[k], k === at[a].k ? at[a].t : 0, k === at[b].k ? at[b].t : 1));
      return { segs: segs.filter((s) => segLen(s) > 0.01), closed: false };
    });
    return ser(out);
  }).filter(Boolean);
}

/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Open polyline with rounded corners. */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let o = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = rr[i];
    if (!r) {
      o += `L${P(V)}`;
      continue;
    }
    const u = [A[0] - V[0], A[1] - V[1]];
    const w = [B[0] - V[0], B[1] - V[1]];
    const [lu, lw] = [Math.hypot(...u), Math.hypot(...w)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (w[0] / lw) * t, V[1] + (w[1] / lw) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** The area a custom badge clears: closed shapes whole, each segment of an open line on its own. */
const knockOf = (...ds) => ser(ds.flatMap((d) => parse(d).flatMap((sp) => (sp.closed ? [sp] : sp.segs.map((s) => ({ segs: [s], closed: false }))))));
/** A custom badge: `d` drawn on top, `knock` cleared with the engine's clearance. */
const own = (d, knock = knockOf(...d), fill) => ({ d, knock, ...(fill && { fill }) });
/** Check with the proportions of Núcleo's check, w wide and centered on (cx, cy). */
const check = (cx, cy, w) => line([cx - 0.5 * w, cy + 0.036 * w], [cx - 0.183 * w, cy + 0.357 * w], [cx + 0.5 * w, cy - 0.357 * w]);
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
const N = nucleo.icons;
const C = comunicacion.icons;
/** Núcleo's person, and shifted to make room for a corner badge (comunicacion's person-plus…). */
const PERSON = N.person.d;
const PERSON_L = C['person-plus'].d;
/**
 * Núcleo's person scaled from the feet; the head moves up to keep its gap from the shoulders
 * (comunicacion's personAt), never less than 2.35 between them, so a small person keeps its head
 * apart at 2.1.
 */
const personAt = (s, dx = 0, dy = 0) => {
  const up = s < 1 ? Math.max(1.95, (2.35 - 2.45 * s) / (1 - s)) * (1 - s) : 0;
  return [place(PERSON[0], s, [12, 20.6], [12 + dx, 20.6 + dy - up]), place(PERSON[1], s, [12, 20.6], [12 + dx, 20.6 + dy])];
};
/** comunicacion's group: two people behind and one in front, the front one a badge the engine clears. */
const PEOPLE = C.people;
/** Small bust (cards, rings): head and shoulders resting on a base line (comunicacion's bust). */
const bust = (cx, headY, hr, baseY, sr) => [circ(cx, headY, hr), arc(cx, baseY, sr, 180, 360).d];
/** The set's heart (edicion's `heart`), w wide, its top at `top`. */
const HEART = 'M12 20.5L4.03 12A4.75 4.75 0 1 1 12 7.23A4.75 4.75 0 1 1 19.97 12Z';
const HEART_BOX = { w: 18.42, top: 2.5 }; // edicion's heart spans 2.79–21.21 across, from 2.5 down
const heartAt = (cx, top, w) => place(HEART, w / HEART_BOX.w, [12, HEART_BOX.top], [cx, top]);
/** The set's play triangle (dispositivos' `play`). */
const PLAY = dispositivos.icons.play.d[0];
const playAt = (cx, cy, s) => place(PLAY, s, [12.2, 12], [cx, cy]);

// ── The post ──────────────────────────────────────────────────────────────────────────────────
// The square card with the signature corner; along its top the author, a dot, and a short name line
// (a ring there pushed the card past QA's density); below them, from 12.15 to 17.85 (2.9 from the
// bottom edge), the post's content: a rounded media block, text lines, an embedded post, a waveform.
const CARD = box(3.25, 3.25, 17.5, 17.5, 4);
const AVATAR = dot(7.5, 7.75);
const NAME = hl(11.25, 16.25, 7.75);
const MEDIA = sq(6.25, 12.15, 11.5, 5.7, 2);
const POST = [CARD, AVATAR, NAME, MEDIA];
const [TOP, MID, LOW] = [12.15, 15, 17.85];

// ── Glyphs for the corner (custom badges around the badge's center, 17.25 17.25) ────────────────
// Each one clears the standard badge's circle as well as its own shape, as the engine's glyph badges
// do: no bits of the base are left beside it, and a post-pin ↔ post-check pair only swaps the badge.
const BC = [17.25, 17.25];
const RING = circ(BC[0], BC[1], 4.25);
const glyph = (d, own_, fill) => ({ d, knock: `${RING}${own_}`, ...(fill && { fill }) });
/** Núcleo's pushpin at half size, upright, its needle into the corner (ventanas' window-pin). */
const PIN = (() => {
  const s = 0.5;
  const at = (d) => place(d, s, [12, 3.25], [BC[0], 12.75]);
  const [bar, head_, needle] = N.pin.d.map(at);
  const k = (p) => [BC[0] + (p[0] - 12) * s, 12.75 + (p[1] - 3.25) * s];
  const knock = roundpoly([k([8.75, 3.25]), k([15.25, 3.25]), k([17.4, 11.9]), k([17.4, 12.75]), k([12, 20.75]), k([6.6, 12.75]), k([6.6, 11.9])], 0);
  return glyph([bar, head_, needle], knock, { solid: [shut(head_)], wire: [bar, needle] });
})();
/** datos' sparkle at 8.5 across, as calendario's calendar-sparkle. */
const SPARKLE = (() => {
  const d = place(datos.icons.sparkle.d[0], 8.5 / 18.5, [12, 12], BC);
  return glyph([d], d, { solid: [d] });
})();
/** Núcleo's shield, empty, 8.75 tall. */
const SHIELD = (() => {
  const d = place(N.shield.d[0], 0.485, [12, 12.12], BC);
  return glyph([d], d, { solid: [d] });
})();
/** comercio's bag at half size. */
const BAG = (() => {
  const [body, handle] = comercio.icons.bag.d.map((d) => place(d, 0.5, [12.16, 12.12], [BC[0], 17.5]));
  return glyph([body, handle], `${body}${shut(handle)}`, { solid: [body], wire: [handle] });
})();
/** lugares' map pin at 60 %, its hole a dot (a ring that small closes at heavy weights). */
const MAP_PIN = (() => {
  const s = 0.6;
  const body = place(lugares.icons['map-pin'].d[0], s, [12, 11.7], [BC[0], 16.9]);
  const hole = dot(BC[0], 16.9 + (10.25 - 11.7) * s);
  return glyph([body, hole], body, { solid: [body], cut: [hole] });
})();
/**
 * A magnifier holding a check (fact-check): a status badge, solid in every style, its lens on the
 * standard ring with the check cut out, and the handle running out to the corner.
 */
const LENS_CHECK = (() => {
  const ring = circ(BC[0], BC[1], 4.25);
  const mark = check(BC[0] - 0.05, BC[1] + 0.05, 3.85);
  const p = polar(BC[0], BC[1], 4.25, 45);
  const handle = line(p, [21.9, 21.9]);
  return own([ring, mark, handle], `${ring}M${P(p)}L21.9 21.9Z`, { solid: [ring], cut: [mark], wire: [handle] });
})();

// ── Stories and short video ───────────────────────────────────────────────────────────────────
// The story is the portrait frame with the signature corner, under its three progress segments
// (above it, 3 apart: inside it, the corners left no room); the short video, the full portrait
// frame with the set's play triangle.
const STORY = [box(4.75, 5.75, 14.5, 15.5, 3.5), hl(4.75, 7.58, 2.75), hl(10.58, 13.42, 2.75), hl(16.42, 19.25, 2.75)];
const REEL = box(4.75, 2.75, 14.5, 18.5, 4);

// ── More glyphs for the corner ────────────────────────────────────────────────────────────────
/** The play triangle on the badge's center, 8.4 tall (creator). */
const PLAY_B = (() => {
  const d = playAt(BC[0] + 0.3, BC[1], 0.7);
  return glyph([d], d, { solid: [d] });
})();
/** comercio's gem at half size: the outline and its girdle. */
const GEM = (() => {
  const [body, girdle] = comercio.icons.gem.d.slice(0, 2).map((d) => place(d, 0.5, [12, 11.75], BC));
  return glyph([body, girdle], body, { solid: [body], cut: [girdle] });
})();
/** A three-point crown that sits on the head (person-crown): the engine clears the head under it. */
const CROWN = (() => {
  const d = roundpoly([[8.25, 7.25], [7.5, 3], [10, 4.9], [12, 2.25], [14, 4.9], [16.5, 3], [15.75, 7.25]], [0.5, 0.6, 0.5, 0.6, 0.5, 0.6, 0.5]);
  return own([d], d, { solid: [d] });
})();

/** Núcleo's bell under a corner: the body at 45 %, the clapper at 60 % so it keeps its gap. */
const BELL = (() => {
  const body = place(N.bell.d[1], 0.45, [12, 10.15], [BC[0], 15.2]);
  const clapper = place(N.bell.d[0], 0.6, [12, 20.35], [BC[0], 21.3]);
  return glyph([body, clapper], `${body}${shut(clapper)}`, { solid: [body, shut(clapper)] });
})();
const BELL_TOP = [BC[0], 15.2 + (2.95 - 10.15) * 0.45];
/** edicion's eye at 48 %, its pupil a dot. */
const EYE = 'M2.75 12C5 7.75 8.25 5.5 12 5.5S19 7.75 21.25 12C19 16.25 15.75 18.5 12 18.5S5 16.25 2.75 12Z';
const EYE_B = (() => {
  const body = place(EYE, 0.48, [12, 12], BC);
  return glyph([body, dot(...BC)], body, { solid: [body], cut: [dot(...BC)] });
})();
/**
 * A chain link for the corner: calendario's link laid flat (two hooks of r 2.25 and the bar between
 * them, its ends 2.9 from the hooks'), turned onto the diagonal as Núcleo's link lies. Two capsules
 * through each other, the earlier drawing, read as a bandage.
 */
const LINK_B = (() => {
  const [x, y] = BC;
  const d = [`M${f(x - 2.83)} ${f(y - 2.25)}A2.25 2.25 0 0 0 ${f(x - 2.83)} ${f(y + 2.25)}`, `M${f(x + 2.83)} ${f(y - 2.25)}A2.25 2.25 0 0 1 ${f(x + 2.83)} ${f(y + 2.25)}`, hl(x - 1, x + 1, y)].map((p) => turnPath(p, -45, BC));
  return glyph(d, knockOf(...d));
})();
/**
 * The person peeking in from the corner (archivos' `file-person`, oficina's `task-assign`): the head
 * and the shoulders 2.45 apart, clearing the badge circle so no piece of the base is left between them.
 */
const PEEK = (() => {
  const h = circ(BC[0], 14.45, 1.6);
  const s = `M${f(BC[0] - 3.25)} 21.75A3.25 3.25 0 0 1 ${f(BC[0] + 3.25)} 21.75Z`;
  return { d: [h, s], knock: `${RING}${h}${s}`, fill: { solid: [h, s] } };
})();
/** Núcleo's speaker at 44 % and its mute cross beside it, 2.85 clear (scaled together, they merged). */
const MUTE_B = (() => {
  const body = place(N.speaker.d[0], 0.44, [8.04, 12], [14.6, BC[1]]);
  const x = [line([19.35, 16.05], [21.75, 18.45]), line([21.75, 16.05], [19.35, 18.45])];
  return glyph([body, ...x], `${body}${knockOf(...x)}`, { solid: [body], wire: x });
})();
/** The people group flat: the two behind stop 3 short of the one in front (no badge of its own), so a corner badge can go on it. */
const peopleFlat = (k = 1, dx = 0, dy = 0) => {
  const front = personAt(0.84 * k, dx, dy);
  const back = [-5.4, 5.4].flatMap((x) => personAt(0.66 * k, x * k + dx, dy - 1.75 * k)).map((d) => behind(d, front.map(shut)));
  return settle([...back, ...front]);
};
/** The x where a closed outline is outermost on one side at height y (to start a line on it). */
const edgeAt = (d, y, side) => {
  const xs = samples(d)
    .flat()
    .filter((p) => Math.abs(p[1] - y) < 0.06)
    .map((p) => p[0]);
  return side > 0 ? Math.max(...xs) : Math.min(...xs);
};

/**
 * Star with five points, its valleys at half its radius and its points rounded by 0.55: at 3 across
 * with deep valleys the stroke filled them and it read as a flower.
 */
const star = (cx, cy, R, r = R * 0.49) => roundpoly(Array.from({ length: 10 }, (_, i) => polar(cx, cy, i % 2 ? r : R, -90 + i * 36)), Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.35 : 0.55)));
/**
 * An avatar: the ring and, inside it, the person as comunicacion's `person-circle` draws it (the head,
 * and the shoulders an arc whose ends meet the ring), sized for a small ring: the head stays 2.15
 * from the rim and the shoulders 2.4 under the head (the core person's gap), apart up to 2.1.
 */
const avatar = (cx, cy, R, h, hy) => {
  const top = cy + hy + h + 2.4;
  const [ex, ey] = [R * Math.sin((48 * Math.PI) / 180), cy + R * Math.cos((48 * Math.PI) / 180)];
  const s = ((ey - top) ** 2 + ex * ex) / (2 * (ey - top));
  const a = (Math.atan2(ey - top - s, ex) * 180) / Math.PI;
  return [circ(cx, cy, R), circ(cx, cy + hy, h), arc(cx, top + s, s, 180 - a, a + 360).d];
};
/**
 * What shows of a circle (center c, radius R) behind another (center o, radius Ro), closed: its
 * visible side, and the arc 3 from the front one's outline (the set's knockout) that closes it.
 */
function crescent(c, R, o, Ro) {
  const K = Ro + 3;
  const dist = Math.hypot(o[0] - c[0], o[1] - c[1]);
  const a = (dist * dist + R * R - K * K) / (2 * dist);
  const h = Math.sqrt(R * R - a * a);
  const u = [(o[0] - c[0]) / dist, (o[1] - c[1]) / dist];
  const m = [c[0] + u[0] * a, c[1] + u[1] * a];
  const [p1, p2] = [
    [m[0] - u[1] * h, m[1] + u[0] * h],
    [m[0] + u[1] * h, m[1] - u[0] * h],
  ];
  return `M${P(p1)}A${f(R)} ${f(R)} 0 ${a > 0 ? 1 : 0} 1 ${P(p2)}A${f(K)} ${f(K)} 0 0 0 ${P(p1)}Z`;
}
/** An arc arrow (3.4 arms, DESIGN.md › Arrows): the arc about c of radius r from a0 to a1, and its head. */
const arcArrow = (c, r, a0, a1) => {
  const a = arc(c[0], c[1], r, a0, a1);
  return [a.d, head(a.end, a.tangent, 3.4)];
};
/**
 * comunicacion's `people` at scale s, moved by (dx, dy): the two in back, and the one in front as its
 * badge. Drawn again with personAt, not scaled whole, so each head keeps its gap at every weight.
 */
const groupAt = (s, dx, dy) => {
  const front = personAt(0.84 * s, dx, dy);
  const back = [-5.4, 5.4].flatMap((x) => personAt(0.66 * s, x * s + dx, dy - 1.75 * s));
  return { back, front: own(front, front.map(shut).join(''), { solid: front.map(shut) }) };
};
/** A circular arrow turning back (counterclockwise) on the badge's center (memories). */
const BACK_B = (() => {
  const a = arc(BC[0], BC[1], 3.75, 180, -90);
  const h = head(a.end, a.tangent, 2.75);
  // It clears the photo's corner whole, the end of its horizon with it (a sliver of it came and went)
  return { d: [a.d, h], knock: sq(12.75, 12.25, 9.5, 9.5, 3) };
})();
/** A thick arrow pointing up, short (vote): drawn once, flipped for down. */
const VOTE = roundpoly([[12, 2.75], [18.75, 8], [15.25, 8], [15.25, 10.25], [8.75, 10.25], [8.75, 8], [5.25, 8]], [1.2, 0.8, 0.35, 0.8, 0.8, 0.35, 0.8]);

/**
 * A laurel branch and its mirror: the stem is an arc (radius R about c, from `from` to `to` degrees)
 * and each leaf a lens W wide and L long, leaving the stem at the angles `at` turned out by `a`
 * (0 runs along the stem, 1 straight out); one more leaf continues the stem at its tip.
 */
function laurel({ R, c, from, to, at, L, W, a }) {
  const s_ = W / 2;
  const r = (L * L / 4 + s_ * s_) / (2 * s_);
  const lens = (B, u) => {
    const T = [B[0] + L * u[0], B[1] + L * u[1]];
    return `M${P(B)}A${f(r)} ${f(r)} 0 0 1 ${P(T)}A${f(r)} ${f(r)} 0 0 1 ${P(B)}Z`;
  };
  const dir = (deg, k) => {
    const n = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const t = [-n[1], n[0]];
    const b = Math.sqrt(1 - k * k);
    return [k * n[0] + b * t[0], k * n[1] + b * t[1]];
  };
  const left = [arc(c[0], c[1], R, from, to).d, ...at.map((deg) => lens(polar(c[0], c[1], R, deg), dir(deg, a))), lens(polar(c[0], c[1], R, to), dir(to, 0))];
  return [...left, ...left.map((d) => flipPath(d))];
}

const icons = {
  // ── Posts ──
  'post': {
    tags: ['publicación', 'post', 'entrada', 'feed', 'red social', 'social post'],
    d: POST,
  },
  'post-text': {
    tags: ['publicación de texto', 'estado', 'actualización', 'text post', 'status update'],
    d: [CARD, AVATAR, NAME, hl(6.25, 17.75, TOP), hl(6.25, 15.25, MID), hl(7.25, 12.25, LOW)],
  },
  'post-quote': {
    tags: ['citar publicación', 'cita', 'compartir con comentario', 'quote post', 'quote'],
    // Below the header, the quoted post: a smaller card of its own, set to the left, with the
    // signature corner and its author (a dot 2.45 inside it). Centered and empty it read as the
    // post's own media, and with a name line too the card passed the density limit
    d: [CARD, AVATAR, NAME, box(6.25, 11.3, 9, 6.6, 2), dot(9.4, 14.6)],
  },
  'post-thread': {
    tags: ['hilo', 'publicaciones encadenadas', 'conversación', 'thread', 'chain'],
    // Two avatars joined by the thread line; two text lines beside each one
    d: [circ(5.5, 5.75, 2.25), vl(5.5, 8, 13.5), circ(5.5, 15.75, 2.25), hl(10.75, 20.75, 4.25), hl(10.75, 17.25, 7.25), hl(10.75, 20.75, 14.25), hl(10.75, 15.75, 17.25)],
  },
  'post-collab': {
    tags: ['colaboración', 'coautores', 'publicación conjunta', 'collab post', 'co-author'],
    // The post and its co-author peeking in from the corner (the set's corner person, archivos'
    // file-person): two avatars in the header, any size that fit, read as a face
    d: POST,
    badge: PEEK,
  },
  'post-pin': {
    tags: ['publicación fijada', 'fijar', 'destacar arriba', 'pinned post', 'pin'],
    d: POST,
    badge: PIN,
  },
  'post-sparkle': {
    tags: ['contenido generado con ia', 'inteligencia artificial', 'etiqueta ia', 'ai generated', 'ai label'],
    d: POST,
    badge: SPARKLE,
  },
  'post-shield': {
    tags: ['moderación', 'contenido moderado', 'seguridad', 'moderation', 'trust and safety'],
    d: POST,
    badge: SHIELD,
  },
  'post-bag': {
    tags: ['publicación comprable', 'compras', 'etiquetas de producto', 'shoppable post', 'shop'],
    d: POST,
    badge: BAG,
  },
  'post-location': {
    tags: ['ubicación', 'check-in', 'lugar etiquetado', 'location tag', 'check in'],
    d: POST,
    badge: MAP_PIN,
  },
  'post-audio': {
    tags: ['publicación de audio', 'nota de voz', 'audio', 'audio post', 'voice post'],
    d: [CARD, AVATAR, NAME, ...[
      [6.25, 1],
      [9.125, 2.85],
      [12, 1.6],
      [14.875, 2.85],
      [17.75, 1],
    ].map(([x, h]) => vl(x, MID - h, MID + h))],
  },
  'post-plus': {
    tags: ['crear publicación', 'publicar', 'nueva publicación', 'create post', 'compose'],
    d: POST,
    badge: badge('plus'),
  },
  'post-clock': {
    tags: ['publicación programada', 'programar', 'publicar después', 'scheduled post', 'schedule'],
    d: POST,
    badge: badge('clock'),
  },
  'post-check': {
    tags: ['publicación aprobada', 'aprobar', 'cola de moderación', 'approved post', 'approve'],
    d: POST,
    badge: badge('check'),
  },
  'post-lock': {
    tags: ['publicación bloqueada', 'solo seguidores', 'hilo cerrado', 'locked post', 'followers only'],
    d: POST,
    badge: badge('lock'),
  },
  'feed': {
    tags: ['feed', 'muro', 'inicio', 'noticias', 'news feed', 'timeline'],
    // Two posts, the second one running off the bottom: the feed goes on
    d: [
      box(3.25, 2.75, 17.5, 8, 3),
      dot(7.5, 6.75),
      hl(11.25, 16.25, 6.75),
      clip(sq(3.25, 13.75, 17.5, 12, 3), (p) => p[1] <= 21.25),
      dot(7.5, 17.75),
      hl(11.25, 16.25, 17.75),
    ],
  },
  'link-preview': {
    tags: ['vista previa de enlace', 'tarjeta de enlace', 'enlace', 'link preview', 'unfurl'],
    // The media on top, the title below it, and the set's link in the corner
    d: [CARD, sq(6.25, 6.25, 11.5, 5, 2), hl(6.25, 14.25, 14.25)],
    badge: LINK_B,
  },
  'collection': {
    tags: ['colección', 'guardados', 'tablero', 'saved', 'collection', 'board'],
    // A mosaic: the tall tile is a bookmark (notched at the bottom), two tiles beside it
    d: [
      sq(3.25, 3.25, 7.5, 17.5, 2.25, { square: ['br', 'bl'] }).replace(`L${f(10.75)} ${f(20.75)}L${f(3.25)} ${f(20.75)}`, `L10.75 20.75L7 17.75L3.25 20.75`),
      sq(13.75, 3.25, 7, 7.25, 2.25),
      box(13.75, 13.5, 7, 7.25, 2.25),
    ],
  },
  'repost': {
    tags: ['republicar', 'compartir', 'difundir', 'repost', 'share', 'boost'],
    // The post and its copy on the diagonal; the arrow leaves the first one's side square to it and
    // turns down to the copy, its tip 2.85 short of it (landing on it, its head read as an antenna)
    d: [box(2.75, 2.75, 7.5, 7.5, 2.25), box(13.75, 13.75, 7.5, 7.5, 2.25), ...arcArrow([10.25, 13.5], 7, -90, -21.8)],
  },
  'crosspost': {
    tags: ['publicar en otra comunidad', 'compartir en grupo', 'crosspost', 'cross-post', 'share to group'],
    // repost's post and arrow, landing on a group (comunicacion's people) instead of a copy
    ...(() => {
      // The group at half size, low on the right; the arc wider than repost's so the head stands 3.1
      // from the person in front (its knockout would bite the head) and 3.2 from the post
      const g = groupAt(0.5, 4, 0.65);
      return { d: [box(2.75, 2.75, 7.5, 7.5, 2.25), ...arcArrow([10.25, 14.5], 8, -90, -36), ...g.back], badge: g.front };
    })(),
  },
  'fact-check': {
    tags: ['verificación de datos', 'nota de la comunidad', 'comprobar', 'fact check', 'community note'],
    // The text post under the magnifier (on the media post it was post-check with a handle)
    d: [CARD, AVATAR, NAME, hl(6.25, 17.75, TOP), hl(6.25, 15.25, MID), hl(7.25, 12.25, LOW)],
    badge: LENS_CHECK,
  },
  // ── Stories and short video ──
  'story': {
    tags: ['historia', 'estado', 'contenido efímero', 'story', 'stories'],
    d: STORY,
  },
  'story-ring': {
    tags: ['historia sin ver', 'anillo de historia', 'avatar', 'unseen story', 'story ring'],
    // The person inside a ring broken in four, its gaps at the top, bottom and sides
    d: [...[0, 90, 180, 270].map((a) => arc(12, 12, 9, a - 90 + 12, a - 12).d), ...personAt(0.55, 0, -3.5)],
  },
  'story-plus': {
    tags: ['agregar a historia', 'nueva historia', 'publicar historia', 'add to story', 'new story'],
    d: STORY,
    badge: badge('plus'),
  },
  'short-video': {
    tags: ['video corto', 'reels', 'clips', 'short video', 'shorts', 'reel'],
    d: [REEL, playAt(12.4, 12, 0.75)],
  },
  'remix': {
    tags: ['remix', 'dueto', 'video sobre otro', 'duet', 'stitch'],
    // The original with its play triangle, and the remix in front of its corner
    d: [sq(2.75, 2.75, 12.5, 18.5, 3.5), playAt(8.6, 9.75, 0.55)],
    badge: (() => {
      const d = box(13.25, 10.25, 8, 11, 2.5);
      return own([d], d, { solid: [d] });
    })(),
  },
  'creator': {
    tags: ['creador', 'streamer', 'herramientas de creador', 'creator', 'content creator'],
    d: PERSON_L,
    badge: PLAY_B,
  },
  'watch-party': {
    tags: ['ver juntos', 'reproducción compartida', 'fiesta de video', 'watch party', 'watch together'],
    // The screen and two viewers in front of it (the engine clears the screen around them)
    d: [box(2.5, 2.5, 19, 14, 3.5), playAt(12.2, 8.75, 0.55)],
    badge: (() => {
      // The two viewers and the row between them: the screen's lower edge runs behind the whole row
      const d = [-6.75, 6.75].flatMap((dx) => personAt(0.45, dx, 0.65));
      return own(d, `${d.map(shut).join('')}${sq(5.25, 15.25, 13.5, 3, 0)}`, { solid: d.map(shut) });
    })(),
  },
  'audio-room': {
    tags: ['sala de audio', 'espacios', 'charla en vivo', 'audio room', 'live audio', 'spaces'],
    // The microphone at the center and a listener at each side, below it
    // The set's microphone drawn small (its capsule, holder and stem 3 apart, as at full size)
    d: [sq(10, 2.75, 4, 7, 2), 'M7 6.5V7.75A5 5 0 0 0 17 7.75V6.5', vl(12, 12.75, 15.75), ...personAt(0.42, -7, 0.65), ...personAt(0.42, 7, 0.65)],
  },

  // ── Reactions ──
  'heart-double': {
    tags: ['match', 'me gusta mutuo', 'corazones', 'mutual like', 'match', 'hearts'],
    d: [heartAt(8.75, 3, 12)],
    badge: (() => {
      const d = heartAt(15.25, 9.25, 12);
      return own([d], d, { solid: [d] });
    })(),
  },
  'heart-burst': {
    tags: ['me encanta', 'súper like', 'reacción fuerte', 'love it', 'super like'],
    d: [heartAt(12, 8.75, 13.5), vl(12, 2.5, 5.5), line(polar(12, 9.5, 6.25, -145), polar(12, 9.5, 9, -145)), line(polar(12, 9.5, 6.25, -35), polar(12, 9.5, 9, -35))],
  },
  'live-reactions': {
    tags: ['reacciones en vivo', 'corazones flotando', 'transmisión en vivo', 'live reactions', 'floating hearts'],
    // Three hearts rising on a gentle S, larger as they rise
    d: [heartAt(15.5, 16.25, 5.5), heartAt(8, 9.5, 7.5), heartAt(15.25, 2.5, 9.5)],
  },
  'comment-thread': {
    tags: ['hilo de comentarios', 'respuestas', 'comentario', 'comment thread', 'replies'],
    // The comment (the set's drop), and its thread: an L that starts 2.85 under it and turns into the
    // reply, a smaller drop. Hung from the drop, the thread read as a lollipop, and text lines as a list
    d: [drop(7.5, 7.5, 4.25), rline([[6.5, 14.55], [6.5, 17.5], [10.85, 17.5]], [0, 2, 0]), drop(17.5, 17.5, 3.75)],
  },

  // ── Profiles ──
  'person-tag': {
    tags: ['etiquetar personas', 'etiqueta', 'mencionar en foto', 'tag people', 'tag'],
    // A label tag pointing left, its hole near the point, the person inside (Núcleo's, small: an
    // open bust resting on the tag's edge read as a frown)
    d: [roundpoly([[2.25, 12], [7.5, 4.75], [21.25, 4.75], [21.25, 19.25], [7.5, 19.25]], [1, 1.5, 3, 3, 1.5]), dot(6.75, 12), ...personAt(0.5, 2.75, -2)],
  },
  'profile': {
    tags: ['perfil', 'página de perfil', 'portada', 'profile', 'profile page'],
    // The cover band across the top, the avatar on its lower edge and two lines of bio
    d: [CARD, hl(14.25, 20.75, 9.25), circ(8.75, 9.25, 2.5), hl(6.25, 17.75, 14.75), hl(7.25, 12.25, 17.75)],
  },
  'profile-card': {
    tags: ['tarjeta de perfil', 'sugerencia', 'seguir cuenta', 'profile card', 'follow suggestion'],
    d: [REEL, circ(12, 7.6, 2), hl(9.25, 14.75, 12.45), sq(8.25, 15.3, 7.5, 3.1, 1.55)],
  },
  'profile-deck': {
    tags: ['deslizar perfiles', 'descubrir personas', 'tarjetas', 'swipe', 'discover people'],
    // The card behind, tilted; the one in front with the person
    d: [turnPath(box(8.25, 3.25, 12, 16, 2.5), 10, [14.25, 11.25])],
    badge: (() => {
      const d = [box(3.75, 5.25, 12, 16, 2), ...bust(10.25, 13.3, 2.25, 21.25, 3.25)];
      return own(d, d[0], { solid: [d[0]], cut: d.slice(1) });
    })(),
  },
  'bio-links': {
    tags: ['enlaces en biografía', 'link en bio', 'página de enlaces', 'link in bio', 'links'],
    // The avatar over the buttons, centered as on a links page: two, wide and 3.35 apart (three of
    // them, tight, read as a spring)
    d: [circ(12, 5, 2.5), sq(4.25, 10.35, 15.5, 3.5, 1.75), sq(4.25, 16.7, 15.5, 3.5, 1.75)],
  },
  'avatar-stack': {
    tags: ['avatares', 'miembros', 'participantes', 'facepile', 'members', 'avatars'],
    // The avatar in front with its person and the one behind it, what shows of it closed as a
    // crescent (two or three open rings in a row read as the letters CC)
    d: [crescent([7.5, 12], 4.75, [15.5, 12], 6), ...avatar(15.5, 12, 6, 1.5, -1.8)],
  },
  'person-crown': {
    tags: ['dueño', 'administrador', 'fan destacado', 'owner', 'admin', 'top fan'],
    d: personAt(0.9, 0, 0.65),
    badge: CROWN,
  },
  'person-gem': {
    tags: ['suscriptor', 'miembro de pago', 'súper seguidor', 'supporter', 'paid member'],
    d: PERSON_L,
    badge: GEM,
  },
  // ── People ──
  'person-spotlight': {
    tags: ['miembro destacado', 'en el foco', 'destacar', 'spotlight', 'featured member'],
    // A lamp at the top, its cone of light down to the pool on the floor, and the person standing in
    // it (in front: the engine clears the pool's far edge behind them)
    d: [roundpoly([[10.25, 2.5], [13.75, 2.5], [16, 5.25], [8, 5.25]], 0.6), line([8.75, 5.25], [3.25, 18.75]), line([15.25, 5.25], [20.75, 18.75]), 'M3.25 18.75A8.75 2 0 0 0 20.75 18.75A8.75 2 0 0 0 3.25 18.75Z'],
    badge: (() => {
      const d = personAt(0.55, 0, -3.1);
      return own(d, d.join(''), { solid: d });
    })(),
  },
  'person-bell': {
    tags: ['notificaciones de cuenta', 'avisos de publicaciones', 'suscribirse', 'post notifications', 'notify'],
    d: PERSON_L,
    badge: BELL,
  },
  'person-eye': {
    tags: ['espectadores', 'visto por', 'visitas al perfil', 'viewers', 'profile views'],
    d: PERSON_L,
    badge: EYE_B,
  },
  'person-link': {
    tags: ['enlace de perfil', 'invitar con enlace', 'compartir perfil', 'profile link', 'invite link'],
    d: PERSON_L,
    badge: LINK_B,
  },
  'person-mute': {
    tags: ['silenciar usuario', 'ocultar publicaciones', 'silenciar cuenta', 'mute user', 'mute'],
    d: PERSON_L,
    badge: MUTE_B,
  },
  'person-star': {
    tags: ['mejores amigos', 'favorito', 'miembro destacado', 'close friends', 'favorite'],
    d: PERSON_L,
    badge: badge('star'),
  },
  'person-arrow-up': {
    tags: ['promover', 'hacer moderador', 'ascender', 'promote', 'make admin'],
    d: PERSON_L,
    badge: badge('arrow-up'),
  },
  'followers': {
    tags: ['seguidores', 'audiencia', 'quién te sigue', 'followers', 'audience'],
    // The person in front and two more trailing behind it on the diagonal, smaller as they go back:
    // the second stands apart, whole, and only the last one is cut behind it (each cut behind the
    // one before, the small ones broke into bits; all three apart did not fit 3 from each other)
    d: (() => {
      const [a, b, c] = [personAt(0.62, -5.25, 0.65), personAt(0.46, 2.6, -5.1), personAt(0.36, 7.5, -11.2)];
      return settle([...a, ...b, ...c.map((d) => behind(d, b.map(shut)))]);
    })(),
  },
  'person-connection': {
    tags: ['conexión', 'conectar', 'seguimiento mutuo', 'connection', 'connect'],
    d: (() => {
      const [l, r] = [personAt(0.55, -6.25, 0.65), personAt(0.55, 6.25, 0.65)];
      return [...l, ...r, hl(edgeAt(l[1], 19.5, 1), edgeAt(r[1], 19.5, -1), 19.5)];
    })(),
  },
  'mutual-friends': {
    tags: ['amigos en común', 'conexiones compartidas', 'contactos mutuos', 'mutual friends', 'shared connections'],
    // Two circles of friends and the person in the lens they share; the circles stop 3 short of them
    d: (() => {
      const me = [circ(12, 11.5, 1.25), 'M9.75 17.45A2.25 2.25 0 0 1 14.25 17.45Z'];
      return settle([...[circ(9.25, 12, 7.25), circ(14.75, 12, 7.25)].map((d) => behind(d, me)), ...me]);
    })(),
  },
  'social-graph': {
    tags: ['red social', 'grafo de conexiones', 'contactos', 'social graph', 'network'],
    d: (() => {
      const me = personAt(0.6, 0, 0.65);
      const c = [12, 12.58];
      const rings = [[4.75, 6.25], [12, 3.75], [19.25, 6.25]];
      const spoke = (q) => {
        const n = Math.hypot(q[0] - c[0], q[1] - c[1]);
        const u = [(q[0] - c[0]) / n, (q[1] - c[1]) / n];
        return line([c[0] + u[0] * 2.22, c[1] + u[1] * 2.22], [q[0] - u[0] * 1.75, q[1] - u[1] * 1.75]);
      };
      return [...me, ...rings.map((q) => circ(...q, 1.75)), ...rings.map(spoke)];
    })(),
  },
  'community': {
    tags: ['comunidad', 'grupo', 'miembros', 'community', 'group', 'members'],
    // Three people on a ring: it runs behind them and joins them
    d: (() => {
      const ps = [personAt(0.45, 0, -10.1), personAt(0.45, -6, 0.4), personAt(0.45, 6, 0.4)].flat();
      return settle([behind(circ(12, 12, 9), ps.map(shut)), ...ps]);
    })(),
  },
  'member-list': {
    tags: ['lista de miembros', 'integrantes', 'seguidores', 'member list', 'roster'],
    d: [5.25, 12, 18.75].flatMap((y) => [circ(5.5, y, 2.25), hl(10.75, 20.75, y)]),
  },
  'member-list-block': {
    tags: ['lista de bloqueados', 'cuentas bloqueadas', 'bloquear', 'block list', 'blocked accounts'],
    d: [5.25, 12, 18.75].flatMap((y) => [circ(5.5, y, 2.25), hl(10.75, 20.75, y)]),
    badge: badge('block'),
  },
  'people-plus': {
    tags: ['unirse a grupo', 'crear grupo', 'invitar al grupo', 'join group', 'add to group'],
    d: peopleFlat(0.85, -1.5, 0.5),
    badge: badge('plus'),
  },
  'people-minus': {
    tags: ['salir del grupo', 'quitar del grupo', 'abandonar', 'leave group', 'remove from group'],
    d: peopleFlat(0.85, -1.5, 0.5),
    badge: badge('minus'),
  },
  'people-lock': {
    tags: ['grupo privado', 'comunidad cerrada', 'privado', 'private group', 'closed group'],
    d: peopleFlat(0.85, -1.5, 0),
    badge: badge('lock'),
  },
  'forum': {
    tags: ['foro', 'temas', 'discusiones', 'forum', 'board', 'topics'],
    d: [
      [5.25, 20.75],
      [12, 18],
      [18.75, 15.5],
    ].flatMap(([y, x1]) => [drop(5.25, y, 2), hl(10.25, x1, y)]),
  },
  'discussion': {
    tags: ['discusión', 'conversación de comunidad', 'debate', 'discussion', 'conversation'],
    d: [...personAt(0.6, -5.75, 0.65), ...personAt(0.6, 5.75, 0.65), drop(12, 6, 3)],
  },
  'bulletin-board': {
    tags: ['tablón de anuncios', 'avisos', 'anuncios de comunidad', 'bulletin board', 'notices'],
    // A standing board on two legs, a note posted on it and the notice's lines beside it (two notes
    // with their pins side by side read as a face)
    d: [box(2.5, 3, 19, 12.5, 3), vl(6.5, 15.5, 21.25), vl(17.5, 15.5, 21.25), sq(5.5, 6.25, 6, 6, 1.5), hl(14.5, 18.5, 7.75), hl(14.5, 17, 10.75)],
  },
  'meetup': {
    tags: ['encuentro', 'reunión presencial', 'quedada', 'meetup', 'in person'],
    d: [...lugares.icons['map-pin'].d.map((d) => place(d, 0.6, [12, 3.25], [12, 2.5])), ...personAt(0.55, -5.5, 0.65), ...personAt(0.55, 5.5, 0.65)],
  },
  // ── Groups, events and invitations ──
  'name-tag': {
    tags: ['etiqueta de nombre', 'gafete', 'presentación', 'name tag', 'hello my name is'],
    // The sticker with its band and the greeting printed in it, and a name written by hand below
    // (comunicacion's signature stroke); with the band empty it was Núcleo's card
    d: [box(2.5, 4.5, 19, 15, 3.5), hl(2.5, 21.5, 11), hl(9.5, 14.5, 7.75), place(C['mail-signature'].d[2], 1, [12, 14.75], [12, 15.25])],
  },
  'invitation': {
    tags: ['invitación', 'invitar', 'unirse', 'invitation', 'invite'],
    // comunicacion's mail-letter: the card rising out of the envelope carries the person
    d: [C['mail-letter'].d[0], ...bust(12, 7.35, 1.5, 13.75, 2.45)],
    badge: C['mail-letter'].badge,
  },

  // ── Polls, votes and topics ──
  'poll': {
    tags: ['encuesta', 'votación', 'opciones', 'poll', 'vote', 'survey'],
    // Three options; the chosen one carries the check where the others have their circle
    d: [check(5.25, 5.4, 4.5), hl(10.25, 20.75, 5.25), circ(5.25, 12, 2), hl(10.25, 17.75, 12), circ(5.25, 18.75, 2), hl(10.25, 15.25, 18.75)],
  },
  'poll-results': {
    tags: ['resultados de encuesta', 'votos', 'porcentaje', 'poll results', 'results'],
    d: [sq(3.25, 3.75, 10, 3.5, 1.75), check(18.25, 5.5, 4), sq(3.25, 10.25, 7.25, 3.5, 1.75), sq(3.25, 16.75, 4.75, 3.5, 1.75)],
  },
  'vote': {
    tags: ['votar', 'voto positivo', 'voto negativo', 'upvote', 'downvote', 'score'],
    d: [VOTE, flipPath(VOTE, 'y')],
  },
  'trending': {
    tags: ['tendencias', 'temas populares', 'en alza', 'trending', 'trends'],
    // comunicacion's hashtag, and a rising zigzag on top of its corner
    d: comunicacion.icons.hashtag.d.map((d) => place(d, 0.72, [12, 12], [9.25, 14.5])),
    badge: (() => {
      const d = [line([13.25, 10.25], [16, 7.5], [17.75, 9.25], [21.25, 5.75]), line([17.75, 5.75], [21.25, 5.75], [21.25, 9.25])];
      return own(d);
    })(),
  },
  'question-answer': {
    tags: ['preguntas y respuestas', 'preguntas', 'ayuda de la comunidad', 'q&a', 'questions'],
    // The question's card with its mark, and the answer's card in front of its corner
    // (the mark's point stands clear of the answer at every weight: the engine drops a dot it touches)
    d: [sq(2.25, 2.75, 12.5, 15, 3), `${arc(7, 7.5, 1.75, 180, 360).d}C8.75 9.25 7 9.25 7 11`, dot(7, 14.55)],
    badge: (() => {
      const d = [box(12.5, 11.25, 8.75, 10, 2.5), hl(15.5, 18.25, 14.75), hl(15.5, 17.5, 17.75)];
      return own(d, d[0], { solid: [d[0]], cut: d.slice(1) });
    })(),
  },
  'review': {
    tags: ['reseña', 'opinión', 'calificación', 'review', 'rating'],
    d: [CARD, star(8.6, 8.9, 3.75), hl(14.5, 17.75, 8.25), hl(6.25, 17.75, 14.25), hl(7.25, 12.75, 17.75)],
  },
  'review-edit': {
    tags: ['escribir reseña', 'opinar', 'calificar', 'write a review', 'rate'],
    d: [CARD, star(8.6, 8.9, 3.75), hl(14.5, 17.75, 8.25), hl(6.25, 17.75, 14.25), hl(7.25, 12.75, 17.75)],
    badge: badge('edit'),
  },
  'testimonial': {
    tags: ['testimonio', 'cita de cliente', 'recomendación', 'testimonial', 'quote'],
    // The person, and their words in quotation marks above them (edicion's quote)
    d: [
      ...personAt(0.7, -3.75, 0.65),
      ...['M4.9 14.5A7.63 7.63 0 0 1 9.5 7.5Q8.1 10.9 8.99 12.37A2.6 2.6 0 1 1 4.9 14.5Z', 'M13.9 14.5A7.63 7.63 0 0 1 18.5 7.5Q17.1 10.9 17.99 12.37A2.6 2.6 0 1 1 13.9 14.5Z'].map((d) => place(d, 0.62, [11.7, 7.5], [16.75, 2.75])),
    ],
  },
  'laurel-wreath': {
    tags: ['laureles', 'premio', 'mejor valorado', 'laurel', 'award', 'top rated'],
    // Two branches meeting at the bottom and open at the top: on each stem two leaves turned out and a
    // third at its tip, long lenses (4.85 by 2.9, their counters open at 2.1) 45° apart so they stand
    // clear of each other at every weight (round leaves read as beads, closer ones merged at bold)
    d: laurel({ R: 6.65, c: [12, 12.25], from: 90, to: 212, at: [125, 170], L: 4.85, W: 2.9, a: 0.6 }),
  },

  // ── Moderation and the rest ──
  'eye-alert': {
    tags: ['contenido sensible', 'advertencia', 'toca para ver', 'sensitive content', 'content warning'],
    // sistema's eye-lock eye, up and to the left of the badge
    d: [place(EYE, 0.9, [12, 12], [10.5, 9]), circ(10.5, 9, 2.5)],
    badge: badge('alert'),
  },
  'spoiler': {
    tags: ['spoiler', 'contenido oculto', 'tocar para revelar', 'hidden', 'reveal'],
    // Three lines of text; the middle one hidden under a bar with a row of dots
    d: [hl(3.25, 20.75, 5.25), sq(3.25, 8.5, 17.5, 7, 3.5), dot(6.75, 12), dot(12, 12), dot(17.25, 12), hl(3.25, 14.75, 18.75)],
  },
  'challenge': {
    tags: ['reto', 'desafío', 'cara a cara', 'challenge', 'versus'],
    // Two pennants crossed at their poles
    d: (() => {
      const pole = turnPath(vl(12, 3, 21.25), 25);
      const flag = turnPath(roundpoly([[12, 3], [18.75, 5.9], [12, 8.8]], [0, 0.8, 0]), 25);
      return [pole, flag, flipPath(pole), flipPath(flag)];
    })(),
  },
  'memories': {
    tags: ['recuerdos', 'un día como hoy', 'años anteriores', 'memories', 'on this day'],
    d: dispositivos.icons.image.d,
    badge: BACK_B,
  },
  'fundraiser': {
    tags: ['recaudación', 'colecta', 'donar', 'fundraiser', 'donation', 'goal'],
    // The heart over a progress bar at half its goal
    d: [heartAt(12, 2.5, 10), sq(3.25, 15.25, 17.5, 6, 3), hl(6.25, 12, 18.25)],
  },
  'qr-code-person': {
    tags: ['código de perfil', 'escanear para seguir', 'agregar amigo', 'profile code', 'qr code'],
    // Three finder squares, and the person where the fourth corner would be
    d: [sq(3.25, 3.25, 6, 6, 1.75), dot(6.25, 6.25), sq(14.75, 3.25, 6, 6, 1.75), dot(17.75, 6.25), sq(3.25, 14.75, 6, 6, 1.75), dot(6.25, 17.75), ...personAt(0.47, 4.75, 0.65)],
  },
  'people-nearby': {
    tags: ['personas cerca', 'cerca de ti', 'descubrir', 'people nearby', 'nearby'],
    // The person on the ground, and the signal pulsing out to each side
    d: ['M5.5 19A6.5 2 0 0 0 18.5 19A6.5 2 0 0 0 5.5 19Z', arc(12, 11.25, 7, -24, 24).d, arc(12, 11.25, 7, 156, 204).d, arc(12, 11.25, 10, -21, 21).d, arc(12, 11.25, 10, 159, 201).d],
    badge: (() => {
      const d = personAt(0.55, 0, -2.7);
      return own(d, d.join(''), { solid: d });
    })(),
  },
};

// ── Fill (DESIGN.md › Fill), by index into d ──
// `solid` is filled (and keeps its stroke); `closed` is an open outline that encloses a body and is
// filled closed with Z (the feed's second post, which runs off the bottom); `cut` is knocked out at
// stroke width; `lines` stays a line with a gap of paper; `wire` stays a line flush with the body.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const POSTS = ['post', 'post-quote', 'post-collab', 'post-pin', 'post-sparkle', 'post-shield', 'post-bag', 'post-location', 'post-plus', 'post-clock', 'post-check', 'post-lock'];
const PERSONS = ['creator', 'person-crown', 'person-gem', 'person-bell', 'person-eye', 'person-link', 'person-mute', 'person-star', 'person-arrow-up'];
const FILL = {
  // The post: the card filled, the author and the content knocked out
  ...Object.fromEntries(POSTS.map((n) => [n, { solid: [0], cut: [1, 2, 3] }])),
  'post-text': { solid: [0], cut: range(1, 5) },
  'post-quote': { solid: [0], cut: range(1, 4) },
  'fact-check': { solid: [0], cut: range(1, 5) },
  'post-audio': { solid: [0], cut: range(1, 7) },
  // The thread: the avatars filled and the line joining them flush with them; the text stays lines
  'post-thread': { solid: [0, 2], wire: [1], lines: range(3, 6) },
  feed: { solid: [0], closed: [3], cut: [1, 2, 4, 5] },
  'link-preview': { solid: [0], cut: [1, 2] },
  collection: { solid: [0, 1, 2] },
  repost: { solid: [0, 1], lines: [2, 3] },
  // The post and the people behind filled (comunicacion fills its group so), the arrow lines
  crosspost: { solid: [0, 3, 4, 5, 6], lines: [1, 2] },
  story: { solid: [0], lines: [1, 2, 3] },
  'story-plus': { solid: [0], lines: [1, 2, 3] },
  'story-ring': { solid: [4, 5], lines: [0, 1, 2, 3] },
  'short-video': { solid: [0], cut: [1] },
  remix: { solid: [0], cut: [1] },
  'watch-party': { solid: [0], cut: [1] },
  // The microphone as comunicacion fills it: the capsule solid, the holder and stem lines
  'audio-room': { solid: [0, 3, 4, 5, 6], lines: [1, 2] },
  'heart-double': { solid: [0] },
  'heart-burst': { solid: [0], lines: [1, 2, 3] },
  'live-reactions': { solid: [0, 1, 2] },
  'comment-thread': { solid: [0, 2], lines: [1] },
  'person-tag': { solid: [0], cut: [1, 2, 3] },
  profile: { solid: [0], cut: [1, 2, 3, 4] },
  'profile-card': { solid: [0], cut: [1, 2, 3] },
  'profile-deck': { solid: [0] },
  'bio-links': { solid: [0, 1, 2] },
  // Both avatars filled, the person in front knocked out: the facepile of photos
  'avatar-stack': { solid: [0, 1], cut: [2, 3] },
  ...Object.fromEntries(PERSONS.map((n) => [n, { solid: [0, 1] }])),
  // The lamp and its pool of light filled, the beams flush with them
  'person-spotlight': { solid: [0, 3], wire: [1, 2] },
  followers: { solid: range(0, 4), lines: [5] },
  'person-connection': { solid: [0, 1, 2, 3], wire: [4] },
  'mutual-friends': { solid: [2, 3], lines: [0, 1] },
  'social-graph': { solid: [0, 1, 2, 3, 4], wire: [5, 6, 7] },
  community: { solid: range(1, 6), lines: [0] },
  'member-list': { solid: [0, 2, 4], lines: [1, 3, 5] },
  'member-list-block': { solid: [0, 2, 4], lines: [1, 3, 5] },
  'people-plus': { solid: [4, 5], lines: [0, 1, 2, 3] },
  'people-minus': { solid: [4, 5], lines: [0, 1, 2, 3] },
  'people-lock': { solid: [4, 5], lines: [0, 1, 2, 3] },
  forum: { solid: [0, 2, 4], lines: [1, 3, 5] },
  discussion: { solid: range(0, 4) },
  'bulletin-board': { solid: [0], wire: [1, 2], cut: [3, 4, 5] },
  meetup: { solid: [0, 2, 3, 4, 5], cut: [1] },
  'name-tag': { solid: [0], cut: [1, 2, 3] },
  invitation: { solid: [0], cut: [1, 2] },
  poll: { solid: [2, 4], lines: [0, 1, 3, 5] },
  'poll-results': { solid: [0, 2, 3], lines: [1] },
  vote: { solid: [0, 1] },
  'question-answer': { solid: [0], cut: [1, 2] },
  review: { solid: [0], cut: [1, 2, 3, 4] },
  'review-edit': { solid: [0], cut: [1, 2, 3, 4] },
  testimonial: { solid: [0, 1, 2, 3] },
  // The leaves filled, the stems flush with them
  'laurel-wreath': { solid: [1, 2, 3, 5, 6, 7], wire: [0, 4] },
  'eye-alert': { solid: [0], cut: [1] },
  spoiler: { solid: [1], cut: [2, 3, 4], lines: [0, 5] },
  challenge: { solid: [1, 3], wire: [0, 2] },
  fundraiser: { solid: [0, 1], cut: [2] },
  'qr-code-person': { solid: [0, 2, 4, 6, 7], cut: [1, 3, 5] },
  'people-nearby': { solid: [0], lines: [1, 2, 3, 4] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const { d } = icons[name];
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? shut(d[i]) : d[i]));
  const pick = (ix) => ix.map((i) => d[i]);
  icons[name].fill = { solid, ...(spec.cut?.length && { cut: pick(spec.cut) }), ...(spec.lines?.length && { lines: pick(spec.lines) }), ...(spec.wire?.length && { wire: pick(spec.wire) }) };
}
// The photo of memories fills as dispositivos fills it (its horizon runs past the frame in the cut)
icons.memories.fill = dispositivos.icons.image.fill;
// Lines only: the hashtag (its badge, the zigzag, is lines too)
icons.trending.fill = false;

// ── 16 px (DESIGN.md › 16 px): drawings of their own where the snap leaves a smudge ──
// One pixel is 1.5 of the canvas: pixel centers fall on 0.75 + 1.5k, edges on 1.5k. Small people
// and the laurel's leaves ran together; these keep fewer pieces, one pixel apart.
/**
 * The person at 16 px: the head a 2 × 2 pixel dot on a pixel corner (x, y), the shoulders a half
 * disc 4 pixels across whose base falls on a pixel center, a pixel and a third below the head.
 */
const person16 = (x, y) => [dot(x, y, 1), `M${f(x - 2.25)} ${f(y + 6.75)}A2.25 2.25 0 0 1 ${f(x + 2.25)} ${f(y + 6.75)}Z`];
const small = (name, d, fill, badge_) => {
  icons[name].small = { d, ...(fill && { fill }), ...(badge_ && { badge: badge_ }) };
};
{
  const people = [...person16(6, 13.5), ...person16(18, 13.5)];
  const bubble = drop(12, 6, 3.75);
  small('discussion', [...people, bubble], { solid: [...people, bubble] });
  // The pin over the two people: a circle and its tangents to the tip, its hole a dot
  const a = polar(12, 6, 3.75, 45);
  const b = polar(12, 6, 3.75, 135);
  const pin = `M${P(a)}A3.75 3.75 0 1 0 ${P(b)}L12 11.3Z`;
  small('meetup', [pin, dot(12, 6), ...people], { solid: [pin, ...people], cut: [dot(12, 6)] });
  const top = person16(12, 3);
  small('community', [...top, ...people], { solid: [...top, ...people] });
  // Two people behind the front one, as two: the third one did not fit at 16 px
  const front = person16(7.5, 10.5);
  const back = person16(15, 6);
  small('followers', [...front, ...back, dot(19.5, 3, 1)], { solid: [...front, ...back, dot(19.5, 3, 1)] });
}
{
  const me = person16(12, 4.5);
  const ground = 'M6.75 16.5A5.25 2.25 0 0 0 17.25 16.5A5.25 2.25 0 0 0 6.75 16.5Z';
  const waves = [arc(12, 8.25, 7.5, -30, 30).d, arc(12, 8.25, 7.5, 150, 210).d];
  small('people-nearby', [ground, ...waves, ...me], { solid: [ground, ...me], lines: waves });
}
{
  // The microphone (capsule, holder, stem) and a listener at each side
  const capsule = sq(9.75, 2.25, 4.5, 6, 2.25);
  const holder = 'M6.75 6.75V7.5A5.25 5.25 0 0 0 17.25 7.5V6.75';
  const stem = vl(12, 12.75, 15.75);
  const people = [...person16(4.5, 13.5), ...person16(19.5, 13.5)];
  small('audio-room', [capsule, holder, stem, ...people], { solid: [capsule, ...people], lines: [holder, stem] });
}
{
  // The screen and its play triangle; the viewers in front, the row between them cleared as in 24 px
  const screen = box(2.25, 2.25, 19.5, 13.5, 3);
  const play = roundpoly([[9.75, 5.25], [14.25, 8.25], [9.75, 11.25]], [0.6, 0.6, 0.6]);
  const viewers = [...person16(6, 13.5), ...person16(18, 13.5)];
  small('watch-party', [screen, play], { solid: [screen], cut: [play] }, { d: viewers, knock: `${viewers.map(shut).join('')}${sq(6, 14.25, 12, 3, 0)}`, fill: { solid: viewers } });
}
// The two circles and the head in the lens they share
small('mutual-friends', [circ(9.75, 12, 6.75), circ(14.25, 12, 6.75), dot(12, 12, 1)]);
// One leaf on each stem and one at its tip (two leaves and the tip ran together at 16 px)
{
  const d = laurel({ R: 6.75, c: [12, 12], from: 90, to: 212, at: [150], L: 4.5, W: 3, a: 0.6 });
  small('laurel-wreath', d, { solid: [d[1], d[2], d[4], d[5]], wire: [d[0], d[3]] });
}
{
  // The tag on the pixel grid with the 16 px person inside it (snapped, the hole and the bust ran together)
  const tag = roundpoly([[2.25, 12], [6.75, 5.25], [21.75, 5.25], [21.75, 18.75], [6.75, 18.75]], [0.75, 1.2, 2.25, 2.25, 1.2]);
  const hole = dot(6.75, 12, 1);
  const me = person16(15, 8.25);
  small('person-tag', [tag, hole, ...me], { solid: [tag], cut: [hole, ...me] });
}
{
  // The post, the arrow, and the group as two 16 px people (the scaled group became a smudge)
  const card = box(2.25, 2.25, 7.5, 7.5, 2);
  const a = arc(9.75, 15, 8.25, -90, -40);
  const arrow = [a.d, head(a.end, a.tangent, 3)];
  const people = [...person16(13.5, 14.25), ...person16(19.5, 14.25)];
  small('crosspost', [card, ...arrow, ...people], { solid: [card, ...people], lines: arrow });
}

// ── Named parts (DESIGN.md › Named parts): what animates, changes level or sits under a badge ──
const PARTS = {
  ...Object.fromEntries([...POSTS, 'post-text', 'post-audio', 'fact-check'].map((n) => [n, { card: [0], author: [1, 2], content: range(3, icons[n].d.length - 1) }])),
  'post-thread': { avatars: [0, 2], thread: [1], text: range(3, 6) },
  feed: { post: [0, 1, 2], next: [3, 4, 5] },
  'link-preview': { card: [0], media: [1], title: [2] },
  collection: { tiles: [0, 1, 2] },
  repost: { post: [0], copy: [1], arrow: [2, 3] },
  crosspost: { post: [0], arrow: [1, 2], group: [3, 4, 5, 6] },
  story: { frame: [0], progress: [1, 2, 3] },
  'story-plus': { frame: [0], progress: [1, 2, 3] },
  'story-ring': { ring: [0, 1, 2, 3], head: [4], body: [5] },
  'short-video': { frame: [0], play: [1] },
  remix: { original: [0], play: [1] },
  'watch-party': { screen: [0], play: [1] },
  'audio-room': { microphone: [0, 1, 2], listeners: [3, 4, 5, 6] },
  'heart-double': { back: [0] },
  'heart-burst': { heart: [0], rays: [1, 2, 3] },
  'live-reactions': { hearts: [0, 1, 2] },
  'comment-thread': { comment: [0], thread: [1], reply: [2] },
  'person-tag': { tag: [0, 1], person: [2, 3] },
  profile: { card: [0], cover: [1], avatar: [2], bio: [3, 4] },
  'profile-card': { card: [0], avatar: [1], name: [2], button: [3] },
  'profile-deck': { back: [0] },
  'bio-links': { avatar: [0], links: [1, 2] },
  'avatar-stack': { back: [0], front: [1, 2, 3] },
  ...Object.fromEntries(PERSONS.map((n) => [n, { head: [0], body: [1] }])),
  'person-spotlight': { lamp: [0], beam: [1, 2], pool: [3] },
  followers: { front: [0, 1], back: [2, 3, 4, 5] },
  'person-connection': { people: [0, 1, 2, 3], link: [4] },
  'mutual-friends': { circles: [0, 1], person: [2, 3] },
  'social-graph': { person: [0, 1], nodes: [2, 3, 4], links: [5, 6, 7] },
  community: { ring: [0], people: range(1, 6) },
  'member-list': { avatars: [0, 2, 4], names: [1, 3, 5] },
  'member-list-block': { avatars: [0, 2, 4], names: [1, 3, 5] },
  ...Object.fromEntries(['people-plus', 'people-minus', 'people-lock'].map((n) => [n, { back: [0, 1, 2, 3], front: [4, 5] }])),
  forum: { topics: [0, 2, 4], titles: [1, 3, 5] },
  discussion: { people: [0, 1, 2, 3], bubble: [4] },
  'bulletin-board': { board: [0, 1, 2], notice: [3, 4, 5] },
  meetup: { pin: [0, 1], people: [2, 3, 4, 5] },
  'name-tag': { tag: [0], band: [1, 2], name: [3] },
  invitation: { card: [0, 1, 2] },
  poll: { choice: [0], options: [2, 4], text: [1, 3, 5] },
  'poll-results': { bars: [0, 2, 3], mark: [1] },
  vote: { up: [0], down: [1] },
  trending: { hashtag: [0, 1, 2, 3] },
  'question-answer': { question: [0], mark: [1, 2] },
  review: { card: [0], star: [1], text: [2, 3, 4] },
  'review-edit': { card: [0], star: [1], text: [2, 3, 4] },
  testimonial: { person: [0, 1], quote: [2, 3] },
  'laurel-wreath': { stems: [0, 4], leaves: [1, 2, 3, 5, 6, 7] },
  'eye-alert': { body: [0], pupil: [1] },
  spoiler: { text: [0, 5], cover: [1, 2, 3, 4] },
  challenge: { poles: [0, 2], flags: [1, 3] },
  memories: { frame: [0], sun: [1], mountain: [2] },
  fundraiser: { heart: [0], bar: [1], progress: [2] },
  'qr-code-person': { finders: range(0, 5), person: [6, 7] },
  'people-nearby': { ground: [0] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Levels (DESIGN.md › Levels): the signal around people nearby lights up from the inside out ──
icons['people-nearby'].levels = [
  [1, 2],
  [3, 4],
];
icons['people-nearby'].parts.level = [1, 2, 3, 4];

// ── Automatic variants that make no sense ──
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// The square card is already the square enclosure (as Núcleo's project): no square around it
variants([...POSTS, 'post-text', 'post-audio', 'fact-check', 'link-preview', 'profile', 'review', 'review-edit', 'collection', 'qr-code-person'], { square: false });
// Already in a circle
variants(['story-ring', 'community'], { circle: false });
// No slashed variant on a badge (the slash would cut through it) nor on loose lines
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, slash: false };
variants(['trending'], { slash: false });

// ── Mirroring (DESIGN.md › Mirroring): lists and threads that read from the start of the line,
// arrows and trails that run in the reading direction, charts that grow ──
for (const name of ['post-thread', 'comment-thread', 'member-list', 'member-list-block', 'forum', 'poll', 'poll-results', 'repost', 'crosspost', 'trending', 'followers'])
  icons[name].mirror = true;

// ── Motion (DESIGN.md › Motion): each icon's own gesture ──
icons['post-pin'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -2] };
icons['post-location'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -2] };
icons['post-sparkle'].motion = { effect: 'beat', parts: ['badge'], origin: BC };
icons.repost.motion = { effect: 'slide', parts: ['arrow'], vector: [1, 1] };
icons.crosspost.motion = { effect: 'slide', parts: ['arrow'], vector: [1, 1] };
icons['story-ring'].motion = { effect: 'spin', parts: ['ring'], origin: [12, 12] };
icons['heart-double'].motion = { effect: 'beat', origin: [12, 12] };
icons['heart-burst'].motion = { effect: 'beat', origin: [12, 15.25] };
icons['live-reactions'].motion = { effect: 'float', vector: [0, -2] };
icons['person-bell'].motion = { effect: 'ring', parts: ['badge'], origin: BELL_TOP };
icons['person-star'].motion = { effect: 'beat', parts: ['badge'], origin: BC };
icons['person-arrow-up'].motion = { effect: 'slide', parts: ['badge'], vector: [0, -2] };
icons['person-crown'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] };
icons.trending.motion = { effect: 'slide', parts: ['badge'], vector: [1.5, -1.5] };
icons.invitation.motion = { effect: 'slide', parts: ['card'], vector: [0, -2] };
icons.memories.motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons.challenge.motion = { effect: 'wiggle', origin: [12, 21.25] };
icons.fundraiser.motion = { effect: 'beat', parts: ['heart'], origin: [12, 7.5] };
icons['eye-alert'].motion = { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] };

export default { category: 'social', label: 'Social y comunidad', icons };
