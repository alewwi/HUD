// hud-manager/render/world-city.js
//
// Городская жизнь во вкладке «Мир»: экономика (курсы, цены, зарплаты), афиша
// и городские службы. Одна строка на пункт, вид события — словом из промта.
// Оформление — в духе остальной вкладки, газетной полосы: биржевая сводка,
// театральные билеты, сводка происшествий.

import { escapeHtml, applyTooltips } from '../utils.js?v=23.78.7';

const части = (строка) => String(строка ?? '').split('|').map(s => s.trim());

// Изменение цены — направлением: знак и слово, а не цвет. Вверх — не всегда
// плохо (зарплата), поэтому стрелки нейтральные.
function направление(текст) {
  const s = String(текст || '');
  if (/^\s*\+|вырос|подорож|поднял|рост|up/i.test(s)) return ['up', '▲'];
  if (/^\s*[-−–]|упал|подешев|снизил|сниж|паден|down/i.test(s)) return ['down', '▼'];
  return ['flat', '•'];
}

// Значок статьи сводки по её названию.
const ЗНАЧКИ_ЭКОНОМИКИ = [
  [/доллар|usd|\$/i, '$'], [/евро|eur|€/i, '€'], [/юан|cny|¥|иен|jpy/i, '¥'], [/фунт|gbp|£/i, '£'], [/рубл|rub|₽/i, '₽'],
  [/биткоин|btc|крипт|₿/i, '₿'], [/золот|gold/i, '🥇'], [/нефт|brent|oil/i, '🛢'], [/бензин|топлив|дизел|fuel|gas/i, '⛽'],
  [/хлеб|bread|молок|продукт|еда|яйц|мясо/i, '🍞'], [/аренд|квартир|жиль|ипотек|rent/i, '🏠'], [/зарплат|оклад|доход|wage|salary/i, '💼'],
  [/акци|индекс|бирж|stock/i, '📈'], [/налог|tax/i, '🧾'],
];

// Разбор строк — общий для сводки и видов «Мира» (render/world-views.js).
// Строка без цены — заметка: { заметка: текст }.
export function разборЭкономики(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const [имя, значение, изменение] = части(row);
    if (значение === undefined) return { заметка: имя };
    const [куда, знак] = направление(изменение);
    const значок = (ЗНАЧКИ_ЭКОНОМИКИ.find(([rx]) => rx.test(имя)) || [, '¤'])[1];
    return { имя, значение, изменение: изменение || '', куда, знак, значок };
  });
}

export function buildEconomyHTML(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const строки = разборЭкономики(rows).map(п => {
    if (п.заметка !== undefined) return `<div class="hud-eco-row is-note"><span>${applyTooltips(п.заметка)}</span></div>`;
    // Значение фразой («выставлен на срочные торги за долги») вместо цены
    // в одну строку не помещается: такая строка раскладывается в столбик.
    const длинная = String(п.значение).length > 16 || String(п.изменение).length > 18;
    return `<div class="hud-eco-row${длинная ? ' is-long' : ''}" data-ico="${escapeHtml(п.значок)}"><i class="hud-eco-ico" aria-hidden="true">${п.значок}</i><span class="hud-eco-name">${escapeHtml(п.имя)}</span><span class="hud-eco-dots" aria-hidden="true"></span><b class="hud-eco-val">${escapeHtml(п.значение)}</b>`
      + (п.изменение ? `<em class="hud-eco-chg is-${п.куда}"><i aria-hidden="true">${п.знак}</i>${escapeHtml(п.изменение)}</em>` : '<em></em>')
      + `</div>`;
  }).join('');
  return `<div class="hud-world-section hud-world-section-eco"><div class="hud-world-title">💹 Экономика</div><div class="hud-eco-list">${строки}</div></div>`;
}

const ВИДЫ_АФИШИ = [
  ['cinema', /cinema|movie|film|кино|фильм/i, '🎬', 'Кино'],
  ['theatre', /theat|opera|ballet|театр|спектакл|опер|балет/i, '🎭', 'Театр'],
  ['concert', /concert|jazz|концерт|music|музык|джаз/i, '🎵', 'Концерт'],
  ['exhibition', /exhib|museum|gallery|выставк|музей|галере/i, '🖼️', 'Выставка'],
  ['festival', /festiv|fair|фестив|ярмарк/i, '🎪', 'Фестиваль'],
  ['sport', /sport|match|спорт|матч/i, '🏟️', 'Спорт'],
  ['club', /club|party|клуб|вечерин/i, '🪩', 'Клуб'],
  ['street', /street|улиц|площад|парад/i, '🎺', 'На улице'],
  ['lecture', /lecture|talk|meetup|conference|лекци|встреч|презентац|конференц/i, '🎤', 'Встреча'],
];

// Незнакомый вид латиницей на экран не выводим: «market» — это ещё не
// перевод, лучше общее слово. Русское слово модели показываем как есть.
const подписьВида = (слово, запасное) => {
  const s = String(слово || '').trim();
  return !s || /^[a-z][a-z\s-]*$/i.test(s) ? запасное : s;
};

export function разборАфиши(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const ч = части(row);
    const вид = ч.length > 1 ? ВИДЫ_АФИШИ.find(([, rx]) => rx.test(ч[0])) : null;
    const [ключ, значок, подпись] = вид ? [вид[0], вид[2], вид[3]] : ['other', '📅', ч.length > 2 ? подписьВида(ч[0], 'Событие') : 'Событие'];
    return { ключ, значок, подпись, название: ч.length > 1 ? ч[1] : ч[0], где: ч.length > 2 ? ч.slice(2).join(' · ') : '' };
  });
}

export function buildEventsHTML(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const карточки = разборАфиши(rows).map(({ ключ, значок, подпись, название, где }) => {
    // Билет: корешок с видом события, линия отрыва, основная часть.
    return `<div class="hud-afisha-card is-${ключ}"><div class="hud-afisha-stub"><i aria-hidden="true">${значок}</i><span class="hud-afisha-kind">${escapeHtml(подпись)}</span></div>`
      + `<div class="hud-afisha-main" data-ico="${значок}"><b class="hud-afisha-title">${escapeHtml(название)}</b>${где ? `<span class="hud-afisha-when">${escapeHtml(где)}</span>` : ''}<span class="hud-afisha-admit" aria-hidden="true">ADMIT ONE</span></div></div>`;
  }).join('');
  return `<div class="hud-world-section hud-world-section-afisha"><div class="hud-world-title">🎭 Афиша</div><div class="hud-afisha-grid">${карточки}</div></div>`;
}

const ВИДЫ_ГОРОДА = [
  ['emergency', /emerg|accident|fire|чп|авари|пожар|взрыв|происшеств/i, '🚨', 'ЧП'],
  ['traffic', /traffic|jam|пробк|затор/i, '🚗', 'Пробки'],
  ['weather', /weather|storm|forecast|погод|гроз|ливен|снегопад|метел|жар[аы]|мороз|туман|ураган/i, '🌦️', 'Погода'],
  ['roads', /road|дорог|гололёд|гололед|трасс/i, '🛣️', 'Дороги'],
  ['transport', /transport|metro|bus|train|транспорт|метро|автобус|поезд|электрич/i, '🚇', 'Транспорт'],
  ['repairs', /repair|construct|roadwork|works|ремонт|строит|перекладк/i, '🚧', 'Ремонт'],
  ['utilities', /utilit|power|water|коммун|свет|отоплен|вод[аы]|электр/i, '🔧', 'Коммунальные службы'],
  ['police', /police|полиц|патрул|перекрыт/i, '🚓', 'Полиция'],
  ['health', /health|medic|hospital|epidem|flu|здоров|больниц|эпидем|грипп|вирус/i, '🏥', 'Здоровье'],
  ['protest', /protest|rally|strike|march|митинг|протест|забастов|шестви/i, '📢', 'Митинги'],
];

export function разборГорода(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => {
    const ч = части(row);
    const вид = ч.length > 1 ? ВИДЫ_ГОРОДА.find(([, rx]) => rx.test(ч[0])) : null;
    const [ключ, значок, подпись] = вид ? [вид[0], вид[2], вид[3]] : ['other', '🏛', ч.length > 1 ? подписьВида(ч[0], 'Город') : 'Город'];
    const текст = ч.length > 1 ? ч.slice(1).join(' · ') : ч[0];
    // «9 баллов» у пробок — шкалой из десяти делений.
    const баллы = ключ === 'traffic' ? (текст.match(/(\d{1,2})\s*балл/i) || [])[1] : null;
    return { ключ, значок, подпись, текст, баллы: баллы || null };
  });
}

export function buildCityHTML(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const строки = разборГорода(rows).map(({ ключ, значок, подпись, текст, баллы }) => {
    const шкала = баллы ? `<span class="hud-city-pips" title="Пробки: ${баллы} из 10 баллов" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Number(баллы) ? 'on' : ''}${i >= 7 ? ' hi' : i >= 4 ? ' mid' : ''}"></i>`).join('')}</span>` : '';
    return `<div class="hud-city-row is-${ключ}" data-ico="${значок}"><span class="hud-city-kind"><i aria-hidden="true">${значок}</i>${escapeHtml(подпись)}${ключ === 'emergency' ? '<b class="hud-city-stamp">срочно</b>' : ''}</span><p>${applyTooltips(текст)}${шкала}</p></div>`;
  }).join('');
  return `<div class="hud-world-section hud-world-section-city"><div class="hud-world-title">🏛 Городские службы</div><div class="hud-city-list">${строки}</div></div>`;
}
