// hud-manager/render/consequences.js
//
// Последствия накопленного. Неделя недосыпа или голода, стресс под потолок,
// долг на счету, ружьё с истёкшим сроком — HUD сам видит, к чему это идёт, и
// показывает в карточке человека: что назревает и почему. Кнопкой это можно
// один раз отдать модели в следующий ответ (разовая подсказка, turn-notes.js);
// отказ тоже запоминается — второй раз то же самое не предлагается.
//
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { escapeHtml, flattenFieldValue, снятьЗаглушки, имяБезПриставки } from '../utils.js?v=23.89.28';
import { settings } from '../settings.js?v=23.89.28';
import { namesLikelySame } from '../names.js?v=23.89.28';
import { parseSceneDate } from '../history-analyzer.js?v=23.89.28';
import { запущенноеУ, срокиНитей, добавитьПодсказку, отметкаПоследствия, отметитьПоследствие } from '../turn-notes.js?v=23.89.28';
import { раскрывашка } from './fold.js?v=23.89.28';

const ДЕНЬ = 864e5;
// Пороги: «накопленное», а не плохой час.
const ПОРОГ = { стресс: 85, энергия: 10, дней: 3 };

// Кошелёк телефона: чей и сколько. Ставит index.js перед сборкой карточки.
let контекст = { владелец: '', баланс: null, валюта: '' };
export function задатьКонтекстПоследствий({ владелец = '', баланс = null, валюта = '' } = {}) {
  const ч = parseFloat(String(баланс ?? '').replace(/[\s ]/g, '').replace(',', '.').replace(/[^\d.\-−]/g, '').replace('−', '-'));
  контекст = { владелец: String(владелец || ''), баланс: Number.isFinite(ч) ? ч : null, валюта: String(валюта || '') };
}

const шкала = (текст, код) => { const м = String(текст || '').match(new RegExp(`(?:^|;)\\s*${код}\\s*[:：]\\s*(\\d{1,3})`, 'i')); return м ? +м[1] : null; };
const нормаКлюча = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 80);

/** Что назревает у человека: [{ ключ, что, почему }]. */
export function последствияЧеловека(о, имя) {
  if (settings.consequences === false || !имя) return [];
  const сцена = parseSceneDate(о && о.__датаСцены);
  const неделя = сцена !== null ? Math.floor(сцена / (7 * ДЕНЬ)) : 'x';
  const out = [];
  // В тексте — имя без приставки карточки («THE REGENTS  Tristan» → «Tristan»).
  const кто = имяБезПриставки(String(имя)) || имя;
  const тело = снятьЗаглушки(flattenFieldValue(о && (о['Состояние тела'] ?? о.Bs)));
  const стресс = шкала(тело, 'str'), энергия = шкала(тело, 'eng');
  if (стресс !== null && стресс >= ПОРОГ.стресс) out.push({ ключ: `стресс|${имя}|${неделя}`, что: `${кто} срывается из-за высокого стресса`, почему: `стресс ${стресс} из 100` });
  if (энергия !== null && энергия <= ПОРОГ.энергия) out.push({ ключ: `силы|${имя}|${неделя}`, что: `${кто} валится с ног и больше не может`, почему: `энергия ${энергия} из 100` });
  // Дни подряд без сна, еды и воды (turn-notes.js, запущенное состояние).
  const з = сцена !== null ? запущенноеУ(имя, сцена) : null;
  if (з) {
    const дней = (к) => (Number.isFinite(з[к]) ? Math.round((сцена - з[к]) / ДЕНЬ) : 0);
    const с = дней('сон'), е = дней('еда'), в = дней('вода');
    if (с >= ПОРОГ.дней) out.push({ ключ: `сон|${имя}|${з.сон}`, что: `${кто} отключается на ходу — недосып берёт своё`, почему: `${с} дн. почти без сна` });
    if (е >= ПОРОГ.дней) out.push({ ключ: `еда|${имя}|${з.еда}`, что: `${кто} становится плохо от голода — слабость, головокружение`, почему: `${е} дн. почти без еды` });
    if (в >= 2) out.push({ ключ: `вода|${имя}|${з.вода}`, что: `${кто} мучает обезвоживание`, почему: `${в} дн. почти без воды` });
  }
  // Долг: минус на счету владельца телефона.
  if (контекст.баланс !== null && контекст.баланс < 0 && контекст.владелец && namesLikelySame(контекст.владелец, имя)) {
    const месяц = сцена !== null ? new Date(сцена).toISOString().slice(0, 7) : 'x';
    out.push({ ключ: `долг|${имя}|${месяц}`, что: 'Приходит коллектор', почему: `на счету ${контекст.баланс}${контекст.валюта ? ' ' + контекст.валюта : ''}` });
  }
  // Ружьё с истёкшим сроком, привязанное к этому человеку.
  if (сцена !== null) for (const н of срокиНитей()) {
    if (!Number.isFinite(н.дата) || н.дата > сцена || !н.завязка || !н.кто) continue;
    if (!String(н.кто).split(/[,;и&]+/).some(кто => кто.trim() && namesLikelySame(кто.trim(), имя))) continue;
    const д = new Date(н.дата);
    out.push({ ключ: `ружьё|${нормаКлюча(н.завязка)}`, что: `Ружьё стреляет: ${н.завязка}`, почему: `срок истёк ${String(д.getUTCDate()).padStart(2, '0')}.${String(д.getUTCMonth() + 1).padStart(2, '0')}` });
  }
  return out.filter(п => !отметкаПоследствия(п.ключ));
}

const МОЛНИЯ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
/** Плашка «Назревает» для карточки; '' — нечего предложить. Видно, что назревает;
 *  почему и кнопки выезжают по нажатию (render/fold.js). */
export function плашкаПоследствий(о, имя) {
  const список = последствияЧеловека(о, имя);
  if (!список.length) return '';
  const пункты = список.map(п => раскрывашка('hud-conseq-item', `<b class="what">${escapeHtml(п.что)}</b>`,
    `<p class="why">Почему: ${escapeHtml(п.почему)}</p>`
      + `<span class="acts"><button type="button" data-hud-conseq="send" data-conseq-text="${escapeHtml(п.что + ' (' + п.почему + ')')}">Предложить модели</button><button type="button" data-hud-conseq="skip">Не надо</button></span>`,
    ` data-conseq-key="${escapeHtml(п.ключ)}"`)).join('');
  return `<div class="hud-conseq" role="status"><div class="hud-conseq-top"><i class="hud-conseq-ico">${МОЛНИЯ}</i><span class="hud-section-title hud-note-eye">Назревает</span>`
    + (список.length > 1 ? `<b class="hud-conseq-n">${список.length}</b>` : '') + `</div><div class="hud-conseq-list">${пункты}</div></div>`;
}

// Нажатия: «предложить» — в разовые подсказки следующего ответа, «не надо» —
// просто запомнить. В обоих случаях больше не показываем.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && !globalThis.__hudConseqBound) {
  globalThis.__hudConseqBound = true;
  document.addEventListener('click', (e) => {
    const кнопка = e.target && e.target.closest ? e.target.closest('[data-hud-conseq]') : null;
    if (!кнопка || !кнопка.closest('.hud-os-card')) return;
    e.preventDefault(); e.stopPropagation();
    const пункт = кнопка.closest('.hud-conseq-item');
    const ключ = пункт && пункт.dataset.conseqKey;
    if (!ключ) return;
    // Окно кастомизации показывает пример или прошлый ход: оттуда в настоящий чат ничего не уходит.
    if (кнопка.closest('.hud-custom-preview-body')) { пункт.querySelector('.why').textContent = 'Это предпросмотр: отсюда модели ничего не отправляется.'; return; }
    if (кнопка.dataset.hudConseq === 'send') {
      if (!добавитьПодсказку('consequence', кнопка.dataset.conseqText || '')) {
        пункт.querySelector('.why').textContent = 'Очередь подсказок полна (до трёх на ответ) — предложите после следующего ответа.';
        return;
      }
      отметитьПоследствие(ключ, 'sent');
      пункт.className = 'hud-conseq-item is-done';
      пункт.innerHTML = '<small class="done">✓ Уйдёт модели в следующем ответе — один раз.</small>';
    } else {
      отметитьПоследствие(ключ, 'skip');
      const плашка = пункт.closest('.hud-conseq');
      пункт.remove();
      if (плашка && !плашка.querySelector('.hud-conseq-item')) плашка.remove();
    }
  }, true);
}
