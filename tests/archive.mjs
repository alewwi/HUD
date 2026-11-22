// hud-manager/tests/archive.mjs
//
// Архив HUD (render/archive.js, history-analyzer.js):
// — длинные вкладки сверху новые, порцией, остальное по кнопке;
// — фильтры по статусам: секреты, ружья, отношения, хронология, беременности;
// — беременность после потери, отмеченной кнопкой, — отдельная, даже если
//   модель не записала «lost» в HUD;
// — подтверждённое тестом зачатие без беременности в ходах — тоже в архиве.
// node tests/archive.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const КОРЕНЬ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ВЕРСИЯ = JSON.parse(fs.readFileSync(path.join(КОРЕНЬ, 'manifest.json'), 'utf8')).version;
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const узел = () => { let t = ''; return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, set textContent(x) { t = String(x); }, get innerHTML() { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }, set innerHTML(x) { t = String(x); }, get value() { return t; }, querySelector: () => null, querySelectorAll: () => [], setAttribute() {}, getAttribute: () => null, appendChild() {}, append() {}, addEventListener() {}, remove() {} }; };
globalThis.document = { createElement: узел, querySelector: () => null, querySelectorAll: () => [], documentElement: узел(), getElementById: () => null };
let контекст = { chat: [], chatMetadata: {}, name1: 'Мари', name2: 'Дамиан' };
globalThis.SillyTavern = { getContext: () => контекст };
for (const k of ['info', 'debug', 'warn']) console[k] = () => {};
const модуль = (имя) => import('file:///' + path.join(КОРЕНЬ, имя).replace(/\\/g, '/') + '?v=' + ВЕРСИЯ);

let всего = 0, провалов = 0;
const проверить = (что, ок, подробно = '') => { всего++; if (!ок) { провалов++; console.log('✗', что, String(подробно).slice(0, 300)); } else console.log('✓', что); };

const H = await модуль('history-analyzer.js');
const A = await модуль('render/archive.js');

// --- Беременность после выкидыша, отмеченного кнопкой ---------------------------
// Как в живом чате: после потери модель пишет прежний срок без «lost», спустя
// полгода — новую беременность с меньшим сроком (6 → 3, меньше чем на 4 недели).
{
  const ход = (dt, prg) => ({ is_user: false, send_date: 'a' + dt, mes: '[HUD]' + JSON.stringify({ sc: { T: '20:00', Dt: dt }, us: { L: 'Дом', Prg: prg } }) + '[/HUD]' });
  const чат = [
    ход('16.11.2026', 'wk: 3; fa: Дамиан'),
    { is_user: true, mes: '…' },
    ход('07.12.2026', 'wk: 6; fa: Дамиан'),
    { is_user: true, mes: '…' },
    ход('08.12.2026', 'wk: 6; fa: Дамиан; sy: кровотечение'),
    { is_user: true, mes: '…' },
    ход('18.05.2027', 'wk: 3; fa: Дамиан; sy: первые сутки'),
  ];
  const семья = { потери: [{ кто: 'user', вид: 'miscarriage', дата: Date.UTC(2026, 11, 8), неделя: 6, сообщение: 3, когда: '08.12.2026 — выкидыш' }],
    роды: [], журнал: [], осмотры: {}, угрозы: {}, броски: {}, зачатие: { user: { когда: '17.05.2027, 21:20', проверено: true } }, судьба: {}, плоды: {} };
  контекст = { chat: чат, chatMetadata: { tavernosHudConception: семья }, name1: 'Мари', name2: 'Дамиан' };
  const о = await H.analyzeChat(0, чат.length - 1);
  const б = о.pregnancies || [];
  проверить('беременность после потери кнопкой — отдельная, хоть срок упал всего на 3 недели', б.length === 2 && б[0].to === 4 && б[0].outcome && б[0].outcome.kind === 'loss' && б[1].from === 6 && !б[1].outcome,
    JSON.stringify(б.map(э => [э.from, э.to, э.weekFrom, э.weekTo, э.outcome && э.outcome.kind])));
  const html = A.вкладкаБеременностей(о, '');
  const карточки = [...html.matchAll(/hud-arc-preg is-([a-z]+)/g)].map(m => m[1]);
  проверить('в архиве обе: идущая сверху, выкидыш ниже', карточки.join() === 'going,miscarriage', карточки.join());
  проверить('зачатие уже есть в ходах — второй карточки «по записи зачатия» нет', !/по записи зачатия/.test(html));
  const хр = A.вкладкаХронологии(о, '');
  проверить('хронология: начало каждой беременности и выкидыш', (хр.match(/Беременность · Мари/g) || []).length === 2 && /Самопроизвольный выкидыш|Выкидыш/i.test(хр), хр.replace(/<[^>]+>/g, ' ').replace(/s+/g, ' ').slice(0, 300));
  проверить('фильтр беременностей: идут и прервались', /data-arc-filter="pregnancies:going"/.test(html) && /data-arc-filter="pregnancies:lost"/.test(html));
  A.выбратьФильтр('pregnancies', 'lost');
  const толькоПотери = [...A.вкладкаБеременностей(о, '').matchAll(/hud-arc-preg is-([a-z]+)/g)].map(m => m[1]);
  проверить('фильтр «Прервались» — только выкидыш', толькоПотери.join() === 'miscarriage', толькоПотери.join());
  A.выбратьФильтр('pregnancies', 'all');

  // Без беременности в ходах: подтверждённое тестом зачатие — карточка «идёт»; неподтверждённое — нет.
  const безХодов = { ...о, pregnancies: [] };
  контекст.chatMetadata.tavernosHudConception = { ...семья, потери: [] };
  проверить('подтверждённое зачатие без ходов — карточка «идёт»', /по записи зачатия/.test(A.вкладкаБеременностей(безХодов, '')));
  контекст.chatMetadata.tavernosHudConception = { ...семья, потери: [], зачатие: { user: { когда: '17.05.2027', проверено: false } } };
  проверить('неподтверждённое зачатие не раскрывается', !/по записи зачатия/.test(A.вкладкаБеременностей(безХодов, '')));
}

// --- Порции, порядок и фильтры -----------------------------------------------
{
  контекст = { chat: [], chatMetadata: {}, name1: 'Мари', name2: 'Дамиан' };
  const секреты = Array.from({ length: 25 }, (_, i) => ({ fact: 'Секрет ' + i, firstFact: '', level: 'low', firstSeen: i, lastSeen: 30,
    statusHistory: [{ status: i % 3 === 0 ? 'revealed' : 'unknown', at: i }], knows: [], unaware: [] }));
  const ружья = Array.from({ length: 14 }, (_, i) => ({ setup: 'Ружьё ' + i, firstSetup: '', tiedTo: '', firstSeen: i, lastSeen: 30,
    statusHistory: [{ status: ['open', 'building', 'fired'][i % 3], at: i }] }));
  const отчёт = { secrets: секреты, guns: ружья, relations: {}, dates: [], locations: [], moments: {}, stats: { storyDays: null }, range: { from: 0, to: 30 } };
  A.сброситьПоказанное();
  const с = A.вкладкаСекретов(отчёт, '');
  const номера = [...с.matchAll(/<b>Секрет (\d+)<\/b>/g)].map(m => +m[1]);
  проверить('секреты: сначала 10, сверху новые', номера.length === 10 && номера[0] === 24 && номера[9] === 15, номера.join());
  проверить('секреты: кнопка «Ещё 15 из 15»', /data-arc-more="secrets">Ещё <b>15<\/b> <small>из 15<\/small>/.test(с));
  A.показатьЕщё('secrets');
  const с2 = A.вкладкаСекретов(отчёт, '');
  проверить('секреты: «ещё» — все 25 и «Свернуть»', (с2.match(/<b>Секрет \d+<\/b>/g) || []).length === 25 && /data-arc-less="secrets"/.test(с2));
  A.выбратьФильтр('secrets', 'open');
  const с3 = A.вкладкаСекретов(отчёт, '');
  проверить('секреты: фильтр «Раскрытые» — только раскрытые', [...с3.matchAll(/<b>Секрет (\d+)<\/b>/g)].every(m => +m[1] % 3 === 0) && /aria-pressed="true" data-arc-filter="secrets:open"/.test(с3));
  A.выбратьФильтр('secrets', 'all');
  A.выбратьФильтр('guns', 'fired');
  const р = A.вкладкаРужей(отчёт, '');
  проверить('ружья: фильтр «Выстрелили» — только выстрелившие, сверху новые', [...р.matchAll(/<b>Ружьё (\d+)<\/b>/g)].map(m => +m[1]).join() === '11,8,5,2', [...р.matchAll(/<b>Ружьё (\d+)<\/b>/g)].map(m => m[1]).join());
  проверить('ружья: в ряду фильтров висят, назревают, выстрелили', /guns:open/.test(р) && /guns:building/.test(р) && /guns:fired/.test(р));
  A.выбратьФильтр('guns', 'all');

  // Хронология: последний день сверху, внутри дня — последнее событие первым.
  const хрон = { ...отчёт, dates: [{ at: 1, date: '01.11' }, { at: 5, date: '02.11' }], locations: [{ at: 2, place: 'Бар' }, { at: 3, place: 'Улица' }, { at: 6, place: 'Дом' }] };
  const т = A.вкладкаХронологии(хрон, '');
  проверить('хронология: новые сверху, внутри дня — последнее первым', т.indexOf('02.11') < т.indexOf('01.11') && т.indexOf('Улица') < т.indexOf('Бар'), т.replace(/<[^>]+>/g, ' ').replace(/s+/g, ' ').slice(0, 200));
  A.выбратьФильтр('timeline', 'place');
  const тм = A.вкладкаХронологии(хрон, '');
  проверить('хронология: фильтр «Места» — места и заголовки дней', /Дом/.test(тм) && /02.11/.test(тм));
  A.выбратьФильтр('timeline', 'all');
}

// --- Сколько вы ролите: генерации по дням ----------------------------------------
{
  const S = await модуль('chat-stats.js');
  const R = await модуль('regen.js');
  const д1 = 'November 20, 2026 8:00pm', д2 = 'November 21, 2026 9:15pm';
  const hud = '[HUD]{"sc":{"T":"20:00"}}[/HUD]';
  const чат = [
    // Приветствие с альтернативами — не генерации.
    { is_user: false, name: 'Дамиан', send_date: д1, mes: 'Привет', swipes: ['Привет', 'Здравствуй'], swipe_id: 0, swipe_info: [{ send_date: д1 }, { send_date: д1 }] },
    { is_user: true, name: 'Мари', send_date: д1, mes: 'Ход 1' },
    // Ответ и два свайпа: свайп ушёл на второй день, у него метка — две генерации HUD.
    { is_user: false, name: 'Дамиан', send_date: д2, mes: 'Вариант 3 ' + hud, swipe_id: 2,
      swipes: ['Вариант 1 ' + hud, 'Вариант 2', 'Вариант 3 ' + hud],
      swipe_info: [{ send_date: д1, extra: { hud_versions: [{ hud: 'x', when: new Date(2026, 10, 20, 20, 5).getTime(), note: 'до перегенерации' }] } }, { send_date: д2 }, { send_date: д2 }],
      extra: { hud_gens: [new Date(2026, 10, 21, 21, 16).getTime(), new Date(2026, 10, 21, 21, 20).getTime()] } },
    { is_user: true, name: 'Мари', send_date: д2, mes: 'Ход 2', is_system: true },
    { is_user: false, name: 'SillyTavern System', is_system: true, extra: { type: 'help' }, mes: 'Справка' },
    { is_user: false, name: 'Дамиан', mes: 'Без даты' },
  ];
  const счёт = (hudSeparate) => { const d = S.createDashboard({ userName: 'Мари', hudSeparate }); чат.forEach((m, i) => d.add(m, null, i)); return d.finish().activity; };
  const а = счёт(true);
  проверить('генерации: игрок 2, персонажи 2, свайпы 2 — приветствие и справка не в счёт', а.totals.user === 2 && а.totals.ai === 2 && а.totals.swipes === 2, JSON.stringify(а.totals));
  // HUD: свайп 1 — версия «до перегенерации» + первый HUD (отдельно включён) = 2;
  // свайп 2 без HUD — 0; текущий свайп 3 — по метке, 2. Ответ без даты без HUD.
  проверить('генерации: HUD — по меткам точно, у старых свайпов — по версиям и HUD в тексте', а.totals.hud === 4 && а.hudExact === 2 && а.hudApprox === 2, JSON.stringify([а.totals, а.hudExact, а.hudApprox]));
  const [день1, день2] = а.recent;
  проверить('генерации: у каждого свайпа своя дата', а.days === 2 && день1.day === '2026-11-20' && день1.user === 1 && день1.ai === 1 && день1.swipes === 0 && день1.hud === 2
    && день2.user === 1 && день2.swipes === 2 && день2.hud === 2, JSON.stringify(а.recent));
  проверить('генерации: в день — среднее по дням игры, без даты — только в итогах', а.undated === 1 && а.perDay.user === 1 && а.perDay.swipes === 1 && а.perDay.all === 4.5 && а.totals.all === 10, JSON.stringify([а.perDay, а.undated, а.totals.all]));
  const б = счёт(false);
  проверить('генерации: без «HUD отдельно» первый HUD свайпа не запрос, перегенерации — да', б.totals.hud === 3 && !б.hudSeparate, JSON.stringify(б.totals));

  const html = A.карточкаГенераций({ dashboard: { activity: а } });
  const подписи = [...html.matchAll(/<span>([^<]+)<\/span>/g)].map(m => m[1]).filter(x => /в день$/.test(x));
  проверить('карточка: сначала игрок и персонажи, потом свайпы, HUD, всё вместе', подписи.join('|') === 'ваших сообщений в день|ответов персонажей в день|свайпов в день|HUD отдельно в день|всего генераций в день', подписи.join('|'));
  проверить('карточка: по дням — новые сверху, легенда с HUD', html.indexOf('21 нояб') < html.indexOf('20 нояб') && /<\/i>HUD<\/span>/.test(html), html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
  const безHUD = A.карточкаГенераций({ dashboard: { activity: { ...а, hudSeparate: false, totals: { ...а.totals, hud: 0 } } } });
  проверить('карточка: HUD не отдельно и не перегенерировался — его строки нет', !/HUD отдельно в день/.test(безHUD) && !/<\/i>HUD<\/span>/.test(безHUD));
  проверить('вкладка «Статистика» показывает карточку', fs.readFileSync(path.join(КОРЕНЬ, 'render/archive.js'), 'utf8').includes('${карточкаГенераций(отчёт)}'));

  const m = { extra: {}, swipe_id: 1, swipe_info: [{}, {}] };
  R.отметитьГенерациюHUD(m, 111); R.отметитьГенерациюHUD(m, 222);
  проверить('метка генерации HUD — у сообщения и в swipe_info текущего свайпа', m.extra.hud_gens.join() === '111,222' && m.swipe_info[1].extra.hud_gens.join() === '111,222' && !m.swipe_info[0].extra);
  for (let i = 0; i < 60; i++) R.отметитьГенерациюHUD(m, i);
  проверить('метка генерации HUD — не больше 50 на свайп', m.extra.hud_gens.length === S.ГЕНЕРАЦИЙ_HUD_НА_СВАЙП && m.extra.hud_gens[49] === 59);
  проверить('регенерация ставит метку после вставки HUD', /updateMessageDataForCurrentSwipe\(targetMessage, updatedFullText\);\n\s+отметитьГенерациюHUD\(targetMessage\);/.test(fs.readFileSync(path.join(КОРЕНЬ, 'regen.js'), 'utf8')));
}

// --- Окно: обработчики и стили на месте ---------------------------------------
{
  const код = fs.readFileSync(path.join(КОРЕНЬ, 'render/archive.js'), 'utf8');
  const стиль = fs.readFileSync(path.join(КОРЕНЬ, 'css/themes.css'), 'utf8');
  проверить('окно: фильтр, «ещё», «все», «свернуть» обрабатываются', /data-arc-filter\], \[data-arc-more\], \[data-arc-all\], \[data-arc-less\]/.test(код));
  проверить('окно: новый отчёт и поиск — снова с первой порции', (код.match(/сброситьПоказанное\(\)/g) || []).length >= 3);
  проверить('стили фильтра и кнопок «ещё»', /\.hud-arc-filter \{/.test(стиль) && /\.hud-arc-pager \{/.test(стиль));
  проверить('анализатор: новая версия отчёта — старый кэш пересчитается', H.ВЕРСИЯ_ОТЧЁТА >= 3);
}

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
