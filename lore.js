// hud-manager/lore.js
//
// Домен «Запомнить»: превращение записей HUD в постоянные записи Lorebook.
//
// Модуль занимается только разбором и подготовкой — что считать новой записью,
// какие ключи активации у неё будут и как выглядит запись в формате World Info.
// Сеть и диалог выбора книги живут в index.js: там есть контекст SillyTavern.

import { escapeHtml } from './utils.js?v=22.98.0';

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
  return String(text || '').replace(
    /(?:\[|&lt;|<|&#91;)\s*HUD\s*(?:\]|&gt;|>|&#93;)[\s\S]*?(?:(?:\[|&lt;|<|&#91;)\s*(?:\/|&#47;|\\)\s*HUD\s*(?:\]|&gt;|>|&#93;)|$)/gi, '').trim();
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
    keys && keys.length ? 'NAMES ALREADY INVOLVED: ' + keys.join(', ') : '',
    userName || charName ? `PROTAGONISTS: user = ${userName || '?'}, character = ${charName || '?'}` : '',
    контекст ? 'RECENT STORY (oldest first, newest last):\n' + контекст : '',
    [
      'Answer with ONE JSON object and nothing else — no prose, no code fence:',
      '{',
      '  "title": "short entry name, 2-5 words, no quotes",',
      '  "keys": ["word", "word"],',
      '  "content": "the entry text"',
      '}',
    ].join('\n'),
    [
      'Rules:',
      '- Write "title" and "content" in the language of the story above.',
      '- "content": 2-5 sentences. State what happened, who is involved, who knows and who does not, and why it matters later. No spoilers about the future, no advice to the writer.',
      '- "keys": 3-6 activation words that literally occur in the story text — names, places, objects. No generic words like "секрет" or "he". No {{macros}}.',
      '- Invent nothing that is not in the fact or the story above.',
    ].join('\n'),
  ].filter(Boolean);

  return блоки.join('\n\n');
}

// Разбор ответа. Модель почти всегда добавляет что-то вокруг JSON — кодовый
// забор, извинения, рассуждения. Ищем первый сбалансированный объект.
export function parseLoreGenResponse(raw) {
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
  return { title, keys: keys.slice(0, 8), content };
}
