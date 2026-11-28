// hud-manager/tests/phone-float.mjs
//
// Плавающий телефон (phone-float.js) и обои телефона (render/phone-settings.js):
// — кнопка не уходит за край окна, запомненное место — доли окна;
// — обои и фон чата: в стиль попадают только известные варианты и наши
//   снимки (data:-картинки), ключи — из букв и цифр. Чужой файл чата не может
//   подсунуть адрес-«маячок» или кусок CSS.
// Без модели: node tests/phone-float.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.innerWidth = 1000; globalThis.innerHeight = 800;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => ({ style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} });
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: узел(), head: узел(), addEventListener() {} };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const м = (f) => import('file:///' + ROOT + f + '?v=' + v);
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 300)); } else console.log('✓', что); };

const { settings } = await м('settings.js');
const пф = await м('phone-float.js');
const { место, прижать } = пф._дляТестов;

// --- Место кнопки ----------------------------------------------------------------
settings.phoneFloatPos = null;
{ const п = место(); проверить('без места — у правого края, в верхней трети', п.x === 1000 - 50 - 14 && п.y === Math.round(800 * 0.36), JSON.stringify(п)); }
settings.phoneFloatPos = { x: 0.5, y: 0.5 };
{ const п = место(); проверить('место — доли окна, центр кнопки', п.x === 475 && п.y === 375, JSON.stringify(п)); }
settings.phoneFloatPos = { x: 5, y: -3 };
{ const п = место(); проверить('место за окном прижимается к краю', п.x === 1000 - 50 - 6 && п.y === 6, JSON.stringify(п)); }
settings.phoneFloatPos = { x: 'a', y: null };
{ const п = место(); проверить('испорченное место — как без места', п.x === 1000 - 50 - 14, JSON.stringify(п)); }
{ const п = прижать(-100, 5000); проверить('прижать держит кнопку в окне', п.x === 6 && п.y === 800 - 50 - 6, JSON.stringify(п)); }
// Узкий и широкий экран — своё место: синхронизация настроек не переносит
// место с ПК на телефон.
settings.phoneFloatPos = null;
const { запомнитьМесто } = пф._дляТестов;
запомнитьМесто(0.1, 0.9);
проверить('на широком экране место пишется как wide', settings.phoneFloatPos.wide && settings.phoneFloatPos.wide.x === 0.1 && !settings.phoneFloatPos.narrow, JSON.stringify(settings.phoneFloatPos));
globalThis.innerWidth = 375; globalThis.innerHeight = 800;
{ const п = место(); проверить('на узком экране место с ПК не берётся', п.x === 375 - 50 - 14, JSON.stringify(п)); }
запомнитьМесто(0.5, 0.2);
проверить('узкое место рядом с широким', settings.phoneFloatPos.narrow.x === 0.5 && settings.phoneFloatPos.wide.x === 0.1, JSON.stringify(settings.phoneFloatPos));
settings.phoneFloatPos = { x: 0.5, y: 0.5 };
{ const п = место(); проверить('старое место {x, y} годится и узкому', п.x === Math.round(0.5 * 375 - 25), JSON.stringify(п)); }
globalThis.innerWidth = 1000;
settings.phoneFloatPos = null;

// --- Обои и фон чата ----------------------------------------------------------------
const н = await м('render/phone-settings.js');
const снимок = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4';
проверить('вариант обоев блокировки', н.правилоОбоев('abc1', { lock: { p: 'aurora' } }).includes('.hud-phone-lockscreen'));
проверить('обои главного экрана — под всем разблокированным экраном', /\.hud-phone-unlocked\.hud-phone-unlocked:not\(:has\(\.hud-phone-app-view\.active\)\)\{background:/.test(н.правилоОбоев('abc1', { home: { p: 'dusk' } })));
проверить('своё фото в обоях', н.правилоОбоев('abc1', { home: { img: снимок } }).includes(снимок));
проверить('внешний адрес в обоях не проходит', н.правилоОбоев('abc1', { home: { img: 'https://evil.example/t.png' } }) === '');
проверить('кавычки и CSS в снимке не проходят', н.правилоОбоев('abc1', { lock: { img: 'data:image/png;base64,AA") } * {display:none} x{a:url("' } }) === '');
проверить('чужой ключ обоев не проходит', н.правилоОбоев('a"]{}', { lock: { p: 'aurora' } }) === '' && н.правилоОбоев('__proto__', { lock: { p: 'aurora' } }) === '');
проверить('обои не объектом — пусто', н.правилоОбоев('abc1', 'x') === '' && н.правилоОбоев('abc1', null) === '');
проверить('неизвестный вариант — пусто', н.правилоОбоев('abc1', { lock: { p: 'nope' } }) === '');
проверить('фон чата: чужой ключ не проходит', н.правилоФона('x"],*{display:none}[a="', { p: 'night' }) === '');
проверить('фон чата: внешний адрес не проходит', н.правилоФона('abc1', { img: 'http://evil/x.png' }) === '');
проверить('фон чата: наш снимок', н.правилоФона('abc1', { img: снимок }).includes(снимок));
проверить('фон чата: вариант', н.правилоФона('abc1', { p: 'night' }).includes('data-bgk="abc1"'));
проверить('у обоев свои варианты поверх фонов чата', н.ОБОИ.length > н.ФОНЫ_ЧАТА.length && new Set(н.ОБОИ.map(([к]) => к)).size === н.ОБОИ.length);

console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
