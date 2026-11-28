// hud-manager/render/messenger.js
//
// Список переписок и сами переписки в телефоне персонажа: строки списка,
// шапка открытого чата, пузыри, счётчики непрочитанного, участники группы.
//
// Вынесено из phone.js: тот разросся до девятисот строк и держал в себе
// разом мессенджер, кошелёк, календарь и сборку самого аппарата.

import { escapeHtml, defeatWI, hudHashSeed, sanitizeText } from '../utils.js?v=23.90.12';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=23.90.12';
import { G_ICONS } from './icons.js?v=23.90.12';
import { собратьЛенту, непрочитанные, времяВСписке, разобратьСообщение, исходящееСообщение } from './msg-feed.js?v=23.90.12';
import { avaFace, msgTimeOf, collectCounterparts, контактСНастоящимИменем, меткаЛожногоИмени, ложноеИмяHTML } from './phone-common.js?v=23.90.12';
import { безШапокСообщения, заКадромHTML, файлСнимка } from './msg-parts.js?v=23.90.12';
import { ключФонаЧата, обновитьФоныЧатов } from './phone-settings.js?v=23.90.12';
import { namesLikelySame } from '../names.js?v=23.90.12';
import { settings } from '../settings.js?v=23.90.12';
import { getSafeUserName, имяБезПриставки, инициалыИмени } from '../utils.js?v=23.90.12';
import { фотоПоИмени } from '../avatars.js?v=23.90.12';
import { чатСИгроком, ключЧерновика, черновикИгрока, этоИгрок, именаИгрока } from '../user-chat.js?v=23.90.12';

/**
 * Строка ввода чата с игроком (user-chat-ui.js): лицо игрока, «+», поле
 * «Написать как …» и отправка. Пузыри игрока — слева: экран читает владелец.
 * Черновик владельца (модель: он недописал игроку) — строкой над полем.
 */
export function строкаВводаИгрока({ где, чат, черновикВладельца = '', владелец = '' }) {
  const игрок = getSafeUserName();
  const фото = фотоПоИмени(игрок);
  const лицо = фото ? `<i class="hud-uc-me has-img" style="background-image:url('${фото}')"></i>` : '<i class="hud-uc-me">' + escapeHtml(инициалыИмени(игрок, 1)) + '</i>';
  const черн = черновикИгрока(ключЧерновика(где, чат));
  const кто = escapeHtml(имяБезПриставки(игрок));
  return '<div class="hud-uc-status" hidden></div>'
    + (черновикВладельца ? '<div class="hud-uc-owner-draft">✎ ' + escapeHtml(имяБезПриставки(владелец)) + ' · не отправлено: «' + defeatWI(escapeHtml(черновикВладельца)) + '»</div>' : '')
    + '<div class="hud-phone-input-bar is-user-chat' + (черн ? ' has-text' : '') + '" data-uc-bar="1">'
    + '<span class="hud-phone-attach hud-uc-attach" data-uc="attach" role="button" tabindex="0" aria-label="Вложение" title="Голосовое, фото, видео, звонок">+</span>'
    // Поле — настоящее с самого начала: первые буквы не теряются, пока грузится user-chat-ui.js.
    + '<div class="hud-phone-inputfield hud-uc-field' + (черн ? ' has-draft' : '') + '" data-uc="field">' + лицо + '<textarea class="hud-uc-input" rows="1" enterkeyhint="send" aria-label="Написать как ' + кто + '" title="Написать как ' + кто + '" placeholder="Сообщение…">' + escapeHtml(черн) + '</textarea></div>'
    + '<span class="hud-phone-send hud-uc-send" data-uc="send" role="button" tabindex="0" aria-label="Отправить" title="Отправить">↑</span></div>';
}

/**
 * Кнопки под палитрой реакций (events.js, долгое нажатие на пузырь) в чатах
 * игрока: ответить, переслать, а своё непрочитанное — удалить. '' — не чат игрока.
 */
export function кнопкиПузыря(пузырь) {
  if (settings.userChat === false || !пузырь || !пузырь.closest) return '';
  if (!пузырь.closest('.hud-phone-subbody[data-user-chat]')) return '';
  const кто = (пузырь.closest('.hud-msg-content')?.querySelector('.hud-msg-sender')?.textContent || '').trim();
  let имена = [getSafeUserName()];
  try { const из = JSON.parse(пузырь.closest('.hud-phone-subbody[data-user-chat]').dataset.ucNames || '[]'); if (Array.isArray(из) && из.length) имена = из; } catch (_) { /* только имя персоны */ }
  const свой = этоИгрок(кто, имена);
  // Статус строки, а не значок: открытый чат рисует входящие прочитанными (events.js).
  const прочитан = /^(?:read|прочитан\S*)$/.test(String(пузырь.dataset.st || ''));
  return '<div class="hud-uc-actions">'
    + '<button type="button" data-uc="reply">' + G_ICONS.chat + '<span>Ответить</span></button>'
    + '<button type="button" data-uc="forward">' + G_ICONS.forward + '<span>Переслать</span></button>'
    + (свой && !прочитан ? '<button type="button" data-uc="delete">' + G_ICONS.block + '<span>Удалить</span></button>' : '')
    + '</div>';
}

export function buildMessengerHTML(chatsMap, uid, mainCharName, sceneDate, контакты = null) {
  обновитьФоныЧатов();
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
    // Модель часто называет чат именем владельца телефона («Дамиан»), хотя
    // в шапке должен стоять собеседник. Разбираем участников из самих
    // сообщений и подставляем того, кто пишет владельцу.
    // Чат с игроком: в нём можно писать от его лица (user-chat-ui.js).
    // Игрок может быть записан в телефоне иначе («Смирнова» — по фамилии): чат его и под этим именем.
    const именаИгрокаЗдесь = именаИгрока(getSafeUserName(), контакты);
    const сИгроком = settings.userChat !== false && чатСИгроком(rawChatName, { pp: chatObj.participants, ms: chatObj.messages }, именаИгрокаЗдесь);
    // Игрок, записанный по фамилии («Грей»), подписывает свои строки именем
    // («Вера»): это один собеседник, а не группа. Иначе после первой же его
    // строки чат считался групповым и в «+» пропадал «Звонок». Остаётся то
    // имя, под которым он сохранён в телефоне.
    const counterparts = (() => {
      const все = collectCounterparts(chatObj.messages, activeOwner);
      const игрок = все.filter(c => этоИгрок(c, именаИгрокаЗдесь));
      if (игрок.length < 2) return все;
      const сохранён = игрок.find(c => именаИгрокаЗдесь.slice(1).some(з => этоИгрок(c, з))) || игрок[0];
      return все.filter(c => !игрок.includes(c) || c === сохранён);
    })();
    const isGroupChat = Boolean(chatObj.participants) || counterparts.length > 1;
    const телефонЧата = String(uid).startsWith('phone2-') ? 'phx' : 'cm';
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
    // Контакт под чужим именем: в телефоне — как сохранено. Кто это на деле,
    // открывается по нажатию; лицо тоже по записи, иначе буква выдаст имя.
    const личность = isGroupChat ? null : контактСНастоящимИменем(контакты, displayChatName);
    if (личность) displayChatName = личность.сохранён;

    // Пустая строка честнее выдуманного «12:00»: если во всех сообщениях
    // времени нет, лучше не показывать никакого, чем неверное. Вчерашнее —
    // «Вчера», старое — датой: голые «20:14» вчерашнего читались сегодняшними.
    const сообщения = Array.isArray(chatObj.messages) ? chatObj.messages : [];
    let последнееСВременем = -1;
    сообщения.forEach((m, i) => { if (msgTimeOf(m)) последнееСВременем = i; });
    const latestTime = последнееСВременем >= 0 ? времяВСписке(сообщения, последнееСВременем, sceneDate) : '';
    const unreadCount = непрочитанные(сообщения, activeOwner).length;

    // Превью последнего сообщения для строки списка: снимаем служебные метки,
    // отправителя и время — остаётся только сам текст.
    let preview = '';
    if (Array.isArray(chatObj.messages) && chatObj.messages.length) {
      const lastRaw = String(chatObj.messages[chatObj.messages.length - 1] || '');
      const послед = разобратьСообщение(lastRaw);
      let p = послед.текст;
      p = безШапокСообщения(p).replace(/\[(?:VOICE|ГОЛОС)_?\d{0,2}:?\d{0,2}\]/gi, '🎤 Голосовое сообщение')
           .replace(/\[(?:VIDEO|ВИДЕО|VID|РОЛИК)[ _]?\d{0,2}:?\d{0,2}\s*:?\s*([^\]]*)\]/gi, (mm, d) => '🎬 Видео' + (d.trim() ? ': ' + d.trim() : ''))
           .replace(/\[(?:PHOTO|ФОТО|IMG|СНИМОК)\s*:?\s*([^\]]*)\]/gi, (mm, d) => { const о = файлСнимка(d).описание; return '📷 Фото' + (о ? ': ' + о : ''); })
           .replace(/\[(?:CALL|ЗВОНОК)\s*:?\s*([^\]]*)\]/gi, (mm, b) => /пропущ|missed/i.test(b) ? '📞 Пропущенный звонок' : '📞 Звонок')
           .replace(/\[\s*(?:удалено|deleted?|черновик|draft)\s*\]|✓+/gi, '').trim();
      // Недописанное своё — «Черновик:», удалённое — «Сообщение удалено»,
      // как в мессенджере, а не текстом, будто его отправили.
      if (послед.удалено) p = '🚫 Сообщение удалено';
      else if (послед.черновик && исходящееСообщение(послед.кто, activeOwner) && p) p = 'Черновик: ' + p;
      preview = p.length > 46 ? p.slice(0, 45) + '…' : p;
    }
    const avaColor = HUD_AVATAR_COLORS[hudHashSeed(displayChatName) % HUD_AVATAR_COLORS.length];
    const isGroup = Boolean(chatObj.participants);

    chatList += `<button class="hud-phone-chat-row" data-chat-target="subchat-${uid}-${idx}">
      ${avaFace(displayChatName, 'hud-phone-chat-ava', `linear-gradient(150deg, ${avaColor}, rgba(0,0,0,.55))`, isGroup ? '<i class="hud-phone-chat-group">👥</i>' : '')}
      <span class="hud-phone-chat-meta">
        <b>${личность && личность.ложное ? меткаЛожногоИмени() : ''}${defeatWI(escapeHtml(displayChatName))}</b>
        <small>${preview ? escapeHtml(preview) : 'Нет сообщений'}</small>
      </span>
      <span class="hud-phone-chat-side">
        <em>${escapeHtml(latestTime)}</em>
        ${unreadCount > 0 ? `<i class="hud-unread-badge">${unreadCount}</i>` : ''}
      </span>
    </button>`;

    // Лента нужна раньше шапки: «в сети» считается из неё.
    const лента = собратьЛенту(chatObj.messages, { owner: activeOwner, сцена: sceneDate, черновикВПоле: true, блокВПоле: true, цветаИмён: isGroupChat, имяНаЭкране: (кто) => (контактСНастоящимИменем(контакты, кто) || { сохранён: кто }).сохранён });
    const строкаВСети = !isGroupChat && лента.вСети && !лента.блокировка ? `<span class="hud-phone-online">в сети: ${escapeHtml(лента.вСети)}</span>` : '';
    const ключФона = ключФонаЧата(displayChatName);

    chatBodies += `<div class="hud-phone-subbody" id="subchat-${uid}-${idx}" data-chat-key="${escapeHtml(rawChatName)}"${isGroup ? ' data-chat-group="1"' : ''}${сИгроком ? ` data-user-chat="1" data-uc-names="${escapeHtml(JSON.stringify(именаИгрокаЗдесь))}"` : ''}>
      <div class="hud-phone-header"><span class="hud-phone-back">⟨</span><div class="hud-phone-title-group" ${chatObj.participants ? 'style="cursor:pointer;" title="Нажми, чтобы увидеть участников"' : ''}><span class="hud-phone-name">${defeatWI(escapeHtml(displayChatName))} ${chatObj.participants ? '<span style="font-size:0.8em; opacity:0.7;">▾</span>' : ''}</span>${строкаВСети}${личность && личность.ложное ? ложноеИмяHTML(личность) : ''}${chatObj.participants ? `<div class="hud-phone-participants-list">${G_ICONS.people} Участники: ${escapeHtml(chatObj.participants)}</div>` : ''}</div><span class="hud-phone-options" data-chat-bg="${ключФона}" role="button" tabindex="0" aria-label="Фон этого чата" title="Фон этого чата">⋮</span></div>
      <div class="hud-phone-chat-area${isGroupChat ? ' is-group' : ''}" data-bgk="${ключФона}">`;
		
    // Сообщения, разделители дней и черновик — общая лента (msg-feed.js):
    // ровно то же самое рисуют перехваты.
    const activeDraft = лента.draft;
    chatBodies += лента.html;
    if (лента.блокировка) chatBodies += `</div><div class="hud-phone-input-bar is-blocked">${заКадромHTML(лента.блокировка, лента.блокировка.время)}</div></div>`;
    else if (сИгроком) chatBodies += `</div>${строкаВводаИгрока({ где: телефонЧата, чат: rawChatName, черновикВладельца: activeDraft, владелец: activeOwner })}</div>`;
    else chatBodies += `</div><div class="hud-phone-input-bar"><span class="hud-phone-attach">+</span><div class="hud-phone-inputfield ${activeDraft ? 'draft-active' : 'placeholder'}">${activeDraft ? escapeHtml(activeDraft) : 'Сообщение...'}</div><span class="hud-phone-send disabled">↑</span></div></div>`;
  });
  return chatList + `</div>` + `<div class="hud-phone-chat-stage">` + chatBodies + `</div>`;
}
