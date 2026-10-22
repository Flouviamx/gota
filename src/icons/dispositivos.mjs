// Dispositivos y multimedia: pantallas, periféricos, energía, conexión, reproducción, audio e
// imagen. Todo se calcula con el motor (engine/geometry.mjs) y las reglas de DESIGN.md: trazo de
// 1.5, keylines, esquinas continuas y la esquina inferior derecha recta en las pantallas.
import { arc, circ, dot, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snap } from '../../engine/variants.mjs';
import nucleo from './nucleo.mjs';

// ── Utilidades locales ────────────────────────────────────────────────────────────────────────
const N = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${N(p[0])} ${N(p[1])}`;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const BR = { square: ['br'] };

/** Polilínea abierta con los vértices interiores redondeados (radio por vértice o uno para todos). */
function roundline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let s = `M${pt(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B, r] = [pts[i - 1], pts[i], pts[i + 1], rr[i]];
    if (!r) {
      s += `L${pt(V)}`;
      continue;
    }
    const u = sub(A, V);
    const v = sub(B, V);
    const [lu, lv] = [len(u), len(v)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv))));
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (v[0] / lv) * t, V[1] + (v[1] / lv) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    s += `L${pt(S)}A${N(r)} ${N(r)} 0 0 ${cz > 0 ? 1 : 0} ${pt(E)}`;
  }
  return `${s}L${pt(pts[pts.length - 1])}`;
}

/** Cápsula (estadio): un rectángulo con los extremos cortos en semicírculo. */
function capsule(x, y, w, h) {
  if (h >= w) {
    const r = w / 2;
    return `M${pt([x, y + r])}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w, y + r])}V${N(y + h - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
  }
  const r = h / 2;
  return `M${pt([x + r, y])}H${N(x + w - r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + w - r, y + h])}H${N(x + r)}A${N(r)} ${N(r)} 0 0 1 ${pt([x + r, y])}Z`;
}

/** Las cuatro esquinas de sq() en orden [tr, br, bl, tl]: punto de arranque y trazo relativo. */
function corners(x, y, w, h, r, opts) {
  return sq(x, y, w, h, r, opts)
    .match(/[ML][^MLZ]*/g)
    .map((t) => {
      const m = t.slice(1).match(/^(-?[\d.]+) (-?[\d.]+)(.*)$/);
      return { p: [+m[1], +m[2]], c: m[3] };
    });
}

/**
 * Tramo abierto de un sq(): de `A` (sobre el borde `eA`) a `B` (sobre el borde `eB`) en sentido
 * horario. Bordes: 0 arriba, 1 derecha, 2 abajo, 3 izquierda.
 */
function sqOpen(x, y, w, h, r, opts, A, eA, B, eB) {
  const k = corners(x, y, w, h, r, opts);
  // A y B tienen que caer en el tramo recto de su borde: dentro de la curva de una esquina el
  // trazo retrocede y deja una muesca.
  const pc = (n) => (opts?.square?.includes(n) ? 0 : 1.6 * r);
  const DIR = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const START = [
    [x + pc('tl'), y],
    [x + w, y + pc('tr')],
    [x + w - pc('br'), y + h],
    [x, y + h - pc('bl')],
  ];
  const along = (u, e) => u[0] * DIR[e][0] + u[1] * DIR[e][1];
  if (along(sub(k[eA].p, A), eA) < -0.01 || along(sub(B, START[eB]), eB) < -0.01) throw new Error('sqOpen: el corte cae dentro de una esquina');
  let s = `M${pt(A)}`;
  let e = eA;
  do {
    s += `L${pt(k[e].p)}${k[e].c}`;
    e = (e + 1) % 4;
  } while (e !== eB);
  return `${s}L${pt(B)}`;
}

// ── Trazos como segmentos ─────────────────────────────────────────────────────────────────────
// Se lee el path que da el motor como segmentos (recta, cúbica, arco de círculo) para recortarlo a
// una región (las perforaciones de la película, las esquinas del visor), invertirlo o medir su área.
// Lo que pasa por encima de otra pieza NO se recorta aquí: va como insignia (`badge`) y el motor
// despeja la base con 1.5 de aire exacto (DESIGN.md › Detalle).

function arcSeg(a, b, r, fa, fs) {
  const dx = (a[0] - b[0]) / 2;
  const dy = (a[1] - b[1]) / 2;
  const d2 = dx * dx + dy * dy;
  const R = Math.max(r, Math.sqrt(d2));
  const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (R * R - d2) / d2));
  const c = [k * dy + (a[0] + b[0]) / 2, -k * dx + (a[1] + b[1]) / 2];
  const t0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
  let dt = Math.atan2(b[1] - c[1], b[0] - c[0]) - t0;
  if (fs && dt < 1e-9) dt += 2 * Math.PI;
  if (!fs && dt > -1e-9) dt -= 2 * Math.PI;
  return { k: 'A', a, b, c, r: R, t0, dt };
}

function parse(d) {
  const toks = d.match(/[MmLlHhVvCcAaZz]|-?(?:\d+\.?\d*|\.\d+)/g).map((t) => (/[a-z]/i.test(t) ? t : +t));
  const subs = [];
  let cur;
  let p = [0, 0];
  let cmd;
  let i = 0;
  const n = () => toks[i++];
  while (i < toks.length) {
    if (typeof toks[i] === 'string') cmd = toks[i++];
    else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const o = rel ? p : [0, 0];
    if (C === 'M') {
      p = [o[0] + n(), o[1] + n()];
      cur = { segs: [], closed: false, start: p };
      subs.push(cur);
    } else if (C === 'Z') {
      if (len(sub(p, cur.start)) > 1e-6) cur.segs.push({ k: 'L', a: p, b: cur.start });
      cur.closed = true;
      p = cur.start;
    } else if (C === 'L' || C === 'H' || C === 'V') {
      const q = C === 'L' ? [o[0] + n(), o[1] + n()] : C === 'H' ? [o[0] + n(), p[1]] : [p[0], o[1] + n()];
      cur.segs.push({ k: 'L', a: p, b: q });
      p = q;
    } else if (C === 'C') {
      const c1 = [o[0] + n(), o[1] + n()];
      const c2 = [o[0] + n(), o[1] + n()];
      const q = [o[0] + n(), o[1] + n()];
      cur.segs.push({ k: 'C', a: p, c1, c2, b: q });
      p = q;
    } else if (C === 'A') {
      const r = n();
      n();
      n();
      const fa = n();
      const fs = n();
      const q = [o[0] + n(), o[1] + n()];
      cur.segs.push(arcSeg(p, q, r, fa, fs));
      p = q;
    }
  }
  return subs;
}

function at(s, t) {
  if (s.k === 'L') return lerp(s.a, s.b, t);
  if (s.k === 'A') {
    const th = s.t0 + s.dt * t;
    return [s.c[0] + s.r * Math.cos(th), s.c[1] + s.r * Math.sin(th)];
  }
  const m = 1 - t;
  return [0, 1].map((j) => m * m * m * s.a[j] + 3 * m * m * t * s.c1[j] + 3 * m * t * t * s.c2[j] + t * t * t * s.b[j]);
}

function piece(s, t0, t1) {
  if (s.k === 'L') return { k: 'L', a: at(s, t0), b: at(s, t1) };
  if (s.k === 'A') return { ...s, a: at(s, t0), b: at(s, t1), t0: s.t0 + s.dt * t0, dt: s.dt * (t1 - t0) };
  const split = (c, t) => {
    const p01 = lerp(c.a, c.c1, t);
    const p12 = lerp(c.c1, c.c2, t);
    const p23 = lerp(c.c2, c.b, t);
    const p012 = lerp(p01, p12, t);
    const p123 = lerp(p12, p23, t);
    const m = lerp(p012, p123, t);
    return [
      { k: 'C', a: c.a, c1: p01, c2: p012, b: m },
      { k: 'C', a: m, c1: p123, c2: p23, b: c.b },
    ];
  };
  const right = t0 > 0 ? split(s, t0)[1] : s;
  return t1 < 1 ? split(right, (t1 - t0) / (1 - t0))[0] : right;
}

function write(segs, closed) {
  let o = `M${pt(segs[0].a)}`;
  for (const s of segs) {
    if (s.k === 'L') o += `L${pt(s.b)}`;
    else if (s.k === 'C') o += `C${pt(s.c1)} ${pt(s.c2)} ${pt(s.b)}`;
    else o += `A${N(s.r)} ${N(s.r)} 0 ${Math.abs(s.dt) > Math.PI ? 1 : 0} ${s.dt > 0 ? 1 : 0} ${pt(s.b)}`;
  }
  return closed ? `${o}Z` : o;
}

/** Tramos [t0, t1] de un segmento que quedan fuera de todas las regiones. */
function keep(s, out) {
  const n = 160;
  const inside = (t) => out.some((f) => f(at(s, t)));
  const res = [];
  let prev = inside(0);
  let start = prev ? null : 0;
  for (let j = 1; j <= n; j++) {
    const t = j / n;
    const now = inside(t);
    if (now !== prev) {
      let lo = (j - 1) / n;
      let hi = t;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2;
        if (inside(mid) === prev) lo = mid;
        else hi = mid;
      }
      const edge = (lo + hi) / 2;
      if (now) res.push([start, edge]);
      else start = edge;
      prev = now;
    }
  }
  if (!prev) res.push([start, 1]);
  return res.filter(([a, b]) => b - a > 1e-4);
}

/** Corta los trazos `ds` donde caen dentro de alguna región; descarta los restos más cortos que `min`. */
function cut(ds, out, min = 1.2) {
  const res = [];
  for (const d of [].concat(ds)) {
    for (const sp of parse(d)) {
      const runs = [];
      let run = null;
      let cutAny = false;
      sp.segs.forEach((s, j) => {
        const iv = keep(s, out);
        if (iv.length !== 1 || iv[0][0] > 0 || iv[0][1] < 1) cutAny = true;
        iv.forEach(([t0, t1], k) => {
          const p = piece(s, t0, t1);
          if (k === 0 && t0 === 0 && run && run.end === j - 1) run.segs.push(p);
          else {
            run = { segs: [p], first: j === 0 && t0 === 0 };
            runs.push(run);
          }
          run.end = t1 === 1 ? j : -9;
        });
        if (!iv.length) run = null;
      });
      if (!cutAny) {
        res.push(write(sp.segs, sp.closed));
        continue;
      }
      if (sp.closed && runs.length > 1 && runs[0].first && runs.at(-1).end === sp.segs.length - 1) {
        runs[0].segs = runs.pop().segs.concat(runs[0].segs);
      }
      for (const r of runs) {
        const L = r.segs.reduce((n, s) => n + len(sub(s.b, s.a)), 0);
        if (L > min) res.push(write(r.segs, false));
      }
    }
  }
  return res;
}

/** Segmento recorrido al revés (para invertir un trazo). */
function back(s) {
  if (s.k === 'L') return { k: 'L', a: s.b, b: s.a };
  if (s.k === 'C') return { k: 'C', a: s.b, c1: s.c2, c2: s.c1, b: s.a };
  return { ...s, a: s.b, b: s.a, t0: s.t0 + s.dt, dt: -s.dt };
}

/**
 * Un trazo abierto y su regreso por el mismo camino: en `fill.solid` se ve igual que la línea pero
 * sin área que rellenar (una polilínea abierta se rellenaría hasta su cuerda). Para lo que toca al
 * cuerpo y debe seguir unido en el relleno, donde `lines` lo mordería con su aire (y, cerrado, para
 * el `knock` de una pieza abierta: knockOf).
 */
const twin = (d) =>
  parse(d)
    .map((sp) => write([...sp.segs, ...sp.segs.toReversed().map(back)], false))
    .join('');

/**
 * Un trazo abierto alargado `k0` al principio y `k1` al final (sus tramos rectos de los extremos).
 * Para `fill.cut`: un detalle que llega al contorno (la ranura de la linterna, la cordillera de la
 * foto) se cala de lado a lado; si terminara justo en el contorno, su punta redonda dejaría una
 * muesca con filos de pelo en la silueta.
 */
function extend(d, k0 = 1, k1 = 1) {
  const [sp] = parse(d);
  const segs = sp.segs.map((g) => ({ ...g }));
  const push = (g, end, k) => {
    const [from, to] = end ? [g.a, g.b] : [g.b, g.a];
    const u = sub(to, from).map((v) => v / len(sub(to, from)));
    const q = [to[0] + u[0] * k, to[1] + u[1] * k];
    if (end) g.b = q;
    else g.a = q;
  };
  if (segs[0].k !== 'L' || segs.at(-1).k !== 'L') throw new Error('extend: los extremos deben ser rectos');
  push(segs[0], false, k0);
  push(segs.at(-1), true, k1);
  return write(segs, false);
}

/** Área con signo de una figura cerrada (su sentido de giro). */
function area(d) {
  const p = samplePath(d, 0.2);
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]);
  return a / 2;
}

/**
 * Una figura con huecos, para `fill.solid`: los interiores van en el sentido contrario al contorno y
 * la regla de relleno los deja vacíos (el triángulo de play dentro del círculo, el hoyo del disco).
 */
function withHoles(outer, ...holes) {
  const s = Math.sign(area(outer));
  const rev = (d) =>
    parse(d)
      .map((sp) => write(sp.segs.toReversed().map(back), true))
      .join('');
  return outer + holes.map((h) => (Math.sign(area(h)) === s ? rev(h) : h)).join('');
}

/**
 * Punto que el motor no quita al despejar una insignia. El motor quita entero todo punto que cae en
 * la caja de una insignia que no es un círculo (la diagonal de un ícono "off" abarca el lienzo):
 * este punto queda lejos del trazo de la insignia (más de 1.5 de aire) y se conserva. Es un dot()
 * igual, recorrido en el otro sentido.
 */
const keepDot = (x, y, r = 0.7) => `M${pt([x - r, y])}A${N(r)} ${N(r)} 0 1 1 ${pt([x + r, y])}A${N(r)} ${N(r)} 0 1 1 ${pt([x - r, y])}Z`;

/**
 * Área que despeja una pieza abierta (la diagonal, el brazo del tocadiscos): el trazo de ida y vuelta,
 * cerrado. La máscara del motor no lleva remate redondo; cerrado, la vuelta en cada extremo es una
 * unión redonda y el aire de 1.5 rodea también las puntas (sin el remate, la esquina de abajo de la
 * cámara quedaba pegada a la punta de la diagonal).
 */
const knockOf = (d) => `${twin(d)}Z`;

/**
 * Versión "off": el ícono completo y la diagonal encima como insignia; el motor despeja la base con
 * 1.5 de aire exacto a cada lado y quita enteros los puntos que toca. La diagonal va de arriba a la
 * izquierda a abajo a la derecha, a 45°; donde la de siempre roza una pieza (la deja como una astilla
 * paralela o la corta en un ángulo muy cerrado), se corre sobre su paralela para cruzarla de frente.
 */
const slashOver = (a = [3.5, 3.5], b = [20.5, 20.5]) => {
  const s = line(a, b);
  return { d: [s], knock: knockOf(s) };
};

/** Una figura cerrada encima de otra (el teléfono frente al monitor, la foto de adelante). */
const front = (ds, knock = ds[0], fill = { solid: [ds[0]], ...(ds.length > 1 && { cut: ds.slice(1) }) }) => ({ d: ds, knock, fill });

// ── Piezas compartidas ────────────────────────────────────────────────────────────────────────

const SPEAKER = nucleo.icons.speaker.d[0];

const smartphone = () => [sq(6.25, 2.75, 11.5, 18.5, 3.25, BR), line([10.5, 5.75], [13.5, 5.75])];

const camera = () => [
  sq(2.5, 6.5, 19, 13.75, 3.5, BR),
  roundline(
    [
      [8.25, 6.5],
      [9.5, 4],
      [14.5, 4],
      [15.75, 6.5],
    ],
    [0, 0.9, 0.9, 0],
  ),
  circ(12, 13.25, 3.75),
];

const videoCamera = () => [
  sq(2.5, 6, 13, 12, 3.25, BR),
  roundline(
    [
      [15.5, 10.25],
      [21.5, 6.75],
      [21.5, 17.25],
      [15.5, 13.75],
    ],
    [0, 1.25, 1.25, 0],
  ),
];

/** Auricular: cabeza redonda con el tallo al ras de un costado (`side` 1 derecha, -1 izquierda). */
function earbud(cx, cy, r, side, stem = 12) {
  const x = cx + r * side;
  return [`M${pt([x, cy + stem])}V${N(cy)}A${N(r)} ${N(r)} 0 1 ${side > 0 ? 0 : 1} ${pt([cx, cy + r])}H${N(x)}`];
}

/**
 * Micrófono de mano: cabeza redonda y mango cónico a 45°, que nace del borde de la cabeza. La
 * banda de la rejilla, del lado opuesto al mango, es lo que lo separa de una lupa.
 */
function handMic() {
  const C = [15.25, 8.75];
  const R = 4.5;
  const a = [-Math.SQRT1_2, Math.SQRT1_2];
  const nn = [Math.SQRT1_2, Math.SQRT1_2];
  const P = (u, v) => [C[0] + u * a[0] + v * nn[0], C[1] + u * a[1] + v * nn[1]];
  const u0 = Math.sqrt(R * R - 2.25 * 2.25);
  const band = Math.sqrt(R * R - 1.5 * 1.5);
  return [
    circ(...C, R),
    roundline([P(u0, 2.25), P(14, 1.4), P(14, -1.4), P(u0, -2.25)], [0, 1.2, 1.2, 0]),
    line(P(-1.5, -band), P(-1.5, band)),
  ];
}

/**
 * Linterna: cabezal, cono y mango; `t` es la altura del cabezal (más abajo deja lugar a la luz).
 * El interruptor es un punto a 3 del cuello y del fondo, igual en las dos versiones.
 */
const flashlight = (t = 2.75) => [
  roundpoly(
    [
      [6.25, t],
      [17.75, t],
      [17.75, t + 3.75],
      [15, t + 7.5],
      [15, 21.25],
      [9, 21.25],
      [9, t + 7.5],
      [6.25, t + 3.75],
    ],
    [1.5, 1.5, 1, 1, 1.5, 1.5, 1, 1],
  ),
  line([6.25, t + 3.75], [17.75, t + 3.75]),
  dot(12, Math.min(t + 11.25, 18.25)),
];

/** Batería horizontal con `n` barras de carga (0–4); el borne va suelto, a 3 del cuerpo. */
const battery = (n) => [
  sq(2.5, 6.5, 16, 11, 3, BR),
  line([21.5, 10.5], [21.5, 13.5]),
  ...[6, 9, 12, 15].slice(0, n).map((x) => line([x, 9.5], [x, 14.5])),
];

/** Wifi: punto y hasta tres arcos concéntricos (abren 90° hacia arriba). */
const WIFI_C = [12, 18.5];
const wifi = (n) => [dot(...WIFI_C), ...[4.5, 9, 13.5].slice(0, n).map((r) => arc(...WIFI_C, r, 225, 315).d)];

/** Señal celular: cuatro barras; las que no tienen señal quedan como punto en la base. */
const signal = (n) =>
  [4.5, 9.5, 14.5, 19.5].map((x, i) => (i < n ? line([x, 20], [x, [16.5, 12.5, 8.5, 4.25][i]]) : dot(x, 20)));

/** Vértices del triángulo de reproducción con su punta en `tipX` (dir 1 derecha, -1 izquierda). */
function triPts(tipX, cy, w, h, dir = 1) {
  const bx = tipX - w * dir;
  return dir > 0
    ? [
        [bx, cy - h / 2],
        [tipX, cy],
        [bx, cy + h / 2],
      ]
    : [
        [bx, cy + h / 2],
        [tipX, cy],
        [bx, cy - h / 2],
      ];
}
/** Triángulo de reproducción con su punta en `tipX`, esquinas de radio r. */
const tri = (tipX, cy, w, h, r, dir = 1) => roundpoly(triPts(tipX, cy, w, h, dir), r);

/**
 * Polígono de esquinas redondeadas crecido `k` hacia afuera (sus lados se mueven k; las esquinas
 * convexas crecen su radio k y las cóncavas lo pierden). Para los huecos del relleno: el contorno
 * del hueco va un poco por fuera de la línea que se cala, así el borde lo da solo la máscara.
 */
function grown(pts, radius, k) {
  const n = pts.length;
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let S = 0;
  for (let i = 0; i < n; i++) S += pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1];
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const L = len(sub(q, p));
    const u = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    const o = S > 0 ? [u[1], -u[0]] : [-u[1], u[0]];
    return { p: [p[0] + o[0] * k, p[1] + o[1] * k], u };
  });
  const out = pts.map((_, i) => {
    const A = lines[(i - 1 + n) % n];
    const B = lines[i];
    const den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
    const t = ((B.p[0] - A.p[0]) * B.u[1] - (B.p[1] - A.p[1]) * B.u[0]) / den;
    return [A.p[0] + A.u[0] * t, A.p[1] + A.u[1] * t];
  });
  const r = pts.map((V, i) => {
    const A = pts[(i - 1 + n) % n];
    const B = pts[(i + 1) % n];
    const convex = Math.sign((V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0])) === Math.sign(S);
    return convex ? rr[i] + k : Math.max(0, rr[i] - k);
  });
  return roundpoly(out, r);
}

const bluetooth = () => [
  roundline(
    [
      [6.75, 7.75],
      [17, 16.5],
      [12, 21],
      [12, 3],
      [17, 7.5],
      [6.75, 16.25],
    ],
    [0, 0.9, 0.6, 0.6, 0.9, 0],
  ),
];

/** Puntos a lo largo de un path (cada ~0.2): el interior de una forma y su sentido de giro. */
function samplePath(d, step = 0.2) {
  const pts = [];
  for (const sp of parse(d))
    for (const s of sp.segs) {
      let L = 0;
      for (let i = 1; i <= 16; i++) L += len(sub(at(s, i / 16), at(s, (i - 1) / 16)));
      const n = Math.max(2, Math.ceil(L / step));
      for (let i = 0; i <= n; i++) pts.push(at(s, i / n));
    }
  return pts;
}

const SPEAKER_WAVES = nucleo.icons.waves.d;
const MUTE = nucleo.icons.mute.d;

/** Repetir: dos tramos en L que se persiguen, con puntas de arco (3.4). */
const repeat = () => [
  roundline(
    [
      [3.75, 12.5],
      [3.75, 7],
      [19.75, 7],
    ],
    [0, 3, 0],
  ),
  head([19.75, 7], [1, 0], 3.4),
  roundline(
    [
      [20.25, 11.5],
      [20.25, 17],
      [4.25, 17],
    ],
    [0, 3, 0],
  ),
  head([4.25, 17], [-1, 0], 3.4),
];

/** Domo: media elipse de `x0` a `x1` sobre la base `y`, de `h` de alto, cerrada por la base. */
const dome = (x0, x1, y, h) => `M${pt([x0, y])}A${N((x1 - x0) / 2)} ${N(h)} 0 0 1 ${pt([x1, y])}Z`;

/** Región: el interior de una forma cerrada (polígono muestreado de su path). */
function inside(d) {
  const poly = samplePath(d, 0.1);
  return (p) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
}
const outside = (d) => {
  const f = inside(d);
  return (p) => !f(p);
};

/**
 * Punto donde la recta de `inner` (dentro de la forma `d`) a `outer` (fuera) cruza su contorno:
 * una línea que termina ahí queda enterrada en el trazo, sin asomarse por fuera de una esquina curva.
 */
function toEdge(inner, outer, d) {
  const f = inside(d);
  let [lo, hi] = [0, 1];
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (f(lerp(inner, outer, m))) lo = m;
    else hi = m;
  }
  return lerp(inner, outer, (lo + hi) / 2);
}

/** Elipse girada `deg` grados (cabeza de nota musical). */
function ellipse(cx, cy, rx, ry, deg) {
  const a = [cx + rx * Math.cos((deg * Math.PI) / 180), cy + rx * Math.sin((deg * Math.PI) / 180)];
  const b = [2 * cx - a[0], 2 * cy - a[1]];
  return `M${pt(a)}A${N(rx)} ${N(ry)} ${N(deg)} 1 1 ${pt(b)}A${N(rx)} ${N(ry)} ${N(deg)} 1 1 ${pt(a)}Z`;
}

/** El punto más a la derecha de esa elipse: ahí nace la plica, tangente al óvalo. */
function ellipseRight(cx, cy, rx, ry, deg) {
  const f = (deg * Math.PI) / 180;
  const t = Math.atan2(-ry * Math.sin(f), rx * Math.cos(f));
  return [cx + rx * Math.cos(t) * Math.cos(f) - ry * Math.sin(t) * Math.sin(f), cy + rx * Math.cos(t) * Math.sin(f) + ry * Math.sin(t) * Math.cos(f)];
}

/** Nota: cabeza oval inclinada y plica que sube desde su costado derecho hasta `top`. */
function note(cx, cy, top, rx = 3, ry = 2.1, deg = -24) {
  const s = ellipseRight(cx, cy, rx, ry, deg);
  return { head: ellipse(cx, cy, rx, ry, deg), stem: line(s, [s[0], top]), x: s[0], y: s[1] };
}

/** Espejo horizontal de un path absoluto (M, L, H, V, C, A, Z): para rewind desde fast-forward. */
function mirrorPath(d) {
  return d.replace(/([MLHVCA])([^MLHVCAZ]*)/g, (_, c, args) => {
    const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (c === 'H') return `H${N(24 - n[0])}`;
    if (c === 'V') return `V${N(n[0])}`;
    if (c === 'A') return `A${N(n[0])} ${N(n[1])} ${N(-n[2])} ${n[3]} ${n[4] ? 0 : 1} ${N(24 - n[5])} ${N(n[6])}`;
    const o = [];
    for (let i = 0; i < n.length; i += 2) o.push(`${N(24 - n[i])} ${N(n[i + 1])}`);
    return `${c}${o.join(c === 'C' ? ' ' : 'L')}`;
  });
}

/**
 * Adelantar: dos triángulos con 3 reales entre la punta redondeada del primero (la esquina de r 1.5
 * la retrae 1.1) y la base del segundo.
 */
const FAST_FORWARD = [tri(11, 12, 8.25, 11.5, 1.5), tri(21.25, 12, 8.25, 11.5, 1.5)];

/**
 * Foto: marco apaisado, sol y una cordillera de dos picos que va de borde a borde, con laderas a 45°.
 * La cordillera arranca justo sobre el contorno (toEdge), no a un costado de la esquina curva. Las
 * laderas que bajan son paralelas a la diagonal de `image-off`: van a más de 3 de ella (antes una
 * quedaba a 2.5 y el tache la rasuraba a lo largo) y la diagonal cruza de frente las que suben, a 4.25
 * del valle y de la cima (quedan tramos de 2, no ganchos sueltos).
 */
const IMAGE_FRAME = sq(2.5, 5, 19, 14, 3.5, BR);
const image = () => [
  IMAGE_FRAME,
  dot(10.5, 8.75),
  roundline(
    [
      toEdge([7, 13], [1, 19], IMAGE_FRAME),
      [7, 13],
      [10, 16],
      [16, 10],
      [21.5, 15.5],
    ],
    [0, 1, 1, 1, 0],
  ),
];

/** Chispa de IA: la de datos/sparkle (cuatro puntas, lados cóncavos), de radio R. */
function aiSpark(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const P = (x, y) => pt([cx + x * R, cy + y * R]);
  return `M${P(0, -1)}C${P(a, -b)} ${P(b, -a)} ${P(1, 0)}C${P(b, a)} ${P(a, b)} ${P(0, 1)}C${P(-a, b)} ${P(-b, a)} ${P(-1, 0)}C${P(-b, -a)} ${P(-a, -b)} ${P(0, -1)}Z`;
}

/**
 * Brazo de la claqueta: la tablilla abierta 15° sobre la bisagra (más abierta se sale del área
 * viva). Las franjas empiezan lejos de la bisagra, donde el brazo ya se separó del cuerpo.
 */
function clapper() {
  const H = [3.25, 9.5];
  const L = 17.5;
  const T = 3.25;
  const P = (u, v) => rot([H[0] + u, H[1] + v], H, -15);
  return [
    roundpoly([P(0, 0), P(L, 0), P(L, -T), P(0, -T)], [0.4, 1, 1, 1]),
    ...[6, 10.5, 15].map((u) => line(P(u - 1, 0), P(u + 1, -T))),
  ];
}

/**
 * Diafragma: cinco láminas curvas que giran en el mismo sentido (con seis era el más denso del
 * set). Cada lámina es un arco de radio 18 que pasa por dos vértices consecutivos de la abertura
 * (r 4.25) y sigue hasta el radio R (el aro): la abertura queda como un pentágono de lados curvos,
 * como un iris.
 * Con láminas de radio 12 y abertura de 4.75 eran más largas y el ícono pasaba del 28 % de tinta.
 */
function aperture(R = 9) {
  const C = [12, 12];
  const Rb = 18;
  const OPEN = 4.25;
  return [
    circ(...C, 9),
    ...[0, 1, 2, 3, 4].map((i) => {
      const A = polar(...C, OPEN, 72 * i - 90);
      const B = polar(...C, OPEN, 72 * i - 18);
      const M = lerp(A, B, 0.5);
      const n = sub(M, C).map((v) => v / len(sub(M, C)));
      const h = Math.sqrt(Rb * Rb - (len(sub(B, A)) / 2) ** 2);
      const Cb = [M[0] - n[0] * h, M[1] - n[1] * h];
      const ang = (p) => Math.atan2(p[1] - Cb[1], p[0] - Cb[0]);
      const dir = Math.sign(((ang(B) - ang(A) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      // Se avanza por el arco de la lámina hasta tocar el aro
      let [lo, hi] = [0, Math.PI / 2];
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        const t = ang(A) + dir * m;
        if (len(sub([Cb[0] + Rb * Math.cos(t), Cb[1] + Rb * Math.sin(t)], C)) < R) lo = m;
        else hi = m;
      }
      const t = ang(A) + dir * lo;
      return `M${pt(A)}A${Rb} ${Rb} 0 0 ${dir > 0 ? 1 : 0} ${pt([Cb[0] + Rb * Math.cos(t), Cb[1] + Rb * Math.sin(t)])}`;
    }),
  ];
}

/** Boca del puerto de red (RJ45): el rectángulo con la pestaña abajo. */
const PORT = [
  [7, 8],
  [17, 8],
  [17, 14],
  [14.5, 14],
  [14.5, 16.25],
  [9.5, 16.25],
  [9.5, 14],
  [7, 14],
];
const PORT_R = [1, 1, 1, 0.5, 0.75, 0.75, 0.5, 1];

const icons = {
  // ── Pantallas y equipos ───────────────────────────────────────────────────────────────────
  smartphone: {
    tags: ['celular', 'teléfono móvil', 'app', 'smartphone', 'mobile', 'phone'],
    d: smartphone(),
  },
  'smartphone-vibrate': {
    tags: ['vibrar', 'celular', 'modo silencio', 'vibrate', 'mobile', 'haptic'],
    d: [
      sq(8, 2.75, 8, 18.5, 2.5, BR),
      line([11, 5.75], [13, 5.75]),
      line([5, 8.5], [5, 15.5]),
      line([2, 10.25], [2, 13.75]),
      line([19, 8.5], [19, 15.5]),
      line([22, 10.25], [22, 13.75]),
    ],
  },
  tablet: {
    tags: ['tableta', 'pantalla táctil', 'tablet', 'touchscreen'],
    d: [sq(4, 2.75, 16, 18.5, 3.5, BR), dot(12, 6.25)],
  },
  laptop: {
    tags: ['laptop', 'computadora portátil', 'notebook', 'computer'],
    d: [sq(4.25, 4.5, 15.5, 11, 2.75, BR), line([2.5, 18.75], [21.5, 18.75])],
  },
  desktop: {
    tags: ['computadora', 'monitor', 'pantalla', 'desktop', 'computer', 'display'],
    d: [sq(2.5, 3.5, 19, 13.25, 3, BR), line([12, 16.75], [12, 20.5]), line([8.25, 20.5], [15.75, 20.5])],
  },
  devices: {
    tags: ['dispositivos', 'multiplataforma', 'responsivo', 'devices', 'responsive', 'cross-platform'],
    // El monitor completo; el teléfono va enfrente como insignia y el motor lo despeja con 1.5 de aire
    d: [sq(2.25, 3.25, 17.5, 12, 2.75, BR), line([9, 15.25], [9, 19.5]), line([5.75, 19.5], [12.25, 19.5])],
    badge: front([sq(15.25, 9.25, 6.5, 12, 2, BR)]),
  },
  watch: {
    tags: ['reloj inteligente', 'wearable', 'smartwatch', 'watch'],
    d: [
      sq(6, 6.25, 11, 11.5, 3, BR),
      roundline(
        [
          [8.5, 6.25],
          [9, 2.75],
          [14, 2.75],
          [14.5, 6.25],
        ],
        [0, 0.75, 0.75, 0],
      ),
      roundline(
        [
          [8.5, 17.75],
          [9, 21.25],
          [14, 21.25],
          [14.5, 17.75],
        ],
        [0, 0.75, 0.75, 0],
      ),
      line([17, 10], [19, 10]),
    ],
  },
  tv: {
    tags: ['televisión', 'tele', 'pantalla', 'tv', 'television', 'screen'],
    d: [sq(2.5, 4, 19, 13, 3.25, BR), line([6.75, 17], [5.5, 20.25]), line([17.25, 17], [18.5, 20.25])],
  },
  'tv-retro': {
    tags: ['televisión antigua', 'antena', 'tele', 'retro tv', 'vintage', 'television'],
    d: [sq(2.5, 7, 19, 13.25, 3.25, BR), line([8, 2.75], [12, 7], [16, 2.75]), sq(5.5, 10, 9, 7.25, 2.25, BR), dot(18, 13.75)],
  },
  keyboard: {
    tags: ['teclado', 'teclas', 'escribir', 'keyboard', 'typing', 'keys'],
    // Las teclas de la segunda fila van escalonadas media tecla, como en un teclado real
    d: [
      sq(2.5, 5.5, 19, 13, 3.25, BR),
      ...[6, 9, 12, 15, 18].map((x) => dot(x, 9.25, 0.3)),
      ...[7.5, 10.5, 13.5, 16.5].map((x) => dot(x, 12.25, 0.3)),
      line([8.5, 15.25], [15.5, 15.25]),
    ],
  },
  mouse: {
    tags: ['ratón', 'puntero', 'clic', 'mouse', 'pointer', 'click'],
    d: [capsule(6.5, 3, 11, 18), line([12, 6.75], [12, 9.25])],
  },
  printer: {
    tags: ['impresora', 'imprimir', 'printer', 'print'],
    // La hoja de entrada se apoya en el cuerpo; la de salida sale de la ranura y el cuerpo se
    // abre donde ella pasa al frente. Ambas hojas, como documentos, con la esquina de la gota.
    d: [
      sqOpen(2.5, 7.5, 19, 10, 3, BR, [7.5, 17.5], 2, [16.5, 17.5], 2),
      roundline(
        [
          [7.5, 7.5],
          [7.5, 2.75],
          [16.5, 2.75],
          [16.5, 7.5],
        ],
        [0, 1.5, 1.5, 0],
      ),
      line([5.5, 14], [18.5, 14]),
      roundline(
        [
          [7.5, 14],
          [7.5, 21.25],
          [16.5, 21.25],
          [16.5, 14],
        ],
        [0, 1.5, 0, 0],
      ),
    ],
  },
  camera: {
    tags: ['cámara', 'foto', 'fotografía', 'camera', 'photo', 'photography'],
    d: camera(),
  },
  'camera-off': {
    tags: ['cámara apagada', 'sin cámara', 'camera off', 'no camera'],
    // La diagonal pasa por el centro del lente (la de siempre lo dejaba como una astilla junto al tache)
    d: camera(),
    badge: slashOver([3.75, 5], [20.25, 21.5]),
  },
  'video-camera': {
    tags: ['cámara de video', 'grabar video', 'video', 'camcorder', 'record video'],
    d: videoCamera(),
  },
  'video-camera-off': {
    tags: ['video apagado', 'sin video', 'video off', 'camera off'],
    // La diagonal cruza el cuerpo de esquina a esquina y deja la bocina entera: la de siempre cortaba
    // el brazo de abajo de la bocina en un ángulo de 15° y lo dejaba como una espina
    d: videoCamera(),
    badge: slashOver([2.75, 5.75], [16.25, 19.25]),
  },
  webcam: {
    tags: ['cámara web', 'videollamada', 'webcam', 'video call'],
    d: [circ(12, 9.5, 6.75), circ(12, 9.5, 2.5), line([12, 16.25], [12, 20.75]), line([7.75, 20.75], [16.25, 20.75])],
  },
  headphones: {
    tags: ['audífonos', 'auriculares', 'escuchar', 'headphones', 'audio', 'listen'],
    d: [arc(12, 12, 8.25, 180, 360).d, sq(3.75, 12, 5, 8.75, 1.5, { square: ['tl'] }), sq(15.25, 12, 5, 8.75, 1.5, { square: ['tr'] })],
  },
  earbuds: {
    tags: ['audífonos inalámbricos', 'auriculares', 'earbuds', 'in-ear', 'wireless earphones'],
    d: [...earbud(7, 7.75, 3.5, 1), ...earbud(17, 7.75, 3.5, -1)],
  },
  'speaker-box': {
    tags: ['bocina', 'altavoz', 'sonido', 'speaker', 'woofer', 'audio'],
    // Tweeter y woofer como dos conos de distinto tamaño, con 3 entre ellos y contra el gabinete
    d: [sq(5, 2.75, 14, 18.5, 3.5, BR), circ(12, 7, 1.25), circ(12, 14.75, 3.5)],
  },
  'smart-speaker': {
    tags: ['bocina inteligente', 'asistente de voz', 'smart speaker', 'voice assistant'],
    d: [sq(5.5, 3.25, 13, 17.5, 4), line([9, 10.5], [9, 13.5]), line([12, 8.75], [12, 15.25]), line([15, 10.5], [15, 13.5])],
  },
  'microphone-handheld': {
    tags: ['micrófono de mano', 'karaoke', 'cantar', 'handheld mic', 'sing', 'microphone'],
    d: handMic(),
  },
  'microphone-studio': {
    tags: ['micrófono de estudio', 'grabar voz', 'studio mic', 'podcast', 'microphone'],
    d: [
      capsule(7.75, 2.75, 8.5, 12),
      line([7.75, 7.75], [16.25, 7.75]),
      line([7.75, 10.75], [16.25, 10.75]),
      line([12, 14.75], [12, 18.25]),
      capsule(7.5, 18.25, 9, 3),
    ],
  },
  'remote-control': {
    tags: ['control remoto', 'mando', 'remote', 'tv remote'],
    d: [
      sq(6.75, 2.75, 10.5, 18.5, 3, BR),
      circ(12, 8, 2.25),
      ...[14, 17.5].flatMap((y) => [10.25, 13.75].map((x) => dot(x, y, 0.3))),
    ],
  },
  gamepad: {
    tags: ['control de juego', 'videojuego', 'gamepad', 'controller', 'gaming'],
    // Cruceta a la izquierda y palanca analógica a la derecha, simétricas respecto al centro y a
    // más de 3 de los costados inclinados del cuerpo.
    d: [
      roundpoly(
        [
          [6, 5.75],
          [18, 5.75],
          [21.5, 16.25],
          [18.25, 19],
          [15.25, 15.75],
          [8.75, 15.75],
          [5.75, 19],
          [2.5, 16.25],
        ],
        [3.25, 3.25, 2.25, 1.5, 1.5, 1.5, 1.5, 2.25],
      ),
      line([7.5, 10.5], [10.5, 10.5]),
      line([9, 9], [9, 12]),
      circ(15, 10.5, 1.5),
    ],
  },
  'vr-headset': {
    tags: ['realidad virtual', 'visor', 'vr', 'headset', 'virtual reality'],
    // Un solo contorno cerrado: el visor y el puente de la nariz (así el relleno respeta la muesca)
    d: [`${sqOpen(2.5, 7, 19, 10.5, 3.25, {}, [9.5, 17.5], 2, [14.5, 17.5], 2)}${arc(12, 17.5, 2.5, 360, 180).d.replace(/^M[^A]*/, '')}Z`],
  },
  flashlight: {
    tags: ['linterna', 'lámpara', 'flashlight', 'torch'],
    d: flashlight(),
  },
  'flashlight-on': {
    tags: ['linterna encendida', 'luz', 'flashlight on', 'torch', 'light'],
    d: [...flashlight(7), line([12, 2], [12, 4]), line([6.5, 4], [5.25, 2.25]), line([17.5, 4], [18.75, 2.25])],
  },
  'sd-card': {
    tags: ['tarjeta de memoria', 'tarjeta sd', 'almacenamiento', 'sd card', 'memory card', 'storage'],
    // Vista del reverso, donde están los contactos: ahí el chaflán queda arriba a la izquierda.
    // El primer contacto arranca más abajo para guardar 3 con el chaflán.
    d: [
      roundpoly(
        [
          [5.25, 6.75],
          [9.25, 2.75],
          [18.75, 2.75],
          [18.75, 21.25],
          [5.25, 21.25],
        ],
        [1, 1, 2.5, 0, 2.5],
      ),
      line([9.5, 6.75], [9.5, 10]),
      line([12.5, 6], [12.5, 10]),
      line([15.5, 6], [15.5, 10]),
    ],
  },
  'usb-drive': {
    tags: ['memoria usb', 'pendrive', 'usb drive', 'flash drive', 'thumb drive'],
    d: [
      sq(7.25, 8.25, 9.5, 13, 2.75, BR),
      roundline(
        [
          [9.25, 8.25],
          [9.25, 2.75],
          [14.75, 2.75],
          [14.75, 8.25],
        ],
        [0, 1, 1, 0],
      ),
      dot(12, 17.25),
    ],
  },
  router: {
    tags: ['módem', 'router', 'red', 'internet', 'wifi', 'network'],
    d: [
      sq(2.5, 12.5, 19, 8, 2.5, BR),
      line([7, 12.5], [5.75, 4.25]),
      line([17, 12.5], [18.25, 4.25]),
      ...[6.5, 10, 13.5].map((x) => dot(x, 16.5, 0.3)),
    ],
  },
  projector: {
    tags: ['proyector', 'presentación', 'projector', 'presentation'],
    d: [
      sq(2.5, 7, 19, 11, 3, BR),
      circ(15.5, 12.5, 2.5),
      line([6, 11], [9.25, 11]),
      line([6, 14], [9.25, 14]),
      line([6, 18], [6, 20]),
      line([18, 18], [18, 20]),
    ],
  },
  // ── Energía ───────────────────────────────────────────────────────────────────────────────
  'battery-full': {
    tags: ['batería llena', 'carga completa', 'battery full', 'charged'],
    d: battery(4),
  },
  'battery-half': {
    tags: ['batería media', 'media carga', 'battery half', 'battery medium'],
    d: battery(2),
  },
  'battery-low': {
    tags: ['batería baja', 'poca carga', 'battery low', 'low power'],
    d: battery(1),
  },
  'battery-empty': {
    tags: ['batería vacía', 'sin carga', 'battery empty', 'dead battery'],
    d: battery(0),
  },
  'battery-charging': {
    tags: ['cargando', 'batería', 'carga', 'charging', 'battery charging'],
    // Rayo de 5 de alto centrado en el cuerpo, con 3 de aire arriba y abajo
    d: [...battery(0), roundline([[11.75, 9.5], [8.75, 12], [12.25, 12], [9.25, 14.5]], [0, 0.4, 0.4, 0])],
  },
  'power-plug': {
    tags: ['enchufe', 'clavija', 'corriente', 'plug', 'power', 'electricity'],
    d: [
      roundpoly(
        [
          [6, 6.5],
          [18, 6.5],
          [18, 11],
          [14.5, 15],
          [9.5, 15],
          [6, 11],
        ],
        [1.25, 1.25, 2, 1.5, 1.5, 2],
      ),
      line([9.5, 2.75], [9.5, 6.5]),
      line([14.5, 2.75], [14.5, 6.5]),
      line([12, 15], [12, 21.25]),
    ],
  },
  outlet: {
    tags: ['contacto', 'toma de corriente', 'enchufe de pared', 'outlet', 'socket', 'power'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, BR), circ(12, 12, 5), dot(10, 12), dot(14, 12)],
  },
  power: {
    tags: ['encender', 'apagar', 'energía', 'power', 'on off', 'shutdown'],
    d: [arc(12, 12.75, 8.25, -60, 240).d, line([12, 2.75], [12, 11])],
  },
  // ── Conexión ──────────────────────────────────────────────────────────────────────────────
  wifi: {
    tags: ['wifi', 'internet', 'inalámbrico', 'conexión', 'wireless', 'connection'],
    d: wifi(3),
  },
  'wifi-medium': {
    tags: ['wifi media', 'señal media', 'wifi medium', 'connection'],
    d: wifi(2),
  },
  'wifi-low': {
    tags: ['wifi débil', 'señal baja', 'wifi low', 'weak signal'],
    d: wifi(1),
  },
  'wifi-off': {
    tags: ['sin wifi', 'desconectado', 'sin internet', 'wifi off', 'offline', 'no connection'],
    // El punto lejos del tache se conserva (keepDot); el motor despeja los arcos con 1.5 de aire
    d: [keepDot(...WIFI_C), ...wifi(3).slice(1)],
    badge: slashOver(),
  },
  bluetooth: {
    tags: ['bluetooth', 'inalámbrico', 'emparejar', 'wireless', 'pairing'],
    d: bluetooth(),
  },
  'bluetooth-connected': {
    tags: ['bluetooth conectado', 'emparejado', 'bluetooth connected', 'paired'],
    d: [...bluetooth(), dot(3.5, 12), dot(20.5, 12)],
  },
  signal: {
    tags: ['señal', 'cobertura', 'barras', 'signal', 'cellular', 'reception'],
    d: signal(4),
  },
  'signal-high': {
    tags: ['señal alta', 'buena cobertura', 'signal high', 'strong signal'],
    d: signal(3),
  },
  'signal-medium': {
    tags: ['señal media', 'cobertura media', 'signal medium', 'fair signal'],
    d: signal(2),
  },
  'signal-low': {
    tags: ['señal baja', 'poca cobertura', 'signal low', 'weak signal'],
    d: signal(1),
  },
  cast: {
    tags: ['transmitir', 'enviar a pantalla', 'cast', 'stream to tv'],
    // La pantalla se abre justo donde termina la curva de su esquina superior; las ondas guardan
    // 3 con ella (antes el borde arrancaba dentro de la curva y quedaba a 1.2 de la onda).
    d: [
      sqOpen(2.5, 4.5, 19, 15, 3, BR, [2.5, 9.3], 3, [12.75, 19.5], 2),
      dot(2.75, 19.25),
      arc(2.5, 19.5, 4, 270, 360).d,
      arc(2.5, 19.5, 7.25, 270, 360).d,
    ],
  },
  usb: {
    tags: ['usb', 'conector', 'puerto', 'cable', 'port', 'connector'],
    // El tridente con menos piezas y más aire: punta abierta, tallo, base, y un brazo por lado
    // que remata en círculo y en cuadro. Todo a 3 entre sí para que a 18 px no se empaste.
    d: [
      line([12, 2.75], [12, 17.75]),
      line([10.4, 4.35], [12, 2.75], [13.6, 4.35]),
      circ(12, 19.5, 1.75),
      roundline(
        [
          [12, 14.75],
          [6.5, 12.5],
          [6.5, 10.75],
        ],
        [0, 1.25, 0],
      ),
      circ(6.5, 9, 1.75),
      roundline(
        [
          [12, 11.75],
          [18, 10],
          [18, 9.25],
        ],
        [0, 0.5, 0],
      ),
      sq(16.25, 5.75, 3.5, 3.5, 1),
    ],
  },
  // ── Reproducción ──────────────────────────────────────────────────────────────────────────
  play: {
    tags: ['reproducir', 'iniciar', 'play', 'start'],
    d: [tri(20, 12, 12.5, 15.5, 2.25)],
  },
  'play-circle': {
    tags: ['reproducir', 'ver video', 'play circle', 'play video'],
    d: [circ(12, 12, 9), tri(16.25, 12, 6.25, 8, 1.25)],
  },
  pause: {
    tags: ['pausa', 'pausar', 'pause', 'hold'],
    d: [sq(6.25, 4.75, 4, 14.5, 1.25), sq(13.75, 4.75, 4, 14.5, 1.25)],
  },
  'pause-circle': {
    tags: ['pausa', 'pausar', 'pause circle', 'pause'],
    d: [circ(12, 12, 9), line([10, 8.75], [10, 15.25]), line([14, 8.75], [14, 15.25])],
  },
  stop: {
    tags: ['detener', 'parar', 'stop', 'halt'],
    d: [sq(5.25, 5.25, 13.5, 13.5, 3.5)],
  },
  'stop-circle': {
    tags: ['detener', 'parar', 'stop circle', 'stop'],
    d: [circ(12, 12, 9), sq(8.75, 8.75, 6.5, 6.5, 1.75)],
  },
  record: {
    tags: ['grabar', 'grabación', 'record', 'rec'],
    d: [circ(12, 12, 9), circ(12, 12, 4.75)],
  },
  'play-pause': {
    tags: ['reproducir o pausar', 'alternar', 'play pause', 'toggle'],
    d: [tri(11.25, 12, 8.25, 12, 1.5), line([15.5, 6.5], [15.5, 17.5]), line([20, 6.5], [20, 17.5])],
  },
  eject: {
    tags: ['expulsar', 'sacar', 'eject', 'remove disk'],
    d: [
      roundpoly(
        [
          [12, 4.25],
          [19.75, 13.25],
          [4.25, 13.25],
        ],
        1.75,
      ),
      line([4.25, 18], [19.75, 18]),
    ],
  },
  'skip-forward': {
    tags: ['siguiente', 'siguiente pista', 'saltar', 'next', 'skip', 'next track'],
    d: [tri(15.5, 12, 10.5, 14, 1.75), line([19, 5], [19, 19])],
  },
  'skip-back': {
    tags: ['anterior', 'pista anterior', 'regresar', 'previous', 'skip back', 'previous track'],
    d: [tri(8.5, 12, 10.5, 14, 1.75, -1), line([5, 5], [5, 19])],
  },
  // Antes la punta de un triángulo quedaba a 0.7 de la base del otro: ni se tocaban ni se separaban
  'fast-forward': {
    tags: ['adelantar', 'avanzar rápido', 'fast forward', 'seek forward'],
    d: FAST_FORWARD,
  },
  rewind: {
    tags: ['retroceder', 'regresar rápido', 'rewind', 'seek back'],
    d: FAST_FORWARD.map(mirrorPath),
  },
  repeat: {
    tags: ['repetir', 'bucle', 'repetir todo', 'repeat', 'loop'],
    d: repeat(),
  },
  'repeat-one': {
    tags: ['repetir una', 'repetir canción', 'repeat one', 'loop track'],
    d: [...repeat(), line([10.75, 11.25], [12.25, 10], [12.25, 14])],
  },
  shuffle: {
    tags: ['aleatorio', 'mezclar', 'shuffle', 'random'],
    // La que baja pasa por encima: va como insignia y el motor despeja a la otra con 1.5 de aire
    d: ['M3.25 17H6.5C11 17 12 7 16.5 7H20.75', head([20.75, 7], [1, 0], 3.4)],
    badge: (() => {
      const A = 'M3.25 7H6.5C11 7 12 17 16.5 17H20.75';
      return { d: [A, head([20.75, 17], [1, 0], 3.4)], knock: knockOf(A) };
    })(),
  },
  // ── Volumen ───────────────────────────────────────────────────────────────────────────────
  'volume-low': {
    tags: ['volumen bajo', 'sonido', 'audio', 'volume low', 'sound'],
    d: [SPEAKER, SPEAKER_WAVES[0]],
  },
  'volume-high': {
    tags: ['volumen alto', 'sonido', 'audio', 'volume high', 'loud'],
    d: [SPEAKER, ...SPEAKER_WAVES],
  },
  'volume-off': {
    tags: ['sin volumen', 'silencio', 'silenciar', 'volume off', 'mute', 'muted'],
    d: [SPEAKER, ...MUTE],
  },
  'volume-plus': {
    tags: ['subir volumen', 'más volumen', 'volume up', 'louder'],
    d: [SPEAKER, line([16.4, 12], [21.2, 12]), line([18.8, 9.6], [18.8, 14.4])],
  },
  'volume-minus': {
    tags: ['bajar volumen', 'menos volumen', 'volume down', 'quieter'],
    d: [SPEAKER, line([16.4, 12], [21.2, 12])],
  },
  // ── Música y audio ────────────────────────────────────────────────────────────────────────
  // Las notas llevan la cabeza oval e inclinada de la notación, con la plica tangente a su
  // costado: es la nota grabada, no un círculo con un palo.
  'music-note': {
    tags: ['nota musical', 'música', 'canción', 'music', 'song'],
    d: (() => {
      const n = note(9, 17.75, 3, 3.25, 2.3);
      return [n.head, n.stem, `M${N(n.x)} 3C${N(n.x)} 6.25 ${N(n.x + 5)} 6.5 ${N(n.x + 5)} 10.75`];
    })(),
  },
  'music-notes': {
    tags: ['notas', 'música', 'melodía', 'music', 'melody'],
    d: (() => {
      const a = note(6.75, 17.75, 6);
      const b = note(16.75, 15.75, 4);
      return [
        a.head,
        b.head,
        roundline(
          [
            [a.x, a.y],
            [a.x, 6],
            [b.x, 4],
            [b.x, b.y],
          ],
          [0, 0.75, 0.75, 0],
        ),
      ];
    })(),
  },
  playlist: {
    tags: ['lista de reproducción', 'canciones', 'playlist', 'queue'],
    d: (() => {
      const n = note(15.25, 18.5, 9.25, 2.75, 1.95);
      return [
        line([3.5, 5.5], [20.5, 5.5]),
        line([3.5, 10], [12.5, 10]),
        line([3.5, 14.5], [9.5, 14.5]),
        n.head,
        n.stem,
        line([n.x, 9.25], [n.x + 3, 10.5]),
      ];
    })(),
  },
  'playlist-play': {
    tags: ['reproducir lista', 'cola', 'a continuación', 'queue', 'playlist play', 'up next'],
    d: [
      line([3.5, 5.5], [20.5, 5.5]),
      line([3.5, 10], [11.5, 10]),
      line([3.5, 14.5], [11.5, 14.5]),
      line([3.5, 19], [11.5, 19]),
      tri(21, 14.5, 6.25, 8.5, 1.25),
    ],
  },
  // Bandas de un analizador de espectro que suben desde una base común: graves, medios y agudos
  // con su forma típica (antes eran líneas con un punto encima y se leían como letras «i»).
  equalizer: {
    tags: ['ecualizador', 'niveles', 'espectro', 'equalizer', 'audio levels'],
    d: [4.5, 8.25, 12, 15.75, 19.5].map((x, i) => line([x, 20], [x, [11.5, 5.5, 9, 4, 13][i]])),
  },
  'audio-waveform': {
    tags: ['onda de audio', 'forma de onda', 'voz', 'waveform', 'audio', 'voice'],
    d: [3, 6, 9, 12, 15, 18, 21].map((x, i) => {
      const h = [1.5, 4.25, 8, 5, 7, 3.5, 1.5][i];
      return line([x, 12 - h], [x, 12 + h]);
    }),
  },
  radio: {
    tags: ['radio', 'estación', 'fm', 'am', 'radio station'],
    d: [
      sq(2.5, 7.5, 19, 13, 3, BR),
      line([7, 7.5], [17.25, 3.25]),
      circ(8.5, 14, 3),
      line([14.5, 12.25], [18, 12.25]),
      line([14.5, 15.75], [18, 15.75]),
    ],
  },
  disc: {
    tags: ['disco', 'cd', 'dvd', 'disc', 'compact disc'],
    d: [circ(12, 12, 9), circ(12, 12, 2.25), arc(12, 12, 5.75, 195, 255).d],
  },
  // Etiqueta de r 3 y surcos de r 6: 3 de aire contra el borde y contra la etiqueta (antes 2.75)
  vinyl: {
    tags: ['vinil', 'acetato', 'tocadiscos', 'vinyl', 'record'],
    d: [circ(12, 12, 9), circ(12, 12, 3), dot(12, 12, 0.3), arc(12, 12, 6, 200, 250).d, arc(12, 12, 6, 20, 70).d],
  },
  podcast: {
    tags: ['podcast', 'episodio', 'programa', 'audio', 'episode', 'show'],
    d: [
      capsule(10.25, 8.25, 3.5, 6),
      line([12, 14.25], [12, 21.25]),
      arc(12, 11, 5.75, 130, 410).d,
      arc(12, 11, 9, 130, 410).d,
    ],
  },
  live: {
    tags: ['en vivo', 'transmisión', 'directo', 'live', 'streaming', 'broadcast'],
    d: [
      sq(2.5, 5, 19, 14, 3.5, BR),
      dot(12, 12),
      arc(12, 12, 4, -45, 45).d,
      arc(12, 12, 4, 135, 225).d,
    ],
  },
  // La portada cuadrada con la nota grabada del set (antes era un cuadro con un círculo y se leía
  // como bocina o lente; un disco asomando por detrás no se distinguía a 18 px).
  album: {
    tags: ['álbum', 'portada', 'disco', 'album', 'cover', 'music library'],
    d: (() => {
      const n = note(10.75, 15.5, 7.25, 2.5, 1.75);
      return [sq(3.25, 3.25, 17.5, 17.5, 4, BR), n.head, n.stem, `M${N(n.x)} 7.25C${N(n.x)} 9.25 ${N(n.x + 3.5)} 9.5 ${N(n.x + 3.5)} 12.25`];
    })(),
  },
  // ── Imagen y video ────────────────────────────────────────────────────────────────────────
  image: {
    tags: ['imagen', 'foto', 'fotografía', 'image', 'photo', 'picture'],
    d: image(),
  },
  images: {
    tags: ['galería', 'fotos', 'álbum de fotos', 'gallery', 'images', 'photos'],
    // La foto de atrás completa; la de adelante (con su sol y su cordillera) va como insignia y el
    // motor despeja la de atrás con 1.5 de aire. Corridas 4.25 en horizontal: la esquina de abajo de la
    // de atrás asoma con un tramo de 2 (con 3.5 quedaba un pie suelto de 1.25)
    d: [sq(6.75, 3.25, 14.75, 13.5, 3, BR)],
    badge: (() => {
      const frame = sq(2.5, 7.25, 14.75, 13.5, 3, BR);
      const sun = dot(13.5, 10.75);
      const ridge = roundline([toEdge([10, 12.25], [0, 20.17], frame), [10, 12.25], [17.25, 17.91]], [0, 1.25, 0]);
      return front([frame, sun, ridge], frame, { solid: [frame], cut: [sun, extend(ridge)] });
    })(),
  },
  'image-off': {
    tags: ['sin imagen', 'imagen rota', 'image off', 'no image', 'broken image'],
    d: image(),
    badge: slashOver(),
  },
  film: {
    tags: ['película', 'cinta', 'cine', 'film', 'movie', 'video'],
    d: (() => {
      const box = sq(4.75, 2.75, 14.5, 18.5, 3.5, BR);
      const inner = [line([8.5, 1], [8.5, 23]), line([15.5, 1], [15.5, 23])];
      // Dos travesaños por lado parten cada orilla en tres perforaciones (con tres era denso)
      const ticks = [9, 15].flatMap((y) => [line([4.75, y], [8.5, y]), line([15.5, y], [19.25, y])]);
      return [box, ...cut(inner, [outside(box)]), ...ticks];
    })(),
  },
  clapperboard: {
    tags: ['claqueta', 'cine', 'rodaje', 'clapperboard', 'movie', 'film'],
    d: [sq(3.25, 9.5, 17.5, 11.25, 3, { square: ['tl', 'br'] }), ...clapper()],
  },
  'slow-motion': {
    tags: ['cámara lenta', 'velocidad', 'slow motion', 'slowmo'],
    d: [arc(12, 12, 9, -90, 180).d, dot(...polar(12, 12, 9, 210)), dot(...polar(12, 12, 9, 240)), tri(15.5, 12, 5.75, 7, 1.1)],
  },
  // Dos renglones centrados al pie de la imagen, como se ven los subtítulos en pantalla
  captions: {
    tags: ['subtítulos', 'texto en pantalla', 'subtitles', 'captions', 'cc'],
    d: [sq(2.5, 5, 19, 14, 3.5, BR), line([6.5, 12.75], [17.5, 12.75]), line([8.75, 15.75], [15.25, 15.75])],
  },
  aperture: {
    tags: ['apertura', 'diafragma', 'lente', 'aperture', 'lens'],
    d: aperture(),
  },
  'camera-focus': {
    tags: ['enfocar', 'visor', 'escanear', 'focus', 'viewfinder', 'scan'],
    d: [
      ...cut(sq(3.25, 3.25, 17.5, 17.5, 4, BR), [(p) => (p[0] > 8.75 && p[0] < 15.25) || (p[1] > 8.75 && p[1] < 15.25)]),
      circ(12, 12, 3.25),
    ],
  },
  'camera-flip': {
    tags: ['cambiar cámara', 'cámara frontal', 'flip camera', 'switch camera'],
    d: (() => {
      // Las flechas giran en el lugar del lente; sus puntas quedan a los lados, lejos del borde
      const [body, hump] = camera();
      const a = arc(12, 13.5, 3.5, 205, 335);
      const b = arc(12, 13.5, 3.5, 25, 155);
      return [body, hump, a.d, head(a.end, a.tangent, 2.5), b.d, head(b.end, b.tangent, 2.5)];
    })(),
  },
  'picture-in-picture': {
    tags: ['imagen en imagen', 'ventana flotante', 'picture in picture', 'pip'],
    d: [sq(2.5, 5, 19, 14, 3.5, BR), sq(11.5, 11, 7, 5, 1.5, BR)],
  },
  'video-player': {
    tags: ['reproductor', 'video', 'progreso', 'player', 'media', 'video player'],
    d: [sq(2.5, 5, 19, 14, 3.5, BR), tri(14.75, 10.25, 4.5, 5.5, 1), line([6, 15.75], [18, 15.75]), dot(8, 15.75)],
  },
  'screen-mirror': {
    tags: ['duplicar pantalla', 'proyectar', 'transmitir', 'screen mirroring', 'mirror', 'stream'],
    // La pantalla completa; el triángulo va enfrente como insignia y el motor la despeja con 1.5 de aire
    d: [sq(2.5, 4, 19, 13, 3, BR)],
    badge: front([
      roundpoly(
        [
          [12, 13.25],
          [16.75, 20.5],
          [7.25, 20.5],
        ],
        1.25,
      ),
    ]),
  },
  // La etiqueta arriba y los dos carretes como aros abajo; sin la tangente entre carretes ni la
  // boca trapezoidal, que con los carretes arriba lo volvían una cara.
  cassette: {
    tags: ['casete', 'cinta', 'mixtape', 'cassette', 'tape'],
    d: [sq(2.5, 5, 19, 14, 3, BR), line([6.5, 8.25], [17.5, 8.25]), circ(8.25, 13.5, 2.25), circ(15.75, 13.5, 2.25)],
  },
  // ── Puertos, carga y más equipos ──────────────────────────────────────────────────────────
  'wireless-charging': {
    tags: ['carga inalámbrica', 'cargador', 'base de carga', 'wireless charging', 'charger', 'qi'],
    d: [
      capsule(3.25, 16.5, 17.5, 3.75),
      line([12.75, 3.75], [9.75, 8.75], [14.25, 8.75], [11.25, 13.25]),
      arc(12, 8.5, 6.75, 140, 220).d,
      arc(12, 8.5, 6.75, -40, 40).d,
    ],
  },
  ethernet: {
    tags: ['ethernet', 'red', 'cable de red', 'lan', 'network', 'port'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, BR), roundpoly(PORT, PORT_R)],
  },
  joystick: {
    tags: ['palanca', 'arcade', 'videojuego', 'joystick', 'game', 'retro'],
    // Palanca de arcade: bola sobre un vástago que sale de una base en domo
    d: [dome(3.25, 20.75, 20.75, 5.25), line([12, 15.5], [12, 9.5]), circ(12, 6.25, 3.25)],
  },
  scanner: {
    tags: ['escáner', 'escanear', 'digitalizar', 'scanner', 'scan', 'document'],
    d: [sq(2.5, 11.75, 19, 8.5, 2.5, BR), line([3, 8.75], [20.75, 4.25]), line([6, 16], [18, 16])],
  },
  turntable: {
    tags: ['tocadiscos', 'tornamesa', 'vinilo', 'turntable', 'dj', 'record player'],
    // Mueble apaisado (era cuadrado y pesaba de más) y plato completo con su eje; el brazo, del
    // pivote hasta el disco, pasa por encima como insignia y el motor despeja el plato con 1.5 de aire.
    d: [sq(2.5, 5, 19, 14, 3.5, BR), circ(9.5, 12, 4), keepDot(9.5, 12)],
    badge: (() => {
      const tone = roundline(
        [
          [17.5, 8.25],
          [17.5, 12.75],
          [13.25, 14.75],
        ],
        [0, 1, 0],
      );
      return { d: [dot(17.5, 8.25), tone], knock: knockOf(tone) };
    })(),
  },
  tripod: {
    tags: ['tripié', 'trípode', 'soporte', 'tripod', 'stand', 'camera stand'],
    d: [
      sq(7.5, 3, 9, 4.75, 1.45, BR),
      line([12, 7.75], [12, 21]),
      line([12, 10.75], [5.5, 21]),
      line([12, 10.75], [18.5, 21]),
    ],
  },
  drone: {
    tags: ['dron', 'cuadricóptero', 'vuelo', 'drone', 'quadcopter', 'aerial'],
    d: [
      sq(8.75, 9.5, 6.5, 5.25, 1.6),
      line([3.25, 12], [8.75, 12]),
      line([15.25, 12], [20.75, 12]),
      line([5.25, 12], [5.25, 6.25]),
      line([18.75, 12], [18.75, 6.25]),
      line([2.75, 6.25], [7.75, 6.25]),
      line([16.25, 6.25], [21.25, 6.25]),
      line([10.25, 14.75], [9, 18.25]),
      line([13.75, 14.75], [15, 18.25]),
    ],
  },

  // ── Cobertura (ronda 2) ───────────────────────────────────────────────────────────────────────
  'sim-card': {
    tags: ['tarjeta sim', 'chip', 'línea móvil', 'plan de datos', 'sim card', 'esim', 'mobile plan'],
    // La tarjeta (como `sd-card`, pero vista de frente: el chaflán arriba a la derecha) con el chip
    // de cuatro contactos.
    d: [
      roundpoly(
        [
          [5.25, 2.75],
          [14.75, 2.75],
          [18.75, 6.75],
          [18.75, 21.25],
          [5.25, 21.25],
        ],
        [2.5, 1, 1, 0, 2.5],
      ),
      sq(8.5, 11.25, 7, 7, 1.5),
      line([8.5, 14.75], [15.5, 14.75]),
      line([12, 11.25], [12, 18.25]),
    ],
  },
  'image-sparkle': {
    tags: ['imagen con ia', 'generar imagen', 'foto generada', 'editar con ia', 'ai image', 'generate image', 'ai photo'],
    // La foto y, en la esquina de arriba, la chispa de IA (la de datos/sparkle) como pieza propia:
    // el motor despeja el marco con 1.5 de aire. Sin el sol: la chispa ocupa su lugar, a 3 de la cima
    // de la cordillera (más cerca, el despeje la mordía).
    d: [IMAGE_FRAME, image()[2]],
    badge: (() => {
      const spark = aiSpark(18.75, 5.5, 3);
      return { d: [spark], knock: spark, fill: { solid: [spark] } };
    })(),
  },
};

// ── Relleno (DESIGN.md › Relleno) ─────────────────────────────────────────────────────────────
// Por índice de d: `solid` se rellena (y conserva su trazo, así la silueta es idéntica), `cut` se
// cala al ancho del trazo y `lines` sigue siendo línea, con 1.5 de aire contra el relleno.
const FILL = {
  smartphone: { solid: [0], cut: [1] },
  'smartphone-vibrate': { solid: [0], cut: [1], lines: [2, 3, 4, 5] },
  tablet: { solid: [0], cut: [1] },
  laptop: { solid: [0], lines: [1] },
  desktop: { solid: [0, 1, 2] },
  devices: { solid: [0, 1, 2] },
  // Las correas se rellenan hasta el canto de la caja: el reloj entero es una silueta
  watch: { solid: [0, 1, 2, 3] },
  tv: { solid: [0, 1, 2] },
  keyboard: { solid: [0], cut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  mouse: { solid: [0], cut: [1] },
  // Cuerpo, hoja de entrada y hoja de salida forman una silueta; la ranura se cala
  printer: { solid: [0, 1, 3], cut: [2] },
  camera: { solid: [0, 1], cut: [2] },
  'camera-off': { solid: [0, 1], cut: [2] },
  'video-camera': { solid: [0, 1] },
  'video-camera-off': { solid: [0, 1] },
  webcam: { solid: [0, 2, 3], cut: [1] },
  earbuds: { solid: [0, 1] },
  'speaker-box': { solid: [0], cut: [1, 2] },
  'smart-speaker': { solid: [0], cut: [1, 2, 3] },
  'remote-control': { solid: [0], cut: [1, 2, 3, 4, 5] },
  gamepad: { solid: [0], cut: [1, 2, 3] },
  'vr-headset': { solid: [0] },
  'sd-card': { solid: [0], cut: [1, 2, 3] },
  'usb-drive': { solid: [0, 1], cut: [2] },
  router: { solid: [0, 1, 2], cut: [3, 4, 5] },
  projector: { solid: [0, 4, 5], cut: [1, 2, 3] },
  'battery-charging': { solid: [0], lines: [1], cut: [2] },
  'power-plug': { solid: [0, 1, 2, 3] },
  outlet: { solid: [0], cut: [1, 2, 3] },
  play: { solid: [0] },
  pause: { solid: [0, 1] },
  'pause-circle': { solid: [0], cut: [1, 2] },
  stop: { solid: [0] },
  // El botón de grabar: el punto se rellena y el aro sigue siendo línea
  record: { solid: [1], lines: [0] },
  'play-pause': { solid: [0, 1, 2] },
  eject: { solid: [0, 1] },
  'skip-forward': { solid: [0, 1] },
  'skip-back': { solid: [0, 1] },
  'fast-forward': { solid: [0, 1] },
  rewind: { solid: [0, 1] },
  'volume-low': { solid: [0], lines: [1] },
  'volume-high': { solid: [0], lines: [1, 2] },
  'volume-off': { solid: [0], lines: [1, 2] },
  'volume-plus': { solid: [0], lines: [1, 2] },
  'volume-minus': { solid: [0], lines: [1] },
  playlist: { solid: [0, 1, 2, 3, 4, 5] },
  'playlist-play': { solid: [0, 1, 2, 3, 4] },
  radio: { solid: [0, 1], cut: [2, 3, 4] },
  vinyl: { solid: [0], cut: [1, 2, 3, 4] },
  podcast: { solid: [0, 1], lines: [2, 3] },
  live: { solid: [0], cut: [1, 2, 3] },
  images: { solid: [0] },
  'slow-motion': { solid: [1, 2, 3], lines: [0] },
  captions: { solid: [0], cut: [1, 2] },
  'camera-focus': { solid: [4], lines: [0, 1, 2, 3] },
  'camera-flip': { solid: [0, 1], cut: [2, 3, 4, 5] },
  // Imagen en imagen: se rellena la ventana flotante, que es lo que el ícono señala
  'picture-in-picture': { solid: [1], lines: [0] },
  'screen-mirror': { solid: [0] },
  cassette: { solid: [0], cut: [1, 2, 3] },
  'wireless-charging': { solid: [0], lines: [1, 2, 3] },
  joystick: { solid: [0, 1, 2] },
  scanner: { solid: [0], lines: [1], cut: [2] },
  turntable: { solid: [0], cut: [1, 2] },
  tripod: { solid: [0, 1, 2, 3] },
  drone: { solid: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  'sim-card': { solid: [0], cut: [1, 2, 3] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }) };
}
// Piezas abiertas que tocan al cuerpo (antena, diadema, brazos, plica, viga): van de ida y vuelta
// (twin) para no rellenarse hasta su cuerda ni morder el cuerpo con el aire de `lines`.
{
  const d = (n) => icons[n].d;
  icons['tv-retro'].fill = { solid: [d('tv-retro')[0], twin(d('tv-retro')[1])], cut: [d('tv-retro')[2], d('tv-retro')[3]] };
  icons.headphones.fill = { solid: [twin(d('headphones')[0]), d('headphones')[1], d('headphones')[2]] };
  // El USB relleno: la punta se vuelve un triángulo sólido; los brazos acodados, de ida y vuelta
  const u = d('usb');
  icons.usb.fill = { solid: [u[0], u[1], u[2], twin(u[3]), u[4], twin(u[5]), u[6]] };
  icons['music-note'].fill = { solid: [d('music-note')[0], d('music-note')[1], twin(d('music-note')[2])] };
  icons['music-notes'].fill = { solid: [d('music-notes')[0], d('music-notes')[1], twin(d('music-notes')[2])] };
  // La pantalla del cast se cierra con un arco concéntrico a las ondas, a 3 de la más grande: el
  // relleno llega hasta donde termina el contorno abierto sin pisar las ondas
  const c = d('cast');
  icons.cast.fill = { solid: [`${c[0]}A10.25 10.25 0 0 0 2.5 9.3Z`, c[1]], lines: [c[2], c[3]] };
  // Detalles que llegan al contorno (la ranura de la linterna, la banda del micrófono, la cordillera,
  // las perforaciones, las franjas de la claqueta): se calan de lado a lado, sin muesca en la silueta
  const x = (name, i, k0 = 1, k1 = 1) => extend(d(name)[i], k0, k1);
  icons.flashlight.fill = { solid: [d('flashlight')[0]], cut: [x('flashlight', 1), d('flashlight')[2]] };
  icons['flashlight-on'].fill = { solid: [d('flashlight-on')[0]], cut: [x('flashlight-on', 1), d('flashlight-on')[2]], lines: d('flashlight-on').slice(3) };
  icons['microphone-handheld'].fill = { solid: d('microphone-handheld').slice(0, 2), cut: [x('microphone-handheld', 2)] };
  icons['microphone-studio'].fill = { solid: [0, 3, 4].map((i) => d('microphone-studio')[i]), cut: [x('microphone-studio', 1), x('microphone-studio', 2)] };
  for (const name of ['image', 'image-off']) icons[name].fill = { solid: [d(name)[0]], cut: [d(name)[1], x(name, 2)] };
  icons['image-sparkle'].fill = { solid: [d('image-sparkle')[0]], cut: [x('image-sparkle', 1)] };
  // La película: las perforaciones quedan como bloques; solo se alarga el extremo de afuera de cada
  // travesaño (el de adentro toca el carril y no debe morder la franja central)
  icons.film.fill = { solid: [d('film')[0]], cut: [x('film', 1), x('film', 2), x('film', 3, 1, 0), x('film', 4, 0, 1), x('film', 5, 1, 0), x('film', 6, 0, 1)] };
  icons.clapperboard.fill = { solid: d('clapperboard').slice(0, 2), cut: [2, 3, 4].map((i) => x('clapperboard', i)) };
  // El diafragma: el aro sigue entero; las láminas se calan hasta 0.75 antes de su línea
  icons.aperture.fill = { solid: [d('aperture')[0]], cut: aperture(8.25).slice(1) };
  // Lo que en el contorno es un hueco (el triángulo de play, el cuadro de stop, el hoyo del disco, la
  // cabeza de la nota, el puerto) se vacía en el relleno. El hueco va 0.75 por fuera de la figura y
  // la figura se cala: el borde del hueco lo da la máscara, en el borde exterior de la línea, sin la
  // costura que dejan dos bordes suavizados en el mismo lugar.
  for (const [name, hole, cut] of [
    ['play-circle', grown(triPts(16.25, 12, 6.25, 8), 1.25, 0.75), [1]],
    ['stop-circle', sq(8, 8, 8, 8, 2.5), [1]],
    ['disc', circ(12, 12, 3), [1, 2]],
    ['album', ellipse(10.75, 15.5, 3.25, 2.5, -24), [1, 2, 3]],
    ['video-player', grown(triPts(14.75, 10.25, 4.5, 5.5), 1, 0.75), [1, 2, 3]],
    ['ethernet', grown(PORT, PORT_R, 0.75), [1]],
  ])
    icons[name].fill = { solid: [withHoles(d(name)[0], hole)], cut: cut.map((i) => d(name)[i]) };
}
// Solo líneas abiertas (ondas, barras, flechas, la runa de bluetooth): su relleno es el mismo
// contorno. Las baterías por nivel tampoco: un cuerpo sólido se lee como batería llena, tenga las
// barras que tenga.
for (const name of [
  'power', 'wifi', 'wifi-medium', 'wifi-low', 'wifi-off', 'bluetooth', 'bluetooth-connected',
  'signal', 'signal-high', 'signal-medium', 'signal-low', 'repeat', 'repeat-one', 'shuffle', 'equalizer', 'audio-waveform',
  'battery-full', 'battery-half', 'battery-low', 'battery-empty',
])
  icons[name].fill = false;

// ── 16 px (DESIGN.md › 16 px): dibujos propios donde el ajuste al pixel no basta ──────────────
// A 16 px un pixel mide 1.5 del lienzo: los tramos rectos van en centros de pixel (0.75 + 1.5k), las
// diagonales a 45° pasan por centros de pixel (x ± y múltiplo de 1.5), los círculos tocan centros de
// pixel en sus cuatro puntos cardinales y los puntos de 2 × 2 pixeles se centran en una esquina de
// pixel. Entre piezas, 1 px de aire como mínimo. Un dibujo centrado en x 12 con un trazo vertical
// al centro se corre medio pixel a la derecha (12.75): un trazo en 12 se vería de 2 px y gris.
const small = (name, d, fill, badge) => {
  icons[name].small = { d, ...(fill && { fill }), ...(badge && { badge }) };
};
const sdot = (x, y) => dot(x, y, 1);
{
  // Teclado: dos filas de tres teclas de 2 px y la barra espaciadora, con 1 px entre filas (los
  // puntos de 0.3 se volvían bandas grises)
  const body = sq(2.25, 6.75, 19.5, 12, 3, BR);
  const keys = [9.75, 12.75].flatMap((y) => [6.75, 11.25, 15.75].map((x) => line([x, y], [x + 1.5, y])));
  const bar = line([8.25, 15.75], [15.75, 15.75]);
  small('keyboard', [body, ...keys, bar], { solid: [body], cut: [...keys, bar] });
}
{
  // Control remoto: el botón grande como un cuadro de 4 px hueco (un aro de 4 px se llenaba de gris)
  // y cuatro botones de 1 px
  const body = sq(6.75, 2.25, 10.5, 19.5, 3, BR);
  const ring = sq(9.75, 5.25, 4.5, 4.5, 1.2);
  const keys = [14.25, 17.25].flatMap((y) => [9.75, 14.25].map((x) => dot(x, y, 0.3)));
  small('remote-control', [body, ring, ...keys], { solid: [body], cut: [ring, ...keys] });
}
{
  // Control de juego: la cruceta de 3 px y la palanca como disco de 3 px, a 2 px entre ellas
  const body = roundpoly(
    [
      [6, 5.25],
      [18, 5.25],
      [21.5, 16.25],
      [18.25, 19],
      [15.25, 15.75],
      [8.75, 15.75],
      [5.75, 19],
      [2.5, 16.25],
    ],
    [3.25, 3.25, 2.25, 1.5, 1.5, 1.5, 1.5, 2.25],
  );
  const dpad = [line([6.75, 9.75], [9.75, 9.75]), line([8.25, 8.25], [8.25, 11.25])];
  const stick = dot(15.75, 9.75, 0.75);
  small('gamepad', [body, ...dpad, stick], { solid: [body], cut: [...dpad, stick] });
}
{
  // Contacto: la placa, el aro de la toma y dos ranuras de 1 × 2 px (los dos hoyos redondos se
  // volvían una mancha gris)
  const plate = sq(2.25, 2.25, 19.5, 19.5, 4, BR);
  const ring = circ(12, 12, 5.25);
  const slots = [9.75, 14.25].map((x) => line([x, 11.25], [x, 12.75]));
  small('outlet', [plate, ring, ...slots], { solid: [plate], cut: [ring, ...slots] });
}
{
  // Proyector: el lente como aro de 5 px con el centro hueco y dos renglones a su altura
  const body = sq(2.25, 5.25, 19.5, 12, 3, BR);
  const lens = circ(15.75, 11.25, 3);
  const rows = [9.75, 12.75].map((y) => line([5.25, y], [8.25, y]));
  const feet = [5.25, 18.75].map((x) => line([x, 17.25], [x, 20.25]));
  small('projector', [body, lens, ...rows, ...feet], { solid: [body, ...feet], cut: [lens, ...rows] });
}
{
  // Batería cargando: un rayo más alto y sin esquinas redondas (el de 5 de alto se volvía un borrón;
  // uno de diagonales a 45° se leía como una cruz); el cuerpo crece 1 px hacia abajo para dejarle
  // aire arriba y abajo
  const body = sq(2.25, 6.75, 16.5, 12, 3, BR);
  const tip = line([21.75, 11.25], [21.75, 14.25]);
  const bolt = line([12.25, 9.5], [8.75, 12.75], [12.75, 12.75], [9.25, 16]);
  small('battery-charging', [body, tip, bolt], { solid: [body], lines: [tip], cut: [bolt] });
}
{
  // Cambiar de cámara: a 16 px las flechas en círculo se empastaban; dos flechas opuestas (⇄)
  const body = sq(2.25, 6.75, 19.5, 13.5, 3, BR);
  const hump = roundline(
    [
      [8.25, 6.75],
      [9.75, 3.75],
      [14.25, 3.75],
      [15.75, 6.75],
    ],
    [0, 0.75, 0.75, 0],
  );
  const arrows = [line([8.25, 11.25], [15.75, 11.25]), head([15.75, 11.25], [1, 0], 1.5 * Math.SQRT2), line([15.75, 15.75], [8.25, 15.75]), head([8.25, 15.75], [-1, 0], 1.5 * Math.SQRT2)];
  small('camera-flip', [body, hump, ...arrows], { solid: [body, hump], cut: arrows });
}
{
  // Carga inalámbrica: el rayo (el de la batería, más grande) sobre la base; sin las ondas, que a
  // 16 px lo encerraban en un paréntesis gris
  const pad = capsule(3.75, 17.25, 16.5, 3);
  const bolt = line([13.87, 4.94], [9.5, 9], [14.5, 9], [10.12, 13.06]);
  small('wireless-charging', [pad, bolt], { solid: [pad], lines: [bolt] });
}
{
  // SIM: el chaflán a 45° por centros de pixel y el chip con un solo renglón
  const card = roundpoly(
    [
      [5.25, 2.25],
      [14.25, 2.25],
      [18.75, 6.75],
      [18.75, 21.75],
      [5.25, 21.75],
    ],
    [2.25, 1, 1, 0, 2.25],
  );
  const chip = sq(8.25, 12.75, 7.5, 6, 1.25);
  const contact = line([8.25, 15.75], [15.75, 15.75]);
  small('sim-card', [card, chip, contact], { solid: [card], cut: [chip, contact] });
}
{
  // Tocadiscos: plato de aro limpio y el brazo encima, despejado por el motor
  const cabinet = sq(2.25, 5.25, 19.5, 13.5, 3, BR);
  const platter = circ(9, 12, 3.75);
  const tone = line([17.25, 6.75], [17.25, 12.75], [14.25, 15.75]);
  small('turntable', [cabinet, platter], { solid: [cabinet], cut: [platter] }, { d: [tone], knock: knockOf(tone) });
}
{
  // USB: el tridente con el tallo en un centro de pixel, brazos a 45° y remates de 3 px
  const stem = line([12.75, 2.25], [12.75, 17.25]);
  const tip = line([11.25, 3.75], [12.75, 2.25], [14.25, 3.75]);
  const base = circ(12.75, 18.75, 1.5);
  const left = line([12.75, 15.75], [6.75, 9.75], [6.75, 8.25]);
  const bead = circ(6.75, 6.75, 1.5);
  const right = line([12.75, 14.25], [17.25, 9.75]);
  const block = sq(15.75, 6.75, 3, 3, 0.6);
  small('usb', [stem, tip, base, left, bead, right, block], { solid: [stem, tip, base, twin(left), bead, right, block] });
}
{
  // Podcast: corrido medio pixel a la derecha para que el tallo sea de 1 px; el micrófono y una sola
  // onda (con dos, los arcos se volvían un abanico gris)
  const mic = capsule(11.25, 6.75, 3, 6);
  const stem = line([12.75, 12.75], [12.75, 20.25]);
  const wave = arc(12.75, 9.75, 6, 140, 400).d;
  small('podcast', [mic, stem, wave], { solid: [mic, stem], lines: [wave] });
}
{
  // En vivo: el punto de 2 × 2 px y un par de arcos que tocan centros de pixel, a 2 px del punto
  // (a 1 px se juntaban con él en un moño)
  const frame = sq(2.25, 5.25, 19.5, 13.5, 3.5, BR);
  const signal = [sdot(12, 12), arc(12, 12, 5.25, -40, 40).d, arc(12, 12, 5.25, 140, 220).d];
  small('live', [frame, ...signal], { solid: [frame], cut: signal });
}
{
  // Bluetooth: la runa con sus cuatro diagonales a 45° por centros de pixel, cruzando el tallo en un
  // solo punto (las del dibujo grande caían entre pixeles)
  const rune = line([8.25, 8.25], [17.25, 17.25], [12.75, 21.75], [12.75, 3.75], [17.25, 8.25], [8.25, 17.25]);
  small('bluetooth', [rune]);
  small('bluetooth-connected', [rune, sdot(4.5, 12), sdot(21, 12)]);
}
{
  // Sin volumen: la bocina ajustada al pixel y una × de 5 px con un solo pixel al centro
  const speaker = snap(SPEAKER);
  const x = [line([15.75, 9.75], [21.75, 15.75]), line([21.75, 9.75], [15.75, 15.75])];
  small('volume-off', [speaker, ...x], { solid: [speaker], lines: x });
}
{
  // Cámara web: corrida medio pixel a la derecha (el soporte de 1 px); aro de r 6 y lente de 3 px
  const ring = circ(12.75, 9.75, 6);
  const lens = circ(12.75, 9.75, 1.5);
  const stand = [line([12.75, 15.75], [12.75, 20.25]), line([8.25, 20.25], [17.25, 20.25])];
  small('webcam', [ring, lens, ...stand], { solid: [ring, ...stand], cut: [lens] });
}
{
  // Bocina: el gabinete de 14 px de alto, el tweeter como punto de 2 × 2 px y el woofer de aro limpio
  const cabinet = sq(5.25, 2.25, 13.5, 19.5, 3.5, BR);
  const tweeter = sdot(12, 7.5);
  const woofer = circ(12, 15, 3.75);
  small('speaker-box', [cabinet, tweeter, woofer], { solid: [cabinet], cut: [tweeter, woofer] });
}
{
  // Casete: los carretes como aros de 3 px centrados en un pixel (huecos; los de 4 px se llenaban de
  // gris)
  const body = sq(2.25, 5.25, 19.5, 13.5, 3, BR);
  const label = line([6.75, 8.25], [17.25, 8.25]);
  const reels = [circ(8.25, 14.25, 1.5), circ(15.75, 14.25, 1.5)];
  small('cassette', [body, label, ...reels], { solid: [body], cut: [label, ...reels] });
}
{
  // Radio: la bocina como aro de 5 px centrado en un pixel y los renglones a su altura
  const body = sq(2.25, 8.25, 19.5, 12, 3, BR);
  const antenna = line([6.75, 8.25], [17.25, 3.75]);
  const speaker = circ(8.25, 14.25, 3);
  const rows = [12.75, 15.75].map((y) => line([15.75, y], [18.75, y]));
  small('radio', [body, antenna, speaker, ...rows], { solid: [body, antenna], cut: [speaker, ...rows] });
}
{
  // Vinil: el disco que toca centros de pixel, la etiqueta como punto de 2 × 2 px y dos surcos más
  // largos (con la etiqueta como aro de 4 px se volvía una mancha)
  const disc = circ(12, 12, 8.25);
  const label = sdot(12, 12);
  const grooves = [arc(12, 12, 5.25, 190, 260).d, arc(12, 12, 5.25, 10, 80).d];
  small('vinyl', [disc, label, ...grooves], { solid: [disc], cut: [label, ...grooves] });
}
{
  // Cámara lenta: el arco que toca centros de pixel, dos puntos de 1 px y el triángulo a 45°
  const ring = arc(12, 12, 8.25, -90, 180).d;
  const dots = [dot(5.25, 8.25, 0.3), dot(8.25, 5.25, 0.3)];
  const play = roundpoly(
    [
      [9.75, 8.25],
      [13.5, 12],
      [9.75, 15.75],
    ],
    0.75,
  );
  small('slow-motion', [ring, ...dots, play], { solid: [...dots, play], lines: [ring] });
}

// ── Niveles (DESIGN.md › Niveles): de menos a más; el punto del wifi y el cuerpo quedan siempre ──
icons.wifi.levels = [[1], [2], [3]];
icons.signal.levels = [[0], [1], [2], [3]];
icons['battery-full'].levels = [[2], [3], [4], [5]];
icons['volume-high'].levels = [[1], [2]];

// ── Espejo (DESIGN.md › Espejo): las bocinas y las listas con sangría se voltean de derecha a
// izquierda. Los controles de reproducción no: describen el sentido de la cinta, no el de la lectura.
for (const name of ['volume-low', 'volume-high', 'volume-off', 'volume-plus', 'volume-minus', 'playlist', 'playlist-play']) icons[name].mirror = true;

// ── Piezas con nombre (DESIGN.md › Piezas): lo que se mueve, cambia de estado o es una insignia ──
const parts = {
  'smartphone-vibrate': { body: [0, 1], wave: [2, 3, 4, 5] },
  devices: { screen: [0], stand: [1, 2] },
  camera: { body: [0, 1], lens: [2] },
  'camera-off': { body: [0, 1], lens: [2] },
  'video-camera': { body: [0], lens: [1] },
  'video-camera-off': { body: [0], lens: [1] },
  printer: { body: [0], paper: [1], slot: [2], sheet: [3] },
  'speaker-box': { cabinet: [0], tweeter: [1], woofer: [2] },
  'smart-speaker': { body: [0], wave: [1, 2, 3] },
  gamepad: { body: [0], dpad: [1, 2], stick: [3] },
  'flashlight-on': { body: [0, 1, 2], rays: [3, 4, 5] },
  'battery-full': { body: [0, 1], level: [2, 3, 4, 5] },
  'battery-half': { body: [0, 1], level: [2, 3] },
  'battery-low': { body: [0, 1], level: [2] },
  'battery-empty': { body: [0, 1] },
  'battery-charging': { body: [0, 1], bolt: [2] },
  'power-plug': { plug: [0, 1, 2], cable: [3] },
  wifi: { dot: [0], level: [1, 2, 3] },
  'wifi-medium': { dot: [0], level: [1, 2] },
  'wifi-low': { dot: [0], level: [1] },
  'wifi-off': { dot: [0], level: [1, 2, 3] },
  signal: { level: [0, 1, 2, 3] },
  'signal-high': { level: [0, 1, 2], empty: [3] },
  'signal-medium': { level: [0, 1], empty: [2, 3] },
  'signal-low': { level: [0], empty: [1, 2, 3] },
  cast: { screen: [0], signal: [1, 2, 3] },
  'play-circle': { shape: [0], play: [1] },
  'pause-circle': { shape: [0], pause: [1, 2] },
  'stop-circle': { shape: [0], stop: [1] },
  record: { ring: [0], dot: [1] },
  eject: { arrow: [0], bar: [1] },
  // El triángulo de atrás y el de adelante (el que apunta), para encenderlos uno tras otro
  'fast-forward': { back: [0], front: [1] },
  rewind: { back: [0], front: [1] },
  'skip-forward': { arrow: [0], bar: [1] },
  'skip-back': { arrow: [0], bar: [1] },
  repeat: { arrow: [0, 1, 2, 3] },
  'repeat-one': { arrow: [0, 1, 2, 3], one: [4] },
  shuffle: { arrow: [0, 1] },
  'volume-low': { speaker: [0], level: [1] },
  'volume-high': { speaker: [0], level: [1, 2] },
  'volume-off': { speaker: [0], mark: [1, 2] },
  'volume-plus': { speaker: [0], mark: [1, 2] },
  'volume-minus': { speaker: [0], mark: [1] },
  'music-note': { head: [0], stem: [1, 2] },
  'music-notes': { head: [0, 1], stem: [2] },
  equalizer: { bars: [0, 1, 2, 3, 4] },
  'audio-waveform': { wave: [0, 1, 2, 3, 4, 5, 6] },
  disc: { disc: [0, 1], shine: [2] },
  vinyl: { record: [0], label: [1, 2], grooves: [3, 4] },
  podcast: { mic: [0, 1], wave: [2, 3] },
  live: { screen: [0], signal: [1, 2, 3] },
  image: { frame: [0], sun: [1], mountain: [2] },
  images: { photo: [0] },
  'image-off': { frame: [0], sun: [1], mountain: [2] },
  clapperboard: { body: [0], clapper: [1, 2, 3, 4] },
  'slow-motion': { ring: [0, 1, 2], play: [3] },
  aperture: { ring: [0], blades: [1, 2, 3, 4, 5] },
  'camera-focus': { corners: [0, 1, 2, 3], lens: [4] },
  'camera-flip': { body: [0, 1], arrow: [2, 3, 4, 5] },
  'picture-in-picture': { screen: [0], window: [1] },
  'video-player': { screen: [0], play: [1], track: [2], progress: [3] },
  'screen-mirror': { screen: [0] },
  'wireless-charging': { pad: [0], bolt: [1], wave: [2, 3] },
  joystick: { base: [0], stick: [1, 2] },
  turntable: { cabinet: [0], platter: [1, 2] },
  tripod: { head: [0], legs: [1, 2, 3] },
  drone: { body: [0], arms: [1, 2, 3, 4], rotors: [5, 6], legs: [7, 8] },
  'image-sparkle': { frame: [0], mountain: [1] },
};
for (const [name, p] of Object.entries(parts)) icons[name].parts = p;

// ── Variantes automáticas (DESIGN.md › Variantes) ──
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Con insignia: el motor no la lleva al relleno en círculo ni sobre el tachado; la pieza de enfrente
// se perdería o chocaría con la diagonal
variants(
  Object.keys(icons).filter((n) => icons[n].badge),
  { circle: false, square: false, slash: false },
);
// Ya tienen su versión -off dibujada a mano
variants(['camera', 'video-camera', 'wifi', 'wifi-medium', 'wifi-low', 'image'], { slash: false });
variants(['volume-low', 'volume-high', 'volume-off', 'volume-plus', 'volume-minus'], { slash: false });
// Líneas sueltas y flechas: tacharlas no dice nada
variants(['repeat', 'repeat-one', 'audio-waveform', 'equalizer', 'signal', 'signal-high', 'signal-medium', 'signal-low'], { slash: false });
// Ya vienen encerrados en un círculo: ni en círculo ni en cuadrado (un círculo en un cuadro no dice más)
variants(['play-circle', 'pause-circle', 'stop-circle', 'record', 'disc', 'vinyl', 'slow-motion', 'aperture'], { circle: false, square: false });
variants(['power', 'podcast'], { circle: false });
// Ya vienen en un cuadro
variants(['outlet', 'ethernet', 'camera-focus', 'album'], { square: false });

// ── Movimiento (DESIGN.md › Movimiento): parts = piezas que se mueven; origin = pivote; vector =
// desplazamiento ──
icons['smartphone-vibrate'].motion = { effect: 'wiggle', parts: ['body'], origin: [12, 12] };
icons.gamepad.motion = { effect: 'wiggle', origin: [12, 12] };
icons.joystick.motion = { effect: 'wiggle', parts: ['stick'], origin: [12, 15.5] };
icons.clapperboard.motion = { effect: 'wiggle', parts: ['clapper'], origin: [3.25, 9.5] };
icons.disc.motion = { effect: 'spin', parts: ['shine'], origin: [12, 12] };
icons.vinyl.motion = { effect: 'spin', parts: ['grooves'], origin: [12, 12] };
icons.aperture.motion = { effect: 'spin', parts: ['blades'], origin: [12, 12] };
icons['slow-motion'].motion = { effect: 'spin', parts: ['ring'], origin: [12, 12] };
icons['camera-flip'].motion = { effect: 'spin', parts: ['arrow'], origin: [12, 13.5] };
icons.repeat.motion = { effect: 'spin', origin: [12, 12] };
icons['repeat-one'].motion = { effect: 'spin', parts: ['arrow'], origin: [12, 12] };
icons['battery-charging'].motion = { effect: 'beat', parts: ['bolt'], origin: [10.5, 12] };
icons['flashlight-on'].motion = { effect: 'beat', parts: ['rays'], origin: [12, 4] };
icons['smart-speaker'].motion = { effect: 'beat', parts: ['wave'], origin: [12, 12] };
icons['speaker-box'].motion = { effect: 'beat', parts: ['woofer'], origin: [12, 14.75] };
icons.record.motion = { effect: 'beat', parts: ['dot'], origin: [12, 12] };
icons.cast.motion = { effect: 'beat', parts: ['signal'], origin: [2.5, 19.5] };
icons.live.motion = { effect: 'beat', parts: ['signal'], origin: [12, 12] };
icons.podcast.motion = { effect: 'beat', parts: ['wave'], origin: [12, 11] };
icons['wireless-charging'].motion = { effect: 'beat', parts: ['bolt', 'wave'], origin: [12, 8.5] };
icons.equalizer.motion = { effect: 'beat', origin: [12, 20] };
icons['audio-waveform'].motion = { effect: 'beat', origin: [12, 12] };
icons['camera-focus'].motion = { effect: 'beat', parts: ['lens'], origin: [12, 12] };
icons['image-sparkle'].motion = { effect: 'beat', parts: ['badge'], origin: [18.75, 5.5] };
icons['fast-forward'].motion = { effect: 'slide', vector: [2, 0] };
icons.rewind.motion = { effect: 'slide', vector: [-2, 0] };
icons['skip-forward'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['skip-back'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] };
icons.eject.motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons.shuffle.motion = { effect: 'slide', vector: [1.5, 0] };
icons.printer.motion = { effect: 'slide', parts: ['sheet'], vector: [0, 1] };
icons['power-plug'].motion = { effect: 'slide', vector: [0, -1.5] };
icons['video-player'].motion = { effect: 'slide', parts: ['progress'], vector: [3, 0] };
icons['music-note'].motion = { effect: 'float', vector: [0, -1.5] };
icons['music-notes'].motion = { effect: 'float', vector: [0, -1.5] };
icons.drone.motion = { effect: 'float', vector: [0, -1.5] };

export default { category: 'dispositivos', label: 'Dispositivos y multimedia', icons };
