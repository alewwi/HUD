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

import { parseHUDComplex } from '../hud-parser.js?v=22.99.58';
import { normalizeJSONData } from '../schema.js?v=22.99.58';
import { settings } from '../settings.js?v=22.99.58';
import { статусРужья } from '../codes.js?v=22.99.58';
import { hudBlockRe } from '../hud-block.js?v=22.99.58';

const текст = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const ключ = (v) => текст(v).toLowerCase().replace(/[ё]/g, 'е').replace(/[«»"'`.,;:!?()\[\]]/g, '').replace(/\s+/g, ' ');

// Тот же набор написаний [HUD], что и везде: модель шлёт то скобки, то угловые,
// а SillyTavern иногда успевает заэкранировать.
const БЛОК = hudBlockRe('i');

// Разобранные ходы. Ключ — длина и хэш всего текста: любая правка сообщения
// даёт новый ключ, и кэш обновится сам.
const кэш = new Map();

function разобратьХод(mes) {
  const raw = текст(mes && mes.mes);
  if (!raw) return null;
  // Ключ — хэш всего текста: хвост в шестьдесят знаков совпадал у правок,
  // сделанных в середине блока без изменения длины, и кэш отдавал старый
  // разбор.
  let хэш = 0;
  for (let i = 0; i < raw.length; i++) хэш = ((хэш << 5) - хэш + raw.charCodeAt(i)) | 0;
  const k = raw.length + ':' + хэш;
  if (кэш.has(k)) return кэш.get(k);
  let результат = null;
  const блок = raw.match(БЛОК);
  if (блок) {
    try { результат = normalizeJSONData(parseHUDComplex(блок[0])); } catch (_) { результат = null; }
  }
  // Кэш не должен расти бесконечно: держим последние двести ходов.
  if (кэш.size > 200) кэш.clear();
  кэш.set(k, результат);
  return результат;
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
    время: текст(части[1]).replace(/[^0-9:]/g, ''),
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

// Один ход поверх накопленного.
function наложить(накоплено, ход, предел, пределСообщений) {
  const out = накоплено;
  out.chatsMap = склеитьЧаты(out.chatsMap, ход.chatsMap, предел, пределСообщений);
  out.intercepts = склеитьПерехваты(out.intercepts, ход.intercepts, предел, пределСообщений);

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
    phone: { contacts: [], notes: [], gallery: [], maps: [], calendar: [], search: [] },
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
  for (const поле of ['contacts', 'notes', 'gallery', 'maps', 'calendar', 'search']) {
    if (накоплено.phone[поле].length) итог.phone[поле] = накоплено.phone[поле];
  }
  // Мир остаётся таким, каким его прислал текущий ход.
  return итог;
}


// Разбор хода нужен и истории близости: таймеру следов и графикам пульса.
export { разобратьХод };
