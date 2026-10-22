// Phase 2 features: search by meaning, morphs and transitions, auto weight and the MCP server. They read
// dist/, so run `node scripts/build.mjs` first.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { autoWeight, icons, render } from '../dist/index.js';
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

test('auto weight follows the text: 400 is regular, bolder text, thicker stroke', () => {
  assert.equal(autoWeight(400), 1.5);
  assert.ok(autoWeight(700) > autoWeight(400) && autoWeight(300) < autoWeight(400));
  assert.ok(autoWeight(100) >= 0.75 && autoWeight(900) <= 2.6);
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
