// Ventanas y apps (windows and apps): the app window and its states, window management (stack,
// snap, move, minimize), the desktop's chrome (menu bar, dock, taskbar, workspaces), mobile
// screens, and the surfaces that float over a page (modal, dialog, popover, tooltip, toast,
// banner, drawer, sheets, command palette, lightbox, notifications). Everything comes from the
// engine (engine/geometry.mjs); see DESIGN.md.
//
// The window is the family's base: the set's square (Núcleo's keyline, radius 4, the signature
// corner) with a title bar 5.75 deep and its three controls (the dense dots, r 0.3) centered in
// it. Its body runs from the bar (9) to the bottom edge, so whatever sits in it lives between 12
// and 17.75 (1.5 of clearance to the bar and to the frame), centered on BODY. Anything that sits
// over another shape (a second window, a pin, a pointer, a sheet over a page) goes in `badge`: the
// base is drawn whole and the engine clears it; it is never trimmed by hand.
import { arc, badge, circ, cursor, dot, f, head, line, polar, rot, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import dispositivos from './dispositivos.mjs';
import nucleo from './nucleo.mjs';

const BR = { square: ['br'] };
const P = ([x, y]) => `${f(x)} ${f(y)}`;

/** Custom badge: what's drawn on top, the area the engine clears and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });
/** The area an open polyline clears: the line run there and back (it encloses nothing). */
const trace = (...pts) => `${line(...pts, ...pts.slice(0, -1).reverse())}Z`;
/** Just the `A…` of an arc (degrees, clockwise when a1 > a0), to chain it inside a path. */
const arcTo = (c, r, a0, a1) => arc(c[0], c[1], r, a0, a1).d.replace(/^M[^A]*/, '');

// Continuous corner (the same 0.6 smoothing as sq()): the measurements of a corner of radius r.
function corner(r, s = 0.6) {
  const p = (1 + s) * r;
  const a = 90 * (1 - s);
  const L = Math.sin(((a / 2) * Math.PI) / 180) * r * Math.SQRT2;
  const alpha = (90 - a) / 2;
  const p34 = r * Math.tan(((alpha / 2) * Math.PI) / 180);
  const beta = 45 * s;
  const c = p34 * Math.cos((beta * Math.PI) / 180);
  const d = c * Math.tan((beta * Math.PI) / 180);
  const b = (p - L - c - d) / 3;
  return { p, a: 2 * b, b, c, d, L, r };
}
/**
 * Open polyline with continuous corners at its 90° vertices (the ones sq() draws); `radius` is
 * one value or one per vertex, and 0 leaves the corner square (the signature corner).
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
    if (!rr[i]) {
      d += `L${P(V)}`;
      continue;
    }
    const u = unit(pts[i - 1], V);
    const v = unit(V, pts[i + 1]);
    const k = corner(rr[i]);
    const S = add(V, u, -k.p);
    const e1 = add(add(S, u, k.a + k.b + k.c), v, k.d);
    const e2 = add(add(e1, u, k.L), v, k.L);
    const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    d += `L${P(S)}C${P(add(S, u, k.a))} ${P(add(S, u, k.a + k.b))} ${P(e1)}`;
    d += `A${f(rr[i])} ${f(rr[i])} 0 0 ${sweep} ${P(e2)}`;
    d += `C${P(add(add(e2, u, k.d), v, k.c))} ${P(add(add(e2, u, k.d), v, k.b + k.c))} ${P(add(add(e2, u, k.d), v, k.a + k.b + k.c))}`;
  }
  return `${d}L${P(pts.at(-1))}`;
}
/**
 * The corners of a polyline rounded with circular arcs, as roundpoly() does for polygons (for
 * corners that aren't 90°: a cone's tip, a pointer's notch). Returns the `L…A…` run between the
 * first point (where the pen already is) and the last one.
 */
function rounded(pts, radius) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let o = '';
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = rr[i];
    if (!r) {
      o += `L${P(V)}`;
      continue;
    }
    const u = [A[0] - V[0], A[1] - V[1]];
    const w = [B[0] - V[0], B[1] - V[1]];
    const lu = Math.hypot(...u);
    const lw = Math.hypot(...w);
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    const t = r / Math.tan(th / 2);
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P([V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t])}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P([V[0] + (w[0] / lw) * t, V[1] + (w[1] / lw) * t])}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** Open polyline with circularly rounded corners. */
const rline = (pts, radius) => `M${P(pts[0])}${rounded(pts, radius)}`;
/**
 * A tool, an app or a start button where a hollow square doesn't fit: a square of 0.8 whose
 * stroke fills it at every weight (2.3 across at regular). Straight sides only: the round joins
 * already round its corners.
 */
const tool = (x, y) => `M${P([x - 0.4, y - 0.4])}h0.8v0.8h-0.8Z`;
/** Horizontal capsule (a pill): straight sides and half-circle ends. */
const capsule = (x, y, w, h) => {
  const r = h / 2;
  return `M${P([x + r, y])}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + w - r, y + h])}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${P([x + r, y])}Z`;
};
/**
 * A card with a pointer (a popover's, a tooltip's) on its top or bottom edge: the squircle with
 * a rounded triangle `depth` deep and `half` wide each side of `cx`, its tip rounded `tip` and its
 * joints with the edge `joint`.
 */
function pointed(x, y, w, h, r, { side, cx, half, depth, tip = 0.8, joint = 0.6 }) {
  const parts = sq(x, y, w, h, r, BR).split('L');
  const p = 1.6 * r;
  if (side === 'top') {
    const run = rounded([[x + p, y], [cx - half, y], [cx, y - depth], [cx + half, y], [x + w - p, y]], [0, joint, tip, joint, 0]);
    return `${parts.slice(0, 3).join('L')}L${parts[3].replace(/Z$/, '')}${run}Z`;
  }
  const run = rounded([[x + w, y + h], [cx + half, y + h], [cx, y + h + depth], [cx - half, y + h], [x + p, y + h]], [0, joint, tip, joint, 0]);
  return `${parts[0]}L${parts[1]}${run}${parts[2].replace(/^[-\d.]+ [-\d.]+/, '')}L${parts[3]}`;
}
/** Straight arrow from `a` to `b` with arms of `len` at 45°. */
const arrow = (a, b, len) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], len)];

// ── The window ──────────────────────────────────────────────────────────────────────────────
/**
 * A window: the frame (signature corner), its title bar `bar` below the top and, when it has
 * room, the three controls centered in the bar, 3.25 apart, the first 3.75 in from the left.
 */
const win = (x, y, w, h, r, { bar = 5.75, dots = true } = {}) => [
  sq(x, y, w, h, r, BR),
  line([x, y + bar], [x + w, y + bar]),
  ...(dots ? [0, 1, 2].map((i) => dot(x + 3.75 + 3.25 * i, y + bar / 2, 0.3)) : []),
];
const WINDOW = win(3.25, 3.25, 17.5, 17.5, 4);
const [FRAME] = WINDOW;
/** The middle of the window's body (between the bar at 9 and the bottom edge). */
const BODY = [12, 14.88];
/** The window with something in its body. */
const inWindow = (...d) => [...WINDOW, ...d];

// ── Screens ─────────────────────────────────────────────────────────────────────────────────
// The square screen (snap layouts, pages): the window's frame without its bar.
const SCREEN = sq(3.25, 3.25, 17.5, 17.5, 4, BR);
// A desktop's screen (menu bar, dock, taskbar): the landscape keyline.
const DESKTOP = sq(2.5, 5, 19, 14, 4, BR);
// A phone's or tablet's screen: the portrait keyline.
const PORTRAIT = sq(4.75, 2.75, 14.5, 18.5, 4, BR);

// Snap layouts: a tile inset 3 into the screen (1.5 of paper all round), in a half or a quarter
// split by the same 3. One rectangle, the left half: turned a quarter for the top half, cut to its
// top for the quarter, and placed by mirroring it; the tile is rebuilt in place so its signature
// corner stays at the bottom right.
const TILE_R = 1.25;
const snap = ([x, y, w, h], { flipX = false, flipY = false } = {}) => {
  const nx = flipX ? 24 - x - w : x;
  const ny = flipY ? 24 - y - h : y;
  return [SCREEN, sq(nx, ny, w, h, TILE_R, BR)];
};
const HALF_LEFT = [6.25, 6.25, 4.25, 11.5];
const HALF_TOP = [HALF_LEFT[1], HALF_LEFT[0], HALF_LEFT[3], HALF_LEFT[2]];
const QUARTER = [HALF_LEFT[0], HALF_LEFT[1], HALF_LEFT[2], HALF_LEFT[2]];

// ── Pieces ──────────────────────────────────────────────────────────────────────────────────
/**
 * Núcleo's pushpin, scaled by `s` and turned `deg` around the middle of its head, which lands on
 * `at`. Returns it as a custom badge: the head and the needle stay lines attached to the filled
 * body, and the engine clears what's under its hull.
 */
function pushpin(at, s, deg = 0) {
  const T = ([x, y]) => rot([at[0] + (x - 12) * s, at[1] + (y - 3.25) * s], at, deg);
  const capR = f(2.6 * s);
  const top = line(T([8.75, 3.25]), T([15.25, 3.25]));
  const body = `M${P(T([9.9, 3.25]))}L${P(T([9.4, 8.3]))}C${P(T([9.34, 8.9]))} ${P(T([9.07, 9.45]))} ${P(T([8.64, 9.87]))}L${P(T([6.6, 11.9]))}L${P(T([6.6, 12.75]))}L${P(T([17.4, 12.75]))}L${P(T([17.4, 11.9]))}L${P(T([15.36, 9.87]))}A${capR} ${capR} 0 0 1 ${P(T([14.6, 8.3]))}L${P(T([14.1, 3.25]))}`;
  const needle = line(T([12, 12.75]), T([12, 20.75]));
  // It clears its hull (head, body and needle tip): what lies between the body and the needle (a
  // corner of the window under it) goes with them instead of surviving as a sliver at some weights
  const hull = `M${[[8.75, 3.25], [15.25, 3.25], [17.4, 11.9], [17.4, 12.75], [12, 20.75], [6.6, 12.75], [6.6, 11.9]].map((p) => P(T(p))).join('L')}Z`;
  return own([top, body, needle], hull, { solid: [`${body}Z`], wire: [top, needle] });
}

/** Spaces: three small desktops, 3 apart, over the one in use. */
const SPACES = [3.25, 10.08, 16.92].map((x) => sq(x, 3.25, 3.83, 3.5, 1, BR)).concat(sq(3.25, 9.75, 17.5, 11, 3.5, BR));
/** A dialog: centered title and text over a rule, and the row of two buttons split by a divider. */
const DIALOG = [SCREEN, line([7.75, 7.25], [16.25, 7.25]), line([9.25, 10.25], [14.75, 10.25]), line([3.25, 13.5], [20.75, 13.5]), line([12, 13.5], [12, 20.75])];
/** The home screen's apps: four of the smallest tiles (2.75), 3 apart, the bottom-right one last. */
const HOME_TILES = [[7.75, 5.75], [13.5, 5.75], [7.75, 11.5], [13.5, 11.5]].map(([x, y]) => sq(x, y, 2.75, 2.75, 0.8, BR));
/** The notification card at `y`: its app tile and two lines of text. */
const notice = (y) => [sq(2.5, y, 19, 9.5, 3.25, BR), sq(5.5, y + 3, 3.5, 3.5, 1, BR), line([12, y + 3.25], [18.5, y + 3.25]), line([12, y + 6.25], [15.5, y + 6.25])];

const icons = {
  // ── The window and its badges ─────────────────────────────────────────────────────────────
  window: {
    tags: ['ventana', 'aplicación', 'app', 'window', 'application', 'desktop app'],
    d: WINDOW,
  },
  'window-plus': {
    tags: ['nueva ventana', 'abrir ventana', 'agregar', 'new window', 'open window'],
    d: WINDOW,
    badge: badge('plus'),
  },
  'window-x': {
    tags: ['cerrar ventana', 'salir', 'app cerrada', 'close window', 'quit', 'closed'],
    d: WINDOW,
    badge: badge('x'),
  },
  'window-gear': {
    tags: ['ajustes de la app', 'preferencias', 'configuración', 'app settings', 'preferences'],
    d: WINDOW,
    badge: badge('gear'),
  },
  'window-sync': {
    tags: ['recargar ventana', 'actualizando', 'sincronizar', 'reload window', 'updating', 'sync'],
    d: WINDOW,
    badge: badge('sync'),
  },
  'window-arrow-down': {
    tags: ['descargar app', 'instalar', 'app de escritorio', 'download app', 'install', 'desktop app'],
    d: WINDOW,
    badge: badge('arrow-down'),
  },
  'window-edit': {
    tags: ['personalizar', 'editar diseño', 'modo edición', 'customize', 'edit layout', 'edit mode'],
    d: WINDOW,
    badge: badge('edit'),
  },

  // ── Managing windows ──────────────────────────────────────────────────────────────────────
  // Cascade: the front window sits on the back one as a custom badge (the engine clears the back
  // one around it); behind it, only the back window's frame shows.
  'window-stack': {
    tags: ['ventanas', 'cascada', 'varias ventanas', 'windows', 'cascade', 'stacked'],
    d: [sq(3.25, 3.25, 13, 13, 3.25, BR)],
    badge: (() => {
      const front = win(7.75, 7.75, 13, 13, 3.25);
      return own(front, front[0], { solid: [front[0]], cut: front.slice(1) });
    })(),
  },
  // Mission Control: three windows of different sizes scattered off the grid (a large one at the
  // top left, a small one lower at the right, a wide one at the bottom), each with its bar 3 down
  // and 3 apart from the others. Lined up flush in two rows they read as a page layout.
  'window-overview': {
    tags: ['todas las ventanas', 'vista de tareas', 'mission control', 'task view', 'overview'],
    d: [...win(3.25, 3.25, 9.25, 8.75, 2.25, { bar: 3, dots: false }), ...win(15.5, 5.5, 5.75, 6, 1.75, { bar: 2.75, dots: false }), ...win(7.75, 15, 11, 6.25, 2, { bar: 3, dots: false })],
  },
  // Resize: two nested grips in the square corner, 3 apart: the outer one from edge to edge, the
  // inner one shorter and 3 clear of both edges (run edge to edge, it crossed the whole body).
  'window-resize': {
    tags: ['redimensionar', 'tamaño', 'agarradera', 'resize', 'grip', 'window size'],
    d: inWindow(line([20.75, 16.25], [16.25, 20.75]), line([17.75, 14.75], [14.75, 17.75])),
  },
  // Pick one window: the engine's pointer over the lower right of the window, its tail well across
  // the bottom edge and its wing 3.5 from the right one (the clearance either cuts an edge through
  // or stays off it, at every weight).
  'window-select': {
    tags: ['elegir ventana', 'compartir ventana', 'capturar ventana', 'select window', 'share window', 'capture'],
    d: WINDOW,
    badge: (() => {
      const p = cursor([13, 12.5], 0.42);
      return own([p], p, { solid: [p] });
    })(),
  },
  // Sheet: a narrower panel hanging from the title bar, its corner square like every container.
  'window-sheet': {
    tags: ['hoja', 'panel modal', 'guardar', 'sheet', 'modal panel', 'save dialog'],
    d: inWindow(cline([[7.75, 9], [7.75, 15.75], [16.25, 15.75], [16.25, 9]], [0, 2, 0, 0])),
  },
  // Pin a window on top: the whole window and Núcleo's pushpin (at half size, as social's post-pin)
  // standing at the badges' place, its needle down past the bottom edge. It clears the window's
  // corner from its head down, right of the needle: its slanted side alone ran along the right edge
  // and left a sliver of it that changed with the weight. Over the top-right corner the pin's
  // clearance took the controls, and a window shrunk to make room for it read as a folder.
  'window-pin': {
    tags: ['fijar ventana', 'siempre visible', 'encima', 'pin window', 'always on top', 'float'],
    d: WINDOW,
    badge: (() => {
      const pin = pushpin([17.25, 12.75], 0.5);
      return { ...pin, knock: `${pin.knock}M17.25 12.75H23V23H17.25Z` };
    })(),
  },
  // Pop out and merge back: a small window lifted off the large one's corner (a custom badge) and
  // a short 45° arrow in the large one's body, pointing toward it or back from it.
  'window-detach': {
    tags: ['abrir en ventana', 'desacoplar', 'ventana aparte', 'pop out', 'detach', 'new window'],
    d: [...win(3.25, 7.75, 13, 13, 3.25, { bar: 3.5, dots: false }), ...arrow([7.5, 17.75], [10.75, 14.5], 2.75)],
    badge: (() => {
      const small = win(13.25, 3.25, 7.5, 7.5, 2.25, { bar: 2.75, dots: false });
      return own(small, small[0], { solid: [small[0]], cut: [small[1]] });
    })(),
  },
  'window-attach': {
    tags: ['acoplar', 'unir ventanas', 'volver a la ventana', 'merge', 'attach', 'pop in'],
    d: [...win(3.25, 7.75, 13, 13, 3.25, { bar: 3.5, dots: false }), ...arrow([10.75, 14.5], [7.5, 17.75], 2.75)],
    badge: (() => {
      const small = win(13.25, 3.25, 7.5, 7.5, 2.25, { bar: 2.75, dots: false });
      return own(small, small[0], { solid: [small[0]], cut: [small[1]] });
    })(),
  },
  // Minimize: the arrow leaves the window through its bottom edge (which opens around it, as the
  // cloud does for cloud-download) and stops 3 above the dock. It starts 4 below the bar: its
  // clearance and the bar's cut stay apart in the fill at 2.1.
  'window-minimize': {
    tags: ['minimizar', 'al dock', 'barra de tareas', 'minimize', 'hide window', 'dock'],
    d: [...win(3.25, 3.25, 17.5, 12.5, 4), line([8, 21.25], [16, 21.25])],
    badge: (() => {
      const a = arrow([12, 13], [12, 18.25], 3.5);
      return own(a, `${trace([12, 13], [12, 18.25])}${a[1]}Z`);
    })(),
  },
  // Move to another display: the window and the empty screen side by side, the arrow under both.
  'window-move': {
    tags: ['mover a otra pantalla', 'otro monitor', 'escritorio', 'move window', 'other display', 'monitor'],
    d: [...win(2.5, 4.75, 7, 7.25, 2, { bar: 2.75, dots: false }), sq(12.25, 3.75, 9.25, 8.25, 2.5, BR), ...arrow([4.5, 18], [19.5, 18], 4)],
  },

  // ── App states ────────────────────────────────────────────────────────────────────────────
  'window-loading': {
    tags: ['cargando', 'pantalla de carga', 'espera', 'loading', 'loading screen', 'busy'],
    d: inWindow(arc(BODY[0], BODY[1], 2.75, -90, 180).d),
  },
  // Empty: an open tray seen from the front, its rim turned out (its corner square).
  'window-empty': {
    tags: ['vacío', 'sin contenido', 'nada aquí', 'empty state', 'no content', 'nothing here'],
    d: inWindow(cline([[6.75, 13.5], [8.25, 13.5], [8.25, 17.5], [15.75, 17.5], [15.75, 13.5], [17.25, 13.5]], [0, 0, 1.25, 0, 0, 0])),
  },
  'window-alert': {
    tags: ['error', 'algo salió mal', 'falla', 'error state', 'something went wrong', 'failure'],
    d: WINDOW,
    badge: badge('alert'),
  },
  'window-block': {
    tags: ['acceso bloqueado', 'prohibido', 'restringido', 'blocked', 'forbidden', 'restricted'],
    d: WINDOW,
    badge: badge('block'),
  },
  'window-check': {
    tags: ['éxito', 'listo', 'completado', 'success', 'done', 'completed'],
    d: WINDOW,
    badge: badge('check'),
  },
  // Maintenance: an open-ended wrench (its jaw a broken ring, the handle a line) lying at 30°.
  'window-maintenance': {
    tags: ['mantenimiento', 'en reparación', 'fuera de servicio', 'maintenance', 'down for maintenance', 'repair'],
    d: inWindow(arc(15, 14, 2, 20, 280).d, line(polar(15, 14, 2, 150), [8.94, 17.5])),
  },
  // Coming soon: a traffic cone on its base in front of the window (a custom badge: the engine
  // opens the window around it). With a stripe across it, or in the body alone, the cone read as a
  // letter; its rounded tip stands 4 below the bar, so their clearance and cut stay apart in the
  // fill at 2.1. Filled, the base's top edge is cut out: solid against it, the cone ran into one
  // bell-shaped blot.
  'window-construction': {
    tags: ['en construcción', 'próximamente', 'en obra', 'under construction', 'coming soon', 'work in progress'],
    d: WINDOW,
    badge: (() => {
      const cone = rline([[9.25, 18.75], [11.5, 13], [12.5, 13], [14.75, 18.75]], [0, 0.6, 0.6, 0]);
      const base = sq(7.5, 18.75, 9, 3, 1, BR);
      return own([cone, base], `${cone}Z${base}`, { solid: [`${cone}Z`, base], cut: [line([7.5, 18.75], [16.5, 18.75])] });
    })(),
  },
  // Crash: a crack zigzags down the body from the bar to the bottom edge (four runs at 23°).
  'window-crash': {
    tags: ['la app falló', 'se cerró', 'no responde', 'crash', 'not responding', 'app crashed'],
    d: inWindow(line(...[11.4, 12.65, 11.4, 12.65, 11.4].map((x, i) => [x, 9 + 2.94 * i]))),
  },
  'window-pause': {
    tags: ['en pausa', 'suspendido', 'pausado', 'paused', 'suspended', 'on hold'],
    d: inWindow(line([10.25, 12], [10.25, 17.75]), line([13.75, 12], [13.75, 17.75])),
  },

  // ── Window chrome ─────────────────────────────────────────────────────────────────────────
  // The status bar: the whole window (the family's base, bar and controls) with a thin strip along
  // its bottom, 3 deep, under its title bar's 5.75. A window without its bar broke the family, and a
  // strip deep enough for a dot and a line made three equal bands that read as a page layout. The
  // strip's left end sits on the corner's curve (0.15 in at 3 above the bottom), not past it.
  'status-bar': {
    tags: ['barra de estado', 'pie de ventana', 'estado', 'status bar', 'footer', 'state'],
    d: inWindow(line([3.4, 17.75], [20.75, 17.75])),
  },
  // The title bar alone: the top of a window (rounded above, square below, with no body under it),
  // its three controls and a short title.
  'title-bar': {
    tags: ['barra de título', 'título de ventana', 'controles', 'title bar', 'window title', 'header'],
    d: [sq(2.5, 8.5, 19, 7, 3, { square: ['bl', 'br'] }), ...[6.25, 9.5, 12.75].map((x) => dot(x, 12, 0.3)), line([16, 12], [18.5, 12])],
  },
  // The window's buttons on their own: three rings the size of the sliders' knobs, 3 apart.
  'window-controls': {
    tags: ['botones de ventana', 'cerrar minimizar', 'semáforo', 'window controls', 'window buttons', 'traffic lights'],
    d: [4.75, 12, 19.25].map((x) => circ(x, 12, 2.15)),
  },
  // Toolbar: a floating capsule with three tools (squares small enough to stay solid at every
  // weight: hollow ones don't fit three across with their clearances).
  toolbar: {
    tags: ['barra de herramientas', 'herramientas', 'acciones', 'toolbar', 'tools', 'actions'],
    d: [capsule(2.5, 8.5, 19, 7), ...[7.5, 12, 16.5].map((x) => tool(x, 12))],
  },
  // Remote desktop: a monitor (screen, stem and foot) in front of the window's corner (a custom
  // badge: the engine clears the window around the screen and the box under it, out to the corner,
  // so no sliver of the corner survives). In the body it came out too small to read.
  'remote-desktop': {
    tags: ['escritorio remoto', 'control remoto', 'otra computadora', 'remote desktop', 'remote access', 'vnc'],
    d: WINDOW,
    badge: (() => {
      const screen = sq(12.25, 12.5, 9.25, 6, 1.75, BR);
      const stem = line([16.88, 18.5], [16.88, 20.75]);
      const foot = line([14.5, 20.75], [19.25, 20.75]);
      return own([screen, stem, foot], `${screen}M14.5 18.5H20.75V20.75H14.5Z`, { solid: [screen], wire: [stem, foot] });
    })(),
  },

  // ── Screens and launch states ─────────────────────────────────────────────────────────────
  // Skeleton: hollow placeholders, 3 apart: the avatar beside a long bar, two bars below.
  'skeleton-screen': {
    tags: ['esqueleto', 'cargando contenido', 'marcador de posición', 'skeleton', 'placeholder', 'shimmer'],
    d: [circ(5.75, 5.75, 2.5), capsule(11.25, 4.25, 9.5, 3), capsule(3.25, 11.25, 17.5, 3), capsule(3.25, 17.25, 11.5, 3)],
  },
  // Splash: the app's tile alone in the middle of the screen, a short loading bar below it.
  'splash-screen': {
    tags: ['pantalla de inicio', 'arranque', 'abrir app', 'splash screen', 'launch screen', 'app launch'],
    d: [PORTRAIT, sq(9, 7.5, 6, 6, 1.75, BR), line([10.25, 17.5], [13.75, 17.5])],
  },
  // Ghost: a dome, straight sides and a hem of five half waves (r 1.35), the eyes Núcleo's dots.
  ghost: {
    tags: ['fantasma', 'no encontrado', 'nada aquí', 'vacío', 'ghost', 'not found', 'missing'],
    d: [
      `M5.25 10.75${arcTo([12, 10.75], 6.75, 180, 360)}V18.5${[0, 1, 2, 3, 4].map((i) => arcTo([17.4 - 2.7 * i, 18.5], 1.35, 0, i % 2 ? -180 : 180)).join('')}Z`,
      dot(9.6, 11.25),
      dot(14.4, 11.25),
    ],
  },

  // ── The desktop ───────────────────────────────────────────────────────────────────────────
  // Menu bar: a strip along the top of the screen, the logo at its left end (the taskbar's start
  // button) and two status items at its right. With three dots alone in it, it read as the window
  // turned around.
  'menu-bar': {
    tags: ['barra de menús', 'menú superior', 'íconos de estado', 'menu bar', 'status items', 'tray'],
    d: [DESKTOP, line([2.5, 10.75], [21.5, 10.75]), tool(7.25, 7.88), dot(14.5, 7.88, 0.3), dot(17.75, 7.88, 0.3)],
  },
  // Dock: the bar with three apps sits on the screen's bottom edge (a custom badge: the engine
  // opens the edge around it). Inside the screen, the box it needs for its apps filled the middle
  // and read as a cassette.
  dock: {
    tags: ['dock', 'barra de apps', 'lanzador', 'app dock', 'launcher', 'favorites'],
    d: [DESKTOP],
    badge: (() => {
      const bar = sq(5.25, 14.75, 13.5, 5.75, 2, BR);
      const apps = [8, 12, 16].map((x) => dot(x, 17.63, 0.3));
      return own([bar, ...apps], bar, { solid: [bar], cut: apps });
    })(),
  },
  // Taskbar: a full strip along the bottom, the start button and two apps on its axis.
  taskbar: {
    tags: ['barra de tareas', 'inicio', 'apps abiertas', 'taskbar', 'start', 'open apps'],
    d: [DESKTOP, line([2.5, 13.25], [21.5, 13.25]), tool(6.25, 16.13), dot(9.5, 16.13, 0.3), dot(12.75, 16.13, 0.3)],
  },
  // Pin to the taskbar: Núcleo's pushpin (at 70 %) standing on the strip, its needle 1.75 into it
  // (the clearance opens the strip's edge with straight cuts).
  'taskbar-pin': {
    tags: ['anclar a la barra', 'fijar en el dock', 'mantener', 'pin to taskbar', 'keep in dock', 'pin app'],
    d: [sq(2.5, 14.25, 19, 6.5, 3, BR), tool(6.25, 17.5)],
    badge: pushpin([12.75, 3.75], 0.7),
  },
  // Spaces: a row of three small desktops over the one in use.
  workspaces: {
    tags: ['escritorios virtuales', 'espacios', 'cambiar de escritorio', 'workspaces', 'virtual desktops', 'spaces'],
    d: SPACES,
  },
  'workspaces-plus': {
    tags: ['nuevo escritorio', 'agregar espacio', 'más escritorios', 'add desktop', 'new workspace', 'add space'],
    d: SPACES,
    badge: badge('plus'),
  },
  // App switcher: the panel with the selected app's tile in the middle and the apps beside it.
  'app-switcher': {
    tags: ['cambiar de app', 'alt tab', 'apps recientes', 'app switcher', 'cmd tab', 'recent apps'],
    d: [sq(2.5, 6.75, 19, 10.5, 3.5, BR), sq(9.75, 9.75, 4.5, 4.5, 1.25, BR), tool(6.35, 12), tool(17.65, 12)],
  },

  // ── Phones and tablets ────────────────────────────────────────────────────────────────────
  // Home screen: four app tiles (the smallest container, 2.75) 3 apart at the top of the screen.
  // A dock line under them read as a mouth: the screen was a face.
  'home-screen': {
    tags: ['pantalla de inicio', 'lanzador', 'apps del teléfono', 'home screen', 'launcher', 'springboard'],
    d: [PORTRAIT, ...HOME_TILES],
  },
  // Add to the home screen: the badge takes the second row's place. Its third tile's corner stood
  // 0.15 of ink from the badge's clearance in the fill, and at 0.9 they met.
  'home-screen-plus': {
    tags: ['agregar a inicio', 'instalar app web', 'acceso directo', 'add to home screen', 'install web app', 'pwa'],
    d: [PORTRAIT, ...HOME_TILES.slice(0, 2)],
    badge: badge('plus'),
  },
  // Add an app: Núcleo's apps with a plus where the fourth tile was, 3 from its neighbors.
  'apps-plus': {
    tags: ['agregar app', 'integración', 'instalar', 'catálogo', 'add app', 'add integration', 'install'],
    d: [...nucleo.icons.apps.d.slice(0, 3), line([17, 13.75], [17, 20.25]), line([13.75, 17], [20.25, 17])],
  },
  // Shortcut: an app tile with a small arc arrow in its lower-left corner (head of 3.4, as on arcs).
  'app-shortcut': {
    tags: ['acceso directo', 'alias', 'atajo', 'shortcut', 'alias', 'desktop shortcut'],
    d: (() => {
      const a = arc(11.75, 17.5, 4.5, 180, 270);
      return [SCREEN, a.d, head(a.end, a.tangent, 3.4)];
    })(),
  },
  // Widgets: three of Núcleo's app tiles and the fourth, smaller, turned 45° and lifted off the
  // grid (its square corner points down, the drop's).
  widgets: {
    tags: ['widgets', 'complementos', 'mini apps', 'widgets', 'add-ons', 'gadgets'],
    d: [...nucleo.icons.apps.d.slice(1, 3), nucleo.icons.apps.d[3], turnPath(sq(14.75, 3, 6, 6, 1.75, BR), 45, [17.75, 6])],
  },
  'lock-screen': {
    tags: ['pantalla de bloqueo', 'bloqueado', 'fondo de bloqueo', 'lock screen', 'locked', 'wallpaper'],
    d: [PORTRAIT, sq(9.5, 9, 5, 3.75, 1.2, BR), `M10.5 9V7.25${arcTo([12, 7.25], 1.5, 180, 360)}V9`, line([8.75, 15.75], [15.25, 15.75])],
  },
  // Quick settings: a round toggle and a square one beside a slider, as in a control center (over
  // a slider, two toggles side by side read as a face).
  'quick-settings': {
    tags: ['ajustes rápidos', 'centro de control', 'interruptores', 'quick settings', 'control center', 'toggles'],
    d: [SCREEN, circ(7.85, 7.85, 1.6), sq(6.25, 14.5, 3.25, 3.25, 1, BR), line([15.75, 6.25], [15.75, 14.55]), circ(15.75, 16.15, 1.6)],
  },
  // Split screen: two equal panes stacked on the portrait keyline, 6 apart, the divider's handle
  // between them on the canvas's center line.
  'split-screen': {
    tags: ['pantalla dividida', 'multitarea', 'dos apps', 'split screen', 'multitasking', 'side by side'],
    d: [sq(4.75, 2.75, 14.5, 6.25, 3, BR), sq(4.75, 15, 14.5, 6.25, 3, BR), line([10.25, 12], [13.75, 12])],
  },
  // ── Surfaces over a page ──────────────────────────────────────────────────────────────────
  // Modal: a box floating in the middle of the page, its button bar along its bottom.
  modal: {
    tags: ['modal', 'ventana emergente', 'superpuesto', 'modal', 'popup', 'overlay'],
    d: [SCREEN, sq(7.25, 7.25, 9.5, 9.5, 2.5, BR), line([10.25, 13.75], [13.75, 13.75])],
  },
  // Dialog: a centered title and line of text over a row of two buttons, split off by a rule
  // across the box and a divider between them. Two pill buttons side by side read as eyes.
  dialog: {
    tags: ['diálogo', 'confirmar', 'cancelar', 'dialog', 'confirm', 'prompt'],
    d: DIALOG,
  },
  // Alert dialog: the same dialog; the badge takes the second button and the divider.
  'dialog-alert': {
    tags: ['alerta', 'confirmación destructiva', 'advertencia', 'alert dialog', 'warning', 'destructive'],
    d: DIALOG,
    badge: badge('alert'),
  },
  // Popover: a card with two lines of content whose pointer, on its top edge, aims at the button it
  // opened from (a pill above it), both toward the start of the line. The card's corners are 2.5 so
  // the pointer (45°, 2 deep) has a straight run of edge each side. An empty card under a dot read
  // as a hanging frame; centered under the pill, as a figure.
  popover: {
    tags: ['popover', 'tarjeta flotante', 'globo', 'popover', 'hover card', 'flyout'],
    d: [pointed(3.25, 10.5, 17.5, 10.25, 2.5, { side: 'top', cx: 9.75, half: 2, depth: 2, joint: 0.5 }), capsule(6.75, 2.75, 6, 3), line([7.25, 14.25], [16.75, 14.25]), line([7.25, 17.25], [13.25, 17.25])],
  },
  // Tooltip: a small label with one line, its pointer on the bottom edge.
  tooltip: {
    tags: ['información emergente', 'pista', 'ayuda', 'tooltip', 'hint', 'hover'],
    d: [pointed(3.25, 5.5, 17.5, 10.5, 3.25, { side: 'bottom', cx: 12, half: 2, depth: 2 }), line([8, 10.75], [16, 10.75])],
  },
  // Toast: a pill floating over the page's bottom-right corner (a custom badge: the engine clears
  // the page under it), its dot at the left end and a short line of text. Inside the page, the pill
  // read as a face's mouth; centered on the bottom edge, as the dock.
  toast: {
    tags: ['aviso breve', 'mensaje flotante', 'notificación', 'toast', 'snackbar', 'flash message'],
    d: [SCREEN],
    badge: (() => {
      const pill = capsule(7.25, 15.5, 13.5, 6);
      const message = [dot(10.25, 18.5, 0.3), line([13.25, 18.5], [17.75, 18.5])];
      return own([pill, ...message], pill, { solid: [pill], cut: message });
    })(),
  },
  // Banner: a strip inset across the top of the page, one line in it.
  banner: {
    tags: ['anuncio', 'banner', 'barra de aviso', 'announcement', 'banner', 'notice bar'],
    d: [SCREEN, sq(6.25, 6.25, 11.5, 6, 2, BR), line([9.25, 9.25], [14.75, 9.25])],
  },
  // Inline alert: a box in the content, the accent bar inside its left edge and a line of text.
  'inline-alert': {
    tags: ['alerta en línea', 'aviso', 'nota destacada', 'inline alert', 'callout', 'notice'],
    d: [sq(2.5, 7, 19, 10, 3, BR), line([5.5, 10], [5.5, 14]), line([8.5, 12], [18.5, 12])],
  },
  // Drawer: a tall panel over the page's right side (a custom badge: the page is cleared under it).
  drawer: {
    tags: ['cajón', 'panel lateral', 'vista lateral', 'drawer', 'side sheet', 'side peek'],
    d: [sq(2.5, 4.75, 14, 14.5, 3.25, BR)],
    badge: (() => {
      const panel = sq(11.75, 2.75, 9.75, 18.5, 3.25, BR);
      return own([panel], panel, { solid: [panel] });
    })(),
  },
  // Bottom sheet: the sheet's top edge across the lower half of the screen, its grabber below it.
  // With rounded corners its sides ran down the screen's own edges, and the slivers between their
  // curves closed up at heavy weights.
  'bottom-sheet': {
    tags: ['hoja inferior', 'panel inferior', 'deslizar', 'bottom sheet', 'drawer', 'mobile sheet'],
    d: [PORTRAIT, line([4.75, 12], [19.25, 12]), line([10.5, 15], [13.5, 15])],
  },
  // Action sheet: a block of two options above a separate cancel button.
  'action-sheet': {
    tags: ['hoja de acciones', 'opciones', 'cancelar', 'action sheet', 'options', 'choices'],
    d: [PORTRAIT, sq(8.25, 6.75, 7.5, 5.5, 2, BR), line([8.25, 9.5], [15.75, 9.5]), capsule(9, 15.25, 6, 3)],
  },
  // Command palette: the search row (a magnifier and a line) over two results.
  'command-palette': {
    tags: ['paleta de comandos', 'búsqueda rápida', 'cmd k', 'command palette', 'quick search', 'spotlight'],
    d: [PORTRAIT, circ(9, 7.1, 1.4), line(polar(9, 7.1, 1.4, 45), [11.5, 9.6]), line([13.25, 7.1], [16.25, 7.1]), line([4.75, 12.5], [19.25, 12.5]), line([8.5, 15.4], [16.25, 15.4]), line([8.5, 18.3], [13.5, 18.3])],
  },
  // Lightbox: the photo (a sun and a slope, 45° each way, from the left edge to the bottom one)
  // with a small chevron at each side. Without the page around it: with one, the chevrons left no
  // room for the photo between them and their clearances.
  lightbox: {
    tags: ['visor de imágenes', 'galería', 'ampliar foto', 'lightbox', 'image viewer', 'gallery'],
    d: [sq(7.25, 6.75, 9.5, 10.5, 2, BR), dot(13.5, 9.75), rline([[7.25, 13.75], [9.75, 11.25], [15.75, 17.25]], [0, 0.75, 0]), line([4.25, 10.25], [2.5, 12], [4.25, 13.75]), line([19.75, 10.25], [21.5, 12], [19.75, 13.75])],
  },

  // ── Notifications ─────────────────────────────────────────────────────────────────────────
  notification: {
    tags: ['notificación', 'aviso', 'alerta', 'notification', 'alert', 'push'],
    d: notice(7.25),
  },
  // Stacked: the card on top, the two behind it peeking below as their edges.
  'notification-stack': {
    tags: ['notificaciones agrupadas', 'centro de notificaciones', 'avisos', 'notification center', 'grouped', 'stack'],
    d: [...notice(3.25), line([5, 15.75], [19, 15.75]), line([7.5, 18.75], [16.5, 18.75])],
  },
  // With a badge the card moves up, so the badge takes only its corner (not its lines).
  'notification-x': {
    tags: ['descartar', 'borrar notificaciones', 'cerrar aviso', 'dismiss', 'clear notifications', 'close'],
    d: notice(3.25),
    badge: badge('x'),
  },
  'notification-check': {
    tags: ['marcar como leído', 'al día', 'sin pendientes', 'mark as read', 'all caught up', 'read'],
    d: notice(3.25),
    badge: badge('check'),
  },
  // Push: the set's smartphone (dispositivos', with its speaker slot) and the engine's notification
  // dot on its corner. A card wider than the phone across its top read as a printer, and the bare
  // portrait screen with the dot was comunicación's notification-badge on another keyline.
  'push-notification': {
    tags: ['notificación push', 'aviso en el teléfono', 'móvil', 'push notification', 'mobile', 'phone alert'],
    d: dispositivos.icons.smartphone.d,
    badge: badge('dot'),
  },
  // ── Snap layouts ──────────────────────────────────────────────────────────────────────────
  'window-snap-left': { tags: ['acomodar a la izquierda', 'mitad izquierda', 'dividir', 'snap left', 'tile left', 'left half'], d: snap(HALF_LEFT) },
  'window-snap-right': { tags: ['acomodar a la derecha', 'mitad derecha', 'dividir', 'snap right', 'tile right', 'right half'], d: snap(HALF_LEFT, { flipX: true }) },
  'window-snap-top': { tags: ['acomodar arriba', 'mitad superior', 'dividir', 'snap top', 'tile top', 'top half'], d: snap(HALF_TOP) },
  'window-snap-bottom': { tags: ['acomodar abajo', 'mitad inferior', 'dividir', 'snap bottom', 'tile bottom', 'bottom half'], d: snap(HALF_TOP, { flipY: true }) },
  'window-snap-top-left': { tags: ['cuarto superior izquierdo', 'esquina', 'acomodar', 'snap top left', 'quarter', 'corner'], d: snap(QUARTER) },
  'window-snap-top-right': { tags: ['cuarto superior derecho', 'esquina', 'acomodar', 'snap top right', 'quarter', 'corner'], d: snap(QUARTER, { flipX: true }) },
  'window-snap-bottom-left': { tags: ['cuarto inferior izquierdo', 'esquina', 'acomodar', 'snap bottom left', 'quarter', 'corner'], d: snap(QUARTER, { flipY: true }) },
  'window-snap-bottom-right': { tags: ['cuarto inferior derecho', 'esquina', 'acomodar', 'snap bottom right', 'quarter', 'corner'], d: snap(QUARTER, { flipX: true, flipY: true }) },
};

// ── Fill (DESIGN.md › Fill): indices into `d` that are filled, knocked out, or stay as lines ──
// The window is filled with its bar and controls knocked out, and whatever sits in its body is
// knocked out too; a custom badge (a second window, a pin, a cone, a panel) carries its own fill.
// The bar's cut runs past the frame on both sides: the fill splits into the title bar and the body
// at every weight (a cut that stops on the edge leaves a hairline that some weights lose).
const BAR_CUT = line([1.75, 9], [22.25, 9]);
const W = [BAR_CUT, 2, 3, 4];
const FILL = {
  'window-stack': { solid: [0] },
  'window-overview': { solid: [0, 2, 4], cut: [1, 3, 5] },
  'window-detach': { solid: [0], cut: [1, 2, 3] },
  'window-attach': { solid: [0], cut: [1, 2, 3] },
  // The dock stands 3 below the window: it stays a line, apart from the fill
  'window-minimize': { solid: [0], cut: W, lines: [5] },
  // The arrow stands apart from both: it stays a line
  'window-move': { solid: [0, 2], cut: [1], lines: [3, 4] },
  'title-bar': { solid: [0], cut: [1, 2, 3, 4] },
  'window-controls': { solid: [0, 1, 2] },
  toolbar: { solid: [0], cut: [1, 2, 3] },
  'skeleton-screen': { solid: [0, 1, 2, 3] },
  'splash-screen': { solid: [0], cut: [1, 2] },
  ghost: { solid: [0], cut: [1, 2] },
  // The strip's cut runs past the frame, as the window's bar does
  'menu-bar': { solid: [0], cut: [line([1.75, 10.75], [22.25, 10.75]), 2, 3, 4] },
  dock: { solid: [0] },
  taskbar: { solid: [0], cut: [1, 2, 3, 4] },
  'taskbar-pin': { solid: [0], cut: [1] },
  workspaces: { solid: [0, 1, 2, 3] },
  'workspaces-plus': { solid: [0, 1, 2, 3] },
  'app-switcher': { solid: [0], cut: [1, 2, 3] },
  'home-screen': { solid: [0], cut: [1, 2, 3, 4] },
  'home-screen-plus': { solid: [0], cut: [1, 2] },
  // The plus stands 3 from the tiles: it stays lines
  'apps-plus': { solid: [0, 1, 2], lines: [3, 4] },
  'app-shortcut': { solid: [0], cut: [1, 2] },
  widgets: { solid: [0, 1, 2, 3] },
  'lock-screen': { solid: [0], cut: [1, 2, 3] },
  'quick-settings': { solid: [0], cut: [1, 2, 3, 4] },
  // The strip's cut runs past the frame too
  'status-bar': { solid: [0], cut: [...W, line([1.75, 17.75], [22.25, 17.75])] },
  // The handle stands in the gap between the panes: it stays a line
  'split-screen': { solid: [0, 1], lines: [2] },
  modal: { solid: [0], cut: [1, 2] },
  // The rule and the divider are cut past the frame: the buttons' row splits off at every weight
  dialog: { solid: [0], cut: [1, 2, line([1.75, 13.5], [22.25, 13.5]), line([12, 13.5], [12, 22.25])] },
  'dialog-alert': { solid: [0], cut: [1, 2, line([1.75, 13.5], [22.25, 13.5]), line([12, 13.5], [12, 22.25])] },
  popover: { solid: [0, 1], cut: [2, 3] },
  tooltip: { solid: [0], cut: [1] },
  toast: { solid: [0] },
  banner: { solid: [0], cut: [1, 2] },
  'inline-alert': { solid: [0], cut: [1, 2] },
  drawer: { solid: [0] },
  'bottom-sheet': { solid: [0], cut: [line([3.25, 12], [20.75, 12]), 2] },
  'action-sheet': { solid: [0], cut: [1, 2, 3] },
  'command-palette': { solid: [0], cut: [1, 2, 3, 4, 5, 6] },
  // The chevrons stand apart from the photo: they stay lines
  lightbox: { solid: [0], cut: [1, 2], lines: [3, 4] },
  notification: { solid: [0], cut: [1, 2, 3] },
  // The cards behind show as their edges: lines, apart from the card on top
  'notification-stack': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  'notification-x': { solid: [0], cut: [1, 2, 3] },
  'notification-check': { solid: [0], cut: [1, 2, 3] },
  'push-notification': { solid: [0], cut: [1] },
};
// The window and everything drawn in its body
for (const name of ['window', 'window-plus', 'window-x', 'window-gear', 'window-sync', 'window-arrow-down', 'window-select', 'window-pin', 'window-alert', 'window-block', 'window-check', 'window-construction'])
  FILL[name] = { solid: [0], cut: W };
// The pencil's clearance comes within 1 of the bar on the right edge: there the bar's cut doubles
// (a second one 0.75 below it, from where the clearance is already that close), so no sliver of
// the edge is left between them at any weight
FILL['window-edit'] = { solid: [0], cut: [...W, line([18.5, 9.75], [22.25, 9.75])] };
for (const name of ['window-resize', 'window-sheet', 'window-loading', 'window-empty', 'window-maintenance', 'window-crash', 'window-pause', 'remote-desktop'])
  FILL[name] = { solid: [0], cut: [...W, ...icons[name].d.map((_, i) => i).slice(5)] };
// Snap layouts: the screen filled, the tile knocked out
for (const name of Object.keys(icons).filter((n) => n.startsWith('window-snap-'))) FILL[name] = { solid: [0], cut: [1] };
for (const [name, spec] of Object.entries(FILL)) {
  const pick = (ix) => ix.map((i) => (typeof i === 'string' ? i : icons[name].d[i]));
  icons[name].fill = {
    solid: pick(spec.solid),
    ...(spec.cut && { cut: pick(spec.cut) }),
    ...(spec.lines && { lines: pick(spec.lines) }),
    ...(spec.wire && { wire: pick(spec.wire) }),
  };
}

// ── Named parts (DESIGN.md › Named parts): what animates, changes state, or sits under a badge ──
const FRAME_PARTS = { frame: [0], bar: [1], controls: [2, 3, 4] };
const PARTS = {
  'window-stack': { back: [0] },
  'window-overview': { windows: [0, 1, 2, 3], wide: [4, 5] },
  'window-resize': { ...FRAME_PARTS, grip: [5, 6] },
  'window-sheet': { ...FRAME_PARTS, sheet: [5] },
  'window-detach': { window: [0, 1], arrow: [2, 3] },
  'window-attach': { window: [0, 1], arrow: [2, 3] },
  'window-minimize': { ...FRAME_PARTS, dock: [5] },
  'window-move': { window: [0, 1], screen: [2], arrow: [3, 4] },
  'window-loading': { ...FRAME_PARTS, loader: [5] },
  'window-empty': { ...FRAME_PARTS, tray: [5] },
  'window-maintenance': { ...FRAME_PARTS, wrench: [5, 6] },
  'window-pause': { ...FRAME_PARTS, bars: [5, 6] },
  'status-bar': { ...FRAME_PARTS, status: [5] },
  'window-crash': { ...FRAME_PARTS, crack: [5] },
  'title-bar': { bar: [0], controls: [1, 2, 3], title: [4] },
  'window-controls': { controls: [0, 1, 2] },
  toolbar: { bar: [0], tools: [1, 2, 3] },
  'skeleton-screen': { avatar: [0], lines: [1, 2, 3] },
  'splash-screen': { screen: [0], mark: [1], progress: [2] },
  ghost: { body: [0], eyes: [1, 2] },
  'menu-bar': { screen: [0], bar: [1], logo: [2], items: [3, 4] },
  dock: { screen: [0] },
  taskbar: { screen: [0], bar: [1], start: [2], apps: [3, 4] },
  'taskbar-pin': { bar: [0], start: [1] },
  workspaces: { spaces: [0, 1, 2], current: [3] },
  'workspaces-plus': { spaces: [0, 1, 2], current: [3] },
  'app-switcher': { panel: [0], selected: [1], apps: [2, 3] },
  'home-screen': { screen: [0], apps: [1, 2, 3, 4] },
  'home-screen-plus': { screen: [0], apps: [1, 2] },
  'apps-plus': { apps: [0, 1, 2], mark: [3, 4] },
  'app-shortcut': { app: [0], arrow: [1, 2] },
  widgets: { tiles: [0, 1, 2], widget: [3] },
  'lock-screen': { screen: [0], lock: [1, 2], time: [3] },
  'quick-settings': { panel: [0], toggles: [1, 2], slider: [3], knob: [4] },
  'split-screen': { panes: [0, 1], handle: [2] },
  modal: { page: [0], modal: [1, 2] },
  dialog: { box: [0], text: [1, 2], buttons: [3, 4] },
  'dialog-alert': { box: [0], text: [1, 2], buttons: [3, 4] },
  popover: { card: [0], anchor: [1], text: [2, 3] },
  tooltip: { label: [0], text: [1] },
  toast: { page: [0] },
  banner: { page: [0], banner: [1, 2] },
  'inline-alert': { box: [0], accent: [1], text: [2] },
  drawer: { page: [0] },
  'bottom-sheet': { screen: [0], sheet: [1, 2] },
  'action-sheet': { screen: [0], options: [1, 2], cancel: [3] },
  'command-palette': { box: [0], search: [1, 2, 3], results: [4, 5, 6] },
  lightbox: { photo: [0, 1, 2], chevrons: [3, 4] },
  notification: { card: [0], app: [1], text: [2, 3] },
  'notification-stack': { card: [0], app: [1], text: [2, 3], behind: [4, 5] },
  'notification-x': { card: [0], app: [1], text: [2, 3] },
  'notification-check': { card: [0], app: [1], text: [2, 3] },
  'push-notification': { phone: [0], speaker: [1] },
};
for (const name of ['window', 'window-plus', 'window-x', 'window-gear', 'window-sync', 'window-arrow-down', 'window-edit', 'window-select', 'window-alert', 'window-block', 'window-check', 'window-pin', 'window-construction', 'remote-desktop'])
  PARTS[name] = FRAME_PARTS;
for (const name of Object.keys(icons).filter((n) => n.startsWith('window-snap-'))) PARTS[name] = { screen: [0], tile: [1] };
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Motion (DESIGN.md › Motion): each icon's own gesture ──
const BC = [17.25, 17.25];
const MOTION = {
  'window-sync': { effect: 'spin', parts: ['badge'], origin: BC },
  'window-gear': { effect: 'spin', parts: ['badge'], origin: BC },
  'window-arrow-down': { effect: 'bounce', parts: ['badge'], vector: [0, 1.5] },
  'window-edit': { effect: 'wiggle', parts: ['badge'], origin: [12.5, 21] },
  'window-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'dialog-alert': { effect: 'wiggle', parts: ['badge'], origin: [17.25, 21.5] },
  'window-loading': { effect: 'spin', parts: ['loader'], origin: BODY },
  'window-pin': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'taskbar-pin': { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'window-detach': { effect: 'slide', parts: ['arrow'], vector: [1.5, -1.5] },
  'window-attach': { effect: 'slide', parts: ['arrow'], vector: [-1.5, 1.5] },
  'window-minimize': { effect: 'slide', parts: ['badge'], vector: [0, 1.5] },
  'window-move': { effect: 'slide', parts: ['arrow'], vector: [2, 0] },
  'window-maintenance': { effect: 'wiggle', parts: ['wrench'], origin: [15, 14] },
  ghost: { effect: 'float', vector: [0, -1.5] },
  widgets: { effect: 'float', parts: ['widget'], vector: [0, -1.5] },
  toast: { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] },
  'bottom-sheet': { effect: 'slide', parts: ['sheet'], vector: [0, -1.5] },
  drawer: { effect: 'slide', parts: ['badge'], vector: [-1.5, 0] },
  'push-notification': { effect: 'beat', parts: ['badge'], origin: [18.75, 5.25] },
};
for (const [name, motion] of Object.entries(MOTION)) icons[name].motion = motion;

// ── Mirroring (DESIGN.md › Mirroring): what reads from left to right ──
// The arrows that leave or return to a window, the move to the right, the shortcut's arc, and the
// surfaces whose content starts at the left (an avatar, an app's tile, a dot, an accent, a
// magnifier, the start button, the menu bar's logo, the popover's button); the drawer slides in
// from the reading end.
for (const name of ['window-detach', 'window-attach', 'window-move', 'app-shortcut', 'skeleton-screen', 'menu-bar', 'taskbar', 'popover', 'toast', 'inline-alert', 'drawer', 'command-palette', 'notification', 'notification-stack'])
  icons[name].mirror = true;

// ── Variants (DESIGN.md › Automatic variants) ──
const off = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already a square container (the window, the screen, a page): not enclosed in a square again.
off(['window', 'window-resize', 'window-sheet', 'window-loading', 'window-empty', 'window-maintenance', 'window-crash', 'window-pause', 'status-bar', 'remote-desktop', 'app-shortcut', 'quick-settings', 'modal', 'dialog', 'toast', 'banner', ...Object.keys(icons).filter((n) => n.startsWith('window-snap-'))], { square: false });
// With a badge: enclosed, the badge stops reading, and the slash would cut through it.
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };

// ── 16 px (DESIGN.md › 16 px) ──
// At 16 px a pixel is 1.5 of the canvas and pixel centers fall at 0.75 + 1.5k; g(column, row) is
// the center of a pixel and the drawings below run from center to center, with their diagonals at
// 45°, so they land crisp. They drop what doesn't fit with 1 px of clearance: the window keeps its
// controls (one-pixel dots between its top edge and its bar, a pixel apart) where its body is
// empty, and gives them up where its body holds something, its bar moving up a row to make room.
// A small drawing isn't snapped by the engine, and a badge goes in it as its pixel version.
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...pts) => line(...pts.map(([c, r]) => g(c, r)));
/** A container from pixel (c0, r0) to pixel (c1, r1), its signature corner square. */
const box16 = (c0, r0, c1, r1, rad = 1.5, opts = BR) => sq(px(c0), px(r0), 1.5 * (c1 - c0), 1.5 * (r1 - r0), rad, opts);
/** A one-pixel dot (the engine draws it as a disc a pixel across). */
const dot16 = (c, r) => circ(...g(c, r), 0.1);
/** A ring four pixels across (columns c…c+3, rows r…r+3): an octagon through pixel centers, crisp where a circle would be gray. */
const ring16 = (c, r) => roundpoly([[c + 1, r], [c + 2, r], [c + 3, r + 1], [c + 3, r + 2], [c + 2, r + 3], [c + 1, r + 3], [c, r + 2], [c, r + 1]].map(([x, y]) => g(x, y)), 0.3);
/** A solid 2 × 2 pixel block (a tool, an app): a square of 1.5 that its stroke fills. */
const block16 = (c, r) => `M${P(g(c, r))}h1.5v1.5h-1.5Z`;
/** A cut that runs past the frame along a row (the bar's, in the fill). */
const rowCut16 = (r) => line([0.75, px(r)], [23.25, px(r)]);
const FRAME16 = box16(2, 2, 13, 13, 3);
const WINDOW16 = [FRAME16, pl([2, 6], [13, 6]), dot16(4, 4), dot16(6, 4), dot16(8, 4)];
const W16_FILL = (extra = []) => ({ solid: [FRAME16], cut: [rowCut16(6), ...WINDOW16.slice(2), ...extra] });
/** The window whose body holds something: its bar a row up, no controls. */
const BODY16 = [FRAME16, pl([2, 5], [13, 5])];
const B16_FILL = (extra) => ({ solid: [FRAME16], cut: [rowCut16(5), ...extra] });
const small = (name, d, fill, badge16) => {
  icons[name].small = { d, ...(fill && { fill }), ...(badge16 && { badge: badge16 }) };
};
/** Núcleo's pushpin on the pixel grid: its head on row `r`, centered on column `c`, its needle `n` long. */
function pin16(c, r, n) {
  const head = pl([c - 2, r], [c + 2, r]);
  const body = `M${P(g(c - 1, r))}L${P(g(c - 1, r + 1))}L${P(g(c - 2, r + 2))}L${P(g(c + 2, r + 2))}L${P(g(c + 1, r + 1))}L${P(g(c + 1, r))}`;
  const needle = pl([c, r + 2], [c, r + 2 + n]);
  const hull = `M${[g(c - 2, r), g(c + 2, r), g(c + 2, r + 2), g(c, r + 2 + n), g(c - 2, r + 2)].map(P).join('L')}Z`;
  return own([head, body, needle], hull, { solid: [`${body}Z`], wire: [head, needle] });
}

// The window and its badges: the pixel window and the engine's pixel badges
for (const kind of ['plus', 'x', 'gear', 'sync', 'arrow-down', 'edit', 'alert', 'block', 'check'])
  small(`window-${kind}`, WINDOW16, W16_FILL(), badge(kind, { size: 16 }));
small('window', WINDOW16, W16_FILL());
// The pointer on the pixel grid: its vertical edge, its 45° edges and its base on pixel centers
{
  const p = roundpoly([g(8, 7), g(8, 13), g(10, 11), g(12, 11)], [0.3, 0.5, 0.3, 0.5]);
  small('window-select', WINDOW16, W16_FILL(), own([p], p, { solid: [p] }));
}
// The resize grips: two pixel diagonals in the square corner, the inner one a pixel clear of the edges
{
  const grips = [pl([13, 11], [11, 13]), pl([11, 9], [9, 11])];
  small('window-resize', [...WINDOW16, ...grips], W16_FILL(grips));
}
{
  const sheet = cline([g(5, 6), g(5, 10), g(10, 10), g(10, 6)], [0, 1.5, 0, 0]);
  small('window-sheet', [...WINDOW16, sheet], W16_FILL([sheet]));
}
// The body's contents, in the five rows and eight columns under the raised bar
{
  const loader = arc(px(8), px(9), 3, -90, 180).d;
  small('window-loading', [...BODY16, loader], B16_FILL([loader]));
  const tray = pl([4, 8], [5, 8], [5, 11], [10, 11], [10, 8], [11, 8]);
  small('window-empty', [...BODY16, tray], B16_FILL([tray]));
  // The wrench: its jaw a ring of pixels open at the top right, its handle a pixel diagonal
  const jaw = pl([11, 7], [10, 7], [10, 9], [12, 9], [12, 8]);
  const handle = pl([10, 9], [8, 11]);
  small('window-maintenance', [...BODY16, jaw, handle], B16_FILL([jaw, handle]));
  const crack = pl([7, 5], [6, 6], [8, 8], [6, 10], [8, 12], [7, 13]);
  small('window-crash', [...BODY16, crack], B16_FILL([crack]));
  const bars = [pl([6, 7], [6, 11]), pl([9, 7], [9, 11])];
  small('window-pause', [...BODY16, ...bars], B16_FILL(bars));
}
// The status bar: the pixel window and its strip's line on row 11, a row of paper above the bottom
{
  const strip = pl([2, 11], [13, 11]);
  small('status-bar', [...WINDOW16, strip], W16_FILL([rowCut16(11)]));
}
// Badges drawn for the window: on the grid, with what they clear
{
  const cone = `M${P(g(9, 12))}L${P(g(11, 8))}L${P(g(13, 12))}`;
  const base = box16(8, 12, 14, 14, 0.75);
  small('window-construction', WINDOW16, W16_FILL(), own([cone, base], `${cone}Z${base}`, { solid: [`${cone}Z`, base], cut: [pl([8, 12], [14, 12])] }));
  const screen = box16(8, 8, 14, 12, 1.5);
  const stand = [pl([11, 12], [11, 14]), pl([9, 14], [13, 14])];
  small('remote-desktop', WINDOW16, W16_FILL(), own([screen, ...stand], `${screen}M${P(g(9, 12))}H${f(px(14))}V${f(px(14))}H${f(px(9))}Z`, { solid: [screen], wire: stand }));
}

// Managing windows
{
  const back = box16(2, 2, 10, 10, 2);
  const front = [box16(5, 5, 13, 13, 2), pl([5, 9], [13, 9]), dot16(7, 7), dot16(9, 7), dot16(11, 7)];
  small('window-stack', [back], { solid: [back] }, own(front, front[0], { solid: [front[0]], cut: [rowCut16(9), ...front.slice(2)] }));
  const ws = [[2, 2, 7, 7], [10, 3, 14, 7], [5, 10, 12, 14]].flatMap(([c0, r0, c1, r1]) => [box16(c0, r0, c1, r1, 1.5), pl([c0, r0 + 2], [c1, r0 + 2])]);
  small('window-overview', ws, { solid: [ws[0], ws[2], ws[4]], cut: [ws[1], ws[3], ws[5]] });
  // The pin clears the frame's corner beside its needle too, so no pixel of it is left alone
  const pin = pin16(11, 8, 4);
  small('window-pin', WINDOW16, W16_FILL(), { ...pin, knock: `${pin.knock}M${P(g(11, 10))}H${f(px(14))}V${f(px(14))}H${f(px(11))}Z` });
  const big = [box16(2, 5, 10, 13, 2), pl([2, 7], [10, 7])];
  const little = [box16(9, 2, 13, 6, 1), pl([9, 4], [13, 4])];
  const lift = own(little, little[0], { solid: [little[0]], cut: [little[1]] });
  const out = [pl([4, 11], [7, 8]), pl([5, 8], [7, 8], [7, 10])];
  const back2 = [pl([7, 8], [4, 11]), pl([4, 9], [4, 11], [6, 11])];
  small('window-detach', [...big, ...out], { solid: [big[0]], cut: [big[1], ...out] }, lift);
  small('window-attach', [...big, ...back2], { solid: [big[0]], cut: [big[1], ...back2] }, lift);
  const low = [box16(2, 2, 13, 10, 3), pl([2, 6], [13, 6]), dot16(4, 4), dot16(6, 4), dot16(8, 4), pl([4, 14], [10, 14])];
  const down = [pl([7, 8], [7, 12]), pl([5, 10], [7, 12], [9, 10])];
  small('window-minimize', low, { solid: [low[0]], cut: [rowCut16(6), ...low.slice(2, 5)], lines: [low[5]] }, own(down, `${trace(g(7, 8), g(7, 12))}${down[1]}Z`));
  const moving = [box16(1, 3, 5, 7, 1), pl([1, 5], [5, 5]), box16(8, 2, 14, 8, 1.5), pl([2, 12], [13, 12]), pl([11, 10], [13, 12], [11, 14])];
  small('window-move', moving, { solid: [moving[0], moving[2]], cut: [moving[1]], lines: moving.slice(3) });
}

// Chrome: the title bar, the controls, the toolbar
{
  const bar = [box16(1, 5, 14, 9, 2, { square: ['bl', 'br'] }), dot16(3, 7), dot16(5, 7), dot16(7, 7), pl([10, 7], [12, 7])];
  small('title-bar', bar, { solid: [bar[0]], cut: bar.slice(1) });
  const rings = [1, 6, 11].map((c) => ring16(c, 6));
  small('window-controls', rings, { solid: rings });
  const tb = [capsule(px(1), px(5), 19.5, 7.5), block16(4, 7), block16(7, 7), block16(10, 7)];
  small('toolbar', tb, { solid: [tb[0]], cut: tb.slice(1) });
}

// Screens, the desktop and phones
{
  const sk = [ring16(1, 1), capsule(px(6), px(2), 12, 3), capsule(px(1), px(7), 19.5, 3), capsule(px(1), px(11), 13.5, 3)];
  small('skeleton-screen', sk, { solid: sk });
  const PORT16 = box16(3, 1, 12, 14, 2.5);
  const splash = [PORT16, box16(6, 4, 9, 7, 1), pl([6, 11], [9, 11])];
  small('splash-screen', splash, { solid: [PORT16], cut: splash.slice(1) });
  const DESK16 = box16(1, 3, 14, 12, 2.5);
  // The logo a two-pixel dash: a block doesn't fit between the top edge and the strip's line
  const mb = [DESK16, pl([1, 7], [14, 7]), pl([3, 5], [4, 5]), dot16(10, 5), dot16(12, 5)];
  small('menu-bar', mb, { solid: [DESK16], cut: [rowCut16(7), ...mb.slice(2)] });
  const bar = box16(3, 10, 11, 14, 1.5);
  const docked = [5, 7, 9].map((c) => dot16(c, 12));
  small('dock', [DESK16], { solid: [DESK16] }, own([bar, ...docked], bar, { solid: [bar], cut: docked }));
  const tk = [DESK16, pl([1, 7], [14, 7]), block16(3, 9), pl([7, 9], [7, 10]), pl([9, 9], [9, 10])];
  small('taskbar', tk, { solid: [DESK16], cut: [rowCut16(7), ...tk.slice(2)] });
  const strip = [box16(1, 10, 14, 14, 2), dot16(3, 12)];
  small('taskbar-pin', strip, { solid: [strip[0]], cut: [strip[1]] }, pin16(8, 1, 7));
  const spaces = [box16(2, 2, 4, 4, 0.75), box16(6, 2, 8, 4, 0.75), box16(10, 2, 12, 4, 0.75), box16(2, 6, 12, 13, 2)];
  small('workspaces', spaces, { solid: spaces });
  small('workspaces-plus', spaces, { solid: spaces }, badge('plus', { size: 16 }));
  const sw = [box16(1, 4, 14, 11, 2), box16(6, 6, 9, 9, 1), block16(3, 7), block16(11, 7)];
  small('app-switcher', sw, { solid: [sw[0]], cut: sw.slice(1) });
  // The four apps as solid blocks, two pixels apart (hollow tiles don't fit two across)
  const home = [PORT16, ...[3, 7].flatMap((r) => [block16(5, r), block16(9, r)])];
  small('home-screen', home, { solid: [PORT16], cut: home.slice(1) });
  small('home-screen-plus', home.slice(0, 3), { solid: [PORT16], cut: home.slice(1, 3) }, badge('plus', { size: 16 }));
  const apps = [box16(2, 2, 6, 6, 1.5, {}), box16(9, 2, 13, 6, 1.5, {}), box16(2, 9, 6, 13, 1.5, {}), pl([11, 9], [11, 13]), pl([9, 11], [13, 11])];
  small('apps-plus', apps, { solid: apps.slice(0, 3), lines: apps.slice(3) });
  const sc = [FRAME16, pl([5, 11], [5, 8], [8, 8]), pl([7, 7], [8, 8], [7, 9])];
  small('app-shortcut', sc, { solid: [FRAME16], cut: sc.slice(1) });
  const wg = [box16(2, 2, 6, 6, 1.5, {}), box16(2, 9, 6, 13, 1.5, {}), box16(9, 9, 13, 13, 1.5), roundpoly([g(11, 2), g(13, 4), g(11, 6), g(9, 4)], [0.4, 0.4, 0, 0.4])];
  small('widgets', wg, { solid: wg });
  const lock = [PORT16, sq(px(5), px(5), 6, 4.5, 1.2, BR), `M${f(px(6))} ${f(px(5))}V${f(px(4))}A1.5 1.5 0 0 1 ${f(px(8))} ${f(px(4))}V${f(px(5))}`, pl([5, 11], [10, 11])];
  small('lock-screen', lock, { solid: [PORT16], cut: lock.slice(1) });
  // The toggles stacked beside a vertical slider (side by side over it, at this size, a face)
  const qs = [FRAME16, ring16(3, 3), box16(3, 8, 6, 11, 0.75), pl([10, 4], [10, 8]), circ(px(10), px(10), 1.5)];
  small('quick-settings', qs, { solid: [FRAME16], cut: qs.slice(1) });
  const bs = [PORT16, pl([3, 7], [12, 7]), pl([7, 9], [8, 9])];
  small('bottom-sheet', bs, { solid: [PORT16], cut: [rowCut16(7), bs[2]] });
  const as = [PORT16, box16(5, 3, 10, 7, 1), pl([5, 5], [10, 5]), capsule(px(5), px(10), 7.5, 3)];
  small('action-sheet', as, { solid: [PORT16], cut: as.slice(1) });
  // Split screen: the two panes four rows deep, the handle on the middle row between them
  const split = [box16(3, 1, 12, 5, 2), box16(3, 9, 12, 13, 2), pl([6, 7], [9, 7])];
  small('split-screen', split, { solid: split.slice(0, 2), lines: [split[2]] });
  const cp = [PORT16, circ(px(6), px(4), 1.5), pl([7, 5], [8, 6]), pl([3, 8], [12, 8]), pl([5, 10], [10, 10]), pl([5, 12], [8, 12])];
  small('command-palette', cp, { solid: [PORT16], cut: cp.slice(1) });
}

// Surfaces over a page, and notifications
{
  const md = [FRAME16, box16(5, 5, 10, 10, 1.5)];
  small('modal', md, { solid: [FRAME16], cut: md.slice(1) });
  // The divider a pixel left of the middle (the frame is twelve pixels across)
  const dl = [FRAME16, pl([5, 4], [10, 4]), pl([6, 6], [9, 6]), pl([2, 8], [13, 8]), pl([7, 8], [7, 13])];
  const dlFill = { solid: [FRAME16], cut: [dl[1], dl[2], rowCut16(8), pl([7, 8], [7, 15])] };
  small('dialog', dl, dlFill);
  // With the badge, the divider goes: its clearance would leave a stub of it
  small('dialog-alert', dl.slice(0, 4), { solid: [FRAME16], cut: dlFill.cut.slice(0, 3) }, badge('alert', { size: 16 }));
  const pop = [pointed(px(2), px(6), 16.5, 10.5, 1.5, { side: 'top', cx: px(6), half: 1.5, depth: 1.5, tip: 0, joint: 0 }), capsule(px(4), px(1), 6, 3), pl([5, 9], [10, 9]), pl([5, 11], [8, 11])];
  small('popover', pop, { solid: pop.slice(0, 2), cut: pop.slice(2) });
  const pill = capsule(px(5), px(10), 13.5, 6);
  const message = [dot16(7, 12), pl([9, 12], [12, 12])];
  small('toast', [FRAME16], { solid: [FRAME16] }, own([pill, ...message], pill, { solid: [pill], cut: message }));
  // The drawer: the page and the panel over its right side, on the grid
  const page = box16(1, 3, 10, 12, 2);
  const panel = box16(7, 1, 14, 14, 2);
  small('drawer', [page], { solid: [page] }, own([panel], panel, { solid: [panel] }));
  const bn = [FRAME16, box16(4, 4, 11, 8, 1), pl([6, 6], [9, 6])];
  small('banner', bn, { solid: [FRAME16], cut: bn.slice(1) });
  const lb = [box16(5, 4, 10, 11, 1.5), pl([5, 9], [7, 7], [10, 10]), pl([3, 6], [1, 8], [3, 10]), pl([12, 6], [14, 8], [12, 10])];
  small('lightbox', lb, { solid: [lb[0]], cut: [lb[1]], lines: lb.slice(2) });
  const card16 = (r) => [box16(1, r, 14, r + 6, 2), box16(3, r + 2, 5, r + 4, 0.75), pl([7, r + 2], [12, r + 2]), pl([7, r + 4], [10, r + 4])];
  const n0 = card16(5);
  small('notification', n0, { solid: [n0[0]], cut: n0.slice(1) });
  const n1 = card16(2);
  const behind = [pl([3, 10], [12, 10]), pl([5, 12], [10, 12])];
  small('notification-stack', [...n1, ...behind], { solid: [n1[0]], cut: n1.slice(1), lines: behind });
  small('notification-x', n1, { solid: [n1[0]], cut: n1.slice(1) }, badge('x', { size: 16 }));
  small('notification-check', n1, { solid: [n1[0]], cut: n1.slice(1) }, badge('check', { size: 16 }));
  // The smartphone eight pixels across, its speaker slot three pixels on its axis
  const phone = [box16(3, 1, 11, 14, 2.5), pl([6, 3], [8, 3])];
  small('push-notification', phone, { solid: [phone[0]], cut: [phone[1]] }, badge('dot', { size: 16 }));
}

// Snap layouts: the tile on the grid, a column of paper from the frame and two between halves
{
  const tiles = {
    'window-snap-left': [4, 4, 6, 11],
    'window-snap-right': [9, 4, 11, 11],
    'window-snap-top': [4, 4, 11, 6],
    'window-snap-bottom': [4, 9, 11, 11],
    'window-snap-top-left': [4, 4, 6, 6],
    'window-snap-top-right': [9, 4, 11, 6],
    'window-snap-bottom-left': [4, 9, 6, 11],
    'window-snap-bottom-right': [9, 9, 11, 11],
  };
  for (const [name, [c0, r0, c1, r1]] of Object.entries(tiles)) {
    const tile = box16(c0, r0, c1, r1, 1);
    small(name, [FRAME16, tile], { solid: [FRAME16], cut: [tile] });
  }
}

export default { category: 'ventanas', label: 'Ventanas y apps', icons };
