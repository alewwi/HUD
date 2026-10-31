// Снимки для README: карточка примера HUD из окна «Кастомизация» — вкладки,
// поля, темы — на русском или английском. Без генераций и без ваших настроек:
// безголовый Edge/Chrome со своим временным профилем открывает запущенную
// Таверну, включает пример «со всеми блоками», кликает нужную вкладку и
// снимает карточку шириной 548 px с двойной плотностью.
//
//   node tests/tools/docs-shots.mjs                    русские снимки → docs/screens
//   node tests/tools/docs-shots.mjs --lang en          английские → docs/screens/en
//   node tests/tools/docs-shots.mjs --only life,phone  только эти
//   node tests/tools/docs-shots.mjs --list             вкладки примера (id и подписи)
//   node tests/tools/docs-shots.mjs --era medieval     снимки средневековья (шкатулка, подслушанное)
//   --png — снимки в PNG вместо WebP (WebP в разы легче, GitHub его показывает)
//   ST=http://127.0.0.1:8000/  BROWSER=путь\к\chrome.exe
//
// Музыка снимается со стенда tests/tools/music-stand.html (готовый плейлист).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const арг = process.argv.slice(2);
const знач = (имя, умолч) => (арг.includes(имя) ? арг[арг.indexOf(имя) + 1] : умолч);
const ЯЗЫК = знач('--lang', 'ru') === 'en' ? 'en' : 'ru';
// Формат: webp (по умолчанию, лёгкий — для README на GitHub) или png (--png).
const ФОРМАТ = арг.includes('--png') ? 'png' : 'webp';
// Эпоха профиля: снимки с полем «эпоха» идут только в своём проходе.
const ЭПОХА = знач('--era', 'modern') === 'medieval' ? 'medieval' : 'modern';
const ТОЛЬКО = знач('--only', '') ? new Set(знач('--only', '').split(',')) : null;
const ВЫХОД = path.resolve(КОРЕНЬ, знач('--out', ЯЗЫК === 'en' ? 'docs/screens/en' : 'docs/screens'));
const ST = (process.env.ST || 'http://127.0.0.1:8000/').replace(/\/?$/, '/');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const БРАУЗЕР = process.env.BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => fs.existsSync(p));
if (!БРАУЗЕР) { console.error('Не нашёл Edge или Chrome; укажите BROWSER=…'); process.exit(1); }
const ждать = (мс) => new Promise(r => setTimeout(r, мс));

// Снимки: вкладка (по подписи на любом языке), вид сцены, высота обрезки.
// поле — снять одно поле вкладки (по началу подписи), а не всю карточку.
const СНИМКИ = [
  { имя: 'overview', вкладка: ['Элеонора', 'Eleanor'], сцена: 'open', высота: 938 },
  { имя: 'character', вкладка: ['Элеонора', 'Eleanor'], сцена: 'compact', высота: 1877 },
  { имя: 'phone', вкладка: ['Телефон', 'Phone'], сцена: 'compact', телефон: true },
  { имя: 'intercepts', вкладка: ['Перехваты', 'Intercepts'], сцена: 'compact' },
  { имя: 'memory', вкладка: ['Память', 'Memory'], сцена: 'compact' },
  { имя: 'life', вкладка: ['Быт', 'Daily life'], сцена: 'compact' },
  { имя: 'combat', вкладка: ['Бой', 'Combat'], сцена: 'compact' },
  { имя: 'diary', вкладка: ['Дневник', 'Diary'], сцена: 'compact', точно: true },
  { имя: 'dreams', вкладка: ['Сны', 'Dreams'], сцена: 'compact' },
  { имя: 'nursery', вкладка: ['Детская', 'Nursery'], сцена: 'compact' },
  { имя: 'world', вкладка: ['Мир', 'World'], сцена: 'compact' },
  { имя: 'companions', вкладка: ['Спутники', 'Companions'], сцена: 'compact' },
  { имя: 'cycle', вкладка: ['Лилиан', 'Lilian'], поле: ['Менструальный цикл', 'Menstrual cycle'] },
  { имя: 'pregnancy', вкладка: ['Анна', 'Anna'], поле: ['Беременность', 'Pregnancy'] },
  { имя: 'view-trust-orbit', вкладка: ['Лилиан', 'Lilian'], поле: ['Доверие', 'Trust'], вид: ['trustView', 'orbit'] },
  { имя: 'view-fears-radar', вкладка: ['Лилиан', 'Lilian'], поле: ['Страхи', 'Fears'], вид: ['fearsView', 'radar'] },
  { имя: 'view-goals-road', вкладка: ['Лилиан', 'Lilian'], поле: ['Цели', 'Goals'], вид: ['goalsView', 'road'] },
  { имя: 'view-memories-polaroid', вкладка: ['Элеонора', 'Eleanor'], поле: ['Общие воспоминания', 'Shared memories'], вид: ['memoriesView', 'polaroid'] },
  { имя: 'view-secrets-vault', вкладка: ['Память', 'Memory'], поле: ['Зашифрованные данные', 'Encrypted data'], вид: ['secretsView', 'vault'] },
  { имя: 'view-route-tickets', вкладка: ['Память', 'Memory'], поле: ['Мини-карта маршрутов', 'Маршрут', 'Route'], вид: ['routeView', 'tickets'] },
  { имя: 'family-tree', вкладка: ['Память', 'Memory'], шаги: `т.querySelector('.hud-rel-mode[data-rel-mode="family"]').click(); await __shots.ждать(1500);`, элемент: '.hud-rel-graph' },
  { имя: 'dreams-open', вкладка: ['Сны', 'Dreams'], сцена: 'compact', шаги: `for (const з of т.querySelectorAll('.hud-dream-entry')) for (let i = 0; i < 3; i++) { з.click(); await __shots.ждать(250); } await __shots.ждать(1200);`, элемент: '.hud-tab-content.active' },
  { имя: 'phone-home', вкладка: ['Телефон', 'Phone'], шаги: `т.querySelector('.hud-phone-emulator').classList.add('unlocked'); await __shots.ждать(900);`, элемент: '.hud-phone-emulator' },
  { имя: 'phone-wallet', вкладка: ['Телефон', 'Phone'], шаги: `т.querySelector('.hud-phone-emulator').classList.add('unlocked'); т.querySelector('[data-phone-app="wallet"]').click(); await __shots.ждать(900);`, элемент: '.hud-phone-emulator' },
  { имя: 'phone-calendar', вкладка: ['Телефон', 'Phone'], шаги: `т.querySelector('.hud-phone-emulator').classList.add('unlocked'); т.querySelector('[data-phone-app="calendar"]').click(); await __shots.ждать(900);`, элемент: '.hud-phone-emulator' },
  { имя: 'phone-health', вкладка: ['Телефон', 'Phone'], шаги: `т.querySelector('.hud-phone-emulator').classList.add('unlocked'); т.querySelector('[data-phone-app="health"]').click(); await __shots.ждать(900);`, элемент: '.hud-phone-emulator' },
  { имя: 'phone-maps', вкладка: ['Телефон', 'Phone'], шаги: `т.querySelector('.hud-phone-emulator').classList.add('unlocked'); т.querySelector('[data-phone-app="maps"]').click(); await __shots.ждать(900);`, элемент: '.hud-phone-emulator' },
  // Служебный: только по --only scene (проверка фона сцены).
  { имя: 'scene', вкладка: ['Элеонора', 'Eleanor'], сцена: 'open', элемент: '.hud-scene-widget', служебный: true },
  { имя: 'theme-academia', вкладка: ['Элеонора', 'Eleanor'], сцена: 'open', высота: 938, тема: 'academia' },
  { имя: 'theme-cottage', вкладка: ['Элеонора', 'Eleanor'], сцена: 'open', высота: 938, тема: 'cottage' },
  // Новые темы и рисунки тем — для проверки, в README не идут.
  ...['darkroom', 'teaparty', 'bujo', 'biopunk', 'dieselpunk', 'solarpunk', 'voodoo', 'steampunk', 'egypt', 'western', 'noir', 'pirate', 'spaceopera', 'ice', 'ocean', 'spacehorror', 'vamp', 'kawaii', 'witch', 'japan', 'fantasy', 'academia'].map(id => ({ имя: 'theme-' + id, вкладка: ['Элеонора', 'Eleanor'], сцена: 'compact', высота: 1950, тема: id, служебный: true })),
  // Сцена значками («Без картинок»), короткая карточка.
  ...['noir', 'vamp', 'biopunk'].map(id => ({ имя: 'svg-' + id, вкладка: ['Элеонора', 'Eleanor'], сцена: 'compact', высота: 1950, тема: id, служебный: true,
    шаги: "await __shots.вид('noImages', 'on'); __shots.тело().querySelectorAll('.hud-tab-content.active .hud-body > :nth-child(n+7), .hud-tab-content.active .hud-twist').forEach(э => э.style.display = 'none'); await __shots.ждать(600);" })),
  // Рисунки темы при другом оформлении шапки и на узкой карточке.
  ...['pirate', 'egypt', 'solarpunk', 'western', 'ocean', 'vamp', 'noir', 'steampunk', 'biopunk', 'voodoo', 'spaceopera'].flatMap(id => Object.entries({"frame":"await __shots.вид('avatarDeco', 'theme'); await __shots.вид('headerOrnament', 'theme');","visit":"await __shots.вид('headerStyle', 'visit');","banner":"await __shots.вид('headerStyle', 'banner');","phone":"window.__ширинаКопии = 360;"}).map(([вар, код]) => ({ имя: 'var-' + id + '-' + вар, вкладка: ['Элеонора', 'Eleanor'], сцена: 'compact', высота: 1950, тема: id, служебный: true,
    шаги: "window.__ширинаКопии = 548; await __shots.вид('avatarDeco', 'scene'); await __shots.вид('headerOrnament', 'scene'); await __shots.вид('headerStyle', 'classic');" + код + " __shots.тело().querySelectorAll('.hud-tab-content.active .hud-body > :nth-child(n+7), .hud-tab-content.active .hud-twist').forEach(э => э.style.display = 'none'); await __shots.ждать(700);" }))),
  // То же, но во вкладке только первые плашки: виден угол вкладки с рисунком сцены.
  ...['biopunk', 'dieselpunk', 'solarpunk', 'voodoo', 'steampunk', 'egypt', 'western', 'noir', 'pirate', 'spaceopera', 'ice', 'ocean', 'spacehorror', 'vamp', 'kawaii', 'witch', 'academia', 'cyberpunk', 'medieval', 'fantasy', 'mafia', 'web1', 'cottage', 'japan', 'darkroom', 'teaparty', 'bujo'].map(id => ({ имя: 'short-' + id, вкладка: ['Элеонора', 'Eleanor'], сцена: 'compact', высота: 1950, тема: id, служебный: true,
    шаги: "window.__ширинаКопии = 548; __shots.тело().querySelectorAll('.hud-tab-content.active .hud-body > :nth-child(n+7), .hud-tab-content.active .hud-twist').forEach(э => э.style.display = 'none'); await __shots.ждать(400);" })),
  ...[['darkroom', 'sepia'], ['darkroom', 'cyan'], ['bujo', 'day']].map(([id, пал]) => ({ имя: `theme-${id}-${пал}`, вкладка: ['Элеонора', 'Eleanor'], сцена: 'open', высота: 1100, тема: id, служебный: true,
    шаги: `document.querySelector('.hud-theme-palette[data-theme-palette="${пал}"]').click(); await __shots.ждать(1500);` })),
  { имя: 'theme-cyberpunk', вкладка: ['Элеонора', 'Eleanor'], сцена: 'open', высота: 938, тема: 'cyberpunk' },
  // Средневековье (--era medieval): тема «Средневековье», шкатулка вместо телефона.
  { имя: 'medieval-casket', эпоха: 'medieval', вкладка: ['Шкатулка', 'Casket'], тема: 'medieval', элемент: '.hud-tab-content.active' },
  { имя: 'medieval-purse', эпоха: 'medieval', вкладка: ['Шкатулка', 'Casket'], тема: 'medieval', шаги: "т.querySelector('.hud-tab-content.active input.hud-cask-radio[id$=\"-purse\"]').checked = true; await __shots.ждать(900);", элемент: '.hud-tab-content.active' },
  { имя: 'medieval-docs', эпоха: 'medieval', вкладка: ['Шкатулка', 'Casket'], тема: 'medieval', шаги: "т.querySelector('.hud-tab-content.active input.hud-cask-radio[id$=\"-docs\"]').checked = true; await __shots.ждать(900);", элемент: '.hud-tab-content.active' },
  { имя: 'medieval-overheard', эпоха: 'medieval', вкладка: ['Подслушанное', 'Overheard'], тема: 'medieval', элемент: '.hud-tab-content.active' },
];

// --- CDP ----------------------------------------------------------------------
const ПОРТ = 9300 + Math.floor(Math.random() * 500);
const профиль = fs.mkdtempSync(path.join(os.tmpdir(), 'hud-shots-'));
const браузер = spawn(БРАУЗЕР, ['--headless=new', `--remote-debugging-port=${ПОРТ}`, `--user-data-dir=${профиль}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--window-size=1400,1000', 'about:blank'], { stdio: 'ignore' });
let сокет, номер = 0;
const ответы = new Map();
async function подключиться() {
  for (let i = 0; i < 60; i++) {
    try {
      const цели = await (await fetch(`http://127.0.0.1:${ПОРТ}/json/list`)).json();
      const стр = цели.find(ц => ц.type === 'page');
      if (стр) { сокет = new WebSocket(стр.webSocketDebuggerUrl); break; }
    } catch (_) { /* ещё не поднялся */ }
    await ждать(250);
  }
  if (!сокет) throw new Error('браузер не ответил');
  await new Promise((ок, нет) => { сокет.onopen = ок; сокет.onerror = нет; });
  сокет.onmessage = (e) => { const м = JSON.parse(e.data);
    if (м.id && ответы.has(м.id)) { const [ок, нет] = ответы.get(м.id); ответы.delete(м.id); м.error ? нет(new Error(м.error.message)) : ок(м.result); } };
}
const cdp = (method, params = {}) => new Promise((ок, нет) => { const id = ++номер; ответы.set(id, [ок, нет]); сокет.send(JSON.stringify({ id, method, params })); });
async function выполнить(код) {
  const р = await cdp('Runtime.evaluate', { expression: `(async () => { ${код} })()`, awaitPromise: true, returnByValue: true });
  if (р.exceptionDetails) throw new Error(р.exceptionDetails.exception?.description || р.exceptionDetails.text);
  return р.result.value;
}
async function дождаться(условие, мс = 30000) {
  const до = Date.now() + мс;
  while (Date.now() < до) { if (await выполнить(`return !!(${условие});`).catch(() => false)) return; await ждать(300); }
  throw new Error('не дождался: ' + условие);
}
// pngjs — из зависимостей самой Таверны (как в visual-regress.mjs).
const { PNG } = createRequire(import.meta.url)(path.resolve(КОРЕНЬ, '..', '..', '..', '..', 'node_modules', 'pngjs'));
// Пустой кадр (браузер ещё не дорисовал) — почти одного цвета: переснимаем.
const цветов = (буфер) => { const п = PNG.sync.read(буфер); const м = new Set(); for (let i = 0; i < п.data.length; i += 4 * 61) м.add(п.data[i] << 16 | п.data[i + 1] << 8 | п.data[i + 2]); return м.size; };
async function снять(файл, клип) {
  const { x, y, width, height } = клип;
  let данные = null;
  for (let попытка = 0; попытка < 4; попытка++) {
    const р = await cdp('Page.captureScreenshot', { format: 'png', clip: { x, y, width, height, scale: 1 }, captureBeyondViewport: true });
    данные = Buffer.from(р.data, 'base64');
    if (цветов(данные) >= 200) break;
    if (попытка === 3) console.log('    ⚠ кадр почти пустой:', path.basename(файл));
    await ждать(1500);
  }
  // Проверка пустоты — по PNG; сохраняем тот же кадр в WebP.
  if (ФОРМАТ === 'webp') {
    const р = await cdp('Page.captureScreenshot', { format: 'webp', quality: 90, clip: { x, y, width, height, scale: 1 }, captureBeyondViewport: true });
    данные = Buffer.from(р.data, 'base64');
  }
  fs.mkdirSync(path.dirname(файл), { recursive: true });
  fs.writeFileSync(файл, данные);
}

// --- В странице -------------------------------------------------------------
// Карточку из просмотра копируем в отдельную обёртку шириной 548 px (как в
// чате) — у просмотра своя прокрутка, она обрезала бы длинную карточку.
// Прокрутка ленты вкладок у копии теряется — переносим её руками.
const ВСТРАНИЦЕ = `
window.__shots = {
  ждать: (мс) => new Promise(r => setTimeout(r, мс)),
  тело: () => document.querySelector('.hud-custom-preview-body'),
  async открыть() {
    if (!document.querySelector('.hud-custom-sample')) document.getElementById('hud-open-custom').click();
    for (let i = 0; i < 40 && !document.querySelector('.hud-custom-sample'); i++) await this.ждать(250);
    await this.ждать(800);
    // Кнопка «Пример» — большой пример со всеми блоками вместо HUD открытого чата.
    const кнопка = document.querySelector('.hud-custom-sample');
    if (кнопка.getAttribute('aria-pressed') !== 'true') { кнопка.click(); await this.ждать(2500); }
  },
  async тема(id) {
    const кнопка = document.querySelector('.hud-theme-preset[data-theme-preset="' + (id === 'default' ? '' : id) + '"]');
    if (!кнопка) throw new Error('нет темы ' + id);
    кнопка.click(); await this.ждать(2500);
  },
  вкладки() { return [...this.тело().querySelectorAll('.hud-tab')].map(t => t.dataset.tabId + ' · ' + t.textContent.trim()); },
  async вкладка(имена) {
    const t = [...this.тело().querySelectorAll('.hud-tab')].find(t => имена.some(и => t.textContent.trim().replace(/^\\S+\\s/, '').trim().startsWith(и)));
    if (!t) throw new Error('нет вкладки ' + имена.join('/'));
    t.click(); await this.ждать(900);
  },
  async вид(ключ, значение) {
    const sel = document.querySelector('.hud-custom-settings select[data-key="' + ключ + '"]');
    if (!sel) throw new Error('нет настройки вида ' + ключ);
    const было = sel.value;
    sel.value = значение;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await this.ждать(2500);
    return было;
  },
  async сцена(вид) {
    const к = this.тело().querySelector('.hud-scene-fold');
    if (!к) return;
    const открыта = к.getAttribute('aria-expanded') === 'true';
    if ((вид === 'compact') === открыта) { к.click(); await this.ждать(900); }
  },
  async телефон() {
    const н = [...this.тело().querySelectorAll('.hud-phone-lock-notice')].find(x => /Софи|Sophie/.test(x.textContent)) || this.тело().querySelector('.hud-phone-lock-notice');
    if (н) { н.click(); await this.ждать(1500); }
  },
  async шаги(код) {
    const т = this.тело();
    await (new Function('т', '__shots', 'return (async () => { ' + код + ' })()'))(т, this);
  },
  копия(язык, поле, элемент) {
    document.getElementById('hud-shot')?.remove();
    const исходник = this.тело().querySelector('.hud-os-card');
    const обёртка = document.createElement('div');
    обёртка.id = 'hud-shot';
    обёртка.className = 'mes_text';
    обёртка.style.cssText = 'position:absolute;left:0;top:0;width:' + (window.__ширинаКопии || 548) + 'px;z-index:2147483647;padding:0;margin:0;background:var(--SmartThemeBlurTintColor,#16151a)';
    const к = исходник.cloneNode(true);
    // Высоту карточке ставит анимация смены вкладки — у копии её не будет.
    к.style.removeProperty('height');
    к.style.removeProperty('min-height');
    обёртка.appendChild(к);
    document.body.appendChild(обёртка);
    // content-visibility: auto (быстрые карточки в чате) рисует копию по
    // заглушке высотой 480 px — для снимка всё содержимое настоящее.
    [к, ...к.querySelectorAll('*')].forEach(э => { if (getComputedStyle(э).contentVisibility === 'auto') { э.style.setProperty('content-visibility', 'visible', 'important'); э.style.setProperty('contain-intrinsic-size', 'none', 'important'); } });
    // Прокручиваемые контейнеры раскрываем целиком; декор (ветки деревьев в
    // сцене и т. п.) не трогаем — его max-height держит рисунок в рамках.
    // Тело вкладки в чате ограничено по высоте (настройка, 300 px) и
    // прокручивается — на снимке вкладка целиком.
    к.querySelectorAll('.hud-body').forEach(э => { э.style.setProperty('max-height', 'none', 'important'); э.style.setProperty('overflow', 'visible', 'important'); });
    обёртка.style.setProperty('--hud-memory-max-height', 'none');
    [...к.querySelectorAll('*')].forEach(э => { const чужой = э.closest('[class*="hud-phone"], .hud-tabs-header, .hud-scene-widget'); if (чужой && к.contains(чужой)) return; const cs = getComputedStyle(э); const предел = cs.maxHeight !== 'none' && parseFloat(cs.maxHeight) < 5000; if ((предел && cs.overflowY !== 'visible') || /auto|scroll/.test(cs.overflowY)) { э.style.setProperty('max-height', 'none', 'important'); if (cs.overflowY !== 'visible') э.style.setProperty('overflow-y', 'visible', 'important'); } });
    // Лента вкладок: активная вкладка — в поле зрения (у копии прокрутка сброшена).
    const вкл = к.querySelector('.hud-tab.active'), лента = вкл && вкл.parentElement;
    if (лента && лента.scrollWidth > лента.clientWidth) лента.scrollLeft = Math.max(0, вкл.offsetLeft + вкл.offsetWidth - лента.clientWidth + 6);
    // Анимации — в конечное состояние, иначе снимок ловит середину появления.
    обёртка.querySelectorAll('*').forEach(э => { э.getAnimations?.().forEach(а => { try { а.finish(); } catch (_) {} }); });
    if (язык === 'en') {
      // Имя персоны игрока в примере — из Таверны; в английском примере — Sophie.
      const w = document.createTreeWalker(к, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const v = n.nodeValue.replace(/С​?офи/g, 'Sophie').replace(/^СО$/, 'SO'); if (v !== n.nodeValue) n.nodeValue = v; }
    }
    let цель = к;
    if (элемент) {
      цель = [...к.querySelectorAll(элемент)].find(э => э.getClientRects().length && э.getBoundingClientRect().width > 0);
      if (!цель) throw new Error('нет элемента ' + элемент);
    }
    if (поле) {
      цель = [...к.querySelectorAll('.hud-row, .hud-field, .hud-section, [class*="hud-cycle"], [class*="hud-preg"], [class*="hud-mem"], [class*="hud-memory-"]')].filter(э => э.getClientRects().length && э.getBoundingClientRect().width > 0).find(э => поле.some(п => (э.querySelector('.hud-key, .hud-key-label, [class*="label"]')?.textContent || '').trim().replace(/^\\S+\\s/, '').trim().toUpperCase().startsWith(п.toUpperCase())));
      if (!цель) throw new Error('нет поля ' + поле.join('/'));
      // «Подробнее» в поле — раскрыто, как на русских снимках.
      цель.querySelectorAll('details').forEach(d => { d.open = true; });
    }
    const r = цель.getBoundingClientRect();
    // Русский текст, оставшийся в кадре (для английских снимков — сигнал, что словарь неполон).
    const русское = []; const w = document.createTreeWalker(цель, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); if (/[а-яё]/i.test(t) && n.parentElement.getClientRects().length && n.parentElement.getBoundingClientRect().top < r.top + 1950) русское.push(t.slice(0, 80)); }
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height, русское: [...new Set(русское)].slice(0, 12) };
  },
};
return true;`;

// Музыка — со стенда: готовый плейлист без генераций (render-music-stand.mjs,
// для английского — с --lang en). Подписи стенда (h1/h2) не снимаются.
const МУЗЫКА = [
  { имя: 'music', найти: `[...document.querySelectorAll('h2')].find(h => h.textContent.startsWith('Полный плейлист, раскрыт')).nextElementSibling.querySelector('.hud-os-card.wide')` },
  { имя: 'music-phone', найти: `[...document.querySelectorAll('h1')].find(h => h.textContent.startsWith('Телефон персонажа')).nextElementSibling.querySelector('.phone')` },
  { имя: 'music-archive', найти: `[...document.querySelectorAll('h1')].find(h => h.textContent.startsWith('Архив')).nextElementSibling.querySelector('.arc.wide')` },
];
async function музыка() {
  await cdp('Page.navigate', { url: ST + 'scripts/extensions/third-party/HUD/tests/tools/' + (ЯЗЫК === 'en' ? 'music-stand-en.html' : 'music-stand.html') });
  await дождаться(`document.querySelector('.hud-music') && document.readyState === 'complete'`, 60000);
  // Обложки — с каталога iTunes: ждём, пока догрузятся.
  await выполнить(`await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); }))); return true;`);
  await ждать(1500);
  for (const с of МУЗЫКА) {
    if (ТОЛЬКО && !ТОЛЬКО.has(с.имя)) continue;
    const клип = await выполнить(`scrollTo(0, 0); const э = ${с.найти}; const r = э.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };`);
    const файл = path.join(ВЫХОД, с.имя + '.' + ФОРМАТ);
    await снять(файл, клип);
    console.log('✓', path.relative(КОРЕНЬ, файл), Math.round(клип.width) + '×' + Math.round(клип.height));
  }
}

async function main() {
  await подключиться();
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  // Временный профиль не должен ничего писать в Таверну: настройки HUD
  // теперь хранятся и на сервере (тема примера уехала бы на все устройства),
  // а открытый чат Таверна пересохраняет с бэкапом.
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const запись = \/\\/api\\/(settings\\/save|chats\\/(group\\/)?save|characters\\/(edit|merge-attributes)|files\\/upload|backups)\/;
    const f = window.fetch.bind(window);
    window.fetch = (вход, опц) => { const url = typeof вход === 'string' ? вход : (вход && вход.url) || ''; return запись.test(url) ? Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) : f(вход, опц); };
    navigator.sendBeacon = () => true;
  })();` });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 4200, deviceScaleFactor: 2, mobile: false });
  await cdp('Page.navigate', { url: ST });
  await дождаться(`document.getElementById('hud-open-custom')`, 60000);
  // Временный профиль: только язык и эпоха. Остальное — настройки по умолчанию;
  // savedAt из будущего — чтобы серверная копия настроек HUD не взяла верх.
  await выполнить(`localStorage.setItem('hud_settings', JSON.stringify({ language: '${ЯЗЫК}', sceneMigration: 1, era: '${ЭПОХА}', savedAt: 9e15 })); return true;`);
  await cdp('Page.reload');
  await ждать(1500);
  await дождаться(`document.getElementById('hud-open-custom')`, 60000);
  await ждать(2500);
  // Аватарка открытой карточки Таверны встала бы главному герою примера
  // (Лилиан) — без карточек HUD рисует инициалы. Аватарка персоны игрока
  // остаётся. Только в этой временной странице.
  await выполнить(`
    const исходный = SillyTavern.getContext;
    SillyTavern.getContext = () => ({ ...исходный(), characters: [], characterId: undefined });
    document.querySelectorAll('.mes:not([is_user="true"]) .avatar img').forEach(э => э.remove());
    const А = await import('/scripts/extensions/third-party/HUD/avatars.js?v=${ВЕРСИЯ}');
    А.invalidateAvatarCache();
    return true;`);
  await выполнить(ВСТРАНИЦЕ);
  await выполнить(`await __shots.открыть(); return true;`);
  if (арг.includes('--eval')) {
    // Отладка: код в странице после открытия примера (вкладка Элеонора, сцена раскрыта).
    await выполнить(`await __shots.вкладка(['Элеонора', 'Eleanor']); await __shots.сцена('open'); return true;`);
    console.log(JSON.stringify(await выполнить(знач('--eval', 'return null;')), null, 1));
    return;
  }
  if (арг.includes('--fields')) {
    // Подписи полей открытой вкладки: node docs-shots.mjs --fields Memory
    await выполнить(`await __shots.вкладка([${JSON.stringify(знач('--fields', ''))}]); return true;`);
    console.log((await выполнить(`return [...__shots.тело().querySelectorAll('.hud-tab-content.active *')].filter(э => э.children.length === 0 && /key|label|title|head/i.test(String(э.className)) && э.getClientRects().length).map(э => String(э.className).slice(0, 50) + ' · ' + э.textContent.trim().slice(0, 40)).slice(0, 60);`)).join('\n'));
    return;
  }
  if (арг.includes('--list')) { console.log((await выполнить(`return __shots.вкладки();`)).join('\n')); return; }
  for (const с of СНИМКИ) {
    if (ТОЛЬКО ? !ТОЛЬКО.has(с.имя) : с.служебный) continue;
    if ((с.эпоха || 'modern') !== ЭПОХА) continue;
    if (с.тема) await выполнить(`await __shots.тема(${JSON.stringify(с.тема)}); return true;`);
    const прежнийВид = с.вид ? await выполнить(`return await __shots.вид(${JSON.stringify(с.вид[0])}, ${JSON.stringify(с.вид[1])});`) : null;
    await выполнить(`await __shots.вкладка(${JSON.stringify(с.вкладка)}); return true;`);
    if (с.сцена) await выполнить(`await __shots.сцена(${JSON.stringify(с.сцена)}); return true;`);
    if (с.телефон) await выполнить(`await __shots.телефон(); return true;`);
    if (с.шаги) await выполнить(`await __shots.шаги(${JSON.stringify(с.шаги)}); return true;`);
    await ждать(500);
    const клип = await выполнить(`return __shots.копия(${JSON.stringify(ЯЗЫК)}, ${JSON.stringify(с.поле ? с.поле : null)}, ${JSON.stringify(с.элемент || null)});`);
    await ждать(700);
    клип.height = Math.min(клип.height, с.высота || 1950);
    const файл = path.join(ВЫХОД, с.имя + '.' + ФОРМАТ);
    await снять(файл, клип);
    console.log('✓', path.relative(КОРЕНЬ, файл), Math.round(клип.width) + '×' + Math.round(клип.height));
    if (ЯЗЫК === 'en' && клип.русское && клип.русское.length) console.log('    русское в кадре:', клип.русское.join(' | '));
    if (с.тема) await выполнить(`await __shots.тема('default').catch(() => {}); return true;`).catch(() => {});
    if (с.вид) await выполнить(`await __shots.вид(${JSON.stringify(с.вид[0])}, ${JSON.stringify(прежнийВид)}); return true;`);
  }
  if (ЭПОХА === 'modern' && (!ТОЛЬКО || МУЗЫКА.some(м => ТОЛЬКО.has(м.имя)))) await музыка();
}
try { await main(); }
catch (e) { console.error('✗', e.message); process.exitCode = 1; }
finally {
  try { сокет?.close(); } catch (_) { /* закрыт */ }
  браузер.kill();
  await ждать(800);
  try { fs.rmSync(профиль, { recursive: true, force: true }); } catch (_) { /* Edge ещё держит файлы */ }
}
void ВЕРСИЯ;
