// hud-manager/settings-sync.js
//
// Настройки HUD между устройствами и вкладками.
//
// Раньше каждая вкладка держала в памяти всю копию настроек и, сохраняя,
// отправляла её целиком. Вкладка, открытая на телефоне со вчерашнего вечера,
// затирала всё, что сегодня поменяли на ПК: доставалось всё той копии,
// которая записала последней.
//
// Теперь:
// — у каждого ключа своё время правки (settings.keyTimes). saveSettings
//   отмечает ключи, чьё значение поменялось (отметитьИзменения);
// — общая копия лежит отдельным файлом в user/files Таверны (ФАЙЛ, около
//   130 КБ): settings.json вместе с пресетами весит мегабайты, тянуть его при
//   каждом возвращении на вкладку тяжело, особенно с телефона;
// — синхронизация читает файл и сливает по ключам: побеждает более поздняя
//   правка (слить). Пришедшее забирает себе, а файл пишет обратно, только
//   если у этой вкладки есть что-то новее;
// — когда: после сохранения (с задержкой, чтобы ползунок не дёргал сеть),
//   при возвращении на вкладку и раз в минуту, пока вкладка на виду.
//
// Виды чатов (chatLooks) сливаются по чатам. Вид в самих настройках, когда у
// чатов своё оформление, — вид открытого здесь чата: его не переносим, иначе
// телефон с одним чатом перекрашивал бы ПК с другим.
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

export const ФАЙЛ = 'tavernOS-hud-sync.json';
// Служебное: не сливается по ключам.
// hudFirstRun — значения первого запуска ещё не сверены с другими устройствами.
const СЛУЖЕБНЫЕ = new Set(['savedAt', 'keyTimes', 'localOnly', 'hudFirstRun']);
// Сливаются по чатам, а не целиком.
const ПО_ЧАТАМ = new Set(['chatLooks', 'chatLooksGone']);

const объект = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const копия = (v) => (v && typeof v === 'object' ? structuredClone(v) : v);
/** Отпечаток значения для сравнения. Строки — как есть: картинки в data-URL не копируются. */
export function отпечаток(v) { return typeof v === 'string' ? v : '\u0000' + (v === undefined ? 'u' : JSON.stringify(v)); }

/** Запомнить нынешние значения: от них отмечаются будущие правки. */
export function запомнитьВсе(s, прошлые) {
  прошлые.clear();
  for (const k of Object.keys(s)) if (!СЛУЖЕБНЫЕ.has(k)) прошлые.set(k, отпечаток(s[k]));
}

/** Ключи, поменявшиеся с прошлого раза, получают время правки. Возвращает их. */
export function отметитьИзменения(s, прошлые, сейчас = Date.now()) {
  if (!s.keyTimes || typeof s.keyTimes !== 'object' || Array.isArray(s.keyTimes)) s.keyTimes = {};
  const изменены = [];
  for (const k of new Set([...Object.keys(s), ...прошлые.keys()])) {
    if (СЛУЖЕБНЫЕ.has(k)) continue;
    const о = k in s ? отпечаток(s[k]) : undefined;
    if (о === прошлые.get(k)) continue;
    if (о === undefined) прошлые.delete(k); else прошлые.set(k, о);
    if (!ПО_ЧАТАМ.has(k)) s.keyTimes[k] = сейчас;
    изменены.push(k);
  }
  return изменены;
}

/** Виды чатов: у каждого чата — более свежий; убранные кнопкой не воскресают. */
function слитьВидыЧатов(свои, чужие) {
  const ушли = { ...объект(чужие.chatLooksGone) };
  for (const [id, t] of Object.entries(объект(свои.chatLooksGone))) if (!(Number(ушли[id]) >= Number(t))) ушли[id] = t;
  const мои = объект(свои.chatLooks), их = объект(чужие.chatLooks);
  const виды = {};
  for (const id of new Set([...Object.keys(мои), ...Object.keys(их)])) {
    const а = мои[id], б = их[id];
    const в = !а ? б : !б ? а : (Number(б.at) || 0) > (Number(а.at) || 0) ? б : а;
    if (!в || (Number(ушли[id]) || 0) >= (Number(в.at) || 0)) continue;
    виды[id] = в === а ? а : копия(в);
  }
  return { виды, ушли };
}

/**
 * Слить чужую копию в свою (свои меняются на месте). По каждому ключу —
 * значение с более поздним временем правки. Без времени у обоих — как
 * раньше: у той копии, что сохранена позже, но чужая копия не удаляет ключ.
 * исключить — ключи, которые не переносятся. Возвращает { пришло, ушло }:
 * что взяли у них и где наше новее (тогда файл надо переписать).
 */
export function слить(свои, чужие, { исключить = null } = {}) {
  const пришло = [], ушло = [];
  if (!чужие || typeof чужие !== 'object') return { пришло, ушло: ['*'] };
  const тС = { ...объект(свои.keyTimes) }, тЧ = объект(чужие.keyTimes);
  // Большие картинки устройство держит у себя: в его копии их нет.
  const безКартинок = new Set(Array.isArray(чужие.localOnly) ? чужие.localOnly : []);
  // Первый запуск: заводские значения уступают любой уже сохранённой копии.
  const чужиеПозже = свои.hudFirstRun === true || (Number(чужие.savedAt) || 0) > (Number(свои.savedAt) || 0);
  for (const k of new Set([...Object.keys(свои), ...Object.keys(чужие), ...Object.keys(тС), ...Object.keys(тЧ)])) {
    if (СЛУЖЕБНЫЕ.has(k) || ПО_ЧАТАМ.has(k) || безКартинок.has(k) || (исключить && исключить.has(k))) continue;
    const у = k in свои, ч = k in чужие;
    const tу = Number(тС[k]) || 0, tч = Number(тЧ[k]) || 0;
    if (у === ч && (!у || отпечаток(свои[k]) === отпечаток(чужие[k]))) { if (tч > tу) тС[k] = tч; continue; }
    // Ключ пропал у них — удаляем, только если его там убрали позже нашей правки.
    const ихВерх = tч > tу || (tч === tу && чужиеПозже && ч);
    if (ихВерх) {
      if (ч) свои[k] = копия(чужие[k]); else delete свои[k];
      if (tч) тС[k] = tч;
      пришло.push(k);
    } else ушло.push(k);
  }
  свои.keyTimes = тС;
  const { виды, ушли } = слитьВидыЧатов(свои, чужие);
  const было = отпечаток(объект(свои.chatLooks)), былоУшли = отпечаток(объект(свои.chatLooksGone));
  if (отпечаток(виды) !== было) пришло.push('chatLooks');
  if (отпечаток(ушли) !== былоУшли) пришло.push('chatLooksGone');
  свои.chatLooks = виды; свои.chatLooksGone = ушли;
  if (отпечаток(виды) !== отпечаток(объект(чужие.chatLooks)) || отпечаток(ушли) !== отпечаток(объект(чужие.chatLooksGone))) ушло.push('chatLooks');
  return { пришло, ушло };
}

// --- Файл и расписание ------------------------------------------------------------

// связь (index.js): settings, контекст(), копия() — что отправляется на сервер,
// наСервер(копия) — в settings.json Таверны, исключить() — ключи вида
// открытого чата, принять(пришло) — забрать пришедшее, обновить вид.
let связь = null;
let таймер = 0, идёт = null, ещё = false, последняя = 0;

function вBase64(текст) {
  const байты = new TextEncoder().encode(текст);
  let с = '';
  for (let i = 0; i < байты.length; i += 0x8000) с += String.fromCharCode.apply(null, байты.subarray(i, i + 0x8000));
  return btoa(с);
}
async function прочитать() {
  const ответ = await fetch('/user/files/' + ФАЙЛ, { cache: 'no-cache' });
  if (ответ.status === 404) return null;
  if (!ответ.ok) throw new Error('HTTP ' + ответ.status);
  return await ответ.json();
}
async function записать(данные) {
  const ctx = связь.контекст();
  const заголовки = ctx && typeof ctx.getRequestHeaders === 'function' ? ctx.getRequestHeaders() : { 'Content-Type': 'application/json' };
  const ответ = await fetch('/api/files/upload', { method: 'POST', headers: заголовки, body: JSON.stringify({ name: ФАЙЛ, data: вBase64(JSON.stringify(данные)) }) });
  if (!ответ.ok) throw new Error('HTTP ' + ответ.status);
}

/** Прочитать общий файл, слить, забрать пришедшее, записать своё новое. */
export function синхронизировать() {
  if (!связь) return Promise.resolve();
  if (идёт) { ещё = true; return идёт; }
  последняя = Date.now();
  идёт = (async () => {
    let чужие;
    try { чужие = await прочитать(); } catch (e) {
      // Файла не достать (старая Таверна, нет связи) — как раньше: копия в settings.json.
      console.warn('[TavernOS HUD] синхронизация настроек: файл не прочитан', e);
      try { связь.наСервер(связь.копия()); } catch (_) { /* в другой раз */ }
      return;
    }
    const s = связь.settings;
    const { пришло, ушло } = чужие ? слить(s, чужие, { исключить: связь.исключить() }) : { пришло: [], ушло: ['*'] };
    // Первый запуск сверен: дальше эти значения — свои.
    delete s.hudFirstRun;
    if (пришло.length) {
      if (чужие && Number(чужие.savedAt) > (Number(s.savedAt) || 0)) s.savedAt = Number(чужие.savedAt);
      try { связь.принять(пришло); } catch (e) { console.warn('[TavernOS HUD] синхронизация настроек: не принято', e); }
    }
    if (ушло.length) {
      const данные = связь.копия();
      try { await записать(данные); } catch (e) { console.warn('[TavernOS HUD] синхронизация настроек: файл не записан', e); }
      try { связь.наСервер(данные); } catch (_) { /* в другой раз */ }
    }
  })().finally(() => { идёт = null; if (ещё) { ещё = false; запланировать(300); } });
  return идёт;
}

/** Синхронизация чуть позже: подряд идущие сохранения — одна. */
export function запланировать(мс = 1500) {
  if (!связь) return;
  clearTimeout(таймер);
  таймер = setTimeout(() => { void синхронизировать(); }, мс);
}

/** Подключить: при возвращении на вкладку и раз в минуту, пока она на виду. */
export function подключитьСинхронизацию(с) {
  связь = с;
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const вернулись = () => { if (!document.hidden && Date.now() - последняя > 3000) void синхронизировать(); };
  document.addEventListener('visibilitychange', вернулись);
  window.addEventListener('focus', вернулись);
  setInterval(() => { if (!document.hidden) void синхронизировать(); }, 60000);
}
