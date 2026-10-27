// hud-manager/i18n.js
//
// Язык интерфейса HUD: русский (как написан код) или английский.
//
// Строк с русским текстом в коде — тысячи, и они собираются в разметку из
// сотни модулей. Оборачивать каждую — значит трогать всё и ломать по пути.
// Поэтому перевод — слоем поверх готовой разметки: в английском режиме
// переводчик проходит по тому, что HUD вставил на страницу (карточки, окна,
// настройки, уведомления), и меняет русские тексты и подсказки на английские
// по словарю (i18n-en.js). Новая разметка ловится наблюдателем — до отрисовки,
// без мигания русского. Чужое — сообщения чата, интерфейс Таверны — не
// трогается: переводится только то, что лежит в элементах с классами hud-*.
//
// Строки, которые не попадают на страницу (подтверждения, текст для модели),
// переводятся вызовом т().
//
// Словарь — по исходной русской строке. Строка без перевода остаётся русской:
// ничего не ломается, просто видно, что словарь неполон (tests/i18n.mjs).

import { settings } from './settings.js?v=23.81.0';
import { СЛОВАРЬ_EN, ШАБЛОНЫ_EN } from './i18n-en.js?v=23.81.0';

export const язык = () => (settings.language === 'en' ? 'en' : 'ru');
export const английский = () => язык() === 'en';

// Знаки зодиака — по месту: в общем словаре «Близнецы» — дети, «Весы» — вид дуэли.
const ЗОДИАК_EN = { Овен: 'Aries', Телец: 'Taurus', Близнецы: 'Gemini', Рак: 'Cancer', Лев: 'Leo', Дева: 'Virgo', Весы: 'Libra', Скорпион: 'Scorpio', Стрелец: 'Sagittarius', Козерог: 'Capricorn', Водолей: 'Aquarius', Рыбы: 'Pisces' };
/** Имя знака зодиака на языке интерфейса. */
export const знакЗодиака = (имя) => (английский() && ЗОДИАК_EN[имя]) || имя;

const КИРИЛЛИЦА = /[а-яё]/i;
// Обрамление строки, которое переводить не нужно: эмодзи и значки в начале,
// двоеточие, многоточие и знаки в конце. «🎨 Кастомизация» и «Эпоха:» ищутся
// в словаре как «Кастомизация» и «Эпоха».
const НАЧАЛО = /^[\s\p{Extended_Pictographic}\p{Emoji_Component}‍️•·▸▾▼▲◂►✦★☆✓✗×—–\-+#№(«"']*/u;
const КОНЕЦ = /[\s:：.…!?»"')]*$/u;
// То же, но цифры не срезаются: Emoji_Component включает 0–9, и «6 держится 2 ч»
// иначе ищется как «держится 2 ч» — шаблон «# держится # ч» его не узнаёт.
const НАЧАЛО_С_ЦИФРАМИ = /^[\s\p{Extended_Pictographic}‍️⃣\u{1F3FB}-\u{1F3FF}•·▸▾▼▲◂►✦★☆✓✗×—–\-+#№(«"']*/u;

const словарь = new Map(Object.entries(СЛОВАРЬ_EN));
const шаблоны = ШАБЛОНЫ_EN.map(([rx, замена]) => [rx instanceof RegExp ? rx : new RegExp(rx, 'u'), замена]);

function ядро(s, начало = НАЧАЛО) {
  const до = s.match(начало)[0];
  const остаток = s.slice(до.length);
  const после = остаток.match(КОНЕЦ)[0];
  return [до, остаток.slice(0, остаток.length - после.length), после];
}

// Составные строки: «Доверие: Анна — 85; Марк — 55» собирает код из кусков,
// и целиком её в словаре нет. Переводим по частям — по разделителям, от
// крупного к мелкому; что не нашлось (имена), остаётся как есть.
const РАЗДЕЛИТЕЛИ = ['; ', ' · ', ' — ', ' → ', ': ', ', '];
const ГЛУБИНА = 4;

function поШаблонам(суть, глубина) {
  // Кусок на месте * в шаблоне — тоже по словарю: «после схватки 3 ч» внутри «Сытость: …».
  const часть = (g) => (g && глубина < ГЛУБИНА && КИРИЛЛИЦА.test(g) ? (перевод(g, глубина + 1) ?? g) : g);
  for (const [rx, замена] of шаблоны) {
    const m = суть.match(rx);
    if (!m) continue;
    const итог = typeof замена === 'function' ? суть.replace(rx, замена) : замена.replace(/\$(\d)/g, (_, n) => часть(m[+n]) ?? '');
    if (итог !== суть) return итог;
  }
  return null;
}

function перевод(s, глубина) {
  const целиком = словарь.get(s.trim());
  if (целиком !== undefined) return s.replace(s.trim(), целиком);
  const [до, суть, после] = ядро(s);
  if (!суть) return null;
  // Строка начинается с числа — сначала она же целиком, с числом: «23-я
  // неделя» → «week 23», а не «23-» + «я неделя» → «23-th week».
  const [до2, суть2, после2] = ядро(s, НАЧАЛО_С_ЦИФРАМИ);
  if (суть2 && суть2 !== суть) {
    const v2 = словарь.get(суть2);
    if (v2 !== undefined) return до2 + v2 + после2;
    const ш2 = поШаблонам(суть2, глубина);
    if (ш2 !== null) return до2 + ш2 + после2;
  }
  const v = словарь.get(суть);
  if (v !== undefined) return до + v + после;
  const ш = поШаблонам(суть, глубина);
  if (ш !== null) return до + ш + после;
  if (глубина >= ГЛУБИНА) return null;
  for (const р of РАЗДЕЛИТЕЛИ) {
    if (!суть.includes(р)) continue;
    let удалось = false;
    const куски = суть.split(р).map((к) => {
      if (!КИРИЛЛИЦА.test(к)) return к;
      const t = перевод(к, глубина + 1);
      if (t === null) return к;
      удалось = true;
      return t;
    });
    if (удалось) return до + куски.join(р) + после;
  }
  return null;
}

const кэш = new Map();
/** Перевод строки или null, если в словаре её нет. */
export function перевести(исходная) {
  if (typeof исходная !== 'string' || !КИРИЛЛИЦА.test(исходная)) return null;
  // Разметка переносит длинные тексты по строкам — сравниваем без лишних пробелов.
  const s = исходная.replace(/\s+/g, ' ');
  if (кэш.has(s)) return кэш.get(s);
  const p = перевод(s, 0);
  if (кэш.size > 4000) кэш.clear();
  кэш.set(s, p);
  return p;
}

/** Строка на языке интерфейса: в английском режиме — перевод, если он есть. */
export function т(s) {
  if (!английский()) return s;
  const p = перевести(s);
  return p === null ? s : p;
}

// --- Перевод разметки ----------------------------------------------------------

const АТРИБУТЫ = ['title', 'placeholder', 'aria-label', 'data-tip', 'data-hint', 'alt', 'label'];
// Не трогаем то, что вводит игрок или пишет модель в поля ввода. Подсказки
// самих полей (placeholder, title) — переводим: их пишет HUD.
const НЕ_ТРОГАТЬ = 'script, style, textarea, input:not([type="button"]):not([type="submit"]), [contenteditable="true"], [data-i18n-skip]';
// Всё, что создаёт HUD, — в элементах с классом hud-* или id hud-*.
const СВОЁ = '[class*="hud-"], [id^="hud-"]';
// На <html> HUD ставит свои классы (hud-lang-en, hud-theme-…) — это не
// разметка HUD: иначе «своим» стал бы весь интерфейс Таверны.
const своё = (эл) => { const с = эл && эл.closest(СВОЁ); return !!с && с !== document.documentElement && с !== document.body; };
const ЧУЖОЕ = '[contenteditable="true"], [data-i18n-skip]';

function перевестиТекст(узел) {
  const p = перевести(узел.nodeValue);
  if (p !== null && p !== узел.nodeValue) узел.nodeValue = p;
}
function перевестиАтрибуты(эл) {
  for (const a of АТРИБУТЫ) {
    const v = эл.getAttribute(a);
    if (v && КИРИЛЛИЦА.test(v)) { const p = перевести(v); if (p !== null && p !== v) эл.setAttribute(a, p); }
  }
}

/** Перевести поддерево (только своё, HUD). */
export function перевестиДерево(корень) {
  if (!английский() || !корень) return;
  if (корень.nodeType === 3) {
    const род = корень.parentElement;
    if (род && своё(род) && !род.closest(НЕ_ТРОГАТЬ)) перевестиТекст(корень);
    return;
  }
  if (корень.nodeType !== 1) return;
  const внутриСвоего = своё(корень);
  // Корень вне HUD — переводим только его HUD-потомков.
  if (!внутриСвоего) { корень.querySelectorAll(СВОЁ).forEach(эл => { if (!своё(эл.parentElement)) перевестиДерево(эл); }); return; }
  if (корень.closest(НЕ_ТРОГАТЬ)) { if (!корень.closest(ЧУЖОЕ)) перевестиАтрибуты(корень); return; }
  перевестиАтрибуты(корень);
  const обход = document.createTreeWalker(корень, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType !== 1 || !n.matches(НЕ_ТРОГАТЬ)) return NodeFilter.FILTER_ACCEPT;
      if (!n.matches(ЧУЖОЕ)) перевестиАтрибуты(n);
      return NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = обход.nextNode(); n; n = обход.nextNode()) {
    if (n.nodeType === 3) { if (КИРИЛЛИЦА.test(n.nodeValue)) перевестиТекст(n); }
    else перевестиАтрибуты(n);
  }
}

let наблюдатель = null;
/** Включить перевод страницы: всё уже вставленное и всё, что появится. */
export function включитьПереводчик() {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('hud-lang-en', английский());
  document.documentElement.classList.toggle('hud-lang-ru', !английский());
  if (!английский() || наблюдатель) return;
  перевестиДерево(document.body);
  // Колбэк наблюдателя — микрозадача: перевод успевает до отрисовки.
  наблюдатель = new MutationObserver((записи) => {
    for (const з of записи) {
      if (з.type === 'attributes') { if (з.target.nodeType === 1 && своё(з.target) && !з.target.closest(ЧУЖОЕ)) перевестиАтрибуты(з.target); continue; }
      for (const n of з.addedNodes) перевестиДерево(n);
    }
  });
  наблюдатель.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label', 'label'] });
}
