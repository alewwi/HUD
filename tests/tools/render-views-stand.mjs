// Стенд новых видов: словесная дуэль (канат, весы, график по ходам). Ходы собраны руками — без SillyTavern и
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

delete settings.sceneClockView;

const css = ['tokens.css', 'views.css', 'duel.css'].map(f => fs.readFileSync(path.join(КОРЕНЬ, 'css', f), 'utf8')).join('\n');
fs.writeFileSync(path.join(ТУТ, 'views-stand.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Виды — стенд</title><style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; --hud-bg: #1e1826; }
.wrap { max-width: 560px; margin: 0 auto; display: grid; gap: 10px; } .wrap.is-narrow { max-width: 215px; margin: 0; } h2 { font-size: 12px; color: #a8a5ad; margin: 12px 0 0; }
${css}</style><div class="wrap">${дуэль.join('')}</div><h2>узко, как карточка на телефоне (215px)</h2><div class="wrap is-narrow">${дуэль.join('')}</div>`);
console.log('→ tests/tools/views-stand.html');
