// hud-manager/render/erase-button.js
//
// Кнопка режима удаления в заголовке блока: включает режим, в котором нажатие
// на плашку удаляет её одну. Пункты лежат на самой кнопке: по их тексту
// index.js находит плашки в любом виде блока, даже без своих кнопок у пунктов.
// Логика удаления — hud-erase.js.

import { escapeHtml } from '../utils.js?v=23.88.58';

export const ЗНАЧОК_КОРЗИНЫ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"/></svg>';

/** вид — important | guns | secrets; пункты — строки, как их показывает блок. */
export function кнопкаУдаления(вид, пункты) {
  const все = [...new Set((Array.isArray(пункты) ? пункты : []).map(п => String(п ?? '').trim()).filter(Boolean))];
  if (!все.length) return '';
  return `<button type="button" class="hud-erase-open" data-hud-erase="${вид}" data-items="${escapeHtml(JSON.stringify(все))}" aria-pressed="false" title="Удалить плашки: включить режим" aria-label="Удалить плашки: включить режим">${ЗНАЧОК_КОРЗИНЫ}</button>`;
}
