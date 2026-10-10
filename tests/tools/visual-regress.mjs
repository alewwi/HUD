// Визуальный регресс стендов: снимки безголовым Edge/Chrome и сравнение с эталонами.
//
//   node tests/tools/visual-regress.mjs            быстрый: 3 показательные темы × стенд тем + все стенды
//   node tests/tools/visual-regress.mjs --wide     широкий: все темы — перед выпуском версии
//   node tests/tools/visual-regress.mjs --update   принять текущие снимки эталонами
//   BROWSER=путь\к\chrome.exe  — другой браузер (по умолчанию Edge)
//
// Эталоны: tests/screens/<стенд>/<вариант>.png, их хеши — tests/screens/manifest.json
// (видно, какие эталоны менялись и когда, даже если PNG лежат вне репозитория).
// Отчёт: tests/screens/.report/index.html — эталон | сейчас | разница.
//
// Детерминизм — вся сложность: без него прогон «падает» на шуме, ему
// перестают верить. Поэтому в копию стенда вставляем: гашение анимаций и
// переходов, замороженное время (Date и performance), ждём шрифты (virtual
// time budget). Вьюпорт и масштаб фиксированы, снимаем две ширины: 1280 и 390.
// Эмодзи на разных машинах рисуются по-разному — прогон держите на одной машине.
// Сравнение: пиксель отличается, если канал разошёлся больше чем на 10%;
// снимок изменился, если таких пикселей больше 0,1%.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const ЭКРАНЫ = path.join(КОРЕНЬ, 'tests', 'screens');
const ОТЧЁТ = path.join(ЭКРАНЫ, '.report');
const аргументы = new Set(process.argv.slice(2));
const ШИРОКИЙ = аргументы.has('--wide'), ПРИНЯТЬ = аргументы.has('--update');

// pngjs — из зависимостей самой Таверны (две папки выше data/).
const require = createRequire(import.meta.url);
let PNG;
for (const п of [path.resolve(КОРЕНЬ, '../../../../node_modules/pngjs'), 'pngjs']) { try { ({ PNG } = require(п)); break; } catch (_) { /* следующий */ } }
if (!PNG) { console.error('Нет pngjs: ни в node_modules Таверны, ни рядом.'); process.exit(1); }

const БРАУЗЕР = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!БРАУЗЕР) { console.error('Не нашёл Edge или Chrome; укажите BROWSER=…'); process.exit(1); }

// Темы стенда тем: показательные (светлая, «бумажная», тёмная) и все — для широкого.
const ВСЕ_ТЕМЫ = (() => { try { const s = fs.readFileSync(path.join(ТУТ, 'theme-stand.html'), 'utf8'); const sel = (s.match(/<select id="t">([\s\S]*?)<\/select>/) || [])[1] || ''; return [...sel.matchAll(/<option>([a-z0-9-]+)<\/option>/g)].map(m => m[1]); } catch (_) { return []; } })();
const ПОКАЗАТЕЛЬНЫЕ = ['kawaii', 'medieval', 'vamp'].filter(t => ВСЕ_ТЕМЫ.includes(t));
const темы = ШИРОКИЙ ? ВСЕ_ТЕМЫ : (ПОКАЗАТЕЛЬНЫЕ.length ? ПОКАЗАТЕЛЬНЫЕ : ВСЕ_ТЕМЫ.slice(0, 3));
const ШИРИНЫ = [1280, 390];
const СНИМКИ = [
  ...темы.flatMap(t => ШИРИНЫ.map(w => ({ стенд: 'theme', файл: 'theme-stand.html', запрос: `?t=${t}&w=${w < 600 ? '215px' : ''}`, вариант: `${t}-${w}`, w }))),
  ...['life-stand.html', 'combat-stand.html', 'views-stand.html', 'stand.html'].filter(ф => fs.existsSync(path.join(ТУТ, ф)))
    .flatMap(ф => ШИРИНЫ.map(w => ({ стенд: ф.replace(/-?stand\.html$/, '') || 'stand', файл: ф, запрос: '', вариант: String(w), w }))),
];

const ЗАМОРОЗКА = `<style id="vr-freeze">*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}</style>
<script>(()=>{const T=Date.UTC(2028,5,15,12,0,0);const D=Date;class Z extends D{constructor(...a){super(...(a.length?a:[T]));}static now(){return T;}}globalThis.Date=Z;try{const p0=performance.now();performance.now=()=>0;}catch(_){}Math.random=(()=>{let s=42;return()=>(s=(s*16807)%2147483647)/2147483647;})();})();</script>`;

const профиль = fs.mkdtempSync(path.join(os.tmpdir(), 'hud-vr-'));
const снять = (с) => {
  const src = fs.readFileSync(path.join(ТУТ, с.файл), 'utf8');
  const копия = path.join(ТУТ, `.vr-${с.файл}`);
  fs.writeFileSync(копия, src.replace(/<head[^>]*>/i, (m) => m + ЗАМОРОЗКА) .replace(/^(?![\s\S]*<head)/, ЗАМОРОЗКА));
  const куда = path.join(ОТЧЁТ, 'now', с.стенд, с.вариант + '.png');
  fs.mkdirSync(path.dirname(куда), { recursive: true });
  try {
    execFileSync(БРАУЗЕР, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--allow-file-access-from-files', `--user-data-dir=${профиль}`, `--window-size=${с.w},${с.w < 600 ? 5200 : 3600}`,
      '--virtual-time-budget=6000', `--screenshot=${куда}`, pathToFileURL(копия).href + с.запрос], { stdio: 'ignore', timeout: 90000 });
  } finally { try { fs.unlinkSync(копия); } catch (_) { /* уже нет */ } }
  return куда;
};

function сравнить(а, б, разница) {
  const A = PNG.sync.read(fs.readFileSync(а)), B = PNG.sync.read(fs.readFileSync(б));
  if (A.width !== B.width || A.height !== B.height) return { доля: 1, причина: `размер ${A.width}×${A.height} → ${B.width}×${B.height}` };
  const D = new PNG({ width: A.width, height: A.height });
  let разных = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    const иное = d > 25.5;   // threshold 0.1
    if (иное) разных++;
    D.data[i] = иное ? 255 : A.data[i] * .25; D.data[i + 1] = иное ? 40 : A.data[i + 1] * .25; D.data[i + 2] = иное ? 60 : A.data[i + 2] * .25; D.data[i + 3] = 255;
  }
  fs.mkdirSync(path.dirname(разница), { recursive: true });
  fs.writeFileSync(разница, PNG.sync.write(D));
  return { доля: разных / (A.width * A.height), причина: '' };
}

const хеш = (ф) => crypto.createHash('sha256').update(fs.readFileSync(ф)).digest('hex');
const манифестПуть = path.join(ЭКРАНЫ, 'manifest.json');
const манифест = fs.existsSync(манифестПуть) ? JSON.parse(fs.readFileSync(манифестПуть, 'utf8')) : {};
const строки = [];
let изменено = 0, новых = 0;
console.log(`${ШИРОКИЙ ? 'Широкий' : 'Быстрый'} прогон: ${СНИМКИ.length} снимков, браузер ${path.basename(БРАУЗЕР)}`);
for (const с of СНИМКИ) {
  const сейчас = снять(с);
  const эталон = path.join(ЭКРАНЫ, с.стенд, с.вариант + '.png');
  const ключ = `${с.стенд}/${с.вариант}`;
  if (ПРИНЯТЬ || !fs.existsSync(эталон)) {
    fs.mkdirSync(path.dirname(эталон), { recursive: true });
    fs.copyFileSync(сейчас, эталон);
    манифест[ключ] = { sha256: хеш(эталон), когда: new Date().toISOString() };
    if (!ПРИНЯТЬ) новых++;
    console.log(`  ${ПРИНЯТЬ ? 'принят' : 'новый эталон'}  ${ключ}`);
    continue;
  }
  const разница = path.join(ОТЧЁТ, 'diff', с.стенд, с.вариант + '.png');
  const р = сравнить(эталон, сейчас, разница);
  const плохо = р.доля > 0.001;
  if (плохо) { изменено++; строки.push({ ключ, эталон, сейчас, разница, р }); }
  console.log(`  ${плохо ? 'ИЗМЕНЁН' : 'ок      '}  ${ключ}  ${(р.доля * 100).toFixed(3)}%${р.причина ? ' — ' + р.причина : ''}`);
}
fs.mkdirSync(ЭКРАНЫ, { recursive: true });
fs.writeFileSync(манифестПуть, JSON.stringify(манифест, null, 2) + '\n');
fs.mkdirSync(ОТЧЁТ, { recursive: true });
const отн = (ф) => path.relative(ОТЧЁТ, ф).split(path.sep).join('/');
fs.writeFileSync(path.join(ОТЧЁТ, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Визуальный регресс HUD</title>
<style>body{font:14px system-ui;background:#16161c;color:#eee;margin:16px}h2{font-size:15px;margin:24px 0 8px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}img{width:100%;border:1px solid #333}figcaption{opacity:.7;font-size:12px}</style>
<h1>Визуальный регресс: изменено ${изменено} из ${СНИМКИ.length}</h1>${строки.length ? '' : '<p>Расхождений нет.</p>'}
${строки.map(с => `<h2>${с.ключ} — ${(с.р.доля * 100).toFixed(3)}% ${с.р.причина}</h2><div class="row"><figure><img src="${отн(с.эталон)}"><figcaption>эталон</figcaption></figure><figure><img src="${отн(с.сейчас)}"><figcaption>сейчас</figcaption></figure><figure><img src="${отн(с.разница)}"><figcaption>разница</figcaption></figure></div>`).join('')}`);
try { fs.rmSync(профиль, { recursive: true, force: true }); } catch (_) { /* браузер ещё держит */ }
console.log(`\nИзменено: ${изменено}, новых эталонов: ${новых}. Отчёт: ${path.join(ОТЧЁТ, 'index.html')}`);
process.exitCode = изменено ? 1 : 0;
