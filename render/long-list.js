// hud-manager/render/long-list.js
//
// Длинные списки памяти (таймлайн, «Важное») за двадцать-двести ходов
// вырастают до сотен пунктов. На экране — последние, свежие; ранние лежат
// порциями в <template>: браузер разбирает их, но не строит, не раскладывает
// и не рисует. Кнопка «Показать ранние» достаёт по одной порции — ближайшей к
// видимым, так что порядок пунктов не меняется. Обработчик — events.js.

export const ВИДНО_СРАЗУ = 25;
export const ПОРЦИЯ = 30;

// пункты — готовые куски разметки в хронологическом порядке (старые первыми).
export function длинныйСписок(пункты, классСписка, подпись = 'ранние') {
  const все = (Array.isArray(пункты) ? пункты : []).filter(Boolean);
  if (все.length <= ВИДНО_СРАЗУ + 10) return `<div class="${классСписка}">${все.join('')}</div>`;
  const скрыто = все.slice(0, все.length - ВИДНО_СРАЗУ);
  const видно = все.slice(все.length - ВИДНО_СРАЗУ);
  // Порции режем от видимых к старым: первой раскроется ближайшая.
  const порции = [];
  for (let конец = скрыто.length; конец > 0; конец -= ПОРЦИЯ) порции.unshift(скрыто.slice(Math.max(0, конец - ПОРЦИЯ), конец).join(''));
  return `<div class="hud-longlist"><button type="button" class="hud-more-btn" data-more-left="${скрыто.length}">Показать ${подпись} <b>${скрыто.length}</b></button>`
    + `<div class="${классСписка}">${порции.map(п => `<template class="hud-more-tpl">${п}</template>`).join('')}${видно.join('')}</div></div>`;
}

// Раскрыть одну порцию. Возвращает раскрытые узлы — им нужны те же пометки,
// что и остальным (реакции, вопросики).
export function раскрытьПорцию(кнопка) {
  const список = кнопка && кнопка.closest('.hud-longlist');
  if (!список) return [];
  const шаблоны = список.querySelectorAll('template.hud-more-tpl');
  const шаблон = шаблоны[шаблоны.length - 1];
  if (!шаблон) { кнопка.remove(); return []; }
  const узлы = [...шаблон.content.childNodes];
  шаблон.replaceWith(шаблон.content);
  const осталось = [...список.querySelectorAll('template.hud-more-tpl')].reduce((n, т) => n + т.content.children.length, 0);
  if (!осталось) кнопка.remove();
  else {
    кнопка.dataset.moreLeft = String(осталось);
    const число = кнопка.querySelector('b');
    if (число) число.textContent = String(осталось);
  }
  return узлы.filter(у => у.nodeType === 1);
}
