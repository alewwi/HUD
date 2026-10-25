// hud-manager/tests/i18n.mjs
//
// Английский интерфейс (settings.language = 'en', i18n.js):
// — переводчик узнаёт строки целиком, по шаблонам с числами и по частям;
// — инструкция модели без кириллицы;
// — у каждой русской подписи в CSS (content) есть английская в lang-en.css;
// — разбор понимает английские значения, которые модель пишет в этом режиме.
// Без модели: node tests/i18n.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set innerHTML(x) { t = String(x); }, get innerHTML() { return t; }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: узел(), addEventListener() {}, head: узел() };
globalThis.SillyTavern = { getContext: () => ({ chat: [], chatMetadata: {}, name1: 'Sophie', name2: 'Tristan' }) };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const м = (f) => import('file:///' + ROOT + f + '?v=' + v);
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 400)); } else console.log('✓', что); };
const К = /[а-яё]/i;

await import('file:///' + ROOT + 'index.js?v=' + v + '&t=' + Date.now());
const { settings } = await м('settings.js');
const I = await м('i18n.js');
const { СЛОВАРЬ_EN, ШАБЛОНЫ_EN } = await м('i18n-en.js');

// --- Словарь и переводчик ---------------------------------------------------
проверить('в переводах словаря нет кириллицы', !Object.values(СЛОВАРЬ_EN).some(x => К.test(x)), Object.entries(СЛОВАРЬ_EN).filter(([, x]) => К.test(x)).slice(0, 3).join(' | '));
проверить('шаблоны словаря собираются в регулярки', ШАБЛОНЫ_EN.every(([rx]) => { try { new RegExp(rx, 'u'); return true; } catch { return false; } }));
проверить('настройка по умолчанию — русский', settings.language === 'ru' && !I.английский());
проверить('т() в русском режиме возвращает строку как есть', I.т('Кастомизация') === 'Кастомизация');
settings.language = 'en';
const п = (s) => I.перевести(s);
const случаи = [
  ['🎨 Кастомизация', '🎨 Customization'],
  ['6 держится 2 ч', '6 holding 2 h'],
  ['Lower back: 6 держится 2 ч — aching', 'Lower back: 6 holding 2 h — aching'],
  ['заживёт примерно к воскресенью', 'will heal by about Sunday'],
  ['Доверие: Anna — 85; Mark — 55', 'Trust: Anna — 85; Mark — 55'],
  ['Софи', null],
  ['голубые глаза', 'blue eyes'],
  ['Сон 03:00–07:00 (примерно)', 'Sleep 03:00–07:00 (approx.)'],
  ['Объявление', 'Notice'],
];
for (const [ru, en] of случаи) проверить(`перевод «${ru}»`, п(ru) === en, п(ru));
проверить('имя без перевода остаётся как есть, соседние части переводятся', п('Доверие: Мирослава — 90') === 'Trust: Мирослава — 90', п('Доверие: Мирослава — 90'));
проверить('строка без кириллицы не трогается', п('Lilian Grey') === null);
проверить('знак зодиака — по месту: Gemini, а не близнецы-дети', I.знакЗодиака('Близнецы') === 'Gemini' && I.знакЗодиака('Весы') === 'Libra' && п('Близнецы') === 'Identical twins');
проверить('т() в английском режиме переводит', I.т('Кастомизация') === 'Customization');

// --- Инструкция модели --------------------------------------------------------
Object.assign(settings, { enableMemory: true, enablePhone: true, enableIntercepts: true, enableDiary: true, enableDreams: true, enableWorld: true, enableUserBlock: true, enableUnderwear: true });
const русское = [];
for (const era of ['modern', 'medieval']) {
  settings.era = era;
  for (const nsfw of [false, true]) {
    const p = await window.__tavernosHudPrompt({ nsfw });
    for (const x of String(p).match(/[^\s"'\[\]{}|]*[а-яё][^\s"'\[\]{}|]*/gi) || []) русское.push(`${era}/${nsfw ? 'nsfw' : 'sfw'}: ${x}`);
  }
}
settings.era = 'modern';
проверить('английская инструкция модели — без кириллицы (эпохи, сцена и вне её)', !русское.length, русское.slice(0, 8).join(' · '));
settings.language = 'ru';
const ру = await window.__tavernosHudPrompt({ nsfw: false });
проверить('русская инструкция осталась русской (примеры значений)', /write values in Russian/.test(ру) && К.test(ру));
settings.language = 'en';

// --- CSS: подписи в content -------------------------------------------------
const обойти = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? обойти(path.join(d, e.name)) : [path.join(d, e.name)]);
const лангEn = fs.readFileSync(ROOT + 'css/lang-en.css', 'utf8');
const норм = (sel) => sel.replace(/:root/g, '').replace(/\.hud-lang-en/g, '').replace(/\s+/g, ' ').trim();
const селекторыEn = [...лангEn.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, sel]) => норм(sel));
const безПеревода = [];
const темы = [];
for (const f of обойти(ROOT + 'css').filter(f => f.endsWith('.css') && !f.endsWith('lang-en.css'))) {
  const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, sel, тело] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (/content\s*:[^;'"]*['"][^'";]*[а-яё]/i.test(тело) && !/var\(--th-empty/.test(тело) && !селекторыEn.includes(норм(sel))) безПеревода.push(path.basename(f) + ': ' + норм(sel));
    const тема = /--th-empty-(?:world|diary)\s*:\s*'[^']*[а-яё]/i.test(тело) && норм(sel).match(/\.hud-theme-[\w-]+/);
    if (тема) темы.push(тема[0]);
  }
}
проверить('у каждой русской подписи в CSS есть английская в lang-en.css', !безПеревода.length, безПеревода.join(' | '));
const темыБез = [...new Set(темы)].filter(t => !new RegExp(':root\\.hud-lang-en' + t.replace(/[.-]/g, '\\$&') + '\\s*\\{').test(лангEn));
проверить('пустые «Мир» и «Дневник» тем — по-английски', !темыБез.length && /:root\.hud-lang-en\s*\{\s*--th-empty-world/.test(лангEn), темыБез.join(' '));
const загрузчик = fs.readFileSync(ROOT + 'css-loader.js', 'utf8');
проверить('lang-en.css грузится только в английском режиме', /\['lang-en',\s*\(?s\)? => s\.language === 'en'\]/.test(загрузчик));

// --- Разбор английских значений ------------------------------------------------
const Б = await м('render/combat.js');
const уч = Б.участникиБоя('Mark: ally; step; bat; wounded | Thug: enemy; close; knife; out of action | Dog: neutral; across the room; leash; unharmed');
проверить('бой: стороны, дистанции и состояния по-английски', уч.map(у => [у.сторона, у.дист, у.состояние].join('/')).join(' ') === 'ally/step/hurt enemy/close/out neutral/room/ok', JSON.stringify(уч.map(у => [у.сторона, у.дист, у.состояние])));
проверить('бой: этапы threat · pause · over', ['threat', 'pause', 'over'].every(с => (Б.этапБоя(с) || [])[0] === с));
проверить('бой: выдержка frozen — «замер»', Б.выдержка('Anna: frozen').map(x => Б.ВЫДЕРЖКА[x.ступень][0]).join() === 'freeze');
const Д = await м('render/duel.js');
проверить('дуэль: тон shouting — верхняя ступень, cold — холод', Д.разобратьДуэль('ini: Lilian, 65; tn: shouting').градус === 5 && Д.разобратьДуэль('ini: Mark, 55; tn: cold').градус === 1);
const Бе = await м('render/underwear.js');
const б = Бе.разобратьБельё('set: black lace, a set; for: without thinking; st: lost');
проверить('бельё: lost, цвет black, «не думая»', б.состояние === 'lost' && б.цвет === '#1d1a1f' && б.случайно, JSON.stringify(б));
const Сл = await м('render/body-layers.js');
const одежда = Сл.одеждаИзТекста('navy lace dress, black stockings, heels kicked off, bra unhooked');
проверить('одежда: вещи и состояния по-английски', одежда.map(о => о.id + '/' + о.состояние).join(' ') === 'dress/on stockings/on shoes/off bra/half', одежда.map(о => о.id + '/' + о.состояние).join(' '));
const Ин = await м('render/intimacy.js');
const зона = (t) => (Ин.ЗОНЫ.find(([, , rx]) => rx.test(t)) || [])[0];
проверить('карта тела: Neck, Lower back, Thighs, Lips', ['Neck', 'Lower back', 'Thighs', 'Lips'].map(зона).join() === 'neck,lowback,thighs,lips', ['Neck', 'Lower back', 'Thighs', 'Lips'].map(зона).join());
const Ж = await м('render/life.js');
const вид = (t) => Object.entries(Ж.ВИДЫ_БЫТА).filter(([, x]) => x.rx.test(t)).map(([к]) => к).join();
проверить('быт: английский таймлайн — еда, душ, сон', вид('late dinner, mushroom pasta') === 'eat' && вид('shower after work') === 'wash' && вид('went to bed at 00:30') === 'sleep' && вид('she was late') === '');
const SB = await м('render/scene-body.js');
const позаEN = "on the sofa, she's on top, knees on either side of his hips, sinking down slowly and deep, all the way, penis inside her";
const темпEN = SB.темпИзТекста(позаEN);
проверить('темп по-английски: «slowly … deep» — медленно и глубоко', темпEN && темпEN.уровень === 1 && темпEN.глубина === 'deep', JSON.stringify(темпEN));
проверить('проникновение по-английски: «penis inside her» — член в лоно', SB.проникновенияИзТекста(позаEN).some(п => п.чем === 'penis' && п.куда === 'vaginal'));
проверить('поза по-английски: она сверху, он над ней', SB.позаТела(позаEN, 'f') === 'top' && SB.позаТела('he is on top of her, between her thighs', 'm') === 'over');
// X-ray: одежда на силуэте, финал, «вышел», размер, влага — английскими словами и сленгом.
const вещи = (t, пол) => SB.одеждаПодробно(t, пол).map(в => [в.id, в.состояние, в.спущено || в.задрано || в.открыто || '', в.сдвинуто ? 'aside' : ''].filter(Boolean).join('/')).join(' ');
const ов = вещи('navy silk dress hiked up around her waist, red lace thong pushed aside, black stockings, heels kicked off', 'f');
проверить('x-ray: одежда по-английски — задрано, сдвинуто, снято', ов === 'dress/half/1 panties/half/aside stockings/on shoes/off', ов);
const ош = вещи('white linen shirt unbuttoned to the waist, black jeans pulled down to his knees, barefoot', 'm');
проверить('x-ray: рубашка распахнута, джинсы до колен, босиком', ош === 'shirt/half/2 pants/half/3 shoes/off', ош);
проверить('x-ray: «t-shirt» — футболка, «naked» — голая, «nude stockings» — нет', вещи('grey t-shirt', 'f') === 'tee/on' && SB.одеждаПодробно('naked', 'f').голый === true && !SB.одеждаПодробно('nude stockings', 'f').голый);
проверить('x-ray: финал — cumming inside / came / on the edge', SB.финалСцены('', 'pn: cumming deep inside her, filling her with cum') === 'climax' && SB.финалСцены('', 'he came inside her, softening') === 'after' && SB.финалСцены('', 'he is close, about to cum') === '' && SB.финалСцены('', 'he came closer and kissed her') === '');
проверить('x-ray: pull out, cum on her belly, creampie, swallow', SB.вышелИзТекста('he pulls out at the last second') && SB.снаружиИзТекста('cum on her belly') && SB.семяИзТекста('creampie, he came deep inside her')?.куда === 'vaginal' && SB.семяИзТекста('she swallows every drop')?.куда === 'oral');
const чл = SB.членИзТекста('pn: thick, veiny 7-inch cock');
проверить('x-ray: размер «7-inch, thick» — 17.8 см, толстый', чл && чл.см === 17.8 && чл.толщина === 'thick', JSON.stringify(чл));
проверить('x-ray: влага — soaking wet / slick / lube; «wet lips» — нет', SB.влагаИзТекста('lb: soaking wet, dripping down her thighs')?.уровень === 3 && SB.влагаИзТекста('lube on her ass')?.лубрикант === true && SB.влагаИзТекста('wet lips') === null);
проверить('x-ray: рука на члене и пальцы с языком', SB.проникновенияИзТекста('her hand wrapped around his cock, stroking').some(п => п.куда === 'hand') && SB.проникновенияИзТекста('two fingers inside her, tongue on her clit').map(п => п.чем).join() === 'tongue,fingers');
// Сцена близости и бой по прозе последних сообщений.
const Сн = await м('hud-snapshot.js');
проверить('проза: близость по-английски (сильное слово и пара слабых)', Сн.словаБлизости('He slid his cock into her') && Сн.словаБлизости('She moaned as he squeezed her breasts') && !Сн.словаБлизости('She moaned in pain.'));
проверить('проза: бой по-английски — выстрел; нож с кулаком', Сн.решитьБой(null, ['A gunshot cracked across the yard.']) && Сн.решитьБой(null, ['He pulled a knife and threw a punch.']) && !Сн.решитьБой(null, ['They had dinner by the window.']));
// Обморок, душ по прозе, погода, календарь, сводка.
const Пе = await м('render/character.js');
проверить('без сознания: «passed out» да, «almost passed out» нет, «came to» снимает', !!Пе.безСознания({ B: 'passed out after the blow' }) && !Пе.безСознания({ B: 'almost passed out from the heat' }) && !Пе.безСознания({ B: 'passed out; came to a minute later' }));
const Пр = await м('render/life-prose.js');
проверить('душ из прозы: «took a long, hot bath» — да; «wanted to», «bathed in moonlight» — нет', Пр.мытьёИзПрозы('She took a long, hot bath before bed.')?.что === 'ванная (по тексту)' && !Пр.мытьёИзПрозы('He wanted to take a shower, but the phone rang again.') && !Пр.мытьёИзПрозы('The garden was bathed in moonlight as she walked home.'));
проверить('погода для одежды: rain + chilly, scorching heat', Ж.видыПогоды('light rain, chilly').join() === 'холод,дождь' && Ж.видыПогоды('scorching heat').join() === 'жара');
const Ка = await м('render/calendar.js');
const рас = Ка.разобратьРасписание("10:00 - court tomorrow; on Friday evening — dinner at Richard's; Nov 15 - Lena's birthday; in 2 weeks - trip", { y: 2024, mo: 10, d: 17 }).map(x => x.день.mo + '/' + x.день.d + (x.часть ? ' ' + x.часть : '')).join(' | ');
проверить('календарь: tomorrow, on Friday evening, Nov 15, in 2 weeks', рас === '10/18 | 10/18 вечером | 11/15 | 10/31', рас);
проверить('календарь: дата сцены «October 17th, 2024»', JSON.stringify(Ка.parseDayMonth('Thursday, October 17th, 2024')) === '{"d":17,"mo":10,"y":2024}');
const Св = await м('render/summary-card.js');
const св = Св.разобратьСводку('Thursday, 17.10.2024 · 21:40 | evening · light rain | Tristan — living room | Event: the letter arrived | New: Lilian knows');
проверить('сводка: Event и New по-английски', св.событие === 'the letter arrived' && св.новое === 'Lilian knows' && св.время === '21:40', JSON.stringify(св));
settings.language = 'ru';

console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
