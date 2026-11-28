// hud-manager/user-chat.js
//
// Переписка от лица игрока. Своего телефона у {{user}} нет, поэтому всё видно
// в телефоне персонажа: чат с {{user}} лежит в его «Сообщениях» (cm), а
// переписки игрока с другими — в «Перехватах» (tp), как телефон того, кому
// игрок пишет. Пузыри игрока — слева, входящие: экран читает персонаж.
//
// Здесь — чистая часть: какой чат игрока, строка сообщения в формате модели,
// время отправки, дописывание в HUD сообщения, промпт для ответа, разбор
// ответа и заметка для следующего ответа модели. Окно, кнопки и запрос —
// user-chat-ui.js.
//
// Переписка живёт в HUD того свайпа, где её писали: другой свайп её не видит.
// Дальше она идёт только в следующий ответ — в снимке прошлого HUD и
// заметкой «между ходами игрок писал…» (заметкаДляОтвета).

import { собратьСообщение, разобратьСообщениеПравки } from './block-edit.js?v=23.90.14';
import { тотЖеСтрого, namesLikelySame } from './names.js?v=23.90.14';

const объект = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const текст = (v) => (v === null || v === undefined ? '' : String(v)).trim();
const ПУСТО = /^(?:|empty|none|null|unknown)$/i;

/**
 * Тот же человек: имя игрока, его вариант или {{user}}. игрок — имя или
 * список имён (как он записан в этом телефоне — именаИгрока).
 */
export function этоИгрок(имя, игрок) {
  if (Array.isArray(игрок)) return игрок.some(п => этоИгрок(имя, п));
  const и = текст(имя), п = текст(игрок);
  if (!и) return false;
  if (/^\{\{\s*user\s*\}\}$/i.test(и)) return true;
  if (!п) return false;
  return тотЖеСтрого(и, п);
}

/**
 * Как игрок записан в этом телефоне: его имя и имена контактов, чьё настоящее
 * имя — он («Смирнова» с настоящим «Вера Смирнова»). Модель пишет такие чаты и
 * реплики под записанным именем. контакты — phone.contacts ({ name, realName })
 * или коды phn.ct ({ n, rn }).
 */
export function именаИгрока(игрок, контакты = []) {
  const out = [текст(игрок)].filter(Boolean);
  for (const c of Array.isArray(контакты) ? контакты : []) {
    if (!объект(c)) continue;
    const записан = текст(c.name ?? c.n), настоящее = текст(c.realName ?? c.rn);
    if (записан && настоящее && этоИгрок(настоящее, игрок) && !out.some(x => x.toLowerCase() === записан.toLowerCase())) out.push(записан);
  }
  return out;
}

/** Отправитель и адресат строки «Кто -> Кому: текст | время | статус». */
export function сторонаСтроки(строка) {
  const м = разобратьСообщениеПравки(строка);
  return { от: м.от, кому: м.кому };
}

const участники = (pp) => текст(pp).split(/[;,]/).map(текст).filter(Boolean);

/** Игрок пишет или получает хоть одно сообщение этого списка. */
export function игрокВСообщениях(ms, игрок) {
  return (Array.isArray(ms) ? ms : []).some(s => {
    const { от, кому } = сторонаСтроки(s);
    return этоИгрок(от, игрок) || этоИгрок(кому, игрок);
  });
}

/** Чат телефона (cm, в кодах: { ow, pp, ms }) — переписка с игроком. */
export function чатСИгроком(ключ, чат, игрок) {
  if (!объект(чат)) return false;
  if (этоИгрок(ключ, игрок)) return true;
  if (участники(чат.pp ?? чат.participants).some(и => этоИгрок(и, игрок))) return true;
  return игрокВСообщениях(чат.ms ?? чат.messages, игрок);
}

/** Перехват (tp, в кодах: { tg, cn, pp, ms }) — переписка игрока с другим. */
export function перехватИгрока(п, игрок) {
  if (!объект(п)) return false;
  if (этоИгрок(п.tg ?? п.target, игрок)) return false;
  if (этоИгрок(п.cn ?? п.chatName, игрок)) return true;
  if (участники(п.pp ?? п.participants).some(и => этоИгрок(и, игрок))) return true;
  return игрокВСообщениях(п.ms ?? п.messages, игрок);
}

/* --- Время ------------------------------------------------------------------ */

const ЧАСЫ = /\b(\d{1,2}):(\d{2})\b/;
const вМинуты = (s) => { const м = String(s || '').match(ЧАСЫ); return м ? +м[1] * 60 + +м[2] : null; };
const изМинут = (n) => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
// День в поле времени («Вчера, 22:30», «12.10, 14:05») — не сегодняшнее.
const СДНЁМ = /(?:вчера|позавчера|yesterday|\d{1,2}\.\d{1,2})/i;

/**
 * Время нового сообщения: часы сцены, но не раньше последнего сегодняшнего
 * сообщения чата — переписка не идёт назад. Сообщение подряд — та же минута.
 */
export function времяОтправки(времяСцены, ms) {
  let база = вМинуты(времяСцены);
  for (const s of Array.isArray(ms) ? ms : []) {
    const поле = String(s || '').split('|')[1] || '';
    if (!поле.trim() || СДНЁМ.test(поле)) continue;
    const м = вМинуты(поле);
    if (м !== null && (база === null || м > база)) база = м;
  }
  return база === null ? '' : изМинут(база);
}

/* --- Строка сообщения ---------------------------------------------------------- */

/** Длительность голосового по числу слов: около двух с половиной слов в секунду. */
export function длительностьГолоса(слова) {
  const n = текст(слова).split(/\s+/).filter(Boolean).length;
  const с = Math.max(2, Math.min(600, Math.round(n / 2.5) + 1));
  return `${Math.floor(с / 60)}:${String(с % 60).padStart(2, '0')}`;
}

/**
 * Строка игрока в формате модели. м: { вид: text|voice|photo|video|call|poll,
 * текст, что (снимок/ролик), ответ: { кто, что }, переслано, опрос: { вопрос, варианты: [текст] } }.
 * Статус — Unread: персонаж ещё не прочёл.
 */
export function строкаИгрока({ игрок, кому, время = '', м = {} }) {
  const вид = ['voice', 'photo', 'video', 'call', 'poll'].includes(м.вид) ? м.вид : 'text';
  return собратьСообщение({
    от: игрок, кому: кому || '', текст: вид === 'call' || вид === 'poll' ? '' : текст(м.текст), время,
    статус: 'unread', статусКак: '', вид,
    голос: { длит: вид === 'voice' ? длительностьГолоса(м.текст) : '' },
    // Своя картинка: ссылка на файл — в конце описания (render/msg-parts.js, файлСнимка).
    фото: { что: вид === 'photo' ? [текст(м.что), м.файл ? `(file: ${м.файл})` : ''].filter(Boolean).join(' ') : '' },
    видео: { длит: '', что: вид === 'video' ? текст(м.что) : '' },
    // Игрок звонит владельцу телефона — на этом телефоне звонок входящий.
    // Исход решит модель (применитьОтвет).
    звонок: { куда: 'in', исход: 'missed', длит: '' },
    опрос: { вопрос: текст(м.опрос && м.опрос.вопрос), варианты: ((м.опрос && м.опрос.варианты) || []).map(т => ({ текст: т, кто: '' })) },
    ответ: м.ответ && текст(м.ответ.что) ? { кто: текст(м.ответ.кто), что: текст(м.ответ.что) } : null,
    переслано: м.переслано ? текст(м.переслано) : null,
    кем: null, прочее: [],
  }).replace(/\[CALL: incoming, missed\]/, '[CALL: incoming]');
}

/** Строки игрока, ещё не прочитанные, становятся прочитанными. */
export function прочитатьСтрокиИгрока(ms, игрок) {
  return (Array.isArray(ms) ? ms : []).map(s => {
    const м = разобратьСообщениеПравки(s);
    if (!этоИгрок(м.от, игрок) || м.статус !== 'unread') return s;
    return собратьСообщение({ ...м, статус: 'read', статусКак: '' });
  });
}

/** Последняя строка игрока — звонок без исхода: { индекс } или null. */
function звонокБезИсхода(ms, игрок) {
  for (let i = (ms || []).length - 1; i >= 0; i--) {
    const м = разобратьСообщениеПравки(ms[i]);
    if (!этоИгрок(м.от, игрок)) return null;
    if (м.вид === 'call') return /\[CALL:\s*incoming\]/i.test(ms[i]) ? { индекс: i } : null;
  }
  return null;
}

/* --- Настоящие снимки игрока ------------------------------------------------------ */

const ТЕГ_ФОТО = /\[(?:PHOTO|ФОТО|IMG|СНИМОК)\s*:?\s*([^\]]*)\]/i;
const ФАЙЛ_В_ОПИСАНИИ = /\s*\(file:\s*(hud-photo-[A-Za-z0-9_-]+\.(?:jpe?g|png|webp|gif))\s*\)\s*$/i;
/** Имя для файла снимка: только латиница, цифры и «-» (так велит Таверна). */
export function имяФайлаСнимка(расширение = 'jpg', сейчас = Date.now()) {
  const р = String(расширение || 'jpg').toLowerCase().replace(/[^a-z]/g, '') || 'jpg';
  return `hud-photo-${сейчас.toString(36)}-${Math.random().toString(36).slice(2, 8)}.${р === 'jpeg' ? 'jpg' : р}`;
}
/** Хвост строк игрока: номера строк подряд с конца. */
function хвостИгрока(ms, игрок) {
  const out = [];
  for (let i = (ms || []).length - 1; i >= 0 && этоИгрок(сторонаСтроки(ms[i]).от, игрок); i--) out.unshift(i);
  return out;
}
/** Файлы настоящих снимков в непрочитанных строках игрока в конце чата: [{ индекс, файл, описание }]. */
export function новыеСнимки(ms, игрок) {
  return хвостИгрока(ms, игрок).filter(i => /\|\s*unread\s*$/i.test(ms[i])).map(i => {
    const т = String(ms[i]).match(ТЕГ_ФОТО);
    const ф = т && т[1].match(ФАЙЛ_В_ОПИСАНИИ);
    return ф ? { индекс: i, файл: ф[1], описание: т[1].slice(0, ф.index).trim() } : null;
  }).filter(Boolean);
}
/**
 * Описания от модели — в снимки игрока без описания (по порядку). Ссылка на
 * файл остаётся: следующие ходы знают, что на фото, а экран — где картинка.
 */
export function вписатьОписанияСнимков(ms, игрок, описания) {
  const список = (Array.isArray(описания) ? описания : [описания]).map(x => текст(x).replace(/[[\]|]/g, ' ').replace(/\s+/g, ' ').slice(0, 200)).filter(Boolean);
  if (!список.length) return ms;
  const копия = ms.slice();
  let к = 0;
  for (const с of новыеСнимки(копия, игрок)) {
    if (с.описание) continue;
    if (к >= список.length) break;
    копия[с.индекс] = String(копия[с.индекс]).replace(ТЕГ_ФОТО, (всё) => всё.replace(/\(file:/i, список[к] + ' (file:'));
    к++;
  }
  return копия;
}

/* --- Где лежит переписка в HUD ------------------------------------------------- */

/**
 * Найти переписку в HUD (в кодах). место: { где: 'cm'|'phx'|'tp', ключ (cm/phx),
 * цель и чат (tp) }. → { список ms, запись } или null.
 */
export function найтиПереписку(hud, место) {
  if (!объект(hud) || !место) return null;
  if (место.где === 'tp') {
    const список = Array.isArray(hud.tp) ? hud.tp : [];
    const цель = текст(место.цель), чат = текст(место.чат);
    // Строго: «Ян» и «Яна» — разные переписки, строки не должны уйти в чужую.
    const тот = (a, b) => !!a && !!b && тотЖеСтрого(a, b);
    const запись = список.find(п => объект(п) && тот(текст(п.tg), цель) && (!чат || тот(текст(п.cn), чат)))
      || список.find(п => объект(п) && тот(текст(п.tg), цель) && перехватИгрока(п, место.игрок));
    return запись ? { запись, ms: Array.isArray(запись.ms) ? запись.ms : [] } : null;
  }
  const телефон = место.где === 'phx' ? (объект(hud.phx) ? hud.phx : null) : hud;
  const cm = телефон && объект(телефон.cm) ? телефон.cm : null;
  if (!cm) return null;
  const ключ = текст(место.ключ);
  const имя = Object.keys(cm).find(к => к === ключ) || Object.keys(cm).find(к => к.toLowerCase() === ключ.toLowerCase())
    || Object.keys(cm).find(к => ключ && тотЖеСтрого(к, ключ));
  return имя && объект(cm[имя]) ? { запись: cm[имя], ms: Array.isArray(cm[имя].ms) ? cm[имя].ms : [], ключ: имя } : null;
}

/**
 * Дописать строки в переписку HUD (в кодах; меняет hud). Нет такой — заводит:
 * в cm — ключ места с владельцем, в tp — запись { tg, cn }. прежние — строки,
 * которые карточка показывала из прошлых ходов (их в этом HUD нет):
 * встают перед новыми, чтобы чат в HUD был целым. → итоговый список ms.
 */
export function дописатьВПереписку(hud, место, строки, { прежние = [], владелец = '', прочитано = null, игрок = '' } = {}) {
  let найдено = найтиПереписку(hud, место);
  if (!найдено) {
    if (место.где === 'tp') {
      if (!Array.isArray(hud.tp)) hud.tp = [];
      const запись = { tg: текст(место.цель), cn: текст(место.чат) || текст(игрок), ms: [] };
      if (текст(место.pp)) запись.pp = текст(место.pp);
      hud.tp.push(запись);
      найдено = { запись, ms: запись.ms };
    } else {
      let телефон = hud;
      if (место.где === 'phx') { if (!объект(hud.phx)) hud.phx = { ow: владелец }; телефон = hud.phx; }
      if (!объект(телефон.cm)) телефон.cm = {};
      const запись = { ow: текст(владелец), ms: [] };
      if (текст(место.pp)) запись.pp = текст(место.pp);
      телефон.cm[текст(место.ключ) || текст(игрок)] = запись;
      найдено = { запись, ms: запись.ms };
    }
  }
  let ms = Array.isArray(найдено.запись.ms) ? найдено.запись.ms.slice() : [];
  if (!ms.length && Array.isArray(прежние) && прежние.length) ms = прежние.map(String);
  if (прочитано === true && игрок) ms = прочитатьСтрокиИгрока(ms, игрок);
  ms.push(...строки.map(String));
  найдено.запись.ms = ms;
  return ms;
}

/** Убрать строку игрока (сообщение удалено до прочтения): помечается Deleted, текст скрыт, но хранится. */
export function удалитьСтрокуИгрока(ms, индекс, игрок) {
  const s = ms[индекс];
  const м = разобратьСообщениеПравки(s);
  if (!этоИгрок(м.от, игрок)) return false;
  ms[индекс] = собратьСообщение({ ...м, статус: 'deleted', статусКак: '' });
  return true;
}

/* --- Запрос ответа --------------------------------------------------------------- */

/**
 * Промпт ответа на сообщения игрока — один текст для роли user.
 * к: { игрок, кто (кто отвечает: владелец телефона или собеседник), состав (участники
 * группы, кроме игрока), чат (название), ms (вся переписка), новых (сколько строк
 * в конце — свежие от игрока), время, дата, язык, карточка, персона, лор, снимок, история }.
 */
/** Что модель знает о сюжете: карточка, персона, лорбуки, HUD, последние сообщения. */
function разделыКонтекста(к, кто, роль) {
  const разделы = [];
  if (текст(к.карточка)) разделы.push(`## ${кто}\n${текст(к.карточка)}`);
  if (текст(к.персона)) разделы.push(`## ${текст(к.игрок)} (${роль})\n${текст(к.персона)}`);
  if (текст(к.лор)) разделы.push(текст(к.лор));
  if (текст(к.снимок)) разделы.push(`## Current state of the story (HUD)\n${текст(к.снимок)}`);
  if (текст(к.история)) разделы.push(`## Latest story messages\n${текст(к.история)}`);
  return разделы;
}

export function промптОтвета(к) {
  const кто = текст(к.кто) || '{{char}}';
  const группа = Array.isArray(к.состав) && к.состав.length > 1;
  const отвечают = группа ? `the people in this group chat (${к.состав.join(', ')}) — whoever would plausibly answer, each in their own voice; maybe only one, maybe none` : кто;
  const ms = Array.isArray(к.ms) ? к.ms : [];
  const старые = ms.slice(0, Math.max(0, ms.length - (к.новых || 0)));
  const свежие = ms.slice(Math.max(0, ms.length - (к.новых || 0)));
  const звонок = !!звонокБезИсхода(ms, к.игрок);
  // Настоящие снимки: приложены картинками (видно) или модель их не видит.
  const снимков = Math.max(0, Number(к.снимков) || 0);
  const видноСнимки = снимков > 0 && к.видноСнимки !== false;
  const разделы = разделыКонтекста(к, кто, 'the one texting');
  const пример = `${группа ? (к.состав[0] || кто) : кто} -> ${текст(к.игрок)}: [message] | ${текст(к.время) || 'HH:MM'} | Unread`;
  // Как игрок записан в этом телефоне («Смирнова»): строки под этим именем — тоже его.
  const записан = (Array.isArray(к.имена) ? к.имена : []).map(текст).filter(n => n && n.toLowerCase() !== текст(к.игрок).toLowerCase());
  const какЗаписан = записан.length ? ` (saved in this phone as «${записан.join('», «')}» — lines from that name are ${текст(к.игрок)}'s)` : '';
  return `<hud_instructions>
## 🎯 TASK
${текст(к.игрок)} has no phone of their own in this story view; the chat below is shown on the phone of ${к.где === 'tp' ? кто : кто + ' (its owner)'}. ${текст(к.игрок)} just wrote the last message(s) of the chat «${текст(к.чат)}». Write the reply from ${отвечают} — as phone messages, nothing else.${какЗаписан ? `\n${текст(к.игрок)}${какЗаписан}.` : ''}

## 📐 RULES
- Stay in character: how ${группа ? 'each of them' : кто} really texts — length, tone, slang, punctuation, emoji or none, typos if that is them. Use what they know now: the story, the HUD, their mood, where they are and what they are doing at ${текст(к.время) || 'this moment'}.
- A real person may not answer at once or at all: busy, asleep, angry, in the middle of a scene, phone away. Then return no messages; say whether they saw it ("read": true — left on read; false — not seen yet).
- One to four short messages is usual; one long one is fine if that is them. Voice, photo, video, reply, forward or a call back are allowed with the same tags the HUD uses: [VOICE_M:SS] transcript, [PHOTO: what is in the shot] caption, [VIDEO_M:SS: what happens] caption, [REPLY: Who :: quoted words], [FWD: from whom], [CALL: outgoing, answered|declined|missed, M:SS].
- NEVER write a message from ${текст(к.игрок)}${записан.length ? ` or «${записан.join('», «')}»` : ''}: their words are theirs alone.
- Times: not earlier than ${текст(к.время) || 'the last message'}, today — clock only (HH:MM).${звонок ? `
- The last thing ${текст(к.игрок)} did was CALL. Decide what happened to the call in "call": "answered, M:SS — one short line of what was said" | "declined" | "missed". A declined or missed call may be followed by a text.` : ''}
- 🌍 Write the messages in ${текст(к.язык) || 'the language of the chat'}.${видноСнимки ? `
- 📷 The ${снимков === 1 ? 'attached image is the photo' : `${снимков} attached images are the photos`} ${текст(к.игрок)} just sent (the [PHOTO: …] line${снимков === 1 ? '' : 's'} of «New from ${текст(к.игрок)}», in order). Look at ${снимков === 1 ? 'it' : 'them'} and react to what is really there — a meme, a selfie, a place. A description written by ${текст(к.игрок)} inside the tag is how they present it (e.g. who is in it). In "pd" give for each photo, in order, a short neutral description of what it shows (under 15 words, in ${текст(к.язык) || 'the language of the chat'}) — it is stored in the phone.` : снимков > 0 ? `
- 📷 ${текст(к.игрок)} sent real photo${снимков === 1 ? '' : 's'}, but you cannot see images: rely on the description in the tag; if there is none, react as someone who has not opened it yet or ask what it is.` : ''}

## 🧾 OUTPUT
Only this JSON, no prose, no code fence:
{"read": true, "ms": ["${пример.replace(/"/g, '\\"')}"]${звонок ? ', "call": "answered, 1:20 — …"' : ''}${видноСнимки ? ', "pd": ["…"]' : ''}}
"ms" may be [] when nobody answers. Line format: "[Sender] -> [Recipient]: [text] | [time] | Unread".
</hud_instructions>

${разделы.join('\n\n')}

## Chat «${текст(к.чат)}»${старые.length ? '\n' + старые.join('\n') : '\n(no earlier messages)'}

## New from ${текст(к.игрок)}
${свежие.join('\n')}`;
}

const безОграды = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').replace(/\[\/?HUD\]/gi, '').trim();

/** Первый JSON-объект в тексте (скобки внутри строк не считаются). */
function первыйОбъект(s) {
  for (let от = s.indexOf('{'); от > -1; от = s.indexOf('{', от + 1)) {
    let г = 0, вСтроке = false;
    for (let i = от; i < s.length; i++) {
      const c = s[i];
      if (вСтроке) { if (c === '\\') i++; else if (c === '"') вСтроке = false; continue; }
      if (c === '"') вСтроке = true;
      else if (c === '{') г++;
      else if (c === '}' && !--г) {
        const кусок = s.slice(от, i + 1);
        for (const в of [кусок, кусок.replace(/,\s*([}\]])/g, '$1')]) {
          try { const о = JSON.parse(в); if (объект(о)) return о; } catch (_) { /* дальше */ }
        }
        break;
      }
    }
  }
  return null;
}

/**
 * Ответ модели → { строки, прочитано, звонок }. Строки от имени игрока
 * выбрасываются: модель не пишет за него. Без JSON — строки вида «Кто -> Кому: …».
 */
export function разобратьОтвет(ответ, { игрок, отвечают = [] }) {
  // Личный чат: отвечает один собеседник — строки третьих людей модель сюда не вписывает.
  const один = Array.isArray(отвечают) && отвечают.filter(Boolean).length === 1 ? String(отвечают.find(Boolean)) : '';
  const s = безОграды(ответ);
  const о = первыйОбъект(s);
  let сырые = [];
  if (о) {
    const список = о.ms ?? о.messages ?? о.add ?? о.reply;
    сырые = Array.isArray(список) ? список : typeof список === 'string' ? [список] : [];
  } else {
    сырые = s.split('\n').map(l => l.trim().replace(/^[-*•]\s*/, '').replace(/^"|",?$/g, '')).filter(l => /^[^:[\]|]{1,60}?(?:\s*(?:->|→)\s*[^:[\]|]{1,60}?)?\s*:\s*\S/.test(l));
  }
  const строки = сырые.map(x => текст(typeof x === 'string' ? x : (x && (x.text || x.line)) || ''))
    .filter(Boolean)
    .filter(l => { const { от } = сторонаСтроки(l); return от && !ПУСТО.test(от) && !этоИгрок(от, игрок); })
    .filter(l => !один || тотЖеСтрого(сторонаСтроки(l).от, один) || namesLikelySame(сторонаСтроки(l).от, один))
    .slice(0, 12);
  const прочитано = о && typeof о.read === 'boolean' ? о.read : (о && typeof о.rd === 'boolean' ? о.rd : строки.length > 0);
  const звонок = о && (typeof о.call === 'string' || объект(о.call)) ? (объект(о.call) ? [о.call.outcome, о.call.dur, о.call.note].filter(Boolean).join(', ') : о.call) : '';
  const pd = о ? (о.pd ?? о.photos ?? о.photo) : null;
  const описанияСнимков = (Array.isArray(pd) ? pd : typeof pd === 'string' ? [pd] : []).map(x => текст(typeof x === 'string' ? x : (x && (x.desc || x.text)) || '')).filter(Boolean).slice(0, 8);
  return { строки, прочитано: строки.length > 0 || прочитано, звонок: текст(звонок), описанияСнимков };
}

/** Исход звонка игрока в его строку: «answered, 1:20 — договорились» → [CALL: incoming, answered, 1:20] договорились. */
export function применитьЗвонок(ms, игрок, звонок) {
  const з = звонокБезИсхода(ms, игрок);
  if (!з || !текст(звонок)) return ms;
  const тело = текст(звонок).toLowerCase();
  const исход = /declin|reject|отклон|сброс/.test(тело) ? 'declined' : /miss|пропущ|no answer/.test(тело) ? 'missed' : 'answered';
  const длит = исход === 'answered' ? ((тело.match(/\b(\d{1,2}:\d{2})\b/) || [])[1] || '') : '';
  const заметка = исход === 'answered' ? текст(String(звонок).split(/\s[—–-]\s|:\s(?!\d)/).slice(1).join(' — ')) : '';
  const м = разобратьСообщениеПравки(ms[з.индекс]);
  const новая = собратьСообщение({ ...м, вид: 'call', звонок: { куда: 'in', исход, длит }, текст: заметка, статус: '', статусКак: '' });
  const копия = ms.slice();
  копия[з.индекс] = новая;
  return копия;
}

/* --- Заметка для следующего ответа ----------------------------------------------- */

/* --- Живой звонок -------------------------------------------------------------- */
//
// Игрок звонит владельцу телефона (или тому, с кем переписывается в
// перехватах). Сначала модель решает, возьмут ли трубку; дальше игрок
// говорит репликами, персонаж отвечает голосом. В HUD — одна строка звонка:
// исход, длительность, итог одной фразой и ссылка «(call: hud-call-…)» на
// расшифровку; сама расшифровка — в message.extra того свайпа (свёрнута).

/** Номер звонка: только латиница, цифры и «-». */
export function номерЗвонка(сейчас = Date.now()) {
  return `hud-call-${сейчас.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
const ССЫЛКА_ЗВОНКА = /\s*\(call:\s*(hud-call-[A-Za-z0-9-]+)\)\s*$/i;
/** Заметка звонка → { итог без ссылки, номер или '' }. */
export function ссылкаЗвонка(заметка) {
  const s = String(заметка || '');
  const м = s.match(ССЫЛКА_ЗВОНКА);
  return м ? { итог: s.slice(0, м.index).trim(), номер: м[1] } : { итог: s.trim(), номер: '' };
}
/** Длительность из секунд: «3:07», «1:02:30». */
export function длительностьЗвонка(секунд) {
  const с = Math.max(0, Math.round(Number(секунд) || 0));
  const ч = Math.floor(с / 3600), м = Math.floor((с % 3600) / 60), сек = с % 60;
  return ч ? `${ч}:${String(м).padStart(2, '0')}:${String(сек).padStart(2, '0')}` : `${м}:${String(сек).padStart(2, '0')}`;
}
/**
 * Строка звонка игрока в формате модели. исход: answered | declined | missed.
 * Звонок игрока владельцу телефона на этом телефоне — входящий.
 */
export function строкаЗвонка({ игрок, кому, время = '', исход = 'missed', длит = '', итог = '', номер = '' }) {
  const заметка = [текст(итог), номер ? `(call: ${номер})` : ''].filter(Boolean).join(' ');
  return собратьСообщение({
    от: игрок, кому: кому || '', текст: заметка, время, статус: '', статусКак: '', вид: 'call',
    голос: { длит: '' }, фото: { что: '' }, видео: { длит: '', что: '' },
    звонок: { куда: 'in', исход: ['answered', 'declined', 'missed'].includes(исход) ? исход : 'missed', длит: исход === 'answered' ? длит : '' },
    опрос: { вопрос: '', варианты: [] }, ответ: null, переслано: null, кем: null, прочее: [],
  });
}

/**
 * Промпт звонка. к.этап: 'pickup' — звонок только идёт, решить, возьмут ли;
 * 'talk' — разговор идёт, ответить на реплику игрока. к.реплики — расшифровка
 * [{ кто: 'me' | 'them', текст }]. Остальное — как у промптОтвета.
 */
export function промптЗвонка(к) {
  const кто = текст(к.кто) || '{{char}}';
  const игрок = текст(к.игрок);
  const язык = текст(к.язык) || 'the language of the chat';
  const ms = Array.isArray(к.ms) ? к.ms.slice(-12) : [];
  // Долгий звонок: модели — последние 40 реплик, иначе запрос растёт с каждой фразой.
  const всеРеплики = Array.isArray(к.реплики) ? к.реплики : [];
  const разговор = всеРеплики.slice(-40).map(р => `${р.кто === 'me' ? игрок : кто}: ${текст(р.текст)}`);
  if (всеРеплики.length > 40) разговор.unshift('(the start of the call is left out)');
  const разделы = разделыКонтекста(к, кто, 'the one calling');
  const тема = текст(к.тема);
  const сообщенияВместо = `"ms": ["only when declined or missed: text messages ${кто} sends instead, '${кто} -> ${игрок}: [text] | HH:MM | Unread' — or []"]`;
  const задача = к.этап === 'pickup'
    ? `${игрок} is CALLING ${кто} on the phone right now (${текст(к.время) || 'now'}). Decide what ${кто} does — answer, decline or let it ring out — from who they are, their mood, where they are and what they are doing. If they answer, write what ${кто} says first on picking up.`
    : к.этап === 'quick'
      ? `${игрок} is CALLING ${кто} on the phone right now (${текст(к.время) || 'now'}). Decide what ${кто} does — answer, decline or let it ring out — from who they are, their mood, where they are and what they are doing. If they answer, write the whole short call as a transcript.${тема ? `\nWhat ${игрок} wants to say on this call (their intent — put it into their own spoken words, add nothing else they did not mean): ${тема}` : `\n${игрок} did not say what the call is about: keep their lines short and plain (greeting, why they called in a few words, goodbye) — no decisions or confessions for them.`}`
      : `${игрок} and ${кто} are on a phone CALL. ${игрок} just said the last line. Write what ${кто} says back — spoken words, as they really talk on the phone.`;
  const вывод = к.этап === 'pickup'
    ? `{"call": "answered" | "declined" | "missed", "say": ["what ${кто} says on picking up — only when answered"], "sum": "one short line: what the call is about so far", ${сообщенияВместо}}`
    : к.этап === 'quick'
      ? `{"call": "answered" | "declined" | "missed", "dur": "M:SS — only when answered", "lines": ["${кто}: …", "${игрок}: …", "… 4 to 8 spoken lines in order, each starting with who speaks — only when answered"], "sum": "one short line: what the call was about — only when answered", ${сообщенияВместо}}`
      : `{"say": ["one to three short spoken lines from ${кто}"], "end": false, "sum": "one short line: what the whole call is about so far"}`;
  const заИгрока = к.этап === 'quick'
    ? `- ${игрок} says only what their intent above covers, in their own voice; ${кто}'s lines are yours. ${кто} speaks first on picking up.`
    : `- NEVER speak for ${игрок}: their words are theirs alone.`;
  return `<hud_instructions>
## 🎯 TASK
${задача}

## 📐 RULES
- Stay in character: how ${кто} really speaks — tone, pauses, interruptions, slang, emotion in the voice. Spoken words only: no actions, no narration, no quotes around lines. Short phone lines, not speeches.
${заИгрока}${к.этап === 'talk' ? `
- ${кто} may end the call (hang up, say goodbye, get interrupted): then "end": true.` : ''}
- "sum" is stored in the phone as the call's one-line summary — neutral, in ${язык}.
- 🌍 Write in ${язык}.

## 🧾 OUTPUT
Only this JSON, no prose, no code fence:
${вывод}
</hud_instructions>

${разделы.join('\n\n')}

## Recent texts between them${ms.length ? '\n' + ms.join('\n') : '\n(none)'}${разговор.length ? `

## The call so far
${разговор.join('\n')}` : ''}`;
}

/** Ответ модели на звонок → { исход, реплики, итог, конец, сообщения }. Строки за игрока выбрасываются. */
export function разобратьЗвонок(ответ, { игрок, кто = '' }) {
  const s = безОграды(ответ);
  const о = первыйОбъект(s) || {};
  const словоИсхода = текст(о.call || о.outcome).toLowerCase();
  const исход = /declin|reject|отклон|сброс/.test(словоИсхода) ? 'declined' : /miss|пропущ|no answer/.test(словоИсхода) ? 'missed' : /answer|принят|взял/.test(словоИсхода) ? 'answered' : '';
  const сырые = о.say ?? о.lines ?? о.reply;
  const реплики = (Array.isArray(сырые) ? сырые : typeof сырые === 'string' ? [сырые] : (!первыйОбъект(s) && s ? [s] : []))
    .map(x => текст(typeof x === 'string' ? x : (x && (x.text || x.line)) || ''))
    // Модель подписала реплику: «Олег: …» — подпись снимаем; за игрока — выбрасываем.
    .map(x => { const м = x.match(/^([^:]{1,40}):\s*([\s\S]+)$/); if (!м) return x; if (этоИгрок(м[1], игрок)) return ''; return кто && (этоИгрок(м[1], кто) || namesLikelySame(м[1], кто)) ? м[2].trim() : x; })
    .map(x => x.replace(/^["«“]|["»”]$/g, '').trim())
    .filter(Boolean).slice(0, 6);
  const сообщения = разобратьОтвет(JSON.stringify({ read: true, ms: Array.isArray(о.ms) ? о.ms : [] }), { игрок, отвечают: кто ? [кто] : [] }).строки;
  return { исход, реплики, итог: текст(о.sum || о.summary).replace(/[[\]|]/g, ' ').replace(/\s+/g, ' ').slice(0, 200), конец: о.end === true, сообщения };
}

/**
 * Звонок с темой: модель пишет весь короткий разговор сразу →
 * { исход, длит, расшифровка: [{ кто: 'me' | 'them', текст }], итог, сообщения }.
 * Реплики без подписи и с чужой подписью отбрасываются — непонятно, чьи они.
 */
export function разобратьЗвонокСТемой(ответ, { игрок, кто = '' }) {
  const s = безОграды(ответ);
  const о = первыйОбъект(s) || {};
  const основа = разобратьЗвонок(JSON.stringify({ call: о.call || о.outcome || '', sum: о.sum || о.summary || '', ms: о.ms || [] }), { игрок, кто });
  const сырые = Array.isArray(о.lines) ? о.lines : Array.isArray(о.say) ? о.say : Array.isArray(о.transcript) ? о.transcript : [];
  const расшифровка = [];
  for (const x of сырые) {
    let имя = '', слова = '';
    if (x && typeof x === 'object') { имя = текст(x.who || x.speaker || x.name); слова = текст(x.text || x.line || x.say); }
    else { const м = текст(x).match(/^([^:]{1,40}):\s*([\s\S]+)$/); if (м) { имя = м[1].trim(); слова = м[2].trim(); } }
    слова = слова.replace(/^["«“]|["»”]$/g, '').trim();
    if (!имя || !слова) continue;
    const чей = этоИгрок(имя, игрок) ? 'me' : кто && (этоИгрок(имя, кто) || namesLikelySame(имя, кто)) ? 'them' : '';
    if (чей) расшифровка.push({ кто: чей, текст: слова });
  }
  const м = текст(о.dur || о.duration).match(/(?:(\d+):)?(\d{1,2}):(\d{2})/);
  let длит = м ? (м[1] ? `${+м[1]}:${м[2].padStart(2, '0')}:${м[3]}` : `${+м[2]}:${м[3]}`) : '';
  // Взяли трубку, но длительности нет — прикинем по словам (~2.5 слова в секунду, не меньше 0:20).
  if (!длит && расшифровка.length) длит = длительностьЗвонка(Math.max(20, расшифровка.reduce((n, р) => n + р.текст.split(/\s+/).length, 0) / 2.5 + расшифровка.length * 2));
  const исход = основа.исход || (расшифровка.length ? 'answered' : '');
  return { исход, длит: исход === 'answered' ? длит : '', расшифровка: исход === 'answered' ? расшифровка.slice(0, 16) : [], итог: исход === 'answered' ? основа.итог : '', сообщения: исход === 'answered' ? [] : основа.сообщения };
}

/** Расшифровку звонка — в extra этого свайпа (как переписку). */
export function запомнитьЗвонок(message, номер, данные) {
  if (!message || !номер || !объект(данные)) return;
  if (!объект(message.extra)) message.extra = {};
  const все = объект(message.extra.hud_calls) ? message.extra.hud_calls : {};
  все[номер] = { ...данные, реплики: (данные.реплики || []).slice(-200) };
  message.extra.hud_calls = все;
  const свайп = Array.isArray(message.swipe_info) && Number.isInteger(message.swipe_id) ? message.swipe_info[message.swipe_id] : null;
  if (объект(свайп)) {
    if (!объект(свайп.extra)) свайп.extra = {};
    свайп.extra.hud_calls = все;
  }
}
/** Найти расшифровку по номеру во всём чате (строка звонка могла переехать в следующие ходы). */
export function найтиЗвонок(чат, номер) {
  if (!Array.isArray(чат) || !номер) return null;
  for (let i = чат.length - 1; i >= 0; i--) {
    const м = чат[i];
    if (!м) continue;
    const из = [м.extra, ...(Array.isArray(м.swipe_info) ? м.swipe_info.map(x => x && x.extra) : [])];
    for (const e of из) if (объект(e) && объект(e.hud_calls) && e.hud_calls[номер]) return e.hud_calls[номер];
  }
  return null;
}

const ЗАПИСЕЙ_ПЕРЕПИСКИ = 80;

/** Записать, что в этом свайпе игрок переписывался (message.extra своё у свайпа). */
export function запомнитьПереписку(message, { чат, где, строки, прочитано = false, игрок = '', звонок = '', описанияСнимков = [], разговор = null }) {
  if (!message || !Array.isArray(строки) || (!строки.length && !прочитано && !звонок)) return;
  if (!объект(message.extra)) message.extra = {};
  const было = Array.isArray(message.extra.hud_user_chat) ? message.extra.hud_user_chat : [];
  const запись = было.find(з => з && з.чат === чат && з.где === где);
  // Прочитал и ответил — и в записи для следующего ответа строки игрока уже прочитаны.
  if (запись && игрок && описанияСнимков.length) запись.строки = вписатьОписанияСнимков(запись.строки || [], игрок, описанияСнимков);
  if (запись && прочитано && игрок) запись.строки = прочитатьСтрокиИгрока(запись.строки || [], игрок);
  if (запись && звонок && игрок) запись.строки = применитьЗвонок(запись.строки || [], игрок, звонок);
  if (!строки.length && !запись) return;
  if (запись) запись.строки = [...(запись.строки || []), ...строки].slice(-ЗАПИСЕЙ_ПЕРЕПИСКИ);
  else было.push({ чат, где, строки: строки.slice(-ЗАПИСЕЙ_ПЕРЕПИСКИ) });
  // Живой звонок: расшифровка коротко — следующему ответу (в HUD её нет).
  if (разговор && Array.isArray(разговор.реплики) && разговор.реплики.length) {
    const з = было.find(x => x && x.чат === чат && x.где === где);
    if (з) з.разговоры = [...(з.разговоры || []), { итог: текст(разговор.итог), реплики: разговор.реплики.slice(-16).map(р => `${р.кто === 'me' ? игрок : текст(разговор.с) || '?'}: ${текст(р.текст)}`) }].slice(-4);
  }
  message.extra.hud_user_chat = было.slice(-12);
  const свайп = Array.isArray(message.swipe_info) && Number.isInteger(message.swipe_id) ? message.swipe_info[message.swipe_id] : null;
  if (объект(свайп)) {
    if (!объект(свайп.extra)) свайп.extra = {};
    свайп.extra.hud_user_chat = message.extra.hud_user_chat;
  }
}

/** Переписка игрока, записанная в этом свайпе: [{ чат, где, строки }]. */
export function перепискаСвайпа(message) {
  const з = message && объект(message.extra) && Array.isArray(message.extra.hud_user_chat) ? message.extra.hud_user_chat : [];
  return з.filter(x => x && Array.isArray(x.строки) && x.строки.length);
}

/**
 * Перегенерация HUD этого же сообщения (regen.js: весь HUD или только телефон)
 * пишет блок заново, а модель старого блока не видит — переписка этого свайпа
 * пропала бы. Возвращаем в новый HUD (в кодах; меняется на месте) строки из
 * записи свайпа, которых там нет. Сверка — по тексту без статуса: модель могла
 * поменять «Unread» на «Read». → сколько строк вернули.
 */
export function вернутьПереписку(hud, записи, игрок) {
  if (!объект(hud) || !Array.isArray(записи) || !записи.length) return 0;
  const тело = (s) => String(s || '').split('|')[0].replace(/\s+/g, ' ').trim().toLowerCase();
  let вернули = 0;
  for (const з of записи) {
    if (!з || !Array.isArray(з.строки) || !з.строки.length) continue;
    const место = з.где === 'tp' ? { где: 'tp', цель: з.чат, чат: '', игрок } : { где: з.где === 'phx' ? 'phx' : 'cm', ключ: з.чат, игрок };
    const есть = найтиПереписку(hud, место);
    const уже = new Set(((есть && есть.ms) || []).map(тело));
    const нет = з.строки.filter(s => !уже.has(тело(s)));
    if (!нет.length) continue;
    const телефон = место.где === 'phx' ? hud.phx : hud;
    const владелец = объект(телефон) && объект(телефон.phn) ? текст(телефон.phn.ow) : '';
    дописатьВПереписку(hud, место, нет, { владелец, игрок });
    вернули += нет.length;
  }
  return вернули;
}

/** Строка для промпта следующего ответа: игрок писал между ходами. '' — не писал. */
export function заметкаДляОтвета(записи, { игрок = '{{user}}', персонаж = '{{char}}' } = {}) {
  if (!Array.isArray(записи) || !записи.length) return '';
  const куски = записи.map(з => `«${текст(з.чат)}»:\n${з.строки.slice(-24).join('\n')}`
    + (Array.isArray(з.разговоры) ? з.разговоры.map(р => `\nPhone call${р.итог ? ' — ' + р.итог : ''} (spoken, shortened):\n${р.реплики.join('\n')}`).join('') : ''));
  const звонили = записи.some(з => Array.isArray(з.разговоры) && з.разговоры.length || з.строки.some(x => /\[CALL:/i.test(x)));
  return `📱 BETWEEN TURNS ${игрок} TEXTED${звонили ? ' and CALLED' : ''} by phone — this already happened, the people in these chats have read what is marked Read, and it is already in the phone in the last HUD:\n${куски.join('\n\n')}\nLet it shape this reply where it matters (what ${персонаж} and the others know, feel or do next); never retell the texts${звонили ? ' or the calls' : ''} and never repeat them as new messages.`;
}

/* --- Черновики ----------------------------------------------------------------- */

// Недописанное сообщение переживает перерисовку карточки: ключ — чат и его хозяин.
const черновики = new Map();
export const ключЧерновика = (где, чат) => `${где}\u0000${текст(чат).toLowerCase()}`;
export function черновикИгрока(ключ) { return черновики.get(ключ) || ''; }
export function запомнитьЧерновик(ключ, s) { if (текст(s)) черновики.set(ключ, String(s)); else черновики.delete(ключ); }
