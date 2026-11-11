// hud-manager/offload.js
//
// «Разгрузить чат»: полные блоки HUD старых ходов и неактивных свайпов
// уезжают в файлы Таверны, а в сообщении на месте блока остаётся метка со
// сводкой хода (hud-block.js: [HUD_OFF:ключ] сводка [/HUD_OFF]).
//
// Зачем. Таверна при каждом сохранении переписывает файл чата целиком и
// делает с него бэкап. В длинном чате HUD — бо́льшая часть файла: полные
// блоки в старых ответах, в каждом свайпе и ещё раз в extra.display_text
// (копия сообщения, которую ведут другие расширения). Модель старые HUD всё
// равно получает сводками, а полный блок нужен только экрану.
//
// Ничего не теряется:
//  • ключ — хэш самого блока, файл — по персонажу (или группе): одинаковые
//    HUD в копиях и ветках чата лежат один раз, ветки видят те же блоки;
//  • сначала файл пишется и перечитывается, и только если в нём всё на месте,
//    меняются сообщения; летопись (архив по истории) дописывается заранее;
//  • загруженные блоки читатели получают через развернутьHUD(): быт, перенос
//    списков, летопись и архив видят полный HUD, как до разгрузки;
//  • в запросе метка становится обычной [HUD_SUMMARY] (index.js, перехват);
//  • «Вернуть HUD в чат» ставит блоки на место, свайп на выгруженный вариант
//    возвращает его HUD сам, сводка хода в ленте — кнопкой.
//
// Файлы: user/files/hud-offload-<персонаж>-<0…f>.json, 16 кусков по первой
// цифре ключа: при возврате одного хода читается одна шестнадцатая.

import { hudБлоки, extractHudBlock, заглушкиHUD, заглушкаHUD, развернутьЗаглушки, естьЗаглушкаHUD } from './hud-block.js?v=23.89.9';

import { settings } from './settings.js?v=23.89.9';

const ctx = () => { try { return window.SillyTavern?.getContext?.() || null; } catch (_) { return null; } };

/** Последние сообщения, HUD которых не трогаем: их читают при каждой отрисовке. */
export const ОСТАВИТЬ_СООБЩЕНИЙ = 40;
// Свайпы последних двух сообщений ещё листают — их тоже не трогаем.
const ОСТАВИТЬ_СВАЙПЫ = 2;

let связь = null;   // index.js: сводкаHUD, перерисовка

// --- Ключи --------------------------------------------------------------------
// cyrb53: 53 бита без crypto.subtle (его нет на телефоне по http://192.168…).
function хэш53(str, соль = 0) {
  let h1 = 0xdeadbeef ^ соль, h2 = 0x41c6ce57 ^ соль;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
/**
 * Ключ блока: цифра куска (0…f) и хэш. соль — на случай совпадения хэшей:
 * хэш с солью другой, а кусок тот же (он от хэша без соли).
 */
export function ключБлока(текст, соль = 0) {
  const s = String(текст || '');
  return (хэш53(s) % 16).toString(16) + хэш53(s, соль).toString(36);
}

// --- Хранилище ----------------------------------------------------------------
const блоки = new Map();      // ключ → полный текст блока (всё загруженное)
const куски = new Map();      // имя файла → Promise загрузки

/** Основа имени файлов: персонаж открытого чата (по аватару) или группа. */
export function основаХранилища(c = ctx()) {
  if (!c) return null;
  const персонаж = c.characters && c.characterId !== undefined && c.characterId !== null ? c.characters[c.characterId] : null;
  const id = c.groupId ? 'g-' + c.groupId : персонаж && персонаж.avatar ? String(персонаж.avatar).replace(/\.[a-z0-9]+$/i, '') : '';
  if (!id) return null;
  // В имени файла Таверна пускает только латиницу, цифры, _ и -.
  const чисто = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  return 'hud-offload-' + (чисто === id ? чисто : чисто + '-' + хэш53(id).toString(36));
}
const файлКуска = (основа, кусок) => основа + '-' + кусок + '.json';

async function прочитатьКусок(имя) {
  const r = await fetch('/user/files/' + имя, { cache: 'no-store' });
  if (r.status === 404) return { v: 1, блоки: {} };
  if (!r.ok) throw new Error('файл ' + имя + ': HTTP ' + r.status);
  const д = await r.json();
  return д && д.блоки && typeof д.блоки === 'object' ? д : { v: 1, блоки: {} };
}
function запомнить(д) { for (const [к, т] of Object.entries(д.блоки)) if (typeof т === 'string') блоки.set(к, т); return д; }
function загрузитьКусок(имя, заново = false) {
  if (!заново && куски.has(имя)) return куски.get(имя);
  const п = прочитатьКусок(имя).then(запомнить);
  // Неудачная загрузка не запоминается: в следующий раз попробуем снова.
  п.catch(() => { if (куски.get(имя) === п) куски.delete(имя); });
  куски.set(имя, п);
  return п;
}

// UTF-8 → base64 кусками: btoa на всю строку упирается в размер стека.
function вBase64(s) {
  const байты = new TextEncoder().encode(s);
  let out = '';
  for (let i = 0; i < байты.length; i += 0x8000) out += String.fromCharCode.apply(null, байты.subarray(i, i + 0x8000));
  return btoa(out);
}
async function записатьКусок(имя, д) {
  const c = ctx();
  const заголовки = c && typeof c.getRequestHeaders === 'function' ? c.getRequestHeaders() : { 'Content-Type': 'application/json' };
  const r = await fetch('/api/files/upload', { method: 'POST', headers: заголовки, body: JSON.stringify({ name: имя, data: вBase64(JSON.stringify(д)) }) });
  if (!r.ok) throw new Error('файл ' + имя + ' не записался: HTTP ' + r.status);
}

/** Текст с метками разгрузки → с полными блоками там, где они загружены. */
export function развернутьHUD(текст) {
  if (!естьЗаглушкаHUD(текст)) return текст;
  return развернутьЗаглушки(текст, ({ ключ }) => блоки.get(ключ) ?? null);
}

// --- Где в сообщении лежит HUD ------------------------------------------------
// Ячейка — один текст сообщения: mes, свайп или display_text у сообщения и у
// свайпа. { взять, поставить, активная } — активная: то, что видно сейчас.
export function ячейки(m) {
  const out = [];
  if (!m || typeof m !== 'object') return out;
  const sid = Array.isArray(m.swipes) && Number.isInteger(m.swipe_id) ? m.swipe_id : -1;
  const поле = (о, к, активная) => { if (о && typeof о === 'object' && typeof о[к] === 'string') out.push({ взять: () => о[к], поставить: (т) => { о[к] = т; }, активная }); };
  поле(m, 'mes', true);
  поле(m.extra, 'display_text', true);
  if (Array.isArray(m.swipes)) m.swipes.forEach((_, k) => поле(m.swipes, k, k === sid));
  if (Array.isArray(m.swipe_info)) m.swipe_info.forEach((и, k) => поле(и && и.extra, 'display_text', k === sid));
  return out;
}

/** Ключи всех меток в сообщениях. */
export function ключиВЧате(чат) {
  const ключи = new Set();
  for (const m of чат || []) for (const я of ячейки(m)) for (const з of заглушкиHUD(я.взять())) ключи.add(з.ключ);
  return ключи;
}

/** Загрузить куски с блоками для этих ключей. Возвращает, скольких блоков нет. */
export async function подгрузитьКлючи(ключи, { заново = false } = {}) {
  const основа = основаХранилища();
  if (!основа || !ключи.size) return 0;
  const нужные = new Set([...ключи].filter(к => заново || !блоки.has(к)).map(к => к[0]));
  await Promise.all([...нужные].map(к => загрузитьКусок(файлКуска(основа, к), заново).catch(e => console.warn('[TavernOS HUD] разгрузка:', e))));
  return [...ключи].filter(к => !блоки.has(к)).length;
}
/** Загрузить всё, что нужно меткам открытого чата. */
export const подгрузитьЧат = (чат = ctx()?.chat) => подгрузитьКлючи(ключиВЧате(чат));

// --- Разгрузить -----------------------------------------------------------------
const текстАктивный = (m) => развернутьHUD(String((Array.isArray(m?.swipes) && typeof m.swipes[m.swipe_id] === 'string' ? m.swipes[m.swipe_id] : m?.mes) || ''));

/**
 * Что уйдёт в файл: [{ ячейка, блоки: [{ index, length, full, ключ, сводка }] }].
 * Чистый расчёт, сообщения не меняет. сводка(блок, прошлый) — сводка хода.
 */
export function планРазгрузки(чат, { оставить = ОСТАВИТЬ_СООБЩЕНИЙ, сводка = () => '' } = {}) {
  const план = [];
  if (!Array.isArray(чат)) return план;
  let прошлый = '';
  const сводки = new Map();
  for (let i = 0; i < чат.length; i++) {
    const m = чат[i];
    if (!m || m.is_user) continue;
    const старое = i < чат.length - оставить;
    const свайпы = i < чат.length - ОСТАВИТЬ_СВАЙПЫ;
    if (старое || свайпы) {
      for (const я of ячейки(m)) {
        if (я.активная ? !старое : !свайпы) continue;
        const найдено = hudБлоки(я.взять());
        if (!найдено.length) continue;
        план.push({ номер: i, ячейка: я, блоки: найдено.map(б => {
          if (!сводки.has(б.full)) { let с = ''; try { с = сводка(б.full, прошлый) || ''; } catch (_) { с = ''; } сводки.set(б.full, с); }
          return { index: б.index, length: б.length, full: б.full, ключ: ключБлока(б.full), сводка: сводки.get(б.full) };
        }) });
      }
    }
    const свой = extractHudBlock(текстАктивный(m));
    if (свой) прошлый = свой;
  }
  return план;
}

/** Текст ячейки с метками вместо блоков (с конца — индексы не съезжают). */
function сМетками(текст, найдено) {
  let s = текст;
  for (const б of [...найдено].sort((а, б2) => б2.index - а.index)) s = s.slice(0, б.index) + заглушкаHUD(б.ключ, б.сводка) + s.slice(б.index + б.length);
  return s;
}

/** Сколько вынесет разгрузка: { ячеек, блоков, байт } — без записи. */
export function оценитьРазгрузку(чат = ctx()?.chat, опции = {}) {
  const план = планРазгрузки(чат, опции);
  let блоков = 0, байт = 0;
  for (const п of план) for (const б of п.блоки) { блоков++; байт += б.full.length - заглушкаHUD(б.ключ, б.сводка).length; }
  return { ячеек: план.length, блоков, байт };
}

/**
 * Блоки — в файл: записи [{ ключ, full }]. Кусок читаем свежим прямо перед
 * записью (его мог дописать другой чат того же персонажа или другое
 * устройство) и перечитываем после. При совпадении хэшей у другого текста
 * ключ записи меняется на ключ с солью (кусок тот же).
 */
async function блокиВФайл(основа, записи) {
  const поКускам = new Map();
  for (const б of записи) {
    if (!поКускам.has(б.ключ[0])) поКускам.set(б.ключ[0], new Map());
    поКускам.get(б.ключ[0]).set(б.ключ, б);
  }
  for (const [кусок, нужные] of поКускам) {
    const имя = файлКуска(основа, кусок);
    const д = await прочитатьКусок(имя);
    let изменён = false;
    for (const [ключ, б] of нужные) {
      let к = ключ, соль = 0;
      while (д.блоки[к] !== undefined && д.блоки[к] !== б.full) к = ключБлока(б.full, ++соль);
      if (к !== ключ) записи.forEach(x => { if (x.full === б.full) x.ключ = к; });
      if (д.блоки[к] !== б.full) { д.блоки[к] = б.full; изменён = true; }
    }
    if (изменён) {
      д.v = 1; д.обновлено = Date.now();
      await записатьКусок(имя, д);
    }
    const проверка = await прочитатьКусок(имя);
    for (const б of записи) {
      if (б.ключ[0] === кусок && проверка.блоки[б.ключ] !== б.full) throw new Error('файл ' + имя + ' записался не полностью');
    }
    запомнить(проверка);
    куски.set(имя, Promise.resolve(проверка));
  }
}

/**
 * Правка выгруженных блоков (hud-erase.js). правка(блок) → новый блок или тот
 * же. Новые блоки пишутся в файл под своими ключами; прежние остаются: их
 * могут читать ветки чата. Возвращает функцию: текст с прежними метками →
 * текст с новыми; в её свойстве метки — [новый ключ, прежний ключ, прежняя
 * сводка] для возврата. Сообщения здесь не меняются.
 */
export async function подготовитьВыгруженные(чат, правка, сводка = () => '') {
  const ключи = ключиВЧате(чат);
  const замены = new Map();
  if (ключи.size) {
    await подгрузитьКлючи(ключи);
    for (const к of ключи) {
      const было = блоки.get(к);
      if (было === undefined) continue;
      const стало = правка(было);
      if (стало === было) continue;
      let с = ''; try { с = сводка(стало, '') || ''; } catch (_) { с = ''; }
      замены.set(к, { ключ: ключБлока(стало), full: стало, сводка: с });
    }
  }
  if (замены.size) {
    const основа = основаХранилища();
    if (!основа) throw new Error('чат не открыт');
    await блокиВФайл(основа, [...замены.values()]);
  }
  const заменить = (текст) => (замены.size ? развернутьЗаглушки(текст, ({ ключ }) => { const з = замены.get(ключ); return з ? заглушкаHUD(з.ключ, з.сводка) : null; }) : текст);
  const сводки = new Map();
  if (замены.size) for (const m of чат) for (const я of ячейки(m)) for (const з of заглушкиHUD(я.взять())) if (замены.has(з.ключ)) сводки.set(з.ключ, з.сводка);
  заменить.метки = [...замены].map(([прежний, з]) => [з.ключ, прежний, сводки.get(прежний) || '']);
  return заменить;
}

/**
 * Разгрузить открытый чат. Возвращает { сообщений, блоков, байт }; при ошибке
 * бросает — и тогда сообщения не тронуты.
 */
export async function разгрузитьЧат({ оставить = ОСТАВИТЬ_СООБЩЕНИЙ } = {}) {
  const c = ctx();
  const чат = c && Array.isArray(c.chat) ? c.chat : null;
  const основа = основаХранилища(c);
  if (!чат || !основа) throw new Error('чат не открыт');
  const idЧата = typeof c.getCurrentChatId === 'function' ? c.getCurrentChatId() : c.chatId;
  const длина = чат.length;
  const сводка = (блок, прошлый) => (связь && typeof связь.сводкаHUD === 'function' ? связь.сводкаHUD(блок, прошлый) : '');
  const план = планРазгрузки(чат, { оставить, сводка });
  if (!план.length) return { сообщений: 0, блоков: 0, байт: 0 };

  // 1. Летопись — до разгрузки: архив по истории берёт из неё ходы, если
  //    файла с блоками почему-то не окажется.
  const Л = await import('./chronicle-store.js?v=23.89.9');
  const { ключСообщения } = await import('./chronicle.js?v=23.89.9');
  await Л.пополнитьЛетопись({ все: true });
  if (!(await Л.сохранитьЛетописьСейчас())) throw new Error('летопись не сохранилась');
  const летопись = await Л.летописьЧата();
  for (let i = 0; i < длина - оставить; i++) {
    const m = чат[i];
    if (!m || m.is_user || !Л.выжимкаСообщения(m)) continue;
    if (!летопись.has(ключСообщения(m, i))) throw new Error('в летописи нет хода ' + i);
  }

  // 2. Блоки — в файл, кусками.
  await блокиВФайл(основа, план.flatMap(п => п.блоки));

  // 3. Только теперь — сообщения. Пока писались файлы, чат могли сменить.
  const сейчас = ctx();
  const idСейчас = сейчас && (typeof сейчас.getCurrentChatId === 'function' ? сейчас.getCurrentChatId() : сейчас.chatId);
  if (!сейчас || сейчас.chat !== чат || idСейчас !== idЧата || чат.length !== длина) throw new Error('чат изменился, пока писался файл');
  const тронутые = new Set();
  let блоков = 0, байт = 0;
  for (const п of план) {
    const было = п.ячейка.взять();
    // Текст ячейки поменялся с расчёта (правка, свайп) — эту ячейку пропускаем.
    if (!п.блоки.every(б => было.slice(б.index, б.index + б.length) === б.full)) continue;
    const стало = сМетками(было, п.блоки);
    п.ячейка.поставить(стало);
    тронутые.add(п.номер);
    блоков += п.блоки.length; байт += было.length - стало.length;
  }
  if (блоков) await сохранитьЧат(сейчас);
  return { сообщений: тронутые.size, блоков, байт };
}

async function сохранитьЧат(c) {
  if (typeof c.saveChatConditional === 'function') await c.saveChatConditional();
  else if (typeof c.saveChat === 'function') await c.saveChat();
}

// --- Вернуть ----------------------------------------------------------------------
/** Метки сообщения → полные блоки. Возвращает { вернуто, нет }. Блоки уже загружены. */
function вернутьВСообщении(m) {
  let вернуто = 0, нет = 0;
  for (const я of ячейки(m)) {
    const т = я.взять();
    if (!естьЗаглушкаHUD(т)) continue;
    я.поставить(развернутьЗаглушки(т, ({ ключ }) => { const б = блоки.get(ключ); if (б === undefined) { нет++; return null; } вернуто++; return б; }));
  }
  return { вернуто, нет };
}

/** Вернуть HUD во весь открытый чат. { сообщений, блоков, нет } */
export async function вернутьHUDВЧат() {
  const c = ctx();
  const чат = c && Array.isArray(c.chat) ? c.chat : null;
  if (!чат) throw new Error('чат не открыт');
  const ключи = ключиВЧате(чат);
  if (!ключи.size) return { сообщений: 0, блоков: 0, нет: 0 };
  await подгрузитьКлючи(ключи, { заново: true });
  if (ctx()?.chat !== чат) throw new Error('чат сменился');
  let сообщений = 0, блоковВсего = 0, нетВсего = 0;
  for (const m of чат) {
    const { вернуто, нет } = вернутьВСообщении(m);
    if (вернуто) сообщений++;
    блоковВсего += вернуто; нетВсего += нет;
  }
  if (блоковВсего) await сохранитьЧат(c);
  return { сообщений, блоков: блоковВсего, нет: нетВсего };
}

/** Вернуть HUD одного сообщения (кнопка на сводке, свайп). true — вернулся. */
export async function вернутьHUDСообщения(номер) {
  const c = ctx();
  const чат = c && Array.isArray(c.chat) ? c.chat : null;
  const m = чат && чат[номер];
  if (!m) return false;
  const ключи = new Set();
  for (const я of ячейки(m)) for (const з of заглушкиHUD(я.взять())) ключи.add(з.ключ);
  if (!ключи.size) return false;
  await подгрузитьКлючи(ключи);
  if (ctx()?.chat !== чат || чат[номер] !== m) return false;
  const { вернуто } = вернутьВСообщении(m);
  if (!вернуто) return false;
  await сохранитьЧат(c);
  if (связь && typeof связь.обновитьСообщение === 'function') связь.обновитьСообщение(номер, m);
  return true;
}

// --- Убрать файлы -----------------------------------------------------------------
const заголовкиЗапроса = (c) => (c && typeof c.getRequestHeaders === 'function' ? c.getRequestHeaders() : { 'Content-Type': 'application/json' });

/**
 * Чаты этого персонажа или группы, где ещё есть метки разгрузки. Ищет сервер
 * Таверны: телефон не скачивает чаты. Поиск смотрит только видимый текст
 * сообщений: чат, где выгружены одни неактивные свайпы, он не заметит, но там
 * от блока останется сводка, а сам чат цел.
 */
export async function чатыСМетками(c = ctx()) {
  const персонаж = c && c.characters && c.characterId !== undefined && c.characterId !== null ? c.characters[c.characterId] : null;
  if (!c || (!c.groupId && !персонаж)) return [];
  const r = await fetch('/api/chats/search', { method: 'POST', headers: заголовкиЗапроса(c), body: JSON.stringify({ query: '[HUD_OFF:', avatar_url: персонаж && персонаж.avatar, group_id: c.groupId || undefined }) });
  if (!r.ok) throw new Error('поиск по чатам: HTTP ' + r.status);
  const д = await r.json();
  return (Array.isArray(д) ? д : []).map(ч => String(ч.file_name || '').replace(/\.jsonl$/, '')).filter(Boolean);
}

/** Удалить файлы разгрузки этого персонажа. Сколько файлов убрано. */
export async function убратьФайлыРазгрузки(c = ctx()) {
  const основа = основаХранилища(c);
  if (!основа) return 0;
  let убрано = 0;
  for (const кусок of '0123456789abcdef') {
    const имя = файлКуска(основа, кусок);
    const r = await fetch('/api/files/delete', { method: 'POST', headers: заголовкиЗапроса(c), body: JSON.stringify({ path: 'user/files/' + имя }) });
    if (r.ok) убрано++;
    else if (r.status !== 404) throw new Error('файл ' + имя + ': HTTP ' + r.status);
    куски.delete(имя);
  }
  блоки.clear();
  return убрано;
}

// --- Подключение ------------------------------------------------------------------
/**
 * связь: { сводкаHUD(блок, прошлый), обновитьСообщение(номер, m),
 * перерисоватьКарточкиЧата(), showHudToast(вид, заголовок, текст) }. Подписки: открыли чат с метками — загрузить
 * блоки и перерисовать карточки; свайп на выгруженный вариант — вернуть его HUD.
 */
export function подключитьРазгрузку(с) {
  связь = с;
  const c = ctx();
  const es = c?.eventSource, et = c?.event_types || c?.eventTypes;
  if (!es || !et) return;
  const открыт = async () => {
    try {
      const чат = ctx()?.chat;
      const ключи = ключиВЧате(чат);
      if (!ключи.size || ![...ключи].some(к => !блоки.has(к))) return;
      await подгрузитьКлючи(ключи);
      if (ctx()?.chat === чат && связь && typeof связь.перерисоватьКарточкиЧата === 'function') связь.перерисоватьКарточкиЧата();
    } catch (e) { console.warn('[TavernOS HUD] разгрузка: блоки не загрузились', e); }
  };
  if (et.CHAT_CHANGED) es.on(et.CHAT_CHANGED, () => setTimeout(открыт, 300));
  if (et.MESSAGE_SWIPED) es.on(et.MESSAGE_SWIPED, (номер) => {
    const m = ctx()?.chat?.[Number(номер)];
    if (m && ячейки(m).some(я => я.активная && естьЗаглушкаHUD(я.взять()))) вернутьHUDСообщения(Number(номер)).catch(e => console.warn('[TavernOS HUD] разгрузка: свайп', e));
  });
  // Кнопка на сводке выгруженного хода (render/summary-card.js).
  document.addEventListener('click', (e) => {
    const кнопка = e.target.closest && e.target.closest('.hud-sum-restore');
    if (!кнопка) return;
    e.preventDefault(); e.stopPropagation();
    const mes = кнопка.closest('.mes');
    const номер = mes ? Number(mes.getAttribute('mesid')) : NaN;
    if (!Number.isInteger(номер)) return;
    кнопка.classList.add('is-busy');
    вернутьHUDСообщения(номер).then(ок => {
      if (!ок) { кнопка.classList.add('is-missing'); связь?.showHudToast?.('error', 'HUD не нашёлся', 'Этого блока нет в файле разгрузки — осталась сводка.'); return; }
      // Со «Прятать старые карточки совсем» старая карточка на экран не
      // вернётся — говорим, что HUD всё же на месте.
      if (settings.hideOldCards === true) связь?.showHudToast?.('success', 'HUD возвращён', 'Полный HUD снова в сообщении. Старые карточки скрыты настройкой «🙈 Прятать старые карточки совсем», поэтому на экране его не видно.');
    })
      .catch(err => { console.warn('[TavernOS HUD] разгрузка: возврат', err); кнопка.classList.add('is-missing'); })
      .finally(() => кнопка.classList.remove('is-busy'));
  }, true);
  setTimeout(открыт, 1500);
}
