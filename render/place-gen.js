// hud-manager/render/place-gen.js
//
// Окно «Правила и власть места» (кнопка в карточке «Правила места» вкладки
// «Мир», средневековье). Модель описывает выбранное место — деревню, город,
// переправу, дом — по лорбукам, персоне, карточке и последним сообщениям:
// какие порядки здесь действуют и кто чем распоряжается. Игрок видит список,
// убирает лишнее крестиком и сохраняет (render/place-lore.js хранит, показывает
// и напоминает модели).
//
// Запрос — отдельный, через профиль подключения окна «Праздники мира» или
// модель чата; HUD-инструкция в него не вшивается.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.89.78';
import { settings } from '../settings.js?v=23.89.78';
import { т } from '../i18n.js?v=23.89.78';
import { карточкаПерсонажа, персонаИгрока } from './assistant.js?v=23.89.78';
import { связьПраздников } from './holiday-lore.js?v=23.89.78';
import { отправить, текстОтвета, эпохаПраздников, своиЛорбуки, ЖДЁМ_МС, ЛОР_СИМВОЛОВ, языкПраздников, рядПрофиля, подключитьПрофили } from './holiday-gen.js?v=23.89.78';
import { историяДляПраздника } from './holiday-day.js?v=23.89.78';
import { частиАдреса, разобратьМесто, сохранитьМесто, местаЧата } from './place-lore.js?v=23.89.78';

function контекст() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; } }
function сохранитьНастройки() { try { связьПраздников().сохранить?.(); } catch (_) { /* не критично */ } }
const источник = (ключ) => settings[ключ] !== false;

/** Промпт: правила и власть одним JSON. */
export function промптМеста({ место = '', адрес = '', карточка = '', персона = '', лор = '', история = '', дата = '', время = '', эпоха = '', язык = 'Russian', пожелание = '', правила = true, власть = true } = {}) {
  const блоки = [];
  const желание = String(пожелание || '').trim().slice(0, 300);
  if (желание) блоки.push(`<player_wish>\n${желание}\n</player_wish>`);
  if (карточка) блоки.push(`<character_card>\n${карточка}\n</character_card>`);
  if (персона) блоки.push(`<player_persona>\n${персона}\n</player_persona>`);
  if (лор) блоки.push(`<lorebook>\n${лор}\n</lorebook>`);
  if (история) блоки.push(`<recent_story>\n${история}\n</recent_story>`);
  const что = [правила && 'rules', власть && 'power'].filter(Boolean);
  const user = `${блоки.length ? блоки.join('\n\n') + '\n\n' : ''}Place: «${место}».${адрес && адрес !== место ? ` The scene is now at: ${адрес}.` : ''}${эпоха ? `\n${эпоха}` : ''}${дата ? `\nThe story's date now: ${дата}${время ? ', ' + время : ''}.` : ''}

Describe this place's local order as the people who live here know it.${правила ? `
- rules: 3 to 7 rules in force here that a visitor could actually run into — curfews and gates, market days, tolls, bans (no felling in the grove), weapons, who may enter where. Concrete and local, not general morals. Fields: "rule" (one short sentence); "when": "always", "day", "night" or "HH:MM-HH:MM"; "when_text" (short wording of when, or empty); "days": [] or some of "mon","tue","wed","thu","fri","sat","sun"; "who" (whom it binds — everyone, strangers, women, the unarmed…); "where" (the part of the place it concerns, empty if the whole place); "if_broken" (what usually follows).` : ''}${власть ? `
- power: 4 to 7 entries — who holds each kind of authority here. Fields: "area": one of land, bridge, toll, market, court, guards, complaints, church, crossing, other; "label" (short name of that authority); "holder" (a person, family or body); "note" (short detail, or empty). Power may be split and overlap — the land of one lord, the bridge of another, armed men answering to a third. Show that where the world suggests it.` : ''}
- ${блоки.length ? 'Use the materials — places, people, customs and history of this world — and stay consistent with the story so far. Invent only what fits them.' : 'There are no materials: invent from the place name and the era alone.'} Do not force any one real culture.${желание ? '\n- The player asked for something: see <player_wish>. Follow it as far as the world allows.' : ''}
- Write all values in ${язык}.

Answer with JSON only, no other text:
{${что.map(к => к === 'rules' ? '"rules": [{"rule": "…", "when": "night", "when_text": "…", "days": [], "who": "…", "where": "", "if_broken": "…"}]' : '"power": [{"area": "land", "label": "…", "holder": "…", "note": ""}]').join(', ')}}`;
  const system = 'You are a worldbuilder for an ongoing roleplay story. You invent concrete, playable local detail that fits the world, and return structured data only.';
  return { system, user };
}

let открыто = false;

/** Открыть окно. адрес — «Место» сцены; время и дата — из сцены хода. */
export async function открытьПравилаМеста({ адрес = '', время = '', дата = '' } = {}) {
  if (открыто) return;
  открыто = true;
  const ctx = контекст();
  const с = связьПраздников();
  let книгиВсе = [];
  try { книгиВсе = (await с.списокЛорбуков?.()) || []; } catch (_) { книгиВсе = []; }
  const свои = своиЛорбуки(ctx);
  const выбраны = new Set((Array.isArray(settings.holidayLorebooks) && settings.holidayLorebooks.length ? settings.holidayLorebooks : свои).filter(к => книгиВсе.includes(к) || свои.includes(к)));
  const книги = [...new Set([...свои, ...книгиВсе])];
  const части = частиАдреса(адрес);
  const п = (s) => escapeHtml(т(s));

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-holgen hud-plcgen" role="dialog" aria-modal="true" aria-label="${п('Правила и власть места')}">
      <div class="hud-modal-head"><span class="hud-holgen-orb" aria-hidden="true"></span><span class="hud-holgen-title">${п('Правила и власть места')}<small>${п('модель опишет порядки и власть — вы выберете, что оставить')}</small></span><button type="button" class="hud-modal-x" aria-label="${п('Закрыть')}">✕</button></div>
      <div class="hud-modal-body">
        <div class="hud-holgen-sec"><span class="hud-holgen-lbl">${п('Какое место')}</span>
          ${части.length > 1 ? `<div class="hud-holgen-src hud-plcgen-parts" role="group" aria-label="${п('Какое место')}">${части.map((ч, i) => `<button type="button" class="hud-holgen-toggle" data-part="${escapeHtml(ч)}" aria-pressed="${i === 0}">${escapeHtml(ч)}</button>`).join('')}</div>` : ''}
          <input type="text" class="hud-plcgen-name" maxlength="80" value="${escapeHtml(части[0] || '')}" placeholder="${п('Деревня, город, переправа, дом…')}">
        </div>
        <div class="hud-holgen-sec"><span class="hud-holgen-lbl">${п('Что узнать')}</span>
          <div class="hud-holgen-src" role="group">
            <button type="button" class="hud-holgen-toggle" data-what="rules" aria-pressed="true">📜 ${п('Правила')}</button>
            <button type="button" class="hud-holgen-toggle" data-what="power" aria-pressed="true">⚖️ ${п('Власть')}</button>
          </div>
        </div>
        <div class="hud-holgen-sec"><span class="hud-holgen-lbl">${п('Откуда брать контекст')} <small>${п('необязательно')}</small></span>
          <div class="hud-holgen-src" role="group" aria-label="${п('Откуда брать контекст')}">
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseLore" aria-pressed="${источник('holidayUseLore')}">📚 ${п('Лорбук')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUsePersona" aria-pressed="${источник('holidayUsePersona')}">👤 ${п('Персона')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseCard" aria-pressed="${источник('holidayUseCard')}">🎭 ${п('Карточка')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseChat" aria-pressed="${источник('holidayUseChat')}">💬 ${п('Сообщения')}</button>
          </div>
          ${книги.length ? `<details class="hud-prepgen-books"${источник('holidayUseLore') ? '' : ' hidden'}><summary class="hud-holgen-note">${п('Какие лорбуки')}</summary><div class="hud-holgen-books">${книги.map(к => `<label class="hud-holgen-book"><input type="checkbox" value="${escapeHtml(к)}"${выбраны.has(к) ? ' checked' : ''}><span>${escapeHtml(к)}</span>${свои.includes(к) ? `<small>${п('этого чата')}</small>` : ''}</label>`).join('')}</div></details>` : ''}
        </div>
        <label class="hud-holgen-field"><span class="hud-holgen-lbl">${п('Профиль подключения')}</span>${рядПрофиля()}</label>
        <label class="hud-holgen-field hud-holgen-wish-field"><span class="hud-holgen-lbl">${п('Пожелание')}</span>
          <textarea class="hud-holgen-wish hud-plcgen-wish" rows="2" maxlength="300" placeholder="${п('Например: город держит строгий епископ, а мост — гильдия')}"></textarea></label>
        <div class="hud-holgen-actions"><button type="button" class="hud-holgen-run">✨ ${п('Сгенерировать')}</button><span class="hud-holgen-status" aria-live="polite"></span></div>
        <div class="hud-holgen-result" hidden></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const окно = overlay.querySelector('.hud-plcgen');
  const статус = окно.querySelector('.hud-holgen-status');
  const итог = окно.querySelector('.hud-holgen-result');
  const кнопка = окно.querySelector('.hud-holgen-run');
  const поле = окно.querySelector('.hud-plcgen-name');
  let отмена = null, найдено = null, дляМеста = '';

  const показать = () => {
    итог.hidden = !найдено;
    if (!найдено) { итог.innerHTML = ''; return; }
    const пункт = (вид, х, i, тело) => `<li data-kind="${вид}" data-i="${i}"${х.убран ? ' class="is-off"' : ''}><span class="hud-holgen-name">${тело}</span><button type="button" class="hud-holgen-x" aria-pressed="${!!х.убран}" aria-label="${п(х.убран ? 'Вернуть' : 'Не брать')}" title="${п(х.убран ? 'Вернуть' : 'Не брать')}">${х.убран ? '↺' : '✕'}</button></li>`;
    const берём = найдено.правила.filter(х => !х.убран).length + найдено.власть.filter(х => !х.убран).length;
    const было = местаЧата().some(м => м.имя.toLowerCase() === дляМеста.toLowerCase());
    итог.innerHTML = (найдено.правила.length ? `<div class="hud-holgen-lbl">📜 ${п('Правила')} · ${найдено.правила.length} <small>${п('крестик — не брать')}</small></div><ul class="hud-holgen-list">${найдено.правила.map((х, i) => пункт('rule', х, i, `<b>${escapeHtml(х.текст)}</b><small>${escapeHtml([х.когдаСлово, х.кого, х.где, х.иначе].filter(Boolean).join(' · '))}</small>`)).join('')}</ul>` : '')
      + (найдено.власть.length ? `<div class="hud-holgen-lbl">⚖️ ${п('Власть')} · ${найдено.власть.length}</div><ul class="hud-holgen-list">${найдено.власть.map((х, i) => пункт('power', х, i, `<b>${escapeHtml(х.подпись || х.сфера)} — ${escapeHtml(х.кто)}</b>${х.заметка ? `<small>${escapeHtml(х.заметка)}</small>` : ''}`)).join('')}</ul>` : '')
      + `<button type="button" class="hud-holgen-add"${берём ? '' : ' disabled'}>${п(было ? 'Заменить описание места' : 'Сохранить для места')} «${escapeHtml(дляМеста)}» · ${берём}</button>`;
  };

  let отписаться = () => {};
  const закрыть = () => { if (отмена) отмена.abort(); overlay.remove(); открыто = false; document.removeEventListener('keydown', поEsc, true); отписаться(); };
  const поEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поEsc, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  окно.querySelector('.hud-modal-x').addEventListener('click', закрыть);

  окно.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.part !== undefined) {
      окно.querySelectorAll('[data-part]').forEach(б => б.setAttribute('aria-pressed', String(б === t)));
      поле.value = t.dataset.part;
    } else if (t.dataset.what) {
      t.setAttribute('aria-pressed', String(t.getAttribute('aria-pressed') !== 'true'));
    } else if (t.dataset.src) {
      const вкл = t.getAttribute('aria-pressed') !== 'true';
      t.setAttribute('aria-pressed', String(вкл));
      settings[t.dataset.src] = вкл; сохранитьНастройки();
      if (t.dataset.src === 'holidayUseLore') { const б = окно.querySelector('.hud-prepgen-books'); if (б) б.hidden = !вкл; }
    } else if (t.matches('.hud-holgen-x')) {
      const li = t.closest('li');
      const х = (li.dataset.kind === 'rule' ? найдено.правила : найдено.власть)[+li.dataset.i];
      х.убран = !х.убран; показать();
    } else if (t.matches('.hud-holgen-add')) {
      const чисто = (список) => список.filter(х => !х.убран).map(({ убран, ...х }) => х);
      const id = сохранитьМесто(дляМеста, { правила: чисто(найдено.правила), власть: чисто(найдено.власть) });
      статус.textContent = id ? т('Сохранено — карточка «Правила места» обновится') : т('Нечего сохранять');
      найдено = null; показать();
      try { связьПраздников().перерисовать?.(); } catch (_) { /* обновится со следующим ходом */ }
    }
  });
  окно.querySelector('.hud-holgen-books')?.addEventListener('change', () => {
    settings.holidayLorebooks = [...окно.querySelectorAll('.hud-holgen-book input:checked')].map(и => и.value); сохранитьНастройки();
  });
  отписаться = подключитьПрофили(окно, статус, сохранитьНастройки);

  кнопка.addEventListener('click', async () => {
    if (отмена) { отмена.abort(); return; }
    const ctx2 = контекст();
    if (!ctx2) { статус.textContent = т('Таверна ещё не готова'); return; }
    const место = String(поле.value || '').trim().slice(0, 80);
    if (!место) { статус.textContent = т('Назовите место'); return; }
    const правила = окно.querySelector('[data-what="rules"]').getAttribute('aria-pressed') === 'true';
    const власть = окно.querySelector('[data-what="power"]').getAttribute('aria-pressed') === 'true';
    if (!правила && !власть) { статус.textContent = т('Выберите правила, власть или и то и другое'); return; }
    отмена = new AbortController();
    const { signal } = отмена;
    найдено = null; показать();
    кнопка.textContent = т('Остановить');
    окно.classList.add('is-busy');
    let безHud = false;
    try {
      статус.textContent = т('Собираю контекст…');
      const карта = источник('holidayUseCard') ? карточкаПерсонажа(ctx2) : null;
      const персона = источник('holidayUsePersona') ? персонаИгрока(ctx2) : '';
      const история = источник('holidayUseChat') ? историяДляПраздника(ctx2.chat) : '';
      let лор = '';
      if (источник('holidayUseLore')) {
        const имена = [...окно.querySelectorAll('.hud-holgen-book input:checked')].map(и => и.value);
        const записи = имена.length && с.лорбуки ? await с.лорбуки(имена, '', true) : [];
        signal.throwIfAborted();
        лор = записи.map(к => `## ${к.name}\n${к.entries.join('\n\n')}`).join('\n\n').slice(0, ЛОР_СИМВОЛОВ);
      }
      const { system, user } = промптМеста({
        место, адрес, карточка: карта ? `${карта.name}\n${карта.text}` : '', персона, лор, история, дата, время,
        эпоха: эпохаПраздников(), язык: языкПраздников(), пожелание: окно.querySelector('.hud-plcgen-wish')?.value || '', правила, власть,
      });
      статус.textContent = т('Модель думает…');
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      let таймерОжидания = 0;
      const raw = await Promise.race([
        отправить(ctx2, system, user, signal),
        new Promise((_, reject) => { таймерОжидания = setTimeout(() => { reject(new Error(т('модель молчит дольше') + ' ' + ЖДЁМ_МС / 1000 + ' с')); отмена?.abort(); }, ЖДЁМ_МС); }),
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
      ]).finally(() => clearTimeout(таймерОжидания));
      signal.throwIfAborted();
      найдено = разобратьМесто(текстОтвета(raw));
      if (!найдено) throw new Error(т('в ответе модели не нашлось правил и власти в нужном виде — попробуйте ещё раз или другой профиль'));
      дляМеста = место;
      статус.textContent = '';
      показать();
    } catch (e) {
      статус.textContent = e && e.name === 'AbortError' ? т('Отменено') : т('Не получилось:') + ' ' + (e && e.message ? e.message : e);
      if (!(e && e.name === 'AbortError')) console.warn('[TavernOS HUD] Правила места:', e);
    } finally {
      if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
      отмена = null;
      кнопка.textContent = '✨ ' + т('Сгенерировать');
      окно.classList.remove('is-busy');
    }
  });
}
