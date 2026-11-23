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

import { settings } from './settings.js?v=23.89.88';
import { escapeHtml, mapKey } from './utils.js?v=23.89.88';
import { т, английский } from './i18n.js?v=23.89.88';
import { уверены } from './confirm-erase.js?v=23.89.88';
import { КАТАЛОГ, списокВыключенного, каталогДляНастроек } from './deep-fields.js?v=23.89.88';
import { КАТАЛОГ_СЖАТИЯ, ПУТИ_СЖАТИЯ, лимитПоля, подписьЛимита, очиститьЛимиты, МАКС_СЛОВ, МАКС_ПУНКТОВ } from './compact-fields.js?v=23.89.88';
import { ВИДЫ_СТАТОВ, ЧЬИ_СТАТЫ, ВКЛАДКИ_ИСТОРИИ, ШАБЛОН_СВОИХ, ЗНАКИ_СТАТОВ, ЦВЕТА_СТАТОВ, СВОЙ_ЦВЕТ, цветСтата } from './custom-stats.js?v=23.89.88';

// --- Глубокая настройка -------------------------------------------------------

export function разметкаГлубокой() {
  return `<details class="hud-set-group hud-set-sub hud-fine" id="hud-fine">
    <summary>🔬 Глубокая настройка <span class="hud-fine-count"></span></summary>
    <div class="hud-set-body">
      <div class="hud-set-note">Внутри каждого блока — каждое поле, а где в поле несколько данных, то и каждое из них. Снятая галочка убирает это из промта (модель перестаёт писать) и с карточки — и в старых сообщениях тоже. Блок целиком выключается галочками выше.</div>
      <label class="hud-set-check hud-fine-comms" title="Современный мир, где люди пишут друг другу бумажные письма">✉️ Связь в современности:
        <select id="hud-modern-comms" class="hud-theme-select-input">
          ${[['phone', '📱 Телефон'], ['letters', '✉️ Письма вместо телефона'], ['both', '📱✉️ Телефон и письма']].map(([к, п]) => `<option value="${к}"${(settings.modernComms || 'phone') === к ? ' selected' : ''}>${п}</option>`).join('')}
        </select>
      </label>
      <div class="hud-set-note">Для современных миров, где пишут письма: эпистолярный роман, пансион, переписка через океан, мир без связи. «Письма вместо телефона» убирают телефон из промта, модель ведёт письма — с конвертом, доставкой и статусом, — и в карточке появляется вкладка «Письма». «Телефон и письма» оставляют оба. В средневековье письма и так в шкатулке.</div>
      <div class="hud-fine-tree" id="hud-fine-tree"></div>
      <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-fine-all" title="Снова включить все поля всех блоков в глубокой настройке">Включить всё</button></div>
    </div>
  </details>`;
}

function деревоГлубокой() {
  const выкл = new Set(списокВыключенного(settings));
  const галка = (путь, имя, класс = '') => `<label class="hud-set-check hud-fine-item${класс}"><input type="checkbox" data-deep="${путь}" ${выкл.has(путь) ? '' : 'checked'}> <span>${escapeHtml(имя)}</span></label>`;
  return каталогДляНастроек(settings).map(р => {
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

// --- Сжатые значения и их размеры (compact-fields.js) ---------------------------
// Два раздела в «Генерации»: какие поля сжимать — галочками, а «Глубокая
// настройка» — сколько слов и пунктов у каждого. Размеры правятся в полях и
// уходят в настройки только по «Сохранить»; «По умолчанию» — встроенные.

export function разметкаСжатия() {
  return `<details class="hud-set-group hud-set-sub hud-squeeze" id="hud-squeeze">
    <summary>🗜️ Сжатые значения <span class="hud-fine-count"></span></summary>
    <div class="hud-set-body">
      <label class="hud-set-check" title="Промт перестаёт просить «как можно подробнее»: у отмеченных полей появляется жёсткий размер — сколько слов и пунктов. HUD короче, ответ дешевле и быстрее. Размеры — в «Глубокой настройке» ниже."><input type="checkbox" id="hud-compact" ${settings.hudCompact === true ? 'checked' : ''}><span>🗜️ Сжимать значения полей</span></label>
      <div class="hud-set-note">Отмеченные поля модель пишет коротко, в пределах размера: мысли — до 15 слов, ключевые мысли — до 3 пунктов по 6 слов, дневник — до 80 слов. Неотмеченные — как прежде, подробно. Поле выключенного блока не сжимается — его и так нет в промте.</div>
      <div class="hud-fine-tree" id="hud-squeeze-tree"></div>
      <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-squeeze-all" title="Сжать все поля из списка">Отметить все</button><button type="button" class="hud-theme-act" id="hud-squeeze-none" title="Вернуть всем полям обычную длину">Снять все</button></div>
    </div>
  </details>`;
}

export function разметкаРазмеров() {
  return `<details class="hud-set-group hud-set-sub hud-sizes" id="hud-sizes">
    <summary>🎛️ Глубокая настройка <span class="hud-fine-count"></span></summary>
    <div class="hud-set-body">
      <div class="hud-set-note">Размер каждого сжатого поля: сколько слов, а у списков — сколько пунктов и слов в каждом (0 пунктов — сколько угодно, каждый короткий). Правки вступают в силу по «Сохранить». «По умолчанию» возвращает встроенные размеры всем полям.</div>
      <div class="hud-sizes-list" id="hud-sizes-list"></div>
      <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-sizes-save" title="Запомнить размеры, заданные выше">Сохранить</button><button type="button" class="hud-theme-act" id="hud-sizes-default" title="Вернуть всем сжатым полям размеры по умолчанию">По умолчанию</button></div>
    </div>
  </details>`;
}

function деревоСжатия() {
  const снято = new Set(Array.isArray(settings.compactOff) ? settings.compactOff : []);
  return КАТАЛОГ_СЖАТИЯ.map(г => `<details class="hud-set-group hud-set-sub hud-fine-grp"><summary>${escapeHtml(г.имя)}</summary><div class="hud-set-body">${г.поля.map(([путь, имя]) =>
    `<label class="hud-set-check hud-fine-item"><input type="checkbox" data-squeeze="${путь}" ${снято.has(путь) ? '' : 'checked'}> <span>${escapeHtml(имя)}<small class="hud-sizes-hint">${escapeHtml(подписьЛимита(лимитПоля(settings, путь)))}</small></span></label>`).join('')}</div></details>`).join('');
}

function списокРазмеров() {
  const число = (путь, ключ, значение, мин, макс) => `<input type="number" class="hud-set-num" data-size="${путь}" data-k="${ключ}" min="${мин}" max="${макс}" step="1" value="${значение}">`;
  return КАТАЛОГ_СЖАТИЯ.map(г => `<details class="hud-set-group hud-set-sub hud-fine-grp"><summary>${escapeHtml(г.имя)}</summary><div class="hud-set-body">${г.поля.map(([путь, имя]) => {
    const л = лимитПоля(settings, путь);
    const своё = !!(settings.compactLimits && settings.compactLimits[путь]);
    const поля = 'i' in л
      ? `${т('не больше')} ${число(путь, 'i', л.i, 0, МАКС_ПУНКТОВ)} ${т('пунктов по')} ${число(путь, 'w', л.w, 1, МАКС_СЛОВ)} ${т('слов')}`
      : `${т('не больше')} ${число(путь, 'w', л.w, 1, МАКС_СЛОВ)} ${т('слов')}`;
    return `<div class="hud-sizes-row${своё ? ' is-own' : ''}"><span class="hud-sizes-name">${escapeHtml(имя)}</span><span class="hud-sizes-val">${поля}</span></div>`;
  }).join('')}</div></details>`).join('');
}

function счётчикиСжатия() {
  const сжато = document.querySelector('#hud-squeeze > summary .hud-fine-count');
  if (сжато) {
    const n = settings.hudCompact === true ? ПУТИ_СЖАТИЯ.length - (Array.isArray(settings.compactOff) ? settings.compactOff.filter(п => ПУТИ_СЖАТИЯ.includes(п)).length : 0) : 0;
    сжато.textContent = settings.hudCompact === true ? (английский() ? `(${n} compressed)` : `(сжато: ${n})`) : (английский() ? '(off)' : '(выкл.)');
  }
  const размеры = document.querySelector('#hud-sizes > summary .hud-fine-count');
  if (размеры) { const n = Object.keys(очиститьЛимиты(settings.compactLimits)).length; размеры.textContent = n ? (английский() ? `(${n} changed)` : `(изменено: ${n})`) : ''; }
}

// --- Свои статы ---------------------------------------------------------------

// Поля карточки для «после поля»: ключ — как у строки в карточке (data-k).
const ПОЛЯ_ДЛЯ_МЕСТА = {
  chars: КАТАЛОГ.find(р => р.код === 'cs').группы.flatMap(г => г.поля).map(([к, имя]) => [mapKey(к).toLowerCase(), имя]),
  // У игрока список зависит от «все поля, как у персонажей» — берём при показе.
  get user() { return каталогДляНастроек(settings).find(р => р.код === 'us').группы.flatMap(г => г.поля).map(([к, имя]) => [mapKey(к).toLowerCase(), имя]); },
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
  return `<label class="hud-set-check hud-cst-master" title="Главный выключатель своих статов: выключено — модель о них не пишет, карточка их не показывает, список сохраняется"><input type="checkbox" id="hud-cst-on" ${settings.customStatsOn !== false ? 'checked' : ''}> <span>Свои статы включены</span></label>
    <div class="hud-set-note">Выключено — модели не уходит ни строчки о своих статах и карточка их не показывает. Список и настройки ниже сохраняются: включите снова — всё на месте.</div>
    <div class="hud-set-note">Свои статы: модель пишет их каждый ход рядом с остальным HUD, а карточка показывает блоком с вашим названием. Назовите стат, опишите, что он значит, выберите вид и где показывать. Место в карточке можно поменять и прямо там: зажмите блок и тяните.</div>
    <div class="hud-cst-list" id="hud-cst-list"></div>
    <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-cst-add" title="Новый стат: название, что он значит для модели, вид, значок, цвет и у кого он есть">➕ Добавить стат</button></div>
    <details class="hud-set-group hud-set-sub">
      <summary>📝 Промт своих статов</summary>
      <div class="hud-set-body">
        <div class="hud-set-note">Общий текст для всех статов. Список статов встаёт на место {{stats}} (если его убрать — в конец). Пусто — общий текст по умолчанию.</div>
        <textarea class="text_pole hud-cst-prompt" id="hud-cst-prompt" rows="6"></textarea>
        <div class="hud-set-apps"><button type="button" class="hud-theme-act" id="hud-cst-prompt-reset" title="Вернуть общий текст промта своих статов по умолчанию вместо своего">Вернуть общий текст</button></div>
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

  // Связь в современности: телефон, письма или оба (era.js).
  document.getElementById('hud-modern-comms')?.addEventListener('change', (e) => {
    settings.modernComms = ['letters', 'both'].includes(e.target.value) ? e.target.value : 'phone';
    сохранить();
  });

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

  // Сжатые значения: какие поля.
  const сжатие = document.getElementById('hud-squeeze');
  const деревоС = document.getElementById('hud-squeeze-tree');
  if (сжатие && деревоС) {
    const собратьС = () => { деревоС.innerHTML = деревоСжатия(); счётчикиСжатия(); };
    сжатие.addEventListener('toggle', () => { if (сжатие.open && !деревоС.firstChild) собратьС(); });
    счётчикиСжатия();
    document.getElementById('hud-compact')?.addEventListener('change', (e) => { settings.hudCompact = e.target.checked; счётчикиСжатия(); основа.saveSettings(); });
    деревоС.addEventListener('change', (e) => {
      const г = e.target.closest('input[data-squeeze]');
      if (!г) return;
      const снято = new Set(Array.isArray(settings.compactOff) ? settings.compactOff : []);
      if (г.checked) снято.delete(г.dataset.squeeze); else снято.add(г.dataset.squeeze);
      settings.compactOff = [...снято].filter(п => ПУТИ_СЖАТИЯ.includes(п));
      счётчикиСжатия();
      основа.saveSettings();
    });
    const всем = (вкл) => { settings.compactOff = вкл ? [] : [...ПУТИ_СЖАТИЯ]; if (деревоС.firstChild) собратьС(); else счётчикиСжатия(); основа.saveSettings(); };
    document.getElementById('hud-squeeze-all')?.addEventListener('click', () => всем(true));
    document.getElementById('hud-squeeze-none')?.addEventListener('click', () => всем(false));
  }

  // Глубокая настройка размеров: правки — в полях, в настройки — по «Сохранить».
  const размеры = document.getElementById('hud-sizes');
  const списокР = document.getElementById('hud-sizes-list');
  if (размеры && списокР) {
    const собратьР = () => { списокР.innerHTML = списокРазмеров(); счётчикиСжатия(); };
    // Подписи размеров в дереве «Сжатых значений» — тоже по сохранённому.
    const обновитьДерево = () => { if (деревоС && деревоС.firstChild) деревоС.innerHTML = деревоСжатия(); };
    размеры.addEventListener('toggle', () => { if (размеры.open && !списокР.firstChild) собратьР(); });
    счётчикиСжатия();
    списокР.addEventListener('input', (e) => { e.target.closest('.hud-sizes-row')?.classList.add('is-dirty'); });
    document.getElementById('hud-sizes-save')?.addEventListener('click', () => {
      const сырые = {};
      списокР.querySelectorAll('input[data-size]').forEach(п => { (сырые[п.dataset.size] ||= {})[п.dataset.k] = п.value; });
      // Нетронутый список (не раскрывали) — сохранять нечего.
      if (!Object.keys(сырые).length) return;
      settings.compactLimits = очиститьЛимиты(сырые);
      собратьР();
      обновитьДерево();
      основа.saveSettings();
      основа.showHudToast?.('success', 'Размеры сохранены', settings.hudCompact === true ? 'Новые размеры уйдут модели со следующим ответом.' : 'Они начнут действовать, когда включите «Сжимать значения полей».');
    });
    document.getElementById('hud-sizes-default')?.addEventListener('click', async () => {
      if (Object.keys(очиститьЛимиты(settings.compactLimits)).length && !await уверены({ текст: 'Свои размеры всех полей заменятся встроенными.', кнопка: 'Вернуть встроенные' })) return;
      settings.compactLimits = {};
      if (списокР.firstChild || размеры.open) собратьР(); else счётчикиСжатия();
      обновитьДерево();
      основа.saveSettings();
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
  список.addEventListener('click', async (e) => {
    const del = e.target.closest('.hud-cst-ed-del');
    if (!del) return;
    const ред = del.closest('.hud-cst-ed');
    const имя = ред.querySelector('[data-f="name"]')?.value.trim() || '';
    if (имя && !await уверены({ что: имя, текст: 'Стат исчезнет из HUD и перестанет уходить модели. Его значения в прошлых ходах показываться не будут.' })) return;
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
    document.getElementById('hud-cst-prompt-reset')?.addEventListener('click', async () => {
      if (settings.customStatsPrompt && !await уверены({ текст: 'Ваш текст промпта заменится встроенным.', кнопка: 'Вернуть встроенный' })) return;
      settings.customStatsPrompt = '';
      промт.value = ШАБЛОН_СВОИХ;
      основа.saveSettings();
    });
  }
}
