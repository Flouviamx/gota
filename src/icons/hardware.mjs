// Hardware and electronics: boards and modules, components, schematic symbols and logic gates,
// signals, connectors, power and cells, bench instruments and digital fabrication. Everything is
// computed with engine/geometry.mjs on the rules in DESIGN.md: a 1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on boards, plates and enclosures (the cpu and the
// memory chip stay in datos, the finished devices in dispositivos).
import { arc, badge, circ, dot, f, halfChord, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { transform } from '../../engine/variants.mjs';
import dispositivos from './dispositivos.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────────
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
const BR = { square: ['br'] };
/** A board, plate or enclosure: continuous corners and the signature square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);
/** Several open strokes written as one path (a row of legs, a comb of pins). */
const many = (...ds) => ds.join('');
/** An open stroke from the outline, closed for `fill.solid` (solid only takes closed shapes). */
const shut = (d) => `${d}Z`;

/** Capsule (semicircular ends), horizontal or vertical depending on the longer side. */
function pill(x, y, w, h) {
  if (w >= h) {
    const r = h / 2;
    const R = halfChord([x + w - r, y], [x + w - r, y + h]);
    return `M${pt([x + r, y])}H${f(x + w - r)}A${R} ${R} 0 0 1 ${pt([x + w - r, y + h])}H${f(x + r)}A${R} ${R} 0 0 1 ${pt([x + r, y])}Z`;
  }
  const r = w / 2;
  const R = halfChord([x, y + r], [x + w, y + r]);
  return `M${pt([x, y + r])}A${R} ${R} 0 0 1 ${pt([x + w, y + r])}V${f(y + h - r)}A${R} ${R} 0 0 1 ${pt([x, y + h - r])}Z`;
}

/** Open polyline with rounded interior corners (one radius per vertex, or one for all). */
function rline(pts, r = 0) {
  const rr = Array.isArray(r) ? r : pts.map(() => r);
  let d = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    let [ux, uy] = [A[0] - V[0], A[1] - V[1]];
    const lu = Math.hypot(ux, uy);
    ux /= lu;
    uy /= lu;
    let [vx, vy] = [B[0] - V[0], B[1] - V[1]];
    const lv = Math.hypot(vx, vy);
    vx /= lv;
    vy /= lv;
    const th = Math.acos(Math.max(-1, Math.min(1, ux * vx + uy * vy)));
    if (!rr[i] || th > Math.PI - 1e-6) {
      d += `L${pt(V)}`;
      continue;
    }
    const t = rr[i] / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    d += `L${pt([V[0] + ux * t, V[1] + uy * t])}A${f(rr[i])} ${f(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${pt([V[0] + vx * t, V[1] + vy * t])}`;
  }
  return `${d}L${pt(pts[pts.length - 1])}`;
}

/** A path moved by (dx, dy), in absolute coordinates. */
const move = (d, dx, dy) => transform(d, 1, dx, dy);

/** Ellipse (two half arcs), for lids, lenses and openings. */
function ellipse(cx, cy, rx, ry) {
  return `M${pt([cx - rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx + rx, cy])}A${f(rx)} ${f(ry)} 0 1 0 ${pt([cx - rx, cy])}Z`;
}

/**
 * An upright cylinder seen a little from above, between x0 and x1, its rims at y0 and y1 (each an
 * ellipse of height 2·ry): the silhouette (closed) and the front of a rim at y (open), for the can of
 * a capacitor, the lidar's puck.
 */
const can = (x0, x1, y0, y1, ry) => {
  const rx = f((x1 - x0) / 2);
  return {
    body: `M${pt([x0, y0])}A${rx} ${f(ry)} 0 0 1 ${pt([x1, y0])}V${f(y1)}A${rx} ${f(ry)} 0 0 1 ${pt([x0, y1])}Z`,
    rim: (y) => `M${pt([x0, y])}A${rx} ${f(ry)} 0 0 0 ${pt([x1, y])}`,
  };
};

/**
 * A rod of half-width w from `from` out along `deg` to length `len`, its far end round and its near
 * end open (it starts on another piece's edge: the iron in its holder).
 */
function rod(from, deg, len, w) {
  const n = polar(0, 0, w, deg + 90);
  const [p0, p1] = [polar(...from, 0, deg), polar(...from, len, deg)];
  const [a, b] = [[p1[0] + n[0], p1[1] + n[1]], [p1[0] - n[0], p1[1] - n[1]]];
  // The cap turns against the screen's clockwise sweep, so it bulges forward, along deg
  const R = halfChord(a, b);
  return `M${pt([p0[0] + n[0], p0[1] + n[1]])}L${pt(a)}A${R} ${R} 0 0 0 ${pt(b)}L${pt([p0[0] - n[0], p0[1] - n[1]])}`;
}

// ── Paths as points ───────────────────────────────────────────────────────────────────────────
// The engine's paths sampled as polylines, to find where a stroke that has to start on an outline
// (a leg under a round body, a stripe on a can's continuous corner) meets it: it starts exactly
// there and touches, instead of stopping short or poking through.
function samples(d) {
  const toks = transform(d, 1, 0, 0).match(/[MLHVCAZ]|-?(?:\d+\.?\d*|\.\d+)/gi);
  const runs = [];
  let [i, cmd, p, start, run] = [0, '', [0, 0], [0, 0], null];
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Z]/i.test(toks[i])) cmd = toks[i++].toUpperCase();
    if (cmd === 'M') {
      p = start = [num(), num()];
      run = [p];
      runs.push(run);
      cmd = 'L';
    } else if (cmd === 'L' || cmd === 'H' || cmd === 'V') {
      p = cmd === 'L' ? [num(), num()] : cmd === 'H' ? [num(), p[1]] : [p[0], num()];
      run.push(p);
    } else if (cmd === 'C') {
      const [a, b, c, e] = [p, [num(), num()], [num(), num()], [num(), num()]];
      for (let k = 1; k <= 16; k++) {
        const t = k / 16;
        const m = 1 - t;
        run.push([0, 1].map((j) => m * m * m * a[j] + 3 * m * m * t * b[j] + 3 * m * t * t * c[j] + t * t * t * e[j]));
      }
      p = e;
    } else if (cmd === 'A') {
      const [rx, ry, , large, sweep] = [num(), num(), num(), num(), num()];
      const q = [num(), num()];
      // Center of an axis-aligned elliptical arc from p to q (SVG's endpoint parameterization)
      const [x1, y1] = [(p[0] - q[0]) / 2, (p[1] - q[1]) / 2];
      const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
      const [RX, RY] = lam > 1 ? [rx * Math.sqrt(lam), ry * Math.sqrt(lam)] : [rx, ry];
      const num2 = RX * RX * RY * RY - RX * RX * y1 * y1 - RY * RY * x1 * x1;
      const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / (RX * RX * y1 * y1 + RY * RY * x1 * x1)));
      const c = [(k * RX * y1) / RY + (p[0] + q[0]) / 2, (-k * RY * x1) / RX + (p[1] + q[1]) / 2];
      const t0 = Math.atan2((p[1] - c[1]) / RY, (p[0] - c[0]) / RX);
      let dt = Math.atan2((q[1] - c[1]) / RY, (q[0] - c[0]) / RX) - t0;
      if (sweep && dt < 0) dt += 2 * Math.PI;
      if (!sweep && dt > 0) dt -= 2 * Math.PI;
      for (let s = 1; s <= 24; s++) {
        const t = t0 + (dt * s) / 24;
        run.push([c[0] + RX * Math.cos(t), c[1] + RY * Math.sin(t)]);
      }
      p = q;
    } else if (cmd === 'Z') {
      run.push(start);
      p = start;
      cmd = '';
    } else throw new Error(`samples: ${cmd}`);
  }
  return runs;
}
/** Where an outline crosses the vertical line x (every y, top to bottom). */
function atX(d, x) {
  const out = [];
  for (const run of samples(d))
    for (let k = 1; k < run.length; k++) {
      const [a, b] = [run[k - 1], run[k]];
      if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) out.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
  return out.sort((u, v) => u - v);
}
/** Where an outline crosses the horizontal line y (every x, left to right). */
function atY(d, y) {
  const out = [];
  for (const run of samples(d))
    for (let k = 1; k < run.length; k++) {
      const [a, b] = [run[k - 1], run[k]];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) out.push(a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]));
    }
  return out.sort((u, v) => u - v);
}
const top = (d, x) => atX(d, x)[0];
const bottom = (d, x) => atX(d, x).at(-1);
const left = (d, y) => atY(d, y)[0];
const right = (d, y) => atY(d, y).at(-1);

// ── Shared pieces ─────────────────────────────────────────────────────────────────────────────
// Every through-hole component stands on legs of one length; the longer leg of a polarized part
// (the capacitor, the LED) runs 2 further. Axial parts (the resistor, the diode) lie on leads of
// the same length.
const LEG = 3.5;
const LONG = LEG + 2;
/** Legs hanging from an outline at the given xs, LEG long below the outline's lowest point. */
const legs = (d, xs, len = LEG) => {
  const foot = Math.max(...xs.map((x) => bottom(d, x)));
  return many(...xs.map((x) => line([x, bottom(d, x)], [x, foot + len])));
};
/** Axial leads: the body's ends on y, LEG long out to each side. */
const leads = (x0, x1, y = 12) => many(line([x0 - LEG, y], [x0, y]), line([x1, y], [x1 + LEG, y]));

/** The plate dispositivos' ethernet port sits on: every port in this set sits on it too. */
const PLATE = dispositivos.icons.ethernet.d[0];

// The mouths of the ports on the plate: polygons and their corner radii, so the fill can empty them
// with a hole of the same shape (as dispositivos' ethernet does)
const MOUTH = {
  usbC: [[[5.75, 9], [18.25, 9], [18.25, 15], [5.75, 15]], 3],
  usbA: [[[6.5, 9], [17.5, 9], [17.5, 15], [6.5, 15]], 1],
  micro: [[[6, 9], [18, 9], [16, 15], [8, 15]], 1],
  hdmi: [[[5.5, 9], [18.5, 9], [18.5, 12.5], [16, 15], [8, 15], [5.5, 12.5]], [1, 1, 0.75, 0.75, 0.75, 0.75]],
  dsub: [[[6, 8.25], [18, 8.25], [16, 15.75], [8, 15.75]], 2],
  inlet: [[[9.375, 7.5], [14.625, 7.5], [16.875, 9.75], [16.875, 17.25], [7.125, 17.25], [7.125, 9.75]], [1, 1, 1.5, 2, 2, 1.5]],
};
const mouth = (k) => roundpoly(...MOUTH[k]);
/**
 * The plate with the mouth emptied, for the fill: the mouth grown 0.75 (to the outer edge of its
 * line), wound the other way so it is a hole. Its edges move out along their normals and its
 * corners keep their centers.
 */
function holed(k) {
  const [pts, radius] = MOUTH[k];
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  const c = [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
  const n = pts.length;
  const edge = (i) => {
    const [a, b] = [pts[i], pts[(i + 1) % n]];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let [nx, ny] = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L];
    if ((a[0] - c[0]) * nx + (a[1] - c[1]) * ny < 0) [nx, ny] = [-nx, -ny];
    return { a: [a[0] + nx * 0.75, a[1] + ny * 0.75], u: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
  };
  const out = pts.map((_, i) => {
    const [A, B] = [edge((i - 1 + n) % n), edge(i)];
    const den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
    const t = ((B.a[0] - A.a[0]) * B.u[1] - (B.a[1] - A.a[1]) * B.u[0]) / den;
    return [A.a[0] + A.u[0] * t, A.a[1] + A.u[1] * t];
  });
  return PLATE + roundpoly(out.toReversed(), rr.map((r) => r + 0.75).toReversed());
}

/** A plug: a 5 × 6 body centered on (x, y) and its two prongs out toward `dir` (−1 left, 1 right). */
const plug = (x, y, dir) => [sq(x - 2.5, y - 3, 5, 6, 1.25), many(...[-1.5, 1.5].map((k) => line([x + 2.5 * dir, y + k], [x + 5 * dir, y + k])))];

/** The DIP chip: a portrait body with its notch, four legs a side. */
const CHIP_X = [8.25, 15.75];
const CHIP_Y = [2.75, 21.25];
const CHIP_LEGS = [6, 10, 14, 18];
function microchip() {
  const [x0, x1] = CHIP_X;
  const [y0, y1] = CHIP_Y;
  const r = 2;
  const k = 1.75;
  // The outline with the half-circle notch dipping into the top edge
  const body = `M${pt([12 + k, y0])}H${f(x1 - r)}A${r} ${r} 0 0 1 ${pt([x1, y0 + r])}V${f(y1 - r)}A${r} ${r} 0 0 1 ${pt([x1 - r, y1])}H${f(x0 + r)}A${r} ${r} 0 0 1 ${pt([x0, y1 - r])}V${f(y0 + r)}A${r} ${r} 0 0 1 ${pt([x0 + r, y0])}H${f(12 - k)}A${f(k)} ${f(k)} 0 0 0 ${pt([12 + k, y0])}Z`;
  return [body, many(...CHIP_LEGS.map((y) => line([x0 - LEG, y], [x0, y]))), many(...CHIP_LEGS.map((y) => line([x1, y], [x1 + LEG, y])))];
}

/**
 * The sensor breakout: a small square board, its round window, a mounting hole in each corner (two
 * at the top alone read as a face) and three pins.
 */
const SENSOR_HOLES = [[7.25, 6.5], [16.75, 6.5], [7.25, 14.25], [16.75, 14.25]];
function sensorModule() {
  return [box(4, 3.25, 16, 14.25, 3.5), circ(12, 10.375, 3.25), ...SENSOR_HOLES.map(([x, y]) => dot(x, y, 0.3)), many(...[9, 12, 15].map((x) => line([x, 17.5], [x, 17.5 + LEG])))];
}

/**
 * The microcontroller board: a narrow board, its USB tab, a square chip under the tab and two
 * columns of pins. The chip sits high and the pins stand 3 from it and from the board's edge, so a
 * badge's clearance either takes a pin whole (the engine removes it) or leaves it, and never nicks
 * the chip.
 */
const MCU_ROWS = [8, 11, 14, 17];
function mcuBoard() {
  return [
    box(4.25, 4.75, 15.5, 16.5, 3),
    rline([[9.75, 4.75], [9.75, 2], [14.25, 2], [14.25, 4.75]], 0.75),
    sq(10.5, 7.75, 3, 3, 0.9),
    ...MCU_ROWS.map((y) => dot(7.25, y, 0.3)),
    ...MCU_ROWS.map((y) => dot(16.75, y, 0.3)),
  ];
}

/** The add-in card: the bracket at its left end, the board, and its edge connector's teeth. */
const CARD = { x: 6.25, y: 3.75, w: 15.25, h: 13 };
function card() {
  const { x, y, w, h } = CARD;
  return [line([3.25, 4], [3.25, 19.25]), box(x, y, w, h, 3), many(...[10.75, 13.875, 17].map((t) => line([t, y + h], [t, y + h + 2.5])))];
}

/**
 * A fan's blades: `n` curved blades from the hub out to `R`, each an arc sweeping clockwise. The
 * same blades turn in the graphics card, the case fan and the power supply.
 */
function fanBlades(c, hub, R, n, start = -90, sweep = 62) {
  return Array.from({ length: n }, (_, i) => {
    const a = start + (360 / n) * i;
    const p0 = polar(...c, hub, a);
    const p1 = polar(...c, R, a + sweep);
    const chord = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    return `M${pt(p0)}A${f(chord * 0.85)} ${f(chord * 0.85)} 0 0 1 ${pt(p1)}`;
  });
}

/**
 * The DC motor: a can lying down seen a little from the front (its back a half ellipse, its face a
 * full one), the shaft out of the face and two tabs out of the back.
 */
const MOTOR_CAN = { x0: 5, x1: 16, y0: 6.5, y1: 17.5, rx: 2.25 };
const MOTOR = (() => {
  const { x0, x1, y0, y1, rx } = MOTOR_CAN;
  const ry = (y1 - y0) / 2;
  const body = `M${pt([x1, y0])}H${f(x0 + rx)}A${f(rx)} ${f(ry)} 0 0 0 ${pt([x0 + rx, y1])}H${f(x1)}`;
  const face = `M${pt([x1, y0])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([x1, y1])}A${f(rx)} ${f(ry)} 0 0 1 ${pt([x1, y0])}Z`;
  return [body, face, line([x1 + rx, 12], [21.5, 12]), many(...[9.5, 14.5].map((y) => line([left(body, y), y], [2.25, y])))];
})();
/** The motor's silhouette for the fill: its outline closed round the front of the face. */
const MOTOR_SOLID = (() => {
  const { x1, y0, y1, rx } = MOTOR_CAN;
  return `${MOTOR[0]}A${f(rx)} ${f((y1 - y0) / 2)} 0 0 0 ${pt([x1, y0])}Z`;
})();

/** Rising heat: a wavy line from (x, y0) up to (x, y0 - 7), two gentle bends. */
const heat = (x, y0) => `M${pt([x, y0])}c1.5 -1.2 1.5 -2.3 0 -3.5s-1.5 -2.3 0 -3.5`;

// ── Schematic symbols and logic gates: one grid ──────────────────────────────────────────────
// Every symbol lies on the axis y 12 and every lead (a symbol's, a gate's inputs and output) is
// LEAD long; the gates are 10 tall with their inputs 5 apart and bodies 8 long.
const LEAD = 3;
const AX = 12;
const [AX0, AX1] = [3, 21];
/** The diode: a triangle pointing at its bar, a lead on each side. */
const DIODE = [
  many(line([8.75 - LEAD, AX], [8.75, AX]), line([15.25, AX], [15.25 + LEAD, AX])),
  roundpoly([[8.75, 7.5], [15.25, AX], [8.75, 16.5]], [0.75, 0.3, 0.75]),
  line([15.25, 7.5], [15.25, 16.5]),
];
/** The open switch: two terminals on the line, the lever hinged on the left one and lifted. */
const SWITCH = [many(line([AX0, AX], [6, AX]), line([18, AX], [AX1, AX])), dot(6, AX), dot(18, AX), line([6, AX], [17, AX - 6])];

const GATE = { top: 7, bottom: 17, in: [9.5, 14.5], len: 8, bubble: 1.5, gap: 3.25 };
/** The OR gate's concave back from (x, 7) to (x, 17), bulging 1.25 into the body. */
const orBack = (x) => `M${pt([x, GATE.top])}Q${pt([x + 2.5, AX])} ${pt([x, GATE.bottom])}`;
/** Where the OR back meets the line y (its x): the curve is linear in y. */
const orBackX = (x, y) => {
  const t = (y - GATE.top) / (GATE.bottom - GATE.top);
  return x + 5 * t * (1 - t);
};
/**
 * A logic gate centered on the canvas: the body (AND's D, OR's shield, NOT's triangle), XOR's
 * second back, the bubble of the inverted ones, two inputs (one for NOT) and the output.
 */
function gate(kind) {
  const or = /or$/.test(kind) && kind !== 'nor' ? true : kind === 'nor';
  const x2 = kind === 'xor' || kind === 'xnor';
  const inv = ['not', 'nand', 'nor', 'xnor'].includes(kind);
  const width = LEAD + (x2 ? GATE.gap : 0) + GATE.len + (inv ? 2 * GATE.bubble : 0) + LEAD;
  const start = Math.round((12 - width / 2) * 4) / 4;
  const x0 = start + LEAD + (x2 ? GATE.gap : 0);
  const front = x0 + GATE.len;
  let body;
  let tipX = front;
  if (kind === 'not') {
    const r = 0.45;
    body = roundpoly([[x0, GATE.top], [front, AX], [x0, GATE.bottom]], [0.75, r, 0.75]);
    tipX = front - r * (1 / Math.sin(Math.atan(5 / 8)) - 1);
  } else if (or) body = `M${pt([x0, GATE.top])}C${pt([x0 + 4, GATE.top])} ${pt([x0 + 6.75, 9])} ${pt([front, AX])}C${pt([x0 + 6.75, 15])} ${pt([x0 + 4, GATE.bottom])} ${pt([x0, GATE.bottom])}Q${pt([x0 + 2.5, AX])} ${pt([x0, GATE.top])}Z`;
  else body = `M${pt([x0 + 3, GATE.top])}A5 5 0 0 1 ${pt([x0 + 3, GATE.bottom])}H${f(x0 + 0.75)}A0.75 0.75 0 0 1 ${pt([x0, GATE.bottom - 0.75])}V${f(GATE.top + 0.75)}A0.75 0.75 0 0 1 ${pt([x0 + 0.75, GATE.top])}Z`;
  const back = x2 ? x0 - GATE.gap : x0;
  const inEnd = (y) => (or ? orBackX(back, y) : back);
  const ins = kind === 'not' ? [line([start, AX], [x0, AX])] : [many(...GATE.in.map((y) => line([start, y], [inEnd(y), y])))];
  const out = inv ? tipX + 2 * GATE.bubble : front;
  return [body, ...(x2 ? [orBack(x0 - GATE.gap)] : []), ...(inv ? [circ(tipX + GATE.bubble, AX, GATE.bubble)] : []), ...ins, line([out, AX], [out + LEAD, AX])];
}

/** The transistor symbol's circle and its emitter's diagonal. */
const TRANSISTOR_R = 8;
const TRANSISTOR_E = [[10.5, 13.75], [14.5, 16.5]];

/** A wave across the canvas: `y(u)` over one and a half periods (u from 0 to 1.5), amplitude 5. */
function wave(y, x0 = 2.5, x1 = 21.5, amp = 5) {
  const pts = [];
  for (let k = 0; k <= 96; k++) {
    const u = (k / 96) * 1.5;
    pts.push([x0 + ((x1 - x0) * k) / 96, AX - amp * y(u)]);
  }
  return `M${pts.map(pt).join('L')}`;
}

/** A print head (the laser's too): a small block that narrows to its nozzle, its top at y. */
const HEAD = (x, y) => roundpoly([[x - 2.5, y], [x + 2.5, y], [x + 2.5, y + 4.25], [x, y + 7], [x - 2.5, y + 4.25]], [1, 1, 0.75, 0.5, 0.75]);
/** The rail the head runs on (printer and laser), parted where the head hangs from it. */
const RAIL = many(line([2.75, 5], [9.5, 5]), line([14.5, 5], [21.25, 5]));
/**
 * The FDM printer, drawn once: the head on its rail, the bed in perspective below, and the part it
 * prints, a cube standing on the bed 3 under the nozzle; the bed's back edge is parted round it
 * (a box on the back edge read as a handbag) and ends 3 from its sides.
 */
const CUBE = { cx: 12, top: 12.75, w: 3, h: 2.75 };
const PRINTER = (() => {
  const { cx, top: y, w, h } = CUBE;
  const dy = w / 2;
  return [
    RAIL,
    HEAD(12, 2.75),
    rline([[cx + w + 3, 16.25], [21.5, 16.25], [18, 21.25], [2.5, 21.25], [cx - w - 3, 16.25]], [0, 1, 1, 1, 0]),
    roundpoly([[cx, y], [cx + w, y + dy], [cx + w, y + dy + h], [cx, y + 2 * dy + h], [cx - w, y + dy + h], [cx - w, y + dy]], 0.6),
    many(line([cx - w, y + dy], [cx, y + 2 * dy], [cx + w, y + dy]), line([cx, y + 2 * dy], [cx, y + 2 * dy + h])),
  ];
})();

const icons = {
  // ── Boards and modules ────────────────────────────────────────────────────────────────────
  'circuit-board': {
    tags: ['placa de circuito', 'pcb', 'electrónica', 'circuit board', 'electronics', 'hardware'],
    // Three traces rise from the bottom edge, bend at 45° and end in pads, in a staircase
    d: [
      box(3.25, 3.25, 17.5, 17.5, 4),
      line([10, 20.75], [10, 18.5], [6.5, 15]),
      line([13.5, 20.75], [13.5, 15], [10, 11.5]),
      line([17, 20.75], [17, 11.5], [13.5, 8]),
      dot(6.5, 15),
      dot(10, 11.5),
      dot(13.5, 8),
    ],
  },
  motherboard: {
    tags: ['placa base', 'tarjeta madre', 'pc', 'motherboard', 'mainboard', 'pc build'],
    // The socket at the upper left, two memory slots beside it, two expansion slots across the
    // bottom; every end 3 from the board and from each other
    d: [
      box(4, 2.75, 16, 18.5, 3.75),
      sq(6.75, 5.75, 4, 4, 1.25),
      many(line([13.75, 6.25], [13.75, 11]), line([16.75, 6.25], [16.75, 11])),
      many(line([7, 14], [16.75, 14]), line([7, 17], [12.5, 17])),
    ],
  },
  'graphics-card': {
    tags: ['tarjeta gráfica', 'gpu', 'tarjeta de video', 'graphics card', 'video card', 'rendering'],
    // The card's fan: a shroud 3 inside the card, the hub and three blades
    d: (() => {
      const c = [CARD.x + CARD.w / 2, CARD.y + CARD.h / 2];
      return [...card(), circ(...c, 3.5), dot(...c), ...fanBlades(c, 0.7, 3.5, 3, -90, 75)];
    })(),
  },
  'expansion-card': {
    tags: ['tarjeta de expansión', 'pcie', 'componente', 'expansion card', 'add-in card', 'pci'],
    // The card's chip and a column of small parts beside it (two chips side by side read as the
    // memory module's, or as a pair of eyes)
    d: [...card(), sq(9, 7.5, 5.5, 5.5, 1.5), ...[7.25, 10.25, 13.25].map((y) => dot(17.75, y, 0.3))],
  },
  microchip: {
    tags: ['chip', 'circuito integrado', 'componente', 'microchip', 'integrated circuit', 'ic'],
    d: microchip(),
  },
  'microcontroller-board': {
    tags: ['microcontrolador', 'placa de desarrollo', 'arduino', 'microcontroller', 'dev board', 'embedded'],
    d: mcuBoard(),
  },
  'single-board-computer': {
    tags: ['computadora de placa', 'raspberry', 'homelab', 'single board computer', 'sbc', 'iot'],
    // The header along the top edge, the processor, and two port blocks out of the right edge
    d: [
      box(2.5, 5, 16.5, 14, 3),
      ...[6, 9, 12, 15].map((x) => dot(x, 8, 0.3)),
      sq(6, 11.25, 5.5, 5, 1.25),
      rline([[19, 7.5], [21.5, 7.5], [21.5, 10.5], [19, 10.5]], 0.75),
      rline([[19, 13.5], [21.5, 13.5], [21.5, 17], [19, 17]], 0.75),
    ],
  },
  breadboard: {
    tags: ['protoboard', 'prototipo', 'circuito', 'breadboard', 'prototyping', 'solderless'],
    // Two halves of holes on each side of the center channel
    d: [box(2.5, 3.75, 19, 16.5, 4), line([5.5, 12], [18.5, 12]), ...[6.75, 9.5, 14.5, 17.25].flatMap((y) => [7.75, 12, 16.25].map((x) => dot(x, y, 0.3)))],
  },
  'silicon-wafer': {
    tags: ['oblea', 'semiconductor', 'silicio', 'wafer', 'silicon', 'chip manufacturing'],
    // A circle with its flat at the bottom, and the grid of the dies across it: two lines each way,
    // so the middle die is whole and the edge ones cut by the rim (three each way passed 28% ink)
    d: (() => {
      const [R, y] = [8.75, 19];
      const at = (v) => Math.sqrt(R * R - (v - 12) ** 2);
      const wafer = `M${pt([12 + at(y), y])}A${R} ${R} 0 1 0 ${pt([12 - at(y), y])}Z`;
      const grid = [9.75, 14.25];
      return [wafer, many(...grid.map((x) => line([x, 12 - at(x)], [x, Math.min(y, 12 + at(x))]))), many(...grid.map((v) => line([12 - at(v), v], [12 + at(v), v])))];
    })(),
  },
  'cpu-socket': {
    tags: ['zócalo', 'socket', 'procesador', 'cpu socket', 'lga', 'compatibility'],
    d: [
      box(2.75, 5.25, 13.5, 13.5, 3),
      ...[8, 11.5, 15].flatMap((y) => [6, 9.5, 13].map((x) => dot(x, y, 0.3))),
      // The retention lever along its right side, its tip bent over into a hook
      'M19.25 18.75V6.5A1.25 1.25 0 0 1 21.75 6.5',
    ],
  },
  'wireless-module': {
    tags: ['módulo inalámbrico', 'wifi', 'bluetooth', 'wireless module', 'radio', 'lora'],
    // The meandering antenna fed from the chip below it, pins along the bottom edge
    d: [
      box(4.5, 2.75, 15, 15, 3),
      line([8.5, 12.25], [8.5, 5.75], [11.5, 5.75], [11.5, 9], [14.5, 9], [14.5, 5.75], [16.5, 5.75]),
      sq(7.5, 12.25, 8.5, 2.75, 1),
      many(...[8.5, 12, 15.5].map((x) => line([x, 17.75], [x, 17.75 + LEG]))),
    ],
  },
  'sensor-module': {
    tags: ['módulo de sensor', 'sensor', 'iot', 'sensor module', 'breakout', 'telemetry'],
    d: sensorModule(),
  },
  'camera-module': {
    tags: ['módulo de cámara', 'cámara', 'visión', 'camera module', 'embedded vision', 'lens'],
    d: [box(4.25, 2.75, 15.5, 15, 3.5), circ(12, 10.25, 4.5), circ(12, 10.25, 1.5), rline([[9.5, 17.75], [9.5, 21.25], [14.5, 21.25], [14.5, 17.75]], 0.75)],
  },
  'display-module': {
    tags: ['módulo de pantalla', 'lcd', 'oled', 'display module', 'screen', 'embedded display'],
    d: [box(2.5, 8, 19, 11.75, 3.25), box(5.5, 11, 13, 5.75, 1.5), many(...[8.25, 11, 13.75, 16.5].map((x) => line([x, 8], [x, 8 - LEG])))],
  },
  'seven-segment-display': {
    tags: ['siete segmentos', 'dígito', 'display', 'seven segment', 'digit', 'led display'],
    d: (() => {
      // A figure eight of seven separate segments, slanted 8°, and the decimal point; the segments'
      // ends stand 3.1 apart at the corners
      const [x0, x1, y0, y1] = [6.75, 15.25, 4, 20];
      const ym = (y0 + y1) / 2;
      const g = 2.2;
      const k = Math.tan((8 * Math.PI) / 180);
      const S = ([x, y]) => [x + (ym - y) * k, y];
      const seg = (a, b) => line(S(a), S(b));
      return [
        seg([x0 + g, y0], [x1 - g, y0]),
        seg([x1, y0 + g], [x1, ym - g]),
        seg([x1, ym + g], [x1, y1 - g]),
        seg([x0 + g, y1], [x1 - g, y1]),
        seg([x0, ym + g], [x0, y1 - g]),
        seg([x0, y0 + g], [x0, ym - g]),
        seg([x0 + g, ym], [x1 - g, ym]),
        dot(...S([x1 + 3.25, y1])),
      ];
    })(),
  },
  'led-matrix': {
    tags: ['matriz de led', 'leds', 'letrero', 'led matrix', 'dot matrix', 'signage'],
    d: [box(3.25, 3.25, 17.5, 17.5, 4), ...[7.25, 10.5, 13.75, 17].flatMap((y) => [7, 10.33, 13.67, 17].map((x) => dot(x, y - 0.25, 0.3)))],
  },

  // ── Components ────────────────────────────────────────────────────────────────────────────
  resistor: {
    tags: ['resistencia', 'resistor', 'componente', 'ohm', 'electronics', 'bom'],
    // A dog bone on its leads: two bulbs and a waist, a color band across each
    d: [
      roundpoly(
        [
          [6, 8],
          [9.25, 8],
          [10.5, 9.25],
          [13.5, 9.25],
          [14.75, 8],
          [18, 8],
          [18, 16],
          [14.75, 16],
          [13.5, 14.75],
          [10.5, 14.75],
          [9.25, 16],
          [6, 16],
        ],
        [2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2],
      ),
      leads(6, 18),
      many(line([8.25, 8], [8.25, 16]), line([12, 9.25], [12, 14.75]), line([15.75, 8], [15.75, 16])),
    ],
  },
  potentiometer: {
    tags: ['potenciómetro', 'perilla', 'volumen', 'potentiometer', 'pot', 'variable resistor'],
    // The round body seen from the front, its shaft end-on with the slot that marks its turn, and
    // three legs
    d: (() => {
      const body = circ(12, 10.25, 6.5);
      return [body, circ(12, 10.25, 2.75), line([12, 10.25], polar(12, 10.25, 2.75, -50)), legs(body, [9, 12, 15])];
    })(),
  },
  capacitor: {
    tags: ['capacitor', 'condensador', 'electrolítico', 'capacitor', 'electrolytic', 'component'],
    // The can a little from above, the stripe down its negative side; that leg is the short one
    d: (() => {
      const { body, rim } = can(7.5, 16.5, 4.75, 14.25, 1.5);
      const top = rim(4.75);
      const leg = (x, len) => line([x, bottom(body, x)], [x, bottom(body, x) + len]);
      return [body, top, line([13.5, bottom(top, 13.5)], [13.5, bottom(body, 13.5)]), many(leg(9.75, LONG), leg(14.25, LEG))];
    })(),
  },
  diode: {
    tags: ['diodo', 'rectificador', 'componente', 'diode', 'rectifier', 'protection'],
    // A slim body on its leads, the cathode band near one end
    d: [sq(6, 9.5, 12, 5, 1.75), leads(6, 18), line([15, 9.5], [15, 14.5])],
  },
  led: {
    tags: ['led', 'diodo emisor', 'luz', 'light emitting diode', 'indicator', 'status light'],
    // The dome on its rim, two legs (the anode longer) and two rays
    d: (() => {
      const shape = `M7 13V7.5A3.5 3.5 0 0 1 14 7.5V13H14.75A0.75 0.75 0 0 1 15.5 13.75V14.75A0.75 0.75 0 0 1 14.75 15.5H6.25A0.75 0.75 0 0 1 5.5 14.75V13.75A0.75 0.75 0 0 1 6.25 13Z`;
      const ray = (a) => line(polar(10.5, 7.5, 6.5, a), polar(10.5, 7.5, 9.5, a));
      return [shape, many(line([8.5, 15.5], [8.5, 15.5 + LONG]), line([12.5, 15.5], [12.5, 15.5 + LEG])), many(ray(-12), ray(24))];
    })(),
  },
  'led-strip': {
    tags: ['tira led', 'cinta led', 'iluminación', 'led strip', 'led tape', 'ambient light'],
    // A ribbon bent in an S from two quarter turns (its edges are arcs too), LEDs along its middle
    d: (() => {
      const w = 3.5;
      const R = 6;
      const ribbon = `M2.5 ${f(6 - w)}H6A${f(R + w)} ${f(R + w)} 0 0 1 ${pt([12 + w, 12])}A${f(R - w)} ${f(R - w)} 0 0 0 18 ${f(18 - w)}H21.5V${f(18 + w)}H18A${f(R + w)} ${f(R + w)} 0 0 1 ${pt([12 - w, 12])}A${f(R - w)} ${f(R - w)} 0 0 0 6 ${f(6 + w)}H2.5Z`;
      // Along the middle: the turns are quarter circles of r 6 joined at the center
      const at = (s) => {
        const q = (Math.PI * R) / 2;
        if (s <= 3.5) return [2.5 + s, 6];
        if (s <= 3.5 + q) return polar(6, 12, R, -90 + ((s - 3.5) / R) * (180 / Math.PI));
        if (s <= 3.5 + 2 * q) return polar(18, 12, R, 180 - ((s - 3.5 - q) / R) * (180 / Math.PI));
        return [18 + (s - 3.5 - 2 * q), 18];
      };
      const mid = 3.5 + (Math.PI * R) / 2;
      return [ribbon, ...[-9.6, -4.8, 0, 4.8, 9.6].map((k) => dot(...at(mid + k)))];
    })(),
  },
  transistor: {
    tags: ['transistor', 'to-92', 'conmutación', 'transistor', 'switching', 'amplifier'],
    // The half cylinder with its flat face forward: the D of its top, its front edge, three legs
    d: (() => {
      const body = 'M6.5 8A5.5 3.5 0 0 1 17.5 8V15.25A1.5 1.5 0 0 1 16 16.75H8A1.5 1.5 0 0 1 6.5 15.25Z';
      return [body, line([6.5, 8], [17.5, 8]), many(...[9, 12, 15].map((x) => line([x, 16.75], [x, 16.75 + LEG])))];
    })(),
  },
  inductor: {
    tags: ['inductor', 'bobina', 'filtro', 'inductor', 'coil', 'choke'],
    // A wire wound in four turns (a prolate trochoid: each turn loops back over itself) between
    // two leads
    d: (() => {
      const [a, b, c, x0] = [0.52, 2.1, 4.25, 6.4];
      const P = (t) => [x0 + a * t - b * Math.sin(t), 12 + c * Math.cos(t + Math.PI)];
      const pts = [];
      for (let k = 0; k <= 160; k++) pts.push(P((k / 160) * 8 * Math.PI));
      const coil = `M${pts.map(pt).join('L')}`;
      return [coil, many(line([2.5, 7.75], [x0, 7.75]), line([pts.at(-1)[0], 7.75], [21.5, 7.75]))];
    })(),
  },
  relay: {
    tags: ['relé', 'relevador', 'interruptor', 'relay', 'switching', 'smart switch'],
    // The schematic switch over a coil of three humps, linked by a dashed line
    d: (() => {
      const sw = SWITCH.map((d) => move(d, 0, -3.5));
      const coil = `M${pt([AX0, 17.5])}H6${[10, 14, 18].map((x) => `A2 2 0 0 1 ${pt([x, 17.5])}`).join('')}H${f(AX1)}`;
      const leverY = AX - 3.5 - (6 * 6) / 11;
      return [coil, ...sw, many(line([12, 15.5], [12, 12.75]), line([12, 9.75], [12, leverY]))];
    })(),
  },
  fuse: {
    tags: ['fusible', 'protección', 'cortocircuito', 'fuse', 'circuit protection', 'overcurrent'],
    // The glass capsule between its metal caps, the wire through it
    d: [sq(2.75, 8.25, 18.5, 7.5, 2.25), many(line([7, 8.25], [7, 15.75]), line([17, 8.25], [17, 15.75])), line([7, 12], [17, 12])],
  },
  buzzer: {
    tags: ['zumbador', 'buzzer', 'pitido', 'buzzer', 'beep', 'piezo'],
    d: (() => {
      const body = circ(9.75, 11, 5.75);
      return [body, circ(9.75, 11, 1.25), legs(body, [8.25, 11.25]), arc(9.75, 11, 8.75, -35, 35).d, arc(9.75, 11, 11.75, -30, 30).d];
    })(),
  },
  'vacuum-tube': {
    tags: ['bulbo', 'válvula', 'tubo de vacío', 'vacuum tube', 'valve', 'tube amp'],
    // The glass envelope, the plate inside it on its stem, the base and its pins
    d: [
      'M6.5 14.75V8.25A5.5 5.5 0 0 1 17.5 8.25V14.75Z',
      sq(9.75, 6, 4.5, 5.5, 1),
      line([12, 11.5], [12, 14.75]),
      rline([[7.5, 14.75], [7.5, 17.75], [16.5, 17.75], [16.5, 14.75]], 1),
      many(...[9, 12, 15].map((x) => line([x, 17.75], [x, 17.75 + LEG]))),
    ],
  },
  'dip-switch': {
    tags: ['dip switch', 'interruptores', 'configuración', 'dip switch', 'jumper', 'hardware config'],
    // Three switches: two knobs up, one down, each on its slot
    d: [
      box(3.25, 5, 17.5, 14, 3.25),
      sq(5.5, 8, 3, 3, 0.9),
      sq(10.5, 13, 3, 3, 0.9),
      sq(15.5, 8, 3, 3, 0.9),
      many(line([7, 11], [7, 16]), line([12, 8], [12, 13]), line([17, 11], [17, 16])),
    ],
  },
  'push-button': {
    tags: ['botón', 'pulsador', 'tact switch', 'push button', 'tactile switch', 'input'],
    d: [sq(5.5, 5.5, 13, 13, 2.5), circ(12, 12, 3.5), many(line([5.5, 8.5], [2, 8.5]), line([5.5, 15.5], [2, 15.5]), line([18.5, 8.5], [22, 8.5]), line([18.5, 15.5], [22, 15.5]))],
  },
  'toggle-switch': {
    tags: ['palanca', 'interruptor', 'encendido', 'toggle switch', 'switch', 'panel'],
    // The base, the bushing and the bat lever tilted to one side: narrow at the bushing, round at
    // its tip
    d: (() => {
      const piv = [12, 12.75];
      const tip = polar(...piv, 7.75, -62);
      const [r0, r1] = [1.1, 1.9];
      const a = Math.atan2(tip[1] - piv[1], tip[0] - piv[0]);
      const t = Math.acos((r0 - r1) / Math.hypot(tip[0] - piv[0], tip[1] - piv[1]));
      const on = (c, r, s) => [c[0] + r * Math.cos(a + s * t), c[1] + r * Math.sin(a + s * t)];
      // Each side of the lever down to the bushing's top edge
      const meet = (s) => {
        const [p, q] = [on(piv, r0, s), on(tip, r1, s)];
        return [p[0] + ((q[0] - p[0]) * (piv[1] - p[1])) / (q[1] - p[1]), piv[1]];
      };
      const lever = `M${pt(meet(-1))}L${pt(on(tip, r1, -1))}A${r1} ${r1} 0 1 1 ${pt(on(tip, r1, 1))}L${pt(meet(1))}`;
      return [sq(3.25, 15.75, 17.5, 5, 2), rline([[9, 15.75], [9, 12.75], [15, 12.75], [15, 15.75]], 0.75), lever];
    })(),
  },
  'slide-switch': {
    tags: ['interruptor deslizante', 'encendido', 'apagado', 'slide switch', 'on off', 'switch'],
    d: [sq(3.5, 9.5, 17, 6.5, 2), rline([[6.5, 9.5], [6.5, 5.5], [10.5, 5.5], [10.5, 9.5]], 1), many(...[8, 12, 16].map((x) => line([x, 16], [x, 16 + LEG])))],
  },
  'mechanical-switch': {
    tags: ['switch mecánico', 'teclado', 'tecla', 'mechanical switch', 'keyboard', 'key switch'],
    // The housing from the front, stepped, and the cross-shaped stem rising from it
    d: [
      roundpoly(
        [
          [7, 10.5],
          [17, 10.5],
          [19.5, 13.5],
          [19.5, 18.25],
          [4.5, 18.25],
          [4.5, 13.5],
        ],
        [1, 1, 1, 1.5, 1.5, 1],
      ),
      roundpoly(
        [
          [10.5, 3],
          [13.5, 3],
          [13.5, 4.75],
          [16, 4.75],
          [16, 7.75],
          [13.5, 7.75],
          [13.5, 10.5],
          [10.5, 10.5],
          [10.5, 7.75],
          [8, 7.75],
          [8, 4.75],
          [10.5, 4.75],
        ],
        [0.75, 0.75, 0, 0.75, 0.75, 0, 0, 0, 0, 0.75, 0.75, 0],
      ),
      many(line([8.5, 18.25], [8.5, 18.25 + LEG]), line([15.5, 18.25], [15.5, 18.25 + LEG])),
    ],
  },
  // ── Motors, sensors and cooling ───────────────────────────────────────────────────────────
  'electric-motor': {
    tags: ['motor', 'motor eléctrico', 'robótica', 'electric motor', 'dc motor', 'drive'],
    // The can lying down, a little from the front: its round back, the face with the shaft out of
    // its centre, the terminal tabs out of the back (a flat can with prongs read as a plug)
    d: MOTOR,
  },
  'servo-motor': {
    tags: ['servo', 'servomotor', 'robótica', 'servo motor', 'rc servo', 'positioning'],
    // From above: the case with an ear at each end, the horn on its hub with a hole at its tip
    d: [
      sq(4.75, 5.5, 14.5, 13, 2.5),
      many(rline([[4.75, 9.5], [2.25, 9.5], [2.25, 14.5], [4.75, 14.5]], 0.75), rline([[19.25, 9.5], [21.75, 9.5], [21.75, 14.5], [19.25, 14.5]], 0.75)),
      ...(() => {
        // The horn turned 30° on its hub; a hole at its tip
        const hub = [13.5, 12.75];
        const H = pill(hub[0] - 6.25, hub[1] - 2.75, 9, 5.5);
        return [turnPath(H, 30, hub), dot(...hub, 0.3), dot(...polar(...hub, 3.5, 210), 0.3)];
      })(),
    ],
  },
  'stepper-motor': {
    tags: ['motor a pasos', 'paso a paso', 'cnc', 'stepper motor', 'nema', '3d printer'],
    // The NEMA face: a square with its corners cut, a screw hole at each, the round boss and the
    // shaft (a rounded square read as a speaker)
    d: (() => {
      const [a, b, c] = [3.25, 20.75, 2.25];
      const face = roundpoly([[a + c, a], [b - c, a], [b, a + c], [b, b - c], [b - c, b], [a + c, b], [a, b - c], [a, a + c]], 1.25);
      return [face, ...[7, 17].flatMap((y) => [7, 17].map((x) => dot(x, y, 0.3))), circ(12, 12, 3.5), dot(12, 12)];
    })(),
  },
  solenoid: {
    tags: ['solenoide', 'actuador', 'electroimán', 'solenoid', 'actuator', 'plunger'],
    // The coil wound with three turns that bow round it (straight bars read as a battery's
    // charge), the plunger out of one end with its round head
    d: (() => {
      const body = sq(2.75, 6.5, 12.5, 11, 2.25);
      const turn = (x) => `M${pt([x, top(body, x)])}Q${pt([x + 2, 12])} ${pt([x, bottom(body, x)])}`;
      return [body, many(...[5.25, 8.25, 11.25].map(turn)), line([15.25, 12], [19, 12]), circ(20.25, 12, 1.25)];
    })(),
  },
  'vibration-motor': {
    tags: ['motor de vibración', 'vibración', 'háptica', 'vibration motor', 'haptics', 'rumble'],
    // The coin motor's disc, its half-moon weight off the center, a tremor on each side
    d: [circ(12, 12, 6.5), 'M8.5 12A3.5 3.5 0 0 1 15.5 12Z', many(line([2.5, 9], [2.5, 15]), line([21.5, 9], [21.5, 15]))],
  },
  photoresistor: {
    tags: ['fotorresistencia', 'ldr', 'sensor de luz', 'photoresistor', 'light sensor', 'ldr'],
    // The disc with its serpentine track, standing on two legs
    d: (() => {
      const disc = circ(12, 10.25, 6.25);
      const [y0, y1, y2] = [7.25, 10.25, 13.25];
      const track = `M${pt([left(disc, y0), y0])}H13.5A1.5 1.5 0 0 1 13.5 ${f(y1)}H10.5A1.5 1.5 0 0 0 10.5 ${f(y2)}H${f(right(disc, y2))}`;
      return [disc, track, legs(disc, [10, 14])];
    })(),
  },
  'ultrasonic-sensor': {
    tags: ['sensor ultrasónico', 'distancia', 'sonar', 'ultrasonic sensor', 'distance sensor', 'sonar'],
    // The board with its two transducers and the pins below
    d: [box(2.5, 5, 19, 12, 3), circ(7.5, 11, 3), circ(16.5, 11, 3), many(...[9, 12, 15].map((x) => line([x, 17], [x, 17 + LEG])))],
  },
  'infrared-sensor': {
    tags: ['sensor infrarrojo', 'pir', 'presencia', 'infrared sensor', 'motion detector', 'pir'],
    // The faceted dome (a half sphere and two of its meridians) on its board, three pins below
    d: [
      'M7 11A5 5 0 0 1 17 11',
      many('M12 6A2.5 5 0 0 0 9.5 11', 'M12 6A2.5 5 0 0 1 14.5 11'),
      box(3.5, 11, 17, 6.5, 2.5),
      many(...[9, 12, 15].map((x) => line([x, 17.5], [x, 17.5 + LEG]))),
    ],
  },
  'moisture-sensor': {
    tags: ['sensor de humedad', 'humedad del suelo', 'riego', 'moisture sensor', 'soil sensor', 'irrigation'],
    // A fork: two long prongs from a small head that carries two pins
    d: [
      box(6, 5.5, 12, 5, 1.75),
      many(line([10, 5.5], [10, 2.75]), line([14, 5.5], [14, 2.75])),
      many(...[7.5, 13.5].map((x) => rline([[x, 10.5], [x, 18.75], [x + 1.5, 21.25], [x + 3, 18.75], [x + 3, 10.5]], [0, 0.5, 0.5, 0.5, 0]))),
    ],
  },
  lidar: {
    tags: ['lidar', 'escáner láser', 'mapeo 3d', 'lidar', 'laser scanner', 'autonomous'],
    // A wide, short puck with its window and three beams fanning out of it (beams ending in dots
    // read as a share or a network)
    d: (() => {
      const { body, rim } = can(2.5, 13, 8.75, 15.75, 1.75);
      const c = [7.75, 13];
      return [body, rim(8.75), pill(4.75, 11.75, 6, 2.5), many(...[-25, 0, 25].map((a) => line(polar(...c, 9.25, a), polar(...c, 14, a))))];
    })(),
  },
  'heat-sink': {
    tags: ['disipador', 'refrigeración', 'térmico', 'heat sink', 'cooling', 'thermal'],
    // The base plate and five fins of one height
    d: [sq(2.75, 16.5, 18.5, 4.25, 1.5), many(...[5.25, 8.625, 12, 15.375, 18.75].map((x) => line([x, 16.5], [x, 4])))],
  },
  'case-fan': {
    tags: ['ventilador', 'enfriamiento', 'rpm', 'case fan', 'cooling fan', 'hardware monitor'],
    // The frame with a screw hole at each corner, the hub and four blades whose tips stay clear
    // of the holes; a hub of r 2 keeps the same pieces at every weight under a badge
    d: [sq(3.25, 3.25, 17.5, 17.5, 4), ...[6.5, 17.5].flatMap((y) => [6.5, 17.5].map((x) => dot(x, y, 0.3))), circ(12, 12, 2), ...fanBlades([12, 12], 2, 5.75, 4, -75, 70)],
  },
  'liquid-cooling': {
    tags: ['refrigeración líquida', 'radiador', 'bomba', 'liquid cooling', 'aio', 'water cooling'],
    // The finned radiator on top, two tubes down to the round pump block
    d: (() => {
      const pump = circ(12, 16.25, 4.25);
      return [
        sq(3.25, 3, 17.5, 6, 1.75),
        many(...[7.25, 10.4, 13.6, 16.75].map((x) => line([x, 3], [x, 9]))),
        many(line([8.5, 9], [8.5, top(pump, 8.5)]), line([15.5, 9], [15.5, top(pump, 15.5)])),
        pump,
        circ(12, 16.25, 1.25),
      ];
    })(),
  },
  overheating: {
    tags: ['sobrecalentamiento', 'temperatura', 'calor', 'overheating', 'thermal throttling', 'hot'],
    // A small chip with three waves of heat rising from it
    d: [sq(7.5, 12.25, 9, 9, 2.25), many(line([7.5, 15.25], [5, 15.25]), line([7.5, 18.25], [5, 18.25]), line([16.5, 15.25], [19, 15.25]), line([16.5, 18.25], [19, 18.25])), many(heat(8.5, 9.25), heat(12, 9.25), heat(15.5, 9.25))],
  },
  // ── Schematic symbols ─────────────────────────────────────────────────────────────────────
  'resistor-symbol': {
    tags: ['símbolo de resistencia', 'esquemático', 'diagrama', 'resistor symbol', 'schematic', 'eda'],
    d: [rline([[AX0, AX], [6, AX], ...[7, 9, 11, 13, 15, 17].map((x, i) => [x, i % 2 ? AX + 3 : AX - 3]), [18, AX], [AX1, AX]], 0.4)],
  },
  'capacitor-symbol': {
    tags: ['símbolo de capacitor', 'esquemático', 'diagrama', 'capacitor symbol', 'schematic', 'eda'],
    d: [many(line([10.5 - LEAD, AX], [10.5, AX]), line([13.5, AX], [13.5 + LEAD, AX])), many(line([10.5, 6.5], [10.5, 17.5]), line([13.5, 6.5], [13.5, 17.5]))],
  },
  'inductor-symbol': {
    tags: ['símbolo de inductor', 'bobina', 'esquemático', 'inductor symbol', 'schematic', 'coil'],
    // Four humps as tall as the resistor's zigzag, between the leads
    d: [`M${pt([AX0, AX])}H6${[9, 12, 15, 18].map((x) => `A1.5 2.75 0 0 1 ${pt([x, AX])}`).join('')}H${f(AX1)}`],
  },
  'diode-symbol': {
    tags: ['símbolo de diodo', 'esquemático', 'diagrama', 'diode symbol', 'schematic', 'eda'],
    d: DIODE,
  },
  'led-symbol': {
    tags: ['símbolo de led', 'esquemático', 'emisor de luz', 'led symbol', 'schematic', 'light emitting'],
    // The diode and two small arrows leaving it, the whole symbol lowered to sit in the middle
    d: (() => {
      const arrow = (s) => {
        const tip = [s[0] + 2.5, s[1] - 2.5];
        return line(s, tip) + head(tip, [1, -1], 2);
      };
      return [...DIODE, many(arrow([11.15, 5.3]), arrow([16.25, 4.75]))].map((d) => move(d, 0, 1.75));
    })(),
  },
  'transistor-symbol': {
    tags: ['símbolo de transistor', 'npn', 'esquemático', 'transistor symbol', 'schematic', 'bjt'],
    // The base bar inside the circle; the collector and the emitter leave it, the emitter's arrow
    // pointing out into its elbow, where its arms stand 3 from the bar and the circle
    d: (() => {
      const [e0, e1] = TRANSISTOR_E;
      return [
        circ(12.5, 12, TRANSISTOR_R),
        line([10.5, 9.5], [10.5, 14.5]),
        line([2.25, 12], [10.5, 12]),
        line([10.5, 10.25], [14.5, 7.5], [14.5, 2.25]),
        line(e0, e1, [14.5, 21.75]),
        head(e1, [e1[0] - e0[0], e1[1] - e0[1]], 2.25),
      ];
    })(),
  },
  'battery-symbol': {
    tags: ['símbolo de batería', 'pila', 'esquemático', 'battery symbol', 'schematic', 'cell'],
    d: [many(line([7.5 - LEAD, AX], [7.5, AX]), line([16.5, AX], [16.5 + LEAD, AX])), many(line([7.5, 6.5], [7.5, 17.5]), line([13.5, 6.5], [13.5, 17.5])), many(line([10.5, 9], [10.5, 15]), line([16.5, 9], [16.5, 15]))],
  },
  'switch-symbol': {
    tags: ['símbolo de interruptor', 'abierto', 'esquemático', 'switch symbol', 'schematic', 'open circuit'],
    d: SWITCH.map((d) => move(d, 0, 3.75)),
  },
  'electrical-ground': {
    tags: ['tierra', 'conexión a tierra', 'esquemático', 'ground', 'earth', 'schematic'],
    d: [line([12, 4], [12, 13.5]), many(line([4.5, 13.5], [19.5, 13.5]), line([7, 16.75], [17, 16.75]), line([9.5, 20], [14.5, 20]))],
  },
  'electric-circuit': {
    tags: ['circuito eléctrico', 'circuito', 'electricidad', 'electric circuit', 'closed circuit', 'physics'],
    // A loop of wire: the battery breaks it at the top, the lamp at the bottom
    d: (() => {
      const lamp = [12, 19];
      const r = 3;
      return [
        rline([[10.5, 5], [3.25, 5], [3.25, 19], [lamp[0] - r, 19]], 2.5),
        rline([[lamp[0] + r, 19], [20.75, 19], [20.75, 5], [13.5, 5]], 2.5),
        many(line([10.5, 2.25], [10.5, 7.75]), line([13.5, 3.5], [13.5, 6.5])),
        circ(...lamp, r),
        many(line(polar(...lamp, r, 45), polar(...lamp, r, 225)), line(polar(...lamp, r, 135), polar(...lamp, r, 315))),
      ];
    })(),
  },
  // ── Logic gates: inputs 5 apart, every lead LEAD long ──────────────────────────────────────
  'and-gate': { tags: ['compuerta and', 'lógica', 'digital', 'and gate', 'logic gate', 'boolean'], d: gate('and') },
  'or-gate': { tags: ['compuerta or', 'lógica', 'digital', 'or gate', 'logic gate', 'boolean'], d: gate('or') },
  'not-gate': { tags: ['compuerta not', 'inversor', 'lógica', 'not gate', 'inverter', 'logic gate'], d: gate('not') },
  'xor-gate': { tags: ['compuerta xor', 'o exclusiva', 'lógica', 'xor gate', 'exclusive or', 'logic gate'], d: gate('xor') },
  'nand-gate': { tags: ['compuerta nand', 'lógica', 'digital', 'nand gate', 'logic gate', 'boolean'], d: gate('nand') },
  'nor-gate': { tags: ['compuerta nor', 'lógica', 'digital', 'nor gate', 'logic gate', 'boolean'], d: gate('nor') },
  'xnor-gate': { tags: ['compuerta xnor', 'equivalencia', 'lógica', 'xnor gate', 'logic gate', 'boolean'], d: gate('xnor') },

  // ── Signals ───────────────────────────────────────────────────────────────────────────────
  'sine-wave': {
    tags: ['onda senoidal', 'corriente alterna', 'señal', 'sine wave', 'ac', 'oscillator'],
    // One and a half periods across the axis
    d: [wave((u) => Math.sin(u * 2 * Math.PI))],
  },
  'square-wave': {
    tags: ['onda cuadrada', 'señal digital', 'reloj', 'square wave', 'clock signal', 'pwm'],
    d: [line([2.5, 16.5], [4.5, 16.5], ...[4.5, 10.5, 16.5].flatMap((x) => [[x, 7.5], [x + 3, 7.5], [x + 3, 16.5], [x + 6, 16.5]]).slice(0, -1), [21.5, 16.5])],
  },
  'sawtooth-wave': {
    tags: ['onda diente de sierra', 'rampa', 'sintetizador', 'sawtooth wave', 'ramp', 'synth'],
    d: [line([3, 16.5], ...[9, 15, 21].flatMap((x) => [[x, 7.5], [x, 16.5]]))],
  },
  'triangle-wave': {
    tags: ['onda triangular', 'señal', 'sintetizador', 'triangle wave', 'test signal', 'synth'],
    d: [line([2.5, 12], [2.5 + 19 / 6, 7], [2.5 + 19 / 2, 17], [2.5 + (19 * 5) / 6, 7], [21.5, 12])],
  },
  'direct-current': {
    tags: ['corriente directa', 'cd', 'cargador', 'direct current', 'dc', 'power adapter'],
    d: [line([3.25, 9.5], [20.75, 9.5]), many(...[0, 1, 2].map((k) => line([3.25 + k * 6.83, 14.5], [3.25 + k * 6.83 + 3.83, 14.5])))],
  },
  // ── Cables and connectors ─────────────────────────────────────────────────────────────────
  cable: {
    tags: ['cable', 'conexión', 'accesorio', 'cable', 'cord', 'connection'],
    // An S of cable between two plugs, their prongs out
    d: [...plug(7.5, 6.75, -1), ...plug(16.5, 17.25, 1), 'M10 6.75C16.5 6.75 7.5 17.25 14 17.25'],
  },
  'usb-c-port': {
    tags: ['puerto usb-c', 'usb c', 'conector', 'usb-c port', 'type c', 'port'],
    d: [PLATE, mouth('usbC'), line([9, 12], [15, 12])],
  },
  'usb-a-port': {
    tags: ['puerto usb', 'usb a', 'conector', 'usb-a port', 'usb', 'port'],
    // The tongue fills the upper half of the mouth
    d: [PLATE, mouth('usbA'), rline([[9.25, 9], [9.25, 11.75], [14.75, 11.75], [14.75, 9]], 0.5)],
  },
  'micro-usb-port': {
    tags: ['puerto micro usb', 'micro usb', 'cargador', 'micro-usb port', 'micro usb', 'charger'],
    d: [PLATE, mouth('micro'), line([10.5, 12], [13.5, 12])],
  },
  'hdmi-port': {
    tags: ['puerto hdmi', 'video', 'pantalla', 'hdmi port', 'video output', 'display'],
    d: [PLATE, mouth('hdmi'), line([9.25, 12], [14.75, 12])],
  },
  'serial-port': {
    tags: ['puerto serie', 'db9', 'vga', 'serial port', 'd-sub', 'rs-232'],
    // The D-sub's trapezoid shell, three pins over two
    d: [PLATE, mouth('dsub'), ...[9.25, 12, 14.75].map((x) => dot(x, 10.75, 0.3)), ...[10.625, 13.375].map((x) => dot(x, 13.5, 0.3))],
  },
  'power-inlet': {
    tags: ['entrada de corriente', 'iec', 'fuente', 'power inlet', 'iec socket', 'power cord'],
    // The socket with its top corners cut, the earth blade down from its top edge over live and
    // neutral, every blade 2 long and 3 from the rest
    d: [PLATE, mouth('inlet'), many(line([12, 7.5], [12, 10]), line([10.125, 12.25], [10.125, 14.25]), line([13.875, 12.25], [13.875, 14.25]))],
  },
  'audio-jack': {
    tags: ['plug de audio', 'jack', 'audífonos', 'audio jack', 'headphone plug', 'trs'],
    // The pin with its two ring bands, the grip and the cable, turned so its tip points up and out
    d: [
      'M10.25 11V3.75A1.75 1.75 0 0 1 13.75 3.75V11',
      many(line([10.25, 5.5], [13.75, 5.5]), line([10.25, 8.25], [13.75, 8.25])),
      sq(8, 11, 8, 6.5, 2),
      line([12, 17.5], [12, 22.75]),
    ].map((d) => turnPath(move(d, 0, 0.25), 45)),
  },
  'barrel-connector': {
    tags: ['conector de barril', 'plug dc', 'eliminador', 'barrel connector', 'dc plug', 'power adapter'],
    // The barrel with its hollow end, the grip, the strain relief and the cable
    d: [
      ellipse(12, 4.75, 2.75, 1.5),
      many(line([9.25, 4.75], [9.25, 10]), line([14.75, 4.75], [14.75, 10])),
      sq(7.75, 10, 8.5, 6, 1.75),
      rline([[9.75, 16], [11, 18.75], [13, 18.75], [14.25, 16]], 0.5),
      line([12, 18.75], [12, 21.5]),
    ],
  },
  'jumper-wire': {
    tags: ['cable jumper', 'puente', 'protoboard', 'jumper wire', 'dupont', 'breadboard'],
    // A wire with a slim housing and its pin at each end: one plugged down into a row of holes, the
    // other loose (two plugged ends under an arch read as headphones)
    d: [
      'M7.5 11.25C7.5 6.5 10 5 14.75 5',
      sq(6, 11.25, 3, 5.25, 0.9),
      sq(14.75, 3.5, 5, 3, 0.9),
      many(line([7.5, 16.5], [7.5, 20.25]), line([19.75, 5], [21.75, 5])),
      ...[4.5, 10.5, 13.5, 16.5].map((x) => dot(x, 20.25, 0.3)),
    ],
  },
  'pin-header': {
    tags: ['pines', 'header', 'gpio', 'pin header', 'connector', 'gpio pins'],
    // A strip with five pins through it: long above, short below
    d: (() => {
      const xs = [0, 1, 2, 3, 4].map((k) => 4.6 + 3.7 * k);
      return [sq(2.75, 12.25, 18.5, 4.5, 1.25), many(...xs.map((x) => line([x, 12.25], [x, 4.5]))), many(...xs.map((x) => line([x, 16.75], [x, 20])))];
    })(),
  },
  'cable-adapter': {
    tags: ['adaptador', 'dongle', 'convertidor', 'cable adapter', 'dongle', 'converter'],
    // A short body between a wide plug and a narrow one
    d: [sq(7.5, 6.5, 9, 11, 2.5), rline([[7.5, 9], [3, 9], [3, 15], [7.5, 15]], 1), rline([[16.5, 10.5], [21, 10.5], [21, 13.5], [16.5, 13.5]], 1)],
  },
  'cable-splitter': {
    tags: ['cable en y', 'divisor', 'splitter', 'cable splitter', 'y cable', 'splitter'],
    // One plug whose cable forks into two, each with its plug
    d: [
      ...plug(7, 12, -1),
      ...[6.25, 17.75].flatMap((y) => plug(17, y, 1)),
      many(line([9.5, 12], [11, 12]), 'M11 12C13 12 12.5 6.25 14.5 6.25', 'M11 12C13 12 12.5 17.75 14.5 17.75'),
    ],
  },

  // ── Power and storage ─────────────────────────────────────────────────────────────────────
  ssd: {
    tags: ['ssd', 'disco sólido', 'm.2', 'ssd', 'solid state drive', 'nvme'],
    // A long board (continuous corners, the square one at the bottom right): the gold fingers of its
    // edge connector at the left end, the half-round screw notch in the right end, the controller
    // and a memory chip 3 apart
    d: [
      box(2.5, 7.5, 19, 9, 1.75).replace('L21.5 16.5', 'L21.5 10.5A1.5 1.5 0 0 0 21.5 13.5L21.5 16.5'),
      line([5.75, 7.5], [5.75, 16.5]),
      sq(8.75, 10.5, 3, 3, 0.75),
      sq(14.75, 10.5, 2.5, 3, 0.75),
    ],
  },
  'power-supply': {
    tags: ['fuente de poder', 'psu', 'fuente', 'power supply', 'psu', 'pc power'],
    // The box from the back: its fan (the graphics card's) and the power socket (the switch beside
    // it passed 28% ink)
    d: [box(2.5, 5, 19, 14, 3.5), circ(9, 12, 3.5), dot(9, 12), ...fanBlades([9, 12], 0.7, 3.5, 3, -90, 75), sq(15.75, 8, 3, 4, 0.75)],
  },
  'bench-power-supply': {
    tags: ['fuente de laboratorio', 'banco', 'voltaje', 'bench power supply', 'lab supply', 'testing'],
    // The display at the upper left, two knobs at the right, the two terminals below
    d: [box(2.5, 5, 19, 14, 3.5), sq(5.5, 8, 7, 3.75, 1), circ(17.25, 9, 1.25), circ(17.25, 15, 1.25), dot(7.25, 15.75), dot(11.25, 15.75)],
  },
  ups: {
    tags: ['ups', 'no break', 'respaldo', 'ups', 'uninterruptible power', 'backup power'],
    // The tower with a battery on its face and the round power button below; the battery's tip a
    // tab too narrow to have a hole at any weight
    d: [box(5.25, 2.75, 13.5, 18.5, 3.5), sq(8, 6.75, 7, 4.25, 1.25), sq(15, 7.875, 0.75, 2, 0.375), circ(12, 16, 2)],
  },
  'battery-cell': {
    tags: ['pila', 'batería aa', 'celda', 'battery cell', 'aa battery', '18650'],
    // The upright cell, the terminal on top and the plus that marks its end
    d: [sq(7.5, 5, 9, 16.25, 2.5), rline([[10.5, 5], [10.5, 3], [13.5, 3], [13.5, 5]], 0.6), many(line([12, 8.5], [12, 11.5]), line([10.5, 10], [13.5, 10]))],
  },
  'coin-cell': {
    tags: ['pila de botón', 'cr2032', 'batería', 'coin cell', 'button cell', 'cr2032'],
    // A short wide cylinder seen from above, the plus of its positive face on top (a raised disc
    // there read as a roll of tape)
    d: ['M3 10.5V13.5A9 5 0 0 0 21 13.5V10.5', ellipse(12, 10.5, 9, 5), many(line([12, 8.75], [12, 12.25]), line([10.25, 10.5], [13.75, 10.5]))],
  },
  'pouch-cell': {
    tags: ['batería lipo', 'celda de bolsa', 'lipo', 'pouch cell', 'lipo battery', 'drone'],
    // The flat cell and the two narrow tabs rising from its top edge
    d: [box(5.25, 7.75, 13.5, 13.5, 2.5), many(rline([[8.25, 7.75], [8.25, 3.75], [10.75, 3.75], [10.75, 7.75]], 0.75), rline([[13.25, 7.75], [13.25, 3.75], [15.75, 3.75], [15.75, 7.75]], 0.75))],
  },
  'battery-pack': {
    tags: ['paquete de baterías', 'pack', 'celdas', 'battery pack', 'battery module', 'e-bike'],
    // Three upright cells side by side (their round tops seen a little from above) and two leads
    // leaving the top
    d: [
      'M3 10A3 1.5 0 0 1 9 10A3 1.5 0 0 1 15 10A3 1.5 0 0 1 21 10V19A1.75 1.75 0 0 1 19.25 20.75H4.75A1.75 1.75 0 0 1 3 19Z',
      many(line([9, 10], [9, 20.75]), line([15, 10], [15, 20.75])),
      many(line([6, 8.5], [6, 3.25]), line([18, 8.5], [18, 3.25])),
    ],
  },
  'nine-volt-battery': {
    tags: ['batería 9v', 'pila cuadrada', 'detector de humo', 'nine volt battery', '9v battery', 'smoke alarm'],
    // The block and the band of its cap; on top, small and 3 apart, the round snap and the
    // hexagonal one (large ones read as ears)
    d: (() => {
      const body = box(5.25, 7.5, 13.5, 13.75, 3);
      return [
        body,
        circ(8.5, 5.75, 1.75),
        roundpoly(Array.from({ length: 6 }, (_, i) => polar(15.25, 7.5 - 2 * Math.sin(Math.PI / 3), 2, i * 60)), 0.4),
        line([left(body, 11.25), 11.25], [right(body, 11.25), 11.25]),
      ];
    })(),
  },
  // ── Bench instruments ─────────────────────────────────────────────────────────────────────
  multimeter: {
    tags: ['multímetro', 'tester', 'voltaje', 'multimeter', 'voltmeter', 'measure'],
    // The handheld: its display, the selector dial with its pointer, the two jacks
    d: [box(4.75, 2.75, 14.5, 18.5, 3.5), sq(8.25, 5.75, 7.5, 3.25, 1), circ(12, 14, 2.25), line(polar(12, 14, 2.25, -60), polar(12, 14, 2.25, 120)), dot(8.75, 18.5), dot(15.25, 18.5)],
  },
  oscilloscope: {
    tags: ['osciloscopio', 'señal', 'forma de onda', 'oscilloscope', 'scope', 'waveform'],
    // The screen with a sine trace across it, a column of knobs at its right
    d: [box(2.5, 5.5, 19, 13, 3.5), sq(5.5, 8.25, 8.5, 7.5, 1.5), wave((u) => Math.sin(u * 2 * Math.PI), 5.5, 14, 1.25), dot(17.75, 9.75), dot(17.75, 14.25)],
  },
  'clamp-meter': {
    tags: ['pinza amperimétrica', 'corriente', 'amperaje', 'clamp meter', 'current', 'ammeter'],
    // The meter's body with its display, the jaw on top open at one side, the wire through it end-on
    d: [box(6.25, 12.75, 11.5, 8.5, 3), sq(9, 15.25, 6, 3.25, 1), arc(12, 7.5, 5, 5, 290).d, dot(12, 7.5)],
  },
  'soldering-station': {
    tags: ['estación de soldadura', 'cautín', 'soldar', 'soldering station', 'soldering iron', 'repair'],
    // The station with its dial, the iron resting in its holder (a cone with one turn of its coil),
    // the cord from the iron's end down to the station
    d: (() => {
      const mouth = [17.625, 12];
      const end = polar(...mouth, 7.25 + 1.5, -118);
      const holder = roundpoly([[14, 12], [21.25, 12], [19.25, 21.25], [16, 21.25]], [0.75, 0.75, 1, 1]);
      return [
        box(2.5, 11.5, 8.5, 9.75, 2.5),
        circ(6.75, 16.375, 2),
        holder,
        line([left(holder, 17), 17], [right(holder, 17), 17]),
        rod(mouth, -118, 7.25, 1.5),
        `M${pt(end)}C${pt([end[0] - 1, end[1] - 2.5])} ${pt([6.75, 3.5])} ${pt([6.75, 11.5])}`,
      ];
    })(),
  },
  'wire-spool': {
    tags: ['carrete', 'bobina de cable', 'soldadura', 'wire spool', 'solder', 'hookup wire'],
    // Upright: the two flanges, two turns wound between them and the loose end off the lower one
    d: [
      sq(4.25, 3.25, 12.5, 2.5, 1.25),
      sq(4.25, 18.25, 12.5, 2.5, 1.25),
      many(line([6.75, 5.75], [6.75, 18.25]), line([14.25, 5.75], [14.25, 18.25])),
      many(line([6.75, 9.75], [14.25, 9.75]), line([6.75, 14.25], [14.25, 14.25])),
      'M14.25 14.25H17.25A3 3 0 0 1 20.25 17.25V20.75',
    ],
  },

  // ── Digital fabrication ───────────────────────────────────────────────────────────────────
  'printer-3d': {
    tags: ['impresora 3d', 'impresión', 'fdm', '3d printer', 'print farm', 'maker'],
    d: PRINTER,
  },
  'printer-3d-resin': {
    tags: ['impresora de resina', 'sla', 'resina', 'resin printer', 'sla printer', 'msla'],
    // The base and its lid; inside, the vat and the build plate hanging upside down into it
    d: [
      box(3.25, 14.5, 17.5, 6.75, 2.5),
      rline([[4.5, 14.5], [4.5, 2.75], [19.5, 2.75], [19.5, 14.5]], 2.5),
      many(line([7.5, 11], [7.5, 14.5]), line([16.5, 11], [16.5, 14.5])),
      line([12, 2.75], [12, 11.5]),
      line([10.5, 11.5], [13.5, 11.5]),
    ],
  },
  'filament-spool': {
    tags: ['bobina de filamento', 'filamento', 'pla', 'filament spool', 'filament', 'ams'],
    // The spool from the front: the rim, the hub, three holes, and a strand leaving the rim
    d: [circ(10.75, 12, 8.5), circ(10.75, 12, 2.25), ...[-90, 30, 150].map((a) => dot(...polar(10.75, 12, 5.5, a))), line([19.25, 12], [19.25, 21.25])],
  },
  extruder: {
    tags: ['extrusor', 'hotend', 'boquilla', 'extruder', 'hotend', 'nozzle'],
    // The filament into the heat block (its heater's end), the nozzle below and a bead at its tip
    d: [
      line([12, 2.75], [12, 6.5]),
      sq(6.75, 6.5, 10.5, 7.5, 2),
      circ(12, 10.25, 1.5),
      roundpoly([[9, 14], [15, 14], [12.75, 17.5], [11.25, 17.5]], [0.5, 0.5, 0.75, 0.75]),
      dot(12, 20.75),
    ],
  },
  'heated-bed': {
    tags: ['cama caliente', 'temperatura de cama', 'placa', 'heated bed', 'build plate', 'bed temperature'],
    // The bed in perspective, heat rising from it
    d: [roundpoly([[6, 14.5], [21.5, 14.5], [18, 20], [2.5, 20]], 1), many(heat(8, 11.5), heat(12, 11.5), heat(16, 11.5))],
  },
  'model-slicing': {
    tags: ['laminado', 'slicer', 'capas', 'model slicing', 'slicer', 'layers'],
    // A cube in three slices with a clearance between them: the top one with its face and its front
    // edge, the two below as plain slabs (their own front edges passed 28% ink)
    d: (() => {
      const [w, k, t, g, y0] = [6.5, 0.3, 2.5, 3.25, 3.75];
      const dd = w * k;
      const s0 = y0 + dd;
      const slab = (s) => roundpoly([[12 - w, s], [12, s + dd], [12 + w, s], [12 + w, s + t], [12, s + dd + t], [12 - w, s + t]], 0.6);
      const [s1, s2] = [s0 + t + g, s0 + 2 * (t + g)];
      return [
        roundpoly([[12, y0], [12 + w, s0], [12 + w, s0 + t], [12, s0 + dd + t], [12 - w, s0 + t], [12 - w, s0]], 0.6),
        line([12 - w, s0], [12, s0 + dd], [12 + w, s0]),
        line([12, s0 + dd], [12, s0 + dd + t]),
        slab(s1),
        slab(s2),
      ];
    })(),
  },
  'scan-3d': {
    tags: ['escaneo 3d', 'escáner 3d', 'fotogrametría', '3d scan', '3d scanner', 'photogrammetry'],
    // The scan frame's four corners around a cube
    d: [
      many(...[0, 90, 180, 270].map((a) => turnPath(rline([[3.25, 8.25], [3.25, 3.25], [8.25, 3.25]], 2.75), a))),
      roundpoly([[12, 7.25], [16.5, 9.5], [16.5, 14.5], [12, 16.75], [7.5, 14.5], [7.5, 9.5]], 0.75),
      many(line([7.5, 9.5], [12, 11.75], [16.5, 9.5]), line([12, 11.75], [12, 16.75])),
    ],
  },
  'laser-cutter': {
    tags: ['cortadora láser', 'grabado', 'láser', 'laser cutter', 'engraver', 'fabrication'],
    // The printer's head on its rail, its beam straight down onto the sheet (the sheet's back edge
    // parted round it) and the cut it leaves
    d: [
      RAIL,
      HEAD(12, 2.75),
      line([12, 9.75], [12, 17.5]),
      rline([[15, 14.5], [21.5, 14.5], [17.5, 20.75], [2.5, 20.75], [6.5, 14.5], [9, 14.5]], 1),
      line([12, 17.5], [6.5 - (4 * 3) / 6.25, 17.5]),
    ],
  },
  qubit: {
    tags: ['qubit', 'cuántico', 'esfera de bloch', 'qubit', 'quantum', 'bloch sphere'],
    // A Bloch sphere: the sphere, its equator, and the state from the center out to its surface; the
    // back of the equator is parted where the state passes in front of it
    d: (() => {
      const tip = polar(12, 12, 6, -58);
      const state = [line([12, 12], tip), head(tip, [tip[0] - 12, tip[1] - 12], 2.5)];
      // The state's points, to keep the back of the equator 3 (center to center) away from them
      const near = (p) => {
        const runs = [[[12, 12], tip], ...[1, -1].map((s) => [tip, polar(...tip, 2.5, -58 + 180 + 45 * s)])];
        return Math.min(...runs.map(([a, b]) => {
          const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
          const u = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
          return Math.hypot(p[0] - a[0] - u * dx, p[1] - a[1] - u * dy);
        }));
      };
      const at = (deg) => [12 + 9 * Math.cos((deg * Math.PI) / 180), 12 + 3 * Math.sin((deg * Math.PI) / 180)];
      // The back arc runs from 180° to 360° (above the center); its gap is where it comes within 3
      const hit = Array.from({ length: 361 }, (_, i) => 180 + i / 2).filter((deg) => near(at(deg)) < 3);
      const [lo, hi] = [Math.min(...hit), Math.max(...hit)];
      const back = (d0, d1) => `M${pt(at(d0))}A9 3 0 0 1 ${pt(at(d1))}`;
      const front = `M${pt(at(0))}A9 3 0 0 1 ${pt(at(180))}`;
      return [circ(12, 12, 9), many(front, back(180, lo - 0.5), back(hi + 0.5, 360)), ...state];
    })(),
  },
};

// ── Badges: the base drawn once, the engine's badge on top ──────────────────────────────────
const badged = (base, kind, tags, d = icons[base].d) => ({ tags, d, badge: badge(kind) });
// Under a badge the sensor keeps its first pin only: the badge's clearance takes the third whole and
// would leave a sliver of the second's tip
const SENSOR_B = [...icons['sensor-module'].d.slice(0, 6), line([9, 17.5], [9, 17.5 + LEG])];
Object.assign(icons, {
  'firmware-update': badged('microchip', 'arrow-down', ['firmware', 'actualizar', 'flashear', 'firmware update', 'flash', 'ota']),
  'microchip-lock': badged('microchip', 'lock', ['elemento seguro', 'tpm', 'chip seguro', 'secure element', 'tpm', 'secure boot']),
  'microchip-search': badged('microchip', 'search', ['buscar componente', 'chip', 'pieza', 'part search', 'find component', 'microchip']),
  'sensor-module-alert': badged('sensor-module', 'alert', ['falla de sensor', 'sensor', 'desconectado', 'sensor fault', 'sensor offline', 'iot'], SENSOR_B),
  'sensor-module-plus': badged('sensor-module', 'plus', ['agregar sensor', 'emparejar', 'sensor', 'add sensor', 'pair sensor', 'iot'], SENSOR_B),
  'microcontroller-board-check': badged('microcontroller-board', 'check', ['placa conectada', 'detectada', 'microcontrolador', 'board connected', 'detected', 'microcontroller']),
  'printer-3d-alert': badged('printer-3d', 'alert', ['error de impresión', 'impresora 3d', 'falla', 'print error', '3d printer', 'failed print']),
  'printer-3d-check': badged('printer-3d', 'check', ['impresión terminada', 'impresora 3d', 'lista', 'print finished', '3d printer', 'print done']),
  'printer-3d-clock': badged('printer-3d', 'clock', ['tiempo de impresión', 'en cola', 'impresora 3d', 'print time', 'queued print', '3d printer']),
  'filament-spool-alert': badged('filament-spool', 'alert', ['sin filamento', 'filamento agotado', 'bobina', 'filament runout', 'out of filament', 'spool']),
  'power-supply-alert': badged('power-supply', 'alert', ['falla de fuente', 'psu', 'energía', 'power supply fault', 'psu failure', 'power']),
  'case-fan-alert': badged('case-fan', 'alert', ['falla de ventilador', 'ventilador', 'rpm', 'fan failure', 'fan alert', 'server health']),
});
/** Which base each badged icon draws (its fill, parts and 16 px drawing follow the base's). */
const BASE = Object.fromEntries(Object.entries(icons).filter(([, i]) => i.badge).map(([n]) => [n, n.replace(/-(alert|plus|check|clock|lock|search)$/, '').replace('firmware-update', 'microchip')]));

// ── Fill (DESIGN.md › Fill): solid closed shapes, cut knocked out, lines with a clearance, wire flush
const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
/** Each of a path's open subpaths closed (a pair of ears, two tabs), for `solid`. */
const shutEach = (d) => d.split(/(?=M)/).map((sp) => `${sp}Z`).join('');
// By index into d; 'shut:i' closes an open piece along the edge it stands on, 'each:i' each of its parts
const FILL = {
  'circuit-board': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  motherboard: { solid: [0], cut: [1, 2, 3] },
  'graphics-card': { solid: [1], cut: [3, 4, 5, 6, 7], wire: [2], lines: [0] },
  'expansion-card': { solid: [1], cut: [3, 4, 5, 6], wire: [2], lines: [0] },
  microchip: { solid: [0], wire: [1, 2] },
  'microcontroller-board': { solid: [0, 'shut:1'], cut: range(2, 11) },
  'single-board-computer': { solid: [0, 'shut:6', 'shut:7'], cut: [1, 2, 3, 4, 5] },
  breadboard: { solid: [0], cut: range(1, 14) },
  'silicon-wafer': { solid: [0], cut: [1, 2] },
  'cpu-socket': { solid: [0], cut: range(1, 10), lines: [10] },
  'wireless-module': { solid: [0], cut: [1, 2], wire: [3] },
  'sensor-module': { solid: [0], cut: [1, 2, 3, 4, 5], wire: [6] },
  'camera-module': { solid: [0, 'shut:3'], cut: [1, 2] },
  'display-module': { solid: [0], cut: [1], wire: [2] },
  'led-matrix': { solid: [0], cut: range(1, 17) },
  resistor: { solid: [0], cut: [2], wire: [1] },
  potentiometer: { solid: [0], cut: [1, 2], wire: [3] },
  capacitor: { solid: [0], cut: [1, 2], wire: [3] },
  diode: { solid: [0], cut: [2], wire: [1] },
  led: { solid: [0], wire: [1], lines: [2] },
  'led-strip': { solid: [0], cut: [1, 2, 3, 4, 5] },
  transistor: { solid: [0], cut: [1], wire: [2] },
  fuse: { solid: [0], cut: [1, 2] },
  buzzer: { solid: [0], cut: [1], wire: [2], lines: [3, 4] },
  'vacuum-tube': { solid: [0, 'shut:3'], cut: [1, 2], wire: [4] },
  'dip-switch': { solid: [0], cut: [1, 2, 3, 4] },
  'push-button': { solid: [0], cut: [1], wire: [2] },
  'toggle-switch': { solid: [0, 'shut:1', 'shut:2'] },
  'slide-switch': { solid: [0, 'shut:1'], wire: [2] },
  'mechanical-switch': { solid: [0, 1], wire: [2] },
  'electric-motor': { solid: [MOTOR_SOLID], cut: [1], wire: [2, 3] },
  'servo-motor': { solid: [0, 'each:1'], cut: [2, 3, 4] },
  'stepper-motor': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  solenoid: { solid: [0, 3], cut: [1], wire: [2] },
  'vibration-motor': { solid: [0], cut: [1], lines: [2] },
  photoresistor: { solid: [0], cut: [1], wire: [2] },
  'ultrasonic-sensor': { solid: [0], cut: [1, 2], wire: [3] },
  'infrared-sensor': { solid: ['shut:0', 2], cut: [1], wire: [3] },
  'moisture-sensor': { solid: [0, 'each:2'], wire: [1] },
  lidar: { solid: [0], cut: [1, 2], lines: [3] },
  'heat-sink': { solid: [0], wire: [1] },
  'case-fan': { solid: [0], cut: range(1, 10) },
  'liquid-cooling': { solid: [0, 3], cut: [1, 4], wire: [2] },
  overheating: { solid: [0], wire: [1], lines: [2] },
  'diode-symbol': { solid: [1], wire: [0, 2] },
  'led-symbol': { solid: [1], wire: [0, 2], lines: [3] },
  'and-gate': { solid: [0], wire: [1, 2] },
  'or-gate': { solid: [0], wire: [1, 2] },
  'not-gate': { solid: [0], wire: [1, 2, 3] },
  'xor-gate': { solid: [0], wire: [1, 2, 3] },
  'nand-gate': { solid: [0], wire: [1, 2, 3] },
  'nor-gate': { solid: [0], wire: [1, 2, 3] },
  'xnor-gate': { solid: [0], wire: [1, 2, 3, 4] },
  cable: { solid: [0, 2], wire: [1, 3, 4] },
  'audio-jack': { solid: ['shut:0', 2], cut: [1], wire: [3] },
  'jumper-wire': { solid: [1, 2, 4, 5, 6, 7], wire: [0, 3] },
  'pin-header': { solid: [0], wire: [1, 2] },
  'cable-adapter': { solid: [0, 'shut:1', 'shut:2'] },
  'cable-splitter': { solid: [0, 2, 4], wire: [1, 3, 5, 6] },
  // The gold fingers' edge runs past the board, so the fill parts them off at every weight
  ssd: { solid: [0], cut: ['M5.75 6V18', 2, 3] },
  'power-supply': { solid: [0], cut: range(1, 7) },
  'bench-power-supply': { solid: [0], cut: [1, 2, 3, 4, 5] },
  ups: { solid: [0], cut: [1, 2, 3] },
  'battery-cell': { solid: [0, 'shut:1'], cut: [2] },
  'pouch-cell': { solid: [0, 'each:1'] },
  'battery-pack': { solid: [0], cut: [1], wire: [2] },
  'nine-volt-battery': { solid: [0, 1, 2], cut: [3] },
  multimeter: { solid: [0], cut: [1, 2, 3, 4, 5] },
  oscilloscope: { solid: [0], cut: [1, 2, 3, 4] },
  'clamp-meter': { solid: [0], cut: [1], wire: [2, 3] },
  'soldering-station': { solid: [0, 2, 'shut:4'], cut: [1, 3], wire: [5] },
  'printer-3d': { solid: [1, 3], cut: [4], wire: [0, 2] },
  'printer-3d-resin': { solid: [0, 'shut:1'], cut: [2, 3, 4] },
  'filament-spool': { solid: [0], cut: [1, 2, 3, 4], wire: [5] },
  extruder: { solid: [1, 3], cut: [2], wire: [0], lines: [4] },
  'heated-bed': { solid: [0], lines: [1] },
  'model-slicing': { solid: [0, 3, 4], cut: [1, 2] },
  'scan-3d': { solid: [1], cut: [2], lines: [0] },
  qubit: { solid: [0], cut: [1, 2, 3] },
};
const piece = (name, k) => {
  const d = icons[name].d;
  if (typeof k === 'number') return d[k];
  const [how, i] = k.split(':');
  return how === 'shut' ? shut(d[i]) : shutEach(d[i]);
};
const fillOf = (name, spec) => Object.fromEntries(Object.entries(spec).map(([kind, ks]) => [kind, ks.map((k) => (typeof k === 'string' && k.startsWith('M') ? k : piece(name, k)))]));
for (const [name, spec] of Object.entries(FILL)) icons[name].fill = fillOf(name, spec);
// Fills that need a shape of their own strokes put together:
// the spool's winding (its sides and the flanges' inner edges), filled with its turns knocked out
icons['wire-spool'].fill = fillOf('wire-spool', { solid: [0, 1, 'M6.75 5.75H14.25V18.25H6.75Z'], cut: [3], wire: [4] });
// the coin cell: the edge of its top face is knocked out across the side band
icons['coin-cell'].fill = fillOf('coin-cell', { solid: ['shut:0', 1], cut: [2, 'M3 10.5A9 5 0 0 0 21 10.5'] });
// the barrel: its sides and the back of its rim, filled, with the rim's ring knocked out
icons['barrel-connector'].fill = fillOf('barrel-connector', { solid: ['M9.25 10V4.75A2.75 1.5 0 0 1 14.75 4.75V10Z', 2, 'shut:3'], cut: [0], wire: [4] });
// the laser's beam: in ink down to the sheet, then knocked out of it as the start of the cut
icons['laser-cutter'].fill = fillOf('laser-cutter', { solid: [1, 'shut:3'], wire: [0, line([12, 9.75], [12, 14.5])], cut: [line([12, 14.5], [12, 17.5], [6.5 - (4 * 3) / 6.25, 17.5])] });
// the transistor symbol: the circle filled, what runs inside it knocked out, the leads outside in ink
{
  // Where each lead crosses the circle; the leads run 1 inside it in ink, over the start of their
  // cut, so the circle and its leads stay one piece at every weight
  const yc = (y) => 12 + Math.sign(y - 12) * Math.sqrt(TRANSISTOR_R ** 2 - 2 ** 2);
  const x0 = 12.5 - TRANSISTOR_R;
  const [e0, e1] = TRANSISTOR_E;
  const [d] = [icons['transistor-symbol'].d];
  icons['transistor-symbol'].fill = {
    solid: [d[0]],
    cut: [d[1], line([x0, 12], [10.5, 12]), line([10.5, 10.25], [14.5, 7.5], [14.5, yc(0)]), line(e0, e1, [14.5, yc(24)]), d[5]],
    wire: [line([2.25, 12], [x0 + 1, 12]), line([14.5, yc(0) + 1], [14.5, 2.25]), line([14.5, yc(24) - 1], [14.5, 21.75])],
  };
}
// The ports on the plate: the plate filled with its mouth emptied, as dispositivos' ethernet; what
// stands in the mouth (a tongue, the pins, the blades) stays in ink
for (const [name, k] of [['usb-c-port', 'usbC'], ['usb-a-port', 'usbA'], ['micro-usb-port', 'micro'], ['hdmi-port', 'hdmi'], ['serial-port', 'dsub'], ['power-inlet', 'inlet']]) {
  const d = icons[name].d;
  icons[name].fill = { solid: [holed(k)], cut: [d[1]], wire: d.slice(2) };
}
// Open lines only (schematic symbols, signals, a coil, a figure eight): their filled version is the
// outline itself
for (const name of [
  'seven-segment-display', 'inductor', 'relay', 'resistor-symbol', 'capacitor-symbol', 'inductor-symbol', 'battery-symbol', 'switch-symbol',
  'electrical-ground', 'electric-circuit', 'sine-wave', 'square-wave', 'sawtooth-wave', 'triangle-wave', 'direct-current',
])
  icons[name].fill = false;
// A badged icon fills as its base does
for (const [name, base] of Object.entries(BASE)) icons[name].fill = fillOf(name, FILL[base]);

// ── Parts: what moves or has a meaning of its own (DESIGN.md › Named parts) ─────────────────────
const PARTS = {
  'circuit-board': { board: [0], traces: [1, 2, 3, 4, 5, 6] },
  motherboard: { board: [0], socket: [1], slots: [2, 3] },
  'graphics-card': { bracket: [0], card: [1], connector: [2], fan: [3], rotor: [4, 5, 6, 7] },
  'expansion-card': { bracket: [0], card: [1], connector: [2], chips: [3, 4, 5, 6] },
  microchip: { body: [0], legs: [1, 2] },
  'microcontroller-board': { board: [0, 1], chip: [2], pins: range(3, 11) },
  'single-board-computer': { board: [0], header: [1, 2, 3, 4], chip: [5], ports: [6, 7] },
  breadboard: { board: [0], channel: [1], holes: range(2, 14) },
  'silicon-wafer': { wafer: [0], dies: [1, 2] },
  'cpu-socket': { socket: [0], pins: range(1, 10), lever: [10] },
  'wireless-module': { board: [0], antenna: [1], chip: [2], pins: [3] },
  'sensor-module': { board: [0, 2, 3, 4, 5], window: [1], pins: [6] },
  'camera-module': { board: [0], lens: [1, 2], ribbon: [3] },
  'display-module': { board: [0], screen: [1], pins: [2] },
  'seven-segment-display': { segments: range(0, 7), point: [7] },
  'led-matrix': { plate: [0], leds: range(1, 17) },
  resistor: { body: [0], leads: [1], bands: [2] },
  potentiometer: { body: [0], shaft: [1, 2], legs: [3] },
  capacitor: { can: [0, 1], stripe: [2], legs: [3] },
  diode: { body: [0], leads: [1], band: [2] },
  led: { dome: [0], legs: [1], rays: [2] },
  'led-strip': { strip: [0], leds: [1, 2, 3, 4, 5] },
  transistor: { body: [0, 1], legs: [2] },
  inductor: { coil: [0], leads: [1] },
  relay: { coil: [0], contacts: [1, 2, 3], lever: [4], link: [5] },
  fuse: { capsule: [0, 1], wire: [2] },
  buzzer: { body: [0, 1], legs: [2], wave: [3, 4] },
  'vacuum-tube': { envelope: [0], plate: [1, 2], base: [3], pins: [4] },
  'dip-switch': { block: [0], switches: [1, 2, 3, 4] },
  'push-button': { body: [0], cap: [1], legs: [2] },
  'toggle-switch': { base: [0, 1], lever: [2] },
  'slide-switch': { body: [0], knob: [1], legs: [2] },
  'mechanical-switch': { housing: [0], stem: [1], legs: [2] },
  'electric-motor': { can: [0, 1], shaft: [2], terminals: [3] },
  'servo-motor': { case: [0, 1], horn: [2, 3, 4] },
  'stepper-motor': { face: [0, 1, 2, 3, 4], shaft: [5, 6] },
  solenoid: { coil: [0, 1], plunger: [2, 3] },
  'vibration-motor': { motor: [0, 1], tremor: [2] },
  photoresistor: { disc: [0], track: [1], legs: [2] },
  'ultrasonic-sensor': { board: [0], transducers: [1, 2], pins: [3] },
  'infrared-sensor': { dome: [0, 1], board: [2], pins: [3] },
  'moisture-sensor': { head: [0], pins: [1], prongs: [2] },
  lidar: { puck: [0, 1, 2], beams: [3] },
  'heat-sink': { base: [0], fins: [1] },
  'case-fan': { frame: [0, 1, 2, 3, 4], rotor: [5, 6, 7, 8, 9] },
  'liquid-cooling': { radiator: [0, 1], tubes: [2], pump: [3, 4] },
  overheating: { chip: [0, 1], heat: [2] },
  'diode-symbol': { leads: [0], diode: [1, 2] },
  'led-symbol': { leads: [0], diode: [1, 2], light: [3] },
  'transistor-symbol': { circle: [0], base: [1, 2], collector: [3], emitter: [4, 5] },
  'battery-symbol': { leads: [0], plates: [1, 2] },
  'switch-symbol': { line: [0], terminals: [1, 2], lever: [3] },
  'electrical-ground': { stem: [0], bars: [1] },
  'electric-circuit': { wire: [0, 1], battery: [2], lamp: [3, 4] },
  cable: { plugs: [0, 1, 2, 3], cable: [4] },
  'usb-c-port': { plate: [0], port: [1, 2] },
  'usb-a-port': { plate: [0], port: [1, 2] },
  'micro-usb-port': { plate: [0], port: [1, 2] },
  'hdmi-port': { plate: [0], port: [1, 2] },
  'serial-port': { plate: [0], port: [1, 2, 3, 4, 5, 6] },
  'power-inlet': { plate: [0], port: [1, 2] },
  'audio-jack': { plug: [0, 1, 2], cable: [3] },
  'barrel-connector': { plug: [0, 1, 2, 3], cable: [4] },
  'jumper-wire': { wire: [0], ends: [1, 2, 3], holes: [4, 5, 6, 7] },
  'pin-header': { strip: [0], pins: [1, 2] },
  'cable-adapter': { body: [0], plugs: [1, 2] },
  'cable-splitter': { plugs: [0, 1, 2, 3, 4, 5], cable: [6] },
  ssd: { board: [0, 1], chips: [2, 3] },
  'power-supply': { case: [0], fan: [1], rotor: [2, 3, 4, 5], socket: [6] },
  'bench-power-supply': { case: [0], display: [1], knobs: [2, 3], terminals: [4, 5] },
  ups: { tower: [0], battery: [1, 2], button: [3] },
  'battery-cell': { body: [0, 1], mark: [2] },
  'coin-cell': { cell: [0, 1], mark: [2] },
  'pouch-cell': { body: [0], tabs: [1] },
  'battery-pack': { cells: [0, 1], leads: [2] },
  'nine-volt-battery': { body: [0, 3], terminals: [1, 2] },
  multimeter: { body: [0], display: [1], dial: [2, 3], jacks: [4, 5] },
  oscilloscope: { case: [0], screen: [1], trace: [2], knobs: [3, 4] },
  'clamp-meter': { body: [0, 1], jaw: [2], wire: [3] },
  'soldering-station': { station: [0, 1], holder: [2, 3], iron: [4], cord: [5] },
  'wire-spool': { spool: [0, 1, 2], turns: [3], end: [4] },
  'printer-3d': { rail: [0], head: [1], bed: [2], part: [3, 4] },
  'printer-3d-resin': { printer: [0, 1], vat: [2], plate: [3, 4] },
  'filament-spool': { spool: [0], hub: [1, 2, 3, 4], strand: [5] },
  extruder: { filament: [0], block: [1, 2], nozzle: [3], bead: [4] },
  'heated-bed': { bed: [0], heat: [1] },
  'model-slicing': { slices: range(0, 5) },
  'scan-3d': { frame: [0], cube: [1, 2] },
  'laser-cutter': { rail: [0], head: [1], beam: [2], sheet: [3], cut: [4] },
  qubit: { sphere: [0, 1], state: [2, 3] },
};
for (const [name, base] of Object.entries(BASE)) PARTS[name] = PARTS[base];
for (const [name, p] of Object.entries(PARTS)) icons[name].parts = p;

// ── Motion (DESIGN.md › Motion): the fans and rotors spin, sounds and light pulse, levers rock ──
const BC = [17.25, 17.25];
const BADGE_MOTION = {
  plus: { effect: 'beat', parts: ['badge'], origin: BC },
  check: { effect: 'beat', parts: ['badge'], origin: BC },
  alert: { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  search: { effect: 'wiggle', parts: ['badge'], origin: BC },
  lock: { effect: 'wiggle', parts: ['badge'], origin: BC },
  clock: { effect: 'spin', parts: ['badge'], origin: BC },
  'arrow-down': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
};
const MOTION = {
  'graphics-card': { effect: 'spin', parts: ['rotor'], origin: [CARD.x + CARD.w / 2, CARD.y + CARD.h / 2] },
  'case-fan': { effect: 'spin', parts: ['rotor'], origin: [12, 12] },
  'power-supply': { effect: 'spin', parts: ['rotor'], origin: [9, 12] },
  'filament-spool': { effect: 'spin', parts: ['hub'], origin: [10.75, 12] },
  'servo-motor': { effect: 'spin', parts: ['horn'], origin: [13.5, 12.75] },
  buzzer: { effect: 'beat', parts: ['wave'], origin: [9.75, 11] },
  led: { effect: 'beat', parts: ['rays'], origin: [10.5, 7.5] },
  lidar: { effect: 'beat', parts: ['beams'], origin: [7.25, 13.75] },
  'laser-cutter': { effect: 'beat', parts: ['beam'], origin: [12, 13.5] },
  'push-button': { effect: 'beat', parts: ['cap'], origin: [12, 12] },
  'vibration-motor': { effect: 'wiggle', parts: ['motor'], origin: [12, 12] },
  'toggle-switch': { effect: 'wiggle', parts: ['lever'], origin: [12, 12.75] },
  'switch-symbol': { effect: 'wiggle', parts: ['lever'], origin: [6, 15.75] },
  relay: { effect: 'wiggle', parts: ['lever'], origin: [6, 8.5] },
  solenoid: { effect: 'slide', parts: ['plunger'], vector: [1.5, 0] },
  'printer-3d': { effect: 'slide', parts: ['head'], vector: [2, 0] },
  overheating: { effect: 'float', parts: ['heat'], vector: [0, -1.5] },
  'heated-bed': { effect: 'float', parts: ['heat'], vector: [0, -1.5] },
};
for (const [name, icon] of Object.entries(icons)) if (icon.badge && !MOTION[name]) MOTION[name] = BADGE_MOTION[icon.badge.kind];
for (const [name, m] of Object.entries(MOTION)) icons[name].motion = m;

// ── Automatic variants (DESIGN.md › Automatic variants) ─────────────────────────────────────────
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// With a badge: the engine carries it neither into an enclosure nor onto the slash
variants(Object.keys(BASE), { circle: false, square: false, slash: false });
// Already round, or already a square plate: not enclosed again
variants(['silicon-wafer', 'qubit', 'filament-spool', 'transistor-symbol', 'vibration-motor'], { circle: false });
variants(['circuit-board', 'led-matrix', 'stepper-motor', 'case-fan', 'usb-c-port', 'usb-a-port', 'micro-usb-port', 'hdmi-port', 'serial-port', 'power-inlet'], { square: false });
// Symbols, gates and signals are lines: a slash through them says nothing
variants(
  [
    'resistor-symbol', 'capacitor-symbol', 'inductor-symbol', 'diode-symbol', 'led-symbol', 'transistor-symbol', 'battery-symbol', 'switch-symbol', 'electrical-ground',
    'electric-circuit', 'and-gate', 'or-gate', 'not-gate', 'xor-gate', 'nand-gate', 'nor-gate', 'xnor-gate', 'sine-wave', 'square-wave', 'sawtooth-wave',
    'triangle-wave', 'direct-current', 'inductor', 'relay', 'seven-segment-display',
  ],
  { slash: false },
);

// ── 16 px (DESIGN.md › 16 px): drawings made for the pixel grid where snapping leaves a smudge ──
// At 16 px a pixel is 1.5 canvas units and pixel centers fall at 0.75 + 1.5k; g(column, row) is a
// pixel's center, pl() a polyline through pixel centers, pd() a one-pixel dot and pd2() a 2 × 2 one
// on a pixel corner. Pieces stand at least a pixel apart: a grid of dots, holes or LEDs that merged
// into a plate is thinned (the LED matrix's 4 × 4 into 3 × 3), and a fan's blades become its ring.
// A badged icon carries the engine's pixel badge (`badge(kind, { size: 16 })`).
{
  const px = (k) => 0.75 + 1.5 * k;
  const g = (c, r) => [px(c), px(r)];
  const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
  const rpl = (pts, r) => rline(pts.map(([c, r2]) => g(c, r2)), r);
  const pd = (c, r) => circ(...g(c, r), 0.1);
  const pd2 = (x, y) => dot(x, y, 1);
  /** A plate between pixel centers (columns c0–c1, rows r0–r1), with the signature corner unless `round`. */
  const plate = (c0, r0, c1, r1, rad, round = false) => sq(px(c0), px(r0), 1.5 * (c1 - c0), 1.5 * (r1 - r0), rad, round ? {} : BR);
  const small = (name, d, fill, kind) => {
    icons[name].small = { d, ...(fill && { fill }), ...(kind && { badge: badge(kind, { size: 16 }) }) };
  };
  {
    // The LED matrix: 3 × 3 LEDs of 2 × 2 pixels (its 4 × 4 filled the plate)
    const p = plate(2, 2, 13, 13, 3.5);
    const leds = [7.5, 12, 16.5].flatMap((y) => [7.5, 12, 16.5].map((x) => pd2(x, y)));
    small('led-matrix', [p, ...leds], { solid: [p], cut: leds });
  }
  {
    // The stepper: the cut corners two pixels long, the boss and the shaft (the screw holes went)
    const [a, b, c] = [2, 13, 2];
    const face = roundpoly([g(a + c, a), g(b - c, a), g(b, a + c), g(b, b - c), g(b - c, b), g(a + c, b), g(a, b - c), g(a, a + c)], 0.5);
    const [boss, shaft] = [circ(12, 12, 3.75), pd2(12, 12)];
    small('stepper-motor', [face, boss, shaft], { solid: [face], cut: [boss, shaft] });
  }
  {
    // The case fan: its corner holes, the rotor's ring and the hub (its blades clogged)
    const frame = plate(2, 2, 14, 14, 3, true);
    const holes = [4, 12].flatMap((r) => [4, 12].map((c) => pd(c, r)));
    const [ring, hub] = [circ(...g(8, 8), 4.5), pd(8, 8)];
    const d = [frame, ...holes, ring, hub];
    small('case-fan', d, { solid: [frame], cut: [...holes, ring, hub] });
    small('case-fan-alert', d, { solid: [frame], cut: [...holes, ring, hub] }, 'alert');
  }
  {
    // The sensor breakout: four holes, the window and three pins one pixel apart; under a badge, the
    // first pin only (as at 24 px)
    const board = plate(2, 2, 14, 10, 2.5);
    const win = circ(...g(8, 6), 3);
    const holes = [[4, 4], [12, 4], [4, 8], [12, 8]].map(([c, r]) => pd(c, r));
    const pins = [6, 8, 10].map((c) => pl([c, 10], [c, 13]));
    small('sensor-module', [board, win, ...holes, ...pins], { solid: [board], cut: [win, ...holes], wire: pins });
    for (const kind of ['alert', 'plus']) small(`sensor-module-${kind}`, [board, win, ...holes, pins[0]], { solid: [board], cut: [win, ...holes], wire: [pins[0]] }, kind);
  }
  {
    // The microcontroller board: its tab, the chip as a 2 × 2 pixel and two columns of one-pixel pins
    const board = plate(3, 3, 12, 14, 2.5);
    const tab = rpl([[6, 3], [6, 1], [9, 1], [9, 3]], 0.6);
    const chip = pd2(12, 9);
    const pins = [6, 8, 10, 12].flatMap((r) => [pd(5, r), pd(10, r)]);
    const d = [board, tab, chip, ...pins];
    const fill = { solid: [board, shut(tab)], cut: [chip, ...pins] };
    small('microcontroller-board', d, fill);
    small('microcontroller-board-check', d, fill, 'check');
  }
  {
    // The CPU socket: 3 × 3 one-pixel contacts and the lever with its hook
    const frame = plate(1, 3, 9, 11, 2.25);
    const pins = [5, 7, 9].flatMap((r) => [3, 5, 7].map((c) => pd(c, r)));
    const lever = rpl([[11, 11], [11, 3], [12, 2], [13, 3]], 0.5);
    small('cpu-socket', [frame, ...pins, lever], { solid: [frame], cut: pins, lines: [lever] });
  }
  {
    // The graphics card: its fan as a ring with the hub
    const bracket = pl([1, 2], [1, 13]);
    const card2 = plate(3, 2, 13, 12, 2.5);
    const [ring, hub] = [circ(...g(8, 7), 3), pd(8, 7)];
    const teeth = [5, 8, 11].map((c) => pl([c, 12], [c, 14]));
    small('graphics-card', [bracket, card2, ring, hub, ...teeth], { solid: [card2], cut: [ring, hub], wire: teeth, lines: [bracket] });
  }
  {
    // The power supply: the fan as a ring with the hub, and the socket; under the badge, which would
    // cut the socket in two, the fan alone
    const box2 = plate(1, 3, 14, 13, 3);
    const [ring, hub] = [circ(...g(5, 8), 3), pd(5, 8)];
    const socket = plate(10, 5, 12, 8, 0.6, true);
    small('power-supply', [box2, ring, hub, socket], { solid: [box2], cut: [ring, hub, socket] });
    small('power-supply-alert', [box2, ring, hub], { solid: [box2], cut: [ring, hub] }, 'alert');
  }
  {
    // Slicing: the top slice with its cut corners and the two below as slabs, a pixel apart (its 2:1
    // edges turned gray)
    const top = roundpoly([g(5, 1), g(10, 1), g(12, 3), g(12, 4), g(3, 4), g(3, 3)], 0.5);
    const slab = (r) => sq(px(3), px(r), 13.5, 3, 1);
    small('model-slicing', [top, slab(6), slab(10)], { solid: [top, slab(6), slab(10)] });
  }
  {
    // The FDM printer: the head on its rail, the part as a box standing on the bed's back edge and the
    // bed on 45° sides (the cube clogged)
    const rail = [pl([1, 2], [4, 2]), pl([12, 2], [14, 2])];
    const hd = roundpoly([g(6, 1), g(10, 1), g(10, 3), g(8, 5), g(6, 3)], [0.5, 0.5, 0.5, 0.4, 0.5]);
    const bedPts = [[4, 11], [14, 11], [11, 14], [1, 14]];
    const bed = rpl([...bedPts, bedPts[0]], 0.4);
    const part = rpl([[6, 11], [6, 7], [10, 7], [10, 11]], 0.6);
    const d = [...rail, hd, bed, part];
    const fill = { solid: [hd, roundpoly(bedPts.map(([c, r]) => g(c, r)), 0.4), shut(part)], wire: rail };
    small('printer-3d', d, fill);
    for (const kind of ['alert', 'check', 'clock']) small(`printer-3d-${kind}`, d, fill, kind);
  }
  {
    // The qubit: the front of the equator through pixel centers and the state on a pixel diagonal
    const sphere = circ(12, 12, 8.25);
    const eq = pl([2, 8], [3, 9], [5, 10], [10, 10], [12, 9], [13, 8]);
    const state = [pl([8, 7], [11, 4]), pl([9, 4], [11, 4], [11, 6])];
    small('qubit', [sphere, eq, ...state], { solid: [sphere], cut: [eq, ...state] });
  }
  {
    // The filament spool: the rim, the hub as a ring and the strand (the three holes clogged)
    const rim = circ(...g(7, 8), 6);
    const hub = circ(...g(7, 8), 1.5);
    const strand = pl([11, 8], [11, 14]);
    small('filament-spool', [rim, hub, strand], { solid: [rim], cut: [hub], wire: [strand] });
    small('filament-spool-alert', [rim, hub, strand], { solid: [rim], cut: [hub], wire: [strand] }, 'alert');
  }
  {
    // The camera module: the lens as one ring with a one-pixel center, the ribbon below
    const board = plate(2, 1, 14, 11, 2.5);
    const lens = circ(...g(8, 6), 3);
    const ribbon = rpl([[6, 11], [6, 14], [10, 14], [10, 11]], 0.5);
    small('camera-module', [board, lens, pd(8, 6), ribbon], { solid: [board, shut(ribbon)], cut: [lens, pd(8, 6)] });
  }
  {
    // The photoresistor: its track in three runs a pixel apart
    const disc = circ(...g(8, 6), 6);
    const track = pl([5, 4], [10, 4], [10, 6], [6, 6], [6, 8], [11, 8]);
    const legs2 = [pl([6, 10], [6, 14]), pl([10, 10], [10, 14])];
    small('photoresistor', [disc, track, ...legs2], { solid: [disc], cut: [track], wire: legs2 });
  }
  {
    // The servo: its horn as an arm on a round hub, on a pixel diagonal
    const cs = plate(3, 3, 12, 12, 2);
    const ears = [rpl([[3, 6], [1, 6], [1, 9], [3, 9]], 0.5), rpl([[12, 6], [14, 6], [14, 9], [12, 9]], 0.5)];
    const [hub, arm] = [circ(...g(6, 9), 1.5), pl([7, 8], [10, 5])];
    small('servo-motor', [cs, ...ears, hub, arm], { solid: [cs, ...ears.map(shut)], cut: [hub, arm] });
  }
}

export default { category: 'hardware', label: 'Hardware y electrónica', icons };
