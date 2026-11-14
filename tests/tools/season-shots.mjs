// Снимки сцен погоды для README: четыре сезона в современности, четыре в
// средневековье и праздники. Таверна не нужна: скрипт сам отдаёт папку
// расширения на 127.0.0.1, открывает tests/tools/seasons-stand.html в
// безголовом Edge/Chrome и снимает нужные сцены в активном виде (как после
// касания), с анимациями, остановленными на первом кадре.
//
//   node tests/tools/season-shots.mjs            всё → docs/screens/seasons
//   node tests/tools/season-shots.mjs --only spring,halloween
//   --png — PNG вместо WebP;  BROWSER=путь\к\chrome.exe;  --width 430 (215, 320, 430, 600 — как на стенде)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const арг = process.argv.slice(2);
const знач = (имя, умолч) => (арг.includes(имя) ? арг[арг.indexOf(имя) + 1] : умолч);
const ФОРМАТ = арг.includes('--png') ? 'png' : 'webp';
const ШИРИНА = Number(знач('--width', 430));
const ТОЛЬКО = знач('--only', '') ? new Set(знач('--only', '').split(',')) : null;
const ВЫХОД = path.resolve(КОРЕНЬ, знач('--out', 'docs/screens/seasons'));
const БРАУЗЕР = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!БРАУЗЕР) { console.error('Не нашёл Edge или Chrome; укажите BROWSER=…'); process.exit(1); }
const ждать = (мс) => new Promise(r => setTimeout(r, мс));

// Сцена на стенде: сезон (строка стенда) × время суток (столбец):
// 0 утро, 1 день, 2 закат, 3 ночь. Параметры — как в адресе стенда.
const СЕЗОН = { summer: 0, autumn: 1, winter: 2, spring: 3 };
const СНИМКИ = [
  { имя: 'summer', сезон: 'summer', время: 1 },
  { имя: 'autumn', сезон: 'autumn', время: 1 },
  { имя: 'winter', сезон: 'winter', время: 1 },
  { имя: 'spring', сезон: 'spring', время: 1 },
  { имя: 'medieval-summer', сезон: 'summer', время: 1, адрес: 'medieval=1' },
  { имя: 'medieval-autumn', сезон: 'autumn', время: 1, адрес: 'medieval=1' },
  { имя: 'medieval-winter', сезон: 'winter', время: 1, адрес: 'medieval=1' },
  { имя: 'medieval-spring', сезон: 'spring', время: 1, адрес: 'medieval=1' },
  { имя: 'new-year', сезон: 'winter', время: 1, адрес: 'holidays=1' },
  { имя: 'new-year-night', сезон: 'winter', время: 3, адрес: 'holidays=1', кадр: 2400 }, // залп фейерверка
  { имя: 'halloween', сезон: 'autumn', время: 2, адрес: 'holidays=1' },
  { имя: 'easter', сезон: 'spring', время: 1, адрес: 'holidays=1' },
];

// --- Статический сервер папки расширения --------------------------------------
const ТИПЫ = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
const сервер = http.createServer((req, res) => {
  let п; try { п = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  const файл = path.join(КОРЕНЬ, п);
  if (!файл.startsWith(КОРЕНЬ)) { res.writeHead(403).end(); return; }
  fs.readFile(файл, (о, д) => { if (о) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': ТИПЫ[path.extname(файл).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(д); });
});
await new Promise(ок => сервер.listen(0, '127.0.0.1', ок));
const АДРЕС = `http://127.0.0.1:${сервер.address().port}/tests/tools/seasons-stand.html`;

// --- CDP ----------------------------------------------------------------------
const ПОРТ = 9300 + Math.floor(Math.random() * 500);
const профиль = fs.mkdtempSync(path.join(os.tmpdir(), 'hud-seasons-'));
const браузер = spawn(БРАУЗЕР, ['--headless=new', `--remote-debugging-port=${ПОРТ}`, `--user-data-dir=${профиль}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
let сокет, номер = 0;
const ответы = new Map();
for (let i = 0; i < 60 && !сокет; i++) {
  try { const ц = (await (await fetch(`http://127.0.0.1:${ПОРТ}/json/list`)).json()).find(ц => ц.type === 'page'); if (ц) сокет = new WebSocket(ц.webSocketDebuggerUrl); } catch (_) { /* ещё не поднялся */ }
  if (!сокет) await ждать(250);
}
if (!сокет) throw new Error('браузер не ответил');
await new Promise((ок, нет) => { сокет.onopen = ок; сокет.onerror = нет; });
сокет.onmessage = (e) => { const м = JSON.parse(e.data); if (м.id && ответы.has(м.id)) { const [ок, нет] = ответы.get(м.id); ответы.delete(м.id); м.error ? нет(new Error(м.error.message)) : ок(м.result); } };
const cdp = (method, params = {}) => new Promise((ок, нет) => { const id = ++номер; ответы.set(id, [ок, нет]); сокет.send(JSON.stringify({ id, method, params })); });
const выполнить = async (код) => { const р = await cdp('Runtime.evaluate', { expression: `(async () => { ${код} })()`, awaitPromise: true, returnByValue: true }); if (р.exceptionDetails) throw new Error(р.exceptionDetails.exception?.description || р.exceptionDetails.text); return р.result.value; };

fs.mkdirSync(ВЫХОД, { recursive: true });
let прошлый = '';
try {
  for (const с of СНИМКИ) {
    if (ТОЛЬКО && !ТОЛЬКО.has(с.имя)) continue;
    const адрес = `${АДРЕС}?anim=1&w=${ШИРИНА}px${с.адрес ? '&' + с.адрес : ''}`;
    if (адрес !== прошлый) {
      await cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 2, mobile: false });
      await cdp('Page.navigate', { url: адрес });
      for (let i = 0; i < 80; i++) { if (await выполнить('return !!window.__ready').catch(() => false)) break; await ждать(250); }
      const H = await выполнить('return document.documentElement.scrollHeight');
      await cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: H, deviceScaleFactor: 2, mobile: false });
      await выполнить('await document.fonts.ready; return 1');
      await ждать(1500);
      прошлый = адрес;
    }
    // Сцена в активном виде (как после касания: без приглушающей плёнки покоя),
    // анимации остановлены на кадре с.кадр мс (по умолчанию — первый кадр).
    await выполнить(`for (const а of document.getAnimations()) if (а instanceof CSSAnimation) { а.pause(); а.currentTime = ${с.кадр || 0}; } return 1;`);
    await ждать(300);
    const к = await выполнить(`const w = document.querySelectorAll('.hud-scene-widget')[${СЕЗОН[с.сезон] * 4 + с.время}]; const r = w.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };`);
    // Пустой кадр (слой ещё не дорисован) весит пару килобайт — переснимаем.
    let р;
    for (let попытка = 0; попытка < 6; попытка++) {
      р = await cdp('Page.captureScreenshot', { format: ФОРМАТ, quality: ФОРМАТ === 'webp' ? 88 : undefined, clip: { ...к, scale: 1 } });
      if (р.data.length > 12000) break;
      await выполнить(`window.scrollTo(0, ${Math.max(0, к.y - 200)}); return 1`); await ждать(700);
    }
    const файл = path.join(ВЫХОД, `${с.имя}.${ФОРМАТ}`);
    fs.writeFileSync(файл, Buffer.from(р.data, 'base64'));
    console.log('✓', path.relative(КОРЕНЬ, файл), `${Math.round(к.width)}×${Math.round(к.height)}`);
  }
} finally {
  try { await cdp('Browser.close'); } catch (_) { браузер.kill(); }
  сервер.close();
  setTimeout(() => { try { fs.rmSync(профиль, { recursive: true, force: true }); } catch (_) { /* занят */ } process.exit(0); }, 500);
}
