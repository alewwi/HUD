// hud-manager/render/lazy-svg.js
//
// Тяжёлые рисунки — граф отношений и карта тела с историей кадров — вместо
// готового SVG кладут в разметку заготовку. Настоящий рисунок собирается,
// когда заготовка впервые показалась на экране: в свёрнутой карточке, в
// старом сообщении далеко вверху чата или под закрытой вкладкой он не
// строится вовсе.
//
// Ключ заготовки строится из uid карточки: в нём есть baseId, и сравнение
// разметок (hudRenderSignature) его вырезает — повторная отрисовка того же
// HUD даёт ту же разметку.
//
// Без IntersectionObserver (тесты в Node, очень старый браузер) и при
// выключенной «Ленивой загрузке вкладок» рисунок собирается сразу.

import { settings } from '../settings.js?v=23.13.2';

const ЗАГОТОВОК = 300;
const заготовки = new Map();
let наблюдатель = null;
let следящий = null;

export function отложитьРисунок(ключ, собрать, высота = 180) {
  const можно = typeof window !== 'undefined' && typeof window.IntersectionObserver === 'function'
    && typeof document !== 'undefined' && typeof document.createElement === 'function' && settings.lazyTabs !== false;
  if (!можно || !ключ) return собрать();
  ключ = String(ключ).replace(/[^\w-]/g, '_');
  // Та же заготовка при перерисовке — свежая сборка: данные могли смениться.
  заготовки.delete(ключ);
  заготовки.set(ключ, собрать);
  while (заготовки.size > ЗАГОТОВОК) заготовки.delete(заготовки.keys().next().value);
  следить();
  return `<div class="hud-lazy-svg" data-lazy-svg="${ключ}" style="min-height:${высота}px" aria-busy="true"></div>`;
}

// Собрать сразу — например, перед выгрузкой карточки или по клику.
export function собратьРисунок(заготовка) {
  if (!заготовка || !заготовка.isConnected) return;
  const ключ = заготовка.getAttribute('data-lazy-svg');
  const собрать = заготовка.__hudСборка || заготовки.get(ключ);
  if (наблюдатель) наблюдатель.unobserve(заготовка);
  if (!собрать) {
    // Разметку пересобрали из текста (скопировали, сохранили строкой) —
    // собирать не из чего. Пустой блок в полэкрана хуже честной подписи.
    заготовка.removeAttribute('data-lazy-svg');
    заготовка.removeAttribute('aria-busy');
    заготовка.style.minHeight = '';
    заготовка.classList.add('is-lost');
    заготовка.textContent = 'Рисунок появится после перерисовки карточки';
    return;
  }
  try {
    const коробка = document.createElement('div');
    коробка.innerHTML = собрать();
    const рисунок = коробка.childNodes.length === 1 ? коробка.firstChild : коробка;
    if (рисунок === коробка) коробка.className = 'hud-lazy-svg-done';
    заготовка.replaceWith(рисунок);
  } catch (e) {
    console.warn('[TavernOS HUD] рисунок не собрался:', e);
    заготовка.removeAttribute('aria-busy');
    заготовка.style.minHeight = '';
  }
}

export function собратьВсе(корень = document) {
  if (!корень || typeof корень.querySelectorAll !== 'function') return;
  корень.querySelectorAll('[data-lazy-svg]').forEach(собратьРисунок);
}

// Заготовка в документе забирает свою сборку себе: общий реестр ограничен,
// а карточка может пролежать свёрнутой («облегчённой», events.js) сколько
// угодно — её узлы вернутся те же, и сборка вместе с ними.
function взять(з) {
  const ключ = з.getAttribute('data-lazy-svg');
  if (!з.__hudСборка && заготовки.has(ключ)) { з.__hudСборка = заготовки.get(ключ); заготовки.delete(ключ); }
  наблюдатель.observe(з);
}
function осмотреть(узел) {
  if (!наблюдатель || !узел || узел.nodeType !== 1) return;
  if (узел.matches && узел.matches('[data-lazy-svg]')) взять(узел);
  if (узел.querySelectorAll) узел.querySelectorAll('[data-lazy-svg]').forEach(взять);
}

// Наблюдатели заводятся один раз, при первой заготовке. Новые заготовки
// ловим по вставке в документ: разметку HUD вставляют в нескольких местах
// (чат, ленивые вкладки, пример в «Кастомизации»), и звать отсюда каждое —
// хрупко.
function следить() {
  if (наблюдатель || typeof document === 'undefined' || !document.body) return;
  наблюдатель = new IntersectionObserver((записи) => {
    for (const з of записи) if (з.isIntersecting) собратьРисунок(з.target);
  }, { rootMargin: '300px 0px' });
  следящий = new MutationObserver((изменения) => {
    for (const и of изменения) for (const узел of и.addedNodes) осмотреть(узел);
  });
  следящий.observe(document.body, { childList: true, subtree: true });
  // То, что уже вставлено до появления наблюдателей.
  setTimeout(() => осмотреть(document.body), 0);
}
