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

import { escapeHtml } from '../utils.js?v=23.89.29';
import { settings } from '../settings.js?v=23.89.29';
import { добавитьПодсказку } from '../turn-notes.js?v=23.89.29';
import { раскрывашка } from './fold.js?v=23.89.29';

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
  const ctx = контекст();
  const мета = ctx && (ctx.chatMetadata || ctx.chat_metadata);
  if (!мета) return null;
  const х = (мета[КЛЮЧ] && typeof мета[КЛЮЧ] === 'object') ? мета[КЛЮЧ] : (мета[КЛЮЧ] = {});
  if (!Array.isArray(х.список)) х.список = [];
  if (!х.ответы || typeof х.ответы !== 'object') х.ответы = {};
  return х;
}
let таймер = 0;
function сохранить() {
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
    х.список.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), имя: п.имя, дата: п.дата, о: п.о || '', ежегодно: п.ежегодно !== false });
    n++;
  }
  if (n) сохранить();
  return n;
}
export function убратьПраздникМира(id) {
  const х = хранилище();
  if (!х) return;
  х.список = х.список.filter(п => п.id !== id);
  сохранить();
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
    return { id: п.id, имя: п.имя, модели: п.имя, о: п.о, дата: Date.UTC(год, д.mo - 1, д.d) };
  }).filter(Boolean);
}
// Ближайшие праздники от дня сцены (прошлый, этот и следующий год).
function вокруг(сцена) {
  const год = new Date(сцена).getUTCFullYear();
  return [год - 1, год, год + 1].flatMap(г => праздникиМираГода(г).map(п => ({ ...п, год: г, через: Math.round((п.дата - сцена) / ДЕНЬ) })));
}

// --- Разбор ответа модели --------------------------------------------------------
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
    if (!з || typeof з !== 'object') continue;
    const имя = String(з.name ?? з.title ?? з.название ?? '').trim().slice(0, 80);
    const д = разобратьДату(з.date ?? з.дата ?? '');
    if (!имя || !д) continue;
    const ежегодно = з.yearly === false || з.once === true ? false : !(д.y && з.yearly !== true);
    const дата = `${дд(д.d)}.${дд(д.mo)}` + (д.y && !ежегодно ? '.' + д.y : '');
    if (out.some(п => п.имя.toLowerCase() === имя.toLowerCase() && п.дата === дата)) continue;
    out.push({ имя, дата, о: String(з.about ?? з.description ?? з.описание ?? '').trim().slice(0, 220), ежегодно });
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
  if (режим === 'off' || !Number.isFinite(сцена)) return '';
  const все = вокруг(сцена);
  const сегодня = все.find(п => п.через === 0);
  const про = (п) => п.о ? ` (${безТочки(п.о)})` : '';
  if (сегодня) return `Today is «${сегодня.модели}»${про(сегодня)}, a holiday of this world already set in the story: people around may mark it the way this world does. It can stay in the background.`;
  if (режим !== 'before') return '';
  const скоро = все.filter(п => п.через > 0 && п.через <= 2).sort((а, б) => а.через - б.через)[0];
  return скоро ? `«${скоро.модели}»${про(скоро)}, a holiday of this world, is in ${скоро.через} ${скоро.через === 1 ? 'day' : 'days'}: let it show in passing, only where it fits.` : '';
}

// --- Предложение игроку: начать подготовку ------------------------------------------
const КАЛЕНДАРЬ = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m12 12.6.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3Z" class="star"/></svg>';
const днейСлово = (n) => { const д = n % 100, е = n % 10; return д > 10 && д < 20 ? 'дней' : е === 1 ? 'день' : е >= 2 && е <= 4 ? 'дня' : 'дней'; };

/**
 * Плашка над вкладками: ближайший праздник мира через 1…N дней, на который
 * игрок ещё не ответил. сценаДата — «Дата» сцены этого хода.
 */
export function плашкаПодготовки(сценаДата) {
  const n = parseInt(settings.holidayPrepDays ?? 7, 10);
  if (settings.holidayGen === false || !Number.isFinite(n) || n <= 0) return '';
  const сцена = деньСцены(сценаДата);
  if (сцена === null) return '';
  const х = хранилище();
  if (!х) return '';
  const п = вокруг(сцена).filter(п => п.через > 0 && п.через <= n && !х.ответы[п.id + '|' + п.год]).sort((а, б) => а.через - б.через)[0];
  if (!п) return '';
  const д = new Date(п.дата);
  const когда = `${дд(д.getUTCDate())}.${дд(д.getUTCMonth() + 1)}`;
  const голова = `<i class="hud-holprep-ico">${КАЛЕНДАРЬ}</i><span class="hud-holprep-what"><b>«${escapeHtml(п.имя)}»</b><small>через ${п.через} ${днейСлово(п.через)} · ${когда}</small></span>`;
  const текст = `«${п.модели}» starts in ${п.через} ${п.через === 1 ? 'day' : 'days'} (${когда})${п.о ? ': ' + безТочки(п.о) : ''}`;
  return `<div class="hud-holprep" data-hol-key="${escapeHtml(п.id + '|' + п.год)}" data-hol-text="${escapeHtml(текст)}">`
    + раскрывашка('hud-holprep-fold', голова, п.о ? `<p class="hud-holprep-about">${escapeHtml(п.о)}</p>` : '')
    + `<div class="hud-holprep-ask"><span>Начать подготовку?</span><button type="button" data-hud-holprep="yes">Да, начать</button><button type="button" data-hud-holprep="no">Не надо</button></div></div>`;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !globalThis.__hudHolPrepBound) {
  globalThis.__hudHolPrepBound = true;
  document.addEventListener('click', (e) => {
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
    if (кнопка.dataset.hudHolprep === 'yes') {
      if (!добавитьПодсказку('holiday', плашка.dataset.holText || '')) {
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
