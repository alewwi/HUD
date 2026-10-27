// hud-manager/customize-detail.js
//
// Окно кастомизации: «основное» сверху, тонкие разделы — за кнопкой
// «Подробно», и значки контраста у цветовых полей.
//
// Разметка спрятанных разделов остаётся в DOM всегда (атрибут hidden), а не
// рисуется по требованию: обработчики полей, живой просмотр, «Шаг назад»,
// снятьПрокрутки/вернутьПрокрутки и guardTouchSwipe ищут поля по data-key, и
// спрятанные поля им по-прежнему доступны. Любой сбой здесь оставляет окно
// плоским, как раньше: окно должно открываться всегда.

import { settings } from './settings.js?v=23.81.0';
import { текстНаКарточке, значокКонтраста, худшийКонтраст, фоныКарточки, подложкаЧата, разобратьЦвет, наложить, вHex } from './contrast.js?v=23.81.0';

// Какие разделы уходят под «Подробно» — по data-sec из customize.js.
// Перенести раздел между основным и подробным — одна правка здесь.
export const ПОДРОБНО_РАЗДЕЛЫ = ['colors', 'memory', 'phone', 'bars', 'weather', 'intercepts', 'drama', 'fonts'];

const ID = 'hud-custom-detail';
const склонение = (n, [один, два, пять]) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? один : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? два : пять;
};
export const подписьПодробно = (n) => `Подробно · ${n} ${склонение(n, ['настройка', 'настройки', 'настроек'])}`;

/** Число настроек внутри узла: уникальные data-key (одно поле бывает дважды). */
export const сколькоНастроек = (узел) => new Set([...узел.querySelectorAll('[data-key]')].map(п => п.dataset.key)).size;

/** Раскладывает панель: разделы ПОДРОБНО_РАЗДЕЛЫ — в спрятанный блок за кнопкой. */
export function разложитьПодробно(панель, { открыто = settings.customDetailOpen === true, режим = settings.customDetailMode } = {}) {
  if (!панель || режим === 'flat') return null;
  try {
    const разделы = ПОДРОБНО_РАЗДЕЛЫ.map(id => панель.querySelector(`:scope > [data-sec="${id}"]`)).filter(Boolean);
    if (!разделы.length || панель.querySelector('#' + ID)) return null;
    const блок = document.createElement('div');
    блок.id = ID;
    блок.className = 'hud-custom-detail';
    блок.setAttribute('role', 'region');
    блок.setAttribute('aria-label', 'Подробные настройки');
    const кнопка = document.createElement('button');
    кнопка.type = 'button';
    кнопка.className = 'hud-detail-toggle';
    кнопка.setAttribute('aria-controls', ID);
    // Блок встаёт туда, где стоял первый из перенесённых разделов.
    разделы[0].before(кнопка);
    кнопка.after(блок);
    разделы.forEach(р => блок.appendChild(р));
    кнопка.innerHTML = `<span class="hud-detail-toggle-text">${подписьПодробно(сколькоНастроек(блок))}</span><span class="hud-detail-toggle-chev" aria-hidden="true"></span>`;
    задатьОткрыто(панель, открыто);
    return блок;
  } catch (e) {
    console.error('[HUD] «Подробно» не разложилось, окно остаётся плоским:', e);
    // Вернуть разделы на место, если успели перенести.
    try {
      const блок = панель.querySelector('#' + ID), кнопка = панель.querySelector('.hud-detail-toggle');
      if (блок) { [...блок.children].forEach(р => блок.before(р)); блок.remove(); }
      if (кнопка) кнопка.remove();
    } catch (_) { /* как есть */ }
    return null;
  }
}

export function задатьОткрыто(панель, открыто) {
  const блок = панель && панель.querySelector('#' + ID);
  const кнопка = панель && панель.querySelector('.hud-detail-toggle');
  if (!блок || !кнопка) return;
  блок.hidden = !открыто;
  кнопка.setAttribute('aria-expanded', String(!!открыто));
  кнопка.classList.toggle('is-open', !!открыто);
}

/** Нажатие на кнопку «Подробно»: переключить и запомнить. */
export function переключитьПодробно(кнопка, сохранить) {
  const панель = кнопка.parentElement;
  const открыто = кнопка.getAttribute('aria-expanded') !== 'true';
  задатьОткрыто(панель, открыто);
  settings.customDetailOpen = открыто;
  if (typeof сохранить === 'function') сохранить();
}

// --- Значки контраста ------------------------------------------------------
// Пары «цвет ↔ фон». Фон карточки — оба конца градиента с прозрачностью
// поверх подложки чата; у часов — верхняя панель поверх карточки.
export const ПАРЫ_КОНТРАСТА = {
  accentColor: 'card', textColor: 'card', textMutedColor: 'card',
  dramaColor: 'card', memoryAccent: 'card', nsfwColor: 'card', clockColor: 'topbar',
};

function фоныДля(вид, s, подложка) {
  const карточка = фоныКарточки(s, подложка);
  if (вид !== 'topbar') return карточка;
  const верх = разобратьЦвет(s.topBarBg);
  if (!верх) return карточка;
  const альфа = Math.max(0, Math.min(100, Number(s.topBarAlpha ?? 100))) / 100;
  return карточка.map(ф => вHex(наложить({ ...верх, a: верх.a * альфа }, разобратьЦвет(ф))));
}

/** Состояние значка для ключа настройки. */
export function состояниеЗначка(ключ, s = settings, подложка = подложкаЧата()) {
  const вид = ПАРЫ_КОНТРАСТА[ключ];
  const цвет = s[ключ];
  if (!вид || !цвет || !разобратьЦвет(цвет)) return значокКонтраста(NaN);
  const к = худшийКонтраст(цвет, фоныДля(вид, s, подложка));
  // Подправляется только акцент (--hud-accent-text), остальное — как есть.
  const подправлено = ключ === 'accentColor' && s.autoAccentText !== 'off' ? текстНаКарточке(цвет, s, подложка) : null;
  return значокКонтраста(к, { подправлено: подправлено && подправлено.подправлен ? подправлено : null });
}

/** Значки у всех цветовых полей из ПАРЫ_КОНТРАСТА внутри корня. */
export function обновитьЗначкиКонтраста(корень) {
  if (!корень) return;
  const подложка = подложкаЧата();
  for (const поле of корень.querySelectorAll('input[type="color"][data-key]')) {
    const ключ = поле.dataset.key;
    if (!ПАРЫ_КОНТРАСТА[ключ]) continue;
    const дом = поле.parentElement;
    let знак = дом.querySelector(`:scope > .hud-contrast-badge[data-for="${ключ}"]`);
    if (!знак) {
      знак = document.createElement('span');
      знак.className = 'hud-contrast-badge';
      знак.dataset.for = ключ;
      дом.appendChild(знак);
    }
    const з = состояниеЗначка(ключ, settings, подложка);
    знак.dataset.state = з.состояние;
    знак.textContent = з.текст;
    знак.title = з.подсказка;
    знак.setAttribute('aria-label', з.подсказка);
  }
}
