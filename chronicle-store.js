// hud-manager/chronicle-store.js
//
// Где лежит летопись (chronicle.js) и как она пополняется.
//
// Не в метаданных чата, а отдельным файлом Таверны: user/files/
// hud-chronicle-<integrity>.json. Летопись честно весит несколько тысяч
// символов на ход — отношения и секреты модель переписывает почти каждый ход,
// — и в шапке чата она прибавляла бы мегабайты к файлу, который игрок как раз
// чистит ради размера. Имя файла — по integrity чата: у копии чата
// (бэкап, очищенная версия) он тот же, и копия видит ту же летопись, а сам
// чат при этом не меняется. Файл общий для всех устройств: он на сервере.
//
// Пополняется сама: при открытии чата — фоном, по кусочку, все HUD, которых в
// летописи ещё нет; после каждого ответа, свайпа и правки — последние ходы.

import { прочитатьЛетопись, дописатьЛетопись, выжимкаHUD, ключСообщения, КЛЮЧ_ЛЕТОПИСИ } from './chronicle.js?v=23.79.6';
import { extractHudBlock } from './hud-block.js?v=23.79.6';
import { parseHUDComplex } from './hud-parser.js?v=23.79.6';
import { музыкаХода, музыкаДляЛетописи } from './render/music-data.js?v=23.79.6';

const кэш = new Map();   // имя файла → { хранилище: { [КЛЮЧ_ЛЕТОПИСИ]: … }, карта, загрузка, таймер }
const ctx = () => { try { return window.SillyTavern?.getContext?.() || null; } catch (_) { return null; } };

// Выбор игрока: какую летопись добавить этому чату к своей, если своя не та
// или не полная (HUD узнал чат не так — копия получила новый integrity, чат
// переименовали). Выбранная только дополняет: её ходы закрывают пропуски
// своей, а пишется по-прежнему только в свою — чужая не портится.
// Хранится коротким указателем в метаданных чата.
export const КЛЮЧ_ВЫБОРА = 'tavernosHudChronicleFile';
const ИМЯ_ЛЕТОПИСИ = /^hud-chronicle-[a-zA-Z0-9_-]{1,120}\.json$/;
// Указатель всех летописей: какая от какого чата, сколько ходов, какие даты.
// Списка файлов у Таверны нет — без него выбирать было бы не из чего.
export const ФАЙЛ_УКАЗАТЕЛЯ = 'hud-chronicle-index.json';

/** Летопись, которую игрок добавил чату к своей, или null. */
export function выбраннаяЛетопись(c = ctx()) {
  const выбор = c && c.chatMetadata && c.chatMetadata[КЛЮЧ_ВЫБОРА];
  return typeof выбор === 'string' && ИМЯ_ЛЕТОПИСИ.test(выбор) && выбор !== свойФайлЛетописи(c) ? выбор : null;
}
/** Своя летопись чата — по его integrity (у копий он общий). */
export function свойФайлЛетописи(c = ctx()) {
  const id = c && (c.chatMetadata?.integrity || (typeof c.getCurrentChatId === 'function' ? c.getCurrentChatId() : c.chatId));
  if (!id) return null;
  const s = String(id);
  // В имени файла Таверна пускает только латиницу, цифры, _ и -. Русское
  // название чата без integrity иначе схлопнулось бы в подчёркивания, и
  // разные чаты делили бы одну летопись — к нему добавляем хэш.
  if (/^[a-zA-Z0-9_-]{1,90}$/.test(s)) return 'hud-chronicle-' + s + '.json';
  let хэш = 0;
  for (let i = 0; i < s.length; i++) хэш = (хэш * 31 + s.charCodeAt(i)) >>> 0;
  return 'hud-chronicle-' + s.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) + '-' + хэш.toString(36) + '.json';
}

function запись(имя) {
  let з = кэш.get(имя);
  if (!з) {
    з = { хранилище: {}, карта: new Map(), загрузка: null, таймер: 0 };
    з.загрузка = fetch('/user/files/' + имя, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(данные => {
        if (данные && Array.isArray(данные.ходы)) з.хранилище = { [КЛЮЧ_ЛЕТОПИСИ]: данные };
        з.карта = прочитатьЛетопись(з.хранилище);
        if (з.карта.size && имя === свойФайлЛетописи()) прочитатьУказатель().then(у => { if (!у.летописи[имя]) отметитьВУказателе(имя, з.карта); }).catch(() => {});
        return з;
      });
    кэш.set(имя, з);
  }
  return з;
}

// Своя и выбранная вместе. Ход, что есть в обеих, берём из своей: она
// записана с этого чата. Склейку держим, пока ни одна из карт не сменилась, —
// index.js сравнивает летопись по ссылке и не пересчитывает зря.
let склейка = { своя: null, доп: null, итог: null };
function склеить(своя, доп) {
  if (!доп || !доп.size) return своя;
  if (!своя || !своя.size) return доп;
  if (склейка.своя === своя && склейка.доп === доп) return склейка.итог;
  const итог = new Map(доп);
  for (const [к, в] of своя) итог.set(к, в);
  склейка = { своя, доп, итог };
  return итог;
}

/** Летопись открытого чата: Map ключ сообщения → выжимка HUD (своя + выбранная). */
export async function летописьЧата() {
  const c = ctx();
  const своя = свойФайлЛетописи(c), доп = выбраннаяЛетопись(c);
  const [а, б] = await Promise.all([своя ? запись(своя).загрузка : null, доп ? запись(доп).загрузка : null]);
  return склеить(а ? а.карта : new Map(), б ? б.карта : null);
}
/** То же без ожидания: уже загруженная летопись или null. */
export function летописьЕсли() {
  const c = ctx();
  const своя = свойФайлЛетописи(c), доп = выбраннаяЛетопись(c);
  const а = своя && кэш.get(своя), б = доп && кэш.get(доп);
  const карта = склеить(а && а.карта ? а.карта : new Map(), б && б.карта ? б.карта : null);
  return карта && карта.size ? карта : null;
}

// UTF-8 → base64 кусками: btoa на всю строку упирается в размер стека.
function вBase64(s) {
  const байты = new TextEncoder().encode(s);
  let out = '';
  for (let i = 0; i < байты.length; i += 0x8000) out += String.fromCharCode.apply(null, байты.subarray(i, i + 0x8000));
  return btoa(out);
}
async function сохранить(имя, подпись) {
  const з = кэш.get(имя);
  if (!з) return;
  const c = ctx();
  const заголовки = c && typeof c.getRequestHeaders === 'function' ? c.getRequestHeaders() : { 'Content-Type': 'application/json' };
  try {
    const r = await fetch('/api/files/upload', { method: 'POST', headers: заголовки, body: JSON.stringify({ name: имя, data: вBase64(JSON.stringify(з.хранилище[КЛЮЧ_ЛЕТОПИСИ] || { v: 1, ходы: [] })) }) });
    if (!r.ok) console.warn('[TavernOS HUD] летопись не сохранилась', r.status);
    else await отметитьВУказателе(имя, з.карта, подпись);
  } catch (e) { console.warn('[TavernOS HUD] летопись не сохранилась', e); }
}

// --- Указатель летописей -----------------------------------------------------
async function прочитатьУказатель() {
  try {
    const r = await fetch('/user/files/' + ФАЙЛ_УКАЗАТЕЛЯ, { cache: 'no-store' });
    const д = r.ok ? await r.json() : null;
    return д && д.летописи && typeof д.летописи === 'object' ? д : { v: 1, летописи: {} };
  } catch (_) { return { v: 1, летописи: {} }; }
}
// Какие даты покрывает летопись: первая и последняя, что разобрались.
function датыЛетописи(карта) {
  const даты = [...карта.values()].map(в => в && в.scene && в.scene['Дата']).filter(Boolean);
  return { с: даты[0] || '', по: даты[даты.length - 1] || '' };
}
/** Записать летопись в указатель: от какого чата, сколько ходов, даты. */
export async function отметитьВУказателе(имя, карта, подпись = null) {
  const c = ctx();
  const у = await прочитатьУказатель();
  const было = у.летописи[имя] || {};
  // Чат и персонаж — своей летописи от открытого чата, собранной из файла
  // чата — от него (подпись). Чужая, выбранная вручную, остаётся подписанной
  // своим чатом.
  const своя = имя === свойФайлЛетописи(c);
  const чатСейчас = подпись ? подпись.чат : (своя ? (typeof c?.getCurrentChatId === 'function' && c.getCurrentChatId()) : '');
  const персонажСейчас = подпись ? подпись.персонаж : (своя ? c?.name2 : '');
  у.летописи[имя] = {
    чат: String(чатСейчас || было.чат || ''),
    персонаж: String(персонажСейчас || было.персонаж || ''),
    ходов: карта ? карта.size : (было.ходов || 0),
    ...(карта ? датыЛетописи(карта) : { с: было.с || '', по: было.по || '' }),
    обновлено: new Date().toISOString(),
  };
  const заголовки = c && typeof c.getRequestHeaders === 'function' ? c.getRequestHeaders() : { 'Content-Type': 'application/json' };
  try { await fetch('/api/files/upload', { method: 'POST', headers: заголовки, body: JSON.stringify({ name: ФАЙЛ_УКАЗАТЕЛЯ, data: вBase64(JSON.stringify(у)) }) }); } catch (_) { /* указатель — не главное */ }
}
/** Все известные летописи: [{ файл, чат, персонаж, ходов, с, по, обновлено }]. */
export async function списокЛетописей() {
  const у = await прочитатьУказатель();
  return Object.entries(у.летописи).map(([файл, о]) => ({ файл, ...о }))
    .sort((a, b) => String(b.обновлено || '').localeCompare(String(a.обновлено || '')));
}
/**
 * Что летопись даёт открытому чату: сколько её ходов совпадает с его
 * сообщениями, сколько из них закрывают пропуски своей (в своей их нет) и
 * сколько ходов в ней таких, каких в чате нет совсем.
 */
export async function совпаденийСЧатом(имя) {
  if (!имя || !ИМЯ_ЛЕТОПИСИ.test(имя)) return { совпало: 0, новых: 0, вне: 0 };
  const c = ctx();
  const карта = (await запись(имя).загрузка).карта;
  const свояИмя = свойФайлЛетописи(c);
  const своя = свояИмя && свояИмя !== имя ? (await запись(свояИмя).загрузка).карта : null;
  let совпало = 0, новых = 0;
  (c?.chat || []).forEach((m, i) => {
    const к = ключСообщения(m, i);
    if (!карта.has(к)) return;
    совпало++;
    if (своя && !своя.has(к)) новых++;
  });
  return { совпало, новых, вне: карта.size - совпало };
}
// --- Летопись из файла другого чата ------------------------------------------
// Неочищенный чат, который с HUD ни разу не открывали, летописи не имеет —
// выбирать было бы нечего. Поэтому выбрать можно и сам чат персонажа: HUD
// прочитает его файл с сервера (сам чат не открывается и не меняется) и
// соберёт из его HUD летопись — под его integrity, как собрал бы, открой его.
const персонажЧата = (c) => {
  const id = c && c.characterId;
  if (c && c.groupId) return null; // у группы нет одного персонажа
  return id !== undefined && id !== null && Number(id) >= 0 ? c.characters?.[id] || null : null;
};
/** Чаты персонажа открытого чата: [{ id, сообщений, integrity, летопись }]. */
export async function чатыПерсонажа() {
  const c = ctx();
  const п = персонажЧата(c);
  if (!п || !п.avatar) return [];
  const заголовки = typeof c.getRequestHeaders === 'function' ? c.getRequestHeaders() : { 'Content-Type': 'application/json' };
  const r = await fetch('/api/characters/chats', { method: 'POST', headers: заголовки, body: JSON.stringify({ avatar_url: п.avatar, metadata: true }) });
  const д = r.ok ? await r.json() : [];
  if (!Array.isArray(д)) return [];
  return д.filter(ч => ч && ч.file_id).map(ч => {
    const integrity = ч.chat_metadata && ч.chat_metadata.integrity;
    return { id: String(ч.file_id), сообщений: Number(ч.chat_items) || 0, integrity: integrity || '', летопись: свойФайлЛетописи({ chatMetadata: { integrity }, chatId: String(ч.file_id) }) };
  });
}
/**
 * Собрать летопись из файла чата персонажа (id — имя файла без .jsonl) и
 * сохранить. Возвращает { файл, ходов, новых }. У копии открытого чата
 * (integrity тот же) это своя летопись — она и пополняется.
 */
export async function летописьИзЧата(id, наХод = null) {
  const c = ctx();
  const п = персонажЧата(c);
  if (!п || !id) throw new Error('нет персонажа или чата');
  const заголовки = typeof c.getRequestHeaders === 'function' ? c.getRequestHeaders() : { 'Content-Type': 'application/json' };
  const r = await fetch('/api/chats/get', { method: 'POST', headers: заголовки, body: JSON.stringify({ ch_name: п.name, file_name: id, avatar_url: п.avatar }) });
  if (!r.ok) throw new Error('чат не прочитался: ' + r.status);
  const строки = await r.json();
  if (!Array.isArray(строки) || !строки.length) throw new Error('чат пустой');
  const шапка = строки[0] && строки[0].chat_metadata && !('mes' in строки[0]) ? строки[0] : null;
  const сообщения = шапка ? строки.slice(1) : строки;
  const имя = свойФайлЛетописи({ chatMetadata: { integrity: шапка && шапка.chat_metadata.integrity }, chatId: id });
  const ждать = () => new Promise(r2 => (window.requestIdleCallback ? requestIdleCallback(() => r2(), { timeout: 1500 }) : setTimeout(r2, 50)));
  const новые = new Map();
  for (let i = 0; i < сообщения.length; i++) {
    const m = сообщения[i];
    if (i % 20 === 0) { await ждать(); if (наХод) наХод(i, сообщения.length); }
    if (!m || m.is_user) continue;
    const в = выжимкаСообщения(m);
    if (в) новые.set(ключСообщения(m, i), в);
  }
  const з = await запись(имя).загрузка;
  const было = з.карта.size;
  const изменено = дописатьЛетопись(з.хранилище, новые, сообщения.map((m, i) => ключСообщения(m, i)));
  if (изменено) з.карта = прочитатьЛетопись(з.хранилище);
  clearTimeout(з.таймер);
  await сохранить(имя, { чат: id, персонаж: п.name || '' });
  return { файл: имя, ходов: з.карта.size, новых: з.карта.size - было };
}

/** Добавить чату летопись к своей (null — только своя). Указатель — в метаданные чата. */
export async function выбратьЛетопись(имя) {
  const c = ctx();
  if (!c || !c.chatMetadata) return false;
  if (имя && ИМЯ_ЛЕТОПИСИ.test(имя) && имя !== свойФайлЛетописи(c)) c.chatMetadata[КЛЮЧ_ВЫБОРА] = имя;
  else delete c.chatMetadata[КЛЮЧ_ВЫБОРА];
  try { if (typeof c.saveMetadata === 'function') await c.saveMetadata(); } catch (e) { console.warn('[TavernOS HUD] выбор летописи не сохранился', e); }
  return true;
}

/** Дописать выжимки ходов (Map ключ → выжимка) в свою летопись открытого чата. */
export async function дописатьВЛетопись(новые) {
  const имя = свойФайлЛетописи();
  if (!имя || !новые || !новые.size) return false;
  const з = await запись(имя).загрузка;
  const чат = ctx()?.chat || [];
  const изменено = дописатьЛетопись(з.хранилище, новые, чат.map((m, i) => ключСообщения(m, i)));
  if (!изменено) return false;
  з.карта = прочитатьЛетопись(з.хранилище);
  clearTimeout(з.таймер);
  з.таймер = setTimeout(() => сохранить(имя), 3000);
  return true;
}

const текстСообщения = (m) => String((m && (m.mes ?? m.message)) || '');
/** Выжимка HUD сообщения (с музыкой хода, если она подобрана) или null. */
export function выжимкаСообщения(m) {
  const блок = extractHudBlock(текстСообщения(m));
  if (!блок) return null;
  try { return выжимкаHUD(parseHUDComplex(блок), музыкаДляЛетописи(музыкаХода(m))); } catch (_) { return null; }
}

/**
 * Пополнить летопись из чата: сообщения с HUD, которых в ней нет (или все с
 * индекса от). Разбор по кусочку в простое — длинный чат не держит ленту.
 */
export async function пополнитьЛетопись({ от = 0, все = false } = {}) {
  const c = ctx();
  const чат = c?.chat;
  const имя = свойФайлЛетописи(c);
  if (!Array.isArray(чат) || !имя) return;
  const карта = (await запись(имя).загрузка).карта;
  const ждать = () => new Promise(r => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 50)));
  const новые = new Map();
  for (let i = Math.max(0, от); i < чат.length; i++) {
    const m = чат[i];
    // Скрытые из промпта (/hide — у них is_system) — тоже сюжет: архив их считает.
    if (!m || m.is_user) continue;
    const к = ключСообщения(m, i);
    if (!все && карта.has(к)) continue;
    if (i % 20 === 0) await ждать();
    if (свойФайлЛетописи() !== имя) return; // чат сменился посреди прохода
    const в = выжимкаСообщения(m);
    if (в) новые.set(к, в);
  }
  if (новые.size) await дописатьВЛетопись(новые);
}

/** Подписки: открыли чат — пополнить фоном; ответ, свайп, правка — хвост. */
export function подключитьЛетопись() {
  const c = ctx();
  const es = c?.eventSource, et = c?.event_types || c?.eventTypes;
  if (!es || !et) return;
  const хвост = () => { const n = (ctx()?.chat || []).length; setTimeout(() => пополнитьЛетопись({ от: n - 6, все: true }).catch(() => {}), 1200); };
  for (const имя of ['MESSAGE_RECEIVED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED', 'MESSAGE_EDITED']) if (et[имя]) es.on(et[имя], хвост);
  if (et.CHAT_CHANGED) es.on(et.CHAT_CHANGED, () => setTimeout(() => пополнитьЛетопись().catch(() => {}), 4000));
  setTimeout(() => пополнитьЛетопись().catch(() => {}), 6000);
}
