// Software development: version control in depth, code review, debugging, code tools, structures,
// build and delivery, infrastructure as code, and APIs. Everything is computed with the engine
// (engine/geometry.mjs) on the rules in DESIGN.md: a 1.5 stroke, keylines, continuous corners and a
// square bottom-right corner on containers. The category adopts the git family, the bug, the
// terminal, the code window, the API plug and the webhook from `datos`: the new git icons are built
// on the same rings (r 2.35) and lanes, and every bug and code icon on the existing bug and code.
// Badges are the engine's; a piece on top of another (a hammer on a cube, a phone in front of a
// window) is a custom badge the engine clears.
import { arc, badge, circ, dot, drop, f, flipPath, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import archivos from './archivos.mjs';
import datos from './datos.mjs';
import dispositivos from './dispositivos.mjs';
import edicion from './edicion.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import producto from './producto.mjs';
import sistema from './sistema.mjs';
import ventanas from './ventanas.mjs';

// ---------------------------------------------------------------------------------------------
// Local utilities
// ---------------------------------------------------------------------------------------------
const pt = (p) => `${f(p[0])} ${f(p[1])}`;
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, { square: ['br'] });
/** A path scaled by `s` around `o` and moved by (dx, dy). */
const xf = (d, s, o = [12, 12], dx = 0, dy = 0) => transform(d, s, o[0] * (1 - s) + dx, o[1] * (1 - s) + dy);
/** Custom badge: the piece on top, the area the engine clears around it, and its fill. */
const own = (d, knock, fill) => ({ d, knock, ...(fill && { fill }) });

/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
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

// ---------------------------------------------------------------------------------------------
// The pieces this category builds on
// ---------------------------------------------------------------------------------------------
const D = datos.icons;
const N = nucleo.icons;
// Git: the adopted nodes (r 2.35), the trunk at x 6.25 and the branch lane at 17.75
const GR = 2.35;
const TX = 6.25;
const BX = 17.75;
const node = (x, y, r = GR) => circ(x, y, r);
/** A straight arrow: its shaft from `a` to the tip `b`, and the head (arms of `len`). */
const arrow = (a, b, len = 3.4) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], len)];
/**
 * The head of an arc arrow on a tight arc (r 6.5 or less), turned 10° off the tangent away from the
 * arc's center: along the tangent, its inner arm and the arc closed up into one at bold.
 */
const arcHead = (a, c, len = 3.4) => {
  const turn = (deg) => [a.tangent[0] * Math.cos((deg * Math.PI) / 180) - a.tangent[1] * Math.sin((deg * Math.PI) / 180), a.tangent[0] * Math.sin((deg * Math.PI) / 180) + a.tangent[1] * Math.cos((deg * Math.PI) / 180)];
  const away = (v) => (a.end[0] + v[0] - c[0]) ** 2 + (a.end[1] + v[1] - c[1]) ** 2;
  return head(a.end, [turn(10), turn(-10)].sort((u, v) => away(v) - away(u))[0], len);
};

// Custom badges, in the engine's place: center (17.25, 17.25), circle of r 4.25. A status badge is
// a solid disc with its sign cut out in every style. The engine only swaps its own badges for
// their pixel versions, so each custom badge carries its 16 px drawing: no disc, the sign larger
// and on the pixel grid (pixel centers at 0.75 + 1.5k), clearing the same circle plus the sign.
const BC = [17.25, 17.25];
const RING = circ(...BC, 4.25);
const PX = (k) => 0.75 + 1.5 * k;
const AT = (dx, dy) => [PX(11 + dx), PX(11 + dy)];
const PIXEL = new Map();
const custom = (b, d16, fill16) => {
  PIXEL.set(b, { d: d16, knock: `${RING}${d16.join('')}`, ...(fill16 && { fill: fill16 }) });
  return b;
};
/** A status badge of the category's own: the disc with `sign` cut out. */
const status = (sign, d16, fill16) => custom(own([RING, ...sign], RING, { solid: [RING], cut: sign }), d16, fill16);
// Play: a triangle whose inradius (0.58) stays under half the paper at bold, so it is cut out as a
// solid triangle at every weight (a larger one opened a speck of ink in its middle). At 16 px, the
// pixel triangle in ink.
const PLAY16 = roundpoly([AT(-1, -2), AT(2, 0), AT(-1, 2)], 0.3);
const PLAY = () => status([roundpoly([[16.6, 16.25], [18.33, 17.25], [16.6, 18.25]], 0.2)], [PLAY16], { solid: [PLAY16] });

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------
const icons = {};

// Version control -------------------------------------------------------------------------------
// Rebase: the trunk of two commits; the branch's commit now hangs off the top one, and the arrow
// that leaves the lower commit and rises to it says the branch moved up.
icons['git-rebase'] = {
  tags: ['rebase', 'reorganizar rama', 'reescribir historial', 'git', 'rebase branch'],
  d: [
    node(TX, 18.4),
    line([TX, 7.95], [TX, 16.05]),
    node(TX, 5.6),
    line([TX + GR, 5.6], [BX - GR, 5.6]),
    node(BX, 5.6),
    rline([[TX + GR, 18.4], [BX, 18.4], [BX, 11]], 3.5),
    head([BX, 11], [0, -1], 3.4),
  ],
};
// Cherry-pick: two lines of commits; an arc carries the right line's commit over the top and
// lands it on the left line as a new commit (the arrowhead 2.85 above it).
{
  const a = arc(12, 8, 5.75, 0, -180);
  icons['git-cherry-pick'] = {
    tags: ['cherry-pick', 'copiar commit', 'elegir cambio', 'git', 'pick commit'],
    d: [
      node(BX, 8 + GR),
      line([BX, 8 + 2 * GR], [BX, 20.75]),
      node(TX, 8 + 2.85 + GR),
      line([TX, 8 + 2.85 + 2 * GR], [TX, 20.75]),
      a.d,
      arcHead(a, [12, 8]),
    ],
  };
}
// Stash: a commit drops into an open tray to wait; pop lifts it back out. The same shaft, its head
// at one end or the other.
const TRAY = rline([[4.25, 12.75], [4.25, 20.25], [19.75, 20.25], [19.75, 12.75]], 2.5);
const STASH_SHAFT = [12, 5.6 + GR + 2.85];
const STASH_FLOOR = [12, 16.75];
icons['git-stash'] = {
  tags: ['stash', 'guardar cambios', 'apartar', 'git', 'shelve changes'],
  d: [TRAY, node(12, 5.6), ...arrow(STASH_SHAFT, STASH_FLOOR)],
};
icons['git-stash-pop'] = {
  tags: ['stash pop', 'recuperar cambios', 'aplicar stash', 'git', 'unstash'],
  d: [TRAY, node(12, 5.6), ...arrow(STASH_FLOOR, STASH_SHAFT)],
};
// Tag: a tag hangs off the commit on a short stem, its point toward the commit and its eyelet a dot.
icons['git-tag'] = {
  tags: ['etiqueta', 'versión', 'release', 'git', 'tag'],
  d: [
    line([TX, 3.25], [TX, 12 - GR]),
    node(TX, 12),
    line([TX, 12 + GR], [TX, 20.75]),
    line([TX + GR, 12], [11.33, 12]),
    roundpoly([[11, 12], [14.25, 8.25], [20.75, 8.25], [20.75, 15.75], [14.25, 15.75]], [1, 1, 1.75, 1.75, 1]),
    dot(15, 12),
  ],
};
// Revert: from the newer commit an arrow curls back, counterclockwise, to the one before it.
{
  const x = 16.75;
  const c = [11.25, 12];
  const a = arc(c[0], c[1], 6.4, -90, -270);
  icons['git-revert'] = {
    tags: ['revertir', 'deshacer commit', 'regresar cambio', 'git', 'revert'],
    d: [
      node(x, 5.6),
      line([x, 7.95], [x, 16.05]),
      node(x, 18.4),
      `M${pt([x - GR, 5.6])}L${pt([c[0], 5.6])}${a.d.replace(/^M[^A]*/, '')}`,
      arcHead(a, c),
    ],
  };
}
// Squash: three small commits whose lanes run together into one larger commit that goes on alone.
{
  const [x0, xj, cx, r] = [3.75, 10, 15, 3.75];
  icons['git-squash'] = {
    tags: ['squash', 'combinar commits', 'aplastar', 'git', 'squash commits'],
    d: [
      dot(x0, 5.75),
      dot(x0, 12),
      dot(x0, 18.25),
      `M${pt([x0, 5.75])}C7.5 5.75 6.75 12 ${pt([xj, 12])}`,
      line([x0, 12], [cx - r, 12]),
      `M${pt([x0, 18.25])}C7.5 18.25 6.75 12 ${pt([xj, 12])}`,
      circ(cx, 12, r),
      line([cx + r, 12], [21.5, 12]),
    ],
  };
}
// Push and pull: a commit and the remote (a short bar above it). Push: the arrow leaves the commit
// and stops 2.85 under the remote. Pull: it leaves the remote and stops 2.85 above the commit.
const REMOTE = line([7.25, 3.25], [16.75, 3.25]);
const TIP = [node(12, 15), line([12, 15 + GR], [12, 20.75])];
icons['git-push'] = {
  tags: ['push', 'subir cambios', 'enviar al remoto', 'git', 'push commits'],
  d: [...TIP, ...arrow([12, 15 - GR], [12, 6.1]), REMOTE],
};
icons['git-pull'] = {
  tags: ['pull', 'traer cambios', 'actualizar rama', 'git', 'pull changes'],
  d: [...TIP, ...arrow([12, 3.25], [12, 15 - GR - 2.85]), REMOTE],
};
// Fetch: the commits come down a dashed track beside the trunk and wait there, not yet joined.
icons['git-fetch'] = {
  tags: ['fetch', 'descargar cambios', 'buscar actualizaciones', 'git', 'fetch remote'],
  d: [
    node(TX, 5.6),
    line([TX, 7.95], [TX, 16.05]),
    node(TX, 18.4),
    node(BX, 18.4),
    line([BX, 3.25], [BX, 6.75]),
    ...arrow([BX, 9.75], [BX, 18.4 - GR - 3], 3),
  ],
};
// Clone: the set's copy (Edición); in the front frame, the adopted git-commit turned upright and
// smaller (a node of r 2.25 on a lane that runs from edge to edge).
{
  const [back, front] = edicion.icons.copy.d;
  const c = [15.5, 15.5];
  icons['git-clone'] = {
    tags: ['clonar', 'copiar repositorio', 'descargar repositorio', 'git', 'clone'],
    d: [front, back, circ(c[0], c[1], 2.25), line([c[0], 10.25], [c[0], c[1] - 2.25]), line([c[0], c[1] + 2.25], [c[0], 20.75])],
  };
}
// Remote: the commit tied by a short line to the cloud above it (Lugares' cloud at 70 %).
{
  const s = 0.7;
  const base = 11.85;
  const cloud = transform(lugares.icons.cloud.d[0], s, 12 - 12.125 * s, base - 18.25 * s);
  const y = 16.25;
  icons['git-remote'] = {
    tags: ['remoto', 'origin', 'repositorio remoto', 'git', 'remote'],
    d: [cloud, line([12, base], [12, y - GR]), node(12, y), line([12, y + GR], [12, 20.75])],
  };
}
// Merge queue: beside the trunk, a short track of three commits in line (git-graph's rings, r 1.9,
// joined by links of 2), the first one tied by a curve to the trunk's top commit: next to merge. A
// lane of dots under a curve (the draft's) read as an h and a colon at 18 px.
{
  const r = 1.9;
  const ys = [7.75, 13.55, 19.35];
  icons['git-merge-queue'] = {
    tags: ['cola de fusión', 'merge queue', 'en espera', 'git', 'queued pull requests'],
    d: [
      node(TX, 5.6),
      line([TX, 7.95], [TX, 20.75]),
      `M${pt([BX - r, ys[0]])}C12.5 ${ys[0]} 13.25 5.6 ${pt([TX + GR, 5.6])}`,
      ...ys.map((y) => circ(BX, y, r)),
      line([BX, ys[0] + r], [BX, ys[1] - r]),
      line([BX, ys[1] + r], [BX, ys[2] - r]),
    ],
  };
}
// Blame: who changed each line: the person in the editor's gutter, a divider, and the lines of code
// beside it, the person level with the middle one. The core person at 50 %, its head lifted so head
// and shoulders keep 2.85 apart (scaled, they were 1.2 apart and merged at regular). Without the
// gutter, a person beside lines read as a contact card.
{
  const P = N.person.d.map((d, i) => xf(d, 0.5, [12, 12.17], -6.25, i ? 0 : -1.65));
  icons['git-blame'] = {
    tags: ['autoría', 'quién cambió', 'anotar', 'git', 'blame', 'annotate'],
    d: [...P, line([12.25, 3.25], [12.25, 20.75]), line([15.25, 6.5], [20.75, 6.5]), line([15.25, 12], [20.75, 12]), line([15.25, 17.5], [18.75, 17.5])],
  };
}
// Submodule: git-graph's column of commits whose middle node is a repository (a small square).
icons['git-submodule'] = {
  tags: ['submódulo', 'repositorio anidado', 'dependencia', 'git', 'submodule'],
  d: [circ(12, 5.15, 1.9), line([12, 7.05], [12, 9.38]), sq(9.38, 9.38, 5.25, 5.25, 1.5), line([12, 14.63], [12, 16.95]), circ(12, 18.85, 1.9)],
};
// The adopted git icons with the engine's badges: the same drawing, fill and parts
for (const [name, base, kind, tags] of [
  ['git-merge-conflict', 'git-merge', 'alert', ['conflicto', 'conflicto de fusión', 'choque de cambios', 'git', 'merge conflict']],
  ['git-branch-plus', 'git-branch', 'plus', ['nueva rama', 'crear rama', 'ramificar', 'git', 'new branch']],
  ['git-branch-lock', 'git-branch', 'lock', ['rama protegida', 'bloqueada', 'reglas de rama', 'git', 'protected branch']],
  ['git-branch-sync', 'git-branch', 'sync', ['actualizar rama', 'sincronizar', 'traer de la base', 'git', 'update branch', 'sync upstream']],
  ['git-pull-request-check', 'git-pull-request', 'check', ['pull request aprobado', 'listo para fusionar', 'revisión aprobada', 'git', 'approved', 'checks passed']],
  ['git-pull-request-plus', 'git-pull-request', 'plus', ['nuevo pull request', 'abrir pull request', 'proponer cambios', 'git', 'new pull request']],
  ['git-commit-edit', 'git-commit', 'edit', ['editar commit', 'enmendar', 'cambiar mensaje', 'git', 'amend commit']],
])
  icons[name] = { tags, d: [...D[base].d], badge: badge(kind), base };

// Code review and issues ------------------------------------------------------------------------
// Issue (open): the ring and a single dot at its center.
icons.issue = {
  tags: ['incidencia', 'issue', 'reporte', 'tarea abierta', 'ticket', 'bug report'],
  d: [circ(12, 12, 9), dot(12, 12)],
};
// Review comment: the speech drop hangs on the end of the middle line of code (indented, as code
// is); the lines above and below stop 3.9 or more from the drop.
icons['code-comment'] = {
  tags: ['comentario de código', 'revisión', 'nota en línea', 'code review', 'review comment'],
  d: [drop(16.75, 12, 4), line([6.25, 12], [12.75, 12]), line([3.25, 4.75], [13.5, 4.75]), line([3.25, 19.25], [10.5, 19.25])],
};
// Diffs: the old and the new, side by side (a landscape panel split down the middle) or in one
// column (minus above plus, each leading its line), on the same panel. The signs keep 2.9 from every
// edge (the unified one's a quarter further in, clear of the corner); there each line is longer than
// its sign (sign and line the same length read as a dashed line), and the plus sits 2.9 above the
// bottom edge.
const DIFF = box(2.5, 5, 19, 14, 4);
icons['diff-split'] = {
  tags: ['diferencias lado a lado', 'comparar versiones', 'vista dividida', 'split diff', 'side by side'],
  d: [DIFF, line([12, 5], [12, 19]), line([5.4, 12], [9.1, 12]), line([16.75, 10.15], [16.75, 13.85]), line([14.9, 12], [18.6, 12])],
};
icons['diff-unified'] = {
  tags: ['diferencias unificadas', 'cambios', 'agregado y quitado', 'unified diff', 'changes'],
  d: [
    DIFF,
    line([5.65, 8.75], [9.35, 8.75]),
    line([12.25, 8.75], [18.5, 8.75]),
    line([7.5, 12.4], [7.5, 16.1]),
    line([5.65, 14.25], [9.35, 14.25]),
    line([12.25, 14.25], [16.5, 14.25]),
  ],
};
// Three-way merge: both sides on top, each sending an arrow down into the result below (the arrows
// touch both).
icons['merge-editor'] = {
  tags: ['editor de fusión', 'resolver conflictos', 'tres vías', 'merge editor', 'resolve conflicts'],
  d: [box(3.25, 14.75, 17.5, 6, 2.5), box(3.25, 3.25, 7, 5, 2), box(13.75, 3.25, 7, 5, 2), ...arrow([6.75, 8.25], [6.75, 14.75], 2.5), ...arrow([17.25, 8.25], [17.25, 14.75], 2.5)],
};
// Developer documentation: Archivos' open book with a chevron on each page, pointing out.
icons['book-open-code'] = {
  tags: ['documentación', 'referencia de api', 'manual de desarrollo', 'docs', 'api reference', 'developer docs'],
  d: [
    ...archivos.icons['book-open'].d,
    line([8.5, 10.25], [6.25, 12.6], [8.5, 14.95]),
    line([15.5, 10.25], [17.75, 12.6], [15.5, 14.95]),
  ],
};

// Debugging -------------------------------------------------------------------------------------
// The gutter marker: a pentagon pointing right with a short line of code running on from its tip.
// The conditional one has an equals sign cut inside; the logpoint is the same marker as a diamond.
const MARK = roundpoly([[3.25, 7.25], [11.75, 7.25], [16, 12], [11.75, 16.75], [3.25, 16.75]], [1.75, 1.25, 1.25, 1.25, 1.75]);
const MARK_LINE = line([15.37, 12], [20.75, 12]);
icons['debug-breakpoint'] = {
  tags: ['punto de interrupción', 'breakpoint', 'depurar', 'pausar', 'debug'],
  d: [MARK, MARK_LINE],
};
icons['debug-breakpoint-conditional'] = {
  tags: ['punto condicional', 'breakpoint condicional', 'condición', 'depurar', 'conditional breakpoint'],
  d: [MARK, MARK_LINE, line([6.25, 10.5], [10.75, 10.5]), line([6.25, 13.5], [10.75, 13.5])],
};
icons['debug-logpoint'] = {
  tags: ['logpoint', 'punto de registro', 'registrar mensaje', 'depurar', 'log message'],
  d: [roundpoly([[3.25, 12], [9.63, 5.63], [16, 12], [9.63, 18.38]], 1.25), line([15.48, 12], [20.75, 12])],
};
// Continue: the stop bar and the set's play triangle (Dispositivos), 2.85 apart.
icons['debug-continue'] = {
  tags: ['continuar', 'reanudar', 'seguir ejecución', 'depurar', 'continue', 'resume'],
  d: [line([5.35, 6.25], [5.35, 17.75]), transform(dispositivos.icons.play.d[0], 1, 0.7, 0)],
};
// Stepping. Over: an arc leaps over the current statement (a dot); back is its mirror. Into: the
// arrow runs down from the start of a line and turns right onto an indented line below; out is the
// same drawing turned half a circle, the arrow rising from the indented line back to the outer one.
const OVER = (() => {
  const a = arc(12, 13.25, 7, 180, 360);
  return [a.d, head(a.end, a.tangent, 3.4), dot(12, 16.75)];
})();
icons['step-over'] = { tags: ['saltar línea', 'paso por encima', 'siguiente instrucción', 'depurar', 'step over'], d: OVER };
// (the dot is drawn again, not flipped: a flipped dot is no longer one the engine recognizes)
icons['step-back'] = { tags: ['paso atrás', 'retroceder', 'depuración inversa', 'depurar', 'step back'], d: [...OVER.slice(0, 2).map((d) => flipPath(d)), dot(12, 16.75)] };
const INTO = [line([3.25, 7], [16, 7]), rline([[3.25, 7], [3.25, 16], [10, 16]], 3), head([10, 16], [1, 0], 3.4), line([12.85, 16], [20.75, 16])];
icons['step-into'] = { tags: ['entrar en función', 'paso a paso', 'depurar', 'step into', 'enter function'], d: INTO };
icons['step-out'] = { tags: ['salir de función', 'volver al llamador', 'depurar', 'step out', 'return'], d: INTO.map((d) => turnPath(d, 180)) };
// Run to cursor: the line of code runs right as an arrow and stops at the text cursor (Edición's
// I-beam), 2.85 short of it.
icons['run-to-cursor'] = {
  tags: ['ejecutar hasta el cursor', 'correr hasta aquí', 'depurar', 'run to cursor'],
  d: [...arrow([3.25, 12], [14.4, 12], 4), ...edicion.icons['text-cursor'].d.map((d) => transform(d, 1, 5.25, 0))],
};
// Call stack: three frames stacked (the chart bars' 3.75 and 3.13 between them) and the pointer at
// the current one, 3 from it (smaller, its hole closed and it read as a dot at 18 px).
icons['call-stack'] = {
  tags: ['pila de llamadas', 'stack trace', 'traza', 'depurar', 'call stack'],
  d: [3.25, 10.13, 17].map((y) => sq(10.25, y, 10.5, 3.75, 1.15)).concat(roundpoly([[2.75, 2.85], [7.25, 5.13], [2.75, 7.4]], 0.8)),
};
// Watch: Datos' variable braces with an open eye between them.
icons['watch-expression'] = {
  tags: ['inspeccionar', 'observar variable', 'expresión', 'depurar', 'watch'],
  d: [...D.variable.d.slice(0, 2), 'M8.25 12C9.4 9.75 10.6 8.25 12 8.25S14.6 9.75 15.75 12C14.6 14.25 13.4 15.75 12 15.75S9.4 14.25 8.25 12Z', dot(12, 12)],
};
// Flame graph: rows of the chart bars stacked on the widest, each row narrower and split.
{
  const bar = (x0, x1, y) => sq(x0, y, x1 - x0, 3.75, 1.15);
  icons['flame-graph'] = {
    tags: ['gráfica de llama', 'perfilador', 'rendimiento', 'flame graph', 'profiler'],
    d: [bar(3.25, 20.75, 17), bar(3.25, 12.5, 10.13), bar(15.5, 18.75, 10.13), bar(3.25, 8.5, 3.25)],
  };
}
// Hot reload: Datos' automation cycle with a flame inside. Lugares' flame, scaled down without its
// core, read as a drop (and the memory leak's drop is a drop): this one has a second tongue on its
// left, the outline of fire. Its tip rises into the cycle's opening, 3 from the arc's end; its base
// keeps 3 from the arc.
icons['hot-reload'] = {
  tags: ['recarga en caliente', 'hot reload', 'recarga en vivo', 'live reload', 'refrescar'],
  d: [
    ...D.automation.d.slice(0, 2),
    'M12 18C9.65 18 8 16.35 8 14.15 8 12.35 9 11.05 9.9 10.15 10.1 11.45 10.8 12.25 11.6 12.55 11.2 10.15 12.2 7.65 14.1 6 14.3 8.35 16 10.35 16 13.65 16 16.15 14.35 18 12 18Z',
  ],
};
// Recursion: a function that calls itself, the set's function sign (Datos) inside the automation
// cycle. A box with an arrow looping back into it read as a bag, a toggle or two frames at 18 px.
icons.recursion = {
  tags: ['recursión', 'función recursiva', 'se llama a sí misma', 'recursion', 'recursive'],
  d: [...D.automation.d.slice(0, 2), ...D.function.d.map((d) => xf(d, 0.55, [11.5, 12.25]))],
};
// Memory leak: Datos' memory module dripping: a drop hangs from its lower edge under the right chip,
// in place of the last two pins (its point on the edge). Centered under the notch, between the two
// chips, the drop made the module a face with a nose.
{
  const [c, r, tipY] = [[18.5, 19.25], 1.9, 15.5];
  const t = Math.asin(r / (c[1] - tipY)) * (180 / Math.PI);
  const leak = `M${pt([c[0], tipY])}L${pt(polar(...c, r, -t))}A${r} ${r} 0 1 1 ${pt(polar(...c, r, 180 + t))}Z`;
  icons['memory-leak'] = {
    tags: ['fuga de memoria', 'memoria', 'perfilador', 'memory leak', 'ram'],
    d: [...D.memory.d.slice(0, 3), 'M5.5 15.5L5.5 18.5M8.5 15.5L8.5 18.5M11.5 15.5L11.5 18.5', leak],
  };
}
// The bug with badges: the engine's, or the play triangle cut from the disc (start debugging)
icons['bug-play'] = { tags: ['iniciar depuración', 'depurar', 'ejecutar con depurador', 'start debugging', 'debug run'], d: D.bug.d, badge: PLAY(), base: 'bug' };
for (const [name, kind, tags] of [
  ['bug-check', 'check', ['error corregido', 'resuelto', 'arreglado', 'bug fixed', 'resolved']],
  ['bug-plus', 'plus', ['reportar error', 'nuevo bug', 'agregar error', 'report bug', 'new bug']],
  ['bug-search', 'search', ['rastrear errores', 'buscar bugs', 'monitoreo de errores', 'error tracking', 'find bugs']],
])
  icons[name] = { tags, d: D.bug.d, badge: badge(kind), base: 'bug' };
icons['braces-alert'] = { tags: ['excepción', 'error de sintaxis', 'error de código', 'exception', 'syntax error'], d: D.braces.d, badge: badge('alert'), base: 'braces' };
icons['code-search'] = { tags: ['buscar código', 'buscar en archivos', 'búsqueda de código', 'code search', 'find in files'], d: N.code.d, badge: badge('search'), base: 'code' };
icons['code-play'] = { tags: ['ejecutar código', 'correr', 'ejecutar celda', 'run code', 'run'], d: N.code.d, badge: PLAY(), base: 'code' };

// Code tools ------------------------------------------------------------------------------------
// Snippet: a landscape card torn along the bottom (Comercio's receipt teeth, 1.5 deep) holding the
// code sign, < / >: a piece cut from a longer file. With only the two chevrons, set like a pair of
// eyes over the torn hem, it read as a ghost. The chevrons stand 3.1 from the slash (the core sign
// at half size closed up to 1.5).
{
  const [x, y, w, h, teeth, depth] = [2.5, 4.5, 19, 15, 6, 1.5];
  const card = sq(x, y, w, h, 3.5, { square: ['br', 'bl'] });
  const step = w / teeth;
  const zig = [];
  for (let i = 1; i < teeth * 2; i++) zig.push([x + w - (step / 2) * i, i % 2 ? y + h - depth : y + h]);
  const edge = `L${pt([x + w, y + h])}L${pt([x, y + h])}`;
  icons['code-snippet'] = {
    tags: ['fragmento de código', 'snippet', 'gist', 'código compartido', 'code snippet'],
    d: [card.replace(edge, `L${pt([x + w, y + h])}${zig.map((p) => `L${pt(p)}`).join('')}L${pt([x, y + h])}`), line([8, 8.75], [5.75, 11.25], [8, 13.75]), line([13, 8], [11, 14.5]), line([16, 8.75], [18.25, 11.25], [16, 13.75])],
  };
}
// Completion: a line of code ends at the text cursor (Edición's I-beam at 36 %, as in multi-cursor),
// and the suggestions drop below it (a list box with two rows, 3 from its edges). With a plain bar
// for the caret, the line and the bar read as a flag on a box.
icons['code-completion'] = {
  tags: ['autocompletar', 'sugerencias', 'intellisense', 'completado de código', 'autocomplete', 'code completion'],
  d: [
    box(8.25, 11.75, 12.5, 9, 2.5),
    line([3.25, 5.5], [8.25, 5.5]),
    xf(edicion.icons['text-cursor'].d.join(''), 0.36, [12, 12], -0.75, -6.5),
    line([11.25, 14.75], [17.75, 14.75]),
    line([11.25, 17.75], [15.5, 17.75]),
  ],
};
// Notebook: two cells, each with a line of code and the play triangle in its margin.
{
  const play = (cy) => roundpoly([[3.25, cy - 2.25], [6.75, cy], [3.25, cy + 2.25]], 0.75);
  icons['code-notebook'] = {
    tags: ['cuaderno', 'notebook', 'celdas', 'jupyter', 'code notebook'],
    d: [box(9.25, 3.25, 11.5, 7.5, 2.5), box(9.25, 13.25, 11.5, 7.5, 2.5), play(7), play(17), line([12.25, 7], [17.75, 7]), line([12.25, 17], [15.75, 17])],
  };
}
// Coverage: the code chevrons inside three quarters of a ring, as Comercio's budget; the ring is a
// value, drawn as far as the tests reach.
icons['code-coverage'] = {
  tags: ['cobertura de código', 'pruebas', 'porcentaje cubierto', 'code coverage', 'test coverage'],
  d: [arc(12, 12, 9, -90, 180).d, line([9.5, 9], [6.75, 12], [9.5, 15]), line([14.5, 9], [17.25, 12], [14.5, 15])],
};
// Format: lines of code against the indent guide, the middle one an arrow that pushes it flush.
icons['code-format'] = {
  tags: ['formatear código', 'dar formato', 'alinear', 'prettier', 'format document'],
  d: [line([4.25, 3.25], [4.25, 20.75]), line([7.25, 6.5], [20.75, 6.5]), ...arrow([17.75, 12], [7.25, 12]), line([7.25, 17.5], [15.75, 17.5])],
};
// Multiple cursors: three text cursors (Edición's I-beam at 36 %, one stroke each) stepping down to
// the right, each at the end of a line. Plain carets after the lines read as a staircase of tees.
{
  const beam = edicion.icons['text-cursor'].d.join('');
  icons['multi-cursor'] = {
    tags: ['cursores múltiples', 'edición múltiple', 'varias selecciones', 'multi-cursor', 'multiple cursors'],
    d: [[5.25, 9.5], [12, 14.75], [18.75, 20]].flatMap(([y, x]) => [line([3.25, y], [x - 3, y]), xf(beam, 0.36, [12, 12], x - 12, y - 12)]),
  };
}
// Lint: the problem's wavy underline under the middle line, 3 from the lines around it.
{
  const [x0, y, a, half, n] = [3.25, 14.65, 1.25, 2.25, 6];
  let wave = `M${pt([x0, y])}`;
  for (let i = 0; i < n; i++) {
    const s = i % 2 ? 1 : -1;
    const xa = x0 + i * half;
    wave += `C${pt([xa + half / 3, y + s * a * 1.33])} ${pt([xa + (2 * half) / 3, y + s * a * 1.33])} ${pt([xa + half, y])}`;
  }
  icons.lint = {
    tags: ['linter', 'análisis estático', 'advertencia de código', 'problemas', 'lint', 'warnings'],
    d: [line([3.25, 5.15], [16.5, 5.15]), line([3.25, 10.4], [20.75, 10.4]), wave, line([3.25, 18.9], [12.5, 18.9])],
  };
}
// Quick fix: Producto's lightbulb (Sistema's, shifted for a badge) with a small wrench crossing its
// base: an open jaw and its handle, the engine clearing the bulb under it.
{
  const C = [18.25, 15.75];
  const jaw = arc(...C, 2.75, 5, 265).d;
  const handle = line(polar(...C, 2.75, 135), [14, 21]);
  icons['lightbulb-wrench'] = {
    tags: ['arreglo rápido', 'acción de código', 'sugerencia', 'quick fix', 'code action'],
    d: producto.icons['lightbulb-check'].d,
    badge: own([jaw, handle], `${circ(...C, 2.75)}M${pt(polar(...C, 2.75, 135))}L14 21Z`),
  };
}
// Minify: three short lines squeezed between two arrows pointing in.
icons.minify = {
  tags: ['minificar', 'comprimir código', 'reducir tamaño', 'minify', 'uglify'],
  d: [line([9.85, 8], [14.15, 8]), line([9.85, 12], [14.15, 12]), line([9.85, 16], [14.15, 16]), ...arrow([2.5, 12], [7, 12], 3), ...arrow([21.5, 12], [14.15 + 2.85, 12], 3)],
};

// Structures and diagrams -----------------------------------------------------------------------
// Class: the UML class box, its name band and two member bands with a member line each.
icons['class-diagram'] = {
  tags: ['clase', 'diagrama de clases', 'uml', 'objeto', 'class diagram'],
  d: [box(4.75, 2.75, 14.5, 18.5, 3.75), line([4.75, 8], [19.25, 8]), line([4.75, 14.25], [19.25, 14.25]), line([8, 11.13], [14.5, 11.13]), line([8, 17.75], [12.5, 17.75])],
};
// Inheritance: the smaller class below extends the one above (UML's hollow triangle, its point on
// the upper box's edge).
{
  const [base, half, r, top] = [12.75, 2.75, 0.6, 9];
  // The apex sits so that its rounded tip lands on the edge
  let ya = top;
  for (let k = 0; k < 20; k++) ya = top - r * (1 / Math.sin(Math.atan(half / (base - ya))) - 1);
  icons.inheritance = {
    tags: ['herencia', 'extiende', 'jerarquía de clases', 'uml', 'inheritance', 'extends'],
    d: [box(6.25, 2.75, 11.5, 6.25, 2.25), roundpoly([[12, ya], [12 + half, base], [12 - half, base]], r), line([12, base], [12, 15.25]), box(7.5, 15.25, 9, 6, 2.25)],
  };
}
// Sequence: two participants with dashed lifelines; a message goes across and the reply comes back
// below it. The dashes fall where the arrows meet the lifelines.
{
  const life = (x) => [[7.25, 9.75], [12.6, 15.4], [18.25, 20.75]].map(([a, b]) => line([x, a], [x, b])).join('');
  icons['sequence-diagram'] = {
    tags: ['diagrama de secuencia', 'mensajes', 'uml', 'interacción', 'sequence diagram'],
    d: [box(2.75, 2.75, 7, 4.5, 1.75), box(14.25, 2.75, 7, 4.5, 1.75), life(6.25), life(17.75), ...arrow([6.25, 14], [17.75, 14], 2.5), ...arrow([17.75, 19.5], [6.25, 19.5], 2.5)],
  };
}
// Linked list: three nodes, each pointing at the next (the arrowhead touching it; the arms keep 2.85
// from the node behind).
{
  const [w, gap] = [3.5, 4.25];
  const xs = [2.5, 2.5 + w + gap, 2.5 + 2 * (w + gap)];
  icons['linked-list'] = {
    tags: ['lista enlazada', 'nodos', 'estructura de datos', 'linked list', 'pointers'],
    d: [...xs.map((x) => sq(x, 12 - w / 2, w, w, 1.1)), ...arrow([xs[0] + w, 12], [xs[1], 12], 2), ...arrow([xs[1] + w, 12], [xs[2], 12], 2)],
  };
}
// Binary tree: the root, two children on diagonals, and the left child's two children.
{
  const r = 1.75;
  const P = { root: [13.5, 4.5], l: [8.5, 12], r: [18.5, 12], ll: [5.25, 19.5], lr: [11.75, 19.5] };
  const edge = (p, q) => {
    const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
    const L = Math.hypot(dx, dy);
    return line([p[0] + (dx / L) * r, p[1] + (dy / L) * r], [q[0] - (dx / L) * r, q[1] - (dy / L) * r]);
  };
  icons['binary-tree'] = {
    tags: ['árbol binario', 'árbol', 'nodos', 'estructura de datos', 'binary tree'],
    d: [...Object.values(P).map((p) => circ(...p, r)), edge(P.root, P.l), edge(P.root, P.r), edge(P.l, P.ll), edge(P.l, P.lr)],
  };
}
// Hash map: a column of three slots; two of them point at their values on the right.
icons['hash-map'] = {
  tags: ['mapa hash', 'diccionario', 'tabla hash', 'clave valor', 'hash map', 'dictionary'],
  d: [
    box(3.25, 3.25, 6.5, 17.5, 2.25),
    line([3.25, 9.08], [9.75, 9.08]),
    line([3.25, 14.92], [9.75, 14.92]),
    box(15.25, 3.92, 5.5, 4.5, 1.5),
    box(15.25, 15.58, 5.5, 4.5, 1.5),
    ...arrow([9.75, 6.17], [15.25, 6.17], 2.5),
    ...arrow([9.75, 17.83], [15.25, 17.83], 2.5),
  ],
};

// Build and delivery ----------------------------------------------------------------------------
// The pipeline: a stage, two parallel jobs stacked, and a last stage. The run forks from the first
// stage to the jobs and joins again at the last on the git lanes' curves, side to side (joined corner
// to corner on short diagonals, the four boxes huddled into one cross at 18 px). Its axis sits 0.75
// above the center: there the badges' clearance cuts the last stage and the lower job cleanly.
const STAGE = (x, y) => sq(x, y - 2, 4, 4, 1.25);
const PY = 11.25;
const fork = (a, b) => `M${pt(a)}C${pt([(a[0] + b[0]) / 2, a[1]])} ${pt([(a[0] + b[0]) / 2, b[1]])} ${pt(b)}`;
const PIPELINE = [
  STAGE(2.5, PY),
  STAGE(10, PY - 5.25),
  STAGE(10, PY + 5.25),
  STAGE(17.5, PY),
  fork([6.5, PY], [10, PY - 5.25]),
  fork([6.5, PY], [10, PY + 5.25]),
  fork([14, PY - 5.25], [17.5, PY]),
  fork([14, PY + 5.25], [17.5, PY]),
];
icons['ci-pipeline'] = { tags: ['pipeline', 'integración continua', 'ci/cd', 'flujo de trabajo', 'workflow run'], d: PIPELINE };
for (const [name, kind, tags] of [
  ['ci-pipeline-check', 'check', ['pipeline exitoso', 'pasó', 'build verde', 'pipeline passed', 'success']],
  ['ci-pipeline-x', 'x', ['pipeline fallido', 'falló', 'build rojo', 'pipeline failed', 'failure']],
  ['ci-pipeline-clock', 'clock', ['pipeline en cola', 'programado', 'pendiente', 'pipeline queued', 'scheduled']],
])
  icons[name] = { tags, d: PIPELINE, badge: badge(kind) };

// The package being made, shipped and rolled back is the core box (the package), scaled
const cube = (s, cx, cy) => N.box.d.map((d) => xf(d, s, [12, 12], cx - 12, cy - 12));
// Build: Sistema's hammer at 60 %, as Sistema draws it (at 45°, its head up and to the right), its
// handle coming down onto the package's top; the engine clears the cube under it. At that size the
// handle is a single stroke down the middle of Sistema's (its two sides, 1.8 apart, closed up at
// bold). Turned upright to strike straight down, its head on a level handle read as a tap over a box
// at 18 px.
const HAMMER = [xf(sistema.icons.hammer.d[0], 0.6, [12, 12], 3.5, -3.5), line([15.84, 8.16], [11.55, 12.45])];
icons.build = {
  tags: ['compilar', 'construir', 'build', 'compilación', 'compile'],
  d: cube(0.6, 9.25, 14.5),
  badge: own(HAMMER, `${HAMMER[0]}${HAMMER[1]}Z`, { solid: [HAMMER[0]], wire: [HAMMER[1]] }),
};
// Artifact: two stages of the run and, at the end of the line, the package it produced.
icons['build-artifact'] = {
  tags: ['artefacto', 'resultado del build', 'paquete generado', 'artifact', 'build output'],
  d: [...cube(0.4, 18, 12), sq(2.5, 10, 4, 4, 1.25), line([6.5, 12], [8.5, 12]), sq(8.5, 10, 4, 4, 1.25), line([12.5, 12], [14.56, 12])],
};
// Test results: a check, a check and an x, each leading its line.
{
  const check = (cx, cy, w) => line([cx - w * 0.5, cy + w * 0.04], [cx - w * 0.15, cy + w * 0.38], [cx + w * 0.5, cy - w * 0.34]);
  icons['test-results'] = {
    tags: ['resultados de pruebas', 'tests', 'pasaron y fallaron', 'reporte de pruebas', 'test results'],
    d: [
      check(5.5, 5.75, 4.5),
      line([10.6, 5.5], [20.75, 5.5]),
      check(5.5, 12.25, 4.5),
      line([10.6, 12], [18, 12]),
      line([3.9, 16.9], [7.1, 20.1]),
      line([7.1, 16.9], [3.9, 20.1]),
      line([10.6, 18.5], [16, 18.5]),
    ],
  };
}
// Deploy: the package rises off its base line on an up arrow (the arrow stands on the line, its tip 3
// under the package). Two motion lines under the package, side by side, read as its legs.
const DEPLOY = [...cube(0.55, 12, 7.25), ...arrow([12, 20.75], [12, 15], 2.75), line([6.5, 20.75], [17.5, 20.75])];
icons.deploy = { tags: ['desplegar', 'publicar', 'lanzar a producción', 'deploy', 'ship'], d: DEPLOY };
icons['deploy-check'] = { tags: ['despliegue exitoso', 'en producción', 'publicado', 'deployed', 'live'], d: DEPLOY, badge: badge('check') };
icons['deploy-x'] = { tags: ['despliegue fallido', 'error al publicar', 'falló', 'deploy failed', 'failed deployment'], d: DEPLOY, badge: badge('x') };
// Rollback: the package inside the core refresh arrow, mirrored: it turns back.
icons.rollback = {
  tags: ['revertir despliegue', 'rollback', 'volver a la versión anterior', 'deshacer', 'roll back'],
  d: [...cube(0.45, 12, 12.75), ...N.refresh.d.map((d) => flipPath(d))],
};
// Blue-green: two identical environments; the arc switches the traffic from the left one to the
// right one, its head on the second package's top.
{
  const a = arc(12, 10.58, 5.25, 180, 360);
  icons['blue-green-deploy'] = {
    tags: ['despliegue azul verde', 'cambiar entorno', 'sin tiempo de caída', 'blue-green deployment', 'switch traffic'],
    d: [...cube(0.45, 6.75, 14.75), ...cube(0.45, 17.25, 14.75), a.d, head(a.end, a.tangent, 3)],
  };
}
// Dependency: a package and, down the line, the smaller one it relies on: the line leaves the
// package's side, steps down and lands on the small one's top vertex, the arrowhead's arms 3 clear
// of its edges (against its short side they came within 2).
const DEPENDENCY = [...cube(0.55, 7, 7.5), rline([[11.73, 7.5], [16.75, 7.5], [16.75, 17.25 - 8.84 * 0.4]], 2), head([16.75, 17.25 - 8.84 * 0.4], [0, 1], 3.4), ...cube(0.4, 16.75, 17.25)];
icons.dependency = { tags: ['dependencia', 'paquete', 'librería', 'dependency', 'package'], d: DEPENDENCY };
icons['dependency-arrow-up'] = { tags: ['actualizar dependencias', 'nueva versión', 'subir versión', 'upgrade dependencies', 'bump'], d: DEPENDENCY, badge: badge('arrow-up') };
// Circular dependency: two packages side by side and two arcs between them, over and under, each
// pointing at the other: a loop. The heads land on the packages' inner faces, off their vertices
// (landing on a vertex, a head's arms and the cube's two edges crossed as an X).
{
  // Each arc leaves one package from its vertex (on the arc's circle) and stops pointing at the other
  const [c0, c1] = [[12, 10.5], [12, 15]];
  const r = Math.hypot(5.75, 10.5 - 8.96);
  const a0 = 180 + (Math.atan2(10.5 - 8.96, 5.75) * 180) / Math.PI;
  const top = arc(...c0, r, a0, 320);
  const bottom = arc(...c1, r, a0 - 180, 140);
  icons['circular-dependency'] = {
    tags: ['dependencia circular', 'ciclo', 'referencia circular', 'circular dependency', 'cycle'],
    d: [...cube(0.42, 6.25, 12.75), ...cube(0.42, 17.75, 12.75), top.d, arcHead(top, c0, 2.75), bottom.d, arcHead(bottom, c1, 2.75)],
  };
}
// SDK: a toolbox, its wide bar handle on two posts, with the code sign on its face (Datos' code
// window's chevrons): a kit for developers. With the brackets standing on its lid as the handle, it
// read as a basket at 18 px.
icons.sdk = {
  tags: ['sdk', 'kit de desarrollo', 'librería cliente', 'herramientas', 'software development kit'],
  d: [
    box(2.5, 8.25, 19, 12.5, 3.5),
    'M7.5 8.25V6.25a1.5 1.5 0 0 1 1.5-1.5h6a1.5 1.5 0 0 1 1.5 1.5v2',
    line([9.5, 11.75], [7.25, 14.5], [9.5, 17.25]),
    line([14.5, 11.75], [16.75, 14.5], [14.5, 17.25]),
  ],
};
// Microservices: four small services around a hub, each linked to it from its inner corner.
{
  const k = 0.3 * 1.5;
  const hub = 1.75;
  const corner = (x, y) => [x + Math.sign(12 - x) * -k, y + Math.sign(12 - y) * -k];
  const ends = [[8.75, 8.75], [15.25, 8.75], [8.75, 15.25], [15.25, 15.25]].map(([x, y]) => corner(x, y));
  const toHub = (p) => {
    const v = [12 - p[0], 12 - p[1]];
    const L = Math.hypot(...v);
    return line(p, [12 - (v[0] / L) * hub, 12 - (v[1] / L) * hub]);
  };
  icons.microservices = {
    tags: ['microservicios', 'servicios', 'arquitectura distribuida', 'microservices', 'services'],
    d: [sq(3.25, 3.25, 5.5, 5.5, 1.5), sq(15.25, 3.25, 5.5, 5.5, 1.5), sq(3.25, 15.25, 5.5, 5.5, 1.5), box(15.25, 15.25, 5.5, 5.5, 1.5), circ(12, 12, hub), ...ends.map(toHub)],
  };
}
// Infrastructure as code: Datos' server with the angle brackets cut from the badge disc.
{
  const sign = [line([16, 15.75], [14.75, 17.25], [16, 18.75]), line([18.5, 15.75], [19.75, 17.25], [18.5, 18.75])];
  const d16 = [line(AT(-1, -2), AT(-3, 0), AT(-1, 2)), line(AT(1, -2), AT(3, 0), AT(1, 2))];
  icons['server-code'] = {
    tags: ['infraestructura como código', 'iac', 'servidor', 'configuración', 'infrastructure as code'],
    d: D.server.d,
    badge: status(sign, d16),
    base: 'server',
  };
}
// Storage bucket: a pail, wider at the top, its open rim an ellipse (as the database's lid) and its
// handle arching over it from the rim's ends. A flat rim under the handle with a package in front
// read as a helmet at 18 px.
{
  const [cx, rx, ry, top, bot, bx] = [12, 8.25, 2.75, 11, 20.75, 5.75];
  const L = [cx - rx, top];
  const Rt = [cx + rx, top];
  const body = `M${pt(L)}L${pt([cx - bx, bot - 1.25])}Q${pt([cx, bot + 1.25])} ${pt([cx + bx, bot - 1.25])}L${pt(Rt)}`;
  const rim = `M${pt(L)}A${rx} ${ry} 0 1 0 ${pt(Rt)}A${rx} ${ry} 0 1 0 ${pt(L)}Z`;
  const handle = `M${pt(L)}A${rx} 7.5 0 0 1 ${pt(Rt)}`;
  icons['storage-bucket'] = {
    tags: ['bucket', 'almacenamiento de objetos', 'blobs', 'archivos en la nube', 'object storage'],
    d: [body, rim, handle],
    // Filled: the pail and its rim one solid, the rim's front edge cut, the handle apart
    fill: { solid: [`${body}A${rx} ${ry} 0 0 0 ${pt(L)}Z`], cut: [`M${pt(L)}A${rx} ${ry} 0 0 0 ${pt(Rt)}`], lines: [handle] },
  };
}
// Container image: Datos' container (ribbed), at 80 %, on the two layers it is built from.
icons['container-image'] = {
  tags: ['imagen de contenedor', 'capas', 'imagen docker', 'container image', 'image layers'],
  d: [...D.container.d.map((d) => xf(d, 0.8, [12, 12], 0, -3.65)), line([4.4, 16.8], [19.6, 16.8]), line([4.4, 19.8], [19.6, 19.8])],
};
// Emulator: a phone (Dispositivos', at 55 %) in front of a desktop window (Ventanas'), over its
// lower right corner; the engine clears the window under it.
{
  const P = dispositivos.icons.smartphone.d.map((d) => xf(d, 0.55, [12, 12], 5.35, 4.1));
  icons.emulator = {
    tags: ['emulador', 'simulador', 'dispositivo virtual', 'emulator', 'simulator'],
    d: ventanas.icons.window.d,
    badge: own(P, P[0], { solid: [P[0]], cut: [P[1]] }),
  };
}
// Developer mode: Dispositivos' phone at 75 % between a pair of angle brackets (its slot keeps the 3
// from the top it has at full size).
icons['developer-mode'] = {
  tags: ['modo desarrollador', 'opciones de desarrollo', 'desarrollo móvil', 'developer mode', 'developer options'],
  d: [xf(dispositivos.icons.smartphone.d[0], 0.75), line([10.75, 12 - 9.25 * 0.75 + 3], [13.25, 12 - 9.25 * 0.75 + 3]), line([4.75, 8.5], [2.75, 12], [4.75, 15.5]), line([19.25, 8.5], [21.25, 12], [19.25, 15.5])],
};

// Observability, workers and APIs ---------------------------------------------------------------
// Distributed trace: the request's span on top (the call stack's bars) and two shorter spans nested
// under it, each later than the one above, tied to it by a stem at the left.
{
  const span = (x0, x1, y) => sq(x0, y, x1 - x0, 3.75, 1.15);
  icons['distributed-trace'] = {
    tags: ['traza distribuida', 'trazas', 'spans', 'apm', 'distributed tracing', 'trace'],
    d: [span(3.25, 20.75, 3.25), span(9.25, 17.25, 10.13), span(12.75, 20.75, 17), rline([[5.75, 7], [5.75, 18.88], [12.75, 18.88]], 2.5), line([5.75, 12], [9.25, 12])],
  };
}
// Background worker: Sistema's gear at 62 %, a job coming in on the left and going out on the right
// (the arrows touch the teeth that face them).
{
  const s = 0.62;
  const G = sistema.icons.gear.d.map((d) => xf(d, s));
  const tooth = 12 - 9.14 * s;
  icons['background-worker'] = {
    tags: ['proceso en segundo plano', 'worker', 'tareas', 'trabajos', 'background job', 'job runner'],
    d: [...G, ...arrow([2, 12], [tooth, 12], 2.25), ...arrow([24 - tooth, 12], [22, 12], 2.25)],
  };
}
// Mock server: Datos' server with its two units drawn in dashes, a stand-in for the real one: each
// unit keeps its ends whole ([ and ], the square corner at the bottom right) and its long sides break
// once on each side of a short dash, 3 between the ends of each piece.
{
  const unit = (y) => {
    const [x0, x1, y1, r, a] = [4, 20, y + 6.5, 2, 3.75];
    const mid = (yy) => line([x0 + a + 3, yy], [x1 - a - 3, yy]);
    return [
      rline([[x0 + a, y], [x0, y], [x0, y1], [x0 + a, y1]], r),
      `${rline([[x1 - a, y], [x1, y], [x1, y1]], r)}L${pt([x1 - a, y1])}`,
      mid(y),
      mid(y1),
    ].join('');
  };
  icons['mock-server'] = {
    tags: ['servidor simulado', 'mock', 'stub', 'simulación de api', 'pruebas', 'mock server'],
    d: [unit(4), unit(13.5), line([7.5, 7.25], [11, 7.25]), dot(16, 7.25), line([7.5, 16.75], [11, 16.75]), dot(16, 16.75)],
  };
}
// API key: a key whose bow is a pair of Datos' braces (at 60 %), the shaft leaving the point of the
// right one, its two teeth hanging down.
{
  const s = 0.6;
  const left = transform(D.braces.d[0], s, 2.5 - 3.25 * s, 12 - 12 * s);
  const right = flipPath(left, 'x', 7.25);
  icons['api-key'] = {
    tags: ['clave de api', 'token', 'llave de acceso', 'credencial', 'api key', 'access token'],
    d: [left, right, rline([[12, 12], [20.75, 12], [20.75, 15.5]], 0.75), line([17.5, 12], [17.5, 14.75])],
  };
}
// API gateway: the single way in, a gap in a wall (rate-limit's gate): the request passes through
// it and fans out, on load-balancer's rounded forks, to three services (dots). An arch, upright or on
// its side, read as a figure or as a letter (∋) at 18 px.
{
  const [g, fork] = [8.5, 12.75];
  const route = (y) => rline([[fork, 12], [14.75, 12], [17.25, y], [20.5, y]], 1.5);
  icons['api-gateway'] = {
    tags: ['puerta de enlace', 'gateway de api', 'enrutar peticiones', 'punto de entrada', 'api gateway'],
    d: [line([g, 3.25], [g, 9]), line([g, 15], [g, 20.75]), line([2.75, 12], [20.5, 12]), route(5.5), route(18.5), dot(20.5, 5.5), dot(20.5, 12), dot(20.5, 18.5)],
  };
}
// Rate limit: three requests run into a gate; only the middle one passes through its gap.
{
  const [gx, rows] = [13.25, [5.5, 12, 18.5]];
  icons['rate-limit'] = {
    tags: ['límite de peticiones', 'rate limit', 'throttling', 'cuota', 'limitar tráfico', 'throttle'],
    d: [
      line([gx, 3.25], [gx, 9]),
      line([gx, 15], [gx, 20.75]),
      ...arrow([2.75, rows[0]], [gx - 2.85, rows[0]], 2.5),
      ...arrow([2.75, rows[1]], [21.25, rows[1]], 2.5),
      ...arrow([2.75, rows[2]], [gx - 2.85, rows[2]], 2.5),
    ],
  };
}
// Request and response: the server (Datos' two units, 6.5 tall and 3 apart; 9 wide, they keep only
// their light, as Redes' narrow units do) and the call: the request comes in to the upper unit and
// the response goes back out from the lower one, each arrow 3 short of the server. The client's
// window beside a tall server read as two batteries and went over 28 % ink; the arrows say who calls.
{
  const [x0, x1] = [12.5, 21.5];
  const unit = (y) => [box(x0, y, x1 - x0, 6.5, 2), dot(x1 - 3, y + 3.25)];
  icons['request-response'] = {
    tags: ['petición y respuesta', 'llamada http', 'cliente http', 'request', 'response', 'http request'],
    d: [...unit(4), ...unit(13.5), ...arrow([2.5, 7.25], [9.5, 7.25], 3), ...arrow([9.5, 16.75], [2.5, 16.75], 3)],
  };
}
// WebSocket: two ends joined by one line that stays open both ways (a head at each end) and carries
// a short zigzag: the live signal.
{
  const [y, a, b] = [12, 3.25, 20.75];
  icons.websocket = {
    tags: ['websocket', 'tiempo real', 'conexión persistente', 'bidireccional', 'realtime', 'socket'],
    d: [
      dot(a, y),
      dot(b, y),
      rline([[a + 3.6, y], [10, y], [11.25, y - 2.5], [12.75, y + 2.5], [14, y], [b - 3.6, y]], 0.5),
      head([a + 3.6, y], [-1, 0], 2.5),
      head([b - 3.6, y], [1, 0], 2.5),
    ],
  };
}
// Publish and subscribe: the publisher (a dot) sends one line into the topic (a tall slot); three
// lines leave it, one to each subscriber.
{
  const [bx, bw, rows, x1] = [8.75, 3.5, [5.75, 12, 18.25], 20.5];
  icons['pub-sub'] = {
    tags: ['publicar y suscribir', 'pub/sub', 'tema', 'difusión', 'mensajería', 'publish subscribe'],
    d: [sq(bx, 3.25, bw, 17.5, bw / 2), dot(3.5, 12), line([3.5, 12], [bx, 12]), ...rows.map((r) => line([bx + bw, r], [x1, r])), ...rows.map((r) => dot(x1, r))],
  };
}
// The terminal with the engine's badges: a scheduled job, a new session
icons['terminal-clock'] = { tags: ['tarea programada', 'cron', 'job programado', 'cron job', 'scheduled job'], d: D.terminal.d, badge: badge('clock'), base: 'terminal' };
icons['terminal-plus'] = { tags: ['nueva terminal', 'nueva sesión', 'abrir consola', 'new terminal', 'new session'], d: D.terminal.d, badge: badge('plus'), base: 'terminal' };
// Queue: a tube of three slots, a job coming in on the left and one going out on the right (the
// arrows touch its ends).
icons.queue = {
  tags: ['cola', 'cola de mensajes', 'cola de trabajos', 'fifo', 'queue', 'message queue'],
  d: [box(6.5, 7.5, 11, 9, 2.5), line([10.17, 7.5], [10.17, 16.5]), line([13.83, 7.5], [13.83, 16.5]), ...arrow([2, 12], [6.5, 12], 2.25), ...arrow([17.5, 12], [22, 12], 2.25)],
};
// Cache: the core bolt beside three stacked cards (the call stack's): stored copies, served fast.
const CACHE = [xf(N.bolt.d[0], 0.6, [12, 12], -6.25, 0), ...[3.25, 10.13, 17].map((y) => sq(12.5, y, 9, 3.75, 1.15))];
icons.cache = { tags: ['caché', 'memoria rápida', 'caché de compilación', 'cdn', 'cache'], d: CACHE };
icons['cache-x'] = { tags: ['limpiar caché', 'borrar caché', 'purgar', 'clear cache', 'purge cache'], d: CACHE, badge: badge('x') };

// ---------------------------------------------------------------------------------------------
// Fill (DESIGN.md › Fill): by index into d. `solid` is filled and keeps its stroke (closed shapes
// only); `closed` too, but it is an open stroke of the outline closed with Z; `cut` is knocked out;
// `lines` stays a line with clearance and `wire` stays a line attached to the fill (the git lanes).
// ---------------------------------------------------------------------------------------------
const FILL = {
  'git-rebase': { solid: [0, 2, 4], wire: [1, 3, 5, 6] },
  'git-cherry-pick': { solid: [0, 2], wire: [1, 3, 4, 5] },
  'git-stash': { solid: [1], wire: [0, 2, 3] },
  'git-stash-pop': { solid: [1], wire: [0, 2, 3] },
  'git-tag': { solid: [1, 4], wire: [0, 2, 3], cut: [5] },
  'git-revert': { solid: [0, 2], wire: [1, 3, 4] },
  'git-squash': { solid: [0, 1, 2, 6], wire: [3, 4, 5, 7] },
  'git-push': { solid: [0], wire: [1, 2, 3, 4] },
  'git-pull': { solid: [0], wire: [1, 2, 3, 4] },
  'git-fetch': { solid: [0, 2, 3], wire: [1, 4, 5, 6] },
  // The front frame filled with the commit knocked out; the frame behind stays a line
  'git-clone': { solid: [0], lines: [1], cut: [2, 3, 4] },
  'git-remote': { solid: [0, 2], wire: [1, 3] },
  'git-merge-queue': { solid: [0, 3, 4, 5], wire: [1, 2, 6, 7] },
  'git-blame': { solid: [0, 1], wire: [2, 3, 4, 5] },
  'git-submodule': { solid: [0, 2, 4], wire: [1, 3] },
  issue: { solid: [0], cut: [1] },
  // The drop filled; the line that holds it attached, the others separate
  'code-comment': { solid: [0], wire: [1, 2, 3] },
  'diff-split': { solid: [0], cut: [1, 2, 3, 4] },
  'diff-unified': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'merge-editor': { solid: [0, 1, 2], wire: [3, 4, 5, 6] },
  'book-open-code': { solid: [0], cut: [1, 2, 3] },
  'debug-breakpoint': { solid: [0], wire: [1] },
  'debug-breakpoint-conditional': { solid: [0], wire: [1], cut: [2, 3] },
  'debug-logpoint': { solid: [0], wire: [1] },
  'debug-continue': { solid: [1], wire: [0] },
  'call-stack': { solid: [0, 1, 2, 3] },
  // The eye filled with its pupil knocked out; the braces stay lines
  'watch-expression': { solid: [2], cut: [3], wire: [0, 1] },
  'flame-graph': { solid: [0, 1, 2, 3] },
  'hot-reload': { solid: [2], lines: [0, 1] },
  // The memory as in Datos, the drop filled with it
  'memory-leak': { solid: [0, 4], wire: [3], cut: [1, 2] },
  'code-snippet': { solid: [0], cut: [1, 2, 3] },
  'code-completion': { solid: [0], cut: [3, 4], wire: [1, 2] },
  'code-notebook': { solid: [0, 1, 2, 3], cut: [4, 5] },
  'lightbulb-wrench': { solid: [0], lines: [1, 2] },
  'class-diagram': { solid: [0], cut: [1, 2, 3, 4] },
  // The boxes filled; UML's triangle stays hollow, a line with its stem
  inheritance: { solid: [0, 3], wire: [1, 2] },
  'sequence-diagram': { solid: [0, 1], wire: [2, 3, 4, 5, 6, 7] },
  'linked-list': { solid: [0, 1, 2], wire: [3, 4, 5, 6] },
  'binary-tree': { solid: [0, 1, 2, 3, 4], wire: [5, 6, 7, 8] },
  'hash-map': { solid: [0, 3, 4], cut: [1, 2], wire: [5, 6, 7, 8] },
  'ci-pipeline': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7] },
  'ci-pipeline-check': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7] },
  'ci-pipeline-x': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7] },
  'ci-pipeline-clock': { solid: [0, 1, 2, 3], wire: [4, 5, 6, 7] },
  // The packages as the core box: the body filled, its edges knocked out
  build: { solid: [2], cut: [0, 1] },
  'build-artifact': { solid: [2, 3, 5], cut: [0, 1], wire: [4, 6] },
  // The arrow stands on its base line, both clear of the package
  deploy: { solid: [2], cut: [0, 1], lines: [3, 4, 5] },
  'deploy-check': { solid: [2], cut: [0, 1], lines: [3, 4, 5] },
  'deploy-x': { solid: [2], cut: [0, 1], lines: [3, 4, 5] },
  rollback: { solid: [2], cut: [0, 1], lines: [3, 4] },
  'blue-green-deploy': { solid: [2, 5], cut: [0, 1, 3, 4], lines: [6, 7] },
  dependency: { solid: [2, 7], cut: [0, 1, 5, 6], wire: [3, 4] },
  'dependency-arrow-up': { solid: [2, 7], cut: [0, 1, 5, 6], wire: [3, 4] },
  'circular-dependency': { solid: [2, 5], cut: [0, 1, 3, 4], wire: [6, 7, 8, 9] },
  // The toolbox filled with the code sign cut out; the handle stands apart
  sdk: { solid: [0], lines: [1], cut: [2, 3] },
  microservices: { solid: [0, 1, 2, 3, 4], wire: [5, 6, 7, 8] },
  'container-image': { solid: [0], cut: [1, 2, 3], lines: [4, 5] },
  emulator: { solid: [0], cut: [1, 2, 3, 4] },
  'developer-mode': { solid: [0], cut: [1], lines: [2, 3] },
  'distributed-trace': { solid: [0, 1, 2], wire: [3, 4] },
  // The gear as in Sistema; the job's arrows attached to its teeth
  'background-worker': { solid: [0], cut: [1], wire: [2, 3, 4, 5] },
  // The server as in Datos; the call's arrows stand apart
  'request-response': { solid: [0, 2], cut: [1, 3], wire: [4, 5, 6, 7] },
  'pub-sub': { solid: [0, 1, 6, 7, 8], wire: [2, 3, 4, 5] },
  queue: { solid: [0], cut: [1, 2], wire: [3, 4, 5, 6] },
  cache: { solid: [0, 1, 2, 3] },
  'cache-x': { solid: [0, 1, 2, 3] },
};
for (const [name, spec] of Object.entries(FILL)) {
  const d = icons[name].d;
  const pick = (ix) => (ix ?? []).map((i) => d[i]);
  const closed = new Set(spec.closed);
  const solid = [...(spec.solid ?? []), ...closed].sort((a, b) => a - b).map((i) => (closed.has(i) ? `${d[i]}Z` : d[i]));
  icons[name].fill = { solid };
  for (const k of ['cut', 'lines', 'wire']) if (spec[k]?.length) icons[name].fill[k] = pick(spec[k]);
}
// The badge siblings take their base's fill, parts and 16 px drawing as they are
for (const icon of Object.values(icons)) {
  if (!icon.base) continue;
  const b = D[icon.base] ?? N[icon.base];
  icon.fill = b.fill;
  // git-commit, the braces and the code have no parts of their own
  const own = { 'git-commit': { node: [0], line: [1, 2] }, braces: { braces: [0, 1] }, code: { brackets: [0, 2], slash: [1] } };
  icon.parts = { ...(b.parts ?? own[icon.base]) };
  delete icon.base;
}
/**
 * A badge sibling without the strokes of its base that the engine's clearance hides at regular but
 * lets a speck of through at another weight (DESIGN.md › Every weight, one structure: a stroke that
 * ends just inside the clearance peeks out of it at bold). `drop` leaves them out; `swap` gives a
 * stroke a path that ends deeper under the badge. What shows is still the base, cut by the engine.
 */
function underBadge(name, { drop = [], swap = {} }) {
  const icon = icons[name];
  const map = new Map(icon.d.map((d, i) => [d, drop.includes(i) ? null : (swap[i] ?? d)]));
  const to = (p) => (map.has(p) ? map.get(p) : /Z$/.test(p) && map.has(p.slice(0, -1)) ? map.get(p.slice(0, -1)) && `${map.get(p.slice(0, -1))}Z` : p);
  const keep = icon.d.map((_, i) => !drop.includes(i));
  const at = icon.d.map((_, i) => keep.slice(0, i).filter(Boolean).length);
  icon.d = icon.d.map(to).filter(Boolean);
  if (icon.fill) icon.fill = Object.fromEntries(Object.entries(icon.fill).map(([k, v]) => [k, v.map(to).filter(Boolean)]).filter(([, v]) => v.length));
  if (icon.parts) icon.parts = Object.fromEntries(Object.entries(icon.parts).map(([k, v]) => [k, v.filter((i) => keep[i]).map((i) => at[i])]).filter(([, v]) => v.length));
}
// The terminal's prompt line lies all under the badge: its left end peeked out at bold
for (const name of ['terminal-clock', 'terminal-plus']) underBadge(name, { drop: [2] });
// The bug's right arm and lower right leg lie under the badge (the arm's tip peeked out at bold);
// its seam ends just past the clearance's edge (running on under it, the body's cut matched no
// longer between weights)
for (const name of ['bug-play', 'bug-check', 'bug-plus', 'bug-search']) underBadge(name, { drop: [5, 6], swap: { 2: line([12, 8.5], [12, 14.5]) } });
/**
 * A badge sibling whose base runs along the clearance's edge instead of across it (the braces' point,
 * the code's slash, the branch's curve) is cut differently at each weight: as Sistema's key-plus, the
 * base moves away from the badge (`dx`, `dy`, the same for the whole family) until it crosses the
 * clearance cleanly. The badge stays in its place.
 */
function nudge(name, dx, dy) {
  const icon = icons[name];
  const t = (d) => transform(d, 1, dx, dy);
  icon.d = icon.d.map(t);
  if (icon.fill) icon.fill = Object.fromEntries(Object.entries(icon.fill).map(([k, v]) => [k, v.map(t)]));
}
nudge('braces-alert', 0, -0.75);
for (const name of ['code-search', 'code-play']) nudge(name, -0.75, 0);
for (const name of ['git-branch-plus', 'git-branch-lock', 'git-branch-sync']) nudge(name, 0, -0.75);
// The commit's ring stays whole above the pencil (lower, the pencil ate a third of it: a C)
nudge('git-commit-edit', 0, -3);
// The deploy siblings shift left until the badge clears the base line's end and nothing else: the
// arrow (on the center) went under the clearance whole
for (const name of ['deploy-check', 'deploy-x']) nudge(name, -3, 0);
// Upgrading a dependency: the badge takes the dependency's place; the arrowhead and the small
// package under it are left out (the arrowhead's tips peeked out of the clearance)
underBadge('dependency-arrow-up', { drop: [4, 5, 6, 7] });

// Only open lines: their filled version is the outline itself
// (a dashed outline stays dashed, and a pair of braces stays a pair of lines)
for (const name of ['recursion', 'step-over', 'step-back', 'step-into', 'step-out', 'run-to-cursor', 'code-coverage', 'code-format', 'multi-cursor', 'lint', 'minify', 'test-results', 'mock-server', 'api-key', 'api-gateway', 'rate-limit', 'websocket'])
  icons[name].fill = false;

// ---------------------------------------------------------------------------------------------
// 16 px (DESIGN.md › 16 px): a custom badge goes to its pixel version, on the base with the same
// adjustment the engine would give it
// ---------------------------------------------------------------------------------------------
for (const icon of Object.values(icons)) {
  if (!PIXEL.has(icon.badge)) continue;
  const fill = icon.fill || null;
  const sn = snapper([...icon.d, ...(fill ? Object.values(fill).flat() : [])]);
  icon.small = {
    d: icon.d.map((d) => sn(d)),
    ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map((d) => sn(d))])) }),
    badge: PIXEL.get(icon.badge),
  };
}

// ---------------------------------------------------------------------------------------------
// Named parts (DESIGN.md › Named parts)
// ---------------------------------------------------------------------------------------------
const PARTS = {
  'git-rebase': { trunk: [0, 1, 2], branch: [3, 4], arrow: [5, 6] },
  'git-cherry-pick': { source: [0, 1], target: [2, 3], arrow: [4, 5] },
  'git-stash': { tray: [0], commit: [1], arrow: [2, 3] },
  'git-stash-pop': { tray: [0], commit: [1], arrow: [2, 3] },
  'git-tag': { trunk: [0, 1, 2], tag: [3, 4, 5] },
  'git-revert': { trunk: [0, 1, 2], arrow: [3, 4] },
  'git-squash': { commits: [0, 1, 2], lanes: [3, 4, 5], squashed: [6, 7] },
  'git-push': { commit: [0, 1], arrow: [2, 3], remote: [4] },
  'git-pull': { commit: [0, 1], arrow: [2, 3], remote: [4] },
  'git-fetch': { trunk: [0, 1, 2], fetched: [3], arrow: [4, 5, 6] },
  'git-clone': { front: [0], back: [1], commit: [2, 3, 4] },
  'git-remote': { cloud: [0], tie: [1], commit: [2, 3] },
  'git-merge-queue': { trunk: [0, 1], lane: [2, 6, 7], queue: [3, 4, 5] },
  'git-blame': { person: [0, 1], gutter: [2], lines: [3, 4, 5] },
  'git-submodule': { commits: [0, 4], links: [1, 3], module: [2] },
  issue: { ring: [0], dot: [1] },
  'code-comment': { comment: [0], lines: [1, 2, 3] },
  'diff-split': { panel: [0, 1], removed: [2], added: [3, 4] },
  'diff-unified': { panel: [0], removed: [1, 2], added: [3, 4, 5] },
  'merge-editor': { result: [0], sides: [1, 2], arrows: [3, 4, 5, 6] },
  'book-open-code': { pages: [0], spine: [1], code: [2, 3] },
  'debug-breakpoint': { marker: [0], line: [1] },
  'debug-breakpoint-conditional': { marker: [0], line: [1], condition: [2, 3] },
  'debug-logpoint': { marker: [0], line: [1] },
  'debug-continue': { bar: [0], play: [1] },
  'step-over': { arrow: [0, 1], statement: [2] },
  'step-back': { arrow: [0, 1], statement: [2] },
  'step-into': { outer: [0], arrow: [1, 2], inner: [3] },
  'step-out': { inner: [0], arrow: [1, 2], outer: [3] },
  'run-to-cursor': { arrow: [0, 1], cursor: [2, 3, 4] },
  'call-stack': { frames: [0, 1, 2], pointer: [3] },
  'watch-expression': { braces: [0, 1], eye: [2, 3] },
  'flame-graph': { base: [0], rows: [1, 2, 3] },
  'hot-reload': { cycle: [0, 1], flame: [2] },
  'memory-leak': { board: [0], chips: [1, 2], pins: [3], drop: [4] },
  'code-snippet': { card: [0], code: [1, 2, 3] },
  'code-completion': { list: [0, 3, 4], code: [1], caret: [2] },
  'code-notebook': { cells: [0, 1], run: [2, 3], code: [4, 5] },
  'code-coverage': { ring: [0], code: [1, 2] },
  'code-format': { guide: [0], lines: [1, 4], arrow: [2, 3] },
  'multi-cursor': { lines: [0, 2, 4], cursors: [1, 3, 5] },
  lint: { code: [0, 1, 3], squiggle: [2] },
  'lightbulb-wrench': { bulb: [0], base: [1, 2] },
  minify: { code: [0, 1, 2], arrows: [3, 4, 5, 6] },
  recursion: { cycle: [0, 1], function: [2, 3] },
  'class-diagram': { box: [0], bands: [1, 2], members: [3, 4] },
  inheritance: { parent: [0], arrow: [1, 2], child: [3] },
  'sequence-diagram': { participants: [0, 1], lifelines: [2, 3], messages: [4, 5, 6, 7] },
  'linked-list': { nodes: [0, 1, 2], pointers: [3, 4, 5, 6] },
  'binary-tree': { nodes: [0, 1, 2, 3, 4], edges: [5, 6, 7, 8] },
  'hash-map': { slots: [0, 1, 2], values: [3, 4], pointers: [5, 6, 7, 8] },
  'ci-pipeline': { stages: [0, 3], jobs: [1, 2], links: [4, 5, 6, 7] },
  'ci-pipeline-check': { stages: [0, 3], jobs: [1, 2], links: [4, 5, 6, 7] },
  'ci-pipeline-x': { stages: [0, 3], jobs: [1, 2], links: [4, 5, 6, 7] },
  'ci-pipeline-clock': { stages: [0, 3], jobs: [1, 2], links: [4, 5, 6, 7] },
  build: { package: [0, 1, 2] },
  'build-artifact': { package: [0, 1, 2], stages: [3, 5], links: [4, 6] },
  deploy: { package: [0, 1, 2], arrow: [3, 4], base: [5] },
  'deploy-check': { package: [0, 1, 2], arrow: [3, 4], base: [5] },
  'deploy-x': { package: [0, 1, 2], arrow: [3, 4], base: [5] },
  rollback: { package: [0, 1, 2], arrow: [3, 4] },
  'blue-green-deploy': { blue: [0, 1, 2], green: [3, 4, 5], arrow: [6, 7] },
  dependency: { package: [0, 1, 2], link: [3, 4], dependency: [5, 6, 7] },
  'dependency-arrow-up': { package: [0, 1, 2], link: [3] },
  'circular-dependency': { packages: [0, 1, 2, 3, 4, 5], arrows: [6, 7, 8, 9] },
  sdk: { box: [0], handle: [1], code: [2, 3] },
  microservices: { services: [0, 1, 2, 3], hub: [4], links: [5, 6, 7, 8] },
  'storage-bucket': { pail: [0, 1], handle: [2] },
  'container-image': { container: [0, 1, 2, 3], layers: [4, 5] },
  emulator: { frame: [0], bar: [1], controls: [2, 3, 4] },
  'developer-mode': { phone: [0, 1], brackets: [2, 3] },
  'test-results': { passed: [0, 1, 2, 3], failed: [4, 5, 6] },
  'distributed-trace': { spans: [0, 1, 2], links: [3, 4] },
  'background-worker': { gear: [0], hub: [1], input: [2, 3], output: [4, 5] },
  'mock-server': { body: [0, 1], slots: [2, 4], lights: [3, 5] },
  'api-key': { bow: [0, 1], shaft: [2, 3] },
  'api-gateway': { gate: [0, 1], request: [2], routes: [3, 4], services: [5, 6, 7] },
  'rate-limit': { gate: [0, 1], blocked: [2, 3, 6, 7], passed: [4, 5] },
  'request-response': { server: [0, 1, 2, 3], request: [4, 5], response: [6, 7] },
  websocket: { ends: [0, 1], line: [2], heads: [3, 4] },
  'pub-sub': { topic: [0], publisher: [1, 2], subscribers: [3, 4, 5, 6, 7, 8] },
  queue: { tube: [0, 1, 2], input: [3, 4], output: [5, 6] },
  cache: { bolt: [0], cards: [1, 2, 3] },
  'cache-x': { bolt: [0], cards: [1, 2, 3] },
};
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ---------------------------------------------------------------------------------------------
// Automatic variants that make no sense (DESIGN.md › Automatic variants)
// ---------------------------------------------------------------------------------------------
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// Already a circle
variants(['issue', 'hot-reload', 'recursion', 'code-coverage'], { circle: false });
// Lone lines and arrows: a slash through them says nothing
variants(['step-over', 'step-back', 'step-into', 'step-out', 'run-to-cursor', 'code-format', 'multi-cursor', 'lint', 'minify', 'rate-limit', 'websocket'], { slash: false });
// With a badge: scaled down the badge stops reading, and the slash would cut through it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };

// ---------------------------------------------------------------------------------------------
// Mirroring (DESIGN.md › Mirroring): flows that read left to right, going back
// ---------------------------------------------------------------------------------------------
for (const name of [
  'git-revert', 'git-squash', 'git-blame', 'code-comment', 'debug-breakpoint', 'debug-breakpoint-conditional', 'debug-logpoint',
  'step-over', 'step-back', 'step-into', 'step-out', 'run-to-cursor', 'call-stack', 'code-completion',
  'code-notebook', 'code-format', 'multi-cursor', 'lint', 'class-diagram', 'sequence-diagram',
  'linked-list', 'hash-map', 'build-artifact',
  'test-results', 'rollback', 'blue-green-deploy', 'dependency', 'dependency-arrow-up', 'distributed-trace',
  'background-worker', 'api-gateway', 'rate-limit', 'request-response', 'pub-sub', 'queue',
])
  icons[name].mirror = true;

// ---------------------------------------------------------------------------------------------
// Motion (DESIGN.md › Motion)
// ---------------------------------------------------------------------------------------------
icons['git-stash'].motion = { effect: 'bounce', parts: ['arrow'], vector: [0, 1.5] };
icons['git-stash-pop'].motion = { effect: 'bounce', parts: ['arrow'], vector: [0, -1.5] };
icons['git-push'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons['git-pull'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
icons['git-fetch'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, 1.5] };
icons['git-branch-sync'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['step-over'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['step-back'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.5, 0] };
icons['step-into'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.25, 0] };
icons['step-out'].motion = { effect: 'slide', parts: ['arrow'], vector: [-1.25, 0] };
icons['run-to-cursor'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['hot-reload'].motion = { effect: 'spin', parts: ['cycle'], origin: [12, 12] };
icons.recursion.motion = { effect: 'spin', parts: ['cycle'], origin: [12, 12] };
icons['memory-leak'].motion = { effect: 'bounce', parts: ['drop'], vector: [0, 1.5] };
icons['lightbulb-wrench'].motion = { effect: 'wiggle', parts: ['badge'], origin: [18.25, 15.75] };
// A value: the ring is drawn as far as the tests cover
icons['code-coverage'].value = { draw: ['ring'] };
icons.build.motion = { effect: 'wiggle', parts: ['badge'], origin: [11.5, 12.5] };
icons.deploy.motion = { effect: 'slide', parts: ['package'], vector: [0, -1.5] };
icons.rollback.motion = { effect: 'spin', parts: ['arrow'], origin: [12, 12.4] };
icons['debug-continue'].motion = { effect: 'slide', parts: ['play'], vector: [1.5, 0] };
icons['background-worker'].motion = { effect: 'spin', parts: ['gear', 'hub'], origin: [12, 12] };
icons['api-key'].motion = { effect: 'wiggle', origin: [7.25, 12] };
icons['rate-limit'].motion = { effect: 'slide', parts: ['passed'], vector: [1.5, 0] };
icons.queue.motion = { effect: 'slide', parts: ['input', 'output'], vector: [1.5, 0] };
icons.cache.motion = { effect: 'beat', parts: ['bolt'], origin: [5.75, 12] };
icons['terminal-clock'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
for (const name of ['bug-play', 'bug-check', 'bug-plus', 'bug-search']) icons[name].motion = { effect: 'wiggle', parts: ['body', 'legs'], origin: [12, 14] };

export default { category: 'desarrollo', label: 'Desarrollo de software', icons };
