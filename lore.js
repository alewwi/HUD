// hud-manager/lore.js
//
// Домен «Запомнить»: превращение записей HUD в постоянные записи Lorebook.
//
// Модуль занимается только разбором и подготовкой — что считать новой записью,
// какие ключи активации у неё будут и как выглядит запись в формате World Info.
// Сеть и диалог выбора книги живут в index.js: там есть контекст SillyTavern.

import { escapeHtml } from './utils.js?v=22.70.10';

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
