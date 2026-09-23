// hud-manager/render/msg-parts.js
//
// Разбор тегов внутри строки сообщения и сборка внутренностей пузыря:
// звонок, снимок, ролик, голосовое, цитата, пересылка, опрос.
//
// Один сборщик на оба мессенджера — личный телефон и перехваты. Раньше он
// жил в phone.js, и в перехватах теги оставались сырым текстом посреди
// сообщения просто потому, что до них не доходили руки.

import { escapeHtml, defeatWI, hudHashSeed } from '../utils.js?v=23.4.6';
import { HUD_AVATAR_COLORS } from '../avatars.js?v=23.4.6';
import { G_ICONS } from './icons.js?v=23.4.6';

// Звонок: [CALL: исходящий, принят, 4:12]. Порядок слов внутри не важен —
// разбираем по смыслу, а не по позиции: модели путают порядок постоянно.
export function parseCall(text) {
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

// Видео: [VIDEO: что в кадре] или [ВИДЕО: ...]. Длительность необязательна и
// пишется как [VIDEO_1:24: ...] — тем же способом, что у голосовых, чтобы
// модели не пришлось запоминать второй формат.
function parseVideo(text) {
  const m = String(text || '').match(/\[(?:VIDEO|ВИДЕО|VID|РОЛИК)[ _]?(\d{1,2}:\d{2})?\s*:?\s*([^\]]*)\]/i);
  if (!m) return null;
  return { tag: m[0], dur: (m[1] || '').trim(), desc: (m[2] || '').trim() };
}

// Ответ на конкретное сообщение: [REPLY: кого цитируем :: что было сказано].
// Разделитель «::», а не «|»: вертикальная черта уже режет саму строку
// сообщения на текст, время и отметку о прочтении, и тег доезжал сюда
// обрубленным на первой же черте.
// Имя необязательно — тогда цитата идёт без подписи.
function parseReply(text) {
  const m = String(text || '').match(/\[(?:REPLY|ОТВЕТ|RE)\s*:\s*([^\]]*)\]/i);
  if (!m) return null;
  const тело = (m[1] || '').trim();
  const черта = тело.indexOf('::');
  return черта > -1
    ? { tag: m[0], who: тело.slice(0, черта).trim(), quote: тело.slice(черта + 2).trim() }
    : { tag: m[0], who: '', quote: тело };
}

// Переслано: [FWD: от кого] или [ПЕРЕСЛАНО: от кого].
function parseForward(text) {
  const m = String(text || '').match(/\[(?:FWD|FORWARD|ПЕРЕСЛАНО|ПЕРЕСЛАЛ[АО]?)\s*:?\s*([^\]]*)\]/i);
  if (!m) return null;
  return { tag: m[0], from: (m[1] || '').trim() };
}

// Опрос: [POLL: Вопрос ;; Вариант = Кто, Кто ;; Вариант без голосов].
// Разделитель «;;» по той же причине, что и у цитаты: «|» занят разбором
// самой строки сообщения.
// Проценты считаем сами: заставлять модель делить в уме — верный способ
// получить «40% и 40%» при трёх голосах из пяти.
function parsePoll(text) {
  const m = String(text || '').match(/\[(?:POLL|ОПРОС|ГОЛОСОВАНИЕ)\s*:\s*([\s\S]*?)\]/i);
  if (!m) return null;
  const части = (m[1] || '').split(/;;/).map(s => s.trim()).filter(Boolean);
  if (!части.length) return null;
  const вопрос = части.shift();
  const варианты = части.map(кусок => {
    const знак = кусок.indexOf('=');
    const подпись = знак > -1 ? кусок.slice(0, знак).trim() : кусок.trim();
    const голоса = знак > -1
      ? кусок.slice(знак + 1).split(/[,;]/).map(s => s.trim()).filter(Boolean)
      : [];
    return { label: подпись, voters: голоса };
  }).filter(в => в.label);
  if (!варианты.length) return null;
  const всего = варианты.reduce((n, в) => n + в.voters.length, 0);
  for (const в of варианты) {
    в.count = в.voters.length;
    в.percent = всего ? Math.round((в.count / всего) * 100) : 0;
  }
  const лучший = Math.max(...варианты.map(в => в.count));
  for (const в of варианты) в.leading = всего > 0 && в.count === лучший;
  return { tag: m[0], question: вопрос, options: варианты, total: всего };
}

// Осциллограмма голосового. Полоски выводим из самого текста: одно и то же
// сообщение всегда рисуется одинаково, а разные — по-разному. Случайные
// числа не годятся: при каждой пересборке карточки узор бы менялся.
function voiceWaveHTML(seed, dur) {
  const полос = 34;
  let h = hudHashSeed(String(seed || '') + '|' + String(dur || ''));
  let out = '';
  for (let i = 0; i < полос; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    // Края тише середины — так это выглядит как речь, а не как забор.
    const огибающая = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / полос);
    const высота = Math.round((18 + (h % 62)) * огибающая);
    out += `<i style="height:${Math.max(12, высота)}%"></i>`;
  }
  return `<span class="hud-voice-wave" aria-hidden="true">${out}</span>`;
}

// Разметка опроса. Проценты и ширина полос считаются здесь, модель
// присылает только голоса.
function buildPollHTML(poll) {
  const строки = poll.options.map(в => {
    const кто = в.voters.length
      ? `<span class="hud-poll-voters">${defeatWI(escapeHtml(в.voters.join(', ')))}</span>`
      : '';
    return `<div class="hud-poll-option${в.leading && poll.total ? ' is-leading' : ''}">
        <div class="hud-poll-head">
          <span class="hud-poll-label">${defeatWI(escapeHtml(в.label))}</span>
          <span class="hud-poll-percent">${в.percent}%</span>
        </div>
        <div class="hud-poll-bar"><span style="width:${в.percent}%"></span></div>
        ${кто}
      </div>`;
  }).join('');
  const итог = poll.total
    ? `${poll.total} ${склонениеГолосов(poll.total)}`
    : 'Пока никто не выбрал';
  return `<div class="hud-poll">
      <div class="hud-poll-question">${defeatWI(escapeHtml(poll.question))}</div>
      ${строки}
      <div class="hud-poll-total">${итог}</div>
    </div>`;
}

function склонениеГолосов(n) {
  const сотня = n % 100, десяток = n % 10;
  if (сотня >= 11 && сотня <= 14) return 'голосов';
  if (десяток === 1) return 'голос';
  if (десяток >= 2 && десяток <= 4) return 'голоса';
  return 'голосов';
}

// Устойчивый ключ сообщения: считается из исходной строки, поэтому не
// меняется ни от пересборки карточки, ни от того, что на пузырь навесили
// пометку-реакцию.
export function msgKey(rawMessage) {
  const s = String(rawMessage || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

// Внутренности пузыря: снимок, ролик, голосовое или просто текст.
// Один сборщик на оба мессенджера — личный телефон и перехваты. Раньше разбор
// жил прямо в цикле телефона, и в перехватах снимки с роликами оставались
// сырым тегом [PHOTO: ...] посреди текста.
export function buildBubbleInner(rawMessage) {
  let message = String(rawMessage || '');

  // Шапки снимаем первыми: «переслано» и цитата стоят над содержимым
  // пузыря, каким бы оно ни было — текстом, снимком или голосовым.
  const forward = parseForward(message);
  if (forward) message = message.replace(forward.tag, '').trim();
  const reply = parseReply(message);
  if (reply) message = message.replace(reply.tag, '').trim();

  const шапка = (forward
    ? `<div class="hud-msg-fwd">${G_ICONS.forward} Переслано${forward.from ? ' от ' + defeatWI(escapeHtml(forward.from)) : ''}</div>`
    : '')
  + (reply
    ? `<div class="hud-msg-reply">${reply.who ? `<span class="hud-msg-reply-who">${defeatWI(escapeHtml(reply.who))}</span>` : ''}`
      + `<span class="hud-msg-reply-text">${defeatWI(escapeHtml(reply.quote))}</span></div>`
    : '');

  // Опрос занимает пузырь целиком: подпись к нему не нужна.
  const poll = parsePoll(message);
  if (poll) {
    const остаток = message.replace(poll.tag, '').trim();
    return шапка + buildPollHTML(poll)
      + (остаток ? `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(остаток)}</div>` : '');
  }

  // Голосовое: [VOICE_M:SS]. Длительность необязательна.
  let isVoice = false, voiceDur = '';
  const voiceMatch = message.match(/\[(?:VOICE|ГОЛОС)_?(\d{1,2}:\d{2})?\]/i);
  if (voiceMatch) {
    isVoice = true;
    voiceDur = voiceMatch[1] || '0:15';
    message = message.replace(voiceMatch[0], '').trim();
  }

  // Снимок. Настоящей картинки у нас нет и быть не может — рисуем плитку с
  // подписью. Цвет выводим из подписи, чтобы разные снимки отличались друг
  // от друга, а не выглядели одной заглушкой.
  const photo = parsePhoto(message);
  if (photo) message = message.replace(photo.tag, '').trim();

  // Ролик — то же самое плюс кнопка воспроизведения и длительность.
  const video = !photo ? parseVideo(message) : null;
  if (video) message = message.replace(video.tag, '').trim();

  const подпись = message ? `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>` : '';
  const цвет = (seed) => HUD_AVATAR_COLORS[hudHashSeed(seed) % HUD_AVATAR_COLORS.length];

  if (photo) {
    return шапка + `<div class="hud-msg-photo hud-msg-media" role="button" tabindex="0" data-media="photo"
              data-media-desc="${escapeHtml(photo.desc)}"
              title="Открыть описание снимка"
              style="--shot: ${цвет(photo.desc || 'photo')}">
           <span class="hud-msg-photo-frame">${G_ICONS.image}</span>
           ${photo.desc ? `<span class="hud-msg-photo-cap">${defeatWI(escapeHtml(photo.desc))}</span>` : ''}
         </div>${подпись}`;
  }
  if (video) {
    return шапка + `<div class="hud-msg-photo hud-msg-video hud-msg-media" role="button" tabindex="0" data-media="video"
              data-media-desc="${escapeHtml(video.desc)}" data-media-dur="${escapeHtml(video.dur)}"
              title="Открыть описание ролика"
              style="--shot: ${цвет(video.desc || 'video')}">
           <span class="hud-msg-photo-frame">
             <span class="hud-msg-video-play" aria-hidden="true"></span>
             ${video.dur ? `<span class="hud-msg-video-dur">${escapeHtml(video.dur)}</span>` : ''}
           </span>
           ${video.desc ? `<span class="hud-msg-photo-cap">${defeatWI(escapeHtml(video.desc))}</span>` : ''}
         </div>${подпись}`;
  }
  if (isVoice) {
    // Вместо ровной черты — полоски, выведенные из самого текста: голосовые
    // перестают быть одинаковыми заглушками.
    return шапка + `<div class="hud-voice-player"><div class="hud-voice-btn">▶</div>`
      + voiceWaveHTML(message || rawMessage, voiceDur)
      + `<span class="hud-voice-time">${escapeHtml(voiceDur)}</span></div>` +
      // Расшифровка есть у каждого голосового. Если модель не написала слов,
      // так и говорим, а не прячем раскрывашку: иначе кажется, что сломалось.
      (message
        ? `<details class="hud-voice-details"><summary>Расшифровка</summary><div class="hud-voice-text">${escapeHtml(message)}</div></details>`
        : `<details class="hud-voice-details is-empty"><summary>Расшифровка</summary><div class="hud-voice-text">Слов в этом голосовом модель не записала.</div></details>`);
  }
  return шапка + `<div class="hud-msg-text" style="word-break: break-word;">${escapeHtml(message)}</div>`;
}

// Звонок как событие во всю ширину: одна строка и в телефоне, и в перехватах.
export function buildCallRow(rawMessage, { sender = '', time = '', outgoing = false } = {}) {
  const call = parseCall(rawMessage);
  if (!call) return '';
  const dir = call.dir || (outgoing ? 'out' : 'in');
  const note = String(rawMessage || '').replace(call.tag, '').trim();
  return `<div class="hud-call-row is-${call.outcome} dir-${dir}">
      <span class="hud-call-ico">${call.outcome === 'missed' ? G_ICONS.callMiss : dir === 'out' ? G_ICONS.callOut : G_ICONS.callIn}</span>
      <span class="hud-call-body">
        <b>${dir === 'out' ? 'Исходящий' : 'Входящий'} — ${escapeHtml(CALL_WORD[call.outcome])}</b>
        <small>${defeatWI(escapeHtml(sender))}${call.dur ? ' · ' + escapeHtml(call.dur) : ''}${note ? ' · ' + defeatWI(escapeHtml(note)) : ''}</small>
      </span>
      ${time ? `<span class="hud-call-time">${escapeHtml(time)}</span>` : ''}
    </div>`;
}

const CALL_WORD = {
  answered: 'Разговор состоялся',
  declined: 'Звонок отклонён',
  missed:   'Пропущенный звонок',
};
