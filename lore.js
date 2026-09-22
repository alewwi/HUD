// hud-manager/lore.js
//
// Домен «Запомнить»: превращение записей HUD в постоянные записи Lorebook.
//
// Модуль занимается только разбором и подготовкой — что считать новой записью,
// какие ключи активации у неё будут и как выглядит запись в формате World Info.
// Сеть и диалог выбора книги живут в index.js: там есть контекст SillyTavern.

import { escapeHtml } from './utils.js?v=23.0.2';

// Уже виденные записи за эту сессию. Карточки отрисовываются сверху вниз,
// поэтому первая встреча текста и есть его появление в истории. Ключ —
// нормализованный текст: разный регистр и лишние пробелы не должны плодить
// «новые» записи на каждом ходу.
const seen = new Set();
const norm = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').replace(/[«»"'`.,;:!?()]/g, '').trim();

// true — текст встретился впервые. Повторный вызов с тем же текстом уже даёт
// false, поэтому вызывать её нужно ровно один раз на элемент при отрисовке.
export function isNewLoreItem(text) {
  const key = norm(text);
  if (!key || key.length < 3) return false;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

import { namePhoneticLatin, формыИмени } from './names.js?v=23.0.2';
import { заменитьHudБлоки } from './hud-block.js?v=23.0.2';

// Служебные слова, которые в ключи активации не годятся: они встречаются
// в каждом втором сообщении и запись срабатывала бы постоянно.
const STOP = new Set(['это', 'этот', 'эта', 'того', 'тому', 'который', 'которая',
  'после', 'перед', 'между', 'потому', 'когда', 'если', 'чтобы', 'ещё', 'уже',
  'она', 'они', 'его', 'него', 'нее', 'неё', 'them', 'this', 'that', 'with',
  'from', 'have', 'been', 'were', 'their', 'there', 'about', 'вчера', 'сегодня', 'завтра',
  // Обычные слова, с которых часто начинается фраза: в начале они пишутся
  // с заглавной и без этого списка попадали бы в ключи как имена.
  'ключ', 'письмо', 'никто', 'кто-то', 'все', 'всё', 'один', 'одна',
  'место', 'дело', 'ночью', 'утром', 'вечером', 'днём', 'теперь', 'сейчас']);

// Ключи активации: имена собственные из текста плюс всё, что передали явно
// (имя персонажа, владелец секрета). Без ключей запись в World Info мертва —
// она просто никогда не сработает.
export function loreKeysFrom(text, extra = []) {
  const out = [];
  const push = (w) => {
    const v = String(w || '').trim().replace(/[«»"'`.,;:!?()]+$/g, '');
    if (v.length < 3) return;
    // {{user}} и {{char}} — макросы, а не слова: в тексте сообщения их нет,
    // и ключом такая строка никогда не сработает.
    if (/\{\{.*\}\}/.test(v)) return;
    if (STOP.has(v.toLowerCase())) return;
    if (out.some(x => x.toLowerCase() === v.toLowerCase())) return;
    out.push(v);
  };
  (Array.isArray(extra) ? extra : [extra]).forEach(push);

  // Слово с заглавной буквы — почти всегда имя или место. Первое слово
  // отбрасывать нельзя: в этих записях подлежащее как раз стоит первым
  // («Тристан отдал Софи ключ»), и без него запись теряла главный ключ.
  // От обычных слов в начале фразы защищает список STOP.
  String(text || '').split(/\s+/).forEach(raw => {
    const w = raw.replace(/^[«»"'`(]+/, '');
    if (/^[А-ЯЁA-Z][а-яёa-z-]{2,}$/.test(w)) push(w);
  });
  return out.slice(0, 6);
}

// Кнопка рядом с записью. Текст и ключи едут в data-атрибутах: обработчик
// клика живёт в events.js и о самой записи ничего больше не знает.
export function loreButtonHTML(text, extra = [], isNew = false) {
  const keys = loreKeysFrom(text, extra);
  return `<button type="button" class="hud-remember${isNew ? ' is-new' : ''}"` +
    ` data-lore-text="${escapeHtml(String(text || ''))}"` +
    ` data-lore-keys="${escapeHtml(keys.join(', '))}"` +
    ` title="Запомнить в Lorebook — запись останется в мире навсегда">` +
    `<span class="hud-remember-ico" aria-hidden="true">✚</span>` +
    `<span class="hud-remember-cap">Запомнить</span></button>`;
}

// Запись в формате World Info. Поля перечислены полностью и в том же виде,
// в каком их пишет сам SillyTavern: файл читают и другие его части, лишних
// или недостающих полей там быть не должно.
export function buildLoreEntry(uid, displayIndex, keys, content, comment) {
  return {
    uid,
    key: keys,
    keysecondary: [],
    comment: comment || 'HUD',
    content: String(content || ''),
    constant: false,
    selective: true,
    order: 100,
    position: 1,
    disable: false,
    displayIndex,
    addMemo: true,
    group: '',
    groupOverride: false,
    groupWeight: 100,
    sticky: 0,
    cooldown: 0,
    delay: 0,
    probability: 100,
    depth: 4,
    useProbability: true,
    role: null,
    vectorized: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    selectiveLogic: 0,
    ignoreBudget: false,
    matchPersonaDescription: false,
    matchCharacterDescription: false,
    matchCharacterPersonality: false,
    matchCharacterDepthPrompt: false,
    matchScenario: false,
    matchCreatorNotes: false,
    outletName: '',
    triggers: [],
    characterFilter: { isExclude: false, names: [], tags: [] },
  };
}

// Уже есть ли в книге запись с таким же содержимым. Защищает от дублей,
// когда одну и ту же строку запоминают дважды с разных карточек.
export function loreAlreadyHas(book, content) {
  const target = norm(content);
  if (!target) return false;
  const entries = (book && book.entries) || {};
  return Object.values(entries).some(e => norm(e && e.content) === target);
}

// --- Генерация записи моделью -----------------------------------------------
//
// Кнопка «Сгенерировать» просит модель дописать к сухому факту заголовок,
// ключи активации и связный текст с контекстом. Ответ модели разбирается
// здесь же: запрос и разбор должны меняться вместе, иначе первая же правка
// формата ломает вторую половину.

// Убираем из текста сообщения наш собственный блок [HUD]: в контексте нужна
// проза, а не JSON, который мы сами и сгенерировали ходом раньше.
export function stripHudBlock(text) {
  return заменитьHudБлоки(String(text || ''), '').trim();
}

// Запрос к модели. Пишем по-английски: инструкции модели держатся лучше, а
// язык самой записи задаём отдельным требованием — по языку истории.
export function buildLoreGenPrompt({ fact, keys, messages, userName, charName }) {
  // Сообщения приходят из чата как есть — с разметкой, картинками и кнопками
  // интерфейса. Модели нужна проза: теги режем, пробелы схлопываем.
  const проза = (t) => String(t || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const контекст = (Array.isArray(messages) ? messages : [])
    .map(m => ({ name: m.name || '?', text: проза(m.text).slice(0, 900) }))
    .filter(m => m.text)
    .map(m => `${m.name}: ${m.text}`)
    .join('\n\n');

  // Блоки собираем списком и склеиваем пустой строкой: слипшиеся секции модель
  // читает как один абзац и путает факт с контекстом.
  const блоки = [
    'Write ONE permanent World Info (lorebook) entry for an ongoing roleplay.',
    'FACT TO RECORD (this is the point of the entry, do not contradict it):\n' + String(fact || '').trim(),
    keys && keys.length ? 'PEOPLE INVOLVED (context only — do NOT use them as keys): ' + keys.join(', ') : '',
    userName || charName ? `PROTAGONISTS: user = ${userName || '?'}, character = ${charName || '?'}` : '',
    контекст ? 'RECENT STORY (oldest first, newest last):\n' + контекст : '',
    [
      'Answer with ONE JSON object and nothing else — no prose, no code fence:',
      '{',
      '  "title": "short entry name, 2-5 words, no quotes",',
      '  "keys": ["word", "word", "… at least 10 in total"],',
      '  "content": "the entry text"',
      '}',
    ].join('\n'),
    [
      'Rules:',
      '- Write "title" and "content" in the language of the story above.',
      '- "content": 2-5 sentences. State what happened, who is involved, who knows and who does not, and why it matters later. No spoilers about the future, no advice to the writer.',
      '- "keys": AT LEAST 10 activation words, up to 15 — the specific triggers of THIS memory: objects, places, events, actions and distinctive words or short phrases that will literally appear in future messages exactly when this memory matters (e.g. "пистолет", "ящик стола", "сейф", "кабинет отца"). Several grammatical forms of the same word are welcome ("пистолет", "пистолета").',
      '- Avoid names of people in "keys": the main characters are named in almost every message and would fire the entry all the time. At most one name, and only if the memory cannot be recognised without it. No generic words like "секрет", "он" or "he". No {{macros}}.',
      '- Invent nothing that is not in the fact or the story above.',
    ].join('\n'),
  ].filter(Boolean);

  return блоки.join('\n\n');
}

// Ключи — зацепки самого воспоминания: предметы, места, события, особые
// слова. Не имена: главные герои названы почти в каждом сообщении, и запись
// с их именами срабатывала бы всё время, а не тогда, когда нужна.
//
// Меньше десяти ключей — запись срабатывает редко: в следующих сообщениях то
// же самое называют другими словами. Если модель прислала мало, добираем из
// самой записи: сначала словосочетания («письменного стола»), потом значимые
// существительные. Глаголы, прилагательные и наречия отсекаем по окончаниям.
// Имена добавляем только если без них десяти не набрать — и не больше двух.
export const МИН_КЛЮЧЕЙ = 10;
const МАКС_КЛЮЧЕЙ = 20;
const МАКС_ИМЁН = 2;
const НЕ_СУЩЕСТВИТЕЛЬНОЕ = /(?:ла|ло|ли|ал|ил|ул|ть|ться|тся|лся|лась|лось|лись|ет|ит|ут|ют|ат|ят|ешь|ишь|ем|им|ый|ий|ой|ая|яя|ое|ее|ые|ого|его|ому|ему|ыми|ими|но|ко|ски)$/;
const ПРИЛАГАТЕЛЬНОЕ = /(?:ого|его|ой|ей|ый|ий|ая|яя|ое|ее|ые|ие|ую|юю|ых|их|ым|им)$/;

// Имя ли это: совпадает с известными именами (в любом алфавите и падеже) или
// пишется с заглавной посреди предложения. Словосочетание именем не считаем:
// «особняк Кингсли» — место, и это хорошая зацепка.
function этоИмя(ключ, известные, весь) {
  const k = String(ключ || '').trim();
  if (!k || /\s/.test(k)) return false;
  // Строго: одна из падежных форм звучит точно как слово известного имени.
  // Нечёткое сравнение имён здесь не годится — «сейф» оно сочло бы «Софи».
  const звуки = известные.flatMap(n => n.split(/\s+/)).map(w => namePhoneticLatin(w)).filter(Boolean);
  if (звуки.length && формыИмени(k).some(ф => звуки.includes(namePhoneticLatin(ф)))) return true;
  if (!/^\p{Lu}/u.test(k)) return false;
  const rx = new RegExp('(^|[.!?…]\\s+|\\n\\s*)?' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}])', 'gu');
  for (const m of весь.matchAll(rx)) if (m[1] === undefined) return true;
  return false;
}
// Имя, стоящее только в начале предложения, заглавной себя не выдаёт. Зато
// имя никогда не пишется строчными: слово, которое в тексте есть только с
// заглавной, считаем именем.
function похожеНаИмя(слово, весь) {
  const низ = String(слово || '').toLowerCase();
  if (!низ || /\s/.test(низ)) return false;
  const заглавное = низ.charAt(0).toUpperCase() + низ.slice(1);
  const экран = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const есть = (w) => new RegExp('(?<![\\p{L}])' + экран(w) + '(?![\\p{L}])', 'u').test(весь);
  return есть(заглавное) && !есть(низ);
}

export function дополнитьКлючи(ключи, тексты = [], минимум = МИН_КЛЮЧЕЙ, имена = []) {
  const весь = (Array.isArray(тексты) ? тексты : [тексты]).map(t => String(t || '')).join('\n');
  const известные = (Array.isArray(имена) ? имена : []).map(x => String(x || '').trim()).filter(x => x && !/\{\{.*\}\}/.test(x));
  const отложенныеИмена = [];
  const out = [];
  const добавить = (w, можноИмя = false) => {
    const v = String(w || '').trim().replace(/^[«»"'`(]+|[«»"'`.,;:!?()]+$/g, '');
    if (v.length < 3 || /\{\{.*\}\}/.test(v) || STOP.has(v.toLowerCase())) return;
    if (out.some(x => x.toLowerCase() === v.toLowerCase())) return;
    if (!можноИмя && (этоИмя(v, известные, весь) || похожеНаИмя(v, весь))) {
      if (!отложенныеИмена.some(x => x.toLowerCase() === v.toLowerCase())) отложенныеИмена.push(v);
      return;
    }
    out.push(v);
  };
  (Array.isArray(ключи) ? ключи : []).forEach(k => добавить(k));
  if (out.length < минимум) {
    // Словосочетания «прилагательное + существительное»: «письменного стола».
    const слова = весь.toLowerCase().match(/[а-яёa-z][а-яёa-z-]*/g) || [];
    const пары = new Map();
    for (let i = 0; i + 1 < слова.length; i++) {
      const a = слова[i], b = слова[i + 1];
      // Второе слово — существительное в любом падеже («письменного стола»),
      // поэтому отсекаем только явные глаголы.
      if (a.length >= 5 && b.length >= 4 && ПРИЛАГАТЕЛЬНОЕ.test(a) && !/(?:ть|ться|тся|лся|лась|лось|лись)$/.test(b) && !STOP.has(a) && !STOP.has(b)) {
        пары.set(a + ' ' + b, (пары.get(a + ' ' + b) || 0) + 1);
      }
    }
    [...пары.entries()].sort((x, y) => y[1] - x[1]).forEach(([p]) => { if (out.length < минимум) добавить(p); });
  }
  if (out.length < минимум) {
    // Значимые существительные: от пяти букв, по частоте.
    const частота = new Map();
    for (const m of весь.matchAll(/[А-ЯЁA-Zа-яёa-z][а-яёa-z-]{4,}/g)) {
      const исходное = m[0], w = исходное.toLowerCase();
      if (STOP.has(w) || НЕ_СУЩЕСТВИТЕЛЬНОЕ.test(w)) continue;
      частота.set(w, (частота.get(w) || 0) + 1);
    }
    [...частота.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .forEach(([w]) => { if (out.length < минимум) добавить(w); });
  }
  // Имена — последним средством, и немного.
  // «Тристан» и «Tristan» — одно имя: второе такое же место не занимает.
  const звукиИмён = [];
  let имён = 0;
  for (const имя of отложенныеИмена) {
    if (out.length >= минимум || имён >= МАКС_ИМЁН) break;
    const звуки = формыИмени(имя).map(ф => namePhoneticLatin(ф)).filter(Boolean);
    if (звукиИмён.some(з => звуки.includes(з))) continue;
    звукиИмён.push(...звуки);
    добавить(имя, true);
    имён++;
  }
  return out.slice(0, МАКС_КЛЮЧЕЙ);
}

// Разбор ответа. Модель почти всегда добавляет что-то вокруг JSON — кодовый
// забор, извинения, рассуждения. Ищем первый сбалансированный объект.
// контекст: { fact, keys } — исходный факт и ключи из окна; из них добирается
// до десяти ключей, если модель прислала меньше.
export function parseLoreGenResponse(raw, контекст = {}) {
  const text = String(raw || '').replace(/<think[\s\S]*?<\/think>/gi, '');
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) { end = i; break; } }
  }
  if (end < 0) return null;
  let parsed;
  try { parsed = JSON.parse(text.slice(start, end + 1)); } catch (_) { return null; }
  if (!parsed || typeof parsed !== 'object') return null;

  const content = String(parsed.content ?? parsed.text ?? '').trim();
  if (!content) return null;
  const title = String(parsed.title ?? parsed.name ?? '').trim().replace(/^["'«»]+|["'«»]+$/g, '');
  const keysRaw = Array.isArray(parsed.keys) ? parsed.keys
    : String(parsed.keys ?? parsed.keywords ?? '').split(/[;,]/);
  const keys = [];
  for (const k of keysRaw) {
    const v = String(k || '').trim().replace(/^["'«]+|["'»]+$/g, '');
    // Макросы ключом не работают: в тексте сообщения их нет.
    if (v.length < 2 || /\{\{.*\}\}/.test(v)) continue;
    if (!keys.some(x => x.toLowerCase() === v.toLowerCase())) keys.push(v);
  }
  // Ключи окна — обычно имена участников: идут и кандидатами, и списком имён.
  const окно = Array.isArray(контекст.keys) ? контекст.keys : [];
  const полные = дополнитьКлючи([...keys, ...окно], [title, content, контекст.fact || ''], МИН_КЛЮЧЕЙ,
    [...(Array.isArray(контекст.names) ? контекст.names : []), ...окно]);
  return { title, keys: полные, content };
}
