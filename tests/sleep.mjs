// hud-manager/tests/sleep.mjs
//
// Сон прошлой ночью (Bs slp). Модель пишет его короткими английскими
// единицами, как просит промпт: «4 h, 01:00; 3 nights: 13 h».
// — В русском интерфейсе карточка показывает «4 ч, отбой в 01:00; за 3 ночи — 13 ч»,
//   в английском — «4 h, bed at 01:00; 3 nights: 13 h»; свои слова модели не трогаем.
// — «Быт» и телефон берут из «4 h, 01:00» время отбоя: 01:00–05:00.
// — Предупреждение «⚠ после 4 ч сна?» переводится в английском режиме.
// node tests/sleep.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, set textContent(x) { t = String(x); }, get innerHTML() { return t; }, set innerHTML(x) { t = String(x); }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, getAttribute: () => null, appendChild() {}, append() {}, addEventListener() {}, remove() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), body: узел(), getElementById: () => null };
globalThis.SillyTavern = { getContext: () => ({ chat: [], chatMetadata: {}, name1: 'Мари', name2: 'Дамиан' }) };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const модуль = (имя) => import('file:///' + path.join(КОРЕНЬ, имя).replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);

let всего = 0, провалов = 0;
const проверить = (что, ок, подробно = '') => { всего++; if (!ок) { провалов++; console.log('✗', что, String(подробно).slice(0, 300)); } else console.log('✓', что); };

const { settings } = await модуль('settings.js');
const E = await модуль('render/extras.js');
const LF = await модуль('render/life.js');
const PE = await модуль('render/phone-extra.js');
const I = await модуль('i18n.js');
const текст = (h) => String(h).replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

settings.language = 'ru';
проверить('сон по-русски: часы, отбой и ночи подряд', E.сонДляПоказа('4 h, 01:00; 3 nights: 13 h') === '4 ч, отбой в 01:00; за 3 ночи — 13 ч', E.сонДляПоказа('4 h, 01:00; 3 nights: 13 h'));
проверить('сон по-русски: десятичная запятая, минуты, слова модели', E.сонДляПоказа('6.5 h, 00:00') === '6,5 ч, отбой в 00:00' && E.сонДляПоказа('6 h 30 min, 23:30, interrupted') === '6 ч 30 мин, отбой в 23:30, прерывистый' && E.сонДляПоказа("didn't sleep") === 'без сна',
  [E.сонДляПоказа('6.5 h, 00:00'), E.сонДляПоказа('6 h 30 min, 23:30, interrupted')].join(' | '));
проверить('сон по-русски: числа ночей и пробуждений склоняются', E.сонДляПоказа('5 nights: 9 h') === 'за 5 ночей — 9 ч' && E.сонДляПоказа('1 night: 2 h') === 'за 1 ночь — 2 ч' && E.сонДляПоказа('8 h, 3 wakings') === '8 ч, 3 пробуждения');
проверить('сон по-русски: русский текст и интервал не трогаем', E.сонДляПоказа('4 ч, легла в 03:20') === '4 ч, легла в 03:20' && E.сонДляПоказа('23:00–07:00') === '23:00–07:00');
const карточка = текст(E.видСостоянияТела('eng: 72; awk: 96; slp: 4 h, 01:00; 3 nights: 13 h; dut: совет директоров', 'batteries'));
проверить('карточка: сон прошлой ночью — развёрнут, английских единиц нет', карточка.includes('4 ч, отбой в 01:00; за 3 ночи — 13 ч сон прошлой ночью') && !/\d h\b|nights/.test(карточка), карточка);
проверить('карточка: строкой — тоже развёрнут', текст(E.видСостоянияТела('eng: 72; slp: 3.5 h, 04:30', 'chips')).includes('сон 3,5 ч, отбой в 04:30'));

settings.language = 'en';
проверить('сон по-английски: время отбоя подписано, остальное как у модели', E.сонДляПоказа('4 h, 01:00; 3 nights: 13 h') === '4 h, bed at 01:00; 3 nights: 13 h' && E.сонДляПоказа('6.5 h, 00:00') === '6.5 h, bed at 00:00', E.сонДляПоказа('4 h, 01:00; 3 nights: 13 h'));
проверить('английский: «⚠ после 4 ч сна?» и подпись сна переводятся', I.перевести('⚠ после 4 ч сна?') === '⚠ after 4 h of sleep?' && I.перевести('сон прошлой ночью') === 'sleep last night', I.перевести('⚠ после 4 ч сна?'));
settings.language = 'ru';

const с = LF.сонИз('eng: 72; slp: 4 h, 01:00; 3 nights: 13 h; dut: офис');
проверить('«Быт»: из «4 h, 01:00» — четыре часа с отбоем в 01:00 и три ночи', с && с.часов === 4 && с.легла === '01:00' && с.ночей === 3 && с.всего === 13, JSON.stringify(с));
проверить('«Быт»: интервал по-прежнему точнее', LF.сонИз('slp: 23:00–07:00').часов === 8);
const тел = текст(PE.buildHealthApp({ owner: 'Дамиан' }, { 'Дата': '18.10.2024', 'Время': '22:18' }, [{ 'Имя': 'Дамиан', 'Состояние тела': 'eng: 70; slp: 4 h, 01:00; 3 nights: 13 h' }], 'Дамиан'));
проверить('телефон: сон 4 ч, с 01:00 до 05:00, без «01:00» в заметке', /Сон 4 ч 01:00 – 05:00/.test(тел) && !/05:00 01:00/.test(тел), тел.slice(0, 200));

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
