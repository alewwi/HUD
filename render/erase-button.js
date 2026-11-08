// hud-manager/render/erase-button.js
//
// Кнопка режима удаления в заголовке блока: включает режим, в котором нажатие
// на плашку удаляет её одну. Пункты лежат на самой кнопке: по их тексту
// index.js находит плашки в любом виде блока, даже без своих кнопок у пунктов.
// Логика удаления — hud-erase.js.

import { escapeHtml } from '../utils.js?v=23.88.100';
import { settings } from '../settings.js?v=23.88.100';
import { полеВкл } from '../deep-fields.js?v=23.88.100';

export const ЗНАЧОК_КОРЗИНЫ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/></svg>';

const ЗНАЧОК_ПОДСКАЗКИ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"/></svg>';
/** Режим разовой подсказки: нажатая плашка уйдёт модели в следующий ответ. */
export function кнопкаПодсказки(вид, пункты) {
  if (settings.enableHintButtons === false || !полеВкл(settings, 'ui.hint.' + вид)) return '';
  const все = [...new Set((Array.isArray(пункты) ? пункты : []).map(п => String(п ?? '').trim()).filter(Boolean))];
  if (!все.length) return '';
  return `<button type="button" class="hud-hint-open" data-hud-hint="${вид}" data-items="${escapeHtml(JSON.stringify(все))}" aria-pressed="false" title="Разовая подсказка: нажмите на плашку, и она уйдёт модели в следующий ответ" aria-label="Разовая подсказка модели">${ЗНАЧОК_ПОДСКАЗКИ}</button>`;
}

/** вид — important | guns | secrets; пункты — строки, как их показывает блок. */
export function кнопкаУдаления(вид, пункты) {
  const все = [...new Set((Array.isArray(пункты) ? пункты : []).map(п => String(п ?? '').trim()).filter(Boolean))];
  if (!все.length) return '';
  return `<button type="button" class="hud-erase-open" data-hud-erase="${вид}" data-items="${escapeHtml(JSON.stringify(все))}" aria-pressed="false" title="Удалить плашки: включить режим" aria-label="Удалить плашки: включить режим">${ЗНАЧОК_КОРЗИНЫ}</button>`;
}
