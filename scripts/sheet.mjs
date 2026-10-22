// Hoja de revisión de una categoría (o de todas): previews/<categoría>-<n>.png, 40 íconos por
// página, cada uno a 96 px con sus keylines, a 24 px, a 18 px y dentro de una pastilla de 36 px.
// También avisa de los íconos que se salen del área viva (trazo fuera de 1.75–22.25).
// Uso: node scripts/sheet.mjs <categoría|all>
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { render } from '../engine/variants.mjs';
import { loadAll } from './load.mjs';

const target = process.argv[2] ?? 'all';
const { categories, errors } = await loadAll({ only: target === 'all' ? undefined : target });
if (errors.length) console.warn(`(avisos de validación)\n${errors.map((e) => `  - ${e}`).join('\n')}`);
const list = categories.filter((c) => target === 'all' || c.category === target).flatMap((c) => Object.entries(c.icons));
if (!list.length) throw new Error(`Sin íconos para «${target}»`);

const KEYS = '<g stroke="#ff375f" stroke-opacity=".4" stroke-width=".08"><circle cx="12" cy="12" r="9"/><rect x="3.25" y="3.25" width="17.5" height="17.5"/><rect x="2.5" y="5" width="19" height="14"/><rect x="4.75" y="2.75" width="14.5" height="18.5"/><rect x="2" y="2" width="20" height="20" stroke-dasharray=".3 .3"/></g>';
// El dibujo completo (con su insignia), con el mismo render que el paquete
let n = 0;
const svg = (icon, size, sw, keys = '') => `<svg data-i width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${keys}${render(icon, { weight: sw, id: `s${n++}` })}</svg>`;
const page = (items) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#161617;color:#fff;font:12px "Helvetica Neue",Helvetica,Arial}
.g{display:grid;grid-template-columns:repeat(8,1fr);gap:1px;background:#2a2a2c}
.c{background:#161617;display:flex;flex-direction:column;align-items:center;gap:9px;padding:14px 4px 10px}
.r{display:flex;gap:12px;align-items:center}.n{color:#ffffffa0;font-size:11px}
.p{display:grid;place-items:center;width:36px;height:36px;border-radius:99px;background:#ffffff1f}
.l{background:#f5f5f7;color:#1d1d1f;border-radius:8px;padding:4px;line-height:0}
</style><div class="g">${items.map(([name, icon]) => `<div class="c" data-name="${name}">${svg(icon, 96, 1.5, KEYS)}<div class="r">${svg(icon, 24, 1.5)}${svg(icon, 18, 1.8)}<span class="p">${svg(icon, 15, 1.8)}</span><span class="l">${svg(icon, 20, 1.5)}</span></div><span class="n">${name}</span></div>`).join('')}</div>`;

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'fi-'));
const port = 9800 + Math.floor(Math.random() * 900);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let tgt;
for (let i = 0; i < 60 && !tgt; i++) {
  await sleep(200);
  try {
    tgt = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
  } catch {}
}
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id) pending.get(m.id)?.(m);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.result?.value;

mkdirSync('previews', { recursive: true });
const PER = 40;
const out = [];
const outside = [];
for (let p = 0; p * PER < list.length; p++) {
  const items = list.slice(p * PER, (p + 1) * PER);
  const file = join(process.cwd(), 'previews', `_${target}-${p + 1}-${process.pid}.html`);
  writeFileSync(file, page(items));
  await send('Emulation.setDeviceMetricsOverride', { width: 1320, height: 400, deviceScaleFactor: 2, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: `file://${file}` });
  await sleep(700);
  const h = await evaluate('document.documentElement.scrollHeight');
  const bad = await evaluate(`[...document.querySelectorAll('.c')].map(c => { const s = c.querySelector('svg'); const paths = [...s.querySelectorAll('path')].filter((p) => !p.closest('mask')); let x0=99,y0=99,x1=-99,y1=-99; for (const p of paths) { const b = p.getBBox(); x0=Math.min(x0,b.x); y0=Math.min(y0,b.y); x1=Math.max(x1,b.x+b.width); y1=Math.max(y1,b.y+b.height); } return [c.dataset.name, x0, y0, x1, y1]; }).filter(([, a, b, c, d]) => a < 1.75 || b < 1.75 || c > 22.25 || d > 22.25).map(([n, a, b, c, d]) => n + ' [' + [a, b, c, d].map(v => v.toFixed(2)).join(', ') + ']')`);
  outside.push(...bad);
  await send('Emulation.setDeviceMetricsOverride', { width: 1320, height: h, deviceScaleFactor: 2, mobile: false });
  await sleep(200);
  const { data } = (await send('Page.captureScreenshot', { format: 'png' })).result;
  const png = join('previews', `${target}-${p + 1}.png`);
  writeFileSync(png, Buffer.from(data, 'base64'));
  rmSync(file);
  out.push(png);
}
ws.close();
chrome.kill();
await sleep(300);
rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
console.log(`✓ ${list.length} íconos → ${out.join(', ')}`);
if (outside.length) console.log(`⚠ fuera del área viva (path entre 1.75 y 22.25):\n${outside.map((o) => `  - ${o}`).join('\n')}`);
