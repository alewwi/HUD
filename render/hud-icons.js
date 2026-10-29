// hud-manager/render/hud-icons.js
//
// Значки HUD одним SVG-спрайтом вместо эмодзи (настройка iconSet).
//
// Эмодзи рисует шрифт системы: на Windows, macOS и Android они разные, на
// Windows 10 часть из них — квадратики. Спрайт один на страницу: <symbol>
// с currentColor, значок — <svg><use href="#hud-i-имя"/></svg>. Рисунок
// набора (iconStyle: линия, два тона, пиксель, тушь, округлый) задаёт CSS
// классом на <html>, сами пути одни.
//
// Правила, которые держат раскладку на месте:
//  · режим 'emoji' (по умолчанию) возвращает ровно то, что было;
//  · эмодзи без своего значка остаётся эмодзи — пустых мест нет;
//  · обёртки (<i class="hud-key-ico"><span>…</span></i>, ярлык вкладки) не
//    меняются: SVG вписан в 1em и встаёт туда же, где стоял символ;
//  · значок декоративный (aria-hidden), смысл несёт текст рядом.

import { settings } from '../settings.js?v=23.88.2';
import { ИКОНКИ } from './view-icons.js?v=23.88.2';
import { ЕЩЁ, ЕЩЁ_ЭМОДЗИ } from './icon-paths.js?v=23.88.2';

// Рисунки, которых не было в view-icons.js. Квадрат 24×24, обводка.
const ДОП = {
  person: 'M12 4a3.8 3.8 0 1 0 0 7.6A3.8 3.8 0 1 0 12 4Z M4.8 20.2a7.2 7.2 0 0 1 14.4 0',
  people: 'M9 5.4a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4Z M3 19.6a6 6 0 0 1 12 0 M16.2 6.1a3.2 3.2 0 0 1 0 6 M17.6 14.2a6 6 0 0 1 3.4 5.4',
  bottle: 'M10 2.8h4 M10.5 2.8v3.4L8.6 8.4a3 3 0 0 0-.6 1.8v8.6A2.2 2.2 0 0 0 10.2 21h3.6a2.2 2.2 0 0 0 2.2-2.2v-8.6a3 3 0 0 0-.6-1.8l-1.9-2.2V2.8 M8 13h8',
  basket: 'M3.5 10h17l-1.8 9.2a1.6 1.6 0 0 1-1.6 1.3H6.9a1.6 1.6 0 0 1-1.6-1.3Z M7.5 10 11 4 M16.5 10 13 4 M9 14v3.5 M12 14v3.5 M15 14v3.5',
  ear: 'M7 9a5 5 0 0 1 10 0c0 3-2.5 4-3 6.5-.4 2.2-1.6 4.5-4 4.5a3 3 0 0 1-3-3 M10 9.5a2 2 0 0 1 4 0c0 1.2-1.2 1.6-1.6 2.6',
  antenna: 'M12 12v9 M9 21h6 M12 12a1.6 1.6 0 1 0 0-.01 M8.2 8.2a5.4 5.4 0 0 0 0 7.6 M15.8 8.2a5.4 5.4 0 0 1 0 7.6 M5.4 5.4a9.4 9.4 0 0 0 0 13.2 M18.6 5.4a9.4 9.4 0 0 1 0 13.2',
  candle: 'M9 10h6v10.5H9Z M12 10V7.6 M12 2.8c1.4 1.6 2 2.6 2 3.6a2 2 0 0 1-4 0c0-1 .6-2 2-3.6Z M7 20.5h10',
  paw: 'M12 13.2c-2.6 0-4.8 2.4-4.8 4.6 0 1.6 1.4 2.4 2.6 2 1.4-.4 3-.4 4.4 0 1.2.4 2.6-.4 2.6-2 0-2.2-2.2-4.6-4.8-4.6Z M6 9.4a1.8 2.2 0 1 0 0 .01 M9.4 5.6a1.8 2.2 0 1 0 0 .01 M14.6 5.6a1.8 2.2 0 1 0 0 .01 M18 9.4a1.8 2.2 0 1 0 0 .01',
  globe: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17Z M3.5 12h17 M12 3.5c2.4 2.4 3.4 5.2 3.4 8.5s-1 6.1-3.4 8.5 M12 3.5C9.6 5.9 8.6 8.7 8.6 12s1 6.1 3.4 8.5',
  pin: 'M12 21s6.4-6 6.4-11a6.4 6.4 0 1 0-12.8 0c0 5 6.4 11 6.4 11Z M12 7.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8Z',
  mirror: 'M12 3a5.5 7 0 1 0 0 14a5.5 7 0 1 0 0-14Z M12 17v4 M8.5 21h7 M10 7.5c-.8.8-1.2 1.8-1.2 3',
  bandage: 'M4.6 14.8 14.8 4.6a3 3 0 0 1 4.6 4.6L9.2 19.4a3 3 0 0 1-4.6-4.6Z M9.5 9.5l5 5 M11 12h.01 M12 11h.01 M12 13h.01 M13 12h.01',
  battery: 'M4 8h14v8H4Z M18 10.5h2v3h-2 M6.5 10.5v3 M9 10.5v3 M11.5 10.5v3',
  flag: 'M5 21V4 M5 4.5c4-2 6 2 10 0s4 0 4 0v8.5s-1.5-1.5-4 0-6-2-10 0',
  film: 'M4 5h16v14H4Z M8 5v14 M16 5v14 M4 9h4 M4 15h4 M16 9h4 M16 15h4',
  chart: 'M4 20h16 M5 16.5l4.5-5 3.5 3 6-7 M15 7.5h4v4',
  stop: 'M8.2 3.5h7.6l4.7 4.7v7.6l-4.7 4.7H8.2l-4.7-4.7V8.2Z M7.5 12h9',
  thought: 'M7 15.5a4 4 0 0 1-.6-7.9 5 5 0 0 1 9.4-1.2 4 4 0 0 1 2.6 7.3 3.6 3.6 0 0 1-4.4 1.8H7Z M7.5 19.2a1.2 1.2 0 1 0 0 .01 M4.6 21.2a.7.7 0 1 0 0 .01',
  pulse: 'M12 20.2s-7.8-4.6-7.8-10.2A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.8 2.6c0 5.6-7.8 10.2-7.8 10.2Z M5.6 12.4h3.2l1.4-2.4 2.2 4.6 1.4-2.2h4.6',
  stetho: 'M6 3.5v5a4 4 0 0 0 8 0v-5 M10 12.5v2a4.5 4.5 0 0 0 9 0v-2.5 M19 9.8a1.6 1.6 0 1 0 0 .01',
  flower: 'M12 9.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8Z M12 9.6C10 6 10.8 3.6 12 3.6s2 2.4 0 6 M14.3 11.3c3.6-1.6 5.6-.6 5.6.6s-2 2.6-5.6 1 M12 14.4c2 3.6 1.2 6-.01 6s-2-2.4 0-6 M9.7 12.7c-3.6 1.6-5.6.6-5.6-.6s2-2.6 5.6-1',
  handshake: 'M3 11.5 7 7.5l3 1.5 2-1.5 3 .5 4 4 M3 11.5l5.5 5.5c.8.8 2 .8 2.8 0l.2-.2 M21 11.8l-5 5 M10.5 9.5 13 12a1.4 1.4 0 0 0 2-2l-2.5-2.3 M12.6 15.6l1.4 1.4 M14.6 13.6l1.4 1.4',
};

const НАБОР = { ...ИКОНКИ, ...ДОП, ...ЕЩЁ };

// Эмодзи → значок. Вкладки, затем поля карточки (ЗНАЧКИ_ПОЛЕЙ в character.js).
// Ключи без вариационного селектора FE0F: 🗝️ и 🗝 — один значок.
const ЭМОДЗИ = {
  // Вкладки
  '👤': 'person', '⚔': 'swords', '🍼': 'bottle', '🗝': 'key', '📱': 'phone', '🧠': 'head',
  '🧺': 'basket', '👂': 'ear', '📡': 'antenna', '📖': 'book', '🕯': 'candle', '🌙': 'moon',
  '🐾': 'paw', '🌍': 'globe',
  // Поля карточки
  '⏳': 'hourglass', '👕': 'shirt', '🩲': 'briefs', '🎭': 'mask', '📍': 'pin', '🎯': 'target',
  '🎒': 'bag', '📌': 'pin', '🧍': 'torso', '🪞': 'mirror', '🩺': 'stetho', '🩹': 'bandage',
  '💭': 'thought', '🔮': 'gem', '🎞': 'film', '🚩': 'flag', '👁': 'eye', '🩸': 'drop',
  '🔋': 'battery', '👁‍🗨': 'eye', '🤝': 'handshake', '💔': 'heartbreak', '🛏': 'bed',
  '👥': 'people', '📈': 'chart', '📝': 'scroll', '🔗': 'chain', '🎀': 'rose', '⛔': 'stop',
  '🧊': 'snow', '🌡': 'thermo', '💗': 'heart', '🫂': 'hearts', '🛡': 'shield', '💥': 'burst',
  '💓': 'pulse', '🔊': 'megaphone', '💋': 'lipstick', '🌸': 'flower', '🤍': 'heart', '😨': 'ghost',
  '💬': 'speech', '🗓': 'calendar', '🔑': 'key', '🔥': 'flame',
  // Плашки, виды блоков, следы, болезни, телефон, мир, Детская, спутники (icon-paths.js).
  ...ЕЩЁ_ЭМОДЗИ,
};

const VS16 = String.fromCodePoint(0xFE0F);
const норм = (э) => String(э || '').split(VS16).join('').trim();

/** Имя значка для эмодзи или '' — если своего рисунка нет. */
export const имяЗначка = (эмодзи) => { const и = ЭМОДЗИ[норм(эмодзи)]; return и && НАБОР[и] ? и : ''; };

export const значкиВключены = (s = settings) => s.iconSet === 'svg';

/** Эмодзи → значок спрайта (или то же эмодзи, если набор выключен или рисунка нет). */
export function иконка(эмодзи, s = settings) {
  if (!значкиВключены(s)) return эмодзи;
  const имя = имяЗначка(эмодзи);
  return имя ? `<svg class="hud-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#hud-i-${имя}"/></svg>` : эмодзи;
}

// Ведущий эмодзи ярлыка: «⚔️ Бой» → значок + « Бой». Эмодзи может быть
// составным (👁️‍🗨️): пиктограмма, за ней селекторы и ZWJ-продолжения.
const ВЕДУЩИЙ = /^(\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|\u{FE0F}|\u{200D}\p{Extended_Pictographic})*)(\s+)/u;
export function ярлыкСЗначком(ярлык, s = settings) {
  if (!значкиВключены(s)) return ярлык;
  return String(ярлык).replace(ВЕДУЩИЙ, (м, э, пробел) => { const и = иконка(э, s); return и === э ? м : и + пробел; });
}

// Рисунок набора по теме: пиксель — киберпанк и веб 1.0, тушь — нуар и Япония,
// округлый — каваи; остальное — линия.
const СТИЛЬ_ТЕМЫ = { cyberpunk: 'pixel', web1: 'pixel', noir: 'ink', japan: 'ink', kawaii: 'rounded' };
export const СТИЛИ_ЗНАЧКОВ = ['line', 'duotone', 'pixel', 'ink', 'rounded'];
export function стильЗначков(s = settings) {
  const выбран = s.iconStyle;
  if (СТИЛИ_ЗНАЧКОВ.includes(выбран)) return выбран;
  return СТИЛЬ_ТЕМЫ[s.themePreset] || 'line';
}

/** Разметка спрайта: <symbol> на каждый рисунок набора. */
export function разметкаСпрайта() {
  const символы = Object.entries(НАБОР).map(([имя, d]) => `<symbol id="hud-i-${имя}" viewBox="0 0 24 24"><path d="${d}"/></symbol>`).join('');
  return `<svg id="hud-icon-sprite" xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">${символы}</svg>`;
}

/* «Рисунки везде» — значит везде: не только ярлыки вкладок и подписи полей,
   но и плашки, виды блоков, следы, телефон, мир. Один проход по тексту
   готовой карточки меняет каждое эмодзи, у которого есть рисунок, на значок
   спрайта; наблюдатель досматривает то, что появляется позже (ленивые
   вкладки, экраны телефона, граф). Эмодзи без рисунка остаётся как было.
   Исходное эмодзи — в data-emoji: «Эмодзи везде» возвращает его на место. */
const ПИКТО = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\p{Emoji_Modifier}|\u{FE0F}|\u{200D}\p{Extended_Pictographic}\u{FE0F}?)*\u{FE0F}?/gu;
// Где эмодзи — не значок: поля ввода, списки, сам SVG (у <text> нет места для <svg>).
const НЕ_ТРОГАТЬ = 'textarea, select, option, input, script, style, svg, [contenteditable="true"], .hud-ico-skip';
// Чей текст — HUD (настройки и Кастомизация слева — нет: это не карточка).
const В_КАРТОЧКЕ = '.hud-os-card, .hud-custom-preview-body, .hud-modal-overlay, .hud-rel-graph, .hud-sum, .hud-gen-indicator';
const SVG_NS = 'http://www.w3.org/2000/svg';
function значокУзлом(имя, эмодзи) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'hud-ico hi-' + имя); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  svg.dataset.emoji = эмодзи;
  const use = document.createElementNS(SVG_NS, 'use'); use.setAttribute('href', '#hud-i-' + имя);
  svg.appendChild(use);
  return svg;
}
/** Эмодзи → значки в тексте узла и его потомков. Возвращает, сколько заменено. */
export function значкиВ(корень, s = settings) {
  if (!значкиВключены(s) || !корень || typeof document === 'undefined') return 0;
  const узлы = [];
  if (корень.nodeType === 3) узлы.push(корень);
  else if (корень.nodeType === 1 || корень.nodeType === 11) {
    const обход = document.createTreeWalker(корень, NodeFilter.SHOW_TEXT);
    for (let n = обход.nextNode(); n; n = обход.nextNode()) { ПИКТО.lastIndex = 0; if (ПИКТО.test(n.nodeValue)) узлы.push(n); }
  }
  let всего = 0;
  for (const n of узлы) {
    const р = n.parentElement;
    if (!р || р.closest(НЕ_ТРОГАТЬ)) continue;
    const т = n.nodeValue; ПИКТО.lastIndex = 0;
    const куски = []; let от = 0, было = 0;
    for (const m of т.matchAll(ПИКТО)) {
      const имя = имяЗначка(m[0]);
      if (!имя) continue;
      if (m.index > от) куски.push(т.slice(от, m.index));
      куски.push(значокУзлом(имя, m[0])); от = m.index + m[0].length; было++;
    }
    if (!было) continue;
    if (от < т.length) куски.push(т.slice(от));
    n.replaceWith(...куски);
    всего += было;
  }
  // Водяные знаки (следы, афиша, городские службы) рисует CSS из data-ico —
  // туда SVG не вставить: кладём значок отдельным узлом, ::after прячет CSS.
  if (корень.nodeType === 1 || корень.nodeType === 11) {
    const блоки = [...(корень.matches && корень.matches(ВОДЯНЫЕ) ? [корень] : []), ...корень.querySelectorAll(ВОДЯНЫЕ)];
    for (const б of блоки) {
      const имя = имяЗначка(б.dataset.ico);
      if (!имя || б.querySelector(':scope > .hud-ico-wm')) continue;
      const з = значокУзлом(имя, б.dataset.ico); з.classList.add('hud-ico-wm');
      б.appendChild(з); всего++;
    }
  }
  return всего;
}
const ВОДЯНЫЕ = '.hud-mark[data-ico], .hud-afisha-main[data-ico], .hud-city-row[data-ico]';
// «Эмодзи везде»: значки из прохода — обратно в эмодзи (разметка, собранная
// заново, и так придёт с эмодзи; это — для того, что не перерисовывается).
function вернутьЭмодзи() {
  document.querySelectorAll('svg.hud-ico-wm').forEach(з => з.remove());
  document.querySelectorAll('svg.hud-ico[data-emoji]').forEach(з => з.replaceWith(document.createTextNode(з.dataset.emoji)));
}
let наблюдатель = null;
function следить(вкл) {
  if (!вкл) { if (наблюдатель) { наблюдатель.disconnect(); наблюдатель = null; } return; }
  if (наблюдатель || typeof MutationObserver === 'undefined' || !document.body) return;
  наблюдатель = new MutationObserver((записи) => {
    for (const з of записи) {
      if (з.type === 'characterData') { const р = з.target.parentElement; if (р && р.closest(В_КАРТОЧКЕ)) значкиВ(з.target); continue; }
      for (const n of з.addedNodes) {
        if (n.nodeType === 1 && n.matches('svg.hud-ico')) continue;
        const эл = n.nodeType === 1 ? n : n.parentElement;
        if (!эл) continue;
        if (эл.closest(В_КАРТОЧКЕ)) значкиВ(n);
        else if (n.nodeType === 1 && n.querySelectorAll) n.querySelectorAll(В_КАРТОЧКЕ).forEach(к => значкиВ(к));
      }
    }
  });
  наблюдатель.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/** Спрайт в документ — один раз; класс рисунка — на <html>. */
export function подключитьЗначки(s = settings) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;
  const вкл = значкиВключены(s);
  // Рисунок по теме — и для значков шапки свёрнутой карточки ('header').
  const рисунки = s.iconSet === 'svg' || s.iconSet === 'header';
  const было = root.classList.contains('hud-icons-svg');
  root.classList.toggle('hud-icons-svg', вкл);
  СТИЛИ_ЗНАЧКОВ.forEach(ст => root.classList.toggle('hud-ico-' + ст, рисунки && стильЗначков(s) === ст));
  if (вкл && document.body && !document.getElementById('hud-icon-sprite')) document.body.insertAdjacentHTML('beforeend', разметкаСпрайта());
  следить(вкл);
  // Включили — пройти то, что уже на странице; выключили — вернуть эмодзи.
  if (вкл && !было && document.body) document.querySelectorAll(В_КАРТОЧКЕ).forEach(к => значкиВ(к, s));
  if (!вкл && было) вернутьЭмодзи();
}
