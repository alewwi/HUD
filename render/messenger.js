// hud-manager/render/messenger.js
//
// Список переписок и сами переписки в телефоне персонажа: строки списка,
// шапка открытого чата, пузыри, счётчики непрочитанного, участники группы.
//
// Вынесено из phone.js: тот разросся до девятисот строк и держал в себе
// разом мессенджер, кошелёк, календарь и сборку самого аппарата.

import { escapeHtml, defeatWI, hudHashSeed, sanitizeText } from '../utils.js?v=22.99.87';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=22.99.87';
import { G_ICONS } from './icons.js?v=22.99.87';
import { buildBubbleInner, buildCallRow, msgKey } from './msg-parts.js?v=22.99.87';
import { avaFace, msgTimeOf, collectCounterparts } from './phone-common.js?v=22.99.87';
import { namesLikelySame } from '../names.js?v=22.99.87';

export function buildMessengerHTML(chatsMap, uid, mainCharName) {
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
    let displayChatName = sanitizeText(rawChatName).trim();
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

    // Пустая строка честнее выдуманного «12:00»: если во всех сообщениях
    // времени нет, лучше не показывать никакого, чем неверное.
    let latestTime = '', unreadCount = 0;
    if (Array.isArray(chatObj.messages)) {
      chatObj.messages.forEach(m => {
        const t = msgTimeOf(m); if (t) latestTime = t;
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
           .replace(/\[(?:VIDEO|ВИДЕО|VID|РОЛИК)[ _]?\d{0,2}:?\d{0,2}\s*:?\s*([^\]]*)\]/gi, (mm, d) => '🎬 Видео' + (d.trim() ? ': ' + d.trim() : ''))
           .replace(/\[(?:PHOTO|ФОТО|IMG|СНИМОК)\s*:?\s*([^\]]*)\]/gi, (mm, d) => '📷 Фото' + (d.trim() ? ': ' + d.trim() : ''))
           .replace(/\[(?:CALL|ЗВОНОК)\s*:?\s*([^\]]*)\]/gi, (mm, b) => /пропущ|missed/i.test(b) ? '📞 Пропущенный звонок' : '📞 Звонок')
           .replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();
      preview = p.length > 46 ? p.slice(0, 45) + '…' : p;
    }
    const avaColor = HUD_AVATAR_COLORS[hudHashSeed(displayChatName) % HUD_AVATAR_COLORS.length];
    const isGroup = Boolean(chatObj.participants);

    chatList += `<button class="hud-phone-chat-row" data-chat-target="subchat-${uid}-${idx}">
      ${avaFace(displayChatName, 'hud-phone-chat-ava', `linear-gradient(150deg, ${avaColor}, rgba(0,0,0,.55))`, isGroup ? '<i class="hud-phone-chat-group">👥</i>' : '')}
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
      <div class="hud-phone-header"><span class="hud-phone-back">⟨</span><div class="hud-phone-title-group" ${chatObj.participants ? 'style="cursor:pointer;" title="Нажми, чтобы увидеть участников"' : ''}><span class="hud-phone-name">${defeatWI(escapeHtml(displayChatName))} ${chatObj.participants ? '<span style="font-size:0.8em; opacity:0.7;">▾</span>' : ''}</span>${chatObj.participants ? `<div class="hud-phone-participants-list">${G_ICONS.people} Участники: ${escapeHtml(chatObj.participants)}</div>` : ''}</div><span class="hud-phone-options">⋮</span></div>
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
                  ${!isOutgoing ? avaFace(sender, 'hud-msg-avatar', 'rgba(255,255,255,0.1)') : ''}
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

        // Звонок — событие, а не реплика: строка во всю ширину вместо пузыря.
        const callRow = buildCallRow(message, { sender, time: msgTime, outgoing: isOutgoing });
        if (callRow) { chatBodies += callRow; return; }

        // Вложения в пузыре собирает общий сборщик — он же работает в перехватах.
            const msgInner = buildBubbleInner(message);

            // РИСУЕМ ФИНАЛЬНОЕ СООБЩЕНИЕ
            chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">
              ${!isOutgoing ? avaFace(sender, 'hud-msg-avatar', 'rgba(255,255,255,0.1)') : ''}
              <div class="hud-msg-content" style="max-width: 100%;">
                <span class="hud-msg-sender">${escapeHtml(sender)}</span>
                <div class="hud-msg-bubble" data-msg-key="${msgKey(message)}">
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
