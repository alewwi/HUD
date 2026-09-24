// hud-manager/tests/prompt-nsfw.mjs
//
// Инструкция модели: вне сцены в ней нет ни одного интимного поля и слова
// (кроме заглушки SS, по которой модель отмечает начало сцены), во время и
// после сцены — есть. Решение «включать ли» — по последнему HUD и последним
// сообщениям. Без модели: node tests/prompt-nsfw.mjs
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
globalThis.SillyTavern = { getContext: () => ({ chat: чат, chatMetadata: {}, name1: 'Софи', name2: 'Тристан' }) };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const src = fs.readFileSync(ROOT + 'index.js', 'utf8');
const TMP = ROOT + '__nsfw-tmp.js';
fs.writeFileSync(TMP, src.replace('  function buildDynamicPrompt(', '  globalThis.__prompt = (o) => buildDynamicPrompt(o);\n  function buildDynamicPrompt('));
try { await import('file:///' + TMP + '?v=' + v + '&t=' + Date.now()); } finally { fs.unlinkSync(TMP); }
const Sn = await import('file:///' + ROOT + 'hud-snapshot.js?v=' + v);
const S = await import('file:///' + ROOT + 'settings.js?v=' + v);
Object.assign(S.settings, { enableMemory: true, enablePhone: true, enableIntercepts: true, enableDiary: true, enableDreams: true, enableWorld: true, enableUserBlock: true });
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 400)); } else console.log('✓', что); };

const без = globalThis.__prompt({ nsfw: false });
const с = globalThis.__prompt({ nsfw: true });
// Коды полей близости не должны встречаться ключами схемы.
const коды = ['SxL', 'SxC', 'SxR', 'SxV', 'SS', 'Pos', 'Rnd', 'Dur', 'Prt', 'Org', 'Vit', 'Snd', 'BM', 'W', 'Kn', 'Ft', 'NG', 'NT', 'ND', 'AC', 'UW', 'bd'];
const ключи = (p) => коды.filter(к => new RegExp('"' + к + '":').test(p));
// SS остаётся заглушкой: «пусто; если близость начинается в этом ответе — фаза». По ней
// со следующего хода включается полная часть.
проверить('без сцены: из полей близости только заглушка SS', ключи(без).join() === 'SS' && без.includes(`"SS": "[scene state: 'empty'`), ключи(без).join(' '));
проверить('во время сцены: все поля близости на месте', ключи(с).length === коды.length, коды.filter(к => !ключи(с).includes(к)).join(' '));
const слова = /\b(sex|sexual|orgasm|arous|penis|vagina|nipple|breast|semen|kink|fetish|hickey|climax|foreplay|aftercare|intimacy|intimate|erection|wetness|moan|thrust)\w*/gi;
const безЗаглушки = без.replace(/"SS": "[^"]*"/, '').replace(/baby.s sex/g, '');
const найдено = [...new Set((безЗаглушки.match(слова) || []).map(x => x.toLowerCase()))];
проверить('без сцены: в тексте инструкции нет интимных слов', !найдено.length, найдено.join(' '));
проверить('с близостью инструкция длиннее', с.length > без.length + 3000, без.length + ' / ' + с.length);

// Решение: когда включать.
S.settings.nsfwPrompt = 'auto';
const hud = (cs, us) => ({ sc: { T: '10:00' }, cs, us });
проверить('обычный ход без слов — выключено', !Sn.решитьNSFW(hud([{ N: 'Лилиан', Th: 'Пора домой' }]), ['Они пили чай.', 'Я улыбнулась.']));
проверить('в последнем HUD идёт сцена — включено', Sn.решитьNSFW(hud([{ N: 'Лилиан', SS: '2 — act', W: 'ar: сильное' }]), []));
проверить('после сцены (забота, отзыв) — включено', Sn.решитьNSFW(hud([{ N: 'Лилиан', SS: '3 — aftercare', ND: 'se: всё ещё дрожит', AC: 'обнять' }]), []));
проверить('сцена закончилась, фаза 1 (empty) — выключено', !Sn.решитьNSFW(hud([{ N: 'Лилиан', SS: 'empty', W: 'empty', ND: 'empty', Kn: 'Связывание: охотно' }]), ['Утро. Кофе.']));
проверить('устойчивые черты (кинки, последний секс) сами не включают', !Sn.решитьNSFW(hud([{ N: 'Лилиан', Kn: 'Связывание: охотно', SxL: 'dt: вчера' }]), ['Утро.']));
проверить('сцена начинается по словам игрока — включено', Sn.решитьNSFW(hud([{ N: 'Лилиан' }]), ['Я стянула с него рубашку и поцеловала, он застонал, возбуждённый']));
проверить('одно слабое слово («голая» в ванной) — выключено', !Sn.решитьNSFW(hud([{ N: 'Лилиан' }]), ['Она голая вышла из душа за полотенцем.']));
проверить('UW у игрока — включено', Sn.решитьNSFW(hud([{ N: 'Лилиан' }], { UW: 'ar: сильное' }), []));
проверить('фаза «1 — empty» и «0: empty» — не сцена (чат THE REGENTS)', !Sn.решитьNSFW(hud([{ N: 'Эванджелин', SS: '1 — empty', Rnd: '0', Org: '0: empty', Vit: 'hr: 118' }]), ['Утро.']));
проверить('фаза «2 — act» — сцена', Sn.решитьNSFW(hud([{ N: 'Эванджелин', SS: '2 — act' }]), []));
проверить('«соскользнула», «обнажённая правда», «один толчок» — не близость', !Sn.решитьNSFW(hud([{ N: 'Лейла' }]), ['Сумка соскользнула лямкой с плеча. Была лишь страшная, обнаженная правда. Один толчок — и она рассыплется.']));
проверить('«соски» и «толчками» вместе — близость', Sn.решитьNSFW(hud([{ N: 'Лейла' }]), ['Он двигался толчками, пальцы сжали её соски.']));
S.settings.nsfwPrompt = 'never';
проверить('настройка «никогда» — выключено даже в сцене', !Sn.решитьNSFW(hud([{ N: 'Лилиан', SS: '2 — act' }]), []));
S.settings.nsfwPrompt = 'auto';

// Снимок прошлого HUD в инструкции тоже без интимных полей.
const снимок = { sc: { T: '10:00' }, cs: [{ N: 'Лилиан', Th: 'Пора', Kn: 'Связывание', SxL: 'dt: вчера', Prt: 'pill' }], us: { A: '26', UW: 'ar' }, bd: [{ au: 'Лилиан', tx: 'тело' }] };
const строка = Sn.строкаСнимка(снимок, false);
проверить('снимок без сцены: без Kn, SxL, Prt, UW и дневника тела', !/"(Kn|SxL|Prt|UW|bd)"/.test(строка), строка);
проверить('снимок в сцене: интимные поля остаются', /"Kn"/.test(Sn.строкаСнимка(снимок, true)));

// Скрытые факты зачатия — независимо от сцены. Вне сцены они не должны говорить о сексе.
const хвост = без.slice(без.lastIndexOf('[/HUD]'));
const слова2 = [...new Set((хвост.match(слова) || []).map(x => x.toLowerCase()))];
проверить('хвост инструкции вне сцены (факты зачатия) без интимных слов', !слова2.length, слова2.join(' ') + ' :: ' + хвост.slice(0, 300));
console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
if (провалов) process.exitCode = 1;
