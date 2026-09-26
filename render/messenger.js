// hud-manager/render/messenger.js
//
// Список переписок и сами переписки в телефоне персонажа: строки списка,
// шапка открытого чата, пузыри, счётчики непрочитанного, участники группы.
//
// Вынесено из phone.js: тот разросся до девятисот строк и держал в себе
// разом мессенджер, кошелёк, календарь и сборку самого аппарата.

import { escapeHtml, defeatWI, hudHashSeed, sanitizeText } from '../utils.js?v=23.13.2';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=23.13.2';
import { G_ICONS } from './icons.js?v=23.13.2';
import { собратьЛенту } from './msg-feed.js?v=23.13.2';
import { avaFace, msgTimeOf, collectCounterparts } from './phone-common.js?v=23.13.2';
import { namesLikelySame } from '../names.js?v=23.13.2';

export function buildMessengerHTML(chatsMap, uid, mainCharName, sceneDate) {
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
        if (/unread|не прочитан/i.test(m.replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]/gi, ''))) unreadCount++;
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
           .replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]|✓+/gi, '').trim();
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
		
    // Сообщения, разделители дней и черновик — общая лента (msg-feed.js):
    // ровно то же самое рисуют перехваты.
    const лента = собратьЛенту(chatObj.messages, { owner: activeOwner, сцена: sceneDate, черновикВПоле: true });
    const activeDraft = лента.draft;
    chatBodies += лента.html;
    chatBodies += `</div><div class="hud-phone-input-bar"><span class="hud-phone-attach">+</span><div class="hud-phone-inputfield ${activeDraft ? 'draft-active' : 'placeholder'}">${activeDraft ? escapeHtml(activeDraft) : 'Сообщение...'}</div><span class="hud-phone-send disabled">↑</span></div></div>`;
  });
  return chatList + `</div>` + `<div class="hud-phone-chat-stage">` + chatBodies + `</div>`;
}
