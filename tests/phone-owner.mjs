// hud-manager/tests/phone-owner.mjs
//
// Чей телефон, когда {{char}} нет в сцене (настройка phoneWhenCharAway):
// «его же, за кадром» — как раньше; «того, за кем сюжет» — модель пишет
// владельца, у каждого свой телефон, телефон {{char}} ждёт в снимке (phc);
// «оба» — телефон {{char}} и второй телефон (phx) того, за кем сюжет.
// Без модели: node tests/phone-owner.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set innerHTML(x) { t = String(x); }, get innerHTML() { return t; }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: узел(), addEventListener() {}, head: узел() };
const чат = [];
const контекст = { chat: чат, chatMetadata: {}, name1: 'Вера', name2: 'Глеб', chatId: 'телефоны' };
globalThis.SillyTavern = { getContext: () => контекст };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
await import('file:///' + ROOT + 'index.js?v=' + v + '&t=' + Date.now());
const промпт = window.__tavernosHudPrompt;
const м = (f) => import('file:///' + ROOT + f + '?v=' + v);
const { settings } = await м('settings.js');
const P = await м('prompt.js'), Sn = await м('hud-snapshot.js'), Sc = await м('schema.js'), C = await м('render/carryover.js');
Object.assign(settings, { enableMemory: true, enablePhone: true, enableIntercepts: true, enableUserBlock: true, carryOver: true, carryTurns: 20 });
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 400)); } else console.log('✓', что); };
const было = settings.phoneWhenCharAway;

// --- Инструкция в трёх режимах ---------------------------------------------
settings.phoneWhenCharAway = 'char';
const pChar = await промпт({ nsfw: false });
проверить('по умолчанию «его же, за кадром»', было === 'char' || было === undefined);
проверить('«за кадром»: владелец всегда {{char}}, телефон живёт без него, phx нет',
  pChar.includes('"ow": "[owner: ALWAYS {{char}}, the same name every turn') && pChar.includes("stays {{char}}'s even then") && !pChar.includes('"phx"'));
settings.phoneWhenCharAway = 'present';
const pPresent = await промпт({ nsfw: false });
проверить('«того, за кем сюжет»: владелец — тот, за кем сюжет, по N; phc и свои данные',
  pPresent.includes("it is that person's own phone") && pPresent.includes('written exactly as their N') && pPresent.includes('phc in the last HUD') && !pPresent.includes('"phx"') && !pPresent.includes('ALWAYS {{char}}, the same name every turn'));
settings.phoneWhenCharAway = 'both';
const pBoth = await промпт({ nsfw: false });
проверить('«оба»: телефон {{char}} как обычно и раздел phx того, за кем сюжет',
  pBoth.includes('ALWAYS {{char}}, the same name every turn') && pBoth.includes('\n "phx": {') && pBoth.includes('ONLY while {{char}} is NOT in the scene') && pBoth.includes('second phone in phx'));
const телефонОба = P.промптТелефона(pBoth);
проверить('перегенерация телефона при «оба» просит и phx', телефонОба.includes('"phx"') && телефонОба.includes('(and "phx" while {{char}} is not in the scene)'));
settings.phoneWhenCharAway = 'char';
проверить('перегенерация телефона по умолчанию — без phx', !P.промптТелефона(pChar).includes('"phx"'));

// --- Разбор второго телефона ------------------------------------------------
const разбор = Sc.normalizeJSONData({ sc: { T: '20:00' }, cm: { 'Лена': { ow: 'Глеб', ms: ['Лена -> Глеб: Ты где? | 19:00 | Read'] } }, phn: { ow: 'Глеб' },
  phx: { ow: 'Лена', cm: { 'Мама': { ow: 'Лена', ms: ['Мама -> Лена: Позвони | 19:30 | Unread'] } }, phn: { ow: 'Лена', nt: [{ ti: 'Список', tx: 'молоко' }] } } });
проверить('phx разбирается тем же разбором: переписки, владелец, заметки',
  разбор.phone2 && разбор.phone2.phone.owner === 'Лена' && Object.keys(разбор.phone2.chatsMap).join() === 'Мама' && разбор.phone2.chatsMap['Мама'].messages.length === 1
  && разбор.phone.owner === 'Глеб' && Object.keys(разбор.chatsMap).join() === 'Лена', JSON.stringify(разбор.phone2));
проверить('без phx — phone2 пустой', Sc.normalizeJSONData({ sc: { T: '20:00' } }).phone2 === null);

// --- Перенос по ходам: у каждого владельца свой телефон ----------------------
const ход = (o) => ({ is_user: false, mes: 'Текст.\n[HUD]\n' + JSON.stringify({ sc: { T: '20:00', Dt: 'Пт, 01.03.2030' }, ...o }) + '\n[/HUD]' });
const сообщение = (н) => ({ getAttribute: (a) => (a === 'mesid' ? String(н) : null) });
const тГлеба = { cm: { 'Лена': { ow: 'Глеб', ms: ['Лена -> Глеб: Ты где? | 19:00 | Read'] } }, phn: { ow: 'Глеб', ct: [{ n: 'Лена' }] } };
const тЛены = { cm: { 'Мама': { ow: 'Лена', ms: ['Мама -> Лена: Позвони | 19:30 | Unread'] } }, phn: { ow: 'Лена', ct: [{ n: 'Мама' }] } };
чат.length = 0;
чат.push({ is_user: true, mes: 'привет' }, ход(тГлеба), { is_user: true, mes: 'дальше' }, ход(тЛены), { is_user: true, mes: 'ещё' }, ход(тГлеба));
const данные = (н) => Sc.normalizeJSONData(JSON.parse(чат[н].mes.split('[HUD]\n')[1].split('\n[/HUD]')[0]));
const чатыНа = (н) => Object.keys(C.mergeCarryOver(данные(н), сообщение(н)).chatsMap || {}).sort().join();
settings.phoneWhenCharAway = 'char';
проверить('«за кадром»: как раньше — переписки всех ходов вместе', чатыНа(3) === 'Лена,Мама');
settings.phoneWhenCharAway = 'present';
проверить('«того, за кем сюжет»: в телефоне Лены — только её переписки', чатыНа(3) === 'Мама', чатыНа(3));
проверить('вернулся Глеб — его переписки, без Лениных', чатыНа(5) === 'Лена', чатыНа(5));
const контактыНа = (н) => (C.mergeCarryOver(данные(н), сообщение(н)).phone.contacts || []).map(c => c.name || c['Имя']).join();
проверить('контакты тоже свои у каждого владельца', контактыНа(5) === 'Лена' && контактыНа(3) === 'Мама', контактыНа(5) + ' / ' + контактыНа(3));

// «Оба»: телефон Глеба каждый ход, второй — Лены, пока Глеба нет.
чат.length = 0;
чат.push({ is_user: true, mes: 'привет' }, ход({ ...тГлеба, phx: { ow: 'Лена', cm: { 'Мама': { ow: 'Лена', ms: ['Мама -> Лена: Позвони | 19:30 | Unread'] } } } }),
  { is_user: true, mes: 'дальше' }, ход({ ...тГлеба, phx: { ow: 'Лена', cm: { 'Подруга': { ow: 'Лена', ms: ['Подруга -> Лена: Ну что? | 19:40 | Unread'] } } } }));
settings.phoneWhenCharAway = 'both';
const оба = C.mergeCarryOver(данные(3), сообщение(3));
проверить('«оба»: второй телефон копит свои переписки по ходам, основной — свои',
  Object.keys(оба.phone2.chatsMap).sort().join() === 'Мама,Подруга' && Object.keys(оба.chatsMap).join() === 'Лена', JSON.stringify(Object.keys(оба.phone2.chatsMap)));
// Режим сменили на «того, за кем сюжет»: телефон Лены берёт и её прежний второй телефон.
чат.push({ is_user: true, mes: 'ещё' }, ход(тЛены));
settings.phoneWhenCharAway = 'present';
const послеСмены = Object.keys(C.mergeCarryOver(данные(5), сообщение(5)).chatsMap || {}).sort().join();
проверить('смена «оба» → «того, за кем сюжет»: прежний второй телефон Лены — в её телефоне, без чатов Глеба', послеСмены === 'Мама,Подруга', послеСмены);

// --- Снимок для модели --------------------------------------------------------
чат.length = 0;
чат.push({ is_user: true, mes: 'привет' }, ход(тГлеба), { is_user: true, mes: 'дальше' }, ход(тЛены));
settings.phoneWhenCharAway = 'present';
const снимок = Sn.строкаСнимка(Sn.собратьСнимок(чат[3].mes), false);
проверить('«того, за кем сюжет»: в снимке телефон Лены и телефон Глеба, каким он его оставил (phc)',
  /"phn":\{"ow":"Лена"/.test(снимок) && /"phc":\{"cm":\{"Лена"/.test(снимок), снимок);
settings.phoneWhenCharAway = 'char';
проверить('«за кадром»: phc в снимок не идёт', !Sn.строкаСнимка(Sn.собратьСнимок(чат[3].mes), false).includes('"phc"'));
const сPhx = ход({ ...тГлеба, phx: { ow: 'Лена', cm: { 'Мама': { ow: 'Лена', ms: ['Мама -> Лена: 1 | 18:00', 'Мама -> Лена: 2 | 18:01', 'Мама -> Лена: 3 | 18:02', 'Мама -> Лена: 4 | 18:03', 'Мама -> Лена: 5 | 18:04', 'Мама -> Лена: 6 | 18:05', 'Мама -> Лена: 7 | 18:06', 'Мама -> Лена: 8 | 18:07'] } } } }).mes;
проверить('«за кадром»: старый phx из снимка убирается', !Sn.строкаСнимка(Sn.собратьСнимок(сPhx), false).includes('"phx"'));
settings.phoneWhenCharAway = 'both';
const снимокОба = Sn.строкаСнимка(Sn.собратьСнимок(сPhx), false);
const хвост = (снимокОба.match(/Мама -> Лена: \d/g) || []).length;
проверить('«оба»: phx в снимке, переписки — хвостом, как у основного телефона', снимокОба.includes('"phx":{"ow":"Лена"') && хвост > 0 && хвост < 8, снимокОба);
проверить('легенда снимка объясняет phx и phc', Sn.легендаСнимка(снимокОба).includes('second phone') && Sn.легендаСнимка(снимок).includes("{{char}}'s own phone as it was left"));

settings.phoneWhenCharAway = было ?? 'char';
console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
