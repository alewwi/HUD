// hud-manager/css-loader.js
//
// Части стилей — отдельными <link>, а не цепочкой @import из style.css.
//
// @import грузятся последовательно и держат отрисовку: двадцать файлов —
// двадцать запросов один за другим. <link>, вставленные скриптом, браузер
// тянет параллельно, а порядок каскада задаёт порядок узлов — тот же, что был
// у @import. Порядок здесь — часть устройства, а не вкус: каскад держится на
// нём, перестановка ломает вёрстку молча.
//
// Фичевые файлы грузятся по включённости: выключен бой — combat.css не нужен.
// Включили позже — файл встаёт на своё место в цепочке (между соседями), а не
// в конец, и каскад не меняется.
//
// @layer здесь сознательно не используется: стили Таверны и пользовательский
// CSS — без слоёв, а правило без слоя побеждает любой слой. Обернув HUD в
// @layer, мы отдали бы его на милость любого стиля Таверны.
//
// Стенды (tests/tools) подключают всё разом через css/all.css.

import { settings } from './settings.js?v=23.48.3';

const ВЕРСИЯ = (() => { try { return new URL(import.meta.url).search; } catch (_) { return ''; } })();
const МЕТКА = 'data-hud-css';

// [файл, когда нужен]. Без условия — нужен всегда.
export const ЧАСТИ = [
  ['base'], ['themes'], ['misc'], ['views'], ['views-fields'], ['views-trio'], ['family'], ['family-views'],
  ['extras'], ['deco'], ['scene-body'],
  // В xray.css и шкала темпа (.hud-tempo), не только рентген.
  ['xray', (s) => s.enableTempo !== false],
  ['scene-clock', (s) => s.enableSceneClock !== false],
  ['cycle-libido', (s) => s.enableMenstruation !== false],
  ['secrets-grid', (s) => s.enableMemory !== false && s.secretsGrid !== 'off'],
  ['life', (s) => s.enableLife !== false],
  ['underwear', (s) => s.enableUnderwear !== false],
  ['duel', (s) => s.enableVerbalDuel !== false],
  ['combat', (s) => s.enableCombat !== false],
  ['compact'],
];

const адрес = (имя) => new URL('./css/' + имя + '.css' + ВЕРСИЯ, import.meta.url).href;
function ссылкаСтиля(head) {
  const путь = new URL('./style.css', import.meta.url).pathname;
  return [...head.querySelectorAll('link[rel="stylesheet"]')].find(l => { try { return new URL(l.href).pathname === путь; } catch (_) { return false; } }) || null;
}

/** Нужные части — на свои места; включённое однажды не снимаем (без мигания). */
export function подключитьСтили(s = settings) {
  const head = typeof document !== 'undefined' && document.head;
  if (!head) return [];
  let после = ссылкаСтиля(head);
  const добавлено = [];
  for (const [имя, нужно] of ЧАСТИ) {
    let l = head.querySelector(`link[${МЕТКА}="${имя}"]`);
    if (!l && (!нужно || нужно(s || {}))) {
      l = document.createElement('link');
      l.rel = 'stylesheet';
      l.setAttribute(МЕТКА, имя);
      l.href = адрес(имя);
      if (после && после.parentNode === head) после.after(l); else head.appendChild(l);
      добавлено.push(имя);
    }
    if (l) после = l;
  }
  return добавлено;
}

/** Последний узел стилей HUD — за ним встают файлы темы (themes.js). */
export function последнийСтильHUD(head = document.head) {
  const наши = head ? head.querySelectorAll(`link[${МЕТКА}]`) : [];
  return наши.length ? наши[наши.length - 1] : (head ? ссылкаСтиля(head) : null);
}
