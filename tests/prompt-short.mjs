// hud-manager/tests/prompt-short.mjs
//
// «Короткая инструкция» (settings.hudPromptShort, prompt-short.js): выключена —
// инструкция прежняя до символа; включена — те же правила короче, в любом
// сочетании настроек каждая замена находит свой текст, английская версия без
// русских остатков, глубокая настройка режет короткие строки. Без модели:
// node tests/prompt-short.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set innerHTML(x) { t = String(x); }, get innerHTML() { return t; }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: узел(), addEventListener() {}, head: узел() };
globalThis.SillyTavern = { getContext: () => ({ chat: [], chatMetadata: {}, name1: 'Мари', name2: 'Дамиан' }) };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
await import('file:///' + ROOT + 'index.js?v=' + v + '&t=' + Date.now());
const S = await import('file:///' + ROOT + 'settings.js?v=' + v);
const P = await import('file:///' + ROOT + 'prompt.js?v=' + v);
const К = await import('file:///' + ROOT + 'prompt-short.js?v=' + v);
const E = await import('file:///' + ROOT + 'prompt-en.js?v=' + v);
const D = await import('file:///' + ROOT + 'deep-fields.js?v=' + v);
const Б = await import('file:///' + ROOT + 'token-budget.js?v=' + v);
P.подключить({ сверитьРоды() {}, последнийСнимокОбъект() { return null; }, последнийHUDКакЕсть() { return ''; } });
Object.assign(S.settings, { enableMemory: true, enablePhone: true, enableIntercepts: true, enableDiary: true, enableDreams: true, enableWorld: true, enableUserBlock: true, enableCompanions: true });
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 400)); } else console.log('✓', что); };

const собрать = (настройки, опции = {}) => {
  const было = {};
  for (const k of Object.keys(настройки)) было[k] = S.settings[k];
  Object.assign(S.settings, настройки);
  try { return P.buildDynamicPrompt({ nsfw: true, бой: true, ...опции }); } finally { Object.assign(S.settings, было); }
};

// Выключено — ни одной замены: инструкция равна той, что без модуля.
S.settings.hudPromptShort = false;
const обычная = собрать({});
проверить('выключено по умолчанию', S.defaultSettings ? S.defaultSettings.hudPromptShort === false : true);
проверить('выключено — прежний текст (нет коротких формулировок)', !обычная.includes('TAGS start') && обычная.includes('"VOICE: prefix the text with') && обычная.includes('Keep ongoing conversations') && обычная.includes('The block holds ONLY valid JSON'));

// Сочетания настроек: каждая замена должна найти свой текст хотя бы в одном,
// а варианты (игрок, следы, сообщения, одна строка, роды) — в своём.
const сочетания = [
  ['всё включено', {}, {}],
  ['без блока игрока', { enableUserBlock: false }, {}],
  ['без следов на теле', { enableIntimacyExtras: false }, {}],
  ['без «Сообщений»', { phoneAppMessages: false }, {}],
  ['без одной строки', { hudOneLine: false }, {}],
  ['стабильная схема (роды, после родов)', {}, { cacheStable: true }],
  ['мирный ход', {}, { nsfw: false, бой: false }],
  ['мужские пары', { malePairs: true }, {}],
];
const нашлись = new Set();
for (const [имя, настройки, опции] of сочетания) {
  const полный = собрать({ ...настройки, hudPromptShort: false }, опции);
  const короткий = собрать({ ...настройки, hudPromptShort: true }, опции);
  К.ЗАМЕНЫ_КОРОТКО.forEach(([было], i) => { if (typeof было === 'string' ? полный.includes(было) : было.test(полный)) нашлись.add(i); });
  проверить(`${имя}: короче`, Б.оценкаТокенов(короткий) < Б.оценкаТокенов(полный), Б.оценкаТокенов(короткий) + ' / ' + Б.оценкаТокенов(полный));
  // Ни одного куска прежних формулировок там, где замена должна была сработать.
  const остатки = ['"VOICE: prefix the text with', 'The block holds ONLY valid JSON', 'short codes of 1-3 letters', 'it only lengthens the reply', 'emit every section and every field', 'is almost always a sign you stopped', 'Quote speech and phrases inside a value', 'the story follows other people — leave', 'same rules and order as for characters'].filter(к => короткий.includes(к));
  проверить(`${имя}: прежних формулировок нет`, !остатки.length, остатки.join(' | '));
  // Требования, на которые опираются разбор, тесты и перегенерация телефона.
  const нужны = ['is not a dropped field', 'Copying an unchanged field out in full is a mistake', 'Any real change', '«ёлочки»', 'escape it as', 'NO upper limit', 'aim for 3+', 'never put {{user}} there', 'nobody narrates events they did not witness'];
  if (настройки.hudOneLine !== false) нужны.push('Write the JSON on ONE line', 'is written as \\n.');
  if (S.settings.enableCompanions !== false) нужны.push('its 3-4 most telling skills');
  const нет = нужны.filter(к => !короткий.includes(к));
  проверить(`${имя}: требования на месте`, !нет.length, нет.join(' | '));
  const ру = E.промптНаАнглийском(короткий).split('\n').filter(l => /[А-Яа-яЁё]/.test(l) && !/hudLast/.test(l));
  проверить(`${имя}: английская версия без русских остатков`, !ру.length, ру.join('\n').slice(0, 300));
  if (настройки.enableUserBlock === false) проверить('без игрока: в «отсутствующих» нет «no us»', !короткий.includes('— no "us"') && короткий.includes('The same goes for {{user}}. An empty list'));
  if (настройки.phoneAppMessages === false) проверить('без «Сообщений»: перехваты с полными правилами', короткий.includes('Keep ongoing conversations') && !короткий.includes('as in cm, except'));
  if (настройки.enableIntimacyExtras === false) проверить('без следов: игрок — коротко, хвост близости с пометкой', короткий.includes('"Ill": "[illnesses and injuries of {{user}}, ONLY if any — same format and rules as for characters]"') && короткий.includes("readiness for the next round' — a code shared with W"));
  if (опции.cacheStable) проверить('после родов у игрока — коротко', короткий.includes('"Pp": "[after childbirth of {{user}}, ONLY if she has given birth, otherwise omit — same format as for characters]"'));
}
const ненайденные = К.ЗАМЕНЫ_КОРОТКО.map((_, i) => i).filter(i => !нашлись.has(i));
проверить('каждая замена находит свой текст в prompt.js (иначе prompt.js изменили — обнови prompt-short.js)', !ненайденные.length, ненайденные.map(i => String(К.ЗАМЕНЫ_КОРОТКО[i][0]).slice(0, 80)).join(' | '));

// Перегенерация телефона и глубокая настройка поверх короткой.
const короткий = собрать({ hudPromptShort: true });
const тел = P.промптТелефона(короткий);
проверить('телефон: переписки, аппарат и теги на месте', тел.includes('"cm": {') && тел.includes('"phn": {') && тел.includes('TAGS start') && тел.includes('[BY: who]') && тел.includes('Write the JSON on ONE line'));
const срез = D.вырезатьИзПромпта(короткий, ['us.UW.tch', 'us.UW.vl']).split('\n').find(l => l.includes('"UW"')) || '';
проверить('глубокая настройка режет коды близости игрока в короткой', срез && !/\btch:/.test(срез) && !/\bvl:/.test(срез) && /\bds:/.test(срез), срез.slice(0, 300));

// «👬 Мужские пары» (settings.malePairs). Выключено — блок близости как
// раньше: ануса нет ни у кого. Включено — у игрока нет женской анатомии
// (цикл, беременность, послеродовое, грудь, влага), есть член и анус; у
// персонажа анус — когда его берут сзади.
for (const коротко of [false, true]) {
  const подпись = коротко ? ' (короткая)' : '';
  const выкл = собрать({ malePairs: false, hudPromptShort: коротко });
  const вкл = собрать({ malePairs: true, hudPromptShort: коротко });
  const us = (p) => p.slice(p.indexOf('"us": {'), p.indexOf('\n }', p.indexOf('"us": {')));
  const W = (p) => (p.match(/"W": "[^\n]*/) || [''])[0];
  const UW = (p) => (p.match(/"UW": "[^\n]*/) || [''])[0];
  проверить('мужские пары выкл: ануса нет' + подпись, !/\bas: /.test(W(выкл)) && !/\bas: /.test(UW(выкл)), UW(выкл).slice(0, 200));
  проверить('мужские пары выкл: у игрока цикл, грудь и влага как раньше' + подпись, /"Mns":/.test(us(выкл)) && /\bch: /.test(UW(выкл)) && /\blb: /.test(UW(выкл)));
  проверить('мужские пары вкл: у игрока нет цикла, беременности, послеродового' + подпись, !/"(?:Mns|Prg|Pp)":/.test(us(вкл)), us(вкл).slice(0, 300));
  проверить('мужские пары вкл: в UW нет груди и влаги, есть член и анус' + подпись, !/\b(?:ch|lb): /.test(UW(вкл)) && /\ban: his/.test(UW(вкл)) && /\bas: his anus/.test(UW(вкл)), UW(вкл).slice(0, 400));
  проверить('мужские пары вкл: у персонажа анус, когда его берут сзади' + подпись, /\bas: anus — whenever this person is taken from behind/.test(W(вкл)));
  // Пол — базовое поле, как одежда: у персонажа и у игрока, каждый ход.
  проверить('поле «Пол» (sx) у персонажа и игрока' + подпись, /"sx": "\[gender — a basic field like clothing: ALWAYS/.test(выкл) && /"sx": "\[gender of \{\{user\}\}[^"]*'м' \(мужчина\) or 'ж' \(женщина\)/.test(us(выкл)));
  проверить('мужские пары: у игрока «Пол» — «м»' + подпись, /"sx": "\[gender of \{\{user\}\}[^"]*'м' — \{\{user\}\} is a man/.test(us(вкл)));
}

console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
if (провалов) process.exitCode = 1;
