// hud-manager/render/phone.js
//
// Сам аппарат и его приложения: домашний экран, кошелёк, календарь,
// контакты, галерея, заметки, карты, поиск.
//
// Переписки живут в messenger.js, разбор тегов сообщения — в
// msg-parts.js, значки — в icons.js, общая мелочь — в phone-common.js.

import { escapeHtml, defeatWI, hudHashSeed, guardTouchSwipe, sanitizeText } from '../utils.js?v=22.99.91';
import { settings } from '../settings.js?v=22.99.91';
import { HUD_AVATAR_COLORS, overrideAvatarUrl } from '../avatars.js?v=22.99.91';
import { G_ICONS } from './icons.js?v=22.99.91';
import { buildMessengerHTML } from './messenger.js?v=22.99.91';
import { avaFace, msgTimeOf, collectCounterparts, parseMsgParties } from './phone-common.js?v=22.99.91';


import { namesLikelySame, transliterateCyrillic } from '../names.js?v=22.99.91';

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
  const raw = String(owner || '').replace(/\{\{[^}]*\}\}/g, ' ').trim();
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

function walletCards(owner) {
  const rnd = walletRng(hudHashSeed(String(owner || 'owner')) + 7);
  const count = rnd() < 0.45 ? 2 : 1;
  const cards = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    let si = Math.floor(rnd() * CARD_SYSTEMS.length);
    while (used.has(si) && used.size < CARD_SYSTEMS.length) si = (si + 1) % CARD_SYSTEMS.length;
    used.add(si);
    const sys = CARD_SYSTEMS[si];
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
  const groups = m[2].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return m[1] + groups + (m[3] ? m[3].replace(',', '.') : '');
}

function buildWalletApp(wallet, owner) {
  const w = wallet || {};
  const tx = Array.isArray(w.transactions) ? w.transactions : [];
  if (!w.balance && !tx.length) return emptyApp(G_ICONS.card, 'Счёт пока не заведён');
  const holder = cardHolder(owner);
  const cards = walletCards(owner).map(c => `
    <div class="hud-wallet-card tone-${c.tone}">
      <span class="hud-wallet-sys">${escapeHtml(c.system)}</span>
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

// --- Календарь --------------------------------------------------------------
const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

// Дата сцены приходит в разном виде: «16.01.2025», «16.01», «ЧЕТВЕРГ, 16
// ЯНВАРЯ 2025». Разбираем все три.
export function parseDayMonth(str) {
  const s = String(str || '').toLowerCase();
  let m = s.match(/(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\s*[.\/-]\s*(\d{2,4}))?/);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    return { d: +m[1], mo: +m[2], y };
  }
  m = s.match(/(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?/);
  if (m) {
    const idx = MONTHS_RU.findIndex(name => m[2].startsWith(name.slice(0, 4)));
    if (idx >= 0) return { d: +m[1], mo: idx + 1, y: m[3] ? +m[3] : null };
  }
  return null;
}

export function buildCalendarApp(events, characters, sceneDate) {
  const list = [];
  (Array.isArray(events) ? events : []).forEach(e => {
    const dm = parseDayMonth(e.date);
    if (!dm) return;
    const kind = String(e.kind || '').toLowerCase();
    list.push({ ...dm, title: e.title || '', time: e.time || '',
      kind: /birth|день рожд/.test(kind) ? 'birthday' : /holiday|праздн|фестив/.test(kind) ? 'holiday' : 'event' });
  });

  // Расписание персонажей: пункты со временем чч:мм ложатся на дату сцены.
  const today = parseDayMonth(sceneDate);
  if (today) {
    (Array.isArray(characters) ? characters : []).forEach(ch => {
      const raw = ch && (ch['Расписание'] || ch['расписание']);
      if (!raw) return;
      String(raw).split(/[;\n]/).map(x => x.trim()).filter(Boolean).forEach(item => {
        const t = item.match(/\b(\d{1,2}:\d{2})\b/);
        if (!t) return;
        const title = item.replace(t[0], '').replace(/^[\s—–\-:.]+|[\s—–\-:.]+$/g, '') || 'Дело';
        const who = ch['Имя'] ? String(ch['Имя']).split(' ')[0] + ': ' : '';
        list.push({ d: today.d, mo: today.mo, y: today.y, title: who + title, time: t[1], kind: 'plan' });
      });
    });
  }

  const base = today || (list.length ? { d: list[0].d, mo: list[0].mo, y: list[0].y } : null);
  if (!base) return emptyApp(G_ICONS.cal, 'В календаре пока пусто');
  const year = base.y || new Date().getFullYear();
  const month = base.mo;

  // События этого месяца, разложенные по числам.
  const byDay = new Map();
  list.forEach(e => {
    if (e.mo !== month) return;
    if (e.y && base.y && e.y !== base.y) return;
    if (!byDay.has(e.d)) byDay.set(e.d, []);
    byDay.get(e.d).push(e);
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  // getDay(): 0 — воскресенье. Неделя начинается с понедельника.
  const shift = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  let cells = '';
  for (let i = 0; i < shift; i++) cells += '<span class="hud-cal-day is-empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const evs = byDay.get(d) || [];
    const kinds = [...new Set(evs.map(e => e.kind))];
    const dots = kinds.map(k => `<i class="hud-cal-dot k-${k}"></i>`).join('');
    const isToday = today && today.d === d;
    cells += `<span class="hud-cal-day${isToday ? ' is-today' : ''}${evs.length ? ' has-ev' : ''}"${evs.length ? ` title="${escapeHtml(evs.map(e => (e.time ? e.time + ' ' : '') + e.title).join(' · '))}"` : ''}>
      <b>${d}</b>${dots ? `<span class="hud-cal-dots">${dots}</span>` : ''}</span>`;
  }

  const agenda = [...byDay.keys()].sort((a, b) => a - b).map(d => {
    const evs = byDay.get(d).slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
    return `<div class="hud-cal-row${today && today.d === d ? ' is-today' : ''}">
      <span class="hud-cal-row-day">${d} ${MONTHS_RU[month - 1]}</span>
      <span class="hud-cal-row-items">${evs.map(e =>
        `<span class="hud-cal-item k-${e.kind}">${e.time ? `<b>${escapeHtml(e.time)}</b> ` : ''}${defeatWI(escapeHtml(e.title))}</span>`).join('')}</span>
    </div>`;
  }).join('');

  return `<div class="hud-cal">
    <div class="hud-cal-head">${MONTHS_NOM[month - 1]} ${year}</div>
    <div class="hud-cal-week"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
    <div class="hud-cal-grid">${cells}</div>
    ${agenda ? `<div class="hud-cal-agenda">${agenda}</div>` : '<div class="hud-cal-agenda hud-cal-empty">На этот месяц записей нет</div>'}
  </div>`;
}

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
    return `<div class="hud-phone-contact">
      ${avaFace(name, 'hud-phone-contact-avatar', `linear-gradient(150deg, ${HUD_AVATAR_COLORS[hudHashSeed(name) % HUD_AVATAR_COLORS.length]}, rgba(0,0,0,.5))`)}
      <div><b>${defeatWI(escapeHtml(name))}</b>${c.note ? `<small>${escapeHtml(c.note)}</small>` : ''}</div>
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

function buildMapsApp(maps) {
  if (!maps || !maps.length) return emptyApp(G_ICONS.map, 'Нет сохранённых мест');
  return `<div class="hud-phone-section">` + maps.map(m => `
    <div class="hud-phone-map-row">
      <span class="hud-g-pin">${G_ICONS.pin}</span>
      <div><b>${escapeHtml(m.place || 'Место')}</b>${m.note ? `<small>${escapeHtml(m.note)}</small>` : ''}</div>
    </div>`).join('') + `</div>`;
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

export function buildPhoneTabsHTML(chatsMap, uid, isChecked, mainCharName, phoneData, sceneDate, sceneTime, characters) {
  const phone = phoneData && typeof phoneData === 'object' ? phoneData : {};
  const chatCount = Object.keys(chatsMap || {}).length;
  // Владелец телефона. Приоритет: явное поле phone.owner → самый частый
  // owner среди переписок → имя персоны как последний фолбэк.
  // Раньше здесь всегда стояла персона игрока, из-за чего телефон Тристана
  // подписывался именем Софи.
  const ownerVotes = Object.create(null);
  Object.values(chatsMap || {}).forEach(c => {
    const o = String((c && c.owner) || '').trim();
    if (!o || /^(empty|none)$/i.test(o)) return;
    ownerVotes[o] = (ownerVotes[o] || 0) + 1;
  });
  const topChatOwner = Object.keys(ownerVotes).sort((a, b) => ownerVotes[b] - ownerVotes[a])[0] || '';
  const phoneOwner = (phone.owner && !/^(empty|none)$/i.test(phone.owner) ? phone.owner : '') || topChatOwner || mainCharName || '';

  // Мессенджер собираем уже зная владельца: он задаёт и подпись, и сторону пузырей.
  const messenger = buildMessengerHTML(chatsMap, uid, phoneOwner);


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
      if (/unread|не прочитан/i.test(String(m).replace(/\[удалено\]|\[черновик\]/gi, ''))) unread++;
    });
  });

  // Каждое приложение можно выключить в настройках. Выключенное не строится
  // вовсе: ни плитки на домашнем экране, ни экрана под ней. Настройка задана
  // от обратного (!== false), чтобы старые сохранённые настройки, где этих
  // ключей ещё нет, вели себя как «всё включено».
  const on = (key) => settings[key] !== false;
  const apps = [
    on('phoneAppMessages') && { id: 'messages', icon: G_ICONS.chat, label: 'Сообщения', badge: unread,
      body: messenger || emptyApp(G_ICONS.chat, 'В текущем повествовании нет переписок') },
    on('phoneAppContacts') && { id: 'contacts', icon: G_ICONS.person, label: 'Контакты',  body: buildContactsApp(phone.contacts) },
    on('phoneAppWallet') && { id: 'wallet',   icon: G_ICONS.card, label: 'Кошелёк',   body: buildWalletApp(phone.wallet, phoneOwner) },
    on('phoneAppCalendar') && { id: 'calendar', icon: G_ICONS.cal, label: 'Календарь', body: buildCalendarApp(phone.calendar, characters, sceneDate) },
    on('phoneAppGallery') && { id: 'gallery',  icon: G_ICONS.image, label: 'Галерея',   body: buildGalleryApp(phone.gallery) },
    on('phoneAppNotes') && { id: 'notes',    icon: G_ICONS.note, label: 'Заметки',   body: buildNotesApp(phone.notes) },
    on('phoneAppMaps') && { id: 'maps',     icon: G_ICONS.map, label: 'Карты',     body: buildMapsApp(phone.maps) },
    on('phoneAppSearch') && { id: 'search',   icon: G_ICONS.glass, label: 'Поиск',     body: buildSearchApp(phone.search) },
  ].filter(Boolean);

  const grid = apps.map(a => `<button class="hud-phone-app" data-phone-app="${a.id}" data-phone-uid="${uid}">
    <span>${a.icon}${a.badge ? `<i class="hud-unread-badge">${a.badge}</i>` : ''}</span>
    <small>${escapeHtml(a.label)}</small>
  </button>`).join('');

  const views = apps.map(a => `<div class="hud-phone-app-view" data-phone-view="${a.id}" data-phone-uid="${uid}">
    <div class="hud-phone-app-title"><span class="hud-phone-back" role="button" tabindex="0" aria-label="Назад" title="Назад">⟨</span>${a.icon} ${escapeHtml(a.label)}<span class="hud-phone-app-owner">${escapeHtml(phoneOwner)}</span></div>
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
      if (/unread|не прочитан/i.test(s.replace(/\[удалено\]|\[черновик\]/gi, ''))) unreadHere++;
      const t = s.match(/\b\d{1,2}:\d{2}\b/); if (t) lastTime = t[0];
    });
    if (!unreadHere) return;

    // Берём последнее непрочитанное — именно оно всплывает уведомлением.
    for (let i = msgs.length - 1; i >= 0; i--) {
      const s = String(msgs[i]);
      if (!/unread|не прочитан/i.test(s.replace(/\[удалено\]|\[черновик\]/gi, ''))) continue;
      const parties = parseMsgParties(s);
      lastSender = parties.sender || '';
      let body = s.split('|')[0].replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim();
      const mm = body.match(/^([^:-]+)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
      if (mm) body = mm[3];
      lastText = body.replace(/\[(?:VIDEO|ВИДЕО|VID|РОЛИК)[ _]?\d{0,2}:?\d{0,2}\s*:?\s*[^\]]*\]/gi, '🎬 Видео')
                     .replace(/\[(?:VOICE|ГОЛОС)_?\d{0,2}:?\d{0,2}\]/gi, '🎤 Голосовое сообщение')
                     .replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();
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
    const who = c.participants && lastSender ? lastSender : '';
    // chatIdx связывает уведомление с конкретной перепиской: по нему открывается
    // нужный чат и снимается непрочитанное, когда в него зашли.
    notifItems.push({ title: title || 'Сообщение', who, text: lastText, time: lastTime, count: unreadHere, target: `subchat-${uid}-${chatIdx}` });
  });

  // Сколько карточек показывать на домашнем экране — настройка «Карточек
  // уведомлений». Раньше было жёстко три.
  const MAX_NOTIF = Math.max(1, Math.min(5, Number(settings.phoneNotifMax) || 3));
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
      <div class="hud-phone-lock-time">${escapeHtml(latestTime || '--:--')}</div>
      ${lockDate ? `<div class="hud-phone-lock-day">${defeatWI(escapeHtml(lockDate))}</div>` : ''}
      <div class="hud-phone-lock-notifications">${lockNotifs}</div>
      <div class="hud-phone-lock-swipe">
        <span class="hud-phone-lock-arrow"></span>
        <span class="hud-phone-lock-hint">Проведите вверх</span>
        <span class="hud-phone-lock-bar"></span>
      </div>
    </div>`;

  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}">
    <div class="hud-phone-shell">
      <span class="hud-phone-btn-side vol-up"></span><span class="hud-phone-btn-side vol-down"></span><span class="hud-phone-btn-side power"></span>
    <div class="hud-phone-emulator" data-phone-uid="${uid}">
      <span class="hud-phone-glass"></span>
      ${lockScreen}
      <div class="hud-phone-unlocked">
        <div class="hud-phone-top-status"><span>${escapeHtml(latestTime || "")}</span><span class="hud-phone-status-glyphs"><span class="hud-phone-sig"><i></i><i></i><i></i><i></i></span><span class="hud-phone-bat"></span></span></div>
        <div class="hud-phone-home-wrap">
          <div class="hud-phone-home-screen">${notice}<div class="hud-phone-app-grid">${grid}</div></div>
          ${views}
        </div>
        <div class="hud-phone-bottom-bar"><button class="hud-phone-home-btn" data-phone-home="${uid}"></button></div>
      </div>
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
