// hud-manager/render/place-lore.js
//
// Средневековье: правила места и «чья здесь власть». У деревни, города,
// переправы или дома свои порядки (ворота закрываются в сумерках, приезжим
// торговать по субботам, в роще не рубят) и своя власть, которая может
// пересекаться: земля одного, мост другого, стража слушается третьего.
//
// Модель описывает место один раз — по кнопке во вкладке «Мир», отдельным
// запросом, как праздники (окно — render/place-gen.js). Здесь лёгкая часть:
//   · хранение в данных чата (tavernosHudPlaces);
//   · разбор ответа модели — разобратьМесто;
//   · какие сохранённые места подходят к адресу сцены и какие правила
//     действуют сейчас (по времени, дню недели и части места);
//   · карточка во вкладке «Мир» — блокМеста;
//   · строка модели в заметках хода — заметкаМеста (настройка
//     placeLoreReminder): до трёх действующих правил и одна строка о власти.
//
// Текст модели в разметку идёт только через escapeHtml.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.80';
import { settings } from '../settings.js?v=23.89.80';
import { старина } from '../era.js?v=23.89.80';
import { примерМета } from '../sample-meta.js?v=23.89.80';
import { связьПраздников } from './holiday-lore.js?v=23.89.80';
import { видБлока } from './views.js?v=23.89.80';
import { видЖизни, естьВидЖизни } from './world-life-views.js?v=23.89.80';

const КЛЮЧ = 'tavernosHudPlaces';
export const местоВкл = () => старина() && settings.placeLore !== false;

// --- Хранилище -----------------------------------------------------------------
function контекст() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; } }
function хранилище() {
  // Пример в «Кастомизации» (sample-meta.js): своё «уже сгенерированное», без сохранения.
  const ctx = контекст();
  const мета = примерМета() || (ctx && (ctx.chatMetadata || ctx.chat_metadata));
  if (!мета) return null;
  const х = (мета[КЛЮЧ] && typeof мета[КЛЮЧ] === 'object') ? мета[КЛЮЧ] : (мета[КЛЮЧ] = {});
  if (!Array.isArray(х.список)) х.список = [];
  return х;
}
let таймер = 0;
function сохранить() {
  if (примерМета()) return;
  clearTimeout(таймер);
  таймер = setTimeout(() => { const ctx = контекст(); try { (ctx?.saveMetadataDebounced || ctx?.saveMetadata)?.call(ctx); } catch (_) { /* не критично */ } }, 300);
}

/** Места этого чата: [{ id, имя, правила: [...], власть: [...] }]. */
export function местаЧата() { const х = хранилище(); return х ? х.список.slice() : []; }
/** Сохранить описание места; то же имя заменяется целиком. → id. */
export function сохранитьМесто(имя, { правила = [], власть = [] } = {}) {
  const х = хранилище();
  const чистое = String(имя || '').trim().slice(0, 80);
  if (!х || !чистое || (!правила.length && !власть.length)) return '';
  const было = х.список.find(м => имяК(м.имя) === имяК(чистое));
  const id = было ? было.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const запись = { id, имя: чистое, правила: правила.slice(0, 10), власть: власть.slice(0, 10) };
  х.список = было ? х.список.map(м => (м.id === id ? запись : м)) : х.список.concat(запись);
  сохранить();
  return id;
}
export function убратьМесто(id) {
  const х = хранилище();
  if (!х) return false;
  const n = х.список.length;
  х.список = х.список.filter(м => м.id !== id);
  if (х.список.length !== n) сохранить();
  return х.список.length !== n;
}

// --- Адрес сцены ------------------------------------------------------------------
const имяК = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'„“”()]/g, '').replace(/\s+/g, ' ').trim();
/** «Ольховка, таверна «Хромой гусь», у камина» → ['Ольховка', 'таверна «Хромой гусь»', 'у камина']. */
export function частиАдреса(адрес) {
  return String(адрес || '').split(/[,;(|]/).map(ч => ч.replace(/\)/g, '').trim()).filter(ч => ч && ч.length <= 80 && !/^(?:empty|none|нет|—|-)$/i.test(ч)).slice(0, 5);
}
/** Место сцены из данных хода: сцена, игрок, первый персонаж. */
export function адресСцены(data) {
  const з = (v) => (typeof v === 'string' ? v.trim() : '');
  const сцена = data && data.scene && typeof data.scene === 'object' ? data.scene : {};
  const первый = Array.isArray(data?.characters) && data.characters[0] ? data.characters[0]['Место'] : '';
  return з(сцена['Место']) || з(data?.user?.['Место']) || з(первый);
}
/** Сохранённые места, что подходят к адресу: от общего (город) к частному (таверна). */
export function местаАдреса(адрес, места = местаЧата()) {
  const части = частиАдреса(адрес).map(имяК);
  if (!части.length) return [];
  const out = [];
  части.forEach((ч, i) => {
    for (const м of места) {
      const и = имяК(м.имя);
      if (!и || out.some(о => о.м === м)) continue;
      if (ч === и || (и.length >= 4 && ч.includes(и)) || (ч.length >= 4 && и.includes(ч))) out.push({ м, i });
    }
  });
  return out.sort((а, б) => а.i - б.i).map(о => о.м);
}

// --- Разбор ответа модели -------------------------------------------------------------
const ДНИ = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ДНИ_RU = { вс: 'sun', пн: 'mon', вт: 'tue', ср: 'wed', чт: 'thu', пт: 'fri', сб: 'sat' };
const СФЕРЫ = ['land', 'bridge', 'toll', 'market', 'court', 'guards', 'complaints', 'church', 'crossing', 'other'];
// Длина не режется посреди фразы; потолок 1000 — только от сорвавшейся модели.
const строка = v => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000);
function когдаИз(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s || /^(?:always|всегда|any|anytime)$/.test(s)) return 'always';
  if (/^(?:night|ночь|ночью|dusk-dawn|dusk to dawn|after dark|затемно)$/.test(s)) return 'night';
  if (/^(?:day|день|днём|днем|daytime|dawn-dusk|dawn to dusk)$/.test(s)) return 'day';
  const м = s.match(/^(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?$/);
  if (м && +м[1] < 25 && +м[3] < 25) return `${м[1].padStart(2, '0')}:${м[2] || '00'}-${м[3].padStart(2, '0')}:${м[4] || '00'}`;
  return 'always';
}
function днейИз(v) {
  const список = Array.isArray(v) ? v : String(v ?? '').split(/[,\s]+/);
  const out = [];
  for (const д of список) {
    const s = String(д || '').trim().toLowerCase();
    const к = ДНИ.find(x => s.startsWith(x)) || ДНИ_RU[s.slice(0, 2)];
    if (к && !out.includes(к)) out.push(к);
  }
  return out.length === 7 ? [] : out;
}
export function нормализоватьПравило(з) {
  if (!з || typeof з !== 'object') { const т = строка(з); return т ? { текст: т, когда: 'always', когдаСлово: '', дни: [], кого: '', где: '', иначе: '' } : null; }
  const текст = строка(з.rule ?? з.text ?? з.правило);
  if (!текст) return null;
  return { текст, когда: когдаИз(з.when ?? з.time), когдаСлово: строка(з.when_text ?? з.whenText), дни: днейИз(з.days), кого: строка(з.who), где: строка(з.where), иначе: строка(з.if_broken ?? з.ifBroken ?? з.penalty) };
}
export function нормализоватьВласть(з) {
  if (!з || typeof з !== 'object') return null;
  const кто = строка(з.holder ?? з.who ?? з.кто);
  const сфера = String(з.area ?? '').trim().toLowerCase();
  const подпись = строка(з.label ?? з.area_name ?? з.what);
  if (!кто || (!подпись && !СФЕРЫ.includes(сфера))) return null;
  return { сфера: СФЕРЫ.includes(сфера) ? сфера : 'other', подпись, кто, заметка: строка(з.note) };
}
/** Ответ модели → { правила, власть } или null. Терпит ```json, рассуждения и висячие запятые. */
export function разобратьМесто(ответ) {
  let s = String(ответ ?? '').replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, ' ');
  const код = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (код) s = код[1];
  const начало = s.indexOf('{'), конец = s.lastIndexOf('}');
  if (начало < 0 || конец < начало) return null;
  let д;
  try { д = JSON.parse(s.slice(начало, конец + 1).replace(/,\s*([\]}])/g, '$1')); } catch (_) { return null; }
  if (!д || typeof д !== 'object') return null;
  const правила = (Array.isArray(д.rules) ? д.rules : []).map(нормализоватьПравило).filter(Boolean).slice(0, 10);
  const власть = (Array.isArray(д.power) ? д.power : []).map(нормализоватьВласть).filter(Boolean).slice(0, 10);
  return правила.length || власть.length ? { правила, власть } : null;
}

// --- Что действует сейчас -----------------------------------------------------------
/** «14:30», «вечер, 21:05» → минуты от полуночи или null. */
export function минутыВремени(время) {
  const м = String(время || '').match(/(\d{1,2}):(\d{2})/);
  return м && +м[1] < 24 ? +м[1] * 60 + +м[2] : null;
}
// День недели — словом из даты сцены («Суббота, 16.03.1250»): в мире свой
// календарь, и по числу он может не совпасть. Нет слова — по числу.
const СЛОВА_ДНЕЙ = [[/воскрес|sunday/i, 'sun'], [/понедель|monday/i, 'mon'], [/вторник|tuesday/i, 'tue'], [/сред[аы]|wednesday/i, 'wed'], [/четверг|thursday/i, 'thu'], [/пятниц|friday/i, 'fri'], [/суббот|saturday/i, 'sat']];
function деньНедели(дата) {
  const слово = СЛОВА_ДНЕЙ.find(([re]) => re.test(String(дата || '')));
  if (слово) return слово[1];
  const м = String(дата || '').match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (!м) return null;
  const y = +м[3] < 100 ? +м[3] + 2000 : +м[3];
  const д = new Date(0); д.setUTCFullYear(y, +м[2] - 1, +м[1]);
  return ДНИ[д.getUTCDay()];
}
function вОкне(когда, мин) {
  if (когда === 'always' || мин === null) return true;
  const [от, до] = когда === 'day' ? [360, 1200] : когда === 'night' ? [1200, 360] : когда.split('-').map(минутыВремени);
  if (от === null || до === null || от === до) return true;
  return от < до ? мин >= от && мин < до : мин >= от || мин < до;
}
/**
 * Правила мест адреса: { сейчас, прочие }. Сейчас — по времени и дню, и только
 * те, что про всё место или про ту часть, где сцена.
 */
export function правилаСейчас(места, { адрес = '', время = '', дата = '' } = {}) {
  const мин = минутыВремени(время), день = деньНедели(дата);
  const где = имяК(адрес);
  const сейчас = [], прочие = [];
  for (const м of места) for (const п of м.правила || []) {
    const тут = !п.где || где.includes(имяК(п.где)) || имяК(п.где).split(' ').some(с => с.length >= 5 && где.includes(с.slice(0, -1)));
    const вСрок = вОкне(п.когда, мин) && (!п.дни || !п.дни.length || !день || п.дни.includes(день));
    (тут && вСрок ? сейчас : прочие).push({ ...п, место: м.имя });
  }
  return { сейчас, прочие };
}

// --- Карточка во вкладке «Мир» ---------------------------------------------------------
const ЗНАК_СФЕРЫ = { land: '🌾', bridge: '🌉', toll: '💰', market: '🧺', court: '⚖️', guards: '🛡️', complaints: '📜', church: '⛪', crossing: '🛶', other: '🏰' };
const СЛОВО_СФЕРЫ = { land: 'Земля', bridge: 'Мост', toll: 'Пошлина', market: 'Рынок', court: 'Суд', guards: 'Стража', complaints: 'Жалобы', church: 'Церковь', crossing: 'Переправа', other: 'Власть' };
const ДЕНЬ_СЛОВО = { mon: 'пн', tue: 'вт', wed: 'ср', thu: 'чт', fri: 'пт', sat: 'сб', sun: 'вс' };
const э = (s) => escapeHtml(String(s ?? ''));
function срокСлово(п) {
  const когда = п.когдаСлово || (п.когда === 'night' ? 'ночью' : п.когда === 'day' ? 'днём' : п.когда !== 'always' ? п.когда.replace('-', '–') : '');
  return [когда, п.дни && п.дни.length ? п.дни.map(д => ДЕНЬ_СЛОВО[д]).join(', ') : ''].filter(Boolean).join(' · ');
}
function правилоHtml(п, несколько) {
  const срок = срокСлово(п);
  const мета = [срок && `<span class="hud-plc-when">${э(срок)}</span>`, п.кого && `<span>${э(п.кого)}</span>`, п.где && `<span>${э(п.где)}</span>`, несколько && `<span class="hud-plc-of">${э(п.место)}</span>`].filter(Boolean).join('');
  return `<li class="hud-plc-rule${срок ? ' is-timed' : ''}"><b>${э(п.текст)}</b>${мета ? `<small class="hud-plc-meta">${мета}</small>` : ''}${п.иначе ? `<small class="hud-plc-else">${э(п.иначе)}</small>` : ''}</li>`;
}
/** Власть по держателям: у кого что. Сфера у нескольких держателей — «власть делят». */
export function властьПоДержателям(власть) {
  const группы = [];
  for (const в of власть || []) {
    let г = группы.find(x => имяК(x.кто) === имяК(в.кто));
    if (!г) { г = { кто: в.кто, сферы: [] }; группы.push(г); }
    г.сферы.push(в);
  }
  const счёт = {};
  for (const в of власть || []) if (в.сфера !== 'other') счёт[в.сфера] = (счёт[в.сфера] || 0) + 1;
  return группы.map(г => ({ ...г, сферы: г.сферы.map(в => ({ ...в, делят: в.сфера !== 'other' && счёт[в.сфера] > 1 })) }));
}
function властьHtml(м) {
  const группы = властьПоДержателям(м.власть);
  if (!группы.length) return '';
  return `<div class="hud-plc-power"><span class="hud-plc-sub">⚖️ Чья здесь власть</span>`
    + группы.map((г, i) => `<div class="hud-plc-holder" data-n="${i % 6}"><b class="hud-plc-who">${э(г.кто)}</b><span class="hud-plc-areas">${г.сферы.map(в => `<span class="hud-plc-area${в.делят ? ' is-shared' : ''}"${в.делят ? ' title="Эту власть здесь делят"' : ''}><i aria-hidden="true">${ЗНАК_СФЕРЫ[в.сфера]}</i>${э(в.подпись || СЛОВО_СФЕРЫ[в.сфера])}</span>`).join('')}</span>`
      + (г.сферы.some(в => в.заметка) ? `<small class="hud-plc-note">${г.сферы.filter(в => в.заметка).map(в => э(в.заметка)).join(' · ')}</small>` : '') + `</div>`).join('')
    + `</div>`;
}
const атрибутыКнопки = (адрес, время, дата) => `data-addr="${э(адрес)}" data-time="${э(время)}" data-date="${э(дата)}"`;
/** Карточка «Правила места» для вкладки «Мир». data — данные хода HUD. */
export function блокМеста(data) {
  if (!местоВкл()) return '';
  const адрес = адресСцены(data);
  const сцена = data && data.scene && typeof data.scene === 'object' ? data.scene : {};
  const время = typeof сцена['Время'] === 'string' ? сцена['Время'] : '', дата = typeof сцена['Дата'] === 'string' ? сцена['Дата'] : '';
  const кнопка = (подпись) => `<button type="button" class="hud-plc-gen" data-hud-place="gen" ${атрибутыКнопки(адрес, время, дата)}>${подпись}</button>`;
  const места = местаАдреса(адрес);
  if (!места.length) {
    if (!частиАдреса(адрес).length) return '';
    return `<div class="hud-world-section hud-plc is-empty"><div class="hud-world-title">🏰 Правила места</div>`
      + `<div class="hud-v hud-plc-card"><p class="hud-plc-hint">Порядки и власть «${э(частиАдреса(адрес)[0])}» ещё не известны.</p>${кнопка('✨ Узнать правила и власть')}</div></div>`;
  }
  const { сейчас, прочие } = правилаСейчас(места, { адрес, время, дата });
  const несколько = места.length > 1;
  // Вид «План слободы» или «Колокол глашатая» (render/world-life-views.js); «Как было» — карточка ниже.
  const вид = видБлока('placeRulesView');
  if (естьВидЖизни('place', вид)) {
    const правило = (п, сейчасЛи) => ({ где: п.где || п.место, текст: п.текст, когда: срокСлово(п), кого: п.кого, иначе: п.иначе, сейчас: сейчасЛи });
    const власть = места.flatMap(м => властьПоДержателям(м.власть)).map(г => ({ кто: г.кто, области: г.сферы.map(в => в.подпись || СЛОВО_СФЕРЫ[в.сфера]).join(' · '), заметка: г.сферы.filter(в => в.заметка).map(в => в.заметка).join(' · ') }));
    const кнопки = `<div class="wl-foot">${места.map(м => `<span class="wl-place-name">${э(м.имя)}<button type="button" class="hud-plc-del" data-hud-place="del" data-id="${э(м.id)}" title="Забыть это место" aria-label="Забыть это место">✕</button></span>`).join('')}${кнопка('✨ Другое место или заново')}</div>`;
    const html = видЖизни('place', вид, { места, правила: [...сейчас.map(п => правило(п, true)), ...прочие.map(п => правило(п, false))], власть, кнопки });
    if (html) return html;
  }
  return `<div class="hud-world-section hud-plc"><div class="hud-world-title">🏰 Правила места</div>`
    + `<div class="hud-v hud-plc-card">`
    + `<div class="hud-plc-head"><span class="hud-plc-names">${места.map(м => `<span class="hud-plc-name">${э(м.имя)}<button type="button" class="hud-plc-del" data-hud-place="del" data-id="${э(м.id)}" title="Забыть это место" aria-label="Забыть это место">✕</button></span>`).join('')}</span></div>`
    + (сейчас.length ? `<ul class="hud-plc-rules">${сейчас.map(п => правилоHtml(п, несколько)).join('')}</ul>` : `<p class="hud-plc-hint">Сейчас здесь ничто не ограничивает.</p>`)
    + (прочие.length ? `<details class="hud-plc-more"><summary>Другие правила · ${прочие.length}</summary><ul class="hud-plc-rules is-other">${прочие.map(п => правилоHtml(п, несколько)).join('')}</ul></details>` : '')
    + места.map(властьHtml).join('')
    + `<div class="hud-plc-foot">${кнопка('✨ Другое место или заново')}</div>`
    + `</div></div>`;
}

// --- Строка модели в заметках хода ---------------------------------------------------
/** снимок — компактный HUD хода (коды): sc.L/us.L/cs[0].L, sc.T, sc.Dt. */
export function заметкаМеста(снимок) {
  if (!местоВкл() || settings.placeLoreReminder === false || !снимок) return '';
  const адрес = String(снимок.sc?.L || снимок.us?.L || (Array.isArray(снимок.cs) && снимок.cs[0] ? снимок.cs[0].L : '') || '');
  const места = местаАдреса(адрес);
  if (!места.length) return '';
  const { сейчас } = правилаСейчас(места, { адрес, время: String(снимок.sc?.T || ''), дата: String(снимок.sc?.Dt || '') });
  const безТочки = (s) => String(s || '').replace(/[.!…\s]+$/u, '');
  const всем = /^(?:все|всех|всем|everyone|everybody|all)$/i;
  const правила = сейчас.slice(0, 3).map(п => безТочки(п.текст) + (п.кого && !всем.test(п.кого.trim()) ? ` (${безТочки(п.кого)})` : ''));
  const власть = места.flatMap(м => м.власть || []).slice(0, 5).map(в => `${(в.подпись || в.сфера).toLowerCase()} — ${безТочки(в.кто)}`);
  if (!правила.length && !власть.length) return '';
  const где = места.map(м => м.имя).join(', ');
  return `Local order of ${где}, already set in the story:`
    + (правила.length ? ` rules in force right now: ${правила.join('; ')}.` : '')
    + (власть.length ? ` Who holds power here: ${власть.join('; ')}.` : '')
    + ' Keep to this; breaking a rule brings what this world would bring, but never decide for the player.';
}

// --- Кнопки карточки ---------------------------------------------------------------------
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !globalThis.__hudPlaceBound) {
  globalThis.__hudPlaceBound = true;
  document.addEventListener('click', (e) => {
    const кнопка = e.target && e.target.closest ? e.target.closest('[data-hud-place]') : null;
    if (!кнопка) return;
    e.preventDefault(); e.stopPropagation();
    // Окно кастомизации — предпросмотр: место из настоящего чата оттуда не меняется.
    if (кнопка.closest('.hud-custom-preview-body')) return;
    const д = кнопка.dataset;
    if (д.hudPlace === 'gen') {
      import('./place-gen.js?v=23.89.80').then(м => м.открытьПравилаМеста({ адрес: д.addr || '', время: д.time || '', дата: д.date || '' }))
        .catch(err => console.error('[TavernOS HUD] окно правил места не загрузилось:', err));
    } else if (д.hudPlace === 'del') {
      // Два нажатия: первое спрашивает, второе забывает.
      if (!кнопка.classList.contains('is-armed')) { кнопка.classList.add('is-armed'); кнопка.textContent = 'Забыть?'; return; }
      убратьМесто(д.id);
      try { связьПраздников().перерисовать?.(); } catch (_) { /* карточки обновятся со следующим ходом */ }
    }
  }, true);
}
