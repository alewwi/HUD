// hud-manager/render/heraldry.js
//
// Средневековье: знак рода у имени на карточке (настройка heraldry). HUD
// рисует его сам, модель ничего не пишет:
//   · знать (барон, графиня, рыцарь, леди…) — герб на щите: поле и деление
//     в финифтях и металлах (металл не кладут на металл), фигура в центре;
//   · ремесленник (кузнец, ткачиха, пекарь…) — знак ремесла в круге;
//   · остальные — домовая метка: простой знак из линий, как на дверях и мешках.
// Кто есть кто — по роли персонажа (поле «Роль», её модель и так пишет).
// Герб берётся из рода — фамилии или «фон …», «де …», «из …»: у одной семьи
// один герб на любом устройстве. Нажатие на знак — маленькое окно: другой
// вариант или свой выбор; выбор хранится в данных чата (tavernosHudArms).
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.78';
import { settings } from '../settings.js?v=23.89.78';
import { старина } from '../era.js?v=23.89.78';
import { примерМета } from '../sample-meta.js?v=23.89.78';

const КЛЮЧ = 'tavernosHudArms';
export const гербыВкл = () => старина() && settings.heraldry !== false;

// --- Род и сословие ------------------------------------------------------------
const ЧАСТИЦЫ = /(?:^|\s)(?:фон|von|де|ди|дю|de|di|du|van|ван|из|of|ап|ab|мак|mac|о'|o')\s+(\S.*)$/iu;
/** «Ричард фон Вельт» → «вельт»; «Анна Грей» → «грей»; «Ульрих» → «ульрих». */
export function родИмени(имя) {
  const s = String(имя || '').replace(/[«»"'„“”()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const ч = s.match(ЧАСТИЦЫ);
  const слова = (ч ? ч[1] : s).split(' ').filter(Boolean);
  return (ч ? слова.join(' ') : слова[слова.length - 1] || '').toLowerCase().replace(/ё/g, 'е');
}
// Титул — только сам по себе, в именительном: «служанка барона» и «дама
// сердца рыцаря» — не знать; «барон», «графиня», «Lady of the house» — знать.
const ЗНАТЬ = /(?<![\p{L}])(?:король|королева|принц|принцесса|князь|княгиня|княжна|герцог|герцогиня|граф|графиня|барон|баронесса|маркиз|маркиза|виконт|виконтесса|рыцарь|сэр|леди|лорд|дворянин|дворянка|боярин|боярыня|воевода|сеньор|сеньора|наследник|наследница|оруженосец|king|queen|prince|princess|duke|duchess|count|countess|earl|baron|baroness|marquis|marquess|viscount|knight|sir|lady|lord|nobleman|noblewoman|squire)(?![\p{L}])/iu;
const РЕМЁСЛА = [
  ['hammer', /кузн|оружейн|smith|blacksmith|armou?rer/iu], ['shears', /портн|швея|ткач|ткачих|tailor|weaver|seamstress/iu],
  ['pretzel', /пекар|хлебопек|baker/iu], ['wheel', /мельни|колесни|miller|wheelwright/iu], ['axe', /плотни|столяр|лесоруб|carpenter|woodcutter|joiner/iu],
  ['fish', /рыбак|рыбач|fisher/iu], ['mug', /трактирщ|корчмар|хозя\p{L}* (?:трактира|таверны|корчмы|постоялого)|пивовар|innkeeper|tavern ?keeper|brewer/iu],
  ['cup', /лекар|травни|знахар|аптекар|целител|healer|herbalist|apothecar|physician/iu], ['scales', /купец|купчих|торгов|меняла|merchant|trader|moneychanger/iu],
  ['jug', /гончар|potter/iu],
];
/** 'arms' | 'craft:<знак>' | 'mark' — по роли персонажа. */
export function сословие(роль) {
  const s = String(роль || '');
  if (ЗНАТЬ.test(s)) return 'arms';
  const р = РЕМЁСЛА.find(([, re]) => re.test(s));
  return р ? 'craft:' + р[0] : 'mark';
}

// --- Случайность по роду ------------------------------------------------------
function сид(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function случайные(с) {
  let a = с;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const выбор = (r, список) => список[Math.floor(r() * список.length) % список.length];

// --- Герб -------------------------------------------------------------------------
export const ФИНИФТИ = { gules: ['червлень', '#b3262e'], azure: ['лазурь', '#2c5aa0'], vert: ['зелень', '#2f7a3e'], sable: ['чернь', '#2a2526'], purpure: ['пурпур', '#6b2f78'] };
export const МЕТАЛЛЫ = { or: ['золото', '#d4a93a'], argent: ['серебро', '#e6e4dd'] };
export const ДЕЛЕНИЯ = { plain: 'без деления', pale: 'рассечён', fess: 'пересечён', band: 'пояс', bend: 'перевязь', chevron: 'стропило', quarterly: 'начетверо', cross: 'крест' };
export const ФИГУРЫ = { star: 'звезда', moon: 'полумесяц', tower: 'башня', key: 'ключ', sword: 'меч', ear: 'колос', fish: 'рыба', rose: 'роза', crown: 'корона', horseshoe: 'подкова', lily: 'лилия', ring: 'кольцо' };
const металл = (к) => к in МЕТАЛЛЫ;
const цвет = (к) => (МЕТАЛЛЫ[к] || ФИНИФТИ[к] || ['', '#888'])[1];

/** Герб рода: { поле, второй, деление, фигура, цветФигуры }. вариант — «↻ другой». */
export function гербРода(род, вариант = 0) {
  const r = случайные(сид('arms|' + род + '|' + вариант));
  const полеМеталл = r() < 0.45;
  const поле = выбор(r, Object.keys(полеМеталл ? МЕТАЛЛЫ : ФИНИФТИ));
  // Правило финифтей: на металле — цвет, на цвете — металл.
  const второй = выбор(r, Object.keys(полеМеталл ? ФИНИФТИ : МЕТАЛЛЫ));
  const деление = выбор(r, Object.keys(ДЕЛЕНИЯ));
  const фигура = выбор(r, Object.keys(ФИГУРЫ));
  return поправитьГерб({ поле, второй, деление, фигура });
}
/** Фигура — контрастом к полю (на делении она в центре поверх обоих — с обводкой). */
export function поправитьГерб(г) {
  const поле = (г.поле in МЕТАЛЛЫ || г.поле in ФИНИФТИ) ? г.поле : 'azure';
  let второй = (г.второй in МЕТАЛЛЫ || г.второй in ФИНИФТИ) ? г.второй : (металл(поле) ? 'gules' : 'or');
  if (металл(второй) === металл(поле)) второй = металл(поле) ? 'gules' : 'or';
  const деление = г.деление in ДЕЛЕНИЯ ? г.деление : 'plain';
  const фигура = г.фигура in ФИГУРЫ ? г.фигура : 'star';
  const цветФигуры = деление === 'plain' ? второй : (металл(поле) ? второй : (второй === 'or' ? 'argent' : 'or'));
  return { поле, второй, деление, фигура, цветФигуры };
}

const ЩИТ = 'M3 3H37V19C37 31 29 39 20 43C11 39 3 31 3 19Z';
const ДЕЛЕНИЯ_SVG = {
  plain: '', pale: '<rect x="20" y="0" width="20" height="46"/>', fess: '<rect x="0" y="22" width="40" height="24"/>',
  band: '<rect x="0" y="16" width="40" height="11"/>', bend: '<polygon points="-2,6 6,-2 42,34 34,42"/>',
  chevron: '<polygon points="20,12 40,30 40,40 20,22 0,40 0,30"/>', quarterly: '<rect x="20" y="0" width="20" height="22"/><rect x="0" y="22" width="20" height="24"/>',
  cross: '<rect x="16" y="0" width="8" height="46"/><rect x="0" y="16" width="40" height="8"/>',
};
// Фигуры в клетке 24×24 (центр 12,12), заливкой.
const ФИГУРЫ_SVG = {
  star: '<path d="M12 2l2.6 6.5L21.5 9l-5.3 4.6 1.7 6.9L12 16.8 6.1 20.5l1.7-6.9L2.5 9l6.9-.5Z"/>',
  moon: '<path d="M15.5 3.5a8.5 8.5 0 1 0 0 17 7 7 0 1 1 0-17Z"/>',
  tower: '<path d="M6 21V9H5V4h2.5v2h2V4h5v2h2V4H19v5h-1v12Zm4.5 0v-4a1.5 1.5 0 0 1 3 0v4Z"/>',
  key: '<path d="M4 9.5a4.5 4.5 0 1 1 8.6 1.9L21 11.4V14h-2v2.5h-2.4V14h-4a4.5 4.5 0 0 1-8.6-4.5Zm3 0a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z"/>',
  sword: '<path d="M11 2h2v13h3.5v2H13v2.5h1.5V22h-5v-2.5H11V17H7.5v-2H11Z"/>',
  ear: '<path d="M11.2 22V11c-2.2-.4-3.7-2.3-3.7-4.6 1.6 0 3 .7 3.7 1.9V5.5C9.6 4.8 8.8 3.4 9 2c1.6.4 2.7 1.6 3 3 .3-1.4 1.4-2.6 3-3 .2 1.4-.6 2.8-2.2 3.5v2.8c.7-1.2 2.1-1.9 3.7-1.9 0 2.3-1.5 4.2-3.7 4.6V22Z"/>',
  fish: '<path d="M2 12c3-4.5 8-6 12.5-3.5L20 5v14l-5.5-3.5C10 18 5 16.5 2 12Zm6-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>',
  rose: '<path d="M12 3c1.6 0 2.6 1.4 2.6 2.6C15.8 5 17.6 5.5 18 7c.5 1.6-.4 2.8-1.4 3.4 1 .6 1.9 1.8 1.4 3.4-.4 1.5-2.2 2-3.4 1.4 0 1.2-1 2.8-2.6 2.8s-2.6-1.6-2.6-2.8C8.2 15.8 6.4 15.3 6 13.8c-.5-1.6.4-2.8 1.4-3.4C6.4 9.8 5.5 8.6 6 7c.4-1.5 2.2-2 3.4-1.4C9.4 4.4 10.4 3 12 3Zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
  crown: '<path d="M3 18 2 7l5 4 5-7 5 7 5-4-1 11Zm0 2h18v2H3Z"/>',
  horseshoe: '<path d="M5 4h3.5v8a3.5 3.5 0 0 0 7 0V4H19v8a7 7 0 0 1-14 0Z"/>',
  lily: '<path d="M12 2c2 2.2 2.6 5 1.6 8.5H17c.6-2 2.4-3 4-2.3-1.2.6-1.8 1.8-1.6 3.3H4.6c.2-1.5-.4-2.7-1.6-3.3 1.6-.7 3.4.3 4 2.3h3.4C9.4 7 10 4.2 12 2ZM4 13h16v2H4Zm6 3h4l-1 6h-2Z"/>',
  ring: '<path d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" fill-rule="evenodd"/>',
};
// Знаки ремёсел в той же клетке.
const РЕМЁСЛА_SVG = {
  hammer: '<path d="M3 5h11v5H3Zm11 1.5h4V9h-4Zm-7 4h3V21H7Z"/>',
  shears: '<path d="M7 3h2.5l3 9 3-9H18l-4 11.4a3.5 3.5 0 1 1-2.2.1L12 13.7l-.2.8a3.5 3.5 0 1 1-2.2-.1ZM8 16a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm8 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>',
  pretzel: '<path d="M12 9c1.6-3 4-5 6-4.5 2.6.6 3 4.8 1 8.5-1.5 2.8-4 4.5-7 7-3-2.5-5.5-4.2-7-7-2-3.7-1.6-7.9 1-8.5 2-.5 4.4 1.5 6 4.5Zm0 4.5c-1.5-2.2-3-4-4.4-3.8-1 .2-1 2-.1 3.6.8 1.4 2.3 2.7 4.5 4.6 2.2-1.9 3.7-3.2 4.5-4.6.9-1.6.9-3.4-.1-3.6-1.4-.2-2.9 1.6-4.4 3.8Z"/>',
  wheel: '<path d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm1 2.6v5.1l3.6-3.6A6.5 6.5 0 0 0 13 5.6Zm4.4 3.3-3.6 3.6h5.1a6.5 6.5 0 0 0-1.5-3.6ZM18.4 14h-5.1l3.6 3.6a6.5 6.5 0 0 0 1.5-3.6Zm-2.9 4.4-3.5-3.6v5.1a6.5 6.5 0 0 0 3.5-1.5ZM11 18.4v-5.1l-3.6 3.6A6.5 6.5 0 0 0 11 18.4Zm-4.4-3.3 3.6-3.6H5.1a6.5 6.5 0 0 0 1.5 3.6ZM5.6 11h5.1L7.1 7.4A6.5 6.5 0 0 0 5.6 11Zm2.9-4.4L11 9.2V5.6a6.5 6.5 0 0 0-2.5 1Z"/>',
  axe: '<path d="M10 3h2.5v18H10Zm2.5 1.5C17 4 20 6.5 20 10.5c-3 0-5.5-.5-7.5-2Z"/>',
  fish: ФИГУРЫ_SVG.fish,
  mug: '<path d="M5 6h10v14H5Zm10 3h2.5a2.5 2.5 0 0 1 0 5H15v-2h2.5a.5.5 0 0 0 0-1H15ZM6 3h8v2H6Z"/>',
  cup: '<path d="M5 4h14c0 5-3 8-6 8.6V18h3v2.5H8V18h3v-5.4C8 12 5 9 5 4Z"/>',
  scales: '<path d="M11 3h2v2.5l6 1V8h-1l2.5 6a3.5 3.5 0 0 1-7 0L16 8h-3v12h4v2H7v-2h4V8H8l2.5 6a3.5 3.5 0 0 1-7 0L6 8H5V6.5l6-1Z"/>',
  jug: '<path d="M9 3h6v2l-1 1.5c3 1 4.5 4 4.5 7.5 0 4-3 7-6.5 7S5.5 18 5.5 14c0-3.5 1.5-6.5 4.5-7.5L9 5Z"/>',
};
let номерГерба = 0;
/** SVG герба (viewBox щита 40×46). */
export function svgГерба(г, класс = 'hud-arms') {
  const id = 'hud-arms-' + (++номерГерба).toString(36);
  return `<svg class="${класс}" viewBox="0 0 40 46" aria-hidden="true"><defs><clipPath id="${id}"><path d="${ЩИТ}"/></clipPath></defs>`
    + `<g clip-path="url(#${id})"><rect width="40" height="46" fill="${цвет(г.поле)}"/><g fill="${цвет(г.второй)}">${ДЕЛЕНИЯ_SVG[г.деление] || ''}</g>`
    + `<g transform="translate(11 11.5) scale(.75)" fill="${цвет(г.цветФигуры)}" stroke="rgba(0,0,0,.45)" stroke-width="1" paint-order="stroke">${ФИГУРЫ_SVG[г.фигура] || ''}</g>`
    + `<path d="M3 3H37V12H3Z" fill="#fff" opacity=".08"/></g><path d="${ЩИТ}" fill="none" stroke="rgba(0,0,0,.55)" stroke-width="1.6"/><path d="${ЩИТ}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".6" transform="translate(.5 .5) scale(.975)"/></svg>`;
}
/** SVG знака ремесла: круг-вывеска с фигурой. */
export function svgРемесла(знак, класс = 'hud-arms is-craft') {
  return `<svg class="${класс}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17.5" fill="currentColor" opacity=".16"/><circle cx="20" cy="20" r="17.5" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".7"/>`
    + `<g transform="translate(8 8)" fill="currentColor">${РЕМЁСЛА_SVG[знак] || РЕМЁСЛА_SVG.hammer}</g></svg>`;
}
/** Домовая метка: древко и два-три штриха по роду. */
export function svgМетки(род, вариант = 0, класс = 'hud-arms is-mark') {
  const r = случайные(сид('mark|' + род + '|' + вариант));
  const штрихи = ['M12 4 20 4', 'M12 4 4 4', 'M12 9 19 14', 'M12 9 5 14', 'M12 17 18 20', 'M12 17 6 20', 'M12 4 17 9', 'M12 4 7 9', 'M6 12H18', 'M12 20 16 16', 'M12 20 8 16'];
  const n = 2 + Math.floor(r() * 2);
  const взяты = [];
  while (взяты.length < n) { const ш = выбор(r, штрихи); if (!взяты.includes(ш)) взяты.push(ш); }
  return `<svg class="${класс}" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3V21"/><path d="${взяты.join(' ')}"/></g></svg>`;
}

// --- Выбор игрока в данных чата ------------------------------------------------------
function контекст() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; } }
function хранилище() {
  // Пример в «Кастомизации» (sample-meta.js): своё «уже сгенерированное», без сохранения.
  const ctx = контекст();
  const мета = примерМета() || (ctx && (ctx.chatMetadata || ctx.chat_metadata));
  if (!мета) return null;
  return (мета[КЛЮЧ] && typeof мета[КЛЮЧ] === 'object') ? мета[КЛЮЧ] : (мета[КЛЮЧ] = {});
}
let таймер = 0;
function сохранить() { if (примерМета()) return;
  clearTimeout(таймер); таймер = setTimeout(() => { const ctx = контекст(); try { (ctx?.saveMetadataDebounced || ctx?.saveMetadata)?.call(ctx); } catch (_) { /* не критично */ } }, 300); }
export function выборРода(род) { const з = хранилище()?.[род]; return з && typeof з === 'object' ? { ...з } : null; }
export function сохранитьВыборРода(род, з) { const х = хранилище(); if (!х || !род) return false; if (з) х[род] = з; else delete х[род]; сохранить(); return true; }

/** Знак рода для шапки карточки: кнопка с гербом, знаком ремесла или меткой. */
export function знакРода(имя, роль = '') {
  if (!гербыВкл()) return '';
  const род = родИмени(имя);
  if (!род) return '';
  const выбор_ = выборРода(род) || {};
  const вид = выбор_.вид || сословие(роль);
  let svg = '', подпись = '';
  if (вид === 'arms') {
    const г = выбор_.герб ? поправитьГерб(выбор_.герб) : гербРода(род, выбор_.вариант || 0);
    svg = svgГерба(г); подпись = `Герб: ${ФИНИФТИ[г.поле]?.[0] || МЕТАЛЛЫ[г.поле]?.[0]}, ${ДЕЛЕНИЯ[г.деление]}, ${ФИГУРЫ[г.фигура]}`;
  } else if (вид.startsWith('craft:')) { svg = svgРемесла(вид.slice(6)); подпись = 'Знак ремесла'; }
  else { svg = svgМетки(род, выбор_.вариант || 0); подпись = 'Домовая метка'; }
  return `<button type="button" class="hud-arms-btn" data-hud-arms="${escapeHtml(род)}" data-role="${escapeHtml(String(роль || '').slice(0, 120))}" title="${escapeHtml(подпись)}" aria-label="${escapeHtml(подпись)}">${svg}</button>`;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !globalThis.__hudArmsBound) {
  globalThis.__hudArmsBound = true;
  document.addEventListener('click', (e) => {
    const кнопка = e.target && e.target.closest ? e.target.closest('[data-hud-arms]') : null;
    if (!кнопка) return;
    e.preventDefault(); e.stopPropagation();
    if (кнопка.closest('.hud-custom-preview-body')) return;
    import('./heraldry-edit.js?v=23.89.78').then(м => м.открытьГерб(кнопка.dataset.hudArms, кнопка.dataset.role || ''))
      .catch(err => console.error('[TavernOS HUD] окно герба не загрузилось:', err));
  }, true);
}
