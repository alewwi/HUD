// hud-manager/confirm-erase.js
//
// Вопрос перед удалением, которое нельзя вернуть: шрам, стат, своя тема,
// картинка, свой промпт. То, что возвращается через «↶» (плашки, беременность),
// спрашивает своё окно с выбором формулировок: окноУдаления() в index.js.

import { т } from './i18n.js?v=23.88.87';

function окноВопроса({ что, текст, итог }) {
  const окно = document.createElement('div');
  окно.className = 'hud-erase-box';
  const абзац = (тег, надпись, класс = '') => {
    if (!надпись) return;
    const у = document.createElement(тег);
    у.textContent = надпись;
    if (класс) у.className = класс;
    окно.append(у);
  };
  абзац('b', т('Вы уверены?'));
  абзац('p', что, 'is-item');
  абзац('p', т(текст));
  абзац('p', т(итог), 'is-warn');
  return окно;
}

/** что — имя удаляемого как есть (его не переводим), текст — чем это кончится. */
export async function уверены({ что = '', текст = '', итог = 'Это необратимо: вернуть будет нельзя.', кнопка = 'Удалить' } = {}) {
  const ctx = window.SillyTavern?.getContext?.();
  const окно = окноВопроса({ что, текст, итог });
  if (typeof ctx?.callGenericPopup !== 'function' || !ctx.POPUP_TYPE) return window.confirm(окно.textContent);
  return !!await ctx.callGenericPopup(окно, ctx.POPUP_TYPE.CONFIRM, '', { okButton: т(кнопка), cancelButton: т('Отмена') });
}
