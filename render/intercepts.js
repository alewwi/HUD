// hud-manager/render/intercepts.js
//
// Домен «Перехваты»: чужие переписки, которые видит игрок.
// Вынесено из index.js без изменения поведения.

import { escapeHtml, defeatWI, hudHasMeaningfulValue, sanitizeText, имяБезПриставки, инициалыИмени } from '../utils.js?v=23.63.9';
import { overrideAvatarUrl } from '../avatars.js?v=23.63.9';
// Снимки, ролики, голосовые и звонки собирает тот же код, что и в личном
// телефоне. Своя копия разбора здесь означала бы, что новый формат от модели
// в одном мессенджере работает, а в другом остаётся сырым тегом в тексте.
import { собратьЛенту, моментПоследнего, тотЖеВПереписке } from './msg-feed.js?v=23.63.9';

// Кружок отправителя в перехвате: ручная аватарка фоном либо инициал.
// Разметка и классы прежние — картинку прячет за собой класс has-img.
function interceptFace(sender) {
  const url = overrideAvatarUrl(sender);
  const letter = String(sender || '').trim() ? инициалыИмени(sender, 1) : '?';
  return '<div class="hud-msg-avatar hud-intercept-avatar' + (url ? ' has-img' : '') +
    '" data-ava-name="' + escapeHtml(String(sender || '')) + '" data-ava-bg="none"' +
    (url ? ' style="background-image:url(\'' + url + '\')"' : '') +
    '>' + escapeHtml(letter) + '</div>';
}

// Кто участвует в перехваченной переписке. Модель поле participants почти
// никогда не присылает — а строки сообщений всегда вида «А -> Б: текст»,
// то есть состав известен и без неё. Раньше без этого поля шапка просто
// переставала быть кнопкой: нажимать было не на что.
// Один человек под разными подписями — одно имя, самое полное («Декан» и
// «Декан Харрис» — Декан Харрис). Адресат «-> All», «-> название группы» —
// не участник: прежде он и был тем самым «третьим» в переписке двоих.
const ВСЕМ = /^(?:all|everyone|group|chat|все|всем|чат|группа|группе)$/i;
export function interceptParticipants(intercept) {
  const чат = String((intercept && intercept.chatName) || '').trim().toLowerCase();
  const имена = [];
  // Адресат с названием чата — сама группа («-> REGENCE_HQ_SEC»). Но личный
  // чат часто назван именем собеседника («Brandon Kane»): кто сам пишет в
  // переписке, тот человек, а не группа, и из состава не выпадает.
  const строки = Array.isArray(intercept && intercept.messages) ? intercept.messages : [];
  const пишет = (v) => строки.some(raw => {
    const m = String(raw || '').split('|')[0].match(/^\s*([^:]+?)\s*(?:->|→|:)/);
    return m && m[1].trim().toLowerCase() === v.toLowerCase();
  });
  const добавить = (raw) => {
    const v = String(raw || '').replace(/\[[^\]]*\]/g, '').trim();
    if (!v || v.length > 40 || /^unknown$/i.test(v) || ВСЕМ.test(v) || (чат && v.toLowerCase() === чат && !пишет(v))) return;
    const i = имена.findIndex(x => тотЖеВПереписке(x, v));
    if (i < 0) имена.push(v);
    else if (v.length > имена[i].length) имена[i] = v;
  };
  const явные = String((intercept && intercept.participants) || '')
    .split(/[;,]/).map(v => v.trim()).filter(Boolean);
  явные.forEach(добавить);
  // Модель назвала двоих и больше — им и верим (после склейки написаний).
  if (имена.length >= 2) return имена.join('; ');

  for (const raw of строки) {
    const первая = String(raw || '').split('|')[0];
    const m = первая.match(/^\s*([^:]+?)\s*(?:->|→)\s*([^:]+?)\s*:/);
    if (m) { добавить(m[1]); добавить(m[2]); continue; }
    const один = первая.match(/^\s*([^:]{1,40}?)\s*:/);
    if (один) добавить(один[1]);
  }
  return имена.length >= 2 ? имена.join('; ') : '';
}

export function buildInterceptsHTML(interceptsData, uid, isChecked, sceneDate) {
  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-phone-mockup intercept-mode">`;
  if (!interceptsData || interceptsData.length === 0) {
    return html + `<div class="hud-phone-empty"><div class="hud-phone-empty-icon">📡</div><div>Нет перехватов</div><small>В текущем повествовании нет доступных скрытых разговоров.</small></div></div></div>`;
  }
  let chatTabsHeader = `<div class="hud-phone-subtabs">`;
  let chatBodies = ``;

  // Перехваты тоже от свежих к старым: вчерашний разговор ниже сегодняшнего.
  const порядок = interceptsData.slice().sort((a, b) => моментПоследнего(b && b.messages, sceneDate) - моментПоследнего(a && a.messages, sceneDate));
  // Несколько перехваченных переписок одного человека (свежая и перенесённая
  // из прошлых ходов) давали одинаковые вкладки «👁️ Evangeline Rose Kane».
  // Таким вкладкам дописываем собеседника: «Evangeline ↔ Ares».
  const ключЦели = (i) => sanitizeText((i && i.target) || 'Unknown').trim().toLowerCase();
  const целей = new Map();
  порядок.forEach(i => целей.set(ключЦели(i), (целей.get(ключЦели(i)) || 0) + 1));
  const первое = (имя) => String(имя || '').trim().split(/\s+/)[0] || '';
  порядок.forEach((intercept, idx) => {
    // Состав переписки: из поля модели, а если его нет — из самих сообщений.
    const состав = interceptParticipants(intercept);
    let targetName = sanitizeText(intercept.target || 'Unknown').trim(), chatName = sanitizeText(intercept.chatName || 'Chat').trim();
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
    } else if (/\s(?:&|and|и)\s/i.test(chatName)) {
      // «Atlas & Evangeline» с телефона Атласа — контакт Evangeline. Иначе
      // две вкладки Атласа подписывались «Atlas ↔ Atlas». Название, где
      // владельца нет («Kane & Partners»), оставляем как есть.
      const части = chatName.split(/\s+(?:&|and|и)\s+/i).map(s => s.trim()).filter(Boolean);
      const свои = части.filter(ч => тотЖеВПереписке(ч, targetName));
      if (части.length === 2 && свои.length === 1) chatName = части.find(ч => ч !== свои[0]);
    }

    let latestTime = '--:--', unreadCount = 0;
    if (Array.isArray(intercept.messages)) {
      intercept.messages.forEach(m => {
        let timeMatch = m.match(/\b\d{1,2}:\d{2}\b/); if (timeMatch) latestTime = timeMatch[0];
        if (/unread|не прочитан/i.test(m.replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]/gi, ''))) unreadCount++;
      });
    }

    chatTabsHeader += `<button class="hud-phone-subtab intercept-tab ${idx === 0 ? 'active' : ''}" data-subtarget="subhack-${uid}-${idx}">👁️ ${defeatWI(escapeHtml(целей.get(ключЦели(intercept)) > 1 && chatName && chatName !== 'Chat' ? первое(targetName) + ' ↔ ' + первое(chatName) : имяБезПриставки(targetName)))} ${unreadCount > 0 ? `<span class="hud-unread-badge">${unreadCount}</span>` : ''}</button>`;

    chatBodies += `<div class="hud-phone-subbody ${idx === 0 ? 'active' : ''}" id="subhack-${uid}-${idx}">
      <div class="hud-phone-statusbar"><span class="hud-phone-time">${escapeHtml(latestTime)}</span><span class="hud-phone-owner-label intercept-status">📡 ПЕРЕХВАТ (${escapeHtml(имяБезПриставки(targetName))})</span><div class="hud-phone-status-icons"><span class="hud-intercept-icon">⚠</span></div></div>
      <div class="hud-phone-header hud-intercept-header">
        <span class="hud-phone-back hud-intercept-icon">⟨</span>
        <div class="hud-phone-title-group" ${состав ? 'style="cursor:pointer;" title="Нажми, чтобы увидеть участников"' : ''}><span class="hud-phone-name">${defeatWI(escapeHtml(имяБезПриставки(chatName)))} ${состав ? '<span style="font-size:0.8em; opacity:0.7;">▾</span>' : ''}</span>${состав ? `<div class="hud-phone-participants-list">👥 Участники: ${escapeHtml(состав)}</div>` : ''}</div>
        <span class="hud-phone-options hud-intercept-icon">⋮</span>
      </div>
      <div class="hud-phone-chat-area">`;

    // Та же лента, что и в личном телефоне (msg-feed.js): разделители дней,
    // черновики, удалённые, отметки о прочтении, звонки и вложения. Своя
    // копия разбора означала бы, что половина этого в перехватах не работает
    // — так и было до 22.99.92.
    chatBodies += собратьЛенту(intercept.messages, { owner: targetName, сцена: sceneDate, лицо: interceptFace }).html;
    chatBodies += `</div><div class="hud-phone-input-bar hud-intercept-input"><span class="hud-phone-attach hud-intercept-icon">⚠</span><div class="hud-phone-inputfield placeholder hud-intercept-icon">ДОСТУП ЗАКРЫТ — ТОЛЬКО ЧТЕНИЕ</div></div></div>`;
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
