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
settings.language = 'ru';

console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
