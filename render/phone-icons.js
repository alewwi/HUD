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
// Цвета. Чужой набор подстраивается под тему: оттенок рисунка сдвигаем от
// родного акцента набора к акценту темы — зелёный Биопанк в Vamp становится
// красным, — а плитка берёт цвета фона темы. Свой набор в своей теме не
// трогается вовсе.

import { settings } from '../settings.js?v=23.88.58';
import { видБлока } from './views.js?v=23.88.58';
import { getTheme } from '../themes.js?v=23.88.58';

const ВЕРСИЯ = (() => { try { return new URL(import.meta.url).search; } catch (_) { return ''; } })();
const НАБОРЫ = ['kawaii', 'academia', 'vamp', 'cyberpunk', 'noir', 'medieval', 'fantasy', 'mafia', 'web1', 'cottage', 'ice', 'ocean', 'steampunk', 'dieselpunk', 'solarpunk', 'biopunk', 'spaceopera', 'japan', 'egypt', 'western', 'pirate', 'witch', 'voodoo', 'spacehorror', 'darkroom', 'teaparty', 'bujo'];

// Основной цвет набора, если он не совпадает с акцентом темы: у Средневековья
// акцент золотой, а плитка синяя, и чужая тема красила её случайно.
const ОПОРА = { medieval: '#2f5fa8' };

const загружено = new Map();   // имя → набор
const едет = new Map();        // имя → Promise
let общееГотово = null;

/** Какой набор сейчас нужен: имя или '' — обычные значки. */
export function наборТелефона() {
  const вид = видБлока('phoneIconsView');
  if (вид === 'plain') return '';
  const имя = вид === 'auto' ? settings.themePreset : вид;
  return НАБОРЫ.includes(имя) ? имя : '';
}

function общее() {
  if (!общееГотово) общееГотово = import(new URL('./phone-icons/_style.js' + ВЕРСИЯ, import.meta.url).href).then(м => {
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
  const п = Promise.all([общее(), import(new URL(`./phone-icons/${имя}.js` + ВЕРСИЯ, import.meta.url).href)]).then(([svg, м]) => {
    const набор = м.default;
    svg.querySelector('defs').insertAdjacentHTML('beforeend', набор.defs);
    const стиль = document.createElement('style');
    стиль.dataset.hudPi = имя;
    стиль.textContent = `.hud-pi.th-${имя}{${набор.vars}}`;
    document.head.append(стиль);
    загружено.set(имя, набор);
    обновитьЗначки();
  }).catch(e => { едет.delete(имя); console.warn('[TavernOS HUD] значки телефона:', e); });
  едет.set(имя, п);
  return п;
}

function вHSL(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const мак = Math.max(r, g, b), мин = Math.min(r, g, b), д = мак - мин, l = (мак + мин) / 2;
  if (!д) return { h: 0, s: 0, l };
  const h = мак === r ? ((g - b) / д) % 6 : мак === g ? (b - r) / д + 2 : (r - g) / д + 4;
  return { h: (h * 60 + 360) % 360, s: д / (1 - Math.abs(2 * l - 1)), l };
}

/** Сдвиг цвета набора к акценту темы: значение CSS-фильтра или ''. */
export function оттенокНабора(имя, акцент, родной) {
  const тема = вHSL(акцент), набор = вHSL(родной);
  if (!тема || !набор) return '';
  const серая = тема.s < .12, сераяРодная = набор.s < .12;
  if (серая && сераяРодная) return '';
  if (серая) return 'grayscale(1)';
  // Сепия даёт бесцветному рисунку цвет с оттенком около 38°: от него и крутим.
  if (сераяРодная) return `sepia(.85) saturate(2.4) hue-rotate(${Math.round(тема.h - 38)}deg)`;
  const сдвиг = Math.round(((тема.h - набор.h + 540) % 360) - 180);
  // Выше 1.2 чужой набор в яркой теме становится кислотным.
  const сочность = Math.max(.5, Math.min(1.2, тема.s / Math.max(набор.s, .01)));
  if (Math.abs(сдвиг) < 4 && Math.abs(сочность - 1) < .12) return '';
  return `hue-rotate(${сдвиг}deg) saturate(${сочность.toFixed(2)})`;
}

const вRGB = (hex) => [0, 2, 4].map(i => parseInt(String(hex).replace('#', '').slice(i, i + 2), 16));
const смесь = (a, b, t) => '#' + вRGB(a).map((v, i) => Math.round(v + (вRGB(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
/**
 * Цвет плитки чужого набора. Обычно это фон темы с каплей акцента. Но рисунок
 * рассчитан на свою светлоту: белые линии Нуара пропали бы на светлой плитке
 * Каваи. Тогда плитка — акцент темы, тёмный или светлый под рисунок.
 */
export function плиткаНабора(светлый, акцент, фон1, фон2) {
  const ок = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
  const а = ок(акцент) ? акцент : '#808080', ф1 = ок(фон1) ? фон1 : '#101014', ф2 = ок(фон2) ? фон2 : ф1;
  const фон = смесь(ф1, ф2, .5), темаСветлая = вHSL(фон).l > .55;
  if (светлый === темаСветлая) return смесь(фон, а, .14);
  return светлый ? смесь(а, '#ffffff', .8) : смесь(а, '#000000', .62);
}

function акцентТемы() {
  return settings.phoneThemeAuto !== false ? settings.accentColor : settings.phoneAccent;
}
function фонТемы() {
  return settings.phoneThemeAuto !== false ? [settings.cardBgStart, settings.cardBgEnd] : [settings.phoneBgStart, settings.phoneBgEnd];
}
// Набор чужой: не своей темы либо своя тема с другими цветами.
const чужой = (имя) => имя !== settings.themePreset || !!оттенокНабора(имя, акцентТемы(), родной(имя));
function родной(имя) {
  if (ОПОРА[имя] && имя !== settings.themePreset) return ОПОРА[имя];
  const з = (getTheme(имя) || {}).vars || {};
  return settings.phoneThemeAuto !== false ? з.accentColor : (з.phoneAccent || з.accentColor);
}

function разметка(имя, id) {
  const н = загружено.get(имя);
  const тело = н && н.иконки[id];
  if (!тело) return '';
  return `<svg class="hud-pi fam-${н.сем} th-${имя}${н.свет ? ' is-light' : ''}${чужой(имя) ? ' on-theme' : ''} i-${id}" viewBox="0 0 120 120" aria-hidden="true">${тело}</svg>`;
}

// Цвета чужого набора — одним стилем на всё: значки в чате и в просмотре
// Кастомизации. Не на <html>: запись стиля туда в Таверне дорогая.
let цветаСейчас = null;
function поставитьОттенок(имя) {
  const н = имя && загружено.get(имя);
  const фильтр = имя ? оттенокНабора(имя, акцентТемы(), родной(имя)) : '';
  const а = акцентТемы();
  const плитка = н ? плиткаНабора(!!н.свет, а, ...фонТемы()) : '';
  const текст = (фильтр ? `.hud-pi .pi-body{filter:${фильтр}}` : '')
    + (плитка ? `.hud-pi.on-theme .tile{fill:${плитка}!important}.hud-pi.on-theme .tile-glow{display:inline!important;fill:${а}!important;opacity:.14}.hud-pi.on-theme .tile-rim{stroke:${а}!important;stroke-opacity:.45}` : '');
  if (текст === цветаСейчас) return;
  цветаСейчас = текст;
  let стиль = document.getElementById('hud-pi-colors');
  if (!стиль) { стиль = document.createElement('style'); стиль.id = 'hud-pi-colors'; document.head.append(стиль); }
  стиль.textContent = текст;
}

/** Значок приложения. плоский — обычный значок: он же, пока набор не приехал. */
export function значокПриложения(id, плоский) {
  const имя = наборТелефона();
  if (!имя) { поставитьОттенок(''); return плоский; }
  поставитьОттенок(имя);
  if (!загружено.has(имя)) { загрузить(имя); return плоский; }
  return разметка(имя, id) || плоский;
}
export const естьНабор = () => { const имя = наборТелефона(); return !!имя && загружено.has(имя); };

/** Поменялась тема или набор: значки на экране — на нужные, без пересборки карточек. */
export function обновитьЗначки() {
  const имя = наборТелефона();
  поставитьОттенок(имя);
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
