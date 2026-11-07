// hud-manager/history-analyzer.js
//
// Архив HUD: сводка по всем HUD-блокам за выбранный отрезок чата.
//
// Модуль только считает. Он не знает ни про модальное окно, ни про вёрстку:
// на вход — диапазон сообщений, на выход — готовый объект отчёта. Рисует его
// render/archive.js, и разделение здесь не косметическое: тот же отчёт уходит
// в экспорт JSON и в кэш, а значит не должен тащить за собой разметку.
//
// Разбор HUD берём готовый — parseHUDComplex и normalizeJSONData. Свой
// упрощённый парсер здесь был бы третьим по счёту и разошёлся бы с ними на
// первой же правке схемы.

import { parseHUDComplex } from './hud-parser.js?v=23.88.91';
import { normalizeJSONData } from './schema.js?v=23.88.91';
import { parseRelationList } from './render/relations-graph.js?v=23.88.91';
import { nameLettersOnly, namePhoneticLatin } from './names.js?v=23.88.91';
import { hudFilled, getSafeUserName, имяБезПриставки } from './utils.js?v=23.88.91';
import { createDashboard } from './chat-stats.js?v=23.88.91';
import { статусРужья } from './codes.js?v=23.88.91';
import { readEntry, writeEntry, clearAll, usage } from './store.js?v=23.88.91';
import { выжимкаHUD, ключСообщения, датаИзТегов } from './chronicle.js?v=23.88.91';
import { летописьЧата, летописьЕсли, дописатьВЛетопись } from './chronicle-store.js?v=23.88.91';
import { музыкаХода, музыкаДляЛетописи } from './render/music-data.js?v=23.88.91';

// --- Мелкие помощники --------------------------------------------------------

const текст = (v) => (v === null || v === undefined ? '' : String(v)).trim();

// Значение считается пустым, если модель прислала заглушку.
const значимо = (v) => hudFilled(v) && !/^(empty|none|n\/a|-|—|нет)$/i.test(текст(v));

// Ключ личности: «Брэндон» и «брэндон,» — один человек. Транслитерация ловит
// случай, когда модель в одном сообщении пишет имя кириллицей, в другом —
// латиницей.
function ключИмени(name) {
  const letters = nameLettersOnly(name);
  if (!letters) return '';
  return namePhoneticLatin(letters) || letters;
}

// Ключ факта секрета: секрет узнаётся по тексту, а модель каждый ход
// переписывает его чуть иначе — падежи, кавычки, пунктуация.
function ключФакта(fact) {
  return текст(fact).toLowerCase()
    .replace(/[ё]/g, 'е')
    .replace(/[«»"'`.,;:!?()\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Похожесть формулировок. Модель каждый ход переписывает секрет и ружьё
// своими словами: «кот с раненой лапой» через ход становится «котом с
// перевязанной лапой, съевшим говядину». По точному тексту это десяток
// разных секретов, и архив показывал их все. Сравниваем основы слов.
function основыСлов(t) {
  const слова = текст(t).toLowerCase().replace(/ё/g, 'е').match(/[\p{L}\d]+/gu) || [];
  return слова.filter(w => w.length >= 4).map(w => w.slice(0, 5));
}
// Вес слова: имена героев («Софи», «Тристан», «Регенты») есть почти в каждой
// формулировке и ничего не говорят о том, тот ли это секрет. Редкие слова
// («карцер», «рысь», «рояль») говорят. Вес — по тому, в скольких разных
// формулировках слово уже встречалось.
function весСлова(слова, w) {
  return Math.log(1 + (слова.N + 1) / ((слова.df.get(w) || 0) + 1));
}
function похожесть(а, б, слова) {
  if (!а.length || !б.length) return 0;
  // То же начало: модель обычно дописывает подробности в хвост.
  if (а.length >= 4 && б.length >= 4 && а.slice(0, 4).every((x, i) => x === б[i])) return 1;
  const A = new Set(а), B = new Set(б);
  if (Math.min(A.size, B.size) < 3) return 0;
  let общих = 0, всегоА = 0, всегоБ = 0;
  for (const x of A) { const в = весСлова(слова, x); всегоА += в; if (B.has(x)) общих += в; }
  for (const x of B) всегоБ += весСлова(слова, x);
  return общих / Math.min(всегоА, всегоБ);
}
// Порог: похожая на любую прежнюю — 0.5; на ту, что была в прошлом ходе и
// в этом не нашлась, — 0.45: модель только что переписала её своими словами.
const ПОРОГ_ПОХОЖЕСТИ = 0.5, ПОРОГ_СОСЕДНЕЙ = 0.45, СОСЕДНИЙ_ХОД = 4;
const словарь = (накоп) => (накоп._слова ||= { N: 0, df: new Map() });
// Запись, на которую похожа формулировка. занятые — уже совпавшие в этом
// ходе: два секрета одного HUD — разные секреты, склеивать их нельзя.
function найтиПохожую(накоп, ключ, основы, занятые, at) {
  const слова = словарь(накоп);
  let лучшая = null, лучший = 0;
  for (const item of накоп.values()) {
    if (занятые.has(item)) continue;
    if (item._ключи.has(ключ)) return item;
    const соседняя = at - item.lastSeen > 0 && at - item.lastSeen <= СОСЕДНИЙ_ХОД;
    for (const в of item._основы) {
      const п = похожесть(основы, в, слова);
      const запас = п - (соседняя ? ПОРОГ_СОСЕДНЕЙ : ПОРОГ_ПОХОЖЕСТИ);
      if (запас >= 0 && (лучшая === null || запас > лучший)) { лучший = запас; лучшая = item; }
    }
  }
  return лучшая;
}
// Запомнить формулировку записи: первая и пять свежих — модель уводит текст
// понемногу, и сравнивать надо с последними словами, а не с первыми.
function запомнитьФормулировку(накоп, item, ключ, основы) {
  if (item._ключи.has(ключ)) return;
  item._ключи.add(ключ);
  if (item._основы.length >= 6) item._основы.splice(1, 1);
  item._основы.push(основы);
  const слова = словарь(накоп);
  слова.N++;
  for (const w of new Set(основы)) слова.df.set(w, (слова.df.get(w) || 0) + 1);
}
// Имя без приставки карточки: «THE REGENTS  Tristan Kingsley» и «Tristan
// Kingsley» — один человек, и в отчёте он должен быть один раз.
const чистоеИмя = (имя) => имяБезПриставки(текст(имя));

// Извлечение блока [HUD] из текста сообщения. Тот же набор написаний, что и в
// index.js: модель иногда шлёт < > вместо скобок, а ST успевает заэкранировать.
// Поиск блока — общий, в hud-block.js. Экспорт оставлен: его берут отсюда.
import { extractHudBlock } from './hud-block.js?v=23.88.91';
import { развернутьHUD, подгрузитьЧат } from './offload.js?v=23.88.91';
export { extractHudBlock };

// Массив сообщений текущего чата.
export function getChatMessages() {
  try {
    if (window.SillyTavern && typeof window.SillyTavern.getContext === 'function') {
      const ctx = window.SillyTavern.getContext();
      if (ctx && Array.isArray(ctx.chat)) return ctx.chat;
    }
  } catch (_) {}
  if (Array.isArray(window.chat)) return window.chat;
  return [];
}

// Разбор одного сообщения. Битый HUD — не ошибка выполнения, а обычное дело:
// возвращаем null и считаем такие сообщения отдельно.
function разобрать(mes) {
  // Выгруженный ход (offload.js) — с полным HUD из файла.
  const raw = развернутьHUD(текст(mes && (mes.mes ?? mes.message ?? '')));
  if (!raw) return null;
  const block = extractHudBlock(raw);
  if (!block) return null;
  try {
    return normalizeJSONData(parseHUDComplex(block));
  } catch (_) {
    return null;
  }
}

// --- Накопители --------------------------------------------------------------

// Шкала важности секрета. Нужна, чтобы выбрать самый высокий уровень за всю
// историю, а не тот, что оказался в последнем сообщении.
const ВЕС_УРОВНЯ = { low: 0, medium: 1, high: 2, critical: 3 };

// Секреты. Один секрет живёт через десятки сообщений и меняет статус —
// храним историю статусов и момент, когда каждый персонаж узнал.
function собратьСекреты(накоп, data, at) {
  const secrets = (data.memory && Array.isArray(data.memory.secrets)) ? data.memory.secrets : [];
  const занятые = new Set();
  for (const s of secrets) {
    const key = ключФакта(s.fact);
    if (!key) continue;
    const основы = основыСлов(s.fact);
    let item = найтиПохожую(накоп, key, основы, занятые, at);
    if (!item) {
      item = { fact: текст(s.fact), firstFact: текст(s.fact), level: текст(s.level), firstSeen: at, lastSeen: at,
        statusHistory: [], knows: [], unaware: [], _знали: new Map(), _ключи: new Set(), _основы: [] };
      накоп.set(key, item);
    }
    занятые.add(item);
    запомнитьФормулировку(накоп, item, key, основы);
    item.lastSeen = at;
    // Уровень берём самый высокий за всё время, а не последний. Модель часто
    // опускает поле, и схема подставляет «medium» — последним значением такой
    // дефолт затирал настоящий «high», записанный в момент появления секрета.
    if (значимо(s.level)) {
      const новый = текст(s.level).toLowerCase();
      if (ВЕС_УРОВНЯ[новый] === undefined) { if (!item.level) item.level = новый; }
      else if ((ВЕС_УРОВНЯ[item.level] ?? -1) < ВЕС_УРОВНЯ[новый]) item.level = новый;
    }
    // Формулировка — свежая: архив показывает секрет на последний момент.
    // Первая остаётся в firstFact для истории.
    item.fact = текст(s.fact);

    const status = текст(s.status).toLowerCase() || 'unknown';
    const прошлый = item.statusHistory[item.statusHistory.length - 1];
    if (!прошлый || прошлый.status !== status) item.statusHistory.push({ status, at });

    for (const k of (Array.isArray(s.knows) ? s.knows : [])) {
      const имя = чистоеИмя(k && k.name);
      const kk = ключИмени(имя);
      if (!kk) continue;
      const откуда = текст(k && k.source);
      const был = item._знали.get(kk);
      if (!был) {
        const запись = { name: имя, source: значимо(откуда) ? откуда : '', since: at };
        item._знали.set(kk, запись);
        item.knows.push(запись);
      } else if (!был.source && значимо(откуда)) был.source = откуда;
    }
    // «Не знают» — состояние на последний ход, а не история: список тает по
    // мере того, как секрет расходится.
    item.unaware = (Array.isArray(s.hidden) ? s.hidden : []).map(чистоеИмя).filter(Boolean);
  }
}

// Отношения. Пишем только смены тега: иначе на 300 сообщений выйдет 300
// одинаковых строк «влюблён».
function собратьОтношения(накоп, data, at) {
  const персонажи = [];
  if (data.user && typeof data.user === 'object') персонажи.push(data.user);
  if (Array.isArray(data.characters)) персонажи.push(...data.characters);

  for (const c of персонажи) {
    const субъект = чистоеИмя(c['Имя'] || c.N || c.name);
    if (!субъект) continue;
    const пары = parseRelationList(c['Отношения'] || c.Rel || '');
    if (!пары.length) continue;
    const sk = ключИмени(субъект);
    if (!sk) continue;
    let ветка = накоп.get(sk);
    if (!ветка) { ветка = { name: субъект, targets: new Map() }; накоп.set(sk, ветка); }
    for (const пара of пары) {
      const цель = чистоеИмя(пара.target);
      const tk = ключИмени(цель);
      if (!tk || tk === sk) continue;
      let линия = ветка.targets.get(tk);
      if (!линия) { линия = { name: цель, changes: [] }; ветка.targets.set(tk, линия); }
      const прошлый = линия.changes[линия.changes.length - 1];
      const rel = текст(пара.rel);
      if (!прошлый || прошлый.rel.toLowerCase() !== rel.toLowerCase()) линия.changes.push({ rel, at });
    }
  }
}

// Ружья Чехова — как секреты: одна нить живёт десятки ходов, и важно, когда
// она появилась, когда стала назревать и когда выстрелила.
function собратьРужья(накоп, data, at) {
  const ружья = (data.memory && Array.isArray(data.memory.guns)) ? data.memory.guns : [];
  const занятые = new Set();
  for (const строка of ружья) {
    const [завязка = '', кто = '', статус = ''] = String(строка).split('|').map(текст);
    const key = ключФакта(завязка);
    if (!key) continue;
    const основы = основыСлов(завязка);
    let item = найтиПохожую(накоп, key, основы, занятые, at);
    if (!item) {
      item = { setup: завязка, firstSetup: завязка, tiedTo: кто, firstSeen: at, lastSeen: at, statusHistory: [], _ключи: new Set(), _основы: [] };
      накоп.set(key, item);
    }
    занятые.add(item);
    запомнитьФормулировку(накоп, item, key, основы);
    item.lastSeen = at;
    // Формулировка и связь — свежие: нить на последний момент.
    item.setup = завязка;
    if (кто) item.tiedTo = кто.split(/\s*(?:,|\sи\s|\sand\s)\s*/).map(чистоеИмя).filter(Boolean).join(', ');
    const s = статусРужья(статус).ключ;
    const прошлый = item.statusHistory[item.statusHistory.length - 1];
    if (!прошлый || прошлый.status !== s) item.statusHistory.push({ status: s, at });
  }
}

// Хронология сцены: дата, время, место. Записываем только моменты смены —
// это и есть скелет сюжета.
// Место сцены. У сцены его нет — оно у каждого персонажа и подробное до
// метра («…особняк Регентов, южный парк у пруда, на сиденье гольф-кара»).
// Берём, где игрок (иначе первый персонаж), и только начало адреса — два
// первых куска до запятой: иначе каждый ход был бы «новой локацией». Раньше
// архив читал scene['Место'] и всегда показывал «0 локаций».
function местоСцены(data) {
  const scene = data.scene && typeof data.scene === 'object' ? data.scene : {};
  const первый = Array.isArray(data.characters) && data.characters[0] ? data.characters[0]['Место'] : '';
  const полное = текст(scene['Место']) || текст(data.user ? data.user['Место'] : '') || текст(первый);
  if (!значимо(полное)) return '';
  return полное.split(/[,;(]/).map(ч => ч.trim()).filter(Boolean).slice(0, 2).join(', ');
}

function собратьСцену(состояние, data, at) {
  const scene = data.scene && typeof data.scene === 'object' ? data.scene : {};
  const дата = текст(scene['Дата']);
  const время = текст(scene['Время']);
  const место = местоСцены(data);

  if (значимо(дата) && дата !== состояние.последняяДата) {
    состояние.dates.push({ date: дата, time: значимо(время) ? время : '', at });
    состояние.последняяДата = дата;
  }
  if (значимо(место) && !тоЖеМесто(место, состояние.последнееМесто)) {
    состояние.locations.push({ place: место, at });
  }
  if (значимо(место)) состояние.последнееМесто = место;
}
// «Край причала в трёх с половиной метрах позади Софи» и «край причала в трёх
// метрах позади Софи» — одно место: то же начало адреса и почти те же слова.
function тоЖеМесто(а, б) {
  if (!а || !б) return false;
  if (а.toLowerCase() === б.toLowerCase()) return true;
  const [а1, ...а2] = а.split(',').map(x => x.trim().toLowerCase());
  const [б1, ...б2] = б.split(',').map(x => x.trim().toLowerCase());
  if (а1 !== б1) return false;
  const х = основыСлов(а2.join(' ')), у = основыСлов(б2.join(' '));
  if (!х.length || !у.length) return false;
  const A = new Set(х), B = new Set(у);
  let общих = 0;
  for (const w of A) if (B.has(w)) общих++;
  return общих / Math.min(A.size, B.size) >= ПОРОГ_ПОХОЖЕСТИ;
}

// Саундтрек: главы — подряд идущие ходы с одной и той же подборкой (пока
// сцена та же, ход получает копию прежней). Новая подборка — новая глава.
function собратьСаундтрек(главы, музыка, data, at) {
  if (!музыка) return;
  const подпись = JSON.stringify([музыка.label, (музыка.soundtrack || []).map(т => т.a + '|' + т.t), ((музыка.scene && музыка.scene.tracks) || []).map(т => т.a + '|' + т.t)]);
  const последняя = главы[главы.length - 1];
  if (последняя && последняя._подпись === подпись) { последняя.to = at; return; }
  const scene = data.scene && typeof data.scene === 'object' ? data.scene : {};
  главы.push({
    _подпись: подпись, from: at, to: at,
    date: значимо(scene['Дата']) ? текст(scene['Дата']) : '', place: местоСцены(data),
    label: музыка.label || '', why: музыка.why || '',
    soundtrack: музыка.soundtrack || [], scene: музыка.scene || null, phone: музыка.phone || null,
  });
}

// Настроения по персонажам — тоже только смены.
// Настроение живёт в трекере (me.md → memory.mood): игрок и главный
// персонаж. Раньше архив искал его у персонажей и не находил ни одного.
function имяГлавного(data) {
  try { const c = window.SillyTavern?.getContext?.(); if (c && c.name2) return имяБезПриставки(String(c.name2)); } catch (_) { /* нет Таверны */ }
  return текст(Array.isArray(data.characters) && data.characters[0] && data.characters[0]['Имя']);
}
function собратьНастроения(накоп, data, at) {
  const персонажи = [];
  if (data.user && typeof data.user === 'object') персонажи.push(data.user);
  if (Array.isArray(data.characters)) персонажи.push(...data.characters);
  const трекер = data.memory && data.memory.mood && typeof data.memory.mood === 'object' ? data.memory.mood : {};
  const сейчас = (x) => текст(x && (x.current ?? x.nw));
  if (значимо(сейчас(трекер.user))) персонажи.push({ 'Имя': текст(data.user && data.user['Имя']) || getSafeUserName(), 'Настроение': сейчас(трекер.user) });
  if (значимо(сейчас(трекер.char))) персонажи.push({ 'Имя': имяГлавного(data), 'Настроение': сейчас(трекер.char) });
  for (const c of персонажи) {
    const имя = чистоеИмя(c['Имя'] || c.N || c.name);
    const настроение = текст(c['Настроение'] || c.Md);
    if (!имя || !значимо(настроение)) continue;
    const k = ключИмени(имя);
    if (!k) continue;
    let линия = накоп.get(k);
    if (!линия) { линия = { name: имя, changes: [] }; накоп.set(k, линия); }
    const прошлый = линия.changes[линия.changes.length - 1];
    if (!прошлый || прошлый.mood.toLowerCase() !== настроение.toLowerCase()) линия.changes.push({ mood: настроение, at });
  }
}

// Беременности по ходам: у каждого человека — свои, одна за другой. Поле
// Беременность — строка кодов «wk: 6; due: 07.08.2027; fa: …; knw: …; lost: …».
const ПОЛЯ_БЕРЕМЕННОСТИ = {
  wk: 'неделя', 'неделя': 'неделя', due: 'роды', 'роды': 'роды', fa: 'отец', 'отец': 'отец',
  knw: 'знают', 'кто знает': 'знают', cnd: 'как', 'как проходит': 'как',
  lost: 'потеря', 'потеря': 'потеря', brn: 'родила', 'родила': 'родила',
  sy: 'симптомы', 'симптомы': 'симптомы', vis: 'визит', 'визит к врачу': 'визит',
};
export function меткиБеременности(v) {
  const о = {};
  for (const кусок of текст(v).split(';')) {
    const м = кусок.match(/^\s*([^:：]{1,20})[:：]\s*([\s\S]*)$/);
    if (!м) continue;
    const к = ПОЛЯ_БЕРЕМЕННОСТИ[м[1].trim().toLowerCase()];
    if (к && значимо(м[2])) о[к] = текст(м[2]);
  }
  const н = parseInt(String(о.неделя || '').replace(/[^\d]/g, ''), 10);
  о.неделя = Number.isFinite(н) && н > 0 && н <= 45 ? н : null;
  return о;
}
const ДЕНЬ_МС = 86400000;
function собратьБеременности(накоп, data, at, игрок) {
  const люди = [];
  if (data.user && typeof data.user === 'object') люди.push({ ...data.user, 'Имя': текст(data.user['Имя']) || игрок, __игрок: true });
  if (Array.isArray(data.characters)) люди.push(...data.characters);
  const дата = текст(data.scene && data.scene['Дата']);
  const датаMs = значимо(дата) ? parseSceneDate(дата) : null;
  for (const c of люди) {
    const поле = c && c['Беременность'];
    if (!значимо(поле)) continue;
    const имя = чистоеИмя(c['Имя'] || c.N || c.name);
    const k = ключИмени(имя);
    if (!k) continue;
    const п = меткиБеременности(поле);
    if (!накоп.has(k)) накоп.set(k, []);
    const все = накоп.get(k);
    let эп = все[все.length - 1];
    const разрыв = эп && датаMs !== null && эп._датаMs !== null ? (датаMs - эп._датаMs) / ДЕНЬ_МС : 0;
    // Новая беременность: срок упал (после исхода — на неделю и больше, без
    // исхода — сильно: модель иногда путается на пару недель), или после
    // исхода прошло больше полутора месяцев сюжета.
    const новая = !эп
      || (эп.outcome && ((п.неделя !== null && эп.weekTo !== null && п.неделя < эп.weekTo - 1) || разрыв > 45))
      || (!эп.outcome && п.неделя !== null && эп.weekTo !== null && п.неделя < эп.weekTo - 4);
    if (новая) {
      эп = { name: имя, player: !!c.__игрок, from: at, to: at, dateFrom: значимо(дата) ? дата : '', dateTo: '', weekFrom: п.неделя, weekTo: п.неделя,
        due: '', father: '', knows: '', state: '', symptoms: '', visit: '', course: [], outcome: null, _датаMs: датаMs };
      все.push(эп);
    }
    эп.to = at;
    if (значимо(дата)) { эп.dateTo = дата; эп._датаMs = датаMs; if (!эп.dateFrom) эп.dateFrom = дата; }
    if (п.неделя !== null) { эп.weekTo = п.неделя; if (эп.weekFrom === null) эп.weekFrom = п.неделя; }
    if (п.роды) эп.due = п.роды;
    if (п.отец) эп.father = чистоеИмя(п.отец);
    if (п.знают) эп.knows = п.знают;
    // Как проходит — история: «угроза прерывания», «тонус», «стабильно». Пишем смены.
    if (п.как && п.как !== эп.state) { эп.course.push({ text: п.как, at }); if (эп.course.length > 15) эп.course.shift(); }
    if (п.как) эп.state = п.как;
    if (п.симптомы) эп.symptoms = п.симптомы;
    if (п.визит) эп.visit = п.визит;
    if (!эп.outcome && (п.потеря || п.родила)) эп.outcome = { kind: п.родила ? 'birth' : 'loss', text: п.родила || п.потеря, at, date: значимо(дата) ? дата : '' };
  }
}

// Сколько дней прошло в сюжете. Даты в HUD пишет модель, формат гуляет:
// «16.01.2025», «2025-03-15», «16 января». Разбираем что можем, остальное
// честно считаем неизвестным — выдумывать длину сюжета нельзя.
const МЕСЯЦЫ = ['январ', 'феврал', 'март', 'апрел', 'мая|май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
export function parseSceneDate(raw) {
  const s = текст(raw).toLowerCase().replace(/[ё]/g, 'е');
  if (!s) return null;
  let m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/);
  if (m) { const y = +m[3]; return Date.UTC(y < 100 ? 2000 + y : y, +m[2] - 1, +m[1]); }
  m = s.match(/(\d{1,2})\s+([а-я]+)(?:\s+(\d{4}))?/);
  if (m) {
    const i = МЕСЯЦЫ.findIndex(x => new RegExp('^(?:' + x + ')').test(m[2]));
    if (i >= 0) return Date.UTC(m[3] ? +m[3] : 2000, i, +m[1]);
  }
  // По-английски: «17 October 2024», «October 17th, 2024».
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,})\.?,?(?:\s+(\d{4}))?/) || s.match(/([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?!\d)(?:,?\s+(\d{4}))?/);
  if (m) {
    const [д, слово] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    const i = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].findIndex(x => слово.startsWith(x));
    if (i >= 0 && +д >= 1 && +д <= 31) return Date.UTC(m[3] ? +m[3] : 2000, i, +д);
  }
  return null;
}

// --- Главная функция ---------------------------------------------------------

/**
 * Считает сводку по диапазону сообщений [startIndex, endIndex] включительно.
 * Обработка идёт кусками, чтобы длинный чат не вешал вкладку: между кусками
 * отдаём управление браузеру и сообщаем прогресс.
 */
// Уступить время браузеру между кусками разбора. requestIdleCallback ждёт
// настоящего простоя, поэтому прокрутка и ввод во время долгого анализа не
// дёргаются; таймаут не даёт зависнуть, если простоя всё нет.
function передышка() {
  return new Promise(готово => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => готово(), { timeout: 120 });
    else setTimeout(готово, 0);
  });
}

export async function analyzeChat(startIndex, endIndex, options = {}) {
  const chat = getChatMessages();
  const total = chat.length;
  let from = Math.max(0, Math.min(total - 1, Math.floor(Number(startIndex) || 0)));
  let to = Math.max(0, Math.min(total - 1, Math.floor(Number(endIndex))));
  if (Number.isNaN(to)) to = total - 1;
  if (to < from) [from, to] = [to, from];

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false;
  const КУСОК = 25;

  const секреты = new Map();
  const отношения = new Map();
  const настроения = new Map();
  const сцена = { dates: [], locations: [], последняяДата: '', последнееМесто: '' };
  const персонажи = new Map();
  const погода = new Map();
  const ружья = new Map();
  const саундтрек = [];
  const беременности = new Map();
  // Дата и время каждого хода: архив пишет их рядом с номером. Ход без даты
  // берёт день прошлого хода — сцена идёт дальше, пока модель не сменит дату.
  const моменты = {};
  let деньСцены = '';
  const отметить = (at, scene) => {
    const д = текст(scene && scene['Дата']), t = текст(scene && scene['Время']);
    if (значимо(д)) деньСцены = д;
    if (деньСцены || значимо(t)) моменты[at] = { date: деньСцены, time: значимо(t) ? t : '' };
  };
  const игрок = getSafeUserName();

  // Дашборд считает все сообщения, а не только с HUD, — в этом же проходе.
  const дашборд = createDashboard({ userName: getSafeUserName() });
  // Блоки выгруженных ходов (offload.js) — из файла, до прохода. Не
  // загрузились — эти ходы возьмём из летописи, как у вычищенного чата.
  try { await подгрузитьЧат(chat); } catch (_) { /* летопись подстрахует */ }

  // Летопись (chronicle.js): выжимки HUD, которые остались после чистки
  // сообщений. HUD в сообщении есть — он и главный, и пополняет летопись; нет —
  // берём выжимку из летописи; нет и её — хотя бы дату из тега <time>.
  let летопись = new Map();
  try { летопись = await летописьЧата(); } catch (_) { /* без летописи — как раньше */ }
  const вЛетопись = new Map();

  let сОбработанным = 0;
  let битых = 0;
  let изЛетописи = 0;
  let датИзТегов = 0;
  let внеЧата = 0;

  const учестьХод = (data, i, музыка = null) => {
    сОбработанным++;
    отметить(i, data.scene);
    собратьСаундтрек(саундтрек, музыка, data, i);
    собратьСекреты(секреты, data, i);
    собратьОтношения(отношения, data, i);
    собратьСцену(сцена, data, i);
    собратьНастроения(настроения, data, i);
    собратьРужья(ружья, data, i);
    собратьБеременности(беременности, data, i, игрок);

    const имена = [];
    if (data.user && значимо(data.user['Имя'])) имена.push(чистоеИмя(data.user['Имя']));
    if (Array.isArray(data.characters)) for (const c of data.characters) {
      if (значимо(c['Имя'])) имена.push(чистоеИмя(c['Имя']));
    }
    for (const имя of имена) {
      const k = ключИмени(имя);
      if (k && !персонажи.has(k)) персонажи.set(k, { name: имя, firstSeen: i });
    }
    const w = текст(data.scene && data.scene['Погода']);
    if (значимо(w)) погода.set(w.toLowerCase(), (погода.get(w.toLowerCase()) || 0) + 1);
  };

  // Ходы летописи, которых среди сообщений чата нет: старый чат был длиннее,
  // часть сообщений при чистке удалили, или к своей добавлена летопись
  // другого чата. Они тоже сюжет — встают на своё место по порядку летописи,
  // перед первым сообщением чата, что идёт в ней после них. Номер у такого
  // хода дробный (до #i), к сообщению он не ведёт. Дубли не считаем: тот же
  // ключ — это то же сообщение; та же дата, время и место — тот же ход копии,
  // у которой сменились ключи.
  const ключиЧата = new Set(chat.map((m, k) => ключСообщения(m, k)));
  const подписьХода = (в) => {
    const sc = в && в.scene || {};
    const д = текст(sc['Дата']), t = текст(sc['Время']);
    return значимо(д) && значимо(t) ? (д + '|' + t + '|' + местоСцены(в)).toLowerCase() : '';
  };
  const подписиЧата = new Set();
  const порядокЛетописи = new Map();
  const лишние = [];
  [...летопись.keys()].forEach((к, поз) => {
    порядокЛетописи.set(к, поз);
    if (ключиЧата.has(к)) { const п = подписьХода(летопись.get(к)); if (п) подписиЧата.add(п); }
    else лишние.push({ поз, к });
  });
  let следующийЛишний = 0;
  const вставитьЛишние = (доПозиции, at, учесть) => {
    while (следующийЛишний < лишние.length && лишние[следующийЛишний].поз < доПозиции) {
      const { к } = лишние[следующийЛишний++];
      if (!учесть) continue;
      const в = летопись.get(к);
      const п = подписьХода(в);
      if (п && подписиЧата.has(п)) continue;
      if (п) подписиЧата.add(п);
      внеЧата++;
      учестьХод(в, at, в.music || null);
    }
  };

  for (let i = from; i <= to; i++) {
    if (i > from && (i - from) % КУСОК === 0) {
      if (onProgress) onProgress(i - from, to - from + 1);
      await передышка();
      if (shouldStop()) return null;
    }
    const raw = развернутьHUD(текст(chat[i] && (chat[i].mes ?? '')));
    const естьHud = !!raw && !!extractHudBlock(raw);
    let data = естьHud ? разобрать(chat[i]) : null;
    const ключ = ключСообщения(chat[i], i);
    // Ходы летописи вне чата — перед этим сообщением, если оно в ней есть. До
    // начала отрезка («последние 50») их не берём: они раньше него.
    if (порядокЛетописи.has(ключ)) вставитьЛишние(порядокЛетописи.get(ключ), i - 0.5, i > from || from === 0);
    // Музыка хода: из самого сообщения, а у вычищенного — из летописи.
    let музыка = музыкаДляЛетописи(музыкаХода(chat[i]));
    if (data) { const в = выжимкаHUD(data, музыка); if (в) вЛетопись.set(ключ, в); }
    else if (chat[i] && !chat[i].is_user && летопись.has(ключ)) { data = летопись.get(ключ); изЛетописи++; }
    if (!музыка && data && data.music) музыка = data.music;
    дашборд.add(chat[i], data, i);
    if (!data) {
      if (естьHud) битых++;
      else if (chat[i] && !chat[i].is_user) {
        const д = датаИзТегов(raw);
        if (д) { собратьСцену(сцена, { scene: { 'Дата': д.дата, 'Время': д.время } }, i); отметить(i, { 'Дата': д.дата, 'Время': д.время }); датИзТегов++; }
      }
      continue;
    }
    учестьХод(data, i, музыка);
  }
  // Хвост летописи после последнего сообщения — если отрезок до конца чата.
  вставитьЛишние(Infinity, to + 0.5, to === total - 1);
  if (onProgress) onProgress(to - from + 1, to - from + 1);
  if (вЛетопись.size) дописатьВЛетопись(вЛетопись).catch(() => {});

  // Длительность сюжета: считаем по разобранным датам. Если разобрать не
  // удалось ни одной — так и пишем, вместо выдуманного числа.
  const метки = сцена.dates.map(d => parseSceneDate(d.date)).filter(v => v !== null);
  const дней = метки.length >= 2
    ? Math.round((Math.max(...метки) - Math.min(...метки)) / 86400000) + 1
    : (метки.length === 1 ? 1 : null);

  const секретыМассив = [...секреты.values()].map(s => {
    delete s._знали; delete s._ключи; delete s._основы;
    return s;
  }).sort((a, b) => a.firstSeen - b.firstSeen);

  const ружьяМассив = [...ружья.values()].map(g => { delete g._ключи; delete g._основы; return g; }).sort((a, b) => a.firstSeen - b.firstSeen);
  const беременностиМассив = [...беременности.values()].flat().map(э => { delete э._датаMs; return э; }).sort((a, b) => a.from - b.from);
  for (const г of саундтрек) delete г._подпись;
  const всехТреков = new Set(саундтрек.flatMap(г => [...г.soundtrack, ...((г.scene && г.scene.tracks) || [])].map(т => (т.a + '|' + т.t).toLowerCase())));

  const отношенияОбъект = {};
  let пар = 0;
  for (const ветка of отношения.values()) {
    const цели = {};
    for (const линия of ветка.targets.values()) { цели[линия.name] = линия.changes; пар++; }
    отношенияОбъект[ветка.name] = цели;
  }

  const настроенияМассив = [...настроения.values()].sort((a, b) => b.changes.length - a.changes.length);
  const сменНастроения = настроенияМассив.reduce((n, x) => n + Math.max(0, x.changes.length - 1), 0);

  return {
    version: ВЕРСИЯ_ОТЧЁТА,
    range: { from, to, chatLength: total },
    generatedAt: new Date().toISOString(),
    moments: моменты,
    pregnancies: беременностиМассив,
    secrets: секретыМассив,
    relations: отношенияОбъект,
    dates: сцена.dates,
    locations: сцена.locations,
    moods: настроенияМассив,
    dashboard: дашборд.finish(),
    guns: ружьяМассив,
    soundtrack: саундтрек,
    stats: {
      totalMessages: to - from + 1,
      withHud: сОбработанным,
      // Из них — по летописи (HUD из сообщения вычищен), и ходов, где дата
      // взята только из тега <time>.
      fromChronicle: изЛетописи,
      // Ходы летописи, которых в этом чате нет совсем (без дублей).
      chronicleOnly: внеЧата,
      datesFromTags: датИзТегов,
      brokenHud: битых,
      uniqueCharacters: персонажи.size,
      characters: [...персонажи.values()].map(x => x.name),
      locationChanges: Math.max(0, сцена.locations.length - 1),
      uniqueLocations: new Set(сцена.locations.map(l => l.place.toLowerCase())).size,
      moodChanges: сменНастроения,
      dateChanges: Math.max(0, сцена.dates.length - 1),
      storyDays: дней,
      secretsTotal: секретыМассив.length,
      secretsRevealedToSomeone: секретыМассив.filter(s => s.knows.length).length,
      relationPairs: пар,
      gunsTotal: ружьяМассив.length,
      soundtrackChapters: саундтрек.length,
      soundtrackTracks: всехТреков.size,
      gunsFired: ружьяМассив.filter(g => g.statusHistory.some(h => h.status === 'fired')).length,
      weather: [...погода.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ kind: k, times: v })),
    },
  };
}

// --- Кэш ---------------------------------------------------------------------
//
// Разбор трёхсот сообщений — это триста запусков JSON-парсера, и на слабой
// машине это ощутимо. Результат кладём в localStorage под ключ чата и
// диапазона. Подпись хранит длину чата и хвост последнего сообщения: если
// в чат дописали или откатили ход, кэш признаётся устаревшим.

const ПРЕФИКС = 'hud_archive_';

export function chatSignature() {
  const chat = getChatMessages();
  const last = текст(chat.length ? (chat[chat.length - 1].mes || '') : '');
  // Пополнилась летопись (HUD вычищенных сообщений) — прошлый отчёт устарел.
  const летопись = летописьЕсли();
  return chat.length + ':' + last.length + ':' + last.slice(-40).replace(/\s+/g, ' ') + ':' + (летопись ? летопись.size : 0);
}

function ключКэша(from, to) {
  let id = '';
  try {
    const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
    id = текст(ctx && (ctx.chatId || ctx.getCurrentChatId && ctx.getCurrentChatId()));
  } catch (_) {}
  if (!id) {
    // Запасной ключ: номер и имя карточки. Берём из getContext() — глобальных
    // window.this_chid и window.characters в текущем SillyTavern нет.
    let номер, имя;
    try {
      const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
      номер = ctx && ctx.characterId !== undefined ? ctx.characterId : window.this_chid;
      const список = ctx && Array.isArray(ctx.characters) ? ctx.characters : window.characters;
      имя = список && номер !== undefined && список[номер] && список[номер].name;
    } catch (_) {}
    id = текст(номер) + '/' + текст(имя);
  }
  return ПРЕФИКС + id + '_' + from + '_' + to;
}

// Отчёт старого устройства (без дат у ходов, с дублями секретов) считаем
// устаревшим: пересчёт быстрее, чем объяснять, почему в нём другое.
export const ВЕРСИЯ_ОТЧЁТА = 2;
export async function readCache(from, to) {
  const payload = await readEntry(ключКэша(from, to));
  if (!payload || !payload.report) return null;
  payload.stale = payload.signature !== chatSignature() || payload.report.version !== ВЕРСИЯ_ОТЧЁТА;
  return payload;
}

export async function writeCache(from, to, report) {
  // Не поместилось — не повод ронять анализ: отчёт уже готов и показан,
  // кэш здесь только ускоряет повтор.
  return writeEntry(ключКэша(from, to), {
    signature: chatSignature(), savedAt: new Date().toISOString(), report,
  });
}

// Чистка архива целиком — и в IndexedDB, и в том, что осталось от
// localStorage у прошлых версий.
export function clearCache() { return clearAll(); }

// Сколько места занято архивом. Нужно кнопке очистки в настройках.
export function cacheUsage() { return usage(); }
