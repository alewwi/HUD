// Обмер рисунков: браузер считает настоящие рамки предметов (с толщиной линий),
// build.mjs по ним ставит каждый рисунок по центру плитки в единый размер.
//   node tests/tools/phone-icons-stand/measure.mjs  →  bbox.json и index.html
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ЗДЕСЬ = path.dirname(fileURLToPath(import.meta.url));
const ХРОМ = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const сборка = (env) => { const r = spawnSync(process.execPath, [path.join(ЗДЕСЬ, 'build.mjs')], { env: { ...process.env, ...env }, encoding: 'utf8' }); if (r.status) throw new Error(r.stderr); };

сборка({ HUD_RAW: '1' });
const скрипт = `<script>
const out = {};
const рамка = (g) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const база = g.getScreenCTM().inverse();
  for (const э of g.querySelectorAll('path,circle,ellipse,rect,text')) {
    const с = getComputedStyle(э);
    if (с.display === 'none' || э.closest('clipPath,defs')) continue;
    const б = э.getBBox();
    if (!б.width && !б.height) continue;
    const полу = с.stroke !== 'none' ? parseFloat(с.strokeWidth) / 2 : 0;
    const м = база.multiply(э.getScreenCTM());
    for (const [x, y] of [[б.x - полу, б.y - полу], [б.x + б.width + полу, б.y - полу], [б.x - полу, б.y + б.height + полу], [б.x + б.width + полу, б.y + б.height + полу]]) {
      const т = new DOMPoint(x, y).matrixTransform(м);
      x0 = Math.min(x0, т.x); y0 = Math.min(y0, т.y); x1 = Math.max(x1, т.x); y1 = Math.max(y1, т.y);
    }
  }
  return [x0, y0, x1, y1].map(v => Math.round(v * 10) / 10);
};
document.querySelectorAll('.art[data-k]').forEach(g => { out[g.dataset.k] = рамка(g); });
const p = document.createElement('pre'); p.id = 'bbox'; p.textContent = JSON.stringify(out); document.body.append(p);
</script>`;
const файл = path.join(os.tmpdir(), 'hud-icons-measure.html');
fs.writeFileSync(файл, fs.readFileSync(path.join(ЗДЕСЬ, 'index.html'), 'utf8').replace('</body>', скрипт + '</body>'));
const р = spawnSync(ХРОМ, ['--headless=new', '--disable-gpu', '--virtual-time-budget=3000', '--dump-dom', pathToFileURL(файл).href], { encoding: 'utf8', maxBuffer: 1 << 28 });
const м = (р.stdout || '').match(/<pre id="bbox">([\s\S]*?)<\/pre>/);
if (!м) throw new Error('браузер не отдал рамки: ' + (р.stderr || '').slice(0, 300));
const рамки = JSON.parse(м[1].replace(/&quot;/g, '"'));
fs.writeFileSync(path.join(ЗДЕСЬ, 'bbox.json'), JSON.stringify(рамки));
fs.rmSync(файл, { force: true });
сборка({});
console.log('рамок:', Object.keys(рамки).length);
