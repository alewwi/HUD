// hud-manager/render/calendar.js
//
// Календарь в телефоне (и в альманахе средневековья — render/medieval.js).
//
// Как настоящий: месяц сеткой, листается стрелками; нажатый день раскрывает
// своё расписание лентой по часам, а над лентой — сколько до этого дня:
// «через 12 дней · 1 неделя и 5 дней». Расписания — как отдельные календари
// в телефоне: свой (хозяина), дни рождения, праздники и расписания других
// персонажей карточки — у каждого свой цвет и имя, каждый можно скрыть
// фишкой сверху.
//
// Разметка строится целиком сразу (сетки нужных месяцев и списки дней с
// делами); нажатия обрабатывает обработатьКликКалендаря — его зовёт общий
// обработчик кликов (events.js). Своего состояния у календаря нет: всё в
// классах и data-атрибутах разметки.

import { escapeHtml, defeatWI, имяБезПриставки } from '../utils.js?v=23.88.8';
import { namesLikelySame } from '../names.js?v=23.88.8';
import { G_ICONS } from './icons.js?v=23.88.8';

const МЕСЯЦЫ_РОД = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const МЕСЯЦЫ = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const ДНИ = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const ДНИ_КОРНИ = ['воскрес', 'понедел', 'вторн', 'сред', 'четверг', 'пятниц', 'суббот'];
const ДНИ_КОРОТКО = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
// Сколько месяцев вокруг сегодняшнего можно листать: дела дальше в списке
// «Скоро» всё равно видны.
const НАЗАД = 2, ВПЕРЁД = 6;
// Цвета чужих расписаний — различимые на тёмном и светлом.
// Розовый — последним: он у дней рождения и часто у самого хозяина (акцент).
export const ЦВЕТА_КАЛЕНДАРЕЙ = ['#5fb8ff', '#8fd18a', '#c59bff', '#ffb36b', '#55d6c2', '#f07a7a', '#d8c25a', '#ff8fb8'];

// --- Даты --------------------------------------------------------------------
const ключДня = (y, mo, d) => `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const изКлюча = (к) => { const [y, mo, d] = String(к).split('-').map(Number); return { y, mo, d }; };
const вДату = ({ y, mo, d }) => new Date(y, mo - 1, d);
const сдвиг = (о, дней) => { const t = вДату(о); t.setDate(t.getDate() + дней); return { y: t.getFullYear(), mo: t.getMonth() + 1, d: t.getDate() }; };
const разницаДней = (а, б) => Math.round((Date.UTC(б.y, б.mo - 1, б.d) - Date.UTC(а.y, а.mo - 1, а.d)) / 86400000);

// Дата сцены приходит как «16.01.2025», «16.01» или «ЧЕТВЕРГ, 16 ЯНВАРЯ 2025».
export function parseDayMonth(str) {
  const s = String(str || '').toLowerCase();
  let m = s.match(/(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\s*[.\/-]\s*(\d{2,4}))?/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    return { d: +m[1], mo: +m[2], y };
  }
  m = s.match(/(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?/);
  if (m) {
    const idx = МЕСЯЦЫ_РОД.findIndex(name => m[2].startsWith(name.slice(0, 4)));
    if (idx >= 0) return { d: +m[1], mo: idx + 1, y: m[3] ? +m[3] : null };
  }
  // По-английски: «17 October 2024», «October 17th, 2024».
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,})\.?,?(?:\s+(\d{4}))?/) || s.match(/([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/);
  if (m) {
    const [d, слово] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
    const idx = месяцEN(слово);
    if (idx >= 0) return { d: +d, mo: idx + 1, y: m[3] ? +m[3] : null };
  }
  return null;
}
const МЕСЯЦЫ_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const месяцEN = (слово) => { const с = String(слово || '').toLowerCase(); return с.length >= 3 ? МЕСЯЦЫ_EN.findIndex(м => с.startsWith(м)) : -1; };
const ДНИ_EN = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// --- Счётчик до дня ------------------------------------------------------------
const мн = (n, одна, две, пять) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? пять : b === 1 ? одна : b >= 2 && b <= 4 ? две : пять; };
const дней = (n) => `${n} ${мн(n, 'день', 'дня', 'дней')}`;
const недель = (n) => `${n} ${мн(n, 'неделя', 'недели', 'недель')}`;
/** «Сегодня», «Завтра», «Через 12 дней», «3 дня назад» и, от недели, — сколько это недель. */
export function счётчикДо(разница) {
  if (разница === 0) return { главное: 'Сегодня', недели: '' };
  if (разница === 1) return { главное: 'Завтра', недели: '' };
  if (разница === -1) return { главное: 'Вчера', недели: '' };
  if (разница === 2) return { главное: 'Послезавтра', недели: '' };
  const n = Math.abs(разница), н = Math.floor(n / 7), д = n % 7;
  const главное = разница > 0 ? `Через ${дней(n)}` : `${дней(n)[0].toUpperCase()}${дней(n).slice(1)} назад`;
  return { главное, недели: н ? (д ? `${недель(н)} и ${дней(д)}` : недель(н)) : '' };
}
const подписьДня = (о) => `${ДНИ[вДату(о).getDay()]}, ${о.d} ${МЕСЯЦЫ_РОД[о.mo - 1]}`;

// --- Расписание персонажа -----------------------------------------------------
// «14:30 - встреча с юристом; завтра 10:00 — суд; в пятницу вечером — ужин у
// Ричарда; 15.11 - День рождения Лены». Время — чч:мм или часть дня; день —
// дата, «завтра», «послезавтра», день недели; без дня — сегодня.
const ЧАСТИ_ДНЯ = [
  [/(?<![\p{L}])(?:с\s+)?утр(?:о|ом|а)(?![\p{L}])|(?<![\p{L}])(?:in the |this |tomorrow )?morning(?![\p{L}])/iu, 'утром', '09:00'],
  [/(?<![\p{L}])(?:в\s+)?обед(?:а|ом)?(?![\p{L}])|(?<![\p{L}])(?:at |over )?(?:lunch|noon|midday)(?![\p{L}])/iu, 'в обед', '13:00'],
  [/(?<![\p{L}])(?:дн[её]м|днем|после\s+обеда)(?![\p{L}])|(?<![\p{L}])(?:in the |this )?afternoon(?![\p{L}])/iu, 'днём', '14:00'],
  [/(?<![\p{L}])(?:вечер(?:ом|а)?)(?![\p{L}])|(?<![\p{L}])(?:in the |this |tomorrow )?evening(?![\p{L}])|(?<![\p{L}])tonight(?![\p{L}])/iu, 'вечером', '19:00'],
  [/(?<![\p{L}])(?:ночь[юи]?|ночью|в\s+полночь)(?![\p{L}])|(?<![\p{L}])(?:at )?(?:night|midnight)(?![\p{L}])/iu, 'ночью', '23:30'],
];
export function разобратьРасписание(сырое, сегодня) {
  const out = [];
  if (!сегодня) return out;
  const деньНедели = вДату(сегодня).getDay();
  String(Array.isArray(сырое) ? сырое.join('; ') : сырое || '').split(/[;\n]/).map(x => x.trim()).filter(Boolean).forEach(пункт => {
    if (/^(?:empty|none|nothing|нет|пусто|—|-)$/i.test(пункт)) return;
    let s = ' ' + пункт + ' ';
    // Время: первое — начало, второе (диапазон) — конец.
    const времена = [...s.matchAll(/(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g)];
    const время = времена[0] ? `${времена[0][1].padStart(2, '0')}:${времена[0][2]}` : '';
    const до = времена[1] ? `${времена[1][1].padStart(2, '0')}:${времена[1][2]}` : '';
    времена.forEach(м => { s = s.replace(м[0], ' '); });
    // День.
    let день = null;
    const дата = s.match(/(?<![\d:])(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?(?![\d:])/);
    const датаСловом = s.match(/(?<![\d])(\d{1,2})\s+(январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр)[\p{L}]*/iu);
    if (дата && +дата[2] >= 1 && +дата[2] <= 12 && +дата[1] >= 1 && +дата[1] <= 31) {
      const y = дата[3] ? (дата[3].length === 2 ? 2000 + +дата[3] : +дата[3]) : сегодня.y;
      день = { y, mo: +дата[2], d: +дата[1] };
      s = s.replace(дата[0], ' ');
    } else if (датаСловом) {
      const mo = МЕСЯЦЫ_РОД.findIndex(н => н.startsWith(датаСловом[2].toLowerCase().slice(0, 3))) + 1;
      if (mo) { день = { y: сегодня.y, mo, d: +датаСловом[1] }; s = s.replace(датаСловом[0], ' '); }
    } else {
      // «Nov 15», «15 November», «on the 15th of November».
      const en = s.match(/(?<![\d\p{L}])(?:(?:on\s+)?(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,})|([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?)(?![\d\p{L}])/iu);
      const mo = en ? месяцEN(en[2] || en[3]) + 1 : 0;
      if (mo) { день = { y: сегодня.y, mo, d: +(en[1] || en[4]) }; s = s.replace(en[0], ' '); }
    }
    if (!день) {
      const отн = [[/(?<![\p{L}])послезавтра(?![\p{L}])|(?<![\p{L}])(?:the\s+)?day after tomorrow(?![\p{L}])/iu, 2], [/(?<![\p{L}])завтра(?![\p{L}])|(?<![\p{L}])tomorrow(?![\p{L}])/iu, 1], [/(?<![\p{L}])сегодня(?![\p{L}])|(?<![\p{L}])(?:today|tonight)(?![\p{L}])/iu, 0]];
      for (const [re, n] of отн) if (re.test(s)) { день = сдвиг(сегодня, n); s = s.replace(re, ' '); break; }
    }
    if (!день) {
      const чн = s.match(/через\s+(\d{1,2})\s+(дн|недел)[\p{L}]*|in\s+(\d{1,2})\s+(days?|weeks?)(?![\p{L}])/iu);
      if (чн) { день = сдвиг(сегодня, +(чн[1] || чн[3]) * (/недел|week/i.test(чн[2] || чн[4]) ? 7 : 1)); s = s.replace(чн[0], ' '); }
    }
    if (!день) {
      const выходные = s.match(/(?<![\p{L}])на\s+выходных(?![\p{L}])|(?<![\p{L}])(?:on |at |this |over the )?weekend(?![\p{L}])/iu);
      const дн = s.match(/(?<![\p{L}])(?:во?\s+|в\s+эт[уо][тй]?\s+|в\s+следующ[\p{L}]+\s+)?(понедельник|вторник|сред[ау]|четверг|пятниц[ау]|суббот[ау]|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?![\p{L}])/iu);
      if (выходные) { день = сдвиг(сегодня, (6 - деньНедели + 7) % 7); s = s.replace(выходные[0], ' '); }
      else if (дн) {
        const слово = дн[1].toLowerCase();
        const i = слово.length === 2 ? ДНИ_КОРОТКО.indexOf(слово) : ДНИ_КОРНИ.findIndex(к => слово.startsWith(к.slice(0, 4)));
        if (i >= 0) { день = сдвиг(сегодня, (i - деньНедели + 7) % 7); s = s.replace(дн[0], ' '); }
      } else {
        // «on Friday», «next Tuesday», «this Sat».
        const en = s.match(/(?<![\p{L}])(?:on\s+|this\s+|next\s+)?(sun|mon|tue|wed|thu|fri|sat)(?:day|sday|nesday|rsday|urday)?\.?(?![\p{L}])/iu);
        if (en) { const i = ДНИ_EN.indexOf(en[1].toLowerCase()); день = сдвиг(сегодня, (i - деньНедели + 7) % 7 + (/next/i.test(en[0]) && i === деньНедели ? 7 : 0)); s = s.replace(en[0], ' '); }
      }
    }
    // Часть дня, если нет часов.
    let часть = '', порядок = время;
    if (!время) for (const [re, слово, ч] of ЧАСТИ_ДНЯ) if (re.test(s)) { часть = слово; порядок = ч; s = s.replace(re, ' '); break; }
    const название = s.replace(/\s+/g, ' ').replace(/^[\s—–\-:.,|]+|[\s—–\-:.,|]+$/g, '').trim();
    out.push({ день: день || { ...сегодня }, время, до, часть, порядок, название: название || 'Дело' });
  });
  return out;
}

// --- Сборка -------------------------------------------------------------------
const ТИПЫ = { birthday: 'Дни рождения', holiday: 'Праздники' };
const кратко = (имя) => (имяБезПриставки(String(имя || '')) || String(имя || '')).split(/\s+/)[0];

/**
 * Календарь телефона. владелец — хозяин телефона: его расписание и события
 * календаря (phn.cl) — «Мой календарь»; расписания остальных персонажей
 * карточки — их календари, своим цветом и с именем.
 */
export function buildCalendarApp(events, characters, sceneDate, владелец = null, пусто = null) {
  const сегодняСырое = parseDayMonth(sceneDate);
  const список = [];
  const сегодня = сегодняСырое ? { ...сегодняСырое, y: сегодняСырое.y || new Date().getFullYear() } : null;
  // Календари: id, подпись, цвет (переменная --c).
  const календари = [];
  const календарь = (id, подпись, цвет) => { let к = календари.find(x => x.id === id); if (!к) { к = { id, подпись, цвет }; календари.push(к); } return к; };

  (Array.isArray(events) ? events : []).forEach(e => {
    const dm = parseDayMonth(e && e.date);
    if (!dm) return;
    const kind = String(e.kind || '').toLowerCase();
    const тип = /birth|день рожд/.test(kind) ? 'birthday' : /holiday|праздн|фестив/.test(kind) ? 'holiday' : 'event';
    const к = тип === 'event' ? календарь('own', 'Мой', 'var(--hud-cal-own)') : календарь(тип === 'birthday' ? 'bd' : 'hol', ТИПЫ[тип], тип === 'birthday' ? '#ff9ec8' : '#ffc94d');
    const время = String(e.time || '').match(/(\d{1,2}):(\d{2})/);
    список.push({ день: { d: dm.d, mo: dm.mo, y: dm.y || (сегодня ? сегодня.y : new Date().getFullYear()) }, время: время ? `${время[1].padStart(2, '0')}:${время[2]}` : '', до: '', часть: '', порядок: время ? время[0] : '', название: String(e.title || '').trim() || 'Событие', тип, кал: к.id, кто: '' });
  });

  // Расписания из карточек: хозяина — в «Мой», остальных — в их календари.
  let цвет = 0;
  (Array.isArray(characters) ? characters : []).forEach(ch => {
    const сырое = ch && (ch['Расписание'] || ch['расписание']);
    if (!сырое || !сегодня) return;
    const имя = String(ch['Имя'] || '').trim();
    const свой = владелец !== null && имя && namesLikelySame(имя, владелец);
    // Пустое расписание («empty») — без своего календаря.
    const пункты = разобратьРасписание(сырое, сегодня);
    if (!пункты.length) return;
    const к = свой ? календарь('own', 'Мой', 'var(--hud-cal-own)') : календарь('p:' + имя, кратко(имя) || 'Без имени', ЦВЕТА_КАЛЕНДАРЕЙ[цвет++ % ЦВЕТА_КАЛЕНДАРЕЙ.length]);
    пункты.forEach(п => список.push({ ...п, тип: 'plan', кал: к.id, кто: свой ? '' : кратко(имя) }));
  });

  const основа = сегодня || (список[0] && список[0].день);
  if (!основа) return пусто !== null ? пусто : `<div class="hud-phone-empty-app"><div class="hud-phone-empty-icon">${G_ICONS.cal}</div><div class="hud-phone-empty-line">В календаре пока пусто</div></div>`;
  const сегодняДень = сегодня || основа;
  const ключСегодня = ключДня(сегодняДень.y, сегодняДень.mo, сегодняДень.d);

  // Свой календарь первым, потом праздники и дни рождения, потом люди.
  const порядокКал = (к) => (к.id === 'own' ? 0 : к.id === 'hol' ? 1 : к.id === 'bd' ? 2 : 3);
  календари.sort((a, b) => порядокКал(a) - порядокКал(b));
  const номер = new Map(календари.map((к, i) => [к.id, i]));
  const поДням = new Map();
  for (const e of список) {
    const к = ключДня(e.день.y, e.день.mo, e.день.d);
    if (!поДням.has(к)) поДням.set(к, []);
    поДням.get(к).push(e);
  }
  // Весь день — первыми, дальше по времени.
  for (const дела of поДням.values()) дела.sort((a, b) => (a.порядок ? 1 : 0) - (b.порядок ? 1 : 0) || String(a.порядок).localeCompare(String(b.порядок)));

  // Месяцы: от сегодняшнего, назад и вперёд — до тех, где есть дела.
  const индексМесяца = (o) => o.y * 12 + (o.mo - 1);
  const сейчасМ = индексМесяца(сегодняДень);
  let отМ = сейчасМ, доМ = сейчасМ;
  for (const к of поДням.keys()) { const m = индексМесяца(изКлюча(к)); if (m >= сейчасМ - НАЗАД && m <= сейчасМ + ВПЕРЁД) { отМ = Math.min(отМ, m); доМ = Math.max(доМ, m); } }

  const цветКал = (id) => `c${номер.get(id)}`;
  const стиль = календари.map((к, i) => `--c${i}:${к.цвет}`).join(';');

  let месяцы = '';
  for (let m = отМ; m <= доМ; m++) {
    const y = Math.floor(m / 12), mo = m % 12 + 1;
    const вМесяце = new Date(y, mo, 0).getDate();
    const сдвигНед = (new Date(y, mo - 1, 1).getDay() + 6) % 7;
    let клетки = '';
    for (let i = 0; i < сдвигНед; i++) клетки += '<span class="hud-cal-day is-empty" aria-hidden="true"></span>';
    for (let d = 1; d <= вМесяце; d++) {
      const к = ключДня(y, mo, d);
      const дела = поДням.get(к) || [];
      const кал = [...new Set(дела.map(e => e.кал))].slice(0, 4);
      const точки = кал.map(id => `<i class="hud-cal-dot ${цветКал(id)}"></i>`).join('');
      const выходной = (сдвигНед + d - 1) % 7 >= 5;
      const прошло = к < ключСегодня;
      const подпись = подписьДня({ y, mo, d }) + (дела.length ? `, дел: ${дела.length}` : '');
      клетки += `<button type="button" class="hud-cal-day${к === ключСегодня ? ' is-today is-selected' : ''}${дела.length ? ' has-ev' : ''}${выходной ? ' is-weekend' : ''}${прошло ? ' is-past' : ''}" data-date="${к}" data-label="${escapeHtml(подписьДня({ y, mo, d }))}" aria-label="${escapeHtml(подпись)}"${к === ключСегодня ? ' aria-pressed="true"' : ' aria-pressed="false"'}><b>${d}</b>${точки ? `<span class="hud-cal-dots">${точки}</span>` : ''}</button>`;
    }
    месяцы += `<section class="hud-cal-month" data-month="${y}-${String(mo).padStart(2, '0')}"${m === сейчасМ ? '' : ' hidden'}>
      <div class="hud-cal-bar">
        <button type="button" class="hud-cal-nav is-prev" data-step="-1" aria-label="Предыдущий месяц"${m === отМ ? ' disabled' : ''}>‹</button>
        <span class="hud-cal-head">${МЕСЯЦЫ[mo - 1]} <small>${y}</small></span>
        <button type="button" class="hud-cal-nav is-next" data-step="1" aria-label="Следующий месяц"${m === доМ ? ' disabled' : ''}>›</button>
      </div>
      <div class="hud-cal-week" aria-hidden="true"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
      <div class="hud-cal-grid">${клетки}</div>
    </section>`;
  }

  // Дела дня: весь день — плашками, дальше лента по времени.
  const делоHTML = (e) => {
    const кто = e.кто ? `<span class="hud-cal-who">${defeatWI(escapeHtml(e.кто))}</span>` : '';
    const когда = e.время ? `<b>${escapeHtml(e.время)}</b>${e.до ? `<small>${escapeHtml(e.до)}</small>` : ''}` : e.часть ? `<b class="is-part">${escapeHtml(e.часть)}</b>` : '<b class="is-allday">весь день</b>';
    return `<li class="hud-cal-ev ${цветКал(e.кал)} t-${e.тип}${e.время || e.часть ? '' : ' is-allday'}"><span class="hud-cal-ev-time">${когда}</span><span class="hud-cal-ev-body"><span class="hud-cal-ev-title">${defeatWI(escapeHtml(e.название))}</span>${кто}</span></li>`;
  };
  const дниHTML = [...поДням.entries()].map(([к, дела]) => `<ul class="hud-cal-dayev" data-for="${к}"${к === ключСегодня ? '' : ' hidden'}>${дела.map(делоHTML).join('')}</ul>`).join('');
  const сч = счётчикДо(0);

  // Скоро: ближайшие дни с делами после сегодняшнего (сегодня — в листе выше).
  const скоро = [...поДням.entries()].filter(([к]) => к > ключСегодня).sort(([a], [b]) => a.localeCompare(b)).slice(0, 6).map(([к, дела]) => {
    const о = изКлюча(к), р = разницаДней(сегодняДень, о);
    const когда = р === 0 ? 'Сегодня' : р === 1 ? 'Завтра' : `${о.d} ${МЕСЯЦЫ_РОД[о.mo - 1]}`;
    return `<button type="button" class="hud-cal-soon-day" data-date="${к}"><span class="hud-cal-soon-when">${когда}<small>${р > 1 ? escapeHtml(счётчикДо(р).главное.toLowerCase()) : ДНИ[вДату(о).getDay()].toLowerCase()}</small></span><span class="hud-cal-soon-list">${дела.slice(0, 3).map(e => `<span class="hud-cal-soon-item ${цветКал(e.кал)}">${e.время ? `<b>${escapeHtml(e.время)}</b> ` : ''}${defeatWI(escapeHtml(e.название))}${e.кто ? ` <em>· ${defeatWI(escapeHtml(e.кто))}</em>` : ''}</span>`).join('')}${дела.length > 3 ? `<span class="hud-cal-soon-more">ещё ${дела.length - 3}</span>` : ''}</span></button>`;
  }).join('');

  const фишки = календари.length > 1 ? `<div class="hud-cal-cals" role="group" aria-label="Календари">${календари.map((к, i) => `<button type="button" class="hud-cal-chip c${i}" data-cal="${i}" aria-pressed="true"><i aria-hidden="true"></i>${defeatWI(escapeHtml(к.подпись))}</button>`).join('')}</div>` : '';

  return `<div class="hud-cal" data-today="${ключСегодня}" style="${стиль}">
    ${фишки}
    <div class="hud-cal-months">${месяцы}</div>
    <div class="hud-cal-sheet" aria-live="polite">
      <div class="hud-cal-sheet-head">
        <span class="hud-cal-sheet-date">${escapeHtml(подписьДня(сегодняДень))}</span>
        <span class="hud-cal-count"><b>${escapeHtml(сч.главное)}</b><small hidden></small></span>
      </div>
      <div class="hud-cal-sheet-body">${дниHTML}<p class="hud-cal-none"${поДням.has(ключСегодня) ? ' hidden' : ''}>Ничего не запланировано</p></div>
    </div>
    ${скоро ? `<div class="hud-cal-soon"><div class="hud-cal-soon-head">Скоро</div>${скоро}</div>` : ''}
  </div>`;
}

// --- Нажатия ------------------------------------------------------------------
function выбратьДень(кал, к) {
  const о = изКлюча(к), сегодня = изКлюча(кал.dataset.today);
  // Месяц с этим днём — на экран.
  const месяц = кал.querySelector(`.hud-cal-month[data-month="${к.slice(0, 7)}"]`);
  if (месяц && месяц.hidden) показатьМесяц(кал, месяц);
  кал.querySelectorAll('.hud-cal-day.is-selected').forEach(x => { x.classList.remove('is-selected'); x.setAttribute('aria-pressed', 'false'); });
  const клетка = кал.querySelector(`.hud-cal-day[data-date="${к}"]`);
  if (клетка) { клетка.classList.add('is-selected'); клетка.setAttribute('aria-pressed', 'true'); }
  const сч = счётчикДо(разницаДней(сегодня, о));
  const лист = кал.querySelector('.hud-cal-sheet');
  лист.querySelector('.hud-cal-sheet-date').textContent = (клетка && клетка.dataset.label) || подписьДня(о);
  лист.querySelector('.hud-cal-count b').textContent = сч.главное;
  const нед = лист.querySelector('.hud-cal-count small');
  нед.textContent = сч.недели; нед.hidden = !сч.недели;
  let есть = false;
  лист.querySelectorAll('.hud-cal-dayev').forEach(u => { const мой = u.dataset.for === к; u.hidden = !мой; if (мой) есть = true; });
  лист.querySelector('.hud-cal-none').hidden = есть;
  // Новый день — заново проигрываем появление листа.
  лист.classList.remove('is-flip'); void лист.offsetWidth; лист.classList.add('is-flip');
}
function показатьМесяц(кал, месяц) {
  кал.querySelectorAll('.hud-cal-month').forEach(x => { x.hidden = x !== месяц; });
}

/** Обработать клик внутри календаря. true — клик был его. */
export function обработатьКликКалендаря(e) {
  const кал = e.target && e.target.closest && e.target.closest('.hud-cal');
  if (!кал || !кал.dataset.today) return false;
  const день = e.target.closest('.hud-cal-day[data-date], .hud-cal-soon-day[data-date]');
  if (день) { e.preventDefault(); выбратьДень(кал, день.dataset.date); return true; }
  const стрелка = e.target.closest('.hud-cal-nav');
  if (стрелка) {
    e.preventDefault();
    const сейчас = стрелка.closest('.hud-cal-month');
    const соседний = стрелка.dataset.step === '-1' ? сейчас.previousElementSibling : сейчас.nextElementSibling;
    if (соседний && соседний.classList.contains('hud-cal-month')) показатьМесяц(кал, соседний);
    return true;
  }
  const фишка = e.target.closest('.hud-cal-chip');
  if (фишка) {
    e.preventDefault();
    const выкл = фишка.getAttribute('aria-pressed') === 'true';
    фишка.setAttribute('aria-pressed', String(!выкл));
    кал.classList.toggle('off-c' + фишка.dataset.cal, выкл);
    return true;
  }
  return false;
}
