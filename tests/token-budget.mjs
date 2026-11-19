// hud-manager/tests/token-budget.mjs
//
// Экономия токенов: замер того, что модель написала до разворота «nc»
// (token-budget.js, запомнитьСырой / медианаСырого), и свежие поля в снимке
// прошлого HUD — метка вместо прошлого текста. Без модели: node tests/token-budget.mjs
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
const Б = await import('file:///' + ROOT + 'token-budget.js?v=' + v);
const Sn = await import('file:///' + ROOT + 'hud-snapshot.js?v=' + v);
const S = await import('file:///' + ROOT + 'settings.js?v=' + v);
Object.assign(S.settings, { enableBabies: true, enableUserBlock: true });
let проб = 0, провалов = 0;
const проверить = (что, ок, подр = '') => { проб++; if (!ок) { провалов++; console.log('✗', что, String(подр).slice(0, 400)); } else console.log('✓', что); };
const блок = (о) => '[HUD]\n```json\n' + JSON.stringify({ sc: { T: '10:00' }, ...о }) + '\n```\n[/HUD]';

// --- Сырой ответ ---------------------------------------------------------------
const короткий = блок({ cs: [{ N: 'Марк', Ap: 'nc', C: 'nc' }] });
const полный = блок({ cs: [{ N: 'Марк', Ap: 'М, 186 см, широкие плечи, тёмные волосы до плеч, серые глаза, шрам на брови', C: 'чёрная рубашка, джинсы, ботинки' }] });
const ответ = (текст) => ({ is_user: false, mes: 'Проза ответа.\n\n' + текст, swipes: ['Проза ответа.\n\n' + текст], swipe_id: 0, swipe_info: [{}] });
const м = ответ(полный);
Б.запомнитьСырой(м, короткий, полный);
проверить('сырой и полный размеры записаны в extra сообщения и его свайпа', м.extra.hud_raw.r > 0 && м.extra.hud_raw.f > м.extra.hud_raw.r && м.swipe_info[0].extra.hud_raw.r === м.extra.hud_raw.r, JSON.stringify(м.extra));
const чат = [{ is_user: true, mes: 'Привет' }, м];
const мед = Б.медианаСырого(чат);
проверить('медиана сырого: столько написала модель, столько легло в сообщение', мед && мед.сырой === м.extra.hud_raw.r && мед.полный === м.extra.hud_raw.f && мед.ходов === 1, JSON.stringify(мед));
// Правка блока после разворота: запись больше не про этот HUD.
const правленый = ответ(полный.replace('джинсы', 'брюки со стрелками, начищенные туфли'));
правленый.extra = { hud_raw: { ...м.extra.hud_raw } };
проверить('блок изменился после записи — запись не считается', Б.медианаСырого([правленый]) === null);
проверить('ответов без записи нет — null, панель показывает развёрнутую медиану', Б.медианаСырого([ответ(полный)]) === null);
const разметка = Б.разметкаБюджета({ инструкция: { разделы: [], основа: 100, всего: 100 }, запрос: 100, снимок: 0, ответ: 500, сырой: { сырой: 120, полный: 500, ходов: 3 } });
проверить('панель: «столько модель пишет на самом деле» и «после разворота»', разметка.includes('столько модель пишет на самом деле') && разметка.includes('после разворота') && разметка.includes('≈120') && разметка.includes('≈500'));
проверить('панель без записи — развёрнутая медиана с пометкой', Б.разметкаБюджета({ инструкция: { разделы: [], основа: 100, всего: 100 }, запрос: 100, снимок: 0, ответ: 500, сырой: null }).includes('уже развёрнутых'));

// --- Снимок: свежие поля -------------------------------------------------------
const снимок = Sn.собратьСнимок(блок({
  cs: [{ N: 'Марк', K: '🔥 злость на брата; 💭 письмо в кармане; ⏳ поезд в шесть', Th: 'Только бы не заметила', Rl: 'Вера: сестра, любит' }],
  bb: [{ N: 'Ася', Th: 'Тепло и мамин голос', K: '☀️ свет из окна; 🧸 мишка', B: 'сонная' }, { N: 'Лёва', B: 'спит' }],
}));
const строка = Sn.строкаСнимка(снимок, false);
const о = JSON.parse(строка);
проверить('K персонажа — метка «<new this turn>», прошлого текста нет', о.cs[0].K === Sn.МЕТКА_НОВОГО && !строка.includes('письмо в кармане'), строка);
проверить('медленные поля (Rl) остаются как были', о.cs[0].Rl === 'Вера: сестра, любит');
проверить('у малыша Th и K — метки, состояние B остаётся', о.bb[0].Th === Sn.МЕТКА_НОВОГО && о.bb[0].K === Sn.МЕТКА_НОВОГО && о.bb[0].B === 'сонная' && !строка.includes('мишка'), JSON.stringify(о.bb));
проверить('малышу без мыслей метку не ставим', !('Th' in о.bb[1]) && !('K' in о.bb[1]), JSON.stringify(о.bb[1]));

console.log(`\nпроверок: ${проб}, провалов: ${провалов}`);
if (провалов) process.exitCode = 1;
