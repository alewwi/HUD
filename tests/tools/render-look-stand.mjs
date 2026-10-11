// Стенд облика силуэта (render/look.js): node tests/tools/render-look-stand.mjs
// → tests/tools/look-stand.html — карты тела с разными тонами, волосами,
// сложением и отметинами; первым — нейтральный силуэт для сравнения.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, set textContent(x) { t = String(x); }, get innerHTML() { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }, querySelector: () => null, querySelectorAll: () => [] }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), getElementById: () => null };
globalThis.SillyTavern = { getContext: () => ({ chat: [] }) };
const модуль = (имя) => import('file:///' + path.join(КОРЕНЬ, имя).replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);
const { settings } = await модуль('settings.js');
const Im = await модуль('render/intimacy.js');

const ЗОНЫ = 'Губы: 7 rising — горят; Шея: 8 peak; Грудь: 5; Бёдра: 6 lingering 2h; Поясница: 4';
const ЛЮДИ = [
  ['Нейтральный (как раньше)', null],
  ['Ж — только джинсы (как на снимке)', 'auto', 'голубые джинсы'],
  ['Ж, светлая кожа, каштановые волосы до плеч — полностью обнажена', 'auto', 'полностью обнажена'],
  ['М, смуглая кожа, короткие чёрные волосы, широкоплечий — без рубашки, брюки спущены до колен', 'auto', 'без рубашки, брюки спущены до колен'],
  ['Ж, оливковая кожа, длинные чёрные волосы — платье задрано, трусики сдвинуты', 'auto', 'платье задрано до талии, трусики сдвинуты в сторону'],
  ['Ж — одета (очертаний нет)', 'auto', 'свитер, джинсы, кеды'],
  ['Бледная кожа, длинные рыжие волосы, хрупкая, шрам на плече', 'auto'],
  ['Светлая кожа, каре, светлые волосы, родинка над губой', 'auto'],
  ['Оливковая кожа, чёрные волосы до плеч', 'auto'],
  ['Смуглая кожа, короткие каштановые волосы, крепкий, татуировка на спине', 'auto'],
  ['Тёмная кожа, длинные чёрные волосы, стройная', 'auto'],
  ['Очень тёмная кожа, лысый, мускулистый, шрам на бедре', 'auto'],
];
// Каждый облик — во всех трёх подачах тела (настройка silhouetteStyle).
const ПОДАЧИ = [['line', 'Контур'], ['thermal', 'Тепловизор'], ['soft', 'Мягкий объём']];
const блоки = ПОДАЧИ.map(([подача, имя]) => {
  settings.silhouetteStyle = подача;
  return `<h2>${имя}</h2><div class="wrap">` + ЛЮДИ.map(([вн, режим, одежда]) => {
    settings.silhouetteLook = режим || 'neutral';
    return `<figure><figcaption>${вн}</figcaption>${Im.buildHeatMap(ЗОНЫ, { 'Имя': 'X', 'Внешность': вн, 'Одежда': одежда || '' })}</figure>`;
  }).join('') + '</div>';
});
settings.silhouetteLook = 'neutral';
settings.silhouetteStyle = 'line';
const html = `<!doctype html><meta charset="utf-8"><title>Облик силуэта</title><link rel="stylesheet" href="../../css/all.css?v=${ВЕРСИЯ}">
<style>body{margin:0;padding:16px;background:#17131c;color:#e6e6ee;font:13px system-ui;--nsfw:#d96a8a}.wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}figure{margin:0;padding:10px;background:#221c2a;border-radius:12px}figcaption{margin-bottom:6px;font-size:12px;opacity:.8}.hud-heat-list{display:none}.hud-heat-svg{width:100%;height:auto}h2{font-size:15px;margin:18px 0 8px}</style>
${блоки.join('')}`;
fs.writeFileSync(path.join(КОРЕНЬ, 'tests', 'tools', 'look-stand.html'), html);
console.log('→ tests/tools/look-stand.html');
