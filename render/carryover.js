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

import { parseHUDComplex } from '../hud-parser.js?v=23.13.2';
import { проставитьДень } from './msg-feed.js?v=23.13.2';
import { normalizeJSONData } from '../schema.js?v=23.13.2';
import { settings } from '../settings.js?v=23.13.2';
import { статусРужья } from '../codes.js?v=23.13.2';
import { extractHudBlock } from '../hud-block.js?v=23.13.2';
import { namesLikelySame } from '../names.js?v=23.13.2';
import { звонкиИзЧатов, записьЗдоровья, склеитьЗдоровье } from './phone-extra.js?v=23.13.2';
import { readParsed, writeParsed } from '../store.js?v=23.13.2';

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
function отпечаток() {
  const и = именаТаверны();
  return (хэшСтроки(ВЕРСИЯ_РАЗБОРА + JSON.stringify(настройкиРазбора()) + и.user + '|' + и.char) >>> 0).toString(36);
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

function разобратьХод(mes) {
  const raw = текст(mes && mes.mes);
  if (!raw) return null;
  // Ключ — хэш всего текста: хвост в шестьдесят знаков совпадал у правок,
  // сделанных в середине блока без изменения длины, и кэш отдавал старый
  // разбор.
  const k = ключХода(raw, отпечаток());
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
  if (!Array.isArray(chat) || !chat.length || settings.carryOver === false) return 0;
  const fp = отпечаток();
  const кандидаты = [];
  const было = new Set();
  for (const mes of chat.slice(-ПРОГРЕВ_ХОДОВ)) {
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

// Список строк: старое впереди, новое в конце, повторы выброшены.
function склеитьСтроки(старое, новое, предел) {
  const out = [];
  const виден = new Set();
  for (const v of [...(старое || []), ...(новое || [])]) {
    const s = текст(v);
    const k = ключ(s);
    if (!s || виден.has(k)) continue;
    виден.add(k);
    out.push(s);
  }
  return out.slice(-предел);
}

// Разбор строки сообщения на суть: кто, кому, что и когда. Формат строки —
// «Кто -> Кому: текст | время | статус», и всё, кроме текста и времени,
// модель пишет от хода к ходу по-разному.
const ДЛИННОЕ = 40;
function разобратьСообщение(строка) {
  const части = String(строка).split('|');
  const главная = части[0].replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim();
  const m = главная.match(/^([^:-]+?)(?:\s*(?:->|→)\s*([^:]+))?:\s*([\s\S]*)$/);
  return {
    тело: ключ(m ? (m[3] || '') : главная),
    // Только часы: у одного и того же сообщения в разных ходах дата
    // проставляется разная (день первого появления), а часы те же.
    время: (текст(части[1]).match(/\d{1,2}:\d{2}/) || [''])[0],
  };
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
    const k = ключ(name);
    if (!k || !чат || typeof чат !== 'object') return;
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
function склеитьПерехваты(старое, новое, предел, пределСообщений) {
  const карта = new Map();
  const порядок = [];
  for (const item of [...(старое || []), ...(новое || [])]) {
    if (!item || typeof item !== 'object') continue;
    const k = ключ(текст(item.target) + '|' + текст(item.chatName));
    if (!k || k === '|') continue;
    if (!карта.has(k)) порядок.push(k);
    const прежний = карта.get(k) || {};
    карта.set(k, { ...прежний, ...item, messages: склеитьСообщения(прежний.messages, item.messages, пределСообщений) });
  }
  return порядок.slice(-предел).map(k => карта.get(k));
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
  out.memory.timeline = склеитьСтроки(out.memory.timeline, пам.timeline, предел);
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
  for (let i = начало; i < индекс && i < chat.length; i++) {
    const прошлый = разобратьХод(chat[i]);
    if (!прошлый) continue;
    былиПрошлые = true;
    наложить(накоплено, прошлый, предел, пределСообщений);
  }
  if (!былиПрошлые) return data;

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
  // Мир остаётся таким, каким его прислал текущий ход.
  return итог;
}


// --- Устойчивые черты ---------------------------------------------------------
//
// Вне интимной сцены промт не просит у модели кинки, фетиши, запреты и историю
// секса — это самая тяжёлая часть инструкции, а меняется она редко. На экране
// эти строки не должны пропадать: берём последнее известное значение из прошлых
// ходов того же персонажа. Глубже обычного переноса — черты живут долго, — но
// сообщения без этих ключей отсеиваем простой проверкой текста, без разбора.

const УСТОЙЧИВЫЕ = ['Кинк', 'Фетиш', 'Никогда не сделает', 'Не возбуждает', 'Последний секс', 'Количество партнеров', 'Регулярность секса'];
const ЕСТЬ_ЧЕРТЫ = /"(?:Kn|Ft|NG|NT|SxL|SxC|SxR|Kink|Fet|NoGo|NoTurn|SexLast|SexCount|SexReg)"|Кинк|Фетиш|Никогда не сделает|Не возбуждает|Последний секс|Количество партнеров|Регулярность секса/;
const ГЛУБИНА_ЧЕРТ = 300;
const пустоЗначение = (v) => { const s = текст(Array.isArray(v) ? v.join('; ') : v); return !s || /^(empty|none|null|нет|пусто)$/i.test(s); };
const чертыПоХэшу = new КэшРазборов(3000, ЖИЗНЬ_КЭША);

function чертыХода(mes) {
  const raw = текст(mes && mes.mes);
  if (!raw || !ЕСТЬ_ЧЕРТЫ.test(raw)) return null;
  let хэш = 0;
  for (let i = 0; i < raw.length; i++) хэш = ((хэш << 5) - хэш + raw.charCodeAt(i)) | 0;
  const k = raw.length + ':' + хэш;
  const было = чертыПоХэшу.взять(k);
  if (было !== undefined) return было;
  let out = null;
  const блок = extractHudBlock(raw);
  if (блок) {
    try {
      const d = parseHUDComplex(блок);
      out = (Array.isArray(d.characters) ? d.characters : []).map(c => ({
        имя: текст(c && c['Имя']),
        поля: Object.fromEntries(УСТОЙЧИВЫЕ.filter(п => c && !пустоЗначение(c[п])).map(п => [п, c[п]])),
      })).filter(x => x.имя && Object.keys(x.поля).length);
      if (!out.length) out = null;
    } catch (_) { out = null; }
  }
  // Храним только черты — это строки, память не растёт заметно.
  чертыПоХэшу.положить(k, out);
  return out;
}

/**
 * Возвращает на экран устойчивые черты, которых нет в текущем ходе. Новый
 * объект; исходный не меняется.
 */
export function вернутьЧерты(data, messageElement) {
  if (!data || !Array.isArray(data.characters) || !data.characters.length) return data;
  const индекс = Number(messageElement && messageElement.getAttribute('mesid'));
  if (!Number.isInteger(индекс) || индекс <= 0) return data;
  let chat = null;
  try {
    const ctx = window.SillyTavern && window.SillyTavern.getContext && window.SillyTavern.getContext();
    chat = ctx && Array.isArray(ctx.chat) ? ctx.chat : (Array.isArray(window.chat) ? window.chat : null);
  } catch (_) { chat = Array.isArray(window.chat) ? window.chat : null; }
  if (!chat) return data;

  const нужно = data.characters
    .map((c, i) => ({ i, имя: текст(c && c['Имя']), поля: УСТОЙЧИВЫЕ.filter(п => c && пустоЗначение(c[п])), найдено: {} }))
    .filter(x => x.имя && x.поля.length);
  if (!нужно.length) return data;

  for (let j = Math.min(индекс, chat.length) - 1; j >= 0 && j >= индекс - ГЛУБИНА_ЧЕРТ; j--) {
    const ход = чертыХода(chat[j]);
    if (!ход) continue;
    for (const x of нужно) {
      const запись = ход.find(з => namesLikelySame(з.имя, x.имя));
      if (!запись) continue;
      for (const п of x.поля) if (!(п in x.найдено) && запись.поля[п] !== undefined) x.найдено[п] = запись.поля[п];
    }
    if (нужно.every(x => x.поля.every(п => п in x.найдено))) break;
  }
  if (!нужно.some(x => Object.keys(x.найдено).length)) return data;
  const characters = data.characters.slice();
  for (const x of нужно) if (Object.keys(x.найдено).length) characters[x.i] = { ...characters[x.i], ...x.найдено };
  return { ...data, characters };
}

// Разбор хода нужен и истории близости: таймеру следов и графикам пульса.
export { разобратьХод };
