// hud-manager/render/family-views.js
//
// Виды новых семейных блоков на выбор (Кастомизация → Блоки: Семья):
//   • «Малыши в животе» — УЗИ-снимок, гнездо с яйцами, письмо аиста;
//   • «После родов» — дневник с календарём шести недель, кольца, бутылочки;
//   • трекер «Детской» — полароиды на верёвке, деревянные кубики, ростомер;
//   • «Вехи и уход» — альбом наклеек, сутки на циферблате, настольная игра.
// Первый вид каждого блока («как сейчас») рисуют сами fetus.js, postpartum.js
// и babies.js; здесь только новые. Данные те же — модель ничего не пишет
// сверх прежнего. Оформление — css/family-views.css; движение — только под
// курсором или после касания.

import { escapeHtml, applyTooltips, hudHashSeed } from '../utils.js?v=23.36.1';
import { settings } from '../settings.js?v=23.36.1';

// Выбранный вид семейного блока. Список видов — в views.js (ВИДЫ_БЛОКОВ);
// здесь только проверка по своему списку, чтобы не тянуть views.js по кругу
// (views → intimacy → fetus → views).
const ВИДЫ = {
  fetusView: ['classic', 'ultrasound', 'nest', 'letter'],
  postpartumView: ['classic', 'journal', 'rings', 'bottles'],
  kidTrackerView: ['classic', 'polaroid', 'blocks', 'growth'],
  kidCareView: ['classic', 'stickers', 'clock', 'board'],
};
export const видСемьи = (ключ) => ВИДЫ[ключ].includes(settings[ключ]) ? settings[ключ] : 'classic';

let счёт = 0;
const новыйId = (п) => `hud-fam-${п}-${(++счёт).toString(36)}`;
const ф = (n) => String(Math.round(n * 10) / 10);
// Детерминированный генератор: один и тот же малыш — один и тот же рисунок.
function генератор(ключ) {
  let s = (hudHashSeed(String(ключ)) >>> 0) || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const скл = (n, а, б, в) => { const x = Math.abs(n) % 100, y = x % 10; return x > 10 && x < 20 ? в : y === 1 ? а : y >= 2 && y <= 4 ? б : в; };
const классПола = (пол) => пол === 'f' ? 'is-girl' : пол === 'm' ? 'is-boy' : 'is-unknown';
const иконка = (d, класс = '') => `<svg class="hud-kid-toy${класс ? ' ' + класс : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

/* =====================================================================
   МАЛЫШИ В ЖИВОТЕ
   д: { п, полы, кто, неделя, подписьПола, строкаПохож, acts }
   ===================================================================== */

// УЗИ-снимок: веер датчика с зерном, чёрные пузыри, светлые силуэты,
// служебные надписи по углам и шкала глубины — как распечатка из кабинета.
function узи(д) {
  const { п, полы, кто, неделя } = д;
  const r = генератор('us|' + кто);
  const id = новыйId('us');
  const n = Math.max(1, полы.length);
  const места = n === 1 ? [[100, 66]] : n === 2 ? [[74, 70], [128, 62]] : [[62, 74], [100, 56], [138, 74]];
  const масштаб = n === 1 ? 1.05 : n === 2 ? .8 : .64;
  const зерно = Array.from({ length: 190 }, () => {
    const a = (r() - .5) * 1.4, d = 14 + r() * 104;
    return `<circle cx="${ф(100 + Math.sin(a) * d)}" cy="${ф(4 + Math.cos(a) * d)}" r="${ф(.3 + r() * 1.4)}" opacity="${ф(.06 + r() * .42)}"/>`;
  }).join('');
  const пузыри = места.slice(0, n).map(([x, y], i) => `<g class="${классПола(полы[i])}" transform="translate(${x} ${y}) scale(${масштаб})">`
    + `<ellipse class="sac" rx="28" ry="21"/><ellipse class="sac-rim" rx="28" ry="21"/>`
    + `<g class="emb" filter="url(#${id}b)"><circle cx="5" cy="-6.6" r="7.4"/><path d="M-1-1.6c-6.4 2.4-9.4 8.6-7.2 13.4 2 4.6 8.2 6.6 13 4.6 4.2-1.8 6.2-6 4.4-9.6-1.2-2.4-3.6-3.4-6-2.8Z"/><path class="limb" d="M6.6 10c-3 .2-5.4 1.8-6 4.2M-3.4 2.6c.6 2 2 3 3.6 3"/></g>`
    + `<circle class="hb" cx="0" cy="4" r="1.7"/>${n > 1 ? `<text class="lbl" x="-24" y="-14">${'ABC'[i]}</text>` : ''}</g>`).join('');
  const шкала = Array.from({ length: 11 }, (_, i) => `<path d="M193 ${ф(12 + i * 9.4)}h${i % 5 ? 3 : 6}"/>`).join('');
  const чсс = 138 + hudHashSeed(кто + '|чсс') % 22;
  const веер = 'M93.6 11.7L24.1 94.4A118 118 0 0 0 175.9 94.4L106.4 11.7A10 10 0 0 1 93.6 11.7Z';
  return `<div class="hud-fetus hud-fv hud-fv-us${n > 1 ? ' is-multi' : ''}"><div class="us-print">`
    + `<div class="us-screen"><svg class="us-scan" viewBox="0 0 200 126" aria-hidden="true"><defs>`
    + `<radialGradient id="${id}g" cx=".5" cy=".03" r=".95"><stop offset="0" class="g0"/><stop offset=".45" class="g1"/><stop offset="1" class="g2"/></radialGradient>`
    + `<clipPath id="${id}c"><path d="${веер}"/></clipPath><filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".7"/></filter></defs>`
    + `<path class="fan" d="${веер}" fill="url(#${id}g)"/><g class="grain" clip-path="url(#${id}c)">${зерно}</g>`
    + `<g clip-path="url(#${id}c)">${пузыри}<rect class="sweep" x="-30" y="0" width="24" height="126"/></g>`
    + `<path class="fan-edge" d="${веер}"/><g class="scale">${шкала}</g><path class="cross" d="M150 30h6M153 27v6"/></svg>`
    + `<span class="us-corner tl">УЗИ · акушерство<br>${неделя ? `срок ${неделя} нед` : 'срок —'}</span>`
    + `<span class="us-corner tr">ЧСС ${чсс}<br>${n > 1 ? `плодов: ${n}` : 'плод: 1'}</span>`
    + `<span class="us-corner bl">${escapeHtml(п.имяТипа)}</span></div>`
    + `<div class="us-caption">${д.подписьПола}${д.строкаПохож}<div class="acts">${д.acts}</div></div></div></div>`;
}

// Гнездо: веточки сплетены вокруг яиц; яйцо — по цвету пола, в крапинку.
function гнездо(д) {
  const { п, полы, кто } = д;
  const r = генератор('nest|' + кто);
  const id = новыйId('nest');
  const n = Math.max(1, полы.length);
  const xs = n === 1 ? [85] : n === 2 ? [70, 100] : [58, 85, 112];
  const яйца = xs.map((x, i) => {
    const пол = классПола(полы[i]);
    const крап = Array.from({ length: 6 }, () => `<ellipse cx="${ф((r() - .5) * 13)}" cy="${ф((r() - .6) * 18)}" rx="${ф(.6 + r() * 1.2)}" ry="${ф(.5 + r() * .9)}"/>`).join('');
    return `<g class="egg ${пол}" style="--i:${i}" transform="translate(${x} ${i === 1 && n === 3 ? 42 : 46}) rotate(${ф((r() - .5) * 18)})"><path class="shell" d="M0-15c7.4 0 11.6 9.4 11.6 16.6S6.4 14.6 0 14.6-11.6 8.8-11.6 1.6-7.4-15 0-15Z" fill="url(#${id}${пол === 'is-girl' ? 'f' : пол === 'is-boy' ? 'm' : 'u'})"/><g class="spk">${крап}</g><ellipse class="hi" cx="-4.4" cy="-7" rx="2.6" ry="4.4" transform="rotate(20 -4.4 -7)"/></g>`;
  }).join('');
  const прутик = (y0, y1) => Array.from({ length: 16 }, () => {
    const x1 = 18 + r() * 60, x2 = x1 + 50 + r() * 70, y = y0 + r() * (y1 - y0), cy = y + 6 + r() * 8;
    return `<path class="t${Math.floor(r() * 3)}" d="M${ф(x1)} ${ф(y)}Q${ф((x1 + x2) / 2)} ${ф(cy)} ${ф(Math.min(x2, 152))} ${ф(y + (r() - .5) * 6)}" stroke-width="${ф(1.3 + r() * 1.5)}"/>`;
  }).join('');
  const градиент = (к, кл) => `<radialGradient id="${id}${к}" cx=".38" cy=".3" r=".8"><stop offset="0" class="e0 ${кл}"/><stop offset="1" class="e1 ${кл}"/></radialGradient>`;
  return `<div class="hud-fetus hud-fv hud-fv-nest${n > 1 ? ' is-multi' : ''}"><svg class="nest" viewBox="0 0 170 100" aria-hidden="true"><defs>`
    + градиент('f', 'is-girl') + градиент('m', 'is-boy') + градиент('u', 'is-unknown') + `</defs>`
    + `<ellipse class="shadow" cx="85" cy="92" rx="62" ry="6"/><path class="leaf" d="M132 34c10-10 24-8 28-4-6 10-18 12-28 4Zm4 0c6-1 14-3 20-4"/>`
    + `<ellipse class="bowl" cx="85" cy="64" rx="66" ry="25"/><ellipse class="hollow" cx="85" cy="56" rx="53" ry="15"/>`
    + `<g class="twigs back">${прутик(42, 52)}</g>${яйца}<g class="twigs">${прутик(58, 86)}</g>`
    + `<path class="feather" d="M28 34c-6 6-8 14-6 22 6-4 10-12 6-22Zm0 0-5 26"/></svg>`
    + `<div class="txt"><b class="kind">${escapeHtml(п.имяТипа)}${п.судьбаТипа ? '<i class="fate-mark" title="Изменено судьбой">✦︎</i>' : ''}</b>${п.пояснение ? `<small>${п.пояснение}</small>` : ''}${д.подписьПола}${д.строкаПохож}<div class="acts">${д.acts}</div></div></div>`;
}

// Письмо аиста: открытка на линованной бумаге, марка, штемпель, сургуч.
function письмо(д) {
  const { п, неделя } = д;
  return `<div class="hud-fetus hud-fv hud-fv-letter"><div class="lt-paper">`
    + `<span class="lt-post" aria-hidden="true"><span class="lt-stamp"><i>👶</i><small>почта аиста</small></span>`
    + `<span class="lt-mark"><b>скоро</b><small>${неделя ? `${неделя} нед.` : '♥'}</small></span></span>`
    + `<p class="lt-to">Дорогие мама и папа!</p>`
    + `<p class="lt-line">К вам летит: <b>${escapeHtml(п.имяТипа.toLowerCase())}</b>${п.судьбаТипа ? '<i class="fate-mark" title="Изменено судьбой">✦︎</i>' : ''}</p>`
    + (п.пояснение ? `<p class="lt-line is-small">${п.пояснение}</p>` : '')
    + `<div class="lt-line">${д.подписьПола}</div>${д.строкаПохож}`
    + `<p class="lt-sign">— ваш аист</p><i class="lt-seal" aria-hidden="true"></i></div><div class="acts">${д.acts}</div></div>`;
}

export function видПлодов(вид, д) {
  return вид === 'ultrasound' ? узи(д) : вид === 'nest' ? гнездо(д) : вид === 'letter' ? письмо(д) : '';
}

/* =====================================================================
   ПОСЛЕ РОДОВ
   д: { дней, с, молоко, кормление, видСлово, прошло, грудь, самочувствие, полы, словоПолов }
   ===================================================================== */

const ЖДАТЬ_ЦИКЛ = { breast: 180, mixed: 90, formula: 45 };
const строки = (д, класс) => [['Заживление', д.с && д.с.заживление], ['Выделения', д.с && д.с.выделения], ['Грудь', д.грудь], ['Самочувствие', д.самочувствие]]
  .filter(([, т]) => т).map(([к, т]) => `<li class="${класс}"><span>${к}</span><p>${applyTooltips(т)}</p></li>`).join('');
const циклТекстом = (д) => !д.с ? '' : д.с.циклВернулся ? 'цикл вернулся — снова можно забеременеть'
  : `цикл ещё не вернулся — шанс зачатия ×${String(д.с.плодовитость).replace('.', ',')}${д.кормление === 'breast' ? ' (кормление грудью — не гарантия!)' : ''}`;
const заголовокДней = (д) => д.дней === null ? 'После родов' : `${д.дней} ${скл(д.дней, 'день', 'дня', 'дней')} после родов`;

// Дневник: тетрадный лист с полем, календарь шести недель (прошедшие дни
// зачёркнуты, сегодня обведено), записи от руки и стикер про цикл.
function дневник(д) {
  const дн = д.дней ?? 0;
  const клетки = Array.from({ length: 42 }, (_, i) => `<i class="${i + 1 < дн ? 'is-past' : i + 1 === дн ? 'is-today' : ''}">${i + 1}</i>`).join('');
  const молоко = д.молоко ? `<li class="pj-n is-milk"><span>Молоко</span><p>${escapeHtml(д.молоко.стадия)} · ≈ ${д.молоко.вСутки} мл в сутки${д.молоко.слово ? ` · ${escapeHtml(д.молоко.слово)}` : ''}${д.прошло ? ` · ${д.прошло}` : ''}</p></li>`
    : д.видСлово ? `<li class="pj-n"><span>Кормление</span><p>${escapeHtml(д.видСлово)}</p></li>` : '';
  return `<div class="hud-pp hud-ppv hud-ppv-journal"><div class="pj-head"><b>${д.дней === null ? 'После родов' : `День ${д.дней}`}</b>`
    + `<small>${д.с ? escapeHtml(д.с.этап) : ''}${д.словоПолов ? ` · ${escapeHtml(д.словоПолов)}` : ''}</small></div>`
    + (д.дней !== null ? `<div class="pj-cal" aria-label="Шесть недель восстановления">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(с => `<b>${с}</b>`).join('')}${клетки}</div>`
      + (дн > 42 ? `<p class="pj-done">шесть недель позади ✓</p>` : '') : '')
    + `<ul class="pj-notes">${строки(д, 'pj-n')}${молоко}</ul>`
    + (д.с ? `<div class="pj-sticky${д.с.циклВернулся ? ' is-back' : ''}">${циклТекстом(д)}</div>` : '') + `</div>`;
}

// Кольца: восстановление, наполненность груди, возвращение цикла.
function кольца(д) {
  const дн = д.дней ?? 0;
  const ждать = ЖДАТЬ_ЦИКЛ[д.кормление] || 180;
  const список = [
    ['rec', 'Восстановление', Math.min(1, дн / 42), дн >= 42 ? 'шесть недель позади' : `${дн} из 42 дней`],
    д.молоко && д.молоко.полнота !== null ? ['milk', 'Грудь', д.молоко.полнота / 100, `${д.молоко.полнота}% · ${д.молоко.слово}`] : null,
    д.с ? ['cyc', 'Цикл', д.с.циклВернулся ? 1 : Math.min(.97, дн / ждать), д.с.циклВернулся ? 'вернулся' : `≈ через ${Math.max(1, ждать - дн)} ${скл(Math.max(1, ждать - дн), 'день', 'дня', 'дней')}`] : null,
  ].filter(Boolean);
  const дуги = список.map(([к, , доля], i) => {
    const R = 52 - i * 13;
    return `<circle class="trk" cx="60" cy="60" r="${R}"/><circle class="arc is-${к}" style="--i:${i}" cx="60" cy="60" r="${R}" pathLength="100" stroke-dasharray="${ф(доля * 100)} 100" transform="rotate(-90 60 60)"/>`;
  }).join('');
  return `<div class="hud-pp hud-ppv hud-ppv-rings"><div class="pr-top"><svg class="pr-rings" viewBox="0 0 120 120" aria-hidden="true">${дуги}`
    + `<text class="num" x="60" y="62">${д.дней ?? '—'}</text><text class="cap" x="60" y="76">${д.дней === null ? '' : скл(дн, 'день', 'дня', 'дней')}</text></svg>`
    + `<ul class="pr-legend"><li class="pr-title"><b>${заголовокДней(д)}</b>${д.с ? `<small>${escapeHtml(д.с.этап)}</small>` : ''}</li>`
    + список.map(([к, имя, , т]) => `<li class="is-${к}"><i aria-hidden="true"></i><span>${имя}</span><b>${escapeHtml(т)}</b></li>`).join('')
    + (д.молоко ? `<li class="is-note"><span>${escapeHtml(д.молоко.стадия)} · ≈ ${д.молоко.вСутки} мл в сутки${д.прошло ? ` · ${д.прошло}` : ''}</span></li>` : '') + `</ul></div>`
    + `<ul class="pr-rows">${строки(д, 'pr-row')}</ul></div>`;
}

// Бутылочки: две — наполненность груди, третья — суточная норма. Шесть
// недель восстановления — бодики на бельевой верёвке.
const БОДИ = 'M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.6 1.6-2.2 2.6-4 2.6S8.6 4.6 8 3Z';
function бутылочка(доля, подпись, мл, класс = '') {
  const id = новыйId('bt');
  const у = ф(80 - 58 * Math.max(0, Math.min(1, доля)));
  return `<figure class="pb-bottle${класс}"><svg viewBox="0 0 40 90" aria-hidden="true"><defs><clipPath id="${id}"><rect x="9" y="21" width="22" height="61" rx="6"/></clipPath></defs>`
    + `<path class="nip" d="M16.4 13c0-6 1.6-9.4 3.6-9.4s3.6 3.4 3.6 9.4Z"/><rect class="collar" x="10" y="12.6" width="20" height="8" rx="2"/>`
    + `<rect class="glass" x="9" y="21" width="22" height="61" rx="6"/>`
    + `<g clip-path="url(#${id})"><path class="milk" d="M0 ${у}q5-2 10 0t10 0 10 0 10 0V90H0Z"/></g>`
    + [30, 42, 54, 66].map(y => `<path class="mark" d="M24 ${y}h5"/>`).join('') + `<rect class="shine" x="12" y="25" width="3" height="50" rx="1.5"/></svg>`
    + `<figcaption><b>${подпись}</b>${мл ? `<small>${мл}</small>` : ''}</figcaption></figure>`;
}
function бутылочки(д) {
  const дн = д.дней ?? 0;
  const м = д.молоко;
  const верёвка = д.дней !== null ? `<div class="pb-line" aria-label="Шесть недель восстановления"><i class="rope" aria-hidden="true"></i>${Array.from({ length: 6 }, (_, i) => `<span class="${дн >= (i + 1) * 7 ? 'is-done' : дн >= i * 7 ? 'is-now' : ''}" style="--i:${i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${БОДИ}"/></svg><small>${i + 1} нед</small></span>`).join('')}</div>` : '';
  const полка = м ? `<div class="pb-shelf">${бутылочка((м.полнота ?? 40) / 100, 'Левая', `${м.полнота ?? '—'}%`)}${бутылочка(Math.max(0, (м.полнота ?? 40) - 8) / 100, 'Правая', `${Math.max(0, (м.полнота ?? 40) - 8)}%`)}`
    + `${бутылочка(Math.min(1, м.вСутки / 1000), 'В сутки', `≈ ${м.вСутки} мл`, ' is-day')}<div class="pb-info"><b>${escapeHtml(м.стадия)}</b><small>кормит ${escapeHtml(д.видСлово || '')}</small>`
    + (м.слово ? `<span class="pb-state${(м.полнота ?? 0) >= 80 ? ' is-hot' : (м.полнота ?? 0) >= 55 ? ' is-soon' : ''}">${escapeHtml(м.слово)}${д.прошло ? `<small>${д.прошло}</small>` : ''}</span>` : '') + `</div></div>`
    : д.видСлово ? `<p class="pb-formula">🍼 кормит ${escapeHtml(д.видСлово)}</p>` : '';
  return `<div class="hud-pp hud-ppv hud-ppv-bottles"><div class="pb-head"><b>${заголовокДней(д)}</b>${д.с ? `<small>${escapeHtml(д.с.этап)}</small>` : ''}</div>`
    + верёвка + полка + `<ul class="pb-rows">${строки(д, 'pb-row')}</ul>`
    + (д.с ? `<p class="pb-cycle${д.с.циклВернулся ? ' is-back' : ''}">${циклТекстом(д)}</p>` : '') + `</div>`;
}

export function видПослеродового(вид, д) {
  return вид === 'journal' ? дневник(д) : вид === 'rings' ? кольца(д) : вид === 'bottles' ? бутылочки(д) : '';
}

/* =====================================================================
   ТРЕКЕР «ДЕТСКОЙ»
   дети: [{ i, имя, вид, д, возраст, этап, рожд, след, тревоги, p, игрушки, вкл }]
   ===================================================================== */

const рожд = (р) => р.рожд ? `${р.рожд.точно ? '' : '≈ '}${р.рожд.дата}` : '';
const тревоги = (р) => р.тревоги.length ? `<span class="alerts">${р.тревоги.map(([тон, з, т]) => `<i class="is-${тон}" title="${escapeHtml(т)}">${з}</i>`).join('')}</span>` : '';
const кнопка = (р, класс, внутри) => `<button type="button" class="hud-kid-chip is-${р.вид}${р.вкл ? ' is-on' : ''} ${класс}" data-kid="${р.i}" style="--i:${р.i}">${внутри}</button>`;

// Полароиды на бечёвке с прищепками.
function полароиды(дети) {
  return `<div class="hud-kid-tracker hud-ktv is-polaroid"><i class="twine" aria-hidden="true"></i>${дети.map(р => кнопка(р, 'kp-card',
    `<i class="pin" aria-hidden="true"></i><span class="photo">${иконка(р.игрушки[р.i % р.игрушки.length][1], 'big')}${иконка(р.игрушки[(р.i + 1) % р.игрушки.length][1], 'small')}<em>${escapeHtml(р.этап)}</em></span>`
    + `<b class="name">${escapeHtml(р.имя)}</b><small>${escapeHtml(р.возраст)}</small>${рожд(р) ? `<small class="born">🎂 ${рожд(р)}</small>` : ''}${тревоги(р)}`)).join('')}</div>`;
}

// Деревянные кубики: на передней грани буква имени, сбоку игрушка.
function кубики(дети) {
  return `<div class="hud-kid-tracker hud-ktv is-blocks">${дети.map(р => {
    const буква = escapeHtml((р.имя.match(/[A-Za-zА-Яа-яЁё]/) || ['?'])[0].toUpperCase());
    return кнопка(р, 'kb-item', `<svg class="cube" viewBox="0 0 72 72" aria-hidden="true">`
      + `<path class="top" d="M36 4 66 18 36 32 6 18Z"/><path class="left" d="M6 18 36 32V68L6 54Z"/><path class="right" d="M66 18 36 32V68L66 54Z"/>`
      + `<path class="edge" d="M36 4 66 18 36 32 6 18ZM36 32V68M6 18V54L36 68 66 54V18"/>`
      + `<text class="letter" x="21" y="50" transform="skewY(25) translate(0 -10)">${буква}</text>`
      + `<g transform="translate(43 30) skewY(-25) scale(.82)"><path class="toy" d="${р.игрушки[0][1]}"/></g>`
      + `<circle class="dot" cx="36" cy="18" r="2.4"/><circle class="dot" cx="26" cy="15" r="1.4"/><circle class="dot" cx="46" cy="21" r="1.4"/></svg>`
      + `<span class="who"><b>${escapeHtml(р.имя)}</b><small>${escapeHtml(р.возраст)}</small>${рожд(р) ? `<small class="born">🎂 ${рожд(р)}</small>` : ''}${р.след ? `<em>скоро: ${escapeHtml(р.след)}</em>` : ''}${тревоги(р)}</span>`);
  }).join('')}</div>`;
}

// Ростомер: рост и вес по медианам ВОЗ для возраста и пола.
const РОСТ = { girl: [[0, 49.1], [91, 59.8], [182, 65.7], [365, 74], [730, 85.7], [1095, 95.1]], boy: [[0, 49.9], [91, 61.4], [182, 67.6], [365, 75.7], [730, 87.1], [1095, 96.1]] };
const ВЕС = { girl: [[0, 3.2], [91, 5.8], [182, 7.3], [365, 8.9], [730, 11.5], [1095, 13.9]], boy: [[0, 3.3], [91, 6.4], [182, 7.9], [365, 9.6], [730, 12.2], [1095, 14.3]] };
function поТаблице(т, д) {
  if (д <= т[0][0]) return т[0][1];
  for (let k = 1; k < т.length; k++) if (д <= т[k][0]) { const [a, va] = т[k - 1], [b, vb] = т[k]; return va + (vb - va) * (д - a) / (b - a); }
  return т[т.length - 1][1];
}
const поПолу = (табл, вид, д) => вид === 'girl' || вид === 'boy' ? поТаблице(табл[вид], д) : (поТаблице(табл.girl, д) + поТаблице(табл.boy, д)) / 2;
function ростомер(дети) {
  const низ = 40, верх = 100;
  const доля = (см) => Math.max(0, Math.min(100, (см - низ) / (верх - низ) * 100));
  const деления = [40, 50, 60, 70, 80, 90, 100].map(см => `<span style="bottom:${доля(см)}%"><b>${см}</b></span>`).join('');
  return `<div class="hud-kid-tracker hud-ktv is-growth"><div class="kg-wall"><div class="kg-ruler" aria-hidden="true">${деления}</div><div class="kg-kids">`
    + дети.map(р => {
      const см = р.д === null ? null : поПолу(РОСТ, р.вид, р.д), кг = р.д === null ? null : поПолу(ВЕС, р.вид, р.д);
      return кнопка(р, 'kg-kid', `<span class="bar" style="--h:${ф(см === null ? 10 : доля(см))}"><span class="head">${иконка(р.игрушки[0][1])}</span>`
        + (см !== null ? `<span class="tag">≈ ${Math.round(см)} см · ${String(Math.round(кг * 10) / 10).replace('.', ',')} кг</span>` : '') + `</span>`
        + `<span class="who"><b>${escapeHtml(р.имя)}</b><small>${escapeHtml(р.возраст)}</small>${тревоги(р)}</span>`);
    }).join('') + `</div></div><small class="kg-note">рост и вес — средние по ВОЗ для возраста, не мерка из сюжета</small></div>`;
}

export function видТрекера(вид, дети) {
  return вид === 'polaroid' ? полароиды(дети) : вид === 'blocks' ? кубики(дети) : вид === 'growth' ? ростомер(дети) : '';
}

/* =====================================================================
   ВЕХИ И УХОД
   д: { имя, вид, д, вехи:[{ключ,имя,день}], нужды:[[тон,з,т]], нормы:[[з,к,т]],
        игрушка, время, ел, спал, спит, подгузник, интервал }
   ===================================================================== */

// Значки вех — эмодзи не новее 12-й версии (Windows 10).
const ЗНАЧКИ_ВЕХ = { smile: '😊', head: '💪', laugh: '😂', roll: '🔄', sit: '🧸', tooth: '🦷', crawl: '🐛', stand: '🦵', babble: '💬', steps: '👣', words: '🗣', run: '🏃', phrase: '💭', potty: '🚽', talk: '📢' };
const вСрок = (дней) => дней < 14 ? `${дней} дн.` : дней < 60 ? `${Math.round(дней / 7)} нед.` : дней < 365 ? `${Math.round(дней / 30.4)} мес.` : `${String(Math.round(дней / 36.5) / 10).replace('.', ',')} г.`;
// Что всплывает по нажатию на веху: когда было или когда ждать.
export const подсказкаВехи = (в, д) => в.день <= д ? `${в.имя} — в ~${вСрок(в.день)}` : `${в.имя} — обычно в ~${вСрок(в.день)}, через ~${вСрок(в.день - д)}`;
const нуждыHTML = (д) => д.нужды.length ? `<div class="kc-needs">${д.нужды.map(([тон, з, т]) => `<span class="need is-${тон}"><i aria-hidden="true">${з}</i>${escapeHtml(т)}</span>`).join('')}</div>` : '';
const нормыHTML = (д) => `<ul class="kc-norms">${д.нормы.map(([з, к, т]) => `<li><i aria-hidden="true">${з}</i><b>${к}</b><span>${escapeHtml(т)}</span></li>`).join('')}</ul>`;

// Альбом наклеек: пройденные вехи — глянцевые наклейки, ближайшая — пустое
// место с пунктиром и сроком, дальние — бледные контуры.
function наклейки(д) {
  const r = генератор('st|' + д.имя);
  const след = д.вехи.find(в => в.день > д.д);
  const сделано = д.вехи.filter(в => в.день <= д.д).length;
  return `<div class="kc-view kc-stickers">${нуждыHTML(д)}<div class="ks-album"><div class="ks-head"><b>Альбом вех</b><small>${сделано} из ${д.вехи.length} наклеек</small></div><div class="ks-grid" lang="ru">`
    + д.вехи.map(в => {
      const сост = в.день <= д.д ? 'is-done' : в === след ? 'is-next' : 'is-later';
      return `<span class="ks-slot ${сост}" style="--tilt:${ф((r() - .5) * 14)}deg" data-fam-tip="${escapeHtml(подсказкаВехи(в, д.д))}">`
        + `<i class="ks-sticker" aria-hidden="true">${сост === 'is-later' ? '?' : ЗНАЧКИ_ВЕХ[в.ключ] || '★'}</i><small>${escapeHtml(в.имя)}</small>`
        + (сост === 'is-next' ? `<b>через ~${вСрок(в.день - д.д)}</b>` : сост === 'is-later' ? `<b>~${вСрок(в.день)}</b>` : '') + `</span>`;
    }).join('') + `</div></div>${нормыHTML(д)}</div>`;
}

// Сутки на циферблате: ночь затенена, стрелка — время сцены, отметки
// последнего кормления, следующего, сна и подгузника.
const вЧасы = (т) => { const m = String(т || '').match(/(\d{1,2})\s*[:.]\s*(\d{2})/); return m ? (+m[1] % 24) + (+m[2]) / 60 : null; };
const точка = (ч, R) => [60 + R * Math.sin(ч / 24 * Math.PI * 2), 60 - R * Math.cos(ч / 24 * Math.PI * 2)];
function сутки(д) {
  const сейчас = вЧасы(д.время), ел = вЧасы(д.ел), сон = вЧасы(д.спал), пг = вЧасы(д.подгузник);
  const следЕда = ел === null ? null : (ел + д.интервал) % 24;
  const [н1x, н1y] = точка(21, 50), [н2x, н2y] = точка(7, 50);
  const деления = Array.from({ length: 24 }, (_, ч) => { const [x1, y1] = точка(ч, 54), [x2, y2] = точка(ч, ч % 6 ? 51 : 48); return `<path d="M${ф(x1)} ${ф(y1)}L${ф(x2)} ${ф(y2)}"/>`; }).join('');
  const цифры = [0, 6, 12, 18].map(ч => { const [x, y] = точка(ч, 41); return `<text x="${ф(x)}" y="${ф(y + 3)}">${ч}</text>`; }).join('');
  // Значки близких по времени событий не наезжают: следующий уходит на
  // другое кольцо (30 → 18 → 40).
  const занято = [];
  const метка = (ч, знак, класс, подпись) => {
    if (ч === null) return '';
    const близко = (R) => занято.some(([ч2, R2]) => R2 === R && Math.min(Math.abs(ч - ч2), 24 - Math.abs(ч - ч2)) < 1.6);
    const R = [30, 18, 40].find(r => !близко(r)) || 30;
    занято.push([ч, R]);
    const [x, y] = точка(ч, R);
    return `<g class="mk ${класс}" data-fam-tip="${подпись} · ${чч(ч)}"><circle cx="${ф(x)}" cy="${ф(y)}" r="7.4"/><text x="${ф(x)}" y="${ф(y + 3.4)}">${знак}</text></g>`;
  };
  const стрелка = сейчас === null ? '' : (() => { const [x, y] = точка(сейчас, 46); return `<path class="hand" d="M60 60L${ф(x)} ${ф(y)}"/><circle class="hub" cx="60" cy="60" r="3.4"/>`; })();
  const чч = (ч) => ч === null ? '' : `${String(Math.floor(ч)).padStart(2, '0')}:${String(Math.round((ч % 1) * 60) % 60).padStart(2, '0')}`;
  const легенда = [
    ел !== null && ['🍼', 'ел', чч(ел)], следЕда !== null && ['⏳', 'следующее кормление', `≈ ${чч(следЕда)}`],
    сон !== null && [д.спит ? '😴' : '☀', д.спит ? 'уснул' : 'проснулся', чч(сон)], пг !== null && ['🧷', 'подгузник', чч(пг)],
  ].filter(Boolean);
  return `<div class="kc-view kc-clock"><div class="kk-top"><svg class="kk-dial" viewBox="0 0 120 120" aria-hidden="true">`
    + `<circle class="face" cx="60" cy="60" r="56"/><path class="night" d="M60 60L${ф(н1x)} ${ф(н1y)}A50 50 0 0 1 ${ф(н2x)} ${ф(н2y)}Z"/>`
    + `<g class="ticks">${деления}</g><g class="nums">${цифры}</g>`
    + (ел !== null && следЕда !== null ? (() => { const [ax, ay] = точка(ел, 22), [bx, by] = точка(следЕда, 22); return `<path class="gap" d="M${ф(ax)} ${ф(ay)}A22 22 0 ${д.интервал > 12 ? 1 : 0} 1 ${ф(bx)} ${ф(by)}"/>`; })() : '')
    + метка(ел, '🍼', 'is-fed', 'кормление') + метка(следЕда, '⏳', 'is-next', 'следующее кормление') + метка(сон, д.спит ? '🌙' : '☀', 'is-sleep', 'сон') + метка(пг, '🧷', 'is-diaper', 'подгузник')
    + стрелка + `</svg><div class="kk-side"><b class="kk-now">${сейчас === null ? 'время сцены не названо' : чч(сейчас)}</b>`
    + (легенда.length ? `<ul class="kk-legend">${легенда.map(([з, к, т]) => `<li><i aria-hidden="true">${з}</i><span>${к}</span><b>${т}</b></li>`).join('')}</ul>` : '')
    + нуждыHTML(д) + `</div></div>${нормыHTML(д)}</div>`;
}

// Настольная игра: вехи — клетки змейкой, фишка-малыш стоит на ближайшей.
function настолка(д) {
  const след = д.вехи.find(в => в.день > д.д);
  const всего = д.вехи.length;
  const клетки = д.вехи.map((в, k) => {
    const ряд = Math.floor(k / 5), кол = ряд % 2 ? 5 - (k % 5) : (k % 5) + 1;
    const сост = в.день <= д.д ? 'is-done' : в === след ? 'is-next' : '';
    return `<span class="kb-cell ${сост}" style="grid-row:${ряд + 1};grid-column:${кол}" data-fam-tip="${escapeHtml(подсказкаВехи(в, д.д))}"><small>${k + 1}</small><i aria-hidden="true">${ЗНАЧКИ_ВЕХ[в.ключ] || '★'}</i>`
      + (сост === 'is-next' ? `<b class="token" aria-hidden="true">${иконка(д.игрушка)}</b>` : '') + `</span>`;
  }).join('');
  return `<div class="kc-view kc-board">${нуждыHTML(д)}<div class="kb-board" style="--rows:${Math.ceil(всего / 5)}"><span class="kb-start">старт</span>${клетки}<span class="kb-finish">🎓</span></div>`
    + (след ? `<p class="kb-now">ход: <b>${escapeHtml(след.имя)}</b> — через ~${вСрок(след.день - д.д)}</p>` : `<p class="kb-now">все клетки пройдены 🎉</p>`)
    + `${нормыHTML(д)}</div>`;
}

export function видУхода(вид, д) {
  return вид === 'stickers' ? наклейки(д) : вид === 'clock' ? сутки(д) : вид === 'board' ? настолка(д) : '';
}
