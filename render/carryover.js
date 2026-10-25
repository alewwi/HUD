// hud-manager/render/carryover.js
//
// Перенос списков из прошлых ходов в текущую карточку.
//
// Модель каждый ход присылает HUD заново и часто роняет то, что писала раньше:
// переписка, начатая три хода назад, исчезает, секрет пропадает, заметка
// стирается. Здесь эти списки собираются обратно — но только на экране.
//
// Важно: в запрос к модели не уходит ни одного лишнего символа. Мы не трогаем
// ни текст сообщения, ни промт — читаем уже сохранённые ходы чата и склеиваем
// списки прямо перед отрисовкой. Модель по-прежнему пишет столько, сколько
// писала.
//
// Работы ровно столько, сколько нужно: заглядываем назад на ограниченное число
// ходов, разобранные блоки держим в кэше, длину каждого списка обрезаем.

import { parseHUDComplex } from '../hud-parser.js?v=23.79.1';
import { проставитьДень } from './msg-feed.js?v=23.79.1';
import { normalizeJSONData } from '../schema.js?v=23.79.1';
import { settings } from '../settings.js?v=23.79.1';
import { статусРужья } from '../codes.js?v=23.79.1';
import { extractHudBlock } from '../hud-block.js?v=23.79.1';
import { namesLikelySame } from '../names.js?v=23.79.1';
import { звонкиИзЧатов, записьЗдоровья, склеитьЗдоровье } from './phone-extra.js?v=23.79.1';
import { readParsed, writeParsed } from '../store.js?v=23.79.1';

const текст = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const ключ = (v) => текст(v).toLowerCase().replace(/[ё]/g, 'е').replace(/[«»"'`.,;:!?()\[\]]/g, '').replace(/\s+/g, ' ');


// Кэш разборов по хэшу текста: самый давно не нужный уходит первым (LRU), а
// запись, которую не спрашивали дольше времени жизни, считается ушедшей —
// так не держим в памяти ходы чата, из которого давно вышли. Раньше кэш на
// двухсотом ходе очищался целиком, и следующая отрисовка разбирала все
// двадцать прошлых ходов заново.
export class КэшРазборов {
  constructor(предел, жизньМс) { this.предел = предел; this.жизнь = жизньМс; this.записи = new Map(); }
  // undefined — промах; null — закэшированное «здесь HUD нет».
  взять(k, сейчас = Date.now()) {
    const з = this.записи.get(k);
    if (!з) return undefined;
    this.записи.delete(k);
    if (сейчас - з.t > this.жизнь) return undefined;
    з.t = сейчас;
    this.записи.set(k, з);
    return з.v;
  }
  положить(k, v, сейчас = Date.now()) {
    this.записи.delete(k);
    this.записи.set(k, { v, t: сейчас });
    while (this.записи.size > this.предел) this.записи.delete(this.записи.keys().next().value);
    // Изредка вычищаем просроченное целиком, а не только при обращении.
    if (Math.random() < 0.02) for (const [ключ, з] of this.записи) if (сейчас - з.t > this.жизнь) this.записи.delete(ключ);
  }
  get size() { return this.записи.size; }
  очистить() { this.записи.clear(); }
}
const ЖИЗНЬ_КЭША = 20 * 60 * 1000;

// Разобранные ходы. Ключ — отпечаток настроек, длина и хэш всего текста:
// любая правка сообщения даёт новый ключ, и кэш обновится сам. Отпечаток
// нужен потому, что разбор зависит от включённых разделов и прозвищ, а
// разобранное теперь переживает перезагрузку (IndexedDB, store.js).
const кэш = new КэшРазборов(400, ЖИЗНЬ_КЭША);
const ВЕРСИЯ_РАЗБОРА = (() => { try { return new URL(import.meta.url).search; } catch (_) { return ''; } })();

function хэшСтроки(s) {
  let хэш = 0;
  for (let i = 0; i < s.length; i++) хэш = ((хэш << 5) - хэш + s.charCodeAt(i)) | 0;
  return хэш;
}

// Настройки, от которых зависит разбор (schema.js, names.js). Их же получает
// фоновый поток. Из подмен аватарок — только прозвища: картинки там бывают
// мегабайтными строками.
function настройкиРазбора() {
  return {
    enableUserBlock: settings.enableUserBlock, enableMemory: settings.enableMemory, enablePhone: settings.enablePhone,
    enableIntercepts: settings.enableIntercepts, enableDiary: settings.enableDiary, enableDreams: settings.enableDreams,
    enableWorld: settings.enableWorld, avatarCharNames: settings.avatarCharNames, avatarUserNames: settings.avatarUserNames,
    avatarOverrides: (Array.isArray(settings.avatarOverrides) ? settings.avatarOverrides : []).map(з => ({ names: з && з.names })),
  };
}
function именаТаверны() {
  try {
    const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
    return { user: (ctx && ctx.name1) || '', char: (ctx && ctx.name2) || '' };
  } catch (_) { return { user: '', char: '' }; }
}
// Отпечаток спрашивают на каждый прошлый ход каждой карточки — JSON настроек и
// контекст Таверны пересобираем не чаще раза в полсекунды.
let отпечатокБыл = '', отпечатокКогда = 0;
function отпечаток() {
  const t = Date.now();
  if (отпечатокБыл && t - отпечатокКогда < 500) return отпечатокБыл;
  const и = именаТаверны();
  отпечатокБыл = (хэшСтроки(ВЕРСИЯ_РАЗБОРА + JSON.stringify(настройкиРазбора()) + и.user + '|' + и.char) >>> 0).toString(36);
  отпечатокКогда = t;
  return отпечатокБыл;
}
const ключХода = (raw, fp) => fp + ':' + raw.length + ':' + хэшСтроки(raw);

// Разобранное в главном потоке тоже уходит в базу — пачкой, когда отрисовка
// закончилась.
const вБазу = [];
let таймерБазы = 0;
function запомнитьВБазе(k, d) {
  if (typeof indexedDB === 'undefined') return;
  вБазу.push([k, d]);
  if (!таймерБазы) таймерБазы = setTimeout(() => { таймерБазы = 0; writeParsed(вБазу.splice(0)); }, 2000);
}

// Разборы блоков HUD для сводок истории в запросе (index.js, сводкаHUD) —
// в той же базе и с тем же отпечатком, что ходы: после перезагрузки страницы
// первая генерация не разбирает заново десятки старых HUD. Приставка «с:» —
// ключ блока, а не всего сообщения.
export const ключБлокаСводки = (текст) => 'с:' + ключХода(String(текст || ''), отпечаток());
export const достатьРазборыСводки = (ключи) => readParsed(ключи);
export const запомнитьРазборСводки = (k, d) => запомнитьВБазе(k, d);

// Ключ хода — хэш всего текста (до 80+ тыс. знаков) — запоминаем на объекте
// сообщения, пока текст и отпечаток те же: его спрашивают десятки раз подряд.
const ключиСообщений = new WeakMap();
function ключСообщения(mes, raw) {
  const fp = отпечаток();
  const з = mes && typeof mes === 'object' ? ключиСообщений.get(mes) : null;
  if (з && з.raw === raw && з.fp === fp) return з.k;
  const k = ключХода(raw, fp);
  if (mes && typeof mes === 'object') ключиСообщений.set(mes, { raw, fp, k });
  return k;
}
function разобратьХод(mes) {
  const raw = текст(mes && mes.mes);
  if (!raw) return null;
  // Ключ — хэш всего текста: хвост в шестьдесят знаков совпадал у правок,
  // сделанных в середине блока без изменения длины, и кэш отдавал старый
  // разбор.
  const k = ключСообщения(mes, raw);
  const было = кэш.взять(k);
  if (было !== undefined) return было;
  let результат = null;
  // Блок вне рассуждений модели: упоминание в <plan> не ход.
  const блок = extractHudBlock(raw);
  if (блок) {
    try { результат = normalizeJSONData(parseHUDComplex(блок)); } catch (_) { результат = null; }
  }
  кэш.положить(k, результат);
  if (результат) запомнитьВБазе(k, результат);
  return результат;
}

// --- Фоновый прогрев истории --------------------------------------------------
// При открытии чата прошлые ходы разбираем заранее: сперва берём сохранённое
// в IndexedDB, недостающее отдаём в отдельный поток (parse-worker.js). Когда
// карточке понадобится история, она найдёт всё в кэше, а не будет разбирать
// двадцать ходов посреди отрисовки. Потока нет (старый браузер, запрет) —
// ничего страшного: разбор в главном потоке работает как раньше.

let поток = null, потокСломан = false, номерЗадания = 0;
const ждут = new Map();

function взятьПоток() {
  if (поток || потокСломан) return поток;
  try {
    поток = new Worker(new URL('../parse-worker.js' + ВЕРСИЯ_РАЗБОРА, import.meta.url), { type: 'module' });
    поток.onmessage = (e) => {
      const ответ = e.data || {};
      const ждёт = ждут.get(ответ.id);
      if (ждёт) { ждут.delete(ответ.id); ждёт(ответ); }
    };
    поток.onerror = (e) => {
      console.debug('[TavernOS HUD] фоновый разбор недоступен:', e && e.message);
      потокСломан = true;
      try { поток.terminate(); } catch (_) {}
      поток = null;
      ждут.forEach(ждёт => ждёт({ ошибка: 'поток' }));
      ждут.clear();
    };
  } catch (_) { потокСломан = true; поток = null; }
  return поток;
}

function разобратьВПотоке(тексты) {
  const п = взятьПоток();
  if (!п) return Promise.resolve(null);
  const id = ++номерЗадания;
  return new Promise((готово) => {
    ждут.set(id, готово);
    setTimeout(() => { if (ждут.delete(id)) готово({ ошибка: 'тишина' }); }, 20000);
    п.postMessage({ id, настройки: настройкиРазбора(), имена: именаТаверны(), тексты });
  });
}

const ПРОГРЕВ_ХОДОВ = 400;
const ПАЧКА_ПОТОКА = 25;
let очередьПрогрева = Promise.resolve();

/** Разобрать прошлые ходы чата заранее. Возвращает, сколько ходов добавлено в кэш. */
export function прогретьИсторию(chat) {
  очередьПрогрева = очередьПрогрева.then(() => прогреть(chat)).catch((e) => { console.debug('[TavernOS HUD] прогрев истории:', e); return 0; });
  return очередьПрогрева;
}

async function прогреть(chat) {
  try { performance.mark('hud:прогрев:' + (Array.isArray(chat) ? chat.length : 'нет')); } catch (_) {}
  if (!Array.isArray(chat) || !chat.length || settings.carryOver === false) return 0;
  const fp = отпечаток();
  const кандидаты = [];
  const было = new Set();
  // От свежих к старым: последним карточкам нужны ближние ходы, и ждущая
  // прогрева первая сборка (events.js) получает их в первой же пачке потока.
  for (const mes of chat.slice(-ПРОГРЕВ_ХОДОВ).reverse()) {
    const raw = текст(mes && mes.mes);
    // Без «HUD» в тексте блока нет — такие ходы разбираются мгновенно и так.
    if (!raw || !/hud/i.test(raw)) continue;
    const k = ключХода(raw, fp);
    if (было.has(k) || кэш.взять(k) !== undefined) continue;
    было.add(k);
    кандидаты.push([k, raw]);
  }
  if (!кандидаты.length) return 0;

  const изБазы = await readParsed(кандидаты.map(([k]) => k));
  изБазы.forEach((d, k) => кэш.положить(k, d));
  let добавлено = изБазы.size;
  try { performance.mark('hud:прогрев:база:' + изБазы.size + '/' + кандидаты.length); } catch (_) {}

  const остались = кандидаты.filter(([k]) => !изБазы.has(k));
  for (let i = 0; i < остались.length; i += ПАЧКА_ПОТОКА) {
    const пачка = остались.slice(i, i + ПАЧКА_ПОТОКА);
    // Пока ждали, отрисовка могла разобрать часть сама.
    const нужно = пачка.filter(([k]) => кэш.взять(k) === undefined);
    if (!нужно.length) continue;
    const ответ = await разобратьВПотоке(нужно);
    if (!ответ || ответ.ошибка || !Array.isArray(ответ.ответ)) break;
    ответ.ответ.forEach(([k, d]) => { if (кэш.взять(k) === undefined) кэш.положить(k, d); });
    writeParsed(ответ.ответ.filter(([, d]) => d));
    добавлено += ответ.ответ.length;
  }
  return добавлено;
}

// --- Склейка списков ---------------------------------------------------------

// Список строк: старое впереди, новое в конце, повторы выброшены. Повтор —
// и дописанная строка: «… приказ охранять генерала» и «… приказ охранять
// генерала, Коэн меняет капельницу» — одна запись, остаётся полная.
// В хронологии (поВремени) ещё и пересказ того же события в ту же минуту:
// «15.06 21:43 — Тристан переносит её на руках…» и «15.06 21:43 — Перенос на руках…».
// Дата необязательна: модель чаще пишет одно время («01:05 - …»), и такие
// пересказы раньше не склеивались вовсе — в таймлайне стояли два «01:05»
// об одном и том же поцелуе другими словами.
const МЕТКА_ВРЕМЕНИ = /^\s*((?:\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\s+)?\d{1,2}:\d{2})\s*[-—–:]?\s*/;
const значимые = (s) => new Set(ключ(s).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w.length > 3));
// Пересказ той же минуты переписан почти целиком: общих слов меньше половины,
// но для одной минуты и десятка значимых слов это всё ещё одно событие.
const ДОЛЯ_ТОЙ_ЖЕ_МИНУТЫ = .4;
const минуты = (метка) => { const m = String(метка || '').match(/(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };
function склеитьСтроки(старое, новое, предел, { поВремени = false } = {}) {
  const out = [];
  for (const v of [...(старое || []), ...(новое || [])]) {
    const s = текст(v);
    if (!s) continue;
    const k = ключ(s);
    const метка = поВремени ? (s.match(МЕТКА_ВРЕМЕНИ) || [])[1] : '';
    const суть = метка ? ключ(s.replace(МЕТКА_ВРЕМЕНИ, '')) : k;
    const i = out.findIndex(o => {
      if (o.k === k) return true;
      if (метка && o.метка !== метка) return false;
      const короче = o.суть.length < суть.length ? o.суть : суть, длиннее = короче === суть ? o.суть : суть;
      if (короче.length >= 15 && длиннее.startsWith(короче)) return true;
      if (!метка) return false;
      const A = значимые(o.суть), B = значимые(суть);
      if (!A.size || !B.size) return false;
      let общих = 0; for (const w of A) if (B.has(w)) общих++;
      const доля = общих / Math.min(A.size, B.size);
      return доля >= .75 || (доля >= ДОЛЯ_ТОЙ_ЖЕ_МИНУТЫ && Math.min(A.size, B.size) >= 6);
    });
    if (i === -1) { out.push({ s, k, метка, суть }); continue; }
    // Полнее — та, что длиннее; при равной — свежая.
    if (суть.length >= out[i].суть.length) out[i] = { s, k, метка, суть };
  }
  // Событие, дописанное задним числом («00:48» после «01:07»), встаёт на своё
  // место — но только среди близких по времени соседей: разница больше трёх
  // часов — это уже переход через полночь или другой день, порядок ходов вернее.
  if (поВремени) for (let i = 1; i < out.length; i++) {
    for (let j = i; j > 0; j--) {
      const a = минуты(out[j - 1].метка), b = минуты(out[j].метка);
      if (a === null || b === null || !(a > b && a - b <= 180)) break;
      [out[j - 1], out[j]] = [out[j], out[j - 1]];
    }
  }
  return out.slice(-предел).map(o => o.s);
}

// Разбор строки сообщения на суть: кто, кому, что и когда. Формат строки —
// «Кто -> Кому: текст | время | статус», и всё, кроме текста и времени,
// модель пишет от хода к ходу по-разному.
const ДЛИННОЕ = 40;
function разобратьСообщение(строка) {
  const части = String(строка).split('|');
  let главная = части[0].replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim();
  // Только часы: у одного и того же сообщения в разных ходах дата
  // проставляется разная (день первого появления), а часы те же.
  let время = (текст(части[1]).match(/\d{1,2}:\d{2}/) || [''])[0];
  // Модель иногда пишет время в конце текста, без «|»: «… Скрины у тебя. 11:58».
  const вКонце = главная.match(/\s+(?:\d{1,2}\.\d{1,2}\.\d{2,4},?\s*)?(\d{1,2}:\d{2})\s*$/);
  if (вКонце) { главная = главная.slice(0, вКонце.index); if (!время) время = вКонце[1]; }
  const m = главная.match(/^([^:]+?)(?:\s*(?:->|→)\s*([^:]+))?:\s*([\s\S]*)$/);
  return { тело: ключ(m ? (m[3] || '') : главная), время };
}

// Сообщения переписки: повторы и дописанные варианты сводим в один.
function склеитьСообщения(старое, новое, предел) {
  const принятые = [];
  for (const v of [...(старое || []), ...(новое || [])]) {
    const s = текст(v);
    if (!s) continue;
    const { тело, время } = разобратьСообщение(s);
    // Текста не разобрали — сравниваем по всей строке, как раньше.
    if (!тело) {
      if (!принятые.some(p => p.полная === ключ(s))) принятые.push({ строка: s, тело: '', время: '', полная: ключ(s) });
      continue;
    }
    let решено = false;
    for (let i = принятые.length - 1; i >= 0; i--) {
      const п = принятые[i];
      if (!п.тело) continue;
      const тоЖеВремя = п.время === время;
      if (п.тело === тело && (тоЖеВремя || тело.length >= ДЛИННОЕ)) { решено = true; break; }
      if (!тоЖеВремя) continue;
      // Один текст начинает другой — это тот же дописанный кусок.
      if (тело.startsWith(п.тело)) { принятые[i] = { строка: s, тело, время, полная: ключ(s) }; решено = true; break; }
      if (п.тело.startsWith(тело)) { решено = true; break; }
    }
    if (!решено) принятые.push({ строка: s, тело, время, полная: ключ(s) });
  }
  return принятые.slice(-предел).map(п => п.строка);
}

// Список объектов с опознавательным полем. Свежая запись побеждает: модель
// могла дописать статус или подробности, и терять их нельзя.
function склеитьОбъекты(старое, новое, опознать, предел) {
  const порядок = [];
  const карта = new Map();
  for (const item of [...(старое || []), ...(новое || [])]) {
    if (!item || typeof item !== 'object') continue;
    const k = ключ(опознать(item));
    if (!k) continue;
    if (!карта.has(k)) порядок.push(k);
    карта.set(k, карта.has(k) ? { ...карта.get(k), ...item } : item);
  }
  return порядок.slice(-предел).map(k => карта.get(k));
}

// Переписки: объединяем по названию чата, внутри — сообщения по тексту.
function склеитьЧаты(старое, новое, предел, пределСообщений) {
  const карта = new Map();
  const порядок = [];
  const добавить = (name, чат) => {
    let k = ключ(name);
    if (!k || !чат || typeof чат !== 'object') return;
    // Тот же собеседник под другим написанием имени — тот же чат. Только для
    // имён людей: «Работа» и «Работа // Склад» — разные чаты.
    if (!карта.has(k) && !/[/#_@]/.test(name)) {
      const тот = порядок.find(x => !/[/#_@]/.test(карта.get(x).name) && namesLikelySame(карта.get(x).name, name));
      if (тот) k = тот;
    }
    if (!карта.has(k)) { порядок.push(k); карта.set(k, { name, ...чат, messages: [] }); }
    const прежний = карта.get(k);
    карта.set(k, {
      ...прежний,
      ...чат,
      name: прежний.name || name,
      // Владелец и участники — из свежего хода, если он их назвал.
      owner: текст(чат.owner) || прежний.owner || '',
      participants: текст(чат.participants) || прежний.participants || '',
      messages: склеитьСообщения(прежний.messages, чат.messages, пределСообщений),
    });
  };
  for (const источник of [старое, новое]) {
    for (const name of Object.keys(источник || {})) добавить(name, источник[name]);
  }
  const out = {};
  for (const k of порядок.slice(-предел)) {
    const чат = карта.get(k);
    const { name, ...остальное } = чат;
    out[name] = остальное;
  }
  return out;
}

// Перехваты — те же переписки, только списком.
// Кто пишет в строках перехвата: «Кто -> Кому: текст».
function людиПерехвата(item) {
  const out = [];
  for (const raw of Array.isArray(item.messages) ? item.messages : []) {
    const m = String(raw || '').split('|')[0].match(/^\s*([^:]+?)\s*(?:->|→)\s*([^:]+?)\s*:/);
    if (m) out.push(m[1], m[2]);
  }
  return out;
}
// Перехваты — те же переписки, только списком. Одна переписка, увиденная с
// телефона каждого из двоих («Лейла | Евангелина» и «Евангелина | Лейла»),
// или владелец, названный то полностью, то короче, — одна вкладка. Групповой
// чат («REGENCE_HQ_SEC») узнаём по названию, с чьего бы телефона он ни был.
//
// Личный разговор узнаём по составу: владелец телефона плюс люди из названия
// («Atlas & Ares», «Brandon Kane»). Прежде сравнивали названия целиком, а
// namesLikelySame смотрит на первое имя — и «Atlas & Ares» с «Atlas &
// Evangeline» сходили за один чат: Арес оказывался в переписке с Евангелиной.
const ЧАСТИ_ЧАТА = /\s*(?:&|\||↔|→|->|←|\+|,|\s(?:and|и)\s)\s*/i;
function составЛичного(item, цель, чат, тотЖе) {
  if (!чат || /[/#_@]/.test(чат)) return null;
  const люди = [цель, ...людиПерехвата(item)].filter(Boolean);
  const части = чат.split(ЧАСТИ_ЧАТА).map(s => s.trim()).filter(Boolean);
  // Название чата — люди из самой переписки: это личный разговор.
  if (!части.length || !части.every(ч => люди.some(л => тотЖе(л, ч)))) return null;
  const состав = [];
  for (const x of [цель, ...части]) if (x && !состав.some(y => тотЖе(y, x))) состав.push(x);
  return состав;
}
function склеитьПерехваты(старое, новое, предел, пределСообщений) {
  const записи = [];
  const тотЖе = (a, b) => !!a && !!b && (ключ(a) === ключ(b) || namesLikelySame(a, b));
  const тотЖеСостав = (а, б) => а.length === б.length && а.every(x => б.some(y => тотЖе(x, y))) && б.every(y => а.some(x => тотЖе(x, y)));
  for (const item of [...(старое || []), ...(новое || [])]) {
    if (!item || typeof item !== 'object') continue;
    const цель = текст(item.target), чат = текст(item.chatName);
    if (!цель && !чат) continue;
    const состав = составЛичного(item, цель, чат, тотЖе);
    const найдено = записи.find(з => состав
      ? з.состав && тотЖеСостав(з.состав, состав)
      : !з.состав && ключ(з.чат) === ключ(чат) && (чат || тотЖе(з.цель, цель)));
    if (!найдено) {
      записи.push({ состав, цель, чат, item: { ...item, messages: склеитьСообщения([], item.messages, пределСообщений) } });
      continue;
    }
    найдено.item = { ...найдено.item, ...item, messages: склеитьСообщения(найдено.item.messages, item.messages, пределСообщений) };
    найдено.цель = цель || найдено.цель;
    найдено.чат = чат || найдено.чат;
  }
  return записи.slice(-предел).map(з => з.item);
}

// Ружья Чехова: строка «завязка | к кому относится | статус», опознаём по
// завязке. Свежий ход обновляет статус. Выстрелившее в прошлых ходах дальше
// не переносится: нить закрыта, а в архиве её история остаётся.
function склеитьРужья(старое, новое, предел) {
  const ключРужья = (s) => ключ(String(s).split('|')[0]);
  const карта = new Map();
  for (const s of старое || []) {
    if (статусРужья(String(s).split('|')[2] || '').ключ === 'fired') continue;
    const k = ключРужья(s);
    if (k) карта.set(k, s);
  }
  for (const s of новое || []) {
    const k = ключРужья(s);
    if (!k) continue;
    карта.delete(k);
    карта.set(k, s);
  }
  return [...карта.values()].slice(-предел);
}

// Звонки: один и тот же звонок повторяется из хода в ход — опознаём по чату,
// тексту и часам, оставляем самую раннюю запись.
function склеитьЗвонки(старое, новое, предел) {
  const out = [...(старое || [])];
  const виден = new Set(out.map(з => ключ(з.чат) + '|' + JSON.stringify(разобратьСообщение(з.строка))));
  for (const з of новое || []) {
    const k = ключ(з.чат) + '|' + JSON.stringify(разобратьСообщение(з.строка));
    if (виден.has(k)) continue;
    виден.add(k);
    out.push(з);
  }
  return out.slice(-предел);
}

// Один ход поверх накопленного.
function наложить(накоплено, ход, предел, пределСообщений) {
  const out = накоплено;
  // Сообщения прошлого хода датируются его собственным днём: «08:30» там
  // значило тот день, а «вчера» отсчитывалось от него. Ход не трогаем —
  // он лежит в кэше разбора, — а работаем с копиями.
  const дата = (ход.scene && (ход.scene['Дата'] || ход.scene.Dt)) || '';
  const сДатой = (msgs) => Array.isArray(msgs) ? msgs.map(m => проставитьДень(m, дата)) : msgs;
  const чаты = {};
  for (const [имя, чат] of Object.entries(ход.chatsMap || {})) чаты[имя] = { ...чат, messages: сДатой(чат && чат.messages) };
  const перехваты = (ход.intercepts || []).map(п => ({ ...п, messages: сДатой(п && п.messages) }));
  out.chatsMap = склеитьЧаты(out.chatsMap, чаты, предел, пределСообщений);
  out.intercepts = склеитьПерехваты(out.intercepts, перехваты, предел, пределСообщений);

  const пам = ход.memory || {};
  out.memory.timeline = склеитьСтроки(out.memory.timeline, пам.timeline, предел, { поВремени: true });
  out.memory.important = склеитьСтроки(out.memory.important, пам.important, предел);
  out.memory.secrets = склеитьОбъекты(out.memory.secrets, пам.secrets, s => s.fact, предел);
  out.memory.guns = склеитьРужья(out.memory.guns, пам.guns, предел);

  const тел = ход.phone || {};
  out.phone.contacts = склеитьОбъекты(out.phone.contacts, тел.contacts, c => c.name || c['Имя'], предел);
  out.phone.notes = склеитьОбъекты(out.phone.notes, тел.notes, x => x.title || x.text, предел);
  out.phone.gallery = склеитьОбъекты(out.phone.gallery, тел.gallery, x => x.title || x.desc, предел);
  out.phone.maps = склеитьОбъекты(out.phone.maps, тел.maps, x => x.place || x.title, предел);
  out.phone.calendar = склеитьОбъекты(out.phone.calendar, тел.calendar, x => текст(x.date) + '|' + текст(x.title), предел);
  out.phone.search = склеитьСтроки(out.phone.search, тел.search, предел);
  // Журнал звонков: [CALL: …] из переписок каждого хода. Переписка держит
  // последние N сообщений, и старые звонки из неё уходят, — журнал хранит
  // их отдельно. Первое появление главнее: оно знает день точнее.
  out.phone.callLog = склеитьЗвонки(out.phone.callLog, звонкиИзЧатов(чаты), Math.max(предел, 100));
  // Часы: сон, шаги и пульс каждого хода — из них «Здоровье» рисует день и неделю.
  out.phone.healthLog = склеитьЗдоровье(out.phone.healthLog, записьЗдоровья(ход));

  // Средневековье: письма опознаём по отправителю, адресату и началу текста;
  // свежий ход обновляет статус (было запечатано — стало прочитано).
  out.letters = склеитьОбъекты(out.letters, ход.letters, x => текст(x.from) + '|' + текст(x.to) + '|' + текст(x.text).slice(0, 40), предел);
  out.overheard = склеитьОбъекты(out.overheard, ход.overheard, x => текст(x.where) + '|' + текст((x.lines || [])[0]).slice(0, 40), предел);
  const шк = ход.satchel || {};
  for (const [поле, кл] of [['notes', x => x.title || x.text], ['maps', x => x.place], ['calendar', x => текст(x.date) + '|' + текст(x.title)], ['documents', x => x.title || x.text], ['keepsakes', x => x.title]]) {
    out.satchel[поле] = склеитьОбъекты(out.satchel[поле], шк[поле], кл, предел);
  }

  // Мир сюда не попадает намеренно: новости, слухи, объявления и
  // комментарии — это сегодняшняя сводка, а не память. Склеенные за
  // двадцать ходов, они превращались в ленту из разных дней.
  return out;
}

// --- Главная функция ---------------------------------------------------------

/**
 * Дополняет данные текущего хода списками из предыдущих. Возвращает новый
 * объект: исходный не меняется, чтобы никакие другие потребители данных
 * (сохранение, регенерация) ничего не заметили.
 */
export function mergeCarryOver(data, messageElement) {
  if (!data || settings.carryOver === false) return data;

  const индекс = Number(messageElement && messageElement.getAttribute('mesid'));
  if (!Number.isInteger(индекс) || индекс <= 0) return data;

  let chat = null;
  try {
    const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
    chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : (Array.isArray(window.chat) ? window.chat : null);
  } catch (_) { chat = Array.isArray(window.chat) ? window.chat : null; }
  if (!chat || !chat.length) return data;

  const ходов = Math.max(0, Math.min(200, Number(settings.carryTurns ?? 20)));
  if (!ходов) return data;
  const предел = Math.max(1, Math.min(200, Number(settings.carryMaxItems ?? 30)));
  const пределСообщений = Math.max(1, Math.min(500, Number(settings.carryMaxMessages ?? 60)));

  // Накопитель начинаем пустым и катим по ходам от старых к текущему.
  const накоплено = {
    chatsMap: {}, intercepts: [],
    memory: { timeline: [], important: [], secrets: [], guns: [] },
    phone: { contacts: [], notes: [], gallery: [], maps: [], calendar: [], search: [], callLog: [], healthLog: [] },
    letters: [], overheard: [],
    satchel: { notes: [], maps: [], calendar: [], documents: [], keepsakes: [] },
  };

  const начало = Math.max(0, индекс - ходов);
  let былиПрошлые = false;
  const воспоминания = new Map();
  // Маршрут и истории настроений — за тот же день, что и текущий ход: модель
  // видит в снимке только их хвост (hud-snapshot.js, ХВОСТ_ИСТОРИИ) и пишет
  // хвост с новым, а день целиком собирается здесь.
  const деньХода = текст(data.scene && data.scene['Дата']);
  const день = { route: { user: [], char: [] }, mood: { user: [], char: [] } };
  const копитьДень = (ход) => {
    if (!деньХода || текст(ход.scene && ход.scene['Дата']) !== деньХода) return;
    const пам = ход.memory || {};
    for (const кто of ['user', 'char']) {
      const путь = пам.route && пам.route[кто];
      if (Array.isArray(путь)) день.route[кто] = склеитьСтроки(день.route[кто], путь, МАРШРУТ, { поВремени: true });
      const ист = пам.mood && пам.mood[кто] && пам.mood[кто].history;
      if (Array.isArray(ист)) день.mood[кто] = склеитьСтроки(день.mood[кто], ист, НАСТРОЕНИЙ, { поВремени: true });
    }
  };
  for (let i = начало; i < индекс && i < chat.length; i++) {
    const прошлый = разобратьХод(chat[i]);
    if (!прошлый) continue;
    былиПрошлые = true;
    наложить(накоплено, прошлый, предел, пределСообщений);
    копитьВоспоминания(воспоминания, прошлый);
    копитьДень(прошлый);
  }
  if (!былиПрошлые) return data;
  копитьВоспоминания(воспоминания, data);
  копитьДень(data);

  // Текущий ход кладём последним: его значения главнее.
  наложить(накоплено, data, предел, пределСообщений);

  const итог = { ...data };
  // Списки подменяем только там, где после склейки что-то есть: пустой
  // накопитель не должен прятать то, что прислал текущий ход.
  if (Object.keys(накоплено.chatsMap).length) итог.chatsMap = накоплено.chatsMap;
  if (накоплено.intercepts.length) итог.intercepts = накоплено.intercepts;

  итог.memory = { ...(data.memory || {}) };
  for (const поле of ['timeline', 'important', 'secrets', 'guns']) {
    if (накоплено.memory[поле].length) итог.memory[поле] = накоплено.memory[поле];
  }
  const пам = data.memory || {};
  // Маршрут и смены настроения дня: длиннее присланного — значит, модель
  // писала хвост; подменяем, сохраняя её «сейчас».
  for (const кто of ['user', 'char']) {
    const путь = пам.route && пам.route[кто];
    if (день.route[кто].length > (Array.isArray(путь) ? путь.length : 0)) итог.memory.route = { ...(итог.memory.route || пам.route || {}), [кто]: день.route[кто] };
    const наст = пам.mood && пам.mood[кто];
    const ист = наст && наст.history;
    if (наст && день.mood[кто].length > (Array.isArray(ист) ? ист.length : 0)) итог.memory.mood = { ...(итог.memory.mood || пам.mood), [кто]: { ...наст, history: день.mood[кто] } };
  }
  итог.phone = { ...(data.phone || {}) };
  for (const поле of ['contacts', 'notes', 'gallery', 'maps', 'calendar', 'search', 'callLog', 'healthLog']) {
    if (накоплено.phone[поле].length) итог.phone[поле] = накоплено.phone[поле];
  }
  if (накоплено.letters.length) итог.letters = накоплено.letters;
  if (накоплено.overheard.length) итог.overheard = накоплено.overheard;
  итог.satchel = { ...(data.satchel || {}) };
  for (const поле of Object.keys(накоплено.satchel)) {
    if (накоплено.satchel[поле].length) итог.satchel[поле] = накоплено.satchel[поле];
  }
  // Общие воспоминания — копятся по ходам (модель часто пишет одно и
  // заменяет прежнее): свои эпизоды каждого персонажа текущего хода.
  if (Array.isArray(data.characters) && воспоминания.size) {
    итог.characters = data.characters.map(c => {
      const имя = текст(c && c['Имя']);
      const свои = [...воспоминания.entries()].find(([к]) => namesLikelySame(к, имя));
      if (!свои || свои[1].length < 2) return c;
      return { ...c, 'Общие воспоминания': свои[1].slice(-ВОСПОМИНАНИЙ).join('; ') };
    });
  }
  // Мир остаётся таким, каким его прислал текущий ход.
  return итог;
}

// Столько, сколько просит схема: маршрут до 20 строк, смены настроения до 12.
const МАРШРУТ = 20;
const НАСТРОЕНИЙ = 12;

// --- Общие воспоминания: копятся по ходам ----------------------------------
// Эпизоды через «;». Почти тот же эпизод в новой формулировке («Семь суток
// пустого взгляда Софи за столом и…» каждый ход) — одно воспоминание: место
// оставляем свежее, текст — свежий. Не больше ВОСПОМИНАНИЙ, новые в конце.
const ВОСПОМИНАНИЙ = 8;
const кориВоспоминания = (s) => new Set(ключ(s).replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w.length > 3).map(w => w.slice(0, 5)));
function тоЖеВоспоминание(а, б) {
  const А = кориВоспоминания(а), Б = кориВоспоминания(б);
  if (!А.size || !Б.size) return ключ(а) === ключ(б);
  let общих = 0;
  for (const w of А) if (Б.has(w)) общих++;
  return общих / Math.min(А.size, Б.size) >= 0.6;
}
/** Снимок для модели: «Mm» каждого персонажа — накопленным списком, а не одним
 * эпизодом последнего хода, иначе «сохрани прежние» ей не из чего взять. */
export function дополнитьВоспоминанияСнимка(снимок, chat) {
  if (!снимок || !Array.isArray(снимок.cs) || !Array.isArray(chat) || settings.carryOver === false) return снимок;
  const ходов = Math.max(0, Math.min(200, Number(settings.carryTurns ?? 20)));
  const карта = new Map();
  for (let i = Math.max(0, chat.length - ходов); i < chat.length; i++) копитьВоспоминания(карта, разобратьХод(chat[i]));
  for (const c of снимок.cs) {
    if (!c || typeof c !== 'object' || !c.N) continue;
    const свои = [...карта.entries()].find(([к]) => namesLikelySame(к, String(c.N)));
    if (свои && свои[1].length > 1) c.Mm = свои[1].slice(-6).join('; ');
  }
  return снимок;
}
/**
 * Снимок для модели: у тех, кто в прошлом HUD был записан коротко (вне сцены,
 * без внешности), — прежняя карточка из последнего хода, где они были целиком.
 * Остались вне сцены — строкаСнимка уберёт её снова; вошли в сцену — модель
 * видит, как они выглядят и что при них, и не выдумывает заново.
 */
export function дополнитьКарточкиСнимка(снимок, chat) {
  if (!снимок || !Array.isArray(снимок.cs) || !Array.isArray(chat)) return снимок;
  const нужно = снимок.cs.filter(c => c && typeof c === 'object' && c.N && пустоЗначение(c.Ap));
  if (!нужно.length) return снимок;
  const ждут = new Set(нужно);
  for (let j = chat.length - 1; j >= 0 && j >= chat.length - ГЛУБИНА_КАРТОЧКИ && ждут.size; j--) {
    const ход = чертыХода(chat[j]);
    if (!ход) continue;
    for (const c of [...ждут]) {
      const запись = ход.find(з => namesLikelySame(з.имя, String(c.N)) && з.поля['Внешность'] !== undefined);
      if (!запись) continue;
      for (const [код, поле] of Object.entries(КАРТОЧКА)) if (пустоЗначение(c[код]) && запись.поля[поле] !== undefined) c[код] = запись.поля[поле];
      ждут.delete(c);
    }
  }
  return снимок;
}
function копитьВоспоминания(карта, ход) {
  for (const c of (Array.isArray(ход && ход.characters) ? ход.characters : [])) {
    const имя = текст(c && c['Имя']);
    const сырое = текст(Array.isArray(c && c['Общие воспоминания']) ? c['Общие воспоминания'].join('; ') : c && c['Общие воспоминания']);
    if (!имя || !сырое || /^(empty|none|нет|пусто)$/i.test(сырое)) continue;
    const ключИмени = [...карта.keys()].find(к => namesLikelySame(к, имя)) || имя;
    const список = карта.get(ключИмени) || [];
    for (const эпизод of сырое.split(';').map(s => s.trim()).filter(Boolean)) {
      const i = список.findIndex(было => тоЖеВоспоминание(было, эпизод));
      if (i >= 0) список.splice(i, 1);
      список.push(эпизод);
    }
    карта.set(ключИмени, список.slice(-ВОСПОМИНАНИЙ * 2));
  }
}


// --- Устойчивые черты ---------------------------------------------------------
//
// Вне интимной сцены промт не просит у модели кинки, фетиши, запреты и историю
// секса — это самая тяжёлая часть инструкции, а меняется она редко. На экране
// эти строки не должны пропадать: берём последнее известное значение из прошлых
// ходов того же персонажа. Глубже обычного переноса — черты живут долго, — но
// сообщения без этих ключей отсеиваем простой проверкой текста, без разбора.

const УСТОЙЧИВЫЕ = ['Кинк', 'Фетиш', 'Никогда не сделает', 'Не возбуждает', 'Последний секс', 'Количество партнеров', 'Регулярность секса'];
const ЕСТЬ_ЧЕРТЫ = /"(?:Kn|Ft|NG|NT|SxL|SxC|SxR|Kink|Fet|NoGo|NoTurn|SexLast|SexCount|SexReg|Ap)"|Кинк|Фетиш|Никогда не сделает|Не возбуждает|Последний секс|Количество партнеров|Регулярность секса|Внешность/;
const ГЛУБИНА_ЧЕРТ = 300;
// Карточка того, кто вне сцены (hud-snapshot.js, ВНЕ_СЦЕНЫ_БЕЗ): модель пишет
// его коротко — без внешности, одежды, вещей, реплик, страхов и отметин. Такую
// запись видно по отсутствию внешности; остальное берём из последнего хода,
// где он был целиком. Глубина — как у переноса: прежняя карточка недавняя.
// Общие воспоминания копит перенос (копитьВоспоминания), мысли, ожидание и
// подтекст — свежие каждого хода, их не возвращаем.
const КАРТОЧКА = { Ap: 'Внешность', C: 'Одежда', I: 'Инвентарь', Ln: 'Реплики', Fr: 'Страхи', Mrk: 'Следы на теле' };
const ПОЛЯ_КАРТОЧКИ = Object.values(КАРТОЧКА);
const ГЛУБИНА_КАРТОЧКИ = 40;
const короткаяЗапись = (c) => c && пустоЗначение(c['Внешность']);
// Запись вне сцены целиком — без внешности и без одежды: по ней карточка
// ставит пометку «вне сцены». Одной пропущенной внешности мало — модель
// забывает её и у тех, кто в кадре.
const записьВнеСцены = (c) => короткаяЗапись(c) && пустоЗначение(c['Одежда']);
// Пометка для карточки (character.js): вне сцены и какие поля взяты из
// прошлых ходов. Неперечисляемая — другие виды перебирают поля персонажа и
// не должны её видеть.
function пометитьВнеСцены(data, вернули = new Map()) {
  if (!data || !Array.isArray(data.characters) || !data.characters.some(записьВнеСцены)) return data;
  const characters = data.characters.map((c, i) => {
    if (!записьВнеСцены(c)) return c;
    const копия = { ...c, ...(вернули.get(i) || {}) };
    Object.defineProperty(копия, '__вне', { value: { поля: Object.keys(вернули.get(i) || {}).filter(п => ПОЛЯ_КАРТОЧКИ.includes(п)) }, enumerable: false });
    return копия;
  });
  return { ...data, characters };
}
// «dt: …; pr: …; en: …» без «ak» — короткая запись вне сцены.
const частиИстории = (v) => текст(Array.isArray(v) ? v.join('; ') : v).split(';').map(s => s.trim()).filter(Boolean);
const короткаяИстория = (v) => { const ч = частиИстории(v); return ч.some(s => /^dt\s*[:：]/i.test(s)) && !ч.some(s => /^ak\s*[:：]/i.test(s)); };
const датаИстории = (v) => { const dt = частиИстории(v).find(s => /^dt\s*[:：]/i.test(s)); return dt ? dt.replace(/^dt\s*[:：]\s*/i, '').toLowerCase().replace(/[\s,.]+/g, ' ').trim() : ''; };
const пустоЗначение = (v) => { const s = текст(Array.isArray(v) ? v.join('; ') : v); return !s || /^(empty|none|null|нет|пусто)$/i.test(s); };
// Черты берём из общего разбора хода (разобратьХод): тот же кэш, база и фоновый
// поток, что у переноса списков. Раньше здесь был свой parseHUDComplex по
// своему кэшу — каждый старый ход разбирался второй раз, и первая карточка
// чата тратила на это до 350 мс. Поля черт в обоих разборах совпадают.
// Есть ли черты в тексте — запоминаем на объекте сообщения, пока текст тот же.
const естьЧертыУ = new WeakMap();
const чертыУ = new WeakMap();
function чертыХода(mes) {
  const raw = текст(mes && mes.mes);
  if (!raw) return null;
  const было = естьЧертыУ.get(mes);
  const есть = было && было.raw === raw ? было.есть : ЕСТЬ_ЧЕРТЫ.test(raw);
  if (!было || было.raw !== raw) естьЧертыУ.set(mes, { raw, есть });
  if (!есть) return null;
  const d = разобратьХод(mes);
  if (!d) return null;
  if (чертыУ.has(d)) return чертыУ.get(d);
  let out = (Array.isArray(d.characters) ? d.characters : []).map(c => ({
    имя: текст(c && c['Имя']),
    поля: Object.fromEntries(УСТОЙЧИВЫЕ.concat(короткаяЗапись(c) ? [] : ПОЛЯ_КАРТОЧКИ).filter(п => c && !пустоЗначение(c[п])).map(п => [п, c[п]])),
  })).filter(x => x.имя && Object.keys(x.поля).length);
  if (!out.length) out = null;
  чертыУ.set(d, out);
  return out;
}

/**
 * Возвращает на экран устойчивые черты, которых нет в текущем ходе. Новый
 * объект; исходный не меняется.
 */
export function вернутьЧерты(data, messageElement) {
  if (!data || !Array.isArray(data.characters) || !data.characters.length) return data;
  const индекс = Number(messageElement && messageElement.getAttribute('mesid'));
  if (!Number.isInteger(индекс) || индекс <= 0) return пометитьВнеСцены(data);
  let chat = null;
  try {
    const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
    chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : (Array.isArray(window.chat) ? window.chat : null);
  } catch (_) { chat = Array.isArray(window.chat) ? window.chat : null; }
  if (!chat) return пометитьВнеСцены(data);
  // Карточку того, кто вне сцены, дополнять прошлыми ходами — настройка
  // awayFillFromPast; выключена — видно ровно то, что прислала модель.
  const дополнятьВне = settings.awayFillFromPast !== false;

  // Вне сцены модель пишет «Последний секс» коротко — когда и с кем. Если
  // дата та же, что у полной записи раньше, показываем полную; новая дата —
  // значит, была новая встреча, и короткая запись правдивее старой.
  const нужно = data.characters
    .map((c, i) => ({ i, имя: текст(c && c['Имя']), поля: УСТОЙЧИВЫЕ.filter(п => c && (пустоЗначение(c[п]) || (п === 'Последний секс' && короткаяИстория(c[п])))).concat(короткаяЗапись(c) && дополнятьВне ? ПОЛЯ_КАРТОЧКИ.filter(п => пустоЗначение(c[п])) : []), найдено: {}, дата: c && датаИстории(c['Последний секс']) }))
    .filter(x => x.имя && x.поля.length);
  if (!нужно.length) return пометитьВнеСцены(data);

  for (let j = Math.min(индекс, chat.length) - 1; j >= 0 && j >= индекс - ГЛУБИНА_ЧЕРТ; j--) {
    // Карточку ищем неглубоко: не нашлась — так и останется пустой.
    if (j === индекс - ГЛУБИНА_КАРТОЧКИ - 1) for (const x of нужно) for (const п of ПОЛЯ_КАРТОЧКИ) if (x.поля.includes(п) && !(п in x.найдено)) x.найдено[п] = undefined;
    const ход = чертыХода(chat[j]);
    if (!ход) continue;
    for (const x of нужно) {
      const запись = ход.find(з => namesLikelySame(з.имя, x.имя));
      if (!запись) continue;
      for (const п of x.поля) {
        if (п in x.найдено || запись.поля[п] === undefined) continue;
        // Короткую историю заменяем только полной записью о той же встрече.
        if (п === 'Последний секс' && x.дата) {
          if (короткаяИстория(запись.поля[п])) continue;
          if (датаИстории(запись.поля[п]) !== x.дата) { x.найдено[п] = undefined; continue; }
        }
        x.найдено[п] = запись.поля[п];
      }
    }
    if (нужно.every(x => x.поля.every(п => п in x.найдено))) break;
  }
  if (!нужно.some(x => Object.keys(x.найдено).length)) return пометитьВнеСцены(data);
  const characters = data.characters.slice();
  const вернули = new Map();
  for (const x of нужно) {
    const найдено = Object.fromEntries(Object.entries(x.найдено).filter(([, v]) => v !== undefined));
    if (Object.keys(найдено).length) { characters[x.i] = { ...characters[x.i], ...найдено }; вернули.set(x.i, найдено); }
  }
  // Пометку ставим по присланному моделью: вернув одежду, запись уже не
  // выглядела бы короткой.
  const помечено = пометитьВнеСцены(data, вернули);
  return { ...data, characters: characters.map((c, i) => (помечено.characters[i] && помечено.characters[i].__вне ? помечено.characters[i] : c)) };
}

// Разбор хода нужен и истории близости: таймеру следов и графикам пульса.
export { разобратьХод };

// --- Сдвиги доверия ------------------------------------------------------------
// Сколько доверие к каждому человеку сдвинулось за последний ход и когда
// менялось в последний раз. Карточка показывает это мелкой строкой под
// «Доверием», и только при наведении или нажатии (character.js).
const ГЛУБИНА_ДОВЕРИЯ = 30;
const разобратьДоверие = (v) => {
  const о = {};
  текст(Array.isArray(v) ? v.join('; ') : v).split(/[;\n]/).forEach(ч => {
    const m = ч.match(/^\s*([^:：]{1,40})[:：]\s*(-?\d{1,3})/);
    if (m) о[ключ(m[1])] = { имя: m[1].trim(), v: +m[2] };
  });
  return о;
};
export function сдвигиДоверия(data, messageElement) {
  if (!data || !Array.isArray(data.characters) || !data.characters.length) return data;
  const индекс = Number(messageElement && messageElement.getAttribute('mesid'));
  if (!Number.isInteger(индекс) || индекс <= 0) return data;
  let chat = null;
  try {
    const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
    chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : (Array.isArray(window.chat) ? window.chat : null);
  } catch (_) { chat = Array.isArray(window.chat) ? window.chat : null; }
  if (!chat) return data;
  // Прошлые ходы с HUD, от ближнего к дальнему.
  const прошлые = [];
  for (let j = Math.min(индекс, chat.length) - 1; j >= 0 && прошлые.length < ГЛУБИНА_ДОВЕРИЯ; j--) {
    const ход = разобратьХод(chat[j]);
    if (ход && Array.isArray(ход.characters) && ход.characters.length) прошлые.push(ход);
  }
  if (!прошлые.length) return data;
  let были = false;
  const characters = data.characters.map(c => {
    const сейчас = разобратьДоверие(c && c['Доверие']);
    if (!Object.keys(сейчас).length) return c;
    const имя = текст(c['Имя']);
    const история = прошлые.map(ход => {
      const з = ход.characters.find(x => namesLikelySame(текст(x && x['Имя']), имя));
      return з ? разобратьДоверие(з['Доверие']) : null;
    });
    const сдвиги = {};
    for (const [к, { имя: кто, v }] of Object.entries(сейчас)) {
      const значения = история.map(h => (h && h[к] ? h[к].v : null));
      const первое = значения.findIndex(x => x !== null);
      if (первое < 0) continue;
      const d = v - значения[первое];
      // Ходов назад значение было другим: 0 — сдвинулось в этом ходу.
      let назад = 0;
      if (!d) {
        const другое = значения.findIndex(x => x !== null && x !== v);
        назад = другое < 0 ? -1 : другое;
      }
      сдвиги[кто] = { d, назад };
    }
    if (!Object.keys(сдвиги).length) return c;
    были = true;
    const копия = { ...c };
    Object.defineProperty(копия, '__сдвигиДоверия', { value: сдвиги, enumerable: false, configurable: true });
    if (c && c.__датаСцены !== undefined) Object.defineProperty(копия, '__датаСцены', { value: c.__датаСцены, enumerable: false, configurable: true, writable: true });
    if (c && c.__деньСюжета !== undefined) Object.defineProperty(копия, '__деньСюжета', { value: c.__деньСюжета, enumerable: false, configurable: true, writable: true });
    return копия;
  });
  return были ? { ...data, characters } : data;
}
