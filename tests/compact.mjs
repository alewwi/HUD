// hud-manager/tests/compact.mjs
//
// «HUD одной строкой» и «Сжатые значения» (Настройки → Генерация):
// — промт просит JSON в одну строку, схема остаётся по полю на строку;
// — HUD одной строкой разбирается так же, как с отступами, и чинится так же;
// — всё, что пишет HUD обратно в сообщение, оставляет его одной строкой;
// — сжатие ставит размер у отмеченных полей (и у тех же полей игрока),
//   правки размеров из «Глубокой настройки» чистятся и сохраняются.
// node tests/compact.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/') + '/';
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, set innerHTML(x) { t = String(x); }, get innerHTML() { return t; }, set textContent(x) { t = String(x); }, get textContent() { return t; }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], appendChild() {}, setAttribute() {}, getAttribute: () => null, addEventListener() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, documentElement: узел(), body: узел(), addEventListener() {}, head: узел() };
globalThis.SillyTavern = { getContext: () => ({ chat: [], chatMetadata: {}, name1: 'Ида', name2: 'Тео', eventSource: { on() {} }, eventTypes: {} }) };
console.info = () => {}; console.warn = () => {}; console.debug = () => {};
const v = JSON.parse(fs.readFileSync(ROOT + 'manifest.json', 'utf8')).version;
const м = (ф) => import('file:///' + ROOT + ф + '?v=' + v);

let всего = 0, провалов = 0;
const проверить = (что, ок, подробно = '') => { всего++; if (!ок) { провалов++; console.log('✗', что, подробно ? '— ' + String(подробно).slice(0, 300) : ''); } else console.log('✓', что); };
const равны = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const { settings } = await м('settings.js');
const P = await м('prompt.js');
P.подключить({ сверитьРоды() {}, последнийСнимокОбъект: () => ({}), последнийHUDКакЕсть: () => null });
const C = await м('compact-fields.js');
const { parseHUDComplex, repairGeneratedHudBlock } = await м('hud-parser.js');
const { jsonКакБыло, блокКакБыл, hudБлоки } = await м('hud-block.js');
const { блокHUD, развернутьКраткое } = await м('hud-expand.js');
const { вставитьТелефон } = await м('phone-regen.js');
const { ПРИМЕР_HUD } = await м('render/sample-hud.js');
Object.assign(settings, { enableMemory: true, enablePhone: true, enableDiary: true, enableDreams: true, enableWorld: true, enableUserBlock: true, showComments: true });

// --- Промт: одна строка ---------------------------------------------------------
const промт = () => P.buildDynamicPrompt({ nsfw: true });
проверить('по умолчанию HUD одной строкой включён', settings.hudOneLine === true);
let p = промт();
проверить('промт просит JSON в одну строку и \\n внутри текста', p.includes('Write the JSON on ONE line') && p.includes('is written as \\n.'));
проверить('схема в промте по-прежнему по полю на строку', /\n {3}"Th": "\[/.test(p) && /\n {2}"lg": \[/.test(p));
проверить('правило — в задаче, до правил', p.indexOf('ONE line') < p.indexOf('## 📐 RULES'));
const тел = P.промптТелефона(p);
проверить('перегенерация телефона тоже просит одну строку', !тел || тел.includes('Write the JSON on ONE line'));
settings.hudOneLine = false;
p = промт();
проверить('выключено — просьбы одной строки нет', !p.includes('ONE line'));
settings.hudOneLine = true;
проверить('перегенерация HUD тоже просит одну строку', P.buildDynamicPrompt({ nsfw: true, режим: 'regen' }).includes('Write the JSON on ONE line'));

// --- Разбор: одна строка = с отступами --------------------------------------------
const блок = (json) => '[HUD]\n```json\n' + json + '\n```\n[/HUD]';
const красиво = блок(JSON.stringify(ПРИМЕР_HUD, null, 1));
const строкой = блок(JSON.stringify(ПРИМЕР_HUD));
проверить('пример HUD одной строкой разбирается так же, как с отступами', равны(parseHUDComplex(строкой), parseHUDComplex(красиво)));
проверить('и без обёртки ```json', равны(parseHUDComplex('[HUD]' + JSON.stringify(ПРИМЕР_HUD) + '[/HUD]'), parseHUDComplex(красиво)));
проверить('и в одной строке с текстом ответа', равны(parseHUDComplex('Она кивнула. [HUD]' + JSON.stringify(ПРИМЕР_HUD) + '[/HUD]'), parseHUDComplex(красиво)));

// --- Починка кривого JSON в одну строку -------------------------------------------
const образец = { sc: { T: '21:40 | вечер', Wt: 'дождь, +6°C', Md: 'тревога' }, cs: [{ N: 'Ида', Th: 'Он опять опоздал', K: '😟 Тео; 🕯 свеча', L: 'кухня' }, { N: 'Тео', Th: 'Только бы не спросила', L: 'прихожая' }] };
const кривые = [
  ['пропущена запятая между полями', '{"sc": {"T": "21:40 | вечер" "Wt": "дождь, +6°C", "Md": "тревога"}, "cs": [{"N": "Ида", "Th": "Он опять опоздал", "K": "😟 Тео; 🕯 свеча", "L": "кухня"}, {"N": "Тео", "Th": "Только бы не спросила", "L": "прихожая"}]}'],
  ['лишняя запятая в конце', '{"sc": {"T": "21:40 | вечер", "Wt": "дождь, +6°C", "Md": "тревога",}, "cs": [{"N": "Ида", "Th": "Он опять опоздал", "K": "😟 Тео; 🕯 свеча", "L": "кухня"}, {"N": "Тео", "Th": "Только бы не спросила", "L": "прихожая"},]}'],
  ['пропущена запятая между персонажами', '{"sc": {"T": "21:40 | вечер", "Wt": "дождь, +6°C", "Md": "тревога"}, "cs": [{"N": "Ида", "Th": "Он опять опоздал", "K": "😟 Тео; 🕯 свеча", "L": "кухня"} {"N": "Тео", "Th": "Только бы не спросила", "L": "прихожая"}]}'],
  ['оборвался конец', '{"sc": {"T": "21:40 | вечер", "Wt": "дождь, +6°C", "Md": "тревога"}, "cs": [{"N": "Ида", "Th": "Он опять опоздал", "K": "😟 Тео; 🕯 свеча", "L": "кухня"}, {"N": "Тео", "Th": "Только бы не спросила", "L": "прихожая"'],
];
// JSON внутри блока, без обёртки ```json.
const внутри = (б) => hudБлоки(б)[0].inner.replace(/```(?:json)?/g, '').trim();
const цельный = parseHUDComplex(блок(JSON.stringify(образец)));
// Та же ошибка в HUD с переносами: «, » между токенами → «,\n  ».
const сПереносами = (json) => json.replace(/, (?=["{])/g, ',\n  ').replace(/\{"/g, '{\n  "');
for (const [что, json] of кривые) {
  let ок = false, подробно = '';
  try {
    const исправлено = repairGeneratedHudBlock(блок(json));
    const р = parseHUDComplex(исправлено);
    ок = равны(р.scene, цельный.scene) && р.characters.length === 2 && равны(р.characters.map(c => c['Мысли']), цельный.characters.map(c => c['Мысли'])) && !/\n/.test(внутри(исправлено));
    подробно = JSON.stringify(р.scene) + ' ' + JSON.stringify(р.characters.map(c => c['Имя'] + ':' + c['Мысли']));
    if (ок) {
      let м = null; try { м = parseHUDComplex(repairGeneratedHudBlock(блок(сПереносами(json)))); } catch (_) {}
      ок = !!м && равны(м, р);
      if (!ок) подробно = 'с переносами разобралось иначе';
    }
  } catch (e) { подробно = e.message; }
  проверить('починка одной строки: ' + что + ' — как с переносами, и осталась одной строкой', ок, подробно);
}
{
  const кавычка = '{"sc": {"T": "21:40 | вечер", "Wt": "дождь, +6°C", "Md": "тревога"}, "cs": [{"N": "Ида", "Th": "Он сказал "потом" и ушёл", "L": "кухня"}]}';
  let th = '';
  try { th = parseHUDComplex(repairGeneratedHudBlock(блок(кавычка))).characters?.[0]?.['Мысли'] || ''; } catch (e) { th = e.message; }
  проверить('починка одной строки: прямые кавычки внутри текста', /потом/.test(th) && /ушёл/.test(th), th);
}
{
  const перенос = '{"sc": {"T": "21:40 | вечер", "Wt": "дождь", "Md": "тревога"}, "cs": [{"N": "Ида", "Th": "Первая мысль.\nВторая.", "L": "кухня"}]}';
  let th = '';
  try { th = parseHUDComplex(repairGeneratedHudBlock(блок(перенос))).characters?.[0]?.['Мысли'] || ''; } catch (e) { th = e.message; }
  проверить('сырой перенос строки внутри текста не ломает одну строку', /Первая мысль/.test(th) && /Вторая/.test(th), th);
}

// --- Запись обратно: вид как у модели -------------------------------------------
проверить('jsonКакБыло: одна строка остаётся одной строкой', jsonКакБыло({ a: 1, b: [2] }, строкой) === '{"a":1,"b":[2]}');
проверить('jsonКакБыло: отступ 1 остаётся отступом 1', jsonКакБыло({ a: 1 }, красиво) === '{\n "a": 1\n}');
проверить('jsonКакБыло: отступ 2 остаётся отступом 2', jsonКакБыло({ a: 1 }, блок('{\n  "x": 1\n}')) === '{\n  "a": 1\n}');
проверить('jsonКакБыло: без образца — запасной отступ', jsonКакБыло({ a: 1 }, '', 2) === '{\n  "a": 1\n}');
проверить('починка ровного HUD одной строкой — одной строкой', !/\n/.test(внутри(repairGeneratedHudBlock(строкой))));
проверить('починка HUD с отступами сохраняет отступы', /\n {1,2}"/.test(repairGeneratedHudBlock(красиво)));
проверить('разворот «nc»: блок HUD одной строкой — одной строкой', !/\n/.test(внутри(блокHUD({ sc: { T: '09:00' } }, строкой))));
проверить('разворот «nc»: прежний с отступом — с отступом', /\n "sc"/.test(блокHUD({ sc: { T: '09:00' } }, красиво)));
{
  // «nc» в HUD одной строкой разворачивается из прошлого хода.
  const прошлый = { sc: { T: '20:00' }, cs: [{ N: 'Ида', Ap: 'Ж, 168 см, тёмные волосы', C: 'плащ' }] };
  const новый = JSON.parse('{"sc":{"T":"21:00"},"cs":[{"N":"Ида","Ap":"nc","C":"плащ, мокрый"}]}');
  развернутьКраткое(новый, [прошлый]);
  проверить('«nc» в HUD одной строкой разворачивается', новый.cs[0].Ap === 'Ж, 168 см, тёмные волосы', JSON.stringify(новый));
}
{
  const сТелефоном = вставитьТелефон(строкой, { phn: { ow: 'Ида', ct: ['Тео'] } });
  const json = внутри(сТелефоном);
  let ок = false; try { ок = JSON.parse(json).phn.ow === 'Ида'; } catch (_) {}
  проверить('телефон в HUD одной строкой — одной строкой и разбирается', ок && !/\n/.test(json), json.slice(0, 200));
  const безТелефона = вставитьТелефон(блок('{"sc":{"T":"09:00"}}'), { phn: { ow: 'Тео' } });
  let ок2 = false; try { ок2 = JSON.parse(внутри(безТелефона)).phn.ow === 'Тео'; } catch (_) {}
  проверить('телефон, которого не было, дописывается в одну строку', ок2 && !/\n/.test(внутри(безТелефона)), безТелефона);
}
{
  const ис = (ф) => fs.readFileSync(ROOT + ф, 'utf8');
  проверить('правка ✎ и перегенерация пишут HUD тем же видом', ис('index.js').includes('блокКакБыл(hud, extractHudBlock(текст))') && ис('regen.js').includes('блокКакБыл(вКодах, newHudText)'));
  проверить('нигде HUD не пишется с жёстким отступом 2', !/'\[HUD\]\\n```json\\n' \+ JSON\.stringify\([^)]*, null, 2\)/.test(ис('index.js') + ис('regen.js') + ис('hud-parser.js')));
}

// --- Сжатые значения ---------------------------------------------------------------
settings.hudCompact = false;
p = промт();
проверить('сжатие выключено — меток размера нет', !p.includes('LIMIT:') && !p.includes('COMPACT VALUES'));
settings.hudCompact = true; settings.compactOff = []; settings.compactLimits = {};
p = промт();
const строкаПоля = (текст, раздел, код) => { const i = текст.indexOf(`\n "${раздел}": `); const j = текст.indexOf(`"${код}":`, i); return текст.slice(j, текст.indexOf('\n', j)); };
проверить('мысли персонажа: «не больше 15 слов» в описании поля', /LIMIT: at most 15 words\]",?$/.test(строкаПоля(p, 'cs', 'Th')), строкаПоля(p, 'cs', 'Th'));
проверить('ключевые мысли: пункты и слова', строкаПоля(p, 'cs', 'K').includes('LIMIT: at most 3 items, 6 words each'));
проверить('отношения: число людей не ограничено, только длина', строкаПоля(p, 'cs', 'Rl').includes('LIMIT: at most 8 words per item, as many items as without a limit'));
проверить('у игрока — те же размеры', строкаПоля(p, 'us', 'Rl').includes('LIMIT: at most 8 words per item, as many items as without a limit'));
проверить('журнал дня — в описании списка, а не в образце', /"lg": \["\[HH:MM\] - \[an event of today\]", "log:[^"]*LIMIT: at most 5 items, 10 words each"\]/.test(p), строкаПоля(p, 'me', 'lg'));
проверить('дневник — до 80 слов', строкаПоля(p, 'dy', 'tx').includes('LIMIT: at most 80 words'));
проверить('правило о размерах — одно, после FORMATTING', (p.match(/COMPACT VALUES/g) || []).length === 1 && p.indexOf('COMPACT VALUES') > p.indexOf('⚠️ FORMATTING'));
проверить('схема с метками — всё ещё JSON-подобна: строки полей целы', !/LIMIT[^\n]*LIMIT/.test(p) && (p.match(/LIMIT:/g) || []).length > 40);
settings.compactOff = ['cs.Th'];
p = промт();
проверить('снятая галочка — поле без размера', !строкаПоля(p, 'cs', 'Th').includes('LIMIT') && строкаПоля(p, 'cs', 'K').includes('LIMIT'));
settings.compactOff = [];
settings.compactLimits = { 'cs.Th': { w: 7 }, 'cs.K': { i: 0, w: 4 } };
p = промт();
проверить('свой размер из «Глубокой настройки» уходит в промт', строкаПоля(p, 'cs', 'Th').includes('at most 7 words') && строкаПоля(p, 'cs', 'K').includes('at most 4 words per item, as many items as without a limit'));
settings.fieldsOff = ['cs.Th'];
p = промт();
проверить('поле, выключенное глубокой настройкой блоков, не появляется ради размера', !/\n {3}"Th":/.test(p.slice(p.indexOf('\n "cs": ['), p.indexOf('\n "us": {'))));
settings.fieldsOff = [];
settings.enableDiary = false;
проверить('блок выключен — его полей нет, промт собирается', !промт().includes('"tx": "[text: a real diary'));
settings.enableDiary = true;

проверить('лимит: кривые значения не ломают промт', равны(C.лимитПоля({ compactLimits: { 'cs.Th': { w: 'abc' } } }, 'cs.Th'), { w: 15 }) && C.лимитПоля({ compactLimits: { 'cs.Th': { w: 99999 } } }, 'cs.Th').w === C.МАКС_СЛОВ && C.лимитПоля({ compactLimits: { 'cs.K': { i: -5 } } }, 'cs.K').i === 0);
проверить('сохраняется только отличие от встроенного', равны(C.очиститьЛимиты({ 'cs.Th': { w: '15' }, 'cs.K': { i: '3', w: '9' }, 'xx.Q': { w: 3 }, 'cs.D': { w: '' } }), { 'cs.K': { w: 9 } }));
проверить('у текстового поля нет числа пунктов', !('i' in C.лимитПоля({ compactLimits: { 'cs.Th': { i: 4, w: 9 } } }, 'cs.Th')));
проверить('подписи размеров', C.подписьЛимита({ w: 15 }) === 'до 15 слов' && C.подписьЛимита({ i: 3, w: 6 }) === 'до 3 пунктов по 6 слов' && C.подписьЛимита({ i: 0, w: 8 }) === 'все пункты, по 8 слов');
проверить('каждое поле каталога находится в полной схеме', (() => { settings.compactOff = []; settings.compactLimits = {}; const текст = промт(); const нет = C.ПУТИ_СЖАТИЯ.filter(путь => { const [р, к] = путь.split('.'); const i = текст.indexOf(`\n "${р}": `); if (i < 0) return false; const j = текст.indexOf(`"${к}":`, i); return j < 0 || !текст.slice(j, текст.indexOf('\n', j)).includes('LIMIT'); }); if (нет.length) console.log('   без размера:', нет.join(', ')); return !нет.length; })());
// Короче, а не беднее: то, что HUD ведёт из хода в ход, не теряется.
проверить('списки, которые HUD ведёт, — без потолка пунктов', ['cs.I', 'cs.S', 'cs.Fl', 'cs.Mm', 'cs.Mrk', 'cs.Fr', 'cs.Rl', 'cs.BM', 'cs.Kn', 'cs.Ft', 'cs.NG', 'cs.NT', 'me.fct', 'me.gun', 'me.prm'].every(путь => C.лимитПоУмолчанию(путь).i === 0));
проверить('поля с метками вмещают все метки: Ex (xp, gt), G (nw, sn, lt), X (wy, dys, sg), SxL (dt, pr, ak, en)', C.лимитПоУмолчанию('cs.Ex').w >= 16 && C.лимитПоУмолчанию('cs.G').w >= 18 && !('i' in C.лимитПоУмолчанию('cs.G')) && C.лимитПоУмолчанию('cs.X').w >= 12 && C.лимитПоУмолчанию('cs.SxL').w >= 40);
{
  settings.hudCompact = true;
  const п = промт();
  проверить('правило: сохранять факты, метки, числа, сроки, защиту; метки и числа — не слова', /Shorter, never poorer/.test(п) && /fade time/.test(п) && /protection/.test(п) && /do not count as words/.test(п) && /never fewer facts, threads, promises, plans, appointments/.test(п) && /only shortens what you do write/.test(п));
  проверить('у следов на теле — все пункты и размер', строкаПоля(п, 'cs', 'Mrk').includes('as many items as without a limit'));
  const { чегоНеХватает } = await м('hud-check.js');
  const короткий = (tx) => блок(JSON.stringify({ sc: { T: '09:00' }, cs: [{ N: 'Ида', Th: 'мысль', Ex: 'xp: а; gt: б' }], dy: [{ au: 'Ида', tm: '09:00', tx }] }));
  const тридцать = 'Сегодня он опять пришёл поздно и молчал за ужином. Я не спросила, где он был, и теперь жалею об этом.';
  const было = settings.enableDiary; settings.enableDiary = true;
  settings.compactLimits = { 'dy.tx': { w: 30 } };
  проверить('сжатый дневник в 30 слов — не «слишком короткий»', !чегоНеХватает(короткий(тридцать)).some(x => /короткий/.test(x)));
  проверить('но заметка в одну фразу — всё ещё «слишком короткий»', чегоНеХватает(короткий('Устала.')).some(x => /короткий/.test(x)));
  settings.hudCompact = false;
  проверить('без сжатия порог прежний', чегоНеХватает(короткий(тридцать)).some(x => /короткий/.test(x)));
  settings.compactLimits = {}; settings.enableDiary = было;
}
{
  // Модель прислала цели объектом — вид поля не пишет «[object Object]».
  const VF = await м('render/views-fields.js');
  const html = VF.видПоля('цели', { nw: 'помириться с Идой', sn: 'починить кран', lt: 'выплатить долг' }, 'ladder');
  проверить('вид поля: объект вместо строки разворачивается', !html.includes('[object Object]') && /починить кран/i.test(html) && /выплатить долг/i.test(html) && /Сейчас/.test(html), html.slice(0, 200));
}
settings.hudCompact = false;
const су = fs.readFileSync(ROOT + 'settings-ui.js', 'utf8');
проверить('настройки: одна строка, сжатие и размеры — в «Генерации»', (() => { const i = су.indexOf("группа('🤖 Генерация'"), j = су.indexOf("группа('📚 Лорбуки'"); const г = су.slice(i, j); return г.includes("'hud-one-line'") && г.includes('разметкаСжатия()') && г.includes('разметкаРазмеров()'); })());
const сд = fs.readFileSync(ROOT + 'settings-deep.js', 'utf8');
проверить('«Глубокая настройка» размеров: «Сохранить» и «По умолчанию»', /id="hud-sizes-save"[^>]*>Сохранить/.test(сд) && /id="hud-sizes-default"[^>]*>По умолчанию/.test(сд));

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
