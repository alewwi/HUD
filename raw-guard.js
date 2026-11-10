// hud-manager/raw-guard.js
//
// Голый код вместо карточки. Таверна вставляет сообщение как есть — блок
// [HUD] с JSON, — а карточка встаёт только после разбора. Между ними зритель
// видел сырой текст: при открытии чата, смене настроек, языка, вида.
//
// Наблюдатель чата — микрозадача, он успевает до отрисовки. Здесь он прячет
// узлы блока и показывает заглушку (стили: .hud-raw-wait и .hud-wait). Разбор
// первым делом снимает пометки: он читает innerHTML, и чужих классов в нём быть
// не должно. Снятие и вставка карточки идут одним куском, без отрисовки между
// ними. Если карточка так и не собралась (сломанный JSON), текст возвращается —
// прятать ответ модели навсегда нельзя.

const КЛАСС_УЗЛА = 'hud-raw-wait', КЛАСС_СООБЩЕНИЯ = 'hud-wait';
const НАЧАЛО = /\[HUD\]\s*$/i, КОНЕЦ = /\[\/HUD\]/i, ЦЕЛИКОМ = /^\s*\[HUD\][\s\S]*\[\/HUD\]\s*$/i;
const НАДОЛГО = 15000;

const текст = (узел) => String(узел.textContent || '');

/** Узлы верхнего уровня, из которых состоят законченные блоки HUD. */
export function узлыБлоков(дети) {
  const итог = [];
  let блок = null;
  for (const узел of Array.from(дети || [])) {
    const т = текст(узел);
    if (блок) {
      блок.push(узел);
      if (КОНЕЦ.test(т)) { итог.push(...блок); блок = null; }
    } else if (ЦЕЛИКОМ.test(т)) итог.push(узел);
    else if (НАЧАЛО.test(т) && т.trim().length <= 8) блок = [узел];
  }
  return итог; // незакрытый блок (ответ ещё печатается) не трогаем
}

/** Спрятать сырой блок до разбора. Вызывается из наблюдателя чата. */
export function прикрытьСырой(mes) {
  const тело = mes && mes.querySelector && mes.querySelector('.mes_text');
  if (!тело || mes.classList.contains(КЛАСС_СООБЩЕНИЯ)) return false;
  if (тело.querySelector('.hud-os-card, .hud-evicted, .edit_textarea') || mes.querySelector('.edit_textarea')) return false;
  if (!КОНЕЦ.test(текст(тело))) return false;
  const узлы = узлыБлоков(тело.children);
  if (!узлы.length) return false;
  узлы.forEach(у => у.classList.add(КЛАСС_УЗЛА));
  mes.classList.add(КЛАСС_СООБЩЕНИЯ);
  clearTimeout(mes.__hudWaitT);
  mes.__hudWaitT = setTimeout(() => снятьПрикрытие(mes), НАДОЛГО);
  return true;
}

/** Вернуть узлы как были: перед разбором или если разбора не случилось. */
export function снятьПрикрытие(mes) {
  if (!mes || !mes.classList || !mes.classList.contains(КЛАСС_СООБЩЕНИЯ)) return;
  clearTimeout(mes.__hudWaitT);
  mes.classList.remove(КЛАСС_СООБЩЕНИЯ);
  mes.querySelectorAll('.' + КЛАСС_УЗЛА).forEach(у => {
    у.classList.remove(КЛАСС_УЗЛА);
    if (!у.getAttribute('class')) у.removeAttribute('class');
  });
}
