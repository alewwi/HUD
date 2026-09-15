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

import { parseHUDComplex } from './hud-parser.js?v=22.99.54';
import { normalizeJSONData } from './schema.js?v=22.99.54';
import { parseRelationList } from './render/relations-graph.js?v=22.99.54';
import { nameLettersOnly, namePhoneticLatin } from './names.js?v=22.99.54';
import { hudFilled, getSafeUserName } from './utils.js?v=22.99.54';
import { createDashboard } from './chat-stats.js?v=22.99.54';
import { статусРужья } from './codes.js?v=22.99.54';
import { readEntry, writeEntry, clearAll, usage } from './store.js?v=22.99.54';

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

// Извлечение блока [HUD] из текста сообщения. Тот же набор написаний, что и в
// index.js: модель иногда шлёт < > вместо скобок, а ST успевает заэкранировать.
// Поиск блока — общий, в hud-block.js. Экспорт оставлен: его берут отсюда.
import { extractHudBlock } from './hud-block.js?v=22.99.54';
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
  const raw = текст(mes && (mes.mes ?? mes.message ?? ''));
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
  for (const s of secrets) {
    const key = ключФакта(s.fact);
    if (!key) continue;
    let item = накоп.get(key);
    if (!item) {
      item = { fact: текст(s.fact), level: текст(s.level), firstSeen: at, lastSeen: at,
        statusHistory: [], knows: [], unaware: [], _знали: new Map() };
      накоп.set(key, item);
    }
    item.lastSeen = at;
    // Уровень берём самый высокий за всё время, а не последний. Модель часто
    // опускает поле, и схема подставляет «medium» — последним значением такой
    // дефолт затирал настоящий «high», записанный в момент появления секрета.
    if (значимо(s.level)) {
      const новый = текст(s.level).toLowerCase();
      if (ВЕС_УРОВНЯ[новый] === undefined) { if (!item.level) item.level = новый; }
      else if ((ВЕС_УРОВНЯ[item.level] ?? -1) < ВЕС_УРОВНЯ[новый]) item.level = новый;
    }
    // Формулировку берём самую длинную: короткая обычно обрезана моделью.
    if (текст(s.fact).length > item.fact.length) item.fact = текст(s.fact);

    const status = текст(s.status).toLowerCase() || 'unknown';
    const прошлый = item.statusHistory[item.statusHistory.length - 1];
    if (!прошлый || прошлый.status !== status) item.statusHistory.push({ status, at });

    for (const k of (Array.isArray(s.knows) ? s.knows : [])) {
      const имя = текст(k && k.name);
      const kk = ключИмени(имя);
      if (!kk) continue;
      if (!item._знали.has(kk)) {
        item._знали.set(kk, true);
        item.knows.push({ name: имя, source: текст(k && k.source), since: at });
      }
    }
    // «Не знают» — состояние на последний ход, а не история: список тает по
    // мере того, как секрет расходится.
    item.unaware = (Array.isArray(s.hidden) ? s.hidden : []).map(текст).filter(Boolean);
  }
}

// Отношения. Пишем только смены тега: иначе на 300 сообщений выйдет 300
// одинаковых строк «влюблён».
function собратьОтношения(накоп, data, at) {
  const персонажи = [];
  if (data.user && typeof data.user === 'object') персонажи.push(data.user);
  if (Array.isArray(data.characters)) персонажи.push(...data.characters);

  for (const c of персонажи) {
    const субъект = текст(c['Имя'] || c.N || c.name);
    if (!субъект) continue;
    const пары = parseRelationList(c['Отношения'] || c.Rel || '');
    if (!пары.length) continue;
    const sk = ключИмени(субъект);
    if (!sk) continue;
    let ветка = накоп.get(sk);
    if (!ветка) { ветка = { name: субъект, targets: new Map() }; накоп.set(sk, ветка); }
    for (const пара of пары) {
      const tk = ключИмени(пара.target);
      if (!tk || tk === sk) continue;
      let линия = ветка.targets.get(tk);
      if (!линия) { линия = { name: пара.target, changes: [] }; ветка.targets.set(tk, линия); }
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
  for (const строка of ружья) {
    const [завязка = '', кто = '', статус = ''] = String(строка).split('|').map(текст);
    const key = ключФакта(завязка);
    if (!key) continue;
    let item = накоп.get(key);
    if (!item) {
      item = { setup: завязка, tiedTo: кто, firstSeen: at, lastSeen: at, statusHistory: [] };
      накоп.set(key, item);
    }
    item.lastSeen = at;
    // Формулировку берём самую полную, связь — свежую.
    if (завязка.length > item.setup.length) item.setup = завязка;
    if (кто) item.tiedTo = кто;
    const s = статусРужья(статус).ключ;
    const прошлый = item.statusHistory[item.statusHistory.length - 1];
    if (!прошлый || прошлый.status !== s) item.statusHistory.push({ status: s, at });
  }
}

// Хронология сцены: дата, время, место. Записываем только моменты смены —
// это и есть скелет сюжета.
function собратьСцену(состояние, data, at) {
  const scene = data.scene && typeof data.scene === 'object' ? data.scene : {};
  const дата = текст(scene['Дата']);
  const время = текст(scene['Время']);
  const место = текст(scene['Место']);

  if (значимо(дата) && дата !== состояние.последняяДата) {
    состояние.dates.push({ date: дата, time: значимо(время) ? время : '', at });
    состояние.последняяДата = дата;
  }
  if (значимо(место) && место !== состояние.последнееМесто) {
    состояние.locations.push({ place: место, at });
    состояние.последнееМесто = место;
  }
}

// Настроения по персонажам — тоже только смены.
function собратьНастроения(накоп, data, at) {
  const персонажи = [];
  if (data.user && typeof data.user === 'object') персонажи.push(data.user);
  if (Array.isArray(data.characters)) персонажи.push(...data.characters);
  for (const c of персонажи) {
    const имя = текст(c['Имя'] || c.N || c.name);
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

  // Дашборд считает все сообщения, а не только с HUD, — в этом же проходе.
  const дашборд = createDashboard({ userName: getSafeUserName() });

  let сОбработанным = 0;
  let битых = 0;

  for (let i = from; i <= to; i++) {
    if (i > from && (i - from) % КУСОК === 0) {
      if (onProgress) onProgress(i - from, to - from + 1);
      await передышка();
      if (shouldStop()) return null;
    }
    const raw = текст(chat[i] && (chat[i].mes ?? ''));
    const естьHud = !!raw && !!extractHudBlock(raw);
    const data = естьHud ? разобрать(chat[i]) : null;
    дашборд.add(chat[i], data, i);
    if (!естьHud) continue;
    if (!data) { битых++; continue; }
    сОбработанным++;

    собратьСекреты(секреты, data, i);
    собратьОтношения(отношения, data, i);
    собратьСцену(сцена, data, i);
    собратьНастроения(настроения, data, i);
    собратьРужья(ружья, data, i);

    const имена = [];
    if (data.user && значимо(data.user['Имя'])) имена.push(текст(data.user['Имя']));
    if (Array.isArray(data.characters)) for (const c of data.characters) {
      if (значимо(c['Имя'])) имена.push(текст(c['Имя']));
    }
    for (const имя of имена) {
      const k = ключИмени(имя);
      if (k && !персонажи.has(k)) персонажи.set(k, { name: имя, firstSeen: i });
    }
    const w = текст(data.scene && data.scene['Погода']);
    if (значимо(w)) погода.set(w.toLowerCase(), (погода.get(w.toLowerCase()) || 0) + 1);
  }
  if (onProgress) onProgress(to - from + 1, to - from + 1);

  // Длительность сюжета: считаем по разобранным датам. Если разобрать не
  // удалось ни одной — так и пишем, вместо выдуманного числа.
  const метки = сцена.dates.map(d => parseSceneDate(d.date)).filter(v => v !== null);
  const дней = метки.length >= 2
    ? Math.round((Math.max(...метки) - Math.min(...метки)) / 86400000) + 1
    : (метки.length === 1 ? 1 : null);

  const секретыМассив = [...секреты.values()].map(s => {
    delete s._знали;
    return s;
  }).sort((a, b) => a.firstSeen - b.firstSeen);

  const ружьяМассив = [...ружья.values()].sort((a, b) => a.firstSeen - b.firstSeen);

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
    range: { from, to, chatLength: total },
    generatedAt: new Date().toISOString(),
    secrets: секретыМассив,
    relations: отношенияОбъект,
    dates: сцена.dates,
    locations: сцена.locations,
    moods: настроенияМассив,
    dashboard: дашборд.finish(),
    guns: ружьяМассив,
    stats: {
      totalMessages: to - from + 1,
      withHud: сОбработанным,
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
  return chat.length + ':' + last.length + ':' + last.slice(-40).replace(/\s+/g, ' ');
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

export async function readCache(from, to) {
  const payload = await readEntry(ключКэша(from, to));
  if (!payload || !payload.report) return null;
  payload.stale = payload.signature !== chatSignature();
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
