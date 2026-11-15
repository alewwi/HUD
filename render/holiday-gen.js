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

import { escapeHtml, генерацияТаверны } from '../utils.js?v=23.89.36';
import { settings } from '../settings.js?v=23.89.36';
import { старина, заклинанияВМире, дарыВМире, магияСкрыта } from '../era.js?v=23.89.36';
import { карточкаПерсонажа, персонаИгрока, parseAssistantAnswer } from './assistant.js?v=23.89.36';
import { связьПраздников, разобратьПраздники, нормализоватьПраздник, праздникиМира, добавитьПраздникиМира, убратьПраздникМира, скрытыеПраздникиЭпохи, скрытьПраздникЭпохи } from './holiday-lore.js?v=23.89.36';
import { праздникиГода } from './holidays.js?v=23.89.36';
import { т } from '../i18n.js?v=23.89.36';

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
// Эпоха для модели: средневековье и какое фэнтези (era.js). Обычная современность — пусто.
export function эпохаПраздников() {
  // Магия в мире (era.js), а не облик: скрытая магия тоже даёт свои праздники.
  const магия = (заклинанияВМире() ? 'fantasy with spells and enchanted things' : дарыВМире() ? 'grounded fantasy: innate elemental gifts and spirits, no spells or magic tools' : '') + (магияСкрыта() ? ', magic hidden from ordinary society' : '');
  if (!старина() && !магия) return '';
  return [старина() ? 'medieval' : 'modern', магия].filter(Boolean).join(', ');
}
export function промптПраздников({ карточка = '', персона = '', лор = '', дата = '', сколько = 0, эпоха = '' } = {}) {
  const блоки = [];
  if (карточка) блоки.push(`<character_card>\n${карточка}\n</character_card>`);
  if (персона) блоки.push(`<player_persona>\n${персона}\n</player_persona>`);
  if (лор) блоки.push(`<lorebook>\n${лор}\n</lorebook>`);
  const user = `${блоки.join('\n\n')}

Make a list of holidays, festivals and notable dates that the people of this story's world mark.
- If these materials come from a known fandom or setting, use its canon holidays first. Where canon gives none or too few, invent new ones that would fit the canon, with nods to its lore — places, history, beliefs, famous people and events — so they feel like they could be canon.
- If the world is original, rely only on these materials and invent holidays that grow out of them.
- Mix big public holidays with smaller local or personal ones when the world suggests them.${дата ? `\n- The story's date now: ${дата}.` : ''}${эпоха ? `\n- Era: ${эпоха}.` : ''}
- Give each date on the story's calendar as day and month, "DD.MM". If the world has its own months, map each holiday to a fitting day and month. A one-time event (not repeated every year) gets "DD.MM.YYYY" and "yearly": false.
- Write names and descriptions in the language the materials are written in.
- ${сколько > 0 ? `Exactly ${сколько} ${сколько === 1 ? 'holiday' : 'holidays'}.` : 'As many as the materials support — usually 5 to 12.'}

Answer with JSON only, no other text:
[{"date": "DD.MM", "name": "holiday name", "about": "one short sentence: what is celebrated and how", "yearly": true}]`;
  const system = 'You are a careful lore researcher for an ongoing roleplay story. You read the given materials and return structured data only.';
  return { system, user };
}

export async function отправить(ctx, system, user, signal) {
  const профиль = String(settings.holidayProfileId || '');
  const служба = ctx.ConnectionManagerRequestService;
  const профили = (() => { try { return связьПраздников().профили?.() || []; } catch (_) { return []; } })();
  if (профиль && служба && typeof служба.sendRequest === 'function') {
    if (!профили.some(p => String(p.id) === профиль)) throw new Error('выбранный профиль подключения не найден — выберите другой');
    return служба.sendRequest(профиль, [{ role: 'system', content: system }, { role: 'user', content: user }], 3000,
      { stream: false, extractData: true, includePreset: false, includeInstruct: true, signal });
  }
  return генерацияТаверны(ctx, { prompt: user, systemPrompt: system, responseLength: 3000, signal });
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
  const профили = (() => { try { return с.профили?.() || []; } catch (_) { return []; } })();
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
        <div class="hud-holgen-sec"><span class="hud-holgen-lbl">Откуда брать контекст</span>
          <div class="hud-holgen-src" role="group" aria-label="Откуда брать контекст">
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseLore" aria-pressed="${источник('holidayUseLore')}">📚 Лорбук</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUsePersona" aria-pressed="${источник('holidayUsePersona')}">👤 Персона</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseCard" aria-pressed="${источник('holidayUseCard')}">🎭 Карточка</button>
          </div>
          <div class="hud-holgen-books"${источник('holidayUseLore') ? '' : ' hidden'}>${книги.length
            ? книги.map(к => `<label class="hud-holgen-book"><input type="checkbox" value="${escapeHtml(к)}"${выбраны.has(к) ? ' checked' : ''}><span>${escapeHtml(к)}</span>${свои.includes(к) ? '<small>этого чата</small>' : ''}</label>`).join('')
            : '<p class="hud-holgen-note">Лорбуков нет — возьмутся только персона и карточка.</p>'}</div>
        </div>
        <div class="hud-holgen-row">
          <label class="hud-holgen-field"><span class="hud-holgen-lbl">Профиль подключения</span>
            <select class="hud-holgen-profile"><option value="">модель чата</option>${профили.map(p => `<option value="${escapeHtml(String(p.id))}"${String(p.id) === String(settings.holidayProfileId || '') ? ' selected' : ''}>${escapeHtml(p.name || p.id)}</option>`).join('')}</select></label>
          <label class="hud-holgen-field"><span class="hud-holgen-lbl">Сколько праздников</span>
            <input type="number" class="hud-holgen-count" min="1" max="30" placeholder="сколько найдёт" value="${parseInt(settings.holidayCount, 10) > 0 ? parseInt(settings.holidayCount, 10) : ''}"></label>
        </div>
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
  let отмена = null, найдено = [];

  const даты = (п) => `<span class="hud-holgen-date"><b>${escapeHtml(п.дата.slice(0, 5))}</b><small>${п.ежегодно ? 'каждый год' : escapeHtml(п.дата.slice(6) || 'один раз')}</small></span>`;
  const показатьЕсть = () => {
    const список = праздникиМира();
    есть.innerHTML = список.length ? `<div class="hud-holgen-lbl">Уже в календаре · ${список.length}</div><ul class="hud-holgen-list is-have">${список.map(п => `<li data-id="${escapeHtml(п.id)}">${даты(п)}<span class="hud-holgen-name"><b>${escapeHtml(п.имя)}</b>${п.о ? `<small>${escapeHtml(п.о)}</small>` : ''}</span><button type="button" class="hud-holgen-del" aria-label="Убрать из календаря" title="Убрать из календаря">✕</button></li>`).join('')}</ul>` : '';
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

  const закрыть = () => { if (отмена) отмена.abort(); overlay.remove(); открыто = false; document.removeEventListener('keydown', поEsc, true); };
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
    if (t.matches('.hud-holgen-toggle')) {
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
  окно.querySelector('.hud-holgen-profile').addEventListener('change', (e) => { settings.holidayProfileId = e.target.value || ''; сохранитьНастройки(); });
  окно.querySelector('.hud-holgen-count').addEventListener('change', (e) => { const n = parseInt(e.target.value, 10); settings.holidayCount = n > 0 ? Math.min(30, n) : 0; сохранитьНастройки(); });

  кнопка.addEventListener('click', async () => {
    if (отмена) { отмена.abort(); return; }
    const ctx2 = контекст();
    if (!ctx2) { статус.textContent = 'Таверна ещё не готова'; return; }
    const лорВкл = источник('holidayUseLore'), персонаВкл = источник('holidayUsePersona'), картаВкл = источник('holidayUseCard');
    if (!лорВкл && !персонаВкл && !картаВкл) { статус.textContent = 'Выберите хотя бы один источник'; return; }
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
      if (!карта && !персона && !лор) throw new Error('в выбранных источниках пусто — нечего читать');
      const { system, user } = промптПраздников({
        карточка: карта ? `${карта.name}\n${карта.text}` : '', персона, лор, дата,
        сколько: parseInt(settings.holidayCount, 10) || 0, эпоха: эпохаПраздников(),
      });
      статус.textContent = 'Модель думает…';
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      let таймерОжидания = 0;
      const raw = await Promise.race([
        отправить(ctx2, system, user, signal),
        new Promise((_, reject) => { таймерОжидания = setTimeout(() => { reject(new Error('модель молчит дольше ' + ЖДЁМ_МС / 1000 + ' с')); отмена?.abort(); }, ЖДЁМ_МС); }),
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
      ]).finally(() => clearTimeout(таймерОжидания));
      signal.throwIfAborted();
      найдено = разобратьПраздники(текстОтвета(raw));
      if (!найдено.length) throw new Error('в ответе модели не нашлось праздников в нужном виде — попробуйте ещё раз или другой профиль');
      статус.textContent = '';
      показатьНайдено();
    } catch (e) {
      статус.textContent = e && e.name === 'AbortError' ? 'Отменено' : 'Не получилось: ' + (e && e.message ? e.message : e);
      if (!(e && e.name === 'AbortError')) console.warn('[TavernOS HUD] Праздники мира:', e);
    } finally {
      if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
      отмена = null;
      кнопка.textContent = '✨ Сгенерировать';
      окно.classList.remove('is-busy');
    }
  });
}
