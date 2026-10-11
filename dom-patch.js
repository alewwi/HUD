// hud-manager/dom-patch.js
//
// Точечная замена в тексте сообщения. HUD находит сырой блок [HUD] в
// textElement.innerHTML — строке — и раньше записывал всю строку обратно
// (innerHTML = …). Так пересоздавался ВЕСЬ текст сообщения: узлы других
// расширений возвращались копиями без обработчиков. Пример: SLAY Images вешает
// на картинку кнопку «перегенерировать» и помечает картинку «уже привязана»;
// после нашей перезаписи кнопка на месте, метка на месте, а обработчика нет —
// кнопка мертва, и SLAY её больше не перепривязывает.
//
// Здесь заменяются только верхние узлы textElement, которые задевает правка;
// остальные остаются теми же объектами DOM — со всеми чужими обработчиками.

const сериализовать = (узел) => {
  if (узел.nodeType === 1) return узел.outerHTML;
  // Текст и комментарии — так же, как их пишет innerHTML родителя.
  const т = document.createElement('div');
  т.appendChild(узел.cloneNode(false));
  return т.innerHTML;
};

/**
 * правки — [{ from, to, html }] в координатах строки textElement.innerHTML
 * (как её видел вызывающий). Возвращает true, если заменено точечно; false —
 * если строка уже не совпадает с DOM (тогда вызывающий делает как раньше).
 */
export function заменитьВТексте(textElement, исходная, правки) {
  if (!textElement || !Array.isArray(правки) || !правки.length) return false;
  const узлы = Array.from(textElement.childNodes);
  const куски = узлы.map(сериализовать);
  if (куски.join('') !== исходная) return false;
  const границы = [];
  let pos = 0;
  for (const к of куски) { границы.push([pos, pos + к.length]); pos += к.length; }
  // Для каждой правки — какие верхние узлы она задевает [i…j].
  const диапазон = (п) => {
    let i = границы.findIndex(([, e]) => e > п.from);
    if (i === -1) i = узлы.length;
    let j = i - 1;
    for (let k = границы.length - 1; k >= i; k--) if (границы[k][0] < п.to) { j = k; break; }
    return [i, j];
  };
  // Правки, задевающие общие узлы, — одной группой: иначе вторая правка
  // работала бы с узлом, который первая уже убрала.
  const группы = [];
  for (const п of правки.slice().sort((a, b) => a.from - b.from)) {
    const [i, j] = диапазон(п);
    const посл = группы[группы.length - 1];
    if (посл && i <= посл.j && j >= i) { посл.j = Math.max(посл.j, j); посл.правки.push(п); }
    else группы.push({ i, j, правки: [п] });
  }
  // С конца к началу — узлы раньше группы не сдвигаются.
  for (const г of группы.reverse()) {
    const начало = г.i < узлы.length ? границы[г.i][0] : pos;
    const конец = г.j >= г.i ? границы[г.j][1] : начало;
    let новое = исходная.slice(начало, конец);
    for (const п of г.правки.slice().sort((a, b) => b.from - a.from)) {
      новое = новое.slice(0, Math.max(0, п.from - начало)) + п.html + новое.slice(Math.max(0, п.to - начало));
    }
    const шаблон = document.createElement('template');
    шаблон.innerHTML = новое;
    const якорь = г.j + 1 < узлы.length ? узлы[г.j + 1] : null;
    for (let k = г.i; k <= г.j; k++) if (узлы[k] && узлы[k].parentNode === textElement) textElement.removeChild(узлы[k]);
    textElement.insertBefore(шаблон.content, якорь && якорь.parentNode === textElement ? якорь : null);
  }
  return true;
}
