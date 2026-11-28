// hud-manager/render/holiday-prep.js
//
// Окно «Подготовка» — по кнопке «Да, сгенерировать подготовку» на плашке над
// вкладками (render/holiday-lore.js): к празднику мира, празднику эпохи или
// ярмарке. Модель предлагает 2–4 шага подготовки — что собрать, сшить,
// купить, у кого спросить. Игрок отмечает нужные, может перегенерировать и
// выбирает, куда их деть:
//   · сохранить только себе — список виден над вкладками до самого дня;
//   · отправить модели и сохранить себе;
//   · отправить только модели (разовой подсказкой, turn-notes.js);
//   · ничего не отправлять — вопрос о подготовке закрывается.
// «Отмена» закрывает окно, а вопрос на плашке остаётся.
//
// Контекст необязателен; запрос — через профиль окна «Праздники мира» или
// модель чата, HUD-инструкция в него не вшивается.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml } from '../utils.js?v=23.90.13';
import { settings } from '../settings.js?v=23.90.13';
import { т } from '../i18n.js?v=23.90.13';
import { карточкаПерсонажа, персонаИгрока } from './assistant.js?v=23.90.13';
import { связьПраздников, сохранитьПодготовку, ответитьНаПодготовку, подготовка, подготовкаСписком } from './holiday-lore.js?v=23.90.13';
import { отправить, текстОтвета, эпохаПраздников, своиЛорбуки, ЖДЁМ_МС, ЛОР_СИМВОЛОВ, языкПраздников, рядПрофиля, подключитьПрофили, полеТокенов, токеныОкна, подключитьТокены, причинаОшибки } from './holiday-gen.js?v=23.90.13';
import { историяДляПраздника } from './holiday-day.js?v=23.90.13';
import { добавитьПодсказку } from '../turn-notes.js?v=23.90.13';

function контекст() { try { return globalThis.SillyTavern?.getContext?.() || null; } catch (_) { return null; } }
function сохранитьНастройки() { try { связьПраздников().сохранить?.(); } catch (_) { /* не критично */ } }
const источник = (ключ) => settings[ключ] !== false;

/** Промпт: 2–4 шага подготовки одним JSON. было — прошлые шаги (при «Заново»). */
export function промптПодготовки({ имя = '', о = '', когда = '', через = 0, ярмарка = false, карточка = '', персона = '', лор = '', история = '', эпоха = '', язык = 'Russian', было = [] } = {}) {
  const блоки = [];
  if (карточка) блоки.push(`<character_card>\n${карточка}\n</character_card>`);
  if (персона) блоки.push(`<player_persona>\n${персона}\n</player_persona>`);
  if (лор) блоки.push(`<lorebook>\n${лор}\n</lorebook>`);
  if (история) блоки.push(`<recent_story>\n${история}\n</recent_story>`);
  const что = ярмарка ? `A fair${имя ? ` «${имя}»` : ''}` : `The holiday «${имя}»`;
  const user = `${блоки.length ? блоки.join('\n\n') + '\n\n' : ''}${что} comes in ${через} ${через === 1 ? 'day' : 'days'}${когда ? ` (${когда})` : ''}.${о ? ` What is known: ${о}` : ''}${эпоха ? `\n${эпоха}` : ''}

The player's character wants to get ready for it. Suggest 2 to 4 concrete preparation steps they could take before that day — ${ярмарка ? 'what to bring to sell, what to look for, coin to set aside, whom to find there' : 'what to make, cook, sew, buy or gather, whom to invite or ask, what to rehearse'}.
- Fit the world, its era, technology and magic, and the character's situation${блоки.length ? ' from the materials' : ''}.
- Each step is one short sentence starting with a verb. Things to do, not outcomes: never decide what the character feels or how it goes.${было.length ? `\n- Earlier you suggested: ${было.join('; ')}. Now give different steps.` : ''}
- Write the steps in ${язык}.

Answer with JSON only, no other text:
{"steps": ["…", "…"]}`;
  const system = 'You are a helpful planner inside an ongoing roleplay story. You suggest concrete, playable steps that fit the world, and return structured data only.';
  return { system, user };
}

/** Ответ модели → [шаги] (до 4). Терпит ```json, рассуждения, голый список. */
export function разобратьПодготовку(ответ) {
  let s = String(ответ ?? '').replace(/<think(?:ing)?\b[^>]*>[\s\S]*?<\/think(?:ing)?>/gi, ' ');
  const код = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (код) s = код[1];
  const начало = s.search(/[[{]/);
  if (начало < 0) return [];
  s = s.slice(начало);
  const конец = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
  if (конец < 0) return [];
  let д;
  try { д = JSON.parse(s.slice(0, конец + 1).replace(/,\s*([\]}])/g, '$1')); } catch (_) { return []; }
  const список = Array.isArray(д) ? д : Array.isArray(д?.steps) ? д.steps : Object.values(д || {}).find(Array.isArray) || [];
  return список.map(ш => String(typeof ш === 'object' && ш ? (ш.step ?? ш.text ?? '') : ш ?? '').replace(/^\s*\d+[.)]\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean).slice(0, 4);
}

const ДЕЙСТВИЯ = [
  ['both', 'Отправить модели и сохранить мне (визуально)'],
  ['me', 'Сохранить только мне (визуально)'],
  ['model', 'Отправить только модели'],
  ['none', 'Ничего не отправлять'],
];

let открыто = false;

/** данные — с плашки: { ключ, имя, модели, о, когда, через, ярмарка, текст }. */
export async function открытьПодготовку(данные = {}) {
  if (открыто || !данные.ключ) return;
  открыто = true;
  const ctx = контекст();
  const с = связьПраздников();
  let книгиВсе = [];
  try { книгиВсе = (await с.списокЛорбуков?.()) || []; } catch (_) { книгиВсе = []; }
  const свои = своиЛорбуки(ctx);
  const выбраны = new Set((Array.isArray(settings.holidayLorebooks) && settings.holidayLorebooks.length ? settings.holidayLorebooks : свои).filter(к => книгиВсе.includes(к) || свои.includes(к)));
  const книги = [...new Set([...свои, ...книгиВсе])];
  const п = (s) => escapeHtml(т(s));

  const overlay = document.createElement('div');
  overlay.className = 'hud-modal-overlay';
  overlay.innerHTML = `
    <div class="hud-modal hud-holgen hud-prepgen" role="dialog" aria-modal="true" aria-label="${п('Подготовка')}">
      <div class="hud-modal-head"><span class="hud-holgen-orb" aria-hidden="true"></span><span class="hud-holgen-title">${п('Подготовка')} <b data-i18n-skip>«${escapeHtml(данные.имя || '')}»</b><small>${escapeHtml(данные.срок || данные.когда || '')}</small></span><button type="button" class="hud-modal-x" aria-label="${п('Закрыть')}">✕</button></div>
      <div class="hud-modal-body">
        <div class="hud-holgen-sec"><span class="hud-holgen-lbl">${п('Откуда брать контекст')} <small>${п('необязательно')}</small></span>
          <div class="hud-holgen-src" role="group">
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseLore" aria-pressed="${источник('holidayUseLore')}">📚 ${п('Лорбук')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUsePersona" aria-pressed="${источник('holidayUsePersona')}">👤 ${п('Персона')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseCard" aria-pressed="${источник('holidayUseCard')}">🎭 ${п('Карточка')}</button>
            <button type="button" class="hud-holgen-toggle" data-src="holidayUseChat" aria-pressed="${источник('holidayUseChat')}">💬 ${п('Сообщения')}</button>
          </div>
          ${книги.length ? `<details class="hud-prepgen-books"${источник('holidayUseLore') ? '' : ' hidden'}><summary class="hud-holgen-note">${п('Какие лорбуки')}</summary><div class="hud-holgen-books">${книги.map(к => `<label class="hud-holgen-book"><input type="checkbox" value="${escapeHtml(к)}"${выбраны.has(к) ? ' checked' : ''}><span>${escapeHtml(к)}</span></label>`).join('')}</div></details>` : ''}
        </div>
        <div class="hud-holgen-row"><label class="hud-holgen-field"><span class="hud-holgen-lbl">${п('Профиль подключения')}</span>${рядПрофиля()}</label>${полеТокенов('holidayPrepMaxTokens')}</div>
        <div class="hud-holgen-actions"><button type="button" class="hud-holgen-run">✨ ${п('Сгенерировать')}</button><span class="hud-holgen-status" aria-live="polite"></span></div>
        <div class="hud-prepgen-result" hidden>
          <div class="hud-prepgen-top"><span class="hud-holgen-lbl">${п('Шаги подготовки')} <small>${п('галочка — взять')}</small></span><button type="button" class="hud-prepgen-again" title="${п('Сгенерировать заново')}">↻ ${п('Заново')}</button></div>
          <ol class="hud-prepgen-steps"></ol>
          <div class="hud-prepgen-what" role="radiogroup" aria-label="${п('Что сделать')}">${ДЕЙСТВИЯ.map(([к, подпись], i) => `<label class="hud-prepgen-opt"><input type="radio" name="hud-prepgen-what" value="${к}"${i === 0 ? ' checked' : ''}><span>${п(подпись)}</span></label>`).join('')}</div>
        </div>
        <div class="hud-prepgen-buttons"><button type="button" class="hud-prepgen-ok" hidden>${п('Готово')}</button><button type="button" class="hud-prepgen-cancel">${п('Отмена')}</button></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const окно = overlay.querySelector('.hud-prepgen');
  const статус = окно.querySelector('.hud-holgen-status');
  const итог = окно.querySelector('.hud-prepgen-result');
  const список = окно.querySelector('.hud-prepgen-steps');
  const кнопка = окно.querySelector('.hud-holgen-run');
  const готово = окно.querySelector('.hud-prepgen-ok');
  let отмена = null, шаги = [], было = (подготовка(данные.ключ)?.шаги) || [];

  const показать = () => {
    итог.hidden = готово.hidden = !шаги.length;
    список.innerHTML = шаги.map((ш, i) => `<li><label><input type="checkbox" data-i="${i}" checked><span>${escapeHtml(ш)}</span></label></li>`).join('');
  };

  let отписаться = () => {};
  const закрыть = () => { if (отмена) отмена.abort(); overlay.remove(); открыто = false; document.removeEventListener('keydown', поEsc, true); отписаться(); };
  const поEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); закрыть(); } };
  document.addEventListener('keydown', поEsc, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) закрыть(); });
  окно.querySelector('.hud-modal-x').addEventListener('click', закрыть);
  окно.querySelector('.hud-prepgen-cancel').addEventListener('click', закрыть);
  окно.querySelector('.hud-holgen-books')?.addEventListener('change', () => {
    settings.holidayLorebooks = [...окно.querySelectorAll('.hud-holgen-book input:checked')].map(и => и.value); сохранитьНастройки();
  });
  отписаться = подключитьПрофили(окно, статус, сохранитьНастройки);
  подключитьТокены(окно, 'holidayPrepMaxTokens', сохранитьНастройки);

  окно.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !t.dataset.src) return;
    const вкл = t.getAttribute('aria-pressed') !== 'true';
    t.setAttribute('aria-pressed', String(вкл));
    settings[t.dataset.src] = вкл; сохранитьНастройки();
    if (t.dataset.src === 'holidayUseLore') { const б = окно.querySelector('.hud-prepgen-books'); if (б) б.hidden = !вкл; }
  });

  const сгенерировать = async () => {
    if (отмена) { отмена.abort(); return; }
    const ctx2 = контекст();
    if (!ctx2) { статус.textContent = т('Таверна ещё не готова'); return; }
    отмена = new AbortController();
    const { signal } = отмена;
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
      const { system, user } = промптПодготовки({
        имя: данные.модели || данные.имя, о: данные.о, когда: данные.когда, через: данные.через, ярмарка: данные.ярмарка,
        карточка: карта ? `${карта.name}\n${карта.text}` : '', персона, лор, история, эпоха: эпохаПраздников(), язык: языкПраздников(), было,
      });
      статус.textContent = т('Модель думает…');
      window.__tavernOSHudSkipInject = (window.__tavernOSHudSkipInject || 0) + 1;
      безHud = true;
      let таймерОжидания = 0;
      const raw = await Promise.race([
        отправить(ctx2, system, user, signal, токеныОкна(окно, 'holidayPrepMaxTokens', сохранитьНастройки)),
        new Promise((_, reject) => { таймерОжидания = setTimeout(() => { reject(new Error(т('модель молчит дольше') + ' ' + ЖДЁМ_МС / 1000 + ' с')); отмена?.abort(); }, ЖДЁМ_МС); }),
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
      ]).finally(() => clearTimeout(таймерОжидания));
      signal.throwIfAborted();
      const новые = разобратьПодготовку(текстОтвета(raw));
      if (!новые.length) throw new Error(т('в ответе модели не нашлось шагов подготовки — попробуйте ещё раз или другой профиль'));
      шаги = новые;
      было = было.concat(новые).slice(-8);
      статус.textContent = '';
      показать();
    } catch (e) {
      статус.textContent = e && e.name === 'AbortError' ? т('Отменено') : т('Не получилось:') + ' ' + причинаОшибки(e);
      if (!(e && e.name === 'AbortError')) console.warn('[TavernOS HUD] Подготовка:', e);
    } finally {
      if (безHud) window.__tavernOSHudSkipInject = Math.max(0, (window.__tavernOSHudSkipInject || 1) - 1);
      отмена = null;
      кнопка.textContent = '✨ ' + т('Сгенерировать');
      окно.classList.remove('is-busy');
    }
  };
  кнопка.addEventListener('click', сгенерировать);
  окно.querySelector('.hud-prepgen-again').addEventListener('click', сгенерировать);

  готово.addEventListener('click', () => {
    const что = окно.querySelector('input[name="hud-prepgen-what"]:checked')?.value || 'both';
    const взяты = [...список.querySelectorAll('input[type="checkbox"]')].filter(и => и.checked).map(и => шаги[+и.dataset.i]).filter(Boolean);
    // «Ничего не отправлять» — как «Отмена»: закрывается только окно, вопрос на плашке остаётся.
    if (что === 'none') { закрыть(); return; }
    if (!взяты.length) { статус.textContent = т('Отметьте хотя бы один шаг'); return; }
    const модели = что === 'model' || что === 'both';
    const мне = что === 'me' || что === 'both';
    // «Вести список» (настройка prepTracking): модель видит открытые шаги каждый
    // ход и отмечает сделанные. «Разово» — одна подсказка со следующим ответом.
    const вести = модели && подготовкаСписком();
    if (модели && !вести) {
      const текст = `${данные.текст}. Preparation the player chose: ${взяты.map((ш, i) => `${i + 1}) ${ш.replace(/[.!…\s]+$/u, '')}`).join('; ')}. Let the character's preparations show in the story where it fits; never decide how it goes.`;
      if (!добавитьПодсказку('holidayPrep', текст, данные.ключ)) { статус.textContent = т('Очередь подсказок полна (до трёх на ответ) — отправьте после следующего ответа.'); return; }
    }
    if (мне || вести) сохранитьПодготовку(данные.ключ, взяты, { вести, показ: мне, дата: данные.дата, имя: данные.имя, модели: данные.модели, ярмарка: данные.ярмарка });
    ответитьНаПодготовку(данные.ключ, 'yes');
    закрыть();
    try { связьПраздников().перерисовать?.(); } catch (_) { /* обновится со следующим ходом */ }
  });
}
