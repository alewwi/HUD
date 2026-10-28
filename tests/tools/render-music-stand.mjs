// Стенд «Музыки сцены»: полоса над вкладками во всех состояниях (пусто,
// подбор, ошибка, саундтрек без сцены, полный плейлист) и трёх видах
// (кассета, пластинка, свиток) — широко и узко, как на телефоне; экран
// «Музыки» в телефоне персонажа и вкладка «Саундтрек» архива. Без SillyTavern
// и без генераций: подборки ручные, обложки — настоящие из каталога iTunes.
// Пишет tests/tools/music-stand.html; открывать через сервер Таверны
// (…/third-party/HUD/tests/tools/music-stand.html), светлая тема — ?t=kawaii.
// --lang en — английский стенд (music-stand-en.html): интерфейс по-английски,
// данные подборок — как их пишет модель в английском режиме.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const В = '?v=' + ВЕРСИЯ;
const м = (f) => import('file:///' + path.join(КОРЕНЬ, f).replace(/\\/g, '/') + В);
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ style: {}, classList: { add() {} }, set innerHTML(v) { this.value = v; } }), querySelector: () => null, querySelectorAll: () => [], documentElement: { style: {}, classList: { contains: () => false, toggle() {} } } };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.SillyTavern = { getContext: () => ({ chat: [], name1: 'Софи', name2: 'Тристан', characters: [], chatMetadata: {} }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};

const EN = process.argv.includes('--lang') && process.argv[process.argv.indexOf('--lang') + 1] === 'en';
const { settings } = await м('settings.js');
if (EN) settings.language = 'en';
const M = await м('render/music.js');
const A = await м('render/archive.js');
const { G_ICONS } = await м('render/icons.js');
settings.enableMusic = true;

const пв = (путь) => 'https://audio-ssl.itunes.apple.com/itunes-assets/' + путь;
const обл = (id) => 'https://is1-ssl.mzstatic.com/image/thumb/' + id + '/200x200bb.jpg';
const саундтрек = [
  { a: 'Hans Zimmer', t: 'Time', pv: пв('AudioPreview221/v4/e0/1d/a4/e01da4a2-a75f-7ebf-9971-3d49e17efc57/mzaf_10500078769097048384.plus.aac.p.m4a'), why: 'тихое напряжение', ok: true, art: обл('Music221/v4/2b/62/eb/2b62ebd7-aa99-988a-0fee-714162f6fbeb/093624965008.jpg'), url: 'https://music.apple.com/us/album/time/380349905?i=380350246' },
  { a: 'Max Richter', t: 'On the Nature of Daylight', pv: пв('AudioPreview211/v4/85/ec/31/85ec3121-880e-8d05-70ee-a3f5cad67d29/mzaf_13875593167782602175.plus.aac.p.m4a'), why: 'нежность и усталость', ok: true, art: обл('Music115/v4/58/ec/d7/58ecd75d-8df8-c05f-5e1a-b144292c6493/17UM1IM64259.rgb.jpg') },
  { a: 'Lunar Echo Collective', t: 'Rain on Velvet Glass', why: 'выдуманный', ok: false },
  { a: 'Ólafur Arnalds', t: 'Saman', pv: пв('AudioPreview221/v4/5b/4a/8e/5b4a8ef5-6d31-eab1-833d-c6d9e842f290/mzaf_11461226826114240306.plus.aac.p.m4a'), why: 'холодный воздух', ok: true, art: обл('Music126/v4/9b/20/71/9b20711d-7ffe-2b59-4bae-6d6f614a1451/18UMGIM24750.rgb.jpg') },
  { a: 'Jóhann Jóhannsson', t: 'The Sun’s Gone Dim and the Sky’s Turned Black', pv: пв('AudioPreview221/v4/29/cf/bf/29cfbfbb-63f5-d0b3-1090-d5f08189ca98/mzaf_17075014693963707999.plus.aac.p.m4a'), ok: true },
];
const сцена = { src: 'радио в гольф-каре', tracks: [{ a: 'Bobby "Boris" Pickett', t: 'Monster Mash', pv: пв('AudioPreview221/v4/ac/1e/45/ac1e4508-6a0c-ded2-c3e0-715df9e27e58/mzaf_1451444538093662860.plus.aac.p.m4a'), ok: true, art: обл('Music211/v4/96/4e/2e/964e2e34-975a-f9da-ea23-326fdce09941/07UMGIM07880.rgb.jpg') }] };
const телефон = { owner: 'Тристан', tracks: [{ a: 'Arctic Monkeys', t: '505', pv: пв('AudioPreview221/v4/d1/0d/ab/d10dabc8-cceb-e718-401f-01516b009460/mzaf_13845311225859403599.plus.aac.p.m4a'), ok: true, art: обл('Music124/v4/82/90/14/829014ad-a301-62ab-bee6-f4cca4457411/mzi.hozudery.jpg') }, { a: 'Lana Del Rey', t: 'Video Games', pv: пв('AudioPreview211/v4/67/07/50/670750ec-42f9-fcf2-feef-9c4faa873ce8/mzaf_16864780503903222714.plus.aac.p.m4a'), ok: true, art: обл('Music211/v4/59/10/66/591066ea-3c85-3dfe-ef82-ffdbbcdfc8b9/12UMGIM00033.rgb.jpg') }, { a: 'The Neighbourhood', t: 'Sweater Weather', pv: пв('AudioPreview221/v4/8c/37/20/8c372047-2727-8054-9411-0e4867643dd8/mzaf_10169659262182214119.plus.aac.p.m4a'), ok: true }, { a: 'Joy Division', t: 'Disorder', pv: пв('AudioPreview211/v4/4d/cc/89/4dcc8922-012f-c11f-b061-caef7bafe7e2/mzaf_11167643022210339253.plus.aac.p.m4a'), ok: true }] };
const ход = (музыка) => [{ mes: 'привет', is_user: true }, { mes: 'ход', extra: музыка ? { hud_music: { swipe: 0, ...музыка } } : {} }];
const полная = { label: 'морозная ночь самайна', why: 'сменилось место', soundtrack: саундтрек, scene: сцена, phone: телефон };

const СОСТОЯНИЯ = [
  ['Пусто — полоса только у последнего хода', ход(null), {}],
  ['Пусто, раскрыта — подобрать каждую часть отдельно', ход(null), { открыта: true }],
  ['Подбор всего сразу', ход(null), { занято: ['soundtrack', 'scene'] }],
  ['Ошибка', ход(null), { ошибка: 'модель молчит дольше 120 с' }],
  ['Только саундтрек, «в сцене» пусто', ход({ label: 'бар «Синий час»', why: 'по кнопке', soundtrack: саундтрек.slice(0, 3), scene: null }), { открыта: true }],
  ['Саундтрек есть, подбирается «в сцене»', ход({ label: 'бар «Синий час»', why: 'по кнопке', soundtrack: саундтрек.slice(0, 3), scene: null }), { открыта: true, занято: ['scene'] }],
  ['Полный плейлист, свёрнут', ход(полная), {}],
  ['Полный плейлист, раскрыт', ход(полная), { открыта: true }],
  ['Та же сцена — копия с прошлого хода', ход({ ...полная, from: 4 }), {}],
  ['Радио в сцене, мемный саундтрек, «нравится» и «не предлагать»', ход({ ...полная, meme: true, scene: { ...сцена, radio: 'russian pop', country: 'RU' } }), { открыта: true }],
];
// «Нравится» и «не предлагать» — для строки с радио и вкусом.
settings.musicLiked = [саундтрек[1]];
settings.musicBanned = [саундтрек[2]];
const полоса = (chat, о) => M.полосаМузыки(1, { chat, ...о });
const ряды = [];
settings.musicPlayer = true;
const живой = ход(полная);
ряды.push(`<h1>Живой плеер <small>▶ играет 30-секундный отрывок; следующий — сам</small></h1><div id="chat"><div class="mes" mesid="1"><div class="row"><div class="hud-os-card wide">${M.полосаМузыки(1, { chat: живой, открыта: true })}</div><div class="hud-os-card phone">${M.приложениеМузыки(1, 'Тристан', { chat: живой })}</div></div></div></div>`);
for (const [вид, имя] of [['cassette', 'Кассета'], ['vinyl', 'Пластинка'], ['scroll', 'Свиток (средневековье)']]) {
  settings.musicStyle = вид;
  ряды.push(`<h1>${имя} <small>musicStyle=${вид}</small></h1>`);
  for (const [подпись, chat, о] of (вид === 'cassette' ? СОСТОЯНИЯ : СОСТОЯНИЯ.filter((_, k) => [0, 6, 7].includes(k)))) {
    ряды.push(`<h2>${подпись}</h2><div class="row"><div class="hud-os-card wide">${полоса(chat, о)}</div><div class="hud-os-card narrow">${полоса(chat, о)}</div></div>`);
  }
}
settings.musicStyle = 'auto';

// Телефон персонажа: полный, пустой, подбор.
const экран = (chat, о = {}, класс = '') => `<div class="phone${класс}"><div class="hud-phone-app-view"><div class="hud-phone-app-title"><span class="hud-phone-back" aria-hidden="true">⟨</span>${G_ICONS.music} Музыка<span class="hud-phone-app-owner">Тристан</span></div>${M.приложениеМузыки(1, 'Тристан', { chat, ...о })}</div></div>`;
ряды.push(`<h1>Телефон персонажа → «Музыка»</h1><div class="row">${экран(ход(полная))}${экран(ход(null))}${экран(ход(null), { занято: ['phone'] })}</div>`);
// Плейлисты владельца с названиями и его «Нравится» (метаданные чата).
const библиотека = { v: 1, owners: { 'Тристан': { id: 't1', liked: [телефон.tracks[0]], playlists: [
  { id: 'p1', name: 'Ночная трасса', theme: 'для дороги ночью', tracks: [...телефон.tracks, ...саундтрек.filter(x => x.ok)], mes: 1 },
  { id: 'p2', name: 'не трогать', tracks: саундтрек.slice(0, 2), mes: 2 },
] } } };
const сЛентой = [...ход(полная), { mes: 'новое', is_user: true }, { mes: 'ещё' }];
ряды.push(`<h2>Плейлисты, открытый плейлист («Ещё» с новыми сообщениями), «Нравится», сборка плейлиста</h2><div class="row">${экран(сЛентой, { библиотека, вид: { вид: 'lists' } })}${экран(сЛентой, { библиотека, вид: { вид: 'list', id: 'p1' } })}${экран(сЛентой, { библиотека, вид: { вид: 'list', id: 'p2', удалить: 'p2' } })}${экран(сЛентой, { библиотека, вид: { вид: 'liked' } })}${экран(сЛентой, { библиотека, вид: { вид: 'lists' }, плейлист: { что: 'new' } })}${экран(сЛентой, { вид: { вид: 'lists' } })}</div>`);
// Узкий телефон — экран приложения ~220 px, как в карточке на телефоне.
ряды.push(`<h2>Узкий телефон (экран приложения ~220 px)</h2><div class="row">${экран(сЛентой, { библиотека, вид: { вид: 'lists' } }, ' is-narrow')}${экран(сЛентой, { библиотека, вид: { вид: 'list', id: 'p1' } }, ' is-narrow')}${экран(сЛентой, { библиотека, вид: { вид: 'liked' } }, ' is-narrow')}${экран(ход(полная), {}, ' is-narrow')}</div>`);

// Архив → Саундтрек.
const отчёт = { soundtrack: [
  { from: 96, to: 103, date: '31.10.2024', place: 'Особняк Регентов, южный парк', ...полная },
  { from: 104, to: 104, date: '31.10.2024', place: 'Гольф-кар', label: 'погоня у пруда', why: 'начался бой', soundtrack: саундтрек.slice(3), scene: null, phone: null },
  { from: 105, to: 109, date: '01.11.2024', place: 'Кухня', label: 'утро после', why: 'ночь прошла', soundtrack: саундтрек.slice(0, 2), scene: null, phone: телефон },
], stats: { soundtrackTracks: 7 } };
ряды.push(`<h1>Архив → Саундтрек</h1><div class="row"><div class="arc wide">${A.вкладкаСаундтрека(отчёт, '')}</div><div class="arc narrow">${A.вкладкаСаундтрека(отчёт, '')}</div></div>`);

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Музыка — стенд</title>
<link rel="stylesheet" href="../../css/all.css${В}">
<script>window.__стендЧат = ${JSON.stringify(живой)}; window.SillyTavern = { getContext: () => ({ chat: window.__стендЧат }) };</script>
<script type="module">import { действиеМузыки, подключитьМузыку } from "../../render/music.js${В}"; подключитьМузыку({}); import { settings } from "../../settings.js${В}"; Object.assign(settings, { enableMusic: true, musicPlayer: true }); window.__hudSettings = settings; document.addEventListener("click", (e) => { действиеМузыки(e); }); document.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") действиеМузыки(e); }); document.getElementById("mt").addEventListener("change", (e) => document.documentElement.classList.toggle("hud-has-moodtube", e.target.checked));</script>
<script>if (location.protocol === 'file:') document.addEventListener('DOMContentLoaded', () => document.body.insertAdjacentHTML('afterbegin', '<div style="position:sticky;top:0;z-index:9;margin:-16px -16px 12px;padding:10px 16px;background:#7a1d14;color:#fff;font:600 13px system-ui">Стенд открыт с диска: браузер не грузит модули, нажатия не работают. Откройте через сервер Таверны: http://localhost:8000/scripts/extensions/third-party/HUD/tests/tools/music-stand.html</div>'));</script>
<script>{ const t = new URLSearchParams(location.search).get('t'); if (t) { document.documentElement.classList.add('hud-theme-' + t); for (const f of ['light', t]) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '../../css/themes/' + f + '.css${В}'; document.head.appendChild(l); } } }</script>
<style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; --hud-bg: #1e1826; }
h1 { font-size: 15px; margin: 30px 0 4px; } h1 small, h2 small { opacity: .6; font-weight: 400; }
h2 { font-size: 12px; color: #a8a5ad; margin: 18px 0 6px; }
.row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
.hud-os-card { padding: 4px 0; border-radius: 16px; background: linear-gradient(160deg, #241c2c, #120e17); }
.wide { width: 540px; } .narrow { width: 239px; }
.phone { width: 300px; min-height: 420px; padding: 10px 0 18px; border-radius: 30px; border: 9px solid #16171d; background: linear-gradient(180deg, #2b2235, #0d0b12); color: #fff; }
/* Отступы экрана приложения — как в настоящем телефоне (base.css): 10/12 px,
   на узком — 8 px. Без них стенд показывал всё прижатым к краю. */
.phone { --hud-phone-bg: transparent; } .phone .hud-phone-app-view { display: block; position: static; padding: 10px 12px 12px; background: none; overflow: visible; }
.phone.is-narrow { width: 237px; } .phone.is-narrow .hud-phone-app-view { padding: 8px 8px 12px; }
.arc { padding: 12px; border-radius: 12px; background: #1d1824; }
label.mt { position: sticky; top: 0; z-index: 5; display: inline-flex; gap: 6px; padding: 6px 10px; border-radius: 8px; background: #2a2233; }
</style><body><label class="mt"><input type="checkbox" id="mt"> MoodTube установлен (показать кнопки очереди)</label><div>${ряды.join('\n')}</div></body>`;
// Английский стенд: данные подборок — по-английски (модель пишет на языке
// интерфейса), переводчик i18n.js переводит подписи HUD в странице.
const ДАННЫЕ_EN = [
  ['морозная ночь самайна', 'frosty Samhain night'], ['тихое напряжение', 'quiet tension'], ['нежность и усталость', 'tenderness and fatigue'],
  ['выдуманный', 'made up'], ['холодный воздух', 'cold air'], ['радио в гольф-каре', 'the golf cart radio'], ['бар «Синий час»', 'the «Blue Hour» bar'],
  ['сменилось место', 'the place changed'], ['по кнопке', 'by button'], ['модель молчит дольше 120 с', 'the model has been silent for over 120 s'],
  ['Особняк Регентов, южный парк', 'Regents\' mansion, south park'], ['Гольф-кар', 'Golf cart'], ['Кухня', 'Kitchen'],
  ['погоня у пруда', 'chase by the pond'], ['утро после', 'the morning after'], ['начался бой', 'a fight started'], ['ночь прошла', 'the night passed'],
  ['Тристана', 'Tristan'], ['Тристан', 'Tristan'],
];
const итог = EN ? ДАННЫЕ_EN.reduce((h, [ru, en]) => h.split(ru).join(en), html)
  .replace('Object.assign(settings, { enableMusic: true', 'Object.assign(settings, { language: "en", enableMusic: true')
  .replace('</body>', '<script type="module">import { включитьПереводчик } from "../../i18n.js' + В + '"; включитьПереводчик();</script></body>') : html;
const файл = EN ? 'music-stand-en.html' : 'music-stand.html';
fs.writeFileSync(path.join(ТУТ, файл), итог);
console.log('полос и экранов:', ряды.length, '→ tests/tools/' + файл);
