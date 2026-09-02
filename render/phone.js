// hud-manager/render/phone.js
//
// Домен «Телефон»: вкладки чатов, переписки, счётчики непрочитанного,
// участники. Вынесено из index.js без изменения поведения.

import { escapeHtml, defeatWI, hudHashSeed } from '../utils.js?v=22.5.8';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=22.5.8';
import { namesLikelySame } from '../names.js?v=22.5.8';

// Мессенджер как приложение телефона: возвращает только внутренности
// (полоса чатов + тела переписок), без обёртки вкладки.

// Разбор «Кто -> Кому: текст» из одной строки сообщения.
// Нужен и рендеру, и определению собеседника, поэтому вынесен наверх.
function parseMsgParties(msgStr) {
  const main = String(msgStr).split('|')[0].replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim();
  const m = main.match(/^([^:-]+?)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
  if (!m) return { sender: '', recipient: '' };
  return { sender: (m[1] || '').trim(), recipient: (m[2] || '').trim() };
}

// Служебные адресаты, которые не являются именем собеседника.
const GENERIC_PARTY = /^(все|всем|all|everyone|группа|group|чат|chat|вы|you|user|я|me)$/i;

// Все реальные участники переписки, кроме владельца телефона.
// Имена схлопываются нечётко: «Тристан», «Tristan» и «Tristan Kingsley» — один человек.
function collectCounterparts(messages, owner) {
  const seen = [];
  (Array.isArray(messages) ? messages : []).forEach(msgStr => {
    const { sender, recipient } = parseMsgParties(msgStr);
    [sender, recipient].forEach(n => {
      if (!n || GENERIC_PARTY.test(n)) return;
      if (owner && namesLikelySame(n, owner)) return;
      if (seen.some(s => namesLikelySame(s, n))) return;
      seen.push(n);
    });
  });
  return seen;
}

function buildMessengerHTML(chatsMap, uid, mainCharName) {
  const chatKeys = Object.keys(chatsMap || {});
  if (chatKeys.length === 0) return '';
  // Список чатов — первый экран приложения, как в настоящем мессенджере.
  // Вкладок-плашек больше нет: чат открывается по строке из списка.
  let chatList = `<div class="hud-phone-chat-list">`;
  let chatBodies = ``;

  chatKeys.forEach((rawChatName, idx) => {
    let chatObj = chatsMap[rawChatName];
    // Ни один чат не открыт по умолчанию: приложение стартует со списка.

    // Парсинг владельца телефона с фолбэком
    let rawOwner = String(chatObj.owner || '').trim();
    let activeOwner = (rawOwner && rawOwner.toLowerCase() !== 'empty' && rawOwner.toLowerCase() !== 'none') ? rawOwner : mainCharName;

    // Обрезаем дичь от ИИ в названиях.
    // Если название имеет вид «Владелец → Контакт», показываем только контакт.
    // Это влияет ТОЛЬКО на подпись чата/контакта, не на разбор и направление сообщений.
    let displayChatName = rawChatName.replace(/<[^>]+>/g, '').trim();
    let dashIndex = displayChatName.indexOf(' — ');
    if (dashIndex === -1) dashIndex = displayChatName.indexOf(' - ');
    if (dashIndex > 0) displayChatName = displayChatName.substring(0, dashIndex).trim();

    const arrowParts = displayChatName.split(/\s*(?:→|->|←|↔|↔︎)\s*/).map(s => s.trim()).filter(Boolean);
    if (arrowParts.length > 1) {
      const ownerNorm = activeOwner.toLowerCase().replace(/\s+/g, ' ').trim();
      const ownerFirst = ownerNorm.split(' ')[0];
      const ownerIndex = arrowParts.findIndex(part => {
        const partNorm = part.toLowerCase().replace(/\s+/g, ' ').trim();
        return partNorm === ownerNorm || partNorm === ownerFirst || partNorm.startsWith(ownerNorm + ' ') || ownerNorm.startsWith(partNorm + ' ');
      });

      if (ownerIndex !== -1) {
        const contactParts = arrowParts.filter((_, i) => i !== ownerIndex);
        displayChatName = contactParts.join(' → ').trim();
      } else {
        // Если владельца нет в строке, не угадываем направление: берём правую часть.
        displayChatName = arrowParts[arrowParts.length - 1];
      }
    }

    // === УМНОЕ ИМЯ ЧАТА ===
    // Модель часто называет чат именем владельца телефона («Тристан»), хотя
    // в шапке должен стоять собеседник. Разбираем участников из самих
    // сообщений и подставляем того, кто пишет владельцу.
    const counterparts = collectCounterparts(chatObj.messages, activeOwner);
    const isGroupChat = Boolean(chatObj.participants) || counterparts.length > 1;
    const keyIsOwner = !displayChatName || namesLikelySame(displayChatName, activeOwner);

    if (keyIsOwner) {
      if (!isGroupChat && counterparts.length === 1) {
        displayChatName = counterparts[0];
      } else if (chatObj.participants) {
        // Групповой чат, названный именем владельца: собираем список участников.
        const others = String(chatObj.participants).split(/[;,]/).map(s => s.trim())
          .filter(Boolean).filter(n => !namesLikelySame(n, activeOwner));
        if (others.length) displayChatName = others.slice(0, 3).join(', ') + (others.length > 3 ? '…' : '');
      } else if (counterparts.length > 1) {
        displayChatName = counterparts.slice(0, 3).join(', ') + (counterparts.length > 3 ? '…' : '');
      }
    }
    if (!displayChatName) displayChatName = 'Без названия';

    let latestTime = '12:00', unreadCount = 0;
    if (Array.isArray(chatObj.messages)) {
      chatObj.messages.forEach(m => {
        let timeMatch = m.match(/\b\d{1,2}:\d{2}\b/); if (timeMatch) latestTime = timeMatch[0];
        if (/unread|не прочитан/i.test(m.replace(/\[удалено\]|\[черновик\]/gi, ''))) unreadCount++;
      });
    }
    
    // Превью последнего сообщения для строки списка: снимаем служебные метки,
    // отправителя и время — остаётся только сам текст.
    let preview = '';
    if (Array.isArray(chatObj.messages) && chatObj.messages.length) {
      const lastRaw = String(chatObj.messages[chatObj.messages.length - 1] || '');
      let p = lastRaw.split('|')[0].replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim();
      const mm = p.match(/^([^:-]+)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
      if (mm) p = mm[3];
      p = p.replace(/\[(?:VOICE|ГОЛОС)_?\d{0,2}:?\d{0,2}\]/gi, '🎤 Голосовое сообщение')
           .replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();
      preview = p.length > 46 ? p.slice(0, 45) + '…' : p;
    }
    const avaColor = HUD_AVATAR_COLORS[hudHashSeed(displayChatName) % HUD_AVATAR_COLORS.length];
    const avaLetter = displayChatName.trim().charAt(0).toUpperCase() || '?';
    const isGroup = Boolean(chatObj.participants);

    chatList += `<button class="hud-phone-chat-row" data-chat-target="subchat-${uid}-${idx}">
      <span class="hud-phone-chat-ava" style="background:linear-gradient(150deg, ${avaColor}, rgba(0,0,0,.55))">${escapeHtml(avaLetter)}${isGroup ? '<i class="hud-phone-chat-group">👥</i>' : ''}</span>
      <span class="hud-phone-chat-meta">
        <b>${defeatWI(escapeHtml(displayChatName))}</b>
        <small>${preview ? escapeHtml(preview) : 'Нет сообщений'}</small>
      </span>
      <span class="hud-phone-chat-side">
        <em>${escapeHtml(latestTime)}</em>
        ${unreadCount > 0 ? `<i class="hud-unread-badge">${unreadCount}</i>` : ''}
      </span>
    </button>`;

    chatBodies += `<div class="hud-phone-subbody" id="subchat-${uid}-${idx}">
      <div class="hud-phone-header"><span class="hud-phone-back">⟨</span><div class="hud-phone-title-group" ${chatObj.participants ? 'style="cursor:pointer;" title="Нажми, чтобы увидеть участников"' : ''}><span class="hud-phone-name">${defeatWI(escapeHtml(displayChatName))} ${chatObj.participants ? '<span style="font-size:0.8em; opacity:0.7;">▾</span>' : ''}</span>${chatObj.participants ? `<div class="hud-phone-participants-list">👥 Участники: ${escapeHtml(chatObj.participants)}</div>` : ''}</div><span class="hud-phone-options">⋮</span></div>
      <div class="hud-phone-chat-area">`;
		
		let activeDraft = "";

    if (Array.isArray(chatObj.messages)) {
      chatObj.messages.forEach(msgStr => {
        if (!msgStr.trim()) return;
        let parts = msgStr.replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim().split('|').map(s => s.trim());
        let mainPart = parts[0], msgTime = parts.length > 1 ? parts[1] : '', msgStatus = parts.length > 2 ? parts[2] : '';

        if (parts.length === 1) {
          const fallbackMatch = mainPart.match(/(.*?)\s*(?:\|?\s*)(\b(?:Вчера|Сегодня|Завтра)[,\s]*\d{1,2}:\d{2}|\b\d{1,2}:\d{2})(?:\s*\|?\s*)(✓+|read|unread|доставлен[а-я]*|прочитан[а-я]*|отправлен[а-я]*|draft|черновик)?$/i);
          if (fallbackMatch) { mainPart = fallbackMatch[1].trim(); msgTime = fallbackMatch[2].trim(); msgStatus = (fallbackMatch[3] || '').trim(); }
        }

        // === НАЧАЛО НОВОГО КОДА ===
            let isDeleted = msgStatus.toLowerCase().includes('delete') || msgStatus.toLowerCase().includes('удалено') || mainPart.toLowerCase().includes('[удалено]');
            let isDraft = msgStatus.toLowerCase().includes('draft') || msgStatus.toLowerCase().includes('черновик') || mainPart.toLowerCase().includes('[черновик]');

            mainPart = mainPart.replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();

            let sender = "Unknown", message = mainPart, match = mainPart.match(/^([^:-]+)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
            if (match) { sender = match[1].trim(); message = match[3].trim(); }

            // Исходящее = отправлено владельцем телефона. Сравнение нечёткое
            // (namesLikelySame): владелец «Tristan Kingsley», а в сообщении он же
            // «Тристан» — простое includes() тут не срабатывало, и свои сообщения
            // вставали слева, как чужие.
            let isOutgoing = Boolean(activeOwner && namesLikelySame(sender, activeOwner));
            // В JSON модель может называть владельца телефона User/You/Вы.
            // Это тоже исходящее сообщение от владельца, а не входящее.
            if (/^(?:user|you|вы|я|player)$/i.test(sender.trim())) isOutgoing = true;

            // ЛОВИМ ЧЕРНОВИК (Прячем из чата и сохраняем)
            if (isDraft && isOutgoing) {
                activeDraft = message;
                return; 
            }

            // ЛОВИМ УДАЛЕННОЕ (Рисуем кликабельный спойлер)
            if (isDeleted) { 
                chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">
                  ${!isOutgoing ? `<div class="hud-msg-avatar">${sender.charAt(0).toUpperCase()}</div>` : ''}
                  <div class="hud-msg-content" style="max-width: 100%;">
                    <span class="hud-msg-sender">${escapeHtml(sender)}</span>
                    <details class="hud-msg-deleted-details">
                      <summary>🚫 Сообщение удалено</summary>
                      <div class="hud-msg-deleted-text">${escapeHtml(message)}</div>
                    </details>
                  </div>
                </div>`;
                return; 
            }

        let statusHtml = '';
        if (isOutgoing) {
          let s = msgStatus.toLowerCase();
          if (s.includes('read') || s.includes('прочитан') || s.includes('✓✓')) statusHtml = '<span class="msg-status read" style="color: #4facfe; font-weight: bold;">✓✓</span>';
          else if (s.includes('delivered') || s.includes('доставлен')) statusHtml = '<span class="msg-status delivered" style="opacity: 0.8;">✓✓</span>';
          else statusHtml = '<span class="msg-status sent" style="opacity: 0.8;">✓</span>';
        } else if (msgStatus.toLowerCase().includes('unread') || msgStatus.toLowerCase().includes('не прочитан')) {
          statusHtml = '<span class="msg-status unread-dot"></span>';
        }

        // === ЛОВИМ ГОЛОСОВЫЕ СООБЩЕНИЯ ===
            let isVoice = false;
            let voiceDur = "";
            let voiceMatch = message.match(/\[(?:VOICE|ГОЛОС)_?(\d{1,2}:\d{2})?\]/i);
            if (voiceMatch) {
                isVoice = true;
                voiceDur = voiceMatch[1] || "0:15"; // Берем длину аудио или ставим 15 сек по умолчанию
                message = message.replace(voiceMatch[0], '').trim(); // Вырезаем тег из текста
            }

            // СОБИРАЕМ ВНУТРЕННОСТИ ПУЗЫРЯ (Текст или Плеер)
            let msgInner = isVoice 
                ? `<div class="hud-voice-player"><div class="hud-voice-btn">▶</div><div class="hud-voice-line"></div><span class="hud-voice-time">${voiceDur}</span></div><details class="hud-voice-details"><summary>Расшифровка</summary><div class="hud-voice-text">${escapeHtml(message)}</div></details>`
                : `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>`;

            // РИСУЕМ ФИНАЛЬНОЕ СООБЩЕНИЕ
            chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">
              ${!isOutgoing ? `<div class="hud-msg-avatar">${sender.charAt(0).toUpperCase()}</div>` : ''}
              <div class="hud-msg-content" style="max-width: 100%;">
                <span class="hud-msg-sender">${escapeHtml(sender)}</span>
                <div class="hud-msg-bubble">
                  ${msgInner}
                  ${(msgTime || statusHtml) ? `<div class="hud-msg-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 0.75em; opacity: 0.6; margin-top: 4px;"><span class="hud-msg-time">${escapeHtml(msgTime)}</span>${statusHtml}</div>` : ''}
                </div>
              </div>
            </div>`;
      });
    }
    chatBodies += `</div><div class="hud-phone-input-bar"><span class="hud-phone-attach">+</span><div class="hud-phone-inputfield ${activeDraft ? 'draft-active' : 'placeholder'}">${activeDraft ? escapeHtml(activeDraft) : 'Сообщение...'}</div><span class="hud-phone-send disabled">↑</span></div></div>`;
  });
  return chatList + `</div>` + `<div class="hud-phone-chat-stage">` + chatBodies + `</div>`;
}

// --- Экраны приложений ------------------------------------------------------
// Каждый билдер получает свой кусок data.phone и возвращает внутренности
// .hud-phone-app-view. Пустая секция отдаёт '' — вызывающий подставит заглушку.

function emptyApp(icon, text) {
  return `<div class="hud-phone-empty-app"><div class="hud-phone-empty-icon">${icon}</div><div class="hud-phone-empty-line">${escapeHtml(text)}</div></div>`;
}

function buildContactsApp(contacts) {
  if (!contacts || !contacts.length) return emptyApp('👤', 'Список контактов пуст');
  return `<div class="hud-phone-contacts">` + contacts.map(c => {
    const name = c.name || 'Без имени';
    return `<div class="hud-phone-contact">
      <div class="hud-phone-contact-avatar" style="background:linear-gradient(150deg, ${HUD_AVATAR_COLORS[hudHashSeed(name) % HUD_AVATAR_COLORS.length]}, rgba(0,0,0,.5))">${escapeHtml(name.trim().charAt(0).toUpperCase() || '?')}</div>
      <div><b>${defeatWI(escapeHtml(name))}</b>${c.note ? `<small>${escapeHtml(c.note)}</small>` : ''}</div>
    </div>`;
  }).join('') + `</div>`;
}

function buildGalleryApp(gallery) {
  if (!gallery || !gallery.length) return emptyApp('🖼️', 'В галерее пока пусто');
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
  if (!notes || !notes.length) return emptyApp('📝', 'Заметок нет');
  return notes.map(n => `<div class="hud-phone-note">
    <b>${escapeHtml(n.title || 'Без названия')}</b>
    ${n.time ? `<small>${escapeHtml(n.time)}</small>` : ''}
    ${n.text ? `<p>${escapeHtml(n.text)}</p>` : ''}
    ${n.footer ? `<footer>${escapeHtml(n.footer)}</footer>` : ''}
  </div>`).join('');
}

function buildMapsApp(maps) {
  if (!maps || !maps.length) return emptyApp('🗺️', 'Нет сохранённых мест');
  return `<div class="hud-phone-section">` + maps.map(m => `
    <div class="hud-phone-map-row">
      <span>📍</span>
      <div><b>${escapeHtml(m.place || 'Место')}</b>${m.note ? `<small>${escapeHtml(m.note)}</small>` : ''}</div>
    </div>`).join('') + `</div>`;
}

function buildSearchApp(search) {
  const bar = `<div class="hud-google-bar">🔍 Поиск</div>`;
  if (!search || !search.length) return bar + emptyApp('🔍', 'История поиска пуста');
  return bar + `<div class="hud-phone-section"><h4>Недавние запросы</h4>` + search.map(q => `
    <div class="hud-phone-search-row"><small>${escapeHtml(q)}</small></div>`).join('') + `</div>`;
}

// --- Телефон целиком --------------------------------------------------------

export function buildPhoneTabsHTML(chatsMap, uid, isChecked, mainCharName, phoneData) {
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


  // Время в строке состояния берём из самого свежего сообщения — телефон
  // показывает время сцены, а не системные часы браузера.
  let latestTime = '';
  Object.values(chatsMap || {}).forEach(c => {
    (Array.isArray(c && c.messages) ? c.messages : []).forEach(m => {
      const t = String(m).match(/\b\d{1,2}:\d{2}\b/);
      if (t) latestTime = t[0];
    });
  });

  // Значок непрочитанного на иконке «Сообщения».
  let unread = 0;
  Object.values(chatsMap || {}).forEach(c => {
    (Array.isArray(c && c.messages) ? c.messages : []).forEach(m => {
      if (/unread|не прочитан/i.test(String(m).replace(/\[удалено\]|\[черновик\]/gi, ''))) unread++;
    });
  });

  const apps = [
    { id: 'messages', icon: '💬', label: 'Сообщения', badge: unread,
      body: messenger || emptyApp('📱', 'В текущем повествовании нет переписок') },
    { id: 'contacts', icon: '👤', label: 'Контакты',  body: buildContactsApp(phone.contacts) },
    { id: 'gallery',  icon: '🖼️', label: 'Галерея',   body: buildGalleryApp(phone.gallery) },
    { id: 'notes',    icon: '📝', label: 'Заметки',   body: buildNotesApp(phone.notes) },
    { id: 'maps',     icon: '🗺️', label: 'Карты',     body: buildMapsApp(phone.maps) },
    { id: 'search',   icon: '🔍', label: 'Поиск',     body: buildSearchApp(phone.search) },
  ];

  const grid = apps.map(a => `<button class="hud-phone-app" data-phone-app="${a.id}" data-phone-uid="${uid}">
    <span>${a.icon}${a.badge ? `<i class="hud-unread-badge">${a.badge}</i>` : ''}</span>
    <small>${escapeHtml(a.label)}</small>
  </button>`).join('');

  const views = apps.map(a => `<div class="hud-phone-app-view" data-phone-view="${a.id}" data-phone-uid="${uid}">
    <div class="hud-phone-app-title">${a.icon} ${escapeHtml(a.label)}<span class="hud-phone-app-owner">${escapeHtml(phoneOwner)}</span></div>
    ${a.body}
  </div>`).join('');

  // Стопка уведомлений на домашнем экране: карточка на каждый чат с
  // непрочитанным, новые сверху, задние выглядывают со сдвигом и уменьшением.
  // Данные те же, что в списке чатов: аватарка по хэшу имени, название, превью.
  const notifItems = [];
  Object.keys(chatsMap || {}).forEach((rawName, chatIdx) => {
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
      lastText = body.replace(/\[(?:VOICE|ГОЛОС)_?\d{0,2}:?\d{0,2}\]/gi, '🎤 Голосовое сообщение')
                     .replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();
      break;
    }

    // Заголовок уведомления — тот же умный разбор, что и в списке чатов:
    // групповой чат подписывается своим именем, личный — именем собеседника.
    const owner = String(c.owner || '').trim() || phoneOwner;
    const parts = collectCounterparts(msgs, owner);
    let title = String(rawName).replace(/<[^>]+>/g, '').trim();
    if (!title || namesLikelySame(title, owner)) {
      if (!c.participants && parts.length === 1) title = parts[0];
      else if (lastSender) title = lastSender;
    }
    const who = c.participants && lastSender ? lastSender : '';
    // chatIdx связывает уведомление с конкретной перепиской: по нему открывается
    // нужный чат и снимается непрочитанное, когда в него зашли.
    notifItems.push({ title: title || 'Сообщение', who, text: lastText, time: lastTime, count: unreadHere, target: `subchat-${uid}-${chatIdx}` });
  });

  const MAX_NOTIF = 3;
  const shown = notifItems.slice(0, MAX_NOTIF);
  const hiddenCount = notifItems.length - shown.length;

  const notice = notifItems.length
    ? `<div class="hud-phone-notif-stack" data-phone-app="messages" data-phone-uid="${uid}" role="button" tabindex="0">
        <div class="hud-phone-notif-head">
          <span class="hud-phone-notif-label">💬 Сообщения</span>
          <span class="hud-phone-notif-count">${unread}</span>
        </div>
        ${shown.map((n, i) => {
          const color = HUD_AVATAR_COLORS[hudHashSeed(n.title) % HUD_AVATAR_COLORS.length];
          const letter = n.title.trim().charAt(0).toUpperCase() || '?';
          return `<div class="hud-phone-notif${i === 0 ? " hud-phone-notif--first" : ""}" data-chat-target="${n.target}" style="--depth:${i}; --nc:${color}">
            <span class="hud-phone-notif-ava">${escapeHtml(letter)}</span>
            <span class="hud-phone-notif-body">
              <b>${defeatWI(escapeHtml(n.title))}${n.who ? `<em>${defeatWI(escapeHtml(n.who))}</em>` : ''}</b>
              <small>${n.text ? escapeHtml(n.text) : 'Новое сообщение'}</small>
            </span>
            <span class="hud-phone-notif-meta">
              <em>${escapeHtml(n.time)}</em>
              ${n.count > 1 ? `<i>${n.count}</i>` : ''}
            </span>
          </div>`;
        }).join('')}
        ${hiddenCount > 0 ? `<div class="hud-phone-notif-more">и ещё ${hiddenCount} ${hiddenCount === 1 ? 'чат' : 'чата'}</div>` : ''}
      </div>`
    : `<div class="hud-phone-home-notice"><div>
      <span>💬</span><span>${chatCount ? `${chatCount} перепис${chatCount === 1 ? 'ка' : 'ок'}` : 'Переписок нет'}</span>
      <small></small>
    </div></div>`;

  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}">
    <div class="hud-phone-shell">
      <span class="hud-phone-btn-side vol-up"></span><span class="hud-phone-btn-side vol-down"></span><span class="hud-phone-btn-side power"></span>
    <div class="hud-phone-emulator unlocked" data-phone-uid="${uid}">
      <span class="hud-phone-glass"></span>
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
