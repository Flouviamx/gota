// Redes e infraestructura (networks and infrastructure): network hardware, cables and ports,
// servers by role and state, the network and the globe with their states, DNS, addresses, subnets,
// VPN tunnels, the edge, cloud regions and zones, topologies and the network's measures. Everything
// is computed with engine/geometry.mjs on the rules in DESIGN.md.
//
// One server, one network, one globe for the whole family: datos' `server` (two units 16 × 6.5,
// the slot on the left and the light on the right) and `network` (a hub of r 2.5 and three nodes of
// r 2.25 at 8), sistema's `globe-lock` globe (Núcleo's at 76 %, top left, so a badge only crosses
// its outline), lugares' `cloud` and `house`, dispositivos' `ethernet` port and comercio's
// `qr-code`. Every server-* icon is that server with a badge or a custom piece in the badge's place
// (the engine clears the server around it); compositions that need a single unit use the same
// unit, 6.5 tall with its slot and light, narrowed where the drawing has no room for 16. The
// topology-* family shares one node (a ring of r 2) and links that touch it. A dashed frame (the
// set's continuous corners kept whole, and a dash at the middle of each side where the frame has
// room for it) means something logical: a virtual machine's host, a subnet.
import { arc, badge, circ, dot, f, head, line, polar, roundpoly, sq, turnPath } from '../../engine/geometry.mjs';
import { snapper, transform } from '../../engine/variants.mjs';
import bienesRaices from './bienes-raices.mjs';
import calendario from './calendario.mjs';
import comercio from './comercio.mjs';
import datos from './datos.mjs';
import dispositivos from './dispositivos.mjs';
import lugares from './lugares.mjs';
import nucleo from './nucleo.mjs';
import sistema from './sistema.mjs';
import social from './social.mjs';

// ── Local helpers ─────────────────────────────────────────────────────────────────────────────
const P = ([x, y]) => `${f(x)} ${f(y)}`;
const BR = { square: ['br'] };
/** Container with the signature: continuous corners and a square bottom-right one. */
const box = (x, y, w, h, r) => sq(x, y, w, h, r, BR);
const hl = (x0, x1, y) => line([x0, y], [x1, y]);
const vl = (x, y0, y1) => line([x, y0], [x, y1]);
/** Scales `d` by s about `o` and puts `o` at `to`. */
const place = (d, s, o, to = o) => transform(d, s, to[0] - o[0] * s, to[1] - o[1] * s);
const move = (d, dx, dy) => transform(d, 1, dx, dy);
/** Closes an outline for `fill.solid` (an open stroke would fill as a wedge). */
const shut = (d) => (/Z\s*$/i.test(d) ? d : `${d}Z`);
/** Just the `A…` segment of an engine arc, to chain it inside a path. */
const arcTo = (cx, cy, r, a0, a1) => arc(cx, cy, r, a0, a1).d.replace(/^M[^A]*/, '');
/** Open polyline with rounded interior vertices (one radius per vertex, or one for all). */
function rline(pts, radius = 0) {
  const rr = Array.isArray(radius) ? radius : pts.map(() => radius);
  let o = `M${P(pts[0])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [A, V, B] = [pts[i - 1], pts[i], pts[i + 1]];
    const r = rr[i];
    const u = [A[0] - V[0], A[1] - V[1]];
    const w = [B[0] - V[0], B[1] - V[1]];
    const [lu, lw] = [Math.hypot(...u), Math.hypot(...w)];
    const th = Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1]) / (lu * lw))));
    if (!r || th > Math.PI - 1e-6) {
      o += `L${P(V)}`;
      continue;
    }
    const t = r / Math.tan(th / 2);
    const S = [V[0] + (u[0] / lu) * t, V[1] + (u[1] / lu) * t];
    const E = [V[0] + (w[0] / lw) * t, V[1] + (w[1] / lw) * t];
    const cz = (V[0] - A[0]) * (B[1] - V[1]) - (V[1] - A[1]) * (B[0] - V[0]);
    o += `L${P(S)}A${f(r)} ${f(r)} 0 0 ${cz > 0 ? 1 : 0} ${P(E)}`;
  }
  return `${o}L${P(pts.at(-1))}`;
}
/** A link between two round nodes of radius r1 and r2: it touches their outlines without going in. */
function edge(p, q, r1, r2 = r1) {
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]];
  const L = Math.hypot(dx, dy);
  return line([p[0] + (dx / L) * r1, p[1] + (dy / L) * r1], [q[0] - (dx / L) * r2, q[1] - (dy / L) * r2]);
}
/** sq()'s path cut at its sides: each side's start point and the corner that follows it. */
function sides(x, y, w, h, r, opts) {
  const pieces = sq(x, y, w, h, r, opts).replace(/Z$/, '').split(/(?=L)/);
  return pieces.map((p) => ({ at: p.slice(1).match(/^(-?[\d.]+) (-?[\d.]+)/).slice(1).map(Number), corner: p.slice(1).replace(/^(-?[\d.]+) (-?[\d.]+)/, '') }));
}
/**
 * A dashed frame with the signature corner, for a small container: the engine's continuous corners
 * kept whole as four dashes, with a gap in the middle of each side ([top, right, bottom, left];
 * every gap fits in the straight part of its side, so no dash runs backwards).
 */
function dashed(x, y, w, h, r, gaps) {
  const s = sides(x, y, w, h, r, BR);
  const [cx, cy] = [x + w / 2, y + h / 2];
  const [gt, gr, gb, gl] = gaps.map((g) => g / 2);
  const ends = [
    [[cx + gt, y], [x + w, cy - gr]],
    [[x + w, cy + gr], [cx + gb, y + h]],
    [[cx - gb, y + h], [x, cy + gl]],
    [[x, cy - gl], [cx - gt, y]],
  ];
  return ends.map(([a, b], k) => `M${P(a)}L${P(s[k].at)}${s[k].corner}L${P(b)}`);
}
/**
 * A dashed frame for a large container: the four corners kept whole (the signature one as long as
 * the others) and a dash of `m` centered on each side, `g` from the corners' ends, as comercio's
 * card-virtual is dashed. Four gaps alone, at the middle of the sides, made sistema's scan frame.
 */
function dashed8(x, y, w, h, r, m, g) {
  const s = sides(x, y, w, h, r, BR);
  const [cx, cy, k] = [x + w / 2, y + h / 2, m / 2 + g];
  const ends = [
    [[cx + k, y], [x + w, cy - k]],
    [[x + w, cy + k], [cx + k, y + h]],
    [[cx - k, y + h], [x, cy + k]],
    [[x, cy - k], [cx - k, y]],
  ];
  const corners = ends.map(([a, b], i) => `M${P(a)}L${P(s[i].at)}${s[i].corner}L${P(b)}`);
  return [...corners, hl(cx - m / 2, cx + m / 2, y), vl(x + w, cy - m / 2, cy + m / 2), hl(cx + m / 2, cx - m / 2, y + h), vl(x, cy + m / 2, cy - m / 2)];
}
/** A straight arrow from `a` to `b`: the shaft and a head of arms `len` at 45°. */
const arrow = (a, b, len = 3) => [line(a, b), head(b, [b[0] - a[0], b[1] - a[1]], len)];
/**
 * A wifi fan: arcs of radius `rs` around `c`, `span` degrees wide and facing `dir` (270 = up, as
 * dispositivos' wifi; 90 = down). Its dot (`dot(c)`) is drawn apart, and the first arc stands 3.55
 * or more from the dot's center so the two stay apart at every weight.
 */
const fan = (c, rs, dir = 270, span = 90) => rs.map((r) => arc(...c, r, dir - span / 2, dir + span / 2).d);

// ── The set's pieces ──────────────────────────────────────────────────────────────────────────
const BC = [17.25, 17.25];
const RING = circ(...BC, 4.25);
/** datos' server: two units with the slot on the left and the light on the right. */
const SERVER = datos.icons.server.d;
const SERVER_FILL = datos.icons.server.fill;
const SERVER_PARTS = datos.icons.server.parts;
/**
 * One server unit, 6.5 tall like the server's. At 16 wide it is datos' unit exactly (slot 3.5 to 7
 * from the left, light 4 from the right); narrower, the slot is 2 long from 3 in and the light sits
 * 3.5 from the right, 2.9 or more from the slot (12.5 wide at least). Without its slot the light
 * sits 3 from the right.
 */
function unit(x, y, w = 16, { slot = true, light = true } = {}) {
  const cy = y + 3.25;
  const wide = w >= 16;
  const lx = slot ? x + w - (wide ? 4 : 3.5) : x + w - 3;
  const out = [box(x, y, w, 6.5, 2)];
  const s0 = x + (wide ? 3.5 : 3);
  const end = Math.min(wide ? x + 7 : s0 + 2, lx - 0.7 - 2.9);
  if (slot && end - s0 >= 2) out.push(hl(s0, end, cy));
  if (light) out.push(dot(lx, cy));
  return out;
}
/** datos' network: the hub at (12, 13.5) with r 2.5, its three spokes and three nodes of r 2.25 at 8. */
const NETWORK = datos.icons.network.d;
/**
 * The network turned 45° counterclockwise about its hub and moved up and left, the hub at
 * (9.75, 9.75): its nodes face top left, right and bottom, and the badge sits in the gap between
 * the last two, every piece 0.75 or more clear of the badge's clearance (none of them is cut).
 */
const NETWORK_B = NETWORK.map((d) => move(turnPath(d, -45, [12, 13.5]), -2.25, -3.75));
const NETWORK_FILL = { solid: [0, 4, 5, 6], wire: [1, 2, 3] };
/**
 * sistema's globe-lock globe: Núcleo's at 76 % at the top left. A badge only takes over its outline
 * and crosses it head-on; the equator and the meridian stay whole, far from its clearance.
 */
const GLOBE_LOCK = sistema.icons['globe-lock'];
const GLOBE = GLOBE_LOCK.d;
/** lugares' cloud: three lobes on a flat base at 18.25, from 3.25 to 21. */
const CLOUD = lugares.icons.cloud.d[0];
/** lugares' cloud is 17.75 × 13 around (12.13, 11.75). */
const cloudAt = (s, at) => place(CLOUD, s, [12.13, 11.75], at);
/** dispositivos' ethernet: the square and the port's mouth. */
const ETHERNET = dispositivos.icons.ethernet.d;
const QR = comercio.icons['qr-code'];

// ── Custom pieces in the badge's place (around 17.25, 17.25) ─────────────────────────────────
/** calendario's globe: a status disc with its meridian and equator cut out. */
const GLOBE_B = calendario.icons['calendar-globe'].badge;
/**
 * calendario's envelope (9 × 6.5, the signature corner), 0.75 higher: its top at 14.25 puts the
 * bottom unit's top edge (13.5) well inside its clearance at every weight (at 15 the edge sat right
 * on the clearance's border and a sliver of it peeked out at bold).
 */
const ENVELOPE_B = (() => {
  const b = calendario.icons['calendar-invite'].badge;
  const up = (d) => move(d, 0, -0.75);
  return { d: b.d.map(up), knock: up(b.knock), fill: { solid: b.fill.solid.map(up), cut: b.fill.cut.map(up) } };
})();
/** social's play triangle, 8.4 tall. */
const PLAY_B = social.icons.creator.badge;
/**
 * A map pin inside the badge's circle (social's post-location pin is 4.2 wide at the head and its
 * clearance reached the globe's equator: the sliver of fill between them came and went with the
 * weight). Its head r 3.4, its hole a dot; it clears the circle and its own outline.
 */
const PIN_B = (() => {
  const [c, r] = [[17.25, 16.25], 3.4];
  const k = r * Math.SQRT1_2;
  const pin = `M${P([c[0] + k, c[1] + k])}A${f(r)} ${f(r)} 0 1 0 ${P([c[0] - k, c[1] + k])}L${P([c[0], c[1] + r * Math.SQRT2])}Z`;
  const hole = dot(...c);
  return { d: [pin, hole], knock: `${RING}${pin}`, fill: { solid: [pin], cut: [hole] } };
})();
/** A glyph in the badge's place: it clears the badge's circle and its own outline, as the engine's glyphs do. */
const glyph = (d, own, fill) => ({ d, knock: `${RING}${own}`, ...(fill && { fill }) });
/** bienes-raices' wrench (an open jaw and its handle); it clears the whole circle, so no bit of the server is left beside its jaw. */
const WRENCH_B = (() => {
  const w = bienesRaices.icons['maintenance-request'].badge;
  return glyph(w.d, w.knock);
})();
/**
 * A status disc with a bolt cut out: archivos' cloud-bolt zigzag at 75 % on the badge's center (an
 * outlined bolt that small closed its waist at bold, its hole splitting in two).
 */
const BOLT_B = (() => {
  const zig = place('M14 8.75L11.6 11.15A0.5 0.5 0 0 0 11.96 12L12.79 12A0.5 0.5 0 0 1 13.15 12.85L10.75 15.25', 0.75, [12.375, 12], BC);
  return { d: [RING, zig], knock: RING, fill: { solid: [RING], cut: [zig] } };
})();
/** dispositivos' gamepad at half size, its body alone (its pad and stick clog up that small). */
const GAMEPAD_B = (() => {
  const d = place(dispositivos.icons.gamepad.d[0], 0.5, [12, 11.91], [BC[0], 17.5]);
  return glyph([d], d, { solid: [d] });
})();
/** Núcleo's database at half size: the body, the lid and the band, as archivos' file-database. */
const DATABASE_B = (() => {
  const [band, body, lid] = nucleo.icons.database.d.map((d) => place(d, 0.5, [12, 12], BC));
  const rim = place('M20.4 6.1c0 1.66-3.76 3-8.4 3s-8.4-1.34-8.4-3', 0.5, [12, 12], BC);
  return glyph([body, lid, band], `${shut(body)}${lid}`, { solid: [shut(body), lid], cut: [band, rim] });
})();

// ── Icons ─────────────────────────────────────────────────────────────────────────────────────
const icons = {};
const add = (name, tags, d, extra = {}) => {
  icons[name] = { tags, d, ...extra };
};

// Servers by state and role: datos' server whole, a badge or a custom piece at its corner
add('server-plus', ['agregar servidor', 'nuevo servidor', 'aprovisionar', 'add server', 'provision', 'new instance'], SERVER, { badge: badge('plus') });
add('server-check', ['servidor activo', 'en línea', 'operativo', 'server online', 'healthy', 'operational'], SERVER, { badge: badge('check') });
add('server-alert', ['servidor con error', 'degradado', 'incidente', 'server error', 'degraded', 'incident'], SERVER, { badge: badge('alert') });
add('server-x', ['servidor caído', 'fuera de línea', 'interrupción', 'server down', 'outage', 'offline'], SERVER, { badge: badge('x') });
add('server-gear', ['configurar servidor', 'ajustes del servidor', 'administración', 'server settings', 'configure', 'admin'], SERVER, { badge: badge('gear') });
add('server-web', ['servidor web', 'hosting', 'sitio web', 'web server', 'website hosting', 'http'], SERVER, { badge: GLOBE_B });
add('server-mail', ['servidor de correo', 'smtp', 'hosting de correo', 'mail server', 'email hosting', 'imap'], SERVER, { badge: ENVELOPE_B });
add('server-game', ['servidor de juego', 'multijugador', 'partidas', 'game server', 'multiplayer', 'lobby'], SERVER, { badge: GAMEPAD_B });
add('server-media', ['servidor multimedia', 'streaming', 'biblioteca de video', 'media server', 'streaming server', 'plex'], SERVER, { badge: PLAY_B });
add('server-database', ['servidor de base de datos', 'sql', 'instancia de datos', 'database server', 'db host', 'sql server'], SERVER, { badge: DATABASE_B });
add('server-maintenance', ['mantenimiento', 'servidor en mantenimiento', 'reparación', 'maintenance', 'scheduled maintenance', 'repair'], SERVER, { badge: WRENCH_B });

// The network by state: datos' network turned so the badge sits in the gap between two nodes
add('network-check', ['conectado', 'red estable', 'conexión correcta', 'connected', 'network ok', 'online'], NETWORK_B, { badge: badge('check') });
add('network-alert', ['conectividad limitada', 'problema de red', 'sin acceso', 'limited connectivity', 'network issue', 'network problem'], NETWORK_B, { badge: badge('alert') });
add('network-gear', ['ajustes de red', 'configurar red', 'conexiones', 'network settings', 'configure network', 'adapter settings'], NETWORK_B, { badge: badge('gear') });

// The globe by state: sistema's globe-lock globe with the badge at its corner (the same base as globe-lock)
add('globe-plus', ['agregar dominio', 'conectar dominio', 'nuevo sitio', 'add domain', 'connect domain', 'new site'], GLOBE, { badge: badge('plus') });
add('globe-check', ['dominio verificado', 'conectado a internet', 'sitio publicado', 'domain verified', 'connected', 'published'], GLOBE, { badge: badge('check') });
add('globe-alert', ['error de dominio', 'dns mal configurado', 'sitio caído', 'domain error', 'dns issue', 'site unreachable'], GLOBE, { badge: badge('alert') });
add('globe-search', ['buscar dominio', 'whois', 'consulta dns', 'domain search', 'dns lookup', 'find domain'], GLOBE, { badge: badge('search') });
add('globe-pin', ['ubicación ip', 'geolocalización', 'ubicación del servidor', 'ip location', 'geo ip', 'vpn location'], GLOBE, { badge: PIN_B });

// Custom pieces on other bases
add('cloud-region', ['región de la nube', 'zona de despliegue', 'centro de datos', 'cloud region', 'deploy region', 'location'], [CLOUD], { badge: PIN_B });
// PoE: the ethernet square whole and its port at 70 %, up and left, so the bolt in the corner cuts
// nothing but the square's corner
add('power-over-ethernet', ['poe', 'energía por ethernet', 'alimentación por cable de red', 'power over ethernet', 'poe port', 'powered device'], [ETHERNET[0], place(ETHERNET[1], 0.7, [7, 8], [6.25, 6.25])], {
  badge: BOLT_B,
});
// QR wifi: comercio's QR code, its three finders and their eyes, and in the fourth corner (where
// its modules were) a wifi fan, its arcs 70° wide so they stand 2.9 or more from the finders
{
  const c = [17.25, 20];
  add('qr-code-wifi', ['código qr wifi', 'compartir wifi', 'red de invitados', 'wifi qr', 'share wifi', 'guest network'], [
    QR.d[0],
    QR.d[1],
    QR.d[2],
    QR.d[4],
    QR.d[5],
    QR.d[6],
    dot(...c),
    ...fan(c, [3.6, 6.6], 270, 70),
  ]);
}

// ── Network hardware ──────────────────────────────────────────────────────────────────────────
// Switch: a wide low box with four ports (dots of r 0.3, as the router's, 3.6 apart) and, above it,
// the diagram mark of a switch: two short opposed arrows, 5 apart so their heads clear each other
add('network-switch', ['switch', 'conmutador', 'red local', 'network switch', 'lan', 'ethernet switch'], [
  box(2.5, 13.5, 19, 7.25, 2.5),
  ...[6.6, 10.2, 13.8, 17.4].map((x) => dot(x, 17.125, 0.3)),
  ...arrow([5.5, 3.75], [18.5, 3.75], 2.5),
  ...arrow([18.5, 8.75], [5.5, 8.75], 2.5),
]);
// Modem: an upright box with its three lights down its face and the line from the provider
// leaving its back at the bottom (on a stand with a foot it read as a microphone)
add('modem', ['módem', 'internet', 'proveedor', 'modem', 'isp', 'cable modem'], [
  box(4.75, 2.75, 10, 18.5, 2.75),
  ...[7, 10.5, 14].map((y) => dot(9.75, y, 0.3)),
  'M14.75 16.5H16.75A2.5 2.5 0 0 1 19.25 19V21.25',
]);
// Access point: a flat puck hanging from the ceiling on its stem, the signal spreading to both sides
// of it (two arcs a side, 3 apart, the first 3 clear of the puck). The wifi mark upside down under
// the puck, dot or no dot, made a face
const AP_C = [12, 12];
add('access-point', ['punto de acceso', 'wifi de techo', 'cobertura', 'access point', 'wireless ap', 'ceiling wifi'], [
  sq(8, 10, 8, 4, 2),
  vl(12, 2.75, 10),
  ...fan(AP_C, [7], 180, 70),
  ...fan(AP_C, [7], 0, 70),
  ...fan(AP_C, [10], 180, 70),
  ...fan(AP_C, [10], 0, 70),
]);
// Extender: a small unit plugged into the wall by its two prongs, the fan rising from its corner
add('wifi-extender', ['repetidor', 'extensor wifi', 'ampliar señal', 'wifi extender', 'range extender', 'repeater'], [
  box(6, 11, 9, 10.25, 2.75),
  hl(2.75, 6, 14.5),
  hl(2.75, 6, 18),
  ...fan([14, 12], [4, 8], 315),
]);
// Mesh: two tall units side by side and a small fan rising between them (a light near the top of
// each unit made them a pair of faces)
add('wifi-mesh', ['wifi mesh', 'malla', 'nodos wifi', 'mesh wifi', 'mesh network', 'whole home wifi'], [
  box(3.5, 11.25, 6.25, 10, 2.75),
  box(14.25, 11.25, 6.25, 10, 2.75),
  dot(12, 9),
  ...fan([12, 9], [3.75, 7]),
]);
// Hotspot: a phone (its speaker 3 below the top, as dispositivos' smartphone) with two arcs rising
// from its top edge, the first 2.85 or more above it
add('mobile-hotspot', ['punto de acceso móvil', 'compartir internet', 'anclaje', 'mobile hotspot', 'tethering', 'personal hotspot'], [
  box(7.75, 9.25, 8.5, 12, 2.75),
  hl(10.75, 13.25, 12.25),
  ...fan([12, 9.25], [4, 7]),
]);
// Adapter: a slim USB stick lying down (a server unit's 6.5 tall), its plug on the left, a short
// antenna rising from its right end and its light under it. A body 9.5 tall with the light in the
// middle read as a camera
add('network-adapter', ['adaptador de red', 'tarjeta wifi', 'dongle', 'network adapter', 'usb wifi', 'wifi dongle'], [
  box(8.5, 11.75, 12.75, 6.5, 2),
  'M8.5 13H4.25A1 1 0 0 0 3.25 14V16A1 1 0 0 0 4.25 17H8.5',
  line([18, 11.75], [19, 4.75]),
  dot(17.75, 15),
]);
// Patch panel: a rack strip, its mounting hole at each end and three ports between them; two cables
// leave the bottom edge under two ports and sweep off to the left side by side, 3 apart, around one
// center (a cord hanging in a loop read as a plug; two loops nested, as a magnet)
{
  const cable = (x, r) => `M${f(x)} 12V15.25A${f(r)} ${f(r)} 0 0 1 ${f(x - r)} ${f(15.25 + r)}H2.75`;
  add('patch-panel', ['panel de parcheo', 'cableado', 'rack de red', 'patch panel', 'cabling', 'network rack'], [
    box(2.5, 4, 19, 8, 2.5),
    dot(5.5, 8),
    dot(18.5, 8),
    ...[9, 12, 15].map((x) => vl(x, 7, 9)),
    cable(12, 3),
    cable(15, 6),
  ]);
}
// Antenna: the rooftop aerial seen from the side, a boom with four elements that shorten toward the
// front, on its mast (3.25 clear of the elements beside it). Seen from the front, a mast with three
// bars narrowing to the top on its mount, it read as a tree or a written character
add('antenna', ['antena', 'señal', 'recepción', 'antenna', 'aerial', 'reception'], [
  hl(2.75, 21.25, 8),
  vl(4, 4, 12),
  vl(8.75, 4.75, 11.25),
  vl(15.25, 5.5, 10.5),
  vl(20, 6.25, 9.75),
  vl(12, 8, 20.75),
]);
// Fiber: the connector's ferrule at the bottom left and three strands that leave along its axis and
// fan out, each ending in a dot of light
{
  const u = [Math.SQRT1_2, -Math.SQRT1_2];
  const v = [Math.SQRT1_2, Math.SQRT1_2];
  const c = [6.25, 17.75];
  const at = (s, t) => [c[0] + u[0] * s + v[0] * t, c[1] + u[1] * s + v[1] * t];
  const ferrule = roundpoly([at(-3, -1.75), at(3, -1.75), at(3, 1.75), at(-3, 1.75)], 1);
  const E = at(3, 0);
  const ctrl = at(6, 0);
  const ends = [-75, -45, -15].map((a) => polar(...E, 11.5, a));
  const strands = ends.map((T) => {
    const L = Math.hypot(T[0] - ctrl[0], T[1] - ctrl[1]);
    const stop = [T[0] - ((T[0] - ctrl[0]) / L) * 0.7, T[1] - ((T[1] - ctrl[1]) / L) * 0.7];
    return `M${P(E)}Q${P(ctrl)} ${P(stop)}`;
  });
  add('fiber-optic', ['fibra óptica', 'internet de fibra', 'cable de fibra', 'fiber optic', 'fiber internet', 'optical cable'], [ferrule, ...strands, ...ends.map((T) => dot(...T))]);
}
// Ethernet cable: the RJ45 plug standing up, its three contacts at the top, the boot under it and
// the cable dropping to the bottom (seen from the side, plug and latch read as a kettle). The boot
// is open at the top: its sides start on the plug's bottom edge
add('ethernet-cable', ['cable ethernet', 'cable de red', 'conexión por cable', 'ethernet cable', 'rj45', 'patch cord'], [
  sq(6, 3.25, 12, 8.5, 2.25),
  sq(9, 11.75, 6, 3.75, 1.25, { square: ['tl', 'tr'] }).replace(/Z$/, ''),
  vl(12, 15.5, 21.25),
  ...[9, 12, 15].map((x) => vl(x, 3.25, 6)),
]);
// Coaxial: the F connector seen from its face, the hex collar around the insulator ring and the
// center pin, and the round cable leaving it from behind, out of its lower left side, falling to
// the bottom (a side view of collar and pin read as a power plug)
{
  const c = [14, 9.75];
  const V = [-90, -30, 30, 90, 150, 210].map((a) => polar(...c, 7, a));
  // Where the cable's 135° line from the center meets the side between the bottom vertex and the next
  const s = 7 / (V[3][1] - V[4][1] + (V[3][0] - V[4][0]));
  const exit = [V[3][0] + (V[4][0] - V[3][0]) * s, V[3][1] + (V[4][1] - V[3][1]) * s];
  add('coaxial-cable', ['cable coaxial', 'conector f', 'cable de tv', 'coaxial cable', 'coax', 'f connector'], [
    roundpoly(V, 1.5),
    circ(...c, 3.25),
    dot(...c),
    rline([exit, [6.75, exit[1] + exit[0] - 6.75], [6.75, 21.25]], 3),
  ]);
}

// ── Servers and machines ──────────────────────────────────────────────────────────────────────
// Data center: datos' data-warehouse roof (the set's mark for a building that holds data) over a
// rack of two bays (6 tall, the slot and the light 3 clear of its edges), each its slot and its light. A building with rounded top corners and three rows
// read as a toaster, and its lights merged into a bar at 16 px
const DC_ROWS = [12.5, 18.5];
add('data-center', ['centro de datos', 'hosting', 'infraestructura', 'data center', 'datacenter', 'colocation'], [
  datos.icons['data-warehouse'].d[4],
  box(4, 9.5, 16, 12, 3),
  hl(4, 20, 15.5),
  ...DC_ROWS.flatMap((y) => [hl(8, 11.5, y), dot(16, y)]),
]);
// Cluster: as datos' database-cluster, one unit in front (13 wide, its slot and light) and two
// behind it, 3 up and 3 to the right each: of each one behind only its top and its right side
// show, 3 clear of the one in front. Three 8-wide units linked to a shared dot read as an org chart
{
  const W = 13;
  /** The top side and right side of a unit behind (its square corner closes the right side). */
  const behind = (x, y) => {
    const s = sides(x, y, W, 6.5, 2, BR);
    return `M${P([2 * x + W - s[0].at[0], y])}L${P(s[0].at)}${s[0].corner}L${P([x + W, y + 6.5])}`;
  };
  add('server-cluster', ['clúster', 'nodos', 'cómputo distribuido', 'server cluster', 'cluster', 'nodes'], [...unit(2.5, 11.75, W), behind(5.5, 8.75), behind(8.5, 5.75)]);
}
// Blade server: a chassis with five blades, each with its light (r 0.3) above it
{
  const xs = [5.67, 8.83, 12, 15.17, 18.33];
  add('server-blade', ['servidor blade', 'chasis', 'bare metal', 'blade server', 'chassis', 'hardware'], [
    box(2.5, 5, 19, 14, 3.5),
    ...xs.map((x) => vl(x, 11.25, 16)),
    ...xs.map((x) => dot(x, 8, 0.3)),
  ]);
}
// Virtual machine: a server unit inside a dashed host, the set's mark for something logical (a unit
// drawn dashed inside a solid host took six dashes and turned to noise at 18 px, and a dashed unit
// is desarrollo's mock-server). The host is dashed as card-virtual is, its corners and a dash on
// each side: with four gaps alone it was sistema's scan frame around a face. The frame is 18.5 (its
// corners r 3, so each side keeps room for its dash) and the unit (12.5) keeps 3 from its sides
add('virtual-machine', ['máquina virtual', 'vps', 'instancia', 'virtual machine', 'vm', 'cloud instance'], [...dashed8(2.75, 2.75, 18.5, 18.5, 3, 2.5, 3), ...unit(5.75, 8.75, 12.5)]);
// Client and server: a server unit at the top right and a laptop (dispositivos' proportions) at the
// bottom left, an elbow link from the unit's bottom into the screen's side. Stacked on one axis,
// unit, neck and screen read as a robot
add('client-server', ['cliente servidor', 'arquitectura', 'conexión', 'client server', 'architecture', 'request'], [
  ...unit(8.75, 2.75, 12.5),
  box(2.75, 12.5, 11, 6.25, 2.25),
  hl(1.75, 14.75, 21.5),
  rline([[17.5, 9.25], [17.5, 16.5], [13.75, 16.5]], 2),
]);
// Peer to peer: two small monitors 3 apart (their feet 3 under them) and a two-headed arrow beneath
// them, from stand to stand
{
  const monitor = (x) => [box(x, 3.25, 8, 6.5, 2), vl(x + 4, 9.75, 12.75), hl(x + 1.75, x + 6.25, 12.75)];
  add('peer-to-peer', ['p2p', 'entre pares', 'descentralizado', 'peer to peer', 'direct connection', 'webrtc'], [
    ...monitor(2.5),
    ...monitor(13.5),
    hl(6.5, 17.5, 18),
    head([6.5, 18], [-1, 0], 3),
    head([17.5, 18], [1, 0], 3),
  ]);
}
// Proxy: the server's two units pulled apart (12.5 wide, 3.25 from the arrow) and an arrow passing
// between them, its head 2.85 or more from their square corners
add('server-proxy', ['proxy', 'proxy inverso', 'intermediario', 'reverse proxy', 'relay', 'gateway'], [
  ...unit(4.5, 2.25, 12.5),
  ...unit(4.5, 15.25, 12.5),
  ...arrow([3.75, 12], [21.25, 12], 2.5),
]);

// ── Names, addresses and tunnels ──────────────────────────────────────────────────────────────
// DNS: a name (Núcleo's globe, small, top left) resolved to an address (a node ring, bottom right)
// along an elbow arrow
{
  const k = 0.55;
  const g = [7.75, 7.75];
  add('dns', ['dns', 'dominio', 'servidores de nombres', 'dns records', 'nameserver', 'domain name'], [
    ...nucleo.icons.globe.d.map((d) => place(d, k, [12, 12], g)),
    rline([[g[0], g[1] + 9 * k], [g[0], 17.25], [13.25, 17.25]], 2),
    head([13.25, 17.25], [1, 0], 3),
    circ(18.5, 17.25, 2.25),
  ]);
}
// IP address: a node and, tied to it by a short line, the tag it is given (its eyelet a dot)
add('ip-address', ['dirección ip', 'ip estática', 'ip pública', 'ip address', 'static ip', 'public ip'], [
  circ(12, 4.75, 2.25),
  vl(12, 7, 9.25),
  roundpoly([[12, 9.25], [16.25, 13], [16.25, 21.25], [7.75, 21.25], [7.75, 13]], [0.8, 1.25, 2.25, 2.25, 1.25]),
  dot(12, 13.5),
]);
// Subnet: three nodes linked in a column inside a dashed frame; the middle one links out through
// the right side's gap (6 wide, 3 clear of the line on each side) to a fourth node outside
{
  const [E, G, F, D] = [[8.75, 8], [8.75, 12], [8.75, 16], [19.75, 12]];
  add('subnet', ['subred', 'vlan', 'segmento de red', 'subnet', 'vpc', 'network segment'], [
    ...dashed(2.75, 4, 12, 16, 2.5, [3, 6, 3, 3]),
    dot(...E),
    dot(...G),
    dot(...F),
    edge(E, G, 0.7),
    edge(G, F, 0.7),
    edge(G, D, 0.7, 2),
    circ(...D, 2),
  ]);
}
// VPN tunnel: the line between two nodes disappears into a tube (a pipe seen from the side: its
// near mouth an ellipse, its far end half of one) and comes out the other end. Two parallel lines
// alone read as an equals sign at 18 px.
const ell = (cx, cy, rx, ry) => `M${P([cx, cy - ry])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx, cy + ry])}A${f(rx)} ${f(ry)} 0 1 0 ${P([cx, cy - ry])}Z`;
const PIPE = (y) => [ell(9.75, y, 1.5, 3.75), `M9.75 ${f(y - 3.75)}H14.25A1.5 3.75 0 0 1 14.25 ${f(y + 3.75)}H9.75`];
/** The tube's inner seam (the mouth's far half), cut in the fill so the mouth reads. */
const SEAM = (y) => `M9.75 ${f(y - 3.75)}A1.5 3.75 0 0 1 9.75 ${f(y + 3.75)}`;
add('vpn-tunnel', ['túnel vpn', 'vpn', 'conexión segura', 'vpn tunnel', 'secure tunnel', 'site to site'], [
  circ(4, 12, 2),
  circ(20, 12, 2),
  ...PIPE(12),
  hl(6, 8.25, 12),
  hl(15.75, 18, 12),
]);
// Split tunnel: the same tube on the lower path; from the same node a second path branches up and
// goes straight out to its own node
{
  const L = [4, 16];
  add('vpn-split-tunnel', ['túnel dividido', 'split tunneling', 'excluir apps', 'split tunnel', 'vpn bypass', 'vpn exclusions'], [
    circ(...L, 2),
    circ(20, 16, 2),
    circ(20, 5.5, 2),
    ...PIPE(16),
    hl(6, 8.25, 16),
    hl(15.75, 18, 16),
    rline([polar(...L, 2, -60), [7.5, 5.5], [18, 5.5]], 2.5),
  ]);
}
// CDN: Núcleo's globe as the origin, at 61 % in the middle, linked out to three edge nodes (the
// topology node) in three corners. A plain circle cut by three nodes 120° apart, linked to its
// center, was a well-known operating system's logo; four nodes in the four corners read as a
// skull and crossbones
const CDN_R = 5.5;
{
  const g = [12, 12];
  const N = [[4.25, 4.25], [19.75, 4.25], [4.25, 19.75]];
  add('cdn', ['cdn', 'red de distribución', 'edge', 'content delivery', 'edge network', 'caching'], [
    ...nucleo.icons.globe.d.map((d) => place(d, CDN_R / 9, [12, 12], g)),
    ...N.map((p) => edge(g, p, CDN_R, 2)),
    ...N.map((p) => circ(...p, 2)),
  ]);
}

// ── Cloud ─────────────────────────────────────────────────────────────────────────────────────
// Zones: a frame split into three zones, a node in each
add('availability-zones', ['zonas de disponibilidad', 'redundancia', 'alta disponibilidad', 'availability zones', 'redundancy', 'multi az'], [
  box(2.5, 5, 19, 14, 3.5),
  vl(8.83, 5, 19),
  vl(15.17, 5, 19),
  ...[5.67, 12, 18.33].map((x) => dot(x, 12)),
]);
// Hybrid: the cloud above, a server unit below, joined
add('hybrid-cloud', ['nube híbrida', 'local y nube', 'on premise', 'hybrid cloud', 'on premises', 'infrastructure'], [
  cloudAt(0.7, [12, 7.3]),
  vl(12, 11.85, 14.75),
  ...unit(4, 14.75),
]);
// Multi-cloud: two clouds offset on the diagonal (side by side at the same height they were too
// small to read), joined by an elbow from the first one's base to the second one's left lobe. At
// 60 % they fill the live area corner to corner (at 50 % they read as a weather icon's clouds)
add('multi-cloud', ['multinube', 'varios proveedores', 'nubes', 'multi cloud', 'cloud providers', 'interoperability'], [
  cloudAt(0.6, [8.08, 6.65]),
  cloudAt(0.6, [15.93, 17.35]),
  rline([[6.5, 10.55], [6.5, 17.75], [10.8, 17.75]], 1.5),
]);
// Cloud network: the cloud with three lines dropping and fanning out to three nodes in a row
{
  const N = [[5.5, 19], [12, 19], [18.5, 19]];
  add('cloud-network', ['red en la nube', 'dispositivos conectados', 'iot', 'cloud network', 'managed network', 'connected devices'], [
    cloudAt(0.7, [12, 7.3]),
    edge([8.75, 11.85], N[0], 0, 2),
    vl(12, 11.85, 17),
    edge([15.25, 11.85], N[2], 0, 2),
    ...N.map((p) => circ(...p, 2)),
  ]);
}
// Migration: a server unit at the bottom and an arrow rising from it into the cloud above, through
// its open base (as archivos' cloud-upload), the head inside, 3 or more from every lobe
const CLOUD_OPEN = place(CLOUD.replace(/Z$/, ''), 0.7, [12.13, 11.75], [12, 7.25]);
add('cloud-migration', ['migrar a la nube', 'mover a la nube', 'lift and shift', 'cloud migration', 'move to cloud', 'migrate'], [
  CLOUD_OPEN,
  ...arrow([12, 14.75], [12, 7], 2.75),
  ...unit(4, 14.75),
]);
// Auto-scaling: two stacked units (12.5 wide) and a two-headed arrow up and down beside them, its
// heads 2.95 from the units
add('auto-scaling', ['escalado automático', 'autoescalar', 'capacidad', 'auto scaling', 'autoscale', 'elastic'], [
  ...unit(2.75, 4, 12.5),
  ...unit(2.75, 13.5, 12.5),
  vl(20, 5.5, 18.5),
  head([20, 5.5], [0, -1], 2.5),
  head([20, 18.5], [0, 1], 2.5),
]);
// Failover: the server's two units (12.5 wide, at the right), the primary above with its light out
// and an arc arrow down their left side into the standby below. Two 8-wide units side by side with
// an arc rising from the first read as an open padlock
const FAIL = arc(9.25, 12, 4.75, -90, -270);
add('failover', ['conmutación por error', 'respaldo', 'alta disponibilidad', 'failover', 'standby', 'disaster recovery'], [
  ...unit(9.25, 4, 12.5, { light: false }),
  ...unit(9.25, 13.5, 12.5),
  FAIL.d,
  head(FAIL.end, FAIL.tangent, 3),
]);

// ── Topologies: one node, a ring of r 2, and links that touch it ───────────────────────────────
const NODE = 2;
// Ring: six nodes on a circle of r 8, joined by the circle itself (its arcs stop at each node)
{
  const half = (2 * Math.asin(NODE / 16) * 180) / Math.PI;
  const A = [-90, -30, 30, 90, 150, 210];
  add('topology-ring', ['topología en anillo', 'anillo', 'red en anillo', 'ring topology', 'ring network', 'token ring'], [
    ...A.map((a) => circ(...polar(12, 12, 8, a), NODE)),
    ...A.map((a) => arc(12, 12, 8, a + half, a + 60 - half).d),
  ]);
}
// Bus: a backbone capped at both ends, four nodes on short drops, alternately above and below
{
  const N = [[5.75, 5.75], [9.75, 18.25], [14.25, 5.75], [18.25, 18.25]];
  add('topology-bus', ['topología de bus', 'bus', 'red lineal', 'bus topology', 'backbone', 'linear network'], [
    hl(2.5, 21.5, 12),
    vl(2.5, 10, 14),
    vl(21.5, 10, 14),
    ...N.map(([x, y]) => vl(x, 12, y < 12 ? y + NODE : y - NODE)),
    ...N.map((p) => circ(...p, NODE)),
  ]);
}
// Mesh: four nodes at the corners of a square, every pair linked
{
  const N = [[6, 6], [18, 6], [18, 18], [6, 18]];
  const pairs = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]];
  add('topology-mesh', ['topología en malla', 'malla', 'red mallada', 'mesh topology', 'full mesh', 'decentralized'], [
    ...N.map((p) => circ(...p, NODE)),
    ...pairs.map(([i, j]) => edge(N[i], N[j], NODE)),
  ]);
}
// Tree: a root branching to two nodes, each branching to two leaf dots
{
  const root = [12, 4.25];
  const mid = [[6.75, 12], [17.25, 12]];
  const leaves = [[3.75, 19.5], [9.75, 19.5], [14.25, 19.5], [20.25, 19.5]];
  add('topology-tree', ['topología en árbol', 'árbol', 'red jerárquica', 'tree topology', 'hierarchical network', 'tree network'], [
    circ(...root, NODE),
    ...mid.map((p) => circ(...p, NODE)),
    ...leaves.map((p) => dot(...p)),
    ...mid.map((p) => edge(root, p, NODE)),
    ...leaves.map((p, i) => edge(mid[i >> 1], p, NODE, 0.7)),
  ]);
}

// ── Measures ──────────────────────────────────────────────────────────────────────────────────
// Ping: a node sends an arrow to another and a second arrow comes back beneath it
add('ping', ['ping', 'latencia', 'tiempo de respuesta', 'ping', 'latency', 'round trip'], [
  circ(4.5, 12, NODE),
  circ(19.5, 12, NODE),
  ...arrow([8.75, 9.5], [15.25, 9.5], 2.5),
  ...arrow([15.25, 14.5], [8.75, 14.5], 2.5),
]);
// Bandwidth: a pipe of two long lines with three chevrons flowing through it
add('bandwidth', ['ancho de banda', 'velocidad de transferencia', 'tráfico', 'bandwidth', 'throughput', 'data transfer'], [
  hl(2.75, 21.25, 6.25),
  hl(2.75, 21.25, 17.75),
  ...[8.5, 13.5, 18.5].map((x) => line([x - 2.75, 9.25], [x, 12], [x - 2.75, 14.75])),
]);
// Speed test: a semicircular dial with its needle high (3 short of the dial) and, under the pivot,
// the download and upload arrows 6.5 apart, so their heads stay apart at bold
const SPEED_C = [12, 12.25];
add('speed-test', ['prueba de velocidad', 'velocidad de internet', 'medir conexión', 'speed test', 'internet speed', 'connection speed'], [
  arc(...SPEED_C, 8.5, 180, 360).d,
  dot(...SPEED_C),
  line(polar(...SPEED_C, 0.7, -55), polar(...SPEED_C, 5.5, -55)),
  ...arrow([8.75, 15.25], [8.75, 20.75], 2.5),
  ...arrow([15.25, 20.75], [15.25, 15.25], 2.5),
]);
// Packet: a small box split into a narrow header and its payload, two motion lines behind it
add('packet', ['paquete de datos', 'trama', 'datagrama', 'packet', 'data packet', 'frame'], [
  box(8.5, 7, 13, 10, 2.5),
  vl(12.25, 7, 17),
  hl(2.75, 5.5, 10.25),
  hl(2.75, 5.5, 13.75),
]);
// Packet loss: two packets riding on a line, 3 above it, and the third fallen off its end, tilted
// below. A line through the packets' middles joined them like a pair of glasses
{
  const lost = turnPath(box(16.25, 15.5, 5, 5, 1.25), 25, [18.75, 18]);
  add('packet-loss', ['pérdida de paquetes', 'conexión inestable', 'calidad de llamada', 'packet loss', 'unstable connection', 'dropped packets'], [
    box(2.75, 4.75, 5, 5, 1.25),
    box(10.75, 4.75, 5, 5, 1.25),
    hl(2.75, 15.75, 12.75),
    lost,
  ]);
}
// Traceroute: a zigzag path from a start dot to an end ring, a node at each bend (the hops). The
// bends open past 90°, so the two links that touch a hop stay 2.85 apart there; dots at steep
// bends read as a line chart.
{
  const S = [3.25, 14.75];
  const H = [[8.5, 9.25], [14.5, 14.75]];
  const E = [19.75, 9.5];
  add('traceroute', ['traceroute', 'saltos', 'ruta de red', 'traceroute', 'hops', 'network path'], [
    edge(S, H[0], 0.7, NODE),
    edge(H[0], H[1], NODE),
    edge(H[1], E, NODE, 2.25),
    dot(...S),
    ...H.map((p) => circ(...p, NODE)),
    circ(...E, 2.25),
  ]);
}

// Home network: lugares' house, roof and walls, with the wifi fan inside (arcs 70° wide: at 90° the
// outer one came 2 from the walls)
add('home-network', ['red doméstica', 'wifi de casa', 'hogar conectado', 'home network', 'home wifi', 'smart home'], [
  ...lugares.icons.house.d.slice(0, 2),
  dot(12, 17),
  ...fan([12, 17], [3.75, 6.75], 270, 70),
]);

// ── Fill ──────────────────────────────────────────────────────────────────────────────────────
// By index into d: `solid` is filled and keeps its stroke, `cut` is knocked out at the stroke
// width, `lines` stays a line with a clearance of paper and `wire` stays a line attached to the fill
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const FILL = {
  'qr-code-wifi': { solid: [0, 1, 2, 6], cut: [3, 4, 5], wire: [7, 8] },
  'network-switch': { solid: [0], cut: [1, 2, 3, 4], wire: [5, 6, 7, 8] },
  modem: { solid: [0], cut: [1, 2, 3], wire: [4] },
  'access-point': { solid: [0], wire: [1, 2, 3, 4, 5] },
  'wifi-extender': { solid: [0], wire: [1, 2, 3, 4] },
  'wifi-mesh': { solid: [0, 1, 2], wire: [3, 4] },
  'mobile-hotspot': { solid: [0], cut: [1], wire: [2, 3] },
  'patch-panel': { solid: [0], cut: [1, 2, 3, 4, 5], wire: [6, 7] },
  'fiber-optic': { solid: [0, 4, 5, 6], wire: [1, 2, 3] },
  'ethernet-cable': { solid: [0], cut: [3, 4, 5], wire: [2] },
  'coaxial-cable': { solid: [0], cut: [1, 2], wire: [3] },
  'data-center': { solid: [1], cut: [2, 3, 4, 5, 6], lines: [0] },
  'server-cluster': { solid: [0], cut: [1, 2], lines: [3, 4] },
  'server-blade': { solid: [0], cut: range(1, 10) },
  'virtual-machine': { solid: [8], cut: [9, 10], wire: range(0, 7) },
  'client-server': { solid: [0, 3], cut: [1, 2], lines: [4], wire: [5] },
  'peer-to-peer': { solid: [0, 3], wire: [1, 2, 4, 5, 6, 7, 8] },
  'server-proxy': { solid: [0, 3], cut: [1, 2, 4, 5], wire: [6, 7] },
  dns: { solid: [0, 5], cut: [1, 2], wire: [3, 4] },
  'ip-address': { solid: [0, 2], cut: [3], wire: [1] },
  subnet: { solid: [4, 5, 6, 10], wire: [0, 1, 2, 3, 7, 8, 9] },
  'vpn-tunnel': { solid: [0, 1, 2], wire: [4, 5] },
  'vpn-split-tunnel': { solid: [0, 1, 2, 3], wire: [5, 6, 7] },
  'availability-zones': { solid: [0], cut: [1, 2, 3, 4, 5] },
  'hybrid-cloud': { solid: [0, 2], cut: [3, 4], wire: [1] },
  'multi-cloud': { solid: [0, 1], wire: [2] },
  'cloud-network': { solid: [0, 4, 5, 6], wire: [1, 2, 3] },
  'auto-scaling': { solid: [0, 3], cut: [1, 2, 4, 5], wire: [6, 7, 8] },
  cdn: { solid: [0, 6, 7, 8], cut: [1, 2], wire: [3, 4, 5] },
  failover: { solid: [0, 2], cut: [1, 3, 4], wire: [5, 6] },
  'topology-ring': { solid: range(0, 5), wire: range(6, 11) },
  'topology-bus': { solid: range(7, 10), wire: range(0, 6) },
  'topology-mesh': { solid: range(0, 3), wire: range(4, 9) },
  'topology-tree': { solid: range(0, 6), wire: range(7, 12) },
  ping: { solid: [0, 1], wire: [2, 3, 4, 5] },
  'speed-test': { solid: [1], lines: [0], wire: [2, 3, 4, 5, 6] },
  packet: { solid: [0], cut: [1], wire: [2, 3] },
  'packet-loss': { solid: [0, 1, 3], lines: [2] },
  traceroute: { solid: [3, 4, 5, 6], wire: [0, 1, 2] },
  'home-network': { cut: [2, 3, 4] },
};
const pick = (d, ix) => ix.map((i) => d[i]);
for (const [name, { solid = [], cut = [], lines = [], wire = [] }] of Object.entries(FILL)) {
  const d = icons[name].d;
  icons[name].fill = {
    solid: pick(d, solid),
    ...(cut.length && { cut: pick(d, cut) }),
    ...(lines.length && { lines: pick(d, lines) }),
    ...(wire.length && { wire: pick(d, wire) }),
  };
}
for (const name of ['server-plus', 'server-check', 'server-alert', 'server-x', 'server-gear', 'server-web', 'server-mail', 'server-game', 'server-media', 'server-database', 'server-maintenance'])
  icons[name].fill = SERVER_FILL;
for (const name of ['network-check', 'network-alert', 'network-gear']) icons[name].fill = { solid: pick(NETWORK_B, NETWORK_FILL.solid), wire: pick(NETWORK_B, NETWORK_FILL.wire) };
for (const name of ['globe-plus', 'globe-check', 'globe-alert', 'globe-search', 'globe-pin']) icons[name].fill = GLOBE_LOCK.fill;
icons['cloud-region'].fill = { solid: [CLOUD] };
// Antenna and bandwidth are lines only: their filled version is the outline
for (const name of ['antenna', 'bandwidth']) icons[name].fill = false;
// PoE: as dispositivos' ethernet, the square filled with the port's mouth as a hole and its outline cut
{
  const [square, mouth] = dispositivos.icons.ethernet.fill.solid[0].split(/(?=M)/);
  const port = icons['power-over-ethernet'].d[1];
  icons['power-over-ethernet'].fill = { solid: [`${square}${place(mouth, 0.7, [7, 8], [6.25, 6.25])}`], cut: [port] };
}
// Open strokes closed for the fill: the adapter's plug (it closes along the body's edge), the
// boot of the ethernet plug, the tube of the VPN (its mouth's far half cut as the seam), the
// open cloud of the migration, the data center's building (along its ground, its units knocked
// out) and the house's roof and walls (as lugares' house)
{
  const a = icons['network-adapter'].d;
  icons['network-adapter'].fill = { solid: [a[0], shut(a[1])], cut: [a[3]], wire: [a[2]] };
  const e = icons['ethernet-cable'];
  e.fill = { ...e.fill, solid: [e.d[0], shut(e.d[1])] };
  const v = icons['vpn-tunnel'];
  v.fill = { ...v.fill, solid: [...v.fill.solid, shut(v.d[3])], cut: [SEAM(12)] };
  const s = icons['vpn-split-tunnel'];
  s.fill = { ...s.fill, solid: [...s.fill.solid, shut(s.d[4])], cut: [SEAM(16)] };
  const m = icons['cloud-migration'].d;
  icons['cloud-migration'].fill = { solid: [shut(m[0]), m[3]], cut: [m[4], m[5]], lines: [m[1], m[2]] };
  const h = icons['home-network'];
  h.fill = { ...h.fill, solid: [shut(h.d[0]), shut(h.d[1])] };
}

// ── Named parts ───────────────────────────────────────────────────────────────────────────────
const PARTS = {
  'cloud-region': { cloud: [0] },
  'qr-code-wifi': { finders: [0, 1, 2], eyes: [3, 4, 5], dot: [6], wave: [7, 8] },
  'power-over-ethernet': { body: [0], port: [1] },
  'network-switch': { body: [0], ports: [1, 2, 3, 4], arrows: [5, 6, 7, 8] },
  modem: { body: [0], lights: [1, 2, 3], cable: [4] },
  'access-point': { body: [0], stem: [1], wave: [2, 3, 4, 5] },
  'wifi-extender': { body: [0], prongs: [1, 2], wave: [3, 4] },
  'wifi-mesh': { units: [0, 1], dot: [2], wave: [3, 4] },
  'mobile-hotspot': { body: [0], speaker: [1], wave: [2, 3] },
  'network-adapter': { body: [0], plug: [1], antenna: [2], light: [3] },
  'patch-panel': { body: [0], holes: [1, 2], ports: [3, 4, 5], cables: [6, 7] },
  antenna: { boom: [0], elements: [1, 2, 3, 4], mast: [5] },
  'fiber-optic': { ferrule: [0], strands: [1, 2, 3], lights: [4, 5, 6] },
  'ethernet-cable': { plug: [0, 1, 3, 4, 5], cable: [2] },
  'coaxial-cable': { collar: [0], insulator: [1], pin: [2], cable: [3] },
  'data-center': { roof: [0], rack: [1, 2], slots: [3, 5], lights: [4, 6] },
  'server-cluster': { front: [0, 1, 2], back: [3, 4] },
  'server-blade': { body: [0], blades: [1, 2, 3, 4, 5], lights: [6, 7, 8, 9, 10] },
  'virtual-machine': { host: range(0, 7), unit: [8, 9, 10] },
  'client-server': { server: [0, 1, 2], laptop: [3, 4], link: [5] },
  'peer-to-peer': { peers: [0, 1, 2, 3, 4, 5], arrow: [6, 7, 8] },
  'server-proxy': { units: [0, 1, 2, 3, 4, 5], arrow: [6, 7] },
  dns: { globe: [0, 1, 2], arrow: [3, 4], address: [5] },
  'ip-address': { node: [0], tag: [1, 2, 3] },
  subnet: { frame: [0, 1, 2, 3], nodes: [4, 5, 6], links: [7, 8, 9], outside: [10] },
  'vpn-tunnel': { nodes: [0, 1], tunnel: [2, 3], links: [4, 5] },
  'vpn-split-tunnel': { nodes: [0, 1, 2], tunnel: [3, 4], links: [5, 6], bypass: [7] },
  cdn: { globe: [0, 1, 2], links: [3, 4, 5], nodes: [6, 7, 8] },
  'availability-zones': { region: [0, 1, 2], zones: [3, 4, 5] },
  'hybrid-cloud': { cloud: [0], link: [1], server: [2, 3, 4] },
  'multi-cloud': { clouds: [0, 1], link: [2] },
  'cloud-network': { cloud: [0], links: [1, 2, 3], nodes: [4, 5, 6] },
  'cloud-migration': { cloud: [0], arrow: [1, 2], server: [3, 4, 5] },
  'auto-scaling': { units: [0, 1, 2, 3, 4, 5], arrow: [6, 7, 8] },
  failover: { primary: [0, 1], standby: [2, 3, 4], arrow: [5, 6] },
  'topology-ring': { nodes: range(0, 5), links: range(6, 11) },
  'topology-bus': { backbone: [0, 1, 2], links: range(3, 6), nodes: range(7, 10) },
  'topology-mesh': { nodes: range(0, 3), links: range(4, 9) },
  'topology-tree': { nodes: range(0, 6), links: range(7, 12) },
  ping: { nodes: [0, 1], arrow: [2, 3, 4, 5] },
  bandwidth: { pipe: [0, 1], level: [2, 3, 4] },
  'speed-test': { dial: [0], pivot: [1], needle: [2], arrows: [3, 4, 5, 6] },
  packet: { packet: [0, 1], motion: [2, 3] },
  'packet-loss': { packets: [0, 1], track: [2], lost: [3] },
  traceroute: { links: [0, 1, 2], start: [3], hops: [4, 5], end: [6] },
  'home-network': { roof: [0], walls: [1], dot: [2], wave: [3, 4] },
};
for (const name of ['server-plus', 'server-check', 'server-alert', 'server-x', 'server-gear', 'server-web', 'server-mail', 'server-game', 'server-media', 'server-database', 'server-maintenance'])
  PARTS[name] = SERVER_PARTS;
for (const name of ['network-check', 'network-alert', 'network-gear']) PARTS[name] = { hub: [0], links: [1, 2, 3], nodes: [4, 5, 6] };
for (const name of ['globe-plus', 'globe-check', 'globe-alert', 'globe-search', 'globe-pin']) PARTS[name] = GLOBE_LOCK.parts;
for (const [name, parts] of Object.entries(PARTS)) icons[name].parts = parts;

// ── Levels: the wifi fans light up from the inside out, the chevrons from the first ─────────────
icons['qr-code-wifi'].levels = [[7], [8]];
icons['access-point'].levels = [[2, 3], [4, 5]];
icons['wifi-extender'].levels = [[3], [4]];
icons['wifi-mesh'].levels = [[3], [4]];
icons['mobile-hotspot'].levels = [[2], [3]];
icons['home-network'].levels = [[3], [4]];
icons.bandwidth.levels = [[2], [3], [4]];
// A value: the needle sweeps the dial, from its left end (180°) at 0 to its right end (360°) at 1
icons['speed-test'].value = { turn: { parts: ['needle'], origin: SPEED_C, from: 180, to: 360, at: 305 } };

// ── Mirror: what flows one way flips in right-to-left languages ────────────────────────────────
for (const name of ['dns', 'ping', 'bandwidth', 'packet', 'packet-loss', 'traceroute', 'server-proxy', 'vpn-split-tunnel', 'subnet']) icons[name].mirror = true;

// ── Automatic variants that make no sense ─────────────────────────────────────────────────────
const variants = (names, v) => {
  for (const name of names) icons[name].variants = { ...icons[name].variants, ...v };
};
// With a badge: scaled down to 58–60 % the badge stops reading, and the slash would cut through it
for (const icon of Object.values(icons)) if (icon.badge) icon.variants = { ...icon.variants, circle: false, square: false, slash: false };
// Already enclosed: a frame or a circle of their own
variants(['availability-zones', 'virtual-machine', 'subnet', 'power-over-ethernet', 'qr-code-wifi'], { square: false });
variants(['topology-ring'], { circle: false });

// ── Motion ────────────────────────────────────────────────────────────────────────────────────
icons['server-gear'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['network-gear'].motion = { effect: 'spin', parts: ['badge'], origin: BC };
icons['server-alert'].motion = { effect: 'wiggle', parts: ['badge'], origin: BC };
icons['network-alert'].motion = { effect: 'wiggle', parts: ['badge'], origin: BC };
icons['globe-alert'].motion = { effect: 'wiggle', parts: ['badge'], origin: BC };
icons['server-maintenance'].motion = { effect: 'wiggle', parts: ['badge'], origin: BC };
icons['globe-pin'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] };
icons['cloud-region'].motion = { effect: 'bounce', parts: ['badge'], vector: [0, -1.5] };
icons['power-over-ethernet'].motion = { effect: 'beat', parts: ['badge'], origin: BC };
// The wifi fans pulse from their dot
icons['access-point'].motion = { effect: 'beat', parts: ['wave'], origin: AP_C };
icons['wifi-extender'].motion = { effect: 'beat', parts: ['wave'], origin: [14, 12] };
icons['wifi-mesh'].motion = { effect: 'beat', parts: ['wave'], origin: [12, 9] };
icons['mobile-hotspot'].motion = { effect: 'beat', parts: ['wave'], origin: [12, 9.25] };
icons['home-network'].motion = { effect: 'beat', parts: ['wave'], origin: [12, 17] };
icons['qr-code-wifi'].motion = { effect: 'beat', parts: ['wave'], origin: [17.25, 20] };
// The tag swings from its node; the plug pushes in; the needle rocks on its pivot
icons['ip-address'].motion = { effect: 'ring', parts: ['tag'], origin: [12, 4.75] };
icons['ethernet-cable'].motion = { effect: 'slide', vector: [0, -1.5] };
icons['speed-test'].motion = { effect: 'wiggle', parts: ['needle'], origin: SPEED_C };
// What flows moves along its way
icons['server-proxy'].motion = { effect: 'slide', parts: ['arrow'], vector: [1.5, 0] };
icons['cloud-migration'].motion = { effect: 'slide', parts: ['arrow'], vector: [0, -1.5] };
icons.bandwidth.motion = { effect: 'slide', parts: ['level'], vector: [1.5, 0] };
icons.packet.motion = { effect: 'slide', vector: [1.5, 0] };
icons['packet-loss'].motion = { effect: 'slide', parts: ['lost'], vector: [0, 1.5] };
icons['multi-cloud'].motion = { effect: 'float', parts: ['clouds'], vector: [0, -1] };
icons['hybrid-cloud'].motion = { effect: 'float', parts: ['cloud'], vector: [0, -1] };
icons['cloud-network'].motion = { effect: 'float', parts: ['cloud'], vector: [0, -1] };
icons['topology-ring'].motion = { effect: 'spin', origin: [12, 12] };

// ── 16 px (DESIGN.md › 16 px): custom drawings where pixel snapping isn't enough ──────────────
// At 16 px a pixel is 1.5 of the canvas: straight runs go on pixel centers (0.75 + 1.5k), 45°
// diagonals through them, a 2 × 2 dot (r 1) on a pixel corner and a one-pixel light (r 0.1) on a
// pixel center, with at least 1 px between pieces. The fans keep their dot and one arc, the lights
// in a row stand 1 px apart, and the small globes are a ring of 7 pixels with a straight equator and
// meridian (a meridian drawn as a lens, 1 pixel from the outline, turned them into a gray waffle).
const px = (k) => 0.75 + 1.5 * k;
const g = (c, r) => [px(c), px(r)];
const pl = (...cells) => line(...cells.map(([c, r]) => g(c, r)));
const small = (name, d, fill) => {
  icons[name].small = { d, ...(fill && { fill }) };
};
/** A globe of r 4.5 centered on a pixel: its outline, and its equator and meridian inside it. */
const globe16 = (c, r) => [circ(...g(c, r), 4.5), pl([c - 2, r], [c + 2, r]), pl([c, r - 2], [c, r + 2])];
// Home network: the house as the engine snaps it, the dot and one arc in it
{
  const [roof, walls] = lugares.icons.house.d.slice(0, 2).map(snapper(lugares.icons.house.d));
  const d = [roof, walls, dot(12, 16.5, 1), arc(12, 16.5, 5.25, 225, 315).d];
  small('home-network', d, { solid: [shut(roof), shut(walls)], cut: d.slice(2) });
}
// Mesh: the two units 2 px apart, the dot 1 px above them and one arc
{
  const d = [sq(3.75, 11.25, 6, 9, 2, BR), sq(14.25, 11.25, 6, 9, 2, BR), dot(12, 7.5, 1), arc(12, 7.5, 5.25, 225, 315).d];
  small('wifi-mesh', d, { solid: d.slice(0, 3), wire: [d[3]] });
}
// Hotspot: the phone 4 × 8 px, its speaker 2 px, and two arcs whose tops fall on pixel rows
{
  const c = [12, 9.75];
  const d = [sq(8.25, 9.75, 7.5, 12, 2, BR), pl([7, 8], [8, 8]), arc(...c, 4.5, 235, 305).d, arc(...c, 7.5, 235, 305).d];
  small('mobile-hotspot', d, { solid: [d[0]], cut: [d[1]], wire: d.slice(2) });
}
// QR wifi: the three finders 6 px with their 2 × 2 eyes, and in the fourth corner the dot and one arc
{
  const finder = (x, y) => sq(x, y, 7.5, 7.5, 1.75);
  const F = [finder(2.25, 2.25), finder(14.25, 2.25), finder(2.25, 14.25)];
  const eyes = [dot(6, 6, 1), dot(18, 6, 1), dot(6, 18, 1)];
  const d = [...F, ...eyes, dot(18, 19.5, 1), arc(18, 19.5, 5.25, 225, 315).d];
  small('qr-code-wifi', d, { solid: [...F, d[6]], cut: eyes, wire: [d[7]] });
}
// Modem: the three lights as 2 × 2 dots 1 px apart (at r 0.3 they ran into a bar)
{
  const d = [sq(5.25, 2.25, 10.5, 18, 2.25, BR), ...[6, 10.5, 15].map((y) => dot(10.5, y, 1)), rline([g(10, 11), g(12, 11), g(12, 14)], 1.5)];
  small('modem', d, { solid: [d[0]], cut: d.slice(1, 4), wire: [d[4]] });
}
// Blade server: five blades 1 px apart, each light a single pixel above it
{
  const cols = [4, 6, 8, 10, 12];
  const d = [sq(3.75, 5.25, 18, 13.5, 2.25, BR), ...cols.map((c) => pl([c, 7], [c, 10])), ...cols.map((c) => circ(...g(c, 5), 0.1))];
  small('server-blade', d, { solid: [d[0]], cut: d.slice(1) });
}
// Speed test: the dial with its sides in columns 2 and 13, the needle at 45° from the pivot, and the
// two arrows 2 px apart under it
{
  const d = [
    arc(12, 12, 8.25, 180, 360).d,
    dot(12, 12, 1),
    pl([9, 6], [10, 5]),
    pl([4, 10], [4, 14]),
    pl([2, 12], [4, 14], [6, 12]),
    pl([11, 14], [11, 10]),
    pl([9, 12], [11, 10], [13, 12]),
  ];
  small('speed-test', d, { solid: [d[1]], wire: [d[0], ...d.slice(2)] });
}
// Ping: the nodes 3 × 3 rings, the arrows on rows 4 and 10 so their heads keep a row between them
{
  const nodes = [circ(...g(2, 7), 1.5), circ(...g(13, 7), 1.5)];
  const arrows = [pl([5, 4], [10, 4]), pl([8, 2], [10, 4], [8, 6]), pl([10, 10], [5, 10]), pl([7, 8], [5, 10], [7, 12])];
  small('ping', [...nodes, ...arrows], { solid: nodes, wire: arrows });
}
// CDN: the small globe on pixel 8 and three 2 × 2 nodes in the corners, the links on pixel diagonals
{
  const G = globe16(8, 8);
  const nodes = [dot(3, 3, 1), dot(21, 3, 1), dot(3, 21, 1)];
  const links = [pl([3, 3], [5, 5]), pl([13, 3], [11, 5]), pl([3, 13], [5, 11])];
  small('cdn', [...G, ...links, ...nodes], { solid: [G[0], ...nodes], cut: G.slice(1), wire: links });
}
// DNS: the small globe at the top left, the elbow arrow from its bottom and the address ring
{
  const G = globe16(4, 4);
  const d = [...G, rline([g(4, 7), g(4, 11), g(10, 11)], 1.5), pl([8, 9], [10, 11], [8, 13]), circ(...g(13, 11), 1.5)];
  small('dns', d, { solid: [G[0], d[5]], cut: G.slice(1), wire: [d[3], d[4]] });
}
// Failover: the units 4 px tall, 2 px apart, and the arrow as a bracket down column 1 (an arc that
// small closed against the units)
{
  const d = [
    sq(9.75, 3.75, 12, 6, 1.5, BR),
    pl([8, 4], [9, 4]),
    sq(9.75, 14.25, 12, 6, 1.5, BR),
    pl([8, 11], [9, 11]),
    dot(18, 16.5, 1),
    rline([g(5, 4), g(1, 4), g(1, 11), g(5, 11)], 1.5),
    pl([3, 9], [5, 11], [3, 13]),
  ];
  small('failover', d, { solid: [d[0], d[2]], cut: [d[1], d[3], d[4]], wire: d.slice(5) });
}
// Access point: the stem on column 8, the puck a 5 × 3 pixel pill under it and one arc a side, 2
// pixels clear of the puck (two arcs a side ran into gray bars)
{
  const puck = sq(...g(6, 7), 6, 3, 1.5);
  const d = [puck, pl([8, 1], [8, 6]), arc(...g(8, 8), 7.5, 145, 215).d, arc(...g(8, 8), 7.5, -35, 35).d];
  small('access-point', d, { solid: [puck], wire: d.slice(1) });
}
// Packet loss: the packets 4 pixels square, 1 pixel apart and 1 above the track, and the lost one
// below the track's end, level (tilted, or as a diamond, it blurred into a dot)
{
  const pk = (c, r) => sq(...g(c, r), 4.5, 4.5, 1.25, BR);
  const d = [pk(1, 3), pk(6, 3), pl([1, 8], [9, 8]), pk(11, 11)];
  small('packet-loss', d, { solid: [d[0], d[1], d[3]], lines: [d[2]] });
}
// Virtual machine: the host 14 pixels square, its corners 4 pixels a side and a dash of 4 at the
// middle of each side, a pixel apart (snapped, the dashes blurred into a gray frame), and the unit
// inside with its slot and its light on one row
{
  const frame = [
    rline([g(1, 4), g(1, 1), g(4, 1)], 2),
    rline([g(11, 1), g(14, 1), g(14, 4)], 2),
    rline([g(14, 11), g(14, 14), g(11, 14)], 0),
    rline([g(4, 14), g(1, 14), g(1, 11)], 2),
    pl([6, 1], [9, 1]),
    pl([14, 6], [14, 9]),
    pl([9, 14], [6, 14]),
    pl([1, 9], [1, 6]),
  ];
  const vm = sq(...g(4, 6), 10.5, 6, 1.5, BR);
  const d = [...frame, vm, pl([6, 8], [7, 8]), circ(...g(9, 8), 0.1)];
  small('virtual-machine', d, { solid: [vm], cut: d.slice(9), wire: frame });
}
// Traceroute: the start a 2 × 2 dot, the hops and the end 3 × 3 rings, the links on the pixel
// diagonals (at the drawing's angles they blurred into a gray zigzag)
{
  const S = [3, 13.5];
  const H = [g(5, 5), g(9, 9), g(13, 5)];
  const d = [edge(S, H[0], 1, 1.5), edge(H[0], H[1], 1.5), edge(H[1], H[2], 1.5), dot(...S, 1), ...H.map((p) => circ(...p, 1.5))];
  small('traceroute', d, { solid: d.slice(3), wire: d.slice(0, 3) });
}
// Fiber: the ferrule on the pixel diagonals and the three strands straight up, along the diagonal and
// to the right, each ending on a 2 × 2 dot (curved, they blurred into a twig)
{
  const ferrule = roundpoly([g(1, 12), g(4, 9), g(6, 11), g(3, 14)], 0.6);
  const strands = [pl([5, 9], [5, 3]), pl([6, 9], [11, 4]), pl([6, 10], [12, 10])];
  const lights = [dot(9, 3, 1), dot(18, 4.5, 1), dot(21, 15, 1)];
  small('fiber-optic', [ferrule, ...strands, ...lights], { solid: [ferrule, ...lights], wire: strands });
}
// The network by state: the hub and its three nodes as 3 × 3 rings on the pixel diagonals, the nodes
// at the top left, top right and bottom left so the badge's corner stays clear (turned as at 24 px,
// their rings fell between pixels and the links blurred)
{
  const hub = g(6, 6);
  const nodes = [g(2, 2), g(10, 2), g(2, 10)];
  const d = [circ(...hub, 1.5), ...nodes.map((p) => edge(hub, p, 1.5)), ...nodes.map((p) => circ(...p, 1.5))];
  const fill = { solid: [d[0], ...d.slice(4)], wire: d.slice(1, 4) };
  for (const [name, kind] of [['network-check', 'check'], ['network-alert', 'alert'], ['network-gear', 'gear']]) icons[name].small = { d, fill, badge: badge(kind, { size: 16 }) };
}
// Switch: the box 14 pixels wide, its four ports single pixels 2 apart, and the two arrows with heads
// of a pixel a side (two-pixel arms ran into each other and into the box)
{
  const body = sq(...g(1, 9), 19.5, 6, 2, BR);
  const ports = [3, 6, 9, 12].map((c) => circ(...g(c, 11), 0.1));
  const d = [body, ...ports, pl([3, 3], [12, 3]), pl([11, 2], [12, 3], [11, 4]), pl([12, 6], [3, 6]), pl([4, 5], [3, 6], [4, 7])];
  small('network-switch', d, { solid: [body], cut: ports, wire: d.slice(5) });
}
// Patch panel: the strip 13 pixels wide, its mounting holes 2 × 2 dots a pixel in from its ends, two
// ports 2 pixels tall between them (three left no pixel between the holes and the ports), and the
// cables leaving under the ports and turning to the left, a pixel apart
{
  const strip = sq(...g(1, 2), 18, 7.5, 2, BR);
  const holes = [dot(6, 7.5, 1), dot(16.5, 7.5, 1)];
  const ports = [6, 8].map((c) => pl([c, 4], [c, 5]));
  const cables = [rline([g(6, 8), g(6, 11), g(1, 11)], 1.5), rline([g(8, 8), g(8, 13), g(1, 13)], 1.5)];
  const d = [strip, ...holes, ...ports, ...cables];
  small('patch-panel', d, { solid: [strip], cut: [...holes, ...ports], wire: cables });
}

// ── Custom badges at 16 px: as the engine's do, each drops its disc and keeps its sign, larger and
// on the pixel grid around the badge's pixel (column and row 11); the base is snapped as the engine
// would snap it (as desarrollo's custom badges) ──
const PIXEL = new Map();
const pixel = (b, d, fill) => PIXEL.set(b, { d, knock: `${RING}${d.join('')}`, ...(fill && { fill }) });
{
  // Globe: the ring of the engine's 16 px magnifier (r 3) with its equator and meridian inside it
  const ring = circ(...BC, 3);
  const marks = [pl([10, 11], [12, 11]), pl([11, 10], [11, 12])];
  pixel(GLOBE_B, [ring, ...marks], { solid: [ring], cut: marks });
  // Envelope: 7 × 6 pixels with the signature corner and its flap down to row 12
  const env = sq(...g(8, 9), 9, 7.5, 1.2, BR);
  const flap = pl([9, 10], [11, 12], [13, 10]);
  pixel(ENVELOPE_B, [env, flap], { solid: [env], cut: [flap] });
  // Play: a triangle on the pixel diagonals
  const play = roundpoly([g(9, 8), g(12, 11), g(9, 14)], 0.3);
  pixel(PLAY_B, [play], { solid: [play] });
  // Database: a drum of 5 × 7 pixels and its two bands
  const drum = sq(...g(9, 8), 6, 9, 1.5);
  const bands = [pl([9, 10], [13, 10]), pl([9, 12], [13, 12])];
  pixel(DATABASE_B, [drum, ...bands], { solid: [drum], cut: bands });
  // Wrench: the handle on the diagonal and the jaw across its end, open toward the corner (a jaw of
  // a row and a column read as a check mark)
  pixel(WRENCH_B, [pl([8, 14], [11, 11]), pl([12, 8], [10, 10], [12, 12], [14, 10])]);
  // Gamepad: its body, the notch between the grips
  const pad = roundpoly([g(8, 10), g(14, 10), g(14, 14), g(12, 14), g(11, 13), g(10, 14), g(8, 14)], [0.6, 0.6, 0.6, 0.3, 0.3, 0.3, 0.6]);
  pixel(GAMEPAD_B, [pad], { solid: [pad] });
  // Pin: its head on pixel rows, columns and diagonals over the point, its hole a pixel (a round
  // head blurred into a gear)
  const pin = roundpoly([g(10, 8), g(12, 8), g(13, 9), g(13, 11), g(11, 13), g(9, 11), g(9, 9)], 0.3);
  const hole = circ(...g(11, 10), 0.1);
  pixel(PIN_B, [pin, hole], { solid: [pin], cut: [hole] });
  // Bolt: the zigzag in ink
  pixel(BOLT_B, [pl([13, 8], [10, 11], [12, 11], [9, 14])]);
}
for (const icon of Object.values(icons)) {
  const b16 = PIXEL.get(icon.badge);
  if (!b16 || icon.small) continue;
  const fill = icon.fill || null;
  const sn = snapper([...icon.d, ...(fill ? Object.values(fill).flat() : [])]);
  icon.small = { d: icon.d.map(sn), ...(fill && { fill: Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v.map(sn)])) }), badge: b16 };
}

export default { category: 'redes', label: 'Redes e infraestructura', icons };
