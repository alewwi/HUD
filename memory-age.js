// hud-manager/memory-age.js
//
// Номер и давность у записей памяти в снимке для модели.
//
// «Проклятие вчерашнего дня»: в памяти нет дат, и модель зовёт «вчера» то,
// что было неделю или полгода назад. HUD сам находит, в каком ходе запись
// появилась впервые, и по датам сцены пишет давность: «[f3 · 5 days ago]».
// Номер нужен «памяти обновлениями» (hud-expand.js): изменить или убрать
// запись модель может по номеру — «[f3] новый текст», «- [f3]», а не по
// угаданным первым словам. Номера — позиции в прошлом HUD, тот же список,
// что видит модель, поэтому их не нужно нигде хранить.
// Модели это не стоит ни токена сверх самих пометок; в сообщение пометки не
// попадают — hud-expand.js снимает их, если модель всё-таки их переписала.
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { разобратьХод } from './render/carryover.js?v=23.89.14';
import { parseSceneDate } from './history-analyzer.js?v=23.89.14';
import { безМетки, безДавности } from './hud-expand.js?v=23.89.14';

export { МЕТКА_ЗАПИСИ, безМетки, безДавности } from './hud-expand.js?v=23.89.14';

const ДЕНЬ = 864e5;
const объект = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const норма = (s) => String(s ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"'`.,;:!?()\[\]—–-]/g, ' ').replace(/\s+/g, ' ').trim();
// Тот же признак «той же записи», что у памяти обновлениями: первые пять слов.
const ключ = (s) => норма(s).split(' ').slice(0, 5).join(' ');
const текстРужья = (s) => String(s ?? '').split('|')[0];
const текстОбещания = (s) => String(s ?? '').split('|').slice(0, 2).join(' ');

/** Давность словами для модели: today, yesterday, 5 days ago, 3 weeks ago… */
export function давностьСлово(дней) {
  if (!Number.isFinite(дней) || дней < 0) return '';
  if (дней === 0) return 'today';
  if (дней === 1) return 'yesterday';
  if (дней < 14) return `${дней} days ago`;
  if (дней < 60) return `${Math.round(дней / 7)} weeks ago`;
  if (дней < 365) return `${Math.round(дней / 30)} months ago`;
  const лет = Math.round(дней / 365);
  return лет === 1 ? 'a year ago' : `${лет} years ago`;
}

// Когда каждая запись появилась впервые: проходим историю от старых ходов.
// Глубина — 150 сообщений: полный разбор HUD дорогой, а давность старше нужна
// редко (не нашлась — значит, дольше). Что вынуто из каждого хода, держим на
// самом сообщении (WeakMap), пока текст тот же: следующий запрос разбирает
// только новые ходы, и другой чат кэш не путает.
const ГЛУБИНА = 150;
const изХода = new WeakMap();
function пунктыХода(m) {
  const текст = String((m && m.mes) || '');
  const было = изХода.get(m);
  if (было && было.длина === текст.length && было.хвост === текст.slice(-64)) return было.пункты;
  let пункты = null;
  const d = разобратьХод(m);
  const дата = d ? parseSceneDate(d.scene && (d.scene['Дата'] || d.scene.Dt)) : null;
  if (d && дата !== null && дата !== undefined) {
    const пам = d.memory || {};
    пункты = { дата,
      fct: (пам.important || []).map(String),
      prm: (пам.promises || []).map(текстОбещания),
      gun: (пам.guns || []).map(текстРужья),
      sec: (пам.secrets || []).map(s => String((s && s.fact) || '')),
      mm: (d.characters || []).flatMap(c => String((c && c['Общие воспоминания']) || '').split(';')) };
  }
  изХода.set(m, { длина: текст.length, хвост: текст.slice(-64), пункты });
  return пункты;
}
// Журнал первых появлений — в метаданных самого чата, как кэш музыки: «ключ
// записи → дата сцены, когда она появилась». Старые HUD больше не разбираются
// на каждом запросе: новая запись всегда есть в последнем ходе, поэтому
// дописываем журнал по последним шести сообщениям. Полный проход (ГЛУБИНА) —
// один раз, у старого чата без журнала. Сохраняет журнал обычное сохранение
// чата после ответа: отдельной записи огромного файла чата не нужно.
const КЛЮЧ_ЖУРНАЛА = 'tavernosHudFirstSeen';
const ВИДЫ = ['fct', 'prm', 'gun', 'sec', 'mm'];
const ПРЕДЕЛ_ЖУРНАЛА = 800;
function метаЧата() {
  try { const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext(); const м = ctx && (ctx.chatMetadata || ctx.chat_metadata); return м && typeof м === 'object' ? м : null; } catch (_) { return null; }
}
function первыеДаты(chat) {
  const мета = метаЧата();
  let ж = мета && мета[КЛЮЧ_ЖУРНАЛА];
  const новый = !ж || typeof ж !== 'object' || ж.v !== 1;
  if (новый) ж = { v: 1, fct: {}, prm: {}, gun: {}, sec: {}, mm: {} };
  for (let i = новый ? Math.max(0, chat.length - ГЛУБИНА) : Math.max(0, chat.length - 6); i < chat.length; i++) {
    const m = chat[i];
    if (!m || m.is_user || m.is_system) continue;
    const п = пунктыХода(m);
    if (!п) continue;
    for (const вид of ВИДЫ) for (const текст of п[вид]) { const к = ключ(текст); if (к && !(к in ж[вид])) ж[вид][к] = п.дата; }
  }
  // Журнал не растёт без конца: самые давние записи уходят первыми.
  for (const вид of ВИДЫ) { const ключи = Object.keys(ж[вид]); for (const к of ключи.slice(0, Math.max(0, ключи.length - ПРЕДЕЛ_ЖУРНАЛА))) delete ж[вид][к]; }
  if (мета) мета[КЛЮЧ_ЖУРНАЛА] = ж;
  return Object.fromEntries(ВИДЫ.map(вид => [вид, new Map(Object.entries(ж[вид]))]));
}
// Та же запись своими словами: «Леонард мёртв уже неделю» и «Леонард мёртв»
// по первым словам разные. Запасной признак — общие корни (пять букв).
const корни = (s) => new Set(норма(s).split(' ').filter(w => w.length > 3).map(w => w.slice(0, 5)));
function похожая(карта, текст) {
  const А = корни(текст);
  if (А.size < 2) return undefined;
  let лучшая;
  for (const [к, д] of карта) {
    const Б = корни(к);
    if (Б.size < 2) continue;
    let общих = 0;
    for (const w of А) if (Б.has(w)) общих++;
    if (общих / Math.min(А.size, Б.size) >= 0.6 && (лучшая === undefined || д < лучшая)) лучшая = д;
  }
  return лучшая;
}

/**
 * Помечает копию снимка (в кодах): у фактов, ружей и секретов — номер и
 * давность, у общих воспоминаний — давность. Без дат сцены — только номера.
 */
export function пометитьПамятьСнимка(снимок, chat) {
  if (!объект(снимок)) return снимок;
  const сейчас = parseSceneDate(объект(снимок.sc) ? снимок.sc.Dt : '');
  const даты = Array.isArray(chat) && chat.length ? первыеДаты(chat) : null;
  const давность = (карта, текст) => {
    if (!даты || сейчас === null || сейчас === undefined) return '';
    const д = карта.get(ключ(текст)) ?? похожая(карта, текст);
    return д === undefined ? 'today' : давностьСлово(Math.max(0, Math.round((сейчас - д) / ДЕНЬ)));
  };
  const метка = (номер, сколько) => `[${номер}${сколько ? ' · ' + сколько : ''}] `;
  const me = объект(снимок.me) ? снимок.me : null;
  if (me) {
    if (Array.isArray(me.fct)) me.fct = me.fct.map((s, i) => typeof s === 'string' ? метка('f' + (i + 1), давность(даты && даты.fct, s)) + безМетки(s) : s);
    if (Array.isArray(me.prm)) me.prm = me.prm.map((s, i) => typeof s === 'string' ? метка('p' + (i + 1), давность(даты && даты.prm, текстОбещания(безМетки(s)))) + безМетки(s) : s);
    if (Array.isArray(me.gun)) me.gun = me.gun.map((s, i) => typeof s === 'string' ? метка('g' + (i + 1), давность(даты && даты.gun, текстРужья(безМетки(s)))) + безМетки(s) : s);
    if (Array.isArray(me.sec)) me.sec = me.sec.map((s, i) => {
      if (!объект(s)) return s;
      const сколько = давность(даты && даты.sec, s.f);
      return { id: 's' + (i + 1), ...(сколько ? { age: сколько } : {}), ...s };
    });
  }
  if (даты && сейчас !== null && сейчас !== undefined) for (const c of Array.isArray(снимок.cs) ? снимок.cs : []) {
    if (!объект(c) || typeof c.Mm !== 'string' || !c.Mm.trim()) continue;
    c.Mm = c.Mm.split(';').map(эп => эп.trim()).filter(Boolean).map(эп => { const сколько = давность(даты.mm, эп); return сколько ? `[${сколько}] ${безДавности(эп)}` : эп; }).join('; ');
  }
  return снимок;
}
