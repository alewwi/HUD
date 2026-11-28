// hud-manager/user-chat-ui.js
//
// Переписка от лица игрока на экране: поле ввода в чатах с {{user}}, «+» с
// голосовым, фото, видео, звонком и опросом, карандаш «Новое сообщение»,
// ответ, пересылка и удаление долгим нажатием на пузырь, запрос ответа
// персонажа и строка «печатает…». Чистая часть — user-chat.js.
//
// Писать можно только в последнем HUD чата: следующий ответ модели берёт
// снимок именно из него. Новые строки дописываются прямо в HUD этого
// сообщения (того свайпа, что на экране) — нового сообщения в чате нет.
//
// Грузится при первом касании поля или кнопки (index.js, загрузитьПереписку).

import { settings } from './settings.js?v=23.90.14';
import { escapeHtml, getSafeUserName, имяБезПриставки } from './utils.js?v=23.90.14';
import { G_ICONS } from './render/icons.js?v=23.90.14';
import { msgKey, путьСнимка } from './render/msg-parts.js?v=23.90.14';
import { разобратьСообщение } from './render/msg-feed.js?v=23.90.14';
import { extractHudBlock, заменитьHudБлоки } from './hud-block.js?v=23.90.14';
import { собратьСнимок, строкаСнимка, решитьNSFW, последниеТекстыЧата } from './hud-snapshot.js?v=23.90.14';
import { английский, языкЗначенийМодели } from './i18n.js?v=23.90.14';
import { фотоПоИмени } from './avatars.js?v=23.90.14';
import {
  этоИгрок, чатСИгроком, перехватИгрока, времяОтправки, строкаИгрока, найтиПереписку, дописатьВПереписку,
  удалитьСтрокуИгрока, промптОтвета, разобратьОтвет, применитьЗвонок, запомнитьПереписку,
  ключЧерновика, черновикИгрока, запомнитьЧерновик, сторонаСтроки,
  имяФайлаСнимка, новыеСнимки, вписатьОписанияСнимков, именаИгрока,
  номерЗвонка, длительностьЗвонка, строкаЗвонка, промптЗвонка, разобратьЗвонок, разобратьЗвонокСТемой, запомнитьЗвонок, найтиЗвонок,
} from './user-chat.js?v=23.90.14';

// Всё нужное из index.js (геттеры — значения живые): showHudToast,
// последнийHUD, hudНомера, разборНомера, записатьПереписку, идётОтвет,
// загрузитьПерегенерацию, buildHudLoreContext, getStContextSafe, текстСообщенияЧата.
let основа = null;
export function подключить(связь) { основа = связь; }

const тост = (вид, заголовок, текст) => { try { основа.showHudToast(вид, заголовок, текст); } catch (_) { /* без уведомления */ } };
const игрок = () => getSafeUserName();
const пауза = (мс) => new Promise(r => setTimeout(r, мс));

/* --- Где мы: сообщение, переписка, собеседник ---------------------------------- */

const mesУзла = (узел) => узел && узел.closest ? узел.closest('.mes, .hud-side-mes') : null;
const номерУзла = (узел) => { const м = mesУзла(узел); const n = м ? Number(м.getAttribute('mesid')) : NaN; return Number.isInteger(n) ? n : null; };

/** Телефон, где лежит узел: 'phx' — второй телефон, иначе 'cm'. */
function телефонУзла(узел) {
  const вид = узел.closest('[data-phone-uid]');
  const uid = вид ? String(вид.dataset.phoneUid || '') : '';
  return uid.startsWith('phone2-') ? 'phx' : 'cm';
}

/** Переписка, к которой относится узел: { где, ключ | цель+чат, тело } или null. */
function местоУзла(узел) {
  const тело = узел && узел.closest ? узел.closest('.hud-phone-subbody[data-user-chat]') : null;
  if (!тело) return null;
  if (тело.dataset.ucWhere === 'tp') return { где: 'tp', цель: тело.dataset.ucTarget || '', чат: тело.dataset.ucChat || '', тело, игрок: игрок() };
  return { где: телефонУзла(тело), ключ: тело.dataset.chatKey || '', тело, игрок: игрок(), имена: (() => { try { return JSON.parse(тело.dataset.ucNames || '[]'); } catch (_) { return []; } })() };
}
const чатТаверны = () => { try { return String(основа.getStContextSafe()?.getCurrentChatId?.() ?? ''); } catch (_) { return ''; } };
const свайпНомера = (номер) => { const м = основа.getStContextSafe()?.chat?.[номер]; return м && Number.isInteger(м.swipe_id) ? м.swipe_id : 0; };
const ключМеста = (номер, место) => [чатТаверны(), номер, свайпНомера(номер), место.где, место.где === 'tp' ? место.цель + '\u0000' + место.чат : место.ключ].join('|');
const подписьЧата = (место) => место.где === 'tp' ? (место.цель || '') : (место.ключ || '');

/** Как игрок записан в этом чате (messenger.js кладёт в data-uc-names): имя и контакты. */
function именаМеста(место, номер = null) {
  try { const из = JSON.parse((место && место.тело && место.тело.dataset.ucNames) || '[]'); if (Array.isArray(из) && из.length) return из; } catch (_) { /* ниже */ }
  if (место && место.где !== 'tp' && номер !== null) {
    const д = основа.разборНомера(номер);
    const контакты = место.где === 'phx' ? д && д.phone2 && д.phone2.phone && д.phone2.phone.contacts : д && д.phone && д.phone.contacts;
    return именаИгрока(игрок(), контакты || []);
  }
  return [игрок()];
}

/** Последний HUD или объяснение, почему писать нельзя. */
function можноПисать(номер) {
  if (settings.userChat === false) { тост('info', 'Переписка', 'Переписка от лица игрока выключена в настройках.'); return false; }
  if (основа.идётОтвет()) { тост('info', 'Переписка', 'Дождитесь конца ответа модели.'); return false; }
  const последний = основа.последнийHUD();
  if (номер === null || последний < 0) { тост('info', 'Переписка', 'В чате нет HUD — писать некуда.'); return false; }
  if (номер !== последний) { тост('info', 'Переписка', 'Писать можно только в последнем HUD: следующий ответ модели продолжит переписку оттуда.'); return false; }
  return true;
}

/** Имя владельца телефона в этом HUD (cm — phn.ow, phx — phx.ow). */
function владелецТелефона(hud, где, данные) {
  const из = где === 'phx' ? (hud && hud.phx) : hud;
  const явно = из && из.phn && typeof из.phn === 'object' ? String(из.phn.ow || '').trim() : '';
  if (явно && !/^(?:empty|none)$/i.test(явно)) return явно;
  const чаты = из && из.cm && typeof из.cm === 'object' ? Object.values(из.cm) : [];
  const ow = чаты.map(ч => ч && String(ч.ow || '').trim()).find(Boolean);
  if (ow) return ow;
  const ctx = основа.getStContextSafe();
  return String((данные && данные.phone && данные.phone.owner) || (ctx && ctx.name2) || '').trim();
}

/** Кто отвечает и кому пишет игрок: { кто, состав }. */
function собеседники(место, hud, найдено) {
  const запись = найдено && найдено.запись;
  const pp = String((запись && запись.pp) || '').split(/[;,]/).map(s => s.trim()).filter(Boolean).filter(и => !этоИгрок(и, игрок()));
  if (место.где === 'tp') return { кто: место.цель || (запись && запись.tg) || '', состав: pp.length > 1 ? pp : [] };
  const ow = String((запись && запись.ow) || '').trim() || владелецТелефона(hud, место.где);
  return { кто: ow, состав: pp.length > 1 ? pp : [] };
}

/** Строки этой переписки, которые карточка показывает из прошлых ходов. */
function прежниеСтроки(номер, место) {
  try {
    const данные = основа.разборНомера(номер);
    if (!данные) return [];
    if (место.где === 'tp') {
      const п = (данные.intercepts || []).find(x => x && этоИгрок(String(x.target || ''), место.цель) && (!место.чат || String(x.chatName || '').trim().toLowerCase() === место.чат.toLowerCase()));
      return п && Array.isArray(п.messages) ? п.messages : [];
    }
    const карта = место.где === 'phx' ? (данные.phone2 && данные.phone2.chatsMap) : данные.chatsMap;
    const ч = карта && карта[место.ключ];
    return ч && Array.isArray(ч.messages) ? ч.messages : [];
  } catch (_) { return []; }
}

/* --- Поле ввода ------------------------------------------------------------------ */

function полеИз(бар) { return бар && бар.querySelector('.hud-uc-input'); }

/** Фокус в поле ввода (поле — настоящее с отрисовки, messenger.js). */
function открытьПоле(бар) {
  const поле = полеИз(бар);
  if (поле) {
    try { поле.focus({ preventScroll: true }); } catch (_) { поле.focus(); }
    try { поле.setSelectionRange(поле.value.length, поле.value.length); } catch (_) { /* не текстовое поле */ }
  }
  return поле;
}

/** Поле получило фокус: в старом HUD писать нельзя — объясняем и снимаем фокус. */
export function фокусПоля(поле) {
  if (!поле || !поле.isConnected) return;
  const номер = номерУзла(поле);
  const последний = основа.последнийHUD();
  if (settings.userChat === false || номер === null || последний < 0 || номер === последний) return;
  поле.blur();
  можноПисать(номер);
}

/* --- Цитата (ответ на сообщение) -------------------------------------------------- */

const цитаты = new Map();
function показатьЦитату(бар, место) {
  const ц = цитаты.get(ключЧерновика(место.где, подписьЧата(место)));
  let полка = бар.parentElement && бар.parentElement.querySelector(':scope > .hud-uc-quote');
  if (!ц) { if (полка) полка.remove(); return; }
  if (!полка) {
    полка = document.createElement('div');
    полка.className = 'hud-uc-quote';
    бар.before(полка);
  }
  полка.innerHTML = `<span class="hud-uc-quote-ico">${G_ICONS.chat}</span><span class="hud-uc-quote-body"><b>${escapeHtml(ц.кто || 'Ответ')}</b><small>${escapeHtml(ц.что)}</small></span><span class="hud-uc-quote-x" data-uc="unquote" role="button" tabindex="0" aria-label="Не отвечать" title="Не отвечать">✕</span>`;
}

/* --- Запись в HUD ------------------------------------------------------------------- */

/**
 * Дописать строки игрока в переписку последнего HUD и перерисовать карточку.
 * м — поля сообщения (строкаИгрока). → true, если записано.
 */
async function записатьСтрокиИгрока(узел, место, сообщения) {
  const номер = номерУзла(узел);
  if (!можноПисать(номер)) return false;
  const hud = основа.hudНомера(номер);
  if (!hud) { тост('error', 'Переписка', 'HUD сообщения не разобрался — ничего не записано.'); return false; }
  const данные = основа.разборНомера(номер);
  const времяСцены = данные && данные.scene ? String(данные.scene['Время'] || '') : '';
  const найдено = найтиПереписку(hud, место);
  const прежние = найдено && найдено.ms.length ? [] : прежниеСтроки(номер, место);
  const { кто, состав } = собеседники(место, hud, найдено);
  const кому = состав.length ? (место.где === 'tp' ? место.цель : место.ключ) : кто;
  const время = времяОтправки(времяСцены, [...прежние, ...((найдено && найдено.ms) || [])]);
  const строки = сообщения.map(м => строкаИгрока({ игрок: игрок(), кому, время, м }));
  const владелец = место.где === 'tp' ? '' : владелецТелефона(hud, место.где, данные);
  try {
    await основа.записатьПереписку(номер, (h, message) => {
      дописатьВПереписку(h, место, строки, { прежние, владелец, игрок: игрок() });
      запомнитьПереписку(message, { чат: подписьЧата(место), где: место.где, строки });
    }, место.тело);
  } catch (e) {
    тост('error', 'Не отправлено', String((e && e.message) || e));
    return false;
  }
  return true;
}

/* --- Отправка ---------------------------------------------------------------------- */

const пишутся = new Set();
async function отправитьТекст(бар) {
  const место = местоУзла(бар);
  const поле = полеИз(бар);
  if (!место) return;
  const занято = ключЧерновика(место.где, подписьЧата(место));
  if (пишутся.has(занято)) return;
  const текст = поле ? поле.value.replace(/\s*\n+\s*/g, ' ').trim() : '';
  if (!текст) { открытьПоле(бар); return; }
  const ключ = ключЧерновика(место.где, подписьЧата(место));
  const м = { текст };
  const ц = цитаты.get(ключ);
  if (ц) м.ответ = ц;
  пишутся.add(занято);
  try {
    const ок = await отправить(бар, место, [м]);
    if (ок) { запомнитьЧерновик(ключ, ''); цитаты.delete(ключ); }
  } finally { пишутся.delete(занято); }
}

/** Записать и через паузу попросить ответ. Карточка перерисуется — восстанавливаем чат. */
async function отправить(узел, место, сообщения) {
  const номер = номерУзла(узел);
  const печатал = !!(полеИз(узел.closest('.hud-phone-subbody')?.querySelector('.hud-phone-input-bar') || null));
  const ок = await записатьСтрокиИгрока(узел, место, сообщения);
  if (!ок) return false;
  const ключ = ключМеста(номер, место);
  запланироватьОтвет(ключ, номер, { ...место, тело: null });
  void вернутьЧат(номер, место, { поле: печатал });
  return true;
}

/* --- Ответ модели ------------------------------------------------------------------- */

// Ждущие ответа переписки: ключ → { таймер, отмена, сост: 'wait'|'typing'|'error', кто, место, номер }.
const ждут = new Map();
const ПАУЗА_ДО_ОТВЕТА = 2500;

let часыСтрок = 0;
function следитьЗаСтроками() {
  // Карточка перерисовывается и по своим причинам — строка «печатает…» возвращается.
  if (часыСтрок || !ждут.size) return;
  часыСтрок = setInterval(() => { if (!ждут.size) { clearInterval(часыСтрок); часыСтрок = 0; } обновитьСтроки(); }, 1000);
}
function запланироватьОтвет(ключ, номер, место) {
  const было = ждут.get(ключ);
  if (было) { clearTimeout(было.таймер); if (было.отмена) было.отмена.abort(); }
  const з = { таймер: 0, отмена: null, сост: 'wait', кто: '', место, номер, чат: чатТаверны(), свайп: свайпНомера(номер), сообщение: основа.getStContextSafe()?.chat?.[номер] || null, ждалОтвета: 0 };
  з.таймер = setTimeout(() => { void запроситьОтвет(ключ); }, ПАУЗА_ДО_ОТВЕТА);
  ждут.set(ключ, з);
  обновитьСтроки();
  следитьЗаСтроками();
}

/** Текст карточки и персоны — по настройкам контекста. */
function карточкаИПерсона(кто) {
  const ctx = основа.getStContextSafe();
  let поля = null;
  try { поля = ctx && typeof ctx.getCharacterCardFields === 'function' ? ctx.getCharacterCardFields() : null; } catch (_) { поля = null; }
  const персонаж = String((ctx && ctx.name2) || '');
  let карточка = '';
  if (settings.userChatCard !== false && поля && персонаж && этоИгрок(кто, персонаж)) {
    карточка = [поля.description, поля.personality && 'Personality: ' + поля.personality, поля.scenario && 'Scenario: ' + поля.scenario].filter(Boolean).join('\n');
  }
  const персона = settings.userChatPersona !== false && поля ? String(поля.persona || '') : '';
  const обрезать = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);
  return { карточка: обрезать(карточка, 6000), персона: обрезать(персона, 3000) };
}

/** Последние сообщения чата Таверны без блоков HUD. */
function историяЧата(доНомера) {
  const n = Math.max(0, Math.min(30, parseInt(settings.userChatHistory ?? 6, 10) || 0));
  if (!n) return '';
  const ctx = основа.getStContextSafe();
  const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const out = [];
  for (let i = Math.min(доНомера, чат.length - 1); i >= 0 && out.length < n; i--) {
    const м = чат[i];
    if (!м || м.is_system) continue;
    const т = заменитьHudБлоки(основа.текстСообщенияЧата(м), '').replace(/<[^>]+>/g, '').trim();
    if (!т) continue;
    out.unshift(`${м.name || (м.is_user ? игрок() : '')}: ${т.length > 1500 ? т.slice(0, 1500) + '…' : т}`);
  }
  return out.join('\n\n');
}

/**
 * Картинки уходят только в Chat Completion (прямой запрос или профиль
 * подключения): Text Completion через generateRaw их не передаёт.
 */
function картинкиМожно(ctx) {
  if (settings.regenProfileId) return true;
  return String((ctx && ctx.mainApi) || 'openai') === 'openai';
}
/** Файлы снимков → data:-адреса (по одному: битый файл не мешает остальным). */
async function картинкиСнимков(снимки) {
  const out = [];
  for (const с of снимки.slice(0, 4)) {
    try {
      const r = await fetch(путьСнимка(с.файл), { cache: 'force-cache' });
      if (!r.ok) continue;
      const blob = await r.blob();
      out.push(`data:${blob.type || 'image/jpeg'};base64,${await blobВBase64(blob)}`);
    } catch (_) { /* без этой картинки */ }
  }
  return out;
}

const языкПереписки = () => (английский() ? 'English' : (языкЗначенийМодели() || 'Russian'));

async function запроситьОтвет(ключ) {
  const з = ждут.get(ключ);
  if (!з) return;
  const { номер, место } = з;
  const ctx = основа.getStContextSafe();
  const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const сообщение = чат[номер];
  // Сменили чат или свайп, пока шла пауза: эта переписка уже не на экране — не пишем.
  if (!сообщение || сообщение !== з.сообщение || чатТаверны() !== з.чат || свайпНомера(номер) !== з.свайп || основа.последнийHUD() !== номер) { ждут.delete(ключ); обновитьСтроки(); return; }
  // Таверна пишет ответ — запись в HUD сейчас запрещена: ждём (до двух минут).
  if (основа.идётОтвет()) {
    if (++з.ждалОтвета > 60) { ждут.delete(ключ); обновитьСтроки(); return; }
    з.таймер = setTimeout(() => { void запроситьОтвет(ключ); }, 2000);
    return;
  }
  const свайп = сообщение.swipe_id;
  const чатВНачале = з.чат;
  const hud = основа.hudНомера(номер);
  const найдено = hud && найтиПереписку(hud, место);
  if (!найдено || !найдено.ms.length) { ждут.delete(ключ); обновитьСтроки(); return; }
  const ms = найдено.ms;
  // Хвост из строк игрока; ответ просят только непрочитанные — удалённые
  // и уже прочитанные (на них ответили или промолчали) не в счёт.
  let новых = 0, живых = 0;
  const имена = (место.имена && место.имена.length) ? место.имена : именаМеста(место, номер);
  let первая = -1;
  for (let i = ms.length - 1; i >= 0 && этоИгрок(сторонаСтроки(ms[i]).от, имена); i--) { if (/\|\s*unread\s*$/i.test(ms[i])) { живых++; первая = i; } }
  новых = первая > -1 ? ms.length - первая : 0;
  if (!живых) { ждут.delete(ключ); обновитьСтроки(); return; }
  const { кто, состав } = собеседники(место, hud, найдено);
  з.кто = состав.length ? '' : кто;
  з.сост = 'typing';
  з.отмена = new AbortController();
  обновитьСтроки();

  const данные = основа.разборНомера(номер);
  const времяСцены = данные && данные.scene ? String(данные.scene['Время'] || '') : '';
  const { карточка, персона } = карточкаИПерсона(кто);
  let снимок = '';
  if (settings.userChatHud !== false) {
    try {
      const блок = extractHudBlock(основа.текстСообщенияЧата(сообщение));
      const объект = блок ? собратьСнимок(блок) : null;
      if (объект) снимок = строкаСнимка(объект, решитьNSFW(объект, последниеТекстыЧата(чат, номер + 1)));
      // Метки «<new this turn>» — для HUD следующего хода; в ответе переписки они лишние.
      снимок = снимок.replace(/,\s*"[^"]+"\s*:\s*(?:"<new this turn>"|\[\s*"<new this turn>"\s*\])/g, '')
        .replace(/"[^"]+"\s*:\s*(?:"<new this turn>"|\[\s*"<new this turn>"\s*\])\s*,?/g, '');
    } catch (_) { снимок = ''; }
  }
  const история = историяЧата(номер);
  let лор = '';
  if (settings.userChatLore === true) {
    try { лор = String(await основа.buildHudLoreContext([история, ...ms.slice(-6)].join('\n')) || ''); } catch (_) { лор = ''; }
  }
  // Настоящие снимки игрока в этом заходе — картинками модели, если источник умеет.
  const снимки = новыеСнимки(ms, игрок());
  const картинки = снимки.length && settings.userChatImages !== false && картинкиМожно(ctx) ? await картинкиСнимков(снимки) : [];
  const промптС = (видно) => промптОтвета({
    игрок: игрок(), кто, состав, где: место.где, чат: место.где === 'tp' ? (место.цель || '') : (место.ключ || ''),
    ms, новых, время: времяОтправки(времяСцены, ms), язык: языкПереписки(), карточка, персона, лор, снимок, история,
    снимков: снимки.length, видноСнимки: видно, имена,
  });
  const сообщенияЗапроса = (видно) => [{ role: 'user', content: видно && картинки.length
    ? [{ type: 'text', text: промптС(true) }, ...картинки.map(url => ({ type: 'image_url', image_url: { url, detail: 'auto' } }))]
    : промптС(false) }];

  try {
    const рег = await основа.загрузитьПерегенерацию();
    const лимит = Math.max(256, Math.min(16000, parseInt(settings.userChatMaxTokens ?? 2048, 10) || 2048));
    const пусто = (data, извлечь) => { try { return !разобратьОтвет(рег.текстОтвета(data, извлечь), { игрок: имена }).строки.length; } catch (_) { return true; } };
    // Предел ожидания — тот же, что у перегенерации HUD: сколько модель может молчать.
    const пределМин = Math.max(0, Number(settings.hudRegenTimeout ?? 6) || 0);
    let молчание = 0, вышлоВремя = false;
    const живой = () => { clearTimeout(молчание); молчание = пределМин ? setTimeout(() => { вышлоВремя = true; з.отмена.abort(); }, пределМин * 60000) : 0; };
    живой();
    let текст = '';
    try {
      const спросить = (видно) => рег.запросКМодели({
        stContext: ctx, сообщения: сообщенияЗапроса(видно), лимит, отмена: з.отмена, живой,
        повторЕсли: (data, извлечь) => рег.обрывПоЛимиту(data) && пусто(data, извлечь),
      });
      try {
        ({ текст } = await спросить(картинки.length > 0));
      } catch (e) {
        // Модель или источник картинок не принимают — тот же вопрос без них, по описанию.
        if (!картинки.length || з.отмена.signal.aborted || вышлоВремя) throw e;
        console.warn('[TavernOS HUD] переписка: с картинкой не вышло, без неё', e);
        живой();
        ({ текст } = await спросить(false));
      }
    } catch (e) {
      if (вышлоВремя) throw new Error(`провайдер не ответил за ${пределМин} мин`);
      throw e;
    } finally { clearTimeout(молчание); }
    if (з.отмена.signal.aborted) return;
    if (ждут.get(ключ) !== з) return;
    const чатСейчас = (() => { try { return String(ctx.getCurrentChatId?.() ?? ''); } catch (_) { return ''; } })();
    if (чат[номер] !== сообщение || сообщение.swipe_id !== свайп || чатСейчас !== чатВНачале || основа.последнийHUD() !== номер) {
      // Ушли в другой чат или свайп — переписка осталась там, где её писали; просто молчим.
      ждут.delete(ключ); обновитьСтроки();
      тост('info', 'Переписка', 'Пока шёл ответ, сообщение сменилось: другой свайп, другой чат или новый ход — ответ не вписан.');
      return;
    }
    // Таверна начала свой ответ, пока шёл наш: запись подождёт его конца.
    for (let i = 0; i < 60 && основа.идётОтвет(); i++) await пауза(2000);
    if (основа.последнийHUD() !== номер || чатТаверны() !== чатВНачале || сообщение.swipe_id !== свайп) {
      ждут.delete(ключ); обновитьСтроки();
      тост('info', 'Переписка', 'Пока шёл ответ, появился новый ход — ответ в прошлый HUD не вписан.');
      return;
    }
    // В личном чате отвечает собеседник, в группе — участники: чужие строки модели не вписываем.
    const р = разобратьОтвет(текст, { игрок: имена, отвечают: состав.length ? состав : [кто] });
    ждут.delete(ключ);
    if (!р.строки.length && !р.прочитано && !р.звонок) {
      обновитьСтроки();
      тост('info', 'Переписка', `${имяБезПриставки(кто) || 'Собеседник'}: пока не прочитано.`);
      return;
    }
    // Игрок ждёт в этом чате — после перерисовки он снова открыт, и фокус там же.
    const открытое = картыСообщения(номер).map(к => телоВКарте(к, место)).find(т => т && т.offsetParent && т.classList.contains('active')) || null;
    if (открытое && р.строки.length > 1) заранееСпрятать(открытое, р.строки.length - 1);
    const былФокус = !!(открытое && document.activeElement && открытое.contains(document.activeElement));
    await основа.записатьПереписку(номер, (h, message) => {
      const н = найтиПереписку(h, место);
      if (!н) throw new Error('переписка пропала из HUD — ответ не вписан');
      if (р.звонок) н.запись.ms = применитьЗвонок(н.запись.ms, игрок(), р.звонок);
      // Что на снимке, который игрок прислал без описания, — со слов модели.
      if (р.описанияСнимков.length) н.запись.ms = вписатьОписанияСнимков(н.запись.ms, игрок(), р.описанияСнимков);
      дописатьВПереписку(h, место, р.строки, { игрок: игрок(), прочитано: р.прочитано });
      запомнитьПереписку(message, { чат: подписьЧата(место), где: место.где, строки: р.строки, прочитано: р.прочитано, игрок: игрок(), звонок: р.звонок, описанияСнимков: р.описанияСнимков });
    }, открытое);
    обновитьСтроки();
    if (!р.строки.length && !р.звонок) тост('info', 'Переписка', `${имяБезПриставки(кто) || 'Собеседник'}: прочитано, без ответа.`);
    вернутьЧат(номер, место, { поле: былФокус, тихо: !открытое }).then(т => { if (т && т.offsetParent) void показатьПоОдному(т, р.строки.length, состав.length ? '' : кто).finally(убратьЗаранее); else убратьЗаранее(); }).catch(убратьЗаранее);
  } catch (e) {
    if (з.отмена && з.отмена.signal.aborted && ждут.get(ключ) !== з) return;
    з.сост = 'error';
    з.ошибка = String((e && e.message) || e);
    обновитьСтроки();
    if (!(e && e.name === 'AbortError')) тост('error', 'Ответ не пришёл', з.ошибка);
  }
}

/** Строка «печатает…» или «не дошло · повторить» над полем ввода. */
function обновитьСтроки() {
  document.querySelectorAll('.hud-uc-status').forEach(у => {
    if (у.dataset.ucReveal) return; // идёт показ ответа по одному
    const тело = у.closest('.hud-phone-subbody');
    const номер = номерУзла(у);
    const место = тело && местоУзла(тело);
    const з = место && номер !== null ? ждут.get(ключМеста(номер, место)) : null;
    if (!з || з.сост === 'wait') { у.hidden = true; у.innerHTML = ''; return; }
    у.hidden = false;
    у.innerHTML = з.сост === 'typing'
      ? `<span class="hud-ask-typing"><i></i><i></i><i></i></span><span>${escapeHtml(з.кто ? имяБезПриставки(з.кто) + ' печатает…' : 'Печатают…')}</span>`
      : `<span>Ответ не пришёл</span><button type="button" class="hud-uc-retry" data-uc="retry">Повторить</button>`;
  });
}

/* --- Карточка перерисовалась: вернуть открытый чат ----------------------------------- */

function картыСообщения(номер) {
  return [...document.querySelectorAll(`#chat .mes[mesid="${номер}"] .hud-os-card, .hud-side-mes[mesid="${номер}"] .hud-os-card`)];
}
// Где вести переписку: открытый плавающий телефон (phone-float.js) — там, где
// игрок и пишет; иначе карточка в ленте; её нет на экране — панель сбоку.
function картаПереписки(номер) {
  const карты = картыСообщения(номер);
  return карты.find(к => к.isConnected && к.closest('.hud-pf.is-open') && к.querySelector('.hud-tab[data-tab-id="phone"]'))
    || карты.find(к => к.isConnected && !к.closest('.hud-side-mes')) || карты[0];
}
function телоВКарте(карта, место) {
  return [...карта.querySelectorAll('.hud-phone-subbody[data-user-chat]')].find(т => {
    const м = местоУзла(т);
    if (!м || м.где !== место.где) return false;
    if (м.где === 'tp') return этоИгрок(м.цель, место.цель) && (!место.чат || !м.чат || м.чат === место.чат);
    return м.ключ === место.ключ || м.ключ.toLowerCase() === String(место.ключ).toLowerCase();
  }) || null;
}

/** Открыть переписку в карточке: вкладка, приложение, чат. */
async function открытьЧат(карта, место) {
  for (let i = 0; i < 30; i++) {
    const тело = телоВКарте(карта, место);
    if (тело && тело.offsetParent && тело.classList.contains('active')) return тело;
    if (место.где === 'tp') {
      const вкладка = карта.querySelector('.hud-tab[data-tab-id="intercepts"]');
      if (вкладка && !вкладка.classList.contains('active')) { вкладка.click(); await пауза(80); continue; }
      if (тело) { const ярлык = карта.querySelector(`.hud-phone-subtab[data-subtarget="${CSS.escape(тело.id)}"]`); if (ярлык) ярлык.click(); }
    } else {
      const uidТел = место.где === 'phx' ? 'phone2-' : 'phone-';
      const вкладка = [...карта.querySelectorAll('.hud-tab[data-tab-id="phone"]')].find(т => String(т.dataset.target || '').startsWith('content-' + uidТел));
      if (вкладка && !вкладка.classList.contains('active')) { вкладка.click(); await пауза(80); continue; }
      if (тело) {
        const эмулятор = тело.closest('.hud-phone-emulator');
        if (эмулятор) эмулятор.classList.add('unlocked');
        const вид = тело.closest('.hud-phone-app-view');
        if (вид && !вид.classList.contains('active')) { эмулятор?.querySelector('.hud-phone-app[data-phone-app="messages"]')?.click(); await пауза(60); continue; }
        const ряд = карта.querySelector(`.hud-phone-chat-row[data-chat-target="${CSS.escape(тело.id)}"]`);
        if (ряд) ряд.click();
      }
    }
    await пауза(100);
  }
  return телоВКарте(карта, место);
}

async function вернутьЧат(номер, место, { поле = false, тихо = false } = {}) {
  // Карточка пересобирается после записи — ждём новую.
  for (let i = 0; i < 40; i++) {
    await пауза(i < 5 ? 60 : 120);
    const карта = картаПереписки(номер);
    if (!карта || !карта.querySelector('.hud-tab')) continue;
    // Тихо — ответ пришёл, а игрок, может, уже в другой вкладке: не уводим.
    // Иначе открываем: вкладка строится лениво, тело чата появится после клика.
    const открыто = тихо ? телоВКарте(карта, место) : await открытьЧат(карта, место);
    if (!открыто) return null;
    const лента = открыто.querySelector('.hud-phone-chat-area');
    if (лента && (!тихо || лента.scrollHeight - лента.scrollTop - лента.clientHeight < 200)) лента.scrollTop = лента.scrollHeight;
    const бар = открыто.querySelector('.hud-phone-input-bar[data-uc-bar]');
    if (бар) {
      показатьЦитату(бар, местоУзла(бар) || место);
      if (поле) открытьПоле(бар);
    }
    обновитьСтроки();
    return открыто;
  }
  return null;
}

/* --- Показ ответа по одному ------------------------------------------------------ */

// Ответ записан в HUD целиком, но на экране сообщения появляются по очереди:
// пузырь — «печатает…» — следующий, как в настоящем мессенджере. Это только
// показ: перерисовка карточки по любой причине покажет всё сразу.
const ДЕРЖАТЬ = 'hud-uc-hold';
// Новая карточка рисует все пузыри сразу; правило прячет хвост ленты этого
// чата, пока показ по одному не возьмёт его на себя (и не дольше 6 с).
let заранее = null;
function заранееСпрятать(тело, сколько) {
  убратьЗаранее();
  const выбор = тело.dataset.ucWhere === 'tp'
    ? `.hud-phone-subbody[data-uc-where="tp"][data-uc-target="${CSS.escape(тело.dataset.ucTarget || '')}"]`
    : `.hud-phone-subbody[data-user-chat][data-chat-key="${CSS.escape(тело.dataset.chatKey || '')}"]`;
  const стиль = document.createElement('style');
  стиль.textContent = `${выбор} .hud-phone-chat-area > :nth-last-child(-n+${Math.max(1, сколько)}) { display: none !important; }`;
  document.head.appendChild(стиль);
  заранее = { стиль, таймер: setTimeout(убратьЗаранее, 6000) };
}
function убратьЗаранее() { if (!заранее) return; clearTimeout(заранее.таймер); заранее.стиль.remove(); заранее = null; }
async function показатьПоОдному(тело, сколько, кто) {
  if (!тело || !тело.isConnected || сколько < 2) return;
  const лента = тело.querySelector('.hud-phone-chat-area');
  const статус = тело.querySelector('.hud-uc-status');
  if (!лента || !статус) return;
  const ряды = [...лента.children].filter(у => у.matches('.hud-msg-wrapper, .hud-call-row, .hud-offscreen')).slice(-сколько);
  if (ряды.length < 2) return;
  // Первый — сразу, остальные ждут своей очереди.
  ряды.slice(1).forEach(р => р.classList.add(ДЕРЖАТЬ));
  убратьЗаранее();
  статус.dataset.ucReveal = '1';
  const вниз = () => { лента.scrollTop = лента.scrollHeight; };
  вниз();
  for (const р of ряды.slice(1)) {
    if (!р.isConnected) return;
    статус.hidden = false;
    статус.innerHTML = `<span class="hud-ask-typing"><i></i><i></i><i></i></span><span>${escapeHtml(кто ? имяБезПриставки(кто) + ' печатает…' : 'Печатают…')}</span>`;
    // Дольше печатать длинное: около 40 мс на знак, от 0,7 до 2,4 с.
    const длина = (р.querySelector('.hud-msg-text, .hud-voice-text')?.textContent || '').length;
    await пауза(Math.max(700, Math.min(2400, 300 + длина * 40)));
    if (!р.isConnected) return;
    р.classList.remove(ДЕРЖАТЬ);
    вниз();
  }
  delete статус.dataset.ucReveal;
  статус.hidden = true;
  статус.innerHTML = '';
}

/** Кому пишет игрок в этом чате: в перехвате — цель, в телефоне — его владелец. */
function собеседникТела(тело) {
  if (!тело) return '';
  if (тело.dataset.ucWhere === 'tp') return тело.dataset.ucTarget || '';
  return безРазрывов(тело.closest('.hud-phone-app-view')?.querySelector('.hud-phone-app-owner')?.textContent || тело.querySelector('.hud-phone-name')?.textContent);
}

/* --- «+»: голосовое, фото, видео, звонок, опрос --------------------------------------- */

function закрытьЛисты(корень = document) { корень.querySelectorAll('.hud-uc-sheet').forEach(л => л.remove()); }
/** Лист уходит плавно (кнопка «Отмена», тап мимо, звонок поверх). */
function убратьЛист(л, мс = 220) {
  if (!л || л.classList.contains('is-closing')) return;
  л.classList.add('is-closing');
  setTimeout(() => л.remove(), мс);
}

function лист(тело, html) {
  закрытьЛисты();
  const л = document.createElement('div');
  л.className = 'hud-uc-sheet';
  л.innerHTML = `<div class="hud-uc-sheet-box">${html}</div>`;
  // Лист ложится поверх своего контейнера — тот должен быть точкой отсчёта.
  if (getComputedStyle(тело).position === 'static') тело.classList.add('hud-uc-host');
  тело.appendChild(л);
  л.addEventListener('click', (e) => { if (e.target === л) убратьЛист(л); });
  л.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') убратьЛист(л); });
  for (const тип of ['keyup', 'keypress']) л.addEventListener(тип, (e) => e.stopPropagation());
  const первое = л.querySelector('textarea, input');
  if (первое) setTimeout(() => { try { первое.focus({ preventScroll: true }); } catch (_) {} }, 30);
  return л;
}

const ВИДЫ = [
  ['voice', 'mic', 'Голосовое'], ['photo', 'image', 'Фото'], ['video', 'video', 'Видео'], ['call', 'handset', 'Звонок'], ['poll', 'people', 'Опрос'],
];

function открытьВложения(бар) {
  const место = местоУзла(бар);
  if (!место || !можноПисать(номерУзла(бар))) return;
  const группа = !!место.тело.dataset.chatGroup || место.тело.querySelector('.hud-phone-chat-area.is-group');
  const кнопки = ВИДЫ.filter(([в]) => (в !== 'poll' || группа) && (в !== 'call' || !группа)).map(([в, ико, подпись]) =>
    `<button type="button" class="hud-uc-kind" data-uc="kind" data-kind="${в}"><span>${G_ICONS[ико] || ''}</span><small>${подпись}</small></button>`).join('');
  лист(место.тело, `<div class="hud-uc-sheet-title">Отправить</div><div class="hud-uc-kinds">${кнопки}</div>`);
}

function формаВида(узел, вид) {
  const место = местоУзла(узел);
  if (!место) return;
  const кому = собеседникТела(место.тело);
  const поля = {
    voice: `<label>Что говоришь голосом<textarea class="hud-uc-f" data-f="текст" rows="3" placeholder="Слова голосового — модель их «услышит»"></textarea></label>`,
    photo: `<div class="hud-uc-seg" role="tablist">
        <button type="button" class="is-on" data-uc="photo-mode" data-mode="desc">Описание</button>
        <button type="button" data-uc="photo-mode" data-mode="file">Своя картинка</button>
      </div>
      <div class="hud-uc-mode" data-mode="desc"><label>Что на снимке<textarea class="hud-uc-f" data-f="что" rows="2" placeholder="Селфи у окна"></textarea></label></div>
      <div class="hud-uc-mode" data-mode="file" hidden>
        <label class="hud-uc-pick"><input type="file" class="hud-uc-file" accept="image/png,image/jpeg,image/webp,image/gif"><span class="hud-uc-pick-btn">${G_ICONS.image}<span>Выбрать картинку</span></span></label>
        <div class="hud-uc-preview" hidden><img alt=""></div>
        <label>Кто или что на фото<input class="hud-uc-f" data-f="кто" placeholder="Необязательно — например: это я"></label>
      </div>
      <label>Подпись<input class="hud-uc-f" data-f="текст" placeholder="Необязательно"></label>`,
    video: `<label>Что в кадре<textarea class="hud-uc-f" data-f="что" rows="2" placeholder="Снимаю дождь с балкона"></textarea></label><label>Подпись<input class="hud-uc-f" data-f="текст" placeholder="Необязательно"></label>`,
    call: `<p class="hud-uc-sheet-note">Кому: ${escapeHtml(кому || 'собеседнику')}. Возьмёт ли трубку, решит модель.</p><label>Что хочешь сказать<textarea class="hud-uc-f" data-f="тема" rows="2" placeholder="Необязательно — например: жду у ворот, замёрзла"></textarea></label><p class="hud-uc-sheet-note">«Позвонить» — модель сразу пишет короткий разговор. «Живой звонок» — говоришь сама, реплика за репликой.</p>`,
    poll: `<label>Вопрос<input class="hud-uc-f" data-f="вопрос" placeholder="Куда идём в субботу?"></label><label>Варианты, каждый с новой строки<textarea class="hud-uc-f" data-f="варианты" rows="3"></textarea></label>`,
  }[вид];
  if (!поля) return;
  const заголовок = (ВИДЫ.find(([в]) => в === вид) || [])[2] || '';
  const л = лист(место.тело, `<div class="hud-uc-sheet-title">${G_ICONS[(ВИДЫ.find(([в]) => в === вид) || [])[1]] || ''} ${заголовок}</div>${поля}
    <div class="hud-uc-sheet-btns${вид === 'call' ? ' is-call' : ''}"><button type="button" class="hud-uc-cancel" data-uc="sheet-close">Отмена</button><button type="button" class="hud-uc-go" data-uc="kind-send" data-kind="${вид}">${вид === 'call' ? 'Позвонить' : 'Отправить'}</button>${вид === 'call' ? '<button type="button" class="hud-uc-go is-live" data-uc="kind-send" data-kind="call" data-live="1">Живой звонок</button>' : ''}</div>`);
  if (вид === 'photo') {
    л.dataset.mode = 'desc';
    л.querySelector('.hud-uc-file')?.addEventListener('change', (e) => { л.__сжатие = выбранаКартинка(л, e.target.files && e.target.files[0]); });
  }
}

/* --- Своя картинка ------------------------------------------------------------------ */

const ДО_ПИКСЕЛЕЙ = 1280;
const blobВBase64 = (blob) => new Promise((готово, сбой) => {
  const ч = new FileReader();
  ч.onload = () => готово(String(ч.result || '').replace(/^data:[^,]*,/, ''));
  ч.onerror = () => сбой(ч.error || new Error('файл не прочитан'));
  ч.readAsDataURL(blob);
});
/**
 * Картинка из галереи → { base64, расширение, просмотр }. Большие ужимаем до
 * 1280 px JPEG: модели этого хватает, а запрос и файл чата не раздуваются.
 * GIF до 3 МБ оставляем как есть — иначе мем теряет анимацию.
 */
async function сжатьКартинку(файл) {
  if (!файл || !/^image\//.test(файл.type)) throw new Error('это не картинка');
  if (файл.size > 25 * 1024 * 1024) throw new Error('картинка больше 25 МБ');
  if (файл.type === 'image/gif' && файл.size <= 3 * 1024 * 1024) {
    return { base64: await blobВBase64(файл), расширение: 'gif', тип: 'image/gif' };
  }
  const адрес = URL.createObjectURL(файл);
  try {
    const кадр = await new Promise((готово, сбой) => { const и = new Image(); и.onload = () => готово(и); и.onerror = () => сбой(new Error('картинка не открылась')); и.src = адрес; });
    const м = Math.min(1, ДО_ПИКСЕЛЕЙ / Math.max(кадр.naturalWidth || 1, кадр.naturalHeight || 1));
    const холст = document.createElement('canvas');
    холст.width = Math.max(1, Math.round(кадр.naturalWidth * м));
    холст.height = Math.max(1, Math.round(кадр.naturalHeight * м));
    const г = холст.getContext('2d');
    г.fillStyle = '#fff'; г.fillRect(0, 0, холст.width, холст.height); // прозрачное — на белом, как в мессенджере
    г.drawImage(кадр, 0, 0, холст.width, холст.height);
    const blob = await new Promise(r => холст.toBlob(r, 'image/jpeg', 0.85));
    if (!blob) throw new Error('картинка не сжалась');
    return { base64: await blobВBase64(blob), расширение: 'jpg', тип: 'image/jpeg' };
  } finally { URL.revokeObjectURL(адрес); }
}
async function выбранаКартинка(л, файл) {
  if (!л || !файл) return;
  try {
    const к = await сжатьКартинку(файл);
    л.__снимок = к;
    const просмотр = л.querySelector('.hud-uc-preview');
    if (просмотр) { просмотр.hidden = false; просмотр.querySelector('img').src = `data:${к.тип};base64,${к.base64}`; }
    const кнопка = л.querySelector('.hud-uc-pick-btn span');
    if (кнопка) кнопка.textContent = 'Другая картинка';
  } catch (e) { тост('error', 'Фото', String((e && e.message) || e)); }
}
/** Сохранить снимок в файлы Таверны (user/files) → имя файла. */
async function загрузитьСнимок(к) {
  const ctx = основа.getStContextSafe();
  const заголовки = ctx && typeof ctx.getRequestHeaders === 'function' ? ctx.getRequestHeaders() : { 'Content-Type': 'application/json' };
  const имя = имяФайлаСнимка(к.расширение);
  const r = await fetch('/api/files/upload', { method: 'POST', headers: заголовки, body: JSON.stringify({ name: имя, data: к.base64 }) });
  if (!r.ok) throw new Error('файл не сохранился (' + r.status + ')');
  return имя;
}
function режимФото(кнопка) {
  const л = кнопка.closest('.hud-uc-sheet');
  if (!л) return;
  const режим = кнопка.dataset.mode === 'file' ? 'file' : 'desc';
  л.dataset.mode = режим;
  л.querySelectorAll('[data-uc="photo-mode"]').forEach(б => б.classList.toggle('is-on', б === кнопка));
  л.querySelectorAll('.hud-uc-mode').forEach(б => { б.hidden = б.dataset.mode !== режим; });
}

async function отправитьВид(кнопка) {
  const место = местоУзла(кнопка);
  const л = кнопка.closest('.hud-uc-sheet');
  if (!место || !л) return;
  const вид = кнопка.dataset.kind;
  const з = {};
  л.querySelectorAll('.hud-uc-f').forEach(п => { з[п.dataset.f] = String(п.value || '').trim(); });
  const м = { вид };
  // Экран звонка раскрывается поверх листа — лист тает под ним.
  if (вид === 'call') { убратьЛист(л, 480); void начатьЗвонок(место, кнопка.dataset.live ? { живой: true } : { тема: з.тема || '' }); return; }
  if (вид === 'voice') { if (!з.текст) return; м.текст = з.текст; }
  if (вид === 'photo' && л.dataset.mode === 'file') {
    // Картинка ещё сжимается (большая, медленный телефон) — дожидаемся.
    if (л.__сжатие) { try { await л.__сжатие; } catch (_) { /* ниже — «выбери картинку» */ } }
    if (!л.__снимок) { тост('info', 'Фото', 'Выбери картинку.'); return; }
    const кнопкаОтправки = л.querySelector('[data-uc="kind-send"]');
    if (кнопкаОтправки) { кнопкаОтправки.disabled = true; кнопкаОтправки.textContent = 'Загружаю…'; }
    try { м.файл = await загрузитьСнимок(л.__снимок); }
    catch (e) { тост('error', 'Фото', String((e && e.message) || e)); if (кнопкаОтправки) { кнопкаОтправки.disabled = false; кнопкаОтправки.textContent = 'Отправить'; } return; }
    м.что = з.кто || ''; м.текст = з.текст || '';
  } else if (вид === 'photo' || вид === 'video') { if (!з.что) return; м.что = з.что; м.текст = з.текст || ''; }
  if (вид === 'poll') {
    const варианты = String(з.варианты || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (!з.вопрос || варианты.length < 2) { тост('info', 'Опрос', 'Нужны вопрос и хотя бы два варианта.'); return; }
    м.опрос = { вопрос: з.вопрос, варианты };
  }
  л.remove();
  await отправить(место.тело, место, [м]);
}

/* --- Карандаш: кому написать ---------------------------------------------------------- */

/** Люди, которым можно написать: владелец телефона и персонажи HUD. */
function кандидаты(hud, данные) {
  const имена = [];
  const добавить = (и, куда) => {
    const v = String(и || '').trim();
    if (!v || /^(?:empty|none|unknown)$/i.test(v) || этоИгрок(v, игрок())) return;
    if (имена.some(x => x.имя.toLowerCase() === v.toLowerCase())) return;
    имена.push({ имя: v, куда });
  };
  добавить(владелецТелефона(hud, 'cm', данные), 'cm');
  for (const c of (данные && Array.isArray(данные.characters) ? данные.characters : [])) добавить(c && c['Имя'], 'tp');
  return имена;
}

function открытьНовый(кнопка) {
  const номер = номерУзла(кнопка);
  if (!можноПисать(номер)) return;
  const hud = основа.hudНомера(номер);
  const данные = основа.разборНомера(номер);
  if (!hud) { тост('error', 'Переписка', 'HUD сообщения не разобрался.'); return; }
  const список = кандидаты(hud, данные).filter(к => к.куда === 'cm' || settings.enableIntercepts !== false);
  const место = кнопка.closest('.hud-phone-app-view, .hud-phone-mockup, .hud-intercepts-alt, .hud-tab-content');
  if (!место) return;
  const ряды = список.map(к => `<button type="button" class="hud-uc-who" data-uc="pick" data-name="${escapeHtml(к.имя)}" data-where="${к.куда}">
      <span class="hud-uc-who-ava" data-ava-auto="1" data-ava-name="${escapeHtml(к.имя)}">${escapeHtml(к.имя.slice(0, 1).toUpperCase())}</span>
      <span class="hud-uc-who-meta"><b>${escapeHtml(имяБезПриставки(к.имя))}</b><small>${к.куда === 'cm' ? 'в «Сообщения» — телефон персонажа' : 'в «Перехваты» — телефон этого человека'}</small></span></button>`).join('');
  const л = лист(место, `<div class="hud-uc-sheet-title">${G_ICONS.pen} Кому написать</div>
    <div class="hud-uc-who-list">${ряды || '<p class="hud-uc-sheet-note">В HUD нет никого, кому можно написать.</p>'}</div>
    ${settings.enableIntercepts !== false ? `<label class="hud-uc-who-other">Другое имя<input class="hud-uc-f" data-f="имя" placeholder="Кому — переписка уйдёт в «Перехваты»"></label>
    <div class="hud-uc-sheet-btns"><button type="button" class="hud-uc-cancel" data-uc="sheet-close">Отмена</button><button type="button" class="hud-uc-go" data-uc="pick-other">Написать</button></div>` : ''}`);
  л.classList.add('is-picker');
  л.dataset.mes = String(номер);
}

async function начатьЧат(узел, имя, куда) {
  const номер = Number(узел.closest('.hud-uc-sheet')?.dataset.mes);
  закрытьЛисты();
  if (!можноПисать(номер)) return;
  const hud = основа.hudНомера(номер);
  const данные = основа.разборНомера(номер);
  if (!hud) return;
  const место = куда === 'cm'
    ? (() => {
        // Чат с игроком уже есть — открываем его.
        const cm = hud.cm && typeof hud.cm === 'object' ? hud.cm : {};
        const имена = именаИгрока(игрок(), (данные && данные.phone && данные.phone.contacts) || []);
        const ключ = Object.keys(cm).find(к => чатСИгроком(к, cm[к], имена) && !String(cm[к].pp || '').trim());
        const показан = данные && данные.chatsMap ? Object.keys(данные.chatsMap).find(к => чатСИгроком(к, { pp: данные.chatsMap[к].participants, ms: данные.chatsMap[к].messages }, имена) && !данные.chatsMap[к].participants) : '';
        return { где: 'cm', ключ: ключ || показан || игрок(), игрок: игрок() };
      })()
    : { где: 'tp', цель: имя, чат: игрок(), игрок: игрок() };
  const есть = найтиПереписку(hud, место) || (место.где === 'cm' && данные && данные.chatsMap && данные.chatsMap[место.ключ])
    || (место.где === 'tp' && данные && (данные.intercepts || []).some(п => п && этоИгрок(String(п.target || ''), имя) && перехватИгрока({ tg: п.target, cn: п.chatName, pp: п.participants, ms: п.messages }, игрок())));
  if (!есть) {
    try {
      await основа.записатьПереписку(номер, (h) => {
        дописатьВПереписку(h, место, [], { владелец: место.где === 'cm' ? владелецТелефона(h, 'cm', данные) : '', игрок: игрок() });
      }, null);
    } catch (e) { тост('error', 'Чат не создан', String((e && e.message) || e)); return; }
  } else if (место.где === 'tp') {
    // Перехват с этим человеком уже есть — пишем в него, под его названием.
    const п = (данные.intercepts || []).find(x => x && этоИгрок(String(x.target || ''), имя) && перехватИгрока({ tg: x.target, cn: x.chatName, pp: x.participants, ms: x.messages }, игрок()));
    if (п) { место.цель = String(п.target || '').trim(); место.чат = String(п.chatName || '').trim(); }
  }
  void вернутьЧат(номер, место, { поле: true });
}

/* --- Долгое нажатие на пузырь: ответить, переслать, удалить ----------------------------- */

function текстПузыря(пузырь) {
  const копия = пузырь.cloneNode(true);
  копия.querySelectorAll('.hud-msg-meta, .hud-reaction-palette, .hud-msg-reactions, .hud-uc-actions, .hud-msg-draft-mark, .hud-msg-reply, .hud-msg-fwd, .hud-msg-by').forEach(у => у.remove());
  return безРазрывов(копия.textContent);
}
// На экране имена разбиты невидимыми знаками (defeatWI — от лорбука); в HUD они не нужны.
const безРазрывов = (s) => String(s || '').replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim();
const ктоПузыря = (пузырь) => безРазрывов(пузырь.closest('.hud-msg-content')?.querySelector('.hud-msg-sender')?.textContent);

function ответитьНа(пузырь) {
  const тело = пузырь.closest('.hud-phone-subbody[data-user-chat]');
  const бар = тело && тело.querySelector('.hud-phone-input-bar[data-uc-bar]');
  const место = тело && местоУзла(тело);
  if (!бар || !место || !можноПисать(номерУзла(тело))) return;
  const что = текстПузыря(пузырь);
  цитаты.set(ключЧерновика(место.где, подписьЧата(место)), { кто: ктоПузыря(пузырь), что: что.length > 120 ? что.slice(0, 119) + '…' : что });
  показатьЦитату(бар, место);
  открытьПоле(бар);
}

/**
 * Переписки игрока в этом HUD — из данных, а не из разметки: вкладка
 * «Перехваты» строится лениво, и её чатов на экране может ещё не быть.
 * → [{ место, имя, подпись }]
 */
function перепискиИгрока(номер) {
  const данные = основа.разборНомера(номер);
  const hud = основа.hudНомера(номер);
  if (!данные) return [];
  const out = [];
  const изТелефона = (карта, где) => {
    for (const [ключ, ч] of Object.entries(карта || {})) {
      if (!ч || !чатСИгроком(ключ, { pp: ч.participants, ms: ч.messages }, именаИгрока(игрок(), (где === 'phx' ? данные.phone2 && данные.phone2.phone && данные.phone2.phone.contacts : данные.phone && данные.phone.contacts) || []))) continue;
      const pp = String(ч.participants || '').split(/[;,]/).map(x => x.trim()).filter(Boolean).filter(x => !этоИгрок(x, игрок()));
      const имя = pp.length > 1 ? ключ : (String(ч.owner || '').trim() || владелецТелефона(hud, где, данные) || ключ);
      out.push({ место: { где, ключ, игрок: игрок(), тело: null }, имя, подпись: где === 'phx' ? 'Второй телефон' : 'Сообщения' });
    }
  };
  if (settings.enablePhone !== false) изТелефона(данные.chatsMap, 'cm');
  if (данные.phone2 && settings.phoneWhenCharAway === 'both') изТелефона(данные.phone2.chatsMap, 'phx');
  if (settings.enableIntercepts !== false) {
    for (const п of данные.intercepts || []) {
      if (!п || !перехватИгрока({ tg: п.target, cn: п.chatName, pp: п.participants, ms: п.messages }, игрок())) continue;
      const цель = String(п.target || '').trim();
      out.push({ место: { где: 'tp', цель, чат: String(п.chatName || '').trim(), игрок: игрок(), тело: null }, имя: цель, подпись: 'Перехваты' });
    }
  }
  return out;
}
const тотЖеМесто = (а, б) => а.где === б.где && (а.где === 'tp' ? этоИгрок(а.цель, б.цель) && (!а.чат || !б.чат || а.чат.toLowerCase() === б.чат.toLowerCase()) : String(а.ключ).toLowerCase() === String(б.ключ).toLowerCase());

function переслать(пузырь) {
  const тело = пузырь.closest('.hud-phone-subbody[data-user-chat]');
  const номер = номерУзла(тело);
  if (!тело || !можноПисать(номер)) return;
  const здесь = местоУзла(тело);
  const куда = перепискиИгрока(номер);
  const ряды = куда.map((к, i) => `<button type="button" class="hud-uc-who" data-uc="fwd-to" data-i="${i}"><span class="hud-uc-who-ava">${escapeHtml(к.имя.slice(0, 1).toUpperCase())}</span><span class="hud-uc-who-meta"><b>${escapeHtml(имяБезПриставки(к.имя))}</b><small>${к.подпись}${здесь && тотЖеМесто(к.место, здесь) ? ' · этот чат' : ''}</small></span></button>`).join('');
  const л = лист(тело, `<div class="hud-uc-sheet-title">${G_ICONS.forward} Переслать</div><div class="hud-uc-who-list">${ряды || '<p class="hud-uc-sheet-note">Других переписок нет.</p>'}</div>`);
  л.__пересылка = { от: ктоПузыря(пузырь), текст: текстПузыря(пузырь), куда, тело };
}

async function переслатьВ(кнопка) {
  const л = кнопка.closest('.hud-uc-sheet');
  const п = л && л.__пересылка;
  const цель = п && п.куда[Number(кнопка.dataset.i)];
  if (!цель || !п.тело) return;
  л.remove();
  // Узел — исходный чат (то же сообщение), место — куда пересылаем.
  await отправить(п.тело, { ...цель.место }, [{ текст: п.текст, переслано: п.от || '?' }]);
}

async function удалить(пузырь) {
  const тело = пузырь.closest('.hud-phone-subbody[data-user-chat]');
  const место = тело && местоУзла(тело);
  const номер = номерУзла(тело);
  if (!место || !можноПисать(номер)) return;
  const ключ = пузырь.dataset.msgKey;
  try {
    await основа.записатьПереписку(номер, (h) => {
      const н = найтиПереписку(h, место);
      const i = н ? н.запись.ms.findIndex(s => msgKey(разобратьСообщение(s).текст) === ключ && этоИгрок(сторонаСтроки(s).от, игрок())) : -1;
      if (i < 0) throw new Error('это сообщение лежит в прошлом ходе — удалить можно только написанное в этом');
      удалитьСтрокуИгрока(н.запись.ms, i, игрок());
    }, тело);
  } catch (e) { тост('error', 'Не удалено', String((e && e.message) || e)); return; }
  void вернутьЧат(номер, место, {});
}

/* --- Живой звонок ------------------------------------------------------------------- */
//
// Экран звонка ложится поверх чата: имя, таймер, «сбросить». Сначала модель
// решает, возьмут ли трубку; взяли — игрок говорит репликами, персонаж
// отвечает (запрос на каждую реплику). До «сбросить» в HUD ничего не пишется:
// весь разговор в памяти. Потом — строка звонка с исходом, длительностью и
// итогом, расшифровка — в extra этого свайпа, коротко — в следующий ответ.

let звонок = null;
let часыЗвонка = 0;

/** Контекст для модели — те же настройки, что у ответа в переписке. */
async function контекстЗвонка(з) {
  const ctx = основа.getStContextSafe();
  const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const сообщение = чат[з.номер];
  const { карточка, персона } = карточкаИПерсона(з.кто);
  let снимок = '';
  if (settings.userChatHud !== false && сообщение) {
    try {
      const блок = extractHudBlock(основа.текстСообщенияЧата(сообщение));
      const объект = блок ? собратьСнимок(блок) : null;
      if (объект) снимок = строкаСнимка(объект, решитьNSFW(объект, последниеТекстыЧата(чат, з.номер + 1)))
        .replace(/,\s*"[^"]+"\s*:\s*(?:"<new this turn>"|\[\s*"<new this turn>"\s*\])/g, '')
        .replace(/"[^"]+"\s*:\s*(?:"<new this turn>"|\[\s*"<new this turn>"\s*\])\s*,?/g, '');
    } catch (_) { снимок = ''; }
  }
  const история = историяЧата(з.номер);
  let лор = '';
  if (settings.userChatLore === true) { try { лор = String(await основа.buildHudLoreContext(история) || ''); } catch (_) { лор = ''; } }
  return { карточка, персона, снимок, история, лор };
}

async function спроситьЗвонок(этап) {
  const з = звонок;
  const ctx = основа.getStContextSafe();
  const hud = основа.hudНомера(з.номер);
  const найдено = hud && найтиПереписку(hud, з.место);
  const к = await контекстЗвонка(з);
  const разбор = (т) => этап === 'quick' ? разобратьЗвонокСТемой(т, { игрок: з.имена, кто: з.кто }) : разобратьЗвонок(т, { игрок: з.имена, кто: з.кто });
  const промпт = промптЗвонка({ этап, тема: з.тема, игрок: игрок(), кто: з.кто, время: з.время, язык: языкПереписки(), ms: (найдено && найдено.ms) || [], реплики: з.реплики, ...к });
  const рег = await основа.загрузитьПерегенерацию();
  з.отмена = new AbortController();
  const пределМин = Math.max(0, Number(settings.hudRegenTimeout ?? 6) || 0);
  let молчание = 0, вышлоВремя = false;
  const живой = () => { clearTimeout(молчание); молчание = пределМин ? setTimeout(() => { вышлоВремя = true; з.отмена.abort(); }, пределМин * 60000) : 0; };
  живой();
  try {
    const лимит = Math.max(256, Math.min(16000, parseInt(settings.userChatMaxTokens ?? 2048, 10) || 2048));
    const { текст } = await рег.запросКМодели({ stContext: ctx, сообщения: [{ role: 'user', content: промпт }], лимит, отмена: з.отмена, живой,
      повторЕсли: (data, извлечь) => { if (!рег.обрывПоЛимиту(data)) return false; const р = разбор(рег.текстОтвета(data, извлечь)); return !(р.реплики || р.расшифровка || []).length && !р.исход; } });
    return разбор(текст);
  } catch (e) {
    if (вышлоВремя) throw new Error(`провайдер не ответил за ${пределМин} мин`);
    throw e;
  } finally { clearTimeout(молчание); з.отмена = null; }
}

const СЛОВО_ИСХОДА = { declined: 'Звонок отклонён', missed: 'Не отвечает', answered: 'Звонок завершён' };
const СТРЕЛКА = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/></svg>';
// Сколько «звучит» реплика: волна у аватара пляшет, пока персонаж говорит.
const звучит = (т) => Math.min(4200, 900 + String(т || '').split(/\s+/).length * 260);

function репликаЗвонка(р, кто, старая) {
  const д = document.createElement('div');
  д.className = `hud-uc-call-line is-${р.кто === 'me' ? 'me' : 'them'}${старая ? ' is-old' : ''}`;
  д.setAttribute('data-i18n-skip', '');
  д.innerHTML = `<b>${escapeHtml(р.кто === 'me' ? имяБезПриставки(игрок()) : имяБезПриставки(кто))}</b><span>${escapeHtml(р.текст)}</span>`;
  return д;
}
function строкаОжидания(кто) {
  const д = document.createElement('div');
  д.className = 'hud-uc-call-line is-them is-wait';
  д.innerHTML = `<b data-i18n-skip>${escapeHtml(имяБезПриставки(кто))}</b><span class="hud-ask-typing"><i></i><i></i><i></i></span>`;
  return д;
}
/** Что написано под именем: «Вызов…», таймер или исход. */
export function состояниеЗвонка(з) {
  if (з.сост === 'вызов') return 'Вызов…';
  if (з.сост === 'разговор') return длительностьЗвонка((Date.now() - з.начало) / 1000);
  return [СЛОВО_ИСХОДА[з.исход] || 'Звонок завершён', з.исход === 'answered' ? з.длитИтог : ''].filter(Boolean).join(' · ');
}

/**
 * Экран звонка собирается один раз, дальше только обновляется (обновитьЭкранЗвонка):
 * перерисовка целиком сбивала анимации, фокус и каретку. восстановлен — карточку
 * перерисовали, экран вернулся: без анимации входа и без «новых» реплик.
 */
export function собратьЭкранЗвонка(з, { восстановлен = false } = {}) {
  const э = document.createElement('div');
  э.className = 'hud-uc-call' + (восстановлен ? ' is-restored' : '');
  let фото = '';
  try { фото = String(фотоПоИмени(з.кто) || ''); } catch (_) { фото = ''; }
  const имя = имяБезПриставки(з.кто);
  if (фото) э.style.setProperty('--uc-ava', `url("${фото.replace(/["\\\n]/g, encodeURIComponent)}")`);
  э.innerHTML = `<div class="hud-uc-call-bg${фото ? ' has-img' : ''}" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="hud-uc-call-top">
      <div class="hud-uc-call-halo"><span class="hud-uc-call-ripple"></span><span class="hud-uc-call-ripple"></span><span class="hud-uc-call-ripple"></span><span class="hud-uc-call-ava${фото ? ' has-img' : ''}">${фото ? '' : escapeHtml(имя.slice(0, 1).toUpperCase())}</span></div>
      <b class="hud-uc-call-name" data-i18n-skip>${escapeHtml(имя)}</b>
      <small class="hud-uc-call-state"></small>
      <span class="hud-uc-call-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
    </div>
    <div class="hud-uc-call-lines" role="log" aria-live="polite"></div>
    <div class="hud-uc-call-bar"><textarea class="hud-uc-input hud-uc-call-input" rows="1" enterkeyhint="send" placeholder="Сказать…" aria-label="Сказать"></textarea><button type="button" class="hud-uc-call-say" data-uc="call-say" aria-label="Сказать">${СТРЕЛКА}</button></div>
    <div class="hud-uc-call-ctl">
      <button type="button" class="hud-uc-call-end" data-uc="call-end" aria-label="Сбросить звонок" title="Сбросить звонок">${G_ICONS.handset}</button>
      <button type="button" class="hud-uc-call-close" data-uc="call-close">Закрыть</button>
    </div>`;
  const поле = э.querySelector('.hud-uc-call-input');
  поле.value = з.черновик || '';
  const лента = э.querySelector('.hud-uc-call-lines');
  з.реплики.forEach(р => лента.appendChild(репликаЗвонка(р, з.кто, true)));
  э.__строк = з.реплики.length;
  э.__сост = з.сост;
  обновитьЭкранЗвонка(э, з, { сразу: true });
  return э;
}

/** Привести экран к состоянию звонка: новые реплики дописать, кнопки переключить. */
export function обновитьЭкранЗвонка(э, з, { сразу = false } = {}) {
  if (!э) return;
  const было = э.__сост;
  э.dataset.state = з.сост;
  э.dataset.outcome = з.исход || '';
  э.classList.toggle('is-waiting', !!з.ждёт && з.сост === 'разговор');
  э.classList.toggle('is-held', з.сост === 'конец' && !!з.держать);
  э.classList.toggle('has-lines', з.реплики.length > 0);
  // Трубку взяли: короткая вспышка у аватара.
  if (!сразу && было === 'вызов' && з.сост === 'разговор') {
    э.classList.remove('is-connected'); void э.offsetWidth; э.classList.add('is-connected');
    setTimeout(() => э.classList.remove('is-connected'), 900);
  }
  э.__сост = з.сост;
  const сост = э.querySelector('.hud-uc-call-state');
  const надпись = состояниеЗвонка(з);
  // Сверяем с тем, что ставили сами: английский переводчик меняет текст узла.
  if (сост && э.__надпись !== надпись) { э.__надпись = надпись; сост.textContent = надпись; }
  const лента = э.querySelector('.hud-uc-call-lines');
  let ожидание = лента.querySelector(':scope > .is-wait');
  // Реплику забрали (не дошла до модели) — убрать и с экрана.
  if (з.реплики.length < (э.__строк || 0)) {
    [...лента.querySelectorAll(':scope > .hud-uc-call-line:not(.is-wait)')].slice(з.реплики.length).forEach(у => у.remove());
    э.__строк = з.реплики.length;
  }
  let новыеЕго = '';
  const сначала = э.__строк || 0;
  for (let i = сначала; i < з.реплики.length; i++) {
    const р = з.реплики[i];
    const у = репликаЗвонка(р, з.кто, сразу);
    // Пришло несколько реплик сразу (звонок с темой) — появляются по очереди.
    const задержка = !сразу && i > сначала ? (i - сначала) * 320 : 0;
    if (задержка) у.style.animationDelay = (задержка / 1000).toFixed(2) + 's';
    у.__старт = performance.now() + задержка;
    лента.insertBefore(у, ожидание || null);
    if (р.кто !== 'me') новыеЕго = р.текст;
  }
  const добавлено = з.реплики.length - (э.__строк || 0);
  э.__строк = з.реплики.length;
  if (з.ждёт && з.сост === 'разговор' && !ожидание) { ожидание = строкаОжидания(з.кто); лента.appendChild(ожидание); }
  else if ((!з.ждёт || з.сост !== 'разговор') && ожидание) ожидание.remove();
  if (добавлено > 0 || з.ждёт) {
    const вниз = () => { try { лента.scrollTo({ top: лента.scrollHeight, behavior: сразу ? 'auto' : 'smooth' }); } catch (_) { лента.scrollTop = лента.scrollHeight; } };
    вниз(); if (!сразу) setTimeout(вниз, 60);
  } else if (сразу) лента.scrollTop = лента.scrollHeight;
  if (новыеЕго && !сразу && з.сост !== 'конец') {
    э.classList.add('is-speaking');
    clearTimeout(э.__звучит);
    э.__звучит = setTimeout(() => э.classList.remove('is-speaking'), звучит(новыеЕго));
  }
  if (з.сост === 'конец') { clearTimeout(э.__звучит); э.classList.remove('is-speaking'); }
  const сказать = э.querySelector('.hud-uc-call-say');
  if (сказать) сказать.disabled = !!з.ждёт || з.сост !== 'разговор';
  const поле = э.querySelector('.hud-uc-call-input');
  if (поле) поле.disabled = з.сост !== 'разговор';
  const конец = э.querySelector('.hud-uc-call-end');
  if (конец) конец.disabled = з.сост === 'конец';
  const закрыть = э.querySelector('.hud-uc-call-close');
  if (закрыть) закрыть.disabled = !(з.сост === 'конец' && з.держать);
}

/**
 * Карточку перерисовали (запись в HUD, ответ модели) — возвращаем ТОТ ЖЕ экран:
 * без входа заново, с полем и кареткой; начатые реплики доигрывают с того же места.
 */
export function вернутьЭкранЗвонка(э) {
  э.classList.add('is-restored');
  const сейчас = performance.now();
  э.querySelectorAll('.hud-uc-call-line:not(.is-old)').forEach(л => {
    const осталось = (л.__старт ?? -1e9) - сейчас;
    if (осталось + 400 <= 0) л.classList.add('is-old');
    else л.style.animationDelay = (осталось / 1000).toFixed(3) + 's';
  });
  return э;
}

/** Экран уходит плавно; потом — прочь из разметки. */
export function убратьЭкранПлавно(э, готово) {
  if (!э || !э.isConnected) { if (готово) готово(); return; }
  э.classList.add('is-leaving');
  setTimeout(() => { э.remove(); if (готово) готово(); }, 340);
}

/** Где сейчас экран: тело переписки в карточке этого сообщения. */
function телоЗвонка() {
  if (!звонок) return null;
  const карта = картаПереписки(звонок.номер);
  return карта ? телоВКарте(карта, звонок.место) : null;
}
/** Экран ложится на всё приложение «Сообщения» (с шапкой), как настоящий экран звонка. */
const хозяинЭкрана = (тело) => (тело && тело.closest('.hud-phone-app-view')) || тело;
const экранЗвонкаВ = (тело) => { const х = хозяинЭкрана(тело); return х ? х.querySelector(':scope > .hud-uc-call') : null; };
/** Нарисовать или обновить экран; после перерисовки карточки — вернуть на место. */
function нарисоватьЗвонок() {
  const з = звонок;
  if (!з || з.уходит) return;
  const тело = телоЗвонка();
  if (!тело) return;
  const хозяин = хозяинЭкрана(тело);
  let экран = хозяин.querySelector(':scope > .hud-uc-call');
  if (!экран) {
    if (getComputedStyle(хозяин).position === 'static') хозяин.classList.add('hud-uc-host');
    if (з.экран && !з.экран.isConnected) {
      экран = вернутьЭкранЗвонка(з.экран);
      хозяин.appendChild(экран);
      const лента = экран.querySelector('.hud-uc-call-lines');
      if (лента) лента.scrollTop = лента.scrollHeight;
      обновитьЭкранЗвонка(экран, з);
    } else {
      экран = собратьЭкранЗвонка(з, { восстановлен: !!з.показан });
      хозяин.appendChild(экран);
    }
    з.экран = экран;
    з.показан = true;
    if (з.фокус) { з.фокус = false; фокусЗвонка(экран); }
    пилюляЗвонка(экран, з);
    return;
  }
  const поле = экран.querySelector('.hud-uc-call-input');
  if (поле) з.черновик = поле.value;
  обновитьЭкранЗвонка(экран, з);
  if (з.фокус) { з.фокус = false; фокусЗвонка(экран); }
  пилюляЗвонка(экран, з);
}
/**
 * Игрок ушёл из «Сообщений» кнопками телефона, а звонок идёт: экран спрятан
 * вместе с приложением. Зелёная пилюля сверху телефона возвращает к звонку.
 */
export function пилюляЗвонка(экран, з) {
  const эм = экран && экран.closest('.hud-phone-emulator');
  document.querySelectorAll('.hud-uc-call-pill').forEach(п => { if (п.closest('.hud-phone-emulator') !== эм) п.remove(); });
  if (!эм) return;
  let п = эм.querySelector(':scope > .hud-uc-call-pill');
  if (з.сост === 'конец' || экран.offsetParent) { if (п) п.remove(); return; }
  if (!п) {
    п = document.createElement('button');
    п.type = 'button'; п.className = 'hud-uc-call-pill'; п.dataset.uc = 'call-back'; п.title = 'Вернуться к звонку';
    п.innerHTML = `${G_ICONS.handset}<span data-i18n-skip></span>`;
    эм.appendChild(п);
  }
  const т = `${имяБезПриставки(з.кто)} · ${состояниеЗвонка(з)}`;
  if (п.__т !== т) { п.__т = т; п.querySelector('span').textContent = т; }
}
async function вернутьсяКЗвонку() {
  const з = звонок;
  if (!з || з.сост === 'конец') return;
  const карта = картаПереписки(з.номер);
  if (карта) await открытьЧат(карта, з.место);
  з.фокус = true;
  нарисоватьЗвонок();
}
function фокусЗвонка(экран) {
  const поле = экран.querySelector('.hud-uc-call-input');
  if (!поле || поле.disabled) return;
  try { поле.focus({ preventScroll: true }); поле.setSelectionRange(поле.value.length, поле.value.length); } catch (_) {}
}
function убратьЭкранЗвонка() {
  document.querySelectorAll('.hud-uc-call, .hud-uc-call-pill').forEach(э => э.remove());
  clearInterval(часыЗвонка); часыЗвонка = 0;
}

async function начатьЗвонок(место, { живой = false, тема = '' } = {}) {
  const номер = номерУзла(место.тело);
  if (!можноПисать(номер)) return;
  if (звонок && звонок.сост !== 'конец') { тост('info', 'Звонок', 'Уже идёт звонок — сначала сбрось его.'); return; }
  if (звонок) { убратьЭкранЗвонка(); звонок = null; }
  const hud = основа.hudНомера(номер);
  if (!hud) { тост('error', 'Звонок', 'HUD сообщения не разобрался.'); return; }
  const найдено = найтиПереписку(hud, место);
  const { кто, состав } = собеседники(место, hud, найдено);
  if (состав.length || !кто) { тост('info', 'Звонок', 'Звонить можно в личном чате.'); return; }
  const данные = основа.разборНомера(номер);
  const времяСцены = данные && данные.scene ? String(данные.scene['Время'] || '') : '';
  const ctx = основа.getStContextSafe();
  звонок = {
    номер, место: { ...место, тело: null }, кто, имена: (место.имена && место.имена.length) ? место.имена : именаМеста(место, номер),
    сост: 'вызов', исход: '', начало: 0, реплики: [], итог: '', черновик: '', ждёт: false, отмена: null,
    живой, тема: String(тема || '').trim().slice(0, 600), длит: '', держать: false, показан: false,
    время: времяОтправки(времяСцены, [...прежниеСтроки(номер, место), ...((найдено && найдено.ms) || [])]),
    чат: чатТаверны(), свайп: свайпНомера(номер), сообщение: ctx && ctx.chat ? ctx.chat[номер] : null, сообщенияПосле: [],
  };
  const з = звонок;
  нарисоватьЗвонок();
  // Таймер и защита от перерисовки карточки: экран возвращается сам.
  clearInterval(часыЗвонка);
  часыЗвонка = setInterval(() => {
    if (звонок !== з) return;
    if (чатТаверны() !== з.чат) { убратьЭкранЗвонка(); if (з.отмена) { try { з.отмена.abort(); } catch (_) {} } звонок = null; return; }
    // Таверна пошла дальше (новый ход, свайп, правка) — звонок уже не запишется: говорим сразу, а не после «сбросить».
    if (!з.предупреждён && з.сост !== 'конец') {
      const сейчас = основа.getStContextSafe()?.chat?.[з.номер];
      if (основа.идётОтвет() || сейчас !== з.сообщение || свайпНомера(з.номер) !== з.свайп || основа.последнийHUD() !== з.номер) {
        з.предупреждён = true;
        тост('info', 'Звонок', 'В Таверне пошёл новый ход — этот звонок в HUD уже не запишется.');
      }
    }
    // Законченный звонок с расшифровкой держится до «Закрыть» — и после перерисовки карточки.
    if (з.сост !== 'конец' || з.держать) нарисоватьЗвонок();
  }, 1000);
  try {
    const р = await спроситьЗвонок(живой ? 'pickup' : 'quick');
    if (звонок !== з || з.сост !== 'вызов') return; // сбросили, пока звонило
    if (!живой) {
      // Звонок с темой: разговор пришёл целиком — сразу итог, экран держим с расшифровкой.
      з.исход = р.исход || 'missed';
      if (з.исход === 'answered') { з.реплики = р.расшифровка; з.итог = р.итог; з.длит = р.длит; з.держать = з.реплики.length > 0; }
      else з.сообщенияПосле = р.сообщения;
      return void завершитьЗвонок('они');
    }
    if (р.исход !== 'answered') {
      з.исход = р.исход || 'missed';
      з.сообщенияПосле = р.сообщения;
      з.итог = '';
      return void завершитьЗвонок('они');
    }
    з.сост = 'разговор'; з.начало = Date.now(); з.итог = р.итог; з.фокус = true;
    р.реплики.forEach(т => з.реплики.push({ кто: 'them', текст: т }));
    нарисоватьЗвонок();
  } catch (e) {
    if (звонок !== з || з.сост !== 'вызов') return;
    // Ошибка модели — не «пропущенный звонок»: в HUD ничего не пишем, уведомление как у любой ошибки модели.
    if (!(e && e.name === 'AbortError')) тост('error', 'Ответ не пришёл', String((e && e.message) || e));
    з.уходит = true; clearInterval(часыЗвонка); часыЗвонка = 0;
    убратьЭкранПлавно(экранЗвонкаВ(телоЗвонка()), () => { if (звонок === з) звонок = null; });
  }
}

async function сказатьВЗвонке() {
  const з = звонок;
  if (!з || з.сост !== 'разговор' || з.ждёт) return;
  const поле = экранЗвонкаВ(телоЗвонка())?.querySelector('.hud-uc-call-input');
  const текст = поле ? поле.value.replace(/\s*\n+\s*/g, ' ').trim() : '';
  if (!текст) return;
  з.черновик = '';
  з.реплики.push({ кто: 'me', текст });
  з.ждёт = true; з.фокус = true;
  if (поле) { поле.value = ''; поле.style.height = ''; }
  нарисоватьЗвонок();
  try {
    const р = await спроситьЗвонок('talk');
    if (звонок !== з || з.сост !== 'разговор') return;
    р.реплики.forEach(т => з.реплики.push({ кто: 'them', текст: т }));
    if (р.итог) з.итог = р.итог;
    if (!р.реплики.length && !р.конец) тост('info', 'Звонок', `${имяБезПриставки(з.кто)} молчит — скажи ещё раз или сбрось.`);
    з.ждёт = false; з.фокус = true;
    нарисоватьЗвонок();
    if (р.конец) setTimeout(() => { if (звонок === з && з.сост === 'разговор') void завершитьЗвонок('они'); }, 1600);
  } catch (e) {
    if (звонок !== з || з.сост !== 'разговор') return;
    з.ждёт = false;
    // Реплика не дошла: убираем её из разговора и возвращаем в поле — отправить ещё раз без дубля.
    const последняя = з.реплики[з.реплики.length - 1];
    if (последняя && последняя.кто === 'me' && последняя.текст === текст) {
      з.реплики.pop();
      const п = экранЗвонкаВ(телоЗвонка())?.querySelector('.hud-uc-call-input');
      if (п && !п.value.trim()) п.value = текст;
      else if (!п) з.черновик = текст;
    }
    з.фокус = true;
    нарисоватьЗвонок();
    if (!(e && e.name === 'AbortError')) тост('error', 'Ответ не пришёл', String((e && e.message) || e));
  }
}

/** Конец звонка: строка в HUD, расшифровка в extra, экран — «завершён» и прочь. */
async function завершитьЗвонок(кто) {
  const з = звонок;
  if (!з || з.сост === 'конец') return;
  const былРазговор = з.сост === 'разговор' || (!з.живой && з.исход === 'answered');
  if (з.отмена) { try { з.отмена.abort(); } catch (_) {} }
  if (!былРазговор && !з.исход) з.исход = 'missed'; // сбросили сами, пока звонило
  if (былРазговор) з.исход = 'answered';
  const длит = !былРазговор ? '' : з.живой ? длительностьЗвонка((Date.now() - з.начало) / 1000) : (з.длит || '0:30');
  з.сост = 'конец'; з.ждёт = false; з.длитИтог = длит;
  нарисоватьЗвонок();
  const id = былРазговор && з.реплики.length ? номерЗвонка() : '';
  const ctx = основа.getStContextSafe();
  const чат = ctx && Array.isArray(ctx.chat) ? ctx.chat : [];
  const сменилось = чат[з.номер] !== з.сообщение || чатТаверны() !== з.чат || свайпНомера(з.номер) !== з.свайп || основа.последнийHUD() !== з.номер;
  // Итог видно полторы секунды, потом экран плавно уходит. Звонок с темой держит расшифровку до «Закрыть».
  if (!з.держать) setTimeout(() => { if (звонок !== з) return; з.уходит = true; clearInterval(часыЗвонка); часыЗвонка = 0; убратьЭкранПлавно(экранЗвонкаВ(телоЗвонка()), () => { if (звонок === з) звонок = null; }); }, 1500);
  if (сменилось) { тост('info', 'Звонок', 'Пока шёл звонок, сообщение сменилось — звонок в HUD не записан.'); return; }
  const hud = основа.hudНомера(з.номер);
  const найдено = hud && найтиПереписку(hud, з.место);
  const прежние = найдено && найдено.ms.length ? [] : прежниеСтроки(з.номер, з.место);
  const данные = основа.разборНомера(з.номер);
  const строка = строкаЗвонка({ игрок: игрок(), кому: з.кто, время: з.время, исход: з.исход, длит, итог: былРазговор ? з.итог : '', номер: id });
  const строки = [строка, ...(з.сообщенияПосле || [])];
  try {
    await основа.записатьПереписку(з.номер, (h, message) => {
      дописатьВПереписку(h, з.место, строки, { прежние, владелец: з.место.где === 'tp' ? '' : владелецТелефона(h, з.место.где, данные), игрок: игрок() });
      if (id) запомнитьЗвонок(message, id, { с: з.кто, время: з.время, длит, итог: з.итог, реплики: з.реплики.map(р => ({ кто: р.кто, текст: р.текст })) });
      запомнитьПереписку(message, { чат: подписьЧата(з.место), где: з.место.где, строки, игрок: игрок(), разговор: id ? { с: з.кто, итог: з.итог, реплики: з.реплики } : null });
    }, null);
  } catch (e) { тост('error', 'Звонок не записан', String((e && e.message) || e)); return; }
  // Карточка пересобралась после записи — экран (итог или расшифровку) возвращаем сразу, без анимации входа.
  await вернутьЧат(з.номер, з.место, { тихо: false });
  if (звонок === з) нарисоватьЗвонок();
}

/** Расшифровка по нажатию на полосу звонка. */
function показатьРасшифровку(узел) {
  const номер = узел.dataset.callId;
  const з = найтиЗвонок(основа.getStContextSafe()?.chat, номер);
  if (!з) { тост('info', 'Звонок', 'Расшифровка этого звонка не сохранилась — она живёт в том свайпе, где звонили.'); return; }
  document.querySelectorAll('.hud-uc-tr').forEach(о => о.remove());
  const игр = имяБезПриставки(игрок()), он = имяБезПриставки(з.с || '');
  const о = document.createElement('div');
  о.className = 'hud-modal-overlay hud-uc-tr';
  о.innerHTML = `<div class="hud-modal hud-uc-tr-box" role="dialog" aria-modal="true" aria-label="Расшифровка звонка">
      <div class="hud-uc-tr-head">${G_ICONS.handset}<b data-i18n-skip>${escapeHtml(он || 'Звонок')}</b><small>${escapeHtml([з.время, з.длит].filter(Boolean).join(' · '))}</small></div>
      ${з.итог ? `<div class="hud-uc-tr-sum" data-i18n-skip>${escapeHtml(з.итог)}</div>` : ''}
      <div class="hud-uc-tr-lines">${(з.реплики || []).map(р => `<div class="hud-uc-call-line is-${р.кто === 'me' ? 'me' : 'them'}" data-i18n-skip><b>${escapeHtml(р.кто === 'me' ? игр : он)}</b><span>${escapeHtml(р.текст)}</span></div>`).join('')}</div>
      <div class="hud-modal-foot"><button type="button" class="hud-modal-btn cancel">Закрыть</button></div>
    </div>`;
  document.body.appendChild(о);
  const закрыть = () => { о.remove(); document.removeEventListener('keydown', клавиша, true); };
  const клавиша = (e) => { if (e.key === 'Escape') { e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', клавиша, true);
  о.addEventListener('click', (e) => { if (e.target === о || e.target.closest('.cancel')) закрыть(); });
}

/* --- Вход: нажатие по [data-uc] ------------------------------------------------------- */

export function нажатие(узел) {
  const что = узел.dataset.uc;
  const бар = узел.closest('.hud-phone-input-bar[data-uc-bar]');
  switch (что) {
    case 'field': if (можноПисать(номерУзла(узел))) { открытьПоле(бар); показатьЦитату(бар, местоУзла(бар)); } return;
    case 'send': {
      if (!полеИз(бар)) { if (можноПисать(номерУзла(узел))) открытьПоле(бар); return; }
      void отправитьТекст(бар); return;
    }
    case 'attach': открытьВложения(бар); return;
    case 'kind': формаВида(узел, узел.dataset.kind); return;
    case 'kind-send': void отправитьВид(узел); return;
    case 'photo-mode': режимФото(узел); return;
    case 'sheet-close': убратьЛист(узел.closest('.hud-uc-sheet')); return;
    case 'unquote': {
      const место = местоУзла(узел);
      if (место) { цитаты.delete(ключЧерновика(место.где, подписьЧата(место))); узел.closest('.hud-uc-quote')?.remove(); }
      return;
    }
    case 'new': открытьНовый(узел); return;
    case 'pick': void начатьЧат(узел, узел.dataset.name, узел.dataset.where); return;
    case 'pick-other': {
      const имя = String(узел.closest('.hud-uc-sheet')?.querySelector('[data-f="имя"]')?.value || '').trim();
      if (имя && !этоИгрок(имя, игрок())) void начатьЧат(узел, имя, 'tp');
      return;
    }
    case 'retry': {
      const тело = узел.closest('.hud-phone-subbody');
      const место = тело && местоУзла(тело);
      const номер = номерУзла(узел);
      if (место && номер !== null && можноПисать(номер)) запланироватьОтвет(ключМеста(номер, место), номер, { ...место, тело: null });
      return;
    }
    case 'reply': case 'forward': case 'delete': {
      const пузырь = узел.closest('.hud-msg-bubble');
      узел.closest('.hud-reaction-palette')?.remove();
      if (!пузырь) return;
      if (что === 'reply') ответитьНа(пузырь);
      else if (что === 'forward') переслать(пузырь);
      else void удалить(пузырь);
      return;
    }
    case 'fwd-to': void переслатьВ(узел); return;
    case 'call-say': void сказатьВЗвонке(); return;
    case 'call-end': void завершитьЗвонок('я'); return;
    case 'call-close': if (звонок && звонок.сост === 'конец') { const з = звонок; з.уходит = true; clearInterval(часыЗвонка); часыЗвонка = 0; убратьЭкранПлавно(узел.closest('.hud-uc-call'), () => { if (звонок === з) звонок = null; }); } return;
    case 'call-tr': показатьРасшифровку(узел); return;
    case 'call-back': void вернутьсяКЗвонку(); return;
    default:
  }
}

/** Игрок печатает в поле (index.js, событие input): ждущий ответ отодвигается. */
export function печатает(поле) {
  const тело = поле && поле.closest ? поле.closest('.hud-phone-subbody[data-user-chat]') : null;
  const место = тело && местоУзла(тело);
  const номер = тело ? номерУзла(тело) : null;
  if (!место || номер === null) return;
  const з = ждут.get(ключМеста(номер, место));
  if (!з || з.сост !== 'wait') return;
  clearTimeout(з.таймер);
  з.таймер = setTimeout(() => { void запроситьОтвет(ключМеста(номер, место)); }, ПАУЗА_ДО_ОТВЕТА);
}

/** Карточка собралась заново: строки «печатает…» — по ждущим ответа. */
export function послеОтрисовки() { if (ждут.size) обновитьСтроки(); }
