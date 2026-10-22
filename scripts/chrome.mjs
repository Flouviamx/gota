// Headless Chrome over the DevTools Protocol, with no dependencies: the review sheets use it to
// render local HTML to PNG. The CHROME environment variable sets the browser path.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'fi-'));
  const port = 9800 + Math.floor(Math.random() * 900);
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    } catch {}
  }
  if (!target) throw new Error(`Chrome did not open (${CHROME}): set CHROME to its path.`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id) pending.get(m.id)?.(m);
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result?.value;
  /** Renders an HTML file to PNG at its full height; returns the buffer. */
  const shoot = async (file, width) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 400, deviceScaleFactor: 2, mobile: false });
    await send('Page.enable');
    await send('Page.navigate', { url: `file://${file}` });
    await sleep(700);
    const h = await evaluate('document.documentElement.scrollHeight');
    await send('Emulation.setDeviceMetricsOverride', { width, height: h, deviceScaleFactor: 2, mobile: false });
    await sleep(200);
    return Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
  };
  const close = async () => {
    ws.close();
    chrome.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  };
  return { send, evaluate, shoot, close };
}
