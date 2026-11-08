// hud-manager/render/phone-icons.js
//
// Значки приложений телефона: наборы по темам (Кастомизация → Блоки: Телефон).
// «Авто» — набор текущей темы, «Обычные» — прежние значки, либо любой набор.
//
// Рисунки живут в render/phone-icons/<тема>.js, их собирает стенд
// (tests/tools/phone-icons-stand/build.mjs). Набор — десятки килобайт,
// поэтому грузится по требованию: пока он едет, телефон показывает обычные
// значки, а потом подменяем их на месте.
//
// Цвета. Значки считаются от темы, а не красятся поверх: каждый цвет набора —
// градиенты, обводка, акценты, вставки, стёкла — пересчитывается так, чтобы
// главный цвет набора стал точно акцентом темы или её палитры, а плитка взяла
// фон. Кожа на портретах остаётся живой. Только свой набор в своей теме с
// родными цветами показывается как нарисован.

import { settings } from '../settings.js?v=23.88.100';
import { видБлока } from './views.js?v=23.88.100';
import { getTheme } from '../themes.js?v=23.88.100';

const ВЕРСИЯ = (() => { try { return new URL(import.meta.url).search; } catch (_) { return ''; } })();
const НАБОРЫ = ['kawaii', 'academia', 'vamp', 'cyberpunk', 'noir', 'medieval', 'fantasy', 'mafia', 'web1', 'cottage', 'ice', 'ocean', 'steampunk', 'dieselpunk', 'solarpunk', 'biopunk', 'spaceopera', 'japan', 'egypt', 'western', 'pirate', 'witch', 'voodoo', 'spacehorror', 'darkroom', 'teaparty', 'bujo'];

// Кожа на портретах контактов: её оттенок от темы не зависит.
const КОЖА = new Set(['#f0c090', '#f8e9e8', '#f4e4e4', '#c79aa8', '#e8bc96', '#e3b48e', '#a8724a', '#f0c8a4', '#d39a66', '#c98d5a', '#8f5a32', '#f4dcc6', '#f0d8c0', '#b98f72', '#fcf7f1', '#fbf5ee', '#d9cabd', '#fae4d6', '#f7dccd', '#c99a88', '#b97a4e', '#a86a42', '#6e4228']);

const загружено = new Map();   // имя → набор как нарисован
const раскрашено = new Map();  // имя → { ключ, иконки, наТеме }
const едет = new Map();        // имя → Promise
let общееГотово = null;
let стилиОбщие = '';

/** Какой набор сейчас нужен: имя или '' — обычные значки. */
export function наборТелефона() {
  const вид = видБлока('phoneIconsView');
  if (вид === 'plain') return '';
  const имя = вид === 'auto' ? settings.themePreset : вид;
  return НАБОРЫ.includes(имя) ? имя : '';
}

function общее() {
  if (!общееГотово) общееГотово = import(new URL('./phone-icons/_style.js' + ВЕРСИЯ, import.meta.url).href).then(м => {
    стилиОбщие = м.СТИЛЬ;
    const стиль = document.createElement('style');
    стиль.id = 'hud-pi-style';
    стиль.textContent = м.СТИЛЬ;
    document.head.append(стиль);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'hud-pi-defs';
    svg.setAttribute('aria-hidden', 'true');
    // Не display: none: фильтры и вырезки оттуда иначе перестают работать.
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    svg.innerHTML = `<defs>${м.ФИЛЬТРЫ}</defs>`;
    document.body.append(svg);
    return svg;
  });
  return общееГотово;
}

function загрузить(имя) {
  if (едет.has(имя)) return едет.get(имя);
  const п = Promise.all([общее(), import(new URL(`./phone-icons/${имя}.js` + ВЕРСИЯ, import.meta.url).href)]).then(([, м]) => {
    загружено.set(имя, м.default);
    обновитьЗначки();
  }).catch(e => { едет.delete(имя); console.warn('[TavernOS HUD] значки телефона:', e); });
  едет.set(имя, п);
  return п;
}

// --- Цвет -----------------------------------------------------------------------
const ГЕКС = /^#[0-9a-f]{6}$/i;
function вHSL(hex) {
  if (!ГЕКС.test(String(hex || '').trim())) return null;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(String(hex).trim().slice(i, i + 2), 16) / 255);
  const мак = Math.max(r, g, b), мин = Math.min(r, g, b), д = мак - мин, l = (мак + мин) / 2;
  if (!д) return { h: 0, s: 0, l };
  const h = мак === r ? ((g - b) / д) % 6 : мак === g ? (b - r) / д + 2 : (r - g) / д + 4;
  return { h: (h * 60 + 360) % 360, s: д / (1 - Math.abs(2 * l - 1)), l };
}
function изHSL(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map(v => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
const между = (v, a, b) => Math.max(a, Math.min(b, v));
const вRGB = (hex) => [1, 3, 5].map(i => parseInt(String(hex).slice(i, i + 2), 16));
const БЛИЗОСТЬ = .15;   // какая доля разницы оттенков остаётся от родной
const смесь = (a, b, t) => '#' + вRGB(a).map((v, i) => Math.round(v + (вRGB(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

/**
 * Перевод цвета: родной цвет набора становится точно цветом цели, остальные
 * подтягиваются к нему: чужие оттенки остаются соседями цели, а не уезжают на
 * другой край круга (фиолетовая арфа в оранжевой теме). Серая цель — всё серое;
 * серый набор — окрашивается в цель, белое остаётся белым.
 */
export function переводЦвета(родной, цель) {
  const р = вHSL(родной), ц = вHSL(цель);
  if (!р || !ц) return (hex) => hex;
  const середина = (l) => 4 * l * (1 - l);
  return (hex) => {
    const x = вHSL(hex);
    if (!x) return hex;
    if (ц.s < .1) return изHSL(x.h, 0, x.l);
    if (р.s < .1) return изHSL(ц.h, between(ц.s * .85 * середина(x.l)), x.l);
    if (x.s < .04) return hex;   // чёрное, белое и серое держат контраст
    const доля = середина(р.l) > .05 ? середина(x.l) / середина(р.l) : 1;
    const разница = ((x.h - р.h + 540) % 360) - 180;
    return изHSL((ц.h + разница * БЛИЗОСТЬ + 360) % 360, between(Math.min(x.s * ц.s / Math.max(р.s, .05), ц.s + .12)), between(x.l + (ц.l - р.l) * доля));
  };
}
function between(v) { return между(v, 0, 1); }

const яркость = (hex) => { const [r, g, b] = вRGB(hex).map(v => { const c = v / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const контраст = (a, b) => { const [x, y] = [яркость(a), яркость(b)].sort((m, n) => n - m); return (x + .05) / (y + .05); };

/** Цвет плитки: фон темы, чуть отступивший от него, чтобы плитка читалась. */
export function плиткаНабора(акцент, фон1, фон2) {
  const ок = (c) => ГЕКС.test(String(c || ''));
  const а = ок(акцент) ? акцент : '#808080', ф1 = ок(фон1) ? фон1 : '#101014', ф2 = ок(фон2) ? фон2 : ф1;
  const ф = вHSL(смесь(ф1, ф2, .5));
  return смесь(изHSL(ф.h, ф.s, between(ф.l + (ф.l > .55 ? -.05 : .07))), а, .05);
}

/** Акцент, различимый на плитке: тот же оттенок, светлота уходит от плитки. */
function цветНаПлитке(акцент, плитка) {
  const ц = вHSL(акцент);
  if (!ц) return акцент;
  const шаг = вHSL(плитка).l > .5 ? -.03 : .03;
  let итог = акцент;
  for (let l = ц.l; контраст(итог, плитка) < 3 && l > .05 && l < .95; l += шаг) итог = изHSL(ц.h, ц.s, l);
  return итог;
}

/**
 * Рисунок нарисован под свою светлоту: тёмная плитка с белыми линиями или
 * светлая с тёмными. Плитка теперь всегда цвета темы, так что на чужой светлоте
 * часть, слившаяся с плиткой, отражается на другую сторону.
 */
function отражение(светлаяПлитка) {
  const край = светлаяПлитка ? .6 : .45;
  return (hex) => {
    const x = вHSL(hex);
    if (!x) return hex;
    if (светлаяПлитка ? x.l <= край : x.l >= край) return hex;
    return изHSL(x.h, x.s, between(край * 2 - x.l));
  };
}

/**
 * Набор в цветах темы: { defs, стиль, иконки, наТеме }. цвета — { акцент, фон1,
 * фон2 }; своя — это тема набора; родные — цвета совпали с темой как она есть.
 */
export function раскрасить(имя, набор, цвета, { своя = false, родные = false, стили = '' } = {}) {
  const правила = стили.split(/\r?\n/).filter(п => п.includes('.th-' + имя) && /#[0-9a-f]{6}/i.test(п)).join('');
  if (своя && родные) return { defs: набор.defs, стиль: `.hud-pi.th-${имя}{${набор.vars}}`, иконки: набор.иконки, наТеме: false, светлая: !!набор.свет };
  const плитка = плиткаНабора(цвета.акцент, цвета.фон1, цвета.фон2);
  const светлаяПлитка = вHSL(плитка).l > .5;
  const акцент = цветНаПлитке(цвета.акцент, плитка);
  const перевод = переводЦвета(своя ? набор.опора : набор.главный, акцент);
  const зеркало = светлаяПлитка === !!набор.свет ? (c) => c : отражение(светлаяПлитка);
  const память = new Map();
  const цвет = (hex) => {
    const k = hex.toLowerCase();
    if (КОЖА.has(k)) return hex;
    if (!память.has(k)) память.set(k, зеркало(перевод(k)));
    return память.get(k);
  };
  const краска = (т) => т.replace(/#[0-9a-f]{6}\b/gi, цвет);
  const иконки = {};
  for (const [id, тело] of Object.entries(набор.иконки)) иконки[id] = краска(тело);
  const с = `.hud-pi.th-${имя}.on-theme`;
  return {
    defs: краска(набор.defs),
    стиль: `.hud-pi.th-${имя}{${краска(набор.vars)}}` + краска(правила)
      + `${с}{--edge:${смесь(акцент, плитка, .35)}}${с} .tile{fill:${плитка}!important}${с} .tile-glow{display:inline!important;fill:${акцент}!important;opacity:.07}${с} .tile-rim{stroke:${акцент}!important;stroke-opacity:.55}`,
    иконки,
    наТеме: true,
    светлая: светлаяПлитка,
  };
}

function цветаТемы() {
  return settings.phoneThemeAuto !== false
    ? { акцент: settings.accentColor, фон1: settings.cardBgStart, фон2: settings.cardBgEnd }
    : { акцент: settings.phoneAccent, фон1: settings.phoneBgStart, фон2: settings.phoneBgEnd };
}
const то = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

function подготовить(имя) {
  const набор = загружено.get(имя);
  const ц = цветаТемы();
  const своя = имя === settings.themePreset;
  const ключ = [ц.акцент, ц.фон1, ц.фон2, своя].join('|');
  const было = раскрашено.get(имя);
  if (было && было.ключ === ключ) return было;
  const в = (getTheme(имя) || {}).vars || {};
  const родные = своя && то(ц.акцент, settings.phoneThemeAuto !== false ? в.accentColor : в.phoneAccent)
    && то(ц.фон1, settings.phoneThemeAuto !== false ? в.cardBgStart : в.phoneBgStart);
  const итог = { ключ, ...раскрасить(имя, набор, ц, { своя, родные, стили: стилиОбщие }) };
  раскрашено.set(имя, итог);
  const корень = document.getElementById('hud-pi-defs');
  let defs = корень && корень.querySelector(`defs[data-set="${имя}"]`);
  if (корень && !defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); defs.dataset.set = имя; корень.append(defs); }
  if (defs) defs.innerHTML = итог.defs;
  let стиль = document.querySelector(`style[data-hud-pi="${имя}"]`);
  if (!стиль) { стиль = document.createElement('style'); стиль.dataset.hudPi = имя; document.head.append(стиль); }
  стиль.textContent = итог.стиль;
  return итог;
}

function разметка(имя, id) {
  const н = загружено.get(имя);
  if (!н) return '';
  const р = подготовить(имя);
  const тело = р.иконки[id];
  if (!тело) return '';
  return `<svg class="hud-pi fam-${н.сем} th-${имя}${р.светлая ? ' is-light' : ''}${р.наТеме ? ' on-theme' : ''} i-${id}" viewBox="0 0 120 120" aria-hidden="true">${тело}</svg>`;
}

/** Значок приложения. плоский — обычный значок: он же, пока набор не приехал. */
export function значокПриложения(id, плоский) {
  const имя = наборТелефона();
  if (!имя) return плоский;
  if (!загружено.has(имя)) { загрузить(имя); return плоский; }
  return разметка(имя, id) || плоский;
}
export const естьНабор = () => { const имя = наборТелефона(); return !!имя && загружено.has(имя); };

/** Поменялась тема или набор: значки на экране — на нужные, без пересборки карточек. */
export function обновитьЗначки() {
  const имя = наборТелефона();
  if (имя && !загружено.has(имя)) { загрузить(имя); return; }
  for (const кнопка of document.querySelectorAll('.hud-phone-app[data-phone-app]')) {
    const место = кнопка.querySelector(':scope > span');
    if (!место) continue;
    const новый = имя ? разметка(имя, кнопка.dataset.phoneApp) : '';
    const был = место.querySelector(':scope > svg.hud-pi');
    if (!новый) {
      // Обычный значок лежит рядом и только прячется, см. phone.js.
      if (был) был.remove();
      место.classList.remove('has-pi');
      continue;
    }
    if (был) был.outerHTML = новый; else место.insertAdjacentHTML('afterbegin', новый);
    место.classList.add('has-pi');
  }
}
