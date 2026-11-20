// hud-manager/tests/babies-nc.mjs
//
// «nc» у малышей (bb): ход, где ребёнок записан длинными ключами («Имя»,
// «Одежда», «Доверие»…), разворачивается так же, как записанный кодами, и
// сохраняется кодами. Без модели: node tests/babies-nc.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set innerHTML(x) { t = String(x); }, get innerHTML() { return t; }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: узел(), addEventListener() {}, head: узел() };
globalThis.SillyTavern = { getContext: () => ({ chat: [], chatMetadata: {} }) };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
await import('file:///' + ROOT + 'index.js?v=' + v + '&t=' + Date.now());
const H = await import('file:///' + ROOT + 'hud-snapshot.js?v=' + v);
const X = await import('file:///' + ROOT + 'hud-expand.js?v=' + v);
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 400)); } else console.log('✓', что); };

const малыш = { N: 'Ася', sx: 'girl', A: '3 месяца', C: 'розовый бодик с зайцами', Ap: 'светлый пушок, голубые глаза', R: 'дочь', B: 'сонная', H: 'здорова', Mrk: 'Родинка: левое плечо | получен: с рождения', I: 'Соска: в кармане; Плед: на коленях', L: 'в кроватке', Rl: 'Вера: успокаивается на руках', Tr: 'Вера: 95; Глеб: 80', Nds: 'fed: 09:30, грудь; slp: проснулась в 09:50' };
const ход = (bb) => JSON.stringify({ sc: { T: '10:00', Dt: '01.01.2026' }, cs: [{ N: 'Вера', C: 'халат' }], bb });
const ncКодами = { N: 'Ася', sx: 'girl', A: '3 месяца', C: 'nc', Ap: 'nc', R: 'дочь', B: 'гулит', H: 'nc', Mrk: 'nc', I: 'nc', L: 'на руках', Rl: 'nc', Tr: 'nc' };
// Тот же ход длинными ключами — так он лежал в чате после сохранения самим HUD.
const ncСловами = { 'Имя': 'Ася', 'Пол': 'girl', 'Возраст': '3 месяца', 'Одежда': 'nc', 'Внешность': 'nc', 'Роль': 'дочь', 'Тело': 'гулит', 'Здоровье': 'nc', 'Следы на теле': 'nc', 'Инвентарь': 'nc', 'Место': 'на руках', 'Отношения': 'nc', 'Доверие': 'nc', 'Нужды': 'fed: 10:15, бутылочка' };
const прошлыйКодами = H.HUDвКодах(ход([малыш]));
const прошлыйСловами = H.HUDвКодах(ход([Object.fromEntries(Object.entries(малыш).map(([к, з]) => [{ N: 'Имя', sx: 'Пол', A: 'Возраст', C: 'Одежда', Ap: 'Внешность', R: 'Роль', B: 'Тело', H: 'Здоровье', Mrk: 'Следы на теле', I: 'Инвентарь', L: 'Место', Rl: 'Отношения', Tr: 'Доверие', Nds: 'Нужды' }[к] || к, з]))]));

проверить('малыш длинными ключами читается кодами (Имя → N, Пол → sx, Нужды → Nds)', прошлыйСловами.bb[0].N === 'Ася' && прошлыйСловами.bb[0].sx === 'girl' && прошлыйСловами.bb[0].Nds === малыш.Nds && !('Имя' in прошлыйСловами.bb[0]), JSON.stringify(прошлыйСловами.bb[0]));

for (const [имя, сейчас, прошлый] of [
  ['коды → коды', ncКодами, прошлыйКодами],
  ['слова → коды', ncСловами, прошлыйКодами],
  ['коды → слова', ncКодами, прошлыйСловами],
  ['слова → слова', ncСловами, прошлыйСловами],
]) {
  const hud = H.HUDвКодах(ход([сейчас]), { сПоворотом: true });
  X.развернутьКраткое(hud, [прошлый]);
  const м = hud.bb[0];
  const ост = Object.entries(м).filter(([, з]) => X.NC.test(String(з))).map(([к]) => к);
  проверить(`${имя}: nc не осталось`, !ост.length, ост.join(','));
  проверить(`${имя}: одежда, внешность, здоровье, следы, вещи, отношения, доверие — прежние`, м.C === малыш.C && м.Ap === малыш.Ap && м.H === малыш.H && м.Mrk === малыш.Mrk && м.I === малыш.I && м.Rl === малыш.Rl && м.Tr === малыш.Tr, JSON.stringify(м));
  проверить(`${имя}: новое этого хода не тронуто`, м.B === 'гулит' && м.L === 'на руках');
  проверить(`${имя}: сохраняется кодами`, Object.keys(м).every(к => /^[A-Za-z]+$/.test(к)), Object.keys(м).join(','));
}
// Один малыш объектом, а не списком, — тоже малыш.
const один = H.HUDвКодах(JSON.stringify({ sc: { T: '10:00' }, bb: { 'Имя': 'Ася', 'Одежда': 'nc' } }), { сПоворотом: true });
X.развернутьКраткое(один, [прошлыйКодами]);
проверить('малыш объектом: список и развёрнутая одежда', Array.isArray(один.bb) && один.bb[0].C === малыш.C, JSON.stringify(один.bb));
// Снимок для модели — кодами.
const снимок = H.строкаСнимка(H.собратьСнимок(ход([Object.fromEntries(Object.entries(ncСловами).map(([к, з]) => [к, з === 'nc' ? 'x' : з]))])), false);
проверить('снимок: малыш кодами, без длинных ключей', /"bb":\[\{"N":"Ася"/.test(снимок) && !снимок.includes('"Одежда"'), снимок.slice(0, 300));

console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
if (провалов) process.exitCode = 1;
