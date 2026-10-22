// Стенд дневника и снов: лист каждой темы настроения (render/diary.js) и
// каждый вид блока «Сны» (render/dreams.js) — широко и узко, как на телефоне.
// Без SillyTavern и без генераций. Пишет tests/tools/diary-stand.html;
// открывать через сервер Таверны (…/third-party/HUD/tests/tools/diary-stand.html),
// светлая тема — ?t=kawaii, всё движение сразу — ?fx=1 (иначе — нажатием на лист).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const В = '?v=' + ВЕРСИЯ;
const м = (f) => import('file:///' + path.join(КОРЕНЬ, f).replace(/\\/g, '/') + В);
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.document = { createElement: () => ({ style: {}, classList: { add() {} }, set innerHTML(v) { this.value = v; } }), querySelector: () => null, querySelectorAll: () => [], documentElement: { style: {}, classList: { contains: () => false } } };
globalThis.SillyTavern = { getContext: () => ({ chat: [], name1: 'Софи', name2: 'Тристан', characters: [], chatMetadata: {} }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};

const { settings } = await м('settings.js');
const D = await м('render/diary.js');
const V = await м('render/views.js');
const Dr = await м('render/dreams.js');

// Темы листа и пример настроения, которое в неё попадает.
const ТЕМЫ = Object.entries(D.ТЕМЫ_ДНЕВНИКА || {});
const текст = 'Сегодня всё вышло **не так**, как я думала. *Он смотрел слишком долго.* ~~Я хотела уйти~~ Я осталась.\nИ теперь не знаю, что с этим делать.';
const листы = ТЕМЫ.map(([ключ, о]) => {
  const запись = { author: 'Лилиан Грей', time: '17.10.2024 21:40', text: текст, mood: о.пример };
  const html = D.buildDiaryHTML([запись], 'd-' + ключ, true);
  return `<div class="card"><h2>${ключ} <small>${о.имя} · «${о.пример}»</small></h2>${html}</div>`;
}).join('\n');

// Сны: каждый вид блока, на примере и на длинных строках.
const сныПример = [
  { text: 'Марку снится, что он ищет сестру в библиотеке, а стеллажи всё выше и выше, и за каждым слышен её смех.', meaning: 'Страх потерять контроль над её жизнью — и понимание, что она уже взрослая.' },
  { text: 'Анне снится, что София уже родилась и играет на рояле ту самую колыбельную.', meaning: 'Желание передать дочери музыку и страх, что не успеет вернуться к ученикам.' },
  { text: 'Кошмар: Софи падает в ледяную воду с моста, кричит, но звука нет, а Тристан стоит на берегу и не двигается.', meaning: 'Ужас беспомощности и обида: тот, кто должен спасти, смотрит со стороны.' },
];
const ЛЮДИ = ['Марк Грей', 'Анна Грей', 'Софи', 'Тристан Кингсли'];
const сныБлок = V.ВИДЫ_БЛОКОВ.find(б => б.ключ === 'dreamsView');
const сны = сныБлок ? Object.entries(сныБлок.виды).map(([вид, имя]) => {
  settings.dreamsView = вид;
  return `<h2 id="dreams-${вид}">Сны: ${имя} <small>dreamsView=${вид}</small></h2><div class="row"><div class="wide">${Dr.buildDreamHTML(сныПример, 'dw' + вид, true, ЛЮДИ)}</div><div class="narrow">${Dr.buildDreamHTML(сныПример.slice(0, 2), 'dn' + вид, true, ЛЮДИ)}</div></div>`;
}).join('\n') : '';
delete settings.dreamsView;

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Дневник и сны — стенд</title>
<link rel="stylesheet" href="../../css/all.css${В}">
<script>{ const t = new URLSearchParams(location.search).get('t'); if (t) { document.documentElement.classList.add('hud-theme-' + t); for (const f of ['light', t]) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '../../css/themes/' + f + '.css${В}'; document.head.appendChild(l); } } }</script>
<script>document.addEventListener('click', (e) => { const с = e.target.closest('.hud-dream-entry, .hud-dv'); if (с) { с.classList.toggle('is-awake'); с.classList.toggle('fx-active'); } const в = e.target.closest('.hud-v, .hud-diary-entry, .hud-dv-catch, .hud-dv-cloud, .hud-dv-entry'); if (в) в.classList.toggle('fx-active'); });
// ?fx=1 — всё движение сразу, как после нажатия на каждый лист.
if (new URLSearchParams(location.search).has('fx')) addEventListener('DOMContentLoaded', () => document.querySelectorAll('.hud-diary-entry, .hud-dv-catch, .hud-dv-cloud, .hud-dv-entry, .hud-dv-sky').forEach(х => х.classList.add('fx-active')));</script>
<style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; --hud-bg: #1e1826; }
h2 { font-size: 12px; color: #a8a5ad; margin: 18px 0 6px; } h2 small { opacity: .6; font-weight: 400; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 10px 18px; }
.row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
.wide { width: 540px; } .narrow { width: 230px; }
.hud-tab-content { display: block !important; opacity: 1 !important; animation: none !important; }
.hud-diary-container, .hud-dream-container { max-height: none !important; overflow: visible !important; }
</style><body>
<h1 style="font-size:15px">Листы дневника по темам настроения</h1>
<div class="grid">${листы}</div>
<h1 style="font-size:15px;margin-top:30px">Сны</h1>
${сны}
</body>`;
fs.writeFileSync(path.join(ТУТ, 'diary-stand.html'), html);
console.log('тем:', ТЕМЫ.length, 'видов снов:', сныБлок ? Object.keys(сныБлок.виды).length : 0, '→ tests/tools/diary-stand.html');
