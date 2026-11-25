// hud-manager/tests/settings-sync.mjs
//
// Настройки между устройствами (settings-sync.js): у каждого ключа своё время
// правки, при слиянии побеждает более поздняя; старая вкладка не затирает
// чужие правки; виды чатов сливаются по чатам; вид открытого чата не
// переносится; большие картинки остаются на своём устройстве.
// node tests/settings-sync.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
const С = await import('file:///' + path.join(КОРЕНЬ, 'settings-sync.js').replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);

let всего = 0, провалов = 0;
const проверить = (что, ок, подробно = '') => { всего++; if (!ок) { провалов++; console.log('✗', что, подробно); } else console.log('✓', что); };

// Два устройства с одинаковыми настройками.
const база = () => ({ savedAt: 100, theme: 'noir', prompt: 'A', limit: 5, list: [1, 2], chatLooks: {}, chatLooksGone: {} });
const пк = база(), тел = база();
const прошлыеПК = new Map(), прошлыеТел = new Map();
С.запомнитьВсе(пк, прошлыеПК); С.запомнитьВсе(тел, прошлыеТел);

проверить('без правок ничего не отмечено', С.отметитьИзменения(пк, прошлыеПК, 200).length === 0 && !Object.keys(пк.keyTimes).length);

// ПК меняет промпт, телефон (старая вкладка) — лимит.
пк.prompt = 'B'; const измПК = С.отметитьИзменения(пк, прошлыеПК, 300); пк.savedAt = 300;
тел.limit = 9; С.отметитьИзменения(тел, прошлыеТел, 400); тел.savedAt = 400;
проверить('правка отмечена временем', измПК.join() === 'prompt' && пк.keyTimes.prompt === 300);

// Общий файл: сначала ПК.
const файл = structuredClone(пк);
// Телефон сливается с файлом: забирает промпт ПК, свой лимит оставляет.
let р = С.слить(тел, файл);
проверить('старая вкладка забирает чужую правку', тел.prompt === 'B' && р.пришло.includes('prompt'));
проверить('и не теряет свою', тел.limit === 9 && р.ушло.includes('limit'));
проверить('чужое значение не перетирает своё более позднее', тел.keyTimes.limit === 400 && тел.keyTimes.prompt === 300);
// ПК сливается с тем, что записал телефон.
р = С.слить(пк, structuredClone(тел));
проверить('ПК получает лимит телефона и сохраняет свой промпт', пк.limit === 9 && пк.prompt === 'B' && р.пришло.join() === 'limit' && !р.ушло.length);

// Позже ПК снова меняет лимит — старое значение телефона его не вернёт.
пк.limit = 3; С.отметитьИзменения(пк, прошлыеПК, 500);
р = С.слить(пк, structuredClone(тел));
проверить('более поздняя правка побеждает', пк.limit === 3 && р.ушло.includes('limit'));

const послеЗагрузки = С.приЗагрузке({ savedAt: 50, enablePhone: false, keyTimes: { enablePhone: 50 }, bg: 'data:local' },
  { savedAt: 100, enablePhone: true, enableMemory: false, keyTimes: { enablePhone: 20, enableMemory: 100 }, localOnly: ['bg'] });
проверить('загрузка сохраняет обе правки и локальную картинку', послеЗагрузки.отправить && послеЗагрузки.выбранные.enablePhone === false && послеЗагрузки.выбранные.enableMemory === false && послеЗагрузки.выбранные.bg === 'data:local');

const отстаёт = { enableMemory: true, keyTimes: { enableMemory: 900 } };
const до = structuredClone(отстаёт), след = new Map();
С.запомнитьВсе(отстаёт, след);
отстаёт.enableMemory = false;
С.отметитьИзменения(отстаёт, след, 500);
С.слить(отстаёт, до);
проверить('правка после синхронизации переживает отстающие часы', отстаёт.enableMemory === false);

// Без времени у обоих — как раньше: у копии, сохранённой позже, но ключ не удаляется.
const а = { savedAt: 10, x: 1, y: 'старое', своё: 7 }, б = { savedAt: 20, x: 2, y: 'новое' };
р = С.слить(а, б);
проверить('без времени правки — у копии, сохранённой позже', а.x === 2 && а.y === 'новое');
проверить('ключ, которого в чужой копии нет, не удаляется', а.своё === 7 && р.ушло.includes('своё'));

// Удалённый ключ: удаляется, если его убрали позже.
const в = { savedAt: 1, keyTimes: { tmp: 5 }, tmp: 'x' }, г = { savedAt: 2, keyTimes: { tmp: 9 } };
С.слить(в, г);
проверить('ключ, убранный позже, удаляется', !('tmp' in в));

// Большие картинки устройства: в его копии их нет, своя картинка остаётся.
const д = { savedAt: 1, bg: 'data:image/png;base64,AAAA' }, е = { savedAt: 5, keyTimes: { bg: 9 }, localOnly: ['bg'] };
р = С.слить(д, е);
проверить('картинка, оставшаяся на другом устройстве, свою не стирает', д.bg.startsWith('data:') && !р.пришло.includes('bg'));

// Вид открытого чата не переносится.
const ж = { savedAt: 1, keyTimes: { theme: 1 }, theme: 'rose', prompt: 'A' }, з = { savedAt: 2, keyTimes: { theme: 9, prompt: 9 }, theme: 'noir', prompt: 'B' };
р = С.слить(ж, з, { исключить: new Set(['theme']) });
проверить('вид открытого чата не переносится, остальное — да', ж.theme === 'rose' && ж.prompt === 'B' && !р.пришло.includes('theme'));

// Виды чатов: по чатам, более свежий; убранный не воскресает.
const и = { savedAt: 1, chatLooks: { A: { at: 5, vars: { t: 'a1' } }, B: { at: 9, vars: { t: 'b2' } } }, chatLooksGone: {} };
const к = { savedAt: 2, chatLooks: { A: { at: 7, vars: { t: 'a2' } }, B: { at: 3, vars: { t: 'b1' } }, C: { at: 4, vars: { t: 'c' } }, D: { at: 2, vars: {} } }, chatLooksGone: { D: 6 } };
р = С.слить(и, к);
проверить('виды чатов сливаются по чатам: у каждого — свежий', и.chatLooks.A.vars.t === 'a2' && и.chatLooks.B.vars.t === 'b2' && и.chatLooks.C.vars.t === 'c');
проверить('убранный вид чата не возвращается', !и.chatLooks.D && и.chatLooksGone.D === 6);
проверить('свой более свежий вид чата уходит в общий файл', р.пришло.includes('chatLooks') && р.ушло.includes('chatLooks'));
// «Вернуть общее» на одном устройстве: вид убран и в копии другого не всплывает.
const л = { savedAt: 3, chatLooks: {}, chatLooksGone: { A: 10 } };
С.слить(л, structuredClone(и));
проверить('вид, убранный «Вернуть общее», не приходит обратно', !л.chatLooks.A);

// Служебное не сливается, время правки — по каждому ключу.
const м = { savedAt: 1, keyTimes: { a: 1 }, a: 1 }, н = { savedAt: 9, keyTimes: { a: 5 }, a: 2, localOnly: [] };
С.слить(м, н);
проверить('savedAt и localOnly не переносятся как настройки', м.savedAt === 1 && !('localOnly' in м) && м.keyTimes.a === 5);

// Первый запуск на новом устройстве: заводские значения не перебивают уже
// сохранённую копию, даже если её время старше.
const новое = { savedAt: 9999, hudFirstRun: true, enablePhone: true, theme: 'default' };
const старое = { savedAt: 10, enablePhone: false, theme: 'noir' };
const рн = С.слить(новое, старое);
проверить('первый запуск уступает сохранённой копии', новое.enablePhone === false && новое.theme === 'noir' && рн.пришло.includes('enablePhone') && !рн.ушло.includes('enablePhone'));
проверить('отметка первого запуска не уходит как настройка', !С.слить({ hudFirstRun: true, a: 1 }, { a: 1 }).ушло.includes('hudFirstRun'));

// Нет общего файла — своё надо записать.
проверить('нет чужой копии — своё уходит', С.слить({ a: 1 }, null).ушло.length === 1);

// Изменения в объектах и удаление ключа отмечаются.
const о = { savedAt: 1, obj: { a: 1 }, gone: 1 }; const п = new Map(); С.запомнитьВсе(о, п);
о.obj.a = 2; delete о.gone;
const из = С.отметитьИзменения(о, п, 77);
проверить('правка внутри объекта и удалённый ключ отмечены', из.includes('obj') && из.includes('gone') && о.keyTimes.gone === 77);
проверить('виды чатов времени правки не получают (сливаются по чатам)', (() => { const р2 = { chatLooks: {} }; const п2 = new Map(); С.запомнитьВсе(р2, п2); р2.chatLooks.X = { at: 1 }; С.отметитьИзменения(р2, п2, 5); return !('chatLooks' in р2.keyTimes); })());

// Пока общий файл загружается на сервер, игрок успевает переключить блок ещё раз.
{
  const состояние = { enableWorld: true, keyTimes: { enableWorld: 20 } };
  let завершитьЗапись, начатьЗапись, копияНаСервере;
  const записьНачата = new Promise(resolve => { начатьЗапись = resolve; });
  const исходныйFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, opts) => {
      if (opts.method !== 'POST') return { ok: true, json: async () => ({ enableWorld: false, keyTimes: { enableWorld: 10 } }) };
      начатьЗапись();
      return new Promise(resolve => { завершитьЗапись = () => resolve({ ok: true }); });
    };
    С.подключитьСинхронизацию({ settings: состояние, контекст: () => null, исключить: () => null,
      копия: () => structuredClone(состояние), принять() {}, наСервер: копия => { копияНаСервере = копия; } });
    const готово = С.синхронизировать();
    await записьНачата;
    состояние.enableWorld = false;
    состояние.keyTimes.enableWorld = 30;
    завершитьЗапись();
    await готово;
    проверить('завершение загрузки не возвращает старую галочку в settings.json', копияНаСервере.enableWorld === false && копияНаСервере.keyTimes.enableWorld === 30);
  } finally { globalThis.fetch = исходныйFetch; }
}

// Уходят со страницы: отложенное сохранение уходит сразу, без ожидания — на Android вкладку могут выгрузить.
{
  const слушатели = {}, былиD = globalThis.document, былиW = globalThis.window, fetchБыл = globalThis.fetch, siБыл = globalThis.setInterval;
  const д = { hidden: false, addEventListener: (т, f) => { (слушатели[т] ||= []).push(f); } };
  globalThis.document = д; globalThis.window = { addEventListener: (т, f) => { (слушатели[т] ||= []).push(f); } };
  globalThis.setInterval = () => 0;
  const запросы = [];
  globalThis.fetch = async (u, о) => { запросы.push((о && о.method) || 'GET'); return { ok: true, status: 200, json: async () => ({}) }; };
  const s = { a: 1, keyTimes: { a: 5 } };
  С.подключитьСинхронизацию({ settings: s, контекст: () => null, копия: () => ({ ...s }), наСервер() {}, исключить: () => null, принять() {} });
  д.hidden = true; слушатели.visibilitychange.forEach(f => f());
  проверить('ушли со страницы без правок — запросов нет', запросы.length === 0, запросы.join());
  С.запланировать(60000);
  слушатели.visibilitychange.forEach(f => f());
  await new Promise(r => setTimeout(r, 20));
  проверить('ушли со страницы с правкой — сохранена сразу', запросы.includes('POST'), запросы.join());
  globalThis.document = былиD; globalThis.window = былиW; globalThis.fetch = fetchБыл; globalThis.setInterval = siБыл;
}

// Связка в коде.
const инд = fs.readFileSync(path.join(КОРЕНЬ, 'index.js'), 'utf8');
const сохр = инд.slice(инд.indexOf('  function saveSettings() {'), инд.indexOf('\n  }\n', инд.indexOf('  function saveSettings() {')));
проверить('код: saveSettings отмечает правки и шлёт через синхронизацию', сохр.includes('отметитьИзменения(settings, прошлыеКлючи)') && сохр.includes('синхронизироватьПозже()'));
проверить('код: после загрузки запоминаются значения', /запомнитьКлючи\(settings, прошлыеКлючи\);\s*\n\s*applyThemeColors\(\); обновитьПалитруГрупп\(\)/.test(инд));
проверить('код: вид открытого чата исключён при своём оформлении у чатов', инд.includes("settings.lookPerChat !== false ? new Set(КЛЮЧИ_ВИДА_ЧАТА())"));
проверить('файл: имя годится для user/files Таверны', /^[a-zA-Z0-9_\-.]+\.json$/.test(С.ФАЙЛ));
const en = fs.readFileSync(path.join(КОРЕНЬ, 'i18n-en.js'), 'utf8');
проверить('английский: уведомление переведено', ['Настройки с другого устройства', 'Подтянуты изменения, сделанные на другом устройстве или в другой вкладке.'].every(с => en.includes(JSON.stringify(с) + ':')));

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exit(провалов ? 1 : 0);
