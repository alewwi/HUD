// hud-manager/render/topbar-icons.js
//
// Значки свёрнутой карточки: время, погода, дата и кнопки шапки (спросить,
// перегенерировать, раскрыть, создать HUD). Контурные SVG одним языком с
// остальными блоками (views.css): толщина линии та же, цвет — currentColor,
// то есть акцент темы или цвет кнопки. Значки говорят по делу: стрелки часов
// стоят на времени сцены, погода — та, что в сцене, с солнцем или луной по
// времени суток.
//
// Настройка iconSet: 'emoji' — эмодзи везде; 'header' — рисунки в шапке
// свёрнутой карточки; 'svg' — рисунки везде. Рисунок (линия, тушь, пиксель,
// округлый) — по теме, тем же классом на <html>, что у остальных значков
// (render/hud-icons.js, css/platform.css).

import { settings } from '../settings.js?v=23.88.2';

export const значкиШапки = (s = settings) => s.iconSet !== 'emoji';

const svg = (тело, класс = '') => `<svg class="hud-ico hud-tb-ico${класс ? ' ' + класс : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${тело}</svg>`;
const ч = (n) => +n.toFixed(2);

/** Часы со стрелками на времени «чч:мм» (без времени — на 10:10). */
export function значокЧасов(время) {
  const m = String(время || '').match(/(\d{1,2})[:.](\d{2})/);
  const h = m ? +m[1] % 12 : 10, мин = m ? +m[2] : 10;
  const стрелка = (угол, длина) => { const р = (угол - 90) * Math.PI / 180; return `<path d="M12 12L${ч(12 + длина * Math.cos(р))} ${ч(12 + длина * Math.sin(р))}"/>`; };
  return svg(`<circle cx="12" cy="12" r="9"/>${стрелка((h + мин / 60) * 30, 4.6)}${стрелка(мин * 6, 6.6)}`, 'is-clock');
}

// Части погоды. Облако — общее, у осадков оно приподнято.
const ОБЛАКО = 'M7 17.5h10a3.8 3.8 0 0 0 .5-7.57A5.3 5.3 0 0 0 7.3 9.2 4.15 4.15 0 0 0 7 17.5Z';
const ОБЛАКО_ВЫШЕ = 'M7 14h10a3.8 3.8 0 0 0 .5-7.57A5.3 5.3 0 0 0 7.3 5.7 4.15 4.15 0 0 0 7 14Z';
const СОЛНЦЕ = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
const ЛУНА = '<path d="M19.5 14.6A7.8 7.8 0 1 1 9.4 4.5a6.2 6.2 0 0 0 10.1 10.1Z"/>';
// Солнце или луна за облаком: маленькое светило в углу.
const СОЛНЦЕ_ЗА = '<path d="M8.5 3v1.2M3.4 8.2h1.2M4.9 4.6l.9.9M12.1 4.6l-.9.9"/><path d="M5.8 10.6a3.2 3.2 0 1 1 5.6-2.9"/>';
const ЛУНА_ЗА = '<path d="M11.4 6.2A4.2 4.2 0 1 1 5.3 11a3.4 3.4 0 0 0 6.1-4.8Z"/>';

/**
 * Погода по классу карточки (weather-clear, -cloudy, -rain, -snow, -storm,
 * -hail, -wind, -fog, -dusty) и времени суток (phase-night — луна).
 */
export function значокПогоды(вид = 'weather-clear', фаза = 'phase-day') {
  const ночь = фаза === 'phase-night';
  const к = String(вид || '').replace(/^weather-/, '');
  if (к === 'cloudy') return svg(`${ночь ? ЛУНА_ЗА : СОЛНЦЕ_ЗА}<path d="${ОБЛАКО}" transform="translate(2 1.5) scale(.92)"/>`, 'is-weather');
  if (к === 'rain') return svg(`<path d="${ОБЛАКО_ВЫШЕ}"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>`, 'is-weather');
  if (к === 'snow') return svg(`<path d="${ОБЛАКО_ВЫШЕ}"/><path d="M8 18.5h.01M12 17.5h.01M16 18.5h.01M10 21h.01M14 21h.01" stroke-width="2.4"/>`, 'is-weather');
  if (к === 'storm') return svg(`<path d="${ОБЛАКО_ВЫШЕ}"/><path d="M12.5 14.5 10.3 18h3l-1.8 3.5"/>`, 'is-weather');
  if (к === 'hail') return svg(`<path d="${ОБЛАКО_ВЫШЕ}"/><circle cx="8.5" cy="18.5" r=".9"/><circle cx="12.5" cy="20" r=".9"/><circle cx="16.3" cy="18.5" r=".9"/>`, 'is-weather');
  if (к === 'wind' || к === 'dusty') return svg('<path d="M3 9h11a2.6 2.6 0 1 0-2.6-2.6M3 13h15a2.8 2.8 0 1 1-2.8 2.8M3 17h7"/>', 'is-weather');
  if (к === 'fog') return svg(`<path d="${ОБЛАКО_ВЫШЕ}"/><path d="M4 17.5h16M6 20.5h12"/>`, 'is-weather');
  return svg(ночь ? ЛУНА : СОЛНЦЕ, 'is-weather');
}

/**
 * Листок календаря с отмеченным днём. Число дня в значке размером со строку
 * не читается (пятнышко) — а дата и так написана рядом.
 */
export function значокДаты() {
  return svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><rect x="13" y="13" width="4" height="4" rx=".8" fill="currentColor" stroke="none"/>', 'is-date');
}

export const ЗНАЧОК_СПРОСИТЬ = svg('<path d="M4.5 18.5V7a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3H8.3Z"/><path d="M10.3 8.6a1.9 1.9 0 1 1 2.6 1.75c-.55.22-.9.7-.9 1.3v.25M12 14.3h.01"/>', 'is-ask');
export const ЗНАЧОК_ОБНОВИТЬ = svg('<path d="M19.5 12a7.5 7.5 0 0 1-13 5.1M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.8 3.6v3.6h-3.6M6.2 20.4v-3.6h3.6"/>', 'is-regen');
export const ЗНАЧОК_РАСКРЫТЬ = svg('<path d="m6 9.5 6 6 6-6"/>', 'is-chevron');
export const ЗНАЧОК_СОЗДАТЬ = svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', 'is-create');

/** Метка шапки: значок или эмодзи — по настройке. */
export function меткаШапки(что, данные = {}) {
  const значки = значкиШапки();
  switch (что) {
    case 'время': return значки ? значокЧасов(данные.время) : '🕒';
    case 'погода': return значки ? значокПогоды(данные.вид, данные.фаза) : '🌤️';
    case 'дата': return значки ? значокДаты(данные.дата) : '📅';
    case 'спросить': return значки ? ЗНАЧОК_СПРОСИТЬ : '❓';
    case 'обновить': return значки ? ЗНАЧОК_ОБНОВИТЬ : '🔄';
    case 'раскрыть': return значки ? ЗНАЧОК_РАСКРЫТЬ : '▼';
    case 'создать': return значки ? ЗНАЧОК_СОЗДАТЬ : '➕';
    default: return '';
  }
}
