// hud-manager/render/holiday-day.js
//
// Окно праздника: нажатие на праздник в листе дня календаря (телефон, святцы
// альманаха — у всех эпох один календарь, render/calendar.js). Модель
// придумывает, как этот праздник празднуют в мире истории, — суть и три
// детали: обычай, место и событие. Что с ними делать, решает игрок.
//
// Контекст — на выбор: лорбуки, персона, карточка, последние сообщения; без
// них — по названию и описанию праздника. Детали хранятся в чате
// (render/holiday-lore.js), их можно передать модели разовой подсказкой, а в
// сам день праздника они уходят модели с заметками хода (turn-notes.js).
//
// Запрос — через профиль подключения окна «Праздники мира» или модель чата;
// HUD-инструкция в него не вшивается.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.61';
import { settings } from '../settings.js?v=23.89.61';
import { т } from '../i18n.js?v=23.89.61';
import { текстБезHUD } from '../hud-block.js?v=23.89.61';
import { карточкаПерсонажа, персонаИгрока, parseAssistantAnswer } from './assistant.js?v=23.89.61';
import { связьПраздников, деталиПраздника, сохранитьДеталиПраздника, деталиСтрокой, забытьДеталиПраздника, ключПраздника } from './holiday-lore.js?v=23.89.61';
import { отправить, эпохаПраздников, своиЛорбуки, ЖДЁМ_МС, ЛОР_СИМВОЛОВ, языкПраздников, рядПрофиля, подключитьПрофили } from './holiday-gen.js?v=23.89.61';
import { добавитьПодсказку, подсказки } from '../turn-notes.js?v=23.89.61';

const СООБЩЕНИЙ_ПО_УМОЛЧАНИЮ = 6;
const СИМВОЛОВ_СООБЩЕНИЯ = 1500;
const СИМВОЛОВ_ИСТОРИИ = 12000;

function контекст() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; } }
function сохранитьНастройки() { try { связьПраздников().сохранить?.(); } catch (_) { /* не критично */ } }
const источник = (ключ) => settings[ключ] !== false;
const ИСТОЧНИКИ = ['holidayUseLore', 'holidayUsePersona', 'holidayUseCard', 'holidayUseChat'];
const сколькоСообщений = () => { const n = parseInt(settings.holidayChatCount, 10); return Number.isFinite(n) && n > 0 ? Math.min(30, n) : СООБЩЕНИЙ_ПО_УМОЛЧАНИЮ; };

/** Последние сообщения истории: «Имя: текст» без блоков HUD. */
export function историяДляПраздника(чат, сколько = СООБЩЕНИЙ_ПО_УМОЛЧАНИЮ) {
  const строки = (Array.isArray(чат) ? чат : []).filter(m => m && !m.is_system && typeof m.mes === 'string')
    .slice(-сколько).map(m => {
      const текст = текстБезHUD(m.mes).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return текст ? `${String(m.name || (m.is_user ? 'User' : 'Character')).trim()}: ${текст.slice(0, СИМВОЛОВ_СООБЩЕНИЯ)}` : '';
    }).filter(Boolean);
  let s = строки.join('\n\n');
  if (s.length > СИМВОЛОВ_ИСТОРИИ) s = s.slice(s.length - СИМВОЛОВ_ИСТОРИИ);
  return s;
}

/** Промпт: суть и три детали праздника одним JSON. */
export function промптКакПразднуют({ имя = '', дата = '', о = '', карточка = '', персона = '', лор = '', история = '', сцена = '', эпоха = '', язык = 'Russian', было = null } = {}) {
  const блоки = [];
  if (карточка) блоки.push(`<character_card>\n${карточка}\n</character_card>`);
  if (персона) блоки.push(`<player_persona>\n${персона}\n</player_persona>`);
  if (лор) блоки.push(`<lorebook>\n${лор}\n</lorebook>`);
  if (история) блоки.push(`<recent_story>\n${история}\n</recent_story>`);
  const прошлое = было && (было.обычай || было.место || было.событие) ? `\n- Earlier you suggested: ${деталиСтрокой(было)}. Now give different details.` : '';
  const user = `${блоки.length ? блоки.join('\n\n') + '\n\n' : ''}Holiday: «${имя}»${дата ? ` on ${дата}` : ''}.${о ? ` What is known: ${о}` : ''}${эпоха ? `\nEra: ${эпоха}.` : ''}${сцена ? `\nThe story's date now: ${сцена}.` : ''}

Describe how this holiday is actually marked in this world, so the player can take part in it.
- essence: one or two sentences — what the day means to people here and its mood.
- custom: ONE custom people follow — what they bring, wear, cook, give or do. Concrete, something the player could join (e.g. everyone brings their own lantern).
- place: ONE specific place in this world and what changes there that day (e.g. the bridge is closed to carts in the evening).
- event: ONE public moment with its time — what happens and when, something the player could witness or join (e.g. boats pass under the bridge at midnight).
- ${блоки.length ? 'Use the materials: places, people, beliefs and history of this world, and stay consistent with the story so far.' : 'There are no materials: invent from the name and description alone, fitting the era.'}
- Offer things to do, not outcomes: never decide what the player's character does, says or feels.${прошлое}
- Write the values in ${язык}. One or two short sentences each.

Answer with JSON only, no other text:
{"essence": "…", "custom": "…", "place": "…", "event": "…"}`;
  const system = 'You are a worldbuilder for an ongoing roleplay story. You invent concrete, playable details that fit the world, and return structured data only.';
  return { system, user };
}

/** Ответ модели → { суть, обычай, место, событие } или null (нужно хотя бы две детали). */
export function разобратьКакПразднуют(ответ) {
  let s = String(ответ ?? '').replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, ' ');
  const код = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (код) s = код[1];
  const начало = s.indexOf('{');
  if (начало < 0) return null;
  s = s.slice(начало);
  // Строгий JSON — от первой «{» до каждой следующей «}»: после объекта модель
  // бывает пишет текст со своими скобками.
  let д = null;
  for (let i = s.indexOf('}'); i > 0 && !д; i = s.indexOf('}', i + 1)) {
    try { const о = JSON.parse(s.slice(0, i + 1).replace(/,\s*([\]}])/g, '$1')); if (о && typeof о === 'object' && !Array.isArray(о)) д = о; } catch (_) { /* дальше */ }
  }
  // Не JSON (перевод строки или кавычки внутри значения, обрезанный конец) —
  // значения по ключам: до кавычки, за которой следующий ключ или «}».
  if (!д) {
    д = {};
    const пара = /"([\p{L}_]+)"\s*:\s*"([\s\S]*?)(?:"\s*(?=,\s*"[\p{L}_]+"\s*:|\s*\})|$)/gu;
    for (const м of s.matchAll(пара)) д[м[1]] = м[2].replace(/\\n/g, ' ').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  const малые = Object.fromEntries(Object.entries(д).map(([к, з]) => [к.trim().toLowerCase(), з]));
  const поле = (...ключи) => { for (const к of ключи) if (typeof малые[к] === 'string' && малые[к].trim()) return малые[к].replace(/\s+/g, ' ').trim().slice(0, 400); return ''; };
  const итог = { суть: поле('essence', 'about', 'суть'), обычай: поле('custom', 'tradition', 'обычай'), место: поле('place', 'location', 'место'), событие: поле('event', 'action', 'событие', 'действие') };
  return [итог.обычай, итог.место, итог.событие].filter(Boolean).length >= 2 ? итог : null;
}

// Текст ответа: JSON в обычном ответе или, если модель ответила в рассуждениях, оттуда.
function текстОтвета(raw) {
  const s = parseAssistantAnswer(raw);
  if (s.includes('{') || !raw || typeof raw !== 'object') return s;
  return String(raw.reasoning || raw.reasoning_content || raw.choices?.[0]?.message?.reasoning_content || s);
}

const ИКОНКИ = {
  суть: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6Z"/><path d="M18.5 14.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/></svg>',
  обычай: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6M12 4v2"/><path d="M8 6h8l1 3v8a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V9Z"/><path d="M12 11c1.2 1.3 1.6 2.4 0 3.8-1.6-1.4-1.2-2.5 0-3.8Z"/></svg>',
  место: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-6-5.3-6-10.2a6 6 0 0 1 12 0c0 4.9-6 10.2-6 10.2Z"/><circle cx="12" cy="10.3" r="2.2"/></svg>',
  событие: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>',
};
const ПОДПИСИ = { суть: 'Суть', обычай: 'Обычай', место: 'Место', событие: 'Событие' };

let открыто = false;

/**
 * Открыть окно праздника. имя — как в календаре; модели — имя для модели
 * (у праздников эпохи английское); о — короткое описание, если есть; дата —
 * «ДД.ММ»; год — у разового праздника (детали уходят модели только в этот год); сцена — «Дата» сцены; откуда — подпись источника; предпросмотр —
 * окно кастомизации: отсюда модели ничего не уходит.
 */
export async function открытьПраздник(параметры = {}) {
  if (открыто || !параметры.имя) return;
  открыто = true;
  try { await собратьОкно(параметры); }
  catch (e) { открыто = false; document.querySelector('.hud-holday')?.closest('.hud-modal-overlay')?.remove(); throw e; }
}
async function собратьОкно({ имя = '', модели = '', о = '', дата = '', год = null, сцена = '', откуда = '', предпросмотр = false }) {
  const ctx = контекст();
  const с = связьПраздников();
  let книгиВсе = [];
  try { книгиВсе = (await с.списокЛорбуков?.()) || []; } catch (_) { книгиВсе = []; }
  const свои = своиЛорбуки(ctx);
  const выбраны = new Set((Array.isArray(settings.holidayLorebooks) && settings.holidayLorebooks.length ? settings.holidayLorebooks : свои).filter(к => книгиВсе.includes(к) || свои.includes(к)));
  const книги = [...new Set([...свои, ...книгиВсе])];
  const э = (s) => escapeHtml(т(s));
  const сыро = (s) => escapeHtml(String(s ?? ''));

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-holgen hud-holday" role="dialog" aria-modal="true" aria-label="${э('Как празднуют')}">
      <div class="hud-modal-head"><span class="hud-holgen-orb" aria-hidden="true"></span><span class="hud-holgen-title"><b data-i18n-skip>«${сыро(имя)}»</b><small><span data-i18n-skip>${сыро(дата)}</span>${откуда ? ` · ${э(откуда)}` : ''}</small></span><button type="button" class="hud-modal-x" aria-label="${э('Закрыть')}">✕</button></div>
      <div class="hud-modal-body">
        ${о ? `<p class="hud-holday-about" data-i18n-skip>${сыро(о)}</p>` : ''}
        <div class="hud-holday-cards" aria-live="polite"></div>
        <p class="hud-holday-lead">${э('Модель придумает суть праздника и три детали — обычай, место и событие. Что с ними делать — решаете вы.')}</p>
        <div class="hud-holgen-sec"><span class="hud-holgen-lbl">${э('Откуда брать контекст')}</span>
          <div class="hud-holgen-src" role="group" aria-label="${э('Откуда брать контекст')}">
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseLore" aria-pressed="${источник('holidayUseLore')}">📚 ${э('Лорбук')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUsePersona" aria-pressed="${источник('holidayUsePersona')}">👤 ${э('Персона')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseCard" aria-pressed="${источник('holidayUseCard')}">🎭 ${э('Карточка')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseChat" aria-pressed="${источник('holidayUseChat')}">💬 ${э('Сообщения')}</button>
          </div>
          <label class="hud-holday-chat"${источник('holidayUseChat') ? '' : ' hidden'}><span>${э('Последних сообщений')}</span><input type="number" class="hud-holday-count" min="1" max="30" value="${сколькоСообщений()}"></label>
          <div class="hud-holgen-books"${источник('holidayUseLore') ? '' : ' hidden'}>${книги.length
            ? книги.map(к => `<label class="hud-holgen-book"><input type="checkbox" value="${сыро(к)}"${выбраны.has(к) ? ' checked' : ''}><span data-i18n-skip>${сыро(к)}</span>${свои.includes(к) ? `<small>${э('этого чата')}</small>` : ''}</label>`).join('')
            : `<p class="hud-holgen-note">${э('Лорбуков нет — возьмутся остальные источники.')}</p>`}</div>
          <p class="hud-holgen-note hud-holday-nosrc"${ИСТОЧНИКИ.some(источник) ? ' hidden' : ''}>${э('Без источников модель придумает по названию и описанию праздника.')}</p>
        </div>
        <label class="hud-holgen-field"><span class="hud-holgen-lbl">${э('Профиль подключения')}</span>
          ${рядПрофиля()}</label>
        <div class="hud-holgen-actions">
          <button type="button" class="hud-holgen-run hud-holday-run"></button>
          <button type="button" class="hud-holday-tell" hidden title="${э('Суть и детали уйдут модели в следующем ответе. В сам день праздника они уходят и так.')}">💬 ${э('Рассказать модели')}</button>
          <span class="hud-holgen-status" aria-live="polite"></span>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const окно = overlay.querySelector('.hud-holday');
  const карточки = окно.querySelector('.hud-holday-cards');
  const кнопка = окно.querySelector('.hud-holday-run');
  const рассказать = окно.querySelector('.hud-holday-tell');
  const статус = окно.querySelector('.hud-holgen-status');
  let отмена = null;

  const показать = () => {
    const д = деталиПраздника(имя, дата);
    карточки.innerHTML = д ? ['суть', 'обычай', 'место', 'событие'].filter(к => д[к]).map(к =>
      `<div class="hud-holday-card is-${к === 'суть' ? 'essence' : к === 'обычай' ? 'custom' : к === 'место' ? 'place' : 'event'}${(к === 'обычай' || к === 'место') && !(д.обычай && д.место) ? ' is-wide' : ''}"><i class="hud-holday-ico">${ИКОНКИ[к]}</i><span><b>${э(ПОДПИСИ[к])}</b><span data-i18n-skip>${сыро(д[к])}</span></span></div>`).join('') : '';
    кнопка.textContent = д ? '↻ ' + т('Придумать заново') : '✨ ' + т('Придумать, как празднуют');
    рассказать.hidden = !д;
    окно.querySelector('.hud-holday-lead').hidden = !!д;
  };
  показать();

  let отписаться = () => {};
  const закрыть = () => { if (отмена) отмена.abort(); overlay.remove(); открыто = false; document.removeEventListener('keydown', поEsc, true); отписаться(); };
  const поEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поEsc, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  окно.querySelector('.hud-modal-x').addEventListener('click', закрыть);

  окно.addEventListener('click', (e) => {
    const t = e.target.closest('.hud-holgen-toggle');
    if (!t) return;
    const вкл = t.getAttribute('aria-pressed') !== 'true';
    t.setAttribute('aria-pressed', String(вкл));
    settings[t.dataset.src] = вкл; сохранитьНастройки();
    if (t.dataset.src === 'holidayUseLore') окно.querySelector('.hud-holgen-books').hidden = !вкл;
    if (t.dataset.src === 'holidayUseChat') окно.querySelector('.hud-holday-chat').hidden = !вкл;
    окно.querySelector('.hud-holday-nosrc').hidden = ИСТОЧНИКИ.some(источник);
  });
  окно.querySelector('.hud-holgen-books')?.addEventListener('change', () => {
    settings.holidayLorebooks = [...окно.querySelectorAll('.hud-holgen-book input:checked')].map(и => и.value); сохранитьНастройки();
  });
  окно.querySelector('.hud-holday-count').addEventListener('change', (e) => { const n = parseInt(e.target.value, 10); settings.holidayChatCount = n > 0 ? Math.min(30, n) : СООБЩЕНИЙ_ПО_УМОЛЧАНИЮ; e.target.value = сколькоСообщений(); сохранитьНастройки(); });
  отписаться = подключитьПрофили(окно, статус, сохранитьНастройки);

  рассказать.addEventListener('click', () => {
    if (предпросмотр) { статус.textContent = т('Это предпросмотр: отсюда модели ничего не отправляется.'); return; }
    const строка = деталиСтрокой(деталиПраздника(имя, дата));
    if (!строка) return;
    const текст = `«${модели || имя}» — ${строка}`;
    if (подсказки().some(п => п.вид === 'holidayDetails' && п.текст === текст.slice(0, 1200))) { статус.textContent = т('Модель узнает в следующем ответе.'); return; }
    // Ключ — праздник: «Придумать заново» и убранный праздник снимают эту подсказку.
    const ок = добавитьПодсказку('holidayDetails', текст, ключПраздника(имя, дата));
    статус.textContent = ок ? т('Модель узнает в следующем ответе.') : т('Очередь подсказок полна (до трёх на ответ) — попробуйте после следующего ответа.');
    if (ок) try { document.dispatchEvent(new CustomEvent('hud:hints')); } catch (_) { /* полоса обновится со следующим ответом */ }
  });

  кнопка.addEventListener('click', async () => {
    if (отмена) { отмена.abort(); return; }
    if (предпросмотр) { статус.textContent = т('Это предпросмотр: отсюда модели ничего не отправляется.'); return; }
    const ctx2 = контекст();
    if (!ctx2) { статус.textContent = т('Таверна ещё не готова'); return; }
    отмена = new AbortController();
    const { signal } = отмена;
    кнопка.textContent = т('Остановить');
    окно.classList.add('is-busy');
    let безHud = false;
    // «Придумать заново»: прежние детали забываются сразу — ни заметка в сам
    // день, ни подсказка в очереди со старым текстом модели уже не уйдут.
    // Модели в запрос они идут только как «было — придумай другое».
    const было = деталиПраздника(имя, дата);
    if (было) { забытьДеталиПраздника(имя, дата); показать(); }
    let готово = false;
    try {
      статус.textContent = т('Собираю контекст…');
      const карта = источник('holidayUseCard') ? карточкаПерсонажа(ctx2) : null;
      const персона = источник('holidayUsePersona') ? персонаИгрока(ctx2) : '';
      const история = источник('holidayUseChat') ? историяДляПраздника(ctx2.chat, сколькоСообщений()) : '';
      let лор = '';
      if (источник('holidayUseLore')) {
        const имена = [...окно.querySelectorAll('.hud-holgen-book input:checked')].map(и => и.value);
        const записи = имена.length && с.лорбуки ? await с.лорбуки(имена, '', true) : [];
        signal.throwIfAborted();
        лор = записи.map(к => `## ${к.name}\n${к.entries.join('\n\n')}`).join('\n\n').slice(0, ЛОР_СИМВОЛОВ);
      }
      const { system, user } = промптКакПразднуют({
        имя: модели || имя, дата, о, карточка: карта ? `${карта.name}\n${карта.text}` : '', персона, лор, история, сцена, эпоха: эпохаПраздников(),
        язык: языкПраздников(), было,
      });
      статус.textContent = т('Модель думает…');
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      let таймер = 0;
      const raw = await Promise.race([
        отправить(ctx2, system, user, signal),
        new Promise((_, reject) => { таймер = setTimeout(() => { reject(new Error(т('модель молчит слишком долго'))); отмена?.abort(); }, ЖДЁМ_МС); }),
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
      ]).finally(() => clearTimeout(таймер));
      signal.throwIfAborted();
      const детали = разобратьКакПразднуют(текстОтвета(raw));
      if (!детали) throw new Error(т('в ответе модели не нашлось деталей в нужном виде — попробуйте ещё раз или другой профиль'));
      сохранитьДеталиПраздника(имя, дата, { ...детали, год });
      готово = true;
      статус.textContent = '';
      try { связьПраздников().перерисовать?.(); } catch (_) { /* карточки обновятся со следующим ходом */ }
    } catch (e) {
      статус.textContent = e && e.name === 'AbortError' ? т('Отменено') : т('Не получилось') + ': ' + (e && e.message ? e.message : e);
      if (!(e && e.name === 'AbortError')) console.warn('[TavernOS HUD] Как празднуют:', e);
    } finally {
      // Ошибка или «Остановить» — прежние детали остаются: окно не теряет то,
      // что уже было. В очередь подсказок они сами не возвращаются.
      if (!готово && было && !деталиПраздника(имя, дата)) сохранитьДеталиПраздника(имя, дата, было);
      if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
      отмена = null;
      окно.classList.remove('is-busy');
      показать();
    }
  });
}
