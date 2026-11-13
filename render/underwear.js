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

import { escapeHtml, applyTooltips, flattenFieldValue, снятьЗаглушки } from '../utils.js?v=23.89.14';
import { settings } from '../settings.js?v=23.89.14';
import { ико } from './view-icons.js?v=23.89.14';

const текст = (v) => String(снятьЗаглушки(flattenFieldValue(v)) || '').trim();
const пусто = (s) => !s || /^(empty|none|нет|—|-)$/i.test(s.trim());

const ЦВЕТА = [
  [/light blue|baby blue|sky blue|pale blue/i, '#86b3dc'],
  [/черн|black/i, '#1d1a1f'], [/бел|молочн|айвори|слонов|white|ivory|milk/i, '#f2eee8'], [/алы|красн|кармин|scarlet|crimson|(?<![a-z])red(?![a-z])/i, '#c0283a'], [/бордо|винн|марсал|burgundy|wine|maroon/i, '#6e1a2b'],
  [/розов|пудр|pink|powder|blush/i, '#e7a3b8'], [/нюд|телесн|бежев|кремов|nude|beige|cream|skin-tone/i, '#d9b9a0'], [/фиолет|лилов|сирен|purple|lilac|violet|lavender/i, '#7b4fa0'], [/изумр|зел[её]н|emerald|green/i, '#2f7a57'],
  [/син|сапфир|navy|(?<!light |sky |baby |pale |powder )blue|sapphire/i, '#2c4a8a'], [/голуб|light blue|sky blue|baby blue|pale blue|powder blue/i, '#86b3dc'], [/сер[её]бр|сер(?:ый|ая|ое|ые)|silver|gr[ae]y/i, '#a9aeb6'], [/золот|gold/i, '#c9a24a'],
  // Только «тёмные» или «светлые» без цвета — последними: «тёмно-синие» уже синие.
  [/темн|тёмн|(?<![a-z])dark(?![a-z])/i, '#2b2731'], [/светл|(?<![a-z])light(?![a-z])|pale/i, '#e6ded4'],
];
const СОСТОЯНИЯ = [
  ['lost', /потерян|потерял|не найти|исчез|lost|missing|can't find/i, 'потеряно'],
  ['off', /снят|сняла|стянут|сорван|на полу|off|removed|torn|on the floor/i, 'снято'],
  ['moved', /сдвинут|сдвинул|отодвинут|спущен|приспущ|moved|pushed aside|pulled down|pulled aside|shifted/i, 'сдвинуто'],
  ['on', /.*/, 'на месте'],
];
const СЛУЧАЙНО = /не думая|случайн|просто так|для себя|первое попавш|привычн|не выбирал|without thinking|random|by chance|for (?:her|him)self|for myself|habit|whatever|didn't choose/i;

/** «set: чёрное кружево, комплект; for: для Дамиана; st: сдвинуто» → разбор. */
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
  const сорочка = /камиз|сорочк|исподн|рубах|chemise|shift|smock|undershirt/i.test(комплект);
  return { комплект, цвет, состояние: ст, состояниеСлово: стСлово, для, случайно, сорочка };
}

// --- Какие вещи рисовать ------------------------------------------------------
// По словам комплекта: бюстгальтер, трусики, стринги, боксёры, брифы, боди,
// сорочка. Раньше рисовались всегда бюстгальтер и трусики — и у мужчин в
// «тёмных боксёрах» тоже. Слов нет («комплект», «кружево») — по полу:
// женщине бюстгальтер и трусики, мужчине брифы. Бюстгальтер у мужчины — только
// если он прямо назван.
const ВЕЩИ = [
  ['body', /боди|корсет|комбинац|пеньюар|негляж|bodysuit|teddy|corset|basque|bustier|slip dress|negligee/i],
  ['bra', /бюстгальт|лифчик|(?<![а-яё])лиф(?![а-яё])|бралет|(?<![а-яё])бра(?![а-яё])|(?<![a-z])bra(?![a-z])|bralette|push-?up/i],
  ['boxers', /боксер|боксёр|трусы-шорты|семейник|(?<![a-z])boxers?(?![a-z])|trunks/i],
  ['thong', /стринг|танга|тонг|thong|g-string/i],
  ['briefs', /брифы|плавк|джок|(?<![а-яё])трусы(?![а-яё])|briefs|jockstrap/i],
  ['panties', /трусик|трусики|слипы|кюлот|шортик|panties|knickers|cheeky|bikini|hipster/i],
];
export function вещиБелья(комплект, пол = '') {
  const s = String(комплект || '').replace(/ё/gi, 'е').toLowerCase();
  const есть = ВЕЩИ.filter(([, rx]) => rx.test(s)).map(([к]) => к);
  // Одна вещь низа: стринги точнее трусиков, боксёры — брифов.
  const низ = ['boxers', 'thong', 'briefs', 'panties'].find(к => есть.includes(к));
  const out = [];
  if (есть.includes('body')) out.push('body');
  else {
    if (есть.includes('bra') || (!низ && пол !== 'm')) out.push('bra');
    out.push(низ || (пол === 'm' ? 'briefs' : 'panties'));
  }
  return out;
}

// Силуэты в клетке 40×44. Цвет — заливкой, поверх — отблеск сверху и тень
// снизу, контур светлый, отделка (пояс, кружево, бантик) — светлой линией:
// чёрное бельё на тёмной карточке иначе пропадало целиком.
const ФОРМЫ = {
  bra: { тело: 'M5 26Q5 13 19 13.5Q20.5 21 19 27.5Q11 30 5 26ZM35 26Q35 13 21 13.5Q19.5 21 21 27.5Q29 30 35 26Z',
    отделка: '<path d="M6.5 24Q7 15.5 18 15M33.5 24Q33 15.5 22 15" stroke-dasharray="1.4 1.3"/><path d="M9 15.5L11.5 3M31 15.5L28.5 3" stroke-width="1.6"/><path d="M4 27.5Q20 31.5 36 27.5" stroke-width="1.8"/><circle cx="20" cy="24" r="1.5" fill="currentColor"/>' },
  panties: { тело: 'M4 11Q20 14.5 36 11L33.5 19Q24.5 22 22.5 35H17.5Q15.5 22 6.5 19Z',
    отделка: '<path d="M4.5 11.6Q20 15 35.5 11.6" stroke-width="2"/><path d="M7.5 19.5Q15.5 22.5 17.5 33M32.5 19.5Q24.5 22.5 22.5 33" stroke-dasharray="1.4 1.3"/><path d="M18.4 15.8l1.6 1.2 1.6-1.2-1.6 2.6z" fill="currentColor"/>' },
  thong: { тело: 'M4 11Q20 14.5 36 11L31 15.5Q22.5 19 21 34H19Q17.5 19 9 15.5Z',
    отделка: '<path d="M4.5 11.6Q20 15 35.5 11.6" stroke-width="1.8"/><path d="M18.4 15.6l1.6 1.2 1.6-1.2-1.6 2.6z" fill="currentColor"/>' },
  briefs: { тело: 'M5 9H35V14L31.5 22Q24.5 25.5 22.5 34H17.5Q15.5 25.5 8.5 22L5 14Z',
    отделка: '<path d="M5.5 11.5H34.5" stroke-width="3.2" stroke-opacity=".55" stroke-linecap="butt"/><path d="M20 15.5V24" stroke-dasharray="1.6 1.4"/>' },
  boxers: { тело: 'M5 7H35V11.5L37.5 35H23.5L20 23L16.5 35H2.5L5 11.5Z',
    отделка: '<path d="M5.5 9.3H34.5" stroke-width="3.4" stroke-opacity=".55" stroke-linecap="butt"/><path d="M20 12.5V22" stroke-dasharray="1.6 1.4"/><path d="M3.5 32H16.8M23.2 32H36.5" stroke-opacity=".6"/>' },
  body: { тело: 'M12.5 3H15Q20 12 25 3H27.5Q28.5 13 32 19Q36 27 33 30Q25.5 33 23 42H17Q14.5 33 7 30Q4 27 8 19Q11.5 13 12.5 3Z',
    отделка: '<path d="M9.5 20Q15 23 20 20.5Q25 23 30.5 20" stroke-dasharray="1.4 1.3"/><path d="M8 29.5Q20 33 32 29.5" stroke-width="1.6"/><path d="M18.4 22.4l1.6 1.2 1.6-1.2-1.6 2.6z" fill="currentColor"/>' },
  chemise: { тело: 'M13 3H15Q20 9.5 25 3H27L28.5 13Q34 28 37 42H3Q6 28 11.5 13Z',
    отделка: '<path d="M13.5 3.5L12 13M26.5 3.5L28 13" stroke-width="1.2"/><path d="M11.5 14Q20 17.5 28.5 14" stroke-dasharray="1.4 1.3"/><path d="M3.5 41Q7 38.5 10.5 41Q14 38.5 17.5 41Q21 38.5 24.5 41Q28 38.5 31.5 41Q35 38.5 36.5 41"/>' },
};
let счётчикId = 0;
function силуэты(б, пол) {
  const fill = б.цвет || 'var(--hud-accent, #d96a8a)';
  const гаснет = б.состояние === 'off' || б.состояние === 'lost' ? .3 : б.состояние === 'moved' ? .65 : 1;
  const вещи = б.сорочка ? ['chemise'] : вещиБелья(б.комплект, пол);
  const id = 'hud-un-g' + (++счётчикId);
  const клетки = вещи.map((к, i) => {
    const ф = ФОРМЫ[к];
    return `<g transform="translate(${i * 40} 0)" class="is-${к}"><path d="${ф.тело}" fill="${fill}"/><path d="${ф.тело}" fill="url(#${id})"/>`
      + `<path d="${ф.тело}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".9" stroke-linejoin="round"/>`
      + `<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" class="hud-un-trim">${ф.отделка}</g></g>`;
  }).join('');
  // Отделка светлая на тёмном белье и тёмная на светлом — иначе её не видно.
  const м = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(б.цвет || '');
  const светлое = м && (0.299 * parseInt(м[1], 16) + 0.587 * parseInt(м[2], 16) + 0.114 * parseInt(м[3], 16)) > 150;
  const отделка = светлое ? 'rgba(60,40,52,.6)' : 'rgba(255,255,255,.7)';
  return `<svg class="hud-un-svg is-${вещи.length > 1 ? 'pair' : 'one'}" viewBox="0 0 ${вещи.length * 40} 44" aria-hidden="true" style="opacity:${гаснет};color:${отделка}">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>`
    + клетки + `</svg>`;
}

/** value — поле «Бельё»; пол — 'm', 'f' или '' (render/scene-body.js, полПерсонажа). */
export function buildUnderwear(value, { пол = '' } = {}) {
  const б = разобратьБельё(value);
  if (!б) return '';
  const вид = settings.underwearView === 'layer' ? 'layer' : 'set';
  const бейдж = б.случайно ? '<span class="hud-un-for is-random">надето не думая</span>'
    : `<span class="hud-un-for">подобрано: ${escapeHtml(б.для.replace(/^для\s+/i, 'для '))}</span>`;
  const состояние = `<span class="hud-un-state is-${б.состояние}">${б.состояниеСлово}</span>`;
  const тело = вид === 'layer'
    ? `<div class="hud-un-layers" aria-label="Слои: кожа, бельё, одежда"><span class="l-skin">кожа</span><span class="l-un is-${б.состояние}" style="--un:${б.цвет || 'var(--hud-accent, #d96a8a)'}">${б.сорочка ? 'сорочка' : 'бельё'}</span><span class="l-cloth">одежда</span></div>`
    : `<div class="hud-un-set">${силуэты(б, пол)}</div>`;
  const карточка = `<div class="hud-v hud-v-card hud-un-card is-${вид}">${тело}<div class="hud-un-text"><p>${applyTooltips(б.комплект || 'не описано')}</p><div class="hud-un-badges">${бейдж}${состояние}</div></div></div>`;
  if (settings.underwearVeil === false) return карточка;
  return `<details class="hud-un-veil"><summary>${ико('lock')}${б.сорочка ? 'Исподнее' : 'Бельё'} — открыть</summary>${карточка}</details>`;
}
