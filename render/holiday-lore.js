// hud-manager/render/holiday-lore.js
//
// Праздники мира — свои праздники сюжета, которые модель придумала или нашла
// по карточке, персоне и лорбукам (окно — render/holiday-gen.js, кнопка — в
// календаре телефона). Здесь лёгкая часть, что нужна всегда:
//   · хранение в данных чата (tavernosHudHolidays): список и ответы игрока;
//   · разбор ответа модели (JSON-список) — разобратьПраздники;
//   · праздники на год для календаря — праздникиМираГода;
//   · напоминание модели в день праздника или заранее — заметкаПраздниковМира
//     (настройка holidayReminder);
//   · плашка «через N дней — праздник, начать подготовку?» над вкладками
//     (настройка holidayPrepDays): «да» уходит модели разовой подсказкой.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.71';
import { settings } from '../settings.js?v=23.89.71';
import { добавитьПодсказку, убратьПодсказкиПраздника, убратьПодсказкиПоКлючу } from '../turn-notes.js?v=23.89.71';
import { праздникиГода } from './holidays.js?v=23.89.71';
import { раскрывашка } from './fold.js?v=23.89.71';
import { старина } from '../era.js?v=23.89.71';
import { примерМета } from '../sample-meta.js?v=23.89.71';

const КЛЮЧ = 'tavernosHudHolidays';
const ДЕНЬ = 864e5;

// --- Связь с index.js: профили, лорбуки, уведомления --------------------------
let связь = {};
/** index.js отдаёт то, чего у модуля нет: профили подключения, лорбуки, тосты. */
export function подключитьПраздники(с = {}) { связь = { ...связь, ...с }; }
export const связьПраздников = () => связь;

// --- Хранилище -----------------------------------------------------------------
function контекст() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; } }
function хранилище() {
  // Пример в «Кастомизации» (sample-meta.js): своё «уже сгенерированное», без сохранения.
  const ctx = контекст();
  const мета = примерМета() || (ctx && (ctx.chatMetadata || ctx.chat_metadata));
  if (!мета) return null;
  const х = (мета[КЛЮЧ] && typeof мета[КЛЮЧ] === 'object') ? мета[КЛЮЧ] : (мета[КЛЮЧ] = {});
  if (!Array.isArray(х.список)) х.список = [];
  if (!х.ответы || typeof х.ответы !== 'object') х.ответы = {};
  return х;
}
let таймер = 0;
function сохранить() {
  if (примерМета()) return;
  clearTimeout(таймер);
  таймер = setTimeout(() => { const ctx = контекст(); try { (ctx?.saveMetadataDebounced || ctx?.saveMetadata)?.call(ctx); } catch (_) {} }, 300);
}

/** Праздники мира этого чата: [{ id, имя, дата: 'ДД.ММ' | 'ДД.ММ.ГГГГ', о, ежегодно }]. */
export function праздникиМира() { const х = хранилище(); return х ? х.список.slice() : []; }
/** Добавить в календарь; совпадающие по имени и дню не дублируются. → сколько добавлено. */
export function добавитьПраздникиМира(новые) {
  const х = хранилище();
  if (!х) return 0;
  let n = 0;
  for (const п of новые || []) {
    if (!п || !п.имя || !п.дата) continue;
    if (х.список.some(б => б.имя.toLowerCase() === п.имя.toLowerCase() && б.дата.slice(0, 5) === п.дата.slice(0, 5))) continue;
    х.список.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), имя: п.имя, дата: п.дата, о: п.о || '', ежегодно: п.ежегодно !== false, ...(п.ярмарка ? { ярмарка: true } : {}) });
    n++;
  }
  if (n) сохранить();
  return n;
}
export function убратьПраздникМира(id) {
  const х = хранилище();
  if (!х) return;
  const убран = х.список.find(п => п.id === id);
  х.список = х.список.filter(п => п.id !== id);
  // Вместе с праздником — ответ на «начать подготовку?», подсказка, ещё не
  // ушедшая модели, и детали «как празднуют»: убранный праздник в запрос не
  // попадает ничем.
  for (const к of Object.keys(х.ответы)) if (к.startsWith(id + '|')) delete х.ответы[к];
  убратьПодсказкиПраздника(id);
  if (убран) забытьДеталиПраздника(убран.имя, убран.дата);
  сохранить();
}

/** Стабильные названия встроенных праздников, скрытых только в этом чате. */
export function скрытыеПраздникиЭпохи() {
  const скрытые = хранилище()?.скрытыеЭпохи;
  return new Set(Array.isArray(скрытые) ? скрытые : []);
}

export function скрытьПраздникЭпохи(название, скрыть) {
  const х = хранилище();
  if (!х || !название) return;
  const скрытые = скрытыеПраздникиЭпохи();
  if (скрыть) скрытые.add(название); else скрытые.delete(название);
  х.скрытыеЭпохи = [...скрытые];
  сохранить();
}

// --- Как празднуют: суть и три детали (render/holiday-day.js) -------------------
// Ключ — название и день: у праздника мира, праздника эпохи и события из
// календаря телефона детали одни, откуда бы праздник ни пришёл.
export const ключПраздника = (имя, дата) => String(имя || '').trim().toLowerCase().replace(/ё/g, 'е') + '|' + String(дата || '').slice(0, 5);
/** { суть, обычай, место, событие, когда } или null. */
export function деталиПраздника(имя, дата) {
  const х = хранилище();
  const д = х && х.детали && х.детали[ключПраздника(имя, дата)];
  return д && typeof д === 'object' ? { ...д } : null;
}
export function сохранитьДеталиПраздника(имя, дата, детали) {
  const х = хранилище();
  if (!х || !имя || !дата || !детали) return false;
  if (!х.детали || typeof х.детали !== 'object') х.детали = {};
  х.детали[ключПраздника(имя, дата)] = { имя: String(имя).trim(), суть: детали.суть || '', обычай: детали.обычай || '', место: детали.место || '', событие: детали.событие || '', ...(Number.isFinite(+детали.год) && +детали.год > 0 ? { год: +детали.год } : {}), когда: Date.now() };
  сохранить();
  return true;
}
/**
 * Забыть детали праздника и снять их подсказку из очереди: «Придумать заново»
 * и убранный праздник — модели уже не уходит ни старая заметка, ни подсказка.
 */
export function забытьДеталиПраздника(имя, дата) {
  const х = хранилище();
  if (!х || !имя || !дата) return false;
  const к = ключПраздника(имя, дата);
  const было = !!(х.детали && х.детали[к]);
  if (было) delete х.детали[к];
  const подсказка = убратьПодсказкиПоКлючу('holidayDetails', { ключ: к });
  if (было) сохранить();
  return было || подсказка;
}
/** Детали одной строкой — для модели: разовая подсказка и заметка в сам день. */
export function деталиСтрокой(д) {
  if (!д) return '';
  return [д.суть && безТочки(д.суть), д.обычай && 'custom: ' + безТочки(д.обычай), д.место && 'place: ' + безТочки(д.место), д.событие && 'event: ' + безТочки(д.событие)].filter(Boolean).join('; ');
}
/**
 * В сам день праздника — его суть и три детали, если игрок их получил:
 * модель показывает их в мире вокруг, а участвовать или нет — решает игрок.
 */
export function заметкаДеталейПраздника(сцена) {
  if ((settings.holidayReminder || 'day') === 'off' || !Number.isFinite(сцена)) return '';
  const х = хранилище();
  if (!х || !х.детали) return '';
  const д = new Date(сцена);
  const день = `${дд(д.getUTCDate())}.${дд(д.getUTCMonth() + 1)}`;
  // Детали уходят, только пока их праздник жив: праздник мира — когда
  // «Праздники мира» включены, встроенный — когда праздники эпохи включены и
  // он не убран крестиком в этом чате. Событие из календаря телефона — всегда.
  const имяК = (s) => String(s || '').trim().toLowerCase().replace(/ё/g, 'е');
  const скрытые = скрытыеПраздникиЭпохи();
  let эпохи = null;
  const год = д.getUTCFullYear();
  const живы = (з) => {
    // Разовый праздник (событие календаря с годом) — только в свой год.
    if (з.год && з.год !== год) return false;
    const и = имяК(з.имя);
    // Ярмарка, которую расставил HUD, — только если в этот день она и правда есть:
    // в ту же дату через год её может не быть.
    // Событие календаря с годом («Ярмарка» в 2031-м) — своя запись, ей правило ниже.
    if (и === имяК(ЯРМАРКА) && !з.год) return ярмаркиВкл() && ярмаркиЧата(сцена).some(п => п.дата === Date.UTC(год, д.getUTCMonth(), д.getUTCDate()));
    const мира = х.список.filter(п => имяК(п.имя) === и && String(п.дата).slice(0, 5) === день);
    // Праздник мира с годом в дате — разовый: в другие годы его нет.
    if (мира.length) return settings.holidayGen !== false && мира.some(п => String(п.дата).length <= 5 || п.ежегодно || +String(п.дата).slice(6) === год);
    эпохи ??= (() => { try { return праздникиГода(д.getUTCFullYear()); } catch (_) { return []; } })();
    const э = эпохи.find(п => (имяК(п.имя) === и || имяК(п.модели) === и) && (() => { const t = new Date(п.дата); return `${дд(t.getUTCDate())}.${дд(t.getUTCMonth() + 1)}` === день; })());
    if (э) return settings.enableEraHolidays !== false && !скрытые.has(э.модели);
    return true;
  };
  const сегодня = Object.entries(х.детали).filter(([к, з]) => к.endsWith('|' + день) && з && (з.обычай || з.место || з.событие) && живы(з)).slice(0, 2);
  return сегодня.map(([, з]) => `How «${з.имя}» is marked here today — ${деталиСтрокой(з)}. Keep these in the world around the player as open chances to take part; never decide whether or how the player joins.`).join(' ');
}

// --- Даты ----------------------------------------------------------------------
const ДАТА = /^\s*(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?\s*$/;
function разобратьДату(s) {
  const м = String(s ?? '').match(ДАТА);
  if (!м) return null;
  const d = +м[1], mo = +м[2];
  let y = м[3] ? +м[3] : null;
  if (y !== null && y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { d, mo, y };
}
const дд = (n) => String(n).padStart(2, '0');
// Описание праздника внутри фразы — без своей точки в конце: «…горожан..» читалось как опечатка.
const безТочки = (s) => String(s || '').trim().replace(/[.!…\s]+$/u, '');
/** Дата сцены «Четверг, 17.10.2024» → полночь UTC или null. */
export function деньСцены(строка) {
  const м = String(строка ?? '').match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!м) return null;
  const y = +м[3] < 100 ? +м[3] + 2000 : +м[3];
  return Date.UTC(y, +м[2] - 1, +м[1]);
}

/** Праздники мира на год — для календаря: [{ id, имя, модели, о, дата: UTC }]. */
export function праздникиМираГода(год) {
  if (settings.holidayGen === false) return [];
  return праздникиМира().map(п => {
    const д = разобратьДату(п.дата);
    if (!д) return null;
    if (д.y && !п.ежегодно && д.y !== год) return null;
    return { id: п.id, имя: п.имя, модели: п.имя, о: п.о, дата: Date.UTC(год, д.mo - 1, д.d), ...(п.ярмарка ? { ярмарка: true } : {}) };
  }).filter(Boolean);
}
// --- Ярмарки (средневековье) -----------------------------------------------------
// HUD сам расставляет их по месяцам — редко, в случайные дни: 0–2 за месяц,
// не ближе шести дней друг к другу. Месяц раскладывается один раз, когда до
// него дошла сцена (следующий — заранее, если до конца месяца меньше дней
// подготовки), и хранится в чате: свайпы и перезагрузки его не меняют.
// Дальше всё как у праздников мира: календарь, «Начать подготовку?»,
// напоминание модели в день, окно «Как празднуют» по нажатию.
export const ЯРМАРКА = 'Ярмарка';
export const О_ЯРМАРКЕ = 'Торговый день: съезжаются редкие мастера, скупщики, сказители и возчики — можно продать, купить, найти человека и узнать вести';
export const ярмаркиВкл = () => старина() && settings.enableFairs !== false;
function сидЯрмарок(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function случайныеЯрмарок(сид) {
  let a = сид;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ключМесяца = (г, м) => `${г}-${дд(м)}`;
/** Дни ярмарок месяца (м — 1…12): по зерну чата и месяца, поэтому одинаково на любом устройстве. */
export function разложитьЯрмарки(г, м, зерно = '') {
  const r = случайныеЯрмарок(сидЯрмарок(зерно + '|' + ключМесяца(г, м)));
  const x = r();
  const сколько = x < 0.35 ? 0 : x < 0.85 ? 1 : 2;
  const дней = new Date(Date.UTC(г, м, 0)).getUTCDate();
  const out = [];
  for (let i = 0; i < 24 && out.length < сколько; i++) {
    const д = 1 + Math.floor(r() * дней);
    if (out.every(о => Math.abs(о - д) >= 6)) out.push(д);
  }
  return out.sort((a, b) => a - b);
}
function зерноЧата() {
  const ctx = контекст();
  try { return String(ctx?.getCurrentChatId?.() || ctx?.chatId || ''); } catch (_) { return ''; }
}
/** Разложить месяц сцены (и следующий, если подготовка к нему уже началась). */
function расставитьЯрмарки(сцена) {
  const х = хранилище();
  if (!х || !Number.isFinite(сцена)) return;
  if (!х.ярмарки || typeof х.ярмарки !== 'object') х.ярмарки = {};
  const д = new Date(сцена);
  const г = д.getUTCFullYear(), м = д.getUTCMonth() + 1;
  const месяцы = [[г, м]];
  const доКонца = new Date(Date.UTC(г, м, 0)).getUTCDate() - д.getUTCDate();
  const заранее = Math.max(2, parseInt(settings.holidayPrepDays ?? 7, 10) || 0);
  if (доКонца < заранее) месяцы.push(м === 12 ? [г + 1, 1] : [г, м + 1]);
  let было = false;
  for (const [гг, мм] of месяцы) {
    const к = ключМесяца(гг, мм);
    if (Array.isArray(х.ярмарки[к])) continue;
    х.ярмарки[к] = разложитьЯрмарки(гг, мм, зерноЧата());
    было = true;
  }
  if (было) сохранить();
}
/**
 * Ярмарки чата: [{ id, имя, модели, о, дата: UTC, ярмарка: true }].
 * сцена — полночь дня сцены: сначала раскладывается её месяц.
 */
export function ярмаркиЧата(сцена = null) {
  if (!ярмаркиВкл()) return [];
  if (Number.isFinite(сцена)) расставитьЯрмарки(сцена);
  const х = хранилище();
  if (!х || !х.ярмарки) return [];
  return Object.entries(х.ярмарки).flatMap(([к, дни]) => {
    const [г, м] = к.split('-').map(Number);
    return (Array.isArray(дни) ? дни : []).map(d => ({ id: `fair|${к}-${дд(d)}`, имя: ЯРМАРКА, модели: 'a fair', о: О_ЯРМАРКЕ, дата: Date.UTC(г, м - 1, d), ярмарка: true }));
  });
}

// Ближайшие праздники от дня сцены (прошлый, этот и следующий год) и ярмарки.
function вокруг(сцена) {
  const год = new Date(сцена).getUTCFullYear();
  const мира = [год - 1, год, год + 1].flatMap(г => праздникиМираГода(г).map(п => ({ ...п, год: г, через: Math.round((п.дата - сцена) / ДЕНЬ) })));
  const ярмарки = ярмаркиЧата(сцена).map(п => ({ ...п, год: new Date(п.дата).getUTCFullYear(), через: Math.round((п.дата - сцена) / ДЕНЬ) }));
  return мира.concat(ярмарки);
}

// --- Разбор ответа модели --------------------------------------------------------
export function нормализоватьПраздник(з) {
  if (!з || typeof з !== 'object') return null;
  const имя = String(з.name ?? з.title ?? з.название ?? '').trim().slice(0, 80);
  const д = разобратьДату(з.date ?? з.дата ?? '');
  if (!имя || !д) return null;
  const день = new Date(0);
  день.setUTCFullYear(д.y ?? 2000, д.mo - 1, д.d);
  if (день.getUTCMonth() !== д.mo - 1) return null;
  const ежегодно = з.yearly === false || з.once === true ? false : !(д.y && з.yearly !== true);
  const дата = `${дд(д.d)}.${дд(д.mo)}` + (д.y && !ежегодно ? '.' + д.y : '');
  return { имя, дата, о: String(з.about ?? з.description ?? з.описание ?? '').trim().slice(0, 220), ежегодно };
}

/**
 * Ответ модели → [{ имя, дата, о, ежегодно }]. Ждём JSON-список; терпим
 * обёртку ```json, рассуждения до него, объект { holidays: [...] } и
 * висячие запятые. Записи без имени или с невозможной датой отбрасываем.
 */
export function разобратьПраздники(ответ) {
  let s = String(ответ ?? '').replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, ' ');
  const код = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (код) s = код[1];
  const начало = s.search(/[[{]/);
  if (начало < 0) return [];
  s = s.slice(начало);
  const конец = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
  if (конец < 0) return [];
  s = s.slice(0, конец + 1).replace(/,\s*([\]}])/g, '$1');
  let данные;
  try { данные = JSON.parse(s); } catch (_) { return []; }
  if (данные && !Array.isArray(данные)) данные = данные.holidays || данные.events || данные.items || Object.values(данные).find(Array.isArray) || [];
  const out = [];
  for (const з of Array.isArray(данные) ? данные : []) {
    const праздник = нормализоватьПраздник(з);
    if (праздник && !out.some(п => п.имя.toLowerCase() === праздник.имя.toLowerCase() && п.дата === праздник.дата)) out.push(праздник);
  }
  return out;
}

// --- Напоминание модели -----------------------------------------------------------
/**
 * Строка в заметки хода (turn-notes.js): в день праздника, а при «заранее» —
 * ещё за два дня. Только напоминает, что событие в сюжете есть.
 */
export function заметкаПраздниковМира(сцена) {
  const режим = settings.holidayReminder || 'day';
  // «Праздники мира» выключены — модель о них не слышит, даже если список остался.
  if ((settings.holidayGen === false && !ярмаркиВкл()) || режим === 'off' || !Number.isFinite(сцена)) return '';
  const все = вокруг(сцена);
  // Праздник и ярмарка в один день — модель слышит про оба.
  const праздник = все.find(п => п.через === 0 && !п.ярмарка);
  const ярмарка = все.find(п => п.через === 0 && п.ярмарка);
  const про = (п) => п.о ? ` (${безТочки(п.о)})` : '';
  // Ярмарка — окно возможностей на один день: завтра этих людей здесь не будет.
  // У придуманной моделью — своё имя и описание, у расставленной HUD — просто «ярмарка».
  const имяЯрмарки = (п) => (п.имя !== ЯРМАРКА ? ` — «${п.модели}»${про(п)}` : '');
  const сегодня = [
    праздник && `Today is «${праздник.модели}»${про(праздник)}, a holiday of this world already set in the story: people around may mark it the way this world does. It can stay in the background.`,
    ярмарка && `Today is a fair day here${имяЯрмарки(ярмарка)}: rare craftsmen, buyers, storytellers and carters from afar are in town for this day only. The player may sell or buy what is rare, look for someone, hear news from far away or hire on — offer these as chances, never decide for the player. They leave tomorrow: after today such traders and travellers are gone until the next fair.`,
  ].filter(Boolean);
  if (сегодня.length) return сегодня.join(' ');
  if (режим !== 'before') return '';
  const скоро = все.filter(п => п.через > 0 && п.через <= 2).sort((а, б) => а.через - б.через)[0];
  if (скоро && скоро.ярмарка) return `A fair${имяЯрмарки(скоро)} comes to town in ${скоро.через} ${скоро.через === 1 ? 'day' : 'days'}: let it show in passing, only where it fits — carts on the road, talk of what the traders will bring.`;
  return скоро ? `«${скоро.модели}»${про(скоро)}, a holiday of this world, is in ${скоро.через} ${скоро.через === 1 ? 'day' : 'days'}: let it show in passing, only where it fits.` : '';
}

// --- Предложение игроку: начать подготовку ------------------------------------------
const КАЛЕНДАРЬ = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m12 12.6.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3Z" class="star"/></svg>';
const днейСлово = (n) => { const д = n % 100, е = n % 10; return д > 10 && д < 20 ? 'дней' : е === 1 ? 'день' : е >= 2 && е <= 4 ? 'дня' : 'дней'; };

// --- Подготовка (окно — render/holiday-prep.js) -------------------------------------
// Запись: { шаги, вести, показ, от, дата, имя, модели, ярмарка, игрок }.
//   вести — модель видит открытые шаги каждый ход и отмечает сделанные в HUD
//           полем sc.Pq («2+», «3-»); показ — список виден игроку над вкладками;
//   от — с какого сообщения читать отметки модели; дата — день события (UTC);
//   игрок — нажатия игрока { номер: true/false }: они сильнее отметок модели.
// Номера шагов не меняются: сделан первый — модель видит «2) …, 3) …».
// Отметки живут только в HUD: старые блоки уходят в сводки без этого поля, а
// снимок его не берёт — модель видит лишь текущий список в заметках хода.
export const подготовкаСписком = () => settings.prepTracking !== 'once';
const ОТМЕТКА = /(?<!\d)#?(\d{1,2})\s*[.):]?\s*([+＋✓✔]|[−\-–—✗✘×])/g;
/** «1+ 2-», «1) +», «1.+», «#2 ✓» → { 0: true, 1: false }. */
export function разобратьОтметки(s) {
  const out = {};
  for (const м of String(s || '').matchAll(ОТМЕТКА)) {
    const i = +м[1] - 1;
    if (i >= 0 && i < 30) out[i] = /[+＋✓✔]/.test(м[2]);
  }
  return out;
}
const ПОЛЕ_ОТМЕТОК = /"Pq"\s*:\s*"([^"]*)"/g;
/** Отметки модели по сообщениям чата с номера от: позднейшая отметка шага побеждает. */
function отметкиМодели(от) {
  const чат = контекст()?.chat;
  const out = {};
  if (!Array.isArray(чат)) return out;
  for (let i = Math.max(0, от || 0); i < чат.length; i++) {
    const м = чат[i];
    if (!м || м.is_user || typeof м.mes !== 'string' || !м.mes.includes('"Pq"')) continue;
    for (const п of м.mes.matchAll(ПОЛЕ_ОТМЕТОК)) Object.assign(out, разобратьОтметки(п[1]));
  }
  return out;
}
/** { шаги, сделано: [bool], вести, показ, дата, имя, модели, ярмарка } или null. */
export function подготовка(ключ) {
  const з = хранилище()?.подготовка?.[ключ];
  if (!з || !Array.isArray(з.шаги) || !з.шаги.length) return null;
  // Номера у модели сквозные: у второй подготовки они идут после первой (сдвиг),
  // чтобы «1+» не засчитался обеим.
  const сдвиг = Number.isInteger(з.сдвиг) ? з.сдвиг : 0;
  const модель = з.вести ? отметкиМодели(з.от) : {};
  const игрок = з.игрок && typeof з.игрок === 'object' ? з.игрок : {};
  const сделано = з.шаги.map((_, i) => (i in игрок ? !!игрок[i] : !!модель[сдвиг + i]));
  return { шаги: з.шаги.slice(), сделано, сдвиг, вести: !!з.вести, показ: з.показ !== false, дата: з.дата, имя: з.имя || '', модели: з.модели || з.имя || '', ярмарка: !!з.ярмарка };
}
/** мета — { вести, показ, дата, имя, модели, ярмарка }. Без шагов запись убирается. */
export function сохранитьПодготовку(ключ, шаги, мета = {}) {
  const х = хранилище();
  if (!х || !ключ) return false;
  if (!х.подготовка || typeof х.подготовка !== 'object') х.подготовка = {};
  const чистые = (шаги || []).map(ш => String(ш || '').trim().slice(0, 200)).filter(Boolean).slice(0, 6);
  const чат = контекст()?.chat;
  // Сдвиг номеров — после других подготовок, которые модель ещё ведёт.
  const сдвиг = мета.вести ? живыеПодготовки(деньПоследнейСцены).filter(п => п.ключ !== ключ && п.вести).reduce((м, п) => Math.max(м, (п.сдвиг || 0) + п.шаги.length), 0) : 0;
  if (чистые.length) х.подготовка[ключ] = { шаги: чистые, сдвиг, вести: !!мета.вести, показ: мета.показ !== false, от: Array.isArray(чат) ? чат.length : 0,
    дата: Number.isFinite(мета.дата) ? мета.дата : null, имя: String(мета.имя || ''), модели: String(мета.модели || мета.имя || ''), ярмарка: !!мета.ярмарка, игрок: {} };
  else delete х.подготовка[ключ];
  сохранить();
  return true;
}
/** Нажатие игрока на шаг: сделано ↔ не сделано. → новое состояние. */
export function переключитьШаг(ключ, номер) {
  const х = хранилище();
  const з = х?.подготовка?.[ключ];
  const п = подготовка(ключ);
  if (!з || !п || !(номер >= 0 && номер < п.шаги.length)) return null;
  if (!з.игрок || typeof з.игрок !== 'object') з.игрок = {};
  з.игрок[номер] = !п.сделано[номер];
  сохранить();
  return з.игрок[номер];
}
export function убратьПодготовку(ключ) {
  const х = хранилище();
  if (!х?.подготовка?.[ключ]) return false;
  delete х.подготовка[ключ];
  сохранить();
  return true;
}
// Последний известный день сцены: промт (prompt.js) спрашивает, идёт ли
// подготовка, а дату сцены знают только заметки хода и плашка.
let деньПоследнейСцены = null;
const живыеПодготовки = (сцена) => {
  const х = хранилище();
  if (!х || !х.подготовка) return [];
  return Object.keys(х.подготовка).map(к => ({ ключ: к, ...подготовка(к) })).filter(п => п.шаги && Number.isFinite(п.дата) && (!Number.isFinite(сцена) || п.дата >= сцена));
};
/** Модель ведёт хоть одну подготовку с открытыми шагами — в схеме HUD нужно поле sc.Pq. */
export function подготовкаИдёт() {
  if (!подготовкаСписком()) return false;
  return живыеПодготовки(деньПоследнейСцены).some(п => п.вести && п.сделано.some(с => !с) && (!Number.isFinite(деньПоследнейСцены) || п.дата > деньПоследнейСцены));
}
/**
 * Строки модели в заметках хода: до двух подготовок. До события — открытые
 * шаги и как их отмечать; в сам день — что успели и что нет.
 */
export function заметкаПодготовки(сцена) {
  if (!подготовкаСписком() || !Number.isFinite(сцена)) return [];
  деньПоследнейСцены = сцена;
  const строки = [];
  const безТ = (s) => String(s || '').replace(/[.!…\s]+$/u, '');
  for (const п of живыеПодготовки(сцена).filter(п => п.вести).sort((а, б) => а.дата - б.дата).slice(0, 2)) {
    const через = Math.round((п.дата - сцена) / ДЕНЬ);
    const что = п.ярмарка ? (п.имя && п.имя !== ЯРМАРКА ? `the fair «${п.модели}»` : 'the fair') : `«${п.модели}»`;
    const пункты = (сделано) => п.шаги.map((ш, i) => [i, ш]).filter(([i]) => п.сделано[i] === сделано);
    if (через === 0) {
      const да = пункты(true).map(([, ш]) => безТ(ш)), нет = пункты(false).map(([, ш]) => безТ(ш));
      строки.push(`Today is ${что}. Of the preparations the player chose, done: ${да.length ? да.join('; ') : 'nothing'}${нет.length ? `; not done: ${нет.join('; ')}` : ''}. Let this show in how the day goes.`);
      continue;
    }
    const открытые = пункты(false);
    if (!открытые.length) continue;
    const д = new Date(п.дата);
    строки.push(`Preparation for ${что} (in ${через} ${через === 1 ? 'day' : 'days'}, ${дд(д.getUTCDate())}.${дд(д.getUTCMonth() + 1)}) — steps still open: ${открытые.map(([i, ш]) => `${п.сдвиг + i + 1}) ${безТ(ш)}`).join('; ')}. Let them come up where they fit, never force them. If the characters do one in this reply, mark it in sc.Pq by its number, e.g. "${п.сдвиг + открытые[0][0] + 1}+" ("${п.сдвиг + открытые[0][0] + 1}-" if tried but not done).`);
  }
  return строки;
}
/** Ответ на «Начать подготовку?»: yes — принято, no — не спрашивать. */
export function ответитьНаПодготовку(ключ, ответ) {
  const х = хранилище();
  if (!х || !ключ) return false;
  х.ответы[ключ] = ответ;
  сохранить();
  return true;
}
/** Текст подсказки модели о скором событии (без шагов подготовки). */
export function подсказкаПодготовки(п, когда) {
  const дней = `${п.через} ${п.через === 1 ? 'day' : 'days'}`;
  if (п.ярмарка) return `A fair${п.имя !== ЯРМАРКА ? ` — «${п.модели}»` : ''} comes to town in ${дней} (${когда}): rare craftsmen, buyers, storytellers and carters from afar will be here for that one day. The player wants to get ready for it`;
  return `«${п.модели}» starts in ${дней} (${когда})${п.о ? ': ' + безТочки(п.о) : ''}`;
}

// Кандидаты для «Начать подготовку?»: праздники мира, ярмарки и встроенные
// праздники эпохи (если включены и не убраны в этом чате). Встроенным модель
// напоминает своя заметка (turn-notes.js), поэтому в вокруг() их нет.
function кандидатыПодготовки(сцена) {
  const все = settings.holidayGen === false ? вокруг(сцена).filter(п => п.ярмарка) : вокруг(сцена);
  if (settings.enableEraHolidays === false) return все;
  const скрытые = скрытыеПраздникиЭпохи();
  const год = new Date(сцена).getUTCFullYear();
  for (const г of [год, год + 1]) {
    let список = [];
    try { список = праздникиГода(г); } catch (_) { список = []; }
    for (const п of список) {
      if (скрытые.has(п.модели)) continue;
      все.push({ id: 'era|' + п.модели, имя: п.имя, модели: п.модели, о: '', дата: п.дата, год: г, через: Math.round((п.дата - сцена) / ДЕНЬ), эпохи: true });
    }
  }
  return все;
}

/**
 * Над вкладками: ближайшее событие через 1…N дней, на которое игрок ещё не
 * ответил, — с вопросом «Начать подготовку?»; и ближайшее, к которому игрок
 * сохранил себе подготовку, — её список, до самого дня. сценаДата — «Дата» сцены.
 */
export function плашкаПодготовки(сценаДата) {
  // 0 дней — вопрос «Начать подготовку?» не задаётся, но уже сохранённая
  // подготовка всё равно видна до своего дня.
  const nСырое = parseInt(settings.holidayPrepDays ?? 7, 10);
  const n = Number.isFinite(nСырое) ? Math.max(0, nСырое) : 7;
  const сцена = деньСцены(сценаДата);
  if (сцена === null) return '';
  const х = хранилище();
  if (!х) return '';
  const кандидаты = n > 0 ? кандидатыПодготовки(сцена).sort((а, б) => а.через - б.через) : [];
  const ключ = (п) => п.id + '|' + п.год;
  const когдаСтрокой = (п) => { const д = new Date(п.дата); return `${дд(д.getUTCDate())}.${дд(д.getUTCMonth() + 1)}`; };
  const голова = (п, подпись) => `<i class="hud-holprep-ico">${КАЛЕНДАРЬ}</i><span class="hud-holprep-what"><b>«${escapeHtml(п.имя)}»</b><small>${подпись}</small></span>`;
  const срок = (п) => (п.через === 0 ? 'сегодня' : `через ${п.через} ${днейСлово(п.через)}`) + ' · ' + когдаСтрокой(п);
  деньПоследнейСцены = сцена;
  let html = '';
  // Сохранённая подготовка — список «1. … 2. …» до самого дня: нажатие на шаг
  // зачёркивает его или возвращает; сделанное моделью приходит из HUD (sc.Pq).
  for (const з of живыеПодготовки(сцена).filter(з => з.показ).sort((а, б) => а.дата - б.дата).slice(0, 2)) {
    const через = Math.round((з.дата - сцена) / ДЕНЬ);
    const псевдо = { имя: з.имя, дата: з.дата, через };
    const всё = з.сделано.every(Boolean);
    html += `<div class="hud-holprep is-saved${всё ? ' is-done' : ''}">` + раскрывашка('hud-holprep-fold', голова(псевдо, (всё ? 'всё готово' : `подготовка ${з.сделано.filter(Boolean).length}/${з.шаги.length}`) + ' · ' + срок(псевдо)),
      `<ol class="hud-holprep-steps">${з.шаги.map((ш, i) => `<li${з.сделано[i] ? ' class="is-done"' : ''}><button type="button" data-hud-prepstep="${i}" data-key="${escapeHtml(з.ключ)}" aria-pressed="${з.сделано[i]}" title="${з.сделано[i] ? 'Вернуть' : 'Отметить сделанным'}">${escapeHtml(ш)}</button></li>`).join('')}</ol>`
      + `<div class="hud-holprep-foot">${з.вести ? `<small>${'модель видит открытые шаги и отмечает сделанные'}</small>` : ''}<button type="button" class="hud-holprep-drop" data-hud-prepdrop="${escapeHtml(з.ключ)}" data-name="${escapeHtml(з.имя)}">Убрать подготовку</button></div>`) + `</div>`;
  }
  // «Отправить только модели»: список игроку не виден, но убрать его можно —
  // короткой строкой с крестиком (и окном подтверждения).
  for (const з of живыеПодготовки(сцена).filter(з => !з.показ && з.вести && з.сделано.some(с => !с)).sort((а, б) => а.дата - б.дата).slice(0, 2)) {
    const через = Math.round((з.дата - сцена) / ДЕНЬ);
    html += `<div class="hud-holprep is-model-only"><span class="hud-holprep-mo">📋 Подготовка к «${escapeHtml(з.имя)}» — только у модели · ${escapeHtml(срок({ дата: з.дата, через }))}</span>`
      + `<button type="button" class="hud-holprep-kill" data-hud-prepdrop="${escapeHtml(з.ключ)}" data-name="${escapeHtml(з.имя)}" title="Убрать подготовку" aria-label="Убрать подготовку">✕</button></div>`;
  }
  const п = кандидаты.find(п => п.через > 0 && п.через <= n && !х.ответы[ключ(п)]);
  if (!п) return html;
  const данные = { ключ: ключ(п), имя: п.имя, модели: п.модели, о: п.о || '', когда: когдаСтрокой(п), через: п.через, срок: срок(п), дата: п.дата, ярмарка: !!п.ярмарка, текст: подсказкаПодготовки(п, когдаСтрокой(п)) };
  return html + `<div class="hud-holprep" data-hol-key="${escapeHtml(данные.ключ)}" data-hol-text="${escapeHtml(данные.текст)}" data-hol-prep="${escapeHtml(JSON.stringify(данные))}">`
    + раскрывашка('hud-holprep-fold', голова(п, срок(п)), п.о ? `<p class="hud-holprep-about">${escapeHtml(п.о)}</p>` : '')
    + `<div class="hud-holprep-ask"><span>Начать подготовку?</span><button type="button" data-hud-holprep="gen">✨ Да, сгенерировать подготовку</button><button type="button" data-hud-holprep="yes">Просто сообщить модели</button><button type="button" data-hud-holprep="no">Без подготовки</button></div></div>`;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !globalThis.__hudHolPrepBound) {
  globalThis.__hudHolPrepBound = true;
  document.addEventListener('click', (e) => {
    // Шаг подготовки: нажатие зачёркивает или возвращает; «Убрать подготовку» —
    // два нажатия. В предпросмотре кастомизации ничего не меняется.
    const шаг = e.target && e.target.closest ? e.target.closest('[data-hud-prepstep], [data-hud-prepdrop]') : null;
    if (шаг) {
      e.preventDefault(); e.stopPropagation();
      if (шаг.closest('.hud-custom-preview-body')) return;
      if (шаг.dataset.hudPrepdrop !== undefined) {
        // Окно подтверждения (confirm-erase.js): подготовка уходит совсем.
        const ключ = шаг.dataset.hudPrepdrop;
        import('../confirm-erase.js?v=23.89.71').then(м => м.уверены({
          что: `«${шаг.dataset.name || ''}»`, текст: 'Подготовка уберётся совсем: модель перестанет её получать, а список шагов пропадёт.', кнопка: 'Убрать',
        })).then(да => {
          if (!да) return;
          убратьПодготовку(ключ);
          document.querySelectorAll(`[data-hud-prepdrop="${CSS.escape(ключ)}"]`).forEach(б => б.closest('.hud-holprep')?.remove());
        }).catch(err => console.error('[TavernOS HUD] подтверждение не открылось:', err));
        return;
      }
      const стало = переключитьШаг(шаг.dataset.key, +шаг.dataset.hudPrepstep);
      if (стало === null) return;
      // Все копии этой подготовки на экране (карточки нескольких сообщений) — разом.
      document.querySelectorAll(`[data-hud-prepstep="${шаг.dataset.hudPrepstep}"]`).forEach(б => {
        if (б.dataset.key !== шаг.dataset.key) return;
        б.setAttribute('aria-pressed', String(стало));
        б.title = стало ? 'Вернуть' : 'Отметить сделанным';
        б.closest('li')?.classList.toggle('is-done', стало);
      });
      return;
    }
    const кнопка = e.target && e.target.closest ? e.target.closest('[data-hud-holprep]') : null;
    if (!кнопка) return;
    const плашка = кнопка.closest('.hud-holprep');
    if (!плашка) return;
    e.preventDefault(); e.stopPropagation();
    const вопрос = плашка.querySelector('.hud-holprep-ask');
    // Окно кастомизации — предпросмотр: в настоящий чат оттуда ничего не уходит.
    if (кнопка.closest('.hud-custom-preview-body')) { вопрос.innerHTML = '<small>Это предпросмотр: отсюда модели ничего не отправляется.</small>'; return; }
    const х = хранилище();
    if (!х) return;
    // Окно подготовки: модель предлагает шаги, игрок решает, куда их деть.
    // «Отмена» в окне закрывает только окно — вопрос на плашке остаётся.
    if (кнопка.dataset.hudHolprep === 'gen') {
      let данные = null;
      try { данные = JSON.parse(плашка.dataset.holPrep || 'null'); } catch (_) { данные = null; }
      if (!данные) return;
      import('./holiday-prep.js?v=23.89.71').then(м => м.открытьПодготовку(данные))
        .catch(err => console.error('[TavernOS HUD] окно подготовки не загрузилось:', err));
      return;
    }
    if (кнопка.dataset.hudHolprep === 'yes') {
      if (!добавитьПодсказку('holiday', плашка.dataset.holText || '', плашка.dataset.holKey || '')) {
        вопрос.innerHTML = '<small>Очередь подсказок полна (до трёх на ответ) — предложите после следующего ответа.</small>';
        return;
      }
      х.ответы[плашка.dataset.holKey] = 'yes';
      сохранить();
      вопрос.innerHTML = '<small class="done">✓ Модель узнает в следующем ответе: можно начинать подготовку.</small>';
    } else {
      х.ответы[плашка.dataset.holKey] = 'no';
      сохранить();
      плашка.remove();
    }
  }, true);
}
