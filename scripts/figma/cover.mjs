// Gota · the Figma file's cover (dist/figma/cover.png, 1920 × 1080), written by
// `node scripts/native.mjs figma`: the set itself as a quiet field on Flouvia's graphite, its weight
// growing from Light at the left to Bold at the right, fading to the edges around a clearing with
// only the name and Flouvia's logo. Both are Flouvia's and stay in its private repository, read from
// the sibling folder when the cover is drawn: the logo for dark backgrounds (public/imgs/
// logo-flouvia-1.svg, unaltered) and "Gota" in Flouvia's typeface, as outlines
// (brand/flouvia-sans/words/gota-regular.svg). Without that folder, the name is set in Helvetica Neue
// and the logo is left out. Used as the file's thumbnail and, at v1, the Community one.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openChrome, sleep } from '../chrome.mjs';

const W = 960; // CSS px, shot at 2x
const H = 540;
const PITCH = 50;
const SIZE = 22;
const GRAPHITE = '#161617';
const BRAND = new URL('../../../flouvia/', import.meta.url).pathname;
const LOGO_H = 22; // the mark (isotype and name), a signature under the name
const NAME = 72; // the name's cap height, the cover's only headline

// The logo cropped to its ink (the canvas is 3000 × 1000, the mark in the middle)
function logo() {
  const file = `${BRAND}public/imgs/logo-flouvia-1.svg`;
  if (!existsSync(file)) return '';
  const svg = readFileSync(file, 'utf8');
  const n = [...svg.matchAll(/ d="([^"]+)"/g)].flatMap((m) => m[1].match(/-?\d*\.?\d+/g).map(Number));
  const [xs, ys] = [n.filter((_, i) => i % 2 === 0), n.filter((_, i) => i % 2 === 1)];
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const cropped = svg.replace(/<svg[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.join(' ')}">`);
  return `<img src="data:image/svg+xml;base64,${Buffer.from(cropped).toString('base64')}" alt="Flouvia">`;
}
// "Gota" in Flouvia's typeface (its words are drawn with the baseline at 0 and capitals 14 high)
function name() {
  const file = `${BRAND}brand/flouvia-sans/words/gota-regular.svg`;
  if (!existsSync(file)) return '<b>Gota</b>';
  const svg = readFileSync(file, 'utf8');
  const box = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const k = NAME / 14;
  return svg.replace('<svg ', `<svg class="w" width="${(box[2] * k).toFixed(1)}" height="${(box[3] * k).toFixed(1)}" `);
}
// The field shows plain icons: no badge, enclosure, slash, or state that repeats another's shape
const PLAIN = /-(plus|minus|x|check|off|slash|circle|square|alert|clock|dot|lock|search|edit|heart|star|question|reply|code|sparkle|up|down|left|right|in|out|on|open|2|3)$/;

export async function cover(dir, { icons, categories, toSvg }) {
  const pool = categories.flatMap((c) => c.icons).filter((n) => !PLAIN.test(n) && !icons[n].badge);
  const cols = Math.ceil(W / PITCH) + 1;
  const rows = Math.ceil(H / PITCH) + 1;
  const [ox, oy] = [(W - (cols - 1) * PITCH) / 2, (H - (rows - 1) * PITCH) / 2];
  const [cx, cy] = [W / 2, H / 2];
  // The name and the logo as one block, centered
  const top = cy - (NAME * 1.1 + 22 + LOGO_H) / 2;
  const sized = (svg, size) => svg.replace('width="24" height="24"', `width="${size}" height="${size}"`);
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const [x, y] = [ox + c * PITCH, oy + r * PITCH];
      // The clearing: an ellipse around the name and the logo
      if (Math.hypot((x - cx) / 1.7, y - cy) < 108) continue;
      // A fixed walk through the set (a step coprime with its size), so the field is stable
      const name = pool[(cells.length * 37) % pool.length];
      const weight = 0.9 + (1.2 * c) / (cols - 1);
      cells.push(`<i style="left:${x - SIZE / 2}px;top:${y - SIZE / 2}px">${sized(toSvg(name, { weight, id: `c${cells.length}` }), SIZE)}</i>`);
    }
  const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${GRAPHITE}}
.f{position:absolute;inset:0;color:#8e8e93}
i{position:absolute;width:${SIZE}px;height:${SIZE}px}
.v{position:absolute;inset:0;background:radial-gradient(ellipse 58% 66% at 50% 50%,rgba(22,22,23,0) 0%,rgba(22,22,23,.2) 40%,rgba(22,22,23,.86) 72%,${GRAPHITE} 94%)}
.t{position:absolute;left:0;right:0;top:${top}px;text-align:center;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#f5f5f7}
.t b{display:block;font-weight:500;font-size:${NAME}px;letter-spacing:-.025em;line-height:1}
.t svg.w{display:block;margin:0 auto;color:#f5f5f7}
.t img{display:block;margin:22px auto 0;height:${LOGO_H}px;width:auto}
</style><div class="f">${cells.join('')}</div><div class="v"></div><div class="t">${name()}${logo()}</div>`;
  const page = resolve(dir, '_cover.html');
  writeFileSync(page, html);
  const browser = await openChrome();
  try {
    await browser.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
    await browser.send('Page.enable');
    await browser.send('Page.navigate', { url: `file://${page}` });
    await sleep(900);
    const shot = await browser.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    writeFileSync(join(dir, 'cover.png'), Buffer.from(shot.result.data, 'base64'));
  } finally {
    await browser.close();
    rmSync(page, { force: true });
  }
  return join(dir, 'cover.png');
}
