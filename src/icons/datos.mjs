// Datos y desarrollo: gráficas, tableros, código, git, infraestructura e IA. Todo se calcula con
// engine/geometry.mjs sobre las reglas de DESIGN.md (trazo 1.5, keylines, esquinas continuas y la
// esquina inferior derecha recta en los contenedores).
import { arc, circ, dot, drop, head, line, polar, rot, roundpoly, sq } from '../../engine/geometry.mjs';

// ---------------------------------------------------------------------------------------------
// Auxiliares locales
// ---------------------------------------------------------------------------------------------

/** Número con dos decimales como máximo (igual que el motor). */
const n = (v) => {
  const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
};
const pt = (p) => `${n(p[0])} ${n(p[1])}`;
const rad = (deg) => (deg * Math.PI) / 180;

/** Contenedor con la firma: esquinas continuas y la inferior derecha recta. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });

/** Cápsula (extremos semicirculares), horizontal o vertical según el lado mayor. */
function pill(x, y, w, h) {
  if (w >= h) {
    const r = h / 2;
    return `M${pt([x + r, y])}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x + w - r, y + h])}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x + r, y])}Z`;
  }
  const r = w / 2;
  return `M${pt([x, y + r])}A${n(r)} ${n(r)} 0 0 1 ${pt([x + w, y + r])}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${pt([x, y + h - r])}Z`;
}

/** Línea abierta por puntos con las esquinas interiores redondeadas (radio por vértice o uno). */
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

/** Punto de una elipse por ángulo de parámetro (0 = derecha, 90 = abajo). */
const ep = (cx, cy, rx, ry, t) => [cx + rx * Math.cos(rad(t)), cy + ry * Math.sin(rad(t))];
/** Arco de elipse de t0 a t1. */
function earc(cx, cy, rx, ry, t0, t1) {
  return `M${pt(ep(cx, cy, rx, ry, t0))}A${n(rx)} ${n(ry)} 0 ${Math.abs(t1 - t0) > 180 ? 1 : 0} ${t1 > t0 ? 1 : 0} ${pt(ep(cx, cy, rx, ry, t1))}`;
}

/**
 * Recorte: quita de cada primitiva lo que cae dentro de los círculos [cx, cy, R] y devuelve los tramos
 * que quedan. Primitivas: { L: [a, b] } (segmento) o { E: [cx, cy, rx, ry, t0, t1] } (arco).
 */
function cut(prims, holes) {
  const at = (p, s) => {
    if (p.L) return [p.L[0][0] + (p.L[1][0] - p.L[0][0]) * s, p.L[0][1] + (p.L[1][1] - p.L[0][1]) * s];
    const [cx, cy, rx, ry, t0, t1] = p.E;
    return ep(cx, cy, rx, ry, t0 + (t1 - t0) * s);
  };
  const out = (p, s) => holes.every(([cx, cy, R]) => Math.hypot(at(p, s)[0] - cx, at(p, s)[1] - cy) > R);
  const edge = (p, a, b) => {
    const ia = out(p, a);
    for (let k = 0; k < 40; k++) {
      const m = (a + b) / 2;
      if (out(p, m) === ia) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const d = [];
  for (const p of prims) {
    const N = 400;
    let start = out(p, 0) ? 0 : null;
    for (let i = 1; i <= N; i++) {
      const s0 = (i - 1) / N;
      const s1 = i / N;
      const o0 = out(p, s0);
      const o1 = out(p, s1);
      if (o0 !== o1) {
        const e = edge(p, s0, s1);
        if (o1) start = e;
        else if (start !== null) {
          d.push(piece(p, start, e));
          start = null;
        }
      }
    }
    if (start !== null) d.push(piece(p, start, 1));
  }
  return d;
  function piece(p, s0, s1) {
    if (p.L) return line(at(p, s0), at(p, s1));
    const [cx, cy, rx, ry, t0, t1] = p.E;
    return earc(cx, cy, rx, ry, t0 + (t1 - t0) * s0, t0 + (t1 - t0) * s1);
  }
}

/** Path con puntos transformados (p. ej. girados): [['M', p], ['C', c1, c2, p], ['A', r, large, sweep, p], ['Z']]. */
function tp(cmds, T = (p) => p) {
  return cmds
    .map(([c, ...a]) => {
      if (c === 'Z') return 'Z';
      if (c === 'A') return `A${n(a[0])} ${n(a[0])} 0 ${a[1]} ${a[2]} ${pt(T(a[3]))}`;
      return c + a.map((p) => pt(T(p))).join(' ');
    })
    .join('');
}

/** Chispa de cuatro puntas con lados cóncavos (la chispa de IA). */
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

/** Intersección superior de dos círculos [cx, cy, r]. */
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
/** Arco horario sobre el círculo c de p0 a p1. */
function cwArc(c, p0, p1) {
  const a0 = Math.atan2(p0[1] - c[1], p0[0] - c[0]);
  let span = Math.atan2(p1[1] - c[1], p1[0] - c[0]) - a0;
  while (span < 0) span += 2 * Math.PI;
  return `A${n(c[2])} ${n(c[2])} 0 ${span > Math.PI ? 1 : 0} 1 ${pt(p1)}`;
}
/** Nube: tres lóbulos (izquierdo, superior, derecho) sobre una base plana en `base`. */
function cloud(L, T, R, base) {
  const a = [L[0], base];
  const b = meet(L, T);
  const c = meet(T, R);
  const e = [R[0], base];
  return `M${pt(a)}${cwArc(L, a, b)}${cwArc(T, b, c)}${cwArc(R, c, e)}Z`;
}

/** Elipse girada `deg` grados alrededor de su centro. */
function rell(cx, cy, rx, ry, deg) {
  const p0 = rot([cx - rx, cy], [cx, cy], deg);
  const p1 = rot([cx + rx, cy], [cx, cy], deg);
  return `M${pt(p0)}A${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${pt(p1)}A${n(rx)} ${n(ry)} ${n(deg)} 1 0 ${pt(p0)}Z`;
}

/** Arista entre dos nodos circulares de radio r1 y r2: toca los bordes, no entra. */
function edge(p, q, r1, r2 = r1) {
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const L = Math.hypot(dx, dy);
  return line([p[0] + (dx / L) * r1, p[1] + (dy / L) * r1], [q[0] - (dx / L) * r2, q[1] - (dy / L) * r2]);
}

// La base de datos del núcleo como primitivas, para recortarla bajo una insignia.
const DB = [
  { E: [12, 6.1, 8.4, 3, 0, 180] },
  { E: [12, 6.1, 8.4, 3, 180, 360] },
  { L: [[3.6, 6.1], [3.6, 17.9]] },
  { L: [[20.4, 6.1], [20.4, 17.9]] },
  { E: [12, 12, 8.4, 3, 0, 180] },
  { E: [12, 17.9, 8.4, 3, 0, 180] },
];
// Insignia: círculo de r 4.25 abajo a la derecha; el objeto base se recorta a 3 del trazo.
const BADGE = [17.25, 17.25, 4.25];
const BADGE_CUT = [[17.25, 17.25, 7.25]];

// Keylines.
const K0 = 3.25;
const K1 = 20.75;
/** Tarjeta cuadrada del set (17.5, radio 4.25, firma). */
const CARD = box(K0, K0, 17.5, 17.5, 4.25);

// Barras: tres columnas de 3.75 con 3.13 de separación entre bordes.
const BW = 3.75;
const BX = [3.25, 10.125, 17];
const bar = (x, top, bottom = K1) => sq(x, top, BW, bottom - top, 1.15, { square: ['bl', 'br'] });

// Líneas de datos: quiebres suaves (radio 2.5); las tendencias, más suaves aún (radio 3) y con
// punta corta a lo largo del último tramo, para que se lean como un flujo y no como un zigzag.
const SOFT = 2.5;
const TREND = 3;
const UP = [[3, 17], [9.25, 10.75], [13, 14.5], [20.25, 7.25]];
const DOWN = UP.map(([x, y]) => [x, 24 - y]);
const FLAT = [[2.75, 13], [7.5, 8.25], [12, 12.75], [20.5, 12.75]];

// Git: nodos de r 2.35 (los del roadmap del núcleo) y ramas que entran y salen del tronco como
// un carril, con curvas tangentes en lugar de codos.
const GR = 2.35;

// La lupa del núcleo (search), idéntica: aro de r 6.85 en 10.6 y mango de 15.6 a 20.5.
const SEARCH = [circ(10.6, 10.6, 6.85), line([15.6, 15.6], [20.5, 20.5])];

// ---------------------------------------------------------------------------------------------
// Íconos
// ---------------------------------------------------------------------------------------------

const icons = {
  // Gráficas -----------------------------------------------------------------------------------
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
      line([BX[0], 14.5], [BX[0] + BW, 14.5]),
      bar(BX[1], 3.25),
      line([BX[1], 10.75], [BX[1] + BW, 10.75]),
      bar(BX[2], 12),
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
      // La red y el dato, sin radios: los radios cruzaban el polígono y a 18 px se volvían una
      // estrella. Cada vértice del dato queda a 3 o más de la red (radio ≤ 9.3 − 3.71).
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
    d: [bar(BX[0], 11.5), sq(BX[1], 4.25, BW, 7.25, 1.15), line([BX[0] + BW, 11.5], [BX[1], 11.5]), sq(BX[2], 4.25, BW, 10, 1.15), line([BX[1] + BW, 4.25], [BX[2], 4.25])],
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
    // Sin la línea de la media: con ella la campana se leía como una carpa.
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
    d: [
      sq(K0, K0, 7.5, 17.5, 2.25),
      sq(13.25, K0, 7.5, 7.5, 2.25),
      sq(13.25, 13.25, 7.5, 7.5, 2.25, { square: ['br'] }),
    ],
  },
  'gauge': {
    tags: ['medidor', 'velocidad', 'rendimiento', 'gauge'],
    d: (() => {
      // Centro en 14: el arco (de 5 a 18.5) queda centrado en el lienzo.
      const c = [12, 14];
      return [arc(c[0], c[1], 9, 150, 390).d, circ(c[0], c[1], 1.75), line(polar(c[0], c[1], 1.75, -45), polar(c[0], c[1], 6.25, -45))];
    })(),
  },
  'analytics': {
    tags: ['análisis', 'analítica', 'explorar datos', 'insights', 'analytics'],
    // La lupa del núcleo (search) con tres barras a 3 entre sí, todas a 3 o más del aro.
    d: [...SEARCH, line([7.6, 10.6], [7.6, 12.85]), line([10.6, 7.35], [10.6, 12.85]), line([13.6, 9.1], [13.6, 12.85])],
  },

  // Tablas y tableros --------------------------------------------------------------------------
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
      line([K0, 6.5], [11.75, 6.5]),
      box(12.25, 13.25, 8.5, 7.5, 2.25),
      line([12.25, 16.5], [K1, 16.5]),
      rline([[11.75, 8.5], [16.5, 8.5], [16.5, 13.25]], 2),
    ],
  },

  // Código -------------------------------------------------------------------------------------
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
    d: [
      box(2.5, 4, 19, 16, 4),
      line([2.5, 8.75], [21.5, 8.75]),
      rline([[9.5, 11.5], [7.25, 14.25], [9.5, 17]], 0),
      rline([[14.5, 11.5], [16.75, 14.25], [14.5, 17]], 0),
    ],
  },

  // Git ----------------------------------------------------------------------------------------
  'git-branch': {
    tags: ['rama', 'git', 'bifurcación', 'nueva rama', 'branch'],
    // El tiempo sube: la rama sale del tronco como un carril y termina arriba, en su nodo.
    d: [circ(6.25, 18.4, GR), circ(17.75, 5.6, GR), line([6.25, K0], [6.25, 16.05]), 'M6.25 15.25C6.25 11.25 17.75 12.75 17.75 8.75V7.95'],
  },
  'git-commit': {
    tags: ['commit', 'git', 'confirmación', 'versión', 'commit'],
    d: [line([2.5, 12], [8.25, 12]), circ(12, 12, 3.75), line([15.75, 12], [21.5, 12])],
  },
  'git-merge': {
    tags: ['fusionar', 'merge', 'git', 'unir ramas', 'merge branch'],
    // El espejo de git-branch: la rama nace abajo y se incorpora al tronco como un carril.
    d: [circ(6.25, 5.6, GR), circ(6.25, 18.4, GR), circ(17.75, 18.4, GR), line([6.25, 7.95], [6.25, 16.05]), 'M17.75 16.05V15C17.75 11.25 6.25 12.75 6.25 8.75'],
  },
  'git-pull-request': {
    tags: ['pull request', 'revisión', 'git', 'solicitud de cambios'],
    d: [
      circ(6.25, 5.6, 2.35),
      circ(6.25, 18.4, 2.35),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(17.75, 18.4, 2.35),
      rline([[17.75, 16.05], [17.75, 5.6], [11.75, 5.6]], 3.5),
      head([11.75, 5.6], [-1, 0], 3.4),
    ],
  },
  'git-pull-request-closed': {
    tags: ['pull request cerrado', 'rechazado', 'git', 'closed'],
    d: [
      circ(6.25, 5.6, 2.35),
      circ(6.25, 18.4, 2.35),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(17.75, 18.4, 2.35),
      line([17.75, 16.05], [17.75, 11.25]),
      line([15.75, 3.6], [19.75, 7.6]),
      line([19.75, 3.6], [15.75, 7.6]),
    ],
  },
  'git-pull-request-draft': {
    tags: ['borrador', 'pull request', 'git', 'draft'],
    d: [
      circ(6.25, 5.6, 2.35),
      circ(6.25, 18.4, 2.35),
      line([6.25, 7.95], [6.25, 16.05]),
      circ(17.75, 18.4, 2.35),
      dot(17.75, 12.75),
      dot(17.75, 9),
      dot(17.75, 5.25),
    ],
  },
  'git-fork': {
    tags: ['fork', 'bifurcar', 'copia del repositorio', 'git', 'repository fork'],
    // Una Y de curvas tangentes: las dos copias salen del mismo tronco sin codos.
    d: [
      circ(6.25, 5.6, GR),
      circ(17.75, 5.6, GR),
      circ(12, 18.4, GR),
      'M6.25 7.95C6.25 11.5 12 10.5 12 14.25V16.05',
      'M17.75 7.95C17.75 11.5 12 10.5 12 14.25',
    ],
  },
  'git-compare': {
    tags: ['comparar', 'diferencias', 'git', 'compare'],
    d: [
      circ(5.6, 5.6, 2.35),
      circ(18.4, 18.4, 2.35),
      rline([[7.95, 5.6], [18.4, 5.6], [18.4, 12.5]], 3.5),
      head([18.4, 12.5], [0, 1], 3.4),
      rline([[16.05, 18.4], [5.6, 18.4], [5.6, 11.5]], 3.5),
      head([5.6, 11.5], [0, -1], 3.4),
    ],
  },

  // Pruebas ------------------------------------------------------------------------------------
  'bug': {
    tags: ['error', 'bicho', 'falla', 'depurar', 'bug', 'debug'],
    // El cuerpo lleva hombros redondos (antes eran esquinas vivas, ajenas al set).
    d: [
      'M9.25 8.5A2.75 2.75 0 0 1 14.75 8.5',
      'M6.75 14V11A2.5 2.5 0 0 1 9.25 8.5H14.75A2.5 2.5 0 0 1 17.25 11V14A5.25 5.25 0 0 1 6.75 14Z',
      line([12, 8.5], [12, 19.25]),
      line([6.75, 12.75], [3.5, 12.75]),
      line([7.6, 17.5], [4.5, 19.75]),
      line([17.25, 12.75], [20.5, 12.75]),
      line([16.4, 17.5], [19.5, 19.75]),
    ],
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

  // Conexiones e infraestructura -----------------------------------------------------------------
  'api': {
    tags: ['api', 'conexión', 'integración', 'conector', 'endpoint', 'plug'],
    d: (() => {
      const T = (p) => rot([12 + p[0], 12 + p[1]], [12, 12], -45);
      return [
        tp([['M', [-12.25, 0]], ['L', [-8.25, 0]]], T),
        tp([['M', [-3.25, -3.75]], ['L', [-4.5, -3.75]], ['A', 3.75, 0, 0, [-4.5, 3.75]], ['L', [-3.25, 3.75]], ['Z']], T),
        tp([['M', [3.25, -1.75]], ['L', [0.25, -1.75]], ['M', [3.25, 1.75]], ['L', [0.25, 1.75]]], T),
        tp([['M', [3.25, -3.75]], ['L', [4.5, -3.75]], ['A', 3.75, 0, 1, [4.5, 3.75]], ['L', [3.25, 3.75]], ['Z']], T),
        tp([['M', [8.25, 0]], ['L', [12.25, 0]]], T),
      ];
    })(),
  },
  'webhook': {
    tags: ['webhook', 'evento', 'notificación', 'callback'],
    // Un gancho que devuelve la llamada: el nodo de git (r 2.35) y una U de r 5.25 que llena
    // el área viva (antes pesaba menos que sus vecinos).
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
    d: [
      box(K0, K0, 17.5, 7.25, 2.25),
      dot(7.25, 6.875),
      line([11.25, 6.875], [16.75, 6.875]),
      box(K0, 13.5, 17.5, 7.25, 2.25),
      dot(7.25, 17.125),
      line([11.25, 17.125], [16.75, 17.125]),
    ],
  },
  'cloud-compute': {
    tags: ['nube', 'cómputo en la nube', 'servidor remoto', 'cloud computing'],
    // La nube de archivos (mismos tres lóbulos y base en 18.25) con el prompt de la terminal.
    d: [
      cloud([7.25, 14.25, 4], [12.5, 10.75, 5.5], [17.25, 14.5, 3.75], 18.25),
      rline([[9.25, 11.25], [11.25, 13.25], [9.25, 15.25]], 0),
      line([13.5, 15.25], [15.75, 15.25]),
    ],
  },
  'container': {
    tags: ['contenedor', 'docker', 'imagen', 'despliegue', 'container'],
    // Un contenedor de carga con sus costillas. Antes eran tres cajas apiladas que se tocaban
    // (1.5 entre trazos) y a 18 px se fundían.
    d: [box(2.5, 5, 19, 14, 4), ...[7.25, 12, 16.75].map((x) => line([x, 8.75], [x, 15.25]))],
  },
  'rocket': {
    tags: ['cohete', 'lanzamiento', 'despliegue', 'deploy'],
    d: (() => {
      const k = 1.08;
      const T = (p) => rot([12 + (p[0] - 12) * k, 12 + (p[1] - 12) * k], [12, 12], 45);
      return [
        tp([['M', [9, 15.25]], ['L', [9, 9.5]], ['C', [9, 6.5], [10.25, 4.25], [12, 2.75]], ['C', [13.75, 4.25], [15, 6.5], [15, 9.5]], ['L', [15, 15.25]], ['Z']], T),
        circ(...T([12, 9.25]), 1.6),
        tp([['M', [9, 11.75]], ['L', [6.5, 14.25]], ['L', [6.5, 17.5]], ['L', [9, 15.25]]], T),
        tp([['M', [15, 11.75]], ['L', [17.5, 14.25]], ['L', [17.5, 17.5]], ['L', [15, 15.25]]], T),
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
    d: [CARD, ...[8.5, 12, 15.5].flatMap((y) => [dot(7.75, y), line([10.75, y], [16.25, y])])],
  },

  // Estructuras y flujos -------------------------------------------------------------------------
  'network': {
    tags: ['red', 'nodos', 'conexiones', 'network'],
    d: (() => {
      const c = [12, 13.5];
      const A = [-90, 30, 150];
      return [
        circ(c[0], c[1], 2.5),
        ...A.map((a) => circ(...polar(c[0], c[1], 8, a), 2.25)),
        ...A.map((a) => line(polar(c[0], c[1], 2.5, a), polar(c[0], c[1], 5.75, a))),
      ];
    })(),
  },
  'node-graph': {
    tags: ['grafo', 'nodos', 'relaciones', 'grafo de conocimiento', 'graph', 'knowledge graph'],
    // Un grafo de verdad: nodos de distinto peso y aristas irregulares. El anterior era un moño
    // simétrico que a 18 px se leía como una X entre dos barras.
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
      circ(5.6, 18.4, 2.35),
      circ(18.4, 18.4, 2.35),
      line([12, 7.95], [12, 12]),
      rline([[5.6, 16.05], [5.6, 12], [18.4, 12], [18.4, 16.05]], 2.5),
    ],
  },
  'sitemap': {
    tags: ['mapa del sitio', 'estructura', 'páginas', 'sitemap'],
    // Tres páginas hijas a lo ancho del apaisado (19), con 3 justos entre ellas: antes quedaban a
    // 2.75 y a 18 px se pegaban.
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
    d: [
      box(K0, K0, 8, 6, 1.85),
      roundpoly([[16.25, 11.25], [20.75, 15.75], [16.25, 20.25], [11.75, 15.75]], 1),
      rline([[7.25, 9.25], [7.25, 15.75], [11.75, 15.75]], 2.5),
    ],
  },
  'workflow': {
    tags: ['flujo de trabajo', 'automatización', 'pasos', 'workflow'],
    d: [sq(K0, K0, 7.5, 7.5, 2.25), box(13.25, 13.25, 7.5, 7.5, 2.25), rline([[10.75, 7], [17, 7], [17, 11]], 3), head([17, 11], [0, 1], 3)],
  },
  'automation': {
    tags: ['automatización', 'disparador', 'ciclo', 'automation'],
    d: (() => {
      const a = arc(12, 12, 9, -60, 240);
      return [a.d, head(a.end, a.tangent, 3.4), roundpoly([[13.25, 6.25], [8.25, 13], [12, 13], [10.75, 17.75], [15.75, 11], [12, 11]], 0.5)];
    })(),
  },

  // Inteligencia artificial ----------------------------------------------------------------------
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
    d: [rell(12, 12, 9.25, 3.5, 30), rell(12, 12, 9.25, 3.5, 90), rell(12, 12, 9.25, 3.5, 150), dot(12, 12)],
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
    // La chispa abre el campo y el texto la sigue: antes, «− ✦» simétrico parecía un control de juego.
    d: [box(2.5, 6, 19, 12, 4), star4(7.5, 12, 2.75), line([13.25, 12], [17.75, 12])],
  },

  // Componentes y 3D ---------------------------------------------------------------------------
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

  // Bases de datos -----------------------------------------------------------------------------
  'database-plus': {
    tags: ['nueva base de datos', 'agregar datos', 'crear tabla', 'add database'],
    d: [...cut(DB, BADGE_CUT), circ(...BADGE), line([15.25, 17.25], [19.25, 17.25]), line([17.25, 15.25], [17.25, 19.25])],
  },
  'database-check': {
    tags: ['datos validados', 'base de datos lista', 'verificado', 'database check'],
    d: [...cut(DB, BADGE_CUT), circ(...BADGE), rline([[15.35, 17.35], [16.65, 18.65], [19.15, 16.05]], 0)],
  },
  'database-search': {
    tags: ['consulta', 'query', 'buscar datos', 'database search'],
    d: [...cut(DB, [[16.75, 16.75, 6.25], [20.25, 20.25, 3]]), circ(16.75, 16.75, 3.25), line(polar(16.75, 16.75, 3.25, 45), [20.75, 20.75])],
  },
  'database-sync': {
    tags: ['sincronizar datos', 'réplica', 'actualizar', 'database sync'],
    d: (() => {
      const a = arc(17.25, 17.25, 4.25, 190, 320);
      const b = arc(17.25, 17.25, 4.25, 10, 140);
      return [...cut(DB, BADGE_CUT), a.d, head(a.end, a.tangent, 2.25), b.d, head(b.end, b.tangent, 2.25)];
    })(),
  },

  // Filtros y experimentos -----------------------------------------------------------------------
  'data-filter': {
    tags: ['filtrar datos', 'filtro', 'segmentar', 'data filter', 'filter data'],
    d: [dot(7, 3.75), dot(12, 3.75), dot(17, 3.75), roundpoly([[K0, 7.25], [K1, 7.25], [13.75, 14.25], [13.75, K1], [10.25, K1], [10.25, 14.25]], [1.25, 1.25, 1, 0.6, 0.6, 1])],
  },
  'ab-test': {
    tags: ['prueba a/b', 'experimento', 'variantes', 'ab test'],
    d: [line([12, K1], [12, 14.25]), line([12, 14.25], [6, 8.25]), head([6, 8.25], [-1, -1], 4.5), line([12, 14.25], [18, 8.25]), head([18, 8.25], [1, -1], 4.5)],
  },
  'tree-view': {
    tags: ['árbol', 'estructura', 'anidado', 'tree view'],
    // Las dos hijas quedaban a 1.5 (se tocaban); ahora a 3, y todos los nodos con la firma.
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
    // Cápsulas de 6: el avance queda a 3 del borde (antes a 2.5, sin aire).
    d: [pill(2.5, 4.5, 19, 6), line([5.5, 7.5], [14.5, 7.5]), pill(2.5, 13.5, 19, 6), line([5.5, 16.5], [10, 16.5])],
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
    // Más y menos a 8.5 de ancho, centrados en el lienzo (antes pesaban menos que sus vecinos).
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
    d: [rline([[7.5, 7.5], [3, 12], [7.5, 16.5]], 0), star4(12, 12, 2.9), rline([[16.5, 7.5], [21, 12], [16.5, 16.5]], 0)],
  },
  'condition': {
    tags: ['condición', 'si no', 'decisión', 'algoritmo', 'if else', 'branching'],
    d: [
      line([12, K0], [12, 7.5]),
      roundpoly([[12, 7.5], [16.5, 12], [12, 16.5], [7.5, 12]], 1),
      rline([[7.5, 12], [4.5, 12], [4.5, 20.25]], 2),
      head([4.5, 20.25], [0, 1], 3),
      rline([[16.5, 12], [19.5, 12], [19.5, 20.25]], 2),
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
      circ(7, 12, 1.9),
      circ(7, 19, 1.9),
      line([7, 6.9], [7, 10.1]),
      line([7, 13.9], [7, 17.1]),
      circ(17, 12, 1.9),
      'M8.9 5H12.5A4.5 4.5 0 0 1 17 9.5V10.1',
      'M17 13.9V14.5A4.5 4.5 0 0 1 12.5 19H8.9',
    ],
  },
  'server-rack': {
    tags: ['rack', 'centro de datos', 'servidores', 'data center'],
    d: [
      box(4.75, 2.75, 14.5, 18.5, 3.75),
      line([4.75, 8.92], [19.25, 8.92]),
      line([4.75, 15.08], [19.25, 15.08]),
      ...[5.83, 12, 18.17].flatMap((y) => [dot(8.25, y), line([11.5, y], [15.75, y])]),
    ],
  },
  'memory': {
    tags: ['memoria', 'ram', 'hardware', 'memory'],
    // Chips y tarjeta a 3 exactos entre sí (antes a 2.5–2.75: se empastaban a 18 px).
    d: [
      box(2.5, 5.5, 19, 10, 2.75),
      sq(5.5, 8.5, 5, 4, 1.2),
      sq(13.5, 8.5, 5, 4, 1.2),
      [5.5, 8.5, 11.5, 15.5, 18.5].map((x) => line([x, 15.5], [x, 18.5])).join(''),
    ],
  },
  'load-balancer': {
    tags: ['balanceador', 'distribuir', 'tráfico', 'load balancer'],
    // Las salidas a 7.25 entre sí: las puntas quedan a 3 (antes casi se tocaban).
    d: [
      circ(5, 12, GR),
      rline([[7.35, 12], [10.25, 12], [14, 4.75], [20.25, 4.75]], 1.75),
      head([20.25, 4.75], [1, 0], 3),
      line([7.35, 12], [20.25, 12]),
      head([20.25, 12], [1, 0], 3),
      rline([[7.35, 12], [10.25, 12], [14, 19.25], [20.25, 19.25]], 1.75),
      head([20.25, 19.25], [1, 0], 3),
    ],
  },
  'database-export': {
    tags: ['exportar datos', 'extraer', 'descargar base', 'export'],
    d: [...cut(DB, BADGE_CUT), circ(...BADGE), line([17.25, 19.5], [17.25, 15]), rline([[15.25, 17], [17.25, 15], [19.25, 17]], 0)],
  },
  'database-import': {
    tags: ['importar datos', 'cargar', 'migrar', 'import'],
    d: [...cut(DB, BADGE_CUT), circ(...BADGE), line([17.25, 15], [17.25, 19.5]), rline([[15.25, 17.5], [17.25, 19.5], [19.25, 17.5]], 0)],
  },
};

// Variantes (DESIGN.md › Variantes automáticas).
// Ya vienen encerrados en un círculo, o son un globo: no se vuelven a encerrar.
for (const name of ['chart-donut', 'chart-radial', 'target', 'automation', 'chatbot']) icons[name].variants = { circle: false };
// Con insignia: reducidos al 58–60 % la insignia deja de leerse.
for (const name of ['database-plus', 'database-check', 'database-search', 'database-sync', 'database-export', 'database-import'])
  icons[name].variants = { circle: false, square: false };
// Líneas sueltas y glifos: tacharlos no dice nada.
for (const name of ['trend-up', 'trend-down', 'trend-flat', 'pulse', 'braces', 'brackets', 'code-sparkle', 'diff', 'math', 'sum', 'lambda', 'regex', 'infinity'])
  icons[name].variants = { ...icons[name].variants, slash: false };

export default { category: 'datos', label: 'Datos y desarrollo', icons };
