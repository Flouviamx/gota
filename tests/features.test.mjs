// Phase 2 features: search by meaning, morphs and transitions, auto weight, one module per icon,
// sprites and the MCP server (stdio and HTTP). They read
// dist/, so run `node scripts/build.mjs` first.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import * as remote from '../api/mcp.mjs';
import { autoWeight, iconData, icons, pick, render, sprite, svg, toSvg, WEIGHTS } from '../dist/index.js';
import * as perIcon from '../dist/icons/index.js';
import { changeOf, frames, morpher, transitionOf } from '../dist/morph.js';
import { fold, searchIcons } from '../dist/search.js';

const names = (q, o) => searchIcons(q, o).map((r) => r.name);

test('search: by meaning, in Spanish and English', () => {
  assert.ok(names('cobrar', { limit: 6 }).includes('wallet'));
  assert.equal(names('campana')[0], 'bell');
  assert.equal(names('notifications')[0] === 'bell' || names('notifications').slice(0, 3).includes('bell'), true);
  assert.equal(names('carrito de compras')[0], 'cart');
});

test('search: ñ stays, accents and plurals fold, empty words are ignored', () => {
  assert.equal(fold('Campaña Notificación'), 'campaña notificacion');
  assert.notEqual(names('campaña')[0], 'bell');
  assert.deepEqual(names('notificaciones', { limit: 3 }), names('notificación', { limit: 3 }));
  assert.ok(names('pagar con tarjeta', { limit: 6 }).some((n) => n.startsWith('card')));
});

test('search: partial matches when nothing matches every word', () => {
  assert.ok(names('descargar pdf', { limit: 6 }).includes('file-pdf'));
});

// The points of a path's `d`, to measure it
const points = (d) => (d.match(/-?[\d.]+/g) ?? []).map(Number).reduce((p, v, i, a) => (i % 2 ? p : [...p, [v, a[i + 1]]]), []);
const extent = (d) => Math.max(...points(d).map(([x, y], _, ps) => Math.hypot(x - ps[0][0], y - ps[0][1])));

test('morph: a stroke left over is erased along its length, never shrunk to a point', () => {
  const m = morpher(icons.menu, icons.close, transitionOf('menu', 'close'));
  assert.equal(m(0).length, 3);
  assert.equal(m(1).length, 2);
  for (let t = 0; t <= 1; t += 0.05) for (const d of m(t)) assert.ok(extent(d) > 0.01, `degenerate stroke at t=${t.toFixed(2)}`);
});

test('morph: lines that move and turn first meet, then cross (menu ↔ close)', () => {
  const half = morpher(icons.menu, icons.close, transitionOf('menu', 'close'))(0.5);
  for (const d of half) for (const [, y] of points(d)) assert.ok(Math.abs(y - 12) < 0.05);
});

test('transitions: curated morphs and turns, badge pairs found on their own, the rest swap in', () => {
  assert.deepEqual(transitionOf('plus', 'close'), { rotate: 45 });
  assert.deepEqual(transitionOf('close', 'plus'), { rotate: -45 });
  assert.deepEqual(transitionOf('menu', 'close'), { morph: true, pairs: [[0, 0], [2, 1]], origin: 'middle' });
  assert.deepEqual(transitionOf('close', 'menu').pairs, [[0, 0], [1, 2]]);
  assert.deepEqual(transitionOf('play', 'pause', icons), { replace: true });
  assert.deepEqual(transitionOf('search', 'close', icons), { replace: true });
  // Same base, different badge: in any style
  assert.deepEqual(transitionOf('bell', 'bell-off', icons), { morph: true });
  assert.deepEqual(transitionOf('file-check', 'file-x', icons, { variant: 'fill' }), { morph: true });
  // A curated morph in fill swaps in (its frames are outlines)
  assert.deepEqual(transitionOf('lock', 'lock-open', icons, { variant: 'fill' }), { replace: true });
});

test('frames: drawn by the engine; the badge draws in with its cutout and the last frame is the icon', () => {
  const opts = { weight: 1.5, id: 'x' };
  const f = frames(icons.bell, icons['bell-off'], transitionOf('bell', 'bell-off', icons), opts);
  assert.ok(!f(0).includes('mask'));
  assert.match(f(0.5), /data-part="badge"/);
  assert.match(f(0.5), /mask="url\(#x-k\)"/);
  assert.equal(f(1), render(icons['bell-off'], opts));
});

test('slash: drawn as far as asked; a component toggling it gets frames, nothing else changes', () => {
  assert.match(render(icons.bell, { slash: 0.5 }), /M3\.6 3\.6 12 12/);
  assert.ok(!render(icons.bell, { slash: 0 }).includes('3.6'));
  assert.ok(changeOf(icons, { name: 'bell', slash: false }, { name: 'bell', slash: true }).frame);
  assert.equal(changeOf(icons, { name: 'bell', slash: false }, { name: 'bell', slash: false }), null);
});

test('one module per icon: the same data as by name, named <Name>Icon, the drawn variant linked', async () => {
  assert.equal(Object.keys(perIcon).length, Object.keys(icons).length);
  assert.ok(perIcon.MapIcon && perIcon.BellOffIcon && !('Map' in perIcon));
  assert.deepEqual(perIcon.BellIcon, iconData('bell'));
  assert.equal((await import('../dist/icons/bell.js')).default, perIcon.BellIcon);
  assert.equal(pick(perIcon.BellIcon, { slash: true }).icon.name, 'bell-off');
  assert.equal(pick(perIcon.CartIcon, { slash: true }).slash, true);
  assert.equal(svg(perIcon.BellIcon, { variant: 'fill', slash: true, id: 'bell' }), toSvg('bell', { variant: 'fill', slash: true }));
});

test('sprite: one symbol per icon, mask ids of its own', () => {
  const out = sprite([iconData('bell-off'), iconData('file-check')], { variant: 'fill' });
  assert.equal(out.match(/<symbol /g).length, 2);
  assert.match(out, /<symbol id="gota-bell-off" viewBox="0 0 24 24">/);
  const ids = [...out.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, ref] of out.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref));
});

test('auto weight follows the text on the named weights\' scale: Light 300, Regular 400, Bold 700', () => {
  assert.deepEqual([300, 400, 700].map(autoWeight), [WEIGHTS.light, WEIGHTS.regular, WEIGHTS.bold]);
  assert.deepEqual([WEIGHTS.light, WEIGHTS.regular, WEIGHTS.bold], [0.9, 1.5, 2.1]);
  assert.ok(Math.abs(autoWeight(500) - 1.7) < 1e-9 && Math.abs(autoWeight(350) - 1.2) < 1e-9);
  // Gota's range ends at both: lighter and heavier text keep the ends
  assert.deepEqual([autoWeight(100), autoWeight(900)], [0.9, 2.1]);
});

test('MCP server: initialize, list tools, search and get an icon', async () => {
  const server = spawn(process.execPath, [new URL('../mcp/server.mjs', import.meta.url).pathname]);
  const lines = [];
  server.stdout.on('data', (b) => lines.push(...b.toString().split('\n').filter(Boolean)));
  const send = (m) => server.stdin.write(`${JSON.stringify(m)}\n`);
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'search_icons', arguments: { query: 'campana', limit: 3 } } });
  send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_icon', arguments: { name: 'bell', variant: 'fill' } } });
  for (let i = 0; i < 50 && lines.length < 4; i++) await new Promise((r) => setTimeout(r, 100));
  server.kill();
  const byId = Object.fromEntries(lines.map((l) => JSON.parse(l)).map((m) => [m.id, m]));
  assert.equal(byId[1].result.serverInfo.name, 'gota');
  assert.deepEqual(byId[2].result.tools.map((t) => t.name), ['search_icons', 'get_icon', 'list_categories']);
  assert.match(byId[3].result.content[0].text, /^bell/);
  assert.match(byId[4].result.content[0].text, /^<svg/);
});

test('MCP over HTTP (gota.flouvia.com/mcp): stateless JSON answers, versions, notifications and errors', async () => {
  const post = (body, headers = {}) =>
    remote.POST(new Request('https://gota.flouvia.com/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
  const rpc = async (body, headers) => {
    const res = await post(body, headers);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.equal(res.headers.get('mcp-session-id'), null);
    return res.json();
  };
  const init = (protocolVersion) => ({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion, capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  // A version it speaks comes back as asked; any other gets the newest it speaks
  const asked = await rpc(init('2025-06-18'));
  assert.equal(asked.result.protocolVersion, '2025-06-18');
  assert.equal(asked.result.serverInfo.name, 'gota');
  assert.equal((await rpc(init('2099-01-01'))).result.protocolVersion, '2025-11-25');
  // Notifications get 202 with no body; a batch gets an array with only the requests' answers
  const note = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(note.status, 202);
  assert.equal(await note.text(), '');
  const batch = await rpc([{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', id: 3, method: 'ping' }]);
  assert.deepEqual(batch.map((m) => m.id), [2, 3]);
  assert.ok(batch[0].result.tools.every((t) => t.annotations.readOnlyHint));
  // The same tools as the stdio server
  const call = (id, name, args) => rpc({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }, { 'mcp-protocol-version': '2025-06-18' });
  assert.match((await call(4, 'search_icons', { query: 'campana', limit: 3 })).result.content[0].text, /^bell/);
  assert.equal((await call(5, 'get_icon', { name: 'bell', weight: 'bold' })).result.content[0].text, toSvg('bell', { weight: 'bold' }));
  assert.equal((await call(6, 'search_icons', { query: 'file', limit: 1e6 })).result.content[0].text.split('\n').length, 50);
  // Mistakes: a tool's bad input is a tool error the model can read; protocol mistakes are JSON-RPC errors
  assert.equal((await call(7, 'get_icon', { name: 'belll' })).result.isError, true);
  assert.equal((await call(8, 'get_icon', { name: 'toString' })).result.isError, true);
  assert.equal((await call(9, 'search_icons', {})).result.isError, true);
  assert.equal((await call(10, 'delete_icons', {})).error.code, -32602);
  assert.equal((await rpc({ jsonrpc: '2.0', id: 11, method: 'resources/list' })).error.code, -32601);
  assert.equal((await rpc({ id: 12, method: 'ping' })).error.code, -32600);
  assert.equal((await post('{"jsonrpc":')).status, 400);
  assert.equal((await post({ jsonrpc: '2.0', id: 13, method: 'ping' }, { 'mcp-protocol-version': '1999-01-01' })).status, 400);
  assert.equal((await post({ jsonrpc: '2.0', id: 14, method: 'ping' }, { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await post({ jsonrpc: '2.0', id: 15, method: 'ping', params: { pad: 'x'.repeat(70_000) } })).status, 413);
  // No event stream and no sessions; any origin may ask
  const get = await remote.GET(new Request('https://gota.flouvia.com/mcp'));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST, OPTIONS');
  assert.equal((await remote.DELETE(new Request('https://gota.flouvia.com/mcp', { method: 'DELETE' }))).status, 405);
  const pre = await remote.OPTIONS(new Request('https://gota.flouvia.com/mcp', { method: 'OPTIONS' }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  assert.match(pre.headers.get('access-control-allow-headers'), /MCP-Protocol-Version/);
});
