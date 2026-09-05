// hud-manager/render/character.js
//
// Домены «Персонаж» и «{{user}}»: карточки с аватаркой, строками параметров
// и правилами вёрстки (полноширинные / драматические / обрезаемые ключи).
// Вынесено из index.js без изменения поведения.

import { escapeHtml, applyTooltips, buildPillList, getSafeUserName, mapKey, flattenFieldValue } from '../utils.js?v=22.70.10';
import { isNewLoreItem, loreButtonHTML } from '../lore.js?v=22.70.10';
import { getAvatarUrl, getUserAvatarUrl } from '../avatars.js?v=22.70.10';

const FULL_WIDTH_KEYS = ['мысли', 'ключ', 'ожидание vs реальность', 'отношения', 'общие воспоминания', 'флаг-монитор', 'социальное разоблачение', 'детализация nsfw', 'отзыв о сексе', 'nsfw', 'сновидение', 'расписание', 'скрытый подтекст', 'последний секс', 'кинк', 'фетиш', 'никогда не сделает', 'не возбуждает'];

// Порядок строк в карточке. Раньше он зависел от того, в каком порядке
// модель перечислила поля, и «Кинк» мог оказаться где угодно. Ключи, не
// попавшие в список, дописываются после в исходном порядке.
const FIELD_ORDER = ['Имя', 'Возраст', 'Одежда', 'Внешность', 'Роль', 'Тело', 'Физиология', 'Здоровье',
  'Место', 'Мысли', 'Ключ', 'Ожидание vs Реальность', 'Скрытый подтекст', 'Инвентарь', 'Цели',
  'Расписание', 'Отношения', 'Общие воспоминания', 'Флаг-монитор', 'Статус', 'Социальное разоблачение',
  'Глубина конфликта', 'Ревность', 'Конфликт', 'Сновидение',
  'Последний секс', 'Количество партнеров', 'Регулярность секса',
  'NSFW', 'Кинк', 'Фетиш', 'Никогда не сделает', 'Не возбуждает', 'Детализация NSFW', 'Отзыв о сексе'];
const orderFields = (obj) => {
  const rest = Object.keys(obj).filter(k => !FIELD_ORDER.includes(k));
  return [...FIELD_ORDER.filter(k => k in obj), ...rest].map(k => [k, obj[k]]);
};
const DRAMA_KEYS = ['ревность', 'конфликт', 'глубина конфликта'];
const TRUNCATE_KEYS = ['мысли', 'физиология'];

function formatKeyValue(text) {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return escapeHtml(text);
  const parts = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(text)).map(seg => ({ type: seg.segment.match(/\p{Emoji}/u) ? 'emoji' : 'text', value: seg.segment }));
  let html = '', currentText = '';
  for (let part of parts) {
    if (part.type === 'emoji') {
      if (currentText) { html += `<span class="hud-key-text">${applyTooltips(currentText)}</span>`; currentText = ''; }
      html += `<span class="hud-emoji">${escapeHtml(part.value)}</span>`;
    } else currentText += part.value;
  }
  if (currentText) html += `<span class="hud-key-text">${applyTooltips(currentText)}</span>`;
  return html;
}

export function buildUserHTML(userData, uid, isChecked) {
  if (!userData || Object.keys(userData).length === 0) return '';
  const personaName = getSafeUserName();
  const avatarUrl = getUserAvatarUrl();
  const avaTag = ` data-ava-name="${escapeHtml(personaName)}" data-ava-role="user"`;
  const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" class="hud-avatar hud-avatar-user" alt="avatar"${avaTag} onerror="this.outerHTML='<div class=&quot;hud-avatar-placeholder hud-avatar-user&quot;></div>'">` : `<div class="hud-avatar-placeholder hud-avatar-user"${avaTag}></div>`;

  const order = ['A', 'C', 'Ap', 'H', 'Rel', 'L', 'UW'];
  let rows = '';
  order.forEach(shortKey => {
    const label = mapKey(shortKey); let value = null;
    for (const [k, v] of Object.entries(userData)) { if (k === shortKey || k.toLowerCase() === label.toLowerCase()) { value = v; break; } }
    value = flattenFieldValue(value);
    if (!value || value.toLowerCase() === 'empty' || value.toLowerCase() === 'none') return;
    
    let rowClass = 'hud-row hud-user-row';
    if (label.toLowerCase().includes('nsfw')) rowClass += ' full-width nsfw';

    if (label.toLowerCase() === 'отношения') {
      rows += `<div class="${rowClass}"><span class="hud-key">${escapeHtml(label)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-detail-pill')}</div></div>`;
    } else if (label.toLowerCase().includes('nsfw')) {
      rows += `<div class="${rowClass}"><span class="hud-key">🔞 ${escapeHtml(label)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-nsfw-pill')}</div></div>`;
    } else {
      rows += `<div class="${rowClass}"><span class="hud-key">${escapeHtml(label)}:</span> <span class="hud-value">${applyTooltips(String(value))}</span></div>`;
    }
  });
  if (!rows) return '';
  return `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-header hud-user-header"><div class="hud-header-info">${avatarHtml}<div class="hud-header-text"><span class="hud-title">${escapeHtml(personaName)}</span></div></div></div><div class="hud-body hud-user-body">${rows}</div></div>`;
}

export function buildCharacterHTML(charData, uid, isChecked, isPrimary) {
  if (!charData || Object.keys(charData).length === 0) return '';
  const charName = charData['Имя'] || 'Unknown NPC';
  const avatar = getAvatarUrl(charName, isPrimary);
  const avaTag = ` data-ava-name="${escapeHtml(charName)}"`;
  const avatarHtml = avatar ? `<img src="${avatar.url}" data-hud-fallback="${avatar.thumbUrl}" class="hud-avatar" alt="avatar"${avaTag} onerror="if(!this.dataset.hudTried && this.dataset.hudFallback){this.dataset.hudTried='1'; this.src=this.dataset.hudFallback;} else {this.outerHTML='<div class=&quot;hud-avatar-placeholder&quot;>👤</div>';}">` : `<div class="hud-avatar-placeholder"${avaTag}>👤</div>`;

  let html = `<div class="hud-tab-content ${isChecked ? 'active' : ''}" id="content-${uid}"><div class="hud-header"><div class="hud-header-info">${avatarHtml}<div class="hud-header-text"><span class="hud-title">${escapeHtml(charName)}</span></div></div></div><div class="hud-body">`;

  for (const [key, rawValue] of orderFields(charData)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'имя') continue;
    // Объект или массив здесь — обычное дело: схема просит строку «Метка:
    // значение; ...», а модель нередко отдаёт ту же структуру объектом.
    // Разворачиваем сразу, чтобы ниже по коду везде была строка.
    const value = flattenFieldValue(rawValue);
    if (!value || value.toLowerCase() === 'empty' || value.toLowerCase() === 'none') continue;
    let rowClass = FULL_WIDTH_KEYS.some(k => lowerKey.includes(k)) ? 'hud-row full-width' : 'hud-row';
    if (DRAMA_KEYS.some(k => lowerKey.includes(k))) rowClass += ' drama-alert';
    if (lowerKey.includes('nsfw') || lowerKey.includes('секс') || lowerKey.includes('партнеров')
        || lowerKey === 'кинк' || lowerKey === 'фетиш' || lowerKey === 'никогда не сделает' || lowerKey === 'не возбуждает') rowClass += ' nsfw';

    let icon = '';
    if (lowerKey === 'возраст') icon = '⏳ '; else if (lowerKey === 'одежда') icon = '👕 ';
    else if (lowerKey === 'роль') icon = '🎭 '; else if (lowerKey === 'место') icon = '📍 ';
    else if (lowerKey === 'цели') icon = '🎯 '; else if (lowerKey === 'инвентарь') icon = '🎒 ';
    else if (lowerKey === 'статус') icon = '📌 '; else if (lowerKey === 'тело') icon = '🧍 ';
    else if (lowerKey === 'мысли') icon = '💭 '; else if (lowerKey === 'ожидание vs реальность') icon = '🔮 ';
    else if (lowerKey === 'общие воспоминания') icon = '🎞️ '; else if (lowerKey === 'флаг-монитор') icon = '🚩 ';
    else if (lowerKey === 'социальное разоблачение') icon = '👁️ '; else if (lowerKey === 'физиология') icon = '🩸 ';
    else if (lowerKey === 'скрытый подтекст' || lowerKey === 'детали') icon = '👁️‍🗨️ ';
    else if (lowerKey === 'отношения') icon = '🤝 '; else if (lowerKey === 'ревность') icon = '💔 ';
    else if (lowerKey === 'конфликт') icon = '⚔️ '; else if (lowerKey === 'последний секс') icon = '🛏️ ';
    else if (lowerKey === 'количество партнеров') icon = '👥 '; else if (lowerKey === 'регулярность секса') icon = '📈 ';
    else if (lowerKey === 'отзыв о сексе') icon = '📝 '; else if (lowerKey.includes('детализация nsfw')) icon = '🔥 ';
    else if (lowerKey === 'nsfw') icon = '🔞 '; else if (lowerKey === 'кинк') icon = '🔗 ';
    else if (lowerKey === 'фетиш') icon = '🎀 '; else if (lowerKey === 'никогда не сделает') icon = '⛔ ';
    else if (lowerKey === 'не возбуждает') icon = '🧊 ';

    let valueClass = TRUNCATE_KEYS.some(k => lowerKey.includes(k)) ? 'hud-value hud-truncate' : 'hud-value';

    if (lowerKey === 'ключ') {
      const items = String(value).split(';').filter(i => i.trim().length > 0).map(i => `<div class="hud-key-item">${formatKeyValue(i.trim())}</div>`).join('');
      html += `<div class="hud-key-block full-width"><span class="hud-key-label">${escapeHtml(key)}:</span> <div class="hud-vertical-container hud-key-list">${items}</div></div>`;
    } else if (lowerKey === 'инвентарь') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-inventory-grid">${buildPillList(value, 'hud-inventory-pill')}</div></div>`;
    } else if (lowerKey === 'nsfw' || lowerKey === 'детализация nsfw' || lowerKey === 'последний секс') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-nsfw-pill', true)}</div></div>`;
    } else if (lowerKey === 'кинк' || lowerKey === 'фетиш' || lowerKey === 'никогда не сделает' || lowerKey === 'не возбуждает') {
      // Каждый пункт — своя пилюля даже без явного разделителя: это списки,
      // а не связный текст, склеивать их обратно нельзя.
      const pillClass = lowerKey === 'кинк' ? 'hud-kink-pill'
        : lowerKey === 'фетиш' ? 'hud-fetish-pill'
        : lowerKey === 'никогда не сделает' ? 'hud-nogo-pill' : 'hud-noturn-pill';
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, pillClass, true)}</div></div>`;
    } else if (lowerKey === 'расписание') {
      const items = String(value).split(String(value).includes(';') ? /;/ : /(?:\.\s+(?=[А-ЯA-ZА-ЯЁ])|\n)/)
        .filter(i => i.trim().length > 0).map(i => {
          let text = i.trim().replace(/\.$/, ''); let timeMatch = text.match(/^([\d]{1,2}:\d{2})\s*[-—–:]?\s*(.*)$/);
          return timeMatch ? `<div class="hud-schedule-item"><div class="hud-schedule-time">${escapeHtml(timeMatch[1])}</div><div class="hud-schedule-event">${applyTooltips(timeMatch[2])}</div></div>` : `<div class="hud-schedule-item"><div class="hud-schedule-event">${applyTooltips(text)}</div></div>`;
        }).join('');
      html += `<div class="${rowClass} full-width"><div class="hud-schedule-container">${items}</div></div>`;
    } else if (lowerKey === 'ожидание vs реальность') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-exp-reality">${buildPillList(value, '')}</div></div>`;
    } else if (lowerKey === 'глубина конфликта') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-conflict-pill')}</div></div>`;
    } else if (lowerKey === 'отзыв о сексе') {
      html += `<div class="${rowClass} full-width"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <span class="${valueClass} hud-sex-rev">${applyTooltips(String(value)).replace(/([★☆]+)/g, '<span class="hud-stars-rating">$1</span>')}</span></div>`;
    } else if (lowerKey === 'общие воспоминания') {
      // Общее воспоминание — готовая запись для Lorebook: у неё есть и факт,
      // и участник, чьё имя станет ключом активации.
      const items = value.split(';').map(x => x.trim()).filter(Boolean);
      const memHtml = items.map(item => {
        const isNew = isNewLoreItem(item);
        return `<div class="hud-detail-pill hud-lore-item${isNew ? ' is-new' : ''}">` +
          `<span class="hud-lore-text">${escapeHtml(item)}</span>` +
          loreButtonHTML(item, [charName], isNew) + `</div>`;
      }).join('');
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${memHtml}</div></div>`;
    } else if (lowerKey === 'отношения' || lowerKey === 'цели' || lowerKey === 'ревность' || lowerKey === 'флаг-монитор') {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <div class="hud-vertical-container">${buildPillList(value, 'hud-detail-pill', (lowerKey === 'общие воспоминания' || lowerKey === 'флаг-монитор'))}</div></div>`;
    } else {
      html += `<div class="${rowClass}"><span class="hud-key">${icon}${escapeHtml(key)}:</span> <span class="${valueClass}">${applyTooltips(String(value))}</span></div>`;
    }
  }
  return html + `</div></div>`;
}
