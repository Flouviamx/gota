// Gota · the Figma file's cover (dist/figma/cover.png, 1920 × 1080), written by
// `node scripts/native.mjs figma`: the set itself as a quiet field on Flouvia's media black, its
// weight growing from Light at the left to Bold at the right, fading to the edges around a clearing
// where the drop (the message bubble, Gota's signature) stands in the isotype's blue over its name.
// Used as the file's thumbnail and, at v1, the Community one.
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openChrome, sleep } from '../chrome.mjs';

const W = 960; // CSS px, shot at 2x
const H = 540;
const PITCH = 50;
const SIZE = 22;
const BLUE = '#0977fa';
// The field shows plain icons: no badge, enclosure, slash, or state that repeats another's shape
const PLAIN = /-(plus|minus|x|check|off|slash|circle|square|alert|clock|dot|lock|search|edit|heart|star|question|reply|code|sparkle|up|down|left|right|in|out|on|open|2|3)$/;

export async function cover(dir, { icons, categories, toSvg }) {
  const pool = categories.flatMap((c) => c.icons).filter((n) => !PLAIN.test(n) && !icons[n].badge && n !== 'message');
  const cols = Math.ceil(W / PITCH) + 1;
  const rows = Math.ceil(H / PITCH) + 1;
  const [ox, oy] = [(W - (cols - 1) * PITCH) / 2, (H - (rows - 1) * PITCH) / 2];
  const [cx, cy] = [W / 2, H / 2 - 34];
  const [textTop, textBottom] = [cy + 84, cy + 148];
  const sized = (svg, size) => svg.replace('width="24" height="24"', `width="${size}" height="${size}"`);
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const [x, y] = [ox + c * PITCH, oy + r * PITCH];
      // The clearing: a capsule around the drop and its name
      if (Math.hypot((x - cx) / 1.25, y - Math.max(cy, Math.min(textBottom - 20, y))) < 118) continue;
      // A fixed walk through the set (a step coprime with its size), so the field is stable
      const name = pool[(cells.length * 37) % pool.length];
      const weight = 0.9 + (1.2 * c) / (cols - 1);
      cells.push(`<i style="left:${x - SIZE / 2}px;top:${y - SIZE / 2}px">${sized(toSvg(name, { weight, id: `c${cells.length}` }), SIZE)}</i>`);
    }
  const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#010204}
.f{position:absolute;inset:0;color:#8e8e93}
i{position:absolute;width:${SIZE}px;height:${SIZE}px}
.v{position:absolute;inset:0;background:radial-gradient(ellipse 58% 66% at 50% 48%,rgba(1,2,4,0) 0%,rgba(1,2,4,.2) 40%,rgba(1,2,4,.86) 72%,#010204 94%)}
.d{position:absolute;left:${cx - 56}px;top:${cy - 56}px;color:${BLUE}}
.t{position:absolute;left:0;right:0;top:${textTop}px;text-align:center;font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:#f5f5f7}
.t b{display:block;font-weight:500;font-size:40px;letter-spacing:-.02em;line-height:1}
.t span{display:block;margin-top:10px;font-size:13px;letter-spacing:.02em;color:#86868b}
</style><div class="f">${cells.join('')}</div><div class="v"></div><div class="d">${sized(toSvg('message', { variant: 'fill', id: 'drop' }), 112)}</div><div class="t"><b>Gota</b><span>Flouvia</span></div>`;
  const page = join(process.cwd(), dir, '_cover.html');
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
