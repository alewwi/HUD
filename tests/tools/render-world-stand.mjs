// Стенд вкладки «Мир»: каждый блок в каждом виде (Кастомизация → Блоки: Мир)
// на данных примера HUD и на длинных строках — широко и узко, как на
// телефоне. Без SillyTavern и без генераций. Пишет tests/tools/world-stand.html;
// открывать через сервер Таверны (…/third-party/HUD/tests/tools/world-stand.html),
// светлая тема — ?t=kawaii.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ТУТ = path.dirname(fileURLToPath(import.meta.url));
const КОРЕНЬ = path.resolve(ТУТ, '..', '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const В = '?v=' + ВЕРСИЯ;
const м = (f) => import('file:///' + path.join(КОРЕНЬ, f).replace(/\\/g, '/') + В);
globalThis.window = globalThis;
globalThis.document = { createElement: () => ({ style: {}, classList: { add() {} }, set innerHTML(v) { this.value = v; } }), querySelector: () => null, querySelectorAll: () => [], documentElement: { style: {}, classList: { contains: () => false } } };
globalThis.SillyTavern = { getContext: () => ({ chat: [], name1: 'Софи', name2: 'Тристан', characters: [], chatMetadata: {} }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};

const { settings } = await м('settings.js');
const V = await м('render/views.js');
const W = await м('render/world.js');
const P = await м('hud-parser.js');
const Sch = await м('schema.js');
const S = await м('render/sample-hud.js');
const пример = Sch.normalizeJSONData(P.parseHUDComplex(S.ПРИМЕР_HUD_ТЕКСТ.split('{{user}}').join('Софи'))).world;

// Длинные строки: так модель пишет в долгих чатах — с кавычками, телефонами, без знака.
const длинный = {
  headlines: ['«Скандал в элитном обществе: наследник замечен в ярости у спортзала» | Очевидцы сообщают, что наследник покинул частный спортзал в компании друга, и оба имели следы жестокого спарринга. Инсайдеры связывают это с возвращением подопечной в кампус.', 'Администрация парка опровергает слухи о побеге аллигатора из террариума'],
  rumors: ['«Говорят, профессор скоро исчезнет — студсовет уже роет под него, никто не трогает то, что наследник считает своим»', 'Старые рыбаки поговаривают, что в буреломе за заброшенным эллингом этой осенью видели редкого чёрного зверя с глазами цвета льда'],
  economy: ['Акции Kingsley Conglomerate | 183,2 $ | −0,8%', 'Утренняя булочка с говядиной от Лейлы | 0,00 $ | спасла жизнь и подкупила тридцатикилограммовую рысь', 'Квартиры в Cawrwyn | 8500 $/м² | стабильно', 'Рынок замер в ожидании решения совета директоров'],
  city: ['emergency | Лесничество предупреждает об активности крупных диких кошачьих в неосвещённых лесопарковых зонах у воды после заката', 'traffic | Пробка на мосту, 9 баллов — до полуночи', 'parks | Вход в парк закрыт до 12:00'],
  forecast: ['Утро | снегопад, облачно | −5°C | укрыть дорожки', 'День | облачно, временами снег | −2°C | колючий ветер', 'Вечер | ясно | −7°C | мороз крепчает', 'Ночь | ясно | −10°C | опасность гололёда'],
  horoscope: ['Овен | Львиная доля успеха — в настойчивости. Не сдавайся. | ровно', 'Скорпион | Страсть обострится до предела — не поддавайся ей. | неудача', 'Стрелец | Новое знакомство принесёт удачу. | удача'],
  prediction: ['Сегодня ночью звёзды сходятся в странный узор — страсть и разрушение переплетены в нити, которые трудно разорвать.'],
  events: ['exhibition | Подготовка весенней экспозиции студенческой галереи | Комната 307, тайная работа над холстом «Жетон №114»', 'club | Закрытый семейный ужин двух семей | Клуб «Метрополитен», Пятая авеню, 20:00'],
  ads: ['Продаю утеплитель для окон, новый, дёшево. Звонить 555-0192', 'Сниму квартиру недалеко от университета. Анонимно. Ящик 14, главпочтамт', 'Студенческая пекарня за гуманитарным корпусом приглашает на свежую мясную выпечку каждое утро с 08:00'],
  comments: ['koen_mind_blown: «Ты из какой пещеры вылезла?!» — реакция просто бесценна, парень чуть не поседел на этом пирсе!', 'prep_school_insider: Вы не понимаете — эта семья проклята. Там кровь на стенах, метафорически и буквально'],
};

const ПОЛЯ = { newsView: ['headlines'], rumorsView: ['rumors'], economyView: ['economy'], cityView: ['city'], forecastView: ['forecast'], horoscopeView: ['horoscope', 'prediction'], eventsView: ['events'], adsView: ['ads'], commentsView: ['comments'] };
const мир = V.ВИДЫ_БЛОКОВ.filter(б => б.группа === 'Мир');
const ряды = [];
for (const б of мир) {
  for (const [вид, имя] of Object.entries(б.виды)) {
    settings[б.ключ] = вид;
    const собрать = (данные, id) => W.buildWorldHTML(Object.fromEntries(ПОЛЯ[б.ключ].map(п => [п, данные[п] || []])), id, true, true);
    ряды.push(`<h2 id="${б.ключ}-${вид}">${б.поле}: ${имя} <small>${б.ключ}=${вид}</small></h2><div class="row"><div class="wide">${собрать(пример, б.ключ + вид + 'w')}</div><div class="narrow">${собрать(длинный, б.ключ + вид + 'n')}</div></div>`);
  }
  delete settings[б.ключ];
}

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Мир — стенд</title>
<link rel="stylesheet" href="../../css/all.css${В}">
<script type="module">import { действиеМира } from "../../render/world-views.js${В}"; document.addEventListener("click", (e) => { if (!действиеМира(e)) { const в = e.target.closest(".hud-v"); if (в) в.classList.toggle("fx-active"); } }); document.addEventListener("keydown", действиеМира);</script>
<script>if (location.protocol === 'file:') document.addEventListener('DOMContentLoaded', () => document.body.insertAdjacentHTML('afterbegin', '<div style="position:sticky;top:0;z-index:9;margin:-16px -16px 12px;padding:10px 16px;background:#7a1d14;color:#fff;font:600 13px system-ui">Стенд открыт с диска: браузер не грузит модули, нажатия не работают. Откройте через сервер Таверны: http://localhost:8000/scripts/extensions/third-party/HUD/tests/tools/world-stand.html</div>'));</script>
<script>{ const t = new URLSearchParams(location.search).get('t'); if (t) { document.documentElement.classList.add('hud-theme-' + t); for (const f of ['light', t]) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '../../css/themes/' + f + '.css${В}'; document.head.appendChild(l); } } }</script>
<style>
body { margin: 0; padding: 16px; background: #15111b; color: #e6e6ee; font: 13px system-ui, sans-serif; --hud-accent: #d96a8a; --hud-bg: #1e1826; }
h2 { font-size: 12px; color: #a8a5ad; margin: 22px 0 6px; } h2 small { opacity: .6; font-weight: 400; }
.row { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
.wide { width: 540px; } .narrow { width: 190px; }
.hud-tab-content { display: block !important; opacity: 1 !important; animation: none !important; }
.hud-world-container { max-height: none !important; } .hud-world-scroll { overflow: visible !important; }
.hud-breaking-news { display: none; }
</style><body><div>${ряды.join('\n')}</div></body>`;
fs.writeFileSync(path.join(ТУТ, 'world-stand.html'), html);
console.log('видов:', ряды.length, '→ tests/tools/world-stand.html');
