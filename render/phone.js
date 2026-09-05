// hud-manager/render/phone.js
//
// Домен «Телефон»: вкладки чатов, переписки, счётчики непрочитанного,
// участники. Вынесено из index.js без изменения поведения.

import { escapeHtml, defeatWI, hudHashSeed } from '../utils.js?v=22.70.10';
import { settings } from '../settings.js?v=22.70.10';
import { HUD_AVATAR_COLORS, overrideAvatarUrl } from '../avatars.js?v=22.70.10';

// Кружок собеседника. Если для имени назначена ручная аватарка, подставляем
// её фоном прямо в существующий элемент: разметка и классы не меняются, а
// буква прячется классом has-img. Иначе — прежний кружок с инициалом.
// Буква остаётся в разметке всегда — при фотографии её прячет класс
// has-img (color: transparent). Благодаря этому аватарку можно поменять
// прямо на месте, не пересобирая блок: см. refreshAvatarFaces.
// Время сообщения живёт в отдельном поле после «|», а если полей нет — в
// самом хвосте строки, перед отметкой о доставке. Искать первое попавшееся
// «ч:мм» по всему сообщению нельзя: во фразе «Приезжай к 8:00 … | 22:02»
// первым найдётся 8:00 из текста письма, а не время отправки.
function msgTimeOf(raw) {
  const s = String(raw || '');
  const ONLY_TIME = /^(?:Вчера|Сегодня|Завтра)?[,\s]*\d{1,2}:\d{2}$/i;
  const parts = s.split('|').map(x => x.trim());
  if (parts.length > 1) {
    const field = parts.slice(1).find(x => ONLY_TIME.test(x));
    if (field) return (field.match(/\d{1,2}:\d{2}/) || [''])[0];
  }
  // Полей нет — смотрим хвост: «…текст 22:02 ✓».
  const tail = s.match(/(?:\b(?:Вчера|Сегодня|Завтра)[,\s]*)?\b(\d{1,2}:\d{2})\s*(?:✓+|read|unread|доставлен[а-я]*|прочитан[а-я]*|отправлен[а-я]*|draft|черновик)?\s*$/i);
  return tail ? tail[1] : '';
}

function avaFace(name, cls, fallbackBg, inner) {
  const url = overrideAvatarUrl(name);
  const letter = String(name || '').trim().charAt(0).toUpperCase() || '?';
  const bg = fallbackBg && fallbackBg !== 'transparent' ? fallbackBg : 'none';
  return `<span class="${cls}${url ? ' has-img' : ''}" data-ava-name="${escapeHtml(String(name || ''))}` +
    `" data-ava-bg="${escapeHtml(bg)}" style="background-image:${url ? `url('${url}')` : bg}"` +
    `>${escapeHtml(letter)}${inner || ''}</span>`;
}
import { namesLikelySame, transliterateCyrillic } from '../names.js?v=22.70.10';

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
           .replace(/\[(?:PHOTO|ФОТО|IMG|СНИМОК)\s*:?\s*([^\]]*)\]/gi, (mm, d) => '📷 Фото' + (d.trim() ? ': ' + d.trim() : ''))
           .replace(/\[(?:CALL|ЗВОНОК)\s*:?\s*([^\]]*)\]/gi, (mm, b) => /пропущ|missed/i.test(b) ? '📞 Пропущенный звонок' : '📞 Звонок')
           .replace(/\[удалено\]|\[черновик\]|✓+/gi, '').trim();
      preview = p.length > 46 ? p.slice(0, 45) + '…' : p;
    }
    const avaColor = HUD_AVATAR_COLORS[hudHashSeed(displayChatName) % HUD_AVATAR_COLORS.length];
    const avaLetter = displayChatName.trim().charAt(0).toUpperCase() || '?';
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

        // === ЛОВИМ ЗВОНОК ===
        // Звонок — это событие, а не реплика: рисуем строкой во всю ширину,
        // со стрелкой направления и итогом. Пропущенный подсвечен.
        const call = parseCall(message);
        if (call) {
            const dir = call.dir || (isOutgoing ? 'out' : 'in');
            const note = message.replace(call.tag, '').trim();
            chatBodies += `<div class="hud-call-row is-${call.outcome} dir-${dir}">
              <span class="hud-call-ico">${call.outcome === 'missed' ? G_ICONS.callMiss : dir === 'out' ? G_ICONS.callOut : G_ICONS.callIn}</span>
              <span class="hud-call-body">
                <b>${dir === 'out' ? 'Исходящий' : 'Входящий'} — ${escapeHtml(CALL_WORD[call.outcome])}</b>
                <small>${defeatWI(escapeHtml(sender))}${call.dur ? ' · ' + escapeHtml(call.dur) : ''}${note ? ' · ' + defeatWI(escapeHtml(note)) : ''}</small>
              </span>
              ${msgTime ? `<span class="hud-call-time">${escapeHtml(msgTime)}</span>` : ''}
            </div>`;
            return;
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

            // === ЛОВИМ ФОТО ===
            // Настоящей картинки у нас нет и быть не может — рисуем плитку с
            // подписью. Цвет плитки выводим из подписи, чтобы разные снимки
            // отличались друг от друга и не выглядели одной заглушкой.
            const photo = parsePhoto(message);
            if (photo) message = message.replace(photo.tag, '').trim();

            // СОБИРАЕМ ВНУТРЕННОСТИ ПУЗЫРЯ (Текст, Плеер или Снимок)
            let msgInner = photo
                ? `<div class="hud-msg-photo" style="--shot: ${HUD_AVATAR_COLORS[hudHashSeed(photo.desc || 'photo') % HUD_AVATAR_COLORS.length]}">
                     <span class="hud-msg-photo-frame">${G_ICONS.image}</span>
                     ${photo.desc ? `<span class="hud-msg-photo-cap">${defeatWI(escapeHtml(photo.desc))}</span>` : ''}
                   </div>${message ? `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>` : ''}`
                : isVoice 
                ? `<div class="hud-voice-player"><div class="hud-voice-btn">▶</div><div class="hud-voice-line"></div><span class="hud-voice-time">${voiceDur}</span></div><details class="hud-voice-details"><summary>Расшифровка</summary><div class="hud-voice-text">${escapeHtml(message)}</div></details>`
                : `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>`;

            // РИСУЕМ ФИНАЛЬНОЕ СООБЩЕНИЕ
            chatBodies += `<div class="hud-msg-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}">
              ${!isOutgoing ? avaFace(sender, 'hud-msg-avatar', 'rgba(255,255,255,0.1)') : ''}
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
function money(v) {
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
function parseDayMonth(str) {
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

function buildCalendarApp(events, characters, sceneDate) {
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

// Звонок: [CALL: исходящий, принят, 4:12]. Порядок слов внутри не важен —
// разбираем по смыслу, а не по позиции: модели путают порядок постоянно.
function parseCall(text) {
  const m = String(text || '').match(/\[(?:CALL|ЗВОНОК)\s*:?\s*([^\]]*)\]/i);
  if (!m) return null;
  const body = m[1].toLowerCase();
  const dur = (body.match(/\b(\d{1,2}:\d{2})\b/) || [])[1] || '';
  let outcome = 'answered';
  if (/пропущ|missed|no answer|без ответа/.test(body)) outcome = 'missed';
  else if (/отклон|сброш|declined|rejected|отказ/.test(body)) outcome = 'declined';
  // Направление берём из текста, если оно там есть; иначе решит отправитель.
  let dir = null;
  if (/входящ|incoming|in\b/.test(body)) dir = 'in';
  else if (/исходящ|outgoing|out\b/.test(body)) dir = 'out';
  return { tag: m[0], dir, outcome, dur };
}

// Фото: [PHOTO: что на снимке] или [ФОТО: ...]. Подпись остаётся подписью.
function parsePhoto(text) {
  const m = String(text || '').match(/\[(?:PHOTO|ФОТО|IMG|СНИМОК)\s*:?\s*([^\]]*)\]/i);
  if (!m) return null;
  return { tag: m[0], desc: (m[1] || '').trim() };
}

const CALL_WORD = {
  answered: 'Разговор состоялся',
  declined: 'Звонок отклонён',
  missed:   'Пропущенный звонок',
};

function emptyApp(icon, text) {
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

// Иконки поиска — svg, а не эмодзи. Эмодзи рисуются шрифтом системы, у
// каждой ОС по-своему, и экран сразу читается как самоделка; тонкие
// штриховые значки выглядят как настоящий интерфейс браузера.
const G_ICONS = {
  glass: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8 21 21"/></svg>',
  clock: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3.2 2"/></svg>',
  arrow: '<svg class="hud-g-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 16.5 8 8"/><path d="M8 14.5V8h6.5"/></svg>',
  mic:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9.4" y="3.4" width="5.2" height="10" rx="2.6"/><path d="M6.2 11.4a5.8 5.8 0 0 0 11.6 0"/><path d="M12 17.2V20.6"/></svg>',
  lens:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V5.6A1.6 1.6 0 0 1 5.6 4H9"/><path d="M15 4h3.4A1.6 1.6 0 0 1 20 5.6V9"/><path d="M20 15v3.4a1.6 1.6 0 0 1-1.6 1.6H15"/><path d="M9 20H5.6A1.6 1.6 0 0 1 4 18.4V15"/><circle cx="12" cy="12" r="2.6"/></svg>',
  chat:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12.4c0 4-3.8 7.2-8.5 7.2-1 0-2-.15-2.9-.42L4 20.8l1.7-3.9A6.9 6.9 0 0 1 3.5 12.4C3.5 8.4 7.3 5.2 12 5.2s8.5 3.2 8.5 7.2Z"/></svg>',
  person:'<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.4" r="3.7"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/></svg>',
  people:'<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.6" r="3.2"/><path d="M3 19.6a6 6 0 0 1 12 0"/><path d="M16.2 6.1a3.2 3.2 0 0 1 0 6"/><path d="M17.6 14.2a6 6 0 0 1 3.4 5.4"/></svg>',
  image: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.4" y="5" width="17.2" height="14" rx="2.4"/><circle cx="9" cy="10" r="1.7"/><path d="m4.6 17.4 4.6-4.3 3.3 3 2.7-2.3 4.2 3.6"/></svg>',
  note:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.6h8.4L19 8.2v12.2H6z"/><path d="M14.2 3.7v4.6h4.6"/><path d="M9 12.6h6M9 16h4.4"/></svg>',
  map:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m3.6 6.4 5.4-2.2 6 2.2 5.4-2.2v13.4l-5.4 2.2-6-2.2-5.4 2.2z"/><path d="M9 4.2v13.4M15 6.4v13.4"/></svg>',
  callOut: '<svg class="hud-call-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="hud-call-hs" d="M6.4 3.6c.7-.6 1.8-.4 2.3.4l1.5 2.2c.4.6.3 1.4-.2 1.9l-.8.8c-.2.2-.3.5-.1.8.8 1.4 2 2.6 3.4 3.4.3.2.6.1.8-.1l.8-.8c.5-.5 1.3-.6 1.9-.2l2.2 1.5c.8.5 1 1.6.4 2.3l-1 1.1c-.7.8-1.9 1.1-2.9.7-4.6-1.7-8.2-5.3-9.9-9.9-.4-1-.1-2.2.7-2.9z"/><path class="hud-call-ar" d="M15.6 8.4 20.4 3.6"/><path class="hud-call-ar" d="M16.8 3.6h3.6v3.6"/></svg>',
  callIn:  '<svg class="hud-call-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="hud-call-hs" d="M6.4 3.6c.7-.6 1.8-.4 2.3.4l1.5 2.2c.4.6.3 1.4-.2 1.9l-.8.8c-.2.2-.3.5-.1.8.8 1.4 2 2.6 3.4 3.4.3.2.6.1.8-.1l.8-.8c.5-.5 1.3-.6 1.9-.2l2.2 1.5c.8.5 1 1.6.4 2.3l-1 1.1c-.7.8-1.9 1.1-2.9.7-4.6-1.7-8.2-5.3-9.9-9.9-.4-1-.1-2.2.7-2.9z"/><path class="hud-call-ar" d="M20.4 3.6 15.6 8.4"/><path class="hud-call-ar" d="M19.2 8.4h-3.6V4.8"/></svg>',
  callMiss:'<svg class="hud-call-svg" viewBox="0 0 24 24" aria-hidden="true"><path class="hud-call-hs" d="M6.4 3.6c.7-.6 1.8-.4 2.3.4l1.5 2.2c.4.6.3 1.4-.2 1.9l-.8.8c-.2.2-.3.5-.1.8.8 1.4 2 2.6 3.4 3.4.3.2.6.1.8-.1l.8-.8c.5-.5 1.3-.6 1.9-.2l2.2 1.5c.8.5 1 1.6.4 2.3l-1 1.1c-.7.8-1.9 1.1-2.9.7-4.6-1.7-8.2-5.3-9.9-9.9-.4-1-.1-2.2.7-2.9z"/><path class="hud-call-ar" d="M15.6 3.6 20.4 8.4"/><path class="hud-call-ar" d="M20.4 3.6 15.6 8.4"/></svg>',
  card:  '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2.4"/><path d="M2.6 10h18.8"/><path d="M6 14.6h3.4"/></svg>',
  cal:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.2"/><path d="M3.4 10h17.2"/><path d="M8 3.4v3.6M16 3.4v3.6"/></svg>',
  pin:   '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6.4-6 6.4-11a6.4 6.4 0 1 0-12.8 0c0 5 6.4 11 6.4 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  phone: '<svg class="hud-g-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.4" y="2.8" width="11.2" height="18.4" rx="2.6"/><path d="M10.6 18.4h2.8"/></svg>'
};

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
    <div class="hud-phone-app-title">${a.icon} ${escapeHtml(a.label)}<span class="hud-phone-app-owner">${escapeHtml(phoneOwner)}</span></div>
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
          const letter = n.title.trim().charAt(0).toUpperCase() || '?';
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
