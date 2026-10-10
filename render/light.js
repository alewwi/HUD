// hud-manager/render/light.js
//
// Свет сцены по игровому времени — чистая функция. Раньше эта математика
// жила посреди renderHUD (index.js) и писала переменные только на виджет
// сцены. Вынесена, чтобы тот же свет отдать карточке целиком: тень, блик,
// холод ночи (настройка lightFollowsTime). Значения для сцены — те же, что
// были, до третьего знака: tests/wave3.mjs сверяет со старой формулой на
// всех 1440 минутах суток и нескольких границах дня.
//
// У каждой карточки свой момент — время её хода, а не «сейчас». Свет не
// двигается анимацией: он посчитан один раз при сборке карточки.

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smoothStep = (value, edge0, edge1) => {
  if (value <= edge0) return 0;
  if (value >= edge1) return 1;
  return (value - edge0) / (edge1 - edge0);
};

/**
 * @param {{минуты:number, началоДня:number, конецДня:number}} п
 *   минуты — от полуночи; началоДня/конецДня — восход и закат месяца в минутах.
 * @returns {{p, cx, cxm, cy, alt, ночь, золото, закат, звёзды, dx, dy, тёплота}}
 *   p — доля дня (или ночи) 0…1; cx/cy — положение светила в % сцены;
 *   cxm — на телефоне; alt — высота солнца 0…1; ночь/золото/закат/звёзды —
 *   силы 0…1; dx — куда падает тень (−1 влево … 1 вправо), dy — длина тени
 *   вниз (низкое светило — длиннее), тёплота — золотой час и закат.
 */
export function вычислитьСвет({ минуты, началоДня = 360, конецДня = 1200 }) {
  const DAY_START = началоДня, DAY_END = конецДня, minutesOfDay = минуты;
  let p;
  if (minutesOfDay >= DAY_START && minutesOfDay <= DAY_END) p = (minutesOfDay - DAY_START) / (DAY_END - DAY_START);
  else p = (minutesOfDay > DAY_END ? (minutesOfDay - DAY_END) : (minutesOfDay + (1440 - DAY_END))) / (1440 - (DAY_END - DAY_START));
  const cx = 6 + p * 84, cy = 76 - Math.sin(p * Math.PI) * 60;
  const cxm = cx < 50 ? 8 + (cx - 6) / 44 * 8 : 84 + (cx - 50) / 40 * 8;
  const alt = Math.max(0, Math.sin(p * Math.PI));
  const ночь = clamp(1 - smoothStep(minutesOfDay, DAY_START - 60, DAY_START + 120) + smoothStep(minutesOfDay, DAY_END - 30, DAY_END + 120), 0, 1);
  const золото = clamp(1 - Math.abs(minutesOfDay - (DAY_END - 180)) / 90, 0, 1);
  const закат = clamp(1 - Math.abs(minutesOfDay - (DAY_END - 120)) / 90, 0, 1);
  const звёзды = clamp(1 - smoothStep(minutesOfDay, DAY_START - 30, DAY_START + 360) + smoothStep(minutesOfDay, DAY_END, DAY_END + 240), 0, 1);
  // Тень — от светила: оно слева (утро) — тень вправо. Ночью светит луна по
  // той же дуге, тень та же по направлению, но слабее (это делает CSS).
  const dx = clamp((50 - cx) / 44, -1, 1);
  const dy = 0.4 + (1 - alt) * 0.6;
  const тёплота = Math.max(золото, закат);
  return { p, cx, cxm, cy, alt, ночь, золото, закат, звёзды, dx, dy, тёплота };
}

/** Минуты от полуночи из «22:40», «7:05 | утро» и т. п.; null — времени нет. */
export function минутыИзВремени(т) {
  const м = String(т || '').match(/(\d{1,2}):(\d{2})/);
  if (!м) return null;
  const ч = parseInt(м[1], 10), мин = parseInt(м[2], 10);
  return ч > 23 || мин > 59 ? null : ч * 60 + мин;
}

/** Нейтральный свет — когда времени у карточки нет: вид как прежде. */
export const НЕЙТРАЛЬНЫЙ = Object.freeze({ dx: 0, dy: 1, тёплота: 0, ночь: 0 });

/**
 * Переменные карточки для настройки lightFollowsTime. 'subtle' — 30% силы.
 * Возвращает строку для style="" или ''.
 */
export function переменныеСвета(свет, режим) {
  if (!свет || (режим !== 'subtle' && режим !== 'full')) return '';
  const k = режим === 'subtle' ? 0.3 : 1;
  const f = (v) => (Math.round(v * 1000) / 1000).toString();
  return `--light-dx:${f(свет.dx * k)};--light-dy:${f(свет.dy)};--light-warm:${f(свет.тёплота * k)};--light-night:${f(свет.ночь * k)};`;
}
