// hud-manager/render/phone.js
//
// Сам аппарат и его приложения: домашний экран, кошелёк, календарь,
// контакты, галерея, заметки, карты, поиск.
//
// Переписки живут в messenger.js, разбор тегов сообщения — в
// msg-parts.js, значки — в icons.js, общая мелочь — в phone-common.js.

import { escapeHtml, defeatWI, hudHashSeed, guardTouchSwipe, sanitizeText, имяБезПриставки } from '../utils.js?v=23.89.21';
import { английский } from '../i18n.js?v=23.89.21';
import { settings } from '../settings.js?v=23.89.21';
import { HUD_AVATAR_COLORS, overrideAvatarUrl } from '../avatars.js?v=23.89.21';
import { G_ICONS } from './icons.js?v=23.89.21';
import { значокПриложения, естьНабор } from './phone-icons.js?v=23.89.21';
import { buildMessengerHTML } from './messenger.js?v=23.89.21';
import { avaFace, msgTimeOf, collectCounterparts, parseMsgParties, контактСНастоящимИменем, ложноеИмяHTML } from './phone-common.js?v=23.89.21';
import { безШапокСообщения } from './msg-parts.js?v=23.89.21';
import { сортироватьЧаты } from './msg-feed.js?v=23.89.21';
import { buildWeatherApp, buildCallsApp, buildMapsApp, buildHealthApp } from './phone-extra.js?v=23.89.21';
import { buildCalendarApp } from './calendar.js?v=23.89.21';
import { приложениеМузыки } from './music.js?v=23.89.21';
import { временаСлухов, ключСлуха } from './rumor-times.js?v=23.89.21';


import { namesLikelySame, transliterateCyrillic } from '../names.js?v=23.89.21';

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
export { buildCalendarApp, parseDayMonth } from './calendar.js?v=23.89.21';
import { ближайшиеДела } from './calendar.js?v=23.89.21';

// Слухи города: то, что модель и так пишет в мир, — последние десять, свежие
// сверху. Два раздела вкладками (радиокнопками, без скриптов): «Говорят» —
// облачка шёпота, чем старше слух, тем бледнее; «Пишут в сети» — лента постов.
// Автор поста скрыт до нажатия, поэтому и аватарка — не по нику, а по тексту.
const ШЁПОТ = '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2c0-3.5 3.3-6.2 7.6-6.2s7.6 2.7 7.6 6.2-3.3 6.2-7.6 6.2c-.9 0-1.8-.1-2.6-.4L5 19l1.1-3.3A5.8 5.8 0 0 1 4 11.2Z"/><path d="M8.6 11.3h.01M11.6 11.3h.01M14.6 11.3h.01" stroke-width="2.4" stroke-linecap="round"/></svg>';
// Аноним в ленте: голова по центру круга, плечи уходят за нижний край —
// как пустая аватарка в любой соцсети. Свой рисунок, а не значок «person»:
// тот мелкий и висел ниже центра.
const СИЛУЭТ = '<svg class="hud-post-sil" viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="11" r="5.2"/><path d="M3.6 29.5c.7-6.6 4.9-10.4 10.4-10.4s9.7 3.8 10.4 10.4z"/></svg>';
const КАВЫЧКА = '<svg class="hud-rumor-q" viewBox="0 0 24 18" aria-hidden="true"><path d="M2 18V10.6C2 5.2 4.6 1.6 9.6 0l1 2.2C7.8 3.4 6.6 5.4 6.5 8.2H10.4V18Zm12.6 0V10.6c0-5.4 2.6-9 7.6-10.6l1 2.2c-2.8 1.2-4 3.2-4.1 6h3.9V18Z"/></svg>';
// Время записей — render/rumor-times.js: дата и час хода, где запись
// появилась впервые, минуты и секунды — свои у каждой, не позже того хода.
// Списки идут от свежих к старым по этому времени.
function buildRumorsApp(rumors, talk, uid = '', { впервые = null, сцена = null, запомнить = true } = {}) {
  const сырыеСлухи = (Array.isArray(rumors) ? rumors : []).filter(Boolean).slice(-10).reverse();
  const сырыеРечи = (Array.isArray(talk) ? talk : []).filter(Boolean).slice(-10).reverse();
  if (!сырыеСлухи.length && !сырыеРечи.length) return emptyApp(G_ICONS.chat, 'Город пока молчит');
  // Времена — для каждой ленты отдельно и от старых к новым (rumor-times.js).
  const времена = new Map([...временаСлухов([...сырыеСлухи].reverse().map(String), впервые, сцена, { запомнить }), ...временаСлухов([...сырыеРечи].reverse().map(String), впервые, сцена, { запомнить })]);
  const поВремени = (список) => список.map((с, i) => ({ с, i, в: времена.get(ключСлуха(с)) || null }))
    .sort((a, b) => (a.в && b.в ? (b.в.ход - a.в.ход) || (b.в.секунды - a.в.секунды) || (a.i - b.i) : a.i - b.i));
  const слухи = поВремени(сырыеСлухи), речи = поВремени(сырыеРечи);
  const метка = (в) => в ? `<time class="hud-rumor-time">${escapeHtml([в.дата, в.время].filter(Boolean).join(' · '))}</time>` : '';
  // Старые слухи остывают: прозрачность по возрасту, свежий — с меткой.
  const карточкиСлухов = слухи.map(({ с, в }, i) => `<li class="hud-rumor${i ? '' : ' is-fresh'}${i % 2 ? ' is-right' : ''}" style="--age:${Math.min(i, 6)}">${КАВЫЧКА}${i ? '' : '<span class="hud-rumor-new">свежее</span>'}<p>${defeatWI(escapeHtml(String(с)))}</p>${метка(в)}</li>`).join('');
  const карточкиРечей = речи.map(({ с, в }) => {
    const м = String(с).match(/^([^:\n]{1,40}):\s*([\s\S]+)$/);
    const текст = м ? м[2].trim() : String(с);
    const зерно = hudHashSeed(текст);
    const цвет = HUD_AVATAR_COLORS[зерно % HUD_AVATAR_COLORS.length];
    const номер = String(1000 + зерно % 9000);
    return `<li class="hud-post">
      <span class="hud-post-ava" style="--ava:${цвет}">${СИЛУЭТ}</span>
      <div class="hud-post-body">
        <div class="hud-post-head">${м
          ? `<details class="hud-rumor-author" data-reveal="1"><summary>Аноним</summary><span>${defeatWI(escapeHtml(м[1].trim()))}</span></details>`
          : '<b class="hud-rumor-author">Аноним</b>'}${метка(в)}<span class="hud-post-no">#${номер}</span></div>
        <p>${defeatWI(escapeHtml(текст))}</p>
      </div>
    </li>`;
  }).join('');
  const раздел = (к, иконка, заголовок, коротко, n) => `<label for="${id}-${к}" class="t-${к}" title="${заголовок}">${иконка}<span class="hud-rumors-l">${заголовок}</span><span class="hud-rumors-s">${коротко}</span><span class="hud-rumors-n">${n}</span></label>`;
  const id = 'hud-rumors-' + (uid || hudHashSeed(сырыеСлухи.join('|') + сырыеРечи.join('|')).toString(36));
  const оба = слухи.length && речи.length;
  const вкладки = оба
    ? `<input type="radio" name="${id}" id="${id}-say" class="hud-rumors-in is-say" checked><input type="radio" name="${id}" id="${id}-net" class="hud-rumors-in is-net">
      <div class="hud-rumors-tabs">${раздел('say', ШЁПОТ, 'Говорят', 'Говорят', слухи.length)}${раздел('net', G_ICONS.chat, 'Пишут в сети', 'В сети', речи.length)}</div>`
    : `<h4 class="hud-rumors-title">${слухи.length ? ШЁПОТ + '<span>Говорят</span>' : G_ICONS.chat + '<span>Пишут в сети</span>'}</h4>`;
  return `<div class="hud-rumors${оба ? ' has-tabs' : ''}">${вкладки}${слухи.length ? `<ol class="hud-rumors-say">${карточкиСлухов}</ol>` : ''}${речи.length ? `<ol class="hud-rumors-net">${карточкиРечей}</ol>` : ''}</div>`;
}

// Перегенерация одного телефона (regen.js, phone-regen.js): крошечный значок
// в строке состояния, рядом со связью и батареей. Повторное нажатие отменяет,
// прежний телефон — в «↶» на карточке, как у перегенерации всего HUD.
const КНОПКА_РЕГЕНА = '<span class="hud-regen-btn hud-phone-regen" role="button" tabindex="0" title="Перегенерировать только телефон" aria-label="Перегенерировать только телефон"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v3.9h-3.9"/></svg></span>';

// Часы блокировки. Цифры разбиты на части, а циферблат лежит рядом: какой из
// видов показать, решают стили, поэтому смена вида не требует перерисовки.
function часыБлокировки(время) {
  const м = String(время || '').match(/(\d{1,2}):(\d{2})/);
  const цифры = м ? `<span class="h">${м[1]}</span><i class="c">:</i><span class="m">${м[2]}</span>` : '--:--';
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

function buildContactsApp(contacts) {
  if (!contacts || !contacts.length) return emptyApp(G_ICONS.person, 'Список контактов пуст');
  return `<div class="hud-phone-contacts">` + contacts.map(c => {
    const name = c.name || 'Без имени';
    const личность = контактСНастоящимИменем(contacts, c.name);
    return `<div class="hud-phone-contact">
      ${avaFace(name, 'hud-phone-contact-avatar', `linear-gradient(150deg, ${HUD_AVATAR_COLORS[hudHashSeed(name) % HUD_AVATAR_COLORS.length]}, rgba(0,0,0,.5))`)}
      <div><b>${defeatWI(escapeHtml(name))}</b>${личность ? ложноеИмяHTML(личность) : ''}${c.note ? `<small>${escapeHtml(c.note)}</small>` : ''}</div>
    </div>`;
  }).join('') + `</div>`;
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

function buildSearchApp(search) {
  // Экран повторяет то, что видно в браузере при тапе по строке поиска:
  // сама строка, а под ней недавние запросы со значком часов и стрелкой
  // «подставить в строку».
  const bar = `<div class="hud-google-bar">${G_ICONS.glass}<span class="hud-g-hint">Поиск в Google или URL</span><span class="hud-g-tools">${G_ICONS.mic}${G_ICONS.lens}</span></div>`;
  if (!search || !search.length) return bar + emptyApp(G_ICONS.clock, 'История поиска пуста');
  return bar + `<div class="hud-phone-section hud-g-history"><h4>Недавние</h4>` + search.map(q => `
    <div class="hud-phone-search-row">${G_ICONS.clock}<span class="hud-g-query">${escapeHtml(q)}</span>${G_ICONS.arrow}</div>`).join('') + `</div>`;
}

// --- Телефон целиком --------------------------------------------------------

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
  let unread = 0;
  Object.values(chatsMap || {}).forEach(c => {
    (Array.isArray(c && c.messages) ? c.messages : []).forEach(m => {
      if (/unread|не прочитан/i.test(String(m).replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]/gi, ''))) unread++;
    });
  });

  // Каждое приложение можно выключить в настройках. Выключенное не строится
  // вовсе: ни плитки на домашнем экране, ни экрана под ней. Настройка задана
  // от обратного (!== false), чтобы старые сохранённые настройки, где этих
  // ключей ещё нет, вели себя как «всё включено».
  const on = (key) => settings[key] !== false;
  // Где сейчас владелец: для «Погоды» и отметки «Вы здесь» на карте.
  const владелецКарточка = (Array.isArray(characters) ? characters : []).find(c => c && c['Имя'] && namesLikelySame(c['Имя'], phoneOwner));
  const местоВладельца = владелецКарточка ? String(владелецКарточка['Место'] || '').trim() : '';
  // Пропущенные сегодня — значком на «Звонках»; журнал считает их сам.
  const экранЗвонков = on('phoneAppCalls') ? buildCallsApp(chatsMap, phone.callLog, phoneOwner, sceneDate, uid, phone.contacts) : '';
  const пропущенных = (экранЗвонков.match(/hud-calls-row [^"]*kind-miss/g) || []).length;
  const apps = [
    on('phoneAppCalls') && { id: 'calls',    icon: G_ICONS.handset, label: 'Звонки', badge: пропущенных,
      body: экранЗвонков },
    on('phoneAppWeather') && { id: 'weather', icon: G_ICONS.weather, label: 'Погода', body: buildWeatherApp(доп.scene, доп.world, местоВладельца) },
    on('phoneAppHealth') && { id: 'health', icon: G_ICONS.health, label: 'Здоровье', body: buildHealthApp(phone, доп.scene, characters, phoneOwner, доп.user) },
    on('phoneAppMessages') && { id: 'messages', icon: G_ICONS.chat, label: 'Сообщения', badge: unread,
      body: messenger || emptyApp(G_ICONS.chat, 'В текущем повествовании нет переписок') },
    on('phoneAppContacts') && { id: 'contacts', icon: G_ICONS.person, label: 'Контакты',  body: buildContactsApp(phone.contacts) },
    on('phoneAppWallet') && { id: 'wallet',   icon: G_ICONS.card, label: 'Кошелёк',   body: buildWalletApp(phone.wallet, phoneOwner) },
    on('phoneAppCalendar') && { id: 'calendar', icon: G_ICONS.cal, label: 'Календарь', body: buildCalendarApp(phone.calendar, characters, sceneDate, phoneOwner) },
    on('phoneAppGallery') && { id: 'gallery',  icon: G_ICONS.image, label: 'Галерея',   body: buildGalleryApp(phone.gallery) },
    on('phoneAppNotes') && { id: 'notes',    icon: G_ICONS.note, label: 'Заметки',   body: buildNotesApp(phone.notes) },
    on('phoneAppMaps') && { id: 'maps',     icon: G_ICONS.map, label: 'Карты',     body: buildMapsApp(phone.maps, местоВладельца) },
    on('phoneAppSearch') && { id: 'search',   icon: G_ICONS.glass, label: 'Поиск',     body: buildSearchApp(phone.search) },
    on('phoneAppRumors') && settings.enableWorld !== false && { id: 'rumors', icon: G_ICONS.people, label: 'Слухи', body: buildRumorsApp(phone.rumors && phone.rumors.length ? phone.rumors : (доп.world && доп.world.rumors), phone.cityTalk && phone.cityTalk.length ? phone.cityTalk : (доп.world && доп.world.comments), uid,
      { впервые: phone.__слухиВпервые || null, сцена: { дата: sceneDate, время: sceneTime, ход: Number.isInteger(доп.mesId) ? доп.mesId : undefined }, запомнить: Number.isInteger(доп.mesId) && доп.mesId >= 0 }) },
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
    <div class="hud-phone-app-title"><span class="hud-phone-back" role="button" tabindex="0" aria-label="Назад" title="Назад">⟨</span>${a.icon} ${escapeHtml(a.label)}<span class="hud-phone-app-owner">${escapeHtml(имяБезПриставки(phoneOwner))}</span></div>
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
    let unreadHere = 0, lastTime = '', lastText = '', lastSender = '';
    msgs.forEach(m => {
      const s = String(m);
      if (/unread|не прочитан/i.test(s.replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]/gi, ''))) unreadHere++;
      const t = s.match(/\b\d{1,2}:\d{2}\b/); if (t) lastTime = t[0];
    });
    if (!unreadHere) return;

    // Берём последнее непрочитанное — именно оно всплывает уведомлением.
    for (let i = msgs.length - 1; i >= 0; i--) {
      const s = String(msgs[i]);
      if (!/unread|не прочитан/i.test(s.replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]/gi, ''))) continue;
      const parties = parseMsgParties(s);
      lastSender = parties.sender || '';
      let body = s.split('|')[0].replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim();
      // Отправитель с дефисом («Холлоуэй-Олбрайт») — тоже имя: [^:-] на нём
      // обрывалось, и уведомление показывало сырое «Имя -> Кому: [CALL: …]».
      const mm = body.match(/^(.+?)(?:\s*(?:->|→)\s*([^:]+?))?\s*:\s*(.*)$/);
      if (mm) body = mm[3];
      lastText = безШапокСообщения(body).replace(/\[(?:VIDEO|ВИДЕО|VID|РОЛИК)[ _]?\d{0,2}:?\d{0,2}\s*:?\s*[^\]]*\]/gi, '🎬 Видео')
                     .replace(/\[(?:VOICE|ГОЛОС)_?\d{0,2}:?\d{0,2}\]/gi, '🎤 Голосовое сообщение')
                     .replace(/\[(?:PHOTO|ФОТО|IMG|СНИМОК)\s*:?\s*[^\]]*\]/gi, '📷 Фото')
                     .replace(/\[(?:CALL|ЗВОНОК)\s*:?\s*([^\]]*)\]/gi, (_, b) => /пропущ|missed|no answer/i.test(b) ? '📞 Пропущенный звонок' : /отклон|declined|rejected/i.test(b) ? '📞 Отклонённый звонок' : '📞 Звонок')
                     .replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]|✓+/gi, '').trim();
      break;
    }

    // Заголовок уведомления — тот же умный разбор, что и в списке чатов:
    // групповой чат подписывается своим именем, личный — именем собеседника.
    const owner = String(c.owner || '').trim() || phoneOwner;
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
    notifItems.push({ title: title || 'Сообщение', who, text: lastText, time: lastTime, count: unreadHere, target: `subchat-${uid}-${chatIdx}` });
  });

  // Сколько карточек показывать на домашнем экране — настройка «Карточек
  // уведомлений». Раньше было жёстко три.
  const MAX_NOTIF = Math.max(1, Math.min(5, Number(settings.phoneNotifMax) || 3));
  // Новые сверху, как на настоящем телефоне: шли в порядке чатов, и 06:25
  // стояло над 13:20. Без времени — в конце, порядок чатов между ними тот же.
  const минутыУв = (t) => { const м = String(t || '').match(/(\d{1,2}):(\d{2})/); return м ? +м[1] * 60 + +м[2] : -1; };
  notifItems.sort((a, b) => минутыУв(b.time) - минутыУв(a.time));
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
    <div class="hud-phone-emulator" data-phone-uid="${uid}">
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
      <div class="hud-media-art${вид === 'video' ? ' is-video' : ''}" style="--shot: ${tile.style.getPropertyValue('--shot') || '#4a5570'}">
        ${вид === 'video'
          ? '<span class="hud-msg-video-play" aria-hidden="true"></span>'
          : G_ICONS.image}
        ${длительность ? `<span class="hud-msg-video-dur">${escapeHtml(длительность)}</span>` : ''}
      </div>
      <div class="hud-media-body">
        <div class="hud-media-kind">${вид === 'video' ? '🎬 Видео' : '📷 Снимок'}${отправитель ? ' · ' + escapeHtml(отправитель.trim()) : ''}${время ? ' · ' + escapeHtml(время.trim()) : ''}</div>
        <div class="hud-media-desc">${описание ? defeatWI(escapeHtml(описание)) : 'Описание не приложено.'}</div>
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
