// hud-manager/render/canon.js
//
// Канон облика — тексты, где внешность героя описана «как есть»:
//  · карточка персонажа с тем же именем (в библиотеке Таверны, не только
//    открытая) и её встроенная книга (character_book);
//  · абзацы о герое в чужих карточках — когда одна карточка описывает
//    нескольких («Leila: 21, olive skin, red curls…»);
//  · записи лорбуков: книга чата, книга карточки, глобально выбранные книги
//    Таверны и книги HUD (настройка hudLorebooks);
//  · у игрока — описание персоны.
// Голосование по канону и истории чата — render/look.js (обликИзТекстов).
//
// Лорбуки Таверна отдаёт асинхронно, а карта тела рисуется сразу, поэтому
// они подтягиваются в фоне (подтянутьЛор) и попадают в следующие рисунки;
// карта тела и так собирается лениво, когда строка на экране.
//
// Работает на любых героях и сюжетах: имена сравниваются с учётом приставок
// карточек («THE REGENTS  Brandon Kane»), уменьшительных и списков имён из
// картинок (names.js: алиасыИмени). Чего нет ни в карточке, ни в лорбуках —
// берётся из истории чата.

import { settings } from '../settings.js?v=23.51.8';
import { namesLikelySame, алиасыИмени } from '../names.js?v=23.51.8';
import { имяБезПриставки } from '../utils.js?v=23.51.8';

const контекст = () => { try { return window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext(); } catch (_) { return null; } };
const чистоеИмя = (н) => имяБезПриставки(String(н || '')).trim();
const первоеСлово = (н) => чистоеИмя(н).split(/\s+/)[0] || '';

/** Тот же герой: полное имя, без приставки, уменьшительные, имена из картинок. */
export function тотЖеГерой(а, б) {
  const x = чистоеИмя(а), y = чистоеИмя(б);
  if (!x || !y) return false;
  if (x.toLowerCase() === y.toLowerCase() || namesLikelySame(x, y)) return true;
  let алиасы = [];
  try { алиасы = алиасыИмени(y); } catch (_) { алиасы = []; }
  return алиасы.some(а2 => namesLikelySame(x, а2));
}

// Упоминание имени в тексте — словом, по полному имени или первому слову
// (если оно не короче трёх букв: «Ал» слишком часто встречается внутри слов).
function упоминание(текст, имя) {
  const полное = чистоеИмя(имя), первое = первоеСлово(имя);
  const варианты = [полное, первое.length >= 3 ? первое : ''].filter(Boolean);
  try { алиасыИмени(полное).forEach(а => а && а.length >= 3 && варианты.push(а)); } catch (_) { /* без алиасов */ }
  const экр = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return варианты.some(в => new RegExp('(?<![\\p{L}])' + экр(в) + '(?![\\p{L}])', 'iu').test(String(текст || '')));
}

/**
 * Абзацы о герое в тексте, где описаны несколько: абзац, в котором он назван
 * (и следующий, если тот — продолжение без чужого имени). Строки о {{char}}
 * отбрасываем, если речь не о персонаже этой карточки.
 */
export function абзацыОГерое(текст, имя, { своя = false } = {}) {
  const т = String(текст || '');
  if (!т.trim()) return '';
  if (своя) return т;
  const абзацы = т.split(/\n\s*\n/);
  const out = [];
  абзацы.forEach((а, i) => {
    if (!упоминание(а, имя)) return;
    const первая = а.trim().split(/\n/)[0] || '';
    // Абзац о нём целиком — только если он начинается его именем-заголовком
    // («**Leila Sanchez**», «Leila: …»).
    if (первая.length < 90 && упоминание(первая.slice(0, 60), имя) && /^\s*(?:\*\*|__|#+\s*|\[|-\s*)?\s*\p{Lu}/u.test(первая)) {
      out.push(а);
      if (а.trim().split(/\n/).length === 1 && абзацы[i + 1]) out.push(абзацы[i + 1]);
      return;
    }
    // Иначе — общий абзац о многих («The Regents: Tristan…, Brandon…»):
    // только предложения, где он назван, и следующее, если оно про него же.
    const предложения = а.split(/(?<=[.!?;])\s+|\n+/);
    предложения.forEach((п, j) => {
      if (!упоминание(п, имя)) return;
      out.push(п);
      const дальше = предложения[j + 1];
      if (дальше && /^\s*(?:he|she|his|her|он|она|его|её|ее)(?![\p{L}])/iu.test(дальше)) out.push(дальше);
    });
  });
  return out.join('\n\n').split('\n').filter(с => !/\{\{char\}\}/i.test(с)).join('\n');
}

/**
 * Своя карточка без разделов о других: абзац, который начинается заголовком-
 * именем («**Rowan Whitethorn**», «Leila:», «[Manon]»), и это не наш герой —
 * чужой. Иначе облик соседа по карточке утекал бы в нашего.
 */
const ЗАГОЛОВОК = /^\s*(?:\*\*|__|#+\s*|\[)?\s*((?:\p{Lu}[\p{L}'’-]+\s*){1,4})(?:\*\*|__|\])?\s*[:：—-]?\s*$/u;
const ЗАГОЛОВОК_С_ТЕКСТОМ = /^\s*(?:\*\*|__|\[)?\s*((?:\p{Lu}[\p{L}'’-]+\s*){1,4})(?:\*\*|__|\])?\s*[:：]\s+\S/u;
const СЛУЖЕБНЫЕ = /^(?:appearance|personality|likes|dislikes|background|info|name|gender|age|height|body|hair|eyes|features|status|occupation|scenario|внешность|характер|биография)$/iu;
export function безЧужихРазделов(текст, имя) {
  return String(текст || '').split(/\n\s*\n/).filter(абзац => {
    const первая = абзац.trim().split(/\n/)[0] || '';
    const м = первая.match(ЗАГОЛОВОК) || первая.match(ЗАГОЛОВОК_С_ТЕКСТОМ);
    if (!м) return true;
    const кто = м[1].trim();
    if (СЛУЖЕБНЫЕ.test(кто) || /\{\{char\}\}/i.test(первая)) return true;
    return тотЖеГерой(кто, имя) || упоминание(кто, имя);
  }).join('\n\n');
}

// --- Лорбуки ----------------------------------------------------------------
let лорЗаписи = [];        // { ключи: [], название, текст }
let лорЧат = null;         // для какого чата загружено
let лорВерсия = 0;
let лорЗагрузка = null;

const записиКниги = (данные) => {
  const e = данные && данные.entries;
  const все = Array.isArray(e) ? e : (e && typeof e === 'object' ? Object.values(e) : []);
  return все.filter(з => з && !з.disable && String(з.content || '').trim()).map(з => ({
    ключи: [...(Array.isArray(з.key) ? з.key : (Array.isArray(з.keys) ? з.keys : [])), ...(Array.isArray(з.keysecondary) ? з.keysecondary : (Array.isArray(з.secondary_keys) ? з.secondary_keys : []))].map(String),
    название: String(з.comment || з.name || ''),
    текст: String(з.content || ''),
  }));
};

// Книги, названной в чате, может не быть на диске (чат перенесли без неё):
// Таверна тогда отвечает долго или никак. Ждём не больше нескольких секунд.
const сТаймаутом = (обещание, мс = 6000) => Promise.race([обещание, new Promise(r => setTimeout(() => r(null), мс))]);
async function загрузитьКнигу(ctx, имя) {
  if (!имя) return null;
  try { if (typeof ctx.loadWorldInfo === 'function') { const д = await сТаймаутом(Promise.resolve(ctx.loadWorldInfo(имя))); if (д) return д; } } catch (_) { /* ниже — запасной путь */ }
  try {
    const заголовки = typeof ctx.getRequestHeaders === 'function' ? ctx.getRequestHeaders() : { 'Content-Type': 'application/json' };
    const r = await сТаймаутом(fetch('/api/worldinfo/get', { method: 'POST', headers: заголовки, body: JSON.stringify({ name: имя }), cache: 'no-cache' }));
    return r && r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

/** Какие книги смотреть: чат, карточка, глобальные Таверны, книги HUD. */
async function именаКниг(ctx) {
  const имена = new Set();
  try { const ч = ctx.chatMetadata && ctx.chatMetadata.world_info; if (ч) имена.add(ч); } catch (_) { /* нет */ }
  try {
    const ch = ctx.characterId != null && ctx.characterId >= 0 ? ctx.characters[ctx.characterId] : null;
    const w = ch && ch.data && ch.data.extensions && ch.data.extensions.world;
    if (w) имена.add(w);
  } catch (_) { /* нет карточки */ }
  try {
    // Глобальный выбор и доп. книги карточки живут в модуле world-info Таверны.
    const wi = await import('/scripts/world-info.js');
    (wi.selected_world_info || []).forEach(н => н && имена.add(н));
    const доп = wi.world_info && Array.isArray(wi.world_info.charLore) ? wi.world_info.charLore : [];
    const файл = ctx.characters && ctx.characterId != null ? (ctx.characters[ctx.characterId] || {}).avatar : '';
    доп.filter(з => з && файл && String(з.name || '').replace(/\.png$/i, '') === String(файл).replace(/\.png$/i, '')).forEach(з => (з.extraBooks || []).forEach(н => имена.add(н)));
  } catch (_) { /* старая Таверна или нет доступа — без глобальных */ }
  (Array.isArray(settings.hudLorebooks) ? settings.hudLorebooks : []).filter(Boolean).forEach(н => имена.add(н));
  return [...имена];
}

/**
 * Загрузить записи лорбуков для текущего чата — один раз на чат. Возвращает
 * обещание; повторный вызов в том же чате — то же обещание.
 */
export function подтянутьЛор({ заново = false } = {}) {
  const ctx = контекст();
  if (!ctx) return Promise.resolve(0);
  const чат = (typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId) || '';
  if (!заново && лорЧат === чат && лорЗагрузка) return лорЗагрузка;
  лорЧат = чат;
  лорЗагрузка = (async () => {
    const книги = await именаКниг(ctx);
    const записи = [];
    for (const имя of книги) {
      const д = await загрузитьКнигу(ctx, имя);
      записи.push(...записиКниги(д));
    }
    // Чат могли сменить, пока грузили, — тогда результат не наш.
    if (лорЧат !== чат) return 0;
    лорЗаписи = записи;
    лорВерсия++;
    кэш.clear();
    try { document.dispatchEvent(new CustomEvent('hud-canon-updated', { detail: { записей: записи.length } })); } catch (_) { /* нет DOM */ }
    return записи.length;
  })().catch(() => 0);
  return лорЗагрузка;
}

// Запись о герое: его имя среди ключей, в названии или в начале текста.
function записьОГерое(з, имя) {
  if (з.ключи.some(к => к && тотЖеГерой(к, имя))) return true;
  if (з.название && упоминание(з.название, имя)) return true;
  return упоминание(з.текст.slice(0, 160), имя);
}

// --- Канон -------------------------------------------------------------------
const кэш = new Map();
/**
 * Тексты-канон облика героя: своя карточка целиком, абзацы о нём в чужих
 * карточках, записи встроенных книг и лорбуков. игрок=true — описание персоны.
 */
export function канонОблика(имя, игрок = false) {
  const ctx = контекст();
  if (!ctx) return [];
  if (игрок) {
    let п = '';
    try { п = (typeof window.power_user !== 'undefined' && window.power_user && window.power_user.persona_description) || (ctx.persona && ctx.persona.description) || ''; } catch (_) { п = ''; }
    return п ? [п] : [];
  }
  const кто = чистоеИмя(имя);
  const карточки = Array.isArray(ctx.characters) ? ctx.characters : [];
  if (!кто) return [];
  const ключ = кто + '|' + карточки.length + '|' + лорВерсия;
  if (кэш.has(ключ)) return кэш.get(ключ);
  const out = [];
  for (const c of карточки) {
    const н = c && (c.name || (c.data && c.data.name));
    if (!н) continue;
    const d = String((c.data && c.data.description) || c.description || '');
    const своя = тотЖеГерой(н, кто);
    if (своя && d.trim()) out.push(безЧужихРазделов(d, кто));
    else if (d.trim() && упоминание(d, кто)) { const а = абзацыОГерое(d, кто); if (а.trim()) out.push(а); }
    // Встроенная книга карточки.
    const книга = c.data && c.data.character_book;
    if (книга) for (const з of записиКниги(книга)) if (записьОГерое(з, кто)) out.push(своя ? з.текст : абзацыОГерое(з.текст, кто, { своя: з.ключи.some(к => тотЖеГерой(к, кто)) }));
  }
  for (const з of лорЗаписи) if (записьОГерое(з, кто)) out.push(абзацыОГерое(з.текст, кто, { своя: з.ключи.some(к => тотЖеГерой(к, кто)) }));
  const итог = out.filter(т => String(т).trim());
  if (кэш.size > 300) кэш.clear();
  кэш.set(ключ, итог);
  return итог;
}

/** Пол из канона: «Gender: Male», «Пол: женский» — когда HUD о нём молчит. */
export function полИзКанона(тексты) {
  for (const т of тексты || []) {
    const м = String(т).match(/(?:gender|sex|пол)\s*[:：]\s*(male|female|man|woman|муж\p{L}*|жен\p{L}*|м|ж)(?![\p{L}])/iu);
    if (м) return /^(?:male|man|муж|м)/iu.test(м[1]) ? 'm' : 'f';
  }
  return '';
}

export const версияЛора = () => лорВерсия;
