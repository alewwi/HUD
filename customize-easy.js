// hud-manager/customize-easy.js
//
// Окно «Кастомизация» для того, кто открыл его впервые: то же, что
// settings-easy.js делает для настроек расширения.
// — «?» у каждого ряда с пояснением: текст раскрывается под рядом. Подсказки
//   мыши (title) на телефоне не видны, а пояснения у рядов длинные.
// — Поиск по окну: ряды, цвета «Системы цветов», готовые темы. Находит и то,
//   что лежит за «Подробно»: на время поиска блок раскрыт, потом — как был.
// «?» стоит рядом с подписью, а не внутри неё: подпись ряда читает переход
// «нажми на пример → покажу настройку» (customize-links.js).
// Панель пересобирается при каждом открытии окна (customize.js) — разметка
// ставится заново на каждую сборку, обработчики — один раз на панель.
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { т } from './i18n.js?v=23.89.86';

const РЯДЫ = '.hud-theme-row[title]';
const ПУНКТЫ = '.hud-theme-row, .hud-role, .hud-theme-preset, .hud-theme-packs > label, .hud-pset-row, .hud-ct-row';
const норм = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

function разметитьПояснения(панель) {
  for (const ряд of панель.querySelectorAll(РЯДЫ)) {
    if (ряд.querySelector(':scope > .hud-custom-q')) continue;
    const метка = ряд.querySelector(':scope > label');
    const кнопка = '<button type="button" class="hud-custom-q" aria-expanded="false" aria-label="Что это" title="Что это">?</button>';
    if (метка) метка.insertAdjacentHTML('afterend', кнопка); else ряд.insertAdjacentHTML('afterbegin', кнопка);
  }
}
function переключитьПояснение(кнопка) {
  const ряд = кнопка.closest('.hud-theme-row');
  if (!ряд) return;
  let текст = ряд.nextElementSibling;
  if (!текст || !текст.classList.contains('hud-custom-hint')) {
    текст = document.createElement('div');
    текст.className = 'hud-custom-hint';
    текст.hidden = true;
    // Из title сейчас: он уже на языке интерфейса.
    текст.textContent = ряд.getAttribute('title') || '';
    ряд.after(текст);
  }
  текст.hidden = !текст.hidden;
  кнопка.setAttribute('aria-expanded', String(!текст.hidden));
  кнопка.classList.toggle('is-open', !текст.hidden);
}

/** Поиск: пустой запрос возвращает окно как было (раскрытые разделы, «Подробно»). */
export function искатьВОкне(панель, запрос) {
  const слова = норм(запрос).trim().split(' ').filter(Boolean);
  const группы = [...панель.querySelectorAll('details')];
  const подробно = панель.querySelector('#hud-custom-detail');
  const итог = панель.querySelector('.hud-custom-found');
  if (!слова.length) {
    панель.classList.remove('hud-custom-searching');
    панель.querySelectorAll('.hud-custom-miss, .hud-custom-hit').forEach(э => э.classList.remove('hud-custom-miss', 'hud-custom-hit'));
    группы.forEach(д => { if (д.dataset.wasOpen !== undefined) { д.open = д.dataset.wasOpen === '1'; delete д.dataset.wasOpen; } });
    if (подробно && подробно.dataset.wasHidden !== undefined) { подробно.hidden = подробно.dataset.wasHidden === '1'; delete подробно.dataset.wasHidden; }
    if (итог) итог.textContent = '';
    return 0;
  }
  if (!панель.classList.contains('hud-custom-searching')) {
    группы.forEach(д => { д.dataset.wasOpen = д.open ? '1' : '0'; });
    if (подробно) подробно.dataset.wasHidden = подробно.hidden ? '1' : '0';
  }
  панель.classList.add('hud-custom-searching');
  if (подробно) подробно.hidden = false;
  let найдено = 0;
  for (const пункт of панель.querySelectorAll(ПУНКТЫ)) {
    if (пункт.closest('.hud-custom-find')) continue;
    const текст = норм(пункт.textContent + ' ' + (пункт.getAttribute('title') || '') + ' ' + [...пункт.querySelectorAll('option')].map(о => о.textContent).join(' '));
    const есть = слова.every(с => текст.includes(с));
    пункт.classList.toggle('hud-custom-hit', есть);
    пункт.classList.toggle('hud-custom-miss', !есть);
    if (есть) найдено++;
  }
  for (const д of группы.reverse()) {
    const есть = !!д.querySelector('.hud-custom-hit');
    д.classList.toggle('hud-custom-miss', !есть);
    if (есть) д.open = true;
  }
  if (итог) итог.textContent = найдено ? `${т('Найдено')}: ${найдено}` : т('Ничего не нашлось');
  return найдено;
}

/** После каждой сборки панели: «?» у рядов; обработчики — один раз. */
export function подключитьЛёгкостьОкна(панель) {
  if (!панель) return;
  try {
    разметитьПояснения(панель);
    if (панель.dataset.easy) return;
    панель.dataset.easy = '1';
    панель.addEventListener('click', (e) => {
      const вопрос = e.target.closest('.hud-custom-q');
      if (!вопрос) return;
      e.preventDefault(); e.stopPropagation();
      переключитьПояснение(вопрос);
    }, true);
    let таймер = 0;
    панель.addEventListener('input', (e) => {
      if (!e.target.matches('.hud-custom-search')) return;
      clearTimeout(таймер);
      таймер = setTimeout(() => искатьВОкне(панель, e.target.value), 120);
    });
    панель.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && e.target.matches('.hud-custom-search') && e.target.value) { e.stopPropagation(); e.target.value = ''; искатьВОкне(панель, ''); }
    }, true);
    // Нажатие в примере ведёт к настройке (customize-links.js): поиск ей не мешает.
    панель.closest('.hud-custom-dialog')?.querySelector('.hud-custom-preview')?.addEventListener('click', () => {
      const поле = панель.querySelector('.hud-custom-search');
      if (поле && поле.value) { поле.value = ''; искатьВОкне(панель, ''); }
    }, true);
  } catch (e) { console.warn('[TavernOS HUD] кастомизация: пояснения и поиск', e); }
}
