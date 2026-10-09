// Стенд новых видов: словесная дуэль (канат, весы, график по ходам) и часы
// сцены (плашки, циферблат, линия). Ходы собраны руками — без SillyTavern и
// без генераций. Пишет tests/tools/views-stand.html.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const м = (f) => import('file:///' + path.join(КОРЕНЬ, f).replace(/\\/g, '/') + '?v=23.46.0');
globalThis.window = globalThis;
const { settings } = await м('settings.js');
const DU = await м('render/duel.js');
const SC = await м('render/scene-clock.js');
const CHR = await м('render/character.js');

// Дуэль: четыре хода спора, Софи отыгрывает.
const тристан = { 'Имя': 'Тристан', 'Глубина конфликта': 'wy: свадьба с Викторией; dys: 2; sg: open' };
Object.defineProperty(тристан, '__hudИстория', { value: () => [
  { назад: 1, данные: { 'Словесная дуэль': 'ini: Тристан, 55; gv: Софи признала, что знала о помолвке; tn: укол' } },
  { назад: 2, данные: { 'Словесная дуэль': 'ini: Тристан, 75; tn: спор' } },
  { назад: 3, данные: { 'Словесная дуэль': 'ini: Тристан, 60; tn: холод' } },
] });
Object.defineProperty(тристан, '__hudХод', { value: () => ({ memory: { timeline: ['12.06 21:00 - объявили помолвку с Викторией на свадьбе Ченнингов'] } }) });
const дуэль = ['tug', 'scales', 'chart'].map(в => { settings.duelView = в; return `<h2>duelView: ${в}</h2>` + DU.buildDuel('ini: Софи, 70; gv: Тристан уступил в деньгах; tn: ссора', тристан); });
delete settings.duelView;

// Часы сцены: тот же случай, что в тестах.
const день = Date.UTC(2028, 5, 15), М = (ч, мин) => день + (ч * 60 + мин) * 60000;
const ходНачала = { characters: [
  { 'Имя': 'Тристан', 'Расписание': '18:30 - ужин с Софи в спальне; 19:00 - ужин с родителями; 20:30 - селектор с Лондоном' },
  { 'Имя': 'Лена', 'Расписание': '19:45 - встреча с Тристаном в баре' } ] };
const т = { 'Имя': 'Тристан', 'Фаза близости': '2 — act', 'Длительность': '95', 'Расписание': '20:05 - продолжение' };
Object.defineProperty(т, '__hudМомент', { value: () => М(20, 10) });
Object.defineProperty(т, '__hudХод', { value: () => ({ characters: [т] }) });
Object.defineProperty(т, '__hudИстория', { value: () => [
  { назад: 1, момент: М(19, 20), данные: { 'Имя': 'Тристан', 'Фаза близости': '2 — act' }, ход: { characters: [] } },
  { назад: 2, момент: М(18, 30), данные: { 'Имя': 'Тристан', 'Фаза близости': '2 — foreplay' }, ход: ходНачала },
  { назад: 3, момент: М(17, 0), данные: { 'Имя': 'Тристан', 'Фаза близости': '1 — empty' }, ход: { characters: [] } } ] });
const часы = ['chips', 'dial', 'line'].map(в => { settings.sceneClockView = в; return `<h2>sceneClockView: ${в}</h2>` + SC.часыСцены(т, CHR.состояниеСцены); });
delete settings.sceneClockView;

const css = ['views.css', 'duel.css', 'scene-clock.css'].map(f => fs.readFileSync(path.join(КОРЕНЬ, 'css', f), 'utf8')).join('\n');
fs.writeFileSync(path.join(ТУТ, 'views-stand.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Виды — стенд</title><style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; --hud-bg: #1e1826; }
.wrap { max-width: 560px; margin: 0 auto; display: grid; gap: 10px; } .wrap.is-narrow { max-width: 215px; margin: 0; } h2 { font-size: 12px; color: #a8a5ad; margin: 12px 0 0; }
${css}</style><div class="wrap">${дуэль.join('')}${часы.join('')}</div><h2>узко, как карточка на телефоне (215px)</h2><div class="wrap is-narrow">${дуэль.join('')}${часы.join('')}</div>`);
console.log('→ tests/tools/views-stand.html');
