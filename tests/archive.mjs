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
  const поДням = html.slice(html.indexOf('hud-gens-days'));
  проверить('карточка: по дням — новые сверху, легенда с HUD', поДням.indexOf('21 нояб') < поДням.indexOf('20 нояб') && /<\/i>HUD<\/span>/.test(html), html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
  const безHUD = A.карточкаГенераций({ dashboard: { activity: { ...а, hudSeparate: false, totals: { ...а.totals, hud: 0 } } } });
  проверить('карточка: HUD не отдельно и не перегенерировался — его строки нет', !/HUD отдельно в день/.test(безHUD) && !/<\/i>HUD<\/span>/.test(безHUD));
  проверить('вкладка «Статистика» показывает карточку', fs.readFileSync(path.join(КОРЕНЬ, 'render/archive.js'), 'utf8').includes('${карточкаГенераций(отчёт)}'));

  const m = { extra: {}, swipe_id: 1, swipe_info: [{}, {}] };
  R.отметитьГенерациюHUD(m, 111); R.отметитьГенерациюHUD(m, 222);
  проверить('метка генерации HUD — у сообщения и в swipe_info текущего свайпа', m.extra.hud_gens.join() === '111,222' && m.swipe_info[1].extra.hud_gens.join() === '111,222' && !m.swipe_info[0].extra);
  for (let i = 0; i < 60; i++) R.отметитьГенерациюHUD(m, i);
  проверить('метка генерации HUD — не больше 50 на свайп', m.extra.hud_gens.length === S.ГЕНЕРАЦИЙ_HUD_НА_СВАЙП && m.extra.hud_gens[49] === 59);
  проверить('регенерация ставит метку после вставки HUD', /updateMessageDataForCurrentSwipe\(targetMessage, updatedFullText\);\n\s+отметитьГенерациюHUD\(targetMessage\);/.test(fs.readFileSync(path.join(КОРЕНЬ, 'regen.js'), 'utf8')));

  // Серии: 3 дня подряд неделю назад — лучшая, вчера и сегодня — текущая.
  const деньНазад = (n, час = 20) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(час, 0, 0, 0); return d.getTime(); };
  const с = S.createActivity();
  [10, 9, 8, 1, 0].forEach(n => с.add({ is_user: true, send_date: деньНазад(n) }, null, 1));
  const сер = с.finish().streaks;
  проверить('серии: текущая — вчера и сегодня, лучшая — три дня подряд', сер.current === 2 && сер.best.len === 3 && сер.last.len === 2, JSON.stringify(сер));
  const с2 = S.createActivity();
  [5, 4].forEach(n => с2.add({ is_user: true, send_date: деньНазад(n) }, null, 1));
  проверить('серии: позавчера не играли — текущей нет, последняя видна', с2.finish().streaks.current === 0 && с2.finish().streaks.last.len === 2);

  // Детали дня: модель, кто отвечал, токены и ожидание — из полей Таверны у свайпа.
  const ч = new Date(2026, 10, 20, 21, 0);
  const iso = (мин, сек = 0) => new Date(ч.getTime() + мин * 60000 + сек * 1000).toISOString();
  const д = S.createActivity();
  д.add({ is_user: true, send_date: ч.getTime() }, null, 1);
  д.add({ is_user: false, name: 'Дамиан', send_date: ч.getTime() + 120000, swipe_id: 1, mes: 'б', swipes: ['а', 'б'], gen_started: iso(2), gen_finished: iso(2, 30), extra: { model: 'model-b', token_count: 300 },
    swipe_info: [{ send_date: ч.getTime() + 60000, gen_started: iso(1), gen_finished: iso(1, 10), extra: { model: 'model-a', token_count: 100 } }, { send_date: ч.getTime() + 120000 }] }, null, 2);
  д.add({ is_user: false, name: 'Ада', send_date: ч.getTime() + 180000, mes: 'в', gen_started: iso(3), gen_finished: iso(3, 20), extra: { model: 'model-b', token_count: 200 } }, null, 3);
  const дд = д.finish().recent[0];
  проверить('детали дня: модели, кто отвечал, токены, среднее ожидание, время игры', дд.models.map(m => m.name + m.count).join() === 'model-b2,model-a1' && дд.speakers.length === 2 && дд.tokens === 600 && дд.avgWaitSec === 20
    && new Date(дд.first).getMinutes() === 0 && new Date(дд.last).getMinutes() === 3, JSON.stringify(дд));
  const сДеталями = A.карточкаГенераций({ dashboard: { activity: { ...а, streaks: сер, recent: [{ ...дд }] } } });
  проверить('карточка: день раскрывается — модели, отвечали, токены, ожидание', /<details class="hud-gens-day"><summary/.test(сДеталями) && /Модели<\/label><span>model-b ×2, model-a ×1/.test(сДеталями)
    && /Отвечали<\/label>/.test(сДеталями) && /600 · ≈ 200 на ответ/.test(сДеталями) && /20 с в среднем/.test(сДеталями) && /Играли<\/label><span>21:00–21:03/.test(сДеталями), сДеталями.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(-500));
  проверить('карточка: серии — сейчас и лучшая', /дня подряд сейчас/.test(сДеталями) && /дня — лучшая серия/.test(сДеталями));
}

// --- Имя карточки с приставкой в видах «Не знает» -------------------------------
{
  const V = await модуль('render/views-plus.js');
  const имя = 'THE LANTERNS  Damian Hartley';
  const виды = ['redacted', 'blindspot', 'puzzle'].map(вид => V.видНеЗнает('кто украл ключ; где письмо', имя, вид));
  // Название группы совпадает с приставкой карточки: в списке аватарок она
  // не делает группу персонажем, и чат телефона остаётся с названием.
  const { settings: Н } = await модуль('settings.js');
  const N = await модуль('names.js');
  const M = await модуль('render/messenger.js');
  const было = Н.avatarCharNames;
  Н.avatarCharNames = 'THE LANTERNS Damian Hartley, Damian Hartley, Дамиан Хартли';
  const чатыТел = { 'The Lanterns': { owner: имя, participants: имя + '; Nolan Reyes; Ivy Moss', messages: ['Ivy Moss -> The Lanterns: в библиотеке в семь | 21:35 | Read', 'Nolan Reyes -> The Lanterns: буду | 21:40 | Read'] } };
  const заголовки = [...M.buildMessengerHTML(чатыТел, 'u1', имя, '').matchAll(/class="hud-phone-name">([^<]*)/g)].map(m => m[1].replace(/​/g, '').trim());
  проверить('приставка карточки в списке аватарок: группа «The Lanterns» — не персонаж, чат с названием', !N.namesLikelySame('The Lanterns', имя) && N.namesLikelySame('Damian', имя) && заголовки.join() === 'The Lanterns', заголовки.join());
  Н.avatarCharNames = было;
  проверить('«Не знает»: имя без приставки карточки во всех трёх видах', виды.every(h => /<b>Damian<\/b> не (знает|видит)/.test(h) && !/<b>THE<\/b>/.test(h)), виды.map(h => (h.match(/<b>[^<]*<\/b> не \S+/) || [''])[0]).join(' | '));
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

// --- Летопись: прежние версии ответов не встают лишними ходами -----------------
// Ключ летописи — время отправки. Свайп и перегенерация дают ответу новое, и
// старая версия остаётся в летописи без сообщения. Вычищенное начало чата и
// хвост после последнего сообщения — по-прежнему в архиве.
{
  const CH = await модуль('chronicle.js');
  const ход = (t, место, тайна) => CH.выжимкаHUD({ scene: { 'Дата': '01.11.2024', 'Время': t }, user: { 'Место': место }, characters: [], memory: { secrets: [{ fact: тайна, status: 'hidden' }] } });
  const Т = (м) => `2026-11-01T10:${String(м).padStart(2, '0')}:00.000Z`;
  const мета = {};
  CH.дописатьЛетопись(мета, new Map([
    [Т(0), ход('09:00', 'Холл', 'вычищенное начало')],
    [Т(10), ход('10:00', 'Сад', 'первая')],
    [Т(14), ход('10:30', 'Пруд', 'перегенерированная версия')],
    [Т(15), ход('10:30', 'Беседка', 'вторая')],
    [Т(18), ход('11:05', 'Крыша', 'старая версия с игроком')],
    [Т(21), ход('11:00', 'Кухня', 'прежний свайп')],
    [Т(23), ход('11:00', 'Терраса', 'третья')],
    [Т(40), ход('12:00', 'Подвал', 'хвост')],
  ]), []);
  const чат = [
    { is_user: false, send_date: Т(10), mes: 'HUD вычищен' },
    { is_user: true, send_date: Т(12), mes: '…' },
    { is_user: false, send_date: Т(15), mes: 'HUD вычищен' },
    { is_user: true, send_date: Т(20), mes: '…' },
    { is_user: false, send_date: Т(23), mes: 'HUD вычищен', swipe_id: 1, swipes: ['a', 'b'], swipe_info: [{ send_date: Т(21) }, { send_date: Т(23) }] },
  ];
  const fetchБыл = globalThis.fetch;
  globalThis.fetch = async (url, init) => (init && init.method === 'POST') ? { ok: true, json: async () => ({}) }
    : String(url) === '/user/files/hud-chronicle-arc-replaced.json' ? { ok: true, json: async () => мета[CH.КЛЮЧ_ЛЕТОПИСИ] } : { ok: false, status: 404, json: async () => null };
  контекст = { chat: чат, chatMetadata: { integrity: 'arc-replaced' }, name1: 'Мари', name2: 'Дамиан' };
  const о = await H.analyzeChat(0, чат.length - 1);
  globalThis.fetch = fetchБыл;
  const тайны = о.secrets.map(s => s.fact);
  проверить('летопись: прежний свайп, перегенерированный ответ и ход «позже следующего» — не в архиве', !тайны.includes('прежний свайп') && !тайны.includes('перегенерированная версия') && !тайны.includes('старая версия с игроком'), тайны.join(' | '));
  проверить('летопись: вычищенное начало и хвост — в архиве, на своих местах', о.stats.fromChronicle === 3 && о.stats.chronicleOnly === 2 && о.locations.map(l => l.place).join('|') === 'Холл|Сад|Беседка|Терраса|Подвал', JSON.stringify([о.stats.chronicleOnly, о.locations.map(l => l.place)]));
}

// --- Атлас: где кто живёт ----------------------------------------------------------
// Ночь в месте — ещё не дом: гости, балы в отеле, переезды за годы сюжета.
{
  const К = await модуль('history-maps.js');
  const AM = await модуль('render/archive-maps.js');
  const к = К.создатьКарты();
  const ход = (дата, время, люди, at) => к.учесть({ scene: { 'Время': время }, characters: люди.map(([Имя, Место]) => ({ Имя, Место })) }, at, дата);
  let at = 0;
  // Одна долгая ночь — десять ходов, но одна ночь: Лоренс у Норы в гостях.
  for (let i = 0; i < 10; i++) ход('14.10.2024', '23:' + String(10 + i).padStart(2, '0'), [['Нора', 'Кампус Олдбриджа, общежитие Брукфилд-холл, комната 307, на своей кровати'], ['Лоренс', 'Кампус Олдбриджа, общежитие Брукфилд-холл, комната 307, на ковре'], ['Виктория', 'Бостон, венецианский бальный зал отеля']], at++);
  ход('15.10.2024', '00:40', [['Лоренс', 'Кампус Олдбриджа, общежитие Брукфилд-холл, комната 307'], ['Виктория', 'Бостон, венецианский бальный зал отеля']], at++);
  ход('15.10.2024', '23:00', [['Лоренс', 'Кампус Олдбриджа, общежитие Брукфилд-холл, комната 307'], ['Виктория', 'Бостон, венецианский бальный зал отеля'], ['Нико', 'Пригород Кембриджа, особняк Сенаторов, серверная']], at++);
  ход('16.10.2024', '14:00', [['Лоренс', 'Пентхаус Лоренса Ларсен в центре города, гостиная']], at++);
  for (const д of ['16.10.2024', '17.10.2024', '18.10.2024']) ход(д, '23:30', [['Нико', 'Пригород Кембриджа, особняк Сенаторов, серверная'], ['Эдвин', 'Пригород Кембриджа, особняк Сенаторов, гостевая спальня']], at++);
  // Дом семьи (одна фамилия в названии): Феликсу — с двух ночей, Марку одной мало.
  for (const д of ['16.10.2024', '17.10.2024']) ход(д, '23:45', [['Феликс Делакур', 'Массачусетс, загородное поместье семьи Делакур, западное крыло']], at++);
  ход('18.10.2024', '23:45', [['Марк Делакур', 'Массачусетс, загородное поместье семьи Делакур, восточное крыло']], at++);
  ход('19.10.2024', '23:30', [['Виктория', 'Бостон, венецианский бальный зал отеля']], at++);
  ход('14.11.2026', '22:30', [['Нора', 'Бостон, район Норт-Энд, кухня скромной съемной квартиры на втором этаже']], at++);
  const и = к.итог();
  const дома = (имя) => (и.homes.find(ч => ч.name === имя) || { homes: [], stays: [] });
  const л = дома('Нора');
  проверить('дома: Нора переехала — общежитие раньше, съёмная квартира сейчас', л.homes.length === 2 && л.homes[0].place === 'общежитие Брукфилд-холл' && л.homes[0].past && л.homes[1].place === 'квартира' && !л.homes[1].past, JSON.stringify(л.homes));
  const т = дома('Лоренс');
  проверить('дома: у Норы Лоренс в гостях (одна долгая ночь и ещё одна — две ночи, не дом), пентхаус с его именем — его дом', т.homes.length === 1 && т.homes[0].place === 'Пентхаус Лоренса Ларсен' && т.stays.length === 1 && т.stays[0].nights === 2, JSON.stringify(т));
  проверить('дома: бальный зал отеля — не дом, хоть там четыре ночи', !и.homes.some(ч => ч.name === 'Виктория') && !и.atlas.some(м => м.lives.includes('Виктория')), JSON.stringify(и.homes.map(ч => ч.name)));
  проверить('дома: три ночи в особняке без имени — дом; в гостевой — ночёвка; поместье семьи — с двух ночей', дома('Нико').homes.length === 1 && !дома('Эдвин').homes.length && дома('Эдвин').stays[0].nights === 3
    && дома('Феликс Делакур').homes[0] && дома('Феликс Делакур').homes[0].place === 'загородное поместье семьи Делакур' && !дома('Марк Делакур').homes.length && дома('Марк Делакур').stays.length === 1,
    JSON.stringify([дома('Нико'), дома('Эдвин'), дома('Феликс Делакур'), дома('Марк Делакур')]));
  const общага = и.atlas.find(м => м.place === 'общежитие Брукфилд-холл');
  проверить('атлас: в общежитии — Нора жила раньше, Лоренс ночью был', общага && !общага.lives.length && общага.lived[0].name === 'Нора' && общага.stayed.some(x => x.name === 'Лоренс' && x.nights === 2), JSON.stringify(общага));
  проверить('атлас: ключ места — названное жилище, здание, а не улица, этаж или район',
    К.ключМеста('Нью-Йорк, Манхэттен, Ист 72-я улица, второй уровень пентхауса Делакуров') === 'пентхаус Делакуров' && К.ключМеста('Бостон, Ларсен-Тауэр, 45-й этаж, мастер-спальня') === 'Ларсен-Тауэр'
    && К.ключМеста('Бостон, район Риверсайд, кафе «Луна»') === 'кафе «Луна»' && К.ключМеста('Штат Мэн, Портленд, мотель «Прибой»') === 'мотель «Прибой»' && К.ключМеста('Бостон, район Норт-Энд, кухня скромной съемной квартиры') !== 'квартира',
    [К.ключМеста('Нью-Йорк, Манхэттен, Ист 72-я улица, второй уровень пентхауса Делакуров'), К.ключМеста('Бостон, Ларсен-Тауэр, 45-й этаж, мастер-спальня'), К.ключМеста('Бостон, район Риверсайд, кафе «Луна»')].join(' | '));
  const html = AM.вкладкаАтласа({ maps: и }, '');
  проверить('вкладка: «Где кто живёт» — переезд стрелкой, ночёвки в гостях числом', html.includes('Где кто живёт') && /Общежитие Брукфилд-холл[\s\S]*?<i>→<\/i>[\s\S]*?Квартира/.test(html) && html.includes('ночью в гостях: 1 место') && html.includes('жили раньше') && html.includes('ночью были'));
  проверить('вкладка: отчёт старой версии без домов — рисуется', AM.вкладкаАтласа({ maps: { atlas: [{ place: 'квартира Анны', visits: 2, turns: 3, people: [], lives: ['Анна'], works: [] }] } }, '').includes('живёт: Анна'));
}

// --- Репутация фракций: вся история числа ---------------------------------------
{
  const ход = (dt, rep) => ({ is_user: false, send_date: 'r' + dt, mes: '[HUD]' + JSON.stringify({ sc: { T: '12:00', Dt: dt }, wd: { rep } }) + '[/HUD]' });
  const чат = [
    ход('01.03.2030', ['Гильдия стекольщиков | {{user}} | 10 | терпят | новенькая']),
    { is_user: true, mes: '…' },
    ход('02.03.2030', ['Гильдия стекольщиков | {{user}} | 10 | терпят | новенькая', 'Речная стража | {{user}} | -5 | косятся | чужая']),
    { is_user: true, mes: '…' },
    ход('03.03.2030', ['Гильдия стекольщиков | {{user}} | 25 | уважают | починила печь', 'Речная стража | {{user}} | -5 | косятся | чужая']),
    { is_user: true, mes: '…' },
    ход('04.03.2030', ['Гильдия стекольщиков | {{user}} | 15 | сомневаются | сорвала заказ', 'Речная стража | {{user}} | -5 | косятся | чужая']),
  ];
  контекст = { chat: чат, chatMetadata: {}, name1: 'Ивета', name2: 'Орин' };
  const о = await H.analyzeChat(0, чат.length - 1);
  const гильдия = (о.reputation || []).find(л => /стекольщ/.test(л.name));
  проверить('архив: репутация — весь путь числа и причины', гильдия && гильдия.start === 10 && гильдия.changes.map(с => с.to).join() === '25,15' && гильдия.changes[1].why === 'сорвала заказ' && гильдия.now === 15, JSON.stringify(о.reputation));
  const стража = (о.reputation || []).find(л => /стража/.test(л.name));
  проверить('архив: без сдвигов — одна строка «впервые», без изменений', стража && !стража.changes.length && стража.firstSeen === 2);
  const html = A.вкладкаРепутации(о, '');
  проверить('вкладка «Репутация»: путь +10 → +25 → +15 и сдвиги со знаком', html.includes('+10 → +25 → +15') && html.includes('сорвала заказ') && />−10</.test(html) && />\+15</.test(html) && html.includes('−5'), html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300));
  const сРостом = { ...о, reputation: [...о.reputation, { name: 'Мельники', target: '{{user}}', firstSeen: 4, lastSeen: 6, start: 20, now: 0, changes: [{ from: 20, to: 0, why: 'сорванный заказ', at: 6 }] }] };
  const сФильтром = A.вкладкаРепутации(сРостом, '');
  проверить('вкладка «Репутация»: фильтр «Выросли» и «Упали» по итогу отрезка', /data-arc-filter="reputation:up"/.test(сФильтром) && /data-arc-filter="reputation:down"/.test(сФильтром), сФильтром.slice(0, 300));
  A.выбратьФильтр('reputation', 'down');
  const упали = A.вкладкаРепутации(сРостом, '');
  A.выбратьФильтр('reputation', 'all');
  проверить('вкладка «Репутация»: «Упали» — мельники, гильдия (+10 → +15) выросла', упали.includes('Мельники') && !упали.includes('стекольщ'), упали.replace(/<[^>]+>/g, ' ').slice(0, 200));
  проверить('вкладка «Репутация»: поиск по причине', A.вкладкаРепутации(о, 'печь').includes('стекольщ') && !A.вкладкаРепутации(о, 'печь').includes('Речная'));
  проверить('вкладка «Репутация»: старый отчёт без поля — пусто, без ошибки', A.вкладкаРепутации({ moments: {} }, '').includes('нет фракций'));
}

console.log(`\nпроверок: ${всего}, провалов: ${провалов}`);
process.exitCode = провалов ? 1 : 0;
