// Стенд календаря телефона (render/calendar.js): node tests/tools/render-calendar-stand.mjs
// → tests/tools/calendar-stand.html. Свой календарь хозяина, дни рождения,
// праздники и расписания других персонажей; нажатия — тем же обработчиком,
// что в Таверне. Открывать через сервер Таверны
// (…/third-party/HUD/tests/tools/calendar-stand.html), светлая тема — ?t=kawaii.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const В = '?v=' + ВЕРСИЯ;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { createElement: () => ({ style: {}, classList: { add() {} } }), querySelector: () => null, querySelectorAll: () => [], documentElement: { style: {}, classList: { contains: () => false } } };
globalThis.SillyTavern = { getContext: () => ({ chat: [], name1: 'Софи', name2: 'THE REGENTS  Tristan Kingsley', characters: [] }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const C = await import('file:///' + path.join(КОРЕНЬ, 'render', 'calendar.js').replace(/\\/g, '/') + В);

const события = [
  { date: '07.11', title: 'День рождения Лейлы', kind: 'birthday' },
  { date: '28.11', title: 'День благодарения', kind: 'holiday' },
  { date: '15.11', title: 'Совет директоров Kingsley Holdings', kind: 'event', time: '10:00' },
  { date: '03.12', title: 'Благотворительный бал Регентов', kind: 'event', time: '20:00' },
  { date: '24.12', title: 'Сочельник', kind: 'holiday' },
];
const персонажи = [
  { 'Имя': 'THE REGENTS  Tristan Kingsley', 'Расписание': '08:30 - отвезти Софи в кампус; 14:00 - встреча с юристом; вечером - ужин в «Ла Мер» с Софи; завтра 07:00 - тренировка; в пятницу 19:30–22:00 - закрытый покер у Бомонтов' },
  { 'Имя': 'Brandon Kane', 'Расписание': '12:00 - перехватить груз в порту; послезавтра утром - забрать Лейлу из клиники; 10.11 - матч по лакроссу' },
  { 'Имя': 'Лейла Санчес-Дэвис', 'Расписание': '11:00 - пары по искусству; через 3 дня - примерка платья к балу; на выходных - девичник' },
  { 'Имя': 'Атлас Бомонт', 'Расписание': 'empty' },
];
const полный = C.buildCalendarApp(события, персонажи, '05.11.2024', 'THE REGENTS  Tristan Kingsley');
const пустой = C.buildCalendarApp([], [], '05.11.2024', 'Софи');
const один = C.buildCalendarApp([{ date: '18.11', title: 'Зачёт по истории', kind: 'event' }], [{ 'Имя': 'Софи', 'Расписание': '09:00 - лекция; 16:00 - кофе с Мирой' }], '05.11.2024', 'Софи');

const рамка = (подпись, тело, класс = '') => `<figure class="${класс}"><figcaption>${подпись}</figcaption><div class="phone"><div class="hud-phone-app-view active">${тело}</div></div></figure>`;
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Календарь — стенд</title>
<link rel="stylesheet" href="../../css/all.css${В}">
<script>{ const t = new URLSearchParams(location.search).get('t'); if (t) { document.documentElement.classList.add('hud-theme-' + t); for (const f of ['light', t]) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '../../css/themes/' + f + '.css${В}'; document.head.appendChild(l); } } }</script>
<script type="module">import { обработатьКликКалендаря } from '../../render/calendar.js${В}'; document.addEventListener('click', (e) => обработатьКликКалендаря(e));</script>
<style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; }
.wrap { display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start; }
figure { margin: 0; } figcaption { font-size: 12px; color: #a8a5ad; margin-bottom: 6px; }
.phone { color: var(--hud-text, #e6e6ee); width: 300px; max-width: calc(100vw - 32px); border-radius: 28px; padding: 14px 6px; background: #1d1724; box-shadow: 0 0 0 1px #2e2638 inset, 0 10px 30px rgba(0,0,0,.4); }
.narrow .phone { width: 238px; }
.phone .hud-phone-app-view { position: static !important; inset: auto !important; display: block !important; transform: none !important; opacity: 1 !important; height: auto !important; overflow: visible !important; }
</style>
<div class="wrap">
${рамка('Хозяин — Тристан; Брэндон и Лейла — свои календари; 05.11.2024', полный)}
${рамка('Узко (238px)', полный, 'narrow')}
${рамка('Только свой календарь', один)}
${рамка('Пусто', пустой)}
</div>`;
fs.writeFileSync(path.join(КОРЕНЬ, 'tests', 'tools', 'calendar-stand.html'), html);
console.log('→ tests/tools/calendar-stand.html');
