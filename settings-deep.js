// hud-manager/settings-deep.js
//
// Два раздела настроек, выросших из просьбы игроков:
//   — «Глубокая настройка» внутри «Блоков HUD»: каждое поле и каждая метка
//     внутри поля выключается галочкой (deep-fields.js);
//   — «Свои статы»: стат со своим названием, пояснением, видом, вкладкой и
//     местом, плюс общий промт для них, который можно переписать целиком
//     (custom-stats.js).
// Разметка — строкой для settings-ui.js, обработчики — подключитьРазделы().
// Дерево глубокой настройки большое (две с половиной сотни галочек), поэтому
// собирается при первом раскрытии, а не вместе со всеми настройками.

import { settings } from './settings.js?v=23.88.8';
import { escapeHtml, mapKey } from './utils.js?v=23.88.8';
import { т, английский } from './i18n.js?v=23.88.8';
import { КАТАЛОГ, списокВыключенного } from './deep-fields.js?v=23.88.8';
import { ВИДЫ_СТАТОВ, ЧЬИ_СТАТЫ, ВКЛАДКИ_ИСТОРИИ, ШАБЛОН_СВОИХ, ЗНАКИ_СТАТОВ, ЦВЕТА_СТАТОВ, СВОЙ_ЦВЕТ, цветСтата } from './custom-stats.js?v=23.88.8';

// --- Глубокая настройка -------------------------------------------------------

export function разметкаГлубокой() {
  return `<details class="hud-set-group hud-set-sub hud-fine" id="hud-fine">
    <summary>🔬 Глубокая настройка <span class="hud-fine-count"></span></summary>
    <div class="hud-set-body">
      <div class="hud-set-note">Внутри каждого блока — каждое поле, а где в поле несколько данных, то и каждое из них. Снятая галочка убирает это из промта (модель перестаёт писать) и с карточки — и в старых сообщениях тоже. Блок целиком выключается галочками выше.</div>
      <div class="hud-fine-tree" id="hud-fine-tree"></div>
      <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-fine-all">Включить всё</button></div>
    </div>
  </details>`;
}

function деревоГлубокой() {
  const выкл = new Set(списокВыключенного(settings));
  const галка = (путь, имя, класс = '') => `<label class="hud-set-check hud-fine-item${класс}"><input type="checkbox" data-deep="${путь}" ${выкл.has(путь) ? '' : 'checked'}> <span>${escapeHtml(имя)}</span></label>`;
  return КАТАЛОГ.map(р => {
    const группы = р.группы.map(г => {
      const поля = г.поля.map(([к, имя, под]) => {
        const путь = (г.код || р.код) + '.' + к;
        const подметки = под ? `<div class="hud-fine-subs"${выкл.has(путь) ? ' data-off' : ''}>${под.map(([пк, пимя]) => галка(путь + '.' + пк, пимя, ' is-sub')).join('')}</div>` : '';
        return `<div class="hud-fine-field">${галка(путь, имя)}${подметки}</div>`;
      }).join('');
      // Одна группа в разделе — без лишнего уровня.
      return р.группы.length > 1 ? `<details class="hud-set-group hud-set-sub hud-fine-grp"><summary>${escapeHtml(г.имя)}</summary><div class="hud-set-body">${поля}</div></details>` : поля;
    }).join('');
    return `<details class="hud-set-group hud-set-sub hud-fine-sec" data-sec="${[...new Set(р.группы.map(г => г.код || р.код))].join(' ')}"><summary>${escapeHtml(р.имя)} <span class="hud-fine-count"></span></summary><div class="hud-set-body">${группы}</div></details>`;
  }).join('');
}

const выклСколько = (n) => (n ? (английский() ? `(${n} off)` : `(${n} выкл.)`) : '');
function счётчики(корень) {
  const выкл = списокВыключенного(settings);
  const общий = корень.querySelector(':scope > summary .hud-fine-count');
  if (общий) общий.textContent = выклСколько(выкл.length);
  корень.querySelectorAll('.hud-fine-sec').forEach(р => {
    const коды = р.dataset.sec.split(' ');
    const n = выкл.filter(п => коды.includes(п.split('.')[0])).length;
    const м = р.querySelector(':scope > summary .hud-fine-count');
    if (м) м.textContent = выклСколько(n);
  });
}

// --- Свои статы ---------------------------------------------------------------

// Поля карточки для «после поля»: ключ — как у строки в карточке (data-k).
const ПОЛЯ_ДЛЯ_МЕСТА = {
  chars: КАТАЛОГ.find(р => р.код === 'cs').группы.flatMap(г => г.поля).map(([к, имя]) => [mapKey(к).toLowerCase(), имя]),
  user: КАТАЛОГ.find(р => р.код === 'us').группы.flatMap(г => г.поля).map(([к, имя]) => [mapKey(к).toLowerCase(), имя]),
};

function опции(список, выбрано) {
  return список.map(([v, имя]) => `<option value="${escapeHtml(v)}"${v === выбрано ? ' selected' : ''}>${escapeHtml(имя)}</option>`).join('');
}

function редакторСтата(ст) {
  const кто = ['chars', 'user', 'story'].includes(ст.who) ? ст.who : 'chars';
  const место = typeof ст.after === 'string' ? ст.after : '';
  const свой = СВОЙ_ЦВЕТ.test(ст.color || '');
  const места = [['^', 'В начале вкладки'], ['', 'В конце вкладки'], ...(ПОЛЯ_ДЛЯ_МЕСТА[кто] || []).map(([к, имя]) => [к, т('После поля') + ' «' + т(имя) + '»'])];
  return `<div class="hud-cst-ed" data-id="${escapeHtml(ст.id)}">
    <div class="hud-cst-ed-top">
      <input type="text" class="text_pole hud-cst-ed-name" data-f="name" maxlength="40" value="${escapeHtml(ст.name || '')}" placeholder="Название, например «Голод»">
      <button type="button" class="hud-ava-btn hud-cst-ed-del" title="Удалить стат">🗑️</button>
    </div>
    <textarea class="text_pole hud-cst-ed-hint" data-f="hint" rows="2" placeholder="Что значит и от чего меняется — модель прочтёт это как правило. Например: «насколько персонаж голоден; растёт с часами без еды, падает после еды»">${escapeHtml(ст.hint || '')}</textarea>
    <div class="hud-cst-ed-row">
      <label>Вид <select class="hud-theme-select-input" data-f="view">${опции(ВИДЫ_СТАТОВ.map(в => [в.id, в.имя]), ст.view || 'num')}</select></label>
      <label>Значок <select class="hud-theme-select-input" data-f="icon">${опции(ЗНАКИ_СТАТОВ, ст.icon || '')}</select></label>
      <label>Цвет <span class="hud-cst-ed-color"><i class="hud-cst-ed-dot${цветСтата(ст).класс}"${цветСтата(ст).стиль} aria-hidden="true"></i><select class="hud-theme-select-input" data-f="color">${опции(ЦВЕТА_СТАТОВ, свой ? 'custom' : (ЦВЕТА_СТАТОВ.some(([v]) => v === ст.color) ? ст.color : ''))}</select>${свой ? `<input type="color" data-f="color" value="${escapeHtml(ст.color)}" title="Свой цвет">` : ''}</span></label>
      <label>Чей <select class="hud-theme-select-input" data-f="who">${опции(ЧЬИ_СТАТЫ.map(в => [в.id, в.имя]), кто)}</select></label>
      <label${кто === 'story' ? '' : ' hidden'}>Вкладка <select class="hud-theme-select-input" data-f="tab">${опции(ВКЛАДКИ_ИСТОРИИ.map(в => [в.id, в.имя]), ст.tab || 'memory')}</select></label>
      <label>Где <select class="hud-theme-select-input" data-f="after">${опции(места, места.some(([v]) => v === место) ? место : '')}</select></label>
    </div>
  </div>`;
}

export function разметкаСвоихСтатов() {
  return `<label class="hud-set-check hud-cst-master"><input type="checkbox" id="hud-cst-on" ${settings.customStatsOn !== false ? 'checked' : ''}> <span>Свои статы включены</span></label>
    <div class="hud-set-note">Выключено — модели не уходит ни строчки о своих статах и карточка их не показывает. Список и настройки ниже сохраняются: включите снова — всё на месте.</div>
    <div class="hud-set-note">Свои статы: модель пишет их каждый ход рядом с остальным HUD, а карточка показывает блоком с вашим названием. Назовите стат, опишите, что он значит, выберите вид и где показывать. Место в карточке можно поменять и прямо там: зажмите блок и тяните.</div>
    <div class="hud-cst-list" id="hud-cst-list"></div>
    <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-cst-add">➕ Добавить стат</button></div>
    <details class="hud-set-group hud-set-sub">
      <summary>📝 Промт своих статов</summary>
      <div class="hud-set-body">
        <div class="hud-set-note">Общий текст для всех статов. Список статов встаёт на место {{stats}} (если его убрать — в конец). Пусто — общий текст по умолчанию.</div>
        <textarea class="text_pole hud-cst-prompt" id="hud-cst-prompt" rows="6"></textarea>
        <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-cst-prompt-reset">Вернуть общий текст</button></div>
      </div>
    </details>`;
}

function списокСтатов() {
  if (!Array.isArray(settings.customStats)) settings.customStats = [];
  return settings.customStats;
}

// --- Обработчики ----------------------------------------------------------------

export function подключитьРазделы(основа) {
  // Карточки собираем заново не на каждую букву, а когда правка затихла.
  let таймер = 0;
  const перерисовать = () => { clearTimeout(таймер); таймер = setTimeout(() => { try { основа.перерисоватьКарточкиЧата(); } catch (_) { /* карточки догонят */ } }, 700); };
  const сохранить = () => { основа.saveSettings(); перерисовать(); };

  // Глубокая настройка.
  const глубокая = document.getElementById('hud-fine');
  const дерево = document.getElementById('hud-fine-tree');
  if (глубокая && дерево) {
    const собрать = () => { дерево.innerHTML = деревоГлубокой(); счётчики(глубокая); };
    глубокая.addEventListener('toggle', () => { if (глубокая.open && !дерево.firstChild) собрать(); });
    счётчики(глубокая);
    дерево.addEventListener('change', (e) => {
      const г = e.target.closest('input[data-deep]');
      if (!г) return;
      const выкл = new Set(списокВыключенного(settings));
      if (г.checked) выкл.delete(г.dataset.deep); else выкл.add(г.dataset.deep);
      settings.fieldsOff = [...выкл];
      // Поле выключено — его метки неактивны, но помнят свои галочки.
      const под = г.closest('.hud-fine-field')?.querySelector('.hud-fine-subs');
      if (под && !г.closest('.hud-fine-subs')) под.toggleAttribute('data-off', !г.checked);
      счётчики(глубокая);
      сохранить();
    });
    document.getElementById('hud-fine-all')?.addEventListener('click', () => {
      settings.fieldsOff = [];
      if (дерево.firstChild) собрать(); else счётчики(глубокая);
      сохранить();
    });
  }

  // Свои статы.
  document.getElementById('hud-cst-on')?.addEventListener('change', (e) => { settings.customStatsOn = e.target.checked; сохранить(); });
  const список = document.getElementById('hud-cst-list');
  if (!список) return;
  const показать = () => {
    const статы = списокСтатов();
    список.innerHTML = статы.length ? статы.map(редакторСтата).join('') : '<div class="hud-ava-empty">Пока ни одного. Нажмите «Добавить стат».</div>';
  };
  показать();
  document.getElementById('hud-cst-add')?.addEventListener('click', () => {
    списокСтатов().push({ id: 'cst' + Date.now().toString(36), name: '', hint: '', view: 'num', who: 'chars', tab: 'memory', after: '' });
    показать();
    список.querySelector('.hud-cst-ed:last-child .hud-cst-ed-name')?.focus();
    основа.saveSettings();
  });
  const правка = (e) => {
    const ред = e.target.closest('.hud-cst-ed');
    const поле = e.target.closest('[data-f]');
    if (!ред || !поле) return;
    const ст = списокСтатов().find(с => с && с.id === ред.dataset.id);
    if (!ст) return;
    ст[поле.dataset.f] = поле.value;
    // «Свой цвет» — в стате лежит сам цвет (последний свой помнится в ownColor);
    // рядом с выбором появляется палитра.
    if (поле.dataset.f === 'color' && поле.tagName === 'SELECT') {
      if (поле.value === 'custom') ст.color = СВОЙ_ЦВЕТ.test(ст.ownColor || '') ? ст.ownColor : '#d9548a';
      ред.outerHTML = редакторСтата(ст);
    } else if (поле.dataset.f === 'color') ст.ownColor = ст.color;
    // Сменился владелец — список «после поля» другой: перерисуем редактор.
    if (поле.dataset.f === 'who') { ст.after = ''; ред.outerHTML = редакторСтата(ст); }
    сохранить();
  };
  список.addEventListener('input', (e) => { if (e.target.matches('input, textarea')) правка(e); });
  список.addEventListener('change', (e) => { if (e.target.matches('select')) правка(e); });
  список.addEventListener('click', (e) => {
    const del = e.target.closest('.hud-cst-ed-del');
    if (!del) return;
    const ред = del.closest('.hud-cst-ed');
    settings.customStats = списокСтатов().filter(с => с && с.id !== ред.dataset.id);
    показать();
    сохранить();
  });

  const промт = document.getElementById('hud-cst-prompt');
  if (промт) {
    промт.value = settings.customStatsPrompt && settings.customStatsPrompt.trim() ? settings.customStatsPrompt : ШАБЛОН_СВОИХ;
    промт.addEventListener('input', () => {
      // Текст по умолчанию не сохраняем как свой: обновится вместе с HUD.
      settings.customStatsPrompt = промт.value.trim() === ШАБЛОН_СВОИХ.trim() ? '' : промт.value;
      основа.saveSettings();
    });
    document.getElementById('hud-cst-prompt-reset')?.addEventListener('click', () => {
      settings.customStatsPrompt = '';
      промт.value = ШАБЛОН_СВОИХ;
      основа.saveSettings();
    });
  }
}
