// Data and development: charts, dashboards, code, git, infrastructure and AI. Everything is
// computed with engine/geometry.mjs on the rules in DESIGN.md (1.5 stroke, keylines, continuous
// corners and a square bottom-right corner on containers).
import { arc, badge, circ, dot, drop, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';
import { snapper } from '../../engine/variants.mjs';

// ---------------------------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------------------------

/** Number with at most two decimals (same as the engine). */
const n = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${n(p[0])} ${n(p[1])}`;

/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });

/** Capsule (semicircular ends), horizontal or vertical depending on the longer side. */
function pill(x, y, w, h) {
  if (w >= h) {
    const r = h / 2;
    return `M${pt([x + r, y])}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x + w - r, y + h])}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x + r, y])}Z`;
  }
  const r = w / 2;
  return `M${pt([x, y + r])}A${n(r)} ${n(r)} 0 0 1 ${pt([x + w, y + r])}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
}

/** Open line through points with rounded interior corners (one radius per vertex, or one for all). */
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
    d += `L${pt([V[0] + ux * t, V[1] + uy * t])}A${n(rr[i])} ${n(rr[i])} 0 0 ${cz > 0 ? 1 : 0} ${pt([V[0] + vx * t, V[1] + vy * t])}`;
  }
  return `${d}L${pt(pts[pts.length - 1])}`;
}

/** Path with transformed points (e.g. rotated): [['M', p], ['C', c1, c2, p], ['A', r, large, sweep, p], ['Z']]. */
function tp(cmds, T = (p) => p) {
  return cmds
    .map(([c, ...a]) => {
      if (c === 'Z') return 'Z';
      if (c === 'A') return `A${n(a[0])} ${n(a[0])} 0 ${a[1]} ${a[2]} ${pt(T(a[3]))}`;
      return c + a.map((p) => pt(T(p))).join(' ');
    })
    .join('');
}

/** Four-pointed sparkle with concave sides (the AI sparkle). */
function star4(cx, cy, R) {
  const [a, b] = [0.065, 0.389];
  const P = (x, y) => [cx + x * R, cy + y * R];
  return tp([
    ['M', P(0, -1)],
    ['C', P(a, -b), P(b, -a), P(1, 0)],
    ['C', P(b, a), P(a, b), P(0, 1)],
    ['C', P(-a, b), P(-b, a), P(-1, 0)],
    ['C', P(-b, -a), P(-a, -b), P(0, -1)],
    ['Z'],
  ]);
}

/** Upper intersection of two circles [cx, cy, r]. */
function meet(c1, c2) {
  const [x1, y1, r1] = c1;
  const [x2, y2, r2] = c2;
  const d = Math.hypot(x2 - x1, y2 - y1);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(r1 * r1 - a * a);
  const [mx, my] = [x1 + (a * (x2 - x1)) / d, y1 + (a * (y2 - y1)) / d];
  const P = [mx + (h * (y2 - y1)) / d, my - (h * (x2 - x1)) / d];
  const Q = [mx - (h * (y2 - y1)) / d, my + (h * (x2 - x1)) / d];
  return P[1] < Q[1] ? P : Q;
}
/** Clockwise arc on circle c from p0 to p1. */
function cwArc(c, p0, p1) {
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let span = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  while (span < 0) span += 2 * Math.PI;
  return `A${n(c[2])} ${n(c[2])} 0 ${span > Math.PI ? 1 : 0} 1 ${pt(p1)}`;
}
/** Cloud: three lobes (left, top, right) on a flat base at `base`. */
function cloud(L, T, R, base) {
  const a = [L[0], base];
  const b = meet(L, T);
  const c = meet(T, R);
  const e = [R[0], base];
  return `M${pt(a)}${cwArc(L, a, b)}${cwArc(T, b, c)}${cwArc(R, c, e)}Z`;
}

/** Ellipse rotated `deg` degrees around its center. */
function rell(cx, cy, rx, ry, deg) {
  const p0 = rot([cx - rx, cy], [cx, cy], deg);
  const p1 = rot([cx + rx, cy], [cx, cy], deg);
  return `M${pt(p0)}A${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${pt(p1)}A${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${pt(p0)}Z`;
}

/** Edge between two circular nodes of radius r1 and r2: it touches their borders without going in. */
function edge(p, q, r1, r2 = r1) {
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const L = Math.hypot(dx, dy);
  return line([p[0] + (dx / L) * r1, p[1] + (dy / L) * r1], [q[0] - (dx / L) * r2, q[1] - (dy / L) * r2]);
}

/** Ring for the fill: the outer circle and the inner one in the opposite direction (the center stays hollow). */
const ring = (cx, cy, R, r) => `${circ(cx, cy, R)}M${pt([cx - r, cy])}A${n(r)} ${n(r)} 0 1 1 ${pt([cx + r, cy])}A${n(r)} ${n(r)} 0 1 1 ${pt([cx - r, cy])}Z`;

// The core database, complete (the badges clear it through the engine).
const DB = {
  body: 'M3.6 6.1v11.8c0 1.66 3.76 3 8.4 3s8.4-1.34 8.4-3V6.1',
  lid: 'M3.6 6.1c0-1.66 3.76-3 8.4-3s8.4 1.34 8.4 3-3.76 3-8.4 3-8.4-1.34-8.4-3Z',
  band: 'M20.4 12c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3',
  // The lid's edge, which is knocked out in the fill (as in the core `database`)
  rim: 'M20.4 6.1c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3',
};
const DB_D = [DB.body, DB.lid, DB.band];

// The badges' center (the engine's), for the motions that turn a badge.
const BC = [17.25, 17.25];

// Keylines.
const K0 = 3.25;
const K1 = 20.75;
/** The set's square card (17.5, radius 4.25, signature). */
const CARD = box(K0, K0, 17.5, 17.5, 4.25);

// Bars: three columns 3.75 wide with 3.13 between edges.
const BW = 3.75;
const BX = [3.25, 10.125, 17];
const bar = (x, top, bottom = K1) => sq(x, top, BW, bottom - top, 1.15, { square: ['bl', 'br'] });

// Data lines: soft bends (radius 2.5); trends even softer (radius 3) and with a short arrowhead
// along the last segment, so they read as a flow and not as a zigzag.
const SOFT = 2.5;
const TREND = 3;
const UP = [[3, 17], [9.25, 10.75], [13, 14.5], [20.25, 7.25]];
const DOWN = UP.map(([x, y]) => [x, 24 - y]);
const FLAT = [[2.75, 13], [7.5, 8.25], [12, 12.75], [20.5, 12.75]];

// Git: nodes of r 2.35 (the ones from the core roadmap) and branches that leave and rejoin the
// trunk like a lane change, with tangent curves instead of elbows.
const GR = 2.35;

// The core magnifier (search), identical: a ring of r 6.85 at 10.6 and a handle from 15.6 to 20.5.
const SEARCH = [circ(10.6, 10.6, 6.85), line([15.6, 15.6], [20.5, 20.5])];

// A 90° vertex of a `roundpoly` with radius r sits (√2 − 1)·r inside: that's where the connectors
// touch.
const INSET = (r) => (Math.SQRT2 - 1) * r;

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------

const icons = {
  // Charts -------------------------------------------------------------------------------------
  'chart-bar': {
    tags: ['gráfica de barras', 'barras', 'estadísticas', 'bar chart'],
    d: [bar(BX[0], 11.75), bar(BX[1], 3.25), bar(BX[2], 7.75)],
  },
  'chart-bar-horizontal': {
    tags: ['barras horizontales', 'gráfica', 'ranking', 'horizontal bar chart'],
    d: [
      sq(K0, 3.25, 10.5, BW, 1.15, { square: ['tl', 'bl'] }),
      sq(K0, 10.125, 17.5, BW, 1.15, { square: ['tl', 'bl'] }),
      sq(K0, 17, 13.25, BW, 1.15, { square: ['tl', 'bl'] }),
    ],
  },
  'chart-bar-stacked': {
    tags: ['barras apiladas', 'gráfica', 'composición', 'stacked bar chart'],
    d: [
      bar(BX[0], 9.25),
      bar(BX[1], 3.25),
      bar(BX[2], 12),
      line([BX[0], 14.5], [BX[0] + BW, 14.5]),
      line([BX[1], 10.75], [BX[1] + BW, 10.75]),
      line([BX[2], 16.5], [BX[2] + BW, 16.5]),
    ],
  },
  'chart-histogram': {
    tags: ['histograma', 'distribución', 'frecuencia', 'histogram'],
    d: [
      roundpoly(
        [
          [3.25, 20.75], [3.25, 15], [6.75, 15], [6.75, 9.5], [10.25, 9.5], [10.25, 4.25],
          [13.75, 4.25], [13.75, 8], [17.25, 8], [17.25, 13.5], [20.75, 13.5], [20.75, 20.75],
        ],
        [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0],
      ),
      line([6.75, 15], [6.75, 20.75]),
      line([10.25, 9.5], [10.25, 20.75]),
      line([13.75, 8], [13.75, 20.75]),
      line([17.25, 13.5], [17.25, 20.75]),
    ],
  },
  'chart-line': {
    tags: ['gráfica de líneas', 'serie', 'evolución', 'line chart'],
    d: [rline([[3.25, 15.25], [8.5, 9.25], [12.75, 13.25], [20.75, 4.75]], SOFT), line([K0, K1], [K1, K1])],
  },
  'chart-lines': {
    tags: ['varias series', 'comparar', 'líneas', 'multi line chart'],
    d: [
      rline([[3.25, 10.75], [8.5, 5.75], [13, 8.75], [20.75, 3.5]], SOFT),
      rline([[3.25, 16.75], [8.75, 12.75], [13.5, 15], [20.75, 9.75]], SOFT),
      line([K0, K1], [K1, K1]),
    ],
  },
  'chart-step': {
    tags: ['gráfica escalonada', 'escalones', 'cambios por etapa', 'step chart'],
    d: [rline([[K0, 16.25], [8.5, 16.25], [8.5, 10.75], [14, 10.75], [14, 5.25], [K1, 5.25]], 1.5), line([K0, K1], [K1, K1])],
  },
  'chart-area': {
    tags: ['gráfica de área', 'volumen', 'acumulado', 'area chart'],
    d: [
      roundpoly([[3.25, 20.75], [3.25, 14.5], [8.5, 8.75], [12.75, 12.5], [20.75, 4.5], [20.75, 20.75]], [0, 1, 1.5, 1.5, 1, 0]),
    ],
  },
  'chart-pie': {
    tags: ['gráfica de pastel', 'proporción', 'porcentaje', 'pie chart'],
    d: ['M13.5 13.5V6.25A7.25 7.25 0 1 1 6.25 13.5Z', 'M10.5 10.5H3.25A7.25 7.25 0 0 1 10.5 3.25Z'],
  },
  'chart-donut': {
    tags: ['dona', 'anillo', 'proporción', 'donut chart'],
    d: [
      circ(12, 12, 9),
      circ(12, 12, 4.5),
      ...[-90, 30, 140].map((a) => line(polar(12, 12, 4.5, a), polar(12, 12, 9, a))),
    ],
  },
  'chart-scatter': {
    tags: ['dispersión', 'puntos', 'correlación', 'scatter chart'],
    d: [
      rline([[K0, K0], [K0, K1], [K1, K1]], 0),
      dot(7.25, 16.25),
      dot(10.25, 12.25),
      dot(13, 15.5),
      dot(14.75, 9),
      dot(17.75, 12),
      dot(18.25, 5.75),
    ],
  },
  'chart-bubble': {
    tags: ['burbujas', 'magnitud', 'dispersión', 'bubble chart'],
    d: [circ(8.25, 15.25, 5), circ(16.5, 7.25, 3.5), circ(18, 17.5, 2), dot(6.5, 6.5)],
  },
  'chart-funnel': {
    tags: ['embudo', 'conversión', 'etapas', 'funnel chart'],
    d: [sq(K0, 3.25, 17.5, BW, 1.15), sq(6, 10.125, 12, BW, 1.15), sq(8.75, 17, 6.5, BW, 1.15)],
  },
  'chart-radar': {
    tags: ['radar', 'araña', 'atributos', 'radar chart'],
    d: (() => {
      // The web and the data, without spokes: the spokes crossed the polygon and turned into a star
      // at 18 px. Each data vertex sits 3 or more from the web (radius ≤ 9.3 − 3.71).
      const c = [12, 12.4];
      const A = [-90, -18, 54, 126, 198];
      const outer = A.map((a) => polar(c[0], c[1], 9.3, a));
      const rr = [5.6, 3.6, 5, 2.9, 5.3];
      const inner = A.map((a, i) => polar(c[0], c[1], rr[i], a));
      return [roundpoly(outer, 1.4), roundpoly(inner, 0.6)];
    })(),
  },
  'chart-waterfall': {
    tags: ['cascada', 'variación', 'puente', 'waterfall chart'],
    // The start, the floating change and the total: the middle bar starts at the height of the
    // first and reaches the height of the last, with no connectors (they grazed the corners of the
    // bars).
    d: [bar(BX[0], 11.5), sq(BX[1], 4.25, BW, 7.25, 1.15), bar(BX[2], 4.25)],
  },
  'chart-gantt': {
    tags: ['gantt', 'cronograma', 'planeación', 'gantt chart'],
    d: [pill(K0, 4.125, 8.5, 3.25), pill(8.25, 10.375, 9.25, 3.25), pill(13.75, 16.625, 7, 3.25)],
  },
  'chart-treemap': {
    tags: ['mapa de árbol', 'jerarquía', 'proporción', 'treemap'],
    d: [CARD, line([11.25, K0], [11.25, K1]), line([11.25, 10.75], [K1, 10.75]), line([K0, 14.5], [11.25, 14.5]), line([16, 10.75], [16, K1])],
  },
  'chart-combo': {
    tags: ['combinada', 'barras y línea', 'mixta', 'combo chart'],
    d: [bar(BX[0], 14.5), bar(BX[1], 12.25), bar(BX[2], 15.5), rline([[3.25, 10.25], [8.75, 6], [13.75, 8.5], [20.75, 3.5]], SOFT)],
  },
  'chart-radial': {
    tags: ['barras radiales', 'progreso', 'anillos', 'radial chart'],
    d: [arc(12, 12, 9, -90, 180).d, arc(12, 12, 5.5, -90, 90).d, dot(12, 12)],
  },
  'chart-distribution': {
    tags: ['distribución', 'curva normal', 'campana', 'distribution'],
    // No mean line: with it, the bell read as a tent.
    d: ['M2.75 17.25C7.5 17.25 8.25 4.5 12 4.5S16.5 17.25 21.25 17.25', line([K0, K1], [K1, K1])],
  },
  'trend-up': {
    tags: ['tendencia', 'sube', 'crecimiento', 'al alza', 'trending up', 'growth'],
    d: [rline(UP, TREND), head(UP[3], [1, -1], 4.5)],
  },
  'trend-down': {
    tags: ['tendencia', 'baja', 'caída', 'a la baja', 'trending down', 'decline'],
    d: [rline(DOWN, TREND), head(DOWN[3], [1, 1], 4.5)],
  },
  'trend-flat': {
    tags: ['tendencia', 'estable', 'sin cambio', 'trending flat', 'steady'],
    d: [rline(FLAT, TREND), head(FLAT[3], [1, 0], 4.5)],
  },
  'dashboard': {
    tags: ['tablero', 'panel', 'resumen', 'dashboard'],
    // Panels 3 apart (2.5 before: they stuck together at 16 px); the last one has the signature.
    d: [
      sq(K0, K0, 7.25, 17.5, 2.25),
      sq(13.5, K0, 7.25, 7.25, 2.25),
      sq(13.5, 13.5, 7.25, 7.25, 2.25, { square: ['br'] }),
    ],
  },
  'gauge': {
    tags: ['medidor', 'velocidad', 'rendimiento', 'gauge'],
    d: (() => {
      // Center at 14: the arc (from 5 to 18.5) is centered on the canvas. The needle ends 3 from
      // the arc (2.75 before: it grazed it).
      const c = [12, 14];
      return [arc(c[0], c[1], 9, 150, 390).d, circ(c[0], c[1], 1.75), line(polar(c[0], c[1], 1.75, -45), polar(c[0], c[1], 6, -45))];
    })(),
  },
  'analytics': {
    tags: ['análisis', 'analítica', 'explorar datos', 'insights', 'analytics'],
    // The core magnifier (search) with three bars 3 apart, all 3 or more from the ring.
    d: [...SEARCH, line([7.6, 10.6], [7.6, 12.85]), line([10.6, 7.35], [10.6, 12.85]), line([13.6, 9.1], [13.6, 12.85])],
  },

  // Tables and dashboards ----------------------------------------------------------------------
  'table': {
    tags: ['tabla', 'registros', 'filas', 'table'],
    d: [CARD, line([K0, 8.75], [K1, 8.75]), line([10.75, 8.75], [10.75, K1])],
  },
  'kanban': {
    tags: ['kanban', 'tablero', 'columnas', 'board'],
    d: [sq(BX[0], K0, BW, 17.5, 1.15), sq(BX[1], K0, BW, 10.5, 1.15), sq(BX[2], K0, BW, 14, 1.15)],
  },
  'schema': {
    tags: ['esquema', 'modelo de datos', 'relación', 'schema'],
    d: [
      box(K0, K0, 8.5, 7.5, 2.25),
      box(12.25, 13.25, 8.5, 7.5, 2.25),
      rline([[11.75, 8.5], [16.5, 8.5], [16.5, 13.25]], 2),
      line([K0, 6.5], [11.75, 6.5]),
      line([12.25, 16.5], [K1, 16.5]),
    ],
  },

  // Code ---------------------------------------------------------------------------------------
  'braces': {
    tags: ['llaves', 'objeto', 'json', 'curly braces'],
    d: [
      'M8.75 3.25h-.5A2.25 2.25 0 0 0 6 5.5v3.75A2.75 2.75 0 0 1 3.25 12 2.75 2.75 0 0 1 6 14.75v3.75a2.25 2.25 0 0 0 2.25 2.25h.5',
      'M15.25 3.25h.5A2.25 2.25 0 0 1 18 5.5v3.75A2.75 2.75 0 0 0 20.75 12 2.75 2.75 0 0 0 18 14.75v3.75a2.25 2.25 0 0 1-2.25 2.25h-.5',
    ],
  },
  'brackets': {
    tags: ['corchetes', 'lista', 'código', 'brackets'],
    d: [rline([[9.25, 3.25], [5.25, 3.25], [5.25, K1], [9.25, K1]], 2), rline([[14.75, 3.25], [18.75, 3.25], [18.75, K1], [14.75, K1]], 2)],
  },
  'array': {
    tags: ['arreglo', 'lista', 'colección', 'array'],
    d: [
      rline([[6.75, 4.75], [3.5, 4.75], [3.5, 19.25], [6.75, 19.25]], 1.75),
      rline([[17.25, 4.75], [20.5, 4.75], [20.5, 19.25], [17.25, 19.25]], 1.75),
      dot(8.5, 12),
      dot(12, 12),
      dot(15.5, 12),
    ],
  },
  'terminal': {
    tags: ['terminal', 'consola', 'línea de comandos', 'terminal'],
    d: [box(2.5, 5, 19, 14, 4), rline([[6.75, 9.25], [9.5, 12], [6.75, 14.75]], 0), line([12, 14.75], [17, 14.75])],
  },
  'function': {
    tags: ['función', 'fórmula', 'cálculo', 'function'],
    d: [
      'M17.5 4.75C16.9 3.9 15.9 3.4 14.75 3.6 13.4 3.85 12.6 4.9 12.4 6.3L10.6 17.7C10.4 19.1 9.6 20.15 8.25 20.4 7.1 20.6 6.1 20.1 5.5 19.25',
      line([8.25, 9.25], [16, 9.25]),
    ],
  },
  'variable': {
    tags: ['variable', 'valor', 'parámetro', 'variable'],
    d: [
      'M7.25 4.75h-.25a1.75 1.75 0 0 0-1.75 1.75v2.75A2.75 2.75 0 0 1 2.5 12a2.75 2.75 0 0 1 2.75 2.75v2.75a1.75 1.75 0 0 0 1.75 1.75h.25',
      'M16.75 4.75h.25a1.75 1.75 0 0 1 1.75 1.75v2.75A2.75 2.75 0 0 0 21.5 12a2.75 2.75 0 0 0-2.75 2.75v2.75a1.75 1.75 0 0 1-1.75 1.75h-.25',
      line([9.75, 9.75], [14.25, 14.25]),
      line([14.25, 9.75], [9.75, 14.25]),
    ],
  },
  'sum': {
    tags: ['suma', 'sigma', 'total', 'sum'],
    d: [rline([[17.75, 6.5], [17.75, 4.25], [6.25, 4.25], [12.5, 12], [6.25, 19.75], [17.75, 19.75], [17.75, 17.5]], [0, 1, 0.6, 0.6, 0.6, 1, 0])],
  },
  'code-window': {
    tags: ['ventana de código', 'editor', 'desarrollo', 'code editor'],
    // The chevrons 3 from the bar and 3.25 from the bottom edge (2.75 from the bar before: they
    // grazed it).
    d: [
      box(2.5, 4, 19, 16, 4),
      line([2.5, 8.75], [21.5, 8.75]),
      rline([[9.5, 11.75], [7.25, 14.25], [9.5, 16.75]], 0),
      rline([[14.5, 11.75], [16.75, 14.25], [14.5, 16.75]], 0),
    ],
  },

  // Git ----------------------------------------------------------------------------------------
  'git-branch': {
    tags: ['rama', 'git', 'bifurcación', 'nueva rama', 'branch'],
    // Time runs upward: the branch leaves the trunk like a lane change and ends at the top, at its
    // node.
    d: [circ(6.25, 18.4, GR), line([6.25, K0], [6.25, 16.05]), 'M6.25 15.25C6.25 11.25 17.75 12.75 17.75 8.75V7.95', circ(17.75, 5.6, GR)],
  },
  'git-commit': {
    tags: ['commit', 'git', 'confirmación', 'versión', 'commit'],
    d: [circ(12, 12, 3.75), line([2.5, 12], [8.25, 12]), line([15.75, 12], [21.5, 12])],
  },
  'git-merge': {
    tags: ['fusionar', 'merge', 'git', 'unir ramas', 'merge branch'],
    // The mirror of git-branch: the branch starts at the bottom and merges into the trunk like a
    // lane change.
    d: [circ(6.25, 18.4, GR), line([6.25, 7.95], [6.25, 16.05]), circ(6.25, 5.6, GR), circ(17.75, 18.4, GR), 'M17.75 16.05V15C17.75 11.25 6.25 12.75 6.25 8.75'],
  },
  'git-pull-request': {
    tags: ['pull request', 'revisión', 'git', 'solicitud de cambios'],
    d: [
      circ(6.25, 5.6, GR),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(6.25, 18.4, GR),
      circ(17.75, 18.4, GR),
      rline([[17.75, 16.05], [17.75, 5.6], [11.75, 5.6]], 3.5),
      head([11.75, 5.6], [-1, 0], 3.4),
    ],
  },
  'git-pull-request-closed': {
    tags: ['pull request cerrado', 'rechazado', 'git', 'closed'],
    d: [
      circ(6.25, 5.6, GR),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(6.25, 18.4, GR),
      circ(17.75, 18.4, GR),
      line([17.75, 16.05], [17.75, 11.25]),
      line([15.75, 3.6], [19.75, 7.6]),
      line([19.75, 3.6], [15.75, 7.6]),
    ],
  },
  'git-pull-request-draft': {
    tags: ['borrador', 'pull request', 'git', 'draft'],
    d: [
      circ(6.25, 5.6, GR),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(6.25, 18.4, GR),
      circ(17.75, 18.4, GR),
      dot(17.75, 12.75),
      dot(17.75, 9),
      dot(17.75, 5.25),
    ],
  },
  'git-fork': {
    tags: ['fork', 'bifurcar', 'copia del repositorio', 'git', 'repository fork'],
    // A Y of tangent curves: the two copies leave the same trunk with no elbows.
    d: [
      circ(12, 18.4, GR),
      'M6.25 7.95C6.25 11.5 12 10.5 12 14.25V16.05',
      'M17.75 7.95C17.75 11.5 12 10.5 12 14.25',
      circ(6.25, 5.6, GR),
      circ(17.75, 5.6, GR),
    ],
  },
  'git-compare': {
    tags: ['comparar', 'diferencias', 'git', 'compare'],
    d: [
      circ(5.6, 5.6, 2.35),
      rline([[7.95, 5.6], [18.4, 5.6], [18.4, 12.5]], 3.5),
      head([18.4, 12.5], [0, 1], 3.4),
      circ(18.4, 18.4, 2.35),
      rline([[16.05, 18.4], [5.6, 18.4], [5.6, 11.5]], 3.5),
      head([5.6, 11.5], [0, -1], 3.4),
    ],
  },

  // Testing ------------------------------------------------------------------------------------
  'bug': {
    tags: ['error', 'bicho', 'falla', 'depurar', 'bug', 'debug'],
    // The body has rounded shoulders (they used to be sharp corners, foreign to the set). The
    // bottom legs start on the body's arc (they used to sit 0.4 away: they grazed it).
    d: (() => {
      const foot = (a) => polar(12, 14, 5.25, a);
      return [
        'M6.75 14V11A2.5 2.5 0 0 1 9.25 8.5H14.75A2.5 2.5 0 0 1 17.25 11V14A5.25 5.25 0 0 1 6.75 14Z',
        'M9.25 8.5A2.75 2.75 0 0 1 14.75 8.5',
        line([12, 8.5], [12, 19.25]),
        line([6.75, 12.75], [3.5, 12.75]),
        line(foot(141.5), [4.5, 19.75]),
        line([17.25, 12.75], [20.5, 12.75]),
        line(foot(38.5), [19.5, 19.75]),
      ];
    })(),
  },
  'flask': {
    tags: ['matraz', 'prueba', 'experimento', 'laboratorio', 'test', 'testing'],
    d: [
      rline([[9.75, K0], [9.75, 9.25], [3.75, K1], [20.25, K1], [14.25, 9.25], [14.25, K0]], [0, 1.5, 1.75, 1.75, 1.5, 0]),
      line([8.25, K0], [15.75, K0]),
      line([6.88, 14.75], [17.12, 14.75]),
    ],
  },
  'test-tube': {
    tags: ['tubo de ensayo', 'laboratorio', 'prueba', 'test tube'],
    d: (() => {
      const T = (p) => rot(p, [12, 12], 35);
      return [
        tp([['M', [9.5, 3.5]], ['L', [9.5, 16.5]], ['A', 2.5, 0, 0, [14.5, 16.5]], ['L', [14.5, 3.5]]], T),
        tp([['M', [7.75, 3.5]], ['L', [16.25, 3.5]]], T),
        tp([['M', [9.5, 11.75]], ['L', [14.5, 11.75]]], T),
      ];
    })(),
  },

  // Connections and infrastructure ---------------------------------------------------------------
  'api': {
    tags: ['api', 'conexión', 'integración', 'conector', 'endpoint', 'plug'],
    d: (() => {
      const T = (p) => rot([12 + p[0], 12 + p[1]], [12, 12], -45);
      return [
        tp([['M', [-12.25, 0]], ['L', [-8.25, 0]]], T),
        tp([['M', [-3.25, -3.75]], ['L', [-4.5, -3.75]], ['A', 3.75, 0, 0, [-4.5, 3.75]], ['L', [-3.25, 3.75]], ['Z']], T),
        tp([['M', [3.25, -3.75]], ['L', [4.5, -3.75]], ['A', 3.75, 0, 1, [4.5, 3.75]], ['L', [3.25, 3.75]], ['Z']], T),
        tp([['M', [8.25, 0]], ['L', [12.25, 0]]], T),
        tp([['M', [3.25, -1.75]], ['L', [0.25, -1.75]], ['M', [3.25, 1.75]], ['L', [0.25, 1.75]]], T),
      ];
    })(),
  },
  'webhook': {
    tags: ['webhook', 'evento', 'notificación', 'callback'],
    // A hook that calls back: the git node (r 2.35) and a U of r 5.25 that fills the live area (it
    // used to weigh less than its neighbors).
    d: [circ(17, 5.6, GR), 'M17 7.95V14.5A5.25 5.25 0 0 1 6.5 14.5V11', head([6.5, 11], [0, -1], 3.4)],
  },
  'cpu': {
    tags: ['procesador', 'chip', 'cómputo', 'cpu'],
    d: [
      sq(6, 6, 12, 12, 3.25),
      sq(9.5, 9.5, 5, 5, 1.5),
      [9.5, 14.5].map((x) => line([x, K0], [x, 6])).join(''),
      [9.5, 14.5].map((x) => line([x, 18], [x, K1])).join(''),
      [9.5, 14.5].map((y) => line([K0, y], [6, y])).join(''),
      [9.5, 14.5].map((y) => line([18, y], [K1, y])).join(''),
    ],
  },
  'ai-chip': {
    tags: ['chip de ia', 'modelo', 'inteligencia artificial', 'ai chip'],
    d: [
      sq(6, 6, 12, 12, 3.25),
      star4(12, 12, 3.5),
      [9.5, 14.5].map((x) => line([x, K0], [x, 6])).join(''),
      [9.5, 14.5].map((x) => line([x, 18], [x, K1])).join(''),
      [9.5, 14.5].map((y) => line([K0, y], [6, y])).join(''),
      [9.5, 14.5].map((y) => line([18, y], [K1, y])).join(''),
    ],
  },
  'server': {
    tags: ['servidor', 'hosting', 'infraestructura', 'server'],
    // Two units like the ones in `archivos` (`external-drive`, `file-server`): the slot on the left
    // and the light on the right. 16 × 6.5 and 3 apart: at 17.5 × 7.25 it went over 28 % ink.
    d: [
      box(4, 4, 16, 6.5, 2),
      box(4, 13.5, 16, 6.5, 2),
      line([7.5, 7.25], [11, 7.25]),
      dot(16, 7.25),
      line([7.5, 16.75], [11, 16.75]),
      dot(16, 16.75),
    ],
  },
  'cloud-compute': {
    tags: ['nube', 'cómputo en la nube', 'servidor remoto', 'cloud computing'],
    // The file cloud (same three lobes and base at 18.25) with the terminal prompt, 3 or more from
    // the outline (the chevron's tip used to sit 2.4 from the left lobe).
    d: [
      cloud([7.25, 14.25, 4], [12.5, 10.75, 5.5], [17.25, 14.5, 3.75], 18.25),
      rline([[9.75, 11.25], [11.75, 13.25], [9.75, 15.25]], 0),
      line([14, 15.25], [16.25, 15.25]),
    ],
  },
  'container': {
    tags: ['contenedor', 'docker', 'imagen', 'despliegue', 'container'],
    // A shipping container with its ribs. It used to be three stacked boxes that touched (1.5
    // between strokes) and merged at 18 px.
    d: [box(2.5, 5, 19, 14, 4), ...[7.25, 12, 16.75].map((x) => line([x, 8.75], [x, 15.25]))],
  },
  'rocket': {
    tags: ['cohete', 'lanzamiento', 'despliegue', 'deploy'],
    // The window is a dot: a ring (r 1.6) sat 1.64 from the walls, center to center, and merged
    // with them at bold; there is no room in the body for a ring that keeps its hole and its air.
    d: (() => {
      const k = 1.08;
      const T = (p) => rot([12 + (p[0] - 12) * k, 12 + (p[1] - 12) * k], [12, 12], 45);
      return [
        tp([['M', [9, 15.25]], ['L', [9, 9.5]], ['C', [9, 6.5], [10.25, 4.25], [12, 2.75]], ['C', [13.75, 4.25], [15, 6.5], [15, 9.5]], ['L', [15, 15.25]], ['Z']], T),
        tp([['M', [9, 11.75]], ['L', [6.5, 14.25]], ['L', [6.5, 17.5]], ['L', [9, 15.25]]], T),
        tp([['M', [15, 11.75]], ['L', [17.5, 14.25]], ['L', [17.5, 17.5]], ['L', [15, 15.25]]], T),
        dot(...T([12, 9.25])),
        tp([['M', [12, 18.25]], ['L', [12, 20.5]]], T),
      ];
    })(),
  },
  'pulse': {
    tags: ['pulso', 'monitoreo', 'actividad', 'disponibilidad', 'activity', 'monitoring', 'heartbeat'],
    d: [rline([[2.5, 12.5], [6.5, 12.5], [9, 6.25], [14, 18], [16.5, 12.5], [21.5, 12.5]], [0, 0.6, 0.6, 0.6, 0.6, 0])],
  },
  'log': {
    tags: ['registro', 'bitácora', 'eventos', 'log', 'logs', 'audit trail'],
    // Lines 3.75 from their dot (at 3 they grazed: the edge of the dot sat 2.3 from the line).
    d: [CARD, ...[8.5, 12, 15.5].flatMap((y) => [dot(7.75, y), line([11.5, y], [16.25, y])])],
  },

  // Structures and flows -------------------------------------------------------------------------
  'network': {
    tags: ['red', 'nodos', 'conexiones', 'network'],
    d: (() => {
      const c = [12, 13.5];
      const A = [-90, 30, 150];
      return [
        circ(c[0], c[1], 2.5),
        ...A.map((a) => line(polar(c[0], c[1], 2.5, a), polar(c[0], c[1], 5.75, a))),
        ...A.map((a) => circ(...polar(c[0], c[1], 8, a), 2.25)),
      ];
    })(),
  },
  'node-graph': {
    tags: ['grafo', 'nodos', 'relaciones', 'grafo de conocimiento', 'graph', 'knowledge graph'],
    // A real graph: nodes of different weights and irregular edges. The old one was a symmetric bow
    // tie that read as an X between two bars at 18 px.
    d: (() => {
      const N = [[5.75, 6.25, 2.25], [18, 5.5, 1.75], [16, 15.25, 2.75], [6, 18.25, 1.75]];
      const E = [[0, 1], [0, 2], [1, 2], [2, 3], [0, 3]];
      return [...N.map(([x, y, r]) => circ(x, y, r)), ...E.map(([a, b]) => edge(N[a], N[b], N[a][2], N[b][2]))];
    })(),
  },
  'hierarchy': {
    tags: ['jerarquía', 'árbol', 'niveles', 'hierarchy'],
    d: [
      circ(12, 5.6, 2.35),
      line([12, 7.95], [12, 12]),
      rline([[5.6, 16.05], [5.6, 12], [18.4, 12], [18.4, 16.05]], 2.5),
      circ(5.6, 18.4, 2.35),
      circ(18.4, 18.4, 2.35),
    ],
  },
  'sitemap': {
    tags: ['mapa del sitio', 'estructura', 'páginas', 'sitemap'],
    // Three child pages across the landscape width (19), exactly 3 apart: they used to sit 2.75
    // apart and stuck together at 18 px.
    d: (() => {
      const w = (19 - 6) / 3;
      const xs = [2.5, 2.5 + w + 3, 2.5 + 2 * (w + 3)];
      return [
        box(8.25, K0, 7.5, 5.5, 1.7),
        line([12, 8.75], [12, 15.5]),
        rline([[xs[0] + w / 2, 15.5], [xs[0] + w / 2, 12], [xs[2] + w / 2, 12], [xs[2] + w / 2, 15.5]], 1.5),
        ...xs.map((x) => box(x, 15.5, w, 5.25, 1.35)),
      ];
    })(),
  },
  'flowchart': {
    tags: ['diagrama de flujo', 'proceso', 'algoritmo', 'decisión', 'flowchart', 'algorithm'],
    // The connector reaches the diamond's rounded vertex (it used to end 0.4 short of it).
    d: [
      box(K0, K0, 8, 6, 1.85),
      rline([[7.25, 9.25], [7.25, 15.75], [11.75 + INSET(1), 15.75]], 2.5),
      roundpoly([[16.25, 11.25], [20.75, 15.75], [16.25, 20.25], [11.75, 15.75]], 1),
    ],
  },
  'workflow': {
    tags: ['flujo de trabajo', 'automatización', 'pasos', 'workflow'],
    // Two diagonal steps of 6: that way the connector's last segment is long enough for its
    // arrowhead, and the arrowhead sits 3 from the second box (2.25 before: it almost touched it).
    d: [sq(K0, K0, 6, 6, 1.85), rline([[9.25, 6.25], [17.75, 6.25], [17.75, 11.75]], 2), head([17.75, 11.75], [0, 1], 3), box(14.75, 14.75, 6, 6, 1.85)],
  },
  'automation': {
    tags: ['automatización', 'disparador', 'ciclo', 'automation'],
    d: (() => {
      const a = arc(12, 12, 9, -60, 240);
      return [a.d, head(a.end, a.tangent, 3.4), roundpoly([[13.25, 6.25], [8.25, 13], [12, 13], [10.75, 17.75], [15.75, 11], [12, 11]], 0.5)];
    })(),
  },

  // Artificial intelligence ----------------------------------------------------------------------
  'sparkle': {
    tags: ['chispa', 'ia', 'mágico', 'sparkle'],
    d: [star4(12, 12, 9.25)],
  },
  'sparkles': {
    tags: ['chispas', 'ia', 'generar', 'sparkles'],
    d: [star4(10, 13.5, 7.5), star4(18.25, 5.5, 3.25)],
  },
  'search-sparkle': {
    tags: ['búsqueda con ia', 'búsqueda inteligente', 'semántica', 'ai search'],
    d: [...SEARCH, star4(10.6, 10.6, 3.75)],
  },
  'robot': {
    tags: ['robot', 'bot', 'ia', 'automatización', 'ai bot'],
    d: [box(4.75, 8, 14.5, 12.25, 3.75), line([12, 8], [12, 5.5]), circ(12, 4.25, 1.25), line([9.25, 12.75], [9.25, 14.75]), line([14.75, 12.75], [14.75, 14.75])],
  },
  'chatbot': {
    tags: ['chatbot', 'asistente', 'bot', 'conversación con ia'],
    d: [drop(12, 11.75, 8.75), line([9, 10.25], [9, 12.75]), line([15, 10.25], [15, 12.75])],
  },
  'brain': {
    tags: ['cerebro', 'inteligencia', 'conocimiento', 'brain'],
    d: (() => {
      const half = [
        ['M', [12, 5.5]],
        ['C', [11.3, 4.3], [9.9, 3.6], [8.5, 3.9]],
        ['C', [6.6, 4.3], [5.4, 6], [5.6, 7.9]],
        ['C', [3.9, 8.7], [3, 10.5], [3.4, 12.4]],
        ['C', [3.7, 14], [4.6, 15.1], [5.9, 15.6]],
        ['C', [5.8, 17.8], [7.5, 19.7], [9.7, 19.8]],
        ['C', [10.7, 19.9], [11.5, 19.4], [12, 18.6]],
      ];
      const folds = [
        [['M', [5.6, 7.9]], ['C', [6.6, 8.1], [7.4, 8.8], [7.75, 9.75]]],
        [['M', [5.9, 15.6]], ['C', [7.25, 15.6], [8.5, 14.75], [9, 13.5]]],
      ];
      const M = (p) => [24 - p[0], p[1]];
      return [tp(half), tp(half, M), line([12, 5.5], [12, 18.6]), ...folds.map((f) => tp(f)), ...folds.map((f) => tp(f, M))];
    })(),
  },
  'atom': {
    tags: ['átomo', 'ciencia', 'partículas', 'atom'],
    // Orbits of 8.75 (the vertical one runs exactly from 3.25 to 20.75 of the set's square) and 3.5
    // tall, which leave clearance around the nucleus: at 9.25 it went over 28 % ink.
    d: [dot(12, 12), ...[30, 90, 150].map((a) => rell(12, 12, 8.75, 3.5, a))],
  },
  'neural-network': {
    tags: ['red neuronal', 'aprendizaje automático', 'modelo', 'neural network'],
    d: (() => {
      const r = 1.75;
      const N = { a: [4.25, 7.25], b: [4.25, 16.75], c: [12, 7.25], d: [12, 16.75], e: [19.75, 12] };
      return [
        ...Object.values(N).map((p) => circ(p[0], p[1], r)),
        ...[['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'e'], ['d', 'e']].map(([x, y]) => edge(N[x], N[y], r)),
      ];
    })(),
  },
  'prompt': {
    tags: ['prompt', 'instrucción', 'pedir a la ia', 'ai prompt'],
    // The sparkle opens the field and the text follows it: the old symmetrical "− ✦" looked like a
    // game controller.
    d: [box(2.5, 6, 19, 12, 4), star4(7.5, 12, 2.75), line([13.25, 12], [17.75, 12])],
  },

  // Components and 3D --------------------------------------------------------------------------
  'component': {
    tags: ['componente', 'bloque', 'módulo', 'component'],
    d: [box(K0, 8.5, 17.5, 10.75, 3.25), rline([[6.25, 8.5], [6.25, 5.25], [10.25, 5.25], [10.25, 8.5]], 1.25), rline([[13.75, 8.5], [13.75, 5.25], [17.75, 5.25], [17.75, 8.5]], 1.25)],
  },
  'puzzle': {
    tags: ['rompecabezas', 'extensión', 'plugin', 'puzzle'],
    d: ['M3.25 8.75A2 2 0 0 1 5.25 6.75H8.57A2.25 2.25 0 1 1 11.93 6.75H15.25A2 2 0 0 1 17.25 8.75V12.07A2.25 2.25 0 1 1 17.25 15.43V20.75H5.25A2 2 0 0 1 3.25 18.75Z'],
  },
  'cube': {
    tags: ['cubo', '3d', 'modelo 3d', 'cube', '3d model'],
    d: [
      roundpoly([[3.25, 8.5], [8.5, 3.25], [20.75, 3.25], [20.75, 15.5], [15.5, 20.75], [3.25, 20.75]], 1.25),
      rline([[3.25, 8.5], [15.5, 8.5], [20.75, 3.25]], 0),
      line([15.5, 8.5], [15.5, 20.75]),
    ],
  },
  'axis-3d': {
    tags: ['ejes', '3d', 'coordenadas', 'axis', 'coordinates'],
    d: [
      line([9.5, 14.5], [9.5, K0]),
      head([9.5, K0], [0, -1], 3),
      line([9.5, 14.5], [K1, 14.5]),
      head([K1, 14.5], [1, 0], 3),
      line([9.5, 14.5], [3.75, 20.25]),
      head([3.75, 20.25], [-1, 1], 3),
    ],
  },

  // Databases ----------------------------------------------------------------------------------
  // The full core database with the badge on top: the engine clears it with 1.5 of clearance.
  'database-plus': {
    tags: ['nueva base de datos', 'agregar datos', 'crear tabla', 'add database'],
    d: DB_D,
    badge: badge('plus'),
  },
  'database-check': {
    tags: ['datos validados', 'base de datos lista', 'verificado', 'database check'],
    d: DB_D,
    badge: badge('check'),
  },
  'database-search': {
    tags: ['consulta', 'query', 'buscar datos', 'database search'],
    d: DB_D,
    badge: badge('search'),
  },
  'database-sync': {
    tags: ['sincronizar datos', 'réplica', 'actualizar', 'database sync'],
    d: DB_D,
    badge: badge('sync'),
  },

  // Filters and experiments ----------------------------------------------------------------------
  'data-filter': {
    tags: ['filtrar datos', 'filtro', 'segmentar', 'data filter', 'filter data'],
    d: [roundpoly([[K0, 7.25], [K1, 7.25], [13.75, 14.25], [13.75, K1], [10.25, K1], [10.25, 14.25]], [1.25, 1.25, 1, 0.6, 0.6, 1]), dot(7, 3.75), dot(12, 3.75), dot(17, 3.75)],
  },
  'ab-test': {
    tags: ['prueba a/b', 'experimento', 'variantes', 'ab test'],
    d: [line([12, K1], [12, 14.25]), line([12, 14.25], [6, 8.25]), head([6, 8.25], [-1, -1], 4.5), line([12, 14.25], [18, 8.25]), head([18, 8.25], [1, -1], 4.5)],
  },
  'tree-view': {
    tags: ['árbol', 'estructura', 'anidado', 'tree view'],
    // The two children used to sit 1.5 apart (they touched); now 3, and every node has the
    // signature.
    d: [
      box(K0, K0, 6.5, 4, 1.25),
      rline([[6.5, 7.25], [6.5, 18.75], [12, 18.75]], 2.25),
      line([6.5, 11.75], [12, 11.75]),
      box(12, 9.75, 8.75, 4, 1.25),
      box(12, 16.75, 8.75, 4, 1.25),
    ],
  },
  'chart-progress': {
    tags: ['progreso', 'avance', 'barras de progreso', 'progress'],
    // Capsules of 6: the progress sits 3 from the edge (2.5 before, with no clearance).
    d: [pill(2.5, 4.5, 19, 6), pill(2.5, 13.5, 19, 6), line([5.5, 7.5], [14.5, 7.5]), line([5.5, 16.5], [10, 16.5])],
  },
  'chart-forecast': {
    tags: ['pronóstico', 'proyección', 'predicción', 'forecast'],
    d: [rline([[K0, 15.5], [8.25, 10.25], [12.25, 13.25]], SOFT), dot(15, 10.75), dot(17.75, 8.25), dot(20.5, 5.75), line([K0, K1], [K1, K1])],
  },
  'target': {
    tags: ['objetivo', 'meta', 'kpi', 'target'],
    d: [circ(12, 12, 9), circ(12, 12, 5.25), dot(12, 12)],
  },
  'venn': {
    tags: ['intersección', 'conjuntos', 'unión de tablas', 'join', 'venn', 'sets'],
    d: [circ(8.75, 12, 6.25), circ(15.25, 12, 6.25)],
  },
  'matrix': {
    tags: ['matriz', 'tabla de valores', 'cuadrícula', 'matrix'],
    d: [
      rline([[6.75, 4.75], [3.5, 4.75], [3.5, 19.25], [6.75, 19.25]], 1.75),
      rline([[17.25, 4.75], [20.5, 4.75], [20.5, 19.25], [17.25, 19.25]], 1.75),
      ...[8.25, 12, 15.75].flatMap((y) => [8.25, 12, 15.75].map((x) => dot(x, y, 0.3))),
    ],
  },
  'math': {
    tags: ['matemáticas', 'operaciones', 'cálculo', 'math'],
    d: [
      line([7.5, 4.5], [7.5, 10.5]),
      line([4.5, 7.5], [10.5, 7.5]),
      line([13.5, 7.5], [19.5, 7.5]),
      line([5.4, 14.4], [9.6, 18.6]),
      line([9.6, 14.4], [5.4, 18.6]),
      line([13.5, 15], [19.5, 15]),
      line([13.5, 18], [19.5, 18]),
    ],
  },
  'diff': {
    tags: ['diferencias', 'cambios', 'comparar versiones', 'diff'],
    // Plus and minus 8.5 wide, centered on the canvas (they used to weigh less than their
    // neighbors).
    d: [line([12, 4.75], [12, 13.25]), line([7.75, 9], [16.25, 9]), line([7.75, 19.25], [16.25, 19.25])],
  },
  'regex': {
    tags: ['expresión regular', 'patrón', 'búsqueda', 'regex', 'regular expression'],
    d: [dot(6.25, 17.75), line([15, 4.5], [15, 13.5]), line(polar(15, 9, 4.5, -30), polar(15, 9, 4.5, 150)), line(polar(15, 9, 4.5, 30), polar(15, 9, 4.5, 210))],
  },
  'lambda': {
    tags: ['lambda', 'función', 'serverless', 'función anónima'],
    d: [rline([[5.5, 3.75], [7.25, 3.75], [17.25, 20.25], [19, 20.25]], 1), line([11.89, 11.4], [5.25, 20.25])],
  },
  'binary': {
    tags: ['binario', 'bits', 'datos', 'binary'],
    d: [
      rline([[5.5, 4.75], [7, K0], [7, 10.25]], 0),
      pill(13.75, K0, 4.5, 7),
      pill(4.75, 13.75, 4.5, 7),
      rline([[14.5, 15.25], [16, 13.75], [16, K1]], 0),
    ],
  },
  'code-sparkle': {
    tags: ['código con ia', 'generar código', 'asistente', 'ai code'],
    d: [rline([[7.5, 7.5], [3, 12], [7.5, 16.5]], 0), rline([[16.5, 7.5], [21, 12], [16.5, 16.5]], 0), star4(12, 12, 2.9)],
  },
  'condition': {
    tags: ['condición', 'si no', 'decisión', 'algoritmo', 'if else', 'branching'],
    // The lines reach the diamond's rounded vertices (they used to end 0.4 short of them).
    d: [
      line([12, K0], [12, 7.5 + INSET(1)]),
      roundpoly([[12, 7.5], [16.5, 12], [12, 16.5], [7.5, 12]], 1),
      rline([[7.5 + INSET(1), 12], [4.5, 12], [4.5, 20.25]], 2),
      head([4.5, 20.25], [0, 1], 3),
      rline([[16.5 - INSET(1), 12], [19.5, 12], [19.5, 20.25]], 2),
      head([19.5, 20.25], [0, 1], 3),
    ],
  },
  'infinity': {
    tags: ['ciclo continuo', 'devops', 'infinito', 'infinity'],
    d: ['M12 12C10.25 9.25 8.75 7.75 6.75 7.75 4.4 7.75 2.5 9.65 2.5 12S4.4 16.25 6.75 16.25C8.75 16.25 10.25 14.75 12 12S15.25 7.75 17.25 7.75C19.6 7.75 21.5 9.65 21.5 12S19.6 16.25 17.25 16.25C15.25 16.25 13.75 14.75 12 12Z'],
  },
  'git-graph': {
    tags: ['historial', 'commits', 'git', 'git history', 'commit graph'],
    d: [
      circ(7, 5, 1.9),
      line([7, 6.9], [7, 10.1]),
      circ(7, 12, 1.9),
      line([7, 13.9], [7, 17.1]),
      circ(7, 19, 1.9),
      'M8.9 5H12.5A4.5 4.5 0 0 1 17 9.5V10.1',
      circ(17, 12, 1.9),
      'M17 13.9V14.5A4.5 4.5 0 0 1 12.5 19H8.9',
    ],
  },
  'server-rack': {
    tags: ['rack', 'centro de datos', 'servidores', 'data center'],
    // The rack with three units, each with its light on the right, as in `server`. With light and
    // slot it went over 28 % ink and the light got tucked into the corner; without slots it isn't
    // confused with `filing-cabinet` either (handles in the middle).
    d: [
      box(4.75, 2.75, 14.5, 18.5, 3.75),
      line([4.75, 8.92], [19.25, 8.92]),
      line([4.75, 15.08], [19.25, 15.08]),
      ...[5.83, 12, 18.17].map((y) => dot(15.25, y)),
    ],
  },
  'memory': {
    tags: ['memoria', 'ram', 'hardware', 'memory'],
    // Chips and board exactly 3 apart (2.5–2.75 before: they clogged up at 18 px).
    d: [
      box(2.5, 5.5, 19, 10, 2.75),
      sq(5.5, 8.5, 5, 4, 1.2),
      sq(13.5, 8.5, 5, 4, 1.2),
      [5.5, 8.5, 11.5, 15.5, 18.5].map((x) => line([x, 15.5], [x, 18.5])).join(''),
    ],
  },
  'load-balancer': {
    tags: ['balanceador', 'distribuir', 'tráfico', 'load balancer'],
    // Outputs 7.25 apart: the arrowheads end up 3 apart (they used to almost touch).
    d: [
      circ(5, 12, GR),
      line([7.35, 12], [20.25, 12]),
      head([20.25, 12], [1, 0], 3),
      rline([[7.35, 12], [10.25, 12], [14, 4.75], [20.25, 4.75]], 1.75),
      head([20.25, 4.75], [1, 0], 3),
      rline([[7.35, 12], [10.25, 12], [14, 19.25], [20.25, 19.25]], 1.75),
      head([20.25, 19.25], [1, 0], 3),
    ],
  },
  'database-export': {
    tags: ['exportar datos', 'extraer', 'descargar base', 'export'],
    d: DB_D,
    badge: badge('arrow-up'),
  },
  'database-import': {
    tags: ['importar datos', 'cargar', 'migrar', 'import'],
    d: DB_D,
    badge: badge('arrow-down'),
  },

  // Coverage (round 2) -------------------------------------------------------------------------
  'presentation': {
    tags: ['presentación', 'pizarra', 'exponer', 'junta', 'presentation', 'slides', 'pitch'],
    // The landscape whiteboard (a container: the signature), the rising trend and the Λ easel that
    // comes out of the center of its bottom edge.
    d: [
      box(2.5, 3.25, 19, 12.75, 3),
      rline([[8, 21], [12, 16], [16, 21]], 0.6),
      rline([[6.5, 12], [9.75, 8.75], [12.75, 10.75], [17.25, 6.75]], 0.6),
    ],
  },
  // Standalone operators: the same lengths as the core `plus` and `minus` from `sistema`; the
  // equals sign is shorter than `menu-compact` so the two aren't confused.
  'equals': {
    tags: ['igual', 'resultado', 'equivale', 'fórmula', 'equals', 'equal', 'result'],
    d: [line([5.5, 9.5], [18.5, 9.5]), line([5.5, 14.5], [18.5, 14.5])],
  },
  'divide': {
    tags: ['dividir', 'división', 'entre', 'operación', 'divide', 'division', 'math'],
    d: [line([4.25, 12], [19.75, 12]), dot(12, 7), dot(12, 17)],
  },
};

// ---------------------------------------------------------------------------------------------
// Fill (DESIGN.md › Fill): by index into d. `solid` is filled and keeps its stroke (closed shapes
// only); `closed` too, but it is an open stroke of the outline that encloses a body (the bug's half
// head, the flask's glass, the rocket's fins, the block's buttons, each brain hemisphere, the
// database body) and is filled closed with Z: its closing segment runs along a stroke that is
// already there, so the silhouette doesn't change. `cut` is knocked out at the stroke width;
// `lines` stays a line with 1.5 of clearance and `wire` stays a line attached to the fill, with no
// clearance (git branches, a graph's edges, a chip's pins, a flow's connectors).
// ---------------------------------------------------------------------------------------------
const all = (name) => icons[name].d.map((_, i) => i);
const from = (name, i) => all(name).slice(i);
const FILL = {
  'chart-bar': { solid: [0, 1, 2] },
  'chart-bar-horizontal': { solid: [0, 1, 2] },
  // The bars filled and the cuts in each stack knocked out
  'chart-bar-stacked': { solid: [0, 1, 2], cut: [3, 4, 5] },
  'chart-histogram': { solid: [0], cut: [1, 2, 3, 4] },
  'chart-area': { solid: [0] },
  'chart-pie': { solid: [0, 1] },
  'chart-bubble': { solid: [0, 1, 2, 3] },
  'chart-funnel': { solid: [0, 1, 2] },
  // The data filled inside the web, which stays a line
  'chart-radar': { solid: [1], lines: [0] },
  'chart-waterfall': { solid: [0, 1, 2] },
  'chart-gantt': { solid: [0, 1, 2] },
  'chart-treemap': { solid: [0], cut: [1, 2, 3, 4] },
  // The bars filled; the series runs over them as a line
  'chart-combo': { solid: [0, 1, 2], lines: [3] },
  dashboard: { solid: [0, 1, 2] },
  // The gauge's axis stays a line; the center filled and the needle attached to it
  gauge: { solid: [1], wire: [2], lines: [0] },
  // The lens with the handle attached and the bars knocked out
  analytics: { solid: [0], wire: [1], cut: [2, 3, 4] },
  table: { solid: [0], cut: [1, 2] },
  kanban: { solid: [0, 1, 2] },
  schema: { solid: [0, 1], wire: [2], cut: [3, 4] },
  terminal: { solid: [0], cut: [1, 2] },
  'code-window': { solid: [0], cut: [1, 2, 3] },
  // Git: the nodes filled, with the trunk and the branches as lines attached to them
  'git-branch': { solid: [0, 3], wire: [1, 2] },
  'git-commit': { solid: [0], wire: [1, 2] },
  'git-merge': { solid: [0, 2, 3], wire: [1, 4] },
  'git-pull-request': { solid: [0, 2, 3], wire: [1, 4, 5] },
  // The closed-state x touches nothing: it stays a line
  'git-pull-request-closed': { solid: [0, 2, 3], wire: [1, 4], lines: [5, 6] },
  'git-pull-request-draft': { solid: [0, 2, 3, 4, 5, 6], wire: [1] },
  'git-fork': { solid: [0, 3, 4], wire: [1, 2] },
  'git-compare': { solid: [0, 3], wire: [1, 2, 4, 5] },
  'git-graph': { solid: [0, 2, 4, 6], wire: [1, 3, 5, 7] },
  // The body and the head filled (the head closes against the body), the wing-case line knocked
  // out; the legs stay joined to the body
  bug: { solid: [0], closed: [1], wire: [3, 4, 5, 6], cut: [2] },
  // The glass filled (closed along the mouth, under the rim) and the liquid level knocked out
  flask: { closed: [0], wire: [1], cut: [2] },
  'test-tube': { closed: [0], wire: [1], cut: [2] },
  // The plug and the socket filled; the cables and the pins, attached to them
  api: { solid: [1, 2], wire: [0, 3, 4] },
  webhook: { solid: [0], wire: [1, 2] },
  cpu: { solid: [0], wire: [2, 3, 4, 5], cut: [1] },
  'ai-chip': { solid: [0], wire: [2, 3, 4, 5], cut: [1] },
  server: { solid: [0, 1], cut: [2, 3, 4, 5] },
  'cloud-compute': { solid: [0], cut: [1, 2] },
  container: { solid: [0], cut: [1, 2, 3] },
  // The fuselage and the fins filled (the fins close against the side), the window knocked out; the
  // trail touches nothing and stays a line
  rocket: { solid: [0], closed: [1, 2], lines: [4], cut: [3] },
  log: { solid: [0], cut: from('log', 1) },
  network: { solid: [0, 4, 5, 6], wire: [1, 2, 3] },
  'node-graph': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7, 8] },
  hierarchy: { solid: [0, 3, 4], wire: [1, 2] },
  sitemap: { solid: [0, 3, 4, 5], wire: [1, 2] },
  flowchart: { solid: [0, 2], wire: [1] },
  workflow: { solid: [0, 3], wire: [1, 2] },
  // The sparkle filled inside the cycle, which stays a line
  automation: { solid: [2], lines: [0, 1] },
  sparkle: { solid: [0] },
  sparkles: { solid: [0, 1] },
  'search-sparkle': { solid: [0], wire: [1], cut: [2] },
  robot: { solid: [0, 2], wire: [1], cut: [3, 4] },
  chatbot: { solid: [0], cut: [1, 2] },
  // Each hemisphere closes against the middle line, which is knocked out along with the folds
  brain: { closed: [0, 1], cut: [2, 3, 4, 5, 6] },
  'neural-network': { solid: [0, 1, 2, 3, 4], wire: [5, 6, 7, 8, 9, 10] },
  prompt: { solid: [0], cut: [1, 2] },
  // The block's buttons close against its edge
  component: { solid: [0], closed: [1, 2] },
  puzzle: { solid: [0] },
  cube: { solid: [0], cut: [1, 2] },
  'data-filter': { solid: [0, 1, 2, 3] },
  'tree-view': { solid: [0, 3, 4], wire: [1, 2] },
  'chart-progress': { solid: [0, 1], cut: [2, 3] },
  target: { solid: [0], cut: [1, 2] },
  'code-sparkle': { solid: [2], lines: [0, 1] },
  condition: { solid: [1], wire: [0, 2, 3, 4, 5] },
  'server-rack': { solid: [0], cut: from('server-rack', 1) },
  memory: { solid: [0], wire: [3], cut: [1, 2] },
  'load-balancer': { solid: [0], wire: [1, 2, 3, 4, 5, 6] },
  // The whiteboard filled with the trend knocked out; the easel stays joined to its edge
  presentation: { solid: [0], wire: [1], cut: [2] },
};
// The databases with a badge: the body (closed by the lid) and the lid filled, the band and the
// lid's edge knocked out, as in the core `database`
for (const name of ['database-plus', 'database-check', 'database-search', 'database-sync', 'database-export', 'database-import'])
  FILL[name] = { solid: [1], closed: [0], cut: [2] };
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => (ix ?? []).map((i) => d[i]);
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? `${d[i]}Z` : d[i]));
  icons[name].fill = { solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
for (const name of ['database-plus', 'database-check', 'database-search', 'database-sync', 'database-export', 'database-import']) icons[name].fill.cut.push(DB.rim);
// The donut: the hollow ring (not a disc) with its divisions knocked out
icons['chart-donut'].fill = { solid: [ring(12, 12, 9, 4.5)], cut: icons['chart-donut'].d.slice(2) };
// Venn: the two sets filled and the two inner arcs knocked out: what remains is the two crescents
// and the intersection, separated by the stroke width.
{
  const a = (Math.acos(3.25 / 6.25) * 180) / Math.PI;
  icons.venn.fill = { solid: icons.venn.d, cut: [arc(15.25, 12, 6.25, 180 - a, 180 + a).d, arc(8.75, 12, 6.25, -a, a).d] };
}
// Only open lines, glyphs and dots on lines: their fill is the outline itself. Not the atom or the
// infinity sign either: filled, their orbits and loops become a smudge.
for (const name of [
  'chart-line', 'chart-lines', 'chart-step', 'chart-scatter', 'chart-radial', 'chart-distribution', 'chart-forecast',
  'trend-up', 'trend-down', 'trend-flat', 'braces', 'brackets', 'array', 'function', 'variable', 'sum', 'pulse',
  'atom', 'axis-3d', 'ab-test', 'matrix', 'math', 'diff', 'regex', 'lambda', 'binary', 'infinity', 'equals', 'divide',
])
  icons[name].fill = false;

// ---------------------------------------------------------------------------------------------
// 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough. At 16 px a pixel
// measures 1.5 canvas units: straight runs go on pixel centers (0.75 + 1.5k), 45° diagonals pass
// through them, and dots (r 1) are centered on a pixel edge (multiples of 1.5), so each one falls
// whole into 2 × 2 pixels with 1 pixel of clearance or more.
// ---------------------------------------------------------------------------------------------
const SMALL_DOT = 1;
// The brackets of `array` and `matrix`, on pixel centers
const SMALL_BRACKETS = [
  rline([[6.75, 5.25], [3.75, 5.25], [3.75, 18.75], [6.75, 18.75]], 1.5),
  rline([[17.25, 5.25], [20.25, 5.25], [20.25, 18.75], [17.25, 18.75]], 1.5),
];
// The three dots turned into a gray bar
icons.array.small = { d: [...SMALL_BRACKETS, ...[7.5, 12, 16.5].map((x) => dot(x, 12, SMALL_DOT))] };
// The nine dots of r 0.3 were a smudge: at 16 px, the 2 × 2 grid
icons.matrix.small = { d: [...SMALL_BRACKETS, ...[9, 15].flatMap((y) => [9, 15].map((x) => dot(x, y, SMALL_DOT)))] };
// The dash on a pixel center and the dots symmetric, 2 pixels from it
icons.divide.small = { d: [line([4.25, 12.75], [19.75, 12.75]), dot(12, 7.5, SMALL_DOT), dot(12, 18, SMALL_DOT)] };
// The panels clogged up in the center: at 16 px, 2 pixels of clearance between them
{
  const d = [sq(3.75, 3.75, 6, 16.5, 1.5), sq(14.25, 3.75, 6, 6, 1.5), sq(14.25, 14.25, 6, 6, 1.5, { square: ['br'] })];
  icons.dashboard.small = { d, fill: { solid: d } };
}
// The 2.25 × 5 chevrons were two gray smudges: at 45°, through pixel centers
{
  const body = box(2.25, 3.75, 19.5, 16.5, 3.5);
  const rule = line([2.25, 8.25], [21.75, 8.25]);
  const code = [line([9.75, 11.25], [6.75, 14.25], [9.75, 17.25]), line([14.25, 11.25], [17.25, 14.25], [14.25, 17.25])];
  icons['code-window'].small = { d: [body, rule, ...code], fill: { solid: [body], cut: [rule, ...code] } };
}
// 16 px grid: the center of pixel k, the point (column, row) and a line through pixel centers.
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...cells) => line(...cells.map(([c, r]) => g(c, r)));

// The databases with a badge: the 24 px ellipses fell between two pixel rows and became gray bands.
// At 16 px, the sides in columns 2 and 13, and the flat parts of the lid, its rim, the band and the
// bottom on pixel centers (rows 1, 5, 9 and 13). The badge is the engine's pixel badge.
{
  const lid = 'M3.75 5.25c0-1.66 3.69-3 8.25-3s8.25 1.34 8.25 3-3.69 3-8.25 3-8.25-1.34-8.25-3Z';
  const body = 'M3.75 5.25v12c0 1.66 3.69 3 8.25 3s8.25-1.34 8.25-3v-12';
  const band = 'M20.25 11.25c0 1.66-3.69 3-8.25 3s-8.25-1.34-8.25-3';
  const rim = 'M20.25 5.25c0 1.66-3.69 3-8.25 3s-8.25-1.34-8.25-3';
  for (const name of ['database-plus', 'database-check', 'database-export', 'database-import', 'database-search', 'database-sync'])
    icons[name].small = { d: [body, lid, band], fill: { solid: [`${body}Z`, lid], cut: [band, rim] }, badge: badge(icons[name].badge.kind, { size: 16 }) };
}
// The atom: the nucleus stuck to the orbits and at 16 px it was a gray flower. The center goes at
// the center of pixel (7, 7): the vertical orbit falls crisp (its sides in columns 5 and 9, its
// tips in rows 1 and 13) and the nucleus is a single pixel with clearance around it.
{
  const c = g(7, 7);
  icons.atom.small = { d: [circ(...c, 0.1), ...[30, 90, 150].map((a) => rell(...c, 9, 3, a))] };
}
// Automation: the r 9 cycle fell between two pixels and the bolt was a smudge. At 16 px, the r 8.25
// cycle (its sides in columns 2 and 13) with the 24 px arrowhead, and the pixel bolt from
// `cloud-bolt` (`archivos`): it drops at 45°, steps across and drops again, in the center of the
// cycle.
{
  const a = arc(12, 12, 8.25, -60, 240);
  icons.automation.small = { d: [a.d, head(a.end, a.tangent, 3.4), pl([9, 5], [6, 8], [9, 8], [6, 11])] };
}
// The neural network: the r 1.75 nodes and the connections that didn't fall on pixel centers turned
// into a gray mesh. At 16 px, nodes of r 1.5 on pixel centers (3 × 3 with their hole), the layers
// in columns 2, 7 and 13, and each layer's connections on pixel rows.
{
  const N = { a: g(2, 4), b: g(2, 10), c: g(7, 4), d: g(7, 10), e: g(13, 7) };
  const nodes = Object.values(N).map((p) => circ(...p, 1.5));
  const links = [['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'e'], ['d', 'e']].map(([x, y]) => edge(N[x], N[y], 1.5));
  icons['neural-network'].small = { d: [...nodes, ...links], fill: { solid: nodes, wire: links } };
}
// The graph: with nearly horizontal and nearly vertical edges, everything was gray at 16 px. The
// nodes on pixel centers (the big one r 3, the others r 1.5) and the first node's two edges, one
// pixel row and one pixel column; the one going to the big node, at 45°.
{
  const N = [[...g(3, 3), 1.5], [...g(12, 3), 1.5], [...g(10, 10), 3], [...g(3, 12), 1.5]];
  const nodes = N.map(([x, y, r]) => circ(x, y, r));
  const links = [[0, 1], [0, 2], [1, 2], [2, 3], [0, 3]].map(([a, b]) => edge(N[a], N[b], N[a][2], N[b][2]));
  icons['node-graph'].small = { d: [...nodes, ...links], fill: { solid: nodes, wire: links } };
}
// The draft: the dots sat 2 pixels apart and merged into a bar. At 16 px, the rest with the same
// adjustment the engine gives it, and the three 2 × 2 dots 1 pixel apart from each other and from
// the node.
{
  const [top, trunk, bottom, node] = icons['git-pull-request-draft'].d.slice(0, 4).map(snapper(icons['git-pull-request-draft'].d));
  const dots = [12, 7.5, 3].map((y) => dot(18, y, SMALL_DOT));
  icons['git-pull-request-draft'].small = { d: [top, trunk, bottom, node, ...dots], fill: { solid: [top, bottom, node, ...dots], wire: [trunk] } };
}

// ---------------------------------------------------------------------------------------------
// Named parts (DESIGN.md › Named parts): whatever animates, changes state or sits under a badge
// ---------------------------------------------------------------------------------------------
const PARTS = {
  'chart-bar-stacked': { bars: [0, 1, 2], split: [3, 4, 5] },
  'chart-line': { line: [0], axis: [1] },
  'chart-lines': { line: [0, 1], axis: [2] },
  'chart-step': { line: [0], axis: [1] },
  'chart-pie': { pie: [0], slice: [1] },
  'chart-donut': { ring: [0, 1], split: [2, 3, 4] },
  'chart-scatter': { axis: [0], points: [1, 2, 3, 4, 5, 6] },
  'chart-radar': { web: [0], data: [1] },
  'chart-waterfall': { start: [0], change: [1], total: [2] },
  'chart-combo': { bars: [0, 1, 2], line: [3] },
  'chart-radial': { progress: [0, 1], center: [2] },
  'chart-distribution': { curve: [0], axis: [1] },
  'trend-up': { line: [0], arrow: [1] },
  'trend-down': { line: [0], arrow: [1] },
  'trend-flat': { line: [0], arrow: [1] },
  gauge: { dial: [0], needle: [1, 2] },
  analytics: { lens: [0], handle: [1], bars: [2, 3, 4] },
  schema: { tables: [0, 1], relation: [2] },
  terminal: { screen: [0], prompt: [1, 2] },
  'code-window': { screen: [0, 1], code: [2, 3] },
  'git-branch': { trunk: [0, 1], branch: [2, 3] },
  'git-merge': { trunk: [0, 1, 2], branch: [3, 4] },
  'git-pull-request': { trunk: [0, 1, 2], branch: [3, 4], arrow: [5] },
  'git-pull-request-closed': { trunk: [0, 1, 2], branch: [3, 4], mark: [5, 6] },
  'git-pull-request-draft': { trunk: [0, 1, 2], branch: [3, 4, 5, 6] },
  'git-fork': { trunk: [0], branch: [1, 2, 3, 4] },
  'git-compare': { base: [0, 1, 2], head: [3, 4, 5] },
  bug: { body: [0, 1, 2], legs: [3, 4, 5, 6] },
  flask: { body: [0, 1], level: [2] },
  'test-tube': { body: [0, 1], level: [2] },
  api: { socket: [0, 1], plug: [2, 3, 4] },
  webhook: { node: [0], hook: [1], arrow: [2] },
  cpu: { body: [0], core: [1], pins: [2, 3, 4, 5] },
  'ai-chip': { body: [0], spark: [1], pins: [2, 3, 4, 5] },
  server: { body: [0, 1], slots: [2, 4], lights: [3, 5] },
  'cloud-compute': { cloud: [0], prompt: [1, 2] },
  rocket: { body: [0, 1, 2], window: [3], flame: [4] },
  log: { body: [0], rows: from('log', 1) },
  automation: { cycle: [0, 1], bolt: [2] },
  sparkles: { large: [0], small: [1] },
  'search-sparkle': { lens: [0], handle: [1], spark: [2] },
  robot: { head: [0], antenna: [1, 2], eyes: [3, 4] },
  chatbot: { body: [0], eyes: [1, 2] },
  atom: { nucleus: [0], orbits: [1, 2, 3] },
  prompt: { field: [0], spark: [1], text: [2] },
  'code-sparkle': { code: [0, 1], spark: [2] },
  'chart-progress': { track: [0, 1], progress: [2, 3] },
  'chart-forecast': { line: [0], forecast: [1, 2, 3], axis: [4] },
  target: { rings: [0, 1], center: [2] },
  'data-filter': { funnel: [0], points: [1, 2, 3] },
  condition: { input: [0], decision: [1], branches: [2, 3, 4, 5] },
  'load-balancer': { source: [0], routes: [1, 2, 3, 4, 5, 6] },
  presentation: { board: [0], stand: [1], chart: [2] },
  'server-rack': { body: [0, 1, 2], lights: [3, 4, 5] },
};
// The database under each badge
for (const name of ['database-plus', 'database-check', 'database-search', 'database-sync', 'database-export', 'database-import'])
  PARTS[name] = { body: [0, 2], lid: [1] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ---------------------------------------------------------------------------------------------
// Automatic variants that make no sense (DESIGN.md › Automatic variants)
// ---------------------------------------------------------------------------------------------
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already enclosed in a circle, or they are a bubble: they aren't enclosed again
variants(['chart-donut', 'chart-radial', 'target', 'automation', 'chatbot'], { circle: false });
// Already a card (or a bubble with a sign): they aren't enclosed in another square
variants(['chart-treemap', 'table', 'log', 'chatbot'], { square: false });
// With a badge: scaled down to 58–60 % the badge stops reading, and the slash would cut through it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Loose lines, arrows and glyphs: slashing them says nothing
variants(
  [
    'trend-up', 'trend-down', 'trend-flat', 'pulse', 'braces', 'brackets', 'array', 'function', 'variable', 'code-sparkle',
    'axis-3d', 'ab-test', 'matrix', 'diff', 'math', 'sum', 'lambda', 'regex', 'binary', 'infinity', 'equals', 'divide',
  ],
  { slash: false },
);

// ---------------------------------------------------------------------------------------------
// Mirroring (DESIGN.md › Mirroring): charts that grow or advance over time, indented lists, flows
// that read left to right and the prompt's text field
// ---------------------------------------------------------------------------------------------
for (const name of [
  'chart-bar-horizontal', 'chart-line', 'chart-lines', 'chart-step', 'chart-area', 'chart-scatter', 'chart-waterfall',
  'chart-gantt', 'chart-combo', 'chart-forecast', 'chart-progress', 'trend-up', 'trend-down', 'trend-flat', 'log',
  'tree-view', 'workflow', 'flowchart', 'load-balancer', 'neural-network', 'prompt', 'presentation',
])
  icons[name].mirror = true;

// ---------------------------------------------------------------------------------------------
// Motion (DESIGN.md › Motion): each icon's own gesture
// ---------------------------------------------------------------------------------------------
icons['chart-pie'].motion = { effect: 'slide', parts: ['slice'], vector: [-1.25, -1.25] };
icons['trend-up'].motion = { effect: 'slide', vector: [1.5, -1.5] };
icons['trend-down'].motion = { effect: 'slide', vector: [1.5, 1.5] };
icons['trend-flat'].motion = { effect: 'slide', vector: [2, 0] };
icons.gauge.motion = { effect: 'wiggle', parts: ['needle'], origin: [12, 14] };
// A value: the needle sweeps the dial, from its start (150°) at 0 to its end (390°) at 1
icons.gauge.value = { turn: { parts: ['needle'], origin: [12, 14], from: 150, to: 390, at: 315 } };
icons.bug.motion = { effect: 'wiggle', origin: [12, 14] };
icons.api.motion = { effect: 'slide', parts: ['plug'], vector: [-1.25, 1.25] };
icons['ai-chip'].motion = { effect: 'beat', parts: ['spark'], origin: [12, 12] };
icons['cloud-compute'].motion = { effect: 'float', vector: [0, -1.5] };
icons.rocket.motion = { effect: 'slide', vector: [2, -2] };
icons.automation.motion = { effect: 'spin', parts: ['cycle'], origin: [12, 12] };
icons.sparkle.motion = { effect: 'beat', origin: [12, 12] };
icons.sparkles.motion = { effect: 'beat', origin: [12, 12] };
icons['search-sparkle'].motion = { effect: 'beat', parts: ['spark'], origin: [10.6, 10.6] };
icons['code-sparkle'].motion = { effect: 'beat', parts: ['spark'], origin: [12, 12] };
icons.prompt.motion = { effect: 'beat', parts: ['spark'], origin: [7.5, 12] };
icons.atom.motion = { effect: 'spin', parts: ['orbits'], origin: [12, 12] };
icons['database-sync'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['database-export'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] };
icons['database-import'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] };

export default { category: 'datos', label: 'Datos y desarrollo', icons };
