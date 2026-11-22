// hud-manager/settings-easy.js
//
// Настройки HUD для того, кто открыл их впервые.
//
// Панель выросла до полутора сотен пунктов, и новичок тонул в ней:
// всё включено сразу, пояснения только в подсказках мыши (на телефоне их
// не видно), главные решения спрятаны глубоко, слова — из кода. Здесь то,
// что ложится поверх панели (settings-ui.js) и не трогает ни одного
// обработчика: все галки по-прежнему сохраняются своими обработчиками.
//
// — Быстрый старт: сколько HUD (лёгкий, обычный, полный), 18+, какая модель
//   и как HUD появляется. Каждый выбор — набор настроек, которые ставятся
//   через те же поля панели (событие change), поэтому всё, что делает сама
//   галка, делается и тут.
// — Пояснения по нажатию: у каждого пункта с пояснением — кнопка «?»,
//   она раскрывает текст прямо под пунктом. На телефоне подсказок мыши нет.
// — Поиск по настройкам и режим «Основные / Все»: в «Основных» тонкая
//   настройка спрятана, поиск находит и её.
// — Зависимые настройки: сдвинуты под свою главную и бледнеют, пока она
//   выключена (кубик угрозы без беременности не значит ничего).
// — Цена блока: сколько токенов он добавляет к инструкции HUD.
// TavernOS HUD © 2026 alewwi — https://github.com/alewwi/HUD — GNU AGPL-3.0, see LICENSE and NOTICE.md.

import { settings, defaultSettings } from './settings.js?v=23.89.82';
import { escapeHtml } from './utils.js?v=23.89.82';
import { оценкаТокенов, коротко } from './token-budget.js?v=23.89.82';
import { т } from './i18n.js?v=23.89.82';

// --- Сколько HUD ---------------------------------------------------------------
// [ключ, поле в панели, лёгкий, обычный]. Полный — заводские значения.
// Только то, что стоит токенов: вид на экране (дерево, часы сцены) не трогаем.
export const РАЗМЕР_HUD = [
  ['enablePhone', 'hud-enable-phone', false, true], ['enableCasket', 'hud-enable-casket', false, true],
  ['enableIntercepts', 'hud-enable-intercepts', false, false], ['enableOverheard', 'hud-enable-overheard', false, false],
  ['enableMemory', 'hud-enable-memory', true, true], ['enableGuns', 'hud-enable-guns', true, true], ['promisesList', 'hud-promises', true, true],
  ['enableDeadlines', 'hud-enable-deadlines', false, true], ['enableTwists', 'hud-enable-twists', false, true], ['enableInvitations', 'hud-enable-invites', false, true],
  ['betsList', 'hud-bets', false, false], ['consequences', 'hud-consequences', false, true],
  ['enableUserBlock', 'hud-enable-user', true, true], ['enableCompanions', 'hud-enable-companions', false, true], ['enableScars', 'hud-enable-scars', false, true],
  ['enableNeglect', 'hud-enable-neglect', false, true], ['enableWeight', 'hud-enable-weight', false, false],
  ['enableIllness', 'hud-enable-illness', true, true], ['enableBodyState', 'hud-enable-bodystate', true, true],
  ['enableLife', 'hud-enable-life', false, true], ['enableCombat', 'hud-enable-combat', true, true], ['enableVerbalDuel', 'hud-enable-duel', false, true],
  ['enableDiary', 'hud-enable-diary', false, true], ['enableDreams', 'hud-enable-dreams', false, false],
  ['enableWorld', 'hud-enable-world', false, true], ['enableEconomy', 'hud-enable-economy', false, false], ['enableEvents', 'hud-enable-events', false, false],
  ['enableCity', 'hud-enable-city', false, false], ['enableHoroscope', 'hud-enable-horoscope', false, false], ['meanwhile', 'hud-meanwhile', false, false],
  ['factions', 'hud-factions', 'off', 'off'], ['enableEraHolidays', 'hud-enable-era-holidays', false, true], ['holidayGen', 'hud-holiday-gen', false, true],
];
const УРОВНИ = ['light', 'normal', 'full'];
const значениеУровня = (с, уровень) => (уровень === 'light' ? с[2] : уровень === 'normal' ? с[3] : defaultSettings[с[0]]);
/** Пары [ключ, поле, значение] уровня. */
export function наборУровня(уровень) { return РАЗМЕР_HUD.map(с => [с[0], с[1], значениеУровня(с, уровень)]); }
const совпадает = (а, б) => String(а) === String(б);
const сейчас = (ключ) => (settings[ключ] === undefined ? defaultSettings[ключ] : settings[ключ]);
/** Какой уровень стоит сейчас: light, normal, full или custom — блоки выбраны руками. */
export function уровеньСейчас(s = settings) {
  const з = (к) => (s[к] === undefined ? defaultSettings[к] : s[к]);
  return УРОВНИ.find(у => РАЗМЕР_HUD.every(с => совпадает(з(с[0]), значениеУровня(с, у)))) || 'custom';
}

// --- 18+, модель, как HUD появляется -------------------------------------------------
export const НАБОРЫ = {
  adult: {
    yes: [['nsfwPrompt', 'hud-nsfw-prompt', 'auto'], ['enableIntimacyExtras', 'hud-enable-intimacy-extras', true], ['enableTempo', 'hud-enable-tempo', true]],
    no: [['nsfwPrompt', 'hud-nsfw-prompt', 'never'], ['enableIntimacyExtras', 'hud-enable-intimacy-extras', false], ['enableTempo', 'hud-enable-tempo', false], ['enableUnderwear', 'hud-enable-underwear', false]],
  },
  model: {
    big: [['hudCompact', 'hud-compact', false], ['hudCompleteCheck', 'hud-complete-check', 'regen']],
    small: [['hudCompact', 'hud-compact', true], ['hudCompleteCheck', 'hud-complete-check', 'warn']],
  },
};
export function выборСейчас(что, s = settings) {
  const з = (к) => (s[к] === undefined ? defaultSettings[к] : s[к]);
  if (что === 'level') return уровеньСейчас(s);
  if (что === 'adult') return з('nsfwPrompt') === 'never' ? 'no' : 'yes';
  if (что === 'model') return з('hudCompact') === true ? 'small' : 'big';
  if (что === 'appear') return з('autoInject') ? 'with' : з('hudSeparate') ? 'after' : 'button';
  return '';
}

// --- Разметка ----------------------------------------------------------------------
const ВАРИАНТЫ = {
  level: [
    ['light', 'Лёгкий', 'Главное для истории: персонажи, их тело и здоровье, память и нити сюжета, бой. Без телефона, мира, быта и дневника. Для слабых и локальных моделей и для тех, кто бережёт токены.'],
    ['normal', 'Обычный', 'То, чем пользуются чаще всего: к лёгкому добавляются телефон (в средневековье — шкатулка), мир с новостями, быт, дневник, спутники, повороты и споры. Без гороскопа, экономики, афиши, снов и перехватов.'],
    ['full', 'Полный', 'Все блоки, как задумано: самый подробный HUD и самый дорогой. Нужна сильная модель с большим контекстом.'],
  ],
  adult: [
    ['yes', 'Да', 'Сцены близости с подробностями: поза, темп, следы на теле. Правила близости уходят модели, только когда сцена идёт.'],
    ['no', 'Нет', 'Ничего о близости: модель не получает этих правил, блоки близости выключены.'],
  ],
  model: [
    ['big', 'Сильная облачная', 'GPT, Claude, Gemini, DeepSeek и похожие: пишут длинный HUD без ошибок. Поля пишутся подробно, а неполный HUD досоздаётся сам.'],
    ['small', 'Слабая или локальная', 'Локальные и небольшие облачные модели: поля пишутся коротко, в пределах размера («Сжатые значения»), а неполный HUD только отмечается предупреждением, без лишних запросов. Лучше вместе с «Лёгким».'],
  ],
  appear: [
    ['with', 'Вместе с ответом', 'Модель пишет HUD в том же ответе, что и историю. Проще всего и без лишних запросов.'],
    ['after', 'Отдельно после ответа', 'После каждого ответа HUD пишется отдельным запросом. Историю может вести одна модель, а HUD — другая, подешевле: профиль выбирается в «Как HUD получается → Перегенерация HUD».'],
    ['button', 'Только по кнопке', 'Ответы приходят без HUD, а под каждым — кнопка «➕ Создать HUD». HUD пишется, только когда вы её нажмёте.'],
  ],
};
const ЗАГОЛОВКИ = { level: '📦 Сколько HUD', adult: '🔞 Сцены 18+', model: '🧠 Какая модель', appear: '🔌 Как появляется HUD' };

function ряд(что) {
  const выбран = выборСейчас(что);
  const кнопки = ВАРИАНТЫ[что].map(([v, имя, пояснение]) =>
    `<button type="button" class="hud-qs-opt" data-qs="${что}" data-v="${v}" title="${escapeHtml(пояснение)}" aria-pressed="${выбран === v}">${escapeHtml(имя)}${что === 'level' ? '<small class="hud-qs-cost" data-qs-cost="' + v + '"></small>' : ''}</button>`).join('');
  return `<div class="hud-qs-row" data-qs-row="${что}"><div class="hud-qs-name">${ЗАГОЛОВКИ[что]}</div>`
    + `<div class="hud-qs-seg" role="group" aria-label="${escapeHtml(ЗАГОЛОВКИ[что].replace(/^\S+\s/, ''))}">${кнопки}</div>`
    + `<div class="hud-qs-note" data-qs-note="${что}">${escapeHtml(пояснениеВыбора(что))}</div></div>`;
}
function пояснениеВыбора(что) {
  const выбран = выборСейчас(что);
  if (что === 'level' && выбран === 'custom') return 'Сейчас — своё: блоки выбраны вручную, в «Что показывает HUD». Нажмите любой вариант, чтобы поставить его набор.';
  return (ВАРИАНТЫ[что].find(в => в[0] === выбран) || [])[2] || '';
}

/** Ряды быстрого старта (кроме мира: его поля — в settings-ui.js). */
export function разметкаБыстрогоСтарта() {
  return ряд('level') + ряд('adult') + ряд('model') + ряд('appear')
    + `<div class="hud-set-note">KoboldCpp или другой Text Completion с кэшем контекста: включите ещё «Не сбивать кэш KoboldCpp». <button type="button" class="hud-qs-go" data-qs-go="hud-cache-stable" title="Показать эту настройку">Показать</button></div>`;
}

/** Поиск и режим «Основные / Все» — над всеми разделами. */
export function разметкаВерха() {
  const вид = settings.settingsView === 'simple' ? 'simple' : 'all';
  return `<div class="hud-set-top" data-guide-skip>
    <input type="search" id="hud-set-search" class="hud-set-search" placeholder="🔍 Найти настройку" aria-label="Найти настройку" autocomplete="off">
    <div class="hud-qs-seg hud-set-view" role="group" aria-label="Какие настройки показывать">
      <button type="button" class="hud-qs-opt" data-view="simple" aria-pressed="${вид === 'simple'}" title="Только то, что нужно для начала: тонкая настройка спрятана. Поиск находит и её.">Основные</button>
      <button type="button" class="hud-qs-opt" data-view="all" aria-pressed="${вид === 'all'}" title="Все настройки HUD, включая тонкую настройку для опытных">Все</button>
    </div>
    <div class="hud-set-found" aria-live="polite"></div>
  </div>`;
}

// --- Применение ---------------------------------------------------------------------
// Значение — в настройки и в поле панели, и одно сохранение на весь набор:
// событие на каждое поле значило бы три десятка сохранений подряд, а каждое
// пишет все настройки (с картинками — мегабайты). Поля из «событий» —
// те, чей обработчик делает больше, чем сохраняет (счётчики сжатия, «одно
// из двух»): им — событие change, и сохраняют они сами.
function поставить(пары, основа, { события = [] } = {}) {
  let сохранить = false;
  for (const [ключ, id, значение] of пары) {
    const поле = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (поле && события.includes(id)) {
      const вПоле = поле.type === 'checkbox' ? поле.checked === !!значение : поле.value === String(значение);
      if (вПоле && String(сейчас(ключ)) === String(значение)) continue;
      if (поле.type === 'checkbox') поле.checked = !!значение; else поле.value = String(значение);
      поле.dispatchEvent(new Event('change', { bubbles: true }));
      continue;
    }
    if (поле) { if (поле.type === 'checkbox') поле.checked = !!значение; else поле.value = String(значение); }
    if (String(сейчас(ключ)) !== String(значение)) сохранить = true;
    settings[ключ] = значение;
  }
  if (сохранить) основа?.saveSettings?.();
}

export function применитьВыбор(что, v, основа) {
  if (что === 'level') { if (УРОВНИ.includes(v)) поставить(наборУровня(v), основа); }
  else if (что === 'adult') {
    // «Да» не сбивает «Всегда», если оно уже стоит.
    const пары = НАБОРЫ.adult[v];
    if (!пары) return;
    поставить(v === 'yes' && сейчас('nsfwPrompt') === 'always' ? пары.filter(п => п[0] !== 'nsfwPrompt') : пары, основа);
  } else if (что === 'model') { if (НАБОРЫ.model[v]) поставить(НАБОРЫ.model[v], основа, { события: ['hud-compact'] }); }
  else if (что === 'appear') {
    // Обработчики самих галок держат «одно из двух» и говорят, что выключилось.
    const события = { события: ['hud-auto-inject', 'hud-separate'] };
    if (v === 'with') поставить([['autoInject', 'hud-auto-inject', true]], основа, события);
    else if (v === 'after') поставить([['hudSeparate', 'hud-separate', true], ['autoInject', 'hud-auto-inject', false]], основа, события);
    else if (v === 'button') поставить([['autoInject', 'hud-auto-inject', false], ['hudSeparate', 'hud-separate', false]], основа, события);
  }
}

/**
 * Первый запуск (настроек нет ни в браузере, ни в settings.json): обычный HUD
 * и «Основные». Отметка hudFirstRun: до первой синхронизации эти значения не
 * свои, а заводские — копия с другого устройства, если она есть, их перебьёт
 * (settings-sync.js), а не они её.
 */
export function первыйЗапуск(s = settings) {
  for (const [ключ, , значение] of наборУровня('normal')) s[ключ] = значение;
  s.settingsView = 'simple';
  s.hudFirstRun = true;
}

// --- Зависимые настройки ----------------------------------------------------------------
// [зависимое поле, главная галка, сдвигать ли под неё]. Сдвигаются стоящие
// сразу под главной; остальные только бледнеют, пока главная выключена.
export const ЗАВИСИМЫЕ = [
  ['hud-secrets-grid', 'hud-enable-memory', 1], ['hud-secrets-raise', 'hud-enable-memory', 1], ['hud-enable-guns', 'hud-enable-memory', 1],
  ['hud-enable-deadlines', 'hud-enable-guns', 1], ['hud-promises', 'hud-enable-memory', 1],
  ['hud-family-depth', 'hud-enable-familytree', 1],
  ['hud-user-all-fields', 'hud-enable-user', 1],
  ['hud-cycle-libido', 'hud-enable-menstruation', 1],
  ['hud-preg-serious', 'hud-enable-pregnancy', 1], ['hud-preg-reveal', 'hud-enable-pregnancy', 1], ['hud-enable-exams', 'hud-enable-pregnancy', 1],
  ['hud-enable-threat', 'hud-enable-pregnancy', 1], ['hud-enable-loss', 'hud-enable-pregnancy', 1], ['hud-enable-babies', 'hud-enable-pregnancy', 1],
  ['hud-baby-years', 'hud-enable-babies', 1], ['hud-baby-facts', 'hud-enable-babies', 1],
  ['hud-life-to-model', 'hud-enable-life', 1], ['hud-sleep-norm', 'hud-enable-life', 1], ['hud-consistency-check', 'hud-enable-life', 0],
  ['hud-combat-prompt', 'hud-enable-combat', 1],
  ['hud-enable-economy', 'hud-enable-world', 1], ['hud-enable-events', 'hud-enable-world', 1], ['hud-factions', 'hud-enable-world', 1],
  ['hud-enable-city', 'hud-enable-world', 1], ['hud-enable-horoscope', 'hud-enable-world', 1],
  ['hud-holiday-reminder', 'hud-holiday-gen', 1], ['hud-holiday-prep', 'hud-holiday-gen', 1],
  ['hud-carry-turns', 'hud-carry-over', 1],
  ['hud-virtualize', 'hud-performance-mode', 1],
  ['hud-music-source', 'hud-music-player', 1], ['hud-music-search-ne', 'hud-music-verify', 1], ['hud-music-search-qq', 'hud-music-verify', 1],
  ...['hud-music-auto', 'hud-music-profile', 'hud-music-timeout', 'hud-music-tokens', 'hud-music-medieval', 'hud-music-style', 'hud-music-player', 'hud-music-verify', 'hud-music-line'].map(id => [id, 'hud-music-enable', 0]),
  ...['hud-ask-messages', 'hud-ask-hud', 'hud-ask-note', 'hud-ask-card', 'hud-ask-persona', 'hud-ask-lore-all', 'hud-ask-profile', 'hud-ask-tokens'].map(id => [id, 'hud-enable-assistant', 0]),
];
// Что занимает зависимое поле в панели: его строка или ряд чипов.
const местоПоля = (поле) => поле && (поле.closest('.hud-set-apps') || поле.closest('label') || поле);
const включена = (поле) => !!поле && поле.checked && !поле.closest('.hud-set-dep-off');

export function обновитьЗависимые(корень) {
  if (!корень) return;
  // Порядок важен: главная, сама зависимая (дети детей) — проходим, пока меняется.
  for (let круг = 0; круг < 3; круг++) {
    let изменилось = false;
    for (const [id, главнаяId] of ЗАВИСИМЫЕ) {
      const место = местоПоля(корень.querySelector('#' + id)), главная = корень.querySelector('#' + главнаяId);
      if (!место || !главная) continue;
      const выкл = !включена(главная);
      if (место.classList.contains('hud-set-dep-off') !== выкл) { место.classList.toggle('hud-set-dep-off', выкл); изменилось = true; }
    }
    if (!изменилось) break;
  }
}
function разметитьЗависимые(корень) {
  for (const [id, главнаяId, сдвиг] of ЗАВИСИМЫЕ) {
    const место = местоПоля(корень.querySelector('#' + id));
    if (!место) continue;
    if (сдвиг) место.classList.add('hud-set-dep');
    // Ряд чипов за главной галкой (экраны телефона, ходы назад) — вместе с ней.
    место.dataset.depOn = главнаяId;
  }
  // Экраны телефона и шкатулки — за своей галкой.
  for (const [главнаяId, ключ] of [['hud-enable-phone', 'phoneAppMessages'], ['hud-enable-casket', 'castAppLetters']]) {
    const ряд = корень.querySelector(`[data-phone-app-key="${ключ}"]`)?.closest('.hud-set-apps');
    if (ряд) { ряд.classList.add('hud-set-dep'); ЗАВИСИМЫЕ_РЯДЫ.set(ряд, главнаяId); }
  }
}
const ЗАВИСИМЫЕ_РЯДЫ = new Map();
function обновитьРяды(корень) {
  for (const [ряд, главнаяId] of ЗАВИСИМЫЕ_РЯДЫ) {
    if (!ряд.isConnected) { ЗАВИСИМЫЕ_РЯДЫ.delete(ряд); continue; }
    ряд.classList.toggle('hud-set-dep-off', !включена(корень.querySelector('#' + главнаяId)));
  }
}

// --- Тонкая настройка: спрятана в «Основных» ---------------------------------------------------
export const ТОНКИЕ = ['hud-secrets-grid', 'hud-secrets-raise', 'hud-family-depth', 'hud-enable-invites', 'hud-enable-deadlines', 'hud-cycle-libido',
  'hud-preg-serious', 'hud-preg-reveal', 'hud-enable-exams', 'hud-enable-threat', 'hud-enable-loss', 'hud-baby-years', 'hud-baby-facts',
  'hud-life-to-model', 'hud-sleep-norm', 'hud-nsfw-prompt', 'hud-enable-rest', 'hud-enable-sceneclock', 'hud-combat-prompt',
  'hud-holiday-reminder', 'hud-holiday-prep', 'hud-powers-body', 'hud-knowledge-line', 'hud-trust-locks', 'hud-user-all-fields',
  'hud-table-lang-values', 'hud-wind-unit', 'hud-chat-translation', 'hud-summary-cards', 'hud-memory-max-height', 'hud-tab-max-height',
  'hud-enable-attn', 'hud-enable-hints', 'hud-music-profile', 'hud-music-timeout', 'hud-music-tokens', 'hud-music-medieval', 'hud-music-style',
  'hud-music-verify', 'hud-music-search-ne', 'hud-music-search-qq', 'hud-music-line'];
function разметитьТонкие(корень) {
  for (const id of ТОНКИЕ) местоПоля(корень.querySelector('#' + id))?.classList.add('hud-set-adv');
  корень.querySelector('.hud-set-lang-file')?.classList.add('hud-set-adv');
  корень.querySelector('#hud-fine')?.classList.add('hud-set-adv');
}

// --- Пояснения по нажатию -------------------------------------------------------------------
function разметитьПояснения(корень) {
  for (const пункт of корень.querySelectorAll('label.hud-set-check[title], div.hud-set-check[title]')) {
    if (пункт.querySelector(':scope > .hud-set-q')) continue;
    пункт.classList.add('hud-set-hasq');
    пункт.insertAdjacentHTML('beforeend', '<button type="button" class="hud-set-q" aria-expanded="false" aria-label="Что это" title="Что это">?</button>');
  }
}
function переключитьПояснение(кнопка) {
  const пункт = кнопка.closest('.hud-set-check');
  if (!пункт) return;
  let текст = пункт.nextElementSibling;
  if (!текст || !текст.classList.contains('hud-set-hint')) {
    текст = document.createElement('div');
    текст.className = 'hud-set-hint';
    текст.hidden = true;
    // Пояснение берём из title сейчас: так оно уже на языке интерфейса.
    текст.textContent = пункт.getAttribute('title') || '';
    if (пункт.classList.contains('hud-set-dep')) текст.classList.add('hud-set-dep');
    пункт.after(текст);
  }
  текст.hidden = !текст.hidden;
  кнопка.setAttribute('aria-expanded', String(!текст.hidden));
  кнопка.classList.toggle('is-open', !текст.hidden);
}

// --- Поиск ------------------------------------------------------------------------------------
const ПУНКТЫ = 'label.hud-set-check, div.hud-set-check, .hud-set-apps > label, .hud-set-apps > button, .hud-qs-row, .hud-set-tools > button';
const норм = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
function искать(корень, запрос) {
  const слова = норм(запрос).trim().split(' ').filter(Boolean);
  const группы = [...корень.querySelectorAll('details.hud-set-group')];
  const итог = корень.querySelector('.hud-set-found');
  if (!слова.length) {
    корень.classList.remove('hud-set-searching');
    корень.querySelectorAll('.hud-set-miss, .hud-set-hit').forEach(э => э.classList.remove('hud-set-miss', 'hud-set-hit'));
    группы.forEach(д => { if (д.dataset.wasOpen !== undefined) { д.open = д.dataset.wasOpen === '1'; delete д.dataset.wasOpen; } });
    if (итог) итог.textContent = '';
    return;
  }
  if (!корень.classList.contains('hud-set-searching')) группы.forEach(д => { д.dataset.wasOpen = д.open ? '1' : '0'; });
  корень.classList.add('hud-set-searching');
  let найдено = 0;
  for (const пункт of корень.querySelectorAll(ПУНКТЫ)) {
    if (пункт.closest('.hud-set-top')) continue;
    const текст = норм(пункт.textContent + ' ' + (пункт.getAttribute('title') || '') + ' ' + [...пункт.querySelectorAll('option')].map(о => о.textContent).join(' '));
    const есть = слова.every(с => текст.includes(с));
    пункт.classList.toggle('hud-set-hit', есть);
    пункт.classList.toggle('hud-set-miss', !есть);
    if (есть) найдено++;
  }
  // Группа видна и раскрыта, если в ней что-то нашлось; изнутри наружу.
  for (const д of группы.reverse()) {
    const есть = !!д.querySelector('.hud-set-hit') || норм(д.querySelector(':scope > summary')?.textContent).includes(слова.join(' '));
    д.classList.toggle('hud-set-miss', !есть);
    if (есть) д.open = true;
  }
  if (итог) итог.textContent = найдено ? `${т('Найдено')}: ${найдено}` : т('Ничего не нашлось');
}

// --- Цена блоков в токенах ---------------------------------------------------------------------
// Ключ раздела → галка. Цена — сколько токенов блок добавляет к инструкции
// HUD; близость и бой считаются так, будто сцена идёт.
const ЦЕНА_ПОЛЕЙ = { enablePhone: 'hud-enable-phone', enableMemory: 'hud-enable-memory', enableWorld: 'hud-enable-world', enableLife: 'hud-enable-life',
  enableDiary: 'hud-enable-diary', enableDreams: 'hud-enable-dreams', enableIntercepts: 'hud-enable-intercepts', enableOverheard: 'hud-enable-overheard',
  enableCasket: 'hud-enable-casket', enableUserBlock: 'hud-enable-user', enablePregnancy: 'hud-enable-pregnancy', enableBabies: 'hud-enable-babies',
  enableIllness: 'hud-enable-illness', enableCompanions: 'hud-enable-companions', enableMenstruation: 'hud-enable-menstruation', enableUnderwear: 'hud-enable-underwear',
  enableIntimacyExtras: 'hud-enable-intimacy-extras', enableVerbalDuel: 'hud-enable-duel', enableHoroscope: 'hud-enable-horoscope', enableEconomy: 'hud-enable-economy',
  enableEvents: 'hud-enable-events', enableCity: 'hud-enable-city', enableGuns: 'hud-enable-guns', enableBodyState: 'hud-enable-bodystate', enableTwists: 'hud-enable-twists',
  enableCombat: 'hud-enable-combat' };
/**
 * Цены: { блоки: {ключ: токены}, уровни: {light, normal, full} }. собрать(опции)
 * — buildDynamicPrompt. Настройки меняются на время подсчёта и возвращаются.
 */
// Каждый шаг — целиком в одном такте: настройки подменяются, инструкция
// собирается, и настройки возвращаются, прежде чем отдать управление. Между
// шагами никто не увидит (и не сохранит) подменённых значений.
function шагиЦен(собрать, токены) {
  const ключи = [...new Set([...Object.keys(ЦЕНА_ПОЛЕЙ), ...РАЗМЕР_HUD.map(с => с[0])])];
  const вернуть = (было) => { for (const к of ключи) { if (было[к] === undefined) delete settings[к]; else settings[к] = было[к]; } };
  const подменить = (шаг) => () => { const было = Object.fromEntries(ключи.map(к => [к, settings[к]])); try { шаг(); } finally { вернуть(было); } };
  const блоки = {}, уровни = {};
  const шаги = Object.keys(ЦЕНА_ПОЛЕЙ).map(ключ => подменить(() => {
    settings[ключ] = true; const с = токены(собрать({ nsfw: true, бой: true }));
    settings[ключ] = false; const без = токены(собрать({ nsfw: true, бой: true }));
    блоки[ключ] = Math.max(0, с - без);
  })).concat(УРОВНИ.map(у => подменить(() => {
    for (const [ключ, , значение] of наборУровня(у)) settings[ключ] = значение;
    уровни[у] = токены(собрать({ nsfw: false, бой: false }));
  })));
  return { шаги, итог: { блоки, уровни } };
}
export function посчитатьЦены(собрать, токены = оценкаТокенов) {
  const { шаги, итог } = шагиЦен(собрать, токены);
  for (const шаг of шаги) шаг();
  return итог;
}
/** То же по шагу за раз, с передышкой между шагами: панель не замирает. */
export async function посчитатьЦеныПостепенно(собрать, токены = оценкаТокенов, передышка = () => new Promise(r => setTimeout(r, 0))) {
  const { шаги, итог } = шагиЦен(собрать, токены);
  for (const шаг of шаги) { шаг(); await передышка(); }
  return итог;
}
function показатьЦены(корень, цены) {
  for (const [ключ, id] of Object.entries(ЦЕНА_ПОЛЕЙ)) {
    if (!id || !(ключ in цены.блоки)) continue;
    const пункт = корень.querySelector('#' + id)?.closest('label');
    if (!пункт) continue;
    let метка = пункт.querySelector(':scope > .hud-set-cost');
    // Ноль — блок в этом мире не работает (шкатулка в современности): без метки.
    if (!(цены.блоки[ключ] > 0)) { метка?.remove(); continue; }
    if (!метка) {
      метка = document.createElement('span');
      метка.className = 'hud-set-cost';
      метка.title = т('Примерно столько токенов этот блок добавляет к инструкции HUD в каждом запросе. Ответ модели с этим блоком тоже длиннее.');
      пункт.querySelector(':scope > .hud-set-q') ? пункт.querySelector(':scope > .hud-set-q').before(метка) : пункт.append(метка);
    }
    метка.textContent = '≈' + коротко(цены.блоки[ключ]);
  }
  for (const у of УРОВНИ) {
    const метка = корень.querySelector(`[data-qs-cost="${у}"]`);
    if (метка && Number.isFinite(цены.уровни[у])) метка.textContent = '≈' + коротко(цены.уровни[у]);
  }
}

// --- Показать настройку ------------------------------------------------------------------------
export function показатьНастройку(корень, id) {
  const поле = корень.querySelector('#' + id);
  if (!поле) return;
  корень.open = true;
  for (let д = поле.closest('details'); д; д = д.parentElement?.closest('details')) { д.open = true; д.classList.add('hud-set-reveal'); }
  const место = местоПоля(поле);
  место.classList.add('hud-set-reveal', 'hud-set-flash');
  setTimeout(() => место.classList.remove('hud-set-flash'), 1600);
  место.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// --- Подключение -------------------------------------------------------------------------------
function обновитьВыборы(корень) {
  for (const ряд of корень.querySelectorAll('[data-qs-row]')) {
    const что = ряд.dataset.qsRow, выбран = выборСейчас(что);
    ряд.querySelectorAll('[data-qs]').forEach(к => к.setAttribute('aria-pressed', String(к.dataset.v === выбран)));
    const заметка = ряд.querySelector('[data-qs-note]');
    if (заметка) заметка.textContent = т(пояснениеВыбора(что));
  }
}
function поставитьВид(корень, вид) {
  корень.classList.toggle('hud-set-simple', вид === 'simple');
  корень.querySelectorAll('[data-view]').forEach(к => к.setAttribute('aria-pressed', String(к.dataset.view === вид)));
}

/** Всё поверх собранной панели: пояснения, поиск, режим, зависимые, цены. */
export function подключитьЛёгкость(корень, основа) {
  if (!корень || корень.dataset.easy) return;
  корень.dataset.easy = '1';
  разметитьПояснения(корень);
  разметитьТонкие(корень);
  разметитьЗависимые(корень);
  обновитьЗависимые(корень); обновитьРяды(корень);
  поставитьВид(корень, settings.settingsView === 'simple' ? 'simple' : 'all');

  корень.addEventListener('click', (e) => {
    const вопрос = e.target.closest('.hud-set-q');
    if (вопрос) { e.preventDefault(); e.stopPropagation(); переключитьПояснение(вопрос); return; }
    const выбор = e.target.closest('[data-qs]');
    if (выбор) {
      e.preventDefault();
      применитьВыбор(выбор.dataset.qs, выбор.dataset.v, основа);
      обновитьВыборы(корень); обновитьЗависимые(корень); обновитьРяды(корень);
      if (выбор.dataset.qs === 'level') основа?.перерисоватьКарточкиЧата?.({ сохранитьВид: true });
      return;
    }
    const вид = e.target.closest('[data-view]');
    if (вид) { e.preventDefault(); settings.settingsView = вид.dataset.view; основа?.saveSettings?.(); поставитьВид(корень, settings.settingsView); return; }
    const куда = e.target.closest('[data-qs-go]');
    if (куда) { e.preventDefault(); показатьНастройку(корень, куда.dataset.qsGo); }
  }, true);
  // Любая галка: зависимые и выборы быстрого старта — к новым значениям.
  корень.addEventListener('change', () => { обновитьЗависимые(корень); обновитьРяды(корень); обновитьВыборы(корень); });
  const поиск = корень.querySelector('#hud-set-search');
  let таймер = 0;
  поиск?.addEventListener('input', () => { clearTimeout(таймер); таймер = setTimeout(() => искать(корень, поиск.value), 120); });
  поиск?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { поиск.value = ''; искать(корень, ''); } });

  // Цены — когда панель впервые раскрыли: инструкцию собираем только тогда.
  let посчитано = false;
  const посчитать = () => {
    if (посчитано || !корень.open || typeof основа?.загрузитьПромпт !== 'function') return;
    посчитано = true;
    основа.загрузитьПромпт().then(async м => {
      const собрать = (о) => м.buildDynamicPrompt(о);
      показатьЦены(корень, await посчитатьЦеныПостепенно(собрать));
    }).catch(e => { посчитано = false; console.warn('[TavernOS HUD] цена блоков', e); });
  };
  корень.addEventListener('toggle', посчитать);
  посчитать();
}
