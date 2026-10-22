// Navegación: flechas, chevrons, menús, paneles, vistas y todo lo que mueve al usuario por la
// interfaz. Se dibuja con el motor sobre las reglas de DESIGN.md; las medidas base salen del
// núcleo (arrow-right: asta de 16 y brazos de 6 por eje; chevron-right: brazos de 6.75).
import { arc, badge, circ, cursor, dot, f, head, line, rot, roundpoly, sq } from '../../engine/geometry.mjs';

const C = [12, 12];
const R2 = Math.SQRT2;
const P = ([x, y]) => `${f(x)} ${f(y)}`;

/** Gira una lista de puntos alrededor del centro del lienzo. */
const turn = (pts, deg) => pts.map((p) => rot(p, C, deg));
/** Flecha recta de `a` a `b`; `len` es el largo de cada brazo de la punta. */
const arrow = (a, b, len) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], len)];
/** Flecha recta girada `deg` alrededor del centro. */
const arrowR = (a, b, len, deg) => {
  const [p, q] = turn([a, b], deg);
  return arrow(p, q, len);
};

// Esquina continua (squircle) con el mismo suavizado 0.6 de sq(): la medida de una esquina de radio r.
function corner(r, s = 0.6) {
  const p = (1 + s) * r;
  const ang = 90 * (1 - s);
  const L = Math.sin(((ang / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - ang) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L, r };
}

/**
 * Polilínea abierta con esquinas continuas en sus vértices de 90° (las mismas de sq()). `radius`
 * puede ser uno o uno por vértice; 0 deja la esquina recta (la firma).
 */
function cline(pts, radius) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  const add = (p, u, k) => [p[0] + u[0] * k, p[1] + u[1] * k];
  const unit = (a, b) => {
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / n, (b[1] - a[1]) / n];
  };
  let d = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const V = pts[i];
    const r = rr[i];
    if (!r) {
      d += `L${P(V)}`;
      continue;
    }
    const u = unit(pts[i - 1], V);
    const v = unit(V, pts[i + 1]);
    const k = corner(r);
    const S = add(V, u, -k.p);
    const e1 = add(add(S, u, k.a + k.b + k.c), v, k.d);
    const e2 = add(add(e1, u, k.L), v, k.L);
    const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    d += `L${P(S)}C${P(add(S, u, k.a))} ${P(add(S, u, k.a + k.b))} ${P(e1)}`;
    d += `A${f(r)} ${f(r)} 0 0 ${sweep} ${P(e2)}`;
    d += `C${P(add(add(e2, u, k.d), v, k.c))} ${P(add(add(e2, u, k.d), v, k.b + k.c))} ${P(add(add(e2, u, k.d), v, k.a + k.b + k.c))}`;
  }
  return `${d}L${P(pts.at(-1))}`;
}

/** Cápsula vertical: la misma del ratón de dispositivos (lados rectos, extremos en semicírculo). */
const capsule = (x, y, w, h) => {
  const r = w / 2;
  return `M${P([x, y + r])}A${f(r)} ${f(r)} 0 0 1 ${P([x + w, y + r])}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x, y + h - r])}Z`;
};

// Contenedores base (keylines del núcleo).
const SQUARE = sq(3.25, 3.25, 17.5, 17.5, 4.25, { square: ['br'] });
const RING = circ(12, 12, 9);

// Flecha grande: la de arrow-right del núcleo (asta 3.75→19.75, brazos de 6 por eje).
const BIG = [[3.75, 12], [19.75, 12]];
const BIG_ARM = 6 * R2;
// Diagonal grande: caja de 12, brazos de 8 a lo largo de los ejes.
const DIAG = [[5.75, 18.25], [17.75, 6.25]];
const DIAG_ARM = 8;
// Flecha interior (en círculo o en cuadrado): asta de 9.25, brazos de 4.25 por eje.
const IN = [[7.25, 12], [16.5, 12]];
const IN_ARM = 4.25 * R2;
const IN_DIAG = [[8.5, 15.5], [15.5, 8.5]];
const IN_DIAG_ARM = 5.75;

// Flecha gruesa (contorno): asta de 5.5 y punta de 15, girada `deg`.
const THICK = [[3.25, 9.25], [11.75, 9.25], [11.75, 4.5], [20.75, 12], [11.75, 19.5], [11.75, 14.75], [3.25, 14.75]];
const thick = (deg) => [roundpoly(turn(THICK, deg), [1.25, 0.75, 1.25, 1.75, 1.25, 0.75, 1.25])];
// Flecha contra una barra (subir al inicio, bajar al final…), dibujada hacia arriba y girada.
const toLine = (deg) => {
  const [a, b, c, e] = turn([[5.25, 4], [18.75, 4], [12, 20.25], [12, 8]], deg);
  return [line(a, b), ...arrow(c, e, 5.5 * R2)];
};
// Vuelta en esquina: sube y gira a la derecha; las demás son su espejo o su giro.
const TURN = [[5.25, 20.25], [5.25, 9.5], [19.25, 9.5]];
const mirrorX = (pts) => pts.map(([x, y]) => [24 - x, y]);
const turnArrow = (pts) => [cline(pts, 4.5), head(pts[2], [pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]], 5 * R2)];
// Vuelta en U (deshacer): el regreso es medio squircle, con las esquinas continuas del set.
const UNDO = [[4.25, 8.75], [19.75, 8.75], [19.75, 19.75], [10.5, 19.75]];
const uturn = (pts) => [cline(pts, [0, 3.4, 3.4, 0]), head(pts[0], [pts[0][0] - pts[1][0], 0], 4.5 * R2)];
// Arco que salta hacia un lado (el izquierdo es su espejo: ángulo θ → 180 − θ). Punta de arco
// de 3.6, la de refresh del núcleo.
const curveArrow = (flip) => {
  const a = flip ? arc(12, 15.5, 8, 15, -162) : arc(12, 15.5, 8, 165, 342);
  return [a.d, head(a.end, a.tangent, 3.6)];
};
// Historial: el espejo exacto de clock-forward (lugares): el reloj corre hacia atrás.
const HISTORY = arc(12, 12, 8.75, 220, -65);

// Chevron del núcleo (brazos de 6.75, corrido 0.6 hacia donde apunta) y sus giros.
const CHEV = [[9.25, 5.25], [16, 12], [9.25, 18.75]];
const chev = (deg, pts = CHEV) => line(...turn(pts, deg));
// Doble chevron: brazos de 5.5, separados 5.5 (3.9 entre trazos).
const CHEV2 = [[[6.75, 6.5], [12.25, 12], [6.75, 17.5]], [[12.25, 6.5], [17.75, 12], [12.25, 17.5]]];
const chev2 = (deg) => CHEV2.map((pts) => chev(deg, pts));
// Chevron dentro del círculo: brazos de 4.25.
const CHEV_IN = [[10.25, 7.75], [14.5, 12], [10.25, 16.25]];
// Caret: triángulo de contorno, la punta un poco más redonda que la base.
const CARET = [[8.25, 5.75], [17.25, 12], [8.25, 18.25]];
const caret = (deg) => [roundpoly(turn(CARET, deg), [1.6, 1.9, 1.6])];
// Ordenar: flecha hacia abajo (sentido de lectura) y tres barras.
const sortBars = (lens) => [...arrow([6.75, 4.25], [6.75, 19.75], 3.5 * R2), ...[6.5, 12, 17.5].map((y, i) => line([13.5, y], [13.5 + lens[i], y]))];

// Maximizar / minimizar: dos diagonales que salen del centro o vuelven a él.
const OUT = [[13.75, 10.25], [20, 4]];
const out2 = (inward) =>
  [0, 180].flatMap((deg) => {
    const [a, b] = turn(OUT, deg);
    return inward ? arrow(b, a, 6) : arrow(a, b, 6);
  });
// Desplegar / plegar: una línea de pliegue y dos chevrons que se alejan o se acercan.
const fold = (open, deg) => {
  const ch = open
    ? [[[7.75, 8], [12, 3.75], [16.25, 8]], [[7.75, 16], [12, 20.25], [16.25, 16]]]
    : [[[7.75, 4], [12, 8.25], [16.25, 4]], [[7.75, 20], [12, 15.75], [16.25, 20]]];
  return [line(...turn([[4.25, 12], [19.75, 12]], deg)), ...ch.map((pts) => line(...turn(pts, deg)))];
};
// Esquinas de pantalla completa: la inferior derecha recta, como todo contenedor del set.
const CORNERS = [
  [[3.25, 8.75], [3.25, 3.25], [8.75, 3.25]],
  [[15.25, 3.25], [20.75, 3.25], [20.75, 8.75]],
  [[20.75, 15.25], [20.75, 20.75], [15.25, 20.75]],
  [[8.75, 20.75], [3.25, 20.75], [3.25, 15.25]],
];
const CORNERS_IN = [
  [[3.25, 8.75], [8.75, 8.75], [8.75, 3.25]],
  [[15.25, 3.25], [15.25, 8.75], [20.75, 8.75]],
  [[20.75, 15.25], [15.25, 15.25], [15.25, 20.75]],
  [[8.75, 20.75], [8.75, 15.25], [3.25, 15.25]],
];
const brackets = (inward) => (inward ? CORNERS_IN : CORNERS).map((pts, i) => cline(pts, [0, i === 2 ? 0 : 2.5, 0]));

// Ventana apaisada (19 × 14, radio 4, la firma abajo a la derecha) para paneles y barras.
const WIN = sq(2.5, 5, 19, 14, 4, { square: ['br'] });
// Celda pequeña de las vistas (3.5 de lado); la de abajo a la derecha lleva la firma, como en apps.
const cell = (x, y, br = false) => sq(x, y, 3.5, 3.5, 1.05, { square: br ? ['br'] : [] });

// Lupa del núcleo (search) para el zoom.
const LENS = [circ(10.6, 10.6, 6.85), line([15.6, 15.6], [20.5, 20.5])];

const icons = {
  // ── Flechas rectas ────────────────────────────────────────────────────────────────────
  'arrow-left': { tags: ['flecha', 'izquierda', 'atrás', 'arrow', 'left', 'back'], d: arrowR(...BIG, BIG_ARM, 180) },
  'arrow-up': { tags: ['flecha', 'arriba', 'subir', 'arrow', 'up'], d: arrowR(...BIG, BIG_ARM, -90) },
  'arrow-down': { tags: ['flecha', 'abajo', 'bajar', 'arrow', 'down'], d: arrowR(...BIG, BIG_ARM, 90) },
  'arrow-up-right': { tags: ['flecha', 'diagonal', 'arriba derecha', 'arrow', 'up right'], d: arrowR(...DIAG, DIAG_ARM, 0) },
  'arrow-down-right': { tags: ['flecha', 'diagonal', 'abajo derecha', 'arrow', 'down right'], d: arrowR(...DIAG, DIAG_ARM, 90) },
  'arrow-down-left': { tags: ['flecha', 'diagonal', 'abajo izquierda', 'arrow', 'down left'], d: arrowR(...DIAG, DIAG_ARM, 180) },
  'arrow-up-left': { tags: ['flecha', 'diagonal', 'arriba izquierda', 'arrow', 'up left'], d: arrowR(...DIAG, DIAG_ARM, -90) },

  // ── Flechas en círculo ────────────────────────────────────────────────────────────────
  'arrow-right-circle': { tags: ['flecha', 'círculo', 'siguiente', 'arrow', 'circle', 'next'], d: [RING, ...arrowR(...IN, IN_ARM, 0)] },
  'arrow-left-circle': { tags: ['flecha', 'círculo', 'anterior', 'arrow', 'circle', 'previous'], d: [RING, ...arrowR(...IN, IN_ARM, 180)] },
  'arrow-up-circle': { tags: ['flecha', 'círculo', 'subir', 'arrow', 'circle', 'up'], d: [RING, ...arrowR(...IN, IN_ARM, -90)] },
  'arrow-down-circle': { tags: ['flecha', 'círculo', 'bajar', 'arrow', 'circle', 'down'], d: [RING, ...arrowR(...IN, IN_ARM, 90)] },
  'arrow-up-right-circle': { tags: ['flecha', 'círculo', 'ir', 'arrow', 'circle', 'go'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 0)] },
  'arrow-down-right-circle': { tags: ['flecha', 'círculo', 'diagonal', 'arrow', 'circle', 'down right'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 90)] },
  'arrow-down-left-circle': { tags: ['flecha', 'círculo', 'entrante', 'arrow', 'circle', 'incoming'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 180)] },
  'arrow-up-left-circle': { tags: ['flecha', 'círculo', 'diagonal', 'arrow', 'circle', 'up left'], d: [RING, ...arrowR(...IN_DIAG, IN_DIAG_ARM, -90)] },

  // ── Flechas en cuadrado (contenedor con la firma) ─────────────────────────────────────
  'arrow-right-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'right'], d: [SQUARE, ...arrowR(...IN, IN_ARM, 0)] },
  'arrow-left-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'left'], d: [SQUARE, ...arrowR(...IN, IN_ARM, 180)] },
  'arrow-up-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'up'], d: [SQUARE, ...arrowR(...IN, IN_ARM, -90)] },
  'arrow-down-square': { tags: ['flecha', 'cuadrado', 'botón', 'arrow', 'square', 'down'], d: [SQUARE, ...arrowR(...IN, IN_ARM, 90)] },
  'arrow-up-right-square': { tags: ['flecha', 'cuadrado', 'abrir', 'arrow', 'square', 'open'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 0)] },
  'arrow-down-right-square': { tags: ['flecha', 'cuadrado', 'diagonal', 'arrow', 'square', 'down right'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 90)] },
  'arrow-down-left-square': { tags: ['flecha', 'cuadrado', 'entrante', 'arrow', 'square', 'down left'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, 180)] },
  'arrow-up-left-square': { tags: ['flecha', 'cuadrado', 'diagonal', 'arrow', 'square', 'up left'], d: [SQUARE, ...arrowR(...IN_DIAG, IN_DIAG_ARM, -90)] },

  // ── Flechas gruesas ───────────────────────────────────────────────────────────────────
  'arrow-thick-right': { tags: ['flecha gruesa', 'derecha', 'avanzar', 'arrow', 'bold', 'right'], d: thick(0) },
  'arrow-thick-left': { tags: ['flecha gruesa', 'izquierda', 'regresar', 'arrow', 'bold', 'left'], d: thick(180) },
  'arrow-thick-up': { tags: ['flecha gruesa', 'arriba', 'subir', 'arrow', 'bold', 'up'], d: thick(-90) },
  'arrow-thick-down': { tags: ['flecha gruesa', 'abajo', 'bajar', 'arrow', 'bold', 'down'], d: thick(90) },

  // ── Flechas contra una barra ──────────────────────────────────────────────────────────
  'arrow-up-to-line': { tags: ['ir al inicio', 'arriba', 'tope', 'scroll to top', 'arrow', 'top'], d: toLine(0) },
  'arrow-down-to-line': { tags: ['ir al final', 'abajo', 'fondo', 'scroll to bottom', 'arrow', 'bottom'], d: toLine(180) },
  'arrow-left-to-line': { tags: ['al inicio', 'izquierda', 'tope', 'arrow', 'start', 'left'], d: toLine(-90) },
  'arrow-right-to-line': { tags: ['al final', 'derecha', 'tabulador', 'arrow', 'end', 'tab'], d: toLine(90) },

  // ── Vueltas y curvas ──────────────────────────────────────────────────────────────────
  'arrow-turn-right': { tags: ['girar', 'vuelta', 'derecha', 'turn', 'corner', 'right'], d: turnArrow(TURN) },
  'arrow-turn-left': { tags: ['girar', 'vuelta', 'izquierda', 'turn', 'corner', 'left'], d: turnArrow(mirrorX(TURN)) },
  'arrow-turn-down-left': { tags: ['intro', 'entrar', 'retorno', 'enter', 'return', 'corner'], d: turnArrow(turn(TURN, 180)) },
  'arrow-turn-down-right': { tags: ['vuelta', 'abajo', 'derecha', 'turn', 'corner', 'indent'], d: turnArrow(mirrorX(turn(TURN, 180))) },
  'arrow-curve-right': { tags: ['curva', 'saltar', 'adelante', 'curve', 'skip', 'forward'], d: curveArrow(false) },
  'arrow-curve-left': { tags: ['curva', 'saltar', 'atrás', 'curve', 'skip', 'back'], d: curveArrow(true) },
  'undo': { tags: ['deshacer', 'regresar', 'atrás', 'undo', 'back'], d: uturn(UNDO) },
  'redo': { tags: ['rehacer', 'repetir', 'adelante', 'redo', 'forward'], d: uturn(mirrorX(UNDO)) },
  'history': {
    tags: ['historial', 'reciente', 'atrás en el tiempo', 'history', 'recent', 'back'],
    d: [HISTORY.d, head(HISTORY.end, HISTORY.tangent, 3.4), line([12, 7.75], [12, 12], [14.85, 13.75])],
  },

  // ── Dobles y mover ────────────────────────────────────────────────────────────────────
  'arrows-left-right': { tags: ['ancho', 'horizontal', 'ambos lados', 'arrows', 'left right', 'width'], d: [line([3.25, 12], [20.75, 12]), head([20.75, 12], [1, 0], 5 * R2), head([3.25, 12], [-1, 0], 5 * R2)] },
  'arrows-up-down': { tags: ['alto', 'vertical', 'ambos lados', 'arrows', 'up down', 'height'], d: [line([12, 3.25], [12, 20.75]), head([12, 3.25], [0, -1], 5 * R2), head([12, 20.75], [0, 1], 5 * R2)] },
  // Puntas de 3 por eje: con 3.5 los brazos vecinos quedaban a 2.5 y la cruz se leía como rombo.
  'move': {
    tags: ['mover', 'desplazar', 'cuatro direcciones', 'move', 'pan'],
    d: [line([3.25, 12], [20.75, 12]), line([12, 3.25], [12, 20.75]), ...[[20.75, 12], [3.25, 12], [12, 3.25], [12, 20.75]].map((t) => head(t, [t[0] - 12, t[1] - 12], 3 * R2))],
  },

  // ── Chevrons ──────────────────────────────────────────────────────────────────────────
  'chevron-up': { tags: ['subir', 'contraer', 'arriba', 'chevron', 'up', 'collapse'], d: [chev(-90)] },
  'chevron-down': { tags: ['bajar', 'desplegar', 'abajo', 'chevron', 'down', 'expand'], d: [chev(90)] },
  'chevrons-right': { tags: ['avanzar rápido', 'doble', 'derecha', 'chevrons', 'forward', 'next'], d: chev2(0) },
  'chevrons-left': { tags: ['regresar rápido', 'doble', 'izquierda', 'chevrons', 'rewind', 'previous'], d: chev2(180) },
  'chevrons-up': { tags: ['subir todo', 'doble', 'arriba', 'chevrons', 'up', 'top'], d: chev2(-90) },
  'chevrons-down': { tags: ['bajar todo', 'doble', 'abajo', 'chevrons', 'down', 'bottom'], d: chev2(90) },
  'chevron-up-down': { tags: ['selector', 'desplegable', 'elegir', 'select', 'dropdown', 'chevrons'], d: [line([7.75, 9.25], [12, 5], [16.25, 9.25]), line([7.75, 14.75], [12, 19], [16.25, 14.75])] },
  'chevron-left-right': { tags: ['deslizar', 'carrusel', 'anterior siguiente', 'chevrons', 'slide', 'horizontal'], d: [line([9.25, 7.25], [4.5, 12], [9.25, 16.75]), line([14.75, 7.25], [19.5, 12], [14.75, 16.75])] },
  'chevron-right-circle': { tags: ['siguiente', 'círculo', 'avanzar', 'chevron', 'circle', 'next'], d: [RING, chev(0, CHEV_IN)] },
  'chevron-left-circle': { tags: ['anterior', 'círculo', 'volver', 'chevron', 'circle', 'previous'], d: [RING, chev(180, CHEV_IN)] },
  'chevron-up-circle': { tags: ['subir', 'círculo', 'contraer', 'chevron', 'circle', 'up'], d: [RING, chev(-90, CHEV_IN)] },
  'chevron-down-circle': { tags: ['bajar', 'círculo', 'desplegar', 'chevron', 'circle', 'down'], d: [RING, chev(90, CHEV_IN)] },

  // ── Carets ────────────────────────────────────────────────────────────────────────────
  'caret-right': { tags: ['triángulo', 'derecha', 'disclosure', 'caret', 'triangle', 'right'], d: caret(0) },
  'caret-left': { tags: ['triángulo', 'izquierda', 'atrás', 'caret', 'triangle', 'left'], d: caret(180) },
  'caret-up': { tags: ['triángulo', 'arriba', 'contraer', 'caret', 'triangle', 'up'], d: caret(-90) },
  'caret-down': { tags: ['triángulo', 'abajo', 'desplegable', 'caret', 'triangle', 'dropdown'], d: caret(90) },
  'caret-up-down': {
    tags: ['ordenar', 'selector', 'triángulos', 'sort', 'caret', 'select'],
    d: [roundpoly([[7, 10.5], [12, 4], [17, 10.5]], [1.2, 1.4, 1.2]), roundpoly([[7, 13.5], [17, 13.5], [12, 20]], [1.2, 1.2, 1.4])],
  },

  // ── Paginación y orden ────────────────────────────────────────────────────────────────
  'page-first': { tags: ['primera página', 'inicio', 'paginación', 'first', 'page', 'start'], d: [line([6.5, 5.5], [6.5, 18.5]), line([17.5, 5.5], [11, 12], [17.5, 18.5])] },
  'page-last': { tags: ['última página', 'final', 'paginación', 'last', 'page', 'end'], d: [line([17.5, 5.5], [17.5, 18.5]), line([6.5, 5.5], [13, 12], [6.5, 18.5])] },
  'sort-ascending': { tags: ['ordenar', 'ascendente', 'menor a mayor', 'sort', 'ascending'], d: sortBars([3, 5, 7]) },
  'sort-descending': { tags: ['ordenar', 'descendente', 'mayor a menor', 'sort', 'descending'], d: sortBars([7, 5, 3]) },
  'sort': {
    tags: ['ordenar', 'orden', 'intercambiar vertical', 'sort', 'order', 'swap vertical'],
    d: [...arrow([8, 19.75], [8, 4.25], 3.75 * R2), ...arrow([16, 4.25], [16, 19.75], 3.75 * R2)],
  },
  'swap-horizontal': {
    tags: ['intercambiar', 'cambiar', 'transferir', 'swap', 'exchange', 'transfer'],
    d: [...arrow([4, 8], [20, 8], 4 * R2), ...arrow([20, 16], [4, 16], 4 * R2)],
  },

  // ── Tamaño y vista completa ───────────────────────────────────────────────────────────
  'maximize': { tags: ['maximizar', 'agrandar', 'ampliar', 'maximize', 'enlarge'], d: out2(false) },
  'minimize': { tags: ['minimizar', 'reducir', 'achicar', 'minimize', 'shrink'], d: out2(true) },
  'expand-vertical': { tags: ['desplegar', 'expandir', 'mostrar todo', 'expand', 'unfold'], d: fold(true, 0) },
  'collapse-vertical': { tags: ['plegar', 'contraer', 'ocultar', 'collapse', 'fold'], d: fold(false, 0) },
  'expand-horizontal': { tags: ['ensanchar', 'expandir', 'ancho', 'expand', 'widen'], d: fold(true, 90) },
  'collapse-horizontal': { tags: ['estrechar', 'contraer', 'angosto', 'collapse', 'narrow'], d: fold(false, 90) },
  'fullscreen': { tags: ['pantalla completa', 'expandir', 'ver todo', 'fullscreen', 'expand'], d: brackets(false) },
  'fullscreen-exit': { tags: ['salir de pantalla completa', 'reducir', 'fullscreen', 'exit', 'shrink'], d: brackets(true) },
  'fit-screen': { tags: ['encajar', 'ajustar a pantalla', 'zoom', 'fit', 'screen'], d: [...brackets(false), sq(8.25, 8.25, 7.5, 7.5, 2.25, { square: ['br'] })] },

  // ── Entrar, salir y enlaces ───────────────────────────────────────────────────────────
  'log-in': {
    tags: ['entrar', 'iniciar sesión', 'acceder', 'login', 'sign in'],
    d: [cline([[13.25, 3.25], [20.75, 3.25], [20.75, 20.75], [13.25, 20.75]], [0, 4.25, 0, 0]), ...arrow([3.25, 12], [14.75, 12], 4.5 * R2)],
  },
  'log-out': {
    tags: ['salir', 'cerrar sesión', 'logout', 'sign out', 'exit'],
    d: [cline([[10.75, 3.25], [3.25, 3.25], [3.25, 20.75], [10.75, 20.75]], [0, 4.25, 4.25, 0]), ...arrow([9.25, 12], [20.75, 12], 4.5 * R2)],
  },
  'external-link': {
    tags: ['enlace externo', 'abrir afuera', 'nueva pestaña', 'external', 'open', 'new tab'],
    d: [cline([[10.5, 5.25], [3.25, 5.25], [3.25, 20.75], [18.75, 20.75], [18.75, 13.5]], [0, 4, 4, 0, 0]), ...arrow([11, 13], [20.75, 3.25], 6.5)],
  },

  // ── Menús y asas ──────────────────────────────────────────────────────────────────────
  'menu': { tags: ['menú', 'hamburguesa', 'navegación', 'menu', 'hamburger'], d: [6.5, 12, 17.5].map((y) => line([3.75, y], [20.25, y])) },
  'menu-compact': { tags: ['menú', 'dos líneas', 'asa', 'reordenar', 'menu', 'compact', 'drag handle'], d: [9.25, 14.75].map((y) => line([3.75, y], [20.25, y])) },
  'more-vertical': { tags: ['más', 'opciones', 'kebab', 'more', 'vertical'], d: [5, 12, 19].map((y) => dot(12, y, 0.8)) },
  'more-circle': { tags: ['más', 'opciones', 'círculo', 'more', 'circle'], d: [RING, ...[7.5, 12, 16.5].map((x) => dot(x, 12))] },
  'grip-vertical': { tags: ['arrastrar', 'asa', 'reordenar', 'grip', 'drag', 'handle'], d: [9.25, 14.75].flatMap((x) => [5.5, 12, 18.5].map((y) => dot(x, y, 0.8))) },
  'grip-horizontal': { tags: ['arrastrar', 'asa', 'reordenar', 'grip', 'drag', 'handle'], d: [9.25, 14.75].flatMap((y) => [5.5, 12, 18.5].map((x) => dot(x, y, 0.8))) },

  // ── Barras laterales y paneles ────────────────────────────────────────────────────────
  'sidebar-left': { tags: ['barra lateral', 'panel izquierdo', 'navegación', 'sidebar', 'left'], d: [WIN, line([9.25, 5], [9.25, 19])] },
  'sidebar-right': { tags: ['barra lateral', 'panel derecho', 'inspector', 'sidebar', 'right'], d: [WIN, line([14.75, 5], [14.75, 19])] },
  'panel-bottom': { tags: ['panel inferior', 'consola', 'abajo', 'panel', 'bottom'], d: [WIN, line([2.5, 14], [21.5, 14])] },
  'panel-top': { tags: ['panel superior', 'barra', 'arriba', 'panel', 'top', 'header'], d: [WIN, line([2.5, 10], [21.5, 10])] },
  'sidebar-collapse': { tags: ['ocultar barra lateral', 'cerrar panel', 'sidebar', 'collapse', 'hide'], d: [WIN, line([9.25, 5], [9.25, 19]), line([16.9, 9.25], [14.15, 12], [16.9, 14.75])] },
  'sidebar-expand': { tags: ['mostrar barra lateral', 'abrir panel', 'sidebar', 'expand', 'show'], d: [WIN, line([9.25, 5], [9.25, 19]), line([14.15, 9.25], [16.9, 12], [14.15, 14.75])] },
  'split-view': { tags: ['dividir', 'dos paneles', 'comparar', 'split', 'view', 'compare'], d: [WIN, line([12, 5], [12, 19])] },
  // Una pestaña activa abierta al contenido y la tira de las demás: un solo divisor (con dos se
  // leía como una caja con etiqueta).
  'tabs': { tags: ['pestañas', 'navegador', 'secciones', 'tabs', 'browser'], d: [WIN, line([11.25, 5], [11.25, 9.75], [21.5, 9.75])] },

  // ── Vistas ────────────────────────────────────────────────────────────────────────────
  'view-grid': {
    tags: ['cuadrícula', 'mosaico', 'vista', 'grid', 'view', 'tiles'],
    d: [3.5, 10.25, 17].flatMap((y) => [3.5, 10.25, 17].map((x) => cell(x, y, x === 17 && y === 17))),
  },
  'view-list': { tags: ['lista', 'filas', 'vista', 'list', 'view', 'rows'], d: [3.5, 10.25, 17].flatMap((y) => [cell(3.5, y), line([10.25, y + 1.75], [20.5, y + 1.75])]) },
  'view-columns': { tags: ['columnas', 'tablero', 'vista', 'columns', 'view'], d: [SQUARE, line([9.1, 3.25], [9.1, 20.75]), line([14.9, 3.25], [14.9, 20.75])] },
  'view-cards': {
    tags: ['tarjetas', 'bloques', 'vista', 'cards', 'view', 'feed'],
    d: [sq(3.25, 3.25, 17.5, 7.25, 2.25), sq(3.25, 13.5, 17.5, 7.25, 2.25, { square: ['br'] })],
  },
  'view-carousel': {
    tags: ['carrusel', 'galería', 'deslizar', 'carousel', 'gallery', 'slides'],
    d: [sq(6.75, 4.25, 10.5, 15.5, 3, { square: ['br'] }), line([3.25, 7.5], [3.25, 16.5]), line([20.75, 7.5], [20.75, 16.5])],
  },

  // ── Filtro, inicio y scroll ───────────────────────────────────────────────────────────
  'filter': {
    tags: ['filtro', 'embudo', 'filtrar', 'filter', 'funnel'],
    d: [roundpoly([[3.25, 4.75], [20.75, 4.75], [14, 12.25], [14, 19.75], [10, 19.75], [10, 12.25]], [1.75, 1.75, 1, 1, 1, 1])],
  },
  'filter-lines': { tags: ['filtro', 'filtrar', 'refinar', 'filter', 'refine'], d: [line([3.75, 6.5], [20.25, 6.5]), line([6.75, 12], [17.25, 12]), line([9.75, 17.5], [14.25, 17.5])] },
  'home': {
    tags: ['inicio', 'casa', 'principal', 'home', 'house'],
    d: [roundpoly([[12, 3], [20.25, 9.6], [20.25, 20.75], [3.75, 20.75], [3.75, 9.6]], [2.25, 1.5, 0, 2.5, 1.5]), cline([[10, 20.75], [10, 14.75], [14, 14.75], [14, 20.75]], [0, 1.25, 1.25, 0])],
  },
  // El ratón de dispositivos con la rueda y la indicación de bajar.
  'scroll': { tags: ['desplazar', 'ratón', 'rueda', 'scroll', 'mouse', 'wheel'], d: [capsule(6.5, 3, 11, 18), line([12, 6.75], [12, 9.25]), line([9.5, 13], [12, 15.5], [14.5, 13])] },

  // ── Puntero, arrastre y zoom ──────────────────────────────────────────────────────────
  'cursor': { tags: ['cursor', 'puntero', 'seleccionar', 'pointer', 'select', 'arrow'], d: [cursor([6.4, 2.9], 1)] },
  'cursor-click': {
    tags: ['clic', 'puntero', 'pulsar', 'click', 'pointer', 'tap'],
    // El puntero del motor y tres destellos de 3.75 a 6 de su punta (sus extremos quedan a 1.5 de aire)
    d: [cursor([11, 8], 0.72), line([11, 4.25], [11, 2]), line([7.25, 8], [5, 8]), line([8.35, 5.35], [6.76, 3.76])],
  },
  'drag-drop': {
    tags: ['arrastrar y soltar', 'mover', 'seleccionar', 'drag', 'drop'],
    // El cuadro completo; el puntero va como insignia y el motor lo despeja con 1.5 de aire
    d: [sq(3.25, 3.25, 13, 13, 3.25)],
    badge: { d: [cursor([11.6, 9.4], 0.66)], knock: cursor([11.6, 9.4], 0.66), fill: { solid: [cursor([11.6, 9.4], 0.66)] } },
  },
  'crosshair': {
    tags: ['mira', 'apuntar', 'centrar', 'crosshair', 'target', 'focus'],
    d: [circ(12, 12, 6.75), line([12, 2.75], [12, 7.5]), line([12, 16.5], [12, 21.25]), line([2.75, 12], [7.5, 12]), line([16.5, 12], [21.25, 12])],
  },
  'zoom-in': { tags: ['acercar', 'ampliar', 'zoom', 'zoom in', 'magnify'], d: [...LENS, line([10.6, 7.85], [10.6, 13.35]), line([7.85, 10.6], [13.35, 10.6])] },
  'zoom-out': { tags: ['alejar', 'reducir', 'zoom', 'zoom out', 'magnify'], d: [...LENS, line([7.85, 10.6], [13.35, 10.6])] },

  // ── Cobertura (ronda 2): ventana, plantilla, mano, búsqueda y filtro ─────────────────
  // La ventana del set (la de `window-lock` y `page-not-found` de sistema): el cuadro con la firma y
  // su barra de título.
  'browser': {
    tags: ['navegador', 'ventana', 'sitio web', 'página web', 'browser', 'window', 'web page'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), line([3.25, 7.75], [20.75, 7.75])],
  },
  // Plantilla: la misma ventana con la barra lateral bajo la cabecera.
  'layout': {
    tags: ['diseño de página', 'plantilla', 'maqueta', 'estructura', 'layout', 'template', 'wireframe'],
    d: [sq(3.25, 3.25, 17.5, 17.5, 4, { square: ['br'] }), line([3.25, 7.75], [20.75, 7.75]), line([9.25, 7.75], [9.25, 20.75])],
  },
  // Mano que señala (enlace, tocar): un solo contorno cerrado. El índice arriba (3 de ancho), los
  // dedos doblados en un solo nudillo (con dos se leían como dientes a 18 px), la palma y el
  // pulgar que vuelve a la base del índice.
  'hand-pointer': {
    tags: ['mano', 'señalar', 'tocar', 'enlace', 'hand pointer', 'tap', 'touch'],
    d: ['M10.25 16V5a1.5 1.5 0 0 1 3 0V10.75a2.65 2.65 0 0 1 5.3 0V14.5c0 3.6-2.4 6.25-5.75 6.25h-1c-1.95 0-3.3-.9-4.3-2.45L6.1 15.4a1.4 1.4 0 0 1 2.3-1.6L10.25 16Z'],
  },
  // Sin resultados o borrar la búsqueda: la lupa del zoom con una x dentro (como el más y el menos).
  'search-x': {
    tags: ['sin resultados', 'borrar búsqueda', 'búsqueda vacía', 'no encontrado', 'no results', 'clear search', 'not found'],
    d: [...LENS, line([8.75, 8.75], [12.45, 12.45]), line([12.45, 8.75], [8.75, 12.45])],
  },
  // Quitar filtros: el embudo de `filter` al 78 % y corrido arriba a la izquierda (como la campana
  // de las insignias de comunicación), para que la insignia de cerrar del motor solo le tome la
  // punta del asta.
  'filter-x': {
    tags: ['quitar filtros', 'limpiar filtros', 'sin filtros', 'restablecer', 'clear filters', 'reset filters', 'remove filter'],
    d: [
      roundpoly(
        [[3.25, 4.75], [20.75, 4.75], [14, 12.25], [14, 19.75], [10, 19.75], [10, 12.25]].map(([x, y]) => [12 + (x - 12) * 0.78 - 2.25, 12 + (y - 12) * 0.78 - 2]),
        [1.75, 1.75, 1, 1, 1, 1].map((r) => r * 0.78),
      ),
    ],
    badge: badge('x'),
  },
};

// ── Relleno (DESIGN.md › Relleno): índices de `d` que se rellenan, se calan o siguen siendo línea.
// Las flechas, chevrons y menús hechos solo de líneas abiertas no llevan relleno.
const FILL = {
  'more-vertical': { solid: [0, 1, 2] },
  'more-circle': { solid: [0], cut: [1, 2, 3] },
  'grip-vertical': { solid: [0, 1, 2, 3, 4, 5] },
  'grip-horizontal': { solid: [0, 1, 2, 3, 4, 5] },
  'caret-right': { solid: [0] },
  'caret-left': { solid: [0] },
  'caret-up': { solid: [0] },
  'caret-down': { solid: [0] },
  'caret-up-down': { solid: [0, 1] },
  'arrow-thick-right': { solid: [0] },
  'arrow-thick-left': { solid: [0] },
  'arrow-thick-up': { solid: [0] },
  'arrow-thick-down': { solid: [0] },
  'fit-screen': { solid: [4], lines: [0, 1, 2, 3] },
  'sidebar-left': { solid: [0], cut: [1] },
  'sidebar-right': { solid: [0], cut: [1] },
  'panel-bottom': { solid: [0], cut: [1] },
  'panel-top': { solid: [0], cut: [1] },
  'sidebar-collapse': { solid: [0], cut: [1, 2] },
  'sidebar-expand': { solid: [0], cut: [1, 2] },
  'split-view': { solid: [0], cut: [1] },
  'tabs': { solid: [0], cut: [1] },
  // La ventana del navegador y la plantilla: el cuadro sólido con la cabecera (y la barra) calada.
  'browser': { solid: [0], cut: [1] },
  'layout': { solid: [0], cut: [1, 2] },
  'view-grid': { solid: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
  'view-list': { solid: [0, 2, 4], lines: [1, 3, 5] },
  'view-columns': { solid: [0], cut: [1, 2] },
  'view-cards': { solid: [0, 1] },
  'view-carousel': { solid: [0], lines: [1, 2] },
  'filter': { solid: [0] },
  // Quitar filtros: el embudo sólido; la insignia del motor trae su relleno (círculo sólido, x calada).
  'filter-x': { solid: [0] },
  'home': { solid: [0], cut: [1] },
  'scroll': { solid: [0], cut: [1, 2] },
  'cursor': { solid: [0] },
  'cursor-click': { solid: [0], lines: [1, 2, 3] },
  'drag-drop': { solid: [0] },
  'hand-pointer': { solid: [0] },
  // La mira rellena: el disco con los cuatro trazos que asoman (la parte de dentro se funde).
  'crosshair': { solid: [0, 1, 2, 3, 4] },
};
for (const name of ['right', 'left', 'up', 'down', 'up-right', 'down-right', 'down-left', 'up-left'])
  for (const form of ['circle', 'square']) FILL[`arrow-${name}-${form}`] = { solid: [0], cut: [1, 2] };
for (const name of ['right', 'left', 'up', 'down']) FILL[`chevron-${name}-circle`] = { solid: [0], cut: [1] };
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => icons[name].d[i]);
  icons[name].fill = { solid: pick(spec.solid), ...(spec.cut && { cut: pick(spec.cut) }), ...(spec.lines && { lines: pick(spec.lines) }) };
}
// Solo líneas abiertas (flechas, chevrons, menús, esquinas) y las lupas, como search del núcleo: su
// relleno es el mismo contorno.
for (const icon of Object.values(icons)) if (icon.fill === undefined) icon.fill = false;

// ── 16 px (DESIGN.md › 16 px): dibujos propios donde el ajuste al pixel no basta ──
// Un dibujo propio no se ajusta solo: sus tramos rectos van en centros de pixel (0.75 + 1.5k) y sus
// diagonales a 45° pasan por centros de pixel (x ± y múltiplo de 1.5), así caen nítidas y no grises.
// La cuadrícula: al ajustarse, las celdas de 3.5 quedaban de 2, 3 y 2 px y la del centro se
// empastaba. Tres celdas iguales de 3 px (4.5) con 1 px de aire entre ellas.
{
  const at = [2.25, 9.75, 17.25];
  const d = at.flatMap((y) => at.map((x) => sq(x, y, 4.5, 4.5, 1.25, { square: x === 17.25 && y === 17.25 ? ['br'] : [] })));
  icons['view-grid'].small = { d, fill: { solid: d } };
}
// Los puntos: centrados en el borde del pixel (múltiplos de 1.5) para que cada punto caiga entero
// en 2 × 2 pixeles y no se junte con el vecino. Con r 1: con r 0.7–0.8 el punto queda gris (≈ 50 %).
const SMALL_DOT = 1;
const dotsSmall = (pts) => {
  const d = pts.map(([x, y]) => dot(x, y, SMALL_DOT));
  return { d, fill: { solid: d } };
};
icons['more-vertical'].small = dotsSmall([4.5, 12, 19.5].map((y) => [12, y]));
icons['grip-vertical'].small = dotsSmall([9, 15].flatMap((x) => [6, 12, 18].map((y) => [x, y])));
icons['grip-horizontal'].small = dotsSmall([9, 15].flatMap((y) => [6, 12, 18].map((x) => [x, y])));
// Más en círculo: los mismos puntos de 2 × 2 px, con 1 px entre ellos; rellenos, calados.
{
  const dots = [7.5, 12, 16.5].map((x) => dot(x, 12, SMALL_DOT));
  icons['more-circle'].small = { d: [RING, ...dots], fill: { solid: [RING], cut: dots } };
}
// Vista de lista: al ajustarse, la celda de en medio medía 4 px y las otras 3, y se leía como un
// cero. Viñetas iguales de 3 × 3 px y renglones en centros de pixel, con 1 px de aire entre ellos.
{
  const ys = [2.25, 9.75, 17.25];
  const cells = ys.map((y) => sq(2.25, y, 3, 3, 0.6));
  const rows = ys.map((y) => line([9.75, y + 1.5], [20.25, y + 1.5]));
  icons['view-list'].small = { d: cells.flatMap((c, i) => [c, rows[i]]), fill: { solid: cells, lines: rows } };
}
// Los punteros: el del motor con la punta en un centro de pixel, así su canto vertical y su
// diagonal de 45° caen nítidos (corrido menos de 0.7; la escala no cambia).
{
  const p = cursor([6.75, 2.25], 1);
  icons.cursor.small = { d: [p], fill: { solid: [p] } };
}
{
  const p = cursor([11.25, 8.25], 0.72);
  const rays = [line([11.25, 3.75], [11.25, 2.25]), line([6.75, 8.25], [5.25, 8.25]), line([8.25, 5.25], [6.75, 3.75])];
  icons['cursor-click'].small = { d: [p, ...rays], fill: { solid: [p], lines: rays } };
}
{
  const box = sq(3.75, 3.75, 12, 12, 3);
  const p = cursor([11.25, 9.75], 0.66);
  icons['drag-drop'].small = { d: [box], fill: { solid: [box] }, badge: { d: [p], knock: p, fill: { solid: [p] } } };
}
// Los dos carets: a 16 px los triángulos rellenos se tocaban; bases en centros de pixel con 2 px
// de aire entre ellas.
{
  const d = [roundpoly([[7.5, 9.75], [12, 4.5], [16.5, 9.75]], [1, 1.2, 1]), roundpoly([[7.5, 14.25], [16.5, 14.25], [12, 19.5]], [1, 1, 1.2])];
  icons['caret-up-down'].small = { d, fill: { solid: d } };
}
// El scroll: a 16 px la rueda y el chevron se leían como una cara; la rueda se vuelve el asta
// de una flecha hacia abajo (brazos de 2.25: 3 de aire a los lados de la cápsula).
{
  const body = capsule(6.5, 3, 11, 18);
  const shaft = line([12, 6.75], [12, 15.75]);
  const tip = head([12, 15.75], [0, 1], 2.25 * R2);
  icons.scroll.small = { d: [body, shaft, tip], fill: { solid: [body], cut: [shaft, tip] } };
}
// Los selectores de dos chevrons: sus brazos de 4.25 caían entre pixeles y se veían grises y
// tenues. Brazos de 4.5 (3 px) por centros de pixel y 4 px de aire entre los dos.
icons['chevron-up-down'].small = { d: [line([7.5, 9], [12, 4.5], [16.5, 9]), line([7.5, 15], [12, 19.5], [16.5, 15])] };
icons['chevron-left-right'].small = { d: [line([9, 7.5], [4.5, 12], [9, 16.5]), line([15, 7.5], [19.5, 12], [15, 16.5])] };
// Desplegar y plegar: los mismos chevrons chicos, grises a 16 px. El pliegue en un centro de pixel
// (12.75, a donde lo lleva el ajuste) y los chevrons de 3 px simétricos a él, con 2 px de aire.
const foldSmall = (open, deg) => {
  const ch = open
    ? [[[7.5, 9], [12, 4.5], [16.5, 9]], [[7.5, 16.5], [12, 21], [16.5, 16.5]]]
    : [[[7.5, 4.5], [12, 9], [16.5, 4.5]], [[7.5, 21], [12, 16.5], [16.5, 21]]];
  return { d: [line(...turn([[3.75, 12.75], [20.25, 12.75]], deg)), ...ch.map((pts) => line(...turn(pts, deg)))] };
};
icons['expand-vertical'].small = foldSmall(true, 0);
icons['collapse-vertical'].small = foldSmall(false, 0);
icons['expand-horizontal'].small = foldSmall(true, 90);
icons['collapse-horizontal'].small = foldSmall(false, 90);
// Plegar y desplegar la barra lateral: el chevron de 2.75 se volvía una mancha de 2 pixeles. La
// ventana en centros de pixel y un chevron de 3 × 6 px, centrado en el panel con 1 px de aire.
{
  const win = sq(2.25, 5.25, 19.5, 13.5, 4, { square: ['br'] });
  const divider = line([9.75, 5.25], [9.75, 18.75]);
  for (const [name, pts] of [
    ['sidebar-collapse', [[18, 7.5], [13.5, 12], [18, 16.5]]],
    ['sidebar-expand', [[13.5, 7.5], [18, 12], [13.5, 16.5]]],
  ]) {
    const chevron = line(...pts);
    icons[name].small = { d: [win, divider, chevron], fill: { solid: [win], cut: [divider, chevron] } };
  }
}
// Sin resultados: la x de 3.7 se empastaba en una mancha dentro de la lupa (y una de 4 × 4 px se
// leía como un cuadro: su centro es de 2 × 2). Una x de 5 × 5 px con un solo pixel al centro, en
// una lupa de r 7.5 centrada en ese pixel, con 1.75 de aire al aro.
icons['search-x'].small = {
  d: [circ(9.75, 9.75, 7.5), line([15.25, 15.25], [20.25, 20.25]), line([6.75, 6.75], [12.75, 12.75]), line([12.75, 6.75], [6.75, 12.75])],
};
// Quitar filtros: la insignia de cerrar (círculo de 5.7 px) no cabe a 16 px y su x se volvía un
// cuadro gris. El embudo en centros de pixel y, en lugar de la insignia, una x de 5 × 5 px que el
// motor despeja igual (con 1 px de aire al asta).
{
  const funnel = roundpoly([[2.25, 3.75], [17.25, 3.75], [11.25, 9.75], [11.25, 15.75], [8.25, 15.75], [8.25, 9.75]], [1.1, 1.1, 0.75, 0.6, 0.6, 0.75]);
  const x = [line([14.25, 14.25], [20.25, 20.25]), line([20.25, 14.25], [14.25, 20.25])];
  icons['filter-x'].small = { d: [funnel], fill: { solid: [funnel] }, badge: { d: x, knock: x.join(''), fill: { solid: x } } };
}

// ── Espejo (DESIGN.md › Espejo): lo que tiene dirección de lectura se voltea en RTL ──
for (const name of [
  'arrow-left', 'arrow-up-right', 'arrow-down-right', 'arrow-down-left', 'arrow-up-left',
  ...['right', 'left', 'up-right', 'down-right', 'down-left', 'up-left'].flatMap((n) => [`arrow-${n}-circle`, `arrow-${n}-square`]),
  'arrow-thick-right', 'arrow-thick-left', 'arrow-left-to-line', 'arrow-right-to-line',
  'arrow-turn-right', 'arrow-turn-left', 'arrow-turn-down-left', 'arrow-turn-down-right', 'arrow-curve-right', 'arrow-curve-left',
  'undo', 'redo', 'chevrons-right', 'chevrons-left', 'chevron-right-circle', 'chevron-left-circle', 'caret-right', 'caret-left',
  'page-first', 'page-last', 'sort-ascending', 'sort-descending', 'log-in', 'log-out', 'external-link',
  'sidebar-left', 'sidebar-right', 'sidebar-collapse', 'sidebar-expand', 'tabs', 'view-list', 'layout',
])
  icons[name].mirror = true;

// ── Piezas con nombre (DESIGN.md › Piezas con nombre): lo que se mueve, cambia de estado o es una
// insignia. Vocabulario: `arrow` (asta y punta), `shape` (el círculo o cuadro que encierra, como
// important del núcleo), `chevron`, `caret`, `bar` (la línea contra la que llega una flecha), `window`.
const DIRS8 = ['right', 'left', 'up', 'down', 'up-right', 'down-right', 'down-left', 'up-left'];
const parts = (names, p) => {
  for (const n of names) icons[n].parts = p;
};
parts(DIRS8.filter((n) => n !== 'right').map((n) => `arrow-${n}`), { arrow: [0, 1] });
parts(DIRS8.flatMap((n) => [`arrow-${n}-circle`, `arrow-${n}-square`]), { shape: [0], arrow: [1, 2] });
parts(['right', 'left', 'up', 'down'].map((n) => `arrow-thick-${n}`), { arrow: [0] });
parts(['right', 'left', 'up', 'down'].map((n) => `arrow-${n}-to-line`), { bar: [0], arrow: [1, 2] });
parts(['arrow-turn-right', 'arrow-turn-left', 'arrow-turn-down-left', 'arrow-turn-down-right', 'arrow-curve-right', 'arrow-curve-left', 'undo', 'redo'], { arrow: [0, 1] });
parts(['history'], { arrow: [0, 1], hands: [2] });
// Los dos sentidos por separado: la tabla enciende el que está activo
parts(['sort'], { up: [0, 1], down: [2, 3] });
parts(['swap-horizontal'], { right: [0, 1], left: [2, 3] });
parts(['sort-ascending', 'sort-descending'], { arrow: [0, 1], bars: [2, 3, 4] });
parts(['maximize', 'minimize'], { arrow: [0, 1, 2, 3] });
parts(['chevron-up', 'chevron-down'], { chevron: [0] });
// El de atrás y el de adelante (el que apunta), para encenderlos uno tras otro
parts(['right', 'left', 'up', 'down'].map((n) => `chevrons-${n}`), { back: [0], front: [1] });
parts(['right', 'left', 'up', 'down'].map((n) => `chevron-${n}-circle`), { shape: [0], chevron: [1] });
parts(['chevron-up-down', 'caret-up-down'], { up: [0], down: [1] });
parts(['chevron-left-right'], { left: [0], right: [1] });
parts(['right', 'left', 'up', 'down'].map((n) => `caret-${n}`), { caret: [0] });
parts(['page-first', 'page-last'], { bar: [0], chevron: [1] });
parts(['fullscreen', 'fullscreen-exit'], { corners: [0, 1, 2, 3] });
parts(['fit-screen'], { corners: [0, 1, 2, 3], screen: [4] });
parts(['log-in', 'log-out'], { door: [0], arrow: [1, 2] });
parts(['external-link'], { frame: [0], arrow: [1, 2] });
parts(['more-circle'], { shape: [0], dots: [1, 2, 3] });
parts(['sidebar-left', 'sidebar-right', 'panel-bottom', 'panel-top', 'split-view'], { window: [0], divider: [1] });
parts(['sidebar-collapse', 'sidebar-expand'], { window: [0], divider: [1], chevron: [2] });
parts(['tabs'], { window: [0], tab: [1] });
parts(['browser'], { window: [0], header: [1] });
parts(['layout'], { window: [0], header: [1], sidebar: [2] });
parts(['filter', 'filter-x'], { funnel: [0] });
parts(['home'], { body: [0], door: [1] });
parts(['scroll'], { body: [0], wheel: [1], chevron: [2] });
parts(['cursor'], { pointer: [0] });
parts(['cursor-click'], { pointer: [0], rays: [1, 2, 3] });
parts(['drag-drop'], { box: [0] });
parts(['hand-pointer'], { hand: [0] });
parts(['crosshair'], { ring: [0], ticks: [1, 2, 3, 4] });
parts(['zoom-in', 'search-x'], { lens: [0], handle: [1], mark: [2, 3] });
parts(['zoom-out'], { lens: [0], handle: [1], mark: [2] });

// ── Movimiento (DESIGN.md › Movimiento): las flechas se deslizan hacia donde apuntan ──
const DIR = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1], 'up-right': [0.8, -0.8], 'down-right': [0.8, 0.8], 'down-left': [-0.8, 0.8], 'up-left': [-0.8, -0.8] };
const slide = ([x, y], k, moving) => ({ effect: 'slide', vector: [x * k, y * k], ...(moving && { parts: moving }) });
for (const [n, v] of Object.entries(DIR)) {
  if (n !== 'right') icons[`arrow-${n}`].motion = slide(v, 2.5);
  icons[`arrow-${n}-circle`].motion = slide(v, 1.5, ['arrow']);
  icons[`arrow-${n}-square`].motion = slide(v, 1.5, ['arrow']);
}
for (const n of ['right', 'left', 'up', 'down']) {
  icons[`arrow-thick-${n}`].motion = slide(DIR[n], 2.5);
  icons[`arrow-${n}-to-line`].motion = slide(DIR[n], 2, ['arrow']);
  icons[`chevrons-${n}`].motion = slide(DIR[n], 2);
  icons[`chevron-${n}-circle`].motion = slide(DIR[n], 1.5, ['chevron']);
  icons[`caret-${n}`].motion = slide(DIR[n], 1.5);
}
for (const n of ['up', 'down']) icons[`chevron-${n}`].motion = slide(DIR[n], 2);
for (const [name, n] of [['arrow-turn-right', 'right'], ['arrow-turn-left', 'left'], ['arrow-turn-down-left', 'left'], ['arrow-turn-down-right', 'right'], ['arrow-curve-right', 'right'], ['arrow-curve-left', 'left'], ['undo', 'left'], ['redo', 'right']])
  icons[name].motion = slide(DIR[n], 2);
icons['page-first'].motion = slide(DIR.left, 2, ['chevron']);
icons['page-last'].motion = slide(DIR.right, 2, ['chevron']);
icons['log-in'].motion = slide(DIR.right, 2, ['arrow']);
icons['log-out'].motion = slide(DIR.right, 2, ['arrow']);
icons['external-link'].motion = slide(DIR['up-right'], 1.75, ['arrow']);
icons['sidebar-collapse'].motion = slide(DIR.left, 1.5, ['chevron']);
icons['sidebar-expand'].motion = slide(DIR.right, 1.5, ['chevron']);
icons.scroll.motion = slide(DIR.down, 1.5, ['chevron']);
icons['drag-drop'].motion = slide(DIR['down-right'], 1.75, ['badge']);
// Ordenar: la flecha baja en el sentido del orden; las barras se quedan
icons['sort-ascending'].motion = slide(DIR.down, 1.5, ['arrow']);
icons['sort-descending'].motion = slide(DIR.down, 1.5, ['arrow']);
// Las manecillas giran (como clock del núcleo); los rayos del clic laten desde la punta.
icons.history.motion = { effect: 'spin', parts: ['hands'], origin: [12, 12] };
icons['cursor-click'].motion = { effect: 'beat', parts: ['rays'], origin: [11, 8] };
// Agrandar: el ícono late desde el centro; encajar: crece la pantalla dentro de sus esquinas;
// acercar: crece el más dentro de la lupa.
icons.maximize.motion = { effect: 'beat', origin: [12, 12] };
icons.fullscreen.motion = { effect: 'beat', origin: [12, 12] };
icons['fit-screen'].motion = { effect: 'beat', parts: ['screen'], origin: [12, 12] };
icons['zoom-in'].motion = { effect: 'beat', parts: ['mark'], origin: [10.6, 10.6] };
// Sin resultados: la lupa niega con un balanceo desde el mango; la mano toca hacia arriba; la mira
// late al fijar el blanco.
icons['search-x'].motion = { effect: 'wiggle', origin: [20.5, 20.5] };
icons['hand-pointer'].motion = { effect: 'bounce', vector: [0, -1.5] };
icons.crosshair.motion = { effect: 'beat', origin: [12, 12] };

// ── Variantes automáticas (DESIGN.md › Variantes) ──
const off = (names, v) => {
  for (const n of names) icons[n].variants = { ...icons[n].variants, ...v };
};
// Las ocho flechas ya tienen su versión en círculo y en cuadrado dibujada a mano.
off(['arrow-left', 'arrow-up', 'arrow-down', 'arrow-up-right', 'arrow-down-right', 'arrow-down-left', 'arrow-up-left'], { circle: false, square: false });
off(['chevron-up', 'chevron-down'], { circle: false });
// Ya vienen encerrados: ni en círculo ni en cuadrado (un círculo dentro de un cuadro no dice más).
off([...DIRS8.flatMap((n) => [`arrow-${n}-circle`, `arrow-${n}-square`]), 'chevron-right-circle', 'chevron-left-circle', 'chevron-up-circle', 'chevron-down-circle', 'more-circle'], { circle: false, square: false });
off(['history', 'crosshair'], { circle: false });
off(['view-columns', 'browser', 'layout'], { square: false });
// La cuadrícula de 3 × 3 deja de leerse al 58 %; las insignias (la x, el puntero) también, y el
// relleno encerrado no las dibuja.
off(['view-grid', 'filter-x', 'drag-drop'], { circle: false, square: false });
// Tachar una flecha, un chevron o una línea suelta no dice nada; tachar lo que ya niega (quitar
// filtros, sin resultados) tampoco.
off(
  Object.keys(icons).filter((n) => /^(arrow|arrows|chevron|chevrons|caret)-/.test(n)),
  { slash: false },
);
off(
  ['undo', 'redo', 'move', 'page-first', 'page-last', 'sort-ascending', 'sort-descending', 'sort', 'swap-horizontal', 'maximize', 'minimize', 'expand-vertical', 'collapse-vertical', 'expand-horizontal', 'collapse-horizontal', 'fullscreen', 'fullscreen-exit', 'fit-screen', 'log-in', 'log-out', 'external-link', 'menu', 'menu-compact', 'more-vertical', 'more-circle', 'grip-vertical', 'grip-horizontal', 'filter-lines', 'filter-x', 'search-x'],
  { slash: false },
);

export default { category: 'navegacion', label: 'Navegación', icons };
