// hud-manager/customize-tabs.js
//
// «Кастомизация» → «Вкладки»: порядок, закрепление, скрытие — и рядом цена
// в токенах (token-budget.js), чтобы было видно, что скрыть ≠ выключить.
//
// Перестановка — кнопками ↑ ↓ и перетаскиванием за ручку. Кнопки
// обязательны: ими пользуются с клавиатуры и на телефоне, и они же выручают,
// если перетаскивание не сработало. Перетаскивание — Pointer Events, а не
// HTML5 drag-and-drop (тот на телефоне не работает): захват указателя,
// touch-action: none на ручке, обмен местами при пересечении середины соседа.

import { settings } from './settings.js?v=23.48.1';
import { ВКЛАДКИ, полныйПорядок, сдвинуть } from './tabs-order.js?v=23.48.1';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const массив = (v) => Array.isArray(v) ? v.slice() : [];

// Цены разделов по флагу включения — из последнего бюджета (если посчитан).
let цены = null;
export function задатьЦены(итог) {
  цены = null;
  if (!итог || !итог.инструкция) return;
  цены = Object.fromEntries(итог.инструкция.разделы.filter(р => р.ключ).map(р => [р.ключ, р.цена]));
}

function строка(в, i, всего) {
  const скрыта = массив(settings.tabHidden).includes(в.id);
  const закреп = массив(settings.tabPinned).includes(в.id);
  const выкл = в.enable && settings[в.enable] === false;
  const цена = в.enable && цены && цены[в.enable];
  const состояние = выкл ? 'выключено: модель этот блок не пишет'
    : скрыта ? `скрыто — блок всё равно пишется${цена ? ` (≈${цена} ток.)` : ''}`
      : закреп ? 'закреплено слева' : (цена ? `≈${цена} ток.` : '');
  return `<li class="hud-ct-row${скрыта ? ' is-hidden' : ''}${закреп ? ' is-pinned' : ''}${выкл ? ' is-off' : ''}" data-id="${esc(в.id)}">`
    + `<span class="hud-ct-handle" aria-hidden="true" title="Перетащить">⠿</span>`
    + `<span class="hud-ct-name"><b>${esc(в.значок)} ${esc(в.имя)}</b>${состояние ? `<small>${esc(состояние)}</small>` : ''}</span>`
    + `<span class="hud-ct-btns">`
    + `<button type="button" data-ct="up" aria-label="Выше: ${esc(в.имя)}"${i === 0 ? ' disabled' : ''}>↑</button>`
    + `<button type="button" data-ct="down" aria-label="Ниже: ${esc(в.имя)}"${i === всего - 1 ? ' disabled' : ''}>↓</button>`
    + `<button type="button" data-ct="pin" aria-pressed="${закреп}" title="Закрепить слева — не уходит в «⋯»">${закреп ? 'открепить' : 'закрепить'}</button>`
    + `<button type="button" data-ct="hide" aria-pressed="${скрыта}" title="Скрыть ярлык; блок по-прежнему пишется и копится">${скрыта ? 'показать' : 'скрыть'}</button>`
    + (в.enable && скрыта && !выкл ? `<button type="button" data-ct="off" title="Выключить сам блок: модель перестанет его писать">выключить</button>` : '')
    + `</span></li>`;
}

export function списокВкладок() {
  const порядок = полныйПорядок(settings).filter(id => ВКЛАДКИ.some(в => в.id === id));
  return порядок.map((id, i) => строка(ВКЛАДКИ.find(в => в.id === id), i, порядок.length)).join('');
}

export function разметкаВкладок() {
  return `<details class="hud-custom-views hud-custom-tabs hud-smooth"><summary>🗂 Вкладки</summary>`
    + `<p class="hud-ct-note">Порядок вкладок в карточке. <b>Скрыть</b> — убрать ярлык, а блок пусть пишется и копится (нужен модели и соседним блокам). <b>Выключить</b> — модель перестаёт его писать, и он ничего не стоит. Закреплённые стоят слева и не уходят в «⋯».</p>`
    + `<ul class="hud-ct-list" role="list">${списокВкладок()}</ul></details>`;
}

// Записать полный порядок (из DOM или из массива) и перерисовать.
function сохранитьПорядок(порядок, основа, обновить) {
  // Незнакомые id (вкладки, которых в этой версии нет) не выбрасываем.
  const прежний = массив(settings.tabOrder);
  settings.tabOrder = [...порядок, ...прежний.filter(id => !порядок.includes(id))];
  основа.saveSettings();
  обновить();
}

export function подключитьВкладки(окно, основа, обновить) {
  const перерисоватьСписок = () => { const сп = окно.querySelector('.hud-ct-list'); if (сп) сп.innerHTML = списокВкладок(); };
  const применить = () => { основа.видыМенялись = true; перерисоватьСписок(); обновить(); };
  окно.addEventListener('click', (e) => {
    const кн = e.target.closest && e.target.closest('.hud-ct-list button[data-ct]');
    if (!кн) return;
    const id = кн.closest('.hud-ct-row').dataset.id;
    const дело = кн.dataset.ct;
    if (дело === 'up' || дело === 'down') {
      сохранитьПорядок(сдвинуть(полныйПорядок(settings).filter(x => ВКЛАДКИ.some(в => в.id === x)), id, дело === 'up' ? -1 : 1), основа, () => {});
      применить();
      окно.querySelector(`.hud-ct-row[data-id="${id}"] button[data-ct="${дело}"]`)?.focus();
      return;
    }
    if (дело === 'pin') {
      const з = массив(settings.tabPinned);
      settings.tabPinned = з.includes(id) ? з.filter(x => x !== id) : [...з, id];
      // Закреплённое должно быть видно.
      settings.tabHidden = массив(settings.tabHidden).filter(x => x !== id || з.includes(id));
    } else if (дело === 'hide') {
      const с = массив(settings.tabHidden);
      settings.tabHidden = с.includes(id) ? с.filter(x => x !== id) : [...с, id];
      if (!с.includes(id)) settings.tabPinned = массив(settings.tabPinned).filter(x => x !== id);
    } else if (дело === 'off') {
      const в = ВКЛАДКИ.find(x => x.id === id);
      if (в && в.enable) settings[в.enable] = false;
    }
    основа.saveSettings();
    применить();
  });

  // Перетаскивание за ручку.
  let тянем = null;
  окно.addEventListener('pointerdown', (e) => {
    const ручка = e.target.closest && e.target.closest('.hud-ct-handle');
    if (!ручка) return;
    const ряд = ручка.closest('.hud-ct-row');
    e.preventDefault();
    try { ручка.setPointerCapture(e.pointerId); } catch (_) { /* старый браузер */ }
    тянем = { ряд, ручка, id: e.pointerId };
    ряд.classList.add('is-dragging');
  });
  окно.addEventListener('pointermove', (e) => {
    if (!тянем || e.pointerId !== тянем.id) return;
    const { ряд } = тянем;
    const пред = ряд.previousElementSibling, след = ряд.nextElementSibling;
    if (пред && e.clientY < пред.getBoundingClientRect().top + пред.offsetHeight / 2) ряд.after(пред);
    else if (след && e.clientY > след.getBoundingClientRect().top + след.offsetHeight / 2) ряд.before(след);
  });
  const отпустить = (e) => {
    if (!тянем || e.pointerId !== тянем.id) return;
    тянем.ряд.classList.remove('is-dragging');
    тянем = null;
    const порядок = [...окно.querySelectorAll('.hud-ct-list .hud-ct-row')].map(р => р.dataset.id);
    сохранитьПорядок(порядок, основа, () => {});
    применить();
  };
  окно.addEventListener('pointerup', отпустить);
  окно.addEventListener('pointercancel', отпустить);
}
