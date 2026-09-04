// hud-manager/render/intercepts.js
//
// Домен «Перехваты»: чужие переписки, которые видит игрок.
// Вынесено из index.js без изменения поведения.

import { escapeHtml, defeatWI, hudHasMeaningfulValue } from '../utils.js?v=22.51.0';
import { overrideAvatarUrl } from '../avatars.js?v=22.51.0';

// Кружок отправителя в перехвате: ручная аватарка фоном либо инициал.
// Разметка и классы прежние — картинку прячет за собой класс has-img.
function interceptFace(sender) {
  const url = overrideAvatarUrl(sender);
  const letter = String(sender || '').trim().charAt(0).toUpperCase() || '?';
  return '<div class="hud-msg-avatar hud-intercept-avatar' + (url ? ' has-img' : '') +
    '" data-ava-name="' + escapeHtml(String(sender || '')) + '" data-ava-bg="none"' +
    (url ? ' style="background-image:url(\'' + url + '\')"' : '') +
    '>' + escapeHtml(letter) + '</div>';
}

export function buildInterceptsHTML(interceptsData, uid, isChecked) {
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-phone-mockup intercept-mode">`;
  if (!interceptsData || interceptsData.length === 0) {
    return html + `<div class="hud-phone-empty"><div class="hud-phone-empty-icon">📡</div><div>Нет перехватов</div><small>В текущем повествовании нет доступных скрытых разговоров.</small></div></div></div>`;
  }
  let chatTabsHeader = `<div class="hud-phone-subtabs">`;
  let chatBodies = ``;

  interceptsData.forEach((intercept, idx) => {
    let targetName = (intercept.target || 'Unknown').replace(/<[^>]+>/g, '').trim(), chatName = (intercept.chatName || 'Chat').replace(/<[^>]+>/g, '').trim();
    // Для перехвата показываем именно контакт, а не владельца телефона.
    // Направление сообщений ниже не меняем: target по-прежнему определяет владельца.
    const interceptArrowParts = chatName.split(/\s*(?:→|->|←|↔|↔︎)\s*/).map(s => s.trim()).filter(Boolean);
    if (interceptArrowParts.length > 1) {
      const targetNorm = targetName.toLowerCase().replace(/\s+/g, ' ').trim();
      const targetFirst = targetNorm.split(' ')[0];
      const targetIndex = interceptArrowParts.findIndex(part => {
        const partNorm = part.toLowerCase().replace(/\s+/g, ' ').trim();
        return partNorm === targetNorm || partNorm === targetFirst ||
          partNorm.startsWith(targetNorm + ' ') || targetNorm.startsWith(partNorm + ' ');
      });
      if (targetIndex !== -1) {
        const contactParts = interceptArrowParts.filter((_, i) => i !== targetIndex);
        chatName = contactParts.join(' → ').trim();
      } else {
        chatName = interceptArrowParts[interceptArrowParts.length - 1];
      }
    }

    let latestTime = '--:--', unreadCount = 0;
    if (Array.isArray(intercept.messages)) {
      intercept.messages.forEach(m => {
        let timeMatch = m.match(/\b\d{1,2}:\d{2}\b/); if (timeMatch) latestTime = timeMatch[0];
        if (/unread|не прочитан/i.test(m.replace(/\[удалено\]|\[черновик\]/gi, ''))) unreadCount++;
      });
    }

    chatTabsHeader += `<button class="hud-phone-subtab intercept-tab ${idx === 0 ? 'active' : ''}" data-subtarget="subhack-${uid}-${idx}">👁️ ${defeatWI(escapeHtml(targetName))} ${unreadCount > 0 ? `<span class="hud-unread-badge">${unreadCount}</span>` : ''}</button>`;

    chatBodies += `<div class="hud-phone-subbody ${idx === 0 ? 'active' : ''}" id="subhack-${uid}-${idx}">
      <div class="hud-phone-statusbar"><span class="hud-phone-time">${escapeHtml(latestTime)}</span><span class="hud-phone-owner-label intercept-status">📡 ПЕРЕХВАТ (${escapeHtml(targetName)})</span><div class="hud-phone-status-icons"><span class="hud-intercept-icon">⚠</span></div></div>
      <div class="hud-phone-header hud-intercept-header">
        <span class="hud-phone-back hud-intercept-icon">⟨</span>
        <div class="hud-phone-title-group" ${intercept.participants ? 'style="cursor:pointer;" title="Нажми, чтобы увидеть участников"' : ''}><span class="hud-phone-name">${defeatWI(escapeHtml(chatName))} ${intercept.participants ? '<span style="font-size:0.8em; opacity:0.7;">▾</span>' : ''}</span>${intercept.participants ? `<div class="hud-phone-participants-list">👥 Участники: ${escapeHtml(intercept.participants)}</div>` : ''}</div>
        <span class="hud-phone-options hud-intercept-icon">⋮</span>
      </div>
      <div class="hud-phone-chat-area">`;

    if (Array.isArray(intercept.messages)) {
      intercept.messages.forEach(msgStr => {
        if (!msgStr.trim()) return;
        let parts = msgStr.replace(/^(?:M|Msg|Сообщение|Chat|Чат):\s*/i, '').trim().split('|').map(s => s.trim());
        let mainPart = parts[0], msgTime = parts.length > 1 ? parts[1] : '';

        if (parts.length === 1) {
          const fallbackMatch = mainPart.match(/(.*?)\s*(?:\|?\s*)(\b(?:Вчера|Сегодня|Завтра)[,\s]*\d{1,2}:\d{2}|\b\d{1,2}:\d{2})/i);
          if (fallbackMatch) { mainPart = fallbackMatch[1].trim(); msgTime = fallbackMatch[2].trim(); }
        }
        mainPart = mainPart.replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();
        let sender = "Unknown", message = mainPart, match = mainPart.match(/^([^:-]+)(?:\s*(?:->|→)\s*([^:]+))?:\s*(.*)$/);
        if (match) { sender = match[1].trim(); message = match[3].trim(); }

        let isOutgoing = (targetName && sender.toLowerCase().includes(targetName.toLowerCase().split(' ')[0]));

        // === ГОЛОСОВЫЕ СООБЩЕНИЯ ===
        // Тот же тег [VOICE_M:SS] / [ГОЛОС_M:SS], что и в личном телефоне.
        let isVoice = false, voiceDur = '';
        const voiceMatch = message.match(/\[(?:VOICE|ГОЛОС)_?(\d{1,2}:\d{2})?\]/i);
        if (voiceMatch) {
          isVoice = true;
          voiceDur = voiceMatch[1] || '0:15';
          message = message.replace(voiceMatch[0], '').trim();
        }
        const msgInner = isVoice
          ? `<div class="hud-voice-player"><div class="hud-voice-btn">▶</div><div class="hud-voice-line"></div><span class="hud-voice-time">${escapeHtml(voiceDur)}</span></div>${message ? `<details class="hud-voice-details"><summary>Расшифровка</summary><div class="hud-voice-text">${escapeHtml(message)}</div></details>` : ''}`
          : `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>`;

        chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">${!isOutgoing ? interceptFace(sender) : ''}<div class="hud-msg-content" style="max-width: 100%;"><span class="hud-msg-sender">${escapeHtml(sender)}</span><div class="hud-msg-bubble">${msgInner}${msgTime ? `<div class="hud-msg-meta" style="display: flex; justify-content: flex-end; align-items: center; gap: 4px; font-size: 0.75em; opacity: 0.6; margin-top: 4px;"><span class="hud-msg-time">${escapeHtml(msgTime)}</span></div>` : ''}</div></div></div>`;
      });
    }
    chatBodies += `</div><div class="hud-phone-input-bar hud-intercept-input"><span class="hud-phone-attach hud-intercept-icon">⚠</span><div class="hud-phone-inputfield placeholder hud-intercept-icon">ACCESS DENIED - READ ONLY</div></div></div>`;
  });
  return html + chatTabsHeader + `</div>` + chatBodies + `</div></div>`;
}

export function hudHasMeaningfulIntercepts(items) {
  return Array.isArray(items) && items.some(i => {
    if (!i || typeof i !== 'object') return hudHasMeaningfulValue(i);
    return hudHasMeaningfulValue(i.target) || hudHasMeaningfulValue(i.chatName) ||
      (Array.isArray(i.messages) && i.messages.some(hudHasMeaningfulValue));
  });
}
