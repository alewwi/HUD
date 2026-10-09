// hud-manager/render/underwear.js
//
// Бельё как слой: что на персонаже под одеждой и — главное, чего в тексте
// одежды нет, — кто выбирал и для кого. Разница между «надела не думая» и
// «выбрала под него» и есть смысл этого поля. Код Un, необязательный, только
// в близости и только при включённой настройке (enableUnderwear):
// 'set: комплект и цвет; for: для кого или «не думая»; st: на месте |
// сдвинуто | снято | потеряно'.
//
// Два вида (underwearView): 'set' — карточка комплекта, силуэты верха и низа
// цветом из текста и бейдж «для кого»; 'layer' — полоса слоёв кожа · бельё ·
// одежда, где бельё гаснет по мере раздевания. Поле описывает человека в
// уязвимом положении, поэтому по умолчанию оно под покрывалом
// (underwearVeil): открывается нажатием.

import { escapeHtml, applyTooltips, flattenFieldValue, снятьЗаглушки } from '../utils.js?v=23.46.0';
import { settings } from '../settings.js?v=23.46.0';
import { ико } from './view-icons.js?v=23.46.0';

const текст = (v) => String(снятьЗаглушки(flattenFieldValue(v)) || '').trim();
const пусто = (s) => !s || /^(empty|none|нет|—|-)$/i.test(s.trim());

const ЦВЕТА = [
  [/черн/i, '#1d1a1f'], [/бел|молочн|айвори/i, '#f2eee8'], [/алы|красн|кармин/i, '#c0283a'], [/бордо|винн|марсал/i, '#6e1a2b'],
  [/розов|пудр/i, '#e7a3b8'], [/нюд|телесн|бежев|кремов/i, '#d9b9a0'], [/фиолет|лилов|сирен/i, '#7b4fa0'], [/изумр|зел[её]н/i, '#2f7a57'],
  [/син|сапфир/i, '#2c4a8a'], [/голуб/i, '#86b3dc'], [/сер[её]бр|сер(?:ый|ая|ое|ые)/i, '#a9aeb6'], [/золот/i, '#c9a24a'],
];
const СОСТОЯНИЯ = [
  ['lost', /потерян|потерял|не найти|исчез/i, 'потеряно'],
  ['off', /снят|сняла|стянут|сорван|на полу|off/i, 'снято'],
  ['moved', /сдвинут|сдвинул|отодвинут|спущен|приспущ|moved/i, 'сдвинуто'],
  ['on', /.*/, 'на месте'],
];
const СЛУЧАЙНО = /не думая|случайн|просто так|для себя|первое попавш|привычн|не выбирал/i;

/** «set: чёрное кружево, комплект; for: для Тристана; st: сдвинуто» → разбор. */
export function разобратьБельё(value) {
  const s = текст(value);
  if (пусто(s)) return null;
  const части = {};
  s.split(';').forEach(ч => { const м = ч.match(/^\s*(set|for|st)\s*[:：]\s*(.+)$/i); if (м) части[м[1].toLowerCase()] = м[2].trim(); });
  const комплект = части.set || (Object.keys(части).length ? '' : s);
  const цвет = (ЦВЕТА.find(([rx]) => rx.test(комплект.replace(/ё/gi, 'е'))) || [null, ''])[1];
  const [ст, , стСлово] = СОСТОЯНИЯ.find(([, rx]) => rx.test(части.st || 'on'));
  const для = части.for || '';
  const случайно = !для || СЛУЧАЙНО.test(для);
  // Средневековье: сорочка, камиза — одна вещь до колен, а не комплект.
  const сорочка = /камиз|сорочк|исподн|рубах/i.test(комплект);
  return { комплект, цвет, состояние: ст, состояниеСлово: стСлово, для, случайно, сорочка };
}

function силуэты(б) {
  const fill = б.цвет || 'var(--hud-accent, #d96a8a)';
  const гаснет = б.состояние === 'off' || б.состояние === 'lost' ? .25 : б.состояние === 'moved' ? .6 : 1;
  if (б.сорочка) return `<svg class="hud-un-svg" viewBox="0 0 40 50" aria-hidden="true" style="opacity:${гаснет}"><path d="M12 4l4 4h8l4-4 6 6-4 6v30H10V16L6 10z" fill="${fill}" stroke="rgba(255,255,255,.45)" stroke-width="1"/></svg>`;
  return `<svg class="hud-un-svg" viewBox="0 0 80 40" aria-hidden="true" style="opacity:${гаснет}">`
    + `<path d="M4 10q8-6 16-2q4 3 6 9q2-6 6-9q8-4 16 2l-2 8q-8 6-16 3q-4-2-4-5q0 3-4 5q-8 3-16-3z" fill="${fill}" stroke="rgba(255,255,255,.45)" stroke-width="1" transform="translate(-2 2) scale(.75)"/>`
    + `<path d="M46 12h30l-4 8q-6 10-11 14h-0.5q-5-4-11-14z" fill="${fill}" stroke="rgba(255,255,255,.45)" stroke-width="1"/></svg>`;
}

export function buildUnderwear(value) {
  const б = разобратьБельё(value);
  if (!б) return '';
  const вид = settings.underwearView === 'layer' ? 'layer' : 'set';
  const бейдж = б.случайно ? '<span class="hud-un-for is-random">надето не думая</span>'
    : `<span class="hud-un-for">подобрано: ${escapeHtml(б.для.replace(/^для\s+/i, 'для '))}</span>`;
  const состояние = `<span class="hud-un-state is-${б.состояние}">${б.состояниеСлово}</span>`;
  const тело = вид === 'layer'
    ? `<div class="hud-un-layers" aria-label="Слои: кожа, бельё, одежда"><span class="l-skin">кожа</span><span class="l-un is-${б.состояние}" style="--un:${б.цвет || 'var(--hud-accent, #d96a8a)'}">${б.сорочка ? 'сорочка' : 'бельё'}</span><span class="l-cloth">одежда</span></div>`
    : `<div class="hud-un-set">${силуэты(б)}</div>`;
  const карточка = `<div class="hud-v hud-v-card hud-un-card is-${вид}">${тело}<div class="hud-un-text"><p>${applyTooltips(б.комплект || 'не описано')}</p><div class="hud-un-badges">${бейдж}${состояние}</div></div></div>`;
  if (settings.underwearVeil === false) return карточка;
  return `<details class="hud-un-veil"><summary>${ико('lock')}${б.сорочка ? 'Исподнее' : 'Бельё'} — открыть</summary>${карточка}</details>`;
}
