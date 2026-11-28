// hud-manager/render/phone.js
//
// Сам аппарат и его приложения: домашний экран, кошелёк, календарь,
// контакты, галерея, заметки, карты, поиск.
//
// Переписки живут в messenger.js, разбор тегов сообщения — в
// msg-parts.js, значки — в icons.js, общая мелочь — в phone-common.js.

import { escapeHtml, defeatWI, hudHashSeed, guardTouchSwipe, sanitizeText, имяБезПриставки } from '../utils.js?v=23.90.13';
import { форматВремени } from '../units.js?v=23.90.13';
import { английский } from '../i18n.js?v=23.90.13';
import { settings } from '../settings.js?v=23.90.13';
import { HUD_AVATAR_COLORS, overrideAvatarUrl } from '../avatars.js?v=23.90.13';
import { G_ICONS } from './icons.js?v=23.90.13';
import { значокПриложения, естьНабор } from './phone-icons.js?v=23.90.13';
import { buildMessengerHTML } from './messenger.js?v=23.90.13';
import { avaFace, msgTimeOf, collectCounterparts, parseMsgParties, контактСНастоящимИменем } from './phone-common.js?v=23.90.13';
import { безШапокСообщения } from './msg-parts.js?v=23.90.13';
import { разобратьСообщение, сортироватьЧаты, непрочитанные, времяВСписке, моментПоследнего } from './msg-feed.js?v=23.90.13';
import { buildWeatherApp, buildCallsApp, buildHealthApp } from './phone-extra.js?v=23.90.13';
import { buildContactsApp, buildSearchApp, buildMapsApp } from './phone-apps.js?v=23.90.13';
import { buildCalendarApp } from './calendar.js?v=23.90.13';
import { приложениеМузыки } from './music.js?v=23.90.13';
import { временаСлухов, ключСлуха } from './rumor-times.js?v=23.90.13';


import { namesLikelySame, transliterateCyrillic } from '../names.js?v=23.90.13';

// Мессенджер как приложение телефона: возвращает только внутренности
// (полоса чатов + тела переписок), без обёртки вкладки.


// Служебные адресаты, которые не являются именем собеседника.



// --- Кошелёк ----------------------------------------------------------------
// Баланс и движения по счёту приходят от модели. Карты телефон рисует сам и
// всегда одинаково для одного владельца: и система, и последние цифры, и срок
// выведены из его имени. Так карта не «перевыпускается» каждый ход, но и не
// требует от модели придумывать номера, в которых она всё равно путается.

// Мелкий детерминированный генератор: одно и то же имя — одни и те же карты.
function walletRng(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a += 0x6D2B79F5; a >>>= 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

// Имя на карте печатают латиницей заглавными — как в жизни. Кириллица
// транслитерируется, латиница остаётся как есть, макрос {{char}} к этому
// моменту уже заменён на настоящее имя.
function cardHolder(owner) {
  const raw = имяБезПриставки(String(owner || '').replace(/\{\{[^}]*\}\}/g, ' ').trim());
  if (!raw) return 'CARD HOLDER';
  const latin = /[а-яё]/i.test(raw) ? transliterateCyrillic(raw) : raw;
  const words = String(latin).toUpperCase().replace(/[^A-Z\s-]/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ') || 'CARD HOLDER';
}

const CARD_SYSTEMS = [
  { name: 'VISA',       tone: 'visa' },
  { name: 'MASTERCARD', tone: 'mc' },
  { name: 'МИР',        tone: 'mir' },
  { name: 'UNION',      tone: 'union' },
];

// Платёжные системы — по валюте кошелька. «МИР» раньше выпадал любому
// владельцу — и в фэнтези с золотом, и в английском интерфейсе. Валюта
// выдуманная или не названа — карта без бренда: в чужом мире VISA и МИР
// так же неуместны.
export function системыКарт(currency) {
  const c = String(currency || '').trim().toLowerCase();
  if (/₽|руб|rub|\bр\.?$/.test(c)) return [0, 1, 2];
  if (/[$€£]|usd|eur|gbp|доллар|евро|фунт|dollar|euro|pound|cad|aud|chf|франк/.test(c)) return [0, 1];
  if (/[¥元]|cny|rmb|юан|yuan/.test(c)) return [3, 0];
  if (/jpy|иен|yen|₩|krw|вон|won|₹|inr|руп|₸|тенге|kzt|₴|грив|uah|byn|бел\.? руб/.test(c)) return [0, 1];
  return [];
}

function walletCards(owner, currency) {
  const rnd = walletRng(hudHashSeed(String(owner || 'owner')) + 7);
  const count = rnd() < 0.45 ? 2 : 1;
  const cards = [];
  const used = new Set();
  const свои = системыКарт(currency);
  for (let i = 0; i < count; i++) {
    let si = Math.floor(rnd() * Math.max(1, свои.length));
    while (used.has(si) && used.size < свои.length) si = (si + 1) % свои.length;
    used.add(si);
    const sys = свои.length ? CARD_SYSTEMS[свои[si]] : { name: '', tone: 'plain' };
    const last4 = String(1000 + Math.floor(rnd() * 9000));
    const mm = String(1 + Math.floor(rnd() * 12)).padStart(2, '0');
    const yy = String(26 + Math.floor(rnd() * 6));
    cards.push({ system: sys.name, tone: sys.tone, last4, expiry: mm + '/' + yy });
  }
  return cards;
}

// «18400» → «18 400». Пробелы неразрывные, иначе число ломается по строкам.
export function money(v) {
  const raw = String(v == null ? '' : v).trim();
  const m = raw.match(/^([+-]?)\s*(\d+)([.,]\d+)?/);
  if (!m) return raw;
  // Разряды: в английском интерфейсе — запятая (1,245), в русском — пробел.
  const groups = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, английский() ? ',' : '\u00A0');
  return m[1] + groups + (m[3] ? m[3].replace(',', '.') : '');
}

function buildWalletApp(wallet, owner) {
  const w = wallet || {};
  const tx = Array.isArray(w.transactions) ? w.transactions : [];
  if (!w.balance && !tx.length) return emptyApp(G_ICONS.card, 'Счёт пока не заведён');
  const holder = cardHolder(owner);
  const cards = walletCards(owner, w.currency).map(c => `
    <div class="hud-wallet-card tone-${c.tone}">
      ${c.system ? `<span class="hud-wallet-sys">${escapeHtml(c.system === 'МИР' && английский() ? 'MIR' : c.system)}</span>` : ''}
      <span class="hud-wallet-chip"></span>
      <span class="hud-wallet-num">•••• •••• •••• ${escapeHtml(c.last4)}</span>
      <span class="hud-wallet-holder">${escapeHtml(holder)}</span>
      <span class="hud-wallet-exp">${escapeHtml(c.expiry)}</span>
    </div>`).join('');

  const rows = tx.map(t => {
    const amount = String(t.amount || '').trim();
    const minus = /^-/.test(amount);
    return `<div class="hud-wallet-tx ${minus ? 'is-out' : 'is-in'}">
      <span class="hud-wallet-tx-title">${defeatWI(escapeHtml(t.title || 'Операция'))}${t.note ? `<small>${escapeHtml(t.note)}</small>` : ''}</span>
      <span class="hud-wallet-tx-side">
        <b>${escapeHtml(money(amount))}</b>
        ${t.time ? `<small>${escapeHtml(t.time)}</small>` : ''}
      </span>
    </div>`;
  }).join('');

  return `<div class="hud-wallet">
    <div class="hud-wallet-balance">
      <small>Баланс счёта</small>
      <b>${escapeHtml(money(w.balance))}${w.currency ? ` <i>${escapeHtml(w.currency)}</i>` : ''}</b>
      <em>${escapeHtml(holder)}</em>
    </div>
    <div class="hud-wallet-cards">${cards}</div>
    ${rows ? `<div class="hud-wallet-tx-head">Операции</div><div class="hud-wallet-tx-list">${rows}</div>`
            : '<div class="hud-wallet-tx-head">Операций пока не было</div>'}
  </div>`;
}

// --- Календарь ---------------------------------------------------------------
// Живёт в render/calendar.js; отсюда его по-прежнему берёт альманах
// (render/medieval.js).
export { buildCalendarApp, parseDayMonth } from './calendar.js?v=23.90.13';
import { ближайшиеДела } from './calendar.js?v=23.90.13';

// Слухи города: то, что модель и так пишет в мир, — последние десять, свежие
// сверху. Экран — анонимная лента соцсети. Два раздела вкладками
// (радиокнопками, без скриптов): «Говорят» — цветные карточки, как в
// анонимных городских лентах, с голосом ▲▼; «Пишут в сети» — посты с
// ответами, репостами и сердцем. Голос и сердце нажимаются (radio/checkbox,
// без скриптов): число прибавляется на единицу. Счётчики — из текста записи,
// одно и то же у одной записи; это убранство, модель их не пишет.
// Автор поста скрыт до нажатия, поэтому и аватарка — не по нику, а по тексту.
const ШЁПОТ = '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2c0-3.5 3.3-6.2 7.6-6.2s7.6 2.7 7.6 6.2-3.3 6.2-7.6 6.2c-.9 0-1.8-.1-2.6-.4L5 19l1.1-3.3A5.8 5.8 0 0 1 4 11.2Z"/><path d="M8.6 11.3h.01M11.6 11.3h.01M14.6 11.3h.01" stroke-width="2.4" stroke-linecap="round"/></svg>';
// Аноним в ленте: голова по центру круга, плечи уходят за нижний край —
// как пустая аватарка в любой соцсети. Свой рисунок, а не значок «person»:
// тот мелкий и висел ниже центра.
const СИЛУЭТ = '<svg class="hud-rf-sil" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="11" r="5.2"/><path d="M3.6 29.5c.7-6.6 4.9-10.4 10.4-10.4s9.7 3.8 10.4 10.4z"/></svg>';
const РФ = (тело) => `<svg class="hud-rf-ico" viewBox="0 0 24 24" aria-hidden="true">${тело}</svg>`;
const РФ_И = {
  up: РФ('<path d="m6 14.5 6-6 6 6"/>'),
  down: РФ('<path d="m6 9.5 6 6 6-6"/>'),
  reply: РФ('<path d="M20 11.6c0 4-3.6 7-8 7-1.2 0-2.3-.2-3.3-.6L4 19.5l1.3-3.7C4.5 14.6 4 13.2 4 11.6c0-4 3.6-7 8-7s8 3 8 7z"/>'),
  repost: РФ('<path d="M7 18.5 4 15.5l3-3"/><path d="M4 15.5h11a4 4 0 0 0 4-4V10"/><path d="m17 5.5 3 3-3 3"/><path d="M20 8.5H9a4 4 0 0 0-4 4V14"/>'),
  heart: РФ('<path d="M12 19.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 6.8a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10-7.5 10z"/>'),
  pin: РФ('<path d="M12 20.5s6.5-5.6 6.5-10.8a6.5 6.5 0 0 0-13 0c0 5.2 6.5 10.8 6.5 10.8z"/><circle cx="12" cy="9.8" r="2.4"/>'),
  fire: РФ('<path d="M12 20.5c3.6 0 6-2.4 6-5.7 0-3.4-2.5-5.2-3.4-8.3-1.6 1.2-2.4 2.7-2.4 4.3-1.2-.8-1.9-2-2-3.6C7.8 8.8 6 11.4 6 14.8c0 3.3 2.4 5.7 6 5.7z"/>'),
  bolt: РФ('<path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12z"/>'),
};
// Цвета карточек «Говорят»: насыщенные, но не светлые — белый текст читается
// и на тёмной, и на светлой теме.
const ЦВЕТА_СЛУХОВ = [['#e0607e', '#b8405f'], ['#ee8a3a', '#c9631d'], ['#3d9fd4', '#2677ad'], ['#4caf6a', '#2f8a4c'], ['#9468e3', '#6f45c4'], ['#d0942a', '#a36d12'], ['#2fb2a8', '#1b8a82']];
// Число на счётчике и оно же +1 (−1): какое видно, решает отмеченная кнопка.
const счёт = (n, ...ещё) => [n, ...ещё].map((v, i) => `<b class="s${i}">${v}</b>`).join('');
// Время записей — render/rumor-times.js: дата и час хода, где запись
// появилась впервые, минуты и секунды — свои у каждой, не позже того хода.
// Списки идут от свежих к старым по этому времени.
function buildRumorsApp(rumors, talk, uid = '', { впервые = null, сцена = null, запомнить = true, место = '' } = {}) {
  const сырыеСлухи = (Array.isArray(rumors) ? rumors : []).filter(Boolean).slice(-10).reverse();
  const сырыеРечи = (Array.isArray(talk) ? talk : []).filter(Boolean).slice(-10).reverse();
  if (!сырыеСлухи.length && !сырыеРечи.length) return emptyApp(G_ICONS.chat, 'Город пока молчит');
  // Времена — для каждой ленты отдельно и от старых к новым (rumor-times.js).
  const времена = new Map([...временаСлухов([...сырыеСлухи].reverse().map(String), впервые, сцена, { запомнить }), ...временаСлухов([...сырыеРечи].reverse().map(String), впервые, сцена, { запомнить })]);
  const поВремени = (список) => список.map((с, i) => ({ с, i, в: времена.get(ключСлуха(с)) || null }))
    .sort((a, b) => (a.в && b.в ? (b.в.ход - a.в.ход) || (b.в.секунды - a.в.секунды) || (a.i - b.i) : a.i - b.i));
  const слухи = поВремени(сырыеСлухи), речи = поВремени(сырыеРечи);
  const id = 'hud-rumors-' + (uid || hudHashSeed(сырыеСлухи.join('|') + сырыеРечи.join('|')).toString(36));
  // В ленте секунды лишние: «12.03 · 20:58», полное время — в подсказке.
  const метка = (в) => { if (!в) return ''; const полное = [в.дата, в.время].filter(Boolean).join(' · '); return `<time class="hud-rf-time" title="${escapeHtml(полное)}">${escapeHtml(полное.replace(/(\d{1,2}:\d{2}):\d{2}$/, '$1'))}</time>`; };

  const карточкиСлухов = слухи.map(({ с, в }, i) => {
    const т = String(с), з = hudHashSeed(т);
    const [c1, c2] = ЦВЕТА_СЛУХОВ[з % ЦВЕТА_СЛУХОВ.length];
    const голоса = 3 + (з >> 4) % 140, ответы = (з >> 9) % 31;
    const к = `${id}-v${i}`;
    return `<li class="hud-rf-card${i ? '' : ' is-fresh'}" style="--c1:${c1};--c2:${c2};--hot:${1000 - голоса}">
      <div class="hud-rf-main">
        <div class="hud-rf-meta">${i ? `${РФ_И.pin}<span>рядом</span>` : '<span class="hud-rf-new">свежее</span>'}${метка(в)}</div>
        <p>${defeatWI(escapeHtml(т))}</p>
        <div class="hud-rf-foot"><span>${РФ_И.reply}${ответы}</span></div>
      </div>
      <div class="hud-rf-vote"><input type="radio" class="hud-rf-in u" name="${к}" id="${к}u"><input type="radio" class="hud-rf-in d" name="${к}" id="${к}d">
        <label for="${к}u" title="Верю">${РФ_И.up}</label><span class="hud-rf-score">${счёт(голоса, голоса + 1, голоса - 1)}</span><label for="${к}d" title="Не верю">${РФ_И.down}</label></div>
    </li>`;
  }).join('');

  const карточкиРечей = речи.map(({ с, в }, i) => {
    const м = String(с).match(/^([^:\n]{1,40}):\s*([\s\S]+)$/);
    const текст = м ? м[2].trim() : String(с);
    const зерно = hudHashSeed(текст);
    const цвет = HUD_AVATAR_COLORS[зерно % HUD_AVATAR_COLORS.length];
    const номер = String(1000 + зерно % 9000);
    const ответы = (зерно >> 5) % 24, репосты = (зерно >> 10) % 37, сердца = 2 + (зерно >> 15) % 260;
    const к = `${id}-l${i}`;
    return `<li class="hud-rf-post" style="--hot:${1000 - сердца}">
      <span class="hud-rf-ava" style="--ava:${цвет}">${СИЛУЭТ}</span>
      <div class="hud-rf-body">
        <div class="hud-rf-head">${м
          ? `<details class="hud-rumor-author" data-reveal="1"><summary>Аноним</summary><span>${defeatWI(escapeHtml(м[1].trim()))}</span></details>`
          : '<b class="hud-rumor-author">Аноним</b>'}<span class="hud-rf-no">#${номер}</span>${метка(в)}</div>
        <p>${defeatWI(escapeHtml(текст))}</p>
        <div class="hud-rf-acts"><span>${РФ_И.reply}${ответы}</span><label class="hud-rf-rp" title="Репост"><input type="checkbox" class="hud-rf-in">${РФ_И.repost}<span class="hud-rf-score">${счёт(репосты, репосты + 1)}</span></label><input type="checkbox" class="hud-rf-in" id="${к}"><label for="${к}" class="hud-rf-like" title="Нравится">${РФ_И.heart}<span class="hud-rf-score">${счёт(сердца, сердца + 1)}</span></label></div>
      </div>
    </li>`;
  }).join('');

  const раздел = (к, иконка, заголовок, коротко, n) => `<label for="${id}-${к}" class="t-${к}" title="${заголовок}">${иконка}<span class="hud-rumors-l">${заголовок}</span><span class="hud-rumors-s">${коротко}</span><span class="hud-rumors-n">${n}</span></label>`;
  const оба = слухи.length && речи.length;
  const вкладки = оба
    ? `<input type="radio" name="${id}" id="${id}-say" class="hud-rumors-in is-say" checked><input type="radio" name="${id}" id="${id}-net" class="hud-rumors-in is-net">
      <div class="hud-rumors-tabs">${раздел('say', ШЁПОТ, 'Говорят', 'Говорят', слухи.length)}${раздел('net', G_ICONS.chat, 'Пишут в сети', 'В сети', речи.length)}</div>`
    : `<h4 class="hud-rumors-title">${слухи.length ? ШЁПОТ + '<span>Говорят</span>' : G_ICONS.chat + '<span>Пишут в сети</span>'}</h4>`;
  // Лента — рядом с владельцем: улица из его «Места», как у городских анонимных лент.
  const где = String(место || '').split(/[,;(]/).map(ч => ч.trim()).filter(ч => /\p{L}/u.test(ч)).pop() || '';
  const шапка = `<div class="hud-rf-top"><span class="hud-rf-logo" aria-hidden="true">${ШЁПОТ}</span><span class="hud-rf-place">${РФ_И.pin}<span>${где ? `<span>Рядом</span> · <b data-i18n-skip>${defeatWI(escapeHtml(где))}</b>` : 'Рядом с вами'}</span></span><span class="hud-rf-live" aria-hidden="true"><span></span>онлайн</span></div>`;
  // «Горячее» — по голосам и сердцам (order в CSS), «Новое» — как пришло.
  const сорт = слухи.length > 1 || речи.length > 1 ? `<div class="hud-rf-sort"><label><input type="radio" class="hud-pa-in hud-rf-new-in" name="${id}-s" checked>${РФ_И.bolt}<span>Новое</span></label><label><input type="radio" class="hud-pa-in hud-rf-hot" name="${id}-s">${РФ_И.fire}<span>Горячее</span></label></div>` : '';
  return `<div class="hud-rumors hud-rf${оба ? ' has-tabs' : ''}">${шапка}${вкладки}${сорт}${слухи.length ? `<ol class="hud-rumors-say">${карточкиСлухов}</ol>` : ''}${речи.length ? `<ol class="hud-rumors-net">${карточкиРечей}</ol>` : ''}</div>`;
}

// Перегенерация одного телефона (regen.js, phone-regen.js): крошечный значок
// в строке состояния, рядом со связью и батареей. Повторное нажатие отменяет,
// прежний телефон — в «↶» на карточке, как у перегенерации всего HUD.
const КНОПКА_РЕГЕНА = '<span class="hud-regen-btn hud-phone-regen" role="button" tabindex="0" title="Перегенерировать только телефон" aria-label="Перегенерировать только телефон"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v3.9h-3.9"/></svg></span>';

// Часы блокировки. Цифры разбиты на части, а циферблат лежит рядом: какой из
// видов показать, решают стили, поэтому смена вида не требует перерисовки.
function часыБлокировки(время) {
  const м = String(время || '').match(/(\d{1,2}):(\d{2})/);
  // 12-часовой формат: на экране блокировки, как у настоящего телефона, — без AM/PM.
  const час = м && форматВремени() === '12' ? String((+м[1] % 12) || 12) : м && м[1];
  const цифры = м ? `<span class="h">${час}</span><i class="c">:</i><span class="m">${м[2]}</span>` : '--:--';
  const минуты = м ? +м[2] : 0, часы = м ? (+м[1] % 12) + минуты / 60 : 0;
  const риски = Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="5" x2="50" y2="${i % 3 ? 9 : 13}" transform="rotate(${i * 30} 50 50)"/>`).join('');
  return `<div class="hud-phone-lock-time">${цифры}</div><svg class="hud-phone-lock-analog" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48"/><g class="t">${риски}</g><line class="hh" x1="50" y1="52" x2="50" y2="27" transform="rotate(${часы * 30} 50 50)"/><line class="mm" x1="50" y1="54" x2="50" y2="14" transform="rotate(${минуты * 6} 50 50)"/><circle class="p" cx="50" cy="50" r="2.6"/></svg>`;
}

const ДЕЛО_ИКОНКА = (д) => д.тип === 'birthday' ? '<i class="hud-phone-next-dot is-birthday"></i>' : '<i class="hud-phone-next-dot"></i>';

// --- Экраны приложений ------------------------------------------------------
// Каждый билдер получает свой кусок data.phone и возвращает внутренности
// .hud-phone-app-view. Пустая секция отдаёт '' — вызывающий подставит заглушку.

export function emptyApp(icon, text) {
  return `<div class="hud-phone-empty-app"><div class="hud-phone-empty-icon">${icon}</div><div class="hud-phone-empty-line">${escapeHtml(text)}</div></div>`;
}

function buildGalleryApp(gallery) {
  if (!gallery || !gallery.length) return emptyApp(G_ICONS.image, 'В галерее пока пусто');
  return `<div class="hud-phone-gallery-grid">` + gallery.map(p => `
    <details class="hud-phone-photo-card">
      <summary>
        <div class="hud-phone-photo-placeholder" style="--shot: ${HUD_AVATAR_COLORS[hudHashSeed(p.title || "") % HUD_AVATAR_COLORS.length]}">🖼️</div>
        ${p.time ? `<span class="hud-phone-photo-time">${escapeHtml(p.time)}</span>` : ''}
      </summary>
      <div class="hud-phone-photo-info">
        <b>${escapeHtml(p.title || 'Без названия')}</b>
        ${p.desc ? `<div>${escapeHtml(p.desc)}</div>` : ''}
        ${p.meta ? `<em>${escapeHtml(p.meta)}</em>` : ''}
      </div>
    </details>`).join('') + `</div>`;
}

function buildNotesApp(notes) {
  if (!notes || !notes.length) return emptyApp(G_ICONS.note, 'Заметок нет');
  return notes.map(n => `<div class="hud-phone-note">
    <b>${escapeHtml(n.title || 'Без названия')}</b>
    ${n.time ? `<small>${escapeHtml(n.time)}</small>` : ''}
    ${n.text ? `<p>${escapeHtml(n.text)}</p>` : ''}
    ${n.footer ? `<footer>${escapeHtml(n.footer)}</footer>` : ''}
  </div>`).join('');
}

// --- Телефон целиком --------------------------------------------------------

// Обои у каждого владельца свои (render/phone-settings.js, обоиТелефонов):
// корпус несёт ключ владельца — тот же расчёт, что у ключФонаЧата.
const ключОбоев = (владелец) => hudHashSeed(String(владелец || '').trim().toLowerCase()).toString(36);

// доп: { scene, world } — для «Погоды»; журнал звонков лежит в phone.callLog.
export function buildPhoneTabsHTML(chatsMap, uid, isChecked, mainCharName, phoneData, sceneDate, sceneTime, characters, доп = {}) {
  const phone = phoneData && typeof phoneData === 'object' ? phoneData : {};
  // Переписки — от свежих к старым, как в любом мессенджере. Порядок задаём
  // один раз здесь: по нему идут и список чатов, и стопка уведомлений.
  chatsMap = сортироватьЧаты(chatsMap, sceneDate);
  const chatCount = Object.keys(chatsMap || {}).length;
  // Владелец телефона. Приоритет: явное поле phone.owner → самый частый
  // owner среди переписок → имя персоны как последний фолбэк.
  // Раньше здесь всегда стояла персона игрока, из-за чего телефон Дамиана
  // подписывался именем Мари.
  const ownerVotes = Object.create(null);
  Object.values(chatsMap || {}).forEach(c => {
    const o = String((c && c.owner) || '').trim();
    if (!o || /^(empty|none)$/i.test(o)) return;
    ownerVotes[o] = (ownerVotes[o] || 0) + 1;
  });
  const topChatOwner = Object.keys(ownerVotes).sort((a, b) => ownerVotes[b] - ownerVotes[a])[0] || '';
  const phoneOwner = (phone.owner && !/^(empty|none)$/i.test(phone.owner) ? phone.owner : '') || topChatOwner || mainCharName || '';

  // Мессенджер собираем уже зная владельца: он задаёт и подпись, и сторону пузырей.
  const messenger = buildMessengerHTML(chatsMap, uid, phoneOwner, sceneDate, phone.contacts);


  // Часы телефона — те же, что на плашке погоды: одно время сцены на весь HUD.
  // Прежде здесь брали последнюю встреченную метку из переписок, а порядок
  // обхода чатов произвольный — на экране оказывалось время случайного
  // сообщения. Переписки оставляем запасным вариантом: если во «Времени» сцены
  // часов нет, лучше показать хоть что-то осмысленное, чем «--:--».
  const sceneClock = String(sceneTime || '').match(/\b\d{1,2}:\d{2}\b/);
  let latestTime = sceneClock ? sceneClock[0] : '';
  if (!latestTime) {
    Object.values(chatsMap || {}).forEach(c => {
      (Array.isArray(c && c.messages) ? c.messages : []).forEach(m => {
        const t = msgTimeOf(m);
        if (t) latestTime = t;
      });
    });
  }

  // Значок непрочитанного на иконке «Сообщения».
  // Счёт тот же, что у строк списка и уведомлений (msg-feed.js).
  const владелецЧата = (c) => { const o = String((c && c.owner) || '').trim(); return o && !/^(empty|none)$/i.test(o) ? o : phoneOwner; };
  let unread = 0;
  Object.values(chatsMap || {}).forEach(c => { unread += непрочитанные(c && c.messages, владелецЧата(c)).length; });

  // Каждое приложение можно выключить в настройках. Выключенное не строится
  // вовсе: ни плитки на домашнем экране, ни экрана под ней. Настройка задана
  // от обратного (!== false), чтобы старые сохранённые настройки, где этих
  // ключей ещё нет, вели себя как «всё включено».
  const on = (key) => settings[key] !== false;
  // Переписка от лица игрока (user-chat-ui.js): карандаш «Новое сообщение».
  const пишет = settings.userChat !== false;
  // Где сейчас владелец: для «Погоды» и отметки «Вы здесь» на карте.
  const владелецКарточка = (Array.isArray(characters) ? characters : []).find(c => c && c['Имя'] && namesLikelySame(c['Имя'], phoneOwner));
  const местоВладельца = владелецКарточка ? String(владелецКарточка['Место'] || '').trim() : '';
  // Пропущенные сегодня — значком на «Звонках»; журнал считает их сам.
  const экранЗвонков = on('phoneAppCalls') ? buildCallsApp(chatsMap, phone.callLog, phoneOwner, sceneDate, uid, phone.contacts) : '';
  const пропущенных = (экранЗвонков.match(/hud-calls-row [^"]*kind-miss/g) || []).length;
  // С кем из контактов есть личная переписка: «Избранное» и «Написать» в
  // «Контактах» открывают её. Имя чата — тот же разбор, что у уведомлений;
  // индекс — тот же, что у строки чата в messenger.js (subchat-uid-idx).
  const чатыКонтактов = on('phoneAppMessages') ? Object.keys(chatsMap || {}).map((rawName, idx) => {
    const c = chatsMap[rawName] || {};
    if (c.participants) return null;
    const владелец = владелецЧата(c);
    let имя = sanitizeText(rawName).trim();
    if (!имя || namesLikelySame(имя, владелец)) { const те = collectCounterparts(Array.isArray(c.messages) ? c.messages : [], владелец); имя = те.length === 1 ? те[0] : ''; }
    return имя ? { имя, цель: `subchat-${uid}-${idx}` } : null;
  }).filter(Boolean) : [];
  const apps = [
    on('phoneAppCalls') && { id: 'calls',    icon: G_ICONS.handset, label: 'Звонки', badge: пропущенных,
      body: экранЗвонков },
    on('phoneAppWeather') && { id: 'weather', icon: G_ICONS.weather, label: 'Погода', body: buildWeatherApp(доп.scene, доп.world, местоВладельца) },
    on('phoneAppHealth') && { id: 'health', icon: G_ICONS.health, label: 'Здоровье', body: buildHealthApp(phone, доп.scene, characters, phoneOwner, доп.user) },
    on('phoneAppMessages') && { id: 'messages', icon: G_ICONS.chat, label: 'Сообщения', badge: unread,
      body: messenger || (emptyApp(G_ICONS.chat, 'В текущем повествовании нет переписок') + (пишет ? `<button type="button" class="hud-uc-start" data-uc="new">${G_ICONS.pen}<span>Написать · ${escapeHtml(имяБезПриставки(phoneOwner))}</span></button>` : '')) },
    on('phoneAppContacts') && { id: 'contacts', icon: G_ICONS.person, label: 'Контакты',  body: buildContactsApp(phone.contacts, { владелец: имяБезПриставки(phoneOwner), чаты: чатыКонтактов }) },
    on('phoneAppWallet') && { id: 'wallet',   icon: G_ICONS.card, label: 'Кошелёк',   body: buildWalletApp(phone.wallet, phoneOwner) },
    on('phoneAppCalendar') && { id: 'calendar', icon: G_ICONS.cal, label: 'Календарь', body: buildCalendarApp(phone.calendar, characters, sceneDate, phoneOwner) },
    on('phoneAppGallery') && { id: 'gallery',  icon: G_ICONS.image, label: 'Галерея',   body: buildGalleryApp(phone.gallery) },
    on('phoneAppNotes') && { id: 'notes',    icon: G_ICONS.note, label: 'Заметки',   body: buildNotesApp(phone.notes) },
    on('phoneAppMaps') && { id: 'maps',     icon: G_ICONS.map, label: 'Карты',     body: buildMapsApp(phone.maps, местоВладельца, uid) },
    on('phoneAppSearch') && { id: 'search',   icon: G_ICONS.glass, label: 'Поиск',     body: buildSearchApp(phone.search) },
    on('phoneAppRumors') && settings.enableWorld !== false && { id: 'rumors', icon: G_ICONS.people, label: 'Слухи', body: buildRumorsApp(phone.rumors && phone.rumors.length ? phone.rumors : (доп.world && доп.world.rumors), phone.cityTalk && phone.cityTalk.length ? phone.cityTalk : (доп.world && доп.world.comments), uid,
      { место: местоВладельца, впервые: phone.__слухиВпервые || null, сцена: { дата: sceneDate, время: sceneTime, ход: Number.isInteger(доп.mesId) ? доп.mesId : undefined }, запомнить: Number.isInteger(доп.mesId) && доп.mesId >= 0 }) },
    // «Музыка» (render/music.js) — что слушает владелец; подбирается вместе с
    // музыкой сцены, поэтому живёт, только пока та включена.
    settings.enableMusic === true && on('phoneAppMusic') && Number.isInteger(доп.mesId) && { id: 'music', icon: G_ICONS.music, label: 'Музыка', body: приложениеМузыки(доп.mesId, phoneOwner) },
    on('phoneAppSettings') && { id: 'settings', icon: G_ICONS.gear, label: 'Настройки', body: '<div data-pset-host="1"></div>' },
  ].filter(Boolean);

  // Обычный значок остаётся в разметке: набор ложится поверх и может уехать.
  const сНабором = естьНабор();
  const grid = apps.map(a => { const значок = значокПриложения(a.id, ''); return `<button class="hud-phone-app" data-phone-app="${a.id}" data-phone-uid="${uid}">
    <span${сНабором && значок ? ' class="has-pi"' : ''}>${значок}${a.icon}${a.badge ? `<i class="hud-unread-badge">${a.badge}</i>` : ''}</span>
    <small>${escapeHtml(a.label)}</small>
  </button>`; }).join('');

  const views = apps.map(a => `<div class="hud-phone-app-view" data-phone-view="${a.id}" data-phone-uid="${uid}">
    <div class="hud-phone-app-title"><span class="hud-phone-back" role="button" tabindex="0" aria-label="Назад" title="Назад">⟨</span>${a.icon} ${escapeHtml(a.label)}<span class="hud-phone-app-owner">${escapeHtml(имяБезПриставки(phoneOwner))}</span>${a.id === 'messages' && пишет ? `<span class="hud-uc-new" data-uc="new" role="button" tabindex="0" aria-label="Новое сообщение" title="Новое сообщение">${G_ICONS.pen}</span>` : ''}</div>
    ${a.body}
  </div>`).join('');

  // Стопка уведомлений на домашнем экране: карточка на каждый чат с
  // непрочитанным, новые сверху, задние выглядывают со сдвигом и уменьшением.
  // Данные те же, что в списке чатов: аватарка по хэшу имени, название, превью.
  // Без модуля «Сообщения» переписок на телефоне нет вовсе: ни стопки на
  // домашнем экране, ни строк на экране блокировки. Иначе уведомление вело бы
  // в экран, которого больше не существует.
  const notifItems = [];
  (on('phoneAppMessages') ? Object.keys(chatsMap || {}) : []).forEach((rawName, chatIdx) => {
    const c = chatsMap[rawName] || {};
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    const непроч = непрочитанные(msgs, владелецЧата(c));
    const unreadHere = непроч.length;
    let lastTime = '', lastText = '', lastSender = '', момент = -Infinity;
    if (!unreadHere) return;

    // Берём последнее непрочитанное — именно оно всплывает уведомлением, и
    // время на карточке его. Прежде бралось первое «чч:мм» в строке, а оно
    // бывает и в тексте («Встреча в 09:15»).
    {
      const i = непроч[непроч.length - 1];
      const s = String(msgs[i]);
      lastTime = времяВСписке(msgs, i, sceneDate, { сЧасами: true });
      момент = моментПоследнего([s], sceneDate);
      const parties = parseMsgParties(s);
      lastSender = parties.sender || '';
      const body = разобратьСообщение(s).текст;
      lastText = безШапокСообщения(body).replace(/\[(?:VIDEO|ВИДЕО|VID|РОЛИК)[ _]?\d{0,2}:?\d{0,2}\s*:?\s*[^\]]*\]/gi, '🎬 Видео')
                     .replace(/\[(?:VOICE|ГОЛОС)_?\d{0,2}:?\d{0,2}\]/gi, '🎤 Голосовое сообщение')
                     .replace(/\[(?:PHOTO|ФОТО|IMG|СНИМОК)\s*:?\s*[^\]]*\]/gi, '📷 Фото')
                     .replace(/\[(?:CALL|ЗВОНОК)\s*:?\s*([^\]]*)\]/gi, (_, b) => /пропущ|missed|no answer/i.test(b) ? '📞 Пропущенный звонок' : /отклон|declined|rejected/i.test(b) ? '📞 Отклонённый звонок' : '📞 Звонок')
                     .replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]|✓+/gi, '').trim();
    }

    // Заголовок уведомления — тот же умный разбор, что и в списке чатов:
    // групповой чат подписывается своим именем, личный — именем собеседника.
    const owner = владелецЧата(c);
    const parts = collectCounterparts(msgs, owner);
    let title = sanitizeText(rawName).trim();
    if (!title || namesLikelySame(title, owner)) {
      if (!c.participants && parts.length === 1) title = parts[0];
      else if (lastSender) title = lastSender;
    }
    // Контакт под ложным именем и здесь записан так, как в телефоне.
    const какВТелефоне = (имя) => (контактСНастоящимИменем(phone.contacts, имя) || { сохранён: имя }).сохранён;
    if (title && !c.participants) title = какВТелефоне(title);
    const who = c.participants && lastSender ? какВТелефоне(lastSender) : '';
    // chatIdx связывает уведомление с конкретной перепиской: по нему открывается
    // нужный чат и снимается непрочитанное, когда в него зашли.
    notifItems.push({ title: title || 'Сообщение', who, text: lastText, time: lastTime, момент: lastTime ? момент : -Infinity, count: unreadHere, target: `subchat-${uid}-${chatIdx}` });
  });

  // Сколько карточек показывать на домашнем экране — настройка «Карточек
  // уведомлений». Раньше было жёстко три.
  const MAX_NOTIF = Math.max(1, Math.min(5, Number(settings.phoneNotifMax) || 3));
  // Новые сверху, как на настоящем телефоне: шли в порядке чатов, и 06:25
  // стояло над 13:20. И с учётом дня: вчерашние 23:50 старше сегодняшних
  // 08:00. Без времени — в конце, порядок чатов между ними тот же.
  notifItems.sort((a, b) => (b.момент === a.момент ? 0 : b.момент > a.момент ? 1 : -1));
  const shown = notifItems.slice(0, MAX_NOTIF);
  const hiddenCount = notifItems.length - shown.length;

  const notice = !on('phoneAppMessages') ? ''
    : notifItems.length
    ? `<div class="hud-phone-notif-stack" data-phone-app="messages" data-phone-uid="${uid}" role="button" tabindex="0">
        <div class="hud-phone-notif-head">
          <span class="hud-phone-notif-label">${G_ICONS.chat} Сообщения</span>
        </div>
        ${shown.map((n, i) => {
          const color = HUD_AVATAR_COLORS[hudHashSeed(n.title) % HUD_AVATAR_COLORS.length];
          return `<div class="hud-phone-notif${i === 0 ? " hud-phone-notif--first" : ""}" data-chat-target="${n.target}" style="--depth:${i}; --nc:${color}">
            ${avaFace(n.title, 'hud-phone-notif-ava', 'transparent')}
            <span class="hud-phone-notif-body">
              <b>${defeatWI(escapeHtml(n.title))}${n.who ? `<em>${defeatWI(escapeHtml(n.who))}</em>` : ''}</b>
              <small>${n.text ? escapeHtml(n.text) : 'Новое сообщение'}</small>
            </span>
            <span class="hud-phone-notif-meta">
              <em>${escapeHtml(n.time)}</em>
            </span>
          </div>`;
        }).join('')}
        ${hiddenCount > 0 ? `<div class="hud-phone-notif-more">и ещё ${hiddenCount} ${hiddenCount === 1 ? 'чат' : 'чата'}</div>` : ''}
      </div>`
    : `<div class="hud-phone-home-notice"><div>
      <span>💬</span><span>${chatCount ? `${chatCount} перепис${chatCount === 1 ? 'ка' : 'ок'}` : 'Переписок нет'}</span>
      <small></small>
    </div></div>`;

  // Экран блокировки. Телефон открывается запертым: часы и дата по центру,
  // под ними те же уведомления, что и на домашнем экране, внизу — язычок
  // свайпа. Разблокировка живёт в events.js (жест тянут пальцем, поэтому
  // это pointer-события, а не клик).
  // Ближайшее дело: на домашнем экране ведёт в календарь, на блокировке — просто строка.
  const дела = on('phoneAppCalendar') ? ближайшиеДела(phone.calendar, characters, sceneDate, sceneTime, phoneOwner) : [];
  const текстДела = (д) => `<b>${escapeHtml(д.когда)}</b><small>${defeatWI(escapeHtml(д.название))}</small>`;
  const виджет = дела.length ? `<button type="button" class="hud-phone-widget" data-phone-app="calendar">${дела.map(д => `<span class="hud-phone-next">${ДЕЛО_ИКОНКА(д)}${текстДела(д)}</span>`).join('')}</button>` : '';
  const строкаДела = дела.length ? `<div class="hud-phone-lock-next">${дела.map(д => `<span class="hud-phone-next">${ДЕЛО_ИКОНКА(д)}${текстДела(д)}</span>`).join('')}</div>` : '';
  const statusGlyphs = '<span class="hud-phone-status-glyphs"><span class="hud-phone-sig"><i></i><i></i><i></i><i></i></span><span class="hud-phone-bat"></span></span>';
  const lockDate = String(sceneDate || '').trim();
  const lockNotifs = shown.length
    ? shown.map(nn => `<div class="hud-phone-lock-notice${overrideAvatarUrl(nn.title) ? ' has-face' : ''}" data-chat-target="${nn.target}" role="button" tabindex="0">
        ${overrideAvatarUrl(nn.title) ? avaFace(nn.title, 'hud-phone-lock-face', 'transparent') : ''}
        <em>${escapeHtml(nn.time)}</em>
        <span>${G_ICONS.chat} Сообщения</span>
        <b>${defeatWI(escapeHtml(nn.title))}</b>
        <small>${nn.text ? escapeHtml(nn.text) : 'Новое сообщение'}</small>
      </div>`).join('')
    : '<div class="hud-phone-lock-empty">Нет новых уведомлений</div>';

  const lockScreen = `<div class="hud-phone-lockscreen" data-phone-uid="${uid}" role="button" tabindex="0"
        aria-label="Экран блокировки. Проведите вверх, чтобы разблокировать">
      <div class="hud-phone-statusline"><span>${escapeHtml(latestTime || '')}</span>${statusGlyphs}</div>
      ${часыБлокировки(latestTime)}
      ${lockDate ? `<div class="hud-phone-lock-day">${defeatWI(escapeHtml(lockDate))}</div>` : ''}
      ${строкаДела}
      <div class="hud-phone-lock-notifications">${lockNotifs}</div>
      <div class="hud-phone-lock-swipe">
        <span class="hud-phone-lock-arrow"></span>
        <span class="hud-phone-lock-hint">Проведите вверх</span>
        <span class="hud-phone-lock-hint-keys">Нажмите OK</span>
        <span class="hud-phone-lock-bar"></span>
      </div>
    </div>`;

  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}">
    <div class="hud-phone-shell">
      <span class="hud-phone-btn-side vol-up"></span><span class="hud-phone-btn-side vol-down"></span><span class="hud-phone-btn-side power"></span>
    <div class="hud-phone-emulator" data-phone-uid="${uid}" data-wall-k="${ключОбоев(phoneOwner)}">
      <span class="hud-phone-glass"></span>
      <span class="hud-phone-cracks" aria-hidden="true"></span>
      ${lockScreen}
      <div class="hud-phone-unlocked">
        <div class="hud-phone-top-status"><span>${escapeHtml(latestTime || "")}</span><span class="hud-phone-status-glyphs">${КНОПКА_РЕГЕНА}<span class="hud-phone-sig"><i></i><i></i><i></i><i></i></span><span class="hud-phone-bat"></span></span></div>
        <div class="hud-phone-home-wrap">
          <div class="hud-phone-home-screen">${виджет}${notice}<div class="hud-phone-app-grid">${grid}</div></div>
          ${views}
        </div>
        <div class="hud-phone-bottom-bar"><button type="button" class="hud-phone-nav-btn is-back" data-nav="back" aria-label="Назад"></button><button class="hud-phone-home-btn" data-phone-home="${uid}"></button><button type="button" class="hud-phone-nav-btn is-recent" data-nav="home" aria-label="Домой"></button></div>
      </div>
    </div>
    <div class="hud-phone-keys" aria-hidden="true">
      <div class="hud-phone-soft"><button type="button" data-key="back">Назад</button><button type="button" class="is-ok" data-key="ok">OK</button><button type="button" data-key="home">Домой</button></div>
      <div class="hud-phone-digits">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(к => `<button type="button" data-key="${к}">${к}</button>`).join('')}</div>
    </div>
    </div>
  </div>`;
}

// --- Просмотр вложения -------------------------------------------------------
//
// Настоящего файла у нас нет — есть описание, которое написала модель. По клику
// показываем его целиком: в пузыре подпись обрезана двумя строками, а в ней
// нередко и есть весь смысл кадра.

export function openPhoneMediaViewer(tile) {
  if (!tile || document.querySelector('.hud-media-overlay')) return;
  const вид = tile.dataset.media === 'video' ? 'video' : 'photo';
  const описание = tile.dataset.mediaDesc || '';
  // Настоящий снимок (отправлен из галереи игрока) — показываем его.
  const картинка = вид === 'photo' && /^\/user\/files\/hud-photo-[\w-]+\.(?:jpe?g|png|webp|gif)$/i.test(tile.dataset.mediaSrc || '') ? tile.dataset.mediaSrc : '';
  const длительность = tile.dataset.mediaDur || '';

  // Отправителя и время берём из пузыря рядом: в описании их нет, а понять,
  // чей это кадр и когда он пришёл, обычно важнее самого описания.
  const пузырь = tile.closest('.hud-msg-content');
  const отправитель = пузырь ? (пузырь.querySelector('.hud-msg-sender') || {}).textContent || '' : '';
  const время = пузырь ? (пузырь.querySelector('.hud-msg-time') || {}).textContent || '' : '';

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay hud-media-overlay';
  overlay.innerHTML = `
    <div class="hud-media-view" role="dialog" aria-modal="true" aria-label="${вид === 'video' ? 'Описание ролика' : 'Описание снимка'}">
      ${картинка ? `<div class="hud-media-art has-img"><img class="hud-media-img" src="${escapeHtml(картинка)}" alt="${escapeHtml(описание || 'Фото')}"></div>` : ''}<div class="hud-media-art${вид === 'video' ? ' is-video' : ''}"${картинка ? ' hidden' : ''} style="--shot: ${tile.style.getPropertyValue('--shot') || '#4a5570'}">
        ${вид === 'video'
          ? '<span class="hud-msg-video-play" aria-hidden="true"></span>'
          : G_ICONS.image}
        ${длительность ? `<span class="hud-msg-video-dur">${escapeHtml(длительность)}</span>` : ''}
      </div>
      <div class="hud-media-body">
        <div class="hud-media-kind">${вид === 'video' ? '🎬 Видео' : '📷 Снимок'}${отправитель ? ' · ' + escapeHtml(отправитель.trim()) : ''}${время ? ' · ' + escapeHtml(время.trim()) : ''}</div>
        ${описание || !картинка ? `<div class="hud-media-desc">${описание ? defeatWI(escapeHtml(описание)) : 'Описание не приложено.'}</div>` : ''}
      </div>
      <div class="hud-modal-foot"><button type="button" class="hud-modal-btn cancel">Закрыть</button></div>
    </div>`;
  document.body.appendChild(overlay);
  guardTouchSwipe(overlay);

  const закрыть = () => { overlay.remove(); document.removeEventListener('keydown', поКлавише); };
  const поКлавише = (e) => { if (e.key === 'Escape') закрыть(); };
  document.addEventListener('keydown', поКлавише);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  overlay.querySelector('.cancel').addEventListener('click', закрыть);
}
