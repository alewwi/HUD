// hud-manager/render/holiday-gen.js
//
// Окно «Праздники мира» (кнопка в календаре телефона): модель находит или
// придумывает праздники по выбранному контексту — лорбукам, персоне игрока,
// карточке персонажа. Для известного фандома — канон и придуманное «под
// канон» с отсылками; для своей вселенной — по её материалам. Ответ — JSON-
// список; игрок видит даты и названия, убирает лишнее крестиком и добавляет
// остальное в календарь (render/holiday-lore.js хранит и напоминает).
//
// Запрос — через выбранный профиль подключения или модель чата, как у
// помощника «Спросить про сюжет»; HUD-инструкция в него не вшивается.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml, генерацияТаверны, длинаОтветаТаверны } from '../utils.js?v=23.90.2';
import { settings } from '../settings.js?v=23.90.2';
import { старина, заклинанияВМире, дарыВМире, магияСкрыта, магияВМире, технологии } from '../era.js?v=23.90.2';
import { карточкаПерсонажа, персонаИгрока, parseAssistantAnswer } from './assistant.js?v=23.90.2';
import { связьПраздников, разобратьПраздники, нормализоватьПраздник, праздникиМира, добавитьПраздникиМира, убратьПраздникМира, скрытыеПраздникиЭпохи, скрытьПраздникЭпохи } from './holiday-lore.js?v=23.90.2';
import { праздникиГода } from './holidays.js?v=23.90.2';
import { т, английский, языкЗначенийМодели } from '../i18n.js?v=23.90.2';

export const ЖДЁМ_МС = 180000;
export const ЛОР_СИМВОЛОВ = 40000;

function контекст() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; } }
function сохранитьНастройки() { try { связьПраздников().сохранить?.(); } catch (_) { /* не критично */ } }

// Лорбуки по умолчанию: книга карточки и книга чата.
export function своиЛорбуки(ctx) {
  const out = [];
  try {
    const c = ctx && ctx.characters && ctx.characters[ctx.characterId];
    const книга = c && (c.data?.extensions?.world || c.extensions?.world);
    if (книга) out.push(String(книга));
    const чат = (ctx.chatMetadata || ctx.chat_metadata || {}).world_info;
    if (чат) out.push(String(чат));
  } catch (_) { /* нет */ }
  return [...new Set(out)];
}

/** Промпт: что и в каком виде вернуть. */
// Мир для модели одной короткой строкой — во всех отдельных запросах (праздники,
// ярмарки, «Как празднуют», подготовка, правила места): «Era: …. Technology: ….
// Magic: ….» — из настроек эпохи (era.js). Магия — в мире, а не облик: скрытая
// магия тоже меняет праздники и порядки.
const ТЕХ_КРАТКО = {
  auto: 'as the character card and lorebook say', primitive: 'primitive — stone, bronze, fire', preindustrial: 'pre-industrial — crafts, iron, horses, sail; no engines',
  industrial: 'industrial — steam, railways, telegraph', modern: 'modern — cars, phones, internet', future: 'beyond today — advanced AI, space travel',
};
export function эпохаПраздников() {
  const магия = !магияВМире() ? 'none'
    : (заклинанияВМире() ? 'spells and enchanted things' : дарыВМире() ? 'innate elemental gifts and spirits, no spells or magic tools' : 'present') + (магияСкрыта() ? ', hidden from ordinary society' : ', known to all');
  return `Era: ${старина() ? 'medieval' : 'modern'}. Technology: ${ТЕХ_КРАТКО[технологии()] || ТЕХ_КРАТКО.auto}. Magic: ${магия}.`;
}
/** Язык ответа модели — как у значений HUD в настройках расширения: русский, английский или язык таблицы перевода. */
export const языкПраздников = () => языкЗначенийМодели() || (английский() ? 'English' : 'Russian');

export function промптПраздников({ карточка = '', персона = '', лор = '', дата = '', сколько = 0, эпоха = '', язык = 'Russian', пожелание = '' } = {}) {
  const блоки = [];
  // Пожелание игрока («праздники, связанные с семьёй», «памятные даты») — в
  // своём теге: модель следует ему, но не принимает его за материалы мира.
  const желание = String(пожелание || '').trim().slice(0, 300);
  if (желание) блоки.push(`<player_wish>\n${желание}\n</player_wish>`);
  if (карточка) блоки.push(`<character_card>\n${карточка}\n</character_card>`);
  if (персона) блоки.push(`<player_persona>\n${персона}\n</player_persona>`);
  if (лор) блоки.push(`<lorebook>\n${лор}\n</lorebook>`);
  const user = `${блоки.join('\n\n')}

Make a list of holidays, festivals and notable dates that the people of this story's world mark.
- If these materials come from a known fandom or setting, use its canon holidays first. Where canon gives none or too few, invent new ones that would fit the canon, with nods to its lore — places, history, beliefs, famous people and events — so they feel like they could be canon.
- If the world is original, rely only on these materials and invent holidays that grow out of them.${!карточка && !персона && !лор ? '\n- There are no materials about the world: invent holidays that fit its era, technology and magic below.' : ''}
- Mix big public holidays with smaller local or personal ones when the world suggests them.${желание ? '\n- The player asked for this list: see <player_wish>. Choose and invent holidays that match the wish first, as far as the world allows; the wish never overrides the canon or the world\'s facts.' : ''}${дата ? `\n- The story's date now: ${дата}.` : ''}${эпоха ? `\n- ${эпоха}` : ''}
- Give each date on the story's calendar as day and month, "DD.MM". If the world has its own months, map each holiday to a fitting day and month. A one-time event (not repeated every year) gets "DD.MM.YYYY" and "yearly": false.
- Write names and descriptions in ${язык}, whatever language the materials are in. A canon holiday keeps the name it is known by in ${язык}.
- ${сколько > 0 ? `Exactly ${сколько} ${сколько === 1 ? 'holiday' : 'holidays'}.` : 'As many as the materials support — usually 5 to 12.'}

Answer with JSON only, no other text:
[{"date": "DD.MM", "name": "holiday name", "about": "one short sentence: what is celebrated and how", "yearly": true}]`;
  const system = 'You are a careful lore researcher for an ongoing roleplay story. You read the given materials and return structured data only.';
  return { system, user };
}

/** Промпт ярмарок (средневековье): тот же ответ, что у праздников, — список с датами. */
export function промптЯрмарок({ карточка = '', персона = '', лор = '', дата = '', сколько = 0, эпоха = '', язык = 'Russian', пожелание = '' } = {}) {
  const блоки = [];
  const желание = String(пожелание || '').trim().slice(0, 300);
  if (желание) блоки.push(`<player_wish>\n${желание}\n</player_wish>`);
  if (карточка) блоки.push(`<character_card>\n${карточка}\n</character_card>`);
  if (персона) блоки.push(`<player_persona>\n${персона}\n</player_persona>`);
  if (лор) блоки.push(`<lorebook>\n${лор}\n</lorebook>`);
  const user = `${блоки.length ? блоки.join('\n\n') + '\n\n' : ''}Make a list of fairs and market gatherings held in this story's world — big seasonal fairs, horse and cattle fairs, feast-day fairs, river or crossroads markets.
- ${блоки.length ? 'Use the materials: places, trades, roads and customs of this world. A canon fair from a known setting comes first.' : 'There are no materials about the world: invent fairs that fit its era, technology and magic below.'}
- A fair is a window of opportunity: for each, say who comes (rare craftsmen, buyers, storytellers, carters, hirers) and what one can do there that is hard on other days.${желание ? '\n- The player asked for something: see <player_wish>. Follow it as far as the world allows.' : ''}${дата ? `\n- The story's date now: ${дата}.` : ''}${эпоха ? `\n- ${эпоха}` : ''}
- Give each date as day and month, "DD.MM" — the first day of the fair. A one-time fair gets "DD.MM.YYYY" and "yearly": false.
- Write names and descriptions in ${язык}.
- ${сколько > 0 ? `Exactly ${сколько} ${сколько === 1 ? 'fair' : 'fairs'}.` : 'Usually 3 to 8.'}

Answer with JSON only, no other text:
[{"date": "DD.MM", "name": "fair name", "about": "one short sentence: who comes and what one can do there", "yearly": true}]`;
  const system = 'You are a worldbuilder for an ongoing roleplay story. You invent concrete, playable details that fit the world, and return structured data only.';
  return { system, user };
}

/**
 * Выпадающий список профилей — заново из Connection Manager: профиль могли
 * создать, переименовать или удалить, пока окно открыто. Удалённый выбранный
 * профиль сбрасывается на модель чата. true — так и случилось.
 */
export function заполнитьПрофили(select) {
  if (!select) return false;
  const профили = (() => { try { return связьПраздников().профили?.() || []; } catch (_) { return []; } })();
  const выбран = String(settings.holidayProfileId || '');
  const пропал = !!выбран && !профили.some(p => String(p.id) === выбран);
  select.innerHTML = `<option value="">${escapeHtml(т('модель чата'))}</option>` + профили.map(p => `<option value="${escapeHtml(String(p.id))}">${escapeHtml(p.name || p.id)}</option>`).join('');
  select.value = пропал ? '' : выбран;
  if (пропал) { settings.holidayProfileId = ''; try { связьПраздников().сохранить?.(); } catch (_) { /* не критично */ } }
  return пропал;
}
/** Профили меняются в Таверне — список в окне следом. Возвращает «отписаться». */
export function следитьЗаПрофилями(select, сказать = () => {}) {
  const ctx = контекст();
  const es = ctx && ctx.eventSource, et = ctx && (ctx.eventTypes || ctx.event_types);
  const типы = ['CONNECTION_PROFILE_CREATED', 'CONNECTION_PROFILE_UPDATED', 'CONNECTION_PROFILE_DELETED'].map(к => et && et[к]).filter(Boolean);
  const обновить = () => { if (select.isConnected && заполнитьПрофили(select)) сказать(т('Выбранного профиля больше нет — запрос пойдёт через модель чата.')); };
  if (es && typeof es.on === 'function') типы.forEach(тип => es.on(тип, обновить));
  return () => { if (es) типы.forEach(тип => { try { (es.removeListener || es.off).call(es, тип, обновить); } catch (_) { /* уже снят */ } }); };
}
/** Ряд «профиль + ↻» для окна. */
export const рядПрофиля = () => `<span class="hud-holgen-profile-row"><select class="hud-holgen-profile"></select><button type="button" class="hud-holgen-refresh" title="${escapeHtml(т('Обновить список профилей'))}" aria-label="${escapeHtml(т('Обновить список профилей'))}">↻</button></span>`;
/** Подключить ряд профиля в окне: заполнить, ↻, выбор, события Таверны. Возвращает «отписаться». */
export function подключитьПрофили(окно, статус, сохранитьНастройки) {
  const select = окно.querySelector('.hud-holgen-profile');
  const сказать = (s) => { if (статус) статус.textContent = s; };
  if (заполнитьПрофили(select)) сказать(т('Выбранного профиля больше нет — запрос пойдёт через модель чата.'));
  select.addEventListener('change', () => { settings.holidayProfileId = select.value || ''; сохранитьНастройки(); });
  окно.querySelector('.hud-holgen-refresh')?.addEventListener('click', () => {
    сказать(заполнитьПрофили(select) ? т('Выбранного профиля больше нет — запрос пойдёт через модель чата.') : т('Список профилей обновлён.'));
  });
  return следитьЗаПрофилями(select, сказать);
}

// Лимит ответа — у каждого окна свой (праздники и ярмарки, «Как празднуют»,
// подготовка, правила места): думающим моделям 3000 бывает мало, а короткому
// ответу хватает и меньше. 0 или пусто — длина ответа из настроек Таверны.
export const ТОКЕНОВ_УМОЛЧ = 3000, ТОКЕНОВ_МИН = 256, ТОКЕНОВ_МАКС = 65536;
/** Число из поля или настройки: 0 и пусто — «как в Таверне» (0), иначе от 256 до максимума. */
export function числоТокенов(v, макс = ТОКЕНОВ_МАКС) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.max(ТОКЕНОВ_МИН, Math.min(макс, n)) : 0;
}
/** Лимит окна из настроек: ни разу не задан — умолчание окна. */
export function лимитТокенов(ключ, умолч = ТОКЕНОВ_УМОЛЧ) {
  return settings[ключ] === undefined || settings[ключ] === null ? умолч : числоТокенов(settings[ключ]);
}
/** Подпись под полем лимита: что значит 0 и сколько можно вписать. */
export const подписьМаксимума = (макс) => т('0 — как в Таверне · максимум') + ' ' + макс;
/** Поле «Токенов на ответ» для окна; значение — в settings[ключ]. */
export const полеТокенов = (ключ, умолч = ТОКЕНОВ_УМОЛЧ) => `<label class="hud-holgen-field hud-holgen-tokens-field"><span class="hud-holgen-lbl">${escapeHtml(т('Токенов на ответ'))}</span>`
  + `<input type="number" class="hud-holgen-tokens" data-key="${escapeHtml(ключ)}" min="0" max="${ТОКЕНОВ_МАКС}" step="256" inputmode="numeric" value="${лимитТокенов(ключ, умолч)}"`
  + ` title="${escapeHtml(т('Сколько токенов модель может потратить на ответ. Думающим моделям нужен запас: рассуждения тоже в счёт. 0 — длина ответа из настроек Таверны.'))}">`
  + `<small class="hud-holgen-tokens-max">${escapeHtml(подписьМаксимума(ТОКЕНОВ_МАКС))}</small></label>`;
/** Взять лимит из поля окна (его могли поправить и сразу нажать «Сгенерировать») и запомнить. */
export function токеныОкна(окно, ключ, сохранить = сохранитьНастройки, умолч = ТОКЕНОВ_УМОЛЧ) {
  const поле = окно && окно.querySelector(`.hud-holgen-tokens[data-key="${ключ}"]`);
  if (!поле) return лимитТокенов(ключ, умолч);
  const лимит = числоТокенов(поле.value);
  поле.value = String(лимит);
  if (settings[ключ] !== лимит) { settings[ключ] = лимит; сохранить(); }
  return лимит;
}
/** Поле токенов: правка сразу пишется в настройки, числом в пределах. */
export function подключитьТокены(окно, ключ, сохранить = сохранитьНастройки, умолч = ТОКЕНОВ_УМОЛЧ) {
  окно?.querySelector(`.hud-holgen-tokens[data-key="${ключ}"]`)?.addEventListener('change', () => токеныОкна(окно, ключ, сохранить, умолч));
}

// Последний ответ: пустой или оборванный (скобки JSON не закрыты) — почти
// всегда не хватило токенов, особенно думающей модели. Окна дописывают это в
// ошибку (причинаОшибки), иначе игрок видит «No message generated» или «не
// нашлось в нужном виде» и не знает, что поднять.
let последний = null;
export function обрезанJSON(текст) {
  const s = String(текст || '');
  const начало = s.search(/[[{]/);
  if (начало < 0) return false;
  let глубина = 0, вСтроке = false, экран = false;
  for (let i = начало; i < s.length; i++) {
    const ч = s[i];
    if (вСтроке) { if (экран) экран = false; else if (ч === '\\') экран = true; else if (ч === '"') вСтроке = false; continue; }
    if (ч === '"') вСтроке = true;
    else if (ч === '[' || ч === '{') глубина++;
    else if ((ч === ']' || ч === '}') && глубина > 0) глубина--;
  }
  return глубина > 0;
}
export function причинаОшибки(e) {
  const текст = e && e.message ? e.message : String(e ?? '');
  if (!последний) return текст;
  const { лимит, фактически } = последний;
  const сколько = фактически ? ` (${фактически}${лимит ? '' : ' — ' + т('как в Таверне')}). ` : '. ';
  const совет = лимит ? т('Рассуждения тоже в счёт: поднимите «Токенов на ответ».') : т('Рассуждения тоже в счёт: задайте «Токенов на ответ» или поднимите длину ответа в Таверне.');
  if (последний.пусто || /No message generated/i.test(текст)) return т('модель ничего не вернула — похоже, не хватило токенов') + сколько + совет;
  if (последний.обрыв) return текст + ' — ' + т('ответ оборвался на лимите токенов') + сколько + (лимит ? т('Поднимите «Токенов на ответ».') : т('Задайте «Токенов на ответ» или поднимите длину ответа в Таверне.'));
  return текст;
}

/** Запрос окна. токены: 0 — длина ответа из настроек Таверны. */
export async function отправить(ctx, system, user, signal, токены = ТОКЕНОВ_УМОЛЧ) {
  const лимит = числоТокенов(токены);
  const отметка = { лимит, фактически: лимит || длинаОтветаТаверны(ctx), пусто: false, обрыв: false };
  последний = отметка;
  return Promise.resolve(запрос(ctx, system, user, signal, лимит)).then((raw) => {
    const t = String(текстОтвета(raw) || '');
    отметка.пусто = !t.trim();
    отметка.обрыв = обрезанJSON(t);
    return raw;
  }, (e) => {
    if (/No message generated/i.test(e && e.message || '')) отметка.пусто = true;
    throw e;
  });
}
function запрос(ctx, system, user, signal, лимит) {
  const профиль = String(settings.holidayProfileId || '');
  const служба = ctx.ConnectionManagerRequestService;
  const профили = (() => { try { return связьПраздников().профили?.() || []; } catch (_) { return []; } })();
  if (профиль && служба && typeof служба.sendRequest === 'function') {
    if (!профили.some(p => String(p.id) === профиль)) throw new Error(т('выбранный профиль подключения не найден — нажмите ↻ или выберите другой'));
    return служба.sendRequest(профиль, [{ role: 'system', content: system }, { role: 'user', content: user }], лимит || длинаОтветаТаверны(ctx) || ТОКЕНОВ_УМОЛЧ,
      { stream: false, extractData: true, includePreset: false, includeInstruct: true, signal });
  }
  return генерацияТаверны(ctx, { prompt: user, systemPrompt: system, responseLength: лимит || null, signal });
}
// Текст ответа: обычный или рассуждения, если модель ответила в них (GLM, DeepSeek).
export function текстОтвета(raw) {
  const s = parseAssistantAnswer(raw);
  if (s.includes('[') || !raw || typeof raw !== 'object') return s;
  return String(raw.reasoning || raw.reasoning_content || raw.choices?.[0]?.message?.reasoning_content || s);
}

let открыто = false;

/** Открыть окно. дата — «Дата» сцены из календаря (для промпта). */
export async function открытьГенераторПраздников({ дата = '', год = null } = {}) {
  if (открыто) return;
  открыто = true;
  const ctx = контекст();
  const с = связьПраздников();
  let книгиВсе = [];
  try { книгиВсе = (await с.списокЛорбуков?.()) || []; } catch (_) { книгиВсе = []; }
  const свои = своиЛорбуки(ctx);
  const выбраны = new Set((Array.isArray(settings.holidayLorebooks) && settings.holidayLorebooks.length ? settings.holidayLorebooks : свои).filter(к => книгиВсе.includes(к) || свои.includes(к)));
  const книги = [...new Set([...свои, ...книгиВсе])];
  const источник = (ключ, умолч = true) => settings[ключ] !== undefined ? settings[ключ] !== false : умолч;
  const подпись = (строка) => escapeHtml(т(строка));

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-holgen" role="dialog" aria-modal="true" aria-label="Праздники мира">
      <div class="hud-modal-head"><span class="hud-holgen-orb" aria-hidden="true"></span><span class="hud-holgen-title">Праздники мира<small>модель найдёт канон или придумает своё — вы выберете, что взять</small></span><button type="button" class="hud-modal-x" aria-label="Закрыть">✕</button></div>
      <div class="hud-modal-body">
        ${старина() && settings.enableFairs !== false ? `<div class="hud-holgen-sec"><span class="hud-holgen-lbl">${подпись('Что искать')}</span><div class="hud-holgen-src hud-holgen-mode" role="group"><button type="button" class="hud-holgen-toggle" data-mode="holidays" aria-pressed="true">🎉 ${подпись('Праздники')}</button><button type="button" class="hud-holgen-toggle" data-mode="fairs" aria-pressed="false">🎪 ${подпись('Ярмарки')}</button></div></div>` : ''}
        <div class="hud-holgen-sec"><span class="hud-holgen-lbl">Откуда брать контекст <small>${подпись('необязательно')}</small></span>
          <div class="hud-holgen-src" role="group" aria-label="Откуда брать контекст">
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseLore" aria-pressed="${источник('holidayUseLore')}">📚 Лорбук</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUsePersona" aria-pressed="${источник('holidayUsePersona')}">👤 Персона</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseCard" aria-pressed="${источник('holidayUseCard')}">🎭 Карточка</button>
          </div>
          <div class="hud-holgen-books"${источник('holidayUseLore') ? '' : ' hidden'}>${книги.length
            ? книги.map(к => `<label class="hud-holgen-book"><input type="checkbox" value="${escapeHtml(к)}"${выбраны.has(к) ? ' checked' : ''}><span>${escapeHtml(к)}</span>${свои.includes(к) ? '<small>этого чата</small>' : ''}</label>`).join('')
            : '<p class="hud-holgen-note">Лорбуков нет — возьмутся только персона и карточка.</p>'}</div>
        </div>
        <div class="hud-holgen-row is-3">
          <label class="hud-holgen-field"><span class="hud-holgen-lbl">Профиль подключения</span>
            ${рядПрофиля()}</label>
          ${полеТокенов('holidayGenMaxTokens')}
          <label class="hud-holgen-field"><span class="hud-holgen-lbl">Сколько праздников</span>
            <input type="number" class="hud-holgen-count" min="1" max="30" placeholder="сколько найдёт" value="${parseInt(settings.holidayCount, 10) > 0 ? parseInt(settings.holidayCount, 10) : ''}"></label>
        </div>
        <label class="hud-holgen-field hud-holgen-wish-field"><span class="hud-holgen-lbl">${подпись('Пожелание')}</span>
          <textarea class="hud-holgen-wish" rows="2" maxlength="300" placeholder="${подпись('Например: праздники, связанные с семьёй, или памятные даты')}" title="${подпись('Модель учтёт это, когда будет искать и придумывать праздники')}">${escapeHtml(String(settings.holidayWish || ''))}</textarea></label>
        <div class="hud-holgen-actions"><button type="button" class="hud-holgen-run">✨ Сгенерировать</button><span class="hud-holgen-status" aria-live="polite"></span></div>
        <div class="hud-holgen-result" hidden></div>
        <div class="hud-holgen-have"></div>
        <details class="hud-holgen-manual">
          <summary class="hud-holgen-lbl">${подпись('Добавить свой праздник')}</summary>
          <form class="hud-holgen-manual-form">
            <div class="hud-holgen-row">
              <label class="hud-holgen-field"><span class="hud-holgen-lbl">${подпись('Дата')}</span><input name="date" type="text" required maxlength="10" placeholder="21.06" aria-describedby="hud-holgen-date-hint"></label>
              <label class="hud-holgen-field"><span class="hud-holgen-lbl">${подпись('Название')}</span><input name="name" type="text" required maxlength="80" placeholder="${подпись('Ночь фонарей')}"></label>
            </div>
            <p id="hud-holgen-date-hint" class="hud-holgen-note">${подпись('21.06 — каждый год, 21.06.104 — один раз в 104 году.')}</p>
            <label class="hud-holgen-field"><span class="hud-holgen-lbl">${подпись('Короткое описание')}</span><textarea name="about" rows="2" maxlength="220" placeholder="${подпись('В самый длинный день года жители пускают фонари по реке в память об основателях города.')}"></textarea></label>
            <div class="hud-holgen-actions"><button type="submit" class="hud-holgen-manual-save">${подпись('Добавить в календарь')}</button><span class="hud-holgen-manual-status" aria-live="polite"></span></div>
          </form>
        </details>
        ${settings.enableEraHolidays !== false ? `<details><summary class="hud-holgen-lbl">${escapeHtml(т('Встроенные праздники эпохи'))}</summary><ul class="hud-holgen-list is-have hud-holgen-era"></ul></details>` : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const окно = overlay.querySelector('.hud-holgen');
  const статус = окно.querySelector('.hud-holgen-status');
  const итог = окно.querySelector('.hud-holgen-result');
  const есть = окно.querySelector('.hud-holgen-have');
  const встроенные = окно.querySelector('.hud-holgen-era');
  const кнопка = окно.querySelector('.hud-holgen-run');
  let отмена = null, найдено = [], режим = 'holidays';

  const даты = (п) => `<span class="hud-holgen-date"><b>${escapeHtml(п.дата.slice(0, 5))}</b><small>${п.ежегодно ? 'каждый год' : escapeHtml(п.дата.slice(6) || 'один раз')}</small></span>`;
  const показатьЕсть = () => {
    const список = праздникиМира();
    есть.innerHTML = список.length ? `<div class="hud-holgen-lbl">Уже в календаре · ${список.length}</div><ul class="hud-holgen-list is-have">${список.map(п => `<li data-id="${escapeHtml(п.id)}">${даты(п)}<span class="hud-holgen-name"><b>${п.ярмарка ? '🎪 ' : ''}${escapeHtml(п.имя)}</b>${п.о ? `<small>${escapeHtml(п.о)}</small>` : ''}</span><button type="button" class="hud-holgen-del" aria-label="Убрать из календаря" title="Убрать из календаря">✕</button></li>`).join('')}</ul>` : '';
  };
  const показатьВстроенные = () => {
    if (!встроенные) return;
    const скрытые = скрытыеПраздникиЭпохи();
    встроенные.innerHTML = праздникиГода(год || new Date().getFullYear()).map(п => {
      const убран = скрытые.has(п.модели);
      const подпись = escapeHtml(т(убран ? 'Вернуть' : 'Убрать из календаря'));
      return `<li data-id="${escapeHtml(п.модели)}"${убран ? ' class="is-off"' : ''}><span class="hud-holgen-name"><b>${escapeHtml(т(п.имя))}</b></span><button type="button" class="hud-holgen-del hud-holgen-era-toggle" aria-pressed="${убран}" aria-label="${подпись}" title="${подпись}">${убран ? '↺' : '✕'}</button></li>`;
    }).join('');
  };
  const показатьНайдено = () => {
    итог.hidden = !найдено.length;
    if (итог.hidden) {
      итог.innerHTML = '';
      return;
    }
    const берём = найдено.filter(п => !п.убран).length;
    итог.innerHTML = `<div class="hud-holgen-lbl">Нашлось · ${найдено.length} <small>крестик — не брать</small></div>`
      + `<ul class="hud-holgen-list">${найдено.map((п, i) => `<li data-i="${i}"${п.убран ? ' class="is-off"' : ''}>${даты(п)}<span class="hud-holgen-name"><b>${escapeHtml(п.имя)}</b>${п.о ? `<small>${escapeHtml(п.о)}</small>` : ''}</span><button type="button" class="hud-holgen-x" aria-pressed="${!!п.убран}" aria-label="${п.убран ? 'Вернуть' : 'Не брать'}" title="${п.убран ? 'Вернуть' : 'Не брать'}">${п.убран ? '↺' : '✕'}</button></li>`).join('')}</ul>`
      + `<button type="button" class="hud-holgen-add"${берём ? '' : ' disabled'}>Добавить в календарь · ${берём}</button>`;
  };
  показатьЕсть();
  показатьВстроенные();

  let отписаться = () => {};
  const закрыть = () => { if (отмена) отмена.abort(); overlay.remove(); открыто = false; document.removeEventListener('keydown', поEsc, true); отписаться(); };
  const поEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поEsc, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  окно.querySelector('.hud-modal-x').addEventListener('click', закрыть);

  const форма = окно.querySelector('.hud-holgen-manual-form');
  форма.addEventListener('submit', (e) => {
    e.preventDefault();
    const уведомление = форма.querySelector('.hud-holgen-manual-status');
    const праздник = нормализоватьПраздник(Object.fromEntries(new FormData(форма)));
    if (!праздник) { уведомление.textContent = т('Введите название и действительную дату.'); return; }
    if (!добавитьПраздникиМира([праздник])) { уведомление.textContent = т('Всё это уже есть в календаре'); return; }
    форма.reset();
    уведомление.textContent = т('Праздник добавлен в календарь');
    показатьЕсть();
    try { связьПраздников().перерисовать?.(); } catch (_) { /* не критично */ }
  });

  окно.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.mode) {
      режим = t.dataset.mode;
      окно.querySelectorAll('[data-mode]').forEach(б => б.setAttribute('aria-pressed', String(б === t)));
      найдено = []; показатьНайдено(); статус.textContent = '';
      const ярм = режим === 'fairs';
      const подписьСколько = окно.querySelector('.hud-holgen-count')?.closest('label')?.querySelector('.hud-holgen-lbl');
      if (подписьСколько) подписьСколько.textContent = т(ярм ? 'Сколько ярмарок' : 'Сколько праздников');
      const желание = окно.querySelector('.hud-holgen-wish');
      if (желание) желание.placeholder = т(ярм ? 'Например: конская ярмарка у переправы, ярмарка после жатвы' : 'Например: праздники, связанные с семьёй, или памятные даты');
    } else if (t.matches('.hud-holgen-toggle')) {
      const вкл = t.getAttribute('aria-pressed') !== 'true';
      t.setAttribute('aria-pressed', String(вкл));
      settings[t.dataset.src] = вкл; сохранитьНастройки();
      if (t.dataset.src === 'holidayUseLore') окно.querySelector('.hud-holgen-books').hidden = !вкл;
    } else if (t.matches('.hud-holgen-x')) {
      const п = найдено[+t.closest('li').dataset.i];
      п.убран = !п.убран; показатьНайдено();
    } else if (t.matches('.hud-holgen-add')) {
      const n = добавитьПраздникиМира(найдено.filter(п => !п.убран));
      статус.textContent = n ? `Добавлено в календарь: ${n}` : 'Всё это уже есть в календаре';
      найдено = []; показатьНайдено(); показатьЕсть();
      try { связьПраздников().перерисовать?.(); } catch (_) { /* карточки обновятся со следующим ходом */ }
    } else if (t.matches('.hud-holgen-era-toggle')) {
      скрытьПраздникЭпохи(t.closest('li').dataset.id, t.getAttribute('aria-pressed') !== 'true');
      показатьВстроенные();
      try { связьПраздников().перерисовать?.(); } catch (_) { /* не критично */ }
    } else if (t.matches('.hud-holgen-del')) {
      убратьПраздникМира(t.closest('li').dataset.id); показатьЕсть();
      try { связьПраздников().перерисовать?.(); } catch (_) { /* не критично */ }
    }
  });
  окно.querySelector('.hud-holgen-books')?.addEventListener('change', () => {
    settings.holidayLorebooks = [...окно.querySelectorAll('.hud-holgen-book input:checked')].map(и => и.value); сохранитьНастройки();
  });
  отписаться = подключитьПрофили(окно, окно.querySelector('.hud-holgen-status'), сохранитьНастройки);
  подключитьТокены(окно, 'holidayGenMaxTokens');
  окно.querySelector('.hud-holgen-count').addEventListener('change', (e) => { const n = parseInt(e.target.value, 10); settings.holidayCount = n > 0 ? Math.min(30, n) : 0; сохранитьНастройки(); });
  окно.querySelector('.hud-holgen-wish').addEventListener('change', (e) => { settings.holidayWish = String(e.target.value || '').trim().slice(0, 300); сохранитьНастройки(); });

  кнопка.addEventListener('click', async () => {
    if (отмена) { отмена.abort(); return; }
    const ctx2 = контекст();
    if (!ctx2) { статус.textContent = 'Таверна ещё не готова'; return; }
    // Источники необязательны: без них модель придумывает по эпохе и пожеланию.
    const лорВкл = источник('holidayUseLore'), персонаВкл = источник('holidayUsePersona'), картаВкл = источник('holidayUseCard');
    отмена = new AbortController();
    const { signal } = отмена;
    найдено = [];
    показатьНайдено();
    кнопка.textContent = 'Остановить';
    окно.classList.add('is-busy');
    let безHud = false;
    try {
      статус.textContent = 'Собираю контекст…';
      const карта = картаВкл ? карточкаПерсонажа(ctx2) : null;
      const персона = персонаВкл ? персонаИгрока(ctx2) : '';
      let лор = '';
      if (лорВкл) {
        const имена = [...окно.querySelectorAll('.hud-holgen-book input:checked')].map(и => и.value);
        const записи = имена.length && с.лорбуки ? await с.лорбуки(имена, '', true) : [];
        signal.throwIfAborted();
        лор = записи.map(к => `## ${к.name}\n${к.entries.join('\n\n')}`).join('\n\n').slice(0, ЛОР_СИМВОЛОВ);
      }
      const { system, user } = (режим === 'fairs' ? промптЯрмарок : промптПраздников)({
        карточка: карта ? `${карта.name}\n${карта.text}` : '', персона, лор, дата,
        сколько: parseInt(settings.holidayCount, 10) || 0, эпоха: эпохаПраздников(), язык: языкПраздников(),
        // Пожелание берём прямо из поля: «Сгенерировать» могли нажать, не уйдя из него.
        пожелание: String(окно.querySelector('.hud-holgen-wish')?.value || settings.holidayWish || '').trim().slice(0, 300),
      });
      статус.textContent = 'Модель думает…';
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      let таймерОжидания = 0;
      const raw = await Promise.race([
        отправить(ctx2, system, user, signal, токеныОкна(окно, 'holidayGenMaxTokens')),
        new Promise((_, reject) => { таймерОжидания = setTimeout(() => { reject(new Error('модель молчит дольше ' + ЖДЁМ_МС / 1000 + ' с')); отмена?.abort(); }, ЖДЁМ_МС); }),
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
      ]).finally(() => clearTimeout(таймерОжидания));
      signal.throwIfAborted();
      найдено = разобратьПраздники(текстОтвета(raw)).map(п => (режим === 'fairs' ? { ...п, ярмарка: true } : п));
      if (!найдено.length) throw new Error(режим === 'fairs' ? 'в ответе модели не нашлось ярмарок в нужном виде — попробуйте ещё раз или другой профиль' : 'в ответе модели не нашлось праздников в нужном виде — попробуйте ещё раз или другой профиль');
      статус.textContent = '';
      показатьНайдено();
    } catch (e) {
      статус.textContent = e && e.name === 'AbortError' ? 'Отменено' : 'Не получилось: ' + причинаОшибки(e);
      if (!(e && e.name === 'AbortError')) console.warn('[TavernOS HUD] Праздники мира:', e);
    } finally {
      if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
      отмена = null;
      кнопка.textContent = '✨ Сгенерировать';
      окно.classList.remove('is-busy');
    }
  });
}
