// Стенд вкладки «Быт»: плотные сутки (много событий у «сейчас») лентой и
// циферблатом, сводка, гардероб тремя видами. Пишет tests/tools/life-stand.html.
// Без SillyTavern и без генераций: ходы собраны руками.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const В = '?v=23.46.0';
const м = (f) => import('file:///' + path.join(КОРЕНЬ, f).replace(/\\/g, '/') + В);
globalThis.window = globalThis;
const { settings } = await м('settings.js');
const LF = await м('render/life.js');

const hud = (о) => '[HUD]\n```json\n' + JSON.stringify(о) + '\n```\n[/HUD]';
const ход = (T, extra = {}) => ({ is_user: false, mes: hud({ sc: { Dt: '15.06.2028', T, Wt: '+24°C' }, cs: [{ N: 'Софи Ховард', Bs: 'eng: 55; sat: 60; slp: 6 ч, легла в 01:10', C: 'графитовый льняной сарафан, шёлковые трусики', L: 'Бостон, Кингсли-Тауэр, спальня' }], ...extra }) });
const чат = [
  ход('08:00', { me: { hk: 'eat: завтрак, овсянка; wash: душ' } }),
  ход('13:10', { me: { hk: 'eat: обед, салат' }, phn: { wl: { bl: '54200000', cu: '$', trx: [{ ti: 'Обед в кафе', am: '-120', tm: '13:00' }] } } }),
  ход('20:30', { me: { hk: 'buy: вино 90; eat: ужин, стейк' } }),
  ход('21:05', { me: { hk: 'wash: ванна; laundry: постирала сарафан' } }),
  ход('21:40', { me: { hk: 'buy: свечи 40; fix: починил кран; clean: убрала на кухне' } }),
  ход('22:10', { me: { hk: 'eat: десерт, клубника' }, phn: { wl: { bl: '54199750', cu: '$', trx: [{ ti: 'Доставка цветов', am: '-60', tm: '22:00' }] } } }),
];
const ж = LF.журналБыта(чат, чат.length);
const блоки = [];
for (const [к, в] of [['lifeDayView', 'strip'], ['lifeDayView', 'clock'], ['lifeGaugeView', 'bars'], ['wardrobeView', 'rail'], ['wardrobeView', 'list']]) {
  settings[к] = в;
  блоки.push(`<h2>${к}: ${в}</h2>` + LF.buildLifeHTML(ж, к + в, true));
  delete settings[к];
}
const css = ['views.css', 'life.css'].map(f => fs.readFileSync(path.join(КОРЕНЬ, 'css', f), 'utf8')).join('\n');
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Быт — стенд</title><style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; --hud-bg: #1e1826; }
.wrap { max-width: 640px; margin: 0 auto; display: grid; gap: 18px; } h2 { font-size: 12px; color: #a8a5ad; margin: 12px 0 4px; }
.hud-tab-content { display: block; } .narrow { max-width: 360px; }
${css}</style><div class="wrap">${блоки.join('')}<h2>узко (телефон)</h2><div class="narrow">${LF.buildLifeHTML(ж, 'n', true)}</div></div>`;
fs.writeFileSync(path.join(ТУТ, 'life-stand.html'), html);
console.log('событий за сутки:', ж.события.filter(с => с.t > ж.сейчас - 864e5).length, '→ tests/tools/life-stand.html');
